// `npm run import:csv`: サーバーを起動せずに CSV を取り込み、件数を表示する（起動時の取込と同じ処理）
import { loadEnv } from '../app/server/src/env.ts';
import { openDb } from '../app/server/src/db.ts';
import { CsvDirError, importCsv } from '../app/server/src/import/importer.ts';

const env = loadEnv();
const db = openDb(env.dbPath);
try {
  const results = importCsv(db, env.sampleDataDir);
  for (const r of results) console.log(`${r.file}: rows=${r.rows} imported=${r.imported} skipped=${r.skipped} ${JSON.stringify(r.reasons)}`);
} catch (e: unknown) {
  console.error(e instanceof CsvDirError ? e.message : 'CSV の取込に失敗しました');
  process.exitCode = 1;
} finally {
  db.close();
}
