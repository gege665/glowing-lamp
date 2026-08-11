import { describe, it, expect } from 'vitest';
import { instantRiskScan, RISK_CONTROL_TAGS, normalizeRiskAssessment } from './riskControl';

describe('riskControl', () => {
  it('定义 8 类风控标签', () => {
    expect([...RISK_CONTROL_TAGS]).toEqual([
      '钓鱼',
      '套路',
      '索取',
      '试探',
      '敷衍',
      '养鱼',
      '情感博弈',
      '诈骗',
    ]);
  });

  it('识别诈骗/金钱高风险', () => {
    const r = instantRiskScan('你先转我 500 保证金，我帮你解冻');
    expect(r.level).toBe('high');
    expect(r.tags).toContain('诈骗');
    expect(r.counterReplies.length).toBeGreaterThan(0);
  });

  it('识别钓鱼试探', () => {
    const r = instantRiskScan('你是不是对谁都这样？随便你吧');
    expect(r.tags.some((t) => t === '钓鱼' || t === '试探')).toBe(true);
    expect(['medium', 'high']).toContain(r.level);
  });

  it('无风险时 low', () => {
    const r = instantRiskScan('今天天气不错，你下班了吗');
    expect(r.level).toBe('low');
  });

  it('你是谁低风险不给空接反制', () => {
    const r = instantRiskScan('你是谁，请问你有什么事吗？');
    expect(r.level).toBe('low');
    expect(r.counterReplies.join('')).not.toContain('嗯，然后呢');
  });

  it('normalizeRiskAssessment 补齐扩展字段', () => {
    const n = normalizeRiskAssessment({
      level: 'high',
      signals: ['要验证码'],
      motivation: '骗钱',
      advice: '别转',
      worthContinuing: '停止',
      tags: ['诈骗'],
      counterReplies: ['不转账'],
    });
    expect(n?.tags).toEqual(['诈骗']);
    expect(n?.counterReplies).toEqual(['不转账']);
  });
});
