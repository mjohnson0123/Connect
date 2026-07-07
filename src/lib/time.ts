export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "1h 24m" style countdown; clamps at zero. */
export function formatRemaining(untilMs: number, nowMs = Date.now()): string {
  const totalMinutes = Math.ceil(Math.max(0, untilMs - nowMs) / MINUTE);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function formatDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.length === 7) return 'Daily';
  return sorted.map((d) => DAY_LABELS[d]).join(' ');
}
