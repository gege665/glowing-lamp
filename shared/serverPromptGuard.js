/**
 * 服务端强制护栏：即使前端 Prompt 被改/截取，上游仍带上最底线约束。
 * 完整风格 Prompt 仍可在客户端；逐步迁移时可把更多规则放到此文件或 env。
 */
export const DEFAULT_SERVER_SYSTEM_GUARD = `【服务端强制】
输出必须是可直接复制发送的中文私聊原话。
禁止：分析术语（高情商/框架/推拉等）、思考过程、JSON、Markdown、编号说明、风格名称、英文旁白。
优先回应对方最后一句的具体内容；默认短口语（约 8～35 字）。`;

/**
 * @param {Array<{ role?: string, content?: string }>} messages
 * @returns {Array<{ role?: string, content?: string }>}
 */
export function injectServerSystemGuard(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;

  const guard =
    (typeof process !== 'undefined' && process.env.SERVER_SYSTEM_GUARD?.trim()) ||
    DEFAULT_SERVER_SYSTEM_GUARD;

  const out = messages.map((m) => ({ ...m }));
  const idx = out.findIndex((m) => m?.role === 'system');
  if (idx >= 0) {
    const prev = typeof out[idx].content === 'string' ? out[idx].content : '';
    if (prev.includes('【服务端强制】')) return out;
    out[idx] = { ...out[idx], content: `${guard}\n\n${prev}` };
  } else {
    out.unshift({ role: 'system', content: guard });
  }
  return out;
}
