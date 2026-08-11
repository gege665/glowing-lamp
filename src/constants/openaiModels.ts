import type { ModelOptionItem } from './modelRouting';

/** OpenAI 兼容模型 · 爱易威 / 聚合 API 均可用 */
export const OPENAI_MODEL_OPTIONS: ModelOptionItem[] = [
  {
    value: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    usage: 'OpenAI · 话术推荐首选',
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    usage: 'OpenAI · 轻量快速（OCR 同款）',
  },
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    usage: 'OpenAI · 更强理解与表达',
  },
];

export const OPENAI_MODEL_IDS = new Set(OPENAI_MODEL_OPTIONS.map((m) => m.value));

export function isOpenAiModelId(modelId: string): boolean {
  return OPENAI_MODEL_IDS.has(modelId) || /^gpt-/i.test(modelId);
}
