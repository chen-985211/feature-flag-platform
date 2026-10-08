import { describe, expect, it, vi } from 'vitest';
import { HttpHealthGateway } from '../../src/platform/health/infrastructure/http-health-gateway';
describe('health HTTP contract', () => {
  it('consumes the ready response and forwards the AbortSignal', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: 'ready' }));
    const signal = new AbortController().signal;
    await expect(
      new HttpHealthGateway(request).readiness(signal),
    ).resolves.toEqual({ status: 'ready' });
    expect(request).toHaveBeenCalledExactlyOnceWith('/health/ready', {
      signal,
      headers: { Accept: 'application/json' },
    });
  });
  it('consumes the stable 503 error without exposing its message', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'SERVICE_NOT_READY',
            request_id: 'r-503',
            message: 'private database details',
          },
        },
        { status: 503 },
      ),
    );
    await expect(new HttpHealthGateway(request).readiness()).resolves.toEqual({
      status: 'unavailable',
      requestId: 'r-503',
    });
  });
  it.each([
    [200, { status: 'unknown' }],
    [200, null],
    [503, { error: { code: 'SERVICE_NOT_READY' } }],
    [500, { error: 'private database details' }],
  ])('rejects an invalid HTTP %s body safely', async (status, body) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(body, { status }));
    await expect(new HttpHealthGateway(request).readiness()).rejects.toThrow(
      '无法读取服务状态',
    );
  });
  it('rejects invalid JSON without leaking the body', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('private database details', { status: 200 }),
      );
    await expect(new HttpHealthGateway(request).readiness()).rejects.toThrow(
      '无法读取服务状态',
    );
  });
  it('preserves an aborted network request', async () => {
    const error = new DOMException('Aborted', 'AbortError');
    const request = vi.fn<typeof fetch>().mockRejectedValue(error);
    await expect(new HttpHealthGateway(request).readiness()).rejects.toBe(
      error,
    );
  });
});
