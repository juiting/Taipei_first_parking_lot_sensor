"""集中設定：一律由環境變數 / .env 載入，禁止硬寫帳密。"""
import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


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

DB_PATH = str(PROJECT_ROOT / os.getenv("DB_PATH", "data/geomag.sqlite"))
LAYOUT_PATH = PROJECT_ROOT / "data" / "layout" / "layout.json"

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8600"))


def validate_carin_config() -> None:
    """啟動 collector 前呼叫，確保連線資訊齊全。"""
    _require("CARIN_BASE_URL")
    _require("CARIN_USERNAME")
    _require("CARIN_PASSWORD")
