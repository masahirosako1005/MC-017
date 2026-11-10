// U-03: マスの結果・ゴールと2枚目・効果音（T-026・T-027・T-029）
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, grantRolls, newGuest, rid, session, startServer, call, type TestServer } from './helpers.ts';
import type { MeState, RollResult } from '../../app/shared/schemas.ts';
import { roll } from '../../app/server/src/services/roll-service.ts';
import Database from 'better-sqlite3';
import { BOARD_SIZE, COLS, GOAL, ROWS, cellOf, layoutFor, nearInfo, squareKind } from '../../app/shared/board.ts';
import { giftType } from '../../app/shared/master/coupons.ts';
import { normalizeBoardPositions } from '../../app/server/src/db.ts';

let s: TestServer;
beforeAll(async () => { s = await startServer({ demoMode: false }); });
afterAll(async () => { await s.close(); });

function place(guest: string, boardNo: number, pos: number): void {
  s.db.prepare('UPDATE users SET board_no = ?, pos = ? WHERE id = ?').run(boardNo, pos, guest);
}

describe('T-026 マスの結果', () => {
  it('🎁マスに止まるとクーポンが1枚増え、同じ盤の同じマスでは2枚目は出ない', async () => {
    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 2);
    place(g, 1, 1);
    const c0 = count(s.db, 'coupons');
    const first = roll(s.ctx, g, rid(), () => 2) as RollResult;
    expect(squareKind(1, 3)).toBe('gift');
    expect(first.to).toBe(3);
    expect(first.landed.kind).toBe('gift');
    expect(count(s.db, 'coupons')).toBe(c0 + 1);

    place(g, 1, 1);
    roll(s.ctx, g, rid(), () => 2);
    expect(count(s.db, 'coupons')).toBe(c0 + 1);
  });

  it('「もう1回」マスは各盤に5つ。止まるとさいころが1回増え、同じマスでは二重に増えない。🎁は割引とプレゼントに分かれる', async () => {
    expect(layoutFor(1).agains).toHaveLength(5);
    expect(layoutFor(2).agains).toHaveLength(5);
    expect(squareKind(1, 5)).toBe('again');
    const types = layoutFor(1).gifts.map((sq) => giftType(1, sq));
    expect(types).toContain('discount');
    expect(types).toContain('present');
    expect(giftType(1, 1)).toBe('discount'); // souv10（お土産 10%オフ）

    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 2);
    place(g, 1, 2);
    const r = roll(s.ctx, g, rid(), () => 3) as RollResult;
    expect(r.to).toBe(5);
    expect(r.landed.kind).toBe('again');
    expect(r.rollsLeft).toBe(2); // 2回 - 1回 + 1回
    place(g, 1, 2);
    const r2 = roll(s.ctx, g, rid(), () => 3) as RollResult;
    expect(r2.landed.kind).toBe('again');
    expect(r2.rollsLeft).toBe(2); // 同じ日に同じマスへ止まり直しても、止まるたびに +1（2 - 1 + 1）
  });

  it('🎁かゴールまで3マス以内なら「あと n マス」、両方ならゴールを優先', async () => {
    expect(nearInfo(1, 3)).toEqual({ kind: 'gift', steps: 3 });
    // 26 からは ゴール(29) まで3、🎁(27) まで1 → ゴールを優先
    expect(layoutFor(1).gifts).toContain(27);
    expect(nearInfo(1, 26)).toEqual({ kind: 'goal', steps: 3 });

    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 1);
    const r = roll(s.ctx, g, rid(), () => 1) as RollResult;
    expect(r.to).toBe(1);
    expect(r.near).toEqual({ kind: 'gift', steps: 2 });
  });
});

describe('T-027 ゴールと2枚目', () => {
  it('ゴールを越える目でもゴールで止まり、ゴール特典が出て2枚目が始まる', async () => {
    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 1);
    place(g, 1, 26);
    const r = roll(s.ctx, g, rid(), () => 6) as RollResult;
    expect(r.to).toBe(GOAL);
    expect(r.landed.kind).toBe('goal');
    if (r.landed.kind !== 'goal') throw new Error('goal');
    expect(r.landed.coupon.templateId).toBe('goal');
    expect(r.landed.nextBoard).toBe(2);
    const me = (await call(s, 'GET', '/api/me', g)).body as MeState;
    expect(me.board).toMatchObject({ no: 2, pos: 0 });
  });

  it('2枚目は🎁15マス・季節のマスがあり、1枚目と並びが違う', () => {
    const kinds = (no: number) => Array.from({ length: BOARD_SIZE }, (_, sq) => squareKind(no, sq));
    const b1 = kinds(1);
    const b2 = kinds(2);
    expect(b2.filter((k) => k === 'gift')).toHaveLength(15);
    expect(b2.filter((k) => k === 'season').length).toBeGreaterThan(0);
    expect(b1.filter((k) => k === 'season')).toHaveLength(0);
    expect(b2).not.toEqual(b1);
  });
});

describe('T-029 効果音（音声ファイル）', () => {
  // 「効果音なしでは Web Audio を作らない」は tests/unit/client/u03-sfx.test.ts（DOM の型で検査する）
  it('アプリに音声ファイル（wav・mp3・ogg）が無い', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      let names: string[];
      try { names = readdirSync(dir); } catch { return; }
      for (const n of names) {
        if (n === 'node_modules') continue;
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(n)) found.push(p);
      }
    };
    walk('app');
    walk('dist');
    expect(found).toEqual([]);
  });
});

describe('T-067 盤の定義（30マス・特典は1/2・左上から左下）', () => {
  it('1段5マス×6段＝30マス。スタートは左上、ゴールは左下、段ごとに左右交互', () => {
    expect([COLS, ROWS, BOARD_SIZE, GOAL]).toEqual([5, 6, 30, 29]);
    expect(cellOf(0)).toEqual({ row: 0, col: 0 });
    expect(cellOf(4)).toEqual({ row: 0, col: 4 });
    expect(cellOf(5)).toEqual({ row: 1, col: 4 });
    expect(cellOf(9)).toEqual({ row: 1, col: 0 });
    expect(cellOf(GOAL)).toEqual({ row: ROWS - 1, col: 0 });
    const seen = new Set(Array.from({ length: BOARD_SIZE }, (_, sq) => `${cellOf(sq).row},${cellOf(sq).col}`));
    expect(seen.size).toBe(BOARD_SIZE);
  });

  it('どの盤も特典マスは30マスのちょうど1/2（15マス）。特典・スポット・季節・もう1回がスタート・ゴール・おたがいと重ならない', () => {
    for (const no of [1, 2]) {
      const l = layoutFor(no);
      expect(l.gifts).toHaveLength(BOARD_SIZE / 2);
      const marked = [...l.gifts, ...Object.keys(l.spots).map(Number), ...l.seasons, ...l.agains];
      expect(new Set(marked).size).toBe(marked.length);
      for (const sq of marked) {
        expect(sq).toBeGreaterThan(0);
        expect(sq).toBeLessThan(GOAL);
      }
    }
  });

  it('もっと大きな盤だった頃のファイルDBに残る盤の外の位置は、ゴールの1つ手前へ戻る（範囲内は変えない）', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, pos INTEGER NOT NULL)');
    const ins = db.prepare('INSERT INTO users (id, pos) VALUES (?, ?)');
    for (const [id, pos] of [['a', 3], ['b', 29], ['c', 30], ['d', 49]] as const) ins.run(id, pos);
    expect(normalizeBoardPositions(db)).toBe(2);
    const rows = db.prepare('SELECT id, pos FROM users ORDER BY id').all();
    expect(rows).toEqual([{ id: 'a', pos: 3 }, { id: 'b', pos: 29 }, { id: 'c', pos: 28 }, { id: 'd', pos: 28 }]);
    expect(normalizeBoardPositions(db)).toBe(0);
    db.close();
  });
});



