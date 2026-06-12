"""Windows 現場部署入口（PyInstaller 打包為 GeomagMonitor.exe）。

- 以程式內方式啟動 uvicorn（api.main:app），collector 由 app lifespan 帶起
- --noconsole 模式下沒有 stdout/stderr，日誌一律寫到 exe 旁的 logs/geomag.log
"""
from __future__ import annotations

import logging
import multiprocessing
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def app_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent.parent


def setup_logging(root: Path) -> None:
    log_dir = root / "logs"
    log_dir.mkdir(exist_ok=True)
    handler = RotatingFileHandler(
        log_dir / "geomag.log", maxBytes=2_000_000, backupCount=5, encoding="utf-8"
    )
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(fmt)
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(handler)
    # 開發模式（有終端機）時同步輸出到畫面
    if sys.stderr is not None:
        console = logging.StreamHandler()
        console.setFormatter(fmt)
        root_logger.addHandler(console)


def main() -> None:
    multiprocessing.freeze_support()
    root = app_root()
    # 開發模式直跑本檔時，把專案根目錄加入匯入路徑（frozen 由 PyInstaller pathex 處理）
    if not getattr(sys, "frozen", False) and str(root) not in sys.path:
        sys.path.insert(0, str(root))
    setup_logging(root)
    log = logging.getLogger("geomag.launcher")

    try:
        import uvicorn

        from api.main import app
        from collector import config

        log.info("第一停車場監控啟動：http://%s:%s（root=%s）",
                 config.API_HOST, config.API_PORT, root)
        # log_config=None：沿用上面設定的 root logger（檔案輪替）
        uvicorn.run(app, host=config.API_HOST, port=config.API_PORT, log_config=None)
    except Exception:
        log.exception("啟動失敗")
        raise


if __name__ == "__main__":
    main()
