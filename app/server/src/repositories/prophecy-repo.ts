// 予言・タグの重み・似た人の集計（データ設計 §3・§7）
import type { Db } from '../db.ts';
import type { Age, Answer, Companion, Reason, TimeBand } from '../../../shared/schemas.ts';
import type { Season, SpotId, Tag } from '../../../shared/master/spots.ts';

export interface ProphecyRow {
  id: number;
  user_id: string;
  spot_id: SpotId;
  season: Season;
  time_band: TimeBand;
  reasons: string;
  others: string;
  created_day: string;
  status: 'open' | 'visited';
  visited_day: string | null;
  answer: Answer | null;
}

export function visitedSpots(db: Db, userId: string): SpotId[] {
  return (db.prepare('SELECT DISTINCT spot_id FROM stamps WHERE user_id = ? ORDER BY spot_id').all(userId) as { spot_id: SpotId }[])
    .map((r) => r.spot_id);
}

export function stampHours(db: Db, userId: string): number[] {
  return (db.prepare('SELECT hour FROM stamps WHERE user_id = ?').all(userId) as { hour: number }[]).map((r) => r.hour);
}

export function tagWeights(db: Db, userId: string): Partial<Record<Tag, number>> {
  const rows = db.prepare('SELECT tag, weight FROM tag_weights WHERE user_id = ?').all(userId) as { tag: Tag; weight: number }[];
  return Object.fromEntries(rows.map((r) => [r.tag, r.weight]));
}

export function setTagWeight(db: Db, userId: string, tag: Tag, weight: number): void {
  db.prepare('INSERT INTO tag_weights (user_id, tag, weight) VALUES (?, ?, ?) ON CONFLICT (user_id, tag) DO UPDATE SET weight = excluded.weight')
    .run(userId, tag, weight);
}

/**
 * 似た人（CSV の利用者のうち、同じ年齢層・同じ一緒に来た人で、自分が行ったスポットのどれかに行った人）が、
 * 各スポットに行った割合。年齢・一緒に来た人が未選択ならその条件を外す
 */
export function similarShare(db: Db, visited: readonly SpotId[], age: Age | null, companion: Companion | null): Partial<Record<SpotId, number>> {
  if (visited.length === 0) return {};
  const rows = db.prepare(`WITH peers AS (
      SELECT DISTINCT s.user_id FROM csv_stamps s JOIN csv_users u ON u.id = s.user_id
      WHERE s.spot_id IN (SELECT value FROM json_each(?)) AND (? IS NULL OR u.age = ?) AND (? IS NULL OR u.companion = ?))
    SELECT spot_id, count(DISTINCT user_id) AS n, (SELECT count(*) FROM peers) AS total
    FROM csv_stamps WHERE user_id IN (SELECT user_id FROM peers) GROUP BY spot_id`)
    .all(JSON.stringify(visited), age, age, companion, companion) as { spot_id: SpotId; n: number; total: number }[];
  return Object.fromEntries(rows.map((r) => [r.spot_id, r.n / r.total]));
}

export function findOpen(db: Db, userId: string): ProphecyRow | undefined {
  return db.prepare("SELECT * FROM prophecies WHERE user_id = ? AND status = 'open'").get(userId) as ProphecyRow | undefined;
}

/** 答え合わせが済み、まだ答えていない予言（いちばん新しいもの） */
export function findAwaiting(db: Db, userId: string): ProphecyRow | undefined {
  return db.prepare("SELECT * FROM prophecies WHERE user_id = ? AND status = 'visited' AND answer IS NULL ORDER BY id DESC LIMIT 1")
    .get(userId) as ProphecyRow | undefined;
}

export function findProphecy(db: Db, userId: string, id: number): ProphecyRow | undefined {
  return db.prepare('SELECT * FROM prophecies WHERE id = ? AND user_id = ?').get(id, userId) as ProphecyRow | undefined;
}

export function listProphecies(db: Db, userId: string): ProphecyRow[] {
  return db.prepare('SELECT * FROM prophecies WHERE user_id = ? ORDER BY id DESC').all(userId) as ProphecyRow[];
}

export function insertProphecy(
  db: Db, userId: string, p: { spotId: SpotId; season: Season; timeBand: TimeBand; reasons: Reason[]; others: unknown; day: string },
): number {
  const r = db.prepare(
    "INSERT INTO prophecies (user_id, spot_id, season, time_band, reasons, others, created_day, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')",
  ).run(userId, p.spotId, p.season, p.timeBand, JSON.stringify(p.reasons), JSON.stringify(p.others), p.day);
  return Number(r.lastInsertRowid);
}

export function markVisited(db: Db, id: number, day: string): void {
  db.prepare("UPDATE prophecies SET status = 'visited', visited_day = ? WHERE id = ? AND status = 'open'").run(day, id);
}

export function setAnswer(db: Db, id: number, answer: Answer): void {
  db.prepare("UPDATE prophecies SET answer = ? WHERE id = ? AND status = 'visited' AND (answer IS NULL OR answer = 'later')").run(answer, id);
}
