import { AlertTriangle, Activity, Radar, Flag } from 'lucide-react';
import type { AnalysisResult, TemperaturePoint } from '../types';
import { EMOTION_RADAR_TYPES } from '../constants/productFeatures';
import TemperatureCurve from './TemperatureCurve';
import { useAppStore } from '../store/appStore';

const RISK_COLORS = {
  low: 'text-green-400 bg-green-500/10 border-green-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  high: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const RISK_LABELS = { low: '低风险', medium: '中等风险', high: '高风险' };

interface AnalysisInsightsProps {
  analysis: AnalysisResult;
}

export function EmotionRadarSection({ analysis }: AnalysisInsightsProps) {
  const radar = analysis.emotionRadar ?? [];
  if (!radar.length) return null;

  const merged = EMOTION_RADAR_TYPES.map((type) => {
    const found = radar.find((r) => r.type === type);
    return { type, score: found?.score ?? 0 };
  });

  return (
    <div className="p-3 bg-soul-950/30 rounded-xl border border-soul-700/20">
      <div className="flex items-center gap-2 mb-3">
        <Radar className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-medium text-soul-300">情绪雷达</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {merged.map(({ type, score }) => (
          <div key={type} className="text-center">
            <div className="h-1.5 bg-soul-800 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full transition-all"
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-[10px] text-soul-400">{type}</span>
            <span className="text-[10px] text-soul-500 ml-0.5">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskAssessmentSection({ analysis }: AnalysisInsightsProps) {
  const risk = analysis.riskAssessment;
  if (!risk) return null;

  const colorClass = RISK_COLORS[risk.level] ?? RISK_COLORS.low;

  return (
    <div className={`p-3 rounded-xl border ${colorClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <h3 className="text-sm font-medium">反套路反诈 · {RISK_LABELS[risk.level]}</h3>
      </div>
      {risk.tags && risk.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {risk.tags.map((t) => (
            <span key={t} className="tag text-[10px] bg-black/20 border border-white/10">
              {t}
            </span>
          ))}
        </div>
      )}
      {risk.dissection && (
        <p className="text-xs opacity-90 mb-1.5">
          <span className="opacity-70">拆解：</span>
          {risk.dissection}
        </p>
      )}
      {((risk.alerts?.length ? risk.alerts : risk.signals) ?? []).length > 0 && (
        <ul className="text-xs space-y-0.5 mb-2 list-disc list-inside opacity-90">
          {((risk.alerts?.length ? risk.alerts : risk.signals) ?? []).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {risk.motivation && (
        <p className="text-xs opacity-90">
          <span className="opacity-70">动机：</span>
          {risk.motivation}
        </p>
      )}
      {risk.advice && (
        <p className="text-xs mt-1 opacity-90">
          <span className="opacity-70">建议：</span>
          {risk.advice}
        </p>
      )}
      {risk.worthContinuing && (
        <p className="text-xs mt-1 opacity-90">
          <span className="opacity-70">是否继续：</span>
          {risk.worthContinuing}
        </p>
      )}
      {risk.counterReplies && risk.counterReplies.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] opacity-70">反制话术</p>
          {risk.counterReplies.map((r, i) => (
            <p key={i} className="text-xs opacity-95 leading-snug">
              · {r}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function RelationshipDashboardSection({ analysis }: AnalysisInsightsProps) {
  const rel = analysis.relationshipMetrics;
  const history = useAppStore((s) => s.settings.temperatureHistory) as TemperaturePoint[];
  if (!rel) return null;

  const tempColor =
    rel.temperature >= 70 ? 'text-green-400' : rel.temperature >= 40 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-3">
      <TemperatureCurve history={history ?? []} currentTemperature={rel.temperature} />
      <div className="p-3 bg-soul-950/30 rounded-xl border border-soul-700/20">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-medium text-soul-300">关系仪表盘</h3>
          {rel.stage && <span className="tag bg-rose-500/20 text-rose-300 text-[10px] ml-auto">{rel.stage}</span>}
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-center">
            <p className={`text-2xl font-bold ${tempColor}`}>{rel.temperature}°</p>
            <p className="text-[10px] text-soul-500">关系温度</p>
          </div>
          <div className="flex-1 h-2 bg-soul-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 rounded-full"
              style={{ width: `${rel.temperature}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {rel.interactionFreq && (
            <div>
              <span className="text-soul-500">互动频率</span>
              <p className="text-soul-200">{rel.interactionFreq}</p>
            </div>
          )}
          {rel.topicDepth && (
            <div>
              <span className="text-soul-500">话题深度</span>
              <p className="text-soul-200">{rel.topicDepth}</p>
            </div>
          )}
          {rel.trend && (
            <div className="col-span-2">
              <span className="text-soul-500">趋势</span>
              <p className="text-soul-200">{rel.trend}</p>
            </div>
          )}
          {rel.suggestion && (
            <div className="col-span-2">
              <span className="text-soul-500">改进建议</span>
              <p className="text-soul-200">{rel.suggestion}</p>
            </div>
          )}
          {rel.inviteTiming && (
            <div className="col-span-2">
              <span className="text-soul-500">邀约时机</span>
              <p className="text-pink-300">{rel.inviteTiming}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KeyMomentsSection({ analysis }: AnalysisInsightsProps) {
  const moments = analysis.keyMoments ?? [];
  if (!moments.length) return null;

  return (
    <div className="p-3 bg-soul-950/30 rounded-xl border border-soul-700/20">
      <div className="flex items-center gap-2 mb-2">
        <Flag className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-medium text-soul-300">对话关键节点</h3>
      </div>
      <div className="space-y-2">
        {moments.map((m, i) => (
          <div key={i} className="flex gap-2 text-sm">
            <span className="text-amber-300/90 shrink-0 text-xs font-medium">{m.label}</span>
            <span className="text-soul-200 leading-snug">{m.meaning}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
