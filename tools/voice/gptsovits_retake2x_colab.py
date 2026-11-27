# @title 🎙️ 转生千金 · GPT-SoVITS 缺陷句 2× 双版本精修重抽（1-Cell 全自动版）
# 零 API Key · T=0s 复用/挂载云盘 · 复用现有 GPT-SoVITS/权重/依赖秒级启动 · 每条生成差异化 Take1+Take2 · 独立打包下载不覆盖正式语音包

from __future__ import annotations

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

# ==============================================================================
# 1. T=0s 挂载/复用 Google Drive（已在当前 Colab 运行时挂载则瞬时复用）
# ==============================================================================
t_cell_start = time.perf_counter()
DRIVE_MOUNT_POINT = Path("/content/drive")
DRIVE_MYDRIVE = DRIVE_MOUNT_POINT / "MyDrive"
DRIVE_RETAKE_CACHE_DIR = DRIVE_MYDRIVE / "ojousama_gptsovits_retake2x_cache"
DRIVE_RETAKE_ZIP = DRIVE_MYDRIVE / "ojousama_jp_voice_retake2x.zip"

drive_mounted = DRIVE_MYDRIVE.is_dir()
if drive_mounted:
    print(f"✅ [Step 1/7] 复用已挂载的 Google Drive: {DRIVE_MYDRIVE}", flush=True)
else:
    try:
        from google.colab import drive  # type: ignore

        print("🔗 [Step 1/7] 正在挂载 Google Drive（授权后全程零交互自动完成）...", flush=True)
        drive.mount(str(DRIVE_MOUNT_POINT), force_remount=False)
        drive_mounted = DRIVE_MYDRIVE.is_dir()
        if drive_mounted:
            print(f"✅ Google Drive 挂载成功: {DRIVE_MYDRIVE}", flush=True)
    except Exception as _drive_exc:
        print(f"ℹ️ 未挂载 Google Drive ({_drive_exc})，将以纯本地 /content 模式运行并在结束时触发浏览器下载。", flush=True)

# ==============================================================================
# 2. 严格本地 NVMe SSD 路径隔离（严禁模型权重 / HF 缓存 / 工作目录落入 /content/drive FUSE！）
# ==============================================================================
REPO_URL = "https://github.com/juanhanyu/fictional-adventure.git"
GSV_REPO_URL = "https://github.com/RVC-Boss/GPT-SoVITS.git"

CONTENT_ROOT = Path("/content") if Path("/content").is_dir() else Path.cwd() / "_colab_content"
REPO_DIR = CONTENT_ROOT / "fictional-adventure"
GSV_DIR = CONTENT_ROOT / "GPT-SoVITS"
ASSETS_DIR = CONTENT_ROOT / "gsv_assets"
HF_HOME_DIR = CONTENT_ROOT / "hf_cache"
NLTK_DATA_DIR = CONTENT_ROOT / "nltk_data"
WORK_DIR = CONTENT_ROOT / "retake2x_work"
LOCAL_ZIP_PATH = CONTENT_ROOT / "ojousama_jp_voice_retake2x.zip"

for _ssd_path in (REPO_DIR, GSV_DIR, ASSETS_DIR, HF_HOME_DIR, NLTK_DATA_DIR, WORK_DIR, LOCAL_ZIP_PATH):
    _resolved_str = str(_ssd_path.resolve())
    assert not _resolved_str.startswith("/content/drive"), (
        f"致命路径隔离违规：高速本地路径 {_ssd_path} ({_resolved_str}) 严禁位于 /content/drive 下！"
    )

for _d in (ASSETS_DIR, HF_HOME_DIR, NLTK_DATA_DIR, WORK_DIR):
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
# 3. 安全清理残留 GPU 推理进程（严禁触碰 ipykernel / jupyter / colab / dap_multiplexer）
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
# 4. 同步最新 origin/main 仓库，复用本地 /content/GPT-SoVITS 与 /content/gsv_assets
# ==============================================================================
print("\n📥 [Step 3/7] 拉取最新 fictional-adventure (origin/main) 并复用本地 GPT-SoVITS / 权重缓存...", flush=True)
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
    print(f"✅ 复用本地已存在的 GPT-SoVITS 引擎: {GSV_DIR}", flush=True)

cached_assets_cnt = sum(1 for _ in ASSETS_DIR.rglob("*") if _.is_file())
print(f"✅ 本地角色权重与参考音缓存目录: {ASSETS_DIR} (已有 {cached_assets_cnt} 个文件)", flush=True)

# 清理残缺 .tmp.mp3，并从云盘断点缓存恢复已完成 2x 音频（支持中断续跑）
retake_out_root = WORK_DIR / "retake2x"
retake_out_root.mkdir(parents=True, exist_ok=True)
for _stale_tmp in retake_out_root.rglob("*.tmp.*.mp3"):
    _stale_tmp.unlink(missing_ok=True)

if drive_mounted and DRIVE_RETAKE_CACHE_DIR.is_dir():
    cache_src_root = DRIVE_RETAKE_CACHE_DIR / "retake2x"
    if not cache_src_root.is_dir():
        cache_src_root = DRIVE_RETAKE_CACHE_DIR
    restored = 0
    for cached_mp3 in cache_src_root.rglob("*.mp3"):
        if cached_mp3.is_file() and ".tmp." not in cached_mp3.name and cached_mp3.stat().st_size > 1500:
            rel = cached_mp3.relative_to(cache_src_root)
            dst = retake_out_root / rel
            if not dst.is_file() or dst.stat().st_size <= 1500:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(cached_mp3, dst)
                restored += 1
    cached_manifest = cache_src_root / "retake2x_manifest.json"
    local_manifest = retake_out_root / "retake2x_manifest.json"
    if cached_manifest.is_file() and not local_manifest.is_file():
        shutil.copy2(cached_manifest, local_manifest)
    if restored > 0:
        print(f"♻️ 已从 Google Drive ({DRIVE_RETAKE_CACHE_DIR.name}) 恢复 {restored} 条已完成 MP3 断点续跑！", flush=True)

# ==============================================================================
# 5. 秒级依赖检查（已有 Colab 环境全套就绪则跳过 pip，全新环境自动补齐）
# ==============================================================================
print("\n📦 [Step 4/7] 检查 GPT-SoVITS 运行时依赖（已安装则直接复用）...", flush=True)
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

# 轻量探测 torchaudio.load，仅在失败时按需补装 torchcodec
_ta_probe_wav = CONTENT_ROOT / "_ta_probe_retake2x.wav"
try:
    with wave.open(str(_ta_probe_wav), "wb") as _wf:
        _wf.setnchannels(1)
        _wf.setsampwidth(2)
        _wf.setframerate(16000)
        _wf.writeframes(b"\x00\x00" * 1600)
    _ta_probe_rc = subprocess.run(
        [sys.executable, "-c", f"import torchaudio; torchaudio.load({str(_ta_probe_wav)!r})"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
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
retake_plan_path = REPO_DIR / "tools" / "voice" / "retake_v2_plan.json"
if not retake_plan_path.is_file():
    raise FileNotFoundError(f"未找到精修重抽计划文件: {retake_plan_path}")

_plan_data = json.loads(retake_plan_path.read_text(encoding="utf-8"))
_plan_entries = _plan_data.get("entries") if isinstance(_plan_data, dict) else _plan_data
plan_line_count = len(_plan_entries) if isinstance(_plan_entries, (list, dict)) else 0
expected_take_mp3s = plan_line_count * 2

print(
    f"\n🎙️ [Step 5/7] 启动 2× 双版本精修重抽：{plan_line_count} 条目标句 × 2 Takes = {expected_take_mp3s} 条 MP3 ...",
    flush=True,
)
qa_report_path = WORK_DIR / "retake_qa_report.json"
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
        "--retake-plan",
        "tools/voice/retake_v2_plan.json",
        "--takes",
        "2",
        "--out-dir",
        str(WORK_DIR),
        "--qa-report",
        str(qa_report_path),
    ],
    cwd=REPO_DIR,
)

# 将产物增量同步到独立云盘断点缓存（严禁触碰正式语音包目录）
if drive_mounted:
    print("\n☁️ [Step 6/7] 同步 2× 重抽缓存至 Google Drive（独立目录，绝不覆盖正式语音包）...", flush=True)
    try:
        drive_retake_sub = DRIVE_RETAKE_CACHE_DIR / "retake2x"
        drive_retake_sub.mkdir(parents=True, exist_ok=True)
        for mp3_file in retake_out_root.rglob("*.mp3"):
            if mp3_file.is_file() and ".tmp." not in mp3_file.name and mp3_file.stat().st_size > 1500:
                rel = mp3_file.relative_to(retake_out_root)
                dst = drive_retake_sub / rel
                if not dst.is_file() or dst.stat().st_size != mp3_file.stat().st_size:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(mp3_file, dst)
        manifest_src = retake_out_root / "retake2x_manifest.json"
        if manifest_src.is_file():
            shutil.copy2(manifest_src, drive_retake_sub / "retake2x_manifest.json")
    except OSError as _cache_exc:
        print(f"⚠️ 云盘增量缓存跳过 ({_cache_exc})，继续执行独立打包与下载。", flush=True)
else:
    print("\nℹ️ [Step 6/7] 未挂载云盘，跳过云盘断点缓存同步。", flush=True)

# ==============================================================================
# 7. 打包 /content/ojousama_jp_voice_retake2x.zip、备份云盘并自动触发浏览器下载
# ==============================================================================
print("\n📦 [Step 7/7] 打包 2× 双版本精修包 ojousama_jp_voice_retake2x.zip ...", flush=True)
manifest_path = retake_out_root / "retake2x_manifest.json"
if not manifest_path.is_file():
    raise FileNotFoundError(f"缺失 2× 清单产物: {manifest_path}")
if not qa_report_path.is_file():
    raise FileNotFoundError(f"缺失重抽质检报告: {qa_report_path}")

LOCAL_ZIP_PATH.unlink(missing_ok=True)
mp3_archived = 0
total_archived = 0
with zipfile.ZipFile(LOCAL_ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for p in sorted(retake_out_root.rglob("*.mp3")):
        if not p.is_file() or ".tmp." in p.name:
            continue
        arcname = p.relative_to(WORK_DIR).as_posix()
        zf.write(p, arcname=arcname, compress_type=zipfile.ZIP_STORED)
        mp3_archived += 1
        total_archived += 1

    zf.write(manifest_path, arcname="retake2x/retake2x_manifest.json", compress_type=zipfile.ZIP_DEFLATED)
    total_archived += 1
    zf.write(qa_report_path, arcname="retake_qa_report.json", compress_type=zipfile.ZIP_DEFLATED)
    total_archived += 1

zip_size_mb = LOCAL_ZIP_PATH.stat().st_size / (1024 * 1024)

drive_zip_saved = ""
if drive_mounted:
    try:
        # 严格只写独立备份文件 ojousama_jp_voice_retake2x.zip，绝不覆盖 ojousama_jp_voice_pack_gptsovits.zip！
        shutil.copy2(LOCAL_ZIP_PATH, DRIVE_RETAKE_ZIP)
        drive_zip_saved = str(DRIVE_RETAKE_ZIP)
    except OSError as _cp_exc:
        print(f"⚠️ 备份至 {DRIVE_RETAKE_ZIP} 失败 ({_cp_exc})，本地成品包完好: {LOCAL_ZIP_PATH}", flush=True)

qa_stats = json.loads(qa_report_path.read_text(encoding="utf-8")).get("stats", {})
elapsed_min = (time.perf_counter() - t_cell_start) / 60.0

print(
    "\n" + "=" * 76 + "\n"
    "🎉 《转生千金》GPT-SoVITS 缺陷句 2× 双版本精修重抽完成！\n"
    + "=" * 76 + "\n"
    f"  • 计算设备     : {gpu_desc}\n"
    f"  • 总耗时       : {elapsed_min:.1f} 分钟\n"
    f"  • 重抽计划     : {plan_line_count} 条目标台词 × 2 Takes = {expected_take_mp3s} 条音频\n"
    f"  • 实际打包 MP3 : {mp3_archived} / {expected_take_mp3s} 条 "
    f"(新合成={qa_stats.get('newlySynthesized', 0)}, 断点复用={qa_stats.get('skippedResume', 0)}, "
    f"换模={qa_stats.get('weightSwaps', 0)} 次, 警告={qa_stats.get('qcWarnings', 0)}, 失败={qa_stats.get('failed', 0)})\n"
    f"  • 压缩包体积   : {zip_size_mb:.2f} MB (共 {total_archived} 个文件：retake2x/**/*.mp3 + retake2x_manifest.json + retake_qa_report.json)\n"
    f"  • 本地成品路径 : {LOCAL_ZIP_PATH}\n"
    f"  • 云盘独立备份 : {drive_zip_saved if drive_zip_saved else '(未挂载云盘)'}\n"
    "  • 正式包保护   : 未触碰 /content/drive/MyDrive/ojousama_jp_voice_pack_gptsovits.zip\n"
    + "=" * 76,
    flush=True,
)

try:
    from google.colab import files  # type: ignore

    print(f"⬇️ 正在触发浏览器自动下载 {LOCAL_ZIP_PATH} ...", flush=True)
    files.download(str(LOCAL_ZIP_PATH))
except Exception as _dl_exc:
    print(f"ℹ️ 非交互环境未触发浏览器下载 ({_dl_exc})，请直接从 Google Drive 或 {LOCAL_ZIP_PATH} 获取。", flush=True)
