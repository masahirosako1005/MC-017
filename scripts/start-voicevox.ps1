# VOICEVOX ENGINE を 127.0.0.1:50021 だけで待ち受けて起動する（docs/00_準備/音声合成の準備.md §3、ADR-011・ADR-023）。
# 使い方: npm run start:voice  （別のターミナルで動かしたままにする。止めるときは Ctrl+C）
# エンジンの場所を変えるときは $env:VOICEVOX_DIR、ポートは $env:VOICEVOX_PORT（アプリ側の VOICEVOX_PORT と同じ値）。
$ErrorActionPreference = 'Stop'
$dir = if ($env:VOICEVOX_DIR) { $env:VOICEVOX_DIR } else { 'C:\voicevox-work\windows-cpu' }
$port = if ($env:VOICEVOX_PORT) { $env:VOICEVOX_PORT } else { '50021' }
$exe = Join-Path $dir 'run.exe'

if (-not (Test-Path -LiteralPath $exe)) {
  Write-Host "VOICEVOX ENGINE が見つかりません: $exe"
  Write-Host '導入の手順は docs/00_準備/音声合成の準備.md §2 を見てください。別の場所なら $env:VOICEVOX_DIR を指定します。'
  exit 1
}

$busy = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue
if ($busy) {
  Write-Host "ポート $port はすでに使われています（VOICEVOX が起動済みかもしれません）。"
  exit 0
}

Write-Host "VOICEVOX ENGINE を起動します（127.0.0.1:$port。応答まで約50秒かかります）…"
Set-Location -LiteralPath $dir
& $exe --host 127.0.0.1 --port $port --disable_mutable_api --output_log_utf8
