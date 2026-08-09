@echo off
REM Ojou-sama Live2D Launcher
REM Find a folder containing both index.html AND game.js, start a local
REM HTTP server there, and open the browser. Designed to NOT silently fail.

setlocal EnableExtensions EnableDelayedExpansion

set "GAME_DIR="
set "FOUND="
set "CAND=%~dp0"

if "%CAND:~-1%"=="\" set "CAND=%CAND:~0,-1%"

REM --- Phase 1: walk up from this bat's directory ---
:phase_up
if exist "%CAND%\index.html" (
    if exist "%CAND%\game.js" (
        set "GAME_DIR=%CAND%"
        goto :found
    )
)
for %%D in ("%CAND%") do set "PARENT=%%~dpD"
if "%PARENT%"=="%CAND%" goto :phase_down
if "%PARENT:~-1%"=="\" set "PARENT=%PARENT:~0,-1%"
set "CAND=%PARENT%"
goto :phase_up

REM --- Phase 2: walk down (recursive) ---
:phase_down
for /f "delims=" %%I in ('dir /s /b /a-d "index.html" 2^>nul') do (
    if not defined FOUND (
        if exist "%%~dpIgame.js" (
            set "GAME_DIR=%%~dpI"
            set "FOUND=1"
        )
    )
)

:found
if not defined GAME_DIR (
    echo.
    echo ============================================================
    echo  ERROR: Could not find a folder with index.html + game.js
    echo  Searched near: %~dp0
    echo ============================================================
    echo.
    echo Press any key to close...
    pause ^>nul
    goto :eof
)

if "%GAME_DIR:~-1%"=="\" set "GAME_DIR=%GAME_DIR:~0,-1%"

cd /d "%GAME_DIR%"

set "PORT=8000"
set "URL=http://localhost:%PORT%/index.html"

echo.
echo ============================================================
echo  Found project: !GAME_DIR!
echo  Starting server on: !URL!
echo  Close this window or press Ctrl+C to stop.
echo ============================================================
echo.

REM Open browser first (so the user sees it appear ASAP)
start "" "!URL!"

where python >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    python -m http.server %PORT%
    goto :after_server
)

where py >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    py -3 -m http.server %PORT%
    goto :after_server
)

where npx >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    npx --yes http-server -p %PORT% -c-1
    goto :after_server
)

echo.
echo ERROR: Need Python or Node.js installed.
echo   Python: https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.
pause

:after_server
echo.
echo Server stopped. Press any key to close...
pause ^>nul

endlocal
