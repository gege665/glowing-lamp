import type { UserSettings } from '../types';
import { loadSettings } from './storageService';
import { type IceBreakerScenarioId, getIceBreakerScenario } from '../constants/iceBreakerScenarios';
import {
  ICE_BREAKER_SYSTEM_PROMPT,
  buildIceBreakerUserPrompt,
} from '../constants/iceBreakerPrompts';
import { buildProfileContextBlock } from '../utils/profileContext';
import {
  parseIceBreakerBundle,
  parseIceBreakerOutput,
  type IceBreakerBundle,
} from '../utils/iceBreakerParse';
import { assertApiKeyConfigured, postChatCompletion } from './clientChatApi';

async function callIceBreakerApi(
  cfg: UserSettings,
  userPrompt: string,
  retryStrict = false,
  signal?: AbortSignal
): Promise<string> {
  const userContent = retryStrict
    ? `${userPrompt}\n\n【严重错误 · 上次输出不合规】\n只输出 JSON：{"lines":["句1"],"topics":["续聊1"]}，不要任何说明文字。`
    : userPrompt;

  return postChatCompletion({
    settings: cfg,
    systemPrompt: ICE_BREAKER_SYSTEM_PROMPT,
    userContent,
    signal,
    temperature: retryStrict ? 0.75 : 0.88,
    maxTokens: 420,
  });
}

/** 灵焰破冰救场：开场白 + 续聊话题 */
export async function generateIceBreakerBundle(
  scenarioId: IceBreakerScenarioId,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<IceBreakerBundle> {
  const cfg = settings ?? loadSettings();
  await assertApiKeyConfigured(cfg);
  const scenario = getIceBreakerScenario(scenarioId);
  const profileBlock = buildProfileContextBlock(cfg);
  const userPrompt = buildIceBreakerUserPrompt(
    scenarioId,
    profileBlock,
    cfg.myNickname
  );

  let raw = await callIceBreakerApi(cfg, userPrompt, false, signal);
  let bundle = parseIceBreakerBundle(raw, scenario.count, scenario.continueCount);

  if (bundle.lines.length < Math.min(2, scenario.count)) {
    raw = await callIceBreakerApi(cfg, userPrompt, true, signal);
    const retry = parseIceBreakerBundle(raw, scenario.count, scenario.continueCount);
    if (retry.lines.length > bundle.lines.length) {
      bundle = retry;
    }
  }

  if (bundle.lines.length === 0) {
    const fallback = parseIceBreakerOutput(raw, scenario.count);
    if (fallback.length === 0) throw new Error('未生成有效话术，请重试');
    bundle = { lines: fallback, topics: bundle.topics };
  }

  return bundle;
}
