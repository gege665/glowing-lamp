/**
 * 灵焰识图聊话题模式
 * 挖热点 · 兴趣 · 生活细节 · 情绪 · 图片回复 · 拓展话题
 */

export interface ImageTopicResult {
  sceneSummary: string;
  hotspots: string[];
  interests: string[];
  lifeDetails: string[];
  emotion: string;
  replies: string[];
  topics: string[];
  source: 'ai' | 'local';
  generatedAt: number;
}

const EMPTY_IMAGE_TOPIC: ImageTopicResult = {
  sceneSummary: '',
  hotspots: [],
  interests: [],
  lifeDetails: [],
  emotion: '',
  replies: [],
  topics: [],
  source: 'local',
  generatedAt: 0,
};

export const IMAGE_TOPIC_TEXT_SYSTEM = `你是「灵焰恋爱大师」识图聊话题助手。
根据对方配图配文（或画面描述），挖掘可聊热点、兴趣、生活细节与情绪，
生成自然不尴尬、能延伸的图片回复和拓展话题。只输出 JSON。`;

interface CaptionRule {
  re: RegExp;
  summary: string;
  hotspots: string[];
  interests: string[];
  lifeDetails: string[];
  emotion: string;
  replies: string[];
  topics: string[];
}

const CAPTION_RULES: CaptionRule[] = [
  {
    re: /猫|狗|宠物|柯基|布偶|猫咪|汪/,
    summary: '晒了毛孩子',
    hotspots: ['宠物日常', '性格反差', '铲屎官体验'],
    interests: ['养宠', '萌宠互动'],
    lifeDetails: ['家里有毛孩子', '愿意分享生活'],
    emotion: '轻松宠溺',
    replies: [
      '这也太会摆拍了吧，它平时更皮还是更乖？',
      '被可爱到了，它叫啥名？',
      '这表情我会一直回看😂',
    ],
    topics: ['它有没有特殊技能', '你是怎么决定养它的', '最近有没有闯祸名场面'],
  },
  {
    re: /咖啡|奶茶|蛋糕|火锅|好吃|美食|餐厅|探店|宵夜/,
    summary: '分享美食/探店',
    hotspots: ['口味偏好', '探店路线', '吃货共鸣'],
    interests: ['美食', '探店'],
    lifeDetails: ['愿意为吃打卡', '生活仪式感'],
    emotion: '满足开心',
    replies: [
      '看着就饿了，这是哪家？值得专程跑一趟吗？',
      '你这选品很稳，下次带我尝尝？开玩笑的～',
      '光看图已经开始流口水了。',
    ],
    topics: ['你更偏甜还是咸', '附近还有没有隐藏菜单', '周末有没有想挖的新店'],
  },
  {
    re: /海边|山|旅行|风景|日落|日出|打卡|景点|度假/,
    summary: '旅途/风景打卡',
    hotspots: ['旅行节奏', '风景瞬间', '出行偏好'],
    interests: ['旅行', '户外'],
    lifeDetails: ['在外面走走停停', '爱记录画面'],
    emotion: '放松向往',
    replies: [
      '这光线绝了，人在现场是不是更绝？',
      '看着就想请假，你是跟团还是自由行？',
      '这张适合当屏保，拍的时候风大吗？',
    ],
    topics: ['这趟最惊喜的点', '下次还想去哪', '路途上有没有小插曲'],
  },
  {
    re: /自拍|今天妆|新发型|镜子|穿搭|OOTD|好看吗/,
    summary: '自拍/穿搭分享',
    hotspots: ['今日状态', '穿搭灵感', '自信瞬间'],
    interests: ['穿搭', '审美'],
    lifeDetails: ['今天状态不错', '愿意被看见'],
    emotion: '自信轻松',
    replies: [
      '这套很加分，颜色很适合你。',
      '状态在线啊，今天有什么好事吗？',
      '好看，尤其是这个角度～',
    ],
    topics: ['这套是灵感还是随手搭', '有没有常穿的品牌', '周末一般怎么安排出门'],
  },
  {
    re: /加班|工位|上班|电脑|会议|忙死|社畜/,
    summary: '工作/加班现场',
    hotspots: ['忙里偷闲', '吐槽共鸣', '下班仪式'],
    interests: ['工作节奏'],
    lifeDetails: ['最近偏忙', '需要被接住'],
    emotion: '疲惫但还撑着',
    replies: [
      '看到工位就懂了，今天能早点收工吗？',
      '辛苦了，忙完奖励自己点啥？',
      '这氛围我熟，你先喝口水缓缓。',
    ],
    topics: ['今天最难熬的一段', '周末怎么回血', '有没有想甩的甩锅名场面'],
  },
  {
    re: /健身|跑步|瑜伽|骑行|球场|运动/,
    summary: '运动打卡',
    hotspots: ['运动习惯', '坚持动力', '身体状态'],
    interests: ['健身/运动'],
    lifeDetails: ['有固定运动节奏'],
    emotion: '充实有劲',
    replies: [
      '练完了？状态看着挺好。',
      '佩服能坚持的人，今天练了多久？',
      '这氛围很燃，下回挑战啥项目？',
    ],
    topics: ['你更爱力量还是有氧', '有没有训练小目标', '运动后固定补给是啥'],
  },
];

/** 仅配文/描述时的本地话题生成（无图兜底） */
export function buildLocalImageTopic(caption: string): ImageTopicResult {
  const text = caption.trim();
  const now = Date.now();
  if (!text) {
    return {
      ...EMPTY_IMAGE_TOPIC,
      sceneSummary: '等待上传图片或填写配文',
      hotspots: ['画面主体', '颜色氛围', '当下心情'],
      replies: ['这张图挺有感觉的，发生什么故事了？', '光看就想问一句：在干嘛呢～'],
      topics: ['这是哪里拍的', '当时心情怎么样', '有没有下一张更绝的'],
      emotion: '待观察',
      source: 'local',
      generatedAt: now,
    };
  }

  for (const rule of CAPTION_RULES) {
    if (rule.re.test(text)) {
      return {
        sceneSummary: rule.summary,
        hotspots: rule.hotspots,
        interests: rule.interests,
        lifeDetails: rule.lifeDetails,
        emotion: rule.emotion,
        replies: rule.replies,
        topics: rule.topics,
        source: 'local',
        generatedAt: now,
      };
    }
  }

  const snippet = text.replace(/[？?！!。.~～]/g, '').slice(0, 10);
  return {
    sceneSummary: `配文提到「${snippet || '日常'}」`,
    hotspots: ['配文细节', '当下心情', '为什么想发这张'],
    interests: ['生活分享'],
    lifeDetails: ['愿意晒日常瞬间'],
    emotion: '偏轻松',
    replies: [
      `「${snippet || '这张'}」看着挺有意思，后来怎样了？`,
      '收到，这张图挺生活的，你当时心情咋样？',
      '不错啊，还有后续吗？',
    ],
    topics: ['这是随手拍还是特意拍', '最近还有什么想分享的', '周末一般怎么过'],
    source: 'local',
    generatedAt: now,
  };
}

export function normalizeImageTopicResult(
  raw: Partial<ImageTopicResult> | null | undefined,
  source: 'ai' | 'local' = 'ai'
): ImageTopicResult {
  const list = (v: unknown, n = 4) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, n) : [];
  return {
    sceneSummary: String(raw?.sceneSummary ?? '').trim().slice(0, 40),
    hotspots: list(raw?.hotspots, 4),
    interests: list(raw?.interests, 3),
    lifeDetails: list(raw?.lifeDetails, 3),
    emotion: String(raw?.emotion ?? '').trim().slice(0, 20),
    replies: list(raw?.replies, 4),
    topics: list(raw?.topics, 4),
    source,
    generatedAt: Date.now(),
  };
}
