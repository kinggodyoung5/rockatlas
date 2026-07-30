@echo off
chcp 65001 > nul
title ROCK ATLAS 프로젝트 백업
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-local-backup.ps1"
echo.
pause
