import { Sparkles, Settings, Trash2, Heart } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { REPLY_STYLE_HEADER_TAGLINE } from '../constants/replyStylePrompts';
import { ModelRoutingControl } from './ModelStrategySettings';
import ChatStyleSelector from './ChatStyleSelector';
import { getLovePersona } from '../constants/lovePersonas';
import PartnerSwitcher from './PartnerSwitcher';

export default function Header() {
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetAll = useAppStore((s) => s.resetAll);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const persona = getLovePersona(settings.lovePersona);

  return (
    <header className="shrink-0 px-2.5 sm:px-4 py-1.5 sm:py-2.5 md:py-3 border-b border-rose-500/15 bg-gradient-to-r from-soul-900/50 via-rose-950/30 to-amber-950/20 backdrop-blur-xl safe-top">
      <div className="flex items-center justify-between gap-2 max-w-[1920px] mx-auto">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-rose-200 via-pink-200 to-amber-200 bg-clip-text text-transparent truncate">
              灵焰恋爱大师
            </h1>
            <p className="text-[10px] sm:text-xs text-soul-400 truncate">
              <span className="sm:hidden">粘贴 → 生成 → 复制发送</span>
              <span className="hidden sm:inline">{REPLY_STYLE_HEADER_TAGLINE}</span>
            </p>
          </div>
        </div>

        {/* 手机：对象切换 + 设置；次要入口下沉到「我的」 */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="max-w-[7.5rem] sm:max-w-none">
            <PartnerSwitcher compact />
          </div>

          <button
            type="button"
            onClick={() => {
              updateSettings({ appMode: settings.appMode === 'love' ? 'social' : 'love' });
            }}
            className={`hidden sm:flex btn-secondary items-center gap-1 min-h-[40px] sm:min-h-[44px] shrink-0 text-xs px-2.5 ${
              settings.appMode === 'love'
                ? 'border-rose-400/40 text-rose-200 bg-rose-600/15'
                : 'border-sky-500/30 text-sky-200'
            }`}
            title="切换社交 / 恋爱模式"
          >
            <Heart className="w-3.5 h-3.5" />
            {settings.appMode === 'love' ? '恋爱' : '社交'}
          </button>

          {settings.appMode === 'love' ? (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setActivePanel('me');
                } else {
                  setSettingsOpen(true);
                }
              }}
              className="hidden sm:inline-flex btn-secondary min-h-[40px] sm:min-h-[44px] shrink-0 text-xs max-w-[7.5rem] truncate px-2"
              title="选择恋爱人设"
            >
              {persona.emoji} {persona.shortLabel}
            </button>
          ) : (
            <div className="hidden sm:block">
              <ChatStyleSelector
                value={settings.chatStyle}
                onChange={(chatStyle) => updateSettings({ chatStyle })}
                disabled={isAnalyzing}
                compact
              />
            </div>
          )}

          <div className="hidden md:block">
            <ModelRoutingControl
              settings={settings}
              onChange={updateSettings}
              disabled={isAnalyzing}
            />
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary flex items-center gap-1.5 min-h-[40px] min-w-[40px] justify-center shrink-0 px-2"
            title="设置"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{settings.apiKey ? '已配置' : '设置'}</span>
          </button>

          <button
            onClick={() => {
              if (confirm('确定清空所有数据？此操作不可恢复。')) resetAll();
            }}
            className="hidden sm:flex btn-ghost text-soul-400 hover:text-red-400 min-h-[40px] min-w-[40px] items-center justify-center shrink-0"
            title="清空数据"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
