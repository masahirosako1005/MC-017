// 盤（R-018、SC-05 §12）。9段×5マスのジグザグ。左上がスタート、右下がゴール（名古屋城）。駒はアバター。
// 絵と同じ SVG の中にマスを置き、画面の幅に合わせて拡大縮小する。
import { useEffect, useRef } from 'react';
import type { AvatarId } from '../../../shared/master/avatars.ts';
import type { BoardExtra } from '../../../shared/schemas.ts';
import { BOARD_SIZE, squareKind, type SquareKind } from '../../../shared/board.ts';
import { giftType } from '../../../shared/master/coupons.ts';
import { useT } from '../i18n/index.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { IC, type IconName } from '../ui/Icon.tsx';
import { BoardArt } from './BoardArt.tsx';
import { BOARD_H, BOARD_W, CELL, GOAL_CELL, PIECE_RISE, PIECE_SIZE, tileCenter } from './geometry.ts';

const KIND_ICON: Partial<Record<SquareKind, IconName>> = { gift: 'gift', spot: 'pin', season: 'star', again: 'again', start: 'station', goal: 'castle' };
const KIND_CLASS: Readonly<Record<SquareKind, string>> = { gift: 'gift', spot: 'spot', season: 'event', again: 'again', start: 'start', goal: 'goal', normal: 'normal' };

/** 🏪 は、店のキャンペーンのマス（U-11）。普通のマスの上に重ねる */
function Tile({ sq, boardNo, now, shop }: { sq: number; boardNo: number; now: boolean; shop: boolean }) {
  const { t } = useT();
  const kind = squareKind(boardNo, sq);
  const [cx, cy] = tileCenter(sq);
  const size = kind === 'goal' ? GOAL_CELL : CELL;
  const h = size / 2;
  const discount = !shop && kind === 'gift' && giftType(boardNo, sq) === 'discount';
  const ic = shop ? 'bag' : discount ? 'percent' : KIND_ICON[kind];
  const no = String(sq + 1);
  const label = shop ? t('tShop') : kind === 'start' ? t('tStart') : kind === 'goal' ? t('tGoal') : kind === 'gift' ? t(discount ? 'tDiscount' : 'tPresent') : kind === 'again' ? t('tAgain') : kind === 'spot' ? t('tSpot') : kind === 'season' ? t('tSeason') : '';
  const small = shop || kind === 'gift' || kind === 'again' || kind === 'spot' || kind === 'season';
  return (
    <g className={`tile ${shop ? 'shop' : discount ? 'discount' : KIND_CLASS[kind]}${now ? ' now' : ''}`} data-sq={sq} transform={`translate(${cx - h} ${cy - h})`}>
      <rect width={size} height={size} rx={16} />
      {kind === 'normal' && !shop && <text className="n" x={h} y={37}>{no}</text>}
      {small && <text className="tn" x={7} y={15}>{no}</text>}
      {ic && (
        <g transform={`translate(${kind === 'goal' ? 18 : 16} ${kind === 'goal' ? 8 : 9}) scale(${kind === 'goal' ? 28 / 24 : 1})`}
          fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d={IC[ic]} />
        </g>
      )}
      {label && <text className="lb" x={h} y={kind === 'goal' ? 53 : kind === 'start' ? 47 : 48}>{label}</text>}
    </g>
  );
}

/**
 * 駒を、スクロールする本体（main）の見える範囲に入れる。force なら真ん中へ。そうでなければ、上下 30% の外に出たときだけ真ん中へ寄せる
 * （1マスごとに動かすと画面が揺れるため）。駒の位置は、動いている途中の見た目ではなく盤の座標（pos のマス）から求める。
 * 外側の枠（.phone など）は動かさない。動きを減らす設定ではすぐに移る。
 */
export function keepInView(board: HTMLElement, pos: number, force: boolean): void {
  const box = board.closest('main');
  if (!box) return;
  const b = box.getBoundingClientRect();
  const r = board.getBoundingClientRect();
  const mid = r.top + ((tileCenter(pos)[1] - PIECE_RISE + PIECE_SIZE / 2) / BOARD_H) * r.height;
  const margin = b.height * 0.3;
  if (!force && mid > b.top + margin && mid < b.bottom - margin) return;
  const top = box.scrollTop + (mid - b.top) - b.height / 2;
  box.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

interface Props {
  boardNo: number;
  pos: number;
  avatar: AvatarId;
  hop: number;
  /** 増えるたびに、駒を画面の真ん中へ寄せる（さいころを閉じて駒が動き出す前など） */
  reveal?: number;
  /** 盤の上の 🏪（店のキャンペーン） */
  extras?: readonly BoardExtra[];
}

export function Board({ boardNo, pos, avatar, hop, reveal = 0, extras = [] }: Props) {
  const piece = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [px, py] = tileCenter(pos);

  // 駒が動くときも、振る前に別の場所を見ていたときも、駒が画面（main）の中に見えるようにする
  useEffect(() => {
    if (root.current) keepInView(root.current, pos, true);
  }, [boardNo, reveal]);
  useEffect(() => {
    if (root.current) keepInView(root.current, pos, false);
  }, [pos]);

  useEffect(() => {
    const el = piece.current;
    if (!el || hop === 0) return;
    el.classList.remove('hop');
    void el.offsetWidth;
    el.classList.add('hop');
  }, [hop]);

  return (
    <div ref={root} className="board wide" aria-hidden="true" data-board={boardNo}>
      <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} focusable="false">
        <BoardArt winter={boardNo > 1} />
        {Array.from({ length: BOARD_SIZE }, (_, sq) => <Tile key={sq} sq={sq} boardNo={boardNo} now={sq === pos} shop={extras.some((e) => e.square === sq)} />)}
      </svg>
      <div ref={piece} className="piece" data-pos={pos} style={{
        left: `${((px - PIECE_SIZE / 2) / BOARD_W) * 100}%`,
        top: `${((py - PIECE_RISE) / BOARD_H) * 100}%`,
        width: `${(PIECE_SIZE / BOARD_W) * 100}%`,
      }}>
        <Avatar id={avatar} size={PIECE_SIZE} decorative />
      </div>
    </div>
  );
}
