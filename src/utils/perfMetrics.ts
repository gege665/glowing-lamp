/**
 * 算力/性能监控：记录上游调用次数、耗时、缓存命中，用于验证优化效果。
 */

export type PerfEventName =
  | 'analysis_total'
  | 'combined_fast'
  | 'analysis_only'
  | 'reply_batch'
  | 'reply_retry'
  | 'ocr'
  | 'cache_hit'
  | 'cache_miss'
  | 'inflight_dedupe'
  | 'dual_parallel'
  | 'salvage_skip_analysis';

export interface PerfEvent {
  name: PerfEventName;
  durationMs: number;
  ok: boolean;
  meta?: Record<string, string | number | boolean | undefined>;
  at: number;
}

export interface PerfSnapshot {
  events: number;
  byName: Record<
    string,
    { count: number; ok: number; totalMs: number; avgMs: number }
  >;
  upstreamCalls: number;
  cacheHits: number;
  cacheMisses: number;
  inflightDedupes: number;
  salvageSkipAnalysis: number;
  /** 估算相对基线节省的上游调用占比（启发式） */
  estimatedCallSavingRate: number;
}

const MAX_EVENTS = 200;
const events: PerfEvent[] = [];

/** 计为一次上游模型调用的事件 */
const UPSTREAM_EVENTS = new Set<PerfEventName>([
  'combined_fast',
  'analysis_only',
  'reply_batch',
  'reply_retry',
  'ocr',
]);

export function recordPerfEvent(
  name: PerfEventName,
  durationMs: number,
  ok = true,
  meta?: PerfEvent['meta']
): void {
  events.push({
    name,
    durationMs: Math.max(0, Math.round(durationMs)),
    ok,
    meta,
    at: Date.now(),
  });
  while (events.length > MAX_EVENTS) events.shift();

  if (typeof console !== 'undefined' && console.debug) {
    console.debug(
      `[Perf] ${name} ${Math.round(durationMs)}ms ok=${ok}`,
      meta ?? ''
    );
  }
}

export async function measureAsync<T>(
  name: PerfEventName,
  fn: () => Promise<T>,
  meta?: PerfEvent['meta']
): Promise<T> {
  const t0 = performance.now();
  try {
    const result = await fn();
    recordPerfEvent(name, performance.now() - t0, true, meta);
    return result;
  } catch (err) {
    recordPerfEvent(name, performance.now() - t0, false, meta);
    throw err;
  }
}

export function getPerfSnapshot(): PerfSnapshot {
  const byName: PerfSnapshot['byName'] = {};
  let upstreamCalls = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let inflightDedupes = 0;
  let salvageSkipAnalysis = 0;

  for (const e of events) {
    const slot = byName[e.name] ?? { count: 0, ok: 0, totalMs: 0, avgMs: 0 };
    slot.count += 1;
    if (e.ok) slot.ok += 1;
    slot.totalMs += e.durationMs;
    slot.avgMs = Math.round(slot.totalMs / slot.count);
    byName[e.name] = slot;

    if (UPSTREAM_EVENTS.has(e.name) && e.ok) upstreamCalls += 1;
    if (e.name === 'cache_hit') cacheHits += 1;
    if (e.name === 'cache_miss') cacheMisses += 1;
    if (e.name === 'inflight_dedupe') inflightDedupes += 1;
    if (e.name === 'salvage_skip_analysis') salvageSkipAnalysis += 1;
  }

  // 基线粗估：无合并/缓存时，完整流程 ≈ analysis + reply（2）+ 偶发 retry
  // 节省：cache_hit 省 2 次；combined 成功省 1 次；salvage 省 1 次分析；inflight 省 2 次
  const saved =
    cacheHits * 2 +
    inflightDedupes * 2 +
    (byName.combined_fast?.ok ?? 0) * 1 +
    salvageSkipAnalysis * 1;
  const baseline = upstreamCalls + saved;
  const estimatedCallSavingRate =
    baseline > 0 ? Math.min(0.95, saved / baseline) : 0;

  return {
    events: events.length,
    byName,
    upstreamCalls,
    cacheHits,
    cacheMisses,
    inflightDedupes,
    salvageSkipAnalysis,
    estimatedCallSavingRate,
  };
}

export function resetPerfMetrics(): void {
  events.length = 0;
}

/** 开发调试：挂到 window.__LINGYAN_PERF__ */
export function exposePerfToWindow(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __LINGYAN_PERF__?: unknown }).__LINGYAN_PERF__ = {
    snapshot: getPerfSnapshot,
    reset: resetPerfMetrics,
  };
}
