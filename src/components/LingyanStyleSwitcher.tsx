import { CORE_STYLE_META, type CoreStyleId } from '../constants/coreReplyStyles';

/** 六种实战风格全部常驻 */
export const CORE_STYLE_PRIMARY: CoreStyleId[] = [
  'natural',
  'ambiguous',
  'cool',
  'puppy',
  'daddy',
  'rogue',
];

interface LingyanStyleSwitcherProps {
  value: CoreStyleId | '';
  onChange: (id: CoreStyleId | '') => void;
  disabled?: boolean;
  compact?: boolean;
  showHeader?: boolean;
}

function chipClass(selected: boolean): string {
  return selected
    ? 'bg-gradient-to-r from-rose-600/35 to-amber-500/25 text-rose-100 border-rose-400/50 shadow-sm shadow-rose-950/30'
    : 'bg-soul-800/50 text-soul-400 border-soul-700/40 hover:border-rose-500/30 hover:text-soul-200';
}

/** 灵焰多风格话术 · 六种实战口吻 */
export default function LingyanStyleSwitcher({
  value,
  onChange,
  disabled = false,
  compact = false,
  showHeader = true,
}: LingyanStyleSwitcherProps) {
  const active = value ? CORE_STYLE_META.find((m) => m.id === value) : null;

  return (
    <div className="space-y-1.5">
      {showHeader && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-soul-300`}>
            {compact ? '风格' : '可选风格'}
            {active ? (
              <span className="text-rose-300/90"> ·「{active.shortLabel}」</span>
            ) : (
              !compact && <span className="text-soul-500"> · 混排备选</span>
            )}
          </span>
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('')}
              className="text-[10px] text-soul-500 hover:text-soul-300 touch-manipulation min-h-[28px] px-1"
            >
              取消
            </button>
          )}
        </div>
      )}

      <div className={`flex flex-wrap items-stretch ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {CORE_STYLE_META.map((m) => {
          const selected = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              title={`${m.label} · ${m.usage}`}
              onClick={() => onChange(selected ? '' : m.id)}
              className={`flex-1 min-w-[4.2rem] border rounded-lg text-center transition-all touch-manipulation ${chipClass(selected)} ${
                compact ? 'px-1 py-1.5 min-h-[36px]' : 'px-1.5 py-2 min-h-[40px]'
              }`}
            >
              <span
                className={`block font-medium leading-tight ${compact ? 'text-[10px]' : 'text-[11px]'}`}
              >
                {compact ? m.shortLabel : m.label}
              </span>
            </button>
          );
        })}
      </div>

      {active && !compact && (
        <p className="text-[10px] text-rose-200/80 leading-snug px-0.5">
          生成话术将统一「{active.label}」口吻（多角度变体）· {active.usage}
        </p>
      )}
    </div>
  );
}
