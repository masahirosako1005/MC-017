// QR・ひとこと・誘う（R-013〜R-015）。どれも1スポット1日1回だけさいころ +1。同じ requestId は1回分（ADR-006）。
import type { Ctx } from './context.ts';
import { appNow, once } from './context.ts';
import type { Trigger, TriggerResult } from '../../../shared/schemas.ts';
import type { SpotId } from '../../../shared/master/spots.ts';
import { notFound } from '../http/errors.ts';
import { checkOnQr } from './prophecy-service.ts';
import { insertGrant, insertNote, insertStamp, rollsLeft } from '../repositories/play-repo.ts';
import { completePlan } from '../repositories/plan-repo.ts';
import { insertInvite } from '../repositories/invite-repo.ts';
import { findUser } from '../repositories/user-repo.ts';

export const TRIGGER_AMOUNT = 1;

function trigger(ctx: Ctx, userId: string, spotId: SpotId, requestId: string, kind: Trigger, extra: (now: { day: string; hour: number; at: string }) => void, grantKey: string = spotId): TriggerResult {
  const user = findUser(ctx.db, userId);
  if (!user) throw notFound();
  const now = appNow(ctx, user);
  return once(ctx, userId, requestId, kind, now.at, () => {
    extra(now);
    const granted = insertGrant(ctx.db, userId, now.day, kind, grantKey, TRIGGER_AMOUNT, now.at);
    const prophecyCheck = kind === 'qr' ? checkOnQr(ctx, userId, spotId, now) : null;
    return { granted, rollsLeft: rollsLeft(ctx.db, userId), prophecyCheck };
  });
}

export function scanQr(ctx: Ctx, userId: string, spotId: SpotId, requestId: string): TriggerResult {
  return trigger(ctx, userId, spotId, requestId, 'qr', (now) => {
    insertStamp(ctx.db, userId, spotId, now.day, now.hour);
    completePlan(ctx.db, userId, spotId, now.day);
  });
}

/** ひとことは毎回残す（さいころは1スポット1日1回）。本文は前後の空白を除いて保存する */
export function writeNote(ctx: Ctx, userId: string, spotId: SpotId, requestId: string, text: string): TriggerResult {
  return trigger(ctx, userId, spotId, requestId, 'note', (now) => {
    insertNote(ctx.db, userId, spotId, now.day, text.trim(), now.at, true);
  });
}

/** 誘うは1日に何回でもできる【仮定】。送るたびに +1 するため、付与の一意キーに requestId を入れる（二重送信は once が1回分にする） */
export function sendInvite(ctx: Ctx, userId: string, spotId: SpotId, requestId: string): TriggerResult {
  return trigger(ctx, userId, spotId, requestId, 'invite', (now) => {
    insertInvite(ctx.db, userId, spotId, now.day, now.at, requestId);
  }, `${spotId}:${requestId}`);
}
