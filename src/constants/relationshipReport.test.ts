import { describe, it, expect } from 'vitest';
import {
  computeChatMetrics,
  buildLocalRelationshipReport,
  parseRelationshipReport,
} from './relationshipReport';
import { DEFAULT_SETTINGS } from '../types';
import type { ChatMessage } from '../types';

const msgs: ChatMessage[] = [
  { id: '1', role: 'other', content: '嗨', timestamp: 1 },
  { id: '2', role: 'me', content: '嗨，今天过得怎么样？', timestamp: 2 },
  { id: '3', role: 'other', content: '还行', timestamp: 3 },
  { id: '4', role: 'me', content: '那挺好，晚上有空聊会儿吗', timestamp: 4 },
  { id: '5', role: 'other', content: '嗯', timestamp: 5 },
  { id: '6', role: 'me', content: '好，那你先忙，有空了找我', timestamp: 6 },
];

describe('relationshipReport', () => {
  it('计算本地聊天指标', () => {
    const m = computeChatMetrics(msgs, {
      ...DEFAULT_SETTINGS,
      temperatureHistory: [
        { at: 1, temperature: 40 },
        { at: 2, temperature: 55 },
      ],
    });
    expect(m.totalMessages).toBe(6);
    expect(m.otherShortRatio).toBeGreaterThan(0);
    expect(m.favorTrend).toBe('上升');
    expect(m.intimacyEstimate).toBeGreaterThan(0);
  });

  it('生成本地完整报告', () => {
    const metrics = computeChatMetrics(msgs, DEFAULT_SETTINGS);
    const report = buildLocalRelationshipReport(metrics);
    expect(report.warmUpStrategy.length).toBeGreaterThan(0);
    expect(report.nextActions.length).toBeGreaterThan(0);
    expect(report.bestTiming.length).toBeGreaterThan(0);
    expect(report.source).toBe('local');
  });

  it('解析 AI JSON 报告', () => {
    const metrics = computeChatMetrics(msgs, DEFAULT_SETTINGS);
    const parsed = parseRelationshipReport(
      JSON.stringify({
        intimacy: 66,
        favorTrend: '平稳 · 波动不大',
        atmosphere: '轻松偏淡',
        shortfalls: ['短回多'],
        communicationIssues: ['你偏长'],
        warmUpStrategy: ['轻话题'],
        improveDirections: ['一句一事'],
        bestTiming: '晚上',
        nextActions: ['接她兴趣'],
        summary: '可继续观察',
      }),
      metrics
    );
    expect(parsed?.intimacy).toBe(66);
    expect(parsed?.source).toBe('ai');
    expect(parsed?.warmUpStrategy).toEqual(['轻话题']);
  });
});
