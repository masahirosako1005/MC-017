// 地図の定数（ADR-012）。タイルは地理院の淡色地図だけ。
export const TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
export const ATTRIBUTION_URL = 'https://maps.gsi.go.jp/development/ichiran.html';
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 17;
export const START_ZOOM = 12;
export const CENTER: [number, number] = [35.14, 136.925];
/** 簡易地図の範囲（スポットが全部入る緯度経度）【仮定】 */
export const BOUNDS = { north: 35.2, south: 35.08, west: 136.865, east: 136.99 } as const;
export const ERROR_LIMIT = 3;
export const RECHECK_MS = 15_000;

/** 緯度経度 → タイル番号（再確認で読む1枚を決める） */
export function tileUrlFor(lat: number, lng: number, z: number): string {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
