import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import AnalysisPanel from './components/AnalysisPanel';
import ReplyPanel from './components/ReplyPanel';
import LovePanel from './components/LovePanel';
import MePanel from './components/MePanel';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import MobileNav from './components/MobileNav';
import IceBreakerModal from './components/IceBreakerModal';
import FloatingIME from './components/FloatingIME';

export default function App() {
  const init = useAppStore((s) => s.init);
  const activePanel = useAppStore((s) => s.activePanel);
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);
  const iceBreakerOpen = useAppStore((s) => s.iceBreakerOpen);
  const setIceBreakerOpen = useAppStore((s) => s.setIceBreakerOpen);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const showLove =
    activePanel === 'love' || activePanel === 'analysis' || activePanel === 'replies';
  const showMe = activePanel === 'me';
  const showChat = activePanel === 'chat';

  // 净语护栏默认全程生效，不再强制跳转净语说明页（打断主路径）
  useEffect(() => {
    init();
    try {
      if (sessionStorage.getItem('lingyan_speech_guard_on') !== '1') {
        sessionStorage.setItem('lingyan_speech_guard_on', '1');
        useAppStore.getState().showToast('净语护栏已默认开启 · 可在恋爱→更多查看说明');
      }
    } catch {
      /* ignore */
    }
  }, [init]);

  // 软键盘抬起时抬高悬浮层（手机/平板）
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, []);

  return (
    <div className="h-dvh min-h-0 flex flex-col overflow-hidden app-shell">
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

      <div className="flex-1 min-h-0 relative">
        {/* 桌面 ≥1024px：三栏聊天工作台 */}
        <main className="absolute inset-0 hidden lg:grid lg:grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
          <section className="col-span-4 min-h-0 overflow-hidden">
            <ChatPanel />
          </section>
          <section className="col-span-4 min-h-0 overflow-hidden">
            <AnalysisPanel />
          </section>
          <section className="col-span-4 min-h-0 overflow-hidden">
            <ReplyPanel />
          </section>
        </main>

        {/* 桌面：恋爱 / 我的 全屏浮层（悬浮栏快捷入口可用） */}
        {(showLove || showMe) && (
          <div className="hidden lg:flex absolute inset-0 z-20 p-4 bg-soul-950/70 backdrop-blur-sm">
            <div className="w-full max-w-3xl xl:max-w-4xl mx-auto h-full min-h-0 flex flex-col">
              <div className="shrink-0 flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setActivePanel('chat')}
                  className="btn-secondary text-xs min-h-[40px] px-3"
                >
                  返回工作台
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden rounded-2xl">
                {showLove && <LovePanel />}
                {showMe && <MePanel />}
              </div>
            </div>
          </div>
        )}

        {/* 手机 + 平板 &lt;1024：底栏切换 聊天 / 恋爱 / 我的 */}
        <main className="absolute inset-0 lg:hidden min-h-0 overflow-hidden px-1.5 sm:px-3 pt-1.5 sm:pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
          <div className="h-full min-h-0 flex flex-col">
            {showChat && (
              <>
                {/* 手机：单栏聊天，占满可用高度 */}
                <div className="h-full min-h-0 md:hidden flex flex-col">
                  <ChatPanel />
                </div>
                {/* 平板：左聊天 + 右分析/话术 */}
                <div className="h-full hidden md:grid grid-cols-12 gap-3 min-h-0">
                  <section className="col-span-5 min-h-0 overflow-hidden">
                    <ChatPanel />
                  </section>
                  <section className="col-span-7 min-h-0 flex flex-col gap-3 overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <AnalysisPanel />
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ReplyPanel />
                    </div>
                  </section>
                </div>
              </>
            )}
            {showLove && <LovePanel />}
            {showMe && <MePanel />}
          </div>
        </main>
      </div>

      <FloatingIME />
      <MobileNav />
      <SettingsModal />
      <IceBreakerModal open={iceBreakerOpen} onClose={() => setIceBreakerOpen(false)} />
      <Toast />
    </div>
  );
}
