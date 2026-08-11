import { useEffect, useMemo, useState } from 'react';
import type { ChatSceneId } from '../constants/coreReplyStyles';
import {
  getSceneCardsForMode,
  getSceneStagesForMode,
  resolveStageForScene,
  type SceneStageId,
} from '../constants/loveScenes';
import type { AppMode } from '../types';

interface SceneCardsProps {
  mode: AppMode;
  value: string;
  onChange: (sceneId: ChatSceneId | '') => void;
  disabled?: boolean;
  compact?: boolean;
  /** 是否展示标题行（外层已有折叠头时可关） */
  showHeader?: boolean;
}

export default function SceneCards({
  mode,
  value,
  onChange,
  disabled = false,
  compact = false,
  showHeader = true,
}: SceneCardsProps) {
  const cards = getSceneCardsForMode(mode);
  const stages = getSceneStagesForMode(mode);
  const [stage, setStage] = useState<SceneStageId>(() => resolveStageForScene(mode, value));

  useEffect(() => {
    if (value) setStage(resolveStageForScene(mode, value));
  }, [value, mode]);

  const visibleCards = useMemo(() => {
    const group = stages.find((s) => s.id === stage) ?? stages[0];
    const idSet = new Set(group.sceneIds);
    return cards.filter((c) => idSet.has(c.id));
  }, [cards, stages, stage]);

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {showHeader && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-soul-300 font-medium`}>
            {mode === 'love' ? '恋爱场景' : '社交场景'}
          </p>
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('')}
              className={`text-soul-500 hover:text-soul-300 touch-manipulation ${
                compact ? 'text-[10px] min-h-[28px] px-1.5' : 'text-[11px] min-h-[32px] px-2'
              }`}
            >
              清除
            </button>
          )}
        </div>
      )}

      <div
        className={`flex rounded-lg border border-soul-700/35 bg-soul-950/40 p-0.5 ${
          compact ? 'gap-0.5' : 'gap-1'
        }`}
        role="tablist"
        aria-label="场景阶段"
      >
        {stages.map((s) => {
          const active = stage === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => setStage(s.id)}
              className={`flex-1 text-center rounded-md transition-all touch-manipulation ${
                compact ? 'text-[10px] min-h-[28px] py-0.5' : 'text-[11px] min-h-[32px] py-1'
              } ${
                active
                  ? 'bg-rose-600/30 text-rose-100 border border-rose-500/40'
                  : 'text-soul-400 border border-transparent hover:text-soul-200'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div
        className={`grid ${
          compact
            ? `gap-1 ${visibleCards.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`
            : `gap-2 ${visibleCards.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`
        }`}
      >
        {visibleCards.map((card) => {
          const selected = value === card.id;
          return (
            <button
              key={card.id}
              type="button"
              disabled={disabled}
              title={`${card.title} · ${card.subtitle}`}
              onClick={() => onChange(selected ? '' : card.id)}
              className={`text-left transition-all touch-manipulation ${
                compact
                  ? `rounded-lg border px-1.5 py-1.5 min-h-[44px] bg-gradient-to-br ${card.accent} ${
                      selected
                        ? 'ring-1 ring-pink-400/70 border-pink-400/50'
                        : 'border-white/5'
                    }`
                  : `scene-card bg-gradient-to-br ${card.accent} ${
                      selected
                        ? 'ring-2 ring-pink-400/70 border-pink-400/50 shadow-lg shadow-pink-900/20'
                        : 'border-white/5 hover:border-pink-500/30'
                    }`
              }`}
            >
              <span
                className={`leading-none block ${compact ? 'text-sm mb-0.5' : 'text-base mb-1'}`}
                aria-hidden
              >
                {card.icon}
              </span>
              <span
                className={`font-semibold text-soul-100 block leading-tight ${
                  compact ? 'text-[10px] truncate' : 'text-[12px]'
                }`}
              >
                {card.title}
              </span>
              {!compact && (
                <span className="text-[10px] text-soul-400 mt-0.5 block leading-snug line-clamp-1">
                  {card.subtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
