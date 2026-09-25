export const REQUEST_TIMEOUT_MESSAGE = '请求超时，请重试';

function isTimeoutReason(reason: unknown): boolean {
  if (reason instanceof Error) return /超时|timeout/i.test(reason.message);
  if (typeof reason === 'string') return /超时|timeout/i.test(reason);
  return false;
}

export function abortForTimeout(controller: AbortController): void {
  controller.abort(new Error(REQUEST_TIMEOUT_MESSAGE));
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

/** 用户主动取消；超时已映射为普通 Error，不会命中此处 */
export function isUserAbortError(err: unknown): boolean {
  return isAbortError(err);
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (isTimeoutReason(signal.reason)) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error(REQUEST_TIMEOUT_MESSAGE);
  }
  throw new DOMException('Aborted', 'AbortError');
}

/**
 * fetch / 合并信号 abort 后：优先判定用户取消，其次超时，再原样抛出。
 */
export function rethrowAfterAbort(
  err: unknown,
  userSignal?: AbortSignal,
  timeoutSignal?: AbortSignal
): never {
  if (userSignal?.aborted && !isTimeoutReason(userSignal.reason)) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (timeoutSignal?.aborted || isTimeoutReason(timeoutSignal?.reason)) {
    throw new Error(REQUEST_TIMEOUT_MESSAGE);
  }
  if (isAbortError(err) && isTimeoutReason((err as Error).message)) {
    throw new Error(REQUEST_TIMEOUT_MESSAGE);
  }
  throw err;
}

/** 可响应 AbortSignal 的分段 sleep（客户端） */
export async function abortableSleep(ms: number, signal?: AbortSignal, stepMs = 200): Promise<void> {
  throwIfAborted(signal);
  const total = Math.max(0, ms);
  for (let elapsed = 0; elapsed < total; elapsed += stepMs) {
    throwIfAborted(signal);
    await new Promise((resolve) => setTimeout(resolve, Math.min(stepMs, total - elapsed)));
  }
}

/** 合并用户取消与超时信号（转发 abort reason） */
export function combineAbortSignals(signals: (AbortSignal | undefined)[]): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const valid = signals.filter((s): s is AbortSignal => Boolean(s));
  const controller = new AbortController();
  const listeners: Array<{ signal: AbortSignal; fn: () => void }> = [];

  const abortFrom = (source: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(source.reason);
    }
  };

  for (const s of valid) {
    if (s.aborted) {
      abortFrom(s);
      break;
    }
    const fn = () => abortFrom(s);
    s.addEventListener('abort', fn, { once: true });
    listeners.push({ signal: s, fn });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      for (const { signal, fn } of listeners) {
        signal.removeEventListener('abort', fn);
      }
    },
  };
}
