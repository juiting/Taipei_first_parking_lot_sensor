"""SQLite 存取層：現況快照 + 狀態變更歷史。"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

from .source_base import SpaceRecord

_SCHEMA = """
CREATE TABLE IF NOT EXISTS spaces (
    space_id    TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    display_no  INTEGER,
    space_type  TEXT NOT NULL,
    tags        TEXT,
    imei        TEXT,
    description TEXT,
    updated_at  TEXT
);
CREATE TABLE IF NOT EXISTS space_status (
    space_id       TEXT PRIMARY KEY REFERENCES spaces(space_id),
    status         TEXT NOT NULL,
    event_time     TEXT,
    last_heartbeat TEXT,
    event_seq      INTEGER,
    fetched_at     TEXT
);
CREATE TABLE IF NOT EXISTS status_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id    TEXT,
    name        TEXT,
    old_status  TEXT,
    new_status  TEXT,
    event_time  TEXT,
    detected_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_history_space ON status_history(space_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_history_name ON status_history(name, id DESC);
CREATE TABLE IF NOT EXISTS sensor_health (
    name       TEXT PRIMARY KEY,
    mac        TEXT,
    remark     TEXT,
    battery    INTEGER,
    battery_at TEXT,
    rssi       INTEGER,
    rssi_at    TEXT
);
"""


class GeomagDB:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def upsert_records(self, records: list[SpaceRecord], fetched_at: str) -> list[dict]:
        """寫入快照並回傳狀態變更清單 [{name, old_status, new_status, ...}]。"""
        cur = self._conn.cursor()
        prev = dict(cur.execute("SELECT space_id, status FROM space_status").fetchall())

        changes: list[dict] = []
        for r in records:
            cur.execute(
                """INSERT INTO spaces(space_id, name, display_no, space_type, tags, imei, description, updated_at)
                   VALUES(?,?,?,?,?,?,?,?)
                   ON CONFLICT(space_id) DO UPDATE SET
                     name=excluded.name, display_no=excluded.display_no,
                     space_type=excluded.space_type, tags=excluded.tags,
                     imei=excluded.imei, description=excluded.description,
                     updated_at=excluded.updated_at""",
                (r.space_id, r.name, r.display_no, r.space_type,
                 json.dumps(r.tags, ensure_ascii=False), r.imei, r.description, fetched_at),
            )
            cur.execute(
                """INSERT INTO space_status(space_id, status, event_time, last_heartbeat, event_seq, fetched_at)
                   VALUES(?,?,?,?,?,?)
                   ON CONFLICT(space_id) DO UPDATE SET
                     status=excluded.status, event_time=excluded.event_time,
                     last_heartbeat=excluded.last_heartbeat,
                     event_seq=excluded.event_seq, fetched_at=excluded.fetched_at""",
                (r.space_id, r.status, r.event_time, r.last_heartbeat, r.event_seq, fetched_at),
            )
            old = prev.get(r.space_id)
            if old is not None and old != r.status:
                cur.execute(
                    """INSERT INTO status_history(space_id, name, old_status, new_status, event_time, detected_at)
                       VALUES(?,?,?,?,?,?)""",
                    (r.space_id, r.name, old, r.status, r.event_time, fetched_at),
                )
                changes.append({
                    "space_id": r.space_id, "name": r.name,
                    "old_status": old, "new_status": r.status,
                    "event_time": r.event_time,
                })
        self._conn.commit()
        return changes

    def upsert_sensor_health(self, health: dict[str, dict]) -> None:
        cur = self._conn.cursor()
        for name, h in health.items():
            cur.execute(
                """INSERT INTO sensor_health(name, mac, remark, battery, battery_at, rssi, rssi_at)
                   VALUES(?,?,?,?,?,?,?)
                   ON CONFLICT(name) DO UPDATE SET
                     mac=excluded.mac, remark=excluded.remark,
                     battery=excluded.battery, battery_at=excluded.battery_at,
                     rssi=excluded.rssi, rssi_at=excluded.rssi_at""",
                (name, h.get("mac"), h.get("remark"), h.get("battery"),
                 h.get("battery_at"), h.get("rssi"), h.get("rssi_at")),
            )
        self._conn.commit()

    def load_sensor_health(self) -> dict[str, dict]:
        cur = self._conn.execute(
            "SELECT name, mac, remark, battery, battery_at, rssi, rssi_at FROM sensor_health")
        cols = [c[0] for c in cur.description]
        return {row[0]: dict(zip(cols, row)) for row in cur.fetchall()}

    def get_history(self, name: str, limit: int = 50) -> list[dict]:
        cur = self._conn.execute(
            """SELECT name, old_status, new_status, event_time, detected_at
               FROM status_history WHERE name=? ORDER BY id DESC LIMIT ?""",
            (name, limit),
        )
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat(sep=" ")
