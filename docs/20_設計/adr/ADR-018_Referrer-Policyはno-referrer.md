# ADR-018 Referrer-Policy は no-referrer
- 状態: 採用
- 日付: 2026-11-09
- 対応: R-050 / R-009 / U-01
## 背景
security-quality ルールは `Referrer-Policy: no-referrer`【仮定】。地図のタイル（地理院）と出典のリンク（地理院のページ）は外部への要求で、既定（`strict-origin-when-cross-origin`）なら `http://127.0.0.1:3000` が送られる。
## 決定
全応答に `Referrer-Policy: no-referrer` を付ける。出典のリンクは `rel="noopener noreferrer"`。
## 理由
外部へ送る情報を最小にする（competition ルール「外部へ送信しない」の精神）。地理院のタイルは Referer なしで返る（index.html と方向性の確認の範囲で問題は見つかっていない【仮定】）。
## 検討した代替案（採らなかった理由）
- `strict-origin-when-cross-origin`: localhost のオリジンが地理院へ届く。利点は無い。
- `same-origin`: 同じオリジンには送るが、本アプリでは同じオリジンの Referer も使わない。
## 結果・影響（良い点・悪い点・注意）
良い点: 漏れが無い。悪い点: 無し。注意: タイルが Referer を求めるようになったら地図が出ないので、M4 で実際のタイルが表示されることを手で確かめる（ネットがある時）。
## 【仮定】（資料にない前提。無ければ「なし」）
地理院のタイルが Referer なしで返ること（M4 で確認）。
