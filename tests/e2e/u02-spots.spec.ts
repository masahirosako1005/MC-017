// U-02 スポット: T-011・T-012・T-015・T-016・T-019（ほか QR・ひとこと・誘う の画面の流れ）
import { test, expect, openApp, openSpotDetail, tab } from './fixtures.ts';
import type { Page } from '@playwright/test';

async function openSpots(page: Page): Promise<void> {
  await openApp(page);
  await tab(page, 'スポット');
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
}

/** いま出ているタイルのズーム（Leaflet は前の段のタイルを新しい段が読めるまで残すので、いちばん大きい z-index の段を見る） */
async function scale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const levels = [...document.querySelectorAll<HTMLElement>('.leaflet-tile-pane .leaflet-tile-container')];
    const top = levels.sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
    const img = top?.querySelector<HTMLImageElement>('img');
    const m = img?.src.match(/\/pale\/(\d+)\//);
    return m ? Number(m[1]) : -1;
  });
}

test('T-011 淡色地図のタイルとアイコン、季節タブの強調、拡大・縮小で縮尺が変わる', async ({ page, watch }) => {
  await openSpots(page);
  await expect(page.locator('.leaflet-tile-pane img').first()).toHaveAttribute('src', /\/xyz\/pale\/\d+\/\d+\/\d+\.png$/);
  expect([...watch.gsiHosts]).toEqual(['cyberjapandata.gsi.go.jp']);
  await expect(page.locator('.leaflet-marker-icon[data-spot]')).toHaveCount(11);

  // 2026-11-09 は秋。秋と通年が強調、ほかはグレー
  await expect(page.getByTestId('season-autumn')).toHaveAttribute('aria-pressed', 'true');
  for (const [season, on, off] of [['spring', 's1', 's3'], ['summer', 's3', 's1'], ['winter', 's7', 's5'], ['autumn', 's5', 's7']] as const) {
    await page.getByTestId(`season-${season}`).click();
    await expect(page.getByTestId(`season-${season}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`.leaflet-marker-icon[data-spot="${on}"] .mk`)).not.toHaveClass(/\boff\b/);
    await expect(page.locator(`.leaflet-marker-icon[data-spot="${off}"] .mk`)).toHaveClass(/\boff\b/);
    await expect(page.locator('.leaflet-marker-icon[data-spot="s8"] .mk')).not.toHaveClass(/\boff\b/);
    await expect(page.locator(`.leaflet-marker-icon[data-spot="${off}"]`)).toHaveAttribute('aria-label', /ほかの季節/);
  }

  const z0 = await scale(page);
  await page.getByTestId('zoom-in').click();
  await expect.poll(() => scale(page)).toBe(z0 + 1);
  await page.getByTestId('zoom-out').click();
  await page.getByTestId('zoom-out').click();
  await expect.poll(() => scale(page)).toBe(z0 - 1);
});

test('SC-03 季節タブは高さ約28px（半分）で、「秋のイベント」の凡例・見本の丸・「一覧で見る」ボタンは無い', async ({ page }) => {
  await openSpots(page);
  for (const s of ['spring', 'summer', 'autumn', 'winter']) {
    const box = await page.getByTestId(`season-${s}`).boundingBox();
    if (!box) throw new Error(`season-${s} が見つからない`);
    expect(box.height).toBeGreaterThanOrEqual(28);
    expect(box.height).toBeLessThan(32);
    await expect(page.getByTestId(`season-${s}`).locator('svg')).toBeVisible();
  }
  await expect(page.getByTestId('legend')).toHaveCount(0);
  await expect(page.getByText(/秋のイベント|ほかの季節（グレー）/)).toHaveCount(0);
  await expect(page.locator('main .keyrow, main .sw')).toHaveCount(0);
  await expect(page.getByTestId('mode')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /一覧で見る|地図で見る/ })).toHaveCount(0);
  await expect(page.getByTestId('spot-list')).toHaveCount(0);
  // 季節タブの下がそのまま地図
  const tabsBox = await page.getByTestId('season-winter').boundingBox();
  const mapBox = await page.getByTestId('leaflet-map').boundingBox();
  if (!tabsBox || !mapBox) throw new Error('SC-03 の要素が見つからない');
  expect(mapBox.y - (tabsBox.y + tabsBox.height)).toBeLessThan(24);
});

test('SC-03 キーボードだけで、アイコンに Tab で移り Enter／Space で概要が開き、Esc で閉じる（WCAG 2.1.1）', async ({ page }) => {
  await openSpots(page);
  const s5 = page.locator('.leaflet-marker-icon[data-spot="s5"]');
  await s5.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sheet')).toBeVisible();
  await expect(page.getByRole('heading', { name: '東山動植物園' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sheet')).toHaveCount(0);
  await page.locator('.leaflet-marker-icon[data-spot="s6"]').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: '名古屋市博物館' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '閉じる' })).toBeFocused();
});

test('T-012 アイコンで下から約1/3の概要、詳細を見るで詳細へ', async ({ page }) => {
  await openSpots(page);
  await page.locator('.leaflet-marker-icon[data-spot="s5"]').click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: '東山動植物園' })).toBeFocused();
  const [phone, box] = await Promise.all([page.locator('#phone').boundingBox(), sheet.boundingBox()]);
  if (!phone || !box) throw new Error('no box');
  expect(box.height / phone.height).toBeGreaterThan(0.28);
  expect(box.height / phone.height).toBeLessThan(0.38);
  // 出典は概要に隠れない
  const attr = await page.getByTestId('gsi-attribution').boundingBox();
  if (!attr) throw new Error('no attribution');
  expect(attr.y + attr.height).toBeLessThanOrEqual(box.y);
  // Esc で閉じ、もう一度開いて詳細へ
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await page.locator('.leaflet-marker-icon[data-spot="s5"]').click();
  await page.getByTestId('sheet-detail').click();
  await expect(page.getByRole('heading', { level: 1, name: '東山動植物園' })).toBeVisible();
});

test('SC-03 一覧は無く、地図のアイコン11個すべてに季節つきの名前があり、詳細から戻ると地図と選んだ季節のまま（R-011 は人の判断で削除）', async ({ page }) => {
  await openSpots(page);
  const markers = page.locator('.leaflet-marker-icon[data-spot]');
  await expect(markers).toHaveCount(11);
  for (const m of await markers.all()) await expect(m).toHaveAttribute('aria-label', /、(春|夏|秋|冬|通年)/);
  await expect(page.getByTestId('spot-list')).toHaveCount(0);
  await page.getByTestId('season-winter').click();
  await openSpotDetail(page, 's6');
  await expect(page.getByRole('heading', { level: 1, name: '名古屋市博物館' })).toBeVisible();
  await page.getByRole('button', { name: 'もどる' }).click();
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  await expect(page.getByTestId('season-winter')).toHaveAttribute('aria-pressed', 'true');
});

test('T-016 詳細に架空のイベント・段差・実在施設の注記・きっかけ3つの状態', async ({ page }) => {
  await openSpots(page);
  await openSpotDetail(page, 's5');
  await expect(page.getByText('イベント（架空）')).toBeVisible();
  await expect(page.getByText('もみじの植物園まつり')).toBeVisible();
  await expect(page.getByTestId('steps')).toHaveText('段差あり');
  await expect(page.getByText(/施設は場所だけ実在です/)).toBeVisible();
  await expect(page.getByTestId('do-note')).toContainText('＋1 さいころ');
  await expect(page.getByTestId('do-invite')).toContainText('＋1 さいころ');
  await expect(page.getByTestId('qr')).toContainText('QRスタンプを読む');
  await expect(page.getByTestId('near-shops').locator('.shop')).toHaveCount(3);
  await expect(page.getByTestId('voices').locator('.voice')).toHaveCount(2);

  // QR → 今日は済み
  await page.getByTestId('qr').click();
  await expect(page.getByText('カメラは使いません。見本のボタンで読み取ります。')).toBeVisible();
  await page.getByTestId('scan').click();
  await expect(page.getByTestId('qr-result')).toHaveAttribute('data-granted', '1');
  await expect(page.getByText('さいころを1回振れるよ')).toBeVisible();
  await page.getByRole('button', { name: 'もどる' }).click();
  await expect(page.getByTestId('qr')).toContainText('すごろくで遊ぶ');

  // 誘う → 今日は済み
  await page.getByTestId('do-invite').click();
  await expect(page.getByText('LINEに送る場面の見本です。実際には送信されません。')).toBeVisible();
  await page.getByTestId('invite-send').click();
  await expect(page.getByRole('status').filter({ hasText: 'LINEで誘いました（見本）。さいころ ＋1' })).toBeVisible();
  await expect(page.getByTestId('roll')).toBeVisible();
  await tab(page, 'スポット');
  await openSpotDetail(page, 's5');
  await expect(page.getByTestId('do-invite')).toHaveAttribute('data-done', '0');
  await expect(page.getByTestId('do-invite')).toContainText('＋1 さいころ');
  await expect(page.getByTestId('do-note')).toHaveAttribute('data-done', '0');

  // 近くのお店（架空の店）へ移ると、実在施設の注記なし・段差少なめ
  await page.getByTestId('near-shops').locator('.shop').first().click();
  await expect(page.getByTestId('steps')).toHaveText('段差少なめ');
  await expect(page.getByText(/施設は場所だけ実在です/)).toHaveCount(0);
});

test('T-019 XSS の文字列は文字のまま表示され、ダイアログもスクリプトも動かない', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss(); });
  await openSpots(page);
    for (const [i, text] of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>'].entries()) {
    const spot = i === 0 ? 's1' : 's2';
    if (i > 0) { await tab(page, 'スポット'); }
    await openSpotDetail(page, spot);
    await page.getByTestId('do-note').click();
    const area = page.getByTestId('note');
    await area.fill(text);
    await expect(area).toHaveValue(text);
    await expect(page.locator('#note-c')).toHaveText(`${[...text].length} / 100字`);
    await page.getByTestId('send').click();
    await expect(page.getByRole('status').filter({ hasText: 'ひとことを残しました' })).toBeVisible();
    await expect(page.getByTestId('roll')).toBeVisible();
  }
  expect(await page.locator('img[src="x"], #root script').count()).toBe(0);
  expect(dialogs).toEqual([]);
});

test('ひとこと: 空のまま送ると知らせて入力欄へ、二重押しでも1回分', async ({ page }) => {
  await openSpots(page);
  await openSpotDetail(page, 's3');
  await page.getByTestId('do-note').click();
  await page.getByTestId('note').fill('   ');
  await page.getByTestId('send').click();
  await expect(page.getByRole('alert')).toHaveText('ひとことを書いてから送ってね');
  await expect(page.getByTestId('note')).toBeFocused();

  let posts = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/spots/s3/notes')) posts += 1; });
  await page.getByTestId('note').fill('青い光がきれい');
  await page.getByTestId('send').dblclick();
  await expect(page.getByTestId('roll')).toBeVisible();
  expect(posts).toBe(1);
});
