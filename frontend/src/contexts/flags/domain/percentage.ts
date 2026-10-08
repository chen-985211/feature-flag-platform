export function parsePercentage(text: string): number | null {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const bp = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return bp <= 10000 ? bp : null;
}
export function formatPercentage(bp: number): string {
  const whole = Math.floor(bp / 100),
    fraction = bp % 100;
  return fraction === 0
    ? String(whole)
    : String(whole) + '.' + String(fraction).padStart(2, '0');
}
