"""輪詢器：定期向資料源取全量狀態 → 寫 DB → 通知訂閱者（WebSocket 推播用）。"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta

from . import config
from .db import GeomagDB, now_iso
from .source_base import SpaceRecord, SpaceSource

log = logging.getLogger(__name__)

Listener = Callable[[dict], Awaitable[None]]


class Poller:
    def __init__(self, source: SpaceSource, db: GeomagDB, interval: float | None = None):
        self.source = source
        self.db = db
        self.interval = interval or config.POLL_INTERVAL
        self.snapshot: dict[str, SpaceRecord] = {}   # space_id -> record（名稱可能重複，如備品 'New'）
        self.last_success_at: str | None = None
        self.consecutive_failures = 0
        self._listeners: list[Listener] = []
        self._task: asyncio.Task | None = None

    # ---------- 訂閱 ----------

    def subscribe(self, listener: Listener) -> None:
        self._listeners.append(listener)

    def unsubscribe(self, listener: Listener) -> None:
        if listener in self._listeners:
            self._listeners.remove(listener)

    async def _notify(self, message: dict) -> None:
        for listener in list(self._listeners):
            try:
                await listener(message)
            except Exception:
                log.exception("listener 通知失敗")

    # ---------- 主迴圈 ----------

    def start(self) -> None:
        self._task = asyncio.get_event_loop().create_task(self._run(), name="geomag-poller")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.source.close()

    async def _run(self) -> None:
        log.info("poller 啟動，間隔 %.1fs", self.interval)
        while True:
            try:
                await self.poll_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.consecutive_failures += 1
                log.error("輪詢失敗（連續 %d 次）：%s", self.consecutive_failures, exc)
                await self._notify({
                    "type": "source_error",
                    "error": str(exc),
                    "consecutive_failures": self.consecutive_failures,
                    "last_success_at": self.last_success_at,
                })
            # 連續失敗時退避，最多 60 秒
            delay = min(self.interval * (1 + self.consecutive_failures), 60.0)
            await asyncio.sleep(delay)

    async def poll_once(self) -> list[dict]:
        records = await self.source.fetch_all()
        fetched_at = now_iso()
        changes = self.db.upsert_records(records, fetched_at)
        self.snapshot = {r.space_id: r for r in records}
        self.last_success_at = fetched_at
        self.consecutive_failures = 0

        if changes:
            log.info("狀態變更 %d 筆：%s", len(changes),
                     ", ".join(f"{c['name']}:{c['old_status']}→{c['new_status']}" for c in changes[:10]))
        await self._notify({
            "type": "update" if changes else "tick",
            "fetched_at": fetched_at,
            "changes": changes,
            "summary": self.build_summary(),
        })
        return changes

    # ---------- 對外查詢（API 用） ----------

    def offline_cutoff(self) -> datetime:
        return datetime.now() - timedelta(hours=config.OFFLINE_THRESHOLD_HOURS)

    def is_offline(self, record: SpaceRecord) -> bool:
        if not record.last_heartbeat:
            return True
        try:
            hb = datetime.fromisoformat(record.last_heartbeat)
        except ValueError:
            return True
        return hb < self.offline_cutoff()

    def space_payload(self, record: SpaceRecord) -> dict:
        return {
            "name": record.name,
            "no": record.display_no,
            "type": record.space_type,
            "status": record.status,
            "offline": self.is_offline(record),
            "event_time": record.event_time,
            "last_heartbeat": record.last_heartbeat,
            "imei": record.imei,
            "tags": record.tags,
        }

    def all_spaces(self) -> list[dict]:
        return [self.space_payload(r) for r in self.snapshot.values()]

    def build_summary(self) -> dict:
        counts = {"Available": 0, "Allocated": 0, "Occupied": 0, "Maintenance": 0}
        offline = 0
        zones: dict[str, dict] = {}
        monitored = 0
        for r in self.snapshot.values():
            if r.space_type == "spare":
                continue
            monitored += 1
            counts[r.status] = counts.get(r.status, 0) + 1
            if self.is_offline(r):
                offline += 1
            zone = next((t for t in r.tags if t.startswith("A")), "其他")
            z = zones.setdefault(zone, {"total": 0, "available": 0, "occupied": 0})
            z["total"] += 1
            if r.status == "Available":
                z["available"] += 1
            elif r.status == "Occupied":
                z["occupied"] += 1
        return {
            "total": monitored,
            "counts": counts,
            "offline": offline,
            "zones": dict(sorted(zones.items())),
            "last_success_at": self.last_success_at,
            "consecutive_failures": self.consecutive_failures,
        }
