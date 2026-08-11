/** 灵焰破冰救场 · 核心场景（优先展示） */
export const LINGYAN_RESCUE_SCENARIOS = [
  {
    id: 'first_add',
    label: '新加好友',
    desc: '第一句不尬 · 高开启率',
    icon: '👋',
    count: 3,
    continueCount: 3,
    group: 'rescue' as const,
  },
  {
    id: 'approach',
    label: '搭讪开场',
    desc: '轻松搭话 · 不油不套路',
    icon: '✨',
    count: 3,
    continueCount: 3,
    group: 'rescue' as const,
  },
  {
    id: 'reconnect',
    label: '复联重连',
    desc: '久未联系 · 自然接上',
    icon: '🔄',
    count: 3,
    continueCount: 3,
    group: 'rescue' as const,
  },
  {
    id: 'cold_chat',
    label: '冷场救场',
    desc: '打破沉默 · 重启话题',
    icon: '⚡',
    count: 3,
    continueCount: 3,
    group: 'rescue' as const,
  },
  {
    id: 'silent_fight',
    label: '尴尬断联',
    desc: '温和破冰 · 给台阶',
    icon: '🧊',
    count: 3,
    continueCount: 3,
    group: 'rescue' as const,
  },
] as const;

/** 扩展场景（更多） */
export const ICE_BREAKER_EXTRA_SCENARIOS = [
  { id: 'topic_end', label: '话题终结', desc: '自然延续对话', icon: '💬', count: 3, continueCount: 2, group: 'extra' as const },
  { id: 'first_meet', label: '初识破冰', desc: '消除陌生感', icon: '🌱', count: 3, continueCount: 2, group: 'extra' as const },
  { id: 'invite', label: '约会邀约', desc: '自然发出邀请', icon: '☕', count: 3, continueCount: 2, group: 'extra' as const },
  { id: 'fight_calm', label: '吵架缓和', desc: '化解矛盾情绪', icon: '🕊️', count: 3, continueCount: 2, group: 'extra' as const },
  { id: 'ambiguous', label: '暧昧拉扯', desc: '适度升温氛围', icon: '💕', count: 3, continueCount: 2, group: 'extra' as const },
  { id: 'morning', label: '早安问候', desc: '开启一天聊天', icon: '☀️', count: 2, continueCount: 2, group: 'extra' as const },
  { id: 'night', label: '晚安收尾', desc: '留下好印象', icon: '🌙', count: 2, continueCount: 2, group: 'extra' as const },
  { id: 'holiday', label: '节日祝福', desc: '借势拉近距离', icon: '🎉', count: 2, continueCount: 2, group: 'extra' as const },
] as const;

export const ICE_BREAKER_SCENARIOS = [
  ...LINGYAN_RESCUE_SCENARIOS,
  ...ICE_BREAKER_EXTRA_SCENARIOS,
] as const;

export type IceBreakerScenarioId = (typeof ICE_BREAKER_SCENARIOS)[number]['id'];

export function getIceBreakerScenario(id: IceBreakerScenarioId) {
  return ICE_BREAKER_SCENARIOS.find((s) => s.id === id) ?? ICE_BREAKER_SCENARIOS[0];
}
