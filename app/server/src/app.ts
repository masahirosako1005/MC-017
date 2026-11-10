import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ctx } from './services/context.ts';
import type { Tts } from './services/tts-service.ts';
import { AVATAR_FILES, AVATAR_IDS, type AvatarId } from '../../shared/master/avatars.ts';
import { errorHandler, notFoundHandler } from './http/errors.ts';
import { hostGuard, jsonOnly, originGuard, queryGuard } from './http/guards.ts';
import { securityHeaders } from './http/headers.ts';
import { apiRouter } from './routes/index.ts';
import { log } from './log.ts';

export const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));
export const AVATAR_SRC_DIR = fileURLToPath(new URL('../../client/public/avatars', import.meta.url));

/** 4枚そろったアバターだけを選べる（R-006） */
export function availableAvatars(dir: string = AVATAR_SRC_DIR): Set<AvatarId> {
  return new Set(AVATAR_IDS.filter((id) => AVATAR_FILES.every((f) => existsSync(join(dir, `${id}-${f}.svg`)))));
}

export function createApp(ctx: Ctx, tts: Tts, opts: { port: number; staticDir?: string | null }): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.set('query parser', 'simple');

  app.use(securityHeaders);
  app.use(hostGuard);
  app.use((req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => log('info', 'req', { m: req.method, p: req.path, s: res.statusCode, ms: Date.now() - t0 }));
    next();
  });

  app.use('/api', originGuard(opts.port), queryGuard, jsonOnly, express.json({ limit: '16kb', strict: true }), apiRouter(ctx, tts));
  app.use('/api', notFoundHandler);

  // 運営向けの画面は ADMIN_MODE=1 のときだけ（出さないときは 404、URL の存在も見せない）
  if (!ctx.adminMode) app.get(/^\/admin(\.html|\/.*)?$/, notFoundHandler);

  const dir = opts.staticDir === undefined ? CLIENT_DIST : opts.staticDir;
  if (dir && existsSync(dir)) {
    app.use(express.static(dir, { index: 'index.html', dotfiles: 'ignore', redirect: false, etag: false, cacheControl: false }));
    if (ctx.adminMode) {
      app.get(/^\/admin\/?$/, (_req, res) => {
        res.sendFile(join(dir, 'admin.html'), { cacheControl: false, dotfiles: 'deny' });
      });
    }
    // SPA: 拡張子の無い GET は index.html。ファイルが無い /assets/* などは 404
    app.get(/^\/[^.]*$/, (_req, res) => {
      res.sendFile(join(dir, 'index.html'), { cacheControl: false, dotfiles: 'deny' });
    });
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

