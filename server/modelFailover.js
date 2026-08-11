import { resolveFailoverCatalog } from '../shared/modelRouting.js';
import { isUpstreamBusyMessage } from '../shared/upstreamErrors.js';

/** 单次 OpenRouter 请求超时（毫秒），可通过环境变量覆盖 */
const _reqTimeout = Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS);
export const OPENROUTER_REQUEST_TIMEOUT_MS =
  Number.isFinite(_reqTimeout) && _reqTimeout > 0 ? _reqTimeout : 120_000;

/** 模型自动切换总超时（毫秒），默认 3 分钟 */
const _failoverTotal = Number(process.env.OPENROUTER_FAILOVER_TOTAL_TIMEOUT_MS);
export const OPENROUTER_FAILOVER_TOTAL_TIMEOUT_MS =
  Number.isFinite(_failoverTotal) && _failoverTotal > 0 ? _failoverTotal : 180_000;

/**
 * 构建候选模型列表：用户所选模型优先，其余按配置目录顺序去重追加
 * @param lockModel 手动选模时 true，禁止自动降级到其他模型（如 GPT → 豆包）
 */
export function buildModelCandidates(primaryModel, resolveModelId, catalog, lockModel = false) {
  const resolve = resolveModelId ?? ((id) => id);
  const primary = resolve(primaryModel);
  const failoverCatalog = catalog ?? resolveFailoverCatalog(primary);
  const seen = new Set();
  const candidates = [];

  const add = (id) => {
    const resolved = resolve(id);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    candidates.push(resolved);
  };

  add(primary);
  if (!lockModel) {
    for (const id of failoverCatalog) add(id);
  }
  return { primary, candidates };
}

/**
 * 是否为「可切换模型」类错误（Key 无效等不可恢复错误返回 false）
 */
export function isRetryableModelError(err) {
  if (!err) return true;

  const status = err.status;
  if (status === 401 || status === 403) return false;
  if (status === 400) return false;
  if (status === 499) return false;

  const retryableStatuses = new Set([402, 404, 408, 409, 429, 500, 502, 503, 504, 529]);
  if (status && (retryableStatuses.has(status) || status >= 500)) return true;

  if (err.name === 'AbortError') {
    return err.message?.includes('超时') || err.code === 'TIMEOUT';
  }

  const msg = String(err.message || '');
  if (isUpstreamBusyMessage(msg)) {
    return true;
  }
  if (/返回内容为空|finish_reason|非 JSON|无法读取|fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(msg)) {
    return true;
  }

  if (!status) return true;
  return false;
}

export function isSaturationError(err) {
  const msg = String(err?.message || '');
  return isUpstreamBusyMessage(msg) || err?.status === 429 || err?.status === 503;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function classifyFailureReason(err) {
  if (!err) return 'unknown';
  if (isSaturationError(err)) return 'upstream_saturated';
  if (err.name === 'AbortError' || err.status === 408) return 'timeout';
  if (err.status === 429) return 'rate_limit';
  if (err.status === 402) return 'payment_required';
  if (err.status === 404) return 'model_not_found';
  if (err.status >= 500) return 'server_error';
  const msg = String(err.message || '');
  if (msg.includes('空')) return 'empty_content';
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(msg)) return 'connection_failed';
  if (err.status) return `http_${err.status}`;
  return 'request_failed';
}

/** 结构化日志：模型切换事件 */
export function logModelFailover(event) {
  const record = {
    ts: new Date().toISOString(),
    event: event.type,
    ...event,
  };
  const line = JSON.stringify(record);
  if (event.type === 'model_switch') {
    console.log(`[ModelFailover] 切换 ${event.from} → ${event.to}，原因: ${event.reason} (${event.detail || ''})`);
  } else if (event.type === 'model_attempt') {
    console.log(`[ModelFailover] 尝试模型 ${event.model} (${event.attempt}/${event.total})`);
  } else if (event.type === 'model_success') {
    console.log(`[ModelFailover] 成功 model=${event.model}${event.switched ? ` (已从 ${event.requested} 切换)` : ''}`);
  } else if (event.type === 'model_exhausted') {
    console.error(`[ModelFailover] 全部模型不可用，最后错误: ${event.lastError}`);
  }
  console.log(`[ModelFailover:json] ${line}`);
}
