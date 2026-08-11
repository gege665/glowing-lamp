import { describe, expect, it } from 'vitest';
import { IME_REPLY_STYLES, getImeReplyStyle } from './imeReplyStyles';

describe('imeReplyStyles', () => {
  it('has 9 styles matching the IME grid', () => {
    expect(IME_REPLY_STYLES).toHaveLength(9);
    expect(IME_REPLY_STYLES.map((s) => s.label)).toEqual([
      '灵光乍现',
      '浪子',
      '阳光暖男',
      '话题延伸',
      '暧昧拉扯',
      '怼一下',
      '委婉拒绝',
      '幽默爆梗',
      '情场高手',
    ]);
  });

  it('resolves style by id', () => {
    expect(getImeReplyStyle('rogue').emoji).toBe('😈');
    expect(getImeReplyStyle('refuse').chatStyle).toBe('emergency');
    expect(getImeReplyStyle('master').chatStyle).toBe('intimate');
    expect(getImeReplyStyle('master').lovePersona).toBe('boyfriend');
  });
});
