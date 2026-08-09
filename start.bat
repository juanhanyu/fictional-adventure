@echo off
REM 转生千金 - 一键启动 (Windows)
REM 双击此文件即可：自动起本地 HTTP server + 自动开浏览器。
REM 关闭时请关闭黑色 cmd 窗口（Ctrl+C 或直接叉掉）。

setlocal
cd /d "%~dp0"

set PORT=8000
set URL=http://localhost:%PORT%/index.html

REM 探测 Python：优先 python3，再 python，都没有则用 npx http-server
set HAS_PYTHON=0
where python >nul 2>nul && set HAS_PYTHON=1
if %HAS_PYTHON%==0 (
    where py >nul 2>nul && set HAS_PYTHON=1
)

if %HAS_PYTHON%==1 (
    echo.
    echo ============================================================
    echo   转生千金 - Live2D 启动器 (Python)
    echo   端口: %PORT%  入口: %URL%
    echo   关闭此窗口或按 Ctrl+C 即可停止服务器
    echo ============================================================
    echo.
    REM 等 1 秒再开浏览器，避免服务器还没起好浏览器就 502
    start "" "%URL%"
    timeout /t 1 /nobreak >nul
    python -m http.server %PORT%
) else (
    REM 退化：用 Node 的 npx http-server
    where npx >nul 2>nul
    if errorlevel 1 (
        echo.
        echo [错误] 找不到 Python 也没装 Node.js (npx)。
        echo         请安装其一：
        echo           - Python: https://www.python.org/downloads/
        echo           - Node.js: https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
    echo.
    echo ============================================================
    echo   转生千金 - Live2D 启动器 (Node http-server)
    echo   端口: %PORT%  入口: %URL%
    echo ============================================================
    echo.
    start "" "%URL%"
    timeout /t 2 /nobreak >nul
    npx --yes http-server -p %PORT% -c-1
)

endlocal
