import {
  AUTO_MODEL_ROUTING,
  JUHE_CHAT_MODEL,
  JUHE_DEEP_ANALYSIS_MODEL,
  OPENROUTER_CHAT_MODEL,
  OPENROUTER_DEEP_ANALYSIS_MODEL,
  getModelRoutingSummary,
} from './modelRouting';

export interface ModelOption {
  label: string;
  value: string;
}

/**
 * 历史错误 ID → OpenRouter 当前有效 ID（localStorage 迁移用）
 */
export const OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  'alpha-llm/owl-alpha:free': 'openrouter/owl-alpha',
  'nvidia/nemotron-3-nano-omni:free': 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'poolside/lagoina-xs2:free': 'poolside/laguna-xs.2:free',
  'poolside/lagoina-m1:free': 'poolside/laguna-m.1:free',
  'google/gemma-4-26b-a4b:free': 'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b:free': 'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super:free': 'nvidia/nemotron-3-super-120b-a12b:free',
  'minimax/minimax-m2-5:free': 'minimax/minimax-m2.5:free',
  'liquidai/lfm2-5-1-2b-thinking:free': 'liquid/lfm-2.5-1.2b-thinking:free',
  'liquidai/lfm2-5-1-2b-instruct:free': 'liquid/lfm-2.5-1.2b-instruct:free',
};

/** @deprecated 请使用 AUTO_MODEL_ROUTING */
export const OPENROUTER_AUTO_ROUTING = AUTO_MODEL_ROUTING;

export const OPENROUTER_AUTO_MODEL = 'openrouter/free';

export const OPENROUTER_DEFAULT_FREE_MODEL = OPENROUTER_CHAT_MODEL;

export const OPENROUTER_REPLY_MODEL = JUHE_CHAT_MODEL;

export const OPENROUTER_KNOWN_MODEL_IDS = [
  AUTO_MODEL_ROUTING,
  JUHE_CHAT_MODEL,
  JUHE_DEEP_ANALYSIS_MODEL,
  OPENROUTER_CHAT_MODEL,
  OPENROUTER_DEEP_ANALYSIS_MODEL,
];

const MODEL_USAGE: Record<string, string> = {
  [AUTO_MODEL_ROUTING]: getModelRoutingSummary('juhe'),
};

/** @deprecated 手动选模型已改为任务自动切换 */
export const MODEL_OPTIONS: ModelOption[] = [
  { label: '智能切换（推荐）', value: AUTO_MODEL_ROUTING },
];

/** @deprecated 请使用 MODEL_OPTIONS */
export const OPENROUTER_MODEL_OPTIONS = MODEL_OPTIONS.map((o) => ({
  ...o,
  name: o.label,
  modelId: o.value,
  usage: MODEL_USAGE[o.value],
}));

export const OPENROUTER_FREE_MODEL_IDS = [...OPENROUTER_KNOWN_MODEL_IDS];

export function resolveOpenRouterModelId(value: string | undefined): string {
  if (!value || value === AUTO_MODEL_ROUTING) return OPENROUTER_CHAT_MODEL;

  const mapped = OPENROUTER_MODEL_ALIASES[value] ?? value;

  if (mapped === JUHE_CHAT_MODEL || mapped === JUHE_DEEP_ANALYSIS_MODEL) return mapped;
  if (OPENROUTER_KNOWN_MODEL_IDS.includes(mapped)) {
    return mapped === AUTO_MODEL_ROUTING ? OPENROUTER_CHAT_MODEL : mapped;
  }

  return OPENROUTER_CHAT_MODEL;
}

export function getModelOptionByValue(value: string | undefined): ModelOption | undefined {
  if (!value || value === AUTO_MODEL_ROUTING) return MODEL_OPTIONS[0];
  return MODEL_OPTIONS[0];
}

export function getOpenRouterModelName(_value: string | undefined): string {
  return getModelRoutingSummary('juhe');
}

export function getModelUsage(_value?: string): string | undefined {
  return MODEL_USAGE[AUTO_MODEL_ROUTING];
}

export function formatCallModelExample(
  modelId: string,
  userMessage = '你的提示词...'
): string {
  return `getSoulChatReply("${userMessage}", "all_in_one"); // 或 streamCall("${modelId}", "${userMessage}", console.log)`;
}

export const CALL_MODEL_EXAMPLE_ANALYSIS = formatCallModelExample(
  JUHE_DEEP_ANALYSIS_MODEL,
  '分析这段Soul聊天...'
);

export const CALL_MODEL_EXAMPLE_REPLY = `getSoulChatReplies("她说今天好累，怎么回？", "温柔一点"); // 聚合 API · gpt-5.4-mini → 5 条`;

/** @deprecated */
export const OPENROUTER_ALL_MODELS = OPENROUTER_MODEL_OPTIONS;

/** @deprecated */
export function getOpenRouterModelOption(value: string | undefined) {
  const opt = getModelOptionByValue(value);
  if (!opt) return undefined;
  return { value: opt.value, name: opt.label, modelId: opt.value, usage: MODEL_USAGE[opt.value] };
}
