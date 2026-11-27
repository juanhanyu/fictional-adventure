#!/usr/bin/env python3
"""
Fish Audio Drama 3 / Fish Cloud API 日语语音批量生产、四层工业级质检与响度归一化流水线。

核心特性：
1. 双后端无缝切换：
   - `--backend sglang`：本地 SGLang-Omni (`http://127.0.0.1:8000/v1/audio/speech`)，单角色单句模式，
     彻底规避多角色串音 Bug。
   - `--backend fish_api`：Fish Audio Cloud API (`https://api.fish.audio/v1/tts`)，支持 `drama-3` 与
     `$0` 免费 `s2.1-pro-free`，直传 `reference_id`，无需提前拉取参考音。
2. 严格遵守 SGLang-Omni Drama 3 采样铁律：
   - `temperature: 1.0`, `top_p: 0.9`
   - 严禁传 `top_k`（避免中途静音）与 `seed`（服务端拒绝）
    - 动态估算 `max_new_tokens`（短句 `<=12` 字收紧至 `[110, 220]` 防尾部续写参考音；长句夹在 `[220, 1024]`）
    - 首词静音 Bug 防护：若 `drama3_input` 以 `[sighs]`/`[pause]` 等开头自动微调
3. 四档生产范围 `--scope`：`audition` (~50) / `p1` (~380) / `main` (~965) / `all` (~1,330)，
   以及 `--only-ids` 精准单句返修。
4. SHA-256 断点续传缓存键：`sha256(drama3_input + ref_hash + backend + model_id)`。
5. 四层工业级自动质检 + 后处理：
   (1) 时长/语速合理性校验 + 句中异常死寂硬门禁（`internal_max_silence > 1.35s @ <-46dB` → `internal_silence_gap`）
   (2) 削波/峰值检测与无声文件拦截
   (3) 可选 `--asr-qc`：`litagin/anime-whisper` 全句长覆盖反向转写（含 1–5 字短句，严禁传 `initial_prompt`！）
       + Kana CER + 幻觉暴涨拦截（`asr_hallucination_extra`）+ 句首/句尾吞字拦截（`asr_tail_truncated`）
   (4) FFmpeg 极保守静音修剪（`-55dB` 门限，保留前 `100ms` + 后 `240ms`；`<3.2s` 短句不裁句尾）+ 双遍 `loudnorm`
       至 `-16 LUFS / -1.5 dBTP / LRA=7`（显式 `-ar 44100 -ac 1` 避开 192kHz 坑）
       → 编码 `MP3 64 kbps mono` 落盘 `assets/voice/<audioRelPath>`。
6. 输出 `tools/voice/qa_report.json` 并自动调用 `node tools/voice/build_manifest.mjs`。
"""

from __future__ import annotations

import argparse
import array
import concurrent.futures
import datetime as dt
import hashlib
import inspect
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
import urllib.error
import urllib.request
import wave
from pathlib import Path
from typing import Any

try:
    import requests  # type: ignore
except ImportError:
    requests = None

FISH_CLOUD_TTS_URL = "https://api.fish.audio/v1/tts"
CODEC_FPS = 21.5
TOKEN_REDUNDANCY = 1.8
MIN_NEW_TOKENS = 220
MAX_NEW_TOKENS = 1024

# 短句（纯日文口语字符 <= 12）紧凑 token 预算，彻底根治念完台词后接着背诵参考音频幻觉
SHORT_SPOKEN_CHARS_MAX = 12
SHORT_MIN_NEW_TOKENS = 110
SHORT_MAX_NEW_TOKENS = 220
SHORT_TOKEN_REDUNDANCY = 1.6
SHORT_TOKEN_FLAT_PAD = 40

# 极保守首尾静音修剪与句中死寂断档门禁常量
TRIM_SILENCE_DB = -55.0
SHORT_DEAD_SILENCE_DB = -58.0
SHORT_NO_TAIL_TRIM_MAX_RAW_SEC = 3.2
SHORT_DEAD_TAIL_KEEP_SEC = 0.60
TRIM_PAD_HEAD_SEC = 0.100
TRIM_PAD_TAIL_SEC = 0.240
INTERNAL_SILENCE_DB = -46.0
INTERNAL_MAX_SILENCE_LIMIT_SEC = 1.35

# 本项目真实第一章 + 关键高潮幕场景 ID（用于 --scope p1 默认兜底筛选）
P1_SCENE_IDS = frozenset(
    {
        "s_start",
        "s_first_word",
        "s_aino_sparring",
        "s_star_festival",
        "s_turnpoint",
        "s_black_name",
        "s_north_forest",
        "s_distant_wind_1",
        "s_eye_of_storm",
        "s_leaky_cup",
        "s_interlude_white_night",
    }
)

SPEAKER_TAG_RE = re.compile(r"<\|speaker:\d+\|>\s*", re.IGNORECASE)
INLINE_TAG_RE = re.compile(r"\[[^\]]{1,48}\]")
XML_PROSODY_TAG_RE = re.compile(r"</?[a-zA-Z_][a-zA-Z0-9_\s-]{0,31}>")

# 易诱发首词后静音 Bug 的开头呼吸/停顿标签
LEADING_PAUSE_TAG_RE = re.compile(
    r"^(?P<prefix>[\s「『\"'（(]*)"
    r"\[(?P<tag>pause|short\s+pause|long\s+pause|silence|break)\]\s*",
    re.IGNORECASE,
)
LEADING_BREATH_TAG_RE = re.compile(
    r"^(?P<prefix>[\s「『\"'（(]*)"
    r"\[(?P<tag>sighs?|inhale|exhale|breath|breathes?|gasps?|hesitate|whisper)\]\s*",
    re.IGNORECASE,
)

PUNCT_PAUSE_RE = re.compile(r"[、。，．！？!?,.;:…―—]+")
SPOKEN_CHAR_RE = re.compile(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBFA-Za-z0-9ー]")
KANJI_CHAR_RE = re.compile(r"[\u4E00-\u9FFF\u3400-\u4DBF]")
FISH_URL_ID_RE = re.compile(r"(?:fish\.audio/(?:[a-zA-Z-]+/)?m/)([a-zA-Z0-9_-]{12,64})", re.IGNORECASE)

_HIRA_VOWEL_GROUPS = (
    ("あかさたなはまやらわがざだばぱぁゃゎ", "あ"),
    ("いきしちにひみりゐぎじぢびぴぃ", "い"),
    ("うくすつぬふむゆるぐずづぶぷぅゅ", "う"),
    ("えけせてねへめれゑげぜでべぺぇ", "え"),
    ("おこそとのほもよろをごぞどぼぽぉょ", "お"),
)
_HIRA_TO_VOWEL: dict[str, str] = {
    ch: vowel for chars, vowel in _HIRA_VOWEL_GROUPS for ch in chars
}


def _extract_model_id(raw: Any) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        val = raw.strip()
        if not val:
            return None
        m = FISH_URL_ID_RE.search(val)
        if m:
            return m.group(1)
        return val if "/" not in val and len(val) >= 12 else None
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
            found = _extract_model_id(raw.get(key))
            if found:
                return found
    return None


def _katakana_to_hiragana(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)


def _expand_prolonged_sound_mark(hira_text: str) -> str:
    """将长音符 `ー`/`〜`/`～` 按前一假名母音段展开为对应平假名母音，消除 `そー` vs `そう` 误差。"""
    out: list[str] = []
    for ch in hira_text:
        if ch in ("ー", "〜", "～"):
            if out and out[-1] in _HIRA_TO_VOWEL:
                out.append(_HIRA_TO_VOWEL[out[-1]])
            continue
        out.append(ch)
    return "".join(out)


def _fold_phonetic_equiv(kana: str) -> str:
    """
    折叠日语语音学常见同音异写等价形式（用于 CER 与句首/句尾吞字比对）：
    - 助词与四假名同音：`わ↔は`、`え↔へ`、`お↔を`、`じ↔ぢ`、`ず↔づ`
    - 长音同音：`おう↔おお`（お段+う→お）、`えい↔ええ`（え段+い→え）
    """
    s = (
        kana.replace("ぢ", "じ")
        .replace("づ", "ず")
        .replace("を", "お")
        .replace("は", "わ")
        .replace("へ", "え")
    )
    s = re.sub(r"([おこごそぞとどのほぼぽもよろょぉ])う", r"\1お", s)
    s = re.sub(r"([えけげせぜてでねへべぺめれぇ])い", r"\1え", s)
    return s


def levenshtein_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


class KanaNormalizer:
    """将日文文本归一化为无标点假名序列（优先 pykakasi，缺失时回退正则假名化）。"""

    def __init__(self) -> None:
        self._kks = None
        self._loaded = False

    def _ensure_kks(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        try:
            import pykakasi  # type: ignore

            self._kks = pykakasi.kakasi()
        except ImportError:
            self._kks = None

    def to_kana(self, text: str) -> str:
        self._ensure_kks()
        cleaned = SPEAKER_TAG_RE.sub("", text or "")
        cleaned = INLINE_TAG_RE.sub("", cleaned)
        cleaned = XML_PROSODY_TAG_RE.sub("", cleaned)
        cleaned = unicodedata.normalize("NFKC", cleaned)
        if self._kks is not None:
            cleaned = "".join(item.get("hira", "") for item in self._kks.convert(cleaned))
        cleaned = _katakana_to_hiragana(cleaned)
        cleaned = _expand_prolonged_sound_mark(cleaned)
        # 去除所有中/日/英标点、括号与空白（保留核心读音字符）
        cleaned = re.sub(r"[^\u3040-\u309F\u4E00-\u9FFF0-9a-zA-Z]", "", cleaned)
        return cleaned.lower()

    def estimate_mora_len(self, kana_or_mixed: str) -> int:
        """若未装 pykakasi 导致残留汉字，按 1 汉字≈2 假名折算期望拍数，避免误触发幻觉暴涨判定。"""
        if not kana_or_mixed:
            return 0
        if self._kks is not None:
            return len(kana_or_mixed)
        kanji_n = len(KANJI_CHAR_RE.findall(kana_or_mixed))
        return len(kana_or_mixed) + kanji_n

    def kana_cer(self, ref_jp: str, hyp_jp: str) -> float:
        r_raw = self.to_kana(ref_jp)
        h_raw = self.to_kana(hyp_jp)
        if not r_raw:
            return 0.0 if not h_raw else 1.0
        raw_cer = levenshtein_distance(r_raw, h_raw) / float(len(r_raw))
        r_ph = _fold_phonetic_equiv(r_raw)
        h_ph = _fold_phonetic_equiv(h_raw)
        ph_cer = levenshtein_distance(r_ph, h_ph) / float(max(1, len(r_ph)))
        return round(min(raw_cer, ph_cer), 4)


class AnimeWhisperQC:
    """
    同卡反向转写质检器（litagin/anime-whisper）。
    铁律：
    1. 严禁传 `initial_prompt`！
    2. 全句长覆盖（含 1–5 字短句，绝不免检）！
    """

    def __init__(self, device: str = "auto") -> None:
        self.device_pref = device
        self._pipe = None
        self._lock = threading.Lock()
        self.normalizer = KanaNormalizer()

    def _ensure_loaded(self) -> None:
        if self._pipe is not None:
            return
        try:
            import torch  # type: ignore
            from transformers import pipeline  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                "启用 `--asr-qc` 需要安装 `torch`、`transformers`（建议同时安装 `pykakasi`）。"
            ) from e

        if self.device_pref == "auto":
            use_cuda = torch.cuda.is_available()
            device = "cuda" if use_cuda else "cpu"
            torch_dtype = torch.float16 if use_cuda else torch.float32
        else:
            device = self.device_pref
            torch_dtype = torch.float16 if str(device).startswith("cuda") else torch.float32

        print(f"[ASR-QC] 正在加载 litagin/anime-whisper (device={device}) ...", flush=True)
        pipe_kwargs: dict[str, Any] = {
            "model": "litagin/anime-whisper",
            "device": device,
            "chunk_length_s": 30.0,
        }
        try:
            sig_params = inspect.signature(pipeline).parameters
            if "dtype" in sig_params and "torch_dtype" not in sig_params:
                pipe_kwargs["dtype"] = torch_dtype
            else:
                pipe_kwargs["torch_dtype"] = torch_dtype
        except Exception:
            pipe_kwargs["torch_dtype"] = torch_dtype

        self._pipe = pipeline("automatic-speech-recognition", **pipe_kwargs)

    def _transcribe_raw(self, wav_path: Path) -> str:
        with self._lock:
            self._ensure_loaded()
            # 铁律：严禁传入 initial_prompt！短句（1-5字）同样强制执行反向转写！
            generate_kwargs = {
                "language": "Japanese",
                "no_repeat_ngram_size": 5,
                "repetition_penalty": 1.0,
            }
            assert "initial_prompt" not in generate_kwargs
            res = self._pipe(str(wav_path), generate_kwargs=generate_kwargs)
            return str(res.get("text", "") if isinstance(res, dict) else res).strip()

    def evaluate(self, wav_path: Path, ref_jp: str) -> tuple[str, float]:
        hyp = self._transcribe_raw(wav_path)
        cer = self.normalizer.kana_cer(ref_jp, hyp)
        return hyp, cer

    def evaluate_detailed(
        self,
        wav_path: Path,
        ref_jp: str,
        pcm_metrics: dict[str, Any],
    ) -> dict[str, Any]:
        """
        执行全句长 ASR 质检（含 1–5 字短句），除总 Kana CER 外额外拦截：
        1. `asr_hallucination_extra`：`len(hyp_kana) > max(len(exp_kana) * 1.45 + 4, len(exp_kana) + 8)`
        2. `asr_tail_truncated`：`len(exp_kana) >= 4` 且转写丢失句首/句末 1–2 个关键假名（兼容 `おう↔おお`、
           `わ↔は`、`え↔へ`、`お↔を` 等同音等价）且音频有效时长偏短。
        """
        hyp = self._transcribe_raw(wav_path)
        exp_kana = self.normalizer.to_kana(ref_jp)
        hyp_kana = self.normalizer.to_kana(hyp)
        cer = self.normalizer.kana_cer(ref_jp, hyp)
        extra_issues: list[str] = []

        exp_len = self.normalizer.estimate_mora_len(exp_kana)
        hyp_len = len(hyp_kana)

        # 1. 幻觉暴涨拦截（如念完短句后接着背出参考音频台词）
        if exp_len > 0 and hyp_len > max(exp_len * 1.45 + 4.0, float(exp_len + 8)):
            extra_issues.append("asr_hallucination_extra")

        # 2. 句首/句尾吞字拦截（兼容常见长音/助词等价）
        exp_ph = _fold_phonetic_equiv(exp_kana).rstrip("っ")
        hyp_ph = _fold_phonetic_equiv(hyp_kana).rstrip("っ")
        exp_cmp = re.sub(r"([あいうえお])\1$", r"\1", exp_ph)
        hyp_cmp = re.sub(r"([あいうえお])\1$", r"\1", hyp_ph)

        if len(exp_kana) >= 4 and len(exp_cmp) >= 4:
            _, punct_groups, _ = count_spoken_units(ref_jp)
            active_dur = float(pcm_metrics.get("active_duration", 0.0))
            expected_norm_dur = exp_len * 0.185 + max(0, punct_groups - 1) * 0.20 + 0.15
            is_short_audio = active_dur < expected_norm_dur

            tail_lost = False
            head_lost = False
            if not hyp_cmp:
                tail_lost = True
            elif len(hyp_cmp) < len(exp_cmp):
                # 句末丢失 1–2 个关键假名
                if hyp_cmp[-1] != exp_cmp[-1]:
                    suf_probe = hyp_cmp[-min(2, len(hyp_cmp)) :]
                    if (
                        exp_cmp[:-1].endswith(suf_probe)
                        or (len(exp_cmp) >= 5 and exp_cmp[:-2].endswith(suf_probe))
                        or (len(exp_cmp) >= 6 and exp_cmp[:-3].endswith(suf_probe))
                        or (exp_cmp[-1] not in hyp_cmp[-2:] and len(hyp_cmp) <= len(exp_cmp) - 2)
                    ):
                        tail_lost = True
                # 句首丢失 1–2 个关键假名（如「話せる」被吃成「なせる」）
                if hyp_cmp[0] != exp_cmp[0] and len(hyp_cmp) >= 2:
                    pre_probe = hyp_cmp[:2]
                    if exp_cmp[1:].startswith(pre_probe) or (
                        len(exp_cmp) >= 5 and exp_cmp[2:].startswith(pre_probe)
                    ):
                        head_lost = True

            if (tail_lost or head_lost) and is_short_audio:
                extra_issues.append("asr_tail_truncated")

        return {
            "hyp": hyp,
            "cer": cer,
            "exp_kana": exp_kana,
            "hyp_kana": hyp_kana,
            "extra_issues": extra_issues,
        }


def sanitize_drama3_input(raw_text: str) -> tuple[str, bool, str]:
    """
    单角色安全清洗 + 首词静音 Bug 防护：
    1. 清除意外混入的多角色 <|speaker:N|> 标签，强制单角色单句模式；
    2. 若句首以 [pause]/[short pause]/[long pause] 等停顿标签开头，直接移除；
    3. 若句首以 [sighs]/[inhale]/[breath] 等呼吸标签开头，优先挪移到首短语逗号/省略号后，
       若无合适停顿点则移除，彻底避免 Drama 3 首词后陷入静音 Bug。
    """
    notes: list[str] = []
    text = (raw_text or "").strip()

    if SPEAKER_TAG_RE.search(text):
        text = SPEAKER_TAG_RE.sub("", text).strip()
        notes.append("stripped_speaker_tag")

    # 循环清理多个连续开头停顿标签
    while True:
        m_pause = LEADING_PAUSE_TAG_RE.match(text)
        if m_pause:
            tag = m_pause.group("tag")
            text = (m_pause.group("prefix") + text[m_pause.end() :]).strip()
            notes.append(f"removed_leading_[{tag}]")
            continue

        m_breath = LEADING_BREATH_TAG_RE.match(text)
        if m_breath:
            tag = m_breath.group("tag")
            prefix = m_breath.group("prefix")
            rest = text[m_breath.end() :].strip()
            # 若前 12 字内有自然语顿（、 / …… / …），将 [sighs] 安全后移到语顿之后
            pause_match = re.search(r"(?:、|……|…)", rest[:14])
            if pause_match and pause_match.start() >= 1 and pause_match.end() < len(rest) - 1:
                pos = pause_match.end()
                text = f"{prefix}{rest[:pos]}[{tag}] {rest[pos:].lstrip()}".strip()
                notes.append(f"relocated_leading_[{tag}]")
            else:
                text = f"{prefix}{rest}".strip()
                notes.append(f"removed_leading_[{tag}]")
            continue
        break

    return text, bool(notes), ";".join(notes)


def count_spoken_units(text: str) -> tuple[int, int, int]:
    """返回 (口语字符数, 停顿标点段数, 行内动作标签数)。剔除 `[...]` 与 `<soft>` 等标签避免虚增字数。"""
    tags = INLINE_TAG_RE.findall(text or "")
    plain = XML_PROSODY_TAG_RE.sub("", INLINE_TAG_RE.sub("", SPEAKER_TAG_RE.sub("", text or "")))
    spoken_chars = len(SPOKEN_CHAR_RE.findall(plain))
    punct_groups = len(PUNCT_PAUSE_RE.findall(plain))
    return spoken_chars, punct_groups, len(tags)


def compute_max_new_tokens(text: str, retry_bump: int = 0) -> int:
    """
    按日文字数分级估算 `max_new_tokens`：
    - 短台词（纯日文 `<= 12` 字）：收紧在 `[110, 220]` 紧凑区间（`max(110, int(est_sec * 21.5 * 1.6 + 40))`，
      硬上限 `<= 220`），避免给短句过多帧数导致模型念完剧本后把参考音频台词接着背出来！
    - 常规/长台词（`> 12` 字）：时长 × 21.5 帧/秒 × 1.8 冗余，夹在 `[220, 1024]`。
    """
    spoken_chars, punct_groups, tag_count = count_spoken_units(text)
    if spoken_chars <= SHORT_SPOKEN_CHARS_MAX:
        est_sec = max(0.8, spoken_chars / 5.0 + punct_groups * 0.22 + tag_count * 0.35)
        short_frames = max(
            SHORT_MIN_NEW_TOKENS,
            int(est_sec * CODEC_FPS * SHORT_TOKEN_REDUNDANCY + SHORT_TOKEN_FLAT_PAD),
        ) + max(0, min(retry_bump, 32))
        return min(SHORT_MAX_NEW_TOKENS, short_frames)

    # 日语动画演出语速中枢约 5.0 字/秒 + 标点停顿 0.22s + 行内气息标签 0.55s
    est_sec = max(1.2, spoken_chars / 5.0 + punct_groups * 0.22 + tag_count * 0.55)
    raw_frames = int(math.ceil(est_sec * CODEC_FPS * TOKEN_REDUNDANCY)) + max(0, retry_bump)
    return max(MIN_NEW_TOKENS, min(MAX_NEW_TOKENS, raw_frames))


def normalize_audio_rel_path(rel_path: str, voice_id: str) -> str:
    p = (rel_path or f"{voice_id}.mp3").strip().replace("\\", "/")
    p = p.lstrip("/")
    if p.startswith("./"):
        p = p[2:]
    if p.startswith("assets/voice/"):
        p = p[len("assets/voice/") :]
    if not p.lower().endswith(".mp3"):
        p = str(Path(p).with_suffix(".mp3")).replace("\\", "/")
    return p


def load_script_lines(script_path: Path) -> list[dict[str, Any]]:
    """读取 tools/voice/script_jp_master.json（支持数组或 {lines: [...]}）。"""
    data = json.loads(script_path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        raw_lines = data
    elif isinstance(data, dict):
        raw_lines = (
            data.get("lines")
            or data.get("entries")
            or data.get("items")
            or data.get("script")
            or []
        )
    else:
        raise ValueError(f"Unsupported script JSON root: {type(data).__name__}")

    lines: list[dict[str, Any]] = []
    for idx, item in enumerate(raw_lines):
        if not isinstance(item, dict):
            continue
        voice_id = str(item.get("voiceId") or item.get("voice_id") or item.get("id") or f"v_{idx:04d}").strip()
        tier = str(item.get("tier") or "main").strip().lower()
        scene_id = str(item.get("sceneId") or item.get("scene_id") or "").strip()
        char_id = str(item.get("charId") or item.get("char_id") or "").strip()
        profile_id = str(item.get("profileId") or item.get("profile_id") or char_id).strip()
        zh_text = str(item.get("zh_text") or item.get("zhText") or item.get("text") or "").strip()
        jp_text = str(item.get("jp_text") or item.get("jpText") or "").strip()
        drama3_input = str(item.get("drama3_input") or item.get("drama3Input") or jp_text).strip()
        if not jp_text:
            jp_text = INLINE_TAG_RE.sub("", drama3_input).strip()
        audio_rel = normalize_audio_rel_path(
            str(item.get("audioRelPath") or item.get("audio_rel_path") or ""),
            voice_id,
        )

        lines.append(
            {
                "voiceId": voice_id,
                "tier": tier,
                "volume": item.get("volume"),
                "sceneId": scene_id,
                "charId": char_id,
                "profileId": profile_id,
                "zh_text": zh_text,
                "jp_text": jp_text,
                "drama3_input": drama3_input,
                "audioRelPath": audio_rel,
                "audition": bool(item.get("audition", False)),
                "p1": item.get("p1"),
                "priority": item.get("priority"),
                "isClimax": bool(item.get("isClimax", False)),
                "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
            }
        )
    return lines


def load_profile_registry(
    refs_path: Path | None,
    casting_path: Path | None,
    backend: str,
) -> dict[str, dict[str, Any]]:
    """
    加载声线注册表：
    - `sglang` 后端必须从 `refs_resolved.json` 读取本地 44.1kHz WAV 参考切片与转写；
    - `fish_api` 后端优先读 `refs_resolved.json`，若不存在则直接读 `casting_fish_audio.json`
      提取 `reference_id`，彻底实现免拉取参考音的 Cloud API 无缝模式。
    """
    registry: dict[str, dict[str, Any]] = {}

    if refs_path is not None and refs_path.is_file():
        data = json.loads(refs_path.read_text(encoding="utf-8"))
        profiles = data.get("profiles") or {}
        if isinstance(profiles, dict):
            for pid, pinfo in profiles.items():
                if isinstance(pinfo, dict):
                    registry[str(pid)] = pinfo

    if casting_path is not None and casting_path.is_file():
        cdata = json.loads(casting_path.read_text(encoding="utf-8"))
        raw_items: list[tuple[str | None, dict[str, Any]]] = []
        if isinstance(cdata, list):
            raw_items = [(None, x) for x in cdata if isinstance(x, dict)]
        elif isinstance(cdata, dict):
            container = None
            for k in ("profiles", "cast", "voices", "characters", "items"):
                if k in cdata:
                    container = cdata[k]
                    break
            if isinstance(container, list):
                raw_items = [(None, x) for x in container if isinstance(x, dict)]
            elif isinstance(container, dict):
                raw_items = [(str(k), v) for k, v in container.items() if isinstance(v, dict)]

        for fallback_key, entry in raw_items:
            pid = str(
                entry.get("profileId") or entry.get("profile_id") or entry.get("id") or fallback_key or ""
            ).strip()
            if not pid:
                continue
            primary_id = (
                _extract_model_id(entry.get("primary"))
                or _extract_model_id(entry.get("primaryModelId"))
                or _extract_model_id(entry.get("fishModelId"))
                or _extract_model_id(entry.get("reference_id"))
                or _extract_model_id(entry.get("modelId"))
            )
            backups: list[str] = []
            for bk in ("backup", "backups", "alt", "alts", "fallback", "secondary", "backupModelId", "backupModelIds"):
                val = entry.get(bk)
                if val is None:
                    continue
                for b_item in (val if isinstance(val, list) else [val]):
                    bid = _extract_model_id(b_item)
                    if bid and bid != primary_id and bid not in backups:
                        backups.append(bid)

            role_names = entry.get("roleNames")
            first_role_name = role_names[0] if isinstance(role_names, list) and role_names else None
            if pid not in registry:
                registry[pid] = {
                    "profileId": pid,
                    "displayName": str(entry.get("displayName") or entry.get("name") or first_role_name or pid),
                    "source": "casting_direct",
                    "fishModelId": primary_id,
                    "primaryModelId": primary_id,
                    "backupModelIds": backups,
                    "refHash": hashlib.sha256(f"fish_api:{primary_id}".encode("utf-8")).hexdigest()[:16],
                    "references": [],
                }
            else:
                if not registry[pid].get("fishModelId") and primary_id:
                    registry[pid]["fishModelId"] = primary_id
                if not registry[pid].get("backupModelIds") and backups:
                    registry[pid]["backupModelIds"] = backups

    if backend == "sglang" and not registry:
        raise RuntimeError(
            f"未找到有效参考音清单 `{refs_path}`！请先运行 `python3 tools/voice/fetch_fish_refs.py`。"
        )
    if backend == "fish_api" and not registry:
        raise RuntimeError(
            f"未找到 `{refs_path}` 或 `{casting_path}`，无法解析 Fish Audio Cloud API 的 reference_id。"
        )

    return registry


def select_lines_by_scope(
    all_lines: list[dict[str, Any]],
    scope: str,
    only_ids: set[str],
    only_profiles: set[str],
) -> list[dict[str, Any]]:
    """按 --only-ids / --scope / --only-profiles 精确筛选生产清单。"""
    if only_ids:
        selected = [ln for ln in all_lines if ln["voiceId"] in only_ids]
        missing = sorted(only_ids - {ln["voiceId"] for ln in selected})
        if missing:
            print(f"[WARN] 以下 --only-ids 未在台本中找到: {', '.join(missing)}", file=sys.stderr)
        return selected

    pool = [ln for ln in all_lines if (not only_profiles or ln["profileId"] in only_profiles)]

    if scope == "all":
        return pool

    if scope == "main":
        return [ln for ln in pool if ln["tier"] in ("main", "combat")]

    if scope == "p1":
        has_explicit_p1 = any(
            ln.get("p1") is True
            or str(ln.get("priority") or "").lower() in ("p1", "1")
            or "p1" in [str(t).lower() for t in ln.get("tags", [])]
            for ln in pool
        )
        selected = []
        for ln in pool:
            if has_explicit_p1:
                is_p1 = (
                    ln.get("p1") is True
                    or str(ln.get("priority") or "").lower() in ("p1", "1")
                    or "p1" in [str(t).lower() for t in ln.get("tags", [])]
                    or ln["tier"] == "combat"
                )
            else:
                is_p1 = (
                    ln["tier"] == "combat"
                    or ln.get("isClimax") is True
                    or ln["sceneId"] in P1_SCENE_IDS
                    or "climax" in [str(t).lower() for t in ln.get("tags", [])]
                )
            if is_p1:
                selected.append(ln)
        return selected

    if scope == "audition":
        # 优先采用台本显式标记 audition=true；若某角色不足 2 句则自动补足至 2 句代表性台词
        by_profile: dict[str, list[dict[str, Any]]] = {}
        for ln in pool:
            by_profile.setdefault(ln["profileId"], []).append(ln)

        picked_ids: set[str] = set()
        result: list[dict[str, Any]] = []
        for ln in pool:
            if ln["audition"]:
                picked_ids.add(ln["voiceId"])
                result.append(ln)

        for pid, items in by_profile.items():
            already = [x for x in result if x["profileId"] == pid]
            if len(already) >= 2:
                continue
            need = 2 - len(already)
            candidates = [x for x in items if x["voiceId"] not in picked_ids]

            def _rep_score(x: dict[str, Any]) -> tuple[int, float]:
                n_chars, _, _ = count_spoken_units(x["jp_text"])
                tier_prio = 2 if x["tier"] == "main" else (1 if x["tier"] == "combat" else 0)
                # 偏好 12-38 字表现力完整的中等句长
                len_penalty = abs(n_chars - 24)
                return (tier_prio, -len_penalty)

            candidates.sort(key=_rep_score, reverse=True)
            for cand in candidates[:need]:
                picked_ids.add(cand["voiceId"])
                result.append(cand)

        # 保持原台本顺序
        order = {ln["voiceId"]: i for i, ln in enumerate(pool)}
        result.sort(key=lambda x: order.get(x["voiceId"], 0))
        return result

    raise ValueError(f"Unsupported scope: {scope}")


def compute_cache_key(
    sanitized_input: str,
    ref_hash: str,
    backend: str,
    model_id: str,
) -> str:
    raw = f"{sanitized_input}\n{ref_hash}\n{backend}\n{model_id}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def ensure_ffmpeg() -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "未检测到 `ffmpeg`！请先安装 FFmpeg（Colab / Ubuntu: `apt-get install -y ffmpeg`）。"
        )


def check_sglang_health(sglang_url: str, timeout: float = 10.0) -> str:
    """检查 SGLang-Omni /health 端点是否就绪。"""
    base = sglang_url.split("/v1/")[0].rstrip("/")
    health_url = f"{base}/health"
    try:
        if requests is not None:
            r = requests.get(health_url, timeout=timeout)
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
            return r.text.strip()[:120]
        else:
            with urllib.request.urlopen(health_url, timeout=timeout) as resp:
                if getattr(resp, "status", 200) != 200:
                    raise RuntimeError(f"HTTP {resp.status}")
                return resp.read().decode("utf-8", errors="replace").strip()[:120]
    except Exception as e:
        raise RuntimeError(
            f"本地 SGLang-Omni 服务未就绪 ({health_url}): {e}\n"
            "请确认已启动 `sgl-omni serve` 或改用 `--backend fish_api`。"
        ) from e


def resolve_local_references(profile_info: dict[str, Any], max_clips: int) -> list[dict[str, str]]:
    """为 SGLang-Omni 构建单角色 references 数组（audio_path + text）。"""
    refs_in = profile_info.get("references") or []
    out: list[dict[str, str]] = []
    for ref in refs_in[:max_clips]:
        if not isinstance(ref, dict):
            continue
        apath = str(ref.get("audio_path") or "").strip()
        if not apath or not Path(apath).is_file():
            rel = str(ref.get("rel_path") or "").strip()
            if rel and Path(rel).is_file():
                apath = str(Path(rel).resolve())
        if not apath or not Path(apath).is_file():
            continue
        out.append({"audio_path": apath, "text": str(ref.get("text") or "").strip()})
    return out


def build_sglang_payload(
    text: str,
    references: list[dict[str, str]],
    temperature: float,
    top_p: float,
    max_new_tokens: int,
) -> dict[str, Any]:
    """
    构造严格合规的 SGLang-Omni Drama 3 请求体：
    - 严禁传 top_k（防中途静音）
    - 严禁传 seed（服务端拒收）
    """
    payload: dict[str, Any] = {
        "input": text,
        "references": references,
        "temperature": round(float(temperature), 3),
        "top_p": round(float(top_p), 3),
        "max_new_tokens": int(max_new_tokens),
        "response_format": "wav",
        "stream": False,
    }
    assert "top_k" not in payload, "SGLang-Omni Drama 3 严禁传 top_k！"
    assert "seed" not in payload, "SGLang-Omni Drama 3 严禁传 seed！"
    return payload


def call_sglang_tts(
    sglang_url: str,
    payload: dict[str, Any],
    timeout: float = 180.0,
) -> bytes:
    """调用本地 SGLang-Omni /v1/audio/speech，返回原始音频字节流。"""
    headers = {"Content-Type": "application/json"}
    if requests is not None:
        resp = requests.post(sglang_url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            raise RuntimeError(f"SGLang HTTP {resp.status_code}: {resp.text[:300]}")
        if len(resp.content) < 512:
            raise RuntimeError(f"SGLang 返回音频字节过小 ({len(resp.content)} B)")
        return resp.content
    else:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(sglang_url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                blob = resp.read()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")[:300]
            raise RuntimeError(f"SGLang HTTP {e.code}: {err_body}") from e
        if len(blob) < 512:
            raise RuntimeError(f"SGLang 返回音频字节过小 ({len(blob)} B)")
        return blob


def call_fish_cloud_tts(
    api_key: str,
    fish_model: str,
    reference_ids: list[str],
    text: str,
    temperature: float,
    top_p: float,
    max_new_tokens: int,
    timeout: float = 120.0,
) -> tuple[bytes, str]:
    """
    调用 Fish Audio Cloud API (`POST https://api.fish.audio/v1/tts`)。
    支持 `model: drama-3` 与 `$0` 免费 `model: s2.1-pro-free`，直传 `reference_id`，
    404 时平滑降级到备选 reference_id，429/5xx 自动指数退避。
    """
    if not api_key:
        raise RuntimeError("使用 `--backend fish_api` 必须提供 FISH_API_KEY（环境变量或 --fish-api-key）！")
    if not reference_ids:
        raise RuntimeError("当前声线缺少有效的 Fish Audio reference_id")

    last_err: Exception | None = None
    for ref_id in reference_ids:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "model": fish_model,
        }
        payload: dict[str, Any] = {
            "text": text,
            "reference_id": ref_id,
            "format": "wav",
            "sample_rate": 44100,
            "temperature": round(max(0.0, min(1.0, float(temperature))), 3),
            "top_p": round(max(0.0, min(1.0, float(top_p))), 3),
            "normalize": True,
            "language": "ja",
            "latency": "normal",
            "max_new_tokens": int(max_new_tokens),
        }

        for attempt in range(4):
            try:
                if requests is not None:
                    resp = requests.post(
                        FISH_CLOUD_TTS_URL,
                        json=payload,
                        headers=headers,
                        timeout=timeout,
                    )
                    status = resp.status_code
                    if status == 200 and len(resp.content) >= 512:
                        return resp.content, ref_id
                    if status == 402:
                        raise RuntimeError(
                            f"Fish Audio API 余额不足 (HTTP 402)。可切换免费模型 `--fish-api-model s2.1-pro-free`！"
                        )
                    if status == 404:
                        last_err = RuntimeError(f"reference_id={ref_id} 不存在 (HTTP 404)")
                        break  # 尝试下一个 backup reference_id
                    if status in (429, 500, 502, 503, 504) and attempt < 3:
                        wait_s = float(resp.headers.get("Retry-After", 1.5 * (2**attempt)))
                        time.sleep(min(wait_s, 20.0))
                        continue
                    raise RuntimeError(f"Fish API HTTP {status}: {resp.text[:300]}")
                else:
                    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                    req = urllib.request.Request(
                        FISH_CLOUD_TTS_URL, data=body, headers=headers, method="POST"
                    )
                    try:
                        with urllib.request.urlopen(req, timeout=timeout) as resp:
                            blob = resp.read()
                        if len(blob) >= 512:
                            return blob, ref_id
                        raise RuntimeError(f"Fish API 返回音频字节过小 ({len(blob)} B)")
                    except urllib.error.HTTPError as e:
                        err_txt = e.read().decode("utf-8", errors="replace")[:300]
                        if e.code == 402:
                            raise RuntimeError(
                                "Fish Audio API 余额不足 (HTTP 402)。可切换免费模型 `--fish-api-model s2.1-pro-free`！"
                            ) from e
                        if e.code == 404:
                            last_err = RuntimeError(f"reference_id={ref_id} 不存在 (HTTP 404)")
                            break
                        if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                            time.sleep(min(1.5 * (2**attempt), 20.0))
                            continue
                        raise RuntimeError(f"Fish API HTTP {e.code}: {err_txt}") from e
            except Exception as exc:
                last_err = exc
                if "HTTP 402" in str(exc):
                    raise
                if attempt < 3 and "HTTP 404" not in str(exc):
                    time.sleep(min(1.5 * (2**attempt), 15.0))
                    continue
                break

    raise RuntimeError(f"Fish Cloud API 合成失败: {last_err}")


def finalize_raw_to_pcm_wav(raw_bytes: bytes, raw_path: Path, clean_wav: Path) -> None:
    """
    先用 FFmpeg 重封装为标准 44.1 kHz 16-bit 单声道 WAV：
    兼容 SGLang-Omni 流式占位 WAV 头（0xFFFFFFFF）及 Fish API 任意返回头。
    """
    raw_path.write_bytes(raw_bytes)
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(raw_path),
        "-ac",
        "1",
        "-ar",
        "44100",
        "-c:a",
        "pcm_s16le",
        str(clean_wav),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not clean_wav.is_file() or clean_wav.stat().st_size < 1024:
        raise RuntimeError(f"原始音频解封装失败: {proc.stderr.strip()}")


def analyze_pcm_wav_and_speech_bounds(wav_path: Path) -> dict[str, Any]:
    """
    第二层质检 + 极保守静音边界与句中异常断档精准测量：
    1. 在 44.1 kHz 16-bit PCM 上以 10ms 窗口计算 RMS/峰值/削波率；
    2. 按极保守门限 `-55 dBFS`（兜底 `-58 dBFS`）测定起止有声边界，绝不误切清擦音 `s/k/t/h`
       和轻声尾助词 `だ/よ/な/ね/る/か？`；同时记录 `-58 dBFS` 末端边界供 `<3.2s` 短句保护使用；
    3. 检测首尾非静音区间（`-46 dBFS`）内部的连续静音断档 `internal_max_silence`（`> 1.35s` 即触发重抽）。
    """
    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sr <= 0 or n_frames == 0:
        return {
            "raw_duration": 0.0,
            "active_duration": 0.0,
            "speech_start": 0.0,
            "speech_end": 0.0,
            "dead58_end": 0.0,
            "internal_max_silence": 0.0,
            "rms_dbfs": -99.0,
            "peak_dbfs": -99.0,
            "clip_ratio": 0.0,
            "max_clip_run": 0,
            "is_silent": True,
            "is_clipped": False,
        }

    samples = array.array("h")
    samples.frombytes(raw)
    if sys.byteorder != "little":
        samples.byteswap()

    total = len(samples)
    raw_dur = total / float(sr)

    peak = 0
    sum_sq = 0.0
    clipped = 0
    clip_run = 0
    max_clip_run = 0
    for s in samples:
        a = -s if s < 0 else s
        if a > peak:
            peak = a
        if a >= 32760:
            clipped += 1
            clip_run += 1
            if clip_run > max_clip_run:
                max_clip_run = clip_run
        else:
            clip_run = 0
        sum_sq += s * s

    rms = math.sqrt(sum_sq / float(total))
    peak_dbfs = 20.0 * math.log10(peak / 32768.0) if peak > 0 else -99.0
    rms_dbfs = 20.0 * math.log10(rms / 32768.0) if rms > 0 else -99.0
    clip_ratio = clipped / float(total)

    # 10ms 窗计算分贝曲线
    win = max(1, int(sr * 0.010))
    win_dbfs: list[float] = []
    for start in range(0, total, win):
        end = min(total, start + win)
        w_sq = 0.0
        for v in samples[start:end]:
            w_sq += v * v
        w_rms = math.sqrt(w_sq / float(end - start))
        win_dbfs.append(20.0 * math.log10(w_rms / 32768.0) if w_rms > 0 else -99.0)

    def _find_idx_bounds(thresh_db: float) -> tuple[int, int] | None:
        first_idx = None
        last_idx = None
        for i, db in enumerate(win_dbfs):
            if db >= thresh_db:
                if first_idx is None:
                    first_idx = i
                last_idx = i
        if first_idx is None or last_idx is None:
            return None
        return first_idx, last_idx

    def _idx_to_sec_bounds(idx_pair: tuple[int, int] | None) -> tuple[float, float] | None:
        if idx_pair is None:
            return None
        first_idx, last_idx = idx_pair
        return first_idx * 0.010, min(raw_dur, (last_idx + 1) * 0.010)

    # 极保守首尾有声边界：门限降到 -55 dBFS（兜底 -58 dBFS），保护清擦音与轻声尾助词
    bounds_55 = _idx_to_sec_bounds(_find_idx_bounds(TRIM_SILENCE_DB))
    bounds_58 = _idx_to_sec_bounds(_find_idx_bounds(SHORT_DEAD_SILENCE_DB))
    bounds = bounds_55 or bounds_58
    if bounds is None:
        speech_start, speech_end = 0.0, 0.0
    else:
        speech_start, speech_end = bounds

    dead58_end = bounds_58[1] if bounds_58 is not None else speech_end

    # 句中连续静音断档检测（首尾 >= -46dB 非静音区间内部的 < -46dB 连续静音段）
    idx_46 = _find_idx_bounds(INTERNAL_SILENCE_DB)
    internal_max_silence = 0.0
    if idx_46 is not None:
        first_46, last_46 = idx_46
        cur_sil_wins = 0
        max_sil_wins = 0
        for w_i in range(first_46 + 1, last_46):
            if win_dbfs[w_i] < INTERNAL_SILENCE_DB:
                cur_sil_wins += 1
                if cur_sil_wins > max_sil_wins:
                    max_sil_wins = cur_sil_wins
            else:
                cur_sil_wins = 0
        internal_max_silence = round(max_sil_wins * 0.010, 3)

    active_dur = max(0.0, speech_end - speech_start)
    is_silent = (rms_dbfs < -45.0) or (peak_dbfs < -32.0) or (active_dur < 0.12)
    is_clipped = (clip_ratio > 0.005) or (max_clip_run >= 24)

    return {
        "raw_duration": round(raw_dur, 3),
        "active_duration": round(active_dur, 3),
        "speech_start": round(speech_start, 3),
        "speech_end": round(speech_end, 3),
        "dead58_end": round(dead58_end, 3),
        "internal_max_silence": internal_max_silence,
        "rms_dbfs": round(rms_dbfs, 2),
        "peak_dbfs": round(peak_dbfs, 2),
        "clip_ratio": round(clip_ratio, 6),
        "max_clip_run": max_clip_run,
        "is_silent": is_silent,
        "is_clipped": is_clipped,
    }


def check_layer1_duration(
    text_for_rate: str,
    pcm_metrics: dict[str, Any],
) -> tuple[bool, list[str], float]:
    """
    第一层质检：日语语速与时长合理性校验（基准 4.5–8.0 字/秒，兼容短战吼与慢情绪独白）。
    返回 (是否通过硬门禁, 问题/警告列表, 实际估算字/秒)。
    """
    spoken_chars, punct_groups, tag_count = count_spoken_units(text_for_rate)
    active = pcm_metrics["active_duration"]
    raw = pcm_metrics["raw_duration"]
    reasons: list[str] = []

    if active <= 0.05:
        return False, ["无有效语音段 (active_duration<=0.05s)"], 0.0

    cps = round(spoken_chars / active, 2) if active > 0 else 0.0

    # 短促战斗呐喊/感叹词（<= 4 字）放宽至 [0.25s, 4.2s]
    if spoken_chars <= 4:
        min_dur = 0.25
        max_dur = 4.2 + tag_count * 1.0
    else:
        # 正常日语台词：4.5–8.0 字/秒为核心带；硬门禁容差 [2.0, 12.0] 字/秒防止误杀慢台词
        min_dur = max(0.45, spoken_chars / 12.0)
        max_dur = max(4.5, spoken_chars / 2.0 + punct_groups * 0.45 + tag_count * 1.1 + 2.5)

    passed = True
    if active < min_dur:
        passed = False
        reasons.append(f"疑似吞字/截断: active={active:.2f}s < min={min_dur:.2f}s ({cps:.1f}字/s)")
    elif active > max_dur:
        passed = False
        reasons.append(f"疑似拖音/幻觉: active={active:.2f}s > max={max_dur:.2f}s ({cps:.1f}字/s)")

    if raw > 48.0:
        passed = False
        reasons.append(f"原始时长异常超长: raw={raw:.2f}s")

    # 尾部死寂拦截（若尾部无效拖尾 > 3.5s 且占全长 > 55%）
    trailing_silence = max(0.0, raw - pcm_metrics["speech_end"])
    if trailing_silence > 3.5 and raw > 0 and (trailing_silence / raw) > 0.55:
        passed = False
        reasons.append(f"尾部死寂过长: tail={trailing_silence:.2f}s / raw={raw:.2f}s")

    return passed, reasons, cps


def trim_and_loudnorm_to_mp3(
    clean_wav: Path,
    pcm_metrics: dict[str, Any],
    out_mp3: Path,
    tmp_dir: Path,
) -> float:
    """
    第四层后处理：
    1. 极保守静音修剪（`-55dB` 门限）：
       - 首部保留 `100ms` 保护缓冲（绝不误切清擦音 `s/k/t/h`）；
       - 尾部保留 `240ms` 保护缓冲（绝不误切轻声尾助词 `だ/よ/な/ね/る/か？`）；
       - 原始时长 `< 3.2s` 的短语音不裁切句尾（仅裁掉末尾超过 `0.6s` 的纯 `-58dB` 死寂），100% 保住最后一个假名；
       - 先补齐首尾缓冲再在缓冲最外缘施加 `8ms`/`15ms` 微淡入淡出防爆音，绝不衰减有效语音采样；
    2. 双遍 EBU R128 `loudnorm` 至 `-16 LUFS / -1.5 dBTP / LRA=7`，
       显式指定 `aresample=44100` 与 `-ar 44100 -ac 1` 避开 FFmpeg loudnorm 192 kHz 采样坑；
    3. 编码为 `MP3 64 kbps mono` 并原子落盘。
    返回最终成品时长（秒）。
    """
    raw_dur = pcm_metrics["raw_duration"]
    s_start = pcm_metrics["speech_start"]
    s_end = pcm_metrics["speech_end"]
    dead58_end = float(pcm_metrics.get("dead58_end", s_end))

    # 首部保护缓冲 100ms（若原音频前部余量不足 100ms，则补齐静音防擦音/爆破音硬切）
    trim_start = max(0.0, s_start - TRIM_PAD_HEAD_SEC)
    pad_head_ms = max(0, int(round((TRIM_PAD_HEAD_SEC - (s_start - trim_start)) * 1000)))

    # 尾部修剪：< 3.2s 短句不裁切句尾（仅裁掉末尾 > 0.6s 的纯 -58dB 死寂）；>= 3.2s 保留 240ms 保护缓冲
    if raw_dur < SHORT_NO_TAIL_TRIM_MAX_RAW_SEC:
        trailing_dead_58 = max(0.0, raw_dur - dead58_end)
        if trailing_dead_58 > SHORT_DEAD_TAIL_KEEP_SEC:
            trim_end = min(raw_dur, dead58_end + SHORT_DEAD_TAIL_KEEP_SEC)
            pad_tail_sec = 0.0
        else:
            trim_end = raw_dur
            pad_tail_sec = max(0.0, TRIM_PAD_TAIL_SEC - max(0.0, raw_dur - s_end))
    else:
        trim_end = min(raw_dur, s_end + TRIM_PAD_TAIL_SEC)
        pad_tail_sec = max(0.0, TRIM_PAD_TAIL_SEC - (trim_end - s_end))

    if trim_end <= trim_start + 0.05:
        trim_start, trim_end = 0.0, raw_dur
        pad_head_ms, pad_tail_sec = 0, 0.0

    trimmed_wav = tmp_dir / "trimmed.wav"
    trim_filters = [f"atrim=start={trim_start:.4f}:end={trim_end:.4f}", "asetpts=PTS-STARTPTS"]
    if pad_head_ms > 0:
        trim_filters.append(f"adelay={pad_head_ms}:all=1")
    applied_pad_tail = pad_tail_sec if pad_tail_sec > 0.005 else 0.0
    if applied_pad_tail > 0.0:
        trim_filters.append(f"apad=pad_dur={applied_pad_tail:.4f}")

    total_padded_dur = max(0.05, (trim_end - trim_start) + (pad_head_ms / 1000.0) + applied_pad_tail)
    if total_padded_dur > 0.08:
        fade_out_st = max(0.0, total_padded_dur - 0.015)
        trim_filters.append("afade=t=in:st=0:d=0.008")
        trim_filters.append(f"afade=t=out:st={fade_out_st:.4f}:d=0.015")

    cmd_trim = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(clean_wav),
        "-af",
        ",".join(trim_filters),
        "-ar",
        "44100",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(trimmed_wav),
    ]
    p_trim = subprocess.run(cmd_trim, capture_output=True, text=True)
    if p_trim.returncode != 0 or not trimmed_wav.is_file():
        raise RuntimeError(f"FFmpeg 静音修剪失败: {p_trim.stderr.strip()}")

    with wave.open(str(trimmed_wav), "rb") as wf:
        final_dur = wf.getnframes() / float(max(1, wf.getframerate()))

    # Pass 1: EBU R128 响度测量
    cmd_p1 = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-i",
        str(trimmed_wav),
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json",
        "-f",
        "null",
        "-",
    ]
    p1 = subprocess.run(cmd_p1, capture_output=True, text=True)
    measured: dict[str, str] | None = None
    if p1.returncode == 0:
        m = re.search(r"\{\s*\"input_i\"[\s\S]*?\}", p1.stderr)
        if m:
            try:
                parsed = json.loads(m.group(0))
                # 极短语音（<1s）有时返回 -inf，需回退单遍动态模式
                vals = [
                    parsed.get("input_i", ""),
                    parsed.get("input_tp", ""),
                    parsed.get("input_lra", ""),
                    parsed.get("input_thresh", ""),
                    parsed.get("target_offset", ""),
                ]
                if all(v not in ("", "-inf", "inf", "nan", "-nan") for v in vals):
                    measured = {k: str(v) for k, v in parsed.items()}
            except Exception:
                measured = None

    # Pass 2: 线性双遍 loudnorm + 强制 aresample=44100 + -ar 44100 -ac 1 -> MP3 64kbps mono
    if measured is not None:
        ln_filter = (
            f"loudnorm=I=-16:TP=-1.5:LRA=7:"
            f"measured_I={measured['input_i']}:"
            f"measured_TP={measured['input_tp']}:"
            f"measured_LRA={measured['input_lra']}:"
            f"measured_thresh={measured['input_thresh']}:"
            f"offset={measured['target_offset']}:"
            f"linear=true:print_format=summary,aresample=44100"
        )
    else:
        ln_filter = "loudnorm=I=-16:TP=-1.5:LRA=7:linear=false,aresample=44100"

    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    tmp_mp3 = out_mp3.with_suffix(".tmp.mp3")
    cmd_p2 = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(trimmed_wav),
        "-af",
        ln_filter,
        "-ar",
        "44100",
        "-ac",
        "1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "64k",
        "-write_xing",
        "1",
        str(tmp_mp3),
    ]
    p2 = subprocess.run(cmd_p2, capture_output=True, text=True)
    if p2.returncode != 0 or not tmp_mp3.is_file() or tmp_mp3.stat().st_size < 512:
        tmp_mp3.unlink(missing_ok=True)
        raise RuntimeError(f"FFmpeg 双遍 loudnorm / MP3 编码失败: {p2.stderr.strip()}")

    os.replace(tmp_mp3, out_mp3)
    return round(final_dur, 3)


def synthesize_one_line(
    line: dict[str, Any],
    profile_info: dict[str, Any],
    args: argparse.Namespace,
    effective_model_id: str,
    asr_qc: AnimeWhisperQC | None,
) -> dict[str, Any]:
    """
    合成单句语音并执行四层自动质检 + 最多 --max-retries 次自动重抽：
    优先采用 passed==True 候选；若均未完全达标，严格优先选无 `internal_silence_gap`、
    无 `asr_hallucination_extra` 且综合 `(len(issues), cer)` 最小的最优轨。
    """
    voice_id = line["voiceId"]
    profile_id = line["profileId"]
    sanitized_text, adjusted, adjust_note = sanitize_drama3_input(line["drama3_input"])
    if not sanitized_text:
        raise RuntimeError("drama3_input 与 jp_text 均为空")

    out_mp3 = args.out_dir / line["audioRelPath"]
    total_attempts = 1 + max(0, int(args.max_retries))

    local_refs: list[dict[str, str]] = []
    fish_ref_ids: list[str] = []
    if args.backend == "sglang":
        local_refs = resolve_local_references(profile_info, max_clips=args.max_ref_clips)
        if not local_refs:
            raise RuntimeError(f"声线 `{profile_id}` 缺少有效的本地 44.1kHz 参考 WAV")
    else:
        for mid in [profile_info.get("fishModelId"), profile_info.get("primaryModelId")] + list(
            profile_info.get("backupModelIds") or []
        ):
            if mid and str(mid) not in fish_ref_ids:
                fish_ref_ids.append(str(mid))
        if not fish_ref_ids:
            raise RuntimeError(f"声线 `{profile_id}` 缺少有效的 Fish Audio reference_id")

    best_candidate: dict[str, Any] | None = None
    attempt_logs: list[dict[str, Any]] = []
    need_trunc_token_bump = 0

    with tempfile.TemporaryDirectory(prefix=f"tts_{voice_id}_") as tmp_root_str:
        tmp_root = Path(tmp_root_str)

        for attempt_idx in range(total_attempts):
            attempt_dir = tmp_root / f"try_{attempt_idx}"
            attempt_dir.mkdir(parents=True, exist_ok=True)
            raw_file = attempt_dir / "raw.wav"
            clean_wav = attempt_dir / "clean.wav"

            # 重抽时微调温度以跳出不良采样轨迹；仅当上一轮出现吞字/截断时按需小幅放宽 token（防幻觉暴涨）
            retry_temp = max(0.75, args.temperature - attempt_idx * 0.06)
            max_tokens = compute_max_new_tokens(sanitized_text, retry_bump=need_trunc_token_bump)

            try:
                t0 = time.monotonic()
                if args.backend == "sglang":
                    payload = build_sglang_payload(
                        text=sanitized_text,
                        references=local_refs,
                        temperature=retry_temp,
                        top_p=args.top_p,
                        max_new_tokens=max_tokens,
                    )
                    audio_bytes = call_sglang_tts(args.sglang_url, payload, timeout=args.timeout)
                    used_ref = profile_info.get("source", "local")
                else:
                    audio_bytes, used_ref = call_fish_cloud_tts(
                        api_key=args.fish_api_key,
                        fish_model=args.fish_api_model,
                        reference_ids=fish_ref_ids,
                        text=sanitized_text,
                        temperature=retry_temp,
                        top_p=args.top_p,
                        max_new_tokens=max_tokens,
                        timeout=args.timeout,
                    )
                gen_sec = round(time.monotonic() - t0, 2)

                finalize_raw_to_pcm_wav(audio_bytes, raw_file, clean_wav)
                pcm = analyze_pcm_wav_and_speech_bounds(clean_wav)

                # 第 1 + 2 层质检（含句中异常死寂断档硬门禁 internal_max_silence > 1.35s @ <-46dB）
                ref_jp_text = line["jp_text"] or sanitized_text
                dur_ok, dur_issues, cps = check_layer1_duration(ref_jp_text, pcm)
                hard_issues = list(dur_issues)
                has_internal_gap = float(pcm.get("internal_max_silence", 0.0)) > INTERNAL_MAX_SILENCE_LIMIT_SEC
                if has_internal_gap:
                    hard_issues.append("internal_silence_gap")
                if pcm["is_silent"]:
                    hard_issues.append(
                        f"无声/极低音量 (rms={pcm['rms_dbfs']}dB, peak={pcm['peak_dbfs']}dB)"
                    )
                if pcm["is_clipped"]:
                    hard_issues.append(
                        f"削波失真 (clip={pcm['clip_ratio']:.4f}, run={pcm['max_clip_run']})"
                    )

                # 第 3 层质检：全句长（含 1–5 字短句）anime-whisper 反向转写 + CER + 幻觉暴涨 + 首尾吞字守护
                asr_text: str | None = None
                cer: float | None = None
                asr_ok = True
                if asr_qc is not None and not pcm["is_silent"]:
                    asr_detail = asr_qc.evaluate_detailed(clean_wav, ref_jp_text, pcm)
                    asr_text = asr_detail["hyp"]
                    cer = asr_detail["cer"]
                    if cer > args.asr_cer_threshold:
                        asr_ok = False
                        hard_issues.append(
                            f"ASR Kana CER 偏高 ({cer * 100:.1f}% > {args.asr_cer_threshold * 100:.0f}%)"
                        )
                    for extra_iss in asr_detail["extra_issues"]:
                        asr_ok = False
                        if extra_iss not in hard_issues:
                            hard_issues.append(extra_iss)

                if any("吞字/截断" in x or x == "asr_tail_truncated" for x in hard_issues) and (
                    "asr_hallucination_extra" not in hard_issues
                ):
                    need_trunc_token_bump += 32

                all_passed = (
                    dur_ok
                    and (not has_internal_gap)
                    and (not pcm["is_silent"])
                    and (not pcm["is_clipped"])
                    and asr_ok
                )

                has_silence_gap = "internal_silence_gap" in hard_issues
                has_hallucination = "asr_hallucination_extra" in hard_issues
                has_tail_trunc = "asr_tail_truncated" in hard_issues

                # 多次 retry 择优排序键（越小越优）：
                # 1. passed == True 最优先；
                # 2. 若均未完全达标，严格优先选无 internal_silence_gap、无 asr_hallucination_extra、无死寂/削波，
                #    且综合 (len(issues), cer) 最小的一轨！
                rank_key = (
                    0 if all_passed else 1,
                    1 if pcm["is_silent"] else 0,
                    1 if has_silence_gap else 0,
                    1 if has_hallucination else 0,
                    1 if pcm["is_clipped"] else 0,
                    len(hard_issues),
                    cer if cer is not None else 0.0,
                    1 if has_tail_trunc else 0,
                    abs(cps - 6.0),
                )

                cand = {
                    "attempt": attempt_idx + 1,
                    "clean_wav": clean_wav,
                    "attempt_dir": attempt_dir,
                    "pcm": pcm,
                    "cps": cps,
                    "asr_text": asr_text,
                    "cer": cer,
                    "all_passed": all_passed,
                    "issues": hard_issues,
                    "rank_key": rank_key,
                    "gen_sec": gen_sec,
                    "max_new_tokens": max_tokens,
                    "used_ref": used_ref,
                }
                attempt_logs.append(
                    {
                        "attempt": attempt_idx + 1,
                        "passed": all_passed,
                        "active_sec": pcm["active_duration"],
                        "internal_max_silence_sec": pcm["internal_max_silence"],
                        "cps": cps,
                        "cer": cer,
                        "issues": hard_issues,
                    }
                )

                if best_candidate is None or cand["rank_key"] < best_candidate["rank_key"]:
                    best_candidate = cand

                if all_passed:
                    break
            except Exception as exc:
                attempt_logs.append({"attempt": attempt_idx + 1, "passed": False, "error": str(exc)})
                if attempt_idx + 1 >= total_attempts and best_candidate is None:
                    raise

        if best_candidate is None or best_candidate["pcm"]["is_silent"]:
            raise RuntimeError(
                f"连续 {total_attempts} 次合成均失败或无声: {attempt_logs[-1] if attempt_logs else 'unknown'}"
            )

        # 第 4 层后处理：对最优（最低 CER / 最佳 QC）候选执行静音修剪 + 双遍 loudnorm + MP3 64kbps 落盘
        final_dur = trim_and_loudnorm_to_mp3(
            clean_wav=best_candidate["clean_wav"],
            pcm_metrics=best_candidate["pcm"],
            out_mp3=out_mp3,
            tmp_dir=best_candidate["attempt_dir"],
        )
        file_bytes = out_mp3.stat().st_size

    return {
        "voiceId": voice_id,
        "profileId": profile_id,
        "charId": line["charId"],
        "sceneId": line["sceneId"],
        "tier": line["tier"],
        "audioRelPath": line["audioRelPath"],
        "status": "ok",
        "qaPassed": bool(best_candidate["all_passed"]),
        "attempts": len(attempt_logs),
        "selectedAttempt": best_candidate["attempt"],
        "durationSec": final_dur,
        "activeSec": best_candidate["pcm"]["active_duration"],
        "internalMaxSilenceSec": best_candidate["pcm"]["internal_max_silence"],
        "charsPerSec": best_candidate["cps"],
        "rmsDbfs": best_candidate["pcm"]["rms_dbfs"],
        "peakDbfs": best_candidate["pcm"]["peak_dbfs"],
        "cer": best_candidate["cer"],
        "asrText": best_candidate["asr_text"],
        "zhText": line["zh_text"],
        "jpText": line["jp_text"],
        "sanitizedInput": sanitized_text,
        "leadingTagAdjusted": adjusted,
        "leadingTagNote": adjust_note,
        "maxNewTokens": best_candidate["max_new_tokens"],
        "genSec": best_candidate["gen_sec"],
        "fileBytes": file_bytes,
        "issues": best_candidate["issues"],
        "attemptLogs": attempt_logs,
        "modelId": effective_model_id,
        "backend": args.backend,
    }


def load_cache(cache_path: Path) -> dict[str, Any]:
    if not cache_path.is_file():
        return {}
    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_cache_atomic(cache_path: Path, cache_data: dict[str, Any]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = cache_path.with_suffix(cache_path.suffix + ".tmp")
    tmp.write_text(json.dumps(cache_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, cache_path)


def compute_total_pack_bytes(out_dir: Path) -> int:
    if not out_dir.exists():
        return 0
    return sum(p.stat().st_size for p in out_dir.rglob("*.mp3") if p.is_file())


def run_build_manifest(manifest_script: Path) -> tuple[bool, str]:
    if not manifest_script.is_file():
        return False, f"跳过 manifest 构建：未找到 `{manifest_script}`"
    node_bin = shutil.which("node")
    if not node_bin:
        return False, "跳过 manifest 构建：系统未安装 `node`"
    proc = subprocess.run([node_bin, str(manifest_script)], capture_output=True, text=True)
    if proc.returncode != 0:
        return False, f"build_manifest.mjs 执行失败 (exit={proc.returncode}): {proc.stderr.strip()}"
    out = (proc.stdout or "").strip()
    return True, out or "build_manifest.mjs 执行成功"


def parse_only_ids(raw: str) -> set[str]:
    if not raw or not raw.strip():
        return set()
    val = raw.strip()
    if val.startswith("@"):
        p = Path(val[1:])
        if not p.is_file():
            raise FileNotFoundError(f"--only-ids 清单文件不存在: {p}")
        return {
            ln.strip()
            for ln in p.read_text(encoding="utf-8").splitlines()
            if ln.strip() and not ln.strip().startswith("#")
        }
    return {x.strip() for x in re.split(r"[,\s]+", val) if x.strip()}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fish Audio Drama 3 / Cloud API 日语配音批产 + 四层质检 + 响度归一化流水线"
    )
    parser.add_argument(
        "--script",
        type=Path,
        default=Path("tools/voice/script_jp_master.json"),
        help="日文总台本 JSON 路径（默认 tools/voice/script_jp_master.json）",
    )
    parser.add_argument(
        "--refs",
        type=Path,
        default=Path("tools/voice/refs_resolved.json"),
        help="参考音清单 JSON 路径（默认 tools/voice/refs_resolved.json）",
    )
    parser.add_argument(
        "--casting",
        type=Path,
        default=Path("tools/voice/casting_fish_audio.json"),
        help="选角表路径（fish_api 模式下免拉参考音兜底来源）",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("assets/voice"),
        help="成品 MP3 根目录（默认 assets/voice）",
    )
    parser.add_argument(
        "--cache-file",
        type=Path,
        default=Path("tools/voice/.synth_cache.json"),
        help="SHA-256 断点续传缓存文件（默认 tools/voice/.synth_cache.json）",
    )
    parser.add_argument(
        "--qa-report",
        type=Path,
        default=Path("tools/voice/qa_report.json"),
        help="质检汇总报告输出路径（默认 tools/voice/qa_report.json）",
    )
    parser.add_argument(
        "--backend",
        choices=["sglang", "fish_api"],
        default="sglang",
        help="推理后端：sglang (本地 Drama 3) 或 fish_api (Fish Audio Cloud API)",
    )
    parser.add_argument(
        "--sglang-url",
        type=str,
        default="http://127.0.0.1:8000/v1/audio/speech",
        help="SGLang-Omni /v1/audio/speech 地址",
    )
    parser.add_argument(
        "--model-id",
        type=str,
        default="",
        help="写入 SHA-256 缓存键的模型标识（如 fishaudio/drama-3、fishaudio/drama-3-int4、Aratako/Drama-3-Japanese）",
    )
    parser.add_argument(
        "--fish-api-model",
        choices=["drama-3", "s2.1-pro-free", "s2.1-pro", "s2-pro"],
        default="drama-3",
        help="Fish Audio Cloud API 模型头（支持 drama-3 或 $0 免费 s2.1-pro-free）",
    )
    parser.add_argument(
        "--fish-api-key",
        type=str,
        default=os.environ.get("FISH_API_KEY", ""),
        help="Fish Audio API Key（默认读环境变量 FISH_API_KEY）",
    )
    parser.add_argument(
        "--scope",
        choices=["audition", "p1", "main", "all"],
        default="audition",
        help="生产范围：audition (~50) / p1 (~380) / main (~965) / all (~1,330)",
    )
    parser.add_argument(
        "--only-ids",
        type=str,
        default="",
        help="精准单句重抽：逗号分隔 voiceId 或 @ids.txt 文件路径（优先于 --scope）",
    )
    parser.add_argument(
        "--only-profiles",
        type=str,
        default="",
        help="仅合成指定 profileId（逗号分隔）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="忽略 SHA-256 缓存，强制重新合成选中条目",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=1.0,
        help="采样 temperature（Drama 3 默认 1.0；严禁 top_k / seed）",
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=0.9,
        help="采样 top_p（Drama 3 默认 0.9）",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="质检/ASR CER 超标时的最大自动重抽次数（默认 3，保留最低 CER 版本）",
    )
    parser.add_argument(
        "--asr-qc",
        action="store_true",
        help="启用第 3 层质检：同卡 litagin/anime-whisper 反向转写 + Kana CER（严禁 initial_prompt）",
    )
    parser.add_argument(
        "--asr-cer-threshold",
        type=float,
        default=0.18,
        help="Kana CER 自动重抽阈值（默认 0.18 即 18%%）",
    )
    parser.add_argument(
        "--asr-device",
        type=str,
        default="auto",
        help="ASR 质检设备（auto / cuda / cpu，默认 auto）",
    )
    parser.add_argument(
        "--max-ref-clips",
        type=int,
        default=2,
        help="每次 sglang 请求附带的参考切片上限（默认 2；A100 40GB 可设为 1）",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="并发合成线程数（默认 1 稳妥防 OOM；H100/A100-80G 可设 2-4）",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=180.0,
        help="单句合成 HTTP 超时秒数（默认 180）",
    )
    parser.add_argument(
        "--manifest-script",
        type=Path,
        default=Path("tools/voice/build_manifest.mjs"),
        help="批产结束后自动执行的 manifest 构建脚本",
    )
    parser.add_argument(
        "--skip-manifest",
        action="store_true",
        help="跳过自动调用 node tools/voice/build_manifest.mjs",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="演练模式：统计命中条目、缓存跳过数、动态 token 与首标签防护，不发 TTS 请求",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if not args.script.is_file():
        print(f"[ERROR] 找不到日文总台本文件: {args.script}", file=sys.stderr)
        return 2

    all_lines = load_script_lines(args.script)
    if not all_lines:
        print(f"[ERROR] 台本 {args.script} 中无任何台词条目", file=sys.stderr)
        return 2

    only_ids = parse_only_ids(args.only_ids)
    only_profiles = {x.strip() for x in args.only_profiles.split(",") if x.strip()}
    selected = select_lines_by_scope(all_lines, args.scope, only_ids, only_profiles)
    if not selected:
        print("[WARN] 当前筛选条件下没有可合成的台词条目。", file=sys.stderr)
        return 0

    effective_model_id = args.model_id.strip() or (
        args.fish_api_model if args.backend == "fish_api" else "fishaudio/drama-3"
    )
    registry = load_profile_registry(args.refs, args.casting, args.backend)
    cache = load_cache(args.cache_file)

    # 预计算缓存命中与缺失声线
    to_run: list[tuple[dict[str, Any], dict[str, Any], str]] = []
    skipped_records: list[dict[str, Any]] = []
    missing_profiles: set[str] = set()

    for ln in selected:
        pid = ln["profileId"]
        pinfo = registry.get(pid)
        if not pinfo:
            missing_profiles.add(pid)
            continue

        sanitized_text, _, _ = sanitize_drama3_input(ln["drama3_input"])
        ref_hash = str(pinfo.get("refHash") or pinfo.get("fishModelId") or pid)
        ckey = compute_cache_key(sanitized_text, ref_hash, args.backend, effective_model_id)
        out_mp3 = args.out_dir / ln["audioRelPath"]

        cached = cache.get(ln["voiceId"])
        if (
            not args.force
            and isinstance(cached, dict)
            and cached.get("cacheKey") == ckey
            and out_mp3.is_file()
            and out_mp3.stat().st_size >= 1024
        ):
            rec = dict(cached)
            rec["status"] = "cached"
            rec["fileBytes"] = out_mp3.stat().st_size
            skipped_records.append(rec)
            continue

        to_run.append((ln, pinfo, ckey))

    if missing_profiles:
        print(
            f"[WARN] 以下 {len(missing_profiles)} 个 profileId 未在参考音/选角表中找到，将跳过: "
            f"{', '.join(sorted(missing_profiles))}",
            file=sys.stderr,
        )

    print(
        f"[PLAN] backend={args.backend} | model={effective_model_id} | scope={args.scope} | "
        f"选中={len(selected)} | SHA256缓存跳过={len(skipped_records)} | 待合成={len(to_run)} | "
        f"asr_qc={args.asr_qc} | max_retries={args.max_retries}",
        flush=True,
    )

    if args.dry_run:
        adjusted_cnt = 0
        for ln, _, _ in to_run[:20]:
            stxt, adj, note = sanitize_drama3_input(ln["drama3_input"])
            if adj:
                adjusted_cnt += 1
            toks = compute_max_new_tokens(stxt)
            print(
                f"  [DRY] {ln['voiceId']:22s} | {ln['profileId']:16s} | tokens={toks:4d} | "
                f"adj={note or '-':20s} | {stxt[:42]}"
            )
        print(f"[DRY-RUN] 预览完成（前 20 条中首标签防护触发 {adjusted_cnt} 次）。")
        return 0

    if to_run:
        ensure_ffmpeg()
        if args.backend == "sglang":
            health_msg = check_sglang_health(args.sglang_url)
            print(f"[OK] SGLang-Omni 健康检查通过: {health_msg}", flush=True)
        elif not args.fish_api_key:
            print("[ERROR] 使用 `--backend fish_api` 时请设置环境变量 FISH_API_KEY。", file=sys.stderr)
            return 2

    asr_qc = AnimeWhisperQC(device=args.asr_device) if (args.asr_qc and to_run) else None

    results: list[dict[str, Any]] = list(skipped_records)
    failed_lines: list[dict[str, Any]] = []
    cache_lock = threading.Lock()
    progress_done = 0
    total_todo = len(to_run)
    t_batch_start = time.monotonic()

    def _worker(item: tuple[dict[str, Any], dict[str, Any], str]) -> tuple[str, dict[str, Any]]:
        ln, pinfo, ckey = item
        try:
            res = synthesize_one_line(ln, pinfo, args, effective_model_id, asr_qc)
            res["cacheKey"] = ckey
            res["updatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
            return "ok", res
        except Exception as exc:
            return "fail", {
                "voiceId": ln["voiceId"],
                "profileId": ln["profileId"],
                "sceneId": ln["sceneId"],
                "audioRelPath": ln["audioRelPath"],
                "zhText": ln["zh_text"],
                "jpText": ln["jp_text"],
                "status": "failed",
                "error": str(exc),
            }

    concurrency = max(1, int(args.concurrency))
    try:
        if concurrency == 1:
            for item in to_run:
                status_tag, rec = _worker(item)
                progress_done += 1
                if status_tag == "ok":
                    results.append(rec)
                    cache[rec["voiceId"]] = rec
                    save_cache_atomic(args.cache_file, cache)
                    cer_s = f"CER={rec['cer'] * 100:.1f}%" if rec.get("cer") is not None else "CER=off"
                    flag = "PASS" if rec["qaPassed"] else "WARN"
                    print(
                        f"[{progress_done:04d}/{total_todo:04d}] {flag} {rec['voiceId']} ({rec['profileId']}) "
                        f"| {rec['durationSec']:.2f}s | try={rec['attempts']} | {cer_s} | {rec['genSec']:.1f}s",
                        flush=True,
                    )
                else:
                    failed_lines.append(rec)
                    print(
                        f"[{progress_done:04d}/{total_todo:04d}] FAIL {rec['voiceId']} ({rec['profileId']}): {rec['error']}",
                        file=sys.stderr,
                        flush=True,
                    )
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as ex:
                fut_map = {ex.submit(_worker, item): item for item in to_run}
                for fut in concurrent.futures.as_completed(fut_map):
                    status_tag, rec = fut.result()
                    with cache_lock:
                        progress_done += 1
                        if status_tag == "ok":
                            results.append(rec)
                            cache[rec["voiceId"]] = rec
                            save_cache_atomic(args.cache_file, cache)
                            cer_s = f"CER={rec['cer'] * 100:.1f}%" if rec.get("cer") is not None else "CER=off"
                            flag = "PASS" if rec["qaPassed"] else "WARN"
                            print(
                                f"[{progress_done:04d}/{total_todo:04d}] {flag} {rec['voiceId']} ({rec['profileId']}) "
                                f"| {rec['durationSec']:.2f}s | try={rec['attempts']} | {cer_s}",
                                flush=True,
                            )
                        else:
                            failed_lines.append(rec)
                            print(
                                f"[{progress_done:04d}/{total_todo:04d}] FAIL {rec['voiceId']} ({rec['profileId']}): {rec['error']}",
                                file=sys.stderr,
                                flush=True,
                            )
    finally:
        if to_run:
            save_cache_atomic(args.cache_file, cache)

    # 汇总 QA 报告
    ok_records = [r for r in results if r.get("status") in ("ok", "cached")]
    durs = [float(r.get("durationSec", 0.0)) for r in ok_records if r.get("durationSec")]
    cers = [float(r["cer"]) for r in ok_records if r.get("cer") is not None]
    retried_list = [
        {
            "voiceId": r["voiceId"],
            "profileId": r["profileId"],
            "attempts": r.get("attempts", 1),
            "selectedAttempt": r.get("selectedAttempt", 1),
            "finalCer": r.get("cer"),
            "qaPassed": r.get("qaPassed", True),
            "issues": r.get("issues", []),
            "audioRelPath": r.get("audioRelPath", ""),
        }
        for r in ok_records
        if int(r.get("attempts", 1)) > 1
    ]

    # 高 CER 或带质检警告的复听清单
    review_threshold = min(0.12, args.asr_cer_threshold)
    high_cer_review = [
        {
            "voiceId": r["voiceId"],
            "profileId": r["profileId"],
            "sceneId": r.get("sceneId", ""),
            "cer": r.get("cer"),
            "qaPassed": r.get("qaPassed", True),
            "issues": r.get("issues", []),
            "zhText": r.get("zhText", ""),
            "jpText": r.get("jpText", ""),
            "asrText": r.get("asrText"),
            "durationSec": r.get("durationSec"),
            "audioRelPath": r.get("audioRelPath", ""),
        }
        for r in ok_records
        if (r.get("cer") is not None and float(r["cer"]) > review_threshold) or (not r.get("qaPassed", True))
    ]
    high_cer_review.sort(
        key=lambda x: (x["cer"] if x["cer"] is not None else -1.0, len(x["issues"])),
        reverse=True,
    )

    per_profile: dict[str, dict[str, Any]] = {}
    for r in ok_records:
        pid = str(r.get("profileId", "unknown"))
        slot = per_profile.setdefault(pid, {"count": 0, "totalDurationSec": 0.0, "warnings": 0})
        slot["count"] += 1
        slot["totalDurationSec"] = round(slot["totalDurationSec"] + float(r.get("durationSec", 0.0)), 3)
        if not r.get("qaPassed", True):
            slot["warnings"] += 1

    total_pack_bytes = compute_total_pack_bytes(args.out_dir)
    elapsed_sec = round(time.monotonic() - t_batch_start, 2)
    denom = max(1, len(selected) - len(missing_profiles))
    success_rate = round(100.0 * len(ok_records) / denom, 2)

    manifest_ok = False
    manifest_msg = "已按 --skip-manifest 跳过"
    if not args.skip_manifest:
        manifest_ok, manifest_msg = run_build_manifest(args.manifest_script)
        print(f"[MANIFEST] {manifest_msg}", flush=True)

    qa_report = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "backend": args.backend,
        "modelId": effective_model_id,
        "scope": args.scope,
        "onlyIds": sorted(only_ids),
        "asrQcEnabled": bool(args.asr_qc),
        "asrCerThreshold": args.asr_cer_threshold,
        "audioSpec": {
            "targetLufs": -16.0,
            "truePeakDbtp": -1.5,
            "lra": 7.0,
            "sampleRateHz": 44100,
            "channels": 1,
            "codec": "mp3",
            "bitrateKbps": 64,
            "trimSilenceDb": TRIM_SILENCE_DB,
            "trimPadHeadMs": int(round(TRIM_PAD_HEAD_SEC * 1000)),
            "trimPadTailMs": int(round(TRIM_PAD_TAIL_SEC * 1000)),
            "shortNoTailTrimUnderSec": SHORT_NO_TAIL_TRIM_MAX_RAW_SEC,
            "internalMaxSilenceLimitSec": INTERNAL_MAX_SILENCE_LIMIT_SEC,
        },
        "stats": {
            "totalSelected": len(selected),
            "succeeded": len(ok_records),
            "newlySynthesized": len(ok_records) - len(skipped_records),
            "cachedSkipped": len(skipped_records),
            "failed": len(failed_lines),
            "missingProfilesCount": len(missing_profiles),
            "successRatePct": success_rate,
            "retriedCount": len(retried_list),
            "flaggedForReviewCount": len(high_cer_review),
            "avgDurationSec": round(sum(durs) / len(durs), 3) if durs else 0.0,
            "totalDurationSec": round(sum(durs), 2),
            "avgCer": round(sum(cers) / len(cers), 4) if cers else None,
            "totalPackSizeMB": round(total_pack_bytes / (1024 * 1024), 3),
            "elapsedSec": elapsed_sec,
        },
        "manifestBuild": {"ok": manifest_ok, "message": manifest_msg},
        "perProfileStats": per_profile,
        "retriedLines": retried_list,
        "highCerReviewList": high_cer_review,
        "failedLines": failed_lines,
    }

    args.qa_report.parent.mkdir(parents=True, exist_ok=True)
    tmp_qa = args.qa_report.with_suffix(args.qa_report.suffix + ".tmp")
    tmp_qa.write_text(json.dumps(qa_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp_qa, args.qa_report)

    print(
        f"\n[SUMMARY] QA 报告已写入 {args.qa_report}\n"
        f"  成功率: {success_rate:.2f}% ({len(ok_records)}/{denom}) | 新合成: {len(ok_records) - len(skipped_records)} | "
        f"缓存跳过: {len(skipped_records)} | 失败: {len(failed_lines)}\n"
        f"  平均时长: {qa_report['stats']['avgDurationSec']:.2f}s | 重抽句数: {len(retried_list)} | "
        f"待复听高 CER/告警句: {len(high_cer_review)} | 语音包总体积: {qa_report['stats']['totalPackSizeMB']:.2f} MB"
    )
    return 0 if not failed_lines else 1


if __name__ == "__main__":
    raise SystemExit(main())
