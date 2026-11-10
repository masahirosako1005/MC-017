// U-02 スポット: T-005・T-017・T-018・T-020・T-021・T-022・T-060（きっかけ3種）
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { allCounts, call, count, errCode, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import { COURSES, coursesFor } from '../../app/shared/master/courses.ts';
import { DUMMY_VOICES, dummyVoices, nearbyShops } from '../../app/shared/master/voices.ts';
import { SPOTS, distanceM, spotById } from '../../app/shared/master/spots.ts';
import type { MeState, TriggerResult } from '../../app/shared/schemas.ts';

let s: TestServer;
let g: string;
beforeEach(async () => {
  s = await startServer();
  g = newGuest();
  await session(s, g);
});
afterEach(async () => { await s.close(); });

async function me(): Promise<MeState> {
  return (await call(s, 'GET', '/api/me', g)).body as MeState;
}

describe('T-005 おすすめコース', () => {
  it('時間・距離・休憩所の数を持ち、段差少なめでは段差のあるコースが消える', () => {
    for (const c of COURSES) {
      expect(c.hours).toBeGreaterThan(0);
      expect(c.km).toBeGreaterThan(0);
      expect(c.rest).toBeGreaterThanOrEqual(0);
      for (const id of c.spots) expect(spotById(id).id).toBe(id);
    }
    expect(COURSES.some((c) => !c.stepFree)).toBe(true);
    expect(coursesFor(false)).toHaveLength(COURSES.length);
    const free = coursesFor(true);
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((c) => c.stepFree)).toBe(true);
  });
});

describe('T-017 QR（見本）', () => {
  it('+1 とスタンプ、同じスポットの2回目は今日は済み、別スポットは +1', async () => {
    const before = (await me()).rollsLeft;
    const a = await call(s, 'POST', '/api/spots/s1/qr', g, { requestId: rid() });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ granted: true, rollsLeft: before + 1, prophecyCheck: null });
    const b = await call(s, 'POST', '/api/spots/s1/qr', g, { requestId: rid() });
    expect((b.body as TriggerResult).granted).toBe(false);
    expect((b.body as TriggerResult).rollsLeft).toBe(before + 1);
    const c = await call(s, 'POST', '/api/spots/s2/qr', g, { requestId: rid() });
    expect((c.body as TriggerResult).granted).toBe(true);
    const m = await me();
    expect(m.stamps).toBe(2);
    expect(m.doneToday.s1).toEqual(['qr']);
    s.setNow('2026-11-10T10:00:00+09:00');
    await session(s, g);
    const d = await call(s, 'POST', '/api/spots/s1/qr', g, { requestId: rid() });
    expect((d.body as TriggerResult).granted).toBe(true);
  });

  it('知らないスポットと形式外は 400 で何も増えない', async () => {
    const before = allCounts(s.db);
    for (const sp of ['s99', 'S1', "s1' OR '1'='1", '..%2Fs1']) {
      const r = await call(s, 'POST', `/api/spots/${encodeURIComponent(sp)}/qr`, g, { requestId: rid() });
      expect(r.status).toBe(400);
    }
    const r2 = await call(s, 'POST', '/api/spots/s1/qr', g, { requestId: rid(), extra: 1 });
    expect(r2.status).toBe(400);
    const r3 = await call(s, 'POST', '/api/spots/s1/qr', g, {});
    expect(r3.status).toBe(400);
    expect(allCounts(s.db)).toEqual(before);
  });
});

describe('T-018 ひとこと', () => {
  it('1〜100字で +1（1スポット1日1回）。2回目も保存はされる', async () => {
    const a = await call(s, 'POST', '/api/spots/s3/notes', g, { requestId: rid(), text: '  夜の水族館が よかった  ' });
    expect(a.status).toBe(200);
    expect((a.body as TriggerResult).granted).toBe(true);
    const saved = s.db.prepare('SELECT text FROM notes WHERE user_id = ?').get(g) as { text: string };
    expect(saved.text).toBe('夜の水族館が よかった');
    const b = await call(s, 'POST', '/api/spots/s3/notes', g, { requestId: rid(), text: 'あ'.repeat(100) });
    expect(b.status).toBe(200);
    expect((b.body as TriggerResult).granted).toBe(false);
    expect(count(s.db, 'notes')).toBe(2);
  });

  it('空・空白だけ・101字・文字列以外は 400 で保存されない', async () => {
    const before = allCounts(s.db);
    for (const text of ['', '   ', '\n\t', 'あ'.repeat(101), 5, null, ['a']]) {
      const r = await call(s, 'POST', '/api/spots/s3/notes', g, { requestId: rid(), text });
      expect(r.status).toBe(400);
      expect(errCode(r)).toBe('bad_request');
    }
    expect(allCounts(s.db)).toEqual(before);
  });
});

describe('T-020 SQL インジェクションの文字列', () => {
  it('そのままの文字列として1行だけ保存され、ほかの表は変わらない', async () => {
    const payloads = ["'; DROP TABLE notes; --", "' OR '1'='1", 'Robert"); DELETE FROM users; --', "1; UPDATE users SET pos = 49 WHERE '1'='1"];
    for (const text of payloads) {
      const before = allCounts(s.db);
      const pos = (await me()).board.pos;
      const r = await call(s, 'POST', '/api/spots/s4/notes', g, { requestId: rid(), text });
      expect(r.status).toBe(200);
      const after = allCounts(s.db);
      expect(after.notes).toBe((before.notes ?? 0) + 1);
      expect(after.users).toBe(before.users);
      const last = s.db.prepare('SELECT text FROM notes ORDER BY id DESC LIMIT 1').get() as { text: string };
      expect(last.text).toBe(text);
      expect((await me()).board.pos).toBe(pos);
    }
  });

  it('X-Guest-Id に SQL の文字列を入れても 400', async () => {
    const r = await call(s, 'POST', '/api/spots/s4/notes', "guest-a' OR 1=1 --", { requestId: rid(), text: 'x' });
    expect(r.status).toBe(400);
  });
});

describe('T-021 友達を誘う（見本）', () => {
  it('1日に何回でも送れて、そのたび +1。「済み」にはならない。外へは送らない', async () => {
    const a = await call(s, 'POST', '/api/spots/s5/invites', g, { requestId: rid() });
    expect((a.body as TriggerResult).granted).toBe(true);
    const b = await call(s, 'POST', '/api/spots/s5/invites', g, { requestId: rid() });
    expect((b.body as TriggerResult).granted).toBe(true);
    expect((b.body as TriggerResult).rollsLeft).toBe((a.body as TriggerResult).rollsLeft + 1);
    expect((await me()).doneToday.s5 ?? []).toEqual([]);
  });
});

describe('T-022 近くのお店・みんなのひとこと', () => {
  it('お店だけを直線距離の近い順に最大3件', () => {
    for (const sp of SPOTS) {
      const list = nearbyShops(sp.id);
      expect(list.length).toBeLessThanOrEqual(3);
      expect(list.every((x) => x.spot.kind === 'shop' && x.spot.id !== sp.id)).toBe(true);
      const raw = list.map((x) => distanceM(sp, x.spot));
      expect([...raw].sort((a, b) => a - b)).toEqual(raw);
    }
    expect(nearbyShops('s1')).toHaveLength(3);
  });

  it('ダミーだけで、自分のひとことは出ない', async () => {
    const mine = 'わたしのひとこと-u02';
    await call(s, 'POST', '/api/spots/s1/notes', g, { requestId: rid(), text: mine });
    for (const sp of SPOTS) {
      const v = dummyVoices(sp.id);
      expect(v.length).toBeGreaterThan(0);
      expect(v.every((x) => x.text[0] !== mine && x.text[1] !== mine)).toBe(true);
    }
    expect(JSON.stringify(DUMMY_VOICES)).not.toMatch(/@|https?:|LINE ?ID|\d{3}-\d{4}/);
  });
});

describe('T-060 きっかけ3種の二重送信', () => {
  it('同じ requestId は1回分だけ、応答も同じ', async () => {
    for (const [path, body] of [
      ['/api/spots/s6/qr', {}],
      ['/api/spots/s6/notes', { text: '二重' }],
      ['/api/spots/s6/invites', {}],
    ] as const) {
      const id = rid();
      const before = allCounts(s.db);
      const rs = await Promise.all([1, 2, 3].map(() => call(s, 'POST', path, g, { requestId: id, ...body })));
      expect(rs.every((r) => r.status === 200 && r.text === rs[0]?.text)).toBe(true);
      const after = allCounts(s.db);
      expect(after.grants).toBe((before.grants ?? 0) + 1);
      expect(after.requests).toBe((before.requests ?? 0) + 1);
    }
    expect(count(s.db, 'notes')).toBe(1);
    expect(count(s.db, 'stamps')).toBe(1);
  });
});
