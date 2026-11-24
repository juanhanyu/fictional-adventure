#!/usr/bin/env python3
"""Convert a GPT-generated high-res 'pixel art' image into a TRUE native-grid pixel sprite
(indexed palette + exact WxH pixel matrix JS module, ZERO runtime PNGs, ZERO numpy needed).

Pipeline (pure Python 3 + Pillow):
1. Auto-detect GPT's true logical pixel pitch (px_w, px_h) & sub-pixel phase offset (ox, oy)
   via edge-energy periodicity around expected pitch (e.g. 16.0 on 1024->64).
2. Center-core median sampling (inner 50% of each logical cell) — immune to anti-aliased
   borders, mixels, and chroma-key bleeding.
3. Border flood-fill background removal (supports #FF00FF magenta / #00FF00 green / #FFFFFF / alpha)
   + 1px chroma-spill strip -> strict binary alpha (0 or 255).
4. Canonical canvas fitting & exact ground baseline locking (e.g. feet y=60 on 64x64 or 96x64).
5. Perceptual palette quantization (farthest-point seeded k-means in perceptual Lab-like space
   so small bright eye catchlights & vivid jewels survive) + orphan pixel removal.
6. Optional pixel-by-pixel manual patch JSON (`patches/<id>_<pose>.json`) after visual audit.
7. Emit:
   - Side-by-side 8x coordinate-ruler audit PNG (for pixel-by-pixel visual inspection),
   - True pixel-matrix JS module (`js/sprites/<id>.js` registering onto `window.PIXEL_SPRITE_BANK[id]`).
"""
from __future__ import annotations

import argparse
import json
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BANK_CHARS = ".abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~"


def rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    l = (0.299 * r + 0.587 * g + 0.114 * b) * 1.15
    a = (r - g) * 0.85
    c = (0.5 * (r + g) - b) * 0.65
    return (l, a, c)


def lab_dist2(u: tuple[float, float, float], v: tuple[float, float, float]) -> float:
    dl = u[0] - v[0]
    da = u[1] - v[1]
    dc = u[2] - v[2]
    return dl * dl + da * da + dc * dc


def rgb_dist(c1: tuple[int, int, int], c2: tuple[float, float, float]) -> float:
    return math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2)


def median_int(vals: list[int]) -> int:
    vals.sort()
    n = len(vals)
    return vals[n // 2] if n else 0


def detect_bg_color(im: Image.Image) -> tuple[tuple[float, float, float], bool]:
    w, h = im.size
    px = im.load()
    # Check if meaningful transparency already exists
    step = max(1, min(w, h) // 64)
    trans = 0
    tot = 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            tot += 1
            if px[x, y][3] < 128:
                trans += 1
    if tot and (trans / tot) > 0.08:
        return (255.0, 0.0, 255.0), True

    rs, gs, bs = [], [], []
    for (x0, y0) in ((0, 0), (max(0, w - 12), 0), (0, max(0, h - 12)), (max(0, w - 12), max(0, h - 12))):
        for y in range(y0, min(h, y0 + 12)):
            for x in range(x0, min(w, x0 + 12)):
                r, g, b, _ = px[x, y]
                rs.append(r)
                gs.append(g)
                bs.append(b)
    return (float(median_int(rs)), float(median_int(gs)), float(median_int(bs))), False


def detect_lattice(im: Image.Image, expected_pitch: float = 16.0) -> tuple[float, float, float]:
    """Find true logical pixel pitch & phase offset (ox, oy) via boundary-minus-midpoint contrast.

    A genuine pixel grid has strong edge energy on cell boundaries (k*p + o) and near-zero edge
    energy at cell midpoints ((k+0.5)*p + o). Scoring (mean_boundary - 1.5 * mean_midpoint) avoids
    both large-pitch sparsity bias and small-pitch window-overlap bias.
    """
    w, h = im.size
    gray = im.convert("L")
    gpx = gray.load()

    rows = range(0, h, 2)
    n_rows = float(len(rows))
    gx = [0.0] * (w - 1)
    for y in rows:
        prev = gpx[0, y]
        for x in range(w - 1):
            cur = gpx[x + 1, y]
            gx[x] += abs(cur - prev)
            prev = cur
    gx = [v / n_rows for v in gx]

    cols = range(0, w, 2)
    n_cols = float(len(cols))
    gy = [0.0] * (h - 1)
    for x in cols:
        prev = gpx[x, 0]
        for y in range(h - 1):
            cur = gpx[x, y + 1]
            gy[y] += abs(cur - prev)
            prev = cur
    gy = [v / n_cols for v in gy]

    p_min = max(5.0, expected_pitch * 0.55)
    p_max = min(32.0, expected_pitch * 1.55)
    steps_p = max(20, int((p_max - p_min) * 8) + 1)

    def search_axis(prof: list[float]) -> tuple[float, float, float]:
        n = len(prof)
        best_score = -1e18
        best_p, best_off = expected_pitch, 0.0
        for k in range(steps_p):
            p = p_min + (p_max - p_min) * k / max(1, steps_p - 1)
            ph_steps = max(12, int(round(p * 2)))
            axis_best = -1e18
            axis_off = 0.0
            for s in range(ph_steps):
                off = s * (p / ph_steps)
                b_sum = m_sum = 0.0
                b_cnt = m_cnt = 0
                pos = off
                while pos < n:
                    bi = int(round(pos))
                    if bi < n:
                        b_sum += prof[bi]
                        b_cnt += 1
                    mi = int(round(pos + p * 0.5))
                    if mi < n:
                        m_sum += prof[mi]
                        m_cnt += 1
                    pos += p
                if b_cnt and m_cnt:
                    val = (b_sum / b_cnt) - 1.5 * (m_sum / m_cnt)
                    if val > axis_best:
                        axis_best, axis_off = val, off
            # Very gentle preference for expected_pitch only to break near-ties
            score = axis_best * (1.0 - 0.01 * abs(p - expected_pitch) / expected_pitch)
            if score > best_score:
                best_score, best_p, best_off = score, p, axis_off
        return best_score, best_p, best_off

    _, px_p, ox = search_axis(gx)
    _, py_p, oy = search_axis(gy)
    # Use shared square pitch if X and Y agree closely; otherwise average
    pitch = 0.5 * (px_p + py_p) if abs(px_p - py_p) / max(px_p, py_p) < 0.08 else (px_p if abs(px_p - expected_pitch) < abs(py_p - expected_pitch) else py_p)
    return pitch, (ox + 1.0) % pitch, (oy + 1.0) % pitch


def sample_grid(im: Image.Image, pitch: float, ox: float, oy: float) -> Image.Image:
    """Sample inner 50% core of each detected logical pixel cell using per-channel median."""
    w, h = im.size
    px = im.load()
    gw = max(1, int(round((w - ox) / pitch)))
    gh = max(1, int(round((h - oy) / pitch)))
    out = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    opx = out.load()
    margin = max(0.0, pitch * 0.25)

    for gy in range(gh):
        y0 = max(0, int(math.floor(oy + gy * pitch + margin)))
        y1 = min(h, max(y0 + 1, int(math.ceil(oy + (gy + 1) * pitch - margin))))
        for gx in range(gw):
            x0 = max(0, int(math.floor(ox + gx * pitch + margin)))
            x1 = min(w, max(x0 + 1, int(math.ceil(ox + (gx + 1) * pitch - margin))))
            rs, gs, bs, als = [], [], [], []
            for y in range(y0, y1):
                for x in range(x0, x1):
                    r, g, b, a = px[x, y]
                    rs.append(r)
                    gs.append(g)
                    bs.append(b)
                    als.append(a)
            if rs:
                opx[gx, gy] = (median_int(rs), median_int(gs), median_int(bs), median_int(als))
    return out


def chroma_cutout(grid: Image.Image, bg_rgb: tuple[float, float, float], use_alpha: bool, tol: float = 76.0) -> Image.Image:
    """Flood-fill exterior background -> strict binary alpha (0 or 255) + magenta despill."""
    gw, gh = grid.size
    out = grid.copy()
    px = out.load()

    if use_alpha:
        for y in range(gh):
            for x in range(gw):
                r, g, b, a = px[x, y]
                px[x, y] = (0, 0, 0, 0) if a < 140 else (r, g, b, 255)
        return out

    is_bg = [[False] * gw for _ in range(gh)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if 0 <= x < gw and 0 <= y < gh and not is_bg[y][x]:
            r, g, b, _ = px[x, y]
            if rgb_dist((r, g, b), bg_rgb) <= tol:
                is_bg[y][x] = True
                q.append((x, y))

    for x in range(gw):
        try_push(x, 0)
        try_push(x, gh - 1)
    for y in range(gh):
        try_push(0, y)
        try_push(gw - 1, y)

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            try_push(x + dx, y + dy)

    # Remove tight interior chroma holes (between legs/arms)
    tight = tol * 0.55
    for y in range(gh):
        for x in range(gw):
            if not is_bg[y][x]:
                r, g, b, _ = px[x, y]
                if rgb_dist((r, g, b), bg_rgb) <= tight:
                    is_bg[y][x] = True

    # Strip 1px strong magenta-spill fringe pixels touching background
    is_magenta_bg = (bg_rgb[0] > 200 and bg_rgb[2] > 200 and bg_rgb[1] < 80)
    if is_magenta_bg:
        to_strip = []
        for y in range(gh):
            for x in range(gw):
                if is_bg[y][x]:
                    continue
                r, g, b, _ = px[x, y]
                if r > 150 and b > 150 and g < min(r, b) - 55:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < gw and 0 <= ny < gh and is_bg[ny][nx]:
                            to_strip.append((x, y))
                            break
        for x, y in to_strip:
            is_bg[y][x] = True

    for y in range(gh):
        for x in range(gw):
            if is_bg[y][x]:
                px[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 255)
    return out


def remove_orphans(grid: Image.Image) -> Image.Image:
    """Remove isolated 1-pixel opaque specks with 0 4-connected neighbors."""
    gw, gh = grid.size
    out = grid.copy()
    px = out.load()
    kill = []
    for y in range(gh):
        for x in range(gw):
            if px[x, y][3] != 255:
                continue
            nb = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < gw and 0 <= ny < gh and px[nx, ny][3] == 255:
                    nb += 1
            if nb == 0:
                kill.append((x, y))
    for x, y in kill:
        px[x, y] = (0, 0, 0, 0)
    return out


def fit_canonical(grid: Image.Image, target_w: int, target_h: int, ground_y: int, target_char_h: int | None = None) -> Image.Image:
    """Crop opaque bbox, rescale nearest-neighbor ONLY if needed, lock feet to exact ground_y."""
    bbox = grid.getbbox()
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    if not bbox:
        return canvas
    crop = grid.crop(bbox)
    cw, ch = crop.size
    max_h = target_char_h if target_char_h else (ground_y - 2)
    max_w = target_w - 4

    scale = 1.0
    if ch > max_h or cw > max_w:
        scale = min(max_h / ch, max_w / cw)
    elif target_char_h and abs(ch - target_char_h) / target_char_h > 0.14:
        scale = min(target_char_h / ch, max_w / cw)

    if abs(scale - 1.0) > 0.02:
        nw = max(1, int(round(cw * scale)))
        nh = max(1, int(round(ch * scale)))
        crop = crop.resize((nw, nh), Image.Resampling.NEAREST)
        cw, ch = crop.size

    dx = max(0, min(target_w - cw, (target_w - cw) // 2))
    dy = ground_y - ch + 1
    if dy < 1:
        dy = 1
    if dy + ch > target_h:
        dy = target_h - ch
    canvas.paste(crop, (dx, dy))
    return canvas


def quantize_palette(images: list[Image.Image], max_colors: int = 28) -> tuple[list[Image.Image], list[str]]:
    """Quantize opaque pixels across all frames into ONE cohesive palette (farthest-point + k-means)."""
    freq: dict[tuple[int, int, int], int] = {}
    for im in images:
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 255:
                    k = (r, g, b)
                    freq[k] = freq.get(k, 0) + 1

    if not freq:
        return [im.copy() for im in images], [""]

    uniq = list(freq.keys())
    if len(uniq) <= max_colors:
        palette_rgb = list(uniq)
    else:
        labs = [rgb_to_lab(*c) for c in uniq]
        weights = [freq[c] for c in uniq]
        # Start with brightest pixel (preserves eye catchlights & highlights)
        first = max(range(len(uniq)), key=lambda i: labs[i][0])
        centers = [labs[first]]
        d2 = [lab_dist2(labs[i], centers[0]) for i in range(len(uniq))]
        for _ in range(1, max_colors):
            nxt = max(range(len(uniq)), key=lambda i: d2[i])
            if d2[nxt] <= 1e-6:
                break
            centers.append(labs[nxt])
            for i in range(len(uniq)):
                v = lab_dist2(labs[i], centers[-1])
                if v < d2[i]:
                    d2[i] = v

        k_cnt = len(centers)
        assign = [0] * len(uniq)
        for _ in range(16):
            sums = [[0.0, 0.0, 0.0, 0.0] for _ in range(k_cnt)]
            for i, lb in enumerate(labs):
                bi = min(range(k_cnt), key=lambda k: lab_dist2(lb, centers[k]))
                assign[i] = bi
                w_i = weights[i]
                sums[bi][0] += lb[0] * w_i
                sums[bi][1] += lb[1] * w_i
                sums[bi][2] += lb[2] * w_i
                sums[bi][3] += w_i
            for k in range(k_cnt):
                if sums[k][3] > 0:
                    centers[k] = (sums[k][0] / sums[k][3], sums[k][1] / sums[k][3], sums[k][2] / sums[k][3])

        # Compute weighted RGB cluster representatives
        palette_rgb = []
        seen = set()
        for k in range(k_cnt):
            rs = gs = bs = wt = 0
            for i, bi in enumerate(assign):
                if bi == k:
                    w_i = weights[i]
                    rs += uniq[i][0] * w_i
                    gs += uniq[i][1] * w_i
                    bs += uniq[i][2] * w_i
                    wt += w_i
            if wt > 0:
                c = (int(round(rs / wt)), int(round(gs / wt)), int(round(bs / wt)))
                if c not in seen:
                    seen.add(c)
                    palette_rgb.append(c)

    palette_rgb.sort(key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    pal_labs = [rgb_to_lab(*c) for c in palette_rgb]

    remap: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    for c in uniq:
        lb = rgb_to_lab(*c)
        bi = min(range(len(pal_labs)), key=lambda k: lab_dist2(lb, pal_labs[k]))
        remap[c] = palette_rgb[bi]

    out_imgs = []
    for im in images:
        q = im.copy()
        px = q.load()
        w, h = q.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 255:
                    nr, ng, nb = remap[(r, g, b)]
                    px[x, y] = (nr, ng, nb, 255)
                else:
                    px[x, y] = (0, 0, 0, 0)
        out_imgs.append(q)

    hex_pal = [""] + [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in palette_rgb]
    return out_imgs, hex_pal


def apply_pixel_patches(grid: Image.Image, patch_path: Path | None) -> Image.Image:
    """Apply manual pixel-by-pixel overrides from JSON: {'pixels': [[x, y, '#rrggbb' | null], ...]}."""
    if not patch_path or not patch_path.exists():
        return grid
    data = json.loads(patch_path.read_text(encoding="utf-8"))
    out = grid.copy()
    px = out.load()
    w, h = out.size
    for item in data.get("pixels", []):
        x, y, col = int(item[0]), int(item[1]), item[2]
        if not (0 <= x < w and 0 <= y < h):
            continue
        if col is None or col == "":
            px[x, y] = (0, 0, 0, 0)
        else:
            c = col.lstrip("#")
            px[x, y] = (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
    return out


def encode_rle_row(row_str: str) -> str:
    """Compact run-length encoding (`c*N` for runs >= 4) readable by combat-pixel-vfx.js."""
    parts = []
    i, n = 0, len(row_str)
    while i < n:
        ch = row_str[i]
        j = i + 1
        while j < n and row_str[j] == ch:
            j += 1
        run = j - i
        parts.append(f"{ch}*{run}" if run >= 4 else ch * run)
        i = j
    return "".join(parts)


def grid_to_indexed_rows(grid: Image.Image, palette: list[str]) -> list[str]:
    hex_to_sym = {hx.lower(): BANK_CHARS[i] for i, hx in enumerate(palette) if i > 0}
    w, h = grid.size
    px = grid.load()
    rows = []
    for y in range(h):
        chars = []
        for x in range(w):
            r, g, b, a = px[x, y]
            chars.append("." if a < 255 else hex_to_sym.get(f"#{r:02x}{g:02x}{b:02x}", "."))
        rows.append(encode_rle_row("".join(chars)))
    return rows


def render_audit_sheet(src_img: Image.Image, true_grid: Image.Image, out_path: Path, scale: int = 8) -> None:
    """Render side-by-side GPT original vs 8x true-pixel grid with coordinate rulers for visual audit."""
    gw, gh = true_grid.size
    pw, ph = gw * scale, gh * scale
    ruler = 28
    pad = 16
    w_tot = pad * 4 + pw * 3 + ruler * 2
    h_tot = pad * 2 + ph + ruler + 32

    canvas = Image.new("RGBA", (w_tot, h_tot), (242, 246, 252, 255))
    d = ImageDraw.Draw(canvas)
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except Exception:
        f = ImageFont.load_default()

    src_fit = src_img.convert("RGBA").resize((pw, ph), Image.Resampling.BILINEAR)
    x_p1, y_p = pad, pad + 26
    d.text((x_p1, pad), "1. GPT Source", fill=(20, 32, 56), font=f)
    canvas.alpha_composite(src_fit, (x_p1, y_p))

    true_im = true_grid.resize((pw, ph), Image.Resampling.NEAREST)
    for idx, (label, bg) in enumerate([
        (f"2. True Pixel {gw}x{gh} (Light + Grid)", (244, 247, 252, 255)),
        (f"3. True Pixel {gw}x{gh} (Dark + Grid)", (24, 32, 48, 255)),
    ]):
        bx = x_p1 + (idx + 1) * (pw + pad) + idx * ruler + ruler
        d.text((bx, pad), label, fill=(20, 32, 56), font=f)
        d.rectangle([bx, y_p, bx + pw - 1, y_p + ph - 1], fill=bg)
        canvas.alpha_composite(true_im, (bx, y_p))
        for gx in range(0, gw, 4):
            tx = bx + gx * scale
            d.line([(tx, y_p), (tx, y_p + ph - 1)], fill=(120, 140, 180, 48))
            if gx % 8 == 0:
                d.text((tx + 1, y_p + ph + 4), str(gx), fill=(64, 78, 102), font=f)
        for gy in range(0, gh, 4):
            ty = y_p + gy * scale
            d.line([(bx, ty), (bx + pw - 1, ty)], fill=(120, 140, 180, 48))
            if gy % 8 == 0:
                d.text((bx - 22, ty), str(gy), fill=(64, 78, 102), font=f)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")


def export_js_bank(char_id: str, w: int, h: int, facing: str, palette: list[str], frames_rows: list[list[str]], anchors: dict, out_js: Path) -> None:
    payload = {
        "id": char_id,
        "w": w,
        "h": h,
        "facing": facing,
        "scaleMult": 1.0,
        "anchors": anchors,
        "palette": palette,
        "frames": frames_rows,
    }
    js = (
        f"/* Auto-generated TRUE pixel-matrix sprite for {char_id} ({w}x{h}, {len(palette)-1} colors, ZERO PNG). */\n"
        "(function(g){\n"
        "  g.PIXEL_SPRITE_BANK = g.PIXEL_SPRITE_BANK || {};\n"
        f"  g.PIXEL_SPRITE_BANK[{json.dumps(char_id)}] = {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))};\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n"
    )
    out_js.parent.mkdir(parents=True, exist_ok=True)
    out_js.write_text(js, encoding="utf-8")


def find_phase_for_pitch(im: Image.Image, pitch: float) -> tuple[float, float]:
    """Find optimal sub-pixel phase offset (ox, oy) for a fixed logical pitch."""
    w, h = im.size
    gray = im.convert("L")
    gpx = gray.load()
    rows = range(0, h, 2)
    gx = [sum(abs(gpx[x + 1, y] - gpx[x, y]) for y in rows) / len(rows) for x in range(w - 1)]
    cols = range(0, w, 2)
    gy = [sum(abs(gpx[x, y + 1] - gpx[x, y]) for x in cols) / len(cols) for y in range(h - 1)]

    def best_off(prof: list[float]) -> float:
        n = len(prof)
        steps = max(16, int(round(pitch * 3)))
        best_v, best_o = -1e18, 0.0
        for s in range(steps):
            o = s * (pitch / steps)
            bs = ms = 0.0
            bc = mc = 0
            pos = o
            while pos < n:
                bi = int(round(pos))
                if bi < n:
                    bs += prof[bi]
                    bc += 1
                mi = int(round(pos + pitch * 0.5))
                if mi < n:
                    ms += prof[mi]
                    mc += 1
                pos += pitch
            if bc and mc:
                v = (bs / bc) - 1.5 * (ms / mc)
                if v > best_v:
                    best_v, best_o = v, o
        return (best_o + 1.0) % pitch

    return best_off(gx), best_off(gy)


def convert_single(
    src_path: Path,
    grid_w: int,
    grid_h: int,
    ground_y: int,
    target_char_h: int | None,
    patch_path: Path | None,
    lock_pitch: float = 0.0,
) -> tuple[Image.Image, Image.Image, dict]:
    src_img = Image.open(src_path).convert("RGBA")
    bg_rgb, use_alpha = detect_bg_color(src_img)
    if lock_pitch > 0.0:
        pitch = lock_pitch
        ox, oy = find_phase_for_pitch(src_img, pitch)
    else:
        expected_pitch = src_img.size[1] / float(grid_h)
        pitch, ox, oy = detect_lattice(src_img, expected_pitch=expected_pitch)
    sampled = sample_grid(src_img, pitch, ox, oy)
    cut = chroma_cutout(sampled, bg_rgb, use_alpha)
    clean = remove_orphans(cut)
    fitted = fit_canonical(clean, grid_w, grid_h, ground_y, target_char_h=target_char_h)
    patched = apply_pixel_patches(fitted, patch_path)
    info = {
        "src": str(src_path),
        "detected_pitch": round(pitch, 3),
        "offset": [round(ox, 2), round(oy, 2)],
        "grid": [grid_w, grid_h],
    }
    return src_img, patched, info


def main() -> None:
    ap = argparse.ArgumentParser(description="将 GPT 像素原图逐像素校准转换为真像素矩阵 JS 模块（零 PNG）")
    ap.add_argument("--id", required=True, help="角色 ID (如 sylvia_silver)")
    ap.add_argument("--idle", type=Path, required=True, help="GPT 生成的待机图路径")
    ap.add_argument("--strike", type=Path, default=None, help="GPT 生成的攻击图路径")
    ap.add_argument("--windup", type=Path, default=None, help="可选蓄势图路径")
    ap.add_argument("--hurt", type=Path, default=None, help="可选受击图路径")
    ap.add_argument("--w", type=int, default=64, help="目标真像素宽 (人形 64 / 兽类 96)")
    ap.add_argument("--h", type=int, default=64, help="目标真像素高 (默认 64)")
    ap.add_argument("--ground-y", type=int, default=60, help="脚底对齐行号 (默认 60)")
    ap.add_argument("--char-h", type=int, default=54, help="角色站立目标高度 (0=保持1:1原生缩放)")
    ap.add_argument("--colors", type=int, default=28, help="最大色板数 (默认 28)")
    ap.add_argument("--facing", choices=["right", "left"], default="right")
    ap.add_argument("--lock-pitch", type=float, default=0.0, help="锁定全部帧使用同一逻辑像素格距 (0=按idle自动锁)")
    ap.add_argument("--patch-dir", type=Path, default=None, help="手动逐像素修补 JSON 目录")
    ap.add_argument("--audit-dir", type=Path, default=Path("./audit"), help="输出坐标核对图目录")
    ap.add_argument("--out-js", type=Path, required=True, help="输出真像素 JS 模块路径 (js/sprites/<id>.js)")
    args = ap.parse_args()

    char_h = args.char_h if args.char_h > 0 else None
    idle_patch = (args.patch_dir / f"{args.id}_idle.json") if args.patch_dir else None
    src_idle, idle_grid, info_idle = convert_single(args.idle, args.w, args.h, args.ground_y, char_h, idle_patch, lock_pitch=args.lock_pitch)
    # Lock strike/windup/hurt to the exact same pitch as idle so character head/body never shrinks mid-animation!
    frame_pitch = args.lock_pitch if args.lock_pitch > 0 else float(info_idle["detected_pitch"])

    # Derive subtle 1px breathing frame (upper body shifts down 1px while feet stay locked!)
    idle2_grid = idle_grid.copy()
    split_y = max(4, args.ground_y - 10)
    upper = idle_grid.crop((0, 0, args.w, split_y - 1))
    idle2_grid.paste((0, 0, 0, 0), (0, 0, args.w, split_y))
    idle2_grid.paste(upper, (0, 1))

    blink_patch = (args.patch_dir / f"{args.id}_blink.json") if args.patch_dir else None
    blink_grid = apply_pixel_patches(idle_grid.copy(), blink_patch)

    src_strike = None
    strike_grid = idle_grid.copy()
    if args.strike and args.strike.exists():
        sp = (args.patch_dir / f"{args.id}_strike.json") if args.patch_dir else None
        src_strike, strike_grid, info_strike = convert_single(args.strike, args.w, args.h, args.ground_y, char_h, sp, lock_pitch=frame_pitch)
        print("Strike:", json.dumps(info_strike, ensure_ascii=False))

    windup_grid = idle_grid.copy()
    if args.windup and args.windup.exists():
        wp = (args.patch_dir / f"{args.id}_windup.json") if args.patch_dir else None
        _, windup_grid, _ = convert_single(args.windup, args.w, args.h, args.ground_y, char_h, wp, lock_pitch=frame_pitch)

    hurt_grid = idle_grid.copy()
    if args.hurt and args.hurt.exists():
        hp = (args.patch_dir / f"{args.id}_hurt.json") if args.patch_dir else None
        _, hurt_grid, _ = convert_single(args.hurt, args.w, args.h, args.ground_y, char_h, hp, lock_pitch=frame_pitch)

    all_frames = [idle_grid, idle2_grid, blink_grid, windup_grid, strike_grid, hurt_grid]
    q_frames, shared_pal = quantize_palette(all_frames, max_colors=min(48, args.colors + 6))

    # Re-apply patches on quantized frames if needed so hand-picked patch colors stay exact
    for idx, name in ((0, "idle"), (2, "blink"), (3, "windup"), (4, "strike"), (5, "hurt")):
        pp = (args.patch_dir / f"{args.id}_{name}.json") if args.patch_dir else None
        if pp and pp.exists():
            q_frames[idx] = apply_pixel_patches(q_frames[idx], pp)

    # Rebuild exact unique palette after patches
    uniq = set()
    for fr in q_frames:
        px = fr.load()
        for y in range(args.h):
            for x in range(args.w):
                r, g, b, a = px[x, y]
                if a == 255:
                    uniq.add((r, g, b))
    pal_sorted = sorted(uniq, key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    shared_pal = [""] + [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in pal_sorted]

    render_audit_sheet(src_idle, q_frames[0], args.audit_dir / f"{args.id}_idle_audit.png")
    if src_strike is not None:
        render_audit_sheet(src_strike, q_frames[4], args.audit_dir / f"{args.id}_strike_audit.png")

    encoded = [grid_to_indexed_rows(fr, shared_pal) for fr in q_frames]
    anchors = {
        "feet": [args.w // 2, args.ground_y],
        "cast": [args.w - 6 if args.facing == "right" else 6, int(args.h * 0.52)],
        "hit": [args.w // 2, int(args.h * 0.56)],
        "head": [args.w // 2, int(args.h * 0.28)],
    }
    export_js_bank(args.id, args.w, args.h, args.facing, shared_pal, encoded, anchors, args.out_js)
    print("Idle:", json.dumps(info_idle, ensure_ascii=False))
    print(f"Exported TRUE pixel-matrix JS: {args.out_js} ({args.out_js.stat().st_size} bytes, {len(shared_pal)-1} shared colors)")


if __name__ == "__main__":
    main()
