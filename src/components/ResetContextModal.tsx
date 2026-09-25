import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

const SKIP_RESET_CONFIRM_KEY = 'soul_chat_skip_reset_confirm';

export function shouldSkipResetConfirm(): boolean {
  try {
    return localStorage.getItem(SKIP_RESET_CONFIRM_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSkipResetConfirm(skip: boolean): void {
  try {
    if (skip) {
      localStorage.setItem(SKIP_RESET_CONFIRM_KEY, '1');
    } else {
      localStorage.removeItem(SKIP_RESET_CONFIRM_KEY);
    }
  } catch {
    /* ignore */
  }
}

interface ResetContextModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ResetContextModal({ open, onClose, onConfirm }: ResetContextModalProps) {
  const [dontRemind, setDontRemind] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    if (dontRemind) setSkipResetConfirm(true);
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 safe-top safe-bottom">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="reset-context-title"
        className="relative w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-gray-800"
      >
        <div className="px-5 pt-6 pb-4 text-center">
          <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-orange-50 flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-orange-500" />
          </div>
          <p id="reset-context-title" className="text-[15px] leading-relaxed text-gray-700 px-1">
            点此重置，我将暂时忘记当前对话记录，但会保留聊天记忆中的长期细节。
          </p>
        </div>

        <div className="flex border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 text-sm font-medium text-orange-500 border-r border-gray-100 hover:bg-orange-50/50 transition-colors min-h-[48px]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition-colors min-h-[48px]"
          >
            确定
          </button>
        </div>

        <label className="flex items-center justify-center gap-2 py-3 border-t border-gray-100 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontRemind}
            onChange={(e) => setDontRemind(e.target.checked)}
            className="w-4 h-4 rounded-full accent-orange-500 border-gray-300"
          />
          <span className="text-xs text-gray-400">不再提醒</span>
        </label>
      </div>
    </div>
  );
}
