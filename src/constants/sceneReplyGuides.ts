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
  situation: '刚通过好友申请，双方还不熟，发第一条消息破冰（她没问你是谁）',
  goal: '开场白公式：好奇+细节+共鸣；短、有画面、好接；风格差异一眼能看出来',
  mustAvoid: [
    '我是来认识你的 / 想认真聊聊 / 正式认识一下（目的宣告腔）',
    '我是刚加你的 / 刚加你的那位 / 自报家门 / 刚通过你好友',
    '我叫XX/我是XX + 刚通过/刚加/打招呼',
    '刚通过你这边 / 想打个招呼 / 来打个招呼',
    '别急着拉黑我（示弱）',
    '终于等到你通过/差点以为手机坏了',
    '加你好友就是想多了解你/别嫌我烦',
    '今天过得怎么样/有什么开心的事（查户口）',
    '熟悉一下/有话题随时找我（客服感）',
    '刷到你抖音/视频/动态',
    '长篇解释加好友目的',
  ],
  styleHints: {
    自然: '场景随和，例：可算加上了，手速可以啊',
    暧昧: '轻撩留白，例：聊天框里会慢慢眼熟',
    高冷: '利落有落点，例：嗯，通过了有空再说',
    奶狗: '软软接住，例：加上啦有点小紧张呀',
    爹系: '笃定落点，例：记住了有事直接说',
    痞帅: '坏笑接住，例：头像挺有意思呀',
  },
  goodVibe: [
    '10～20 字，一句说完',
    '像正常男生随手回；禁止目的宣告与自我介绍腔',
    '4 条骨架各不相同；可点头像/昵称等具体细节',
    '轻微情绪即可，不油、不表白、不查户口',
  ],
};

/** 开场被质量过滤后的风格兜底（保证可用、非废句） */
export const OPENING_STYLE_FALLBACKS: Record<string, string> = {
  自然: '哈哈可算加上了',
  暧昧: '聊天框里慢慢眼熟',
  高冷: '哦通过了有空再说',
  奶狗: '加上啦有点小紧张呀',
  爹系: '记住了有事直接说',
  痞帅: '头像挺有意思呀',
};

const IDENTITY_VERIFY_GUIDE: SceneReplyGuide = {
  situation: '刚加好友/陌生人核验，她在问你是谁、怎么加到的、有什么事',
  goal: '先答她关心的问题：身份+来源+来意，短、稳、不油，让她敢回',
  mustAvoid: [
    'XX/某某/某群/某平台 占位符',
    '不答「你是谁」只打招呼',
    '刷到你抖音/视频/动态（除非对话里真提过）',
    '没事/随便聊聊/就想认识一下（她问事由时）',
    '别急着拉黑我',
    '反问她/装熟/施压/查户口',
    '长篇解释加好友目的',
  ],
  styleHints: {
    自然: '生活化答点：例：同群加的，别紧张',
    暧昧: '轻撩答点：例：以后聊天框会眼熟的那位',
    高冷: '极简答点：例：同群加的，小明',
    奶狗: '软软答点：例：加上啦，我小明呀',
    爹系: '笃定答点：例：记住了，同群加的',
    痞帅: '坏笑答点：例：哈哈查户口啊，同群那位',
  },
  goodVibe: [
    '每条先回应她的质问/核验点',
    '12～28 字，一句说完',
    '4 条角度互不相同：拆招/安抚/极简/打趣，禁止都复述「我是昨晚加的」',
    '有真实线索就用，没有就模糊自然表述，禁止 XX',
  ],
};

const SCENE_GUIDES: Partial<Record<ChatSceneId, SceneReplyGuide>> = {
  first_add: FIRST_ADD_GUIDE,
  cold_chat: {
    situation: '聊天冷场，需要自然续话题',
    goal: '抛一个轻松好接的话题，别尬聊',
    mustAvoid: ['在吗', '忙吗', '怎么不回', '查户口式连环问'],
    styleHints: { 痞帅: '接上一句或自嘲冷场，例：突然不知道说啥了' },
    goodVibe: ['接上文', '开放式但好答'],
  },
  closer: {
    situation: '想拉近距离，关系已有基础',
    goal: '走心或适度暧昧，让她觉得被理解',
    mustAvoid: ['土味情话', '过早表白', '长篇大论'],
    styleHints: { 自然: '分享感受或共鸣，例：跟你聊天挺舒服的' },
    goodVibe: ['真诚', '留回复空间'],
  },
  invite: {
    situation: '想约见面',
    goal: '具体但不施压的邀约',
    mustAvoid: ['什么时候有空', '赏个脸', '必须来'],
    styleHints: { 暧昧: '例：周末有空的话，想请你喝杯咖啡' },
    goodVibe: ['具体时间/活动', '可拒绝的语气'],
  },
};

const DEFAULT_GUIDE: SceneReplyGuide = {
  situation: '日常私信聊天',
  goal: '口语自然、精准接话、可复制发送',
  mustAvoid: ['刷到你抖音/视频', '摄影爱好者', '咨询小问题', '客服套话'],
  styleHints: {},
  goodVibe: ['8～28字', '像真人随手打'],
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
  options?: { identityVerify?: boolean; tonePreference?: string }
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

  const toneBlock = buildToneModifierBlock(toneModifiers, options?.tonePreference);
  const openingExtra =
    !options?.identityVerify && (sceneId === 'first_add' || !sceneId)
      ? `\n【开场铁律】禁止「我是来认识你的/想认真聊聊/我是刚加你的/自报家门」；用好奇+细节+共鸣；5 条气质必须拉开。`
      : '';

  return `【情境】${guide.situation}
【目标】${guide.goal}
${scene ? `【场景】${scene.label}：${scene.prompt}` : ''}${openingExtra}
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

/** 开场废句：自我介绍 / 目的宣告 / 刚加说明腔 */
export function lineLooksLikeNameDumpOpening(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // 我叫阿宁，刚通过… / 我是刚加你的…
  if (/^我(叫|是)/.test(t) && /刚(通过|加)|认识你|打招呼|聊聊|好友/.test(t)) return true;
  if (/我是来认识你/.test(t)) return true;
  if (/来认识你的?/.test(t)) return true;
  if (/我是刚加你的/.test(t)) return true;
  if (/刚加你的那位/.test(t)) return true;
  if (/刚通过你(的)?好友/.test(t)) return true;
  if (/刚通过你这边/.test(t)) return true;
  if (/自报家门/.test(t)) return true;
  if (/荣幸认识|幸会/.test(t)) return true;
  if (/想认真聊/.test(t)) return true;
  if (/正式认识一下/.test(t)) return true;
  if (/刚加你(想|来)?打个招呼/.test(t)) return true;
  if (/别急着拉黑/.test(t)) return true;
  // 「我，刚通过…」残句
  if (/^我[，,]\s*刚通过/.test(t)) return true;
  return false;
}

/** 开场/场景话术低质量检测 */
export function lineLooksLikeOpeningCringe(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (lineLooksLikePlaceholder(t)) return true;
  if (lineLooksLikeNameDumpOpening(t)) return true;
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
    /荣幸认识/,
    /幸会/,
    /想打个招呼/,
    /来打个招呼/,
    /想认识一下/,
    /认识一下你/,
    /想认识你/,
  ];
  return patterns.some((p) => p.test(t));
}

export function scoreSceneReplies(
  replies: { content: string }[],
  toneModifiers: ToneModifierId[] = []
): number {
  const lengthCap = getReplyLengthCap(toneModifiers);
  let score = 0;
  let nameDump = 0;
  for (const r of replies) {
    if (lineLooksLikeOpeningCringe(r.content)) score += 15;
    if (lineLooksLikeNameDumpOpening(r.content)) {
      score += 20;
      nameDump += 1;
    }
    if (r.content.length > lengthCap) score += 8;
    if (r.content.length > lengthCap + 6) score += 5;
    if (/^[你您]好[，,]?$/.test(r.content)) score += 10;
  }
  if (nameDump >= 2) score += 25;
  const starts = replies.map((r) => r.content.slice(0, 2));
  if (new Set(starts).size < starts.length) score += 8;
  // 骨架同质：多条都以「我叫/我是」开头
  const selfIntro = replies.filter((r) => /^我(叫|是)/.test(r.content.trim())).length;
  if (selfIntro >= 2) score += 20;
  return score;
}
