// 予言の計算（ADR-010）。LLM を呼ばない決まった点数。同じ入力なら同じ結果。
import { nextSeason, seasonOf } from './dates.ts';
import { SPOTS, SPOT_IDS, type Season, type Spot, type SpotId, type Tag } from './master/spots.ts';
import type { Reason, TimeBand } from './schemas.ts';

export const W_TAG = 1.0;
export const W_SIMILAR = 3.0;
export const W_SEASON = 1.5;
export const W_STEPFREE = 1.0;
export const LEARN_STEP = 0.5;
export const WEIGHT_MIN = -2;
export const WEIGHT_MAX = 3;
/** 答え合わせの回数がこの数以上でレベル 1〜5 */
export const LEVEL_AT: readonly number[] = [0, 1, 3, 5, 8];

export interface ProphecyInput {
  /** 自分がスタンプを取ったスポット（重なりなし） */
  visited: readonly SpotId[];
  stepLess: boolean;
  /** アプリ内の今日 */
  today: string;
  weights: Readonly<Partial<Record<Tag, number>>>;
  /** 似た人のうち、候補にも行った人の割合（0〜1） */
  similar: Readonly<Partial<Record<SpotId, number>>>;
  /** 自分が QR を読んだ時刻（0〜23） */
  hours: readonly number[];
}

export interface Scored {
  spotId: SpotId;
  score: number;
  reasons: Reason[];
  season: Season;
  timeBand: TimeBand;
}

export function strengthOf(points: number): Reason['strength'] {
  if (points >= 2) return 'strong';
  if (points >= 1) return 'mid';
  return 'weak';
}

export function timeBandOf(hour: number): TimeBand {
  if (hour >= 5 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 15) return 'noon';
  if (hour >= 16 && hour <= 18) return 'evening';
  return 'night';
}

/** よく QR を読む時間帯。同数は朝→昼→夕方→夜の順、記録が無ければ昼 */
export function favoriteBand(hours: readonly number[]): TimeBand {
  const order: readonly TimeBand[] = ['morning', 'noon', 'evening', 'night'];
  const n = new Map<TimeBand, number>();
  for (const h of hours) n.set(timeBandOf(h), (n.get(timeBandOf(h)) ?? 0) + 1);
  let best: TimeBand = 'noon';
  let top = 0;
  for (const b of order) {
    const c = n.get(b) ?? 0;
    if (c > top) { best = b; top = c; }
  }
  return best;
}

export function levelOf(checks: number): number {
  return LEVEL_AT.filter((x) => checks >= x).length;
}

/** 的中率 = 気に入った ÷（気に入った＋ふつう）。答えが無ければ null */
export function hitRate(liked: number, normal: number): number | null {
  return liked + normal === 0 ? null : liked / (liked + normal);
}

/** 予言の記録の印: 気に入った ○・ふつう △・それ以外 ― */
export function historyMark(answer: string | null): '○' | '△' | '―' {
  if (answer === 'liked') return '○';
  if (answer === 'normal') return '△';
  return '―';
}

export function clampWeight(w: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, w));
}

/** 候補: 行っていない見どころ・イベント。段差少なめの人は段差なしだけ。尽きたら行った所も戻す【仮定】 */
export function candidates(visited: readonly SpotId[], stepLess: boolean): Spot[] {
  const pool = SPOTS.filter((s) => s.kind !== 'shop' && (!stepLess || s.stepFree));
  const fresh = pool.filter((s) => !visited.includes(s.id));
  return fresh.length > 0 ? fresh : pool;
}

function score(s: Spot, input: ProphecyInput, visitedSpots: readonly Spot[], next: Season): { score: number; parts: { reason: Reason; points: number }[] } {
  const parts: { reason: Reason; points: number }[] = [];
  let total = 0;

  let tagSum = 0;
  let bestTag: Tag | null = null;
  let bestTagPts = 0;
  for (const tag of s.tags) {
    const pts = visitedSpots.filter((v) => v.tags.includes(tag)).length * W_TAG + (input.weights[tag] ?? 0);
    tagSum += pts;
    if (pts > bestTagPts) { bestTagPts = pts; bestTag = tag; }
  }
  total += tagSum;
  if (bestTag && tagSum > 0) parts.push({ reason: { code: 'tag', tag: bestTag, strength: strengthOf(tagSum) }, points: tagSum });

  const sim = W_SIMILAR * (input.similar[s.id] ?? 0);
  total += sim;
  if (sim > 0) parts.push({ reason: { code: 'similar', strength: strengthOf(sim) }, points: sim });

  if (s.season === next) {
    total += W_SEASON;
    parts.push({ reason: { code: 'season', strength: strengthOf(W_SEASON) }, points: W_SEASON });
  }
  if (input.stepLess && s.stepFree) {
    total += W_STEPFREE;
    parts.push({ reason: { code: 'stepfree', strength: strengthOf(W_STEPFREE) }, points: W_STEPFREE });
  }
  return { score: total, parts };
}

/** 点数の高い順。同点はスポット ID の並び（s1 < s2 < … < s11） */
export function rankProphecy(input: ProphecyInput): Scored[] {
  const next = nextSeason(seasonOf(input.today));
  const visitedSpots = SPOTS.filter((s) => input.visited.includes(s.id));
  const band = favoriteBand(input.hours);
  return candidates(input.visited, input.stepLess)
    .map((s) => {
      const r = score(s, input, visitedSpots, next);
      const reasons = [...r.parts].sort((a, b) => b.points - a.points).slice(0, 3).map((p) => p.reason);
      return { spotId: s.id, score: Math.round(r.score * 1000) / 1000, reasons, season: s.season === 'all' ? next : s.season, timeBand: band };
    })
    .sort((a, b) => b.score - a.score || SPOT_IDS.indexOf(a.spotId) - SPOT_IDS.indexOf(b.spotId));
}
