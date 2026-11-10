// 店のキャンペーン（運営向け U-11）の選べる中身と決まり。自由入力はなし（他店名・個人名が入らない）。
// 品物は【仮定: 例】。実在の店の品ではない（ダミー）。
import { SPOTS, distanceM, spotById, type Pair, type SpotId } from './spots.ts';

export const SHOP_IDS = ['s8', 's9', 's11'] as const;
export type ShopId = (typeof SHOP_IDS)[number];

export function isShopId(v: string): v is ShopId {
  return (SHOP_IDS as readonly string[]).includes(v);
}

export interface ItemChoice { key: string; name: Pair; verb: 'free' | 'service' }

export const ITEM_CHOICES: Readonly<Record<ShopId, readonly ItemChoice[]>> = {
  s8: [
    { key: 'shiori', name: ['和紙のしおり', 'Washi bookmark'], verb: 'service' },
    { key: 'postcard1', name: ['ポストカード1枚', '1 postcard'], verb: 'service' },
  ],
  s9: [
    { key: 'large', name: ['きしめん大盛り', 'Large kishimen'], verb: 'free' },
    { key: 'tempura', name: ['天ぷら1品', '1 tempura'], verb: 'service' },
    { key: 'ice', name: ['アイス', 'Ice cream'], verb: 'service' },
  ],
  s11: [
    { key: 'katsu1', name: ['みそかつミニ1切れ', '1 extra mini misokatsu'], verb: 'service' },
    { key: 'coffee', name: ['コーヒー1杯', '1 coffee'], verb: 'free' },
  ],
};

export const YEN_CHOICES = [100, 200, 300, 500] as const;
export const PERCENT_CHOICES = [10, 20, 30] as const;
export const KINDS = ['item', 'yen', 'percent'] as const;
export type CampaignKind = (typeof KINDS)[number];

/** この距離の中の観光スポットに「行く予定」の人が、その店の対象（【仮定】） */
export const DEMAND_RADIUS_M = 2500;
/** 対象がこの人数以上のときだけ作れる（【仮定】。定数なので変えやすい） */
export const DEMAND_THRESHOLD = 10;
/** これ未満の人数（1人以上）は数字を隠す。ユーザー指定（2026-11-10 12:14「5人未満でも数字を表示」）で 1 にした＝隠さない（0 人のときだけ「データなし」）。戻すなら 5 */
export const HIDE_BELOW = 1;
/** 母数がこれ未満の割合は「参考」を付ける */
export const REFERENCE_BELOW = 30;
export const MAX_OPEN_PLANS = 3;
export const MIN_DAYS = 7;
export const MAX_DAYS = 30;
/** 盤の 🏪 は今の位置からこの範囲の先に置く。1枚の盤に最大2つ */
export const EXTRA_MIN_AHEAD = 3;
export const EXTRA_MAX_AHEAD = 10;
export const EXTRA_MAX_PER_BOARD = 2;

export function itemChoice(shop: ShopId, key: string): ItemChoice | undefined {
  return ITEM_CHOICES[shop].find((c) => c.key === key);
}

/** 利用者・店に見せる名前。サーバーが作り、画面では入力させない */
export function campaignLabel(kind: CampaignKind, shop: ShopId, itemKey: string | null, value: number | null): Pair {
  if (kind === 'item') {
    const c = itemKey === null ? undefined : itemChoice(shop, itemKey);
    if (!c) return ['特典', 'Perk'];
    return c.verb === 'free' ? [`${c.name[0]} 無料`, `Free: ${c.name[1]}`] : [`${c.name[0]} サービス`, `Free gift: ${c.name[1]}`];
  }
  if (kind === 'yen') return [`${value ?? 0}円引き`, `¥${value ?? 0} off`];
  return [`${value ?? 0}%引き`, `${value ?? 0}% off`];
}

/** 選んだ値が決まった選択肢の中か */
export function validChoice(shop: ShopId, kind: CampaignKind, itemKey: string | null, value: number | null): boolean {
  if (kind === 'item') return value === null && itemKey !== null && itemChoice(shop, itemKey) !== undefined;
  if (itemKey !== null || value === null) return false;
  const list: readonly number[] = kind === 'yen' ? YEN_CHOICES : PERCENT_CHOICES;
  return list.includes(value);
}

/** その店の需要の対象になるスポット（観光スポット・イベントで、店から半径の中） */
export function demandSpots(shop: ShopId): SpotId[] {
  const s = spotById(shop);
  return SPOTS.filter((x) => x.kind !== 'shop' && distanceM(s, x) <= DEMAND_RADIUS_M).map((x) => x.id);
}
