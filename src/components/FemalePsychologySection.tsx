import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import type { FemalePsychologyInsight } from '../types';
import { FEMALE_PSYCHOLOGY_REFERENCE, SOCIAL_SCENARIOS } from '../constants/femalePsychology';

interface Props {
  insight: FemalePsychologyInsight;
}

export default function FemalePsychologySection({ insight }: Props) {
  const [refOpen, setRefOpen] = useState(false);
  const hasInsight =
    insight.socialScenario ||
    insight.coreNeeds.length > 0 ||
    insight.commStyle ||
    insight.replyPrinciple ||
    insight.scenarioTip;

  const matchedScenario = SOCIAL_SCENARIOS.find(
    (s) => s.label === insight.socialScenario || insight.socialScenario.includes(s.label)
  );

  return (
    <>
      {hasInsight && (
        <div className="p-3 bg-soul-950/30 rounded-xl border border-pink-500/20">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-medium text-soul-300">女性心理洞察</h3>
            {insight.socialScenario && (
              <span className="tag-touch bg-pink-600/20 text-pink-300 ml-auto text-xs max-w-[50%] truncate">
                {insight.socialScenario}
              </span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            {insight.coreNeeds.length > 0 && (
              <div>
                <span className="text-soul-400 text-xs">核心情感需求</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {insight.coreNeeds.map((need, i) => (
                    <span key={i} className="tag bg-soul-700/50 text-soul-200">
                      {need}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {insight.commStyle && (
              <InfoRow label="沟通模式" value={insight.commStyle} />
            )}
            {insight.replyPrinciple && (
              <InfoRow label="回复原则" value={insight.replyPrinciple} highlight />
            )}
            {insight.scenarioTip && (
              <div className="p-2.5 bg-pink-900/15 border border-pink-500/15 rounded-lg">
                <div className="flex items-center gap-1.5 text-pink-300 text-xs font-medium mb-1">
                  <MessageCircle className="w-3.5 h-3.5" /> 场景话术方向
                </div>
                <p className="text-soul-200 text-xs leading-relaxed">{insight.scenarioTip}</p>
              </div>
            )}
            {matchedScenario && (
              <div className="pt-1 border-t border-soul-700/30">
                <p className="text-soul-500 text-xs mb-1.5">该场景表达范例（须结合对方原话改写）</p>
                <ul className="text-soul-300 text-xs space-y-1">
                  {matchedScenario.examples.map((ex, i) => (
                    <li key={i} className="pl-2 border-l border-pink-500/30">
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-soul-700/20 overflow-hidden">
        <button
          type="button"
          onClick={() => setRefOpen((v) => !v)}
          className="w-full px-3 py-3 sm:py-2.5 min-h-[44px] flex items-center justify-between bg-soul-950/40 hover:bg-soul-900/40 transition-colors text-left touch-manipulation"
        >
          <span className="text-xs font-medium text-soul-400">女性心理学 · 场景话术参考</span>
          {refOpen ? (
            <ChevronUp className="w-4 h-4 text-soul-500 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-soul-500 shrink-0" />
          )}
        </button>
        {refOpen && (
          <div className="p-3 space-y-3 bg-soul-950/20 border-t border-soul-700/20 text-xs">
            <RefBlock title="基础理论" items={FEMALE_PSYCHOLOGY_REFERENCE.theory} />
            <RefBlock title="情感需求特点" items={FEMALE_PSYCHOLOGY_REFERENCE.needs} />
            <RefBlock title="沟通模式差异" items={FEMALE_PSYCHOLOGY_REFERENCE.commDiff} />
            <div>
              <p className="text-soul-400 font-medium mb-2">六大社交场景 · 回复要点</p>
              <div className="space-y-2">
                {SOCIAL_SCENARIOS.map((s) => (
                  <div
                    key={s.id}
                    className="p-2 rounded-lg bg-soul-900/30 border border-soul-700/20"
                  >
                    <p className="text-pink-300/90 font-medium mb-0.5">{s.label}</p>
                    <p className="text-soul-400 mb-1">{s.psychFocus}</p>
                    <p className="text-soul-500">
                      宜：{s.replyDos.join('、')} · 忌：{s.replyDonts.join('、')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <span className="text-soul-400 text-xs">{label}</span>
      <p className={`mt-0.5 leading-relaxed ${highlight ? 'text-pink-200/90' : 'text-soul-200'}`}>
        {value}
      </p>
    </div>
  );
}

function RefBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-soul-400 font-medium mb-1">{title}</p>
      <ul className="text-soul-300 space-y-0.5 list-disc list-inside">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
