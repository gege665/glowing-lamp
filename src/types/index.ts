export type MessageRole = 'me' | 'other';
import type { ChatStyleType } from '../constants/chatStylePrompts';
import type { ToneModifierId } from '../constants/toneModifiers';
import { DEFAULT_TONE_MODIFIERS } from '../constants/toneModifiers';
import { DEFAULT_CHAT_STYLE } from '../constants/chatStylePrompts';
import { REPLY_STYLE_COUNT } from '../constants/analysisPrompts';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export type ReplyCategory =
  | 'gentleWarm'
  | 'soberRational'
  | 'lightHumor'
  | 'coolFrame'
  | 'delicateEmpathy'
  | 'cleanYouth'
  | 'lightFlirt'
  | 'steadyMature'
  | 'minimalDirect'
  | 'deepHeart'
  | 'playful'
  | 'warmCare'
  | 'easyCompanion'
  | 'rationalSteady'
  | 'flirtInteract'
  | 'doting'
  | 'detailInteract'
  | 'openEnd'
  | 'exaggerateTease'
  | 'reverseTease'
  | 'psychological'
  | 'pushPull'
  | 'lightSuppress'
  | 'catMouse'
  | 'frameLead'
  | 'paceControl'
  | 'colloquialSnap'
  | 'sameFeeling'
  | 'oneQuestion'
  | 'clearAttitude'
  | 'easyLanding'
  | 'concise'
  | 'detailed'
  | 'interactive';

export interface ReplySuggestion {
  category: ReplyCategory;
  label: string;
  content: string;
}

/** 本人资料卡 */
export interface MyProfileCard {
  hobbies: string;
  experiences: string;
  strengths: string;
  topics: string;
}

/** 对方资料卡（7 维度） */
export interface OtherProfileCard {
  likes: string;
  dislikes: string;
  personality: string;
  habits: string;
  experiences: string;
  dreams: string;
  notes: string;
}

/** 聊天对象记忆 */
export interface PartnerMemory {
  details: string;
  updatedAt: number;
}

/** 话术工坊收藏 */
export interface SavedReply {
  id: string;
  content: string;
  label: string;
  savedAt: number;
}

/** 情绪雷达单项 */
export interface EmotionRadarItem {
  type: string;
  score: number;
}

/** 反套路 / 反捞风险评估 */
export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  signals: string[];
  motivation: string;
  advice: string;
  worthContinuing: string;
}

/** 关系仪表盘 */
export interface RelationshipMetrics {
  temperature: number;
  stage: string;
  interactionFreq: string;
  topicDepth: string;
  trend: string;
  suggestion: string;
  inviteTiming: string;
}

/** 对话关键节点 */
export interface KeyMoment {
  label: string;
  meaning: string;
}

export interface EmotionAnalysis {
  primary: string;
  secondary: string;
  intensity: number;
  trend: string;
}

export interface PsychologyAnalysis {
  emotionalState: string;
  mentalState: string;
  personalityTraits: string[];
  subtext: string;
  relationshipStage: string;
  /** 好感度 0-100 */
  interestLevel: number;
  /** 聊天欲望：高/中/低 */
  chatDesire: string;
  /** 对你的印象 */
  impressionOfMe: string;
  /** 是否敷衍 */
  isPerfunctory: string;
}

export interface StrategyAdvice {
  emotionSwap: string;
  frameAdjust: string;
  communicationStrategy: string;
  warnings: string[];
  nextMove: string;
}

/** 教练式对策卡：策略名 + 方向 + 可复制示例句 */
export interface StrategyCard {
  title: string;
  /** 策略方向说明（≤40字） */
  approach: string;
  /** 可直接发送的示例回复 */
  example: string;
}

/** 女性心理学洞察（分析 JSON 字段） */
export interface FemalePsychologyInsight {
  socialScenario: string;
  coreNeeds: string[];
  commStyle: string;
  replyPrinciple: string;
  scenarioTip: string;
}

export interface AnalysisResult {
  summary: string;
  emotion: EmotionAnalysis;
  psychology: PsychologyAnalysis;
  deepReport: string;
  strategy: StrategyAdvice;
  femalePsychology: FemalePsychologyInsight;
  /** 意图标签，如「废物测试」「冷淡敷衍」 */
  intentLabel?: string;
  /** 读心段落：为什么这样回、别踩什么坑 */
  intentInsight?: string;
  /** 2～3 条对策卡（示例可复制） */
  strategyCards?: StrategyCard[];
  /** 情绪雷达（9 种情绪强度 0-100） */
  emotionRadar?: EmotionRadarItem[];
  /** 反套路 / 反捞风险评估 */
  riskAssessment?: RiskAssessment;
  /** 关系仪表盘 */
  relationshipMetrics?: RelationshipMetrics;
  /** 对话关键节点 */
  keyMoments?: KeyMoment[];
  /** @deprecated 已停用，保留字段兼容旧数据 */
  topReplies: TopReplySuggestion[];
  replies: ReplySuggestion[];
  analyzedAt: number;
  /** 模型分析未成功，仅为本地摘要（话术可能偏弱） */
  analysisDegraded?: boolean;
  /** 降级原因（展示给用户） */
  analysisDegradedReason?: string;
}

/** 精准推荐话术（3 条） */
export interface TopReplySuggestion {
  approach: string;
  rationale: string;
  content: string;
}

export type AIProvider = 'aiyiwei' | 'juhe' | 'groq' | 'siliconflow' | 'openrouter';

export type ModelRoutingMode = 'auto' | 'manual';

/** 界面复杂度：简单隐藏顶栏模型策略；高级显示完整控件 */
export type UiMode = 'simple' | 'advanced';

export interface UserSettings {
  provider: AIProvider;
  apiKey: string;
  /** @deprecated 请使用 modelMode；保留兼容 groq / siliconflow */
  model: string;
  /** 智能切换 / 手动指定模型（aiyiwei、juhe、openrouter） */
  modelMode: ModelRoutingMode;
  /** 手动模式：话术生成模型 */
  manualChatModel: string;
  /** 手动模式：深度分析模型 */
  manualAnalysisModel: string;
  /** 简单 / 高级界面 */
  uiMode: UiMode;
  myNickname: string;
  otherNickname: string;
  /** 当前关注的关系阶段（可多选） */
  relationshipStages: string[];
  /** 策略侧重（分析与话术策略侧重，可多选） */
  strategyFocus: string[];
  /** 10 套恋爱聊天风格 */
  chatStyle: ChatStyleType;
  /** 本人资料卡 */
  myProfile: MyProfileCard;
  /** 对方资料卡 */
  otherProfile: OtherProfileCard;
  /** 聊天记忆（对方细节） */
  partnerMemory: PartnerMemory;
  /** 固定语气偏好 / 隐形提示词 */
  tonePreference: string;
  /** 语气微调 · 更撩/更稳/更短，可多选 */
  toneModifiers: ToneModifierId[];
  /** 场景→风格搭配 id */
  chatScene: string;
  /** @deprecated 已由 relationshipStages 替代，读取时自动迁移 */
  relationshipStage?: string;
}

export type { ChatStyleType } from '../constants/chatStylePrompts';

export type ActivePanel = 'chat' | 'analysis' | 'replies';

export const REPLY_CATEGORY_LABELS: Record<ReplyCategory, string> = {
  gentleWarm: '温柔暖男风',
  soberRational: '清醒理智风',
  lightHumor: '轻松幽默风',
  coolFrame: '高冷框架风',
  delicateEmpathy: '细腻共情风',
  cleanYouth: '干净少年风',
  lightFlirt: '轻微暧昧风',
  steadyMature: '沉稳成熟风',
  minimalDirect: '极简直白风',
  deepHeart: '深度走心风',
  playful: '俏皮接梗型',
  warmCare: '温柔关心型',
  easyCompanion: '轻松陪伴型',
  rationalSteady: '理性稳重型',
  flirtInteract: '暧昧互动型',
  doting: '宠溺偏爱型',
  detailInteract: '细节互动型',
  openEnd: '留白期待型',
  exaggerateTease: '夸张调侃型',
  reverseTease: '反向调侃型',
  psychological: '心理穿透型',
  pushPull: '推拉博弈型',
  lightSuppress: '适度打压型',
  catMouse: '欲擒故纵型',
  frameLead: '框架主导型',
  paceControl: '掌控节奏型',
  colloquialSnap: '口语自然型',
  sameFeeling: '同频共鸣型',
  oneQuestion: '轻问一句型',
  clearAttitude: '表态立阵型',
  easyLanding: '松弛落地型',
  concise: '简洁直接',
  detailed: '详细解释',
  interactive: '引导互动',
};

/** 话术推荐总条数（与 REPLY_MALE_STYLES 同步） */
export const REPLY_SUGGESTION_COUNT = REPLY_STYLE_COUNT;

/** 恋爱全流程阶段（初识→升温→暧昧→确定关系→亲密） */
export const RELATIONSHIP_STAGES = [
  '初识阶段',
  '升温阶段',
  '暧昧阶段',
  '确定关系',
  '亲密阶段',
] as const;

/** 沟通策略与话术侧重 */
export const STRATEGY_FOCUS_OPTIONS = [
  '女性心理共情',
  '情感支持接话',
  '心理穿透',
  '推拉技巧',
  '情绪打压',
  '欲擒故纵',
  '框架争夺',
  '主导权控制',
] as const;

export const RELATIONSHIP_FLOW_HINT = '初识 → 升温 → 暧昧 → 确定关系 → 亲密';

export const DEFAULT_MY_PROFILE: MyProfileCard = {
  hobbies: '',
  experiences: '',
  strengths: '',
  topics: '',
};

export const DEFAULT_OTHER_PROFILE: OtherProfileCard = {
  likes: '',
  dislikes: '',
  personality: '',
  habits: '',
  experiences: '',
  dreams: '',
  notes: '',
};

export const DEFAULT_PARTNER_MEMORY: PartnerMemory = {
  details: '',
  updatedAt: 0,
};

export const DEFAULT_SETTINGS: UserSettings = {
  provider: 'aiyiwei',
  apiKey: '',
  model: 'auto',
  modelMode: 'auto',
  manualChatModel: 'doubao-seed-2-0-mini-260428',
  manualAnalysisModel: 'deepseek-v4-flash',
  uiMode: 'simple',
  myNickname: '我',
  otherNickname: '对方',
  relationshipStages: [...RELATIONSHIP_STAGES],
  strategyFocus: [...STRATEGY_FOCUS_OPTIONS],
  chatStyle: DEFAULT_CHAT_STYLE,
  myProfile: { ...DEFAULT_MY_PROFILE },
  otherProfile: { ...DEFAULT_OTHER_PROFILE },
  partnerMemory: { ...DEFAULT_PARTNER_MEMORY },
  tonePreference: '',
  toneModifiers: [...DEFAULT_TONE_MODIFIERS],
  chatScene: '',
};

