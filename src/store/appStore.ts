import { create } from 'zustand';
import type {
  ChatMessage,
  UserSettings,
  AnalysisResult,
  ActivePanel,
  LoveSubTab,
  TemperaturePoint,
} from '../types';
import {
  loadMessages,
  saveMessages,
  loadSettings,
  saveSettings,
  loadAnalysis,
  saveAnalysis,
  normalizeAnalysis,
  generateId,
  clearAllData,
} from '../services/storageService';
import { analyzeConversation, checkApiHealth } from '../services/aiService';
import { analysisResultCache } from '../utils/computeCache';
import {
  generateSceneStyleReplies,
  buildSceneOnlyAnalysis,
} from '../services/sceneStyleReplyService';
import { describeSituation, resolveSituationSettings } from '../utils/situationContext';
import { EMPTY_CONVERSATION_HINT } from '../constants/analysisPrompts';
import type { StreamProgress } from '../utils/streamPreview';
import { buildUpdatedPartnerMemory } from '../utils/chatMemory';
import { getLovePersona } from '../constants/lovePersonas';
import type { RelationshipTrackingSnapshot } from '../types/partnerArchive';
import type { DrillCoachFeedback, DrillMessage } from '../types/drill';
import { EMPTY_DRILL_FEEDBACK } from '../types/drill';
import type { DrillScenarioId } from '../constants/drillScenarios';
import { getDrillScenario } from '../constants/drillScenarios';
import { continueDrillTurn, startDrillScene } from '../services/drillService';
import { generateWorkshopLines, refineWorkshopLines } from '../services/workshopService';
import { generateRelationshipDataReport } from '../services/relationshipReportService';
import type { RelationshipDataReport } from '../constants/relationshipReport';
import {
  analyzeCaptionForTopics,
  analyzeImageFileForTopics,
} from '../services/imageTopicService';
import type { ImageTopicResult } from '../constants/imageTopic';
import type { WorkshopCategoryId } from '../constants/workshopCategories';
import { matchWorkshopCategory } from '../constants/workshopCategories';
import { buildTrackingFromAnalysis } from '../types/partnerArchive';
import {
  createPartner,
  deletePartnerArchive,
  getActivePartner,
  getActivePartnerId,
  listPartnerSummaries,
  loadPartnerArchives,
  persistActivePartnerFromWorkspace,
  renamePartner,
  switchToPartner,
  updateActivePartnerNote,
  updateActivePartnerTags,
  updateActivePartnerKeywords,
} from '../services/partnerArchiveService';
import { PARTNER_TAG_PRESETS } from '../utils/partnerKeywords';

function syncPartnerMemoryFromChat(
  settings: UserSettings,
  messages: ChatMessage[],
  analysis?: AnalysisResult | null
): UserSettings {
  const updated = buildUpdatedPartnerMemory(settings, messages, analysis);
  if (!updated) return settings;
  return { ...settings, partnerMemory: updated };
}

function persistWorkspace(
  state: {
    messages: ChatMessage[];
    settings: UserSettings;
    analysis: AnalysisResult | null;
    relationshipReport?: RelationshipDataReport | null;
  },
  tracking?: RelationshipTrackingSnapshot | null
) {
  persistActivePartnerFromWorkspace({
    messages: state.messages,
    settings: state.settings,
    analysis: state.analysis,
    tracking,
    relationshipReport: state.relationshipReport,
  });
  return listPartnerSummaries();
}

/** 切换人物时清空会话级状态，避免串数据 */
function ephemeralReset() {
  return {
    selectedMessageId: null as string | null,
    error: null as string | null,
    drillMessages: [] as DrillMessage[],
    drillFeedback: { ...EMPTY_DRILL_FEEDBACK },
    isDrilling: false,
    workshopLines: [] as string[],
    workshopSource: '' as '' | 'ai' | 'bank',
    workshopSceneNote: '',
    imageTopicResult: null,
    imageTopicPreview: '',
    imageTopicCaption: '',
    isImageTopicLoading: false,
  };
}

function appendTemperaturePoint(
  settings: UserSettings,
  analysis: AnalysisResult | null
): UserSettings {
  const temp =
    analysis?.relationshipMetrics?.temperature ?? analysis?.psychology?.interestLevel;
  if (typeof temp !== 'number' || Number.isNaN(temp)) return settings;
  const point: TemperaturePoint = {
    at: analysis?.analyzedAt ?? Date.now(),
    temperature: Math.max(0, Math.min(100, Math.round(temp))),
    stage: analysis?.relationshipMetrics?.stage || analysis?.psychology?.relationshipStage,
  };
  const prev = settings.temperatureHistory ?? [];
  const last = prev[prev.length - 1];
  if (last && Math.abs(last.temperature - point.temperature) < 1 && Date.now() - last.at < 60_000) {
    return settings;
  }
  return { ...settings, temperatureHistory: [...prev, point].slice(-30) };
}

/** 宽屏看分析；窄屏进恋爱页话术子页 */
function panelAfterGenerate(): ActivePanel {
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) return 'analysis';
  return 'love';
}

function resolveMobilePanel(panel: ActivePanel): { activePanel: ActivePanel; loveSubTab?: LoveSubTab } {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    // 主路径：分析 / 话术（雷达风控已嵌在分析页）
    if (panel === 'analysis') return { activePanel: 'love', loveSubTab: 'analysis' };
    if (panel === 'replies') return { activePanel: 'love', loveSubTab: 'replies' };
  }
  return { activePanel: panel };
}

function applyModePatch(patch: Partial<UserSettings>, current: UserSettings): Partial<UserSettings> {
  const next = { ...patch };
  const mode = next.appMode ?? current.appMode;
  if (next.lovePersona && mode === 'love') {
    next.chatStyle = getLovePersona(next.lovePersona).chatStyle;
  }
  return next;
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

interface AppState {
  messages: ChatMessage[];
  settings: UserSettings;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  streamProgress: StreamProgress;
  error: string | null;
  activePanel: ActivePanel;
  loveSubTab: LoveSubTab;
  selectedMessageId: string | null;
  toast: string | null;
  settingsOpen: boolean;
  iceBreakerOpen: boolean;
  /** 灵焰小火龙输入法是否展开 */
  floatingImeOpen: boolean;
  serverKeyConfigured: boolean;
  /** 收藏话术变更计数，驱动 SavedRepliesPanel 刷新 */
  savedRepliesTick: number;
  /** 当前聊天对象 id（长效记忆隔离） */
  activePartnerId: string;
  /** 对象列表摘要 */
  partnerSummaries: ReturnType<typeof listPartnerSummaries>;
  /** 当前对象关系追踪快照 */
  relationshipTracking: RelationshipTrackingSnapshot | null;

  /** 全场景模拟演练 */
  drillScenarioId: DrillScenarioId;
  drillMessages: DrillMessage[];
  drillFeedback: DrillCoachFeedback;
  isDrilling: boolean;

  /** 全分类话术工坊 */
  workshopCategoryId: WorkshopCategoryId;
  workshopSceneNote: string;
  workshopLines: string[];
  workshopSource: 'ai' | 'bank' | '';
  isWorkshopGenerating: boolean;

  /** 关系数据分析报告 */
  relationshipReport: RelationshipDataReport | null;
  isGeneratingRelationshipReport: boolean;

  /** 识图聊话题 */
  imageTopicResult: ImageTopicResult | null;
  imageTopicPreview: string;
  imageTopicCaption: string;
  isImageTopicLoading: boolean;

  setSettingsOpen: (open: boolean) => void;
  setIceBreakerOpen: (open: boolean) => void;
  setFloatingImeOpen: (open: boolean) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setLoveSubTab: (tab: LoveSubTab) => void;
  setDrillScenario: (id: DrillScenarioId) => void;
  startDrill: () => Promise<void>;
  sendDrillMessage: (content: string) => Promise<void>;
  useDrillBetterReply: (content: string) => Promise<void>;
  resetDrill: () => void;
  setWorkshopCategory: (id: WorkshopCategoryId) => void;
  setWorkshopSceneNote: (note: string) => void;
  generateWorkshop: (opts?: { localOnly?: boolean; sceneText?: string }) => Promise<void>;
  refineWorkshop: (note: string) => Promise<void>;
  updateWorkshopLine: (index: number, content: string) => void;
  generateRelationshipReport: (opts?: { localOnly?: boolean }) => Promise<void>;
  setImageTopicCaption: (caption: string) => void;
  runImageTopic: (file: File) => Promise<void>;
  runCaptionTopic: () => Promise<void>;
  clearImageTopic: () => void;
  addMessage: (role: 'me' | 'other', content: string) => void;
  /** 批量导入聊天（截图 OCR / IME），并写入对象档案 */
  importMessages: (items: Array<{ role: 'me' | 'other'; content: string }>) => void;
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
  /** 长效记忆：新建 / 切换 / 删除 / 重命名聊天对象 */
  createChatPartner: (name?: string) => void;
  switchChatPartner: (id: string) => void;
  removeChatPartner: (id: string) => void;
  renameChatPartner: (id: string, name: string) => void;
  updatePartnerNote: (note: string) => void;
  updatePartnerTags: (tags: string[]) => void;
  updatePartnerKeywords: (keywords: string[]) => void;
  refreshPartnerSummaries: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  messages: [],
  settings: loadSettings(),
  analysis: null,
  isAnalyzing: false,
  streamProgress: { ...INITIAL_STREAM },
  error: null,
  activePanel: 'chat',
  loveSubTab: 'replies',
  selectedMessageId: null,
  toast: null,
  settingsOpen: false,
  iceBreakerOpen: false,
  floatingImeOpen: false,
  serverKeyConfigured: false,
  savedRepliesTick: 0,
  activePartnerId: '',
  partnerSummaries: [],
  relationshipTracking: null,
  drillScenarioId: 'approach',
  drillMessages: [],
  drillFeedback: { ...EMPTY_DRILL_FEEDBACK },
  isDrilling: false,
  workshopCategoryId: 'ice_open',
  workshopSceneNote: '',
  workshopLines: [],
  workshopSource: '',
  isWorkshopGenerating: false,
  relationshipReport: null,
  isGeneratingRelationshipReport: false,
  imageTopicResult: null,
  imageTopicPreview: '',
  imageTopicCaption: '',
  isImageTopicLoading: false,

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setIceBreakerOpen: (open) => set({ iceBreakerOpen: open }),
  setFloatingImeOpen: (open) => set({ floatingImeOpen: open }),
  setImageTopicCaption: (caption) => set({ imageTopicCaption: caption }),
  clearImageTopic: () =>
    set({
      imageTopicResult: null,
      imageTopicPreview: '',
      imageTopicCaption: '',
      isImageTopicLoading: false,
    }),

  runImageTopic: async (file) => {
    if (get().isImageTopicLoading) return;
    const preview = URL.createObjectURL(file);
    set({
      isImageTopicLoading: true,
      error: null,
      imageTopicPreview: preview,
      activePanel: 'love',
      loveSubTab: 'image',
    });
    try {
      const result = await analyzeImageFileForTopics(
        file,
        get().imageTopicCaption,
        get().settings
      );
      set({ imageTopicResult: result, isImageTopicLoading: false });
      get().showToast('识图完成 · 已生成回复与拓展话题');
    } catch (err) {
      set({
        isImageTopicLoading: false,
        error: err instanceof Error ? err.message : '识图失败',
      });
    }
  },

  runCaptionTopic: async () => {
    const caption = get().imageTopicCaption.trim();
    if (!caption || get().isImageTopicLoading) return;
    set({
      isImageTopicLoading: true,
      error: null,
      activePanel: 'love',
      loveSubTab: 'image',
    });
    try {
      const result = await analyzeCaptionForTopics(caption, get().settings);
      set({ imageTopicResult: result, isImageTopicLoading: false });
      get().showToast('话题已生成 · 可直接发送');
    } catch (err) {
      set({
        isImageTopicLoading: false,
        error: err instanceof Error ? err.message : '生成失败',
      });
    }
  },

  setWorkshopCategory: (id) => set({ workshopCategoryId: id }),
  setWorkshopSceneNote: (note) => set({ workshopSceneNote: note }),
  updateWorkshopLine: (index, content) => {
    const lines = [...get().workshopLines];
    if (index < 0 || index >= lines.length) return;
    lines[index] = content;
    set({ workshopLines: lines });
  },

  generateRelationshipReport: async (opts) => {
    if (get().isGeneratingRelationshipReport) return;
    const { messages, settings, analysis } = get();
    set({
      isGeneratingRelationshipReport: true,
      error: null,
      activePanel: 'love',
      loveSubTab: 'relation',
    });
    try {
      const report = await generateRelationshipDataReport(messages, settings, analysis, {
        localOnly: opts?.localOnly,
      });
      set({
        relationshipReport: report,
        isGeneratingRelationshipReport: false,
      });
      set({ partnerSummaries: persistWorkspace(get()) });
      get().showToast(
        report.source === 'ai'
          ? '关系数据报告已生成 · 查看升温策略与下一步'
          : '本地关系快报已就绪'
      );
    } catch (err) {
      set({
        isGeneratingRelationshipReport: false,
        error: err instanceof Error ? err.message : '关系报告生成失败',
      });
    }
  },

  generateWorkshop: async (opts) => {
    if (get().isWorkshopGenerating) return;
    let categoryId = get().workshopCategoryId;
    let sceneNote = get().workshopSceneNote;
    if (opts?.sceneText?.trim()) {
      sceneNote = opts.sceneText.trim();
      categoryId = matchWorkshopCategory(sceneNote);
      set({ workshopSceneNote: sceneNote, workshopCategoryId: categoryId });
    }
    const { settings, messages } = get();
    const lastOther =
      [...messages].reverse().find((m) => m.role === 'other')?.content ?? '';

    set({
      isWorkshopGenerating: true,
      error: null,
      activePanel: 'love',
      loveSubTab: 'workshop',
    });
    try {
      const result = await generateWorkshopLines(
        {
          categoryId,
          sceneNote,
          toneModifiers: settings.toneModifiers,
          tonePreference: settings.tonePreference,
          lastOther,
          localOnly: opts?.localOnly,
        },
        settings
      );
      set({
        workshopLines: result.lines,
        workshopSource: result.source,
        isWorkshopGenerating: false,
      });
      get().showToast(
        result.source === 'ai'
          ? '话术工坊已生成 5 条 · 可编辑微调'
          : '已从本地库生成 · 配置 Key 后可 AI 精写'
      );
    } catch (err) {
      set({
        isWorkshopGenerating: false,
        error: err instanceof Error ? err.message : '工坊生成失败',
      });
    }
  },

  refineWorkshop: async (note) => {
    const { workshopLines, workshopCategoryId, settings, isWorkshopGenerating } = get();
    if (isWorkshopGenerating || workshopLines.length === 0) return;
    set({ isWorkshopGenerating: true, error: null });
    try {
      const lines = await refineWorkshopLines(
        workshopLines,
        note,
        workshopCategoryId,
        settings
      );
      set({ workshopLines: lines, workshopSource: 'ai', isWorkshopGenerating: false });
      get().showToast('已按你的要求微调语气');
    } catch (err) {
      set({
        isWorkshopGenerating: false,
        error: err instanceof Error ? err.message : '微调失败',
      });
    }
  },

  setDrillScenario: (id) =>
    set({
      drillScenarioId: id,
      drillMessages: [],
      drillFeedback: { ...EMPTY_DRILL_FEEDBACK },
    }),

  startDrill: async () => {
    const { drillScenarioId, settings, isDrilling } = get();
    if (isDrilling) return;
    const { serverKeyConfigured } = get();
    if (!settings.apiKey?.trim() && !serverKeyConfigured) {
      set({ error: '请先在设置中配置 API Key' });
      return;
    }
    set({
      isDrilling: true,
      error: null,
      drillMessages: [],
      drillFeedback: { ...EMPTY_DRILL_FEEDBACK },
      activePanel: 'love',
      loveSubTab: 'drill',
    });
    try {
      const result = await startDrillScene(drillScenarioId, settings);
      const scene = getDrillScenario(drillScenarioId);
      set({
        drillMessages: [
          {
            id: generateId(),
            role: 'system',
            content: `场景「${scene.label}」演练开始 · ${scene.goal}`,
            timestamp: Date.now(),
          },
          result.herMessage,
        ],
        drillFeedback: result.feedback,
        isDrilling: false,
        activePanel: 'love',
        loveSubTab: 'drill',
      });
      get().showToast('她已开口 · 请像真实聊天一样回复');
    } catch (err) {
      set({
        isDrilling: false,
        error: err instanceof Error ? err.message : '演练启动失败',
      });
    }
  },

  sendDrillMessage: async (content) => {
    const line = content.trim();
    if (!line) return;
    const { drillScenarioId, drillMessages, settings, isDrilling } = get();
    if (isDrilling) return;
    if (!drillMessages.some((m) => m.role === 'her')) {
      get().showToast('请先选择场景并开始演练');
      return;
    }

    const myMsg: DrillMessage = {
      id: generateId(),
      role: 'me',
      content: line,
      timestamp: Date.now(),
    };
    const nextHistory = [...drillMessages, myMsg];
    set({
      drillMessages: nextHistory,
      isDrilling: true,
      error: null,
    });

    try {
      const result = await continueDrillTurn(
        drillScenarioId,
        nextHistory,
        line,
        settings
      );
      set({
        drillMessages: [...nextHistory, result.herMessage],
        drillFeedback: result.feedback,
        isDrilling: false,
      });
    } catch (err) {
      set({
        isDrilling: false,
        error: err instanceof Error ? err.message : '演练回合失败',
      });
    }
  },

  useDrillBetterReply: async (content) => {
    await get().sendDrillMessage(content);
  },

  resetDrill: () =>
    set({
      drillMessages: [],
      drillFeedback: { ...EMPTY_DRILL_FEEDBACK },
      isDrilling: false,
    }),

  setActivePanel: (panel) => {
    const resolved = resolveMobilePanel(panel);
    set({
      activePanel: resolved.activePanel,
      ...(resolved.loveSubTab ? { loveSubTab: resolved.loveSubTab } : {}),
    });
  },

  setLoveSubTab: (tab) => set({ loveSubTab: tab, activePanel: 'love' }),

  refreshPartnerSummaries: () => {
    set({
      partnerSummaries: listPartnerSummaries(),
      activePartnerId: getActivePartnerId(),
      relationshipTracking: getActivePartner()?.tracking ?? null,
    });
  },

  createChatPartner: (name) => {
    persistWorkspace(get());
    const idx = get().partnerSummaries.length;
    const autoTag = PARTNER_TAG_PRESETS[Math.min(idx, 2)] ?? `对象${idx + 1}`;
    const archive = createPartner(name?.trim() || autoTag);
    updateActivePartnerTags([autoTag]);
    const { settings } = switchToPartner(archive.id);
    set({
      messages: [],
      analysis: null,
      settings,
      activePartnerId: archive.id,
      partnerSummaries: listPartnerSummaries(),
      relationshipTracking: null,
      relationshipReport: null,
      activePanel: 'chat',
      loveSubTab: 'partners',
      ...ephemeralReset(),
    });
    get().showToast(`已新建「${archive.name}」· 标签 ${autoTag}`);
  },

  switchChatPartner: (id) => {
    if (id === get().activePartnerId) return;
    persistWorkspace(get());
    const { archive, settings } = switchToPartner(id);
    set({
      messages: archive.messages || [],
      analysis: normalizeAnalysis(archive.lastAnalysis),
      settings,
      activePartnerId: archive.id,
      partnerSummaries: listPartnerSummaries(),
      relationshipTracking: archive.tracking,
      relationshipReport: archive.relationshipReport ?? null,
      ...ephemeralReset(),
    });
    get().showToast(`已切换到「${archive.name}」· 数据已隔离`);
  },

  removeChatPartner: (id) => {
    const list = loadPartnerArchives();
    if (list.length <= 1) {
      get().showToast('至少保留一个聊天对象');
      return;
    }
    if (id === get().activePartnerId) {
      persistWorkspace(get());
    }
    deletePartnerArchive(id);
    const active = getActivePartner();
    if (!active) return;
    const { archive, settings } = switchToPartner(active.id);
    set({
      messages: archive.messages || [],
      analysis: normalizeAnalysis(archive.lastAnalysis),
      settings,
      activePartnerId: archive.id,
      partnerSummaries: listPartnerSummaries(),
      relationshipTracking: archive.tracking,
      relationshipReport: archive.relationshipReport ?? null,
      ...ephemeralReset(),
    });
    get().showToast('已删除该对象档案');
  },

  renameChatPartner: (id, name) => {
    renamePartner(id, name);
    if (id === get().activePartnerId) {
      const settings = { ...get().settings, otherNickname: name.trim() || get().settings.otherNickname };
      saveSettings(settings);
      set({ settings, partnerSummaries: listPartnerSummaries() });
      persistWorkspace({ ...get(), settings });
    } else {
      set({ partnerSummaries: listPartnerSummaries() });
    }
  },

  updatePartnerNote: (note) => {
    updateActivePartnerNote(note);
    set({ partnerSummaries: listPartnerSummaries() });
  },

  updatePartnerTags: (tags) => {
    updateActivePartnerTags(tags);
    set({ partnerSummaries: listPartnerSummaries() });
  },

  updatePartnerKeywords: (keywords) => {
    updateActivePartnerKeywords(keywords);
    set({ partnerSummaries: listPartnerSummaries() });
  },

  init: async () => {
    const health = await checkApiHealth();
    // 先迁移/加载对象档案，再灌入 workspace
    loadPartnerArchives();
    const activeId = getActivePartnerId();
    let settings = loadSettings();
    let messages = loadMessages();
    let analysis = loadAnalysis();
    let tracking: RelationshipTrackingSnapshot | null = null;
    let relationshipReport: RelationshipDataReport | null = null;

    if (activeId) {
      try {
        const loaded = switchToPartner(activeId);
        settings = loaded.settings;
        messages = loaded.archive.messages || [];
        analysis = normalizeAnalysis(loaded.archive.lastAnalysis);
        tracking = loaded.archive.tracking;
        relationshipReport = loaded.archive.relationshipReport ?? null;
      } catch {
        /* keep legacy workspace */
      }
    }

    saveSettings(settings);
    set({
      messages,
      settings,
      analysis,
      serverKeyConfigured: health.serverKeyConfigured,
      activePartnerId: getActivePartnerId(),
      partnerSummaries: listPartnerSummaries(),
      relationshipTracking: tracking,
      relationshipReport,
    });
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
    saveMessages(messages);
    set({ messages });
    const summaries = persistWorkspace(get());
    set({ partnerSummaries: summaries });
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
    if (imported.length === 0) return;
    const messages = [...get().messages, ...imported];
    saveMessages(messages);
    saveAnalysis(null);
    set({ messages, analysis: null });
    set({ partnerSummaries: persistWorkspace(get(), null) });
  },

  updateMessage: (id, content) => {
    const messages = get().messages.map((m) =>
      m.id === id ? { ...m, content: content.trim() } : m
    );
    saveMessages(messages);
    set({ messages });
    set({ partnerSummaries: persistWorkspace(get()) });
  },

  deleteMessage: (id) => {
    const messages = get().messages.filter((m) => m.id !== id);
    saveMessages(messages);
    set({ messages, selectedMessageId: get().selectedMessageId === id ? null : get().selectedMessageId });
    set({ partnerSummaries: persistWorkspace(get()) });
  },

  clearMessages: () => {
    saveMessages([]);
    set({ messages: [], selectedMessageId: null });
    set({ partnerSummaries: persistWorkspace(get()) });
  },

  updateSettings: (partial) => {
    const current = get().settings;
    const settings = { ...current, ...applyModePatch(partial, current) };
    saveSettings(settings);
    set({ settings });
    set({ partnerSummaries: persistWorkspace(get()) });
  },

  selectMessage: (id) => set({ selectedMessageId: id }),

  runGenerateReplies: async (draftText) => {
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
      saveMessages(messages);
      set({ messages });
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
      ...resolveMobilePanel('replies'),
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
      let settingsWithMemory = syncPartnerMemoryFromChat(effective, messages, analysis);
      settingsWithMemory = appendTemperaturePoint(settingsWithMemory, analysis);
      const tracking = buildTrackingFromAnalysis(analysis);
      saveSettings(settingsWithMemory);
      saveAnalysis(analysis);
      set({
        analysis,
        settings: settingsWithMemory,
        isAnalyzing: false,
        streamProgress: { ...INITIAL_STREAM },
        relationshipTracking: tracking,
        ...resolveMobilePanel('replies'),
      });
      set({ partnerSummaries: persistWorkspace(get(), tracking) });
      get().showToast('已生成开场话术 · 关系追踪已更新');
    } catch (err) {
      if (seq !== analysisSeq) return;
      if (err instanceof Error && err.name === 'AbortError') {
        set({ isAnalyzing: false, streamProgress: { ...INITIAL_STREAM } });
        return;
      }
      set({
        isAnalyzing: false,
        streamProgress: { ...INITIAL_STREAM },
        error: err instanceof Error ? err.message : '生成失败，请重试',
      });
    }
  },

  runAnalysis: async (targetMessageId) => {
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
      ...resolveMobilePanel('analysis'),
    });

    try {
      const analysis = await analyzeConversation(
        messages,
        settings,
        targetMsg?.content,
        (progress) => {
          if (seq === analysisSeq) set({ streamProgress: progress });
        },
        signal,
        // 已有分析结果时视为「重新生成」绕过缓存；清空分析会 clear cache，首次生成可命中短时缓存
        { bypassCache: Boolean(get().analysis) }
      );

      if (seq !== analysisSeq) return;

      let settingsWithMemory = syncPartnerMemoryFromChat(settings, messages, analysis);
      settingsWithMemory = appendTemperaturePoint(settingsWithMemory, analysis);
      const tracking = buildTrackingFromAnalysis(analysis);
      saveSettings(settingsWithMemory);
      saveAnalysis(analysis);
      const nextPanel = panelAfterGenerate();
      const riskLevel = analysis.riskAssessment?.level;
      const preferRisk = riskLevel === 'high' || riskLevel === 'medium';
      // 窄屏主路径：高风险进分析（内含风控）；否则进话术
      const resolved =
        nextPanel === 'love'
          ? {
              activePanel: 'love' as const,
              loveSubTab: (preferRisk ? 'analysis' : 'replies') as LoveSubTab,
            }
          : resolveMobilePanel(nextPanel);
      set({
        analysis,
        settings: settingsWithMemory,
        isAnalyzing: false,
        streamProgress: { ...INITIAL_STREAM },
        relationshipTracking: tracking,
        ...resolved,
      });
      set({ partnerSummaries: persistWorkspace(get(), tracking) });
      get().showToast(
        preferRisk && resolved.loveSubTab === 'analysis'
          ? `风控${riskLevel === 'high' ? '高' : '中'}风险 · 已在分析中给出拆解与反制`
          : resolved.loveSubTab === 'replies' || resolved.activePanel === 'replies'
            ? '话术已就绪 · 可直接复制发送'
            : '分析完成 · 关系追踪已更新'
      );
    } catch (err) {
      if (seq !== analysisSeq) return;
      if (err instanceof Error && err.name === 'AbortError') {
        set({ isAnalyzing: false, streamProgress: { ...INITIAL_STREAM } });
        return;
      }
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
        ...(staleEmpty ? resolveMobilePanel('replies') : {}),
      });
    }
  },

  clearAnalysis: () => {
    analysisResultCache.clear();
    saveAnalysis(null);
    set({ analysis: null, relationshipTracking: null });
    set({ partnerSummaries: persistWorkspace(get(), null) });
  },

  resetChatContext: () => {
    analysisAbort?.abort();
    analysisAbort = null;
    analysisSeq++;
    analysisResultCache.clear();
    saveMessages([]);
    saveAnalysis(null);
    const settings = { ...get().settings, tonePreference: '' };
    saveSettings(settings);
    set({
      messages: [],
      settings,
      analysis: null,
      relationshipTracking: null,
      relationshipReport: null,
      selectedMessageId: null,
      error: null,
      isAnalyzing: false,
      streamProgress: { ...INITIAL_STREAM },
      activePanel: 'chat',
    });
    set({ partnerSummaries: persistWorkspace(get(), null) });
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
    try {
      localStorage.removeItem('soul_partner_archives_v1');
      localStorage.removeItem('soul_active_partner_id_v1');
    } catch {
      /* ignore */
    }
    loadPartnerArchives();
    set({
      messages: [],
      settings: loadSettings(),
      analysis: null,
      selectedMessageId: null,
      error: null,
      isAnalyzing: false,
      streamProgress: { ...INITIAL_STREAM },
      relationshipTracking: null,
      activePartnerId: getActivePartnerId(),
      partnerSummaries: listPartnerSummaries(),
    });
  },
}));
