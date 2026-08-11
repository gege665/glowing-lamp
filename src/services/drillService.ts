import type { UserSettings } from '../types';
import type { DrillCoachFeedback, DrillMessage } from '../types/drill';
import { EMPTY_DRILL_FEEDBACK } from '../types/drill';
import { loadSettings, generateId } from './storageService';
import { type DrillScenarioId, getDrillScenario } from '../constants/drillScenarios';
import {
  DRILL_SYSTEM_PROMPT,
  buildDrillOpeningUserPrompt,
  buildDrillTurnUserPrompt,
} from '../constants/drillPrompts';
import { buildProfileContextBlock } from '../utils/profileContext';
import { extractJsonObject } from '../utils/extractJsonObject';
import { assertApiKeyConfigured, postChatCompletion } from './clientChatApi';

export interface DrillTurnResult {
  herMessage: DrillMessage;
  feedback: DrillCoachFeedback;
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
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
  return postChatCompletion({
    settings: cfg,
    systemPrompt: DRILL_SYSTEM_PROMPT,
    userContent: userPrompt,
    signal,
    temperature: 0.9,
    maxTokens: 520,
  });
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
  await assertApiKeyConfigured(cfg);
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
  await assertApiKeyConfigured(cfg);
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
