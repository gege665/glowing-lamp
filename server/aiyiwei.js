import { normalizeApiKey, extractMessageText } from './openrouter.js';
import { humanizeInvalidTokenError } from '../shared/apiKeyRouting.js';
import { getModelCallParams } from '../shared/modelCallParams.js';
import { resolveFailoverCatalog } from '../shared/modelRouting.js';
import {
  buildModelCandidates,
  isRetryableModelError,
  classifyFailureReason,
  logModelFailover,
  OPENROUTER_FAILOVER_TOTAL_TIMEOUT_MS,
} from './modelFailover.js';
import { applyAiyiweiRouting, stripAiyiweiRoutingSuffix, normalizeAiyiweiModelId, buildAiyiweiProviderSort } from '../shared/aiyiweiRouting.js';
import { shouldUseJsonResponseFormat } from '../shared/modelCapabilities.js';
import { abortableSleep, throwIfAborted } from '../shared/abortSleep.js';

export const AIYIWEI_BASE_URL = 'https://aiyiwei.vip/v1/chat/completions';
export const AIYIWEI_DEFAULT_CHAT_MODEL = 'doubao-seed-2-0-mini-260428';
export const AIYIWEI_DEFAULT_ANALYSIS_MODEL = 'deepseek-v4-flash';
/** @deprecated 使用 AIYIWEI_DEFAULT_CHAT_MODEL */
export const AIYIWEI_DEFAULT_MODEL = AIYIWEI_DEFAULT_CHAT_MODEL;

const AIYIWEI_SWITCH_GAP_MS = 400;

/** 生产环境：在服务端配置 AIYIWEI_API_KEY，前端无需传 Key */
export function getServerAiyiweiKey() {
  return normalizeApiKey(process.env.AIYIWEI_API_KEY || '');
}

export function isServerAiyiweiKeyConfigured() {
  return getServerAiyiweiKey().length > 0;
}

/** 优先使用用户填写的 Key；未填写时使用服务端 Key */
export function resolveAiyiweiApiKey(clientApiKey) {
  const clientKey = normalizeApiKey(clientApiKey);
  if (clientKey) return clientKey;
  return getServerAiyiweiKey();
}

export function resolveAiyiweiModelId(model, task = 'chat') {
  if (!model || model === 'auto') {
    return task === 'deepAnalysis'
      ? AIYIWEI_DEFAULT_ANALYSIS_MODEL
      : AIYIWEI_DEFAULT_CHAT_MODEL;
  }
  return stripAiyiweiRoutingSuffix(model);
}

function formatAiyiweiError(status, data, provider = 'aiyiwei') {
  const raw = data?.error?.message || data?.message || '';
  const tokenHint = humanizeInvalidTokenError(raw, provider);
  if (tokenHint) return tokenHint;
  return raw || `API 请求失败 (${status})`;
}

async function callAiyiweiOnce({
  key,
  model,
  messages,
  temperature,
  topP,
  maxTokens,
  jsonMode,
  onChunk,
  shouldAbort,
  timeoutMs,
  routingSuffix,
  providerSort,
}) {
  throwIfAborted(shouldAbort);
  const chatDefaults = getModelCallParams('chat');
  const useStream = !jsonMode;
  const task = jsonMode ? 'deepAnalysis' : 'chat';
  const baseModel = normalizeAiyiweiModelId(stripAiyiweiRoutingSuffix(model));
  const body = {
    model: providerSort
      ? baseModel
      : applyAiyiweiRouting(model, task, routingSuffix),
    messages,
    temperature: temperature ?? chatDefaults.temperature,
    top_p: topP ?? chatDefaults.topP,
    max_tokens: maxTokens ?? chatDefaults.maxTokens,
    stream: useStream,
  };
  if (shouldUseJsonResponseFormat(model, jsonMode)) {
    body.response_format = { type: 'json_object' };
  }
  if (providerSort) {
    body.provider = buildAiyiweiProviderSort(providerSort);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(AIYIWEI_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e?.name === 'AbortError') {
      const err = new Error('请求已取消或超时');
      err.status = 408;
      throw err;
    }
    throw e;
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));
    const err = new Error(formatAiyiweiError(response.status, data));
    err.status = response.status;
    throw err;
  }

  if (!body.stream) {
    const data = await response.json();
    clearTimeout(timeoutId);
    const choice = data.choices?.[0];
    const content =
      extractMessageText(choice?.message) ||
      (typeof choice?.text === 'string' ? choice.text : '');
    if (!content.trim()) {
      const err = new Error('AI 返回内容为空');
      err.status = 502;
      throw err;
    }
    onChunk?.('', content);
    return { content, usage: data.usage, model: data.model || model };
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取 AI 响应流');

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let usage = null;
  let usedModel = model;

  try {
    while (true) {
      if (shouldAbort?.()) {
        await reader.cancel().catch(() => {});
        const err = new Error('客户端已断开');
        err.status = 499;
        throw err;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        if (parsed.error) {
          const err = new Error(parsed.error.message || '上游返回错误');
          err.status = parsed.error.code || 502;
          throw err;
        }
        if (parsed.usage) usage = parsed.usage;
        if (parsed.model) usedModel = parsed.model;
        const delta =
          extractMessageText(parsed.choices?.[0]?.delta) ||
          parsed.choices?.[0]?.delta?.content ||
          '';
        if (delta) {
          content += delta;
          onChunk?.(delta, content);
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }

  if (!content.trim()) {
    const err = new Error('AI 返回内容为空，请重试或更换模型');
    err.status = 502;
    throw err;
  }
  return { content, usage, model: usedModel };
}

/** 爱易威：按候选模型顺序各尝试一次（无多层时间重试，饱和时仅切换模型/路由后缀） */
async function attemptAiyiweiCandidates({
  candidates,
  primary,
  key,
  messages,
  temperature,
  topP,
  maxTokens,
  jsonMode,
  onChunk,
  shouldAbort,
  timeoutMs,
  failoverDeadline,
  passLabel,
  onStatus,
}) {
  let lastError = null;
  let previousCandidate = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    if (Date.now() > failoverDeadline) {
      lastError = Object.assign(new Error('模型自动切换总超时，请稍后重试'), { status: 408 });
      break;
    }

    throwIfAborted(shouldAbort);

    if (previousCandidate) {
      onStatus?.({ type: 'switching', model: candidate });
      await abortableSleep(AIYIWEI_SWITCH_GAP_MS, shouldAbort);
      logModelFailover({
        type: 'model_switch',
        from: previousCandidate,
        to: candidate,
        reason: classifyFailureReason(lastError),
        detail: lastError?.message?.slice(0, 200),
        provider: 'aiyiwei',
        pass: passLabel,
      });
    }

    logModelFailover({
      type: 'model_attempt',
      model: candidate,
      attempt: i + 1,
      total: candidates.length,
      requested: primary,
      provider: 'aiyiwei',
      pass: passLabel,
    });

    const remainingMs = failoverDeadline - Date.now();
    if (remainingMs <= 0) {
      lastError = Object.assign(new Error('模型自动切换总超时，请稍后重试'), { status: 408 });
      break;
    }
    const perAttemptTimeout = Math.max(1000, Math.min(timeoutMs, remainingMs));

    try {
      const result = await callAiyiweiOnce({
        key,
        model: candidate,
        messages,
        temperature,
        topP,
        maxTokens,
        jsonMode,
        onChunk,
        shouldAbort,
        timeoutMs: perAttemptTimeout,
      });

      const usedModel = result.model || candidate;
      logModelFailover({
        type: 'model_success',
        model: usedModel,
        requested: primary,
        switched: candidate !== primary,
        provider: 'aiyiwei',
        pass: passLabel,
      });

      return {
        ok: true,
        result: {
          ...result,
          model: usedModel,
          requestedModel: primary,
          modelSwitched: candidate !== primary,
        },
      };
    } catch (err) {
      lastError = err;
      console.warn(
        `[ModelFailover:aiyiwei] ${passLabel} 模型 ${candidate} 失败:`,
        err.message
      );

      if (!isRetryableModelError(err)) {
        logModelFailover({
          type: 'model_abort',
          model: candidate,
          reason: classifyFailureReason(err),
          detail: err.message,
          provider: 'aiyiwei',
          pass: passLabel,
        });
        break;
      }
    }

    previousCandidate = candidate;
  }

  return { ok: false, lastError };
}

export async function streamAiyiweiChat({
  apiKey,
  model,
  messages,
  temperature,
  topP,
  maxTokens,
  jsonMode = false,
  onChunk,
  shouldAbort,
  timeoutMs = 60000,
  onStatus,
  lockModel = false,
}) {
  const key = resolveAiyiweiApiKey(apiKey);
  if (!key) {
    const err = new Error('请先配置 AIYIWEI_API_KEY 或在设置中填写 Key');
    err.status = 400;
    throw err;
  }

  const task = jsonMode ? 'deepAnalysis' : 'chat';
  const resolvePrimary = (id) => resolveAiyiweiModelId(id, task);
  const { primary, candidates } = buildModelCandidates(
    model,
    resolvePrimary,
    resolveFailoverCatalog(model, 'aiyiwei', task),
    lockModel
  );

  const failoverDeadline = Date.now() + OPENROUTER_FAILOVER_TOTAL_TIMEOUT_MS;
  const attemptArgs = {
    candidates,
    primary,
    key,
    messages,
    temperature,
    topP,
    maxTokens,
    jsonMode,
    onChunk,
    shouldAbort,
    timeoutMs,
    failoverDeadline,
    onStatus,
  };

  const outcome = await attemptAiyiweiCandidates({
    ...attemptArgs,
    passLabel: 'pass1',
  });

  if (outcome.ok && outcome.result) {
    return outcome.result;
  }

  const lastError = outcome.lastError;

  logModelFailover({
    type: 'model_exhausted',
    requested: primary,
    tried: candidates.length,
    lastError: lastError?.message,
    provider: 'aiyiwei',
  });

  const exhausted = lastError || new Error('所有模型均不可用，请稍后重试');
  throw exhausted;
}
