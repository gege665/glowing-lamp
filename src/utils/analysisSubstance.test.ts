import { describe, expect, it } from 'vitest';
import { isThinAnalysisResult } from './analysisSubstance';
import type { AnalysisResult } from '../types';

function base(partial: Partial<Omit<AnalysisResult, 'replies' | 'topReplies'>>) {
  return {
    summary: '分析完成',
    emotion: { primary: '未知', secondary: '', intensity: 50, trend: '' },
    psychology: {
      emotionalState: '',
      mentalState: '',
      personalityTraits: [],
      subtext: '',
      relationshipStage: '',
      interestLevel: 50,
      chatDesire: '',
      impressionOfMe: '',
      isPerfunctory: '',
    },
    deepReport: '',
    femalePsychology: {
      socialScenario: '',
      coreNeeds: [],
      commStyle: '',
      replyPrinciple: '',
      scenarioTip: '',
    },
    strategy: {
      emotionSwap: '',
      frameAdjust: '',
      communicationStrategy: '',
      warnings: [],
      nextMove: '',
    },
    analyzedAt: Date.now(),
    ...partial,
  };
}

describe('isThinAnalysisResult', () => {
  it('flags empty placeholder analysis', () => {
    expect(isThinAnalysisResult(base({}))).toBe(true);
  });

  it('accepts substantive summary', () => {
    expect(
      isThinAnalysisResult(
        base({
          summary: '她在核实身份，语气偏防备',
          emotion: { primary: '警惕', secondary: '', intensity: 60, trend: '上升' },
        })
      )
    ).toBe(false);
  });
});
