import type { TemperaturePoint } from '../types';

interface TemperatureCurveProps {
  history: TemperaturePoint[];
  currentTemperature?: number;
  className?: string;
}

/** 关系温度折线（纯 SVG，无额外依赖） */
export default function TemperatureCurve({
  history,
  currentTemperature,
  className = '',
}: TemperatureCurveProps) {
  const points =
    history.length > 0
      ? history
      : typeof currentTemperature === 'number'
        ? [{ at: Date.now(), temperature: currentTemperature }]
        : [];

  if (points.length === 0) {
    return (
      <div className={`rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-soul-950/60 p-4 ${className}`}>
        <p className="text-sm text-rose-100/90 font-medium mb-1">关系温度曲线</p>
        <p className="text-xs text-soul-400 leading-relaxed">
          完成一次分析后，这里会记录亲密度变化，帮你把握推进节奏。
        </p>
        <div className="mt-4 h-24 rounded-xl bg-soul-900/50 border border-dashed border-soul-700/40 flex items-center justify-center text-soul-500 text-xs">
          暂无数据 · 去聊天页生成话术
        </div>
      </div>
    );
  }

  const w = 320;
  const h = 120;
  const padX = 12;
  const padY = 16;
  const temps = points.map((p) => p.temperature);
  const minT = Math.max(0, Math.min(...temps) - 8);
  const maxT = Math.min(100, Math.max(...temps) + 8);
  const span = Math.max(maxT - minT, 10);

  const coords = points.map((p, i) => {
    const x = padX + (i / Math.max(points.length - 1, 1)) * (w - padX * 2);
    const y = h - padY - ((p.temperature - minT) / span) * (h - padY * 2);
    return { x, y, t: p.temperature };
  });

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x},${h - padY} L${coords[0].x},${h - padY} Z`;
  const latest = points[points.length - 1];
  const trend =
    points.length >= 2
      ? latest.temperature - points[points.length - 2].temperature
      : 0;

  return (
    <div className={`rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/50 via-soul-950/70 to-amber-950/30 p-4 ${className}`}>
      <div className="flex items-end justify-between gap-2 mb-2">
        <div>
          <p className="text-sm text-rose-100 font-medium">关系温度曲线</p>
          <p className="text-[11px] text-soul-400 mt-0.5">
            {latest.stage || '当前关系'} · 共 {points.length} 次记录
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold bg-gradient-to-r from-rose-300 to-amber-200 bg-clip-text text-transparent">
            {latest.temperature}°
          </p>
          <p className={`text-[11px] ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-amber-400' : 'text-soul-500'}`}>
            {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '持平'}
          </p>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(244,114,182,0.45)" />
            <stop offset="100%" stopColor="rgba(244,114,182,0)" />
          </linearGradient>
          <linearGradient id="tempStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tempFill)" />
        <path d={line} fill="none" stroke="url(#tempStroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 2.5} fill="#fda4af" />
        ))}
      </svg>
      <p className="text-[11px] text-soul-400 leading-snug mt-1">
        {trend >= 5
          ? '温度上升，可适度推进邀约或暧昧浓度。'
          : trend <= -5
            ? '温度回落，先稳住情绪价值，别急着定性。'
            : '节奏平稳，保持日常互动与细节记忆。'}
      </p>
    </div>
  );
}
