import { describe, it, expect } from 'vitest';
import {
  extractInterestKeywords,
  mergeInterestKeywords,
  normalizePartnerTags,
} from './partnerKeywords';
import type { ChatMessage } from '../types';

function other(content: string): ChatMessage {
  return { id: '1', role: 'other', content, timestamp: 1 };
}

describe('partnerKeywords', () => {
  it('提取喜欢/运动/唱歌等强模式', () => {
    const kws = extractInterestKeywords([
      other('我挺喜欢唱歌的'),
      other('周末喜欢运动'),
      other('哈哈'),
    ]);
    expect(kws.some((k) => /唱歌|喜欢唱/.test(k))).toBe(true);
    expect(kws.some((k) => /运动/.test(k))).toBe(true);
    expect(kws).not.toContain('哈哈');
  });

  it('短闲聊不误提取', () => {
    expect(extractInterestKeywords([other('哦'), other('嗯嗯'), other('好的')])).toEqual([]);
  });

  it('合并去重与标签规范化', () => {
    expect(mergeInterestKeywords(['喜欢唱歌'], ['喜欢唱歌', '有猫'])).toEqual([
      '喜欢唱歌',
      '有猫',
    ]);
    expect(normalizePartnerTags(['女1', '女1', ' 女2 ', ''])).toEqual(['女1', '女2']);
  });
});
