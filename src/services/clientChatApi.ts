import type { UserSettings } from '../types';
import { normalizeApiKey } from '../utils/apiKey';
import { apiFetch } from '../utils/apiFetch';
import { checkApiHealth } from './aiService';
import {
  getModelCallParams,
  mergeSystemPrompt,
  type ModelCallTask,
} from '../constants/modelCallParams';
import { resolveModelForSettings } from '../constants/modelRouting';

/** 确认本地 Key 或服务端 Key 可用 */
export async function assertApiKeyConfigured(settings: UserSettings): Promise<void> {
  if (settings.apiKey?.trim()) return;
  const health = await checkApiHealth();
  if (!health.serverKeyConfigured) throw new Error('请先配置 API Key');
}

export interface PostChatCompletionOptions {
  settings: UserSettings;
  systemPrompt: string;
  userContent: string;
  /** 默认 chat */
  task?: ModelCallTask;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/** 统一 POST /api/chat，减少各 service 样板代码 */
export async function postChatCompletion(opts: PostChatCompletionOptions): Promise<string> {
  const cfg = opts.settings;
  const task = opts.task ?? 'chat';
  const params = getModelCallParams(task);
  const model = resolveModelForSettings(task === 'deepAnalysis' ? 'deepAnalysis' : 'chat', cfg);
  const apiKey = normalizeApiKey(cfg.apiKey);

  const res = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({
      provider: cfg.provider,
      apiKey,
      model,
      messages: [
        {
          role: 'system',
          content: mergeSystemPrompt(params.systemTone, opts.systemPrompt),
        },
        { role: 'user', content: opts.userContent },
      ],
      temperature: opts.temperature ?? params.temperature,
      maxTokens: opts.maxTokens ?? params.maxTokens,
      jsonMode: opts.jsonMode ?? true,
      task,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(String((err as { error?: string }).error || '请求失败'));
  }
  const data = (await res.json()) as { content?: string };
  return String(data.content || '');
}
