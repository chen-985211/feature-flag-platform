import { it, expect } from 'vitest';
import { moveRule } from '../../src/contexts/flags/domain/ordering';
it.each([
  ['b', 0, ['b', 'a', 'c']],
  ['a', 2, ['b', 'c', 'a']],
  ['c', 1, ['a', 'c', 'b']],
])('moves a rule and keeps a complete sequence', (id, to, expected) => {
  const original = ['a', 'b', 'c'];
  expect(moveRule(original, id, to)).toEqual(expected);
  expect(original).toEqual(['a', 'b', 'c']);
});
it.each([
  ['missing', 0],
  ['a', -1],
  ['a', 3],
  ['a', 0],
])('keeps invalid or unchanged moves stable', (id, to) => {
  expect(moveRule(['a', 'b', 'c'], id, to)).toEqual(['a', 'b', 'c']);
});
