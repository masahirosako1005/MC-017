// U-01 歩く骨組み: T-001・T-009・T-010・T-013・T-014・さいころ→盤
import { GSI, PNG_1X1, addRolls, expect, openApp, silentWav, tab, test } from './fixtures.ts';

test('T-001 初めて開くと guest-＋6字の ID が端末内で作られ、入力欄が無く、再読み込みしても同じ', async ({ page }) => {
  await openApp(page);
  const id = await page.evaluate(() => localStorage.getItem('mc017.guestId'));
  expect(id).toMatch(/^guest-[a-z0-9]{6}$/);
  await expect(page.locator('input, textarea')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mc017.guestId'))).toBe(id);
});

test('T-009 アバターは同じオリジンの SVG を <img> で出し、alt が「名前（表情）」', async ({ page }) => {
  await openApp(page);
  const img = page.getByRole('img', { name: 'ともにゃん（にこにこ）' });
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect(src).toBe('/avatars/tomonyan-happy.svg');
  expect(await img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
});

test('T-010 読み上げ中は表情と talk が約0.15秒ごとに交互に替わり、終わると元に戻る（VOICEVOX のクレジットも出る）', async ({ page, watch }) => {
  await page.route('**/api/tts', async (route) => {
    watch.ttsCalls += 1;
    await route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'cache-control': 'no-store' }, body: silentWav(1.2) });
  });
  await openApp(page);
  const av = page.locator('.hello .avimg');
  await expect(av).toHaveAttribute('data-mouth', 'closed');
  const samples: string[] = [];
  const times: number[] = [];
  let last = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 900) {
    const m = (await av.getAttribute('data-mouth')) ?? '';
    if (m !== last) { samples.push(m); times.push(Date.now()); last = m; }
    await page.waitForTimeout(20);
  }
  expect(samples.filter((s) => s === 'open').length).toBeGreaterThanOrEqual(2);
  expect(samples.filter((s) => s === 'closed').length).toBeGreaterThanOrEqual(2);
  const gaps = times.slice(2).map((t, i) => t - (times[i + 1] ?? t));
  const avg = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  expect(avg).toBeGreaterThan(90);
  expect(avg).toBeLessThan(260);
  await expect(page.getByTestId('voice-credit')).toHaveText('VOICEVOX:春日部つむぎ');
  await expect(av).toHaveAttribute('data-mouth', 'closed', { timeout: 5000 });
  await expect(page.getByTestId('voice-credit')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'ともにゃん（にこにこ）' })).toBeVisible();
  expect(watch.ttsCalls).toBe(1);
});

test('T-048 VOICEVOX が止まっている（503）と、ブラウザの声には切り替えず、文字だけにして理由を出し、クレジットは出ず、画面は動き続ける', async ({ page, watch }) => {
  // ブラウザの声（speechSynthesis）が呼ばれたら数える
  await page.addInitScript(() => {
    const w = window as unknown as { __speakCalls: number };
    w.__speakCalls = 0;
    const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => { w.__speakCalls += 1; orig(u); };
  });
  await page.route('**/api/tts', async (route) => {
    watch.ttsCalls += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'tts_unavailable', message: '読み上げのエンジンが使えません' } }) });
  });
  await openApp(page);
  await expect.poll(() => watch.ttsCalls).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'VOICEVOX が起動していないので、声は出せません' })).toBeVisible();
  await expect(page.getByRole('button', { name: '読み上げを止める' })).toHaveCount(0);
  await expect(page.getByTestId('voice-credit')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __speakCalls: number }).__speakCalls)).toBe(0);
  await tab(page, '遊ぶ');
  await expect(page.locator('.tile')).toHaveCount(30);
});
test('T-013 地図と簡易地図で「出典：地理院タイル」が見え、地理院の一覧へ別タブでリンクする', async ({ page, watch }) => {
  await openApp(page);
  await tab(page, 'スポット');
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  const link = page.getByRole('link', { name: '出典：地理院タイル' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://maps.gsi.go.jp/development/ichiran.html');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('.leaflet-tile-pane img').first()).toHaveAttribute('src', /^https:\/\/cyberjapandata\.gsi\.go\.jp\/xyz\/pale\/\d+\/\d+\/\d+\.png$/);
  expect([...watch.gsiHosts]).toEqual(['cyberjapandata.gsi.go.jp']);
  await page.context().setOffline(true);
  await expect(page.getByTestId('simple-map')).toBeVisible();
  await expect(page.getByRole('link', { name: '出典：地理院タイル' })).toBeVisible();
  await page.context().setOffline(false);
});

test('T-014 タイルが続けて失敗すると同じアイコンの簡易地図と「オフライン表示中」に替わり、戻ると通常の地図', async ({ page, context }) => {
  await context.route(GSI, (route) => route.abort());
  await openApp(page);
  await tab(page, 'スポット');
  const simple = page.getByTestId('simple-map');
  await expect(simple).toBeVisible();
  await expect(page.getByTestId('offline-badge')).toHaveText(/オフライン表示中/);
  const marker = simple.getByRole('button', { name: /名古屋城/ });
  await expect(marker).toBeVisible();
  const box = await marker.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  const simplePath = await marker.locator('.pin svg path').getAttribute('d');
  expect(simplePath).toBeTruthy();
  await marker.click();
  await expect(simple.locator('.mk.sel[data-spot="s1"]')).toBeVisible();
  await context.unroute(GSI);
  await context.route(GSI, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 }));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByTestId('leaflet-map')).toBeVisible();
  await expect(page.getByTestId('offline-badge')).toHaveCount(0);
  const leafletMarker = page.locator('.leaflet-marker-icon[data-spot="s1"]');
  await expect(leafletMarker).toBeVisible();
  expect(await leafletMarker.locator('.pin svg path').getAttribute('d')).toBe(simplePath);
});

test('U-01 さいころを振ると盤の駒が進み、結果が aria-live に出て、残り回数が1減る', async ({ page }) => {
  await openApp(page);
  await addRolls(page, 2);
  await tab(page, '遊ぶ');
  const btn = page.getByTestId('roll');
  await expect(btn).toHaveText(/あと2回/);
  await btn.click();
  const live = page.getByTestId('roll-live');
  await expect(live).toContainText('マス進んだ', { timeout: 20_000 });
  const face = Number(await page.getByTestId('dice').getAttribute('data-face'));
  expect(face).toBeGreaterThanOrEqual(1);
  expect(face).toBeLessThanOrEqual(6);
  await expect(page.locator('.piece')).toHaveAttribute('data-pos', String(face));
  await expect(page.getByTestId('board-text')).toContainText(`いま ${face + 1} マス目`);
  await expect(btn).toHaveText(/あと1回/);
  await expect(page.locator('.tile')).toHaveCount(30);
  await expect(page.locator('.piece img')).toHaveAttribute('src', '/avatars/tomonyan-happy.svg');
});

