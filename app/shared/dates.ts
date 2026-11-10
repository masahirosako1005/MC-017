import type { Season } from './master/spots.ts';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 実際の時刻を JST の日付と時に直す（夏時間なしの UTC+9 固定） */
export function toJst(date: Date): { day: string; hour: number } {
  const j = new Date(date.getTime() + JST_OFFSET_MS);
  return { day: j.toISOString().slice(0, 10), hour: j.getUTCHours() };
}

/** JST の ISO 8601（`+09:00` 付き） */
export function isoJst(date: Date): string {
  const j = new Date(date.getTime() + JST_OFFSET_MS);
  return `${j.toISOString().slice(0, 19)}+09:00`;
}

function dayToUtc(day: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`bad day ${day}`);
  return ms;
}

export function addDays(day: string, n: number): string {
  return new Date(dayToUtc(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/** b − a の日数 */
export function diffDays(a: string, b: string): number {
  return Math.round((dayToUtc(b) - dayToUtc(a)) / DAY_MS);
}

export function seasonOf(day: string): Season {
  const m = Number(day.slice(5, 7));
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

export function nextSeason(s: Season): Season {
  const order: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
  return order[(order.indexOf(s) + 1) % 4] ?? 'spring';
}

/** 前回の利用日からの日数で訪問の種類を決める（R-005）。前回が無ければ first */
export function visitKindFor(lastDay: string | null, today: string): 'first' | 'day2' | 'revisit' {
  if (lastDay === null) return 'first';
  const d = diffDays(lastDay, today);
  if (d >= 7) return 'revisit';
  if (d >= 1) return 'day2';
  return 'first';
}
