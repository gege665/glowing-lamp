/**
 * 灵焰关系数据分析模式
 * 亲密度 · 好感趋势 · 聊天短板 · 沟通问题 · 氛围 · 升温策略 · 推进时机
 */
import type { AnalysisResult, ChatMessage, TemperaturePoint, UserSettings } from '../types';

export interface ChatMetrics {
  totalMessages: number;
  myCount: number;
  otherCount: number;
  myAvgLen: number;
  otherAvgLen: number;
  /** 对方短回复占比 0-100 */
  otherShortRatio: number;
  /** 我方话多程度：我方条数占比 0-100 */
  myTalkShare: number;
  /** 亲密度估算 0-100（本地） */
  intimacyEstimate: number;
  /** 好感趋势：上升 / 平稳 / 下降 / 数据不足 */
  favorTrend: '上升' | '平稳' | '下降' | '数据不足';
  favorTrendDetail: string;
  temperatureNow: number;
  stage: string;
  atmosphereHint: string;
  shortfalls: string[];
  communicationIssues: string[];
}

export interface RelationshipDataReport {
  /** 亲密度 0-100 */
  intimacy: number;
  /** 好感趋势说明 */
  favorTrend: string;
  /** 氛围状态 */
  atmosphere: string;
  /** 聊天短板 */
  shortfalls: string[];
  /** 沟通问题 */
  communicationIssues: string[];
  /** 升温策略（可落地） */
  warmUpStrategy: string[];
  /** 聊天改进方向 */
  improveDirections: string[];
  /** 最佳推进时机 */
  bestTiming: string;
  /** 下一步行动 */
  nextActions: string[];
  /** 报告摘要 */
  summary: string;
  /** 本地指标快照 */
  metrics: ChatMetrics;
  source: 'ai' | 'local';
  generatedAt: number;
}

export const LINGYAN_RELATIONSHIP_DATA_DIRECTIVE = `【灵焰关系数据分析模式】
基于【全部聊天记录】输出完整关系分析报告，必须包含：
亲密度(0-100)、好感趋势、聊天短板、沟通问题、氛围状态、
可落地升温策略、聊天改进方向、最佳推进时机、下一步行动建议。
结论要具体可执行，禁止空话「多沟通」「保持自然」。`;

export const RELATIONSHIP_REPORT_SYSTEM = `你是「灵焰恋爱大师」关系数据分析师。
根据双方全部聊天记录与已有分析，生成完整关系数据报告。
只输出 JSON，不要 markdown，不要解释。`;

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 从聊天记录与温度历史计算本地关系指标 */
export function computeChatMetrics(
  messages: ChatMessage[],
  settings: Pick<UserSettings, 'temperatureHistory' | 'relationshipStages' | 'otherNickname'>,
  analysis?: AnalysisResult | null
): ChatMetrics {
  const mine = messages.filter((m) => m.role === 'me' && m.content.trim());
  const other = messages.filter((m) => m.role === 'other' && m.content.trim());
  const myLens = mine.map((m) => m.content.trim().length);
  const otherLens = other.map((m) => m.content.trim().length);
  const myAvgLen = avg(myLens);
  const otherAvgLen = avg(otherLens);
  const total = mine.length + other.length;
  const myTalkShare = total ? clamp((mine.length / total) * 100) : 50;
  const otherShortRatio = other.length
    ? clamp((other.filter((m) => m.content.trim().length <= 6).length / other.length) * 100)
    : 0;

  const history = settings.temperatureHistory ?? [];
  const tempFromAnalysis =
    analysis?.relationshipMetrics?.temperature ??
    analysis?.psychology?.interestLevel;
  const temperatureNow = clamp(
    typeof tempFromAnalysis === 'number'
      ? tempFromAnalysis
      : history.length
        ? history[history.length - 1].temperature
        : 45 + Math.min(30, total * 2)
  );

  let favorTrend: ChatMetrics['favorTrend'] = '数据不足';
  let favorTrendDetail = '记录不足，多聊几轮后再看趋势';
  if (history.length >= 2) {
    const first = history[0].temperature;
    const last = history[history.length - 1].temperature;
    const delta = last - first;
    if (delta >= 8) {
      favorTrend = '上升';
      favorTrendDetail = `温度从 ${first} → ${last}，整体升温`;
    } else if (delta <= -8) {
      favorTrend = '下降';
      favorTrendDetail = `温度从 ${first} → ${last}，需止损或修复`;
    } else {
      favorTrend = '平稳';
      favorTrendDetail = `温度在 ${Math.min(first, last)}～${Math.max(first, last)} 区间波动`;
    }
  } else if (analysis?.emotion?.trend) {
    favorTrend = /升|好|暖/.test(analysis.emotion.trend)
      ? '上升'
      : /降|冷|淡/.test(analysis.emotion.trend)
        ? '下降'
        : '平稳';
    favorTrendDetail = analysis.emotion.trend;
  }

  const stage =
    analysis?.relationshipMetrics?.stage ||
    analysis?.psychology?.relationshipStage ||
    settings.relationshipStages?.[0] ||
    '暧昧';

  const shortfalls: string[] = [];
  const communicationIssues: string[] = [];

  if (total < 4) {
    shortfalls.push('对话轮次偏少，关系样本不足');
  }
  if (myTalkShare >= 70) {
    shortfalls.push('你输出偏多，对方参与感可能不足');
    communicationIssues.push('减少连发，抛开放式但好答的短问');
  }
  if (myTalkShare <= 30 && total >= 4) {
    shortfalls.push('你偏被动，推进节奏偏慢');
    communicationIssues.push('每轮主动抛一个具体话题或轻态度');
  }
  if (otherShortRatio >= 50 && other.length >= 3) {
    shortfalls.push('对方短回较多，兴趣或精力可能偏低');
    communicationIssues.push('忌连环追问，用轻松具体点拉回或适时收束');
  }
  if (myAvgLen > 50 && otherAvgLen < 15 && other.length >= 2) {
    communicationIssues.push('你单条偏长，对方短回——改成一句一事');
  }
  if (favorTrend === '下降') {
    shortfalls.push('好感趋势下行，需降温共情或止损观察');
  }
  if (/敷衍|冷淡|应付/.test(analysis?.psychology?.isPerfunctory || '')) {
    communicationIssues.push(`对方状态：${analysis?.psychology?.isPerfunctory}`);
  }
  if (shortfalls.length === 0 && total >= 4) {
    shortfalls.push('互动结构尚可，可加强话题深度与情绪共鸣');
  }
  if (communicationIssues.length === 0) {
    communicationIssues.push('先接对方原话再延伸，避免查户口与油腻');
  }

  // 亲密度：温度 + 轮次 + 对方投入 - 短回惩罚
  let intimacy = temperatureNow * 0.55 + Math.min(25, total * 1.5);
  intimacy -= otherShortRatio * 0.15;
  if (favorTrend === '上升') intimacy += 6;
  if (favorTrend === '下降') intimacy -= 8;
  intimacy = clamp(intimacy);

  const atmosphereHint =
    [
      analysis?.emotion?.primary,
      analysis?.psychology?.emotionalState,
      analysis?.relationshipMetrics?.trend,
    ]
      .filter(Boolean)
      .join(' · ') ||
    (otherShortRatio >= 50
      ? '偏淡 / 投入有限'
      : total >= 6
        ? '互动尚可，氛围待升温'
        : '刚起步，氛围未成型');

  return {
    totalMessages: total,
    myCount: mine.length,
    otherCount: other.length,
    myAvgLen,
    otherAvgLen,
    otherShortRatio,
    myTalkShare,
    intimacyEstimate: intimacy,
    favorTrend,
    favorTrendDetail,
    temperatureNow,
    stage,
    atmosphereHint,
    shortfalls: shortfalls.slice(0, 4),
    communicationIssues: communicationIssues.slice(0, 4),
  };
}

/** 无 API 时用本地指标生成完整报告 */
export function buildLocalRelationshipReport(
  metrics: ChatMetrics,
  analysis?: AnalysisResult | null
): RelationshipDataReport {
  const warmUpStrategy: string[] = [];
  const improveDirections: string[] = [...metrics.communicationIssues];
  const nextActions: string[] = [];

  if (metrics.favorTrend === '下降' || metrics.temperatureNow < 40) {
    warmUpStrategy.push('先共情接住情绪，少推进多倾听');
    warmUpStrategy.push('用具体小事示好，不逼表态');
    nextActions.push('发一句稳的安抚/接话题，观察是否愿意展开');
    nextActions.push('若连续短回，主动收束并留白 1 天');
  } else if (metrics.temperatureNow >= 65) {
    warmUpStrategy.push('轻推拉：给温度后留白，制造惦记');
    warmUpStrategy.push('可试探轻邀约，给选项不施压');
    nextActions.push('抛一个二选一轻邀约或共同兴趣活动');
    nextActions.push('分享一件今天的小事，邀请她也分享');
  } else {
    warmUpStrategy.push('稳定日更互动，加深一个共同话题');
    warmUpStrategy.push('适度走心一句，观察她是否接住');
    nextActions.push('顺着她最近一句追问一个细节');
    nextActions.push('周末前提一个轻松可拒绝的见面意向');
  }

  if (metrics.myTalkShare >= 70) {
    improveDirections.push('把长句拆成短句，每轮只推进一个点');
  }
  if (metrics.otherShortRatio < 30 && metrics.totalMessages >= 6) {
    improveDirections.push('可适当增加情绪共鸣与专属细节');
  }

  const bestTiming =
    analysis?.relationshipMetrics?.inviteTiming ||
    (metrics.temperatureNow >= 60 && metrics.favorTrend !== '下降'
      ? '气氛偏暖时（她主动展开或晚上闲聊段）试探轻邀约'
      : metrics.favorTrend === '下降'
        ? '先修复氛围，暂缓表白/强邀约'
        : '再积累 3～5 轮高质量互聊后，选她回复积极的时段推进');

  const nextFromAnalysis = analysis?.strategy?.nextMove;
  if (nextFromAnalysis) nextActions.unshift(nextFromAnalysis);

  return {
    intimacy: metrics.intimacyEstimate,
    favorTrend: `${metrics.favorTrend} · ${metrics.favorTrendDetail}`,
    atmosphere: metrics.atmosphereHint,
    shortfalls: metrics.shortfalls,
    communicationIssues: metrics.communicationIssues,
    warmUpStrategy: warmUpStrategy.slice(0, 4),
    improveDirections: [...new Set(improveDirections)].slice(0, 4),
    bestTiming,
    nextActions: [...new Set(nextActions)].slice(0, 4),
    summary: `当前约在「${metrics.stage}」，亲密度 ${metrics.intimacyEstimate}，好感${metrics.favorTrend}。共 ${metrics.totalMessages} 条互动（你 ${metrics.myCount} / 对方 ${metrics.otherCount}）。`,
    metrics,
    source: 'local',
    generatedAt: Date.now(),
  };
}

export function buildRelationshipReportUserPrompt(
  messages: ChatMessage[],
  settings: UserSettings,
  metrics: ChatMetrics,
  analysis?: AnalysisResult | null
): string {
  const hist = messages
    .slice(-40)
    .map((m) => `${m.role === 'me' ? settings.myNickname || '我' : settings.otherNickname || '对方'}：${m.content}`)
    .join('\n');

  const tempLine = (settings.temperatureHistory ?? [])
    .slice(-8)
    .map((p: TemperaturePoint) => p.temperature)
    .join('→');

  return `【关系数据分析 · 全量记录】
【阶段】${metrics.stage}
【本地指标】亲密度估算${metrics.intimacyEstimate}，温度${metrics.temperatureNow}，趋势${metrics.favorTrend}（${metrics.favorTrendDetail}）
条数：我${metrics.myCount}/对方${metrics.otherCount}，我方话量占比${metrics.myTalkShare}%，对方短回率${metrics.otherShortRatio}%
均长：我${metrics.myAvgLen}字 / 对方${metrics.otherAvgLen}字
温度曲线：${tempLine || '无'}
【已有分析摘要】${analysis?.summary || '无'}
潜台词：${analysis?.psychology?.subtext || '—'}
策略：${analysis?.strategy?.nextMove || '—'}

【聊天记录】
${hist || '（暂无）'}

请输出完整关系报告 JSON：
{
  "intimacy": 72,
  "favorTrend": "上升/平稳/下降 + 一句说明",
  "atmosphere": "氛围状态≤30字",
  "shortfalls": ["聊天短板1","短板2"],
  "communicationIssues": ["沟通问题1","问题2"],
  "warmUpStrategy": ["可落地升温策略1","策略2","策略3"],
  "improveDirections": ["改进方向1","方向2"],
  "bestTiming": "最佳推进时机≤40字",
  "nextActions": ["下一步行动1","行动2","行动3"],
  "summary": "报告摘要≤60字"
}`;
}

export function parseRelationshipReport(
  raw: string,
  metrics: ChatMetrics
): RelationshipDataReport | null {
  const text = raw.trim();
  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  if (!obj) return null;

  const list = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) : [];

  const intimacy =
    typeof obj.intimacy === 'number' ? clamp(obj.intimacy) : metrics.intimacyEstimate;

  return {
    intimacy,
    favorTrend: String(obj.favorTrend || `${metrics.favorTrend} · ${metrics.favorTrendDetail}`).slice(0, 80),
    atmosphere: String(obj.atmosphere || metrics.atmosphereHint).slice(0, 60),
    shortfalls: list(obj.shortfalls).length ? list(obj.shortfalls) : metrics.shortfalls,
    communicationIssues: list(obj.communicationIssues).length
      ? list(obj.communicationIssues)
      : metrics.communicationIssues,
    warmUpStrategy: list(obj.warmUpStrategy),
    improveDirections: list(obj.improveDirections),
    bestTiming: String(obj.bestTiming || '').slice(0, 80),
    nextActions: list(obj.nextActions),
    summary: String(obj.summary || '').slice(0, 120),
    metrics,
    source: 'ai',
    generatedAt: Date.now(),
  };
}
