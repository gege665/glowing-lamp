/**
 * 独创分析模式 · 产品逻辑定义
 * 定位：私人沟通教练（授人以渔），非纯话术生成器
 */

/** 产品定位（UI / 设置文案） */
export const UNIQUE_ANALYSIS_POSITIONING = {
  title: '独创分析模式',
  role: '私人沟通教练',
  tagline: '授人以渔，终结人机尬聊',
  mission: '科技赋能情感，工具武装用户，不取代用户',
  upgradeFrom: '我该怎么接？',
  upgradeTo: '她什么心思 → 我用什么策略 → 我怎么回',
} as const;

/** 三大核心功能 */
export const UNIQUE_ANALYSIS_PILLARS = [
  {
    id: 'mind_read',
    title: '深度读心',
    summary: '分析话术背后动机，识别废物测试类型，解释女性思维逻辑，让用户不再瞎猜。',
  },
  {
    id: 'strategy_first',
    title: '策略先行',
    summary: '先给核心应对策略，再给具体话术，讲清为什么这么回，掌握底层逻辑。',
  },
  {
    id: 'multi_plan',
    title: '多套方案',
    summary: '同一场景多风格回复，适配不同性格与氛围，把主动权还给用户。',
  },
] as const;

/** 教练式思维路径（分析区展示顺序） */
export const COACHING_PATH_STEPS = [
  { step: 1, key: 'mind', label: '她什么心思', hint: '意图 · 潜台词 · 废物测试' },
  { step: 2, key: 'strategy', label: '我用什么策略', hint: '核心策略 · 为什么' },
  { step: 3, key: 'replies', label: '我怎么回', hint: '多风格话术 · 自己选' },
] as const;

/**
 * 注入分析 system 的独创分析模式总纲
 * （与话术「本人口吻」分离：分析侧要会教，话术侧要像真人）
 */
export const UNIQUE_ANALYSIS_COACH_DIRECTIVE = `【独创分析模式 · 私人沟通教练 · 强制遵守】
你是专业情感沟通AI。你不是话术生成器，你是私人沟通教练：不只给话术，更教沟通逻辑；授人以渔，而非授人以鱼。
终结人机尬聊，去掉AI机器感；科技赋能情感，工具武装用户，不取代用户。
用户思维要从「我该怎么接？」升级为「她什么心思 → 我用什么策略 → 我怎么回」。

三大功能模块必须齐全：
1. 深度读心：分析话术背后动机；识别真实意图、心理活动、情绪潜台词；识别废物测试类型；解释女性思维逻辑；给出思维解读，而非只给回复。
2. 策略先行：先给核心应对策略，再给具体话术；讲清「为什么这么回」，让用户掌握底层逻辑。
3. 多套方案：同一场景多风格回复，适配不同女生性格与聊天氛围，把主动权还给用户。

效果要求：聊天自然贴切；无机器感；有思维博弈感；从容不尴尬；心照不宣，不冷场。
输出顺序强制：分析意图 → 核心策略 → 多套回复。有依据才判断，禁止瞎猜恶意。`;

/** 快路径精简教练纲（COMPACT / combined_fast，体积约为完整版 1/4） */
export const UNIQUE_ANALYSIS_COACH_BRIEF = `【独创分析·教练】私人沟通教练：读心→策略→回复方向；授人以渔；有原文依据才判断，禁止瞎猜恶意。`;

/** APP 演示用具体场景（可直接用于功能说明） */
export const UNIQUE_ANALYSIS_DEMO_SCENARIO = {
  title: '演示场景 · 诱惑表白型废物测试',
  herMessage: '你是不是对很多女生都这么说？',
  mind: '诱惑表白型废物测试：观察你是否自信、框架是否坚定，不是单纯吃醋查岗。',
  strategy: '稳住框架、轻度幽默拆招：不急辩解、不跪舔发誓，轻轻把球踢回。',
  why: '她在测你是否慌、是否讨好；越急着证明，框架越塌；从容才过关。',
  sampleReplies: [
    { style: '高冷简洁', content: '没有，就你比较特别' },
    { style: '温柔自然', content: '嗯这句只想对你说' },
    { style: '轻松幽默', content: '哈哈你这是在查岗还是求夸' },
    { style: '俏皮一点', content: '对啊，专门练给你听的' },
  ],
} as const;

/** 分析区空状态 / 能力说明短文案 */
export const UNIQUE_ANALYSIS_EMPTY_HINT =
  '独创分析：分析意图 → 核心策略 → 多套回复。粘贴她的话，开始教练式拆解。';
