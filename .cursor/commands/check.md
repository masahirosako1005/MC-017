# /check — テストとルール確認（確認だけ。直さない）

結果は表で報告する: `項目 | PASS/FAIL/対象なし | 根拠（件数・ファイル）`。FAIL は直さず、`/fix` を勧める。
PowerShell で、リポジトリ直下から実行する。コードがまだ無い到達点では「対象なし」とする（空ファイル・docs・state/audit の確認は常に行う）。

## A. テスト（`package.json` の scripts にある物だけ。Git は使わない）
前提確認（`environment.mdc`）:
```powershell
Get-Content .npmrc                                   # ignore-scripts=true があること
node -v; npm -v
Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue   # E2E 前は空であること（dev を止める）
npm ls typescript --depth=0                          # 6.0 系であること
```
```powershell
if (Test-Path package.json) { npm run lint --if-present; npm run typecheck --if-present; npm test --if-present; npm run test:e2e --if-present }
```
- 失敗したテストは名前と要約を書く。`.skip` / `.only` / `xit` / `fit` が残っていれば FAIL。
- **実行していないテストの合否は書かない**。実行した物だけ PASS/FAIL、未実行は「未実行」と理由。結果に `Get-Date` の時刻とコマンドを添える。
- E2E は `workers: 1`・`fullyParallel: false`・状態を毎回戻す・DB は `:memory:`。実行後に起動したサーバーが残っていない（3000/5173 が空）こと。

## B. 競技ルール（src・scripts・db が対象）
```powershell
$code = Get-ChildItem src,scripts,tests -Recurse -Include *.ts,*.tsx,*.css,*.html -ErrorAction SilentlyContinue
# 1 innerHTML 等・eval 禁止
$code | Select-String -Pattern 'innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write|\beval\(|new Function'
# 2 300行超
$code | Where-Object { (Get-Content $_.FullName).Count -gt 300 } | ForEach-Object { "$($_.FullName) $((Get-Content $_.FullName).Count)行" }
# 3 外部URL（許可: 地理院タイル・出典リンク maps.gsi.go.jp / cyberjapandata.gsi.go.jp、localhost、XML名前空間）
$code | Select-String -Pattern 'https?://' | Where-Object { $_.Line -notmatch 'gsi\.go\.jp|localhost|127\.0\.0\.1|www\.w3\.org' }
# 4 SQL の連結・補間（prepare/exec/run の引数に ${ または + を含む）
$code | Select-String -Pattern '(prepare|exec)\s*\(\s*`[^`]*\$\{|(prepare|exec)\s*\([^)]*\+'
# 5 層違反: route から repository / better-sqlite3、service から express / repository 以外のSQL
Get-ChildItem src/server -Recurse -Filter *.ts -ErrorAction SilentlyContinue | Select-String -Pattern "from '.*repositor" | Where-Object { $_.Path -match 'routes?' }
Get-ChildItem src -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue | Select-String -Pattern "better-sqlite3" | Where-Object { $_.Path -notmatch 'repositor|scripts|tests|db' }
```
- 1〜5 は 0件で PASS。
- 6 **出典表示**: クライアントに「出典：地理院タイル」と `https://maps.gsi.go.jp/development/ichiran.html` が存在し、E2E で地図画面・オフライン画面の両方で見えること。
- 7 **オフライン**: 「オフライン表示中」の表示と、同じアイコンの簡易地図に切り替わるE2Eが存在し通ること。
- 8 **CSP**: `img-src` が `'self' data: https://cyberjapandata.gsi.go.jp` のみ。`script-src` に `unsafe-inline` なし。
- 9 **listen**: `127.0.0.1` のみ。
- 10 **タイル一括取得なし**: `scripts`・Service Worker に地理院タイルの先読み/ループ取得が無い。
- 11 **OSS**: `package.json` の全依存が `docs/00_準備/外部リソース.md` に記録済みで、ライセンスが MIT/BSD/Apache/ISC。
```powershell
# 実インストール分の license を確認（直接依存＋推移依存）
Get-ChildItem node_modules -Directory -ErrorAction SilentlyContinue | ForEach-Object { $p = Join-Path $_.FullName 'package.json'; if (Test-Path $p) { $j = Get-Content $p -Raw | ConvertFrom-Json; "$($j.name)`t$($j.license)" } } | Where-Object { $_ -notmatch '\t(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|BlueOak-1\.0\.0|Python-2\.0|CC0-1\.0|Unlicense)$' }
```
- 該当行は個別に判断。MIT/BSD/Apache/ISC 以外は要確認として FAIL。推移依存の `@scope/*` は走査対象外のため `npm ls --all` でも補う【仮定】。
- 12 **秘密ファイル**: `Password*` を開いていない。提出物（`50_提出/提出物一覧.md` の対象）に含まれない。`.gitignore` に `Password*` がある。
- 12b **環境**: `.npmrc` に `ignore-scripts=true`。`typescript` が 6.0 系。`git` コマンドを実行していない。ポートは 3000（Express）/ 5173（Vite dev）。

## D. セキュリティ・品質・アクセシビリティ（`security-quality.mdc`。コード・サーバーがある到達点から）
サーバーを 3000 で起動した状態で（起動していなければ「対象なし」）、4種の応答のヘッダを確認する:
```powershell
foreach ($u in '/', '/api/health', '/assets/no-such.js', '/api/no-such') { "== $u"; curl.exe -sS -o NUL -D - "http://127.0.0.1:3000$u" }
```
- 18 **HSTS なし**: 4種のどれにも `Strict-Transport-Security` が無い（1件でもあれば FAIL）。`X-Powered-By`・`Access-Control-Allow-Origin`・`Cross-Origin-Embedder-Policy: require-corp` も無い。
- 19 **ヘッダ一式**: 4種すべてに CSP（`unsafe-` なし・`object-src 'none'`・`base-uri 'none'`・`frame-ancestors 'none'`・`img-src` は地理院のみ）、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`X-Frame-Options: DENY`。404 本文に `Cannot GET` が無い。
- 20 **TypeScript**: 全 `tsconfig*.json` で `strict: true`、構成要素を `false` にしていない、`any`・理由なしの `@ts-ignore` が0件、`npx tsc --noEmit` が通る。
```powershell
Get-ChildItem -Recurse -Filter 'tsconfig*.json' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch 'node_modules' } | Select-String -Pattern '"strict"|: false'
Get-ChildItem src,scripts,tests -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue | Select-String -Pattern ': any\b|as any|<any>|@ts-ignore|@ts-expect-error|res\.redirect|helmet'
```
- 21 **入力検証**: 全 route が zod で `params`/`query`/`body` を検証してから使う（SEC-IN-01）。不正入力・サイズ超過・型違い（`?id[]=`）の試験がある。
- 22 **アクセシビリティ**: E2E に、キーボードだけの通しシナリオ、`lang="ja"`、画面ごとの `document.title`、`role="status"`（オフライン表示中）、操作要素の寸法（24px 以上）、320px 幅のリフローがある。`outline: none` を代替なしに使っていない。
- 23 **チェックリストの結果欄**: 2つのチェックリストで、実行・確認していない項目が `PASS`/`FAIL` になっていない（証跡が `docs/40_試験/試験結果.md` に無い PASS は FAIL）。その到達点の時期の項目が未確認のまま残っていれば件数と理由を報告する。
```powershell
foreach ($f in 'docs/00_準備/セキュリティ品質チェックリスト.md', 'docs/00_準備/アクセシビリティチェックリスト.md') { $r = Select-String -Path $f -Pattern '^\| (SEC|QL|WCAG|INC)'; "$f 全$($r.Count) 未確認$(($r | Where-Object { $_.Line -match '未確認 \|$' }).Count)" }
```

## C. AI-DLC・文書
```powershell
# 空ファイル・見出しのみ・TODO残し
Get-ChildItem docs -Recurse -File | Where-Object { $_.Length -eq 0 -or (Select-String -Path $_.FullName -Pattern 'TODO|TBD|未記入|後で' -Quiet) }
# 画面モックと画面設計の1対1
$m = Get-ChildItem docs/10_企画/画面モック -Filter 'SC-*' -ErrorAction SilentlyContinue | ForEach-Object { $_.BaseName }
$d = Get-ChildItem docs/20_設計/画面設計 -Filter 'SC-*.md' -ErrorAction SilentlyContinue | ForEach-Object { $_.BaseName }
Compare-Object $m $d
```
- 13 空・TODO・1対1ずれが 0件。
- 14 `aidlc-state.md` の到達点と実ファイルが一致（state が完了と言うのに成果物が無い、またはその逆が無い）。
- 15 `audit.md`: 追記のみ（Git は使わないので、`aidlc-state.md` に書いた「audit 行数」より減っていない・時刻が実測の `Get-Date` を超えていない・日時が昇順）。直近の作業の `指示`/`AI決定`/`AIの誤り`/`人の判断` が漏れていない。
```powershell
(Select-String -Path docs/00_準備/audit.md -Pattern '^\| 20\d\d-').Count; Get-Date -Format 'yyyy-MM-dd HH:mm'
```
- 15b **ADR**: `docs/20_設計/adr/` が `ADR-nnn_題名.md`（1決定1ファイル）、番号に欠け・重複なし、全項目が埋まっている。設計書の主要な決定に対応する ADR がある（M3 以降）。
- 16 追跡: 要件(R)→ストーリー(US)→画面(SC)→ユニット(U)→試験(T) の孤児・抜けなし。
- 17 資料にない仕様に【仮定】が付いている。

## 報告
最後に「PASS n / FAIL n / 対象なし n」と、FAIL を重い順に3件まで。
