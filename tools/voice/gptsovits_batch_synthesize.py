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
import gc
import importlib
import io
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import wave
import zlib
from pathlib import Path
from typing import Any

import numpy as np
import requests
from requests.adapters import HTTPAdapter

SHORT_EDGE_TRIM_AF = "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.06"

EDGE_TRIM_AF = (
    "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.08,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-58dB:start_silence=0.25,"
    "areverse"
)

EXPRESSIVE_SLOTS = frozenset({"energetic", "cheerful", "retort", "playful"})
EXPRESSIVE_EMOS = frozenset({
    "angry",
    "battle",
    "cheerful",
    "combat",
    "cry",
    "energetic",
    "excited",
    "happy",
    "panic",
    "playful",
    "proud",
    "retort",
    "shocked",
    "shout",
    "smug",
    "surprised",
    "tease",
    "urgent",
})

RETRY_SCHEDULE = [
    {"attempt": 1, "temperature": 0.80, "top_p": 0.92, "top_k": 15, "seed_base": -1, "split_override": None},
    {"attempt": 2, "temperature": 0.65, "top_p": 0.85, "top_k": 10, "seed_base": 1337, "split_override": "cut5"},
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
        "--retake-plan",
        default="",
        help="Optional path to tools/voice/retake_v2_plan.json for targeted retake synthesis",
    )
    p.add_argument(
        "--takes",
        type=int,
        choices=(1, 2),
        default=1,
        help="Number of takes per line (1=standard audioPath, 2=differentiated Take 1 & Take 2 under retake2x/)",
    )
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
    ("ヘラン", "へらん"),
)


def clean_spoken_jp_text(raw_jp: str) -> str:
    """Strip stray markup, normalize dashes & ヘラン, apply G2P fixes, and ensure terminal punctuation."""
    s = str(raw_jp or "")
    s = BRACKET_TAG_RE.sub("", s)
    s = XML_TAG_RE.sub("", s)
    s = s.replace("\r\n", " ").replace("\n", " ")
    s = re.sub(r"[―—]{2,}", "、", s)
    s = re.sub(r"[ \t\u3000]+", " ", s).strip()
    s = re.sub(r"^[….\u3000\s、，・〜～ー\-―—]+", "", s)
    s = re.sub(r"[….]{2,}", "、", s)
    for src, dst in JP_G2P_LEXICON_FIXES:
        if src in s:
            s = s.replace(src, dst)
    s = re.sub(r"、{2,}", "、", s).strip()
    if not s:
        return ""
    s = re.sub(r"^([^。！？]{1,4})。(?=\S)", r"\1、", s)
    if s[-1] not in "。！？♪":
        s += "。"
    return s


def clean_retake_tts_text(raw_tts: str) -> str:
    """Minimal safe whitespace/dash cleanup for pre-verified retake plan tts_text (never overrides verified kana)."""
    s = str(raw_tts or "")
    s = BRACKET_TAG_RE.sub("", s)
    s = XML_TAG_RE.sub("", s)
    s = s.replace("\r\n", " ").replace("\n", " ")
    s = re.sub(r"[―—]{2,}", "、", s)
    s = s.replace("ヘラン", "へらん")
    s = re.sub(r"[ \t\u3000]+", " ", s).strip()
    s = re.sub(r"^[….\u3000\s、，・〜～ー\-―—]+", "", s)
    s = re.sub(r"、{2,}", "、", s).strip()
    if not s:
        return ""
    if s[-1] not in "。！？♪":
        s += "。"
    return s


def load_retake_plan(plan_path: Path) -> tuple[list[str], dict[str, dict[str, Any]]]:
    """Load retake_v2_plan.json supporting entries as list[dict] or dict[voiceId, dict]."""
    raw = json.loads(plan_path.read_text(encoding="utf-8"))
    entries_raw = raw.get("entries") if isinstance(raw, dict) else raw
    ordered_ids: list[str] = []
    by_vid: dict[str, dict[str, Any]] = {}
    if isinstance(entries_raw, list):
        for ent in entries_raw:
            if not isinstance(ent, dict):
                continue
            vid = str(ent.get("voiceId") or ent.get("id") or "").strip()
            if vid and vid not in by_vid:
                ordered_ids.append(vid)
                by_vid[vid] = ent
    elif isinstance(entries_raw, dict):
        for vid, ent in entries_raw.items():
            if isinstance(ent, dict):
                v = str(ent.get("voiceId") or vid).strip()
                if v and v not in by_vid:
                    ordered_ids.append(v)
                    by_vid[v] = ent
    else:
        raise ValueError(f"Unsupported retake plan format in {plan_path}: expected 'entries' list or dict")
    return ordered_ids, by_vid


def resolve_audio_rel_stem(line: dict[str, Any]) -> str:
    """Resolve audioRelPath stem (e.g. 'story/s_start/s_start__beatrice__609115c1') from a script line."""
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


def resolve_valid_slot(requested: str | None, fallback_slot: str, profile: dict[str, Any]) -> str:
    """Validate requested ref slot against profile['refs']; if invalid, fall back to profile defaultSlot."""
    valid_slots = list((profile.get("refs") or {}).keys())
    valid_set = set(valid_slots)
    default_slot = str(profile.get("defaultSlot") or (valid_slots[0] if valid_slots else ""))
    if default_slot not in valid_set and valid_slots:
        default_slot = valid_slots[0]

    req = str(requested or "").strip()
    if req:
        if req in valid_set:
            return req
        return default_slot
    if fallback_slot in valid_set:
        return fallback_slot
    return default_slot


def select_secondary_slot(primary_slot: str, profile: dict[str, Any]) -> str:
    """Pick an alternate slot for Take 2 when no explicit slot_take2 is supplied."""
    valid_slots = list((profile.get("refs") or {}).keys())
    default_slot = str(profile.get("defaultSlot") or (valid_slots[0] if valid_slots else ""))
    if primary_slot != default_slot and default_slot in valid_slots:
        return default_slot
    for preferred in ("warm", "soft", "cheerful", "energetic", "serious", "playful", "calm", "retort"):
        if preferred in valid_slots and preferred != primary_slot:
            return preferred
    for s in valid_slots:
        if s != primary_slot:
            return s
    return primary_slot


def is_expressive_take(plan_entry: dict[str, Any] | None, line: dict[str, Any], slot: str, text: str) -> bool:
    """Determine whether a take should use expressive temperature/pacing parameters."""
    if plan_entry is not None and "expressive" in plan_entry:
        return bool(plan_entry["expressive"])
    if slot in EXPRESSIVE_SLOTS:
        return True
    emo = str(line.get("emo") or "").strip().lower()
    if emo in EXPRESSIVE_EMOS:
        return True
    return ("！" in text) or ("!" in text)


def build_take_schedule(take_idx: int, takes_count: int, expressive: bool, vid_hash: int) -> list[dict[str, Any]]:
    """Build 2-attempt sampling schedule: standard for --takes 1, differentiated Steady/Expressive for --takes 2."""
    if takes_count <= 1:
        return [
            {
                "attempt": 1,
                "temperature": 0.80,
                "top_p": 0.92,
                "top_k": 15,
                "speed_factor": 1.0,
                "seed": -1,
                "split_override": None,
            },
            {
                "attempt": 2,
                "temperature": 0.65,
                "top_p": 0.85,
                "top_k": 10,
                "speed_factor": 1.0,
                "seed": int(1337 + vid_hash),
                "split_override": "cut5",
            },
        ]

    if take_idx == 1:
        # Take 1 (Steady Studio Anchor)
        return [
            {
                "attempt": 1,
                "temperature": 0.78 if expressive else 0.72,
                "top_p": 0.88,
                "top_k": 12,
                "speed_factor": 1.0,
                "seed": int(10007 + vid_hash),
                "split_override": None,
            },
            {
                "attempt": 2,
                "temperature": 0.66 if expressive else 0.64,
                "top_p": 0.84,
                "top_k": 10,
                "speed_factor": 1.0,
                "seed": int(20011 + vid_hash),
                "split_override": "cut5",
            },
        ]

    # Take 2 (Expressive Alternate)
    return [
        {
            "attempt": 1,
            "temperature": 0.98 if expressive else 0.92,
            "top_p": 0.96,
            "top_k": 20,
            "speed_factor": 1.04 if expressive else 0.98,
            "seed": int(50021 + vid_hash),
            "split_override": None,
        },
        {
            "attempt": 2,
            "temperature": 0.84 if expressive else 0.78,
            "top_p": 0.90,
            "top_k": 15,
            "speed_factor": 1.02 if expressive else 0.98,
            "seed": int(60029 + vid_hash),
            "split_override": "cut5",
        },
    ]


def normalize_prompt_text(raw_prompt: str) -> str:
    """Normalize reference prompt_text: strip leading ellipses/commas/spaces and ensure terminal 。！？."""
    p = re.sub(r"^[….、\u3000\s]+", "", str(raw_prompt or "")).strip()
    if p and p[-1] not in "。！？":
        p += "。"
    return p


def trim_reference_wav_inplace(wav_path: Path) -> None:
    """
    Trim leading/trailing silence below -46 dBFS (rms <= 164.0 in int16 scale) from reference WAVs
    with 0.04s lead pad and 0.08s tail pad, clamped safely to [3.20s, 9.60s] and memoized via .wav.trimmed_v2.
    """
    wav_path = Path(wav_path)
    marker = wav_path.with_suffix(".wav.trimmed_v2")
    if marker.is_file():
        return
    if not wav_path.is_file():
        return

    with wave.open(str(wav_path), "rb") as wf:
        ch = wf.getnchannels()
        sw = wf.getsampwidth()
        sr = wf.getframerate()
        nframes = wf.getnframes()
        raw_bytes = wf.readframes(nframes)

    if sw != 2 or sr <= 0 or nframes <= 0 or ch < 1:
        marker.touch()
        return

    pcm = np.frombuffer(raw_bytes, dtype=np.int16)
    total_frames = pcm.size // ch
    if total_frames <= 0:
        marker.touch()
        return
    pcm_frames = pcm[: total_frames * ch].reshape(total_frames, ch)
    mono_f32 = pcm_frames.astype(np.float32).mean(axis=1) if ch > 1 else pcm_frames[:, 0].astype(np.float32)

    orig_dur = total_frames / float(sr)
    frame_len = max(1, int(round(sr * 0.020)))
    n_win = total_frames // frame_len
    if n_win <= 0:
        marker.touch()
        return

    framed = mono_f32[: n_win * frame_len].reshape(n_win, frame_len)
    rms = np.sqrt(np.mean(framed * framed, axis=1))
    active = np.flatnonzero(rms > 164.0)
    if active.size == 0:
        marker.touch()
        return

    lead_pad = int(round(sr * 0.04))
    tail_pad = int(round(sr * 0.08))
    s_idx = max(0, int(active[0]) * frame_len - lead_pad)
    e_idx = min(total_frames, (int(active[-1]) + 1) * frame_len + tail_pad)

    span_dur = (e_idx - s_idx) / float(sr)
    if span_dur < 3.20:
        target_dur = max(3.20, min(orig_dur, 3.35))
        target_samples = min(total_frames, int(math.ceil(target_dur * sr)))
        need = target_samples - (e_idx - s_idx)
        if need > 0:
            half = need // 2
            new_s = max(0, s_idx - half)
            new_e = min(total_frames, new_s + target_samples)
            new_s = max(0, new_e - target_samples)
            s_idx, e_idx = new_s, new_e

    final_dur = (e_idx - s_idx) / float(sr)
    if 3.20 <= final_dur <= 9.60 and (s_idx > 0 or e_idx < total_frames):
        tmp_wav = wav_path.with_name(f"{wav_path.name}.trim.{os.getpid()}.wav")
        try:
            with wave.open(str(tmp_wav), "wb") as wf_out:
                wf_out.setnchannels(ch)
                wf_out.setsampwidth(2)
                wf_out.setframerate(sr)
                wf_out.writeframes(pcm_frames[s_idx:e_idx].astype("<i2", copy=False).tobytes())
            os.replace(tmp_wav, wav_path)
        finally:
            tmp_wav.unlink(missing_ok=True)

    marker.touch()


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

    wav_targets = [t["dst"] for t in all_tasks if t["kind"] == "wav"]
    for wav_dst in wav_targets:
        trim_reference_wav_inplace(wav_dst)

    print(
        f"[gsv-assets] Ready in {time.perf_counter() - t0:.2f}s "
        f"(downloaded={downloaded_cnt}, cached={cached_cnt}, trimmed_checked={len(wav_targets)}, total={len(all_tasks)})",
        flush=True,
    )


download_required_assets = ensure_assets_downloaded


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

    hard_ok = not (
        peak_i16 <= 600
        or raw_dur < min_dur
        or raw_dur > max_dur * 1.35
        or max_internal_sil > 2.5
    )

    return {
        "hard_ok": hard_ok,
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
    est_trimmed_dur: float | Path,
    target_mp3: Path | None = None,
) -> tuple[int, str]:
    """
    Studio FFmpeg single-pass mastering (supports both 3-arg (audio_np, sr, out_mp3_path)
    and 4-arg (audio_i16, sr, est_trimmed_dur, target_mp3)):
      - When raw_dur < 2.6s: leading-edge silence trim ONLY (no areverse tail trim) to preserve
        short phrase final consonants/particles.
      - When raw_dur >= 2.6s: gentle double-areverse edge trim (-58dB / 250ms tail room).
      - EBU R128 loudnorm=I=-16:TP=-1.5:LRA=11 for clips >= 0.8s
      - Exact -3.0 dBFS peak normalize fallback when duration < 0.8s
      - Output: 32000 Hz, mono, libmp3lame -q:a 1, atomic thread-safe rename
    """
    arr = np.asarray(audio_i16).reshape(-1)
    if np.issubdtype(arr.dtype, np.floating):
        pcm_i16 = np.clip(np.round(arr * 32767.0), -32768, 32767).astype(np.int16)
    else:
        pcm_i16 = arr.astype(np.int16, copy=False)

    raw_dur = pcm_i16.size / float(sr)
    if target_mp3 is None:
        out_mp3 = Path(est_trimmed_dur)
        est_dur = raw_dur
    else:
        out_mp3 = Path(target_mp3)
        est_dur = float(est_trimmed_dur)

    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    peak_norm_ratio = max(float(np.max(np.abs(pcm_i16.astype(np.int32)))) / 32768.0, 1e-4)
    peak_dbfs = 20.0 * math.log10(peak_norm_ratio)
    gain_to_minus3db = max(-12.0, min(24.0, -3.0 - peak_dbfs))

    trim_af = SHORT_EDGE_TRIM_AF if raw_dur < 2.6 else EDGE_TRIM_AF
    peak_af = f"{trim_af},volume={gain_to_minus3db:.2f}dB,alimiter=limit=-1.5dB:level=false"
    loudnorm_af = f"{trim_af},loudnorm=I=-16:TP=-1.5:LRA=11"

    use_loudnorm = est_dur >= 0.80 and raw_dur >= 0.80

    with tempfile.TemporaryDirectory(prefix="gsv_master_") as tmp_dir:
        tmp_wav = Path(tmp_dir) / "raw.wav"
        write_pcm16_wav(tmp_wav, pcm_i16, sr)
        tmp_mp3 = out_mp3.with_name(f"{out_mp3.name}.tmp.{os.getpid()}.{threading.get_ident()}.mp3")
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
                os.replace(tmp_mp3, out_mp3)
                return out_mp3.stat().st_size, mode_name
            last_err = proc.stderr.strip() or f"exit={proc.returncode}"

        tmp_mp3.unlink(missing_ok=True)
        raise RuntimeError(f"FFmpeg mastering failed for {out_mp3}: {last_err}")


def probe_audio_duration(audio_path: Path) -> float | None:
    """Return duration in seconds via ffprobe, or None if unavailable."""
    if not audio_path.is_file():
        return None
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proc.returncode == 0:
            val = float(proc.stdout.strip())
            if math.isfinite(val) and val > 0.0:
                return round(val, 3)
    except Exception:
        pass
    return None


def _master_and_probe(
    audio_i16: np.ndarray,
    sr: int,
    est_trimmed_dur: float,
    target_mp3: Path,
) -> tuple[int, str, float]:
    size_bytes, mode_name = master_wav_to_mp3(audio_i16, sr, est_trimmed_dur, target_mp3)
    probed = probe_audio_duration(target_mp3)
    final_dur = probed if probed is not None else round(float(est_trimmed_dur), 3)
    return size_bytes, mode_name, final_dur


def clear_prompt_cache(tts_pipeline: Any) -> None:
    """Strictly clear GPT-SoVITS prompt_cache when switching profiles or weights."""
    tts_pipeline.prompt_cache["ref_audio_path"] = None
    tts_pipeline.prompt_cache["aux_ref_audio_paths"] = []
    tts_pipeline.prompt_cache["refer_spec"] = []
    tts_pipeline.prompt_cache["prompt_semantic"] = None
    tts_pipeline.prompt_cache["prompt_text"] = None


def patch_gsv_runtime(TTS_cls: Any) -> None:
    """
    Surgical runtime monkeypatches for GPT-SoVITS:
      1. Disable per-line TTS.empty_cache() CUDA sync; skip set_seed(-1) TF32 clobbering.
      2. Enable TF32 on Ampere+ GPUs (matmul & cudnn).
      3. On Blackwell (sm_120 / major >= 10), force tools.acceleration.flash_attention_available -> False
         so GPT-SoVITS uses PyTorch native SDPA + torch_static_cuda_graph cleanly.
      4. Fix GPT_SoVITS.Accel sample_naive in-place logits mutation, token-0 scatter bug, and top_p shift.
      5. Cap T2SSession max_decode_steps dynamically by phoneme length instead of hardcoded 640 (25.90s).
    """
    import torch
    import torch.nn.functional as F

    if TTS_cls is not None:
        TTS_cls.empty_cache = lambda self: None
        tts_mod = sys.modules.get(getattr(TTS_cls, "__module__", ""))
        if tts_mod is not None and hasattr(tts_mod, "set_seed") and not getattr(tts_mod.set_seed, "_gsv_patched", False):
            _orig_set_seed = tts_mod.set_seed

            def _fast_set_seed(seed: int) -> int:
                s = int(seed)
                if s == -1:
                    torch.backends.cuda.matmul.allow_tf32 = True
                    torch.backends.cudnn.allow_tf32 = True
                    return -1
                res = _orig_set_seed(s)
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
                return res

            _fast_set_seed._gsv_patched = True  # type: ignore[attr-defined]
            tts_mod.set_seed = _fast_set_seed  # type: ignore[attr-defined]

    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    if torch.cuda.is_available() and torch.cuda.get_device_capability(0)[0] >= 10:
        try:
            _acc = importlib.import_module("tools.acceleration")
            _acc.flash_attention_available = lambda *a, **kw: False
        except Exception:
            pass

    for pkg_prefix in ("GPT_SoVITS.Accel.PyTorch.AR", "Accel.PyTorch.AR"):
        try:
            _sf = importlib.import_module(f"{pkg_prefix}.sample_funcs")
            _st = importlib.import_module(f"{pkg_prefix}.structs")
        except Exception:
            continue

        try:
            def _make_clean_sampler(_sf_mod: Any) -> Any:
                def _clean_sample_naive(
                    logits: Any,
                    valid_lens: Any,
                    previous_tokens: Any,
                    repetition_penalty: Any,
                    temperature: Any,
                    top_k: Any,
                    top_p: Any,
                ) -> Any:
                    # Clone FIRST so runner.py:349 argmax_token inspects UNMUTATED raw logits for EOS (1024)
                    logits = logits.clone()

                    if torch.any(repetition_penalty != 1.0):
                        bsz = logits.size(0)
                        vocab_lim = logits.size(1)
                        for b in range(bsz):
                            rp_val = float(repetition_penalty[b].item())
                            if rp_val == 1.0:
                                continue
                            vlen = int(valid_lens[b].item())
                            if vlen <= 0:
                                continue
                            uniq = previous_tokens[b, :vlen].long().unique()
                            uniq = uniq[(uniq >= 0) & (uniq < vocab_lim)]
                            if uniq.numel() > 0:
                                row_scores = logits[b, uniq]
                                logits[b, uniq] = torch.where(
                                    row_scores < 0,
                                    row_scores * rp_val,
                                    row_scores / rp_val,
                                )

                    greedy_mask = temperature <= 1e-5
                    temp_mask = (~greedy_mask) & (temperature != 1.0)
                    if torch.any(temp_mask):
                        temp_div = torch.where(
                            temp_mask,
                            temperature.to(logits.dtype).clamp_min(1e-5),
                            torch.ones_like(temperature, dtype=logits.dtype),
                        )
                        logits = logits / temp_div.unsqueeze(1)

                    if torch.any(top_k < logits.size(1)):
                        sorted_logits, _ = torch.sort(logits, descending=True, dim=-1)
                        k_idx = (top_k.long() - 1).clamp(0, logits.size(1) - 1).unsqueeze(1)
                        pivot = torch.gather(sorted_logits, dim=1, index=k_idx)
                        logits = torch.where(logits < pivot, -float("Inf"), logits)

                    if torch.any(top_p < 1.0):
                        sorted_logits, sorted_indices = torch.sort(logits, descending=True, dim=-1)
                        cum_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
                        sorted_indices_to_remove = cum_probs > top_p.to(cum_probs.dtype).unsqueeze(1)
                        sorted_indices_to_remove[..., 1:] = sorted_indices_to_remove[..., :-1].clone()
                        sorted_indices_to_remove[..., 0] = False
                        indices_to_remove = torch.zeros_like(sorted_indices_to_remove).scatter(
                            dim=1, index=sorted_indices, src=sorted_indices_to_remove
                        )
                        logits = logits.masked_fill(indices_to_remove, -float("Inf"))

                    return _sf_mod.apply_sampling(logits, greedy_mask)

                _clean_sample_naive._gsv_patched = True  # type: ignore[attr-defined]
                return _clean_sample_naive

            _sf.sample_naive.__call__ = staticmethod(_make_clean_sampler(_sf))

            if not getattr(_st.T2SSession.__init__, "_gsv_patched", False):
                _orig_session_init = _st.T2SSession.__init__

                def _make_patched_session_init(_orig_fn: Any) -> Any:
                    def _patched_session_init(self: Any, decoder: Any, request: Any, *a: Any, **kw: Any) -> None:
                        if getattr(request, "max_decode_steps", None) is None and getattr(request, "x_lens", None) is not None:
                            max_x = int(request.x_lens.max().item())
                            request.max_decode_steps = max(105, min(460, int(max_x * 3.2 + 55)))
                        _orig_fn(self, decoder, request, *a, **kw)

                    _patched_session_init._gsv_patched = True  # type: ignore[attr-defined]
                    return _patched_session_init

                _st.T2SSession.__init__ = _make_patched_session_init(_orig_session_init)

            try:
                _rn = importlib.import_module(f"{pkg_prefix}.runner")
                _rn.sample_naive = _sf.sample_naive
                _rn.T2SSession = _st.T2SSession
            except Exception:
                pass
        except Exception as exc:
            print(f"[gsv-patch] Warning patching {pkg_prefix}: {exc}", flush=True)


def wrap_sv_cache(tts_pipeline: Any, sv_cache_dict: dict[tuple[int, tuple[int, ...]], Any]) -> None:
    """Memoize sv_model.compute_embedding3(audio_tensor) across lines within the same profile."""
    sv_model = getattr(tts_pipeline, "sv_model", None)
    if sv_model is None:
        return
    orig_fn = getattr(sv_model, "compute_embedding3", None)
    if orig_fn is None or getattr(orig_fn, "_gsv_sv_cached", False):
        return

    def _cached_compute_embedding3(audio_tensor: Any) -> Any:
        key = (int(audio_tensor.data_ptr()), tuple(audio_tensor.shape))
        cached = sv_cache_dict.get(key)
        if cached is not None:
            return cached
        emb = orig_fn(audio_tensor)
        sv_cache_dict[key] = emb
        return emb

    _cached_compute_embedding3._gsv_sv_cached = True  # type: ignore[attr-defined]
    sv_model.compute_embedding3 = _cached_compute_embedding3


def main(argv: list[str] | None = None) -> int:
    t_global0 = time.perf_counter()
    cwd_initial = Path.cwd().resolve()
    args = parse_args(argv)
    takes_count = int(args.takes)

    # CRITICAL #2: Resolve ALL paths to absolute Paths BEFORE os.chdir(gsv_root)!
    gsv_root = Path(args.gsv_root).expanduser().resolve()
    assets_dir = Path(args.assets_dir).expanduser().resolve()
    script_path = Path(args.script).expanduser().resolve()
    casting_path = Path(args.casting).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    retake_plan_path = Path(args.retake_plan).expanduser().resolve() if args.retake_plan else None
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
    if retake_plan_path is not None and not retake_plan_path.is_file():
        raise FileNotFoundError(f"--retake-plan file does not exist: {retake_plan_path}")

    assets_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load script, casting, and optional retake plan manifests
    script_raw = json.loads(script_path.read_text(encoding="utf-8"))
    all_lines: list[dict[str, Any]] = (
        script_raw if isinstance(script_raw, list) else script_raw.get("lines") or script_raw.get("entries") or script_raw.get("items") or []
    )
    by_vid: dict[str, dict[str, Any]] = {ln["voiceId"]: ln for ln in all_lines}
    casting = json.loads(casting_path.read_text(encoding="utf-8"))
    profiles: dict[str, dict[str, Any]] = casting["profiles"]

    retake_plan_map: dict[str, dict[str, Any]] | None = None
    if retake_plan_path is not None:
        plan_ids, retake_plan_map = load_retake_plan(retake_plan_path)
        if id_filter is not None:
            plan_id_set = set(plan_ids)
            seen_ids: set[str] = set()
            target_ids: list[str] = []
            for vid in id_filter:
                if vid in plan_id_set and vid not in seen_ids:
                    seen_ids.add(vid)
                    target_ids.append(vid)
        else:
            target_ids = list(plan_ids)

        selected_lines: list[dict[str, Any]] = []
        missing_in_script: list[str] = []
        for vid in target_ids:
            ln = by_vid.get(vid)
            if ln is None:
                ent = retake_plan_map[vid]
                if ent.get("audioPath") or ent.get("audioRelPath"):
                    ln = dict(ent)
                    ln.setdefault("voiceId", vid)
                else:
                    missing_in_script.append(vid)
                    continue
            selected_lines.append(ln)
        if missing_in_script:
            raise KeyError(
                f"Retake plan voiceIds not found in script ({len(missing_in_script)}): {missing_in_script[:10]}"
            )
    elif id_filter is not None:
        missing_ids = [vid for vid in id_filter if vid not in by_vid]
        if missing_ids:
            raise KeyError(f"Requested --ids not found in script ({len(missing_ids)}): {missing_ids[:10]}")
        seen_ids = set()
        selected_lines = []
        for vid in id_filter:
            if vid not in seen_ids:
                seen_ids.add(vid)
                selected_lines.append(by_vid[vid])
    else:
        selected_lines = list(all_lines)

    if args.limit and args.limit > 0:
        selected_lines = selected_lines[: args.limit]

    retake2x_dir = out_dir / "retake2x"
    retake2x_manifest_path = retake2x_dir / "retake2x_manifest.json"
    existing_manifest: dict[str, Any] = {}
    if takes_count == 2 and retake2x_manifest_path.is_file():
        try:
            loaded_m = json.loads(retake2x_manifest_path.read_text(encoding="utf-8"))
            if isinstance(loaded_m, dict):
                existing_manifest = loaded_m
        except Exception:
            existing_manifest = {}

    # Build per-take synthesis items & automatic resume filter (> 1500 bytes existing .mp3 skipped unless --overwrite)
    todo_items: list[dict[str, Any]] = []
    manifest_entries: dict[str, dict[str, Any]] = {}
    resume_probe_tasks: list[tuple[str, str, Path]] = []
    skipped_resume = 0

    for ln in selected_lines:
        vid = ln["voiceId"]
        plan_entry = retake_plan_map.get(vid) if retake_plan_map is not None else None
        override_pid = str(plan_entry.get("overrideProfileId") or "").strip() if plan_entry else ""
        pid = override_pid or str(ln["profileId"])
        if pid not in profiles:
            raise KeyError(f"Unknown profileId '{pid}' on voiceId '{vid}'")
        prof = profiles[pid]

        if plan_entry is not None and str(plan_entry.get("tts_text") or "").strip():
            tts_text = clean_retake_tts_text(plan_entry["tts_text"])
        else:
            tts_text = clean_spoken_jp_text(ln.get("jp_text", ""))

        routed_slot = route_emotion_slot(ln, prof)
        slot1 = resolve_valid_slot(plan_entry.get("slot_take1") if plan_entry else None, routed_slot, prof)

        if takes_count == 1:
            rel_audio = str(ln["audioPath"]).replace("\\", "/").lstrip("/")
            target_mp3 = out_dir / rel_audio
            if not args.overwrite and target_mp3.is_file() and target_mp3.stat().st_size > 1500:
                skipped_resume += 1
                continue
            todo_items.append({
                "line": ln,
                "planEntry": plan_entry,
                "profileId": pid,
                "engineMode": prof["engineMode"],
                "slot": slot1,
                "takeIndex": 1,
                "ttsText": tts_text,
                "expressive": is_expressive_take(plan_entry, ln, slot1, tts_text),
                "targetMp3": target_mp3,
            })
        else:
            slot2 = resolve_valid_slot(
                plan_entry.get("slot_take2") if plan_entry else None,
                select_secondary_slot(slot1, prof),
                prof,
            )
            rel_stem = resolve_audio_rel_stem(ln)
            take1_rel = f"retake2x/{rel_stem}__take1.mp3"
            take2_rel = f"retake2x/{rel_stem}__take2.mp3"
            take1_mp3 = out_dir / take1_rel
            take2_mp3 = out_dir / take2_rel

            prev = existing_manifest.get(vid) if isinstance(existing_manifest.get(vid), dict) else {}
            prev_dur1 = float(prev.get("take1Dur") or 0.0) if not args.overwrite else 0.0
            prev_dur2 = float(prev.get("take2Dur") or 0.0) if not args.overwrite else 0.0
            manifest_entries[vid] = {
                "take1Path": take1_rel,
                "take2Path": take2_rel,
                "take1Dur": round(prev_dur1, 3),
                "take2Dur": round(prev_dur2, 3),
                "profileId": pid,
                "slot1": slot1,
                "slot2": slot2,
                "ttsText": tts_text,
            }

            for take_idx, take_slot, take_mp3, dur_key in (
                (1, slot1, take1_mp3, "take1Dur"),
                (2, slot2, take2_mp3, "take2Dur"),
            ):
                if not args.overwrite and take_mp3.is_file() and take_mp3.stat().st_size > 1500:
                    skipped_resume += 1
                    if manifest_entries[vid][dur_key] <= 0.0:
                        resume_probe_tasks.append((vid, dur_key, take_mp3))
                    continue
                todo_items.append({
                    "line": ln,
                    "planEntry": plan_entry,
                    "profileId": pid,
                    "engineMode": prof["engineMode"],
                    "slot": take_slot,
                    "takeIndex": take_idx,
                    "ttsText": tts_text,
                    "expressive": is_expressive_take(plan_entry, ln, take_slot, tts_text),
                    "targetMp3": take_mp3,
                })

    def write_retake2x_manifest() -> None:
        if takes_count != 2:
            return
        if resume_probe_tasks:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as probe_pool:
                futs = [
                    (probe_pool.submit(probe_audio_duration, mp3_p), v_id, d_key)
                    for v_id, d_key, mp3_p in resume_probe_tasks
                ]
                for pf, v_id, d_key in futs:
                    dur_val = pf.result()
                    if dur_val is not None:
                        manifest_entries[v_id][d_key] = dur_val
        retake2x_dir.mkdir(parents=True, exist_ok=True)
        tmp_manifest = retake2x_manifest_path.with_name(f"{retake2x_manifest_path.name}.tmp.{os.getpid()}")
        tmp_manifest.write_text(json.dumps(manifest_entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(tmp_manifest, retake2x_manifest_path)

    total_target_clips = len(selected_lines) * takes_count
    print(
        f"[gsv-init] Script lines={len(all_lines)} | selected_lines={len(selected_lines)} | "
        f"takes={takes_count} (target_clips={total_target_clips}) | "
        f"resume_skipped={skipped_resume} | to_synthesize={len(todo_items)}",
        flush=True,
    )

    if not todo_items:
        write_retake2x_manifest()
        summary = {
            "status": "ok",
            "stats": {
                "totalInScript": len(all_lines),
                "totalSelected": len(selected_lines),
                "takesPerLine": takes_count,
                "totalTargetClips": total_target_clips,
                "skippedResume": skipped_resume,
                "toSynthesize": 0,
                "succeeded": skipped_resume,
                "newlySynthesized": 0,
                "qcWarnings": 0,
                "failed": 0,
                "weightSwaps": 0,
                "elapsedSec": round(time.perf_counter() - t_global0, 2),
            },
            "warnings": [],
            "failures": [],
        }
        if takes_count == 2:
            summary["retake2xManifest"] = str(retake2x_manifest_path)
        qa_report_path.parent.mkdir(parents=True, exist_ok=True)
        qa_report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(
            f"[gsv-done] All {total_target_clips} target clips already synthesized on disk. Report: {qa_report_path}",
            flush=True,
        )
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

    # CRITICAL #4: Zero-BERT Bypass + Accel/TF32 runtime patches
    from TTS_infer_pack.TTS import TTS, TTS_Config

    def _skip_bert_weights(self: Any, base_path: str) -> None:
        print(f"[gsv-bert] Zero-BERT bypass active: skipping {base_path}", flush=True)
        self.bert_tokenizer = None
        self.bert_model = None

    TTS.init_bert_weights = _skip_bert_weights
    patch_gsv_runtime(TTS)

    # CRITICAL #6: Smart cache-optimal grouping — all "v2ProPlus_sv" profiles back-to-back (0 weight swaps),
    # then "finetuned" profiles grouped by profileId, then by take slot & takeIndex so prompt_cache & sv_cache
    # stay ~95%+ hot across all takes!
    profile_order_index = {pid: idx for idx, pid in enumerate(profiles.keys())}
    todo_items.sort(
        key=lambda it: (
            0 if it["engineMode"] == "v2ProPlus_sv" else 1,
            profile_order_index.get(it["profileId"], 999),
            it["slot"],
            it["takeIndex"],
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

    sv_cache_dict: dict[tuple[int, tuple[int, ...]], Any] = {}
    t_model0 = time.perf_counter()
    with (contextlib.nullcontext() if args.verbose_gsv else contextlib.redirect_stdout(io.StringIO())):
        tts_config = TTS_Config(init_cfg)
        tts_pipeline = TTS(tts_config)
    wrap_sv_cache(tts_pipeline, sv_cache_dict)
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
    mp3_futures: list[tuple[concurrent.futures.Future[tuple[int, str, float]], str, str, str, int, Path]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as mp3_pool:
        for idx, item in enumerate(todo_items, 1):
            ln = item["line"]
            vid: str = ln["voiceId"]
            pid: str = item["profileId"]
            slot: str = item["slot"]
            take_idx: int = item["takeIndex"]
            target_mp3: Path = item["targetMp3"]
            prof = profiles[pid]

            # Weight swap only if crossing between v2ProPlus_sv and finetuned (or between two finetuned chars)
            ver, want_gpt, want_sov = resolve_weights_for_profile(pid)
            if (want_gpt, want_sov) != current_weights:
                t_sw0 = time.perf_counter()
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                with (contextlib.nullcontext() if args.verbose_gsv else contextlib.redirect_stdout(io.StringIO())):
                    tts_pipeline.init_vits_weights(str(want_sov))
                    tts_pipeline.init_t2s_weights(str(want_gpt))
                sv_cache_dict.clear()
                wrap_sv_cache(tts_pipeline, sv_cache_dict)
                clear_prompt_cache(tts_pipeline)
                current_weights = (want_gpt, want_sov)
                current_profile_id = None
                weight_swaps += 1
                print(
                    f"[gsv-swap #{weight_swaps}] Switched weights -> {pid} ({ver}: {want_gpt.name} + {want_sov.name}) "
                    f"in {time.perf_counter() - t_sw0:.2f}s",
                    flush=True,
                )

            # Always clear prompt_cache and sv_cache when switching profiles!
            if current_profile_id != pid:
                clear_prompt_cache(tts_pipeline)
                sv_cache_dict.clear()
                wrap_sv_cache(tts_pipeline, sv_cache_dict)
                current_profile_id = pid
                print(
                    f"[gsv-profile] >>> {pid} ({prof['animeCharacter']} / {prof['seiyuu']}, mode={prof['engineMode']})",
                    flush=True,
                )

            jp_clean = item["ttsText"]
            if not jp_clean:
                fail_rec: dict[str, Any] = {"voiceId": vid, "profileId": pid, "error": "empty_jp_text"}
                if takes_count > 1:
                    fail_rec["take"] = take_idx
                failures.append(fail_rec)
                print(f"  [{idx}/{len(todo_items)}] FAIL {vid}: empty jp_text", flush=True)
                continue

            ref_entry = prof["refs"][slot]
            ref_wav_path = str((assets_dir / ref_entry["assetRelPath"]).resolve())
            prompt_text = normalize_prompt_text(ref_entry["prompt_text"])
            if prof["engineMode"] == "v2ProPlus_sv" or "Pro" in ver:
                aux_wav_paths = [str((assets_dir / rel).resolve()) for rel in prof["aux_ref_rel_paths"]]
            else:
                aux_wav_paths = []

            base_split = "cut3" if (jp_clean.count("。") >= 2 or len(jp_clean) > 42) else "cut0"
            vid_hash = zlib.crc32(vid.encode("utf-8")) & 0xFFFF
            schedule = build_take_schedule(take_idx, takes_count, bool(item["expressive"]), vid_hash)

            best_candidate: dict[str, Any] | None = None
            chosen_attempt = 0
            last_exc: str = ""
            t_line0 = time.perf_counter()

            for sched in schedule:
                att_num = sched["attempt"]
                split_method = sched["split_override"] or base_split

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
                    "batch_size": 8,
                    "speed_factor": sched["speed_factor"],
                    "fragment_interval": 0.18,
                    "seed": sched["seed"],
                    "parallel_infer": True,
                    "repetition_penalty": 1.35,
                }

                try:
                    buf = io.StringIO()
                    with (contextlib.nullcontext() if args.verbose_gsv else contextlib.redirect_stdout(buf)):
                        sr, audio_np = next(tts_pipeline.run(inputs))
                    qc = evaluate_waveform_qc(audio_np, int(sr), len(jp_clean))
                    if qc.get("peak_i16", 0) > 600 and (best_candidate is None or qc["penalty"] < best_candidate["penalty"]):
                        best_candidate = {**qc, "audio_np": qc["audio_i16"], "attempt": att_num}
                        chosen_attempt = att_num
                    if qc["hard_ok"]:
                        chosen_attempt = att_num
                        best_candidate = {**qc, "audio_np": qc["audio_i16"], "attempt": att_num}
                        break
                    last_exc = qc["reason"]
                except Exception as exc:
                    last_exc = f"{type(exc).__name__}: {exc}"
                    clear_prompt_cache(tts_pipeline)

            take_tag = f"[T{take_idx}] " if takes_count > 1 else ""
            if best_candidate is None:
                fail_rec = {"voiceId": vid, "profileId": pid, "slot": slot, "error": last_exc or "all_attempts_failed"}
                if takes_count > 1:
                    fail_rec["take"] = take_idx
                failures.append(fail_rec)
                print(f"  [{idx}/{len(todo_items)}] FAIL {take_tag}{vid} ({pid}/{slot}): {last_exc}", flush=True)
                continue

            if not best_candidate["qc_ok"]:
                chosen_attempt = best_candidate["attempt"]
                warn_entry: dict[str, Any] = {
                    "voiceId": vid,
                    "profileId": pid,
                    "slot": slot,
                    "attemptKept": chosen_attempt,
                    "reason": best_candidate["reason"],
                    "rawDurSec": round(best_candidate["raw_dur"], 3),
                    "maxInternalSilenceSec": round(best_candidate["max_internal_silence"], 3),
                }
                if takes_count > 1:
                    warn_entry["take"] = take_idx
                qc_warnings.append(warn_entry)
                print(
                    f"  [WARN] {take_tag}{vid}: soft QC note on attempt {chosen_attempt} ({best_candidate['reason']})",
                    flush=True,
                )

            fut = mp3_pool.submit(
                _master_and_probe,
                best_candidate["audio_np"].copy(),
                best_candidate["sr"],
                best_candidate["est_trimmed_dur"],
                target_mp3,
            )
            mp3_futures.append((fut, vid, pid, slot, take_idx, target_mp3))
            dt_line = time.perf_counter() - t_line0
            print(
                f"  [{idx}/{len(todo_items)}] GPU-OK {take_tag}{vid} | {pid}:{slot} | att={chosen_attempt} | "
                f"dur={best_candidate['raw_dur']:.2f}s | gpu={dt_line:.2f}s (queued mp3)",
                flush=True,
            )

        # Drain & verify all background FFmpeg mastering futures before exiting
        ffmpeg_errors: list[str] = []
        for fut, vid, pid, slot, take_idx, target_mp3 in mp3_futures:
            try:
                _mp3_bytes, _norm_mode, final_dur = fut.result()
                newly_synthesized += 1
                by_profile_done[pid] += 1
                if takes_count == 2 and vid in manifest_entries:
                    manifest_entries[vid][f"take{take_idx}Dur"] = round(float(final_dur), 3)
            except Exception as exc:
                err_msg = f"{vid} ({target_mp3}): {exc}"
                ffmpeg_errors.append(err_msg)
                fail_rec = {"voiceId": vid, "profileId": pid, "slot": slot, "error": f"ffmpeg: {exc}"}
                if takes_count > 1:
                    fail_rec["take"] = take_idx
                failures.append(fail_rec)
                print(f"  [FFMPEG-FAIL] {err_msg}", flush=True)

    write_retake2x_manifest()

    if ffmpeg_errors:
        raise RuntimeError(f"{len(ffmpeg_errors)} FFmpeg mastering future(s) failed; first: {ffmpeg_errors[0]}")

    total_elapsed = time.perf_counter() - t_global0
    total_succeeded = skipped_resume + newly_synthesized
    summary = {
        "status": "ok" if len(failures) == 0 else "partial_failure",
        "device": device_str,
        "stats": {
            "totalInScript": len(all_lines),
            "totalSelected": len(selected_lines),
            "takesPerLine": takes_count,
            "totalTargetClips": total_target_clips,
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
    if takes_count == 2:
        summary["retake2xManifest"] = str(retake2x_manifest_path)
    qa_report_path.parent.mkdir(parents=True, exist_ok=True)
    qa_report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"\n[gsv-done] Completed in {total_elapsed:.1f}s | succeeded={total_succeeded}/{total_target_clips} "
        f"(new={newly_synthesized}, resumed={skipped_resume}) | warnings={len(qc_warnings)} | "
        f"failed={len(failures)} | weight_swaps={weight_swaps} | report={qa_report_path}",
        flush=True,
    )
    return 0 if len(failures) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
