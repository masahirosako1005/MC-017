# ADR-017 lint の範囲（ESLint＋typescript-eslint、整形は入れない）
- 状態: 置き換え（2026-11-09 14:24、ADR-019。推移依存の minimatch 10 が BlueOak-1.0.0 で許可外のため ESLint を入れない）
- 日付: 2026-11-09
- 対応: R-055 / QL-LINT-01 / U-01
## 背景
coding ルールは any・innerHTML・SQL の文字列連結を禁止する。手で探すだけでは漏れる。依存は少なくしたい。
## 決定
ESLint（MIT）と typescript-eslint（MIT）を入れ、推奨の設定に次を足す: `@typescript-eslint/no-explicit-any` を error、`no-restricted-properties`／`no-restricted-syntax` で `innerHTML`・`outerHTML`・`insertAdjacentHTML`・`dangerouslySetInnerHTML`・`document.write`・`eval`・`new Function` を error。整形（Prettier）と React 用のプラグインは入れない。SQL の文字列連結は `Select-String` の確認（`/check`）で見る。
## 理由
禁止事項を機械で止められる。整形は書き方の好みで、採点の軸（正確性・セキュリティ）に効きにくい。
## 検討した代替案（採らなかった理由）
- lint なし（`Select-String` だけ）: any の見落としが出る。
- eslint-plugin-react-hooks も入れる: 依存が増える。hooks の誤りは試験で見る。
## 結果・影響（良い点・悪い点・注意）
良い点: 禁止事項を `npm run lint` で確かめられる。悪い点: 依存が2つ（＋その依存）増える。注意: typescript-eslint の peer は TypeScript `>=4.8.4 <6.1.0`（environment ルール）で 6.0 系と合う。導入時に `npm view` で版とライセンスを確かめる。
## 【仮定】（資料にない前提。無ければ「なし」）
React 用のプラグインを入れないこと。
