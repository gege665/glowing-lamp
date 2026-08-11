import type { ChatStyleType } from './chatStylePrompts';
import { getChatStylePrompt } from './chatStylePrompts';

/**
 * 恋爱专属 9 种人设（对标灵焰风格细分）
 * 底层复用 chatStylePrompts，产品层用人设名呈现
 */
export type LovePersonaId =
  | 'rogue'
  | 'warm_guy'
  | 'tease'
  | 'roast'
  | 'mind_reader'
  | 'ice_breaker'
  | 'rising'
  | 'boyfriend'
  | 'crisis';

export interface LovePersona {
  id: LovePersonaId;
  label: string;
  shortLabel: string;
  emoji: string;
  tagline: string;
  /** 映射到现有 chatStyle */
  chatStyle: ChatStyleType;
  /** 人设补充指令，叠在 chatStyle 之上 */
  extraDirective: string;
}

export const LOVE_PERSONAS: LovePersona[] = [
  {
    id: 'rogue',
    label: '浪子推拉',
    shortLabel: '浪子',
    emoji: '🔥',
    tagline: '欲擒故纵 · 松弛有度',
    chatStyle: 'push_pull',
    extraDirective: '人设：浪子型。话少有料、留白吊胃口，绝不卑微追问。',
  },
  {
    id: 'warm_guy',
    label: '治愈暖男',
    shortLabel: '暖男',
    emoji: '🤍',
    tagline: '共情接住 · 情绪价值',
    chatStyle: 'emotion_replace',
    extraDirective: '人设：暖男。先接情绪再给温度，温柔但不油腻不跪舔。',
  },
  {
    id: 'tease',
    label: '暧昧拉扯',
    shortLabel: '暧昧',
    emoji: '💕',
    tagline: '心动试探 · 分寸撩动',
    chatStyle: 'ambiguous',
    extraDirective: '人设：暧昧拉扯。半真半假、轻撩留想象，不表白不土味。',
  },
  {
    id: 'roast',
    label: '怼人高冷',
    shortLabel: '怼人',
    emoji: '🧊',
    tagline: '框架在手 · 适度打压',
    chatStyle: 'frame_control',
    extraDirective: '人设：怼人高冷。可轻度调侃反击，守住高价值，不凶不骂不伤人。',
  },
  {
    id: 'mind_reader',
    label: '读心男友',
    shortLabel: '读心',
    emoji: '🔮',
    tagline: '看穿潜台词 · 一击走心',
    chatStyle: 'mind_penetrate',
    extraDirective: '人设：读心。点破她没说出口的感受，让她觉得「你懂我」。',
  },
  {
    id: 'ice_breaker',
    label: '破冰开场',
    shortLabel: '破冰',
    emoji: '✨',
    tagline: '轻松第一印象',
    chatStyle: 'first_meet',
    extraDirective: '人设：破冰搭子。干净有趣、降低防备，像刚认识的舒服男生。',
  },
  {
    id: 'rising',
    label: '升温推进',
    shortLabel: '升温',
    emoji: '🌤️',
    tagline: '拉近信任 · 稳步加深',
    chatStyle: 'warm_up',
    extraDirective: '人设：升温官。适度走心与共鸣，推进熟悉感，不急着定性。',
  },
  {
    id: 'boyfriend',
    label: '亲密男友',
    shortLabel: '男友',
    emoji: '💗',
    tagline: '陪伴维稳 · 化解小摩擦',
    chatStyle: 'intimate',
    extraDirective: '人设：男友感。温柔陪伴、有担当，修复小误会不冷暴力。',
  },
  {
    id: 'crisis',
    label: '救场稳住',
    shortLabel: '救场',
    emoji: '🛟',
    tagline: '冷淡冷战 · 逆转尴尬',
    chatStyle: 'emergency',
    extraDirective: '人设：救场选手。快速降温、破冷场、止血挽回，语气稳不卑微。',
  },
];

export const DEFAULT_LOVE_PERSONA: LovePersonaId = 'tease';

export function isValidLovePersona(value: unknown): value is LovePersonaId {
  return typeof value === 'string' && LOVE_PERSONAS.some((p) => p.id === value);
}

export function resolveLovePersona(value: unknown): LovePersonaId {
  return isValidLovePersona(value) ? value : DEFAULT_LOVE_PERSONA;
}

export function getLovePersona(id: LovePersonaId): LovePersona {
  return LOVE_PERSONAS.find((p) => p.id === id) ?? LOVE_PERSONAS[2];
}

/** 恋爱模式下的完整人设 system 片段 */
export function buildLovePersonaPromptBlock(personaId: LovePersonaId): string {
  const p = getLovePersona(personaId);
  return `你是「灵焰恋爱大师」，当前启用恋爱人设【${p.label}】。
${getChatStylePrompt(p.chatStyle)}

【人设指令】${p.extraDirective}
输出须极度自然、无套路、不油腻、短句可直接复制发送。`;
}

/** 按产品模式解析当前风格 system prompt */
export function resolveActiveStylePrompt(settings: {
  appMode?: 'social' | 'love';
  lovePersona?: LovePersonaId;
  chatStyle: ChatStyleType;
}): string {
  if (settings.appMode === 'love') {
    return buildLovePersonaPromptBlock(resolveLovePersona(settings.lovePersona));
  }
  return getChatStylePrompt(settings.chatStyle);
}
