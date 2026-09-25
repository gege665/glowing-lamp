import type { UserSettings } from '../types';
import { loadSettings } from './storageService';
import { normalizeApiKey } from '../utils/apiKey';
import { checkApiHealth } from './aiService';
import { type IceBreakerScenarioId, getIceBreakerScenario } from '../constants/iceBreakerScenarios';
import {
  ICE_BREAKER_SYSTEM_PROMPT,
  buildIceBreakerUserPrompt,
} from '../constants/iceBreakerPrompts';
import { buildProfileContextBlock } from '../utils/profileContext';
import { getModelCallParams, mergeSystemPrompt } from '../constants/modelCallParams';
import { resolveModelForSettings } from '../constants/modelRouting';
import { parseIceBreakerOutput } from '../utils/iceBreakerParse';
import {
  abortForTimeout,
  combineAbortSignals,
  rethrowAfterAbort,
  throwIfAborted,
} from '../utils/abortSleep';
import { jsonApiHeaders } from '../utils/apiHeaders';

const ICE_BREAKER_TIMEOUT_MS = 60_000;

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
  throwIfAborted(signal);

  const chatParams = getModelCallParams('chat');
  const model = resolveModelForSettings('chat', cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  const userContent = retryStrict
    ? `${userPrompt}\n\n【严重错误 · 上次输出了思考过程】\n只输出 JSON：{"lines":["句1","句2"]}，不要任何说明文字。`
    : userPrompt;

  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortForTimeout(timeoutCtrl), ICE_BREAKER_TIMEOUT_MS);
  const { signal: mergedSignal, dispose } = combineAbortSignals([signal, timeoutCtrl.signal]);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: jsonApiHeaders(),
      signal: mergedSignal,
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
        temperature: retryStrict ? 0.75 : 0.85,
        maxTokens: 320,
        jsonMode: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(String(err.error || '生成失败'));
    }

    const data = await res.json();
    return String(data.content || '');
  } catch (err) {
    rethrowAfterAbort(err, signal, timeoutCtrl.signal);
  } finally {
    clearTimeout(timeoutId);
    dispose();
  }
}

export async function generateIceBreakers(
  scenarioId: IceBreakerScenarioId,
  settings?: UserSettings,
  signal?: AbortSignal
): Promise<string[]> {
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
  let lines = parseIceBreakerOutput(raw, scenario.count);

  if (lines.length < Math.min(2, scenario.count)) {
    raw = await callIceBreakerApi(cfg, userPrompt, true, signal);
    lines = parseIceBreakerOutput(raw, scenario.count);
  }

  if (!lines.length) throw new Error('未生成有效破冰句，请重试');
  return lines;
}
