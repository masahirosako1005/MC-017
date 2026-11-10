// デモ動画の録画（開発用。アプリの動作には使わない）。
// 使い方: 別のポート（既定 3300）に ADMIN_MODE=1・DEMO_MODE=1・DB_PATH=:memory: のサーバーを起動してから `npx tsx scripts/demo-video.ts`。
// 出力: docs/50_提出/デモ動画/（Playwright の録画 webm）。
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.DEMO_BASE ?? 'http://127.0.0.1:3300';
const OUT = resolve('docs/50_提出/デモ動画');
const wait = (page: Page, ms: number) => page.waitForTimeout(ms);

async function newContext(browser: Awaited<ReturnType<typeof chromium.launch>>, w: number, h: number): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: w, height: h },
    recordVideo: { dir: OUT, size: { width: w, height: h } },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    serviceWorkers: 'block',
  });
}

async function tab(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name }).click();
}

/** 下まで、ゆっくりスクロールして見せる */
async function scrollThrough(page: Page, selector: string | null): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const done = await page.evaluate((sel) => {
      const el = sel === null ? null : document.querySelector(sel);
      const target = el ?? document.scrollingElement ?? document.documentElement;
      const before = target.scrollTop;
      target.scrollBy({ top: 140, behavior: 'smooth' });
      return { before, max: target.scrollHeight - target.clientHeight };
    }, selector);
    await wait(page, 350);
    if (done.before >= done.max - 2) break;
  }
  await wait(page, 1500);
}

async function userApp(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<string> {
  const ctx = await newContext(browser, 390, 844);
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.getByRole('navigation').waitFor();
  await wait(page, 3000); // トップ画面

  // スポット → QR を読み込む
  await tab(page, 'スポット');
  await page.getByTestId('leaflet-map').waitFor();
  await wait(page, 2000);
  await page.locator('.leaflet-marker-icon[data-spot="s5"]').evaluate((el) => { (el as HTMLElement).click(); });
  await page.getByTestId('sheet').waitFor();
  await wait(page, 1800);
  await page.getByTestId('sheet-detail').click();
  await wait(page, 2000);
  await page.getByTestId('qr').click();
  await wait(page, 1800);
  await page.getByTestId('scan').click();
  await page.getByTestId('qr-result').waitFor();
  await wait(page, 2500);

  // すごろくを実行
  await page.getByRole('button', { name: 'すごろくで遊ぶ' }).click();
  await wait(page, 2500);
  await page.getByRole('button', { name: /さいころを振る/ }).click();
  await page.getByTestId('cheer').waitFor({ timeout: 30_000 });
  await wait(page, 4000);

  // 地図の季節タブ
  await tab(page, 'スポット');
  await page.getByTestId('leaflet-map').waitFor();
  await wait(page, 2000);
  for (const s of ['spring', 'summer', 'autumn', 'winter']) {
    await page.getByTestId(`season-${s}`).click();
    await wait(page, 2200);
  }

  // イベントで友達に LINE を送る（ホームの「注目のイベント」→ 詳細 → LINEで友達を誘う）
  await tab(page, 'ホーム');
  await wait(page, 1500);
  await page.getByTestId('featured').scrollIntoViewIfNeeded();
  await wait(page, 1800);
  await page.getByTestId('featured').click();
  await wait(page, 2000);
  await page.getByTestId('do-invite').scrollIntoViewIfNeeded();
  await wait(page, 1200);
  await page.getByTestId('do-invite').click();
  await wait(page, 2500);
  await page.getByTestId('invite-send').click();
  await wait(page, 4000);

  const video = page.video();
  await ctx.close();
  return (await video?.path()) ?? '';
}

async function adminApp(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<string> {
  const ctx = await newContext(browser, 1280, 800);
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin');
  await page.getByTestId('screen-role').waitFor();
  await wait(page, 2500);

  await page.getByTestId('role-association').click();
  await page.getByTestId('screen-dashboard').waitFor();
  await wait(page, 2500);
  await scrollThrough(page, null);

  await page.getByTestId('role-change').click();
  await wait(page, 1500);
  await page.getByTestId('role-shop').click();
  await wait(page, 1200);
  const options = await page.locator('#shop-pick option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ''));
  await page.locator('#shop-pick').selectOption(options[0] ?? '');
  await wait(page, 1200);
  await page.locator('#shop-form button[type="submit"]').click();
  await page.getByTestId('screen-shop').waitFor();
  await wait(page, 2500);
  await scrollThrough(page, null);

  const video = page.video();
  await ctx.close();
  return (await video?.path()) ?? '';
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' });
const a = await userApp(browser);
const b = await adminApp(browser);
await browser.close();
renameSync(a, resolve(OUT, 'デモ_利用者アプリ.webm'));
renameSync(b, resolve(OUT, 'デモ_運営画面.webm'));
console.log('done', OUT);
