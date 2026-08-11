import type { AIProvider, ModelRoutingMode, UserSettings } from '../types';
import { OPENAI_MODEL_OPTIONS, isOpenAiModelId } from './openaiModels';

export type ModelTask = 'chat' | 'deepAnalysis';

/** 设置中「自动按任务切换」占位值 */
export const AUTO_MODEL_ROUTING = 'auto';

/** 爱易威 API（OpenAI 兼容）模型 ID */
export const AIYIWEI_CHAT_MODEL = 'doubao-seed-2-0-mini-260428';
export const AIYIWEI_CHAT_MODEL_ALT = 'doubao-seed-2-0-mini-260215';
export const AIYIWEI_DEEP_ANALYSIS_MODEL = 'mai-ds-r1';
export const AIYIWEI_DEEP_ANALYSIS_MODEL_ALT = 'deepseek-v4-flash';

/** 聚合 API（Juhe）模型 ID · OpenAI 兼容 */
export const JUHE_GPT_CHAT_MODEL = 'gpt-5.4-mini';
export const JUHE_DOUBAO_CHAT_MODEL = 'doubao-seed-2-0-lite';
export const JUHE_CHAT_MODEL = JUHE_GPT_CHAT_MODEL;
export const JUHE_DEEP_ANALYSIS_MODEL = 'deepseek-v4-flash';

/** OpenRouter 模型 ID */
export const OPENROUTER_CHAT_MODEL = 'bytedance-seed/seed-2.0-lite';
export const OPENROUTER_DEEP_ANALYSIS_MODEL = 'deepseek/deepseek-v4-flash:free';

export interface ModelOptionItem {
  value: string;
  label: string;
  usage: string;
}

export const MODEL_TASK_LABELS: Record<ModelTask, string> = {
  chat: '豆包 Seed 2.0 Mini',
  deepAnalysis: '豆包 Mini · 快速分析',
};

const JUHE_MODEL_TASK_LABELS: Record<ModelTask, string> = {
  chat: 'GPT-5.4 Mini',
  deepAnalysis: 'DeepSeek V4 Flash',
};

const PROVIDER_MODELS: Record<'aiyiwei' | 'juhe' | 'openrouter', Record<ModelTask, string>> = {
  aiyiwei: {
    chat: AIYIWEI_CHAT_MODEL,
    deepAnalysis: AIYIWEI_CHAT_MODEL,
  },
  juhe: {
    chat: JUHE_CHAT_MODEL,
    deepAnalysis: JUHE_DEEP_ANALYSIS_MODEL,
  },
  openrouter: {
    chat: OPENROUTER_CHAT_MODEL,
    deepAnalysis: OPENROUTER_DEEP_ANALYSIS_MODEL,
  },
};

const AIYIWEI_MODEL_OPTIONS: ModelOptionItem[] = [
  ...OPENAI_MODEL_OPTIONS,
  {
    value: AIYIWEI_CHAT_MODEL,
    label: '豆包 Mini',
    usage: 'doubao-seed-2-0-mini-260428 · 话术生成（推荐，服务端自动 :stable）',
  },
  {
    value: AIYIWEI_CHAT_MODEL_ALT,
    label: '豆包 Mini',
    usage: 'doubao-seed-2-0-mini-260215 · 话术备选（:floor/:nitro/:stable 见文档）',
  },
  {
    value: AIYIWEI_DEEP_ANALYSIS_MODEL,
    label: 'MAI-DS-R1',
    usage: 'MAI-DS-R1 · 深度心理穿透（推荐，服务端自动 :stable）',
  },
  {
    value: AIYIWEI_DEEP_ANALYSIS_MODEL_ALT,
    label: 'DeepSeek V4 Flash',
    usage: 'deepseek-v4-flash · 深度心理分析（智能模式默认，服务端自动 :stable）',
  },
];

const JUHE_MODEL_OPTIONS: ModelOptionItem[] = [
  ...OPENAI_MODEL_OPTIONS,
  {
    value: JUHE_DOUBAO_CHAT_MODEL,
    label: '豆包 Seed 2.0 Lite',
    usage: '话术备选（低成本）',
  },
  {
    value: JUHE_DEEP_ANALYSIS_MODEL,
    label: JUHE_MODEL_TASK_LABELS.deepAnalysis,
    usage: '深度心理分析（推理更强）',
  },
];

const OPENROUTER_MODEL_OPTIONS: ModelOptionItem[] = [
  { value: OPENROUTER_CHAT_MODEL, label: JUHE_MODEL_TASK_LABELS.chat, usage: '话术生成、普通调用' },
  {
    value: OPENROUTER_DEEP_ANALYSIS_MODEL,
    label: JUHE_MODEL_TASK_LABELS.deepAnalysis,
    usage: '深度心理分析',
  },
];

export function supportsAutoModelRouting(provider: AIProvider): boolean {
  return provider === 'aiyiwei' || provider === 'juhe' || provider === 'openrouter';
}

export function getSelectableModels(provider: AIProvider): ModelOptionItem[] {
  if (provider === 'aiyiwei') return AIYIWEI_MODEL_OPTIONS;
  if (provider === 'juhe') return JUHE_MODEL_OPTIONS;
  if (provider === 'openrouter') return OPENROUTER_MODEL_OPTIONS;
  return [];
}

/** 按 model value 去重（避免 select 重复 option 无法展开） */
export function getUniqueSelectableModels(provider: AIProvider): ModelOptionItem[] {
  const seen = new Set<string>();
  return getSelectableModels(provider).filter((opt) => {
    if (seen.has(opt.value)) return false;
    seen.add(opt.value);
    return true;
  });
}

/** 确保模型 ID 与当前服务商匹配 */
export function coerceModelForProvider(
  modelId: string | undefined,
  task: ModelTask,
  provider: AIProvider
): string {
  const allowed = new Set(getSelectableModels(provider).map((m) => m.value));
  if (modelId && allowed.has(modelId)) return modelId;
  return resolveModelForTask(task, provider);
}

export function getDefaultModelsForProvider(provider: AIProvider): {
  chat: string;
  analysis: string;
} {
  if (provider === 'openrouter') {
    return {
      chat: OPENROUTER_CHAT_MODEL,
      analysis: OPENROUTER_DEEP_ANALYSIS_MODEL,
    };
  }
  if (provider === 'juhe') {
    return { chat: JUHE_CHAT_MODEL, analysis: JUHE_DEEP_ANALYSIS_MODEL };
  }
  return { chat: AIYIWEI_CHAT_MODEL, analysis: AIYIWEI_DEEP_ANALYSIS_MODEL };
}

export function isAutoModelMode(
  settings: Pick<UserSettings, 'modelMode' | 'model'>
): boolean {
  if (settings.modelMode === 'manual') return false;
  if (settings.modelMode === 'auto') return true;
  return settings.model === AUTO_MODEL_ROUTING || settings.model === 'auto' || !settings.model;
}

export function resolveModelForTask(task: ModelTask, provider: AIProvider = 'aiyiwei'): string {
  if (provider === 'aiyiwei' || provider === 'juhe' || provider === 'openrouter') {
    return PROVIDER_MODELS[provider][task];
  }
  return PROVIDER_MODELS.aiyiwei[task];
}

/** 与 shared/modelCoerce.js 同规则，改模型名单时两边同步 */
const AIYIWEI_CHAT_ONLY_MODELS = new Set([AIYIWEI_CHAT_MODEL, AIYIWEI_CHAT_MODEL_ALT]);
const AIYIWEI_ANALYSIS_MODELS = new Set([
  AIYIWEI_DEEP_ANALYSIS_MODEL,
  AIYIWEI_DEEP_ANALYSIS_MODEL_ALT,
]);

/** 深度分析禁止使用豆包话术模型（OpenAI / 深度模型可用） */
export function coerceAnalysisModel(modelId: string, provider: AIProvider): string {
  if (provider === 'aiyiwei' && AIYIWEI_CHAT_ONLY_MODELS.has(modelId)) {
    return AIYIWEI_DEEP_ANALYSIS_MODEL;
  }
  return modelId;
}

/** 话术回答优先豆包；误选深度分析模型时自动纠正（OpenAI 模型保留） */
export function coerceChatModel(modelId: string, provider: AIProvider): string {
  if (provider === 'aiyiwei' && AIYIWEI_ANALYSIS_MODELS.has(modelId) && !isOpenAiModelId(modelId)) {
    return AIYIWEI_CHAT_MODEL;
  }
  return modelId;
}

/** 话术回答可选模型（爱易威排除深度分析模型） */
export function getChatModelOptions(provider: AIProvider): ModelOptionItem[] {
  const options = getUniqueSelectableModels(provider);
  if (provider === 'aiyiwei') {
    return options.filter((m) => !AIYIWEI_ANALYSIS_MODELS.has(m.value));
  }
  return options;
}

/** 深度心理分析可选模型（爱易威排除豆包话术模型） */
export function getAnalysisModelOptions(provider: AIProvider): ModelOptionItem[] {
  const options = getUniqueSelectableModels(provider);
  if (provider === 'aiyiwei') {
    return options.filter((m) => !AIYIWEI_CHAT_ONLY_MODELS.has(m.value));
  }
  return options;
}

/** 根据用户设置解析实际调用的模型 ID */
export function resolveModelForSettings(task: ModelTask, settings: UserSettings): string {
  if (!supportsAutoModelRouting(settings.provider)) {
    return settings.model || '';
  }
  if (isAutoModelMode(settings)) {
    return resolveModelForTask(task, settings.provider);
  }
  const raw =
    task === 'deepAnalysis' ? settings.manualAnalysisModel : settings.manualChatModel;
  const coerced = coerceModelForProvider(raw, task, settings.provider);
  if (task === 'deepAnalysis') {
    return coerceAnalysisModel(coerced, settings.provider);
  }
  return coerceChatModel(coerced, settings.provider);
}

const COMBINED_FAST_CHAT_MODELS = new Set([
  JUHE_GPT_CHAT_MODEL,
  JUHE_DOUBAO_CHAT_MODEL,
  OPENROUTER_CHAT_MODEL,
  AIYIWEI_CHAT_MODEL,
  AIYIWEI_CHAT_MODEL_ALT,
]);

/** 分析+话术同模型时合并为一次 API（豆包/GPT 等快模型，跳过 MAI-DS-R1） */
export function shouldUseCombinedFastPath(
  settings: UserSettings,
  analysisModel: string,
  replyModel: string
): boolean {
  if (!supportsAutoModelRouting(settings.provider)) return false;
  if (analysisModel === AIYIWEI_DEEP_ANALYSIS_MODEL || replyModel === AIYIWEI_DEEP_ANALYSIS_MODEL) {
    return false;
  }
  if (analysisModel === replyModel) return true;
  // 聚合/OpenRouter 智能模式：话术用快模型时，分析+话术合并为一次请求（省 1 次往返）
  if (
    settings.modelMode !== 'manual' &&
    (settings.provider === 'juhe' || settings.provider === 'openrouter') &&
    COMBINED_FAST_CHAT_MODELS.has(replyModel)
  ) {
    return true;
  }
  return false;
}

export function getModelLabelById(modelId: string, provider: AIProvider): string {
  const found = getSelectableModels(provider).find((m) => m.value === modelId);
  return found?.label ?? modelId;
}

/** 下拉选项文案：顶栏紧凑模式 */
export function formatModelSelectLabel(opt: ModelOptionItem, compact = false): string {
  if (compact) {
    if (isOpenAiModelId(opt.value)) return opt.label;
    return opt.value;
  }
  return `${opt.label} — ${opt.usage}`;
}

/** 分析/流式进度条展示的模型名（含 id） */
export function formatActiveModelDisplay(modelId: string, provider: AIProvider): string {
  const label = getModelLabelById(modelId, provider);
  if (label === modelId) return modelId;
  return `${label} · ${modelId}`;
}

function getTaskLabels(provider: AIProvider): Record<ModelTask, string> {
  if (provider === 'aiyiwei') return MODEL_TASK_LABELS;
  return JUHE_MODEL_TASK_LABELS;
}

export function getModelRoutingSummary(
  provider: AIProvider = 'aiyiwei',
  settings?: Pick<UserSettings, 'modelMode' | 'model' | 'manualChatModel' | 'manualAnalysisModel'>
): string {
  const labels = getTaskLabels(provider);
  if (settings && !isAutoModelMode(settings)) {
    return `手动 · ${getModelLabelById(settings.manualChatModel, provider)} / ${getModelLabelById(settings.manualAnalysisModel, provider)}`;
  }
  const chatId = resolveModelForTask('chat', provider);
  const analysisId = resolveModelForTask('deepAnalysis', provider);
  return `智能 · ${labels.chat}（${chatId}）· ${labels.deepAnalysis}（${analysisId}）`;
}

export function resolveTaskFromStreamPhase(
  phase: 'analysis' | 'parsing' | 'replies' | 'finishing' | string
): ModelTask {
  return phase === 'analysis' || phase === 'parsing' ? 'deepAnalysis' : 'chat';
}

export function resolveActiveModelLabel(
  settings: UserSettings,
  phase: 'analysis' | 'parsing' | 'replies' | 'finishing' | string
): string {
  const task = resolveTaskFromStreamPhase(phase);
  const modelId = resolveModelForSettings(task, settings);
  return formatActiveModelDisplay(modelId, settings.provider);
}

/** 手动模式 · 双模型进度说明（分析 / 话术各用各的模型） */
export function formatManualDualModelProgress(
  settings: UserSettings,
  phase: 'analysis' | 'parsing' | 'replies' | 'finishing' | string
): string {
  if (!supportsAutoModelRouting(settings.provider) || isAutoModelMode(settings)) {
    return '';
  }
  const chatId = resolveModelForSettings('chat', settings);
  const analysisId = resolveModelForSettings('deepAnalysis', settings);
  const chat = formatActiveModelDisplay(chatId, settings.provider);
  const analysis = formatActiveModelDisplay(analysisId, settings.provider);

  if (phase === 'replies' || phase === 'finishing') {
    return `话术模型：${chat}`;
  }
  if (chatId === analysisId) {
    return `模型：${chat}`;
  }
  return `① 心理分析 ${analysis} → ② 话术 ${chat}`;
}

/** 切换智能 / 手动模式时写入的设置补丁 */
export function buildModelModePatch(
  mode: ModelRoutingMode,
  settings: Pick<UserSettings, 'provider' | 'manualChatModel' | 'manualAnalysisModel'>
): Partial<UserSettings> {
  const defaults = getDefaultModelsForProvider(settings.provider);
  return {
    modelMode: mode,
    model: mode === 'auto' ? AUTO_MODEL_ROUTING : 'manual',
    ...(mode === 'manual'
      ? {
          manualChatModel: settings.manualChatModel || defaults.chat,
          manualAnalysisModel:
            settings.manualAnalysisModel &&
            settings.manualAnalysisModel !== (settings.manualChatModel || defaults.chat)
              ? settings.manualAnalysisModel
              : defaults.analysis,
        }
      : {}),
  };
}

/** 顶栏/设置里改模型时强制保持手动模式，并锁定所选模型不被服务端自动降级 */
export function applyManualModelPatch(
  patch: Partial<UserSettings>
): Partial<UserSettings> {
  if (patch.modelMode === 'auto') return patch;
  return {
    ...patch,
    modelMode: 'manual',
    model: 'manual',
  };
}
