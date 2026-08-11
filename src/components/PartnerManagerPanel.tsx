import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Check,
  Pencil,
  StickyNote,
  MessageSquare,
  Thermometer,
  Brain,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { PARTNER_TAG_PRESETS } from '../utils/partnerKeywords';

/** 多对象独立管理 · 档案 / 记忆 / 关系完全隔离 */
export default function PartnerManagerPanel() {
  const summaries = useAppStore((s) => s.partnerSummaries);
  const activePartnerId = useAppStore((s) => s.activePartnerId);
  const switchChatPartner = useAppStore((s) => s.switchChatPartner);
  const createChatPartner = useAppStore((s) => s.createChatPartner);
  const removeChatPartner = useAppStore((s) => s.removeChatPartner);
  const renameChatPartner = useAppStore((s) => s.renameChatPartner);
  const updatePartnerNote = useAppStore((s) => s.updatePartnerNote);
  const updatePartnerTags = useAppStore((s) => s.updatePartnerTags);
  const updatePartnerKeywords = useAppStore((s) => s.updatePartnerKeywords);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const settings = useAppStore((s) => s.settings);
  const messages = useAppStore((s) => s.messages);
  const tracking = useAppStore((s) => s.relationshipTracking);
  const analysis = useAppStore((s) => s.analysis);

  const active = summaries.find((p) => p.id === activePartnerId) ?? summaries[0];
  const [draftNote, setDraftNote] = useState(active?.note ?? '');

  useEffect(() => {
    setDraftNote(active?.note ?? '');
  }, [activePartnerId, active?.note]);

  const memoryPreview = useMemo(() => {
    const details = settings.partnerMemory?.details?.trim() || '';
    return details
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
  }, [settings.partnerMemory?.details]);

  const handleCreate = () => {
    const defaultTag = PARTNER_TAG_PRESETS[Math.min(summaries.length, 2)];
    const name = window.prompt('新聊天对象的称呼？', defaultTag);
    if (name === null) return;
    createChatPartner(name.trim() || undefined);
  };

  const toggleTag = (tag: string) => {
    if (!active) return;
    const cur = active.tags ?? [];
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
    updatePartnerTags(next);
  };

  const removeKeyword = (kw: string) => {
    if (!active) return;
    updatePartnerKeywords((active.interestKeywords ?? []).filter((k) => k !== kw));
  };

  const addKeywordManual = () => {
    if (!active) return;
    const raw = window.prompt('添加兴趣关键词（如：爱唱歌）', '');
    if (raw === null || !raw.trim()) return;
    updatePartnerKeywords([...(active.interestKeywords ?? []), raw.trim()]);
  };

  const handleRename = (id: string, current: string) => {
    const name = window.prompt('修改对象称呼（用于区分人物）', current);
    if (name === null || !name.trim()) return;
    renameChatPartner(id, name.trim());
  };

  const saveNote = () => {
    updatePartnerNote(draftNote);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/45 via-soul-950/70 to-teal-950/20 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/30">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-emerald-100">多对象独立管理</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              每人独立档案、记忆、关系数据与聊天记录 · 切换后数据绝不混淆
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-xl bg-soul-950/50 border border-soul-700/40 px-2.5 py-2 text-center">
            <p className="text-lg font-semibold text-emerald-200 tabular-nums">{summaries.length}</p>
            <p className="text-[10px] text-soul-500">对象数</p>
          </div>
          <div className="rounded-xl bg-soul-950/50 border border-soul-700/40 px-2.5 py-2 text-center">
            <p className="text-lg font-semibold text-emerald-200 tabular-nums">{messages.length}</p>
            <p className="text-[10px] text-soul-500">当前对话</p>
          </div>
          <div className="rounded-xl bg-soul-950/50 border border-soul-700/40 px-2.5 py-2 text-center">
            <p className="text-lg font-semibold text-emerald-200 tabular-nums">
              {active?.temperature ?? '—'}
              {active?.temperature != null ? '°' : ''}
            </p>
            <p className="text-[10px] text-soul-500">关系温度</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-soul-400">对象列表 · 点选即切换隔离工作区</p>
        <button
          type="button"
          onClick={handleCreate}
          className="btn-secondary text-xs min-h-[36px] px-2.5 border-emerald-500/30 text-emerald-200"
        >
          <Plus className="w-3.5 h-3.5" /> 新建
        </button>
      </div>

      <ul className="space-y-2">
        {summaries.map((p) => {
          const isActive = p.id === activePartnerId;
          return (
            <li
              key={p.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                isActive
                  ? 'border-emerald-500/40 bg-emerald-950/35'
                  : 'border-soul-700/40 bg-soul-950/40'
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => switchChatPartner(p.id)}
                  className="flex-1 min-w-0 text-left touch-manipulation"
                >
                  <span className="flex items-center gap-1.5 text-sm text-soul-100 font-medium">
                    {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="block text-[10px] text-soul-500 mt-1 leading-relaxed">
                    {p.messageCount} 条聊天
                    {p.temperature != null ? ` · 温度 ${p.temperature}°` : ''}
                    {p.memoryLines > 0 ? ` · 记忆 ${p.memoryLines}` : ''}
                    {p.hasReport ? ' · 有关系报告' : ''}
                    {` · ${p.stage}`}
                  </span>
                  {(p.tags?.length ?? 0) > 0 && (
                    <span className="flex flex-wrap gap-1 mt-1.5">
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-200/90 border border-emerald-500/25"
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                  {p.note ? (
                    <span className="block text-[10px] text-emerald-300/80 mt-1 truncate">
                      备注：{p.note}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleRename(p.id, p.name)}
                  className="p-2 text-soul-400 hover:text-soul-200 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="改名"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`删除「${p.name}」的全部聊天、记忆与关系数据？不可恢复`)) {
                      removeChatPartner(p.id);
                    }
                  }}
                  className="p-2 text-red-400/80 hover:text-red-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {active && (
        <div className="rounded-xl border border-soul-700/40 bg-soul-950/50 p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-200 font-medium">
            <Shield className="w-3.5 h-3.5" />
            当前专属工作区 · {active.name}
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] text-soul-400 mb-1.5">
              <StickyNote className="w-3 h-3" />
              对象备注（仅本人可见，不混入其他档案）
            </label>
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onBlur={saveNote}
              rows={2}
              placeholder="例如：同事介绍 / 性格慢热 / 周末才回消息…"
              className="input-field text-sm min-h-[64px] resize-y"
            />
          </div>

          <div>
            <p className="text-[11px] text-soul-400 mb-1.5">联系人标签（女1/女2/女3…）</p>
            <div className="flex flex-wrap gap-1.5">
              {PARTNER_TAG_PRESETS.map((tag) => {
                const on = (active.tags ?? []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] px-2 py-1 rounded-lg border touch-manipulation min-h-[32px] ${
                      on
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
                        : 'bg-soul-900/50 border-soul-700/40 text-soul-400'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[11px] text-soul-400">兴趣关键词（对话自动收录）</p>
              <button
                type="button"
                onClick={addKeywordManual}
                className="text-[10px] text-emerald-300/90 hover:text-emerald-200"
              >
                + 手动添加
              </button>
            </div>
            {(active.interestKeywords?.length ?? 0) === 0 ? (
              <p className="text-[11px] text-soul-600">
                对方提到「喜欢唱歌 / 喜欢运动」等时会自动记入本档案
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {active.interestKeywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    title="点击删除"
                    onClick={() => removeKeyword(kw)}
                    className="text-[11px] px-2 py-1 rounded-lg bg-teal-500/10 border border-teal-500/25 text-teal-100/90"
                  >
                    {kw} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-soul-900/60 border border-soul-700/30 px-2.5 py-2">
              <p className="text-soul-500 flex items-center gap-1 mb-0.5">
                <MessageSquare className="w-3 h-3" /> 聊天记录
              </p>
              <p className="text-soul-200">{messages.length} 条 · 已按人隔离</p>
            </div>
            <div className="rounded-lg bg-soul-900/60 border border-soul-700/30 px-2.5 py-2">
              <p className="text-soul-500 flex items-center gap-1 mb-0.5">
                <Thermometer className="w-3 h-3" /> 关系温度
              </p>
              <p className="text-soul-200">
                {tracking?.temperature ?? active.temperature ?? '—'}
                {(tracking?.temperature ?? active.temperature) != null ? '°' : ''}
                {tracking?.progress ? ` · ${tracking.progress}` : ` · ${active.stage}`}
              </p>
            </div>
            <div className="rounded-lg bg-soul-900/60 border border-soul-700/30 px-2.5 py-2 col-span-2">
              <p className="text-soul-500 flex items-center gap-1 mb-1">
                <Brain className="w-3 h-3" /> 独立记忆预览
              </p>
              {memoryPreview.length ? (
                <ul className="space-y-0.5 text-soul-200">
                  {memoryPreview.map((line) => (
                    <li key={line} className="truncate">
                      · {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-soul-500">暂无记忆，聊天与分析后会自动沉淀</p>
              )}
            </div>
          </div>

          {analysis?.strategy?.nextMove && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 px-2.5 py-2">
              <p className="text-[10px] text-rose-300/90 mb-0.5">专属推进策略（仅针对 {active.name}）</p>
              <p className="text-[12px] text-soul-100 leading-snug">{analysis.strategy.nextMove}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActivePanel('chat')}
              className="btn-secondary text-xs min-h-[36px] px-2.5"
            >
              去聊天 <ArrowRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setLoveSubTab('relation')}
              className="btn-secondary text-xs min-h-[36px] px-2.5"
            >
              关系报告
            </button>
            <button
              type="button"
              onClick={() => setLoveSubTab('replies')}
              className="btn-secondary text-xs min-h-[36px] px-2.5"
            >
              专属话术
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
