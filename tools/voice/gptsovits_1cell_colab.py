# @title 🎙️ 转生千金 · GPT-SoVITS v2ProPlus 极致二次元全角色日配一键生产（1-Cell 全自动版）
# 零 API Key · T=0s 挂载云盘后全程无人值守 · 本地 NVMe SSD 高速推理 · 25 角色零撞车二次元日配 · 自动构建 Manifest 并下载语音包

from __future__ import annotations

import collections
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import zipfile
from pathlib import Path

# ==============================================================================
# 1. T=0s 立即请求挂载 Google Drive（用户开局点一次授权即可离开，非 Colab 环境平滑降级）
# ==============================================================================
t_cell_start = time.perf_counter()
DRIVE_MOUNT_POINT = Path("/content/drive")
DRIVE_MYDRIVE = DRIVE_MOUNT_POINT / "MyDrive"
DRIVE_CACHE_VOICE_DIR = DRIVE_MYDRIVE / "ojousama_gptsovits_cache" / "assets_voice"
DRIVE_ZIP_PRIMARY = DRIVE_MYDRIVE / "ojousama_jp_voice_pack.zip"
DRIVE_ZIP_GSV = DRIVE_MYDRIVE / "ojousama_jp_voice_pack_gptsovits.zip"

drive_mounted = False
try:
    from google.colab import drive  # type: ignore

    print("🔗 [Step 1/7] 正在挂载 Google Drive（请在弹窗中点击允许，授权后全程零交互自动完成）...", flush=True)
    drive.mount(str(DRIVE_MOUNT_POINT), force_remount=False)
    drive_mounted = DRIVE_MYDRIVE.is_dir()
    if drive_mounted:
        print(f"✅ Google Drive 挂载成功: {DRIVE_MYDRIVE}", flush=True)
except Exception as _drive_exc:
    print(f"ℹ️ 未挂载 Google Drive ({_drive_exc})，将以纯本地 /content 模式运行并在结束时触发浏览器下载。", flush=True)

# ==============================================================================
# 2. 严格本地 NVMe SSD 路径隔离（严禁模型权重 / HF 缓存 / 参考音落入 /content/drive FUSE！）
# ==============================================================================
REPO_URL = "https://github.com/juanhanyu/fictional-adventure.git"
GSV_REPO_URL = "https://github.com/RVC-Boss/GPT-SoVITS.git"

CONTENT_ROOT = Path("/content") if Path("/content").is_dir() else Path.cwd() / "_colab_content"
REPO_DIR = CONTENT_ROOT / "fictional-adventure"
GSV_DIR = CONTENT_ROOT / "GPT-SoVITS"
ASSETS_DIR = CONTENT_ROOT / "gsv_assets"
HF_HOME_DIR = CONTENT_ROOT / "hf_cache"
NLTK_DATA_DIR = CONTENT_ROOT / "nltk_data"
LOCAL_ZIP_PATH = CONTENT_ROOT / "ojousama_jp_voice_pack.zip"

for _ssd_path in (REPO_DIR, GSV_DIR, ASSETS_DIR, HF_HOME_DIR, NLTK_DATA_DIR, LOCAL_ZIP_PATH):
    _resolved_str = str(_ssd_path.resolve())
    assert not _resolved_str.startswith("/content/drive"), (
        f"致命路径隔离违规：高速本地路径 {_ssd_path} ({_resolved_str}) 严禁位于 /content/drive 下！"
    )

for _d in (ASSETS_DIR, HF_HOME_DIR, NLTK_DATA_DIR):
    _d.mkdir(parents=True, exist_ok=True)

os.environ["PYTHONUNBUFFERED"] = "1"
os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
os.environ["HF_HOME"] = str(HF_HOME_DIR)
os.environ["HUGGINGFACE_HUB_CACHE"] = str(HF_HOME_DIR / "hub")
os.environ["NLTK_DATA"] = str(NLTK_DATA_DIR)
os.environ.pop("TRANSFORMERS_CACHE", None)


def run_stream(cmd: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None, check: bool = True) -> int:
    """实时流式打印子进程输出，失败时附上末尾 80 行完整上下文。"""
    print(f"\n$ {' '.join(cmd)}", flush=True)
    run_env = (env or os.environ).copy()
    run_env["PYTHONUNBUFFERED"] = "1"
    run_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
    tail: collections.deque[str] = collections.deque(maxlen=80)

    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd) if cwd is not None else None,
        env=run_env,
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


# ==============================================================================
# 3. 安全清理残留推理进程（严禁触碰 ipykernel / jupyter / colab / dap_multiplexer）
# ==============================================================================
def cleanup_stale_gpu_workers() -> None:
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


print("\n🧹 [Step 2/7] 检查 GPU 环境与残留进程...", flush=True)
cleanup_stale_gpu_workers()

gpu_desc = "CPU (未检测到 CUDA GPU，建议在 Colab 切换至 T4 / L4 / A100 GPU 运行)"
try:
    import torch

    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        dev_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        gpu_desc = f"{dev_name} ({vram_gb:.1f} GB VRAM, CUDA {torch.version.cuda})"
except Exception as _gpu_exc:
    gpu_desc = f"GPU 探测异常 ({_gpu_exc})"
print(f"🖥️ 当前计算设备: {gpu_desc}", flush=True)

# ==============================================================================
# 4. 克隆 / 更新游戏主仓库与 GPT-SoVITS 推理引擎至本地 SSD
# ==============================================================================
print("\n📥 [Step 3/7] 同步 fictional-adventure (main) 与 GPT-SoVITS 仓库至本地 NVMe SSD...", flush=True)
if (REPO_DIR / ".git").is_dir():
    run_stream(["git", "fetch", "origin", "main", "--depth", "1"], cwd=REPO_DIR)
    run_stream(["git", "reset", "--hard", "origin/main"], cwd=REPO_DIR)
else:
    shutil.rmtree(REPO_DIR, ignore_errors=True)
    run_stream(["git", "clone", "--branch", "main", "--depth", "1", REPO_URL, str(REPO_DIR)])

if not (GSV_DIR / "GPT_SoVITS" / "TTS_infer_pack" / "TTS.py").is_file():
    shutil.rmtree(GSV_DIR, ignore_errors=True)
    run_stream(["git", "clone", "--depth", "1", GSV_REPO_URL, str(GSV_DIR)])
else:
    print(f"✅ 复用本地已存在的 GPT-SoVITS 引擎目录: {GSV_DIR}", flush=True)

# 若云盘存在上一次中断留下的 GPT-SoVITS 断点缓存，先考回本地 SSD 以便秒级断点续传
repo_voice_dir = REPO_DIR / "assets" / "voice"
repo_voice_dir.mkdir(parents=True, exist_ok=True)
if drive_mounted and DRIVE_CACHE_VOICE_DIR.is_dir():
    restored = 0
    for cached_mp3 in DRIVE_CACHE_VOICE_DIR.rglob("*.mp3"):
        if cached_mp3.is_file() and cached_mp3.stat().st_size > 1500:
            rel = cached_mp3.relative_to(DRIVE_CACHE_VOICE_DIR)
            dst = repo_voice_dir / rel
            if not dst.is_file() or dst.stat().st_size <= 1500:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(cached_mp3, dst)
                restored += 1
    if restored > 0:
        print(f"♻️ 已从 Google Drive 恢复 {restored} 条已完成 MP3 至本地 SSD 断点续跑！", flush=True)

# ==============================================================================
# 5. 安装经实测验证的最小化 GPT-SoVITS 依赖集（零重装 Colab 原生 CUDA PyTorch）
# ==============================================================================
print("\n📦 [Step 4/7] 安装 GPT-SoVITS 最小验证依赖包...", flush=True)
VERIFIED_PIP_PACKAGES = [
    "torchcodec",
    "resampy",
    "soundfile",
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

# ==============================================================================
# 6. 全量运行 1,276 条台词合成（智能分组零重复换模 + 3 档重试质检 + 双重静音精修）
# ==============================================================================
print("\n🎙️ [Step 5/7] 启动全角色 1,276 条日配批量推理...", flush=True)
qa_report_path = REPO_DIR / "tools" / "voice" / "qa_report.json"
run_stream(
    [
        sys.executable,
        "tools/voice/gptsovits_batch_synthesize.py",
        "--gsv-root",
        str(GSV_DIR),
        "--assets-dir",
        str(ASSETS_DIR),
        "--script",
        "tools/voice/script_jp_master.json",
        "--casting",
        "tools/voice/casting_gptsovits_anime.json",
        "--out-dir",
        str(REPO_DIR),
        "--qa-report",
        str(qa_report_path),
    ],
    cwd=REPO_DIR,
)

# 将最新合成的 MP3 增量同步至云盘断点目录（防止后续意外断连丢失）
if drive_mounted:
    try:
        DRIVE_CACHE_VOICE_DIR.mkdir(parents=True, exist_ok=True)
        for mp3_file in repo_voice_dir.rglob("*.mp3"):
            if mp3_file.is_file() and not mp3_file.name.endswith(".tmp.mp3") and mp3_file.stat().st_size > 1500:
                rel = mp3_file.relative_to(repo_voice_dir)
                dst = DRIVE_CACHE_VOICE_DIR / rel
                if not dst.is_file() or dst.stat().st_size != mp3_file.stat().st_size:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(mp3_file, dst)
    except OSError as _cache_exc:
        print(f"⚠️ 云盘增量缓存跳过 ({_cache_exc})，继续执行严格清单校验与打包。", flush=True)

# ==============================================================================
# 7. 严格构建 Manifest（空格分隔参数，1,276/1,276 零坏链 & <= 120 MB 预算门禁）
# ==============================================================================
print("\n📜 [Step 6/7] 运行 build_manifest.mjs --strict 校验全量语音并生成 js/voice-manifest.js ...", flush=True)
run_stream(
    [
        "node",
        "tools/voice/build_manifest.mjs",
        "--voice-dir",
        "assets/voice",
        "--strict",
        "--budget-mb",
        "120",
    ],
    cwd=REPO_DIR,
)

# ==============================================================================
# 8. 打包 /content/ojousama_jp_voice_pack.zip、双路备份云盘并触发浏览器自动下载
# ==============================================================================
print("\n📦 [Step 7/7] 打包成品语音包 ojousama_jp_voice_pack.zip ...", flush=True)
js_manifest_path = REPO_DIR / "js" / "voice-manifest.js"
json_manifest_path = repo_voice_dir / "manifest.json"
if not js_manifest_path.is_file() or not json_manifest_path.is_file():
    raise FileNotFoundError(f"缺失 Manifest 产物: {js_manifest_path} 或 {json_manifest_path}")

LOCAL_ZIP_PATH.unlink(missing_ok=True)
mp3_archived = 0
total_archived = 0
with zipfile.ZipFile(LOCAL_ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for p in sorted(repo_voice_dir.rglob("*")):
        if not p.is_file() or p.name.endswith(".tmp.mp3"):
            continue
        arcname = p.relative_to(REPO_DIR).as_posix()
        comp = zipfile.ZIP_STORED if p.suffix.lower() == ".mp3" else zipfile.ZIP_DEFLATED
        zf.write(p, arcname=arcname, compress_type=comp)
        total_archived += 1
        if p.suffix.lower() == ".mp3":
            mp3_archived += 1

    zf.write(js_manifest_path, arcname="js/voice-manifest.js", compress_type=zipfile.ZIP_DEFLATED)
    total_archived += 1

zip_size_mb = LOCAL_ZIP_PATH.stat().st_size / (1024 * 1024)

drive_saved_paths: list[str] = []
if drive_mounted:
    for dst_zip in (DRIVE_ZIP_PRIMARY, DRIVE_ZIP_GSV):
        try:
            shutil.copy2(LOCAL_ZIP_PATH, dst_zip)
            drive_saved_paths.append(str(dst_zip))
        except OSError as _cp_exc:
            print(f"⚠️ 备份至 {dst_zip} 失败 ({_cp_exc})，本地包完好: {LOCAL_ZIP_PATH}", flush=True)

qa_stats = {}
if qa_report_path.is_file():
    qa_stats = json.loads(qa_report_path.read_text(encoding="utf-8")).get("stats", {})

elapsed_min = (time.perf_counter() - t_cell_start) / 60.0
print(
    "\n" + "=" * 72 + "\n"
    "🎉 《转生千金》GPT-SoVITS 全角色二次元日语配音包生产完成！\n"
    + "=" * 72 + "\n"
    f"  • 计算设备     : {gpu_desc}\n"
    f"  • 总耗时       : {elapsed_min:.1f} 分钟\n"
    f"  • 台词完成数   : {mp3_archived} / 1276 条 MP3 (模型切换仅 {qa_stats.get('weightSwaps', 1)} 次)\n"
    f"  • 压缩包体积   : {zip_size_mb:.2f} MB (共 {total_archived} 个文件，含 assets/voice/** + js/voice-manifest.js)\n"
    f"  • 本地成品路径 : {LOCAL_ZIP_PATH}\n"
    f"  • 云盘双备份   : {', '.join(drive_saved_paths) if drive_saved_paths else '(未挂载云盘)'}\n"
    "  • 仓库解压命令 : unzip -o ojousama_jp_voice_pack.zip -d .\n"
    + "=" * 72,
    flush=True,
)

try:
    from google.colab import files  # type: ignore

    print("⬇️ 正在触发浏览器自动下载 /content/ojousama_jp_voice_pack.zip ...", flush=True)
    files.download(str(LOCAL_ZIP_PATH))
except Exception as _dl_exc:
    print(f"ℹ️ 非交互环境未触发浏览器下载 ({_dl_exc})，请直接从 Google Drive 或 {LOCAL_ZIP_PATH} 获取。", flush=True)
