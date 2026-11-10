// ルートの集約（共通ファイル。parallel ルールにより本体だけが直す）
import { Router } from 'express';
import type { Ctx } from '../services/context.ts';
import type { Tts } from '../services/tts-service.ts';
import { coreRoutes } from './core.ts';
import { adminRoutes } from './admin.ts';
import { demoRoutes } from './demo.ts';
import { perkRoutes } from './perks.ts';
import { planRoutes } from './plans.ts';
import { prophecyRoutes } from './prophecy.ts';
import { spotRoutes } from './spots.ts';
import { ttsRoutes } from './tts.ts';

export function apiRouter(ctx: Ctx, tts: Tts): Router {
  const r = Router();
  r.use(coreRoutes(ctx));
  r.use(ttsRoutes(tts));
  r.use(spotRoutes(ctx));
  r.use(perkRoutes(ctx));
  r.use(prophecyRoutes(ctx));
  r.use(planRoutes(ctx));
  if (ctx.adminMode) r.use(adminRoutes(ctx));
  if (ctx.demoMode) r.use(demoRoutes(ctx));
  return r;
}
