import type { AnalysisResult, ChatMessage, UserSettings } from '../types';
import { getMessageContentForAnalysis } from './targetedReply';
import { getActivePartner } from '../services/partnerArchiveService';

const MAX_MEMORY_LINES = 30;
const MAX_LINE_LEN = 80;

function normalizeMemoryLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 解析记忆文本为行列表 */
export function parseMemoryLines(details: string): string[] {
  return details
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** 合并记忆行（去重，保留顺序） */
export function mergeMemoryLines(existing: string, additions: string[]): string {
  const lines = [...parseMemoryLines(existing)];
  const seen = new Set(lines.map(normalizeMemoryLine));

  for (const raw of additions) {
    const line = raw.trim().slice(0, MAX_LINE_LEN);
    if (!line || line.length < 2) continue;
    const key = normalizeMemoryLine(line);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }

  return lines.slice(0, MAX_MEMORY_LINES).join('\n');
}

const OTHER_MESSAGE_PATTERNS: Array<{ re: RegExp; pick: (m: RegExpMatchArray) => string }> = [
  { re: /不(?:爱|喜)吃([^，。！？\n]{1,12})/, pick: (m) => `不爱吃${m[1].trim()}` },
  { re: /不(?:爱|喜)欢([^，。！？\n]{1,12})/, pick: (m) => `不喜欢${m[1].trim()}` },
  { re: /(?:讨厌|忌)([^，。！？\n]{1,12})/, pick: (m) => `讨厌${m[1].trim()}` },
  { re: /(?:喜欢|爱吃)([^，。！？\n]{1,12})/, pick: (m) => `喜欢${m[1].trim()}` },
  { re: /(?:下周|明天|后天|周末)([^，。！？\n]{0,16})/, pick: (m) => `${m[0].trim()}` },
  { re: /(?:要|得|准备)(?:去)?考试/, pick: () => '近期有考试' },
  { re: /(?:养|有)(?:了)?(?:一|两|三)?(?:只|条|个)?(猫|狗|宠物)/, pick: (m) => `有${m[1]}` },
  { re: /生日(?:是|在)([^，。！？\n]{1,10})/, pick: (m) => `生日${m[1].trim()}` },
  { re: /在(?:做|干|忙)([^，。！？\n]{1,12})/, pick: (m) => `在做${m[1].trim()}` },
];

/** 从对方消息中提取可长期记住的细节 */
export function extractMemoryFromMessages(
  messages: ChatMessage[],
  settings: UserSettings
): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();

  const push = (line: string) => {
    const trimmed = line.trim().slice(0, MAX_LINE_LEN);
    const key = normalizeMemoryLine(trimmed);
    if (!trimmed || trimmed.length < 2 || seen.has(key)) return;
    seen.add(key);
    hints.push(trimmed);
  };

  for (const msg of messages) {
    if (msg.role !== 'other' || !msg.content?.trim()) continue;
    const core = getMessageContentForAnalysis(msg.content);
    for (const { re, pick } of OTHER_MESSAGE_PATTERNS) {
      const m = core.match(re);
      if (m) push(pick(m));
    }
  }

  void settings;
  return hints;
}

/** 从分析结果提取可写入记忆的点 */
export function extractMemoryFromAnalysis(
  analysis: AnalysisResult | Omit<AnalysisResult, 'replies' | 'topReplies'>
): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();

  const push = (line: string) => {
    const trimmed = line.trim().slice(0, MAX_LINE_LEN);
    const key = normalizeMemoryLine(trimmed);
    if (!trimmed || trimmed.length < 2 || seen.has(key)) return;
    seen.add(key);
    hints.push(trimmed);
  };

  const subtext = analysis.psychology?.subtext?.trim();
  if (subtext && subtext.length >= 4 && subtext.length <= 40) {
    push(`潜台词：${subtext}`);
  }

  const needs = analysis.femalePsychology?.coreNeeds;
  if (Array.isArray(needs)) {
    for (const n of needs) {
      const s = String(n).trim();
      if (s.length >= 2) push(`她需要：${s}`);
    }
  }

  const tip = analysis.femalePsychology?.scenarioTip?.trim();
  if (tip && tip.length >= 4 && tip.length <= 20 && !/回应|正面|接住/.test(tip)) {
    push(`当前方向：${tip}`);
  }

  for (const moment of analysis.keyMoments ?? []) {
    const label = moment.label?.trim();
    const meaning = moment.meaning?.trim();
    if (label && meaning) push(`${label}：${meaning}`);
    else if (label) push(label);
  }

  return hints;
}

/** 分析/对话后自动合并进 partnerMemory */
export function buildUpdatedPartnerMemory(
  settings: UserSettings,
  messages: ChatMessage[],
  analysis?: AnalysisResult | Omit<AnalysisResult, 'replies' | 'topReplies'> | null
): { details: string; updatedAt: number } | null {
  const fromMessages = extractMemoryFromMessages(messages, settings);
  const fromAnalysis = analysis ? extractMemoryFromAnalysis(analysis) : [];
  const merged = mergeMemoryLines(settings.partnerMemory?.details ?? '', [
    ...fromMessages,
    ...fromAnalysis,
  ]);

  if (merged === (settings.partnerMemory?.details ?? '')) return null;
  return { details: merged, updatedAt: Date.now() };
}

/** 供 AI 使用的聊天记忆上下文块 */
export function buildChatMemoryBlock(
  settings: UserSettings,
  messages: ChatMessage[] = []
): string {
  const lines = parseMemoryLines(settings.partnerMemory?.details ?? '');
  const parts: string[] = [];

  if (lines.length) {
    parts.push(
      `【聊天记忆 · 跨轮次保留，合适时机自然提及】\n${lines.map((l) => `- ${l}`).join('\n')}`
    );
  }

  try {
    const active = getActivePartner();
    const tags = active?.tags?.filter(Boolean) ?? [];
    const kws = active?.interestKeywords?.filter(Boolean) ?? [];
    if (tags.length || kws.length) {
      const bits: string[] = [];
      if (tags.length) bits.push(`标签：${tags.join('、')}`);
      if (kws.length) bits.push(`兴趣关键词：${kws.slice(0, 12).join('、')}`);
      parts.push(`【联系人档案 · 须关联此人，勿串到别人】\n- ${bits.join('\n- ')}`);
    }
  } catch {
    /* SSR / 无 localStorage */
  }

  const recentOther = messages
    .filter((m) => m.role === 'other' && m.content?.trim())
    .slice(-3)
    .map((m) => getMessageContentForAnalysis(m.content).trim())
    .filter(Boolean);

  if (recentOther.length) {
    parts.push(
      `【近期对方发言 · 须接上文】\n${recentOther.map((l) => `- ${l.slice(0, 60)}`).join('\n')}`
    );
  }

  return parts.join('\n\n');
}
