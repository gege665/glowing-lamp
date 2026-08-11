/** 用户在对方消息末尾标注的平台（如：…有事吗？抖音） */

export type SocialPlatformId =
  | 'douyin'
  | 'wechat'
  | 'soul'
  | 'xiaohongshu'
  | 'kuaishou'
  | 'qq'
  | 'unknown';

export interface SocialPlatformMeta {
  id: SocialPlatformId;
  label: string;
  aliases: string[];
  /** 该平台私信/私聊的语气特点 */
  toneHint: string;
  /** 陌生人警惕场景（你谁/什么事） */
  strangerInquiry: {
    psychNote: string;
    replyMust: string[];
    replyDont: string[];
    examples: string[];
  };
  /** 主动破冰首条私信（对方尚未回复时参考，勿照抄） */
  coldOpenTips: string[];
}

export const UNKNOWN_PLATFORM: SocialPlatformMeta = {
  id: 'unknown',
  label: '私聊',
  aliases: [],
  toneHint: '口语自然，紧扣对方原话',
  strangerInquiry: {
    psychNote: '先理解她在问什么、担心什么',
    replyMust: ['直接回应她的问题', '口语真人感'],
    replyDont: ['套话', '答非所问'],
    examples: [],
  },
  coldOpenTips: [],
};

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  {
    id: 'douyin',
    label: '抖音私信',
    aliases: ['抖音', 'dy', 'DY', 'Douyin'],
    toneHint: '短句、真实、不销售感；陌生人警惕高，必须先答清身份和事由',
    strangerInquiry: {
      psychNote:
        '抖音上对陌生私信戒备心强，她问「你谁/什么事」是在筛骚扰和推广，要先给安全感再聊别的',
      replyMust: [
        '先正面答「你是谁」（真实身份/怎么看到她）',
        '再正面答「什么事」（具体真实原因，一句话）',
        '承认私信突兀，语气稳、不油不装熟',
      ],
      replyDont: [
        '「路人/粉丝/就想打招呼」',
        '编造探店/合作等与她原话无关的事',
        '不答问题只顾寒暄',
        '长篇自我介绍',
      ],
      examples: [
        '抱歉打扰，我是看你前天那条跳舞视频关注的，简单说下为啥私信你',
        '你说得对，我该先说明白——我是做摄影的，觉得你内容风格合适才冒昧联系',
        '嗯，陌生人私信确实怪，我谁+为啥找你：…',
      ],
    },
    coldOpenTips: [
      '别上来就「你好呀」，先点明在哪看到她的哪条内容',
      '一句说清你是谁，一句说清为什么找她，留一个她能接的问题',
      '避免「合作」「互粉」等销售词，除非真是公事',
    ],
  },
  {
    id: 'wechat',
    label: '微信私聊',
    aliases: ['微信', 'vx', 'VX', 'wx', 'WX', 'WeChat'],
    toneHint: '像熟人微信随手回；若刚加好友，仍需先说明怎么认识的',
    strangerInquiry: {
      psychNote: '微信上加的好友她可能忘了是谁，需要快速唤醒记忆点',
      replyMust: ['说清怎么加到她微信的', '说清找她什么事', '语气自然不客服'],
      replyDont: ['「你好，在吗」', '不说明来源', '连环发问'],
      examples: [
        '我是那天XX群加你的，没别的，就想问下…',
        '可能你对我没印象，我是…，加你是因为…',
      ],
    },
    coldOpenTips: [
      '通过好友申请后第一条：谁+在哪认识的+什么事',
      '别发长语音式文字墙',
    ],
  },
  {
    id: 'soul',
    label: 'Soul 私聊',
    aliases: ['Soul', 'soul', 'SOUL'],
    toneHint: '可更松弛、有趣；但仍要接她情绪，别太正式',
    strangerInquiry: {
      psychNote: 'Soul 匿名感强，她可能试探你是否真诚、是否油腻',
      replyMust: ['接她语气', '真诚不装', '回答她的质疑或问题'],
      replyDont: ['官方腔', '土味撩', '查户口'],
      examples: [
        '哈哈被你问到了，我确实冒昧，简单说下…',
        '行，我先交代下我是谁再来聊',
      ],
    },
    coldOpenTips: ['可从她瞬间/标签找话题', '轻松但不轻浮'],
  },
  {
    id: 'xiaohongshu',
    label: '小红书私信',
    aliases: ['小红书', '红薯', 'xhs', 'XHS'],
    toneHint: '真诚、具体、尊重边界；常因笔记内容建立联系',
    strangerInquiry: {
      psychNote: '她担心广告或骚扰，需说明因哪篇笔记联系',
      replyMust: ['点明哪篇笔记/什么内容', '说清真实目的', '尊重她警惕'],
      replyDont: ['空泛夸赞', '一上来求微信', '不答「你谁」'],
      examples: [
        '看你那篇XX笔记才私信的，我是…，想…',
        '抱歉打扰，因你笔记里提到的…有点共鸣',
      ],
    },
    coldOpenTips: ['引用她笔记里的具体点', '别像品牌方话术'],
  },
  {
    id: 'kuaishou',
    label: '快手私信',
    aliases: ['快手', 'ks', 'KS'],
    toneHint: '接地气口语，别文绉绉；先答身份和事由',
    strangerInquiry: {
      psychNote: '与抖音类似，对陌生私信警惕',
      replyMust: ['先答你谁', '再答什么事', '口语短句'],
      replyDont: ['粉丝套话', '不答问题'],
      examples: ['看你直播/作品才找你的，简单说下…'],
    },
    coldOpenTips: ['提具体作品或直播内容'],
  },
  {
    id: 'qq',
    label: 'QQ 私聊',
    aliases: ['QQ', 'qq', 'Qq'],
    toneHint: '轻松直接，说明怎么加到QQ的',
    strangerInquiry: {
      psychNote: '可能忘了你是谁，需唤醒记忆',
      replyMust: ['说明来源', '说清事由'],
      replyDont: ['在吗', '不说明身份'],
      examples: ['我是XX群/同学介绍的…'],
    },
    coldOpenTips: ['说明加QQ渠道'],
  },
];

const PLATFORM_BY_ALIAS = new Map<string, SocialPlatformMeta>();
for (const p of SOCIAL_PLATFORMS) {
  for (const a of p.aliases) {
    PLATFORM_BY_ALIAS.set(a.toLowerCase(), p);
  }
}

export interface ParsedPlatformMessage {
  content: string;
  platform: SocialPlatformMeta;
  hadPlatformTag: boolean;
}

/** 解析末尾平台标注，如「你谁啊？抖音」「有事吗 微信」 */
export function parseMessageWithPlatform(raw: string): ParsedPlatformMessage {
  const trimmed = raw.trim();
  const defaultPlatform = UNKNOWN_PLATFORM;

  if (!trimmed) {
    return { content: '', platform: defaultPlatform, hadPlatformTag: false };
  }

  for (const meta of SOCIAL_PLATFORMS) {
    if (meta.id === 'unknown') continue;
    for (const alias of meta.aliases) {
      const re = new RegExp(
        `^(.+?)(?:[。.,，；;\\s]+)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[。.,，\\s]*$`,
        'i'
      );
      const m = trimmed.match(re);
      if (m && m[1].trim().length >= 1) {
        return {
          content: m[1].trim(),
          platform: meta,
          hadPlatformTag: true,
        };
      }
    }
  }

  return { content: trimmed, platform: defaultPlatform, hadPlatformTag: false };
}

export function buildPlatformScenarioDirective(
  parsed: ParsedPlatformMessage,
  intent: { asksIdentity: boolean; asksPurpose: boolean; isWary: boolean }
): string {
  const { content, platform, hadPlatformTag } = parsed;
  const lines = [
    `【平台场景 · ${platform.label}】${platform.toneHint}`,
  ];

  if (hadPlatformTag) {
    lines.push(`- 对方原话（已去掉末尾平台标注）：「${content}」`);
  }

  if (intent.asksIdentity || intent.asksPurpose || intent.isWary) {
    lines.push(`- 心理：${platform.strangerInquiry.psychNote}`);
    lines.push(`- 必须：${platform.strangerInquiry.replyMust.join('；')}`);
    lines.push(`- 禁止：${platform.strangerInquiry.replyDont.join('；')}`);
    if (platform.strangerInquiry.examples.length) {
      lines.push(
        `- 语气参考（须按她原话改写，勿照抄）：${platform.strangerInquiry.examples.join(' / ')}`
      );
    }
  }

  if (platform.coldOpenTips.length) {
    lines.push(`- 该平台私信原则：${platform.coldOpenTips.join('；')}`);
  }

  return lines.join('\n');
}

/** UI 快捷平台标签 */
export const PLATFORM_QUICK_TAGS = SOCIAL_PLATFORMS.filter((p) => p.id !== 'unknown').map(
  (p) => ({ id: p.id, tag: p.aliases[0] })
);
