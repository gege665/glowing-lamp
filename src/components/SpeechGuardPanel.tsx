import {
  ShieldCheck,
  Ban,
  CheckCircle2,
  ArrowRight,
  MessageSquareText,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  SPEECH_BAN_CATEGORIES,
  SPEECH_POSITIVE_STANDARDS,
} from '../constants/speechGuardrails';

/** 灵焰净语护栏 · 全程禁区与正向标准 */
export default function SpeechGuardPanel() {
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const showToast = useAppStore((s) => s.showToast);
  const analysis = useAppStore((s) => s.analysis);

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-950/45 via-soul-950/70 to-sky-950/25 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-sky-500 flex items-center justify-center shrink-0 shadow-lg shadow-teal-900/30">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-teal-100">净语护栏</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              全程禁油腻套路 · 强制普通人日常语气 · 真实自然无违和
            </p>
          </div>
        </div>
        <p className="text-[11px] text-soul-400 leading-relaxed mt-2">
          已注入全部分析与话术生成：禁止油腻土味、烂梗装逼、舔狗讨好、低俗暧昧、生硬套路、书面腔、万能模板、PUA
          功利、夸大情绪与恶意揣测。
        </p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-teal-200/90">
          <span className="inline-flex items-center gap-1 rounded-lg bg-teal-950/50 border border-teal-500/25 px-2 py-1">
            <CheckCircle2 className="w-3 h-3" /> 全程生效中
          </span>
        </div>
      </div>

      <section className="space-y-2">
        <p className="text-xs text-soul-300 font-medium flex items-center gap-1">
          <Ban className="w-3.5 h-3.5 text-red-300" />
          全程禁止
        </p>
        {SPEECH_BAN_CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="rounded-xl border border-red-500/20 bg-red-950/15 px-3 py-2.5"
          >
            <p className="text-[12px] font-medium text-red-200/95 mb-1">{cat.title}</p>
            <ul className="space-y-0.5">
              {cat.items.map((item) => (
                <li key={item} className="text-[11px] text-soul-400 leading-snug">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <p className="text-xs text-soul-300 font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-300" />
          输出标准
        </p>
        <div className="rounded-xl border border-teal-500/20 bg-teal-950/15 px-3 py-2.5">
          <ul className="space-y-1">
            {SPEECH_POSITIVE_STANDARDS.map((s) => (
              <li key={s} className="text-[11px] text-soul-200 leading-snug">
                · {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 pb-2">
        <button
          type="button"
          onClick={() => {
            setActivePanel('chat');
            showToast('去聊天 · 净语护栏已全程生效');
          }}
          className="btn-secondary text-xs min-h-[36px] px-2.5"
        >
          去聊天 <ArrowRight className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => setLoveSubTab('replies')}
          className="btn-secondary text-xs min-h-[36px] px-2.5 border-teal-500/25 text-teal-100"
        >
          <MessageSquareText className="w-3 h-3" />
          看话术
          {analysis?.replies?.length ? ` · ${analysis.replies.length}` : ''}
        </button>
      </div>
    </div>
  );
}
