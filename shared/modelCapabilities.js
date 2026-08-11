import { normalizeAiyiweiModelId, stripAiyiweiRoutingSuffix } from './aiyiweiRouting.js';

/** 明确支持 response_format: json_object 的模型（爱易威 MAI-DS-R1） */
const JSON_RESPONSE_FORMAT_MODEL_IDS = new Set(['mai-ds-r1', 'MAI-DS-R1']);

/** 明确不支持 response_format 的模型前缀/片段 */
const NO_JSON_RESPONSE_FORMAT_PATTERN =
  /deepseek-v4-flash|deepseek\/deepseek-v4|doubao-seed|doubao-seed\//i;

/**
 * 是否可在请求体中携带 response_format: json_object
 * DeepSeek-V4-Flash、豆包等须靠 prompt 约束 JSON，客户端 parseJsonObject 解析
 */
export function supportsJsonResponseFormat(modelId) {
  const base = normalizeAiyiweiModelId(stripAiyiweiRoutingSuffix(modelId));
  const lower = base.toLowerCase();

  if (JSON_RESPONSE_FORMAT_MODEL_IDS.has(base) || lower === 'mai-ds-r1') {
    return true;
  }
  if (NO_JSON_RESPONSE_FORMAT_PATTERN.test(base)) {
    return false;
  }

  return false;
}

export function shouldUseJsonResponseFormat(modelId, jsonMode) {
  return Boolean(jsonMode && supportsJsonResponseFormat(modelId));
}
