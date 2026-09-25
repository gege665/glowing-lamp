import { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { Send, User, Heart, Copy, Sparkles, Trash2, ClipboardPaste, MessageCircle, ImagePlus, Zap, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  parseMessageWithPlatform,
  PLATFORM_QUICK_TAGS,
} from '../constants/socialPlatforms';
import ResetContextModal, { shouldSkipResetConfirm } from './ResetContextModal';
import SceneStyleSelector from './SceneStyleSelector';
import ChatMemoryPanel from './ChatMemoryPanel';
import QuickStartGuide from './QuickStartGuide';
import { track } from '../utils/analytics';

const IceBreakerModal = lazy(() => import('./IceBreakerModal'));

export default function ChatPanel() {
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const addMessage = useAppStore((s) => s.addMessage);
  const importMessages = useAppStore((s) => s.importMessages);
  const deleteMessage = useAppStore((s) => s.deleteMessage);
  const resetChatContext = useAppStore((s) => s.resetChatContext);
  const selectedMessageId = useAppStore((s) => s.selectedMessageId);
  const selectMessage = useAppStore((s) => s.selectMessage);
  const runAnalysis = useAppStore((s) => s.runAnalysis);
  const runGenerateReplies = useAppStore((s) => s.runGenerateReplies);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const showToast = useAppStore((s) => s.showToast);

  const [input, setInput] = useState('');
  const [role, setRole] = useState<'me' | 'other'>('other');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [iceBreakerOpen, setIceBreakerOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      ocrAbortRef.current?.abort();
    };
  }, []);

  const handleGenerate = () => {
    runGenerateReplies(input.trim() || undefined);
    if (input.trim()) setInput('');
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const appendPlatformTag = (tag: string) => {
    const base = input.trim();
    setInput(base ? `${base} ${tag}` : tag);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage(role, input);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast('已复制到剪贴板');
    } catch {
      showToast('复制失败，请手动选择文本复制');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (bulkMode) {
          setBulkText((prev) => (prev ? prev + '\n' + text : text));
        } else {
          setInput((prev) => (prev ? prev + '\n' + text : text));
        }
        showToast('已粘贴');
      }
    } catch {
      showToast('无法读取剪贴板');
    }
  };

  const parseBulkChat = (text: string): Array<{ role: 'me' | 'other'; content: string }> => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: Array<{ role: 'me' | 'other'; content: string }> = [];

    for (const line of lines) {
      const bracketMatch = line.match(/^\[(.+?)\][:：]\s*(.+)$/);
      if (bracketMatch) {
        const [, name, content] = bracketMatch;
        const isMe = name === settings.myNickname || name === '我';
        parsed.push({ role: isMe ? 'me' : 'other', content });
        continue;
      }
      const colonMatch = line.match(/^(.+?)[:：]\s*(.+)$/);
      if (colonMatch) {
        const [, name, content] = colonMatch;
        const isMe = name === settings.myNickname || name === '我';
        parsed.push({ role: isMe ? 'me' : 'other', content });
        continue;
      }
      parsed.push({ role: parsed.length % 2 === 0 ? 'other' : 'me', content: line });
    }
    return parsed;
  };

  const handleBulkImport = () => {
    const parsed = parseBulkChat(bulkText);
    if (parsed.length === 0) {
      showToast('请先粘贴聊天记录');
      return;
    }
    const count = importMessages(parsed);
    track('bulk_import', { count });
    setBulkText('');
    setBulkMode(false);
    showToast(`已导入 ${count} 条，点击下方按钮生成话术`);
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    setOcrLoading(true);
    ocrAbortRef.current?.abort();
    const ac = new AbortController();
    ocrAbortRef.current = ac;
    try {
      const { prepareImageForOcr, recognizeChatScreenshot } = await import('../services/ocrService');
      const base64 = await prepareImageForOcr(file);
      const lines = await recognizeChatScreenshot(base64, settings, ac.signal);
      if (ac.signal.aborted) return;
      if (lines.length === 0) {
        showToast('未识别到对话内容');
        return;
      }
      const count = importMessages(lines);
      track('ocr_import', { count });
      showToast(`截图识别 ${count} 条，点击下方按钮生成话术`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast(err instanceof Error ? err.message : '截图识别失败');
    } finally {
      if (ocrAbortRef.current === ac) {
        setOcrLoading(false);
      }
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const handleResetClick = () => {
    if (messages.length === 0 && !useAppStore.getState().analysis) {
      showToast('当前没有需要重置的对话');
      return;
    }
    if (shouldSkipResetConfirm()) {
      resetChatContext();
      showToast('已重置，可开始新话题分析');
      return;
    }
    setResetOpen(true);
  };

  const handleResetConfirm = () => {
    resetChatContext();
    showToast('已重置，可开始新话题分析');
  };

  return (
    <div className="panel-card h-full min-h-0 overflow-hidden max-md:grid max-md:grid-rows-[auto_minmax(4rem,1fr)_minmax(7rem,28vh)_auto] md:flex md:flex-col">
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-soul-700/30 flex flex-row items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MessageCircle className="w-5 h-5 text-soul-400 shrink-0" />
          <h2 className="font-semibold text-soul-200 text-sm sm:text-base truncate">对话模拟</h2>
          <span className="tag bg-soul-800 text-soul-300 shrink-0">{messages.length} 条</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setIceBreakerOpen(true)}
            className="btn-ghost text-xs p-2 min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center text-amber-400 shrink-0"
            title="一键破冰"
          >
            <Zap className="w-4 h-4" />
          </button>
          <label className="btn-ghost text-xs p-2 min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center text-soul-400 cursor-pointer shrink-0" title="上传聊天截图">
            {ocrLoading ? (
              <span className="w-4 h-4 border-2 border-soul-400/30 border-t-soul-400 rounded-full animate-spin inline-block" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleScreenshotUpload}
              disabled={ocrLoading}
            />
          </label>
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className={`btn-ghost text-xs px-2 min-h-[36px] sm:min-h-[44px] shrink-0 whitespace-nowrap ${bulkMode ? 'text-pink-400' : 'text-soul-400'}`}
            title="一键上传聊天记录"
          >
            {bulkMode ? '单条' : '批量导入'}
          </button>
          <button
            onClick={handleResetClick}
            className="btn-ghost text-xs p-2 min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center text-orange-400 hover:text-orange-300 shrink-0"
            title="重置聊天上下文"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-touch p-3 sm:p-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 sm:py-8 px-2">
            <QuickStartGuide
              hasMessages={false}
              isAnalyzing={isAnalyzing}
              onPaste={handlePaste}
              onUpload={() => fileInputRef.current?.click()}
            />
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.role === 'me';
            const isSelected = selectedMessageId === msg.id;
            const parsed = !isMe ? parseMessageWithPlatform(msg.content) : null;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up group`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] relative ${
                    isMe ? 'order-1' : 'order-2'
                  }`}
                >
                  <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'justify-end' : ''}`}>
                    {!isMe && <User className="w-3.5 h-3.5 text-pink-400" />}
                    <span className="text-xs text-soul-400">
                      {isMe ? settings.myNickname : settings.otherNickname}
                    </span>
                    {isMe && <Heart className="w-3.5 h-3.5 text-soul-400" />}
                    <span className="text-xs text-soul-500">{formatTime(msg.timestamp)}</span>
                    {parsed?.hadPlatformTag && (
                      <span className="tag text-[10px] bg-pink-500/15 text-pink-300 border border-pink-500/25">
                        {parsed.platform.label}
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => selectMessage(isSelected ? null : msg.id)}
                    className={`px-3.5 sm:px-4 py-2.5 rounded-2xl text-sm sm:text-sm leading-relaxed cursor-pointer transition-all ${
                      isMe
                        ? 'bg-gradient-to-br from-soul-600 to-soul-700 rounded-br-md text-white'
                        : 'bg-soul-800/80 border border-soul-700/40 rounded-bl-md text-gray-100'
                    } ${isSelected ? 'ring-2 ring-pink-500/60 shadow-lg shadow-pink-500/10' : 'hover:opacity-90'}`}
                  >
                    {parsed?.hadPlatformTag ? parsed.content : msg.content}
                  </div>

                  {!isMe && (
                    <div className="flex flex-wrap gap-1 mt-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopy(msg.content)}
                        className="btn-ghost text-xs flex items-center gap-1 py-2 min-h-[40px]"
                      >
                        <Copy className="w-3 h-3" /> 复制
                      </button>
                      <button
                        onClick={() => runAnalysis(msg.id)}
                        className="btn-ghost text-xs flex items-center gap-1 py-2 min-h-[40px] text-pink-400"
                      >
                        <Sparkles className="w-3 h-3" /> 分析此条
                      </button>
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="btn-ghost text-xs flex items-center gap-1 py-2 min-h-[40px] text-red-400/70"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 移动端：中间选项区（独立滚动，不与输入框重叠） */}
      <div className="lg:hidden shrink-0 min-h-0 max-h-none overflow-y-auto scroll-touch border-t border-soul-700/30 bg-soul-900/80">
        <ChatMemoryPanel
          details={settings.partnerMemory?.details ?? ''}
          disabled={isAnalyzing}
          suggestFill={messages.length > 0}
          onChange={(details) =>
            updateSettings({
              partnerMemory: { details, updatedAt: Date.now() },
            })
          }
        />
        <SceneStyleSelector
          chatScene={settings.chatScene}
          tonePreference={settings.tonePreference}
          toneModifiers={settings.toneModifiers ?? []}
          onSceneChange={(sceneId) => updateSettings({ chatScene: sceneId })}
          onToneChange={(prompt) => updateSettings({ tonePreference: prompt })}
          onToneModifiersChange={(toneModifiers) => updateSettings({ toneModifiers })}
          hideGenerateButton
          generating={isAnalyzing}
          disabled={isAnalyzing}
          compact
        />
      </div>

      {/* 桌面端：场景/记忆保持固定位置 */}
      <div className="hidden lg:contents">
        <ChatMemoryPanel
          details={settings.partnerMemory?.details ?? ''}
          disabled={isAnalyzing}
          suggestFill={messages.length > 0}
          onChange={(details) =>
            updateSettings({
              partnerMemory: { details, updatedAt: Date.now() },
            })
          }
        />

        <SceneStyleSelector
          chatScene={settings.chatScene}
          tonePreference={settings.tonePreference}
          toneModifiers={settings.toneModifiers ?? []}
          onSceneChange={(sceneId) => updateSettings({ chatScene: sceneId })}
          onToneChange={(prompt) => updateSettings({ tonePreference: prompt })}
          onToneModifiersChange={(toneModifiers) => updateSettings({ toneModifiers })}
          hideGenerateButton
          generating={isAnalyzing}
          disabled={isAnalyzing}
        />
      </div>

      {/* 输入区 + 生成按钮：固定底部，移动端始终可见 */}
      <div className="shrink-0 border-t border-soul-700/30 bg-soul-950 z-10 relative shadow-[0_-6px_20px_rgba(15,5,30,0.65)]">
        <div className="p-2.5 sm:p-3 pb-2">
          {bulkMode ? (
            <div className="space-y-2">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`粘贴 Soul 对话，支持格式：\n[${settings.otherNickname}]: 你好\n[${settings.myNickname}]: 嗨\n或直接每行一条（自动交替）`}
                rows={4}
                className="input-field w-full resize-none text-sm"
              />
              <div className="flex gap-2">
                <button onClick={handlePaste} className="btn-secondary shrink-0 px-3" title="粘贴">
                  <ClipboardPaste className="w-4 h-4" />
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!bulkText.trim()}
                  className="btn-primary flex-1 text-sm"
                >
                  导入对话
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setRole('other')}
                  className={`composer-role-btn ${
                    role === 'other'
                      ? 'bg-pink-600/25 text-pink-200 border-2 border-pink-500/50'
                      : 'bg-soul-800/60 text-soul-300 border-2 border-soul-700/40'
                  }`}
                >
                  {settings.otherNickname}
                </button>
                <button
                  onClick={() => setRole('me')}
                  className={`composer-role-btn ${
                    role === 'me'
                      ? 'bg-soul-600/25 text-soul-200 border-2 border-soul-500/50'
                      : 'bg-soul-800/60 text-soul-300 border-2 border-soul-700/40'
                  }`}
                >
                  {settings.myNickname}
                </button>
              </div>

              <div className="flex gap-2 items-stretch">
                <button
                  onClick={handlePaste}
                  className="composer-action-btn btn-secondary p-2"
                  title="粘贴"
                >
                  <ClipboardPaste className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:hidden leading-none text-soul-400">粘贴</span>
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    role === 'other'
                      ? '输入对方消息，末尾可加平台如「抖音」'
                      : `以「${settings.myNickname}」身份输入…`
                  }
                  rows={2}
                  className="composer-input"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="composer-action-btn btn-primary p-2 disabled:opacity-40"
                  title="发送"
                >
                  <Send className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:hidden leading-none">发送</span>
                </button>
              </div>
              {role === 'other' && (
                <div className="mt-2.5">
                  <p className="text-xs text-soul-400 mb-1.5 sm:hidden">快捷加平台</p>
                  <div className="flex gap-2 items-center overflow-x-auto scroll-touch no-scrollbar pb-0.5 -mx-0.5 px-0.5">
                    {PLATFORM_QUICK_TAGS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => appendPlatformTag(p.tag)}
                        className="composer-tag bg-soul-800/70 text-soul-200 border border-soul-600/40 hover:text-pink-200 hover:border-pink-500/40 cursor-pointer"
                      >
                        +{p.tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 pt-2 border-t border-soul-700/20">
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleGenerate}
            className="btn-primary w-full flex items-center justify-center gap-2 min-h-[48px] text-[15px] sm:text-sm font-semibold shadow-lg shadow-pink-900/20"
          >
            {isAnalyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在生成…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                智能生成话术
              </>
            )}
          </button>
          <p className="text-xs sm:text-[10px] text-soul-400 text-center mt-1.5 leading-snug">
            {messages.length > 0
              ? '将根据对话 + 聊天记忆生成 5 条回复'
              : '无对话时按所选场景生成开场话术'}
          </p>
        </div>
      </div>
      {iceBreakerOpen && (
        <Suspense fallback={null}>
          <IceBreakerModal open onClose={() => setIceBreakerOpen(false)} />
        </Suspense>
      )}
      <ResetContextModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetConfirm}
      />
    </div>
  );
}
