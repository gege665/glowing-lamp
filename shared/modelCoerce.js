/**
 * 爱易威模型任务纠偏（与 src/constants/modelRouting.ts 的 coerce* 保持同规则）
 */
import {
  AIYIWEI_CHAT_MODEL,
  AIYIWEI_CHAT_MODEL_ALT,
  AIYIWEI_DEEP_ANALYSIS_MODEL,
  AIYIWEI_DEEP_ANALYSIS_MODEL_ALT,
  JUHE_CHAT_MODEL,
} from './modelRouting.js';
import { stripAiyiweiRoutingSuffix } from './aiyiweiRouting.js';

export const AIYIWEI_CHAT_ONLY_MODELS = new Set([
  AIYIWEI_CHAT_MODEL,
  AIYIWEI_CHAT_MODEL_ALT,
]);

export const AIYIWEI_ANALYSIS_MODELS = new Set([
  AIYIWEI_DEEP_ANALYSIS_MODEL,
  AIYIWEI_DEEP_ANALYSIS_MODEL_ALT,
]);

const LEGACY_JUHE_ON_AIYIWEI = new Set(['doubao-seed-2-0-lite', 'doubao-seed-2-0-mini']);

/**
 * @param {string} provider
 * @param {string} model
 * @param {'chat' | 'deepAnalysis'} task
 * @param {{ defaultChat: string, defaultAnalysis: string, fallbackDefault?: string }} defaults
 */
export function coerceServerModel(provider, model, task = 'chat', defaults) {
  const normalized = !model || model === 'auto' ? '' : stripAiyiweiRoutingSuffix(model);

  if (provider === 'aiyiwei' && normalized && LEGACY_JUHE_ON_AIYIWEI.has(normalized)) {
    return defaults.defaultChat;
  }
  if (
    provider === 'aiyiwei' &&
    task === 'deepAnalysis' &&
    normalized &&
    AIYIWEI_CHAT_ONLY_MODELS.has(normalized)
  ) {
    return defaults.defaultAnalysis;
  }
  // 话术任务禁止误用深度分析模型（与客户端 coerceChatModel 对齐）
  if (
    provider === 'aiyiwei' &&
    task === 'chat' &&
    normalized &&
    AIYIWEI_ANALYSIS_MODELS.has(normalized)
  ) {
    return defaults.defaultChat;
  }
  if (normalized) return normalized;
  if (provider === 'juhe') return JUHE_CHAT_MODEL;
  if (provider === 'aiyiwei') {
    return task === 'deepAnalysis' ? defaults.defaultAnalysis : defaults.defaultChat;
  }
  return defaults.fallbackDefault || defaults.defaultChat;
}
