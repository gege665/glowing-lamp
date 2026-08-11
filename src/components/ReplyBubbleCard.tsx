import { Copy, Send, ChevronDown, ChevronUp, Heart, Bookmark } from 'lucide-react';
import { parseReplyBubbleContent } from '../utils/replyBubble';

export interface ReplyBubbleCardProps {
  label: string;
  tagClass: string;
  content: string;
  subtitle?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onCopy?: () => void;
  onSend?: () => void;
  onSave?: () => void;
  showActions?: boolean;
  className?: string;
}

export default function ReplyBubbleCard({
  label,
  tagClass,
  content,
  subtitle,
  isExpanded = true,
  onToggleExpand,
  onCopy,
  onSend,
  onSave,
  showActions = true,
  className = '',
}: ReplyBubbleCardProps) {
  const displayContent = content.trim() || '（未生成有效话术，请重新分析）';
  const { text, meta } = parseReplyBubbleContent(displayContent);

  return (
    <div
      className={`rounded-xl border border-soul-700/35 bg-soul-900/50 p-3 ${className}`.trim()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`tag ${tagClass} w-fit`}>{label}</span>
          {subtitle && (
            <p className="text-[10px] text-soul-500 leading-snug pl-0.5">{subtitle}</p>
          )}
        </div>
        {onToggleExpand && (
          <button type="button" onClick={onToggleExpand} className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0" aria-label="展开或收起">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-full sm:max-w-[95%] sm:min-w-[72%]">
          <div className="flex items-center gap-1 justify-end mb-1">
            <span className="text-[11px] text-soul-500">我方</span>
            <Heart className="w-3 h-3 text-pink-400/80" />
          </div>
          <div
            className={`px-4 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-br from-soul-600 to-soul-700 text-white text-sm leading-relaxed shadow-md shadow-soul-950/50 ${
              isExpanded ? '' : 'line-clamp-3'
            }`}
          >
            {text}
          </div>
          {meta && (
            <p
              className={`text-[11px] text-soul-500 mt-1.5 text-right leading-snug ${
                isExpanded ? '' : 'line-clamp-1'
              }`}
            >
              {meta}
            </p>
          )}
        </div>
      </div>

      {showActions && onCopy && onSend && (
        <div className="flex gap-2 mt-2.5">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="btn-ghost px-3 py-2.5 min-h-[44px] text-amber-400"
              title="收藏到话术工坊"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 min-h-[44px]"
          >
            <Copy className="w-3.5 h-3.5" /> 复制
          </button>
          <button
            type="button"
            onClick={onSend}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5" /> 发送
          </button>
        </div>
      )}
    </div>
  );
}
