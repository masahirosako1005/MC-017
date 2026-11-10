// データ設計 §2.1。名前・紹介文は index.html の SPOTS を引き継ぐ。緯度・経度は【仮定: 概略値】。
export const SPOT_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11'] as const;
export type SpotId = (typeof SPOT_IDS)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const TAGS = ['history', 'view', 'nature', 'kids', 'indoor', 'food', 'festival', 'night', 'shopping'] as const;
export type Tag = (typeof TAGS)[number];

export type SpotKind = 'sight' | 'event' | 'shop';
export type IconName =
  | 'castle' | 'tree' | 'fish' | 'flag' | 'paw' | 'museum' | 'star' | 'lantern' | 'bag' | 'bowl';

export type Pair = readonly [ja: string, en: string];

export interface Spot {
  id: SpotId;
  kind: SpotKind;
  real: boolean;
  season: Season | 'all';
  stepFree: boolean;
  tags: readonly Tag[];
  lat: number;
  lng: number;
  icon: IconName;
  name: Pair;
  cat: Pair;
  ev: Pair;
  short: Pair;
  /** CSV のスポット名（データ設計 §2.1 の対応【仮定】）。無ければ null */
  csvName: string | null;
}

export const SPOTS: readonly Spot[] = [
  { id: 's1', kind: 'sight', real: true, season: 'spring', stepFree: true, tags: ['history', 'view'], lat: 35.1856, lng: 136.899, icon: 'castle',
    name: ['名古屋城', 'Nagoya Castle'], cat: ['お城', 'Castle'], ev: ['お堀の夜桜あかり', 'Moat Night Sakura Lights'],
    short: ['お堀の桜を灯りで照らす夜のイベント', 'A night event lighting up the cherry trees by the moat'], csvName: '灯雲の石畳通り（星綴港）' },
  { id: 's2', kind: 'sight', real: true, season: 'spring', stepFree: true, tags: ['nature', 'view'], lat: 35.1563, lng: 136.9172, icon: 'tree',
    name: ['鶴舞公園', 'Tsuruma Park'], cat: ['公園', 'Park'], ev: ['つるまの桜ピクニック', 'Tsuruma Sakura Picnic'],
    short: ['芝生で お花見ピクニック', 'A blossom-viewing picnic on the lawn'], csvName: '月花の風車丘（月灯集落）' },
  { id: 's3', kind: 'sight', real: true, season: 'summer', stepFree: true, tags: ['kids', 'indoor'], lat: 35.0908, lng: 136.8784, icon: 'fish',
    name: ['名古屋港水族館', 'Port of Nagoya Public Aquarium'], cat: ['水族館', 'Aquarium'], ev: ['夏の夜の水族館', 'Summer Night Aquarium'],
    short: ['夜だけの 青い光の展示', 'Blue-light exhibits, nights only'], csvName: '星綾の潮見台（星凪諸島・薄青岬）' },
  { id: 's4', kind: 'event', real: false, season: 'summer', stepFree: true, tags: ['food', 'festival'], lat: 35.095, lng: 136.885, icon: 'flag',
    name: ['みなと夏まつり広場', 'Minato Summer Plaza'], cat: ['イベント広場', 'Event plaza'], ev: ['港の夏まつり', 'Port Summer Festival'],
    short: ['屋台と盆踊りの夏まつり', 'Food stalls and Bon dancing'], csvName: null },
  { id: 's5', kind: 'sight', real: true, season: 'autumn', stepFree: false, tags: ['nature', 'kids'], lat: 35.1566, lng: 136.976, icon: 'paw',
    name: ['東山動植物園', 'Higashiyama Zoo & Botanical Gardens'], cat: ['動物園', 'Zoo'], ev: ['もみじの植物園まつり', 'Maple Garden Festival'],
    short: ['色づく もみじの小道を歩こう', 'Walk the path of autumn maples'], csvName: '瑠璃凪の水鏡湖（雫森谷）' },
  { id: 's6', kind: 'sight', real: true, season: 'autumn', stepFree: true, tags: ['history', 'indoor'], lat: 35.1428, lng: 136.9333, icon: 'museum',
    name: ['名古屋市博物館', 'Nagoya City Museum'], cat: ['博物館', 'Museum'], ev: ['むかしの道具たんけん', 'Old Tools Adventure'],
    short: ['子どもと楽しむ 秋の体験', 'An autumn hands-on day for kids'], csvName: '雪雫の音楽堂（鈴風高原）' },
  { id: 's7', kind: 'sight', real: true, season: 'winter', stepFree: true, tags: ['kids', 'indoor'], lat: 35.165, lng: 136.8996, icon: 'star',
    name: ['名古屋市科学館', 'Nagoya City Science Museum'], cat: ['科学館', 'Science museum'], ev: ['冬の星空さんぽ', 'Winter Starry Sky Walk'],
    short: ['プラネタリウムで冬の星座を見よう', 'See the winter constellations in the planetarium'], csvName: '風詠みの灯台（白波離島）' },
  { id: 's10', kind: 'event', real: false, season: 'winter', stepFree: false, tags: ['food', 'night', 'festival'], lat: 35.1595, lng: 136.903, icon: 'lantern',
    name: ['大須 冬あかり横丁', 'Osu Winter Lantern Alley'], cat: ['イベント', 'Event'], ev: ['冬あかり横丁', 'Winter Lantern Alley'],
    short: ['ちょうちんが並ぶ 冬の夜市', 'A winter night market lined with lanterns'], csvName: '虹灯りの夜市（虹帆町）' },
  { id: 's8', kind: 'shop', real: false, season: 'all', stepFree: true, tags: ['shopping'], lat: 35.17, lng: 136.884, icon: 'bag',
    name: ['あかり堂', 'Akari-do'], cat: ['お土産', 'Souvenirs'], ev: ['手づくり ちょうちん教室', 'Handmade lantern class'],
    short: ['名古屋みやげと ちょうちんの店', 'Nagoya souvenirs and paper lanterns'], csvName: null },
  { id: 's9', kind: 'shop', real: false, season: 'all', stepFree: true, tags: ['food'], lat: 35.169, lng: 136.905, icon: 'bowl',
    name: ['きしめん ひだまり', 'Kishimen Hidamari'], cat: ['飲食', 'Food'], ev: ['季節のきしめん', 'Seasonal kishimen'],
    short: ['ひらたい麺の きしめんの店', 'A shop for flat kishimen noodles'], csvName: null },
  { id: 's11', kind: 'shop', real: false, season: 'all', stepFree: true, tags: ['food'], lat: 35.162, lng: 136.91, icon: 'bowl',
    name: ['みそかつ こもれび', 'Misokatsu Komorebi'], cat: ['飲食', 'Food'], ev: ['ミニみそかつ', 'Mini misokatsu'],
    short: ['ひとくちサイズの みそかつの店', 'Bite-size misokatsu'], csvName: null },
];

const BY_ID = new Map<SpotId, Spot>(SPOTS.map((s) => [s.id, s]));

export function spotById(id: SpotId): Spot {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown spot ${id}`);
  return s;
}

export function spotByCsvName(name: string): Spot | undefined {
  return SPOTS.find((s) => s.csvName === name);
}

/** 季節マスで案内するイベント（データ設計 §2.2）【仮定】 */
export const SEASON_EVENT_SPOT: Readonly<Record<Season, SpotId>> = {
  spring: 's1', summer: 's4', autumn: 's5', winter: 's10',
};

/** 2点間の直線距離（メートル、球面近似） */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
