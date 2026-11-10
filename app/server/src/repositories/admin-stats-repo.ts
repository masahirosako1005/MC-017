// 運営向けの集計の問い合わせ（U-09）。個人（user_id）は repository の外へ出さない約束で、service は人数だけを返す。
import type { Db } from '../db.ts';
import type { Age, Companion } from '../../../shared/schemas.ts';
import type { SpotId } from '../../../shared/master/spots.ts';

export interface VisitRow { user_id: string; day: string; kind: 'first' | 'day2' | 'revisit' }

export function visitRange(db: Db): { min: string | null; max: string | null } {
  return db.prepare('SELECT min(day) AS min, max(day) AS max FROM visits').get() as { min: string | null; max: string | null };
}

export function visitsIn(db: Db, from: string, to: string): VisitRow[] {
  return db.prepare('SELECT user_id, day, kind FROM visits WHERE day BETWEEN ? AND ?').all(from, to) as VisitRow[];
}

/** 期間に来た人を年代ごとに数える（年代を選んでいない人は age が null） */
export function ageCounts(db: Db, from: string, to: string): { age: Age | null; n: number }[] {
  return db.prepare(
    `SELECT u.age AS age, count(DISTINCT v.user_id) AS n FROM visits v JOIN users u ON u.id = v.user_id
     WHERE v.day BETWEEN ? AND ? GROUP BY u.age`,
  ).all(from, to) as { age: Age | null; n: number }[];
}

export function companionCounts(db: Db, from: string, to: string): { companion: Companion | null; n: number }[] {
  return db.prepare(
    `SELECT u.companion AS companion, count(DISTINCT v.user_id) AS n FROM visits v JOIN users u ON u.id = v.user_id
     WHERE v.day BETWEEN ? AND ? GROUP BY u.companion`,
  ).all(from, to) as { companion: Companion | null; n: number }[];
}

export function usersWithTrigger(db: Db, from: string, to: string): Set<string> {
  const rows = db.prepare("SELECT DISTINCT user_id AS u FROM grants WHERE source IN ('qr','note','invite') AND day BETWEEN ? AND ?")
    .all(from, to) as { u: string }[];
  return new Set(rows.map((r) => r.u));
}

export function usersWhoRolled(db: Db, from: string, to: string): Set<string> {
  const rows = db.prepare('SELECT DISTINCT user_id AS u FROM rolls WHERE substr(at, 1, 10) BETWEEN ? AND ?').all(from, to) as { u: string }[];
  return new Set(rows.map((r) => r.u));
}

/** その日の終わりに、盤の途中（1〜43）にいたか。ゴールに着いた直後（44）は戻って0 */
export function midBoardAt(db: Db, userId: string, day: string): boolean {
  const r = db.prepare('SELECT to_pos FROM rolls WHERE user_id = ? AND substr(at, 1, 10) <= ? ORDER BY id DESC LIMIT 1')
    .get(userId, day) as { to_pos: number } | undefined;
  return r !== undefined && r.to_pos >= 1 && r.to_pos <= 43;
}

export function hasPlanAt(db: Db, userId: string, day: string): boolean {
  return db.prepare("SELECT 1 AS x FROM plans WHERE user_id = ? AND created_day <= ? AND (status = 'open' OR done_day > ?) LIMIT 1")
    .get(userId, day, day) !== undefined;
}

/** その日の終わりに、翌日以降に使える券を持っていたか */
export function hasLaterCouponAt(db: Db, userId: string, day: string): boolean {
  return db.prepare(
    `SELECT 1 AS x FROM coupons WHERE user_id = ? AND obtained_day <= ? AND usable_from > ? AND expires >= ?
     AND (used_at IS NULL OR substr(used_at, 1, 10) > ?) LIMIT 1`,
  ).get(userId, day, day, day, day) !== undefined;
}

export function nextVisitCoupons(db: Db, from: string, to: string): { issued: number; used: number } {
  return db.prepare(
    `SELECT count(*) AS issued, coalesce(sum(used_at IS NOT NULL), 0) AS used FROM coupons
     WHERE template_id IN ('season','goal','campaign') AND obtained_day BETWEEN ? AND ?`,
  ).get(from, to) as { issued: number; used: number };
}

// ---- 店 ----
export function shopCoupons(db: Db, shop: SpotId, from: string, to: string): { issued: number; used: number; revisit: number } {
  const issued = db.prepare('SELECT count(*) AS n FROM coupons WHERE shop_id = ? AND obtained_day BETWEEN ? AND ?').get(shop, from, to) as { n: number };
  const used = db.prepare('SELECT count(*) AS n FROM coupons WHERE shop_id = ? AND used_at IS NOT NULL AND substr(used_at, 1, 10) BETWEEN ? AND ?')
    .get(shop, from, to) as { n: number };
  const revisit = db.prepare(
    `SELECT count(*) AS n FROM coupons c JOIN visits v ON v.user_id = c.user_id AND v.day = substr(c.used_at, 1, 10)
     WHERE c.shop_id = ? AND c.used_at IS NOT NULL AND v.kind = 'revisit' AND substr(c.used_at, 1, 10) BETWEEN ? AND ?`,
  ).get(shop, from, to) as { n: number };
  return { issued: issued.n, used: used.n, revisit: revisit.n };
}

export function shopQr(db: Db, shop: SpotId, from: string, to: string): number {
  return (db.prepare('SELECT count(DISTINCT user_id) AS n FROM stamps WHERE spot_id = ? AND day BETWEEN ? AND ?').get(shop, from, to) as { n: number }).n;
}

export function usedHours(db: Db, shop: SpotId, from: string, to: string): number[] {
  const rows = db.prepare(
    "SELECT CAST(substr(used_at, 12, 2) AS INTEGER) AS h FROM coupons WHERE shop_id = ? AND used_at IS NOT NULL AND substr(used_at, 1, 10) BETWEEN ? AND ?",
  ).all(shop, from, to) as { h: number }[];
  return rows.map((r) => r.h);
}

/** その店で券を使った日に、同じ人が寄ったほかのスポット（人数） */
export function sameDaySpots(db: Db, shop: SpotId, from: string, to: string): { spot_id: SpotId; n: number }[] {
  return db.prepare(
    `SELECT s.spot_id AS spot_id, count(DISTINCT s.user_id) AS n FROM coupons c
     JOIN stamps s ON s.user_id = c.user_id AND s.day = substr(c.used_at, 1, 10)
     WHERE c.shop_id = ? AND c.used_at IS NOT NULL AND substr(c.used_at, 1, 10) BETWEEN ? AND ? AND s.spot_id <> ?
     GROUP BY s.spot_id ORDER BY n DESC, s.spot_id`,
  ).all(shop, from, to, shop) as { spot_id: SpotId; n: number }[];
}

// ---- お客さまの声 ----
export interface VoiceRow { id: number; text: string; day: string; age: Age | null; dummy: 0 | 1; read: 0 | 1 }

export function listVoices(db: Db, shop: SpotId, show: 'all' | 'unread' | 'read'): VoiceRow[] {
  const filter = show === 'unread' ? 'AND r.note_id IS NULL' : show === 'read' ? 'AND r.note_id IS NOT NULL' : '';
  const sql =
    `SELECT n.id AS id, n.text AS text, n.day AS day, u.age AS age, (n.user_id LIKE 'guest-dmv%') AS dummy, (r.note_id IS NOT NULL) AS read
     FROM notes n JOIN users u ON u.id = n.user_id LEFT JOIN note_reads r ON r.note_id = n.id AND r.shop_id = ?
     WHERE n.spot_id = ? AND n.shop_visible = 1 ${filter} ORDER BY n.id DESC LIMIT 50`;
  return db.prepare(sql).all(shop, shop) as VoiceRow[];
}

export function voiceCounts(db: Db, shop: SpotId): { all: number; read: number } {
  return db.prepare(
    `SELECT count(*) AS "all", coalesce(sum(r.note_id IS NOT NULL), 0) AS read FROM notes n
     LEFT JOIN note_reads r ON r.note_id = n.id AND r.shop_id = ? WHERE n.spot_id = ? AND n.shop_visible = 1`,
  ).get(shop, shop) as { all: number; read: number };
}

export function isShopVoice(db: Db, shop: SpotId, noteId: number): boolean {
  return db.prepare('SELECT 1 AS x FROM notes WHERE id = ? AND spot_id = ? AND shop_visible = 1').get(noteId, shop) !== undefined;
}

export function markRead(db: Db, shop: SpotId, noteId: number): void {
  db.prepare('INSERT OR IGNORE INTO note_reads (note_id, shop_id) VALUES (?, ?)').run(noteId, shop);
}
