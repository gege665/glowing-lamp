import { useEffect, useRef, useState } from 'react';
import {
  Swords,
  Loader2,
  Send,
  RotateCcw,
  Copy,
  Sparkles,
  AlertTriangle,
  Heart,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DRILL_SCENARIOS, getDrillScenario } from '../constants/drillScenarios';

export default function DrillPanel() {
  const drillScenarioId = useAppStore((s) => s.drillScenarioId);
  const drillMessages = useAppStore((s) => s.drillMessages);
  const drillFeedback = useAppStore((s) => s.drillFeedback);
  const isDrilling = useAppStore((s) => s.isDrilling);
  const setDrillScenario = useAppStore((s) => s.setDrillScenario);
  const startDrill = useAppStore((s) => s.startDrill);
  const sendDrillMessage = useAppStore((s) => s.sendDrillMessage);
  const resetDrill = useAppStore((s) => s.resetDrill);
  const showToast = useAppStore((s) => s.showToast);

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const scene = getDrillScenario(drillScenarioId);
  const started = drillMessages.some((m) => m.role === 'her');
  const lastHerId = [...drillMessages].reverse().find((m) => m.role === 'her')?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [drillMessages, drillFeedback, isDrilling]);

  const submit = () => {
    const t = draft.trim();
    if (!t || isDrilling) return;
    setDraft('');
    void sendDrillMessage(t);
  };

  const copyLine = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制');
    } catch {
      showToast('复制失败');
    }
  };

  const useBetter = (text: string) => {
    setDraft(text);
    void sendDrillMessage(text);
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-amber-500/15 bg-gradient-to-br from-amber-950/30 via-transparent to-rose-950/20">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/30">
            <Swords className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-amber-100">全场景模拟演练</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              我扮她真实语气 · 你实时对练 · 指出问题并给最优修正
            </p>
          </div>
          {started && (
            <button
              type="button"
              onClick={() => resetDrill()}
              className="btn-ghost p-2 min-h-0 min-w-0 text-soul-400"
              title="清空本局"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto scroll-touch pb-1 -mx-0.5 px-0.5">
          {DRILL_SCENARIOS.map((s) => {
            const active = s.id === drillScenarioId;
            return (
              <button
                key={s.id}
                type="button"
                disabled={isDrilling}
                onClick={() => setDrillScenario(s.id)}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] touch-manipulation transition-all ${
                  active
                    ? 'bg-amber-600/30 border-amber-400/50 text-amber-100'
                    : 'bg-soul-900/50 border-soul-700/40 text-soul-400 hover:border-amber-500/30'
                }`}
              >
                <span className="mr-0.5">{s.icon}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <p className="text-[10px] text-soul-500 flex-1 min-w-0 truncate">
            {scene.icon} {scene.desc} · {scene.goal}
          </p>
          <button
            type="button"
            disabled={isDrilling}
            onClick={() => void startDrill()}
            className="btn-primary text-xs min-h-[36px] px-3 shrink-0 flex items-center gap-1"
          >
            {isDrilling && !started ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 开场中
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> {started ? '重新开局' : '开始演练'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 对话区 */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-touch p-3 space-y-2.5">
        {!started && !isDrilling && (
          <div className="rounded-2xl border border-dashed border-amber-500/25 bg-amber-950/10 px-4 py-6 text-center">
            <p className="text-sm text-amber-100/90 mb-1">选好场景，点「开始演练」</p>
            <p className="text-[11px] text-soul-500 leading-relaxed">
              她会先开口；你像微信一样回复。每句都会打分纠错，并给出可直接发的修正话术。
            </p>
            <ul className="mt-3 text-left text-[10px] text-soul-400 space-y-1 max-w-xs mx-auto">
              {scene.pitfalls.map((p) => (
                <li key={p}>· 忌：{p}</li>
              ))}
            </ul>
          </div>
        )}

        {drillMessages.map((m) => {
          if (m.role === 'system') {
            return (
              <p key={m.id} className="text-center text-[10px] text-soul-500 py-1">
                {m.content}
              </p>
            );
          }
          const mine = m.role === 'me';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? 'bg-gradient-to-br from-rose-600/80 to-pink-600/70 text-white rounded-br-md'
                    : 'bg-soul-800/80 border border-soul-600/40 text-soul-100 rounded-bl-md'
                }`}
              >
                {!mine && (
                  <p className="text-[10px] text-amber-300/80 mb-0.5 flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5" /> 她
                    {drillFeedback.herEmotion && m.id === lastHerId
                      ? ` · ${drillFeedback.herEmotion}`
                      : ''}
                  </p>
                )}
                {m.content}
              </div>
            </div>
          );
        })}

        {isDrilling && started && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-soul-800/60 border border-soul-600/30 px-3 py-2 text-xs text-soul-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 她正在回…
            </div>
          </div>
        )}

        {/* 教练点评 */}
        {started && (drillFeedback.problems.length > 0 || drillFeedback.betterReplies.length > 0 || drillFeedback.tip) && (
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-cyan-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> 教练点评
              </p>
              {drillFeedback.score > 0 && (
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    drillFeedback.score >= 75
                      ? 'text-emerald-300'
                      : drillFeedback.score >= 50
                        ? 'text-amber-300'
                        : 'text-rose-300'
                  }`}
                >
                  {drillFeedback.score} 分
                </span>
              )}
            </div>
            {drillFeedback.tip && (
              <p className="text-[12px] text-soul-200 leading-snug">{drillFeedback.tip}</p>
            )}
            {drillFeedback.problems.length > 0 && (
              <ul className="space-y-0.5">
                {drillFeedback.problems.map((p, i) => (
                  <li key={i} className="text-[11px] text-rose-200/90 leading-snug">
                    · 问题：{p}
                  </li>
                ))}
              </ul>
            )}
            {drillFeedback.betterReplies.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-cyan-300/80">最优话术修正 · 点用可直接发出</p>
                {drillFeedback.betterReplies.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 rounded-xl bg-soul-900/60 border border-soul-700/40 px-2.5 py-2"
                  >
                    <p className="flex-1 text-[12px] text-soul-100 leading-snug min-w-0">{r}</p>
                    <button
                      type="button"
                      onClick={() => void copyLine(r)}
                      className="btn-ghost p-1.5 min-h-0 min-w-0 text-soul-400 shrink-0"
                      title="复制"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isDrilling}
                      onClick={() => useBetter(r)}
                      className="btn-secondary text-[10px] min-h-[28px] px-2 shrink-0"
                    >
                      用这句
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 输入 */}
      <div className="shrink-0 p-2.5 border-t border-soul-700/30 bg-soul-950/50">
        <div className="flex gap-1.5 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={!started || isDrilling}
            placeholder={started ? '像微信一样输入你的回复…' : '先点「开始演练」'}
            rows={2}
            className="input-field flex-1 resize-none text-sm min-h-[44px] py-2"
          />
          <button
            type="button"
            disabled={!started || isDrilling || !draft.trim()}
            onClick={submit}
            className="composer-action-btn btn-primary p-1.5 min-h-[44px] min-w-[44px] disabled:opacity-40"
          >
            {isDrilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
