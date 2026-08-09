@echo off
REM Ojou-sama Live2D Launcher
REM Auto-finds index.html anywhere in the project tree, then starts a
REM local HTTP server and opens the browser. No manual cd required.
REM Just double-click.

setlocal

REM Walk subdirs from this bat's location, find first index.html
set "GAME_DIR=%~dp0"
for /f "delims=" %%I in ('dir /s /b /a-d "index.html" 2^>nul') do (
    if not defined FOUND_INDEX (
        set "GAME_DIR=%%~dpI"
        set "FOUND_INDEX=1"
    )
)

if not defined FOUND_INDEX (
    echo ERROR: No index.html found under %~dp0
    pause
    goto :eof
)

cd /d "%GAME_DIR%"

set "PORT=8000"
set "URL=http://localhost:%PORT%/index.html"

where python >nul 2>nul
if %ERRORLEVEL%==0 (
    echo.
    echo Ojou-sama Live2D Launcher (Python)
    echo Game dir: %GAME_DIR%
    echo URL: %URL%
    echo Close this window or Ctrl+C to stop the server.
    echo.
    start "" "%URL%"
    python -m http.server %PORT%
    goto :eof
)

where npx >nul 2>nul
if %ERRORLEVEL%==0 (
    echo.
    echo Ojou-sama Live2D Launcher (Node)
    echo Game dir: %GAME_DIR%
    echo URL: %URL%
    echo.
    start "" "%URL%"
    npx --yes http-server -p %PORT% -c-1
    goto :eof
)

echo.
echo ERROR: Need Python or Node.js installed.
echo   Python: https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.
pause

endlocal
