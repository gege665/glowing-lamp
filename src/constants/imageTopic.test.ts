import { describe, it, expect } from 'vitest';
import { buildLocalImageTopic, normalizeImageTopicResult } from './imageTopic';

describe('imageTopic', () => {
  it('配文识别宠物场景', () => {
    const r = buildLocalImageTopic('我家猫咪今天又在窗台晒太阳');
    expect(r.sceneSummary).toContain('毛');
    expect(r.replies.length).toBeGreaterThan(0);
    expect(r.topics.length).toBeGreaterThan(0);
    expect(r.interests.some((i) => i.includes('宠'))).toBe(true);
  });

  it('配文识别美食', () => {
    const r = buildLocalImageTopic('这家火锅太好吃了');
    expect(r.hotspots.length).toBeGreaterThan(0);
    expect(r.replies[0].length).toBeGreaterThan(4);
  });

  it('空配文给通用开场', () => {
    const r = buildLocalImageTopic('');
    expect(r.replies.length).toBeGreaterThan(0);
  });

  it('normalize 清洗字段', () => {
    const n = normalizeImageTopicResult({
      sceneSummary: '海边日落',
      hotspots: ['风景', ''],
      replies: ['绝了'],
      topics: ['下次去哪'],
      emotion: '放松',
    });
    expect(n.hotspots).toEqual(['风景']);
    expect(n.source).toBe('ai');
  });
});
