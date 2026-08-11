import type { ReplySuggestion, UserSettings, AnalysisResult, ChatMessage } from '../types';
import { loadSettings } from './storageService';
import { normalizeApiKey } from '../utils/apiKey';
import { assertApiKeyConfigured } from './clientChatApi';
import { buildProfileContextBlock } from '../utils/profileContext';
import { getModelCallParams, mergeSystemPrompt } from '../constants/modelCallParams';
import { resolveModelForSettings } from '../constants/modelRouting';
import { getChatScene } from '../constants/coreReplyStyles';
import {
  pickStylesForGeneration,
  resolveReplyStyles,
  type ReplyStyleDefinition,
} from '../constants/replyStylePrompts';
import { COMPACT_REPLY_SYSTEM_PROMPT } from '../constants/analysisPrompts';
import {
  buildSceneReplyGuideBlock,
  lineLooksLikeOpeningCringe,
  scoreSceneReplies,
} from '../constants/sceneReplyGuides';
import { getReplyLengthCap } from '../constants/toneModifiers';
import {
  resolveSituationSettings,
  describeSituation,
  buildSituationContextBlock,
} from '../utils/situationContext';
import { parseIceBreakerOutput } from '../utils/iceBreakerParse';
import { normalizeReplyLine } from '../utils/replyParse';
import { lineLooksLikeReasoningLeak, lineLooksTooOfficial } from '../utils/replyQuality';
import {
  throwIfAborted,
  combineAbortSignals,
  rethrowAbortAsUserOrTimeout,
} from '../utils/abortSleep';
import { apiFetch } from '../utils/apiFetch';

const SCENE_REQUEST_TIMEOUT_MS = 120_000;

function isValidSceneLine(content: string, settings: UserSettings): boolean {
  const maxLen = getReplyLengthCap(settings.toneModifiers ?? []);
  if (!content || content.length < 4 || content.length > maxLen) return false;
  if (lineLooksLikeReasoningLeak(content)) return false;
  if (lineLooksTooOfficial(content)) return false;
  if (lineLooksLikeOpeningCringe(content)) return false;
  return true;
}

function parseLabeledReplies(
  raw: string,
  styles: ReplyStyleDefinition[],
  settings: UserSettings
): ReplySuggestion[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const slots: ReplySuggestion[] = styles.map((style) => ({
    category: style.category,
    label: style.label,
    content: '',
  }));

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
        replies?: { label?: string; content?: string }[];
        lines?: string[];
      };
      if (Array.isArray(parsed.replies)) {
        parsed.replies.forEach((item, i) => {
          if (!slots[i]) return;
          const content = normalizeReplyLine(String(item.content ?? ''));
          if (isValidSceneLine(content, settings)) {
            slots[i].content = content;
            if (item.label) slots[i].label = String(item.label);
          }
        });
      } else if (Array.isArray(parsed.lines)) {
        parsed.lines.forEach((line, i) => {
          if (!slots[i]) return;
          const content = normalizeReplyLine(String(line));
          if (isValidSceneLine(content, settings)) slots[i].content = content;
        });
      }
    } catch {
      /* fallback */
    }
  }

  if (slots.every((s) => !s.content)) {
    const lines = parseIceBreakerOutput(raw, styles.length);
    lines.forEach((content, i) => {
      if (slots[i] && isValidSceneLine(content, settings)) slots[i].content = content;
    });
  }

  return slots;
}

function buildScenePrompt(settings: UserSettings, styles: ReplyStyleDefinition[], messages: ChatMessage[] = []): string {
  const effective = resolveSituationSettings(settings, messages);
  const profileBlock = buildProfileContextBlock(effective, messages);
  const situationBlock = buildSituationContextBlock(effective, messages);
  const guideBlock = buildSceneReplyGuideBlock(
    effective.chatScene,
    styles,
    effective.toneModifiers ?? [],
    { tonePreference: effective.tonePreference }
  );

  return `${profileBlock ? `${profileBlock}\n\n` : ''}${situationBlock}

${guideBlock}
${effective.tonePreference ? `\n【输入法风格指令】${effective.tonePreference}` : ''}

生成恰好 ${styles.length} 条，每条对应一种风格，气质明显不同。
禁止照抄上面例句，学语气和结构，结合资料卡信息改写。
输出 JSON（不要 markdown）：{"replies":[{"label":"${styles[0]?.label}","content":"..."}, ...]}`;
}

export function buildSceneOnlyAnalysis(
  replies: ReplySuggestion[],
  settings: UserSettings,
  messages: ChatMessage[] = []
): AnalysisResult {
  const effective = resolveSituationSettings(settings, messages);
  const scene = getChatScene(effective.chatScene);
  const tip = describeSituation(effective, messages);
  return {
    summary: tip,
    emotion: { primary: '待聊', secondary: '', intensity: 50, trend: '' },
    psychology: {
      emotionalState: '',
      mentalState: '',
      personalityTraits: [],
      subtext: tip,
      relationshipStage: settings.relationshipStages?.[0] ?? '暧昧',
      interestLevel: 50,
      chatDesire: '中',
      impressionOfMe: '',
      isPerfunctory: '否',
    },
    deepReport: '',
    femalePsychology: {
      socialScenario: scene?.label ?? '开场',
      coreNeeds: [],
      commStyle: '',
      replyPrinciple: tip,
      scenarioTip: tip.slice(0, 25),
      shitTestNote: '',
    },
    strategy: {
      coreStrategy: tip.slice(0, 28),
      whyStrategy: '',
      emotionSwap: '',
      frameAdjust: '',
      communicationStrategy: '',
      warnings: [],
      nextMove: tip.slice(0, 25),
    },
    topReplies: [],
    replies: replies.filter((r) => r.content.trim()),
    analyzedAt: Date.now(),
  };
}

async function callSceneApi(
  cfg: UserSettings,
  userPrompt: string,
  strictReason?: string,
  signal?: AbortSignal
): Promise<string> {
  throwIfAborted(signal);

  const chatParams = getModelCallParams('chat');
  const model = resolveModelForSettings('chat', cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  const userContent = strictReason
    ? `${userPrompt}\n\n【重写 · 上次不合格】\n${strictReason}\n只输出 JSON，不要说明。`
    : userPrompt;

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutCtrl.abort(new DOMException('请求超时', 'AbortError'));
  }, SCENE_REQUEST_TIMEOUT_MS);
  const { signal: mergedSignal, dispose } = combineAbortSignals([signal, timeoutCtrl.signal]);

  try {
    const res = await apiFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: mergedSignal,
      body: JSON.stringify({
        provider: cfg.provider,
        apiKey,
        model,
        messages: [
          {
            role: 'system',
            content: mergeSystemPrompt(
              chatParams.systemTone,
              `${COMPACT_REPLY_SYSTEM_PROMPT}\n\n场景话术：像真人微信第一条。禁止客服/查户口/表白直球；未问身份禁止「我叫XX刚通过/刚加你打招呼」；禁止别急着拉黑；各风格气质必须拉开。`
            ),
          },
          { role: 'user', content: userContent },
        ],
        temperature: strictReason ? 0.88 : 0.92,
        maxTokens: 450,
        jsonMode: true,
        lockModel: cfg.modelMode === 'manual',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(String(err.error || '生成失败'));
    }
    const data = await res.json();
    return String(data.content || '');
  } catch (err) {
    rethrowAbortAsUserOrTimeout(err, signal);
  } finally {
    clearTimeout(timeoutId);
    dispose();
  }
}

async function fillMissingSceneReplies(
  partial: ReplySuggestion[],
  settings: UserSettings,
  styles: ReplyStyleDefinition[],
  signal?: AbortSignal
): Promise<ReplySuggestion[]> {
  const missing = partial
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.content.trim());
  if (!missing.length) return partial;

  const stylesNeeded = missing.map(({ i }) => styles[i]).filter(Boolean);
  const guideBlock = buildSceneReplyGuideBlock(
    settings.chatScene,
    stylesNeeded,
    settings.toneModifiers ?? [],
    { tonePreference: settings.tonePreference }
  );
  const prompt = `${guideBlock}\n\n【补全 ${stylesNeeded.length} 条】\n${stylesNeeded.map((s, i) => `${i + 1}.${s.label}`).join('\n')}\n输出 JSON：{"replies":[{"label":"...","content":"..."}]}`;

  try {
    const raw = await callSceneApi(settings, prompt, '上次条数不足或含套话，重写', signal);
    const filled = parseLabeledReplies(raw, stylesNeeded, settings);
    const merged = [...partial];
    missing.forEach(({ i }, idx) => {
      const line = filled[idx]?.content?.trim();
      if (line && merged[i]) merged[i] = { ...merged[i], content: line };
    });
    return merged;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return partial;
  }
}

/** 无对方消息时，按场景 + 语气生成 5 条话术 */
export async function generateSceneStyleReplies(
  settings?: UserSettings,
  messages: ChatMessage[] = [],
  signal?: AbortSignal
): Promise<ReplySuggestion[]> {
  throwIfAborted(signal);

  const cfg = resolveSituationSettings(settings ?? loadSettings(), messages);
  await assertApiKeyConfigured(cfg);

  const styles = pickStylesForGeneration(resolveReplyStyles(cfg, ''), cfg);
  const userPrompt = buildScenePrompt(cfg, styles, messages);

  const mods = cfg.toneModifiers ?? [];

  let best = parseLabeledReplies(await callSceneApi(cfg, userPrompt, undefined, signal), styles, cfg);
  let bestScore = scoreSceneReplies(best, mods);
  const bestValid0 = best.filter((r) => r.content.trim()).length;

  // 首轮已够好则跳过重试；最多再打 1 次（原 2 次串行重试）
  if (!(bestValid0 >= styles.length && bestScore <= 10)) {
    throwIfAborted(signal);
    const next = parseLabeledReplies(
      await callSceneApi(
        cfg,
        userPrompt,
        '含套话或太长则重写：8～18字，轻撩不油，像随手发的短微信',
        signal
      ),
      styles,
      cfg
    );
    const nextScore = scoreSceneReplies(next, mods);
    const nextValid = next.filter((r) => r.content.trim()).length;
    if (nextScore < bestScore || (nextScore === bestScore && nextValid > bestValid0)) {
      best = next;
      bestScore = nextScore;
    }
  }

  const afterRetryValid = best.filter((r) => r.content.trim()).length;
  if (afterRetryValid < Math.min(3, styles.length)) {
    best = await fillMissingSceneReplies(best, cfg, styles, signal);
  }
  const replies = best.filter((r) => r.content.trim());

  if (!replies.length) throw new Error('未生成有效话术，请重试');
  return replies;
}
