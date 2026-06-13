"""現場異常分類：把合併後的車格資料判讀成工程人員需處理的問題清單。

分類（一格可同時命中多項）：
  mac_mismatch  MAC 不符 / 缺失 —— Carin IMEI（人工維護的正本，串接現場剩餘車位顯示器）
                應等於 Brickcom MAC 前 8 碼；不符＝現場地磁被換過或維修但系統未同步
  offline       維修 / 斷線無訊號 —— Carin 維護狀態，或感測器超過門檻未回報
  low_battery   電量不足（< 80%）
  weak_signal   網路訊號不佳（RSSI 偏弱，會影響地磁封包傳遞）
  remark_flag   其他需注意 —— Brickcom 備註含維運關鍵字（待處理/沒電/失聯/封包遺失…）

未啟用 Brickcom（無電量/RSSI/MAC 來源）時，僅計算 Carin 可判斷的 offline 類，
其餘類別跳過以免整場誤報。
"""
from __future__ import annotations

import re
from datetime import datetime

LOW_BATTERY_THRESHOLD = 80      # 電量低於此值（%）視為不足
WEAK_RSSI_THRESHOLD = -95       # RSSI 低於此值（dBm）視為訊號不佳（NB-IoT 易掉封包）
RSSI_STALE_HOURS = 26           # 心跳每小時一筆，超過此時數無 RSSI 視為通訊中斷

# Brickcom 備註中代表「需維護」的關鍵字
_REMARK_KEYWORDS = [
    "待處理", "沒電", "失聯", "消失", "觀察", "評估", "更換",
    "packet_lost", "lost_packet", "packet lost", "issue", "error",
    "_IR", "IR_issue", "na??", "???", "chk",
]

ISSUE_META = {
    "mac_mismatch": {"label": "MAC 不符／缺失", "severity": 1,
                     "hint": "Carin 與 Brickcom 的 MAC 對應不上，現場設備可能已維修或更換，請核對"},
    "offline":      {"label": "維修／斷線無訊號", "severity": 2,
                     "hint": "感測器維護中或長時間未回報，需現場檢查"},
    "low_battery":  {"label": "電量不足（<80%）", "severity": 3,
                     "hint": "建議安排更換電池"},
    "weak_signal":  {"label": "網路訊號不佳", "severity": 4,
                     "hint": "RSSI 偏弱，可能影響地磁回報，留意收訊環境"},
    "remark_flag":  {"label": "其他待注意", "severity": 5,
                     "hint": "Brickcom 備註標記需處理事項"},
}
ISSUE_ORDER = ["mac_mismatch", "offline", "low_battery", "weak_signal", "remark_flag"]


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _remark_hits(remark: str | None) -> list[str]:
    if not remark:
        return []
    low = remark.lower()
    return [k for k in _REMARK_KEYWORDS if k.lower() in low]


def evaluate_space(s: dict, brickcom_enabled: bool, now: datetime | None = None) -> dict | None:
    """回傳該格的異常摘要；無異常回 None。"""
    now = now or datetime.now()
    flags: list[str] = []
    detail: dict[str, str] = {}

    imei = (s.get("imei") or "").upper()
    mac = (s.get("mac") or "").upper()
    battery = s.get("battery")
    rssi = s.get("rssi")
    remark = s.get("remark")

    # 1) MAC 不符 / 缺失（僅在有 Brickcom 來源時判斷）
    if brickcom_enabled:
        if not mac:
            flags.append("mac_mismatch")
            detail["mac_mismatch"] = "Brickcom 查無對應感測器（Remark 未標此車格編號）"
        elif not imei:
            flags.append("mac_mismatch")
            detail["mac_mismatch"] = f"Carin 未設定 MAC（Brickcom={mac}）"
        elif not mac.startswith(imei):
            flags.append("mac_mismatch")
            detail["mac_mismatch"] = f"Carin={imei} ≠ Brickcom前8碼={mac[:8]}"

    # 2) 維修 / 斷線無訊號
    if s.get("status") == "Maintenance":
        flags.append("offline")
        detail["offline"] = "Carin 狀態：維護"
    elif s.get("offline"):
        flags.append("offline")
        detail["offline"] = f"逾時未回報（最後回報 {s.get('last_heartbeat') or '—'}）"
    elif brickcom_enabled:
        rssi_at = _parse_dt(s.get("rssi_at"))
        if rssi is None and (rssi_at is None or (now - rssi_at).total_seconds() > RSSI_STALE_HOURS * 3600):
            flags.append("offline")
            detail["offline"] = "無近期心跳（RSSI 無資料）"

    # 3) 電量不足
    if battery is not None and battery < LOW_BATTERY_THRESHOLD:
        flags.append("low_battery")
        detail["low_battery"] = f"電量 {battery}%"

    # 4) 訊號不佳
    if rssi is not None and rssi < WEAK_RSSI_THRESHOLD:
        flags.append("weak_signal")
        detail["weak_signal"] = f"RSSI {rssi} dBm"

    # 5) 其他備註關鍵字
    hits = _remark_hits(remark)
    if hits:
        flags.append("remark_flag")
        detail["remark_flag"] = f"備註：{remark}"

    if not flags:
        return None
    primary = min(flags, key=lambda f: ISSUE_META[f]["severity"])
    return {
        "name": s["name"],
        "zone": s.get("zone"),
        "x": s.get("x"),
        "y": s.get("y"),
        "imei": imei or None,
        "mac": mac or None,
        "battery": battery,
        "rssi": rssi,
        "remark": remark,
        "flags": flags,
        "primary": primary,
        "detail": detail,
    }


def compute_issues(spaces: list[dict], brickcom_enabled: bool) -> dict:
    now = datetime.now()
    items = [r for s in spaces if (r := evaluate_space(s, brickcom_enabled, now))]

    def sort_key(it):
        name = it["name"]
        return (ISSUE_META[it["primary"]]["severity"], 0 if name.isdigit() else 1,
                int(name) if name.isdigit() else 0, name)

    items.sort(key=sort_key)

    by_category = {k: [] for k in ISSUE_ORDER}
    for it in items:
        for f in it["flags"]:
            by_category[f].append(it["name"])

    return {
        "generated_at": now.replace(microsecond=0).isoformat(sep=" "),
        "brickcom_enabled": brickcom_enabled,
        "total_issues": len(items),
        "categories": [
            {
                "key": k,
                "label": ISSUE_META[k]["label"],
                "hint": ISSUE_META[k]["hint"],
                "count": len(by_category[k]),
                "names": by_category[k],
            }
            for k in ISSUE_ORDER
        ],
        "items": items,
    }
