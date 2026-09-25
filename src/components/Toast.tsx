import { CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export default function Toast() {
  const toast = useAppStore((s) => s.toast);

  if (!toast) return null;

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-soul-800/95 backdrop-blur-xl border border-soul-600/40 rounded-xl shadow-xl shadow-black/20">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-sm text-soul-200">{toast}</span>
      </div>
    </div>
  );
}
