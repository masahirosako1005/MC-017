// U-01: CSV 取込（T-035・T-036・T-037）。元の CSV は読むだけ。不正な行の試験は一時フォルダの合成データで行う。
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openDb } from '../../app/server/src/db.ts';
import { CSV_FILES, CsvDirError, importCsv } from '../../app/server/src/import/importer.ts';
import { decodeUtf8, parseCsv } from '../../app/server/src/import/csv.ts';
import { setQuietLog } from '../../app/server/src/log.ts';
import { count } from './helpers.ts';

setQuietLog(true);
const SAMPLE = process.env.SAMPLE_DATA_DIR ?? 'C:\\AI-Sprint\\sample-data';
const tmp = mkdtempSync(join(tmpdir(), 'mc017-csv-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const BOM = '\uFEFF';
function writeFixture(dir: string): void {
  writeFileSync(join(dir, CSV_FILES.users), BOM + [
    'ユーザーID,ユーザー名,メールアドレス（マスク済）,性別,年代,居住地域,スタンプ獲得数,特典獲得数,登録日時,LINEユーザID,LINEともだちブロック',
    '1000001,x,m,f,20代,r,1,0,2026-10-01 10:00:00,,',
    '1000002,x,m,f,60代以上,r,0,0,2026-10-02 11:00:00,,',
    'abc,x,m,f,20代,r,0,0,2026-10-02 11:00:00,,',
    '1000003,x,m,f,70代,r,0,0,2026-10-02 11:00:00,,',
  ].join('\r\n') + '\r\n');
  writeFileSync(join(dir, CSV_FILES.stamps), BOM + [
    'ユーザID,RAUND管理ユーザ名,ユーザ名,LINEログイン,周回,スタンプ名,スポット名,獲得日時',
    '1000001,,x,0,1,a,"灯雲の石畳通り（星綴港）",2026-10-01 09:08:41',
    '1000001,,x,0,1,a,どこにもない場所,2026-10-01 09:08:41',
    '9999999,,x,0,1,a,灯雲の石畳通り（星綴港）,2026-10-01 09:08:41',
    '1000002,,x,0,1,a,雪雫の音楽堂（鈴風高原）,2026/10/01',
  ].join('\n') + '\n');
  writeFileSync(join(dir, CSV_FILES.rewards), BOM + [
    'user_id,username,is_line,reward_name,prize_name,timestamp',
    '1000001,x,0,特典①：星砂しおり,景品,2026-10-01 13:21:33',
  ].join('\r\n'));
}

function sha(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('CSV の読み取り', () => {
  it('BOM・CRLF/LF・引用符と "" を読み、不正な UTF-8 で止める', () => {
    expect(parseCsv(decodeUtf8(new TextEncoder().encode(BOM + 'a,b\r\n"x,""y""",z\n')))).toEqual([['a', 'b'], ['x,"y"', 'z']]);
    expect(() => decodeUtf8(new Uint8Array([0x61, 0xff, 0x62]))).toThrow();
    expect(() => parseCsv('"abc')).toThrow();
  });
});

describe('T-035 検証と除外の記録', () => {
  it('合わない行は除外して理由を記録し、取込件数＋除外件数＝データ行数', () => {
    const dir = join(tmp, 'fx1');
    mkdirSync(dir, { recursive: true });
    writeFixture(dir);
    const db = openDb(':memory:');
    const [users, stamps, rewards] = importCsv(db, dir);
    expect(users).toMatchObject({ rows: 4, imported: 2, skipped: 2, reasons: { invalid_row: 2 } });
    expect(stamps).toMatchObject({ rows: 4, imported: 1, skipped: 3, reasons: { unknown_spot: 1, unknown_user: 1, invalid_row: 1 } });
    expect(rewards).toMatchObject({ rows: 1, imported: 1, skipped: 0 });
    for (const r of [users, stamps, rewards]) expect((r?.imported ?? -1) + (r?.skipped ?? -1)).toBe(r?.rows);
    expect(db.prepare('SELECT age FROM csv_users WHERE id = 1000002').get()).toEqual({ age: '60s' });
    expect(count(db, 'csv_stamps')).toBe(1);
    db.close();
  });

  it('実データ（13・12・18）を取り込み、件数の合計が合う', () => {
    const db = openDb(':memory:');
    const res = importCsv(db, SAMPLE);
    for (const r of res) expect(r.imported + r.skipped).toBe(r.rows);
    expect(count(db, 'csv_users')).toBe(res[0]?.imported);
    expect(count(db, 'csv_stamps')).toBeGreaterThan(2000);
    expect(count(db, 'csv_rewards')).toBe(res[2]?.imported);
    db.close();
  });
});

describe('T-036 取込を2回実行しても件数が同じ', () => {
  it('2回目の後も各表の件数が変わらない', () => {
    const db = openDb(':memory:');
    importCsv(db, SAMPLE);
    const first = ['csv_users', 'csv_stamps', 'csv_rewards'].map((t) => count(db, t));
    importCsv(db, SAMPLE);
    const second = ['csv_users', 'csv_stamps', 'csv_rewards'].map((t) => count(db, t));
    expect(second).toEqual(first);
    db.close();
  });
});

describe('T-037 元 CSV を変えない・個人の列なし・フォルダが無いと止まる', () => {
  it('取込の前後で元 CSV のハッシュが同じ', () => {
    const files = Object.values(CSV_FILES).map((f) => join(SAMPLE, f));
    const before = files.map(sha);
    const db = openDb(':memory:');
    importCsv(db, SAMPLE);
    db.close();
    expect(files.map(sha)).toEqual(before);
  });

  it('CSV の表に名前・メール・LINE ID の列が無い', () => {
    const db = openDb(':memory:');
    for (const t of ['csv_users', 'csv_stamps', 'csv_rewards']) {
      const cols = (db.prepare('SELECT name FROM pragma_table_info(?)').all(t) as { name: string }[]).map((c) => c.name);
      expect(cols.join(',')).not.toMatch(/name|mail|line|gender|region/i);
    }
    db.close();
  });

  it('フォルダが無いと日本語の分かるエラーで止まる', () => {
    const db = openDb(':memory:');
    expect(() => importCsv(db, join(tmp, 'no-such-dir'))).toThrow(CsvDirError);
    expect(() => importCsv(db, join(tmp, 'no-such-dir'))).toThrow(/SAMPLE_DATA_DIR/);
    db.close();
  });
});