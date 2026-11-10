// 次に行く予定（U-10、R-070【仮定】）。1人3つまで。着いたら（QR）済みになる。
import type { Ctx } from './context.ts';
import { MAX_OPEN_PLANS } from '../../../shared/master/campaigns.ts';
import { spotById, type SpotId } from '../../../shared/master/spots.ts';
import type { PlansState } from '../../../shared/schemas.ts';
import { appNow } from './context.ts';
import { conflict, notFound } from '../http/errors.ts';
import { deleteOpenPlan, insertPlan, listOpenPlans } from '../repositories/plan-repo.ts';
import { findUser } from '../repositories/user-repo.ts';

export function plansOf(ctx: Ctx, userId: string): PlansState {
  return {
    plans: listOpenPlans(ctx.db, userId).map((p) => ({ id: p.id, spotId: p.spot_id, createdDay: p.created_day })),
    max: MAX_OPEN_PLANS,
  };
}

/** 店（お土産・飲食）は予定に入れられない。同じスポットはそのまま（二重にしない）。4つ目は 409 */
export function addPlan(ctx: Ctx, userId: string, spotId: SpotId): PlansState {
  const user = findUser(ctx.db, userId);
  if (!user) throw notFound();
  if (spotById(spotId).kind === 'shop') throw notFound();
  const now = appNow(ctx, user);
  ctx.db.transaction(() => {
    const open = listOpenPlans(ctx.db, userId);
    if (open.some((p) => p.spot_id === spotId)) return;
    if (open.length >= MAX_OPEN_PLANS) throw conflict();
    insertPlan(ctx.db, userId, spotId, now.day);
  })();
  return plansOf(ctx, userId);
}

export function removePlan(ctx: Ctx, userId: string, id: number): PlansState {
  if (!findUser(ctx.db, userId)) throw notFound();
  deleteOpenPlan(ctx.db, userId, id);
  return plansOf(ctx, userId);
}
