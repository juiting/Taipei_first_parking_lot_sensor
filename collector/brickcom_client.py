"""Brickcom 感測器管理平台資料源（電量 / RSSI）。

- 電量：GET 狀態頁（Flask HTML），一次回傳全部感測器，
  Occupancy 徽章「occupied 100%」中的百分比即電量；
  Remark 開頭「P001」-「P315」/「大客車N」對應車格名稱（其餘文字為廠商維運註記）。
- RSSI：每顆感測器每小時心跳一筆「[HB:680] p_http_err:0 (rssi:-83)」，
  由 debug 服務的 /api/history 取最近一筆解析。

平台網址由 .env 設定（BRICKCOM_STATUS_URL / BRICKCOM_DEBUG_BASE），不入版控。
"""
from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx

log = logging.getLogger(__name__)

_ROW_MAC_RE = re.compile(r"\?mac=([0-9A-Fa-f]+)")
_ROW_REMARK_RE = re.compile(r'class="remark-text">([^<]*)<')
_ROW_OCC_RE = re.compile(r'class="occupancy-badge[^"]*">\s*([^<]+?)\s*</span>', re.S)
_OCC_PARSE_RE = re.compile(r"(\w+?)\s*(\d+)%")
_ROW_SYNC_RE = re.compile(r'<small class="text-muted">([^<]+)<')
_RSSI_RE = re.compile(r"rssi:\s*(-?\d+)")


def stall_name_from_remark(remark: str) -> str | None:
    """Remark 開頭的編號 → 車格名稱（P001→001、大客車4*→大客車4）。"""
    m = re.match(r"^P(\d{1,3})", remark)
    if m:
        return f"{int(m.group(1)):03d}"
    m = re.search(r"大客車\s*(\d)", remark)
    if m:
        return f"大客車{m.group(1)}"
    return None


@dataclass
class SensorHealth:
    mac: str
    remark: str
    name: str | None          # 對應車格名稱；無法解析時為 None
    status: str | None        # occupied / empty（Brickcom 視角，僅參考）
    battery: int | None       # 電量 %
    last_sync: str | None


class BrickcomClient:
    def __init__(self, status_url: str, debug_base: str, timeout: float = 30.0):
        self.status_url = status_url
        self.debug_base = debug_base.rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)

    async def close(self) -> None:
        await self._client.aclose()

    async def fetch_status(self) -> list[SensorHealth]:
        """抓狀態頁解析全部感測器的電量。"""
        resp = await self._client.get(self.status_url)
        resp.raise_for_status()
        src = resp.text
        m = re.search(r"<tbody[^>]*>(.*?)</tbody>", src, re.S)
        if not m:
            raise RuntimeError("Brickcom 狀態頁找不到表格（tbody），頁面可能已改版")

        sensors: list[SensorHealth] = []
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.S):
            mac_m = _ROW_MAC_RE.search(row)
            if not mac_m:
                continue
            remark_m = _ROW_REMARK_RE.search(row)
            remark = html.unescape(remark_m.group(1)).strip() if remark_m else ""
            occ_m = _ROW_OCC_RE.search(row)
            status = battery = None
            if occ_m:
                occ = " ".join(occ_m.group(1).split())
                p = _OCC_PARSE_RE.match(occ)
                if p:
                    status = p.group(1)
                    battery = int(p.group(2))
            sync_m = _ROW_SYNC_RE.search(row)
            sensors.append(SensorHealth(
                mac=mac_m.group(1).upper(),
                remark=remark,
                name=stall_name_from_remark(remark),
                status=status,
                battery=battery,
                last_sync=sync_m.group(1).strip() if sync_m else None,
            ))
        if not sensors:
            raise RuntimeError("Brickcom 狀態頁解析結果為 0 筆，頁面可能已改版")
        return sensors

    async def fetch_latest_rssi(self, mac: str, hours: int = 26) -> tuple[int | None, str | None]:
        """從心跳歷史取最近一筆 RSSI。回傳 (rssi, 量測時間)；無資料回 (None, None)。"""
        end = datetime.now()
        start = end - timedelta(hours=hours)
        fmt = "%Y-%m-%dT%H:%M:%S"
        resp = await self._client.get(
            f"{self.debug_base}/api/history",
            params={
                "device_id": mac,
                "start_time": start.strftime(fmt),
                "end_time": end.strftime(fmt),
            },
        )
        resp.raise_for_status()
        latest_rssi: int | None = None
        latest_ts: str | None = None
        for item in resp.json():
            rm = _RSSI_RE.search(item.get("message", ""))
            if rm:
                latest_rssi = int(rm.group(1))
                latest_ts = item.get("timestamp")
        return latest_rssi, latest_ts
