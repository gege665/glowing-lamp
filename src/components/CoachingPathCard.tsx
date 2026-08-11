import { Route } from 'lucide-react';
import type { AnalysisResult } from '../types';
import {
  COACHING_PATH_STEPS,
  UNIQUE_ANALYSIS_POSITIONING,
} from '../constants/uniqueAnalysisMode';

interface Props {
  analysis: Pick<AnalysisResult, 'psychology' | 'strategy' | 'femalePsychology' | 'summary'>;
}

/** 独创分析 · 心思 → 策略 → 回复 教练路径卡片 */
export default function CoachingPathCard({ analysis }: Props) {
  const { psychology, strategy, femalePsychology, summary } = analysis;
  const mind =
    psychology.subtext ||
    psychology.mentalState ||
    summary ||
    '（待补充心思判断）';
  const core =
    strategy.coreStrategy ||
    strategy.nextMove ||
    strategy.communicationStrategy ||
    femalePsychology.replyPrinciple ||
    '（待补充核心策略）';
  const why =
    strategy.whyStrategy ||
    strategy.emotionSwap ||
    femalePsychology.scenarioTip ||
    '';
  const replyHint =
    femalePsychology.scenarioTip ||
    strategy.nextMove ||
    '右侧话术区将给出多风格备选，选最像你的那条发。';
  const shitTest = femalePsychology.shitTestNote?.trim();

  const bodies = [mind, why ? `${core}\n为什么：${why}` : core, replyHint];

  return (
    <div className="p-3 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/40 to-soul-950/40 space-y-3">
      <div className="flex items-center gap-2">
        <Route className="w-4 h-4 text-violet-300" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-soul-100">{UNIQUE_ANALYSIS_POSITIONING.title}</p>
          <p className="text-[11px] text-soul-500 truncate">
            {UNIQUE_ANALYSIS_POSITIONING.upgradeTo}
          </p>
        </div>
      </div>

      <ol className="space-y-2.5">
        {COACHING_PATH_STEPS.map((step, i) => (
          <li key={step.key} className="flex gap-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-violet-500/25 text-violet-200 text-[11px] font-semibold flex items-center justify-center mt-0.5">
              {step.step}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-violet-200/90">{step.label}</p>
              <p className="text-[10px] text-soul-600 mb-0.5">{step.hint}</p>
              <p className="text-sm text-soul-200 leading-snug whitespace-pre-line">{bodies[i]}</p>
            </div>
          </li>
        ))}
      </ol>

      {shitTest ? (
        <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          试探识别：{shitTest}
        </p>
      ) : null}
    </div>
  );
}
