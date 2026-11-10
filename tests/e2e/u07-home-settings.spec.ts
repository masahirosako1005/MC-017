// U-07 ホーム・アバター・設定・デモ: T-004・T-007・T-045・T-046・T-050・T-052・T-054（T-053・T-055 の画面側、WCAG 2.4.5）
import type { Page } from '@playwright/test';
import { addRolls, expect, openApp, silentWav, tab, test, type Watch } from './fixtures.ts';

const NO_DEMO = 'http://127.0.0.1:3100/';

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
}

async function ttsOk(page: Page, watch: Watch, seconds: number): Promise<void> {
  await page.route('**/api/tts/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"available":true}' }));
  await page.route('**/api/tts', async (route) => {
    watch.ttsCalls += 1;
    await route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'cache-control': 'no-store' }, body: silentWav(seconds) });
  });
}

test('T-004 ホームに相棒の絵と名前・変更・あいさつ・続き・次はどこ？・はじめに選んでね・注目のイベント・架空の注記が出る', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('img', { name: 'ともにゃん（にこにこ）' }).first()).toBeVisible();
  await expect(page.getByTestId('home-avatar-name')).toHaveText('ともにゃん');
  await expect(page.getByTestId('change-avatar')).toHaveText('変更');
  await expect(page.getByTestId('greet')).toHaveText(/ようこそ/);
  await expect(page.getByRole('heading', { name: 'すごろくの続き' })).toBeVisible();
  await expect(page.getByTestId('next-lead')).toHaveText('スポットで QR を読むと、ともにゃんがおすすめを選べるようになるよ');
  await expect(page.getByRole('heading', { name: 'はじめに選んでね' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '注目のイベント' })).toBeVisible();
  await expect(page.getByTestId('featured')).toContainText('秋');
  await expect(page.getByText('スポットの内容とイベントは架空です')).toBeVisible();

  await page.getByLabel('年齢').selectOption('30s');
  await expect(page.getByRole('status').filter({ hasText: '保存しました' })).toBeVisible();
  await page.getByLabel('一緒に来た人').selectOption('family');
  await expect(page.getByLabel('一緒に来た人')).toHaveValue('family');
  await page.reload();
  await expect(page.getByLabel('年齢')).toHaveValue('30s');
  await expect(page.getByLabel('一緒に来た人')).toHaveValue('family');

  const evName = (await page.getByTestId('featured').locator('.muted').textContent()) ?? '';
  await page.getByTestId('featured').click();
  await expect(page.getByRole('heading', { level: 1, name: evName })).toBeVisible();
  await expect(page.getByRole('button', { name: 'もどる' })).toBeVisible();
});

test('T-007 相棒の初期はともにゃん。ほしろうを選ぶとホームと駒の絵が替わる。準備中の体は選べない', async ({ page }) => {
  let patches = 0;
  page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().endsWith('/api/me/profile')) patches += 1; });
  await page.route('**/api/avatars', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 'tomonyan', available: true }, { id: 'hoshirou', available: true }, { id: 'pikkon', available: true }, { id: 'toujii', available: false }]),
  }));
  await openApp(page);
  await page.getByTestId('change-avatar').click();
  await expect(page.getByRole('heading', { level: 1, name: '相棒をえらぶ' })).toBeVisible();
  await expect(page.getByTestId('pick-tomonyan')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pick-tomonyan')).toContainText('いまの相棒');
  const off = page.getByTestId('pick-toujii');
  await expect(off).toHaveAttribute('aria-disabled', 'true');
  await expect(off).toContainText('準備中');
  await off.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: '準備中です' })).toBeVisible();
  expect(patches).toBe(0);

  await page.getByTestId('pick-hoshirou').click();
  await expect(page.getByTestId('home-avatar-name')).toHaveText('ほしろう');
  await expect(page.locator('.hello .avimg')).toHaveAttribute('data-avatar', 'hoshirou');
  await expect(page.getByRole('img', { name: 'ほしろう（にこにこ）' }).first()).toBeVisible();
  expect(patches).toBe(1);
  await tab(page, '遊ぶ');
  await expect(page.locator('.board .piece .avimg')).toHaveAttribute('data-avatar', 'hoshirou');
});

test('T-045・T-050 いまの声の名前。読み上げ「なし」で声が止まり、ブラウザの声では /api/tts を呼ばずクレジットも出ない', async ({ page, watch }) => {
  await ttsOk(page, watch, 4);
  await openApp(page);
  await expect(page.getByTestId('voice-credit')).toHaveText('VOICEVOX:春日部つむぎ');
  await openSettings(page);
  await expect(page.getByTestId('voice-now')).toHaveText('いまの声：VOICEVOX:春日部つむぎ');
  await expect(page.getByText('操作のあと、相棒のセリフを吹き出しと同時に読みます。')).toBeVisible();
  await page.getByTestId('speech-off').click();
  await expect(page.getByTestId('voice-credit')).toHaveCount(0);
  await expect(page.getByTestId('voice-now')).toHaveText('いまの声：なし（文字だけ）');
  expect(watch.ttsCalls).toBe(1);

  await page.getByRole('group', { name: '読み上げ' }).getByRole('button', { name: 'あり' }).click();
  await page.getByTestId('voice-browser').click();
  await expect(page.getByTestId('voice-now')).not.toContainText('VOICEVOX');
  await page.getByRole('button', { name: 'この設定でもどる' }).click();
  await page.waitForTimeout(500);
  expect(watch.ttsCalls).toBe(1);
  await expect(page.getByTestId('voice-credit')).toHaveCount(0);
});

test('T-046 ライセンスと出典に 地理院タイル・Leaflet・VOICEVOX ENGINE・4話者・公式と無関係・自作の絵 が出る', async ({ page }) => {
  await openApp(page);
  await openSettings(page);
  const lic = page.getByTestId('licenses');
  await lic.scrollIntoViewIfNeeded();
  const gsi = lic.getByRole('link', { name: '出典：地理院タイル' });
  await expect(gsi).toHaveAttribute('href', 'https://maps.gsi.go.jp/development/ichiran.html');
  await expect(gsi).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(gsi).toHaveAttribute('target', '_blank');
  for (const s of ['Leaflet（BSD-2-Clause）', 'VOICEVOX ENGINE（LGPL v3）', 'VOICEVOX:春日部つむぎ', 'VOICEVOX:満別花丸', 'VOICEVOX:春歌ナナ', 'VOICEVOX:ちび式じい',
    '各キャラクターの公式とは関係ありません', 'このアプリのための自作（SVG）']) {
    await expect(lic).toContainText(s);
  }
  await expect(lic.getByRole('link', { name: 'VOICEVOX' })).toHaveAttribute('href', 'https://github.com/VOICEVOX/voicevox_engine');
});

test('WCAG 2.4.5 設定の「すべての画面」から 相棒をえらぶ・おすすめ へも移れる', async ({ page }) => {
  await openApp(page);
  await openSettings(page);
  await page.getByTestId('all-avatar').click();
  await expect(page.getByRole('heading', { level: 1, name: '相棒をえらぶ' })).toBeVisible();
  await openSettings(page);
  await page.getByTestId('all-prophecy').click();
  await expect(page.getByRole('heading', { level: 1, name: /おすすめ/ })).toBeVisible();
});

test('T-053・T-055 デモ操作: ＋1日で旅の2日目、時刻が変わり、さいころ ＋5 で5回増える', async ({ page }) => {
  await openApp(page);
  const rolls = Number((await page.getByRole('button', { name: /すごろくの続き（あと\d+回）/ }).textContent())?.match(/\d+/)?.[0]);
  await openSettings(page);
  const panel = page.getByTestId('demo-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('demo-today')).toContainText('2026-11-09（月）');
  await page.getByTestId('demo-plus1').click();
  await expect(page.getByRole('status').filter({ hasText: 'アプリ内の今日を 2026-11-10（火） にしました' })).toBeVisible();
  await page.getByTestId('demo-hour').selectOption('19');
  await expect(page.getByTestId('demo-today')).toHaveText('アプリ内の今日: 2026-11-10（火） 19時');
  await page.getByTestId('demo-rolls').dblclick();
  await page.getByRole('button', { name: 'この設定でもどる' }).click();
  await expect(page.getByTestId('greet')).toHaveText(/^こんにちは！今日もよろしくね。/);
  await expect(page.getByRole('button', { name: `すごろくの続き（あと${rolls + 6}回）` })).toBeVisible();
  await page.getByRole('button', { name: /すごろくの続き/ }).click();
  await expect(page.getByTestId('gain')).toContainText('2日目');
});

test('T-053 デモの「もとに戻す」で盤が1枚目の最初に戻り、ホームの「はじめに選んでね」が空で出る', async ({ page }) => {
  await openApp(page);
  await addRolls(page, 5);
  const rolled = await page.evaluate(async () => {
    const id = localStorage.getItem('mc017.guestId') ?? '';
    const r = await fetch('/api/rolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Id': id },
      body: JSON.stringify({ requestId: crypto.randomUUID() }),
    });
    return r.status;
  });
  expect(rolled).toBe(200);
  const patched = await page.evaluate(async () => {
    const id = localStorage.getItem('mc017.guestId') ?? '';
    const r = await fetch('/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Id': id },
      body: JSON.stringify({ age: '30s', companion: 'family' }),
    });
    return r.status;
  });
  expect(patched).toBe(200);
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
  // 2回目以降の起動では「はじめに選んでね」は出ない。盤は1枚目の途中まで進んでいる
  await expect(page.getByRole('heading', { name: 'はじめに選んでね' })).toHaveCount(0);
  await expect(page.locator('.prog span').first()).not.toHaveText(/^1 \/ /);

  await openSettings(page);
  page.once('dialog', (d) => { void d.accept(); });
  await page.getByTestId('demo-reset').click();
  await expect(page.getByTestId('greet')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'はじめに選んでね' })).toBeVisible();
  await expect(page.getByLabel('年齢')).toHaveValue('');
  await expect(page.getByLabel('一緒に来た人')).toHaveValue('');
  await expect(page.getByLabel('年齢')).toBeFocused();
  await expect(page.locator('.prog span').first()).toHaveText(/^1 \/ /);
  await tab(page, '遊ぶ');
  await expect(page.locator('.board')).toBeVisible();
});

test('T-054 デモでいる場所を選ぶと、地図に「いまここ（デモ）」が出る', async ({ page }) => {
  await openApp(page);
  await openSettings(page);
  await page.getByTestId('demo-where').selectOption('s3');
  await expect(page.getByRole('status').filter({ hasText: 'いる場所を変えました' })).toBeVisible();
  await page.getByRole('button', { name: 'この設定でもどる' }).click();
  await tab(page, 'スポット');
  await expect(page.locator('.leaflet-container .here')).toHaveText('いまここ（デモ）');
  await expect(page.locator('.leaflet-marker-icon[data-spot]')).toHaveCount(11);
});

test('T-052 DEMO_MODE なしのサーバーでは設定にデモ操作が出ない（すべての画面・ライセンスは出る）', async ({ page }) => {
  await page.goto(NO_DEMO);
  await expect(page.getByRole('navigation')).toBeVisible();
  await openSettings(page);
  await expect(page.getByTestId('licenses')).toBeVisible();
  await expect(page.getByTestId('all-screens')).toBeVisible();
  await expect(page.getByTestId('demo-panel')).toHaveCount(0);
  await expect(page.getByText('デモ操作')).toHaveCount(0);
});

test('T-050 声が VOICEVOX（既定）で VOICEVOX が止まっていると、設定の「いまの声」に起動していないと出て、English でもブラウザの声にはならない', async ({ page }) => {
  await page.route('**/api/tts/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"available":false}' }));
  await openApp(page);
  await openSettings(page);
  await expect(page.getByTestId('voice-auto')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('voice-now')).toHaveText('いまの声：VOICEVOX が起動していません（文字だけ）');
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('voice-now')).toHaveText('Current voice: VOICEVOX is not running (text only)');
});



