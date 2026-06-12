"""Carin 地端 IoT 服務的網頁資料源。

該系統（ASP.NET Core Razor Pages）無對外查詢 JSON API，
故以「登入 + 解析主頁 HTML 表格」方式取得全部車格狀態：
  1. GET /Login 取 antiforgery token 與 cookie
  2. POST /Login（Username/Password/Culture/__RequestVerificationToken）→ 302 即成功
  3. GET / 一次回傳全部車格（目前 324 筆）
session 過期（302 轉回 /Login 或回應內含登入表單）時自動重新登入。
"""
from __future__ import annotations

import logging
import re

import httpx
from bs4 import BeautifulSoup

from .source_base import SpaceRecord, SpaceSource

log = logging.getLogger(__name__)

KNOWN_STATUSES = {"Available", "Allocated", "Occupied", "Maintenance"}
# IoT 設備欄格式："<EventSeq> <IMEI>"，例："362 27DD9326"
_DEVICE_RE = re.compile(r"(\d+)\s+([0-9A-Za-z]{6,})")
_TOKEN_RE = re.compile(
    r'name="__RequestVerificationToken"[^>]*value="([^"]+)"'
)


class CarinLoginError(RuntimeError):
    pass


class CarinParseError(RuntimeError):
    pass


class CarinSource(SpaceSource):
    def __init__(self, base_url: str, username: str, password: str, timeout: float = 20.0):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            follow_redirects=False,
        )
        self._logged_in = False

    async def close(self) -> None:
        await self._client.aclose()

    # ---------- 登入 ----------

    async def _login(self) -> None:
        resp = await self._client.get("/Login")
        resp.raise_for_status()
        m = _TOKEN_RE.search(resp.text)
        if not m:
            raise CarinLoginError("登入頁找不到 __RequestVerificationToken，頁面可能已改版")
        token = m.group(1)

        resp = await self._client.post(
            "/Login",
            data={
                "Culture": "zh-TW",
                "Username": self.username,
                "Password": self.password,
                "__RequestVerificationToken": token,
            },
        )
        # 成功：302 -> "/"；失敗：200 留在登入頁
        if resp.status_code != 302:
            raise CarinLoginError(f"Carin 登入失敗（HTTP {resp.status_code}），請檢查帳密")
        self._logged_in = True
        log.info("Carin 登入成功")

    # ---------- 取資料 ----------

    async def fetch_all(self) -> list[SpaceRecord]:
        if not self._logged_in:
            await self._login()

        html = await self._get_index()
        if html is None:  # session 過期，重登一次再試
            self._logged_in = False
            await self._login()
            html = await self._get_index()
            if html is None:
                raise CarinLoginError("重新登入後仍被導回登入頁")
        return self._parse_index(html)

    async def _get_index(self) -> str | None:
        """回傳主頁 HTML；若 session 失效回傳 None。"""
        resp = await self._client.get("/")
        if resp.status_code in (301, 302):
            return None
        resp.raise_for_status()
        if "login-container" in resp.text:
            return None
        return resp.text

    @staticmethod
    def _parse_index(html: str) -> list[SpaceRecord]:
        soup = BeautifulSoup(html, "html.parser")
        tbody = soup.find("tbody")
        if tbody is None:
            raise CarinParseError("主頁找不到車格表格（tbody），頁面可能已改版")

        records: list[SpaceRecord] = []
        for tr in tbody.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if len(cells) < 8:
                continue
            # 欄位順序：ID/名稱/備註/狀態變更/事件時間/最新回報/IoT設備/標籤/操作
            space_id, name, desc, status, event_time, heartbeat, device, tags = cells[:8]

            if status not in KNOWN_STATUSES:
                log.warning("未知狀態 %r（車格 %s），原樣保留", status, name)

            event_seq: int | None = None
            imei: str | None = None
            dm = _DEVICE_RE.search(device)
            if dm:
                event_seq = int(dm.group(1))
                imei = dm.group(2)

            records.append(
                SpaceRecord(
                    space_id=space_id,
                    name=name,
                    status=status,
                    event_time=event_time or None,
                    last_heartbeat=heartbeat or None,
                    imei=imei,
                    event_seq=event_seq,
                    tags=[t for t in tags.split() if t],
                    description=desc or None,
                )
            )

        if not records:
            raise CarinParseError("解析結果為 0 筆，頁面可能已改版")
        return records
