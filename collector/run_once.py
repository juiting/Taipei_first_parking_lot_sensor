"""手動驗證用：抓一次 live 資料並列印統計。

用法：.venv/bin/python -m collector.run_once
"""
from __future__ import annotations

import asyncio
import logging

from . import config
from .carin_client import CarinSource
from .db import GeomagDB
from .poller import Poller

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


async def main() -> None:
    config.validate_carin_config()
    source = CarinSource(config.CARIN_BASE_URL, config.CARIN_USERNAME, config.CARIN_PASSWORD)
    db = GeomagDB(config.DB_PATH)
    poller = Poller(source, db)
    try:
        await poller.poll_once()
        summary = poller.build_summary()
        print(f"共解析 {len(poller.snapshot)} 筆（含備品）")
        print(f"監控格數: {summary['total']}  狀態: {summary['counts']}  離線: {summary['offline']}")
        print("分區:", {z: v["total"] for z, v in summary["zones"].items()})
        cars = sorted(r.display_no for r in poller.snapshot.values() if r.space_type == "car")
        missing = [i for i in range(1, 316) if i not in set(cars)]
        print(f"汽車格 {len(cars)} 筆，缺漏編號: {missing or '無'}")
        buses = sorted(r.name for r in poller.snapshot.values() if r.space_type == "bus")
        spares = [r.name for r in poller.snapshot.values() if r.space_type == "spare"]
        print(f"大客車: {buses}；備品/未配置: {len(spares)} 筆")
    finally:
        await source.close()
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
