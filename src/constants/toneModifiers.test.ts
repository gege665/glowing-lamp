import { describe, it, expect } from 'vitest';
import {
  buildToneModifierBlock,
  getReplyLengthCap,
  normalizeToneModifiers,
  toggleToneModifier,
} from './toneModifiers';

describe('toneModifiers', () => {
  it('默认开启更撩/更稳/更短', () => {
    expect(normalizeToneModifiers(undefined)).toEqual(['more_flirt', 'more_steady', 'shorter']);
  });

  it('更短时字数上限 22', () => {
    expect(getReplyLengthCap(['shorter'])).toBe(22);
    expect(getReplyLengthCap([])).toBe(40);
  });

  it('可多选切换', () => {
    let mods = normalizeToneModifiers([]);
    mods = toggleToneModifier(mods, 'more_flirt');
    expect(mods).toEqual(['more_flirt']);
    mods = toggleToneModifier(mods, 'more_flirt');
    expect(mods).toEqual([]);
  });

  it('生成语气块', () => {
    const block = buildToneModifierBlock(['more_flirt', 'shorter']);
    expect(block).toContain('更撩一点');
    expect(block).toContain('更短');
    expect(block).not.toContain('更稳一点');
  });
});
