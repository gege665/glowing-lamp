import { describe, expect, it } from 'vitest';
import { track } from './analytics';

describe('track', () => {
  it('is a no-op safe call under vitest MODE=test', () => {
    expect(() => track('generate_start', { path: 'test' })).not.toThrow();
  });
});
