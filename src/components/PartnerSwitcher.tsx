import { useState } from 'react';
import { Users, Plus, Trash2, Check, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { PARTNER_TAG_PRESETS } from '../utils/partnerKeywords';

/** 优先展示女1/女2/女3 等联系人标签 */
function primaryContactTag(tags: string[] | undefined): string | null {
  if (!tags?.length) return null;
  const preset = PARTNER_TAG_PRESETS.find((t) => tags.includes(t));
  return preset ?? tags[0] ?? null;
}

/** 聊天对象切换器 · 长效记忆人物隔离 · 显示女N 标签 */
export default function PartnerSwitcher({ compact = false }: { compact?: boolean }) {
  const summaries = useAppStore((s) => s.partnerSummaries);
  const activePartnerId = useAppStore((s) => s.activePartnerId);
  const switchChatPartner = useAppStore((s) => s.switchChatPartner);
  const createChatPartner = useAppStore((s) => s.createChatPartner);
  const removeChatPartner = useAppStore((s) => s.removeChatPartner);
  const renameChatPartner = useAppStore((s) => s.renameChatPartner);
  const [open, setOpen] = useState(false);

  const active = summaries.find((p) => p.id === activePartnerId) ?? summaries[0];
  const activeTag = primaryContactTag(active?.tags);

  const handleCreate = () => {
    const defaultTag = PARTNER_TAG_PRESETS[Math.min(summaries.length, 2)];
    const name = window.prompt('新聊天对象的称呼？', defaultTag);
    if (name === null) return;
    createChatPartner(name.trim() || undefined);
    setOpen(false);
  };

  const handleRename = (id: string, current: string) => {
    const name = window.prompt('修改对象称呼（用于区分人物）', current);
    if (name === null || !name.trim()) return;
    renameChatPartner(id, name.trim());
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn-secondary flex items-center gap-1.5 min-h-[40px] ${
          compact ? 'text-xs px-2' : 'text-xs'
        } border-emerald-500/30 text-emerald-100 bg-emerald-950/30`}
        title={
          activeTag
            ? `当前：${activeTag}（${active?.name || ''}）· 点击切换对象`
            : '切换聊天对象 · 长效记忆隔离'
        }
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        {activeTag ? (
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/25 text-emerald-100 text-[10px] font-semibold border border-emerald-400/35">
            {activeTag}
          </span>
        ) : null}
        {(!compact || !activeTag) && (
          <span className={`truncate ${compact ? 'max-w-[4rem]' : 'max-w-[5.5rem]'}`}>
            {active?.name || '选择对象'}
          </span>
        )}
        <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="关闭"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-emerald-500/25 bg-soul-950/98 backdrop-blur-xl shadow-xl shadow-black/40 overflow-hidden animate-fade-in">
            <div className="px-3 py-2 border-b border-soul-700/40">
              <p className="text-xs font-medium text-emerald-200">多对象独立管理</p>
              <p className="text-[10px] text-soul-500 mt-0.5">
                女1 / 女2 / 女3 标签 · 档案记忆关系隔离
              </p>
            </div>
            <ul className="max-h-56 overflow-y-auto scroll-touch py-1">
              {summaries.map((p) => {
                const isActive = p.id === activePartnerId;
                const tag = primaryContactTag(p.tags);
                return (
                  <li key={p.id}>
                    <div
                      className={`flex items-center gap-1 px-2 py-1.5 ${
                        isActive ? 'bg-emerald-900/30' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          switchChatPartner(p.id);
                          setOpen(false);
                        }}
                        className="flex-1 min-w-0 text-left px-1.5 py-1.5 rounded-lg hover:bg-soul-800/60 touch-manipulation"
                      >
                        <span className="flex items-center gap-1.5 text-sm text-soul-100">
                          {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {tag ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 text-[10px] font-semibold border border-emerald-500/30">
                              {tag}
                            </span>
                          ) : null}
                          <span className="truncate font-medium">{p.name}</span>
                        </span>
                        <span className="block text-[10px] text-soul-500 mt-0.5 truncate">
                          {p.messageCount} 条对话
                          {p.temperature != null ? ` · 温度 ${p.temperature}°` : ''}
                          {(p.interestKeywords?.length ?? 0) > 0
                            ? ` · 关键词 ${p.interestKeywords.length}`
                            : p.memoryLines > 0
                              ? ` · 记忆 ${p.memoryLines}`
                              : ''}
                        </span>
                        {(p.tags?.length ?? 0) > 1 && (
                          <span className="flex flex-wrap gap-1 mt-1">
                            {p.tags
                              .filter((t) => t !== tag)
                              .slice(0, 3)
                              .map((t) => (
                                <span
                                  key={t}
                                  className="text-[9px] px-1 py-0.5 rounded bg-soul-800/80 text-soul-400"
                                >
                                  {t}
                                </span>
                              ))}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRename(p.id, p.name)}
                        className="text-[10px] text-soul-400 px-1.5 min-h-[36px]"
                      >
                        改名
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`删除「${p.name}」的全部聊天与记忆？不可恢复`)) {
                            removeChatPartner(p.id);
                          }
                        }}
                        className="p-2 text-red-400/80 hover:text-red-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="删除档案"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border-t border-soul-700/40 text-xs text-emerald-300 hover:bg-emerald-950/40 min-h-[44px] touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" /> 新建（默认女1/女2/女3）
            </button>
          </div>
        </>
      )}
    </div>
  );
}
