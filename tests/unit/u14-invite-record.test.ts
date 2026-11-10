// LINE で友だちを誘った記録（見本）を DB に残し、スポットごとに集計してダッシュボードに出す
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import type { AdminSummary } from '../../app/shared/admin.ts';

let s: TestServer;
const ASSOC = { 'x-operator': 'association' };
beforeAll(async () => { s = await startServer({ adminMode: true }); });
afterAll(async () => { await s.close(); });

const rows = (spot: string): number => (s.db.prepare('SELECT COUNT(*) AS n FROM invites WHERE spot_id = ?').get(spot) as { n: number }).n;
const plannersOf = async (spot: string): Promise<AdminSummary['spotPlans'][number]> => {
  const r = await call(s, 'GET', '/api/admin/summary?days=all', null, undefined, ASSOC);
  expect(r.status).toBe(200);
  const hit = (r.body as AdminSummary).spotPlans.find((p) => p.spotId === spot);
  expect(hit).toBeDefined();
  return hit as AdminSummary['spotPlans'][number];
};

describe('誘った記録', () => {
  it('送るたびに1行。同じ requestId の再送は増えない', async () => {
    const g = newGuest();
    await session(s, g);
    const id = rid();
    await call(s, 'POST', '/api/spots/s2/invites', g, { requestId: id });
    await call(s, 'POST', '/api/spots/s2/invites', g, { requestId: id });
    expect(rows('s2')).toBe(1);
    await call(s, 'POST', '/api/spots/s2/invites', g, { requestId: rid() });
    expect(rows('s2')).toBe(2);
  });

  it('スポットごとに人数を集計する（同じ人が何回送っても1人。小さい人数も隠さない設定）', async () => {
    const guests = Array.from({ length: 5 }, () => newGuest());
    for (const g of guests) {
      await session(s, g);
      await call(s, 'POST', '/api/spots/s3/invites', g, { requestId: rid() });
    }
    await call(s, 'POST', '/api/spots/s3/invites', guests[0] ?? '', { requestId: rid() });
    const s3 = await plannersOf('s3');
    expect(s3.inviters).toEqual({ value: 5, hidden: false });
    expect((await plannersOf('s2')).inviters).toEqual({ value: 1, hidden: false });
    expect((await plannersOf('s9')).inviters).toEqual({ value: 0, hidden: false });
  });
});


