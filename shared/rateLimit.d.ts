/**
 * @typedef {object} RateLimitOpts
 * @property {string} [key]
 * @property {number} [windowMs]
 * @property {number} [max]
 */

/**
 * @typedef {object} RateLimitTierOpts
 * @property {string} key
 * @property {number} [windowMs]
 * @property {number} [userMax]
 * @property {number} [serverMax]
 */

export function getClientIp(req: { ip?: string; socket?: { remoteAddress?: string }; connection?: { remoteAddress?: string } }): string;

export function hasClientApiKey(body: { apiKey?: unknown } | null | undefined): boolean;

export function buildRateLimitOptions(
  req: { body?: { apiKey?: unknown } } | null | undefined,
  opts: {
    key: string;
    windowMs?: number;
    userMax?: number;
    serverMax?: number;
  }
): { key: string; windowMs: number; max: number };

export function assertRateLimit(
  req: unknown,
  opts?: {
    key?: string;
    windowMs?: number;
    max?: number;
  }
): Promise<void>;
