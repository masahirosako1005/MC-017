// 盤の座標（SC-05 §12）。SVG の viewBox は 360×860 で、画面の幅に合わせて拡大縮小する。スタートが左上、ゴールが左下（30マス＝6段）。
import { COLS, ROWS, cellOf } from '../../../shared/board.ts';

export const BOARD_W = 360;
export const BOARD_H = 860;
/** マスの大きさ（ゴールだけ大きい） */
export const CELL = 56;
export const GOAL_CELL = 64;
/** 駒の絵の大きさと、マスの中心から絵の上端までの高さ（絵はマスの上に立つ） */
export const PIECE_SIZE = 48;
export const PIECE_RISE = 70;

const COL_X = [44, 112, 180, 248, 316] as const;
const ROW0_Y = 76;
const ROW_PITCH = 104;

export function tileCenter(sq: number): [number, number] {
  const { row, col } = cellOf(sq);
  return [COL_X[col] ?? 0, ROW0_Y + row * ROW_PITCH];
}

/** 道: 段ごとに左右へ進み、端で次の段へ下りる */
export function trailPath(): string {
  return Array.from({ length: ROWS }, (_, r) => {
    const [a, y] = tileCenter(r * COLS);
    const [b] = tileCenter(r * COLS + COLS - 1);
    return `${r === 0 ? 'M' : 'L'}${a},${y} L${b},${y}`;
  }).join(' ');
}

