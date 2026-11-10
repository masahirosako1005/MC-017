# ADR-003 自前のヘッダと CSP（Helmet なし・HSTS なし・media-src blob:）
- 状態: 採用
- 日付: 2026-11-09
- 対応: R-050 / R-051 / U-01
## 背景
ユーザー指定で HSTS を送らない。Helmet は既定で HSTS を付ける。VOICEVOX の WAV を Blob の URL で鳴らすため、CSP に `media-src blob:` が要る（方向性 §17.3）が、security-quality ルールとチェックリストの CSP にはまだ無い。
## 決定
`app/server/src/http/headers.ts` の自前ミドルウェアで、全応答の最初にヘッダ一式（非機能・セキュリティ設計 §1）を付ける。CSP は従来の方針に `media-src blob:` だけ足す。nonce/hash の Strict CSP は採らず、許可リスト方式にする。security-quality.mdc・competition.mdc・チェックリスト SEC-CSP-02 の CSP に `media-src blob:` を足す。
## 理由
依存を増やさずにヘッダを全部決められる。自前のスクリプトだけでインラインのスクリプトが無いので、許可リスト方式で足りる（SEC-CSP-07）。`media-src` を書かないと `default-src 'self'` で Blob の音声が止まる。
## 検討した代替案（採らなかった理由）
- Helmet＋`strictTransportSecurity: false`: 依存が増え、既定値の確認が要る。
- WAV を data: URL で鳴らす: 大きい音声で文字列が長く、`media-src data:` を足すことになり変わらない。
- `<audio src="/api/tts?...">`（GET）: 文を URL に入れるとログや履歴に残り、POST の検証もできない。
## 結果・影響（良い点・悪い点・注意）
良い点: ヘッダを全部把握できる。悪い点: 自前の試験が要る（AC-057）。注意: Leaflet・React は CSSOM で style を付けるので `style-src 'self'` で動く見込み。違反は E2E で数える（AC-058）。
## 【仮定】（資料にない前提。無ければ「なし」）
Permissions-Policy の無効にする機能の並び（設計 §1）と、静的の `Cache-Control: no-cache`。
