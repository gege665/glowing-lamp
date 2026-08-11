import { ChevronDown } from 'lucide-react';
import type { ChatStyleType } from '../constants/chatStylePrompts';
import { CHAT_STYLE_OPTIONS, getChatStyleOption } from '../constants/chatStylePrompts';

interface ChatStyleSelectorProps {
  value: ChatStyleType;
  onChange: (style: ChatStyleType) => void;
  disabled?: boolean;
  compact?: boolean;
  showDescription?: boolean;
  className?: string;
}

export default function ChatStyleSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
  showDescription = false,
  className = '',
}: ChatStyleSelectorProps) {
  const current = getChatStyleOption(value);
  const selectClass = compact
    ? 'input-field text-xs py-2 sm:py-1.5 pl-2 pr-7 min-h-[44px] sm:min-h-0 max-w-[120px] sm:max-w-[160px]'
    : 'input-field text-sm w-full pl-3 pr-9';

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <div className="relative">
        {!compact && (
          <label className="text-xs text-soul-400 mb-1.5 block">聊天风格（10 套可切换）</label>
        )}
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as ChatStyleType)}
          className={`${selectClass} appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
          title={current.description}
          aria-label="切换聊天风格"
        >
          {CHAT_STYLE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {compact ? `${opt.shortLabel} · ${opt.label}` : `${opt.label} — ${opt.description}`}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-soul-500" />
      </div>
      {showDescription && (
        <p className="text-[11px] text-soul-500 mt-1.5 leading-relaxed">
          当前：<span className="text-soul-300">{current.label}</span> · {current.description}
        </p>
      )}
      {compact && (
        <span className="sr-only">
          当前风格：{current.label}，{current.description}
        </span>
      )}
    </div>
  );
}
