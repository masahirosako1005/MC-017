// U-10・U-11: 次に行く予定と、盤の 🏪（利用者アプリ側）。運営向け（ADMIN_MODE=1・ダミーの利用者つき）のサーバー 3200 を使う
import { test, expect, demoClock, openApp, openSpotDetail, tab } from './fixtures.ts';

test.use({ baseURL: 'http://127.0.0.1:3200' });

/** JST の今日から n 日後の日付（サーバーの運営の「今日」は実際の今日） */
function jstDay(n: number): string {
  return new Date(Date.now() + 9 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);
}

test('T-070 (E) 次に行く予定: 入れる・外す・4つ目は入れられない・店には出ない', async ({ page }) => {
  await openApp(page);
  await tab(page, 'スポット');
  await openSpotDetail(page, 's7');
  await expect(page.getByTestId('plan-add')).toBeVisible();
  await page.getByTestId('plan-add').click();
  await expect(page.getByTestId('plan-in')).toContainText('1/3');
  await page.reload();
  await tab(page, 'スポット');
  await openSpotDetail(page, 's7');
  await expect(page.getByTestId('plan-in')).toContainText('1/3');
  await page.getByTestId('plan-remove').click();
  await expect(page.getByTestId('plan-add')).toBeVisible();

  for (const spot of ['s7', 's1', 's2']) {
    await page.goto('/');
    await tab(page, 'スポット');
    await openSpotDetail(page, spot);
    await page.getByTestId('plan-add').click();
    await expect(page.getByTestId('plan-in')).toBeVisible();
  }
  await page.goto('/');
  await tab(page, 'スポット');
  await openSpotDetail(page, 's3');
  await page.getByTestId('plan-add').click();
  await expect(page.getByText('予定は 3 つまで')).toBeVisible();
  await expect(page.getByTestId('plan-add')).toBeVisible();

  await page.goto('/');
  await tab(page, 'スポット');
  await openSpotDetail(page, 's8');
  await expect(page.getByTestId('plan-box')).toHaveCount(0);
});

test('T-075 (E) 承認されたキャンペーンは、期間に入ると、予定のある人の盤にだけ 🏪 が出る', async ({ page, request }) => {
  const h = (op: string) => ({ 'X-Operator': op, 'Content-Type': 'application/json' });
  const created = await request.post('/api/admin/shops/s8/campaigns', {
    headers: h('shop-s8'),
    data: { requestId: crypto.randomUUID(), kind: 'yen', itemKey: null, value: 200, starts: jstDay(1), ends: jstDay(9) },
  });
  expect(created.status()).toBe(200);

  await openApp(page);
  await tab(page, 'スポット');
  await openSpotDetail(page, 's7');
  await page.getByTestId('plan-add').click();
  await expect(page.getByTestId('plan-in')).toBeVisible();

  // 期間の前（今日）は出ない
  await page.goto('/');
  await tab(page, '遊ぶ');
  await expect(page.locator('.tile.shop')).toHaveCount(0);

  await demoClock(page, 2);
  await tab(page, '遊ぶ');
  await expect(page.locator('.tile.shop')).toHaveCount(1);
  await expect(page.getByTestId('board-legend')).toContainText('お店の特典');
  const sq = Number(await page.locator('.tile.shop').getAttribute('data-sq'));
  expect(sq).toBeGreaterThanOrEqual(3);
  expect(sq).toBeLessThanOrEqual(10);
});
