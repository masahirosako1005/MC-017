import type { Db } from '../db.ts';

export function findResponse(db: Db, userId: string, requestId: string): string | undefined {
  const r = db.prepare('SELECT response FROM requests WHERE user_id = ? AND request_id = ?').get(userId, requestId) as
    | { response: string }
    | undefined;
  return r?.response;
}

export function saveResponse(db: Db, userId: string, requestId: string, kind: string, response: string, at: string): void {
  db.prepare('INSERT INTO requests (user_id, request_id, kind, response, at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, requestId, kind, response, at);
}
