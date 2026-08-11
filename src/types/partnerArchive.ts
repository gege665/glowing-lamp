import type {
  AnalysisResult,
  ChatMessage,
  OtherProfileCard,
  PartnerMemory,
  TemperaturePoint,
} from '../types';
import { DEFAULT_OTHER_PROFILE, DEFAULT_PARTNER_MEMORY } from '../types';
import type { RelationshipDataReport } from '../constants/relationshipReport';

/** 每次对话后的关系追踪快照 */
export interface RelationshipTrackingSnapshot {
  temperature: number;
  /** 聊天氛围 */
  atmosphere: string;
  /** 进展状态 */
  progress: string;
  /** 关系判断 */
  judgment: string;
  /** 升温建议 */
  warmUpTips: string[];
  /** 避雷提醒 */
  riskAlerts: string[];
  /** 下一步聊天策略 */
  nextStrategy: string;
  updatedAt: number;
}

/** 单个聊天对象的长效档案（永久隔离） */
export interface PartnerArchive {
  id: string;
  /** 对象称呼，用于区分人物 */
  name: string;
  note?: string;
  /** 联系人标签：女1 / 女2 / 女3 / 自定义 */
  tags: string[];
  /** 自动/手动收录的兴趣关键词（爱唱歌、喜欢运动等） */
  interestKeywords: string[];
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  otherProfile: OtherProfileCard;
  partnerMemory: PartnerMemory;
  temperatureHistory: TemperaturePoint[];
  relationshipStages: string[];
  lastAnalysis: AnalysisResult | null;
  tracking: RelationshipTrackingSnapshot | null;
  /** 关系数据分析报告（按人隔离） */
  relationshipReport?: RelationshipDataReport | null;
}

export function createEmptyPartnerArchive(
  name = '新对象',
  id?: string
): PartnerArchive {
  const now = Date.now();
  return {
    id: id ?? `partner_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || '新对象',
    note: '',
    tags: [],
    interestKeywords: [],
    createdAt: now,
    updatedAt: now,
    messages: [],
    otherProfile: { ...DEFAULT_OTHER_PROFILE },
    partnerMemory: { ...DEFAULT_PARTNER_MEMORY },
    temperatureHistory: [],
    relationshipStages: ['初识'],
    lastAnalysis: null,
    tracking: null,
    relationshipReport: null,
  };
}

/** 从分析结果生成追踪快照 */
export function buildTrackingFromAnalysis(
  analysis: AnalysisResult | null
): RelationshipTrackingSnapshot | null {
  if (!analysis) return null;
  const rel = analysis.relationshipMetrics;
  const risk = analysis.riskAssessment;
  const psy = analysis.psychology;
  const strategy = analysis.strategy;

  const temperature =
    rel?.temperature ??
    (typeof psy?.interestLevel === 'number' ? psy.interestLevel : 50);

  const warmUpTips = [
    strategy?.coreStrategy,
    strategy?.whyStrategy,
    strategy?.nextMove,
    strategy?.emotionSwap,
    rel?.suggestion,
    rel?.inviteTiming ? `邀约时机：${rel.inviteTiming}` : '',
  ].filter((s): s is string => Boolean(s?.trim()));

  const riskAlerts: string[] = [];
  if (risk?.level === 'high' || risk?.level === 'medium') {
    riskAlerts.push(
      `${risk.level === 'high' ? '高风险' : '中风险'}：${risk.advice || risk.motivation || '注意边界'}`
    );
  }
  if (Array.isArray(risk?.signals)) {
    riskAlerts.push(...risk.signals.filter(Boolean).slice(0, 2));
  }
  if (Array.isArray(strategy?.warnings)) {
    riskAlerts.push(...strategy.warnings.filter(Boolean).slice(0, 2));
  }
  if (psy?.isPerfunctory && /敷衍|冷淡|应付/.test(psy.isPerfunctory)) {
    riskAlerts.push(`对方状态：${psy.isPerfunctory}`);
  }
  if (riskAlerts.length === 0) {
    riskAlerts.push('暂无明显雷点，保持自然分寸即可');
  }

  const atmosphere =
    [analysis.emotion?.primary, analysis.emotion?.trend, psy?.emotionalState]
      .filter(Boolean)
      .join(' · ') || '氛围待观察';

  const progress =
    rel?.stage ||
    psy?.relationshipStage ||
    (rel?.trend ? `趋势：${rel.trend}` : '进展待更新');

  const judgment =
    analysis.summary ||
    [psy?.subtext, psy?.impressionOfMe, psy?.chatDesire ? `聊天欲：${psy.chatDesire}` : '']
      .filter(Boolean)
      .join('；') ||
    '继续观察互动质量';

  return {
    temperature: Math.max(0, Math.min(100, Math.round(temperature))),
    atmosphere,
    progress,
    judgment,
    warmUpTips: warmUpTips.slice(0, 4),
    riskAlerts: riskAlerts.slice(0, 4),
    nextStrategy:
      strategy?.communicationStrategy ||
      strategy?.nextMove ||
      rel?.suggestion ||
      '保持轻松互动，下次接她具体兴趣点',
    updatedAt: analysis.analyzedAt || Date.now(),
  };
}
