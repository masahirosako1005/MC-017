// 店ごとのダッシュボード（U-09 a）と、お客さまの声（U-12 e）
import type { Ctx } from './context.ts';
import type { ShopId } from '../../../shared/master/campaigns.ts';
import type { ShopSummary, VoiceView, VoicesView } from '../../../shared/admin.ts';
import { notFound } from '../http/errors.ts';
import {
  isShopVoice, listVoices, markRead, sameDaySpots, shopCoupons, shopQr, usedHours, voiceCounts,
} from '../repositories/admin-stats-repo.ts';
import { listCampaigns } from './campaign-service.ts';
import { periodOf } from './admin-metrics-service.ts';
import { countM } from './privacy.ts';

/** 時間帯の区切り（時）。0〜10時と18〜24時は端にまとめる【仮定】 */
export const HOUR_BANDS: readonly (readonly [number, number])[] = [[0, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 24]];

export function shopSummaryOf(ctx: Ctx, shop: ShopId, days: number | null): ShopSummary {
  const p = periodOf(ctx, days);
  const c = shopCoupons(ctx.db, shop, p.now.from, p.now.to);
  const hours = usedHours(ctx.db, shop, p.now.from, p.now.to);
  return {
    shopId: shop,
    period: p.info,
    coupons: { issued: countM(c.issued), used: countM(c.used), usedOnRevisit: countM(c.revisit) },
    qr: countM(shopQr(ctx.db, shop, p.now.from, p.now.to)),
    hourly: HOUR_BANDS.map(([from, to]) => ({ from, to, count: countM(hours.filter((h) => h >= from && h < to).length) })),
    sameDay: sameDaySpots(ctx.db, shop, p.now.from, p.now.to).map((r) => ({ spotId: r.spot_id, people: countM(r.n) })),
    campaigns: listCampaigns(ctx, shop),
    unreadVoices: (() => { const v = voiceCounts(ctx.db, shop); return v.all - v.read; })(),
  };
}

const HIDDEN = '（伏せました）';

/** 電話番号（数字6つ以上）・メール・URL を伏せる。全角は半角に直してから探す */
export function maskText(src: string): { text: string; masked: boolean } {
  let masked = false;
  const swap = (): string => {
    masked = true;
    return HIDDEN;
  };
  let t = src.normalize('NFKC');
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, swap);
  t = t.replace(/(?:https?:\/\/|www\.)\S+/gi, swap);
  t = t.replace(/\+?\d[\d\-\s().]{4,}\d/g, (m) => (m.replace(/\D/g, '').length >= 6 ? swap() : m));
  return { text: t, masked };
}

export function voicesOf(ctx: Ctx, shop: ShopId, show: 'all' | 'unread' | 'read'): VoicesView {
  const items: VoiceView[] = listVoices(ctx.db, shop, show).map((r) => {
    const m = maskText(r.text);
    return { id: r.id, text: m.text, day: r.day, age: r.age, masked: m.masked, dummy: r.dummy === 1, read: r.read === 1 };
  });
  const c = voiceCounts(ctx.db, shop);
  return { items, counts: { all: c.all, unread: c.all - c.read, read: c.read } };
}

export function confirmVoice(ctx: Ctx, shop: ShopId, noteId: number): VoicesView {
  if (!isShopVoice(ctx.db, shop, noteId)) throw notFound();
  markRead(ctx.db, shop, noteId);
  return voicesOf(ctx, shop, 'all');
}
