"""資料源抽象介面：未來廠商若提供正式 API，只需新增一個 SpaceSource 實作。"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SpaceRecord:
    """單一車格的正規化即時資料。"""

    space_id: str            # Carin 系統 GUID
    name: str                # 車格名稱：'001'-'315'、'大客車1'-'大客車4'、'New'
    status: str              # Available / Allocated / Occupied / Maintenance
    event_time: str | None   # 狀態最後變更時間（ISO, 場地當地時間）
    last_heartbeat: str | None  # 感測器最後回報時間（ISO）
    imei: str | None
    event_seq: int | None
    tags: list[str] = field(default_factory=list)
    description: str | None = None

    @property
    def display_no(self) -> int | None:
        """純數字編號（001→1），非數字名稱回傳 None。"""
        return int(self.name) if self.name.isdigit() else None

    @property
    def space_type(self) -> str:
        if self.name.isdigit():
            return "car"
        if self.name.startswith("大客車"):
            return "bus"
        return "spare"


class SpaceSource(ABC):
    """即時車格狀態來源。"""

    @abstractmethod
    async def fetch_all(self) -> list[SpaceRecord]:
        """取得全部車格目前狀態；失敗時拋出例外由 poller 處理。"""

    async def close(self) -> None:  # noqa: B027
        """釋放連線資源（預設無動作）。"""
