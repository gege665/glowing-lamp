import { describe, it, expect } from 'vitest';
import {
  CORE_STYLE_META,
  CHAT_SCENES,
  QUICK_STYLE_HINTS,
  OPENING_PROMPTS,
  orderCoreStylesByScene,
  buildSceneStylePromptBlock,
  isValidChatScene,
} from './coreReplyStyles';

describe('coreReplyStyles', () => {
  it('定义 8 种核心风格', () => {
    expect(CORE_STYLE_META).toHaveLength(8);
    expect(CORE_STYLE_META.map((m) => m.label)).toEqual([
      '温柔',
      '幽默',
      '暧昧',
      '直球',
      '理性',
      '高冷',
      '走心',
      '可爱',
    ]);
  });

  it('场景搭配与一键提示', () => {
    expect(CHAT_SCENES.find((s) => s.id === 'first_add')?.openingHint).toBe('暧昧 + 幽默 + 温柔');
    expect(CHAT_SCENES.find((s) => s.id === 'invite')?.styleIds).toEqual(['direct', 'humor']);
    expect(QUICK_STYLE_HINTS).toHaveLength(5);
    expect(OPENING_PROMPTS).toHaveLength(4);
  });

  it('按场景优先排序', () => {
    const ordered = orderCoreStylesByScene('perfunctory');
    expect(ordered.slice(0, 2).map((s) => s.label)).toEqual(['高冷', '幽默']);
  });

  it('生成场景 + 语气提示块', () => {
    const block = buildSceneStylePromptBlock({
      chatScene: 'angry',
      tonePreference: '我要温柔一点，别太油。',
      toneModifiers: ['more_steady'],
    });
    expect(block).toContain('对方生气');
    expect(block).toContain('温柔 + 理性');
    expect(block).toContain('更稳一点');
    expect(block).toContain('我要温柔一点');
  });

  it('校验场景 id', () => {
    expect(isValidChatScene('cold_chat')).toBe(true);
    expect(isValidChatScene('invalid')).toBe(false);
  });
});
