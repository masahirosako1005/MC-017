// 盤（データ設計 §2.2・§2.3、ADR-007）。サーバーとクライアントの両方が使う純粋な計算。
import { SEASON_EVENT_SPOT, type Season, type SpotId } from './master/spots.ts';
import { nextSeason } from './dates.ts';

/** 1段5マス × 6段＝30マス。左上スタート。段ごとに左右交互なので、ゴールは左下になる（ADR-021 の右下から変更【仮定】） */
export const COLS = 5;
export const ROWS = 6;
export const BOARD_SIZE = COLS * ROWS;
export const GOAL = BOARD_SIZE - 1;

export interface Layout {
  gifts: readonly number[];
  spots: Readonly<Record<number, SpotId>>;
  seasons: readonly number[];
  /** 「もう1回」マス。止まるとさいころが1回増える */
  agains: readonly number[];
}

/** 1枚目: 特典マスは30マスの1/2（15マス）。ゴール3マス前の27は、ゴール優先の「あと n マス」を試す並び */
const BOARD1: Layout = {
  gifts: [1, 3, 6, 7, 9, 10, 12, 15, 16, 18, 19, 21, 24, 25, 27],
  spots: { 2: 's5', 8: 's7', 14: 's3', 20: 's6', 26: 's2' },
  seasons: [],
  agains: [5, 11, 17, 23, 28],
};

/** 2枚目: 特典マスは1枚目と同じ15（30マスの1/2）。季節のマス5・スポット2。並びは1枚目と変える【仮定】 */
const BOARD2: Layout = {
  gifts: [1, 3, 5, 7, 8, 10, 11, 13, 15, 16, 18, 20, 21, 24, 26],
  spots: { 9: 's1', 22: 's5' },
  seasons: [6, 14, 19, 25, 27],
  agains: [4, 12, 17, 23, 28],
};

/** 3枚目以降は2枚目と同じ並び【仮定】 */
export function layoutFor(boardNo: number): Layout {
  return boardNo <= 1 ? BOARD1 : BOARD2;
}

export type SquareKind = 'start' | 'goal' | 'gift' | 'spot' | 'season' | 'again' | 'normal';

export function squareKind(boardNo: number, sq: number): SquareKind {
  if (sq === 0) return 'start';
  if (sq === GOAL) return 'goal';
  const l = layoutFor(boardNo);
  if (l.gifts.includes(sq)) return 'gift';
  if (l.spots[sq] !== undefined) return 'spot';
  if (l.seasons.includes(sq)) return 'season';
  if (l.agains.includes(sq)) return 'again';
  return 'normal';
}

/** スポットマスのスポット。季節マスは今日の次の季節のイベント */
export function squareSpot(boardNo: number, sq: number, todaySeason: Season): SpotId | null {
  const kind = squareKind(boardNo, sq);
  if (kind === 'spot') return layoutFor(boardNo).spots[sq] ?? null;
  if (kind === 'season') return SEASON_EVENT_SPOT[nextSeason(todaySeason)];
  return null;
}

/** 越える目でもゴールで止まる（方向性 §16.3） */
export function advance(pos: number, face: number): number {
  return Math.min(pos + face, GOAL);
}

/** 🎁かゴールまで3マス以内なら残りマス数（ゴール優先）。今いるマスは数えない */
export function nearInfo(boardNo: number, pos: number): { kind: 'gift' | 'goal'; steps: number } | null {
  const toGoal = GOAL - pos;
  if (toGoal >= 1 && toGoal <= 3) return { kind: 'goal', steps: toGoal };
  const next = layoutFor(boardNo).gifts.find((g) => g > pos);
  if (next !== undefined && next - pos <= 3) return { kind: 'gift', steps: next - pos };
  return null;
}

export function nextGift(boardNo: number, pos: number): number | null {
  return layoutFor(boardNo).gifts.find((g) => g > pos) ?? null;
}

/** 盤の上の位置（列・段）。0 段目が一番上（スタートが左上）、段ごとに左右交互のジグザグ */
export function cellOf(sq: number): { row: number; col: number } {
  const row = Math.floor(sq / COLS);
  const i = sq % COLS;
  return { row, col: row % 2 === 0 ? i : COLS - 1 - i };
}

