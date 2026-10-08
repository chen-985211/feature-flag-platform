import { describe, it, expect } from 'vitest';
import { validExpected } from '../../src/contexts/flags/domain/editing';
describe('rule input feedback', () => {
  it.each([
    ['"cn"', 'equals', true],
    ['9007199254740993', 'equals', true],
    ['true', 'equals', true],
    ['[1,2]', 'in', true],
    ['[1,"2"]', 'in', false],
    ['[]', 'in', false],
    ['null', 'equals', false],
    ['{}', 'equals', false],
    ['invalid', 'equals', false],
  ] as const)('validates %s/%s without changing raw text', (raw, op, want) =>
    expect(validExpected(raw, op)).toBe(want),
  );
});
