// 再初期化（スキーマ・マスタ・CSV 取込・デモ種まきの再実行）で、店舗・履歴・ログを消さない（2026-11-10 の指示）
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initDb } from '../../app/server/src/db.ts';
import { importCsv } from '../../app/server/src/import/importer.ts';
import { seedAdminDemo } from '../../app/server/src/services/demo-seed.ts';
import { startServer, type TestServer } from './helpers.ts';

const SAMPLE = process.env.SAMPLE_DATA_DIR ?? 'C:\\AI-Sprint\\sample-data';
let s: TestServer;
// 表名は sqlite_master から取った値だけ（利用者入力ではない）。試験の中だけで使う
const count = (t: string): number => (s.db.prepare(`SELECT COUNT(*) AS n FROM "${t.replace(/"/g, '')}"`).get() as { n: number }).n;
beforeAll(async () => { s = await startServer({ demoMode: true, adminMode: true }); });
afterAll(async () => { await s.close(); });

describe('初期化しても消えない', () => {
  it('initDb・importCsv・seedAdminDemo を再実行しても、どの表の行数も減らない', () => {
    importCsv(s.db, SAMPLE);
    seedAdminDemo(s.ctx);
    const tables = (s.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
    const before = new Map(tables.map((t) => [t, count(t)]));
    expect(before.get('campaigns')).toBeGreaterThan(0);
    expect(before.get('visits')).toBeGreaterThan(0);
    expect(before.get('import_log')).toBeGreaterThan(0);

    initDb(s.db);
    importCsv(s.db, SAMPLE);
    seedAdminDemo(s.ctx);

    for (const t of tables) expect(count(t), t).toBeGreaterThanOrEqual(before.get(t) ?? 0);
  });
});

