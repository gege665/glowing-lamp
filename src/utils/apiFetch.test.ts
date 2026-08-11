import { describe, it, expect, vi, afterEach } from 'vitest';
import { withApiAccessHeaders, getApiAccessToken } from './apiFetch';

describe('apiFetch headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('无令牌时不注入头', () => {
    vi.stubEnv('VITE_API_ACCESS_TOKEN', '');
    const headers = withApiAccessHeaders({ 'Content-Type': 'application/json' });
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('x-api-access-token')).toBeNull();
    expect(getApiAccessToken()).toBe('');
  });

  it('有令牌时自动附带，且不覆盖显式头', () => {
    vi.stubEnv('VITE_API_ACCESS_TOKEN', 'front-token');
    const auto = withApiAccessHeaders({ 'Content-Type': 'application/json' });
    expect(auto.get('x-api-access-token')).toBe('front-token');

    const kept = withApiAccessHeaders({
      'Content-Type': 'application/json',
      'x-api-access-token': 'explicit',
    });
    expect(kept.get('x-api-access-token')).toBe('explicit');
  });
});
