function scalar(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}
export function validExpected(raw: string, operator: 'equals' | 'in'): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    if (operator === 'equals') return scalar(value);
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 100 &&
      value.every(
        (item: unknown) => scalar(item) && typeof item === typeof value[0],
      )
    );
  } catch {
    return false;
  }
}
