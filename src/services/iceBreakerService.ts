import type { UserSettings } from '../types';
import { loadSettings } from './storageService';
import { normalizeApiKey } from '../utils/apiKey';
import { apiFetch } from '../utils/apiFetch';
import { checkApiHealth } from './aiService';
import { type IceBreakerScenarioId, getIceBreakerScenario } from '../constants/iceBreakerScenarios';
import {
  ICE_BREAKER_SYSTEM_PROMPT,
  buildIceBreakerUserPrompt,
} from '../constants/iceBreakerPrompts';
import { buildProfileContextBlock } from '../utils/profileContext';
import { getModelCallParams, mergeSystemPrompt } from '../constants/modelCallParams';
import { resolveModelForSettings } from '../constants/modelRouting';
import {
  parseIceBreakerBundle,
  parseIceBreakerOutput,
  type IceBreakerBundle,
} from '../utils/iceBreakerParse';

async function assertKey(settings: UserSettings): Promise<void> {
  if (settings.apiKey?.trim()) return;
  const health = await checkApiHealth();
  if (!health.serverKeyConfigured) throw new Error('请先配置 API Key');
}

async function callIceBreakerApi(
  cfg: UserSettings,
  userPrompt: string,
  retryStrict = false,
  signal?: AbortSignal
): Promise<string> {
  const chatParams = getModelCallParams('chat');
  const model = resolveModelForSettings('chat', cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  const userContent = retryStrict
    ? `${userPrompt}\n\n【严重错误 · 上次输出不合规】\n只输出 JSON：{"lines":["句1"],"topics":["续聊1"]}，不要任何说明文字。`
    : userPrompt;

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
          content: mergeSystemPrompt(chatParams.systemTone, ICE_BREAKER_SYSTEM_PROMPT),
        },
        { role: 'user', content: userContent },
      ],
      temperature: retryStrict ? 0.75 : 0.88,
      maxTokens: 420,
      jsonMode: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String(err.error || '生成失败'));
  }

  const data = await res.json();
  return String(data.content || '');
}

/** 灵焰破冰救场：开场白 + 续聊话题 */
export async function generateIceBreakerBundle(
  scenarioId: IceBreakerScenarioId,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<IceBreakerBundle> {
  const cfg = settings ?? loadSettings();
  await assertKey(cfg);
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
