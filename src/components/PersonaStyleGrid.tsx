import { PERSONA_STYLE_GRID, type PersonaStyleId } from '../constants/strategyCoach';
import { useAppStore } from '../store/appStore';

/** 竞品式人设九宫格：写入语气偏好并触发生成 */
export default function PersonaStyleGrid({ disabled = false }: { disabled?: boolean }) {
  const updateSettings = useAppStore((s) => s.updateSettings);
  const runGenerateReplies = useAppStore((s) => s.runGenerateReplies);
  const showToast = useAppStore((s) => s.showToast);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  const handlePick = (id: PersonaStyleId) => {
    const persona = PERSONA_STYLE_GRID.find((p) => p.id === id);
    if (!persona) return;
    updateSettings({ tonePreference: `【人设·${persona.label}】${persona.hint}` });
    showToast(`已选「${persona.label}」，正在生成…`);
    setActivePanel('replies');
    void runGenerateReplies();
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-soul-500 px-0.5">
        先粘贴/导入对方的话，再点风格帮你回
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {PERSONA_STYLE_GRID.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled || isAnalyzing}
            onClick={() => handlePick(p.id)}
            className="min-h-[44px] px-1.5 py-2 rounded-lg text-[11px] sm:text-xs text-soul-200 bg-soul-800/60 border border-soul-700/40 hover:border-orange-500/40 hover:bg-orange-950/30 disabled:opacity-50 touch-manipulation"
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
