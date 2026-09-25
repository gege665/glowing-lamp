export interface DeepReportItem {
  label: string;
  text: string;
}

const LABEL_SHORT: Record<string, string> = {
  情绪状态: '情绪',
  情绪: '情绪',
  女性心理需求: '需求',
  心理需求: '需求',
  需求: '需求',
  沟通模式: '沟通',
  沟通: '沟通',
  潜台词: '潜台词',
};

export function shortReportLabel(label: string): string {
  return LABEL_SHORT[label.trim()] || label.trim().slice(0, 4);
}

/** 将 AI 返回的 deepReport 解析为要点列表，便于紧凑展示 */
export function parseDeepReport(raw: string): DeepReportItem[] {
  if (!raw?.trim()) return [];

  let text = raw.trim().replace(/^#{1,3}\s*心理穿透分析报告\s*/m, '').trim();
  const items: DeepReportItem[] = [];

  const regex = /\*\*([^*]+)\*\*[：:|]?\s*([^\n*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const label = match[1].trim();
    const body = match[2].trim();
    if (label && body) items.push({ label, text: body });
  }

  if (items.length > 0) return items;

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const labeled = line.match(/^[-*]?\s*([^：:]{1,8})[：:]\s*(.+)$/);
      if (labeled) return { label: labeled[1].trim(), text: labeled[2].trim() };
      return { label: '要点', text: line.replace(/^[-*]\s*/, '') };
    });
}
