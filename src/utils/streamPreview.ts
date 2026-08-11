import { FLIRT_REPLY_STYLES, type ReplyStyleDefinition } from '../constants/replyStylePrompts';
import { REPLY_SUGGESTION_COUNT } from '../types';
import { normalizeReplyLine } from './replyParse';
import { lineLooksLikeReasoningLeak, lineLooksTooOfficial } from './replyQuality';
/** 分析流程阶段（用于左右面板分流展示） */
export type StreamPhase = 'analysis' | 'parsing' | 'replies' | 'finishing';

/** 左侧实时心理分析预览（随 JSON 流式填充） */
export interface AnalysisLivePreview {
  summary?: string;
  primary?: string;
  secondary?: string;
  intensity?: number;
  trend?: string;
}

/** 右侧单条话术预览 */
export interface ReplyLinePreview {
  label: string;
  content: string;
}

export interface StreamProgress {
  phase: StreamPhase;
  message: string;
  analysisPreview?: AnalysisLivePreview;
  replyPreviews?: ReplyLinePreview[];
  /** 实际调用的模型（可能与设置不同，如故障切换后） */
  activeModel?: string;
  /** 手动模式下，话术阶段将使用的模型（分析阶段提前展示） */
  pendingReplyModel?: string;
  requestedModel?: string;
  modelSwitched?: boolean;
}

function stripReplyLine(raw: string, expectedLabel?: string): string {
  const line = normalizeReplyLine(raw, expectedLabel);
  if (!line || line.startsWith('{') || /"summary"\s*:/.test(line)) return '';
  if (lineLooksLikeReasoningLeak(line)) return '';
  if (lineLooksTooOfficial(line) && line.length > 20) return '';
  if (line.length > 120) return line.slice(0, 120).trim();
  return line;
}
/** 从流式文本解析已生成的话术行（startIndex 用于分批生成时的标签对齐） */
export function extractReplyPreviewLines(
  raw: string,
  startIndex = 0,
  styleMeta: ReplyStyleDefinition[] = FLIRT_REPLY_STYLES
): ReplyLinePreview[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('{') || /"summary"\s*:/.test(trimmed)) {
    return [];
  }

  const lines = trimmed
    .split('\n')
    .map((line) => stripReplyLine(line))
    .filter((l) => l.length >= 4);

  const unique: string[] = [];
  for (const line of lines) {
    if (!unique.includes(line)) unique.push(line);
    if (unique.length >= REPLY_SUGGESTION_COUNT) break;
  }

  return unique.map((content, index) => ({
    label: styleMeta[startIndex + index]?.label ?? `话术 ${startIndex + index + 1}`,
    content: stripReplyLine(content, styleMeta[startIndex + index]?.label),
  }));
}

export function replyFingerprint(previews: ReplyLinePreview[]): string {
  return previews.map((p) => `${p.label}:${p.content.length}`).join('|');
}
