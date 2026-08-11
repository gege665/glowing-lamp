import { describe, it, expect } from 'vitest';
import {
  CORE_STYLE_META,
  CHAT_SCENES,
  QUICK_STYLE_HINTS,
  OPENING_PROMPTS,
  orderCoreStylesByScene,
  buildSceneStylePromptBlock,
  buildPrimaryStyleVariants,
  isValidChatScene,
  resolvePrimaryReplyStyle,
} from './coreReplyStyles';
import { COMBAT_REPLY_SYSTEM_PROMPT, COMBAT_REPLY_DEMO_LINES } from './combatReplyStyles';

describe('coreReplyStyles', () => {
  it('定义六种实战风格', () => {
    expect(CORE_STYLE_META).toHaveLength(6);
    expect(CORE_STYLE_META.map((m) => m.label)).toEqual([
      '自然',
      '暧昧',
      '高冷',
      '奶狗',
      '爹系',
      '痞帅',
    ]);
  });

  it('旧风格 id 可迁移', () => {
    expect(resolvePrimaryReplyStyle('flirt')).toBe('ambiguous');
    expect(resolvePrimaryReplyStyle('heartfelt')).toBe('natural');
    expect(resolvePrimaryReplyStyle('hook')).toBe('rogue');
    expect(resolvePrimaryReplyStyle('humor')).toBe('rogue');
    expect(resolvePrimaryReplyStyle('gentle')).toBe('natural');
    expect(resolvePrimaryReplyStyle('playful')).toBe('ambiguous');
    expect(resolvePrimaryReplyStyle('cool')).toBe('cool');
  });

  it('场景搭配与一键提示', () => {
    expect(CHAT_SCENES.find((s) => s.id === 'first_add')?.openingHint).toBe(
      '自然 + 痞帅 + 高冷'
    );
    expect(CHAT_SCENES.find((s) => s.id === 'invite')?.styleIds).toEqual([
      'rogue',
      'cool',
      'natural',
    ]);
    expect(QUICK_STYLE_HINTS).toHaveLength(6);
    expect(OPENING_PROMPTS).toHaveLength(4);
  });

  it('按场景优先排序', () => {
    const ordered = orderCoreStylesByScene('perfunctory');
    expect(ordered.slice(0, 2).map((s) => s.label)).toEqual(['高冷', '痞帅']);
  });

  it('主风格锁定生成同人设变体', () => {
    const variants = buildPrimaryStyleVariants('ambiguous');
    expect(variants).toHaveLength(4);
    expect(variants.every((v) => v.label === '暧昧')).toBe(true);
    expect(new Set(variants.map((v) => v.brief)).size).toBe(4);
  });

  it('生成场景 + 主风格 + 语气提示块', () => {
    const block = buildSceneStylePromptBlock({
      chatScene: 'angry',
      tonePreference: '我要自然一点，别太油。',
      toneModifiers: ['more_steady'],
      primaryReplyStyle: 'natural',
    });
    expect(block).toContain('零AI腔');
    expect(block).toContain('你就是我本人');
    expect(block).toContain('自然');
    expect(block).toContain('更稳一点');
    expect(block).toContain('我要自然一点');
  });

  it('校验场景 id', () => {
    expect(isValidChatScene('cold_chat')).toBe(true);
    expect(isValidChatScene('invalid')).toBe(false);
  });
});

describe('combatReplyStyles', () => {
  it('实战 system 含六风格与硬禁', () => {
    expect(COMBAT_REPLY_SYSTEM_PROMPT).toContain('【自然】');
    expect(COMBAT_REPLY_SYSTEM_PROMPT).toContain('【痞帅】');
    expect(COMBAT_REPLY_SYSTEM_PROMPT).toContain('自报家门');
    expect(COMBAT_REPLY_SYSTEM_PROMPT).not.toContain('刚通过好友申请');
  });

  it('演示范例无刚加好友腔', () => {
    const lines = Object.values(COMBAT_REPLY_DEMO_LINES['你是？'] ?? {});
    expect(lines.every((l) => !/刚通过|刚加你的那位|宝宝/.test(l))).toBe(true);
  });
});
