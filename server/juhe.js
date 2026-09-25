import { normalizeApiKey } from './openrouter.js';

export const JUHE_BASE_URL = 'https://api.juheapi.com/v1/chat/completions';
export const JUHE_DEFAULT_CHAT_MODEL = 'gpt-5.4-mini';
export const JUHE_DEFAULT_ANALYSIS_MODEL = 'deepseek-v4-flash';
export const JUHE_FALLBACK_CHAT_MODEL = 'doubao-seed-2-0-lite';

/** 生产环境：在服务端配置 JUHE_API_KEY，前端无需传 Key */
export function getServerJuheKey() {
  return normalizeApiKey(process.env.JUHE_API_KEY || '');
}

export function isServerJuheKeyConfigured() {
  return getServerJuheKey().length > 0;
}

/** 优先使用用户填写的 Key；未填写时使用服务端 Key */
export function resolveJuheApiKey(clientApiKey) {
  const clientKey = normalizeApiKey(clientApiKey);
  if (clientKey) return clientKey;
  return getServerJuheKey();
}

export function resolveJuheModelId(model) {
  if (!model || model === 'auto') return JUHE_DEFAULT_CHAT_MODEL;
  return model;
}
