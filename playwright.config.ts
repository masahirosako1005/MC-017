// E2E（ADR-015）。1並列・順序に依存しない・サーバーは Playwright が起動して止める。DB はメモリ上。
import { defineConfig } from '@playwright/test';

/** 端末に入っている Microsoft Edge を使う（ブラウザの追加ダウンロードをしない）【仮定】。PW_CHANNEL で変えられる */
const channel = process.env.PW_CHANNEL ?? 'msedge';
/** 試験中は VOICEVOX につながない（何も listen していないポート）。読み上げは route で差し替える */
const NO_ENGINE_PORT = process.env.E2E_VOICEVOX_PORT ?? '50999';

export default defineConfig({
  testDir: 'tests/e2e',
  // 実エンジンの試験は E2E_VOICEVOX_PORT を指定したときだけ動かす（既定は VOICEVOX なしの試験）
  testIgnore: process.env.E2E_VOICEVOX_PORT ? undefined : /real-voice/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel,
    viewport: { width: 390, height: 844 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    serviceWorkers: 'block',
    trace: 'off',
  },
  webServer: [
    {
      command: 'npx tsx scripts/start-demo.ts',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORT: '3000', DB_PATH: ':memory:', VOICEVOX_PORT: NO_ENGINE_PORT, ADMIN_MODE: '0' },
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npx tsx app/server/src/main.ts',
      url: 'http://127.0.0.1:3100/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORT: '3100', DB_PATH: ':memory:', DEMO_MODE: '0', VOICEVOX_PORT: NO_ENGINE_PORT, ADMIN_MODE: '0' },
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // 運営向け（ADMIN_MODE=1・ダミーの利用者つき）。運営向けの E2E だけが使う【仮定】
      command: 'npx tsx scripts/start-admin.ts',
      url: 'http://127.0.0.1:3200/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORT: '3200', DB_PATH: ':memory:', VOICEVOX_PORT: NO_ENGINE_PORT },
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
