import { describe, it, expect } from 'vitest';
import { buildAnalysisInsightBlock, buildSourceContextHint } from './analysisReplyBridge';
import type { AnalysisResult, ChatMessage } from '../types';

const stubAnalysis: Omit<AnalysisResult, 'replies' | 'topReplies'> = {
  summary: '她在核实你是谁',
  emotion: { primary: '警惕', secondary: '', intensity: 40, trend: '' },
  psychology: {
    emotionalState: '',
    mentalState: '需要确认身份',
    personalityTraits: ['边界感强'],
    subtext: '先说明身份',
    relationshipStage: '初识',
    interestLevel: 20,
    chatDesire: '先核实身份',
    impressionOfMe: '偏可疑',
    isPerfunctory: '否',
  },
  deepReport: '',
  femalePsychology: {
    socialScenario: '微信私聊陌生人核验',
    coreNeeds: ['确认安全感', '明确来源'],
    commStyle: '先问后聊',
    replyPrinciple: '先自报身份+来源',
    scenarioTip: '说明身份+怎么加到的',
    shitTestNote: '边界核验，偏安全试探',
  },
  strategy: {
    coreStrategy: '先稳再近：简明清身份与来源',
    whyStrategy: '她要可控感；先答清戒备才降',
    emotionSwap: '',
    frameAdjust: '',
    communicationStrategy: '',
    warnings: ['别糊弄'],
    nextMove: '简明自报',
  },
  analyzedAt: Date.now(),
};

describe('analysisReplyBridge', () => {
  it('buildAnalysisInsightBlock 包含分析关键字段', () => {
    const block = buildAnalysisInsightBlock(stubAnalysis);
    expect(block).toContain('她在核实你是谁');
    expect(block).toContain('说明身份+怎么加到的');
    expect(block).toContain('先自报身份+来源');
    expect(block).toContain('别糊弄');
    expect(block).toContain('先稳再近');
    expect(block).toContain('为什么这么做');
    expect(block).toContain('边界核验');
  });

  it('buildSourceContextHint 无线索时禁止 XX', () => {
    const hint = buildSourceContextHint([], {
      myProfile: {},
      otherProfile: {},
      partnerMemory: {},
    } as never);
    expect(hint).toContain('禁止用 XX');
  });

  it('buildSourceContextHint 提取资料卡线索', () => {
    const hint = buildSourceContextHint([], {
      myProfile: { experiences: 'XX群里认识的' },
      otherProfile: {},
      partnerMemory: {},
    } as never);
    expect(hint).toContain('XX群里认识的');
  });

  it('buildSourceContextHint 提取我方已发消息', () => {
    const msgs: ChatMessage[] = [
      { role: 'me', content: '我是小明，同群加你的', id: '1', timestamp: 1 },
    ];
    const hint = buildSourceContextHint(msgs, {
      myProfile: {},
      otherProfile: {},
      partnerMemory: {},
    } as never);
    expect(hint).toContain('同群加你的');
  });
});
