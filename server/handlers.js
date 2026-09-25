import {
  streamOpenRouterChat,
  OPENROUTER_DEFAULT_MODEL,
  normalizeApiKey,
  detectProviderFromKey,
  humanizeInvalidTokenError,
  validateKeyForProvider,
  resolveOpenRouterModelId,
  resolveOpenRouterApiKey,
  isServerOpenRouterKeyConfigured,
  verifyOpenRouterApiKey,
  extractMessageText,
  writeSse,
} from './openrouter.js';
import {
  resolveJuheApiKey,
  isServerJuheKeyConfigured,
  JUHE_DEFAULT_CHAT_MODEL,
} from './juhe.js';
import {
  resolveAiyiweiApiKey,
  isServerAiyiweiKeyConfigured,
  AIYIWEI_DEFAULT_CHAT_MODEL,
  AIYIWEI_DEFAULT_ANALYSIS_MODEL,
} from './aiyiwei.js';
import { getModelCallParams, getMaxTokensForTask } from '../shared/modelCallParams.js';
import { formatUpstreamBusyUserMessage, isUpstreamBusyMessage } from '../shared/upstreamErrors.js';
import { streamAiyiweiWithFallback } from './aiyiweiFallback.js';
import { canUseOpenRouterFallback } from './openrouter.js';
import { stripAiyiweiRoutingSuffix } from '../shared/aiyiweiRouting.js';
import { shouldUseJsonResponseFormat } from '../shared/modelCapabilities.js';
import { throwIfAborted } from '../shared/abortSleep.js';
import { assertRateLimit, buildRateLimitOptions } from '../shared/rateLimit.js';
import { injectServerSystemGuard } from '../shared/serverPromptGuard.js';

export { isServerOpenRouterKeyConfigured, isServerJuheKeyConfigured, isServerAiyiweiKeyConfigured };

export function isServerApiKeyConfigured() {
  return (
    isServerOpenRouterKeyConfigured() ||
    isServerJuheKeyConfigured() ||
    isServerAiyiweiKeyConfigured()
  );
}

export function getAllowedSiteOrigins() {
  const origins = new Set();
  const add = (value) => {
    if (!value || typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      origins.add(new URL(url).origin);
    } catch {
      /* ignore invalid URL */
    }
  };
  add(process.env.SITE_URL);
  add(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  for (const part of (process.env.ALLOWED_ORIGINS || '').split(',')) {
    add(part);
  }
  if (origins.size === 0 && process.env.NODE_ENV !== 'production') {
    add('http://127.0.0.1:5173');
    add('http://localhost:5173');
  }
  return origins;
}

/**
 * 生产环境 + 服务端 Key：禁止外部脚本白嫖。
 * 允许：自带 client apiKey / 正确的 x-api-access-token；
 * 未配置 API_ACCESS_TOKEN 时，退化为本站 Origin·Referer 校验（可被伪造，务必配合限流）。
 */
export function assertProductionApiAccess(req, provider, body) {
  if (provider !== 'openrouter' && provider !== 'juhe' && provider !== 'aiyiwei') return;
  const hasServerKey =
    provider === 'openrouter'
      ? isServerOpenRouterKeyConfigured()
      : provider === 'juhe'
        ? isServerJuheKeyConfigured()
        : isServerAiyiweiKeyConfigured();
  if (!hasServerKey) return;
  if (process.env.NODE_ENV !== 'production') return;

  const clientKey = normalizeApiKey(body?.apiKey);
  if (clientKey) return;

  const accessToken = req.headers['x-api-access-token'];
  const expectedToken = process.env.API_ACCESS_TOKEN;
  if (expectedToken) {
    if (accessToken === expectedToken) return;
    throw Object.assign(
      new Error('未授权：请配置个人 API Key，或在请求头携带正确的 x-api-access-token'),
      { status: 403 }
    );
  }

  const allowed = getAllowedSiteOrigins();
  if (allowed.size === 0) {
    throw Object.assign(
      new Error('未授权：请配置 SITE_URL 或 ALLOWED_ORIGINS'),
      { status: 403 }
    );
  }

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const fromSite = [...allowed].some((base) => {
    if (origin === base) return true;
    if (!referer) return false;
    try {
      return new URL(referer).origin === base;
    } catch {
      return false;
    }
  });

  if (!fromSite) {
    throw Object.assign(
      new Error('未授权：请在应用页面内使用，或在设置中填写个人 API Key'),
      { status: 403 }
    );
  }
}

function resolveRequestApiKey(provider, clientApiKey) {
  if (provider === 'openrouter') {
    const key = resolveOpenRouterApiKey(clientApiKey);
    if (!key) {
      throw Object.assign(
        new Error('请配置服务端 OPENROUTER_API_KEY 环境变量，或在设置中填写 API Key'),
        { status: 400 }
      );
    }
    return key;
  }
  if (provider === 'juhe') {
    const key = resolveJuheApiKey(clientApiKey);
    if (!key) {
      throw Object.assign(
        new Error('请配置服务端 JUHE_API_KEY 环境变量，或在设置中填写聚合 API Key'),
        { status: 400 }
      );
    }
    return key;
  }
  if (provider === 'aiyiwei') {
    const key = resolveAiyiweiApiKey(clientApiKey);
    if (!key) {
      throw Object.assign(
        new Error('请配置服务端 AIYIWEI_API_KEY 环境变量，或在设置中填写爱易威 API Key'),
        { status: 400 }
      );
    }
    return key;
  }
  const key = normalizeApiKey(clientApiKey);
  if (!key) throw Object.assign(new Error('请先配置 API Key'), { status: 400 });
  return key;
}

function finalizeApiKey(provider, apiKey) {
  const resolved = resolveRequestApiKey(provider, apiKey);
  validateKeyForProvider(provider, resolved);
  return resolved;
}

export const PROVIDERS = {
  aiyiwei: {
    url: 'https://aiyiwei.vip/v1/chat/completions',
    defaultModel: AIYIWEI_DEFAULT_CHAT_MODEL,
  },
  juhe: {
    url: 'https://api.juheapi.com/v1/chat/completions',
    defaultModel: JUHE_DEFAULT_CHAT_MODEL,
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  siliconflow: {
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: OPENROUTER_DEFAULT_MODEL,
  },
};

const VALID_ROLES = new Set(['system', 'user', 'assistant']);
const MAX_CHAT_MESSAGES = 64;
const MAX_TOTAL_MESSAGE_CHARS = 50_000;
const MAX_SINGLE_MESSAGE_CHARS = 50_000;

export function getReferer() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.SITE_URL || 'http://127.0.0.1:5173';
}

export function formatApiError(status, data, provider, model, clientApiKey) {
  const rawMsg = data?.error?.message || data?.message || '';
  const tokenHint = humanizeInvalidTokenError(rawMsg, provider);
  if (tokenHint) return tokenHint;
  if (isUpstreamBusyMessage(rawMsg)) {
    return formatUpstreamBusyUserMessage(rawMsg, canUseOpenRouterFallback(clientApiKey));
  }
  if (/无可用渠道|no available channel|distributor/i.test(rawMsg)) {
    const hint =
      provider === 'aiyiwei' || /doubao|mai-ds-r1|MAI-DS-R1|deepseek-v4-flash/i.test(model || '')
        ? `模型「${model || '未知'}」当前无可用渠道。请在设置中更换爱易威模型（如豆包 Mini 或 DeepSeek V4 Flash）`
        : `模型「${model || '未知'}」无可用渠道，请在设置中更换模型或服务商`;
    return `${hint}（${rawMsg.slice(0, 120)}）`;
  }
  if (status === 401) {
    const detail = rawMsg ? `：${rawMsg}` : '';
    const hints = {
      aiyiwei: `爱易威 API Key 无效或未授权${detail}。请从控制台完整复制 Key（勿含空格/换行），Base URL https://aiyiwei.vip/v1`,
      juhe: `聚合 API Key 无效或未授权${detail}。请检查 JUHE_API_KEY 或设置中的 Key`,
      openrouter: `OpenRouter API Key 无效或未授权${detail}。请前往 https://openrouter.ai/keys 重新复制 Key`,
      groq: `Groq API Key 无效${detail}。请前往 https://console.groq.com/keys 检查 Key`,
      siliconflow: `SiliconFlow API Key 无效${detail}。请前往控制台检查 Key`,
    };
    return hints[provider] || `API Key 无效或未授权 (401)${detail}`;
  }
  return data?.error?.message || data?.message || `API 请求失败 (${status})`;
}

export function resolveProvider(provider, apiKey) {
  const detected = detectProviderFromKey(apiKey, provider);
  if (detected) return detected;
  return provider;
}

const AIYIWEI_CHAT_ONLY_MODELS = new Set([
  'doubao-seed-2-0-mini-260428',
  'doubao-seed-2-0-mini-260215',
]);

function coerceServerModel(provider, model, task = 'chat') {
  const config = PROVIDERS[provider] || PROVIDERS.aiyiwei;
  const normalized = !model || model === 'auto' ? '' : stripAiyiweiRoutingSuffix(model);
  const legacyJuhe = new Set(['doubao-seed-2-0-lite', 'doubao-seed-2-0-mini']);
  if (provider === 'aiyiwei' && normalized && legacyJuhe.has(normalized)) {
    return AIYIWEI_DEFAULT_CHAT_MODEL;
  }
  if (
    provider === 'aiyiwei' &&
    task === 'deepAnalysis' &&
    normalized &&
    AIYIWEI_CHAT_ONLY_MODELS.has(normalized)
  ) {
    return AIYIWEI_DEFAULT_ANALYSIS_MODEL;
  }
  if (normalized) return normalized;
  if (provider === 'juhe') return JUHE_DEFAULT_CHAT_MODEL;
  if (provider === 'aiyiwei') {
    return task === 'deepAnalysis' ? AIYIWEI_DEFAULT_ANALYSIS_MODEL : AIYIWEI_DEFAULT_CHAT_MODEL;
  }
  return config.defaultModel;
}

function resolveDefaultModel(provider, model, task = 'chat') {
  return coerceServerModel(provider, model, task);
}

function clampMaxTokens(n, fallback = 4096) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return fallback;
  return Math.min(8192, Math.max(1, Math.floor(v)));
}

function validateChatBody(body) {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('请求体无效'), { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw Object.assign(new Error('消息不能为空'), { status: 400 });
  }
  if (body.messages.length > MAX_CHAT_MESSAGES) {
    throw Object.assign(new Error(`消息条数不能超过 ${MAX_CHAT_MESSAGES}`), { status: 400 });
  }
  const totalChars = body.messages.reduce(
    (sum, msg) => sum + (typeof msg?.content === 'string' ? msg.content.length : 0),
    0
  );
  if (totalChars > MAX_TOTAL_MESSAGE_CHARS) {
    throw Object.assign(new Error('消息总长度过大，请先压缩或删除当前不相关内容'), { status: 400 });
  }
  for (const msg of body.messages) {
    if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) {
      throw Object.assign(new Error('消息格式无效：每条须含 content'), { status: 400 });
    }
    if (msg.content.length > MAX_SINGLE_MESSAGE_CHARS) {
      throw Object.assign(new Error('单条消息过长'), { status: 400 });
    }
    if (!VALID_ROLES.has(msg.role)) {
      throw Object.assign(new Error(`无效 role: ${msg.role}`), { status: 400 });
    }
  }
  if (body.maxTokens !== undefined) {
    body.maxTokens = clampMaxTokens(body.maxTokens);
  }
}

function formatFetchError(err, provider) {
  const cause = err?.cause?.message || err?.cause?.code || '';
  const raw = `${err?.message || ''} ${cause}`.trim();

  if (/certificate|cert|ssl|tls/i.test(raw)) {
    if (provider === 'juhe') {
      return '聚合 API (juheapi.com) SSL 证书异常，暂无法连接。请切换为「爱易威 API」并使用 sk- 开头的 Key';
    }
    return `${provider} API 安全连接失败（证书异常），请检查网络或更换服务商`;
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|getaddrinfo/i.test(raw)) {
    return `无法连接 ${provider} API，请检查网络或 DNS`;
  }
  return raw || '网络请求失败，请稍后重试';
}

const PROVIDER_FETCH_TIMEOUT_MS = Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS) || 60_000;

async function fetchWithTimeout(url, options, timeoutMs = PROVIDER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const parentSignal = options?.signal;
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw Object.assign(new Error('上游请求超时，请稍后重试'), { status: 408, code: 'TIMEOUT' });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
  }
}

export async function fetchChatCompletion({
  provider,
  apiKey,
  model,
  messages,
  temperature,
  topP,
  maxTokens,
  jsonMode = true,
  shouldAbort,
}) {
  throwIfAborted(shouldAbort);

  const config = PROVIDERS[provider] || PROVIDERS.openrouter;
  const selectedModel = coerceServerModel(provider, model);
  const key = normalizeApiKey(apiKey);

  if (!key) {
    const err = new Error('请先配置 API Key');
    err.status = 400;
    throw err;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = getReferer();
    headers['X-Title'] = 'Soul Chat Assistant';
  }

  const body = {
    model: selectedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (topP != null && Number.isFinite(topP)) {
    body.top_p = topP;
  }
  if (shouldUseJsonResponseFormat(selectedModel, jsonMode)) {
    body.response_format = { type: 'json_object' };
  }

  let response;
  try {
    response = await fetchWithTimeout(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err?.status) throw err;
    throw Object.assign(new Error(formatFetchError(err, provider)), { status: 502 });
  }

  throwIfAborted(shouldAbort);

  const text = await response.text();
  throwIfAborted(shouldAbort);
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!response.ok) {
      throw Object.assign(new Error(`API 返回非 JSON (${response.status})`), {
        status: response.status,
      });
    }
  }

  if (!response.ok) {
    throw Object.assign(new Error(formatApiError(response.status, data, provider, selectedModel, apiKey)), {
      status: response.status,
    });
  }

  const choice = data.choices?.[0];
  const content =
    extractMessageText(choice?.message) ||
    (typeof choice?.text === 'string' ? choice.text : '');
  if (!content.trim()) {
    throw new Error('AI 返回内容为空，请重试或更换模型');
  }

  return { content, usage: data.usage, model: selectedModel };
}

function extractStreamDeltaText(delta) {
  if (!delta) return '';
  if (typeof delta.content === 'string') return delta.content;
  if (Array.isArray(delta.content)) {
    return delta.content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  return '';
}

/** OpenAI 兼容接口流式调用（Juhe 等），实时推送片段 */
export async function streamProviderChatCompletion({
  provider,
  apiKey,
  model,
  messages,
  temperature,
  topP,
  maxTokens,
  jsonMode = true,
  onChunk,
  shouldAbort,
}) {
  throwIfAborted(shouldAbort);

  const config = PROVIDERS[provider] || PROVIDERS.openrouter;
  const selectedModel = coerceServerModel(provider, model);
  const key = normalizeApiKey(apiKey);

  if (!key) {
    const err = new Error('请先配置 API Key');
    err.status = 400;
    throw err;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };

  const body = {
    model: selectedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };
  if (topP != null && Number.isFinite(topP)) {
    body.top_p = topP;
  }
  if (shouldUseJsonResponseFormat(selectedModel, jsonMode)) {
    body.response_format = { type: 'json_object' };
  }

  let response;
  try {
    response = await fetchWithTimeout(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err?.status) throw err;
    throw Object.assign(new Error(formatFetchError(err, provider)), { status: 502 });
  }

  throwIfAborted(shouldAbort);

  if (!response.ok) {
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      /* ignore */
    }
    throw Object.assign(
      new Error(formatApiError(response.status, data, provider, selectedModel, apiKey)),
      { status: response.status }
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取 AI 响应流');

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let usage = null;
  let usedModel = selectedModel;

  try {
    while (true) {
      throwIfAborted(shouldAbort);
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
          usedModel = chunk.model || usedModel;
          const delta = chunk.choices?.[0]?.delta;
          const text = extractStreamDeltaText(delta);
          if (text) {
            content += text;
            onChunk?.(text, content);
          }
          if (chunk.usage) usage = chunk.usage;
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }

  if (!content.trim()) {
    throw new Error('AI 返回内容为空，请重试或更换模型');
  }

  return { content, usage, model: usedModel };
}

export async function handleChat(req) {
  await assertRateLimit(req, buildRateLimitOptions(req, {
    key: 'chat',
    userMax: 36,
    serverMax: 16,
    windowMs: 60_000,
  }));
  const body = req.body;
  validateChatBody(body);

  let {
    provider = 'openrouter',
    apiKey,
    model,
    messages,
    temperature = 0.7,
    topP,
    maxTokens = 4096,
    jsonMode = true,
    lockModel = false,
  } = body;

  provider = resolveProvider(provider, apiKey);
  assertProductionApiAccess(req, provider, body);
  apiKey = finalizeApiKey(provider, apiKey);
  messages = injectServerSystemGuard(messages);

  if (provider === 'aiyiwei') {
    const taskDefaults = jsonMode
      ? getModelCallParams('deepAnalysis')
      : getModelCallParams('chat');
    temperature = temperature ?? taskDefaults.temperature;
    topP = topP ?? taskDefaults.topP;
    maxTokens = maxTokens ?? getMaxTokensForTask(jsonMode ? 'deepAnalysis' : 'chat', jsonMode);
  }

  if (provider === 'openrouter') {
    return streamOpenRouterChat({
      apiKey,
      model: model || OPENROUTER_DEFAULT_MODEL,
      messages,
      temperature,
      maxTokens,
      jsonMode,
    });
  }

  if (provider === 'aiyiwei') {
    return streamAiyiweiWithFallback({
      apiKey,
      model: resolveDefaultModel(provider, model, jsonMode ? 'deepAnalysis' : 'chat'),
      messages,
      temperature,
      topP,
      maxTokens,
      jsonMode,
      lockModel: Boolean(lockModel),
    });
  }

  return fetchChatCompletion({
    provider,
    apiKey,
    model: resolveDefaultModel(provider, model, jsonMode ? 'deepAnalysis' : 'chat'),
    messages,
    temperature,
    topP,
    maxTokens,
    jsonMode,
  });
}

function setupSse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

/** SSE 流式聊天，实时推送 OpenRouter 响应片段 */
export async function handleChatStream(req, res) {
  try {
    await assertRateLimit(req, buildRateLimitOptions(req, {
      key: 'chat-stream',
      userMax: 36,
      serverMax: 16,
      windowMs: 60_000,
    }));
    const body = req.body;
    validateChatBody(body);

    let {
      provider = 'openrouter',
      apiKey,
      model,
      messages,
      temperature = 0.7,
      topP,
      maxTokens = 4096,
      jsonMode = true,
      lockModel = false,
    } = body;

    provider = resolveProvider(provider, apiKey);
    assertProductionApiAccess(req, provider, body);
    apiKey = finalizeApiKey(provider, apiKey);
    messages = injectServerSystemGuard(messages);

    setupSse(res);

    let clientClosed = false;
    res.on('close', () => {
      clientClosed = true;
    });

    const onChunk = (delta) => {
      if (clientClosed || !delta) return;
      // Send only the newly generated text. The client keeps the accumulated value.
      writeSse(res, { type: 'chunk', delta });
    };

    let result;
    if (provider === 'openrouter') {
      result = await streamOpenRouterChat({
        apiKey,
        model: model || OPENROUTER_DEFAULT_MODEL,
        messages,
        temperature,
        maxTokens: clampMaxTokens(maxTokens),
        jsonMode,
        onChunk,
        shouldAbort: () => clientClosed,
      });
    } else if (provider === 'aiyiwei') {
      const taskDefaults = jsonMode
        ? getModelCallParams('deepAnalysis')
        : getModelCallParams('chat');
      const requestedModel = resolveDefaultModel(provider, model, jsonMode ? 'deepAnalysis' : 'chat');
      result = await streamAiyiweiWithFallback({
        apiKey,
        model: requestedModel,
        messages,
        temperature: temperature ?? taskDefaults.temperature,
        topP: topP ?? taskDefaults.topP,
        maxTokens: maxTokens ?? getMaxTokensForTask(jsonMode ? 'deepAnalysis' : 'chat', jsonMode),
        jsonMode,
        onChunk,
        shouldAbort: () => clientClosed,
        lockModel: Boolean(lockModel),
        onStatus: (status) => {
          if (!clientClosed) writeSse(res, { type: 'status', status });
        },
        onProviderFallback: () => {
          if (!clientClosed) {
            writeSse(res, {
              type: 'status',
              status: { type: 'provider_fallback', provider: 'openrouter' },
            });
          }
        },
      });
    } else {
      result = await streamProviderChatCompletion({
        provider,
        apiKey,
        model: resolveDefaultModel(provider, model, jsonMode ? 'deepAnalysis' : 'chat'),
        messages,
        temperature,
        topP,
        maxTokens,
        jsonMode,
        onChunk,
        shouldAbort: () => clientClosed,
      });
      if (clientClosed) {
        if (!res.writableEnded) res.end();
        return;
      }
    }

    if (!clientClosed) {
      writeSse(res, {
        type: 'done',
        content: result.content,
        usage: result.usage,
        model: result.model,
        requestedModel: result.requestedModel,
        modelSwitched: Boolean(result.modelSwitched),
      });
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || '服务器内部错误' });
      return;
    }
    writeSse(res, { type: 'error', error: err.message || '流式调用失败' });
    res.end();
  }
}

export async function handleVerifyKey(req) {
  await assertRateLimit(req, buildRateLimitOptions(req, {
    key: 'verify-key',
    userMax: 20,
    serverMax: 8,
    windowMs: 60_000,
  }));
  const body = req.body;
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('请求体无效'), { status: 400 });
  }

  let { provider = 'openrouter', apiKey, model } = body;
  provider = resolveProvider(provider, apiKey);
  assertProductionApiAccess(req, provider, body);
  apiKey = finalizeApiKey(provider, apiKey);

  const testMessages = [{ role: 'user', content: '请只回复一个词：好' }];

  if (provider === 'openrouter') {
    const keyInfo = await verifyOpenRouterApiKey(apiKey);
    const requested = resolveOpenRouterModelId(model || OPENROUTER_DEFAULT_MODEL);
    let modelNotice = null;
    let usedModel = requested;

    try {
      const result = await streamOpenRouterChat({
        apiKey,
        model: requested,
        messages: testMessages,
        temperature: 0,
        maxTokens: 256,
        jsonMode: false,
      });
      usedModel = result.model || requested;
      if (result.modelSwitched) {
        modelNotice = `Key 有效；所选模型暂不可用，已自动切换至备选模型（${usedModel}）`;
      }
    } catch {
      modelNotice = `Key 有效（${keyInfo.label || 'OpenRouter'}）；所选模型暂不可用，分析时将按配置列表自动切换模型`;
    }

    return {
      ok: true,
      provider,
      model: usedModel,
      preview: keyInfo.label || 'OpenRouter',
      ...(modelNotice ? { notice: modelNotice } : {}),
    };
  }

  const result = await fetchChatCompletion({
    provider,
    apiKey,
    model: resolveDefaultModel(provider, model),
    messages: testMessages,
    temperature: 0,
    maxTokens: 32,
    jsonMode: false,
  });
  return { ok: true, provider, model: result.model, preview: result.content.slice(0, 30) };
}

export function setCors(res, req) {
  const allowed = getAllowedSiteOrigins();
  const origin = req?.headers?.origin || '';
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-access-token'
  );
}
