# API 設計

作成: 2026-11-09 14:10（ファイルの更新時刻。当初の 14:31 は推測の誤りで訂正） / 到達点: M3（2.6・2.8 契約） / 上流: `要件定義.md`、`データ設計.md`。スキーマの正は `app/shared/schemas.ts`（zod 4、クライアントとサーバーで共有。QL-ZOD-03）。

## 1. 共通
| 項目 | 決まり |
|------|--------|
| 置き場 | `http://127.0.0.1:3000/api/*`（同じオリジン。CORS は開かない） |
| 利用者 | ヘッダ `X-Guest-Id: guest-[a-z0-9]{6}`（ADR-005）。`/api/health`・`/api/config`・`/api/avatars`・`/api/tts*` 以外で必須。形式外は 400 |
| 入力 | `params`・`query`・`body` を zod の `z.strictObject` で検証（未知キーは 400。ADR-004）。文字列は長さ、数値は範囲、列挙は許可リスト |
| Content-Type | POST・PUT・PATCH は `application/json` だけ（ほかは 415）。本文は 16KB まで（超えると 413） |
| Origin | `Origin` があり、自分（`http://127.0.0.1:PORT`・`http://localhost:PORT`）以外なら状態を変える要求は 403（ADR-005） |
| 二重送信 | 状態を変える POST は `requestId`（UUID）を必須にし、2回目は1回目と同じ応答を返す（ADR-006） |
| 応答 | `application/json; charset=utf-8`、`Cache-Control: no-store`（`/api/tts` の WAV も no-store） |
| エラー | `{ "error": { "code": "bad_request", "message": "入力を確かめてください" } }`（ADR-013）。スタック・パス・SQL・版は出さない |
| 日時 | 日付 `YYYY-MM-DD`、日時 ISO 8601 `+09:00`。「今日」はアプリ内の今日（ADR-008） |

### エラーのコード
| HTTP | code | いつ |
|------|------|------|
| 400 | `bad_request` | 検証の失敗（未知キー・型・範囲・形式外の ID） |
| 403 | `forbidden_origin` | 別オリジンからの状態変更 |
| 404 | `not_found` | 無い URL・無いスポット・他人のクーポン・DEMO_MODE なしのデモ API |
| 409 | `conflict` | 回数が0で振った・使えないクーポン・答え済みの予言 |
| 413 | `too_large` | 本文が 16KB 超 |
| 415 | `unsupported_media_type` | JSON 以外の Content-Type |
| 500 | `internal` | 想定外（詳細はサーバーのログだけ） |
| 503 | `tts_unavailable` | VOICEVOX が止まっている |

## 2. 一覧
| # | メソッドと パス | 入力 | 出力 | 要件 | 画面 |
|---|----------------|------|------|------|------|
| 1 | GET `/api/health` | — | `{ ok: true }` | R-050 | — |
| 2 | GET `/api/config` | — | `{ demoMode: boolean }` | R-043 | 全画面 |
| 3 | GET `/api/avatars` | — | `[{ id, available }]` | R-006 | SC-02 |
| 4 | POST `/api/session` | body `{}` | `MeState`（その日の最初なら訪問を記録し、ボーナスを付与） | R-001, R-005 | SC-01 |
| 5 | GET `/api/me` | — | `MeState` | R-003, R-021 | SC-01, SC-05 |
| 6 | PATCH `/api/me/profile` | `{ age?, companion?, stepLess?, avatar? }`（1つ以上） | `MeState` | R-002, R-006 | SC-01, SC-02 |
| 7 | POST `/api/spots/:spotId/qr` | `{ requestId }` | `TriggerResult`＋`prophecyCheck` | R-013, R-031 | SC-10 |
| 8 | POST `/api/spots/:spotId/notes` | `{ requestId, text }`（1〜100字、前後の空白を除いて1字以上） | `TriggerResult` | R-014 | SC-11 |
| 9 | POST `/api/spots/:spotId/invites` | `{ requestId }` | `TriggerResult` | R-015 | SC-08 |
| 10 | POST `/api/rolls` | `{ requestId }` | `RollResult` | R-017〜R-020 | SC-05 |
| 11 | GET `/api/coupons` | — | `{ stamps: number, coupons: Coupon[] }` | R-024, R-026 | SC-07 |
| 12 | POST `/api/coupons/:couponId/use` | `{ requestId }` | `Coupon` | R-025 | SC-07 |
| 13 | GET `/api/rumors` | query `{ spot?: SpotId }`（1つだけ。配列は 400） | `Rumors` | R-027 | SC-06 |
| 14 | GET `/api/prophecy` | — | `ProphecyState`（条件を満たせばここで作る） | R-030, R-033 | SC-09 |
| 15 | POST `/api/prophecy/:prophecyId/answer` | `{ requestId, answer: 'liked'｜'normal'｜'later' }` | `ProphecyState` | R-032, R-033 | SC-09 |
| 16 | GET `/api/tts/status` | — | `{ available: boolean }` | R-037, R-040 | SC-12 |
| 17 | POST `/api/tts` | `{ avatarId, text }`（1〜100字） | `audio/wav`（200）／503 | R-040, R-041 | 声が出る画面 |
| 18 | PUT `/api/demo/clock` | `{ offsetDays: 0〜3650, hour: 0〜23 ｜ null }` | `MeState` | R-044 | SC-12（DEMO_MODE のみ） |
| 19 | PUT `/api/demo/location` | `{ spotId: SpotId ｜ null }` | `MeState` | R-045 | SC-12（DEMO_MODE のみ） |
| 20 | POST `/api/demo/rolls` | `{ requestId, amount: 1〜10 }` | `MeState` | R-046 | SC-12（DEMO_MODE のみ） |
| 20b | POST `/api/demo/reset` | `{}` | `MeState`（盤1・位置0・年齢と一緒に来た人を空に、デモの日時と場所を初期化） | R-044 | SC-12 もとに戻す（DEMO_MODE のみ） |
- 18〜20 は **DEMO_MODE=1 のときだけ登録**する。無いときは、ふつうの 404（`not_found`）と同じ応答（R-043、AC-051）。

## 3. 型（`app/shared/schemas.ts`）
```ts
type SpotId = 's1'|'s2'|'s3'|'s4'|'s5'|'s6'|'s7'|'s8'|'s9'|'s10'|'s11';
type AvatarId = 'tomonyan'|'hoshirou'|'pikkon'|'toujii';
type Age = '10s'|'20s'|'30s'|'40s'|'50s'|'60s';
type Companion = 'solo'|'family'|'couple'|'friends';
type Trigger = 'qr'|'note'|'invite';

type MeState = {
  id: string; today: string; hour: number;            // アプリ内の今日と時刻
  visitKind: 'first'|'day2'|'revisit';
  bonus: { source: 'day2'|'revisit'; amount: number } | null;  // 今日の訪問ボーナス
  profile: { age: Age|null; companion: Companion|null; stepLess: boolean; avatar: AvatarId };
  board: { no: number; pos: number; size: number }; // size は盤のマス数（45。app/shared/board.ts の BOARD_SIZE）
  rollsLeft: number; stamps: number;
  doneToday: Record<SpotId, Trigger[]>;                // 今日済んだきっかけ
  demo: { offsetDays: number; hour: number|null; location: SpotId|null } | null; // DEMO_MODE のときだけ
};
type TriggerResult = { granted: boolean; rollsLeft: number; prophecyCheck: { prophecyId: number } | null };
type RollResult = {
  face: 1|2|3|4|5|6; boardNo: number; from: number; to: number; rollsLeft: number;
  landed: { kind: 'gift'; coupon: Coupon } | { kind: 'spot'; spotId: SpotId } | { kind: 'season'; spotId: SpotId }
        | { kind: 'normal' } | { kind: 'goal'; coupon: Coupon; nextBoard: number };
  near: { kind: 'gift'|'goal'; steps: number } | null; // 3マス以内（ゴール優先）
};
type Coupon = { id: number; templateId: string; shopId: SpotId; season: Season|null;
  obtainedDay: string; usableFrom: string; expires: string;
  status: 'usable'|'later'|'used'|'expired'; isNew: boolean };
type Rumors = { yesterday: Rank[]; month: Rank[]; sameAge: Rank[]|null; sameCompanion: Rank[]|null;
  quiet: { spotId: SpotId; hours: { hour: number; count: number; quiet: boolean }[] } };
type Rank = { spotId: SpotId; people: number };
type ProphecyState = {
  current: Prophecy | null;          // open か、答えを待つ visited
  canProphesy: boolean;              // QR が1回以上
  level: 1|2|3|4|5; checks: number; liked: number; normal: number;
  history: { id: number; spotId: SpotId; season: Season; answer: 'liked'|'normal'|'later'|null; status: 'open'|'visited' }[];
  others: { spotId: SpotId; reason: Reason }[];  // 2位・3位
};
type Prophecy = { id: number; spotId: SpotId; season: Season; timeBand: 'morning'|'noon'|'evening'|'night';
  reasons: Reason[]; status: 'open'|'visited'; answer: 'liked'|'normal'|'later'|null; createdDay: string };
type Reason = { code: 'tag'|'similar'|'season'|'stepfree'; tag?: string; strength: 'strong'|'mid'|'weak' };
```
- 理由の文は画面の辞書で組み立てる（`code` と `tag` から。英語も同じ）。サーバーは文を返さない。
- `MeState.demo` は DEMO_MODE のときだけ値が入る。無いときは `null`（AC-052）。

## 4. `/api/tts` の中身（R-040、ADR-011）
1. body を zod で検証（`avatarId` は4つ、`text` は1〜100字、未知キーは 400）。
2. 話者 ID をサーバーの表から引く（ともにゃん 8・ほしろう 70・ぴっこん 54・とうじい 42）。
3. `POST http://127.0.0.1:{VOICEVOX_PORT}/audio_query?text=…&speaker=…` → 返った JSON の `speedScale` をアバターごとに直す（ともにゃん 1.1、ほかは 1.0）→ `POST /synthesis?speaker=…` に JSON で渡す。宛先のホストは固定、ポートは環境変数だけで変えられる（入力では変えられない）。
4. 各呼び出しは 10秒で打ち切る。失敗・打ち切り・接続できないときは 503 `tts_unavailable`。エンジンの応答の中身はクライアントへ出さない。
5. 返った WAV をそのまま返す（`Content-Type: audio/wav`、`Cache-Control: no-store`）。ファイル・DB に保存しない。
- `GET /api/tts/status` は最後の温め・呼び出しの結果（成功したか）を返す。

## 5. 画面からの呼び方（要点）
- アプリを開いた時と、デモで日時を変えた後に `POST /api/session`（その日の訪問とボーナスはここで決まる）。
- 操作（QR・ひとこと・誘う・振る・使う・答える）は、押した時に `crypto.randomUUID()` で `requestId` を作り、応答が来るまでボタンを押せなくする（R-053）。
- 失敗したら画面に「つながりませんでした。もう一度ためしてください」と「もう一度」ボタン（R-055）。

## 3. 運営向けと次に行く予定（2026-11-10 追加。U-09〜U-12、ADR-024・ADR-025）
`ADMIN_MODE=1`（既定。`0` にすると登録されず 404）のとき `/api/admin/*` が登録される。役割はヘッダ `X-Operator`（`association`・`shop-s8`・`shop-s9`・`shop-s11`。無い・不正は 400）。URL の `:shopId` が自分の店でなければ 404。応答に利用者 ID を含めない。5人未満は `{ value: null, hidden: true }`。型は `app/shared/admin.ts`。

| メソッドとパス | 役割 | 本文・問い合わせ | 応答 |
|----------------|------|------------------|------|
| GET `/api/plans` | 利用者 | — | `{ plans: [{ id, spotId, createdDay }], max: 3 }` |
| POST `/api/plans` | 利用者 | `{ requestId, spotId }`（店は 404、4つ目は 409、同じスポットは変えずに 200） | 同上 |
| POST `/api/plans/:planId/cancel` | 利用者 | `{}`（他人の予定は何もしない） | 同上 |
| GET `/api/admin/summary?days=7｜28｜90｜all` | 観光協会 | — | `AdminSummary`（K-01・K-02・K-03・K-07 の `now`・`prev`、`funnel` 5段、`insight`） |
| GET `/api/admin/shops/:shopId/summary?days=` | 観光協会か自店 | — | `ShopSummary`（券・QR・`hourly` 6区分・`sameDay`・`campaigns`・`unreadVoices`） |
| GET `/api/admin/shops/:shopId/demand` | 自店 | — | `DemandView`（スポット別の人数・合計・`totalAtLeast`・`canCreate`・`remaining`・`blocking`） |
| GET・POST `/api/admin/shops/:shopId/campaigns` | 自店 | POST: `{ requestId, kind, itemKey, value, starts, ends }`（店の項目は持たない。`z.strictObject`） | `CampaignView[]`・`CampaignView` |
| GET `/api/admin/campaigns?status=` | 観光協会 | — | `CampaignView[]` |
| POST `/api/admin/campaigns/:id/approve` | 観光協会 | `{}` | `CampaignView`（承認済みへの承認は同じ結果、却下済みは 409） |
| POST `/api/admin/campaigns/:id/reject` | 観光協会 | `{ reason: 'unclear'｜'dates'｜'other' }` | `CampaignView`（承認済みは 409） |
| GET `/api/admin/shops/:shopId/voices?show=all｜unread｜read` | 自店 | — | `VoicesView`（`items` は新しい順で最大50件・`counts`） |
| POST `/api/admin/shops/:shopId/voices/:noteId/confirm` | 自店 | `{}`（他店・知らない声・`shop_visible=0` は 404） | `VoicesView` |

- 利用者アプリの `MeState.board.extras`（`{ square, campaignId, shopId, label }[]`）・`Coupon.label`（キャンペーンの券の名前。ほかは null）・`Landed` の `{ kind: 'shop', coupon }` を足した。
- 状態を変える POST のうち、運営向けの作成は `requestId`（`campaigns.request_id` の一意）で二重送信を防ぐ。承認・却下・確認した は、同じ要求を繰り返しても結果が変わらない（冪等）。
- `DELETE` は使わない（本文なしの `DELETE` は JSON の検査で 415 になるため、取り消しは `POST …/cancel`）。
