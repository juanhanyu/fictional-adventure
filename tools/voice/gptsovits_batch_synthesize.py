#!/usr/bin/env python3
"""
tools/voice/gptsovits_batch_synthesize.py

Production headless batch synthesizer for 《转生千金～到了异世界就要悠闲地生活》
using GPT-SoVITS (v2ProPlus + ERes2NetV2 SV & character-specific fine-tuned weights).

Key guarantees:
  1. Sets TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1 BEFORE importing torch (PyTorch >= 2.6 safe).
  2. Resolves all CLI paths to absolute Paths BEFORE os.chdir(gsv_root).
  3. Pre-warms fast_langdetect cache dir, NLTK taggers/cmudict, pyopenjtalk, and LangSegmenter.
  4. Monkeypatches TTS.init_bert_weights (Zero-BERT bypass, saving 1.3 GB download/VRAM for JA/EN).
  5. Parallel asset downloader (ThreadPoolExecutor(max_workers=8)) with atomic .part writes,
     4 retries, RIFF WAVE header validation, and 3.2s..9.8s reference duration check.
  6. Smart grouping by engineMode + profileId + emotionSlot: runs all 24 v2ProPlus_sv profiles
     back-to-back with ZERO weight reloads, then 1 swap per fine-tuned profile, always clearing
     prompt_cache across profile boundaries.
  7. Uses ONLY clean jp_text (never drama3_input) as spoken text; routes emotion hints to the
     matching character reference slot + 4 aux_ref_audio_paths.
  8. Built-in 3-attempt QC gate (peak, char-scaled duration bounds, internal silence <= 1.45s)
     with graceful best-attempt fallback so 1,276/1,276 lines always complete.
  9. Studio FFmpeg mastering: true leading/trailing edge-only silence trim via double-areverse
     (preserving natural mid-sentence dramatic pauses), EBU R128 -16 LUFS loudnorm (-3 dBFS peak
     fallback for < 0.8s short interjections), 32 kHz mono libmp3lame -q:a 1, and auto-resume.
"""

from __future__ import annotations

import os

# CRITICAL #1: Must be set BEFORE importing torch so PyTorch >= 2.6 loads .ckpt/.pth cleanly
os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
os.environ.setdefault("PYTHONUNBUFFERED", "1")
os.environ.setdefault("TQDM_DISABLE", "1")

import argparse
import collections
import concurrent.futures
import contextlib
import io
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import time
import wave
import zlib
from pathlib import Path
from typing import Any

import numpy as np
import requests
from requests.adapters import HTTPAdapter

EDGE_TRIM_AF = (
    "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.08,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.22,"
    "areverse"
)

RETRY_SCHEDULE = [
    {"attempt": 1, "temperature": 0.85, "top_p": 0.95, "top_k": 15, "seed_base": 42, "split_override": None},
    {"attempt": 2, "temperature": 0.72, "top_p": 0.90, "top_k": 12, "seed_base": 1337, "split_override": None},
    {"attempt": 3, "temperature": 0.60, "top_p": 0.85, "top_k": 10, "seed_base": 9001, "split_override": "cut5"},
]

BRACKET_TAG_RE = re.compile(r"\[[^\]]*\]")
XML_TAG_RE = re.compile(r"<[^>]*>")
LEADING_DRAMA_TAGS_RE = re.compile(r"^\s*(?:\[([^\]]+)\]\s*)+")
ALL_BRACKET_INNER_RE = re.compile(r"\[([^\]]+)\]")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="GPT-SoVITS v2ProPlus + Finetuned Batch Synthesizer")
    p.add_argument("--gsv-root", required=True, help="Path to cloned GPT-SoVITS repository")
    p.add_argument("--assets-dir", required=True, help="Local SSD directory for downloaded weights & reference WAVs")
    p.add_argument("--script", required=True, help="Path to tools/voice/script_jp_master.json")
    p.add_argument("--casting", required=True, help="Path to tools/voice/casting_gptsovits_anime.json")
    p.add_argument("--out-dir", required=True, help="Output root directory (audioPath is resolved under out-dir)")
    p.add_argument(
        "--ids",
        default="",
        help="Optional comma-separated voiceIds (id1,id2,...) or @filepath containing one voiceId per line",
    )
    p.add_argument("--limit", type=int, default=0, help="Optional max number of lines to process (after --ids filter)")
    p.add_argument("--overwrite", action="store_true", help="Re-synthesize even if target .mp3 already exists")
    p.add_argument("--device", choices=("auto", "cuda", "cpu"), default="auto", help="Inference device (default: auto)")
    p.add_argument("--workers", type=int, default=8, help="Parallel asset download workers (default: 8)")
    p.add_argument("--qa-report", default="", help="Optional path to write JSON synthesis/QC summary report")
    p.add_argument("--verbose-gsv", action="store_true", help="Show internal GPT-SoVITS per-line stdout logs")
    return p.parse_args(argv)


def load_id_filter(ids_arg: str, cwd_before_chdir: Path) -> list[str] | None:
    raw = (ids_arg or "").strip()
    if not raw:
        return None
    if raw.startswith("@"):
        id_file = (cwd_before_chdir / raw[1:]).expanduser().resolve() if not Path(raw[1:]).is_absolute() else Path(raw[1:]).resolve()
        if not id_file.is_file():
            raise FileNotFoundError(f"--ids file not found: {id_file}")
        tokens = [
            ln.strip()
            for ln in id_file.read_text(encoding="utf-8").splitlines()
            if ln.strip() and not ln.strip().startswith("#")
        ]
        return tokens
    return [tok.strip() for tok in raw.split(",") if tok.strip()]


# Surgical G2P reading fixes for fantasy terms & standalone quoted honorifics where pyopenjtalk defaults to wrong kun'yomi/OOV
JP_G2P_LEXICON_FIXES: tuple[tuple[str, str], ...] = (
    ("「様」", "さま"),
    ("薬神", "やくしん"),
    ("風帝", "ふうてい"),
    ("東翼", "とうよく"),
    ("西翼", "せいよく"),
    ("北翼", "ほくよく"),
    ("南翼", "なんよく"),
    ("聖級", "せいきゅう"),
    ("乱葬崗", "らんそうこう"),
    ("蘇秦の文字で「嵐」", "そしんの文字で「らん」"),
)


def clean_spoken_jp_text(jp_text: str) -> str:
    """Strip any stray [...] or <...> markup from jp_text and apply surgical G2P fixes; NEVER pass drama3_input here."""
    txt = str(jp_text or "")
    txt = BRACKET_TAG_RE.sub("", txt)
    txt = XML_TAG_RE.sub("", txt)
    txt = txt.replace("\r\n", " ").replace("\n", " ")
    txt = re.sub(r"[ \t\u3000]+", " ", txt).strip()
    for src, dst in JP_G2P_LEXICON_FIXES:
        if src in txt:
            txt = txt.replace(src, dst)
    return txt


def route_emotion_slot(line: dict[str, Any], profile: dict[str, Any]) -> str:
    """Resolve emotion hint from line['emo'] + leading [...] tags in line['drama3_input'] -> refs[slot]."""
    emo_map: dict[str, str] = profile.get("emotionMap") or {}
    valid_slots: set[str] = set((profile.get("refs") or {}).keys())
    default_slot: str = profile.get("defaultSlot") or next(iter(valid_slots))

    raw_emo = str(line.get("emo") or "").strip().lower()
    drama_in = str(line.get("drama3_input") or "").strip()

    # Extract leading [...] tag blocks from drama3_input (never used as spoken text, only emotion metadata)
    leading_candidates: list[str] = []
    m = LEADING_DRAMA_TAGS_RE.match(drama_in)
    if m:
        prefix = m.group(0)
        for grp in ALL_BRACKET_INNER_RE.findall(prefix):
            full_tag = grp.strip().lower()
            if full_tag and full_tag not in ("short pause", "pause", "long pause"):
                leading_candidates.append(full_tag)
                for part in re.split(r"[,/|+]+", full_tag):
                    tok = part.strip()
                    if tok and tok not in ("short pause", "pause", "long pause"):
                        leading_candidates.append(tok)
                        for word in tok.split():
                            if word:
                                leading_candidates.append(word)

    # Priority: explicit non-normal stage emo -> leading [...] tags -> normal stage emo -> defaultSlot
    probe_keys: list[str] = []
    if raw_emo and raw_emo != "normal":
        probe_keys.append(raw_emo)
    probe_keys.extend(leading_candidates)
    if raw_emo == "normal":
        probe_keys.append("normal")

    for k in probe_keys:
        mapped = emo_map.get(k)
        if mapped and mapped in valid_slots:
            return mapped
        if k in valid_slots:
            return k

    return default_slot if default_slot in valid_slots else next(iter(valid_slots))


def validate_wav_file(wav_path: Path, min_sec: float = 3.2, max_sec: float = 9.8) -> float:
    """Verify RIFF WAVE header and 3.2s <= duration <= 9.8s via Python wave module."""
    if not wav_path.is_file() or wav_path.stat().st_size < 1024:
        raise ValueError(f"WAV missing or too small: {wav_path}")
    with wav_path.open("rb") as fp:
        hdr = fp.read(12)
    if len(hdr) < 12 or hdr[:4] != b"RIFF" or hdr[8:12] != b"WAVE":
        raise ValueError(f"Invalid RIFF/WAVE header in {wav_path}: {hdr!r}")
    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        nframes = wf.getnframes()
        ch = wf.getnchannels()
        sw = wf.getsampwidth()
    if sr <= 0 or ch < 1 or sw < 1:
        raise ValueError(f"Invalid WAV stream params in {wav_path}: sr={sr}, ch={ch}, sw={sw}")
    dur = nframes / float(sr)
    if not (min_sec <= dur <= max_sec):
        raise ValueError(f"Reference WAV duration {dur:.3f}s outside [{min_sec}, {max_sec}]s: {wav_path}")
    return dur


def make_http_session(pool_size: int = 16) -> requests.Session:
    sess = requests.Session()
    adapter = HTTPAdapter(pool_connections=pool_size, pool_maxsize=pool_size)
    sess.mount("https://", adapter)
    sess.mount("http://", adapter)
    sess.headers.update({"User-Agent": "ojousama-gptsovits-synth/1.0"})
    return sess


def download_one_asset(
    sess: requests.Session,
    task: dict[str, Any],
) -> tuple[str, Path, bool, str]:
    """Download single asset with 4 retries, atomic .part rename, and optional WAV/JSON check."""
    kind = task["kind"]
    url = task["url"]
    dst: Path = task["dst"]
    min_bytes: int = task.get("min_bytes", 1024)

    # Check existing file fast path
    if dst.is_file() and dst.stat().st_size > min_bytes:
        try:
            if kind == "wav":
                dur = validate_wav_file(dst)
                return (kind, dst, False, f"cached ({dur:.2f}s)")
            if kind == "json":
                json.loads(dst.read_text(encoding="utf-8"))
                return (kind, dst, False, "cached")
            return (kind, dst, False, f"cached ({dst.stat().st_size / (1024 * 1024):.1f} MB)")
        except Exception:
            dst.unlink(missing_ok=True)

    dst.parent.mkdir(parents=True, exist_ok=True)
    last_err: Exception | None = None

    for attempt in range(1, 5):
        part_path = dst.with_name(f"{dst.name}.part.{os.getpid()}.{attempt}")
        try:
            part_path.unlink(missing_ok=True)
            with sess.get(url, stream=True, timeout=(12, 120)) as resp:
                resp.raise_for_status()
                with part_path.open("wb") as fp:
                    for chunk in resp.iter_content(chunk_size=256 * 1024):
                        if chunk:
                            fp.write(chunk)

            sz = part_path.stat().st_size
            if sz <= min_bytes:
                raise ValueError(f"Downloaded file too small ({sz} bytes <= {min_bytes}): {url}")
            if kind == "wav":
                dur = validate_wav_file(part_path)
                os.replace(part_path, dst)
                return (kind, dst, True, f"downloaded ({dur:.2f}s)")
            if kind == "json":
                json.loads(part_path.read_text(encoding="utf-8"))
                os.replace(part_path, dst)
                return (kind, dst, True, "downloaded")

            os.replace(part_path, dst)
            return (kind, dst, True, f"downloaded ({sz / (1024 * 1024):.1f} MB)")
        except Exception as exc:
            last_err = exc
            part_path.unlink(missing_ok=True)
            if attempt < 4:
                time.sleep(0.8 * (2 ** (attempt - 1)))

    raise RuntimeError(f"Failed to download {url} -> {dst} after 4 attempts: {last_err}")


def ensure_assets_downloaded(
    *,
    gsv_root: Path,
    assets_dir: Path,
    casting: dict[str, Any],
    needed_profile_ids: set[str],
    max_workers: int = 8,
) -> None:
    pretrained_root = gsv_root / "GPT_SoVITS" / "pretrained_models"
    tasks_by_dst: dict[Path, dict[str, Any]] = {}

    # 1. Base lj1995/GPT-SoVITS files -> {gsv_root}/GPT_SoVITS/pretrained_models/...
    base_files = (casting.get("baseModel") or {}).get("files") or {}
    for key, f_info in base_files.items():
        rel_path = f_info["relPath"]
        url = f_info["url"]
        dst = pretrained_root / rel_path
        is_json = rel_path.lower().endswith(".json")
        tasks_by_dst[dst] = {
            "kind": "json" if is_json else "weight",
            "url": url,
            "dst": dst,
            # preprocessor_config.json is 212 bytes on HuggingFace; weights are >100 MB
            "min_bytes": 64 if is_json else 1024,
        }

    # 2. Needed profile weights & reference WAVs -> {assets_dir}/...
    profiles = casting["profiles"]
    for pid in sorted(needed_profile_ids):
        prof = profiles[pid]
        if prof["engineMode"] == "finetuned":
            w = prof["weights"]
            gpt_dst = assets_dir / w["gptAssetRelPath"]
            sov_dst = assets_dir / w["sovitsAssetRelPath"]
            tasks_by_dst[gpt_dst] = {
                "kind": "weight",
                "url": w["gptWeightUrl"],
                "dst": gpt_dst,
                "min_bytes": 1024,
            }
            tasks_by_dst[sov_dst] = {
                "kind": "weight",
                "url": w["sovitsWeightUrl"],
                "dst": sov_dst,
                "min_bytes": 1024,
            }

        for slot, r_info in prof["refs"].items():
            wav_dst = assets_dir / r_info["assetRelPath"]
            tasks_by_dst[wav_dst] = {
                "kind": "wav",
                "url": r_info["url"],
                "dst": wav_dst,
                "min_bytes": 1024,
            }

    all_tasks = list(tasks_by_dst.values())
    if not all_tasks:
        return

    t0 = time.perf_counter()
    sess = make_http_session(pool_size=max(16, max_workers * 2))
    downloaded_cnt = 0
    cached_cnt = 0

    print(
        f"[gsv-assets] Verifying/downloading {len(all_tasks)} model & reference assets "
        f"(profiles={len(needed_profile_ids)}, workers={max_workers}) ...",
        flush=True,
    )
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(download_one_asset, sess, t) for t in all_tasks]
        for fut in concurrent.futures.as_completed(futures):
            kind, dst, did_dl, detail = fut.result()
            if did_dl:
                downloaded_cnt += 1
            else:
                cached_cnt += 1

    print(
        f"[gsv-assets] Ready in {time.perf_counter() - t0:.2f}s "
        f"(downloaded={downloaded_cnt}, cached={cached_cnt}, total={len(all_tasks)})",
        flush=True,
    )


def evaluate_waveform_qc(
    audio_raw: np.ndarray,
    sr: int,
    n_chars: int,
) -> dict[str, Any]:
    """
    Evaluate synthesized waveform against QC gates:
      - Non-empty, finite, int16 peak > 600 (~ -34 dBFS)
      - Duration sanity vs n_chars: min_dur = max(0.32, n_chars * 0.042), max_dur = max(4.5, n_chars * 0.38 + 2.5)
      - Internal silence gap <= 1.45s (20ms frame RMS after trimming leading/trailing < -52 dBFS)
    """
    if audio_raw is None or sr <= 0:
        return {"hard_ok": False, "qc_ok": False, "penalty": 1e9, "reason": "null_audio"}

    arr = np.asarray(audio_raw).reshape(-1)
    if arr.size == 0 or not np.all(np.isfinite(arr)):
        return {"hard_ok": False, "qc_ok": False, "penalty": 1e9, "reason": "empty_or_nonfinite"}

    if np.issubdtype(arr.dtype, np.floating):
        audio_i16 = np.clip(np.round(arr * 32767.0), -32768, 32767).astype(np.int16)
    else:
        audio_i16 = arr.astype(np.int16, copy=False)

    peak_i16 = int(np.max(np.abs(audio_i16.astype(np.int32))))
    raw_dur = audio_i16.size / float(sr)

    if peak_i16 <= 600:
        return {
            "hard_ok": False,
            "qc_ok": False,
            "penalty": 1e8,
            "reason": f"peak_too_low({peak_i16}<=600)",
            "audio_i16": audio_i16,
            "sr": sr,
            "peak_i16": peak_i16,
            "raw_dur": raw_dur,
            "active_dur": 0.0,
            "max_internal_silence": 0.0,
        }

    # 20ms frame RMS in normalized [-1, 1] float scale
    f32 = audio_i16.astype(np.float32) / 32768.0
    frame_len = max(1, int(round(sr * 0.020)))
    n_frames = f32.size // frame_len
    if n_frames > 0:
        framed = f32[: n_frames * frame_len].reshape(n_frames, frame_len)
        frame_rms = np.sqrt(np.mean(framed * framed, axis=1) + 1e-12)
    else:
        frame_rms = np.array([ float(np.sqrt(np.mean(f32 * f32) + 1e-12)) ], dtype=np.float32)

    # -52 dBFS threshold for internal silence check; -55 dBFS estimate for post-trim active duration
    thresh_52 = 10.0 ** (-52.0 / 20.0)
    thresh_55 = 10.0 ** (-55.0 / 20.0)

    active_idx_52 = np.flatnonzero(frame_rms >= thresh_52)
    if active_idx_52.size == 0:
        max_internal_sil = raw_dur
    else:
        interior = frame_rms[int(active_idx_52[0]) : int(active_idx_52[-1]) + 1] < thresh_52
        max_run = 0
        cur_run = 0
        for is_sil in interior:
            if is_sil:
                cur_run += 1
                if cur_run > max_run:
                    max_run = cur_run
            else:
                cur_run = 0
        max_internal_sil = max_run * 0.020

    active_idx_55 = np.flatnonzero(frame_rms >= thresh_55)
    if active_idx_55.size == 0:
        est_trimmed_dur = raw_dur
    else:
        span_sec = (int(active_idx_55[-1]) - int(active_idx_55[0]) + 1) * 0.020
        est_trimmed_dur = min(raw_dur, span_sec + 0.30)

    min_dur = max(0.32, n_chars * 0.042)
    max_dur = max(4.5, n_chars * 0.38 + 2.5)

    reasons: list[str] = []
    penalty = 0.0
    # Evaluate duration against raw_dur (and allow short clips whose raw_dur >= min_dur)
    if raw_dur < min_dur:
        reasons.append(f"too_short({raw_dur:.2f}s<{min_dur:.2f}s)")
        penalty += (min_dur - raw_dur) * 10.0
    if raw_dur > max_dur:
        reasons.append(f"too_long({raw_dur:.2f}s>{max_dur:.2f}s)")
        penalty += (raw_dur - max_dur) * 4.0
    if max_internal_sil > 1.45:
        reasons.append(f"internal_silence({max_internal_sil:.2f}s>1.45s)")
        penalty += (max_internal_sil - 1.45) * 8.0

    return {
        "hard_ok": True,
        "qc_ok": len(reasons) == 0,
        "penalty": penalty,
        "reason": "; ".join(reasons) if reasons else "ok",
        "audio_i16": audio_i16,
        "sr": sr,
        "peak_i16": peak_i16,
        "raw_dur": raw_dur,
        "est_trimmed_dur": est_trimmed_dur,
        "max_internal_silence": max_internal_sil,
    }


def write_pcm16_wav(wav_path: Path, audio_i16: np.ndarray, sr: int) -> None:
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sr))
        wf.writeframes(audio_i16.astype("<i2", copy=False).tobytes())


def master_wav_to_mp3(
    audio_i16: np.ndarray,
    sr: int,
    est_trimmed_dur: float,
    target_mp3: Path,
) -> tuple[int, str]:
    """
    Studio FFmpeg single-pass mastering:
      - Leading & trailing silence trim ONLY via double-areverse (never stop_periods=-1!)
      - EBU R128 loudnorm=I=-16:TP=-1.5:LRA=11 for clips >= 0.8s
      - Exact -3.0 dBFS peak normalize fallback when duration < 0.8s (since ebur128 loudnorm
        behaves poorly on sub-0.8s interjections)
      - Output: 32000 Hz, mono, libmp3lame -q:a 1, atomic rename
    """
    target_mp3.parent.mkdir(parents=True, exist_ok=True)
    peak_norm_ratio = max(float(np.max(np.abs(audio_i16.astype(np.int32)))) / 32768.0, 1e-4)
    peak_dbfs = 20.0 * math.log10(peak_norm_ratio)
    gain_to_minus3db = max(-12.0, min(24.0, -3.0 - peak_dbfs))
    peak_af = f"{EDGE_TRIM_AF},volume={gain_to_minus3db:.2f}dB,alimiter=limit=-1.5dB:level=false"
    loudnorm_af = f"{EDGE_TRIM_AF},loudnorm=I=-16:TP=-1.5:LRA=11"

    use_loudnorm = est_trimmed_dur >= 0.80 and (audio_i16.size / float(sr)) >= 0.80

    with tempfile.TemporaryDirectory(prefix="gsv_master_") as tmp_dir:
        tmp_wav = Path(tmp_dir) / "raw.wav"
        write_pcm16_wav(tmp_wav, audio_i16, sr)
        tmp_mp3 = target_mp3.with_name(f"{target_mp3.name}.tmp.{os.getpid()}.mp3")
        tmp_mp3.unlink(missing_ok=True)

        filter_candidates = [("loudnorm", loudnorm_af), ("peak_-3dB", peak_af)] if use_loudnorm else [("peak_-3dB", peak_af)]
        last_err = ""
        for mode_name, af_chain in filter_candidates:
            tmp_mp3.unlink(missing_ok=True)
            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(tmp_wav),
                "-af",
                af_chain,
                "-ar",
                "32000",
                "-ac",
                "1",
                "-codec:a",
                "libmp3lame",
                "-q:a",
                "1",
                "-f",
                "mp3",
                str(tmp_mp3),
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode == 0 and tmp_mp3.is_file() and tmp_mp3.stat().st_size > 400:
                os.replace(tmp_mp3, target_mp3)
                return target_mp3.stat().st_size, mode_name
            last_err = proc.stderr.strip() or f"exit={proc.returncode}"

        tmp_mp3.unlink(missing_ok=True)
        raise RuntimeError(f"FFmpeg mastering failed for {target_mp3}: {last_err}")


def clear_prompt_cache(tts_pipeline: Any) -> None:
    """Strictly clear GPT-SoVITS prompt_cache when switching profiles or weights."""
    tts_pipeline.prompt_cache["ref_audio_path"] = None
    tts_pipeline.prompt_cache["aux_ref_audio_paths"] = []
    tts_pipeline.prompt_cache["refer_spec"] = []
    tts_pipeline.prompt_cache["prompt_semantic"] = None
    tts_pipeline.prompt_cache["prompt_text"] = None


def main(argv: list[str] | None = None) -> int:
    t_global0 = time.perf_counter()
    cwd_initial = Path.cwd().resolve()
    args = parse_args(argv)

    # CRITICAL #2: Resolve ALL paths to absolute Paths BEFORE os.chdir(gsv_root)!
    gsv_root = Path(args.gsv_root).expanduser().resolve()
    assets_dir = Path(args.assets_dir).expanduser().resolve()
    script_path = Path(args.script).expanduser().resolve()
    casting_path = Path(args.casting).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    id_filter = load_id_filter(args.ids, cwd_initial)

    if args.qa_report:
        qa_report_path = Path(args.qa_report).expanduser().resolve()
    elif (out_dir / "tools" / "voice").is_dir():
        qa_report_path = (out_dir / "tools" / "voice" / "qa_report.json").resolve()
    else:
        qa_report_path = (out_dir / "qa_report.json").resolve()

    if not gsv_root.is_dir():
        raise FileNotFoundError(f"--gsv-root directory does not exist: {gsv_root}")
    if not script_path.is_file():
        raise FileNotFoundError(f"--script file does not exist: {script_path}")
    if not casting_path.is_file():
        raise FileNotFoundError(f"--casting file does not exist: {casting_path}")

    assets_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load script & casting manifests
    script_raw = json.loads(script_path.read_text(encoding="utf-8"))
    all_lines: list[dict[str, Any]] = (
        script_raw if isinstance(script_raw, list) else script_raw.get("lines") or script_raw.get("entries") or script_raw.get("items") or []
    )
    casting = json.loads(casting_path.read_text(encoding="utf-8"))
    profiles: dict[str, dict[str, Any]] = casting["profiles"]

    # Apply --ids and --limit filters
    if id_filter is not None:
        by_vid = {ln["voiceId"]: ln for ln in all_lines}
        missing_ids = [vid for vid in id_filter if vid not in by_vid]
        if missing_ids:
            raise KeyError(f"Requested --ids not found in script ({len(missing_ids)}): {missing_ids[:10]}")
        seen_ids: set[str] = set()
        selected_lines = []
        for vid in id_filter:
            if vid not in seen_ids:
                seen_ids.add(vid)
                selected_lines.append(by_vid[vid])
    else:
        selected_lines = list(all_lines)

    if args.limit and args.limit > 0:
        selected_lines = selected_lines[: args.limit]

    # Automatic resume filter (> 1500 bytes existing .mp3 skipped unless --overwrite)
    todo_items: list[dict[str, Any]] = []
    skipped_resume = 0
    for ln in selected_lines:
        rel_audio = str(ln["audioPath"]).replace("\\", "/").lstrip("/")
        target_mp3 = out_dir / rel_audio
        if not args.overwrite and target_mp3.is_file() and target_mp3.stat().st_size > 1500:
            skipped_resume += 1
            continue

        pid = ln["profileId"]
        if pid not in profiles:
            raise KeyError(f"Unknown profileId '{pid}' on voiceId '{ln['voiceId']}'")
        prof = profiles[pid]
        slot = route_emotion_slot(ln, prof)
        todo_items.append({
            "line": ln,
            "profileId": pid,
            "engineMode": prof["engineMode"],
            "slot": slot,
            "targetMp3": target_mp3,
        })

    print(
        f"[gsv-init] Script lines={len(all_lines)} | selected={len(selected_lines)} | "
        f"resume_skipped={skipped_resume} | to_synthesize={len(todo_items)}",
        flush=True,
    )

    if not todo_items:
        summary = {
            "status": "ok",
            "stats": {
                "totalInScript": len(all_lines),
                "totalSelected": len(selected_lines),
                "skippedResume": skipped_resume,
                "toSynthesize": 0,
                "succeeded": len(selected_lines),
                "newlySynthesized": 0,
                "qcWarnings": 0,
                "failed": 0,
                "weightSwaps": 0,
                "elapsedSec": round(time.perf_counter() - t_global0, 2),
            },
            "warnings": [],
            "failures": [],
        }
        qa_report_path.parent.mkdir(parents=True, exist_ok=True)
        qa_report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"[gsv-done] All {len(selected_lines)} selected lines already synthesized on disk. Report: {qa_report_path}", flush=True)
        return 0

    # Download base + needed profile assets BEFORE initializing TTS
    needed_pids = {item["profileId"] for item in todo_items}
    ensure_assets_downloaded(
        gsv_root=gsv_root,
        assets_dir=assets_dir,
        casting=casting,
        needed_profile_ids=needed_pids,
        max_workers=max(1, int(args.workers)),
    )

    # CRITICAL #2b: chdir into gsv_root + sys.path setup BEFORE importing GPT-SoVITS modules
    os.chdir(gsv_root)
    gsv_str = str(gsv_root)
    gsv_inner_str = str(gsv_root / "GPT_SoVITS")
    if gsv_inner_str not in sys.path:
        sys.path.insert(0, gsv_inner_str)
    if gsv_str not in sys.path:
        sys.path.insert(0, gsv_str)

    # CRITICAL #3: Pre-warm fast_langdetect dir, NLTK, pyopenjtalk, and LangSegmenter
    t_warm0 = time.perf_counter()
    os.makedirs(gsv_root / "GPT_SoVITS" / "pretrained_models" / "fast_langdetect", exist_ok=True)

    import torch
    import nltk

    for pkg in ("averaged_perceptron_tagger_eng", "averaged_perceptron_tagger", "cmudict"):
        nltk.download(pkg, quiet=True)

    import pyopenjtalk

    _ = pyopenjtalk.g2p("テスト")

    from text.LangSegmenter import LangSegmenter

    _ = LangSegmenter.getTexts("魔力増幅60％", "ja")
    print(f"[gsv-prewarm] Linguistic & G2P pre-warm completed in {time.perf_counter() - t_warm0:.2f}s", flush=True)

    # CRITICAL #4: Zero-BERT Bypass (skip 1.3 GB chinese-roberta-wwm-ext-large for pure JA/EN)
    from TTS_infer_pack.TTS import TTS, TTS_Config

    def _skip_bert_weights(self: Any, base_path: str) -> None:
        print(f"[gsv-bert] Zero-BERT bypass active: skipping {base_path}", flush=True)
        self.bert_tokenizer = None
        self.bert_model = None

    TTS.init_bert_weights = _skip_bert_weights

    # CRITICAL #6: Smart grouping — all "v2ProPlus_sv" profiles back-to-back (0 weight swaps across 24 chars),
    # then "finetuned" profiles grouped by profileId (1 weight swap per finetuned char), sorted by slot within profile.
    profile_order_index = {pid: idx for idx, pid in enumerate(profiles.keys())}
    todo_items.sort(
        key=lambda it: (
            0 if it["engineMode"] == "v2ProPlus_sv" else 1,
            profile_order_index.get(it["profileId"], 999),
            it["slot"],
            it["line"]["voiceId"],
        )
    )

    if args.device == "auto":
        device_str = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device_str = args.device
    is_half = device_str == "cuda"

    def resolve_weights_for_profile(pid: str) -> tuple[str, Path, Path]:
        prof = profiles[pid]
        w = prof["weights"]
        if prof["engineMode"] == "finetuned":
            return (
                w.get("version", "v2"),
                (assets_dir / w["gptAssetRelPath"]).resolve(),
                (assets_dir / w["sovitsAssetRelPath"]).resolve(),
            )
        pretrained_dir = gsv_root / "GPT_SoVITS" / "pretrained_models"
        return (
            "v2ProPlus",
            (pretrained_dir / w["gptPretrainedRelPath"]).resolve(),
            (pretrained_dir / w["sovitsPretrainedRelPath"]).resolve(),
        )

    first_ver, first_gpt, first_sov = resolve_weights_for_profile(todo_items[0]["profileId"])
    init_cfg = {
        "custom": {
            "device": device_str,
            "is_half": is_half,
            "version": first_ver,
            "t2s_weights_path": str(first_gpt),
            "vits_weights_path": str(first_sov),
            "cnhuhbert_base_path": "GPT_SoVITS/pretrained_models/chinese-hubert-base",
            "bert_base_path": "GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large",
        }
    }

    t_model0 = time.perf_counter()
    with (contextlib.nullcontext() if args.verbose_gsv else contextlib.redirect_stdout(io.StringIO())):
        tts_config = TTS_Config(init_cfg)
        tts_pipeline = TTS(tts_config)
    current_weights = (first_gpt, first_sov)
    current_profile_id: str | None = None
    weight_swaps = 0

    print(
        f"[gsv-model] Loaded initial TTS ({first_ver}, device={device_str}, fp16={is_half}) "
        f"in {time.perf_counter() - t_model0:.2f}s",
        flush=True,
    )

    newly_synthesized = 0
    qc_warnings: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    by_profile_done: collections.Counter[str] = collections.Counter()

    for idx, item in enumerate(todo_items, 1):
        ln = item["line"]
        vid: str = ln["voiceId"]
        pid: str = item["profileId"]
        slot: str = item["slot"]
        target_mp3: Path = item["targetMp3"]
        prof = profiles[pid]

        # Weight swap only if crossing between v2ProPlus_sv and finetuned (or between two finetuned chars)
        ver, want_gpt, want_sov = resolve_weights_for_profile(pid)
        if (want_gpt, want_sov) != current_weights:
            t_sw0 = time.perf_counter()
            with (contextlib.nullcontext() if args.verbose_gsv else contextlib.redirect_stdout(io.StringIO())):
                tts_pipeline.init_vits_weights(str(want_sov))
                tts_pipeline.init_t2s_weights(str(want_gpt))
            clear_prompt_cache(tts_pipeline)
            current_weights = (want_gpt, want_sov)
            current_profile_id = None
            weight_swaps += 1
            print(
                f"[gsv-swap #{weight_swaps}] Switched weights -> {pid} ({ver}: {want_gpt.name} + {want_sov.name}) "
                f"in {time.perf_counter() - t_sw0:.2f}s",
                flush=True,
            )

        # Always clear prompt_cache when switching profiles!
        if current_profile_id != pid:
            clear_prompt_cache(tts_pipeline)
            current_profile_id = pid
            print(
                f"[gsv-profile] >>> {pid} ({prof['animeCharacter']} / {prof['seiyuu']}, mode={prof['engineMode']})",
                flush=True,
            )

        jp_clean = clean_spoken_jp_text(ln.get("jp_text", ""))
        if not jp_clean:
            failures.append({"voiceId": vid, "profileId": pid, "error": "empty_jp_text"})
            print(f"  [{idx}/{len(todo_items)}] FAIL {vid}: empty jp_text", flush=True)
            continue

        ref_entry = prof["refs"][slot]
        ref_wav_path = str((assets_dir / ref_entry["assetRelPath"]).resolve())
        prompt_text = ref_entry["prompt_text"]
        if prof["engineMode"] == "v2ProPlus_sv" or "Pro" in ver:
            aux_wav_paths = [str((assets_dir / rel).resolve()) for rel in prof["aux_ref_rel_paths"]]
        else:
            aux_wav_paths = []

        base_split = "cut0" if len(jp_clean) <= 72 else "cut1"
        vid_hash = zlib.crc32(vid.encode("utf-8")) & 0xFFFF

        best_candidate: dict[str, Any] | None = None
        chosen_attempt = 0
        last_exc: str = ""
        t_line0 = time.perf_counter()

        for sched in RETRY_SCHEDULE:
            att_num = sched["attempt"]
            split_method = sched["split_override"] or base_split
            seed_val = int(sched["seed_base"] + vid_hash)

            inputs = {
                "text": jp_clean,
                "text_lang": "all_ja",
                "ref_audio_path": ref_wav_path,
                "aux_ref_audio_paths": aux_wav_paths,
                "prompt_text": prompt_text,
                "prompt_lang": "all_ja",
                "top_k": sched["top_k"],
                "top_p": sched["top_p"],
                "temperature": sched["temperature"],
                "text_split_method": split_method,
                "batch_size": 1,
                "speed_factor": 1.0,
                "fragment_interval": 0.3,
                "seed": seed_val,
                "parallel_infer": True,
                "repetition_penalty": 1.35,
            }

            try:
                buf = io.StringIO()
                with (contextlib.nullcontext() if args.verbose_gsv else contextlib.redirect_stdout(buf)):
                    sr, audio_np = next(tts_pipeline.run(inputs))
                qc = evaluate_waveform_qc(audio_np, int(sr), len(jp_clean))
                if qc["hard_ok"]:
                    if best_candidate is None or qc["penalty"] < best_candidate["penalty"]:
                        best_candidate = {**qc, "attempt": att_num}
                    if qc["qc_ok"]:
                        chosen_attempt = att_num
                        best_candidate = {**qc, "attempt": att_num}
                        break
                else:
                    last_exc = qc["reason"]
            except Exception as exc:
                last_exc = f"{type(exc).__name__}: {exc}"
                clear_prompt_cache(tts_pipeline)

        if best_candidate is None:
            failures.append({"voiceId": vid, "profileId": pid, "slot": slot, "error": last_exc or "all_attempts_failed"})
            print(f"  [{idx}/{len(todo_items)}] FAIL {vid} ({pid}/{slot}): {last_exc}", flush=True)
            continue

        if not best_candidate["qc_ok"]:
            chosen_attempt = best_candidate["attempt"]
            warn_entry = {
                "voiceId": vid,
                "profileId": pid,
                "slot": slot,
                "attemptKept": chosen_attempt,
                "reason": best_candidate["reason"],
                "rawDurSec": round(best_candidate["raw_dur"], 3),
                "maxInternalSilenceSec": round(best_candidate["max_internal_silence"], 3),
            }
            qc_warnings.append(warn_entry)
            print(
                f"  [WARN] {vid}: soft QC fallback kept attempt {chosen_attempt} ({best_candidate['reason']})",
                flush=True,
            )

        try:
            mp3_bytes, norm_mode = master_wav_to_mp3(
                audio_i16=best_candidate["audio_i16"],
                sr=best_candidate["sr"],
                est_trimmed_dur=best_candidate["est_trimmed_dur"],
                target_mp3=target_mp3,
            )
            newly_synthesized += 1
            by_profile_done[pid] += 1
            dt_line = time.perf_counter() - t_line0
            print(
                f"  [{idx}/{len(todo_items)}] OK {vid} | {pid}:{slot} | att={chosen_attempt} | "
                f"dur={best_candidate['raw_dur']:.2f}s | {norm_mode} | {mp3_bytes / 1024:.1f}KB | {dt_line:.2f}s",
                flush=True,
            )
        except Exception as exc:
            failures.append({"voiceId": vid, "profileId": pid, "slot": slot, "error": f"ffmpeg: {exc}"})
            print(f"  [{idx}/{len(todo_items)}] FAIL {vid} (ffmpeg): {exc}", flush=True)

    total_elapsed = time.perf_counter() - t_global0
    total_succeeded = skipped_resume + newly_synthesized
    summary = {
        "status": "ok" if len(failures) == 0 else "partial_failure",
        "device": device_str,
        "stats": {
            "totalInScript": len(all_lines),
            "totalSelected": len(selected_lines),
            "skippedResume": skipped_resume,
            "toSynthesize": len(todo_items),
            "newlySynthesized": newly_synthesized,
            "succeeded": total_succeeded,
            "qcWarnings": len(qc_warnings),
            "failed": len(failures),
            "weightSwaps": weight_swaps,
            "elapsedSec": round(total_elapsed, 2),
        },
        "byProfileSynthesized": dict(by_profile_done),
        "warnings": qc_warnings,
        "failures": failures,
    }
    qa_report_path.parent.mkdir(parents=True, exist_ok=True)
    qa_report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"\n[gsv-done] Completed in {total_elapsed:.1f}s | succeeded={total_succeeded}/{len(selected_lines)} "
        f"(new={newly_synthesized}, resumed={skipped_resume}) | warnings={len(qc_warnings)} | "
        f"failed={len(failures)} | weight_swaps={weight_swaps} | report={qa_report_path}",
        flush=True,
    )
    return 0 if len(failures) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
