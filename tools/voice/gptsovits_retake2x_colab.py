# @title 🎙️ 转生千金 · GPT-SoVITS 缺陷句 2× 双版本精修重抽（1-Cell 全自动版）
# 零 API Key · T=0s 复用/挂载云盘 · 自动从云盘压缩包断点恢复 · G4/A100/H100 三卡通用 · 本地 SSD ZIP_STORED 秒级打包 + 单文件原子同步云盘

from __future__ import annotations

import argparse
import collections
import importlib.util
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import wave
import zipfile
from pathlib import Path
from typing import Any

REPO_URL = "https://github.com/juanhanyu/fictional-adventure.git"
GSV_REPO_URL = "https://github.com/RVC-Boss/GPT-SoVITS.git"
MIN_VALID_MP3_BYTES = 1500

REQUIRED_IMPORT_MODULES = (
    "resampy",
    "soundfile",
    "scipy",
    "yaml",
    "tqdm",
    "requests",
    "nltk",
    "pyopenjtalk",
    "fast_langdetect",
    "split_lang",
    "jieba",
    "jieba_fast",
    "cn2an",
    "pypinyin",
    "g2p_en",
    "wordsegment",
    "x_transformers",
    "einops",
    "peft",
    "pytorch_lightning",
    "torchmetrics",
    "ffmpeg",
    "librosa",
    "huggingface_hub",
    "sentencepiece",
    "transformers",
)

VERIFIED_PIP_PACKAGES = [
    "resampy",
    "soundfile",
    "scipy",
    "PyYAML",
    "tqdm",
    "requests",
    "nltk",
    "matplotlib",
    "rich",
    "loguru",
    "pyopenjtalk>=0.4.1",
    "fast_langdetect>=0.3.1",
    "split-lang",
    "jieba",
    "jieba_fast",
    "cn2an",
    "pypinyin",
    "g2p_en",
    "wordsegment",
    "x-transformers",
    "einops",
    "peft<0.18.0",
    "pytorch-lightning>=2.4",
    "torchmetrics",
    "ffmpeg-python",
    "librosa>=0.10.2",
    "huggingface_hub",
    "sentencepiece",
    "transformers>=4.51,<5",
]


def is_valid_mp3_header(header: bytes) -> bool:
    """Validate ID3 tag or MPEG frame sync (0xFF + 0xE0 mask)."""
    if len(header) >= 3 and header[:3] == b"ID3":
        return True
    if len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
        return True
    return False


def is_valid_mp3_file(mp3_path: Path, min_bytes: int = MIN_VALID_MP3_BYTES) -> bool:
    """Check that mp3_path exists, has size >= min_bytes, and begins with a valid MP3 header."""
    try:
        if not mp3_path.is_file():
            return False
        if mp3_path.stat().st_size < min_bytes:
            return False
        with mp3_path.open("rb") as fp:
            hdr = fp.read(4)
        return is_valid_mp3_header(hdr)
    except OSError:
        return False


def resolve_audio_rel_stem(line: dict[str, Any]) -> str:
    """Match gptsovits_batch_synthesize.resolve_audio_rel_stem exactly."""
    rel = str(line.get("audioRelPath") or "").replace("\\", "/").lstrip("/")
    if not rel:
        audio_path = str(line.get("audioPath") or "").replace("\\", "/").lstrip("/")
        if audio_path.startswith("assets/voice/"):
            rel = audio_path[len("assets/voice/") :]
        else:
            rel = audio_path
    if rel.lower().endswith(".mp3"):
        rel = rel[:-4]
    elif "." in Path(rel).name:
        rel = rel.rsplit(".", 1)[0]
    return rel


def compute_expected_retake2x_relpaths(script_path: Path, plan_path: Path) -> set[str]:
    """
    Compute the exact set of relative paths under `retake2x/` that gptsovits_batch_synthesize.py
    expects for `--retake-plan <plan_path> --takes 2` (e.g. `story/s_start/s_start__beatrice__609115c1__take1.mp3`).
    """
    script_raw = json.loads(script_path.read_text(encoding="utf-8"))
    all_lines: list[dict[str, Any]] = (
        script_raw
        if isinstance(script_raw, list)
        else script_raw.get("lines") or script_raw.get("entries") or script_raw.get("items") or []
    )
    by_vid: dict[str, dict[str, Any]] = {str(ln["voiceId"]): ln for ln in all_lines if isinstance(ln, dict) and ln.get("voiceId")}

    plan_raw = json.loads(plan_path.read_text(encoding="utf-8"))
    entries_raw = plan_raw.get("entries") if isinstance(plan_raw, dict) else plan_raw
    plan_items: list[tuple[str, dict[str, Any]]] = []
    if isinstance(entries_raw, list):
        for ent in entries_raw:
            if isinstance(ent, dict):
                vid = str(ent.get("voiceId") or ent.get("id") or "").strip()
                if vid:
                    plan_items.append((vid, ent))
    elif isinstance(entries_raw, dict):
        for vid, ent in entries_raw.items():
            if isinstance(ent, dict):
                v = str(ent.get("voiceId") or vid).strip()
                if v:
                    plan_items.append((v, ent))
    else:
        raise ValueError(f"Unsupported retake plan format in {plan_path}")

    expected: set[str] = set()
    for vid, ent in plan_items:
        ln = by_vid.get(vid) or ent
        stem = resolve_audio_rel_stem(ln)
        if stem:
            expected.add(f"{stem}__take1.mp3")
            expected.add(f"{stem}__take2.mp3")
    return expected


def normalize_zip_retake2x_relpath(
    member_name: str,
    expected_relpaths: set[str] | None = None,
    expected_by_basename: dict[str, str] | None = None,
) -> str | None:
    """
    Normalize a zip entry path to its canonical relative path under `retake2x/`.
    Supports:
      - `retake2x/story/...` (produced by this script)
      - `content/retake2x_work/retake2x/story/...` (produced by manual Colab terminal zip)
      - `story/...` / `combat/...` / `interactive/...` (zipped from inside retake2x/)
      - flat `<basename>.mp3` if uniquely matched in expected_by_basename
    Rejects directories, path traversal (`..`), and partial `.tmp.` files.
    """
    norm = str(member_name or "").replace("\\", "/").lstrip("/")
    if not norm or norm.endswith("/"):
        return None
    parts = [p for p in norm.split("/") if p]
    if any(p == ".." for p in parts):
        return None
    base = parts[-1]
    if not base.lower().endswith(".mp3"):
        return None
    if ".tmp." in base or base.endswith(".tmp.mp3"):
        return None

    marker = "/retake2x/"
    wrapped = f"/{norm}"
    if marker in wrapped:
        rel = wrapped.rsplit(marker, 1)[1].lstrip("/")
    else:
        rel = norm

    if expected_relpaths is None:
        return rel
    if rel in expected_relpaths:
        return rel
    if expected_by_basename is not None and base in expected_by_basename:
        return expected_by_basename[base]
    return None


def restore_valid_mp3s_from_zip(
    zip_path: Path,
    retake_out_root: Path,
    expected_relpaths: set[str],
    *,
    min_bytes: int = MIN_VALID_MP3_BYTES,
) -> dict[str, int]:
    """
    Inspect an existing retake2x zip archive and atomically restore valid planned MP3s
    (>= min_bytes & valid ID3/MPEG sync header) into retake_out_root preserving subfolder structure.
    """
    stats = {
        "restored": 0,
        "alreadyPresent": 0,
        "skippedInvalid": 0,
        "skippedUnmatched": 0,
        "manifestRestored": 0,
    }
    if not zip_path.is_file():
        return stats

    expected_by_basename: dict[str, str] = {}
    ambiguous_basenames: set[str] = set()
    for rel in expected_relpaths:
        bn = rel.rsplit("/", 1)[-1]
        if bn in expected_by_basename:
            ambiguous_basenames.add(bn)
        else:
            expected_by_basename[bn] = rel
    for bn in ambiguous_basenames:
        expected_by_basename.pop(bn, None)

    retake_out_root.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                norm = info.filename.replace("\\", "/").lstrip("/")
                base = norm.rsplit("/", 1)[-1]

                if base == "retake2x_manifest.json":
                    local_manifest = retake_out_root / "retake2x_manifest.json"
                    if not local_manifest.is_file():
                        try:
                            raw_m = zf.read(info)
                            json.loads(raw_m.decode("utf-8"))
                            tmp_m = local_manifest.with_name(f"{local_manifest.name}.restore.{os.getpid()}.tmp")
                            tmp_m.write_bytes(raw_m)
                            os.replace(tmp_m, local_manifest)
                            stats["manifestRestored"] += 1
                        except Exception:
                            pass
                    continue

                if not base.lower().endswith(".mp3"):
                    continue
                if ".tmp." in base or base.endswith(".tmp.mp3"):
                    stats["skippedInvalid"] += 1
                    continue

                rel = normalize_zip_retake2x_relpath(info.filename, expected_relpaths, expected_by_basename)
                if rel is None:
                    stats["skippedUnmatched"] += 1
                    continue

                if info.file_size < min_bytes:
                    stats["skippedInvalid"] += 1
                    continue

                dst = retake_out_root / rel
                if is_valid_mp3_file(dst, min_bytes=min_bytes):
                    stats["alreadyPresent"] += 1
                    continue

                data = zf.read(info)
                if len(data) < min_bytes or not is_valid_mp3_header(data[:4]):
                    stats["skippedInvalid"] += 1
                    continue

                dst.parent.mkdir(parents=True, exist_ok=True)
                tmp_dst = dst.with_name(f"{dst.name}.restore.{os.getpid()}.tmp.mp3")
                try:
                    tmp_dst.write_bytes(data)
                    os.replace(tmp_dst, dst)
                    stats["restored"] += 1
                finally:
                    tmp_dst.unlink(missing_ok=True)
    except (zipfile.BadZipFile, OSError) as exc:
        print(f"⚠️ [RESUME-ZIP] 读取已有压缩包 {zip_path} 失败 ({exc})，将跳过压缩包恢复并正常合成。", flush=True)
        return stats

    print(
        f"♻️ [RESUME-ZIP] Restored {stats['restored']} valid MP3s from Drive zip ({zip_path.name}) — skipping them! "
        f"(already_on_disk={stats['alreadyPresent']}, skipped_invalid_or_tmp={stats['skippedInvalid']}, "
        f"unmatched={stats['skippedUnmatched']})",
        flush=True,
    )
    return stats


def build_local_retake2x_zip(
    *,
    work_dir: Path,
    retake_out_root: Path,
    local_zip_path: Path,
    expected_relpaths: set[str],
    qa_report_path: Path | None = None,
) -> tuple[int, int, float]:
    """
    Fast local NVMe SSD zip creation using ZIP_STORED (MP3 is already compressed -> 20x faster).
    Atomically replaces local_zip_path via temporary sibling file.
    Returns (mp3_archived, total_archived, elapsed_sec).
    """
    t0 = time.perf_counter()
    local_zip_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_zip = local_zip_path.with_name(f"{local_zip_path.name}.tmp.{os.getpid()}")
    tmp_zip.unlink(missing_ok=True)

    mp3_archived = 0
    total_archived = 0
    try:
        with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_STORED) as zf:
            for rel in sorted(expected_relpaths):
                p = retake_out_root / rel
                if not is_valid_mp3_file(p, min_bytes=MIN_VALID_MP3_BYTES):
                    continue
                arcname = p.relative_to(work_dir).as_posix()
                zf.write(p, arcname=arcname, compress_type=zipfile.ZIP_STORED)
                mp3_archived += 1
                total_archived += 1

            manifest_path = retake_out_root / "retake2x_manifest.json"
            if manifest_path.is_file():
                zf.write(manifest_path, arcname="retake2x/retake2x_manifest.json", compress_type=zipfile.ZIP_STORED)
                total_archived += 1

            if qa_report_path is not None and qa_report_path.is_file():
                zf.write(qa_report_path, arcname="retake_qa_report.json", compress_type=zipfile.ZIP_STORED)
                total_archived += 1

        os.replace(tmp_zip, local_zip_path)
    finally:
        tmp_zip.unlink(missing_ok=True)

    return mp3_archived, total_archived, time.perf_counter() - t0


def copy_zip_to_drive_atomic(local_zip: Path, drive_zip: Path) -> int:
    """
    Copy a SINGLE completed .zip file to Google Drive via atomic .tmp + os.replace
    (falling back to direct shutil.copy2 if Drive FUSE rejects rename), then verify byte-for-byte size.
    Returns verified byte size.
    """
    expected_bytes = local_zip.stat().st_size
    drive_zip.parent.mkdir(parents=True, exist_ok=True)
    tmp_drive = drive_zip.with_name(f"{drive_zip.name}.tmp.{os.getpid()}")
    try:
        tmp_drive.unlink(missing_ok=True)
    except OSError:
        pass

    try:
        shutil.copy2(local_zip, tmp_drive)
        try:
            os.replace(tmp_drive, drive_zip)
        except OSError as rename_exc:
            print(
                f"ℹ️ Drive FUSE 不支持原子 os.replace ({rename_exc})，回退为单文件直写 copy2...",
                flush=True,
            )
            try:
                tmp_drive.unlink(missing_ok=True)
            except OSError:
                pass
            shutil.copy2(local_zip, drive_zip)
    finally:
        try:
            if tmp_drive.exists():
                tmp_drive.unlink(missing_ok=True)
        except OSError:
            pass

    if not drive_zip.is_file():
        raise RuntimeError(f"Drive zip 写入后未找到目标文件: {drive_zip}")
    drive_bytes = drive_zip.stat().st_size
    if drive_bytes != expected_bytes:
        raise RuntimeError(
            f"Drive zip 字节校验不匹配！local={expected_bytes} bytes vs drive={drive_bytes} bytes ({drive_zip})"
        )
    return drive_bytes


def run_stream(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> int:
    """实时流式打印子进程输出（强制 stdin=DEVNULL 防子进程抢占终端），失败时附上末尾 80 行完整上下文。"""
    print(f"\n$ {' '.join(cmd)}", flush=True)
    run_env = (env or os.environ).copy()
    run_env["PYTHONUNBUFFERED"] = "1"
    run_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
    tail: collections.deque[str] = collections.deque(maxlen=80)

    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd) if cwd is not None else None,
        env=run_env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        print(line, end="", flush=True)
        tail.append(line.rstrip("\r\n"))
    rc = proc.wait()
    if check and rc != 0:
        tail_txt = "\n".join(tail) if tail else "(无输出)"
        raise RuntimeError(f"命令执行失败 (exit={rc}): {' '.join(cmd)}\n--- 最后 {len(tail)} 行输出 ---\n{tail_txt}")
    return rc


def cleanup_stale_gpu_workers() -> None:
    """安全清理残留 GPU 推理进程（严禁触碰 ipykernel / jupyter / colab / dap_multiplexer / node）。"""
    my_pid = os.getpid()
    parent_pid = os.getppid()
    stale_pids: list[int] = []
    proc_root = Path("/proc")
    if proc_root.is_dir():
        for entry in proc_root.iterdir():
            if not entry.name.isdigit():
                continue
            pid = int(entry.name)
            if pid in (my_pid, parent_pid, 1):
                continue
            try:
                cmdline = (entry / "cmdline").read_bytes().replace(b"\x00", b" ").decode("utf-8", errors="ignore")
                low = cmdline.lower()
                if any(safe_kw in low for safe_kw in ("ipykernel", "jupyter", "colab", "dap_multiplexer", "node")):
                    continue
                if any(
                    kw in cmdline
                    for kw in (
                        "gptsovits_batch_synthesize.py",
                        "GPT-SoVITS",
                        "sgl-omni",
                        "sglang_omni",
                        "batch_synthesize.py",
                    )
                ):
                    stale_pids.append(pid)
            except Exception:
                continue

    if stale_pids:
        print(f"🧹 清理上一轮残留推理子进程: {stale_pids}", flush=True)
        for pid in stale_pids:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        time.sleep(1.5)
        for pid in stale_pids:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass


def detect_gpu_environment() -> str:
    """
    Dynamic G4 (Blackwell sm_120 96GB) / A100 (Ampere sm_80 80GB) / H100 (Hopper sm_90 80GB)
    portable GPU probe — zero hardcoded card names.
    """
    gpu_desc = "CPU (未检测到 CUDA GPU，建议在 Colab 切换至 G4 / A100 / H100 / L4 GPU 运行)"
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            dev_name = torch.cuda.get_device_name(0)
            cc_major, cc_minor = torch.cuda.get_device_capability(0)
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            tier = "高端大显存档 (>=75GB)" if vram_gb >= 75.0 else "标准显存档"
            attn_mode = (
                "PyTorch原生SDPA安全回退(sm_120+)"
                if cc_major >= 10
                else ("TF32+FP16+原生SDPA" if cc_major >= 8 else "FP16")
            )
            if cc_major >= 8:
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
            gpu_desc = (
                f"{dev_name} (sm_{cc_major}{cc_minor}, {vram_gb:.1f} GB VRAM [{tier}], "
                f"CUDA {torch.version.cuda}, {attn_mode})"
            )
    except Exception as _gpu_exc:
        gpu_desc = f"GPU 探测异常 ({_gpu_exc})"
    return gpu_desc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Colab 1-Cell GPT-SoVITS Retake 2x Runner")
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Ignore existing Drive zip and re-synthesize from scratch (same as env RETAKE2X_FRESH=1)",
    )
    known_args, _unknown = parser.parse_known_args(argv)
    fresh_mode = bool(known_args.fresh) or os.environ.get("RETAKE2X_FRESH", "").strip().lower() in ("1", "true", "yes")

    # ==============================================================================
    # 1. T=0s 挂载/复用 Google Drive（已在当前 Colab 运行时挂载则瞬时复用）
    # ==============================================================================
    t_cell_start = time.perf_counter()
    drive_mount_point = Path("/content/drive")
    drive_mydrive = drive_mount_point / "MyDrive"
    drive_retake_zip = drive_mydrive / "ojousama_jp_voice_retake2x.zip"

    drive_mounted = drive_mydrive.is_dir()
    if drive_mounted:
        print(f"✅ [Step 1/7] 复用已挂载的 Google Drive: {drive_mydrive}", flush=True)
    else:
        try:
            from google.colab import drive  # type: ignore

            print("🔗 [Step 1/7] 正在挂载 Google Drive（授权后全程零交互自动完成）...", flush=True)
            drive.mount(str(drive_mount_point), force_remount=False)
            drive_mounted = drive_mydrive.is_dir()
            if drive_mounted:
                print(f"✅ Google Drive 挂载成功: {drive_mydrive}", flush=True)
        except Exception as _drive_exc:
            print(f"ℹ️ 未挂载 Google Drive ({_drive_exc})，将以纯本地 /content 模式运行并在结束时触发浏览器下载。", flush=True)

    # ==============================================================================
    # 2. 严格本地 NVMe SSD 路径隔离（严禁模型权重 / HF 缓存 / 工作目录落入 /content/drive FUSE！）
    # ==============================================================================
    content_root = Path("/content") if Path("/content").is_dir() else Path.cwd() / "_colab_content"
    repo_dir = content_root / "fictional-adventure"
    gsv_dir = content_root / "GPT-SoVITS"
    assets_dir = content_root / "gsv_assets"
    hf_home_dir = content_root / "hf_cache"
    nltk_data_dir = content_root / "nltk_data"
    work_dir = content_root / "retake2x_work"
    local_zip_path = content_root / "ojousama_jp_voice_retake2x.zip"

    for _ssd_path in (repo_dir, gsv_dir, assets_dir, hf_home_dir, nltk_data_dir, work_dir, local_zip_path):
        _resolved_str = str(_ssd_path.resolve())
        assert not _resolved_str.startswith("/content/drive"), (
            f"致命路径隔离违规：高速本地路径 {_ssd_path} ({_resolved_str}) 严禁位于 /content/drive 下！"
        )

    for _d in (assets_dir, hf_home_dir, nltk_data_dir, work_dir):
        _d.mkdir(parents=True, exist_ok=True)

    os.environ["PYTHONUNBUFFERED"] = "1"
    os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
    os.environ["HF_HOME"] = str(hf_home_dir)
    os.environ["HUGGINGFACE_HUB_CACHE"] = str(hf_home_dir / "hub")
    os.environ["NLTK_DATA"] = str(nltk_data_dir)
    os.environ.pop("TRANSFORMERS_CACHE", None)

    # ==============================================================================
    # 3. 检查动态 GPU 能力（G4 / A100 / H100 全兼容）并清理残留进程
    # ==============================================================================
    print("\n🧹 [Step 2/7] 检查 GPU 环境与残留进程...", flush=True)
    cleanup_stale_gpu_workers()
    gpu_desc = detect_gpu_environment()
    print(f"🖥️ 当前计算设备: {gpu_desc}", flush=True)

    # ==============================================================================
    # 4. 同步最新 origin/main 仓库，复用本地 /content/GPT-SoVITS 与 /content/gsv_assets
    # ==============================================================================
    print("\n📥 [Step 3/7] 拉取最新 fictional-adventure (origin/main) 并复用本地 GPT-SoVITS / 权重缓存...", flush=True)
    if (repo_dir / ".git").is_dir():
        run_stream(["git", "fetch", "origin", "main", "--depth", "1"], cwd=repo_dir)
        run_stream(["git", "reset", "--hard", "origin/main"], cwd=repo_dir)
    else:
        shutil.rmtree(repo_dir, ignore_errors=True)
        run_stream(["git", "clone", "--branch", "main", "--depth", "1", REPO_URL, str(repo_dir)])

    if not (gsv_dir / "GPT_SoVITS" / "TTS_infer_pack" / "TTS.py").is_file():
        shutil.rmtree(gsv_dir, ignore_errors=True)
        run_stream(["git", "clone", "--depth", "1", GSV_REPO_URL, str(gsv_dir)])
    else:
        print(f"✅ 复用本地已存在的 GPT-SoVITS 引擎: {gsv_dir}", flush=True)

    cached_assets_cnt = sum(1 for _ in assets_dir.rglob("*") if _.is_file())
    print(f"✅ 本地角色权重与参考音缓存目录: {assets_dir} (已有 {cached_assets_cnt} 个文件)", flush=True)

    # 校验计划清单 + 清理残缺 .tmp*.mp3 + 从已有云盘 zip 自动断点恢复（零 FUSE 散文件遍历！）
    script_master_path = repo_dir / "tools" / "voice" / "script_jp_master.json"
    retake_plan_path = repo_dir / "tools" / "voice" / "retake_v2_plan.json"
    if not retake_plan_path.is_file():
        raise FileNotFoundError(f"未找到精修重抽计划文件: {retake_plan_path}")
    if not script_master_path.is_file():
        raise FileNotFoundError(f"未找到日配主台本文件: {script_master_path}")

    expected_relpaths = compute_expected_retake2x_relpaths(script_master_path, retake_plan_path)
    expected_take_mp3s = len(expected_relpaths)
    plan_line_count = expected_take_mp3s // 2

    retake_out_root = work_dir / "retake2x"
    retake_out_root.mkdir(parents=True, exist_ok=True)
    stale_removed = 0
    for pat in ("*.tmp.mp3", "*.tmp.*.mp3"):
        for _stale_tmp in retake_out_root.rglob(pat):
            if _stale_tmp.is_file():
                _stale_tmp.unlink(missing_ok=True)
                stale_removed += 1
    if stale_removed > 0:
        print(f"🧹 已清理 {stale_removed} 个残留临时 .tmp*.mp3 文件", flush=True)

    if fresh_mode:
        print("🆕 [FRESH] 已启用 --fresh 模式：跳过已有云盘 zip 恢复并强制重抽。", flush=True)
    else:
        if drive_mounted and drive_retake_zip.is_file():
            restore_valid_mp3s_from_zip(drive_retake_zip, retake_out_root, expected_relpaths)
        elif local_zip_path.is_file():
            restore_valid_mp3s_from_zip(local_zip_path, retake_out_root, expected_relpaths)

    # ==============================================================================
    # 5. 秒级依赖检查（遵循 --upgrade-strategy only-if-needed 绝不降级原生 CUDA PyTorch）
    # ==============================================================================
    print("\n📦 [Step 4/7] 检查 GPT-SoVITS 运行时依赖（已安装则直接复用，绝不降级原生 PyTorch）...", flush=True)
    missing_mods = [m for m in REQUIRED_IMPORT_MODULES if importlib.util.find_spec(m) is None]
    if not missing_mods:
        print("✅ 复用当前 Colab 运行时已安装的 GPT-SoVITS 依赖环境（秒级启动，跳过 pip install）", flush=True)
    else:
        print(f"📦 检测到缺失模块 {missing_mods[:6]}{'...' if len(missing_mods) > 6 else ''}，按需补齐最小依赖集...", flush=True)
        run_stream(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "-q",
                "--upgrade-strategy",
                "only-if-needed",
                *VERIFIED_PIP_PACKAGES,
            ]
        )

    # 轻量探测 torchaudio.load，仅在失败时按需补装 torchcodec（绝不覆盖 torch）
    _ta_probe_wav = content_root / "_ta_probe_retake2x.wav"
    try:
        with wave.open(str(_ta_probe_wav), "wb") as _wf:
            _wf.setnchannels(1)
            _wf.setsampwidth(2)
            _wf.setframerate(16000)
            _wf.writeframes(b"\x00\x00" * 1600)
        _ta_probe_rc = subprocess.run(
            [sys.executable, "-c", f"import torchaudio; torchaudio.load({str(_ta_probe_wav)!r})"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30,
        ).returncode
        if _ta_probe_rc != 0:
            print("🔧 探测到 torchaudio.load 需要 torchcodec 后端，正在按需安装 torchcodec ...", flush=True)
            run_stream(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "-q",
                    "--upgrade-strategy",
                    "only-if-needed",
                    "torchcodec",
                ]
            )
    finally:
        _ta_probe_wav.unlink(missing_ok=True)

    # ==============================================================================
    # 6. 执行缺陷句 2× 差异化双版本精修重抽（Take 1 稳健棚录 + Take 2 表现力异版）
    # ==============================================================================
    print(
        f"\n🎙️ [Step 5/7] 启动 2× 双版本精修重抽：{plan_line_count} 条目标句 × 2 Takes = {expected_take_mp3s} 条 MP3 ...",
        flush=True,
    )
    qa_report_path = work_dir / "retake_qa_report.json"
    synth_cmd = [
        sys.executable,
        "tools/voice/gptsovits_batch_synthesize.py",
        "--gsv-root",
        str(gsv_dir),
        "--assets-dir",
        str(assets_dir),
        "--script",
        "tools/voice/script_jp_master.json",
        "--casting",
        "tools/voice/casting_gptsovits_anime.json",
        "--retake-plan",
        "tools/voice/retake_v2_plan.json",
        "--takes",
        "2",
        "--out-dir",
        str(work_dir),
        "--qa-report",
        str(qa_report_path),
    ]
    if fresh_mode:
        synth_cmd.append("--overwrite")
    run_stream(synth_cmd, cwd=repo_dir)

    # ==============================================================================
    # 7. Step 6/7: 本地 SSD 严密盘点 + ZIP_STORED 极速单包打包（彻底取消逐文件 Drive FUSE 同步！）
    # ==============================================================================
    print("\n📦 [Step 6/7] 盘点本地 SSD 成品并极速打包（ZIP_STORED，不走慢速逐文件 Drive FUSE）...", flush=True)
    valid_rels = [rel for rel in sorted(expected_relpaths) if is_valid_mp3_file(retake_out_root / rel, MIN_VALID_MP3_BYTES)]
    missing_rels = [rel for rel in sorted(expected_relpaths) if not is_valid_mp3_file(retake_out_root / rel, MIN_VALID_MP3_BYTES)]
    print(
        f"🔍 [DISK-AUDIT] 本地有效 MP3: {len(valid_rels)} / {expected_take_mp3s} 条 (缺失={len(missing_rels)})",
        flush=True,
    )

    if missing_rels:
        partial_name = f"ojousama_jp_voice_retake2x_PARTIAL_{len(valid_rels)}of{expected_take_mp3s}.zip"
        partial_local_zip = content_root / partial_name
        p_mp3, p_tot, p_sec = build_local_retake2x_zip(
            work_dir=work_dir,
            retake_out_root=retake_out_root,
            local_zip_path=partial_local_zip,
            expected_relpaths=expected_relpaths,
            qa_report_path=qa_report_path if qa_report_path.is_file() else None,
        )
        print(
            f"⚠️ 已将 {p_mp3} 条部分成果抢救打包至 {partial_local_zip} ({p_tot} 文件, {p_sec:.1f}s)，"
            f"绝不覆盖完整目标包！",
            flush=True,
        )
        if drive_mounted:
            try:
                drive_partial = drive_mydrive / partial_name
                p_bytes = copy_zip_to_drive_atomic(partial_local_zip, drive_partial)
                print(
                    f"☁️ 部分抢救包已同步至云盘: {drive_partial} ({p_bytes / (1024 * 1024):.2f} MB)",
                    flush=True,
                )
            except Exception as _p_exc:
                print(f"⚠️ 部分抢救包同步云盘失败 ({_p_exc})，本地文件完好: {partial_local_zip}", flush=True)
        sample_missing = "\n  - ".join(missing_rels[:20])
        raise RuntimeError(
            f"合成盘点不完整！仅发现 {len(valid_rels)}/{expected_take_mp3s} 条有效 MP3（缺失 {len(missing_rels)} 条）。\n"
            f"前 {min(20, len(missing_rels))} 条缺失路径:\n  - {sample_missing}"
        )

    manifest_path = retake_out_root / "retake2x_manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"缺失 2× 清单产物: {manifest_path}")
    if not qa_report_path.is_file():
        raise FileNotFoundError(f"缺失重抽质检报告: {qa_report_path}")

    mp3_archived, total_archived, zip_sec = build_local_retake2x_zip(
        work_dir=work_dir,
        retake_out_root=retake_out_root,
        local_zip_path=local_zip_path,
        expected_relpaths=expected_relpaths,
        qa_report_path=qa_report_path,
    )
    local_zip_bytes = local_zip_path.stat().st_size
    zip_size_mb = local_zip_bytes / (1024 * 1024)
    print(
        f"✅ 本地极速打包完成: {local_zip_path} ({mp3_archived} MP3 / 共 {total_archived} 文件, "
        f"{zip_size_mb:.2f} MB, 耗时 {zip_sec:.1f}s)",
        flush=True,
    )

    # ==============================================================================
    # 8. Step 7/7: 单文件原子同步至 Google Drive + 字节级严格校验 + 触发浏览器下载
    # ==============================================================================
    print("\n☁️ [Step 7/7] 单文件原子同步成品 zip 至 Google Drive 并做字节级校验...", flush=True)
    drive_zip_saved = ""
    if drive_mounted:
        t_cp0 = time.perf_counter()
        # 严格只写独立备份文件 ojousama_jp_voice_retake2x.zip，绝不覆盖 ojousama_jp_voice_pack_gptsovits.zip！
        drive_bytes = copy_zip_to_drive_atomic(local_zip_path, drive_retake_zip)
        drive_zip_saved = f"{drive_retake_zip} ({drive_bytes:,} bytes 字节校验一致, {time.perf_counter() - t_cp0:.1f}s)"
        print(f"✅ 云盘单文件同步并校验成功: {drive_zip_saved}", flush=True)
    else:
        print("ℹ️ 未挂载 Google Drive，跳过云盘单文件同步。", flush=True)

    qa_stats = json.loads(qa_report_path.read_text(encoding="utf-8")).get("stats", {})
    elapsed_min = (time.perf_counter() - t_cell_start) / 60.0

    print(
        "\n" + "=" * 78 + "\n"
        "🎉 《转生千金》GPT-SoVITS 缺陷句 2× 双版本精修重抽圆满完成！\n"
        + "=" * 78 + "\n"
        f"  • 计算设备     : {gpu_desc}\n"
        f"  • 总耗时       : {elapsed_min:.1f} 分钟\n"
        f"  • 重抽计划     : {plan_line_count} 条目标台词 × 2 Takes = {expected_take_mp3s} 条音频\n"
        f"  • 实盘打包 MP3 : {mp3_archived} / {expected_take_mp3s} 条 "
        f"(新合成={qa_stats.get('newlySynthesized', 0)}, 断点复用={qa_stats.get('skippedResume', 0)}, "
        f"换模={qa_stats.get('weightSwaps', 0)} 次, 警告={qa_stats.get('qcWarnings', 0)}, 失败={qa_stats.get('failed', 0)})\n"
        f"  • 压缩包体积   : {zip_size_mb:.2f} MB ({local_zip_bytes:,} bytes, ZIP_STORED, 共 {total_archived} 个文件)\n"
        f"  • 本地成品路径 : {local_zip_path}\n"
        f"  • 云盘独立备份 : {drive_zip_saved if drive_zip_saved else '(未挂载云盘)'}\n"
        "  • 正式包保护   : 未触碰 /content/drive/MyDrive/ojousama_jp_voice_pack_gptsovits.zip\n"
        + "=" * 78,
        flush=True,
    )

    try:
        from google.colab import files  # type: ignore

        print(f"⬇️ 正在触发浏览器自动下载 {local_zip_path} ...", flush=True)
        files.download(str(local_zip_path))
    except Exception as _dl_exc:
        print(f"ℹ️ 非交互环境未触发浏览器下载 ({_dl_exc})，请直接从 Google Drive 或 {local_zip_path} 获取。", flush=True)

    return 0


if __name__ == "__main__":
    main()
