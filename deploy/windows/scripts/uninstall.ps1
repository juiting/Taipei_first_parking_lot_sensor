# 第一停車場 地磁即時監控 — 移除程式
# 移除自動啟動與桌面捷徑；程式資料夾與歷史資料保留（可手動整個刪除）
$ErrorActionPreference = 'SilentlyContinue'

Stop-ScheduledTask -TaskName 'GeomagMonitor'
Unregister-ScheduledTask -TaskName 'GeomagMonitor' -Confirm:$false
Get-Process GeomagMonitor | Stop-Process -Force

$Desktop = [Environment]::GetFolderPath('Desktop')
Remove-Item (Join-Path $Desktop '第一停車場監控.url') -Force
Remove-Item (Join-Path $Desktop '第一停車場監控-全螢幕.lnk') -Force

Write-Host '已移除自動啟動與桌面捷徑。程式資料夾（含設定與歷史資料）保留，不再使用可直接刪除整個資料夾。' -ForegroundColor Green
