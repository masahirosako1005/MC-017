// VOICEVOX を 127.0.0.1 の固定ホストで呼ぶ（ADR-011）。音声は保存しない。
import { VOICEVOX_SPEAKERS, type AvatarId } from '../../../shared/master/avatars.ts';
import { HttpError } from '../http/errors.ts';
import { log } from '../log.ts';

const TIMEOUT_MS = 10_000;
const RECHECK_MS = 30_000;
const MAX_WAV_BYTES = 5 * 1024 * 1024;

export interface Tts {
  status(): { available: boolean };
  synth(avatarId: AvatarId, text: string): Promise<Buffer>;
  warm(): Promise<void>;
}

type FetchFn = typeof fetch;

export function createVoicevox(port: number, fetchFn: FetchFn = fetch, nowMs: () => number = Date.now): Tts {
  const base = `http://127.0.0.1:${port}`;
  let available = false;
  let lastFail = Number.NEGATIVE_INFINITY;

  const unavailable = () => new HttpError(503, 'tts_unavailable');

  async function ping(): Promise<boolean> {
    try {
      const r = await fetchFn(`${base}/version`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      return r.ok;
    } catch {
      return false;
    }
  }

  async function call(avatarId: AvatarId, text: string): Promise<Buffer> {
    const sp = VOICEVOX_SPEAKERS[avatarId];
    const q = new URLSearchParams({ text, speaker: String(sp.id) });
    const qr = await fetchFn(`${base}/audio_query?${q.toString()}`, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!qr.ok) throw new Error(`audio_query ${qr.status}`);
    const query: unknown = await qr.json();
    if (typeof query !== 'object' || query === null || Array.isArray(query)) throw new Error('audio_query shape');
    const body = JSON.stringify({ ...query, speedScale: sp.speedScale });
    const sr = await fetchFn(`${base}/synthesis?speaker=${sp.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!sr.ok) throw new Error(`synthesis ${sr.status}`);
    const buf = Buffer.from(await sr.arrayBuffer());
    if (buf.length < 44 || buf.length > MAX_WAV_BYTES || buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('synthesis shape');
    return buf;
  }

  return {
    status: () => ({ available }),
    async synth(avatarId, text) {
      if (!available) {
        if (nowMs() - lastFail < RECHECK_MS) throw unavailable();
        if (!(await ping())) {
          lastFail = nowMs();
          throw unavailable();
        }
      }
      try {
        const wav = await call(avatarId, text);
        available = true;
        return wav;
      } catch (e: unknown) {
        available = false;
        lastFail = nowMs();
        log('warn', 'voicevox failed', { reason: e instanceof Error ? e.message : 'unknown' });
        throw unavailable();
      }
    },
    async warm() {
      try {
        await call('tomonyan', 'こんにちは');
        available = true;
        log('info', 'voicevox ready', { port });
      } catch {
        available = false;
        lastFail = nowMs();
        log('info', 'voicevox not available; browser speech will be used', { port });
      }
    },
  };
}
