import { ClipboardPaste, ImagePlus } from 'lucide-react';

interface QuickStartGuideProps {
  hasMessages?: boolean;
  isAnalyzing?: boolean;
  onPaste?: () => void;
  onUpload?: () => void;
  className?: string;
}

const STEPS = [
  { n: 1, title: '粘贴对方消息', desc: '输入框粘贴、批量导入或截图 OCR' },
  { n: 2, title: '智能生成话术', desc: '自动分析心理 + 生成 5 条风格回复' },
  { n: 3, title: '复制发送', desc: '选一条复制，或一键加入对话模拟' },
];

/** 仅用于左侧对话区空状态，避免三列重复引导 */
export default function QuickStartGuide({
  hasMessages = false,
  isAnalyzing = false,
  onPaste,
  onUpload,
  className = '',
}: QuickStartGuideProps) {
  const activeStep = isAnalyzing ? 2 : hasMessages ? 2 : 1;

  return (
    <div className={`w-full max-w-sm space-y-4 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 px-1">
        {STEPS.map((step) => {
          const done = step.n < activeStep;
          const current = step.n === activeStep;
          return (
            <div key={step.n} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  done
                    ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                    : current
                      ? 'bg-pink-500/25 text-pink-200 border border-pink-500/50'
                      : 'bg-soul-800/60 text-soul-500 border border-soul-700/40'
                }`}
              >
                {done ? '✓' : step.n}
              </div>
              <span
                className={`text-[10px] text-center leading-tight ${
                  current ? 'text-soul-200 font-medium' : 'text-soul-500'
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {!hasMessages && (
        <div className="flex flex-wrap gap-2 justify-center">
          {onPaste && (
            <button type="button" onClick={onPaste} className="btn-secondary text-xs flex items-center gap-1.5 min-h-[44px] px-4">
              <ClipboardPaste className="w-3.5 h-3.5" />
              粘贴消息
            </button>
          )}
          {onUpload && (
            <button type="button" onClick={onUpload} className="btn-secondary text-xs flex items-center gap-1.5 min-h-[44px] px-4">
              <ImagePlus className="w-3.5 h-3.5" />
              上传截图
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-soul-500 text-center leading-relaxed">
        {hasMessages ? STEPS[1].desc : STEPS[0].desc}
      </p>
    </div>
  );
}
