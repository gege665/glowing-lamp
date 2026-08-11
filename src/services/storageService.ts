import type { ChatMessage, UserSettings, AnalysisResult, AIProvider, SavedReply, TemperaturePoint } from '../types';
import {
  DEFAULT_SETTINGS,
  STRATEGY_FOCUS_OPTIONS,
  DEFAULT_MY_PROFILE,
  DEFAULT_OTHER_PROFILE,
  DEFAULT_PARTNER_MEMORY,
} from '../types';
import {
  AUTO_MODEL_ROUTING,
  getDefaultModelsForProvider,
  getSelectableModels,
  supportsAutoModelRouting,
} from '../constants/modelRouting';
import { resolveChatStyle } from '../constants/chatStylePrompts';
import { resolveLovePersona } from '../constants/lovePersonas';
import { resolvePrimaryReplyStyle } from '../constants/coreReplyStyles';
import { normalizeLingyanStages } from '../constants/lingyanMaster';
import { isValidChatScene } from '../constants/coreReplyStyles';
import { normalizeToneModifiers } from '../constants/toneModifiers';
import { normalizeApiKey } from '../utils/apiKey';
import { stripAiyiweiRoutingSuffix } from '../utils/aiyiweiRouting';

function detectProviderFromKey(apiKey: string, currentProvider?: AIProvider): AIProvider | null {
  const key = normalizeApiKey(apiKey);
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('sk-')) {
    if (currentProvider === 'siliconflow') return 'siliconflow';
    if (currentProvider === 'juhe') return 'juhe';
    return 'aiyiwei';
  }
  return null;
}

function normalizeModelSettings(settings: UserSettings, raw: Partial<UserSettings>): UserSettings {
  if (!supportsAutoModelRouting(settings.provider)) {
    return settings;
  }

  const defaults = getDefaultModelsForProvider(settings.provider);

  if (raw.modelMode === 'manual' || raw.modelMode === 'auto') {
    settings.modelMode = raw.modelMode;
  } else if (settings.model && settings.model !== AUTO_MODEL_ROUTING && settings.model !== 'manual') {
    settings.modelMode = 'manual';
    settings.manualChatModel = settings.model;
    settings.manualAnalysisModel =
      settings.model === defaults.analysis ? settings.model : defaults.analysis;
  } else {
    settings.modelMode = 'auto';
  }

  settings.model = settings.modelMode === 'auto' ? AUTO_MODEL_ROUTING : 'manual';
  settings.manualChatModel = stripAiyiweiRoutingSuffix(settings.manualChatModel) || defaults.chat;
  settings.manualAnalysisModel =
    stripAiyiweiRoutingSuffix(settings.manualAnalysisModel) || defaults.analysis;

  const validIds = new Set(getSelectableModels(settings.provider).map((m) => m.value));
  if (!validIds.has(settings.manualChatModel)) {
    settings.manualChatModel = defaults.chat;
  }
  if (!validIds.has(settings.manualAnalysisModel)) {
    settings.manualAnalysisModel = defaults.analysis;
  }

  if (settings.provider === 'aiyiwei') {
    const chatOnly = new Set([
      defaults.chat,
      'doubao-seed-2-0-mini-260215',
      'doubao-seed-2-0-mini-260428',
    ]);
    if (chatOnly.has(settings.manualAnalysisModel)) {
      settings.manualAnalysisModel = defaults.analysis;
    }
    // 话术回答应用豆包；勿把 DeepSeek 误设为话术模型（易触发上游饱和）
    if (settings.manualChatModel === defaults.analysis) {
      settings.manualChatModel = defaults.chat;
    }
    if (
      settings.modelMode === 'manual' &&
      settings.manualAnalysisModel === settings.manualChatModel
    ) {
      if (settings.manualChatModel === defaults.analysis) {
        settings.manualChatModel = defaults.chat;
      } else {
        settings.manualAnalysisModel = defaults.analysis;
      }
    }
  }

  return settings;
}

function normalizeSettings(raw: Partial<UserSettings>): UserSettings {
  const settings: UserSettings = { ...DEFAULT_SETTINGS, ...raw };
  settings.apiKey = normalizeApiKey(settings.apiKey);

  const detected = detectProviderFromKey(settings.apiKey, settings.provider);
  if (detected) {
    settings.provider = detected;
  }

  const validProviders: AIProvider[] = ['aiyiwei', 'juhe', 'groq', 'siliconflow', 'openrouter'];
  if (!validProviders.includes(settings.provider)) {
    settings.provider = DEFAULT_SETTINGS.provider;
  }

  normalizeModelSettings(settings, raw);

  const legacyStage = (raw as UserSettings).relationshipStage;
  if (!Array.isArray(settings.relationshipStages) || settings.relationshipStages.length === 0) {
    settings.relationshipStages = legacyStage
      ? normalizeLingyanStages([legacyStage])
      : [...DEFAULT_SETTINGS.relationshipStages];
  } else {
    settings.relationshipStages = normalizeLingyanStages(settings.relationshipStages);
  }
  if (settings.relationshipStages.length === 0) {
    settings.relationshipStages = ['暧昧'];
  }

  if (!Array.isArray(settings.strategyFocus) || settings.strategyFocus.length === 0) {
    settings.strategyFocus = [...DEFAULT_SETTINGS.strategyFocus];
  }
  settings.strategyFocus = settings.strategyFocus.filter((s) =>
    (STRATEGY_FOCUS_OPTIONS as readonly string[]).includes(s)
  );
  if (settings.strategyFocus.length === 0) {
    settings.strategyFocus = [...DEFAULT_SETTINGS.strategyFocus];
  }

  settings.chatStyle = resolveChatStyle(raw.chatStyle ?? settings.chatStyle);
  settings.appMode = raw.appMode === 'social' ? 'social' : 'love';
  settings.lovePersona = resolveLovePersona(raw.lovePersona ?? settings.lovePersona);

  settings.myProfile = { ...DEFAULT_MY_PROFILE, ...(raw.myProfile ?? settings.myProfile) };
  settings.otherProfile = { ...DEFAULT_OTHER_PROFILE, ...(raw.otherProfile ?? settings.otherProfile) };
  settings.partnerMemory = {
    ...DEFAULT_PARTNER_MEMORY,
    ...(raw.partnerMemory ?? settings.partnerMemory),
  };
  settings.temperatureHistory = normalizeTemperatureHistory(
    raw.temperatureHistory ?? settings.temperatureHistory
  );
  settings.tonePreference = typeof raw.tonePreference === 'string' ? raw.tonePreference : settings.tonePreference ?? '';
  settings.toneModifiers =
    raw.toneModifiers !== undefined
      ? normalizeToneModifiers(raw.toneModifiers)
      : normalizeToneModifiers(settings.toneModifiers);
  settings.chatScene =
    typeof raw.chatScene === 'string' && isValidChatScene(raw.chatScene) ? raw.chatScene : '';
  settings.primaryReplyStyle = resolvePrimaryReplyStyle(
    raw.primaryReplyStyle ?? settings.primaryReplyStyle
  );

  delete settings.relationshipStage;

  return settings;
}

function normalizeTemperatureHistory(raw: unknown): TemperaturePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is TemperaturePoint =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as TemperaturePoint).at === 'number' &&
        typeof (p as TemperaturePoint).temperature === 'number'
    )
    .map((p) => ({
      at: p.at,
      temperature: Math.max(0, Math.min(100, Math.round(p.temperature))),
      stage: typeof p.stage === 'string' ? p.stage : undefined,
    }))
    .slice(-30);
}

const KEYS = {
  messages: 'soul_chat_messages',
  settings: 'soul_chat_settings',
  analysis: 'soul_chat_analysis',
  sessions: 'soul_chat_sessions',
  savedReplies: 'soul_chat_saved_replies',
} as const;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    throw new Error('本地存储已满，请清理对话或分析记录后重试');
  }
}

export function loadMessages(): ChatMessage[] {
  return safeParse(safeGetItem(KEYS.messages), []);
}

export function saveMessages(messages: ChatMessage[]): void {
  safeSetItem(KEYS.messages, JSON.stringify(messages));
}

export function loadSettings(): UserSettings {
  try {
    return normalizeSettings(safeParse(safeGetItem(KEYS.settings), {}));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 供 UI 在保存/验证前统一规范化设置 */
export function normalizeUserSettings(raw: Partial<UserSettings>): UserSettings {
  return normalizeSettings(raw);
}

export function saveSettings(settings: UserSettings): void {
  safeSetItem(KEYS.settings, JSON.stringify(normalizeSettings(settings)));
}

/** 规范化分析结果（档案/localStorage 共用，防止缺字段导致 UI 崩溃） */
export function normalizeAnalysis(raw: AnalysisResult | null | undefined): AnalysisResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const fp = raw.femalePsychology;
  const risk = raw.riskAssessment;
  return {
    summary: raw.summary ?? '',
    emotion: {
      primary: raw.emotion?.primary ?? '未知',
      secondary: raw.emotion?.secondary ?? '',
      intensity: raw.emotion?.intensity ?? 50,
      trend: raw.emotion?.trend ?? '',
    },
    psychology: {
      emotionalState: raw.psychology?.emotionalState ?? '',
      mentalState: raw.psychology?.mentalState ?? '',
      personalityTraits: Array.isArray(raw.psychology?.personalityTraits)
        ? raw.psychology.personalityTraits
        : [],
      subtext: raw.psychology?.subtext ?? '',
      relationshipStage: raw.psychology?.relationshipStage ?? '',
      interestLevel: raw.psychology?.interestLevel ?? 50,
      chatDesire: raw.psychology?.chatDesire ?? '',
      impressionOfMe: raw.psychology?.impressionOfMe ?? '',
      isPerfunctory: raw.psychology?.isPerfunctory ?? '',
    },
    deepReport: raw.deepReport ?? '',
    strategy: {
      coreStrategy:
        raw.strategy?.coreStrategy ||
        raw.strategy?.communicationStrategy ||
        raw.strategy?.nextMove ||
        '',
      whyStrategy: raw.strategy?.whyStrategy ?? '',
      emotionSwap: raw.strategy?.emotionSwap ?? '',
      frameAdjust: raw.strategy?.frameAdjust ?? '',
      communicationStrategy: raw.strategy?.communicationStrategy ?? '',
      warnings: Array.isArray(raw.strategy?.warnings) ? raw.strategy.warnings : [],
      nextMove: raw.strategy?.nextMove ?? '',
    },
    femalePsychology: {
      socialScenario: fp?.socialScenario ?? '',
      coreNeeds: Array.isArray(fp?.coreNeeds) ? fp.coreNeeds : [],
      commStyle: fp?.commStyle ?? '',
      replyPrinciple: fp?.replyPrinciple ?? '',
      scenarioTip: fp?.scenarioTip ?? '',
      shitTestNote: fp?.shitTestNote ?? '',
    },
    emotionRadar: raw.emotionRadar,
    riskAssessment: risk
      ? {
          level: risk.level === 'high' || risk.level === 'medium' ? risk.level : 'low',
          signals: Array.isArray(risk.signals) ? risk.signals : [],
          motivation: risk.motivation ?? '',
          advice: risk.advice ?? '',
          worthContinuing: risk.worthContinuing ?? '',
          tags: Array.isArray(risk.tags) ? risk.tags : [],
          dissection: risk.dissection,
          alerts: Array.isArray(risk.alerts) ? risk.alerts : [],
          counterReplies: Array.isArray(risk.counterReplies) ? risk.counterReplies : [],
        }
      : undefined,
    relationshipMetrics: raw.relationshipMetrics,
    keyMoments: Array.isArray(raw.keyMoments) ? raw.keyMoments : undefined,
    topReplies: Array.isArray(raw.topReplies) ? raw.topReplies : [],
    replies: Array.isArray(raw.replies) ? raw.replies : [],
    analyzedAt: raw.analyzedAt ?? Date.now(),
  };
}

export function loadAnalysis(): AnalysisResult | null {
  return normalizeAnalysis(safeParse<AnalysisResult | null>(safeGetItem(KEYS.analysis), null));
}

export function saveAnalysis(analysis: AnalysisResult | null): void {
  if (analysis) {
    safeSetItem(KEYS.analysis, JSON.stringify(analysis));
  } else {
    try {
      localStorage.removeItem(KEYS.analysis);
    } catch {
      /* ignore quota / privacy mode */
    }
  }
}

export function clearAllData(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

export function loadSavedReplies(): SavedReply[] {
  return safeParse(safeGetItem(KEYS.savedReplies), []);
}

export function saveSavedReplies(replies: SavedReply[]): void {
  safeSetItem(KEYS.savedReplies, JSON.stringify(replies));
}

export function addSavedReply(reply: Omit<SavedReply, 'id' | 'savedAt'>): SavedReply {
  const item: SavedReply = {
    ...reply,
    id: generateId(),
    savedAt: Date.now(),
  };
  const list = [...loadSavedReplies(), item];
  saveSavedReplies(list);
  return item;
}

export function removeSavedReply(id: string): void {
  saveSavedReplies(loadSavedReplies().filter((r) => r.id !== id));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
