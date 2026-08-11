import type { ChatSceneId } from './coreReplyStyles';

/** 恋爱场景卡片（可点击，降低选择成本） */
export interface LoveSceneCard {
  id: ChatSceneId;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
}

/** 社交模式场景（朋友 / 职场泛场景） */
export const SOCIAL_SCENE_CARDS: LoveSceneCard[] = [
  { id: 'first_add', title: '初次认识', subtitle: '破冰开场', icon: '👋', accent: 'from-violet-500/30 to-fuchsia-500/20' },
  { id: 'cold_chat', title: '话题冷场', subtitle: '轻松续聊', icon: '💬', accent: 'from-sky-500/30 to-indigo-500/20' },
  { id: 'closer', title: '拉近关系', subtitle: '朋友变熟', icon: '🤝', accent: 'from-teal-500/30 to-cyan-500/20' },
  { id: 'invite', title: '约出来玩', subtitle: '自然邀约', icon: '☕', accent: 'from-amber-500/30 to-orange-500/20' },
  { id: 'perfunctory', title: '对方敷衍', subtitle: '不卑微接话', icon: '😑', accent: 'from-slate-500/30 to-soul-500/20' },
  { id: 'angry', title: '气氛尴尬', subtitle: '降温化解', icon: '😅', accent: 'from-rose-500/25 to-orange-500/20' },
];

/** 恋爱专属场景卡片 */
export const LOVE_SCENE_CARDS: LoveSceneCard[] = [
  { id: 'first_add', title: '初次聊天', subtitle: '第一印象 · 轻撩不尬', icon: '💫', accent: 'from-pink-500/35 to-rose-400/20' },
  { id: 'test_feelings', title: '暧昧试探', subtitle: '心动信号 · 分寸撩', icon: '💘', accent: 'from-fuchsia-500/35 to-pink-500/25' },
  { id: 'closer', title: '拉近距离', subtitle: '走心升温', icon: '🌙', accent: 'from-violet-500/30 to-pink-500/25' },
  { id: 'invite', title: '约会邀约', subtitle: '自然提出见面', icon: '🌸', accent: 'from-rose-500/30 to-amber-400/20' },
  { id: 'make_up', title: '道歉哄人', subtitle: '先共情再推进', icon: '🥺', accent: 'from-orange-400/30 to-pink-500/25' },
  { id: 'angry', title: '对方生气', subtitle: '温柔止血', icon: '💔', accent: 'from-red-500/25 to-rose-500/20' },
  { id: 'perfunctory', title: '对方敷衍', subtitle: '框架拉回', icon: '🧊', accent: 'from-cyan-500/25 to-soul-500/20' },
  { id: 'cold_chat', title: '聊天冷场', subtitle: '重启话题', icon: '⚡', accent: 'from-amber-500/30 to-pink-500/20' },
];

/** 场景阶段：初识 → 升温 → 维护 */
export type SceneStageId = 'meet' | 'heat' | 'maintain';

export interface SceneStageGroup {
  id: SceneStageId;
  label: string;
  sceneIds: ChatSceneId[];
}

export const LOVE_SCENE_STAGES: SceneStageGroup[] = [
  { id: 'meet', label: '初识', sceneIds: ['first_add', 'test_feelings'] },
  { id: 'heat', label: '升温', sceneIds: ['closer', 'invite', 'cold_chat'] },
  { id: 'maintain', label: '维护', sceneIds: ['make_up', 'angry', 'perfunctory'] },
];

export const SOCIAL_SCENE_STAGES: SceneStageGroup[] = [
  { id: 'meet', label: '初识', sceneIds: ['first_add', 'cold_chat'] },
  { id: 'heat', label: '升温', sceneIds: ['closer', 'invite'] },
  { id: 'maintain', label: '维护', sceneIds: ['perfunctory', 'angry'] },
];

export function getSceneCardsForMode(mode: 'social' | 'love'): LoveSceneCard[] {
  return mode === 'love' ? LOVE_SCENE_CARDS : SOCIAL_SCENE_CARDS;
}

export function getSceneStagesForMode(mode: 'social' | 'love'): SceneStageGroup[] {
  return mode === 'love' ? LOVE_SCENE_STAGES : SOCIAL_SCENE_STAGES;
}

export function resolveStageForScene(
  mode: 'social' | 'love',
  sceneId: string
): SceneStageId {
  const stages = getSceneStagesForMode(mode);
  const hit = stages.find((s) => s.sceneIds.includes(sceneId as ChatSceneId));
  return hit?.id ?? 'meet';
}
