// U-09〜U-12: 運営向け（ダッシュボード・次に行く予定・店のキャンペーンと盤の 🏪・お客さまの声）。DB はメモリ上
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, count, errCode, grantRolls, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import { initDb } from '../../app/server/src/db.ts';
import { roll } from '../../app/server/src/services/roll-service.ts';
import { maskText } from '../../app/server/src/services/shop-summary-service.ts';
import { seedAdminDemo } from '../../app/server/src/services/demo-seed.ts';
import { squareKind } from '../../app/shared/board.ts';
import { campaignLabel, demandSpots } from '../../app/shared/master/campaigns.ts';
import type { AdminSummary, CampaignView, DemandView, ShopSummary, VoicesView } from '../../app/shared/admin.ts';
import type { MeState, PlansState, RollResult } from '../../app/shared/schemas.ts';

const op = (o: string): Record<string, string> => ({ 'x-operator': o });
const ASSOC = op('association');
const S8 = op('shop-s8');
const S9 = op('shop-s9');
const S11 = op('shop-s11');

let seq = 0;
function dummyId(): string {
  seq += 1;
  return `guest-z${String(seq).padStart(5, '0')}`;
}

function addPlanners(s: TestServer, n: number, spot: string): void {
  for (let i = 0; i < n; i += 1) {
    const id = dummyId();
    s.db.prepare("INSERT INTO users (id, created_at, age) VALUES (?, '2026-11-09T09:00:00+09:00', '30s')").run(id);
    s.db.prepare("INSERT INTO plans (user_id, spot_id, created_day, status) VALUES (?, ?, '2026-11-09', 'open')").run(id, spot);
  }
}

const body = (over: Record<string, unknown> = {}) => ({
  requestId: rid(), kind: 'item', itemKey: 'coffee', value: null, starts: '2026-11-10', ends: '2026-11-20', ...over,
});

describe('T-071 役割と自分の店だけ（ADMIN_MODE・X-Operator）', () => {
  let on: TestServer;
  let off: TestServer;
  beforeAll(async () => {
    on = await startServer({ adminMode: true });
    off = await startServer({ adminMode: false });
  });
  afterAll(async () => { await on.close(); await off.close(); });

  it('ADMIN_MODE が 0 のときは /api/admin/* も /admin も 404', async () => {
    expect((await call(off, 'GET', '/api/admin/summary', null, undefined, ASSOC)).status).toBe(404);
    expect((await call(off, 'GET', '/admin', null)).status).toBe(404);
  });

  it('X-Operator が無い・不正は 400、役割の違いは 404', async () => {
    expect((await call(on, 'GET', '/api/admin/summary', null)).status).toBe(400);
    expect((await call(on, 'GET', '/api/admin/summary', null, undefined, op('shop-s1'))).status).toBe(400);
    expect((await call(on, 'GET', '/api/admin/summary', null, undefined, S9)).status).toBe(404);
    expect((await call(on, 'GET', '/api/admin/summary', null, undefined, ASSOC)).status).toBe(200);
  });

  it('別の店の URL は 404（観光協会も店の中身は見られない）', async () => {
    for (const p of ['demand', 'campaigns', 'voices']) {
      expect((await call(on, 'GET', `/api/admin/shops/s8/${p}`, null, undefined, S9)).status, p).toBe(404);
      expect((await call(on, 'GET', `/api/admin/shops/s8/${p}`, null, undefined, ASSOC)).status, p).toBe(404);
      expect((await call(on, 'GET', `/api/admin/shops/s8/${p}`, null, undefined, S8)).status, p).toBe(200);
    }
    expect((await call(on, 'GET', '/api/admin/shops/s8/summary', null, undefined, ASSOC)).status).toBe(200);
    expect((await call(on, 'GET', '/api/admin/shops/s8/summary', null, undefined, S9)).status).toBe(404);
    expect((await call(on, 'GET', '/api/admin/shops/s1/summary', null, undefined, ASSOC)).status).toBe(400);
  });
});

describe('T-070 次に行く予定（U-10）', () => {
  let s: TestServer;
  beforeAll(async () => { s = await startServer(); });
  afterAll(async () => { await s.close(); });

  it('3つまで入れられ、4つ目は 409。同じスポットは二重にならず、店は入れられない', async () => {
    const g = newGuest();
    await session(s, g);
    const add = (spotId: string) => call(s, 'POST', '/api/plans', g, { requestId: rid(), spotId });
    expect((await add('s1')).status).toBe(200);
    expect((await add('s1')).status).toBe(200);
    expect(((await call(s, 'GET', '/api/plans', g)).body as PlansState).plans).toHaveLength(1);
    await add('s2');
    await add('s3');
    expect(errCode(await add('s5'))).toBe('conflict');
    expect((await add('s8')).status).toBe(404);
    expect(count(s.db, 'plans')).toBe(3);
  });

  it('取り消せる。QR で着いたら「済み」になり、枠が空く', async () => {
    const g = newGuest();
    await session(s, g);
    const r = await call(s, 'POST', '/api/plans', g, { requestId: rid(), spotId: 's7' });
    const id = (r.body as PlansState).plans[0]?.id;
    expect((await call(s, 'POST', `/api/plans/${id}/cancel`, g, {})).status).toBe(200);
    expect(((await call(s, 'GET', '/api/plans', g)).body as PlansState).plans).toHaveLength(0);
    await call(s, 'POST', '/api/plans', g, { requestId: rid(), spotId: 's7' });
    await call(s, 'POST', '/api/spots/s7/qr', g, { requestId: rid() });
    expect(((await call(s, 'GET', '/api/plans', g)).body as PlansState).plans).toHaveLength(0);
    const done = s.db.prepare("SELECT count(*) AS n FROM plans WHERE user_id = ? AND status = 'done'").get(g) as { n: number };
    expect(done.n).toBe(1);
  });

  it('他人の予定は取り消せない・知らないキーは 400', async () => {
    const a = newGuest();
    const b = newGuest();
    await session(s, a);
    await session(s, b);
    const r = await call(s, 'POST', '/api/plans', a, { requestId: rid(), spotId: 's2' });
    const id = (r.body as PlansState).plans[0]?.id;
    await call(s, 'POST', `/api/plans/${id}/cancel`, b, {});
    expect(((await call(s, 'GET', '/api/plans', a)).body as PlansState).plans).toHaveLength(1);
    expect((await call(s, 'POST', '/api/plans', a, { requestId: rid(), spotId: 's2', extra: 1 })).status).toBe(400);
  });
});

describe('T-074 店のキャンペーン（U-11）', () => {
  let s: TestServer;
  beforeAll(async () => { s = await startServer({ adminMode: true }); });
  afterAll(async () => { await s.close(); });
  const create = (h: Record<string, string>, shop: string, b: unknown) => call(s, 'POST', `/api/admin/shops/${shop}/campaigns`, null, b, h);

  it('需要が10人に満たないと作れない（409）。少ない人数でも内訳・合計・あと何人かを数字で出す', async () => {
    addPlanners(s, 3, 's7');
    const d = (await call(s, 'GET', '/api/admin/shops/s11/demand', null, undefined, S11)).body as DemandView;
    expect(d.canCreate).toBe(false);
    expect(d.total).toEqual({ value: 3, hidden: false });
    expect(d.spots.find((x) => x.spotId === 's7')?.people).toEqual({ value: 3, hidden: false });
    expect(d.remaining).toBe(7);
    expect(errCode(await create(S11, 's11', body()))).toBe('conflict');
    expect(count(s.db, 'campaigns')).toBe(0);
  });

  it('需要が足りれば作れて、承認なしで承認済み（開始日の前は scheduled）として入る。同じ requestId は同じ行', async () => {
    addPlanners(s, 7, 's7');
    const d = (await call(s, 'GET', '/api/admin/shops/s11/demand', null, undefined, S11)).body as DemandView;
    expect(d.canCreate).toBe(true);
    expect(d.total).toEqual({ value: 10, hidden: false });
    const b = body();
    const r1 = await create(S11, 's11', b);
    expect(r1.status).toBe(200);
    const v = r1.body as CampaignView;
    expect(v.status).toBe('approved');
    expect(v.phase).toBe('scheduled');
    expect(v.label[0]).toBe('コーヒー1杯 無料');
    const r2 = await create(S11, 's11', b);
    expect((r2.body as CampaignView).id).toBe(v.id);
    expect(count(s.db, 'campaigns')).toBe(1);
    expect((s.db.prepare('SELECT reviewed_day AS d FROM campaigns WHERE id = ?').get(v.id) as { d: string | null }).d).not.toBeNull();
  });

  it('自分の店以外・店名の入力・選択肢の外・日付の外は拒否', async () => {
    expect((await create(S9, 's11', body())).status).toBe(404);
    expect((await create(S11, 's11', { ...body(), shopId: 's9' })).status).toBe(400);
    expect((await create(S9, 's9', body({ itemKey: 'coffee' }))).status).toBe(400);
    expect((await create(S9, 's9', body({ kind: 'yen', itemKey: null, value: 150 }))).status).toBe(400);
    expect((await create(S9, 's9', body({ kind: 'item', itemKey: 'ice', value: 100 }))).status).toBe(400);
    expect((await create(S9, 's9', body({ itemKey: 'ice', starts: '2026-11-09', ends: '2026-11-20' }))).status).toBe(400);
    expect((await create(S9, 's9', body({ itemKey: 'ice', starts: '2026-11-10', ends: '2026-11-13' }))).status).toBe(400);
    expect((await create(S9, 's9', body({ itemKey: 'ice', starts: '2026-11-10', ends: '2026-12-20' }))).status).toBe(400);
    expect((await create(S9, 's9', body({ itemKey: 'ice', starts: '2026-02-31', ends: '2026-03-20' }))).status).toBe(400);
    expect(count(s.db, 'campaigns')).toBe(1);
  });

  it('承認・却下の API は無い（404）。承認待ちで止まらず、続けて作れる', async () => {
    const id = (s.db.prepare('SELECT id FROM campaigns LIMIT 1').get() as { id: number }).id;
    expect((await call(s, 'POST', `/api/admin/campaigns/${id}/approve`, null, {}, ASSOC)).status).toBe(404);
    expect((await call(s, 'POST', `/api/admin/campaigns/${id}/reject`, null, { reason: 'dates' }, ASSOC)).status).toBe(404);
    expect((await call(s, 'GET', '/api/admin/campaigns', null, undefined, ASSOC)).status).toBe(404);
    expect((await create(S11, 's11', body())).status).toBe(200);
    expect(count(s.db, 'campaigns')).toBe(2);
  });

  it('表示名は選んだ値からサーバーが作る', () => {
    expect(campaignLabel('yen', 's8', null, 300)[0]).toBe('300円引き');
    expect(campaignLabel('percent', 's9', null, 20)[0]).toBe('20%引き');
    expect(campaignLabel('item', 's9', 'ice', null)[0]).toBe('アイス サービス');
    expect(demandSpots('s9')).toEqual(expect.arrayContaining(['s7', 's10']));
    expect(demandSpots('s9')).not.toContain('s8');
  });
});

describe('T-075 盤の 🏪 マスとクーポン（U-11）', () => {
  let s: TestServer;
  beforeAll(async () => { s = await startServer({ adminMode: true, demoMode: true }); });
  afterAll(async () => { await s.close(); });

  let planner = '';

  async function approvedCampaign(): Promise<number> {
    addPlanners(s, 9, 's7');
    const g = newGuest();
    planner = g;
    await session(s, g);
    await call(s, 'POST', '/api/plans', g, { requestId: rid(), spotId: 's7' });
    const r = await call(s, 'POST', '/api/admin/shops/s11/campaigns', null, body(), S11);
    expect(r.status).toBe(200);
    const id = (r.body as CampaignView).id;
    s.setNow('2026-11-09T10:00:00+09:00');
    return id;
  }

  it('期間の前は出ない。期間に入ると、予定のある人にだけ、3〜10マス先の普通のマスへ。開き直しても動かない', async () => {
    await approvedCampaign();
    const none = newGuest();
    await session(s, none);
    expect(((await call(s, 'GET', '/api/me', planner)).body as MeState).board.extras).toEqual([]);

    s.setNow('2026-11-10T10:00:00+09:00');
    const me1 = (await call(s, 'GET', '/api/me', planner)).body as MeState;
    expect(me1.board.extras).toHaveLength(1);
    const ex = me1.board.extras[0];
    expect(ex?.shopId).toBe('s11');
    expect(ex?.label[0]).toBe('コーヒー1杯 無料');
    const sq = ex?.square ?? -1;
    expect(sq).toBeGreaterThanOrEqual(me1.board.pos + 3);
    expect(sq).toBeLessThanOrEqual(me1.board.pos + 10);
    expect(squareKind(me1.board.no, sq)).toBe('normal');
    const me2 = (await call(s, 'GET', '/api/me', planner)).body as MeState;
    expect(me2.board.extras).toEqual(me1.board.extras);
    expect(((await call(s, 'GET', '/api/me', none)).body as MeState).board.extras).toEqual([]);
    expect(count(s.db, 'plans')).toBeGreaterThan(0);
  });

  it('止まると翌日から使える券が1枚出て、同じマスでもう1枚は出ない。盤から 🏪 が消える', async () => {
    s.setNow('2026-11-10T10:00:00+09:00');
    const me = (await call(s, 'GET', '/api/me', planner)).body as MeState;
    const sq = me.board.extras[0]?.square ?? 0;
    s.db.prepare('UPDATE users SET pos = ? WHERE id = ?').run(sq - 1, planner);
    grantRolls(s, planner, 2, '2026-11-10');
    const c0 = count(s.db, 'coupons');
    const r = roll(s.ctx, planner, rid(), () => 1) as RollResult;
    expect(r.landed.kind).toBe('shop');
    if (r.landed.kind !== 'shop') return;
    expect(r.landed.coupon.templateId).toBe('campaign');
    expect(r.landed.coupon.label?.[0]).toBe('コーヒー1杯 無料');
    expect(r.landed.coupon.shopId).toBe('s11');
    expect(r.landed.coupon.usableFrom).toBe('2026-11-11');
    expect(r.landed.coupon.expires).toBe('2026-11-20');
    expect(r.landed.coupon.status).toBe('later');
    expect(count(s.db, 'coupons')).toBe(c0 + 1);

    s.db.prepare('UPDATE users SET pos = ? WHERE id = ?').run(sq - 1, planner);
    const again = roll(s.ctx, planner, rid(), () => 1) as RollResult;
    expect(again.landed.kind).toBe('normal');
    expect(count(s.db, 'coupons')).toBe(c0 + 1);
    expect(((await call(s, 'GET', '/api/me', planner)).body as MeState).board.extras).toEqual([]);
    const list = (await call(s, 'GET', '/api/coupons', planner)).body as { coupons: { label: unknown }[] };
    expect(list.coupons.some((c) => Array.isArray(c.label))).toBe(true);
  });

  it('その店の券は翌日から使え、使うと店のダッシュボードに数えられる', async () => {
    const cid = (s.db.prepare('SELECT id FROM coupons WHERE user_id = ?').get(planner) as { id: number }).id;
    s.setNow('2026-11-10T11:00:00+09:00');
    expect((await call(s, 'POST', `/api/coupons/${cid}/use`, planner, { requestId: rid() })).status).toBe(409);
    s.setNow('2026-11-11T11:00:00+09:00');
    expect((await call(s, 'POST', `/api/coupons/${cid}/use`, planner, { requestId: rid() })).status).toBe(200);
    expect((s.db.prepare('SELECT used_at AS u FROM coupons WHERE id = ?').get(cid) as { u: string | null }).u).not.toBeNull();
    const sum = (await call(s, 'GET', '/api/admin/shops/s11/campaigns', null, undefined, S11)).body as CampaignView[];
    expect(sum[0]?.landed).toEqual({ value: 1, hidden: false });
  });
});

describe('T-072 ダッシュボードの数字（U-09）', () => {
  it('人数が少なくても数字を出す（5人未満も）。個人の ID は応答に含まれない', async () => {
    const s = await startServer({ adminMode: true });
    try {
      for (let i = 0; i < 3; i += 1) {
        const id = dummyId();
        s.db.prepare("INSERT INTO users (id, created_at) VALUES (?, '2026-11-05T09:00:00+09:00')").run(id);
        s.db.prepare("INSERT INTO visits (user_id, day, kind) VALUES (?, '2026-11-05', 'first')").run(id);
      }
      const r = await call(s, 'GET', '/api/admin/summary?days=7', null, undefined, ASSOC);
      const v = r.body as AdminSummary;
      expect(v.k01.now).toEqual({ value: 3, hidden: false });
      expect(v.k02.now).toMatchObject({ percent: 0, den: 3, hidden: false, reference: true });
      expect(r.text).not.toMatch(/guest-/);
      expect((await call(s, 'GET', '/api/admin/summary?days=5', null, undefined, ASSOC)).status).toBe(400);
      expect((await call(s, 'GET', '/api/admin/summary?extra=1', null, undefined, ASSOC)).status).toBe(400);
    } finally {
      await s.close();
    }
  });

  it('グラフ用: 7日ごと・曜日ごと・年代ごとの人数が数えた通りで、少ない人数も数字で出る', async () => {
    const s = await startServer({ adminMode: true });
    try {
      const ins = (sql: string, ...a: unknown[]) => s.db.prepare(sql).run(...a);
      const ids = Array.from({ length: 12 }, () => dummyId());
      ids.forEach((id, i) => ins("INSERT INTO users (id, age, companion, created_at) VALUES (?, ?, ?, '2026-10-30T09:00:00+09:00')", id, i < 9 ? '20s' : '30s', i < 7 ? 'family' : i < 10 ? 'friends' : null));
      ids.forEach((id) => ins("INSERT INTO visits (user_id, day, kind) VALUES (?, '2026-11-05', 'first')", id)); // 木曜
      ids.slice(0, 6).forEach((id) => ins("INSERT INTO visits (user_id, day, kind) VALUES (?, '2026-11-08', 'revisit')", id)); // 日曜
      const v = (await call(s, 'GET', '/api/admin/summary?days=7', null, undefined, ASSOC)).body as AdminSummary;
      expect(v.weekly).toEqual([{ from: '2026-11-02', to: '2026-11-08', users: { value: 12, hidden: false }, revisitors: { value: 6, hidden: false } }]);
      expect(v.weekdays).toHaveLength(7);
      expect(v.weekdays[5]?.visits).toEqual({ value: 0, hidden: false });
      expect(v.weekdays[4]?.visits).toEqual({ value: 12, hidden: false }); // 木
      expect(v.weekdays[0]?.visits).toEqual({ value: 6, hidden: false }); // 日
      expect(v.weekdays[1]?.visits).toEqual({ value: 0, hidden: false }); // 月は 0 を出す
      expect(v.ages.find((a) => a.age === '20s')?.users).toEqual({ value: 9, hidden: false });
      expect(v.ages.find((a) => a.age === '30s')?.users).toEqual({ value: 3, hidden: false }); // 3人も出す
      expect(v.companions.find((a) => a.companion === 'family')?.users).toEqual({ value: 7, hidden: false });
      expect(v.companions.find((a) => a.companion === 'friends')?.users).toEqual({ value: 3, hidden: false });
      expect(v.companions.find((a) => a.companion === null)?.users).toEqual({ value: 2, hidden: false });
      expect(JSON.stringify(v)).not.toMatch(/guest-/);
    } finally {
      await s.close();
    }
  });
  it('K-01・K-02・K-03・K-07・再訪までの段階（前の段階を通った人だけ）・気づき', async () => {
    const s = await startServer({ adminMode: true });
    try {
      const ins = (sql: string, ...a: unknown[]) => s.db.prepare(sql).run(...a);
      const ids = Array.from({ length: 20 }, () => dummyId());
      ids.forEach((id) => ins("INSERT INTO users (id, created_at) VALUES (?, '2026-10-30T09:00:00+09:00')", id));
      // 今の期間（11-02〜11-08）: u0〜u9 が 11-05 に来た。u0〜u5 は 11-08 に再訪
      ids.slice(0, 10).forEach((id) => ins("INSERT INTO visits (user_id, day, kind) VALUES (?, '2026-11-05', 'first')", id));
      ids.slice(0, 6).forEach((id) => ins("INSERT INTO visits (user_id, day, kind) VALUES (?, '2026-11-08', 'revisit')", id));
      ids.slice(0, 8).forEach((id) => ins("INSERT INTO grants (user_id, day, source, spot_key, amount, at) VALUES (?, '2026-11-05', 'qr', 's7', 1, '2026-11-05T10:00:00+09:00')", id));
      ids.slice(0, 6).forEach((id, i) => ins("INSERT INTO rolls (user_id, board_no, face, from_pos, to_pos, at) VALUES (?, 1, 3, 0, ?, '2026-11-05T11:00:00+09:00')", id, i < 5 ? 10 : 44));
      ids.slice(0, 5).forEach((id, i) => ins(
        "INSERT INTO coupons (user_id, template_id, season, board_no, square, shop_id, obtained_day, usable_from, expires, used_at) VALUES (?, 'goal', NULL, 1, 44, 's9', '2026-11-05', '2026-11-12', '2026-12-30', ?)",
        id, i < 3 ? '2026-11-08T12:00:00+09:00' : null,
      ));
      // 前の期間（10-26〜11-01）: u10〜u19 が 10-30 に来て、全員が盤の途中
      ids.slice(10).forEach((id) => {
        ins("INSERT INTO visits (user_id, day, kind) VALUES (?, '2026-10-30', 'first')", id);
        ins("INSERT INTO rolls (user_id, board_no, face, from_pos, to_pos, at) VALUES (?, 1, 3, 0, 10, '2026-10-30T11:00:00+09:00')", id);
      });
      const v = (await call(s, 'GET', '/api/admin/summary?days=7', null, undefined, ASSOC)).body as AdminSummary;
      expect(v.period).toEqual({ days: 7, from: '2026-11-02', to: '2026-11-08' });
      expect(v.k01.now.value).toBe(10);
      expect(v.k01.prev.value).toBe(10);
      expect(v.k02.now.percent).toBe(60);
      expect(v.k02.now.reference).toBe(true);
      // 来た日の人数: 11-05 は10人（理由=盤の途中の5人）、11-08 は6人（u0〜u4 が理由あり）→ 10/16
      expect(v.k03.now.percent).toBe(62.5);
      expect(v.k03.prev.percent).toBe(100);
      expect(v.k07.now.percent).toBe(60);
      expect(v.funnel.map((f) => f.count.value)).toEqual([10, 8, 6, 5, 5]);
      expect(v.insight?.id).toBe('I-01');
      expect(v.insight?.text).toContain('37.5');
    } finally {
      await s.close();
    }
  });
});

describe('T-073 店ごとのダッシュボード（時間帯・同じ日に寄ったスポット）', () => {
  it('券を使った時間帯と、同じ日に寄ったスポットが人数で出る。1人でも数字を出す', async () => {
    const s = await startServer({ adminMode: true });
    try {
      const ins = (sql: string, ...a: unknown[]) => s.db.prepare(sql).run(...a);
      const ids = Array.from({ length: 6 }, () => dummyId());
      ids.forEach((id, i) => {
        ins("INSERT INTO users (id, created_at) VALUES (?, '2026-11-08T09:00:00+09:00')", id);
        ins("INSERT INTO visits (user_id, day, kind) VALUES (?, '2026-11-08', 'first')", id);
        ins("INSERT INTO coupons (user_id, template_id, season, board_no, square, shop_id, obtained_day, usable_from, expires, used_at) VALUES (?, 'tempura', NULL, 1, 8, 's9', '2026-11-08', '2026-11-08', '2027-01-01', ?)",
          id, `2026-11-08T${i < 5 ? '12' : '17'}:05:00+09:00`);
        ins("INSERT INTO stamps (user_id, spot_id, day, hour) VALUES (?, 's7', '2026-11-08', 11)", id);
        if (i < 2) ins("INSERT INTO stamps (user_id, spot_id, day, hour) VALUES (?, 's1', '2026-11-08', 11)", id);
      });
      const r = await call(s, 'GET', '/api/admin/shops/s9/summary?days=7', null, undefined, ASSOC);
      const v = r.body as ShopSummary;
      expect(v.coupons.used).toEqual({ value: 6, hidden: false });
      expect(v.hourly.find((h) => h.from === 12)?.count).toEqual({ value: 5, hidden: false });
      expect(v.hourly.find((h) => h.from === 16)?.count).toEqual({ value: 1, hidden: false });
      expect(v.sameDay.find((x) => x.spotId === 's7')?.people).toEqual({ value: 6, hidden: false });
      expect(v.sameDay.find((x) => x.spotId === 's1')?.people).toEqual({ value: 2, hidden: false });
      expect(r.text).not.toMatch(/guest-/);
    } finally {
      await s.close();
    }
  });
});

describe('T-076 お客さまの声（U-12 e）', () => {
  let s: TestServer;
  beforeAll(async () => { s = await startServer({ adminMode: true }); });
  afterAll(async () => { await s.close(); });

  it('電話番号・メール・URL を伏せ、全角の数字も伏せる。5桁以下の数字は残す', () => {
    expect(maskText('電話は 090-1234-5678 です')).toEqual({ text: '電話は （伏せました） です', masked: true });
    expect(maskText('０９０１２３４５６７８').masked).toBe(true);
    expect(maskText('a@example.com').masked).toBe(true);
    expect(maskText('https://example.com/x を見て').text).toBe('（伏せました） を見て');
    expect(maskText('3人で行って 2000円でした')).toEqual({ text: '3人で行って 2000円でした', masked: false });
  });

  it('その店の、店に見せてよい声だけが出て、観光協会・ほかの店には見えない。名前・ID は含まれない', async () => {
    const g = newGuest();
    await session(s, g);
    await call(s, 'PATCH', '/api/me/profile', g, { age: '40s' });
    await call(s, 'POST', '/api/spots/s8/notes', g, { requestId: rid(), text: 'ちょうちんがきれい。連絡は 090-1234-5678 まで' });
    await call(s, 'POST', '/api/spots/s9/notes', g, { requestId: rid(), text: 'きしめんがおいしい' });
    s.db.prepare("INSERT INTO notes (user_id, spot_id, day, text, at) VALUES (?, 's8', '2026-11-01', '昔のひとこと（店には見せない）', '2026-11-01T10:00:00+09:00')").run(g);

    const r = await call(s, 'GET', '/api/admin/shops/s8/voices', null, undefined, S8);
    const v = r.body as VoicesView;
    expect(v.items).toHaveLength(1);
    expect(v.items[0]).toMatchObject({ text: 'ちょうちんがきれい。連絡は （伏せました） まで', masked: true, age: '40s', read: false, dummy: false });
    expect(Object.keys(v.items[0] ?? {}).sort()).toEqual(['age', 'day', 'dummy', 'id', 'masked', 'read', 'text']);
    expect(r.text).not.toMatch(/guest-|090/);
    expect(v.counts).toEqual({ all: 1, unread: 1, read: 0 });
    expect((await call(s, 'GET', '/api/admin/shops/s8/voices', null, undefined, ASSOC)).status).toBe(404);
    expect((await call(s, 'GET', '/api/admin/shops/s8/voices', null, undefined, S9)).status).toBe(404);
    const other = (await call(s, 'GET', '/api/admin/shops/s9/voices', null, undefined, S9)).body as VoicesView;
    expect(other.items.map((i) => i.text)).toEqual(['きしめんがおいしい']);
  });

  it('確認した印は店ごと。戻せない。ほかの店・知らない声は 404。絞り込みが効く', async () => {
    const list = (await call(s, 'GET', '/api/admin/shops/s8/voices', null, undefined, S8)).body as VoicesView;
    const id = list.items[0]?.id;
    expect((await call(s, 'POST', `/api/admin/shops/s9/voices/${id}/confirm`, null, {}, S9)).status).toBe(404);
    expect((await call(s, 'POST', '/api/admin/shops/s8/voices/9999/confirm', null, {}, S8)).status).toBe(404);
    const ok = (await call(s, 'POST', `/api/admin/shops/s8/voices/${id}/confirm`, null, {}, S8)).body as VoicesView;
    expect(ok.counts).toEqual({ all: 1, unread: 0, read: 1 });
    expect((await call(s, 'POST', `/api/admin/shops/s8/voices/${id}/confirm`, null, {}, S8)).status).toBe(200);
    const unread = (await call(s, 'GET', '/api/admin/shops/s8/voices?show=unread', null, undefined, S8)).body as VoicesView;
    expect(unread.items).toHaveLength(0);
    const read = (await call(s, 'GET', '/api/admin/shops/s8/voices?show=read', null, undefined, S8)).body as VoicesView;
    expect(read.items).toHaveLength(1);
    expect((await call(s, 'GET', '/api/admin/shops/s8/voices?show=x', null, undefined, S8)).status).toBe(400);
    const sum = (await call(s, 'GET', '/api/admin/shops/s8/summary', null, undefined, S8)).body as ShopSummary;
    expect(sum.unreadVoices).toBe(0);
  });
});

describe('T-077 デモデータと古い DB の移行', () => {
  it('デモのダミー利用者を入れると数字が出て、何度入れても増えない。需要が足りて声もある', async () => {
    const s = await startServer({ adminMode: true, demoMode: true });
    try {
      seedAdminDemo(s.ctx);
      const n1 = count(s.db, 'users');
      seedAdminDemo(s.ctx);
      expect(count(s.db, 'users')).toBe(n1);
      const v = (await call(s, 'GET', '/api/admin/summary?days=28', null, undefined, ASSOC)).body as AdminSummary;
      expect(v.k01.now.hidden).toBe(false);
      for (const shop of ['s8', 's9', 's11'] as const) {
        const h = op(`shop-${shop}`);
        expect(((await call(s, 'GET', `/api/admin/shops/${shop}/demand`, null, undefined, h)).body as DemandView).canCreate).toBe(true);
        expect(((await call(s, 'GET', `/api/admin/shops/${shop}/voices`, null, undefined, h)).body as VoicesView).items.length).toBeGreaterThan(0);
      }
    } finally {
      await s.close();
    }
  });

  it('あかり堂（s8）のダミー: 券・QR・時間帯・再訪の日・同じ日に寄ったスポットがそろい、終わったキャンペーンがあり、新しい作成を邪魔しない', async () => {
    const s = await startServer({ adminMode: true, demoMode: true });
    try {
      seedAdminDemo(s.ctx);
      const v = (await call(s, 'GET', '/api/admin/shops/s8/summary?days=28', null, undefined, S8)).body as ShopSummary;
      const n = (m: { value: number | null }): number => m.value ?? 0;
      expect(n(v.coupons.issued)).toBeGreaterThanOrEqual(20);
      expect(n(v.coupons.used)).toBeGreaterThanOrEqual(15);
      expect(n(v.coupons.usedOnRevisit)).toBeGreaterThanOrEqual(3);
      expect(n(v.qr)).toBeGreaterThanOrEqual(30);
      expect(v.hourly.filter((h) => n(h.count) > 0).length).toBeGreaterThanOrEqual(5); // 時間帯が1〜2か所に偏らない
      expect(v.sameDay.length).toBeGreaterThanOrEqual(4);
      expect(v.campaigns.some((c) => c.phase === 'ended' && n(c.landed) >= 10 && n(c.used) >= 5)).toBe(true);
      expect(((await call(s, 'GET', '/api/admin/shops/s8/demand', null, undefined, S8)).body as DemandView).blocking).toBeNull();
    } finally {
      await s.close();
    }
  });
  it('メモリ上の古い形の DB（campaign が無い coupons・shop_visible が無い notes）を新しい形へ移し、券を残す', () => {
    let sql = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    sql = sql.replace(",'goal','campaign'))", ",'goal'))")
      .replace(/^ {2}campaign_id {2}INTEGER REFERENCES campaigns\(id\),\n/m, '')
      .replace(/,\n {2}-- 1: [^\n]*\n {2}shop_visible [^\n]*\n\) STRICT;/, '\n) STRICT;');
    expect(sql).not.toMatch(/shop_visible INTEGER/);
    const db = new Database(':memory:');
    db.pragma('foreign_keys = OFF');
    // 古い形で作る（campaigns など新しい表は schema に残るが、coupons と notes は古い形）
    db.exec(sql);
    const old = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'coupons'").get() as { sql: string };
    expect(old.sql).not.toContain('campaign');
    db.prepare("INSERT INTO users (id, created_at) VALUES ('guest-old001', '2026-01-01T00:00:00+09:00')").run();
    db.prepare("INSERT INTO spots (id, kind, season, step_free, lat, lng) VALUES ('s9', 'shop', 'all', 1, 35.169, 136.905)").run();
    db.prepare(
      "INSERT INTO coupons (user_id, template_id, season, board_no, square, shop_id, obtained_day, usable_from, expires) VALUES ('guest-old001', 'goal', NULL, 1, 44, 's9', '2026-01-01', '2026-01-08', '2026-03-01')",
    ).run();
    db.prepare("INSERT INTO notes (user_id, spot_id, day, text, at) VALUES ('guest-old001', 's9', '2026-01-01', 'むかし', '2026-01-01T10:00:00+09:00')").run();
    initDb(db);
    const cols = (t: string) => (db.prepare('SELECT name FROM pragma_table_info(?)').all(t) as { name: string }[]).map((c) => c.name);
    expect(cols('coupons')).toContain('campaign_id');
    expect(cols('notes')).toContain('shop_visible');
    expect(db.prepare('SELECT count(*) AS n FROM coupons').get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT shop_visible AS v FROM notes WHERE text = 'むかし'").get()).toEqual({ v: 0 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'coupons_old'").get()).toBeUndefined();
    db.close();
  });
});
