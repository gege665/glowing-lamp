import {
  streamOpenRouterChat,
  resolveOpenRouterApiKey,
  canUseOpenRouterFallback,
} from './openrouter.js';
import { streamAiyiweiChat } from './aiyiwei.js';
import { getModelCallParams, getMaxTokensForTask } from '../shared/modelCallParams.js';
import {
  OPENROUTER_CHAT_MODEL,
  OPENROUTER_DEEP_ANALYSIS_MODEL,
} from '../shared/modelRouting.js';
import { isUpstreamBusyMessage, formatUpstreamBusyUserMessage } from '../shared/upstreamErrors.js';

/** 爱易威分组饱和时，自动切 OpenRouter 备用线路（单次故障转移，非时间重试） */
export async function invokeOpenRouterFallback({
  clientApiKey,
  jsonMode,
  messages,
  temperature,
  topP,
  maxTokens,
  onChunk,
  shouldAbort,
  requestedModel,
}) {
  const orKey = resolveOpenRouterApiKey(clientApiKey);
  if (!orKey) return null;

  const taskDefaults = getModelCallParams(jsonMode ? 'deepAnalysis' : 'chat');
  const orModel = jsonMode ? OPENROUTER_DEEP_ANALYSIS_MODEL : OPENROUTER_CHAT_MODEL;

  const result = await streamOpenRouterChat({
    apiKey: orKey,
    model: orModel,
    messages,
    temperature: temperature ?? taskDefaults.temperature,
    topP: topP ?? taskDefaults.topP,
    maxTokens:
      maxTokens ?? getMaxTokensForTask(jsonMode ? 'deepAnalysis' : 'chat', jsonMode),
    jsonMode,
    onChunk,
    shouldAbort,
  });

  return {
    ...result,
    model: result.model || orModel,
    requestedModel: requestedModel || orModel,
    modelSwitched: true,
    providerFallback: 'openrouter',
  };
}

function throwBusyUserError(err) {
  const base = err ?? new Error('上游繁忙');
  const formatted = new Error(formatUpstreamBusyUserMessage(base.message));
  formatted.status = base.status ?? 503;
  throw formatted;
}

/** 爱易威流式调用 + 饱和时 OpenRouter 兜底（无多层嵌套重试） */
export async function streamAiyiweiWithFallback({
  apiKey,
  model,
  messages,
  temperature,
  topP,
  maxTokens,
  jsonMode,
  onChunk,
  shouldAbort,
  onStatus,
  onProviderFallback,
  lockModel = false,
}) {
  try {
    return await streamAiyiweiChat({
      apiKey,
      model,
      messages,
      temperature,
      topP,
      maxTokens,
      jsonMode,
      onChunk,
      shouldAbort,
      onStatus,
      lockModel,
    });
  } catch (err) {
    if (lockModel) {
      console.error('[Aiyiwei] 手动锁定模型失败:', err);
      throw err;
    }
    if (!isUpstreamBusyMessage(err?.message)) {
      console.error('[Aiyiwei] 请求失败:', err);
      throw err;
    }

    if (!canUseOpenRouterFallback(apiKey)) {
      throwBusyUserError(err);
    }

    onProviderFallback?.();
    try {
      const fallback = await invokeOpenRouterFallback({
        clientApiKey: apiKey,
        jsonMode,
        messages,
        temperature,
        topP,
        maxTokens,
        onChunk,
        shouldAbort,
        requestedModel: model,
      });
      if (fallback) return fallback;
    } catch (orErr) {
      console.error('[AiyiweiFallback] OpenRouter 备用线路失败:', orErr);
      throw orErr;
    }

    throwBusyUserError(err);
  }
}
