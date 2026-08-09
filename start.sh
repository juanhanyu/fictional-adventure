#!/usr/bin/env bash
# 转生千金 - 一键启动 (macOS / Linux)
# 用法：双击或在终端执行 `./start.sh`
# 关闭：Ctrl+C

set -e
cd "$(dirname "$0")"

PORT=8000
URL="http://localhost:${PORT}/index.html"

echo "============================================================"
echo "  转生千金 - Live2D 启动器"
echo "  端口: ${PORT}  入口: ${URL}"
echo "  按 Ctrl+C 停止服务器"
echo "============================================================"

# 探测 Python / Node
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v python >/dev/null 2>&1; then
    PY=python
elif command -v npx >/dev/null 2>&1; then
    PY=""
else
    echo "[错误] 需要 Python 或 Node.js (npx) 其一。"
    echo "  - Python: https://www.python.org/downloads/"
    echo "  - Node.js: https://nodejs.org/"
    exit 1
fi

# 异步打开浏览器（不阻塞）
if [ -n "$BROWSER" ] || command -v xdg-open >/dev/null 2>&1 || command -v open >/dev/null 2>&1; then
    (
        sleep 1
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$URL" >/dev/null 2>&1
        elif command -v open >/dev/null 2>&1; then
            open "$URL" >/dev/null 2>&1
        fi
    ) &
fi

if [ -n "$PY" ]; then
    exec $PY -m http.server "$PORT"
else
    exec npx --yes http-server -p "$PORT" -c-1
fi
