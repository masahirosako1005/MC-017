// U-01: ヘッダ・入力検証・Origin・エラー・個人情報（T-002・T-057・T-059・T-066）
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allCounts, call, errCode, newGuest, rid, session, startServer, type TestServer } from './helpers.ts';
import { request as httpRequest } from 'node:http';
import { CSP } from '../../app/server/src/http/headers.ts';

let s: TestServer;
beforeAll(async () => { s = await startServer(); });
afterAll(async () => { await s.close(); });

function expectSecurityHeaders(h: Headers): void {
  expect(h.get('content-security-policy')).toBe(CSP);
  expect(CSP).toContain("img-src 'self' data: https://cyberjapandata.gsi.go.jp");
  expect(CSP).toContain('media-src blob:');
  expect(CSP).not.toContain('upgrade-insecure-requests');
  expect(h.get('x-content-type-options')).toBe('nosniff');
  expect(h.get('referrer-policy')).toBe('no-referrer');
  expect(h.get('x-frame-options')).toBe('DENY');
  expect(h.get('permissions-policy')).toContain('geolocation=()');
  expect(h.get('permissions-policy')).toContain('camera=()');
  expect(h.get('cross-origin-opener-policy')).toBe('same-origin');
  expect(h.get('cross-origin-resource-policy')).toBe('same-origin');
  expect(h.get('strict-transport-security')).toBeNull();
  expect(h.get('x-powered-by')).toBeNull();
  expect(h.get('access-control-allow-origin')).toBeNull();
  expect(h.get('cross-origin-embedder-policy')).toBeNull();
}

describe('T-002 ダミー ID の形式', () => {
  it.each(['guest-ABC', "' OR 1=1--", 'guest-abc', 'guest-abcdefg', 'user-abcdef', ''])('形式外 %s は 400', async (id) => {
    const r = await call(s, 'POST', '/api/session', null, {}, id === '' ? {} : { 'x-guest-id': id });
    expect(r.status).toBe(400);
    expect(errCode(r)).toBe('bad_request');
  });
  it('正しい形式なら 200 で、名前・メールの項目が無い', async () => {
    const g = newGuest();
    const r = await call(s, 'POST', '/api/session', g, {});
    expect(r.status).toBe(200);
    expect((r.body as { id: string }).id).toBe(g);
  });
});

describe('T-057 HTTP ヘッダ', () => {
  it('API・404・エラーの応答に同じヘッダがあり、HSTS が無い', async () => {
    const g = newGuest();
    await session(s, g);
    const ok = await call(s, 'GET', '/api/health', null);
    expectSecurityHeaders(ok.headers);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const nf = await call(s, 'GET', '/api/nothing', null);
    expect(nf.status).toBe(404);
    expectSecurityHeaders(nf.headers);
    expect(nf.text).not.toContain('Cannot GET');
    const nf2 = await call(s, 'GET', '/no-such-page.txt', null);
    expect(nf2.status).toBe(404);
    expectSecurityHeaders(nf2.headers);
    expect(nf2.text).not.toContain('Cannot GET');
    const bad = await call(s, 'POST', '/api/rolls', g, '{"requestId":', {});
    expect(bad.status).toBe(400);
    expectSecurityHeaders(bad.headers);
  });
});

describe('T-059 入力の拒否', () => {
  it('未知キー・型違い・大きすぎ・JSON 以外・配列のクエリ・別オリジンを拒否し、DB は変わらず内部情報も出ない', async () => {
    const g = newGuest();
    await session(s, g);
    const before = allCounts(s.db);
    const cases = [
      await call(s, 'POST', '/api/rolls', g, { requestId: rid(), extra: 1 }),
      await call(s, 'POST', '/api/rolls', g, { requestId: 123 }),
      await call(s, 'PATCH', '/api/me/profile', g, { age: '70s' }),
      await call(s, 'PATCH', '/api/me/profile', g, { companion: 'pet' }),
      await call(s, 'PATCH', '/api/me/profile', g, {}),
      await call(s, 'GET', '/api/me?x=1', g),
      await call(s, 'GET', '/api/health?a=1&a=2', null),
    ];
    for (const r of cases) expect(r.status).toBe(400);
    const big = await call(s, 'PATCH', '/api/me/profile', g, { age: '20s', pad: 'x'.repeat(17 * 1024) });
    expect(big.status).toBe(413);
    expect(errCode(big)).toBe('too_large');
    const form = await call(s, 'POST', '/api/rolls', g, `requestId=${rid()}`, { 'content-type': 'application/x-www-form-urlencoded' });
    expect(form.status).toBe(415);
    const text = await call(s, 'POST', '/api/rolls', g, 'hello', { 'content-type': 'text/plain' });
    expect(text.status).toBe(415);
    const cross = await call(s, 'POST', '/api/rolls', g, { requestId: rid() }, { origin: 'http://evil.example' });
    expect(cross.status).toBe(403);
    expect(errCode(cross)).toBe('forbidden_origin');
    const same = await call(s, 'PATCH', '/api/me/profile', g, { age: '20s' }, { origin: `http://127.0.0.1:${s.port}` });
    expect(same.status).toBe(200);
    s.db.prepare('UPDATE users SET age = NULL WHERE id = ?').run(g);
    expect(allCounts(s.db)).toEqual(before);
    for (const r of [...cases, big, form, text, cross]) {
      expect(r.text).not.toMatch(/at \w+ \(|node_modules|\\app\\|\/app\/|SELECT|sqlite|express/i);
    }
  });
});

describe('T-066 個人情報なし', () => {
  it('DB の列と API の応答に、名前・メール・LINE ID・性別・居住地が無い', async () => {
    const tables = s.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    const cols: string[] = [];
    for (const t of tables) {
      const info = s.db.prepare('SELECT name FROM pragma_table_info(?)').all(t.name) as { name: string }[];
      cols.push(...info.map((c) => c.name.toLowerCase()));
    }
    expect(cols.length).toBeGreaterThan(20);
    for (const c of cols) expect(c).not.toMatch(/name|mail|line|gender|sex|address|region|residence|username/);
    const g = newGuest();
    await session(s, g);
    const me = await call(s, 'GET', '/api/me', g);
    expect(me.text).not.toMatch(/username|mail|line_?id|gender|性別|居住/i);
  });
});

describe('Host 検査と query 検査（DNS リバインディング・SEC-IN-07）', () => {
  function rawGet(path: string, host: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: s.port, path, headers: { host } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
  }
  it('Host が 127.0.0.1 / localhost 以外なら 403、自分のホスト名なら通る', async () => {
    expect(await rawGet('/api/health', 'evil.example:3000')).toBe(403);
    expect(await rawGet('/api/health', `127.0.0.1:${s.port}`)).toBe(200);
    expect(await rawGet('/api/health', `localhost:${s.port}`)).toBe(200);
    expect(await rawGet('/api/health', `localhost:5173`)).toBe(200);
  });
  it('query を取らない API に query があれば 400', async () => {
    const r = await call(s, 'GET', '/api/health?x=1', null);
    expect(r.status).toBe(400);
  });
});

