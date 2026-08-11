import type { AnalysisResult } from '../types';
import { EMOTION_RADAR_TYPES } from './productFeatures';

/** 灵焰情绪雷达 · 强制分析准则 */
export const LINGYAN_EMOTION_RADAR_DIRECTIVE = `【灵焰情绪雷达分析模式 · 强制遵守】
读取对方【每一句】尤其是最后一条，精准拆解四层：
1. 表层话术：她字面在说什么
2. 深层情绪：真实情绪类型与强度
3. 潜台词：没说出口但想被听懂的部分
4. 真实态度：对你/对这段对话的真实立场
必须标注：情绪类型、好感度(0-100)、敷衍程度、隐藏需求。
再给出：最优应对策略 + 可直接发送的高情商回复方向（分寸精准，不油不跪）。
emotionRadar 九项尽量填全（开心/抵触/敷衍/撒娇/生气/试探/期待/失落/好奇）。`;

export interface EmotionRadarDissect {
  /** 表层话术 */
  surface: string;
  /** 深层情绪 */
  deepEmotion: string;
  /** 潜台词 */
  subtext: string;
  /** 真实态度 */
  realAttitude: string;
  /** 情绪类型 */
  emotionType: string;
  /** 好感度 0-100 */
  favorability: number;
  /** 敷衍程度：低/中/高 + 说明 */
  perfunctoryLevel: string;
  /** 隐藏需求 */
  hiddenNeed: string;
  /** 最优应对策略 */
  strategy: string;
  /** 高情商回复方向 */
  replyHint: string;
  /** 九维雷达 */
  radar: Array<{ type: string; score: number }>;
  /** 分寸提示 */
  doseTip: string;
}

function clamp(n: number, fallback = 50): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 从完整分析结果提炼情绪雷达看板数据 */
export function dissectFromAnalysis(analysis: AnalysisResult | null): EmotionRadarDissect | null {
  if (!analysis) return null;
  const psy = analysis.psychology;
  const emo = analysis.emotion;
  const fp = analysis.femalePsychology;
  const st = analysis.strategy;
  const radarRaw = analysis.emotionRadar ?? [];

  const radar = EMOTION_RADAR_TYPES.map((type) => {
    const found = radarRaw.find((r) => r.type === type);
    return { type, score: clamp(found?.score ?? 0, 0) };
  });

  const favorability = clamp(psy?.interestLevel ?? analysis.relationshipMetrics?.temperature ?? 50);

  let perfunctoryLevel = psy?.isPerfunctory || '未知';
  if (/是|敷衍|应付|冷淡/.test(perfunctoryLevel) && !/否|不/.test(perfunctoryLevel)) {
    perfunctoryLevel = perfunctoryLevel.includes('偶尔') ? `中 · ${perfunctoryLevel}` : `高 · ${perfunctoryLevel}`;
  } else if (/否|不敷衍|认真/.test(perfunctoryLevel)) {
    perfunctoryLevel = `低 · ${perfunctoryLevel}`;
  }

  const doseTip =
    favorability >= 70
      ? '分寸：可适度升温留白，别一次表白到位'
      : favorability >= 40
        ? '分寸：稳接情绪，轻推话题，观察再进'
        : '分寸：先降温共情，少追问，给台阶不跪舔';

  return {
    surface: analysis.summary || emo?.primary || '（待解析表层话术）',
    deepEmotion: [emo?.primary, emo?.secondary, psy?.emotionalState].filter(Boolean).join(' · ') || '情绪待辨',
    subtext: psy?.subtext || '（潜台词待补）',
    realAttitude: [psy?.impressionOfMe, psy?.mentalState, psy?.chatDesire ? `聊天欲${psy.chatDesire}` : '']
      .filter(Boolean)
      .join('；') || '态度待观察',
    emotionType: emo?.primary || psy?.emotionalState || '中性',
    favorability,
    perfunctoryLevel,
    hiddenNeed: (Array.isArray(fp?.coreNeeds) ? fp.coreNeeds.join('、') : '') || fp?.scenarioTip || '被理解 / 被接住',
    strategy:
      st?.communicationStrategy ||
      st?.emotionSwap ||
      fp?.replyPrinciple ||
      '先接情绪，再自然延伸，不查户口',
    replyHint: st?.nextMove || fp?.scenarioTip || '用短句口语接住她最后一句核心点',
    radar,
    doseTip,
  };
}

/** 无 AI 时的即时本地拆解（粘贴即出） */
export function instantDissectMessage(text: string): EmotionRadarDissect {
  const core = text.trim();
  const radar = EMOTION_RADAR_TYPES.map((type) => ({ type, score: 0 }));

  const bump = (type: string, score: number) => {
    const item = radar.find((r) => r.type === type);
    if (item) item.score = Math.max(item.score, score);
  };

  let emotionType = '平静';
  let favorability = 50;
  let perfunctoryLevel = '低 · 暂无明显敷衍';
  let deepEmotion = '中性观望';
  let subtext = '想看看你会怎么接';
  let realAttitude = '态度未明，仍在观察';
  let hiddenNeed = '被认真对待';
  let strategy = '短句自然接话，留一点空间';
  let replyHint = '先回应她话里的具体点，再轻抛一个轻松问题';
  let doseTip = '分寸：稳接为主，别过度热情';

  if (!core) {
    return {
      surface: '尚无对方消息',
      deepEmotion: '—',
      subtext: '—',
      realAttitude: '—',
      emotionType: '—',
      favorability: 50,
      perfunctoryLevel: '—',
      hiddenNeed: '—',
      strategy: '粘贴对方消息后自动拆解',
      replyHint: '—',
      radar,
      doseTip: '等待输入',
    };
  }

  if (/生气|烦|无语|滚|讨厌|别烦|拉黑/.test(core)) {
    emotionType = '生气';
    deepEmotion = '恼火 / 边界被触碰';
    subtext = '别再刺激我，先让我消气';
    realAttitude = '防御加强，暂时不想被推进';
    hiddenNeed = '被道歉、被给台阶、被理解情绪';
    favorability = 28;
    perfunctoryLevel = '低 · 情绪强不等于敷衍';
    bump('生气', 85);
    bump('抵触', 70);
    strategy = '先认情绪降温，短句安抚，不辩解不连环追';
    replyHint = '先认错点或共情一句，再问她希望怎样';
    doseTip = '分寸：只降温，不讲道理压人';
  } else if (/^(嗯|哦|好|行|哈哈|呵呵|😂|🙂|👌)[。!！?？~～…]*$/u.test(core) || core.length <= 2) {
    emotionType = '敷衍';
    deepEmotion = '兴趣下降或分心';
    subtext = '这话题不想深聊 / 现在没空';
    realAttitude = '低投入，接近冷场';
    hiddenNeed = '换轻松话题或给空间';
    favorability = 35;
    perfunctoryLevel = '高 · 短回复敷衍';
    bump('敷衍', 80);
    bump('失落', 40);
    strategy = '别追问连环弹，丢一个具体轻松新钩子或先收';
    replyHint = '换一个她可能有感的具体点，或轻松收尾不施压';
    doseTip = '分寸：降需求感，一句话够了';
  } else if (/喜欢|想你|抱抱|心动|嘿嘿|呀|嘛|啦～/.test(core)) {
    emotionType = '撒娇/期待';
    deepEmotion = '亲近意愿上升';
    subtext = '想被接住、被轻撩回应';
    realAttitude = '开放升温';
    hiddenNeed = '被宠一下、被确认在意';
    favorability = 72;
    perfunctoryLevel = '低 · 主动释放信号';
    bump('撒娇', 75);
    bump('期待', 65);
    bump('开心', 55);
    strategy = '半接半留白，升温但不过度表白';
    replyHint = '接住亲昵，回一点同等温度，再留想象空间';
    doseTip = '分寸：可撩但留白，别一次说满';
  } else if (/你是谁|什么事|认识吗|有事说事/.test(core)) {
    emotionType = '警惕/试探';
    deepEmotion = '防备 + 需要确认来意';
    subtext = '先说清楚你是谁、找我干嘛';
    realAttitude = '低信任，尚未开闸';
    hiddenNeed = '清晰来意与安全感';
    favorability = 25;
    perfunctoryLevel = '低 · 在筛人';
    bump('试探', 80);
    bump('抵触', 50);
    bump('好奇', 40);
    strategy = '先表明来意，干净直接，不绕弯套近乎';
    replyHint = '一句话说清认识途径+来意，再停一下';
    doseTip = '分寸：信息清晰优先，少撩';
  } else if (/开心|哈哈|太好了|不错|喜欢这/.test(core)) {
    emotionType = '开心';
    deepEmotion = '正向愉悦';
    subtext = '话题对味，可以再聊聊';
    realAttitude = '愿意继续';
    hiddenNeed = '同频共鸣';
    favorability = 68;
    bump('开心', 75);
    bump('期待', 45);
    strategy = '顺势延展同一话题细节，保持轻松';
    replyHint = '接她开心点，再问一个相关小细节';
    doseTip = '分寸：同频即可，别突然变深';
  } else {
    bump('好奇', 40);
    bump('期待', 30);
  }

  return {
    surface: core.length > 40 ? `${core.slice(0, 40)}…` : core,
    deepEmotion,
    subtext,
    realAttitude,
    emotionType,
    favorability,
    perfunctoryLevel,
    hiddenNeed,
    strategy,
    replyHint,
    radar,
    doseTip,
  };
}
