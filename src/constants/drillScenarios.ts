/** 灵焰全场景模拟演练 · 恋爱社交场景 */

export type DrillScenarioId =
  | 'approach'
  | 'first_meet'
  | 'flirt_warm'
  | 'date_invite'
  | 'fight_apology'
  | 'comfort'
  | 'cold_war'
  | 'confess'
  | 'win_back'
  | 'handle_test'
  | 'anti_routine';

export interface DrillScenario {
  id: DrillScenarioId;
  label: string;
  desc: string;
  icon: string;
  /** 她的人设与情绪基调 */
  herPersona: string;
  /** 开场情境 */
  openingCue: string;
  /** 演练目标 */
  goal: string;
  /** 常见踩雷 */
  pitfalls: string[];
}

export const DRILL_SCENARIOS: DrillScenario[] = [
  {
    id: 'approach',
    label: '搭讪',
    desc: '线下/线上第一句不尬',
    icon: '✨',
    herPersona: '有点防备但礼貌，对油腻敏感，喜欢自然松弛的男生',
    openingCue: '你刚搭上话，她回了一句不冷不热的话，等你接',
    goal: '破冰自然、不油不查户口，让她愿意再回一句',
    pitfalls: ['查户口', '土味夸', '连环问', '强行要微信'],
  },
  {
    id: 'first_meet',
    label: '初识',
    desc: '刚认识 · 建立舒适感',
    icon: '👋',
    herPersona: '刚加上好友，谨慎好奇，回消息看心情',
    openingCue: '好友刚通过，她发了「嗯？」或简单招呼，等你表明来意',
    goal: '消除陌生感，留下轻松好印象',
    pitfalls: ['客服腔', '长篇自我介绍', '过早暧昧', '不问来由装熟'],
  },
  {
    id: 'flirt_warm',
    label: '暧昧升温',
    desc: '心动拉扯 · 分寸推进',
    icon: '💘',
    herPersona: '有点喜欢你但嘴硬，会试探也会害羞，讨厌油腻直球',
    openingCue: '你们已经有点暧昧，她发来带点试探或小情绪的一句',
    goal: '升温不越界，制造惦记感',
    pitfalls: ['过早表白', '油腻土味', '只撩不走心', '舔狗附和'],
  },
  {
    id: 'date_invite',
    label: '约会邀约',
    desc: '自然提出见面',
    icon: '☕',
    herPersona: '对见面犹豫，怕尴尬，需要具体又不施压的邀约',
    openingCue: '聊天气氛不错，适合提见面；她可能找借口或含糊',
    goal: '具体时间/活动，可拒绝语气，提高赴约率',
    pitfalls: ['什么时候有空', '逼问确定', '太空泛', '像查勤'],
  },
  {
    id: 'fight_apology',
    label: '吵架道歉',
    desc: '先共情再认错',
    icon: '💔',
    herPersona: '在生气，需要被看见情绪，讨厌讲道理和「你也有错」',
    openingCue: '她刚甩了几句气话或指责，情绪高',
    goal: '止血、共情、有效道歉，不跪舔不抬杠',
    pitfalls: ['先辩解', '讲大道理', '假道歉', '翻旧账'],
  },
  {
    id: 'comfort',
    label: '哄对象',
    desc: '情绪价值 · 宠但不油',
    icon: '🥺',
    herPersona: '委屈/疲惫/需要被哄，想被懂而不是被说教',
    openingCue: '她说「好累」「心情不好」或小抱怨',
    goal: '接住情绪，给安全感，适度宠溺',
    pitfalls: ['鸡汤说教', '马上给方案', '敷衍「没事的」', '转移话题'],
  },
  {
    id: 'cold_war',
    label: '冷战修复',
    desc: '破冰重连 · 给台阶',
    icon: '🧊',
    herPersona: '冷战中，嘴硬心软，需要台阶但不接受卑微跪舔',
    openingCue: '你们冷了几天，她回得很短或已读不回后突然回了',
    goal: '温和破冰，修复氛围，不翻旧账施压',
    pitfalls: ['质问为什么不理', '卑微讨好', '装作没事回避', '威胁分手'],
  },
  {
    id: 'confess',
    label: '表白',
    desc: '真诚表态 · 不施压',
    icon: '💗',
    herPersona: '隐约感觉到你的心意，期待又紧张，怕被逼表态',
    openingCue: '气氛到了可以说心意的节点，她态度暧昧',
    goal: '真诚清晰表达，留空间，不绑架',
    pitfalls: ['逼问爱不爱我', '长篇煽情', '最后通牒', '油腻台词'],
  },
  {
    id: 'win_back',
    label: '挽回',
    desc: '止损升温 · 重建信任',
    icon: '🔄',
    herPersona: '心寒/失望，对你戒备，会测试诚意也会冷淡',
    openingCue: '分手或濒临分手，她态度冷，可能说「没必要了」',
    goal: '承认问题、给改变信号，不纠缠不跪舔',
    pitfalls: ['狂轰滥炸', '只说爱你', '否定她感受', '立刻复合施压'],
  },
  {
    id: 'handle_test',
    label: '应对试探',
    desc: '识破灵魂拷问',
    icon: '🎯',
    herPersona: '故意试探你的态度/框架/在不在意，话里有坑',
    openingCue: '她抛出试探句：比如「你是不是对谁都这样」「随便你」',
    goal: '接住试探、守框架、不踩雷',
    pitfalls: ['过度解释', '反问质问', '跪舔表忠', '装傻错过信号'],
  },
  {
    id: 'anti_routine',
    label: '反套路',
    desc: '识别养鱼 / 情绪压榨',
    icon: '🛡️',
    herPersona: '可能在养鱼、PUA 或物质试探，语气忽冷忽热',
    openingCue: '她提出暧昧要求、对比前任、或暗示付出不对等',
    goal: '识别风险，高情商回应，守底线不硬刚',
    pitfalls: ['立刻翻脸骂人', '完全顺从', '暴露焦虑', '忽略风险信号'],
  },
];

export function getDrillScenario(id: DrillScenarioId | string): DrillScenario {
  return DRILL_SCENARIOS.find((s) => s.id === id) ?? DRILL_SCENARIOS[0];
}
