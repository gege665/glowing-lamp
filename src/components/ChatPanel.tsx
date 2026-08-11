import { useState, useRef, useEffect } from 'react';
import {
  Send,
  User,
  Heart,
  Copy,
  Sparkles,
  Trash2,
  ClipboardPaste,
  MessageCircle,
  ImagePlus,
  Zap,
  RotateCcw,
  Swords,
  Files,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import type { ChatMessage } from '../types';
import { useAppStore } from '../store/appStore';
import { saveMessages, generateId, saveAnalysis } from '../services/storageService';
import {
  parseMessageWithPlatform,
  PLATFORM_QUICK_TAGS,
} from '../constants/socialPlatforms';
import { recognizeChatScreenshot, prepareImageForOcr } from '../services/ocrService';
import ResetContextModal, { shouldSkipResetConfirm } from './ResetContextModal';
import SceneStyleSelector from './SceneStyleSelector';
import ChatMemoryPanel from './ChatMemoryPanel';
import MobileOptionsAccordion from './MobileOptionsAccordion';
import QuickStartGuide from './QuickStartGuide';

export default function ChatPanel() {
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const addMessage = useAppStore((s) => s.addMessage);
  const deleteMessage = useAppStore((s) => s.deleteMessage);
  const resetChatContext = useAppStore((s) => s.resetChatContext);
  const selectedMessageId = useAppStore((s) => s.selectedMessageId);
  const selectMessage = useAppStore((s) => s.selectMessage);
  const runAnalysis = useAppStore((s) => s.runAnalysis);
  const runGenerateReplies = useAppStore((s) => s.runGenerateReplies);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const showToast = useAppStore((s) => s.showToast);
  const setIceBreakerOpen = useAppStore((s) => s.setIceBreakerOpen);

  const [input, setInput] = useState('');
  const [role, setRole] = useState<'me' | 'other'>('other');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
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
    const existing = useAppStore.getState().messages;
    const imported: ChatMessage[] = parsed.map((p) => ({
      id: generateId(),
      role: p.role,
      content: p.content.trim(),
      timestamp: Date.now(),
    }));
    const messages = [...existing, ...imported];
    saveMessages(messages);
    saveAnalysis(null);
    useAppStore.setState({ messages, analysis: null });
    setBulkText('');
    setBulkMode(false);
    showToast(`已导入 ${imported.length} 条，点击下方按钮生成话术`);
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
      const base64 = await prepareImageForOcr(file);
      const lines = await recognizeChatScreenshot(base64, settings, ac.signal);
      if (ac.signal.aborted) return;
      if (lines.length === 0) {
        showToast('未识别到对话内容');
        return;
      }
      const existing = useAppStore.getState().messages;
      const imported: ChatMessage[] = lines.map((p) => ({
        id: generateId(),
        role: p.role,
        content: p.content,
        timestamp: Date.now(),
      }));
      const messages = [...existing, ...imported];
      saveMessages(messages);
      saveAnalysis(null);
      useAppStore.setState({ messages, analysis: null });
      showToast(`截图识别 ${imported.length} 条，点击下方按钮生成话术`);
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
    <div className="panel-card panel-zone-ops h-full min-h-0 overflow-hidden flex flex-col">
      <div className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 border-b border-rose-500/15 flex flex-row items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
          <h2 className="font-semibold text-soul-200 text-sm sm:text-base truncate">
            <span className="md:hidden">对话</span>
            <span className="hidden md:inline">操作区</span>
          </h2>
          <span className="tag bg-soul-800 text-soul-300 shrink-0 text-[10px] sm:text-xs">
            {messages.length}
          </span>
        </div>
        {/* 手机：OCR + 更多；桌面：完整工具条 */}
        <div className="relative flex items-center gap-0.5 shrink-0">
          <label
            className="btn-ghost text-xs p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-soul-300 cursor-pointer shrink-0"
            title="上传聊天截图"
          >
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
            type="button"
            onClick={() => setIceBreakerOpen(true)}
            className="hidden md:flex btn-ghost text-xs p-2 min-h-[40px] min-w-[40px] items-center justify-center text-amber-400 shrink-0"
            title="灵焰破冰救场"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              useAppStore.getState().setActivePanel('love');
              useAppStore.getState().setLoveSubTab('drill');
              showToast('进入模拟演练');
            }}
            className="hidden md:flex btn-ghost text-xs p-2 min-h-[40px] min-w-[40px] items-center justify-center text-violet-400 shrink-0"
            title="全场景模拟演练"
          >
            <Swords className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setBulkMode(!bulkMode)}
            className={`hidden md:flex btn-ghost text-xs p-2 min-h-[40px] min-w-[40px] items-center justify-center shrink-0 ${
              bulkMode ? 'text-pink-400' : 'text-soul-400'
            }`}
            title={bulkMode ? '切回单条' : '批量导入'}
          >
            <Files className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetClick}
            className="hidden md:flex btn-ghost text-xs p-2 min-h-[40px] min-w-[40px] items-center justify-center text-orange-400 hover:text-orange-300 shrink-0"
            title="重置聊天上下文"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setToolsOpen((o) => !o)}
            className="md:hidden btn-ghost text-xs p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-soul-300 shrink-0"
            title="更多工具"
            aria-expanded={toolsOpen}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {toolsOpen && (
            <>
              <button
                type="button"
                className="md:hidden fixed inset-0 z-30 bg-transparent"
                aria-label="关闭菜单"
                onClick={() => setToolsOpen(false)}
              />
              <div className="md:hidden absolute right-0 top-full mt-1 z-40 w-44 rounded-xl border border-soul-600/40 bg-soul-900/98 shadow-xl py-1 animate-fade-in">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-amber-200 hover:bg-soul-800/80"
                  onClick={() => {
                    setToolsOpen(false);
                    setIceBreakerOpen(true);
                  }}
                >
                  <Zap className="w-3.5 h-3.5" /> 破冰救场
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-violet-200 hover:bg-soul-800/80"
                  onClick={() => {
                    setToolsOpen(false);
                    useAppStore.getState().setActivePanel('love');
                    useAppStore.getState().setLoveSubTab('drill');
                    showToast('进入模拟演练');
                  }}
                >
                  <Swords className="w-3.5 h-3.5" /> 模拟演练
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-soul-200 hover:bg-soul-800/80"
                  onClick={() => {
                    setToolsOpen(false);
                    setBulkMode((b) => !b);
                  }}
                >
                  <Files className="w-3.5 h-3.5" /> {bulkMode ? '切回单条' : '批量导入'}
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-orange-200 hover:bg-soul-800/80"
                  onClick={() => {
                    setToolsOpen(false);
                    handleResetClick();
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 重置对话
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 对话区可滚动；底部选项+输入始终可见，避免被挤出视口 */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-touch p-2.5 sm:p-4 space-y-2.5 sm:space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[4.5rem] py-2 sm:py-4 px-2">
            <p className="md:hidden text-[12px] text-soul-400 text-center leading-relaxed px-2 mb-2">
              粘贴对方消息，点下方「智能生成」即可
            </p>
            <div className="hidden md:block w-full">
              <QuickStartGuide
                hasMessages={false}
                isAnalyzing={isAnalyzing}
                onPaste={handlePaste}
                onUpload={() => fileInputRef.current?.click()}
              />
            </div>
            <div className="md:hidden flex gap-2 justify-center">
              <button type="button" onClick={handlePaste} className="btn-secondary text-xs min-h-[40px] px-3">
                <ClipboardPaste className="w-3.5 h-3.5 inline mr-1" />
                粘贴
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs min-h-[40px] px-3"
              >
                <ImagePlus className="w-3.5 h-3.5 inline mr-1" />
                截图
              </button>
            </div>
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

                  {!isMe && isSelected && (
                    <div className="flex flex-wrap gap-1 mt-1.5 animate-fade-in">
                      <button
                        onClick={() => handleCopy(msg.content)}
                        className="btn-ghost text-xs flex items-center gap-1 py-1.5 min-h-[36px]"
                      >
                        <Copy className="w-3 h-3" /> 复制
                      </button>
                      <button
                        onClick={() => runAnalysis(msg.id)}
                        className="btn-ghost text-xs flex items-center gap-1 py-1.5 min-h-[36px] text-pink-400"
                      >
                        <Sparkles className="w-3 h-3" /> 分析
                      </button>
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="btn-ghost text-xs flex items-center gap-1 py-1.5 min-h-[36px] text-red-400/70"
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

      <MobileOptionsAccordion
        hasMessages={messages.length > 0}
        chatScene={settings.chatScene}
        toneModifiers={settings.toneModifiers ?? []}
        primaryReplyStyle={settings.primaryReplyStyle ?? ''}
        memoryDetails={settings.partnerMemory?.details ?? ''}
        disabled={isAnalyzing}
        onSceneChange={(sceneId) => updateSettings({ chatScene: sceneId })}
        onToneModifiersChange={(toneModifiers) => updateSettings({ toneModifiers })}
        onPrimaryStyleChange={(primaryReplyStyle) => updateSettings({ primaryReplyStyle })}
        onMemoryChange={(details) =>
          updateSettings({
            partnerMemory: { details, updatedAt: Date.now() },
          })
        }
      />

      {/* 桌面端选项：限高可滚，绝不挤掉输入框 */}
      <div className="hidden md:block shrink-0 max-h-[min(28vh,220px)] overflow-y-auto scroll-touch border-t border-rose-500/10">
        <SceneStyleSelector
          section="scenes"
          chatScene={settings.chatScene}
          tonePreference={settings.tonePreference}
          toneModifiers={settings.toneModifiers ?? []}
          primaryReplyStyle={settings.primaryReplyStyle ?? ''}
          onSceneChange={(sceneId) => updateSettings({ chatScene: sceneId })}
          onToneChange={(prompt) => updateSettings({ tonePreference: prompt })}
          onToneModifiersChange={(toneModifiers) => updateSettings({ toneModifiers })}
          onPrimaryStyleChange={(primaryReplyStyle) => updateSettings({ primaryReplyStyle })}
          hideGenerateButton
          generating={isAnalyzing}
          disabled={isAnalyzing}
        />

        <ChatMemoryPanel
          details={settings.partnerMemory?.details ?? ''}
          disabled={isAnalyzing}
          onChange={(details) =>
            updateSettings({
              partnerMemory: { details, updatedAt: Date.now() },
            })
          }
        />

        <SceneStyleSelector
          section="styles"
          chatScene={settings.chatScene}
          tonePreference={settings.tonePreference}
          toneModifiers={settings.toneModifiers ?? []}
          primaryReplyStyle={settings.primaryReplyStyle ?? ''}
          onSceneChange={(sceneId) => updateSettings({ chatScene: sceneId })}
          onToneChange={(prompt) => updateSettings({ tonePreference: prompt })}
          onToneModifiersChange={(toneModifiers) => updateSettings({ toneModifiers })}
          onPrimaryStyleChange={(primaryReplyStyle) => updateSettings({ primaryReplyStyle })}
          hideGenerateButton
          generating={isAnalyzing}
          disabled={isAnalyzing}
        />
      </div>

      {/* 输入区：始终钉在操作区底部 */}
      <div className="shrink-0 border-t border-soul-700/30 bg-soul-950 z-20 relative shadow-[0_-6px_20px_rgba(15,5,30,0.65)]">
        <div className="p-2 sm:p-3 pb-1.5 sm:pb-2">
          {bulkMode ? (
            <div className="space-y-2">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`粘贴 Soul 对话，支持格式：\n[${settings.otherNickname}]: 你好\n[${settings.myNickname}]: 嗨\n或直接每行一条（自动交替）`}
                rows={4}
                className="input-field w-full resize-y min-h-[5rem] sm:min-h-[7rem] text-sm"
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
              <div className="flex gap-1.5 mb-1.5 sm:mb-2 sm:gap-2">
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

              <div className="flex gap-1.5 sm:gap-2 items-stretch">
                <button
                  onClick={handlePaste}
                  className="composer-action-btn btn-secondary p-1.5 sm:p-2 max-md:min-w-[40px]"
                  title="粘贴"
                >
                  <ClipboardPaste className="w-4 h-4 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:hidden leading-none text-soul-400">粘贴</span>
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    role === 'other'
                      ? '输入对方消息…'
                      : `以「${settings.myNickname}」输入…`
                  }
                  rows={2}
                  className="composer-input"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="composer-action-btn btn-primary p-1.5 sm:p-2 disabled:opacity-40 max-md:min-w-[40px] self-stretch"
                  title="发送"
                >
                  <Send className="w-4 h-4" />
                  <span className="text-[10px] sm:hidden leading-none">发送</span>
                </button>
              </div>
              {role === 'other' && (
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPlatformOpen((o) => !o)}
                    className="inline-flex items-center gap-1 text-[11px] text-soul-400 hover:text-soul-200 min-h-[28px] px-1 touch-manipulation"
                  >
                    加平台标签
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${platformOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {platformOpen && (
                    <div className="flex gap-1.5 items-center overflow-x-auto scroll-touch no-scrollbar pb-0.5 mt-1 animate-fade-in">
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
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-2 sm:px-3 pb-2 sm:pb-3 pt-1 border-t border-soul-700/20">
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={handleGenerate}
            className="btn-primary w-full flex items-center justify-center gap-2 min-h-[46px] sm:min-h-[48px] text-[15px] sm:text-sm font-semibold shadow-lg shadow-pink-900/25 relative z-10"
          >
            {isAnalyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在生成…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span className="md:hidden">智能生成</span>
                <span className="hidden md:inline">智能生成话术</span>
              </>
            )}
          </button>
        </div>
      </div>
      <ResetContextModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetConfirm}
      />
    </div>
  );
}
