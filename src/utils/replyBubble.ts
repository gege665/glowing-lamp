/** 将话术正文与尾部情境说明分离，便于气泡展示 */
export function parseReplyBubbleContent(content: string): { text: string; meta: string | null } {
  const trimmed = content.trim();
  const match = trimmed.match(/^(.+?)\s*[（(]([^）)]*)[）)]\s*$/);
  if (match) {
    const text = match[1].trim();
    const meta = match[2].trim();
    if (text) return { text, meta: meta || null };
  }
  return { text: trimmed, meta: null };
}
