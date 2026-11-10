// CSV 取込（データ設計 §4、ADR-009）。元のファイルは読むだけ。個人に見える列は取り出さない。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Db } from '../db.ts';
import { spotByCsvName } from '../../../shared/master/spots.ts';
import { COMPANIONS } from '../../../shared/schemas.ts';
import { log } from '../log.ts';
import { columnIndex, decodeUtf8, parseCsv } from './csv.ts';

export const CSV_FILES = { users: '13_ユーザー一覧.csv', stamps: '12_スタンプ獲得履歴.csv', rewards: '18_特典獲得履歴.csv' } as const;

export interface FileResult { file: string; rows: number; imported: number; skipped: number; reasons: Record<string, number> }

export class CsvDirError extends Error {}

const DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const datetime = z.string().regex(DATETIME);
const csvId = z.string().regex(/^[1-9]\d{6}$/).transform(Number);

const userRow = z.strictObject({
  id: csvId,
  age: z.string().regex(/^[1-6]0代(以上)?$/).transform((s) => `${s.slice(0, 2)}s`),
  registered: datetime,
});
const stampRow = z.strictObject({ userId: csvId, round: z.string().regex(/^[1-9]$/).transform(Number), spot: z.string().min(1).max(60), at: datetime });
const rewardRow = z.strictObject({ userId: csvId, reward: z.string().min(1).max(40), at: datetime });

function readRows(dir: string, file: string): string[][] {
  const path = join(dir, file);
  if (!existsSync(path)) throw new CsvDirError(`CSV のファイルが見つかりません: ${file}（SAMPLE_DATA_DIR を確かめてください）`);
  return parseCsv(decodeUtf8(readFileSync(path)));
}

function run<K extends string>(
  db: Db, dir: string, file: string, cols: readonly K[],
  handle: (get: (k: K) => string) => 'ok' | 'dup' | string,
): FileResult {
  const [header, ...data] = readRows(dir, file);
  const idx = header ? columnIndex(header, cols) : null;
  if (!idx) throw new CsvDirError(`CSV の見出しが想定と違います: ${file}`);
  const reasons: Record<string, number> = {};
  let imported = 0;
  db.transaction(() => {
    for (const cells of data) {
      const r = handle((k) => cells[idx[k]] ?? '');
      if (r === 'ok') imported += 1;
      else reasons[r] = (reasons[r] ?? 0) + 1;
    }
  })();
  const res: FileResult = { file, rows: data.length, imported, skipped: data.length - imported, reasons };
  db.prepare('INSERT INTO import_log (file, rows, imported, skipped, reasons, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(file, res.rows, res.imported, res.skipped, JSON.stringify(reasons), new Date().toISOString());
  return res;
}

/** 13 → 12 → 18 の順に取り込む。何度実行しても件数は増えない（INSERT OR IGNORE） */
export function importCsv(db: Db, dir: string): FileResult[] {
  if (!existsSync(dir)) throw new CsvDirError(`CSV のフォルダが見つかりません: ${dir}（SAMPLE_DATA_DIR を確かめてください）`);
  const insUser = db.prepare('INSERT OR IGNORE INTO csv_users (id, age, companion, registered_at) VALUES (?, ?, ?, ?)');
  const hasUser = db.prepare('SELECT 1 FROM csv_users WHERE id = ?');
  const insStamp = db.prepare('INSERT OR IGNORE INTO csv_stamps (user_id, round, spot_id, at, day, hour) VALUES (?, ?, ?, ?, ?, ?)');
  const insReward = db.prepare('INSERT OR IGNORE INTO csv_rewards (user_id, reward, at) VALUES (?, ?, ?)');

  const users = run(db, dir, CSV_FILES.users, ['ユーザーID', '年代', '登録日時'] as const, (get) => {
    const p = userRow.safeParse({ id: get('ユーザーID'), age: get('年代'), registered: get('登録日時') });
    if (!p.success) return 'invalid_row';
    const companion = COMPANIONS[p.data.id % 4] ?? 'solo';
    insUser.run(p.data.id, p.data.age, companion, p.data.registered);
    return 'ok';
  });

  const stamps = run(db, dir, CSV_FILES.stamps, ['ユーザID', '周回', 'スポット名', '獲得日時'] as const, (get) => {
    const p = stampRow.safeParse({ userId: get('ユーザID'), round: get('周回'), spot: get('スポット名'), at: get('獲得日時') });
    if (!p.success) return 'invalid_row';
    if (!hasUser.get(p.data.userId)) return 'unknown_user';
    const spot = spotByCsvName(p.data.spot);
    if (!spot) return 'unknown_spot';
    insStamp.run(p.data.userId, p.data.round, spot.id, p.data.at, p.data.at.slice(0, 10), Number(p.data.at.slice(11, 13)));
    return 'ok';
  });

  const rewards = run(db, dir, CSV_FILES.rewards, ['user_id', 'reward_name', 'timestamp'] as const, (get) => {
    const p = rewardRow.safeParse({ userId: get('user_id'), reward: get('reward_name'), at: get('timestamp') });
    if (!p.success) return 'invalid_row';
    if (!hasUser.get(p.data.userId)) return 'unknown_user';
    insReward.run(p.data.userId, p.data.reward, p.data.at);
    return 'ok';
  });

  const results = [users, stamps, rewards];
  for (const r of results) log('info', 'csv import', { file: r.file, rows: r.rows, imported: r.imported, skipped: r.skipped, reasons: r.reasons });
  logMismatch(db, dir);
  return results;
}

/** 13 の集計列と 12・18 の件数の不一致人数（ログだけ。データ調査 §3-3） */
function logMismatch(db: Db, dir: string): void {
  const [header, ...data] = readRows(dir, CSV_FILES.users);
  const idx = header ? columnIndex(header, ['ユーザーID', 'スタンプ獲得数', '特典獲得数'] as const) : null;
  if (!idx) return;
  const st = db.prepare('SELECT count(*) AS n FROM csv_stamps WHERE user_id = ?');
  const rw = db.prepare('SELECT count(*) AS n FROM csv_rewards WHERE user_id = ?');
  let stampDiff = 0;
  let rewardDiff = 0;
  for (const c of data) {
    const id = Number(c[idx['ユーザーID']]);
    if ((st.get(id) as { n: number }).n !== Number(c[idx['スタンプ獲得数']])) stampDiff += 1;
    if ((rw.get(id) as { n: number }).n !== Number(c[idx['特典獲得数']])) rewardDiff += 1;
  }
  log('info', 'csv mismatch', { stampCountDiffUsers: stampDiff, rewardCountDiffUsers: rewardDiff });
}
