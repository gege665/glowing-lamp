import { describe, expect, it } from 'vitest';
import {
  normalizeIntentLabel,
  normalizeStrategyCards,
  synthesizeStrategyCards,
} from '../constants/strategyCoach';

describe('strategyCoach', () => {
  it('normalizes intent labels', () => {
    expect(normalizeIntentLabel('废物测试')).toBe('废物测试');
    expect(normalizeIntentLabel('这是废物测试吧')).toBe('废物测试');
    expect(normalizeIntentLabel('')).toBe('');
  });

  it('parses strategy cards from model output', () => {
    const cards = normalizeStrategyCards([
      { title: '对策一', approach: '坦诚区分', example: '目前只有你一个' },
      { title: '对策二', approach: '反向试探', content: '你是怕还是希望？' },
    ]);
    expect(cards).toHaveLength(2);
    expect(cards[0].example).toContain('只有你');
    expect(cards[1].example).toContain('怕');
  });

  it('synthesizes cards from strategy fields', () => {
    const cards = synthesizeStrategyCards({
      communicationStrategy: '突出她的特殊性',
      emotionSwap: '反向试探拿回主动权',
      replyExamples: ['句一示例回复内容', '句二示例回复内容'],
    });
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards[0].example).toBeTruthy();
  });
});
