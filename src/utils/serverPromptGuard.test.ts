import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVER_SYSTEM_GUARD,
  injectServerSystemGuard,
} from '../../shared/serverPromptGuard.js';

describe('injectServerSystemGuard', () => {
  it('prepends guard to existing system message', () => {
    const out = injectServerSystemGuard([
      { role: 'system', content: 'client rules' },
      { role: 'user', content: 'hi' },
    ]);
    expect(out[0].content).toContain('【服务端强制】');
    expect(out[0].content).toContain('client rules');
    expect(out[0].content.startsWith(DEFAULT_SERVER_SYSTEM_GUARD.slice(0, 8))).toBe(true);
  });

  it('inserts system message when missing', () => {
    const out = injectServerSystemGuard([{ role: 'user', content: 'hi' }]);
    expect(out[0].role).toBe('system');
    expect(out[1].content).toBe('hi');
  });

  it('does not double-inject', () => {
    const once = injectServerSystemGuard([{ role: 'system', content: 'x' }]);
    const twice = injectServerSystemGuard(once);
    expect(twice[0].content).toBe(once[0].content);
  });
});
