@echo off
REM Ojou-sama Live2D Launcher
REM Strategy: walk UP from this bat's directory, then DOWN, looking for
REM the first folder that contains BOTH index.html AND game.js.
REM That folder is the real project root. Then start an HTTP server there.

setlocal

set "GAME_DIR="
set "FOUND="
set "CAND=%~dp0"

REM Strip trailing backslash for cleaner path handling
if "%CAND:~-1%"=="\" set "CAND=%CAND:~0,-1%"

REM --- Phase 1: check the bat's own directory and walk up to drive root ---
:phase_up
if exist "%CAND%\index.html" if exist "%CAND%\game.js" (
    set "GAME_DIR=%CAND%"
    goto :found
)
REM If we're at a drive root (X:\), stop walking up
for %%D in ("%CAND%") do set "PARENT=%%~dpD"
if "%PARENT%"=="%CAND%" goto :phase_down
if "%PARENT:~-1%"=="\" set "PARENT=%PARENT:~0,-1%"
set "CAND=%PARENT%"
goto :phase_up

REM --- Phase 2: walk down from the bat's directory, prefer closest match ---
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
    echo ERROR: Could not locate a folder containing both index.html and game.js.
    echo Searched near: %~dp0
    echo.
    pause
    goto :eof
)

REM Strip trailing backslash
if "%GAME_DIR:~-1%"=="\" set "GAME_DIR=%GAME_DIR:~0,-1%"

cd /d "%GAME_DIR%"

set "PORT=8000"
set "URL=http://localhost:%PORT%/index.html"

where python >nul 2>nul
if %ERRORLEVEL%==0 (
    echo.
    echo Ojou-sama Live2D Launcher ^(Python^)
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
    echo Ojou-sama Live2D Launcher ^(Node^)
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
