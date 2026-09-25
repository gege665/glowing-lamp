import { getMessageContentForAnalysis, detectMessageIntent } from './targetedReply';
import { lineLooksLikeOpeningCringe } from '../constants/sceneReplyGuides';

/** 模型把任务说明/思考过程当话术输出 */
const REASONING_LEAK_PATTERNS = [
  /我现在要处理/,
  /首先得严格/,
  /严格按照要求/,
  /生成.*条/,
  /分别是.*风/,
  /对应.*风格/,
  /须输出.*行/,
  /本批次/,
  /用户(的)?请求/,
  /针对女生说的/,
  /接下来(我)?/,
  /让我(来)?/,
  /我需要/,
  /必须按照/,
  /顺序固定/,
  /不要写.*标签/,
  /第\s*\d+\s*[～~\-]\s*\d+\s*行/,
  /输出格式/,
  /潜台词读心风.*情绪先接风/,
  /温柔暖男风.*清醒/,
  /来回应一个/,
  /戒备心很强/,
  /抖音私信里/,
  /调整.*回复的?语气/,
  /第一个风格是/,
  /第四个风格/,
  /每个回复都要控制/,
  /可以直接复制/,
  /气质参考/,
  /风格顺序/,
];

/** 思考类词汇 · 短句也须拦截 */
const THINKING_WORD_PATTERNS = [
  /我想想/,
  /让我思考/,
  /我觉得/,
  /分析一下/,
  /应该是/,
  /可能吧/,
  /^场景：/,
  /^要求：/,
  /回复内容/,
  /风格标签/,
  /^好的，?用户/,
  /用户的问题是/,
  /^嗯，?需要/,
  /^对，?用户/,
];

/** 元说明/教学口吻（截图中的主要泄漏形态） */
const META_INSTRUCTION_PATTERNS = [
  /^第\s*\d+\s*条/,
  /例如[：:]/,
  /比如[：:]/,
  /表明来意/,
  /注意每条/,
  /的元素/,
  /不能太长/,
  /直接大胆/,
  /轻松搞笑/,
  /大气靠谱/,
  /暖心细心/,
  /质感标杆/,
  /参考句/,
  /若即若离/,
  /又酷又撩/,
  /俏皮夸张/,
  /目的是/,
  /既.*又.*保持/,
  /可以(用|说|只|先)/,
  /然后(说|用|接)/,
  /要(先|又|用)/,
  /第三条|第四条|第五条/,
  /Item\s*\d+/i,
  /条：.*风/,
  /\.{3}风/,
  /语气友好、不刻意/,
  /让她感觉/,
  /不能回避或者反问/,
  /^[\u4e00-\u9fa5]{2,12}[。．]\s*例如/,
];

// Natural-chat guardrails that are independent of the source file's legacy prompt encoding.
const HUMAN_CHAT_LEAK_PATTERNS = [
  /作为(?:一个)?AI|作为人工智能|语言模型|大模型/i,
  /高情商|情绪价值|拿捏|框架感|推拉|吸引力|价值感|段位|人设/,
  /可以(?:这样|这么)回复|建议(?:你|回复)|回复如下|参考答案|正确答案/,
  /分析一下|心理分析|说明一下|解释一下|希望对你有帮助/,
  /\b(?:JSON|Markdown|system|prompt|AI)\b/i,
  /^(?:首先|其次|最后|总之|综上|因此|另外)，?/,
  /^(?:我理解你的|听起来你|从你的话里可以看出|这说明你)/,
  /(?:希望你|你值得|你应该|不妨试试|建议你保持)/,
];

export function lineLooksLikeHumanChatLeak(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (HUMAN_CHAT_LEAK_PATTERNS.some((pattern) => pattern.test(t))) return true;
  if (/[A-Za-z]{3,}/.test(t)) return true;
  if ((t.match(/[😀-🙏🌀-🫶]/gu) ?? []).length > 2) return true;
  if (t.length > 24 && (t.match(/[，,]/g) ?? []).length >= 3) return true;
  if ((t.match(/[。！？!?]/g) ?? []).length >= 3) return true;
  return false;
}

export function lineLooksLikeMetaInstruction(line: string): boolean {
  const t = line.trim();
  if (t.length < 8) return false;
  if (META_INSTRUCTION_PATTERNS.some((p) => p.test(t))) return true;
  if (t.length > 28 && /风格|语气|策略|要求|比如|需要|可以|然后|接她/.test(t)) return true;
  return false;
}

/** 抖音私信/客服套话（单条命中即视为不合格） */
export const OFFICIAL_REPLY_PATTERNS = [
  /我是.*刷到/,
  /刷到你(抖音|视频|动态|作品|主页|号)/,
  /刷到.*抖音/,
  /刚刚刷到你/,
  /我是.*(路人|粉丝|普通粉丝)/,
  /摄影爱好者.*(找|咨询|想)/,
  /想请教/,
  /想了解/,
  /想确认/,
  /咨询.*小问题/,
  /不好意思.*打扰/,
  /没别的事/,
  /特意来找/,
  /有没有兴趣/,
  /认个.*大神/,
  /蹭眼熟/,
  /关于.*的事/,
  /店铺探店/,
  /探店内容/,
  /内容相关的小问题/,
  /就想打个招呼/,
  /不是打扰/,
  /随便聊两句/,
  /凑过来打招呼/,
  /不耽误你时间/,
  /就找你聊两句/,
  /就想跟你说句话/,
  /就想夸你/,
  /视频拍得挺好的/,
  /内容有意思/,
  /真没别的坏心思/,
  /加个微信慢慢说/,
  /终于等到你通过/,
  /差点以为.*手机/,
  /加你(好)?友就是为了/,
  /就是想多了解你/,
  /别嫌我烦/,
  /熟悉一下/,
  /随时找我/,
  /有想聊的话题/,
];

const OFF_TOPIC_GREETING_PATTERNS = [
  /就想打个招呼/,
  /不是打扰/,
  /随便聊两句/,
  /凑过来打招呼/,
  /没事.*就是加/,
  /就想认识/,
];

export { lineLooksLikeOpeningCringe } from '../constants/sceneReplyGuides';

export function splitReplyRawLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((l) => l && !l.startsWith('{') && !/"summary"\s*:/.test(l));
}

export function lineLooksLikeReasoningLeak(line: string): boolean {
  const t = line.trim();
  if (t.length < 2) return false;
  if (THINKING_WORD_PATTERNS.some((p) => p.test(t))) return true;
  if (lineLooksLikeMetaInstruction(t)) return true;
  if (t.length < 6) return false;
  if (REASONING_LEAK_PATTERNS.some((p) => p.test(t))) return true;
  if (t.length > 55 && /风.*风.*风/.test(t)) return true;
  if (/^\d+[.)]\s/.test(t) && /风格|批次|输出|生成/.test(t)) return true;
  return false;
}

export function lineLooksTooOfficial(line: string): boolean {
  return OFFICIAL_REPLY_PATTERNS.some((p) => p.test(line));
}

export function lineLooksOffTopic(line: string, lastOther: string): boolean {
  if (!lastOther.trim()) return false;
  const intent = detectMessageIntent(lastOther);
  const core = getMessageContentForAnalysis(lastOther);

  const fabricatedTopic =
    /店铺|探店|合作|内容相关/.test(line) && !/店铺|探店|合作|内容/.test(core);
  const hollowGreeting =
    (intent.asksIdentity || intent.asksPurpose) &&
    OFF_TOPIC_GREETING_PATTERNS.some((p) => p.test(line));
  const onlyDouyinTemplate =
    intent.asksIdentity && /刷到.*抖音/.test(line) && !/因为|觉得|看你|那条|叫|是[^的]/.test(line);
  const avoidsQuestion =
    intent.asksIdentity &&
    !/我|叫|是[^的]|通过|看到|昨天|刚才|抱歉|唐突|确实|说得对|陌生|问得/.test(line);

  return avoidsQuestion || hollowGreeting || onlyDouyinTemplate || fabricatedTopic;
}

export function isValidReplyLine(
  line: string,
  lastOther: string,
  options?: { openingMode?: boolean }
): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 55) return false;
  if (lineLooksLikeReasoningLeak(t)) return false;
  if (lineLooksLikeHumanChatLeak(t)) return false;
  if (lineLooksTooOfficial(t)) return false;
  if (options?.openingMode && lineLooksLikeOpeningCringe(t)) return false;
  if (lineLooksOffTopic(t, lastOther)) return false;
  return true;
}

export type ReplyQualityIssue = 'meta' | 'official' | 'offTopic';

export function detectBatchQualityIssues(raw: string, lastOther: string): ReplyQualityIssue[] {
  const lines = splitReplyRawLines(raw);
  if (!lines.length) return ['meta'];

  const issues: ReplyQualityIssue[] = [];
  const metaCount = lines.filter(lineLooksLikeReasoningLeak).length;
  const officialCount = lines.filter(lineLooksTooOfficial).length;
  const offTopicCount = lines.filter((l) => lineLooksOffTopic(l, lastOther)).length;

  if (metaCount > 0) issues.push('meta');
  if (officialCount >= Math.max(1, Math.ceil(lines.length * 0.2))) issues.push('official');
  if (offTopicCount >= Math.max(2, Math.ceil(lines.length * 0.35))) issues.push('offTopic');

  return issues;
}

/** 批次质量分，越低越好 */
export function scoreBatchQuality(raw: string, lastOther: string): number {
  const lines = splitReplyRawLines(raw);
  let score = 0;
  for (const line of lines) {
    if (lineLooksLikeReasoningLeak(line)) score += 20;
    if (lineLooksTooOfficial(line)) score += 8;
    if (lineLooksOffTopic(line, lastOther)) score += 6;
    if (line.length > 55) score += 10;
    if (line.length > 65) score += 2;
  }
  return score;
}

export function batchLooksTooOfficial(raw: string): boolean {
  const lines = splitReplyRawLines(raw);
  if (!lines.length) return false;
  const officialCount = lines.filter(lineLooksTooOfficial).length;
  return officialCount >= Math.max(1, Math.ceil(lines.length * 0.2));
}

export function batchLooksOffTopic(raw: string, lastOther: string): boolean {
  const lines = splitReplyRawLines(raw);
  if (!lines.length || !lastOther.trim()) return false;
  const offTopicCount = lines.filter((l) => lineLooksOffTopic(l, lastOther)).length;
  return offTopicCount >= Math.max(2, Math.ceil(lines.length * 0.35));
}
