@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   ★ Mineradio - 沉浸式音乐播放器
echo   ────────────────────────────────
echo.
call npm start
pause
