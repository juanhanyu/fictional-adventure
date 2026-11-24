#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Noelle (14yo, Asla Academy Water Top-Student Rival).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 72 x 80, 6 horizontal frames (432 x 80 sheet, padding=0).
Facing: left. GROUND_Y = 74, PIVOT_X = 38.

Pass 3 (Final Jewelry-Grade Polish):
- Butter-smooth rounded chestnut bob silhouette (zero left-temple jaggy, refined back-bob strand sheen)
- Feathered natural bangs with crisp forehead breathing room above brows (no rectangular window cutouts)
- Expressive cool-rival -> fierce-battle eye shift: sleek level winged lashes & composed brows in idle,
  razor-angled fierce lashes & brows in windup/strike, crisp single-pixel PURE_WHT catchlights on both eyes
- Clean 3px sky clearance above head crown for windup curved Bezier water veil + zero thorn artifacts
  in silhouette across all 6 frames
- Coiling calligraphic azure water ribbon in idle/blink & razor-sharp pressurized hydro jet in strike
- Exact GROUND_Y = 74 shoe baseline lock, 0 semi-alpha px, 0 isolated px, 0 near-duplicate colors
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
W, H = 72, 80
N_FRAMES = 6
GROUND_Y = 74
PIVOT_X = 38

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "noelle_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "noelle_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 31-Color Hue-Shifted Anime JRPG Palette (all pairs >12 channel dist!)
# ---------------------------------------------------------------------------
PURE_WHT = "#ffffff"  # Eye catchlights, bright sclera, razor water jet core flash
WTR_FOAM = "#e6fbff"  # Shimmering azure water mist/foam highlight
WHT_SHRT = "#e8eaf6"  # Crisp white academy shirt collar & bright silver wand highlight
SLV_MID  = "#b5c2db"  # Silver wand shaft, white shirt fold shadow, tie light stripe
SLV_SH   = "#798aa8"  # Silver wand shaded edge & deep collar crease

# Chestnut-brown bob hair & polished academy loafers (exact prompt anchors!)
HAIR_HI2 = "#bd8468"  # Warm caramel-chestnut angel-ring sheen & polished shoe glint
HAIR_HI1 = "#8a5844"  # Warm cinnamon-chestnut mid-highlight & shoe lit edge
HAIR_MID = "#5e3a2c"  # Rich chestnut hair base & loafer midtone
HAIR_SH2 = "#3b241c"  # Deep espresso-chestnut hair shadow, brows & loafer shade
INK_HAIR = "#261614"  # Deep warm espresso-plum hair selective outline

# Determined sharp amber-gold anime eyes (exact prompt anchors!)
EYE_DARK = "#5c3810"  # Deep roasted amber upper iris
EYE_MID  = "#b8741e"  # Rich honey-amber mid iris
EYE_HI   = "#f2c04c"  # Luminous molten-gold lower iris crescent

# Porcelain anime skin
SKIN_HI  = "#fff0e8"  # Lit ivory forehead/cheek highlight
SKIN_MID = "#f7d4c4"  # Fair porcelain anime skin base
SKIN_SH1 = "#dca390"  # Soft peach skin shadow
SKIN_SH2 = "#b57468"  # Chin/neck rose-umber shadow & stoic rival mouth
INK_SKIN = "#875254"  # Warm muted rose-umber jaw/hand selective outline
BLUSH    = "#eb94a6"  # Subtle rival cheek blush & open battle shout mouth interior

# Asla Academy dark-navy hooded mage cloak, striped tie, skirt & dark socks
NVY_HI   = "#4e6ba6"  # Sunlit slate-navy cloak fold, hood ridge & tie stripe
NVY_MID  = "#31477a"  # Academy dark-navy cloak & pleated skirt base
NVY_SH1  = "#1f2e57"  # Deep academy navy shadow & dark academy socks
NVY_SH2  = "#121a38"  # Deepest cloak lining, pleat trough & sock shadow

# Antique champagne-gold cloak trim & leaf academy emblem
GLD_HI   = "#f5db8a"  # Gleaming champagne-gold lapel highlight & crest gleam
GLD_MID  = "#c49b52"  # Refined antique-gold cloak trim & leaf crest
GLD_SH   = "#85622c"  # Burnished antique-gold shadow

# Translucent shimmering azure water veil & wand crystal (exact prompt anchors!)
WTR_DEEP = "#184ca8"  # Deep hydro-sapphire wand crystal base & water contrast edge
WTR_MID  = "#2c7ae8"  # Vivid clear azure water ribbon core
WTR_HI   = "#6ed4ff"  # Luminous aqua-cyan water veil shimmer

# Selective outlines (never pure black!)
INK_DARK = "#171426"  # Deep cool indigo-plum shadow ink & crisp upper lashes
INK_MID  = "#434c70"  # Mid cool slate selective outline for lit navy/silver edges

PALETTE = [
    PURE_WHT, WTR_FOAM, WHT_SHRT, SLV_MID, SLV_SH,
    HAIR_HI2, HAIR_HI1, HAIR_MID, HAIR_SH2, INK_HAIR,
    EYE_DARK, EYE_MID, EYE_HI,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, INK_SKIN, BLUSH,
    NVY_HI, NVY_MID, NVY_SH1, NVY_SH2,
    GLD_HI, GLD_MID, GLD_SH,
    WTR_DEEP, WTR_MID, WTR_HI,
    INK_DARK, INK_MID,
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hspan(sp: Sprite, y: int, x0: int, x1: int, col: str, only=None):
    if x1 < x0:
        x0, x1 = x1, x0
    for x in range(int(x0), int(x1) + 1):
        sp.px(x, int(y), col, only=only)


def bresenham_pts(x0: int, y0: int, x1: int, y1: int) -> list[tuple[int, int]]:
    pts = []
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    adx, ady = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = adx + ady
    cx, cy = x0, y0
    while True:
        pts.append((cx, cy))
        if cx == x1 and cy == y1:
            break
        e2 = 2 * err
        if e2 >= ady:
            err += ady
            cx += sx
        if e2 <= adx:
            err += adx
            cy += sy
    return pts


def sample_cubic_bezier(p0, p1, p2, p3, steps: int = 48) -> list[tuple[int, int]]:
    """Sample a smooth cubic Bezier curve into deduplicated, strictly 4-connected integer pixels."""
    raw = []
    for k in range(steps + 1):
        t = k / steps
        mt = 1.0 - t
        x = (mt**3) * p0[0] + 3 * (mt**2) * t * p1[0] + 3 * mt * (t**2) * p2[0] + (t**3) * p3[0]
        y = (mt**3) * p0[1] + 3 * (mt**2) * t * p1[1] + 3 * mt * (t**2) * p2[1] + (t**3) * p3[1]
        pt = (int(round(x)), int(round(y)))
        if not raw or raw[-1] != pt:
            raw.append(pt)

    connected = []
    for pt in raw:
        if not connected:
            connected.append(pt)
            continue
        prev = connected[-1]
        if abs(pt[0] - prev[0]) > 1 or abs(pt[1] - prev[1]) > 1:
            seg = bresenham_pts(prev[0], prev[1], pt[0], pt[1])[1:]
        else:
            seg = [pt]
        for s in seg:
            p = connected[-1]
            if s == p:
                continue
            if abs(s[0] - p[0]) == 1 and abs(s[1] - p[1]) == 1:
                connected.append((s[0], p[1]))
            connected.append(s)
    return connected


def draw_bezier_water_ribbon(sp: Sprite, curves: list[tuple], thick_start: float = 0.16,
                             thick_end: float = 0.84, phase: int = 0, edge_dir=(0, 1)):
    """Draw a silky, fluid parametric Bezier azure water ribbon (100% opaque, ZERO isolated px!)."""
    full_pts = []
    for (p0, p1, p2, p3) in curves:
        seg = sample_cubic_bezier(p0, p1, p2, p3, steps=48)
        if full_pts and seg and full_pts[-1] == seg[0]:
            full_pts.extend(seg[1:])
        else:
            if full_pts and seg:
                bridge = bresenham_pts(full_pts[-1][0], full_pts[-1][1], seg[0][0], seg[0][1])[1:]
                for b in bridge:
                    p = full_pts[-1]
                    if abs(b[0] - p[0]) == 1 and abs(b[1] - p[1]) == 1:
                        full_pts.append((b[0], p[1]))
                    full_pts.append(b)
                full_pts.extend(seg[1:])
            else:
                full_pts.extend(seg)

    n = max(1, len(full_pts) - 1)
    edx, edy = edge_dir
    for i, (px_w, py_w) in enumerate(full_pts):
        t = i / n
        if not (1 <= px_w <= W - 2 and 1 <= py_w <= H - 2):
            continue
        shimmer = (i + phase) % 6
        if thick_start <= t <= thick_end:
            if shimmer == 0:
                core_col, back_col = WTR_FOAM, WTR_HI
            elif shimmer in (1, 2):
                core_col, back_col = WTR_HI, WTR_MID
            elif shimmer in (3, 4):
                core_col, back_col = WTR_MID, WTR_DEEP
            else:
                core_col, back_col = WTR_HI, WTR_MID
            sp.px(px_w, py_w, core_col)
            bx = max(1, min(W - 2, px_w + edx))
            by = max(1, min(H - 2, py_w + edy))
            sp.px(bx, by, back_col)
        else:
            col = WTR_HI if (0.06 < t < 0.94 and shimmer < 3) else WTR_MID
            sp.px(px_w, py_w, col)


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected selective outer outline with material- and light-aware tinting (TOP-LEFT lit)."""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_hair_lit = hex2rgba(HAIR_SH2)
    rgba_ink_hair = hex2rgba(INK_HAIR)
    rgba_ink_mid  = hex2rgba(INK_MID)
    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_ink_skin = hex2rgba(INK_SKIN)
    rgba_wtr_deep = hex2rgba(WTR_DEEP)

    hair_set = {
        hex2rgba(HAIR_HI2)[:3], hex2rgba(HAIR_HI1)[:3],
        hex2rgba(HAIR_MID)[:3], hex2rgba(HAIR_SH2)[:3],
    }
    hair_lit_set = {hex2rgba(HAIR_HI2)[:3], hex2rgba(HAIR_HI1)[:3], hex2rgba(HAIR_MID)[:3]}
    skin_set = {
        hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3],
        hex2rgba(SKIN_SH1)[:3], hex2rgba(BLUSH)[:3],
    }
    silver_set = {
        hex2rgba(WHT_SHRT)[:3], hex2rgba(SLV_MID)[:3],
        hex2rgba(SLV_SH)[:3], hex2rgba(PURE_WHT)[:3],
    }
    water_set = {
        hex2rgba(WTR_FOAM)[:3], hex2rgba(WTR_HI)[:3],
        hex2rgba(WTR_MID)[:3], hex2rgba(WTR_DEEP)[:3],
    }
    gold_set = {hex2rgba(GLD_HI)[:3], hex2rgba(GLD_MID)[:3]}
    nvy_lit_set = {hex2rgba(NVY_HI)[:3], hex2rgba(NVY_MID)[:3]}

    weap_cel = sp.frames[frame_idx - 1].cels.get("weapon")
    weap_px = weap_cel.load() if weap_cel else None
    body_layers = [ln for ln in sp.layer_order if ln not in ("fx", "outline")]
    body_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in body_layers]

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            nbrs = []
            is_weap_nbr = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    if any(bp[nx, ny][3] > 0 for bp in body_pxs):
                        nbrs.append((dx, dy, src[nx, ny][:3]))
                        if weap_px and weap_px[nx, ny][3] > 0:
                            is_weap_nbr = True
            if not nbrs:
                continue

            is_top_left = any(dx == 1 or dy == 1 for dx, dy, _ in nbrs) and not any(dy == -1 for _, dy, _ in nbrs)
            rgb_list = [rgb for _, _, rgb in nbrs]

            if is_weap_nbr and any(rgb in water_set for rgb in rgb_list):
                dst[x, y] = rgba_wtr_deep
            elif is_weap_nbr and any(rgb in silver_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_mid if is_top_left else rgba_ink_dark
            elif any(rgb in skin_set for rgb in rgb_list) and y < 38:
                dst[x, y] = rgba_ink_skin
            elif y < 38 and all(rgb in hair_set for rgb in rgb_list):
                if is_top_left and any(rgb in hair_lit_set for rgb in rgb_list):
                    dst[x, y] = rgba_hair_lit
                else:
                    dst[x, y] = rgba_ink_hair
            elif is_top_left and any(rgb in gold_set or rgb in nvy_lit_set or rgb in silver_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_mid
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Anatomical & Outfit Layer Painters (facing="left", TOP-LEFT lit)
# ---------------------------------------------------------------------------

def draw_back_cloak(sp: Sprite, cx: int, neck_y: int, waist_y: int, pose: str, sway: int):
    """Draped dark-navy Asla Academy mage hood resting behind shoulders + sculpted billowing back cloak."""
    sp.layer("back_cloak")

    # 1) Iconic folded academy hood cowl draped behind neck & right shoulder (matches noelle_normal.png!)
    hood_shift = 2 if pose == "strike" else (1 if pose == "hurt" else 0)
    hood_rows = {
        -2: (5,  11 + hood_shift),
        -1: (4,  13 + hood_shift),
        0:  (3,  14 + hood_shift),
        1:  (2,  15 + hood_shift),
        2:  (2,  16 + hood_shift),
        3:  (3,  16 + hood_shift),
        4:  (4,  15 + hood_shift),
        5:  (5,  14 + hood_shift),
        6:  (6,  13 + hood_shift),
        7:  (7,  11 + hood_shift),
    }
    for dy, (dl, dr) in hood_rows.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, NVY_SH1)
        if dy <= 1:
            hspan(sp, y, cx + dl, cx + min(dr - 2, dl + 6), NVY_MID)
            if dy in (-2, -1):
                hspan(sp, y, cx + dl + 1, cx + min(dr - 3, dl + 5), NVY_HI)
        if 1 <= dy <= 5:
            sp.px(cx + dr - 3, y, NVY_MID)
            sp.px(cx + dr - 2, y, NVY_HI if dy in (1, 2) else NVY_MID)
            sp.px(cx + dr - 1, y, NVY_SH2)
            sp.px(cx + dr, y, NVY_SH2)
        if dy >= 5:
            hspan(sp, y, cx + dl, cx + dr - 2, NVY_SH2)

    # 2) Sculpted curved back cloak hem sweeping smoothly behind pleated skirt!
    top_y = neck_y + 7
    bot_y = waist_y + 15
    if pose == "strike":
        billow = 6
    elif pose == "hurt":
        billow = 4
    elif pose == "windup":
        billow = 2
    else:
        billow = 1 + sway

    for i in range(bot_y - top_y + 1):
        y = top_y + i
        t = i / max(1, bot_y - top_y)
        curve = math.sin(t * math.pi * 0.65)
        lx = int(round(cx - 7 - t * 2.6 + (1 if pose == "strike" else 0)))
        rx = int(round(cx + 8 + (t ** 0.85) * (5.2 + billow) + curve * 1.3))
        rx = min(W - 3, rx)
        lx = max(2, lx)

        # Gracefully contoured lower cloak edge dipping at trailing right corner
        if i == bot_y - top_y:
            hspan(sp, y, rx - 6, rx - 1, NVY_SH2)
            hspan(sp, y, rx - 5, rx - 2, GLD_SH)
            continue
        if i == bot_y - top_y - 1:
            hspan(sp, y, lx + 2, rx, NVY_SH2)
            hspan(sp, y, rx - 7, rx - 1, GLD_MID)
            sp.px(rx - 3, y, GLD_HI)
            hspan(sp, y, lx + 2, lx + 4, GLD_SH)
            continue

        hspan(sp, y, lx, rx, NVY_SH2)
        if rx - lx > 6:
            f1 = rx - 2
            f2 = rx - 6
            sp.px(f1, y, NVY_MID if t < 0.80 else NVY_SH1)
            sp.px(f1 - 1, y, NVY_SH1)
            if f2 > lx + 2:
                sp.px(f2, y, NVY_SH1)
                if t < 0.65:
                    sp.px(f2 - 1, y, NVY_MID)


def draw_back_hair(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Butter-smooth rounded chestnut-brown short bob back volume + delicate tapered nape wisps."""
    sp.layer("back_hair")

    sw = sway + (2 if pose == "strike" else (1 if pose == "hurt" else 0))
    # Continuous smooth elliptical bob silhouette (zero side-indent notch!)
    bob_rows = {
        6:  (8,  13),
        7:  (8,  14),
        8:  (8,  15),
        9:  (8,  15),
        10: (8,  15),
        11: (8,  15),
        12: (8,  15),
        13: (8,  15),
        14: (8,  15),
        15: (8,  15),
        16: (8,  15),
        17: (8,  15),
        18: (8,  14),
        19: (7,  14),
        20: (7,  13),
        21: (7,  13),
        22: (6,  12 + (1 if sw > 0 else 0)),
        23: (6,  11 + (1 if sw > 0 else 0)),
        24: (5,  10 + (1 if sw > 1 else 0)),
        25: (4,   9 + (1 if sw > 1 else 0)),
        26: (4,   8 + (1 if sw > 1 else 0)),
        27: (4,   6 + (1 if sw > 1 else 0)),
    }
    for dy, (dl, dr) in bob_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, HAIR_MID)
        # Sleek narrow curved highlight strand along upper-mid dome (NOT a boxy side patch!)
        if 7 <= dy <= 11:
            sp.px(cx + dl + 2, y, HAIR_HI1)
            sp.px(cx + dl + 3, y, HAIR_HI2 if dy in (8, 9) else HAIR_HI1)
        elif 12 <= dy <= 16:
            sp.px(cx + dl + 3, y, HAIR_HI1)
        # Deep espresso-chestnut shadow wrapping smoothly along outer-back curve & nape
        hspan(sp, y, cx + dr - 2, cx + dr, HAIR_SH2)
        if dy >= 21:
            hspan(sp, y, cx + dl, cx + dr, HAIR_SH2)
            if dy <= 24:
                sp.px(cx + dl + 2, y, HAIR_MID)

    # Clean tucked feathery nape wisp right behind ear (no stray outer speck!)
    sp.px(cx + 5, head_y + 27, HAIR_MID)
    sp.px(cx + 5, head_y + 28, HAIR_SH2)
    sp.px(cx + 6, head_y + 28, HAIR_SH2)
    if sw > 0:
        sp.px(cx + 8, head_y + 27, HAIR_SH2)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Porcelain anime thigh peek + dark academy knee socks + neat polished chestnut loafers."""
    sp.layer("legs")

    if pose == "strike":
        far_fx, far_fy = cx - 9, ground_y
        near_fx, near_fy = cx + 6, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2
    elif pose == "windup":
        far_fx, far_fy = cx - 6, ground_y
        near_fx, near_fy = cx + 3, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 1
    elif pose == "hurt":
        far_fx, far_fy = cx - 7, ground_y - 1
        near_fx, near_fy = cx + 3, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2
    else:
        far_fx, far_fy = cx - 6, ground_y
        near_fx, near_fy = cx + 2, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 1

    hip_y = ground_y - 15  # y = 59

    def _draw_one_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        sock_top_y = hip_y + 3
        shoe_top_y = foot_y - 4

        skin_hi = SKIN_MID if is_far else SKIN_HI
        skin_md = SKIN_SH1 if is_far else SKIN_MID
        skin_sh = SKIN_SH2 if is_far else SKIN_SH1

        sock_hi = NVY_MID if is_far else NVY_HI
        sock_md = NVY_SH1 if is_far else NVY_MID
        sock_sh = NVY_SH2

        shoe_hi = HAIR_MID if is_far else HAIR_HI1
        shoe_md = HAIR_SH2 if is_far else HAIR_MID
        shoe_sh = INK_HAIR if is_far else HAIR_SH2

        span_h = max(1, shoe_top_y - hip_y)
        for y in range(hip_y, shoe_top_y + 1):
            t = (y - hip_y) / span_h
            lx = int(round(top_x + (foot_x - top_x) * t))
            w = 4 if t < 0.36 else 3
            if y < sock_top_y:
                if y == hip_y:
                    hspan(sp, y, lx, lx + w - 1, skin_sh)
                else:
                    hspan(sp, y, lx, lx + w - 1, skin_md)
                    sp.px(lx, y, skin_hi)
                    sp.px(lx + w - 1, y, skin_sh)
            else:
                hspan(sp, y, lx, lx + w - 1, sock_md)
                sp.px(lx, y, sock_hi)
                sp.px(lx + w - 1, y, sock_sh)
                if y == sock_top_y:
                    hspan(sp, y, lx, lx + w - 1, NVY_SH2 if is_far else NVY_SH1)
                    sp.px(lx, y, sock_md)

        # Neat polished chestnut academy loafers pointing LEFT!
        bx = foot_x
        hspan(sp, shoe_top_y, bx, bx + 2, shoe_md)
        sp.px(bx, shoe_top_y, shoe_hi)
        sp.px(bx + 2, shoe_top_y, shoe_sh)

        hspan(sp, foot_y - 3, bx - 1, bx + 2, shoe_md)
        sp.px(bx - 1, foot_y - 3, shoe_hi)
        sp.px(bx, foot_y - 3, GLD_HI if not is_far else GLD_SH)
        sp.px(bx + 2, foot_y - 3, shoe_sh)

        hspan(sp, foot_y - 2, bx - 2, bx + 2, shoe_md)
        hspan(sp, foot_y - 2, bx - 1, bx, shoe_hi)
        if not is_far:
            sp.px(bx - 1, foot_y - 2, HAIR_HI2)
        sp.px(bx + 2, foot_y - 2, shoe_sh)

        hspan(sp, foot_y - 1, bx - 2, bx + 2, shoe_md)
        sp.px(bx - 1, foot_y - 1, shoe_hi)
        sp.px(bx + 2, foot_y - 1, shoe_sh)

        hspan(sp, foot_y, bx - 2, bx + 2, INK_HAIR)
        sp.px(bx - 1, foot_y, shoe_sh)

    _draw_one_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_one_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_far_arm(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Far (right) academy dark-navy robe sleeve + gold cuff trim + porcelain spell-weaving hand."""
    sp.layer("far_arm")
    sx, sy = cx - 5, torso_y + 2

    if pose == "strike":
        hx, hy = cx - 6, torso_y + 11
    elif pose == "windup":
        hx, hy = cx - 15, torso_y + 3
    elif pose == "hurt":
        hx, hy = cx - 13, torso_y + 4
    else:
        hx, hy = cx - 10, torso_y + 11

    mid_x = (sx + hx) // 2
    mid_y = (sy + hy) // 2

    sp.polygon([
        (sx + 1, sy),
        (sx - 3, sy + 1),
        (mid_x - 2, mid_y + 1),
        (mid_x + 1, mid_y + 2),
        (sx + 1, sy + 4),
    ], NVY_MID, fill=True)
    sp.line(sx - 2, sy + 1, mid_x - 2, mid_y + 1, NVY_HI)
    sp.line(sx, sy + 2, mid_x + 1, mid_y + 2, NVY_SH1)

    sp.line(mid_x, mid_y + 1, hx + 1, hy - 1, NVY_MID)
    sp.line(mid_x - 1, mid_y + 1, hx, hy - 1, NVY_HI)
    sp.line(mid_x + 1, mid_y + 2, hx + 1, hy, NVY_SH1)

    sp.px(hx + 1, hy - 2, GLD_MID)
    sp.px(hx, hy - 2, GLD_HI)
    sp.px(hx + 1, hy - 1, WHT_SHRT)

    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)


def draw_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Tailored Asla Academy dark-navy pleated skirt with crisp antique-gold hem stripe."""
    sp.layer("skirt")
    skirt_h = 11

    if pose == "strike":
        shift_bot = 3
        flare_l, flare_r = 9, 10
    elif pose == "hurt":
        shift_bot = -1
        flare_l, flare_r = 9, 9
    elif pose == "windup":
        shift_bot = 1
        flare_l, flare_r = 8, 9
    else:
        shift_bot = sway
        flare_l, flare_r = 8, 9

    for i in range(skirt_h + 1):
        y = waist_y + i
        t = i / skirt_h
        e = t ** 0.88
        lx = int(round(cx - 5 - flare_l * e + shift_bot * t))
        rx = int(round(cx + 5 + flare_r * e + shift_bot * t))

        span = max(1, rx - lx)
        for x in range(lx, rx + 1):
            u = (x - lx) / span
            pleat = (u * 4.4) % 1.0
            if u < 0.14:
                col = NVY_HI if i > 1 else NVY_MID
            elif u > 0.84:
                col = NVY_SH2
            elif pleat < 0.28:
                col = NVY_SH2 if u > 0.48 else NVY_SH1
            elif pleat < 0.66:
                col = NVY_MID if u < 0.62 else NVY_SH1
            else:
                col = NVY_HI if u < 0.56 else NVY_MID
            sp.px(x, y, col)

        if i == 0:
            hspan(sp, y, lx, rx, NVY_SH2)

        if i == skirt_h - 2:
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                pleat = (u * 4.4) % 1.0
                if pleat < 0.25 or u > 0.82:
                    gcol = GLD_SH
                elif u < 0.22 or (u < 0.52 and pleat > 0.52):
                    gcol = GLD_HI
                else:
                    gcol = GLD_MID
                sp.px(x, y, gcol)
        elif i == skirt_h:
            hspan(sp, y, lx, rx, NVY_SH2)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str, sway: int):
    """Crisp white collared shirt + navy diagonal-striped academy tie +
    Asla Academy dark-navy hooded mage cloak with gold-trimmed lapel & gold leaf crest!"""
    sp.layer("torso")

    # 1) Slender porcelain neck with crisp chin shadow
    for y in range(neck_y - 2, neck_y + 1):
        hspan(sp, y, cx - 2, cx + 1, SKIN_SH1)
        sp.px(cx - 2, y, SKIN_MID)
        sp.px(cx + 1, y, SKIN_SH2)
    hspan(sp, neck_y - 2, cx - 2, cx + 1, SKIN_SH2)

    # 2) Crisp folded white academy shirt collar
    hspan(sp, neck_y, cx - 4, cx + 3, WHT_SHRT)
    sp.px(cx - 4, neck_y, PURE_WHT)
    sp.px(cx - 3, neck_y, PURE_WHT)
    sp.px(cx + 3, neck_y, SLV_MID)
    hspan(sp, neck_y + 1, cx - 4, cx + 3, WHT_SHRT)
    sp.px(cx - 4, neck_y + 1, PURE_WHT)
    sp.px(cx + 2, neck_y + 1, SLV_MID)
    sp.px(cx + 3, neck_y + 1, SLV_SH)

    # 3) Tailored dark-navy mage cloak bodice
    cloak_torso = {
        2:  (-6, 7),
        3:  (-7, 7),
        4:  (-7, 7),
        5:  (-6, 7),
        6:  (-6, 7),
        7:  (-6, 7),
        8:  (-6, 7),
        9:  (-6, 7),
        10: (-6, 7),
        11: (-6, 7),
        12: (-6, 8),
        13: (-7, 8),
    }
    for dy, (dl, dr) in cloak_torso.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, NVY_MID)
        hspan(sp, y, cx + dl, cx + dl + 2, NVY_HI if dy < 9 else NVY_MID)
        hspan(sp, y, cx + dr - 2, cx + dr, NVY_SH1)
        sp.px(cx + dr, y, NVY_SH2)

    # 4) Open V-neck showing crisp white shirt + navy diagonal-striped academy tie!
    v_rows = {
        2: (-4, 1),
        3: (-4, 0),
        4: (-3, 0),
        5: (-3, -1),
        6: (-2, -1),
    }
    for dy, (dl, dr) in v_rows.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, WHT_SHRT)
        sp.px(cx + dl, y, PURE_WHT if dy <= 3 else WHT_SHRT)
        if dr > dl:
            sp.px(cx + dr, y, SLV_MID)

    sp.px(cx - 4, neck_y + 2, PURE_WHT)
    sp.px(cx + 1, neck_y + 2, WHT_SHRT)

    tx = cx - 2
    sp.px(tx,     neck_y + 2, NVY_SH1)
    sp.px(tx + 1, neck_y + 2, NVY_MID)
    sp.px(tx,     neck_y + 3, NVY_MID)
    sp.px(tx + 1, neck_y + 3, SLV_MID)
    sp.px(tx,     neck_y + 4, SLV_MID)
    sp.px(tx + 1, neck_y + 4, NVY_SH1)
    sp.px(tx,     neck_y + 5, NVY_MID)
    sp.px(tx + 1, neck_y + 5, NVY_SH2)
    sp.px(tx,     neck_y + 6, NVY_SH1)

    # 5) Antique-Gold Piped Cloak Trim + Front Button
    sp.px(cx - 5, neck_y + 2, GLD_HI)
    sp.px(cx - 5, neck_y + 3, GLD_HI)
    sp.px(cx - 4, neck_y + 4, GLD_HI)
    sp.px(cx - 4, neck_y + 5, GLD_MID)
    sp.px(cx - 3, neck_y + 6, GLD_MID)

    sp.px(cx + 2, neck_y + 2, GLD_MID)
    sp.px(cx + 1, neck_y + 3, GLD_MID)
    sp.px(cx + 1, neck_y + 4, GLD_MID)
    sp.px(cx,     neck_y + 5, GLD_HI)
    sp.px(cx - 1, neck_y + 6, GLD_HI)

    sp.px(cx - 2, neck_y + 7, NVY_SH2)
    sp.px(cx - 1, neck_y + 7, GLD_MID)

    for dy in range(8, 14):
        y = neck_y + dy
        px_g = cx - 2 if dy < 11 else cx - 1
        sp.px(px_g, y, GLD_HI if dy % 2 == 0 else GLD_MID)
        sp.px(px_g - 1, y, NVY_SH2)

    for dx_h, dy_h, gcol in [
        (3, 2, GLD_SH), (4, 3, GLD_MID), (5, 3, GLD_MID), (6, 4, GLD_SH),
    ]:
        sp.px(cx + dx_h, neck_y + dy_h, gcol)

    # 6) CRISP GOLD LEAF ASLA ACADEMY SHIELD EMBLEM ON NEAR-FRONT CHEST!
    ex, ey = cx + 1, neck_y + 7
    hspan(sp, ey, ex, ex + 3, GLD_MID)
    sp.px(ex,     ey,     GLD_HI)
    sp.px(ex,     ey + 1, GLD_HI)
    sp.px(ex + 1, ey + 1, NVY_SH2)
    sp.px(ex + 2, ey + 1, GLD_HI)
    sp.px(ex + 3, ey + 1, GLD_SH)
    sp.px(ex,     ey + 2, GLD_MID)
    sp.px(ex + 1, ey + 2, GLD_HI)
    sp.px(ex + 2, ey + 2, NVY_SH2)
    sp.px(ex + 3, ey + 2, GLD_SH)
    sp.px(ex + 1, ey + 3, GLD_MID)
    sp.px(ex + 2, ey + 3, GLD_SH)

    # 7) Sweeping open cloak side-mantles over skirt
    tail_sway = 2 if pose == "strike" else (1 if pose == "hurt" else sway)
    for k in range(7):
        y = neck_y + 14 + k
        rl = cx + 2 + (k // 2) + (1 if pose == "strike" else 0)
        rr = cx + 8 + (k // 2) + tail_sway
        rr = min(W - 3, rr)
        hspan(sp, y, rl, rr, NVY_MID if k < 4 else NVY_SH1)
        sp.px(rl, y, GLD_HI if k < 4 else GLD_MID)
        sp.px(rr, y, NVY_SH2)
        if k == 6:
            hspan(sp, y, rl, rr, GLD_SH)

        if k < 5:
            fl = cx - 7 - (k // 2) + (1 if pose == "strike" else 0)
            fr = cx - 5 - (k // 3) + (1 if pose == "strike" else 0)
            hspan(sp, y, fl, fr, NVY_HI if k < 3 else NVY_MID)
            sp.px(fr, y, GLD_MID if k < 4 else GLD_SH)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Jewelry-polished 3/4 LEFT-facing anime head, butter-smooth chestnut bob,
    feathered bangs, cool studious -> fierce amber-gold eyes & crisp porcelain ear peek."""
    sp.layer("head")

    # 1) Soft tapered porcelain anime face silhouette (3/4 LEFT)
    face_rows = {
        9:  (-7, 7),
        10: (-8, 8),
        11: (-8, 8),
        12: (-9, 8),
        13: (-9, 8),
        14: (-9, 8),
        15: (-9, 8),
        16: (-9, 8),
        17: (-9, 8),
        18: (-9, 8),
        19: (-9, 8),
        20: (-9, 7),
        21: (-8, 7),
        22: (-8, 6),
        23: (-7, 5),
        24: (-6, 3),
        25: (-4, 1),
        26: (-3, -1),
    }
    for dy, (dl, dr) in face_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, SKIN_MID)
        if 14 <= dy <= 22:
            hspan(sp, y, cx + dl + 1, cx - 1, SKIN_HI)
        if 13 <= dy <= 24:
            sp.px(cx + dr, y, SKIN_SH1)
        if dy == 25:
            sp.px(cx + dl, y, SKIN_SH1)
            sp.px(cx + dr - 1, y, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)
        if dy == 26:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    # Clean delicate porcelain ear peek tucked behind near cheek lock
    ex_ear = cx + 8
    ey_ear = head_y + 18
    sp.px(ex_ear,     ey_ear,     SKIN_MID)
    sp.px(ex_ear + 1, ey_ear,     SKIN_MID)
    sp.px(ex_ear,     ey_ear + 1, SKIN_HI)
    sp.px(ex_ear + 1, ey_ear + 1, SKIN_SH1)
    sp.px(ex_ear + 2, ey_ear + 1, SKIN_MID)
    sp.px(ex_ear,     ey_ear + 2, SKIN_MID)
    sp.px(ex_ear + 1, ey_ear + 2, SKIN_SH1)
    sp.px(ex_ear,     ey_ear + 3, SKIN_SH1)

    # 2) SHARP DETERMINED AMBER-GOLD ANIME EYES (cool composed in idle -> fierce battle in windup/strike!)
    ey = head_y + 15
    fx0 = cx - 7  # Far eye (LEFT): 4px wide
    nx0 = cx      # Near eye (RIGHT): 5px wide

    if pose == "blink":
        sp.px(fx0 - 1, ey + 2, INK_DARK)
        hspan(sp, ey + 3, fx0, fx0 + 3, INK_DARK)
        hspan(sp, ey + 4, fx0 + 1, fx0 + 2, SKIN_SH1)

        sp.px(nx0, ey + 2, INK_DARK)
        hspan(sp, ey + 3, nx0 + 1, nx0 + 4, INK_DARK)
        sp.px(nx0 + 5, ey + 2, INK_DARK)
        hspan(sp, ey + 4, nx0 + 2, nx0 + 3, SKIN_SH1)

    elif pose == "hurt":
        sp.px(fx0,     ey + 1, INK_DARK)
        sp.px(fx0 + 1, ey + 2, INK_DARK)
        sp.px(fx0 + 2, ey + 3, INK_DARK)
        sp.px(fx0 + 1, ey + 4, INK_DARK)
        sp.px(fx0,     ey + 5, INK_DARK)

        sp.px(nx0 + 4, ey + 1, INK_DARK)
        sp.px(nx0 + 3, ey + 2, INK_DARK)
        sp.px(nx0 + 2, ey + 2, INK_DARK)
        sp.px(nx0 + 1, ey + 3, INK_DARK)
        sp.px(nx0 + 2, ey + 4, INK_DARK)
        sp.px(nx0 + 3, ey + 4, INK_DARK)
        sp.px(nx0 + 4, ey + 5, INK_DARK)

    else:
        fierce = pose in ("windup", "strike")

        # --- FAR EYE (LEFT, 4x6 jewel amber eye!) ---
        # Sleek level winged lash in idle; angled inner dip in fierce battle poses!
        sp.px(fx0 - 1, ey + (0 if fierce else 1), INK_DARK)
        if fierce:
            hspan(sp, ey, fx0, fx0 + 2, INK_DARK)
            sp.px(fx0 + 3, ey + 1, INK_DARK)
        else:
            hspan(sp, ey, fx0, fx0 + 3, INK_DARK)

        # Row +1: soft shaded sclera + CRISP SINGLE-PIXEL PURE_WHT catchlight + deep roasted amber!
        sp.px(fx0,     ey + 1, WHT_SHRT if fierce else SLV_MID)
        sp.px(fx0 + 1, ey + 1, PURE_WHT)    # gleaming 1px catchlight!
        sp.px(fx0 + 2, ey + 1, EYE_DARK)
        sp.px(fx0 + 3, ey + 1, INK_DARK if fierce else EYE_DARK)

        # Row +2: bright sclera + roasted amber + sharp pupil + honey amber
        sp.px(fx0,     ey + 2, PURE_WHT)
        sp.px(fx0 + 1, ey + 2, EYE_DARK)
        sp.px(fx0 + 2, ey + 2, INK_DARK)
        sp.px(fx0 + 3, ey + 2, EYE_MID)

        # Row +3: rich honey-amber core
        sp.px(fx0,     ey + 3, PURE_WHT)
        sp.px(fx0 + 1, ey + 3, EYE_MID)
        sp.px(fx0 + 2, ey + 3, EYE_MID)
        sp.px(fx0 + 3, ey + 3, EYE_HI)

        # Row +4: luminous molten-gold lower crescent
        sp.px(fx0,     ey + 4, SKIN_MID)
        sp.px(fx0 + 1, ey + 4, EYE_HI)
        sp.px(fx0 + 2, ey + 4, EYE_HI)
        sp.px(fx0 + 3, ey + 4, EYE_MID)

        # Row +5: delicate warm lower lid
        hspan(sp, ey + 5, fx0 + 1, fx0 + 3, SKIN_SH2)

        # --- NEAR EYE (RIGHT, 5x6 iconic sharp winged amber eye!) ---
        if fierce:
            sp.px(nx0, ey + 1, INK_DARK)
            hspan(sp, ey, nx0 + 1, nx0 + 4, INK_DARK)
            sp.px(nx0 + 5, ey, INK_DARK)
        else:
            hspan(sp, ey, nx0, nx0 + 4, INK_DARK)
        sp.px(nx0 + 5, ey + 1, INK_DARK)    # sleek outer wing!

        # Row +1: upper iris + 1px PURE_WHT catchlight + shaded outer sclera!
        sp.px(nx0,     ey + 1, INK_DARK if fierce else EYE_DARK)
        sp.px(nx0 + 1, ey + 1, PURE_WHT)    # matching 1px catchlight!
        sp.px(nx0 + 2, ey + 1, EYE_DARK)
        sp.px(nx0 + 3, ey + 1, EYE_DARK)
        sp.px(nx0 + 4, ey + 1, WHT_SHRT if fierce else SLV_MID)

        # Row +2: amber iris + sharp dark pupil + pure white sclera
        sp.px(nx0,     ey + 2, EYE_DARK)
        sp.px(nx0 + 1, ey + 2, EYE_MID)
        sp.px(nx0 + 2, ey + 2, INK_DARK)
        sp.px(nx0 + 3, ey + 2, EYE_DARK)
        sp.px(nx0 + 4, ey + 2, PURE_WHT)

        # Row +3: glowing honey-amber bloom
        sp.px(nx0,     ey + 3, EYE_MID)
        sp.px(nx0 + 1, ey + 3, EYE_HI)
        sp.px(nx0 + 2, ey + 3, EYE_MID)
        sp.px(nx0 + 3, ey + 3, EYE_MID)
        sp.px(nx0 + 4, ey + 3, PURE_WHT)

        # Row +4: luminous molten-gold lower crescent + crisp secondary glint
        sp.px(nx0,     ey + 4, EYE_MID)
        sp.px(nx0 + 1, ey + 4, PURE_WHT)
        sp.px(nx0 + 2, ey + 4, EYE_HI)
        sp.px(nx0 + 3, ey + 4, EYE_HI)
        sp.px(nx0 + 4, ey + 4, SKIN_MID)

        # Row +5: delicate warm lower lid
        hspan(sp, ey + 5, nx0 + 1, nx0 + 3, SKIN_SH2)

    # 3) Subtle cool-rival cheek blush (stronger on hurt)
    if pose == "hurt":
        hspan(sp, ey + 5, fx0 - 1, fx0, BLUSH)
        hspan(sp, ey + 5, nx0 + 4, nx0 + 5, BLUSH)
    else:
        sp.px(fx0,     ey + 5, BLUSH)
        sp.px(nx0 + 4, ey + 5, BLUSH)

    # 4) Cool, studious rival mouth
    my = head_y + 22
    mx = cx - 2
    if pose == "strike":
        sp.px(mx,     my,     INK_SKIN)
        sp.px(mx + 1, my,     INK_SKIN)
        sp.px(mx,     my + 1, BLUSH)
        sp.px(mx + 1, my + 1, BLUSH)
    elif pose == "hurt":
        sp.px(mx - 1, my + 1, INK_SKIN)
        sp.px(mx,     my,     INK_SKIN)
        sp.px(mx + 1, my + 1, INK_SKIN)
    elif pose == "windup":
        sp.px(mx,     my, INK_SKIN)
        sp.px(mx + 1, my, SKIN_SH2)
    else:
        sp.px(mx,     my, SKIN_SH2)
        sp.px(mx + 1, my, SKIN_SH2)

    # 5) BUTTER-SMOOTH ROUNDED CHESTNUT BOB CROWN & ARCHED GLOSSY ANGEL-RING SHEEN!
    # Zero 1px left-temple jaggy bump: continuous smooth oval from dy=0..11!
    crown_rows = {
        0:  (-3,  5),
        1:  (-5,  8),
        2:  (-7, 10),
        3:  (-8, 11),
        4:  (-9, 12),
        5:  (-9, 13),
        6:  (-10, 13),
        7:  (-10, 14),
        8:  (-10, 14),
        9:  (-10, 14),
        10: (-10, 14),
        11: (-10, 14),
    }
    for dy, (dl, dr) in crown_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, HAIR_MID)

        # Curved warm chestnut sunlight dome highlight
        if dy == 1:
            hspan(sp, y, cx - 4, cx + 2, HAIR_HI1)
        elif dy == 2:
            hspan(sp, y, cx - 6, cx + 4, HAIR_HI1)
        elif dy == 3:
            hspan(sp, y, cx - 7, cx + 1, HAIR_HI1)
            hspan(sp, y, cx + 3, cx + 6, HAIR_HI1)
        # Luminous arched caramel-chestnut anime angel-ring sheen (dy = 4..7)!
        elif dy == 4:
            hspan(sp, y, cx - 8, cx - 4, HAIR_HI1)
            hspan(sp, y, cx - 6, cx - 4, HAIR_HI2)
            hspan(sp, y, cx - 1, cx + 3, HAIR_HI2)
            hspan(sp, y, cx + 5, cx + 8, HAIR_HI1)
        elif dy == 5:
            hspan(sp, y, cx - 8, cx - 6, HAIR_HI2)
            hspan(sp, y, cx - 3, cx + 1, HAIR_HI2)
            hspan(sp, y, cx + 4, cx + 7, HAIR_HI2)
            sp.px(cx + 8, y, HAIR_HI1)
        elif dy == 6:
            hspan(sp, y, cx - 9, cx - 7, HAIR_HI1)
            hspan(sp, y, cx - 4, cx - 2, HAIR_HI1)
            hspan(sp, y, cx + 5, cx + 9, HAIR_HI1)
            sp.px(cx + 6, y, HAIR_HI2)
        elif dy == 7:
            sp.px(cx - 9, y, HAIR_HI1)
            sp.px(cx + 8, y, HAIR_HI1)
            sp.px(cx + 9, y, HAIR_HI1)

        if dr >= 9:
            hspan(sp, y, cx + dr - 2, cx + dr, HAIR_SH2)
            if dy >= 6:
                sp.px(cx + dr - 3, y, HAIR_SH2)

    # Natural diagonal hair part on upper-right crown
    part_x = cx + 2
    for dy in (1, 2, 3):
        sp.px(part_x + (dy // 2), head_y + dy, HAIR_SH2)

    # Silky broken chestnut strand grooves below angel-ring
    for (sx, sy0, sy1, dx_step) in [
        (cx - 7, 7, 11, -0.22),
        (cx - 2, 7, 11, -0.32),
        (cx + 3, 7, 11, -0.22),
        (cx + 8, 7, 11,  0.22),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, HAIR_SH2)

    # FEATHERED NATURAL ANIME BANGS (organic tapered tips, NO square window cutouts!)
    # Open airy porcelain corridor right above both brows (dy = 12) + gentle feathered arches at dy = 11!
    hspan(sp, head_y + 11, cx - 6, cx - 4, SKIN_MID)
    hspan(sp, head_y + 11, cx + 1, cx + 3, SKIN_MID)
    hspan(sp, head_y + 12, cx - 7, cx - 4, SKIN_MID)
    hspan(sp, head_y + 12, cx + 1, cx + 4, SKIN_MID)
    # Subtle feathered hair tips kissing outer corners of forehead
    sp.px(cx - 7, head_y + 11, HAIR_MID)
    sp.px(cx + 4, head_y + 11, HAIR_MID)
    sp.px(cx - 5, head_y + 11, SKIN_SH1)  # delicate soft bang shadow tick
    sp.px(cx + 2, head_y + 11, SKIN_SH1)

    # Central iconic sharp diagonal chestnut bang dipping gracefully between amber eyes!
    for dy, (dl, dr) in [
        (10, (-2, 1)), (11, (-2, 1)), (12, (-3, 0)),
        (13, (-3, -1)), (14, (-3, -1)), (15, (-3, -2)), (16, (-3, -3)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy < 15 else HAIR_SH2)
        if dy <= 13:
            sp.px(cx + dl, head_y + dy, HAIR_HI1)
        if dy >= 13 and dr > dl:
            sp.px(cx + dr, head_y + dy, HAIR_SH2)

    # Crisp secondary feathered wisp right beside nose bridge
    sp.px(cx,     head_y + 12, HAIR_MID)
    sp.px(cx - 1, head_y + 13, HAIR_SH2)

    # Outer-left sleek temple bang sweep flowing seamlessly into left cheek lock
    for dy, (dl, dr) in [(11, (-10, -8)), (12, (-10, -8)), (13, (-10, -9))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy < 13 else HAIR_SH2)
        sp.px(cx + dl, head_y + dy, HAIR_HI1)

    # 6) EXPRESSIVE CHESTNUT EYEBROWS (cool composed studious rival in idle -> fierce in battle!)
    brow_y = ey - 2  # head_y + 13
    if pose in ("windup", "strike"):
        sp.px(fx0,     brow_y - 1, HAIR_SH2)
        sp.px(fx0 + 1, brow_y,     INK_HAIR)
        sp.px(fx0 + 2, brow_y,     INK_HAIR)

        sp.px(nx0 + 1, brow_y,     INK_HAIR)
        sp.px(nx0 + 2, brow_y,     INK_HAIR)
        sp.px(nx0 + 3, brow_y - 1, HAIR_SH2)
        sp.px(nx0 + 4, brow_y - 1, HAIR_SH2)
    elif pose == "hurt":
        sp.px(fx0,     brow_y + 1, HAIR_SH2)
        sp.px(fx0 + 1, brow_y,     INK_HAIR)
        sp.px(fx0 + 2, brow_y,     HAIR_SH2)

        sp.px(nx0 + 1, brow_y,     HAIR_SH2)
        sp.px(nx0 + 2, brow_y,     INK_HAIR)
        sp.px(nx0 + 3, brow_y + 1, HAIR_SH2)
    else:
        # Cool composed studious rival brows (level poise with delicate 1px outer lift!)
        sp.px(fx0,     brow_y - 1, HAIR_HI1)
        sp.px(fx0 + 1, brow_y,     HAIR_SH2)
        sp.px(fx0 + 2, brow_y,     HAIR_SH2)

        sp.px(nx0 + 1, brow_y,     HAIR_SH2)
        sp.px(nx0 + 2, brow_y,     HAIR_SH2)
        sp.px(nx0 + 3, brow_y - 1, HAIR_HI1)

    # 7) GRACEFUL INWARD-CURVING SHARP FACE-FRAMING CHESTNUT BOB LOCKS!
    far_lock = [
        (12, -10, 2), (13, -10, 2), (14, -10, 2), (15, -10, 2),
        (16, -10, 2), (17, -10, 2), (18, -10, 2), (19, -10, 2),
        (20, -9,  2), (21, -9,  2), (22, -8,  2), (23, -8,  2),
        (24, -7,  1), (25, -6,  1),
    ]
    for dy, dx_l, w in far_lock:
        y = head_y + dy
        hspan(sp, y, cx + dx_l, cx + dx_l + w - 1, HAIR_MID if dy < 23 else HAIR_SH2)
        if dy < 21:
            sp.px(cx + dx_l, y, HAIR_HI1)

    off_r = 0 if pose != "strike" else -1
    near_lock = [
        (11, 6, 3), (12, 6, 3), (13, 6, 3), (14, 6, 3),
        (15, 6, 2), (16, 6, 2), (17, 6, 2), (18, 6, 2),
        (19, 6, 2), (20, 5, 2), (21, 5, 2), (22, 4, 2),
        (23, 4, 2), (24, 3, 2), (25, 2, 1), (26, 1, 1),
    ]
    for dy, dx_r, w in near_lock:
        y = head_y + dy
        rx = cx + dx_r + (off_r if dy >= 19 else 0)
        hspan(sp, y, rx, rx + w - 1, HAIR_MID if dy < 24 else HAIR_SH2)
        if dy < 22:
            sp.px(rx, y, HAIR_HI1)
        if w >= 2:
            sp.px(rx + w - 1, y, HAIR_SH2)


def draw_near_arm_wand_and_water(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Near (left) academy dark-navy robe sleeve + elegant silver water-mage wand +
    silky parametric Bezier azure water ribbon / overhead veil / razor water jet!"""
    sp.layer("near_arm")

    sh_x, sh_y = cx + 5, torso_y + 2

    if pose == "windup":
        el_x, el_y = cx + 11, torso_y + 4
        hx, hy = cx + 16, torso_y - 3
        tip_x, tip_y = hx + 11, hy - 18  # ~(66, 16) — clean open-sky wand silhouette!
    elif pose == "strike":
        el_x, el_y = cx + 1, torso_y + 6
        hx, hy = cx - 7, torso_y + 5
        tip_x, tip_y = hx - 12, hy       # ~(15, 41) — leaves 14px for razor water jet!
    elif pose == "hurt":
        el_x, el_y = cx + 8, torso_y + 9
        hx, hy = cx - 3, torso_y + 8
        tip_x, tip_y = hx - 15, hy - 5
    else:
        el_x, el_y = cx + 7, torso_y + 9
        hx, hy = cx - 2, torso_y + 10
        tip_x, tip_y = hx - 18, hy - 8   # ~(18, 38)

    # 1) Draped dark-navy academy robe upper sleeve
    sp.polygon([
        (sh_x + 2, sh_y),
        (sh_x - 2, sh_y),
        (el_x - 2, el_y),
        (el_x + 3, el_y + 1),
        (sh_x + 4, sh_y + 4),
    ], NVY_MID, fill=True)
    sp.line(sh_x - 1, sh_y + 1, el_x - 2, el_y, NVY_HI)
    sp.line(sh_x + 2, sh_y + 1, el_x + 3, el_y + 1, NVY_SH1)
    sp.line(sh_x + 3, sh_y + 2, el_x + 3, el_y + 1, NVY_SH2)

    # 2) Forearm mage sleeve tapering smoothly to antique-gold cuff
    sp.polygon([
        (el_x + 2, el_y + 1),
        (el_x - 2, el_y),
        (hx, hy - 1),
        (hx + 2, hy + 2),
    ], NVY_MID, fill=True)
    sp.line(el_x - 1, el_y, hx, hy - 1, NVY_HI)
    sp.line(el_x + 2, el_y + 1, hx + 2, hy + 2, NVY_SH1)

    sp.px(hx + 2, hy - 1, GLD_HI)
    sp.px(hx + 2, hy,     GLD_MID)
    sp.px(hx + 2, hy + 1, GLD_SH)
    sp.px(hx + 1, hy - 1, WHT_SHRT)
    sp.px(hx + 1, hy + 1, SLV_MID)

    # 3) ELEGANT SILVER WATER-MAGE WAND (weapon layer!)
    sp.layer("weapon")

    dx = tip_x - hx
    dy = tip_y - hy
    length = max(1.0, math.hypot(dx, dy))
    ux, uy = dx / length, dy / length

    nx_u, ny_u = -uy, ux
    if ny_u > 0 or (abs(ny_u) < 0.01 and nx_u > 0):
        nx_u, ny_u = -nx_u, -ny_u
    if abs(dx) >= abs(dy):
        off_x, off_y = 0, -1
    else:
        off_x, off_y = -1, 0

    # Ornate silver & gold pommel butt
    pom_x = int(round(hx - ux * 3.4))
    pom_y = int(round(hy - uy * 3.4))
    for px_p, py_p in bresenham_pts(pom_x, pom_y, hx, hy):
        sp.px(px_p, py_p, SLV_MID)
    sp.px(pom_x, pom_y, GLD_HI)

    # Gleaming tapered silver wand shaft
    collar_x = int(round(tip_x - ux * 3.8))
    collar_y = int(round(tip_y - uy * 3.8))
    spine = bresenham_pts(hx, hy, collar_x, collar_y)
    n_pts = max(1, len(spine) - 1)
    for i, (px_s, py_s) in enumerate(spine):
        t = i / n_pts
        sp.px(px_s, py_s, SLV_SH if t > 0.58 else SLV_MID)
        if t < 0.78:
            sp.px(px_s + off_x, py_s + off_y, PURE_WHT if (0.18 < t < 0.48) else WHT_SHRT)

    # Gold accent collar ring
    sp.px(collar_x, collar_y, GLD_MID)
    sp.px(collar_x + off_x, collar_y + off_y, GLD_HI)
    sp.px(collar_x - off_x, collar_y - off_y, GLD_SH)

    # Ornate silver filigree crescent prongs cradling luminous azure water crystal!
    gem_x = int(round(tip_x - ux * 1.3))
    gem_y = int(round(tip_y - uy * 1.3))
    p1x, p1y = int(round(gem_x + nx_u * 2.0)), int(round(gem_y + ny_u * 2.0))
    p2x, p2y = int(round(gem_x - nx_u * 2.0)), int(round(gem_y - ny_u * 2.0))
    sp.px(p1x, p1y, WHT_SHRT)
    sp.px(int(round(p1x - ux)), int(round(p1y - uy)), SLV_MID)
    sp.px(p2x, p2y, SLV_MID)
    sp.px(int(round(p2x - ux)), int(round(p2y - uy)), SLV_SH)

    # Luminous faceted azure water crystal orb
    sp.px(gem_x, gem_y, WTR_HI)
    sp.px(gem_x + off_x, gem_y + off_y, PURE_WHT)
    sp.px(gem_x - off_x, gem_y - off_y, WTR_MID)
    sp.px(int(tip_x), int(tip_y), WTR_FOAM if pose in ("windup", "strike") else WTR_HI)
    sp.px(int(round(tip_x - off_x)), int(round(tip_y - off_y)), WTR_MID)

    # 4) Porcelain hand gripping wand shaft
    sp.layer("near_arm")
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)

    # 5) SILKY PARAMETRIC BEZIER AZURE WATER RIBBON / VEIL / RAZOR JET (fx layer!)
    sp.layer("fx")
    sx, sy = int(tip_x), int(tip_y)

    if pose in ("idle1", "idle2", "blink"):
        # Pure, unbroken calligraphic azure water silk ribbon coiling gracefully around wand tip!
        ph = 2 if pose == "idle2" else (1 if pose == "blink" else 0)
        dy_w = -1 if pose == "idle2" else 0
        dx_w = -1 if pose == "idle2" else 0
        ribbon = [
            ((sx + 9, sy + 6 + dy_w),
             (sx + 2, sy + 11 + dy_w),
             (sx - 9 + dx_w, sy + 5 + dy_w),
             (sx - 6 + dx_w, sy - 3 + dy_w)),
            ((sx - 6 + dx_w, sy - 3 + dy_w),
             (sx - 3 + dx_w, sy - 9 + dy_w),
             (sx + 4, sy - 8 + dy_w),
             (sx + 8, sy - 4 + dy_w)),
        ]
        draw_bezier_water_ribbon(sp, ribbon, thick_start=0.14, thick_end=0.84, phase=ph, edge_dir=(0, 1))
        # Subtle inner 2px aqua mist pearl cleanly inside the upper loop (zero outer thorn bump!)
        sp.px(sx - 1 + dx_w, sy - 5 + dy_w, WTR_FOAM)
        sp.px(sx + dx_w,     sy - 5 + dy_w, WTR_HI)

    elif pose == "windup":
        # DRAMATIC SUMMONING CURVED WATER VEIL!
        # Wand raised cleanly in open right sky at ~(66, 16) with radiant 4-point hydro star!
        sp.px(sx, sy, PURE_WHT)
        for d in (1, 2, 3):
            col = PURE_WHT if d == 1 else (WTR_FOAM if d == 2 else WTR_HI)
            if sx + d < W - 1:
                sp.px(sx + d, sy, col)
            if sx - d > 0:
                sp.px(sx - d, sy, col)
            if sy + d < H - 1:
                sp.px(sx, sy + d, col)
            if sy - d > 0:
                sp.px(sx, sy - d, col)
        for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            if 1 <= sx + ddx <= W - 2 and 1 <= sy + ddy <= H - 2:
                sp.px(sx + ddx, sy + ddy, WTR_HI)

        # High overhead Bezier water veil arching with clean 3-4px open sky above hair crown (y ~ 2..3)!
        veil_outer = [
            ((sx - 2, sy - 3),
             (cx + 21, 0),
             (cx - 11, -1),
             (cx - 23, 13)),
            ((cx - 23, 13),
             (cx - 30, 24),
             (cx - 28, 37),
             (cx - 17, 42)),
        ]
        draw_bezier_water_ribbon(sp, veil_outer, thick_start=0.08, thick_end=0.90, phase=1, edge_dir=(1, 1))

        # Inner graceful translucent-feel liquid crescent echoing the summoning veil!
        veil_inner = [
            ((cx - 17, 16),
             (cx - 24, 24),
             (cx - 23, 33),
             (cx - 15, 38)),
        ]
        draw_bezier_water_ribbon(sp, veil_inner, thick_start=0.18, thick_end=0.82, phase=3, edge_dir=(1, 0))

        # Clean floating 2px hydro pearls nestled inside the veil crescent (zero outer thorn artifacts!)
        sp.px(cx - 14, 12, WTR_FOAM)
        sp.px(cx - 13, 12, WTR_HI)
        sp.px(cx - 19, 31, WTR_FOAM)
        sp.px(cx - 18, 31, WTR_HI)

    elif pose == "strike":
        # SLEEK HIGH-VELOCITY RAZOR WATER JET SURGING LEFT (crystal tip sx ~ 15 -> jet tip x = 1)!
        jet_tip_x = max(1, sx - 14)

        # Pressurized gleaming white-foam spear core!
        for x in range(jet_tip_x, sx + 2):
            t = (x - jet_tip_x) / max(1, sx + 1 - jet_tip_x)
            col = PURE_WHT if t < 0.52 else (WTR_FOAM if t < 0.80 else WTR_HI)
            sp.px(x, sy, col)

        # Sleek swept hydrodynamic blade upper & lower edges
        for x in range(jet_tip_x + 2, sx + 3):
            t = (x - (jet_tip_x + 2)) / max(1, sx + 2 - (jet_tip_x + 2))
            ucol = WTR_FOAM if t < 0.28 else (WTR_HI if t < 0.72 else WTR_MID)
            lcol = WTR_HI if t < 0.35 else (WTR_MID if t < 0.78 else WTR_DEEP)
            sp.px(x, sy - 1, ucol)
            sp.px(x, sy + 1, lcol)

        for x in range(jet_tip_x + 5, sx + 3):
            sp.px(x, sy - 2, WTR_HI if x < sx - 2 else WTR_MID)
            sp.px(x, sy + 2, WTR_MID if x < sx - 2 else WTR_DEEP)

        # Crisp concentric pressure splash ring at wand release point (wand shaft 100% clean!)
        sp.px(sx,     sy - 3, WTR_FOAM)
        sp.px(sx + 1, sy - 3, WTR_HI)
        sp.px(sx,     sy + 3, WTR_HI)
        sp.px(sx + 1, sy + 3, WTR_MID)
        sp.px(sx + 2, sy - 4, WTR_HI)
        sp.px(sx + 3, sy - 4, WTR_MID)
        sp.px(sx + 2, sy + 4, WTR_MID)
        sp.px(sx + 3, sy + 4, WTR_DEEP)

        # Clean twin trailing aqua speed-ribbons sweeping smoothly back ABOVE & BELOW silver wand!
        wake_top = [((sx + 2, sy - 3), (sx + 6, sy - 6), (sx + 10, sy - 5), (sx + 13, sy - 7))]
        wake_bot = [((sx + 2, sy + 3), (sx + 6, sy + 6), (sx + 10, sy + 5), (sx + 13, sy + 7))]
        draw_bezier_water_ribbon(sp, wake_top, thick_start=0.05, thick_end=0.65, phase=0, edge_dir=(0, 1))
        draw_bezier_water_ribbon(sp, wake_bot, thick_start=0.05, thick_end=0.65, phase=2, edge_dir=(0, -1))

        # High-pressure forward hydro spray glints cleanly separated from lance beam
        sp.px(jet_tip_x + 3, sy - 3, PURE_WHT)
        sp.px(jet_tip_x + 4, sy - 3, WTR_HI)
        sp.px(jet_tip_x + 4, sy + 3, WTR_HI)
        sp.px(jet_tip_x + 5, sy + 3, WTR_MID)

    elif pose == "hurt":
        # Graceful disrupted azure water tendrils peeling off wand tip on recoil!
        wisp_a = [((sx - 1, sy - 3), (sx - 5, sy - 5), (sx - 6, sy - 8), (sx - 3, sy - 10))]
        wisp_b = [((sx - 3, sy + 2), (sx - 7, sy + 3), (sx - 8, sy + 6), (sx - 5, sy + 8))]
        draw_bezier_water_ribbon(sp, wisp_a, thick_start=0.15, thick_end=0.72, phase=0, edge_dir=(1, 0))
        draw_bezier_water_ribbon(sp, wisp_b, thick_start=0.15, thick_end=0.72, phase=2, edge_dir=(1, 0))

    return tip_x, tip_y


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    ("idle1",   0,   0,   0, 260),
    ("idle2",   0,  -1,   1, 260),
    ("blink",   0,   0,   0, 140),
    ("windup",  1,   1,   1, 180),
    ("strike", -4,   0,   2, 160),
    ("hurt",    3,   1,  -1, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "back_cloak",
        "back_hair",
        "far_arm",
        "legs",
        "skirt",
        "torso",
        "head",
        "weapon",
        "near_arm",
        "fx",
    ]
    sp.frames[0].cels = {ln: sp._blank() for ln in sp.layer_order}

    for _ in range(1, N_FRAMES):
        sp.add_frame(copy=False)

    anchors = {}

    for idx, (pose, dx, bob, sway, dur) in enumerate(FRAME_SPECS, start=1):
        sp.frame(idx)
        sp.set_duration(dur)

        cx = PIVOT_X + dx
        head_y = 7 + bob
        neck_y = head_y + 28
        torso_y = neck_y + 1
        waist_y = neck_y + 13

        draw_back_cloak(sp, cx, neck_y, waist_y, pose, sway)
        draw_back_hair(sp, cx, head_y, pose, sway)
        draw_far_arm(sp, cx, torso_y, pose)
        draw_legs_boots(sp, cx, GROUND_Y, pose)
        draw_skirt(sp, cx, waist_y, pose, sway)
        draw_torso(sp, cx, neck_y, pose, sway)
        draw_head(sp, cx, head_y, pose, sway)
        tip_x, tip_y = draw_near_arm_wand_and_water(sp, cx, torso_y, pose)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx - 1, head_y + 16)
            anchors["hit_px"] = (cx - 1, torso_y + 9)
        if pose == "strike":
            anchors["cast_px"] = (max(1, tip_x), tip_y)

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
        ("3x Light Sky #DCE7F6 (Red=Foot Anchor, Cyan=Cast Anchor)", (220, 231, 246), 0),
        ("3x Dark Dusk #2A344B", (42, 52, 75), fh + 24),
    ]

    ax, ay = PIVOT_X, GROUND_Y
    cast_x, cast_y = anchors["cast_px"]

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


def render_face_zoom(sp: Sprite, path: str, scale: int = 12):
    x0, y0, x1, y1 = 20, 4, 60, 42
    cw, ch = (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale
    sep = 4
    out = Image.new("RGB", (N_FRAMES * cw + (N_FRAMES + 1) * sep, ch + 2 * sep), (218, 228, 244))
    for i in range(N_FRAMES):
        crop = sp.composite(i + 1).crop((x0, y0, x1 + 1, y1 + 1)).resize((cw, ch), NEAREST)
        out.paste(crop, (sep + i * (cw + sep), sep), crop)
    out.save(path)
    print(f"face_zoom -> {path}")


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

    # Verify exact foot baseline lock on GROUND_Y for idle frames 1..3
    for fi in (1, 2, 3):
        leg_cel = sp.frames[fi - 1].cels["legs"]
        ys = [y for y in range(H) for x in range(W) if leg_cel.getpixel((x, y))[3] > 0]
        assert max(ys) == GROUND_Y, f"Frame {fi} shoe baseline {max(ys)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "noelle",
        "file": "assets/sprites/noelle_sheet.png",
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
        "buildScript": "tools/pixel_art/noelle/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=5)
    render_face_zoom(sp, FACE_ZOOM_PATH, scale=12)


if __name__ == "__main__":
    main()
