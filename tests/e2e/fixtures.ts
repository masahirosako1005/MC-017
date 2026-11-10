// E2E の共通部品（ADR-015）。地理院タイルは 1×1 の PNG に差し替え、ほかの外部への要求は止めて記録する。
import { test as base, expect, type Page } from '@playwright/test';

export const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
export const GSI = 'https://cyberjapandata.gsi.go.jp/**';

/** 無音の WAV（16bit・モノラル・24kHz） */
export function silentWav(seconds: number): Buffer {
  const rate = 24_000;
  const n = Math.round(rate * seconds);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * 2, 40);
  return b;
}

export interface Watch {
  /** 127.0.0.1 と地理院以外への要求（0件であること） */
  external: string[];
  /** 地理院への要求のホスト */
  gsiHosts: Set<string>;
  /** CSP 違反などのコンソールのエラー */
  cspErrors: string[];
  ttsCalls: number;
}

export const test = base.extend<{ watch: Watch }>({
  watch: [async ({ context }, use) => {
    const w: Watch = { external: [], gsiHosts: new Set(), cspErrors: [], ttsCalls: 0 };
    await context.route(GSI, async (route) => {
      w.gsiHosts.add(new URL(route.request().url()).host);
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|cyberjapandata\.gsi\.go\.jp\/)/, async (route) => {
      w.external.push(route.request().url());
      await route.abort();
    });
    context.on('console', (msg) => {
      if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) w.cspErrors.push(msg.text());
    });
    await use(w);
    expect(w.external, '外部への要求').toEqual([]);
    expect(w.cspErrors, 'CSP 違反').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** 開いて利用開始が済むまで待つ */
export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('navigation')).toBeVisible();
}

/** DEMO_MODE のサーバーでさいころの回数を足す（UI のデモ操作は U-07） */
export async function addRolls(page: Page, amount: number): Promise<void> {
  const status = await page.evaluate(async (n) => {
    const id = localStorage.getItem('mc017.guestId') ?? '';
    const r = await fetch('/api/demo/rolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Id': id },
      body: JSON.stringify({ requestId: crypto.randomUUID(), amount: n }),
    });
    return r.status;
  }, amount);
  expect(status).toBe(200);
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
}

/** DEMO_MODE のサーバーで日付を進める */
export async function demoClock(page: Page, offsetDays: number, hour: number | null = null): Promise<void> {
  const status = await page.evaluate(async (b) => {
    const id = localStorage.getItem('mc017.guestId') ?? '';
    const r = await fetch('/api/demo/clock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Id': id },
      body: JSON.stringify(b),
    });
    return r.status;
  }, { offsetDays, hour });
  expect(status).toBe(200);
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
}

/** スポット画面（地図）で、そのスポットのアイコンから概要を開いて詳細へ進む。アイコンが重なる所（s8・s9）では中央を押すと別のアイコンに当たるので、要素の click を直接呼ぶ */
export async function openSpotDetail(page: Page, spotId: string): Promise<void> {
  const marker = page.locator(`.leaflet-marker-icon[data-spot="${spotId}"]`);
  await marker.evaluate((el) => { (el as HTMLElement).click(); });
  await expect(page.getByTestId('sheet')).toBeVisible();
  await page.getByTestId('sheet-detail').click();
}

export async function tab(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name }).click();
}
