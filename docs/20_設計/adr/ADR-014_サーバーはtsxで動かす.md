# ADR-014 サーバーは tsx で TypeScript のまま動かす
- 状態: 採用
- 日付: 2026-11-09
- 対応: R-006 / U-01
## 背景
サーバーは TypeScript。tsc で JS に出して動かすと、出力先・`app/shared` の参照・ESM の拡張子の扱いを設定する必要がある。製造は 3.5 時間。
## 決定
サーバーの起動（`npm start`・`npm run dev:server`・E2E の webServer・`npm run import:csv`）は `tsx` で `.ts` をそのまま動かす。型の確認は `tsc --noEmit`（`npm run typecheck`）で別に行う。クライアントは Vite でビルドし、Express が `app/client/dist` を配る。
## 理由
設定が少なく、client と server が同じ `app/shared` を読める。型の確認を分けても、strict の検査は失われない。
## 検討した代替案（採らなかった理由）
- `tsc` で出して `node` で動かす: パスと ESM の設定が増える。
- Node の型の取り除き（`--experimental-strip-types`）: Node の版によって動きが違い、enum 等で止まる。
## 結果・影響（良い点・悪い点・注意）
良い点: すぐ動く。悪い点: 実行時に変換するため起動が少し遅い。依存（tsx、MIT）が1つ増える。注意: `tsx` は esbuild を含む。`ignore-scripts=true` で esbuild の install スクリプトが動かなくても、プラットフォームのパッケージが入っていれば動くことを導入時に確かめる。
## 【仮定】（資料にない前提。無ければ「なし」）
tsx の採用そのもの（外部リソース.md に記録してから入れる）。
