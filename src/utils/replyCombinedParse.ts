import type { ReplyCategory, ReplySuggestion } from '../types';
import { tryRepairTruncatedJson } from './analysisJsonParse';
import { normalizeReplyLine } from './replyParse';
import { lineLooksLikeReasoningLeak } from './replyQuality';

/** 从合并 JSON 的 replies 项提取可发送文本 */
export function extractCombinedReplyText(entry: unknown): string {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object') {
    const o = entry as Record<string, unknown>;
    const text = o.content ?? o.text ?? o.line ?? o.reply ?? o.value ?? o.message;
    if (typeof text === 'string') return text.trim();
  }
  return '';
}

function parseJsonCandidates(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const attempts: string[] = [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    attempts.push(trimmed);
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    attempts.push(trimmed.slice(start, end + 1));
  }
  if (start >= 0) {
    const repaired = tryRepairTruncatedJson(trimmed.slice(start));
    if (repaired) attempts.push(repaired);
  }

  const parsed: unknown[] = [];
  const seen = new Set<string>();
  for (const candidate of attempts) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      parsed.push(JSON.parse(candidate));
    } catch {
      /* next */
    }
  }
  return parsed;
}

function linesFromParsedJson(parsed: unknown): string[] {
  if (Array.isArray(parsed)) {
    return parsed.map(extractCombinedReplyText).filter((t) => t.length >= 2);
  }
  if (!parsed || typeof parsed !== 'object') return [];

  const o = parsed as Record<string, unknown>;
  const replies = o.replies;
  if (Array.isArray(replies)) {
    return replies.map(extractCombinedReplyText).filter((t) => t.length >= 2);
  }
  if (typeof replies === 'string') {
    return replies
      .split('\n')
      .map((l) => l.trim())
      .filter((t) => t.length >= 2);
  }
  const linesField = o.lines;
  if (Array.isArray(linesField)) {
    return linesField.map(extractCombinedReplyText).filter((t) => t.length >= 2);
  }
  return [];
}

/** 按 label 字段对齐 JSON 话术 */
function linesFromParsedJsonByLabel(
  parsed: unknown,
  styles: ReplyStyleSlot[]
): string[] | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const replies = (parsed as Record<string, unknown>).replies;
  if (!Array.isArray(replies)) return null;

  const mapped = styles.map((style) => {
    const byLabel = replies.find((item) => {
      if (!item || typeof item !== 'object') return false;
      const label = String((item as Record<string, unknown>).label ?? '').trim();
      return label === style.label;
    });
    if (byLabel) return extractCombinedReplyText(byLabel);
    return '';
  });

  if (mapped.some((line) => line.length >= 2)) return mapped;
  return null;
}

function tryParseRepliesJson(text: string, styles?: ReplyStyleSlot[]): string[] {
  const parsedList = parseJsonCandidates(text);
  if (!parsedList.length) return [];

  if (styles) {
    for (const parsed of parsedList) {
      const byLabel = linesFromParsedJsonByLabel(parsed, styles);
      if (byLabel?.some((l) => l.length >= 2)) return byLabel;
    }
  }

  for (const parsed of parsedList) {
    const lines = linesFromParsedJson(parsed);
    if (lines.length) return lines;
  }
  return [];
}

/** 从模型输出（JSON 或纯文本）提取话术行 */
export function extractRepliesFromModelOutput(raw: string, styles?: ReplyStyleSlot[]): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();

  const fromJson = tryParseRepliesJson(body, styles);
  if (fromJson.length) return fromJson;

  return extractPlainReplyLines(body);
}

/** 从纯文本 / 编号列表提取话术行（不过滤质量） */
export function extractPlainReplyLines(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const numbered = new Map<number, string>();
  const plain: string[] = [];

  for (const rawLine of trimmed.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(/^```(?:json)?/i, '').replace(/```$/g, '').trim();
    if (!line) continue;
    if (line.startsWith('{') && (line.includes('"summary"') || line.includes('"emotion"'))) {
      continue;
    }

    const numberedMatch = line.match(/^(\d+)[.)]\s*(.+)$/);
    let candidate = (numberedMatch ? numberedMatch[2] : line).trim();
    candidate = candidate.replace(/^["']|["']$/g, '').trim();
    if (!candidate) continue;
    if (candidate.startsWith('{') && candidate.endsWith('}')) continue;

    if (numberedMatch) {
      numbered.set(Number(numberedMatch[1]), candidate);
      continue;
    }
    plain.push(candidate);
  }

  if (numbered.size > 0) {
    const maxIndex = Math.max(...numbered.keys());
    const ordered: string[] = [];
    for (let i = 1; i <= maxIndex; i++) {
      const value = numbered.get(i);
      if (value) ordered.push(value);
    }
    if (ordered.length) return ordered;
  }

  return plain;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function coerceReplyContentStrict(raw: string | undefined, label: string): string {
  if (!raw?.trim()) return '';

  const normalized = normalizeReplyLine(raw, label);
  if (normalized.length >= 2) return normalized;

  const labelPattern = new RegExp(`^${escapeRegExp(label)}\\s*[：:]\\s*`);
  let stripped = raw.trim().replace(labelPattern, '');
  stripped = stripped.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
  if (stripped.length >= 2 && stripped.length <= 55 && !lineLooksLikeReasoningLeak(stripped)) {
    return stripped;
  }

  const bare = raw.trim();
  if (bare.length >= 2 && bare.length <= 55 && !lineLooksLikeReasoningLeak(bare)) {
    return bare;
  }

  return '';
}

/** 宽松模式：只去标签/编号，保留短口语（避免误杀） */
function coerceReplyContentPermissive(raw: string | undefined, label: string): string {
  if (!raw?.trim()) return '';

  const labelPattern = new RegExp(`^${escapeRegExp(label)}\\s*[：:]\\s*`);
  let line = raw.trim().replace(labelPattern, '');
  line = line.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
  line = line.replace(/^["']|["']$/g, '').trim();
  if (line.length >= 2 && line.length <= 55) return line;

  const normalized = normalizeReplyLine(raw, label);
  if (normalized.length >= 2) return normalized;

  return '';
}

export interface ReplyStyleSlot {
  category: ReplyCategory | string;
  label: string;
}

export type ParseRepliesOptions = {
  permissive?: boolean;
};

/** 将模型原始输出映射为带风格标签的话术条（JSON 优先，纯文本兜底） */
export function parseModelRepliesToSuggestions(
  raw: string,
  styleMeta: ReplyStyleSlot[],
  _startIndex = 0,
  options?: ParseRepliesOptions
): ReplySuggestion[] {
  const coerce = options?.permissive ? coerceReplyContentPermissive : coerceReplyContentStrict;

  let lines = extractRepliesFromModelOutput(raw, styleMeta);
  if (lines.length < styleMeta.length) {
    const plain = extractPlainReplyLines(raw);
    if (plain.length > lines.length) lines = plain;
  }

  const suggestions = styleMeta.map((style, i) => {
    const rawLine = lines[i] ?? '';
    let content = coerce(rawLine, style.label);
    if (!content && lines[i]) {
      content = coerceReplyContentPermissive(lines[i], style.label);
    }
    return {
      category: style.category as ReplyCategory,
      label: style.label,
      content,
    };
  });

  const validCount = suggestions.filter((s) => s.content.trim().length >= 2).length;
  if (validCount > 0 || options?.permissive) return suggestions;

  return styleMeta.map((style, i) => ({
    category: style.category as ReplyCategory,
    label: style.label,
    content: coerceReplyContentPermissive(lines[i] ?? '', style.label),
  }));
}
