# 観光・再訪体験Webアプリ（MC-017 競技用）

既存の観光デジタルスタンプラリー（地図・QRスタンプ・クイズ・音声案内・特典クーポン・行動データCSV）は楽しまれているが、再訪につながっていない。
このリポジトリは、観光客がスマホで使う「**再訪につながる新体験**」Webアプリを、AI-DLC 軽量版（10時間）で作る競技用プロジェクトです。

## 現在の状況
| 到達点 | 状態 |
|--------|------|
| M1 準備（ルール・コマンド・docs骨組み） | 完了 |
| M2 調査・ペルソナ・方向性（案を選んで停止） | 完了（2026-11-09 12:37、補強案B を選択） |
| M3 企画・設計 | 作業中（設計書・ADR・ユニット計画まで作成） |
| M4 製造・試験設計 | 作業中（U-01 歩く骨組みを製造） |
| M5 仕上げ・提出 | 未 |

最新は `docs/00_準備/aidlc-state.md`。

## 守っていること（競技制約）
- アプリ動作に外部API・クラウド・外部DB・CDN・LLMを使わない。**localhost のみ、ネットなしで動く**。
- 地図は Leaflet + 地理院タイルの**淡色地図**。画面に「**出典：地理院タイル**」（[地理院タイル一覧](https://maps.gsi.go.jp/development/ichiran.html) へリンク）を常時表示。画像の外部許可は地理院のみ（CSP）。タイルの一括ダウンロードはしない。
- オフライン時は、同じアイコンの簡易地図に切り替え、「オフライン表示中」と表示する。
- 個人情報なし・ログインなし（ダミーID）。LINE等はモック。データは `C:\AI-Sprint\sample-data\` のCSV（読み取り専用）。
- OSS は MIT / BSD / Apache / ISC のみ。一覧は [外部リソース](docs/00_準備/外部リソース.md)。

## 技術
React + Vite + TypeScript ／ Express + zod ／ SQLite（better-sqlite3）／ Leaflet ／ Vitest ／ Playwright。
サーバーは `route → service → repository`、1ファイル300行目安、`innerHTML` 禁止、SQLはプレースホルダ。

## 起動
前提: Node.js 22 以上（確認環境 v24.21.0）、`C:\AI-Sprint\sample-data\` に CSV があること（読むだけ。書き換えない）。シェルは PowerShell。
```powershell
npm install                # .npmrc に ignore-scripts=true あり
node -e "const D=require('better-sqlite3'); new D(':memory:'); console.log('sqlite ok')"   # ネイティブ依存の確認
npm run build              # app/client/dist を作る
npm start                  # http://127.0.0.1:3000 （127.0.0.1 のみで待ち受け）
npm run start:demo         # デモ操作（日付・場所・さいころ +5）つき。DEMO_MODE=1
npm run start:admin        # start:demo と同じ（運営向けは既定で出る）。VOICEVOX は起動しない
```
- 開発: `npm run dev:server`（3000）と `npm run dev:client`（Vite 5173。`/api` は 3000 へ proxy）を別々のターミナルで。
- 試験: `npm test`（Vitest。DB はメモリ上）、`npm run test:e2e`（ビルド＋Playwright。1並列。**dev サーバーと手で起動した 3000 を止めてから**。3000＝デモあり・3100＝デモなしを Playwright が起動して止める。ブラウザは端末の Microsoft Edge を使う）、`npm run typecheck`、`npm run lint`（禁止事項の検査）。
- 環境変数: `PORT`（既定 3000）、`DB_PATH`（既定 `data/app.db`、`:memory:` 可）、`SAMPLE_DATA_DIR`（既定 `C:\AI-Sprint\sample-data`。フォルダが無いと日本語のエラーで止まる）、`DEMO_MODE`（`1` でデモ操作あり）、`ADMIN_MODE`（既定 `1`。利用者画面と同じ URL の `/admin`（例 http://127.0.0.1:3000/admin）と `/api/admin/*` が出る。観光協会・店向け。`0` にすると 404。`DEMO_MODE=1` も付くとダミーの利用者が入り、数字が出る）、`VOICEVOX_PORT`（既定 50021）。
- CSV の取込は起動のたびに行う（何回行っても件数は同じ）。取込だけ試すときは `npm run import:csv`。
- アバターの絵は `docs/10_企画/アバター/<id>/` の4枚を `npm run import:avatars` で `app/client/public/avatars/` へ取り込む（4枚そろわない体は「準備中」になる）。取り込んだら `npm run build`。

### 読み上げの声（VOICEVOX・任意）
**声は VOICEVOX で読みます（既定）。** VOICEVOX ENGINE が止まっているときは、ブラウザの声には切り替えず、読み上げずに文字だけを出します（「VOICEVOX が起動していないので、声は出せません」と表示。アプリの全機能は声なしでも動きます）。設定の「声」で「ブラウザの声」を選ぶと、端末内の声（Windows の Nanami など）で読みます。起動は別のターミナルで `npm run start:voice`（`C:\voicevox-work\windows-cpu\run.exe` を 127.0.0.1:50021 で起動。場所は環境変数 `VOICEVOX_DIR` で変えられます。応答まで約50秒）。

VOICEVOX の声を使う場合（アプリとは別のプログラム。アプリに同梱しません。LGPL v3）:
1. 配布元 https://github.com/VOICEVOX/voicevox_engine/releases/tag/0.26.1 から Windows CPU 版を入手して、例えば `C:\voicevox-work\windows-cpu\` に展開する（約2.1GB）。
2. 起動する（アプリより先でも後でもよい。起動まで約50秒）:
   ```powershell
   Set-Location 'C:\voicevox-work\windows-cpu'
   .\run.exe --host 127.0.0.1 --port 50021 --disable_mutable_api --output_log_utf8
   ```
3. `Get-NetTCPConnection -LocalPort 50021 -State Listen` で `127.0.0.1` の1件だけを確かめる。アプリのサーバーはエンジンが止まっている間も動き続け、前の確認から30秒たった後の読み上げで確かめ直すので、あとから起動しても VOICEVOX の声で読める。
4. 止めるときは `Stop-Process` で止め、上のコマンドで待ち受けが無いことを確かめる。エンジンは利用者のデータフォルダ（`%LOCALAPPDATA%\voicevox-engine\`）にも辞書などを書くので、片付けるときはそこも消す。

声は ともにゃん=春日部つむぎ、ほしろう=満別花丸（元気）、ぴっこん=春歌ナナ、とうじい=ちび式じい。VOICEVOX の声で鳴っている間は画面の隅に「VOICEVOX:話者名」が出ます。このアプリは各キャラクターの公式とは関係ありません。詳細は [外部リソース](docs/00_準備/外部リソース.md) と `docs/00_準備/音声合成の準備.md`。

TypeScript は 6.0 系、Git は使いません。

## 進め方（AI-DLC 軽量版）
| コマンド | 用途 |
|----------|------|
| `/next M2` … `/next M5` | 指定の到達点まで進める（M2 は補強案3つで必ず止まり、人が選ぶ） |
| `/check` | テストとルールの確認（直さない） |
| `/fix` | 原因を説明してから直す（テストは消さない） |

- 進み具合: [aidlc-state.md](docs/00_準備/aidlc-state.md)
- 指示・AIの誤り・AIの決定・人の判断の記録: [audit.md](docs/00_準備/audit.md)
- 進め方と成果物の一覧: [AI-DLC軽量版.md](docs/00_準備/AI-DLC軽量版.md)

## ドキュメント
| フォルダ | 内容 |
|----------|------|
| `docs/00_準備/` | 進め方・状態・監査・外部リソース |
| `docs/10_企画/` | 調査・ペルソナ・方向性・コンセプト・ストーリー・要件・画面モック |
| `docs/20_設計/` | アーキテクチャ・データ・API・非機能/セキュリティ・画面設計・ユニット計画 |
| `docs/30_製造/` | ユニット別の製造記録 |
| `docs/40_試験/` | 試験計画・項目・E2Eデモ・結果 |
| `docs/50_提出/` | 提出前チェック・提出物一覧・AI活用まとめ |

各文書は、作る到達点で中身まで書きます。空のフォルダは、最初のファイルができるまで空です。

## 出典・ライセンス
- 地図: 出典：[地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)（国土地理院）
- 声（任意）: VOICEVOX:春日部つむぎ ／ VOICEVOX:満別花丸 ／ VOICEVOX:春歌ナナ ／ VOICEVOX:ちび式じい（VOICEVOX ENGINE は別プログラム、LGPL v3）
- アバターの絵: 自作の SVG（`docs/10_企画/アバター/`）
- OSS のライセンスと確認結果: [外部リソース](docs/00_準備/外部リソース.md)

## 品質の目標
- アクセシビリティは **WCAG 2.2 AA**。HTTPS 強制（HSTS）は行わない（localhost の HTTP で動かす）。
- 確認項目と方法: [セキュリティ品質チェックリスト](docs/00_準備/セキュリティ品質チェックリスト.md)、[アクセシビリティチェックリスト](docs/00_準備/アクセシビリティチェックリスト.md)。結果欄は、実際に確認するまで「未確認」です。
