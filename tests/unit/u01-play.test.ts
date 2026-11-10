// U-01: さいころ・途中再開・二重送信・データ完全性・DEMO_MODE なし（T-023・T-028・T-051・T-060・T-065）
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allCounts, call, count, errCode, grantRolls, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import type { MeState, RollResult } from '../../app/shared/schemas.ts';
import { roll } from '../../app/server/src/services/roll-service.ts';

let s: TestServer;
beforeAll(async () => { s = await startServer({ demoMode: false }); });
afterAll(async () => { await s.close(); });

describe('T-023 さいころはサーバーが決める', () => {
  it('目は 1〜6 で回数が1減り、回数0で振ると 409', async () => {
    const g = newGuest();
    await session(s, g);
    const zero = await call(s, 'POST', '/api/rolls', g, { requestId: rid() });
    expect(zero.status).toBe(409);
    expect(errCode(zero)).toBe('conflict');
    grantRolls(s, g, 3);
    const faces = new Set<number>();
    let left = 3;
    // 「もう1回」マスに止まると回数が1増えるので、0になるまで振る（止まったマスの種類で期待値が変わる）
    for (let i = 0; i < 30 && left > 0; i += 1) {
      const r = await call(s, 'POST', '/api/rolls', g, { requestId: rid() });
      expect(r.status).toBe(200);
      const body = r.body as RollResult;
      expect(body.face).toBeGreaterThanOrEqual(1);
      expect(body.face).toBeLessThanOrEqual(6);
      left = left - 1 + (body.landed.kind === 'again' ? 1 : 0);
      expect(body.rollsLeft).toBe(left);
      expect(body.to - body.from).toBe(body.face);
      faces.add(body.face);
    }
    expect(left).toBe(0);
    const again = await call(s, 'POST', '/api/rolls', g, { requestId: rid() });
    expect(again.status).toBe(409);
  });
});

describe('T-028 途中再開', () => {
  it('日を進めても盤の位置・何枚目・残り回数が変わらない', async () => {
    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 3);
    await call(s, 'POST', '/api/rolls', g, { requestId: rid() });
    const before = (await call(s, 'GET', '/api/me', g)).body as MeState;
    s.setNow('2027-05-01T09:00:00+09:00');
    const after = (await call(s, 'POST', '/api/session', g, {})).body as MeState;
    s.setNow('2026-11-09T10:00:00+09:00');
    expect(after.board).toEqual(before.board);
    expect(after.visitKind).toBe('revisit');
    expect(after.rollsLeft).toBe(before.rollsLeft + 2);
  });
});

describe('T-051 DEMO_MODE なし', () => {
  it('/api/demo/* はふつうの 404 と同じ形で、DB は変わらない', async () => {
    const g = newGuest();
    await session(s, g);
    const before = allCounts(s.db);
    const normal = await call(s, 'GET', '/api/no-such', g);
    const reqs = [
      await call(s, 'PUT', '/api/demo/clock', g, { offsetDays: 7, hour: 10 }),
      await call(s, 'PUT', '/api/demo/location', g, { spotId: 's1' }),
      await call(s, 'POST', '/api/demo/rolls', g, { requestId: rid(), amount: 5 }),
    ];
    for (const r of reqs) {
      expect(r.status).toBe(404);
      expect(r.text).toBe(normal.text);
    }
    expect(allCounts(s.db)).toEqual(before);
    const cfg = await call(s, 'GET', '/api/config', null);
    expect(cfg.body).toEqual({ demoMode: false });
    expect(((await call(s, 'GET', '/api/me', g)).body as MeState).demo).toBeNull();
  });
});

describe('T-060 二重送信（さいころ）', () => {
  it('同じ requestId を2回送っても1回分だけ記録され、2回目は同じ結果', async () => {
    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 2);
    const id = rid();
    const rolls0 = count(s.db, 'rolls');
    const [a, b] = await Promise.all([
      call(s, 'POST', '/api/rolls', g, { requestId: id }),
      call(s, 'POST', '/api/rolls', g, { requestId: id }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(count(s.db, 'rolls')).toBe(rolls0 + 1);
    expect(((await call(s, 'GET', '/api/me', g)).body as MeState).rollsLeft).toBe(1);
  });
});

describe('T-065 データ完全性', () => {
  it('外部キー・CHECK・UNIQUE 違反を拒否する', () => {
    const db = s.db;
    expect(() => db.prepare("INSERT INTO users (id, created_at) VALUES ('bad', 'x')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO stamps (user_id, spot_id, day, hour) VALUES ('guest-zzzzzz', 's1', '2026-11-09', 10)").run()).toThrow();
    const g = newGuest();
    db.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)').run(g, '2026-11-09T10:00:00+09:00');
    expect(() => db.prepare('UPDATE users SET pos = 45 WHERE id = ?').run(g)).toThrow();
    db.prepare('UPDATE users SET pos = 44 WHERE id = ?').run(g);
    expect(() => db.prepare("INSERT INTO notes (user_id, spot_id, day, text, at) VALUES (?, 's1', '2026-11-09', '', 'x')").run(g)).toThrow();
    db.prepare("INSERT INTO grants (user_id, day, source, spot_key, amount, at) VALUES (?, '2026-11-09', 'qr', 's1', 1, 'x')").run(g);
    expect(() => db.prepare("INSERT INTO grants (user_id, day, source, spot_key, amount, at) VALUES (?, '2026-11-09', 'qr', 's1', 1, 'x')").run(g)).toThrow();
  });

  it('さいころの記録が途中で失敗すると回数・位置・クーポンが全部戻る', async () => {
    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 1);
    s.db.prepare('UPDATE users SET pos = 1 WHERE id = ?').run(g);
    const before = { rolls: count(s.db, 'rolls'), coupons: count(s.db, 'coupons'), requests: count(s.db, 'requests') };
    // 1→3 は🎁マス。振った記録と位置の更新の後、クーポンの作成で失敗させる
    s.db.exec("CREATE TEMP TRIGGER fail_coupon BEFORE INSERT ON coupons BEGIN SELECT RAISE(ABORT, 'test'); END");
    try {
      expect(() => roll(s.ctx, g, rid(), () => 2)).toThrow();
    } finally {
      s.db.exec('DROP TRIGGER fail_coupon');
    }
    expect(count(s.db, 'rolls')).toBe(before.rolls);
    expect(count(s.db, 'coupons')).toBe(before.coupons);
    expect(count(s.db, 'requests')).toBe(before.requests);
    const me = (await call(s, 'GET', '/api/me', g)).body as MeState;
    expect(me.board.pos).toBe(1);
    expect(me.rollsLeft).toBe(1);
  });

  it('日時は +09:00 付きの ISO 8601', async () => {
    const g = newGuest();
    await session(s, g);
    grantRolls(s, g, 1);
    await call(s, 'POST', '/api/rolls', g, { requestId: rid() });
    const row = s.db.prepare('SELECT at FROM rolls WHERE user_id = ?').get(g) as { at: string };
    expect(row.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
    const u = s.db.prepare('SELECT created_at FROM users WHERE id = ?').get(g) as { created_at: string };
    expect(u.created_at).toMatch(/\+09:00$/);
  });
});



