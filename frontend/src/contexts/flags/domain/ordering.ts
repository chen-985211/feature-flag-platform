export function moveRule(ids: string[], id: string, to: number): string[] {
  const from = ids.indexOf(id);
  if (
    from < 0 ||
    !Number.isInteger(to) ||
    to < 0 ||
    to >= ids.length ||
    from === to
  )
    return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
