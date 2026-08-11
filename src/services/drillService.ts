import type { UserSettings } from '../types';
import type { DrillCoachFeedback, DrillMessage } from '../types/drill';
import { EMPTY_DRILL_FEEDBACK } from '../types/drill';
import { loadSettings, generateId } from './storageService';
import { normalizeApiKey } from '../utils/apiKey';
import { apiFetch } from '../utils/apiFetch';
import { checkApiHealth } from './aiService';
import { type DrillScenarioId, getDrillScenario } from '../constants/drillScenarios';
import {
  DRILL_SYSTEM_PROMPT,
  buildDrillOpeningUserPrompt,
  buildDrillTurnUserPrompt,
} from '../constants/drillPrompts';
import { buildProfileContextBlock } from '../utils/profileContext';
import { getModelCallParams, mergeSystemPrompt } from '../constants/modelCallParams';
import { resolveModelForSettings } from '../constants/modelRouting';

export interface DrillTurnResult {
  herMessage: DrillMessage;
  feedback: DrillCoachFeedback;
}

async function assertKey(settings: UserSettings): Promise<void> {
  if (settings.apiKey?.trim()) return;
  const health = await checkApiHealth();
  if (!health.serverKeyConfigured) throw new Error('请先配置 API Key');
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* continue */
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export function parseDrillResponse(raw: string): {
  herReply: string;
  feedback: DrillCoachFeedback;
} {
  const obj = extractJsonObject(raw);
  if (!obj) {
    const line = raw
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('{') && !l.startsWith('```'));
    return {
      herReply: line?.slice(0, 80) || '嗯……',
      feedback: {
        ...EMPTY_DRILL_FEEDBACK,
        tip: '解析失败，可再发一句继续演练',
        herEmotion: '不明',
      },
    };
  }

  const problems = Array.isArray(obj.problems)
    ? obj.problems.map((p) => String(p).trim()).filter(Boolean).slice(0, 4)
    : [];
  const betterReplies = Array.isArray(obj.betterReplies)
    ? obj.betterReplies.map((p) => String(p).trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    herReply: String(obj.herReply || obj.reply || '嗯').trim().slice(0, 120) || '嗯',
    feedback: {
      score: clampScore(obj.score),
      herEmotion: String(obj.herEmotion || obj.emotion || '').trim().slice(0, 20),
      problems,
      betterReplies,
      tip: String(obj.tip || '').trim().slice(0, 80),
    },
  };
}

async function callDrillApi(
  cfg: UserSettings,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const chatParams = getModelCallParams('chat');
  const model = resolveModelForSettings('chat', cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  const res = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      provider: cfg.provider,
      apiKey,
      model,
      messages: [
        {
          role: 'system',
          content: mergeSystemPrompt(chatParams.systemTone, DRILL_SYSTEM_PROMPT),
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
      maxTokens: 520,
      jsonMode: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String((err as { error?: string }).error || '演练请求失败'));
  }

  const data = await res.json();
  return String(data.content || '');
}

function herMsg(content: string): DrillMessage {
  return {
    id: generateId(),
    role: 'her',
    content,
    timestamp: Date.now(),
  };
}

/** 开始场景：她先开口 */
export async function startDrillScene(
  scenarioId: DrillScenarioId,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<DrillTurnResult> {
  const cfg = settings ?? loadSettings();
  await assertKey(cfg);
  const scenario = getDrillScenario(scenarioId);
  const profileHint = buildProfileContextBlock(cfg);
  const prompt = buildDrillOpeningUserPrompt(
    scenarioId,
    cfg.myNickname || '我',
    profileHint
  );

  const raw = await callDrillApi(cfg, prompt, signal);
  const parsed = parseDrillResponse(raw);

  return {
    herMessage: herMsg(parsed.herReply),
    feedback: {
      ...parsed.feedback,
      tip:
        parsed.feedback.tip ||
        `场景「${scenario.label}」已开始：${scenario.goal}`,
      score: 0,
    },
  };
}

/** 用户发一句 → 她回 + 教练点评 */
export async function continueDrillTurn(
  scenarioId: DrillScenarioId,
  history: DrillMessage[],
  userLine: string,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<DrillTurnResult> {
  const cfg = settings ?? loadSettings();
  await assertKey(cfg);
  const line = userLine.trim();
  if (!line) throw new Error('请先输入你的回复');

  const prompt = buildDrillTurnUserPrompt(
    scenarioId,
    history,
    line,
    cfg.myNickname || '我'
  );

  const raw = await callDrillApi(cfg, prompt, signal);
  const parsed = parseDrillResponse(raw);

  return {
    herMessage: herMsg(parsed.herReply),
    feedback: parsed.feedback,
  };
}
