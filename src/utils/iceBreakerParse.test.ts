import { describe, it, expect } from 'vitest';
import { parseIceBreakerOutput, isValidIceBreakerLine } from './iceBreakerParse';

describe('parseIceBreakerOutput', () => {
  it('解析 JSON 格式', () => {
    const raw = '{"lines":["刚才看到你拍的那只猫，它也爱蹲车底吗？","你分享的书店我去过，有挖到好书吗？","你发的烤串看着不错，店在哪呀？"]}';
    const lines = parseIceBreakerOutput(raw, 3);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('猫');
  });

  it('从思考泄漏中抢救引号内原话', () => {
    const raw = `等下，再调整字数。第一条可以「刚才看到你拍的那只猫，它也爱蹲车底吗？」第二条「你分享的书店我去过，有挖到好书吗？」`;
    const lines = parseIceBreakerOutput(raw, 2);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.every((l) => !/等下|再调整/.test(l))).toBe(true);
  });

  it('过滤 meta 说明句', () => {
    expect(isValidIceBreakerLine('这三条都很自然，符合要求。')).toBe(false);
    expect(isValidIceBreakerLine('你周末去的那家书店，我也刚逛过～')).toBe(true);
  });
});
