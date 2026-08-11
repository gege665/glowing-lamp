import { useEffect, useRef } from 'react';

import {

  Brain,

  Heart,

  TrendingUp,

  AlertTriangle,

  Target,

  RefreshCw,

  Loader2,

} from 'lucide-react';

import { useAppStore } from '../store/appStore';

import {
  formatActiveModelDisplay,
  formatManualDualModelProgress,
  resolveActiveModelLabel,
  supportsAutoModelRouting,
} from '../constants/modelRouting';
import FemalePsychologySection from './FemalePsychologySection';
import CoachingPathCard from './CoachingPathCard';
import AssistantCapabilities from './AssistantCapabilities';
import {
  EmotionRadarSection,
  RiskAssessmentSection,
  RelationshipDashboardSection,
  KeyMomentsSection,
} from './AnalysisInsights';
import { parseDeepReport, shortReportLabel } from '../utils/deepReportFormat';
import {
  UNIQUE_ANALYSIS_EMPTY_HINT,
  UNIQUE_ANALYSIS_DEMO_SCENARIO,
  UNIQUE_ANALYSIS_PILLARS,
} from '../constants/uniqueAnalysisMode';

export default function AnalysisPanel() {
  const analysis = useAppStore((s) => s.analysis);

  const isAnalyzing = useAppStore((s) => s.isAnalyzing);

  const streamProgress = useAppStore((s) => s.streamProgress);

  const runAnalysis = useAppStore((s) => s.runAnalysis);

  const messages = useAppStore((s) => s.messages);

  const settings = useAppStore((s) => s.settings);

  const streamRef = useRef<HTMLDivElement>(null);



  const modelName = supportsAutoModelRouting(settings.provider)
    ? streamProgress.activeModel
      ? formatActiveModelDisplay(streamProgress.activeModel, settings.provider) +
        (streamProgress.modelSwitched ? '（已切换）' : '')
      : resolveActiveModelLabel(settings, streamProgress.phase)
    : settings.provider;

  const dualModelHint = formatManualDualModelProgress(settings, streamProgress.phase);



  useEffect(() => {

    if (isAnalyzing && streamRef.current) {

      streamRef.current.scrollTop = streamRef.current.scrollHeight;

    }

  }, [streamProgress, isAnalyzing]);



  if (isAnalyzing) {
    const p = streamProgress.analysisPreview ?? {};
    const hasPreview = Boolean(p.summary || p.primary);

    return (
      <div className="panel-card panel-zone-analysis h-full flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-violet-500/15 flex items-center gap-2 shrink-0">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          <h2 className="font-semibold text-soul-200">分析区</h2>
        </div>
        <div ref={streamRef} className="flex-1 overflow-y-auto scroll-touch p-4 min-h-0 flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs text-soul-400">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{streamProgress.message}</span>
              <span className="text-soul-600">· {modelName}</span>
            </div>
            {dualModelHint && (
              <p className="text-[11px] text-soul-500 pl-6">{dualModelHint}</p>
            )}
          </div>

          {p.summary && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-soul-800/50 to-pink-900/20 border border-soul-600/20 animate-fade-in">
              <p className="text-xs text-soul-400 mb-1">摘要预览</p>
              <p className="text-sm text-soul-200 leading-relaxed">{p.summary}</p>
            </div>
          )}

          {p.primary && (
            <div className="p-3 rounded-xl bg-soul-950/30 border border-soul-700/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-pink-400" />
                <p className="text-xs font-medium text-soul-300">情绪预览</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-soul-500 text-xs">主要情绪</span>
                  <p className="text-soul-200">{p.primary}</p>
                </div>
                <div>
                  <span className="text-soul-500 text-xs">次要情绪</span>
                  <p className="text-soul-200">{p.secondary || '—'}</p>
                </div>
                {p.trend && (
                  <div className="col-span-2">
                    <span className="text-soul-500 text-xs">趋势</span>
                    <p className="text-soul-200 text-xs mt-0.5">{p.trend}</p>
                  </div>
                )}
              </div>
              {p.intensity != null && (
                <div className="mt-2 h-1.5 bg-soul-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-soul-500 rounded-full transition-all duration-300"
                    style={{ width: `${p.intensity}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {!hasPreview && (
            <p className="text-soul-500 text-xs text-center py-6">正在快速识别情绪与摘要…</p>
          )}

          {streamProgress.phase === 'replies' || streamProgress.phase === 'finishing' ? (
            <p className="text-center text-soul-500 text-xs">
              <span className="hidden lg:inline">分析完成，右侧正在生成话术</span>
              <span className="hidden md:inline lg:hidden">分析完成，下方可查看话术</span>
              <span className="md:hidden">分析完成，请到恋爱页「话术」查看</span>
            </p>
          ) : null}
        </div>
      </div>
    );
  }



  if (!analysis) {

    return (

      <div className="panel-card panel-zone-analysis h-full flex flex-col items-center justify-center gap-4 p-6 overflow-y-auto">

        <Brain className="w-12 h-12 text-violet-500/40 shrink-0" />

        <div className="text-center max-w-sm space-y-2">
          <p className="text-soul-300 font-medium">独创分析模式</p>
          <p className="text-soul-500 text-sm leading-relaxed">
            {UNIQUE_ANALYSIS_EMPTY_HINT}
          </p>
          <p className="text-soul-600 text-xs leading-relaxed">
            {messages.length > 0 ? (
              <>
                <span className="hidden lg:inline">点击左侧「智能生成话术」，按 心思→策略→回复 展示</span>
                <span className="hidden md:inline lg:hidden">在左侧对话点击「智能生成话术」</span>
                <span className="md:hidden">在「聊天」页点击「智能生成话术」</span>
              </>
            ) : (
              <>
                <span className="hidden lg:inline">先在左侧粘贴对方消息，再点击「智能生成话术」</span>
                <span className="hidden md:inline lg:hidden">先在左侧粘贴对方消息，再生成</span>
                <span className="md:hidden">先在「聊天」页粘贴对方消息再生成</span>
              </>
            )}
          </p>
        </div>

        <div className="w-full max-w-sm rounded-xl border border-violet-500/20 bg-violet-950/20 p-3 space-y-2 text-left">
          <p className="text-[11px] text-violet-300/90 font-medium">演示场景 · {UNIQUE_ANALYSIS_DEMO_SCENARIO.title.replace('演示场景 · ', '')}</p>
          <p className="text-xs text-soul-300">她：「{UNIQUE_ANALYSIS_DEMO_SCENARIO.herMessage}」</p>
          <p className="text-[11px] text-soul-500">心思：{UNIQUE_ANALYSIS_DEMO_SCENARIO.mind}</p>
          <p className="text-[11px] text-soul-500">策略：{UNIQUE_ANALYSIS_DEMO_SCENARIO.strategy}</p>
          <p className="text-[11px] text-soul-500">为什么：{UNIQUE_ANALYSIS_DEMO_SCENARIO.why}</p>
          <ul className="text-[11px] text-soul-400 space-y-0.5 pt-1 border-t border-soul-700/30">
            {UNIQUE_ANALYSIS_PILLARS.map((p) => (
              <li key={p.id}>· {p.title}：{p.summary}</li>
            ))}
          </ul>
        </div>

        <details className="w-full max-w-sm rounded-xl border border-soul-700/30 bg-soul-900/30 group">
          <summary className="text-[11px] text-soul-500 px-3 py-2 cursor-pointer list-none flex items-center justify-between">
            <span>产品能力一览</span>
            <span className="text-soul-600 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-3 pb-3 border-t border-soul-700/20 pt-2">
            <AssistantCapabilities compact />
          </div>
        </details>

      </div>

    );

  }



  const { emotion, psychology, deepReport, strategy, summary, femalePsychology } = analysis;
  const reportItems = parseDeepReport(deepReport);

  const interestColor =

    psychology.interestLevel >= 70

      ? 'text-green-400'

      : psychology.interestLevel >= 40

        ? 'text-yellow-400'

        : 'text-red-400';



  return (

    <div className="panel-card panel-zone-analysis h-full flex flex-col overflow-hidden">

      <div className="px-4 py-3 border-b border-violet-500/15 flex items-center justify-between shrink-0">

        <div className="flex items-center gap-2">

          <Brain className="w-5 h-5 text-violet-400" />

          <h2 className="font-semibold text-soul-200">独创分析</h2>

        </div>

        <button onClick={() => runAnalysis()} className="btn-ghost text-xs flex items-center gap-1">

          <RefreshCw className="w-3.5 h-3.5" /> 重新分析

        </button>

      </div>



      <div className="flex-1 overflow-y-auto scroll-touch p-3 sm:p-4 space-y-4 min-h-0">

        <div className="p-3 bg-gradient-to-r from-soul-800/50 to-pink-900/20 rounded-xl border border-soul-600/20">

          <p className="text-sm text-soul-200 leading-relaxed">{summary}</p>

        </div>

        <CoachingPathCard analysis={analysis} />

        <Section title="情绪识别" icon={<Heart className="w-4 h-4 text-pink-400" />}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoItem label="主要情绪" value={emotion.primary} />
            <InfoItem label="次要情绪" value={emotion.secondary || '—'} />
            <InfoItem label="强度" value={`${emotion.intensity}%`} />
            <InfoItem label="趋势" value={emotion.trend} />
          </div>
          <div className="mt-2 h-2 bg-soul-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-soul-500 rounded-full transition-all duration-700"
              style={{ width: `${emotion.intensity}%` }}
            />
          </div>
        </Section>

        <EmotionRadarSection analysis={analysis} />
        <RiskAssessmentSection analysis={analysis} />
        <RelationshipDashboardSection analysis={analysis} />
        <KeyMomentsSection analysis={analysis} />

        <Section title="心理画像" icon={<Brain className="w-4 h-4 text-soul-400" />}>
          <div className="space-y-2 text-sm">
            <InfoItem label="情绪状态" value={psychology.emotionalState} full />
            <InfoItem label="心理状态" value={psychology.mentalState} full />
            <InfoItem label="潜台词" value={psychology.subtext} full highlight />
            <div className="flex items-center gap-2">
              <span className="text-soul-400 text-xs shrink-0">好感度</span>
              <span className={`font-bold ${interestColor}`}>{psychology.interestLevel}%</span>
              <span className="tag bg-soul-800 text-soul-300 ml-auto">{psychology.relationshipStage}</span>
            </div>
            {(psychology.chatDesire || psychology.impressionOfMe || psychology.isPerfunctory) && (
              <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-soul-700/20">
                {psychology.chatDesire && (
                  <InfoItem label="聊天欲望" value={psychology.chatDesire} />
                )}
                {psychology.impressionOfMe && (
                  <InfoItem label="对你印象" value={psychology.impressionOfMe} />
                )}
                {psychology.isPerfunctory && (
                  <InfoItem label="是否敷衍" value={psychology.isPerfunctory} highlight />
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {psychology.personalityTraits.map((trait, i) => (
                <span key={i} className="tag bg-soul-700/50 text-soul-200">
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </Section>



        <FemalePsychologySection insight={femalePsychology ?? {
          socialScenario: '',
          coreNeeds: [],
          commStyle: '',
          replyPrinciple: '',
          scenarioTip: '',
          shitTestNote: '',
        }} />



        <Section title="核心穿透" icon={<TrendingUp className="w-4 h-4 text-purple-400" />}>

          {reportItems.length > 0 ? (
            <div className="space-y-2">
              {reportItems.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-2.5 text-sm py-1.5 border-b border-soul-700/20 last:border-0"
                >
                  <span className="text-purple-300/90 shrink-0 text-xs font-medium w-10 pt-0.5">
                    {shortReportLabel(item.label)}
                  </span>
                  <span className="text-soul-200 leading-snug flex-1">{item.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-soul-200 leading-snug">{deepReport}</p>
          )}

        </Section>



        <Section title="策略详解" icon={<Target className="w-4 h-4 text-green-400" />}>

          <div className="space-y-3 text-sm">

            <StrategyItem title="核心策略" content={strategy.coreStrategy || strategy.nextMove} accent />

            <StrategyItem title="为什么这么做" content={strategy.whyStrategy} />

            <StrategyItem title="情绪置换" content={strategy.emotionSwap} />

            <StrategyItem title="框架调整" content={strategy.frameAdjust} />

            <StrategyItem title="沟通补充" content={strategy.communicationStrategy} />

            <StrategyItem title="可发送方向" content={strategy.nextMove} />

            {strategy.warnings.length > 0 && (

              <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">

                <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-medium mb-1">

                  <AlertTriangle className="w-3.5 h-3.5" /> 注意事项

                </div>

                <ul className="text-yellow-200/80 text-xs space-y-0.5 list-disc list-inside">

                  {strategy.warnings.map((w, i) => (

                    <li key={i}>{w}</li>

                  ))}

                </ul>

              </div>

            )}

          </div>

        </Section>

      </div>

    </div>

  );

}



function Section({

  title,

  icon,

  children,

}: {

  title: string;

  icon: React.ReactNode;

  children: React.ReactNode;

}) {

  return (

    <div className="p-3 bg-soul-950/30 rounded-xl border border-soul-700/20">

      <div className="flex items-center gap-2 mb-2.5">

        {icon}

        <h3 className="text-sm font-medium text-soul-300">{title}</h3>

      </div>

      {children}

    </div>

  );

}



function InfoItem({

  label,

  value,

  full,

  highlight,

}: {

  label: string;

  value: string;

  full?: boolean;

  highlight?: boolean;

}) {

  return (

    <div className={full ? 'col-span-2' : ''}>

      <span className="text-soul-500 text-xs">{label}</span>

      <p className={`text-soul-200 ${highlight ? 'text-pink-300 italic' : ''} ${full ? 'mt-0.5' : ''}`}>

        {value}

      </p>

    </div>

  );

}



function StrategyItem({

  title,

  content,

  accent,

}: {

  title: string;

  content: string;

  accent?: boolean;

}) {

  if (!content) return null;

  return (

    <div>

      <span className={`text-xs font-medium ${accent ? 'text-pink-400' : 'text-soul-400'}`}>{title}</span>

      <p className="text-soul-200 mt-0.5 leading-relaxed">{content}</p>

    </div>

  );

}


