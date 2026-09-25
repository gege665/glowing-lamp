import { useState, useEffect, useRef } from 'react';
import { X, Key, Shield, ExternalLink } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { normalizeUserSettings } from '../services/storageService';
import {
  RELATIONSHIP_STAGES,
  RELATIONSHIP_FLOW_HINT,
  STRATEGY_FOCUS_OPTIONS,
  type AIProvider,
} from '../types';
import {
  AUTO_MODEL_ROUTING,
  getDefaultModelsForProvider,
  resolveModelForSettings,
  supportsAutoModelRouting,
} from '../constants/modelRouting';
import { JUHE_DEFAULT_CHAT_MODEL } from '../constants/juheApiConfig';
import ModelStrategySettings from './ModelStrategySettings';
import ChatStyleSelector from './ChatStyleSelector';
import ProfileCardsSection from './ProfileCardsSection';
import SceneStyleSelector from './SceneStyleSelector';
import { normalizeApiKey } from '../utils/apiKey';
import { jsonApiHeaders } from '../utils/apiHeaders';
import { REPLY_STYLE_MODE_HINT } from '../constants/replyStylePrompts';

function toggleListItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function chipClass(selected: boolean): string {
  return selected
    ? 'bg-pink-600/20 text-pink-300 border border-pink-500/40'
    : 'bg-soul-800/50 text-soul-400 border border-transparent hover:border-soul-600/30';
}

const PROVIDERS: { id: AIProvider; name: string; desc: string; url: string; models: string[] }[] = [
  {
    id: 'aiyiwei',
    name: '爱易威 API（推荐）',
    desc: '豆包 Mini + GPT-4o/5.4 + MAI-DS-R1 · OpenAI 兼容',
    url: 'https://aiyiwei.vip',
    models: [],
  },
  {
    id: 'juhe',
    name: '聚合 API（OpenAI 兼容）',
    desc: 'GPT-5.4 Mini + DeepSeek · api.juheapi.com',
    url: 'https://juheapi.com',
    models: [],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: '多模型聚合，失败自动备选',
    url: 'https://openrouter.ai/keys',
    models: [],
  },
  {
    id: 'groq',
    name: 'Groq',
    desc: '免费、极速，注册即送额度',
    url: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    desc: '国内可用，新用户免费额度',
    url: 'https://cloud.siliconflow.cn/account/ak',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V2.5'],
  },
];

export default function SettingsModal() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const showToast = useAppStore((s) => s.showToast);
  const serverKeyConfigured = useAppStore((s) => s.serverKeyConfigured);

  const [local, setLocal] = useState(settings);
  const usesServerKey =
    serverKeyConfigured &&
    (local.provider === 'aiyiwei' || local.provider === 'juhe' || local.provider === 'openrouter');
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const verifyAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!settingsOpen) {
      verifyAbortRef.current?.abort();
      verifyAbortRef.current = null;
      return;
    }
    setLocal({
      ...settings,
      model: supportsAutoModelRouting(settings.provider) ? AUTO_MODEL_ROUTING : settings.model,
    });
    setVerifyResult(null);
  }, [settingsOpen]);

  const handleApiKeyChange = (value: string) => {
    const trimmed = normalizeApiKey(value);
    let provider = local.provider;
    if (trimmed.startsWith('sk-or-')) provider = 'openrouter';
    else if (trimmed.startsWith('gsk_')) provider = 'groq';
    else if (trimmed.startsWith('sk-')) {
      provider =
        local.provider === 'siliconflow'
          ? 'siliconflow'
          : local.provider === 'juhe'
            ? 'juhe'
            : 'aiyiwei';
    }
    setLocal({ ...local, apiKey: trimmed, provider });
    setVerifyResult(null);
  };

  const handleVerifyKey = async () => {
    const normalized = normalizeUserSettings(local);
    const apiKey = normalized.apiKey;
    const verifyWithServerKey = !apiKey && serverKeyConfigured;
    if (!apiKey && !serverKeyConfigured) {
      setVerifyResult({ ok: false, msg: '请先输入 API Key' });
      return;
    }
    const verifyProvider: AIProvider = normalized.provider;
    const verifyModel = supportsAutoModelRouting(verifyProvider)
      ? resolveModelForSettings('chat', normalized)
      : normalized.model;

    if (normalized.provider !== local.provider || normalized.manualChatModel !== local.manualChatModel) {
      setLocal(normalized);
    }

    setVerifying(true);
    setVerifyResult(null);
    verifyAbortRef.current?.abort();
    const ac = new AbortController();
    verifyAbortRef.current = ac;
    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: jsonApiHeaders(),
        signal: ac.signal,
        body: JSON.stringify({
          provider: verifyProvider,
          apiKey,
          model: verifyModel || undefined,
        }),
      });

      const raw = await res.text();
      let data: {
        ok?: boolean;
        error?: string;
        provider?: string;
        model?: string;
        preview?: string;
        notice?: string;
      } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setVerifyResult({
          ok: false,
          msg: res.ok
            ? '验证接口返回异常，请稍后重试'
            : `验证请求失败（HTTP ${res.status}）`,
        });
        return;
      }

      if (data.ok) {
        const notice = data.notice ? `，${data.notice}` : '';
        const label = data.preview ? `，Key：${data.preview}` : '';
        const serverHint = verifyWithServerKey ? '（服务端 Key）' : '';
        setVerifyResult({
          ok: true,
          msg: `验证成功${serverHint}（${data.provider}${label}）${notice}`,
        });
        const next = { ...local };
        if (data.provider && data.provider !== local.provider) next.provider = data.provider as AIProvider;
        if (data.model && data.model !== local.model) next.model = data.model;
        if (next.provider !== local.provider || next.model !== local.model) {
          setLocal(next);
        }
      } else {
        setVerifyResult({ ok: false, msg: data.error || `验证失败（HTTP ${res.status}）` });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg =
        err instanceof Error && err.message && err.message !== 'Failed to fetch'
          ? err.message
          : import.meta.env.PROD
            ? '无法连接验证接口，请检查网络或稍后重试'
            : '无法连接 API（请确认已执行 npm run dev，且后端在 3001 端口运行）';
      setVerifyResult({ ok: false, msg });
    } finally {
      if (verifyAbortRef.current === ac) {
        setVerifying(false);
      }
    }
  };

  const handleSave = () => {
    const normalized = normalizeUserSettings({
      ...local,
      apiKey: normalizeApiKey(local.apiKey),
    });
    updateSettings({
      ...normalized,
      model: supportsAutoModelRouting(normalized.provider)
        ? AUTO_MODEL_ROUTING
        : normalized.model,
    });
    setSettingsOpen(false);
    showToast('设置已保存');
  };

  if (!settingsOpen) return null;

  const currentProvider = PROVIDERS.find((p) => p.id === local.provider) || PROVIDERS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 safe-top safe-bottom">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setSettingsOpen(false)}
      />
      <div className="relative w-full sm:max-w-lg panel-card p-0 overflow-hidden animate-slide-up max-h-[100dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl">
        <div className="px-5 py-4 border-b border-soul-700/30 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-soul-200">设置</h2>
          <button onClick={() => setSettingsOpen(false)} className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-touch p-5 space-y-5 min-h-0">
          {/* Privacy notice */}
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex gap-3">
            <Shield className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div className="text-xs text-green-200/80 leading-relaxed">
              <p className="font-medium text-green-300 mb-1">隐私保护</p>
              {serverKeyConfigured
                ? '对话历史仅存于本机。生产环境已由服务端保管 API Key（AIYIWEI / JUHE / OPENROUTER），浏览器无需保存密钥。'
                : '对话历史仅保存在本地浏览器，API Key 仅存于本机。分析时仅将对话内容通过 HTTPS 加密发送至您选择的 AI 服务商。'}
            </div>
          </div>

          {/* 界面模式 */}
          <div>
            <label className="text-sm text-soul-300 font-medium mb-2 block">界面模式</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLocal({ ...local, uiMode: 'simple' })}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm min-h-[44px] ${chipClass(local.uiMode !== 'advanced')}`}
              >
                简单
              </button>
              <button
                type="button"
                onClick={() => setLocal({ ...local, uiMode: 'advanced' })}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm min-h-[44px] ${chipClass(local.uiMode === 'advanced')}`}
              >
                高级
              </button>
            </div>
            <p className="text-[11px] text-soul-500 mt-1.5 leading-relaxed">
              简单模式隐藏顶栏模型策略与聊天风格；默认自动选模，适合快速生成话术。
            </p>
          </div>

          {/* Provider */}
          <div>
            <label className="text-sm text-soul-300 font-medium mb-2 block">AI 服务商</label>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    const defaults = getDefaultModelsForProvider(p.id);
                    setLocal({
                      ...local,
                      provider: p.id,
                      model: supportsAutoModelRouting(p.id) ? AUTO_MODEL_ROUTING : '',
                      modelMode: 'auto',
                      manualChatModel: defaults.chat,
                      manualAnalysisModel: defaults.analysis,
                    });
                  }}
                  className={`w-full p-3 sm:p-3.5 rounded-xl border text-left transition-all min-h-[56px] touch-manipulation ${
                    local.provider === p.id
                      ? 'border-soul-500 bg-soul-800/50'
                      : 'border-soul-700/30 bg-soul-950/30 hover:border-soul-600/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-soul-200">{p.name}</span>
                    {local.provider === p.id && (
                      <span className="tag bg-soul-600 text-white text-[10px]">当前</span>
                    )}
                  </div>
                  <p className="text-xs text-soul-400 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="text-sm text-soul-300 font-medium mb-2 flex items-center gap-2">
              <Key className="w-4 h-4" /> API Key
              {serverKeyConfigured && (
                <span className="tag bg-green-500/20 text-green-300 text-[10px]">服务端已配置</span>
              )}
            </label>
            {serverKeyConfigured && (
              <p className="text-xs text-soul-500 mb-2">
                已检测到服务端 API Key（AIYIWEI / JUHE / OPENROUTER），可直接分析。下方可留空使用服务端
                Key；若使用 Groq / SiliconFlow 请填写个人 Key。
              </p>
            )}
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={local.apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  handleApiKeyChange(e.clipboardData.getData('text'));
                }}
                spellCheck={false}
                autoComplete="off"
                placeholder={
                  usesServerKey
                    ? '可选，留空使用服务端 Key'
                    : local.provider === 'aiyiwei'
                      ? 'sk-...（爱易威 API Key）'
                    : local.provider === 'juhe'
                      ? '你的聚合 API Key'
                      : local.provider === 'openrouter'
                        ? 'sk-or-v1-...'
                        : 'API Key'
                }
                className="input-field flex-1 text-sm"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="btn-secondary shrink-0"
              >
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleVerifyKey}
                  disabled={verifying || (!local.apiKey.trim() && !serverKeyConfigured)}
                  className="btn-secondary text-xs shrink-0"
                >
                  {verifying ? '验证中...' : '验证 Key'}
                </button>
              </div>
              {verifyResult && (
                <p
                  className={`text-xs leading-relaxed ${
                    verifyResult.ok ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {verifyResult.msg}
                </p>
              )}
            </div>
            <p className="text-xs text-soul-500 mt-1.5">
              {local.provider === 'openrouter' ? (
                <>
                  OpenRouter Key 以 <code className="text-soul-400">sk-or-</code> 开头，粘贴后会自动识别服务商
                </>
              ) : local.provider === 'aiyiwei' ? (
                <>爱易威 API：<code className="text-soul-400">https://aiyiwei.vip/v1</code> · 智能切换：豆包 Mini / DeepSeek V4 Flash</>
              ) : local.provider === 'juhe' ? (
                <>
                  聚合 API · OpenAI 兼容：
                  <code className="text-soul-400">https://api.juheapi.com/v1/chat/completions</code>
                  · 话术默认 <code className="text-soul-400">{JUHE_DEFAULT_CHAT_MODEL}</code>
                </>
              ) : (
                <>请填写对应服务商的 API Key</>
              )}
            </p>
            <a
              href={currentProvider.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-soul-400 hover:text-soul-300 mt-2"
            >
              免费获取 {currentProvider.name} API Key
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Model */}
          <div>
            <label className="text-sm text-soul-300 font-medium mb-2 block">模型策略</label>
            {local.uiMode !== 'advanced' ? (
              <p className="text-xs text-soul-400 leading-relaxed p-3 rounded-xl bg-soul-950/40 border border-soul-700/30">
                当前为简单模式，使用智能自动选模。切换到「高级」可手动指定话术/分析模型。
              </p>
            ) : supportsAutoModelRouting(local.provider) ? (
              <>
                <ModelStrategySettings
                  provider={local.provider}
                  modelMode={local.modelMode}
                  manualChatModel={local.manualChatModel}
                  manualAnalysisModel={local.manualAnalysisModel}
                  onChange={(patch) => setLocal({ ...local, ...patch })}
                />
              </>
            ) : (
              <select
                value={local.model}
                onChange={(e) => setLocal({ ...local, model: e.target.value })}
                className="input-field text-sm"
              >
                <option value="">默认模型</option>
                {currentProvider.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nicknames */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-soul-300 font-medium mb-2 block">我的昵称</label>
              <input
                value={local.myNickname}
                onChange={(e) => setLocal({ ...local, myNickname: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-soul-300 font-medium mb-2 block">对方昵称</label>
              <input
                value={local.otherNickname}
                onChange={(e) => setLocal({ ...local, otherNickname: e.target.value })}
                className="input-field text-sm"
              />
            </div>
          </div>

          <SceneStyleSelector
            chatScene={local.chatScene}
            tonePreference={local.tonePreference}
            toneModifiers={local.toneModifiers ?? []}
            onSceneChange={(sceneId) => setLocal({ ...local, chatScene: sceneId })}
            onToneChange={(prompt) => setLocal({ ...local, tonePreference: prompt })}
            onToneModifiersChange={(toneModifiers) => setLocal({ ...local, toneModifiers })}
          />

          <ProfileCardsSection
            myProfile={local.myProfile}
            otherProfile={local.otherProfile}
            partnerMemory={local.partnerMemory}
            onChange={(patch) =>
              setLocal({
                ...local,
                ...patch,
                myProfile: patch.myProfile ? { ...local.myProfile, ...patch.myProfile } : local.myProfile,
                otherProfile: patch.otherProfile
                  ? { ...local.otherProfile, ...patch.otherProfile }
                  : local.otherProfile,
                partnerMemory: patch.partnerMemory
                  ? { ...local.partnerMemory, ...patch.partnerMemory }
                  : local.partnerMemory,
              })
            }
          />

          <ChatStyleSelector
            value={local.chatStyle}
            onChange={(chatStyle) => setLocal({ ...local, chatStyle })}
            showDescription
          />

          {/* Relationship stages — multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-soul-300 font-medium">关系阶段（可多选）</label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-soul-400 hover:text-pink-300"
                  onClick={() =>
                    setLocal({ ...local, relationshipStages: [...RELATIONSHIP_STAGES] })
                  }
                >
                  全选
                </button>
                <button
                  type="button"
                  className="text-soul-400 hover:text-pink-300"
                  onClick={() => setLocal({ ...local, relationshipStages: ['暧昧阶段'] })}
                >
                  仅暧昧
                </button>
              </div>
            </div>
            <p className="text-xs text-soul-500 mb-2">{RELATIONSHIP_FLOW_HINT}</p>
            <p className="text-xs text-soul-500 mb-2 leading-relaxed">{REPLY_STYLE_MODE_HINT}</p>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIP_STAGES.map((stage) => {
                const selected = local.relationshipStages.includes(stage);
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => {
                      const next = toggleListItem(local.relationshipStages, stage);
                      if (next.length === 0) return;
                      setLocal({ ...local, relationshipStages: next });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${chipClass(selected)}`}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strategy focus — multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-soul-300 font-medium">策略与话术侧重（可多选）</label>
              <button
                type="button"
                className="text-xs text-soul-400 hover:text-pink-300"
                onClick={() =>
                  setLocal({ ...local, strategyFocus: [...STRATEGY_FOCUS_OPTIONS] })
                }
              >
                全选
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {STRATEGY_FOCUS_OPTIONS.map((item) => {
                const selected = local.strategyFocus.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const next = toggleListItem(local.strategyFocus, item);
                      if (next.length === 0) return;
                      setLocal({ ...local, strategyFocus: next });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${chipClass(selected)}`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-soul-500 mt-2">
              已选 {local.strategyFocus.length} 项策略，分析与人话术中都会体现
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-soul-700/30 flex gap-3 shrink-0">
          <button onClick={() => setSettingsOpen(false)} className="btn-secondary flex-1">
            取消
          </button>
          <button onClick={handleSave} className="btn-primary flex-1">
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
