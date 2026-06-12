# 第一停車場 地磁即時 3D 監控

台北市第一停車場（建國北路三段 × 民權東路）地磁感測器即時現況的 3D 視覺化監控。
資料來自 **Carin 地端 IoT 服務**，每格地磁裝設於車格中央（含 4 格大客車）。

- **後端**：FastAPI，輪詢 Carin 網頁解析全部車格狀態，寫入 SQLite，並以 WebSocket 即時推播變更。
- **前端**：React + Three.js（react-three-fiber），可旋轉/縮放的 3D 場景，狀態以顏色呈現、有車顯示車輛模型，點擊看詳情。

```
collector/   Carin 登入、解析、輪詢、SQLite（資料源已抽象化，未來換廠商 API 只需新增一個 SpaceSource）
api/         FastAPI：REST + WebSocket + 服務前端靜態檔
data/        SQLite、平面圖、車格座標（layout）
scripts/     build_layout.py：排定義 → 每格座標 + 校對 SVG
web/         Vite + React + TS 前端
```

## 狀態與顏色

| 顏色 | 狀態 | 說明 |
|------|------|------|
| 🟢 綠 | Available | 空位 |
| 🔴 紅 | Occupied | 在席（顯示車輛模型） |
| ⚪ 灰 | Maintenance | 維護 |
| 🟣 紫（閃爍） | Offline | 感測器超過門檻時數未回報 |

## 安裝與啟動

### 1. 環境變數
```bash
cp .env.example .env
# 編輯 .env 填入 CARIN_USERNAME / CARIN_PASSWORD（切勿提交進版控）
```

### 2. 後端
```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 產生車格座標（首次或修改 layout_source.json 後）
.venv/bin/python scripts/build_layout.py

# 驗證可連上 Carin 並解析（會印出統計）
.venv/bin/python -m collector.run_once
```

### 3. 前端
```bash
cd web
npm install
npm run build          # 產出 web/dist，後端會自動掛載到 /
```

### 4. 啟動（單一服務同時提供 API + 前端）
> Port 8610（8600 保留給戰情室 Kiosk，避免衝突）。可改 `.env` 的 `API_PORT`。
```bash
.venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8610
# 瀏覽器開 http://localhost:8610
```

### 開發模式（前端熱更新）
```bash
# 終端機 A：後端
.venv/bin/python -m uvicorn api.main:app --port 8610
# 終端機 B：前端（已設定代理 /api /ws → 8610）
cd web && npm run dev
```

## 車格座標校正

座標目前為**依平面圖照片判讀的草稿**（編號 1–315 + 大客車 1–4 完整、相對拓樸接近）。
精確位置請依高解析平面圖或 CAD 校正：

1. 編輯 `data/layout/layout_source.json`（以「排」為單位：`origin` 起點、`heading` 方向、`pitch` 間距、`range`/`list` 編號）。
2. 執行 `scripts/build_layout.py`，會重新產出 `layout.json` 與校對圖 `layout_preview.svg`。
3. 對照平面圖確認 `layout_preview.svg` 的編號與位置無誤。

座標系：公尺、y 向下（與平面圖視覺一致）。

## API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/layout` | 車格座標 |
| GET | `/api/spaces` | 全部車格（座標 + 即時狀態） |
| GET | `/api/summary` | 統計（各狀態、分區、離線、來源健康度） |
| GET | `/api/spaces/{name}/history` | 單格狀態變化歷史 |
| WS | `/ws` | 連上即收全量 snapshot，之後推播狀態變更 diff |

## 資料源備註

Carin 服務（ASP.NET Core）無對外查詢 API，目前以登入 + 解析主頁 HTML 表格取得 324 筆
（315 小型車 + 4 大客車 + 5 備品/未配置）。解析集中於 `collector/carin_client.py`，
頁面改版時僅需調整此處。
