import type { Db } from '../db.ts';
import type { Season, SpotId } from '../../../shared/master/spots.ts';
import type { TemplateId } from '../../../shared/master/coupons.ts';

export interface CouponRow {
  id: number;
  user_id: string;
  template_id: TemplateId;
  campaign_id: number | null;
  season: Season | null;
  board_no: number;
  square: number;
  shop_id: SpotId;
  obtained_day: string;
  usable_from: string;
  expires: string;
  used_at: string | null;
  seen: 0 | 1;
}

export interface NewCoupon {
  userId: string;
  templateId: TemplateId;
  campaignId?: number | null;
  season: Season | null;
  boardNo: number;
  square: number;
  shopId: SpotId;
  obtainedDay: string;
  usableFrom: string;
  expires: string;
}

/** 同じ盤の同じマスは1枚だけ。作れなければ既存の行を返す */
export function insertCoupon(db: Db, c: NewCoupon): CouponRow {
  db.prepare(
    `INSERT OR IGNORE INTO coupons (user_id, template_id, campaign_id, season, board_no, square, shop_id, obtained_day, usable_from, expires)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(c.userId, c.templateId, c.campaignId ?? null, c.season, c.boardNo, c.square, c.shopId, c.obtainedDay, c.usableFrom, c.expires);
  return db.prepare('SELECT * FROM coupons WHERE user_id = ? AND board_no = ? AND square = ?')
    .get(c.userId, c.boardNo, c.square) as CouponRow;
}

export function listCoupons(db: Db, userId: string): CouponRow[] {
  return db.prepare('SELECT * FROM coupons WHERE user_id = ? ORDER BY id DESC').all(userId) as CouponRow[];
}

export function findCoupon(db: Db, userId: string, id: number): CouponRow | undefined {
  return db.prepare('SELECT * FROM coupons WHERE user_id = ? AND id = ?').get(userId, id) as CouponRow | undefined;
}

export function markUsed(db: Db, userId: string, id: number, at: string): boolean {
  return db.prepare('UPDATE coupons SET used_at = ? WHERE user_id = ? AND id = ? AND used_at IS NULL')
    .run(at, userId, id).changes === 1;
}

export function markSeen(db: Db, userId: string): void {
  db.prepare('UPDATE coupons SET seen = 1 WHERE user_id = ? AND seen = 0').run(userId);
}

export function countUnseen(db: Db, userId: string): number {
  return (db.prepare('SELECT count(*) AS n FROM coupons WHERE user_id = ? AND seen = 0').get(userId) as { n: number }).n;
}
