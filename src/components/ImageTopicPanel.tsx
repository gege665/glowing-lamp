import { useRef, useState } from 'react';
import {
  ImagePlus,
  Loader2,
  Copy,
  Send,
  Sparkles,
  Heart,
  Eye,
  MessageCircle,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

function ChipList({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  if (!items.length) return null;
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accent}`}>
      <p className="text-[10px] mb-1.5 opacity-80">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className="tag text-[10px] bg-soul-900/50 border border-soul-600/30 text-soul-200">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 灵焰识图聊话题面板 */
export default function ImageTopicPanel() {
  const result = useAppStore((s) => s.imageTopicResult);
  const preview = useAppStore((s) => s.imageTopicPreview);
  const caption = useAppStore((s) => s.imageTopicCaption);
  const loading = useAppStore((s) => s.isImageTopicLoading);
  const setCaption = useAppStore((s) => s.setImageTopicCaption);
  const runImageTopic = useAppStore((s) => s.runImageTopic);
  const runCaptionTopic = useAppStore((s) => s.runCaptionTopic);
  const clearImageTopic = useAppStore((s) => s.clearImageTopic);
  const addMessage = useAppStore((s) => s.addMessage);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const showToast = useAppStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    void runImageTopic(file);
  };

  const copyLine = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制');
    } catch {
      showToast('复制失败');
    }
  };

  const useLine = (text: string) => {
    addMessage('me', text);
    showToast('已加入对话');
    setActivePanel('chat');
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto scroll-touch p-3 space-y-3">
      <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/40 via-soul-950/70 to-violet-950/20 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center shrink-0 shadow-lg shadow-sky-900/30">
            <ImagePlus className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-sky-100">识图聊话题</h2>
            <p className="text-[11px] text-soul-400 leading-snug mt-0.5">
              挖热点 · 兴趣 · 生活细节 · 情绪 · 自然接住配图
            </p>
          </div>
          {result && (
            <span className="tag text-[10px] bg-sky-500/20 text-sky-200 border border-sky-500/30 shrink-0">
              {result.source === 'ai' ? 'AI 识图' : '本地推断'}
            </span>
          )}
        </div>

        <div
          className={`rounded-xl border border-dashed px-3 py-4 text-center transition-colors mb-2 ${
            dragOver
              ? 'border-sky-400/60 bg-sky-950/30'
              : 'border-soul-600/40 bg-soul-900/40'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
        >
          {preview ? (
            <div className="relative inline-block max-w-full">
              <img
                src={preview}
                alt="预览"
                className="max-h-40 rounded-lg object-contain mx-auto"
              />
              <button
                type="button"
                onClick={() => clearImageTopic()}
                className="absolute -top-2 -right-2 btn-ghost p-1.5 min-h-0 min-w-0 rounded-full bg-soul-900 border border-soul-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <ImagePlus className="w-8 h-8 text-sky-400/70 mx-auto mb-2" />
              <p className="text-xs text-soul-300 mb-1">上传对方发来的图片</p>
              <p className="text-[10px] text-soul-500">支持拖拽 · jpg/png/webp</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="btn-secondary text-xs min-h-[40px] px-4 mt-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> 识图中…
              </>
            ) : (
              '选择图片'
            )}
          </button>
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="对方配文（可选）… 无图时也可只填配文生成话题"
          rows={2}
          className="input-field w-full resize-none text-sm min-h-[44px] py-2 mb-2"
        />

        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || !caption.trim()}
            onClick={() => void runCaptionTopic()}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 min-h-[44px] text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 生成中…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> 按配文生成话题
              </>
            )}
          </button>
        </div>
      </div>

      {!result && !loading && (
        <div className="rounded-2xl border border-dashed border-sky-500/25 bg-sky-950/10 px-4 py-5 text-center">
          <p className="text-sm text-sky-100/90 mb-1">上传图片或填写配文</p>
          <p className="text-[11px] text-soul-500 leading-relaxed">
            自动挖掘可聊热点、兴趣、生活细节与情绪，给出可发送回复和拓展话题。
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-soul-600/30 bg-soul-900/50 px-3 py-2.5">
            <p className="text-[10px] text-soul-500 mb-0.5 flex items-center gap-1">
              <Eye className="w-3 h-3" /> 画面摘要
            </p>
            <p className="text-sm text-soul-100">{result.sceneSummary || '—'}</p>
            {result.emotion && (
              <p className="text-[11px] text-pink-300/90 mt-1 flex items-center gap-1">
                <Heart className="w-3 h-3" /> 情绪：{result.emotion}
              </p>
            )}
          </div>

          <ChipList
            title="可聊热点"
            items={result.hotspots}
            accent="border-amber-500/25 bg-amber-950/15"
          />
          <ChipList
            title="兴趣线索"
            items={result.interests}
            accent="border-violet-500/25 bg-violet-950/15"
          />
          <ChipList
            title="生活细节"
            items={result.lifeDetails}
            accent="border-emerald-500/25 bg-emerald-950/15"
          />

          <div className="rounded-xl border border-rose-500/25 bg-rose-950/15 p-3 space-y-2">
            <p className="text-xs font-medium text-rose-200 flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" /> 图片回复 · 可直接发
            </p>
            {result.replies.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 rounded-lg bg-soul-900/60 border border-soul-700/40 px-2.5 py-2"
              >
                <p className="flex-1 text-[13px] text-soul-100 leading-snug min-w-0">{r}</p>
                <button
                  type="button"
                  onClick={() => void copyLine(r)}
                  className="btn-ghost p-1.5 min-h-0 min-w-0 text-soul-400 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => useLine(r)}
                  className="btn-secondary text-[10px] min-h-[28px] px-2 shrink-0"
                >
                  <Send className="w-3 h-3 inline mr-0.5" />
                  用
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-3 space-y-1.5">
            <p className="text-xs font-medium text-cyan-200">拓展话题 · 能聊下去</p>
            {result.topics.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void copyLine(t)}
                className="w-full text-left text-[12px] text-soul-200 hover:text-cyan-100 leading-snug py-1"
              >
                · {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
