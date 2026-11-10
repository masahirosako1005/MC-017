// API 14・15（予言・答え）
import { Router } from 'express';
import type { Ctx } from '../services/context.ts';
import { answerBodySchema, idParamsSchema } from '../../../shared/schemas.ts';
import { parse } from '../http/errors.ts';
import { guestOf, requireGuest } from '../http/guards.ts';
import { answerProphecy, getProphecy } from '../services/prophecy-service.ts';

const prophecyParams = idParamsSchema('prophecyId');

export function prophecyRoutes(ctx: Ctx): Router {
  const r = Router();

  r.get('/prophecy', requireGuest, (_req, res) => {
    res.json(getProphecy(ctx, guestOf(res.locals)));
  });

  r.post('/prophecy/:prophecyId/answer', requireGuest, (req, res) => {
    const { prophecyId } = parse(prophecyParams, req.params) as { prophecyId: number };
    const { requestId, answer } = parse(answerBodySchema, req.body);
    res.json(answerProphecy(ctx, guestOf(res.locals), prophecyId, requestId, answer));
  });

  return r;
}
