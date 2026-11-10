import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOAL } from '../../shared/board.ts';
import { SPOTS } from '../../shared/master/spots.ts';

export type Db = Database.Database;

const SCHEMA_PATH = fileURLToPath(new URL('../../../db/schema.sql', import.meta.url));

/** DB を開き、スキーマとスポットのマスタを入れる。`:memory:` は試験用 */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  return initDb(db);
}

/** 開いた DB にスキーマ・移行・マスタを入れる（古い形の DB を試験で渡せるように分けてある） */
export function initDb(db: Db): Db {
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  migrateBeforeSchema(db);
  db.exec(schema);
  migrateAfterSchema(db);
  const ins = db.prepare(
    'INSERT OR IGNORE INTO spots (id, kind, season, step_free, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
  );
  db.transaction(() => {
    for (const s of SPOTS) ins.run(s.id, s.kind, s.season, s.stepFree ? 1 : 0, s.lat, s.lng);
  })();
  normalizeBoardPositions(db);
  return db;
}

/** 盤が50マスだった頃のファイルDBに残る、盤の外の位置をゴールの1つ手前へ戻す（45マスへの変更、ADR-021）。新しいDBでは何も起きない */
export function normalizeBoardPositions(db: Db): number {
  return db.prepare('UPDATE users SET pos = ? WHERE pos > ?').run(GOAL - 1, GOAL).changes;
}

function tableSql(db: Db, name: string): string {
  const r = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) as { sql: string } | undefined;
  return r?.sql ?? '';
}

/** 古いファイルDBの coupons は template_id の CHECK に 'campaign' が無い。名前を退避して、schema.sql が新しい表を作れるようにする（U-11） */
function migrateBeforeSchema(db: Db): void {
  const old = tableSql(db, 'coupons');
  if (old === '' || old.includes("'campaign'")) return;
  db.pragma('foreign_keys = OFF');
  db.exec('ALTER TABLE coupons RENAME TO coupons_old');
  db.pragma('foreign_keys = ON');
}

function migrateAfterSchema(db: Db): void {
  if (tableSql(db, 'coupons_old') !== '') {
    db.transaction(() => {
      db.exec(
        `INSERT INTO coupons (id, user_id, template_id, season, board_no, square, shop_id, obtained_day, usable_from, expires, used_at, seen)
         SELECT id, user_id, template_id, season, board_no, square, shop_id, obtained_day, usable_from, expires, used_at, seen FROM coupons_old`,
      );
      db.exec('DROP TABLE coupons_old');
    })();
  }
  if (!tableSql(db, 'notes').includes('shop_visible')) {
    db.exec('ALTER TABLE notes ADD COLUMN shop_visible INTEGER NOT NULL DEFAULT 0 CHECK (shop_visible IN (0,1))');
  }
}