// U-06 再訪とおすすめ: T-038〜T-042 の画面側（SC-09 表示A・表示B、QR からの答え合わせ）
import { test, expect, openApp, openSpotDetail, tab, demoClock } from './fixtures.ts';
import type { Page } from '@playwright/test';

async function scanAt(page: Page, spotId: string): Promise<void> {
  await tab(page, 'スポット');
  await openSpotDetail(page, spotId);
  await page.getByTestId('qr').click();
  await page.getByTestId('scan').click();
}

test('T-038・T-039・T-041 QR のあとおすすめカード、7日後にそのスポットで答え合わせ ＋2、気に入った → 履歴に ○', async ({ page }) => {
  await openApp(page);
  // QR 0回: ホームの「次はどこ？」はボタン無しの案内（SC-01 #5）。おすすめの画面は設定の「すべての画面」から開ける
  await expect(page.getByTestId('next-lead')).toHaveText('スポットで QR を読むと、ともにゃんがおすすめを選べるようになるよ');
  await expect(page.getByTestId('next-where').getByRole('button')).toHaveCount(0);
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByTestId('all-prophecy').click();
  await expect(page.getByTestId('prophecy-none')).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);

  await page.getByRole('button', { name: 'もどる' }).click();
  await page.getByRole('button', { name: 'この設定でもどる' }).click();
  await scanAt(page, 's5');
  await expect(page.getByTestId('qr-result')).toHaveAttribute('data-granted', '1');
  await page.getByRole('button', { name: 'もどる' }).click();
  await page.getByRole('button', { name: 'もどる' }).click();
  await tab(page, 'ホーム');
  await page.getByTestId('next-where').getByRole('button', { name: 'おすすめを見る' }).click();
  const card = page.getByTestId('prophecy-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('role', 'group');
  const spot = await card.getAttribute('data-spot');
  expect(spot).toMatch(/^s\d+$/);
  expect(spot).not.toBe('s5');
  await expect(card.locator('.reasons li').first()).toBeVisible();
  await expect(card.locator('.rstr').first()).toHaveText(/^(強い|ふつう|弱い)$/);
  await expect(page.getByTestId('history')).toContainText('―');

  // 同じ日は答え合わせにならない → 7日後にそのスポットで QR
  await demoClock(page, 7);
  await scanAt(page, spot ?? '');
  await expect(page.getByTestId('check-reward')).toContainText('さいころ ＋2');
  await expect(page.getByTestId('check-reward')).toHaveAttribute('role', 'status');

  // 二重送信しても答えは1回（ボタンは送信中と回答後に押せない）
  await page.getByTestId('ans-liked').dblclick();
  await expect(page.getByTestId('answer-result')).toContainText('○ おすすめ、当たり！');
  await expect(page.getByTestId('answer-result')).toContainText('1回中1回');
  await expect(page.getByTestId('ans-normal')).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveCount(0);

  // もどると QR の画面ではなく詳細へ（読み取りの画面は履歴に残さない）
  await page.getByRole('button', { name: 'もどる' }).click();
  await expect(page.getByTestId('qr')).toContainText('すごろくで遊ぶ');
  await page.getByRole('button', { name: 'もどる' }).click();
  await tab(page, 'ホーム');
  await page.getByTestId('next-where').getByRole('button', { name: 'おすすめを見る' }).click();
  await expect(page.getByTestId('prophecy-card')).toBeVisible();
  await expect(page.getByTestId('history')).toContainText('○ 当たり');
});



