import { describe, it, expect } from 'vitest';
import {
  JUHE_API_BASE_URL,
  JUHE_DEFAULT_CHAT_MODEL,
  JUHE_CHAT_COMPLETIONS_URL,
} from './juheApiConfig';
import { JUHE_CHAT_MODEL, JUHE_GPT_CHAT_MODEL } from './modelRouting';

describe('juheApiConfig', () => {
  it('OpenAI 兼容端点', () => {
    expect(JUHE_API_BASE_URL).toBe('https://api.juheapi.com/v1');
    expect(JUHE_CHAT_COMPLETIONS_URL).toContain('/chat/completions');
    expect(JUHE_DEFAULT_CHAT_MODEL).toBe('gpt-5.4-mini');
    expect(JUHE_CHAT_MODEL).toBe(JUHE_GPT_CHAT_MODEL);
  });
});
