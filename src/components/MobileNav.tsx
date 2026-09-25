import { MessageCircle, Brain, MessageSquare } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ActivePanel } from '../types';

const NAV_ITEMS: { id: ActivePanel; label: string; icon: typeof MessageCircle }[] = [
  { id: 'chat', label: '对话', icon: MessageCircle },
  { id: 'analysis', label: '分析', icon: Brain },
  { id: 'replies', label: '话术', icon: MessageSquare },
];

export default function MobileNav() {
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const analysis = useAppStore((s) => s.analysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-soul-900/95 backdrop-blur-xl border-t border-soul-700/30 safe-bottom pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-stretch justify-around px-1 pt-1 pb-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activePanel === id;
          const hasBadge =
            (id === 'replies' && analysis && analysis.replies.length > 0 && !isAnalyzing) ||
            (id === 'analysis' && isAnalyzing);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActivePanel(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 rounded-xl transition-all relative touch-manipulation ${
                isActive ? 'text-soul-200' : 'text-soul-500'
              }`}
            >
              <Icon className={`w-5 h-5 sm:w-5 sm:h-5 ${isActive ? 'text-soul-300' : ''}`} />
              <span className="text-[11px] sm:text-[10px] font-medium">{label}</span>
              {hasBadge && (
                <span
                  className={`absolute top-1.5 right-[calc(50%-1.25rem)] w-2 h-2 rounded-full ${
                    isAnalyzing && id === 'analysis' ? 'bg-pink-400 animate-pulse' : 'bg-pink-500'
                  }`}
                />
              )}
              {isActive && (
                <span className="absolute bottom-0.5 w-10 h-0.5 bg-gradient-to-r from-soul-500 to-pink-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
