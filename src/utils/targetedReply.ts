import {
  parseMessageWithPlatform,
  buildPlatformScenarioDirective,
} from '../constants/socialPlatforms';
import { getIntimateBoundaryAnalysisAppend } from '../constants/promptTemplates';

/** 根据对方最后一条消息，生成「必须针对性回应」的硬性指令 */

export interface MessageIntent {
  asksIdentity: boolean;
  asksPurpose: boolean;
  asksSource: boolean;
  isWary: boolean;
  isQuestion: boolean;
  keywords: string[];
}

/** 去掉末尾平台标注后分析意图 */
export function getMessageContentForAnalysis(text: string): string {
  return parseMessageWithPlatform(text).content;
}

/** 对方仅表示通过好友/已添加，实质是「刚加好友」开场 */
export function isFriendApprovalMessage(text: string): boolean {
  const t = getMessageContentForAnalysis(text).trim();
  if (!t || t.length > 18) return false;
  return /^(通过了|已添加|已同意|添加成功|我们已经是好友|已成为好友|你好呀?|嗨|在吗)[。!！?？~～]*$/i.test(
    t
  );
}

export function detectMessageIntent(text: string): MessageIntent {
  const t = getMessageContentForAnalysis(text);
  const asksIdentity = /你谁|你是谁|哪位|哪位的|什么人/.test(t);
  const asksPurpose = /什么事|干嘛|有何|有事|什么事吗|请问|啥事|做什么/.test(t);
  const asksSource = /抖音|小红书|微信|怎么加|哪来的|通过什么|哪里看到/.test(t);
  const isWary = /警惕|打扰|骚扰|莫名其妙|奇怪|不熟|陌生人|谁啊/.test(t);
  const isQuestion = /[?？吗|呢|啥|什么|谁|干嘛|为何|为什么]/.test(t);

  const keywords: string[] = [];
  const patterns: [RegExp, string][] = [
    [/你谁|你是谁/g, '你谁'],
    [/什么事|干嘛|有何事/g, '什么事'],
    [/请问/g, '请问'],
    [/抖音/g, '抖音'],
    [/有事/g, '有事'],
    [/打扰/g, '打扰'],
    [/认识/g, '认识'],
  ];
  for (const [re, label] of patterns) {
    if (re.test(t) && !keywords.includes(label)) keywords.push(label);
  }

  return { asksIdentity, asksPurpose, asksSource, isWary, isQuestion, keywords };
}

/** 分析步骤：紧扣对方原话的指令 */
export function buildAnalysisLastMessageFocus(
  lastOther: string,
  relationshipStages: string[] = []
): string {
  if (!lastOther.trim()) return '';
  const parsed = parseMessageWithPlatform(lastOther);
  const intent = detectMessageIntent(lastOther);
  const core = parsed.content;
  const lines = [
    parsed.hadPlatformTag
      ? `【平台】${parsed.platform.label}（用户已在消息末尾标注）`
      : '',
    `【针对性分析 · 最高优先级】对方最后一句原话：「${core}」`,
    '- 分析必须逐点回应她这句话在问什么、担心什么、要什么态度',
    '- summary / subtext / scenarioTip 必须引用她话里的关键词，禁止泛泛总结',
    '- deepReport 的「潜台词」须写：她真正想先听到你怎么回答',
  ];
  if (intent.keywords.length) {
    lines.push(`- 她话里的关键词：${intent.keywords.join('、')}，分析各字段须围绕这些词展开`);
  }
  if (intent.asksIdentity) {
    lines.push('- 她在核实身份：psychology.mentalState 写她需要确认什么；scenarioTip 写应先怎么自报身份');
  }
  if (intent.asksPurpose) {
    lines.push('- 她在问事由：strategy.nextMove 写应直接说明什么目的，不绕弯');
  }
  if (intent.isWary) {
    lines.push('- 她有防备：emotion 体现警惕/边界；warnings 写不能做的事（糊弄、施压、不答问题）');
  }
  if (parsed.hadPlatformTag) {
    lines.push(`- femalePsychology.socialScenario 须体现「${parsed.platform.label}」场景特点`);
    lines.push(`- scenarioTip 须符合该平台：${parsed.platform.strangerInquiry.psychNote.slice(0, 40)}…`);
  }
  const intimateFocus = getIntimateBoundaryAnalysisAppend(lastOther, relationshipStages);
  if (intimateFocus) {
    lines.push(intimateFocus);
  }
  return lines.filter(Boolean).join('\n');
}

/** 话术步骤：必须正面回应的指令（含平台场景） */
export function buildMessageSpecificDirective(
  lastOther: string,
  chatScene?: string
): string {
  if (!lastOther.trim()) return '';
  const parsed = parseMessageWithPlatform(lastOther);
  const intent = detectMessageIntent(lastOther);
  const platformBlock = buildPlatformScenarioDirective(parsed, intent);
  const must: string[] = [];

  if (isFriendApprovalMessage(lastOther) || chatScene === 'first_add') {
    return `${platformBlock}

【刚加好友 · 第一条】对方「${parsed.content || lastOther}」= 已通过，发短句破冰。
- 8～18 字，轻撩但不油，稳、不查户口
- 可夸头像/昵称，留一点悬念让她好接
- 禁止：终于等到你通过、想多了解你、熟悉一下、今天过得怎么样
- 暧昧例：通过了，有点想认识你～
- 幽默例：可算加上了，手速可以啊😏
- 温柔例：嗨～头像挺好看
- 禁止照抄，学语气`;
  }

  if (intent.asksIdentity) {
    must.push('她问了「你是谁」→ 每条须先简明自报身份（我是谁/怎么认识她），不能只打招呼');
  }
  if (intent.asksPurpose) {
    must.push('她问了「什么事」→ 每条须直接说找她什么事/什么目的，禁止「没事/随便聊聊/就想打招呼」糊弄');
  }
  if (intent.asksSource) {
    must.push('她提到平台/来源 → 须说明怎么看到她的、为什么联系，与她的原话一致');
  }
  if (intent.isWary) {
    must.push('她有警惕/边界 → 先承认突兀或尊重她的质疑，不施压、不反问她、不装熟');
  }
  if (intent.isQuestion && must.length === 0) {
    must.push('她在提问 → 每条须先回答她的问题，再带态度，禁止答非所问');
  }

  const core = parsed.hadPlatformTag ? parsed.content : lastOther;

  if (must.length === 0) {
    return `${platformBlock}

【针对性接话】必须紧扣原话「${core}」里的具体词句和情绪回应，禁止编造无关话题。`;
  }

  const exampleBlock =
    intent.asksIdentity && intent.asksPurpose
      ? `
【真人好示例 · 接「你谁？什么事？抖音」· 禁止照抄，学结构和口语感】
- 陌生消息确实容易懵，我 XX，看你那条视频有个点想聊（初识，稳）
- 问得对，XX 一枚，就你发的那条想夸夸（初识，直）
- 哈哈别急着拉黑，XX，看你抖音觉得挺有意思（初识，皮）
- XX，有事，一句话（初识，短）
【坏示例 · 出现即失败】
- 我是刷到你抖音的，没别的事，就想跟你说句话
- 我现在要处理用户的请求，生成 5 条温柔暖男风…`
      : intent.asksIdentity
        ? `
【真人好示例 · 先答「你是谁」· 禁止「刷到抖音」套话】
- 确实唐突了，我 XX，昨天在抖音看到你就想打个招呼（初识，稳）
- XX，路人一枚，别紧张（初识，短）`
        : '';

  return `${platformBlock}${exampleBlock}

【针对性接话 · 硬性要求】对方原话：「${core}」
${must.map((m) => `- ${m}`).join('\n')}
- 禁止：不答问题、空泛寒暄、套用与上文无关的模板、编造她没提过的探店/店铺/合作
- 禁止输出任务说明、思考过程、风格列表；只写能直接发送的一句原话
- 自检：写完每条问自己「她看完会不会觉得我在回答她的问题？」
- 禁止「刷到你视频/动态/抖音」「摄影爱好者」「咨询小问题」等模板句`;
}

export function buildOffTopicRetryAppend(lastOther: string): string {
  return `

【严重跑题 · 上一批没有正面回答对方，必须重写】
${buildMessageSpecificDirective(lastOther)}
- 禁止「刷到抖音就想打招呼」式不答问题的回复
- 每条开头就要回应她的质问或问题`;
}
