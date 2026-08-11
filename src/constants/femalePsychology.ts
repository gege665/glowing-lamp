/**
 * 女性心理学知识库 + 日常社交场景话术指引
 * 用于 AI 分析提示、话术生成与用户参考展示
 */

export type SocialScenarioId =
  | 'strangerInquiry'
  | 'greeting'
  | 'opinion'
  | 'conflict'
  | 'support'
  | 'flirt'
  | 'boundary';

export interface SocialScenario {
  id: SocialScenarioId;
  label: string;
  keywords: string[];
  psychFocus: string;
  commPrinciples: string[];
  replyDos: string[];
  replyDonts: string[];
  examples: string[];
}

/** 注入 AI 的精简知识块（控制 token） */
export const FEMALE_PSYCHOLOGY_PROMPT_BLOCK = `【女性心理学分析框架 · 须融入报告与话术】
■ 基础理论要点
- 情绪优先于逻辑：先接情绪再讲道理，否则易触发防御
- 关系型思维：常通过细节、语气、回应速度判断「是否被重视」
- 安全感需求：稳定、可预期、不被评判的回应能打开沟通
- 被看见需求：希望具体被理解（「你是因为…才这样」），讨厌空泛安慰
- 边界与尊重：不喜欢被说教、被催、被当问题解决对象

■ 情感需求特点（常见优先级）
被理解 > 被陪伴 > 被认可 > 被保护 > 被引领（因人而异，分析时判断当前最缺哪一项）

■ 沟通模式差异（相对常见倾向，勿刻板化）
- 倾向间接表达、试探性发言、用「算了/没事」掩饰真实需求
- 冲突时可能先情绪后事实；需要对方先表态「站哪边/什么态度」
- 分享琐事有时是「求关注」而非「求方案」

■ 分析时必须输出 femalePsychology 字段；话术须匹配识别出的 socialScenario`;

export const SOCIAL_SCENARIOS: SocialScenario[] = [
  {
    id: 'strangerInquiry',
    label: '陌生人警惕/身份核实',
    keywords: [
      '你谁',
      '你是谁',
      '哪位',
      '什么事',
      '干嘛',
      '有事',
      '请问',
      '认识吗',
      '陌生人',
      '怎么加',
      '哪来的',
      '骚扰',
      '莫名其妙',
    ],
    psychFocus: '对陌生人搭讪保持警惕，需先确认身份与安全，反感被糊弄或不答问题',
    commPrinciples: ['先答她问的', '简明不绕弯', '承认突兀给台阶', '尊重边界不施压'],
    replyDos: [
      '先自报身份再说话由',
      '直接回应「你谁/什么事」',
      '承认唐突+说明真实原因',
      '语气稳、不反问压迫',
    ],
    replyDonts: [
      '不答「你谁」',
      '空泛「就想打招呼」',
      '路人粉丝套话',
      '反问「你呢」',
    ],
    examples: [
      '抱歉唐突，我是看你昨天那条舞蹈关注的，简单说下原因…',
      '你说得对，我该先说明白——我是…，加你是因为…',
      '嗯，陌生人找你确实怪，我直接说：…',
    ],
  },
  {
    id: 'greeting',
    label: '日常问候',
    keywords: ['在吗', '干嘛', '吃了吗', '早安', '晚安', '忙吗', '睡了吗', '你好'],
    psychFocus: '低压力开启话题，测试对方是否愿意接话、是否在意自己',
    commPrinciples: ['轻松不审问', '带一点专属感', '留可接的话口'],
    replyDos: ['回状态+反问', '加一句小情绪或细节', '语气随意像朋友'],
    replyDonts: ['只回「嗯」', '像客服', '连环追问'],
    examples: [
      '刚忙完，你呢，今天顺利吗？',
      '在呢，正准备摸鱼，你找我有事还是单纯想我？',
      '早，昨晚睡够了吗？',
    ],
  },
  {
    id: 'opinion',
    label: '意见表达',
    keywords: ['我觉得', '是不是', '你怎么看', '对不对', '应该', '要不'],
    psychFocus: '希望被认真听见，而非被否定或立刻纠正',
    commPrinciples: ['先认可再补充', '用「我感受」代替「你不对」', '给选择权'],
    replyDos: ['复述她的观点再回应', '表示理解立场', '温和补充不同角度'],
    replyDonts: ['直接否定', '讲大道理', '胜负欲辩论'],
    examples: [
      '你这个角度我想过，确实有道理，我这边还想到一点…',
      '嗯，我懂你为什么这么想，要是我可能也会介意。',
      '可以啊，你定，我配合你。',
    ],
  },
  {
    id: 'conflict',
    label: '冲突处理',
    keywords: ['生气', '烦', '算了', '随便', '你每次都', '不想说', '冷战', '误会'],
    psychFocus: '情绪未平复时讲道理无效；需要先确认态度和在意',
    commPrinciples: ['先降温再讨论', '承担可承担的部分', '不翻旧账'],
    replyDos: ['承认她的感受', '短句表态', '给台阶和冷静空间'],
    replyDonts: ['「你想多了」', '讲道理', '比惨', '冷处理'],
    examples: [
      '这事是我没做好，你先别急，我们慢慢说。',
      '你生气我能理解，我现在更想知道你怎么了。',
      '行，先缓缓，你想聊了我在这。',
    ],
  },
  {
    id: 'support',
    label: '情感支持',
    keywords: ['委屈', '难过', '崩溃', '压力', '累', '疼', '哭', '没人', '孤独', '出口'],
    psychFocus: '需要陪伴与验证，而非立刻解决方案',
    commPrinciples: ['共情优先', '不问审问式为什么', '表达「我在」'],
    replyDos: ['具体共情', '允许沉默', '轻问是否想多说'],
    replyDonts: ['「别想了」', '比惨', '给未经请求的建议'],
    examples: [
      '听着就挺累的，你不用硬撑，我在。',
      '有些委屈确实只能憋着，我看得出你这话不是随便说的。',
      '你想说多少说多少，不逼你。',
    ],
  },
  {
    id: 'flirt',
    label: '暧昧互动',
    keywords: ['想你', '喜欢', '干嘛呢', '哼', '讨厌', '哼', '仅你', '见面', '照片'],
    psychFocus: '享受被特别对待，同时需要安全感与不被轻视',
    commPrinciples: ['推拉有度', '细节专属', '不油不跪'],
    replyDos: ['接梗+留悬念', '专属称呼或细节', '适度主动'],
    replyDonts: ['过度舔', '开黄腔', '忽冷忽热无原因'],
    examples: [
      '你这句，我只想说——我在。',
      '行，那我不追问了，看你忍不忍得住。',
      '就你这句，有点会啊。',
    ],
  },
  {
    id: 'boundary',
    label: '边界与节奏',
    keywords: ['慢点', '还没', '别这样', '太快', '不熟', '朋友', '考虑'],
    psychFocus: '需要被尊重节奏，强迫会触发退缩',
    commPrinciples: ['尊重表态', '不退不逼', '保持吸引力'],
    replyDos: ['接受节奏', '表达耐心', '保持轻松框架'],
    replyDonts: ['追问为什么', '道德绑架', '消失报复'],
    examples: [
      '好，按你的节奏来，我不急。',
      '我懂，边界感我尊重，你想聊的时候我在。',
      '行，朋友也行，但我对你印象挺好的。',
    ],
  },
];

/** 根据对方最后一条消息推断社交场景 */
export function detectSocialScenario(text: string): SocialScenario {
  const t = text.trim();
  if (!t) return SOCIAL_SCENARIOS[0];

  let best = SOCIAL_SCENARIOS[0];
  let bestScore = 0;

  for (const scenario of SOCIAL_SCENARIOS) {
    let score = 0;
    for (const kw of scenario.keywords) {
      if (t.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = scenario;
    }
  }

  return bestScore > 0 ? best : SOCIAL_SCENARIOS[1]; // 默认日常问候
}

/** UI 参考：女性心理学核心知识点 */
export const FEMALE_PSYCHOLOGY_REFERENCE = {
  theory: [
    '情绪脑优先：感受被接住后，理性沟通才有效',
    '关系信号敏感：回复速度、语气、是否追问细节，都会被解读为「在不在意我」',
    '依恋风格影响表达：焦虑型易试探，回避型易说「没事」，安全型更直接',
  ],
  needs: [
    '被看见：具体理解她的处境与情绪，而非空泛「我懂」',
    '安全感：态度稳定、可预期、不突然消失或变脸',
    '被尊重：不被说教、不被当项目修理、节奏不被强行推进',
    '专属感：细节、偏爱、「只对你这样」的微妙表达',
  ],
  commDiff: [
    '间接表达多：「算了」可能是求挽留，「随便」可能是失望',
    '分享≠求方案：先说「听起来确实难」再问要不要建议',
    '冲突时先态度后道理：「我站你这边」比「其实你可以…」更有效',
  ],
};
