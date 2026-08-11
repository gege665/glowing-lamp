import { useEffect, useState } from 'react';
import { Key, Shield, Eye, EyeOff, Check, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { normalizeApiKey, detectProviderFromKey } from '../utils/apiKey';
import type { AIProvider } from '../types';
import {
  AUTO_MODEL_ROUTING,
  getDefaultModelsForProvider,
  supportsAutoModelRouting,
} from '../constants/modelRouting';

const PROVIDER_OPTIONS: { id: AIProvider; label: string }[] = [
  { id: 'aiyiwei', label: '爱易威' },
  { id: 'juhe', label: '聚合' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'groq', label: 'Groq' },
  { id: 'siliconflow', label: '硅基流动' },
];

function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 10) return k ? '••••••••' : '';
  return `${k.slice(0, 6)}••••${k.slice(-4)}`;
}

/**
 * 个人自用 · API Key 本地管理
 * 仅写入浏览器 localStorage，不写入 Vercel 环境变量。
 */
export default function LocalApiKeyCard() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const showToast = useAppStore((s) => s.showToast);

  const [provider, setProvider] = useState<AIProvider>(settings.provider);
  const [draft, setDraft] = useState(settings.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setProvider(settings.provider);
    setDraft(settings.apiKey || '');
  }, [settings.provider, settings.apiKey]);

  const applyKeyChange = (raw: string) => {
    const trimmed = normalizeApiKey(raw);
    setDraft(trimmed);
    const detected = detectProviderFromKey(trimmed, provider);
    if (detected) setProvider(detected);
  };

  const handleSave = () => {
    const apiKey = normalizeApiKey(draft);
    if (!apiKey) {
      showToast('请先输入 API Key');
      return;
    }
    const defaults = getDefaultModelsForProvider(provider);
    updateSettings({
      apiKey,
      provider,
      modelMode: 'auto',
      model: supportsAutoModelRouting(provider) ? AUTO_MODEL_ROUTING : settings.model,
      manualChatModel: defaults.chat,
      manualAnalysisModel: defaults.analysis,
    });
    setSavedFlash(true);
    showToast('API Key 已保存到本机浏览器');
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleClear = () => {
    setDraft('');
    updateSettings({ apiKey: '' });
    showToast('已清除本机 API Key');
    setSavedFlash(false);
  };

  const hasSaved = Boolean(settings.apiKey?.trim());

  return (
    <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-950/25 to-soul-950/40 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <Key className="w-4 h-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-soul-100">API Key · 仅存本机</h3>
          <p className="text-[11px] text-soul-400 mt-0.5 leading-snug">
            个人自用：密钥写入浏览器 localStorage，不配置到 Vercel。生成时仅转发至你选的 AI 服务商，服务端不落盘。
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {PROVIDER_OPTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id)}
            className={`px-2.5 min-h-[36px] rounded-lg text-[11px] font-medium border transition-colors touch-manipulation ${
              provider === p.id
                ? 'border-amber-400/50 bg-amber-600/25 text-amber-100'
                : 'border-soul-700/40 bg-soul-900/50 text-soul-400 hover:text-soul-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-stretch">
        <input
          type={showKey ? 'text' : 'password'}
          value={draft}
          onChange={(e) => applyKeyChange(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            applyKeyChange(e.clipboardData.getData('text'));
          }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          name="lingyan-local-api-key"
          placeholder={
            provider === 'openrouter'
              ? 'sk-or-v1-...'
              : provider === 'aiyiwei'
                ? 'sk-...（爱易威）'
                : '粘贴你的 API Key'
          }
          className="input-field flex-1 text-sm min-h-[44px]"
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          className="btn-secondary shrink-0 min-h-[44px] min-w-[44px] px-2"
          title={showKey ? '隐藏' : '显示'}
        >
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary text-xs min-h-[40px] px-4 flex items-center gap-1.5"
        >
          {savedFlash ? <Check className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
          {savedFlash ? '已保存' : '保存到本机'}
        </button>
        {hasSaved && (
          <button
            type="button"
            onClick={handleClear}
            className="btn-ghost text-xs text-soul-400 min-h-[40px] px-2 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清除
          </button>
        )}
        {hasSaved && (
          <span className="text-[10px] text-emerald-300/90 ml-auto truncate max-w-[50%]">
            已存：{maskKey(settings.apiKey)}
          </span>
        )}
      </div>

      <div className="flex gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-emerald-200/80 leading-relaxed">
          换设备或清浏览器数据后需重新填写。密钥不会出现在 Vercel 后台环境变量中。
        </p>
      </div>
    </section>
  );
}
