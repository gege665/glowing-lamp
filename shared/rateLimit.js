/** 速率限制：本地内存 + 可选 Upstash Redis（跨 Serverless 实例共享） */

const buckets = new Map();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 30;

export function getClientIp(req) {
  // Express only populates req.ip from forwarded headers when trust proxy is enabled.
  // Never parse the raw header here: clients can forge it and bypass the limiter.
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  return typeof ip === 'string' && ip.trim() ? ip.trim() : 'unknown';
}

/** 自带 Key 用较宽配额；吃服务端 Key 更严 */
export function hasClientApiKey(body) {
  const key = body?.apiKey;
  return typeof key === 'string' && key.trim().length > 0;
}

export function buildRateLimitOptions(req, {
  key,
  windowMs = DEFAULT_WINDOW_MS,
  userMax = DEFAULT_MAX,
  serverMax,
} = {}) {
  const usingUserKey = hasClientApiKey(req?.body);
  const max = usingUserKey ? userMax : (serverMax ?? Math.max(4, Math.floor(userMax / 2)));
  return {
    key: `${key}:${usingUserKey ? 'user' : 'server'}`,
    windowMs,
    max,
  };
}

function assertMemoryRateLimit(bucketKey, windowMs, max) {
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

  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

/**
 * Upstash REST：INCR；首次写入时设置过期
 * @returns {Promise<number|null>} 当前计数；失败返回 null（调用方回退内存）
 */
async function upstashIncr(bucketKey, windowMs) {
  const cfg = getUpstashConfig();
  if (!cfg) return null;

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${bucketKey}`;
  const auth = { Authorization: `Bearer ${cfg.token}` };

  try {
    const incrRes = await fetch(`${cfg.url}/incr/${encodeURIComponent(redisKey)}`, {
      headers: auth,
    });
    if (!incrRes.ok) {
      console.warn('[rateLimit] Upstash INCR HTTP', incrRes.status);
      return null;
    }
    const incrData = await incrRes.json();
    const count = Number(incrData?.result);
    if (!Number.isFinite(count)) return null;

    if (count === 1) {
      await fetch(`${cfg.url}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
        headers: auth,
      });
    }

    return count;
  } catch (err) {
    console.warn('[rateLimit] Upstash 不可用，回退内存限流:', err?.message || err);
    return null;
  }
}

/**
 * @returns {Promise<void>}
 * @throws {{ status: 429, message: string }}
 */
export async function assertRateLimit(req, {
  key = 'global',
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
} = {}) {
  const ip = getClientIp(req);
  const bucketKey = `${key}:${ip}`;

  const remoteCount = await upstashIncr(bucketKey, windowMs);
  if (remoteCount != null) {
    if (remoteCount > max) {
      const retrySec = Math.max(1, Math.ceil(windowMs / 1000));
      throw Object.assign(new Error(`请求过于频繁，请 ${retrySec} 秒后重试`), { status: 429 });
    }
    return;
  }

  assertMemoryRateLimit(bucketKey, windowMs, max);
}
