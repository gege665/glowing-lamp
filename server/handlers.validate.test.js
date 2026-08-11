import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleChat } from './handlers.js';

describe('validateChatBody · 总量限制', () => {
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    AIYIWEI_API_KEY: process.env.AIYIWEI_API_KEY,
    API_ACCESS_TOKEN: process.env.API_ACCESS_TOKEN,
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.AIYIWEI_API_KEY = 'sk-test';
    delete process.env.API_ACCESS_TOKEN;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(envSnapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('合计超长对话拒绝', async () => {
    const chunk = 'a'.repeat(40_000);
    const req = {
      headers: {},
      body: {
        provider: 'aiyiwei',
        apiKey: 'sk-user',
        messages: [
          { role: 'system', content: chunk },
          { role: 'user', content: chunk },
          { role: 'assistant', content: chunk },
          { role: 'user', content: chunk },
        ],
      },
    };
    await expect(handleChat(req)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/过长/),
    });
  });
});
