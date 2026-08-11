/** 灵焰全分类话术工坊 · 12 大场景库 */

export type WorkshopCategoryId =
  | 'ice_open'
  | 'daily_continue'
  | 'flirt_pull'
  | 'warm_push'
  | 'date_invite'
  | 'confess'
  | 'apology'
  | 'cold_fix'
  | 'win_back'
  | 'meme_interact'
  | 'high_value'
  | 'polite_roast';

export interface WorkshopCategory {
  id: WorkshopCategoryId;
  label: string;
  shortLabel: string;
  desc: string;
  icon: string;
  /** 生成指令 */
  prompt: string;
  /** 忌讳 */
  avoid: string[];
  /** 本地优质样例库（无 API / 兜底） */
  bank: string[];
  keywords: string[];
}

export const WORKSHOP_CATEGORIES: WorkshopCategory[] = [
  {
    id: 'ice_open',
    label: '开场破冰',
    shortLabel: '破冰',
    desc: '第一句不尬 · 高开启率',
    icon: '👋',
    prompt: '刚认识/刚通过好友，生成自然破冰短句，轻、稳、不查户口、不油。',
    avoid: ['客服腔', '长篇自我介绍', '查户口', '土味夸'],
    keywords: ['破冰', '开场', '刚加', '第一句', '打招呼', '搭讪'],
    bank: [
      '通过了，头像挺有辨识度的～',
      '嗨，刚加上，不打扰的话聊两句？',
      '可算加上了，手速可以啊😏',
      '你好呀，看你挺有意思的，来认识一下。',
      '嗨～别紧张，就想正常认识你。',
    ],
  },
  {
    id: 'daily_continue',
    label: '日常续聊',
    shortLabel: '续聊',
    desc: '接住冷场 · 轻松延展',
    icon: '💬',
    prompt: '日常私信续聊，接上文或抛轻松好接的话题，像真人微信随手回。',
    avoid: ['在吗', '忙吗', '连环问', '查户口'],
    keywords: ['续聊', '日常', '冷场', '没话题', '接着聊'],
    bank: [
      '突然不知道说啥了😂你今天遇到啥好笑的没？',
      '对了，你上次说的那事后来怎样了？',
      '我刚路过一家店，突然想起你可能会喜欢。',
      '二选一：今天想听八卦还是听我闯祸？',
      '你忙的话我先闪，有空再来找你～',
    ],
  },
  {
    id: 'flirt_pull',
    label: '暧昧拉扯',
    shortLabel: '暧昧',
    desc: '心动留白 · 分寸撩动',
    icon: '💘',
    prompt: '暧昧阶段轻撩拉扯，留想象空间，不表白不油腻不土味。',
    avoid: ['过早表白', '油腻土味', '压迫感'],
    keywords: ['暧昧', '拉扯', '撩', '心动', '暧昧期'],
    bank: [
      '你再这样回我，我可要误会了～',
      '这句话有点危险，我认真听了。',
      '行，那我假装没听懂你的意思。',
      '你是不是故意的？挺会的啊。',
      '半真半假的，你猜我偏哪边。',
    ],
  },
  {
    id: 'warm_push',
    label: '升温推拉',
    shortLabel: '推拉',
    desc: '松紧有度 · 制造惦记',
    icon: '🔥',
    prompt: '推拉升温：先给一点温度再留白，制造惦记，不舔不追。',
    avoid: ['跪舔', '连环轰炸', '强行升温'],
    keywords: ['推拉', '升温', '欲擒故纵', '惦记', '框架'],
    bank: [
      '今天聊得挺开心，我先去忙啦，想我了再说。',
      '嗯，被你这句话砸到了，缓缓再回你。',
      '行，那你先忙，我也不空耗着。',
      '有点想继续聊，但留一点明天也不错。',
      '你这样挺加分的，我就说这一句。',
    ],
  },
  {
    id: 'date_invite',
    label: '约会邀约',
    shortLabel: '邀约',
    desc: '具体不施压 · 好拒绝也好答应',
    icon: '☕',
    prompt: '自然邀约见面：给具体时间/活动选项，语气可拒绝，不逼问。',
    avoid: ['什么时候有空', '赏个脸', '必须来'],
    keywords: ['约会', '邀约', '见面', '出来', '约咖啡'],
    bank: [
      '周末下午有空吗，想请你喝杯咖啡，不去也没关系。',
      '这周六或周日，你更方便哪天？短局就行。',
      '附近新开了家店，想拉你去尝，你敢不敢？',
      '有空出来走走吗，不用正装，随便逛逛。',
      '给你两个选项：咖啡 or 散步，你挑一个。',
    ],
  },
  {
    id: 'confess',
    label: '真诚表白',
    shortLabel: '表白',
    desc: '清晰真诚 · 不绑架',
    icon: '💗',
    prompt: '真诚表白心意，短、清晰、留空间，不煽情绑架、不最后通牒。',
    avoid: ['逼问爱不爱', '长篇煽情', '最后通牒'],
    keywords: ['表白', '告白', '喜欢你', '在一起', '确定关系'],
    bank: [
      '直说吧，我挺喜欢你的，想认真试试。',
      '跟你聊天会安心，我想把你放进未来里。',
      '不是玩笑：我对你动心了，你怎么看？',
      '我想当你的选项里认真的那一个。',
      '喜欢你这件事，我想说清楚，不催你回答。',
    ],
  },
  {
    id: 'apology',
    label: '道歉哄人',
    shortLabel: '哄人',
    desc: '先共情再认错 · 不跪不辩',
    icon: '🥺',
    prompt: '道歉哄人：先接情绪再认具体错，温柔有担当，不假道歉不抬杠。',
    avoid: ['先辩解', '你也有错', '假道歉', '翻旧账'],
    keywords: ['道歉', '哄', '生气', '对不起', '安抚'],
    bank: [
      '是我不好，让你不舒服了，对不起。',
      '你别憋着，气我认，错我也改。',
      '好啦别气了，先抱抱你，剩下的我听你说。',
      '我刚才那句伤到你了，收回，重新来。',
      '乖，别想太多，有我在，先消消气。',
    ],
  },
  {
    id: 'cold_fix',
    label: '冷战修复',
    shortLabel: '冷战',
    desc: '给台阶 · 不卑微',
    icon: '🧊',
    prompt: '冷战破冰：温和给台阶，不质问不理人，不跪舔不威胁。',
    avoid: ['为什么不理我', '卑微讨好', '威胁分手'],
    keywords: ['冷战', '修复', '不理人', '断联', '破冰重连'],
    bank: [
      '冷静这几天我也想清楚了，想好好跟你说一声。',
      '不追问了，你要是还愿意聊，我在。',
      '台阶我铺好了，你想下就下，不想也没关系。',
      '之前那事是我不对，想修复，不逼你立刻回。',
      '嗨，还生我气吗？不生气的话回个表情也行。',
    ],
  },
  {
    id: 'win_back',
    label: '挽回复合',
    shortLabel: '挽回',
    desc: '认错给改变 · 不纠缠',
    icon: '🔄',
    prompt: '挽回：承认问题、给具体改变信号，不狂轰滥炸、不否定她感受。',
    avoid: ['狂轰滥炸', '只说爱你', '立刻复合施压'],
    keywords: ['挽回', '复合', '分手', '求复合', '挽回期'],
    bank: [
      '我不求你立刻原谅，只想让你看到我在改。',
      '失去你之后我才懂错在哪，想争取一次机会。',
      '你可以慢慢考虑，我会用行动说话，不吵不缠。',
      '以前太自我，这次我想把安全感给你。',
      '如果还留一点可能，我想认真修。',
    ],
  },
  {
    id: 'meme_interact',
    label: '接梗互动',
    shortLabel: '接梗',
    desc: '好笑不尬 · 接得住',
    icon: '😂',
    prompt: '接梗互动：轻松搞笑、接得住梗，不低俗不尬捧。',
    avoid: ['硬凹幽默', '低俗玩笑', '无视对方梗'],
    keywords: ['接梗', '搞笑', '幽默', '玩梗', '互动'],
    bank: [
      '这梗我接了，下一句你负责笑场。',
      '行，你赢，我笑出猪叫了。',
      '你这是在考验我的接梗能力吗？通过。',
      '哈哈哈可以，再来一个我看看。',
      '被你这条消息炸出来了，梗不错。',
    ],
  },
  {
    id: 'high_value',
    label: '高价值展示',
    shortLabel: '价值',
    desc: '自然露一手 · 不装不炫',
    icon: '✨',
    prompt:
      '高价值展示：结合本人资料卡，用具体小事自然体现能力/态度/边界与生活质感；自信松弛，不炫耀不编造不油腻，每条最多侧写一个价值点。',
    avoid: ['炫富', '编造经历', '自我吹嘘'],
    keywords: ['高价值', '展示', '优势', '魅力', '人设'],
    bank: [
      '我这人做事有始有终，答应你的会办到。',
      '忙归忙，重要的人我会专门留时间。',
      '我不爱解释太多，用结果说话比较准。',
      '圈子不大，但相处起来我比较省心。',
      '我习惯把事情安排明白，再轻松去玩。',
    ],
  },
  {
    id: 'polite_roast',
    label: '礼貌反怼',
    shortLabel: '反怼',
    desc: '守框架 · 不凶不伤人',
    icon: '🛡️',
    prompt: '礼貌反怼：被调侃/试探/冒犯时，高情商回击，守框架不骂不伤人。',
    avoid: ['脏话辱骂', '翻脸硬刚', '过度解释'],
    keywords: ['反怼', '怼回去', '反击', '被嘲', '被试探'],
    bank: [
      '你这句挺会的，我也学着点，下回回敬你。',
      '可以啊，那我当真了你可别怂。',
      '调侃我可以，但分寸我有数。',
      '你开心就好，认真我也可奉陪。',
      '这波我认，下一波轮到你接。',
    ],
  },
];

export function getWorkshopCategory(id: WorkshopCategoryId | string): WorkshopCategory {
  return WORKSHOP_CATEGORIES.find((c) => c.id === id) ?? WORKSHOP_CATEGORIES[0];
}

/** 根据用户口述场景匹配分类 */
export function matchWorkshopCategory(sceneText: string): WorkshopCategoryId {
  const t = sceneText.trim();
  if (!t) return 'daily_continue';
  let best: WorkshopCategoryId = 'daily_continue';
  let score = 0;
  for (const c of WORKSHOP_CATEGORIES) {
    let s = 0;
    for (const kw of c.keywords) {
      if (t.includes(kw)) s += kw.length;
    }
    if (t.includes(c.label)) s += 10;
    if (s > score) {
      score = s;
      best = c.id;
    }
  }
  return best;
}

export const WORKSHOP_SYSTEM_PROMPT = `你是「灵焰恋爱大师」全分类话术工坊。
用户指定场景分类后，输出恰好 5 条可直接发送的优质中文口语短句。
铁律：
- 像真人微信随手打，15～35 字为宜（更短模式可 8～18 字）
- 贴合分类气质，明显不同开头，无套路客服腔
- 禁止编号、标签前缀、说明、思考过程
- 只输出 JSON：{"lines":["话术1","话术2","话术3","话术4","话术5"]}`;

export function buildWorkshopUserPrompt(opts: {
  categoryId: WorkshopCategoryId;
  sceneNote?: string;
  toneNote?: string;
  lastOther?: string;
  myNickname?: string;
}): string {
  const c = getWorkshopCategory(opts.categoryId);
  return `【话术工坊 · ${c.label}】
【分类说明】${c.prompt}
【忌讳】${c.avoid.join('、')}
【用户场景描述】${opts.sceneNote?.trim() || '（未额外描述，按分类标准输出）'}
【语气微调】${opts.toneNote?.trim() || '自然口语'}
【对方最近一句】${opts.lastOther?.trim() || '（无）'}
【用户昵称】${opts.myNickname || '我'}

请生成恰好 5 条可直接发送的「${c.label}」话术。
输出 JSON：{"lines":["...","...","...","...","..."]}`;
}

/** 本地库洗牌取 N 条 */
export function pickWorkshopBank(
  categoryId: WorkshopCategoryId,
  count = 5,
  sceneNote?: string
): string[] {
  const c = getWorkshopCategory(categoryId);
  const pool = [...c.bank];
  // 简单洗牌
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const lines = pool.slice(0, count);
  // 若有场景备注，在首条轻微贴边（不改语义，仅作提示性不注入）
  if (sceneNote?.trim() && lines[0] && sceneNote.length < 20) {
    /* keep bank pure */
  }
  while (lines.length < count) {
    lines.push(c.bank[lines.length % c.bank.length]);
  }
  return lines;
}
