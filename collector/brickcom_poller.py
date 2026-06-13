"""Brickcom 健康度輪詢：電量（全表、較頻繁）與 RSSI（逐顆掃描、較慢）。

與主 poller 解耦：未設定 BRICKCOM_STATUS_URL 時整個功能不啟動，
既有功能完全不受影響。
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from . import config
from .brickcom_client import BrickcomClient
from .db import GeomagDB, now_iso

log = logging.getLogger(__name__)

Listener = Callable[[dict], Awaitable[None]]


class BrickcomPoller:
    def __init__(self, client: BrickcomClient, db: GeomagDB):
        self.client = client
        self.db = db
        # name -> {battery, battery_at, rssi, rssi_at, mac, remark}
        self.health: dict[str, dict] = db.load_sensor_health()
        if self.health:
            log.info("載入既有感測器健康資料 %d 筆", len(self.health))
        self._listeners: list[Listener] = []
        self._tasks: list[asyncio.Task] = []

    def subscribe(self, listener: Listener) -> None:
        self._listeners.append(listener)

    async def _notify(self) -> None:
        message = {"type": "health", "spaces": self.health}
        for listener in list(self._listeners):
            try:
                await listener(message)
            except Exception:
                log.exception("health listener 通知失敗")

    def start(self) -> None:
        loop = asyncio.get_event_loop()
        self._tasks = [
            loop.create_task(self._battery_loop(), name="brickcom-battery"),
            loop.create_task(self._rssi_loop(), name="brickcom-rssi"),
        ]

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            try:
                await t
            except asyncio.CancelledError:
                pass
        await self.client.close()

    # ---------- 電量：一次抓全表 ----------

    async def _battery_loop(self) -> None:
        log.info("Brickcom 電量輪詢啟動，間隔 %.0fs", config.BRICKCOM_BATTERY_INTERVAL)
        while True:
            try:
                await self.battery_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.error("Brickcom 電量輪詢失敗：%s", exc)
            await asyncio.sleep(config.BRICKCOM_BATTERY_INTERVAL)

    async def battery_once(self) -> None:
        sensors = await self.client.fetch_status()
        ts = now_iso()
        changed = False
        for s in sensors:
            if not s.name:
                continue
            cur = self.health.setdefault(s.name, {})
            if cur.get("battery") != s.battery:
                changed = True
            cur.update({"mac": s.mac, "remark": s.remark,
                        "battery": s.battery, "battery_at": ts})
        self.db.upsert_sensor_health(self.health)
        log.info("Brickcom 電量更新 %d 筆%s", len(sensors), "（有變化）" if changed else "")
        await self._notify()

    # ---------- RSSI：逐顆掃描 ----------

    async def _rssi_loop(self) -> None:
        log.info("Brickcom RSSI 掃描啟動，週期 %.0fs、逐顆間隔 %.1fs",
                 config.BRICKCOM_RSSI_INTERVAL, config.BRICKCOM_RSSI_PACING)
        # 先等第一次電量輪詢建立 mac 清單
        await asyncio.sleep(5)
        while True:
            try:
                await self.rssi_sweep()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.error("Brickcom RSSI 掃描失敗：%s", exc)
            await asyncio.sleep(config.BRICKCOM_RSSI_INTERVAL)

    async def rssi_sweep(self) -> None:
        targets = [(name, h["mac"]) for name, h in self.health.items() if h.get("mac")]
        if not targets:
            return
        ok = 0
        for name, mac in targets:
            try:
                rssi, ts = await self.client.fetch_latest_rssi(mac)
                if rssi is not None:
                    self.health[name].update({"rssi": rssi, "rssi_at": ts})
                    ok += 1
            except asyncio.CancelledError:
                raise
            except Exception:
                pass  # 個別失敗不中斷整輪掃描
            await asyncio.sleep(config.BRICKCOM_RSSI_PACING)
        self.db.upsert_sensor_health(self.health)
        log.info("Brickcom RSSI 掃描完成：%d/%d 筆有值", ok, len(targets))
        await self._notify()
