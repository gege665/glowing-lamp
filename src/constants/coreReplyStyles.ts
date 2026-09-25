/**
 * 8 种核心话术风格 + 场景搭配 + 隐形提示词
 */
import type { ReplyCategory } from '../types';
import type { ReplyStyleDefinition } from './replyStylePrompts';
import {
  buildToneModifierBlock,
  type ToneModifierId,
} from './toneModifiers';
import { REPLY_LENGTH_RULE } from './replyStyleConstants';

export type CoreStyleId =
  | 'gentle'
  | 'humor'
  | 'flirt'
  | 'direct'
  | 'rational'
  | 'cool'
  | 'heartfelt'
  | 'cute';

export interface CoreStyleMeta {
  id: CoreStyleId;
  label: string;
  usage: string;
  sample: string;
  category: ReplyCategory;
  brief: string;
  styleRequirements: string;
}

function req(extra: string): string {
  return `语气自然、口语化。${extra}。${REPLY_LENGTH_RULE}`;
}

/** 8 种核心风格定义 */
export const CORE_STYLE_META: CoreStyleMeta[] = [
  {
    id: 'gentle',
    label: '温柔',
    usage: '安慰、道歉、哄人、降温气氛',
    sample: '好啦别气了，是我不好，先抱抱你～',
    category: 'warmCare',
    brief: '温柔安抚',
    styleRequirements: req('软、暖、先共情再说话，不油不跪'),
  },
  {
    id: 'humor',
    label: '幽默',
    usage: '破冰、冷场救场、拉近距离',
    sample: '我这开场白还行吧，不行我再换一个😂',
    category: 'lightHumor',
    brief: '轻松幽默',
    styleRequirements: req('轻松搞笑、接梗自然、不尴尬不低俗'),
  },
  {
    id: 'flirt',
    label: '暧昧',
    usage: '升温、拉扯、试探心意',
    sample: '你再这样看我，我可要误会了～',
    category: 'pushPull',
    brief: '暧昧拉扯',
    styleRequirements: req('留想象空间、不油腻、分寸感好'),
  },
  {
    id: 'direct',
    label: '直球',
    usage: '表白、邀约、确定关系',
    sample: '周末有空吗，想请你喝杯咖啡。',
    category: 'clearAttitude',
    brief: '直球表达',
    styleRequirements: req('直接大胆、不绕弯、不施压'),
  },
  {
    id: 'rational',
    label: '理性',
    usage: '吵架讲道理、分析问题、不情绪化',
    sample: '咱俩先把事说清楚，情绪放一放。',
    category: 'rationalSteady',
    brief: '理性客观',
    styleRequirements: req('冷静、讲逻辑、不抬杠不说教'),
  },
  {
    id: 'cool',
    label: '高冷',
    usage: '保持框架、不卑微、不过度热情',
    sample: '行，那你忙，有空再说。',
    category: 'coolFrame',
    brief: '高冷框架',
    styleRequirements: req('话少、有距离感、不舔不追'),
  },
  {
    id: 'heartfelt',
    label: '走心',
    usage: '深夜聊天、聊未来、拉近距离',
    sample: '跟你聊天挺舒服的，希望以后也能常聊。',
    category: 'deepHeart',
    brief: '走心真诚',
    styleRequirements: req('真诚有质感、不土味不鸡汤'),
  },
  {
    id: 'cute',
    label: '可爱',
    usage: '轻松日常、撒娇、轻松互动',
    sample: '嘿嘿，被你发现我在摸鱼了～',
    category: 'playful',
    brief: '可爱俏皮',
    styleRequirements: req('灵动可爱、轻微撒娇、不幼稚'),
  },
];

export const CORE_EIGHT_STYLES: ReplyStyleDefinition[] = CORE_STYLE_META.map((m) => ({
  category: m.category,
  label: m.label,
  brief: m.brief,
  styleRequirements: m.styleRequirements,
  mode: 'flirt' as const,
}));

export const CORE_STYLE_SAMPLES: Record<string, string> = Object.fromEntries(
  CORE_STYLE_META.map((m) => [m.label, m.sample])
);

export type ChatSceneId =
  | 'first_add'
  | 'cold_chat'
  | 'closer'
  | 'invite'
  | 'angry'
  | 'perfunctory'
  | 'test_feelings'
  | 'make_up';

/** 场景 → 风格一键搭配 */
export const CHAT_SCENES: {
  id: ChatSceneId;
  label: string;
  styleIds: CoreStyleId[];
  prompt: string;
  openingHint?: string;
}[] = [
  {
    id: 'first_add',
    label: '刚加好友',
    styleIds: ['flirt', 'humor', 'gentle'],
    prompt: '短、轻撩、稳，像随手发的第一句，别查户口别客服。',
    openingHint: '暧昧 + 幽默 + 温柔',
  },
  {
    id: 'cold_chat',
    label: '冷场救场',
    styleIds: ['humor'],
    prompt: '轻松破冰，别尴尬，自然续话题。',
  },
  {
    id: 'closer',
    label: '拉近距离',
    styleIds: ['heartfelt', 'flirt'],
    prompt: '有点小走心，适度暧昧，让对方觉得舒服。',
  },
  {
    id: 'invite',
    label: '想约出来',
    styleIds: ['direct', 'humor'],
    prompt: '自然一点提见面，不突兀，不施压。',
  },
  {
    id: 'angry',
    label: '对方生气',
    styleIds: ['gentle', 'rational'],
    prompt: '温柔安抚，先共情再说话，别讲道理压人。',
  },
  {
    id: 'perfunctory',
    label: '对方敷衍',
    styleIds: ['cool', 'humor'],
    prompt: '别舔，保持框架，用幽默拉回气氛。',
  },
  {
    id: 'test_feelings',
    label: '试探心意',
    styleIds: ['flirt', 'direct'],
    prompt: '有点小暧昧拉扯，但不表白、不油腻。',
  },
  {
    id: 'make_up',
    label: '吵架缓和',
    styleIds: ['gentle', 'rational'],
    prompt: '先降温再沟通，温柔但不卑微。',
  },
];

/** 一句话隐形提示词 · 聊天前快速选 */
export const QUICK_STYLE_HINTS: { id: string; label: string; prompt: string }[] = [
  { id: 'gentle_hint', label: '温柔一点', prompt: '我要温柔一点，别太油。' },
  { id: 'humor_hint', label: '幽默一点', prompt: '我想幽默一点，别尴尬。' },
  { id: 'flirt_hint', label: '暧昧拉扯', prompt: '现在要暧昧拉扯，不表白。' },
  { id: 'warm_up_hint', label: '拉回气氛', prompt: '对方有点冷淡，帮我拉回气氛。' },
  { id: 'frame_hint', label: '保持框架', prompt: '别舔，保持框架。' },
];

/** 万能开场提示 */
export const OPENING_PROMPTS: { label: string; prompt: string }[] = [
  { label: '刚认识', prompt: '轻松自然一点，别太刻意，像朋友聊天开场。' },
  { label: '暧昧期', prompt: '有点小暧昧，但不油腻，让对方觉得舒服。' },
  { label: '想邀约', prompt: '自然一点提见面，不突兀，不施压。' },
  { label: '哄人', prompt: '温柔安抚，先共情再说话。' },
];

export function getChatScene(id: string | undefined) {
  if (!id) return undefined;
  return CHAT_SCENES.find((s) => s.id === id);
}

export function isValidChatScene(id: unknown): id is ChatSceneId {
  return typeof id === 'string' && CHAT_SCENES.some((s) => s.id === id);
}

/** 按场景优先排序 8 种核心风格 */
export function orderCoreStylesByScene(sceneId: string | undefined): ReplyStyleDefinition[] {
  const scene = getChatScene(sceneId);
  if (!scene) return [...CORE_EIGHT_STYLES];

  const priority = scene.styleIds
    .map((id) => CORE_STYLE_META.find((m) => m.id === id))
    .filter(Boolean) as CoreStyleMeta[];

  const ordered: ReplyStyleDefinition[] = [];
  for (const meta of priority) {
    const style = CORE_EIGHT_STYLES.find((s) => s.label === meta.label);
    if (style) ordered.push(style);
  }
  for (const style of CORE_EIGHT_STYLES) {
    if (!ordered.some((o) => o.label === style.label)) ordered.push(style);
  }
  return ordered;
}

/** 场景 + 语气 → AI 隐形提示块 */
export function buildSceneStylePromptBlock(settings: {
  chatScene?: string;
  tonePreference?: string;
  toneModifiers?: ToneModifierId[];
}): string {
  const parts: string[] = [];
  const scene = getChatScene(settings.chatScene);

  if (scene) {
    const styleNames = scene.styleIds
      .map((id) => CORE_STYLE_META.find((m) => m.id === id)?.label)
      .filter(Boolean)
      .join(' + ');
    parts.push(
      `【当前聊天场景 · ${scene.label}】推荐风格：${styleNames}\n${scene.prompt}`
    );
  }

  const toneBlock = buildToneModifierBlock(
    settings.toneModifiers ?? [],
    settings.tonePreference
  );
  if (toneBlock) parts.push(toneBlock);

  return parts.length ? parts.join('\n\n') : '';
}
