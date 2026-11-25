#!/usr/bin/env python3
"""防卡死 / 零端口冲突安全执行器（纯 Python 3.12 标准库）。

核心能力：
1. `--serve DIR`：在 daemon 线程中起临时静态 HTTP 服务（默认 `127.0.0.1:0` 自动分配空闲端口），
   向子进程注入 `LOCAL_SERVER_URL` / `LOCAL_SERVER_PORT`，自动替换 `{URL}` / `{PORT}`，退出即关服。
2. 进程组防孤儿 & 防 stdin 死等：`stdin=DEVNULL`、`close_fds=True`、`start_new_session=True`；
   无论正常退出、硬超时还是收到 SIGTERM/SIGINT，均在 `finally` 中清理整棵进程树（SIGTERM -> grace -> SIGKILL）。

CLI 示例：
    python3 tools/run_safe.py --serve . --timeout 180 -- python3 verify.py {URL}
    python3 tools/run_safe.py --timeout 120 -- node tests/run.js

Python 模块导入示例：
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
    from run_safe import temp_http_server

    with temp_http_server(".") as url:
        print("serving:", url)
"""

from __future__ import annotations

import argparse
import contextlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
from typing import Iterator, Sequence
from urllib.parse import urlsplit

__all__ = ["temp_http_server", "run_safe"]


class _SignalInterrupted(BaseException):
    def __init__(self, signum: int) -> None:
        super().__init__(f"interrupted by signal {signum}")
        self.signum = signum


class _SafeHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    quiet = True

    def handle_error(self, request, client_address) -> None:
        if self.quiet and sys.exc_info()[0] in (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        super().handle_error(request, client_address)


@contextlib.contextmanager
def temp_http_server(
    root: str | os.PathLike[str] = ".",
    host: str = "127.0.0.1",
    port: int = 0,
    quiet: bool = True,
) -> Iterator[str]:
    """在 daemon 线程内起临时静态 HTTP 服务，返回 URL，退出 with 块即安全关闭。"""
    root_path = Path(root).resolve()
    if not root_path.is_dir():
        raise NotADirectoryError(f"serve directory not found: {root_path}")

    class _Handler(SimpleHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:  # noqa: A002
            if not quiet:
                super().log_message(format, *args)

    server = _SafeHTTPServer((host, port), partial(_Handler, directory=str(root_path)))
    server.quiet = quiet
    actual_port = server.server_address[1]
    url = f"http://[{host}]:{actual_port}" if ":" in host else f"http://{host}:{actual_port}"
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True)
    thread.start()
    try:
        yield url
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2.0)


def _killpg_safe(pgid: int, sig: int) -> bool:
    try:
        os.killpg(pgid, sig)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def _wait_pgid_gone(proc: subprocess.Popen, pgid: int, wait_s: float, step: float = 0.05) -> bool:
    deadline = time.monotonic() + max(0.0, wait_s)
    while time.monotonic() < deadline:
        proc.poll()
        if not _killpg_safe(pgid, 0):
            return True
        time.sleep(step)
    proc.poll()
    return not _killpg_safe(pgid, 0)


def _terminate_process_tree(proc: subprocess.Popen, grace: float) -> None:
    """清剿子进程所属整棵进程树（SIGTERM -> grace 秒 -> SIGKILL）。"""
    proc.poll()
    if os.name == "posix" and hasattr(os, "killpg"):
        pgid = proc.pid
        if not _killpg_safe(pgid, signal.SIGTERM) or _wait_pgid_gone(proc, pgid, grace):
            return
        _killpg_safe(pgid, signal.SIGKILL)
        _wait_pgid_gone(proc, pgid, 1.0, step=0.02)
        return

    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=max(0.0, grace))
        except subprocess.TimeoutExpired:
            proc.kill()
            with contextlib.suppress(subprocess.TimeoutExpired):
                proc.wait(timeout=2.0)


def run_safe(
    cmd: Sequence[str], *, serve: str | None = None, host: str = "127.0.0.1", port: int = 0,
    timeout: float = 120.0, grace: float = 3.0, cwd: str | None = None, quiet_server: bool = True,
) -> int:
    """在硬超时、独立进程组与可选临时 HTTP 服务保护下运行外部命令。"""
    if not cmd or timeout <= 0 or grace < 0:
        print("[run_safe] error: invalid command, --timeout (>0), or --grace (>=0)", file=sys.stderr)
        return 2

    env, resolved_cmd = os.environ.copy(), list(cmd)
    is_main = threading.current_thread() is threading.main_thread()
    prev_handlers: dict[int, object] = {}
    if is_main:
        def _on_signal(signum: int, _frame) -> None:
            raise _SignalInterrupted(signum)
        for sig in (signal.SIGINT, signal.SIGTERM):
            prev_handlers[sig] = signal.getsignal(sig)
            signal.signal(sig, _on_signal)

    exit_code = 1
    try:
        with contextlib.ExitStack() as stack:
            if serve is not None:
                url = stack.enter_context(temp_http_server(serve, host=host, port=port, quiet=quiet_server))
                actual_port = str(urlsplit(url).port)
                env["LOCAL_SERVER_URL"], env["LOCAL_SERVER_PORT"] = url, actual_port
                resolved_cmd = [a.replace("{URL}", url).replace("{PORT}", actual_port) for a in resolved_cmd]

            sys.stdout.flush()
            sys.stderr.flush()
            popen_kw: dict[str, object] = {"stdin": subprocess.DEVNULL, "close_fds": True, "cwd": cwd, "env": env}
            if os.name == "posix":
                popen_kw["start_new_session"] = True
            try:
                proc = subprocess.Popen(resolved_cmd, **popen_kw)
            except (FileNotFoundError, PermissionError) as exc:
                print(f"[run_safe] failed to launch {resolved_cmd[0]}: {exc}", file=sys.stderr)
                return 127 if isinstance(exc, FileNotFoundError) else 126

            pgid, timed_out = proc.pid, False
            try:
                exit_code = proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out, exit_code = True, 124
            except _SignalInterrupted as exc:
                exit_code = 128 + exc.signum
            finally:
                if is_main:
                    for sig in (signal.SIGINT, signal.SIGTERM):
                        signal.signal(sig, signal.SIG_IGN)
                _terminate_process_tree(proc, grace=grace)
                if timed_out:
                    print(f"[run_safe] TIMEOUT after {timeout:g}s — terminated process group {pgid}", file=sys.stderr, flush=True)
    except NotADirectoryError as exc:
        print(f"[run_safe] error: {exc}", file=sys.stderr)
        return 2
    except _SignalInterrupted as exc:
        exit_code = 128 + exc.signum
    finally:
        if is_main:
            for sig, handler in prev_handlers.items():
                signal.signal(sig, handler)
    return exit_code


def main(argv: Sequence[str] | None = None) -> int:
    raw = list(sys.argv[1:] if argv is None else argv)
    parser = argparse.ArgumentParser(
        prog="run_safe.py",
        description="防卡死 / 零端口冲突安全执行器（独立进程组超时清理 + 可选临时静态 HTTP 服务）。",
        usage="%(prog)s [--serve DIR] [--host 127.0.0.1] [--port 0] [--timeout 120] "
        "[--grace 3] [--cwd DIR] [--quiet-server|--verbose-server] -- <cmd...>",
    )
    parser.add_argument("--serve", metavar="DIR", default=None, help="为指定目录启动临时静态 HTTP 服务")
    parser.add_argument("--host", default="127.0.0.1", help="HTTP 服务绑定地址（默认 127.0.0.1）")
    parser.add_argument("--port", type=int, default=0, help="HTTP 服务端口（默认 0 自动分配空闲端口）")
    parser.add_argument("--timeout", type=float, default=120.0, help="命令硬超时秒数（默认 120）")
    parser.add_argument("--grace", type=float, default=3.0, help="SIGTERM 后宽限秒数（默认 3）")
    parser.add_argument("--cwd", metavar="DIR", default=None, help="子进程工作目录")
    parser.add_argument("--quiet-server", dest="quiet_server", action="store_true", default=True, help="静默 HTTP 日志（默认）")
    parser.add_argument("--verbose-server", dest="quiet_server", action="store_false", help="输出 HTTP 访问日志")
    if "--" in raw:
        sep = raw.index("--")
        ns, cmd = parser.parse_args(raw[:sep]), raw[sep + 1 :]
    else:
        parser.add_argument("cmd", nargs=argparse.REMAINDER, help="要执行的命令及参数")
        ns = parser.parse_args(raw)
        cmd = list(ns.cmd[1:] if ns.cmd and ns.cmd[0] == "--" else ns.cmd)
    if not cmd:
        parser.print_usage(sys.stderr)
        print("[run_safe] error: missing command after '--'", file=sys.stderr)
        return 2
    return run_safe(
        cmd, serve=ns.serve, host=ns.host, port=ns.port,
        timeout=ns.timeout, grace=ns.grace, cwd=ns.cwd, quiet_server=ns.quiet_server,
    )


if __name__ == "__main__":
    raise SystemExit(main())
