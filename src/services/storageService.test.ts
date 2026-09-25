import { describe, it, expect } from 'vitest';
import { normalizeUserSettings } from '../services/storageService';
import { resolveModelForSettings } from '../constants/modelRouting';

describe('normalizeUserSettings · 手动 GPT', () => {
  it('爱易威手动选 GPT 话术模型不会被重置为豆包', () => {
    const s = normalizeUserSettings({
      provider: 'aiyiwei',
      modelMode: 'manual',
      model: 'manual',
      manualChatModel: 'gpt-5.4-mini',
      manualAnalysisModel: 'mai-ds-r1',
    });
    expect(s.manualChatModel).toBe('gpt-5.4-mini');
    expect(s.manualAnalysisModel).toBe('mai-ds-r1');
    expect(s.modelMode).toBe('manual');
  });

  it('resolveModelForSettings 手动模式返回所选 GPT', () => {
    const s = normalizeUserSettings({
      provider: 'aiyiwei',
      modelMode: 'manual',
      model: 'manual',
      manualChatModel: 'gpt-4o-mini',
      manualAnalysisModel: 'gpt-4o',
    });
    expect(resolveModelForSettings('chat', s)).toBe('gpt-4o-mini');
    expect(resolveModelForSettings('deepAnalysis', s)).toBe('gpt-4o');
  });

  it('OpenRouter 专属模型在爱易威下会被 validIds 重置', () => {
    const s = normalizeUserSettings({
      provider: 'aiyiwei',
      modelMode: 'manual',
      manualChatModel: 'bytedance-seed/seed-2.0-lite',
      manualAnalysisModel: 'deepseek/deepseek-v4-flash:free',
    });
    expect(s.manualChatModel).toBe('doubao-seed-2-0-mini-260428');
    expect(s.manualAnalysisModel).toBe('mai-ds-r1');
  });
});
