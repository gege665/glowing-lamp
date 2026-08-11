import { describe, it, expect } from 'vitest';
import { getChatModelOptions, getAnalysisModelOptions, formatManualDualModelProgress, shouldUseCombinedFastPath } from './modelRouting';
import { isOpenAiModelId } from './openaiModels';

describe('openaiModels in routing', () => {
  it('爱易威话术下拉含 GPT 模型', () => {
    const chat = getChatModelOptions('aiyiwei');
    expect(chat.some((m) => m.value === 'gpt-5.4-mini')).toBe(true);
    expect(chat.some((m) => m.value === 'gpt-4o-mini')).toBe(true);
    expect(chat.some((m) => m.value === 'doubao-seed-2-0-mini-260428')).toBe(true);
  });

  it('聚合 API 话术下拉含 GPT 模型', () => {
    const chat = getChatModelOptions('juhe');
    expect(chat.filter((m) => isOpenAiModelId(m.value)).length).toBeGreaterThanOrEqual(3);
  });

  it('深度分析也可选 GPT', () => {
    const analysis = getAnalysisModelOptions('aiyiwei');
    expect(analysis.some((m) => m.value === 'gpt-4o')).toBe(true);
  });

  it('手动双模型进度文案区分分析与话术', () => {
    const hint = formatManualDualModelProgress(
      {
        provider: 'aiyiwei',
        modelMode: 'manual',
        model: 'manual',
        manualChatModel: 'gpt-5.4-mini',
        manualAnalysisModel: 'deepseek-v4-flash',
      } as never,
      'analysis'
    );
    expect(hint).toContain('心理分析');
    expect(hint).toContain('话术');
    expect(hint).toContain('GPT');
  });

  it('同模型可走合并加速路径', () => {
    const base = {
      provider: 'aiyiwei' as const,
      modelMode: 'manual' as const,
      model: 'manual',
    };
    expect(
      shouldUseCombinedFastPath(
        { ...base, manualChatModel: 'doubao-seed-2-0-mini-260428', manualAnalysisModel: 'doubao-seed-2-0-mini-260428' } as never,
        'doubao-seed-2-0-mini-260428',
        'doubao-seed-2-0-mini-260428'
      )
    ).toBe(true);
    expect(
      shouldUseCombinedFastPath(
        { ...base, manualChatModel: 'gpt-5.4-mini', manualAnalysisModel: 'deepseek-v4-flash' } as never,
        'deepseek-v4-flash',
        'gpt-5.4-mini'
      )
    ).toBe(false);
    expect(
      shouldUseCombinedFastPath(
        {
          provider: 'juhe' as const,
          modelMode: 'auto' as const,
          model: 'auto',
          manualChatModel: 'gpt-5.4-mini',
          manualAnalysisModel: 'deepseek-v4-flash',
        } as never,
        'deepseek-v4-flash',
        'gpt-5.4-mini'
      )
    ).toBe(true);
  });
});
