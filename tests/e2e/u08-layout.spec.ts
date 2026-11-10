// T-062（390px・430px で横スクロールなし、見えている操作要素は 44px 以上）。画面の写しを test-results/screens に残す。
import type { Page } from '@playwright/test';
import { addRolls, expect, openApp, openSpotDetail, tab, test } from './fixtures.ts';

interface Small { tag: string; text: string; w: number; h: number }

async function checkLayout(page: Page, name: string, width: number): Promise<void> {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(sw, `${name} の横スクロール`).toBeLessThanOrEqual(width);
  const small = await page.evaluate(() => {
    const out: Small[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const el of document.querySelectorAll<HTMLElement>('button, a, select, textarea, input, [role="button"]')) {
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw && getComputedStyle(el).visibility !== 'hidden';
      if (!visible) continue;
      // 文中のリンク（出典のプレート）は WCAG 2.5.8 の例外。プレート自体は 32px 以上
      if (el.closest('.attr')) continue;
      // ライセンスの文中のリンクも 2.5.8 の「文中」の例外
      if (el.tagName === 'A' && el.closest('.lic dd')) continue;
      // 季節タブ（SC-03）は利用者の指示で高さ 28px。WCAG 2.5.8 の下限 24px 以上・幅 44px 以上を守らせる（高さだけ 44px の例外）
      const minH = el.classList.contains('sz') ? 24 : 44;
      if (r.width < 44 || r.height < minH) out.push({ tag: el.tagName, text: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });
  expect(small, `${name} の 44px 未満の操作要素`).toEqual([]);
  await page.screenshot({ path: `test-results/screens/${width}-${name}.png` });
}

for (const width of [390, 430]) {
  test(`T-062 ${width}px で主要画面に横スクロールが無く、操作要素は 44px 以上`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openApp(page);
    await addRolls(page, 1);
    await checkLayout(page, 'home', width);
    await tab(page, 'スポット');
    await expect(page.getByTestId('leaflet-map')).toBeVisible();
    await checkLayout(page, 'spots', width);
    await page.locator('.leaflet-marker-icon[data-spot="s5"]').click();
    await expect(page.getByTestId('sheet')).toBeVisible();
    await checkLayout(page, 'sheet', width);
    await page.getByRole('button', { name: '閉じる' }).click();
    await openSpotDetail(page, 's1');
    await checkLayout(page, 'detail', width);
    await page.getByTestId('qr').click();
    await checkLayout(page, 'qr', width);
    await page.getByRole('button', { name: 'もどる' }).click();
    await page.getByTestId('do-note').click();
    await checkLayout(page, 'note', width);
    await page.getByRole('button', { name: 'もどる' }).click();
    await page.getByTestId('do-invite').click();
    await checkLayout(page, 'invite', width);
    await page.getByRole('button', { name: 'もどる' }).click();
    await page.getByRole('button', { name: 'もどる' }).click();
    await expect(page.getByTestId('leaflet-map')).toBeVisible();
    await tab(page, '遊ぶ');
    await expect(page.locator('.tile')).toHaveCount(30);
    await checkLayout(page, 'play', width);
    await tab(page, 'うわさ');
    await expect(page.getByTestId('rk-yesterday')).toBeVisible();
    await checkLayout(page, 'rumor', width);
    await tab(page, '特典');
    await checkLayout(page, 'perks', width);
    await tab(page, 'ホーム');
    await page.getByTestId('change-avatar').click();
    await expect(page.getByTestId('pick-tomonyan')).toBeVisible();
    await checkLayout(page, 'avatar', width);
    await page.getByRole('button', { name: 'もどる' }).click();
    await page.getByRole('button', { name: '設定' }).click();
    await checkLayout(page, 'settings', width);
    await page.getByTestId('all-screens').scrollIntoViewIfNeeded();
    await checkLayout(page, 'settings-bottom', width);
    await page.getByTestId('all-prophecy').click();
    await expect(page.getByTestId('prophecy-none')).toBeVisible();
    await checkLayout(page, 'prophecy', width);
  });
}

