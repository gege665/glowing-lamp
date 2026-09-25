import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Loader2, SlidersHorizontal } from 'lucide-react';
import {
  CHAT_SCENES,
  QUICK_STYLE_HINTS,
  OPENING_PROMPTS,
  CORE_STYLE_META,
  type ChatSceneId,
} from '../constants/coreReplyStyles';
import {
  TONE_MODIFIER_HINTS,
  toggleToneModifier,
  type ToneModifierId,
} from '../constants/toneModifiers';

/** 默认展示的高频场景 */
const PRIMARY_SCENE_IDS: ChatSceneId[] = ['first_add', 'cold_chat', 'perfunctory', 'angry'];

interface SceneStyleSelectorProps {
  chatScene: string;
  tonePreference: string;
  toneModifiers: ToneModifierId[];
  onSceneChange: (sceneId: ChatSceneId | '') => void;
  onToneChange: (prompt: string) => void;
  onToneModifiersChange: (modifiers: ToneModifierId[]) => void;
  onGenerate?: () => void;
  generating?: boolean;
  disabled?: boolean;
  /** 隐藏底部生成按钮（由外层统一 CTA） */
  hideGenerateButton?: boolean;
  /** 移动端紧凑模式：减少内边距与标签高度 */
  compact?: boolean;
}

function chipClass(selected: boolean): string {
  return selected
    ? 'bg-pink-600/25 text-pink-200 border-pink-500/50'
    : 'bg-soul-800/50 text-soul-400 border-soul-700/40 hover:border-soul-600/50';
}

export default function SceneStyleSelector({
  chatScene,
  tonePreference,
  toneModifiers,
  onSceneChange,
  onToneChange,
  onToneModifiersChange,
  onGenerate,
  generating = false,
  disabled = false,
  hideGenerateButton = false,
  compact = false,
}: SceneStyleSelectorProps) {
  const [showAllScenes, setShowAllScenes] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeScene = CHAT_SCENES.find((s) => s.id === chatScene);

  const visibleScenes = showAllScenes
    ? CHAT_SCENES
    : CHAT_SCENES.filter(
        (s) => PRIMARY_SCENE_IDS.includes(s.id) || s.id === chatScene
      );

  const hasHiddenSelection =
    Boolean(chatScene) && !PRIMARY_SCENE_IDS.includes(chatScene as ChatSceneId);

  return (
    <div
      className={`px-3 border-b border-soul-700/20 bg-soul-950/40 shrink-0 ${
        compact ? 'py-1.5' : 'py-2'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`${compact ? 'text-xs' : 'text-[11px]'} text-soul-300 flex items-center gap-1`}>
          <Sparkles className={`${compact ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-pink-400`} />
          场景与语气
          <span className="text-soul-500">· 可选</span>
        </span>
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className={`${compact ? 'text-xs min-h-[36px] px-2' : 'text-[10px]'} text-soul-400 hover:text-soul-200 flex items-center gap-0.5 touch-manipulation`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          {advancedOpen ? '收起' : '更多选项'}
          {advancedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {visibleScenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            disabled={disabled}
            onClick={() => onSceneChange(chatScene === scene.id ? '' : scene.id)}
            title={scene.openingHint ?? scene.prompt}
            className={`${compact ? 'composer-tag border' : 'tag-touch text-[11px]'} cursor-pointer transition-all ${chipClass(chatScene === scene.id)}`}
          >
            {scene.label}
          </button>
        ))}
        {!showAllScenes && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowAllScenes(true)}
            className={`${compact ? 'composer-tag border border-dashed border-soul-600/50 text-soul-400' : 'tag-touch text-[11px] border border-dashed border-soul-600/50 text-soul-500 hover:text-soul-300'} cursor-pointer`}
          >
            {hasHiddenSelection ? '更多场景…' : '+ 更多'}
          </button>
        )}
      </div>

      {activeScene && (
        <p className="text-[10px] text-pink-300/80 mb-1.5 leading-snug line-clamp-2">
          {activeScene.label}：{activeScene.prompt}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {TONE_MODIFIER_HINTS.map((hint) => (
          <button
            key={hint.id}
            type="button"
            disabled={disabled}
            onClick={() => onToneModifiersChange(toggleToneModifier(toneModifiers, hint.id))}
            className={`${compact ? 'composer-tag border' : 'tag-touch text-[11px]'} cursor-pointer transition-all ${chipClass(toneModifiers.includes(hint.id))}`}
          >
            {hint.label}
          </button>
        ))}
      </div>

      {advancedOpen && (
        <div className="mt-2 pt-2 border-t border-soul-700/20 space-y-2 animate-fade-in">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-soul-500 w-full">快捷语气</span>
            {QUICK_STYLE_HINTS.map((hint) => (
              <button
                key={hint.id}
                type="button"
                disabled={disabled}
                onClick={() => onToneChange(tonePreference === hint.prompt ? '' : hint.prompt)}
                className={`tag text-[10px] border cursor-pointer ${chipClass(tonePreference === hint.prompt)}`}
              >
                {hint.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {CORE_STYLE_META.map((m) => (
              <div key={m.id} className="text-[10px] leading-snug">
                <span className="text-soul-300 font-medium">{m.label}</span>
                <span className="text-soul-500"> · {m.usage}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[10px] text-soul-500 w-full">万能开场</span>
            {OPENING_PROMPTS.map((op) => (
              <button
                key={op.label}
                type="button"
                disabled={disabled}
                onClick={() => onToneChange(op.prompt)}
                className={`tag text-[10px] border cursor-pointer ${chipClass(tonePreference === op.prompt)}`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {onGenerate && !hideGenerateButton && (
        <div className="mt-2 pt-2 border-t border-soul-700/20">
          <button
            type="button"
            disabled={disabled || generating}
            onClick={onGenerate}
            className="btn-primary w-full flex items-center justify-center gap-2 min-h-[44px] text-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                智能生成话术
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
