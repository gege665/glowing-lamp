import type { ChatMessage, UserSettings, AnalysisResult, AIProvider, SavedReply } from '../types';
import {
  DEFAULT_SETTINGS,
  RELATIONSHIP_STAGES,
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

  settings.uiMode = raw.uiMode === 'advanced' ? 'advanced' : 'simple';

  const legacyStage = (raw as UserSettings).relationshipStage;
  if (!Array.isArray(settings.relationshipStages) || settings.relationshipStages.length === 0) {
    settings.relationshipStages = legacyStage
      ? [legacyStage]
      : [...DEFAULT_SETTINGS.relationshipStages];
  }
  settings.relationshipStages = settings.relationshipStages.filter((s) =>
    (RELATIONSHIP_STAGES as readonly string[]).includes(s)
  );
  if (settings.relationshipStages.length === 0) {
    settings.relationshipStages = ['暧昧阶段'];
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

  settings.myProfile = { ...DEFAULT_MY_PROFILE, ...(raw.myProfile ?? settings.myProfile) };
  settings.otherProfile = { ...DEFAULT_OTHER_PROFILE, ...(raw.otherProfile ?? settings.otherProfile) };
  settings.partnerMemory = {
    ...DEFAULT_PARTNER_MEMORY,
    ...(raw.partnerMemory ?? settings.partnerMemory),
  };
  settings.tonePreference = typeof raw.tonePreference === 'string' ? raw.tonePreference : settings.tonePreference ?? '';
  settings.toneModifiers =
    raw.toneModifiers !== undefined
      ? normalizeToneModifiers(raw.toneModifiers)
      : normalizeToneModifiers(settings.toneModifiers);
  settings.chatScene =
    typeof raw.chatScene === 'string' && isValidChatScene(raw.chatScene) ? raw.chatScene : '';

  delete settings.relationshipStage;

  return settings;
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

function safeGetSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private browsing can reject session storage; the app can still use server keys.
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
    const settings = normalizeSettings(safeParse(safeGetItem(KEYS.settings), {}));
    settings.apiKey = normalizeApiKey(safeGetSessionItem('soul_chat_session_api_key'));
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 供 UI 在保存/验证前统一规范化设置 */
export function normalizeUserSettings(raw: Partial<UserSettings>): UserSettings {
  return normalizeSettings(raw);
}

export function saveSettings(settings: UserSettings): void {
  const normalized = normalizeSettings(settings);
  if (normalized.apiKey) {
    safeSetSessionItem('soul_chat_session_api_key', normalized.apiKey);
  } else {
    try {
      sessionStorage.removeItem('soul_chat_session_api_key');
    } catch {
      /* ignore private browsing restrictions */
    }
  }
  safeSetItem(KEYS.settings, JSON.stringify({ ...normalized, apiKey: '' }));
}

export function loadAnalysis(): AnalysisResult | null {
  const raw = safeParse<AnalysisResult | null>(safeGetItem(KEYS.analysis), null);
  if (!raw) return null;
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
      emotionSwap: raw.strategy?.emotionSwap ?? '',
      frameAdjust: raw.strategy?.frameAdjust ?? '',
      communicationStrategy: raw.strategy?.communicationStrategy ?? '',
      warnings: Array.isArray(raw.strategy?.warnings) ? raw.strategy.warnings : [],
      nextMove: raw.strategy?.nextMove ?? '',
    },
    femalePsychology: raw.femalePsychology ?? {
      socialScenario: '',
      coreNeeds: [],
      commStyle: '',
      replyPrinciple: '',
      scenarioTip: '',
    },
    emotionRadar: raw.emotionRadar,
    riskAssessment: raw.riskAssessment,
    relationshipMetrics: raw.relationshipMetrics,
    keyMoments: raw.keyMoments,
    intentLabel: raw.intentLabel ?? '',
    intentInsight: raw.intentInsight ?? '',
    strategyCards: Array.isArray(raw.strategyCards) ? raw.strategyCards : [],
    topReplies: Array.isArray(raw.topReplies) ? raw.topReplies : [],
    replies: Array.isArray(raw.replies) ? raw.replies : [],
    analyzedAt: raw.analyzedAt ?? Date.now(),
    analysisDegraded: raw.analysisDegraded,
    analysisDegradedReason: raw.analysisDegradedReason,
  };
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
  try {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Private browsing or storage quota policies can reject synchronous access.
  }
  try {
    sessionStorage.removeItem('soul_chat_session_api_key');
  } catch {
    /* ignore private browsing restrictions */
  }
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
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall back for older browsers or restricted environments.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
