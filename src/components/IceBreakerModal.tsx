import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Copy, Send, Loader2 } from 'lucide-react';
import { ICE_BREAKER_SCENARIOS, type IceBreakerScenarioId } from '../constants/iceBreakerScenarios';
import { generateIceBreakers } from '../services/iceBreakerService';
import { useAppStore } from '../store/appStore';

interface IceBreakerModalProps {
  open: boolean;
  onClose: () => void;
}

export default function IceBreakerModal({ open, onClose }: IceBreakerModalProps) {
  const settings = useAppStore((s) => s.settings);
  const addMessage = useAppStore((s) => s.addMessage);
  const showToast = useAppStore((s) => s.showToast);

  const [scenarioId, setScenarioId] = useState<IceBreakerScenarioId>('first_add');
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
    }
    return () => {
      generateAbortRef.current?.abort();
    };
  }, [open]);

  if (!open) return null;

  const handleGenerate = async () => {
    generateAbortRef.current?.abort();
    const ac = new AbortController();
    generateAbortRef.current = ac;

    setLoading(true);
    setError(null);
    setLines([]);
    try {
      const result = await generateIceBreakers(scenarioId, settings, ac.signal);
      if (ac.signal.aborted) return;
      setLines(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      if (generateAbortRef.current === ac) {
        setLoading(false);
      }
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制');
    } catch {
      showToast('复制失败，请手动选择文本复制');
    }
  };

  const handleSend = (text: string) => {
    addMessage('me', text);
    showToast('已添加到对话');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 safe-top safe-bottom">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md panel-card p-0 overflow-hidden animate-slide-up max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl">
        <div className="px-4 py-3 border-b border-soul-700/30 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-soul-200">一键破冰</h2>
            <p className="text-[11px] text-soul-500">12 种场景 · 自然不油腻</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-3 min-h-0">
          <div className="grid grid-cols-2 gap-2 sm:gap-1.5">
            {ICE_BREAKER_SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setScenarioId(s.id);
                  setLines([]);
                  setError(null);
                }}
                className={`p-3 sm:p-2 rounded-lg text-left text-xs border transition-all min-h-[52px] sm:min-h-0 touch-manipulation ${
                  scenarioId === s.id
                    ? 'border-pink-500/50 bg-pink-500/10 text-pink-200'
                    : 'border-soul-700/30 bg-soul-900/30 text-soul-400 hover:border-soul-600/50'
                }`}
              >
                <span className="font-medium block">{s.label}</span>
                <span className="text-[10px] opacity-70">{s.desc}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 min-h-[44px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 生成中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> 生成破冰话术
              </>
            )}
          </button>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          {lines.length > 0 && (
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-soul-800/50 border border-soul-700/30"
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
                      <Send className="w-3 h-3" /> 发送
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
