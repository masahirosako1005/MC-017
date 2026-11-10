import type { Ctx } from './context.ts';
import { appNow, once } from './context.ts';
import { addDays, seasonOf } from '../../../shared/dates.ts';
import { EXPIRES_DAYS, LATER_DAYS, TEMPLATES, type TemplateId } from '../../../shared/master/coupons.ts';
import { campaignLabel } from '../../../shared/master/campaigns.ts';
import type { Pair } from '../../../shared/master/spots.ts';
import type { Coupon, CouponStatus } from '../../../shared/schemas.ts';
import { conflict, notFound } from '../http/errors.ts';
import { countStamps } from '../repositories/play-repo.ts';
import { findCoupon, insertCoupon, listCoupons, markSeen, markUsed, type CouponRow } from '../repositories/coupon-repo.ts';
import { findCampaign, type CampaignRow } from '../repositories/campaign-repo.ts';
import { findUser } from '../repositories/user-repo.ts';

export function statusOf(row: Pick<CouponRow, 'used_at' | 'usable_from' | 'expires'>, today: string): CouponStatus {
  if (row.used_at !== null) return 'used';
  if (today > row.expires) return 'expired';
  if (today < row.usable_from) return 'later';
  return 'usable';
}

export function toCoupon(row: CouponRow, today: string, label: Pair | null = null): Coupon {
  return {
    id: row.id,
    templateId: row.template_id,
    label,
    shopId: row.shop_id,
    season: row.season,
    obtainedDay: row.obtained_day,
    usableFrom: row.usable_from,
    expires: row.expires,
    status: statusOf(row, today),
    isNew: row.seen === 0,
  };
}

/** 🎁マス・ゴールのクーポンを作る（同じ盤・同じマスは1枚だけ） */
export function grantCoupon(
  ctx: Ctx, userId: string, templateId: TemplateId, boardNo: number, square: number, today: string,
): Coupon {
  const t = TEMPLATES[templateId];
  const row = insertCoupon(ctx.db, {
    userId,
    templateId,
    season: templateId === 'season' ? seasonOf(today) : null,
    boardNo,
    square,
    shopId: t.shop,
    obtainedDay: today,
    usableFrom: t.later ? addDays(today, LATER_DAYS) : today,
    expires: addDays(today, EXPIRES_DAYS),
  });
  return toCoupon(row, today);
}

/** キャンペーンの券: 翌日から使え（最終日に止まったらその日から）、キャンペーンの最終日までが期限。店は campaigns から */
export function grantCampaignCoupon(
  ctx: Ctx, userId: string, c: CampaignRow, boardNo: number, square: number, today: string,
): Coupon {
  const next = addDays(today, 1);
  const row = insertCoupon(ctx.db, {
    userId, templateId: 'campaign', campaignId: c.id, season: null, boardNo, square, shopId: c.shop_id,
    obtainedDay: today, usableFrom: next > c.ends ? c.ends : next, expires: c.ends,
  });
  return toCoupon(row, today, campaignLabel(c.kind, c.shop_id, c.item_key, c.value));
}

function labelOf(ctx: Ctx, row: CouponRow): Pair | null {
  if (row.campaign_id === null) return null;
  const c = findCampaign(ctx.db, row.campaign_id);
  return c ? campaignLabel(c.kind, c.shop_id, c.item_key, c.value) : null;
}

export function listForUser(ctx: Ctx, userId: string): { stamps: number; coupons: Coupon[] } {
  const user = findUser(ctx.db, userId);
  if (!user) throw notFound();
  const { day } = appNow(ctx, user);
  const coupons = listCoupons(ctx.db, userId).map((r) => toCoupon(r, day, labelOf(ctx, r)));
  markSeen(ctx.db, userId);
  return { stamps: countStamps(ctx.db, userId), coupons };
}

/** 使えるクーポンだけ利用済みにする。他人のは 404、使えないのは 409。同じ requestId の2回目は1回目と同じ応答 */
export function useCoupon(ctx: Ctx, userId: string, couponId: number, requestId: string): Coupon {
  const user = findUser(ctx.db, userId);
  if (!user) throw notFound();
  const now = appNow(ctx, user);
  return once(ctx, userId, requestId, 'coupon', now.at, () => {
    const row = findCoupon(ctx.db, userId, couponId);
    if (!row) throw notFound();
    if (statusOf(row, now.day) !== 'usable') throw conflict();
    if (!markUsed(ctx.db, userId, couponId, now.at)) throw conflict();
    const after = findCoupon(ctx.db, userId, couponId);
    if (!after) throw notFound();
    return toCoupon(after, now.day, labelOf(ctx, after));
  });
}
