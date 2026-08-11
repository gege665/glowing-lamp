import { useEffect, useRef } from 'react';
import {
  Heart,
  Brain,
  MessageSquareText,
  Users,
  LayoutGrid,
  ChevronLeft,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { LoveSubTab } from '../types';
import {
  LOVE_MORE_TOOLS,
  LOVE_PRIMARY_TABS,
  isLoveMoreTool,
  resolveLovePrimaryTab,
  type LovePrimaryTab,
} from '../constants/loveNav';
import PartnerSwitcher from './PartnerSwitcher';
import PartnerManagerPanel from './PartnerManagerPanel';
import HighValueChatPanel from './HighValueChatPanel';
import SpeechGuardPanel from './SpeechGuardPanel';
import EmotionRadarPanel from './EmotionRadarPanel';
import RiskControlPanel from './RiskControlPanel';
import WorkshopPanel from './WorkshopPanel';
import RelationshipReportPanel from './RelationshipReportPanel';
import ImageTopicPanel from './ImageTopicPanel';
import AnalysisPanel from './AnalysisPanel';
import ReplyPanel from './ReplyPanel';
import DrillPanel from './DrillPanel';
import LoveMoreHub from './LoveMoreHub';
import { getLovePersona } from '../constants/lovePersonas';

const PRIMARY_ICONS: Record<LovePrimaryTab, typeof Heart> = {
  partners: Users,
  analysis: Brain,
  replies: MessageSquareText,
  more: LayoutGrid,
};

function moreToolLabel(tab: LoveSubTab): string {
  return LOVE_MORE_TOOLS.find((t) => t.id === tab)?.label ?? '更多工具';
}

export default function LovePanel() {
  const loveSubTab = useAppStore((s) => s.loveSubTab);
  const setLoveSubTab = useAppStore((s) => s.setLoveSubTab);
  const settings = useAppStore((s) => s.settings);
  const analysis = useAppStore((s) => s.analysis);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const isDrilling = useAppStore((s) => s.isDrilling);
  const isWorkshopGenerating = useAppStore((s) => s.isWorkshopGenerating);
  const isGeneratingRelationshipReport = useAppStore((s) => s.isGeneratingRelationshipReport);
  const isImageTopicLoading = useAppStore((s) => s.isImageTopicLoading);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const tabRefs = useRef<Partial<Record<LovePrimaryTab, HTMLButtonElement | null>>>({});

  const persona = getLovePersona(settings.lovePersona);
  const primary = resolveLovePrimaryTab(loveSubTab);
  const inMoreTool = isLoveMoreTool(loveSubTab);

  useEffect(() => {
    const el = tabRefs.current[primary];
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [primary]);

  const onPrimaryClick = (id: LovePrimaryTab) => {
    if (id === 'more') {
      setLoveSubTab('more');
      return;
    }
    setLoveSubTab(id);
  };

  const moreBusy =
    isWorkshopGenerating ||
    isGeneratingRelationshipReport ||
    isImageTopicLoading ||
    isDrilling ||
    (isAnalyzing && (loveSubTab === 'radar' || loveSubTab === 'risk'));

  return (
    <div className="panel-card h-full min-h-0 overflow-hidden flex flex-col love-glow">
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-rose-500/15 bg-gradient-to-r from-rose-950/40 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-500/25">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-rose-100 truncate">恋爱关系</h2>
            <p className="text-[11px] text-soul-400 truncate">
              {settings.appMode === 'love'
                ? `${persona.emoji} ${persona.label} · 对象 / 分析 / 话术`
                : '通用社交 · 主路径：分析与话术'}
            </p>
          </div>
          <PartnerSwitcher compact />
          <button
            type="button"
            onClick={() => setActivePanel('chat')}
            className="btn-ghost text-xs text-pink-300 min-h-[40px] px-2 shrink-0"
          >
            去聊天
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-soul-950/50 border border-soul-700/30">
          {LOVE_PRIMARY_TABS.map(({ id, label }) => {
            const Icon = PRIMARY_ICONS[id];
            const active = primary === id;
            const badge =
              (id === 'replies' && analysis && analysis.replies.length > 0 && !isAnalyzing) ||
              (id === 'analysis' && isAnalyzing) ||
              (id === 'more' && moreBusy) ||
              (id === 'more' && analysis?.riskAssessment?.level === 'high');
            return (
              <button
                key={id}
                ref={(node) => {
                  tabRefs.current[id] = node;
                }}
                type="button"
                onClick={() => onPrimaryClick(id)}
                className={`relative flex items-center justify-center gap-1 min-h-[44px] rounded-lg text-[12px] font-medium transition-all touch-manipulation ${
                  active
                    ? 'bg-gradient-to-r from-rose-600/40 to-pink-600/30 text-rose-100'
                    : 'text-soul-400 hover:text-soul-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
                {badge && (
                  <span
                    className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${
                      isAnalyzing && id === 'analysis' ? 'bg-pink-400 animate-pulse' : 'bg-pink-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {inMoreTool && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLoveSubTab('more')}
              className="btn-ghost text-[11px] text-soul-300 min-h-[36px] px-2 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> 更多
            </button>
            <span className="text-[11px] text-soul-500 truncate">{moreToolLabel(loveSubTab)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {loveSubTab === 'partners' && <PartnerManagerPanel />}

        {loveSubTab === 'analysis' && (
          <div className="h-full min-h-0">
            <AnalysisPanel />
          </div>
        )}

        {loveSubTab === 'replies' && (
          <div className="h-full min-h-0">
            <ReplyPanel />
          </div>
        )}

        {loveSubTab === 'more' && <LoveMoreHub />}

        {loveSubTab === 'guard' && <SpeechGuardPanel />}
        {loveSubTab === 'value' && <HighValueChatPanel />}
        {loveSubTab === 'image' && <ImageTopicPanel />}
        {loveSubTab === 'relation' && <RelationshipReportPanel />}
        {loveSubTab === 'workshop' && <WorkshopPanel />}
        {loveSubTab === 'risk' && <RiskControlPanel />}
        {loveSubTab === 'drill' && <DrillPanel />}
        {loveSubTab === 'radar' && <EmotionRadarPanel />}
      </div>
    </div>
  );
}
