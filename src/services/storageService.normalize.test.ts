import { describe, it, expect } from 'vitest';
import { normalizeAnalysis } from './storageService';

describe('normalizeAnalysis', () => {
  it('空值返回 null', () => {
    expect(normalizeAnalysis(null)).toBeNull();
    expect(normalizeAnalysis(undefined)).toBeNull();
  });

  it('残缺档案补齐 replies / psychology / femalePsychology', () => {
    const raw = {
      summary: '测',
      analyzedAt: 1,
    } as any;
    const normalized = normalizeAnalysis(raw);
    expect(normalized).not.toBeNull();
    expect(normalized!.replies).toEqual([]);
    expect(normalized!.psychology.personalityTraits).toEqual([]);
    expect(normalized!.femalePsychology.coreNeeds).toEqual([]);
    expect(normalized!.riskAssessment).toBeUndefined();
  });

  it('风控字段缺数组时补为空数组', () => {
    const normalized = normalizeAnalysis({
      summary: 'x',
      riskAssessment: { level: 'high', motivation: '', advice: '', worthContinuing: '' },
      analyzedAt: 1,
    } as any);
    expect(normalized!.riskAssessment!.signals).toEqual([]);
    expect(normalized!.riskAssessment!.alerts).toEqual([]);
  });
});
