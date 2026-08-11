import { useMemo } from 'react';
import {
  ShieldAlert,
  Loader2,
  Copy,
  AlertTriangle,
  Sparkles,
  Target,
  Shield,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  RISK_CONTROL_TAGS,
  resolveRiskReport,
  instantRiskScan,
  riskReportFromAnalysis,
} from '../constants/riskControl';
import { RiskAssessmentSection } from './AnalysisInsights';

const LEVEL_STYLE = {
  low: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200',
  medium: 'border-amber-500/35 bg-amber-950/25 text-amber-100',
  high: 'border-red-500/40 bg-red-950/30 text-red-100',
};

/** 灵焰反套路反诈风控面板 */
export default function RiskControlPanel() {
  const messages = useAppStore((s) => s.messages);
  const analysis = useAppStore((s) => s.analysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const runAnalysis = useAppStore((s) => s.runAnalysis);
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const showToast = useAppStore((s) => s.showToast);
  const addMessage = useAppStore((s) => s.addMessage);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const lastOther = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'other' && messages[i].content.trim()) {
        return messages[i].content.trim();
      }
    }
    return '';
  }, [messages]);

  const fromAi = Boolean(riskReportFromAnalysis(analysis));
  const report = useMemo(
    () => (fromAi ? resolveRiskReport(analysis, lastOther) : instantRiskScan(lastOther)),
    [analysis, lastOther, fromAi]
  );

  const copyLine = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制反制话术');
    } catch {
      showToast('复制失败');
    }
  };

  const useLine = (text: string) => {
    addMessage('me', text);
    showToast('已加入对话');
    setActivePanel('chat');
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/40 via-soul-950/70 to-amber-950/20 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-red-900/30">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-red-100">反套路反诈风控</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              钓鱼 · 套路 · 索取 · 试探 · 敷衍 · 养鱼 · 情感博弈 · 诈骗
            </p>
          </div>
          {fromAi ? (
            <span className="tag text-[10px] bg-red-500/20 text-red-200 border border-red-500/30 shrink-0">
              AI 精判
            </span>
          ) : (
            <span className="tag text-[10px] bg-soul-800 text-soul-400 shrink-0">即时预判</span>
          )}
        </div>

        {lastOther ? (
          <div className="rounded-xl bg-soul-900/60 border border-soul-700/40 px-3 py-2 mb-3">
            <p className="text-[10px] text-soul-500 mb-0.5">正在扫描的对方原话</p>
            <p className="text-sm text-soul-100 leading-relaxed">「{lastOther}」</p>
          </div>
        ) : (
          <p className="text-xs text-soul-500 mb-3">先在聊天页粘贴对方消息，再扫描风控。</p>
        )}

        <button
          type="button"
          disabled={isAnalyzing || !lastOther}
          onClick={() => void runAnalysis()}
          className="btn-primary w-full flex items-center justify-center gap-2 min-h-[44px] text-sm"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 风控扫描中…
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" /> 精准风控扫描
            </>
          )}
        </button>
      </div>

      {/* 风险等级 */}
      <div className={`rounded-2xl border p-3 ${LEVEL_STYLE[report.level]}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            风险等级 · {report.levelLabel}
          </p>
          <span className="text-[10px] opacity-70">{report.source === 'ai' ? 'AI' : '本地'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RISK_CONTROL_TAGS.map((tag) => {
            const on = report.tags.includes(tag);
            return (
              <span
                key={tag}
                className={`tag text-[10px] border ${
                  on
                    ? 'bg-red-500/25 text-red-100 border-red-400/40'
                    : 'bg-soul-900/40 text-soul-500 border-soul-700/30'
                }`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* 拆解 + 避雷 */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-950/15 p-3 space-y-2">
        <p className="text-xs font-medium text-amber-200 flex items-center gap-1">
          <Target className="w-3.5 h-3.5" /> 套路拆解
        </p>
        <p className="text-[13px] text-soul-100 leading-snug">{report.dissection}</p>
        {report.motivation && (
          <p className="text-[11px] text-soul-400">
            动机：{report.motivation}
          </p>
        )}
        <div className="pt-1 space-y-1">
          <p className="text-[10px] text-amber-300/80">避雷提醒</p>
          {report.alerts.map((a, i) => (
            <p key={i} className="text-[12px] text-soul-200 leading-snug">
              {a}
            </p>
          ))}
        </div>
        {report.worthContinuing && (
          <p className="text-[11px] text-soul-300 pt-1">
            是否继续：{report.worthContinuing}
          </p>
        )}
        {report.advice && (
          <p className="text-[12px] text-amber-100/90 leading-snug border-t border-amber-500/15 pt-2">
            应对策略：{report.advice}
          </p>
        )}
      </div>

      {/* 反制话术 */}
      <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/15 p-3 space-y-2">
        <p className="text-xs font-medium text-cyan-200 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> 高情商反制 · 从容不被动
        </p>
        {report.counterReplies.length === 0 ? (
          <p className="text-[11px] text-soul-500">扫描后将给出反制话术</p>
        ) : (
          report.counterReplies.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 rounded-xl bg-soul-900/60 border border-soul-700/40 px-2.5 py-2"
            >
              <p className="flex-1 text-[13px] text-soul-100 leading-snug min-w-0">{r}</p>
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
                onClick={() => useLine(r)}
                className="btn-secondary text-[10px] min-h-[28px] px-2 shrink-0"
              >
                用这句
              </button>
            </div>
          ))
        )}
        {analysis?.replies && analysis.replies.length > 0 && (
          <button
            type="button"
            onClick={() => setLoveSubTab('replies')}
            className="btn-secondary w-full text-xs min-h-[40px] mt-1"
          >
            查看全部话术备选
          </button>
        )}
      </div>

      {fromAi && analysis && <RiskAssessmentSection analysis={analysis} />}
    </div>
  );
}
