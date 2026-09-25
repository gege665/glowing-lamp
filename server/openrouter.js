export const OPENROUTER_DEFAULT_MODEL = 'bytedance-seed/seed-2.0-lite';

/** 历史错误 ID → 当前有效 ID（与 src/constants/openrouterFreeModels.ts 同步） */
export const OPENROUTER_MODEL_ALIASES = {
  'alpha-llm/owl-alpha:free': 'openrouter/owl-alpha',
  'nvidia/nemotron-3-nano-omni:free': 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'poolside/lagoina-xs2:free': 'poolside/laguna-xs.2:free',
  'poolside/lagoina-m1:free': 'poolside/laguna-m.1:free',
  'google/gemma-4-26b-a4b:free': 'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b:free': 'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super:free': 'nvidia/nemotron-3-super-120b-a12b:free',
  'minimax/minimax-m2-5:free': 'minimax/minimax-m2.5:free',
  'liquidai/lfm2-5-1-2b-thinking:free': 'liquid/lfm-2.5-1.2b-thinking:free',
  'liquidai/lfm2-5-1-2b-instruct:free': 'liquid/lfm-2.5-1.2b-instruct:free',
};

import {
  buildModelCandidates,
  classifyFailureReason,
  isRetryableModelError,
  logModelFailover,
  OPENROUTER_REQUEST_TIMEOUT_MS,
  OPENROUTER_FAILOVER_TOTAL_TIMEOUT_MS,
} from './modelFailover.js';
import { resolveFailoverCatalog } from '../shared/modelRouting.js';
import { shouldUseJsonResponseFormat } from '../shared/modelCapabilities.js';

export function resolveOpenRouterModelId(model) {
  if (!model) return OPENROUTER_DEFAULT_MODEL;
  return OPENROUTER_MODEL_ALIASES[model] ?? model;
}

export function normalizeApiKey(apiKey) {
  if (!apiKey) return '';
  return String(apiKey).trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
}

export {
  detectProviderFromKey,
  humanizeInvalidTokenError,
  validateKeyForProvider,
} from '../shared/apiKeyRouting.js';

/** 生产环境：在服务端配置 OPENROUTER_API_KEY，前端无需传 Key */
export function getServerOpenRouterKey() {
  return normalizeApiKey(process.env.OPENROUTER_API_KEY || '');
}

export function isServerOpenRouterKeyConfigured() {
  return getServerOpenRouterKey().length > 0;
}

/** 客户端 Key 仅在为 OpenRouter/Groq 前缀时采用，避免误用爱易威 sk- Key */
export function resolveOpenRouterApiKey(clientApiKey) {
  const clientKey = normalizeApiKey(clientApiKey);
  if (clientKey.startsWith('sk-or-') || clientKey.startsWith('gsk_')) return clientKey;
  return getServerOpenRouterKey();
}

/** 是否具备 OpenRouter 备用线路（客户端 OR Key 或服务端 OPENROUTER_API_KEY） */
export function canUseOpenRouterFallback(clientApiKey) {
  return Boolean(resolveOpenRouterApiKey(clientApiKey));
}

function formatApiError(status, data) {
  const msg = data?.error?.message || data?.message;
  const raw = data?.error?.metadata?.raw || data?.error?.metadata?.message;

  if (status === 401) {
    return 'OpenRouter API Key 无效。请前往 https://openrouter.ai/keys 检查 Key（以 sk-or- 开头）';
  }
  if (status === 402) {
    return '该模型需要 OpenRouter 账户余额。请在 openrouter.ai 充值，或切换为「openrouter/free」等免费模型';
  }
  if (status === 429 || msg === 'Provider returned error') {
    return `模型繁忙或限流，请稍后重试或切换模型。${raw ? `详情: ${String(raw).slice(0, 120)}` : ''}`;
  }
  return raw || msg || `API 请求失败 (${status})`;
}

function normalizeUsage(usage) {
  return {
    promptTokens: usage.prompt_tokens ?? usage.promptTokens,
    completionTokens: usage.completion_tokens ?? usage.completionTokens,
    totalTokens: usage.total_tokens ?? usage.totalTokens,
    reasoningTokens:
      usage.completion_tokens_details?.reasoning_tokens ??
      usage.completionTokensDetails?.reasoningTokens ??
      null,
  };
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  return '';
}

export function extractMessageText(message) {
  if (!message) return '';
  const fromContent = extractTextContent(message.content);
  if (fromContent.trim()) return fromContent;
  if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning;
  }
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }
  return '';
}

/** 仅累积正式回复 content，不向前端推送 reasoning 思考过程 */
function extractDeltaText(delta) {
  if (!delta) return '';
  return extractTextContent(delta.content);
}

/** 通过 OpenRouter 官方接口验证 Key（不依赖聊天补全，避免免费模型空回复） */
export async function verifyOpenRouterApiKey(apiKey) {
  const key = normalizeApiKey(apiKey);
  if (!key) {
    const err = new Error('请先输入 API Key');
    err.status = 400;
    throw err;
  }

  const response = await fetch('https://openrouter.ai/api/v1/key', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': getReferer(),
      'X-Title': 'Soul Chat Assistant',
    },
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    const err = new Error(formatApiError(401, data));
    err.status = 401;
    throw err;
  }
  if (!response.ok) {
    const err = new Error(formatApiError(response.status, data));
    err.status = response.status;
    throw err;
  }
  if (!data?.data) {
    throw new Error('无法读取 Key 信息，请稍后重试');
  }
  return data.data;
}

function getReferer() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.SITE_URL || 'http://127.0.0.1:5173';
}

export async function callOpenRouterOnce({
  key,
  model,
  messages,
  temperature,
  maxTokens,
  stream,
  jsonMode = true,
  onChunk,
  timeoutMs = OPENROUTER_REQUEST_TIMEOUT_MS,
  shouldAbort,
}) {
  const body = {
    model,
    messages,
    stream,
    temperature,
    max_tokens: maxTokens,
  };
  if (shouldUseJsonResponseFormat(model, jsonMode)) {
    body.response_format = { type: 'json_object' };
    body.reasoning = { effort: 'low', exclude: true };
  }

  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();

  const abortWith = (err) => {
    if (!controller.signal.aborted) controller.abort(err);
  };

  const timeoutId = setTimeout(() => {
    const err = new Error(`OpenRouter 请求超时（${timeoutMs}ms）`);
    err.status = 408;
    err.code = 'TIMEOUT';
    abortWith(err);
  }, timeoutMs);

  let abortPollId = null;
  if (shouldAbort) {
    abortPollId = setInterval(() => {
      if (shouldAbort()) {
        const err = new Error('客户端已断开');
        err.status = 499;
        abortWith(err);
      }
    }, 400);
  }

  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': getReferer(),
        'X-Title': 'Soul Chat Assistant',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = controller.signal.reason;
    if (aborted instanceof Error) throw aborted;
    if (e?.name === 'AbortError') {
      const err = new Error('请求已取消或超时');
      err.status = 408;
      throw err;
    }
    const err = new Error(e?.message || '连接 OpenRouter 失败');
    err.cause = e;
    throw err;
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    if (abortPollId) clearInterval(abortPollId);
    const data = await response.json().catch(() => ({}));
    const err = new Error(formatApiError(response.status, data));
    err.status = response.status;
    throw err;
  }

  if (!stream) {
    try {
      const data = await response.json();
      const choice = data.choices?.[0];
      const content =
        extractMessageText(choice?.message) ||
        (typeof choice?.text === 'string' ? choice.text : '');
      if (!content.trim()) {
        const reason = choice?.finish_reason || 'unknown';
        const err = new Error(`AI 返回内容为空（finish_reason=${reason}），请重试或更换模型`);
        err.status = 422;
        throw err;
      }
      return { content, usage: normalizeUsage(data.usage || {}), model: data.model || model };
    } finally {
      clearTimeout(timeoutId);
      if (abortPollId) clearInterval(abortPollId);
    }
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
      if (Date.now() > deadline) {
        await reader.cancel().catch(() => {});
        const err = new Error(`流式响应超时（${timeoutMs}ms）`);
        err.status = 408;
        err.code = 'TIMEOUT';
        throw err;
      }
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
        if (!payload || payload === '[DONE]') continue;

        try {
          const chunk = JSON.parse(payload);
          if (chunk.error) {
            const err = new Error(formatApiError(chunk.error.code || 500, { error: chunk.error }));
            err.status = chunk.error.code || 500;
            throw err;
          }

          usedModel = chunk.model || usedModel;
          const delta = chunk.choices?.[0]?.delta;
          const text = extractDeltaText(delta);
          if (text) {
            content += text;
            onChunk?.(text, content);
          }
          if (chunk.usage) {
            usage = normalizeUsage(chunk.usage);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    if (!content) {
      const err = new Error('AI 返回内容为空，请重试或更换模型');
      err.status = 422;
      throw err;
    }

    return { content, usage, model: usedModel };
  } finally {
    clearTimeout(timeoutId);
    if (abortPollId) clearInterval(abortPollId);
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * OpenRouter 调用：当前模型失败时按配置列表自动切换，直至成功或全部耗尽
 */
export async function streamOpenRouterChat({
  apiKey,
  model = OPENROUTER_DEFAULT_MODEL,
  messages,
  temperature = 0.7,
  maxTokens = 4096,
  jsonMode = true,
  onChunk,
  shouldAbort,
  timeoutMs = OPENROUTER_REQUEST_TIMEOUT_MS,
}) {
  const key = resolveOpenRouterApiKey(apiKey);
  if (!key) {
    const err = new Error('请配置 OPENROUTER_API_KEY 环境变量或在设置中填写 API Key');
    err.status = 400;
    throw err;
  }

  const task = jsonMode ? 'deepAnalysis' : 'chat';
  const { primary, candidates } = buildModelCandidates(
    model,
    resolveOpenRouterModelId,
    resolveFailoverCatalog(model, 'openrouter', task)
  );
  let lastError = null;
  let previousCandidate = null;
  const failoverDeadline = Date.now() + OPENROUTER_FAILOVER_TOTAL_TIMEOUT_MS;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    if (Date.now() > failoverDeadline) {
      lastError = Object.assign(new Error('模型自动切换总超时，请稍后重试'), { status: 408 });
      break;
    }

    if (shouldAbort?.()) {
      const err = new Error('客户端已断开');
      err.status = 499;
      throw err;
    }

    if (previousCandidate) {
      logModelFailover({
        type: 'model_switch',
        from: previousCandidate,
        to: candidate,
        reason: classifyFailureReason(lastError),
        detail: lastError?.message?.slice(0, 200),
      });
    }

    logModelFailover({
      type: 'model_attempt',
      model: candidate,
      attempt: i + 1,
      total: candidates.length,
      requested: primary,
    });

    const remainingMs = failoverDeadline - Date.now();
    if (remainingMs <= 0) {
      lastError = Object.assign(new Error('模型自动切换总超时，请稍后重试'), { status: 408 });
      break;
    }

    try {
      const result = await callOpenRouterOnce({
        key,
        model: candidate,
        messages,
        temperature,
        maxTokens,
        stream: true,
        jsonMode,
        onChunk,
        timeoutMs: Math.max(1000, Math.min(timeoutMs, remainingMs)),
        shouldAbort,
      });

      const usedModel = result.model || candidate;
      const switched = usedModel !== primary && candidate !== primary;

      logModelFailover({
        type: 'model_success',
        model: usedModel,
        requested: primary,
        switched: switched || candidate !== primary,
      });

      return {
        ...result,
        model: usedModel,
        requestedModel: primary,
        modelSwitched: candidate !== primary,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[ModelFailover] 模型 ${candidate} 失败:`, err.message);
      previousCandidate = candidate;

      if (!isRetryableModelError(err)) {
        logModelFailover({
          type: 'model_abort',
          model: candidate,
          reason: classifyFailureReason(err),
          detail: err.message,
        });
        break;
      }
    }
  }

  logModelFailover({
    type: 'model_exhausted',
    requested: primary,
    tried: candidates.length,
    lastError: lastError?.message,
  });

  throw lastError || new Error('所有模型均不可用，请稍后重试');
}

export function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}
