/** 若已取消则立即抛出 499 */
export function throwIfAborted(shouldAbort) {
  if (shouldAbort?.()) {
    const err = new Error('客户端已断开');
    err.status = 499;
    throw err;
  }
}

/** 可响应 shouldAbort 的分段 sleep（服务端 SSE） */
export async function abortableSleep(ms, shouldAbort, stepMs = 200) {
  throwIfAborted(shouldAbort);
  const total = Math.max(0, ms);
  for (let elapsed = 0; elapsed < total; elapsed += stepMs) {
    throwIfAborted(shouldAbort);
    await new Promise((resolve) => setTimeout(resolve, Math.min(stepMs, total - elapsed)));
  }
}
