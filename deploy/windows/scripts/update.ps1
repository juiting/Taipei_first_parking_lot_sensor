# 第一停車場 地磁即時監控 — 線上更新
# 從 GitHub Releases 下載最新版，就地覆蓋程式檔；保留 .env、data（含車格座標與歷史資料）、logs
$ErrorActionPreference = 'Stop'
$Repo = 'juiting/Taipei_first_parking_lot_sensor'
$AppDir = Split-Path -Parent $PSScriptRoot
$TaskName = 'GeomagMonitor'

Write-Host '查詢最新版本…'
$rel = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -UseBasicParsing
$asset = $rel.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
if (-not $asset) { Write-Host '找不到可下載的安裝包。' -ForegroundColor Red; exit 1 }
Write-Host ("最新版本：{0}（{1}）" -f $rel.tag_name, $asset.name)

$tmp = Join-Path $env:TEMP 'geomag_update'
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tmp | Out-Null
$zip = Join-Path $tmp $asset.name
Write-Host '下載中…'
Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
Expand-Archive $zip -DestinationPath $tmp
$src = Get-ChildItem $tmp -Directory | Select-Object -First 1
if (-not $src) { Write-Host '安裝包結構異常。' -ForegroundColor Red; exit 1 }

Write-Host '停止服務…'
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Get-Process GeomagMonitor -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host '覆蓋程式檔（保留 .env / data / logs）…'
robocopy $src.FullName $AppDir /E /XF .env /XD data logs /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Host "檔案複製失敗（robocopy 代碼 $LASTEXITCODE）。" -ForegroundColor Red; exit 1 }

Write-Host '重新啟動服務…'
Start-ScheduledTask -TaskName $TaskName
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ("更新完成（{0}）。" -f $rel.tag_name) -ForegroundColor Green
Write-Host '註：車格座標（data\layout）屬現場校正資料，更新不會覆蓋；若新版含座標修正，請依說明手動取用。'
