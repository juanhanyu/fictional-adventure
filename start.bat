@echo off
REM Ojou-sama Live2D Launcher (final)
REM Finds the project root (folder with both index.html and game.js),
REM starts a local HTTP server there, and opens the browser.
REM All branches pause on error so the cmd window stays open.

setlocal EnableExtensions EnableDelayedExpansion

set "GAME_DIR="
set "FOUND="
set "CAND=%~dp0"

REM strip trailing backslash
if "%CAND:~-1%"=="\" set "CAND=%CAND:~0,-1%"

REM --- Phase 1: walk UP from this bat's directory ---
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

REM --- Phase 2: walk DOWN recursively from the bat's directory ---
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
    echo  ERROR: No folder containing index.html + game.js found
    echo  Search started at: %~dp0
    echo  Tip: keep start.bat anywhere inside or above the project.
    echo ============================================================
    echo.
    pause
    goto :eof
)

if "%GAME_DIR:~-1%"=="\" set "GAME_DIR=%GAME_DIR:~0,-1%"
cd /d "%GAME_DIR%"

set "PORT=8000"
set "URL=http://localhost:%PORT%/index.html"

echo.
echo ============================================================
echo  Project: !GAME_DIR!
echo  Server:  !URL!
echo ============================================================
echo.

REM Open browser via cmd /c start (more reliable than bare 'start')
REM (the empty "" avoids treating !URL! as a window title)
cmd /c start "" "!URL!"

REM Prefer Python; fall back to npx http-server
where python >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    python -m http.server %PORT%
    goto :after
)
where py >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    py -3 -m http.server %PORT%
    goto :after
)
where npx >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    npx --yes http-server -p %PORT% -c-1
    goto :after
)

echo.
echo ERROR: Need Python or Node.js installed.
echo   Python: https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.
pause
goto :eof

:after
echo.
echo Server stopped. Press any key to close this window.
pause ^>nul

endlocal
