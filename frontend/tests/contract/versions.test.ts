import { it, expect, vi } from 'vitest';
import { HttpFlags } from '../../src/contexts/flags/infrastructure/http-flags';
import { HttpClient } from '../../src/platform/http/client';
const percentage = {
  id: 'p',
  priority: 1,
  kind: 'percentage',
  percentage_bp: 10000,
  attribute: '',
  operator: '',
  expected_json: '',
  expected: null,
  result: false,
};
const flag = {
  id: 'id',
  name: 'Flag',
  key: 'key',
  environment: 'development',
  enabled: true,
  default_value: false,
  seed: 'seed',
  revision: 2,
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
  rules: [percentage],
};
it('consumes percentage snapshots', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(flag));
  const got = await new HttpFlags(new HttpClient(request)).get('id');
  expect(got.rules[0]).toMatchObject({
    kind: 'percentage',
    percentage_bp: 10000,
    result: false,
  });
});
it.each([
  { ...percentage, percentage_bp: 10001 },
  { ...percentage, percentage_bp: 1.5 },
  { ...percentage, percentage_bp: null },
])('rejects malformed percentage rules', async (rule) => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ...flag, rules: [rule] }));
  await expect(
    new HttpFlags(new HttpClient(request)).get('id'),
  ).rejects.toThrow();
});

it('consumes a revision-bound preview and sends its expected revision', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        current_revision: 4,
        source_revision: 2,
        source: flag,
        changes: [
          { field: 'enabled', before_json: 'false', after_json: 'true' },
          {
            field: 'rules',
            before_json: '[]',
            after_json: JSON.stringify([percentage]),
          },
        ],
      }),
    )
    .mockResolvedValueOnce(Response.json({ ...flag, revision: 5 }));
  const gateway = new HttpFlags(new HttpClient(request));
  const preview = await gateway.preview('id', 2);
  expect(preview.current_revision).toBe(4);
  expect(preview.source.revision).toBe(2);
  expect(JSON.parse(preview.changes[1].after_json)).toEqual([percentage]);
  await gateway.rollback(
    'id',
    preview.source_revision,
    preview.current_revision,
  );
  expect(request.mock.calls[1][1]?.body).toBe(
    '{"source_revision":2,"expected_revision":4}',
  );
});

it('rejects percentage diffs that introduce an attribute expected value', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      current_revision: 4,
      source_revision: 2,
      source: flag,
      changes: [
        {
          field: 'rules',
          before_json: '[]',
          after_json: JSON.stringify([
            { ...percentage, expected_json: 'null' },
          ]),
        },
      ],
    }),
  );
  await expect(
    new HttpFlags(new HttpClient(request)).preview('id', 2),
  ).rejects.toThrow();
});
