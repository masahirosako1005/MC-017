// U-09〜U-12 の運営向けの画面（T-078）。ADMIN_MODE=1・DEMO_MODE=1（ダミーの利用者つき）のサーバー 3200 を使う。PC の幅
import { test, expect } from './fixtures.ts';

test.use({ baseURL: 'http://127.0.0.1:3200', viewport: { width: 1280, height: 800 } });

test('T-078 役割を選ぶ → 店で近くの予定から特典を作る → 観光協会で承認 → 別の店で声を確認する', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('screen-role')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  // 店舗（みそかつ こもれび）
  await page.getByTestId('role-shop').click();
  await page.getByTestId('shop-pick').selectOption('s11');
  await page.getByTestId('shop-go').click();
  await expect(page.getByTestId('screen-shop')).toBeVisible();
  await expect(page.getByTestId('hourly-table')).toBeVisible();
  await expect(page.getByTestId('sameday-table')).toBeVisible();

  // 近くの予定が足りているので、選択式のフォームで作れる（店名・自由入力の欄は無い）
  await page.getByTestId('nav-demand').click();
  await expect(page.getByTestId('demand-total')).toContainText('人');
  await expect(page.getByTestId('campaign-form').locator('input[type="text"], textarea')).toHaveCount(0);
  await expect(page.getByTestId('campaign-preview')).toContainText('みそかつミニ1切れ サービス');
  await page.getByTestId('campaign-submit').click();
  await expect(page.getByTestId('status')).toContainText('登録しました');
  await expect(page.getByTestId('campaign-row')).toHaveCount(1);
  await expect(page.getByTestId('campaign-row')).toContainText('開始前');

  // 観光協会: ダッシュボードの数字（承認の画面は無い）
  await page.getByTestId('role-change').click();
  await page.getByTestId('role-association').click();
  await expect(page.getByTestId('screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('kpi-k01')).toBeVisible();
  await expect(page.getByTestId('funnel')).toBeVisible();
  await expect(page.getByTestId('funnel')).not.toContainText('guest-');
  await page.getByTestId('nav-review').click();
  const row = page.getByTestId('review-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('みそかつミニ1切れ サービス');
  await row.getByTestId('approve').click();
  await expect(page.getByTestId('review-empty')).toBeVisible();

  // 別の店（あかり堂）: お客さまの声。電話番号は伏せられ、確認した印が付く
  await page.getByTestId('role-change').click();
  await page.getByTestId('role-shop').click();
  await page.getByTestId('shop-pick').selectOption('s8');
  await page.getByTestId('shop-go').click();
  await expect(page.getByTestId('unread-notice')).toBeVisible();
  await page.getByTestId('nav-voices').click();
  await expect(page.getByTestId('voice-item')).toHaveCount(2);
  await expect(page.getByText('電話番号などを伏せました')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('090-1234');
  await expect(page.locator('body')).not.toContainText('guest-');
  await page.getByTestId('voice-confirm').first().click();
  await expect(page.getByTestId('voice-confirm')).toHaveCount(1);
  await expect(page.getByTestId('voice-list').getByText('確認済み')).toHaveCount(1);
});