import type { Db } from '../db.ts';
import type { AvatarId } from '../../../shared/master/avatars.ts';
import { addDays, isoJst, toJst } from '../../../shared/dates.ts';
import type { UserRow } from '../repositories/user-repo.ts';
import { findResponse, saveResponse } from '../repositories/request-repo.ts';

export interface Ctx {
  db: Db;
  demoMode: boolean;
  /** 運営向け（/admin）を出すか。省略は false */
  adminMode?: boolean;
  /** 実際の今。試験では固定の時計を渡す */
  clock: () => Date;
  /** 4枚の絵がそろったアバター（R-006） */
  avatars: ReadonlySet<AvatarId>;
}

export interface AppNow {
  day: string;
  hour: number;
  at: string;
}

/** アプリ内の今（ADR-008）。DEMO_MODE でないときはデモのずれを読まない */
export function appNow(ctx: Ctx, user: Pick<UserRow, 'demo_offset_days' | 'demo_hour'> | undefined): AppNow {
  const now = ctx.clock();
  const j = toJst(now);
  if (!ctx.demoMode || !user) return { day: j.day, hour: j.hour, at: isoJst(now) };
  const day = addDays(j.day, user.demo_offset_days);
  const hour = user.demo_hour ?? j.hour;
  return { day, hour, at: `${day}T${String(hour).padStart(2, '0')}${isoJst(now).slice(13)}` };
}

/**
 * 同じ requestId の2回目は保存した応答を返す（ADR-006）。
 * fn は呼び出し側のトランザクションの中で動き、失敗すれば応答も保存されない。
 */
export function once<T>(ctx: Ctx, userId: string, requestId: string, kind: string, at: string, fn: () => T): T {
  return ctx.db.transaction(() => {
    const saved = findResponse(ctx.db, userId, requestId);
    if (saved !== undefined) return JSON.parse(saved) as T;
    const result = fn();
    saveResponse(ctx.db, userId, requestId, kind, JSON.stringify(result), at);
    return result;
  })();
}
