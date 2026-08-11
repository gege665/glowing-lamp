import type { MyProfileCard, UserSettings } from '../types';

/** 高价值植入素材类别 */
export type HighValueAssetKind =
  | 'sparkle'
  | 'life'
  | 'values'
  | 'edge'
  | 'presence';

export interface HighValueAsset {
  kind: HighValueAssetKind;
  label: string;
  content: string;
}

export const HIGH_VALUE_KIND_META: Record<
  HighValueAssetKind,
  { title: string; hint: string }
> = {
  sparkle: { title: '个人闪光点', hint: '特长、经历、气质——用具体小事带出' },
  life: { title: '生活价值', hint: '节奏、爱好、日常质感——像随口分享' },
  values: { title: '三观魅力', hint: '态度、边界、恋爱观——轻描淡写显成熟' },
  edge: { title: '优势特质', hint: '性格与能力优势——体现在回应方式里' },
  presence: { title: '松弛气场', hint: '自信不紧绷——不讨好、不跪舔、不急着证明' },
};

/** 从本人资料卡抽取可植入的高价值素材 */
export function extractHighValueAssets(mp: MyProfileCard): HighValueAsset[] {
  const pick = (kind: HighValueAssetKind, label: string, raw?: string): HighValueAsset | null => {
    const content = raw?.trim();
    if (!content) return null;
    return { kind, label, content };
  };

  return [
    pick('sparkle', '闪光点 / 特长', mp.strengths),
    pick('sparkle', '经历故事', mp.experiences),
    pick('sparkle', '外形气质', mp.appearance),
    pick('life', '爱好兴趣', mp.hobbies),
    pick('life', '擅长话题', mp.topics),
    pick('life', '生活节奏', mp.lifestyle),
    pick('life', '职业 / 学业', mp.occupation),
    pick('life', '城市 / 常住', mp.city),
    pick('life', '饮食偏好', mp.food),
    pick('life', '影视音乐', mp.musicMovies),
    pick('life', '近期目标', mp.goals),
    pick('values', '价值观', mp.values),
    pick('values', '恋爱态度', mp.relationshipAttitude),
    pick('values', '个人边界', mp.boundaries),
    pick('edge', '性格特点', mp.personality),
    pick('edge', '说话方式', mp.speakingStyle),
    pick('edge', '幽默风格', mp.humor),
    pick('edge', '情绪表达', mp.emotionalStyle),
    pick('presence', '口头禅 / 语气', mp.catchphrases),
  ].filter((a): a is HighValueAsset => Boolean(a));
}

export function groupHighValueAssets(
  assets: HighValueAsset[]
): Record<HighValueAssetKind, HighValueAsset[]> {
  const groups: Record<HighValueAssetKind, HighValueAsset[]> = {
    sparkle: [],
    life: [],
    values: [],
    edge: [],
    presence: [],
  };
  for (const a of assets) groups[a.kind].push(a);
  return groups;
}

/** 植入手法示例（UI 展示） */
export const HIGH_VALUE_TACTICS = [
  {
    id: 'sideDrop',
    title: '侧面带出',
    tip: '不说「我很会XX」，改成「周末顺手做了顿面，咸淡刚好」——用结果代替自我评价。',
  },
  {
    id: 'sharedFrame',
    title: '共鸣再亮点',
    tip: '先接住对方情绪/话题，再轻轻挂上自己的生活切片，像顺嘴一提，不抢戏。',
  },
  {
    id: 'boundarySoft',
    title: '软边界显价值',
    tip: '忙时如实说安排，约不到就给替代方案；有态度但不冰冷，依赖感来自可靠而非粘人。',
  },
  {
    id: 'humorSelf',
    title: '轻自嘲松弛',
    tip: '偶尔自嘲一点小笨拙，反而衬出自信；禁止油腻夸自己、禁止凡尔赛。',
  },
  {
    id: 'invitePull',
    title: '邀请式推进',
    tip: '用「你要不要…」「下次可以…」留开口，不逼问、不查岗，让对方想靠近。',
  },
] as const;

/** 灵焰高价值聊天模式 · 强制指令 */
const LINGYAN_HIGH_VALUE_DIRECTIVE = `【灵焰高价值聊天模式 · 强制遵守】
目标：在聊天中自然植入用户的个人闪光点、生活价值、三观魅力与优势特质，塑造自信、松弛、有吸引力的人设，提升对方好感与依赖感。

硬性规则：
1. 自然不刻意：价值信息像随口分享的生活切片，禁止自我介绍式罗列、禁止「其实我挺…」硬广。
2. 不装逼不油腻：禁止凡尔赛、炫耀金钱地位外貌、禁止油腻撩法与跪舔讨好。
3. 自信松弛：语气从容有边界；可温柔可幽默，但不急着证明自己、不卑微追问。
4. 有资料用资料：优先使用【本人资料卡】里的闪光点/价值观/生活细节；无资料则用普适松弛感与态度优势，禁止编造虚假履历。
5. 频率克制：每条回复最多自然带出 0～1 个价值点；多数时候先接住对方，再偶尔侧写自己。
6. 提升依赖：可靠、有节奏、会留钩子（具体小事/下次可聊点），而不是制造焦虑或冷暴力。

话术气质：像一个过得不错、对自己很清楚、聊天轻松的人——对方愿意多回一句。`;

/** 注入 AI 的高价值素材块 */
export function buildHighValuePromptBlock(settings: UserSettings): string {
  const assets = extractHighValueAssets(settings.myProfile);
  const lines: string[] = [LINGYAN_HIGH_VALUE_DIRECTIVE];

  if (assets.length) {
    const grouped = groupHighValueAssets(assets);
    const sections: string[] = [];
    (Object.keys(grouped) as HighValueAssetKind[]).forEach((kind) => {
      const list = grouped[kind];
      if (!list.length) return;
      const meta = HIGH_VALUE_KIND_META[kind];
      sections.push(
        `${meta.title}：\n${list.map((a) => `- ${a.label}：${a.content}`).join('\n')}`
      );
    });
    lines.push(
      `【可植入素材 · 择机侧面带出，勿堆砌】\n${sections.join('\n')}`
    );
  } else {
    lines.push(
      '【可植入素材】本人资料卡暂缺闪光点细节——用态度、边界、节奏与松弛感体现高价值，并暗示用户去「我的」补全资料卡。'
    );
  }

  return lines.join('\n\n');
}
