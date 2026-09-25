import { Copy, Lightbulb, RefreshCw } from 'lucide-react';
import type { AnalysisResult } from '../types';
import { useAppStore } from '../store/appStore';

interface StrategyCoachSectionProps {
  analysis: AnalysisResult;
}

export default function StrategyCoachSection({ analysis }: StrategyCoachSectionProps) {
  const showToast = useAppStore((s) => s.showToast);
  const runAnalysis = useAppStore((s) => s.runAnalysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);

  const cards = (analysis.strategyCards ?? []).filter((c) => c.approach || c.example);
  const hasCoach =
    Boolean(analysis.intentLabel?.trim()) ||
    Boolean(analysis.intentInsight?.trim()) ||
    cards.length > 0;

  if (!hasCoach) return null;

  const handleCopy = async (text: string) => {
    const t = text.trim();
    if (!t) {
      showToast('暂无示例句可复制');
      return;
    }
    try {
      await navigator.clipboard.writeText(t);
      showToast('已复制示例回复');
    } catch {
      showToast('复制失败，请手动选择');
    }
  };

  return (
    <div className="p-3 rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-950/40 to-soul-950/40 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Lightbulb className="w-4 h-4 text-orange-300 shrink-0" />
          <h3 className="text-sm font-medium text-orange-100">分析模式 · 对策卡</h3>
          {analysis.intentLabel?.trim() && (
            <span className="tag bg-orange-500/20 text-orange-200 text-[10px] shrink-0">
              {analysis.intentLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => runAnalysis()}
          disabled={isAnalyzing}
          className="btn-ghost p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-orange-300/80"
          title="刷新分析"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {analysis.intentInsight?.trim() && (
        <p className="text-sm text-soul-200 leading-relaxed">
          {analysis.intentInsight}
        </p>
      )}

      {analysis.strategy.warnings.length > 0 && (
        <div className="text-[11px] text-amber-200/85 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2">
          <span className="font-medium text-amber-300">别踩坑：</span>
          {analysis.strategy.warnings.slice(0, 2).join('；')}
        </div>
      )}

      {cards.length > 0 && (
        <div className="space-y-2.5">
          {cards.map((card, i) => (
            <div
              key={`${card.title}-${i}`}
              className="rounded-lg border border-soul-600/30 bg-soul-900/50 p-2.5 space-y-1.5"
            >
              <p className="text-xs font-medium text-orange-200/90">
                {card.title}
                {card.approach ? `：${card.approach}` : ''}
              </p>
              {card.example.trim() ? (
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-soul-100 leading-snug min-w-0">
                    <span className="text-soul-500 text-xs mr-1">示例</span>
                    {card.example}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy(card.example)}
                    className="btn-ghost p-1.5 shrink-0 text-soul-400 hover:text-orange-300"
                    title="复制示例"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
