import { describe, it, expect } from 'vitest';
import {
  TtlLruCache,
  hashComputeKey,
  buildAnalysisCacheKey,
} from './computeCache';
import { getPerfSnapshot, recordPerfEvent, resetPerfMetrics } from './perfMetrics';

describe('computeCache', () => {
  it('TTL LRU 命中与淘汰', () => {
    const c = new TtlLruCache<string>(2, 60_000);
    c.set('a', '1');
    c.set('b', '2');
    expect(c.get('a')).toBe('1');
    c.set('c', '3');
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe('3');
    expect(c.stats.hits).toBeGreaterThanOrEqual(1);
  });

  it('相同对话生成稳定缓存键', () => {
    const a = buildAnalysisCacheKey({
      messages: [{ role: 'other', content: '你谁啊' }],
      provider: 'aiyiwei',
      chatScene: 'first_add',
    });
    const b = buildAnalysisCacheKey({
      messages: [{ role: 'other', content: '你谁啊' }],
      provider: 'aiyiwei',
      chatScene: 'first_add',
    });
    expect(a).toBe(b);
    expect(hashComputeKey(['x'])).not.toBe(hashComputeKey(['y']));
  });

  it('不同语气/人设生成不同缓存键', () => {
    const base = {
      messages: [{ role: 'other', content: '在吗' }],
      provider: 'aiyiwei',
      chatStyle: 'push_pull',
      appMode: 'love',
    };
    const rogue = buildAnalysisCacheKey({
      ...base,
      lovePersona: 'rogue',
      tonePreference: '风格：浪子',
    });
    const humor = buildAnalysisCacheKey({
      ...base,
      lovePersona: 'rogue',
      tonePreference: '风格：幽默爆梗',
    });
    const persona = buildAnalysisCacheKey({
      ...base,
      lovePersona: 'tease',
      tonePreference: '风格：浪子',
    });
    expect(rogue).not.toBe(humor);
    expect(rogue).not.toBe(persona);
  });
});

describe('perfMetrics', () => {
  it('统计上游调用与节省率', () => {
    resetPerfMetrics();
    recordPerfEvent('cache_hit', 1, true);
    recordPerfEvent('combined_fast', 800, true);
    recordPerfEvent('reply_batch', 400, true);
    const snap = getPerfSnapshot();
    expect(snap.cacheHits).toBe(1);
    expect(snap.upstreamCalls).toBe(2);
    expect(snap.inflightDedupes).toBe(0);
    expect(snap.estimatedCallSavingRate).toBeGreaterThanOrEqual(0.2);
  });

  it('inflight 去重计入节省率', () => {
    resetPerfMetrics();
    recordPerfEvent('inflight_dedupe', 5, true);
    recordPerfEvent('combined_fast', 600, true);
    const snap = getPerfSnapshot();
    expect(snap.inflightDedupes).toBe(1);
    expect(snap.estimatedCallSavingRate).toBeGreaterThan(0);
  });
});
