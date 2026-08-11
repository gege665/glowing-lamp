/**
 * 灵焰恋爱大师 · 顶级 AI 聊天助手核心准则
 * 统领分析 + 话术生成的人设与输出质量
 */

/** 关系阶段（产品统一枚举） */
export const LINGYAN_RELATIONSHIP_STAGES = [
  '陌生',
  '初识',
  '暧昧',
  '热恋',
  '冷战',
  '挽回',
] as const;

export type LingyanRelationshipStage = (typeof LINGYAN_RELATIONSHIP_STAGES)[number];

/** 旧阶段 → 灵焰阶段 */
export const LEGACY_STAGE_MAP: Record<string, LingyanRelationshipStage> = {
  初识阶段: '初识',
  升温阶段: '暧昧',
  暧昧阶段: '暧昧',
  确定关系: '热恋',
  亲密阶段: '热恋',
  陌生: '陌生',
  初识: '初识',
  暧昧: '暧昧',
  热恋: '热恋',
  冷战: '冷战',
  挽回: '挽回',
  冷淡: '冷战',
};

export function resolveLingyanStage(value: unknown): LingyanRelationshipStage {
  if (typeof value !== 'string' || !value.trim()) return '暧昧';
  if (LEGACY_STAGE_MAP[value]) return LEGACY_STAGE_MAP[value];
  if ((LINGYAN_RELATIONSHIP_STAGES as readonly string[]).includes(value)) {
    return value as LingyanRelationshipStage;
  }
  return '暧昧';
}

export function normalizeLingyanStages(raw: unknown): LingyanRelationshipStage[] {
  const list = Array.isArray(raw) ? raw : [];
  const mapped = list
    .map((s) => resolveLingyanStage(s))
    .filter((s, i, arr) => arr.indexOf(s) === i);
  return mapped.length > 0 ? mapped : ['暧昧'];
}

/** 灵焰恋爱大师 · 身份总纲（注入 systemTone 前缀） */
export const LINGYAN_MASTER_IDENTITY = `你是「灵焰恋爱大师」，但发声时你就是我本人：普通男生正常聊天。
任务：根据场景给出可直接发送的短回复；气质取自然/暧昧/高冷/奶狗/爹系/痞帅（勿标注）。
铁律：无AI腔、无模板句；禁幸会/荣幸认识；短句松弛自然；可带哈哈/哦/嗯/～/呀；要让对方接得上话；每条约10～20字；只输出最终回复。
未问身份禁自报家门；若对方问你是谁/什么事，必须先答身份+来源+来意，再带轻钩子。`;

/** 各关系阶段的分寸提示（注入 user 上下文） */
export const LINGYAN_STAGE_GUIDANCE: Record<string, string> = {
  陌生: '分寸：克制礼貌，少撩多稳，先让对方不设防。',
  初识: '分寸：轻松有趣，降低陌生感，不查户口不急推进。',
  暧昧: '分寸：留白半撩，制造惦记，不表白不油腻。',
  热恋: '分寸：亲密陪伴，情绪价值拉满，小摩擦先共情。',
  冷战: '分寸：先降温给台阶，不辩解不追问，稳得住。',
  挽回: '分寸：有担当认错点，不卑微跪舔，给具体改变。',
};

export function buildLingyanStageBlock(stages: string[]): string {
  const primary = stages[0] || '暧昧';
  const tip = LINGYAN_STAGE_GUIDANCE[primary] || LINGYAN_STAGE_GUIDANCE['暧昧'];
  return `【当前关系阶段 · ${stages.join('、')}】${tip}`;
}
