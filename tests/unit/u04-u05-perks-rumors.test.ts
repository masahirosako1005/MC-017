// U-04 特典・U-05 うわさ: T-032・T-033・T-034（ほか うわさの入力検証）
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, errCode, grantRolls, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import type { Coupon, Rumors } from '../../app/shared/schemas.ts';
import { roll } from '../../app/server/src/services/roll-service.ts';
import { csvDayFor } from '../../app/server/src/services/rumor-service.ts';
import { importCsv } from '../../app/server/src/import/importer.ts';

const SAMPLE = process.env.SAMPLE_DATA_DIR ?? 'C:\\AI-Sprint\\sample-data';

let s: TestServer;
beforeAll(async () => {
  s = await startServer({ demoMode: false, now: '2026-11-09T10:00:00+09:00' });
  importCsv(s.db, SAMPLE);
});
afterAll(async () => { await s.close(); });

/** 盤の位置を置いて、目を決めて振り、止まった🎁のクーポンを返す */
async function couponAt(guest: string, from: number, face: number): Promise<Coupon> {
  grantRolls(s, guest, 1);
  s.db.prepare('UPDATE users SET board_no = 1, pos = ? WHERE id = ?').run(from, guest);
  const r = roll(s.ctx, guest, rid(), () => face);
  if (r.landed.kind !== 'gift') throw new Error(`not a gift: ${r.landed.kind}`);
  return r.landed.coupon;
}

describe('T-032 特典を使う', () => {
  it('使える→利用済み。2回目は 409、同じ requestId は同じ応答、他人のは 404、期限切れは 409', async () => {
    const g = newGuest();
    await session(s, g);
    const c = await couponAt(g, 1, 2);
    expect(c.status).toBe('usable');

    const id = rid();
    const used = await call(s, 'POST', `/api/coupons/${c.id}/use`, g, { requestId: id });
    expect(used.status).toBe(200);
    expect((used.body as Coupon).status).toBe('used');
    const same = await call(s, 'POST', `/api/coupons/${c.id}/use`, g, { requestId: id });
    expect(same.status).toBe(200);
    expect(same.body).toEqual(used.body);
    const again = await call(s, 'POST', `/api/coupons/${c.id}/use`, g, { requestId: rid() });
    expect(again.status).toBe(409);
    expect(errCode(again)).toBe('conflict');

    const other = newGuest();
    await session(s, other);
    const c2 = await couponAt(g, 5, 2);
    const theirs = await call(s, 'POST', `/api/coupons/${c2.id}/use`, other, { requestId: rid() });
    expect(theirs.status).toBe(404);

    // 期限（手に入れた日から60日）を過ぎた日
    expect(c2.expires).toBe('2027-01-08');
    s.setNow('2027-01-09T10:00:00+09:00');
    const list = (await call(s, 'GET', '/api/coupons', g)).body as { coupons: Coupon[] };
    expect(list.coupons.find((x) => x.id === c2.id)?.status).toBe('expired');
    const expired = await call(s, 'POST', `/api/coupons/${c2.id}/use`, g, { requestId: rid() });
    expect(expired.status).toBe(409);
    s.setNow('2026-11-09T10:00:00+09:00');
    const missing = await call(s, 'POST', '/api/coupons/999999/use', g, { requestId: rid() });
    expect(missing.status).toBe(404);
    const bad = await call(s, 'POST', '/api/coupons/abc/use', g, { requestId: rid() });
    expect(bad.status).toBe(400);
  });
});

describe('T-033 次に来た日から使えるクーポン', () => {
  it('手に入れた日から7日間は使えず（409）、7日後からは使える', async () => {
    const g = newGuest();
    await session(s, g);
    // 1枚目の盤の3つ目の🎁（6マス目）は「季節の1品」（次に来た日から）
    const c = await couponAt(g, 4, 2);
    expect(c.templateId).toBe('season');
    expect(c.status).toBe('later');
    expect(c.usableFrom).toBe('2026-11-16');
    expect((await call(s, 'POST', `/api/coupons/${c.id}/use`, g, { requestId: rid() })).status).toBe(409);

    s.setNow('2026-11-15T10:00:00+09:00');
    let list = (await call(s, 'GET', '/api/coupons', g)).body as { coupons: Coupon[] };
    expect(list.coupons.find((x) => x.id === c.id)?.status).toBe('later');
    expect((await call(s, 'POST', `/api/coupons/${c.id}/use`, g, { requestId: rid() })).status).toBe(409);

    s.setNow('2026-11-16T10:00:00+09:00');
    list = (await call(s, 'GET', '/api/coupons', g)).body as { coupons: Coupon[] };
    expect(list.coupons.find((x) => x.id === c.id)?.status).toBe('usable');
    const ok = await call(s, 'POST', `/api/coupons/${c.id}/use`, g, { requestId: rid() });
    expect(ok.status).toBe(200);
    s.setNow('2026-11-09T10:00:00+09:00');
  });
});

describe('T-034 うわさ', () => {
  it('5種が CSV 由来の人数で返り、応答に個人に見える値が無い。未選択の年齢・一緒に来た人は null', async () => {
    const g = newGuest();
    await session(s, g);
    const r = await call(s, 'GET', '/api/rumors', g);
    expect(r.status).toBe(200);
    const body = r.body as Rumors;
    expect(Object.keys(body).sort()).toEqual(['month', 'quiet', 'sameAge', 'sameCompanion', 'yesterday']);
    expect(body.sameAge).toBeNull();
    expect(body.sameCompanion).toBeNull();
    expect(body.month).toHaveLength(3);
    expect(body.yesterday.length).toBeGreaterThan(0);
    for (const rank of [...body.month, ...body.yesterday]) expect(Object.keys(rank).sort()).toEqual(['people', 'spotId']);

    // 人数は CSV の表から直接数えた値と同じ
    const top = s.db.prepare('SELECT spot_id, count(DISTINCT user_id) AS n FROM csv_stamps GROUP BY spot_id ORDER BY n DESC, spot_id LIMIT 1').get() as { spot_id: string; n: number };
    expect(body.month[0]).toEqual({ spotId: top.spot_id, people: top.n });
    const days = (s.db.prepare('SELECT DISTINCT day FROM csv_stamps ORDER BY day').all() as { day: string }[]).map((d) => d.day);
    const yDay = csvDayFor(days, '2026-11-08');
    const yTop = s.db.prepare('SELECT spot_id, count(DISTINCT user_id) AS n FROM csv_stamps WHERE day = ? GROUP BY spot_id ORDER BY n DESC, spot_id LIMIT 1').get(yDay) as { spot_id: string; n: number };
    expect(body.yesterday[0]).toEqual({ spotId: yTop.spot_id, people: yTop.n });

    // 空いている時間帯は 9〜17時、最大の半分未満が「空き」
    expect(body.quiet.spotId).toBe('s1');
    expect(body.quiet.hours.map((h) => h.hour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    const max = Math.max(...body.quiet.hours.map((h) => h.count));
    for (const h of body.quiet.hours) expect(h.quiet).toBe(h.count < max / 2);

    // CSV の利用者 ID（7桁）・名前などは出さない
    expect(r.text).not.toMatch(/\b\d{7}\b/);
    expect(r.text).not.toMatch(/name|mail|line|gender|user/i);

    await call(s, 'PATCH', '/api/me/profile', g, { age: '20s', companion: 'friends' });
    const chosen = (await call(s, 'GET', '/api/rumors?spot=s5', g)).body as Rumors;
    expect(chosen.sameAge?.length).toBe(3);
    expect(chosen.sameCompanion?.length).toBe(3);
    expect(chosen.quiet.spotId).toBe('s5');
    const ageTop = s.db.prepare(`SELECT s.spot_id, count(DISTINCT s.user_id) AS n FROM csv_stamps s JOIN csv_users u ON u.id = s.user_id
      WHERE u.age = '20s' GROUP BY s.spot_id ORDER BY n DESC, s.spot_id LIMIT 1`).get() as { spot_id: string; n: number };
    expect(chosen.sameAge?.[0]).toEqual({ spotId: ageTop.spot_id, people: ageTop.n });
  });

  it('spot は1つだけ。配列・未知のスポット・XSS や SQLi の文字列・未知のキーは 400', async () => {
    const g = newGuest();
    await session(s, g);
    for (const q of ['?spot=s1&spot=s2', '?spot[]=s1', '?spot=s99', "?spot=%3Cscript%3Ealert(1)%3C%2Fscript%3E", "?spot=s1'%20OR%20'1'='1", '?spot=s1&x=1']) {
      const r = await call(s, 'GET', `/api/rumors${q}`, g);
      expect(r.status, q).toBe(400);
      expect(errCode(r)).toBe('bad_request');
    }
  });
});



