import {
  Radar,
  ShieldAlert,
  BarChart3,
  Library,
  Gem,
  ShieldCheck,
  Swords,
  ImagePlus,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { LOVE_MORE_TOOLS } from '../constants/loveNav';
import type { LoveSubTab } from '../types';
import { useAppStore } from '../store/appStore';

const ICONS: Record<string, typeof Radar> = {
  radar: Radar,
  risk: ShieldAlert,
  relation: BarChart3,
  workshop: Library,
  value: Gem,
  guard: ShieldCheck,
  drill: Swords,
  image: ImagePlus,
};

export default function LoveMoreHub() {
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const showToast = useAppStore((s) => s.showToast);

  const open = (id: LoveSubTab, frozen?: boolean) => {
    setLoveSubTab(id);
    if (frozen) {
      showToast('次要工具 · 主路径请用「分析 / 话术」');
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 px-3 py-2.5">
        <p className="text-xs text-rose-100 font-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> 主路径：对象 → 分析 → 话术
        </p>
        <p className="text-[11px] text-soul-400 mt-1 leading-snug">
          下面是可选工具。雷达/风控摘要已在「分析」里；截图导入请用聊天页 OCR。
        </p>
      </div>

      <ul className="space-y-2">
        {LOVE_MORE_TOOLS.map((tool) => {
          const Icon = ICONS[tool.id] ?? Library;
          const frozen = tool.status === 'frozen';
          return (
            <li key={tool.id}>
              <button
                type="button"
                onClick={() => open(tool.id, frozen)}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors min-h-[52px] touch-manipulation ${
                  frozen
                    ? 'border-soul-700/40 bg-soul-950/40 opacity-80'
                    : 'border-soul-600/40 bg-soul-900/50 hover:border-rose-500/30 hover:bg-soul-900/80'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    frozen ? 'bg-soul-800/80 text-soul-400' : 'bg-rose-950/50 text-rose-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-soul-100 font-medium">{tool.label}</span>
                    {frozen && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-soul-800 text-soul-400 border border-soul-600/40">
                        次要
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-soul-500 mt-0.5 leading-snug">
                    {tool.summary}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-soul-500 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
