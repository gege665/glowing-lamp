import { resolveOpenRouterApiKey, isServerOpenRouterKeyConfigured } from './openrouter.js';
import {
  resolveAiyiweiApiKey,
  isServerAiyiweiKeyConfigured,
} from './aiyiwei.js';
import { normalizeApiKey } from './openrouter.js';
import { assertProductionApiAccess } from './handlers.js';
import { assertRateLimit, buildRateLimitOptions } from '../shared/rateLimit.js';
import { validateKeyForProvider } from './openrouter.js';

const OCR_MODEL_OPENROUTER = 'google/gemini-2.0-flash-001';
const OCR_MODEL_AIYIWEI = 'gpt-4o-mini';
const MAX_OCR_MESSAGES = 200;
const MAX_OCR_CONTENT_LEN = 5000;
/** Vercel Serverless 请求体约 4.5MB，base64 字符上限取保守值 */
const MAX_OCR_BASE64_LEN = 4 * 1024 * 1024;

function sanitizeNickname(value, fallback, maxLen = 20) {
  const s = String(value ?? fallback)
    .replace(/[\n\r{}[\]"\\]/g, '')
    .trim()
    .slice(0, maxLen);
  return s || fallback;
}

function resolveOcrKey(provider, clientKey) {
  const key = normalizeApiKey(clientKey);
  if (key) return key;
  if (provider === 'openrouter' && isServerOpenRouterKeyConfigured()) {
    return resolveOpenRouterApiKey('');
  }
  if (provider === 'aiyiwei' && isServerAiyiweiKeyConfigured()) {
    return resolveAiyiweiApiKey('');
  }
  return '';
}

function assertOcrProviderSupported(provider) {
  if (provider === 'aiyiwei' || provider === 'openrouter') return;
  throw Object.assign(
    new Error('截图识别仅支持 OpenRouter 或爱易威，请在设置中切换服务商后再试'),
    { status: 400 }
  );
}

function buildOcrPrompt(myNickname, otherNickname) {
  return `识别这张聊天截图中的所有对话文字。
我方昵称可能显示为「${myNickname}」或「我」，对方为「${otherNickname}」。
返回 JSON 数组：[{"role":"me"|"other","content":"消息内容"}]
- 右侧/绿色气泡通常是 me，左侧/白色是 other
- 按时间从上到下，只输出 JSON 数组`;
}

const OCR_FETCH_TIMEOUT_MS = 120_000;

async function callVisionApi({ url, key, model, imageUrl, prompt }) {
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
        max_tokens: 4096,
        temperature: 0.2,
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
  await assertRateLimit(req, buildRateLimitOptions(req, {
    key: 'ocr',
    userMax: 12,
    serverMax: 6,
    windowMs: 60_000,
  }));
  const body = req.body || {};
  const {
    imageBase64,
    provider = 'openrouter',
    apiKey: clientKey,
    myNickname = '我',
    otherNickname = '对方',
  } = body;

  assertProductionApiAccess(req, provider, body);
  assertOcrProviderSupported(provider);

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw Object.assign(new Error('请提供截图'), { status: 400 });
  }
  if (imageBase64.length > MAX_OCR_BASE64_LEN) {
    throw Object.assign(new Error('图片过大，请压缩至 3MB 以内后重试'), { status: 400 });
  }

  const key = resolveOcrKey(provider, clientKey);
  if (!key) {
    throw Object.assign(
      new Error('请先配置支持视觉识别的 API Key（OpenRouter 或爱易威）'),
      { status: 400 }
    );
  }
  validateKeyForProvider(provider, key);

  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;
  const prompt = buildOcrPrompt(
    sanitizeNickname(myNickname, '我'),
    sanitizeNickname(otherNickname, '对方')
  );

  let raw;
  if (provider === 'aiyiwei') {
    raw = await callVisionApi({
      url: 'https://aiyiwei.vip/v1/chat/completions',
      key,
      model: OCR_MODEL_AIYIWEI,
      imageUrl,
      prompt,
    });
  } else {
    raw = await callVisionApi({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key,
      model: OCR_MODEL_OPENROUTER,
      imageUrl,
      prompt,
    });
  }

  const messages = normalizeOcrMessages(parseOcrJson(raw));
  if (!messages.length) {
    throw Object.assign(new Error('未识别到对话内容'), { status: 422 });
  }

  return { messages };
}
