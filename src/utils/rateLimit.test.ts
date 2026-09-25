import { describe, expect, it } from 'vitest';
import { hasClientApiKey, buildRateLimitOptions } from '../../shared/rateLimit.js';

describe('rateLimit helpers', () => {
  it('detects client api key', () => {
    expect(hasClientApiKey({ apiKey: ' sk-test ' })).toBe(true);
    expect(hasClientApiKey({ apiKey: '' })).toBe(false);
    expect(hasClientApiKey({})).toBe(false);
  });

  it('tightens max when using server key', () => {
    const user = buildRateLimitOptions({ body: { apiKey: 'sk-x' } }, {
      key: 'chat',
      userMax: 36,
      serverMax: 16,
    });
    expect(user).toEqual({ key: 'chat:user', windowMs: 60_000, max: 36 });

    const server = buildRateLimitOptions({ body: {} }, {
      key: 'chat',
      userMax: 36,
      serverMax: 16,
    });
    expect(server).toEqual({ key: 'chat:server', windowMs: 60_000, max: 16 });
  });
});
