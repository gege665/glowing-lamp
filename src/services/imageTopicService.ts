import type { UserSettings } from '../types';
import { loadSettings } from './storageService';
import { normalizeApiKey } from '../utils/apiKey';
import { apiFetch } from '../utils/apiFetch';
import { checkApiHealth } from './aiService';
import { prepareImageForOcr } from './ocrService';
import {
  IMAGE_TOPIC_TEXT_SYSTEM,
  buildLocalImageTopic,
  normalizeImageTopicResult,
  type ImageTopicResult,
} from '../constants/imageTopic';
import { getModelCallParams, mergeSystemPrompt } from '../constants/modelCallParams';
import { resolveModelForSettings } from '../constants/modelRouting';

async function assertKey(settings: UserSettings): Promise<void> {
  if (settings.apiKey?.trim()) return;
  const health = await checkApiHealth();
  if (!health.serverKeyConfigured) throw new Error('请先配置 API Key');
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* continue */
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function visionProvider(cfg: UserSettings): 'aiyiwei' | 'openrouter' {
  return cfg.provider === 'aiyiwei' ? 'aiyiwei' : 'openrouter';
}

/** 已压缩的 base64 识图聊话题 */
export async function analyzeImageForTopics(
  imageBase64: string,
  caption = '',
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<ImageTopicResult> {
  const cfg = settings ?? loadSettings();
  await assertKey(cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  const res = await apiFetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      provider: visionProvider(cfg),
      apiKey,
      imageBase64,
      mode: 'imageTopic',
      caption,
      myNickname: cfg.myNickname,
      otherNickname: cfg.otherNickname,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String((err as { error?: string }).error || '识图失败'));
  }

  const data = await res.json();
  const topic = normalizeImageTopicResult(data.topic, 'ai');
  if (!topic.replies.length && !topic.topics.length) {
    return buildLocalImageTopic(caption || topic.sceneSummary);
  }
  return topic;
}

/** 从 File 识图（自动压缩） */
export async function analyzeImageFileForTopics(
  file: File,
  caption = '',
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<ImageTopicResult> {
  const base64 = await prepareImageForOcr(file);
  return analyzeImageForTopics(base64, caption, settings, signal);
}

/** 仅配文：文本模型生成话题（无图） */
export async function analyzeCaptionForTopics(
  caption: string,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<ImageTopicResult> {
  const text = caption.trim();
  if (!text) return buildLocalImageTopic('');

  const cfg = settings ?? loadSettings();
  try {
    await assertKey(cfg);
  } catch {
    return buildLocalImageTopic(text);
  }

  const chatParams = getModelCallParams('chat');
  const model = resolveModelForSettings('chat', cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  try {
    const res = await apiFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        provider: cfg.provider,
        apiKey,
        model,
        messages: [
          {
            role: 'system',
            content: mergeSystemPrompt(chatParams.systemTone, IMAGE_TOPIC_TEXT_SYSTEM),
          },
          {
            role: 'user',
            content: `对方发图配文：「${text.slice(0, 200)}」
（无原图，按配文推断画面与可聊点）
输出 JSON：
{"sceneSummary":"","hotspots":[],"interests":[],"lifeDetails":[],"emotion":"","replies":["","",""],"topics":["","",""]}`,
          },
        ],
        temperature: 0.8,
        maxTokens: 600,
        jsonMode: true,
      }),
    });

    if (!res.ok) return buildLocalImageTopic(text);

    const data = await res.json();
    const obj = extractJsonObject(String(data.content || ''));
    if (!obj) return buildLocalImageTopic(text);
    const topic = normalizeImageTopicResult(obj as Partial<ImageTopicResult>, 'ai');
    if (!topic.replies.length) {
      const local = buildLocalImageTopic(text);
      return { ...topic, replies: local.replies, topics: topic.topics.length ? topic.topics : local.topics };
    }
    return topic;
  } catch {
    return buildLocalImageTopic(text);
  }
}
