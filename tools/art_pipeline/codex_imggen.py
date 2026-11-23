"""通过已登录 ChatGPT 订阅账号（默认 chatgpt-2 隔离配置）的官方 Codex CLI 桥接 GPT 生图/局部改帧。

跨平台支持（Windows 本地笔记本 + Linux Google Cloud VPS / 容器）：
- CODEX_HOME 解析优先级：
  1. --codex-home 命令行参数
  2. 环境变量 CODEX_IMGGEN_HOME
  3. 环境变量 CODEX_HOME
  4. ~/ChatGPT-Accounts/2/codex（Windows 双开默认路径）
  5. ~/.codex-chatgpt2（Linux 云主机推荐隔离路径）
  6. ~/.codex（兜底）
- 每次调用使用 --ephemeral 与 -c mcp_servers={} -c notify=[]，不污染日常对话且避免加载桌面慢 MCP。
- 内置 Popen 自动收割器：检出新图落盘稳定 + tokens used 后自动回收进程树（Windows 用 taskkill，Linux 用进程组 SIGTERM/SIGKILL），彻底防止 codex-cli 尾线程挂死。
"""

from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

DEFAULT_WIN_CODEX_HOME = Path.home() / "ChatGPT-Accounts" / "2" / "codex"
DEFAULT_LINUX_CODEX_HOME = Path.home() / ".codex-chatgpt2"


def resolve_codex_cmd() -> str:
    env_override = os.environ.get("CODEX_CMD") or os.environ.get("CODEX_BIN")
    if env_override and Path(env_override).is_file():
        return env_override

    candidates: list[Path] = []
    if os.name == "nt":
        candidates.extend([
            Path.home() / ".ai-loop" / "npm" / "codex.cmd",
            Path(shutil.which("codex.cmd") or ""),
            Path(shutil.which("codex") or ""),
        ])
    else:
        candidates.extend([
            Path(shutil.which("codex") or ""),
            Path.home() / ".npm-global" / "bin" / "codex",
            Path("/usr/local/bin/codex"),
            Path("/usr/bin/codex"),
        ])

    for c in candidates:
        if str(c) and c.is_file() and c.suffix.lower() != ".ps1":
            return str(c)
    raise FileNotFoundError(
        "未找到可用的 codex 可执行文件，请确认已安装 @openai/codex 或通过环境变量 CODEX_CMD 指定路径。"
    )


def resolve_codex_home(cli_home: Path | None) -> Path:
    if cli_home:
        candidates = [cli_home]
    else:
        candidates = []
        for env_key in ("CODEX_IMGGEN_HOME", "CODEX_HOME"):
            if os.environ.get(env_key):
                candidates.append(Path(os.environ[env_key]))
        if os.name == "nt":
            candidates.extend([DEFAULT_WIN_CODEX_HOME, DEFAULT_LINUX_CODEX_HOME, Path.home() / ".codex"])
        else:
            candidates.extend([DEFAULT_LINUX_CODEX_HOME, DEFAULT_WIN_CODEX_HOME, Path.home() / ".codex"])

    for cand in candidates:
        resolved = cand.expanduser().resolve()
        if resolved.exists():
            return resolved

    tried = ", ".join(str(c) for c in candidates)
    raise FileNotFoundError(
        f"未找到有效的 CODEX_HOME 目录（已尝试: {tried}）。请确认已挂载 chatgpt-2 认证目录或设置 CODEX_IMGGEN_HOME / --codex-home。"
    )


def snapshot_generated_images(codex_home: Path) -> dict[Path, float]:
    gen_dir = codex_home / "generated_images"
    if not gen_dir.exists():
        return {}
    return {
        p: p.stat().st_mtime
        for p in gen_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in {".png", ".webp", ".jpg", ".jpeg"}
    }


def _kill_tree(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, check=False)
        return
    try:
        pgid = os.getpgid(pid)
        os.killpg(pgid, signal.SIGTERM)
        time.sleep(0.8)
        os.killpg(pgid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except OSError:
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description="跨平台桥接 Codex CLI（默认 chatgpt-2 订阅）生成或编辑图片")
    parser.add_argument("--prompt", type=str, help="生图/改帧提示词（也可通过 --prompt-file 提供）")
    parser.add_argument("--prompt-file", type=Path, help="包含生图提示词的 UTF-8 文本文件")
    parser.add_argument("-i", "--image", action="append", default=[], help="参考图路径，可重复指定（建议不超过 5 张）")
    parser.add_argument("-o", "--out", type=Path, required=True, help="期望保存的输出图片路径（例如 ./shot01_raw.png）")
    parser.add_argument("-C", "--workdir", type=Path, default=None, help="Codex 工作目录（默认为输出文件所在目录）")
    parser.add_argument("--codex-home", type=Path, default=None, help="指定 CODEX_HOME（默认自动识别 chatgpt-2 隔离目录）")
    parser.add_argument("--model", type=str, default=None, help="可选指定 Codex 模型")
    parser.add_argument("--timeout", type=float, default=360.0, help="单张超时秒数（默认 360s）")
    args = parser.parse_args()

    if args.prompt_file:
        prompt_text = args.prompt_file.read_text(encoding="utf-8").strip()
    elif args.prompt:
        prompt_text = args.prompt.strip()
    else:
        parser.error("必须提供 --prompt 或 --prompt-file")

    if len(args.image) > 5:
        print(
            f"[WARN] 当前传入了 {len(args.image)} 张参考图，超过 Codex/GPT 内置生图通常的 5 张上限，建议先拼图合并！",
            file=sys.stderr,
        )

    codex_home = resolve_codex_home(args.codex_home)
    out_path = args.out.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    workdir = (args.workdir or out_path.parent).resolve()

    ref_paths: list[Path] = []
    for img in args.image:
        p = Path(img).resolve()
        if not p.exists():
            raise FileNotFoundError(f"参考图不存在: {p}")
        ref_paths.append(p)

    full_prompt = (
        "请直接调用内置图像生成工具完成下面的图片生成/编辑任务（无需调用任何外部 MCP、浏览器或文件复制脚本，本脚本会自动回收生成的图片）。\n"
        "生成完成后仅在回复中简短确认已完成与尺寸即可，立刻结束回合。\n\n"
        "【参考图顺序】\n"
        + "\n".join(f"- IMAGE {idx + 1}: {p.name}" for idx, p in enumerate(ref_paths))
        + f"\n\n【生成/编辑要求】\n{prompt_text}\n"
    )

    codex_bin = resolve_codex_cmd()
    env = os.environ.copy()
    env["CODEX_HOME"] = str(codex_home)

    before_imgs = snapshot_generated_images(codex_home)
    start_ts = time.time()

    cmd = [
        codex_bin,
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "-c",
        "mcp_servers={}",
        "-c",
        "notify=[]",
        "-s",
        "read-only",
        "-C",
        str(workdir),
    ]
    if args.model:
        cmd.extend(["-m", args.model])
    for p in ref_paths:
        cmd.extend(["-i", str(p)])
    cmd.append("-")

    print(
        f"[codex_imggen] 账户目录: {codex_home} | 命令: {codex_bin} | 参考图: {len(ref_paths)} 张 -> {out_path}",
        flush=True,
    )

    def _find_newest_image() -> Path | None:
        after_imgs = snapshot_generated_images(codex_home)
        created = [
            (mtime, p)
            for p, mtime in after_imgs.items()
            if p not in before_imgs or mtime > max(before_imgs.get(p, 0.0), start_ts - 1.0)
        ]
        if not created:
            return None
        created.sort(key=lambda item: item[0], reverse=True)
        return created[0][1]

    popen_kwargs: dict = {
        "stdin": subprocess.PIPE,
        "stdout": subprocess.PIPE,
        "stderr": subprocess.STDOUT,
        "env": env,
    }
    if os.name != "nt":
        popen_kwargs["start_new_session"] = True

    proc = subprocess.Popen(cmd, **popen_kwargs)
    assert proc.stdin is not None and proc.stdout is not None
    try:
        proc.stdin.write(full_prompt.encode("utf-8"))
        proc.stdin.close()
    except OSError:
        pass

    done_flag: dict[str, float | None] = {"tokens_seen_at": None}

    def _reader() -> None:
        assert proc.stdout is not None
        for raw_line in iter(proc.stdout.readline, b""):
            line = raw_line.decode("utf-8", errors="replace")
            sys.stdout.write(line)
            sys.stdout.flush()
            if "tokens used" in line.lower() and done_flag["tokens_seen_at"] is None:
                done_flag["tokens_seen_at"] = time.time()

    t_read = threading.Thread(target=_reader, daemon=True)
    t_read.start()

    last_img: Path | None = None
    last_size = -1
    stable_since: float | None = None
    max_wait = float(args.timeout)

    while proc.poll() is None:
        now = time.time()
        newest = _find_newest_image()
        if newest is not None:
            try:
                sz = newest.stat().st_size
            except OSError:
                sz = -1
            if newest == last_img and sz == last_size and sz > 10_000:
                if stable_since is None:
                    stable_since = now
            else:
                last_img, last_size, stable_since = newest, sz, None

        if done_flag["tokens_seen_at"] is not None:
            if (stable_since is not None and now - stable_since >= 2.0) or (now - done_flag["tokens_seen_at"] >= 5.0):
                _kill_tree(proc.pid)
                break
        elif now - start_ts >= max_wait:
            print(f"[WARN] codex_imggen 超时 ({max_wait}s)，强制回收进程树...", file=sys.stderr, flush=True)
            _kill_tree(proc.pid)
            break
        time.sleep(0.5)

    t_read.join(timeout=2.0)

    if not out_path.exists():
        newest = _find_newest_image()
        if newest is not None:
            shutil.copy2(newest, out_path)
            print(f"[INFO] 自动回收生成成品: {newest} -> {out_path}", flush=True)

    if not out_path.exists():
        rc = proc.returncode if proc.returncode is not None else 2
        print(f"[ERROR] Codex 执行结束但未在目标路径找到输出文件: {out_path} (rc={rc})", file=sys.stderr)
        sys.exit(rc if rc != 0 else 2)
    print(f"[OK] 生成完成: {out_path} ({out_path.stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
