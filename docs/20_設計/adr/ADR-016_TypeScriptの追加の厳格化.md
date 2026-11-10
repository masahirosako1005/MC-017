# ADR-016 TypeScript の追加の厳格化
- 状態: 採用
- 日付: 2026-11-09
- 対応: R-055 / QL-TS-02 / U-01
## 背景
security-quality ルール: 全 tsconfig に `strict: true`。追加の厳格化（`noUncheckedIndexedAccess`・`noImplicitOverride`・`noImplicitReturns`・`noFallthroughCasesInSwitch`・`noUnusedLocals`・`noUnusedParameters`）の採否は ADR に書く【仮定】。
## 決定
6つとも採用する。あわせて `exactOptionalPropertyTypes` は採らない。tsconfig は `tsconfig.base.json`（共通の strict と上の6つ）を、client・server・tests の各 tsconfig が `extends` する。
## 理由
配列・表の添字（盤のマス、話者の表、CSV の列）で undefined を取りこぼしやすく、`noUncheckedIndexedAccess` が効く。使わない変数を残さない（保守性）。
## 検討した代替案（採らなかった理由）
- `exactOptionalPropertyTypes` も入れる: React の props や zod の推論型と合わせる手間が大きく、3.5 時間に収まらない。
- strict だけ: 添字の取りこぼしを型で防げない。
## 結果・影響（良い点・悪い点・注意）
良い点: 型の誤りを早く見つける。悪い点: 添字のたびに確かめが要る。注意: 確かめを省くために `!` を多用しない（使う所は理由を書く）。
## 【仮定】（資料にない前提。無ければ「なし」）
`exactOptionalPropertyTypes` を採らないこと。
