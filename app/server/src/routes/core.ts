// API 1〜6・10（health・config・avatars・session・me・profile・rolls）
import { Router } from 'express';
import type { Ctx } from '../services/context.ts';
import { AVATAR_IDS } from '../../../shared/master/avatars.ts';
import { emptyBodySchema, noQuerySchema, profileBodySchema, requestBodySchema } from '../../../shared/schemas.ts';
import { parse } from '../http/errors.ts';
import { guestOf, requireGuest } from '../http/guards.ts';
import { buildMe, patchProfile, startSession } from '../services/me-service.ts';
import { roll } from '../services/roll-service.ts';

export function coreRoutes(ctx: Ctx): Router {
  const r = Router();

  r.get('/health', (req, res) => {
    parse(noQuerySchema, req.query);
    res.json({ ok: true });
  });

  r.get('/config', (req, res) => {
    parse(noQuerySchema, req.query);
    res.json({ demoMode: ctx.demoMode });
  });

  r.get('/avatars', (req, res) => {
    parse(noQuerySchema, req.query);
    res.json(AVATAR_IDS.map((id) => ({ id, available: ctx.avatars.has(id) })));
  });

  r.post('/session', requireGuest, (req, res) => {
    parse(emptyBodySchema, req.body ?? {});
    res.json(startSession(ctx, guestOf(res.locals)));
  });

  r.get('/me', requireGuest, (req, res) => {
    parse(noQuerySchema, req.query);
    res.json(buildMe(ctx, guestOf(res.locals)));
  });

  r.patch('/me/profile', requireGuest, (req, res) => {
    const body = parse(profileBodySchema, req.body);
    res.json(patchProfile(ctx, guestOf(res.locals), body));
  });

  r.post('/rolls', requireGuest, (req, res) => {
    const { requestId } = parse(requestBodySchema, req.body);
    res.json(roll(ctx, guestOf(res.locals), requestId));
  });

  return r;
}
