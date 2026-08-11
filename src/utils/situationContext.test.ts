import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import {
  inferChatScene,
  shouldUseOpeningGuide,
  resolveSituationSettings,
  describeSituation,
  buildRecentChatSnippet,
} from './situationContext';

const msg = (role: 'me' | 'other', content: string): ChatMessage => ({
  id: String(Math.random()),
  role,
  content,
  timestamp: Date.now(),
});

describe('situationContext', () => {
  it('无对方消息 → 刚加好友', () => {
    expect(inferChatScene([], '')).toBe('first_add');
  });

  it('通过了 → 刚加好友', () => {
    expect(inferChatScene([msg('other', '通过了')], '通过了')).toBe('first_add');
  });

  it('你谁 → 刚加好友', () => {
    expect(inferChatScene([msg('other', '你谁？')], '你谁？')).toBe('first_add');
  });

  it('敷衍嗯 → 对方敷衍', () => {
    expect(inferChatScene([msg('other', '嗯')], '嗯')).toBe('perfunctory');
  });

  it('有质问时不走开场指南', () => {
    expect(shouldUseOpeningGuide('你谁？', 'first_add')).toBe(false);
    expect(shouldUseOpeningGuide('通过了', 'first_add')).toBe(true);
  });

  it('自动推断场景写入 effective settings', () => {
    const effective = resolveSituationSettings(
      { ...DEFAULT_SETTINGS, chatScene: '' },
      [msg('other', '嗯')]
    );
    expect(effective.chatScene).toBe('perfunctory');
  });

  it('手动场景优先', () => {
    const effective = resolveSituationSettings(
      { ...DEFAULT_SETTINGS, chatScene: 'angry' },
      [msg('other', '嗯')]
    );
    expect(effective.chatScene).toBe('angry');
  });

  it('近期对话摘要', () => {
    const snippet = buildRecentChatSnippet(
      [msg('me', '嗨'), msg('other', '你好呀')],
      DEFAULT_SETTINGS
    );
    expect(snippet).toContain('我：嗨');
    expect(snippet).toContain('对方：你好呀');
  });

  it('情况描述', () => {
    expect(describeSituation(DEFAULT_SETTINGS, [], '')).toContain('开场');
    expect(describeSituation(DEFAULT_SETTINGS, [msg('other', '你谁？')], '')).toContain('你是谁');
  });
});
