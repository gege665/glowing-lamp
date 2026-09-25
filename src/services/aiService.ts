import type { ChatMessage, UserSettings, AnalysisResult, ReplyCategory, ReplySuggestion, FemalePsychologyInsight, EmotionRadarItem, RiskAssessment, RelationshipMetrics, KeyMoment } from '../types';
import { RELATIONSHIP_FLOW_HINT, REPLY_SUGGESTION_COUNT } from '../types';
import {
  REPLY_GENERATION_BATCHES,
  REPLY_STYLE_COUNT,
  EMPTY_CONVERSATION_HINT,
  COMPACT_REPLY_SYSTEM_PROMPT,
  COMPACT_ANALYSIS_SYSTEM_PROMPT,
  COMBINED_FAST_SYSTEM_PROMPT,
  COMBINED_FAST_MAX_TOKENS,
} from '../constants/analysisPrompts';
import {
  resolveReplyStyles,
  pickStylesForGeneration,
  buildBatchStylePromptBlock,
  REPLY_BATCH_OUTPUT_RULES,
  type ReplyStyleDefinition,
} from '../constants/replyStylePrompts';
import {
  buildStyledAnalysisSystemPrompt,
  getChatStylePrompt,
  DEFAULT_CHAT_STYLE,
  type ChatStyleType,
} from '../constants/chatStylePrompts';
import {
  detectSocialScenario,
} from '../constants/femalePsychology';
import {
  formatAnalysisUserMessage,
} from '../constants/promptTemplates';
import {
  resolveModelForSettings,
  resolveModelForTask,
  supportsAutoModelRouting,
  shouldUseCombinedFastPath,
  AIYIWEI_CHAT_MODEL,
  AIYIWEI_CHAT_MODEL_ALT,
  getModelLabelById,
} from '../constants/modelRouting';
import {
  getModelCallParams,
  getMaxTokensForTask,
  mergeSystemPrompt,
  type ModelCallTask,
} from '../constants/modelCallParams';
import { loadSettings } from './storageService';
import {
  extractReplyPreviewLines,
  replyFingerprint,
  type StreamProgress,
} from '../utils/streamPreview';
import { logModelSwitchEvent } from '../utils/modelFailoverLog';
import { normalizeReplyLine } from '../utils/replyParse';
import { normalizeApiKey, humanizeInvalidTokenError } from '../utils/apiKey';
import {
  buildAnalysisLastMessageFocus,
  buildMessageSpecificDirective,
  detectMessageIntent,
  getMessageContentForAnalysis,
} from '../utils/targetedReply';
import {
  getLastOtherMessage,
  shouldUseOpeningGuide,
  buildSituationContextBlock,
  resolveSituationSettings,
} from '../utils/situationContext';
import {
  lineLooksLikeReasoningLeak,
  detectBatchQualityIssues,
  isValidReplyLine,
} from '../utils/replyQuality';
import {
  formatUpstreamBusyUserMessage,
  isUpstreamBusyMessage,
} from '../utils/upstreamErrors';
import {
  abortableSleep,
  abortForTimeout,
  combineAbortSignals,
  rethrowAfterAbort,
  throwIfAborted,
  REQUEST_TIMEOUT_MESSAGE,
} from '../utils/abortSleep';
import {
  getTransportBackoffMs,
  isRetryableTransportError,
  MAX_CLIENT_TRANSPORT_RETRIES,
} from '../utils/retryPolicy';
import { jsonApiHeaders } from '../utils/apiHeaders';
import { buildProfileContextBlock } from '../utils/profileContext';
import { buildChatMemoryBlock } from '../utils/chatMemory';
import { buildAnalysisInsightBlock, buildSourceContextHint } from '../utils/analysisReplyBridge';
import { buildSceneStylePromptBlock } from '../constants/coreReplyStyles';
import { buildSceneReplyGuideBlock } from '../constants/sceneReplyGuides';
import { isOpenAiModelId } from '../constants/openaiModels';
import { parseAnalysisJsonObject } from '../utils/analysisJsonParse';
import { isThinAnalysisResult } from '../utils/analysisSubstance';
import {
  normalizeIntentLabel,
  normalizeStrategyCards,
  synthesizeStrategyCards,
} from '../constants/strategyCoach';
import {
  extractCombinedReplyText,
  extractRepliesFromModelOutput,
  parseModelRepliesToSuggestions,
} from '../utils/replyCombinedParse';
import { EMOTION_RADAR_TYPES } from '../constants/productFeatures';

const REPLY_BATCH_MAX_TOKENS = 520;
/** 手动选模时锁定，禁止服务端自动降级到豆包 */
function isManualModelLock(settings: UserSettings): boolean {
  return settings.modelMode === 'manual';
}
/** 行数不足时补重试 */
const REPLY_INCOMPLETE_RETRY_MAX = 1;
/** 质量不合格（meta/官方腔/跑题）时重试 */
const REPLY_QUALITY_RETRY_MAX = 1;
/** 已有足够条数则跳过后续重试/兜底请求 */
const REPLY_FAST_ACCEPT_COUNT = 3;
/** 客户端 SSE / API 单次请求超时（毫秒），与服务端上游超时对齐 */
const CLIENT_CHAT_TIMEOUT_MS = 60_000;
const CLIENT_ANALYSIS_TIMEOUT_MS = 90_000;
const MAX_CONTEXT_MESSAGES = 32;
const MAX_CONTEXT_CHARS = 12_000;

function getClientRequestTimeout(task: ModelCallTask): number {
  return task === 'deepAnalysis' ? CLIENT_ANALYSIS_TIMEOUT_MS : CLIENT_CHAT_TIMEOUT_MS;
}

function getRecentMessages(messages: ChatMessage[]): ChatMessage[] {
  const recent: ChatMessage[] = [];
  let chars = 0;

  for (let i = messages.length - 1; i >= 0 && recent.length < MAX_CONTEXT_MESSAGES; i--) {
    const message = messages[i];
    const remaining = MAX_CONTEXT_CHARS - chars;
    if (remaining <= 0) break;
    const content = message.content.trim();
    if (!content) continue;
    recent.push({ ...message, content: content.slice(-remaining) });
    chars += Math.min(content.length, remaining);
  }

  return recent.reverse();
}

function resolveCallOptions(
  task: ModelCallTask,
  overrides?: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }
) {
  const defaults = getModelCallParams(task);
  const jsonMode = overrides?.jsonMode ?? false;
  return {
    temperature: overrides?.temperature ?? defaults.temperature,
    topP: overrides?.topP ?? defaults.topP,
    maxTokens: overrides?.maxTokens ?? getMaxTokensForTask(task, jsonMode),
  };
}

function normalizeFemalePsychology(
  raw: Partial<FemalePsychologyInsight> | undefined,
  fallbackScenario?: string
): FemalePsychologyInsight {
  const needs = raw?.coreNeeds;
  const coreNeeds = Array.isArray(needs)
    ? needs.map(String).filter(Boolean)
    : typeof needs === 'string' && needs
      ? [needs]
      : [];

  return {
    socialScenario: raw?.socialScenario || fallbackScenario || '',
    coreNeeds,
    commStyle: raw?.commStyle || '',
    replyPrinciple: raw?.replyPrinciple || '',
    scenarioTip: raw?.scenarioTip || '',
  };
}

function clampPercent(n: unknown, fallback = 50): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function parseJsonObject(raw: string): Partial<AnalysisResult> {
  return parseAnalysisJsonObject(raw) as Partial<AnalysisResult>;
}

/** GPT / OpenAI 模型用精简 JSON 分析；完整 MAI 模板仅给 DeepSeek / MAI-DS-R1 */
function shouldUseFullAnalysisPrompt(settings: UserSettings, analysisModel: string): boolean {
  if (settings.modelMode !== 'manual') return false;
  if (isOpenAiModelId(analysisModel)) return false;
  return true;
}

/** 合并模式 / 兜底：把模型 replies 数组直接映射为话术条 */
function mapReplyLinesToSuggestions(
  replyLines: unknown[],
  activeStyles: ReplyStyleDefinition[]
): ReplySuggestion[] {
  return activeStyles.map((style, i) => {
    const raw = extractCombinedReplyText(replyLines[i] ?? '');
    let content = raw ? normalizeReplyLine(raw, style.label) : '';
    if (!content && raw.length >= 2) {
      content = raw.slice(0, 55);
    }
    return {
      category: style.category as ReplyCategory,
      label: style.label,
      content,
    };
  });
}

function countValidReplies(replies: ReplySuggestion[]): number {
  return replies.filter((r) => r.content.trim().length >= 2).length;
}

function countQualityReplies(
  replies: ReplySuggestion[],
  lastOther: string,
  openingMode: boolean
): number {
  return replies.filter((r) =>
    isValidReplyLine(r.content.trim(), lastOther, { openingMode })
  ).length;
}

function filterRepliesForDisplay(
  replies: ReplySuggestion[],
  lastOther: string,
  openingMode: boolean
): ReplySuggestion[] {
  return replies.map((r) => {
    const content = r.content.trim();
    const ok = isValidReplyLine(content, lastOther, { openingMode });
    return { ...r, content: ok ? content : '' };
  });
}

function buildCombinedFastUserContent(
  messages: ChatMessage[],
  settings: UserSettings,
  targetMessage: string | undefined,
  activeStyles: ReplyStyleDefinition[]
): string {
  const styleLabels = activeStyles.map((s) => s.label).join('、');
  return `${buildCompactAnalysisUserContent(messages, settings, targetMessage)}

【5 条话术 · 顺序与风格】${styleLabels}
replies 数组 5 项，每项一条可发送原话，须与分析 scenarioTip 一致。`;
}

function tryParseCombinedFastResponse(
  raw: string,
  settings: UserSettings,
  messages: ChatMessage[],
  targetMessage: string | undefined,
  activeStyles: ReplyStyleDefinition[]
): { analysis: Omit<AnalysisResult, 'replies' | 'topReplies'>; replies: ReplySuggestion[] } | null {
  const parsed = parseAnalysisJsonObject(raw);
  let replyLines: unknown = parsed.replies;
  if (typeof replyLines === 'string') {
    replyLines = replyLines
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(replyLines)) return null;

  const analysisPayload = { ...parsed };
  delete analysisPayload.replies;

  const lastOther = getLastOtherMessage(messages, targetMessage);
  let analysis: Omit<AnalysisResult, 'replies' | 'topReplies'>;
  try {
    analysis = parseAnalysisContent(JSON.stringify(analysisPayload), settings, lastOther);
  } catch {
    return null;
  }

  let replies = mapReplyLinesToSuggestions(replyLines, activeStyles);

  if (countValidReplies(replies) < 1) {
    replies = parseModelRepliesToSuggestions(raw, activeStyles, 0, { permissive: true });
  } else if (countValidReplies(replies) < 3) {
    const lines = extractRepliesFromModelOutput(raw);
    if (lines.length >= 1) {
      replies = parseModelRepliesToSuggestions(raw, activeStyles, 0, { permissive: true });
    }
  }

  if (countValidReplies(replies) < 3) {
    const lines = replyLines.map(extractCombinedReplyText).filter(Boolean);
    if (lines.length >= 3) {
      replies = parseModelRepliesToSuggestions(lines.join('\n'), activeStyles, 0, {
        permissive: true,
      });
    }
  }

  const openingMode = shouldUseOpeningGuide(lastOther, settings.chatScene);
  replies = filterRepliesForDisplay(replies, lastOther, openingMode);

  if (countQualityReplies(replies, lastOther, openingMode) < 1) return null;

  return { analysis, replies };
}

function buildSettingsContext(settings: UserSettings, messages: ChatMessage[] = []): string {
  const stages =
    settings.relationshipStages?.length > 0
      ? settings.relationshipStages.join('、')
      : '暧昧阶段';
  const focus =
    settings.strategyFocus?.length > 0
      ? settings.strategyFocus.join('、')
      : '心理穿透、推拉技巧';
  const profileBlock = buildProfileContextBlock(settings, messages);
  return `【关系阶段（可多选，覆盖流程：${RELATIONSHIP_FLOW_HINT}）】${stages}
【策略侧重（分析与话术均需体现）】${focus}${profileBlock ? `\n\n${profileBlock}` : ''}`;
}

function buildConversationContext(messages: ChatMessage[], settings: UserSettings): string {
  const history = getRecentMessages(messages)
    .map((m) => {
      const name = m.role === 'me' ? settings.myNickname : settings.otherNickname;
      return `[${name}]: ${m.content}`;
    })
    .join('\n');

  if (!history.trim()) {
    return EMPTY_CONVERSATION_HINT;
  }

  const lastOther = getLastOtherMessage(messages);
  const focusBlock = buildAnalysisLastMessageFocus(lastOther, settings.relationshipStages);
  const lastMessageLine = lastOther ? formatAnalysisUserMessage(lastOther) : '';

  return `${buildSettingsContext(settings, messages)}
【聊天内容】
${history}
${lastMessageLine ? `\n${lastMessageLine}` : ''}

${focusBlock ? `${focusBlock}\n\n` : ''}请严格按照 MAI-DS-R1 心理穿透模板完成分析：紧扣对方【最后一条发言】逐点分析，话术由后续豆包模型生成。禁止分析与原话无关的内容。`;
}

/** 快速分析 user 内容（更短 prompt，降低 token） */
function buildCompactAnalysisUserContent(
  messages: ChatMessage[],
  settings: UserSettings,
  targetMessage?: string
): string {
  const lastOther = getLastOtherMessage(messages, targetMessage);
  const recent = messages
    .slice(-4)
    .map((m) => {
      const name = m.role === 'me' ? settings.myNickname : settings.otherNickname;
      return `[${name}]: ${m.content.slice(0, 120)}`;
    })
    .join('\n');
  const focusBlock = buildAnalysisLastMessageFocus(lastOther, settings.relationshipStages);
  const sceneBlock = buildSceneStylePromptBlock(settings);
  const memoryBlock = buildChatMemoryBlock(settings, messages);

  return `${sceneBlock ? `${sceneBlock}\n\n` : ''}${memoryBlock ? `${memoryBlock}\n\n` : ''}【最近对话】
${recent || '（无）'}

${formatAnalysisUserMessage(lastOther)}

${focusBlock}

只分析她最后一句，输出精简 JSON。`;
}

/** 话术并行生成用的本地快速摘要（不等 AI 分析） */
function buildQuickAnalysisStub(
  messages: ChatMessage[],
  settings: UserSettings,
  targetMessage?: string
): Omit<AnalysisResult, 'replies' | 'topReplies'> {
  const lastOther = getLastOtherMessage(messages, targetMessage);
  const core = getMessageContentForAnalysis(lastOther);
  const intent = detectMessageIntent(lastOther);
  const scenario = detectSocialScenario(lastOther);

  let summary = core ? `回应：${core.slice(0, 22)}` : '先接住她的话';
  let scenarioTip = '正面回应她最后一句';
  let intentLabel = '日常闲聊';
  let intentInsight = core
    ? `她说「${core.slice(0, 16)}」，先接住字面意思，再决定要不要推进。`
    : '先接住她的话，再决定推进还是留白。';
  if (intent.asksIdentity) {
    summary = '她在核实你是谁';
    scenarioTip = '先简明自报身份';
    intentLabel = '确认身份';
    intentInsight = '她优先要确认你是谁；直接糊弄或绕弯会踩坑，先短答身份再说明来意。';
  } else if (intent.asksPurpose) {
    summary = '她在问什么事';
    scenarioTip = '直接说明来意';
    intentLabel = '确认目的';
    intentInsight = '她在问事由；绕弯或装熟容易防备升级，直接说清楚目的更稳。';
  } else if (intent.isWary) {
    summary = '她有防备心';
    scenarioTip = '先尊重她的质疑';
    intentLabel = '边界试探';
    intentInsight = '她带防备；硬撩或辩解会加防，先尊重边界再轻接。';
  }

  return {
    summary,
    intentLabel,
    intentInsight,
    emotion: {
      primary: intent.isWary ? '警惕' : '待判',
      secondary: '',
      intensity: 50,
      trend: '',
    },
    psychology: {
      emotionalState: '',
      mentalState: intent.asksIdentity ? '需要确认身份' : '',
      personalityTraits: [],
      subtext: scenarioTip,
      relationshipStage: settings.relationshipStages?.[0] ?? '暧昧阶段',
      interestLevel: 50,
      chatDesire: '中',
      impressionOfMe: '',
      isPerfunctory: '否',
    },
    deepReport: '',
    femalePsychology: {
      socialScenario: scenario.label,
      coreNeeds: [],
      commStyle: '',
      replyPrinciple: '',
      scenarioTip,
    },
    strategy: {
      emotionSwap: '',
      frameAdjust: '',
      communicationStrategy: scenarioTip,
      warnings: intent.isWary ? ['别糊弄、别装熟'] : [],
      nextMove: scenarioTip,
    },
    strategyCards: synthesizeStrategyCards({
      communicationStrategy: scenarioTip,
      nextMove: scenarioTip,
      replyExamples: [],
    }),
    analyzedAt: Date.now(),
    analysisDegraded: true,
    analysisDegradedReason: '本地摘要（非完整模型分析）',
  };
}

function withAnalysisDegraded(
  base: Omit<AnalysisResult, 'replies' | 'topReplies'>,
  reason: string,
  options?: { prefixSummary?: boolean }
): Omit<AnalysisResult, 'replies' | 'topReplies'> {
  const prefixSummary = options?.prefixSummary !== false;
  const prefix = '【本地摘要】';
  const summary =
    prefixSummary && !base.summary.startsWith(prefix)
      ? `${prefix}${base.summary || '待补充'}`
      : base.summary || '分析不完整';
  const warnings = [...(base.strategy?.warnings ?? [])];
  if (!warnings.some((w) => /本地摘要|不完整|过少/.test(w))) {
    warnings.unshift('当前分析可能不完整；话术仅供参考，建议重试分析');
  }
  return {
    ...base,
    summary,
    strategy: { ...base.strategy, warnings },
    analysisDegraded: true,
    analysisDegradedReason: reason,
  };
}

function buildReplyContextBlock(
  analysis: Omit<AnalysisResult, 'replies' | 'topReplies'>,
  settings: UserSettings,
  messages: ChatMessage[],
  targetMessage?: string
): string {
  const lastOtherRaw = getLastOtherMessage(messages, targetMessage);
  const lastOther = getMessageContentForAnalysis(lastOtherRaw);
  const fp = analysis.femalePsychology ?? {
    socialScenario: '',
    coreNeeds: [],
    commStyle: '',
    replyPrinciple: '',
    scenarioTip: '',
  };
  const effective = resolveSituationSettings(settings, messages, targetMessage);
  const profileBlock = buildProfileContextBlock(effective, messages);
  const situationBlock = buildSituationContextBlock(effective, messages, targetMessage);
  const intent = detectMessageIntent(lastOtherRaw);
  const identityVerify =
    intent.asksIdentity || intent.asksPurpose || intent.isWary;
  const useOpening = shouldUseOpeningGuide(lastOtherRaw, effective.chatScene);
  const sceneGuide =
    useOpening || identityVerify
      ? buildSceneReplyGuideBlock(
          effective.chatScene ?? 'first_add',
          pickStylesForGeneration(resolveReplyStyles(effective, lastOtherRaw), effective),
          effective.toneModifiers ?? [],
          { identityVerify: identityVerify && !useOpening }
        )
      : '';
  const specificDirective = buildMessageSpecificDirective(lastOtherRaw, effective.chatScene);
  const analysisBlock = buildAnalysisInsightBlock(analysis);
  const sourceHint = buildSourceContextHint(messages, effective);

  return `${analysisBlock}

${profileBlock ? `${profileBlock}\n\n` : ''}${situationBlock}

${sourceHint}

${sceneGuide ? `${sceneGuide}\n\n` : ''}【对方最后一句 · 5 条都要精准回应这句】
${effective.otherNickname}：「${lastOther || lastOtherRaw}」

${specificDirective}

【回复方向 · 与分析一致】${analysis.summary} → ${fp.scenarioTip || analysis.strategy?.nextMove || '—'}
${analysis.strategy?.warnings?.[0] ? `⚠ ${analysis.strategy.warnings[0]}` : ''}`;
}

/** 单批次话术 user 内容 */
function buildReplyBatchUserContent(
  contextBlock: string,
  start: number,
  end: number,
  activeStyles: ReplyStyleDefinition[],
  options?: { plainText?: boolean }
): string {
  const batchStyles = activeStyles.slice(start, end);
  const batchMeta = REPLY_GENERATION_BATCHES.find((b) => b.start === start);

  const outputRule = options?.plainText
    ? `- 本批次恰好输出 ${batchStyles.length} 行纯文本，每行 ONLY 一句 15～35 字口语
- 无编号、无 JSON、无 markdown、无风格标签前缀`
    : `- 输出 JSON（不要 markdown 代码块）：{"replies":[{"label":"${batchStyles[0]?.label ?? '风格1'}","content":"可发送原话"}, ...]}，恰好 ${batchStyles.length} 项`;

  return `${contextBlock}

【本批次任务 · ${batchMeta?.title ?? ''}】
${buildBatchStylePromptBlock(batchStyles)}

${REPLY_BATCH_OUTPUT_RULES}
- 本批次恰好输出 ${batchStyles.length} 条，顺序与上面 ${batchStyles.length} 条一一对应
${outputRule}`;
}

type ReplyRetryReason = 'incomplete' | 'meta' | 'official' | 'offTopic';

function buildReplyRetryAppend(lastOther: string, reason: ReplyRetryReason): string {
  const head = '\n\n【重要 · 上一批不合格，请重写】';
  switch (reason) {
    case 'incomplete':
      return `${head}
- 须恰好输出本批次要求的行数，每行一条可发送原话
- 不要输出思考过程、任务说明或风格列表`;
    case 'meta':
      return `${head}
- 禁止输出思考过程、任务说明、风格列表或「例如/比如」式教学句
- 每行只能是发给对方的原话`;
    case 'official':
      return `${head}
- 禁止客服/粉丝/探店/打扰套话，须口语、像真人聊天
- 不要「刷到抖音」「想请教」「不好意思打扰」等模板句`;
    case 'offTopic':
      return `${head}
- 须紧扣对方最后一句：${lastOther.slice(0, 80)}
- 若对方问身份/目的，必须正面回应，禁止空洞寒暄`;
    default:
      return '';
  }
}

async function generateStyleReplies(
  analysisBase: Omit<AnalysisResult, 'replies' | 'topReplies'>,
  settings: UserSettings,
  messages: ChatMessage[],
  replyModel: string,
  emitProgress: ReturnType<typeof createProgressEmitter>,
  targetMessage?: string,
  signal?: AbortSignal
): Promise<ReplySuggestion[]> {
  throwIfAborted(signal);

  const all: ReplySuggestion[] = [];
  const lastOtherForReply = getLastOtherMessage(messages, targetMessage);
  const effective = resolveSituationSettings(settings, messages, targetMessage);
  const activeStyles = pickStylesForGeneration(
    resolveReplyStyles(effective, lastOtherForReply),
    effective
  );
  const manualLocked = isManualModelLock(settings);
  const replyChatFallback =
    settings.provider === 'aiyiwei'
      ? replyModel === AIYIWEI_CHAT_MODEL
        ? AIYIWEI_CHAT_MODEL_ALT
        : AIYIWEI_CHAT_MODEL
      : resolveModelForTask('chat', settings.provider);
  const sharedContextBlock = buildReplyContextBlock(
    analysisBase,
    settings,
    messages,
    targetMessage
  );

  const handleReplyStatus = (status: StreamStatusEvent) => {
    if (status.type === 'switching' && status.model) {
      const label = getModelLabelById(status.model, settings.provider);
      emitProgress(
        {
          phase: 'replies',
          message: `话术生成繁忙，切换至 ${label}…`,
          analysisPreview: {
            summary: analysisBase.summary,
            primary: analysisBase.emotion?.primary,
            intensity: analysisBase.emotion?.intensity,
          },
          replyPreviews: all.map((r) => ({ label: r.label, content: r.content })),
          activeModel: status.model,
          modelSwitched: true,
        },
        0,
        `reply-switch-${status.model}`
      );
    } else if (status.type === 'provider_fallback') {
      emitProgress(
        {
          phase: 'replies',
          message: '爱易威繁忙，话术走 OpenRouter 备用线路…',
          analysisPreview: {
            summary: analysisBase.summary,
            primary: analysisBase.emotion?.primary,
            intensity: analysisBase.emotion?.intensity,
          },
          replyPreviews: all.map((r) => ({ label: r.label, content: r.content })),
          modelSwitched: true,
        },
        0,
        'reply-provider-fallback'
      );
    } else if (status.type === 'cooldown') {
      emitProgress(
        {
          phase: 'replies',
          message: status.delayMs
            ? `连接异常，${Math.round(status.delayMs / 1000)} 秒后重试话术…`
            : '连接异常，正在重试话术…',
          analysisPreview: {
            summary: analysisBase.summary,
            primary: analysisBase.emotion?.primary,
            intensity: analysisBase.emotion?.intensity,
          },
          replyPreviews: all.map((r) => ({ label: r.label, content: r.content })),
        },
        0,
        'reply-cooldown'
      );
    }
  };

  async function runSingleBatch(
    start: number,
    end: number,
    title: string,
    modelForBatch: string
  ): Promise<ReplySuggestion[]> {
    const expected = end - start;
    const batchStyles = activeStyles.slice(start, end);
    const openingMode = shouldUseOpeningGuide(lastOtherForReply, effective.chatScene);
    const applyDisplayFilter = (parsed: ReplySuggestion[]) =>
      filterRepliesForDisplay(parsed, lastOtherForReply, openingMode);

    const fetchBatch = (
      retryReason?: ReplyRetryReason,
      modelOverride?: string,
      plainText = false
    ) => {
      const chatParams = getModelCallParams('chat');
      const userContent =
        buildReplyBatchUserContent(sharedContextBlock, start, end, activeStyles, { plainText }) +
        (retryReason ? buildReplyRetryAppend(lastOtherForReply, retryReason) : '');

      return chatRequest(
        settings,
        [
          {
            role: 'system',
            content: mergeSystemPrompt(chatParams.systemTone, COMPACT_REPLY_SYSTEM_PROMPT),
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        {
          modelOverride: modelOverride ?? modelForBatch,
          jsonMode: !plainText,
          task: 'chat',
          maxTokens: REPLY_BATCH_MAX_TOKENS,
          temperature: retryReason ? 0.95 : 0.92,
          onChunk: plainText
            ? undefined
            : (full) => {
                const batchPreviews = extractReplyPreviewLines(full, start, activeStyles);
                const merged = [
                  ...all.map((r) => ({ label: r.label, content: r.content })),
                  ...batchPreviews,
                ];
                emitProgress(
                  {
                    phase: 'replies',
                    message: `正在生成 ${title}（${all.length + batchPreviews.length}/${REPLY_SUGGESTION_COUNT}）…`,
                    analysisPreview: {
                      summary: analysisBase.summary,
                      primary: analysisBase.emotion?.primary,
                      intensity: analysisBase.emotion?.intensity,
                    },
                    replyPreviews: merged,
                    activeModel: modelOverride ?? modelForBatch,
                  },
                  80,
                  replyFingerprint(merged)
                );
              },
          onStatus: handleReplyStatus,
          signal,
        }
      );
    };

    const parseRaw = (raw: string, permissive: boolean) =>
      parseModelRepliesToSuggestions(raw, batchStyles, start, { permissive });

    let lastError: Error | undefined;
    let bestRaw = '';
    let bestParsed: ReplySuggestion[] = batchStyles.map((style) => ({
      category: style.category as ReplyCategory,
      label: style.label,
      content: '',
    }));
    let bestValid = 0;

    try {
      const raw = await fetchBatch(undefined, undefined, false);
      const parsed = parseRaw(raw, false);
      const valid = parsed.filter((p) => p.content.trim().length >= 2).length;
      if (valid > bestValid) {
        bestRaw = raw;
        bestParsed = parsed;
        bestValid = valid;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    const allowFormatRetry = false;
    if (allowFormatRetry && bestValid < 1) {
      try {
        const raw = await fetchBatch(undefined, undefined, true);
        const parsed = parseRaw(raw, true);
        const valid = parsed.filter((p) => p.content.trim().length >= 2).length;
        if (valid > bestValid) {
          bestRaw = raw;
          bestParsed = parsed;
          bestValid = valid;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (bestValid === 0 && lastError) throw lastError;
      }
    }

    for (
      let qi = 0;
      qi < REPLY_INCOMPLETE_RETRY_MAX &&
      bestValid < expected &&
      bestValid < REPLY_FAST_ACCEPT_COUNT;
      qi++
    ) {
      try {
        const retryRaw = await fetchBatch('incomplete', undefined, bestValid === 0);
        const retryParsed = applyDisplayFilter(parseRaw(retryRaw, bestValid === 0));
        const retryValid = retryParsed.filter((p) => p.content.trim().length >= 2).length;
        if (retryValid > bestValid) {
          bestRaw = retryRaw;
          bestParsed = retryParsed;
          bestValid = retryValid;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    let qualityIssues = bestRaw.trim()
      ? detectBatchQualityIssues(bestRaw, lastOtherForReply)
      : [];

    for (
      let qi = 0;
      qi < REPLY_QUALITY_RETRY_MAX &&
      qualityIssues.length > 0 &&
      bestValid < expected;
      qi++
    ) {
      const reason = qualityIssues[0] as ReplyRetryReason;
      try {
        const retryRaw = await fetchBatch(reason, undefined, false);
        const retryParsed = applyDisplayFilter(parseRaw(retryRaw, false));
        const retryQuality = countQualityReplies(retryParsed, lastOtherForReply, openingMode);
        const currentQuality = countQualityReplies(
          applyDisplayFilter(bestParsed),
          lastOtherForReply,
          openingMode
        );
        if (
          retryQuality > currentQuality ||
          (retryQuality >= expected && currentQuality < expected)
        ) {
          bestRaw = retryRaw;
          bestParsed = retryParsed;
          bestValid = retryParsed.filter((p) => p.content.trim().length >= 2).length;
        }
        qualityIssues = detectBatchQualityIssues(bestRaw, lastOtherForReply);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        break;
      }
    }

    let validCount = bestParsed.filter((p) => p.content.trim().length >= 2).length;
    if (validCount === 0 && bestRaw.trim()) {
      bestParsed = applyDisplayFilter(parseRaw(bestRaw, true));
      validCount = bestParsed.filter((p) => p.content.trim().length >= 2).length;
    }

    if (validCount === 0 && lastError) {
      throw lastError;
    }

    if (validCount < expected) {
      console.warn(
        `[ReplyGen] 批次 ${start + 1}～${end} 仅 ${validCount}/${expected} 条，返回已有结果`
      );
    }

    return applyDisplayFilter(bestParsed);
  }

  async function fillMissingReplies(
    partial: ReplySuggestion[],
    modelForBatch: string
  ): Promise<ReplySuggestion[]> {
    const openingMode = shouldUseOpeningGuide(lastOtherForReply, effective.chatScene);
    const missing = partial
      .map((reply, index) => ({ reply, index }))
      .filter(({ reply }) => !reply.content.trim());
    if (!missing.length) return partial;

    const stylesNeeded = missing.map(({ index }) => activeStyles[index]).filter(Boolean);
    if (!stylesNeeded.length) return partial;

    const styleBlock = buildBatchStylePromptBlock(stylesNeeded);
    const userContent = `${sharedContextBlock}

【补全任务 · 仅生成 ${stylesNeeded.length} 条缺失话术】
${styleBlock}
${REPLY_BATCH_OUTPUT_RULES}
- 恰好 ${stylesNeeded.length} 项，顺序与上面风格一一对应
- 输出 JSON：{"replies":[{"label":"...","content":"..."}]}`;

    try {
      const chatParams = getModelCallParams('chat');
      const requestFill = (plainText: boolean) =>
        chatRequest(
          settings,
          [
            {
              role: 'system',
              content: mergeSystemPrompt(chatParams.systemTone, COMPACT_REPLY_SYSTEM_PROMPT),
            },
            {
              role: 'user',
              content: plainText
                ? `${userContent}\n- 改为 ${stylesNeeded.length} 行纯文本，每行一句口语，无 JSON`
                : userContent,
            },
          ],
          {
            modelOverride: modelForBatch,
            jsonMode: !plainText,
            task: 'chat',
            maxTokens: 320,
            temperature: 0.9,
            onStatus: handleReplyStatus,
            signal,
          }
        );

      let raw = await requestFill(false);
      let filled = filterRepliesForDisplay(
        parseModelRepliesToSuggestions(raw, stylesNeeded, 0, { permissive: true }),
        lastOtherForReply,
        openingMode
      );
      if (!filled.some((r) => r.content.trim())) {
        raw = await requestFill(true);
        filled = filterRepliesForDisplay(
          parseModelRepliesToSuggestions(raw, stylesNeeded, 0, { permissive: true }),
          lastOtherForReply,
          openingMode
        );
      }
      const merged = [...partial];
      missing.forEach(({ index }, i) => {
        const line = filled[i]?.content?.trim();
        if (line && merged[index] && isValidReplyLine(line, lastOtherForReply, { openingMode })) {
          merged[index] = { ...merged[index], content: line };
        }
      });
      return merged;
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        throw err;
      }
      return partial;
    }
  }

  const settled = await Promise.allSettled(
    REPLY_GENERATION_BATCHES.map(async ({ start, end, title }) => {
      try {
        return await runSingleBatch(start, end, title, replyModel);
      } catch (primaryErr) {
        const errMsg =
          primaryErr instanceof Error ? primaryErr.message : '话术生成失败';
        if (
          (primaryErr instanceof DOMException && primaryErr.name === 'AbortError') ||
          (primaryErr instanceof Error && primaryErr.name === 'AbortError')
        ) {
          throw primaryErr;
        }
        if (manualLocked) {
          console.error(`[ReplyGen] batch ${start}-${end} failed (manual lock):`, primaryErr);
          throw primaryErr instanceof Error ? primaryErr : new Error(errMsg);
        }
        if (replyModel === replyChatFallback) {
          console.error(`[ReplyGen] batch ${start}-${end} failed:`, primaryErr);
          throw primaryErr instanceof Error ? primaryErr : new Error(errMsg);
        }
        emitProgress(
          {
            phase: 'replies',
            message: '话术模型繁忙，切换备选话术模型…',
            analysisPreview: {
              summary: analysisBase.summary,
              primary: analysisBase.emotion?.primary,
              intensity: analysisBase.emotion?.intensity,
            },
            replyPreviews: all.map((r) => ({ label: r.label, content: r.content })),
            activeModel: replyChatFallback,
            modelSwitched: true,
          },
          0,
          'reply-model-fallback'
        );
        try {
          return await runSingleBatch(start, end, title, replyChatFallback);
        } catch (fallbackErr) {
          if (
            (fallbackErr instanceof DOMException && fallbackErr.name === 'AbortError') ||
            (fallbackErr instanceof Error && fallbackErr.name === 'AbortError')
          ) {
            throw fallbackErr;
          }
          throw fallbackErr instanceof Error ? fallbackErr : new Error(errMsg);
        }
      }
    })
  );

  let firstBatchError: unknown = null;
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const batch = REPLY_GENERATION_BATCHES[i];
    if (result.status === 'fulfilled') {
      all.push(...result.value);
      continue;
    }
    const reason = result.reason;
    if (
      (reason instanceof DOMException && reason.name === 'AbortError') ||
      (reason instanceof Error && reason.name === 'AbortError')
    ) {
      throw reason;
    }
    if (!firstBatchError) firstBatchError = reason;
    console.error(`[ReplyGen] batch ${batch.start}-${batch.end} settled reject:`, reason);
    for (let j = batch.start; j < batch.end && j < activeStyles.length; j++) {
      const style = activeStyles[j];
      all.push({
        category: (style?.category ?? 'warmCare') as ReplyCategory,
        label: style?.label ?? `话术 ${j + 1}`,
        content: '',
      });
    }
  }

  while (all.length < activeStyles.length) {
    const i = all.length;
    const style = activeStyles[i];
    all.push({
      category: (style?.category ?? 'warmCare') as ReplyCategory,
      label: style?.label ?? `话术 ${i + 1}`,
      content: '',
    });
  }

  const filled = await fillMissingReplies(all, replyModel);
  const display = filterRepliesForDisplay(
    filled,
    lastOtherForReply,
    shouldUseOpeningGuide(lastOtherForReply, effective.chatScene)
  );

  if (!display.some((r) => r.content.trim().length >= 2)) {
    if (firstBatchError instanceof Error) throw firstBatchError;
    if (firstBatchError) throw new Error(String(firstBatchError));
  }

  return display;
}

function attachStrategyCardsFromReplies(
  analysis: Omit<AnalysisResult, 'replies' | 'topReplies'>,
  replies: ReplySuggestion[]
): Omit<AnalysisResult, 'replies' | 'topReplies'> {
  const examples = replies.map((r) => r.content).filter((c) => c.trim().length >= 2);
  const existing = (analysis.strategyCards ?? []).filter((c) => c.example.trim());
  if (existing.length >= 2) return analysis;

  const synthesized = synthesizeStrategyCards({
    communicationStrategy: analysis.strategy.communicationStrategy,
    nextMove: analysis.strategy.nextMove,
    emotionSwap: analysis.strategy.emotionSwap,
    frameAdjust: analysis.strategy.frameAdjust,
    scenarioTip: analysis.femalePsychology?.scenarioTip,
    replyExamples: examples,
  });

  const merged = (analysis.strategyCards ?? []).map((card, i) => ({
    ...card,
    example: card.example.trim() || synthesized[i]?.example || examples[i] || '',
    approach: card.approach.trim() || synthesized[i]?.approach || '',
  }));

  const cards = (merged.length ? merged : synthesized)
    .filter((c) => c.approach || c.example)
    .slice(0, 3);

  return { ...analysis, strategyCards: cards };
}

function ensureValidReplies(
  replies: ReplySuggestion[],
  lastOther: string,
  openingMode: boolean
): ReplySuggestion[] {
  const filtered = filterRepliesForDisplay(replies, lastOther, openingMode);
  if (countQualityReplies(filtered, lastOther, openingMode) >= 1) return filtered;
  throw new Error('未生成有效话术，请重试或更换模型');
}

function parseAnalysisContent(
  rawContent: string,
  settings: UserSettings,
  lastOtherMessage?: string
): Omit<AnalysisResult, 'replies' | 'topReplies'> {
  const parsed = parseJsonObject(rawContent);

  const traits = parsed.psychology?.personalityTraits;
  const personalityTraits = Array.isArray(traits)
    ? traits.map(String)
    : typeof traits === 'string' && traits
      ? [traits]
      : [];

  const warningsRaw = parsed.strategy?.warnings;
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.map(String)
    : typeof warningsRaw === 'string' && warningsRaw
      ? [warningsRaw]
      : [];

  const emotion = parsed.emotion || { primary: '未知', secondary: '', intensity: 50, trend: '' };

  const radarRaw = parsed.emotionRadar;
  const emotionRadar: EmotionRadarItem[] = Array.isArray(radarRaw)
    ? radarRaw
        .map((item) => ({
          type: String((item as EmotionRadarItem)?.type ?? ''),
          score: clampPercent((item as EmotionRadarItem)?.score),
        }))
        .filter((item) => item.type)
    : EMOTION_RADAR_TYPES.map((type) => ({
        type,
        score: type === emotion.primary ? clampPercent(emotion.intensity) : 0,
      }));

  const riskRaw = parsed.riskAssessment as Partial<RiskAssessment> | undefined;
  const riskAssessment: RiskAssessment | undefined = riskRaw
    ? {
        level: ['low', 'medium', 'high'].includes(riskRaw.level ?? '')
          ? (riskRaw.level as RiskAssessment['level'])
          : 'low',
        signals: Array.isArray(riskRaw.signals)
          ? riskRaw.signals.map(String).filter(Boolean)
          : [],
        motivation: riskRaw.motivation || '',
        advice: riskRaw.advice || '',
        worthContinuing: riskRaw.worthContinuing || '',
      }
    : undefined;

  const relRaw = parsed.relationshipMetrics as Partial<RelationshipMetrics> | undefined;
  const relationshipMetrics: RelationshipMetrics | undefined = relRaw
    ? {
        temperature: clampPercent(relRaw.temperature, clampPercent(parsed.psychology?.interestLevel)),
        stage: relRaw.stage || parsed.psychology?.relationshipStage || '',
        interactionFreq: relRaw.interactionFreq || '',
        topicDepth: relRaw.topicDepth || '',
        trend: relRaw.trend || emotion.trend || '',
        suggestion: relRaw.suggestion || '',
        inviteTiming: relRaw.inviteTiming || '',
      }
    : undefined;

  const momentsRaw = parsed.keyMoments;
  const keyMoments: KeyMoment[] = Array.isArray(momentsRaw)
    ? momentsRaw
        .map((m) => ({
          label: String((m as KeyMoment)?.label ?? ''),
          meaning: String((m as KeyMoment)?.meaning ?? ''),
        }))
        .filter((m) => m.label)
    : [];

  const result: Omit<AnalysisResult, 'replies' | 'topReplies'> = {
    summary: parsed.summary || '分析完成',
    intentLabel: normalizeIntentLabel(parsed.intentLabel),
    intentInsight: String(parsed.intentInsight ?? '').trim().slice(0, 120),
    emotion: {
      primary: emotion.primary || '未知',
      secondary: emotion.secondary || '',
      intensity: clampPercent(emotion.intensity),
      trend: emotion.trend || '',
    },
    psychology: {
      emotionalState: parsed.psychology?.emotionalState || '',
      mentalState: parsed.psychology?.mentalState || '',
      personalityTraits,
      subtext: parsed.psychology?.subtext || '',
      relationshipStage:
        parsed.psychology?.relationshipStage || settings.relationshipStages.join('、'),
      interestLevel: clampPercent(parsed.psychology?.interestLevel),
      chatDesire: parsed.psychology?.chatDesire || '',
      impressionOfMe: parsed.psychology?.impressionOfMe || '',
      isPerfunctory: parsed.psychology?.isPerfunctory || '',
    },
    deepReport: parsed.deepReport || '',
    femalePsychology: normalizeFemalePsychology(
      parsed.femalePsychology as Partial<FemalePsychologyInsight> | undefined,
      detectSocialScenario(lastOtherMessage || '').label
    ),
    strategy: {
      emotionSwap: parsed.strategy?.emotionSwap || '',
      frameAdjust: parsed.strategy?.frameAdjust || '',
      communicationStrategy: parsed.strategy?.communicationStrategy || '',
      warnings,
      nextMove: parsed.strategy?.nextMove || '',
    },
    strategyCards: normalizeStrategyCards(parsed.strategyCards),
    emotionRadar,
    riskAssessment,
    relationshipMetrics,
    keyMoments,
    analyzedAt: Date.now(),
  };

  if (!result.intentInsight && result.psychology.subtext) {
    result.intentInsight = result.psychology.subtext;
  }
  if (!result.intentLabel && result.femalePsychology.socialScenario) {
    result.intentLabel = normalizeIntentLabel(result.femalePsychology.socialScenario);
  }

  if (!result.strategyCards?.length) {
    result.strategyCards = synthesizeStrategyCards({
      communicationStrategy: result.strategy.communicationStrategy,
      nextMove: result.strategy.nextMove,
      emotionSwap: result.strategy.emotionSwap,
      frameAdjust: result.strategy.frameAdjust,
      scenarioTip: result.femalePsychology.scenarioTip,
    });
  }

  if (isThinAnalysisResult(result)) {
    return withAnalysisDegraded(result, '模型返回内容过少，分析可能不完整', {
      prefixSummary: false,
    });
  }

  return result;
}

type SsePayload = {
  type: string;
  content?: string;
  delta?: string;
  error?: string;
  model?: string;
  requestedModel?: string;
  modelSwitched?: boolean;
  status?: { type: string; model?: string; delayMs?: number; pass?: number; provider?: string };
};

type StreamStatusEvent = { type: string; model?: string; delayMs?: number; pass?: number; provider?: string };

export function processSsePayload(
  payload: SsePayload,
  options?: {
    onChunk?: (full: string) => void;
    onModelResolved?: (info: {
      model?: string;
      requestedModel?: string;
      modelSwitched?: boolean;
    }) => void;
    onStatus?: (status: StreamStatusEvent) => void;
  },
  currentContent = ''
): string | null {
  if (payload.type === 'status' && payload.status) {
    options?.onStatus?.(payload.status);
    return null;
  }
  if (payload.type === 'chunk') {
    const next = payload.delta ? `${currentContent}${payload.delta}` : payload.content || currentContent;
    if (next !== currentContent) options?.onChunk?.(next);
    return next;
  }
  if (payload.type === 'done' && payload.content) {
    if (payload.content !== currentContent) options?.onChunk?.(payload.content);
    if (payload.model) {
      options?.onModelResolved?.({
        model: payload.model,
        requestedModel: payload.requestedModel,
        modelSwitched: payload.modelSwitched,
      });
    }
    if (payload.modelSwitched) {
      logModelSwitchEvent({
        requestedModel: payload.requestedModel,
        usedModel: payload.model,
        modelSwitched: true,
      });
    }
    return payload.content;
  }
  if (payload.type === 'error') {
    throw new Error(sanitizeApiErrorMessage(payload.error || '模型调用异常'));
  }
  return null;
}

function sanitizeApiErrorMessage(msg: string, provider?: string): string {
  const trimmed = msg.trim().replace(/\s*\(request id:[^)]+\)/gi, '').trim() || msg.trim();
  const tokenHint = humanizeInvalidTokenError(trimmed, provider);
  if (tokenHint) return tokenHint;
  if (
    isUpstreamBusyMessage(trimmed) ||
    /上游繁忙|上游暂时繁忙|分组负载|OPENROUTER_API_KEY|备用线路/.test(trimmed)
  ) {
    return formatUpstreamBusyUserMessage('');
  }
  return trimmed;
}

async function withClientTransportRetry<T>(
  fn: () => Promise<T>,
  options?: {
    signal?: AbortSignal;
    onRetry?: (attempt: number, delayMs: number) => void;
  }
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_CLIENT_TRANSPORT_RETRIES; attempt++) {
    throwIfAborted(options?.signal);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      const canRetry =
        attempt < MAX_CLIENT_TRANSPORT_RETRIES && isRetryableTransportError(err);
      if (!canRetry) {
        console.error('[AI] 请求失败:', err);
        throw err;
      }
      const delayMs = getTransportBackoffMs(attempt);
      console.warn(
        `[AI] 连接/超时重试 ${attempt + 1}/${MAX_CLIENT_TRANSPORT_RETRIES}，${delayMs}ms 后…`,
        err instanceof Error ? err.message : err
      );
      options?.onRetry?.(attempt + 1, delayMs);
      await abortableSleep(delayMs, options?.signal);
    }
  }
  console.error('[AI] 请求失败:', lastErr);
  throw lastErr;
}

async function parseErrorResponse(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return sanitizeApiErrorMessage(String(data.error || data.message || text));
  } catch {
    if (response.status === 404) {
      return 'API 服务未找到，请确认后端已启动（npm run dev）';
    }
    if (response.status === 502 || response.status === 503) {
      return '无法连接 API 服务，请重启 npm run dev 并确认 3001 端口可用';
    }
    return text.slice(0, 200) || `请求失败 (${response.status})`;
  }
}

async function assertApiKeyOrServerKey(settings: UserSettings): Promise<void> {
  if (settings.apiKey?.trim()) return;
  const health = await checkApiHealth();
  if (health.serverKeyConfigured) return;
  throw new Error('请先配置 API Key');
}

async function chatViaStream(
  settings: UserSettings,
  messages: { role: string; content: string }[],
  options?: {
    modelOverride?: string;
    jsonMode?: boolean;
    maxTokens?: number;
    onChunk?: (full: string) => void;
    onModelResolved?: (info: {
      model?: string;
      requestedModel?: string;
      modelSwitched?: boolean;
    }) => void;
    onStatus?: (status: StreamStatusEvent) => void;
    signal?: AbortSignal;
    temperature?: number;
    topP?: number;
    task?: ModelCallTask;
  }
): Promise<string> {
  throwIfAborted(options?.signal);

  const apiKey = normalizeApiKey(settings.apiKey);
  const model =
    options?.modelOverride ||
    (supportsAutoModelRouting(settings.provider)
      ? resolveModelForSettings(options?.task ?? (options?.jsonMode ? 'deepAnalysis' : 'chat'), settings)
      : settings.model || undefined);

  const task = options?.task ?? (options?.jsonMode ? 'deepAnalysis' : 'chat');
  const requestTimeoutMs = getClientRequestTimeout(task);
  const callParams = resolveCallOptions(task, {
    jsonMode: options?.jsonMode,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
    topP: options?.topP,
  });

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => {
    abortForTimeout(timeoutCtrl);
  }, requestTimeoutMs);
  const { signal: mergedSignal, dispose } = combineAbortSignals([
    options?.signal,
    timeoutCtrl.signal,
  ]);
  const deadline = Date.now() + requestTimeoutMs;

  let response: Response;
  try {
    response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: jsonApiHeaders(),
      signal: mergedSignal,
      body: JSON.stringify({
        provider: settings.provider,
        apiKey,
        model,
        messages,
        temperature: callParams.temperature,
        topP: callParams.topP,
        maxTokens: callParams.maxTokens,
        jsonMode: options?.jsonMode ?? false,
        lockModel: isManualModelLock(settings),
      }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    dispose();
    rethrowAfterAbort(err, options?.signal, timeoutCtrl.signal);
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    dispose();
    const errMsg = await parseErrorResponse(response);
    console.error('[AI] HTTP 错误:', response.status, errMsg);
    throw new Error(errMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    clearTimeout(timeoutId);
    dispose();
    throw new Error('无法读取流式响应');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalContent = '';
  let streamedContent = '';

  const handleEventBlock = (block: string) => {
    const line = block.trim();
    if (!line.startsWith('data:')) return;
    let payload: SsePayload;
    try {
      payload = JSON.parse(line.slice(5).trim());
    } catch (e) {
      if (e instanceof SyntaxError) return;
      throw e;
    }
    const content = processSsePayload(payload, options, streamedContent);
    if (payload.type === 'chunk' && content) streamedContent = content;
    if (payload.type === 'done' && content) finalContent = content;
  };

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  mergedSignal.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      throwIfAborted(mergedSignal);
      if (Date.now() > deadline) {
        await reader.cancel().catch(() => {});
        throw new Error(REQUEST_TIMEOUT_MESSAGE);
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        handleEventBlock(event);
      }
    }

    if (buffer.trim()) {
      handleEventBlock(buffer);
    }
  } finally {
    mergedSignal.removeEventListener('abort', onAbort);
    clearTimeout(timeoutId);
    dispose();
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }

  if (!finalContent) throw new Error('AI 返回内容为空');
  return finalContent;
}

/** 每次分析独立实例，避免并发分析时进度串线 */
function createProgressEmitter(onProgress?: (progress: StreamProgress) => void) {
  let lastAt = 0;
  let lastKey = '';
  return (payload: StreamProgress, throttleMs = 180, forceKey?: string) => {
    if (!onProgress) return;
    const now = Date.now();
    const contentChanged = forceKey !== undefined && forceKey !== lastKey;
    if (
      !contentChanged &&
      payload.phase !== 'parsing' &&
      payload.phase !== 'finishing' &&
      now - lastAt < throttleMs
    ) {
      return;
    }
    lastAt = now;
    if (forceKey !== undefined) lastKey = forceKey;
    onProgress(payload);
  };
}

async function chatViaFetch(
  settings: UserSettings,
  messages: { role: string; content: string }[],
  modelOverride?: string,
  jsonMode = false,
  maxTokens?: number,
  temperature?: number,
  topP?: number,
  task: ModelCallTask = 'chat',
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal);

  const apiKey = normalizeApiKey(settings.apiKey);
  const model =
    modelOverride ||
    (supportsAutoModelRouting(settings.provider)
      ? resolveModelForSettings(task, settings)
      : settings.model || undefined);

  const callParams = resolveCallOptions(task, { jsonMode, maxTokens, temperature, topP });
  const requestTimeoutMs = getClientRequestTimeout(task);

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => {
    abortForTimeout(timeoutCtrl);
  }, requestTimeoutMs);
  const { signal: mergedSignal, dispose } = combineAbortSignals([signal, timeoutCtrl.signal]);

  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: jsonApiHeaders(),
      signal: mergedSignal,
      body: JSON.stringify({
        provider: settings.provider,
        apiKey,
        model,
        messages,
        temperature: callParams.temperature,
        topP: callParams.topP,
        maxTokens: callParams.maxTokens,
        jsonMode,
        lockModel: isManualModelLock(settings),
      }),
    });

    if (!response.ok) {
      const errMsg = await parseErrorResponse(response);
      console.error('[AI] HTTP 错误:', response.status, errMsg);
      throw new Error(errMsg);
    }

    const data = await response.json();
    if (!data.content) throw new Error('AI 返回内容为空');
    return data.content;
  } catch (err) {
    rethrowAfterAbort(err, signal, timeoutCtrl.signal);
  } finally {
    clearTimeout(timeoutId);
    dispose();
  }
}

async function chatRequest(
  settings: UserSettings,
  messages: { role: string; content: string }[],
  options?: {
    modelOverride?: string;
    jsonMode?: boolean;
    maxTokens?: number;
    onChunk?: (full: string) => void;
    onModelResolved?: (info: {
      model?: string;
      requestedModel?: string;
      modelSwitched?: boolean;
    }) => void;
    onStatus?: (status: StreamStatusEvent) => void;
    signal?: AbortSignal;
    temperature?: number;
    topP?: number;
    task?: ModelCallTask;
    useNonStream?: boolean;
  }
): Promise<string> {
  return withClientTransportRetry(
    async () => {
      const task = options?.task ?? (options?.jsonMode ? 'deepAnalysis' : 'chat');

      if (options?.useNonStream) {
        const content = await chatViaFetch(
          settings,
          messages,
          options?.modelOverride,
          options?.jsonMode ?? false,
          options?.maxTokens,
          options?.temperature,
          options?.topP,
          task,
          options?.signal
        );
        options?.onChunk?.(content);
        return content;
      }

      if (settings.provider === 'openrouter' || settings.provider === 'juhe' || settings.provider === 'aiyiwei') {
        return chatViaStream(settings, messages, options);
      }

      const content = await chatViaFetch(
        settings,
        messages,
        options?.modelOverride,
        options?.jsonMode ?? false,
        options?.maxTokens,
        options?.temperature,
        options?.topP,
        task,
        options?.signal
      );
      options?.onChunk?.(content);
      return content;
    },
    {
      signal: options?.signal,
      onRetry: (attempt, delayMs) => {
        options?.onStatus?.({ type: 'cooldown', delayMs, pass: attempt });
      },
    }
  );
}

export type { ChatStyleType };

/** 带 10 套风格切换的单轮话术（聚合 API / OpenRouter 代理） */
export async function getSoulChatReply(
  userText: string,
  style: ChatStyleType = DEFAULT_CHAT_STYLE,
  settings?: UserSettings
): Promise<string> {
  const cfg = settings ?? loadSettings();
  await assertApiKeyOrServerKey(cfg);
  const model = resolveModelForSettings('chat', cfg);
  const chatParams = getModelCallParams('chat');

  return chatRequest(
    cfg,
    [
      {
        role: 'system',
        content: mergeSystemPrompt(chatParams.systemTone, getChatStylePrompt(style)),
      },
      { role: 'user', content: userText },
    ],
    {
      modelOverride: model,
      jsonMode: false,
      task: 'chat',
    }
  );
}

function parseSoulChatReplyLines(raw: string, count = 5): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter((line) => line.length >= 2 && !lineLooksLikeReasoningLeak(line))
    .slice(0, count);
}

/**
 * 聚合 API / OpenAI 兼容 · 一次生成 5 条高情商回复
 * @param oppositeMsg 对方说的话
 * @param currentStyle 当前风格（如：温柔一点、暧昧一点、更短）
 * @param settings 可选；provider 设为 juhe 时使用 gpt-5.4-mini（可改 manualChatModel）
 */
export async function getSoulChatReplies(
  oppositeMsg: string,
  currentStyle = '温柔一点',
  settings?: UserSettings
): Promise<string[]> {
  const cfg = settings ?? loadSettings();
  await assertApiKeyOrServerKey(cfg);

  if (!oppositeMsg?.trim()) {
    throw new Error('请输入对方的消息');
  }

  const model = resolveModelForSettings('chat', cfg);
  const chatParams = getModelCallParams('chat');
  const toneHint = currentStyle?.trim() || '自然口语';

  const systemPrompt = `你是 Soul 聊天心理助手，专门生成高情商社交回复。
风格要求：${toneHint}
输出规则：
1. 只输出 5 条独立短句，每条单独一行
2. 语气自然、口语化，适合直接复制发给对方
3. 不要序号、不要解释、不要多余内容`;

  try {
    const raw = await chatRequest(
      cfg,
      [
        {
          role: 'system',
          content: mergeSystemPrompt(chatParams.systemTone, systemPrompt),
        },
        { role: 'user', content: `对方说：${oppositeMsg.trim()}` },
      ],
      {
        modelOverride: model,
        jsonMode: false,
        task: 'chat',
        temperature: 0.85,
        maxTokens: 600,
        useNonStream: true,
      }
    );

    const replies = parseSoulChatReplyLines(raw, 5);
    if (replies.length >= 1) return replies;
    return [raw.trim() || '未生成有效话术，请重试'];
  } catch (error) {
    console.error('getSoulChatReplies 失败：', error);
    throw error instanceof Error ? error : new Error('网络错误，请稍后再试');
  }
}

export async function analyzeConversation(
  messages: ChatMessage[],
  settings: UserSettings,
  targetMessage?: string,
  onProgress?: (progress: StreamProgress) => void,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  throwIfAborted(signal);

  const emitProgress = createProgressEmitter(onProgress);
  let userContent = buildConversationContext(messages, settings);

  if (targetMessage) {
    userContent += `\n\n【重点分析消息】\n${targetMessage}`;
  }

  if (userContent === EMPTY_CONVERSATION_HINT) {
    throw new Error(EMPTY_CONVERSATION_HINT);
  }

  const analysisModel = resolveModelForSettings('deepAnalysis', settings);
  const replyModel = resolveModelForSettings('chat', settings);
  const analysisParams = getModelCallParams('deepAnalysis');
  const lastOtherForRun = getLastOtherMessage(messages, targetMessage);
  const effectiveForRun = resolveSituationSettings(settings, messages, targetMessage);
  const openingModeForRun = shouldUseOpeningGuide(lastOtherForRun, effectiveForRun.chatScene);
  const quickStub = buildQuickAnalysisStub(messages, settings, targetMessage);
  const useCombinedFast = shouldUseCombinedFastPath(settings, analysisModel, replyModel);

  if (useCombinedFast) {
    const effective = resolveSituationSettings(settings, messages, targetMessage);
    const activeStyles = pickStylesForGeneration(
      resolveReplyStyles(effective, lastOtherForRun),
      effective
    );
    const combinedModel = replyModel;

    emitProgress({
      phase: 'analysis',
      message: `加速模式：分析+话术一次生成（${getModelLabelById(combinedModel, settings.provider)}）`,
      analysisPreview: {},
      replyPreviews: [],
      activeModel: combinedModel,
    });

    try {
      const raw = await chatRequest(
        settings,
        [
          {
            role: 'system',
            content: mergeSystemPrompt(
              analysisParams.systemTone,
              COMBINED_FAST_SYSTEM_PROMPT
            ),
          },
          {
            role: 'user',
            content: buildCombinedFastUserContent(
              messages,
              settings,
              targetMessage,
              activeStyles
            ),
          },
        ],
        {
          modelOverride: combinedModel,
          jsonMode: true,
          task: 'chat',
          maxTokens: COMBINED_FAST_MAX_TOKENS,
          signal,
        }
      );

      const combined = tryParseCombinedFastResponse(
        raw,
        settings,
        messages,
        targetMessage,
        activeStyles
      );

      if (
        combined &&
        countQualityReplies(combined.replies, lastOtherForRun, openingModeForRun) >= 2
      ) {
        const finalCombinedReplies = ensureValidReplies(
          combined.replies,
          lastOtherForRun,
          openingModeForRun
        );
        emitProgress(
          {
            phase: 'finishing',
            message: '分析+话术已完成',
            analysisPreview: {
              summary: combined.analysis.summary,
              primary: combined.analysis.emotion.primary,
              intensity: combined.analysis.emotion.intensity,
            },
            replyPreviews: finalCombinedReplies.map((r) => ({
              label: r.label,
              content: r.content,
            })),
            activeModel: combinedModel,
          },
          0,
          'combined-done'
        );

        return {
          ...attachStrategyCardsFromReplies(combined.analysis, finalCombinedReplies),
          topReplies: [],
          replies: finalCombinedReplies,
        };
      }
    } catch (err) {
      console.warn('[CombinedFast] 失败，回退分步生成:', err);
    }
  }

  emitProgress({
    phase: 'analysis',
    message: `① 心理分析（${getModelLabelById(analysisModel, settings.provider)}）→ ② 话术（${getModelLabelById(replyModel, settings.provider)}）`,
    analysisPreview: {},
    replyPreviews: [],
    activeModel: analysisModel,
    pendingReplyModel: replyModel,
  });

  const compactUserContent = buildCompactAnalysisUserContent(messages, settings, targetMessage);
  const useFullAnalysisPrompt = shouldUseFullAnalysisPrompt(settings, analysisModel);

  const analysisPromise = chatRequest(
    settings,
    [
      {
        role: 'system',
        content: useFullAnalysisPrompt
          ? mergeSystemPrompt(analysisParams.systemTone, buildStyledAnalysisSystemPrompt(settings.chatStyle))
          : mergeSystemPrompt(analysisParams.systemTone, COMPACT_ANALYSIS_SYSTEM_PROMPT),
      },
      {
        role: 'user',
        content: useFullAnalysisPrompt ? userContent : compactUserContent,
      },
    ],
    {
      modelOverride: analysisModel,
      jsonMode: true,
      task: 'deepAnalysis',
      useNonStream: true,
      onModelResolved: (info) => {
        emitProgress(
          {
            phase: 'analysis',
            message: info.modelSwitched ? '已切换备选模型，继续分析…' : '正在快速分析…',
            analysisPreview: {},
            replyPreviews: [],
            activeModel: info.model ?? analysisModel,
            requestedModel: info.requestedModel,
            modelSwitched: info.modelSwitched,
          },
          0,
          `model-${info.model}`
        );
      },
      onStatus: (status) => {
        if (status.type === 'switching' && status.model) {
          const label = getModelLabelById(status.model, settings.provider);
          emitProgress(
            {
              phase: 'analysis',
              message: `上游繁忙，切换至 ${label}…`,
              analysisPreview: {},
              replyPreviews: [],
              activeModel: status.model,
              modelSwitched: true,
            },
            0,
            `switch-${status.model}`
          );
        } else if (status.type === 'cooldown') {
          emitProgress(
            {
              phase: 'analysis',
              message: status.delayMs
                ? `连接异常，${Math.round(status.delayMs / 1000)} 秒后重试…`
                : '连接异常，正在重试…',
              analysisPreview: {},
              replyPreviews: [],
              activeModel: analysisModel,
            },
            0,
            'cooldown'
          );
        } else if (status.type === 'provider_fallback') {
          emitProgress(
            {
              phase: 'analysis',
              message: '爱易威繁忙，走 OpenRouter 备用线路…',
              analysisPreview: {},
              replyPreviews: [],
              activeModel: analysisModel,
              modelSwitched: true,
            },
            0,
            'provider-fallback'
          );
        }
      },
      signal,
    }
  ).then((raw) => {
    try {
      const base = parseAnalysisContent(raw, settings, lastOtherForRun);
      emitProgress(
        {
          phase: 'parsing',
          message: base.analysisDegraded
            ? '分析内容偏少，已标记为不完整（建议重试）'
            : '分析报告已完成',
          analysisPreview: {
            summary: base.summary,
            primary: base.emotion.primary,
            secondary: base.emotion.secondary,
            intensity: base.emotion.intensity,
            trend: base.emotion.trend,
          },
          replyPreviews: [],
        },
        0,
        base.analysisDegraded ? 'parsed-thin' : 'parsed'
      );
      return base;
    } catch (err) {
      console.warn('[Analysis] JSON 解析失败，使用本地摘要:', err);
      const degraded = withAnalysisDegraded(
        quickStub,
        '模型返回非标准 JSON，已用本地摘要'
      );
      emitProgress(
        {
          phase: 'parsing',
          message: '模型返回格式异常，已用本地摘要（建议重试以获得完整分析）',
          analysisPreview: {
            summary: degraded.summary,
            primary: degraded.emotion.primary,
            intensity: degraded.emotion.intensity,
          },
          replyPreviews: [],
        },
        0,
        'parsed-fallback'
      );
      return degraded;
    }
  });

  // 分析请求失败：直接抛错，不再静默用 stub 继续出话术误导用户
  const analysisBase = await analysisPromise;

  throwIfAborted(signal);

  emitProgress(
    {
      phase: 'replies',
      message: analysisBase.analysisDegraded
        ? `分析不完整（本地摘要），仍尝试生成话术；建议稍后重试分析（${getModelLabelById(replyModel, settings.provider)}）`
        : `分析完成，按左侧结论生成 ${REPLY_SUGGESTION_COUNT} 条精准话术…（${getModelLabelById(replyModel, settings.provider)}）`,
      analysisPreview: {
        summary: analysisBase.summary,
        primary: analysisBase.emotion.primary,
        secondary: analysisBase.emotion.secondary,
        intensity: analysisBase.emotion.intensity,
        trend: analysisBase.emotion.trend,
      },
      replyPreviews: [],
      activeModel: replyModel,
    },
    0,
    'replies-after-analysis'
  );

  const replies = await generateStyleReplies(
    analysisBase,
    settings,
    messages,
    replyModel,
    emitProgress,
    targetMessage,
    signal
  );

  const finalReplies = ensureValidReplies(replies, lastOtherForRun, openingModeForRun);
  const analysisWithCards = attachStrategyCardsFromReplies(analysisBase, finalReplies);

  emitProgress(
    {
      phase: 'finishing',
      message: '正在整理话术…',
      replyPreviews: finalReplies.map((r) => ({ label: r.label, content: r.content })),
    },
    0,
    'finishing'
  );

  if (finalReplies.length < REPLY_STYLE_COUNT) {
    return {
      ...analysisWithCards,
      topReplies: [],
      replies: finalReplies,
      summary: `${analysisWithCards.summary}（话术 ${finalReplies.length}/${REPLY_SUGGESTION_COUNT} 条，可重新分析补全）`,
    };
  }

  return { ...analysisWithCards, topReplies: [], replies: finalReplies };
}

export interface ApiHealthInfo {
  ok: boolean;
  serverKeyConfigured: boolean;
  openRouterFallback?: boolean;
}

export async function checkApiHealth(): Promise<ApiHealthInfo> {
  if (import.meta.env.MODE === 'test') {
    return { ok: false, serverKeyConfigured: false };
  }
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false, serverKeyConfigured: false };
    const data = await res.json();
    return {
      ok: true,
      serverKeyConfigured: Boolean(data.serverKeyConfigured),
      openRouterFallback: Boolean(data.openRouterFallback),
    };
  } catch {
    return { ok: false, serverKeyConfigured: false };
  }
}

export async function callModel(
  modelId: string,
  userMessage: string,
  settings?: UserSettings,
  style?: ChatStyleType
): Promise<string> {
  const cfg = settings ?? loadSettings();
  await assertApiKeyOrServerKey(cfg);
  const provider = cfg.provider;
  const defaultModel = resolveModelForSettings('chat', cfg);
  const chatStyle = style ?? cfg.chatStyle;
  const chatParams = getModelCallParams('chat');

  return chatViaFetch(
    { ...cfg, provider },
    [
      {
        role: 'system',
        content: mergeSystemPrompt(chatParams.systemTone, getChatStylePrompt(chatStyle)),
      },
      { role: 'user', content: userMessage },
    ],
    modelId || defaultModel,
    false,
    undefined,
    undefined,
    undefined,
    'chat'
  );
}

export async function streamCall(
  model: string,
  prompt: string,
  onChunk: (text: string) => void,
  settings?: UserSettings,
  style?: ChatStyleType
): Promise<string> {
  const cfg = settings ?? loadSettings();
  await assertApiKeyOrServerKey(cfg);
  const provider = cfg.provider;
  const defaultModel = resolveModelForSettings('chat', cfg);
  const chatStyle = style ?? cfg.chatStyle;
  const chatParams = getModelCallParams('chat');

  return chatRequest(
    { ...cfg, provider },
    [
      {
        role: 'system',
        content: mergeSystemPrompt(chatParams.systemTone, getChatStylePrompt(chatStyle)),
      },
      { role: 'user', content: prompt },
    ],
    {
      modelOverride: model || defaultModel,
      jsonMode: false,
      task: 'chat',
      onChunk,
    }
  );
}
