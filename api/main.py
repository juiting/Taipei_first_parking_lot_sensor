"""FastAPI 後端：合併 layout（位置）與 collector 現況，提供 REST + WebSocket。

啟動時於 lifespan 內啟動 poller（背景輪詢 Carin），WebSocket 訂閱 poller 變更即時推播。
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from collector import config
from collector.carin_client import CarinSource
from collector.db import GeomagDB
from collector.poller import Poller

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("geomag.api")

ROOT = Path(__file__).resolve().parent.parent
# PyInstaller 打包時前端由 add-data 塞進 bundle（web_dist），開發時用 web/dist
if getattr(sys, "frozen", False):
    WEB_DIST = Path(getattr(sys, "_MEIPASS", ROOT)) / "web_dist"
else:
    WEB_DIST = ROOT / "web" / "dist"


def load_layout() -> dict:
    if not config.LAYOUT_PATH.exists():
        log.warning("找不到 layout.json，請先執行 scripts/build_layout.py")
        return {"meta": {}, "spaces": []}
    return json.loads(config.LAYOUT_PATH.read_text(encoding="utf-8"))


class WSManager:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, message: dict) -> None:
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


@asynccontextmanager
async def lifespan(app: FastAPI):
    config.validate_carin_config()
    source = CarinSource(config.CARIN_BASE_URL, config.CARIN_USERNAME, config.CARIN_PASSWORD)
    db = GeomagDB(config.DB_PATH)
    poller = Poller(source, db)
    ws_manager = WSManager()

    async def on_update(message: dict) -> None:
        await ws_manager.broadcast(message)

    poller.subscribe(on_update)

    app.state.poller = poller
    app.state.db = db
    app.state.ws = ws_manager
    app.state.layout = load_layout()
    app.state.layout_index = {s["name"]: s for s in app.state.layout["spaces"]}

    # 先抓一次再進迴圈，確保啟動即有資料
    try:
        await poller.poll_once()
    except Exception:
        log.exception("初次輪詢失敗，仍啟動服務並持續重試")
    poller.start()

    try:
        yield
    finally:
        await poller.stop()
        db.close()


app = FastAPI(title="第一停車場地磁 3D 監控 API", lifespan=lifespan)


def _merge_spaces() -> list[dict]:
    """layout（位置）left-join collector（現況）。"""
    poller: Poller = app.state.poller
    by_name = {r.name: r for r in poller.snapshot.values()}
    out = []
    for s in app.state.layout["spaces"]:
        rec = by_name.get(s["name"])
        merged = dict(s)
        if rec:
            merged.update({
                "status": rec.status,
                "offline": poller.is_offline(rec),
                "event_time": rec.event_time,
                "last_heartbeat": rec.last_heartbeat,
                "imei": rec.imei,
                "tags": rec.tags,
            })
        else:
            merged.update({"status": "Unknown", "offline": True})
        out.append(merged)
    return out


@app.get("/api/layout")
async def get_layout():
    return app.state.layout


@app.get("/api/spaces")
async def get_spaces():
    return {
        "fetched_at": app.state.poller.last_success_at,
        "spaces": _merge_spaces(),
    }


@app.get("/api/summary")
async def get_summary():
    return app.state.poller.build_summary()


@app.get("/api/spaces/{name}/history")
async def get_history(name: str, limit: int = 50):
    return {"name": name, "history": app.state.db.get_history(name, limit)}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    manager: WSManager = app.state.ws
    await manager.connect(ws)
    # 連上立即送目前全量現況
    await ws.send_json({
        "type": "snapshot",
        "fetched_at": app.state.poller.last_success_at,
        "spaces": _merge_spaces(),
        "summary": app.state.poller.build_summary(),
    })
    try:
        while True:
            await ws.receive_text()  # 保持連線；前端不需傳送內容
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


# 前端靜態檔（build 後存在才掛載）
if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="web")
else:
    @app.get("/")
    async def root():
        return JSONResponse({
            "message": "前端尚未 build。請於 web/ 執行 npm install && npm run build，或開發時用 npm run dev。",
            "api": ["/api/layout", "/api/spaces", "/api/summary", "/ws"],
        })
