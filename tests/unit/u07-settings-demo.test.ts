// U-07 ホーム・アバター・設定・デモ: T-003・T-008・T-053・T-055
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, errCode, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import type { MeState } from '../../app/shared/schemas.ts';

let demo: TestServer;
let plain: TestServer;
beforeAll(async () => {
  demo = await startServer({ demoMode: true, now: '2026-11-09T10:00:00+09:00' });
  plain = await startServer({ demoMode: false, now: '2026-11-09T10:00:00+09:00' });
});
afterAll(async () => { await demo.close(); await plain.close(); });

const me = async (s: TestServer, g: string) => (await call(s, 'GET', '/api/me', g)).body as MeState;

describe('T-003 プロフィールの保存', () => {
  it('年齢・一緒に来た人・段差少なめを保存し、選ばない（null）に戻せる', async () => {
    const g = newGuest();
    await session(plain, g);
    const r = await call(plain, 'PATCH', '/api/me/profile', g, { age: '30s', companion: 'family', stepLess: true });
    expect(r.status).toBe(200);
    expect((r.body as MeState).profile).toMatchObject({ age: '30s', companion: 'family', stepLess: true });
    expect((await me(plain, g)).profile).toMatchObject({ age: '30s', companion: 'family', stepLess: true });
    const back = await call(plain, 'PATCH', '/api/me/profile', g, { age: null, companion: null });
    expect((back.body as MeState).profile).toMatchObject({ age: null, companion: null, stepLess: true });
  });

  it('許可外の値（70s・pet・文字列の段差・未知のキー・XSS・SQLi）は 400 で、保存は変わらない', async () => {
    const g = newGuest();
    await session(plain, g);
    await call(plain, 'PATCH', '/api/me/profile', g, { age: '20s' });
    const bad = [
      { age: '70s' }, { companion: 'pet' }, { stepLess: 'yes' }, { nickname: 'a' },
      { age: '<script>alert(1)</script>' }, { companion: "solo' OR '1'='1" }, { avatar: 'cat' },
    ];
    for (const body of bad) {
      const r = await call(plain, 'PATCH', '/api/me/profile', g, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(errCode(r)).toBe('bad_request');
    }
    expect((await me(plain, g)).profile).toMatchObject({ age: '20s', companion: null, stepLess: false });
  });
});

describe('T-008 準備中のアバター', () => {
  it('初期はともにゃん。4枚揃わない体は available:false で、選ぶ API も 400', async () => {
    const s = await startServer({ demoMode: false, avatars: new Set(['tomonyan', 'hoshirou', 'pikkon'] as const) });
    try {
      const g = newGuest();
      await session(s, g);
      expect((await me(s, g)).profile.avatar).toBe('tomonyan');
      const list = (await call(s, 'GET', '/api/avatars', g)).body as { id: string; available: boolean }[];
      expect(list).toEqual([
        { id: 'tomonyan', available: true }, { id: 'hoshirou', available: true },
        { id: 'pikkon', available: true }, { id: 'toujii', available: false },
      ]);
      const r = await call(s, 'PATCH', '/api/me/profile', g, { avatar: 'toujii' });
      expect(r.status).toBe(400);
      expect((await me(s, g)).profile.avatar).toBe('tomonyan');
      const ok = await call(s, 'PATCH', '/api/me/profile', g, { avatar: 'pikkon' });
      expect((ok.body as MeState).profile.avatar).toBe('pikkon');
    } finally {
      await s.close();
    }
  });
});

describe('T-053 デモの日時', () => {
  it('＋1日で旅の2日目、さらに＋7日で再訪。時刻も変わり、もとに戻せる', async () => {
    const g = newGuest();
    await session(demo, g);
    const first = await me(demo, g);
    expect(first).toMatchObject({ today: '2026-11-09', hour: 10, visitKind: 'first', bonus: null });

    await call(demo, 'PUT', '/api/demo/clock', g, { offsetDays: 1, hour: 19 });
    const d2 = (await call(demo, 'POST', '/api/session', g, {})).body as MeState;
    expect(d2).toMatchObject({ today: '2026-11-10', hour: 19, visitKind: 'day2', bonus: { source: 'day2', amount: 1 } });

    await call(demo, 'PUT', '/api/demo/clock', g, { offsetDays: 8, hour: null });
    const rv = (await call(demo, 'POST', '/api/session', g, {})).body as MeState;
    expect(rv).toMatchObject({ today: '2026-11-17', hour: 10, visitKind: 'revisit', bonus: { source: 'revisit', amount: 2 } });
    expect(rv.demo).toEqual({ offsetDays: 8, hour: null, location: null });

    const reset = (await call(demo, 'PUT', '/api/demo/clock', g, { offsetDays: 0, hour: null })).body as MeState;
    expect(reset).toMatchObject({ today: '2026-11-09', hour: 10 });
  });

  it('範囲外・負の日数・小数・未知のキーは 400', async () => {
    const g = newGuest();
    await session(demo, g);
    for (const body of [{ offsetDays: -1, hour: null }, { offsetDays: 1.5, hour: null }, { offsetDays: 1, hour: 24 }, { offsetDays: 1, hour: null, x: 1 }]) {
      expect((await call(demo, 'PUT', '/api/demo/clock', g, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('DEMO_MODE なしでは無視され（404）、今日は実際の日のまま', async () => {
    const g = newGuest();
    await session(plain, g);
    expect((await call(plain, 'PUT', '/api/demo/clock', g, { offsetDays: 7, hour: 10 })).status).toBe(404);
    const after = (await call(plain, 'POST', '/api/session', g, {})).body as MeState;
    expect(after).toMatchObject({ today: '2026-11-09', visitKind: 'first', demo: null });
  });
});

describe('T-053 デモの「もとに戻す」', () => {
  it('盤を1枚目の最初に戻し、年齢・一緒に来た人・日時・場所を空にする。アバターは残す', async () => {
    const g = newGuest();
    await session(demo, g);
    await call(demo, 'PATCH', '/api/me/profile', g, { age: '30s', companion: 'family', stepLess: true, avatar: 'pikkon' });
    await call(demo, 'PUT', '/api/demo/clock', g, { offsetDays: 3, hour: 20 });
    await call(demo, 'PUT', '/api/demo/location', g, { spotId: 's1' });
    for (let i = 0; i < 3; i += 1) {
      await call(demo, 'POST', '/api/demo/rolls', g, { requestId: rid(), amount: 5 });
    }
    for (let i = 0; i < 12; i += 1) await call(demo, 'POST', '/api/rolls', g, { requestId: rid() });
    const moved = (await me(demo, g)).board;
    expect(moved.no > 1 || moved.pos > 0).toBe(true);
    const r = await call(demo, 'POST', '/api/demo/reset', g, {});
    expect(r.status).toBe(200);
    const m = r.body as MeState;
    expect(m.board).toMatchObject({ no: 1, pos: 0 });
    expect(m.profile).toEqual({ age: null, companion: null, stepLess: false, avatar: 'pikkon' });
    expect(m.demo).toEqual({ offsetDays: 0, hour: null, location: null });
    expect((await me(demo, g)).board).toMatchObject({ no: 1, pos: 0 });
  });

  it('未知のキーは 400。DEMO_MODE なしでは 404', async () => {
    const g = newGuest();
    await session(demo, g);
    expect((await call(demo, 'POST', '/api/demo/reset', g, { x: 1 })).status).toBe(400);
    await session(plain, g);
    expect((await call(plain, 'POST', '/api/demo/reset', g, {})).status).toBe(404);
  });
});

describe('T-055 デモのさいころ ＋5', () => {
  it('DEMO_MODE のときだけ5回増え、記録の種類は demo。同じ requestId は1回分', async () => {
    const g = newGuest();
    await session(demo, g);
    const before = (await me(demo, g)).rollsLeft;
    const id = rid();
    const a = (await call(demo, 'POST', '/api/demo/rolls', g, { requestId: id, amount: 5 })).body as MeState;
    const b = (await call(demo, 'POST', '/api/demo/rolls', g, { requestId: id, amount: 5 })).body as MeState;
    expect(a.rollsLeft).toBe(before + 5);
    expect(b.rollsLeft).toBe(before + 5);
    const rows = demo.db.prepare("SELECT source, amount FROM grants WHERE user_id = ? AND source = 'demo'").all(g);
    expect(rows).toEqual([{ source: 'demo', amount: 5 }]);
    expect((await call(demo, 'POST', '/api/demo/rolls', g, { requestId: rid(), amount: 11 })).status).toBe(400);

    const p = newGuest();
    await session(plain, p);
    expect((await call(plain, 'POST', '/api/demo/rolls', p, { requestId: rid(), amount: 5 })).status).toBe(404);
    expect(plain.db.prepare("SELECT count(*) AS n FROM grants WHERE user_id = ? AND source = 'demo'").get(p)).toEqual({ n: 0 });
  });

  it('デモのいる場所を保存し、選ばない（null）に戻せる。未知のスポットは 400', async () => {
    const g = newGuest();
    await session(demo, g);
    const r = (await call(demo, 'PUT', '/api/demo/location', g, { spotId: 's3' })).body as MeState;
    expect(r.demo?.location).toBe('s3');
    expect((await call(demo, 'PUT', '/api/demo/location', g, { spotId: 's99' })).status).toBe(400);
    const off = (await call(demo, 'PUT', '/api/demo/location', g, { spotId: null })).body as MeState;
    expect(off.demo?.location).toBeNull();
  });
});
