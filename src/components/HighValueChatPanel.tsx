import { useMemo } from 'react';
import {
  Gem,
  Sparkles,
  Heart,
  Compass,
  Shield,
  ArrowRight,
  UserRound,
  Lightbulb,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  extractHighValueAssets,
  groupHighValueAssets,
  HIGH_VALUE_KIND_META,
  HIGH_VALUE_TACTICS,
  type HighValueAssetKind,
} from '../constants/highValueChat';
import { getDualProfileFillStats } from '../utils/profileContext';

const KIND_ORDER: HighValueAssetKind[] = [
  'sparkle',
  'life',
  'values',
  'edge',
  'presence',
];

const KIND_ICON: Record<HighValueAssetKind, typeof Gem> = {
  sparkle: Sparkles,
  life: Heart,
  values: Compass,
  edge: Shield,
  presence: Gem,
};

/** 灵焰高价值聊天模式面板 */
export default function HighValueChatPanel() {
  const settings = useAppStore((s) => s.settings);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const showToast = useAppStore((s) => s.showToast);

  const assets = useMemo(
    () => extractHighValueAssets(settings.myProfile),
    [settings.myProfile]
  );
  const groups = useMemo(() => groupHighValueAssets(assets), [assets]);
  const stats = getDualProfileFillStats(settings);

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/45 via-soul-950/70 to-rose-950/25 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/30">
            <Gem className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-amber-100">高价值聊天模式</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              自然植入闪光点 · 生活价值 · 三观魅力 · 优势特质 · 自信松弛不油腻
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-xl bg-soul-950/50 border border-soul-700/40 px-2.5 py-2 text-center">
            <p className="text-lg font-semibold text-amber-200 tabular-nums">{assets.length}</p>
            <p className="text-[10px] text-soul-500">可用素材</p>
          </div>
          <div className="rounded-xl bg-soul-950/50 border border-soul-700/40 px-2.5 py-2 text-center">
            <p className="text-lg font-semibold text-amber-200 tabular-nums">
              {stats.myFilled}/{stats.myTotal}
            </p>
            <p className="text-[10px] text-soul-500">资料卡</p>
          </div>
          <div className="rounded-xl bg-soul-950/50 border border-soul-700/40 px-2.5 py-2 text-center">
            <p className="text-lg font-semibold text-amber-200">ON</p>
            <p className="text-[10px] text-soul-500">话术已注入</p>
          </div>
        </div>
        <p className="text-[11px] text-soul-400 mt-3 leading-relaxed">
          生成回复时会自动按「侧面带出、不装逼、不油腻」规则，把你的真实优势织进对话，塑造有吸引力的人设。
        </p>
      </div>

      <section className="space-y-2">
        <p className="text-xs text-soul-300 font-medium flex items-center gap-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
          植入手法
        </p>
        <ul className="space-y-2">
          {HIGH_VALUE_TACTICS.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-soul-700/40 bg-soul-950/45 px-3 py-2.5"
            >
              <p className="text-[12px] font-medium text-amber-100/95">{t.title}</p>
              <p className="text-[11px] text-soul-400 leading-snug mt-0.5">{t.tip}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-soul-300 font-medium">你的高价值素材</p>
          <button
            type="button"
            onClick={() => {
              setActivePanel('me');
              showToast('去「我的」补全本人资料卡');
            }}
            className="btn-ghost text-[10px] text-amber-300 min-h-[32px] px-1.5"
          >
            <UserRound className="w-3 h-3" /> 编辑资料
          </button>
        </div>

        {assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-950/15 px-3 py-4 text-center">
            <p className="text-[12px] text-soul-300">暂无素材 · 话术会用松弛态度兜底</p>
            <p className="text-[11px] text-soul-500 mt-1">
              填写闪光点、价值观、爱好后，植入会更准、更像你
            </p>
            <button
              type="button"
              onClick={() => setActivePanel('me')}
              className="btn-secondary text-xs min-h-[36px] mt-3 border-amber-500/30 text-amber-100"
            >
              去填写本人资料卡
            </button>
          </div>
        ) : (
          KIND_ORDER.map((kind) => {
            const list = groups[kind];
            if (!list.length) return null;
            const meta = HIGH_VALUE_KIND_META[kind];
            const Icon = KIND_ICON[kind];
            return (
              <div
                key={kind}
                className="rounded-xl border border-soul-700/40 bg-soul-950/45 px-3 py-2.5"
              >
                <p className="text-[11px] font-medium text-amber-100/90 flex items-center gap-1 mb-1">
                  <Icon className="w-3.5 h-3.5" />
                  {meta.title}
                </p>
                <p className="text-[10px] text-soul-500 mb-1.5">{meta.hint}</p>
                <ul className="space-y-1">
                  {list.map((a) => (
                    <li key={`${a.kind}-${a.label}`} className="text-[12px] text-soul-200 leading-snug">
                      <span className="text-soul-500">{a.label}：</span>
                      {a.content}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <div className="flex flex-wrap gap-2 pb-2">
        <button
          type="button"
          onClick={() => {
            setActivePanel('chat');
            showToast('去聊天 · 生成回复时已启用高价值植入');
          }}
          className="btn-secondary text-xs min-h-[36px] px-2.5"
        >
          去聊天 <ArrowRight className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => setLoveSubTab('replies')}
          className="btn-secondary text-xs min-h-[36px] px-2.5 border-amber-500/25 text-amber-100"
        >
          看专属话术
        </button>
        <button
          type="button"
          onClick={() => {
            useAppStore.getState().setWorkshopCategory('high_value');
            setLoveSubTab('workshop');
          }}
          className="btn-secondary text-xs min-h-[36px] px-2.5"
        >
          高价值工坊
        </button>
      </div>
    </div>
  );
}
