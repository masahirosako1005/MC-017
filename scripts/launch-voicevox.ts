// アプリの起動と一緒に VOICEVOX ENGINE を 127.0.0.1 だけで起動する（2026-11-10 指示）。
// すでにポートが使われていれば（起動済み）何もしない。アプリが終わるとき、ここで起動したエンジンも止める。
// エンジンの場所は $env:VOICEVOX_DIR（既定 C:\voicevox-work\windows-cpu）、ポートは $env:VOICEVOX_PORT（既定 50021）。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';

function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createConnection({ host: '127.0.0.1', port });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

const READY_TIMEOUT_MS = 150_000;

async function ready(port: number): Promise<boolean> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/version`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}

export async function ensureVoicevox(): Promise<void> {
  const port = Number(process.env.VOICEVOX_PORT ?? '50021');
  if (await listening(port)) {
    console.log(`VOICEVOX: ポート ${port} はすでに起動しています。`);
    return;
  }
  const dir = process.env.VOICEVOX_DIR ?? 'C:\\voicevox-work\\windows-cpu';
  const exe = join(dir, 'run.exe');
  if (!existsSync(exe)) {
    console.warn(`VOICEVOX: エンジンが見つかりません（${exe}）。ブラウザの声で動きます。導入は docs/00_準備/音声合成の準備.md §2。`);
    return;
  }
  const child = spawn(exe, ['--host', '127.0.0.1', '--port', String(port), '--disable_mutable_api', '--output_log_utf8'], {
    cwd: dir, stdio: 'ignore', windowsHide: true,
  });
  child.on('error', () => console.warn('VOICEVOX: 起動できませんでした。ブラウザの声で動きます。'));
  const stop = (): void => { if (!child.killed) child.kill(); };
  process.on('exit', stop);
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { stop(); process.exit(0); });
  console.log(`VOICEVOX: エンジンを起動しました（127.0.0.1:${port}）。応答するまで待ちます（約50秒）…`);
  // アプリは起動時に1度だけ VOICEVOX を確かめるため、応答するまでアプリの起動を待つ
  const until = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < until) {
    if (await ready(port)) { console.log('VOICEVOX: 準備ができました。'); return; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn('VOICEVOX: 時間内に応答しませんでした。ブラウザの声で動きます。');
}
