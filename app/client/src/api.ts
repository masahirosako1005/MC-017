// API の呼び出し（API設計 §2）。同じオリジンの /api だけを呼ぶ。
import type { ApiError } from '../../shared/schemas.ts';
import { guestId } from './guest.ts';

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';

function isApiError(v: unknown): v is ApiError {
  if (typeof v !== 'object' || v === null || !('error' in v)) return false;
  const e = v.error;
  return typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string';
}

async function send(method: Method, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'X-Guest-Id': guestId() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiFailure(0, 'network');
  }
}

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body);
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiFailure(res.status, isApiError(data) ? data.error.code : 'unknown');
  return data as T;
}

/** 音声（audio/wav）を受け取る。失敗は ApiFailure */
export async function apiBlob(path: string, body: unknown): Promise<Blob> {
  const res = await send('POST', path, body);
  if (!res.ok) throw new ApiFailure(res.status, 'tts');
  return res.blob();
}

export function requestId(): string {
  return crypto.randomUUID();
}
