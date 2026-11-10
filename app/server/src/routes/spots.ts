// API 7〜9（QR・ひとこと・誘う）
import { Router } from 'express';
import type { Ctx } from '../services/context.ts';
import { noteBodySchema, requestBodySchema, spotParamsSchema } from '../../../shared/schemas.ts';
import { parse } from '../http/errors.ts';
import { guestOf, requireGuest } from '../http/guards.ts';
import { scanQr, sendInvite, writeNote } from '../services/trigger-service.ts';

export function spotRoutes(ctx: Ctx): Router {
  const r = Router();

  r.post('/spots/:spotId/qr', requireGuest, (req, res) => {
    const { spotId } = parse(spotParamsSchema, req.params);
    const { requestId } = parse(requestBodySchema, req.body);
    res.json(scanQr(ctx, guestOf(res.locals), spotId, requestId));
  });

  r.post('/spots/:spotId/notes', requireGuest, (req, res) => {
    const { spotId } = parse(spotParamsSchema, req.params);
    const { requestId, text } = parse(noteBodySchema, req.body);
    res.json(writeNote(ctx, guestOf(res.locals), spotId, requestId, text));
  });

  r.post('/spots/:spotId/invites', requireGuest, (req, res) => {
    const { spotId } = parse(spotParamsSchema, req.params);
    const { requestId } = parse(requestBodySchema, req.body);
    res.json(sendInvite(ctx, guestOf(res.locals), spotId, requestId));
  });

  return r;
}
