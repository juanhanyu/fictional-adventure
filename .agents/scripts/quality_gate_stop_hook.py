#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Antigravity 原生 Stop 生命周期质量门禁（Ralph Wiggum 不达标不收工闭环）。

协议规范（Antigravity Hooks camelCase JSON）：
- stdin:
  {
    "terminationReason": "NO_TOOL_CALL" | ...,
    "continuationActive": false | true,
    "cwd": "...",
    "workspacePaths": ["..."],
    ...
  }
- stdout:
  放行: {"decision": "allow"}
  拦截: {"decision": "continue", "reason": "<具体失败明细>"}
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _configure_stdio() -> None:
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def _emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _resolve_repo_root(hook_input: Dict[str, Any]) -> Path:
    """定位待校验项目根目录：优先遵循 hook payload 的 cwd/workspacePaths（若包含测试或审校脚本），否则回退至本脚本所属仓库根。"""
    default_root = Path(__file__).resolve().parent.parent.parent

    candidates: List[Path] = []
    raw_cwd = hook_input.get("cwd")
    if isinstance(raw_cwd, str) and raw_cwd.strip():
        candidates.append(Path(raw_cwd))

    ws_paths = hook_input.get("workspacePaths")
    if isinstance(ws_paths, list):
        for p in ws_paths:
            if isinstance(p, str) and p.strip():
                candidates.append(Path(p))

    for cand in candidates:
        try:
            resolved = cand.resolve()
        except Exception:
            continue
        if resolved.is_dir() and (
            (resolved / "tests" / "run.js").exists()
            or (resolved / "tools" / "novel_linter.py").exists()
        ):
            return resolved

    return default_root


def _run_gate_command(
    name: str, cmd: List[str], cwd: Path, timeout_sec: int = 120
) -> Tuple[bool, str]:
    """执行单条门禁命令，返回 (是否通过, 精简诊断摘要)。"""
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_sec,
            env=dict(os.environ, PYTHONIOENCODING="utf-8"),
        )
    except FileNotFoundError as exc:
        return False, f"[{name}] 命令无法启动: {exc}"
    except subprocess.TimeoutExpired:
        return False, f"[{name}] 执行超时（>{timeout_sec}s）: {' '.join(cmd)}"
    except Exception as exc:
        return False, f"[{name}] 执行异常: {exc}"

    if proc.returncode == 0:
        return True, ""

    combined = "\n".join(
        part.strip()
        for part in (proc.stdout or "", proc.stderr or "")
        if part and part.strip()
    )
    tail_lines = combined.splitlines()[-25:]
    tail = "\n".join(tail_lines)
    if len(tail) > 1200:
        tail = "...\n" + tail[-1200:]
    detail = f"[{name}] 失败 (exit {proc.returncode})，命令: {' '.join(cmd)}"
    if tail:
        detail += f"\n{tail}"
    return False, detail


def main() -> int:
    _configure_stdio()

    raw = sys.stdin.read()
    try:
        hook_input: Dict[str, Any] = json.loads(raw) if raw.strip() else {}
        if not isinstance(hook_input, dict):
            hook_input = {}
    except json.JSONDecodeError:
        # 无法解析 stdin 时安全放行，避免异常 JSON 卡死外层执行器
        _emit({"decision": "allow"})
        return 0

    termination_reason = hook_input.get("terminationReason", "")
    continuation_active = bool(hook_input.get("continuationActive", False))

    # 仅在 Agent 试图正常收工且尚未处于 Stop 续跑状态时执行质量门禁
    if termination_reason != "NO_TOOL_CALL" or continuation_active:
        _emit({"decision": "allow"})
        return 0

    repo_root = _resolve_repo_root(hook_input)
    failures: List[str] = []

    # 门禁 1：全量 JS 测试套
    run_js = repo_root / "tests" / "run.js"
    if not run_js.exists():
        failures.append(f"[全量测试套] 缺失测试入口文件: {run_js}")
    else:
        ok_tests, msg_tests = _run_gate_command(
            "全量测试套 (node tests/run.js)",
            ["node", "tests/run.js"],
            cwd=repo_root,
            timeout_sec=120,
        )
        if not ok_tests:
            failures.append(msg_tests)

    # 门禁 2：小说正文与剧本严格文风/违禁词审校
    linter_py = repo_root / "tools" / "novel_linter.py"
    if not linter_py.exists():
        failures.append(f"[文风审校门禁] 缺失审校脚本: {linter_py}")
    else:
        ok_lint, msg_lint = _run_gate_command(
            "小说与剧本严格审校 (python tools/novel_linter.py --strict)",
            [sys.executable, "tools/novel_linter.py", "--strict"],
            cwd=repo_root,
            timeout_sec=60,
        )
        if not ok_lint:
            failures.append(msg_lint)

    if failures:
        reason = (
            "🚫 Ralph 质量门禁拦截收工：检测到以下未通过项，请逐项修复并重新自测直至全绿：\n\n"
            + "\n\n".join(failures)
        )
        _emit({"decision": "continue", "reason": reason})
        return 0

    _emit({"decision": "allow"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
