/**
 * 私信话术风格模板（暧昧 14 · 日常 14 · 越界专项 14）
 */

import type { ReplyCategory, UserSettings } from '../types';
import {
  isIntimateBoundaryMessage,
} from './promptTemplates';
import {
  CORE_EIGHT_STYLES,
  orderCoreStylesByScene,
  buildPrimaryStyleVariants,
  isValidCoreStyleId,
  STYLE_ANGLE_HINTS,
  type CoreStyleId,
} from './coreReplyStyles';
import { REPLY_LENGTH_RULE } from './replyStyleConstants';

export const REPLY_PLATFORM_SCENE =
  '抖音 快手 微信 小红书等其他社交平台私信暧昧聊天';

export const REPLY_THINKING_BAN =
  '绝对禁止：我想想、让我思考、我觉得、分析一下、应该是、可能吧';

export { REPLY_LENGTH_RULE } from './replyStyleConstants';

export interface ReplyStyleDefinition {
  category: ReplyCategory;
  label: string;
  brief: string;
  styleRequirements: string;
  mode: 'flirt' | 'daily' | 'intimate';
}

function flirtReq(extra: string): string {
  return `语气自然、口语化、接地气，像真人聊天。${extra}。${REPLY_LENGTH_RULE}`;
}

function dailyReq(extra: string): string {
  return `${extra}，适合全平台日常聊天。${REPLY_LENGTH_RULE}`;
}

/** 暧昧私信 14 风格（默认） */
export const FLIRT_REPLY_STYLES: ReplyStyleDefinition[] = [
  { category: 'doting', label: '温柔撒娇', brief: '软甜撒娇', mode: 'flirt', styleRequirements: flirtReq('语气软、甜、轻微撒娇，自然不油腻') },
  { category: 'playful', label: '俏皮可爱', brief: '活泼调皮', mode: 'flirt', styleRequirements: flirtReq('活泼、有点小调皮') },
  { category: 'coolFrame', label: '高冷撩人', brief: '话少勾人', mode: 'flirt', styleRequirements: flirtReq('话少、带点距离感、又有点勾人') },
  { category: 'warmCare', label: '温柔安抚', brief: '体贴舒服', mode: 'flirt', styleRequirements: flirtReq('温柔、体贴、让人舒服') },
  { category: 'pushPull', label: '暧昧拉扯', brief: '留想象空间', mode: 'flirt', styleRequirements: flirtReq('不主动不拒绝，留想象空间') },
  { category: 'clearAttitude', label: '直球进攻', brief: '直接大胆', mode: 'flirt', styleRequirements: flirtReq('直接、大胆、不绕弯') },
  { category: 'lightHumor', label: '幽默调侃', brief: '轻松玩笑', mode: 'flirt', styleRequirements: flirtReq('轻松搞笑、带点小玩笑') },
  { category: 'steadyMature', label: '成熟稳重', brief: '大气靠谱', mode: 'flirt', styleRequirements: flirtReq('大气、靠谱、不幼稚') },
  { category: 'catMouse', label: '欲擒故纵', brief: '若即若离', mode: 'flirt', styleRequirements: flirtReq('若即若离、勾起好奇') },
  { category: 'gentleWarm', label: '温柔体贴', brief: '暖心细心', mode: 'flirt', styleRequirements: flirtReq('暖心、细心、会照顾人情绪') },
  { category: 'flirtInteract', label: '小坏痞帅', brief: '坏撩不油', mode: 'flirt', styleRequirements: flirtReq('有点坏、有点撩、不油腻') },
  { category: 'deepHeart', label: '文艺深情', brief: '有质感', mode: 'flirt', styleRequirements: flirtReq('温柔有质感、不土味') },
  { category: 'easyCompanion', label: '轻松随意', brief: '像朋友聊', mode: 'flirt', styleRequirements: flirtReq('像朋友聊天、自然不刻意') },
  { category: 'openEnd', label: '神秘诱惑', brief: '氛围感', mode: 'flirt', styleRequirements: flirtReq('话少、有氛围感、引人遐想') },
];

/** 日常社交 14 风格 */
export const DAILY_REPLY_STYLES: ReplyStyleDefinition[] = [
  { category: 'gentleWarm', label: '礼貌友好', brief: '自然礼貌', mode: 'daily', styleRequirements: dailyReq('语气自然礼貌、不暧昧、不生硬') },
  { category: 'easyCompanion', label: '轻松随和', brief: '随意自然', mode: 'daily', styleRequirements: dailyReq('语气随意自然、不尴尬不刻意') },
  { category: 'playful', label: '热情活泼', brief: '积极有活力', mode: 'daily', styleRequirements: dailyReq('语气积极有活力、不油腻') },
  { category: 'warmCare', label: '温柔暖心', brief: '温柔舒服', mode: 'daily', styleRequirements: dailyReq('语气温柔舒服、让人有好感') },
  { category: 'lightHumor', label: '幽默风趣', brief: '轻松搞笑', mode: 'daily', styleRequirements: dailyReq('语气轻松搞笑、不低俗') },
  { category: 'coolFrame', label: '简洁高冷', brief: '简短干净', mode: 'daily', styleRequirements: dailyReq('语气简短干净、不热情不敷衍') },
  { category: 'clearAttitude', label: '真诚实在', brief: '朴实真诚', mode: 'daily', styleRequirements: dailyReq('语气朴实真诚、不套路') },
  { category: 'doting', label: '俏皮可爱', brief: '灵动可爱', mode: 'daily', styleRequirements: dailyReq('语气灵动可爱、不幼稚') },
  { category: 'rationalSteady', label: '理性客观', brief: '理智平和', mode: 'daily', styleRequirements: dailyReq('语气理智平和、不情绪化') },
  { category: 'easyLanding', label: '佛系淡定', brief: '从容淡然', mode: 'daily', styleRequirements: dailyReq('语气从容淡然、不急躁') },
  { category: 'detailInteract', label: '捧场夸赞', brief: '真诚夸奖', mode: 'daily', styleRequirements: dailyReq('语气真诚夸奖、不虚伪奉承') },
  { category: 'concise', label: '委婉回避', brief: '温和礼貌', mode: 'daily', styleRequirements: dailyReq('语气温和礼貌、不伤人不尴尬') },
  { category: 'colloquialSnap', label: '接地气实在', brief: '口语化', mode: 'daily', styleRequirements: dailyReq('语气口语化、像普通人聊天') },
  { category: 'steadyMature', label: '成熟稳重', brief: '大方得体', mode: 'daily', styleRequirements: dailyReq('语气大方得体、不轻浮') },
];

/** 「我想睡你」越界专项 14 风格 */
export const INTIMATE_REPLY_STYLES: ReplyStyleDefinition[] = [
  { category: 'pushPull', label: '俏皮拉扯', brief: '暧昧试探', mode: 'intimate', styleRequirements: flirtReq('试探调情，升温不越界，可推拉留悬念') },
  { category: 'lightHumor', label: '幽默划界', brief: '暧昧划界', mode: 'intimate', styleRequirements: flirtReq('接住暧昧，幽默划界，不猥琐') },
  { category: 'gentleWarm', label: '温柔引导', brief: '暧昧引导', mode: 'intimate', styleRequirements: flirtReq('温柔回应好感，明确节奏不越界') },
  { category: 'doting', label: '宠溺回应', brief: '热恋亲密', mode: 'intimate', styleRequirements: flirtReq('亲密撒娇，拉满安全感') },
  { category: 'playful', label: '俏皮互动', brief: '热恋互动', mode: 'intimate', styleRequirements: flirtReq('用小互动延续甜蜜') },
  { category: 'deepHeart', label: '异地专属', brief: '热恋异地', mode: 'intimate', styleRequirements: flirtReq('化解距离感，温柔亲密') },
  { category: 'lightHumor', label: '幽默打岔', brief: '温和划界', mode: 'intimate', styleRequirements: flirtReq('假装误会，轻松划清边界') },
  { category: 'steadyMature', label: '礼貌终止', brief: '温和终止', mode: 'intimate', styleRequirements: flirtReq('明确不适，礼貌结束话题') },
  { category: 'clearAttitude', label: '直接拒绝', brief: '坚定划界', mode: 'intimate', styleRequirements: flirtReq('态度坚定，避免纠缠') },
  { category: 'coolFrame', label: '冷静划界', brief: '严肃止损', mode: 'intimate', styleRequirements: flirtReq('清晰亮底线，不拖泥带水') },
  { category: 'minimalDirect', label: '直接终止', brief: '严肃止损', mode: 'intimate', styleRequirements: flirtReq('不接话茬，用行动表明拒绝') },
  { category: 'warmCare', label: '温柔安抚', brief: '缓冲氛围', mode: 'intimate', styleRequirements: flirtReq('若需缓冲，温柔但不给暧昧空间') },
  { category: 'rationalSteady', label: '成熟稳重', brief: '成年人边界', mode: 'intimate', styleRequirements: flirtReq('大方得体，守住边界') },
  { category: 'easyCompanion', label: '轻松转移', brief: '转移话题', mode: 'intimate', styleRequirements: flirtReq('自然转移话题，不尴尬') },
];

export const FLIRT_GROUP_HEADERS = [
  { index: 0, title: '一、软萌互动', subtitle: '撒娇 · 俏皮' },
  { index: 2, title: '二、撩拨张力', subtitle: '高冷 · 安抚 · 拉扯' },
  { index: 5, title: '三、直给表达', subtitle: '直球 · 幽默 · 成熟 · 欲擒故纵' },
  { index: 9, title: '四、气质氛围', subtitle: '体贴 · 痞帅 · 文艺 · 随意 · 神秘' },
] as const;

export const DAILY_GROUP_HEADERS = [
  { index: 0, title: '一、基础日常', subtitle: '礼貌 · 随和 · 热情 · 暖心' },
  { index: 4, title: '二、轻松表达', subtitle: '幽默 · 高冷 · 真诚 · 可爱' },
  { index: 8, title: '三、理性从容', subtitle: '理性 · 佛系 · 夸赞 · 回避' },
  { index: 12, title: '四、实在稳重', subtitle: '接地气 · 成熟' },
] as const;

export const INTIMATE_GROUP_HEADERS = [
  { index: 0, title: '一、暧昧试探', subtitle: '拉扯 · 划界 · 引导' },
  { index: 3, title: '二、热恋亲密', subtitle: '宠溺 · 互动 · 异地' },
  { index: 6, title: '三、温和划界', subtitle: '打岔 · 终止 · 拒绝' },
  { index: 9, title: '四、严肃止损', subtitle: '划界 · 终止 · 缓冲' },
  { index: 11, title: '五、后续处理', subtitle: '安抚 · 稳重 · 转移' },
] as const;

const FLIRT_STAGES = new Set([
  '暧昧',
  '热恋',
  '冷战',
  '挽回',
  '暧昧阶段',
  '升温阶段',
  '亲密阶段',
  '确定关系',
]);
const FIRST_MEET_STAGES = new Set(['陌生', '初识', '初识阶段']);

/** 4 条精准话术分组（话术区 UI · 多套差异化方案） */
export const CORE_EIGHT_GROUP_HEADERS = [
  { index: 0, title: '多套方案', subtitle: '差异化 · 3 条，不满意就看下一条' },
  { index: 3, title: '智能推荐', subtitle: '综合上面优选 · 更建议发这条' },
] as const;

/** 单次分析实际生成的话术条数（4 种可选风格） */
export const GENERATION_REPLY_COUNT = 4;

export function resolveReplyStyles(
  settings: UserSettings,
  lastOtherRaw: string
): ReplyStyleDefinition[] {
  if (isIntimateBoundaryMessage(lastOtherRaw)) {
    return INTIMATE_REPLY_STYLES;
  }
  const stages = settings.relationshipStages ?? [];
  const onlyFirstMeet =
    stages.length > 0 && stages.every((s) => FIRST_MEET_STAGES.has(s));
  if (onlyFirstMeet) {
    return DAILY_REPLY_STYLES;
  }
  const hasFlirt = stages.some((s) => FLIRT_STAGES.has(s));
  if (hasFlirt || stages.length === 0) {
    return FLIRT_REPLY_STYLES;
  }
  return DAILY_REPLY_STYLES;
}

/** 从风格集选取 4 条用于 AI 生成（精准接对方最后一句） */
export function pickStylesForGeneration(
  styles: ReplyStyleDefinition[],
  settings?: Pick<UserSettings, 'chatScene' | 'primaryReplyStyle'>
): ReplyStyleDefinition[] {
  // 主风格锁定：同人设 5 变体，气质统一
  if (settings?.primaryReplyStyle && isValidCoreStyleId(settings.primaryReplyStyle)) {
    return buildPrimaryStyleVariants(settings.primaryReplyStyle as CoreStyleId);
  }

  if (styles === INTIMATE_REPLY_STYLES || styles[0]?.mode === 'intimate') {
    const step = styles.length / GENERATION_REPLY_COUNT;
    const picked: ReplyStyleDefinition[] = [];
    for (let i = 0; i < GENERATION_REPLY_COUNT; i++) {
      picked.push(styles[Math.min(Math.floor(i * step), styles.length - 1)]);
    }
    return picked;
  }

  return orderCoreStylesByScene(settings?.chatScene).slice(0, GENERATION_REPLY_COUNT);
}

export function resolveReplyGroupHeaders(styles: ReplyStyleDefinition[]) {
  const mode = styles[0]?.mode ?? 'flirt';
  if (mode === 'daily') return DAILY_GROUP_HEADERS;
  if (mode === 'intimate') return INTIMATE_GROUP_HEADERS;
  const coreLabels = new Set(CORE_EIGHT_STYLES.map((s) => s.label));
  if (
    styles.length === GENERATION_REPLY_COUNT &&
    styles.every((s) => coreLabels.has(s.label))
  ) {
    // 主风格锁定：4 条同标签
    if (styles.every((s) => s.label === styles[0].label)) {
      return [
        {
          index: 0,
          title: `主风格 · ${styles[0].label}`,
          subtitle: '同人设 5 变体 · 可微调语气',
        },
      ] as const;
    }
    return CORE_EIGHT_GROUP_HEADERS;
  }
  return FLIRT_GROUP_HEADERS;
}

export function buildBatchStylePromptBlock(styles: ReplyStyleDefinition[]): string {
  const sameStyle = styles.length > 1 && styles.every((s) => s.label === styles[0].label);
  const styleLines = styles
    .map((s, i) => {
      const angle = STYLE_ANGLE_HINTS[s.label] ?? `角度须与第${i + 1}条独特`;
      return `${i + 1}.【${s.label}】${s.brief} — ${angle}；须正面回应她最后一句`;
    })
    .join('\n');

  if (sameStyle) {
    return `【${styles.length} 条同风格话术 · 统一人设「${styles[0].label}」· 角度必须互不相同】
${styleLines}

【人设铁律】
- 全部必须是「${styles[0].label}」气质，禁止串到其他风格
- 每条切入角度、信息落点、开头词都不同；禁止换皮同句
- 像正常男生随手回；先接她的话；禁止大道理与模板句
- 禁止：客套卑微、查户口、土味情话、敷衍无落点、撒谎夸大
- 禁止套话：刷到你抖音/视频/动态、摄影爱好者、咨询小问题、加个微信慢慢说
- 禁止编造她没提过的事

【输出】恰好 ${styles.length} 行，每行 ONLY 一句 10～20 字口语，无编号、无【】标签、无解释`;
  }

  return `【${styles.length} 条多套方案 · 内容/风格/角度必须明显不同】
${styleLines}

【差异化铁律】
- 像正常男生随手回：口语、简短、不装、不套路；先接她的话
- 至少 3 条独立成案：信息点或切入角度不同，用户可直接选下一条，无需重问
- 禁止换皮同句（禁止都写「我是昨晚加你的」只改语气词）
- 禁止：客套卑微、查户口、土味情话、敷衍无落点、撒谎夸大、大道理、模板句
- 禁止套话：刷到你抖音/视频/动态、摄影爱好者、咨询小问题、加个微信慢慢说
- 禁止编造她没提过的事（探店/合作/店铺等）

【输出】恰好 ${styles.length} 行，每行 ONLY 一句 10～20 字口语，无编号、无【】标签、无解释`;
}

export const REPLY_BATCH_OUTPUT_RULES = `【批次输出铁律 · 4 条精准话术】
- 恰好输出对应行数，每行 ONLY 一句可复制发送的口语原话
- 像正常男生随手回：先接对方原话，禁止答非所问、禁止套话与大道理
- 按更好发、更好接从高到低排列
- 严禁整行出现：例如、比如、表明来意、注意每条、风格名、第N条、思考过程
- ${REPLY_LENGTH_RULE}
- ${REPLY_THINKING_BAN}`;

export const REPLY_STYLE_MODE_HINT =
  '可选风格：自然 / 暧昧 / 高冷 / 奶狗 / 爹系 / 痞帅。真实自然男生口吻，每条一句话。';

/** Header / 设置页 · 话术风格说明 */
export const REPLY_STYLE_HEADER_TAGLINE =
  '灵焰多风格话术 · 六种实战口吻随时切换';
