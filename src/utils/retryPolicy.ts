/** 客户端唯一重试层：仅超时 / 连接类错误，指数退避，最多重试 3 次 */
export const MAX_CLIENT_TRANSPORT_RETRIES = 3;
export const TRANSPORT_BACKOFF_BASE_MS = 2000;

export function getTransportBackoffMs(attemptIndex: number): number {
  return TRANSPORT_BACKOFF_BASE_MS * 2 ** attemptIndex;
}

export function isRetryableTransportError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return false;
  }
  if (!(err instanceof Error)) return false;

  const msg = err.message;
  const lower = msg.toLowerCase();

  if (/上游繁忙|上游暂时繁忙|分组负载|负载已饱和|no available channel|备用线路/i.test(msg)) {
    return false;
  }
  if (err.name === 'TypeError' && lower.includes('fetch')) return true;
  if (/econnreset|etimedout|enotfound|failed to fetch|network error|socket hang up/i.test(lower)) {
    return true;
  }
  if (/超时|timeout|无法连接|无法读取流式|无法连接 API 服务/.test(msg)) {
    return true;
  }
  if (/请求失败 \((408|502|503|504)\)/.test(msg) && /无法连接|timeout|超时/i.test(msg)) {
    return true;
  }

  return false;
}
