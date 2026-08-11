import { MessageCircle, Heart, UserRound } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { ActivePanel } from '../types';

const NAV_ITEMS: { id: ActivePanel; label: string; icon: typeof MessageCircle }[] = [
  { id: 'chat', label: '聊天', icon: MessageCircle },
  { id: 'love', label: '恋爱', icon: Heart },
  { id: 'me', label: '我的', icon: UserRound },
];

/** 手机 + 平板底栏（&lt;1024px）；桌面用悬浮层打开恋爱/我的 */
export default function MobileNav() {
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const analysis = useAppStore((s) => s.analysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);

  const navActive =
    activePanel === 'analysis' || activePanel === 'replies' ? 'love' : activePanel;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-soul-900/95 backdrop-blur-xl border-t border-rose-500/15 safe-bottom">
      <div className="flex items-stretch justify-around px-1 pt-1 pb-1 max-w-3xl mx-auto w-full">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = navActive === id;
          const hasBadge =
            id === 'love' &&
            ((Boolean(analysis?.replies?.length) && !isAnalyzing) || isAnalyzing);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActivePanel(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 rounded-xl transition-all relative touch-manipulation ${
                isActive ? 'text-rose-200' : 'text-soul-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-rose-300' : ''}`} />
              <span className="text-[11px] font-medium">{label}</span>
              {hasBadge && id === 'love' && (
                <span
                  className={`absolute top-1.5 right-[calc(50%-1.25rem)] w-2 h-2 rounded-full ${
                    isAnalyzing ? 'bg-pink-400 animate-pulse' : 'bg-pink-500'
                  }`}
                />
              )}
              {isActive && (
                <span className="absolute bottom-0.5 w-10 h-0.5 bg-gradient-to-r from-rose-400 to-amber-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
