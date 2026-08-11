/**
 * 客户端算力缓存：分析结果 LRU + TTL，减少重复上游调用。
 */

export interface ComputeCacheStats {
  hits: number;
  misses: number;
  sets: number;
  size: number;
}

type Entry<T> = { value: T; expiresAt: number };

const DEFAULT_TTL_MS = 90_000;
const DEFAULT_MAX = 24;

export class TtlLruCache<T> {
  private map = new Map<string, Entry<T>>();
  readonly stats: ComputeCacheStats = { hits: 0, misses: 0, sets: 0, size: 0 };

  constructor(
    private maxSize = DEFAULT_MAX,
    private ttlMs = DEFAULT_TTL_MS
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) {
      this.stats.misses += 1;
      return undefined;
    }
    if (Date.now() > hit.expiresAt) {
      this.map.delete(key);
      this.stats.misses += 1;
      this.stats.size = this.map.size;
      return undefined;
    }
    // LRU: re-insert
    this.map.delete(key);
    this.map.set(key, hit);
    this.stats.hits += 1;
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    this.stats.sets += 1;
    this.stats.size = this.map.size;
  }

  clear(): void {
    this.map.clear();
    this.stats.size = 0;
  }
}

/** 轻量稳定哈希（非加密，仅作缓存键） */
export function hashComputeKey(parts: unknown[]): string {
  const raw = JSON.stringify(parts);
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function buildAnalysisCacheKey(input: {
  messages: { role: string; content: string }[];
  targetMessage?: string;
  provider: string;
  chatScene?: string;
  primaryReplyStyle?: string;
  relationshipStages?: string[];
  chatStyle?: string;
  appMode?: string;
  modelMode?: string;
  manualChatModel?: string;
  manualAnalysisModel?: string;
  /** 输入法/语气指令，避免同 chatStyle 不同风格撞缓存 */
  tonePreference?: string;
  lovePersona?: string;
}): string {
  const msgDigest = input.messages
    .filter((m) => m.content?.trim())
    .slice(-12)
    .map((m) => {
      const c = m.content.trim();
      // 全文指纹：避免仅取前 80 字导致长消息后半段差异撞缓存
      return `${m.role}:${c.length}:${hashComputeKey([c])}`;
    });
  const tone = input.tonePreference?.trim() ?? '';
  return hashComputeKey([
    'analysis-v3',
    input.provider,
    input.modelMode ?? '',
    input.manualChatModel ?? '',
    input.manualAnalysisModel ?? '',
    input.chatScene ?? '',
    input.primaryReplyStyle ?? '',
    input.relationshipStages ?? [],
    input.chatStyle ?? '',
    input.appMode ?? '',
    input.lovePersona ?? '',
    tone ? `${tone.length}:${hashComputeKey([tone])}` : '',
    input.targetMessage?.trim()
      ? `${input.targetMessage.trim().length}:${hashComputeKey([input.targetMessage.trim()])}`
      : '',
    msgDigest,
  ]);
}

export const analysisResultCache = new TtlLruCache<unknown>(24, 90_000);
export const healthCheckCache = new TtlLruCache<{
  ok: boolean;
  serverKeyConfigured: boolean;
  openRouterFallback?: boolean;
}>(1, 30_000);
