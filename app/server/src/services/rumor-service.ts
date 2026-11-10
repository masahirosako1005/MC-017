// うわさ（R-027、データ設計 §4.3・§5）。CSV の20日間をアプリ内の今日の前に繰り返し並べ、「昨日」はアプリ内の昨日に当たる CSV の日。
import type { Ctx } from './context.ts';
import { appNow } from './context.ts';
import { addDays, diffDays } from '../../../shared/dates.ts';
import type { SpotId } from '../../../shared/master/spots.ts';
import type { Rank, Rumors } from '../../../shared/schemas.ts';
import { notFound } from '../http/errors.ts';
import { csvDays, hourCounts, topByAge, topByCompanion, topByDay, type RankRow } from '../repositories/rumor-repo.ts';
import { findUser } from '../repositories/user-repo.ts';

const TOP = 3;
const OPEN_FROM = 9;
const OPEN_TO = 17;
const EPOCH = '2026-01-01';
export const DEFAULT_QUIET_SPOT: SpotId = 's1';

const ranks = (rows: RankRow[]): Rank[] => rows.map((r) => ({ spotId: r.spot_id, people: r.n }));

/** アプリ内の日 d に当たる CSV の日 */
export function csvDayFor(days: readonly string[], appDay: string): string | null {
  if (days.length === 0) return null;
  const i = ((diffDays(EPOCH, appDay) % days.length) + days.length) % days.length;
  return days[i] ?? null;
}

export function getRumors(ctx: Ctx, userId: string, spot: SpotId | undefined): Rumors {
  const user = findUser(ctx.db, userId);
  if (!user) throw notFound();
  const today = appNow(ctx, user).day;
  const yesterday = csvDayFor(csvDays(ctx.db), addDays(today, -1));
  const quietSpot = spot ?? DEFAULT_QUIET_SPOT;
  const counts = new Map(hourCounts(ctx.db, quietSpot, OPEN_FROM, OPEN_TO).map((r) => [r.hour, r.n]));
  const max = Math.max(0, ...counts.values());
  const hours = Array.from({ length: OPEN_TO - OPEN_FROM + 1 }, (_, i) => {
    const hour = OPEN_FROM + i;
    const count = counts.get(hour) ?? 0;
    return { hour, count, quiet: max > 0 && count < max / 2 };
  });
  return {
    yesterday: yesterday === null ? [] : ranks(topByDay(ctx.db, yesterday, TOP)),
    month: ranks(topByDay(ctx.db, null, TOP)),
    sameAge: user.age === null ? null : ranks(topByAge(ctx.db, user.age, TOP)),
    sameCompanion: user.companion === null ? null : ranks(topByCompanion(ctx.db, user.companion, TOP)),
    quiet: { spotId: quietSpot, hours },
  };
}
