import { describe, it, expect } from 'vitest';
import {
  WORKSHOP_CATEGORIES,
  matchWorkshopCategory,
  pickWorkshopBank,
  getWorkshopCategory,
} from './workshopCategories';

describe('workshopCategories', () => {
  it('覆盖 12 大分类', () => {
    expect(WORKSHOP_CATEGORIES).toHaveLength(12);
    expect(WORKSHOP_CATEGORIES.map((c) => c.label)).toEqual([
      '开场破冰',
      '日常续聊',
      '暧昧拉扯',
      '升温推拉',
      '约会邀约',
      '真诚表白',
      '道歉哄人',
      '冷战修复',
      '挽回复合',
      '接梗互动',
      '高价值展示',
      '礼貌反怼',
    ]);
  });

  it('每类本地库至少 5 条', () => {
    for (const c of WORKSHOP_CATEGORIES) {
      expect(c.bank.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('场景口述匹配分类', () => {
    expect(matchWorkshopCategory('刚加好友开场破冰')).toBe('ice_open');
    expect(matchWorkshopCategory('想约她周末见面喝咖啡')).toBe('date_invite');
    expect(matchWorkshopCategory('冷战好几天想修复')).toBe('cold_fix');
    expect(matchWorkshopCategory('她生气了要道歉哄人')).toBe('apology');
  });

  it('本地库可取 5 条', () => {
    const lines = pickWorkshopBank('flirt_pull', 5);
    expect(lines).toHaveLength(5);
    expect(getWorkshopCategory('flirt_pull').label).toBe('暧昧拉扯');
  });
});
