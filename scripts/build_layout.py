"""把參數化的「排定義」(layout_source.json) 展開成每個車格的座標 (layout.json)，
並輸出一張校對用 SVG，讓人工對照平面圖確認編號與位置。

座標系：以公尺為單位，y 向下（與平面圖視覺一致，方便對照）。
  - 每個 row 定義一排車格：origin 為第一格中心，heading 為這排延伸方向（度，0=+x 右、90=+y 下）。
  - 每格沿 heading 佔 pitch（通常等於車格寬），垂直 heading 方向佔 depth（車格深）。
  - facing 為車頭朝向（度），用於 3D 擺放車輛模型。

用法：
  .venv/bin/python scripts/build_layout.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "layout" / "layout_source.json"
OUT = ROOT / "data" / "layout" / "layout.json"
PREVIEW = ROOT / "data" / "layout" / "layout_preview.svg"

ZONE_COLORS = {
    "A0": "#60a5fa", "A1": "#34d399", "A2": "#fbbf24", "A3": "#f472b6",
    "A4": "#a78bfa", "A5": "#22d3ee", "A6": "#fb923c", "A7": "#4ade80",
    "A": "#94a3b8", "bus": "#ef4444", "edge": "#cbd5e1",
}


def _name_for(num, name_tpl: str | None) -> str:
    if name_tpl:
        return name_tpl.format(n=num)
    return f"{int(num):03d}"


def expand_row(row: dict, defaults: dict) -> list[dict]:
    ox, oy = row["origin"]
    heading = math.radians(row.get("heading", 0))
    pitch = row.get("pitch", defaults["space_w"])
    w = row.get("w", defaults["space_w"])
    d = row.get("d", defaults["space_d"])
    facing = row.get("facing", row.get("heading", 0) + 90)
    space_type = row.get("type", "car")
    zone = row.get("zone")
    name_tpl = row.get("name_tpl")

    # 取得編號序列
    if "list" in row:
        numbers = row["list"]
    else:
        rng = row["range"]
        a, b = rng[0], rng[1]
        step = 1 if b >= a else -1
        numbers = list(range(a, b + step, step))

    dx, dy = math.cos(heading), math.sin(heading)
    spaces = []
    for i, num in enumerate(numbers):
        cx = ox + dx * pitch * i
        cy = oy + dy * pitch * i
        spaces.append({
            "name": _name_for(num, name_tpl),
            "no": num if isinstance(num, int) else None,
            "x": round(cx, 2),
            "y": round(cy, 2),
            "rot": facing % 360,
            "w": w,
            "d": d,
            "type": space_type,
            "zone": zone,
        })
    return spaces


def build() -> dict:
    src = json.loads(SRC.read_text(encoding="utf-8"))
    defaults = {
        "space_w": src["meta"].get("space_w", 2.5),
        "space_d": src["meta"].get("space_d", 5.5),
    }
    spaces: list[dict] = []
    for row in src["rows"]:
        spaces.extend(expand_row(row, defaults))

    # 重複編號檢查
    seen: dict[str, int] = {}
    dups = []
    for s in spaces:
        seen[s["name"]] = seen.get(s["name"], 0) + 1
    dups = [n for n, c in seen.items() if c > 1]

    xs = [s["x"] for s in spaces]
    ys = [s["y"] for s in spaces]
    bounds = {"minx": min(xs), "maxx": max(xs), "miny": min(ys), "maxy": max(ys)}

    layout = {
        "meta": {
            **src["meta"],
            "count": len(spaces),
            "bounds": bounds,
            "duplicates": dups,
        },
        "spaces": spaces,
    }
    return layout


def render_preview(layout: dict) -> str:
    b = layout["meta"]["bounds"]
    pad = 4
    scale = 10  # px per meter
    W = (b["maxx"] - b["minx"] + 2 * pad) * scale
    H = (b["maxy"] - b["miny"] + 2 * pad) * scale

    def px(x):
        return round((x - b["minx"] + pad) * scale, 1)

    def py(y):
        return round((y - b["miny"] + pad) * scale, 1)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" '
        f'viewBox="0 0 {W:.0f} {H:.0f}" font-family="sans-serif">',
        f'<rect width="{W:.0f}" height="{H:.0f}" fill="#0f172a"/>',
    ]
    for s in layout["spaces"]:
        color = ZONE_COLORS.get(s["zone"]) or (ZONE_COLORS["bus"] if s["type"] == "bus" else "#475569")
        wpx = s["w"] * scale
        dpx = s["d"] * scale
        # rot: 0 表示車頭 +x，車格深沿 x；簡化：以 facing 是否接近水平決定矩形長邊
        horizontal = abs(math.cos(math.radians(s["rot"]))) > 0.5
        rw, rh = (dpx, wpx) if horizontal else (wpx, dpx)
        x = px(s["x"]) - rw / 2
        y = py(s["y"]) - rh / 2
        parts.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
            f'fill="{color}" fill-opacity="0.25" stroke="{color}" stroke-width="1"/>'
        )
        parts.append(
            f'<text x="{px(s["x"]):.1f}" y="{py(s["y"]) + 3:.1f}" fill="#e2e8f0" '
            f'font-size="9" text-anchor="middle">{s["name"]}</text>'
        )
    parts.append("</svg>")
    return "\n".join(parts)


def main() -> None:
    layout = build()
    OUT.write_text(json.dumps(layout, ensure_ascii=False, indent=1), encoding="utf-8")
    PREVIEW.write_text(render_preview(layout), encoding="utf-8")
    m = layout["meta"]
    print(f"產出 {m['count']} 格 → {OUT.relative_to(ROOT)}")
    print(f"範圍: x[{m['bounds']['minx']:.1f},{m['bounds']['maxx']:.1f}] "
          f"y[{m['bounds']['miny']:.1f},{m['bounds']['maxy']:.1f}] (公尺)")
    if m["duplicates"]:
        print(f"⚠ 重複編號: {m['duplicates']}")
    print(f"校對圖 → {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
