// 日付（YYYY-MM-DD）の計算。日本時間の「今日」はブラウザの時計から出す（サーバーの時計と違うときは、サーバーが 400 で知らせる）。
const DAY_MS = 86_400_000;
const JST_OFFSET_MS = 9 * 3_600_000;

function toMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  return new Date(toMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

export function todayJst(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 終了日 − 開始日（日数）。日付として読めないときは null */
export function spanDays(starts: string, ends: string): number | null {
  const a = toMs(starts);
  const b = toMs(ends);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
}
