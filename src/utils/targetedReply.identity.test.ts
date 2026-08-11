import { describe, it, expect } from 'vitest';
import {
  buildMessageSpecificDirective,
  detectMessageIntent,
} from './targetedReply';
import { isValidReplyLine } from './replyQuality';
import { scorePracticalReply } from '../constants/practicalEqExpert';
import { instantRiskScan } from '../constants/riskControl';
import { buildInstantAssist } from './instantAssist';

const HER = '你是谁，请问你有什么事吗？';

describe('核实身份场景 · 与灵焰策略对齐', () => {
  it('识别身份+来意意图', () => {
    const intent = detectMessageIntent(HER);
    expect(intent.asksIdentity).toBe(true);
    expect(intent.asksPurpose).toBe(true);
  });

  it('即使 chatScene=first_add 也不走「不是在查身份」开场指令', () => {
    const dir = buildMessageSpecificDirective(HER, 'first_add');
    expect(dir).not.toContain('不是在查你身份');
    expect(dir).toContain('自报身份');
    expect(dir).toMatch(/什么事|来意/);
  });

  it('质量过滤允许简明自报身份', () => {
    expect(isValidReplyLine('同群加的，刚看到顺手', HER)).toBe(true);
    expect(isValidReplyLine('我是同群的，有事找你', HER)).toBe(true);
  });

  it('评分抬升答身份、打压嗯然后呢', () => {
    const good = scorePracticalReply('同群加的，冒昧了～', '破冰', {
      identityVerify: true,
    });
    const bad = scorePracticalReply('嗯，然后呢？', '破冰', { identityVerify: true });
    expect(good).toBeGreaterThan(bad);
  });

  it('即时风控低风险反制不再给嗯然后呢', () => {
    const r = instantRiskScan(HER);
    expect(r.level).toBe('low');
    expect(r.counterReplies.join('')).not.toContain('嗯，然后呢');
    expect(r.advice).toMatch(/身份|来源|来意/);
  });

  it('即时辅助场景提示先答身份', () => {
    const a = buildInstantAssist(HER, [], { stages: ['初识'] });
    expect(a.sceneLabel).toContain('核实');
    expect(a.sceneTip).toMatch(/身份/);
    expect(a.toneTips.some((t) => t.includes('身份') || t.includes('来意'))).toBe(true);
  });
});
