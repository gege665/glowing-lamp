import { describe, it, expect } from 'vitest';
import {
  LOVE_MORE_TOOLS,
  LOVE_PRIMARY_TABS,
  isLoveMoreTool,
  resolveLovePrimaryTab,
} from './loveNav';

describe('loveNav 信息架构', () => {
  it('顶栏仅四主入口', () => {
    expect(LOVE_PRIMARY_TABS.map((t) => t.id)).toEqual([
      'partners',
      'analysis',
      'replies',
      'more',
    ]);
  });

  it('次要工具映射到「更多」高亮', () => {
    expect(resolveLovePrimaryTab('partners')).toBe('partners');
    expect(resolveLovePrimaryTab('analysis')).toBe('analysis');
    expect(resolveLovePrimaryTab('replies')).toBe('replies');
    expect(resolveLovePrimaryTab('more')).toBe('more');
    expect(resolveLovePrimaryTab('radar')).toBe('more');
    expect(resolveLovePrimaryTab('drill')).toBe('more');
    expect(resolveLovePrimaryTab('image')).toBe('more');
    expect(isLoveMoreTool('workshop')).toBe(true);
    expect(isLoveMoreTool('analysis')).toBe(false);
  });

  it('演练与识图标记为次要冻结', () => {
    const drill = LOVE_MORE_TOOLS.find((t) => t.id === 'drill');
    const image = LOVE_MORE_TOOLS.find((t) => t.id === 'image');
    expect(drill?.status).toBe('frozen');
    expect(image?.status).toBe('frozen');
  });
});
