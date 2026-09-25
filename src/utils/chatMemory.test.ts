import { describe, it, expect } from 'vitest';
import {
  mergeMemoryLines,
  parseMemoryLines,
  extractMemoryFromMessages,
  buildChatMemoryBlock,
  buildUpdatedPartnerMemory,
} from './chatMemory';
import { DEFAULT_SETTINGS } from '../types';

describe('chatMemory', () => {
  it('parseMemoryLines splits by newline', () => {
    expect(parseMemoryLines('a\nb\n')).toEqual(['a', 'b']);
  });

  it('mergeMemoryLines dedupes', () => {
    const merged = mergeMemoryLines('不爱吃香菜', ['不爱吃香菜', '下周考试']);
    expect(parseMemoryLines(merged)).toEqual(['不爱吃香菜', '下周考试']);
  });

  it('extractMemoryFromMessages picks dislikes', () => {
    const hints = extractMemoryFromMessages(
      [{ id: '1', role: 'other', content: '我不爱吃香菜', timestamp: 1 }],
      DEFAULT_SETTINGS
    );
    expect(hints.some((h) => h.includes('香菜'))).toBe(true);
  });

  it('buildChatMemoryBlock includes stored lines', () => {
    const block = buildChatMemoryBlock(
      {
        ...DEFAULT_SETTINGS,
        partnerMemory: { details: '喜欢猫', updatedAt: 1 },
      },
      []
    );
    expect(block).toContain('聊天记忆');
    expect(block).toContain('喜欢猫');
  });

  it('buildUpdatedPartnerMemory returns null when unchanged', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      partnerMemory: { details: '已有', updatedAt: 1 },
    };
    expect(buildUpdatedPartnerMemory(settings, [])).toBeNull();
  });
});
