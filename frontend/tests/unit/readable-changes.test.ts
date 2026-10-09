import { expect, it } from 'vitest';
import { formatJSON } from '../../src/presentation/components/configuration-language';
import { describeChange } from '../../src/contexts/audit/presentation/change-description';
import type { AuditEntry } from '../../src/contexts/audit/application/contracts';
const a = {
  ID: 'a',
  Priority: 1,
  Attribute: 'tier',
  Operator: 'equals',
  ExpectedJSON: '"blocked"',
  Result: false,
};
const b = {
  ID: 'b',
  Priority: 2,
  Kind: 'percentage',
  PercentageBP: 2500,
  Result: true,
};
const before = {
  SchemaVersion: 1,
  Name: 'Old',
  Key: 'checkout',
  Environment: 'development',
  Enabled: true,
  DefaultValue: false,
  Seed: 'seed',
  Revision: 3,
  Rules: [a, b],
};
const after = { ...before, Revision: 4 };
function describe(action: string, change: unknown) {
  const entry: AuditEntry = {
    id: 'entry',
    flag_id: 'flag',
    action,
    environment: 'development',
    key: 'checkout',
    revision: 4,
    actor_name: 'Admin',
    created_at: '2026-10-09T00:00:00Z',
    changes_json: JSON.stringify(change),
    request_id: 'request',
  };
  return describeChange(entry);
}
it('ignores technical timestamp changes and describes basic values before and after', () => {
  const value = describe('flag_edited', {
    before,
    after: { ...after, Name: 'New', UpdatedAt: 'later' },
  });
  expect(value?.rows).toEqual([{ label: '名称', before: 'Old', after: 'New' }]);
  expect(value?.summary).toBe('名称：Old → New');
  expect(describe('flag_edited', { before, after })?.rows).toEqual([]);
});
it('describes creation, disable and a deleted rule from their stored facts', () => {
  expect(describe('flag_created', { before: null, after })?.summary).toContain(
    '默认 关闭（false）',
  );
  expect(
    describe('flag_enabled', { before, after: { ...after, Enabled: false } })
      ?.summary,
  ).toContain('所有评估均返回 false');
  const deleted = describe('rule_deleted', {
    before,
    after: { ...after, Rules: [a] },
  });
  expect(deleted?.rows).toEqual([
    {
      label: '删除规则',
      before: '优先级 2 · 按 user_id 灰度 25% → 开启（true）',
      after: '已删除',
    },
  ]);
});
it('describes percentage edits and ordering without treating them as recreated entities', () => {
  const edited = describe('rule_edited', {
    before,
    after: {
      ...after,
      Rules: [a, { ...b, PercentageBP: 5000, Result: false }],
    },
  });
  expect(edited?.rows).toHaveLength(1);
  expect(edited?.rows[0].after).toContain('灰度 50% → 关闭（false）');
  const reordered = describe('rules_reordered', {
    before,
    after: {
      ...after,
      Rules: [
        { ...b, Priority: 1 },
        { ...a, Priority: 2 },
      ],
    },
  });
  expect(reordered?.rows).toHaveLength(2);
  expect(reordered?.summary).toContain('优先级 1 百分比灰度 → 优先级 2 tier');
});
it('preserves source and restored revisions while ignoring publication rule ID regeneration', () => {
  const published = describe('flag_published', {
    before,
    after: {
      ...after,
      Rules: [
        { ...a, ID: 'fresh-a' },
        { ...b, ID: 'fresh-b' },
      ],
    },
    source: { environment: 'staging', revision: 8 },
  });
  expect(published?.summary).toContain(
    '发布 staging 的 r8 到 development / checkout，生成 r4',
  );
  expect(published?.rows).toEqual([]);
  expect(
    describe('flag_copied', {
      before: null,
      after,
      source: { environment: 'staging', revision: 8 },
    })?.summary,
  ).toContain('复制 staging 的 r8');
  expect(
    describe('flag_rolled_back', { before, after, restored_revision: 2 })
      ?.summary,
  ).toContain('恢复 r2 的完整配置，生成 r4');
});
it('falls back for unknown versions, malformed data and inconsistent revisions', () => {
  for (const change of [
    { before, after: { ...after, SchemaVersion: 2 } },
    { before, after: { ...after, Revision: 99 } },
    { before, after: { ...after, Rules: [{ ...a, Kind: 'future' }] } },
    { before: { Revision: 3 }, after },
  ])
    expect(describe('flag_edited', change)).toBeNull();
  expect(describe('unknown', { before, after })).toBeNull();
  expect(describe('flag_published', { before, after })).toBeNull();
});
it('formats JSON without rounding numbers or changing string escape content', () => {
  const raw =
    '{"number":9007199254740993,"exponent":1e999,"value":"comma, colon: braces{} and \\"quote\\"","empty":[]}';
  const formatted = formatJSON(raw);
  expect(formatted).toContain('9007199254740993');
  expect(formatted).toContain('1e999');
  expect(formatted).toContain('\\"quote\\"');
  expect(formatted).toContain('"empty": []');
  expect(JSON.parse(formatted)).toEqual(JSON.parse(raw));
  expect(formatJSON('{invalid')).toBe('{invalid');
});
