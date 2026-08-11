import {
  BarChart3,
  Loader2,
  Thermometer,
  TrendingUp,
  AlertTriangle,
  Target,
  Compass,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { computeChatMetrics } from '../constants/relationshipReport';
import RelationshipTrackingCard from './RelationshipTrackingCard';
import TemperatureCurve from './TemperatureCurve';
import { useMemo } from 'react';

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-soul-400">{label}</span>
        <span className="text-soul-200 font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-soul-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ListBlock({
  title,
  icon: Icon,
  items,
  accent,
}: {
  title: string;
  icon: typeof Target;
  items: string[];
  accent: string;
}) {
  if (!items.length) return null;
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accent}`}>
      <p className="text-[11px] font-medium mb-1.5 flex items-center gap-1 opacity-90">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="text-[12px] text-soul-100 leading-snug">
            · {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 灵焰关系数据分析面板 */
export default function RelationshipReportPanel() {
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const analysis = useAppStore((s) => s.analysis);
  const report = useAppStore((s) => s.relationshipReport);
  const generating = useAppStore((s) => s.isGeneratingRelationshipReport);
  const generateReport = useAppStore((s) => s.generateRelationshipReport);

  const liveMetrics = useMemo(
    () => computeChatMetrics(messages, settings, analysis),
    [messages, settings, analysis]
  );

  const metrics = report?.metrics ?? liveMetrics;
  const currentTemp =
    analysis?.relationshipMetrics?.temperature ??
    analysis?.psychology?.interestLevel ??
    metrics.temperatureNow;

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-soul-950/70 to-sky-950/20 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/30">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-emerald-100">关系数据分析</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              亲密度 · 好感趋势 · 短板 · 氛围 · 升温策略 · 推进时机
            </p>
          </div>
          {report && (
            <span className="tag text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 shrink-0">
              {report.source === 'ai' ? 'AI 报告' : '本地报告'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-soul-900/60 border border-soul-700/30 px-2.5 py-2">
            <p className="text-[10px] text-soul-500">亲密度</p>
            <p className="text-lg font-semibold text-emerald-200 tabular-nums">
              {report?.intimacy ?? metrics.intimacyEstimate}
            </p>
          </div>
          <div className="rounded-xl bg-soul-900/60 border border-soul-700/30 px-2.5 py-2">
            <p className="text-[10px] text-soul-500">好感趋势</p>
            <p className="text-sm font-medium text-sky-200 mt-0.5 truncate">
              {metrics.favorTrend}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <Meter label="关系温度" value={metrics.temperatureNow} color="bg-gradient-to-r from-rose-500 to-amber-400" />
          <Meter label="我方话量占比" value={metrics.myTalkShare} color="bg-gradient-to-r from-violet-500 to-pink-400" />
          <Meter label="对方短回率" value={metrics.otherShortRatio} color="bg-gradient-to-r from-amber-500 to-red-400" />
        </div>

        <p className="text-[10px] text-soul-500 mb-2">
          共 {metrics.totalMessages} 条 · 你 {metrics.myCount} / 对方 {metrics.otherCount} · 阶段「
          {metrics.stage}」· 均长 你{metrics.myAvgLen}/对方{metrics.otherAvgLen}字
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={generating || metrics.totalMessages === 0}
            onClick={() => void generateReport()}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 生成报告中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> 生成完整关系报告
              </>
            )}
          </button>
          <button
            type="button"
            disabled={generating || metrics.totalMessages === 0}
            onClick={() => void generateReport({ localOnly: true })}
            className="btn-secondary text-xs min-h-[44px] px-3 shrink-0"
          >
            本地快报
          </button>
        </div>
      </div>

      <RelationshipTrackingCard />

      <TemperatureCurve
        history={settings.temperatureHistory ?? []}
        currentTemperature={currentTemp}
      />

      {/* 完整报告 */}
      {report ? (
        <div className="space-y-2.5">
          <div className="rounded-2xl border border-sky-500/25 bg-sky-950/15 p-3">
            <p className="text-xs font-medium text-sky-200 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 报告摘要
            </p>
            <p className="text-[13px] text-soul-100 leading-snug">{report.summary}</p>
            <p className="text-[11px] text-soul-400 mt-2 flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> 氛围：{report.atmosphere}
            </p>
            <p className="text-[11px] text-soul-400 mt-1">好感：{report.favorTrend}</p>
          </div>

          <ListBlock
            title="聊天短板"
            icon={AlertTriangle}
            items={report.shortfalls}
            accent="border-amber-500/25 bg-amber-950/15"
          />
          <ListBlock
            title="沟通问题"
            icon={AlertTriangle}
            items={report.communicationIssues}
            accent="border-rose-500/25 bg-rose-950/15"
          />
          <ListBlock
            title="可落地升温策略"
            icon={Target}
            items={report.warmUpStrategy}
            accent="border-pink-500/25 bg-pink-950/15"
          />
          <ListBlock
            title="聊天改进方向"
            icon={Compass}
            items={report.improveDirections}
            accent="border-violet-500/25 bg-violet-950/15"
          />

          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-3 py-2.5">
            <p className="text-[11px] font-medium text-emerald-200 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 最佳推进时机
            </p>
            <p className="text-[13px] text-soul-100 leading-snug">{report.bestTiming}</p>
          </div>

          <ListBlock
            title="下一步行动建议"
            icon={Sparkles}
            items={report.nextActions}
            accent="border-cyan-500/25 bg-cyan-950/15"
          />

          <p className="text-[10px] text-soul-600 text-center">
            生成于{' '}
            {new Date(report.generatedAt).toLocaleString('zh-CN', { hour12: false })}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-emerald-500/25 bg-emerald-950/10 px-4 py-5 text-center">
          <p className="text-sm text-emerald-100/90 mb-1">基于全部聊天记录生成完整报告</p>
          <p className="text-[11px] text-soul-500 leading-relaxed">
            先粘贴双方对话，再点「生成完整关系报告」。无 Key 时可用「本地快报」先看指标与策略。
          </p>
          {metrics.shortfalls.length > 0 && (
            <ul className="mt-3 text-left text-[11px] text-soul-400 space-y-1 max-w-sm mx-auto">
              {metrics.shortfalls.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
