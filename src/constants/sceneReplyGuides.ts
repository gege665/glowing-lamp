import type { ChatSceneId } from './coreReplyStyles';
import { CORE_STYLE_META, getChatScene } from './coreReplyStyles';
import type { ReplyStyleDefinition } from './replyStylePrompts';
import type { ToneModifierId } from './toneModifiers';
import { buildToneModifierBlock, getReplyLengthCap } from './toneModifiers';

export interface SceneReplyGuide {
  situation: string;
  goal: string;
  mustAvoid: string[];
  styleHints: Partial<Record<string, string>>;
  goodVibe: string[];
}

const FIRST_ADD_GUIDE: SceneReplyGuide = {
  situation: '刚通过好友申请，双方还不熟，发第一条消息破冰',
  goal: '短、轻撩、稳——像见过世面的人随手发一句，让她想回',
  mustAvoid: [
    '终于等到你通过/差点以为手机坏了',
    '加你好友就是想多了解你/别嫌我烦',
    '今天过得怎么样/有什么开心的事（查户口）',
    '熟悉一下/有话题随时找我（客服感）',
    '刷到你抖音/视频/动态',
    '没别的事/就想打个招呼',
    '长篇解释加好友目的',
  ],
  styleHints: {
    暧昧: '轻 compliment+悬念，例：通过了，有点想认识你～',
    幽默: '短调侃，例：可算加上了，手速可以啊😏',
    温柔: '暖+具体点，例：嗨～头像挺好看',
    直球: '自然不油，例：看你挺有意思，来聊',
    理性: '松弛一句，例：刚加上，聊？',
    可爱: '俏皮短句，例：嘿嘿，加上了～',
    走心: '真诚但短，例：嗨，幸会',
    高冷: '话少稳，例：嗨，通过了',
  },
  goodVibe: [
    '8～18 字，一句说完',
    '轻微撩但不油、不表白',
    '稳、有框架，不查户口',
    '可夸头像/昵称/签名等具体点',
  ],
};

const IDENTITY_VERIFY_GUIDE: SceneReplyGuide = {
  situation: '刚加好友/陌生人核验，她在问你是谁、怎么加到的、有什么事',
  goal: '先答她关心的问题：身份+来源+来意，短、稳、不油，让她敢回',
  mustAvoid: [
    'XX/某某/某群/某平台 占位符',
    '不答「你是谁」只打招呼',
    '刷到你抖音/视频/动态（除非对话里真提过）',
    '没事/随便聊聊/就想认识一下（她问事由时）',
    '反问她/装熟/施压/查户口',
    '长篇解释加好友目的',
  ],
  styleHints: {
    暧昧: '先稳再撩：自报名+来源，例：别慌，我是小明，同群加你的',
    幽默: '化解防备：例：查户口啊？行，小明，同群那位',
    温柔: '先安她心：例：嗨，小明，之前在群里见过',
    直球: '直接答：例：小明，同群，想跟你聊两句',
    理性: '条理清楚：例：小明，朋友名片加的，有事说',
    可爱: '软一点：例：嘿嘿别紧张，我是小明啦',
    走心: '真诚短：例：确实唐突，小明，之前同群',
    高冷: '话少稳：例：小明，同群加的',
  },
  goodVibe: [
    '每条先回应她的质问/核验点',
    '15～35 字，一句说完',
    '有真实线索就用，没有就模糊自然表述，禁止 XX',
  ],
};

const SCENE_GUIDES: Partial<Record<ChatSceneId, SceneReplyGuide>> = {
  first_add: FIRST_ADD_GUIDE,
  cold_chat: {
    situation: '聊天冷场，需要自然续话题',
    goal: '抛一个轻松好接的话题，别尬聊',
    mustAvoid: ['在吗', '忙吗', '怎么不回', '查户口式连环问'],
    styleHints: { 幽默: '接上一句或自嘲冷场，例：突然不知道说啥了😂' },
    goodVibe: ['接上文', '开放式但好答'],
  },
  closer: {
    situation: '想拉近距离，关系已有基础',
    goal: '走心或适度暧昧，让她觉得被理解',
    mustAvoid: ['土味情话', '过早表白', '长篇大论'],
    styleHints: { 走心: '分享感受或共鸣，例：跟你聊天挺舒服的' },
    goodVibe: ['真诚', '留回复空间'],
  },
  invite: {
    situation: '想约见面',
    goal: '具体但不施压的邀约',
    mustAvoid: ['什么时候有空', '赏个脸', '必须来'],
    styleHints: { 直球: '例：周末有空吗，想请你喝杯咖啡' },
    goodVibe: ['具体时间/活动', '可拒绝的语气'],
  },
};

const DEFAULT_GUIDE: SceneReplyGuide = {
  situation: '日常私信聊天',
  goal: '口语自然、精准接话、可复制发送',
  mustAvoid: ['刷到你抖音/视频', '摄影爱好者', '咨询小问题', '客服套话'],
  styleHints: {},
  goodVibe: ['15～35字', '像真人随手打'],
};

export function getSceneReplyGuide(sceneId: string | undefined): SceneReplyGuide {
  if (sceneId && sceneId in SCENE_GUIDES) {
    return SCENE_GUIDES[sceneId as ChatSceneId] ?? DEFAULT_GUIDE;
  }
  return DEFAULT_GUIDE;
}

/** 身份核验 / 质问场景（非纯破冰开场） */
export function getIdentityVerifyGuide(): SceneReplyGuide {
  return IDENTITY_VERIFY_GUIDE;
}

/** 构建场景话术 prompt 块（含正反例） */
export function buildSceneReplyGuideBlock(
  sceneId: string | undefined,
  styles: ReplyStyleDefinition[],
  toneModifiers: ToneModifierId[] = [],
  options?: { identityVerify?: boolean }
): string {
  const scene = getChatScene(sceneId);
  const guide = options?.identityVerify
    ? getIdentityVerifyGuide()
    : getSceneReplyGuide(sceneId);
  const lengthCap = getReplyLengthCap(toneModifiers);

  const styleLines = styles
    .map((s) => {
      const hint = guide.styleHints[s.label] ?? CORE_STYLE_META.find((m) => m.label === s.label)?.sample;
      return `· ${s.label}：${hint ?? s.brief}`;
    })
    .join('\n');

  const toneBlock = buildToneModifierBlock(toneModifiers);

  return `【情境】${guide.situation}
【目标】${guide.goal}
${scene ? `【场景】${scene.label}：${scene.prompt}` : ''}
${toneBlock ? `\n${toneBlock}` : ''}

【每条风格怎么写】
${styleLines}

【好话术特征】${guide.goodVibe.join('；')}；单条不超过 ${lengthCap} 字

【严禁套话 · 出现即失败】
${guide.mustAvoid.map((x) => `- ${x}`).join('\n')}`;
}

/** 占位符 / 模板腔检测 */
export function lineLooksLikePlaceholder(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /XX|某某|某群|某平台|某音|某书/.test(t);
}

/** 开场/场景话术低质量检测 */
export function lineLooksLikeOpeningCringe(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (lineLooksLikePlaceholder(t)) return true;
  const patterns = [
    /终于等到你通过/,
    /差点以为.*手机/,
    /加你(好)?友就是为了/,
    /就是想多了解你/,
    /别嫌我烦/,
    /熟悉一下/,
    /随时找我/,
    /有想聊的话题/,
    /今天过得怎么样/,
    /有没有.*开心的事/,
    /有什么开心/,
    /多多关照/,
    /请多指教/,
    /很高兴认识你/,
  ];
  return patterns.some((p) => p.test(t));
}

export function scoreSceneReplies(
  replies: { content: string }[],
  toneModifiers: ToneModifierId[] = []
): number {
  const lengthCap = getReplyLengthCap(toneModifiers);
  let score = 0;
  for (const r of replies) {
    if (lineLooksLikeOpeningCringe(r.content)) score += 15;
    if (r.content.length > lengthCap) score += 8;
    if (r.content.length > lengthCap + 6) score += 5;
    if (/^[你您]好[，,]?$/.test(r.content)) score += 10;
  }
  const starts = replies.map((r) => r.content.slice(0, 2));
  if (new Set(starts).size < starts.length) score += 8;
  return score;
}
