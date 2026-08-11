import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, Copy, Send, Loader2, Zap } from 'lucide-react';
import {
  LINGYAN_RESCUE_SCENARIOS,
  ICE_BREAKER_EXTRA_SCENARIOS,
  type IceBreakerScenarioId,
} from '../constants/iceBreakerScenarios';
import { generateIceBreakerBundle } from '../services/iceBreakerService';
import { useAppStore } from '../store/appStore';

interface IceBreakerModalProps {
  open: boolean;
  onClose: () => void;
  initialScenario?: IceBreakerScenarioId;
}

export default function IceBreakerModal({
  open,
  onClose,
  initialScenario = 'first_add',
}: IceBreakerModalProps) {
  const settings = useAppStore((s) => s.settings);
  const addMessage = useAppStore((s) => s.addMessage);
  const showToast = useAppStore((s) => s.showToast);

  const [scenarioId, setScenarioId] = useState<IceBreakerScenarioId>(initialScenario);
  const [showExtra, setShowExtra] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(
    async (id: IceBreakerScenarioId = scenarioId) => {
      generateAbortRef.current?.abort();
      const ac = new AbortController();
      generateAbortRef.current = ac;

      setLoading(true);
      setError(null);
      setLines([]);
      setTopics([]);
      try {
        const result = await generateIceBreakerBundle(id, settings, ac.signal);
        if (ac.signal.aborted) return;
        setLines(result.lines);
        setTopics(result.topics);
        showToast('破冰话术已就绪');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '生成失败');
      } finally {
        if (generateAbortRef.current === ac) {
          setLoading(false);
        }
      }
    },
    [scenarioId, settings, showToast]
  );

  useEffect(() => {
    if (!open) {
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
      return;
    }
    setScenarioId(initialScenario);
    setLines([]);
    setTopics([]);
    setError(null);
    void handleGenerate(initialScenario);
    return () => {
      generateAbortRef.current?.abort();
    };
    // 仅在打开时自动触发破冰救场
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialScenario]);

  if (!open) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制，可直接发送');
    } catch {
      showToast('复制失败，请手动选择文本复制');
    }
  };

  const handleSend = (text: string) => {
    addMessage('me', text);
    showToast('已添加到对话');
    onClose();
  };

  const selectScenario = (id: IceBreakerScenarioId) => {
    setScenarioId(id);
    setLines([]);
    setTopics([]);
    setError(null);
    void handleGenerate(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 safe-top safe-bottom">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md panel-card p-0 overflow-hidden animate-slide-up max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl love-glow">
        <div className="px-4 py-3 border-b border-rose-500/20 bg-gradient-to-r from-rose-950/50 to-amber-950/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-rose-100 truncate">灵焰破冰救场</h2>
              <p className="text-[11px] text-soul-400 truncate">不尬不油 · 高开启率 · 可直接发送</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-3 min-h-0">
          <p className="text-[11px] text-soul-400">选场景 · 自动生成开场白 + 续聊</p>
          <div className="grid grid-cols-1 gap-2">
            {LINGYAN_RESCUE_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectScenario(s.id)}
                className={`p-3 rounded-xl text-left border transition-all min-h-[56px] touch-manipulation flex items-center gap-3 ${
                  scenarioId === s.id
                    ? 'border-rose-400/50 bg-gradient-to-r from-rose-600/20 to-amber-600/10 text-rose-100 ring-1 ring-rose-400/30'
                    : 'border-soul-700/30 bg-soul-900/40 text-soul-300 hover:border-rose-500/30'
                }`}
              >
                <span className="text-xl shrink-0" aria-hidden>
                  {s.icon}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold text-sm block">{s.label}</span>
                  <span className="text-[11px] text-soul-400">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowExtra(!showExtra)}
            className="text-[11px] text-soul-500 hover:text-soul-300"
          >
            {showExtra ? '收起更多场景' : '更多场景…'}
          </button>

          {showExtra && (
            <div className="grid grid-cols-2 gap-2">
              {ICE_BREAKER_EXTRA_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectScenario(s.id)}
                  className={`p-2.5 rounded-lg text-left text-xs border min-h-[52px] touch-manipulation ${
                    scenarioId === s.id
                      ? 'border-pink-500/50 bg-pink-500/10 text-pink-200'
                      : 'border-soul-700/30 bg-soul-900/30 text-soul-400'
                  }`}
                >
                  <span className="font-medium block">
                    {s.icon} {s.label}
                  </span>
                  <span className="text-[10px] opacity-70">{s.desc}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 min-h-[48px] text-[15px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 破冰生成中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> 换一批开场白 + 续聊
              </>
            )}
          </button>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          {lines.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-rose-300 font-medium">开场白 · 复制即发</p>
              {lines.map((line, i) => (
                <div
                  key={`line-${i}`}
                  className="p-3 rounded-xl bg-soul-800/50 border border-rose-500/20"
                >
                  <p className="text-sm text-soul-100 leading-relaxed mb-2">{line}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(line)}
                      className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> 复制
                    </button>
                    <button
                      onClick={() => handleSend(line)}
                      className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1"
                    >
                      <Send className="w-3 h-3" /> 加入对话
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {topics.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-violet-300 font-medium">续聊话题 · 打破沉默后接着用</p>
              {topics.map((topic, i) => (
                <div
                  key={`topic-${i}`}
                  className="p-2.5 rounded-xl bg-violet-950/30 border border-violet-500/20 flex items-start gap-2"
                >
                  <p className="text-[13px] text-soul-100 leading-snug flex-1 min-w-0">{topic}</p>
                  <button
                    onClick={() => handleCopy(topic)}
                    className="shrink-0 btn-ghost p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-violet-300"
                    title="复制"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
