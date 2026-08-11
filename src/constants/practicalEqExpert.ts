/**
 * 实战派恋爱沟通专家框架
 * 依据：戈特曼（情绪接纳/修复）、情绪共情、依恋安全基地，以及大量恋爱私信实战
 */

import type { AnalysisResult } from '../types';
import type { ChatSceneId } from './coreReplyStyles';

/** 四大实战场景 */
export type PracticalScene = '破冰' | '暧昧' | '热恋' | '矛盾';

/** 话术公式类型 */
export type PracticalFormula = '开场白' | '共情' | '赞美' | '修复';

export const PRACTICAL_FORMULA_HINT: Record<PracticalFormula, string> = {
  开场白: '好奇 + 细节 + 共鸣（点出具体点，再轻轻靠近）',
  共情: '描述感受 + 认可 + 引导（先接住情绪，再给轻松出口）',
  赞美: '细节 + 特质 + 反差（夸具体行为/气质，避免空夸漂亮）',
  修复: '情绪标注 + 道歉 + 请求（点名情绪、认一点错、提一个小请求）',
};

/** 场景分寸（内化进口语，禁止攻略腔外露） */
export const PRACTICAL_EQ_EXPERT_DIRECTIVE = `【聊天分寸 · 内化勿外露】
发声必须是真实自然男生：口语、简短、不装、不油腻；每条一句话约10～20字；只输出回复，不解释不标注。
分寸随场景走（破冰/暧昧/热恋/矛盾），可悄悄用这些感觉，但禁止写成提纲：
· 破冰：好奇+一点细节
· 暧昧：轻松靠近一点，不表白
· 热恋：接情绪、暖一点
· 矛盾：先认情绪，再轻轻表态
输出 3～5 条，按更好发更好接排序。禁止敏感、低俗、冒犯、PUA。`;

/** 关系阶段 / 聊天场景 → 实战场景 */
export function resolvePracticalScene(
  stages: string[] = [],
  chatScene?: string,
  emotionPrimary?: string
): PracticalScene {
  const stage = (stages[0] || '').trim();
  const emo = (emotionPrimary || '').trim();

  if (
    chatScene === 'angry' ||
    chatScene === 'make_up' ||
    /冷战|挽回/.test(stage) ||
    /生气|愤怒|失望|委屈|难过|抵触/.test(emo)
  ) {
    return '矛盾';
  }
  if (chatScene === 'first_add' || chatScene === 'cold_chat' || /陌生|初识/.test(stage)) {
    return '破冰';
  }
  if (/热恋/.test(stage) || chatScene === 'invite') {
    return '热恋';
  }
  if (
    chatScene === 'closer' ||
    chatScene === 'test_feelings' ||
    /暧昧/.test(stage) ||
    !stage
  ) {
    return '暧昧';
  }
  return '暧昧';
}

/** 实战场景 → 优先公式（主+辅） */
export function formulasForPracticalScene(scene: PracticalScene): PracticalFormula[] {
  switch (scene) {
    case '破冰':
      return ['开场白', '赞美'];
    case '暧昧':
      return ['开场白', '赞美', '共情'];
    case '热恋':
      return ['共情', '赞美'];
    case '矛盾':
      return ['修复', '共情'];
    default:
      return ['开场白', '共情'];
  }
}

/** 注入 user 上下文的实战块 */
export function buildPracticalEqBlock(input: {
  stages?: string[];
  chatScene?: string;
  emotionPrimary?: string;
  emotionSecondary?: string;
  subtext?: string;
  analysisSummary?: string;
}): string {
  const scene = resolvePracticalScene(
    input.stages,
    input.chatScene,
    input.emotionPrimary
  );
  const formulas = formulasForPracticalScene(scene);
  const emoBits = [input.emotionPrimary, input.emotionSecondary].filter(Boolean).join(' / ');

  // 热路径压缩：保留场景+主公式即可，细则已在 COMPACT_REPLY
  return `【实战·${scene}】阶段:${(input.stages || []).join('、') || '未标注'}；情绪:${emoBits || '看原话'}
主公式:${formulas[0]}（${PRACTICAL_FORMULA_HINT[formulas[0]]}）${formulas[1] ? `；辅:${formulas[1]}` : ''}
口语10～20字，更好发更好接。${input.subtext ? `潜台词:${input.subtext}` : ''}`;
}

/** 从分析结果构建实战块 */
export function buildPracticalEqBlockFromAnalysis(
  analysis: Omit<AnalysisResult, 'replies' | 'topReplies'>,
  stages: string[] = [],
  chatScene?: string
): string {
  return buildPracticalEqBlock({
    stages: stages.length
      ? stages
      : analysis.psychology?.relationshipStage
        ? [analysis.psychology.relationshipStage]
        : analysis.relationshipMetrics?.stage
          ? [analysis.relationshipMetrics.stage]
          : [],
    chatScene: chatScene as ChatSceneId | undefined,
    emotionPrimary: analysis.emotion?.primary,
    emotionSecondary: analysis.emotion?.secondary,
    subtext: analysis.psychology?.subtext,
    analysisSummary: analysis.summary,
  });
}

/**
 * 实战可发送性粗评分（越高越好）
 * 用于前端对候选重排：具体、有落点、非模板
 */
export function scorePracticalReply(
  content: string,
  practicalScene?: PracticalScene,
  opts?: { identityVerify?: boolean }
): number {
  const t = content.trim();
  if (!t) return -100;
  let score = 10;
  const identityVerify = Boolean(opts?.identityVerify);

  // 长度适中（目标 10～20 字）
  if (t.length >= 10 && t.length <= 20) score += 10;
  else if (t.length >= 8 && t.length <= 22) score += 5;
  else if (t.length < 6 || t.length > 28) score -= 12;

  // 具体/画面感线索
  if (/头像|那条|刚才|今天|晚上|周末|咖啡|天气|签名|这句|刚才说/.test(t)) score += 6;
  if (/哈哈|嗯|行|可以|回头|慢慢/.test(t)) score += 2;

  // 公式痕迹（轻量加分，不要求字面）
  if (practicalScene === '矛盾') {
    if (/是我|抱歉|对不起|让你|不舒服|生气|烦/.test(t)) score += 8;
    if (/能不能|方便|我们|下次/.test(t)) score += 4;
  }
  if (practicalScene === '破冰' || practicalScene === '暧昧') {
    if (/想|挺|有点|认识|聊聊/.test(t)) score += 3;
  }

  if (identityVerify) {
    // 她在核实身份：答「我是/同群/看到」加分；空接「嗯然后呢」重罚
    if (/我(是|叫)|同群|朋友|看到|加上|来源|群里|抖音/.test(t)) score += 18;
    if (/嗯，?然后呢|这样啊，你怎么看|没事|随便聊聊/.test(t)) score -= 40;
  } else {
    // 惩罚模板/油腻/自我介绍腔/目的宣告（未问身份时）
    if (/我叫|我是.{0,8}刚|打个招呼|别急着拉黑|刷到你|小姐姐|宝贝/.test(t)) score -= 25;
    if (/来认识你|刚加你的|自报家门|想认真聊|刚通过你/.test(t)) score -= 30;
  }
  if (/终于等到|多多关照|请多指教|很高兴认识/.test(t)) score -= 15;
  if (/^哦$|^嗯$|^呵呵|^好的呢/.test(t)) score -= 20;
  // 通用垫句（去重补位用）降权，避免挤进「智能推荐」
  if (/行，那你怎么看|这么说我倒好奇了|嗯，然后呢|就这？还能再狠点|别这样嘛，再说两句|有事直说，我听着/.test(t)) {
    score -= 35;
  }
  // 抖音来源/具体落点加分（刚加好友常见）
  if (/抖音|视频|合眼缘|胃口|那条/.test(t)) score += 5;

  // 问句/语气词/落点（更好接话）
  if (/[？?～~]$/.test(t) || /吗|呢|呀$/.test(t)) score += 4;
  if (/哈哈|哦|嗯|呀|～/.test(t)) score += 3;
  // 把天聊死的收束句降分
  if (/^(收到|好的|嗯)$/.test(t) || (/不打扰|有空再说$/.test(t) && !/[？?]/.test(t))) {
    score -= 4;
  }
  if (/幸会|荣幸认识/.test(t)) score -= 30;
  if (!identityVerify && /自报家门/.test(t)) score -= 30;

  return score;
}

/** 按实战分排序（稳定：同分保序） */
export function rankRepliesByPracticalScore<T extends { content: string }>(
  replies: T[],
  practicalScene?: PracticalScene
): T[] {
  return replies
    .map((r, index) => ({ r, index, s: scorePracticalReply(r.content, practicalScene) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.r);
}
