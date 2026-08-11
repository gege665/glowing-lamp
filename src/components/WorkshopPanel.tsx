import { useState } from 'react';
import {
  Library,
  Loader2,
  Copy,
  Sparkles,
  Wand2,
  Bookmark,
  Send,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  WORKSHOP_CATEGORIES,
  getWorkshopCategory,
  matchWorkshopCategory,
} from '../constants/workshopCategories';
import {
  TONE_MODIFIER_HINTS,
  toggleToneModifier,
} from '../constants/toneModifiers';
import { addSavedReply } from '../services/storageService';

function chipClass(selected: boolean): string {
  return selected
    ? 'bg-violet-600/30 text-violet-100 border-violet-400/50'
    : 'bg-soul-800/50 text-soul-400 border-soul-700/40 hover:border-violet-500/30';
}

/** 灵焰全分类话术工坊 */
export default function WorkshopPanel() {
  const categoryId = useAppStore((s) => s.workshopCategoryId);
  const sceneNote = useAppStore((s) => s.workshopSceneNote);
  const lines = useAppStore((s) => s.workshopLines);
  const source = useAppStore((s) => s.workshopSource);
  const generating = useAppStore((s) => s.isWorkshopGenerating);
  const settings = useAppStore((s) => s.settings);
  const setWorkshopCategory = useAppStore((s) => s.setWorkshopCategory);
  const setWorkshopSceneNote = useAppStore((s) => s.setWorkshopSceneNote);
  const generateWorkshop = useAppStore((s) => s.generateWorkshop);
  const refineWorkshop = useAppStore((s) => s.refineWorkshop);
  const updateWorkshopLine = useAppStore((s) => s.updateWorkshopLine);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const addMessage = useAppStore((s) => s.addMessage);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const showToast = useAppStore((s) => s.showToast);
  const notifySaved = useAppStore((s) => s.notifySavedRepliesChanged);

  const [refineNote, setRefineNote] = useState('');
  const cat = getWorkshopCategory(categoryId);
  const toneModifiers = settings.toneModifiers ?? [];

  const runByScene = () => {
    const text = sceneNote.trim();
    if (text) {
      const matched = matchWorkshopCategory(text);
      setWorkshopCategory(matched);
    }
    void generateWorkshop({ sceneText: text || undefined });
  };

  const copyLine = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制');
    } catch {
      showToast('复制失败');
    }
  };

  const useLine = (text: string) => {
    addMessage('me', text);
    showToast('已加入对话');
    setActivePanel('chat');
  };

  const saveLine = (text: string) => {
    addSavedReply({ content: text, label: cat.label });
    notifySaved();
    showToast('已收藏到话术工坊');
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-violet-500/15 bg-gradient-to-br from-violet-950/30 via-transparent to-rose-950/15">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/30">
            <Library className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-violet-100">全分类话术工坊</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              12 类场景库 · 说出场景即出可发送话术 · 可编辑微调
            </p>
          </div>
          {source && (
            <span className="tag text-[10px] bg-violet-500/20 text-violet-200 border border-violet-500/30 shrink-0">
              {source === 'ai' ? 'AI 精写' : '本地库'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-2">
          {WORKSHOP_CATEGORIES.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                disabled={generating}
                onClick={() => setWorkshopCategory(c.id)}
                className={`rounded-lg border px-1.5 py-2 text-center touch-manipulation transition-all min-h-[44px] ${chipClass(active)}`}
                title={c.desc}
              >
                <span className="block text-[10px] leading-tight">
                  {c.icon} {c.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-violet-200/80 mb-2 px-0.5">
          {cat.icon} {cat.label}：{cat.desc} · {cat.prompt}
        </p>

        <textarea
          value={sceneNote}
          onChange={(e) => setWorkshopSceneNote(e.target.value)}
          placeholder="说出场景，例如：刚通过好友、想约周末咖啡、她生气了要哄…"
          rows={2}
          className="input-field w-full resize-none text-sm min-h-[44px] py-2 mb-2"
        />

        <div className="flex flex-wrap gap-1.5 mb-2">
          {TONE_MODIFIER_HINTS.map((h) => (
            <button
              key={h.id}
              type="button"
              disabled={generating}
              onClick={() =>
                updateSettings({
                  toneModifiers: toggleToneModifier(toneModifiers, h.id),
                })
              }
              className={`tag text-[10px] border cursor-pointer ${chipClass(toneModifiers.includes(h.id))}`}
            >
              {h.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={runByScene}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 生成中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> 生成 5 条话术
              </>
            )}
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => void generateWorkshop({ localOnly: true })}
            className="btn-secondary text-xs min-h-[44px] px-3 shrink-0"
            title="仅用本地优质库"
          >
            本地库
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-touch p-3 space-y-2.5">
        {lines.length === 0 && !generating && (
          <div className="rounded-2xl border border-dashed border-violet-500/25 bg-violet-950/10 px-4 py-6 text-center">
            <p className="text-sm text-violet-100/90 mb-1">选分类或描述场景，点生成</p>
            <p className="text-[11px] text-soul-500 leading-relaxed">
              支持自定义修改每条话术，也可用「微调语气」整批重写。
            </p>
            <ul className="mt-3 text-left text-[10px] text-soul-400 space-y-1 max-w-xs mx-auto">
              {cat.avoid.map((a) => (
                <li key={a}>· 忌：{a}</li>
              ))}
            </ul>
          </div>
        )}

        {lines.map((line, i) => (
          <div
            key={i}
            className="rounded-xl border border-soul-700/40 bg-soul-900/50 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-violet-300/80">
                {cat.shortLabel} · {i + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => void copyLine(line)}
                  className="btn-ghost p-1.5 min-h-0 min-w-0 text-soul-400"
                  title="复制"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => saveLine(line)}
                  className="btn-ghost p-1.5 min-h-0 min-w-0 text-amber-400/80"
                  title="收藏"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => useLine(line)}
                  className="btn-secondary text-[10px] min-h-[28px] px-2"
                >
                  <Send className="w-3 h-3 inline mr-0.5" />
                  用这句
                </button>
              </div>
            </div>
            <textarea
              value={line}
              onChange={(e) => updateWorkshopLine(i, e.target.value)}
              rows={2}
              className="input-field w-full resize-none text-sm min-h-[40px] py-1.5"
            />
          </div>
        ))}

        {lines.length > 0 && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/15 p-2.5 space-y-2">
            <p className="text-[10px] text-violet-300 flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> 整批微调语气
            </p>
            <div className="flex gap-1.5">
              <input
                value={refineNote}
                onChange={(e) => setRefineNote(e.target.value)}
                placeholder="例如：再温柔一点、更短、别太撩…"
                className="input-field flex-1 text-sm min-h-[40px]"
              />
              <button
                type="button"
                disabled={generating || !refineNote.trim()}
                onClick={() => {
                  void refineWorkshop(refineNote.trim());
                  setRefineNote('');
                }}
                className="btn-primary text-xs min-h-[40px] px-3 shrink-0"
              >
                微调
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {['更温柔一点', '更短', '更高冷', '更幽默', '别太油'].map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={generating}
                  onClick={() => void refineWorkshop(q)}
                  className="tag text-[10px] border border-soul-600/40 text-soul-300 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
