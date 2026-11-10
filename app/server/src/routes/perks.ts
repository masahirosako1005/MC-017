// API 11・12（特典の一覧・使う）・13（うわさ）
import { Router } from 'express';
import type { Ctx } from '../services/context.ts';
import { idParamsSchema, requestBodySchema, rumorQuerySchema } from '../../../shared/schemas.ts';
import { parse } from '../http/errors.ts';
import { guestOf, requireGuest } from '../http/guards.ts';
import { listForUser, useCoupon } from '../services/coupon-service.ts';
import { getRumors } from '../services/rumor-service.ts';

const couponParams = idParamsSchema('couponId');

export function perkRoutes(ctx: Ctx): Router {
  const r = Router();

  r.get('/coupons', requireGuest, (_req, res) => {
    res.json(listForUser(ctx, guestOf(res.locals)));
  });

  r.post('/coupons/:couponId/use', requireGuest, (req, res) => {
    const { couponId } = parse(couponParams, req.params) as { couponId: number };
    const { requestId } = parse(requestBodySchema, req.body);
    res.json(useCoupon(ctx, guestOf(res.locals), couponId, requestId));
  });

  r.get('/rumors', requireGuest, (req, res) => {
    const { spot } = parse(rumorQuerySchema, req.query);
    res.json(getRumors(ctx, guestOf(res.locals), spot));
  });

  return r;
}
