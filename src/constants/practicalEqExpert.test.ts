import { describe, it, expect } from 'vitest';
import {
  resolvePracticalScene,
  formulasForPracticalScene,
  buildPracticalEqBlock,
  scorePracticalReply,
  rankRepliesByPracticalScore,
  PRACTICAL_EQ_EXPERT_DIRECTIVE,
} from './practicalEqExpert';

describe('practicalEqExpert', () => {
  it('分寸指令强调自然男生口吻', () => {
    expect(PRACTICAL_EQ_EXPERT_DIRECTIVE).toContain('真实自然男生');
    expect(PRACTICAL_EQ_EXPERT_DIRECTIVE).toContain('10～20字');
    expect(PRACTICAL_EQ_EXPERT_DIRECTIVE).toContain('破冰');
    expect(PRACTICAL_EQ_EXPERT_DIRECTIVE).toContain('矛盾');
  });

  it('场景映射：破冰/暧昧/热恋/矛盾', () => {
    expect(resolvePracticalScene(['初识'], 'first_add')).toBe('破冰');
    expect(resolvePracticalScene(['暧昧'], 'closer')).toBe('暧昧');
    expect(resolvePracticalScene(['热恋'])).toBe('热恋');
    expect(resolvePracticalScene(['冷战'], 'angry', '生气')).toBe('矛盾');
  });

  it('矛盾场景优先修复公式', () => {
    expect(formulasForPracticalScene('矛盾')[0]).toBe('修复');
    expect(formulasForPracticalScene('破冰')[0]).toBe('开场白');
  });

  it('实战块含场景与公式', () => {
    const block = buildPracticalEqBlock({
      stages: ['初识'],
      chatScene: 'first_add',
      emotionPrimary: '好奇',
    });
    expect(block).toContain('破冰');
    expect(block).toMatch(/开场白|好奇/);
  });

  it('评分：具体有落点 > 自我介绍废句', () => {
    const good = scorePracticalReply('头像挺有意思，加上了', '破冰');
    const bad = scorePracticalReply('通过了，我是来认识你的', '破冰');
    expect(good).toBeGreaterThan(bad);
  });

  it('核实身份时答身份 > 嗯然后呢', () => {
    const good = scorePracticalReply('同群加的，刚看到顺手', '破冰', {
      identityVerify: true,
    });
    const bad = scorePracticalReply('嗯，然后呢？', '破冰', { identityVerify: true });
    expect(good).toBeGreaterThan(bad);
  });

  it('按实战分重排', () => {
    const ranked = rankRepliesByPracticalScore(
      [
        { content: '我叫阿宁，刚通过你这边' },
        { content: '通过了，我是来认识你的' },
        { content: '嗨，头像挺耐看' },
      ],
      '破冰'
    );
    expect(ranked[0].content).toContain('头像');
  });
});
