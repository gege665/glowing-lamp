import { Thermometer, ShieldAlert, TrendingUp, Compass, Sparkles } from 'lucide-react';
import type { RelationshipTrackingSnapshot } from '../types/partnerArchive';
import { useAppStore } from '../store/appStore';

interface RelationshipTrackingCardProps {
  tracking?: RelationshipTrackingSnapshot | null;
  className?: string;
}

/** 关系追踪看板：温度 / 氛围 / 判断 / 升温 / 避雷 / 下一步 */
export default function RelationshipTrackingCard({
  tracking: trackingProp,
  className = '',
}: RelationshipTrackingCardProps) {
  const storeTracking = useAppStore((s) => s.relationshipTracking);
  const partnerName = useAppStore((s) => s.settings.otherNickname);
  const tracking = trackingProp !== undefined ? trackingProp : storeTracking;

  if (!tracking) {
    return (
      <div
        className={`rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-soul-950/50 p-4 ${className}`}
      >
        <p className="text-sm font-medium text-emerald-100 mb-1">关系追踪 · 长效记忆</p>
        <p className="text-xs text-soul-400 leading-relaxed">
          与「{partnerName || 'TA'}」对话并生成分析后，这里会自动给出关系判断、升温建议、避雷提醒与下一步策略。每人档案独立保存。
        </p>
      </div>
    );
  }

  const tempColor =
    tracking.temperature >= 70
      ? 'text-green-400'
      : tracking.temperature >= 40
        ? 'text-amber-300'
        : 'text-rose-300';

  return (
    <div
      className={`rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-soul-950/60 to-amber-950/20 p-4 space-y-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-emerald-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            关系追踪 · {partnerName || 'TA'}
          </p>
          <p className="text-[10px] text-soul-500 mt-0.5">
            更新于 {new Date(tracking.updatedAt).toLocaleString('zh-CN', { hour12: false })}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${tempColor} flex items-center gap-1 justify-end`}>
            <Thermometer className="w-4 h-4" />
            {tracking.temperature}°
          </p>
          <p className="text-[10px] text-soul-500">关系温度</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs">
        <div className="rounded-xl bg-soul-900/50 border border-soul-700/30 px-3 py-2">
          <p className="text-[10px] text-soul-500 mb-0.5">聊天氛围</p>
          <p className="text-soul-100 leading-snug">{tracking.atmosphere}</p>
        </div>
        <div className="rounded-xl bg-soul-900/50 border border-soul-700/30 px-3 py-2">
          <p className="text-[10px] text-soul-500 mb-0.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 进展状态
          </p>
          <p className="text-soul-100 leading-snug">{tracking.progress}</p>
        </div>
        <div className="rounded-xl bg-soul-900/50 border border-soul-700/30 px-3 py-2">
          <p className="text-[10px] text-soul-500 mb-0.5">关系判断</p>
          <p className="text-soul-100 leading-snug">{tracking.judgment}</p>
        </div>
      </div>

      {tracking.warmUpTips.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2">
          <p className="text-[10px] text-amber-300 mb-1.5">升温建议</p>
          <ul className="space-y-1">
            {tracking.warmUpTips.map((t) => (
              <li key={t} className="text-[11px] text-soul-200 leading-snug">
                · {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tracking.riskAlerts.length > 0 && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-950/20 px-3 py-2">
          <p className="text-[10px] text-rose-300 mb-1.5 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> 避雷提醒
          </p>
          <ul className="space-y-1">
            {tracking.riskAlerts.map((t) => (
              <li key={t} className="text-[11px] text-soul-200 leading-snug">
                · {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 px-3 py-2">
        <p className="text-[10px] text-sky-300 mb-1 flex items-center gap-1">
          <Compass className="w-3 h-3" /> 下一步聊天策略
        </p>
        <p className="text-[12px] text-soul-100 leading-snug">{tracking.nextStrategy}</p>
      </div>
    </div>
  );
}
