import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { parseMemoryLines } from '../utils/chatMemory';

interface ChatMemoryPanelProps {
  details: string;
  disabled?: boolean;
  onChange: (details: string) => void;
  /** 手机紧凑：更矮的折叠条 */
  compact?: boolean;
}

export default function ChatMemoryPanel({
  details,
  disabled = false,
  onChange,
  compact = false,
}: ChatMemoryPanelProps) {
  const lineCount = parseMemoryLines(details).length;
  /** 聊天记忆默认折叠，保持左侧清爽 */
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`px-3 border-b border-violet-500/10 bg-violet-950/15 shrink-0 ${
        compact ? 'py-1' : 'py-2'
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between gap-2 text-left touch-manipulation ${
          compact ? 'min-h-[32px] py-0.5' : 'min-h-[36px] py-1'
        }`}
      >
        <span
          className={`text-soul-300 flex items-center gap-1.5 font-medium ${
            compact ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          聊天记忆
          {lineCount > 0 ? (
            <span className="font-normal text-violet-300/90">{lineCount} 条</span>
          ) : (
            <span className="font-normal text-soul-500">未记录</span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-soul-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-soul-500 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className={`space-y-1.5 animate-fade-in ${compact ? 'mt-1' : 'mt-1.5'}`}>
          {!compact && (
            <p className="text-xs sm:text-[10px] text-soul-400 leading-snug">
              忌口、心愿、随口提过的小事（每行一条）。分析后会自动补充，重置对话不会清空。
            </p>
          )}
          <textarea
            value={details}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={'不爱吃香菜\n下周要考试\n喜欢猫不喜欢狗…'}
            rows={compact ? 2 : 3}
            className={`input-field w-full resize-none ${compact ? 'text-xs py-2' : 'text-sm'}`}
          />
        </div>
      )}
    </div>
  );
}
