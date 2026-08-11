import { describe, it, expect } from 'vitest';
import {
  extractCombinedReplyText,
  extractRepliesFromModelOutput,
  extractPlainReplyLines,
  parseModelRepliesToSuggestions,
} from './replyCombinedParse';

const STYLES = [
  { category: 'lightFlirt', label: '暧昧' },
  { category: 'lightHumor', label: '幽默' },
  { category: 'warmCare', label: '温柔' },
];

describe('extractCombinedReplyText', () => {
  it('解析字符串', () => {
    expect(extractCombinedReplyText('  有事找你聊  ')).toBe('有事找你聊');
  });

  it('解析对象 content', () => {
    expect(extractCombinedReplyText({ label: '暧昧', content: '嗨，有事跟你说' })).toBe(
      '嗨，有事跟你说'
    );
  });

  it('无效项返回空', () => {
    expect(extractCombinedReplyText(null)).toBe('');
    expect(extractCombinedReplyText({ foo: 1 })).toBe('');
  });
});

describe('extractRepliesFromModelOutput', () => {
  it('解析 replies 对象数组', () => {
    const raw = JSON.stringify({
      replies: [
        { label: '暧昧', content: '嗨，找你有点事' },
        { label: '幽默', content: '被你的消息炸出来了' },
      ],
    });
    expect(extractRepliesFromModelOutput(raw)).toEqual([
      '嗨，找你有点事',
      '被你的消息炸出来了',
    ]);
  });

  it('解析 markdown 包裹的 JSON', () => {
    const raw = '```json\n{"replies":["有事跟你说","刚忙完看到你了"]}\n```';
    expect(extractRepliesFromModelOutput(raw)).toEqual(['有事跟你说', '刚忙完看到你了']);
  });

  it('解析编号纯文本', () => {
    const raw = '1. 有事跟你说\n2. 刚忙完看到你了\n3. 找你聊件事';
    expect(extractPlainReplyLines(raw)).toEqual([
      '有事跟你说',
      '刚忙完看到你了',
      '找你聊件事',
    ]);
  });
});

describe('parseModelRepliesToSuggestions', () => {
  it('JSON 输出映射到风格标签', () => {
    const raw = JSON.stringify({
      replies: [
        { content: '有点事想跟你说' },
        { content: '刚看到，啥事呀' },
        { content: '嗯，找你有件事' },
      ],
    });
    const out = parseModelRepliesToSuggestions(raw, STYLES);
    expect(out[0].label).toBe('暧昧');
    expect(out[0].content).toBe('有点事想跟你说');
    expect(out[1].content).toBe('刚看到，啥事呀');
  });

  it('按 label 字段对齐', () => {
    const raw = JSON.stringify({
      replies: [
        { label: '幽默', content: '被你这条消息炸出来了' },
        { label: '暧昧', content: '嗯，找你说件事' },
      ],
    });
    const out = parseModelRepliesToSuggestions(raw, STYLES);
    expect(out[0].content).toBe('嗯，找你说件事');
    expect(out[1].content).toBe('被你这条消息炸出来了');
  });

  it('宽松模式保留短口语', () => {
    const raw = '我觉得有事跟你说\n刚忙完，你说\n嗯，找你有件事';
    const out = parseModelRepliesToSuggestions(raw, STYLES, 0, { permissive: true });
    expect(out[0].content).toContain('有事');
  });

  it('纯文本按行映射', () => {
    const raw = '有事跟你说\n刚忙完，你说\n嗯，找你有件事';
    const out = parseModelRepliesToSuggestions(raw, STYLES);
    expect(out.filter((r) => r.content).length).toBeGreaterThanOrEqual(2);
  });
});
