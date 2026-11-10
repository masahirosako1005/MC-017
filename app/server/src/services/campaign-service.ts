// 店のキャンペーン（U-11）。作れるのは自分の店だけ（URL の shopId と X-Operator の一致は route の guard）。
import type { Ctx } from './context.ts';
import { addDays, diffDays, toJst } from '../../../shared/dates.ts';
import {
  DEMAND_RADIUS_M, DEMAND_THRESHOLD, HIDE_BELOW, MAX_DAYS, MIN_DAYS, campaignLabel, demandSpots, validChoice, type ShopId,
} from '../../../shared/master/campaigns.ts';
import type {
  CampaignBody, CampaignPhase, CampaignView, DemandView,
} from '../../../shared/admin.ts';
import { badRequest, conflict } from '../http/errors.ts';
import {
  couponCounts, countPlanners, countPlannersAt, findByRequestId, insertCampaign,
  listByShop, type CampaignRow,
} from '../repositories/campaign-repo.ts';
import { countM } from './privacy.ts';

/** 運営の「今日」は実際の今日（JST）。利用者のデモの日付とは別 */
export function adminToday(ctx: Ctx): string {
  return toJst(ctx.clock()).day;
}

export function phaseOf(row: Pick<CampaignRow, 'status' | 'starts' | 'ends'>, today: string): CampaignPhase {
  if (row.status !== 'approved') return row.status;
  if (today < row.starts) return 'scheduled';
  if (today > row.ends) return 'ended';
  return 'running';
}

export function campaignViewOf(ctx: Ctx, row: CampaignRow): CampaignView {
  const c = couponCounts(ctx.db, row.id);
  return {
    id: row.id,
    shopId: row.shop_id,
    kind: row.kind,
    label: campaignLabel(row.kind, row.shop_id, row.item_key, row.value),
    starts: row.starts,
    ends: row.ends,
    status: row.status,
    phase: phaseOf(row, adminToday(ctx)),
    rejectReason: row.reject_reason,
    landed: countM(c.landed),
    used: countM(c.used),
  };
}

export function listCampaigns(ctx: Ctx, shop: ShopId): CampaignView[] {
  return listByShop(ctx.db, shop).map((r) => campaignViewOf(ctx, r));
}

/** 需要。内訳は5人未満を隠す。作れるかは本当の人数で決める */
export function demandOf(ctx: Ctx, shop: ShopId): DemandView {
  const spots = demandSpots(shop);
  const rows = spots.map((spotId) => ({ spotId, n: countPlannersAt(ctx.db, spotId) }));
  const real = countPlanners(ctx.db, spots);
  const hiddenAny = rows.some((r) => r.n > 0 && r.n < HIDE_BELOW);
  return {
    shopId: shop,
    radiusM: DEMAND_RADIUS_M,
    threshold: DEMAND_THRESHOLD,
    spots: rows.map((r) => ({ spotId: r.spotId, people: countM(r.n) })),
    total: real >= HIDE_BELOW ? { value: real, hidden: false } : real === 0 ? { value: 0, hidden: false } : { value: null, hidden: true },
    totalAtLeast: hiddenAny && real >= HIDE_BELOW,
    canCreate: real >= DEMAND_THRESHOLD,
    remaining: real >= HIDE_BELOW && real < DEMAND_THRESHOLD ? DEMAND_THRESHOLD - real : null,
    blocking: null,
  };
}

/** 作る。承認の手順は無く、承認済み（approved）で DB に入る（2026-11-10 の指示）。同じ requestId の2回目は1回目と同じ行 */
export function createCampaign(ctx: Ctx, shop: ShopId, body: CampaignBody): CampaignView {
  const same = findByRequestId(ctx.db, body.requestId);
  if (same) {
    if (same.shop_id !== shop) throw conflict();
    return campaignViewOf(ctx, same);
  }
  if (!validChoice(shop, body.kind, body.itemKey, body.value)) throw badRequest();
  const today = adminToday(ctx);
  if (body.starts < addDays(today, 1)) throw badRequest();
  const span = diffDays(body.starts, body.ends);
  if (span < MIN_DAYS || span > MAX_DAYS) throw badRequest();
  return ctx.db.transaction(() => {
    if (countPlanners(ctx.db, demandSpots(shop)) < DEMAND_THRESHOLD) throw conflict();
    const row = insertCampaign(ctx.db, {
      requestId: body.requestId, shopId: shop, kind: body.kind, itemKey: body.itemKey, value: body.value,
      starts: body.starts, ends: body.ends, status: 'approved', createdDay: today,
    });
    return campaignViewOf(ctx, row);
  })();
}

