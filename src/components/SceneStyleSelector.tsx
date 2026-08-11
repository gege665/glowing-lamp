import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Loader2, SlidersHorizontal } from 'lucide-react';
import {
  CHAT_SCENES,
  QUICK_STYLE_HINTS,
  OPENING_PROMPTS,
  getCoreStyleMeta,
  type ChatSceneId,
  type CoreStyleId,
} from '../constants/coreReplyStyles';
import {
  TONE_MODIFIER_HINTS,
  toggleToneModifier,
  type ToneModifierId,
} from '../constants/toneModifiers';
import { useAppStore } from '../store/appStore';
import SceneCards from './SceneCards';
import LingyanStyleSwitcher from './LingyanStyleSwitcher';
import { getSceneCardsForMode } from '../constants/loveScenes';

interface SceneStyleSelectorProps {
  chatScene: string;
  tonePreference: string;
  toneModifiers: ToneModifierId[];
  primaryReplyStyle: CoreStyleId | '';
  onSceneChange: (sceneId: ChatSceneId | '') => void;
  onToneChange: (prompt: string) => void;
  onToneModifiersChange: (modifiers: ToneModifierId[]) => void;
  onPrimaryStyleChange: (id: CoreStyleId | '') => void;
  onGenerate?: () => void;
  generating?: boolean;
  disabled?: boolean;
  /** 隐藏底部生成按钮（由外层统一 CTA） */
  hideGenerateButton?: boolean;
  /** 移动端紧凑模式：减少内边距与标签高度 */
  compact?: boolean;
  /** 仅场景 / 仅风格 / 全部（默认） */
  section?: 'scenes' | 'styles' | 'all';
}

function chipClass(selected: boolean): string {
  return selected
    ? 'bg-pink-600/25 text-pink-200 border-pink-500/50'
    : 'bg-soul-800/50 text-soul-400 border-soul-700/40 hover:border-soul-600/50';
}

function ModuleFold({
  title,
  summary,
  open,
  onToggle,
  disabled,
  compact,
  children,
  accent = 'rose',
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  compact?: boolean;
  children: ReactNode;
  accent?: 'rose' | 'amber';
}) {
  const iconColor = accent === 'amber' ? 'text-amber-400' : 'text-rose-400';
  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 text-left touch-manipulation ${
          compact ? 'min-h-[32px] py-0.5' : 'min-h-[36px] py-1'
        }`}
      >
        <span
          className={`flex items-center gap-1.5 min-w-0 ${
            compact ? 'text-[10px] text-soul-300' : 'text-[11px] text-soul-300'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
          <span className="truncate font-medium">
            {title}
            {summary ? (
              <span className="font-normal text-pink-300/85"> · {summary}</span>
            ) : null}
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-soul-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-soul-500 shrink-0" />
        )}
      </button>
      {open && <div className={`${compact ? 'mt-1 space-y-1.5' : 'mt-1.5 space-y-2'} animate-fade-in`}>{children}</div>}
    </div>
  );
}

export default function SceneStyleSelector({
  chatScene,
  tonePreference,
  toneModifiers,
  primaryReplyStyle,
  onSceneChange,
  onToneChange,
  onToneModifiersChange,
  onPrimaryStyleChange,
  onGenerate,
  generating = false,
  disabled = false,
  hideGenerateButton = false,
  compact = false,
  section = 'all',
}: SceneStyleSelectorProps) {
  const appMode = useAppStore((s) => s.settings.appMode);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** 默认折叠，避免挤掉底部输入框；需要时再点开 */
  const [sceneOpen, setSceneOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);

  const cards = getSceneCardsForMode(appMode);
  const activeCard = cards.find((c) => c.id === chatScene);
  const activeScene = CHAT_SCENES.find((s) => s.id === chatScene);
  const activeStyleLabel = primaryReplyStyle
    ? getCoreStyleMeta(primaryReplyStyle).shortLabel
    : '';
  const toneOn = TONE_MODIFIER_HINTS.filter((h) => toneModifiers.includes(h.id)).length;

  const showScenes = section === 'all' || section === 'scenes';
  const showStyles = section === 'all' || section === 'styles';

  const sceneBody = (
    <>
      <SceneCards
        mode={appMode}
        value={chatScene}
        onChange={onSceneChange}
        disabled={disabled}
        compact={compact}
        showHeader={false}
      />
      {activeScene && !compact && (
        <p className="text-[10px] text-pink-300/80 leading-snug line-clamp-2 px-0.5">
          {(activeCard?.title ?? activeScene.label)}：{activeScene.prompt}
        </p>
      )}
    </>
  );

  const styleBody = (
    <>
      <LingyanStyleSwitcher
        value={primaryReplyStyle}
        onChange={onPrimaryStyleChange}
        disabled={disabled}
        compact={compact}
        showHeader={false}
      />

      {/* 语气微调：标签切换（逻辑仍为可多选叠加） */}
      <div className="space-y-1">
        <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-soul-500 px-0.5`}>
          语气
        </span>
        <div
          className={`flex rounded-lg border border-soul-700/35 bg-soul-950/40 p-0.5 ${
            compact ? 'gap-0.5' : 'gap-1'
          }`}
          role="group"
          aria-label="语气微调"
        >
          {TONE_MODIFIER_HINTS.map((hint) => {
            const selected = toneModifiers.includes(hint.id);
            return (
              <button
                key={hint.id}
                type="button"
                disabled={disabled}
                onClick={() => onToneModifiersChange(toggleToneModifier(toneModifiers, hint.id))}
                className={`flex-1 text-center rounded-md border transition-all touch-manipulation ${
                  compact ? 'text-[10px] min-h-[28px] px-1' : 'text-[11px] min-h-[32px] px-1.5'
                } ${
                  selected
                    ? 'bg-amber-500/20 text-amber-100 border-amber-500/45'
                    : 'text-soul-400 border-transparent hover:text-soul-200'
                }`}
              >
                {hint.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen(!advancedOpen)}
        className={`text-[10px] text-soul-400 hover:text-soul-200 flex items-center gap-0.5 touch-manipulation ${
          compact ? 'min-h-[28px] px-1' : 'min-h-[28px]'
        }`}
      >
        <SlidersHorizontal className="w-3 h-3" />
        {advancedOpen ? '收起' : '更多选项'}
        {advancedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {advancedOpen && (
        <div className="pt-1.5 border-t border-soul-700/20 space-y-2 animate-fade-in">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-soul-500 w-full">快捷语气微调</span>
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
        <div className="pt-2 border-t border-soul-700/20">
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
    </>
  );

  return (
    <div
      className={`px-3 border-b border-rose-500/10 shrink-0 ${
        compact ? 'py-1.5 space-y-1' : 'py-2 space-y-1.5'
      } ${section === 'scenes' ? 'bg-rose-950/15' : section === 'styles' ? 'bg-amber-950/10' : 'bg-gradient-to-b from-rose-950/15 to-transparent'}`}
    >
      {showScenes && (
        <ModuleFold
          title={appMode === 'love' ? '恋爱场景' : '社交场景'}
          summary={activeCard?.title}
          open={sceneOpen}
          onToggle={() => setSceneOpen((o) => !o)}
          disabled={disabled}
          compact={compact}
          accent="rose"
        >
          {sceneBody}
        </ModuleFold>
      )}

      {showStyles && (
        <ModuleFold
          title="多风格话术"
          summary={
            activeStyleLabel
              ? toneOn
                ? `${activeStyleLabel} · ${toneOn} 项语气`
                : activeStyleLabel
              : toneOn
                ? `${toneOn} 项语气`
                : undefined
          }
          open={styleOpen}
          onToggle={() => setStyleOpen((o) => !o)}
          disabled={disabled}
          compact={compact}
          accent="amber"
        >
          {styleBody}
        </ModuleFold>
      )}
    </div>
  );
}
