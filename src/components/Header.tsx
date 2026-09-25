import { Sparkles, Settings, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { REPLY_STYLE_HEADER_TAGLINE } from '../constants/replyStylePrompts';
import { ModelRoutingControl } from './ModelStrategySettings';
import ChatStyleSelector from './ChatStyleSelector';

export default function Header() {
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetAll = useAppStore((s) => s.resetAll);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const isAdvanced = settings.uiMode === 'advanced';

  return (
    <header className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 border-b border-soul-700/30 bg-soul-900/40 backdrop-blur-xl safe-top">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between max-w-[1920px] mx-auto lg:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-soul-500 to-pink-500 flex items-center justify-center shadow-lg shadow-soul-500/20 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-soul-300 to-pink-300 bg-clip-text text-transparent truncate">
              Soul 聊天心理助手
            </h1>
            <p className="text-[10px] sm:text-xs text-soul-400 truncate max-w-[280px] sm:max-w-none">
              <span className="sm:hidden">AI 分析 · 高情商话术</span>
              <span className="hidden sm:inline">{REPLY_STYLE_HEADER_TAGLINE}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          <button
            type="button"
            onClick={() =>
              updateSettings({ uiMode: isAdvanced ? 'simple' : 'advanced' })
            }
            className="btn-ghost text-[11px] sm:text-xs text-soul-400 hover:text-soul-200 min-h-[44px] px-2 shrink-0"
            title={isAdvanced ? '切换为简单模式，隐藏模型策略' : '切换为高级模式，显示模型策略'}
          >
            {isAdvanced ? '高级' : '简单'}
          </button>

          {isAdvanced && (
            <>
              <ChatStyleSelector
                value={settings.chatStyle}
                onChange={(chatStyle) => updateSettings({ chatStyle })}
                disabled={isAnalyzing}
                compact
              />

              <ModelRoutingControl
                settings={settings}
                onChange={updateSettings}
                disabled={isAnalyzing}
              />
            </>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary flex items-center gap-1.5 min-h-[44px] shrink-0"
            title="设置"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{settings.apiKey ? '已配置' : '设置'}</span>
          </button>

          <button
            onClick={() => {
              if (confirm('确定清空所有数据？此操作不可恢复。')) resetAll();
            }}
            className="btn-ghost text-soul-400 hover:text-red-400 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            title="清空数据"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
