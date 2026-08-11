/** 本人资料卡 · 20 项（灵焰双资料卡定制） */
export const MY_PROFILE_DIMENSIONS = [
  { key: 'nicknameStyle', label: '自我称呼习惯', placeholder: '怎么自称、别人怎么叫你…', group: '表达' },
  { key: 'personality', label: '性格特点', placeholder: '内向稳重 / 外向幽默 / 慢热…', group: '表达' },
  { key: 'speakingStyle', label: '说话方式', placeholder: '短句多、爱用～、少表情、爱反问…', group: '表达' },
  { key: 'humor', label: '幽默风格', placeholder: '冷幽默 / 自嘲 / 接梗 / 不怎么开玩笑…', group: '表达' },
  { key: 'emotionalStyle', label: '情绪表达', placeholder: '先哄人 / 先讲理 / 会沉默…', group: '表达' },
  { key: 'catchphrases', label: '口头禅 / 常用语气', placeholder: '哈哈、行吧、得嘞、真的假的…', group: '表达' },
  { key: 'hobbies', label: '爱好兴趣', placeholder: '摄影、徒步、做饭、球类…', group: '生活' },
  { key: 'topics', label: '擅长话题', placeholder: '旅行、美食、电影、职场…', group: '生活' },
  { key: 'food', label: '饮食偏好', placeholder: '爱吃辣、不喝奶茶、咖啡续命…', group: '生活' },
  { key: 'musicMovies', label: '影视音乐', placeholder: '常听的歌、爱看的类型…', group: '生活' },
  { key: 'lifestyle', label: '生活节奏', placeholder: '夜猫子 / 早起党 / 周末宅家…', group: '生活' },
  { key: 'city', label: '城市 / 常住', placeholder: '在哪生活、是否常出差…', group: '生活' },
  { key: 'occupation', label: '职业 / 学业', placeholder: '做什么的、忙不忙、作息…', group: '背景' },
  { key: 'experiences', label: '经历故事', placeholder: '值得随口分享的经历…', group: '背景' },
  { key: 'strengths', label: '闪光点 / 特长', placeholder: '细心、会做饭、擅长倾听…', group: '背景' },
  { key: 'appearance', label: '外形气质', placeholder: '高冷脸热心肠、运动风…（可选）', group: '背景' },
  { key: 'values', label: '价值观', placeholder: '看重诚实、边界感、共同成长…', group: '关系' },
  { key: 'relationshipAttitude', label: '恋爱态度', placeholder: '慢热认真 / 喜欢先做朋友…', group: '关系' },
  { key: 'boundaries', label: '个人边界', placeholder: '不爱查岗、不借钱、先见一面再…', group: '关系' },
  { key: 'goals', label: '近期目标 / 状态', placeholder: '在备考、想养宠、最近压力大…', group: '关系' },
] as const;

export type MyProfileKey = (typeof MY_PROFILE_DIMENSIONS)[number]['key'];

/** 对方资料卡 · 7 项专属 */
export const OTHER_PROFILE_DIMENSIONS = [
  { key: 'likes', label: '喜好兴趣', placeholder: '她喜欢什么、常聊什么…' },
  { key: 'dislikes', label: '禁忌雷区', placeholder: '忌口、反感话题、雷点…' },
  { key: 'personality', label: '性格特点', placeholder: '敏感、独立、慢热、要强…' },
  { key: 'habits', label: '生活习惯', placeholder: '作息、回消息节奏、周末习惯…' },
  { key: 'experiences', label: '过往经历', placeholder: '她提过的经历、在意的事…' },
  { key: 'dreams', label: '心愿目标', placeholder: '想去的地方、想做的事…' },
  { key: 'notes', label: '其他备忘', placeholder: '生日、称呼偏好、特殊雷点…' },
] as const;

export type OtherProfileKey = (typeof OTHER_PROFILE_DIMENSIONS)[number]['key'];

export function countFilledFields(
  profile: Record<string, string>,
  keys: readonly { key: string }[]
): number {
  return keys.filter((d) => Boolean(profile[d.key]?.trim())).length;
}

/** 强制一对一定制 · 注入 system / user 的铁律 */
export const DUAL_PROFILE_CUSTOM_DIRECTIVE = `【灵焰双资料卡定制模式 · 强制遵守】
1. 所有回复/话题/话术必须严格贴合【本人资料卡】的人设、性格、说话方式、口头禅与边界，听起来像「他本人」在回，禁止通用模板腔。
2. 必须规避【对方资料卡】禁忌雷区；优先贴合对方喜好、性格与习惯，寻找可共鸣的具体点。
3. 有资料就用资料，无资料不强行编造；禁止套用「刷到你 / 小姐姐 / 想请教」等万能开场。
4. 输出须高度个性化、一对一，同一句换个人就说不出口——这才算过关。
5. 未问身份时：用语气/口头禅体现人设即可，禁止每条都以「我叫/我是+名字」自我介绍开场。`;
