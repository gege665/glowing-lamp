import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Keyboard,
  Image as ImageIcon,
  Lightbulb,
  Settings,
  Clipboard,
  Delete,
  Globe,
  Loader2,
  Copy,
  X,
  CornerDownLeft,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getImeReplyStyle, IME_REPLY_STYLES, type ImeStyleId } from '../constants/imeReplyStyles';
import { recognizeChatScreenshot, prepareImageForOcr } from '../services/ocrService';
import {
  getPinyinCandidates,
  getT9Candidates,
  isPinyinLetter,
  isT9Digit,
} from '../utils/pinyinIme';
import LingyanDragonIcon from './LingyanDragonIcon';
import type { ChatMessage } from '../types';

const IME_EXPANDED_KEY = 'soul_lingyan_ime_expanded';
const IME_PANEL_KEY = 'soul_lingyan_ime_ai_panel';
const IME_PANEL_MODE_KEY = 'soul_lingyan_ime_panel_mode';
const IME_LAYOUT_KEY = 'soul_lingyan_ime_layout';
/** 小火龙悬浮球：强制默认收起，保证入口始终可见 */
const IME_DRAGON_V3_KEY = 'soul_lingyan_ime_dragon_v3';

type KeyboardLayout = '26' | '9';
/** 面板展示模式 */
type PanelMode = 'minimal' | 'full' | 'analysis';

const PANEL_MODE_OPTIONS: { id: PanelMode; label: string }[] = [
  { id: 'minimal', label: '极简模式' },
  { id: 'full', label: '完整模式' },
  { id: 'analysis', label: '分析模式' },
];

function loadPanelMode(): PanelMode {
  try {
    const v = localStorage.getItem(IME_PANEL_MODE_KEY);
    if (v === 'minimal' || v === 'full' || v === 'analysis') return v;
    // 兼容旧极简开关
    const legacy = localStorage.getItem('soul_lingyan_ime_minimal');
    if (legacy === '0') return 'full';
  } catch {
    /* ignore */
  }
  return 'minimal';
}

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
] as const;

/** 参考图中央 3×3 */
const T9_CENTER: { digit: string; label: string }[][] = [
  [
    { digit: '1', label: '分词' },
    { digit: '2', label: 'ABC' },
    { digit: '3', label: 'DEF' },
  ],
  [
    { digit: '4', label: 'GHI' },
    { digit: '5', label: 'JKL' },
    { digit: '6', label: 'MNO' },
  ],
  [
    { digit: '7', label: 'PQRS' },
    { digit: '8', label: 'TUV' },
    { digit: '9', label: 'WXYZ' },
  ],
];

const T9_LEFT_PUNCTS = ['，', '。', '？', '！'] as const;

function loadLayout(): KeyboardLayout {
  try {
    const v = localStorage.getItem(IME_LAYOUT_KEY);
    if (v === '26' || v === '9') return v;
  } catch {
    /* ignore */
  }
  return '9';
}

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1';
  } catch {
    return fallback;
  }
}

function loadExpanded(): boolean {
  try {
    if (localStorage.getItem(IME_DRAGON_V3_KEY) !== '1') {
      localStorage.setItem(IME_DRAGON_V3_KEY, '1');
      localStorage.setItem(IME_EXPANDED_KEY, '0');
      return false;
    }
  } catch {
    /* ignore */
  }
  return loadFlag(IME_EXPANDED_KEY, false);
}

function saveFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function getLastOther(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'other') return messages[i].content;
  }
  return '';
}

export default function FloatingIME() {
  const settings = useAppStore((s) => s.settings);
  const messages = useAppStore((s) => s.messages);
  const analysis = useAppStore((s) => s.analysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const showToast = useAppStore((s) => s.showToast);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const floatingImeOpen = useAppStore((s) => s.floatingImeOpen);
  const setFloatingImeOpen = useAppStore((s) => s.setFloatingImeOpen);
  const setIceBreakerOpen = useAppStore((s) => s.setIceBreakerOpen);
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const resetChatContext = useAppStore((s) => s.resetChatContext);
  const deleteMessage = useAppStore((s) => s.deleteMessage);
  const addMessage = useAppStore((s) => s.addMessage);
  const importMessages = useAppStore((s) => s.importMessages);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const runGenerateReplies = useAppStore((s) => s.runGenerateReplies);

  const [expanded, setExpanded] = useState(() => loadExpanded());
  const [aiPanelOpen, setAiPanelOpen] = useState(() => loadFlag(IME_PANEL_KEY, true));
  const [panelMode, setPanelMode] = useState<PanelMode>(loadPanelMode);
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState('');
  const [activeStyle, setActiveStyle] = useState<ImeStyleId | null>(null);
  const [shift, setShift] = useState(false);
  const [langZh, setLangZh] = useState(true);
  const [layout, setLayout] = useState<KeyboardLayout>(loadLayout);
  const [composing, setComposing] = useState('');
  /** 汉字九键：锁定的拼音（如 ni），再从中选汉字 */
  const [lockedPinyin, setLockedPinyin] = useState<string | null>(null);
  const [t9DigitMode, setT9DigitMode] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const openIme = useCallback(() => {
    setExpanded(true);
    setAiPanelOpen(true);
    setFloatingImeOpen(true);
  }, [setFloatingImeOpen]);

  const closeIme = useCallback(() => {
    setExpanded(false);
    setFloatingImeOpen(false);
  }, [setFloatingImeOpen]);

  // 操作区小火龙：仅在外部请求打开时展开
  useEffect(() => {
    if (floatingImeOpen) {
      setExpanded(true);
      setAiPanelOpen(true);
    }
  }, [floatingImeOpen]);

  useEffect(() => {
    saveFlag(IME_EXPANDED_KEY, expanded);
  }, [expanded]);
  const ocrAbortRef = useRef<AbortController | null>(null);

  const replies = analysis?.replies?.slice(0, 4) ?? [];
  const contextHint = draft.trim() || getLastOther(messages);
  const firstReplyContent = replies[0]?.content ?? '';

  /** 九键始终按汉字拼音九键处理 */
  const t9Mode = layout === '9';
  const t9Result = t9Mode && composing ? getT9Candidates(composing, lockedPinyin) : null;
  const pinyinOptions = t9Result?.pinyinOptions ?? [];
  const candidates =
    composing
      ? t9Mode
        ? (t9Result?.candidates ?? [])
        : langZh
          ? getPinyinCandidates(composing)
          : []
      : [];
  const composingDisplay = t9Mode
    ? lockedPinyin || pinyinOptions[0]?.py || composing
    : composing;

  useEffect(() => {
    saveFlag(IME_PANEL_KEY, aiPanelOpen);
  }, [aiPanelOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(IME_PANEL_MODE_KEY, panelMode);
    } catch {
      /* ignore */
    }
  }, [panelMode]);

  useEffect(() => {
    try {
      localStorage.setItem(IME_LAYOUT_KEY, layout);
    } catch {
      /* ignore */
    }
  }, [layout]);

  useEffect(() => {
    if (firstReplyContent && activeStyle && !isAnalyzing) {
      setPreview(firstReplyContent);
    }
  }, [firstReplyContent, activeStyle, isAnalyzing]);

  useEffect(() => {
    return () => {
      ocrAbortRef.current?.abort();
    };
  }, []);

  const ensureContextMessage = useCallback(
    (text: string) => {
      const key = text.trim();
      if (!key) return;
      const existing = useAppStore.getState().messages;
      const last = [...existing].reverse().find((m) => m.role === 'other');
      if (last && last.content.trim() === key) return;
      addMessage('other', key);
      useAppStore.getState().clearAnalysis();
    },
    [addMessage]
  );

  const copyText = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast('已复制，可直接粘贴发送');
    } catch {
      showToast('复制失败');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast('剪贴板为空');
        return;
      }
      const trimmed = text.trim();
      setDraft(trimmed);
      ensureContextMessage(trimmed);
      showToast('已粘贴对方消息');
    } catch {
      showToast('无法读取剪贴板');
    }
  };

  const handleScreenshot = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    setOcrLoading(true);
    ocrAbortRef.current?.abort();
    const ac = new AbortController();
    ocrAbortRef.current = ac;
    try {
      const base64 = await prepareImageForOcr(file);
      const lines = await recognizeChatScreenshot(base64, settings, ac.signal);
      if (ac.signal.aborted) return;
      if (lines.length === 0) {
        showToast('未识别到对话内容');
        return;
      }
      importMessages(lines.map((p) => ({ role: p.role, content: p.content })));
      const lastOther = [...lines].reverse().find((m) => m.role === 'other');
      if (lastOther) setDraft(lastOther.content);
      showToast(`截图识别 ${lines.length} 条`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast(err instanceof Error ? err.message : '截图识别失败');
    } finally {
      if (ocrAbortRef.current === ac) setOcrLoading(false);
    }
  };

  const runStyle = async (styleId: ImeStyleId) => {
    const style = getImeReplyStyle(styleId);
    const text = contextHint.trim();
    if (!text) {
      showToast('先截图或粘贴 ta 的话');
      return;
    }
    if (isAnalyzing) {
      showToast('正在生成中…');
      return;
    }

    setActiveStyle(styleId);
    setAiPanelOpen(true);
    ensureContextMessage(text);

    // 有人设走恋爱模式；无则走 social 以 chatStyle+directive 为准，避免残留旧 lovePersona
    updateSettings({
      chatStyle: style.chatStyle,
      appMode: style.lovePersona ? 'love' : 'social',
      tonePreference: style.directive,
      ...(style.lovePersona ? { lovePersona: style.lovePersona } : {}),
    });

    showToast(`${style.emoji} ${style.label} · 生成中`);
    await runGenerateReplies();
  };

  const commitCandidate = useCallback((text: string) => {
    if (!text) return;
    setDraft((d) => d + text);
    setComposing('');
    setLockedPinyin(null);
  }, []);

  const clearComposing = useCallback(() => {
    setComposing('');
    setLockedPinyin(null);
  }, []);

  /** 键盘退格：只改草稿/拼音，不删聊天历史 */
  const handleBackspace = () => {
    if (lockedPinyin) {
      setLockedPinyin(null);
      return;
    }
    if (composing) {
      setComposing((c) => c.slice(0, -1));
      return;
    }
    if (draft) {
      setDraft((d) => d.slice(0, -1));
      return;
    }
  };

  /** 面板「删除」：删最后一条上下文 */
  const handleDeleteLastMessage = () => {
    if (composing || draft) {
      handleBackspace();
      return;
    }
    const last = messages[messages.length - 1];
    if (last) {
      deleteMessage(last.id);
      showToast('已删除最后一条');
    } else {
      showToast('没有可删除内容');
    }
  };

  const handleClearContext = () => {
    resetChatContext();
    setDraft('');
    setPreview('');
    clearComposing();
    setActiveStyle(null);
    showToast('已清除上下文');
  };

  const pickFromComposing = useCallback((): string => {
    if (!composing) return '';
    if (layout === '9') {
      return getT9Candidates(composing, lockedPinyin).candidates[0] ?? '';
    }
    return getPinyinCandidates(composing)[0] ?? composing;
  }, [composing, layout, lockedPinyin]);

  const flushComposing = useCallback((): string => {
    if (!composing) return '';
    const pick = pickFromComposing();
    const text = pick || (layout === '9' ? '' : composing);
    if (text) setDraft((d) => d + text);
    clearComposing();
    return text;
  }, [composing, layout, pickFromComposing, clearComposing]);

  const handleSend = async () => {
    const aiText = preview.trim() || firstReplyContent.trim();
    if (aiText) {
      if (composing) clearComposing();
      await copyText(aiText);
      return;
    }
    const flushed = composing ? flushComposing() : '';
    const text = `${draft}${flushed}`.trim();
    if (!text) {
      showToast('还没有可发送的内容');
      return;
    }
    await copyText(text);
  };

  const insertKey = (key: string) => {
    if (layout === '9' && isT9Digit(key)) {
      setLockedPinyin(null);
      setComposing((c) => c + key);
      setLangZh(true);
      return;
    }
    if (langZh && layout === '26' && isPinyinLetter(key)) {
      setComposing((c) => c + key.toLowerCase());
      return;
    }
    if (composing) {
      const pick = pickFromComposing();
      setDraft((d) => d + (pick || (layout === '26' ? composing : '')) + key);
      clearComposing();
      return;
    }
    setDraft((d) => d + key);
  };

  const handleSpace = () => {
    if (composing) {
      // 汉字九键：空格 = 上屏首选汉字
      if (layout === '9') {
        if (!lockedPinyin && pinyinOptions[0]) {
          // 先锁定首选拼音，若已有汉字则直接上屏
          const first = pinyinOptions[0];
          if (first.chars[0]) {
            commitCandidate(first.chars[0]);
            return;
          }
          setLockedPinyin(first.py);
          return;
        }
        const pick = candidates[0];
        if (pick) commitCandidate(pick);
        else clearComposing();
        return;
      }
      if (langZh) {
        const pick = candidates[0];
        if (pick) commitCandidate(pick);
        else {
          setDraft((d) => d + composing);
          clearComposing();
        }
        return;
      }
    }
    setDraft((d) => d + ' ');
  };

  const handleT9Key = (digit: string) => {
    if (t9DigitMode) {
      setDraft((d) => d + digit);
      return;
    }
    setLangZh(true);
    if (digit === '0') {
      if (composing) handleSpace();
      else setDraft((d) => d + '0');
      return;
    }
    if (digit === '1') {
      // 分词：在拼音数字串中插入分隔
      if (!composing) return;
      if (composing.endsWith("'")) return;
      setLockedPinyin(null);
      setComposing((c) => c + "'");
      return;
    }
    setLockedPinyin(null);
    setComposing((c) => c + digit);
  };

  const insertPunct = (ch: string) => {
    if (composing) {
      const pick = pickFromComposing();
      setDraft((d) => d + (pick || '') + ch);
      clearComposing();
      return;
    }
    setDraft((d) => d + ch);
  };

  const toggleLang = () => {
    if (layout === '9') {
      // 汉字九键下「英」切到全键英文；回中文保持九键
      if (langZh) {
        if (composing) clearComposing();
        setLangZh(false);
        setLayout('26');
        showToast('已切换英文全键');
      } else {
        setLangZh(true);
        setLayout('9');
        showToast('已切换汉字九键');
      }
      return;
    }
    if (composing) flushComposing();
    setLangZh((v) => !v);
  };

  const toggleLayout = () => {
    if (composing) clearComposing();
    setLayout((v) => {
      const next = v === '9' ? '26' : '9';
      if (next === '9') {
        setLangZh(true);
        showToast('汉字九键');
      } else {
        showToast('拼音全键');
      }
      return next;
    });
  };

  const modeBadge = layout === '9' ? '汉字九键' : langZh ? '拼音全键' : 'EN';

  const openProfiles = () => {
    useAppStore.getState().setActivePanel('love');
    setLoveSubTab('partners');
    showToast('选择资料卡');
  };

  const selectPanelMode = (mode: PanelMode) => {
    setPanelMode(mode);
    if (mode === 'analysis') {
      updateSettings({ chatStyle: 'all_in_one', appMode: 'love' });
      showToast('分析模式：心思 → 策略 → 怎么回');
    } else {
      showToast(mode === 'minimal' ? '极简模式' : '完整模式');
    }
  };

  const ModeSwitcher = (
    <div className="flex items-center gap-1 shrink-0">
      {PANEL_MODE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => selectPanelMode(opt.id)}
          className={`ime-chip !px-2 ${
            panelMode === opt.id
              ? '!bg-orange-500 !text-white !border-orange-500 font-semibold'
              : ''
          }`}
        >
          {opt.label.replace('模式', '')}
        </button>
      ))}
    </div>
  );

  const runAnalysisMode = async () => {
    const text = contextHint.trim();
    if (!text) {
      showToast('先截图或粘贴 ta 的话');
      return;
    }
    if (isAnalyzing) {
      showToast('正在分析中…');
      return;
    }
    setActiveStyle(null);
    ensureContextMessage(text);
    updateSettings({
      chatStyle: 'all_in_one',
      appMode: 'love',
      tonePreference:
        '风格：独创分析模式。先读心再定策略再给话术；输出自然可发送短句。',
    });
    showToast('🔍 分析模式 · 生成中');
    await runGenerateReplies();
  };

  const mindText =
    analysis?.psychology?.subtext ||
    analysis?.psychology?.emotionalState ||
    analysis?.summary ||
    '';
  const strategyText =
    analysis?.strategy?.coreStrategy ||
    analysis?.strategy?.nextMove ||
    analysis?.femalePsychology?.replyPrinciple ||
    '';
  const whyText = analysis?.strategy?.whyStrategy || '';

  if (settingsOpen) return null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  /* 收起：小火龙悬浮球（手机/平板/桌面均 portal 到 body，避免被 overflow 裁切） */
  if (!expanded) {
    const fab = (
      <button
        type="button"
        onClick={openIme}
        className="ime-fab ime-dragon-fab fixed z-[60] flex items-center justify-center touch-manipulation"
        title="打开灵焰小火龙输入法"
        aria-label="打开灵焰小火龙输入法"
      >
        <LingyanDragonIcon className="ime-dragon-face w-11 h-11" />
        <span className="ime-dragon-pulse" aria-hidden />
      </button>
    );
    return portalTarget ? createPortal(fab, portalTarget) : fab;
  }

  const shell = (
    <div className="ime-root fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
      {/* 手机：半透明遮罩点按收起；平板/桌面不挡操作 */}
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 bg-black/40 md:hidden"
        aria-label="收起输入法"
        onClick={closeIme}
      />

      <div className="ime-shell relative z-[1] flex flex-col pointer-events-none w-full">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleScreenshot(file);
        }}
      />

      {/* AI 风格面板 */}
      {aiPanelOpen && (
        <div className="ime-ai-panel pointer-events-auto mx-auto w-full max-w-md px-2 pb-5 relative shrink min-h-0">
          <div className="relative rounded-2xl border-2 border-orange-400/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-orange-900/15 overflow-visible">
            <div className="rounded-2xl overflow-hidden">
            {/* 顶栏：模式三选一始终可见 */}
            <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1.5 overflow-x-auto no-scrollbar">
              {panelMode !== 'minimal' && (
                <>
                  <button
                    type="button"
                    onClick={() => setIceBreakerOpen(true)}
                    className="ime-chip shrink-0 w-8 h-8 rounded-full border border-orange-200 bg-orange-50 text-orange-600 flex items-center justify-center"
                    title="更多"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIceBreakerOpen(true)}
                    className="ime-chip shrink-0"
                  >
                    开启话题
                  </button>
                </>
              )}
              {ModeSwitcher}
              {panelMode !== 'minimal' && (
                <button type="button" onClick={openProfiles} className="ime-chip shrink-0">
                  选择资料卡
                </button>
              )}
              <button
                type="button"
                onClick={() => setAiPanelOpen(false)}
                className="ml-auto shrink-0 w-8 h-8 rounded-lg text-orange-500/80 hover:bg-orange-50 flex items-center justify-center"
                title="收起面板"
              >
                <Keyboard className="w-4 h-4" />
              </button>
            </div>

            {/* 指引：点相册截图；点灯泡/文案旁可粘贴 */}
            <div className="mx-2.5 mb-2 flex items-center gap-2 rounded-xl bg-orange-50/90 border border-orange-100 px-2.5 py-2 w-[calc(100%-1.25rem)]">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="shrink-0 p-0.5"
                title="截图识别"
              >
                {ocrLoading ? (
                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-orange-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void handlePaste()}
                className="text-[11px] text-orange-800/85 leading-snug flex-1 text-left"
              >
                {panelMode === 'analysis'
                  ? '先截图或粘贴 ta 的话，再点「开始分析」：心思 → 策略 → 怎么回'
                  : '先点击截图或粘贴 ta 的话，再选择以下风格帮你回'}
              </button>
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>

            {/* 上下文草稿 */}
            {(draft || contextHint) && (
              <div className="mx-2.5 mb-2 rounded-lg bg-stone-50 border border-stone-100 px-2 py-1.5 flex items-start gap-1.5">
                <p className="flex-1 text-[11px] text-stone-600 leading-snug line-clamp-2">
                  {draft || contextHint}
                </p>
                <button
                  type="button"
                  onClick={() => setDraft('')}
                  className="shrink-0 p-0.5 text-stone-400"
                  title="清空草稿"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 分析模式：教练路径 */}
            {panelMode === 'analysis' && (
              <div className="px-2.5 pb-2 space-y-2">
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => void runAnalysisMode()}
                  className="w-full rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 text-white text-sm font-semibold py-2.5 shadow-md shadow-orange-500/25 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> 分析中…
                    </>
                  ) : (
                    <>🔍 开始分析</>
                  )}
                </button>
                <div className="rounded-xl border border-orange-100 bg-orange-50/50 px-2.5 py-2 space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-orange-600 mb-0.5">① 她什么心思</p>
                    <p className="text-[12px] text-stone-700 leading-snug">
                      {mindText || (isAnalyzing ? '读心中…' : '粘贴对方消息后点「开始分析」')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-600 mb-0.5">② 我用什么策略</p>
                    <p className="text-[12px] text-stone-700 leading-snug">
                      {strategyText || (isAnalyzing ? '定策中…' : '—')}
                    </p>
                    {whyText && (
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">为什么：{whyText}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-600 mb-0.5">③ 我怎么回</p>
                    <p className="text-[12px] text-stone-700 leading-snug">
                      {preview || firstReplyContent || (isAnalyzing ? '生成话术中…' : '—')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={handleDeleteLastMessage} className="ime-side-btn flex-1">
                    删除
                  </button>
                  <button type="button" onClick={handleClearContext} className="ime-side-btn flex-1">
                    清除上文
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={isAnalyzing || !(preview || firstReplyContent)}
                    className="ime-send-btn flex-[1.4] min-h-[2.35rem] disabled:opacity-40"
                  >
                    发送
                  </button>
                </div>
                {replies.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {replies.slice(0, 4).map((r, i) => (
                      <button
                        key={`${r.category}-${i}`}
                        type="button"
                        onClick={() => {
                          setPreview(r.content);
                          void copyText(r.content);
                        }}
                        className="text-[10px] px-2 py-1 rounded-full bg-white border border-orange-100 text-stone-600 max-w-full truncate"
                      >
                        {r.label}：{r.content}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 极简 / 完整：风格宫格 */}
            {panelMode !== 'analysis' && (
              <div className="px-2.5 pb-2.5 grid grid-cols-[1fr_auto] gap-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {IME_REPLY_STYLES.map((style) => {
                    const busy = isAnalyzing && activeStyle === style.id;
                    const active = activeStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => void runStyle(style.id)}
                        className={`ime-style-btn ${active ? 'ime-style-btn-active' : ''} disabled:opacity-55`}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        ) : (
                          <span className="text-base leading-none">{style.emoji}</span>
                        )}
                        <span className="text-[11px] font-medium text-stone-700">{style.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5 w-[4.5rem]">
                  <button type="button" onClick={handleDeleteLastMessage} className="ime-side-btn">
                    删除
                  </button>
                  <button type="button" onClick={handleClearContext} className="ime-side-btn">
                    清除上文
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={isAnalyzing}
                    className="ime-send-btn flex-1 min-h-[3.25rem]"
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '发送'}
                  </button>
                </div>
              </div>
            )}

            {/* 生成结果（分析模式已内嵌展示，此处跳过） */}
            {panelMode !== 'analysis' && (preview || replies.length > 0) && (
              <div className="border-t border-orange-100 px-2.5 py-2 space-y-1.5 bg-orange-50/40">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-orange-700/80 font-medium">
                    {isAnalyzing ? '生成中…' : '可发送话术'}
                  </p>
                  {preview && (
                    <button
                      type="button"
                      onClick={() => void copyText(preview)}
                      className="text-[10px] text-orange-600 inline-flex items-center gap-0.5"
                    >
                      <Copy className="w-3 h-3" /> 复制
                    </button>
                  )}
                </div>
                {preview && (
                  <p className="text-[13px] text-stone-800 leading-snug font-medium">{preview}</p>
                )}
                {replies.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {replies.slice(0, 3).map((r, i) => (
                      <button
                        key={`${r.category}-${i}`}
                        type="button"
                        onClick={() => {
                          setPreview(r.content);
                          void copyText(r.content);
                        }}
                        className="text-[10px] px-2 py-1 rounded-full bg-white border border-orange-100 text-stone-600 max-w-full truncate"
                      >
                        {r.content}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            </div>
            {/* 指向小火龙的小三角 */}
            <div className="absolute -bottom-1.5 right-7 w-3 h-3 rotate-45 bg-white border-r-2 border-b-2 border-orange-400/80" />
          </div>
          <button
            type="button"
            onClick={closeIme}
            className="ime-dragon-peek absolute -bottom-1 right-3 z-10"
            title="收起为小火龙悬浮球"
            aria-label="收起为小火龙悬浮球"
          >
            <LingyanDragonIcon className="w-9 h-9" />
          </button>
        </div>
      )}

      {/* 键盘主体 */}
      <div
        className={`ime-keyboard pointer-events-auto w-full shadow-[0_-8px_24px_rgba(0,0,0,0.35)] ${
          layout === '9' ? 'ime-keyboard-dark' : 'bg-[#d1d3d9] border-t border-stone-300/80'
        }`}
      >
        {/* 工具条 */}
        <div
          className={`flex items-center gap-1 px-2 h-10 ${
            layout === '9' ? 'bg-black/80' : 'bg-[#c8cad0]/90'
          }`}
        >
          <button
            type="button"
            onClick={() => useAppStore.getState().setSettingsOpen(true)}
            className={`ime-toolbar-btn ${layout === '9' ? 'text-zinc-300' : ''}`}
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleLayout}
            className={`ime-toolbar-btn ${layout === '9' ? 'text-orange-400' : ''}`}
            title={layout === '9' ? '切换全键盘' : '切换九键'}
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void handlePaste()}
            className={`ime-toolbar-btn ${layout === '9' ? 'text-zinc-300' : ''}`}
            title="粘贴"
          >
            <Clipboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`ime-toolbar-btn ${layout === '9' ? 'text-zinc-300' : ''}`}
            title="截图识别"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setAiPanelOpen((v) => !v)}
            className="ime-dragon-mini"
            title="灵焰小火龙"
            aria-label="切换 AI 面板"
          >
            <LingyanDragonIcon className="w-7 h-7" />
          </button>

          <button
            type="button"
            onClick={closeIme}
            className={`ime-toolbar-btn text-[11px] px-2 ${layout === '9' ? 'text-zinc-300' : ''}`}
            title="收起输入法"
          >
            收起
          </button>
        </div>

        {/* 输入预览条 */}
        <div className={`px-2 py-1.5 ${layout === '9' ? 'bg-black' : 'bg-[#d8dae0]'}`}>
          <div
            className={`rounded-lg px-2.5 py-1.5 min-h-[36px] flex items-center gap-1 ${
              layout === '9'
                ? 'bg-zinc-900 border border-zinc-700'
                : 'bg-white/90 border border-stone-200/80'
            }`}
          >
            <p
              className={`text-sm flex-1 truncate ${layout === '9' ? 'text-zinc-100' : 'text-stone-800'}`}
            >
              {!draft && !composing && (
                <span className={layout === '9' ? 'text-zinc-500' : 'text-stone-400'}>
                  {layout === '9' ? '汉字九键 · 选拼音再选字' : '点风格生成，或拼音打字 / 粘贴…'}
                </span>
              )}
              {draft}
              {composing && (
                <span className="text-orange-400 underline decoration-orange-500/80 decoration-2 underline-offset-2">
                  {composingDisplay}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={toggleLayout}
              className="shrink-0 text-[10px] text-orange-400 px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/40 font-medium"
            >
              {modeBadge}
            </button>
          </div>
        </div>

        {/* 汉字九键候选 */}
        {layout === '9' && composing && (
          <div className="px-1.5 pb-1 bg-black space-y-1">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-zinc-900 border border-zinc-700 px-1 py-1 min-h-[36px]">
              {pinyinOptions.length === 0 ? (
                <span className="text-[11px] text-zinc-500 px-2">继续按键或点分词…</span>
              ) : (
                pinyinOptions.map((opt) => (
                  <button
                    key={opt.py}
                    type="button"
                    onClick={() => setLockedPinyin(opt.py)}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-[13px] font-semibold ${
                      (lockedPinyin ?? pinyinOptions[0]?.py) === opt.py
                        ? 'bg-orange-500 text-white'
                        : 'text-zinc-200 active:bg-zinc-700'
                    }`}
                  >
                    {opt.py}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-zinc-900 border border-zinc-700 px-1 py-1 min-h-[44px]">
              {candidates.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  onClick={() => commitCandidate(c)}
                  className={`shrink-0 px-3 py-1.5 rounded-md text-[17px] font-medium ${
                    i === 0
                      ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/50'
                      : 'text-zinc-100 active:bg-zinc-800'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 全键拼音候选 */}
        {layout === '26' && langZh && composing && (
          <div className="px-1.5 pb-1 bg-[#d8dae0]">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-white border border-stone-200/80 px-1 py-1 min-h-[40px]">
              {candidates.length === 0 ? (
                <span className="text-[11px] text-stone-400 px-2">无候选，点空格上屏拼音</span>
              ) : (
                candidates.map((c, i) => (
                  <button
                    key={`${c}-${i}`}
                    type="button"
                    onClick={() => commitCandidate(c)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-md text-[15px] font-medium active:bg-orange-100 ${
                      i === 0 ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-300' : 'text-stone-800'
                    }`}
                  >
                    <span className="text-[10px] text-stone-400 mr-1">{i + 1}</span>
                    {c}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {layout === '9' ? (
          /* ===== 深色汉字九键（对照参考图） ===== */
          <div className="ime-t9-dark-pad select-none px-1.5 pt-1 pb-2">
            <div className="ime-t9-frame">
              {/* 左：标点列 */}
              <div className="ime-t9-left">
                {T9_LEFT_PUNCTS.map((p) => (
                  <button key={p} type="button" className="ime-t9-dk" onClick={() => insertPunct(p)}>
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="ime-t9-dk ime-t9-dk-muted"
                  onClick={() => {
                    setT9DigitMode(false);
                    showToast('符号：左侧可快速输入，更多可切全键');
                  }}
                >
                  符
                </button>
              </div>

              {/* 中：3×3 + 底栏 */}
              <div className="ime-t9-mid">
                <div className="ime-t9-grid">
                  {T9_CENTER.flat().map((key) => (
                    <button
                      key={key.digit}
                      type="button"
                      className="ime-t9-dk ime-t9-main"
                      onClick={() => handleT9Key(key.digit)}
                    >
                      <span className="ime-t9-num">{key.digit}</span>
                      <span className="ime-t9-label">{key.label}</span>
                    </button>
                  ))}
                </div>
                <div className="ime-t9-bottom">
                  <button
                    type="button"
                    className={`ime-t9-dk ime-t9-dk-muted ${t9DigitMode ? 'ring-1 ring-orange-400' : ''}`}
                    onClick={() => {
                      setT9DigitMode((v) => !v);
                      showToast(t9DigitMode ? '已关闭数字模式' : '数字模式：按键直接上屏数字');
                    }}
                  >
                    123
                  </button>
                  <button type="button" className="ime-t9-dk ime-t9-space" onClick={handleSpace}>
                    <span className="text-[13px] font-medium text-zinc-200">
                      {composing ? '选定' : '空格'}
                    </span>
                  </button>
                  <button type="button" className="ime-t9-dk ime-t9-dk-muted" onClick={toggleLang}>
                    中/英
                  </button>
                </div>
              </div>

              {/* 右：功能列 */}
              <div className="ime-t9-right">
                <button type="button" className="ime-t9-dk ime-t9-dk-muted" onClick={handleBackspace}>
                  <Delete className="w-5 h-5 mx-auto" />
                </button>
                <button
                  type="button"
                  className="ime-t9-dk ime-t9-dk-muted text-[13px] font-medium"
                  onClick={clearComposing}
                >
                  清空
                </button>
                <button type="button" className="ime-t9-dk ime-t9-main" onClick={() => handleT9Key('0')}>
                  <span className="text-xl font-semibold">0</span>
                </button>
                <button
                  type="button"
                  className="ime-t9-dk ime-t9-dk-muted"
                  onClick={() => void handleSend()}
                >
                  <CornerDownLeft className="w-5 h-5 mx-auto" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-1.5 pb-1.5 pt-0.5 space-y-1.5 select-none">
            {LETTER_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex justify-center gap-[3px]">
                {rowIdx === 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (langZh && candidates[0]) commitCandidate(candidates[0]);
                      else setShift((s) => !s);
                    }}
                    className={`ime-key ime-key-fn w-10 ${shift && !langZh ? 'bg-stone-300' : ''}`}
                  >
                    {langZh ? '选' : '词'}
                  </button>
                )}
                {row.map((k) => {
                  const ch = !langZh && shift ? k.toUpperCase() : k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        insertKey(ch);
                        if (shift) setShift(false);
                      }}
                      className="ime-key flex-1 max-w-[2.15rem]"
                    >
                      {langZh ? k : ch}
                    </button>
                  );
                })}
                {rowIdx === 2 && (
                  <button type="button" onClick={handleBackspace} className="ime-key ime-key-fn w-10">
                    <Delete className="w-4 h-4 mx-auto" />
                  </button>
                )}
              </div>
            ))}

            <div className="flex justify-center gap-[3px] items-stretch">
              <button type="button" onClick={toggleLang} className="ime-key ime-key-fn w-9">
                <Globe className="w-4 h-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={toggleLayout}
                className="ime-key ime-key-fn w-10 text-[11px] font-semibold"
              >
                九
              </button>
              <button
                type="button"
                onClick={() => insertKey(langZh ? '，' : ',')}
                className="ime-key ime-key-fn w-8 text-[13px]"
              >
                ，
              </button>
              <button type="button" onClick={handleSpace} className="ime-key flex-[3] text-[12px] text-stone-500">
                {langZh && composing ? '选定' : '空格'}
              </button>
              <button
                type="button"
                onClick={toggleLang}
                className={`ime-key ime-key-fn w-11 text-[11px] ${langZh ? 'ring-1 ring-orange-400 bg-orange-50' : ''}`}
              >
                {langZh ? '中' : 'EN'}
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                className="ime-key ime-key-send w-12 text-[13px] font-semibold"
              >
                发送
              </button>
            </div>
          </div>
        )}

        <div
          className={`h-[env(safe-area-inset-bottom,0px)] ${layout === '9' ? 'bg-black' : 'bg-[#d1d3d9]'}`}
        />
      </div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(shell, portalTarget) : shell;
}
