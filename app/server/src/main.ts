// 起動の順番（アーキテクチャ設計 §3）: 環境変数 → DB → CSV 取込 → 127.0.0.1 で待ち受け → VOICEVOX を温める
import { loadEnv } from './env.ts';
import { openDb } from './db.ts';
import { availableAvatars, createApp } from './app.ts';
import { CsvDirError, importCsv } from './import/importer.ts';
import { seedAdminDemo } from './services/demo-seed.ts';
import { createVoicevox } from './services/tts-service.ts';
import { log } from './log.ts';

process.on('uncaughtException', (e: unknown) => {
  log('error', 'uncaughtException', { name: e instanceof Error ? e.name : 'unknown', message: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
process.on('unhandledRejection', (e: unknown) => {
  log('error', 'unhandledRejection', { message: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});

function start(): void {
  const env = loadEnv();
  const db = openDb(env.dbPath);
  try {
    importCsv(db, env.sampleDataDir);
  } catch (e: unknown) {
    if (e instanceof CsvDirError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  const ctx = { db, demoMode: env.demoMode, adminMode: env.adminMode, clock: () => new Date(), avatars: availableAvatars() };
  if (env.adminMode && env.demoMode) seedAdminDemo(ctx);
  const tts = createVoicevox(env.voicevoxPort);
  const app = createApp(ctx, tts, { port: env.port });
  const server = app.listen(env.port, '127.0.0.1', () => {
    log('info', 'listening', { url: `http://127.0.0.1:${env.port}`, demoMode: env.demoMode, avatars: [...ctx.avatars].join(',') });
    void tts.warm();
  });
  const stop = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start();
