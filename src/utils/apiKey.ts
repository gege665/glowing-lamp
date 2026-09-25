/** 规范化 API Key：去 Bearer、首尾空白、中间空格/换行（粘贴时常带入） */
export function normalizeApiKey(apiKey: string | undefined | null): string {
  if (!apiKey) return '';
  return String(apiKey).trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
}

const INVALID_TOKEN_RE =
  /invalid token|token无效|令牌无效|invalid api key|incorrect api key/i;

/** 将上游 Invalid token 转为可操作的中文提示 */
export function humanizeInvalidTokenError(
  rawMsg: string,
  provider?: string
): string | null {
  const msg = rawMsg.trim();
  if (!INVALID_TOKEN_RE.test(msg)) return null;
  const hints: Record<string, string> = {
    aiyiwei:
      '爱易威 API Key 无效或已过期。请打开设置 → 重新粘贴 sk- 开头的 Key → 点击「验证 Key」',
    juhe: '聚合 API Key 无效。请确认服务商为「聚合 API」并重新验证 Key',
    openrouter:
      'OpenRouter Key 无效。请使用 sk-or- 开头的 Key，或在设置中切换服务商',
    groq: 'Groq Key 无效。请使用 gsk_ 开头的 Key',
    siliconflow: 'SiliconFlow Key 无效，请在设置中重新填写并验证',
  };
  return (
    hints[provider || ''] ||
    `API Key 无效（${msg}）。请打开设置检查 Key 是否与所选服务商匹配`
  );
}
