import { describe, expect, it } from 'vitest';
import {
  encodePinyinToT9,
  getPinyinCandidates,
  getT9Candidates,
  segmentPinyin,
} from './pinyinIme';

describe('pinyinIme', () => {
  it('returns Chinese candidates for ni', () => {
    const list = getPinyinCandidates('ni');
    expect(list[0]).toBeTruthy();
    expect(list.some((c) => c.includes('你'))).toBe(true);
  });

  it('returns 你好 for nihao', () => {
    const list = getPinyinCandidates('nihao');
    expect(list).toContain('你好');
  });

  it('segments multi-syllable pinyin', () => {
    expect(segmentPinyin('nihao').parts).toEqual(['ni', 'hao']);
  });

  it('encodes pinyin to T9 digits', () => {
    expect(encodePinyinToT9('ni')).toBe('64');
    expect(encodePinyinToT9('nihao')).toBe('64426');
  });

  it('returns Chinese candidates from T9 digits', () => {
    const { candidates, pinyinHints, pinyinOptions } = getT9Candidates('64');
    expect(pinyinHints.some((h) => h === 'ni' || h === 'mi')).toBe(true);
    expect(pinyinOptions.some((o) => o.py === 'ni')).toBe(true);
    expect(candidates.some((c) => c.includes('你'))).toBe(true);
  });

  it('locks pinyin to filter hanzi', () => {
    const { candidates } = getT9Candidates('64', 'ni');
    expect(candidates[0]).toBeTruthy();
    expect(candidates.some((c) => c === '你' || c.includes('你'))).toBe(true);
  });

  it('returns 你好 from T9 nihao digits', () => {
    const { candidates } = getT9Candidates('64426');
    expect(candidates).toContain('你好');
  });
});
