// API 18〜20。DEMO_MODE=1 のときだけ routes/index.ts が登録する（ADR-008）
import { Router } from 'express';
import type { Ctx } from '../services/context.ts';
import { demoClockBodySchema, demoLocationBodySchema, demoRollsBodySchema, emptyBodySchema } from '../../../shared/schemas.ts';
import { parse } from '../http/errors.ts';
import { guestOf, requireGuest } from '../http/guards.ts';
import { addRolls, resetDemo, setClock, setLocation } from '../services/demo-service.ts';

export function demoRoutes(ctx: Ctx): Router {
  const r = Router();

  r.put('/demo/clock', requireGuest, (req, res) => {
    const b = parse(demoClockBodySchema, req.body);
    res.json(setClock(ctx, guestOf(res.locals), b.offsetDays, b.hour));
  });

  r.post('/demo/reset', requireGuest, (req, res) => {
    parse(emptyBodySchema, req.body);
    res.json(resetDemo(ctx, guestOf(res.locals)));
  });

  r.put('/demo/location', requireGuest, (req, res) => {
    const b = parse(demoLocationBodySchema, req.body);
    res.json(setLocation(ctx, guestOf(res.locals), b.spotId));
  });

  r.post('/demo/rolls', requireGuest, (req, res) => {
    const b = parse(demoRollsBodySchema, req.body);
    res.json(addRolls(ctx, guestOf(res.locals), b.requestId, b.amount));
  });

  return r;
}
