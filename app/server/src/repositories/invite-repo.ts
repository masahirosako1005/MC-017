// 友だちを LINE で誘った記録（見本。外へは送らない）
import type { Db } from '../db.ts';
import type { SpotId } from '../../../shared/master/spots.ts';

/** 同じ人の同じ requestId は1行だけ（二重送信で増えない） */
export function insertInvite(db: Db, userId: string, spotId: SpotId, day: string, at: string, requestId: string): void {
  db.prepare('INSERT OR IGNORE INTO invites (user_id, spot_id, day, at, request_id) VALUES (?, ?, ?, ?, ?)')
    .run(userId, spotId, day, at, requestId);
}

/** 期間に LINE で誘った人数（スポットごと。同じ人が何回送っても1人） */
export function invitersBySpot(db: Db, from: string, to: string): { spot_id: SpotId; n: number }[] {
  return db.prepare('SELECT spot_id, count(DISTINCT user_id) AS n FROM invites WHERE day BETWEEN ? AND ? GROUP BY spot_id')
    .all(from, to) as { spot_id: SpotId; n: number }[];
}

/** 期間に「次に行く予定」を入れた人数（スポットごと） */
export function plannersBySpot(db: Db, from: string, to: string): { spot_id: SpotId; n: number }[] {
  return db.prepare('SELECT spot_id, count(DISTINCT user_id) AS n FROM plans WHERE created_day BETWEEN ? AND ? GROUP BY spot_id')
    .all(from, to) as { spot_id: SpotId; n: number }[];
}
