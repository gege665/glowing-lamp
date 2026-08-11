/**
 * 从模型输出中提取首个 JSON 对象（容错 fence / 前后杂质）。
 * 复杂分析 JSON 请优先用 analysisJsonParse.parseAnalysisJsonObject。
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* continue */
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}
