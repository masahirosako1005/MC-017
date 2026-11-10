// ADMIN_MODE=1 かつ DEMO_MODE=1 のときだけ、運営向けの画面に見せる「ダミーの利用者」を入れる（U-09〜U-12）。
// ID は guest-dm??? の形（実在の人ではない）。何度起動しても同じ（INSERT OR IGNORE）。
import type { Db } from '../db.ts';
import type { Ctx } from './context.ts';
import { addDays, toJst } from '../../../shared/dates.ts';
import type { Age, Companion } from '../../../shared/schemas.ts';

const AGES: readonly Age[] = ['20s', '30s', '40s', '50s', '60s', '10s'];
const pad = (n: number, w = 3): string => String(n).padStart(w, '0');

/** 誰と来たかは、ばらつきのあるダミー（家族が多め・ひとりが少なめ）。住所のない端末内の ID だけ */
const COMP_PATTERN: readonly Companion[] = ['family', 'friends', 'couple', 'family', 'solo', 'friends', 'family', 'couple', 'family', 'friends'];
function addUser(db: Db, id: string, age: Age, at: string): void {
  db.prepare('INSERT OR IGNORE INTO users (id, created_at, age) VALUES (?, ?, ?)').run(id, at, age);
  const n = Number(id.replace(/\D/g, '')) || 0;
  db.prepare('UPDATE users SET companion = ? WHERE id = ? AND companion IS NULL').run(COMP_PATTERN[n % COMP_PATTERN.length] ?? 'solo', id);
}

/** 近くのスポットに「行く予定」の人（需要）。7・10 は 8・9・11 の3店すべての半径 2.5km に入る */
function seedPlans(db: Db, today: string): void {
  for (let i = 1; i <= 14; i += 1) {
    const id = `guest-dmp${pad(i)}`;
    addUser(db, id, AGES[i % AGES.length] ?? '30s', `${today}T09:00:00+09:00`);
    db.prepare("INSERT OR IGNORE INTO plans (user_id, spot_id, created_day, status) VALUES (?, ?, ?, 'open')").run(id, i <= 8 ? 's7' : 's10', today);
  }
}

/** 過去の利用（来た・きっかけ・さいころ・券・再訪）。ダッシュボードに数字が出るように */
function seedHistory(db: Db, today: string): void {
  const SHOPS = ['s8', 's9', 's11'] as const;
  const TPL = { s8: 'postcard', s9: 'tempura', s11: 'minikatsu' } as const;
  for (let i = 1; i <= 40; i += 1) {
    const id = `guest-dmx${pad(i)}`;
    const d0 = addDays(today, -(3 + (i % 20)));
    addUser(db, id, AGES[i % AGES.length] ?? '30s', `${d0}T09:00:00+09:00`);
    db.prepare("INSERT OR IGNORE INTO visits (user_id, day, kind) VALUES (?, ?, 'first')").run(id, d0);
    if (i % 5 !== 0) {
      db.prepare("INSERT OR IGNORE INTO grants (user_id, day, source, spot_key, amount, at) VALUES (?, ?, 'qr', 's7', 1, ?)").run(id, d0, `${d0}T11:00:00+09:00`);
      db.prepare('INSERT OR IGNORE INTO stamps (user_id, spot_id, day, hour) VALUES (?, ?, ?, ?)').run(id, 's7', d0, 11);
    }
    if (i % 4 !== 0) {
      db.prepare('INSERT INTO rolls (user_id, board_no, face, from_pos, to_pos, at) SELECT ?, 1, 4, 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM rolls WHERE user_id = ?)')
        .run(id, 4 + (i % 30), `${d0}T11:30:00+09:00`, id);
    }
    const back = addDays(d0, 7 + (i % 3));
    if (i % 2 === 0 && back <= today) {
      db.prepare("INSERT OR IGNORE INTO visits (user_id, day, kind) VALUES (?, ?, 'revisit')").run(id, back);
    }
    if (i % 3 === 0) {
      const used = i % 6 === 0;
      db.prepare(
        `INSERT OR IGNORE INTO coupons (user_id, template_id, season, board_no, square, shop_id, obtained_day, usable_from, expires, used_at)
         VALUES (?, 'season', 'winter', 1, 13, 's10', ?, ?, ?, ?)`,
      ).run(id, d0, addDays(d0, 7), addDays(d0, 60), used ? `${addDays(d0, 8)}T14:00:00+09:00` : null);
    }
    if (i % 4 === 1) {
      const shop = SHOPS[i % 3] ?? 's8';
      const day = addDays(d0, 1);
      db.prepare(
        `INSERT OR IGNORE INTO coupons (user_id, template_id, season, board_no, square, shop_id, obtained_day, usable_from, expires, used_at)
         VALUES (?, ?, NULL, 1, 8, ?, ?, ?, ?, ?)`,
      ).run(id, TPL[shop], shop, d0, d0, addDays(d0, 60), `${day}T${pad(10 + (i % 9), 2)}:10:00+09:00`);
      db.prepare('INSERT OR IGNORE INTO stamps (user_id, spot_id, day, hour) VALUES (?, ?, ?, ?)').run(id, i % 2 === 0 ? 's1' : 's7', day, 12);
    }
  }
}

const VOICES: readonly (readonly [string, string, Age])[] = [
  ['s8', 'ちょうちんがきれいで、家族へのお土産を選ぶのが楽しかったです。', '40s'],
  ['s8', '店員さんが親切でした。また来たいです。連絡は 090-1234-5678 まで。', '30s'],
  ['s9', 'きしめんがもちもちで、大盛りにしてよかった。', '20s'],
  ['s9', '昼どきは並んだけれど、待つ価値あり。', '50s'],
  ['s11', 'ミニみそかつ、ちょうどいい大きさでした。', '60s'],
  ['s11', '席が少なめ。メールは demo@example.com です。', '30s'],
];

function seedVoices(db: Db, today: string): void {
  VOICES.forEach(([shop, text, age], i) => {
    const id = `guest-dmv${pad(i + 1)}`;
    addUser(db, id, age, `${today}T09:00:00+09:00`);
    const exists = db.prepare('SELECT 1 AS x FROM notes WHERE user_id = ? AND spot_id = ?').get(id, shop);
    if (!exists) {
      db.prepare('INSERT INTO notes (user_id, spot_id, day, text, at, shop_visible) VALUES (?, ?, ?, ?, ?, 1)')
        .run(id, shop, addDays(today, -(i % 3)), text, `${today}T10:00:00+09:00`);
    }
  });
}

/** あかり堂（s8）のダッシュボードがきれいに見えるダミー: 来店（QR）・券・使われた時間帯・再訪の日・同じ日に寄ったスポット・終わったキャンペーン */
const HOURS = [9, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 15, 16, 16, 17, 19]; // 昼どきにふくらむ形
const AROUND = ['s7', 's7', 's7', 's1', 's1', 's2', 's2', 's3', 's10'] as const;

function seedShopS8(db: Db, today: string): void {
  const stamp = db.prepare('INSERT OR IGNORE INTO stamps (user_id, spot_id, day, hour) VALUES (?, ?, ?, ?)');
  const insCoupon = db.prepare(
    `INSERT OR IGNORE INTO coupons (user_id, template_id, campaign_id, season, board_no, square, shop_id, obtained_day, usable_from, expires, used_at)
     VALUES (?, ?, ?, NULL, 1, ?, 's8', ?, ?, ?, ?)`,
  );
  for (let i = 1; i <= 40; i += 1) {
    const id = `guest-dms${pad(i)}`;
    const d0 = addDays(today, -(3 + ((i * 7) % 24)));
    addUser(db, id, AGES[i % AGES.length] ?? '30s', `${d0}T09:00:00+09:00`);
    db.prepare("INSERT OR IGNORE INTO visits (user_id, day, kind) VALUES (?, ?, 'first')").run(id, d0);
    stamp.run(id, 's8', d0, 10 + (i % 7));
    db.prepare("INSERT OR IGNORE INTO grants (user_id, day, source, spot_key, amount, at) VALUES (?, ?, 'qr', 's8', 1, ?)").run(id, d0, `${d0}T11:00:00+09:00`);
    if (i % 10 >= 7) continue; // 券をもらったのは 7割
    const hour = HOURS[(i * 3) % HOURS.length] ?? 12;
    let usedAt: string | null = null;
    if (i % 4 !== 0) {
      const back = addDays(d0, 7 + (i % 3));
      const onRevisit = i % 3 === 1 && back <= today;
      const day = onRevisit ? back : i % 3 === 0 ? d0 : addDays(d0, 1);
      if (onRevisit) db.prepare("INSERT OR IGNORE INTO visits (user_id, day, kind) VALUES (?, ?, 'revisit')").run(id, back);
      usedAt = `${day}T${pad(hour, 2)}:10:00+09:00`;
      stamp.run(id, AROUND[(i * 3) % AROUND.length] ?? 's7', day, hour);
      const second = AROUND[(i * 5 + 2) % AROUND.length] ?? 's1';
      if (i % 2 === 0) stamp.run(id, second, day, hour + 1 > 23 ? 23 : hour + 1);
    }
    insCoupon.run(id, 'postcard', null, 8, d0, d0, addDays(d0, 60), usedAt);
  }
  // 終わったキャンペーン（今のキャンペーンの作成を邪魔しない）
  const reqId = '00000000-0000-4000-8000-0000000d0801';
  db.prepare(
    `INSERT OR IGNORE INTO campaigns (request_id, shop_id, kind, item_key, value, starts, ends, status, created_day, reviewed_day)
     VALUES (?, 's8', 'item', 'shiori', NULL, ?, ?, 'approved', ?, ?)`,
  ).run(reqId, addDays(today, -40), addDays(today, -21), addDays(today, -45), addDays(today, -44));
  const c = db.prepare('SELECT id FROM campaigns WHERE request_id = ?').get(reqId) as { id: number } | undefined;
  if (!c) return;
  for (let i = 1; i <= 16; i += 1) {
    const id = `guest-dms${pad(i)}`;
    const got = addDays(today, -(38 - (i % 14)));
    const usable = addDays(got, 1);
    const usedAt = i % 16 < 9 ? `${addDays(usable, i % 4)}T${pad(HOURS[(i * 3) % HOURS.length] ?? 12, 2)}:20:00+09:00` : null;
    insCoupon.run(id, 'campaign', c.id, 20 + (i % 10), got, usable, addDays(today, -21), usedAt);
  }
}

/** LINE で友だちを誘った記録（スポットごとに偏りのあるダミー。request_id は固定で、何度起動しても増えない） */
const INVITE_SPOTS = ['s7', 's7', 's7', 's1', 's1', 's10', 's2', 's8', 's3', 's7'] as const;

function seedInvites(db: Db, today: string): void {
  for (let i = 1; i <= 40; i += 1) {
    if (i % 3 === 0) continue;
    const id = `guest-dmx${pad(i)}`;
    const day = addDays(today, -(i % 12));
    const spot = INVITE_SPOTS[i % INVITE_SPOTS.length] ?? 's7';
    db.prepare('INSERT OR IGNORE INTO invites (user_id, spot_id, day, at, request_id) VALUES (?, ?, ?, ?, ?)')
      .run(id, spot, day, `${day}T12:00:00+09:00`, `00000000-0000-4000-8000-${pad(i, 12)}`);
  }
}

export function seedAdminDemo(ctx: Ctx): void {
  const today = toJst(ctx.clock()).day;
  ctx.db.transaction(() => {
    seedPlans(ctx.db, today);
    seedHistory(ctx.db, today);
    seedShopS8(ctx.db, today);
    seedVoices(ctx.db, today);
    seedInvites(ctx.db, today);
  })();
}
