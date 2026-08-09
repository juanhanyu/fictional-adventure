@echo off
REM DEBUG VERSION: does NOT call python, just shows what the bat sees.
REM Useful to diagnose "flash and disappear" issues.

setlocal EnableExtensions EnableDelayedExpansion

echo.
echo ============================================================
echo  DEBUG START.BAT
echo  This version does not start any server, just shows info.
echo ============================================================
echo.
echo [%~dp0]
echo.
echo --- where is python? ---
where python
echo.
echo --- where is py launcher? ---
where py
echo.
echo --- where is npx? ---
where npx
echo.
echo --- dir of this folder ---
dir /b
echo.
echo --- looking for index.html nearby (recursive) ---
dir /s /b /a-d index.html
echo.
echo --- looking for game.js nearby (recursive) ---
dir /s /b /a-d game.js
echo.
echo ============================================================
echo  DONE. Press any key to close.
echo ============================================================
pause
