// アバターの絵を docs/10_企画/アバター/ から app/client/public/avatars/ へ取り込む（npm run import:avatars）。
import { fileURLToPath } from 'node:url';
import { importAvatars } from '../app/server/src/import/avatar-files.ts';
import { AVATAR_SRC_DIR } from '../app/server/src/app.ts';

const srcRoot = fileURLToPath(new URL('../docs/10_企画/アバター', import.meta.url));
const results = importAvatars(srcRoot, AVATAR_SRC_DIR);
for (const r of results) {
  console.log(`${r.id}: ${r.status}${r.detail.length > 0 ? ` (${r.detail.join('; ')})` : ''}`);
}
if (results.some((r) => r.status === 'rejected')) process.exitCode = 1;
