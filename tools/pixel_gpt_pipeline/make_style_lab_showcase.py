#!/usr/bin/env python3
"""Decode all 6 zero-PNG style_lab_v2 JS pixel matrices and render:
1. A crystal-clear 6-style panoramic comparison PNG (3x2 grid: IDLE light + STRIKE dark for each style),
2. Compact 2-frame JSON dump `/tmp/style_lab_v2_compact.json` for the live Canvas inline comparison widget.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BANK_CHARS = ".abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~"
CHAR_MAP = {ch: i for i, ch in enumerate(BANK_CHARS)}

PIPE_DIR = Path(__file__).resolve().parent
JS_DIR = PIPE_DIR / "out_js" / "style_lab_v2"
BRAIN_DIR = Path("/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/7aebff23-f78e-4d65-b77f-f1115593fd3d")
OUT_PNG = BRAIN_DIR / "qa_pixel_combat" / "gpt_sylvia_6styles_compare.png"
OUT_JSON = Path("/tmp/style_lab_v2_compact.json")

STYLE_ORDER = [
    ("a_hd_bighead",      "A · 本案高精大头（冷淡本尊）",      "2.1头身 · 140×138 @ 2×", 2, (37, 99, 235)),
    ("b_worldflipper_hd", "B · 弹射世界 / 冒险岛（顶流软萌）", "1.9头身 · 142×140 @ 2×", 2, (124, 58, 237)),
    ("c_octopath_hd",     "C · 八方旅人 × 水浒传2（古典HD）",  "2.2头身 · 136×132 @ 2×", 2, (79, 70, 229)),
    ("d_octopath_64",     "D · 八方旅人正宗（16-bit点眼）",    "2.0头身 · 70×66 @ 3×",   3, (14, 116, 144)),
    ("e_seaofstars_64",   "E · 星之海 / 火纹（高彩锐利）",     "2.1头身 · 120×118 @ 2×", 2, (2, 132, 199)),
    ("f_guardian_80",     "F · 坎公骑冠剑（Q版萌系中颗粒）",   "2.0头身 · 96×92 @ 3×",   3, (147, 51, 234)),
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ):
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def parse_js_bank(js_path: Path) -> dict:
    txt = js_path.read_text(encoding="utf-8")
    m = re.search(r"PIXEL_SPRITE_BANK\[[^\]]+\]\s*=\s*(\{.*\});", txt, re.S)
    if not m:
        raise ValueError(f"Cannot parse PIXEL_SPRITE_BANK in {js_path}")
    return json.loads(m.group(1))


def decode_frame(data: dict, frame_idx: int) -> Image.Image:
    w, h = data["w"], data["h"]
    pal = data["palette"]
    rgba_pal = [(0, 0, 0, 0)]
    for hx in pal[1:]:
        n = int(hx[1:], 16)
        rgba_pal.append(((n >> 16) & 255, (n >> 8) & 255, n & 255, 255))

    rows = data["frames"][frame_idx]
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        row = rows[y]
        x = 0
        i = 0
        n = len(row)
        while i < n and x < w:
            ci = CHAR_MAP.get(row[i], 0)
            i += 1
            cnt = 1
            if i < n and row[i] == "*":
                i += 1
                num = 0
                while i < n and "0" <= row[i] <= "9":
                    num = num * 10 + (ord(row[i]) - 48)
                    i += 1
                cnt = num or 1
            col = rgba_pal[ci]
            end = min(w, x + cnt)
            for k in range(x, end):
                px[k, y] = col
            x = end
    return im


def make_checker(w: int, h: int, dark: bool, tile: int = 12) -> Image.Image:
    c1 = (26, 32, 51) if dark else (242, 246, 253)
    c2 = (35, 43, 68) if dark else (228, 236, 248)
    im = Image.new("RGB", (w, h), c1)
    d = ImageDraw.Draw(im)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            if ((x // tile) + (y // tile)) & 1:
                d.rectangle([x, y, x + tile - 1, y + tile - 1], fill=c2)
    return im


def main() -> None:
    cols, rows_n = 2, 3
    box_w, box_h = 296, 306
    card_w = box_w * 2 + 28
    card_h = box_h + 78
    pad_x, pad_y = 26, 22
    header_h = 84
    W = pad_x * 2 + card_w * cols + 24
    H = header_h + pad_y + card_h * rows_n + 20 * (rows_n - 1) + 24

    canvas = Image.new("RGB", (W, H), (248, 250, 254))
    draw = ImageDraw.Draw(canvas)
    f_title = load_font(22)
    f_sub = load_font(13)
    f_card = load_font(15)
    f_meta = load_font(12)

    draw.text((pad_x, 18), "希尔维亚（无剑 · 纯水冰魔导师）6 大商业像素流派真像素对比（零 PNG）", fill=(20, 28, 52), font=f_title)
    draw.text((pad_x, 50), "全部 12 张均由 GPT (chatgpt-2) 生图后逐像素反采样为纯 JS 像素矩阵，本图 100% 由 JS 矩阵反解码绘制（上排高精 128 档 · 下排大颗粒/经典档）", fill=(78, 92, 122), font=f_sub)
    draw.line([(pad_x, 74), (W - pad_x, 74)], fill=(205, 218, 238), width=2)

    compact: dict[str, dict] = {}

    for idx, (sid, title, spec_txt, scale, accent) in enumerate(STYLE_ORDER):
        js_path = JS_DIR / f"{sid}.js"
        data = parse_js_bank(js_path)
        sz_kb = js_path.stat().st_size / 1024.0
        n_col = len(data["palette"]) - 1

        idle_im = decode_frame(data, 0)
        strike_im = decode_frame(data, 4)

        compact[sid] = {
            "title": title,
            "spec": spec_txt,
            "scale": scale,
            "kb": round(sz_kb, 1),
            "w": data["w"],
            "h": data["h"],
            "p": data["palette"],
            "f": [data["frames"][0], data["frames"][4]],
        }

        col = idx % cols
        row = idx // cols
        cx = pad_x + col * (card_w + 24)
        cy = header_h + pad_y + row * (card_h + 20)

        draw.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=8, fill=(255, 255, 255), outline=accent, width=2)
        draw.text((cx + 12, cy + 10), f"{title}   |   {spec_txt}", fill=(22, 30, 54), font=f_card)

        for fi, (im_fr, is_dark, tag) in enumerate(((idle_im, False, f"IDLE 待机 ({scale}× 浅底)"), (strike_im, True, f"STRIKE 冰晶施法 ({scale}× 深底)"))):
            bx = cx + 10 + fi * (box_w + 8)
            by = cy + 38
            chk = make_checker(box_w, box_h, dark=is_dark)
            up = im_fr.resize((im_fr.width * scale, im_fr.height * scale), Image.Resampling.NEAREST)
            # Align bottom-center cleanly inside box
            px0 = (box_w - up.width) // 2
            py0 = box_h - up.height - 4
            chk.paste(up, (px0, py0), up)
            canvas.paste(chk, (bx, by))
            tag_col = (210, 224, 248) if is_dark else (65, 78, 108)
            draw.text((bx + 8, by + 6), tag, fill=tag_col, font=f_meta)

        draw.text(
            (cx + 12, cy + card_h - 24),
            f"纯 JS 像素矩阵（零 PNG）· 共享色板 {n_col} 色 · 0 半透明 · 6 帧全包 {sz_kb:.1f} KB · 实机 {data['w']*scale}×{data['h']*scale}px",
            fill=(74, 88, 118),
            font=f_meta,
        )

    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_PNG, "PNG")
    OUT_JSON.write_text(json.dumps(compact, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved panoramic PNG: {OUT_PNG} ({canvas.size})")
    print(f"Saved compact JSON:  {OUT_JSON} ({OUT_JSON.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
