import type { UserSettings } from '../types';
import { loadSettings } from './storageService';
import { normalizeApiKey } from '../utils/apiKey';
import { checkApiHealth } from './aiService';
import { jsonApiHeaders } from '../utils/apiHeaders';

export interface OcrChatLine {
  role: 'me' | 'other';
  content: string;
}

/** 与 server/ocr.js MAX_OCR_BASE64_LEN 对齐，留余量给 JSON 包装 */
const MAX_OCR_BASE64_CHARS = 3.5 * 1024 * 1024;
const MAX_OCR_DIMENSION = 1600;
const JPEG_QUALITY_START = 0.82;

async function assertKey(settings: UserSettings): Promise<void> {
  if (settings.apiKey?.trim()) return;
  const health = await checkApiHealth();
  if (!health.serverKeyConfigured) throw new Error('请先配置 API Key');
}

export async function recognizeChatScreenshot(
  imageBase64: string,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<OcrChatLine[]> {
  const cfg = settings ?? loadSettings();
  await assertKey(cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  if (cfg.provider !== 'aiyiwei' && cfg.provider !== 'openrouter') {
    throw new Error('截图识别仅支持 OpenRouter 或爱易威，请在设置中切换服务商后再试');
  }

  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: jsonApiHeaders(),
    signal,
    body: JSON.stringify({
      provider: cfg.provider,
      apiKey,
      imageBase64,
      myNickname: cfg.myNickname,
      otherNickname: cfg.otherNickname,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String(err.error || '截图识别失败'));
  }

  const data = await res.json();
  const lines = Array.isArray(data.messages) ? data.messages : [];
  return lines
    .map((item: { role?: string; content?: string }) => ({
      role: item.role === 'me' ? ('me' as const) : ('other' as const),
      content: String(item.content || '').trim(),
    }))
    .filter((l: OcrChatLine) => l.content);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, MAX_OCR_DIMENSION / Math.max(width, height, 1));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = JPEG_QUALITY_START;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > MAX_OCR_BASE64_CHARS && quality > 0.45) {
        quality -= 0.08;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUrl;
  });
}

/** 上传前压缩大图，避免 Vercel 请求体超限 */
export async function prepareImageForOcr(file: File): Promise<string> {
  const dataUrl = await fileToBase64(file);
  const needsCompress =
    dataUrl.length > MAX_OCR_BASE64_CHARS || !dataUrl.startsWith('data:image/jpeg');
  if (!needsCompress) return dataUrl;
  return compressDataUrl(dataUrl);
}
