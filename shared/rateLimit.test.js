import { describe, it, expect, beforeEach } from 'vitest';
import { getClientIp, assertRateLimit } from './rateLimit.js';

describe('getClientIp', () => {
  it('优先 x-vercel-forwarded-for 最左（平台可信）', () => {
    const ip = getClientIp({
      headers: {
        'x-vercel-forwarded-for': '203.0.113.10, 10.0.0.1',
        'x-forwarded-for': '1.2.3.4, 203.0.113.10',
      },
    });
    expect(ip).toBe('203.0.113.10');
  });

  it('无 Vercel 头时用 x-real-ip', () => {
    expect(
      getClientIp({
        headers: { 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1' },
      })
    ).toBe('198.51.100.7');
  });

  it('仅 XFF 时取最右，降低伪造最左收益', () => {
    expect(
      getClientIp({
        headers: { 'x-forwarded-for': ' spoofed.example, 203.0.113.99 ' },
      })
    ).toBe('203.0.113.99');
  });
});

describe('assertRateLimit', () => {
  beforeEach(() => {
    // 每个用例用独立 key，避免跨测试污染
  });

  it('未超限不抛错，超限抛 429', () => {
    const req = { headers: { 'x-real-ip': '203.0.113.50' } };
    const key = `test-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(() => assertRateLimit(req, { key, max: 3, windowMs: 60_000 })).not.toThrow();
    }
    try {
      assertRateLimit(req, { key, max: 3, windowMs: 60_000 });
      expect.fail('should throw');
    } catch (err) {
      expect(err.status).toBe(429);
      expect(String(err.message)).toMatch(/过于频繁/);
    }
  });
});
