import {
  resolveOpenRouterApiKey,
  normalizeApiKey,
  validateKeyForProvider,
} from './openrouter.js';
import { resolveAiyiweiApiKey } from './aiyiwei.js';
import { assertProductionApiAccess } from './handlers.js';
import { assertRateLimit } from '../shared/rateLimit.js';

const OCR_MODEL_OPENROUTER = 'google/gemini-2.0-flash-001';
const OCR_MODEL_AIYIWEI = 'gpt-4o-mini';
const MAX_OCR_MESSAGES = 200;
const MAX_OCR_CONTENT_LEN = 5000;
/** Vercel Serverless 请求体约 4.5MB，base64 字符上限取保守值 */
const MAX_OCR_BASE64_LEN = 4 * 1024 * 1024;
const OCR_FETCH_TIMEOUT_MS = 120_000;

function sanitizeNickname(value, fallback, maxLen = 20) {
  const s = String(value ?? fallback)
    .replace(/[\n\r{}[\]"\\]/g, '')
    .trim()
    .slice(0, maxLen);
  return s || fallback;
}

function resolveOcrKey(provider, clientKey) {
  // 与 chat 一致：OpenRouter 仅 sk-or-/gsk_ 为真实 BYOK，其余回退服务端 Key
  if (provider === 'openrouter') {
    return resolveOpenRouterApiKey(clientKey);
  }
  if (provider === 'aiyiwei') {
    return resolveAiyiweiApiKey(clientKey);
  }
  return normalizeApiKey(clientKey);
}

function buildOcrPrompt(myNickname, otherNickname) {
  return `识别这张聊天截图中的所有对话文字。
我方昵称可能显示为「${myNickname}」或「我」，对方为「${otherNickname}」。
返回 JSON 数组：[{"role":"me"|"other","content":"消息内容"}]
- 右侧/绿色气泡通常是 me，左侧/白色是 other
- 按时间从上到下，只输出 JSON 数组`;
}

function buildImageTopicPrompt(caption) {
  const cap = String(caption ?? '').trim().slice(0, 200);
  return `你是「灵焰恋爱大师」识图聊话题助手。
对方发来一张生活/自拍/风景/美食/宠物等配图${cap ? `，配文：「${cap}」` : '（可能无配文）'}。
请看图挖掘可聊点，生成自然不尴尬、能延伸的回复，完美接住对方配图发言。

只输出 JSON（不要 markdown）：
{
  "sceneSummary": "画面一句话（≤25字）",
  "hotspots": ["可聊热点1","热点2","热点3"],
  "interests": ["兴趣线索1","线索2"],
  "lifeDetails": ["生活细节1","细节2"],
  "emotion": "情绪状态（≤15字）",
  "replies": ["可直接发送的图片回复1","回复2","回复3"],
  "topics": ["拓展话题1","话题2","话题3"]
}
要求：回复口语短句、不尬夸、不查户口、能自然续聊。`;
}

function parseImageTopicJson(raw) {
  const trimmed = String(raw || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw Object.assign(new Error('无法解析识图结果，请换一张更清晰的图'), { status: 422 });
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw Object.assign(new Error('无法解析识图结果，请换一张更清晰的图'), { status: 422 });
  }
}

function normalizeImageTopic(raw) {
  const list = (v, n = 4) =>
    Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, n) : [];
  return {
    sceneSummary: String(raw?.sceneSummary ?? '').trim().slice(0, 40),
    hotspots: list(raw?.hotspots, 4),
    interests: list(raw?.interests, 3),
    lifeDetails: list(raw?.lifeDetails, 3),
    emotion: String(raw?.emotion ?? '').trim().slice(0, 20),
    replies: list(raw?.replies, 4),
    topics: list(raw?.topics, 4),
  };
}

async function callVisionApi({ url, key, model, imageUrl, prompt, maxTokens = 1800, temperature = 0.2 }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw Object.assign(new Error('截图识别超时，请稍后重试'), { status: 408 });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error('[ocr] upstream error', res.status, text.slice(0, 500));
    throw Object.assign(new Error('截图识别失败，请稍后重试'), { status: res.status });
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}

function parseOcrJson(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw Object.assign(new Error('无法解析截图文字，请尝试更清晰的截图'), { status: 422 });
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw Object.assign(new Error('无法解析截图文字，请尝试更清晰的截图'), { status: 422 });
  }
}

function normalizeOcrMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m === 'object')
    .slice(0, MAX_OCR_MESSAGES)
    .map((m) => ({
      role: m.role === 'me' ? 'me' : 'other',
      content: String(m.content ?? '')
        .trim()
        .slice(0, MAX_OCR_CONTENT_LEN),
    }))
    .filter((m) => m.content);
}

export async function handleOcr(req) {
  assertRateLimit(req, { key: 'ocr', max: 10, windowMs: 60_000 });
  const body = req.body || {};
  const {
    imageBase64,
    provider = 'openrouter',
    apiKey: clientKey,
    myNickname = '我',
    otherNickname = '对方',
    mode = 'chatScreenshot',
    caption = '',
  } = body;

  assertProductionApiAccess(req, provider, body);

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw Object.assign(new Error('请提供图片'), { status: 400 });
  }
  if (imageBase64.length > MAX_OCR_BASE64_LEN) {
    throw Object.assign(new Error('图片过大，请压缩至 3MB 以内后重试'), { status: 400 });
  }

  const key = resolveOcrKey(provider, clientKey);
  if (!key) {
    throw Object.assign(new Error('请先配置 API Key（推荐 OpenRouter 以支持识图）'), {
      status: 400,
    });
  }
  validateKeyForProvider(provider, key);

  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const isTopic = mode === 'imageTopic';
  const prompt = isTopic
    ? buildImageTopicPrompt(caption)
    : buildOcrPrompt(
        sanitizeNickname(myNickname, '我'),
        sanitizeNickname(otherNickname, '对方')
      );

  const visionOpts = {
    imageUrl,
    prompt,
    // 聊天截图 OCR 无需大生成预算；压低 max_tokens 降低视觉模型算力与账单
    maxTokens: isTopic ? 600 : 900,
    temperature: isTopic ? 0.7 : 0.2,
  };

  let raw;
  if (provider === 'aiyiwei') {
    raw = await callVisionApi({
      url: 'https://aiyiwei.vip/v1/chat/completions',
      key,
      model: OCR_MODEL_AIYIWEI,
      ...visionOpts,
    });
  } else {
    raw = await callVisionApi({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key,
      model: OCR_MODEL_OPENROUTER,
      ...visionOpts,
    });
  }

  if (isTopic) {
    const topic = normalizeImageTopic(parseImageTopicJson(raw));
    if (!topic.replies.length && !topic.topics.length && !topic.sceneSummary) {
      throw Object.assign(new Error('未识别到可用话题，请换图或补充配文'), { status: 422 });
    }
    return { topic };
  }

  const messages = normalizeOcrMessages(parseOcrJson(raw));
  if (!messages.length) {
    throw Object.assign(new Error('未识别到对话内容'), { status: 422 });
  }

  return { messages };
}
