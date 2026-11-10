// さいころ（ADR-007）。回数の確認・目・位置・記録・クーポン・ゴールを1トランザクションで行う。
import { randomInt } from 'node:crypto';
import type { Ctx } from './context.ts';
import { appNow, once } from './context.ts';
import { ensureExtras, landOnExtra } from './board-extras-service.ts';
import { grantCoupon } from './coupon-service.ts';
import { GOAL, advance, nearInfo, squareKind, squareSpot } from '../../../shared/board.ts';
import { giftTemplate } from '../../../shared/master/coupons.ts';
import { seasonOf } from '../../../shared/dates.ts';
import type { Landed, RollResult } from '../../../shared/schemas.ts';
import { conflict, notFound } from '../http/errors.ts';
import { insertGrant, insertRoll, rollsLeft } from '../repositories/play-repo.ts';
import { findUser, updateBoard } from '../repositories/user-repo.ts';

export type FaceSource = () => number;
export const cryptoFace: FaceSource = () => randomInt(1, 7);

export function roll(ctx: Ctx, userId: string, requestId: string, face: FaceSource = cryptoFace): RollResult {
  const user = findUser(ctx.db, userId);
  if (!user) throw notFound();
  const now = appNow(ctx, user);
  return once(ctx, userId, requestId, 'roll', now.at, () => {
    const u = findUser(ctx.db, userId);
    if (!u) throw notFound();
    if (rollsLeft(ctx.db, userId) < 1) throw conflict();
    const f = face();
    if (!Number.isInteger(f) || f < 1 || f > 6) throw new Error('face out of range');
    ensureExtras(ctx, u, now.day);
    const boardNo = u.board_no;
    const from = u.pos;
    const to = advance(from, f);
    insertRoll(ctx.db, userId, boardNo, f, from, to, now.at);

    let landed: Landed;
    const kind = squareKind(boardNo, to);
    if (kind === 'goal') {
      const coupon = grantCoupon(ctx, userId, 'goal', boardNo, GOAL, now.day);
      updateBoard(ctx.db, userId, boardNo + 1, 0);
      landed = { kind: 'goal', coupon, nextBoard: boardNo + 1 };
    } else {
      updateBoard(ctx.db, userId, boardNo, to);
      if (kind === 'gift') {
        landed = { kind: 'gift', coupon: grantCoupon(ctx, userId, giftTemplate(boardNo, to), boardNo, to, now.day) };
      } else if (kind === 'again') {
        // 止まるたびに必ず +1（同じ日に同じマスへ止まり直しても。requestId で1回の振りにつき1回）
        insertGrant(ctx.db, userId, now.day, 'again', `${boardNo}:${to}:${requestId}`, 1, now.at);
        landed = { kind: 'again' };
      } else if (kind === 'spot' || kind === 'season') {
        const spotId = squareSpot(boardNo, to, seasonOf(now.day));
        landed = spotId ? { kind, spotId } : { kind: 'normal' };
      } else {
        const shopCoupon = kind === 'normal' ? landOnExtra(ctx, userId, boardNo, to, now.day) : null;
        landed = shopCoupon ? { kind: 'shop', coupon: shopCoupon } : { kind: 'normal' };
      }
    }
    return {
      face: f,
      boardNo,
      from,
      to,
      rollsLeft: rollsLeft(ctx.db, userId),
      landed,
      near: kind === 'goal' ? null : nearInfo(boardNo, to),
    };
  });
}
