import { describe, expect, it } from 'vitest';
import {
  getTransportBackoffMs,
  MAX_CLIENT_TRANSPORT_RETRIES,
  TRANSPORT_BACKOFF_BASE_MS,
} from './retryPolicy';

describe('retryPolicy', () => {
  it('keeps the client retry budget short', () => {
    expect(MAX_CLIENT_TRANSPORT_RETRIES).toBe(1);
    expect(TRANSPORT_BACKOFF_BASE_MS).toBe(800);
    expect(getTransportBackoffMs(0)).toBe(800);
  });
});
