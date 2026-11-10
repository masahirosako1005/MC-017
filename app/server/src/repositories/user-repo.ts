import type { Db } from '../db.ts';
import type { Age, Companion } from '../../../shared/schemas.ts';
import type { AvatarId } from '../../../shared/master/avatars.ts';
import type { SpotId } from '../../../shared/master/spots.ts';

export interface UserRow {
  id: string;
  created_at: string;
  age: Age | null;
  companion: Companion | null;
  step_less: 0 | 1;
  avatar: AvatarId;
  board_no: number;
  pos: number;
  demo_offset_days: number;
  demo_hour: number | null;
  demo_spot: SpotId | null;
}

export function findUser(db: Db, id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function insertUser(db: Db, id: string, createdAt: string): void {
  db.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)').run(id, createdAt);
}

export function updateProfile(
  db: Db,
  id: string,
  p: { age: Age | null; companion: Companion | null; stepLess: boolean; avatar: AvatarId },
): void {
  db.prepare('UPDATE users SET age = ?, companion = ?, step_less = ?, avatar = ? WHERE id = ?')
    .run(p.age, p.companion, p.stepLess ? 1 : 0, p.avatar, id);
}

export function updateBoard(db: Db, id: string, boardNo: number, pos: number): void {
  db.prepare('UPDATE users SET board_no = ?, pos = ? WHERE id = ?').run(boardNo, pos, id);
}

export function updateDemoClock(db: Db, id: string, offsetDays: number, hour: number | null): void {
  db.prepare('UPDATE users SET demo_offset_days = ?, demo_hour = ? WHERE id = ?').run(offsetDays, hour, id);
}

/** デモの「もとに戻す」: 盤1の最初に戻し、年齢・一緒に来た人・段差・デモの日時と場所を空にする（アバターは残す） */
export function resetToStart(db: Db, id: string): void {
  db.prepare(
    `UPDATE users SET board_no = 1, pos = 0, age = NULL, companion = NULL, step_less = 0,
       demo_offset_days = 0, demo_hour = NULL, demo_spot = NULL WHERE id = ?`,
  ).run(id);
}

export function updateDemoSpot(db: Db, id: string, spotId: SpotId | null): void {
  db.prepare('UPDATE users SET demo_spot = ? WHERE id = ?').run(spotId, id);
}
