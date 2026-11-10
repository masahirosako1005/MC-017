// U-01: VOICEVOX（T-047・T-048）と声の選び方（T-049）。実エンジンは使わず、127.0.0.1 の偽のエンジンで確かめる。
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createVoicevox } from '../../app/server/src/services/tts-service.ts';
import { pickVoice } from '../../app/client/src/voice/voice-pick.ts';
import { call, count, errCode, startServer, type TestServer } from './helpers.ts';

function wav(): Buffer {
  const b = Buffer.alloc(64);
  b.write('RIFF', 0, 'ascii');
  b.write('WAVE', 8, 'ascii');
  return b;
}

interface Fake { port: number; seen: { path: string; body: string }[]; up: boolean; close: () => Promise<void> }

async function fakeEngine(): Promise<Fake> {
  const seen: { path: string; body: string }[] = [];
  const state = { up: true };
  const server: Server = createServer((req: IncomingMessage, res) => {
    let body = '';
    req.on('data', (c: Buffer) => { body += c.toString('utf8'); });
    req.on('end', () => {
      if (!state.up) { res.statusCode = 500; res.end(); return; }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      seen.push({ path: url.pathname + url.search, body });
      if (url.pathname === '/version') { res.end('"0.26.1"'); return; }
      if (url.pathname === '/audio_query') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ speedScale: 1, accent_phrases: [] })); return; }
      if (url.pathname === '/synthesis') { res.setHeader('content-type', 'audio/wav'); res.end(wav()); return; }
      res.statusCode = 404; res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const fake: Fake = {
    port: (server.address() as AddressInfo).port,
    seen,
    get up() { return state.up; },
    set up(v: boolean) { state.up = v; },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
  return fake;
}

let engine: Fake;
let s: TestServer;
let clockMs = 0;
beforeAll(async () => {
  engine = await fakeEngine();
  s = await startServer({ tts: createVoicevox(engine.port, fetch, () => clockMs) });
});
afterAll(async () => { await s.close(); await engine.close(); });

describe('T-047 /api/tts', () => {
  it('{avatarId,text} だけを受け付け、固定の 127.0.0.1 へ audio_query→synthesis を呼び WAV を no-store で返す', async () => {
    const before = count(s.db, 'requests');
    const r = await fetch(`${s.base}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ avatarId: 'toujii', text: 'また来てね' }) });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('audio/wav');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(Buffer.from(await r.arrayBuffer()).toString('ascii', 0, 4)).toBe('RIFF');
    const paths = engine.seen.map((x) => x.path);
    expect(paths.some((p) => p.startsWith('/audio_query?') && p.includes('speaker=42'))).toBe(true);
    expect(paths.some((p) => p === '/synthesis?speaker=42')).toBe(true);
    const tomo = await fetch(`${s.base}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ avatarId: 'tomonyan', text: 'こんにちは' }) });
    expect(tomo.status).toBe(200);
    const synth = engine.seen.filter((x) => x.path === '/synthesis?speaker=8').at(-1);
    expect(JSON.parse(synth?.body ?? '{}').speedScale).toBe(1.1);
    expect(count(s.db, 'requests')).toBe(before);
    expect(readdirSync('.').filter((f) => f.endsWith('.wav'))).toEqual([]);
  });

  it.each([
    [{ avatarId: 'tomonyan', text: 'a', extra: 1 }],
    [{ avatarId: 'someone', text: 'a' }],
    [{ avatarId: 'tomonyan', text: '' }],
    [{ avatarId: 'tomonyan', text: '   ' }],
    [{ avatarId: 'tomonyan', text: 'あ'.repeat(101) }],
    [{ avatarId: 'tomonyan', text: 'a', port: 1 }],
  ])('許可外の入力 %j は 400', async (body) => {
    const r = await call(s, 'POST', '/api/tts', null, body);
    expect(r.status).toBe(400);
  });
});

describe('T-048 エンジンが止まっているとき', () => {
  it('503 を返してサーバーは動き続け、エンジンが戻ると確かめ直しのあと 200', async () => {
    engine.up = false;
    const down = await call(s, 'POST', '/api/tts', null, { avatarId: 'pikkon', text: 'こんにちは' });
    expect(down.status).toBe(503);
    expect(errCode(down)).toBe('tts_unavailable');
    expect((await call(s, 'GET', '/api/health', null)).status).toBe(200);
    expect((await call(s, 'GET', '/api/tts/status', null)).body).toEqual({ available: false });
    engine.up = true;
    const tooSoon = await call(s, 'POST', '/api/tts', null, { avatarId: 'pikkon', text: 'こんにちは' });
    expect(tooSoon.status).toBe(503);
    clockMs += 31_000;
    const back = await call(s, 'POST', '/api/tts', null, { avatarId: 'pikkon', text: 'こんにちは' });
    expect(back.status).toBe(200);
    expect((await call(s, 'GET', '/api/tts/status', null)).body).toEqual({ available: true });
  });
});

describe('T-049 ブラウザの声の選び方', () => {
  const v = (name: string, lang: string, localService = true) => ({ name, lang, localService });
  it('端末内の日本語の Nanami を優先し、Online の声と端末外の声は使わず、無ければ null', () => {
    const list = [v('Microsoft Ayumi', 'ja-JP'), v('Microsoft Nanami Online (Natural)', 'ja-JP'), v('Microsoft Nanami', 'ja-JP'), v('Google 日本語', 'ja-JP', false)];
    expect(pickVoice(list, 'ja')?.name).toBe('Microsoft Nanami');
    expect(pickVoice([v('Microsoft Ayumi', 'ja-JP'), v('Google 日本語', 'ja-JP', false)], 'ja')?.name).toBe('Microsoft Ayumi');
    expect(pickVoice([v('Microsoft Nanami Online (Natural)', 'ja-JP'), v('Google 日本語', 'ja-JP', false)], 'ja')).toBeNull();
    expect(pickVoice([v('Microsoft Zira', 'en-US')], 'ja')).toBeNull();
    expect(pickVoice([v('Microsoft Zira', 'en-US')], 'en')?.name).toBe('Microsoft Zira');
  });
});
