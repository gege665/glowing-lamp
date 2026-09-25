import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { REPLY_CATEGORY_LABELS, REPLY_SUGGESTION_COUNT, type ReplyCategory } from '../types';
import { REPLY_STYLE_COUNT } from '../constants/analysisPrompts';
import {
  resolveReplyStyles,
  resolveReplyGroupHeaders,
  pickStylesForGeneration,
} from '../constants/replyStylePrompts';
import ReplyBubbleCard from './ReplyBubbleCard';
import SavedRepliesPanel from './SavedRepliesPanel';
import PersonaStyleGrid from './PersonaStyleGrid';
import { addSavedReply } from '../services/storageService';
import {
  formatActiveModelDisplay,
  formatManualDualModelProgress,
  resolveModelForSettings,
  supportsAutoModelRouting,
} from '../constants/modelRouting';

const CATEGORY_TAGS: Record<ReplyCategory, string> = {
  gentleWarm: 'bg-amber-500/20 text-amber-300',
  soberRational: 'bg-slate-500/20 text-slate-300',
  lightHumor: 'bg-yellow-500/20 text-yellow-300',
  coolFrame: 'bg-zinc-500/20 text-zinc-300',
  delicateEmpathy: 'bg-rose-500/20 text-rose-300',
  cleanYouth: 'bg-sky-500/20 text-sky-300',
  lightFlirt: 'bg-pink-500/20 text-pink-300',
  steadyMature: 'bg-indigo-500/20 text-indigo-300',
  minimalDirect: 'bg-teal-500/20 text-teal-300',
  deepHeart: 'bg-violet-500/20 text-violet-300',
  playful: 'bg-yellow-500/20 text-yellow-300',
  warmCare: 'bg-amber-500/20 text-amber-300',
  easyCompanion: 'bg-emerald-500/20 text-emerald-300',
  rationalSteady: 'bg-slate-500/20 text-slate-300',
  flirtInteract: 'bg-pink-500/20 text-pink-300',
  doting: 'bg-rose-500/20 text-rose-300',
  detailInteract: 'bg-fuchsia-500/20 text-fuchsia-300',
  openEnd: 'bg-purple-500/20 text-purple-300',
  exaggerateTease: 'bg-orange-500/20 text-orange-300',
  reverseTease: 'bg-lime-500/20 text-lime-300',
  psychological: 'bg-violet-500/20 text-violet-300',
  pushPull: 'bg-pink-600/20 text-pink-200',
  lightSuppress: 'bg-red-500/20 text-red-300',
  catMouse: 'bg-indigo-500/20 text-indigo-300',
  frameLead: 'bg-blue-500/20 text-blue-300',
  paceControl: 'bg-cyan-500/20 text-cyan-300',
  colloquialSnap: 'bg-stone-500/20 text-stone-300',
  sameFeeling: 'bg-sky-500/20 text-sky-300',
  oneQuestion: 'bg-blue-500/20 text-blue-300',
  clearAttitude: 'bg-indigo-500/20 text-indigo-300',
  easyLanding: 'bg-neutral-500/20 text-neutral-300',
  concise: 'bg-teal-500/20 text-teal-300',
  detailed: 'bg-cyan-500/20 text-cyan-300',
  interactive: 'bg-violet-500/20 text-violet-300',
};

function GroupHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-1 py-2 sticky top-0 bg-soul-950/85 backdrop-blur-sm z-10 border-b border-soul-800/40 mb-1">
      <p className="text-xs text-soul-300 font-medium">{title}</p>
      {subtitle && <p className="text-[10px] text-soul-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function ReplyPanel() {
  const analysis = useAppStore((s) => s.analysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const streamProgress = useAppStore((s) => s.streamProgress);
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const addMessage = useAppStore((s) => s.addMessage);
  const showToast = useAppStore((s) => s.showToast);
  const notifySavedRepliesChanged = useAppStore((s) => s.notifySavedRepliesChanged);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const lastOther = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'other') return messages[i].content;
    }
    return '';
  }, [messages]);

  const activeStyles = useMemo(
    () => pickStylesForGeneration(resolveReplyStyles(settings, lastOther), settings),
    [settings, lastOther]
  );
  const groupHeaders = useMemo(
    () => resolveReplyGroupHeaders(activeStyles),
    [activeStyles]
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const isReplyPhase =
    streamProgress.phase === 'replies' ||
    streamProgress.phase === 'finishing' ||
    (streamProgress.replyPreviews?.length ?? 0) > 0;

  const replyModelHint =
    isAnalyzing && isReplyPhase && supportsAutoModelRouting(settings.provider)
      ? formatManualDualModelProgress(settings, streamProgress.phase) ||
        `话术模型：${formatActiveModelDisplay(
          streamProgress.activeModel ?? resolveModelForSettings('chat', settings),
          settings.provider
        )}`
      : '';

  useEffect(() => {
    if (isAnalyzing && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamProgress, isAnalyzing]);

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast('已复制话术');
    } catch {
      showToast('复制失败，请手动选择文本复制');
    }
  };

  const handleSend = (content: string) => {
    addMessage('me', content);
    showToast('已添加到对话');
    setActivePanel('chat');
  };

  const groupHeaderAt = (index: number) =>
    groupHeaders.find((h) => h.index === index);

  if (isAnalyzing) {
    const previews = streamProgress.replyPreviews ?? [];
    const doneLabels = new Set(previews.map((r) => r.label));

    return (
      <div className="panel-card h-full flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-soul-700/30 shrink-0">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
            <h2 className="font-semibold text-soul-200">话术推荐</h2>
            {isReplyPhase && (
              <span className="tag bg-pink-500/20 text-pink-300">
                {previews.length}/{REPLY_SUGGESTION_COUNT}
              </span>
            )}
          </div>
          <p className="text-xs text-soul-500 mt-1">{streamProgress.message}</p>
          {replyModelHint && (
            <p className="text-[11px] text-pink-400/90 mt-0.5">{replyModelHint}</p>
          )}
        </div>

        <div ref={streamRef} className="flex-1 overflow-y-auto scroll-touch p-3 flex flex-col gap-3 min-h-0">
          <div className="flex flex-wrap gap-1.5">
            {activeStyles.map((style) => {
              const done = doneLabels.has(style.label);
              return (
                <span
                  key={style.label}
                  className={`tag text-xs transition-colors ${
                    done
                      ? 'bg-pink-500/25 text-pink-200 border border-pink-400/40'
                      : 'bg-soul-800/60 text-soul-500 border border-soul-700/40'
                  }`}
                >
                  {style.label}
                  {done ? ' ✓' : ''}
                </span>
              );
            })}
          </div>

          {!isReplyPhase && (
            <p className="text-soul-500 text-xs text-center py-4 animate-pulse">话术生成即将开始…</p>
          )}

          {isReplyPhase && previews.length === 0 && (
            <p className="text-soul-500 text-xs text-center py-4 animate-pulse">正在生成第一条话术…</p>
          )}

          {previews.slice(-4).map((reply, i) => (
            <ReplyBubbleCard
              key={`${reply.label}-${i}`}
              label={reply.label}
              tagClass="bg-pink-500/20 text-pink-300"
              content={reply.content}
              isExpanded
              showActions={false}
              className="border-pink-500/25 bg-pink-900/10 animate-fade-in"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!analysis || analysis.replies.length === 0) {
    return (
      <div className="panel-card h-full flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-soul-700/30 shrink-0 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-soul-400" />
          <h2 className="font-semibold text-soul-200">话术推荐</h2>
        </div>
        <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-4 min-h-0">
          <div className="text-center space-y-2 py-2">
            <p className="text-soul-300 text-sm font-medium">
              {messages.length > 0
                ? '选一个人设风格，或去左侧点「智能生成话术」'
                : '粘贴对方消息后，再选风格帮你回'}
            </p>
          </div>
          <PersonaStyleGrid disabled={messages.length === 0} />
        </div>
      </div>
    );
  }

  const filledReplyCount = analysis.replies.filter((r) => r.content.trim().length >= 2).length;

  if (filledReplyCount === 0) {
    return (
      <div className="panel-card h-full flex flex-col items-center justify-center gap-4 p-6">
        <MessageSquare className="w-14 h-14 text-soul-500/40" />
        <div className="text-center">
          <p className="text-soul-300 font-medium mb-1">话术未成功生成</p>
          <p className="text-soul-500 text-sm">
            请点击左侧「重新分析」，或到设置中更换话术模型后重试
          </p>
          {analysis.summary && (
            <p className="text-soul-600 text-xs mt-2">分析摘要：{analysis.summary}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-soul-700/30 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-soul-400" />
          <h2 className="font-semibold text-soul-200">话术推荐</h2>
          <span className="tag bg-soul-800 text-soul-300">
            {filledReplyCount}/{REPLY_SUGGESTION_COUNT} 条
          </span>
        </div>
        <p className="text-xs text-soul-500 mt-1">
          {analysis.summary || '话术推荐'} · {REPLY_SUGGESTION_COUNT} 种风格 · 可直接复制发送
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-touch p-3 sm:p-3 space-y-2.5 min-h-0 overscroll-y-contain">
        <details className="rounded-xl border border-soul-700/30 bg-soul-950/30 open:pb-2">
          <summary className="px-3 py-2 text-xs text-soul-400 cursor-pointer select-none">
            换个人设风格再生成
          </summary>
          <div className="px-2 pt-1">
            <PersonaStyleGrid />
          </div>
        </details>
        <SavedRepliesPanel onUse={(content) => addMessage('me', content)} />
        {filledReplyCount > 0 && filledReplyCount < REPLY_STYLE_COUNT && (
          <p className="text-xs text-amber-400/90 px-1">
            当前 {filledReplyCount} 条，可点击「重新分析」补全
          </p>
        )}
        {analysis.replies.map((reply, index) => {
          if (reply.content.trim().length < 2) return null;
          const cat = reply.category as ReplyCategory;
          const tagClass = CATEGORY_TAGS[cat] || CATEGORY_TAGS.warmCare;
          const label = reply.label || REPLY_CATEGORY_LABELS[cat] || reply.category;
          const isExpanded = expandedId === `${index}`;
          const header = groupHeaderAt(index);

          return (
            <div key={index}>
              {header && <GroupHeader title={header.title} subtitle={header.subtitle} />}
              <ReplyBubbleCard
                label={label}
                tagClass={tagClass}
                content={reply.content}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedId(isExpanded ? null : `${index}`)}
                onCopy={() => handleCopy(reply.content)}
                onSend={() => handleSend(reply.content)}
                onSave={() => {
                  addSavedReply({ content: reply.content, label: label });
                  notifySavedRepliesChanged();
                  showToast('已收藏到话术工坊');
                }}
                className="animate-slide-up"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
