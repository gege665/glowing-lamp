export const ICE_BREAKER_SCENARIOS = [
  { id: 'first_add', label: '初次加好友', desc: '3 条不油腻自然开场白', count: 3 },
  { id: 'cold_chat', label: '聊天冷场', desc: '重启话题，打破沉默', count: 3 },
  { id: 'topic_end', label: '话题终结', desc: '自然延续对话', count: 3 },
  { id: 'silent_fight', label: '冷战断联', desc: '温和破冰，恢复联系', count: 3 },
  { id: 'first_meet', label: '初识破冰', desc: '消除陌生感', count: 3 },
  { id: 'invite', label: '约会邀约', desc: '自然发出邀请', count: 3 },
  { id: 'fight_calm', label: '吵架缓和', desc: '化解矛盾情绪', count: 3 },
  { id: 'ambiguous', label: '暧昧拉扯', desc: '适度升温氛围', count: 3 },
  { id: 'morning', label: '早安问候', desc: '开启一天聊天', count: 2 },
  { id: 'night', label: '晚安收尾', desc: '留下好印象', count: 2 },
  { id: 'holiday', label: '节日祝福', desc: '借势拉近距离', count: 2 },
  { id: 'reconnect', label: '久未联系', desc: '重新建立联系', count: 3 },
] as const;

export type IceBreakerScenarioId = (typeof ICE_BREAKER_SCENARIOS)[number]['id'];

export function getIceBreakerScenario(id: IceBreakerScenarioId) {
  return ICE_BREAKER_SCENARIOS.find((s) => s.id === id) ?? ICE_BREAKER_SCENARIOS[0];
}
