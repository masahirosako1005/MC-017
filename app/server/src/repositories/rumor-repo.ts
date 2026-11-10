// うわさの集計（データ設計 §5、R-027）。CSV 由来の表だけを読み、スポットごとの人数だけを返す。SQL はプレースホルダだけ。
import type { Db } from '../db.ts';
import type { Age, Companion } from '../../../shared/schemas.ts';
import type { SpotId } from '../../../shared/master/spots.ts';

export interface RankRow { spot_id: SpotId; n: number }

/** CSV にある日（昇順） */
export function csvDays(db: Db): string[] {
  return (db.prepare('SELECT DISTINCT day FROM csv_stamps ORDER BY day').all() as { day: string }[]).map((r) => r.day);
}

/** その日にスタンプを押した人数の多い順（day が null なら全日） */
export function topByDay(db: Db, day: string | null, limit: number): RankRow[] {
  return db.prepare(`SELECT spot_id, count(DISTINCT user_id) AS n FROM csv_stamps
    WHERE (? IS NULL OR day = ?) GROUP BY spot_id ORDER BY n DESC, spot_id LIMIT ?`).all(day, day, limit) as RankRow[];
}

export function topByAge(db: Db, age: Age, limit: number): RankRow[] {
  return db.prepare(`SELECT s.spot_id, count(DISTINCT s.user_id) AS n FROM csv_stamps s JOIN csv_users u ON u.id = s.user_id
    WHERE u.age = ? GROUP BY s.spot_id ORDER BY n DESC, s.spot_id LIMIT ?`).all(age, limit) as RankRow[];
}

export function topByCompanion(db: Db, companion: Companion, limit: number): RankRow[] {
  return db.prepare(`SELECT s.spot_id, count(DISTINCT s.user_id) AS n FROM csv_stamps s JOIN csv_users u ON u.id = s.user_id
    WHERE u.companion = ? GROUP BY s.spot_id ORDER BY n DESC, s.spot_id LIMIT ?`).all(companion, limit) as RankRow[];
}

/** スポットの時間ごとのスタンプ数（from〜to 時） */
export function hourCounts(db: Db, spotId: SpotId, from: number, to: number): { hour: number; n: number }[] {
  return db.prepare(`SELECT hour, count(*) AS n FROM csv_stamps WHERE spot_id = ? AND hour BETWEEN ? AND ?
    GROUP BY hour ORDER BY hour`).all(spotId, from, to) as { hour: number; n: number }[];
}
