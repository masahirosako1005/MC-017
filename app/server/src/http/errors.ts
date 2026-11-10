import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';
import { log } from '../log.ts';

export type ErrorCode =
  | 'bad_request' | 'forbidden_origin' | 'not_found' | 'conflict'
  | 'too_large' | 'unsupported_media_type' | 'internal' | 'tts_unavailable';

const MESSAGES: Record<ErrorCode, string> = {
  bad_request: 'Invalid input',
  forbidden_origin: 'Forbidden origin',
  not_found: 'Not found',
  conflict: 'Conflict',
  too_large: 'Payload too large',
  unsupported_media_type: 'Unsupported media type',
  internal: 'Internal error',
  tts_unavailable: 'Speech engine unavailable',
};

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: ErrorCode) {
    super(code);
  }
}

export const badRequest = () => new HttpError(400, 'bad_request');
export const notFound = () => new HttpError(404, 'not_found');
export const conflict = () => new HttpError(409, 'conflict');

/** zod で検証し、合わなければ 400 */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest();
  return r.data;
}

export function errorBody(code: ErrorCode): { error: { code: ErrorCode; message: string } } {
  return { error: { code, message: MESSAGES[code] } };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(errorBody('not_found'));
};

function bodyParserCode(err: unknown): HttpError | null {
  if (typeof err !== 'object' || err === null || !('type' in err)) return null;
  const type = (err as { type: unknown }).type;
  if (type === 'entity.too.large') return new HttpError(413, 'too_large');
  if (type === 'entity.parse.failed') return badRequest();
  if (type === 'charset.unsupported' || type === 'encoding.unsupported') return new HttpError(415, 'unsupported_media_type');
  return null;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  void _next;
  const known = err instanceof HttpError ? err : err instanceof ZodError ? badRequest() : bodyParserCode(err);
  if (known) {
    res.status(known.status).json(errorBody(known.code));
    return;
  }
  const name = err instanceof Error ? err.name : 'unknown';
  const message = err instanceof Error ? err.message : String(err);
  log('error', 'unhandled', { method: req.method, path: req.path, name, message });
  res.status(500).json(errorBody('internal'));
};
