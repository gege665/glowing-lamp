/**
 * 爱易威路由控制（与 OpenRouter 兼容）
 * @see https://aiyiwei.vip 模型文档
 *
 * 后缀 :floor → 价格最低 | :nitro → 速度最快 | :stable → 成功率最高
 * 等价于 provider.sort: price | speed | success_rate
 */

export const AIYIWEI_ROUTING_SUFFIXES = {
  floor: ':floor',
  nitro: ':nitro',
  stable: ':stable',
};

export const AIYIWEI_PROVIDER_SORT = {
  floor: 'price',
  nitro: 'speed',
  stable: 'success_rate',
};

const SUFFIX_PATTERN = /:(floor|nitro|stable)$/i;

/** 爱易威控制台模型 ID 规范（内部 mai-ds-r1 → 官方 MAI-DS-R1） */
const AIYIWEI_MODEL_CANONICAL = {
  'mai-ds-r1': 'MAI-DS-R1',
};

/** 剥离模型名路由后缀，得到上游干净 ID */
export function stripAiyiweiRoutingSuffix(modelId) {
  return String(modelId || '').replace(SUFFIX_PATTERN, '');
}

/** 转为爱易威 API 认可的 model 字段（不含路由后缀） */
export function normalizeAiyiweiModelId(modelId) {
  const base = stripAiyiweiRoutingSuffix(modelId);
  const canonical = AIYIWEI_MODEL_CANONICAL[base.toLowerCase()];
  return canonical ?? base;
}

function resolveRoutingSuffixFromEnv(envKey, fallback = '') {
  const raw = String(process.env[envKey] || '').trim().toLowerCase();
  if (!raw || raw === 'none' || raw === 'off') return '';
  if (raw in AIYIWEI_ROUTING_SUFFIXES) return AIYIWEI_ROUTING_SUFFIXES[raw];
  if (raw.startsWith(':') && SUFFIX_PATTERN.test(raw)) return raw;
  return fallback;
}

/** 话术任务默认 :stable，降低分组饱和失败率 */
export function getAiyiweiChatRoutingSuffix() {
  return resolveRoutingSuffixFromEnv('AIYIWEI_CHAT_ROUTING_SUFFIX', AIYIWEI_ROUTING_SUFFIXES.stable);
}

/** 深度分析默认 :stable；设 AIYIWEI_ANALYSIS_ROUTING_SUFFIX=none 可关闭 */
export function getAiyiweiAnalysisRoutingSuffix() {
  return resolveRoutingSuffixFromEnv('AIYIWEI_ANALYSIS_ROUTING_SUFFIX', AIYIWEI_ROUTING_SUFFIXES.stable);
}

/**
 * 为发往爱易威的 model 字段追加路由后缀
 * @param {string | undefined} routingSuffixOverride 显式后缀（'' 表示不加）；undefined 则用 env 默认
 */
export function applyAiyiweiRouting(modelId, task = 'chat', routingSuffixOverride) {
  const base = normalizeAiyiweiModelId(stripAiyiweiRoutingSuffix(modelId));
  if (!base) return base;
  let suffix;
  if (routingSuffixOverride !== undefined) {
    suffix = routingSuffixOverride;
  } else {
    suffix =
      task === 'deepAnalysis' ? getAiyiweiAnalysisRoutingSuffix() : getAiyiweiChatRoutingSuffix();
  }
  return suffix ? `${base}${suffix}` : base;
}

/** 饱和时按顺序尝试的全部路由后缀 */
export function getAiyiweiRoutingSuffixAttempts(task = 'chat') {
  const primary =
    task === 'deepAnalysis' ? getAiyiweiAnalysisRoutingSuffix() : getAiyiweiChatRoutingSuffix();
  const seen = new Set();
  const attempts = [];
  for (const suffix of [
    primary,
    AIYIWEI_ROUTING_SUFFIXES.nitro,
    AIYIWEI_ROUTING_SUFFIXES.floor,
    '',
  ]) {
    const key = suffix || '__none__';
    if (seen.has(key)) continue;
    seen.add(key);
    attempts.push(suffix);
  }
  return attempts;
}

/** provider.sort 备选（后缀都失败时再试） */
export function getAiyiweiProviderSortAttempts() {
  return ['success_rate', 'speed', 'price'];
}

/** provider.sort 写法（与后缀等价，后缀优先级更高） */
export function buildAiyiweiProviderSort(sortKey = 'success_rate') {
  return { sort: sortKey };
}
