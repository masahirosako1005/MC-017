// クーポンの型（データ設計 §2.3）
import { spotById, type Pair, type Season, type SpotId } from './spots.ts';
import { layoutFor } from '../board.ts';

export const TEMPLATE_IDS = ['souv10', 'lantern', 'postcard', 'kishimen', 'tempura', 'minikatsu', 'season', 'goal', 'campaign'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface Template {
  id: TemplateId;
  shop: SpotId;
  /** true なら手に入れた日の7日後から使える（C5） */
  later: boolean;
  name: Pair;
}

export const TEMPLATES: Readonly<Record<TemplateId, Template>> = {
  souv10: { id: 'souv10', shop: 's8', later: false, name: ['お土産 10%オフ', 'Souvenirs 10% off'] },
  lantern: { id: 'lantern', shop: 's8', later: false, name: ['ちょうちん教室 100円引き', 'Lantern class ¥100 off'] },
  postcard: { id: 'postcard', shop: 's8', later: false, name: ['あかり堂 ポストカード1枚', 'Akari-do: 1 postcard'] },
  kishimen: { id: 'kishimen', shop: 's9', later: false, name: ['きしめん 大盛り無料', 'Kishimen: free large size'] },
  tempura: { id: 'tempura', shop: 's9', later: false, name: ['天ぷら1品 サービス', '1 free tempura'] },
  minikatsu: { id: 'minikatsu', shop: 's11', later: false, name: ['みそかつ ミニ1切れ追加', '1 extra mini misokatsu'] },
  season: { id: 'season', shop: 's10', later: true, name: ['季節の1品', 'Seasonal treat'] },
  goal: { id: 'goal', shop: 's9', later: true, name: ['ゴール特典 きしめん1杯無料', 'Goal perk: 1 free kishimen'] },
  // 店のキャンペーン（U-11）。店・名前・使える日は campaigns から決まる。ここは予備の値
  campaign: { id: 'campaign', shop: 's8', later: false, name: ['お店の特典', 'Shop perk'] },
};

export const SEASON_TREATS: Readonly<Record<Season, Pair>> = {
  spring: ['桜あめ', 'Sakura candy'],
  summer: ['かき氷ミニ', 'Mini shaved ice'],
  autumn: ['栗きんとん', 'Chestnut kinton'],
  winter: ['ホットドリンク', 'Hot drink'],
};

/** クーポンの名前。季節の1品は季節ごとの品名 */
export function couponName(templateId: TemplateId, season: Season | null): Pair {
  if (templateId === 'season' && season) return SEASON_TREATS[season];
  return TEMPLATES[templateId].name;
}

const GIFT_CYCLE: readonly TemplateId[] = ['souv10', 'kishimen', 'season', 'lantern', 'tempura', 'minikatsu', 'season', 'postcard'];

/** 盤の🎁マスの並び順でクーポンの型を決める */
export function giftTemplate(boardNo: number, sq: number): TemplateId {
  const idx = layoutFor(boardNo).gifts.indexOf(sq);
  if (idx < 0) throw new Error(`square ${sq} is not a gift on board ${boardNo}`);
  return GIFT_CYCLE[idx % GIFT_CYCLE.length] ?? 'souv10';
}

/** 🎁マスの種類。割引（お金が安くなる券）かプレゼント（ものがもらえる券）か。盤の色とアイコンを変える */
const DISCOUNT_TEMPLATES: readonly TemplateId[] = ['souv10', 'lantern'];
export function giftType(boardNo: number, sq: number): 'present' | 'discount' {
  return DISCOUNT_TEMPLATES.includes(giftTemplate(boardNo, sq)) ? 'discount' : 'present';
}

/** 画面に出すクーポン名。キャンペーンの券は、サーバーが作った名前（label）を使う */
export function couponLabel(c: { templateId: TemplateId; season: Season | null; label: Pair | null }): Pair {
  return c.label ?? couponName(c.templateId, c.season);
}

/** 季節の1品を出す、ダミーのお店（イベント会場そのものは店ではないため）【仮定】 */
const SEASON_SHOP: Pair = ['あかり茶屋', 'Akari Chaya'];

/** 画面に出すお店の名前（ダミー）。店のスポットはその名前、季節の1品はダミーの茶屋 */
export function couponShop(c: { templateId: TemplateId; shopId: SpotId }): Pair {
  return c.templateId === 'season' ? SEASON_SHOP : spotById(c.shopId).name;
}

/** 盤のメッセージ用。「お店の名前 券の名前」 */
export function couponWithShop(c: { templateId: TemplateId; season: Season | null; label: Pair | null; shopId: SpotId }): Pair {
  const shop = couponShop(c);
  const name = couponLabel(c);
  return [`${shop[0]} ${name[0]}`, `${shop[1]} ${name[1]}`];
}

export const LATER_DAYS = 7;
export const EXPIRES_DAYS = 60;
