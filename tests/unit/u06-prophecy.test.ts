// U-06 再訪と予言: T-006・T-038〜T-042
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { call, errCode, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import { favoriteBand, historyMark, hitRate, levelOf, rankProphecy, strengthOf, type ProphecyInput } from '../../app/shared/prophecy.ts';
import { SPOTS, spotById, type SpotId } from '../../app/shared/master/spots.ts';
import type { MeState, ProphecyState, TriggerResult } from '../../app/shared/schemas.ts';
import { similarShare } from '../../app/server/src/repositories/prophecy-repo.ts';

let s: TestServer;
let g: string;
beforeEach(async () => {
  s = await startServer({ now: '2026-11-09T10:00:00+09:00' });
  g = newGuest();
});
afterEach(async () => { await s.close(); });

const at = (day: string, hour = 10) => `${day}T${String(hour).padStart(2, '0')}:00:00+09:00`;
async function me(): Promise<MeState> { return (await call(s, 'GET', '/api/me', g)).body as MeState; }
async function openDay(day: string, hour = 10): Promise<MeState> {
  s.setNow(at(day, hour));
  await session(s, g);
  return me();
}
async function qr(spot: SpotId): Promise<TriggerResult> {
  const r = await call(s, 'POST', `/api/spots/${spot}/qr`, g, { requestId: rid() });
  expect(r.status).toBe(200);
  return r.body as TriggerResult;
}
async function prophecy(): Promise<ProphecyState> {
  const r = await call(s, 'GET', '/api/prophecy', g);
  expect(r.status).toBe(200);
  return r.body as ProphecyState;
}
async function answer(id: number, a: unknown, requestId = rid()) {
  return call(s, 'POST', `/api/prophecy/${id}/answer`, g, { requestId, answer: a });
}
function weights(): Record<string, number> {
  const rows = s.db.prepare('SELECT tag, weight FROM tag_weights WHERE user_id = ?').all(g) as { tag: string; weight: number }[];
  return Object.fromEntries(rows.map((r) => [r.tag, r.weight]));
}
/** 予言を作り、7日後の再訪の日に予言のスポットで QR を読んで答え合わせまで進める */
async function visitProphecy(day: string, revisitDay: string): Promise<ProphecyState> {
  await openDay(day);
  const p = await prophecy();
  if (!p.current) throw new Error('no prophecy');
  await openDay(revisitDay);
  const r = await qr(p.current.spotId);
  expect(r.prophecyCheck).toEqual({ prophecyId: p.current.id });
  return prophecy();
}

describe('T-006 再訪の判定', () => {
  it('初日 +0、1〜6日後は旅の2日目 +1、7日以上は再訪 +2、同じ日は1回だけ', async () => {
    let m = await openDay('2026-11-09');
    expect(m.visitKind).toBe('first');
    expect(m.bonus).toBeNull();
    expect(m.rollsLeft).toBe(0);
    m = await openDay('2026-11-12');
    expect(m.visitKind).toBe('day2');
    expect(m.bonus).toEqual({ source: 'day2', amount: 1 });
    expect(m.rollsLeft).toBe(1);
    m = await openDay('2026-11-12', 18);
    expect(m.rollsLeft).toBe(1);
    m = await openDay('2026-11-18');
    expect(m.visitKind).toBe('day2');
    expect(m.rollsLeft).toBe(2);
    m = await openDay('2026-11-25');
    expect(m.visitKind).toBe('revisit');
    expect(m.bonus).toEqual({ source: 'revisit', amount: 2 });
    expect(m.rollsLeft).toBe(4);
    m = await openDay('2026-11-25', 20);
    expect(m.rollsLeft).toBe(4);
  });
});

describe('T-038 予言の作成', () => {
  it('QR 0回なら「まだ」、1回以上で行っていないスポットから1つ・理由3つまで', async () => {
    await openDay('2026-11-09');
    let p = await prophecy();
    expect(p.canProphesy).toBe(false);
    expect(p.current).toBeNull();
    await qr('s1');
    p = await prophecy();
    expect(p.canProphesy).toBe(true);
    const c = p.current;
    if (!c) throw new Error('no prophecy');
    expect(c.spotId).not.toBe('s1');
    expect(spotById(c.spotId).kind).not.toBe('shop');
    expect(c.status).toBe('open');
    expect(c.reasons.length).toBeGreaterThan(0);
    expect(c.reasons.length).toBeLessThanOrEqual(3);
    for (const r of c.reasons) expect(['strong', 'mid', 'weak']).toContain(r.strength);
    expect(p.others.length).toBeLessThanOrEqual(2);
    expect(p.others.every((o) => o.spotId !== c.spotId && o.spotId !== 's1')).toBe(true);
    expect(c.timeBand).toBe('morning');
  });

  it('同じ入力なら同じ結果、同点はスポット ID 順、強さの境目', () => {
    const input: ProphecyInput = { visited: [], stepLess: false, today: '2026-11-09', weights: {}, similar: {}, hours: [] };
    const a = rankProphecy(input);
    expect(rankProphecy(input)).toEqual(a);
    // 秋の次は冬。冬のスポットが先、残りは点が同じなので ID 順
    expect(a.slice(0, 2).map((x) => x.spotId)).toEqual(['s7', 's10']);
    const zero = a.filter((x) => x.score === 0).map((x) => x.spotId);
    expect(zero).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
    expect(a.every((x) => x.reasons.length <= 3)).toBe(true);
    expect(strengthOf(2)).toBe('strong');
    expect(strengthOf(1.99)).toBe('mid');
    expect(strengthOf(1)).toBe('mid');
    expect(strengthOf(0.99)).toBe('weak');
    expect(favoriteBand([])).toBe('noon');
    expect(favoriteBand([20, 21, 9])).toBe('night');
    // 似た人・好み・季節の理由が点の大きい順に並ぶ
    const b = rankProphecy({ ...input, visited: ['s1'], similar: { s6: 1 }, weights: { history: 1 } });
    const s6 = b.find((x) => x.spotId === 's6');
    expect(s6?.reasons.map((r) => r.code)).toEqual(['similar', 'tag']);
    expect(s6?.reasons[0]?.strength).toBe('strong');
  });
});

describe('T-038 似た人の割合（CSV の共起）', () => {
  it('同じ年齢層・一緒に来た人で、自分の行った所に行った人のうち、候補にも行った割合。未選択なら全員', () => {
    const u = s.db.prepare("INSERT INTO csv_users (id, age, companion, registered_at) VALUES (?, ?, ?, '2025-01-01T00:00:00+09:00')");
    u.run(1000001, '20s', 'friends');
    u.run(1000002, '20s', 'friends');
    u.run(1000003, '60s', 'couple');
    u.run(1000004, '20s', 'friends');
    const st = s.db.prepare("INSERT INTO csv_stamps (user_id, round, spot_id, at, day, hour) VALUES (?, 1, ?, '2025-01-02T10:00:00+09:00', '2025-01-02', 10)");
    st.run(1000001, 's1'); st.run(1000001, 's3');
    st.run(1000002, 's1');
    st.run(1000003, 's1'); st.run(1000003, 's5');
    st.run(1000004, 's6');
    expect(similarShare(s.db, ['s1'], '20s', 'friends')).toEqual({ s1: 1, s3: 0.5 });
    const all = similarShare(s.db, ['s1'], null, null);
    expect(all.s1).toBe(1);
    expect(all.s3).toBeCloseTo(1 / 3);
    expect(all.s5).toBeCloseTo(1 / 3);
    expect(all.s6).toBeUndefined();
    expect(similarShare(s.db, [], null, null)).toEqual({});
    expect(similarShare(s.db, ["s1') OR 1=1 --" as SpotId], null, null)).toEqual({});
  });
});

describe('T-039 段差少なめと、答え合わせまで同じ予言', () => {
  it('段差少なめの人には段差のあるスポットを予言しない', () => {
    const stepped = SPOTS.filter((x) => !x.stepFree).map((x) => x.id);
    expect(stepped.length).toBeGreaterThan(0);
    for (const visited of [[], ['s1'], ['s1', 's2', 's3'], ['s1', 's2', 's3', 's4', 's6', 's7']] as SpotId[][]) {
      const r = rankProphecy({ visited, stepLess: true, today: '2026-11-09', weights: {}, similar: { s5: 1, s10: 1 }, hours: [] });
      expect(r.length).toBeGreaterThan(0);
      expect(r.some((x) => stepped.includes(x.spotId))).toBe(false);
    }
  });

  it('API: 段差少なめで作り、QR を足しても答え合わせまで同じ予言', async () => {
    await openDay('2026-11-09');
    const pr = await call(s, 'PATCH', '/api/me/profile', g, { stepLess: true });
    expect(pr.status).toBe(200);
    await qr('s1');
    const first = (await prophecy()).current;
    if (!first) throw new Error('no prophecy');
    expect(spotById(first.spotId).stepFree).toBe(true);
    await qr('s2');
    await qr('s3');
    expect((await prophecy()).current?.id).toBe(first.id);
    expect((await prophecy()).current?.spotId).toBe(first.spotId);
    const open = s.db.prepare("SELECT count(*) AS n FROM prophecies WHERE user_id = ? AND status = 'open'").get(g) as { n: number };
    expect(open.n).toBe(1);
  });
});

describe('T-040 答え合わせ', () => {
  it('再訪の日に予言のスポットで QR を読むと +2（QR の +1 と別）。旅の2日目・別のスポットでは答え合わせにならない', async () => {
    await openDay('2026-11-09');
    await qr('s1');
    const p = (await prophecy()).current;
    if (!p) throw new Error('no prophecy');
    const other = SPOTS.find((x) => x.kind !== 'shop' && x.id !== p.spotId && x.id !== 's1')?.id ?? 's2';

    // 作った日と同じ日・旅の2日目は答え合わせにならない
    expect((await qr(p.spotId)).prophecyCheck).toBeNull();
    await openDay('2026-11-11');
    expect((await qr(p.spotId)).prophecyCheck).toBeNull();
    expect((await prophecy()).current?.status).toBe('open');

    // 再訪の日: 別のスポットは答え合わせにならず、予言のスポットで +1 と +2
    const m = await openDay('2026-11-20');
    expect(m.visitKind).toBe('revisit');
    const o = await qr(other);
    expect(o.prophecyCheck).toBeNull();
    const before = (await me()).rollsLeft;
    const hit = await qr(p.spotId);
    expect(hit.granted).toBe(true);
    expect(hit.prophecyCheck).toEqual({ prophecyId: p.id });
    expect(hit.rollsLeft).toBe(before + 1 + 2);
    const st = await prophecy();
    expect(st.current?.id).toBe(p.id);
    expect(st.current?.status).toBe('visited');
    expect(st.checks).toBe(1);
    // 同じ日にもう一度読んでも増えない
    const again = await qr(p.spotId);
    expect(again.granted).toBe(false);
    expect(again.prophecyCheck).toBeNull();
    expect(again.rollsLeft).toBe(hit.rollsLeft);
  });
});

describe('T-041 「気に入った？」', () => {
  it('答えは3種だけ。さいころは変わらず、1つの予言に1回。気に入った→重み上、ふつう→重み下', async () => {
    await openDay('2026-11-09');
    await qr('s1');
    const open = (await prophecy()).current;
    if (!open) throw new Error('no prophecy');
    // 答え合わせ前は答えられない
    expect((await answer(open.id, 'liked')).status).toBe(409);

    const st = await visitProphecy('2026-11-09', '2026-11-20');
    const p = st.current;
    if (!p || p.status !== 'visited') throw new Error('not visited');
    for (const bad of ['great', '', 'LIKED', 1, null]) {
      const r = await answer(p.id, bad);
      expect(r.status).toBe(400);
      expect(errCode(r)).toBe('bad_request');
    }
    expect((await call(s, 'POST', `/api/prophecy/${p.id}/answer`, g, { requestId: rid(), answer: 'liked', x: 1 })).status).toBe(400);
    expect((await answer(999999, 'liked')).status).toBe(404);
    expect((await call(s, 'POST', '/api/prophecy/abc/answer', g, { requestId: rid(), answer: 'liked' })).status).toBe(400);

    const rolls = (await me()).rollsLeft;
    const id = rid();
    const r1 = await answer(p.id, 'liked', id);
    expect(r1.status).toBe(200);
    expect((await answer(p.id, 'liked', id)).text).toBe(r1.text);
    expect((await me()).rollsLeft).toBe(rolls);
    const w = weights();
    for (const tag of spotById(p.spotId).tags) expect(w[tag]).toBe(0.5);
    expect((await answer(p.id, 'normal')).status).toBe(409);
    const after = r1.body as ProphecyState;
    expect(after.liked).toBe(1);
    expect(after.current?.id).not.toBe(p.id);
    expect(after.current?.status).toBe('open');

    // 2つ目: あとで → ふつう に答え直せる。ふつうで重みが下がる
    const st2 = await visitProphecy('2026-11-20', '2026-11-28');
    const p2 = st2.current;
    if (!p2) throw new Error('no second');
    expect((await answer(p2.id, 'later')).status).toBe(200);
    const w0 = weights();
    const r2 = await answer(p2.id, 'normal');
    expect(r2.status).toBe(200);
    const w2 = weights();
    for (const tag of spotById(p2.spotId).tags) expect(w2[tag]).toBe((w0[tag] ?? 0) - 0.5);
    expect((r2.body as ProphecyState).normal).toBe(1);
  });

  it('他人の予言には答えられない', async () => {
    await openDay('2026-11-09');
    await qr('s1');
    const st = await visitProphecy('2026-11-09', '2026-11-20');
    const p = st.current;
    if (!p) throw new Error('no prophecy');
    const other = newGuest();
    await session(s, other);
    const r = await call(s, 'POST', `/api/prophecy/${p.id}/answer`, other, { requestId: rid(), answer: 'liked' });
    expect(r.status).toBe(404);
  });
});

describe('T-042 かしこさ・的中率・記録', () => {
  it('答え合わせ 0・1・3・5・8 回でレベル1〜5、的中率と記録の印', async () => {
    expect([0, 1, 2, 3, 4, 5, 7, 8, 20].map(levelOf)).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(hitRate(0, 0)).toBeNull();
    expect(hitRate(3, 1)).toBe(0.75);
    expect(['liked', 'normal', 'later', null].map(historyMark)).toEqual(['○', '△', '―', '―']);

    await openDay('2026-11-09');
    await qr('s1');
    let st = await prophecy();
    expect(st.level).toBe(1);
    st = await visitProphecy('2026-11-09', '2026-11-20');
    expect(st.level).toBe(2);
    expect(st.checks).toBe(1);
    expect(st.history.map((h) => h.status)).toContain('visited');
  });
});
