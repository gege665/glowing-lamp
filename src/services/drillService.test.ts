import { describe, it, expect } from 'vitest';
import { parseDrillResponse } from '../services/drillService';
import { DRILL_SCENARIOS } from '../constants/drillScenarios';

describe('drillService.parseDrillResponse', () => {
  it('解析标准 JSON', () => {
    const raw = JSON.stringify({
      herReply: '你怎么突然这么正式',
      herEmotion: '别扭',
      score: 62,
      problems: ['太客套'],
      betterReplies: ['刚才那句我太正式了，重来～'],
      tip: '松一点',
    });
    const parsed = parseDrillResponse(raw);
    expect(parsed.herReply).toBe('你怎么突然这么正式');
    expect(parsed.feedback.score).toBe(62);
    expect(parsed.feedback.problems).toEqual(['太客套']);
    expect(parsed.feedback.betterReplies).toHaveLength(1);
  });

  it('从杂讯中提取 JSON', () => {
    const raw = '好的\n{"herReply":"嗯","herEmotion":"淡","score":40,"problems":[],"betterReplies":["嗨"],"tip":"短"}\n';
    const parsed = parseDrillResponse(raw);
    expect(parsed.herReply).toBe('嗯');
    expect(parsed.feedback.score).toBe(40);
  });
});

describe('drillScenarios', () => {
  it('覆盖 11 个恋爱社交场景', () => {
    expect(DRILL_SCENARIOS).toHaveLength(11);
    expect(DRILL_SCENARIOS.map((s) => s.label)).toEqual([
      '搭讪',
      '初识',
      '暧昧升温',
      '约会邀约',
      '吵架道歉',
      '哄对象',
      '冷战修复',
      '表白',
      '挽回',
      '应对试探',
      '反套路',
    ]);
  });
});
