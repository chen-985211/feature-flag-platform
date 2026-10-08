import { describe, it, expect } from 'vitest';
import {
  parsePercentage,
  formatPercentage,
} from '../../src/contexts/flags/domain/percentage';
describe('percentage input uses integer basis points', () => {
  it.each([
    ['0', 0],
    ['100', 10000],
    ['100.00', 10000],
    ['0.01', 1],
    ['25.5', 2550],
    ['99.99', 9999],
    ['', null],
    ['100.01', null],
    ['1.001', null],
    ['-1', null],
    ['1e2', null],
    ['abc', null],
  ] as const)('%s → %s', (text, want) =>
    expect(parsePercentage(text)).toBe(want),
  );
  it.each([
    [0, '0'],
    [1, '0.01'],
    [2550, '25.50'],
    [10000, '100'],
  ] as const)('formats %s as %s', (bp, want) =>
    expect(formatPercentage(bp)).toBe(want),
  );
});
