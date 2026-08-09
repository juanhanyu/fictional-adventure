@echo off
REM Ojou-sama Live2D Launcher
REM Strategy: find the directory that contains BOTH index.html AND game.js
REM (i.e. the real project root), then start a local HTTP server there
REM and open the browser. No manual cd required.

setlocal

set "START_DIR=%~dp0"

REM Check if index.html and game.js both live right next to this bat
if exist "%START_DIR%index.html" if exist "%START_DIR%game.js" (
    set "GAME_DIR=%START_DIR%"
    goto :found
)

REM Otherwise walk subdirs: prefer directories that contain BOTH files
for /f "delims=" %%I in ('dir /s /b /a-d "index.html" 2^>nul') do (
    if not defined FOUND_INDEX (
        if exist "%%~dpIgame.js" (
            set "GAME_DIR=%%~dpI"
            set "FOUND_INDEX=1"
        )
    )
)

REM If still nothing, fall back to first index.html we can find
if not defined FOUND_INDEX (
    for /f "delims=" %%I in ('dir /s /b /a-d "index.html" 2^>nul') do (
        if not defined FOUND_INDEX (
            set "GAME_DIR=%%~dpI"
            set "FOUND_INDEX=1"
        )
    )
)

:found
if not defined FOUND_INDEX (
    echo.
    echo ERROR: No index.html found under %START_DIR%
    echo Tip: make sure you extracted the project ZIP and the bat is
    echo      somewhere inside or above the project folder.
    echo.
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
