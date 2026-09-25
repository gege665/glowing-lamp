import type { StrategyCard } from '../types';

/** 竞品式意图标签（分析 JSON intentLabel） */
export const INTENT_LABELS = [
  '废物测试',
  '试探真心',
  '冷淡敷衍',
  '边界试探',
  '求关注',
  '邀约试探',
  '情绪宣泄',
  '确认身份',
  '确认目的',
  '日常闲聊',
  '其他',
] as const;

export type IntentLabel = (typeof INTENT_LABELS)[number];

/** 人设九宫格 · 一键指定回复方向 */
export const PERSONA_STYLE_GRID = [
  { id: 'spark', label: '灵光乍现', hint: '创意短句，意外接梗，有记忆点' },
  { id: 'playboy', label: '浪子', hint: '痞一点、松弛、不舔不跪' },
  { id: 'warm', label: '阳光暖男', hint: '暖、稳、真诚，不油腻' },
  { id: 'extend', label: '话题延伸', hint: '顺着她的话延展，自然往下聊' },
  { id: 'pull', label: '暧昧拉扯', hint: '轻撩推拉，留一点余地' },
  { id: 'roast', label: '怼一下', hint: '玩笑式回怼，不伤人' },
  { id: 'refuse', label: '委婉拒绝', hint: '礼貌划界，不撕破脸' },
  { id: 'humor', label: '幽默爆梗', hint: '好笑口语梗，可拆字玩梗' },
  { id: 'pro', label: '情场高手', hint: '高情商绕开陷阱，击中情绪' },
] as const;

export type PersonaStyleId = (typeof PERSONA_STYLE_GRID)[number]['id'];

export function getPersonaStyle(id: string) {
  return PERSONA_STYLE_GRID.find((p) => p.id === id);
}

/** 模型未返回对策卡时，用策略字段 + 话术兜底合成 */
export function synthesizeStrategyCards(input: {
  communicationStrategy?: string;
  nextMove?: string;
  emotionSwap?: string;
  frameAdjust?: string;
  scenarioTip?: string;
  replyExamples?: string[];
}): StrategyCard[] {
  const examples = (input.replyExamples ?? []).map((s) => s.trim()).filter(Boolean);
  const approaches = [
    { title: '对策一', approach: input.communicationStrategy || input.nextMove || '' },
    { title: '对策二', approach: input.emotionSwap || input.frameAdjust || '' },
    { title: '对策三', approach: input.scenarioTip || input.nextMove || '' },
  ].filter((a) => a.approach.trim());

  const cards: StrategyCard[] = [];
  for (let i = 0; i < Math.min(3, Math.max(approaches.length, examples.length ? 2 : 0)); i++) {
    const approach =
      approaches[i]?.approach ||
      approaches[0]?.approach ||
      '用高情商方式回应对方最后一句';
    const example = examples[i] || examples[0] || '';
    if (!approach.trim() && !example) continue;
    cards.push({
      title: approaches[i]?.title || `对策${i + 1}`,
      approach: approach.trim().slice(0, 40),
      example: example.slice(0, 40),
    });
  }
  return cards.slice(0, 3);
}

export function normalizeStrategyCards(raw: unknown): StrategyCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const title = String(o.title ?? `对策${i + 1}`).trim().slice(0, 16);
      const approach = String(o.approach ?? o.rationale ?? '').trim().slice(0, 40);
      const example = String(o.example ?? o.content ?? o.reply ?? '').trim().slice(0, 40);
      if (!approach && !example) return null;
      return { title: title || `对策${i + 1}`, approach, example };
    })
    .filter((c): c is StrategyCard => Boolean(c))
    .slice(0, 3);
}

export function normalizeIntentLabel(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const hit = INTENT_LABELS.find((l) => s.includes(l) || l.includes(s));
  return (hit || s).slice(0, 12);
}
