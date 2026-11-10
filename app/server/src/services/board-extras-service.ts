// 盤の 🏪 マス（U-11）。承認済みで期間中のキャンペーンについて、対象の人の盤に置く。
// 置く場所は、今の位置の3〜10マス先の普通のマス。人とキャンペーンから決まる（毎回同じ）ので、開き直しても動かない。
import type { Ctx } from './context.ts';
import { grantCampaignCoupon } from './coupon-service.ts';
import { GOAL, squareKind } from '../../../shared/board.ts';
import {
  EXTRA_MAX_AHEAD, EXTRA_MAX_PER_BOARD, EXTRA_MIN_AHEAD, campaignLabel, demandSpots,
} from '../../../shared/master/campaigns.ts';
import type { BoardExtra, Coupon } from '../../../shared/schemas.ts';
import {
  extraAt, findCampaign, hasCampaignCoupon, hasCouponAt, insertExtra, listExtras, listLive, userIsPlanning,
} from '../repositories/campaign-repo.ts';
import type { UserRow } from '../repositories/user-repo.ts';

/** 文字列から決まる数（FNV-1a）。乱数ではない */
export function hashOf(s: string): number {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function ensureExtras(ctx: Ctx, u: UserRow, today: string): void {
  const live = listLive(ctx.db, today);
  if (live.length === 0) return;
  ctx.db.transaction(() => {
    for (const c of live) {
      const have = listExtras(ctx.db, u.id, u.board_no);
      if (have.length >= EXTRA_MAX_PER_BOARD) return;
      if (have.some((e) => e.campaign_id === c.id)) continue;
      if (hasCampaignCoupon(ctx.db, u.id, c.id)) continue;
      if (!userIsPlanning(ctx.db, u.id, demandSpots(c.shop_id))) continue;
      const taken = new Set(have.map((e) => e.square));
      const cand: number[] = [];
      for (let sq = u.pos + EXTRA_MIN_AHEAD; sq <= u.pos + EXTRA_MAX_AHEAD; sq += 1) {
        if (sq < GOAL && squareKind(u.board_no, sq) === 'normal' && !taken.has(sq)) cand.push(sq);
      }
      const pick = cand[hashOf(`${u.id}:${c.id}:${u.board_no}`) % Math.max(1, cand.length)];
      if (pick !== undefined) insertExtra(ctx.db, u.id, u.board_no, c.id, pick);
    }
  })();
}

/** 盤に出す 🏪。もう券を受け取ったマスと、期間が終わったものは出さない */
export function extrasView(ctx: Ctx, userId: string, boardNo: number, today: string): BoardExtra[] {
  const out: BoardExtra[] = [];
  for (const e of listExtras(ctx.db, userId, boardNo)) {
    const c = findCampaign(ctx.db, e.campaign_id);
    if (!c || c.status !== 'approved' || today < c.starts || today > c.ends) continue;
    if (hasCouponAt(ctx.db, userId, boardNo, e.square)) continue;
    out.push({ square: e.square, campaignId: c.id, shopId: c.shop_id, label: campaignLabel(c.kind, c.shop_id, c.item_key, c.value) });
  }
  return out;
}

/** 🏪 に止まったら、翌日から使える券を1枚出す。期間外・受け取り済みなら null */
export function landOnExtra(ctx: Ctx, userId: string, boardNo: number, square: number, today: string): Coupon | null {
  const e = extraAt(ctx.db, userId, boardNo, square);
  if (!e) return null;
  const c = findCampaign(ctx.db, e.campaign_id);
  if (!c || c.status !== 'approved' || today < c.starts || today > c.ends) return null;
  if (hasCampaignCoupon(ctx.db, userId, c.id)) return null;
  return grantCampaignCoupon(ctx, userId, c, boardNo, square, today);
}

