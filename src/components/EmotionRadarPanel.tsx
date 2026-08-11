import { useMemo, useState } from 'react';
import {
  Radar,
  Heart,
  Eye,
  MessageCircle,
  Target,
  Sparkles,
  Loader2,
  Shield,
  Copy,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { dissectFromAnalysis, instantDissectMessage } from '../constants/emotionRadar';
import { EmotionRadarSection } from './AnalysisInsights';

function Meter({
  label,
  value,
  color = 'from-cyan-500 to-pink-500',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-soul-400">{label}</span>
        <span className="text-soul-200 font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-soul-800 overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Layer({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: typeof Eye;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accent}`}>
      <p className="text-[10px] mb-1 flex items-center gap-1 opacity-80">
        <Icon className="w-3 h-3" />
        {title}
      </p>
      <p className="text-[13px] text-soul-100 leading-snug">{body}</p>
    </div>
  );
}

/** 灵焰情绪雷达分析模式主面板 */
export default function EmotionRadarPanel() {
  const messages = useAppStore((s) => s.messages);
  const analysis = useAppStore((s) => s.analysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const runAnalysis = useAppStore((s) => s.runAnalysis);
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const showToast = useAppStore((s) => s.showToast);
  const [focusId, setFocusId] = useState<string | null>(null);

  const otherMessages = useMemo(
    () => messages.filter((m) => m.role === 'other' && m.content.trim()),
    [messages]
  );

  const focusMsg = useMemo(() => {
    if (focusId) {
      const found = otherMessages.find((m) => m.id === focusId);
      if (found) return found;
    }
    return otherMessages[otherMessages.length - 1] ?? null;
  }, [focusId, otherMessages]);

  const lastOther = focusMsg?.content.trim() ?? '';

  const dissect = useMemo(() => {
    // 聚焦非最后一句时用本地即时拆解；最后一句优先用 AI 结果
    const isLatest =
      !focusMsg || focusMsg.id === otherMessages[otherMessages.length - 1]?.id;
    if (isLatest && analysis) {
      return dissectFromAnalysis(analysis) ?? instantDissectMessage(lastOther);
    }
    return instantDissectMessage(lastOther);
  }, [analysis, lastOther, focusMsg, otherMessages]);

  const fromAi = Boolean(
    analysis &&
      (!focusMsg || focusMsg.id === otherMessages[otherMessages.length - 1]?.id) &&
      dissectFromAnalysis(analysis)
  );

  const copyHint = async () => {
    try {
      await navigator.clipboard.writeText(dissect.replyHint);
      showToast('已复制回复方向');
    } catch {
      showToast('复制失败');
    }
  };

  const scanFocus = () => {
    if (!focusMsg) return;
    // 分析始终以该条为目标
    void runAnalysis(focusMsg.id);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-soul-950/70 to-pink-950/30 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-900/30">
            <Radar className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-cyan-100">灵焰情绪雷达分析</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              表层话术 · 深层情绪 · 潜台词 · 真实态度 · 精准拿捏分寸
            </p>
          </div>
          {fromAi ? (
            <span className="tag text-[10px] bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 shrink-0">
              AI 精拆
            </span>
          ) : (
            <span className="tag text-[10px] bg-soul-800 text-soul-400 shrink-0">即时预判</span>
          )}
        </div>

        {lastOther ? (
          <div className="rounded-xl bg-soul-900/60 border border-soul-700/40 px-3 py-2 mb-3">
            <p className="text-[10px] text-soul-500 mb-0.5">正在拆解的对方原话</p>
            <p className="text-sm text-soul-100 leading-relaxed">「{lastOther}」</p>
          </div>
        ) : (
          <p className="text-xs text-soul-500 mb-3">先在聊天页粘贴对方消息，或点下方开始分析。</p>
        )}

        <button
          type="button"
          disabled={isAnalyzing || !lastOther}
          onClick={scanFocus}
          className="btn-primary w-full flex items-center justify-center gap-2 min-h-[44px] text-sm"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 雷达扫描中…
            </>
          ) : (
            <>
              <Radar className="w-4 h-4" /> 精准拆解这句
            </>
          )}
        </button>
      </div>

      {/* 逐句列表 */}
      {otherMessages.length > 1 && (
        <div className="rounded-2xl border border-soul-700/30 bg-soul-950/40 p-2.5">
          <p className="text-[10px] text-soul-500 px-1 mb-1.5">对方消息 · 点选逐句拆解</p>
          <ul className="space-y-1 max-h-36 overflow-y-auto scroll-touch">
            {[...otherMessages].reverse().map((m) => {
              const active = focusMsg?.id === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setFocusId(m.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[12px] leading-snug flex items-center gap-2 touch-manipulation ${
                      active
                        ? 'bg-cyan-900/40 border border-cyan-500/40 text-cyan-50'
                        : 'bg-soul-900/50 border border-transparent text-soul-300 hover:border-soul-600/50'
                    }`}
                  >
                    <span className="flex-1 min-w-0 line-clamp-2">{m.content}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 四层拆解 */}
      <div className="grid grid-cols-1 gap-2">
        <Layer
          icon={MessageCircle}
          title="表层话术"
          body={dissect.surface}
          accent="border-soul-600/40 bg-soul-900/40"
        />
        <Layer
          icon={Heart}
          title="深层情绪"
          body={dissect.deepEmotion}
          accent="border-pink-500/25 bg-pink-950/20"
        />
        <Layer
          icon={Eye}
          title="潜台词"
          body={dissect.subtext}
          accent="border-violet-500/25 bg-violet-950/20"
        />
        <Layer
          icon={Shield}
          title="真实态度"
          body={dissect.realAttitude}
          accent="border-amber-500/25 bg-amber-950/20"
        />
      </div>

      {/* 关键指标 */}
      <div className="rounded-2xl border border-cyan-500/20 bg-soul-950/50 p-3 space-y-3">
        <p className="text-xs font-medium text-cyan-200">关键标注</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-soul-900/60 border border-soul-700/30 px-2.5 py-2">
            <p className="text-[10px] text-soul-500">情绪类型</p>
            <p className="text-soul-100 font-medium mt-0.5">{dissect.emotionType}</p>
          </div>
          <div className="rounded-lg bg-soul-900/60 border border-soul-700/30 px-2.5 py-2">
            <p className="text-[10px] text-soul-500">敷衍程度</p>
            <p className="text-soul-100 font-medium mt-0.5">{dissect.perfunctoryLevel}</p>
          </div>
          <div className="col-span-2 rounded-lg bg-soul-900/60 border border-soul-700/30 px-2.5 py-2">
            <p className="text-[10px] text-soul-500 mb-0.5">隐藏需求</p>
            <p className="text-soul-100 leading-snug">{dissect.hiddenNeed}</p>
          </div>
        </div>
        <Meter label="好感度" value={dissect.favorability} color="from-pink-500 to-rose-400" />
      </div>

      {/* 九维雷达 */}
      {fromAi && analysis ? (
        <EmotionRadarSection analysis={analysis} />
      ) : (
        <div className="p-3 bg-soul-950/30 rounded-xl border border-soul-700/20">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-medium text-soul-300">情绪雷达（预判）</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {dissect.radar.map(({ type, score }) => (
              <div key={type} className="text-center">
                <div className="h-1.5 bg-soul-800 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full"
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="text-[10px] text-soul-400">{type}</span>
                <span className="text-[10px] text-soul-500 ml-0.5">{score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 策略 + 回复 */}
      <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/30 to-transparent p-3 space-y-2.5">
        <p className="text-xs font-medium text-rose-200 flex items-center gap-1">
          <Target className="w-3.5 h-3.5" /> 最优应对策略
        </p>
        <p className="text-[13px] text-soul-100 leading-snug">{dissect.strategy}</p>
        <p className="text-[11px] text-amber-200/90 leading-snug">{dissect.doseTip}</p>
        <div className="rounded-xl bg-soul-900/70 border border-pink-500/20 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] text-pink-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> 高情商回复方向
            </p>
            <button
              type="button"
              onClick={() => void copyHint()}
              className="btn-ghost p-1.5 min-h-0 min-w-0 text-soul-400 hover:text-pink-300"
              title="复制"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-sm text-soul-50 leading-relaxed">{dissect.replyHint}</p>
        </div>
        {analysis?.replies && analysis.replies.length > 0 && (
          <button
            type="button"
            onClick={() => setLoveSubTab('replies')}
            className="btn-secondary w-full text-xs min-h-[40px]"
          >
            查看 {analysis.replies.length} 条可发送话术
          </button>
        )}
      </div>
    </div>
  );
}
