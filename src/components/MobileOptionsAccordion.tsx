import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Brain, ChevronDown, ChevronUp, Sparkles, Layers } from 'lucide-react';
import {
  getCoreStyleMeta,
  type ChatSceneId,
  type CoreStyleId,
} from '../constants/coreReplyStyles';
import {
  TONE_MODIFIER_HINTS,
  toggleToneModifier,
  type ToneModifierId,
} from '../constants/toneModifiers';
import { getSceneCardsForMode } from '../constants/loveScenes';
import { useAppStore } from '../store/appStore';
import { parseMemoryLines } from '../utils/chatMemory';
import SceneCards from './SceneCards';
import LingyanStyleSwitcher from './LingyanStyleSwitcher';

type OpenKey = 'scene' | 'memory' | 'style' | null;

interface MobileOptionsAccordionProps {
  chatScene: string;
  toneModifiers: ToneModifierId[];
  primaryReplyStyle: CoreStyleId | '';
  memoryDetails: string;
  hasMessages: boolean;
  disabled?: boolean;
  onSceneChange: (sceneId: ChatSceneId | '') => void;
  onToneModifiersChange: (modifiers: ToneModifierId[]) => void;
  onPrimaryStyleChange: (id: CoreStyleId | '') => void;
  onMemoryChange: (details: string) => void;
}

function Row({
  icon,
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 min-h-[36px] px-2.5 py-1 text-left touch-manipulation"
      >
        <span className="shrink-0">{icon}</span>
        <span className="text-[12px] font-medium text-soul-200 shrink-0">{title}</span>
        <span className="flex-1 text-[11px] text-soul-500 truncate min-w-0">
          {badge || ''}
        </span>
        <span className="shrink-0 text-soul-500">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && <div className="px-3 pb-2.5 animate-fade-in">{children}</div>}
    </div>
  );
}

/** 手机端：场景 / 记忆 / 风格 手风琴，同时只开一项，默认全收起把空间留给对话 */
export default function MobileOptionsAccordion({
  chatScene,
  toneModifiers,
  primaryReplyStyle,
  memoryDetails,
  hasMessages,
  disabled = false,
  onSceneChange,
  onToneModifiersChange,
  onPrimaryStyleChange,
  onMemoryChange,
}: MobileOptionsAccordionProps) {
  const appMode = useAppStore((s) => s.settings.appMode);
  const cards = getSceneCardsForMode(appMode);
  const activeCard = cards.find((c) => c.id === chatScene);
  const memoryCount = parseMemoryLines(memoryDetails).length;
  const styleMeta = primaryReplyStyle ? getCoreStyleMeta(primaryReplyStyle) : null;
  const toneCount = TONE_MODIFIER_HINTS.filter((h) => toneModifiers.includes(h.id)).length;

  // 默认全收起，把视口留给对话与输入
  const [open, setOpen] = useState<OpenKey>(null);
  const hadMessages = useRef(hasMessages);

  useEffect(() => {
    if (!hadMessages.current && hasMessages) setOpen(null);
    hadMessages.current = hasMessages;
  }, [hasMessages]);

  const toggle = (key: OpenKey) => {
    if (disabled) return;
    setOpen((cur) => (cur === key ? null : key));
  };

  return (
    <div
      className={`md:hidden shrink-0 overflow-y-auto scroll-touch border-t border-rose-500/15 bg-soul-950/95 ${
        open ? 'max-h-[min(28vh,200px)]' : 'max-h-[7.5rem]'
      }`}
    >
      <Row
        icon={<Layers className="w-3.5 h-3.5 text-rose-400" />}
        title="场景"
        badge={activeCard?.title}
        open={open === 'scene'}
        onToggle={() => toggle('scene')}
      >
        <SceneCards
          mode={appMode}
          value={chatScene}
          onChange={onSceneChange}
          disabled={disabled}
          compact
          showHeader={false}
        />
      </Row>

      <Row
        icon={<Brain className="w-3.5 h-3.5 text-violet-400" />}
        title="记忆"
        badge={memoryCount > 0 ? `${memoryCount} 条` : '未记录'}
        open={open === 'memory'}
        onToggle={() => toggle('memory')}
      >
        <textarea
          value={memoryDetails}
          disabled={disabled}
          onChange={(e) => onMemoryChange(e.target.value)}
          placeholder={'不爱吃香菜\n下周要考试…'}
          rows={2}
          className="input-field w-full resize-none text-xs py-2"
        />
      </Row>

      <Row
        icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
        title="风格"
        badge={
          styleMeta
            ? `${styleMeta.shortLabel}${toneCount ? ` · ${toneCount} 项语气` : ''}`
            : toneCount
              ? `${toneCount} 项语气`
              : '混排'
        }
        open={open === 'style'}
        onToggle={() => toggle('style')}
      >
        <div className="space-y-2">
          <LingyanStyleSwitcher
            value={primaryReplyStyle}
            onChange={onPrimaryStyleChange}
            disabled={disabled}
            compact
            showHeader={false}
          />
          <div
            className="flex rounded-lg border border-soul-700/35 bg-soul-950/50 p-0.5 gap-0.5"
            role="group"
            aria-label="语气"
          >
            {TONE_MODIFIER_HINTS.map((hint) => {
              const selected = toneModifiers.includes(hint.id);
              return (
                <button
                  key={hint.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToneModifiersChange(toggleToneModifier(toneModifiers, hint.id))}
                  className={`flex-1 text-center rounded-md border text-[10px] min-h-[30px] transition-all touch-manipulation ${
                    selected
                      ? 'bg-amber-500/20 text-amber-100 border-amber-500/45'
                      : 'text-soul-400 border-transparent'
                  }`}
                >
                  {hint.label}
                </button>
              );
            })}
          </div>
        </div>
      </Row>
    </div>
  );
}
