import { normalizeReplyLine } from './replyParse';
import { lineLooksLikeReasoningLeak, lineLooksLikeMetaInstruction } from './replyQuality';

const ICE_BREAKER_META_PATTERNS = [
  /等下[，,]/,
  /再调整/,
  /再润色/,
  /再检查/,
  /符合要求/,
  /这三条/,
  /都很自然/,
  /字节/,
  /控制在\s*\d+/,
  /男生对女生/,
  /不套路/,
  /不油腻/,
  /随手发的/,
  /第一条|第二条|第三条/,
  /比如[：:]/,
  /例如[：:]/,
  /对，这/,
  /再改/,
  /再优化/,
  /生成.*条/,
  /输出格式/,
];

function tryParseJsonBundle(raw: string): { lines: string[]; topics: string[] } {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return { lines: [], topics: [] };

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      lines?: unknown;
      topics?: unknown;
    };
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];
    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];
    return { lines, topics };
  } catch {
    return { lines: [], topics: [] };
  }
}

function tryParseJsonLines(raw: string): string[] {
  return tryParseJsonBundle(raw).lines;
}

function extractQuotedLines(raw: string): string[] {
  const results: string[] = [];
  const patterns = [
    /[「『"]([^」』""]{8,40})[」』""]/g,
    /(?:^|\n)\s*[-•]?\s*([^。\n！？!?]{8,40}[。！？!?]?)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw)) !== null) {
      const line = match[1]?.trim();
      if (line && isValidIceBreakerLine(line)) results.push(line);
    }
  }

  return results;
}

function splitCandidateSentences(raw: string): string[] {
  return raw
    .split(/[\n。！？!?]+/)
    .map((part) => part.replace(/^\d+[\.\)、]\s*/, '').trim())
    .filter((part) => part.length >= 8);
}

export function isValidIceBreakerLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 8 || t.length > 40) return false;
  if (lineLooksLikeReasoningLeak(t) || lineLooksLikeMetaInstruction(t)) return false;
  if (ICE_BREAKER_META_PATTERNS.some((p) => p.test(t))) return false;
  if (/^[\[{"]/.test(t) || /"\s*[,}\]]/.test(t)) return false;
  return true;
}

function normalizeIceBreakerLine(raw: string): string {
  let line = normalizeReplyLine(raw);
  line = line.replace(/^["']|["']$/g, '').trim();
  if (line.endsWith('。') && line.length <= 38) {
    // 保留句号也可发送
  }
  return line;
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.replace(/[。！？!?～\s]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/** 从大模型原始输出中提取 N 条可发送破冰话术 */
export function parseIceBreakerOutput(raw: string, expected: number): string[] {
  const pools: string[] = [];

  pools.push(...tryParseJsonLines(raw).map(normalizeIceBreakerLine));
  pools.push(...extractQuotedLines(raw).map(normalizeIceBreakerLine));

  for (const part of raw.split('\n')) {
    pools.push(normalizeIceBreakerLine(part));
  }

  for (const sentence of splitCandidateSentences(raw)) {
    pools.push(normalizeIceBreakerLine(sentence));
  }

  const valid = dedupeLines(pools.filter(isValidIceBreakerLine));
  return valid.slice(0, expected);
}

export interface IceBreakerBundle {
  lines: string[];
  topics: string[];
}

/** 解析开场白 + 续聊话题 */
export function parseIceBreakerBundle(
  raw: string,
  lineCount: number,
  topicCount: number
): IceBreakerBundle {
  const bundle = tryParseJsonBundle(raw);
  const linePools = [
    ...bundle.lines.map(normalizeIceBreakerLine),
    ...parseIceBreakerOutput(raw, lineCount),
  ];
  const topicPools = [
    ...bundle.topics.map(normalizeIceBreakerLine),
    ...extractQuotedLines(raw).map(normalizeIceBreakerLine),
  ];

  const lines = dedupeLines(linePools.filter(isValidIceBreakerLine)).slice(0, lineCount);
  let topics = dedupeLines(
    topicPools.filter((t) => t.length >= 6 && t.length <= 40 && !lineLooksLikeReasoningLeak(t))
  ).slice(0, topicCount);

  // topics 若与 lines 重复则去掉
  const lineKeys = new Set(lines.map((l) => l.replace(/[。！？!?～\s]/g, '')));
  topics = topics.filter((t) => !lineKeys.has(t.replace(/[。！？!?～\s]/g, '')));

  return { lines, topics };
}
