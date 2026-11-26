#!/usr/bin/env python3
"""
Fish Audio Drama 3 参考音拉取、清洗与 44.1 kHz 单声道 WAV 标准化流水线。

功能特性：
1. 读取 `tools/voice/casting_fish_audio.json`（兼容 list / {profiles: [...] | {...}} 等结构）。
2. 支持 `tools/voice/custom_refs/<profileId>.wav` + `.txt` 本地手工干声覆写。
3. 使用 `FISH_API_KEY` 调用 `GET https://api.fish.audio/model/{id}` 获取公开元数据（零 TTS 计费）。
4. 自动筛选 1-2 段时长在 8-30 秒（硬上限 <= 55 秒，可通过 --max-seconds 收紧以适配 A100 40GB）
   且文本干净的日语样本，清洗 `[pause]`、`[inhale]`、`[^0^]` 等展示标记。
5. 可选 `--verify-asr` 使用 `litagin/anime-whisper` 复核真实日文转写（严禁传 `initial_prompt`！）。
6. 使用 `ffmpeg -y -i in -ac 1 -ar 44100 -vn out.wav` 转为 Drama 3 Codec 原生 44.1 kHz 单声道 WAV。
7. 首选 `primary` 模型样本缺失或下载失败时，自动平滑降级到 `backup` 模型并记录日志。
8. 输出 `tools/voice/refs_resolved.json` 供 `batch_synthesize.py` 直接读取。
"""

from __future__ import annotations

import argparse
import array
import datetime as dt
import hashlib
import html
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import wave
from pathlib import Path
from typing import Any

try:
    import requests  # type: ignore
except ImportError:
    requests = None

FISH_MODEL_API_URL = "https://api.fish.audio/model/{model_id}"
FISH_PUBLIC_CDN_BASE = "https://public-platform.r2.fish.audio/"
SUPPORTED_AUDIO_EXTS = (".wav", ".mp3", ".flac", ".m4a", ".ogg", ".opus", ".aac", ".webm")

# 匹配 fish.audio 模型链接中的 16-64 位模型 ID
FISH_URL_ID_RE = re.compile(
    r"(?:fish\.audio/(?:[a-zA-Z-]+/)?m/)([a-zA-Z0-9_-]{12,64})",
    re.IGNORECASE,
)

# 清洗 Fish Audio 样本 text 中常见的展示/演出/颜文字标记
BRACKET_TAG_RE = re.compile(r"\[[^\]]{1,48}\]")
ANGLE_SPEAKER_RE = re.compile(r"<\|[^|>]{1,40}\|>")
STAGE_PAREN_EN_RE = re.compile(
    r"\(\s*(?:pause|short\s+pause|long\s+pause|inhale|exhale|sighs?|laughs?|"
    r"giggles?|chuckles?|breath|breathes?|whisper(?:ing|s)?|music|bgm|sfx|"
    r"noise|applause|cough(?:s|ing)?|gasp(?:s|ing)?|silence)[^)]*\)",
    re.IGNORECASE,
)
STAGE_PAREN_JP_RE = re.compile(
    r"[（(]\s*(?:笑|泣|嘆息|ため息|息|間|拍手|咳|囁き|小声|SE|BGM|効果音|無音)[^）)]*[）)]",
    re.IGNORECASE,
)
LENTICULAR_RE = re.compile(r"【[^】]{1,32}】")
MULTISPACE_RE = re.compile(r"\s+")

HIRAGANA_RE = re.compile(r"[\u3040-\u309F]")
KATAKANA_RE = re.compile(r"[\u30A0-\u30FF]")
KANJI_RE = re.compile(r"[\u4E00-\u9FFF\u3400-\u4DBF]")
LATIN_RE = re.compile(r"[A-Za-z]")


def extract_model_id(raw: Any) -> str | None:
    """从字符串、URL 或对象中提取 Fish Audio 模型 ID。"""
    if raw is None:
        return None
    if isinstance(raw, str):
        val = raw.strip()
        if not val:
            return None
        m = FISH_URL_ID_RE.search(val)
        if m:
            return m.group(1)
        if "/" not in val and len(val) >= 12:
            return val
        return None
    if isinstance(raw, dict):
        for key in (
            "modelId",
            "model_id",
            "fishModelId",
            "fish_model_id",
            "reference_id",
            "referenceId",
            "id",
            "_id",
            "url",
        ):
            found = extract_model_id(raw.get(key))
            if found:
                return found
    return None


def load_casting_profiles(casting_path: Path) -> list[dict[str, Any]]:
    """兼容多种 JSON 形态解析 casting_fish_audio.json。"""
    data = json.loads(casting_path.read_text(encoding="utf-8"))
    raw_entries: list[tuple[str | None, dict[str, Any]]] = []

    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                raw_entries.append((None, item))
    elif isinstance(data, dict):
        container = None
        for key in ("profiles", "cast", "voices", "characters", "items"):
            if key in data:
                container = data[key]
                break
        if isinstance(container, list):
            for item in container:
                if isinstance(item, dict):
                    raw_entries.append((None, item))
        elif isinstance(container, dict):
            for k, v in container.items():
                if isinstance(v, dict):
                    raw_entries.append((str(k), v))
        else:
            # 兜底：顶层直接是 {profileId: {...}}
            for k, v in data.items():
                if isinstance(v, dict) and any(
                    field in v
                    for field in (
                        "primary",
                        "modelId",
                        "model_id",
                        "fishModelId",
                        "reference_id",
                        "backup",
                        "backups",
                    )
                ):
                    raw_entries.append((str(k), v))
    else:
        raise ValueError(f"Unsupported casting JSON root type: {type(data).__name__}")

    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for fallback_key, entry in raw_entries:
        profile_id = str(
            entry.get("profileId")
            or entry.get("profile_id")
            or entry.get("id")
            or fallback_key
            or ""
        ).strip()
        if not profile_id or profile_id in seen:
            continue
        seen.add(profile_id)

        role_names = entry.get("roleNames")
        first_role_name = role_names[0] if isinstance(role_names, list) and role_names else None
        display_name = str(
            entry.get("displayName")
            or entry.get("display_name")
            or entry.get("name")
            or entry.get("zhName")
            or first_role_name
            or entry.get("role")
            or profile_id
        ).strip()

        char_ids_raw = entry.get("charIds") or entry.get("char_ids") or entry.get("chars")
        if isinstance(char_ids_raw, list):
            char_ids = [str(x) for x in char_ids_raw if x]
        elif entry.get("charId") or entry.get("char_id"):
            char_ids = [str(entry.get("charId") or entry.get("char_id"))]
        else:
            char_ids = [profile_id]

        # Primary ID
        primary_id = (
            extract_model_id(entry.get("primary"))
            or extract_model_id(entry.get("primaryModelId"))
            or extract_model_id(entry.get("primary_model_id"))
            or extract_model_id(entry.get("fishModelId"))
            or extract_model_id(entry.get("fish_model_id"))
            or extract_model_id(entry.get("reference_id"))
            or extract_model_id(entry.get("modelId"))
            or extract_model_id(entry.get("model_id"))
        )

        # Backup IDs (依次支持 backup -> alt -> fallback 等多级平滑降级)
        backup_ids: list[str] = []
        for bkey in (
            "backup",
            "backups",
            "alt",
            "alts",
            "fallback",
            "fallbacks",
            "secondary",
            "backupModelId",
            "backup_model_id",
            "backupModelIds",
        ):
            val = entry.get(bkey)
            if val is None:
                continue
            items = val if isinstance(val, list) else [val]
            for b_item in items:
                bid = extract_model_id(b_item)
                if bid and bid != primary_id and bid not in backup_ids:
                    backup_ids.append(bid)

        normalized.append(
            {
                "profileId": profile_id,
                "displayName": display_name,
                "charIds": char_ids,
                "primaryModelId": primary_id,
                "backupModelIds": backup_ids,
                "notes": str(entry.get("notes") or entry.get("style") or entry.get("archetype") or ""),
                "raw": entry,
            }
        )

    return normalized


def clean_sample_text(raw_text: str | None) -> str:
    """清洗样本 text 中残留的 [pause]/[inhale]/[^0^] 等展示与演出标记。"""
    if not raw_text:
        return ""
    text = str(raw_text)
    text = ANGLE_SPEAKER_RE.sub("", text)
    text = BRACKET_TAG_RE.sub("", text)
    text = STAGE_PAREN_EN_RE.sub("", text)
    text = STAGE_PAREN_JP_RE.sub("", text)
    text = LENTICULAR_RE.sub("", text)
    text = text.replace("\r", " ").replace("\n", " ")
    text = MULTISPACE_RE.sub(" ", text).strip()
    # 清除开头残留孤立标点
    text = re.sub(r"^[、。,.!?;:・\s]+", "", text).strip()
    return text


def analyze_japanese_text(text: str) -> dict[str, Any]:
    """评估文本的日语纯净度。"""
    if not text:
        return {"len": 0, "kana": 0, "kanji": 0, "latin": 0, "jp_ratio": 0.0, "is_japanese": False}
    non_ws = re.sub(r"\s+", "", text)
    total = max(1, len(non_ws))
    kana = len(HIRAGANA_RE.findall(non_ws)) + len(KATAKANA_RE.findall(non_ws))
    kanji = len(KANJI_RE.findall(non_ws))
    latin = len(LATIN_RE.findall(non_ws))
    jp_chars = kana + kanji
    jp_ratio = jp_chars / total
    # 假名存在是区分日语与纯中文的关键信号
    is_jp = (kana >= 2 and jp_ratio >= 0.45) or (kana >= 1 and jp_chars >= 4 and latin / total < 0.25)
    return {
        "len": len(non_ws),
        "kana": kana,
        "kanji": kanji,
        "latin": latin,
        "jp_ratio": round(jp_ratio, 4),
        "is_japanese": is_jp,
    }


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_ffmpeg() -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "未检测到 `ffmpeg`！请先安装 FFmpeg（Colab / Ubuntu: `apt-get install -y ffmpeg`）。"
        )


def convert_to_44k_mono_wav(
    src_path: Path,
    dst_path: Path,
    max_duration: float | None = None,
) -> None:
    """严格按 Drama 3 Codec 原生规格转为 44.1 kHz 单声道 16-bit WAV。"""
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src_path)]
    if max_duration is not None and max_duration > 0:
        cmd.extend(["-t", f"{max_duration:.3f}"])
    cmd.extend(["-ac", "1", "-ar", "44100", "-vn", str(dst_path)])
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not dst_path.exists() or dst_path.stat().st_size < 1024:
        raise RuntimeError(f"ffmpeg 转码失败 ({src_path.name}): {proc.stderr.strip()}")


def inspect_wav_metrics(wav_path: Path) -> dict[str, Any]:
    """无外部依赖检查 16-bit 单声道 WAV 时长、RMS、峰值与削波比例。"""
    with wave.open(str(wav_path), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    duration = n_frames / float(framerate) if framerate > 0 else 0.0
    if sampwidth != 2 or n_frames == 0:
        return {
            "duration_sec": round(duration, 3),
            "sample_rate": framerate,
            "channels": n_channels,
            "rms_dbfs": -99.0,
            "peak_dbfs": -99.0,
            "clip_ratio": 0.0,
            "healthy": duration >= 1.0,
        }

    samples = array.array("h")
    samples.frombytes(raw)
    if sys.byteorder != "little":
        samples.byteswap()

    total_samples = len(samples)
    peak = 0
    sum_sq = 0.0
    clipped = 0
    for s in samples:
        a = -s if s < 0 else s
        if a > peak:
            peak = a
        if a >= 32760:
            clipped += 1
        sum_sq += s * s

    rms = math.sqrt(sum_sq / max(1, total_samples))
    peak_dbfs = 20.0 * math.log10(peak / 32768.0) if peak > 0 else -99.0
    rms_dbfs = 20.0 * math.log10(rms / 32768.0) if rms > 0 else -99.0
    clip_ratio = clipped / max(1, total_samples)
    healthy = (
        duration >= 1.5
        and rms_dbfs > -45.0
        and peak_dbfs > -30.0
        and clip_ratio < 0.02
    )
    return {
        "duration_sec": round(duration, 3),
        "sample_rate": framerate,
        "channels": n_channels,
        "rms_dbfs": round(rms_dbfs, 2),
        "peak_dbfs": round(peak_dbfs, 2),
        "clip_ratio": round(clip_ratio, 6),
        "healthy": healthy,
    }


def http_get_bytes(
    url: str,
    headers: dict[str, str] | None = None,
    timeout: float = 30.0,
    retries: int = 3,
) -> tuple[int, bytes, str]:
    """统一 HTTP GET 工具（优先使用 requests，缺省回退 urllib），内置重试与退避。"""
    req_headers = {"User-Agent": "FictionalAdventure-VoicePipeline/1.0"}
    if headers:
        req_headers.update(headers)

    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            if requests is not None:
                resp = requests.get(url, headers=req_headers, timeout=timeout, allow_redirects=True)
                status = resp.status_code
                if status in (429, 500, 502, 503, 504) and attempt + 1 < retries:
                    wait_s = float(resp.headers.get("Retry-After", 1.5 * (2**attempt)))
                    time.sleep(min(wait_s, 15.0))
                    continue
                return status, resp.content, resp.headers.get("Content-Type", "")
            else:
                req = urllib.request.Request(url, headers=req_headers, method="GET")
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    status = getattr(resp, "status", 200)
                    ctype = resp.headers.get("Content-Type", "")
                    return status, resp.read(), ctype
        except urllib.error.HTTPError as e:
            body = e.read() if hasattr(e, "read") else b""
            if e.code in (429, 500, 502, 503, 504) and attempt + 1 < retries:
                time.sleep(min(1.5 * (2**attempt), 15.0))
                continue
            return e.code, body, ""
        except Exception as e:
            last_err = e
            if attempt + 1 < retries:
                time.sleep(min(1.5 * (2**attempt), 10.0))
    raise RuntimeError(f"HTTP GET 失败 ({url}): {last_err}")


def fetch_fish_model_metadata(model_id: str, api_key: str) -> dict[str, Any]:
    """调用 GET https://api.fish.audio/model/{id}（查元数据零 TTS 计费）。"""
    url = FISH_MODEL_API_URL.format(model_id=urllib.parse.quote(model_id, safe=""))
    headers: dict[str, str] = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    status, body, _ = http_get_bytes(url, headers=headers, timeout=25.0, retries=3)
    if status != 200:
        snippet = body.decode("utf-8", errors="replace")[:240]
        raise RuntimeError(f"HTTP {status}: {snippet}")
    data = json.loads(body.decode("utf-8"))
    if data.get("dmca_taken_down"):
        raise RuntimeError("模型已被 DMCA 下架 (dmca_taken_down=true)")
    return data


def resolve_sample_url(audio_field: str | None) -> str | None:
    if not audio_field or not isinstance(audio_field, str):
        return None
    val = audio_field.strip()
    if not val:
        return None
    if val.startswith(("http://", "https://")):
        return val
    return urllib.parse.urljoin(FISH_PUBLIC_CDN_BASE, val.lstrip("/"))


def _katakana_to_hiragana(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)


class AnimeWhisperVerifier:
    """延迟加载 litagin/anime-whisper（严格禁止传 initial_prompt！）。"""

    def __init__(self, device: str = "auto") -> None:
        self.device_pref = device
        self._pipe = None
        self._kks = None
        self._kks_tried = False

    def _ensure_loaded(self) -> None:
        if self._pipe is not None:
            return
        try:
            import torch  # type: ignore
            from transformers import pipeline  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                "启用 `--verify-asr` 需要安装 `torch` 与 `transformers`（可选 `pykakasi`）。"
            ) from e

        if self.device_pref == "auto":
            use_cuda = torch.cuda.is_available()
            device = "cuda" if use_cuda else "cpu"
            torch_dtype = torch.float16 if use_cuda else torch.float32
        else:
            device = self.device_pref
            torch_dtype = torch.float16 if str(device).startswith("cuda") else torch.float32

        print(f"[ASR] 正在加载 litagin/anime-whisper (device={device}) ...", flush=True)
        self._pipe = pipeline(
            "automatic-speech-recognition",
            model="litagin/anime-whisper",
            device=device,
            torch_dtype=torch_dtype,
            chunk_length_s=30.0,
        )

    def _to_kana(self, text: str) -> str:
        import unicodedata

        s = unicodedata.normalize("NFKC", clean_sample_text(text))
        if not self._kks_tried:
            self._kks_tried = True
            try:
                import pykakasi  # type: ignore

                self._kks = pykakasi.kakasi()
            except ImportError:
                self._kks = None
        if self._kks is not None:
            s = "".join(item.get("hira", "") for item in self._kks.convert(s))
        s = _katakana_to_hiragana(s)
        s = re.sub(r"[^\u3040-\u309F\u4E00-\u9FFF0-9a-zA-Z]", "", s)
        return s.lower()

    @staticmethod
    def _levenshtein(a: str, b: str) -> int:
        if a == b:
            return 0
        if not a:
            return len(b)
        if not b:
            return len(a)
        prev = list(range(len(b) + 1))
        for i, ca in enumerate(a, 1):
            curr = [i] + [0] * len(b)
            for j, cb in enumerate(b, 1):
                cost = 0 if ca == cb else 1
                curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            prev = curr
        return prev[-1]

    def transcribe(self, wav_path: Path) -> str:
        self._ensure_loaded()
        # 铁律：litagin/anime-whisper 严禁传入 initial_prompt！
        generate_kwargs = {
            "language": "Japanese",
            "no_repeat_ngram_size": 5,
            "repetition_penalty": 1.0,
        }
        assert "initial_prompt" not in generate_kwargs
        result = self._pipe(str(wav_path), generate_kwargs=generate_kwargs)
        return clean_sample_text(result.get("text", "") if isinstance(result, dict) else str(result))

    def kana_cer(self, ref_text: str, hyp_text: str) -> float:
        r = self._to_kana(ref_text)
        h = self._to_kana(hyp_text)
        if not r:
            return 1.0 if h else 0.0
        return round(self._levenshtein(r, h) / float(len(r)), 4)


def discover_custom_override(
    custom_refs_dir: Path,
    profile_id: str,
) -> list[tuple[Path, Path | None]]:
    """
    查找 custom_refs/<profileId>.wav (+ .txt) 或 <profileId>_0.wav / <profileId>_1.wav。
    支持音频扩展名 .wav/.mp3/.flac/.m4a/.ogg 等，后续统一由 ffmpeg 转 44.1kHz 单声道 WAV。
    """
    if not custom_refs_dir.exists():
        return []

    found: list[tuple[Path, Path | None]] = []
    # 1. 优先精确同名 <profileId>.<ext>
    for ext in SUPPORTED_AUDIO_EXTS:
        cand = custom_refs_dir / f"{profile_id}{ext}"
        if cand.is_file():
            txt = custom_refs_dir / f"{profile_id}.txt"
            found.append((cand, txt if txt.is_file() else None))
            break

    # 2. 支持多段覆写 <profileId>_0.<ext>, <profileId>_1.<ext>, <profileId>_2.<ext>
    for idx in range(0, 4):
        for ext in SUPPORTED_AUDIO_EXTS:
            cand = custom_refs_dir / f"{profile_id}_{idx}{ext}"
            if cand.is_file():
                txt = custom_refs_dir / f"{profile_id}_{idx}.txt"
                if not txt.is_file():
                    fallback_txt = custom_refs_dir / f"{profile_id}.txt"
                    txt = fallback_txt if fallback_txt.is_file() else None
                found.append((cand, txt))
                break

    # 3. 支持子目录 custom_refs/<profileId>/*.wav
    subdir = custom_refs_dir / profile_id
    if not found and subdir.is_dir():
        for p in sorted(subdir.iterdir()):
            if p.is_file() and p.suffix.lower() in SUPPORTED_AUDIO_EXTS:
                txt = p.with_suffix(".txt")
                found.append((p, txt if txt.is_file() else None))

    return found


def score_candidate(
    metrics: dict[str, Any],
    cleaned_text: str,
    min_sec: float,
    prefer_max_sec: float,
    hard_max_sec: float,
) -> tuple[bool, float, str]:
    """
    评估候选参考音质量并返回 (是否合格, 综合分, 说明)。
    优先选择 8-30 秒（且兼顾 <= 19 秒适配 A100 40GB）、音频健康、干净日语文本的样本。
    """
    dur = metrics["duration_sec"]
    if dur < 1.5:
        return False, -1e9, f"时长过短 ({dur:.2f}s)"
    if dur > hard_max_sec:
        return False, -1e9, f"超过硬上限 ({dur:.2f}s > {hard_max_sec:.1f}s)"
    if not metrics["healthy"]:
        return (
            False,
            -1e9,
            f"音频异常 (rms={metrics['rms_dbfs']}dB, peak={metrics['peak_dbfs']}dB, clip={metrics['clip_ratio']:.4f})",
        )

    score = 0.0
    # 1. 时长打分：优先 8-30 秒；若同时落在 10-19 秒再加微弱兼容分（兼顾 A100 40GB 20s 限制）
    if min_sec <= dur <= prefer_max_sec:
        score += 100.0
        if 10.0 <= dur <= 19.0:
            score += 12.0
        else:
            # 距理想中心 15s 越近越好
            score += max(0.0, 10.0 - abs(dur - 15.0) * 0.5)
    elif 4.5 <= dur < min_sec:
        score += 55.0 + (dur / min_sec) * 15.0
    elif prefer_max_sec < dur <= hard_max_sec:
        score += 45.0 - (dur - prefer_max_sec) * 0.8
    else:
        score += 20.0

    # 2. 日语文本打分
    jp_info = analyze_japanese_text(cleaned_text)
    if jp_info["is_japanese"]:
        score += 40.0 + jp_info["jp_ratio"] * 15.0
    elif jp_info["len"] > 0:
        score += 5.0
    else:
        score -= 10.0

    # 3. 语速合理性（参考文本字数与时长大致匹配，过滤明显错配字幕）
    if jp_info["len"] > 0 and dur > 0:
        cps = jp_info["len"] / dur
        if 2.5 <= cps <= 10.5:
            score += 15.0
        elif cps < 1.0 or cps > 16.0:
            score -= 15.0

    # 4. 音频动态余量打分
    if -28.0 <= metrics["rms_dbfs"] <= -10.0:
        score += 8.0
    if metrics["clip_ratio"] < 0.001:
        score += 5.0

    note = f"dur={dur:.2f}s, jp={jp_info['is_japanese']}, chars={jp_info['len']}, rms={metrics['rms_dbfs']}dB"
    return True, round(score, 2), note


def compute_ref_hash(references: list[dict[str, Any]]) -> str:
    h = hashlib.sha256()
    for ref in references:
        h.update(str(ref.get("sha256", "")).encode("utf-8"))
        h.update(b"|")
        h.update(str(ref.get("text", "")).encode("utf-8"))
        h.update(b"\n")
    return h.hexdigest()[:16]


def process_single_model(
    profile_id: str,
    model_id: str,
    api_key: str,
    refs_dir: Path,
    min_sec: float,
    prefer_max_sec: float,
    hard_max_sec: float,
    max_clips: int,
    max_total_sec: float,
    verifier: AnimeWhisperVerifier | None,
    asr_replace_threshold: float,
    asr_always_use: bool,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """拉取单个 Fish Audio 模型元数据并筛选 1-2 段最佳 44.1kHz 单声道 WAV 参考音。"""
    meta = fetch_fish_model_metadata(model_id, api_key)
    samples = meta.get("samples") or []
    if not isinstance(samples, list) or not samples:
        raise RuntimeError(f"模型 {model_id} 的 samples 列表为空")

    candidates: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix=f"fish_ref_{profile_id}_") as tmp_str:
        tmp_dir = Path(tmp_str)
        # 最多试下前 8 条样本以避免浪费带宽
        for idx, sample in enumerate(samples[:8]):
            if not isinstance(sample, dict):
                continue
            audio_url = resolve_sample_url(
                sample.get("audio") or sample.get("url") or sample.get("audio_url")
            )
            if not audio_url:
                continue

            raw_text = str(sample.get("text") or sample.get("transcript") or "")
            cleaned_text = clean_sample_text(raw_text)

            try:
                status, blob, _ = http_get_bytes(audio_url, timeout=35.0, retries=2)
                if status != 200 or len(blob) < 1024:
                    continue
                ext = Path(urllib.parse.urlparse(audio_url).path).suffix or ".audio"
                raw_file = tmp_dir / f"cand_{idx}{ext}"
                wav_file = tmp_dir / f"cand_{idx}.wav"
                raw_file.write_bytes(blob)
                convert_to_44k_mono_wav(raw_file, wav_file)
                metrics = inspect_wav_metrics(wav_file)
                ok, score, note = score_candidate(
                    metrics,
                    cleaned_text,
                    min_sec=min_sec,
                    prefer_max_sec=prefer_max_sec,
                    hard_max_sec=hard_max_sec,
                )
                if ok:
                    candidates.append(
                        {
                            "idx": idx,
                            "score": score,
                            "note": note,
                            "wav_tmp": wav_file,
                            "metrics": metrics,
                            "raw_text": raw_text,
                            "cleaned_text": cleaned_text,
                            "source_url": audio_url,
                            "title": str(sample.get("title") or ""),
                        }
                    )
            except Exception:
                continue

        if not candidates:
            raise RuntimeError(
                f"模型 {model_id} 共 {len(samples)} 条样本，但均未通过时长(<= {hard_max_sec}s)/下载/音频健康校验"
            )

        candidates.sort(key=lambda x: x["score"], reverse=True)

        selected: list[dict[str, Any]] = []
        total_dur = 0.0
        for cand in candidates:
            if len(selected) >= max_clips:
                break
            dur = cand["metrics"]["duration_sec"]
            if selected and (total_dur + dur > max_total_sec):
                continue
            selected.append(cand)
            total_dur += dur

        if not selected:
            selected = [candidates[0]]

        # 落盘到 refs_dir，并执行可选 ASR 复核
        final_refs: list[dict[str, Any]] = []
        # 清理该 profileId 旧缓存切片，防止残留脏文件
        for old in refs_dir.glob(f"{profile_id}_*.wav"):
            old.unlink(missing_ok=True)

        for out_idx, cand in enumerate(selected):
            out_wav = refs_dir / f"{profile_id}_{out_idx}.wav"
            shutil.copy2(cand["wav_tmp"], out_wav)
            file_sha = sha256_file(out_wav)
            text_final = cand["cleaned_text"]
            text_source = "metadata"
            asr_text = None
            asr_cer = None

            if verifier is not None:
                asr_text = verifier.transcribe(out_wav)
                jp_meta = analyze_japanese_text(text_final)
                asr_cer = verifier.kana_cer(text_final, asr_text) if text_final else 1.0
                if (
                    asr_always_use
                    or not text_final
                    or not jp_meta["is_japanese"]
                    or asr_cer > asr_replace_threshold
                ):
                    if asr_text:
                        text_final = asr_text
                        text_source = "anime_whisper"

            final_refs.append(
                {
                    "audio_path": str(out_wav.resolve()),
                    "rel_path": os.path.relpath(out_wav.resolve(), Path.cwd().resolve()),
                    "text": text_final,
                    "raw_text": cand["raw_text"],
                    "text_source": text_source,
                    "asr_text": asr_text,
                    "asr_cer": asr_cer,
                    "duration_sec": cand["metrics"]["duration_sec"],
                    "sample_rate": cand["metrics"]["sample_rate"],
                    "channels": cand["metrics"]["channels"],
                    "rms_dbfs": cand["metrics"]["rms_dbfs"],
                    "peak_dbfs": cand["metrics"]["peak_dbfs"],
                    "sha256": file_sha,
                    "source_url": cand["source_url"],
                    "score": cand["score"],
                }
            )

        return meta, final_refs


def build_audition_html(resolved: dict[str, Any], out_html: Path) -> None:
    """生成轻量静态 HTML 参考音试听页，方便本地或 Colab 核对 25 位角色原声参考。"""
    rows: list[str] = []
    for pid, pdata in resolved.get("profiles", {}).items():
        source = pdata.get("source", "unknown")
        title = pdata.get("fishModelTitle") or pdata.get("fishModelId") or "-"
        clips_html = []
        for ref in pdata.get("references", []):
            rel = os.path.relpath(ref["audio_path"], out_html.parent.resolve())
            txt = html.escape(ref.get("text", ""))
            dur = ref.get("duration_sec", 0.0)
            src_tag = html.escape(str(ref.get("text_source", "metadata")))
            clips_html.append(
                f"<div style='margin:6px 0;'>"
                f"<audio controls preload='none' src='{html.escape(rel)}' style='height:32px;width:280px;'></audio>"
                f"<div style='font-size:12px;color:#334155;'>({dur:.1f}s · {src_tag}) {txt}</div>"
                f"</div>"
            )
        rows.append(
            "<tr>"
            f"<td><b>{html.escape(pid)}</b><br><span style='color:#64748b;font-size:12px;'>"
            f"{html.escape(str(pdata.get('displayName', '')))}</span></td>"
            f"<td><code>{html.escape(source)}</code><br><span style='font-size:12px;'>"
            f"{html.escape(str(title))}</span></td>"
            f"<td>{''.join(clips_html) or '<span style=\"color:#dc2626;\">无可用参考音</span>'}</td>"
            "</tr>"
        )

    doc = (
        "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>"
        "<title>Fish Audio 参考音预览</title>"
        "<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;}"
        "table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #cbd5e1;}"
        "th,td{border:1px solid #e2e8f0;padding:10px 12px;text-align:left;vertical-align:top;}"
        "th{background:#eff6ff;color:#1e3a8a;}</style></head><body>"
        f"<h2>Fish Audio Drama 3 参考音清单（共 {len(resolved.get('profiles', {}))} 套声线）</h2>"
        "<table><thead><tr><th>Profile</th><th>来源 / 模型</th><th>44.1kHz 参考切片与清洗后日文转写</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table></body></html>"
    )
    out_html.parent.mkdir(parents=True, exist_ok=True)
    out_html.write_text(doc, encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="拉取 Fish Audio 公开参考样本并转为 Drama 3 44.1kHz 单声道 WAV"
    )
    parser.add_argument(
        "--casting",
        type=Path,
        default=Path("tools/voice/casting_fish_audio.json"),
        help="选角配置文件路径（默认 tools/voice/casting_fish_audio.json）",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("tools/voice/refs_resolved.json"),
        help="输出的解析清单路径（默认 tools/voice/refs_resolved.json）",
    )
    parser.add_argument(
        "--refs-dir",
        type=Path,
        default=Path("tools/voice/refs_cache"),
        help="44.1kHz 单声道 WAV 输出目录（需传给 sgl-omni serve --allowed-local-media-path）",
    )
    parser.add_argument(
        "--custom-refs-dir",
        type=Path,
        default=Path("tools/voice/custom_refs"),
        help="本地手工干声覆写目录（放置 <profileId>.wav + <profileId>.txt）",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=os.environ.get("FISH_API_KEY", ""),
        help="Fish Audio API Key（默认读取环境变量 FISH_API_KEY，查元数据零计费）",
    )
    parser.add_argument(
        "--verify-asr",
        action="store_true",
        help="使用 litagin/anime-whisper 复核参考音频真实日文转写（严禁传 initial_prompt）",
    )
    parser.add_argument(
        "--asr-device",
        type=str,
        default="auto",
        help="ASR 推理设备（auto / cuda / cpu，默认 auto）",
    )
    parser.add_argument(
        "--asr-replace-threshold",
        type=float,
        default=0.35,
        help="ASR Kana CER 超过该阈值时用真实转写替换元数据文本（默认 0.35）",
    )
    parser.add_argument(
        "--asr-always-use",
        action="store_true",
        help="开启 --verify-asr 时总是采用 anime-whisper 转写结果",
    )
    parser.add_argument(
        "--min-seconds",
        type=float,
        default=8.0,
        help="优先样本最小时长（秒，默认 8.0）",
    )
    parser.add_argument(
        "--prefer-max-seconds",
        type=float,
        default=30.0,
        help="优先样本最大时长（秒，默认 30.0）",
    )
    parser.add_argument(
        "--max-seconds",
        type=float,
        default=55.0,
        help="单段参考音绝对硬上限（秒，最大 55.0；A100 40GB 建议设 19.0）",
    )
    parser.add_argument(
        "--max-clips",
        type=int,
        default=2,
        help="每个声线最多保留参考切片数（1-2，默认 2）",
    )
    parser.add_argument(
        "--max-total-seconds",
        type=float,
        default=35.0,
        help="单声线参考切片总时长上限（秒，默认 35.0）",
    )
    parser.add_argument(
        "--only-profiles",
        type=str,
        default="",
        help="仅更新指定 profileId（逗号分隔），其余保留已有 refs_resolved.json 记录",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="忽略已有缓存，强制重新拉取与转码",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅解析 casting 与 custom_refs 状态，不访问网络或转码",
    )
    parser.add_argument(
        "--preview-html",
        type=Path,
        default=None,
        help="可选：输出静态 HTML 参考音试听页路径",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    hard_max_sec = min(55.0, max(5.0, float(args.max_seconds)))
    max_clips = max(1, min(3, int(args.max_clips)))

    if not args.casting.is_file():
        print(f"[ERROR] 找不到选角表文件: {args.casting}", file=sys.stderr)
        return 2

    profiles = load_casting_profiles(args.casting)
    if not profiles:
        print(f"[ERROR] 选角表 {args.casting} 中未解析到任何角色声线配置", file=sys.stderr)
        return 2

    only_set = {x.strip() for x in args.only_profiles.split(",") if x.strip()}

    if args.dry_run:
        print(f"[DRY-RUN] 解析到 {len(profiles)} 套角色声线（硬上限 {hard_max_sec:.1f}s）:")
        for p in profiles:
            pid = p["profileId"]
            if only_set and pid not in only_set:
                continue
            custom = discover_custom_override(args.custom_refs_dir, pid)
            mode = f"CUSTOM({len(custom)})" if custom else f"primary={p['primaryModelId']}, backups={p['backupModelIds']}"
            print(f"  - {pid:20s} ({p['displayName']}) -> {mode}")
        return 0

    ensure_ffmpeg()
    args.refs_dir.mkdir(parents=True, exist_ok=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    # 读取旧 refs_resolved.json 便于增量复用
    existing_profiles: dict[str, Any] = {}
    if args.out.is_file():
        try:
            old_data = json.loads(args.out.read_text(encoding="utf-8"))
            if isinstance(old_data.get("profiles"), dict):
                existing_profiles = old_data["profiles"]
        except Exception:
            existing_profiles = {}

    if not args.api_key:
        print(
            "[WARN] 未提供 FISH_API_KEY（环境变量或 --api-key）。"
            "仅命中 custom_refs 或本地缓存的声线可正常处理；调用 api.fish.audio/model/{id} 可能需要鉴权。",
            file=sys.stderr,
        )

    verifier = AnimeWhisperVerifier(device=args.asr_device) if args.verify_asr else None

    resolved_profiles: dict[str, Any] = {}
    stats = {
        "totalProfiles": len(profiles),
        "resolved": 0,
        "primaryUsed": 0,
        "backupUsed": 0,
        "customOverrides": 0,
        "reusedCache": 0,
        "failed": 0,
    }

    for idx, prof in enumerate(profiles, 1):
        pid = prof["profileId"]
        display = prof["displayName"]
        primary_id = prof["primaryModelId"]
        backup_ids = prof["backupModelIds"]

        if only_set and pid not in only_set:
            if pid in existing_profiles:
                resolved_profiles[pid] = existing_profiles[pid]
                if existing_profiles[pid].get("references"):
                    stats["resolved"] += 1
                    stats["reusedCache"] += 1
            continue

        # 1. 优先检测 custom_refs/<profileId>.wav + .txt 手工覆写
        custom_clips = discover_custom_override(args.custom_refs_dir, pid)
        if custom_clips:
            print(f"[{idx:02d}/{len(profiles):02d}] {pid} ({display}) -> 命中本地 custom_refs 覆写 ({len(custom_clips)} 段)", flush=True)
            for old in args.refs_dir.glob(f"{pid}_*.wav"):
                old.unlink(missing_ok=True)
            refs_out: list[dict[str, Any]] = []
            fallback_log: list[str] = []
            for c_idx, (audio_src, txt_src) in enumerate(custom_clips[:max_clips]):
                out_wav = args.refs_dir / f"{pid}_custom_{c_idx}.wav"
                convert_to_44k_mono_wav(audio_src, out_wav)
                metrics = inspect_wav_metrics(out_wav)
                if metrics["duration_sec"] > hard_max_sec:
                    trim_to = min(28.0, hard_max_sec - 0.5)
                    fallback_log.append(
                        f"custom clip {audio_src.name} 时长 {metrics['duration_sec']}s 超过上限 {hard_max_sec}s，已安全截断至 {trim_to:.1f}s"
                    )
                    convert_to_44k_mono_wav(audio_src, out_wav, max_duration=trim_to)
                    metrics = inspect_wav_metrics(out_wav)

                raw_txt = txt_src.read_text(encoding="utf-8").strip() if txt_src else ""
                cleaned_txt = clean_sample_text(raw_txt)
                text_source = "custom_txt" if cleaned_txt else "empty"
                asr_text = None
                asr_cer = None

                if verifier is not None:
                    asr_text = verifier.transcribe(out_wav)
                    asr_cer = verifier.kana_cer(cleaned_txt, asr_text) if cleaned_txt else 1.0
                    if args.asr_always_use or not cleaned_txt or asr_cer > args.asr_replace_threshold:
                        if asr_text:
                            cleaned_txt = asr_text
                            text_source = "anime_whisper"
                elif not cleaned_txt:
                    fallback_log.append(f"custom clip {audio_src.name} 缺少对应 .txt 转写文本，建议补充或开启 --verify-asr")

                refs_out.append(
                    {
                        "audio_path": str(out_wav.resolve()),
                        "rel_path": os.path.relpath(out_wav.resolve(), Path.cwd().resolve()),
                        "text": cleaned_txt,
                        "raw_text": raw_txt,
                        "text_source": text_source,
                        "asr_text": asr_text,
                        "asr_cer": asr_cer,
                        "duration_sec": metrics["duration_sec"],
                        "sample_rate": metrics["sample_rate"],
                        "channels": metrics["channels"],
                        "rms_dbfs": metrics["rms_dbfs"],
                        "peak_dbfs": metrics["peak_dbfs"],
                        "sha256": sha256_file(out_wav),
                        "source_url": f"custom://{audio_src.name}",
                    }
                )

            resolved_profiles[pid] = {
                "profileId": pid,
                "displayName": display,
                "charIds": prof["charIds"],
                "source": "custom_override",
                "fishModelId": primary_id,
                "primaryModelId": primary_id,
                "backupModelIds": backup_ids,
                "fishModelTitle": f"Custom Override ({pid})",
                "refHash": compute_ref_hash(refs_out),
                "totalDurationSec": round(sum(r["duration_sec"] for r in refs_out), 3),
                "references": refs_out,
                "fallbackLog": fallback_log,
            }
            stats["resolved"] += 1
            stats["customOverrides"] += 1
            continue

        # 2. 检查是否可安全复用本地缓存（非 --force 且文件存在且模型 ID 未变）
        prev = existing_profiles.get(pid)
        if (
            not args.force
            and isinstance(prev, dict)
            and prev.get("source") in ("primary", "backup")
            and prev.get("primaryModelId") == primary_id
            and prev.get("references")
            and all(
                Path(r.get("audio_path", "")).is_file()
                and float(r.get("duration_sec", 999)) <= hard_max_sec
                for r in prev["references"]
            )
            and (not args.verify_asr or all(r.get("asr_text") is not None for r in prev["references"]))
        ):
            print(f"[{idx:02d}/{len(profiles):02d}] {pid} ({display}) -> 复用本地有效缓存 ({prev['source']})", flush=True)
            resolved_profiles[pid] = prev
            stats["resolved"] += 1
            stats["reusedCache"] += 1
            if prev["source"] == "primary":
                stats["primaryUsed"] += 1
            else:
                stats["backupUsed"] += 1
            continue

        # 3. 依次尝试 primary -> backup 模型
        candidate_models: list[tuple[str, str]] = []
        if primary_id:
            candidate_models.append(("primary", primary_id))
        for b_id in backup_ids:
            candidate_models.append(("backup", b_id))

        fallback_log = []
        success_entry = None
        for tier_label, mid in candidate_models:
            try:
                print(
                    f"[{idx:02d}/{len(profiles):02d}] {pid} ({display}) -> 查询 {tier_label} 模型 {mid} ...",
                    flush=True,
                )
                meta, refs_out = process_single_model(
                    profile_id=pid,
                    model_id=mid,
                    api_key=args.api_key,
                    refs_dir=args.refs_dir,
                    min_sec=args.min_seconds,
                    prefer_max_sec=args.prefer_max_seconds,
                    hard_max_sec=hard_max_sec,
                    max_clips=max_clips,
                    max_total_sec=args.max_total_seconds,
                    verifier=verifier,
                    asr_replace_threshold=args.asr_replace_threshold,
                    asr_always_use=args.asr_always_use,
                )
                success_entry = {
                    "profileId": pid,
                    "displayName": display,
                    "charIds": prof["charIds"],
                    "source": tier_label,
                    "fishModelId": mid,
                    "primaryModelId": primary_id,
                    "backupModelIds": backup_ids,
                    "fishModelTitle": str(meta.get("title") or ""),
                    "fishModelLanguages": meta.get("languages") or [],
                    "refHash": compute_ref_hash(refs_out),
                    "totalDurationSec": round(sum(r["duration_sec"] for r in refs_out), 3),
                    "references": refs_out,
                    "fallbackLog": fallback_log,
                }
                if tier_label == "primary":
                    stats["primaryUsed"] += 1
                else:
                    stats["backupUsed"] += 1
                    print(f"    ↳ 已平滑降级至 backup 模型 {mid} ({meta.get('title', '')})", flush=True)
                stats["resolved"] += 1
                break
            except Exception as exc:
                msg = f"{tier_label} 模型 {mid} 失败: {exc}"
                fallback_log.append(msg)
                print(f"    [WARN] {msg}", file=sys.stderr, flush=True)

        if success_entry is not None:
            resolved_profiles[pid] = success_entry
        else:
            stats["failed"] += 1
            resolved_profiles[pid] = {
                "profileId": pid,
                "displayName": display,
                "charIds": prof["charIds"],
                "source": "failed",
                "fishModelId": primary_id,
                "primaryModelId": primary_id,
                "backupModelIds": backup_ids,
                "fishModelTitle": "",
                "refHash": "",
                "totalDurationSec": 0.0,
                "references": [],
                "fallbackLog": fallback_log or ["未配置 primary 或 backup 模型 ID"],
            }

    payload = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "refsDir": str(args.refs_dir.resolve()),
        "castingFile": str(args.casting),
        "asrVerified": bool(args.verify_asr),
        "maxSecondsCap": hard_max_sec,
        "summary": stats,
        "profiles": resolved_profiles,
    }

    tmp_out = args.out.with_suffix(args.out.suffix + ".tmp")
    tmp_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp_out, args.out)

    if args.preview_html is not None:
        build_audition_html(payload, args.preview_html)
        print(f"[OK] 已生成参考音 HTML 试听页: {args.preview_html}")

    print(
        f"\n[DONE] refs_resolved.json 已写入 {args.out}\n"
        f"  总声线: {stats['totalProfiles']} | 成功: {stats['resolved']} "
        f"(primary={stats['primaryUsed']}, backup={stats['backupUsed']}, custom={stats['customOverrides']}, cache={stats['reusedCache']}) "
        f"| 失败: {stats['failed']}"
    )
    return 0 if stats["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
