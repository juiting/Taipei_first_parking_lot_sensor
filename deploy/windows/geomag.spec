# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec：打包第一停車場監控為 Windows onedir 應用。

用法（於 repo 根目錄）：pyinstaller deploy/windows/geomag.spec --noconfirm
前置：web/ 需先 npm run build 產出 web/dist
"""
from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent.parent  # deploy/windows -> repo 根目錄

a = Analysis(
    [str(Path(SPECPATH) / "launcher.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        (str(ROOT / "web" / "dist"), "web_dist"),  # 前端靜態檔
    ],
    hiddenimports=[
        # uvicorn 以字串動態載入的模組，PyInstaller 靜態分析抓不到
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "websockets",
        "websockets.legacy",
        "websockets.legacy.server",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="GeomagMonitor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,  # 背景常駐，無主控台視窗；日誌見 logs/geomag.log
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="GeomagMonitor",
)
