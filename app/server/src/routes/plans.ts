// 次に行く予定（U-10）。利用者アプリ向けで、ADMIN_MODE に関わらず常に出る
import { Router } from 'express';
import type { Ctx } from '../services/context.ts';
import { emptyBodySchema, idParamsSchema, noQuerySchema, planBodySchema } from '../../../shared/schemas.ts';
import { parse } from '../http/errors.ts';
import { guestOf, requireGuest } from '../http/guards.ts';
import { addPlan, plansOf, removePlan } from '../services/plan-service.ts';

const planParams = idParamsSchema('planId');

export function planRoutes(ctx: Ctx): Router {
  const r = Router();

  r.get('/plans', requireGuest, (req, res) => {
    parse(noQuerySchema, req.query);
    res.json(plansOf(ctx, guestOf(res.locals)));
  });

  r.post('/plans', requireGuest, (req, res) => {
    const body = parse(planBodySchema, req.body);
    res.json(addPlan(ctx, guestOf(res.locals), body.spotId));
  });

  r.post('/plans/:planId/cancel', requireGuest, (req, res) => {
    parse(emptyBodySchema, req.body ?? {});
    const { planId } = parse(planParams, req.params) as { planId: number };
    res.json(removePlan(ctx, guestOf(res.locals), planId));
  });

  return r;
}
