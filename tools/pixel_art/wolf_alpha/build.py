#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Frost-Spine Wolf Alpha (wolf_alpha / 灰棘头狼).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 88 x 72, 6 horizontal frames (528 x 72 sheet, padding=0).
Facing: left. GROUND_Y = 66, PIVOT_X = 44.

Pass 4 (Final Museum-Grade Polish):
- Rich slate-lavender ambient occlusion tucked around antler roots & dorsal crystal sockets
  so glowing translucent ice antlers and glacier shards POP with jewel-like contrast
- Slimmed paw soles (no double-thick black boot bar) with 3 crisp curved obsidian razor claws
- Refined 3/4 wolf head: brighter dual crimson rubies, crisp snarling upper lip, clean antler root
  offset on howling windup (zero snout overlap), crisp hurt `> <` wincing eyes clear of brow/nose
- Dramatic sweeping triple-claw cyan slash arc on Frame 5 radiating cleanly from the lunging
  slashing paw completely below the wolf's eyes & snout with exact cast anchor at slash apex
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
W, H = 88, 72
N_FRAMES = 6
GROUND_Y = 66
PIVOT_X = 44

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "wolf_alpha_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "wolf_alpha_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
HEAD_ZOOM_PATH = os.path.join(HERE, "head_zoom.png")

# ---------------------------------------------------------------------------
# Master 18-Color Hue-Shifted Anime JRPG Boss Palette (Zero Near-Duplicates!)
# ---------------------------------------------------------------------------
PURE_WHT = "#ffffff"  # Razor crystal specular ridge, fangs, eye flare, slash core
ICE_HI   = "#e2f9ff"  # Pale ice lit plane & frost aura highlight
ICE_GLOW = "#b5eeff"  # Mid-bright crystal gleam
ICE_MID  = "#7cdbff"  # Translucent pale-cyan crystal core & claw slash
ICE_SHAD = "#4c9ef5"  # Mid-deep azure crystal facet
ICE_DEEP = "#2c7ae8"  # Deep cobalt crystal shadow plane & lit ice selout
INK_ICE  = "#1a428c"  # Selective sapphire outline for shadow ice facets

FUR_HI   = "#dfe4f5"  # Sunlit silver-white mane crest, crown, back & tail highlight
FUR_MID  = "#b9c0db"  # Silver-lavender main shaggy coat
FUR_SH1  = "#8992b5"  # Cool slate-lavender mid-shadow & far legs
FUR_SH2  = "#5d658a"  # Deep periwinkle-slate fur shadow & top-left lit selout
FUR_SH3  = "#3b4263"  # Deepest fur crevices, inner ear, dark claw rim & mid selout
INK_DARK = "#1a1f36"  # Deep cool midnight-indigo ink, claws, nose & shadow outline

EYE_GLOW = "#ff9bb0"  # Hot glowing crimson-rose eye specular flare
EYE_RED  = "#f52544"  # Vivid glowing crimson wolf iris
MAW_PINK = "#c74c68"  # Snarling gums / tongue interior
MAW_DARK = "#751832"  # Deep crimson eye shadow & inner maw
MAW_DEEP = "#3d0e22"  # Darkest open throat interior

PALETTE = [
    PURE_WHT, ICE_HI, ICE_GLOW, ICE_MID, ICE_SHAD, ICE_DEEP, INK_ICE,
    FUR_HI, FUR_MID, FUR_SH1, FUR_SH2, FUR_SH3, INK_DARK,
    EYE_GLOW, EYE_RED, MAW_PINK, MAW_DARK, MAW_DEEP,
]

# ---------------------------------------------------------------------------
# Drawing Primitives & Anatomical Helpers
# ---------------------------------------------------------------------------

def hspan(sp: Sprite, y: int, x0: int, x1: int, col: str, only=None):
    if x1 < x0:
        x0, x1 = x1, x0
    iy = int(round(y))
    for x in range(int(round(x0)), int(round(x1)) + 1):
        sp.px(x, iy, col, only=only)


def paint_disk(sp: Sprite, cx: float, cy: float, r: float, col: str, only=None):
    """Filled Euclidean disk — clean smooth joints & tapered organic shapes."""
    if r <= 0.4:
        sp.px(int(round(cx)), int(round(cy)), col, only=only)
        return
    r2 = r * r
    x0 = int(math.floor(cx - r - 0.5))
    x1 = int(math.ceil(cx + r + 0.5))
    y0 = int(math.floor(cy - r - 0.5))
    y1 = int(math.ceil(cy + r + 0.5))
    for y in range(y0, y1 + 1):
        dy = y - cy
        for x in range(x0, x1 + 1):
            dx = x - cx
            if dx * dx + dy * dy <= r2:
                sp.px(x, y, col, only=only)


def draw_tapered_stroke(sp: Sprite, pts: list[tuple[float, float, float]], col: str, only=None):
    """Interpolate (x, y, radius) polyline into a clean organic tapered shape."""
    for i in range(len(pts) - 1):
        x0, y0, r0 = pts[i]
        x1, y1, r1 = pts[i + 1]
        dist = math.hypot(x1 - x0, y1 - y0)
        steps = max(1, int(math.ceil(dist * 2.8)))
        for s in range(steps + 1):
            t = s / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            r = r0 + (r1 - r0) * t
            paint_disk(sp, x, y, r, col, only=only)


def draw_fur_tuft(sp: Sprite, x0: float, y0: float, x1: float, y1: float,
                  base_r: float, col: str, tip_col: str | None = None, only=None):
    """Pointed anime fur lock tapering from (x0,y0) radius base_r to sharp 1px tip (x1,y1)."""
    dist = math.hypot(x1 - x0, y1 - y0)
    steps = max(2, int(math.ceil(dist * 2.5)))
    for s in range(steps + 1):
        t = s / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        r = base_r * ((1.0 - t) ** 0.9)
        c = tip_col if (tip_col and t > 0.72) else col
        paint_disk(sp, x, y, r, c, only=only)


def draw_crystal_prong(sp: Sprite, pts: list[tuple[float, float, float]],
                       bright_bias: float = 0.0):
    """Faceted translucent ice antler branch lit from TOP-LEFT."""
    pix_data: dict[tuple[int, int], tuple[float, float, float]] = {}
    total_segs = len(pts) - 1
    for i in range(total_segs):
        x0, y0, r0 = pts[i]
        x1, y1, r1 = pts[i + 1]
        vx, vy = x1 - x0, y1 - y0
        seg_len = max(1e-4, math.hypot(vx, vy))
        nx, ny = -vy / seg_len, vx / seg_len
        if nx * (-0.7) + ny * (-0.7) < 0:
            nx, ny = -nx, -ny

        steps = max(2, int(math.ceil(seg_len * 3.2)))
        for s in range(steps + 1):
            st = s / steps
            t_glob = (i + st) / max(1, total_segs)
            cx = x0 + vx * st
            cy = y0 + vy * st
            r = r0 + (r1 - r0) * st
            if r <= 0.45:
                ix, iy = int(round(cx)), int(round(cy))
                prev = pix_data.get((ix, iy))
                if prev is None or t_glob > prev[1]:
                    pix_data[(ix, iy)] = (0.92, t_glob, 0.0)
                continue
            r2 = r * r
            for py in range(int(math.floor(cy - r - 0.5)), int(math.ceil(cy + r + 0.5)) + 1):
                for px in range(int(math.floor(cx - r - 0.5)), int(math.ceil(cx + r + 0.5)) + 1):
                    dx, dy = px - cx, py - cy
                    d2 = dx * dx + dy * dy
                    if d2 <= r2:
                        proj = (dx * nx + dy * ny) / max(0.5, r)
                        prev = pix_data.get((px, py))
                        if prev is None or d2 < prev[2]:
                            pix_data[(px, py)] = (proj, t_glob, d2)

    for (px, py), (proj, t_glob, _d2) in pix_data.items():
        if not (2 <= px < W - 2 and 2 <= py < H - 2):
            continue
        val = proj + 0.35 * t_glob + bright_bias
        facet = 0.14 if ((px * 2 - py) // 4) % 2 == 0 else -0.05
        v = val + facet
        if t_glob > 0.85 or v > 0.72:
            col = PURE_WHT
        elif v > 0.36:
            col = ICE_HI
        elif v > 0.08:
            col = ICE_GLOW
        elif v > -0.24:
            col = ICE_MID
        elif v > -0.56:
            col = ICE_SHAD
        else:
            col = ICE_DEEP
        sp.px(px, py, col)


def draw_crystal_shard(sp: Sprite, bx: float, by: float, tx: float, ty: float,
                       half_w: float, bright_bias: float = 0.0):
    """Sharp angular diamond-wedge glacier crystal blade (multifaceted ice spine!)."""
    vx, vy = tx - bx, ty - by
    length = max(1e-4, math.hypot(vx, vy))
    ux, uy = vx / length, vy / length
    nx, ny = -uy, ux
    if nx * (-0.7) + ny * (-0.7) < 0:
        nx, ny = -nx, -ny

    p_base_l = (bx + nx * half_w * 0.80, by + ny * half_w * 0.80)
    p_base_r = (bx - nx * half_w * 0.86, by - ny * half_w * 0.86)
    p_mid_l  = (bx + ux * length * 0.28 + nx * half_w, by + uy * length * 0.28 + ny * half_w)
    p_mid_r  = (bx + ux * length * 0.22 - nx * half_w * 0.90, by + uy * length * 0.22 - ny * half_w * 0.90)
    p_tip    = (tx, ty)

    poly = [p_base_l, p_mid_l, p_tip, p_mid_r, p_base_r]
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x0, x1 = max(2, int(math.floor(min(xs)))), min(W - 3, int(math.ceil(max(xs))))
    y0, y1 = max(2, int(math.floor(min(ys)))), min(H - 3, int(math.ceil(max(ys))))

    def inside_poly(px: float, py: float) -> bool:
        inside = False
        n = len(poly)
        j = n - 1
        for i in range(n):
            xi, yi = poly[i]
            xj, yj = poly[j]
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi):
                inside = not inside
            j = i
        return inside

    for py in range(y0, y1 + 1):
        for px in range(x0, x1 + 1):
            if not inside_poly(px + 0.1, py + 0.1):
                continue
            dx, dy = px - bx, py - by
            t = max(0.0, min(1.0, (dx * ux + dy * uy) / length))
            lat = (dx * nx + dy * ny) / max(0.7, half_w * (1.0 - 0.72 * t))
            if t > 0.82:
                col = PURE_WHT
            elif lat > 0.42:
                col = PURE_WHT if (t > 0.35 or bright_bias > 0.1) else ICE_HI
            elif lat > 0.05:
                col = ICE_HI if t > 0.25 else ICE_GLOW
            elif lat > -0.22:
                col = ICE_GLOW if (t > 0.50 or bright_bias > 0.1) else ICE_MID
            elif lat > -0.60:
                col = ICE_MID if t > 0.40 else ICE_SHAD
            else:
                col = ICE_SHAD if t > 0.55 else ICE_DEEP
            sp.px(px, py, col)

    sp.px(max(2, min(W - 3, int(round(tx)))), max(2, min(H - 3, int(round(ty)))), PURE_WHT)


def draw_paw(sp: Sprite, px: int, ground_y: int, is_far: bool = False,
             lifted: int = 0, slash_open: bool = False):
    """Sleek nimble dire-wolf paw facing LEFT with 3 distinct curved obsidian razor claws.

    Avoids clunky 2px black boot bars by keeping paw-pad sole in cool fur shadow so ONLY
    the 3 razor claws + crisp 1px outer selout read as deep obsidian ink!
    """
    by = ground_y - lifted
    c_hi  = FUR_MID if is_far else FUR_HI
    c_mid = FUR_SH1 if is_far else FUR_MID
    c_sh  = FUR_SH2 if is_far else FUR_SH1
    c_dk  = FUR_SH3 if is_far else FUR_SH2

    if slash_open:
        # Dynamic wide-fanned slashing wolf paw mid-air!
        paint_disk(sp, px + 1, by - 2, 2.7, c_mid)
        paint_disk(sp, px - 1, by - 3, 1.9, c_hi)
        paint_disk(sp, px + 2, by - 1, 1.9, c_sh)
        # 3 long splayed obsidian razor claws ripping forward-left!
        sp.line(px - 2, by - 4, px - 6, by - 6, INK_DARK)
        sp.line(px - 3, by - 2, px - 7, by - 2, INK_DARK)
        sp.line(px - 2, by,     px - 6, by + 2, INK_DARK)
        sp.px(px - 3, by - 4, FUR_HI if not is_far else FUR_MID)
        sp.px(px - 4, by - 2, FUR_HI if not is_far else FUR_MID)
        return

    # Sleek planted dire-wolf paw (bottom row y=by stays fur-toned so ground selout is clean 1px!)
    hspan(sp, by - 4, px - 1, px + 3, c_mid)
    hspan(sp, by - 3, px - 2, px + 3, c_mid)
    hspan(sp, by - 2, px - 3, px + 3, c_mid)
    hspan(sp, by - 1, px - 3, px + 3, c_sh)
    hspan(sp, by,     px - 2, px + 2, c_sh)   # sleek pad (not solid black boot!)
    sp.px(px + 2, by, c_dk)

    # Splayed luminous knuckle ridges (3 distinct toes!)
    sp.px(px - 3, by - 2, c_hi)
    sp.px(px - 2, by - 3, c_hi)
    sp.px(px - 1, by - 2, c_hi)
    sp.px(px,     by - 3, c_hi)
    sp.px(px + 1, by - 2, c_hi)
    # Crisp inter-toe shadow grooves
    sp.px(px - 2, by - 1, c_dk)
    sp.px(px,     by - 1, c_dk)

    # 3 Distinct Curved Obsidian Razor Claws gripping the ground pointing LEFT!
    # Claw 1 (far leading talon — arched curve!)
    sp.px(px - 4, by - 2, FUR_SH1 if not is_far else FUR_SH2)
    sp.px(px - 5, by - 1, INK_DARK)
    sp.px(px - 5, by,     INK_DARK)
    sp.px(px - 4, by - 1, INK_DARK)
    # Claw 2 (center gripping talon — crisp separation from claw 1!)
    sp.px(px - 3, by - 1, FUR_SH3)
    sp.px(px - 3, by,     INK_DARK)
    # Claw 3 (near side talon!)
    sp.px(px - 1, by - 1, FUR_SH3)
    sp.px(px - 1, by,     INK_DARK)


# ---------------------------------------------------------------------------
# Anatomical Layer Painters
# ---------------------------------------------------------------------------

def draw_far_legs(sp: Sprite, pose: str, bdx: int, bdy: int):
    """Sleek muscular far front leg & far hind leg shaded cooler/darker for 3D depth."""
    sp.layer("far_legs")

    # ---- Far Front Leg ----
    if pose == "windup":
        # Raised high & coiled forward-left ready to rend!
        sh = (29 + bdx, 41 + bdy, 3.4)
        el = (25 + bdx, 48 + bdy, 2.4)
        wr = (19 + bdx, 52 + bdy, 1.8)
        draw_tapered_stroke(sp, [sh, el, wr], FUR_SH1)
        draw_tapered_stroke(sp, [(sh[0] + 1, sh[1] + 1, 2.0), (el[0] + 1, el[1] + 1, 1.5), (wr[0] + 1, wr[1], 1.1)], FUR_SH2)
        draw_tapered_stroke(sp, [(el[0] - 1, el[1] - 1, 1.0), (wr[0] - 1, wr[1] - 1, 0.8)], FUR_MID, only="opaque")
        draw_paw(sp, 17 + bdx, 55 + bdy, is_far=True, lifted=0, slash_open=True)
    elif pose == "strike":
        # Braced lower-left during pounce — cleanly separated vertically below the high-slashing near paw!
        sh = (29 + bdx, 41 + bdy, 3.3)
        el = (25 + bdx, 51 + bdy, 2.3)
        wr = (20 + bdx, 60 + bdy, 1.8)
        draw_tapered_stroke(sp, [sh, el, wr], FUR_SH1)
        draw_tapered_stroke(sp, [(sh[0] + 1, sh[1] + 1, 2.0), (el[0] + 1, el[1] + 1, 1.5), (wr[0] + 1, wr[1] + 1, 1.1)], FUR_SH2)
        draw_tapered_stroke(sp, [(el[0] - 1, el[1] - 1, 1.0), (wr[0] - 1, wr[1] - 1, 0.8)], FUR_MID, only="opaque")
        draw_paw(sp, 18 + bdx, GROUND_Y, is_far=True, lifted=3, slash_open=False)
    elif pose == "hurt":
        # Recoiling off balance — far front paw kicked high off ground!
        sh = (31 + bdx, 41 + bdy, 3.3)
        el = (25 + bdx, 48 + bdy, 2.4)
        wr = (19 + bdx, 54 + bdy, 1.8)
        draw_tapered_stroke(sp, [sh, el, wr], FUR_SH1)
        draw_tapered_stroke(sp, [(sh[0] + 1, sh[1] + 1, 2.0), (el[0] + 1, el[1] + 1, 1.5), (wr[0] + 1, wr[1] + 1, 1.1)], FUR_SH2)
        draw_paw(sp, 17 + bdx, GROUND_Y, is_far=True, lifted=9)
    else:
        # Prowling Alpha stance: long sleek foreleg stepped forward-left, anchored on GROUND_Y!
        sh = (28 + bdx, 43 + bdy, 3.6)
        el = (24 + bdx, 52 + bdy, 2.4)
        wr = (17 + bdx, 61,       1.9)
        draw_tapered_stroke(sp, [sh, el, wr], FUR_SH1)
        draw_tapered_stroke(sp, [(sh[0] + 1, sh[1] + 1, 2.3), (el[0] + 1, el[1] + 1, 1.6), (wr[0] + 1, wr[1] + 1, 1.1)], FUR_SH2)
        draw_tapered_stroke(sp, [(el[0] - 1, el[1] - 1, 1.0), (wr[0] - 1, wr[1] - 1, 0.8)], FUR_MID, only="opaque")
        draw_fur_tuft(sp, el[0] + 1, el[1], el[0] + 5, el[1] - 2, 1.3, FUR_SH2)
        draw_paw(sp, 15 + bdx, GROUND_Y, is_far=True, lifted=0)

    # ---- Far Hind Leg (gracefully tucked under flank at y=63 for 3/4 depth) ----
    if pose == "windup":
        hip  = (54 + bdx, 39 + bdy, 3.8)
        hock = (59 + bdx, 51 + bdy, 2.2)
        ank  = (55 + bdx, 61,       1.8)
        paw_x, paw_y = 53 + bdx, 63
    elif pose == "strike":
        hip  = (55 + bdx, 37 + bdy, 3.7)
        hock = (63 + bdx, 48 + bdy, 2.2)
        ank  = (65 + bdx, 60,       1.8)
        paw_x, paw_y = 63 + bdx, 63
    elif pose == "hurt":
        hip  = (54 + bdx, 41 + bdy, 3.8)
        hock = (58 + bdx, 52 + bdy, 2.2)
        ank  = (53 + bdx, 61,       1.8)
        paw_x, paw_y = 51 + bdx, 63
    else:
        hip  = (53 + bdx, 38 + bdy, 3.8)
        hock = (57 + bdx, 50 + bdy, 2.2)
        ank  = (54 + bdx, 60,       1.8)
        paw_x, paw_y = 52 + bdx, 63

    draw_tapered_stroke(sp, [hip, hock, ank], FUR_SH1)
    draw_tapered_stroke(sp, [(hip[0] + 1, hip[1] + 1, 2.5), (hock[0] + 1, hock[1] + 1, 1.5), (ank[0] + 1, ank[1], 1.1)], FUR_SH2)
    draw_tapered_stroke(sp, [(hip[0] - 1, hip[1], 1.7), (hock[0] - 1, hock[1] + 1, 0.9)], FUR_SH3, only="opaque")
    draw_paw(sp, paw_x, paw_y, is_far=True, lifted=0)


def draw_tail(sp: Sprite, pose: str, bdx: int, bdy: int, tail_wave: int):
    """Lush, sweeping feathered silver-white dire-wolf tail plume with crisp rump separation."""
    sp.layer("tail")

    rx = 65 + bdx
    ry = 36 + bdy

    if pose == "strike":
        # Sleek horizontal battle plume streaming straight back during pounce!
        spine = [
            (rx,      ry,      3.2),
            (rx + 6,  ry - 1,  4.4),
            (rx + 12, ry + 1,  4.0),
            (rx + 17, ry + 4,  2.2),
            (rx + 20, ry + 8,  0.5),
        ]
    elif pose == "windup":
        # Bristled high & arched behind howling wolf (safely x <= 84)
        spine = [
            (rx - 1,  ry + 2,  3.2),
            (rx + 5,  ry - 1,  4.4),
            (rx + 11, ry - 2,  3.9),
            (rx + 16, ry + 2,  2.1),
            (rx + 18, ry + 7,  0.5),
        ]
    elif pose == "hurt":
        # Whipped low & stiff in knockback recoil
        spine = [
            (rx - 1,  ry + 3,  3.1),
            (rx + 4,  ry + 7,  4.1),
            (rx + 9,  ry + 12, 3.6),
            (rx + 13, ry + 17, 2.0),
            (rx + 15, ry + 21, 0.5),
        ]
    else:
        # Sweeping S-curved lush plume echoing wolf_alpha.png!
        tw = tail_wave
        spine = [
            (rx,      ry,          3.2),
            (rx + 6,  ry + 1 + tw, 4.5),
            (rx + 12, ry + 3 + tw, 4.3),
            (rx + 17, ry + 8 + tw, 2.5),
            (rx + 20, ry + 15 + tw, 0.5),
        ]

    clamped = [(min(W - 3, x), min(H - 4, max(4, y)), r) for x, y, r in spine]

    draw_tapered_stroke(sp, clamped, FUR_MID)
    hi_pts = [(x, y - max(0.8, r * 0.48), max(0.5, r * 0.62)) for x, y, r in clamped]
    draw_tapered_stroke(sp, hi_pts, FUR_HI, only="opaque")
    p1, p2, p3 = clamped[1], clamped[2], clamped[3]
    draw_fur_tuft(sp, p1[0] + 1, p1[1] - 1, min(W - 3, p2[0] + 4), p2[1] - 5, 2.2, FUR_HI, FUR_HI)
    draw_fur_tuft(sp, p2[0],     p2[1] - 1, min(W - 3, p3[0] + 4), p3[1] - 4, 2.0, FUR_HI, ICE_HI)
    sh_pts = [(x, y + max(0.9, r * 0.45), max(0.5, r * 0.60)) for x, y, r in clamped]
    draw_tapered_stroke(sp, sh_pts, FUR_SH1, only="opaque")
    sh2_pts = [(x, y + max(1.4, r * 0.72), max(0.4, r * 0.42)) for x, y, r in clamped[:-1]]
    draw_tapered_stroke(sp, sh2_pts, FUR_SH2, only="opaque")
    draw_fur_tuft(sp, p2[0] - 1, p2[1] + 2, min(W - 3, p3[0] + 2), p3[1] + 4, 1.7, FUR_SH1, FUR_SH2)
    sp.line(int(p1[0]), int(p1[1] + 1), int(p3[0] - 1), int(p3[1]), FUR_SH2, only="opaque")


def draw_dorsal_spines(sp: Sprite, pose: str, bdx: int, bdy: int):
    """4 varied angular diamond-wedge glacier crystal clusters cleanly framed along the back!"""
    sp.layer("dorsal_spines")

    ox, oy = bdx, bdy
    if pose == "windup":
        ox += 1
        oy -= 1
    elif pose == "strike":
        ox -= 1
        oy += 1
    elif pose == "hurt":
        ox += 1
        oy += 2

    bias = 0.25 if pose == "windup" else (0.08 if pose == "idle2" else 0.0)

    # Cluster 1: Heroic forward withers crystal pair (clean breathing gap from right antler!)
    draw_crystal_shard(sp, 41 + ox, 25 + oy, 46 + ox, 12 + oy, 2.6, bright_bias=bias - 0.04)
    draw_crystal_shard(sp, 45 + ox, 25 + oy, 52 + ox,  8 + oy, 3.1, bright_bias=bias + 0.08)

    # Cluster 2: Mid-back dramatic jagged glacier shard + angled companion spur
    draw_crystal_shard(sp, 52 + ox, 27 + oy, 59 + ox, 14 + oy, 2.7, bright_bias=bias + 0.02)
    draw_crystal_shard(sp, 55 + ox, 28 + oy, 58 + ox, 20 + oy, 1.5, bright_bias=bias - 0.08)

    # Cluster 3: Lower-back sharp angled wedge shard
    draw_crystal_shard(sp, 58 + ox, 30 + oy, 65 + ox, 20 + oy, 2.2, bright_bias=bias)

    # Cluster 4: Sleek rump crystal (stopped cleanly before tail plume base!)
    draw_crystal_shard(sp, 62 + ox, 33 + oy, 67 + ox, 26 + oy, 1.6, bright_bias=bias - 0.04)


def draw_torso(sp: Sprite, pose: str, bdx: int, bdy: int, chest_exp: int):
    """Sleek muscular dire-wolf torso with dark crystal-socket AO & sculpted shaggy silver mane!"""
    sp.layer("torso")

    if pose == "windup":
        chest   = (35 + bdx, 32 + bdy, 8.6)
        withers = (42 + bdx, 28 + bdy, 8.8)
        midback = (51 + bdx, 33 + bdy, 6.4)
        waist   = (58 + bdx, 37 + bdy, 5.4)
        rump    = (64 + bdx, 40 + bdy, 6.2)
    elif pose == "strike":
        chest   = (31 + bdx, 35 + bdy, 8.4)
        withers = (40 + bdx, 29 + bdy, 8.6)
        midback = (50 + bdx, 31 + bdy, 6.2)
        waist   = (58 + bdx, 33 + bdy, 5.2)
        rump    = (64 + bdx, 35 + bdy, 6.0)
    elif pose == "hurt":
        chest   = (36 + bdx, 34 + bdy, 8.4)
        withers = (44 + bdx, 30 + bdy, 8.6)
        midback = (52 + bdx, 35 + bdy, 6.4)
        waist   = (59 + bdx, 39 + bdy, 5.6)
        rump    = (65 + bdx, 41 + bdy, 6.2)
    else:
        chest   = (33 + bdx, 36 + bdy + chest_exp, 8.6 + chest_exp * 0.35)
        withers = (41 + bdx, 29 + bdy,             8.9)
        midback = (50 + bdx, 31 + bdy,             6.4)
        waist   = (57 + bdx, 33 + bdy,             5.2)
        rump    = (63 + bdx, 35 + bdy,             6.0)

    # 1. Base muscular silhouette (cool silver-lavender FUR_MID)
    draw_tapered_stroke(sp, [chest, withers, midback, waist, rump], FUR_MID)

    # 2. Carve deep sleek predatory tucked-belly arch under waist!
    belly_cx = int(round((midback[0] + waist[0]) * 0.5))
    belly_cy = int(round(waist[1] + 8))
    paint_disk(sp, belly_cx, belly_cy, 5.4, None)

    # 3. Sculpted 3-step directional coat shading
    sh1_chain = [
        (chest[0] + 1,   chest[1] + 4,   5.6),
        (withers[0] + 2, withers[1] + 5, 5.8),
        (midback[0],     midback[1] + 2, 4.6),
        (waist[0],       waist[1] + 2,   3.8),
        (rump[0],        rump[1] + 2,    4.2),
    ]
    draw_tapered_stroke(sp, sh1_chain, FUR_SH1, only="opaque")

    sh2_chain = [
        (chest[0] + 1,   chest[1] + 6,   3.8),
        (withers[0] + 2, withers[1] + 8, 3.6),
        (midback[0],     midback[1] + 5, 2.8),
        (waist[0],       waist[1] + 4,   2.2),
    ]
    draw_tapered_stroke(sp, sh2_chain, FUR_SH2, only="opaque")

    # Sunlit silver-white shoulder & upper back highlights (broken by fur tufts!)
    hi_chain = [
        (chest[0] - 2,   chest[1] - 3,   3.6),
        (withers[0] - 1, withers[1] - 3, 4.4),
        (midback[0],     midback[1] - 2, 2.8),
        (waist[0],       waist[1] - 2,   2.0),
        (rump[0],        rump[1] - 2,    2.2),
    ]
    draw_tapered_stroke(sp, hi_chain, FUR_HI, only="opaque")

    # 4. Rich Slate-Lavender Ambient Occlusion along neck crest & dorsal crystal sockets
    #    (Makes the luminous ice antlers & dorsal shards POP like jewels!)
    wx, wy = withers[0], withers[1]
    cx, cy = chest[0], chest[1]

    # Darker shadowed mane ruff right behind the head/antlers (matching wolf_alpha.png!)
    upper_mane = [
        (wx - 10, wy - 1, wx - 7, wy - 7,  2.2, FUR_SH2, FUR_SH3),
        (wx - 6,  wy - 4, wx - 2, wy - 10, 2.3, FUR_SH1, FUR_SH2),
        (wx - 1,  wy - 5, wx + 4, wy - 10, 2.2, FUR_MID, FUR_SH1),
        (wx + 4,  wy - 4, wx + 9, wy - 7,  2.0, FUR_SH1, FUR_SH2),
    ]
    for x0, y0, x1, y1, r, c1, c2 in upper_mane:
        draw_fur_tuft(sp, x0, y0, x1, y1, r, c1, c2)

    # Dorsal crystal socket fur darks along the spine ridge
    sp.line(int(wx + 2), int(wy - 4), int(midback[0] + 6), int(midback[1] - 2), FUR_SH2, only="opaque")
    sp.line(int(midback[0] + 4), int(midback[1] - 1), int(rump[0] + 1), int(rump[1] - 2), FUR_SH2, only="opaque")

    # Tiered cascading mane locks down neck & shoulder (crisp light/shadow rhythm!)
    draw_fur_tuft(sp, cx - 2, cy + 4, cx + 3, cy + 10, 2.1, FUR_SH2, FUR_SH3)
    draw_fur_tuft(sp, cx + 3, cy + 4, cx + 8, cy + 9,  2.2, FUR_SH1, FUR_SH2)
    draw_fur_tuft(sp, wx + 4, wy + 4, wx + 11, wy + 8, 2.2, FUR_SH1, FUR_SH2)
    draw_fur_tuft(sp, cx - 4, cy + 2, cx + 1, cy + 7,  2.2, FUR_MID, FUR_SH1)
    draw_fur_tuft(sp, wx - 5, wy + 1, wx + 2, wy + 6,  2.4, FUR_HI,  FUR_MID)
    draw_fur_tuft(sp, wx + 1, wy - 1, wx + 8, wy + 4,  2.2, FUR_HI,  FUR_MID)

    # Crisp anime fur-layer creases inside the mane & ribcage
    sp.line(int(wx - 4), int(wy + 4), int(wx + 3), int(wy + 8), FUR_SH2, only="opaque")
    sp.line(int(wx + 1), int(wy + 1), int(wx + 8), int(wy + 5), FUR_SH2, only="opaque")
    sp.line(int(wx - 6), int(wy - 2), int(wx - 1), int(wy + 1), FUR_SH2, only="opaque")
    sp.line(int(midback[0] - 1), int(midback[1] - 1), int(waist[0] + 2), int(waist[1]), FUR_SH2, only="opaque")
    sp.line(int(midback[0] + 1), int(midback[1] + 2), int(waist[0] + 1), int(waist[1] + 2), FUR_SH3, only="opaque")

    # 5. Embedded shoulder frost crystal shards gleaming out of shadowed mane pockets!
    sb = 0.14 if pose in ("idle2", "windup") else 0.04
    draw_crystal_shard(sp, wx,     wy - 1, wx + 5, wy - 6, 1.8, bright_bias=sb + 0.06)
    draw_crystal_shard(sp, wx + 4, wy + 1, wx + 9, wy - 3, 1.7, bright_bias=sb)
    draw_crystal_shard(sp, wx + 2, wy + 4, wx + 6, wy + 1, 1.4, bright_bias=sb - 0.04)


def draw_near_legs(sp: Sprite, pose: str, bdx: int, bdy: int):
    """Tall, lean, muscular foreground dire-wolf legs with sharp elbow tufts & obsidian claws."""
    sp.layer("near_legs")

    # ---- Near Hind Leg ----
    if pose == "windup":
        thigh = (63 + bdx, 39 + bdy, 5.2)
        knee  = (60 + bdx, 49 + bdy, 3.6)
        hock  = (69 + bdx, 54 + bdy, 2.5)
        ank   = (68 + bdx, 62,       1.9)
        paw_x = 67 + bdx
    elif pose == "strike":
        thigh = (63 + bdx, 36 + bdy, 5.0)
        knee  = (65 + bdx, 47 + bdy, 3.5)
        hock  = (73 + bdx, 53 + bdy, 2.4)
        ank   = (76 + bdx, 62,       1.9)
        paw_x = 75 + bdx
    elif pose == "hurt":
        thigh = (64 + bdx, 41 + bdy, 5.2)
        knee  = (61 + bdx, 51 + bdy, 3.6)
        hock  = (70 + bdx, 55 + bdy, 2.5)
        ank   = (69 + bdx, 62,       1.9)
        paw_x = 68 + bdx
    else:
        thigh = (63 + bdx, 37 + bdy, 5.1)
        knee  = (62 + bdx, 47 + bdy, 3.5)
        hock  = (70 + bdx, 52 + bdy, 2.4)
        ank   = (71 + bdx, 62,       1.9)
        paw_x = 70 + bdx

    draw_tapered_stroke(sp, [thigh, knee, hock, ank], FUR_MID)
    draw_tapered_stroke(sp, [
        (thigh[0] - 2, thigh[1] - 1, 2.5),
        (knee[0] - 2,  knee[1],      1.8),
        (hock[0] - 1,  hock[1] + 1,  1.1),
        (ank[0] - 1,   ank[1],       0.9),
    ], FUR_HI, only="opaque")
    draw_tapered_stroke(sp, [
        (thigh[0] + 2, thigh[1] + 1, 2.8),
        (hock[0] + 1,  hock[1] + 1,  1.7),
        (ank[0] + 1,   ank[1],       1.0),
    ], FUR_SH1, only="opaque")
    draw_tapered_stroke(sp, [
        (hock[0] + 1, hock[1] + 2, 1.2),
        (ank[0] + 1,  ank[1] + 1,  0.8),
    ], FUR_SH2, only="opaque")
    sp.line(int(thigh[0] - 4), int(thigh[1] + 1), int(knee[0] - 3), int(knee[1] + 2), FUR_SH2, only="opaque")
    draw_fur_tuft(sp, hock[0] + 1, hock[1], min(W - 3, hock[0] + 5), hock[1] - 2, 1.5, FUR_MID, FUR_SH1)
    draw_paw(sp, min(W - 5, paw_x), GROUND_Y, is_far=False, lifted=0)

    # ---- Near Front Leg ----
    if pose == "windup":
        sh  = (41 + bdx, 36 + bdy, 4.6)
        el  = (44 + bdx, 47 + bdy, 3.1)
        wr  = (40 + bdx, 61,       2.1)
        paw_x, lifted, slash = 38 + bdx, 0, False
    elif pose == "strike":
        # HEROIC HIGH-SLASHING FORELEG ripping straight left into the blazing cyan claw arc!
        sh  = (38 + bdx, 36 + bdy, 4.6)
        el  = (31 + bdx, 44 + bdy, 3.1)
        wr  = (20 + bdx, 50 + bdy, 2.1)
        paw_x, lifted, slash = 17 + bdx, 0, True
    elif pose == "hurt":
        sh  = (43 + bdx, 37 + bdy, 4.5)
        el  = (45 + bdx, 48 + bdy, 3.0)
        wr  = (38 + bdx, 59 + bdy, 2.0)
        paw_x, lifted, slash = 36 + bdx, 2, False
    else:
        sh  = (41 + bdx, 36 + bdy, 4.6)
        el  = (43 + bdx, 47 + bdy, 3.1)
        wr  = (38 + bdx, 61,       2.1)
        paw_x, lifted, slash = 37 + bdx, 0, False

    draw_tapered_stroke(sp, [sh, el, wr], FUR_MID)
    draw_tapered_stroke(sp, [
        (sh[0] - 2, sh[1] - 1, 2.3),
        (el[0] - 2, el[1],     1.6),
        (wr[0] - 1, wr[1],     1.1),
    ], FUR_HI, only="opaque")
    draw_tapered_stroke(sp, [
        (sh[0] + 2, sh[1] + 1, 2.5),
        (el[0] + 2, el[1] + 1, 1.8),
        (wr[0] + 1, wr[1],     1.1),
    ], FUR_SH1, only="opaque")
    draw_tapered_stroke(sp, [
        (el[0] + 2, el[1] + 2, 1.2),
        (wr[0] + 1, wr[1] + 1, 0.8),
    ], FUR_SH2, only="opaque")

    # Signature sharp tufted fur wing at the elbow
    draw_fur_tuft(sp, el[0] + 1, el[1] - 1, el[0] + 8, el[1] - 4, 2.2, FUR_HI, FUR_MID)
    draw_fur_tuft(sp, el[0] + 1, el[1] + 1, el[0] + 6, el[1] + 1, 1.6, FUR_SH1, FUR_SH2)
    sp.line(int(sh[0] + 3), int(sh[1] - 1), int(el[0] + 3), int(el[1] - 1), FUR_SH2, only="opaque")

    if slash:
        draw_paw(sp, paw_x, int(wr[1] + 2), is_far=False, lifted=0, slash_open=True)
    else:
        draw_paw(sp, paw_x, GROUND_Y, is_far=False, lifted=lifted, slash_open=False)


def draw_antlers(sp: Sprite, layer_name: str, hx: int, hy: int, pose: str,
                 antler_sparkle: bool = False):
    """Graceful towering crystalline ice antlers with open U-shaped crown gap & curved stag tines!"""
    sp.layer(layer_name)

    root_ox = 0
    if pose == "windup":
        # Root shifted +2px right behind raised howling snout bridge so ZERO snout overlap!
        root_ox = 2
        y_scale = 0.85
        rot_x = 3.2
        bias = 0.28
    elif pose == "strike":
        y_scale = 0.94
        rot_x = -2.8
        bias = 0.12
    elif pose == "hurt":
        root_ox = 1
        y_scale = 0.93
        rot_x = 3.5
        bias = -0.04
    else:
        y_scale = 1.0
        rot_x = 0.0
        bias = 0.07 if antler_sparkle else 0.0

    def pt(dx: float, dy: float, r: float):
        sdy = dy * y_scale
        x = max(3, min(W - 3, hx + root_ox + dx + rot_x * (abs(sdy) / 28.0)))
        y = max(3, min(H - 4, hy + sdy))
        return (x, y, r)

    if layer_name == "far_antler":
        # FAR (LEFT) ANTLER — elegant outward-sweeping ice stag arch opening a heroic V-crown!
        main_beam = [
            pt(-3, -6, 1.9),
            pt(-8, -11, 1.65),
            pt(-14, -18, 1.45),
            pt(-17, -26, 1.1),
            pt(-15, -33, 0.35),
        ]
        # Clean diagonal upward-curving brow tine (zero horizontal stub!)
        brow_tine = [
            pt(-9, -12, 1.25),
            pt(-14, -16, 0.9),
            pt(-18, -21, 0.35),
        ]
        # Graceful inward-curving inner tine
        inner_tine = [
            pt(-13, -18, 1.2),
            pt(-11, -25, 0.95),
            pt(-8, -32, 0.35),
        ]
        # Sweeping high outer fork
        outer_tip = [
            pt(-16, -23, 1.05),
            pt(-20, -28, 0.78),
            pt(-21, -33, 0.35),
        ]
        for branch in (brow_tine, outer_tip, inner_tine, main_beam):
            draw_crystal_prong(sp, branch, bright_bias=bias - 0.03)

    else:
        # NEAR (RIGHT) ANTLER — regal curving stag crown rising cleanly above right brow!
        main_beam = [
            pt(2, -6, 2.0),
            pt(4, -13, 1.75),
            pt(8, -21, 1.45),
            pt(12, -29, 1.1),
            pt(14, -35, 0.35),
        ]
        # Sweeping inner-left crescent tine curving toward center crown
        front_tine = [
            pt(5, -14, 1.35),
            pt(1, -22, 1.0),
            pt(-2, -30, 0.35),
        ]
        # High central fork
        crown_fork = [
            pt(8, -22, 1.2),
            pt(6, -29, 0.9),
            pt(5, -35, 0.35),
        ]
        # Graceful upward-curving outer right spur
        right_spur = [
            pt(6, -15, 1.25),
            pt(11, -19, 0.9),
            pt(15, -24, 0.35),
        ]
        for branch in (right_spur, front_tine, crown_fork, main_beam):
            draw_crystal_prong(sp, branch, bright_bias=bias + 0.08)


def draw_head(sp: Sprite, hx: int, hy: int, pose: str):
    """Sleek, fierce 3/4-left canine dire-wolf head with jewel-bright crimson eyes & crisp snarl!"""
    sp.layer("head")

    # 1. Pointed Wolf Ears
    if pose == "hurt":
        # Ears pinned completely flat back against neck in recoil!
        far_ear  = [(hx - 3, hy - 4), (hx - 9, hy - 1), (hx - 4, hy)]
        near_ear = [(hx + 4, hy - 5), (hx + 13, hy - 2), (hx + 6, hy)]
    elif pose == "strike":
        far_ear  = [(hx - 4, hy - 6), (hx - 10, hy - 6), (hx - 5, hy - 2)]
        near_ear = [(hx + 4, hy - 6), (hx + 12, hy - 5), (hx + 6, hy - 1)]
    elif pose == "windup":
        far_ear  = [(hx - 1, hy - 6), (hx + 4, hy - 11), (hx + 2, hy - 3)]
        near_ear = [(hx + 4, hy - 5), (hx + 12, hy - 7), (hx + 6, hy)]
    elif pose == "blink":
        far_ear  = [(hx - 4, hy - 5), (hx - 11, hy - 7), (hx - 5, hy - 1)]
        near_ear = [(hx + 4, hy - 5), (hx + 11, hy - 9), (hx + 6, hy - 1)]
    else:
        far_ear  = [(hx - 4, hy - 6), (hx - 11, hy - 10), (hx - 5, hy - 2)]
        near_ear = [(hx + 4, hy - 6), (hx + 11, hy - 12), (hx + 6, hy - 1)]

    # Far ear
    sp.polygon(far_ear, FUR_SH1, fill=True)
    sp.line(far_ear[0][0], far_ear[0][1], far_ear[1][0], far_ear[1][1], FUR_HI)
    sp.px(far_ear[1][0], far_ear[1][1], INK_DARK)

    # Near ear
    sp.polygon(near_ear, FUR_MID, fill=True)
    sp.line(near_ear[0][0], near_ear[0][1], near_ear[1][0], near_ear[1][1], FUR_HI)
    in_ear = [
        (near_ear[0][0] + 1, near_ear[0][1] + 1),
        (near_ear[1][0] - 2, near_ear[1][1] + 2),
        (near_ear[2][0] - 1, near_ear[2][1] - 1),
    ]
    sp.polygon(in_ear, FUR_SH3, fill=True)
    sp.px(near_ear[1][0], near_ear[1][1], INK_DARK)

    # 2. Triangular Canine Skull & Flared Shaggy Cheek Ruffs
    paint_disk(sp, hx,     hy - 1, 6.2, FUR_MID)
    paint_disk(sp, hx + 3, hy,     5.6, FUR_MID)
    paint_disk(sp, hx,     hy - 3, 4.2, FUR_HI, only="opaque")   # crisp sunlit forehead
    paint_disk(sp, hx + 3, hy + 3, 4.4, FUR_SH1, only="opaque")  # cheek underside shadow
    # Subtle ambient occlusion pockets right under the antler bases on the brow!
    hspan(sp, hy - 5, hx - 4, hx - 2, FUR_SH2, only="opaque")
    hspan(sp, hy - 5, hx + 1, hx + 3, FUR_SH2, only="opaque")

    # Signature flared shaggy cheek ruffs
    draw_fur_tuft(sp, hx - 5, hy + 1, hx - 10, hy + 2, 1.8, FUR_MID, FUR_SH1)
    draw_fur_tuft(sp, hx - 4, hy + 3, hx - 8,  hy + 5, 1.5, FUR_SH1, FUR_SH2)
    draw_fur_tuft(sp, hx + 5, hy - 1, hx + 12, hy + 1, 2.5, FUR_HI,  FUR_MID)
    draw_fur_tuft(sp, hx + 5, hy + 2, hx + 12, hy + 5, 2.3, FUR_MID, FUR_SH1)
    draw_fur_tuft(sp, hx + 4, hy + 4, hx + 9,  hy + 8, 2.0, FUR_SH1, FUR_SH2)
    # Brow fur crest rising cleanly between antlers
    draw_fur_tuft(sp, hx - 1, hy - 5, hx - 2, hy - 10, 1.7, FUR_HI, FUR_MID)
    draw_fur_tuft(sp, hx + 1, hy - 5, hx + 2, hy - 9,  1.5, FUR_MID, FUR_SH1)

    # 3. Sleek Pointed Wolf Muzzle & Snarling Fanged Jaws
    if pose == "windup":
        # TRUE UPWARD ALPHA HOWL! Long pointed snout angled UP-LEFT cleanly ahead of antlers!
        draw_tapered_stroke(sp, [(hx - 3, hy - 1, 3.2), (hx - 11, hy - 7, 1.9)], FUR_MID)
        draw_tapered_stroke(sp, [(hx - 3, hy - 3, 1.8), (hx - 10, hy - 8, 1.1)], FUR_HI, only="opaque")
        hspan(sp, hy - 9, hx - 12, hx - 11, INK_DARK)
        hspan(sp, hy - 8, hx - 13, hx - 11, INK_DARK)
        sp.px(hx - 12, hy - 9, FUR_SH2)
        maw_pts = [(hx - 11, hy - 6), (hx - 3, hy - 1), (hx - 2, hy + 5), (hx - 10, hy + 2)]
        sp.polygon(maw_pts, MAW_DEEP, fill=True)
        hspan(sp, hy,     hx - 7, hx - 3, MAW_DARK)
        hspan(sp, hy + 1, hx - 8, hx - 4, MAW_PINK)
        draw_tapered_stroke(sp, [(hx - 2, hy + 5, 2.0), (hx - 10, hy + 3, 1.3)], FUR_SH1)
        hspan(sp, hy + 4, hx - 10, hx - 3, FUR_SH2)
        sp.px(hx - 11, hy - 5, PURE_WHT)
        sp.px(hx - 10, hy - 4, PURE_WHT)
        sp.px(hx - 7,  hy - 3, PURE_WHT)
        sp.px(hx - 10, hy + 1, PURE_WHT)
        sp.px(hx - 7,  hy + 2, PURE_WHT)

        # Blazing upturned howling crimson eye!
        sp.line(hx - 1, hy - 3, hx + 3, hy - 4, INK_DARK)
        sp.px(hx,     hy - 2, PURE_WHT)
        sp.px(hx + 1, hy - 2, EYE_GLOW)
        sp.px(hx + 2, hy - 2, EYE_RED)
        sp.px(hx + 3, hy - 3, EYE_RED)
        sp.px(hx + 1, hy - 1, INK_DARK)
        sp.px(hx + 2, hy - 1, MAW_DARK)
        return

    if pose == "strike":
        # LUNGING PREDATORY SNAP LEFT — lowered snout cleanly below brow eyes!
        draw_tapered_stroke(sp, [(hx - 3, hy + 2, 3.2), (hx - 10, hy + 3, 2.0)], FUR_MID)
        draw_tapered_stroke(sp, [(hx - 3, hy + 1, 1.7), (hx - 9,  hy + 2, 1.0)], FUR_HI, only="opaque")
        hspan(sp, hy + 2, hx - 11, hx - 10, INK_DARK)
        hspan(sp, hy + 3, hx - 11, hx - 10, INK_DARK)
        sp.px(hx - 11, hy + 2, FUR_SH2)
        maw_pts = [(hx - 10, hy + 4), (hx - 3, hy + 4), (hx - 2, hy + 10), (hx - 9, hy + 9)]
        sp.polygon(maw_pts, MAW_DEEP, fill=True)
        hspan(sp, hy + 6, hx - 8, hx - 3, MAW_DARK)
        hspan(sp, hy + 7, hx - 8, hx - 4, MAW_PINK)
        draw_tapered_stroke(sp, [(hx - 2, hy + 10, 1.9), (hx - 9, hy + 10, 1.3)], FUR_SH1)
        hspan(sp, hy + 11, hx - 8, hx - 3, FUR_SH2)
        # Razor snapping fangs
        sp.px(hx - 9, hy + 5, PURE_WHT)
        sp.px(hx - 9, hy + 6, PURE_WHT)
        sp.px(hx - 6, hy + 5, PURE_WHT)
        sp.px(hx - 4, hy + 5, PURE_WHT)
        sp.px(hx - 8, hy + 9, PURE_WHT)
        sp.px(hx - 8, hy + 8, PURE_WHT)
        sp.px(hx - 5, hy + 9, PURE_WHT)

    elif pose == "hurt":
        # RECOILING YELP — snout cleanly below wincing `> <` eyes!
        draw_tapered_stroke(sp, [(hx - 3, hy + 2, 3.1), (hx - 9, hy + 3, 2.0)], FUR_MID)
        draw_tapered_stroke(sp, [(hx - 3, hy + 1, 1.7), (hx - 8, hy + 2, 1.0)], FUR_HI, only="opaque")
        hspan(sp, hy + 2, hx - 10, hx - 9, INK_DARK)
        hspan(sp, hy + 3, hx - 10, hx - 9, INK_DARK)
        sp.px(hx - 10, hy + 2, FUR_SH2)
        maw_pts = [(hx - 9, hy + 4), (hx - 2, hy + 5), (hx - 2, hy + 9), (hx - 8, hy + 9)]
        sp.polygon(maw_pts, MAW_DEEP, fill=True)
        hspan(sp, hy + 6, hx - 7, hx - 3, MAW_DARK)
        hspan(sp, hy + 7, hx - 7, hx - 4, MAW_PINK)
        draw_tapered_stroke(sp, [(hx - 2, hy + 9, 1.8), (hx - 8, hy + 10, 1.2)], FUR_SH1)
        sp.px(hx - 8, hy + 5, PURE_WHT)
        sp.px(hx - 5, hy + 5, PURE_WHT)
        sp.px(hx - 7, hy + 8, PURE_WHT)

    else:
        # PROWLING / BLINK: Sleek pointed 3/4-left canine wedge muzzle with snarling upper lip!
        draw_tapered_stroke(sp, [(hx - 2, hy + 1, 3.3), (hx - 6, hy + 5, 2.4), (hx - 9, hy + 7, 1.7)], FUR_MID)
        draw_tapered_stroke(sp, [(hx - 2, hy,     1.8), (hx - 5, hy + 3, 1.3), (hx - 8, hy + 6, 0.9)], FUR_HI, only="opaque")
        sp.px(hx - 5, hy + 3, FUR_SH2)
        sp.px(hx - 4, hy + 4, FUR_SH2)

        # Crisp dark triangular wolf nose!
        hspan(sp, hy + 7, hx - 11, hx - 9, INK_DARK)
        hspan(sp, hy + 8, hx - 10, hx - 9, INK_DARK)
        sp.px(hx - 10, hy + 7, FUR_SH2)

        # Snarling curled upper gumline & open fanged jaws!
        extra = 1 if pose == "blink" else 0
        maw_pts = [
            (hx - 9, hy + 9),
            (hx - 2, hy + 7),
            (hx - 2, hy + 11 + extra),
            (hx - 8, hy + 11 + extra),
        ]
        sp.polygon(maw_pts, MAW_DEEP, fill=True)
        # Crisp dark snarling upper lip edge framing the bared white fangs!
        sp.line(hx - 9, hy + 8, hx - 3, hy + 7, INK_DARK)
        hspan(sp, hy + 9,  hx - 7, hx - 3, MAW_DARK)
        hspan(sp, hy + 10, hx - 7, hx - 4, MAW_PINK)
        chin_y = hy + 11 + extra
        hspan(sp, chin_y,     hx - 8, hx - 2, FUR_SH1)
        hspan(sp, chin_y + 1, hx - 7, hx - 3, FUR_SH2)
        # Crisp gleaming ivory fangs!
        sp.px(hx - 8, hy + 9,  PURE_WHT)
        sp.px(hx - 8, hy + 10, PURE_WHT)
        sp.px(hx - 6, hy + 9,  PURE_WHT)
        sp.px(hx - 4, hy + 8,  PURE_WHT)
        sp.px(hx - 3, hy + 8,  PURE_WHT)
        sp.px(hx - 7, chin_y - 1, PURE_WHT)
        sp.px(hx - 5, chin_y - 1, PURE_WHT)

    # 4. Dramatic V-Furrowed Brow & Piercing Glowing Crimson Boss Wolf Eyes!
    eye_dy = -1 if pose == "strike" else 0
    sp.line(hx - 6, hy - 3 + eye_dy, hx - 3, hy - 1 + eye_dy, FUR_HI)
    sp.line(hx + 5, hy - 3 + eye_dy, hx + 1, hy - 1 + eye_dy, FUR_HI)
    sp.line(hx - 5, hy - 2 + eye_dy, hx - 2, hy + eye_dy,     FUR_SH3)
    sp.line(hx + 4, hy - 2 + eye_dy, hx + 1, hy + eye_dy,     FUR_SH3)

    if pose == "blink":
        # Fierce narrowed growl-blink slits!
        sp.line(hx - 7, hy - 1, hx - 4, hy, INK_DARK)
        sp.px(hx - 5, hy, MAW_DARK)
        sp.line(hx + 1, hy, hx + 4, hy - 1, INK_DARK)
        sp.px(hx + 2, hy + 1, MAW_DARK)
        sp.px(hx + 3, hy, MAW_DARK)

    elif pose == "hurt":
        # Clean, unmistakable wincing/gritted `> <` eyes centered clearly inside the silver brow!
        sp.px(hx - 6, hy - 2, INK_DARK)
        sp.px(hx - 5, hy - 1, INK_DARK)
        sp.px(hx - 6, hy,     INK_DARK)
        sp.px(hx - 4, hy - 1, EYE_RED)
        sp.px(hx - 5, hy,     FUR_HI)   # crisp cheek clearance under far wince
        sp.px(hx + 3, hy - 2, INK_DARK)
        sp.px(hx + 2, hy - 1, INK_DARK)
        sp.px(hx + 3, hy,     INK_DARK)
        sp.px(hx + 1, hy - 1, EYE_RED)
        sp.px(hx + 2, hy,     FUR_HI)   # crisp cheek clearance under near wince

    else:
        # WIDE-SET JEWEL-BRIGHT GLOWING CRIMSON WOLF EYES!
        ey = hy + eye_dy
        # Far eye (left brow — glowing crimson ruby with bright flare!)
        sp.px(hx - 7, ey - 2, INK_DARK)
        sp.px(hx - 6, ey - 1, INK_DARK)
        sp.px(hx - 5, ey - 1, INK_DARK)
        sp.px(hx - 7, ey - 1, EYE_RED)
        sp.px(hx - 6, ey,     EYE_RED)
        sp.px(hx - 5, ey,     PURE_WHT if pose == "strike" else EYE_GLOW)
        sp.px(hx - 6, ey + 1, INK_DARK)

        # Near eye (right brow — razor-sharp upturned predatory crimson almond!)
        sp.px(hx + 1, ey - 1, INK_DARK)
        sp.px(hx + 2, ey - 1, INK_DARK)
        sp.px(hx + 3, ey - 2, INK_DARK)
        sp.px(hx + 4, ey - 2, INK_DARK)
        sp.px(hx + 1, ey,     PURE_WHT if pose == "strike" else EYE_GLOW)
        sp.px(hx + 2, ey,     EYE_GLOW if pose == "strike" else EYE_RED)
        sp.px(hx + 3, ey - 1, EYE_RED)
        sp.px(hx + 4, ey - 1, MAW_DARK)
        sp.px(hx + 2, ey + 1, INK_DARK)
        sp.px(hx + 3, ey,     INK_DARK)


def draw_fx(sp: Sprite, pose: str, hx: int, hy: int, bdx: int, bdy: int):
    """Crisp pixel-art frost glints, windup antler aura & sweeping diagonal triple-claw slash!"""
    sp.layer("fx")

    if pose == "idle2":
        # Crisp 4-point glacial diamond sparkle on upper near antler tine!
        sx = min(W - 4, hx + 13)
        sy = max(4, hy - 34)
        sp.px(sx, sy, PURE_WHT)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sp.px(sx + dx, sy + dy, ICE_HI)
        sp.px(sx, sy - 2, ICE_MID)
        sp.px(sx, sy + 2, ICE_MID)

        # Second bright frost glint on tallest dorsal ice spire
        dx2, dy2 = 52 + bdx, 8 + bdy
        sp.px(dx2, dy2, PURE_WHT)
        sp.px(dx2, dy2 - 1, ICE_HI)
        sp.px(dx2 + 1, dy2, ICE_HI)

        # Third subtle 2px sheen on shoulder ice shard
        sp.px(46 + bdx, 22 + bdy, PURE_WHT)
        sp.px(45 + bdx, 23 + bdy, ICE_HI)

    elif pose == "windup":
        # Glowing cyan frost charge aura crackling around howling antlers & dorsal crown!
        s1x, s1y = max(5, hx - 12), max(5, hy - 27)
        sp.px(s1x, s1y, PURE_WHT)
        for d in (1, 2):
            c = ICE_HI if d == 1 else ICE_MID
            sp.px(s1x + d, s1y, c)
            sp.px(s1x - d, s1y, c)
            sp.px(s1x, s1y + d, c)
            sp.px(s1x, s1y - d, c)

        s2x, s2y = min(W - 5, hx + 15), max(5, hy - 28)
        sp.px(s2x, s2y, PURE_WHT)
        for d in (1, 2, 3):
            c = PURE_WHT if d == 1 else (ICE_HI if d == 2 else ICE_MID)
            sp.px(s2x + d, s2y, c)
            sp.px(s2x - d, s2y, c)
            sp.px(s2x, s2y + d, c)
            sp.px(s2x, s2y - d, c)
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            sp.px(s2x + dx, s2y + dy, ICE_HI)

        # Connected frost energy motes swirling near howling breath & dorsal glacier peak
        for wx, wy in (
            (max(3, hx - 16), max(8, hy - 14)),
            (max(4, hx - 16), max(12, hy - 4)),
            (min(W - 4, 53 + bdx), max(5, 7 + bdy)),
        ):
            sp.px(wx, wy, PURE_WHT)
            sp.px(wx, wy + 1, ICE_HI)
            sp.px(wx + 1, wy + 1, ICE_MID)

    elif pose == "strike":
        # DRAMATIC DIAGONAL-CURVED TRIPLE FROST-CLAW REND ARC radiating cleanly from the slashing paw!
        # Starts cleanly below/ahead of the snarling snout (zero eye/nose tangency!), arcs hard LEFT
        # to x=2..8, y=50..57, and whips down-right to x=9..15, y=64..66!
        arcs = [
            ((8,  42), (0, 53), (9,  65)),
            ((10, 45), (3, 55), (12, 66)),
            ((12, 48), (6, 58), (15, 66)),
        ]
        for arc_idx, (p0, pc, p1) in enumerate(arcs):
            steps = 28
            prev_pt = None
            for i in range(steps + 1):
                t = i / steps
                u = 1.0 - t
                fx = u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0]
                fy = u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1]
                ix = max(2, min(W - 2, int(round(fx))))
                iy = max(2, min(H - 2, int(round(fy))))
                mid_strength = math.sin(t * math.pi)
                c_lead = PURE_WHT if mid_strength > 0.52 else (ICE_HI if mid_strength > 0.22 else ICE_MID)
                c_body = ICE_HI if mid_strength > 0.58 else (ICE_MID if mid_strength > 0.25 else ICE_DEEP)
                if prev_pt is not None:
                    sp.line(prev_pt[0], prev_pt[1], ix, iy, c_lead)
                    if prev_pt[0] != ix and prev_pt[1] != iy:
                        sp.px(ix, prev_pt[1], c_body)
                    if mid_strength > 0.20:
                        sp.line(prev_pt[0] + 1, prev_pt[1], ix + 1, iy, c_body)
                    if arc_idx == 0 and mid_strength > 0.62:
                        sp.line(prev_pt[0] + 2, prev_pt[1], ix + 2, iy, ICE_MID)
                else:
                    sp.px(ix, iy, c_lead)
                    sp.px(ix + 1, iy, c_body)
                prev_pt = (ix, iy)

        # Connected frost impact shards bursting off the leading edge of the claw rend!
        for sx, sy in ((3, 44), (2, 58), (6, 65)):
            sp.px(sx, sy, PURE_WHT)
            sp.px(sx + 1, sy, ICE_HI)
            sp.px(sx + 1, sy + 1, ICE_MID)


# ---------------------------------------------------------------------------
# Material- & Light-Aware Selective Outline (Selout)
# ---------------------------------------------------------------------------

def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected selective outer outline:
    - Translucent ice selout: ICE_DEEP (#2c7ae8) on lit top-left crystal edges,
      INK_ICE (#1a428c) on shadowed bottom-right crystal edges
    - Cool slate FUR_SH2 on top-left lit silver fur curves
    - Deep slate FUR_SH3 on mid-lit fur edges
    - Deep midnight-indigo INK_DARK on underside, shadowed legs, claws & snout
    """
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_cel = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_cel.load()

    rgba_ice_lit = hex2rgba(ICE_DEEP)
    rgba_ice_sh  = hex2rgba(INK_ICE)
    rgba_lit     = hex2rgba(FUR_SH2)
    rgba_mid     = hex2rgba(FUR_SH3)
    rgba_dark    = hex2rgba(INK_DARK)

    ice_rgbs = {
        hex2rgba(PURE_WHT)[:3], hex2rgba(ICE_HI)[:3], hex2rgba(ICE_GLOW)[:3],
        hex2rgba(ICE_MID)[:3], hex2rgba(ICE_SHAD)[:3], hex2rgba(ICE_DEEP)[:3],
    }
    fur_lit_rgbs = {hex2rgba(FUR_HI)[:3], hex2rgba(FUR_MID)[:3]}
    fur_mid_rgbs = fur_lit_rgbs | {hex2rgba(FUR_SH1)[:3]}

    ice_layers = ("far_antler", "near_antler", "dorsal_spines")
    ice_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in ice_layers]
    body_layers = [ln for ln in sp.layer_order if ln not in ("fx", "outline")]
    body_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in body_layers]

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            nbrs = []
            is_ice_nbr = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    if any(bp[nx, ny][3] > 0 for bp in body_pxs):
                        nbrs.append((dx, dy, src[nx, ny][:3]))
                        if any(ip[nx, ny][3] > 0 for ip in ice_pxs):
                            is_ice_nbr = True
            if not nbrs:
                continue

            is_top_left = any(dx == 1 or dy == 1 for dx, dy, _ in nbrs) and not any(dy == -1 for _, dy, _ in nbrs)
            rgb_list = [rgb for _, _, rgb in nbrs]

            if is_ice_nbr and all(rgb in ice_rgbs for rgb in rgb_list):
                dst[x, y] = rgba_ice_lit if is_top_left else rgba_ice_sh
            elif is_top_left and any(rgb in fur_lit_rgbs for rgb in rgb_list) and y < 56:
                dst[x, y] = rgba_lit
            elif is_top_left and any(rgb in fur_mid_rgbs for rgb in rgb_list) and y < 60:
                dst[x, y] = rgba_mid
            else:
                dst[x, y] = rgba_dark


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

# (pose, body_dx, body_dy, head_dx, head_dy, chest_exp, tail_wave, duration_ms)
FRAME_SPECS = [
    ("idle1",   0,  0,  0,  0, 0,  0, 260),
    ("idle2",   0, -1, -1,  1, 1, -3, 260),
    ("blink",   0,  0, -1,  1, 0,  0, 140),
    ("windup",  2,  0,  6, -7, 0, -2, 180),
    ("strike", -1,  0, -2,  0, 0,  0, 160),
    ("hurt",    4,  1,  6, -3, 0,  0, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "far_antler",
        "far_legs",
        "tail",
        "dorsal_spines",
        "torso",
        "near_legs",
        "head",
        "near_antler",
        "fx",
    ]
    sp.frames[0].cels = {ln: sp._blank() for ln in sp.layer_order}

    for _ in range(1, N_FRAMES):
        sp.add_frame(copy=False)

    anchors = {}

    for idx, (pose, bdx, bdy, hdx, hdy, chest_exp, tw, dur) in enumerate(FRAME_SPECS, start=1):
        sp.frame(idx)
        sp.set_duration(dur)

        hx = 24 + bdx + hdx
        hy = 38 + bdy + hdy

        draw_antlers(sp, "far_antler", hx, hy, pose, antler_sparkle=(pose == "idle2"))
        draw_far_legs(sp, pose, bdx, bdy)
        draw_tail(sp, pose, bdx, bdy, tw)
        draw_dorsal_spines(sp, pose, bdx, bdy)
        draw_torso(sp, pose, bdx, bdy, chest_exp)
        draw_near_legs(sp, pose, bdx, bdy)
        draw_head(sp, hx, hy, pose)
        draw_antlers(sp, "near_antler", hx, hy, pose, antler_sparkle=(pose == "idle2"))
        draw_fx(sp, pose, hx, hy, bdx, bdy)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (hx, hy)
            anchors["hit_px"] = (42, 37)
        if pose == "strike":
            anchors["cast_px"] = (5, 53)

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
        ("3x Light Sky #DCE7F6 (Red=Ground Anchor, Cyan=Cast Anchor, Gold=Hit Center)", (220, 231, 246), 0),
        ("3x Dark Dusk #2A344B", (42, 52, 75), fh + 24),
    ]

    ax, ay = PIVOT_X, GROUND_Y
    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]

    for label, bg_rgb, oy in bgs:
        draw.rectangle([0, oy, row_w - 1, oy + fh + 23], fill=bg_rgb)
        draw.text((pad, oy + 4), label, fill=(28, 36, 56) if bg_rgb[0] > 128 else (225, 235, 250))
        for i in range(N_FRAMES):
            ox = pad + i * (fw + pad)
            fy = oy + 20
            draw.line([(ox, fy + ay * scale), (ox + fw - 1, fy + ay * scale)],
                      fill=(185, 198, 218) if bg_rgb[0] > 128 else (65, 78, 105))
            im = sp.composite(i + 1).resize((fw, fh), NEAREST)
            canvas.paste(im, (ox, fy), im)
            rx, ry = ox + ax * scale + scale // 2, fy + ay * scale + scale // 2
            draw.ellipse([rx - 3, ry - 3, rx + 3, ry + 3], fill=(235, 45, 65), outline=(255, 255, 255))
            if i == 0:
                hx_m, hy_m = ox + hit_x * scale + scale // 2, fy + hit_y * scale + scale // 2
                draw.ellipse([hx_m - 3, hy_m - 3, hx_m + 3, hy_m + 3], fill=(245, 200, 60), outline=(40, 30, 10))
            if i == 4:
                cx_m, cy_m = ox + cast_x * scale + scale // 2, fy + cast_y * scale + scale // 2
                draw.ellipse([cx_m - 3, cy_m - 3, cx_m + 3, cy_m + 3], fill=(40, 225, 255), outline=(16, 40, 90))

    oy3 = (fh + 24) * 2
    draw.rectangle([0, oy3, row_w // 2, total_h - 1], fill=(220, 231, 246))
    draw.rectangle([row_w // 2, oy3, row_w - 1, total_h - 1], fill=(42, 52, 75))
    draw.text((pad, oy3 + 4), "1x Native Scale (Light Sky)", fill=(28, 36, 56))
    draw.text((row_w // 2 + pad, oy3 + 4), "1x Native Scale (Dark Dusk)", fill=(225, 235, 250))
    for i in range(N_FRAMES):
        im = sp.composite(i + 1)
        canvas.paste(im, (pad + i * (W + 4), oy3 + 20), im)
        canvas.paste(im, (row_w // 2 + pad + i * (W + 4), oy3 + 20), im)

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


def render_head_zoom(sp: Sprite, path: str, scale: int = 10):
    x0, y0, x1, y1 = 1, 1, 46, 56
    cw, ch = (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale
    sep = 4
    out = Image.new("RGB", (N_FRAMES * cw + (N_FRAMES + 1) * sep, ch + 2 * sep), (218, 228, 244))
    for i in range(N_FRAMES):
        crop = sp.composite(i + 1).crop((x0, y0, x1 + 1, y1 + 1)).resize((cw, ch), NEAREST)
        out.paste(crop, (sep + i * (cw + sep), sep), crop)
    out.save(path)
    print(f"head_zoom -> {path}")


def main():
    sp, anchors = build_sprite()
    info = sp.stats(print_=True)

    # Strict pixel-hygiene assertions across all 6 frames
    assert info["semi_alpha_px"] == 0, f"Expected 0 semi-alpha px, got {info['semi_alpha_px']}"
    assert not info["near_duplicate_colors"], f"Unexpected near-dup colors: {info['near_duplicate_colors']}"
    for fi in range(1, N_FRAMES + 1):
        sp.frame(fi)
        st = sp.stats(print_=False)
        assert not st["isolated_px"], f"Frame {fi} has isolated px: {st['isolated_px']}"

    # Verify zero canvas-edge clipping (1px safety margin on top/left/right)
    for fi in range(1, N_FRAMES + 1):
        im = sp.composite(fi)
        px = im.load()
        top_hit = [x for x in range(W) if px[x, 0][3] > 0]
        left_hit = [y for y in range(H) if px[0, y][3] > 0]
        right_hit = [y for y in range(H) if px[W - 1, y][3] > 0]
        assert not top_hit, f"Frame {fi} clips top edge at x={top_hit[:5]}"
        assert not left_hit, f"Frame {fi} clips left edge at y={left_hit[:5]}"
        assert not right_hit, f"Frame {fi} clips right edge at y={right_hit[:5]}"

    # Verify exact ground baseline lock on GROUND_Y for idle frames 1..3
    for fi in (1, 2, 3):
        near_cel = sp.frames[fi - 1].cels["near_legs"]
        far_cel = sp.frames[fi - 1].cels["far_legs"]
        ys_n = [y for y in range(H) for x in range(W) if near_cel.getpixel((x, y))[3] > 0]
        ys_f = [y for y in range(H) for x in range(W) if far_cel.getpixel((x, y))[3] > 0]
        assert max(ys_n) == GROUND_Y, f"Frame {fi} near paw baseline {max(ys_n)} != {GROUND_Y}"
        assert max(ys_f) == GROUND_Y, f"Frame {fi} far paw baseline {max(ys_f)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "wolf_alpha",
        "file": "assets/sprites/wolf_alpha_sheet.png",
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
        "buildScript": "tools/pixel_art/wolf_alpha/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=5)
    render_head_zoom(sp, HEAD_ZOOM_PATH, scale=10)


if __name__ == "__main__":
    main()
