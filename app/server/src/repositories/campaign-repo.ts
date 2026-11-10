// キャンペーン・盤の 🏪 マス・需要の数（U-11）
import type { Db } from '../db.ts';
import type { CampaignKind, ShopId } from '../../../shared/master/campaigns.ts';
import type { CampaignStatus, RejectReason } from '../../../shared/admin.ts';
import type { SpotId } from '../../../shared/master/spots.ts';

export interface CampaignRow {
  id: number;
  request_id: string;
  shop_id: ShopId;
  kind: CampaignKind;
  item_key: string | null;
  value: number | null;
  starts: string;
  ends: string;
  status: CampaignStatus;
  created_day: string;
  reviewed_day: string | null;
  reject_reason: RejectReason | null;
}

export interface NewCampaign {
  requestId: string;
  shopId: ShopId;
  kind: CampaignKind;
  itemKey: string | null;
  value: number | null;
  starts: string;
  ends: string;
  status: CampaignStatus;
  createdDay: string;
}

export function findCampaign(db: Db, id: number): CampaignRow | undefined {
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as CampaignRow | undefined;
}

export function findByRequestId(db: Db, requestId: string): CampaignRow | undefined {
  return db.prepare('SELECT * FROM campaigns WHERE request_id = ?').get(requestId) as CampaignRow | undefined;
}

export function insertCampaign(db: Db, c: NewCampaign): CampaignRow {
  const r = db.prepare(
    `INSERT INTO campaigns (request_id, shop_id, kind, item_key, value, starts, ends, status, created_day, reviewed_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(c.requestId, c.shopId, c.kind, c.itemKey, c.value, c.starts, c.ends, c.status, c.createdDay, c.status === 'approved' ? c.createdDay : null);
  return findCampaign(db, Number(r.lastInsertRowid)) as CampaignRow;
}

export function listByShop(db: Db, shop: ShopId): CampaignRow[] {
  return db.prepare('SELECT * FROM campaigns WHERE shop_id = ? ORDER BY id DESC').all(shop) as CampaignRow[];
}

/** 今日が期間の中の、承認済みのキャンペーン */
export function listLive(db: Db, today: string): CampaignRow[] {
  return db.prepare("SELECT * FROM campaigns WHERE status = 'approved' AND starts <= ? AND ends >= ? ORDER BY id").all(today, today) as CampaignRow[];
}

export interface ExtraRow { user_id: string; board_no: number; campaign_id: number; square: number }

export function listExtras(db: Db, userId: string, boardNo: number): ExtraRow[] {
  return db.prepare('SELECT * FROM board_extras WHERE user_id = ? AND board_no = ? ORDER BY square').all(userId, boardNo) as ExtraRow[];
}

export function insertExtra(db: Db, userId: string, boardNo: number, campaignId: number, square: number): boolean {
  return db.prepare('INSERT OR IGNORE INTO board_extras (user_id, board_no, campaign_id, square) VALUES (?, ?, ?, ?)')
    .run(userId, boardNo, campaignId, square).changes === 1;
}

export function extraAt(db: Db, userId: string, boardNo: number, square: number): ExtraRow | undefined {
  return db.prepare('SELECT * FROM board_extras WHERE user_id = ? AND board_no = ? AND square = ?')
    .get(userId, boardNo, square) as ExtraRow | undefined;
}

function marks(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

/** 開いた予定を持つ人（同じ人は1人）。spots のどれか */
export function countPlanners(db: Db, spots: readonly SpotId[]): number {
  if (spots.length === 0) return 0;
  const sql = "SELECT count(DISTINCT user_id) AS n FROM plans WHERE status = 'open' AND spot_id IN (" + marks(spots.length) + ')';
  return (db.prepare(sql).get(...spots) as { n: number }).n;
}

export function countPlannersAt(db: Db, spotId: SpotId): number {
  return (db.prepare("SELECT count(DISTINCT user_id) AS n FROM plans WHERE status = 'open' AND spot_id = ?").get(spotId) as { n: number }).n;
}

export function userIsPlanning(db: Db, userId: string, spots: readonly SpotId[]): boolean {
  if (spots.length === 0) return false;
  const sql = "SELECT 1 AS x FROM plans WHERE user_id = ? AND status = 'open' AND spot_id IN (" + marks(spots.length) + ') LIMIT 1';
  return db.prepare(sql).get(userId, ...spots) !== undefined;
}

export function couponCounts(db: Db, campaignId: number): { landed: number; used: number } {
  const r = db.prepare('SELECT count(*) AS landed, coalesce(sum(used_at IS NOT NULL), 0) AS used FROM coupons WHERE campaign_id = ?')
    .get(campaignId) as { landed: number; used: number };
  return r;
}

export function hasCouponAt(db: Db, userId: string, boardNo: number, square: number): boolean {
  return db.prepare('SELECT 1 AS x FROM coupons WHERE user_id = ? AND board_no = ? AND square = ?').get(userId, boardNo, square) !== undefined;
}

/** その人が、このキャンペーンの券をすでに持っているか（1人1枚） */
export function hasCampaignCoupon(db: Db, userId: string, campaignId: number): boolean {
  return db.prepare('SELECT 1 AS x FROM coupons WHERE user_id = ? AND campaign_id = ?').get(userId, campaignId) !== undefined;
}
