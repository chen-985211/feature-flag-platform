import { describe, it, expect, vi } from 'vitest';
import { HttpFlags } from '../../src/contexts/flags/infrastructure/http-flags';
import { HttpClient } from '../../src/platform/http/client';
const flag = {
  id: 'id',
  name: 'Checkout',
  key: 'checkout',
  environment: 'development',
  enabled: true,
  default_value: false,
  seed: 'seed',
  revision: 1,
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
  rules: [
    {
      id: 'r',
      kind: 'attribute',
      attribute: 'tier',
      operator: 'equals',
      expected: 9007199254740992,
      expected_json: '9007199254740993',
      priority: 1,
      result: false,
    },
  ],
};
describe('Flags HTTP consumer', () => {
  it('preserves the authoritative raw expected number', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(flag));
    const got = await new HttpFlags(new HttpClient(request)).get('id');
    expect(got.rules[0].kind).toBe('attribute');
    if (got.rules[0].kind !== 'attribute')
      throw new Error('expected attribute rule');
    expect(got.rules[0].expected_json).toBe('9007199254740993');
  });
  it('sends raw rule JSON without Number rounding', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(flag));
    const client = new HttpClient(request);
    client.setCSRF('csrf');
    await new HttpFlags(client).saveRule('id', undefined, {
      attribute: 'tier',
      operator: 'equals',
      expectedJSON: '9007199254740993',
      priority: 1,
      result: false,
      expected_revision: 1,
    });
    expect(request.mock.calls[0][1]?.body).toContain(
      '"expected":9007199254740993',
    );
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      'X-CSRF-Token': 'csrf',
    });
  });
  it.each([
    null,
    { ...flag, revision: '1' },
    { ...flag, rules: [{ ...flag.rules[0], expected_json: 1 }] },
    { ...flag, environment: 'unknown' },
  ])('rejects incompatible snapshots', async (body) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(body));
    await expect(
      new HttpFlags(new HttpClient(request)).get('id'),
    ).rejects.toThrow();
  });
  it('maps a conflict by code without leaking server diagnostics', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'VERSION_CONFLICT',
            request_id: 'r1',
            message: 'secret SQL',
          },
        },
        { status: 409 },
      ),
    );
    await expect(
      new HttpClient(request).request('/api/flags'),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', requestID: 'r1' });
    await expect(
      new HttpClient(request).request('/api/flags'),
    ).rejects.not.toThrow('secret SQL');
  });
});
