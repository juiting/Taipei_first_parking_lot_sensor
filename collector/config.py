"""集中設定：一律由環境變數 / .env 載入，禁止硬寫帳密。"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# PyInstaller 打包（frozen）時，.env / data / logs 一律放在 exe 同層，方便現場修改
if getattr(sys, "frozen", False):
    PROJECT_ROOT = Path(sys.executable).resolve().parent
else:
    PROJECT_ROOT = Path(__file__).resolve().parent.parent
# utf-8-sig：容忍 Windows PowerShell 5.1 寫出的 UTF-8 BOM（否則第一個變數名會黏到 BOM 讀不到）
load_dotenv(PROJECT_ROOT / ".env", encoding="utf-8-sig")


def _require(key: str) -> str:
    val = os.getenv(key, "").strip()
    if not val:
        raise RuntimeError(f"缺少必要環境變數 {key}，請確認 .env（參考 .env.example）")
    return val


CARIN_BASE_URL = os.getenv("CARIN_BASE_URL", "").rstrip("/")
CARIN_USERNAME = os.getenv("CARIN_USERNAME", "")
CARIN_PASSWORD = os.getenv("CARIN_PASSWORD", "")

POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "8"))
OFFLINE_THRESHOLD_HOURS = float(os.getenv("OFFLINE_THRESHOLD_HOURS", "2"))

# Brickcom 感測器管理平台（電量 / RSSI）。未設定 URL 時此功能自動停用。
BRICKCOM_STATUS_URL = os.getenv("BRICKCOM_STATUS_URL", "").strip()
BRICKCOM_DEBUG_BASE = os.getenv("BRICKCOM_DEBUG_BASE", "").strip().rstrip("/")
BRICKCOM_BATTERY_INTERVAL = float(os.getenv("BRICKCOM_BATTERY_INTERVAL", "300"))   # 電量全表輪詢（秒）
BRICKCOM_RSSI_INTERVAL = float(os.getenv("BRICKCOM_RSSI_INTERVAL", "1800"))        # RSSI 全場掃描間隔（秒）
BRICKCOM_RSSI_PACING = float(os.getenv("BRICKCOM_RSSI_PACING", "0.3"))             # 逐顆查詢間隔（秒），避免打爆廠商服務

DB_PATH = str(PROJECT_ROOT / os.getenv("DB_PATH", "data/geomag.sqlite"))
LAYOUT_PATH = PROJECT_ROOT / "data" / "layout" / "layout.json"

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8600"))


def validate_carin_config() -> None:
    """啟動 collector 前呼叫，確保連線資訊齊全。"""
    _require("CARIN_BASE_URL")
    _require("CARIN_USERNAME")
    _require("CARIN_PASSWORD")
