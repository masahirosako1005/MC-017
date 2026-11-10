// 訪問・さいころの付与・振った記録・スタンプ・ひとこと（データ設計 §3・§6）
import type { Db } from '../db.ts';
import type { VisitKind } from '../../../shared/schemas.ts';
import type { SpotId } from '../../../shared/master/spots.ts';

export type GrantSource = 'day2' | 'revisit' | 'qr' | 'note' | 'invite' | 'prophecy' | 'demo' | 'again';

export function findVisit(db: Db, userId: string, day: string): { kind: VisitKind } | undefined {
  return db.prepare('SELECT kind FROM visits WHERE user_id = ? AND day = ?').get(userId, day) as { kind: VisitKind } | undefined;
}

export function lastVisitBefore(db: Db, userId: string, day: string): string | null {
  const r = db.prepare('SELECT max(day) AS d FROM visits WHERE user_id = ? AND day < ?').get(userId, day) as { d: string | null };
  return r.d;
}

export function insertVisit(db: Db, userId: string, day: string, kind: VisitKind): void {
  db.prepare('INSERT OR IGNORE INTO visits (user_id, day, kind) VALUES (?, ?, ?)').run(userId, day, kind);
}

/** 付与できたら true（一意キーで1日1回・1スポット1日1回） */
export function insertGrant(
  db: Db, userId: string, day: string, source: GrantSource, spotKey: string, amount: number, at: string,
): boolean {
  const r = db.prepare(
    'INSERT OR IGNORE INTO grants (user_id, day, source, spot_key, amount, at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(userId, day, source, spotKey, amount, at);
  return r.changes === 1;
}

export function findGrant(db: Db, userId: string, day: string, source: GrantSource): { amount: number } | undefined {
  return db.prepare('SELECT amount FROM grants WHERE user_id = ? AND day = ? AND source = ? LIMIT 1')
    .get(userId, day, source) as { amount: number } | undefined;
}

export function rollsLeft(db: Db, userId: string): number {
  const g = db.prepare('SELECT coalesce(sum(amount), 0) AS n FROM grants WHERE user_id = ?').get(userId) as { n: number };
  const r = db.prepare('SELECT count(*) AS n FROM rolls WHERE user_id = ?').get(userId) as { n: number };
  return g.n - r.n;
}

export function insertRoll(
  db: Db, userId: string, boardNo: number, face: number, from: number, to: number, at: string,
): void {
  db.prepare('INSERT INTO rolls (user_id, board_no, face, from_pos, to_pos, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, boardNo, face, from, to, at);
}

export function countStamps(db: Db, userId: string): number {
  return (db.prepare('SELECT count(*) AS n FROM stamps WHERE user_id = ?').get(userId) as { n: number }).n;
}

export function insertStamp(db: Db, userId: string, spotId: SpotId, day: string, hour: number): boolean {
  return db.prepare('INSERT OR IGNORE INTO stamps (user_id, spot_id, day, hour) VALUES (?, ?, ?, ?)')
    .run(userId, spotId, day, hour).changes === 1;
}

/** shopVisible: 店の人に（名前を出さずに）見せてよいか。利用者アプリのひとこと画面の注意書きで知らせる */
export function insertNote(db: Db, userId: string, spotId: SpotId, day: string, text: string, at: string, shopVisible = false): void {
  db.prepare('INSERT INTO notes (user_id, spot_id, day, text, at, shop_visible) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, spotId, day, text, at, shopVisible ? 1 : 0);
}

/** 今日済んだきっかけ（QR・ひとこと）。誘うは何回でもできるので「済み」に含めない */
export function triggersToday(db: Db, userId: string, day: string): { spot_key: string; source: GrantSource }[] {
  return db.prepare(
    "SELECT spot_key, source FROM grants WHERE user_id = ? AND day = ? AND source IN ('qr','note')",
  ).all(userId, day) as { spot_key: string; source: GrantSource }[];
}
