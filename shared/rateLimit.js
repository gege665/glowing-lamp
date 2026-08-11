/** 简易内存速率限制（Serverless 单实例有效，防突发滥用） */
const buckets = new Map();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 30;

/**
 * 取客户端 IP：优先平台可信头，避免信任 X-Forwarded-For 最左跳（可伪造）
 */
export function getClientIp(req) {
  const vercelFwd = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelFwd === 'string' && vercelFwd.trim()) {
    return vercelFwd.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    // 常见代理：最右为最近一跳；无可信代理配置时退回最右，降低客户端伪造最左 IP 的收益
    if (parts.length) return parts[parts.length - 1];
  }
  if (Array.isArray(forwarded) && forwarded.length) {
    return String(forwarded[forwarded.length - 1]).trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

/**
 * @returns {void}
 * @throws {{ status: 429, message: string }}
 */
export function assertRateLimit(req, {
  key = 'global',
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
} = {}) {
  const ip = getClientIp(req);
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  let entry = buckets.get(bucketKey);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, entry);
  }

  entry.count += 1;

  if (entry.count > max) {
    const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    throw Object.assign(new Error(`请求过于频繁，请 ${retrySec} 秒后重试`), { status: 429 });
  }

  // 防止 Map 无限增长
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }
}
