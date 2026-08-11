/**
 * 恋爱页信息架构：主栏四页 + 更多工具箱
 * 深层 LoveSubTab 仍可用于路由，但顶栏只暴露主路径。
 */

import type { LoveSubTab } from '../types';

/** 顶栏主入口 */
export type LovePrimaryTab = 'partners' | 'analysis' | 'replies' | 'more';

export const LOVE_PRIMARY_TABS: {
  id: LovePrimaryTab;
  label: string;
  hint: string;
}[] = [
  { id: 'partners', label: '对象', hint: '多对象档案与切换' },
  { id: 'analysis', label: '分析', hint: '心思 · 策略 · 雷达/风控' },
  { id: 'replies', label: '话术', hint: '多风格可发送回复' },
  { id: 'more', label: '更多', hint: '工坊/关系等次要工具' },
];

/** 收进「更多」的次要能力（含冻结说明） */
export type LoveMoreToolId = Exclude<LoveSubTab, LovePrimaryTab>;

export const LOVE_MORE_TOOLS: {
  id: LoveMoreToolId;
  label: string;
  summary: string;
  /** frozen = 暂不主推，仍可进入 */
  status?: 'active' | 'frozen';
}[] = [
  { id: 'radar', label: '情绪雷达', summary: '九维情绪与四层拆解（分析页已含摘要）' },
  { id: 'risk', label: '反诈风控', summary: '套路拆解与反制（分析页已含摘要）' },
  { id: 'relation', label: '关系报告', summary: '亲密度与升温建议' },
  { id: 'workshop', label: '话术工坊', summary: '分类场景库与微调' },
  { id: 'value', label: '高价值聊天', summary: '闪光点自然植入' },
  { id: 'guard', label: '净语说明', summary: '护栏规则说明（已默认全程生效）' },
  {
    id: 'drill',
    label: '模拟演练',
    summary: '场景对练打分',
    status: 'frozen',
  },
  {
    id: 'image',
    label: '识图话题',
    summary: '看图找话题（聊天截图请用 OCR）',
    status: 'frozen',
  },
];

const MORE_IDS = new Set<LoveSubTab>(LOVE_MORE_TOOLS.map((t) => t.id));

export function isLoveMoreTool(tab: LoveSubTab): boolean {
  return MORE_IDS.has(tab);
}

/** 当前子页对应的顶栏高亮 */
export function resolveLovePrimaryTab(tab: LoveSubTab): LovePrimaryTab {
  if (tab === 'partners' || tab === 'analysis' || tab === 'replies') return tab;
  return 'more';
}
