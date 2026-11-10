// `npm run lint`（ADR-019）: 依存なしで禁止事項を探す。見つかれば終了コード 1。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['app/client/src', 'app/server/src', 'app/shared', 'scripts', 'tests'];
const SELF = 'scripts/check-forbidden.ts';

const RULES: { name: string; re: RegExp; only?: RegExp }[] = [
  { name: 'innerHTML などの HTML 文字列の挿入', re: /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write\(/ },
  { name: 'eval / new Function', re: /\beval\(|new Function\(/ },
  { name: '明示の any', re: /:\s*any\b|\bas any\b|<any>/ },
  { name: '理由のない ts-ignore / ts-expect-error', re: /@ts-(ignore|expect-error)(?!\s+--?\s*\S)/ },
  { name: 'SQL の文字列連結（prepare にテンプレートの式）', re: /prepare\(\s*`[^`]*\$\{/ },
  { name: 'res.redirect', re: /\bres\.redirect\(/, only: /app\/server/ },
  { name: '0.0.0.0 での待ち受け', re: /listen\([^)]*0\.0\.0\.0/ },
];

function walk(dir: string, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const n of names) {
    if (n === 'node_modules' || n === 'dist') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
}

const files: string[] = [];
for (const r of ROOTS) walk(r, files);
let found = 0;
for (const f of files) {
  const rel = relative('.', f).replaceAll('\\', '/');
  if (rel === SELF) continue;
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.only && !rule.only.test(rel)) continue;
      if (rule.re.test(line)) {
        found += 1;
        console.log(`${rel}:${i + 1}: ${rule.name}: ${line.trim().slice(0, 120)}`);
      }
    }
  });
}
console.log(`checked ${files.length} files, ${found} problem(s)`);
if (found > 0) process.exitCode = 1;
