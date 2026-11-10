// U-04 特典（T-031 と 使う確認の画面）・U-05 うわさ（画面）。
// 【仮定】さいころの目はサーバーの乱数なので、3つの状態（使える・次に来た日から・利用済み）がそろう一覧は API の応答を route で固定して画面を確かめる。
// 使えるかどうかの判定（T-032・T-033）は単体試験で実サーバーに対して確かめる。
import { test, expect, openApp, openSpotDetail, tab } from './fixtures.ts';
import type { Page } from '@playwright/test';

const COUPONS = {
  stamps: 3,
  coupons: [
    { id: 3, templateId: 'season', shopId: 's10', season: 'autumn', obtainedDay: '2026-11-09', usableFrom: '2026-11-16', expires: '2027-01-08', status: 'later', isNew: true },
    { id: 2, templateId: 'souv10', shopId: 's8', season: null, obtainedDay: '2026-11-09', usableFrom: '2026-11-09', expires: '2027-01-08', status: 'usable', isNew: false },
    { id: 1, templateId: 'kishimen', shopId: 's9', season: null, obtainedDay: '2026-11-01', usableFrom: '2026-11-01', expires: '2026-12-31', status: 'used', isNew: false },
  ],
};

async function fixCoupons(page: Page): Promise<string[]> {
  const posted: string[] = [];
  let used = false;
  await page.route('**/api/coupons', (route) => route.fulfill({
    json: used ? { ...COUPONS, coupons: COUPONS.coupons.map((c) => (c.id === 2 ? { ...c, status: 'used' } : c)) } : COUPONS,
  }));
  await page.route('**/api/coupons/2/use', async (route) => {
    posted.push(route.request().postData() ?? '');
    used = true;
    await route.fulfill({ json: { ...COUPONS.coupons[1], status: 'used' } });
  });
  return posted;
}

test('T-031 特典にスタンプの数と、クーポンが「使える／次に来た日から／利用済み」で並び、使い方・使えるお店・期限が書いてある', async ({ page }) => {
  await fixCoupons(page);
  await openApp(page);
  await tab(page, '特典');
  await expect(page.getByTestId('stamps')).toContainText('取ったスタンプ 3こ');
  const cards = page.getByTestId('coupon');
  await expect(cards).toHaveCount(3);
  // 並び: 新しいもの → 使える → 利用済み
  await expect(cards.nth(0)).toHaveAttribute('data-status', 'later');
  await expect(cards.nth(1)).toHaveAttribute('data-status', 'usable');
  await expect(cards.nth(2)).toHaveAttribute('data-status', 'used');

  const later = cards.nth(0);
  await expect(later).toContainText('栗きんとん');
  await expect(later).toContainText('次に来た日から');
  await expect(later).toContainText('NEW');
  await expect(later).toContainText('2026年11月16日以降に来たら使えます');
  await expect(later.getByTestId('use')).toHaveCount(0);

  const usable = cards.nth(1);
  await expect(usable).toContainText('お土産 10%オフ');
  await expect(usable).toContainText('使える');
  await expect(usable).toContainText('使えるお店');
  await expect(usable).toContainText('期限');
  await expect(usable).toContainText('2027年1月8日');
  await expect(usable).toContainText('使い方');
  await expect(usable).toContainText('お会計の前に、この画面をお店の人に見せてね');

  const used = cards.nth(2);
  await expect(used).toContainText('利用済み');
  await expect(used.getByTestId('use')).toHaveCount(0);
});

test('特典の「使う」→ 確認 → 「使う」で利用済み。やめる・Esc で閉じてボタンへフォーカスが戻る', async ({ page }) => {
  const posted = await fixCoupons(page);
  await openApp(page);
  await tab(page, '特典');
  const useBtn = page.getByTestId('coupon').nth(1).getByTestId('use');

  await useBtn.click();
  const dlg = page.getByRole('dialog', { name: 'この特典を使いますか？' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('使うと元に戻せません');
  await expect(page.getByTestId('confirm-use')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(useBtn).toBeFocused();

  await useBtn.click();
  await page.getByTestId('confirm-cancel').click();
  await expect(dlg).toHaveCount(0);
  expect(posted).toHaveLength(0);

  await useBtn.click();
  await page.getByTestId('confirm-use').click();
  await expect(page.getByRole('status').filter({ hasText: '利用済みにしました' })).toBeVisible();
  await expect(page.getByTestId('coupon').filter({ hasText: 'お土産 10%オフ' })).toHaveAttribute('data-status', 'used');
  expect(posted).toHaveLength(1);
  expect(JSON.parse(posted[0] ?? '{}')).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
});

test('特典（実サーバー）: QR のあとスタンプが1こになり、まだクーポンが無いときは もらい方が出る', async ({ page }) => {
  await openApp(page);
  await tab(page, 'スポット');
  await openSpotDetail(page, 's3');
  await page.getByTestId('qr').click();
  await page.getByTestId('scan').click();
  await page.getByRole('button', { name: 'もどる' }).click();
  await page.getByRole('button', { name: 'もどる' }).click();
  await tab(page, '特典');
  await expect(page.getByTestId('stamps')).toContainText('取ったスタンプ 1こ');
  await expect(page.getByText('まだ特典はありません')).toBeVisible();
});

test('うわさ（実サーバー）: 昨日・過去1か月の人気が人数で出て、年齢が未選択なら選び方を案内し、空いている時間帯のスポットを変えられる', async ({ page }) => {
  await openApp(page);
  await tab(page, 'うわさ');
  await expect(page.getByRole('heading', { name: '昨日の人気' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '過去1か月の人気' })).toBeVisible();
  await expect(page.getByTestId('rk-month').locator('.rank')).toHaveCount(3);
  await expect(page.getByTestId('rk-month').locator('.rank').first()).toContainText(/\d+人/);
  await expect(page.getByTestId('rk-age')).toContainText('ホームの「はじめに選んでね」で選ぶと出ます');
  await expect(page.getByRole('heading', { name: '空いている時間帯：名古屋城' })).toBeVisible();
  await expect(page.getByTestId('quiet-hours')).toHaveAttribute('aria-label', /^9時.*17時/);
  await page.getByLabel('スポット').selectOption('s5');
  await expect(page.getByRole('heading', { name: /空いている時間帯：/ })).not.toHaveText('空いている時間帯：名古屋城');
  await expect(page.getByText('ダミーの集計です')).toBeVisible();
  await page.getByTestId('rk-month').locator('.rank').first().click();
  await expect(page.getByTestId('steps')).toBeVisible();
});
