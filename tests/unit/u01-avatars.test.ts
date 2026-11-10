// U-01: アバターの絵の取込（4枚そろった体だけ・安全でない SVG は入れない）と、サーバーの一覧（AC-008 の土台）
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkSvg, importAvatars } from '../../app/server/src/import/avatar-files.ts';
import { AVATAR_SRC_DIR, availableAvatars } from '../../app/server/src/app.ts';
import { AVATAR_FILES } from '../../app/shared/master/avatars.ts';

const OK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="40" fill="#F6E7C8"/></svg>';
const tmp = mkdtempSync(join(tmpdir(), 'mc017-av-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('SVG の検査', () => {
  it('図形だけの SVG は通し、スクリプト・外部参照・イベント属性・style は拒否する', () => {
    expect(checkSvg(OK)).toEqual([]);
    expect(checkSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).toContain('script');
    expect(checkSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="x()"/></svg>')).toContain('event attribute');
    expect(checkSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>')).toEqual(expect.arrayContaining(['image', 'href', 'external reference']));
    expect(checkSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(#g)"/></svg>')).toContain('url()');
    expect(checkSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>rect{}</style></svg>')).toContain('style');
    expect(checkSvg('<html><svg></svg></html>')).toContain('not svg');
  });
});

describe('取込', () => {
  it('4枚そろった体だけ写し、欠けた体は写さず古い写しも消す（準備中になる）', () => {
    const src = join(tmp, 'src');
    const dst = join(tmp, 'dst');
    mkdirSync(join(src, 'tomonyan'), { recursive: true });
    mkdirSync(join(src, 'pikkon'), { recursive: true });
    mkdirSync(dst, { recursive: true });
    for (const f of AVATAR_FILES) writeFileSync(join(src, 'tomonyan', `tomonyan-${f}.svg`), OK);
    writeFileSync(join(src, 'pikkon', 'pikkon-happy.svg'), OK);
    writeFileSync(join(dst, 'pikkon-happy.svg'), OK);
    const res = importAvatars(src, dst);
    expect(res.find((r) => r.id === 'tomonyan')?.status).toBe('copied');
    expect(res.find((r) => r.id === 'pikkon')?.status).toBe('incomplete');
    expect(readdirSync(dst).sort()).toEqual(AVATAR_FILES.map((f) => `tomonyan-${f}.svg`).sort());
    expect([...availableAvatars(dst)]).toEqual(['tomonyan']);
  });

  it('安全でない SVG を含む体は写さない', () => {
    const src = join(tmp, 'src2');
    const dst = join(tmp, 'dst2');
    mkdirSync(join(src, 'toujii'), { recursive: true });
    for (const f of AVATAR_FILES) writeFileSync(join(src, 'toujii', `toujii-${f}.svg`), f === 'excited' ? OK.replace('<circle', '<circle onload="x()"') : OK);
    const res = importAvatars(src, dst);
    expect(res.find((r) => r.id === 'toujii')?.status).toBe('rejected');
    expect(readdirSync(dst)).toEqual([]);
  });

  it('取り込み済みの絵（app/client/public/avatars）はすべて検査を通る', async () => {
    const { readFileSync } = await import('node:fs');
    const files = readdirSync(AVATAR_SRC_DIR).filter((f) => f.endsWith('.svg'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(checkSvg(readFileSync(join(AVATAR_SRC_DIR, f), 'utf8')), f).toEqual([]);
  });

  it('取り込み済みの絵は docs/10_企画/アバター の最新と同じ（違えば npm run import:avatars）', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const docs = join(process.cwd(), 'docs', '10_企画', 'アバター');
    const files = readdirSync(AVATAR_SRC_DIR).filter((f) => f.endsWith('.svg'));
    for (const f of files) {
      const id = f.slice(0, f.indexOf('-'));
      const src = join(docs, id, f);
      expect(existsSync(src), src).toBe(true);
      expect(readFileSync(join(AVATAR_SRC_DIR, f), 'utf8') === readFileSync(src, 'utf8'), `${f} が古い`).toBe(true);
    }
  });
});
