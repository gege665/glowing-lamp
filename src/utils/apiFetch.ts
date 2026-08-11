/**
 * 统一 /api 请求：自动附带 x-api-access-token（与服务端 API_ACCESS_TOKEN 对应）
 * 令牌由构建期 VITE_API_ACCESS_TOKEN 注入，避免依赖可伪造的 Origin。
 */

const ACCESS_HEADER = 'x-api-access-token';

export function getApiAccessToken(): string {
  try {
    return String(import.meta.env.VITE_API_ACCESS_TOKEN || '').trim();
  } catch {
    return '';
  }
}

/** 合并业务 headers 与访问令牌（不覆盖调用方已显式设置的同名头） */
export function withApiAccessHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders);
  const token = getApiAccessToken();
  if (token && !headers.has(ACCESS_HEADER)) {
    headers.set(ACCESS_HEADER, token);
  }
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: withApiAccessHeaders(init?.headers),
  });
}
