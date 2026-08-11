/** 爱易威 / 上游分组负载饱和等可重试错误 */
export const UPSTREAM_BUSY_PATTERN =
  /负载已饱和|上游负载|分组.*负载|分组繁忙|overload|saturated|too many requests|rate limit|请稍后再试/i;

export function isUpstreamBusyMessage(msg) {
  return UPSTREAM_BUSY_PATTERN.test(String(msg || ''));
}

export function formatUpstreamBusyUserMessage(detail = '') {
  const base =
    '上游暂时繁忙，系统已自动切换模型与路由并重试。若仍失败，请等待 1 分钟后重试';
  const trimmed = String(detail || '').trim();
  if (!trimmed || isUpstreamBusyMessage(trimmed)) return base;
  return `${base}（${trimmed.slice(0, 60)}）`;
}
