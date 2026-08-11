export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
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

/** 合并用户取消与超时信号（转发 abort reason，便于区分超时） */
export function combineAbortSignals(signals: (AbortSignal | undefined)[]): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const valid = signals.filter((s): s is AbortSignal => Boolean(s));
  const controller = new AbortController();
  const listeners: Array<{ signal: AbortSignal; fn: () => void }> = [];

  const abort = (reason?: unknown) => {
    if (controller.signal.aborted) return;
    try {
      controller.abort(reason);
    } catch {
      controller.abort();
    }
  };

  for (const s of valid) {
    if (s.aborted) {
      abort(s.reason);
      break;
    }
    const fn = () => abort(s.reason);
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

/** 将 AbortError 区分为用户取消 vs 超时 */
export function rethrowAbortAsUserOrTimeout(
  err: unknown,
  userSignal?: AbortSignal,
  timeoutMessage = '请求超时，请稍后重试'
): never {
  if (err instanceof Error && err.name === 'AbortError') {
    if (userSignal?.aborted) {
      throw err;
    }
    throw new Error(timeoutMessage);
  }
  throw err;
}
