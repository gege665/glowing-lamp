import { describe, it, expect } from 'vitest';
import {
  resolveReplyStyles,
  pickStylesForGeneration,
  resolveReplyGroupHeaders,
  FLIRT_REPLY_STYLES,
  DAILY_REPLY_STYLES,
  INTIMATE_REPLY_STYLES,
  FLIRT_GROUP_HEADERS,
  DAILY_GROUP_HEADERS,
  INTIMATE_GROUP_HEADERS,
  CORE_EIGHT_GROUP_HEADERS,
  buildBatchStylePromptBlock,
} from './replyStylePrompts';
import { DEFAULT_SETTINGS } from '../types';
import { lineLooksLikeReasoningLeak } from '../utils/replyQuality';
import { normalizeReplyLine } from '../utils/replyParse';
import { extractReplyPreviewLines } from '../utils/streamPreview';
import { isIntimateBoundaryMessage } from './promptTemplates';

describe('resolveReplyStyles', () => {
  it('越界消息 → 越界专项 14 风格', () => {
    expect(isIntimateBoundaryMessage('我想睡你')).toBe(true);
    const styles = resolveReplyStyles(DEFAULT_SETTINGS, '我想睡你 微信');
    expect(styles).toBe(INTIMATE_REPLY_STYLES);
    expect(styles).toHaveLength(14);
    expect(styles[0].label).toBe('俏皮拉扯');
  });

  it('仅初识阶段 → 日常社交 14 风格', () => {
    const settings = { ...DEFAULT_SETTINGS, relationshipStages: ['初识阶段'] };
    const styles = resolveReplyStyles(settings, '你好呀');
    expect(styles).toBe(DAILY_REPLY_STYLES);
    expect(styles[0].label).toBe('礼貌友好');
  });

  it('暧昧/默认 → 暧昧私信 14 风格', () => {
    const styles = resolveReplyStyles(DEFAULT_SETTINGS, '今天好开心');
    expect(styles).toBe(FLIRT_REPLY_STYLES);
    expect(styles[0].label).toBe('温柔撒娇');
  });

  it('升温阶段 → 暧昧私信', () => {
    const settings = { ...DEFAULT_SETTINGS, relationshipStages: ['升温阶段'] };
    expect(resolveReplyStyles(settings, '在干嘛')[0].mode).toBe('flirt');
  });
});

describe('pickStylesForGeneration', () => {
  it('暧昧模式选取 5 条精准话术', () => {
    const picked = pickStylesForGeneration(FLIRT_REPLY_STYLES);
    expect(picked).toHaveLength(5);
    expect(picked.map((s) => s.label)).toEqual(['温柔', '幽默', '暧昧', '直球', '理性']);
  });

  it('场景优先排序核心风格', () => {
    const picked = pickStylesForGeneration(FLIRT_REPLY_STYLES, { chatScene: 'first_add' });
    expect(picked.map((s) => s.label).slice(0, 2)).toEqual(['暧昧', '幽默']);
    expect(picked).toHaveLength(5);
  });

  it('日常模式也输出 5 条核心风格', () => {
    const picked = pickStylesForGeneration(DAILY_REPLY_STYLES);
    expect(picked).toHaveLength(5);
    expect(picked[0].label).toBe('温柔');
  });
});

describe('resolveReplyGroupHeaders', () => {
  it('分组标题与风格模式一致', () => {
    expect(resolveReplyGroupHeaders(FLIRT_REPLY_STYLES)).toEqual(FLIRT_GROUP_HEADERS);
    expect(resolveReplyGroupHeaders(DAILY_REPLY_STYLES)).toEqual(DAILY_GROUP_HEADERS);
    expect(resolveReplyGroupHeaders(INTIMATE_REPLY_STYLES)).toEqual(INTIMATE_GROUP_HEADERS);
    expect(
      resolveReplyGroupHeaders(pickStylesForGeneration(FLIRT_REPLY_STYLES))
    ).toEqual(CORE_EIGHT_GROUP_HEADERS);
  });
});

describe('buildBatchStylePromptBlock', () => {
  it('包含风格标签与精准铁律', () => {
    const block = buildBatchStylePromptBlock(FLIRT_REPLY_STYLES.slice(0, 2));
    expect(block).toContain('【温柔撒娇】');
    expect(block).toContain('精准铁律');
    expect(block).toContain('禁止套话');
    expect(block).not.toContain('回复内容：');
  });

  it('日常模式标注风格名', () => {
    const block = buildBatchStylePromptBlock(DAILY_REPLY_STYLES.slice(0, 1));
    expect(block).toContain('礼貌友好');
    expect(block).not.toContain('场景：日常社交');
  });

  it('越界模式标注风格名', () => {
    const block = buildBatchStylePromptBlock(INTIMATE_REPLY_STYLES.slice(0, 1));
    expect(block).toContain('俏皮拉扯');
    expect(block).not.toContain('回复内容：');
  });
});

describe('replyQuality · 思考泄漏', () => {
  it('拦截思考类词汇与场景泄漏', () => {
    expect(lineLooksLikeReasoningLeak('我觉得这样回比较好')).toBe(true);
    expect(lineLooksLikeReasoningLeak('我觉得还行')).toBe(true);
    expect(lineLooksLikeReasoningLeak('好的，用户的问题是你是谁')).toBe(true);
    expect(lineLooksLikeReasoningLeak('第4条：欲擒故纵。比如：看来我来早了')).toBe(true);
    expect(lineLooksLikeReasoningLeak('晚安呀，早点休息')).toBe(false);
  });
});

describe('extractReplyPreviewLines', () => {
  it('预览标签与 activeStyles 对齐', () => {
    const previews = extractReplyPreviewLines('今晚有空吗\n刚下班好累', 0, FLIRT_REPLY_STYLES);
    expect(previews).toHaveLength(2);
    expect(previews[0].label).toBe('温柔撒娇');
    expect(previews[1].label).toBe('俏皮可爱');
  });

  it('过滤思考泄漏行', () => {
    const previews = extractReplyPreviewLines('我觉得还行\n哈哈你好呀', 0, DAILY_REPLY_STYLES);
    expect(previews).toHaveLength(1);
    expect(previews[0].content).toBe('哈哈你好呀');
  });

  it('从比如句式抢救原话', () => {
    const line = normalizeReplyLine('第4条：欲擒故纵。比如：看来我来早了，那先不打扰你');
    expect(line).toBe('看来我来早了，那先不打扰你');
  });

  it('从例如句式抢救原话', () => {
    const line = normalizeReplyLine(
      '直接大胆，表明来意。例如："我是做摄影的，刷到你视频觉得你很有趣，想认识一下。"'
    );
    expect(line).toBe('我是做摄影的，刷到你视频觉得你很有趣，想认识一下');
  });

  it('从注意每条规则后抢救原话', () => {
    const line = normalizeReplyLine(
      '注意每条都要包含元素。不能太长。我是那个看你视频觉得特有意思的人，来打个招呼。'
    );
    expect(line).toBe('我是那个看你视频觉得特有意思的人，来打个招呼');
  });
});

describe('风格集完整性', () => {
  it('三套风格各 14 条且标签唯一', () => {
    for (const set of [FLIRT_REPLY_STYLES, DAILY_REPLY_STYLES, INTIMATE_REPLY_STYLES]) {
      expect(set).toHaveLength(14);
      const labels = set.map((s) => s.label);
      expect(new Set(labels).size).toBe(14);
    }
  });
});
