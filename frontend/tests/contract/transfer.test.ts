import { it, expect, vi } from 'vitest';
import { HttpFlags } from '../../src/contexts/flags/infrastructure/http-flags';
import { HttpClient } from '../../src/platform/http/client';
const source = {
  id: 'source',
  name: 'Fixed',
  key: 'key',
  environment: 'development',
  seed: 'seed',
  revision: 4,
  enabled: true,
  default_value: false,
  rules: [],
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
};
const target = { ...source, id: 'target', environment: 'staging', revision: 7 };
it('sends complete order and fixed-source transfer commands', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ ...source, revision: 5 }))
    .mockResolvedValueOnce(Response.json({ ...target, revision: 1 }))
    .mockResolvedValueOnce(
      Response.json({
        source_revision: 4,
        target_revision: 7,
        source,
        target,
        changes: [],
      }),
    )
    .mockResolvedValueOnce(Response.json({ ...target, revision: 8 }));
  const gateway = new HttpFlags(new HttpClient(request));
  expect((await gateway.reorder('source', ['a', 'b'], 4)).revision).toBe(5);
  expect((await gateway.copy('source', 4, 'staging')).id).toBe('target');
  const preview = await gateway.publication('source', 4, 'staging');
  expect(preview.target_revision).toBe(7);
  expect(
    (
      await gateway.publish(
        'source',
        4,
        preview.target.id,
        preview.target_revision,
      )
    ).revision,
  ).toBe(8);
  expect(request.mock.calls.map((call) => call[1]?.body)).toEqual([
    '{"rule_ids":["a","b"],"expected_revision":4}',
    '{"source_revision":4,"target_environment":"staging"}',
    undefined,
    '{"source_revision":4,"target_id":"target","expected_revision":7}',
  ]);
  expect(request.mock.calls[2][0]).toBe(
    '/api/flags/source/versions/4/publication?target_environment=staging',
  );
});
it.each([
  { ...target, revision: 6 },
  { ...target, environment: 'development' },
  { ...target, key: 'other' },
])('rejects inconsistent publication target', async (badTarget) => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      source_revision: 4,
      target_revision: 7,
      source,
      target: badTarget,
      changes: [],
    }),
  );
  await expect(
    new HttpFlags(new HttpClient(request)).publication('source', 4, 'staging'),
  ).rejects.toThrow();
});
