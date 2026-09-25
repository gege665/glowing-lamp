import { useState, useEffect } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { parseMemoryLines } from '../utils/chatMemory';

interface ChatMemoryPanelProps {
  details: string;
  disabled?: boolean;
  onChange: (details: string) => void;
  /** 有对话且无记忆时默认展开 */
  suggestFill?: boolean;
}

export default function ChatMemoryPanel({
  details,
  disabled = false,
  onChange,
  suggestFill = false,
}: ChatMemoryPanelProps) {
  const lineCount = parseMemoryLines(details).length;
  const [expanded, setExpanded] = useState(suggestFill && lineCount === 0);

  useEffect(() => {
    if (suggestFill && lineCount === 0) setExpanded(true);
  }, [suggestFill, lineCount]);

  return (
    <div className="px-3 py-2 border-b border-soul-700/20 bg-soul-950/30 shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left min-h-[44px] touch-manipulation py-1"
      >
        <span className="text-xs sm:text-[11px] text-soul-300 flex items-center gap-1.5">
          <Brain className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-violet-400" />
          聊天记忆
          {lineCount > 0 ? (
            <span className="text-violet-300/90">{lineCount} 条</span>
          ) : (
            <span className="text-soul-500">未记录</span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-soul-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-soul-500 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs sm:text-[10px] text-soul-400 leading-snug">
            忌口、心愿、随口提过的小事（每行一条）。分析后会自动补充，重置对话不会清空。
          </p>
          <textarea
            value={details}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={'不爱吃香菜\n下周要考试\n喜欢猫不喜欢狗…'}
            rows={3}
            className="input-field w-full resize-none text-sm"
          />
        </div>
      )}
    </div>
  );
}
