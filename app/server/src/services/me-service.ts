import type { Ctx } from './context.ts';
import { appNow } from './context.ts';
import { BOARD_SIZE } from '../../../shared/board.ts';
import { isoJst, visitKindFor } from '../../../shared/dates.ts';
import type { MeState, ProfileBody, Trigger, VisitKind } from '../../../shared/schemas.ts';
import type { SpotId } from '../../../shared/master/spots.ts';
import { badRequest, notFound } from '../http/errors.ts';
import { ensureExtras, extrasView } from './board-extras-service.ts';
import { countUnseen } from '../repositories/coupon-repo.ts';
import {
  countStamps, findGrant, findVisit, insertGrant, insertVisit, lastVisitBefore, rollsLeft, triggersToday,
} from '../repositories/play-repo.ts';
import { findUser, insertUser, updateProfile, type UserRow } from '../repositories/user-repo.ts';

/** 旅の2日目は +1、再訪は +2（要件定義 §5 の【仮定】） */
export const VISIT_BONUS: Readonly<Record<'day2' | 'revisit', number>> = { day2: 1, revisit: 2 };

function requireUser(ctx: Ctx, id: string): UserRow {
  const u = findUser(ctx.db, id);
  if (!u) throw notFound();
  return u;
}

export function buildMe(ctx: Ctx, userId: string): MeState {
  const u = requireUser(ctx, userId);
  const now = appNow(ctx, u);
  ensureExtras(ctx, u, now.day);
  const visit = findVisit(ctx.db, userId, now.day);
  const kind: VisitKind = visit?.kind ?? 'first';
  const bonusSource = kind === 'day2' || kind === 'revisit' ? kind : null;
  const bonusGrant = bonusSource ? findGrant(ctx.db, userId, now.day, bonusSource) : undefined;
  const doneToday: Partial<Record<SpotId, Trigger[]>> = {};
  for (const g of triggersToday(ctx.db, userId, now.day)) {
    const key = g.spot_key as SpotId;
    (doneToday[key] ??= []).push(g.source as Trigger);
  }
  return {
    id: u.id,
    today: now.day,
    hour: now.hour,
    visitKind: kind,
    bonus: bonusSource && bonusGrant ? { source: bonusSource, amount: bonusGrant.amount } : null,
    profile: { age: u.age, companion: u.companion, stepLess: u.step_less === 1, avatar: u.avatar },
    board: { no: u.board_no, pos: u.pos, size: BOARD_SIZE, extras: extrasView(ctx, userId, u.board_no, now.day) },
    rollsLeft: rollsLeft(ctx.db, userId),
    stamps: countStamps(ctx.db, userId),
    newCoupons: countUnseen(ctx.db, userId),
    doneToday,
    demo: ctx.demoMode ? { offsetDays: u.demo_offset_days, hour: u.demo_hour, location: u.demo_spot } : null,
  };
}

/** 利用の開始。その日の最初なら訪問を記録してボーナスを付ける（R-001・R-005） */
export function startSession(ctx: Ctx, userId: string): MeState {
  ctx.db.transaction(() => {
    insertUser(ctx.db, userId, isoJst(ctx.clock()));
    const u = requireUser(ctx, userId);
    const now = appNow(ctx, u);
    if (findVisit(ctx.db, userId, now.day)) return;
    const kind = visitKindFor(lastVisitBefore(ctx.db, userId, now.day), now.day);
    insertVisit(ctx.db, userId, now.day, kind);
    if (kind === 'day2' || kind === 'revisit') {
      insertGrant(ctx.db, userId, now.day, kind, '-', VISIT_BONUS[kind], now.at);
    }
  })();
  return buildMe(ctx, userId);
}

export function patchProfile(ctx: Ctx, userId: string, body: ProfileBody): MeState {
  const u = requireUser(ctx, userId);
  if (body.avatar !== undefined && !ctx.avatars.has(body.avatar)) throw badRequest();
  updateProfile(ctx.db, userId, {
    age: body.age === undefined ? u.age : body.age,
    companion: body.companion === undefined ? u.companion : body.companion,
    stepLess: body.stepLess ?? u.step_less === 1,
    avatar: body.avatar ?? u.avatar,
  });
  return buildMe(ctx, userId);
}
