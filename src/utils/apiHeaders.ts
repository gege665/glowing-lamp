/** 前端调用 /api/* 的公共 JSON 头；可选附带访问令牌防白嫖 */
export function jsonApiHeaders(extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const token = import.meta.env.VITE_API_ACCESS_TOKEN;
  if (typeof token === 'string' && token.trim()) {
    headers['x-api-access-token'] = token.trim();
  }
  return headers;
}
