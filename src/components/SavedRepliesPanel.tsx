import { Bookmark, Trash2 } from 'lucide-react';
import type { SavedReply } from '../types';
import { loadSavedReplies, removeSavedReply } from '../services/storageService';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';

interface SavedRepliesPanelProps {
  onUse: (content: string) => void;
}

export default function SavedRepliesPanel({ onUse }: SavedRepliesPanelProps) {
  const [items, setItems] = useState<SavedReply[]>([]);
  const showToast = useAppStore((s) => s.showToast);
  const savedRepliesTick = useAppStore((s) => s.savedRepliesTick);

  const refresh = () => setItems(loadSavedReplies());

  useEffect(() => {
    refresh();
  }, [savedRepliesTick]);

  if (items.length === 0) return null;

  return (
    <div className="p-3 rounded-xl border border-soul-700/30 bg-soul-900/30 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Bookmark className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-medium text-soul-300">话术工坊 · 已收藏 {items.length} 条</span>
      </div>
      <div className="space-y-1.5 max-h-32 overflow-y-auto scroll-touch">
        {items.slice(-5).reverse().map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 text-xs group"
          >
            <button
              type="button"
              onClick={() => onUse(item.content)}
              className="flex-1 text-left text-soul-300 hover:text-pink-300 truncate py-2.5 min-h-[44px] touch-manipulation"
              title={item.content}
            >
              {item.label && <span className="text-soul-500 mr-1">[{item.label}]</span>}
              {item.content}
            </button>
            <button
              type="button"
              onClick={() => {
                removeSavedReply(item.id);
                refresh();
                showToast('已删除');
              }}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-red-400/70 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
