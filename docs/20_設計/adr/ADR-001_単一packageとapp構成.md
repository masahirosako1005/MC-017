# ADR-001 単一 package と app/ 構成
- 状態: 採用
- 日付: 2026-11-09
- 対応: R-006 / R-007 / U-01
## 背景
coding ルールの構成【仮定】は `src/client`・`src/server`・`src/shared` だった。2026-11-09 14:00 のユーザー指示で、アバターの絵の取込先が `app/client/public/avatars/` と指定された。
## 決定
単一の `package.json` のまま、コードは `app/client`（Vite のルート）・`app/server/src`・`app/shared` に置く。`db/`・`scripts/`・`tests/` はリポジトリ直下。coding ルールの「構成」を同じ内容に直す。
## 理由
ユーザーの指定したパスとそろえ、クライアントの静的ファイル（`public/`）を Vite の既定の場所に置ける。package を分けると共通ファイル（package.json）が増え、ignore-scripts の確認も増える。
## 検討した代替案（採らなかった理由）
- `src/` のまま `app/client/public/avatars` だけ別に置く: Vite の `publicDir` を別にする設定が要り、ユーザーの意図（client の public）とずれる。
- npm workspaces で client/server を分ける: 10時間の範囲では管理が重い。
## 結果・影響（良い点・悪い点・注意）
良い点: パスが指示どおり。悪い点: coding ルールの【仮定】の構成と変わるので、ルールを直し audit に書く。注意: tsconfig は client（DOM）と server（Node）で分け、shared は両方から読む。
## 【仮定】（資料にない前提。無ければ「なし」）
`app/` の下の分け方（client・server・shared）は【仮定】。
