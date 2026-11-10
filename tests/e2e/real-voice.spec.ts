// 実際の VOICEVOX につないで、しゃべることを確かめる（E2E_VOICEVOX_PORT=50021 のときだけ動く。2026-11-10 指示）
import { expect, openApp, test } from './fixtures.ts';

test('実エンジン: 読み上げを押すと /api/tts が 200 で wav を返し、音が再生され、クレジットが出て、「起動していない」は出ない', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __play: string[] };
    w.__play = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      return orig.call(this).then(
        () => { w.__play.push('ok'); },
        (e: unknown) => { w.__play.push(`ng:${e instanceof Error ? e.name : 'unknown'}`); throw e; },
      );
    };
  });
  const tts = page.waitForResponse((r) => r.url().endsWith('/api/tts') && r.request().method() === 'POST', { timeout: 30_000 });
  await openApp(page);
  const res = await tts;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('audio/wav');
  const played = () => page.evaluate(() => (window as unknown as { __play: string[] }).__play);
  await expect.poll(played).not.toEqual([]);
  console.log('play results (before tap):', JSON.stringify(await played()));
  await expect(page.getByTestId('voice-credit')).toHaveText('VOICEVOX:春日部つむぎ');
  await expect.poll(played).toContain('ok');
  await expect(page.getByText('VOICEVOX が起動していない')).toHaveCount(0);
});

test('実エンジン: 自動再生を拒否されても「起動していない」は出さず、最初のタップで声が出る', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __play: string[]; __blockOnce: boolean };
    w.__play = [];
    w.__blockOnce = true;
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (w.__blockOnce) {
        w.__blockOnce = false;
        w.__play.push('blocked');
        return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      }
      return orig.call(this).then(() => { w.__play.push('ok'); });
    };
  });
  const tts = page.waitForResponse((r) => r.url().endsWith('/api/tts') && r.request().method() === 'POST', { timeout: 30_000 });
  await openApp(page);
  expect((await tts).status()).toBe(200);
  const played = () => page.evaluate(() => (window as unknown as { __play: string[] }).__play);
  await expect.poll(played).toEqual(['blocked']);
  await expect(page.getByText('VOICEVOX が起動していない')).toHaveCount(0);
  await page.mouse.click(200, 400);
  await expect.poll(played).toEqual(['blocked', 'ok']);
  await expect(page.getByTestId('voice-credit')).toHaveText('VOICEVOX:春日部つむぎ');
});
