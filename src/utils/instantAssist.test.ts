import { describe, it, expect } from 'vitest';
import { buildInstantAssist } from './instantAssist';

describe('buildInstantAssist', () => {
  it('识别生气场景与避雷', () => {
    const r = buildInstantAssist('你滚，别烦我', [], { stages: ['暧昧'] });
    expect(r.sceneId).toBe('angry');
    expect(r.toneTips.some((t) => t.includes('情绪') || t.includes('安抚'))).toBe(true);
    expect(r.riskAlerts.some((a) => a.includes('情绪') || a.includes('辩解'))).toBe(true);
  });

  it('空输入给开场续聊', () => {
    const r = buildInstantAssist('', [], { appMode: 'love', stages: ['初识'] });
    expect(r.continueTopics.length).toBeGreaterThan(0);
    expect(r.sceneLabel.length).toBeGreaterThan(0);
  });

  it('金钱风险提醒', () => {
    const r = buildInstantAssist('你先转我点钱验证一下', [], { stages: ['陌生'] });
    expect(r.riskAlerts.some((a) => a.includes('金钱') || a.includes('风险'))).toBe(true);
  });

  it('你是谁场景走核实身份提示', () => {
    const r = buildInstantAssist('你是谁，请问你有什么事吗？', [], { stages: ['初识'] });
    expect(r.sceneLabel).toContain('核实');
    expect(r.sceneTip).toMatch(/身份/);
  });
});
