# 第一停車場 地磁即時監控 — 安裝程式
# 功能：建立 .env 設定、註冊開機自動啟動（異常自動重啟）、啟動服務、建立桌面捷徑
$ErrorActionPreference = 'Stop'
$AppDir = Split-Path -Parent $PSScriptRoot   # scripts/ 的上一層 = 程式資料夾
$Exe = Join-Path $AppDir 'GeomagMonitor.exe'
$Url = 'http://127.0.0.1:8610'
$TaskName = 'GeomagMonitor'

Write-Host '=== 第一停車場 地磁即時監控 安裝程式 ===' -ForegroundColor Cyan

if (-not (Test-Path $Exe)) {
    Write-Host "找不到 $Exe，請確認 zip 已完整解壓縮後再執行。" -ForegroundColor Red
    exit 1
}

# 解除「網路下載封鎖」（Mark-of-the-Web）：
# 從網路下載的 zip 解壓後所有檔案都帶封鎖標記，exe 經工作排程器啟動會被系統默默擋下
Write-Host '解除檔案封鎖中…' -NoNewline
Get-ChildItem -Path $AppDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
Write-Host ' 完成'

# 1) 建立 / 重設 .env（IP 與埠號分開輸入，連線資訊不隨安裝包散布）
$EnvPath = Join-Path $AppDir '.env'
$needConfig = $true
if (Test-Path $EnvPath) {
    $re = Read-Host '偵測到既有設定（.env）。要重新設定連線資訊嗎？（y=重新設定，直接按 Enter=沿用）'
    if ($re -notmatch '^[Yy]') { $needConfig = $false; Write-Host '沿用既有設定。' }
}
if ($needConfig) {
    Write-Host ''
    Write-Host '請輸入地磁系統（Carin）連線資訊（請向系統負責人索取）：'
    $base = $null
    do {
        # 主機 IP：容錯處理——貼了 http://、整段網址、或「IP:埠號」都能自動解析
        $ipRaw = (Read-Host '  主機 IP（只需數字與點，例：192.168.0.50）').Trim()
        $ipRaw = $ipRaw -replace '^https?://', '' -replace '/.*$', ''
        $port = $null
        if ($ipRaw -match '^(.+):(\d+)$') { $port = $Matches[2]; $ipRaw = $Matches[1] }

        if ($ipRaw -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
            Write-Host '  [X] IP 格式不正確，請只輸入數字與點（例：192.168.0.50）。' -ForegroundColor Yellow
            continue
        }
        if (-not $port) {
            $port = (Read-Host '  埠號 Port（純數字，例：8080）').Trim()
        }
        if ($port -notmatch '^\d{1,5}$') {
            Write-Host '  [X] 埠號必須是 1～5 位數字，請從 IP 重新輸入。' -ForegroundColor Yellow
            continue
        }

        $base = "http://${ipRaw}:${port}"
        Write-Host "  測試連線 $base …" -NoNewline
        try {
            $null = Invoke-WebRequest "$base/Login" -UseBasicParsing -TimeoutSec 6
            Write-Host ' [OK] 連線成功' -ForegroundColor Green
        } catch {
            Write-Host ' [X] 連不上' -ForegroundColor Yellow
            $ans = Read-Host '  無法連到地磁主機，可能是 IP/埠號有誤或網路不通。r=重新輸入 / c=仍用此設定繼續'
            if ($ans -notmatch '^[Cc]') { $base = $null }
        }
    } until ($base)

    $user = Read-Host '  帳號'
    $pass = Read-Host '  密碼'
    @(
        "CARIN_BASE_URL=$base",
        "CARIN_USERNAME=$user",
        "CARIN_PASSWORD=$pass",
        'POLL_INTERVAL=8',
        'OFFLINE_THRESHOLD_HOURS=2',
        'DB_PATH=data/geomag.sqlite',
        'API_HOST=127.0.0.1',
        'API_PORT=8610'
    ) | Set-Content -Path $EnvPath -Encoding UTF8
    Write-Host '已建立 .env 設定檔。'
}

# 2) 註冊「登入自動啟動」工作排程，異常時每分鐘自動重啟
$action   = New-ScheduledTaskAction -Execute $Exe -WorkingDirectory $AppDir
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "已註冊開機自動啟動（工作排程器：$TaskName）。"

# 3) 啟動並等待服務就緒
Get-Process GeomagMonitor -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName
Write-Host '啟動服務中' -NoNewline
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest "$Url/api/summary" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Write-Host '.' -NoNewline
    Start-Sleep -Seconds 2
}
Write-Host ''
if ($ok) {
    Write-Host '服務啟動成功！' -ForegroundColor Green
} else {
    Write-Host '服務尚未回應，自動診斷中…' -ForegroundColor Yellow
    $proc = Get-Process GeomagMonitor -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host ("  程式有在執行（PID {0}），可能仍在啟動或連線資訊有誤；稍後點桌面捷徑重試。" -f $proc.Id)
    } else {
        $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($info) { Write-Host ("  程式未啟動（工作排程結果代碼 0x{0:X}）。" -f $info.LastTaskResult) }
        Write-Host '  可能是防毒軟體攔截：請將本資料夾加入防毒「信任／排除清單」後，重新執行 install.bat。' -ForegroundColor Yellow
    }
    $logFile = Join-Path $AppDir 'logs\geomag.log'
    if (Test-Path $logFile) {
        Write-Host '  --- 最近日誌 ---'
        Get-Content $logFile -Tail 5 | ForEach-Object { Write-Host "  $_" }
    }
}

# 4) 建立桌面捷徑（以預設瀏覽器分頁開啟；想全螢幕可在瀏覽器按 F11）
$Desktop = [Environment]::GetFolderPath('Desktop')
@('[InternetShortcut]', "URL=$Url") | Set-Content -Path (Join-Path $Desktop '第一停車場監控.url') -Encoding ASCII
# 清除舊版的全螢幕捷徑
Remove-Item (Join-Path $Desktop '第一停車場監控-全螢幕.lnk') -Force -ErrorAction SilentlyContinue
Write-Host '桌面捷徑已建立：「第一停車場監控」（以瀏覽器分頁開啟）。'
Write-Host ''
Write-Host '安裝完成。日常使用：點桌面「第一停車場監控」即可。' -ForegroundColor Green
if ($ok) { Start-Process $Url }  # 安裝成功直接開給管理員看
