#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for East-Wing Commander
"Red Lotus Iron Curtain" (eastwing_commander / 东翼封锁官·红莲铁幕).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 80 x 86, 6 horizontal frames (480 x 86 sheet, padding=0).
Facing: left. GROUND_Y = 80, PIVOT_X = 44.

Pass 3 (Final Jewelry Polish):
- Graceful sweeping royal crimson velvet cape silhouette (widens smoothly toward train hem,
  flowing diagonal streamer instead of horizontal stub)
- Pure gleaming obsidian steel curved horn tips rising cleanly from ornate baroque gold base-cuffs
- Seamless 2-strand feathered silver cheek hair lock with zero interior outline pinholes
- Cohesive blazing crimson iris across idle, windup & strike (fixed horizontal sclera split on fierce eye)
- Incandescent Red Lotus fire blossom around raised overhead windup halberd (2px extra top margin)
- Flush razor-tapered sweeping crescent flame smear aligned seamlessly with cleaving halberd tip on strike
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
W, H = 80, 86
N_FRAMES = 6
GROUND_Y = 80
PIVOT_X = 44

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "eastwing_commander_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "eastwing_commander_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 26-Color Hue-Shifted Boss Knight Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
INK_DARK = "#12101c"  # Deep obsidian-plum shadow ink & shadow selout
ARM_SH2  = "#1e1d2e"  # Deepest obsidian plate core shadow
ARM_SH1  = "#31324a"  # Dark obsidian-slate armor base
ARM_MID  = "#4e5270"  # Cool steel specular midtone & lit armor selout
ARM_HI   = "#7e85a6"  # Crisp steel-silver plate bevel highlight

GLD_SH2  = "#5c3818"  # Deep antique bronze-umber filigree recess & gold selout
GLD_SH1  = "#9c6826"  # Burnished antique gold shadow
GLD_MID  = "#d9a43c"  # Gleaming imperial gold base
GLD_HI   = "#ffe07d"  # Sunlit champagne-gold specular glint

RED_SH2  = "#3b0c1c"  # Deep wine-plum velvet crevice & crimson selout
RED_SH1  = "#701424"  # Deep burgundy velvet shadow
RED_MID  = "#ad1f2e"  # Royal crimson velvet base
RED_HI   = "#e03b3e"  # Vivid scarlet sunlit velvet fold & eye midtone

FLM_RED  = "#eb3223"  # Blazing molten red outer flame
FLM_ORG  = "#ff771c"  # Roaring fiery orange-amber flame
FLM_YLW  = "#ffbf2e"  # Incandescent amber-gold flame core
FLM_WHT  = "#fff7d1"  # Blinding white-gold flame heart
PURE_WHT = "#ffffff"  # Pure specular eye catchlight & hot flash core
EYE_CORE = "#ff4a5e"  # Glowing crimson iris lower crescent

HAIR_SH  = "#9ba4c4"  # Cool lavender-silver hair shadow
HAIR_MID = "#c7cfe6"  # Sleek silver-white hair midtone
HAIR_HI  = "#eef2ff"  # Crisp sunlit silver-white highlight

SKIN_HI  = "#fff0e8"  # Alabaster cheekbone highlight
SKIN_MID = "#f0d2c4"  # Pale aristocratic skin base
SKIN_SH1 = "#c99b90"  # Soft cool-rose visor cast shadow
SKIN_SH2 = "#8f5c5c"  # Deep chin/jaw contour & skin selout

PALETTE = [
    INK_DARK, ARM_SH2, ARM_SH1, ARM_MID, ARM_HI,
    GLD_SH2, GLD_SH1, GLD_MID, GLD_HI,
    RED_SH2, RED_SH1, RED_MID, RED_HI,
    FLM_RED, FLM_ORG, FLM_YLW, FLM_WHT, PURE_WHT, EYE_CORE,
    HAIR_SH, HAIR_MID, HAIR_HI,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2,
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
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    cx, cy = x0, y0
    while True:
        pts.append((cx, cy))
        if cx == x1 and cy == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            cx += sx
        if e2 <= dx:
            err += dx
            cy += sy
    return pts


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected selective outer outline with material- & top-left-light tinting.
    Excludes the glowing 'fx' fire layer so flames radiate cleanly without muddy dark borders.
    """
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_arm_mid  = hex2rgba(ARM_MID)
    rgba_gld_sh2  = hex2rgba(GLD_SH2)
    rgba_red_sh2  = hex2rgba(RED_SH2)
    rgba_skin_sh2 = hex2rgba(SKIN_SH2)
    rgba_hair_sh  = hex2rgba(HAIR_SH)

    gold_set = {hex2rgba(GLD_HI)[:3], hex2rgba(GLD_MID)[:3], hex2rgba(GLD_SH1)[:3]}
    red_set  = {hex2rgba(RED_HI)[:3], hex2rgba(RED_MID)[:3], hex2rgba(RED_SH1)[:3]}
    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3]}
    hair_set = {hex2rgba(HAIR_HI)[:3], hex2rgba(HAIR_MID)[:3]}
    arm_lit  = {hex2rgba(ARM_HI)[:3], hex2rgba(ARM_MID)[:3]}
    flm_set  = {hex2rgba(FLM_RED)[:3], hex2rgba(FLM_ORG)[:3], hex2rgba(FLM_YLW)[:3],
                hex2rgba(FLM_WHT)[:3], hex2rgba(PURE_WHT)[:3]}

    body_layers = [ln for ln in sp.layer_order if ln not in ("fx", "outline")]
    body_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in body_layers]
    fx_cel = sp.frames[frame_idx - 1].cels.get("fx")
    fx_px = fx_cel.load() if fx_cel else None

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            if fx_px and fx_px[x, y][3] > 0:
                continue
            nbrs = []
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    if any(bp[nx, ny][3] > 0 for bp in body_pxs):
                        nbrs.append((dx, dy, src[nx, ny][:3]))
            if not nbrs:
                continue

            is_top_left = any(dx == 1 or dy == 1 for dx, dy, _ in nbrs) and not any(dy == -1 for _, dy, _ in nbrs)
            rgbs = [rgb for _, _, rgb in nbrs]

            if any(rgb in skin_set for rgb in rgbs) and y < 38:
                dst[x, y] = rgba_skin_sh2
            elif is_top_left and any(rgb in hair_set for rgb in rgbs) and y < 38:
                dst[x, y] = rgba_hair_sh
            elif is_top_left and any(rgb in gold_set or rgb in flm_set for rgb in rgbs):
                dst[x, y] = rgba_gld_sh2
            elif is_top_left and any(rgb in arm_lit for rgb in rgbs):
                dst[x, y] = rgba_arm_mid
            elif any(rgb in red_set for rgb in rgbs) and not any(rgb == hex2rgba(ARM_SH2)[:3] for rgb in rgbs):
                dst[x, y] = rgba_red_sh2 if is_top_left else rgba_ink_dark
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters
# ---------------------------------------------------------------------------

def draw_back_cape(sp: Sprite, cx: int, neck_y: int, pose: str, sway: int):
    """Grand sweeping crimson velvet royal cape flaring smoothly to a sculpted baroque train
    with deep wine-plum folds and refined gold-embroidered edge trim!"""
    sp.layer("back_cape")
    top_y = neck_y + 2
    bot_y = GROUND_Y - 2 if pose != "strike" else GROUND_Y - 5
    span_y = max(1, bot_y - top_y)

    cape_rows = {}
    for i in range(span_y + 1):
        y = top_y + i
        t = i / span_y
        # Smooth, majestic outward-sweeping royal cloak profile (flares widest near bottom train!)
        flare = (t ** 0.86) + math.sin(t * math.pi * 2.1) * 0.06

        if pose == "strike":
            billow = int(round(10 + 23 * flare + math.sin(t * 4.5) * 1.4))
            lx = cx - 8 - int(round(4 * (t ** 1.05)))
            rx = min(W - 3, cx + billow)
        elif pose == "windup":
            billow = int(round(10 + 18 * flare + math.sin(t * 4.0 + 0.5) * 1.4))
            lx = cx - 9 - int(round(5 * (t ** 1.05)))
            rx = min(W - 3, cx + billow)
        elif pose == "hurt":
            billow = int(round(9 + 14 * flare - math.sin(t * 3.5) * 1.3))
            lx = cx - 8 - int(round(6 * (t ** 1.05)))
            rx = min(W - 3, cx + billow)
        else:
            billow = int(round(9 + 18 * flare + math.sin(t * 3.8) * 1.2 + sway * (t * 2.4)))
            lx = cx - 9 - int(round(5 * (t ** 1.05))) + int(round(sway * t * 0.6))
            rx = min(W - 3, cx + billow)

        cape_rows[y] = (max(2, lx), rx)

    # Rich 4-tone velvet drapery folds radiating diagonally from shoulders
    for y, (lx, rx) in cape_rows.items():
        t = (y - top_y) / span_y
        width = max(1, rx - lx)
        for x in range(lx, rx + 1):
            u = (x - lx) / width
            wave = math.sin((u * 3.1 - t * 0.85) * math.pi * 2.0)
            if u < 0.28:
                col = RED_SH2 if (u > 0.13 or t < 0.28) else RED_SH1
            elif u > 0.92:
                col = RED_SH1
            else:
                if wave > 0.45:
                    col = RED_HI if (u < 0.80 and t < 0.88) else RED_MID
                elif wave > -0.10:
                    col = RED_MID if u < 0.86 else RED_SH1
                elif wave > -0.58:
                    col = RED_SH1
                else:
                    col = RED_SH2
            sp.px(x, y, col)

    # Refined 1-2px baroque gold-embroidered edge
    for y, (lx, rx) in cape_rows.items():
        t = (y - top_y) / span_y
        if t > 0.15:
            sp.px(rx, y, RED_SH2)
            sp.px(rx - 1, y, GLD_MID if (y % 3 != 0) else GLD_HI)
            if y % 4 == 0:
                sp.px(rx - 2, y, GLD_SH1)
                sp.px(rx - 3, y, GLD_SH2)
        if t > 0.50:
            sp.px(lx, y, RED_SH2)
            sp.px(lx + 1, y, GLD_SH1 if y % 2 == 0 else GLD_MID)

    # Sculpted wavy lower royal hem with gold filigree border & clean V-split behind legs!
    if bot_y in cape_rows:
        lx_b, rx_b = cape_rows[bot_y]
        for x in range(lx_b + 1, rx_b):
            u = (x - lx_b) / max(1, rx_b - lx_b)
            if u < 0.30 or u > 0.56:
                sp.px(x, bot_y - 2, GLD_HI if (x % 4 == 0 and u > 0.62) else GLD_MID)
                if x % 4 == 2 and u > 0.60:
                    sp.px(x, bot_y - 3, GLD_SH1)
                sp.px(x, bot_y - 1, RED_SH1 if x % 2 == 0 else RED_SH2)
        # Clean dramatic opening behind boots so armored legs stand out cleanly
        split_l = cx - 6
        split_r = cx + 7
        for dy in range(7):
            yy = bot_y - dy
            for x in range(split_l + dy, split_r - dy):
                sp.px(x, yy, None)
        # Sculpt graceful upturned trailing right royal cape train tip!
        sp.px(rx_b, bot_y, None)
        sp.px(rx_b - 1, bot_y, RED_SH2)
        sp.px(rx_b - 2, bot_y, GLD_SH1)
        if rx_b + 2 < W - 1:
            sp.px(rx_b, bot_y - 1, RED_MID)
            sp.px(rx_b + 1, bot_y - 1, RED_SH1)
            sp.px(rx_b + 1, bot_y - 2, RED_HI if pose == "strike" else RED_MID)
            sp.px(rx_b + 2, bot_y - 2, RED_SH2)

    # Graceful diagonal fluttering silk streamer trailing down-right in dynamic frames only!
    if pose in ("strike", "idle2", "windup"):
        tail_y = top_y + int(span_y * 0.62)
        tail_rx = cape_rows.get(tail_y, (cx, cx + 23))[1]
        tlen = 5 if pose == "strike" else 3
        for k in range(tlen):
            tx = min(W - 2, tail_rx + 1 + k)
            ty = min(GROUND_Y - 3, tail_y + (k * 2) // 3)
            sp.px(tx, ty, RED_HI if k < 2 else RED_MID)
            if k < tlen - 1 and ty + 1 < GROUND_Y - 2:
                sp.px(tx, ty + 1, RED_SH1 if k < 2 else RED_SH2)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Heavy sleek obsidian plate greaves, gothic knee poleyns & armored sabatons locked at GROUND_Y."""
    sp.layer("legs")
    hip_y = ground_y - 22

    if pose == "strike":
        far_top_x, far_fx, far_fy = cx - 4, cx - 12, ground_y
        near_top_x, near_fx, near_fy = cx + 3, cx + 8, ground_y
    elif pose == "windup":
        far_top_x, far_fx, far_fy = cx - 4, cx - 8, ground_y
        near_top_x, near_fx, near_fy = cx + 3, cx + 7, ground_y
    elif pose == "hurt":
        far_top_x, far_fx, far_fy = cx - 4, cx - 10, ground_y - 1
        near_top_x, near_fx, near_fy = cx + 3, cx + 7, ground_y
    else:
        far_top_x, far_fx, far_fy = cx - 4, cx - 9, ground_y
        near_top_x, near_fx, near_fy = cx + 3, cx + 6, ground_y

    def _draw_armored_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        knee_y = hip_y + 8
        boot_y = foot_y - 7
        a_hi  = ARM_MID if is_far else ARM_HI
        a_mid = ARM_SH1 if is_far else ARM_MID
        a_sh1 = ARM_SH2 if is_far else ARM_SH1
        a_sh2 = INK_DARK if is_far else ARM_SH2
        g_hi  = GLD_MID if is_far else GLD_HI
        g_mid = GLD_SH1 if is_far else GLD_MID
        g_sh  = GLD_SH2 if is_far else GLD_SH1

        span = max(1, boot_y - hip_y)
        for y in range(hip_y, boot_y + 1):
            t = (y - hip_y) / span
            lx = int(round(top_x + (foot_x - top_x) * t)) - 2
            w = 6 if y < knee_y else 5
            hspan(sp, y, lx, lx + w - 1, a_sh1)
            # Sleek vertical cool-steel specular flute along front shin
            sp.px(lx, y, a_mid)
            sp.px(lx + 1, y, a_hi if (not is_far and y > knee_y + 1) else a_mid)
            sp.px(lx + w - 1, y, a_sh2)
            sp.px(lx + w - 2, y, ARM_SH2)

        # Sculpted Gothic Knee-Guard (poleyn) — sleek obsidian diamond with subtle gold edge!
        kx = int(round(top_x + (foot_x - top_x) * ((knee_y - hip_y) / span))) - 3
        hspan(sp, knee_y - 1, kx + 1, kx + 4, a_mid)
        sp.px(kx + 2, knee_y - 1, g_hi)
        hspan(sp, knee_y, kx, kx + 5, a_sh1)
        sp.px(kx, knee_y, g_mid)
        sp.px(kx + 1, knee_y, a_hi)
        sp.px(kx + 2, knee_y, a_mid)
        sp.px(kx + 5, knee_y, g_sh)
        hspan(sp, knee_y + 1, kx + 1, kx + 4, a_sh2)
        sp.px(kx + 2, knee_y + 1, g_mid)

        # Heavy Sleek Obsidian Sabaton (armored boot pointing LEFT!)
        bx = foot_x - 3
        for y in range(boot_y, foot_y - 2):
            hspan(sp, y, bx, bx + 5, a_sh1)
            sp.px(bx, y, a_mid)
            sp.px(bx + 1, y, a_hi)
            sp.px(bx + 4, y, ARM_SH2)
            sp.px(bx + 5, y, a_sh2)
        # Subtle gold ankle buckle (not a thick full stripe!)
        sp.px(bx, boot_y, g_mid)
        sp.px(bx + 1, boot_y, g_hi)
        sp.px(bx + 2, boot_y, g_sh)

        # Articulated pointed armored toe extending LEFT!
        hspan(sp, foot_y - 2, bx - 2, bx + 5, a_sh1)
        hspan(sp, foot_y - 2, bx - 1, bx + 1, a_hi)
        sp.px(bx - 2, foot_y - 2, a_mid)
        sp.px(bx + 5, foot_y - 2, a_sh2)

        hspan(sp, foot_y - 1, bx - 3, bx + 5, a_sh1)
        hspan(sp, foot_y - 1, bx - 2, bx, a_mid)
        sp.px(bx - 3, foot_y - 1, g_hi)
        sp.px(bx - 2, foot_y - 1, g_mid)
        sp.px(bx + 5, foot_y - 1, a_sh2)

        # Solid armored sole locked squarely at foot_y (GROUND_Y!)
        hspan(sp, foot_y, bx - 3, bx + 5, a_sh2)
        hspan(sp, foot_y, bx - 2, bx, a_sh1)

    _draw_armored_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_armored_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """Sleek 75% obsidian-black plate armor + 25% razor-crisp baroque gold filigree:
    - High dramatic flared crimson-lined royal collar
    - Clean dark obsidian cuirass framing the iconic upturned golden winged breastplate crest
    - Golden shoulder sun-medallion clasp, gothic waist V-buckle, sleek dark tassets & split tabard!
    """
    sp.layer("torso")

    # 1) WIDE DRAMATIC UPTURNED CRIMSON-LINED ROYAL COLLAR (flaring sharply behind neck/jaw!)
    collar_l = [
        (cx - 13, neck_y - 2),
        (cx - 9,  neck_y - 4),
        (cx - 4,  neck_y + 1),
        (cx - 7,  neck_y + 5),
    ]
    collar_r = [
        (cx + 4,  neck_y + 1),
        (cx + 11, neck_y - 4),
        (cx + 14, neck_y - 1),
        (cx + 9,  neck_y + 5),
    ]
    sp.polygon(collar_l, RED_MID, fill=True)
    sp.polygon(collar_r, RED_SH1, fill=True)
    # Lush velvet crimson highlight inside collar + crisp 1px gold outer piping
    sp.line(cx - 11, neck_y - 1, cx - 6, neck_y + 2, RED_HI)
    sp.line(cx + 6,  neck_y + 1, cx + 11, neck_y - 2, RED_MID)
    sp.line(cx - 13, neck_y - 2, cx - 9, neck_y - 4, GLD_HI)
    sp.line(cx - 9,  neck_y - 4, cx - 5, neck_y, GLD_MID)
    sp.line(cx + 5,  neck_y, cx + 11, neck_y - 4, GLD_MID)
    sp.line(cx + 11, neck_y - 4, cx + 14, neck_y - 1, GLD_SH1)

    # 2) Armored obsidian gorget with subtle gold collar edge
    for dy in range(0, 4):
        y = neck_y + dy
        hspan(sp, y, cx - 4, cx + 4, ARM_SH2 if dy >= 2 else ARM_SH1)
        sp.px(cx - 3, y, ARM_MID)
    sp.px(cx - 2, neck_y + 1, GLD_MID)
    sp.px(cx - 1, neck_y + 1, GLD_HI)
    sp.px(cx,     neck_y + 1, GLD_MID)
    sp.px(cx + 1, neck_y + 1, GLD_SH1)

    # 3) Sleek V-tapered Glossy Obsidian Plate Cuirass (clean dark steel base!)
    cuirass = {
        3:  (-9, 9),
        4:  (-9, 9),
        5:  (-9, 9),
        6:  (-8, 9),
        7:  (-8, 8),
        8:  (-7, 8),
        9:  (-7, 7),
        10: (-6, 7),
        11: (-6, 6),
        12: (-6, 6),
        13: (-6, 6),
        14: (-7, 7),
        15: (-7, 7),
    }
    for dy, (dl, dr) in cuirass.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, ARM_SH2)
        # Sleek cool obsidian-steel plate sheen on upper-left chest & sculpted waist lames
        if dy <= 10:
            hspan(sp, y, cx + dl, cx + 2, ARM_SH1)
            sp.px(cx + dl + 1, y, ARM_MID)
            if 5 <= dy <= 9:
                sp.px(cx + dl + 2, y, ARM_HI if dy in (6, 7) else ARM_MID)
        else:
            # Articulated glossy abdominal lames (cool steel reflection on left!)
            hspan(sp, y, cx + dl, cx, ARM_SH1)
            if dy in (11, 13):
                hspan(sp, y, cx - 4, cx, ARM_MID)
                sp.px(cx - 3, y, ARM_HI if dy == 11 else ARM_MID)

    # 4) ICONIC UPTURNED GOLDEN WINGED BREASTPLATE CREST (clearly framed against dark obsidian!)
    wy = neck_y + 5
    # Pointed imperial eagle/phoenix core
    sp.px(cx - 1, wy + 1, GLD_HI)
    sp.px(cx,     wy + 1, GLD_MID)
    sp.px(cx - 1, wy + 2, GLD_MID)
    sp.px(cx,     wy + 2, GLD_SH1)
    sp.px(cx - 1, wy + 3, GLD_HI)
    sp.px(cx,     wy + 3, GLD_MID)
    sp.px(cx - 1, wy + 4, GLD_SH1)
    # Dramatic upturned golden wings (2-tier feathered tips sweeping clearly up-left & up-right!)
    for (dx_w, dy_w, col) in [
        # Left (lit) wing feathers
        (-2, 1, GLD_HI),  (-3, 0, GLD_HI),  (-4, -1, GLD_HI), (-5, -1, GLD_MID),
        (-2, 2, GLD_MID), (-3, 1, GLD_MID), (-4, 0, GLD_MID),
        (-2, 3, GLD_SH1), (-3, 2, GLD_SH1),
        # Right (shaded) wing feathers
        (1, 1, GLD_MID),  (2, 0, GLD_MID),  (3, -1, GLD_MID), (4, -1, GLD_SH1),
        (1, 2, GLD_SH1),  (2, 1, GLD_SH1),  (3, 0, GLD_SH1),
        (1, 3, GLD_SH2),  (2, 2, GLD_SH2),
    ]:
        sp.px(cx + dx_w, wy + dy_w, col)

    # Sleek V-pointed Gothic Waist Belt & Ornate Gold Buckle (subtle filigree, NOT thick band!)
    by = neck_y + 14
    hspan(sp, by, cx - 6, cx + 6, ARM_SH1)
    sp.px(cx - 5, by, GLD_MID)
    sp.px(cx - 4, by, GLD_SH1)
    sp.px(cx + 4, by, GLD_SH1)
    sp.px(cx + 5, by, GLD_SH2)
    # Central pointed diamond filigree clasp
    sp.px(cx - 1, by - 1, GLD_HI)
    sp.px(cx,     by - 1, GLD_MID)
    hspan(sp, by, cx - 2, cx + 1, GLD_HI)
    sp.px(cx - 1, by, FLM_WHT)
    hspan(sp, by + 1, cx - 2, cx + 1, GLD_MID)
    sp.px(cx - 1, by + 2, GLD_HI)
    sp.px(cx,     by + 2, GLD_SH1)
    sp.px(cx - 1, by + 3, GLD_MID)

    # 5) Sleek Obsidian Split Tabard & Scalloped Hip Tassets (refined edge filigree, zero yellow striping!)
    ty0 = neck_y + 16
    for i in range(13):
        y = ty0 + i
        tw = 4 + (i // 4)
        hspan(sp, y, cx - tw, cx + tw - 1, ARM_SH2)
        if i > 1:
            sp.px(cx - tw + 1, y, ARM_SH1)
        # Delicate 1px gold embroidered tabard side trim
        sp.px(cx - tw, y, GLD_MID if i % 2 == 0 else GLD_SH1)
        sp.px(cx + tw - 1, y, GLD_SH1 if i % 2 == 0 else GLD_SH2)
    hspan(sp, ty0 + 12, cx - 6, cx + 5, GLD_SH1)
    hspan(sp, ty0 + 12, cx - 5, cx, GLD_MID)
    sp.px(cx - 3, ty0 + 12, GLD_HI)

    # Sculpted Left & Right Obsidian Tassets (glossy dark plates with crisp bottom & outer gold rims only!)
    for side in (-1, 1):
        is_lit = (side == -1)
        for i in range(11):
            y = ty0 + i
            t = i / 10.0
            inner_x = cx + side * (3 + int(round(t * 2)))
            outer_x = cx + side * (8 + int(round(t * 4)))
            x0, x1 = sorted((inner_x, outer_x))
            hspan(sp, y, x0, x1, ARM_SH1 if is_lit else ARM_SH2)
            if is_lit:
                sp.px(x0 + 1, y, ARM_MID)
                if i in (2, 3, 6, 7):
                    sp.px(x0 + 2, y, ARM_HI)
                if i in (4, 8):
                    # Subtle recessed obsidian lame groove (NOT bright yellow!)
                    hspan(sp, y, x0 + 1, x1 - 1, ARM_SH2)
            else:
                sp.px(x0 + 1, y, ARM_SH1)
                if i in (2, 6):
                    sp.px(x0 + 2, y, ARM_MID)
                if i in (4, 8):
                    hspan(sp, y, x0 + 1, x1 - 1, INK_DARK)
            # Crisp gold trim ONLY along outer curved edge & bottom hem!
            sp.px(outer_x, y, GLD_HI if (is_lit and i % 3 == 0) else (GLD_MID if is_lit else GLD_SH1))
            if i == 10:
                hspan(sp, y, x0, x1, GLD_MID if is_lit else GLD_SH1)
                if is_lit:
                    sp.px(x0 + 1, y, GLD_HI)

    # 6) ICONIC GOLDEN SUN-MEDALLION CLASP on far-left shoulder-collar joint (from ref art!)
    mx, my = cx - 8, neck_y + 4
    sp.circle(mx, my, 2, GLD_SH1, fill=True)
    sp.px(mx, my, GLD_HI)
    sp.px(mx - 1, my - 1, GLD_HI)
    sp.px(mx + 1, my, GLD_MID)
    sp.px(mx, my + 1, GLD_MID)
    sp.px(mx - 1, my + 1, GLD_SH2)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str):
    """Jewelry-Refined East-Wing Commander Head:
    - Sleek tall obsidian-black curved horns with delicate gold base filigree (no yellow stripes!)
    - Sharp pointed gothic gold crown spire with symmetrical baroque tracery
    - Sculpted curved half-visor shading far-left eye, gleaming clean alabaster face
    - Piercing crimson anime eye (ZERO dark eyebag!), feathered silver hair lock & stern/fierce mouth!
    """
    sp.layer("head")

    # 1) PALE ARISTOCRATIC FACE & TAPERED V-CHIN (head_y + 18 .. head_y + 30)
    face_rows = {
        18: (-6, 6),
        19: (-6, 6),
        20: (-6, 7),
        21: (-6, 7),
        22: (-6, 7),
        23: (-6, 7),
        24: (-6, 6),
        25: (-5, 6),
        26: (-4, 5),
        27: (-3, 4),
        28: (-2, 3),
        29: (-2, 2),
        30: (-1, 1),
    }
    for dy, (dl, dr) in face_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, SKIN_MID)
        # Smooth alabaster cheekbone & nose-bridge glow
        if 22 <= dy <= 27:
            hspan(sp, y, cx - 2, cx + 1, SKIN_HI)
        # Delicate visor cast shadow along upper edge & right jaw contour
        if dy <= 20:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
        if dy >= 24:
            sp.px(cx + dr, y, SKIN_SH1)
        if dy >= 29:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    # Subtle crisp nose shadow dot
    sp.px(cx - 2, head_y + 24, SKIN_SH1)

    # 2) RAZOR-SHARP PIERCING CRIMSON ANIME EYE (ZERO dark under-eye smudge!)
    ey = head_y + 21
    ex = cx + 1  # spans x = cx+1 .. cx+5
    if pose == "blink":
        # Cold composed closed lash
        hspan(sp, ey + 2, ex, ex + 4, INK_DARK)
        sp.px(ex + 5, ey + 1, INK_DARK)
        hspan(sp, ey + 3, ex + 1, ex + 3, SKIN_SH1)
    elif pose == "hurt":
        # Sharp fierce clenched wince (`<`)
        sp.px(ex + 4, ey, INK_DARK)
        sp.px(ex + 3, ey + 1, INK_DARK)
        sp.px(ex + 2, ey + 2, INK_DARK)
        sp.px(ex + 1, ey + 2, INK_DARK)
        sp.px(ex + 3, ey + 3, INK_DARK)
        sp.px(ex + 4, ey + 4, INK_DARK)
    else:
        fierce = pose in ("windup", "strike")
        # Sleek angled dark upper eyeliner with crisp outer wing
        sp.px(ex - 1, ey + 1, INK_DARK)
        hspan(sp, ey, ex, ex + 4, INK_DARK)
        sp.px(ex + 5, ey, INK_DARK)
        if fierce:
            # Lowered angry brow pressure on inner corner
            sp.px(ex, ey + 1, INK_DARK)
            sp.px(ex + 1, ey + 1, INK_DARK)

        # Row +1: crisp catchlight + deep crimson upper iris + bright sclera!
        sp.px(ex,     ey + 1, PURE_WHT if not fierce else INK_DARK)
        sp.px(ex + 1, ey + 1, PURE_WHT)
        sp.px(ex + 2, ey + 1, RED_SH1)
        sp.px(ex + 3, ey + 1, RED_HI)
        sp.px(ex + 4, ey + 1, PURE_WHT)

        # Row +2: cohesive razor-sharp crimson iris + dark pinpoint pupil!
        sp.px(ex,     ey + 2, PURE_WHT)
        sp.px(ex + 1, ey + 2, RED_HI if not fierce else EYE_CORE)
        sp.px(ex + 2, ey + 2, INK_DARK)
        sp.px(ex + 3, ey + 2, EYE_CORE)
        sp.px(ex + 4, ey + 2, PURE_WHT)

        # Row +3: luminous crimson lower crescent cleanly bordered by alabaster skin!
        sp.px(ex,     ey + 3, SKIN_MID)
        sp.px(ex + 1, ey + 3, EYE_CORE)
        sp.px(ex + 2, ey + 3, FLM_WHT if fierce else EYE_CORE)
        sp.px(ex + 3, ey + 3, RED_HI)
        sp.px(ex + 4, ey + 3, SKIN_MID)
        # Single subtle 1px inner lower lid accent only
        sp.px(ex + 2, ey + 4, SKIN_SH1)

    # 3) Expressive Aristocratic Boss Mouth (dy = 26..27)
    my = head_y + 27
    mx = cx - 1
    if pose == "strike":
        # Fierce determined battle shout (sharp wide snarl!)
        hspan(sp, my - 1, mx - 1, mx + 1, INK_DARK)
        sp.px(mx - 1, my, RED_SH1)
        sp.px(mx,     my, RED_MID)
        sp.px(mx + 1, my, RED_SH1)
        sp.px(mx + 2, my - 1, SKIN_SH2)
    elif pose == "hurt":
        # True clenched recoil grimace (NO toothy smile!)
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx,     my - 1, INK_DARK)
        sp.px(mx + 1, my - 1, INK_DARK)
        sp.px(mx + 2, my, SKIN_SH2)
    elif pose == "windup":
        # Tense focused straight line
        hspan(sp, my, mx - 1, mx + 1, SKIN_SH2)
    else:
        # Cool regal stoic expression
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx,     my, SKIN_SH2)
        sp.px(mx + 1, my - 1, SKIN_SH1)

    # 4) FEATHERED SLEEK SILVER-WHITE HAIR LOCK (seamless interior, zero black outline pinholes!)
    hspan(sp, head_y + 18, cx + 1, cx + 8, HAIR_MID)
    hspan(sp, head_y + 19, cx + 2, cx + 8, HAIR_HI)
    sp.px(cx + 1, head_y + 19, HAIR_SH)
    sp.px(cx + 1, head_y + 20, HAIR_MID)
    sp.px(cx + 2, head_y + 20, HAIR_HI)
    # Primary sculpted cheek silver lock + smoothly merged outer windswept strand!
    silver_lock = [
        (20, 6, 9),
        (21, 6, 9),
        (22, 6, 9),
        (23, 6, 10),
        (24, 6, 10),
        (25, 5, 10),
        (26, 5, 10),
        (27, 5, 9),
        (28, 5, 7),
        (29, 5, 6),
        (30, 5, 5),
    ]
    for dy, x0, x1 in silver_lock:
        y = head_y + dy
        hspan(sp, y, cx + x0, cx + x1, HAIR_MID)
        sp.px(cx + x0, y, HAIR_HI if dy <= 27 else HAIR_MID)
        if x1 - x0 >= 3 and 23 <= dy <= 27:
            # Soft shadow groove separating main lock from outer wisp (NO transparent black pinhole!)
            sp.px(cx + x1 - 1, y, HAIR_SH)
            sp.px(cx + x1, y, HAIR_MID if dy <= 26 else HAIR_SH)
        else:
            sp.px(cx + x1, y, HAIR_SH)
    # Cleanly separated tapered lower tip of secondary outer silver wisp (dy=28..29)
    sp.px(cx + 9, head_y + 28, HAIR_MID)
    sp.px(cx + 9, head_y + 29, HAIR_SH)

    # 5) ORNATE OBSIDIAN HELM DOME & CURVED GOTHIC HALF-VISOR!
    helm_dome = {
        11: (-6, 6),
        12: (-8, 8),
        13: (-9, 8),
        14: (-9, 9),
        15: (-9, 9),
        16: (-10, 9),
        17: (-10, 9),
        18: (-10, 9),
        19: (-10, 9),
    }
    for dy, (dl, dr) in helm_dome.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, ARM_SH1)
        hspan(sp, y, cx + dl, cx + dl + 3, ARM_MID)
        if 13 <= dy <= 17:
            sp.px(cx + dl + 2, y, ARM_HI)
        hspan(sp, y, cx + dr - 3, cx + dr, ARM_SH2)

    # Sculpted curved gothic brow arch over exposed right eye (arched gracefully, NOT a flat ruler!)
    sp.px(cx + 1, head_y + 18, GLD_HI)
    sp.px(cx + 2, head_y + 17, GLD_HI)
    hspan(sp, head_y + 17, cx + 3, cx + 6, GLD_MID)
    sp.px(cx + 7, head_y + 18, GLD_MID)
    sp.px(cx + 8, head_y + 18, GLD_SH1)
    sp.px(cx + 9, head_y + 19, ARM_SH2)
    sp.px(cx + 10, head_y + 20, ARM_SH2)

    # ASYMMETRIC CURVED DROPPED HALF-VISOR COVERING FAR-LEFT EYE + GOTHIC GOLD TRIM!
    visor_rows = {
        19: (-10, 1),
        20: (-10, 0),
        21: (-10, -1),
        22: (-10, -2),
        23: (-10, -2),
        24: (-9,  -3),
        25: (-9,  -4),
        26: (-8,  -4),
        27: (-7,  -4),
        28: (-6,  -4),
        29: (-5,  -4),
    }
    for dy, (dl, dr) in visor_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, ARM_SH2)
        if dl + 1 < dr:
            sp.px(cx + dl + 1, y, ARM_SH1)
        if dy <= 23 and dl + 2 < dr:
            sp.px(cx + dl + 2, y, ARM_MID)
        if dy == 21 and dl + 3 < dr:
            sp.px(cx + dl + 3, y, ARM_HI)
        # Delicate razor-crisp gold baroque inner edge trim
        sp.px(cx + dr, y, GLD_HI if dy <= 21 else GLD_MID)
        if dy in (20, 23, 26) and dr - 1 >= dl:
            sp.px(cx + dr - 1, y, GLD_SH1)
        # Subtle spiked cheek-guard studs along outer-left edge
        if dy in (20, 23, 26):
            sp.px(cx + dl, y, GLD_SH1)

    # 6) SHARP POINTED GOTHIC BAROQUE GOLD CROWN SPIRE (concave gothic point, symmetrical tracery!)
    crown_spire = {
        4:  (-1, -1),
        5:  (-1, 0),
        6:  (-2, 0),
        7:  (-2, 1),
        8:  (-3, 1),
        9:  (-3, 2),
        10: (-4, 2),
        11: (-4, 3),
        12: (-5, 4),
        13: (-5, 4),
        14: (-6, 5),
        15: (-5, 4),
        16: (-4, 3),
        17: (-2, 1),
    }
    for dy, (dl, dr) in crown_spire.items():
        y = head_y + dy
        # Deep obsidian backing behind delicate symmetrical gold tracery arches
        hspan(sp, y, cx + dl, cx + dr, ARM_SH2)
        # Crisp gothic gold outer spire border
        sp.px(cx + dl, y, GLD_HI if dy <= 12 else GLD_MID)
        sp.px(cx + dr, y, GLD_MID if dy <= 11 else GLD_SH1)
        # Central vertical golden lancet spine
        if 5 <= dy <= 16:
            sp.px(cx - 1, y, GLD_HI if dy <= 10 else GLD_MID)
            if dy >= 8:
                sp.px(cx, y, GLD_MID if dy <= 13 else GLD_SH1)
        # Symmetrical gothic trefoil cross-bars (NOT a waffle checkerboard!)
        if dy in (10, 14):
            hspan(sp, y, cx + dl + 1, cx + dr - 1, GLD_MID)
            sp.px(cx - 1, y, GLD_HI)
        if dy in (12, 15):
            sp.px(cx + dl + 1, y, GLD_SH1)
            sp.px(cx + dr - 1, y, GLD_SH1)
    # Gleaming apex finial & central brow jewel highlight
    sp.px(cx - 1, head_y + 4, FLM_WHT)
    sp.px(cx - 1, head_y + 16, GLD_HI)

    # 7) TALL SLEEK CURVED OBSIDIAN-BLACK HORNS (glossy black steel + delicate gold base filigree ONLY!)
    left_horn = [
        # (dy, x_center, width)
        (14, -9,  4),
        (13, -10, 4),
        (12, -11, 3),
        (11, -12, 3),
        (10, -12, 3),
        (9,  -12, 3),
        (8,  -12, 3),
        (7,  -12, 2),
        (6,  -11, 2),
        (5,  -11, 2),
        (4,  -10, 2),
        (3,  -10, 2),
        (2,  -9,  2),
        (1,  -8,  1),
        (0,  -7,  1),
    ]
    for dy, xc, w in left_horn:
        y = head_y + dy
        x0 = cx + xc - (w // 2)
        x1 = x0 + w - 1
        hspan(sp, y, x0, x1, ARM_SH2)
        if w >= 3:
            sp.px(x0, y, ARM_HI if dy <= 10 else GLD_MID)       # sleek steel shine, gold filigree at base!
            sp.px(x0 + 1, y, ARM_MID if dy <= 11 else ARM_SH1)
            sp.px(x1, y, GLD_MID if dy >= 10 else ARM_SH1)      # subtle inner gold edge near base
        elif w == 2:
            sp.px(x0, y, ARM_HI)                                # pure gleaming obsidian steel tip!
            sp.px(x1, y, ARM_SH1)
        else:
            sp.px(x0, y, ARM_HI)

    right_horn = [
        (14, 9,  4),
        (13, 10, 4),
        (12, 11, 3),
        (11, 11, 3),
        (10, 12, 3),
        (9,  12, 3),
        (8,  11, 3),
        (7,  11, 2),
        (6,  11, 2),
        (5,  10, 2),
        (4,  10, 2),
        (3,  9,  2),
        (2,  8,  2),
        (1,  8,  1),
        (0,  7,  1),
    ]
    for dy, xc, w in right_horn:
        y = head_y + dy
        x0 = cx + xc - (w // 2)
        x1 = x0 + w - 1
        hspan(sp, y, x0, x1, ARM_SH2)
        if w >= 3:
            sp.px(x0, y, GLD_MID if dy >= 11 else ARM_MID)      # lit inner edge
            sp.px(x0 + 1, y, ARM_SH1)
            sp.px(x1, y, ARM_SH2 if dy < 13 else GLD_SH1)
        elif w == 2:
            sp.px(x0, y, ARM_MID)
            sp.px(x1, y, ARM_SH2)
        else:
            sp.px(x0, y, ARM_HI if dy == 0 else ARM_MID)

    # Ornate baroque gold filigree base-cuffs anchoring both obsidian horns to helm!
    hspan(sp, head_y + 13, cx - 11, cx - 7, GLD_MID)
    sp.px(cx - 10, head_y + 13, GLD_HI)
    sp.px(cx - 10, head_y + 12, GLD_SH1)
    hspan(sp, head_y + 13, cx + 7, cx + 11, GLD_SH1)
    sp.px(cx + 8, head_y + 13, GLD_MID)
    sp.px(cx + 9, head_y + 12, GLD_SH2)


def _draw_pauldron(sp: Sprite, px_c: int, py_c: int, side: int):
    """Sleek sculpted obsidian-black baroque shoulder pauldron with refined outer gold rim."""
    is_lit = (side == -1)
    rows = {
        -4: (-3, 3),
        -3: (-5, 4),
        -2: (-6, 5),
        -1: (-6, 6),
        0:  (-6, 6),
        1:  (-5, 6),
        2:  (-5, 5),
        3:  (-4, 4),
        4:  (-3, 3),
    }
    for dy, (dl, dr) in rows.items():
        if side == 1:
            dl, dr = -dr, -dl
        y = py_c + dy
        x0, x1 = px_c + dl, px_c + dr
        hspan(sp, y, x0, x1, ARM_SH1 if is_lit else ARM_SH2)
        # Glossy obsidian cool-steel shoulder highlight
        if dy <= 1:
            hspan(sp, y, x0 + 1, x0 + 3, ARM_MID if is_lit else ARM_SH1)
            if dy in (-2, -1):
                sp.px(x0 + 2, y, ARM_HI if is_lit else ARM_MID)
        # Recessed articulated obsidian lame seam (NO busy bright yellow stripe across center!)
        if dy == 1:
            hspan(sp, y, x0 + 1, x1 - 1, ARM_SH2 if is_lit else INK_DARK)
        # Crisp gold trim ONLY along top crest & lower rim + outer baroque edge!
        if dy in (-4, 4):
            hspan(sp, y, x0, x1, GLD_MID if is_lit else GLD_SH1)
            sp.px(x0 + 1, y, GLD_HI if is_lit else GLD_MID)
        sp.px(x0, y, GLD_HI if (is_lit and dy <= 1) else GLD_MID)
        sp.px(x1, y, GLD_SH1 if is_lit else GLD_SH2)
    # Delicate gold filigree fleur-de-lis scroll on upper shoulder dome
    sp.px(px_c, py_c - 2, GLD_HI if is_lit else GLD_MID)
    sp.px(px_c + side, py_c - 1, GLD_MID if is_lit else GLD_SH1)
    sp.px(px_c - side, py_c - 1, GLD_SH1 if is_lit else GLD_SH2)


def _draw_arm_segment(sp: Sprite, x0: int, y0: int, x1: int, y1: int, is_far: bool):
    """Articulated obsidian armored vambrace/bicep."""
    pts = bresenham_pts(x0, y0, x1, y1)
    a_hi  = ARM_MID if is_far else ARM_HI
    a_mid = ARM_SH1 if is_far else ARM_MID
    a_sh  = ARM_SH2 if is_far else ARM_SH1
    horiz = abs(x1 - x0) >= abs(y1 - y0)
    for i, (px, py) in enumerate(pts):
        if horiz:
            sp.px(px, py - 1, a_hi if i % 3 != 2 else a_mid)
            sp.px(px, py,     a_mid)
            sp.px(px, py + 1, a_sh)
            sp.px(px, py + 2, ARM_SH2)
        else:
            sp.px(px - 1, py, a_hi if i % 3 != 2 else a_mid)
            sp.px(px,     py, a_mid)
            sp.px(px + 1, py, a_sh)
            sp.px(px + 2, py, ARM_SH2)


def _draw_gauntlet(sp: Sprite, hx: int, hy: int, is_far: bool):
    """Armored obsidian-and-gold clenched gauntlet gripping the halberd shaft."""
    sp.rect(hx - 2, hy - 2, hx + 2, hy + 2, ARM_SH1 if not is_far else ARM_SH2)
    sp.px(hx - 2, hy - 2, ARM_HI if not is_far else ARM_MID)
    sp.px(hx - 1, hy - 2, GLD_HI if not is_far else GLD_MID)
    sp.px(hx,     hy - 1, ARM_MID)
    sp.px(hx + 1, hy - 1, GLD_MID if not is_far else GLD_SH1)
    sp.px(hx - 1, hy + 1, GLD_SH1)
    sp.px(hx + 2, hy + 2, INK_DARK)


def draw_arms_and_flaming_halberd(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Draws arms, pauldrons, iconic huge flaming crimson-gold halberd, and pure pixel fire VFX.
    Frame 4 (windup) has ZERO face/horn collision: hands grip cleanly below chin and hoist
    the blazing halberd high into open upper-right sky!
    """
    far_sh_x,  far_sh_y  = cx - 10, torso_y + 4
    near_sh_x, near_sh_y = cx + 10, torso_y + 4

    if pose == "windup":
        # ZERO-COLLISION OVERHEAD BACK-COIL!
        # Both hands grip diagonally BELOW the chin/collar, hoisting the massive blazing
        # halberd cleanly into wide open upper-right sky (x=59..76, y=5..26), clear of right horn (x=55)!
        far_el_x,  far_el_y  = cx - 7,  torso_y + 10
        far_hx,    far_hy    = cx + 2,  torso_y + 11
        near_el_x, near_el_y = cx + 14, torso_y + 8
        near_hx,   near_hy   = cx + 13, torso_y + 1

        butt_x, butt_y     = cx - 10, torso_y + 23
        sock_x, sock_y     = cx + 20, torso_y - 10   # (63, 25) — wide open sky!
        tip_x,  tip_y      = cx + 27, torso_y - 26   # (70, 9)  — crisp top safety buffer for fire blossom!

    elif pose == "strike":
        # DEVASTATING TWO-HANDED SWEEPING FIERY CLEAVE LEFT!
        # Hands slightly lower so the golden winged breastplate crest stays 100% VISIBLE above the shaft!
        far_el_x,  far_el_y  = cx - 13, torso_y + 9
        far_hx,    far_hy    = cx - 16, torso_y + 12
        near_el_x, near_el_y = cx + 6,  torso_y + 12
        near_hx,   near_hy   = cx - 4,  torso_y + 13

        butt_x, butt_y     = cx + 11, torso_y + 15
        sock_x, sock_y     = cx - 22, torso_y + 12
        tip_x,  tip_y      = cx - 35, torso_y + 11   # flush with sweeping white-gold crescent edge at x=5!

    elif pose == "hurt":
        # Heavy armored recoil defensive brace
        far_el_x,  far_el_y  = cx - 13, torso_y + 10
        far_hx,    far_hy    = cx - 14, torso_y + 14
        near_el_x, near_el_y = cx + 15, torso_y + 10
        near_hx,   near_hy   = cx + 17, torso_y + 15

        butt_x, butt_y     = cx - 5,  torso_y + 34
        sock_x, sock_y     = cx - 20, torso_y - 1
        tip_x,  tip_y      = cx - 26, torso_y - 20

    else:
        # Commanding Royal Boss Stance (faithful to eastwing_commander.png!)
        # Towering needle-sharp spear spire soars cleanly up to y = 5!
        far_el_x,  far_el_y  = cx - 14, torso_y + 9
        far_hx,    far_hy    = cx - 16, torso_y + 14
        near_el_x, near_el_y = cx + 13, torso_y + 10
        near_hx,   near_hy   = cx + 12, torso_y + 18

        butt_x, butt_y     = cx - 11, GROUND_Y - 1
        sock_x, sock_y     = cx - 22, torso_y - 5
        tip_x,  tip_y      = cx - 27, torso_y - 28   # towering spear point at y = 6!

    # --- 1) FAR ARM ---
    sp.layer("far_arm")
    _draw_arm_segment(sp, far_sh_x, far_sh_y + 2, far_el_x, far_el_y, is_far=True)
    _draw_arm_segment(sp, far_el_x, far_el_y, far_hx, far_hy, is_far=True)
    _draw_pauldron(sp, far_sh_x, far_sh_y, side=-1)

    # --- 2) NEAR ARM ---
    sp.layer("near_arm")
    _draw_arm_segment(sp, near_sh_x, near_sh_y + 2, near_el_x, near_el_y, is_far=False)
    _draw_arm_segment(sp, near_el_x, near_el_y, near_hx, near_hy, is_far=False)
    _draw_pauldron(sp, near_sh_x, near_sh_y, side=1)

    # --- 3) MASSIVE ORNATE FLAMING CRIMSON-GOLD HALBERD (weapon layer) ---
    sp.layer("weapon")
    dx = tip_x - butt_x
    dy = tip_y - butt_y
    length = max(1.0, math.hypot(dx, dy))
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux

    if pose == "strike":
        if ny < 0:
            nx, ny = -nx, -ny
    elif pose == "windup":
        # Axe blade faces outward-right / up-right so it never intrudes toward the right horn!
        if nx < 0:
            nx, ny = -nx, -ny
    else:
        # Axe blade faces outward-LEFT
        if nx > 0:
            nx, ny = -nx, -ny

    # 3a) Sleek lacquered obsidian polearm shaft
    shaft_pts = bresenham_pts(butt_x, butt_y, sock_x, sock_y)
    horiz_s = abs(sock_x - butt_x) >= abs(sock_y - butt_y)
    for i, (px, py) in enumerate(shaft_pts):
        sp.px(px, py, ARM_SH2)
        if horiz_s:
            sp.px(px, py - 1, ARM_MID if i % 4 != 0 else ARM_HI)
            sp.px(px, py + 1, ARM_SH2)
        else:
            sp.px(px - 1, py, ARM_MID if i % 4 != 0 else ARM_HI)
            sp.px(px + 1, py, ARM_SH2)

    # Gold pommel cap
    sp.px(butt_x, butt_y, GLD_MID)
    sp.px(int(round(butt_x - ux)), int(round(butt_y - uy)), GLD_HI)

    # Ornate golden shaft collar rings below furnace socket
    for back_d in (2.0, 5.0):
        rx = int(round(sock_x - ux * back_d))
        ry = int(round(sock_y - uy * back_d))
        for s in (-2, -1, 0, 1, 2):
            cx_r = int(round(rx + nx * s))
            cy_r = int(round(ry + ny * s))
            sp.px(cx_r, cy_r, GLD_HI if s <= 0 else GLD_MID)

    # 3b) TOWERING NEEDLE-SHARP OBSIDIAN-AND-GOLD SPEAR SPIRE (unmistakable halberd profile!)
    spire_pts = bresenham_pts(sock_x, sock_y, tip_x, tip_y)
    n_sp = max(1, len(spire_pts) - 1)
    for i, (px, py) in enumerate(spire_pts):
        t = i / n_sp
        # Wide baroque flare at base, tapering smoothly to a razor 1px needle tip!
        half_w = 2.6 * ((1.0 - t) ** 0.95)
        for s in range(-3, 4):
            if abs(s) <= half_w:
                bx = int(round(px + nx * s))
                by = int(round(py + ny * s))
                if not (1 <= bx < W - 1 and 1 <= by < H - 1):
                    continue
                if t > 0.80:
                    col = GLD_HI if t > 0.90 else GLD_MID
                elif abs(s) >= half_w - 0.85:
                    col = GLD_HI if s >= 0 else GLD_MID
                elif t < 0.34:
                    col = FLM_WHT if abs(s) < 0.8 else FLM_ORG
                else:
                    col = FLM_RED if (abs(s) < 0.85 and t < 0.72) else ARM_SH2
                sp.px(bx, by, col)

    # 3c) SCULPTED GOTHIC CRESCENT BATTLE-AXE BLADE on +normal side!
    axe_poly = [
        (sock_x + ux * 1 + nx * 1,  sock_y + uy * 1 + ny * 1),
        (sock_x + ux * 8 + nx * 2,  sock_y + uy * 8 + ny * 2),
        (sock_x + ux * 11 + nx * 8, sock_y + uy * 11 + ny * 8),  # sharp upper axe horn
        (sock_x + ux * 4 + nx * 11, sock_y + uy * 4 + ny * 11),  # sweeping outer blade edge
        (sock_x - ux * 6 + nx * 8,  sock_y - uy * 6 + ny * 8),   # wicked hooked lower beard
        (sock_x - ux * 2 + nx * 2,  sock_y - uy * 2 + ny * 2),
    ]
    sp.polygon(axe_poly, ARM_SH2, fill=True)
    # Molten red-orange furnace interior inside the obsidian axe blade
    axe_inner = [
        (sock_x + ux * 2 + nx * 2,  sock_y + uy * 2 + ny * 2),
        (sock_x + ux * 7 + nx * 4,  sock_y + uy * 7 + ny * 4),
        (sock_x + ux * 4 + nx * 8,  sock_y + uy * 4 + ny * 8),
        (sock_x - ux * 2 + nx * 6,  sock_y - uy * 2 + ny * 6),
    ]
    sp.polygon(axe_inner, FLM_RED, fill=True)
    # Razor-bright gold & incandescent amber cutting crescent along outer edge
    sp.line(sock_x + ux * 11 + nx * 8, sock_y + uy * 11 + ny * 8,
            sock_x + ux * 4 + nx * 11, sock_y + uy * 4 + ny * 11, GLD_HI)
    sp.line(sock_x + ux * 4 + nx * 11, sock_y + uy * 4 + ny * 11,
            sock_x - ux * 6 + nx * 8,  sock_y - uy * 6 + ny * 8, GLD_MID)
    sp.line(sock_x + ux * 8 + nx * 7,  sock_y + uy * 8 + ny * 7,
            sock_x + ux * 3 + nx * 9,  sock_y + uy * 3 + ny * 9, FLM_ORG)
    sp.line(sock_x + ux * 3 + nx * 9,  sock_y + uy * 3 + ny * 9,
            sock_x - ux * 3 + nx * 7,  sock_y - uy * 3 + ny * 7, FLM_YLW)

    # 3d) Sharp Curved Rear Fluke / Hook on -normal side!
    fluke_poly = [
        (sock_x + ux * 5 - nx * 1, sock_y + uy * 5 - ny * 1),
        (sock_x + ux * 8 - nx * 6, sock_y + uy * 8 - ny * 6),
        (sock_x + ux * 1 - nx * 4, sock_y + uy * 1 - ny * 4),
    ]
    sp.polygon(fluke_poly, ARM_SH1, fill=True)
    sp.line(sock_x + ux * 5 - nx * 1, sock_y + uy * 5 - ny * 1,
            sock_x + ux * 8 - nx * 6, sock_y + uy * 8 - ny * 6, GLD_HI)
    sp.line(sock_x + ux * 8 - nx * 6, sock_y + uy * 8 - ny * 6,
            sock_x + ux * 1 - nx * 4, sock_y + uy * 1 - ny * 4, GLD_MID)

    # 3e) Incandescent Red Lotus white-gold molten heart at the halberd socket!
    sp.circle(sock_x + ux * 2, sock_y + uy * 2, 2, FLM_YLW, fill=True)
    sp.px(int(round(sock_x + ux * 2)), int(round(sock_y + uy * 2)), PURE_WHT)
    sp.px(int(round(sock_x + ux * 3 + nx)), int(round(sock_y + uy * 3 + ny)), FLM_WHT)

    # --- 4) GAUNTLETED HANDS OVER SHAFT ---
    sp.layer("near_arm")
    _draw_gauntlet(sp, far_hx, far_hy, is_far=True)
    _draw_gauntlet(sp, near_hx, near_hy, is_far=False)

    # --- 5) ORGANIC INCANDESCENT PIXEL FIRE VFX (fx layer: 100% 4-connected, NO rake sticks!) ---
    sp.layer("fx")

    def _flame_wisp(pts_ctrl: list[tuple[float, float]], thick_base: bool = True, hot: bool = False):
        """Draws a graceful organic S-curved 4-connected pixel flame wisp through control points."""
        # Interpolate densely along piecewise curve so every curve bends gracefully!
        dense = []
        for idx_p in range(len(pts_ctrl) - 1):
            x0, y0 = pts_ctrl[idx_p]
            x1, y1 = pts_ctrl[idx_p + 1]
            sub = max(4, int(math.hypot(x1 - x0, y1 - y0) * 2))
            for s in range(sub):
                u = s / sub
                dense.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u))
        dense.append(pts_ctrl[-1])

        n_d = max(1, len(dense) - 1)
        prev = None
        for i, (fx_f, fy_f) in enumerate(dense):
            t = i / n_d
            fx, fy = int(round(fx_f)), int(round(fy_f))
            if not (1 <= fx < W - 1 and 1 <= fy < H - 1):
                prev = None
                continue
            if hot:
                col = PURE_WHT if t < 0.22 else (FLM_WHT if t < 0.48 else (FLM_YLW if t < 0.74 else FLM_ORG))
            else:
                col = FLM_WHT if t < 0.16 else (FLM_YLW if t < 0.42 else (FLM_ORG if t < 0.72 else FLM_RED))
            if prev is not None and (abs(prev[0] - fx) + abs(prev[1] - fy) > 1):
                seg = bresenham_pts(prev[0], prev[1], fx, fy)
                for p0, p1 in zip(seg, seg[1:]):
                    if 1 <= p1[0] < W - 1 and 1 <= p1[1] < H - 1:
                        sp.px(p1[0], p1[1], col)
                    if p0[0] != p1[0] and p0[1] != p1[1]:
                        if 1 <= p0[0] < W - 1 and 1 <= p1[1] < H - 1:
                            sp.px(p0[0], p1[1], col)
            sp.px(fx, fy, col)
            if thick_base and t < 0.45:
                sub_col = FLM_YLW if (hot or t < 0.22) else FLM_ORG
                if 1 <= fx + 1 < W - 1:
                    sp.px(fx + 1, fy, sub_col)
                if t < 0.25 and 1 <= fy + 1 < H - 1:
                    sp.px(fx, fy + 1, FLM_ORG if not hot else FLM_YLW)
            prev = (fx, fy)

    def _ember_pair(ex_p: int, ey_p: int, c1: str, c2: str):
        if 1 <= ex_p < W - 2 and 1 <= ey_p < H - 2:
            sp.px(ex_p, ey_p, c1)
            sp.px(ex_p, ey_p + 1, c2)

    if pose == "windup":
        # BLAZING BRIGHT AMBER-GOLD-WHITE RED LOTUS INFERNO BLOSSOM (clean open-sky silhouette!)
        fx_c = int(round(sock_x + ux * 3 + nx * 2))
        fy_c = int(round(sock_y + uy * 3 + ny * 2))
        # Blinding 4-point white-gold ignition star at furnace core!
        sp.px(fx_c, fy_c, PURE_WHT)
        for d in (1, 2, 3, 4, 5):
            col = PURE_WHT if d == 1 else (FLM_WHT if d == 2 else (FLM_YLW if d == 3 else (FLM_ORG if d == 4 else FLM_RED)))
            for ddx, ddy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                if 1 <= fx_c + ddx < W - 1 and 2 <= fy_c + ddy < H - 1:
                    sp.px(fx_c + ddx, fy_c + ddy, col)
        for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1), (2, -2), (-2, -2)):
            if 1 <= fx_c + ddx < W - 1 and 2 <= fy_c + ddy < H - 1:
                sp.px(fx_c + ddx, fy_c + ddy, FLM_WHT if abs(ddx) == 1 else FLM_YLW)

        # Lush curving Red Lotus amber-gold flame petals wreathing the raised halberd head!
        _flame_wisp([(sock_x + 4, sock_y + 2), (sock_x + 11, sock_y - 2), (sock_x + 10, sock_y - 9), (sock_x + 7, sock_y - 14)], True, hot=True)
        _flame_wisp([(sock_x + 1, sock_y - 4), (sock_x - 3, sock_y - 10), (sock_x + 1, sock_y - 16), (sock_x + 5, sock_y - 20)], True, hot=True)
        _flame_wisp([(tip_x - 1, tip_y + 2), (tip_x + 2, tip_y - 2), (tip_x + 1, max(3, tip_y - 5))], False, hot=True)
        _flame_wisp([(sock_x + 6, sock_y + 5), (sock_x + 12, sock_y + 3), (sock_x + 12, sock_y - 3)], True, hot=False)

        # Crisp connected 2px rising embers cleanly inside upper-right sky
        _ember_pair(fx_c - 5, max(3, fy_c - 15), PURE_WHT, FLM_YLW)
        _ember_pair(min(W - 3, fx_c + 10), max(4, fy_c - 11), FLM_WHT, FLM_ORG)

    elif pose == "strike":
        # FLUSH RAZOR-TAPERED SWEEPING FIERY CLEAVE CRESCENT (fused seamlessly with halberd tip & axe!)
        arc_cx = cx - 9
        arc_cy = torso_y + 10
        for step in range(180):
            t = step / 179.0
            ang = math.radians(-118 - t * 114)
            if t < 0.84:
                env = math.sin((t / 0.84) * (math.pi * 0.5)) ** 1.15
            else:
                env = max(0.15, (1.0 - t) / 0.16)
            max_w = 0.6 + 5.6 * env
            n_sub = max(1, int(max_w * 2))
            for ri in range(n_sub + 1):
                dr = -ri * 0.5
                frac = ri / max(1, n_sub)
                if frac < 0.22:
                    col = FLM_RED
                elif frac < 0.44:
                    col = FLM_RED if t < 0.25 else FLM_ORG
                elif frac < 0.68:
                    col = FLM_ORG if t < 0.35 else FLM_YLW
                elif frac < 0.88:
                    col = FLM_YLW if t < 0.50 else FLM_WHT
                else:
                    col = PURE_WHT if t > 0.55 else FLM_WHT
                r = 29.0 + dr
                px_a = int(round(arc_cx + math.cos(ang) * r))
                py_a = int(round(arc_cy + math.sin(ang) * r))
                if 1 <= px_a < W - 1 and 2 <= py_a < H - 2:
                    sp.px(px_a, py_a, col)

        # Incandescent impact gleam fused cleanly inside the leading crescent edge at halberd tip!
        sx_t = max(2, int(tip_x))
        sy_t = int(tip_y)
        for k in range(-1, 7):
            px_s = max(2, sx_t + k)
            sp.px(px_s, sy_t, PURE_WHT if k <= 3 else FLM_WHT)
            sp.px(px_s, sy_t - 1, FLM_WHT if k <= 4 else FLM_YLW)
            sp.px(px_s, sy_t + 1, FLM_YLW if k <= 4 else FLM_ORG)
        # Clean kinetic speed-ember trails flying off the sweeping crescent
        _ember_pair(max(3, sx_t + 7), sy_t - 11, FLM_WHT, FLM_ORG)
        _ember_pair(max(3, sx_t + 12), sy_t + 15, FLM_YLW, FLM_RED)

    elif pose == "hurt":
        # Compact sputtering flames curling tightly off the braced defensive halberd
        _flame_wisp([(sock_x - 6, sock_y - 3), (sock_x - 10, sock_y - 8), (sock_x - 6, sock_y - 13)], True, hot=False)
        _flame_wisp([(tip_x, tip_y + 2), (tip_x + 2, tip_y - 1), (tip_x + 3, tip_y - 4)], False, hot=False)

    else:
        # IDLE / BLINK: Organic sinuous Red Lotus fire curling tightly around halberd blade & spire!
        # (ZERO rake/pitchfork parallel sticks — lets the razor-sharp spear spire dominate the silhouette!)
        ph = 1 if pose == "idle2" else 0
        # 1) Main S-curved flame ribbon wrapping gracefully from furnace heart up around the axe crescent!
        _flame_wisp([
            (sock_x - 3, sock_y + 1),
            (sock_x - 10, sock_y - 2 + ph),
            (sock_x - 12 - ph, sock_y - 9),
            (sock_x - 8, sock_y - 15 - ph),
        ], thick_base=True, hot=False)
        # 2) Inner bright gold-orange flame tongue hugging the lower spear spire curve!
        _flame_wisp([
            (sock_x - 2, sock_y - 5),
            (sock_x - 7 + ph, sock_y - 11),
            (sock_x - 5, sock_y - 17 - ph),
            (sock_x - 8, sock_y - 21),
        ], thick_base=True, hot=True)
        # 3) Lower curling ember-ribbon hugging the golden shaft collar & axe beard (iconic in ref art!)
        _flame_wisp([
            (sock_x - 4, sock_y + 6),
            (sock_x - 10, sock_y + 7 + ph),
            (sock_x - 13, sock_y + 3),
        ], thick_base=True, hot=False)
        # 4) Subtle licking crimson wisp off the right rear fluke
        _flame_wisp([
            (sock_x + 4, sock_y - 3),
            (sock_x + 7, sock_y - 7 - ph),
            (sock_x + 5, sock_y - 11),
        ], thick_base=False, hot=False)
        # 5) Connected 2px ember rising close to the spire tip (NOT a stray far-left dust speck!)
        _ember_pair(int(round(tip_x - 4)), int(round(tip_y + 4 - ph)), FLM_YLW, FLM_ORG)

    return max(2, int(tip_x)), int(tip_y)


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    # (pose, dx, bob, sway, duration_ms)
    ("idle1",   0,   0,   0, 260),
    ("idle2",   0,  -1,   1, 260),
    ("blink",   0,   0,   0, 140),
    ("windup", -1,   1,   1, 190),
    ("strike", -4,   1,   2, 160),
    ("hurt",    3,   1,  -1, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "back_cape",
        "far_arm",
        "legs",
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
        head_y = 3 + bob
        neck_y = head_y + 30
        torso_y = neck_y + 1

        draw_back_cape(sp, cx, neck_y, pose, sway)
        draw_legs_boots(sp, cx, GROUND_Y, pose)
        draw_torso(sp, cx, neck_y, pose)
        draw_head(sp, cx, head_y, pose)
        tip_x, tip_y = draw_arms_and_flaming_halberd(sp, cx, torso_y, pose)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx, head_y + 21)
            anchors["hit_px"] = (cx - 1, torso_y + 10)
        if pose == "strike":
            anchors["cast_px"] = (max(2, tip_x), tip_y)

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
        ("3x Light Winter Sky #DCE7F6 (Red=Foot Anchor, Amber=Cast Anchor)", (220, 231, 246), 0),
        ("3x Dark Slate #222638", (34, 38, 56), fh + 24),
    ]

    ax, ay = PIVOT_X, GROUND_Y
    cast_x, cast_y = anchors["cast_px"]

    for label, bg_rgb, oy in bgs:
        draw.rectangle([0, oy, row_w - 1, oy + fh + 23], fill=bg_rgb)
        draw.text((pad, oy + 4), label, fill=(28, 36, 56) if bg_rgb[0] > 128 else (235, 235, 245))
        for i in range(N_FRAMES):
            ox = pad + i * (fw + pad)
            fy = oy + 20
            draw.line([(ox, fy + ay * scale), (ox + fw - 1, fy + ay * scale)],
                      fill=(185, 198, 218) if bg_rgb[0] > 128 else (65, 72, 98))
            im = sp.composite(i + 1).resize((fw, fh), NEAREST)
            canvas.paste(im, (ox, fy), im)
            rx, ry = ox + ax * scale + scale // 2, fy + ay * scale + scale // 2
            draw.ellipse([rx - 3, ry - 3, rx + 3, ry + 3], fill=(235, 45, 65), outline=(255, 255, 255))
            if i == 4:
                cx_m, cy_m = ox + cast_x * scale + scale // 2, fy + cast_y * scale + scale // 2
                draw.ellipse([cx_m - 3, cy_m - 3, cx_m + 3, cy_m + 3], fill=(255, 185, 45), outline=(80, 20, 10))

    oy3 = (fh + 24) * 2
    draw.rectangle([0, oy3, row_w // 2, total_h - 1], fill=(220, 231, 246))
    draw.rectangle([row_w // 2, oy3, row_w - 1, total_h - 1], fill=(34, 38, 56))
    draw.text((pad, oy3 + 4), "1x Native Scale (Light Sky)", fill=(28, 36, 56))
    draw.text((row_w // 2 + pad, oy3 + 4), "1x Native Scale (Dark Slate)", fill=(235, 235, 245))
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
    x0, y0, x1, y1 = 25, 2, 63, 42
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
        assert max(ys) == GROUND_Y, f"Frame {fi} boot baseline {max(ys)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "eastwing_commander",
        "file": "assets/sprites/eastwing_commander_sheet.png",
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
        "buildScript": "tools/pixel_art/eastwing_commander/build.py",
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
