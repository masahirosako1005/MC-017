// U-03 すごろく: T-024・T-025・T-030・T-061・T-068（ほか 増えたきっかけ の帯・結果の相棒のセリフ）
import { test, expect, openApp, openSpotDetail, tab, addRolls } from './fixtures.ts';

test('T-024 残り回数が出て、0回のときは振るボタンが無く、増やし方が出る', async ({ page }) => {
  await openApp(page);
  await tab(page, '遊ぶ');
  await expect(page.getByTestId('roll')).toHaveCount(0);
  await expect(page.getByTestId('no-roll')).toHaveText(/QR・ひとこと・誘う・また来る で増えるよ/);
  await expect(page.getByRole('button', { name: 'スポットを探す' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'すごろくの続き（あと0回）' })).toBeVisible();

  await addRolls(page, 2);
  await tab(page, '遊ぶ');
  await expect(page.getByTestId('roll')).toHaveText(/あと2回/);
  await expect(page.getByRole('button', { name: 'すごろくの続き（あと2回）' })).toBeVisible();
});

test('T-025 縦長の盤（30マス・1段5マス・左上がスタート・左下がゴール・ジグザグ）、駒はアバター、駒へスクロール、盤の文字', async ({ page }) => {
  await openApp(page);
  await tab(page, '遊ぶ');
  const tiles = page.locator('.tile');
  await expect(tiles).toHaveCount(30);
  // 自動スクロール中でも崩れないよう、マスの中心を一度に読む（SVG なので getBoundingClientRect。スクロールは全マス同じだけずれる）
  const pos = await page.evaluate(() => [...document.querySelectorAll('.tile')].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + r.height / 2, left: r.left + r.width / 2 };
  }));
  const top = (sq: number) => pos[sq]?.top ?? NaN;
  const left = (sq: number) => pos[sq]?.left ?? NaN;
  // 1段目の5マスは同じ高さ、6マス目から下の段
  for (const sq of [1, 2, 3, 4]) expect(top(sq)).toBeCloseTo(top(0), 0);
  expect(top(5)).toBeGreaterThan(top(4));
  // ジグザグ: 1段目は左→右、2段目は右→左、3段目はまた左→右
  expect(left(4)).toBeGreaterThan(left(0));
  expect(left(5)).toBeCloseTo(left(4), 0);
  expect(left(9)).toBeCloseTo(left(0), 0);
  expect(left(10)).toBeCloseTo(left(0), 0);
  // スタートが左上・ゴールが左下（6段目は右→左で終わる）
  expect(top(0)).toBeLessThan(top(29));
  expect(left(29)).toBeCloseTo(left(0), 0);
  expect(left(25)).toBeGreaterThan(left(29));
  await expect(page.locator('.tile[data-sq="0"]')).toContainText('スタート');
  await expect(page.locator('.tile[data-sq="29"]')).toContainText('ゴール');
  await expect(page.locator('.tile.gift, .tile.discount')).toHaveCount(15);
  await expect(page.locator('.tile.gift, .tile.discount').first()).toContainText('2');
  // ゴールのあたりに名古屋城の絵
  await expect(page.getByTestId('castle')).toHaveCount(1);
  // 盤の絵は読み上げから隠し、同じ内容を文字で
  await expect(page.locator('.board')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByTestId('board-text')).toHaveText('いま 1 マス目（30マス中）。次の🎁まで 1マス。ゴールまで 29マス。');
  await expect(page.locator('.piece img')).toHaveAttribute('src', '/avatars/tomonyan-happy.svg');
  await expect(page.locator('.piece')).toBeInViewport();
  await expect(page.getByTestId('board-legend')).toContainText('特典');
});
test('T-030 動きを減らす設定で、さいころは約0.5秒で止まり、結果が aria-live に出る', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await addRolls(page, 1);
  await tab(page, '遊ぶ');
  const dice = page.getByTestId('dice');
  const t0 = Date.now();
  await page.getByTestId('roll').click();
  await expect(dice).toHaveAttribute('data-rolling', '0', { timeout: 5_000 });
  const spun = Date.now() - t0;
  expect(spun).toBeGreaterThanOrEqual(400);
  expect(spun).toBeLessThan(1_500);
  const live = page.getByTestId('roll-live');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await expect(live).toContainText(/マス進んだ！/);
  const face = Number(await dice.getAttribute('data-face'));
  await expect(live).toContainText(`さいころ ${face}・${face + 1}マス目に進みました`);
  await expect(dice).toHaveAttribute('aria-label', `さいころ ${face}`);
  await expect(page.getByTestId('cheer')).toBeVisible();
});

test('T-061 さいころのボタンを素早く2回押しても、残り回数は1だけ減る', async ({ page }) => {
  await openApp(page);
  await addRolls(page, 3);
  await tab(page, '遊ぶ');
  const btn = page.getByTestId('roll');
  await btn.dblclick();
  await expect(btn).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('roll-live')).toContainText('マス進んだ', { timeout: 20_000 });
  await expect(btn).toHaveText(/あと2回/);
  const left = await page.evaluate(async () => {
    const r = await fetch('/api/me', { headers: { 'X-Guest-Id': localStorage.getItem('mc017.guestId') ?? '' } });
    return ((await r.json()) as { rollsLeft: number }).rollsLeft;
  });
  expect(left).toBe(2);
});

test('QR で増えたあと すごろくを開くと「QRスタンプで さいころ ＋1」の帯が1回だけ出る', async ({ page }) => {
  await openApp(page);
  await tab(page, 'スポット');
  await openSpotDetail(page, 's2');
  await page.getByTestId('qr').click();
  await page.getByTestId('scan').click();
  await page.getByTestId('to-play').click();
  await expect(page.getByTestId('gain')).toHaveText('QRスタンプで さいころ ＋1');
  await expect(page.getByTestId('gain')).toHaveAttribute('role', 'status');
  await tab(page, 'ホーム');
  await tab(page, '遊ぶ');
  await expect(page.getByTestId('gain')).toHaveCount(0);
});

test('T-068 さいころは盤の上に画面いっぱいで転がり、約5秒かけて目を止めてから閉じ、駒が進む', async ({ page }) => {
  await openApp(page);
  await addRolls(page, 2);
  await tab(page, '遊ぶ');
  const overlay = page.getByTestId('dice-overlay');
  await expect(overlay).toBeHidden();
  const from = Number(await page.locator('.piece').getAttribute('data-pos'));
  const t0 = Date.now();
  await page.getByTestId('roll').click();
  // 画面いっぱい（スマホの枠いっぱい）・ダイアログ・「とばす」にフォーカス
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('role', 'dialog');
  await expect(overlay).toHaveAttribute('aria-modal', 'true');
  const [ov, phone] = await Promise.all([overlay.boundingBox(), page.locator('.phone').boundingBox()]);
  expect(Math.abs((ov?.width ?? 0) - (phone?.width ?? -1))).toBeLessThan(2);
  expect(Math.abs((ov?.height ?? 0) - (phone?.height ?? -1))).toBeLessThan(2);
  const skip = page.getByTestId('dice-skip');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveText('とばす');
  // ゆっくり止まる: 4秒たっても まだ転がっている
  await page.waitForTimeout(3_000);
  await expect(page.getByTestId('dice-big')).toHaveAttribute('data-landed', '0');
  // 止まる: 目と進むマス数が出る
  await expect(page.getByTestId('dice-big')).toHaveAttribute('data-landed', '1', { timeout: 10_000 });
  expect(Date.now() - t0).toBeGreaterThanOrEqual(4_500);
  const face = Number(await page.getByTestId('dice-big').getAttribute('data-face'));
  await expect(page.getByTestId('dice-title')).toHaveText(`${face} が出た！`);
  await expect(skip).toHaveText('すすむ');
  // 閉じて、駒が進む
  await expect(overlay).toBeHidden({ timeout: 5_000 });
  await expect(page.getByTestId('roll-live')).toContainText('マス進んだ', { timeout: 10_000 });
  await expect(page.locator('.piece')).toHaveAttribute('data-pos', String(from + face));
  await expect(page.getByTestId('roll')).toBeFocused();
});

test('T-068 「とばす」と Escape で転がりを切り上げられ、止まった目は変わらず、駒は進む', async ({ page }) => {
  await openApp(page);
  await addRolls(page, 2);
  await tab(page, '遊ぶ');
  const overlay = page.getByTestId('dice-overlay');
  const from = Number(await page.locator('.piece').getAttribute('data-pos'));
  // 「とばす」ボタン
  await page.getByTestId('roll').click();
  await expect(overlay).toBeVisible();
  const t0 = Date.now();
  await page.getByTestId('dice-skip').click();
  await expect(overlay).toBeHidden({ timeout: 4_000 });
  expect(Date.now() - t0).toBeLessThan(4_000);
  await expect(page.getByTestId('roll-live')).toContainText('マス進んだ', { timeout: 10_000 });
  const face = Number(await page.getByTestId('dice').getAttribute('data-face'));
  await expect(page.locator('.piece')).toHaveAttribute('data-pos', String(from + face));
  await expect(page.getByTestId('roll')).toHaveText(/あと1回/);
  // Escape キー
  await page.getByTestId('roll').click();
  await expect(overlay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden({ timeout: 4_000 });
  await expect(page.getByTestId('no-roll')).toBeVisible({ timeout: 15_000 });
});

test('T-068 動きを減らす設定では さいころは回らず 約0.5秒で目が出て、画面いっぱいの表示は短く閉じる', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await addRolls(page, 1);
  await tab(page, '遊ぶ');
  await page.getByTestId('roll').click();
  const big = page.getByTestId('dice-big');
  await expect(big).toHaveAttribute('data-landed', '1', { timeout: 3_000 });
  const running = await big.evaluate((el) => el.getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
  await expect(page.getByTestId('dice-overlay')).toBeHidden({ timeout: 4_000 });
  await expect(page.getByTestId('roll-live')).toContainText('マス進んだ', { timeout: 10_000 });
});

test('T-068 振る前に盤の別の場所を見ていても、駒が動き出すと駒が画面の中に見え、動くあいだ見え続ける', async ({ page }) => {
  await openApp(page);
  await addRolls(page, 1);
  await tab(page, '遊ぶ');
  const main = page.locator('main#view');
  // 盤の下のほう（ゴール側）まで動かして、駒（スタート）を画面の外に出す
  await main.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
  const piece = page.locator('.piece');
  const probe = async () => piece.evaluate((el) => {
    const m = el.closest('main')?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return `${Math.round(r.top - (m?.top ?? 0))}..${Math.round(r.bottom - (m?.top ?? 0))} / ${Math.round(m?.height ?? 0)} pos=${el.getAttribute('data-pos')}`;
  });
  const inside = async () => piece.evaluate((el) => {
    const m = el.closest('main')?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return !!m && r.top >= m.top && r.bottom <= m.bottom;
  });
  await expect.poll(inside).toBe(false);
  await page.getByTestId('roll').click();
  await page.getByTestId('dice-skip').click();
  await expect(page.getByTestId('dice-overlay')).toBeHidden({ timeout: 4_000 });
  // 動き出しの前に駒へ寄る
  await expect.poll(inside, { timeout: 3_000 }).toBe(true);
  // 動くあいだ（最後のマスに着いて結果のカードが出るまで）、見え続ける。結果のカードが盤の上に入ったあとは画面を動かさない（カードを読めるように）
  const live = page.getByTestId('roll-live');
  const samples: boolean[] = [];
  const log: string[] = [];
  const end = Date.now() + 6_000;
  while (Date.now() < end && !(await live.innerText()).includes('マス進んだ')) {
    samples.push(await inside());
    log.push(await probe());
    await page.waitForTimeout(60);
  }
  expect(samples.length).toBeGreaterThan(3);
  expect(samples.every(Boolean), log.join(' | ')).toBe(true);
  await expect(live).toContainText('マス進んだ', { timeout: 10_000 });  // 外側の枠（.phone）は動かない
  expect(await page.locator('.phone').evaluate((el) => el.scrollTop)).toBe(0);
});



