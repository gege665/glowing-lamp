import { create } from 'zustand';
import type { ChatMessage, UserSettings, AnalysisResult, ActivePanel } from '../types';
import {
  loadMessages,
  saveMessages,
  loadSettings,
  saveSettings,
  loadAnalysis,
  saveAnalysis,
  generateId,
  clearAllData,
} from '../services/storageService';
import { analyzeConversation, checkApiHealth } from '../services/aiService';
import {
  generateSceneStyleReplies,
  buildSceneOnlyAnalysis,
} from '../services/sceneStyleReplyService';
import { describeSituation, resolveSituationSettings } from '../utils/situationContext';
import { EMPTY_CONVERSATION_HINT } from '../constants/analysisPrompts';
import type { StreamProgress } from '../utils/streamPreview';
import { buildUpdatedPartnerMemory } from '../utils/chatMemory';
import { isUserAbortError } from '../utils/abortSleep';
import { track } from '../utils/analytics';

function persistMessages(messages: ChatMessage[]): string | null {
  try {
    saveMessages(messages);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : '本地存储失败';
  }
}

function syncPartnerMemoryFromChat(
  settings: UserSettings,
  messages: ChatMessage[],
  analysis?: AnalysisResult | null
): UserSettings {
  const updated = buildUpdatedPartnerMemory(settings, messages, analysis);
  if (!updated) return settings;
  return { ...settings, partnerMemory: updated };
}

/** 宽屏三栏同显分析；窄屏自动切到话术页 */
function panelAfterGenerate(): ActivePanel {
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) return 'analysis';
  return 'replies';
}

const INITIAL_STREAM: StreamProgress = {
  phase: 'analysis',
  message: '准备分析…',
  analysisPreview: {},
  replyPreviews: [],
};

let analysisSeq = 0;
let analysisAbort: AbortController | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let initPromise: Promise<void> | null = null;
let initCompleted = false;

interface AppState {
  messages: ChatMessage[];
  settings: UserSettings;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  streamProgress: StreamProgress;
  error: string | null;
  activePanel: ActivePanel;
  selectedMessageId: string | null;
  toast: string | null;
  settingsOpen: boolean;
  serverKeyConfigured: boolean;
  /** 收藏话术变更计数，驱动 SavedRepliesPanel 刷新 */
  savedRepliesTick: number;
  /** health / 本地状态是否已初始化 */
  ready: boolean;

  setSettingsOpen: (open: boolean) => void;
  setActivePanel: (panel: ActivePanel) => void;
  addMessage: (role: 'me' | 'other', content: string) => void;
  importMessages: (items: Array<{ role: 'me' | 'other'; content: string }>) => number;
  updateMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  selectMessage: (id: string | null) => void;
  runAnalysis: (targetMessageId?: string) => Promise<void>;
  /** 场景区一键生成：有对方消息→分析+话术；仅选场景→开场话术 */
  runGenerateReplies: (draftText?: string) => Promise<void>;
  clearAnalysis: () => void;
  /** 重置聊天上下文：清空对话与分析，保留设置与资料卡 */
  resetChatContext: () => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  clearError: () => void;
  resetAll: () => void;
  init: () => Promise<void>;
  notifySavedRepliesChanged: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  messages: [],
  settings: loadSettings(),
  analysis: null,
  isAnalyzing: false,
  streamProgress: { ...INITIAL_STREAM },
  error: null,
  activePanel: 'chat',
  selectedMessageId: null,
  toast: null,
  settingsOpen: false,
  serverKeyConfigured: false,
  savedRepliesTick: 0,
  ready: false,

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  init: async () => {
    if (initCompleted) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const health = await checkApiHealth();
      const settings = loadSettings();
      // Storage can be unavailable in private browsing, tests, or after quota exhaustion.
      // Initialization should still restore the in-memory app state in those cases.
      try {
        saveSettings(settings);
      } catch {
        /* persistence is best-effort during startup */
      }
      set({
        messages: loadMessages(),
        settings,
        analysis: loadAnalysis(),
        serverKeyConfigured: health.serverKeyConfigured,
        ready: true,
      });
      initCompleted = true;
    })().finally(() => {
      if (!initCompleted) initPromise = null;
    });

    return initPromise;
  },

  addMessage: (role, content) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const msg: ChatMessage = {
      id: generateId(),
      role,
      content: trimmed,
      timestamp: Date.now(),
    };
    const messages = [...get().messages, msg];
    const persistError = persistMessages(messages);
    set({ messages, ...(persistError ? { error: persistError } : {}) });
  },

  importMessages: (items) => {
    const imported: ChatMessage[] = items
      .map((p) => ({
        id: generateId(),
        role: p.role,
        content: p.content.trim(),
        timestamp: Date.now(),
      }))
      .filter((m) => m.content);
    if (!imported.length) return 0;
    const messages = [...get().messages, ...imported];
    const persistError = persistMessages(messages);
    try {
      saveAnalysis(null);
    } catch {
      /* best-effort */
    }
    set({
      messages,
      analysis: null,
      ...(persistError ? { error: persistError } : {}),
    });
    return imported.length;
  },

  updateMessage: (id, content) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const messages = get().messages.map((m) =>
      m.id === id ? { ...m, content: trimmed } : m
    );
    const persistError = persistMessages(messages);
    set({ messages, ...(persistError ? { error: persistError } : {}) });
  },

  deleteMessage: (id) => {
    const messages = get().messages.filter((m) => m.id !== id);
    const persistError = persistMessages(messages);
    set({
      messages,
      selectedMessageId: get().selectedMessageId === id ? null : get().selectedMessageId,
      ...(persistError ? { error: persistError } : {}),
    });
  },

  clearMessages: () => {
    const persistError = persistMessages([]);
    set({ messages: [], selectedMessageId: null, ...(persistError ? { error: persistError } : {}) });
  },

  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    saveSettings(settings);
    set({ settings });
  },

  selectMessage: (id) => set({ selectedMessageId: id }),

  runGenerateReplies: async (draftText) => {
    await get().init();
    track('generate_start', { path: 'scene_or_analysis' });
    const settings = { ...loadSettings(), ...get().settings };
    if (JSON.stringify(settings) !== JSON.stringify(get().settings)) {
      set({ settings });
    }

    let { messages } = get();
    const draft = draftText?.trim();

    if (draft) {
      const msg: ChatMessage = {
        id: generateId(),
        role: 'other',
        content: draft,
        timestamp: Date.now(),
      };
      messages = [...messages, msg];
      const persistError = persistMessages(messages);
      set({ messages, ...(persistError ? { error: persistError } : {}) });
    }

    const effective = resolveSituationSettings(settings, messages, draft);
    const hasOther = messages.some((m) => m.role === 'other' && m.content.trim());
    const situationLabel = describeSituation(effective, messages, draft);

    if (hasOther) {
      set({
        streamProgress: {
          ...INITIAL_STREAM,
          message: `当前：${situationLabel}`,
        },
      });
      await get().runAnalysis();
      return;
    }

    if (!effective.chatScene && !settings.tonePreference) {
      set({
        error: '请先粘贴对方消息，或选择场景/语气；也可直接生成，系统会按「刚加好友」等情况自动判断',
      });
      return;
    }

    const { serverKeyConfigured } = get();
    if (!settings.apiKey?.trim() && !serverKeyConfigured) {
      set({ error: '请先在设置中配置 API Key，或由管理员配置服务端 AIYIWEI_API_KEY / JUHE_API_KEY / OPENROUTER_API_KEY' });
      return;
    }

    analysisAbort?.abort();
    analysisAbort = new AbortController();
    const seq = ++analysisSeq;

    set({
      isAnalyzing: true,
      error: null,
      activePanel: 'replies',
      streamProgress: {
        phase: 'replies',
        message: `当前：${situationLabel}`,
        analysisPreview: {},
        replyPreviews: [],
      },
    });

    try {
      const replies = await generateSceneStyleReplies(effective, messages, analysisAbort!.signal);
      if (seq !== analysisSeq) return;

      const analysis = buildSceneOnlyAnalysis(replies, effective, messages);
      const settingsWithMemory = syncPartnerMemoryFromChat(effective, messages, analysis);
      if (settingsWithMemory !== effective) {
        saveSettings(settingsWithMemory);
      }
      saveAnalysis(analysis);
      set({
        analysis,
        settings: settingsWithMemory,
        isAnalyzing: false,
        streamProgress: { ...INITIAL_STREAM },
        activePanel: 'replies',
      });
      get().showToast('已生成开场话术');
      track('generate_success', { path: 'scene' });
    } catch (err) {
      if (seq !== analysisSeq) return;
      if (isUserAbortError(err)) {
        set({ isAnalyzing: false, streamProgress: { ...INITIAL_STREAM } });
        return;
      }
      track('generate_fail', {
        path: 'scene',
        message: err instanceof Error ? err.message.slice(0, 80) : 'unknown',
      });
      set({
        isAnalyzing: false,
        streamProgress: { ...INITIAL_STREAM },
        error: err instanceof Error ? err.message : '生成失败，请重试',
      });
    }
  },

  runAnalysis: async (targetMessageId) => {
    await get().init();
    track('generate_start', { path: 'analysis' });
    let settings = { ...loadSettings(), ...get().settings };
    if (JSON.stringify(settings) !== JSON.stringify(get().settings)) {
      set({ settings });
    }
    const { messages } = get();
    const targetMsg = targetMessageId
      ? messages.find((m) => m.id === targetMessageId)
      : [...messages].reverse().find((m) => m.role === 'other');
    settings = resolveSituationSettings(settings, messages, targetMsg?.content);
    const hasContent = messages.some((m) => m.content?.trim());
    if (!hasContent) {
      set({ error: EMPTY_CONVERSATION_HINT });
      return;
    }
    const { serverKeyConfigured } = get();
    if (!settings.apiKey?.trim() && !serverKeyConfigured) {
      set({ error: '请先在设置中配置 API Key，或由管理员配置服务端 AIYIWEI_API_KEY / JUHE_API_KEY / OPENROUTER_API_KEY' });
      return;
    }

    analysisAbort?.abort();
    analysisAbort = new AbortController();
    const seq = ++analysisSeq;
    const { signal } = analysisAbort;

    set({
      isAnalyzing: true,
      error: null,
      streamProgress: { ...INITIAL_STREAM, message: '正在启动分析…' },
      activePanel: 'analysis',
    });

    try {
      const analysis = await analyzeConversation(
        messages,
        settings,
        targetMsg?.content,
        (progress) => {
          if (seq === analysisSeq) set({ streamProgress: progress });
        },
        signal
      );

      if (seq !== analysisSeq) return;

      const settingsWithMemory = syncPartnerMemoryFromChat(settings, messages, analysis);
      if (settingsWithMemory !== settings) {
        saveSettings(settingsWithMemory);
      }
      saveAnalysis(analysis);
      const nextPanel = panelAfterGenerate();
      set({
        analysis,
        settings: settingsWithMemory,
        isAnalyzing: false,
        streamProgress: { ...INITIAL_STREAM },
        activePanel: nextPanel,
      });
      get().showToast(
        nextPanel === 'replies' ? '话术已就绪，请查看话术页' : '分析完成，请查看右侧话术'
      );
      track('generate_success', {
        path: 'analysis',
        degraded: Boolean(analysis.analysisDegraded),
      });
      if (analysis.analysisDegraded) {
        track('analysis_degraded', {
          reason: analysis.analysisDegradedReason?.slice(0, 60) || 'unknown',
        });
      }
    } catch (err) {
      if (seq !== analysisSeq) return;
      if (isUserAbortError(err)) {
        set({ isAnalyzing: false, streamProgress: { ...INITIAL_STREAM } });
        return;
      }
      track('generate_fail', {
        path: 'analysis',
        message: err instanceof Error ? err.message.slice(0, 80) : 'unknown',
      });
      const prev = get().analysis;
      const staleEmpty =
        prev?.replies?.length &&
        prev.replies.every((r) => r.content.trim().length < 2);
      if (staleEmpty) {
        saveAnalysis(null);
      }
      set({
        isAnalyzing: false,
        streamProgress: { ...INITIAL_STREAM },
        analysis: staleEmpty ? null : prev,
        error: err instanceof Error ? err.message : '分析失败，请重试',
        activePanel: staleEmpty ? 'replies' : get().activePanel,
      });
    }
  },

  clearAnalysis: () => {
    saveAnalysis(null);
    set({ analysis: null });
  },

  resetChatContext: () => {
    analysisAbort?.abort();
    analysisAbort = null;
    analysisSeq++;
    const persistError = persistMessages([]);
    try {
      saveAnalysis(null);
    } catch {
      /* best-effort */
    }
    set({
      messages: [],
      analysis: null,
      selectedMessageId: null,
      error: persistError,
      isAnalyzing: false,
      streamProgress: { ...INITIAL_STREAM },
      activePanel: 'chat',
    });
  },

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
      toastTimer = null;
    }, 2000);
  },

  clearToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    set({ toast: null });
  },

  clearError: () => set({ error: null }),

  notifySavedRepliesChanged: () =>
    set((s) => ({ savedRepliesTick: s.savedRepliesTick + 1 })),

  resetAll: () => {
    analysisAbort?.abort();
    analysisAbort = null;
    analysisSeq++;
    clearAllData();
    set({
      messages: [],
      settings: loadSettings(),
      analysis: null,
      selectedMessageId: null,
      error: null,
      isAnalyzing: false,
      streamProgress: { ...INITIAL_STREAM },
    });
  },
}));
