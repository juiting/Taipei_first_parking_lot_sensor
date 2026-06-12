@echo off
rem P1 Parking Geomag Monitor - Updater (downloads latest GitHub Release)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update.ps1"
pause
