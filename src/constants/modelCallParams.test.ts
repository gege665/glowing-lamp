import { describe, it, expect } from 'vitest';
import {
  estimateAnalysisSystemToneChars,
  estimateChatSystemToneChars,
  MODEL_CALL_PARAMS,
} from './modelCallParams';
import { COMBAT_REPLY_SYSTEM_PROMPT } from './combatReplyStyles';
import { NATURAL_GUY_VOICE_DIRECTIVE } from './naturalGuyVoice';
import { PRACTICAL_EQ_EXPERT_DIRECTIVE } from './practicalEqExpert';
import { UNIQUE_ANALYSIS_COACH_DIRECTIVE } from './uniqueAnalysisMode';
import { LINGYAN_SPEECH_GUARD_DIRECTIVE } from './speechGuardrails';
import {
  COMBINED_FAST_MAX_TOKENS,
  COMPACT_ANALYSIS_SYSTEM_PROMPT,
} from './analysisPrompts';

/** 优化前 chat systemTone 粗体积（堆叠 Natural+Combat+Doubao+Practical+Guard） */
const LEGACY_CHAT_TONE_FLOOR =
  NATURAL_GUY_VOICE_DIRECTIVE.length +
  COMBAT_REPLY_SYSTEM_PROMPT.length +
  PRACTICAL_EQ_EXPERT_DIRECTIVE.length +
  LINGYAN_SPEECH_GUARD_DIRECTIVE.length;

describe('modelCallParams 性能预算', () => {
  it('chat systemTone 显著瘦身（相对旧堆叠至少减半）', () => {
    const now = estimateChatSystemToneChars();
    const savePct = Math.round((1 - now / LEGACY_CHAT_TONE_FLOOR) * 100);
    // eslint-disable-next-line no-console
    console.info(`[PerfCompare] chat systemTone: ${LEGACY_CHAT_TONE_FLOOR} → ${now} chars (−${savePct}%)`);
    expect(now).toBeLessThan(LEGACY_CHAT_TONE_FLOOR * 0.5);
    expect(now).toBeLessThan(900);
    expect(savePct).toBeGreaterThanOrEqual(50);
    expect(MODEL_CALL_PARAMS.chat.systemTone).not.toContain('【核心身份】');
    expect(MODEL_CALL_PARAMS.chat.systemTone).not.toContain(UNIQUE_ANALYSIS_COACH_DIRECTIVE.slice(0, 12));
  });

  it('分析 systemTone 不再重复完整独创教练长文', () => {
    const legacy =
      UNIQUE_ANALYSIS_COACH_DIRECTIVE.length + LINGYAN_SPEECH_GUARD_DIRECTIVE.length + 300;
    const now = estimateAnalysisSystemToneChars();
    const savePct = Math.round((1 - now / legacy) * 100);
    // eslint-disable-next-line no-console
    console.info(`[PerfCompare] analysis systemTone: ~${legacy} → ${now} chars (−${savePct}%)`);
    expect(now).toBeLessThan(UNIQUE_ANALYSIS_COACH_DIRECTIVE.length + LINGYAN_SPEECH_GUARD_DIRECTIVE.length);
    expect(now).toBeLessThan(700);
    expect(MODEL_CALL_PARAMS.deepAnalysis.systemTone).not.toContain('三大功能模块必须齐全');
  });

  it('COMPACT 分析使用简版教练纲，合并 maxTokens 收紧', () => {
    expect(COMPACT_ANALYSIS_SYSTEM_PROMPT).not.toContain('三大功能模块必须齐全');
    expect(COMPACT_ANALYSIS_SYSTEM_PROMPT).toContain('读心→策略→回复方向');
    expect(COMBINED_FAST_MAX_TOKENS).toBeLessThanOrEqual(780);
    // eslint-disable-next-line no-console
    console.info(
      `[PerfCompare] combined maxTokens= ${COMBINED_FAST_MAX_TOKENS}; dual path=parallel; reply repair max=1`
    );
  });
});
