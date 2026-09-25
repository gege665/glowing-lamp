import { lazy, Suspense, useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import AnalysisPanel from './components/AnalysisPanel';
import ReplyPanel from './components/ReplyPanel';
import Toast from './components/Toast';
import MobileNav from './components/MobileNav';

const SettingsModal = lazy(() => import('./components/SettingsModal'));

type LayoutMode = 'desktop' | 'tablet' | 'mobile';

function getLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
  return 'desktop';
}

function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(getLayoutMode);

  useEffect(() => {
    const update = () => setMode(getLayoutMode());
    const mobile = window.matchMedia('(max-width: 767px)');
    const tablet = window.matchMedia('(max-width: 1023px)');
    mobile.addEventListener('change', update);
    tablet.addEventListener('change', update);
    return () => {
      mobile.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
    };
  }, []);

  return mode;
}

function panelVisibility(
  layoutMode: LayoutMode,
  activePanel: string,
  panel: 'chat' | 'analysis' | 'replies'
): string {
  if (layoutMode === 'desktop') return 'min-w-0 min-h-0 overflow-hidden';
  const visible = activePanel === panel;
  return `h-full min-w-0 min-h-0 overflow-hidden ${visible ? '' : 'hidden'}`;
}

export default function App() {
  const init = useAppStore((s) => s.init);
  const activePanel = useAppStore((s) => s.activePanel);
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const layoutMode = useLayoutMode();

  useEffect(() => {
    void init();
  }, [init]);

  const mainClass =
    layoutMode === 'desktop'
      ? 'flex-1 grid grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.25fr)_minmax(340px,1fr)] gap-4 p-4 min-h-0 overflow-hidden'
      : layoutMode === 'tablet'
        ? 'flex-1 min-h-0 overflow-hidden px-3 pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]'
        : 'flex-1 min-h-0 overflow-hidden px-2 sm:px-3 pt-2 sm:pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]';

  return (
    <div className="h-dvh min-h-0 flex flex-col overflow-hidden">
      <Header />

      {error && (
        <div className="mx-3 sm:mx-4 mt-2 px-3 sm:px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between gap-2 animate-fade-in">
          <span className="text-red-300 text-sm leading-snug min-w-0">{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300 text-sm shrink-0 min-h-[44px] px-2"
          >
            关闭
          </button>
        </div>
      )}

      <main className={mainClass}>
        <section className={panelVisibility(layoutMode, activePanel, 'chat')} aria-hidden={layoutMode !== 'desktop' && activePanel !== 'chat'}>
          <ChatPanel />
        </section>
        <section className={panelVisibility(layoutMode, activePanel, 'analysis')} aria-hidden={layoutMode !== 'desktop' && activePanel !== 'analysis'}>
          <AnalysisPanel />
        </section>
        <section className={panelVisibility(layoutMode, activePanel, 'replies')} aria-hidden={layoutMode !== 'desktop' && activePanel !== 'replies'}>
          <ReplyPanel />
        </section>
      </main>

      <MobileNav />
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
      <Toast />
    </div>
  );
}
