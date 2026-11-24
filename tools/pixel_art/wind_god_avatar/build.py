#!/usr/bin/env python3
"""HD anime pixel-art final boss combat sprite builder for Wind God Ran (wind_god_avatar / 风神·岚).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 84 x 88, 6 horizontal frames (504 x 88 sheet, padding=0).
Facing: left. GROUND_Y = 82, PIVOT_X = 46 (hovering gracefully 4-6px aloft).

Pass 4 (Final Museum-Grade Gale-Flow Polish):
- Swept outer mint-silver hair billows gracefully outward/upward into wind-tossed crescent S-tips (matching fengshen_normal.png!)
- Separated trailing near-arm silk ribbon cleanly into open air with graceful billowing taper
- Softened windup awakening eye upper-lash curve for serenely regal divine gaze
"""
from __future__ import annotations

import json
import math
import os
import sys

from PIL import Image, ImageDraw

TOOLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

from pixelstudio import Sprite, hex2rgba, NEAREST  # noqa: E402

# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------
W, H = 84, 88
N_FRAMES = 6
GROUND_Y = 82
PIVOT_X = 46

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "wind_god_avatar_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "wind_god_avatar_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 25-Color Hue-Shifted Celestial Tempest Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
# 1. Ethereal Pale Mint-Silver-Green Divine Hair
HAIR_HI  = "#f0fffb"  # Luminous sunlit mint-white angel-ring crown & wind sheen
HAIR_MID = "#bee3da"  # Signature ethereal pale mint-silver-green divine hair
HAIR_SH1 = "#7eb0a8"  # Celadon-jade hair mid-shadow & liquid strand grooves
HAIR_SH2 = "#4d7874"  # Deep sea-pine hair shadow & lit hair selective outline

# 2. Celestial Pearl-White Gossamer Gown & Blossoms
PURE_WHT = "#ffffff"  # Eye catchlights, white lily petals, vacuum-blade razor core
SILK_HI  = "#e6eff7"  # Pearl-white sunlit celestial gossamer highlight
SILK_MID = "#bfd3e2"  # Translucent silver-mist gossamer silk midtone
SILK_SH1 = "#8aa5bc"  # Cool sky-slate gossamer shadow fold
SILK_SH2 = "#5b7794"  # Deep gossamer crease & airy gossamer selective outline

# 3. Porcelain Divine Skin & Soft Ethereal Blush
SKIN_HI  = "#fff1e8"  # Warm porcelain brow/cheek/thigh highlight
SKIN_MID = "#fad7c5"  # Warm porcelain skin base
SKIN_SH1 = "#dfa795"  # Soft peach skin shadow
SKIN_SH2 = "#b5746b"  # Chin/neck shadow, serene lip & lit-side skin selout
INK_SKIN = "#824e4e"  # Warm muted rose-umber jaw/limb shadow selective outline
BLUSH    = "#f29cb0"  # Delicate goddess cheek blush & battle voice interior

# 4. Ornate Golden Floral Laurel, Vine Corset & Ankle Vines
GLD_HI   = "#ffef9e"  # Gleaming celestial champagne-gold highlight
GLD_MID  = "#d8ab4c"  # Rich antique gold vine filigree & laurel leaves
GLD_SH   = "#9a6c25"  # Burnished gold shadow
GLD_DK   = "#613f16"  # Deep bronze-gold crevice & gold selective outline

# 5. Transcendent Pale Jade-Cyan Eyes & Tempest Wind VFX
WIND_HI  = "#9ffcf0"  # Radiant aquamarine-mint storm glow & lower iris crescent
WIND_MID = "#43d6ca"  # Vivid emerald-cyan tempest ribbon & mid-iris
WIND_SH  = "#1a9c9e"  # Deep jade-teal vortex rim & upper iris
EYE_DK   = "#146674"  # Deep sea-jade iris shadow & focused pupil ring

# 6. Deep Storm-Teal Selective Inks (NEVER pure black!)
INK_DARK = "#172a38"  # Deep storm-indigo-teal ink, upper lashes, grounded creases
INK_MID  = "#315363"  # Mid storm-slate outline for shaded hair & silk hems

PALETTE = [
    HAIR_HI, HAIR_MID, HAIR_SH1, HAIR_SH2,
    PURE_WHT, SILK_HI, SILK_MID, SILK_SH1, SILK_SH2,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, INK_SKIN, BLUSH,
    GLD_HI, GLD_MID, GLD_SH, GLD_DK,
    WIND_HI, WIND_MID, WIND_SH, EYE_DK,
    INK_DARK, INK_MID,
]

# ---------------------------------------------------------------------------
# Drawing Helpers
# ---------------------------------------------------------------------------

def hspan(sp: Sprite, y: int, x0: int, x1: int, col: str, only=None):
    if x1 < x0:
        x0, x1 = x1, x0
    for x in range(int(x0), int(x1) + 1):
        sp.px(x, int(y), col, only=only)


def _bridge_4conn(sp: Sprite, x0: int, y0: int, x1: int, y1: int, col: str):
    """Connect (x0, y0) to (x1, y1) with strictly 4-connected steps (zero isolated px)."""
    cx_b, cy_b = x0, y0
    while cx_b != x1 or cy_b != y1:
        if abs(x1 - cx_b) >= abs(y1 - cy_b):
            cx_b += 1 if x1 > cx_b else -1
        else:
            cy_b += 1 if y1 > cy_b else -1
        sp.px(cx_b, cy_b, col)


def draw_curve_stroke(
    sp: Sprite,
    pts: list[tuple[float, float]],
    thickness_fn,
    color_fn,
    steps: int = 40,
):
    """Smooth Chaikin-smoothed parametric stroke with strictly 4-connected bridging."""
    if len(pts) < 2:
        return
    smooth = list(pts)
    for _ in range(2):
        if len(smooth) < 3:
            break
        nxt = [smooth[0]]
        for i in range(len(smooth) - 1):
            ax, ay = smooth[i]
            bx, by = smooth[i + 1]
            nxt.append((0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by))
            nxt.append((0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by))
        nxt.append(smooth[-1])
        smooth = nxt

    cum = [0.0]
    for i in range(1, len(smooth)):
        cum.append(cum[-1] + math.hypot(smooth[i][0] - smooth[i - 1][0], smooth[i][1] - smooth[i - 1][1]))
    total = max(1e-5, cum[-1])

    def sample_at(u: float):
        target = u * total
        for i in range(1, len(cum)):
            if cum[i] >= target:
                seg = max(1e-5, cum[i] - cum[i - 1])
                f = (target - cum[i - 1]) / seg
                return (
                    smooth[i - 1][0] + (smooth[i][0] - smooth[i - 1][0]) * f,
                    smooth[i - 1][1] + (smooth[i][1] - smooth[i - 1][1]) * f,
                )
        return smooth[-1]

    prev_xy = None
    for s in range(steps + 1):
        t = s / steps
        fx, fy = sample_at(t)
        ix = max(2, min(W - 3, int(round(fx))))
        iy = max(2, min(H - 3, int(round(fy))))
        rad = thickness_fn(t)
        if rad < 0.95:
            col_c = color_fn(t, 0, 0)
            if prev_xy is not None:
                _bridge_4conn(sp, prev_xy[0], prev_xy[1], ix, iy, col_c)
            else:
                sp.px(ix, iy, col_c)
            prev_xy = (ix, iy)
        else:
            if prev_xy is not None:
                _bridge_4conn(sp, prev_xy[0], prev_xy[1], ix, iy, color_fn(t, 0, 0))
            ir = int(math.ceil(rad))
            for dy in range(-ir, ir + 1):
                for dx in range(-ir, ir + 1):
                    if dx * dx + dy * dy <= rad * rad + 0.15:
                        px_x, px_y = ix + dx, iy + dy
                        if 1 <= px_x <= W - 2 and 1 <= px_y <= H - 2:
                            sp.px(px_x, px_y, color_fn(t, dx, dy))
            prev_xy = (ix, iy)


def draw_orbital_wind_ring(
    sp: Sprite,
    ocx: float,
    ocy: float,
    rx: float,
    ry: float,
    tilt_deg: float,
    t_start: float = 0.0,
    t_end: float = 2.0 * math.pi,
    thick_front: float = 1.45,
    thick_back: float = 0.85,
    bright: bool = False,
    steps: int = 84,
):
    """Mathematically smooth 3D tilted elliptical tempest ribbon!
    Routes back arc (sin(theta) < 0) to 'back_fx' and front arc (sin(theta) >= 0) to 'fx'."""
    cos_t = math.cos(math.radians(tilt_deg))
    sin_t = math.sin(math.radians(tilt_deg))

    prev_back = None
    prev_front = None

    for s in range(steps + 1):
        u = s / steps
        th = t_start + (t_end - t_start) * u
        lx = rx * math.cos(th)
        ly = ry * math.sin(th)
        fx = ocx + lx * cos_t - ly * sin_t
        fy = ocy + lx * sin_t + ly * cos_t
        ix = max(2, min(W - 3, int(round(fx))))
        iy = max(2, min(H - 3, int(round(fy))))

        depth = math.sin(th)
        is_front = depth >= 0.0
        sp.layer("fx" if is_front else "back_fx")

        edge_fade = 1.0
        if abs((t_end - t_start) - 2.0 * math.pi) > 0.05:
            edge_fade = math.sin(u * math.pi) ** 0.55

        if is_front:
            rad = (thick_back + (thick_front - thick_back) * max(0.0, depth)) * edge_fade
            prev = prev_front
        else:
            rad = (thick_back * (0.65 + 0.35 * (1.0 + depth))) * edge_fade
            prev = prev_back

        def _col(dx: int, dy: int):
            if is_front:
                if bright and depth > 0.45 and dy <= 0:
                    return PURE_WHT if dy < 0 or (dx == 0 and depth > 0.65) else WIND_HI
                if depth > 0.50 and dy < 0:
                    return PURE_WHT
                if dy <= 0:
                    return WIND_HI
                return WIND_MID if depth > 0.25 else WIND_SH
            else:
                if dy < 0:
                    return WIND_HI if bright else WIND_MID
                return WIND_MID if depth > -0.5 else WIND_SH

        if rad < 0.92:
            c0 = _col(0, 0)
            if prev is not None and abs(prev[0] - ix) + abs(prev[1] - iy) <= 8:
                _bridge_4conn(sp, prev[0], prev[1], ix, iy, c0)
            else:
                sp.px(ix, iy, c0)
        else:
            if prev is not None and abs(prev[0] - ix) + abs(prev[1] - iy) <= 8:
                _bridge_4conn(sp, prev[0], prev[1], ix, iy, _col(0, 0))
            ir = int(math.ceil(rad))
            for dy in range(-ir, ir + 1):
                for dx in range(-ir, ir + 1):
                    if dx * dx + dy * dy <= rad * rad + 0.12:
                        px_x, px_y = ix + dx, iy + dy
                        if 1 <= px_x <= W - 2 and 1 <= px_y <= H - 2:
                            sp.px(px_x, px_y, _col(dx, dy))

        if is_front:
            prev_front = (ix, iy)
            if abs(depth) < 0.08:
                prev_back = (ix, iy)
        else:
            prev_back = (ix, iy)
            if abs(depth) < 0.08:
                prev_front = (ix, iy)


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected jewelry-grade material- & light-aware selective outer outline (excludes fx/back_fx!).
    Lit edges step 1 tone lighter (SKIN_SH2, HAIR_SH2, SILK_SH2, GLD_SH) while shaded edges hold
    crisp contrast (INK_SKIN, INK_MID, GLD_DK) for breathtaking clarity on BOTH sunlit courtyard & dusk!"""
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    body_layers = [ln for ln in sp.layer_order if ln not in ("outline", "fx", "back_fx")]
    body_comp = sp._blank()
    for ln in body_layers:
        cel = sp.frames[frame_idx - 1].cels.get(ln)
        if cel is not None:
            body_comp = Image.alpha_composite(body_comp, cel)
    src = body_comp.load()

    rgba_hair_lit = hex2rgba(HAIR_SH2)
    rgba_silk_lit = hex2rgba(SILK_SH2)
    rgba_ink_mid  = hex2rgba(INK_MID)
    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_skin_lit = hex2rgba(SKIN_SH2)
    rgba_ink_skin = hex2rgba(INK_SKIN)
    rgba_gld_dk   = hex2rgba(GLD_DK)
    rgba_gld_sh   = hex2rgba(GLD_SH)

    hair_set = {hex2rgba(HAIR_HI)[:3], hex2rgba(HAIR_MID)[:3], hex2rgba(HAIR_SH1)[:3], hex2rgba(HAIR_SH2)[:3]}
    silk_set = {hex2rgba(PURE_WHT)[:3], hex2rgba(SILK_HI)[:3], hex2rgba(SILK_MID)[:3], hex2rgba(SILK_SH1)[:3]}
    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3], hex2rgba(BLUSH)[:3]}
    gold_set = {hex2rgba(GLD_HI)[:3], hex2rgba(GLD_MID)[:3], hex2rgba(GLD_SH)[:3]}

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            nbrs = []
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and src[nx, ny][3] > 0:
                    nbrs.append((dx, dy, src[nx, ny][:3]))
            if not nbrs:
                continue

            is_top_left = any(dx == 1 or dy == 1 for dx, dy, _ in nbrs) and not any(dy == -1 for _, dy, _ in nbrs)
            rgb_list = [rgb for _, _, rgb in nbrs]

            if all(rgb in gold_set for rgb in rgb_list):
                dst[x, y] = rgba_gld_sh if (is_top_left and y < 22) else rgba_gld_dk
            elif y <= 14 and any(rgb in silk_set for rgb in rgb_list):
                dst[x, y] = rgba_silk_lit if is_top_left else rgba_hair_lit
            elif any(rgb in skin_set for rgb in rgb_list) and not any(rgb in hair_set for rgb in rgb_list):
                dst[x, y] = rgba_skin_lit if (is_top_left and 18 <= y <= 52) else rgba_ink_skin
            elif all(rgb in hair_set for rgb in rgb_list):
                dst[x, y] = rgba_hair_lit if is_top_left else rgba_ink_mid
            elif all(rgb in silk_set for rgb in rgb_list):
                dst[x, y] = rgba_silk_lit if (is_top_left or y >= 64) else rgba_ink_mid
            elif any(rgb in silk_set for rgb in rgb_list):
                dst[x, y] = rgba_silk_lit if is_top_left else rgba_ink_mid
            elif any(rgb in hair_set for rgb in rgb_list):
                dst[x, y] = rgba_hair_lit if is_top_left else rgba_ink_mid
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters (Facing LEFT!)
# ---------------------------------------------------------------------------

def draw_back_hair(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Sweeping, wind-tossed ethereal pale mint-silver-green divine hair — 3 overlapping sculpted
    S-wave silk ribbons with graceful airy sky notches & tapered crescent tips (ZERO dome puff!)."""
    sp.layer("back_hair")

    if pose == "strike":
        gust = 4
        lift = -2
    elif pose == "windup":
        gust = 3
        lift = -3
    elif pose == "hurt":
        gust = 4
        lift = -1
    elif pose == "idle2":
        gust = 1
        lift = -1
    else:
        gust = 0
        lift = 0

    # 1) Sleek sculpted inner mane flowing gracefully behind neck & back (y = head_y + 5 .. head_y + 50)
    # Kept slender so the sweeping layered outer wind-waves read clearly with airy negative space!
    top_y = head_y + 5
    bot_y = head_y + 49
    rows = {}
    for i in range(bot_y - top_y + 1):
        y = top_y + i
        t = i / max(1, bot_y - top_y)
        s_wave = math.sin(t * 4.4 - 0.3 + sway * 0.4) * 2.2

        if t < 0.24:
            lx = cx - 8 + int(round(t * 10))
        elif t < 0.65:
            lx = cx - 6 + int(round((t - 0.24) * 14))
        else:
            lx = cx + int(round((t - 0.65) * 16))

        # Slender wind-swept S-cascade (no chunky round puff!)
        if t < 0.20:
            rx = cx + 10 + int(round((t / 0.20) * (7 + gust * 0.5)))
        elif t < 0.58:
            u = (t - 0.20) / 0.38
            rx = cx + 17 + int(round(math.sin(u * math.pi) * 3.5 + gust * 0.6 + s_wave))
        else:
            u = (t - 0.58) / 0.42
            rx = cx + 18 - int(round(u * 4.0 - math.sin(u * math.pi) * 2.2)) + int(round(gust * 0.5))

        rx = min(W - 4, rx)
        if rx >= lx:
            rows[y] = (lx, rx)

    for y, (lx, rx) in rows.items():
        t = (y - top_y) / max(1, bot_y - top_y)
        span = max(1, rx - lx)
        hspan(sp, y, lx, rx, HAIR_MID)
        if t < 0.35:
            hi_end = min(rx - 2, lx + int(span * (0.68 - t * 0.85)))
            if hi_end >= lx + 1:
                hspan(sp, y, lx + 1, hi_end, HAIR_HI)
        # Liquid-silk vertical curving hair grooves
        for ridge_u, freq, phase in [(0.32, 5.2, 0.2), (0.64, 4.6, 1.5)]:
            rx_pos = lx + int(round(span * ridge_u + math.sin(t * freq + phase) * 1.5))
            if lx + 2 <= rx_pos <= rx - 2:
                sp.px(rx_pos, y, HAIR_SH1 if t < 0.55 else HAIR_SH2)
                if t < 0.72:
                    sp.px(rx_pos + 1, y, HAIR_HI if t < 0.42 else HAIR_MID)
        if rx - 2 >= lx:
            hspan(sp, y, rx - 2, rx, HAIR_SH1)
            sp.px(rx, y, HAIR_SH2)
        if 0.24 < t < 0.72 and lx + 2 <= rx - 3:
            hspan(sp, y, lx, min(rx - 3, lx + 2), HAIR_SH1)

    # 2) TWO GRACEFUL, SWEEPING WIND-BLOWN SILK HAIR BILLOWS flicking gracefully OUTWARD-RIGHT in the gale!
    # Billow A (High sweeping wind-crest soaring right & flicking gracefully outward-upward like fengshen_normal.png!)
    billow_a = [
        (cx + 9,  head_y + 10),
        (cx + 18, head_y + 12 + lift // 2),
        (cx + 26 + gust // 2, head_y + 14 + lift),
        (min(W - 3, cx + 33 + gust // 2), head_y + 11 + lift),
    ]
    draw_curve_stroke(
        sp, billow_a,
        thickness_fn=lambda t: 3.0 * ((1.0 - t * 0.80) ** 0.85),
        color_fn=lambda t, dx, dy: (
            HAIR_HI if (dy < 0 and t < 0.78) else
            (HAIR_MID if dy <= 0 else (HAIR_SH1 if t < 0.78 else HAIR_SH2))
        ),
        steps=32,
    )

    # Billow B (Mid sweeping S-curve silk wave billowing right & curling lightly upward at wind-caught tip!)
    billow_b = [
        (cx + 12, head_y + 23),
        (cx + 21 + gust // 2, head_y + 28 + sway),
        (min(W - 3, cx + 28 + gust // 2), head_y + 27 + sway + lift // 2),
        (min(W - 3, cx + 33 + gust // 2), head_y + 23 + lift // 2),
    ]
    draw_curve_stroke(
        sp, billow_b,
        thickness_fn=lambda t: 2.8 * ((1.0 - t * 0.82) ** 0.85),
        color_fn=lambda t, dx, dy: (
            HAIR_HI if (dy < 0 and t < 0.62) else
            (HAIR_MID if dy <= 0 else (HAIR_SH1 if t < 0.78 else HAIR_SH2))
        ),
        steps=32,
    )

    # Billow C (Lower cascading silky ribbons trailing softly behind waist & gossamer skirt!)
    base_lx, base_rx = rows.get(bot_y - 2, (cx + 4, cx + 18))
    for y in range(bot_y - 1, bot_y + 1):
        for x in range(base_lx, base_rx + 2):
            sp.px(x, y, None)

    lower_locks = [
        (base_lx + 1,  9, 5, True),
        (base_lx + 7, 11, 8, True),
        (base_lx + 12, 9, 8, False),
    ]
    for bx, length, sweep_r, is_lit in lower_locks:
        pts_l = [
            (bx, bot_y - 3),
            (bx + sweep_r * 0.55, bot_y + length * 0.45),
            (min(W - 3, bx + sweep_r), bot_y + length),
        ]
        draw_curve_stroke(
            sp, pts_l,
            thickness_fn=lambda t: 2.2 * (1.0 - t * 0.78),
            color_fn=lambda t, dx, dy, lit=is_lit: (
                HAIR_HI if (lit and dy < 0 and t < 0.45) else
                (HAIR_MID if (dy <= 0 and t < 0.75) else (HAIR_SH1 if t < 0.85 else HAIR_SH2))
            ),
            steps=22,
        )

    # 3) Soft billowing LEFT counter-breeze hair veil curving gently DOWN behind her far shoulder
    if pose == "strike":
        l_pts = [(cx - 8, head_y + 11), (cx - 12, head_y + 18), (cx - 11, head_y + 25)]
    elif pose == "windup":
        l_pts = [(cx - 8, head_y + 11), (cx - 14, head_y + 16), (cx - 15, head_y + 24), (cx - 12, head_y + 30)]
    else:
        l_pts = [(cx - 8, head_y + 11), (cx - 13, head_y + 17 + sway // 2), (cx - 14, head_y + 25), (cx - 12, head_y + 31)]
    draw_curve_stroke(
        sp, l_pts,
        thickness_fn=lambda t: 2.3 * (1.0 - t * 0.72),
        color_fn=lambda t, dx, dy: (
            HAIR_HI if (dx < 0 and t < 0.62) else
            (HAIR_MID if dx <= 0 else (HAIR_SH1 if t < 0.78 else HAIR_SH2))
        ),
        steps=24,
    )


def draw_back_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Billowing sheer pearl-white celestial gossamer skirt train & silky S-wave tails sweeping RIGHT."""
    sp.layer("back_skirt")

    gust = 4 if pose == "strike" else (3 if pose in ("windup", "hurt") else (1 if pose == "idle2" else 0))

    for i in range(25):
        y = waist_y + 2 + i
        t = i / 24.0
        lx = cx - 2 + int(round(t * 5 + math.sin(t * 2.6) * 1.1))
        rx = cx + 6 + int(round((t ** 0.80) * (15 + gust) + math.sin(t * 3.8 + sway * 0.5) * 1.8))
        rx = min(W - 4, rx)
        span = max(1, rx - lx)
        for x in range(lx, rx + 1):
            u = (x - lx) / span
            fold = math.sin(u * 9.0 - t * 3.2)
            if u < 0.16:
                col = SILK_SH1
            elif fold > 0.48 and u < 0.84:
                col = PURE_WHT if t < 0.45 else SILK_HI
            elif fold > -0.10:
                col = SILK_HI if u < 0.55 else SILK_MID
            else:
                col = SILK_MID if u < 0.72 else SILK_SH1
            sp.px(x, y, col)
        if rx - 1 >= lx:
            sp.px(rx - 1, y, SILK_HI)
            sp.px(rx, y, SILK_MID if t < 0.75 else SILK_SH1)

    tail1 = [
        (cx + 12, waist_y + 18),
        (cx + 21 + gust // 2, waist_y + 21 + sway),
        (min(W - 3, cx + 28 + gust // 2), waist_y + 17 + sway),
        (min(W - 3, cx + 33), waist_y + 21),
    ]
    draw_curve_stroke(
        sp, tail1,
        thickness_fn=lambda t: 1.95 * (1.0 - t * 0.70),
        color_fn=lambda t, dx, dy: PURE_WHT if dy < 0 and t < 0.55 else (SILK_HI if dy <= 0 else SILK_MID),
        steps=28,
    )

    tail2 = [
        (cx + 9, waist_y + 23),
        (cx + 18 + gust // 2, waist_y + 27),
        (min(W - 4, cx + 26 + gust // 2), waist_y + 25 + sway),
        (min(W - 3, cx + 30 + gust // 2), waist_y + 28 + sway),
    ]
    draw_curve_stroke(
        sp, tail2,
        thickness_fn=lambda t: 1.60 * (1.0 - t * 0.68),
        color_fn=lambda t, dx, dy: SILK_HI if dy <= 0 else SILK_MID,
        steps=26,
    )


def draw_legs(sp: Sprite, cx: int, hip_y: int, toe_y: int, pose: str):
    """Long, graceful hovering barefoot porcelain legs crossed delicately in levitation,
    adorned with intricate golden ankle vines (faithful to fengshen_normal.png!)."""
    sp.layer("legs")

    if pose == "strike":
        near_pts = [(cx + 2, hip_y), (cx - 1, hip_y + 11), (cx - 1, hip_y + 20), (cx + 1, toe_y)]
        far_pts  = [(cx - 3, hip_y), (cx - 6, hip_y + 10), (cx - 5, hip_y + 19), (cx - 3, toe_y - 2)]
    elif pose == "windup":
        near_pts = [(cx + 2, hip_y), (cx, hip_y + 11), (cx - 1, hip_y + 20), (cx - 1, toe_y)]
        far_pts  = [(cx - 2, hip_y), (cx - 4, hip_y + 10), (cx + 2, hip_y + 19), (cx + 4, toe_y - 2)]
    elif pose == "hurt":
        near_pts = [(cx + 1, hip_y), (cx - 3, hip_y + 10), (cx, hip_y + 19), (cx + 2, toe_y)]
        far_pts  = [(cx - 3, hip_y), (cx - 6, hip_y + 9), (cx - 3, hip_y + 18), (cx - 2, toe_y - 1)]
    else:
        near_pts = [(cx + 2, hip_y), (cx - 1, hip_y + 11), (cx - 2, hip_y + 20), (cx - 1, toe_y)]
        far_pts  = [(cx - 2, hip_y), (cx - 4, hip_y + 10), (cx + 1, hip_y + 19), (cx + 3, toe_y - 2)]

    def _paint_leg(pts, is_far: bool):
        c_hi = SKIN_MID if is_far else SKIN_HI
        c_mid = SKIN_SH1 if is_far else SKIN_MID
        c_sh = SKIN_SH2 if is_far else SKIN_SH1

        y_start = pts[0][1]
        y_end = pts[-1][1]
        total_h = max(1, y_end - y_start)

        def interp_x(y: int) -> float:
            for k in range(len(pts) - 1):
                y0, y1 = pts[k][1], pts[k + 1][1]
                if y0 <= y <= y1:
                    f = (y - y0) / max(1, y1 - y0)
                    return pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f
            return pts[-1][0]

        for y in range(y_start, y_end + 1):
            t = (y - y_start) / total_h
            fx = interp_x(y)
            if t < 0.36:
                w = 4 if t < 0.24 else 3
            elif t < 0.65:
                w = 3
            elif t < 0.85:
                w = 2
            else:
                w = 3 if t < 0.93 else (2 if t < 0.98 else 1)

            x0 = int(round(fx - w / 2.0))
            if t >= 0.85 and t > 0.90:
                x0 -= 1
            hspan(sp, y, x0, x0 + w - 1, c_mid)
            if w >= 2:
                sp.px(x0, y, c_hi)
                sp.px(x0 + w - 1, y, c_sh)
            if t < 0.14:
                hspan(sp, y, x0, x0 + w - 1, c_sh)

            # Delicate criss-crossing GOLDEN ANKLE VINES!
            if 0.72 <= t <= 0.88:
                vine_row = int(round((t - 0.72) * 28))
                if vine_row % 2 == 0:
                    sp.px(x0, y, GLD_HI if not is_far else GLD_MID)
                    sp.px(x0 + w - 1, y, GLD_MID if not is_far else GLD_SH)
                else:
                    sp.px(x0 + (w // 2), y, GLD_MID if not is_far else GLD_SH)

    _paint_leg(far_pts, is_far=True)
    _paint_leg(near_pts, is_far=False)


def draw_front_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Draped high-slit pearl-white celestial gossamer skirt panels + cascading golden hip vine chains."""
    sp.layer("front_skirt")

    for i in range(11):
        y = waist_y + i
        t = i / 10.0
        lx = cx - 5 - int(round(t * 3.5))
        rx = cx + 4 + int(round(t * 5.0))
        slit_l = cx - 2
        slit_r = cx + 2
        for x in range(lx, rx + 1):
            if i >= 5 and slit_l <= x <= slit_r:
                continue
            u = (x - lx) / max(1, rx - lx)
            if u < 0.28:
                col = PURE_WHT if i < 6 else SILK_HI
            elif u < 0.65:
                col = SILK_HI if (x + i) % 3 != 0 else SILK_MID
            else:
                col = SILK_MID if u < 0.86 else SILK_SH1
            sp.px(x, y, col)

    shift_l = -4 if pose == "strike" else (3 if pose == "hurt" else sway)
    front_panel = [
        (cx - 5, waist_y + 3),
        (cx - 8 + shift_l // 2, waist_y + 10),
        (cx - 11 + shift_l, waist_y + 17),
        (cx - 9 + shift_l, waist_y + 23),
        (cx - 6 + shift_l, waist_y + 26),
    ]
    draw_curve_stroke(
        sp, front_panel,
        thickness_fn=lambda t: 1.90 * (1.0 - t * 0.62),
        color_fn=lambda t, dx, dy: PURE_WHT if dx < 0 and t < 0.6 else (SILK_HI if dx <= 0 else SILK_MID),
        steps=26,
    )

    right_panel = [
        (cx + 4, waist_y + 4),
        (cx + 7, waist_y + 11),
        (cx + 10, waist_y + 19),
        (cx + 14, waist_y + 26),
    ]
    draw_curve_stroke(
        sp, right_panel,
        thickness_fn=lambda t: 2.10 * (1.0 - t * 0.58),
        color_fn=lambda t, dx, dy: PURE_WHT if dx < 0 and t < 0.45 else (SILK_HI if dx <= 0 else SILK_MID),
        steps=24,
    )

    for k in range(8):
        y = waist_y + 1 + k
        xl = cx - 4 - (k // 3)
        sp.px(xl, y, GLD_HI if k % 2 == 0 else GLD_MID)
        xr = cx + 3 + (k // 2)
        sp.px(xr, y, GLD_MID if k % 2 == 0 else GLD_SH)
        if k in (2, 5):
            sp.px(xr - 1, y, GLD_HI)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """Porcelain neck & bare goddess shoulders, sweetheart draped pearl-white celestial gossamer bodice,
    and true sculpted HOURGLASS GOLDEN VINE WAIST CORSET (faithful to fengshen_normal.png!)."""
    sp.layer("torso")

    for y in range(neck_y - 1, neck_y + 2):
        hspan(sp, y, cx - 2, cx + 1, SKIN_MID)
        sp.px(cx - 2, y, SKIN_HI)
        sp.px(cx + 1, y, SKIN_SH1)
    hspan(sp, neck_y - 1, cx - 2, cx + 1, SKIN_SH1)
    sp.px(cx + 1, neck_y - 1, SKIN_SH2)

    hspan(sp, neck_y + 2, cx - 5, cx + 4, SKIN_MID)
    hspan(sp, neck_y + 2, cx - 5, cx - 2, SKIN_HI)
    hspan(sp, neck_y + 2, cx + 2, cx + 4, SKIN_SH1)
    hspan(sp, neck_y + 3, cx - 2, cx + 1, SKIN_MID)
    sp.px(cx - 2, neck_y + 3, SKIN_HI)
    sp.px(cx - 2, neck_y + 2, GLD_HI)
    sp.px(cx - 1, neck_y + 2, GLD_MID)
    sp.px(cx, neck_y + 2, GLD_HI)
    sp.px(cx + 1, neck_y + 2, GLD_SH)
    sp.px(cx - 1, neck_y + 3, GLD_HI)

    bodice_shape = {
        3:  (-6, 5),
        4:  (-6, 5),
        5:  (-6, 5),
        6:  (-5, 5),
        7:  (-5, 4),
        8:  (-4, 4),
        9:  (-4, 3),
        10: (-3, 3),
        11: (-3, 3),
        12: (-4, 4),
        13: (-4, 4),
        14: (-5, 4),
    }

    for dy, (dl, dr) in bodice_shape.items():
        y = neck_y + dy
        for x in range(cx + dl, cx + dr + 1):
            if dy == 3 and cx - 2 <= x <= cx + 1:
                continue
            if x <= cx - 1:
                col = PURE_WHT if dy in (4, 5, 6) else SILK_HI
            elif x <= cx + 2:
                col = SILK_HI if (x + dy) % 2 == 0 else SILK_MID
            else:
                col = SILK_MID if x < cx + dr else SILK_SH1
            sp.px(x, y, col)

        if dy in (4, 5, 6, 7):
            fx = cx - 2 + (dy - 4)
            if cx + dl <= fx <= cx + dr:
                sp.px(fx, y, SILK_MID)
        if dy == 3:
            sp.px(cx - 5, y, GLD_HI)
            sp.px(cx + 4, y, GLD_MID)

    # Sculpted Hourglass Golden Vine Waist Corset
    sp.px(cx - 4, neck_y + 8, GLD_HI)
    sp.px(cx - 3, neck_y + 8, GLD_MID)
    sp.px(cx + 2, neck_y + 8, GLD_MID)
    sp.px(cx + 3, neck_y + 8, GLD_SH)
    sp.px(cx - 1, neck_y + 8, GLD_HI)

    for dy in (9, 10, 11, 12):
        dl, dr = bodice_shape[dy]
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, GLD_MID)
        sp.px(cx + dl, y, GLD_HI)
        sp.px(cx + dr, y, GLD_DK)
        sp.px(cx + dr - 1, y, GLD_SH)
        if dy == 9:
            sp.px(cx - 2, y, GLD_HI)
            sp.px(cx, y, SILK_HI)
            sp.px(cx + 1, y, GLD_MID)
        elif dy == 10:
            sp.px(cx - 1, y, GLD_HI)
            sp.px(cx + 1, y, GLD_SH)
        elif dy == 11:
            sp.px(cx - 2, y, GLD_HI)
            sp.px(cx - 1, y, SILK_HI)
            sp.px(cx, y, GLD_HI)
            sp.px(cx + 1, y, GLD_SH)
        elif dy == 12:
            sp.px(cx + dl, y, SILK_HI)
            sp.px(cx + dr, y, SILK_MID)
            sp.px(cx - 2, y, GLD_HI)
            sp.px(cx - 1, y, GLD_MID)
            sp.px(cx, y, GLD_HI)
            sp.px(cx + 1, y, GLD_SH)

    hspan(sp, neck_y + 13, cx - 2, cx + 1, GLD_MID)
    sp.px(cx - 1, neck_y + 13, GLD_HI)
    sp.px(cx + 1, neck_y + 13, GLD_SH)
    sp.px(cx - 1, neck_y + 14, GLD_HI)
    sp.px(cx, neck_y + 14, GLD_MID)


def draw_far_arm(sp: Sprite, cx: int, torso_y: int, pose: str, sway: int):
    """Far (left-screen / her right) graceful sculpted arm, golden vine armlet,
    and flowing translucent silk bell-sleeve draping cleanly downward-back (ZERO donut loop!)."""
    sp.layer("far_arm")

    sh_x, sh_y = cx - 5, torso_y + 1

    if pose == "windup":
        el_x, el_y = cx - 12, torso_y + 2
        hx, hy = cx - 17, torso_y - 5
    elif pose == "strike":
        el_x, el_y = cx - 8, torso_y + 7
        hx, hy = cx - 10, torso_y + 12
    elif pose == "hurt":
        el_x, el_y = cx - 9, torso_y + 6
        hx, hy = cx - 10, torso_y + 1
    else:
        el_x, el_y = cx - 9, torso_y + 5
        hx, hy = cx - 15, torso_y + 7 + (0 if pose != "idle2" else -1)

    # Smooth off-shoulder gossamer sleeve filled cleanly beneath upper arm (NO hollow armpit O-loop!)
    if pose == "windup":
        sp.polygon([
            (sh_x, sh_y + 1),
            (el_x - 1, el_y + 1),
            (el_x, el_y + 8),
            (sh_x + 1, sh_y + 11),
        ], SILK_HI, fill=True)
        sp.line(el_x, el_y + 2, el_x, el_y + 8, PURE_WHT)
        sp.line(sh_x, sh_y + 4, sh_x + 1, sh_y + 11, SILK_MID)
        # Trailing gossamer ribbon drifting softly down-right from elbow
        draw_curve_stroke(
            sp, [(el_x, el_y + 7), (el_x + 3, el_y + 12), (el_x + 6, el_y + 15)],
            thickness_fn=lambda t: 1.5 * (1.0 - t * 0.65),
            color_fn=lambda t, dx, dy: SILK_HI if dy <= 0 else SILK_MID,
            steps=16,
        )
    elif pose == "strike":
        sp.polygon([
            (sh_x, sh_y + 2),
            (el_x, el_y + 2),
            (el_x + 3, el_y + 8),
            (sh_x + 1, sh_y + 9),
        ], SILK_MID, fill=True)
    else:
        # Soft flowing sheer bell-sleeve triangle filled cleanly under forearm!
        sp.polygon([
            (sh_x, sh_y + 1),
            (el_x - 1, el_y + 1),
            (el_x + 1, el_y + 8 + sway // 2),
            (sh_x + 1, sh_y + 10),
        ], SILK_HI, fill=True)
        sp.line(el_x - 1, el_y + 2, el_x + 1, el_y + 8 + sway // 2, PURE_WHT)
        sp.line(sh_x, sh_y + 3, sh_x + 1, sh_y + 10, SILK_MID)
        # Delicate fluttering ribbon tail drifting gracefully outward-down-left
        draw_curve_stroke(
            sp, [(el_x, el_y + 6), (el_x - 2, el_y + 11 + sway), (el_x + 1, el_y + 14 + sway)],
            thickness_fn=lambda t: 1.45 * (1.0 - t * 0.65),
            color_fn=lambda t, dx, dy: SILK_HI if dx <= 0 else SILK_MID,
            steps=16,
        )

    # Sculpted porcelain arm
    draw_curve_stroke(
        sp, [(sh_x, sh_y), (el_x, el_y), (hx, hy)],
        thickness_fn=lambda t: 1.35 if t < 0.52 else 1.05,
        color_fn=lambda t, dx, dy: SKIN_HI if dy < 0 else (SKIN_MID if dy == 0 else SKIN_SH1),
        steps=20,
    )

    # Golden vine upper-arm band & wrist vine
    sp.px(sh_x - 1, sh_y + 1, GLD_HI)
    sp.px(sh_x - 1, sh_y + 2, GLD_MID)
    wx = int(round(hx + (el_x - hx) * 0.25))
    wy = int(round(hy + (el_y - hy) * 0.25))
    sp.px(wx, wy, GLD_HI)
    sp.px(wx, wy + 1, GLD_SH)

    # Expressive slender hand
    sp.px(hx, hy, SKIN_HI)
    sp.px(hx - 1, hy, SKIN_HI if pose == "windup" else SKIN_MID)
    sp.px(hx, hy + 1, SKIN_SH1)
    if pose == "windup":
        sp.px(hx - 1, hy - 1, SKIN_HI)
        sp.px(hx - 2, hy - 1, SKIN_MID)
    elif pose in ("idle1", "idle2", "blink"):
        sp.px(hx - 2, hy, SKIN_MID)
        sp.px(hx - 1, hy + 1, SKIN_SH1)

    return hx, hy


def draw_near_arm(sp: Sprite, cx: int, torso_y: int, pose: str, sway: int):
    """Near (right-screen / her left) iconic gracefully extended arm with golden vine armlet,
    billowing pearl-white gossamer sleeve & flowing S-curved silk arm ribbon streaming into open air!"""
    sp.layer("near_arm")

    sh_x, sh_y = cx + 4, torso_y + 1

    if pose == "windup":
        el_x, el_y = cx + 11, torso_y + 2
        hx, hy = cx + 17, torso_y - 5
    elif pose == "strike":
        el_x, el_y = cx - 4, torso_y + 5
        hx, hy = cx - 16, torso_y + 2
    elif pose == "hurt":
        el_x, el_y = cx + 10, torso_y + 4
        hx, hy = cx + 16, torso_y + 1
    else:
        el_x, el_y = cx + 9, torso_y + 6
        hx, hy = cx + 15, torso_y + 12 + (0 if pose != "idle2" else -1)

    # Lush billowing pearl-white silk sleeve & trailing arm ribbon streaming cleanly into open air!
    if pose == "strike":
        rib = [
            (sh_x, sh_y + 2),
            (cx + 4, torso_y + 7),
            (cx + 13, torso_y + 9),
            (cx + 22, torso_y + 6),
        ]
    elif pose == "windup":
        rib = [
            (sh_x + 1, sh_y + 2),
            (el_x + 1, el_y + 6),
            (el_x + 6, el_y + 11),
            (min(W - 3, el_x + 13), el_y + 13),
        ]
    else:
        # Sweeps gracefully outward-right in a luminous free-floating S-wave cleanly separated from hair & skirt!
        rib = [
            (sh_x + 1, sh_y + 1),
            (el_x + 2, el_y + 3),
            (hx + 2, hy + 2),
            (min(W - 3, hx + 8), hy + 3 + sway),
            (min(W - 3, hx + 14), hy - 1 + sway),
        ]
    draw_curve_stroke(
        sp, rib,
        thickness_fn=lambda t: 2.35 * (1.0 - t * 0.65),
        color_fn=lambda t, dx, dy: PURE_WHT if dy < 0 and t < 0.55 else (SILK_HI if dy <= 0 else SILK_MID),
        steps=28,
    )

    draw_curve_stroke(
        sp, [(sh_x, sh_y), (el_x, el_y), (hx, hy)],
        thickness_fn=lambda t: 1.35 if t < 0.50 else 1.05,
        color_fn=lambda t, dx, dy: SKIN_HI if (dy < 0 or dx < 0) else (SKIN_MID if dy == 0 else SKIN_SH1),
        steps=20,
    )

    ax = int(round(sh_x + (el_x - sh_x) * 0.35))
    ay = int(round(sh_y + (el_y - sh_y) * 0.35))
    sp.px(ax, ay, GLD_HI)
    sp.px(ax, ay + 1, GLD_MID)

    wx = int(round(hx + (el_x - hx) * 0.25))
    wy = int(round(hy + (el_y - hy) * 0.25))
    sp.px(wx, wy, GLD_HI)
    sp.px(wx, wy + 1, GLD_SH)

    sp.px(hx, hy, SKIN_HI)
    if pose == "strike":
        sp.px(hx - 1, hy - 1, SKIN_HI)
        sp.px(hx - 2, hy - 1, SKIN_MID)
        sp.px(hx - 1, hy, SKIN_HI)
        sp.px(hx - 2, hy, SKIN_MID)
        sp.px(hx - 1, hy + 1, SKIN_SH1)
        sp.px(hx, hy + 1, SKIN_SH1)
    elif pose == "windup":
        sp.px(hx + 1, hy - 1, SKIN_HI)
        sp.px(hx + 2, hy - 1, SKIN_MID)
        sp.px(hx + 1, hy, SKIN_MID)
        sp.px(hx, hy + 1, SKIN_SH1)
    else:
        sp.px(hx + 1, hy, SKIN_MID)
        sp.px(hx + 2, hy + 1, SKIN_MID)
        sp.px(hx + 1, hy + 1, SKIN_SH1)
        sp.px(hx, hy + 1, SKIN_SH1)

    return hx, hy


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Jewelry-polished 3/4 anime goddess head facing LEFT, luminous faceted pale jade-cyan eyes,
    liquid-silk pale mint-silver crown & airy feathery bangs, and golden floral laurel + white blossoms!"""
    sp.layer("head")

    # 1) Smooth tapered warm porcelain goddess face (facing LEFT!)
    face_rows = {
        8:  (-6, 6),
        9:  (-7, 7),
        10: (-8, 7),
        11: (-8, 7),
        12: (-8, 7),
        13: (-8, 7),
        14: (-8, 7),
        15: (-8, 7),
        16: (-8, 7),
        17: (-8, 7),
        18: (-8, 6),
        19: (-7, 6),
        20: (-7, 5),
        21: (-6, 4),
        22: (-5, 3),
        23: (-4, 1),
        24: (-3, -1),
    }
    for dy, (dl, dr) in face_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, SKIN_MID)
        if 12 <= dy <= 21:
            hi_r = min(cx + dr - 2, cx - 1)
            if hi_r >= cx + dl + 1:
                hspan(sp, y, cx + dl + 1, hi_r, SKIN_HI)
        if 12 <= dy <= 22:
            sp.px(cx + dr, y, SKIN_SH1)
        if dy == 23:
            sp.px(cx + dl, y, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)
        if dy == 24:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    # 2) JEWELRY-GRADE TRANSCENDENT PALE JADE-CYAN DIVINE ANIME EYES (facing LEFT!)
    ey = head_y + 14
    fx0 = cx - 7  # far eye:  4 x 5
    nx0 = cx - 1  # near eye: 5 x 5

    if pose == "blink":
        # Serene graceful closed eyes
        sp.px(fx0 - 1, ey + 2, INK_DARK)
        hspan(sp, ey + 3, fx0, fx0 + 3, INK_DARK)
        hspan(sp, ey + 4, fx0 + 1, fx0 + 2, SKIN_SH1)

        hspan(sp, ey + 3, nx0, nx0 + 3, INK_DARK)
        sp.px(nx0 + 4, ey + 2, INK_DARK)
        hspan(sp, ey + 4, nx0 + 1, nx0 + 3, SKIN_SH1)

    elif pose == "hurt":
        # Clean startled divine wince (> <)
        sp.px(fx0, ey + 1, INK_DARK)
        sp.px(fx0 + 1, ey + 2, INK_DARK)
        sp.px(fx0 + 2, ey + 3, INK_DARK)
        sp.px(fx0 + 1, ey + 4, INK_DARK)
        sp.px(fx0, ey + 4, INK_DARK)

        sp.px(nx0 + 4, ey + 1, INK_DARK)
        sp.px(nx0 + 3, ey + 2, INK_DARK)
        sp.px(nx0 + 2, ey + 2, INK_DARK)
        sp.px(nx0 + 1, ey + 3, INK_DARK)
        sp.px(nx0 + 2, ey + 4, INK_DARK)
        sp.px(nx0 + 3, ey + 4, INK_DARK)

    else:
        awakened = pose in ("windup", "strike")

        # --- FAR EYE (4x5 faceted pale jade-cyan gem!) ---
        sp.px(fx0 - 1, ey + 1, INK_DARK)
        if pose == "strike":
            hspan(sp, ey, fx0, fx0 + 2, INK_DARK)
            sp.px(fx0 + 3, ey + 1, INK_DARK)
        elif pose == "windup":
            # Regal arched awakening upper lash (serene divine power, NOT startled!)
            sp.px(fx0, ey, INK_MID)
            hspan(sp, ey, fx0 + 1, fx0 + 3, INK_DARK)
            sp.px(fx0 + 1, ey - 1, INK_MID)
            sp.px(fx0 + 2, ey - 1, INK_MID)
        else:
            hspan(sp, ey, fx0, fx0 + 3, INK_DARK)

        # Row +1: soft upper sclera + SINGLE razor-crisp PURE_WHT catchlight + rich jade upper iris!
        sp.px(fx0, ey + 1, SILK_HI if not awakened else PURE_WHT)
        sp.px(fx0 + 1, ey + 1, PURE_WHT)   # single-pixel pure catchlight!
        sp.px(fx0 + 2, ey + 1, EYE_DK if not awakened else WIND_MID)
        sp.px(fx0 + 3, ey + 1, EYE_DK)

        # Row +2: soulful deep jade pupil + vivid pale jade-cyan iris glow!
        sp.px(fx0, ey + 2, PURE_WHT)
        sp.px(fx0 + 1, ey + 2, WIND_MID if not awakened else WIND_HI)
        sp.px(fx0 + 2, ey + 2, EYE_DK)
        sp.px(fx0 + 3, ey + 2, WIND_SH if not awakened else WIND_MID)

        # Row +3: luminous aquamarine lower crescent
        sp.px(fx0, ey + 3, SKIN_MID)
        sp.px(fx0 + 1, ey + 3, WIND_HI)
        sp.px(fx0 + 2, ey + 3, PURE_WHT if awakened else WIND_HI)
        sp.px(fx0 + 3, ey + 3, WIND_MID if not awakened else WIND_HI)

        # Row +4: delicate lower lash contour
        hspan(sp, ey + 4, fx0 + 1, fx0 + 3, HAIR_SH2)

        # --- NEAR EYE (5x5 transcendent almond jade-cyan gem!) ---
        if pose == "strike":
            sp.px(nx0, ey + 1, INK_DARK)
            hspan(sp, ey, nx0 + 1, nx0 + 4, INK_DARK)
        elif pose == "windup":
            # Regal awakening storm-eye lash!
            hspan(sp, ey, nx0, nx0 + 4, INK_DARK)
            sp.px(nx0 + 1, ey - 1, INK_MID)
            sp.px(nx0 + 2, ey - 1, INK_MID)
            sp.px(nx0 + 3, ey - 1, INK_MID)
        else:
            hspan(sp, ey, nx0, nx0 + 4, INK_DARK)
        sp.px(nx0 + 5, ey + 1, INK_DARK)  # graceful outer-right lash wing!

        # Row +1: subtle shaded sclera + SINGLE razor-crisp PURE_WHT catchlight + rich jade iris!
        sp.px(nx0, ey + 1, SILK_HI if not awakened else PURE_WHT)
        sp.px(nx0 + 1, ey + 1, PURE_WHT)  # single-pixel crisp star catchlight!
        sp.px(nx0 + 2, ey + 1, EYE_DK if not awakened else WIND_MID)
        sp.px(nx0 + 3, ey + 1, WIND_SH if not awakened else WIND_MID)
        sp.px(nx0 + 4, ey + 1, SILK_HI if not awakened else PURE_WHT)

        # Row +2: soulful dark sea-jade pupil + glowing emerald-cyan iris body!
        sp.px(nx0, ey + 2, PURE_WHT)
        sp.px(nx0 + 1, ey + 2, WIND_MID if not awakened else WIND_HI)
        sp.px(nx0 + 2, ey + 2, INK_DARK if not awakened else EYE_DK)
        sp.px(nx0 + 3, ey + 2, WIND_MID if not awakened else WIND_HI)
        sp.px(nx0 + 4, ey + 2, PURE_WHT)

        # Row +3: luminous aquamarine lower crescent + secondary crystal sparkle
        sp.px(nx0, ey + 3, SKIN_MID)
        sp.px(nx0 + 1, ey + 3, WIND_HI)
        sp.px(nx0 + 2, ey + 3, PURE_WHT if awakened else WIND_HI)
        sp.px(nx0 + 3, ey + 3, PURE_WHT)
        sp.px(nx0 + 4, ey + 3, SKIN_MID)

        # Row +4: delicate lower lid contour
        hspan(sp, ey + 4, nx0 + 1, nx0 + 3, HAIR_SH2)

    # 3) Delicate ethereal rosy cheek blush
    hspan(sp, ey + 4, fx0 - 1, fx0, BLUSH)
    hspan(sp, ey + 4, nx0 + 3, nx0 + 4, BLUSH)

    # 4) Serene transcendent anime mouth
    my = head_y + 21
    mx = cx - 2
    if pose == "strike":
        sp.px(mx - 1, my, INK_SKIN)
        sp.px(mx, my, INK_SKIN)
        sp.px(mx - 1, my + 1, BLUSH)
        sp.px(mx, my + 1, BLUSH)
    elif pose == "hurt":
        sp.px(mx - 1, my + 1, INK_SKIN)
        sp.px(mx, my, INK_SKIN)
        sp.px(mx + 1, my + 1, INK_SKIN)
        sp.px(mx, my + 1, BLUSH)
    elif pose == "windup":
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx, my, BLUSH)
    else:
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx, my, SKIN_SH2)

    # 5) LUMINOUS PALE MINT-SILVER HAIR CROWN & AIRY FEATHERY BANGS!
    crown_rows = {
        0:  (-4, 4),
        1:  (-7, 7),
        2:  (-9, 9),
        3:  (-10, 10),
        4:  (-11, 11),
        5:  (-11, 12),
        6:  (-12, 12),
        7:  (-12, 12),
        8:  (-12, 12),
        9:  (-12, 12),
        10: (-11, 12),
    }
    for dy, (dl, dr) in crown_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, HAIR_MID)

        if 1 <= dy <= 4:
            hi_l = cx + max(dl + 1, -9)
            hi_r = cx + min(dr - 3, 4)
            if hi_r >= hi_l:
                hspan(sp, y, hi_l, hi_r, HAIR_HI)

        # Ethereal angel-ring highlight curving smoothly across crown!
        if dy == 5:
            hspan(sp, y, cx - 9, cx - 5, HAIR_HI)
            hspan(sp, y, cx - 3, cx + 2, HAIR_HI)
            hspan(sp, y, cx + 4, cx + 8, HAIR_HI)
            sp.px(cx - 7, y, PURE_WHT)
            sp.px(cx - 1, y, PURE_WHT)
            sp.px(cx + 6, y, PURE_WHT)
        elif dy == 6:
            hspan(sp, y, cx - 10, cx - 7, HAIR_HI)
            hspan(sp, y, cx - 4, cx - 1, HAIR_HI)
            hspan(sp, y, cx + 5, cx + 9, HAIR_HI)
            sp.px(cx - 8, y, PURE_WHT)
            sp.px(cx - 2, y, PURE_WHT)
        elif dy == 7:
            hspan(sp, y, cx - 10, cx - 8, HAIR_HI)
            sp.px(cx - 4, y, HAIR_HI)
            sp.px(cx + 7, y, HAIR_HI)

        if dr >= 8:
            hspan(sp, y, cx + dr - 2, cx + dr, HAIR_SH1)
            if dy >= 4:
                sp.px(cx + dr, y, HAIR_SH2)

    for dy in (1, 2, 3):
        sp.px(cx - 2, head_y + dy, HAIR_SH1)
    for (sx, sy0, sy1, dx_step) in [
        (cx - 6, 7, 10, -0.3),
        (cx - 2, 7, 10, -0.1),
        (cx + 3, 7, 10,  0.25),
        (cx + 7, 6, 10,  0.25),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, HAIR_SH1)

    for x in (cx - 6, cx - 5, cx + 0, cx + 1, cx + 2):
        sp.px(x, head_y + 10, SKIN_MID)
    for x in (cx - 6, cx + 1):
        sp.px(x, head_y + 11, SKIN_HI)

    for dy, (dl, dr) in [
        (10, (-4, -2)), (11, (-4, -2)), (12, (-3, -2)),
        (13, (-3, -2)), (14, (-3, -2)), (15, (-2, -2)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy < 14 else HAIR_SH1)
        if dy <= 13:
            sp.px(cx + dl, head_y + dy, HAIR_HI)

    for dy, (dl, dr) in [(10, (-10, -7)), (11, (-10, -8)), (12, (-10, -8)), (13, (-9, -9))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID)
        sp.px(cx + dl, head_y + dy, HAIR_HI)

    for dy, (dl, dr) in [(10, (4, 8)), (11, (5, 9)), (12, (6, 9)), (13, (6, 8))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy < 12 else HAIR_SH1)
        sp.px(cx + dl, head_y + dy, HAIR_HI if dy < 12 else HAIR_MID)

    # 6) EXPRESSIVE DELICATE SEA-PINE EYEBROWS (clean gap above lashes, even in windup!)
    brow_y = ey - 2
    if pose == "strike":
        sp.px(fx0, brow_y - 1, HAIR_SH2)
        sp.px(fx0 + 1, brow_y, INK_MID)
        sp.px(fx0 + 2, brow_y, INK_MID)

        sp.px(nx0 + 1, brow_y, INK_MID)
        sp.px(nx0 + 2, brow_y, INK_MID)
        sp.px(nx0 + 3, brow_y - 1, HAIR_SH2)
        sp.px(nx0 + 4, brow_y - 1, HAIR_SH2)
    elif pose == "windup":
        hspan(sp, brow_y - 1, fx0, fx0 + 2, HAIR_SH2)
        hspan(sp, brow_y - 1, nx0 + 1, nx0 + 3, HAIR_SH2)
    elif pose == "hurt":
        sp.px(fx0, brow_y + 1, HAIR_SH2)
        sp.px(fx0 + 1, brow_y, INK_MID)
        sp.px(fx0 + 2, brow_y - 1, HAIR_SH2)
        sp.px(nx0 + 1, brow_y - 1, HAIR_SH2)
        sp.px(nx0 + 2, brow_y, INK_MID)
        sp.px(nx0 + 3, brow_y + 1, HAIR_SH2)
    else:
        hspan(sp, brow_y, fx0, fx0 + 2, HAIR_SH2)
        hspan(sp, brow_y, nx0 + 1, nx0 + 3, HAIR_SH2)

    # 7) FACE-FRAMING WIND-CAUGHT FRONT MINT-SILVER LOCKS!
    for i in range(21):
        y = head_y + 11 + i
        t = i / 20.0
        drift = int(round(t * 4.5 + math.sin(t * 2.8) * 1.3)) + (2 if pose in ("strike", "hurt") else 0)
        rx = cx + 7 + drift
        w = 4 if i < 6 else (3 if i < 13 else (2 if i < 18 else 1))
        hspan(sp, y, rx, rx + w - 1, HAIR_MID)
        sp.px(rx, y, HAIR_HI if i < 14 else HAIR_MID)
        if w >= 3:
            sp.px(rx + w - 1, y, HAIR_SH1)
        if w >= 4:
            sp.px(rx + w - 1, y, HAIR_SH2)

    for i in range(15):
        y = head_y + 11 + i
        t = i / 14.0
        lx = cx - 10 - int(round(math.sin(t * 2.5) * 1.0)) + (1 if i >= 11 else 0)
        w = 3 if i < 5 else (2 if i < 11 else 1)
        hspan(sp, y, lx, lx + w - 1, HAIR_MID if i < 9 else HAIR_SH1)
        sp.px(lx, y, HAIR_HI if i < 8 else HAIR_MID)

    # 8) JEWELRY-GRADE GOLDEN FLORAL LAUREL & LUMINOUS WHITE LILY BLOSSOMS CROWN!
    laurel_arc = [
        (-7, 3), (-6, 2), (-5, 2), (-4, 1), (-3, 1), (-2, 0), (-1, 0),
        (0, 0), (1, 0), (2, 0), (3, 1), (4, 1), (5, 1), (6, 2), (7, 2),
        (8, 3), (9, 4), (10, 5),
    ]
    for dx_l, dy_l in laurel_arc:
        sp.px(cx + dx_l, head_y + dy_l, GLD_MID)
        sp.px(cx + dx_l, head_y + dy_l + 1, GLD_SH)
    for dx_l, dy_l in [(-6, 2), (-3, 1), (-1, 0), (1, 0), (4, 1), (7, 2), (9, 4)]:
        sp.px(cx + dx_l, head_y + dy_l, GLD_HI)

    # Sculpted winged golden laurel leaf clusters
    sp.px(cx + 5, head_y - 1, GLD_MID)
    sp.px(cx + 6, head_y - 1, GLD_HI)
    sp.px(cx + 7, head_y - 2, GLD_HI)
    sp.px(cx + 6, head_y, GLD_MID)
    sp.px(cx + 7, head_y - 1, GLD_MID)

    sp.px(cx + 9, head_y + 1, GLD_MID)
    sp.px(cx + 10, head_y + 1, GLD_HI)
    sp.px(cx + 11, head_y, GLD_HI)
    sp.px(cx + 10, head_y + 2, GLD_MID)
    sp.px(cx + 11, head_y + 1, GLD_SH)

    sp.px(cx - 6, head_y + 1, GLD_HI)
    sp.px(cx - 7, head_y + 1, GLD_MID)

    # 3 Sculpted Luminous White Celestial Lily Blossoms with Gleaming Golden Stamens!
    def _draw_blossom(bx: int, by: int, large: bool = True):
        if large:
            sp.px(bx, by - 2, PURE_WHT)
            sp.px(bx - 1, by - 1, PURE_WHT)
            sp.px(bx, by - 1, SILK_HI)
            sp.px(bx + 1, by - 1, PURE_WHT)
            sp.px(bx - 2, by, PURE_WHT)
            sp.px(bx - 1, by, SILK_HI)
            sp.px(bx, by, GLD_HI)
            sp.px(bx + 1, by, SILK_HI)
            sp.px(bx + 2, by, PURE_WHT)
            sp.px(bx - 1, by + 1, PURE_WHT)
            sp.px(bx, by + 1, GLD_MID)
            sp.px(bx + 1, by + 1, SILK_HI)
        else:
            sp.px(bx, by - 1, PURE_WHT)
            sp.px(bx - 1, by, PURE_WHT)
            sp.px(bx, by, GLD_HI)
            sp.px(bx + 1, by, PURE_WHT)
            sp.px(bx, by + 1, SILK_HI)

    _draw_blossom(cx + 2, head_y - 1, large=True)
    _draw_blossom(cx - 4, head_y + 1, large=False)
    _draw_blossom(cx + 8, head_y + 2, large=False)


def draw_tempest_fx(sp: Sprite, cx: int, head_y: int, waist_y: int, pose: str, sway: int,
                    far_hand: tuple[int, int], near_hand: tuple[int, int]):
    """Silky smooth 3D orbital silver-cyan tempest wind ribbons, organic levitation breeze swirl,
    sparkling air-blade crescents, and FREE-SURGING TWIN RAZOR VACUUM-BLADE GALE CRESCENTS!"""

    def _draw_air_crescent(layer: str, x: int, y: int, flip_dir: int = -1, bright: bool = True):
        """Crisp 4-connected curving air-blade crescent."""
        sp.layer(layer)
        c1 = PURE_WHT if bright else WIND_HI
        c2 = WIND_HI if bright else WIND_MID
        c3 = WIND_MID if bright else WIND_SH
        sp.px(x, y - 2, c3)
        sp.px(x, y - 1, c3)
        sp.px(x + flip_dir, y - 1, c2)
        sp.px(x + flip_dir, y, c1)
        sp.px(x + 2 * flip_dir, y, c2)
        sp.px(x + flip_dir, y + 1, c2)
        sp.px(x, y + 1, c3)
        sp.px(x, y + 2, c3)

    def _draw_petal(layer: str, x: int, y: int):
        """Crisp 3px fluttering white blossom petal caught in the storm wind!"""
        sp.layer(layer)
        sp.px(x, y, PURE_WHT)
        sp.px(x + 1, y, SILK_HI)
        sp.px(x + 1, y + 1, SILK_MID)

    def _draw_levitation_breeze(ocx: int, width_r: int, phase_shift: int, bright: bool = False):
        """Organic open crescent breeze swirl floating just above GROUND_Y=82 (NO flat pill/comb!)."""
        sp.layer("back_fx")
        y_base = GROUND_Y - 1
        # Crisp tapering open crescent arc curving gracefully under her hovering toes
        for dx in range(-width_r, width_r + 1):
            u = dx / max(1, width_r)
            curve_y = y_base - int(round((u * u) * 1.4))
            px_x = ocx + dx + phase_shift
            if abs(u) < 0.45:
                col = PURE_WHT if bright else WIND_HI
            elif abs(u) < 0.78:
                col = WIND_HI if bright else WIND_MID
            else:
                col = WIND_MID if bright else WIND_SH
            sp.px(px_x, curve_y, col)
            if abs(u) < 0.55:
                sp.px(px_x, curve_y + 1, WIND_MID if bright else WIND_SH)
        # Subtle secondary tiny trailing breeze wisp off the right tip (3px connected!)
        tx = ocx + width_r + 2 + phase_shift
        sp.px(tx, y_base - 2, WIND_HI if bright else WIND_MID)
        sp.px(tx + 1, y_base - 2, WIND_MID if bright else WIND_SH)
        sp.px(tx + 1, y_base - 3, WIND_SH)

    if pose in ("idle1", "idle2", "blink"):
        phase = 0 if pose == "idle1" else (2 if pose == "idle2" else 1)

        # 1) Silky smooth 3D tilted elliptical tempest ribbon orbiting effortlessly around her!
        draw_orbital_wind_ring(
            sp,
            ocx=cx + 1,
            ocy=waist_y + 10 - phase,
            rx=25.0,
            ry=9.5,
            tilt_deg=-14.0,
            t_start=-0.35 * math.pi,
            t_end=1.35 * math.pi,
            thick_front=1.30,
            thick_back=0.80,
            bright=False,
            steps=76,
        )

        # 2) Organic tapering levitation breeze swirl cleanly beneath hovering toes!
        _draw_levitation_breeze(cx - 1, width_r=9 + (phase // 2), phase_shift=phase // 2, bright=False)

        # 3) Delicate swirling wind curl rising smoothly from her poised forward-left hand!
        sp.layer("fx")
        fx_h, fy_h = far_hand
        hand_curl = [
            (fx_h - 2, fy_h + 1),
            (fx_h - 6, fy_h - 2 - (phase // 2)),
            (fx_h - 5, fy_h - 7 - (phase // 2)),
            (fx_h - 1, fy_h - 9 - (phase // 2)),
        ]
        draw_curve_stroke(
            sp, hand_curl,
            thickness_fn=lambda t: 0.90 * (1.0 - t * 0.45),
            color_fn=lambda t, dx, dy: PURE_WHT if t < 0.40 else (WIND_HI if t < 0.72 else WIND_MID),
            steps=20,
        )

        _draw_air_crescent("fx", cx - 22, head_y + 18 - phase, flip_dir=-1, bright=True)
        _draw_petal("fx", cx - 18, head_y + 6 + phase)
        _draw_petal("back_fx", cx + 25, head_y + 33 - phase)

        return (fx_h - 6, fy_h - 3)

    elif pose == "windup":
        # MAJESTIC AWAKENING: Two smoothly interlocking 3D swirling emerald-cyan storm rings!
        draw_orbital_wind_ring(
            sp,
            ocx=cx,
            ocy=waist_y + 9,
            rx=28.0,
            ry=10.5,
            tilt_deg=-16.0,
            t_start=0.0,
            t_end=2.0 * math.pi,
            thick_front=1.55,
            thick_back=0.95,
            bright=True,
            steps=88,
        )
        draw_orbital_wind_ring(
            sp,
            ocx=cx,
            ocy=head_y + 24,
            rx=27.0,
            ry=9.5,
            tilt_deg=17.0,
            t_start=-0.85 * math.pi,
            t_end=0.85 * math.pi,
            thick_front=1.35,
            thick_back=0.90,
            bright=True,
            steps=80,
        )

        # Radiant levitation updraft crescent cleanly beneath her rising toes (NO flat pill!)
        _draw_levitation_breeze(cx, width_r=12, phase_shift=0, bright=True)

        # Radiant 4-point storm star bursts above BOTH upturned summoning palms!
        sp.layer("fx")
        for hx_s, hy_s in (far_hand, near_hand):
            sx = max(5, min(W - 6, hx_s + (-2 if hx_s < cx else 2)))
            sy = max(5, hy_s - 4)
            sp.px(sx, sy, PURE_WHT)
            for d in (1, 2, 3):
                c = PURE_WHT if d == 1 else (WIND_HI if d == 2 else WIND_MID)
                sp.px(sx + d, sy, c)
                sp.px(sx - d, sy, c)
                sp.px(sx, sy + d, c)
                sp.px(sx, sy - d, c)
            for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                sp.px(sx + ddx, sy + ddy, WIND_HI)

        _draw_air_crescent("fx", cx - 28, head_y + 11, flip_dir=-1, bright=True)
        _draw_air_crescent("fx", cx + 27, waist_y + 17, flip_dir=1, bright=True)
        _draw_petal("fx", cx - 17, head_y + 2)
        _draw_petal("fx", cx + 21, head_y + 7)

        return (far_hand[0] - 2, far_hand[1] - 4)

    elif pose == "strike":
        # BREATHTAKING FREE-SURGING TWIN RAZOR VACUUM-BLADE GALE CRESCENTS (ZERO bow-and-arrow look!)
        sp.layer("back_fx")
        # Trailing tempest slipstream whipping back-right behind her surging body
        wake = [
            (cx + 5, waist_y + 6),
            (cx + 20, waist_y + 1),
            (min(W - 3, cx + 33), waist_y - 7),
        ]
        draw_curve_stroke(
            sp, wake,
            thickness_fn=lambda t: 1.55 * (1.0 - t * 0.55),
            color_fn=lambda t, dx, dy: WIND_HI if dy <= 0 else WIND_SH,
            steps=26,
        )

        # Subtle ground breeze wake rushing back-right beneath her lunging toes!
        _draw_levitation_breeze(cx + 2, width_r=9, phase_shift=1, bright=False)

        sp.layer("fx")
        nhx, nhy = near_hand

        # 1) HERO OUTER RAZOR VACUUM-BLADE SCYTHE (free-floating surging crescent at x = 3..21, y = 16..68!)
        razor_outer = [
            (21, 16),
            (11, 24),
            (4,  36),
            (3,  48),
            (9,  59),
            (19, 68),
        ]
        draw_curve_stroke(
            sp, razor_outer,
            thickness_fn=lambda t: 3.15 * (math.sin(t * math.pi) ** 0.85) + 0.40,
            color_fn=lambda t, dx, dy: (
                PURE_WHT if (dx <= 0 and 0.12 < t < 0.88) else
                (WIND_HI if dx <= 1 else (WIND_MID if dx <= 2 else WIND_SH))
            ),
            steps=52,
        )

        # 2) ECHOING INNER TWIN RAZOR-WIND CRESCENT (parallel surging tempest wave behind main blade!)
        razor_inner = [
            (24, 24),
            (16, 32),
            (12, 42),
            (14, 52),
            (21, 60),
        ]
        draw_curve_stroke(
            sp, razor_inner,
            thickness_fn=lambda t: 1.85 * (math.sin(t * math.pi) ** 0.85) + 0.35,
            color_fn=lambda t, dx, dy: (
                PURE_WHT if (dx < 0 and 0.25 < t < 0.75) else
                (WIND_HI if dx <= 0 else (WIND_MID if dx <= 1 else WIND_SH))
            ),
            steps=36,
        )

        # 3) SINGLE FLUID HAND-SWEEP SLIPSTREAM spiraling gracefully from her sweeping palm
        #    outward-left & curling cleanly beneath the blade sweep (pure hand-wave gesture, ZERO bowstrings!)
        palm_sweep = [
            (nhx - 2, nhy),
            (nhx - 8, nhy + 3),
            (17, 50),
            (25, 56),
        ]
        draw_curve_stroke(
            sp, palm_sweep,
            thickness_fn=lambda t: 1.45 * (1.0 - t * 0.55),
            color_fn=lambda t, dx, dy: PURE_WHT if t < 0.35 else (WIND_HI if dy <= 0 else WIND_MID),
            steps=24,
        )

        # Crisp luminous palm release burst at her outstretched left fingertips!
        sp.px(nhx - 3, nhy, PURE_WHT)
        sp.px(nhx - 4, nhy, PURE_WHT)
        sp.px(nhx - 3, nhy - 1, WIND_HI)
        sp.px(nhx - 3, nhy + 1, WIND_HI)
        sp.px(nhx - 5, nhy, WIND_HI)

        # 4) Sparkling orbital air-blade crescents & wind-swept white petals!
        _draw_air_crescent("fx", 9, 18, flip_dir=-1, bright=True)
        _draw_air_crescent("fx", 11, 65, flip_dir=-1, bright=True)
        _draw_petal("fx", 28, 17)
        _draw_petal("fx", 27, 62)

        return (6, nhy)

    else:
        # HURT: Shattered smooth tempest arc fragments & wind-tossed white petals!
        sp.layer("back_fx")
        frac1 = [
            (cx + 12, waist_y + 14),
            (cx + 22, waist_y + 9),
            (min(W - 4, cx + 29), waist_y + 12),
        ]
        draw_curve_stroke(
            sp, frac1,
            thickness_fn=lambda t: 1.15 * (1.0 - t * 0.55),
            color_fn=lambda t, dx, dy: WIND_MID if dy <= 0 else WIND_SH,
            steps=20,
        )
        sp.layer("fx")
        frac2 = [
            (cx - 22, waist_y + 6),
            (cx - 15, waist_y + 12),
            (cx - 8, waist_y + 15),
        ]
        draw_curve_stroke(
            sp, frac2,
            thickness_fn=lambda t: 1.05 * (1.0 - t * 0.50),
            color_fn=lambda t, dx, dy: WIND_HI if t < 0.5 else WIND_MID,
            steps=18,
        )
        _draw_petal("fx", cx - 19, head_y + 10)
        _draw_petal("fx", cx + 22, head_y + 20)
        _draw_air_crescent("fx", cx - 18, waist_y + 22, flip_dir=-1, bright=False)
        return (cx - 18, waist_y)


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------
FRAME_SPECS = [
    ("idle1",   0,  0,  0, 280),
    ("idle2",   0, -1,  1, 280),
    ("blink",   0,  0,  0, 150),
    ("windup",  2, -1,  1, 190),
    ("strike", -4,  0,  2, 170),
    ("hurt",    3,  1, -1, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "back_fx",
        "back_hair",
        "back_skirt",
        "far_arm",
        "legs",
        "front_skirt",
        "torso",
        "head",
        "near_arm",
        "fx",
    ]
    sp.frames[0].cels = {ln: sp._blank() for ln in sp.layer_order}

    for _ in range(1, N_FRAMES):
        sp.add_frame(copy=False)

    anchors = {}

    for idx, (pose, dx, hover_dy, sway, dur) in enumerate(FRAME_SPECS, start=1):
        sp.frame(idx)
        sp.set_duration(dur)

        cx = PIVOT_X + dx
        head_y = 10 + hover_dy
        neck_y = head_y + 25
        torso_y = neck_y + 2
        waist_y = neck_y + 14
        hip_y = waist_y + 1
        toe_y = 77 + hover_dy

        draw_back_hair(sp, cx, head_y, pose, sway)
        draw_back_skirt(sp, cx, waist_y, pose, sway)
        far_hand = draw_far_arm(sp, cx, torso_y, pose, sway)
        draw_legs(sp, cx, hip_y, toe_y, pose)
        draw_front_skirt(sp, cx, waist_y, pose, sway)
        draw_torso(sp, cx, neck_y, pose)
        draw_head(sp, cx, head_y, pose, sway)
        near_hand = draw_near_arm(sp, cx, torso_y, pose, sway)
        apply_selective_outline(sp, idx)
        cast_pt = draw_tempest_fx(sp, cx, head_y, waist_y, pose, sway, far_hand, near_hand)

        if pose == "idle1":
            anchors["head_px"] = (cx - 1, head_y + 15)
            anchors["hit_px"] = (cx, torso_y + 9)
        if pose == "strike":
            anchors["cast_px"] = cast_pt

    sp.tag("idle", 1, 3)
    sp.tag("attack", 4, 5)
    sp.tag("hurt", 6, 6)

    return sp, anchors


# ---------------------------------------------------------------------------
# Export Previews, Sheet & Metadata
# ---------------------------------------------------------------------------

def render_preview_bg(sp: Sprite, anchors: dict, path: str):
    scale = 3
    fw, fh = W * scale, H * scale
    pad = 8
    row_w = N_FRAMES * fw + (N_FRAMES + 1) * pad
    total_h = (fh + 24) * 2 + (H + 28) + pad
    canvas = Image.new("RGB", (row_w, total_h), (42, 46, 58))
    draw = ImageDraw.Draw(canvas)

    bgs = [
        ("3x Sunlit Courtyard #E8E2D0 (Red=Ground Anchor, Cyan=Cast Anchor)", (232, 226, 208), 0),
        ("3x Dark Dusk #2A344B", (42, 52, 75), fh + 24),
    ]

    ax, ay = PIVOT_X, GROUND_Y
    cast_x, cast_y = anchors["cast_px"]

    for label, bg_rgb, oy in bgs:
        draw.rectangle([0, oy, row_w - 1, oy + fh + 23], fill=bg_rgb)
        draw.text((pad, oy + 4), label, fill=(36, 40, 52) if bg_rgb[0] > 128 else (225, 235, 250))
        for i in range(N_FRAMES):
            ox = pad + i * (fw + pad)
            fy = oy + 20
            draw.line([(ox, fy + ay * scale), (ox + fw - 1, fy + ay * scale)],
                      fill=(192, 184, 166) if bg_rgb[0] > 128 else (65, 78, 105))
            im = sp.composite(i + 1).resize((fw, fh), NEAREST)
            canvas.paste(im, (ox, fy), im)
            rx, ry = ox + ax * scale + scale // 2, fy + ay * scale + scale // 2
            draw.ellipse([rx - 3, ry - 3, rx + 3, ry + 3], fill=(235, 45, 65), outline=(255, 255, 255))
            if i == 4:
                cx_m, cy_m = ox + cast_x * scale + scale // 2, fy + cast_y * scale + scale // 2
                draw.ellipse([cx_m - 3, cy_m - 3, cx_m + 3, cy_m + 3], fill=(40, 225, 255), outline=(16, 40, 90))

    oy3 = (fh + 24) * 2
    half = row_w // 2
    draw.rectangle([0, oy3, half, total_h - 1], fill=(232, 226, 208))
    draw.rectangle([half, oy3, row_w - 1, total_h - 1], fill=(42, 52, 75))
    draw.text((pad, oy3 + 4), "1x Native Scale (Sunlit Courtyard #E8E2D0)", fill=(36, 40, 52))
    draw.text((half + pad, oy3 + 4), "1x Native Scale (Dark Dusk #2A344B)", fill=(225, 235, 250))
    for i in range(N_FRAMES):
        im = sp.composite(i + 1)
        canvas.paste(im, (pad + i * (W + 8), oy3 + 20), im)
        canvas.paste(im, (half + pad + i * (W + 8), oy3 + 20), im)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    canvas.save(path)
    print(f"preview_bg -> {path}")


def render_silhouette_strip(sp: Sprite, path: str, scale: int = 5):
    fw, fh = W * scale, H * scale
    sep = 6
    out = Image.new("RGB", (N_FRAMES * fw + (N_FRAMES + 1) * sep, fh + 2 * sep), (236, 232, 222))
    fg = (30, 34, 48)
    for i in range(N_FRAMES):
        im = sp.composite(i + 1)
        sil = Image.new("RGB", (W, H), (236, 232, 222))
        sp_px = sil.load()
        src = im.load()
        for y in range(H):
            for x in range(W):
                if src[x, y][3] > 0:
                    sp_px[x, y] = fg
        out.paste(sil.resize((fw, fh), NEAREST), (sep + i * (fw + sep), sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path)
    print(f"silhouette -> {path}")


def render_face_zoom(sp: Sprite, path: str, scale: int = 10):
    x0, y0, x1, y1 = 26, 4, 66, 42
    cw, ch = (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale
    sep = 4
    out = Image.new("RGB", (N_FRAMES * cw + (N_FRAMES + 1) * sep, ch + 2 * sep), (222, 230, 238))
    for i in range(N_FRAMES):
        crop = sp.composite(i + 1).crop((x0, y0, x1 + 1, y1 + 1)).resize((cw, ch), NEAREST)
        out.paste(crop, (sep + i * (cw + sep), sep), crop)
    out.save(path)
    print(f"face_zoom -> {path}")


def main():
    sp, anchors = build_sprite()
    info = sp.stats(print_=True)

    all_iso = {}
    for fi in range(1, N_FRAMES + 1):
        sp.frame(fi)
        st = sp.stats(print_=False)
        if st["isolated_px"]:
            all_iso[fi] = st["isolated_px"]
    print(f"per-frame isolated_px: {all_iso or 'none'}")

    assert info["semi_alpha_px"] == 0, f"Expected 0 semi-alpha px, got {info['semi_alpha_px']}"
    assert not info["near_duplicate_colors"], f"Unexpected near-dup colors: {info['near_duplicate_colors']}"
    assert not all_iso, f"Isolated pixels found: {all_iso}"

    for fi in range(1, N_FRAMES + 1):
        leg_cel = sp.frames[fi - 1].cels["legs"]
        ys = [y for y in range(H) for x in range(W) if leg_cel.getpixel((x, y))[3] > 0]
        hover_gap = GROUND_Y - max(ys)
        assert 4 <= hover_gap <= 6, f"Frame {fi} hover gap {hover_gap}px not in 4..6px (max_y={max(ys)})"
    print("hover clearance verified: 4-6px aloft on all 6 frames!")

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "wind_god_avatar",
        "file": "assets/sprites/wind_god_avatar_sheet.png",
        "frames": N_FRAMES,
        "frameW": W,
        "frameH": H,
        "sheetW": W * N_FRAMES,
        "sheetH": H,
        "facing": "left",
        "anchorX": round(PIVOT_X / W, 4),
        "anchorY": round(GROUND_Y / H, 4),
        "castX": round(cast_x / W, 4),
        "castY": round(cast_y / H, 4),
        "hitX": round(hit_x / W, 4),
        "hitY": round(hit_y / H, 4),
        "headX": round(head_x / W, 4),
        "headY": round(head_y / H, 4),
        "colorsUsed": info["colors_used"],
        "buildScript": "tools/pixel_art/wind_god_avatar/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=5)
    render_face_zoom(sp, FACE_ZOOM_PATH, scale=10)


if __name__ == "__main__":
    main()
