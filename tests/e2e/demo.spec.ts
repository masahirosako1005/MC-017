// U-08 通しデモと横断試験（docs/40_試験/E2Eデモシナリオ.md）: T-043・T-044・T-056・T-058・T-063・T-064
import type { Page } from '@playwright/test';
import { addRolls, expect, openApp, openSpotDetail, tab, test } from './fixtures.ts';

const JA = /[\u3040-\u30ff\u4e00-\u9fff]/;

async function scanAt(page: Page, spotId: string): Promise<void> {
  await tab(page, 'スポット');
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  await openSpotDetail(page, spotId);
  await page.getByTestId('qr').click();
  await page.getByTestId('scan').click();
}

test('通しデモ（T-056・T-058）: 1日目に QR→さいころ→おすすめ、7日後に再訪ボーナスと答え合わせ→特典・うわさ。通信先は 127.0.0.1 と地理院だけ、CSP 違反0件', async ({ page, watch }) => {
  await openApp(page);
  await expect(page.getByTestId('greet')).toHaveText(/ようこそ/);
  await page.getByLabel('年齢').selectOption('20s');
  await page.getByLabel('一緒に来た人').selectOption('friends');

  await tab(page, 'スポット');
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  await expect(page.getByRole('link', { name: '出典：地理院タイル' })).toBeVisible();
  await scanAt(page, 's5');
  await expect(page.getByTestId('qr-result')).toHaveAttribute('data-granted', '1');
  await page.getByRole('button', { name: 'すごろくで遊ぶ' }).click();
  await expect(page.getByTestId('gain')).toBeVisible();
  await page.getByRole('button', { name: /さいころを振る/ }).click();
  await expect(page.getByTestId('cheer')).toBeVisible({ timeout: 20_000 });

  await tab(page, 'ホーム');
  await page.getByTestId('next-where').getByRole('button', { name: 'おすすめを見る' }).click();
  const card = page.getByTestId('prophecy-card');
  await expect(card).toBeVisible();
  const spot = (await card.getAttribute('data-spot')) ?? '';
  await page.getByRole('button', { name: 'もどる' }).click();

  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByTestId('demo-plus7').click();
  await expect(page.getByRole('status').filter({ hasText: 'アプリ内の今日を' })).toBeVisible();
  await page.getByRole('button', { name: 'この設定でもどる' }).click();
  await expect(page.getByTestId('greet')).toHaveText(/再訪ボーナス/);
  await expect(page.getByTestId('next-lead')).toContainText('答え合わせを待っています');

  await scanAt(page, spot);
  await expect(page.getByTestId('check-reward')).toContainText('さいころ ＋2');
  await page.getByTestId('ans-liked').click();
  await expect(page.getByTestId('answer-result')).toContainText('当たり');

  await page.getByRole('button', { name: 'もどる' }).click();
  await page.getByRole('button', { name: 'もどる' }).click();
  await tab(page, '特典');
  await expect(page.getByRole('heading', { level: 1, name: '特典' })).toBeVisible();
  await tab(page, 'うわさ');
  await expect(page.getByTestId('rk-yesterday')).toBeVisible();
  await expect(page.getByTestId('rk-age')).toBeVisible();

  expect(watch.external).toEqual([]);
  expect([...watch.gsiHosts].every((h) => h === 'cyberjapandata.gsi.go.jp')).toBe(true);
  expect(watch.cspErrors).toEqual([]);
});

/** 主要画面を順に開き、各画面で check を呼ぶ（ホーム・スポット・詳細・すごろく・うわさ・特典・おすすめ・設定） */
async function eachMain(page: Page, names: { tabs: string[]; settings: string; back: string }, check: (name: string) => Promise<void>): Promise<void> {
  const [home, spots, play, rumor, perks] = names.tabs as [string, string, string, string, string];
  await tab(page, home);
  await check('home');
  await tab(page, spots);
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  await check('spots');
  await openSpotDetail(page, 's1');
  await check('detail');
  await page.getByRole('button', { name: names.back }).click();
  await tab(page, play);
  await expect(page.locator('.tile')).toHaveCount(30);
  await check('play');
  await tab(page, rumor);
  await expect(page.getByTestId('rk-yesterday')).toBeVisible();
  await check('rumor');
  await tab(page, perks);
  await check('perks');
  await page.getByRole('button', { name: names.settings, exact: true }).click();
  await check('settings');
  await page.getByTestId('all-prophecy').click();
  await expect(page.getByTestId('prophecy-none')).toBeVisible();
  await check('prophecy');
}

test('T-043 English にすると主要画面の見出し・メニュー・ボタンが英語になり、<html lang="en">', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByTestId('lang-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Done' }).click();
  await eachMain(page, { tabs: ['Home', 'Spots', 'Play', 'Buzz', 'Perks'], settings: 'Settings', back: 'Back' }, async (name) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const texts = await page.locator('h1, h2, nav.tabs button, main button:visible').allInnerTexts();
    const ja = texts.map((s) => s.trim()).filter((s) => s && s !== '日本語' && JA.test(s));
    expect(ja, `${name} に日本語が残っている`).toEqual([]);
  });
});

test('T-044 文字「大」で 390px の主要画面に横スクロールが無く、主なボタンが見えて押せる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByTestId('size-l').click();
  await expect(page.locator('html')).toHaveCSS('font-size', '20px');
  await page.getByRole('button', { name: 'この設定でもどる' }).click();
  await eachMain(page, { tabs: ['ホーム', 'スポット', '遊ぶ', 'うわさ', '特典'], settings: '設定', back: 'もどる' }, async (name) => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw, `${name} の横スクロール`).toBeLessThanOrEqual(390);
    const act = page.locator('.act button').first();
    if (await act.count()) {
      await expect(act, `${name} の下の主ボタン`).toBeInViewport();
      await expect(act).toBeEnabled();
    }
    await page.screenshot({ path: `test-results/screens/size-l-${name}.png` });
  });
});

test('T-063 キーボードだけで下のメニューを移り、さいころを振れ、フォーカスが見える', async ({ page }) => {
  await openApp(page);
  await addRolls(page, 1);
  const focusIs = (name: RegExp) => page.evaluate((src) => {
    const el = document.activeElement;
    return el?.tagName === 'BUTTON' && new RegExp(src).test((el.textContent ?? '').trim());
  }, name.source);
  let found = false;
  for (let i = 0; i < 60 && !found; i += 1) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement?.closest('nav.tabs') !== null && (document.activeElement?.textContent ?? '').includes('遊ぶ'));
  }
  expect(found, '下のメニューの「遊ぶ」にフォーカスが届く').toBe(true);
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement as Element); return `${s.outlineStyle} ${s.outlineWidth}`; });
  expect(outline).toMatch(/^solid 3px$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.tile')).toHaveCount(30);

  found = false;
  for (let i = 0; i < 60 && !found; i += 1) {
    await page.keyboard.press('Tab');
    found = await focusIs(/^さいころを振る/);
  }
  expect(found, '「さいころを振る」にフォーカスが届く').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('cheer')).toBeVisible({ timeout: 20_000 });
});

test('T-064 API が失敗すると原因と「もう一度」が出て、押すと直る。読み込み中の表示がある', async ({ page }) => {
  await openApp(page);
  let fail = true;
  await page.route('**/api/rumors**', async (route) => {
    if (fail) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"internal","message":"x"}}' }); return; }
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await tab(page, 'うわさ');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('うまくいきませんでした。少し待ってから もう一度ためしてね。');
  fail = false;
  await alert.getByRole('button', { name: 'もう一度' }).click();
  await expect(page.getByText('読み込み中…')).toBeVisible();
  await expect(page.getByTestId('rk-yesterday')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});


