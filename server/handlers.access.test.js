import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isClientBringYourOwnKey,
  isValidApiAccessToken,
  assertProductionApiAccess,
} from './handlers.js';

describe('isClientBringYourOwnKey', () => {
  it('openrouter 仅认可 sk-or- / gsk_ 为真实 BYOK', () => {
    expect(isClientBringYourOwnKey('openrouter', 'x')).toBe(false);
    expect(isClientBringYourOwnKey('openrouter', 'sk-abc')).toBe(false);
    expect(isClientBringYourOwnKey('openrouter', 'sk-or-v1-test')).toBe(true);
    expect(isClientBringYourOwnKey('openrouter', 'gsk_test')).toBe(true);
  });

  it('aiyiwei/juhe 非空 key 视为 BYOK', () => {
    expect(isClientBringYourOwnKey('aiyiwei', 'sk-test')).toBe(true);
    expect(isClientBringYourOwnKey('juhe', 'sk-test')).toBe(true);
    expect(isClientBringYourOwnKey('aiyiwei', '')).toBe(false);
  });
});

describe('isValidApiAccessToken', () => {
  const prev = process.env.API_ACCESS_TOKEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.API_ACCESS_TOKEN;
    else process.env.API_ACCESS_TOKEN = prev;
  });

  it('未配置时一律无效', () => {
    delete process.env.API_ACCESS_TOKEN;
    expect(isValidApiAccessToken('anything')).toBe(false);
  });

  it('匹配时有效，错误/空无效', () => {
    process.env.API_ACCESS_TOKEN = 'secret-token-abc';
    expect(isValidApiAccessToken('secret-token-abc')).toBe(true);
    expect(isValidApiAccessToken('wrong')).toBe(false);
    expect(isValidApiAccessToken('')).toBe(false);
  });
});

describe('assertProductionApiAccess · 令牌强制模式', () => {
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    API_ACCESS_TOKEN: process.env.API_ACCESS_TOKEN,
    AIYIWEI_API_KEY: process.env.AIYIWEI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SITE_URL: process.env.SITE_URL,
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.AIYIWEI_API_KEY = 'sk-server-key';
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-server-key';
    process.env.SITE_URL = 'https://glowing-lamp-two.vercel.app';
    process.env.API_ACCESS_TOKEN = 'prod-access-token';
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(envSnapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('伪造 Origin 且无令牌 → 403', () => {
    const req = {
      headers: { origin: 'https://glowing-lamp-two.vercel.app' },
    };
    expect(() => assertProductionApiAccess(req, 'aiyiwei', { apiKey: '' })).toThrow(/访问令牌/);
  });

  it('正确令牌 → 放行', () => {
    const req = {
      headers: { 'x-api-access-token': 'prod-access-token' },
    };
    expect(() => assertProductionApiAccess(req, 'aiyiwei', { apiKey: '' })).not.toThrow();
  });

  it('真实 BYOK 无需令牌', () => {
    const req = { headers: {} };
    expect(() =>
      assertProductionApiAccess(req, 'aiyiwei', { apiKey: 'sk-user-own-key' })
    ).not.toThrow();
  });

  it('openrouter 假 key 不能冒充 BYOK，仍需令牌', () => {
    const req = {
      headers: { origin: 'https://glowing-lamp-two.vercel.app' },
    };
    expect(() => assertProductionApiAccess(req, 'openrouter', { apiKey: 'x' })).toThrow(
      /访问令牌/
    );
  });
});
