/**
 * 灵焰反套路反诈风控模式
 * 识别：钓鱼 / 套路 / 索取 / 试探 / 敷衍 / 养鱼 / 情感博弈 / 诈骗话术
 */
import type { AnalysisResult, RiskAssessment } from '../types';

export const RISK_CONTROL_TAGS = [
  '钓鱼',
  '套路',
  '索取',
  '试探',
  '敷衍',
  '养鱼',
  '情感博弈',
  '诈骗',
] as const;

export type RiskControlTag = (typeof RISK_CONTROL_TAGS)[number];

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskControlReport {
  level: RiskLevel;
  levelLabel: string;
  tags: RiskControlTag[];
  /** 套路拆解 */
  dissection: string;
  /** 避雷提醒 */
  alerts: string[];
  /** 动机 */
  motivation: string;
  /** 是否值得继续 */
  worthContinuing: string;
  /** 应对建议 */
  advice: string;
  /** 高情商反制话术 */
  counterReplies: string[];
  /** 来源：即时预判 / AI 精判 */
  source: 'instant' | 'ai';
}

export const LINGYAN_RISK_CONTROL_DIRECTIVE = `【灵焰反套路反诈风控模式 · 强制遵守】
精准扫描对方每一句，识别并标注：钓鱼、套路、索取、试探、敷衍、养鱼、情感博弈、诈骗话术。
必须输出 riskAssessment：
- level：low|medium|high（金钱/验证码/约见面转账等直接 high）
- tags：从上述 8 类中选命中项（可多选，无则 []）
- signals：风险信号（短句）
- dissection：套路拆解（她在玩什么、目的是什么，≤40字）
- alerts：避雷提醒 1～3 条
- motivation：对方动机
- advice：从容应对策略（不被动、不硬刚、不跪）
- worthContinuing：是否值得继续
- counterReplies：2～3 条高情商反制口语（可直接发送，守框架、不被动）
无风险时 level=low，tags=[]，counterReplies 给 1～2 条稳妥接话即可。`;

const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中等风险',
  high: '高风险',
};

interface PatternRule {
  tag: RiskControlTag;
  level: RiskLevel;
  re: RegExp;
  alert: string;
  dissection: string;
  counters: string[];
}

const RULES: PatternRule[] = [
  {
    tag: '诈骗',
    level: 'high',
    re: /转账|转我|借钱|投资|理财|刷单|验证码|银行卡|私发.*码|中奖|保证金|解冻|公检法|帮我付|打钱/,
    alert: '⚠ 疑似金钱/验证码诈骗话术，先核实身份，绝不转账',
    dissection: '用紧急感或利益诱导索取钱/码，典型诈骗话术',
    counters: [
      '钱和验证码这事我从来不在聊天里办，你先说清楚具体是啥事。',
      '正经事当面或官方渠道处理，聊天里转账我一律不碰。',
      '你这话信息量太大了，我得先核实，别急。',
    ],
  },
  {
    tag: '索取',
    level: 'high',
    re: /给我买|你请|充值|红包|打钱|孝敬|礼物先|先转|帮我付个|代付/,
    alert: '⚠ 出现物质/金钱索取信号，守住边界再谈感情',
    dissection: '把关系导向付出/消费，试探你是否好拿捏',
    counters: [
      '请客送礼可以以后再说，眼下先把人聊明白比较重要。',
      '钱的事先放一边，我对聊得来的人更感兴趣。',
      '这个我习惯量力而行，不合适的我就不硬撑。',
    ],
  },
  {
    tag: '钓鱼',
    level: 'medium',
    re: /你是不是对谁都这样|随便你|无所谓|你看着办|那你去找别人|我不好吗|是不是觉得我/,
    alert: '⚠ 疑似情绪钓鱼/二选一陷阱，别急着解释表忠',
    dissection: '用否定或对比逼你表态，钓情绪反应',
    counters: [
      '你要是想听实话，我可以直接说；你要是想吵架，这句我接不住。',
      '别拿「随便」堵我，有想法就说清楚，我听着。',
      '我对你和对别人本来就不一样，这点不用比。',
    ],
  },
  {
    tag: '试探',
    level: 'medium',
    re: /你多少个女朋友|有没有喜欢的|你前任|你是不是渣|测测你|真心话|你敢不敢/,
    alert: '⚠ 对方在试探底线/态度，稳接不跪不硬刚',
    dissection: '试探你的框架、忠诚度或在意程度',
    counters: [
      '问得挺直接，我也直说：我更在意眼下跟你聊得舒不舒服。',
      '这类题不适合考试，你想了解哪一点，我正经答你。',
      '试探可以，但别设套；你想知道什么，开门见山。',
    ],
  },
  {
    tag: '养鱼',
    level: 'medium',
    re: /有空再说|以后吧|看情况|到时候|先这样|我再想想|可能吧|再说吧/,
    alert: '⚠ 含糊推延像养鱼信号，别追问连环催促',
    dissection: '用模糊承诺吊着你，降低明确表态成本',
    counters: [
      '行，那你想清楚再说，我不催。',
      '「以后」太虚了，有具体打算再喊我。',
      '可以，你忙你的，我也不空耗着。',
    ],
  },
  {
    tag: '敷衍',
    level: 'medium',
    re: /^(嗯|哦|好|行|哈哈|呵呵|嘻嘻|可以|随便|还行)([。.!~～…]*)$/,
    alert: '⚠ 回复过短偏敷衍，忌连环追问，给话题或收束',
    dissection: '低投入应付，可能忙、冷淡或兴趣不足',
    counters: [
      '看你不太想聊，那先这样，有空再找我。',
      '行，你忙。等你有想说的再来。',
      '那换个好接的：你今天遇到啥好笑的没？',
    ],
  },
  {
    tag: '情感博弈',
    level: 'medium',
    re: /你不回我|你是不是不在乎|我就知道|果然|你变了|你以前不是这样|冷暴力|不理我|你滚|别烦我|滚吧|分手啊/,
    alert: '⚠ 情感博弈或强情绪施压，忌陷入辩解循环',
    dissection: '用愧疚/对比/怒气施压，争夺情绪主导权',
    counters: [
      '我在，但我不接受靠施压推进关系。有事直说。',
      '你要是觉得被冷落，可以说具体哪句让你不舒服。',
      '别用「我就知道」定论，把事说清楚我更好接。',
    ],
  },
  {
    tag: '套路',
    level: 'medium',
    re: /加微信慢慢聊|刷到你|你挺适合|合作|探店|模特|免费.*机会|先交个朋友|我有资源/,
    alert: '⚠ 像话术模板/引流套路，先核实再给联系方式',
    dissection: '模板化接近或利益包装，可能有目的接近',
    counters: [
      '具体什么事你一句话说清，合适再继续。',
      '交朋友可以，先把目的讲明白，我不吃套近乎。',
      '资源合作这类我谨慎，你留个正规方式我核一下。',
    ],
  },
];

function uniqueTags(tags: RiskControlTag[]): RiskControlTag[] {
  return [...new Set(tags)];
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['low', 'medium', 'high'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

/** 本地即时风控扫描（不调 API） */
export function instantRiskScan(text: string): RiskControlReport {
  const core = text.trim();
  if (!core) {
    return {
      level: 'low',
      levelLabel: LEVEL_LABEL.low,
      tags: [],
      dissection: '暂无对方消息可扫描',
      alerts: ['粘贴或发送对方消息后，可即时风控扫描'],
      motivation: '',
      worthContinuing: '先观察',
      advice: '有内容后再判断',
      counterReplies: [],
      source: 'instant',
    };
  }

  const hit: PatternRule[] = [];
  for (const rule of RULES) {
    if (rule.re.test(core)) hit.push(rule);
  }

  // 短敷衍补充检测
  if (core.length <= 4 && /^(嗯|哦|好|行|哈哈|呵呵|嘻嘻|可以|随便|还行)/.test(core)) {
    const f = RULES.find((r) => r.tag === '敷衍');
    if (f && !hit.includes(f)) hit.push(f);
  }

  if (hit.length === 0) {
    const identityAsk = /你谁|你是谁|哪位|什么事|有什么事|请问你/.test(core);
    return {
      level: 'low',
      levelLabel: LEVEL_LABEL.low,
      tags: [],
      dissection: identityAsk
        ? '暂无诈骗信号；她在核实身份/来意，先答清楚再聊'
        : '暂未见明显钓鱼/索取/诈骗信号',
      alerts: identityAsk
        ? ['✓ 低风险核实：先自报身份+来源+来意，别空接「嗯然后呢」']
        : ['✓ 暂无明显雷点，保持框架，别查户口、别跪舔'],
      motivation: identityAsk ? '边界核验，先确认你是谁' : '正常社交表达可能性较高',
      worthContinuing: '可继续，注意分寸',
      advice: identityAsk
        ? '公式：身份+来源+来意+轻钩子；短句口语'
        : '稳接内容，短句口语，观察下一句再决定升温',
      counterReplies: identityAsk
        ? ['我是同群加的，冒昧了～', '看到你主页顺手加的，想聊两句']
        : ['行，那你怎么看？', '这么说我倒好奇了'],
      source: 'instant',
    };
  }

  let level: RiskLevel = 'low';
  const tags: RiskControlTag[] = [];
  const alerts: string[] = [];
  const counters: string[] = [];
  const dissections: string[] = [];

  for (const h of hit) {
    level = maxLevel(level, h.level);
    tags.push(h.tag);
    alerts.push(h.alert);
    dissections.push(h.dissection);
    counters.push(...h.counters);
  }

  return {
    level,
    levelLabel: LEVEL_LABEL[level],
    tags: uniqueTags(tags),
    dissection: dissections.slice(0, 2).join('；'),
    alerts: alerts.slice(0, 3),
    motivation: tags.includes('诈骗') || tags.includes('索取')
      ? '利益/资源导向可能性高'
      : tags.includes('养鱼') || tags.includes('敷衍')
        ? '低投入维持选项，不愿明确承诺'
        : '情绪主导或试探你的态度/底线',
    worthContinuing:
      level === 'high' ? '建议止损或严核实后再继续' : level === 'medium' ? '可继续但守框架观察' : '可继续',
    advice:
      level === 'high'
        ? '不转账、不交码、不情绪化硬刚；先核实，必要时冷却'
        : '从容接住，用短句守框架，把球踢回对方说清楚',
    counterReplies: [...new Set(counters)].slice(0, 3),
    source: 'instant',
  };
}

function asTag(v: string): RiskControlTag | null {
  return (RISK_CONTROL_TAGS as readonly string[]).includes(v) ? (v as RiskControlTag) : null;
}

/** 从 AI 分析结果提炼风控看板 */
export function riskReportFromAnalysis(analysis: AnalysisResult | null): RiskControlReport | null {
  if (!analysis?.riskAssessment) return null;
  const r = analysis.riskAssessment;
  const level: RiskLevel = r.level === 'high' || r.level === 'medium' || r.level === 'low' ? r.level : 'low';

  const tags = (r.tags ?? [])
    .map((t) => asTag(String(t).trim()))
    .filter((t): t is RiskControlTag => Boolean(t));

  // 从 signals 里猜标签
  if (tags.length === 0) {
    const blob = [...(r.signals ?? []), r.motivation, r.advice].join(' ');
    for (const t of RISK_CONTROL_TAGS) {
      if (blob.includes(t)) tags.push(t);
    }
  }

  const alerts =
    (r.alerts && r.alerts.length > 0
      ? r.alerts
      : r.signals?.map((s) => `⚠ ${s}`))?.slice(0, 4) ?? [];

  const counterReplies = (r.counterReplies ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);

  return {
    level,
    levelLabel: LEVEL_LABEL[level],
    tags: uniqueTags(tags),
    dissection: r.dissection || r.motivation || analysis.psychology?.subtext || '（套路拆解待补）',
    alerts: alerts.length ? alerts : ['保持观察，暂无额外避雷'],
    motivation: r.motivation || '',
    worthContinuing: r.worthContinuing || '',
    advice: r.advice || analysis.strategy?.nextMove || '',
    counterReplies:
      counterReplies.length > 0
        ? counterReplies
        : (analysis.replies ?? []).slice(0, 3).map((x) => x.content).filter(Boolean),
    source: 'ai',
  };
}

/** 优先 AI，否则即时扫描 */
export function resolveRiskReport(
  analysis: AnalysisResult | null,
  lastOtherText: string
): RiskControlReport {
  return riskReportFromAnalysis(analysis) ?? instantRiskScan(lastOtherText);
}

export function normalizeRiskAssessment(
  raw: Partial<RiskAssessment> | undefined
): RiskAssessment | undefined {
  if (!raw) return undefined;
  const level = ['low', 'medium', 'high'].includes(raw.level ?? '')
    ? (raw.level as RiskLevel)
    : 'low';
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
    : [];
  const alerts = Array.isArray(raw.alerts)
    ? raw.alerts.map(String).filter(Boolean).slice(0, 4)
    : [];
  const counterReplies = Array.isArray(raw.counterReplies)
    ? raw.counterReplies.map(String).filter(Boolean).slice(0, 3)
    : [];

  return {
    level,
    signals: Array.isArray(raw.signals) ? raw.signals.map(String).filter(Boolean) : [],
    motivation: raw.motivation || '',
    advice: raw.advice || '',
    worthContinuing: raw.worthContinuing || '',
    tags,
    dissection: raw.dissection || '',
    alerts,
    counterReplies,
  };
}
