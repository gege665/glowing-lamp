/** 从模型输出中提取并解析分析 JSON（兼容 GPT markdown / 思考泄漏） */

function stripReasoningPrefix(text: string): string {
  let s = text.trim();
  if (!s) return s;

  s = s.replace(new RegExp('<think[\\s\\S]*?<\\/think>', 'gi'), '');
  s = s.replace(/<redacted_reasoning[\s\S]*?<\/redacted_reasoning>/gi, '');

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    s = fenced[1].trim();
  }

  const brace = s.indexOf('{');
  if (brace > 0) {
    s = s.slice(brace);
  }

  return s.trim();
}

export function extractFirstJsonObject(text: string): string {
  const cleaned = stripReasoningPrefix(text);
  const start = cleaned.indexOf('{');
  if (start === -1) {
    throw new Error('AI 返回格式异常，请重试');
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  throw new Error('AI 返回格式异常，请重试');
}

/** 尝试补全被截断的 JSON 对象 */
export function tryRepairTruncatedJson(fragment: string): string | null {
  let s = fragment.trim();
  if (!s.startsWith('{')) return null;
  const open = (s.match(/\{/g) || []).length;
  const close = (s.match(/\}/g) || []).length;
  if (open <= close) return null;
  s = s.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*$/, '');
  s = s.replace(/,\s*"[^"]*"?\s*:\s*[^,}\]]*$/, '');
  s = s.replace(/,\s*$/, '');
  for (let i = 0; i < open - close; i++) s += '}';
  return s;
}

export function parseAnalysisJsonObject(raw: string): Record<string, unknown> {
  const cleaned = stripReasoningPrefix(raw);
  if (!cleaned) throw new Error('AI 返回内容为空');

  const attempts: string[] = [];
  const jsonStart = cleaned.indexOf('{');
  if (jsonStart >= 0 && cleaned.startsWith('{')) {
    attempts.push(cleaned);
  }
  try {
    attempts.push(extractFirstJsonObject(cleaned));
  } catch {
    /* continue */
  }

  if (jsonStart >= 0) {
    const repaired = tryRepairTruncatedJson(cleaned.slice(jsonStart));
    if (repaired) attempts.push(repaired);
  }

  const seen = new Set<string>();
  for (const candidate of attempts) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* next */
    }
  }

  throw new Error('AI 返回格式异常，请重试');
}
