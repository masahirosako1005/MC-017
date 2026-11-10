-- データ設計 §3 の DDL。起動のたびに実行する（IF NOT EXISTS で冪等）。
-- 個人に見える列（名前・メール・LINE ID・性別・居住地）は持たない（R-057）。

CREATE TABLE IF NOT EXISTS spots (
  id        TEXT PRIMARY KEY CHECK (id IN ('s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11')),
  kind      TEXT NOT NULL CHECK (kind IN ('sight','event','shop')),
  season    TEXT NOT NULL CHECK (season IN ('spring','summer','autumn','winter','all')),
  step_free INTEGER NOT NULL CHECK (step_free IN (0,1)),
  lat       REAL NOT NULL CHECK (lat BETWEEN 34.9 AND 35.4),
  lng       REAL NOT NULL CHECK (lng BETWEEN 136.7 AND 137.1)
) STRICT;

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY CHECK (id GLOB 'guest-[a-z0-9][a-z0-9][a-z0-9][a-z0-9][a-z0-9][a-z0-9]' AND length(id) = 12),
  created_at       TEXT NOT NULL,
  age              TEXT CHECK (age IS NULL OR age IN ('10s','20s','30s','40s','50s','60s')),
  companion        TEXT CHECK (companion IS NULL OR companion IN ('solo','family','couple','friends')),
  step_less        INTEGER NOT NULL DEFAULT 0 CHECK (step_less IN (0,1)),
  avatar           TEXT NOT NULL DEFAULT 'tomonyan' CHECK (avatar IN ('tomonyan','hoshirou','pikkon','toujii')),
  board_no         INTEGER NOT NULL DEFAULT 1 CHECK (board_no >= 1),
  pos              INTEGER NOT NULL DEFAULT 0 CHECK (pos BETWEEN 0 AND 44),
  demo_offset_days INTEGER NOT NULL DEFAULT 0 CHECK (demo_offset_days BETWEEN 0 AND 3650),
  demo_hour        INTEGER CHECK (demo_hour IS NULL OR demo_hour BETWEEN 0 AND 23),
  demo_spot        TEXT REFERENCES spots(id)
) STRICT;

CREATE TABLE IF NOT EXISTS visits (
  user_id TEXT NOT NULL REFERENCES users(id),
  day     TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  kind    TEXT NOT NULL CHECK (kind IN ('first','day2','revisit')),
  PRIMARY KEY (user_id, day)
) STRICT;

CREATE TABLE IF NOT EXISTS grants (
  id       INTEGER PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id),
  day      TEXT NOT NULL,
  source   TEXT NOT NULL CHECK (source IN ('day2','revisit','qr','note','invite','prophecy','demo','again')),
  spot_key TEXT NOT NULL,
  amount   INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 10),
  at       TEXT NOT NULL,
  UNIQUE (user_id, day, source, spot_key)
) STRICT;

CREATE TABLE IF NOT EXISTS rolls (
  id       INTEGER PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id),
  board_no INTEGER NOT NULL CHECK (board_no >= 1),
  face     INTEGER NOT NULL CHECK (face BETWEEN 1 AND 6),
  from_pos INTEGER NOT NULL CHECK (from_pos BETWEEN 0 AND 44),
  to_pos   INTEGER NOT NULL CHECK (to_pos BETWEEN 0 AND 44),
  at       TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS stamps (
  user_id TEXT NOT NULL REFERENCES users(id),
  spot_id TEXT NOT NULL REFERENCES spots(id),
  day     TEXT NOT NULL,
  hour    INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  PRIMARY KEY (user_id, spot_id, day)
) STRICT;

CREATE TABLE IF NOT EXISTS notes (
  id      INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  spot_id TEXT NOT NULL REFERENCES spots(id),
  day     TEXT NOT NULL,
  text    TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 100),
  at      TEXT NOT NULL,
  -- 1: 店の人に、名前を出さずに見せてよい（U-12 e）。この列が入る前の行は 0
  shop_visible INTEGER NOT NULL DEFAULT 0 CHECK (shop_visible IN (0,1))
) STRICT;

-- 次に行く予定（U-10）。1人が同じスポットを開いたまま2つ持たない。上限3つは service で守る
CREATE TABLE IF NOT EXISTS plans (
  id          INTEGER PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  spot_id     TEXT NOT NULL REFERENCES spots(id),
  created_day TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('open','done')),
  done_day    TEXT
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS plans_one_open ON plans(user_id, spot_id) WHERE status = 'open';

-- 友だちを LINE で誘った記録（見本。外へは送らない）。誘う画面で送るたびに1行。運営のダッシュボードで「次回再訪の予定」としてスポット別に数える
CREATE TABLE IF NOT EXISTS invites (
  id         INTEGER PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  spot_id    TEXT NOT NULL REFERENCES spots(id),
  day        TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  at         TEXT NOT NULL,
  request_id TEXT NOT NULL CHECK (length(request_id) = 36),
  UNIQUE (user_id, request_id)
) STRICT;
CREATE INDEX IF NOT EXISTS invites_by_spot_day ON invites(spot_id, day);
-- 店のキャンペーン（U-11）。shop_id は自分の店だけ（8・9・11）。表示名は種類と値からサーバーが作る
CREATE TABLE IF NOT EXISTS campaigns (
  id            INTEGER PRIMARY KEY,
  request_id    TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  shop_id       TEXT NOT NULL REFERENCES spots(id) CHECK (shop_id IN ('s8','s9','s11')),
  kind          TEXT NOT NULL CHECK (kind IN ('item','yen','percent')),
  item_key      TEXT,
  value         INTEGER,
  starts        TEXT NOT NULL,
  ends          TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  created_day   TEXT NOT NULL,
  reviewed_day  TEXT,
  reject_reason TEXT CHECK (reject_reason IS NULL OR reject_reason IN ('unclear','dates','other')),
  CHECK ((kind = 'item' AND item_key IS NOT NULL AND value IS NULL) OR (kind <> 'item' AND item_key IS NULL AND value IS NOT NULL)),
  CHECK (ends >= starts)
) STRICT;

-- 盤の上の 🏪 マス。1人・1枚の盤・1キャンペーンにつき1つ、同じマスに2つは置かない
CREATE TABLE IF NOT EXISTS board_extras (
  user_id     TEXT NOT NULL REFERENCES users(id),
  board_no    INTEGER NOT NULL CHECK (board_no >= 1),
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  square      INTEGER NOT NULL CHECK (square BETWEEN 1 AND 43),
  PRIMARY KEY (user_id, board_no, campaign_id),
  UNIQUE (user_id, board_no, square)
) STRICT;

-- お客さまの声を、その店が確認した印（店ごと）
CREATE TABLE IF NOT EXISTS note_reads (
  note_id INTEGER NOT NULL REFERENCES notes(id),
  shop_id TEXT NOT NULL REFERENCES spots(id),
  PRIMARY KEY (note_id, shop_id)
) STRICT;

CREATE TABLE IF NOT EXISTS coupons (
  id           INTEGER PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  template_id  TEXT NOT NULL CHECK (template_id IN ('souv10','lantern','postcard','kishimen','tempura','minikatsu','season','goal','campaign')),
  campaign_id  INTEGER REFERENCES campaigns(id),
  season       TEXT CHECK (season IS NULL OR season IN ('spring','summer','autumn','winter')),
  board_no     INTEGER NOT NULL CHECK (board_no >= 1),
  square       INTEGER NOT NULL CHECK (square BETWEEN 1 AND 44),
  shop_id      TEXT NOT NULL REFERENCES spots(id),
  obtained_day TEXT NOT NULL,
  usable_from  TEXT NOT NULL,
  expires      TEXT NOT NULL,
  used_at      TEXT,
  seen         INTEGER NOT NULL DEFAULT 0 CHECK (seen IN (0,1)),
  UNIQUE (user_id, board_no, square),
  CHECK (usable_from >= obtained_day AND expires >= usable_from)
) STRICT;

CREATE TABLE IF NOT EXISTS prophecies (
  id          INTEGER PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  spot_id     TEXT NOT NULL REFERENCES spots(id),
  season      TEXT NOT NULL CHECK (season IN ('spring','summer','autumn','winter')),
  time_band   TEXT NOT NULL CHECK (time_band IN ('morning','noon','evening','night')),
  reasons     TEXT NOT NULL CHECK (json_valid(reasons)),
  others      TEXT NOT NULL CHECK (json_valid(others)),
  created_day TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('open','visited')),
  visited_day TEXT,
  answer      TEXT CHECK (answer IS NULL OR answer IN ('liked','normal','later'))
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS prophecies_one_open ON prophecies(user_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS tag_weights (
  user_id TEXT NOT NULL REFERENCES users(id),
  tag     TEXT NOT NULL CHECK (tag IN ('history','view','nature','kids','indoor','food','festival','night','shopping')),
  weight  REAL NOT NULL CHECK (weight BETWEEN -2 AND 3),
  PRIMARY KEY (user_id, tag)
) STRICT;

CREATE TABLE IF NOT EXISTS requests (
  user_id    TEXT NOT NULL REFERENCES users(id),
  request_id TEXT NOT NULL CHECK (length(request_id) = 36),
  kind       TEXT NOT NULL,
  response   TEXT NOT NULL CHECK (json_valid(response)),
  at         TEXT NOT NULL,
  PRIMARY KEY (user_id, request_id)
) STRICT;

CREATE TABLE IF NOT EXISTS csv_users (
  id            INTEGER PRIMARY KEY CHECK (id BETWEEN 1000000 AND 9999999),
  age           TEXT NOT NULL CHECK (age IN ('10s','20s','30s','40s','50s','60s')),
  companion     TEXT NOT NULL CHECK (companion IN ('solo','family','couple','friends')),
  registered_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS csv_stamps (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES csv_users(id),
  round   INTEGER NOT NULL CHECK (round BETWEEN 1 AND 9),
  spot_id TEXT NOT NULL REFERENCES spots(id),
  at      TEXT NOT NULL,
  day     TEXT NOT NULL,
  hour    INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  UNIQUE (user_id, round, spot_id)
) STRICT;

CREATE TABLE IF NOT EXISTS csv_rewards (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES csv_users(id),
  reward  TEXT NOT NULL CHECK (length(reward) BETWEEN 1 AND 40),
  at      TEXT NOT NULL,
  UNIQUE (user_id, reward)
) STRICT;

CREATE TABLE IF NOT EXISTS import_log (
  id       INTEGER PRIMARY KEY,
  file     TEXT NOT NULL,
  rows     INTEGER NOT NULL,
  imported INTEGER NOT NULL,
  skipped  INTEGER NOT NULL,
  reasons  TEXT NOT NULL CHECK (json_valid(reasons)),
  at       TEXT NOT NULL
) STRICT;
