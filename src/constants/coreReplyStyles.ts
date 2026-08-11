/**
 * 灵焰多风格话术 · 六风格实战包 + 主风格锁定 + 场景搭配
 * 口吻：真实、自然、不油腻的男生；每条一句话 10～20 字
 */
import type { ReplyCategory } from '../types';
import type { ReplyStyleDefinition } from './replyStylePrompts';
import {
  buildToneModifierBlock,
  type ToneModifierId,
} from './toneModifiers';
import { REPLY_LENGTH_RULE } from './replyStyleConstants';
import { COMBAT_REPLY_SYSTEM_PROMPT } from './combatReplyStyles';

export type CoreStyleId =
  | 'natural'
  | 'ambiguous'
  | 'cool'
  | 'puppy'
  | 'daddy'
  | 'rogue';

/** 旧版 id → 新版（本地设置迁移） */
const LEGACY_STYLE_MAP: Record<string, CoreStyleId> = {
  humor: 'rogue',
  gentle: 'natural',
  playful: 'ambiguous',
  flirt: 'ambiguous',
  heartfelt: 'natural',
  hook: 'rogue',
  clean: 'cool',
  rational: 'cool',
  cute: 'puppy',
  direct: 'daddy',
};

export interface CoreStyleMeta {
  id: CoreStyleId;
  label: string;
  shortLabel: string;
  usage: string;
  sample: string;
  category: ReplyCategory;
  brief: string;
  styleRequirements: string;
  /** 同风格变体角度（主风格锁定时用） */
  variants: string[];
}

/** 全风格共用铁律 */
export const HIGH_EQ_REPLY_IRON_RULES = `说话铁律（违反即重写）：
- 真实自然男生口吻：口语化、简短、不装、不套路、不油腻
- 不写书面语、不写奇怪句式、不写大道理、不解释不标注
- ${REPLY_LENGTH_RULE}
- 只接对方原话，不编没提过的事
- 硬禁：自报家门、幸会、刚通过你好友、查户口、土味、初识乱叫宝宝`;

function req(extra: string, good: string, bad: string): string {
  return `${extra}
【范例·可仿气质不可照抄】${good}
【禁仿】${bad}
人设与当前选定风格全程一致，不串味。
${HIGH_EQ_REPLY_IRON_RULES}`;
}

/** 六种实战风格（自然/暧昧/高冷/奶狗/爹系/痞帅） */
export const CORE_STYLE_META: CoreStyleMeta[] = [
  {
    id: 'natural',
    label: '自然',
    shortLabel: '自然',
    usage: '日常闲聊、松弛破冰',
    sample: '那赶紧歇着，别硬撑',
    category: 'easyCompanion',
    brief: '自然',
    styleRequirements: req(
      '松弛日常真人风：不刻意不装，生活化闲聊，有烟火气。',
      '「那赶紧歇着，别硬撑」；「同群加的，别紧张」',
      '「幸会」「我是来认识你的」「正式自我介绍」'
    ),
    variants: ['日常随和', '轻松调侃', '简单共情', '自然收尾'],
  },
  {
    id: 'ambiguous',
    label: '暧昧',
    shortLabel: '暧昧',
    usage: '升温、轻撩、制造心动',
    sample: '别人不配，你例外',
    category: 'pushPull',
    brief: '暧昧',
    styleRequirements: req(
      '轻撩升温：点到即止，模糊边界，有想象空间，不直白低俗。',
      '「别人不配，你例外」；「累了就缓缓，我陪你唠两句」',
      '「我爱你」「想睡你」「宝贝想你了」'
    ),
    variants: ['轻撩试探', '暧昧推拉', '温柔沦陷', '留白钩子'],
  },
  {
    id: 'cool',
    label: '高冷',
    shortLabel: '高冷',
    usage: '话少留白、欲擒故纵',
    sample: '行，想聊了再说',
    category: 'coolFrame',
    brief: '高冷',
    styleRequirements: req(
      '欲擒故纵钓系：短句留白，不主动不卑微，节奏在自己。',
      '「行，想聊了再说」；「先聊着，名字不急」',
      '「求你理理我」「随便」「哦。」（无落点）'
    ),
    variants: ['高冷克制', '留白钓系', '反撩试探', '简洁收尾'],
  },
  {
    id: 'puppy',
    label: '奶狗',
    shortLabel: '奶狗',
    usage: '软萌黏人、温柔示弱',
    sample: '那快歇歇呀，别硬撑',
    category: 'doting',
    brief: '奶狗',
    styleRequirements: req(
      '软萌黏人：温柔示弱、甜度适中；初识禁止宝宝/跪舔。',
      '「那快歇歇呀，别硬撑」；「别敷衍我呀，认真聊呢」',
      '「宝宝抱抱」「求你理我」「跪着哄」'
    ),
    variants: ['软萌撒娇', '温柔黏人', '示弱求关注', '软软收尾'],
  },
  {
    id: 'daddy',
    label: '爹系',
    shortLabel: '爹系',
    usage: '护短担当、给安全感',
    sample: '先放下，去休息',
    category: 'steadyMature',
    brief: '爹系',
    styleRequirements: req(
      '霸道护短有分寸：笃定兜底，偏爱但不说教、不油腻占有。',
      '「先放下，去休息」；「记住了，有事直接说」',
      '「听我的必须」「你是我的」硬控腔'
    ),
    variants: ['护短兜底', '笃定偏爱', '强势温柔', '担当收尾'],
  },
  {
    id: 'rogue',
    label: '痞帅',
    shortLabel: '痞帅',
    usage: '坏笑调侃、拽酷拿捏',
    sample: '怎么，吃醋啦？',
    category: 'lightHumor',
    brief: '痞帅',
    styleRequirements: req(
      '坏笑拽酷：调侃推拉，撩而不油，松弛制造情绪波动。',
      '「怎么，吃醋啦？」；「让你好奇一下也正常」',
      '「给你讲个笑话」「我太帅了吧」'
    ),
    variants: ['坏笑调侃', '痞帅推拉', '轻松撩拨', '拽酷收尾'],
  },
];

export const DEFAULT_PRIMARY_REPLY_STYLE: CoreStyleId | '' = '';

/** 兼容旧导出名 */
export const CORE_EIGHT_STYLES: ReplyStyleDefinition[] = CORE_STYLE_META.map((m) => ({
  category: m.category,
  label: m.label,
  brief: m.brief,
  styleRequirements: m.styleRequirements,
  mode: 'flirt' as const,
}));

export function isValidCoreStyleId(value: unknown): value is CoreStyleId {
  return typeof value === 'string' && CORE_STYLE_META.some((m) => m.id === value);
}

export function resolvePrimaryReplyStyle(value: unknown): CoreStyleId | '' {
  if (value === '' || value == null) return '';
  if (typeof value !== 'string') return '';
  if (isValidCoreStyleId(value)) return value;
  const mapped = LEGACY_STYLE_MAP[value];
  return mapped ?? '';
}

export function getCoreStyleMeta(id: CoreStyleId): CoreStyleMeta {
  return CORE_STYLE_META.find((m) => m.id === id) ?? CORE_STYLE_META[0];
}

/** 主风格锁定：同一人设下多角度变体 */
export function buildPrimaryStyleVariants(styleId: CoreStyleId): ReplyStyleDefinition[] {
  const meta = getCoreStyleMeta(styleId);
  return meta.variants.map((angle) => ({
    category: meta.category,
    label: meta.label,
    brief: `${meta.brief} · ${angle}`,
    styleRequirements: `${meta.styleRequirements} 本条侧重「${angle}」，用词与开头须与其他条不同，但气质仍是【${meta.label}】。`,
    mode: 'flirt' as const,
  }));
}

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
    styleIds: ['natural', 'rogue', 'cool'],
    prompt: '短、自然、好接，像随手第一句；别查户口、别客服、别自我介绍腔。',
    openingHint: '自然 + 痞帅 + 高冷',
  },
  {
    id: 'cold_chat',
    label: '冷场救场',
    styleIds: ['rogue', 'natural', 'ambiguous'],
    prompt: '轻松接一下，别尬聊，别干巴「在吗」。',
  },
  {
    id: 'closer',
    label: '拉近距离',
    styleIds: ['natural', 'puppy', 'ambiguous'],
    prompt: '稍微近一点，舒服即可，禁止油腻表白。',
  },
  {
    id: 'invite',
    label: '想约出来',
    styleIds: ['rogue', 'cool', 'natural'],
    prompt: '自然提见面，具体不施压。',
  },
  {
    id: 'angry',
    label: '对方生气',
    styleIds: ['natural', 'daddy', 'cool'],
    prompt: '先接情绪；温柔但不卑微，别讲大道理。',
  },
  {
    id: 'perfunctory',
    label: '对方敷衍',
    styleIds: ['cool', 'rogue', 'natural'],
    prompt: '别舔别追问；简洁或幽默拉回即可。',
  },
  {
    id: 'test_feelings',
    label: '试探心意',
    styleIds: ['ambiguous', 'rogue', 'cool'],
    prompt: '轻撩或自然点一下，不表白不油腻。',
  },
  {
    id: 'make_up',
    label: '吵架缓和',
    styleIds: ['natural', 'daddy', 'puppy'],
    prompt: '先降温；认一点错可以，不跪舔。',
  },
];

export const QUICK_STYLE_HINTS: { id: string; label: string; prompt: string }[] = [
  { id: 'natural_hint', label: '更自然', prompt: '再松弛日常一点，别刻意。' },
  { id: 'ambiguous_hint', label: '更暧昧', prompt: '轻撩一点，点到即止。' },
  { id: 'cool_hint', label: '更高冷', prompt: '高冷留白一点，别舔。' },
  { id: 'puppy_hint', label: '更奶狗', prompt: '软一点黏一点，别跪。' },
  { id: 'daddy_hint', label: '更爹系', prompt: '笃定护短一点，别说教。' },
  { id: 'rogue_hint', label: '更痞帅', prompt: '坏笑调侃一点，别油。' },
];

export const OPENING_PROMPTS: { label: string; prompt: string }[] = [
  { label: '刚认识', prompt: '轻松自然，别刻意；禁止查户口。' },
  { label: '暧昧期', prompt: '轻撩自然一点，不油腻。' },
  { label: '想邀约', prompt: '自然提见面，不施压。' },
  { label: '哄人', prompt: '先接情绪，不卑微。' },
];

export const LINGYAN_MULTI_STYLE_DIRECTIVE = `${COMBAT_REPLY_SYSTEM_PROMPT}

【多套方案差异化 · 强制遵守】
你就是我本人在聊。可选气质（勿标注）：自然 / 暧昧 / 高冷 / 奶狗 / 爹系 / 痞帅。
短句、自然、松弛；可带哈哈/哦/嗯/～/呀；要让对方接得上话；每条 10～20 字；只输出最终回复。
禁止：AI腔、模板句、自报家门、幸会、荣幸认识、书面怪句。

【差异化铁律 · 用户要能直接换下一条看】
- 至少 3 条在「内容、风格、切入角度」上明显不同，禁止换皮同句
- 禁止四条都用同一骨架只改语气词
- 用户不满意当前条时，下一条必须是真正不同的选项
1. 锁定气质时：气质统一，但角度/落点必须互不相同
2. 未锁定：按场景混排多种气质，像同一个人的不同说法`;

/** 各风格强制切入角度 */
export const STYLE_ANGLE_HINTS: Record<string, string> = {
  自然: '角度·生活化接住：松弛落点，别干巴复述',
  暧昧: '角度·轻撩留白：点到即止，别直白',
  高冷: '角度·短句留白：只答关键，不讨好',
  奶狗: '角度·软黏示弱：甜度适中，别跪',
  爹系: '角度·笃定兜底：护短有分寸，别说教',
  痞帅: '角度·坏笑回球：调侃推拉，别油',
};

export function getChatScene(id: string | undefined) {
  if (!id) return undefined;
  return CHAT_SCENES.find((s) => s.id === id);
}

export function isValidChatScene(id: unknown): id is ChatSceneId {
  return typeof id === 'string' && CHAT_SCENES.some((s) => s.id === id);
}

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

export function buildSceneStylePromptBlock(settings: {
  chatScene?: string;
  tonePreference?: string;
  toneModifiers?: ToneModifierId[];
  primaryReplyStyle?: CoreStyleId | '';
}): string {
  const parts: string[] = [LINGYAN_MULTI_STYLE_DIRECTIVE];
  const scene = getChatScene(settings.chatScene);

  if (settings.primaryReplyStyle && isValidCoreStyleId(settings.primaryReplyStyle)) {
    const meta = getCoreStyleMeta(settings.primaryReplyStyle);
    parts.push(
      `【主风格已锁定 · ${meta.label}】\n全部话术必须统一为「${meta.label}」：${meta.styleRequirements}\n示例参考：${meta.sample}`
    );
  } else if (scene) {
    const styleNames = scene.styleIds
      .map((id) => CORE_STYLE_META.find((m) => m.id === id)?.label)
      .filter(Boolean)
      .join(' + ');
    parts.push(`【当前聊天场景 · ${scene.label}】推荐：${styleNames}\n${scene.prompt}`);
  } else {
    parts.push(
      '【多风格混排】按六种实战风格选取差异化条目；内容/角度必须明显不同，禁止换皮同句。'
    );
  }

  const toneBlock = buildToneModifierBlock(
    settings.toneModifiers ?? [],
    settings.tonePreference
  );
  if (toneBlock) parts.push(toneBlock);

  return parts.join('\n\n');
}
