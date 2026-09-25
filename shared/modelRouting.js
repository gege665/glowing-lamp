/** 爱易威 API */
export const AIYIWEI_CHAT_MODEL = 'doubao-seed-2-0-mini-260428';
export const AIYIWEI_CHAT_MODEL_ALT = 'doubao-seed-2-0-mini-260215';
export const AIYIWEI_DEEP_ANALYSIS_MODEL = 'mai-ds-r1';
export const AIYIWEI_DEEP_ANALYSIS_MODEL_ALT = 'deepseek-v4-flash';

/** 聚合 API（Juhe）· OpenAI 兼容 */
export const JUHE_GPT_CHAT_MODEL = 'gpt-5.4-mini';
export const JUHE_DOUBAO_CHAT_MODEL = 'doubao-seed-2-0-lite';
export const JUHE_CHAT_MODEL = JUHE_GPT_CHAT_MODEL;
export const JUHE_DEEP_ANALYSIS_MODEL = 'deepseek-v4-flash';

/** OpenRouter */
export const OPENROUTER_CHAT_MODEL = 'bytedance-seed/seed-2.0-lite';
export const OPENROUTER_DEEP_ANALYSIS_MODEL = 'deepseek/deepseek-v4-flash:free';

const AIYIWEI_CHAT_FAILOVER = [
  AIYIWEI_CHAT_MODEL,
  AIYIWEI_CHAT_MODEL_ALT,
  AIYIWEI_DEEP_ANALYSIS_MODEL_ALT,
  AIYIWEI_DEEP_ANALYSIS_MODEL,
];

/** 深度分析优先 MAI-DS-R1；负载饱和时降级 DeepSeek → 豆包 */
const AIYIWEI_ANALYSIS_FAILOVER = [
  AIYIWEI_DEEP_ANALYSIS_MODEL_ALT,
  AIYIWEI_DEEP_ANALYSIS_MODEL,
  AIYIWEI_CHAT_MODEL,
  AIYIWEI_CHAT_MODEL_ALT,
];

const JUHE_CHAT_FAILOVER = [JUHE_GPT_CHAT_MODEL, JUHE_DOUBAO_CHAT_MODEL, JUHE_DEEP_ANALYSIS_MODEL];
const JUHE_ANALYSIS_FAILOVER = [JUHE_DEEP_ANALYSIS_MODEL, JUHE_GPT_CHAT_MODEL, JUHE_DOUBAO_CHAT_MODEL];

const OPENROUTER_CHAT_FAILOVER = [
  'openrouter/free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'nvidia/nemotron-nano-9b-v2:free',
  OPENROUTER_CHAT_MODEL,
];

const OPENROUTER_ANALYSIS_FAILOVER = [
  'nvidia/nemotron-nano-9b-v2:free',
  'openrouter/free',
  'liquid/lfm-2.5-1.2b-thinking:free',
  OPENROUTER_DEEP_ANALYSIS_MODEL,
  OPENROUTER_CHAT_MODEL,
];

/** @deprecated 请使用 resolveFailoverCatalog */
export const OPENROUTER_MODEL_CATALOG = OPENROUTER_CHAT_FAILOVER;

const OPENAI_CHAT_FAILOVER = [
  JUHE_GPT_CHAT_MODEL,
  'gpt-4o-mini',
  'gpt-4o',
];

export function resolveFailoverCatalog(model, provider = 'openrouter', task = 'chat') {
  const id = String(model || '');

  if (provider === 'aiyiwei' || provider === 'juhe') {
    if (/^gpt-/i.test(id)) {
      const chain = [id, ...OPENAI_CHAT_FAILOVER.filter((m) => m !== id)];
      if (task === 'deepAnalysis') {
        return [id, ...OPENAI_CHAT_FAILOVER.filter((m) => m !== id), JUHE_DEEP_ANALYSIS_MODEL];
      }
      return chain;
    }
  }

  if (provider === 'aiyiwei') {
    if (task === 'deepAnalysis') {
      return AIYIWEI_ANALYSIS_FAILOVER;
    }
    return AIYIWEI_CHAT_FAILOVER;
  }

  if (provider === 'juhe') {
    if (task === 'deepAnalysis' || id === JUHE_DEEP_ANALYSIS_MODEL || id.includes('deepseek')) {
      return JUHE_ANALYSIS_FAILOVER;
    }
    return JUHE_CHAT_FAILOVER;
  }

  if (task === 'deepAnalysis') {
    return OPENROUTER_ANALYSIS_FAILOVER;
  }
  return OPENROUTER_CHAT_FAILOVER;
}
