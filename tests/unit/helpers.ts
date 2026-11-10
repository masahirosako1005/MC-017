// 試験用: 実 Express を 127.0.0.1 の空きポートで起動し、fetch で叩く。DB は :memory:（environment ルール）
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomInt, randomUUID } from 'node:crypto';
import { openDb, type Db } from '../../app/server/src/db.ts';
import { availableAvatars, createApp } from '../../app/server/src/app.ts';
import { createVoicevox, type Tts } from '../../app/server/src/services/tts-service.ts';
import { setQuietLog } from '../../app/server/src/log.ts';
import type { Ctx } from '../../app/server/src/services/context.ts';

setQuietLog(true);

export interface TestServer {
  base: string;
  port: number;
  db: Db;
  ctx: Ctx;
  setNow: (iso: string) => void;
  close: () => Promise<void>;
}

export async function startServer(opts: { demoMode?: boolean; adminMode?: boolean; now?: string; tts?: Tts; avatars?: Ctx['avatars'] } = {}): Promise<TestServer> {
  const db = openDb(':memory:');
  let now = new Date(opts.now ?? '2026-11-09T10:00:00+09:00');
  const ctx: Ctx = { db, demoMode: opts.demoMode ?? false, adminMode: opts.adminMode ?? false, clock: () => now, avatars: opts.avatars ?? availableAvatars() };
  const tts = opts.tts ?? createVoicevox(1, async () => { throw new Error('no engine'); });
  const server: Server = createServer();
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
  const port = (server.address() as AddressInfo).port;
  server.on('request', createApp(ctx, tts, { port, staticDir: null }));
  return {
    base: `http://127.0.0.1:${port}`,
    port,
    db,
    ctx,
    setNow: (iso) => { now = new Date(iso); },
    close: () => new Promise<void>((res) => server.close(() => { db.close(); res(); })),
  };
}

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newGuest(): string {
  let s = 'guest-';
  for (let i = 0; i < 6; i += 1) s += CHARS[randomInt(CHARS.length)];
  return s;
}

export function rid(): string {
  return randomUUID();
}

export interface Res { status: number; body: unknown; headers: Headers; text: string }

export async function call(
  s: TestServer, method: string, path: string, guest: string | null, body?: unknown, headers: Record<string, string> = {},
): Promise<Res> {
  const h: Record<string, string> = { ...headers };
  if (guest) h['x-guest-id'] = guest;
  if (body !== undefined && !('content-type' in h)) h['content-type'] = 'application/json';
  const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  const r = await fetch(s.base + path, { method, headers: h, body: payload });
  const text = await r.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: r.status, body: parsed, headers: r.headers, text };
}

export function errCode(r: Res): string | undefined {
  const b = r.body as { error?: { code?: string } } | null;
  return b?.error?.code;
}

export async function session(s: TestServer, guest: string): Promise<void> {
  const r = await call(s, 'POST', '/api/session', guest, {});
  if (r.status !== 200) throw new Error(`session ${r.status}`);
}

export function grantRolls(s: TestServer, guest: string, n: number, day = '2026-11-09'): void {
  s.db.prepare("INSERT INTO grants (user_id, day, source, spot_key, amount, at) VALUES (?, ?, 'demo', ?, ?, ?)")
    .run(guest, day, randomUUID(), n, `${day}T10:00:00+09:00`);
}

const COUNT_SQL: Readonly<Record<string, string>> = {
  users: 'SELECT count(*) AS n FROM users',
  visits: 'SELECT count(*) AS n FROM visits',
  grants: 'SELECT count(*) AS n FROM grants',
  rolls: 'SELECT count(*) AS n FROM rolls',
  stamps: 'SELECT count(*) AS n FROM stamps',
  notes: 'SELECT count(*) AS n FROM notes',
  coupons: 'SELECT count(*) AS n FROM coupons',
  plans: 'SELECT count(*) AS n FROM plans',
  campaigns: 'SELECT count(*) AS n FROM campaigns',
  prophecies: 'SELECT count(*) AS n FROM prophecies',
  requests: 'SELECT count(*) AS n FROM requests',
  csv_users: 'SELECT count(*) AS n FROM csv_users',
  csv_stamps: 'SELECT count(*) AS n FROM csv_stamps',
  csv_rewards: 'SELECT count(*) AS n FROM csv_rewards',
};

export function count(db: Db, table: keyof typeof COUNT_SQL & string): number {
  const sql = COUNT_SQL[table];
  if (!sql) throw new Error('bad table');
  return (db.prepare(sql).get() as { n: number }).n;
}

export function allCounts(db: Db): Record<string, number> {
  return Object.fromEntries(Object.keys(COUNT_SQL).map((t) => [t, count(db, t)]));
}
