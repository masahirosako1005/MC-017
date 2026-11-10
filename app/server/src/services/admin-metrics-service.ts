// 観光協会のダッシュボード（U-09）。K-01 利用者・K-02 再訪率・K-03 次に来る理由を持った割合・K-07 次回クーポンの利用率と、再訪までの5つの段階。
// 期間の終わりは、記録のある最後の日【仮定】（デモの日付送りでも見える）。前の期間は同じ長さの1つ前。
import type { Ctx } from './context.ts';
import { addDays } from '../../../shared/dates.ts';
import type { AdminSummary, CountM, PeriodInfo, RateM } from '../../../shared/admin.ts';
import { AGES, COMPANIONS } from '../../../shared/schemas.ts';
import {
  ageCounts, companionCounts, hasLaterCouponAt, hasPlanAt, midBoardAt, nextVisitCoupons, usersWhoRolled, usersWithTrigger, visitRange, visitsIn,
} from '../repositories/admin-stats-repo.ts';
import { SPOT_IDS } from '../../../shared/master/spots.ts';
import { invitersBySpot, plannersBySpot } from '../repositories/invite-repo.ts';
import { adminToday } from './campaign-service.ts';
import { countM, rateM } from './privacy.ts';

export interface Range { from: string; to: string }

export function periodOf(ctx: Ctx, days: number | null): { info: PeriodInfo; now: Range; prev: Range | null } {
  const vr = visitRange(ctx.db);
  const to = vr.max ?? adminToday(ctx);
  const from = days === null ? (vr.min ?? to) : addDays(to, -(days - 1));
  const prev = days === null ? null : { from: addDays(from, -days), to: addDays(from, -1) };
  return { info: { days, from, to }, now: { from, to }, prev };
}

interface Computed {
  came: number;
  revisitUsers: number;
  reasonDays: number;
  userDays: number;
  coupons: { issued: number; used: number };
  funnel: [number, number, number, number, number];
}

function hasReason(ctx: Ctx, userId: string, day: string): boolean {
  return midBoardAt(ctx.db, userId, day) || hasPlanAt(ctx.db, userId, day) || hasLaterCouponAt(ctx.db, userId, day);
}

function compute(ctx: Ctx, r: Range | null): Computed {
  if (r === null) return { came: 0, revisitUsers: 0, reasonDays: 0, userDays: 0, coupons: { issued: 0, used: 0 }, funnel: [0, 0, 0, 0, 0] };
  const visits = visitsIn(ctx.db, r.from, r.to);
  const came = new Set(visits.map((v) => v.user_id));
  const revisit = new Set(visits.filter((v) => v.kind === 'revisit').map((v) => v.user_id));
  const reasonUsers = new Set<string>();
  let reasonDays = 0;
  for (const v of visits) {
    if (hasReason(ctx, v.user_id, v.day)) {
      reasonDays += 1;
      reasonUsers.add(v.user_id);
    }
  }
  const trig = usersWithTrigger(ctx.db, r.from, r.to);
  const rolled = usersWhoRolled(ctx.db, r.from, r.to);
  // 各段は、前の段を通った人だけを数える
  const s2 = [...came].filter((u) => trig.has(u));
  const s3 = s2.filter((u) => rolled.has(u));
  const s4 = s3.filter((u) => reasonUsers.has(u));
  const s5 = s4.filter((u) => revisit.has(u));
  return {
    came: came.size,
    revisitUsers: revisit.size,
    reasonDays,
    userDays: visits.length,
    coupons: nextVisitCoupons(ctx.db, r.from, r.to),
    funnel: [came.size, s2.length, s3.length, s4.length, s5.length],
  };
}

function rates(c: Computed): { k01: CountM; k02: RateM; k03: RateM; k07: RateM } {
  return {
    k01: countM(c.came),
    k02: rateM(c.revisitUsers, c.came),
    k03: rateM(c.reasonDays, c.userDays),
    k07: rateM(c.coupons.used, c.coupons.issued),
  };
}

const DAY_MS = 86_400_000;
const dayNo = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** 『いつ来ているか』（週・曜日）は、人数が少なくてもそのまま出す（ユーザー指定 2026-11-10。個人を特定する列を含まない集計のため）【仮定】。年代・誰とは5人未満を隠す（countM） */
const shown = (n: number): CountM => ({ value: n, hidden: false });

function trends(ctx: Ctx, r: Range): Pick<AdminSummary, 'weekly' | 'weekdays' | 'ages' | 'companions'> {
  const visits = visitsIn(ctx.db, r.from, r.to);
  const start = dayNo(r.from);
  const weeks = Math.floor((dayNo(r.to) - start) / 7) + 1;
  const users = Array.from({ length: weeks }, () => new Set<string>());
  const revisitors = Array.from({ length: weeks }, () => new Set<string>());
  const perDow = [0, 0, 0, 0, 0, 0, 0];
  for (const v of visits) {
    const w = Math.floor((dayNo(v.day) - start) / 7);
    users[w]?.add(v.user_id);
    if (v.kind === 'revisit') revisitors[w]?.add(v.user_id);
    const d = new Date(Date.parse(`${v.day}T00:00:00Z`)).getUTCDay();
    perDow[d] = (perDow[d] ?? 0) + 1;
  }
  const ageRows = ageCounts(ctx.db, r.from, r.to);
  const compRows = companionCounts(ctx.db, r.from, r.to);
  return {
    weekly: users.map((u, i) => ({
      from: addDays(r.from, i * 7),
      to: addDays(r.from, Math.min(i * 7 + 6, dayNo(r.to) - start)),
      users: shown(u.size),
      revisitors: shown(revisitors[i]?.size ?? 0),
    })),
    weekdays: perDow.map((n, dow) => ({ dow, visits: shown(n) })),
    ages: [...AGES, null].map((age) => ({ age, users: countM(ageRows.find((a) => a.age === age)?.n ?? 0) })),
    companions: [...COMPANIONS, null].map((companion) => ({ companion, users: countM(compRows.find((a) => a.companion === companion)?.n ?? 0) })),
  };
}

/** スポットごとの次回再訪の予定（予定を入れた人・LINE で誘った人）。5人未満は隠す */
function spotPlans(ctx: Ctx, r: Range): AdminSummary['spotPlans'] {
  const planners = new Map(plannersBySpot(ctx.db, r.from, r.to).map((x) => [x.spot_id, x.n]));
  const inviters = new Map(invitersBySpot(ctx.db, r.from, r.to).map((x) => [x.spot_id, x.n]));
  return SPOT_IDS.map((spotId) => ({
    spotId,
    planners: countM(planners.get(spotId) ?? 0),
    inviters: countM(inviters.get(spotId) ?? 0),
  }));
}

export const INSIGHT_DROP_POINTS = 5;

export function summaryOf(ctx: Ctx, days: number | null): AdminSummary {
  const p = periodOf(ctx, days);
  const a = compute(ctx, p.now);
  const b = compute(ctx, p.prev);
  const ra = rates(a);
  const rb = rates(b);
  const keys = ['came', 'trigger', 'rolled', 'reason', 'revisit'] as const;
  let insight: AdminSummary['insight'] = null;
  const drop = ra.k03.percent !== null && rb.k03.percent !== null ? rb.k03.percent - ra.k03.percent : 0;
  if (drop >= INSIGHT_DROP_POINTS && p.prev !== null) {
    const n = Math.round(drop * 10) / 10;
    insight = {
      id: 'I-01',
      text: `「次に来る理由」を持って帰った人の割合が、前の期間より ${n} ポイント下がっています（${rb.k03.percent}% → ${ra.k03.percent}%）。` +
        '次に行く予定を入れてもらう案内や、盤の特典マスを見直してみてください。',
    };
  }
  return {
    period: p.info,
    k01: { now: ra.k01, prev: rb.k01 },
    k02: { now: ra.k02, prev: rb.k02 },
    k03: { now: ra.k03, prev: rb.k03 },
    k07: { now: ra.k07, prev: rb.k07 },
    funnel: keys.map((key, i) => ({ key, count: countM(a.funnel[i] ?? 0) })),
    ...trends(ctx, p.now),
    spotPlans: spotPlans(ctx, p.now),
    insight,
  };
}
