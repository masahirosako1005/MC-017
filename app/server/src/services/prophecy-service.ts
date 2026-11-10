// 予言（R-030〜R-033、ADR-010）。作る・答え合わせ・答え・かしこさ。
import type { Ctx, AppNow } from './context.ts';
import { appNow, once } from './context.ts';
import { LEARN_STEP, clampWeight, levelOf, rankProphecy } from '../../../shared/prophecy.ts';
import { spotById, type SpotId } from '../../../shared/master/spots.ts';
import type { Answer, Prophecy, ProphecyState, Reason } from '../../../shared/schemas.ts';
import { conflict, notFound } from '../http/errors.ts';
import { findVisit, insertGrant } from '../repositories/play-repo.ts';
import {
  findAwaiting, findOpen, findProphecy, insertProphecy, listProphecies, markVisited, setAnswer, setTagWeight,
  similarShare, stampHours, tagWeights, visitedSpots, type ProphecyRow,
} from '../repositories/prophecy-repo.ts';
import { findUser, type UserRow } from '../repositories/user-repo.ts';

/** 答え合わせのごほうび（QR の +1 とは別） */
export const PROPHECY_BONUS = 2;

type Other = { spotId: SpotId; reason: Reason | null };

function toProphecy(r: ProphecyRow): Prophecy {
  return {
    id: r.id, spotId: r.spot_id, season: r.season, timeBand: r.time_band,
    reasons: JSON.parse(r.reasons) as Reason[], status: r.status, answer: r.answer, createdDay: r.created_day,
  };
}

function requireUser(ctx: Ctx, userId: string): UserRow {
  const u = findUser(ctx.db, userId);
  if (!u) throw notFound();
  return u;
}

/** open の予言が無く、スタンプが1つ以上なら作る */
function ensureOpen(ctx: Ctx, u: UserRow, now: AppNow): void {
  if (findOpen(ctx.db, u.id)) return;
  const visited = visitedSpots(ctx.db, u.id);
  if (visited.length === 0) return;
  const ranked = rankProphecy({
    visited,
    stepLess: u.step_less === 1,
    today: now.day,
    weights: tagWeights(ctx.db, u.id),
    similar: similarShare(ctx.db, visited, u.age, u.companion),
    hours: stampHours(ctx.db, u.id),
  });
  const [top, ...rest] = ranked;
  if (!top) return;
  const others: Other[] = rest.slice(0, 2).map((s) => ({ spotId: s.spotId, reason: s.reasons[0] ?? null }));
  insertProphecy(ctx.db, u.id, { spotId: top.spotId, season: top.season, timeBand: top.timeBand, reasons: top.reasons, others, day: now.day });
}

function buildState(ctx: Ctx, userId: string): ProphecyState {
  const rows = listProphecies(ctx.db, userId);
  const current = findAwaiting(ctx.db, userId) ?? findOpen(ctx.db, userId) ?? null;
  const checks = rows.filter((r) => r.status === 'visited').length;
  return {
    current: current ? toProphecy(current) : null,
    canProphesy: visitedSpots(ctx.db, userId).length > 0,
    level: levelOf(checks),
    checks,
    liked: rows.filter((r) => r.answer === 'liked').length,
    normal: rows.filter((r) => r.answer === 'normal').length,
    history: rows.map((r) => ({ id: r.id, spotId: r.spot_id, season: r.season, answer: r.answer, status: r.status })),
    others: current ? (JSON.parse(current.others) as Other[]) : [],
  };
}

export function getProphecy(ctx: Ctx, userId: string): ProphecyState {
  return ctx.db.transaction(() => {
    const u = requireUser(ctx, userId);
    ensureOpen(ctx, u, appNow(ctx, u));
    return buildState(ctx, userId);
  })();
}

/**
 * QR の中で呼ぶ（呼び出し側のトランザクションの中）。再訪の日に、予言のスポットで、予言を作った日より後なら答え合わせ。
 * 旅の2日目・別のスポット・作った日と同じ日は答え合わせにしない（AC-040）
 */
export function checkOnQr(ctx: Ctx, userId: string, spotId: SpotId, now: AppNow): { prophecyId: number } | null {
  const open = findOpen(ctx.db, userId);
  if (!open || open.spot_id !== spotId || open.created_day >= now.day) return null;
  if (findVisit(ctx.db, userId, now.day)?.kind !== 'revisit') return null;
  markVisited(ctx.db, open.id, now.day);
  insertGrant(ctx.db, userId, now.day, 'prophecy', String(open.id), PROPHECY_BONUS, now.at);
  return { prophecyId: open.id };
}

/** 「気に入った？」の答え（R-032）。ごほうびは変えず、タグの重みを直す。1つの予言に1回（あとで は答え直せる） */
export function answerProphecy(ctx: Ctx, userId: string, prophecyId: number, requestId: string, answer: Answer): ProphecyState {
  const u = requireUser(ctx, userId);
  const now = appNow(ctx, u);
  return once(ctx, userId, requestId, 'answer', now.at, () => {
    const p = findProphecy(ctx.db, userId, prophecyId);
    if (!p) throw notFound();
    if (p.status !== 'visited' || (p.answer !== null && p.answer !== 'later')) throw conflict();
    setAnswer(ctx.db, p.id, answer);
    if (answer !== 'later') {
      const delta = answer === 'liked' ? LEARN_STEP : -LEARN_STEP;
      const weights = tagWeights(ctx.db, userId);
      for (const tag of spotById(p.spot_id).tags) setTagWeight(ctx.db, userId, tag, clampWeight((weights[tag] ?? 0) + delta));
    }
    ensureOpen(ctx, u, now);
    return buildState(ctx, userId);
  });
}
