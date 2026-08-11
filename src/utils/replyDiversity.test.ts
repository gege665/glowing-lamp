import { describe, it, expect } from 'vitest';
import {
  areRepliesNearDuplicate,
  diversifyReplySuggestions,
  countDistinctReplies,
  normalizeReplySkeleton,
  OPENING_DIVERSE_FALLBACKS,
  GENERAL_DIVERSE_FALLBACKS,
  resolveDiverseFallbacks,
  padRepliesToMinimum,
  MIN_DISPLAY_REPLIES,
  arrangeMultiPlanWithRecommendation,
} from './replyDiversity';

const OPENING_FALLBACK_RE = /可算加上了|头像看着挺舒服|通过了有空再说|头像挺有意思|有点小紧张|慢慢眼熟/;

describe('replyDiversity', () => {
  it('识别换皮同句，且不误杀邀约扩展句', () => {
    expect(
      areRepliesNearDuplicate('哦，我是昨晚加你的那位呀', '哈哈，被你发现啦，我是昨晚加的')
    ).toBe(true);
    expect(
      areRepliesNearDuplicate('嗯，我是昨晚加你的，想先打个招呼', '我昨晚加的你，先打个招呼')
    ).toBe(true);
    expect(areRepliesNearDuplicate('哈哈可算加上了', '嗯头像看着挺舒服')).toBe(false);
    expect(areRepliesNearDuplicate('晚上有空吗', '晚上有空吗出来吃')).toBe(false);
  });

  it('normalize 去掉语气词后更易撞车', () => {
    expect(normalizeReplySkeleton('哈哈可算加上了')).toBe(normalizeReplySkeleton('哦可算加上了'));
  });

  it('开场兜底可拉开差异；非开场用通用兜底且不开场白', () => {
    const similar = [
      { label: '痞帅', content: '哦，我是昨晚加你的那位呀' },
      { label: '暧昧', content: '哈哈，被你发现啦，我是昨晚加的' },
      { label: '自然', content: '嗯，我是昨晚加你的，想先打个招呼' },
      { label: '高冷', content: '我昨晚加的你，先打个招呼' },
    ];
    const opened = diversifyReplySuggestions(similar, OPENING_DIVERSE_FALLBACKS);
    expect(countDistinctReplies(opened)).toBeGreaterThanOrEqual(3);

    const general = diversifyReplySuggestions(similar, GENERAL_DIVERSE_FALLBACKS);
    expect(general.some((r) => OPENING_FALLBACK_RE.test(r.content))).toBe(false);
    expect(countDistinctReplies(general)).toBeGreaterThanOrEqual(3);
  });

  it('集成：非 opening + 近重复 → 不得出现开场兜底句，且至少 3 条', () => {
    expect(Object.keys(resolveDiverseFallbacks(false)).length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(resolveDiverseFallbacks(true)).length).toBeGreaterThan(0);

    const inviteNearDups = [
      { label: '痞帅', content: '晚上有空吗出来吃' },
      { label: '自然', content: '晚上有空吗，出来吃呀' },
      { label: '高冷', content: '晚上有空就出来吃' },
      { label: '暧昧', content: '晚上有空吗出来搓一顿' },
    ];

    const after = padRepliesToMinimum(
      diversifyReplySuggestions(inviteNearDups, resolveDiverseFallbacks(false)),
      MIN_DISPLAY_REPLIES,
      resolveDiverseFallbacks(false)
    );

    expect(after.every((r) => !OPENING_FALLBACK_RE.test(r.content))).toBe(true);
    expect(countDistinctReplies(after)).toBeGreaterThanOrEqual(3);
    expect(after.filter((r) => /晚上|出来/.test(r.content)).length).toBeGreaterThanOrEqual(1);
  });

  it('仅 1 条有效时 pad 到至少 3 条', () => {
    const one = [
      { label: '自然', content: '抖音那边看到你，顺手加下呀' },
      { label: '暧昧', content: '' },
      { label: '高冷', content: '' },
      { label: '痞帅', content: '' },
    ];
    const padded = padRepliesToMinimum(one, 3, GENERAL_DIVERSE_FALLBACKS);
    expect(countDistinctReplies(padded)).toBeGreaterThanOrEqual(MIN_DISPLAY_REPLIES);
    expect(padded.filter((r) => r.content.trim().length >= 2).length).toBeGreaterThanOrEqual(3);
  });

  it('智能推荐取自上面 3 条中的优选', () => {
    const arranged = arrangeMultiPlanWithRecommendation(
      [
        { label: '痞帅', content: '抖音上看到你，感觉挺合眼缘的' },
        { label: '高冷', content: '抖音来的，你发的那个视频很对我胃口' },
        { label: '暧昧', content: '这么说我倒好奇了' },
        { label: '自然', content: '行，那你怎么看' },
      ],
      (c) => {
        if (/合眼缘|胃口|视频/.test(c)) return 50;
        if (/好奇了|怎么看/.test(c)) return 5;
        return 10;
      }
    );
    expect(arranged).toHaveLength(4);
    expect(arranged[3].label).toMatch(/^推荐/);
    expect(arranged[3].content).toMatch(/合眼缘|胃口|视频/);
    expect(arranged.slice(0, 3).every((r) => !String(r.label).startsWith('推荐'))).toBe(true);
  });
});
