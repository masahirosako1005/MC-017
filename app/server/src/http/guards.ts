import type { RequestHandler } from 'express';
import { guestIdSchema } from '../../../shared/schemas.ts';
import { HttpError } from './errors.ts';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 別オリジンからの状態変更を拒否（ADR-005）。Origin が無い要求（同じオリジンの GET 等）は通す */
export function originGuard(port: number): RequestHandler {
  const allowed = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (UNSAFE.has(req.method) && origin !== undefined && !allowed.has(origin)) {
      next(new HttpError(403, 'forbidden_origin'));
      return;
    }
    next();
  };
}

/** 状態を変える要求は JSON だけ（ほかは 415） */
export const jsonOnly: RequestHandler = (req, _res, next) => {
  if (UNSAFE.has(req.method) && !req.is('application/json')) {
    next(new HttpError(415, 'unsupported_media_type'));
    return;
  }
  next();
};

/** `X-Guest-Id` を検証して res.locals.guestId に置く */
export const requireGuest: RequestHandler = (req, res, next) => {
  const r = guestIdSchema.safeParse(req.get('x-guest-id'));
  if (!r.success) {
    next(new HttpError(400, 'bad_request'));
    return;
  }
  res.locals.guestId = r.data;
  next();
};

export function guestOf(locals: Record<string, unknown>): string {
  const id = locals.guestId;
  if (typeof id !== 'string') throw new HttpError(400, 'bad_request');
  return id;
}

/** DNS リバインディング対策: Host のホスト名が 127.0.0.1 / localhost 以外なら 403（ポートは問わない。dev の proxy は 5173） */
export const hostGuard: RequestHandler = (req, _res, next) => {
  const host = (req.get('host') ?? '').toLowerCase().replace(/:\d{1,5}$/, '');
  if (host !== '127.0.0.1' && host !== 'localhost') {
    next(new HttpError(403, 'forbidden_origin'));
    return;
  }
  next();
};

/** query を受ける API だけ許可し、ほかは query のキーが1つでもあれば 400（SEC-IN-07）。詳細な検証は各 route の zod */
const QUERY_ALLOWED = new Set(['/rumors', '/admin/summary', '/admin/campaigns']);
export const queryGuard: RequestHandler = (req, _res, next) => {
  const hasQuery = Object.keys(req.query).length > 0;
  const allowed = QUERY_ALLOWED.has(req.path) || /^\/admin\/shops\/[^/]+\/(summary|voices)$/.test(req.path);
  if (hasQuery && !allowed) {
    next(new HttpError(400, 'bad_request'));
    return;
  }
  next();
};
