// 次に行く予定（U-10）
import type { Db } from '../db.ts';
import type { SpotId } from '../../../shared/master/spots.ts';

export interface PlanRow { id: number; user_id: string; spot_id: SpotId; created_day: string; status: 'open' | 'done'; done_day: string | null }

export function listOpenPlans(db: Db, userId: string): PlanRow[] {
  return db.prepare("SELECT * FROM plans WHERE user_id = ? AND status = 'open' ORDER BY id").all(userId) as PlanRow[];
}

/** 作れたら true。同じスポットを開いたまま2つは作れない（一意索引） */
export function insertPlan(db: Db, userId: string, spotId: SpotId, day: string): boolean {
  return db.prepare("INSERT OR IGNORE INTO plans (user_id, spot_id, created_day, status) VALUES (?, ?, ?, 'open')")
    .run(userId, spotId, day).changes === 1;
}

export function deleteOpenPlan(db: Db, userId: string, id: number): boolean {
  return db.prepare("DELETE FROM plans WHERE user_id = ? AND id = ? AND status = 'open'").run(userId, id).changes === 1;
}

/** QR で着いたら、そのスポットの開いた予定を「済み」にする */
export function completePlan(db: Db, userId: string, spotId: SpotId, day: string): void {
  db.prepare("UPDATE plans SET status = 'done', done_day = ? WHERE user_id = ? AND spot_id = ? AND status = 'open'")
    .run(day, userId, spotId);
}
