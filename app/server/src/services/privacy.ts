// 小さい人数を見せないための整形（U-09）。5人未満は隠し、割合は母数が少ないと「参考」を付ける。
import { HIDE_BELOW, REFERENCE_BELOW } from '../../../shared/master/campaigns.ts';
import type { CountM, RateM } from '../../../shared/admin.ts';

/** 0 はそのまま、1〜4 は隠す */
export function countM(n: number): CountM {
  return n > 0 && n < HIDE_BELOW ? { value: null, hidden: true } : { value: n, hidden: false };
}

export function rateM(num: number, den: number): RateM {
  if (den < HIDE_BELOW) return { percent: null, den: null, hidden: true, reference: false };
  return { percent: Math.round((num / den) * 1000) / 10, den, hidden: false, reference: den < REFERENCE_BELOW };
}
