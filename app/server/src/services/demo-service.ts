// DEMO_MODE=1 のときだけ route が登録される（ADR-008）
import type { Ctx } from './context.ts';
import { appNow, once } from './context.ts';
import { buildMe } from './me-service.ts';
import type { MeState } from '../../../shared/schemas.ts';
import type { SpotId } from '../../../shared/master/spots.ts';
import { notFound } from '../http/errors.ts';
import { insertGrant } from '../repositories/play-repo.ts';
import { findUser, resetToStart, updateDemoClock, updateDemoSpot } from '../repositories/user-repo.ts';

function ensure(ctx: Ctx, userId: string) {
  const u = findUser(ctx.db, userId);
  if (!u || !ctx.demoMode) throw notFound();
  return u;
}

export function setClock(ctx: Ctx, userId: string, offsetDays: number, hour: number | null): MeState {
  ensure(ctx, userId);
  updateDemoClock(ctx.db, userId, offsetDays, hour);
  return buildMe(ctx, userId);
}

export function resetDemo(ctx: Ctx, userId: string): MeState {
  ensure(ctx, userId);
  resetToStart(ctx.db, userId);
  return buildMe(ctx, userId);
}

export function setLocation(ctx: Ctx, userId: string, spotId: SpotId | null): MeState {
  ensure(ctx, userId);
  updateDemoSpot(ctx.db, userId, spotId);
  return buildMe(ctx, userId);
}

/** デモの付与は source='demo'、spot_key に requestId を入れて区別する */
export function addRolls(ctx: Ctx, userId: string, requestId: string, amount: number): MeState {
  const u = ensure(ctx, userId);
  const now = appNow(ctx, u);
  once(ctx, userId, requestId, 'demo-rolls', now.at, () => {
    insertGrant(ctx.db, userId, now.day, 'demo', requestId, amount, now.at);
    return { ok: true };
  });
  return buildMe(ctx, userId);
}
