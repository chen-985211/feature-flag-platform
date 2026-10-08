import { describe, expect, it, vi } from 'vitest';
import { createCheckReadiness } from '../../src/platform/health/application/check-readiness';
describe('check readiness', () => {
  it('returns the gateway result and forwards cancellation', async () => {
    const result = { status: 'unavailable' as const, requestId: 'request-1' };
    const readiness = vi.fn().mockResolvedValue(result);
    const signal = new AbortController().signal;
    await expect(createCheckReadiness({ readiness })(signal)).resolves.toEqual(
      result,
    );
    expect(readiness).toHaveBeenCalledExactlyOnceWith(signal);
  });
  it('preserves dependency failures for the presentation layer', async () => {
    const error = new Error('connection failed');
    await expect(
      createCheckReadiness({ readiness: () => Promise.reject(error) })(),
    ).rejects.toBe(error);
  });
});
