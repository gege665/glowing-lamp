import { Heart, Users, Settings, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { LOVE_PERSONAS, type LovePersonaId } from '../constants/lovePersonas';
import type { AppMode } from '../types';
import ProfileCardsSection from './ProfileCardsSection';
import LocalApiKeyCard from './LocalApiKeyCard';

export default function MePanel() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const showToast = useAppStore((s) => s.showToast);

  const setMode = (appMode: AppMode) => {
    updateSettings({ appMode });
    showToast(appMode === 'love' ? '已切换恋爱专属模式' : '已切换通用社交模式');
  };

  const setPersona = (lovePersona: LovePersonaId) => {
    updateSettings({ lovePersona, appMode: 'love' });
    const p = LOVE_PERSONAS.find((x) => x.id === lovePersona);
    showToast(`人设：${p?.label ?? lovePersona}`);
  };

  return (
    <div className="panel-card h-full min-h-0 overflow-hidden flex flex-col">
      <div className="shrink-0 px-3 py-3 border-b border-soul-700/30 bg-gradient-to-r from-amber-950/30 via-transparent to-pink-950/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-soul-100">我的</h2>
            <p className="text-[11px] text-soul-400">API Key · 模式 · 人设 · 资料</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary flex items-center gap-1.5 min-h-[40px] text-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            设置
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-touch p-3 space-y-4">
        <LocalApiKeyCard />

        {/* 双模式 */}
        <section>
          <p className="text-xs text-soul-300 font-medium mb-2">双模式切换</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('social')}
              className={`rounded-2xl border p-3 text-left transition-all touch-manipulation min-h-[88px] ${
                settings.appMode === 'social'
                  ? 'border-sky-400/50 bg-gradient-to-br from-sky-600/25 to-indigo-700/20 ring-1 ring-sky-400/40'
                  : 'border-soul-700/40 bg-soul-900/40'
              }`}
            >
              <Users className="w-5 h-5 text-sky-300 mb-1.5" />
              <p className="text-sm font-semibold text-soul-100">通用社交</p>
              <p className="text-[10px] text-soul-400 mt-0.5 leading-snug">朋友 / 职场 · 泛场景话术</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('love')}
              className={`rounded-2xl border p-3 text-left transition-all touch-manipulation min-h-[88px] ${
                settings.appMode === 'love'
                  ? 'border-rose-400/50 bg-gradient-to-br from-rose-600/30 to-amber-600/20 ring-1 ring-rose-400/40'
                  : 'border-soul-700/40 bg-soul-900/40'
              }`}
            >
              <Heart className="w-5 h-5 text-rose-300 mb-1.5" />
              <p className="text-sm font-semibold text-soul-100">恋爱专属</p>
              <p className="text-[10px] text-soul-400 mt-0.5 leading-snug">9 种人设 · 对标灵焰</p>
            </button>
          </div>
        </section>

        {/* 9 人设 */}
        <section className={settings.appMode === 'social' ? 'opacity-50' : ''}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-soul-300 font-medium">恋爱人设 · 9 种</p>
            {settings.appMode === 'social' && (
              <span className="text-[10px] text-soul-500">切换恋爱模式后生效</span>
            )}
          </div>
          <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2">
            {LOVE_PERSONAS.map((p) => {
              const selected = settings.lovePersona === p.id && settings.appMode === 'love';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersona(p.id)}
                  className={`rounded-xl border p-2.5 text-center touch-manipulation transition-all min-h-[76px] ${
                    selected
                      ? 'border-pink-400/60 bg-pink-600/20 shadow-md shadow-pink-900/20'
                      : 'border-soul-700/35 bg-soul-900/35 hover:border-pink-500/30'
                  }`}
                >
                  <span className="text-base leading-none block mb-1">{p.emoji}</span>
                  <span className="text-[12px] font-medium text-soul-100 block">{p.shortLabel}</span>
                  <span className="text-[9px] text-soul-500 leading-tight block mt-0.5 line-clamp-1">
                    {p.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-xs text-soul-300 font-medium mb-2">双资料卡定制 · 一对一</p>
          <ProfileCardsSection
            myProfile={settings.myProfile}
            otherProfile={settings.otherProfile}
            partnerMemory={settings.partnerMemory}
            compact
            onChange={(patch) => {
              updateSettings({
                ...(patch.myProfile ? { myProfile: { ...settings.myProfile, ...patch.myProfile } } : {}),
                ...(patch.otherProfile
                  ? { otherProfile: { ...settings.otherProfile, ...patch.otherProfile } }
                  : {}),
                ...(patch.partnerMemory
                  ? {
                      partnerMemory: {
                        ...settings.partnerMemory,
                        ...patch.partnerMemory,
                        updatedAt: Date.now(),
                      },
                    }
                  : {}),
              });
            }}
          />
        </section>
      </div>
    </div>
  );
}
