import type { AIProvider, ModelRoutingMode, UserSettings } from '../types';
import { ChevronDown } from 'lucide-react';
import {
  AUTO_MODEL_ROUTING,
  buildModelModePatch,
  applyManualModelPatch,
  getDefaultModelsForProvider,
  formatModelSelectLabel,
  getModelLabelById,
  getModelRoutingSummary,
  getChatModelOptions,
  getAnalysisModelOptions,
  isAutoModelMode,
  resolveModelForSettings,
  resolveModelForTask,
} from '../constants/modelRouting';

const PROVIDER_LABELS: Record<AIProvider, string> = {
  aiyiwei: '爱易威',
  juhe: '聚合 API',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  siliconflow: 'SiliconFlow',
};

function ProviderBadge({ provider }: { provider: AIProvider }) {
  return (
    <span
      className="text-[10px] text-soul-500 shrink-0 whitespace-nowrap hidden lg:inline"
      title="不同服务商可选模型不同；OpenAI（GPT）在爱易威与聚合 API 下均可选"
    >
      {PROVIDER_LABELS[provider]}
    </span>
  );
}

function chipClass(selected: boolean): string {
  return selected
    ? 'bg-pink-600/20 text-pink-300 border border-pink-500/40'
    : 'bg-soul-800/50 text-soul-400 border border-transparent hover:border-soul-600/30';
}

function toggleChipClass(selected: boolean, disabled?: boolean): string {
  const base = selected
    ? 'bg-soul-600/30 text-soul-200'
    : 'text-soul-500 hover:text-soul-300 hover:bg-soul-800/50';
  return `${base} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`.trim();
}

interface ModelStrategySettingsProps {
  provider: AIProvider;
  modelMode: ModelRoutingMode;
  manualChatModel: string;
  manualAnalysisModel: string;
  onChange: (patch: Partial<UserSettings>) => void;
}

export default function ModelStrategySettings({
  provider,
  modelMode,
  manualChatModel,
  manualAnalysisModel,
  onChange,
}: ModelStrategySettingsProps) {
  const isAuto = modelMode === 'auto';
  const defaults = getDefaultModelsForProvider(provider);

  const setMode = (mode: ModelRoutingMode) => {
    onChange(buildModelModePatch(mode, { provider, manualChatModel, manualAnalysisModel }));
  };

  const patchManual = (patch: Partial<UserSettings>) => {
    onChange(applyManualModelPatch(patch));
  };

  return (
    <div className="space-y-3">
      <ModelModeToggle
        modelMode={modelMode}
        onModeChange={setMode}
        size="default"
      />

      {isAuto ? (
        <div className="p-3 bg-soul-950/40 border border-soul-700/30 rounded-lg space-y-2">
          <p className="text-xs text-soul-300 font-medium">智能模型切换</p>
          <p className="text-xs text-soul-400 leading-relaxed">
            <span className="text-soul-500">话术回答</span>使用{' '}
            <span className="text-soul-200">{getModelLabelById(defaults.chat, provider)}</span>
            ，点击「AI 分析」时<span className="text-soul-500">深度心理分析</span>自动切换至{' '}
            <span className="text-soul-200">{getModelLabelById(defaults.analysis, provider)}</span>
            。
          </p>
          <div className="space-y-1 pt-1 border-t border-soul-700/30">
            <code className="block text-[11px] text-soul-400 font-mono break-all">
              话术回答：{resolveModelForTask('chat', provider)}
            </code>
            <code className="block text-[11px] text-soul-400 font-mono break-all">
              深度心理分析：{resolveModelForTask('deepAnalysis', provider)}
            </code>
          </div>
        </div>
      ) : (
        <ManualModelPickers
          provider={provider}
          manualChatModel={manualChatModel}
          manualAnalysisModel={manualAnalysisModel}
          onChange={patchManual}
          size="default"
        />
      )}

      <p className="text-[11px] text-soul-500">
        当前策略：
        {getModelRoutingSummary(provider, {
          modelMode,
          model: isAuto ? AUTO_MODEL_ROUTING : 'manual',
          manualChatModel,
          manualAnalysisModel,
        })}
      </p>
    </div>
  );
}

interface ModelModeToggleProps {
  modelMode: ModelRoutingMode;
  onModeChange: (mode: ModelRoutingMode) => void;
  disabled?: boolean;
  size?: 'compact' | 'default';
}

export function ModelModeToggle({
  modelMode,
  onModeChange,
  disabled = false,
  size = 'default',
}: ModelModeToggleProps) {
  const isAuto = modelMode === 'auto';
  const isCompact = size === 'compact';

  if (isCompact) {
    return (
      <div
        className="inline-flex rounded-lg border border-soul-700/40 overflow-hidden shrink-0"
        role="group"
        aria-label="模型切换模式"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('auto')}
          className={`px-2.5 py-2 sm:px-2 sm:py-1 text-[11px] font-medium transition-colors min-h-[36px] sm:min-h-0 flex items-center ${toggleChipClass(isAuto, disabled)}`}
          title="话术用豆包，深度心理分析用 MAI-DS-R1"
        >
          智能
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('manual')}
          className={`px-2.5 py-2 sm:px-2 sm:py-1 text-[11px] font-medium transition-colors border-l border-soul-700/40 min-h-[36px] sm:min-h-0 flex items-center ${toggleChipClass(!isAuto, disabled)}`}
          title="手动指定各场景模型"
        >
          手动
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onModeChange('auto')}
        className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${chipClass(isAuto)}`}
      >
        智能切换
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onModeChange('manual')}
        className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${chipClass(!isAuto)}`}
      >
        手动切换
      </button>
    </div>
  );
}

interface ManualModelPickersProps {
  provider: AIProvider;
  manualChatModel: string;
  manualAnalysisModel: string;
  onChange: (patch: Partial<UserSettings>) => void;
  disabled?: boolean;
  size?: 'compact' | 'default';
}

function ManualModelPickers({
  provider,
  manualChatModel,
  manualAnalysisModel,
  onChange,
  disabled = false,
  size = 'default',
}: ManualModelPickersProps) {
  const chatOptions = getChatModelOptions(provider);
  const analysisOptions = getAnalysisModelOptions(provider);
  const isCompact = size === 'compact';
  const singleModel = chatOptions.length <= 1 && analysisOptions.length <= 1;

  const selectClass = isCompact
    ? 'input-field text-[11px] py-1 pl-2 pr-7 max-w-[148px] lg:max-w-[200px] appearance-none cursor-pointer'
    : 'input-field text-sm w-full pl-3 pr-9 appearance-none cursor-pointer';

  if (singleModel) {
    const only = chatOptions[0] ?? analysisOptions[0];
    const hint = (
      <div className={isCompact ? 'text-[11px] text-soul-400 truncate max-w-[200px]' : 'space-y-2'}>
        {!isCompact && (
          <p className="text-xs text-soul-400">
            当前服务商仅支持一个模型，无需手动切换。
          </p>
        )}
        <p className={`${isCompact ? '' : 'text-sm'} text-soul-200 font-medium`}>
          {only?.label ?? manualChatModel}
          {!isCompact && only?.value && (
            <span className="text-soul-500 font-normal text-xs ml-2">({only.value})</span>
          )}
        </p>
        {!isCompact && (
          <button
            type="button"
            onClick={() =>
              onChange(
                buildModelModePatch('auto', { provider, manualChatModel, manualAnalysisModel })
              )
            }
            className="text-xs text-pink-300 hover:text-pink-200"
          >
            切回智能切换（推荐）
          </button>
        )}
      </div>
    );
    return isCompact ? hint : <div className="p-3 bg-soul-950/40 border border-soul-700/30 rounded-lg">{hint}</div>;
  }

  const renderSelect = (
    value: string,
    onValueChange: (v: string) => void,
    ariaLabel: string,
    selectOptions: typeof chatOptions
  ) => (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={ariaLabel}
      >
        {selectOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {formatModelSelectLabel(opt, isCompact)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-soul-500" />
    </div>
  );

  if (isCompact) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <ProviderBadge provider={provider} />
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] text-soul-500 shrink-0 whitespace-nowrap">话术回答</span>
          {renderSelect(manualChatModel, (v) => onChange({ manualChatModel: v }), '话术回答模型', chatOptions)}
        </div>
        <span className="text-soul-600 text-[10px] shrink-0">/</span>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] text-soul-500 shrink-0 whitespace-nowrap" title="左侧心理分析用此模型，与话术模型独立">
          心理分析
        </span>
          {renderSelect(
            manualAnalysisModel,
            (v) => onChange({ manualAnalysisModel: v }),
            '深度心理分析模型',
            analysisOptions
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-soul-950/40 border border-soul-700/30 rounded-lg">
      <p className="text-xs text-soul-400">
        手动指定各场景使用的模型，不会随「AI 分析」自动切换。
      </p>
      <p className="text-[11px] text-soul-500">
        OpenAI（GPT-5.4 Mini / GPT-4o 等）在下拉列表顶部；当前服务商：{PROVIDER_LABELS[provider]}
      </p>
      <div>
        <label className="text-xs text-soul-400 mb-1.5 block">话术回答</label>
        {renderSelect(manualChatModel, (v) => onChange({ manualChatModel: v }), '话术回答模型', chatOptions)}
      </div>
      <div>
        <label className="text-xs text-soul-400 mb-1.5 block">
          深度心理分析
          <span className="text-soul-500 font-normal ml-1">（mai-ds-r1 / deepseek-v4-flash）</span>
        </label>
        {renderSelect(
          manualAnalysisModel,
          (v) => onChange({ manualAnalysisModel: v }),
          '深度心理分析模型',
          analysisOptions
        )}
      </div>
      <div className="space-y-1 pt-1 border-t border-soul-700/30">
        <code className="block text-[11px] text-soul-400 font-mono break-all">
          话术回答：{manualChatModel}
        </code>
        <code className="block text-[11px] text-soul-400 font-mono break-all">
          深度心理分析：{manualAnalysisModel}
        </code>
      </div>
    </div>
  );
}

/** 顶栏：智能 / 手动切换 + 模型展示 */
export function ModelRoutingControl({
  settings,
  onChange,
  disabled = false,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
  disabled?: boolean;
}) {
  if (!supportsAutoModelRouting(settings.provider)) return null;

  const isAuto = isAutoModelMode(settings);
  const chatLabel = getModelLabelById(
    isAuto ? resolveModelForTask('chat', settings.provider) : settings.manualChatModel,
    settings.provider
  );
  const analysisLabel = getModelLabelById(
    isAuto
      ? resolveModelForTask('deepAnalysis', settings.provider)
      : settings.manualAnalysisModel,
    settings.provider
  );

  const setMode = (mode: ModelRoutingMode) => {
    onChange(
      buildModelModePatch(mode, {
        provider: settings.provider,
        manualChatModel: settings.manualChatModel,
        manualAnalysisModel: settings.manualAnalysisModel,
      })
    );
  };

  return (
    <div
      className="hidden md:flex items-center gap-2 min-w-0 max-w-[min(100%,680px)]"
      title={getModelRoutingSummary(settings.provider, settings)}
    >
      <ModelModeToggle
        modelMode={settings.modelMode}
        onModeChange={setMode}
        disabled={disabled}
        size="compact"
      />

      {isAuto ? (
        <span className="text-xs text-soul-400 truncate min-w-0">
          <span className="text-soul-500">话术回答</span>{' '}
          {chatLabel}
          <span className="text-soul-600 mx-1">/</span>
          <span className="text-soul-500">深度心理分析</span>{' '}
          {analysisLabel}
        </span>
      ) : (
        <ManualModelPickers
          provider={settings.provider}
          manualChatModel={settings.manualChatModel}
          manualAnalysisModel={settings.manualAnalysisModel}
          onChange={(patch) => onChange(applyManualModelPatch(patch))}
          disabled={disabled}
          size="compact"
        />
      )}
    </div>
  );
}

function supportsAutoModelRouting(provider: AIProvider): boolean {
  return provider === 'aiyiwei' || provider === 'juhe' || provider === 'openrouter';
}

export { isAutoModelMode, resolveModelForSettings };
