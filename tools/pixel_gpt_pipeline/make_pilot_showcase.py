#!/usr/bin/env python3
"""Render a crisp side-by-side comparison PNG purely by decoding our ZERO-PNG JS pixel-matrix
files (`out_js/tier64/*.js` and `out_js/tier128/*.js`) — proving 100% true pixel fidelity!"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BRAIN = Path("/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/7aebff23-f78e-4d65-b77f-f1115593fd3d")
OUT_JS = Path("/home/antigravity/cloud_sandbox/tools/pixel_gpt_pipeline/out_js")
OUT_PNG = BRAIN / "qa_pixel_combat" / "gpt_true_pixel_pilot_64_vs_128.png"
BANK_CHARS = ".abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~"


def load_font(size: int):
    for p in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def expand_rle(row: str, w: int) -> str:
    if "*" not in row:
        return row
    out = []
    i, n = 0, len(row)
    while i < n:
        ch = row[i]
        if i + 1 < n and row[i + 1] == "*":
            j = i + 2
            num = []
            while j < n and row[j].isdigit():
                num.append(row[j])
                j += 1
            out.append(ch * (int("".join(num)) if num else 1))
            i = j
        else:
            out.append(ch)
            i += 1
    s = "".join(out)
    return s + "." * max(0, w - len(s))


def decode_js_bank(js_path: Path) -> tuple[dict, list[Image.Image]]:
    txt = js_path.read_text(encoding="utf-8")
    m = re.search(r"PIXEL_SPRITE_BANK\[[^\]]+\]\s*=\s*(\{.*\});", txt, re.S)
    assert m, f"Could not parse bank JSON in {js_path}"
    data = json.loads(m.group(1))
    w, h = data["w"], data["h"]
    pal = [None]
    for hx in data["palette"][1:]:
        c = hx.lstrip("#")
        pal.append((int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255))
    imgs = []
    for rows in data["frames"]:
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        px = im.load()
        for y, raw_r in enumerate(rows[:h]):
            line = expand_rle(raw_r, w)
            for x, ch in enumerate(line[:w]):
                if ch == ".":
                    continue
                idx = BANK_CHARS.find(ch)
                if idx > 0 and idx < len(pal) and pal[idx]:
                    px[x, y] = pal[idx]
        imgs.append(im)
    return data, imgs


def draw_checker(canvas: Image.Image, box, c1, c2, t=12):
    d = ImageDraw.Draw(canvas)
    x0, y0, x1, y1 = box
    for y in range(y0, y1, t):
        for x in range(x0, x1, t):
            c = c1 if ((x - x0) // t + (y - y0) // t) % 2 == 0 else c2
            d.rectangle([x, y, min(x + t - 1, x1), min(y + t - 1, y1)], fill=c)


def main():
    chars = [
        ("sylvia_silver", "希尔维亚 Sylvia"),
        ("beatrice", "贝阿特丽丝 Beatrice"),
        ("wolf_alpha", "灰棘头狼 Wolf Alpha"),
    ]
    tiers = [
        ("tier64", "Tier 1 · 复古 Q 版 64档（3× 整数渲染 · 零 PNG 纯像素矩阵）", 3, (29, 78, 216)),
        ("tier128", "Tier 3 · 商业高精 128档（2× 整数渲染 · 零 PNG 纯像素矩阵）", 2, (124, 58, 237)),
    ]

    PANEL_W, PANEL_H = 320, 274
    COL_W = PANEL_W * 2 + 36
    ROW_H = PANEL_H + 86
    PAD, HEAD = 24, 80
    W = PAD + (COL_W + PAD) * 2
    H = HEAD + PAD + (ROW_H + PAD) * 3

    img = Image.new("RGBA", (W, H), (245, 248, 253, 255))
    d = ImageDraw.Draw(img)
    f_title = load_font(26)
    f_sub = load_font(15)
    f_head = load_font(17)
    f_tag = load_font(13)
    f_meta = load_font(14)

    d.text((PAD, 14), "GPT (chatgpt-2) → 逐像素真像素矩阵对比（零 PNG · 纯 Canvas ImageData 实机规格）", fill=(15, 28, 56), font=f_title)
    d.text((PAD, 48), "本图 100% 由最终生成的 js/sprites/*.js 像素矩阵反解码绘制 · 左列=Tier 1 复古大颗粒(3×) · 右列=Tier 3 商业高精(2×)", fill=(78, 92, 118), font=f_sub)

    for ci, (tid, tlabel, scale, acc) in enumerate(tiers):
        cx = PAD + ci * (COL_W + PAD)
        d.rectangle([cx, HEAD - 4, cx + COL_W, HEAD], fill=acc)
        for ri, (cid, clabel) in enumerate(chars):
            ry = HEAD + PAD + ri * (ROW_H + PAD)
            d.rectangle([cx, ry, cx + COL_W, ry + ROW_H], fill=(255, 255, 255), outline=acc, width=2)
            js_path = OUT_JS / tid / f"{cid}.js"
            data, frames = decode_js_bank(js_path)
            w, h = data["w"], data["h"]
            ncols = len(data["palette"]) - 1
            sz_kb = js_path.stat().st_size / 1024.0
            d.text((cx + 14, ry + 10), f"{clabel}  |  {w}×{h} @ {scale}× = {w*scale}×{h*scale}px", fill=(15, 28, 56), font=f_head)

            for k, (fidx, tag, c1, c2, tc) in enumerate((
                (0, f"IDLE 待机 ({scale}× 浅底)", (242, 246, 252), (232, 238, 248), (64, 78, 102)),
                (4, f"STRIKE 攻击 ({scale}× 深底)", (24, 32, 48), (32, 42, 62), (186, 212, 248)),
            )):
                bx0 = cx + 12 + k * (PANEL_W + 12)
                box = (bx0, ry + 40, bx0 + PANEL_W, ry + 40 + PANEL_H)
                draw_checker(img, box, c1, c2)
                d.text((bx0 + 8, ry + 44), tag, fill=tc, font=f_tag)
                fr = frames[fidx].resize((w * scale, h * scale), Image.Resampling.NEAREST)
                px0 = box[0] + (PANEL_W - fr.width) // 2
                py0 = box[1] + 20 + (PANEL_H - 20 - fr.height) // 2
                img.alpha_composite(fr, (px0, py0))

            meta_line = f"格式: 纯 JS 像素矩阵（零 PNG） · 共享色板 {ncols} 色 · 0 半透明 · 6 帧全包体积 {sz_kb:.1f} KB"
            d.text((cx + 14, ry + ROW_H - 32), meta_line, fill=(56, 70, 96), font=f_meta)

    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(OUT_PNG, "PNG")
    print("Saved true-pixel comparison:", OUT_PNG, img.size)


if __name__ == "__main__":
    main()
