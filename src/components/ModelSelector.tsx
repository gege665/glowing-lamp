/** 模型列表见 src/constants/openrouterFreeModels.ts → MODEL_OPTIONS */
import { MODEL_OPTIONS } from '../constants/openrouterFreeModels';

export interface ModelSelectorProps {
  selectedModel: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
  /** 紧凑样式，用于 Header */
  compact?: boolean;
}

export default function ModelSelector({
  selectedModel,
  onChange,
  disabled = false,
  className = '',
  compact = false,
}: ModelSelectorProps) {
  const baseClass = compact
    ? 'input-field text-xs py-1.5 max-w-[140px] sm:max-w-[220px]'
    : 'input-field text-sm w-full';

  return (
    <select
      value={selectedModel || MODEL_OPTIONS[0].value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${baseClass} ${className}`.trim()}
      title="选择 OpenRouter 分析模型"
    >
      {MODEL_OPTIONS.map((option, index) => (
        <option key={`${option.value}-${index}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
