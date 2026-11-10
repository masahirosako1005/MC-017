// アバターの絵の取込（R-006・R-007、AC-008）。docs/10_企画/アバター/<id>/ の4枚がそろった体だけを public/avatars へ写す。
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AVATAR_FILES, AVATAR_IDS, type AvatarId } from '../../../shared/master/avatars.ts';

const MAX_BYTES = 200 * 1024;
const FORBIDDEN: readonly [RegExp, string][] = [
  [/<script/i, 'script'],
  [/<foreignObject/i, 'foreignObject'],
  [/<image/i, 'image'],
  [/<style/i, 'style'],
  [/<use/i, 'use'],
  [/\shref\s*=/i, 'href'],
  [/\son[a-z]+\s*=/i, 'event attribute'],
  [/url\s*\(/i, 'url()'],
  [/<!ENTITY|<!DOCTYPE/i, 'doctype/entity'],
];
const SVG_NS = /xmlns\s*=\s*"http:\/\/www\.w3\.org\/2000\/svg"/g;

/** 安全でない内容の一覧（空なら使ってよい） */
export function checkSvg(text: string): string[] {
  const problems: string[] = [];
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(text) || !/<\/svg>\s*$/.test(text)) problems.push('not svg');
  for (const [re, name] of FORBIDDEN) if (re.test(text)) problems.push(name);
  if (/[a-z]+:\/\/|\/\/[a-z0-9-]+\./i.test(text.replace(SVG_NS, ''))) problems.push('external reference');
  return problems;
}

export interface AvatarImport { id: AvatarId; status: 'copied' | 'incomplete' | 'rejected'; detail: string[] }

export function importAvatars(srcRoot: string, dstDir: string): AvatarImport[] {
  mkdirSync(dstDir, { recursive: true });
  return AVATAR_IDS.map((id) => {
    const files = AVATAR_FILES.map((f) => ({ name: `${id}-${f}.svg`, src: join(srcRoot, id, `${id}-${f}.svg`) }));
    const missing = files.filter((f) => !existsSync(f.src)).map((f) => f.name);
    const problems = files.filter((f) => existsSync(f.src)).flatMap((f) => {
      if (statSync(f.src).size > MAX_BYTES) return [`${f.name}: too large`];
      return checkSvg(readFileSync(f.src, 'utf8')).map((p) => `${f.name}: ${p}`);
    });
    if (missing.length > 0 || problems.length > 0) {
      for (const f of files) rmSync(join(dstDir, f.name), { force: true });
      return { id, status: missing.length > 0 ? 'incomplete' : 'rejected', detail: [...missing.map((m) => `missing ${m}`), ...problems] };
    }
    for (const f of files) copyFileSync(f.src, join(dstDir, f.name));
    return { id, status: 'copied', detail: [] };
  });
}
