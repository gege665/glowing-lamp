import { timingSafeEqual } from 'node:crypto';
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
import { shouldUseJsonResponseFormat } from '../shared/modelCapabilities.js';
import { throwIfAborted } from '../shared/abortSleep.js';
import { assertRateLimit } from '../shared/rateLimit.js';
import { coerceServerModel as coerceSharedModel } from '../shared/modelCoerce.js';

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
 * 客户端 Key 是否真能作为 BYOK（避免任意非空字符串绕过鉴权后仍走服务端 Key）
 */
export function isClientBringYourOwnKey(provider, clientApiKey) {
  const clientKey = normalizeApiKey(clientApiKey);
  if (!clientKey) return false;
  if (provider === 'openrouter') {
    return clientKey.startsWith('sk-or-') || clientKey.startsWith('gsk_');
  }
  // juhe / aiyiwei：非空 client key 会原样用于上游
  return true;
}

/** 常量时间比较访问令牌，降低时序侧信道风险 */
export function isValidApiAccessToken(provided) {
  const expected = String(process.env.API_ACCESS_TOKEN || '');
  if (!expected) return false;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function requestHasValidAccessToken(req) {
  return isValidApiAccessToken(req.headers['x-api-access-token']);
}

/**
 * 生产环境 + 服务端 Key：禁止外部脚本白嫖。
 * 优先：真实 BYOK；其次：必须持有 x-api-access-token。
 * 有服务端 Key 时不再接受「仅 Origin」——Origin/Referer 可被伪造。
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

  if (isClientBringYourOwnKey(provider, body?.apiKey)) return;

  const tokenConfigured = Boolean(String(process.env.API_ACCESS_TOKEN || '').trim());
  if (!tokenConfigured) {
    throw Object.assign(
      new Error(
        '未授权：生产环境已配置服务端 API Key，必须同时设置 API_ACCESS_TOKEN 与 VITE_API_ACCESS_TOKEN（值相同）后重新部署'
      ),
      { status: 403 }
    );
  }

  if (requestHasValidAccessToken(req)) return;
  throw Object.assign(
    new Error(
      '未授权：需要访问令牌。请在 Vercel 同时配置 API_ACCESS_TOKEN 与 VITE_API_ACCESS_TOKEN（值相同）后重新部署'
    ),
    { status: 403 }
  );
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

export function getReferer() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.SITE_URL || 'http://127.0.0.1:5173';
}

export function formatApiError(status, data, provider, model, clientApiKey) {
  const rawMsg = data?.error?.message || data?.message || '';
  const tokenHint = humanizeInvalidTokenError(rawMsg, provider);
  if (tokenHint) return tokenHint;
  if (isUpstreamBusyMessage(rawMsg)) {
    return formatUpstreamBusyUserMessage(rawMsg);
  }
  if (/无可用渠道|no available channel|distributor/i.test(rawMsg)) {
    return provider === 'aiyiwei' || /doubao|mai-ds-r1|MAI-DS-R1|deepseek-v4-flash/i.test(model || '')
      ? `模型「${model || '未知'}」当前无可用渠道。请在设置中更换爱易威模型（如豆包 Mini 或 DeepSeek V4 Flash）`
      : `模型「${model || '未知'}」无可用渠道，请在设置中更换模型或服务商`;
  }
  if (status === 401) {
    const hints = {
      aiyiwei:
        '爱易威 API Key 无效或未授权。请从控制台完整复制 Key（勿含空格/换行），Base URL https://aiyiwei.vip/v1',
      juhe: '聚合 API Key 无效或未授权。请检查 JUHE_API_KEY 或设置中的 Key',
      openrouter: 'OpenRouter API Key 无效或未授权。请前往 https://openrouter.ai/keys 重新复制 Key',
      groq: 'Groq API Key 无效。请前往 https://console.groq.com/keys 检查 Key',
      siliconflow: 'SiliconFlow API Key 无效。请前往控制台检查 Key',
    };
    return hints[provider] || 'API Key 无效或未授权 (401)';
  }
  // 不透传上游原始文案，避免泄露渠道/路由内部信息
  return `API 请求失败 (${status})，请稍后重试或更换模型`;
}

export function resolveProvider(provider, apiKey) {
  const detected = detectProviderFromKey(apiKey, provider);
  if (detected) return detected;
  return provider;
}

function coerceServerModel(provider, model, task = 'chat') {
  const config = PROVIDERS[provider] || PROVIDERS.aiyiwei;
  return coerceSharedModel(provider, model, task, {
    defaultChat: AIYIWEI_DEFAULT_CHAT_MODEL,
    defaultAnalysis: AIYIWEI_DEFAULT_ANALYSIS_MODEL,
    fallbackDefault: config.defaultModel,
  });
}

function resolveDefaultModel(provider, model, task = 'chat') {
  return coerceServerModel(provider, model, task);
}

const MAX_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 50_000;
/** 全部 messages.content 合计上限，防止 200×50k 撑爆上游/账单 */
const MAX_TOTAL_MESSAGE_CHARS = 120_000;

/** 未显式传 maxTokens 时的保守默认，避免服务端按 4096 放大算力 */
function clampMaxTokens(n, fallback = 1200) {
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
  if (body.messages.length > MAX_MESSAGES) {
    throw Object.assign(new Error(`消息条数不能超过 ${MAX_MESSAGES}`), { status: 400 });
  }
  let totalChars = 0;
  for (const msg of body.messages) {
    if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) {
      throw Object.assign(new Error('消息格式无效：每条须含 content'), { status: 400 });
    }
    if (msg.content.length > MAX_MESSAGE_CHARS) {
      throw Object.assign(new Error('单条消息过长'), { status: 400 });
    }
    if (!VALID_ROLES.has(msg.role)) {
      throw Object.assign(new Error(`无效 role: ${msg.role}`), { status: 400 });
    }
    totalChars += msg.content.length;
  }
  if (totalChars > MAX_TOTAL_MESSAGE_CHARS) {
    throw Object.assign(new Error('对话内容过长，请精简后再试'), { status: 400 });
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
  // 不回传原始网络/堆栈细节
  return '网络请求失败，请稍后重试';
}

const PROVIDER_FETCH_TIMEOUT_MS = Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS) || 120_000;

async function fetchWithTimeout(url, options, timeoutMs = PROVIDER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
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
      if (parentSignal?.aborted && !timedOut) {
        throw Object.assign(new Error('客户端已断开'), { status: 499, code: 'CLIENT_ABORT' });
      }
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
  assertRateLimit(req, { key: 'chat', max: 24, windowMs: 60_000 });
  const body = req.body;
  validateChatBody(body);

  let {
    provider = 'openrouter',
    apiKey,
    model,
    messages,
    temperature = 0.7,
    topP,
    maxTokens,
    jsonMode = true,
    lockModel = false,
  } = body;

  provider = resolveProvider(provider, apiKey);
  assertProductionApiAccess(req, provider, body);
  apiKey = finalizeApiKey(provider, apiKey);

  {
    const taskDefaults = jsonMode
      ? getModelCallParams('deepAnalysis')
      : getModelCallParams('chat');
    temperature = temperature ?? taskDefaults.temperature;
    topP = topP ?? taskDefaults.topP;
    maxTokens = clampMaxTokens(
      maxTokens ?? getMaxTokensForTask(jsonMode ? 'deepAnalysis' : 'chat', jsonMode)
    );
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
    assertRateLimit(req, { key: 'chat-stream', max: 24, windowMs: 60_000 });
    const body = req.body;
    validateChatBody(body);

    let {
      provider = 'openrouter',
      apiKey,
      model,
      messages,
      temperature = 0.7,
      topP,
      maxTokens,
      jsonMode = true,
      lockModel = false,
    } = body;

    provider = resolveProvider(provider, apiKey);
    assertProductionApiAccess(req, provider, body);
    apiKey = finalizeApiKey(provider, apiKey);

    {
      const taskDefaults = jsonMode
        ? getModelCallParams('deepAnalysis')
        : getModelCallParams('chat');
      temperature = temperature ?? taskDefaults.temperature;
      topP = topP ?? taskDefaults.topP;
      maxTokens = clampMaxTokens(
        maxTokens ?? getMaxTokensForTask(jsonMode ? 'deepAnalysis' : 'chat', jsonMode)
      );
    }

    setupSse(res);

    let clientClosed = false;
    res.on('close', () => {
      clientClosed = true;
    });

    const onChunk = (_delta, full) => {
      if (clientClosed) return;
      writeSse(res, { type: 'chunk', content: full });
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
      writeSse(res, { type: 'chunk', content: result.content });
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
  assertRateLimit(req, { key: 'verify-key', max: 12, windowMs: 60_000 });
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
