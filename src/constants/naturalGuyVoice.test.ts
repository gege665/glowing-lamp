import { describe, it, expect } from 'vitest';
import { NATURAL_GUY_VOICE_DIRECTIVE } from './naturalGuyVoice';
import { REPLY_LENGTH_RULE } from './replyStyleConstants';
import { lineLooksLikeOpeningCringe } from './sceneReplyGuides';
import { lineLooksGreasyOrServile } from '../utils/replyQuality';

describe('naturalGuyVoice', () => {
  it('强调本人口吻与禁区', () => {
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain('你现在就是我本人');
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain('绝对不要AI腔');
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain('自报家门');
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain('荣幸认识');
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain('哈哈');
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain('不把天聊死');
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain('只输出最终回复');
    expect(NATURAL_GUY_VOICE_DIRECTIVE).toContain(REPLY_LENGTH_RULE);
  });

  it('拦截幸会/荣幸认识类怪句', () => {
    expect(lineLooksLikeOpeningCringe('嗨，幸会')).toBe(true);
    expect(lineLooksGreasyOrServile('荣幸认识你')).toBe(true);
    expect(lineLooksLikeOpeningCringe('哈哈可算加上了')).toBe(false);
  });
});
