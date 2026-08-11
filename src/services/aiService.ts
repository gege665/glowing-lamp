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
import { buildStyledAnalysisSystemPrompt } from '../constants/chatStylePrompts';
import { resolveActiveStylePrompt } from '../constants/lovePersonas';
import { buildLingyanStageBlock } from '../constants/lingyanMaster';
import { LINGYAN_EMOTION_RADAR_DIRECTIVE } from '../constants/emotionRadar';
import { LINGYAN_RISK_CONTROL_DIRECTIVE, normalizeRiskAssessment } from '../constants/riskControl';
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
  isFriendApprovalMessage,
} from '../utils/targetedReply';
import {
  getLastOtherMessage,
  shouldUseOpeningGuide,
  buildSituationContextBlock,
  resolveSituationSettings,
} from '../utils/situationContext';
import {
  detectBatchQualityIssues,
  isValidReplyLine,
} from '../utils/replyQuality';
import {
  diversifyReplySuggestions,
  countDistinctReplies,
  resolveDiverseFallbacks,
  padRepliesToMinimum,
  MIN_DISPLAY_REPLIES,
  arrangeMultiPlanWithRecommendation,
} from '../utils/replyDiversity';
import {
  analysisResultCache,
  buildAnalysisCacheKey,
  healthCheckCache,
} from '../utils/computeCache';
import {
  exposePerfToWindow,
  measureAsync,
  recordPerfEvent,
} from '../utils/perfMetrics';
import {
  formatUpstreamBusyUserMessage,
  isUpstreamBusyMessage,
} from '../utils/upstreamErrors';
import {
  abortableSleep,
  combineAbortSignals,
  rethrowAbortAsUserOrTimeout,
  throwIfAborted,
} from '../utils/abortSleep';
import { apiFetch } from '../utils/apiFetch';
import {
  getTransportBackoffMs,
  isRetryableTransportError,
  MAX_CLIENT_TRANSPORT_RETRIES,
} from '../utils/retryPolicy';
import { buildProfileContextBlock } from '../utils/profileContext';
import { buildChatMemoryBlock } from '../utils/chatMemory';
import { buildAnalysisInsightBlock, buildSourceContextHint } from '../utils/analysisReplyBridge';
import { buildSceneStylePromptBlock } from '../constants/coreReplyStyles';
import {
  buildSceneReplyGuideBlock,
  OPENING_STYLE_FALLBACKS,
  lineLooksLikeOpeningCringe,
} from '../constants/sceneReplyGuides';
import {
  buildPracticalEqBlockFromAnalysis,
  resolvePracticalScene,
  scorePracticalReply,
  type PracticalScene,
} from '../constants/practicalEqExpert';
import { isOpenAiModelId } from '../constants/openaiModels';
import { parseAnalysisJsonObject } from '../utils/analysisJsonParse';
import {
  extractCombinedReplyText,
  extractRepliesFromModelOutput,
  parseModelRepliesToSuggestions,
} from '../utils/replyCombinedParse';
import { EMOTION_RADAR_TYPES } from '../constants/productFeatures';

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  return name === 'AbortError';
}

function isNonRecoverableAnalysisError(err: unknown): boolean {
  if (isAbortError(err)) return true;
  if (!(err instanceof Error)) return false;
  return /API Key|401|403|429|未授权|验证|配额|余额|payment|invalid.*key/i.test(err.message);
}

/** 合并结果是否值得 salvage（非空壳分析） */
function isSalvageableAnalysis(
  analysis: Omit<AnalysisResult, 'replies' | 'topReplies'> | null | undefined
): boolean {
  if (!analysis) return false;
  const tip = analysis.femalePsychology?.scenarioTip?.trim();
  const sub = analysis.psychology?.subtext?.trim();
  const core = analysis.strategy?.coreStrategy?.trim();
  const summary = analysis.summary?.trim();
  if (summary && summary !== '分析完成' && (tip || sub || core)) return true;
  return Boolean(tip && sub);
}

exposePerfToWindow();

const REPLY_BATCH_MAX_TOKENS = 520;
/** 手动选模时锁定，禁止服务端自动降级到豆包 */
function isManualModelLock(settings: UserSettings): boolean {
  return settings.modelMode === 'manual';
}
/** 行数不足或质量不合格时，最多 1 次合并修复（避免 incomplete+quality 串行双请求） */
const REPLY_REPAIR_MAX = 1;
/** 已有足够条数则跳过后续重试/兜底请求 */
const REPLY_FAST_ACCEPT_COUNT = 3;
/** 同指纹进行中的分析请求（防双击打爆上游） */
const inflightAnalysis = new Map<string, Promise<AnalysisResult>>();

/** 中止分析时清空 in-flight，避免后续请求复用已 abort 的 Promise */
export function clearInflightAnalysis(): void {
  inflightAnalysis.clear();
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException('Aborted', 'AbortError')
    );
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('Aborted', 'AbortError')
      );
    };
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        cleanup();
        resolve(v);
      },
      (err) => {
        cleanup();
        reject(err);
      }
    );
  });
}
/** 客户端 SSE / API 单次请求超时（毫秒） */
const CLIENT_REQUEST_TIMEOUT_MS = 120_000;

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
    shitTestNote: raw?.shitTestNote || '',
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

/** 刚加好友：废句被滤掉后用风格兜底，避免空白或再次生成垃圾 */
function applyOpeningFallbacks(
  replies: ReplySuggestion[],
  openingMode: boolean
): ReplySuggestion[] {
  if (!openingMode) return replies;
  return replies.map((r) => {
    const content = r.content.trim();
    if (content && !lineLooksLikeOpeningCringe(content)) return r;
    const fallback = OPENING_STYLE_FALLBACKS[r.label];
    return fallback ? { ...r, content: fallback } : r;
  });
}

/** 差异化 → 补足 ≥3 条 → 排成「3 方案 + 1 智能推荐」 */
function finalizeReplyOptions(
  replies: ReplySuggestion[],
  practicalScene?: PracticalScene,
  openingMode = false,
  identityVerify = false
): ReplySuggestion[] {
  const fallbacks = resolveDiverseFallbacks(openingMode);
  const diversified = diversifyReplySuggestions(replies, fallbacks);
  const padded = padRepliesToMinimum(diversified, MIN_DISPLAY_REPLIES, fallbacks);
  const arranged = arrangeMultiPlanWithRecommendation(padded, (content) =>
    scorePracticalReply(content, practicalScene, { identityVerify })
  );
  // 前 3 条保持方案顺序；推荐已在第 4 槽，不再全局打乱
  return arranged;
}

function buildCombinedFastUserContent(
  messages: ChatMessage[],
  settings: UserSettings,
  targetMessage: string | undefined,
  activeStyles: ReplyStyleDefinition[]
): string {
  const styleLabels = activeStyles.map((s) => s.label).join('、');
  const n = activeStyles.length;
  return `${buildCompactAnalysisUserContent(messages, settings, targetMessage)}

【${n} 条话术 · 顺序与风格】${styleLabels}
replies 数组恰好 ${n} 项，每项一条可发送原话，须与分析 scenarioTip 一致。`;
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

  const effective = resolveSituationSettings(settings, messages, targetMessage);
  const openingMode = shouldUseOpeningGuide(lastOther, effective.chatScene);
  // 此处只做过滤/开场兜底；差异化与排序留给最终 ensureValidReplies，避免双重 finalize
  replies = applyOpeningFallbacks(
    filterRepliesForDisplay(replies, lastOther, openingMode),
    openingMode
  );

  if (countQualityReplies(replies, lastOther, openingMode) < 1) return null;
  if (countDistinctReplies(replies) < 2) return null;

  return { analysis, replies };
}

function buildSettingsContext(settings: UserSettings, messages: ChatMessage[] = []): string {
  const stages =
    settings.relationshipStages?.length > 0
      ? settings.relationshipStages.join('、')
      : '暧昧';
  const focus =
    settings.strategyFocus?.length > 0
      ? settings.strategyFocus.join('、')
      : '心理穿透、推拉技巧';
  const profileBlock = buildProfileContextBlock(settings, messages);
  const stageBlock = buildLingyanStageBlock(settings.relationshipStages ?? ['暧昧']);
  const toneHint = settings.tonePreference?.trim()
    ? `\n【输入法风格指令】${settings.tonePreference.trim()}`
    : '';
  return `【灵焰恋爱大师】按对方消息 + 完整上下文 + 关系阶段生成分析与话术。
${LINGYAN_EMOTION_RADAR_DIRECTIVE}
${LINGYAN_RISK_CONTROL_DIRECTIVE}
${stageBlock}
【关系阶段（可多选，覆盖流程：${RELATIONSHIP_FLOW_HINT}）】${stages}
【策略侧重（分析与话术均需体现）】${focus}${toneHint}${profileBlock ? `\n\n${profileBlock}` : ''}`;
}

function buildConversationContext(messages: ChatMessage[], settings: UserSettings): string {
  const history = messages
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
  if (isFriendApprovalMessage(lastOther) || shouldUseOpeningGuide(lastOther, settings.chatScene)) {
    summary = '刚通过，适合轻破冰';
    scenarioTip = '好奇+细节+共鸣，禁止自报来意/自我介绍腔';
  } else if (intent.asksIdentity) {
    summary = '她在核实你是谁';
    scenarioTip = '先简明自报身份+来源';
  } else if (intent.asksPurpose) {
    summary = '她在问什么事';
    scenarioTip = '直接说明来意';
  } else if (intent.isWary) {
    summary = '她有防备心';
    scenarioTip = '先尊重她的质疑';
  }

  return {
    summary,
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
      relationshipStage: settings.relationshipStages?.[0] ?? '暧昧',
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
      shitTestNote: intent.isWary ? '边界核验，偏安全试探，未必恶意' : '',
    },
    strategy: {
      coreStrategy: intent.asksIdentity || intent.isWary ? '先稳再近：简明清身份与来源' : scenarioTip,
      whyStrategy: intent.isWary
        ? '她要可控感；先答清戒备才降，后面才聊得开'
        : '',
      emotionSwap: '',
      frameAdjust: '',
      communicationStrategy: '',
      warnings: intent.isWary ? ['别糊弄、别装熟'] : [],
      nextMove: scenarioTip,
    },
    analyzedAt: Date.now(),
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
    shitTestNote: '',
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
          {
            identityVerify: identityVerify && !useOpening,
            tonePreference: effective.tonePreference,
          }
        )
      : '';
  const specificDirective = buildMessageSpecificDirective(lastOtherRaw, effective.chatScene);
  const analysisBlock = buildAnalysisInsightBlock(analysis);
  const practicalBlock = identityVerify
    ? `【核实身份 · 灵焰公式】对方在问你是谁/什么事。每条：身份+来源+来意+轻钩子；禁空接「嗯然后呢/没事聊聊」。`
    : buildPracticalEqBlockFromAnalysis(
        analysis,
        effective.relationshipStages ?? [],
        effective.chatScene
      );
  const sourceHint = buildSourceContextHint(messages, effective);
  const styleBlock = buildSceneStylePromptBlock(effective);
  const toneHint = effective.tonePreference?.trim()
    ? `【输入法风格指令】${effective.tonePreference.trim()}`
    : '';

  return `${analysisBlock}

${practicalBlock}

${profileBlock ? `${profileBlock}\n\n` : ''}${situationBlock}

${sourceHint}

${styleBlock ? `${styleBlock}\n\n` : ''}${toneHint ? `${toneHint}\n\n` : ''}${sceneGuide ? `${sceneGuide}\n\n` : ''}【对方最后一句 · 4 条都要精准回应这句】
${effective.otherNickname}：「${lastOther || lastOtherRaw}」

${specificDirective}

【教练路径 · 话术须落实】心思：${analysis.psychology?.subtext || analysis.summary} → 策略：${analysis.strategy?.coreStrategy || analysis.strategy?.nextMove || '—'} → 方向：${fp.scenarioTip || analysis.strategy?.nextMove || '—'}
${analysis.strategy?.whyStrategy ? `为什么：${analysis.strategy.whyStrategy}` : ''}
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

type ReplyRetryReason = 'incomplete' | 'meta' | 'official' | 'offTopic' | 'greasy';

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
    case 'greasy':
      return `${head}
- 禁止客套卑微、土味油腻情话、查户口审讯、撒谎夸大
- 禁止「我叫XX，刚通过/刚加你打招呼」「别急着拉黑」等开场废句
- 自然、不刻意、不卑不亢；短句有落点，稍微拉近距离但不油腻
- 刚加好友时：未问身份不要报名字，4 条气质必须拉开`;
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

      return measureAsync(
        retryReason ? 'reply_retry' : 'reply_batch',
        () =>
          chatRequest(
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
          ),
        { retry: Boolean(retryReason) }
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

    if (bestValid < 1) {
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

    // 单次修复：行数不足或质量差时最多再打 1 次上游（合并原 incomplete + quality 双循环）
    const qualityCount = countQualityReplies(
      applyDisplayFilter(bestParsed),
      lastOtherForReply,
      openingMode
    );
    const qualityIssues = bestRaw.trim()
      ? detectBatchQualityIssues(bestRaw, lastOtherForReply)
      : [];
    const needsRepair =
      (bestValid < expected && bestValid < REPLY_FAST_ACCEPT_COUNT) ||
      (qualityCount < REPLY_FAST_ACCEPT_COUNT && qualityIssues.length > 0);

    if (needsRepair && REPLY_REPAIR_MAX > 0) {
      const reason: ReplyRetryReason =
        bestValid < expected
          ? 'incomplete'
          : ((qualityIssues[0] as ReplyRetryReason) || 'meta');
      try {
        const retryRaw = await fetchBatch(reason, undefined, bestValid === 0);
        const retryParsed = applyDisplayFilter(parseRaw(retryRaw, bestValid === 0));
        const retryValid = retryParsed.filter((p) => p.content.trim().length >= 2).length;
        const retryQuality = countQualityReplies(retryParsed, lastOtherForReply, openingMode);
        if (retryQuality > qualityCount || retryValid > bestValid) {
          bestRaw = retryRaw;
          bestParsed = retryParsed;
          bestValid = retryValid;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
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
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return partial;
    }
  }

  const batchResults = await Promise.all(
    REPLY_GENERATION_BATCHES.map(async ({ start, end, title }) => {
      try {
        return await runSingleBatch(start, end, title, replyModel);
      } catch (primaryErr) {
        const errMsg =
          primaryErr instanceof Error ? primaryErr.message : '话术生成失败';
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
          throw fallbackErr instanceof Error ? fallbackErr : new Error(errMsg);
        }
      }
    })
  );

  for (const parsed of batchResults) {
    all.push(...parsed);
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

  const openingMode = shouldUseOpeningGuide(lastOtherForReply, effective.chatScene);
  const identityVerify = (() => {
    const intent = detectMessageIntent(lastOtherForReply);
    return intent.asksIdentity || intent.asksPurpose || intent.isWary;
  })();
  const preFillQuality = countQualityReplies(all, lastOtherForReply, openingMode);
  const maybeFilled =
    preFillQuality >= REPLY_FAST_ACCEPT_COUNT
      ? all
      : await fillMissingReplies(all, replyModel);
  const filtered = applyOpeningFallbacks(
    filterRepliesForDisplay(maybeFilled, lastOtherForReply, openingMode),
    openingMode
  );
  const practicalScene = resolvePracticalScene(
    effective.relationshipStages ?? [],
    effective.chatScene,
    analysisBase.emotion?.primary
  );
  return finalizeReplyOptions(filtered, practicalScene, openingMode, identityVerify);
}

function ensureValidReplies(
  replies: ReplySuggestion[],
  lastOther: string,
  openingMode: boolean,
  practicalScene?: PracticalScene
): ReplySuggestion[] {
  const intent = detectMessageIntent(lastOther);
  const identityVerify = intent.asksIdentity || intent.asksPurpose || intent.isWary;
  const filtered = applyOpeningFallbacks(
    filterRepliesForDisplay(replies, lastOther, openingMode),
    openingMode
  );
  if (countQualityReplies(filtered, lastOther, openingMode) >= 1) {
    return finalizeReplyOptions(filtered, practicalScene, openingMode, identityVerify);
  }
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
  const riskAssessment = normalizeRiskAssessment(riskRaw);

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

  return {
    summary: parsed.summary || '分析完成',
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
      coreStrategy:
        parsed.strategy?.coreStrategy ||
        parsed.strategy?.communicationStrategy ||
        parsed.strategy?.nextMove ||
        '',
      whyStrategy: parsed.strategy?.whyStrategy || '',
      emotionSwap: parsed.strategy?.emotionSwap || '',
      frameAdjust: parsed.strategy?.frameAdjust || '',
      communicationStrategy: parsed.strategy?.communicationStrategy || '',
      warnings,
      nextMove: parsed.strategy?.nextMove || '',
    },
    emotionRadar,
    riskAssessment,
    relationshipMetrics,
    keyMoments,
    analyzedAt: Date.now(),
  };
}

type SsePayload = {
  type: string;
  content?: string;
  error?: string;
  model?: string;
  requestedModel?: string;
  modelSwitched?: boolean;
  status?: { type: string; model?: string; delayMs?: number; pass?: number; provider?: string };
};

type StreamStatusEvent = { type: string; model?: string; delayMs?: number; pass?: number; provider?: string };

function processSsePayload(
  payload: SsePayload,
  options?: {
    onChunk?: (full: string) => void;
    onModelResolved?: (info: {
      model?: string;
      requestedModel?: string;
      modelSwitched?: boolean;
    }) => void;
    onStatus?: (status: StreamStatusEvent) => void;
  }
): string | null {
  if (payload.type === 'status' && payload.status) {
    options?.onStatus?.(payload.status);
    return null;
  }
  if (payload.type === 'chunk' && payload.content) {
    options?.onChunk?.(payload.content);
    return payload.content;
  }
  if (payload.type === 'done' && payload.content) {
    options?.onChunk?.(payload.content);
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
  const callParams = resolveCallOptions(task, {
    jsonMode: options?.jsonMode,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
    topP: options?.topP,
  });

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutCtrl.abort(new DOMException('请求超时', 'AbortError'));
  }, CLIENT_REQUEST_TIMEOUT_MS);
  const { signal: mergedSignal, dispose } = combineAbortSignals([
    options?.signal,
    timeoutCtrl.signal,
  ]);
  const deadline = Date.now() + CLIENT_REQUEST_TIMEOUT_MS;

  let response: Response;
  try {
    response = await apiFetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    rethrowAbortAsUserOrTimeout(err, options?.signal);
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
    const content = processSsePayload(payload, options);
    if (content) finalContent = content;
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
        throw new Error('请求超时');
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

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutCtrl.abort(new DOMException('请求超时', 'AbortError'));
  }, CLIENT_REQUEST_TIMEOUT_MS);
  const { signal: mergedSignal, dispose } = combineAbortSignals([signal, timeoutCtrl.signal]);

  let response: Response;
  try {
    response = await apiFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    rethrowAbortAsUserOrTimeout(err, signal);
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

export async function analyzeConversation(
  messages: ChatMessage[],
  settings: UserSettings,
  targetMessage?: string,
  onProgress?: (progress: StreamProgress) => void,
  signal?: AbortSignal,
  options?: { bypassCache?: boolean }
): Promise<AnalysisResult> {
  throwIfAborted(signal);
  const tTotal = performance.now();

  const emitProgress = createProgressEmitter(onProgress);
  let userContent = buildConversationContext(messages, settings);

  if (targetMessage) {
    userContent += `\n\n【重点分析消息】\n${targetMessage}`;
  }

  if (userContent === EMPTY_CONVERSATION_HINT) {
    throw new Error(EMPTY_CONVERSATION_HINT);
  }

  const cacheKey = buildAnalysisCacheKey({
    messages,
    targetMessage,
    provider: settings.provider,
    chatScene: settings.chatScene,
    primaryReplyStyle: settings.primaryReplyStyle,
    relationshipStages: settings.relationshipStages,
    chatStyle: settings.chatStyle,
    appMode: settings.appMode,
    modelMode: settings.modelMode,
    manualChatModel: settings.manualChatModel,
    manualAnalysisModel: settings.manualAnalysisModel,
    tonePreference: settings.tonePreference,
    lovePersona: settings.lovePersona,
  });

  if (!options?.bypassCache) {
    const cached = analysisResultCache.get(cacheKey) as AnalysisResult | undefined;
    if (cached?.replies?.some((r) => r.content?.trim())) {
      recordPerfEvent('cache_hit', performance.now() - tTotal, true);
      emitProgress(
        {
          phase: 'finishing',
          message: '命中缓存，跳过重复计算',
          analysisPreview: {
            summary: cached.summary,
            primary: cached.emotion?.primary,
            intensity: cached.emotion?.intensity,
          },
          replyPreviews: cached.replies.map((r) => ({
            label: r.label,
            content: r.content,
          })),
        },
        0,
        'cache-hit'
      );
      recordPerfEvent('analysis_total', performance.now() - tTotal, true, {
        path: 'cache',
      });
      return cached;
    }
    recordPerfEvent('cache_miss', 0, true);

    const inflight = inflightAnalysis.get(cacheKey);
    if (inflight) {
      recordPerfEvent('inflight_dedupe', performance.now() - tTotal, true);
      emitProgress(
        {
          phase: 'analysis',
          message: '同请求进行中，复用结果…',
          analysisPreview: {},
          replyPreviews: [],
        },
        0,
        'inflight-dedupe'
      );
      try {
        return await raceWithAbort(inflight, signal);
      } catch (err) {
        // 本调用已取消：直接抛出
        if (isAbortError(err) && signal?.aborted) throw err;
        // 共享请求被他人 abort / 失败：清掉脏 entry，重新发起
        if (inflightAnalysis.get(cacheKey) === inflight) {
          inflightAnalysis.delete(cacheKey);
        }
      }
    }
  }

  const pending = runAnalysisPipeline(
    messages,
    settings,
    targetMessage,
    emitProgress,
    signal,
    cacheKey,
    tTotal,
    userContent
  );
  if (!options?.bypassCache) {
    inflightAnalysis.set(cacheKey, pending);
  }
  try {
    return await pending;
  } finally {
    if (inflightAnalysis.get(cacheKey) === pending) {
      inflightAnalysis.delete(cacheKey);
    }
  }
}

async function runAnalysisPipeline(
  messages: ChatMessage[],
  settings: UserSettings,
  targetMessage: string | undefined,
  emitProgress: ReturnType<typeof createProgressEmitter>,
  signal: AbortSignal | undefined,
  cacheKey: string,
  tTotal: number,
  userContent: string
): Promise<AnalysisResult> {
  const analysisModel = resolveModelForSettings('deepAnalysis', settings);
  const replyModel = resolveModelForSettings('chat', settings);
  const analysisParams = getModelCallParams('deepAnalysis');
  const lastOtherForRun = getLastOtherMessage(messages, targetMessage);
  const effectiveForRun = resolveSituationSettings(settings, messages, targetMessage);
  const openingModeForRun = shouldUseOpeningGuide(lastOtherForRun, effectiveForRun.chatScene);
  const quickStub = buildQuickAnalysisStub(messages, settings, targetMessage);
  const useCombinedFast = shouldUseCombinedFastPath(settings, analysisModel, replyModel);

  /** 合并模式部分成功时复用分析，跳过第二次分析请求 */
  let salvagedAnalysis: Omit<AnalysisResult, 'replies' | 'topReplies'> | null = null;

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
      const raw = await measureAsync(
        'combined_fast',
        () =>
          chatRequest(
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
          ),
        { model: combinedModel }
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
          openingModeForRun,
          resolvePracticalScene(
            effectiveForRun.relationshipStages ?? [],
            effectiveForRun.chatScene,
            combined.analysis.emotion?.primary
          )
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

        const result: AnalysisResult = {
          ...combined.analysis,
          topReplies: [],
          replies: finalCombinedReplies,
        };
        analysisResultCache.set(cacheKey, result);
        recordPerfEvent('analysis_total', performance.now() - tTotal, true, {
          path: 'combined',
        });
        return result;
      }

      // 话术不足但分析实质可用：跳过二次分析，只补话术
      if (isSalvageableAnalysis(combined?.analysis)) {
        salvagedAnalysis = combined!.analysis;
        recordPerfEvent('salvage_skip_analysis', 0, true);
      }
    } catch (err) {
      if (isNonRecoverableAnalysisError(err)) throw err;
      console.warn('[CombinedFast] 失败，回退分步生成:', err);
    }
  }

  if (salvagedAnalysis) {
    emitProgress({
      phase: 'replies',
      message: `复用加速分析，仅补全话术（${getModelLabelById(replyModel, settings.provider)}）`,
      analysisPreview: {
        summary: salvagedAnalysis.summary,
        primary: salvagedAnalysis.emotion.primary,
        intensity: salvagedAnalysis.emotion.intensity,
      },
      replyPreviews: [],
      activeModel: replyModel,
    });

    const replies = await generateStyleReplies(
      salvagedAnalysis,
      settings,
      messages,
      replyModel,
      emitProgress,
      targetMessage,
      signal
    );
    const finalReplies = ensureValidReplies(
      replies,
      lastOtherForRun,
      openingModeForRun,
      resolvePracticalScene(
        effectiveForRun.relationshipStages ?? [],
        effectiveForRun.chatScene,
        salvagedAnalysis.emotion?.primary
      )
    );
    const result: AnalysisResult = {
      ...salvagedAnalysis,
      topReplies: [],
      replies: finalReplies,
    };
    analysisResultCache.set(cacheKey, result);
    recordPerfEvent('analysis_total', performance.now() - tTotal, true, {
      path: 'salvage',
    });
    return result;
  }

  const intentForDual = detectMessageIntent(lastOtherForRun);
  const identityVerifyDual =
    intentForDual.asksIdentity || intentForDual.asksPurpose || intentForDual.isWary;

  emitProgress({
    phase: 'analysis',
    message: identityVerifyDual
      ? `核实身份：先分析再话术（${getModelLabelById(analysisModel, settings.provider)} → ${getModelLabelById(replyModel, settings.provider)}）`
      : `并行加速：分析（${getModelLabelById(analysisModel, settings.provider)}）∥ 话术（${getModelLabelById(replyModel, settings.provider)}）`,
    analysisPreview: {
      summary: quickStub.summary,
      primary: quickStub.emotion.primary,
      intensity: quickStub.emotion.intensity,
    },
    replyPreviews: [],
    activeModel: analysisModel,
    pendingReplyModel: replyModel,
  });
  // 核实身份：先分析再话术，避免 stub/开场指令与教练策略打架
  if (!identityVerifyDual) {
    recordPerfEvent('dual_parallel', 0, true);
  }

  const compactUserContent = buildCompactAnalysisUserContent(messages, settings, targetMessage);
  const useFullAnalysisPrompt = shouldUseFullAnalysisPrompt(settings, analysisModel);

  // 非核实场景：话术与分析并行；核实身份则等分析结论再用同一策略出话术
  const repliesPromise = identityVerifyDual
    ? null
    : generateStyleReplies(
        quickStub,
        settings,
        messages,
        replyModel,
        emitProgress,
        targetMessage,
        signal
      );

  const analysisPromise = measureAsync(
    'analysis_only',
    () =>
      chatRequest(
        settings,
        [
          {
            role: 'system',
            content: useFullAnalysisPrompt
              ? mergeSystemPrompt(
                  analysisParams.systemTone,
                  settings.appMode === 'love'
                    ? `${resolveActiveStylePrompt(settings)}\n\n${COMPACT_ANALYSIS_SYSTEM_PROMPT}`
                    : buildStyledAnalysisSystemPrompt(settings.chatStyle)
                )
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
      ),
    { model: analysisModel }
  ).then((raw) => {
    try {
      const base = parseAnalysisContent(raw, settings, lastOtherForRun);
      emitProgress(
        {
          phase: 'parsing',
          message: '分析报告已完成',
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
        'parsed'
      );
      return base;
    } catch (err) {
      console.warn('[Analysis] JSON 解析失败，使用本地摘要:', err);
      emitProgress(
        {
          phase: 'parsing',
          message: '分析摘要已就绪（模型返回非标准 JSON，话术照常生成）',
          analysisPreview: {
            summary: quickStub.summary,
            primary: quickStub.emotion.primary,
            intensity: quickStub.emotion.intensity,
          },
          replyPreviews: [],
        },
        0,
        'parsed-fallback'
      );
      return quickStub;
    }
  });

  const analysisBase = await analysisPromise.catch((err) => {
    if (isNonRecoverableAnalysisError(err)) throw err;
    console.warn('[Analysis] 请求失败，使用本地摘要:', err);
    emitProgress(
      {
        phase: 'parsing',
        message: identityVerifyDual
          ? '分析请求失败，已用本地身份核实摘要继续生成话术'
          : '分析请求失败，已用本地摘要；话术并行结果仍可用',
        analysisPreview: {
          summary: quickStub.summary,
          primary: quickStub.emotion.primary,
          intensity: quickStub.emotion.intensity,
        },
        replyPreviews: [],
      },
      0,
      'parsed-request-fallback'
    );
    return quickStub;
  });

  throwIfAborted(signal);

  const replies = identityVerifyDual
    ? await generateStyleReplies(
        analysisBase,
        settings,
        messages,
        replyModel,
        emitProgress,
        targetMessage,
        signal
      )
    : await (repliesPromise as Promise<ReplySuggestion[]>);

  const finalReplies = ensureValidReplies(
    replies,
    lastOtherForRun,
    openingModeForRun,
    resolvePracticalScene(
      effectiveForRun.relationshipStages ?? [],
      effectiveForRun.chatScene,
      analysisBase.emotion?.primary
    )
  );

  emitProgress(
    {
      phase: 'finishing',
      message: '正在整理话术…',
      replyPreviews: finalReplies.map((r) => ({ label: r.label, content: r.content })),
    },
    0,
    'finishing'
  );

  const result: AnalysisResult =
    finalReplies.length < REPLY_STYLE_COUNT
      ? {
          ...analysisBase,
          topReplies: [],
          replies: finalReplies,
          summary: `${analysisBase.summary}（话术 ${finalReplies.length}/${REPLY_SUGGESTION_COUNT} 条，可重新分析补全）`,
        }
      : { ...analysisBase, topReplies: [], replies: finalReplies };

  analysisResultCache.set(cacheKey, result);
  recordPerfEvent('analysis_total', performance.now() - tTotal, true, {
    path: identityVerifyDual ? 'dual_identity_serial' : 'dual_parallel',
  });
  return result;
}

export interface ApiHealthInfo {
  ok: boolean;
  serverKeyConfigured: boolean;
  openRouterFallback?: boolean;
}

export async function checkApiHealth(): Promise<ApiHealthInfo> {
  const cached = healthCheckCache.get('health');
  if (cached) return cached;

  try {
    const res = await apiFetch('/api/health');
    if (!res.ok) return { ok: false, serverKeyConfigured: false };
    const data = await res.json();
    const info: ApiHealthInfo = {
      ok: true,
      serverKeyConfigured: Boolean(data.serverKeyConfigured),
      openRouterFallback: Boolean(data.openRouterFallback),
    };
    healthCheckCache.set('health', info);
    return info;
  } catch {
    return { ok: false, serverKeyConfigured: false };
  }
}

