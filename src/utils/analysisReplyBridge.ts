import type { AnalysisResult, ChatMessage, UserSettings } from '../types';
import { getMessageContentForAnalysis } from './targetedReply';
import { buildChatMemoryBlock } from './chatMemory';

function line(label: string, value: string | undefined): string {
  const v = value?.trim();
  return v ? `· ${label}：${v}` : '';
}

function normalizeCoreNeeds(needs: unknown): string {
  if (Array.isArray(needs)) {
    const items = needs.map(String).filter(Boolean);
    return items.length ? items.join('、') : '';
  }
  if (typeof needs === 'string' && needs.trim()) {
    return needs.trim();
  }
  return '';
}

/** 从对话/资料卡提取可加好友来源线索，避免话术里出现 XX 占位 */
export function buildSourceContextHint(
  messages: ChatMessage[],
  settings: UserSettings
): string {
  const hints: string[] = [];
  const seen = new Set<string>();

  const pushHint = (hint: string) => {
    const trimmed = hint.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    hints.push(trimmed);
  };

  const mp = settings.myProfile;
  const memoryHint = buildChatMemoryBlock(settings, messages);

  if (memoryHint) {
    pushHint(memoryHint.replace(/\n/g, ' ').slice(0, 120));
  }
  if (mp?.experiences?.trim()) {
    pushHint(`本人经历（可自然提及认识途径）：${mp.experiences.trim().slice(0, 60)}`);
  }
  if (mp?.topics?.trim()) {
    pushHint(`擅长话题：${mp.topics.trim().slice(0, 40)}`);
  }
  if (mp?.speakingStyle?.trim()) {
    pushHint(`说话方式：${mp.speakingStyle.trim().slice(0, 40)}`);
  }
  if (mp?.catchphrases?.trim()) {
    pushHint(`口头禅：${mp.catchphrases.trim().slice(0, 40)}`);
  }

  const myLines = messages
    .filter((m) => m.role === 'me' && m.content?.trim())
    .slice(-3)
    .map((m) => getMessageContentForAnalysis(m.content).trim())
    .filter(Boolean);
  if (myLines.length) {
    pushHint(`我方已说过（须一致、勿矛盾）：${myLines.join('；')}`);
  }

  const sourcePatterns =
    /群|抖音|小红书|快手|微博|朋友|同事|同学|活动|线下|见过|介绍|推荐|名片|扫码|视频|直播|评论|私信/;
  for (const m of messages) {
    if (!m.content?.trim()) continue;
    const c = getMessageContentForAnalysis(m.content);
    if (sourcePatterns.test(c)) {
      pushHint(`对话线索：${c.slice(0, 50)}`);
    }
  }

  if (!hints.length) {
    return `· 认识途径：对话与资料卡均未提供具体来源
· 禁止用 XX/某某/某群/某平台 占位；可只简明自报昵称或身份，或用「之前同群/朋友提过/线下见过」等自然模糊表述，勿编造具体群名`;
  }

  return `· 可用真实线索（优先用这些，禁止 XX 占位）：\n${hints.map((h) => `  - ${h}`).join('\n')}`;
}

/** 左侧心理分析 → 话术生成硬性约束块 */
export function buildAnalysisInsightBlock(
  analysis: Omit<AnalysisResult, 'replies' | 'topReplies'>
): string {
  const fp = analysis.femalePsychology ?? {
    socialScenario: '',
    coreNeeds: [],
    commStyle: '',
    replyPrinciple: '',
    scenarioTip: '',
    shitTestNote: '',
  };
  const psy = analysis.psychology ?? {
    emotionalState: '',
    mentalState: '',
    personalityTraits: [],
    subtext: '',
    relationshipStage: '',
    interestLevel: 50,
    chatDesire: '',
    impressionOfMe: '',
    isPerfunctory: '',
  };
  const strat = analysis.strategy ?? {
    coreStrategy: '',
    whyStrategy: '',
    emotionSwap: '',
    frameAdjust: '',
    communicationStrategy: '',
    warnings: [],
    nextMove: '',
  };
  const rel = analysis.relationshipMetrics;

  const needs = normalizeCoreNeeds(fp.coreNeeds);
  const warnings = Array.isArray(strat.warnings)
    ? strat.warnings.filter(Boolean).join('；')
    : typeof strat.warnings === 'string' && strat.warnings
      ? strat.warnings
      : '';
  const traits = Array.isArray(psy.personalityTraits)
    ? psy.personalityTraits.filter(Boolean).join('、')
    : '';

  const lines = [
    '【独创分析 · 教练结论 · 话术必须落实，禁止与分析矛盾】',
    line('一句话判断', analysis.summary),
    line('她是什么心思', psy.mentalState || psy.subtext),
    line('潜台词', psy.subtext),
    line('试探识别', fp.shitTestNote),
    line('核心策略', strat.coreStrategy || strat.nextMove || strat.communicationStrategy),
    line('为什么这么做', strat.whyStrategy),
    line('核心需求', needs),
    line('沟通模式', fp.commStyle),
    line('回复原则', fp.replyPrinciple),
    line('场景方向', fp.scenarioTip),
    line('可发送方向', strat.nextMove || fp.scenarioTip),
    line('框架调整', strat.frameAdjust),
    line(
      '好感温度',
      rel ? `${rel.temperature}% · ${rel.stage}` : `${psy.interestLevel ?? 50}%`
    ),
    line('聊天欲望', psy.chatDesire),
    line('对你印象', psy.impressionOfMe),
    line('性格倾向', traits),
    warnings ? `· ⚠ 禁止：${warnings}` : '',
    fp.scenarioTip
      ? `· 【每条自检】是否落实「${fp.scenarioTip}」且正面回应她最后一句？`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}
