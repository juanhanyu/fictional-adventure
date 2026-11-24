#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Rowan — Saint-Rank Vampire Guard (rowan).

Act 2 Boss. 100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 76 x 84, 6 horizontal frames (456 x 84 sheet, padding=0).
Facing: left. GROUND_Y = 78, PIVOT_X = 44.

Pass 3 (Final Jewelry Polish):
- Expanded hollow silver Crescent Eclipse Staff (晦轮杖) cavity so clean open sky negative space
  reads clearly inside the crescent ring around the floating pitch-black eclipsed moon orb even
  with selective outlines, plus razor-tapered moon horns & clean 2px clearance from left hair lock!
- Crisp 1px pale upper-eyelid separation between sleek brows and hooded vampire lashes
- Fierce irritated Saint-Rank Boss hurt grimace (angled brows + narrowed glowing vampire glare + gritted jaw)
- Comfortable top safety margin on windup soaring eclipse staff + crisp glowing chest casting rune
- Clean energy-streak separation between thrust Crescent Staff and giant slashing Crescent Wave in strike
- Tapered gothic silver filigree coat-tail diamond tip & moonlit leather luster on tall gothic boots
- Zero isolated pixels across all 6 frames, zero semi-alpha, zero near-duplicate colors, exact GROUND_Y lock!
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
W, H = 76, 84
N_FRAMES = 6
GROUND_Y = 78
PIVOT_X = 44

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "rowan_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "rowan_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 25-Color Hue-Shifted Gothic Vampire JRPG Palette (zero near-dups!)
# ---------------------------------------------------------------------------
VOID_BLK  = "#0a0712"  # Pitch-black eclipsed moon orb, shadow ink, deepest crevices
CLK_SH1   = "#181d34"  # Deep midnight-indigo gothic cloak shadow & gloves
CLK_MID   = "#272d4a"  # Gothic aristocratic cloak, waistcoat & boots base
CLK_HI    = "#3e466b"  # Moonlit cool slate-indigo cloak fold & boot shin highlight

HAIR_SH2  = "#1c1622"  # Deepest dark-espresso hair shadow & warm ink
HAIR_SH1  = "#352838"  # Dark-espresso hair base
HAIR_MID  = "#574458"  # Rich espresso-plum hair midtone
HAIR_HI   = "#846e86"  # Silky crown sheen on tousled espresso hair

BROC_BLU  = "#2e357d"  # Deep nocturnal indigo waistcoat brocade inlay
SASH_WINE = "#4a2334"  # Dark vampire wine-espresso waist sash & lining
SASH_HI   = "#73364f"  # Lit crimson-wine sash fold highlight

PURE_WHT  = "#ffffff"  # Vampire eye catchlight, brightest silver gleam, eclipse flash
SLV_HI    = "#dfe5f5"  # Gleaming moonlit silver crescent, collar rim & filigree
SLV_MID   = "#a3adc7"  # Aristocratic silver chains, buttons & staff scrollwork
SLV_SH1   = "#6c7694"  # Tarnished silver shadow & lit metal selout
SLV_SH2   = "#4d5575"  # Deep steel-silver underside & lit cloak selout

SKIN_HI   = "#faf0ee"  # Moonlit alabaster forehead/cheek highlight
SKIN_MID  = "#e3d0d4"  # Pale aristocratic vampire complexion
SKIN_SH1  = "#bf9faa"  # Soft cool-taupe cheek & bang shadow
SKIN_SH2  = "#99717c"  # Cool rose-plum under-chin shadow & confident smirk
INK_SKIN  = "#6b4c5c"  # Muted rose-plum selective jawline outline

VIO_HI    = "#d4c2ff"  # Eerie pale-violet eclipse corona & lower iris glow
VIO_MID   = "#9b7df0"  # Vivid silver-violet vampire iris & crescent energy
VIO_DARK  = "#5e43b5"  # Deep lunar amethyst upper iris & shadow arc
VIO_DEEP  = "#37216e"  # Dark eclipse shadow aura & mystic outline

PALETTE = [
    VOID_BLK, CLK_SH1, CLK_MID, CLK_HI,
    HAIR_SH2, HAIR_SH1, HAIR_MID, HAIR_HI,
    BROC_BLU, SASH_WINE, SASH_HI,
    PURE_WHT, SLV_HI, SLV_MID, SLV_SH1, SLV_SH2,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, INK_SKIN,
    VIO_HI, VIO_MID, VIO_DARK, VIO_DEEP,
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hspan(sp: Sprite, y: int, x0: int, x1: int, col: str, only=None):
    if x1 < x0:
        x0, x1 = x1, x0
    for x in range(int(x0), int(x1) + 1):
        sp.px(x, int(y), col, only=only)


def fill_rows(sp: Sprite, rows: dict[int, tuple[int, int]], col: str, only=None):
    for y, (x0, x1) in rows.items():
        hspan(sp, y, x0, x1, col, only=only)


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


def draw_connected_arc(
    sp: Sprite,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    ang_start: float,
    ang_end: float,
    col_fn,
    step_deg: float = 4.0,
    thick: bool = False,
):
    """Draw a guaranteed 4-connected elliptical arc using Bresenham segments between sample points."""
    steps = max(2, int(abs(ang_end - ang_start) / step_deg))
    prev = None
    for i in range(steps + 1):
        t = i / steps
        ang = math.radians(ang_start + (ang_end - ang_start) * t)
        px_x = int(round(cx + math.cos(ang) * rx))
        px_y = int(round(cy + math.sin(ang) * ry))
        col = col_fn(t)
        if prev is not None:
            seg = bresenham_pts(prev[0], prev[1], px_x, px_y)
            for idx_s, (sx, sy) in enumerate(seg):
                if 1 <= sx < W - 1 and 1 <= sy < H - 1:
                    sp.px(sx, sy, col)
                    if idx_s > 0:
                        px0, py0 = seg[idx_s - 1]
                        if sx != px0 and sy != py0:
                            sp.px(sx, py0, col)
                    if thick and 1 <= sx + 1 < W - 1:
                        sp.px(sx + 1, sy, col)
        else:
            if 1 <= px_x < W - 1 and 1 <= px_y < H - 1:
                sp.px(px_x, px_y, col)
        prev = (px_x, px_y)


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected material- & light-aware selective outline (top-left key light).
    Preserves crisp hollow sky windows inside the Crescent Eclipse Staff ring!"""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_void = hex2rgba(VOID_BLK)
    rgba_hair_ink = hex2rgba(HAIR_SH2)
    rgba_skin_ink = hex2rgba(INK_SKIN)
    rgba_slv_lit = hex2rgba(SLV_SH1)
    rgba_slv_mid = hex2rgba(SLV_SH2)
    rgba_clk_lit = hex2rgba(CLK_SH1)
    rgba_vio_ink = hex2rgba(VIO_DEEP)

    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3]}
    hair_lit_set = {hex2rgba(HAIR_HI)[:3], hex2rgba(HAIR_MID)[:3]}
    slv_lit_set = {hex2rgba(PURE_WHT)[:3], hex2rgba(SLV_HI)[:3], hex2rgba(SLV_MID)[:3]}
    vio_set = {hex2rgba(VIO_HI)[:3], hex2rgba(VIO_MID)[:3], hex2rgba(VIO_DARK)[:3]}
    clk_lit_set = {hex2rgba(CLK_HI)[:3], hex2rgba(CLK_MID)[:3]}

    staff_cel = sp.frames[frame_idx - 1].cels.get("staff")
    staff_px = staff_cel.load() if staff_cel else None
    body_layers = [ln for ln in sp.layer_order if ln not in ("fx", "outline")]
    body_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in body_layers]

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            nbrs = []
            is_staff = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    if any(bp[nx, ny][3] > 0 for bp in body_pxs):
                        nbrs.append((dx, dy, src[nx, ny][:3]))
                        if staff_px and staff_px[nx, ny][3] > 0:
                            is_staff = True
            if not nbrs:
                continue

            is_top_left = any(dx == 1 or dy == 1 for dx, dy, _ in nbrs) and not any(dy == -1 for _, dy, _ in nbrs)
            rgb_list = [rgb for _, _, rgb in nbrs]

            # Leave glowing violet corona around the floating eclipsed orb un-outlined so the
            # hollow sky gap inside the silver crescent stays luminous, open & crisp!
            if is_staff and all(rgb in vio_set for rgb in rgb_list):
                continue

            if is_staff and is_top_left and any(rgb in slv_lit_set for rgb in rgb_list):
                dst[x, y] = rgba_slv_lit
            elif is_staff and any(rgb in slv_lit_set for rgb in rgb_list):
                dst[x, y] = rgba_slv_mid
            elif is_staff and any(rgb in vio_set for rgb in rgb_list):
                dst[x, y] = rgba_vio_ink
            elif any(rgb in skin_set for rgb in rgb_list) and y < 34:
                dst[x, y] = rgba_skin_ink
            elif is_top_left and any(rgb in slv_lit_set for rgb in rgb_list):
                dst[x, y] = rgba_slv_mid
            elif is_top_left and y < 30 and any(rgb in hair_lit_set for rgb in rgb_list):
                dst[x, y] = rgba_hair_ink
            elif is_top_left and any(rgb in clk_lit_set for rgb in rgb_list):
                dst[x, y] = rgba_clk_lit
            else:
                dst[x, y] = rgba_void


# ---------------------------------------------------------------------------
# Anatomical Layer Painters
# ---------------------------------------------------------------------------

def draw_back_cloak(sp: Sprite, cx: int, neck_y: int, pose: str, sway: int):
    """Iconic high upturned silver-trimmed gothic vampire collar + sweeping split cloak
    leaving negative space between his sleek boots and billowing jagged tattered cloak wings!"""
    sp.layer("back_cloak")

    # 1) HIGH DRAMATIC UPTURNED GOTHIC COLLAR flaring cleanly outside pale jaw!
    collar_pts = [
        (cx - 11, neck_y - 6),
        (cx - 5,  neck_y - 3),
        (cx + 5,  neck_y - 4),
        (cx + 11, neck_y - 7),
        (cx + 10, neck_y + 2),
        (cx - 9,  neck_y + 2),
    ]
    sp.polygon(collar_pts, CLK_SH1, fill=True)
    # Deep velvet shadow interior
    sp.polygon([
        (cx - 8, neck_y - 4),
        (cx + 8, neck_y - 5),
        (cx + 8, neck_y + 2),
        (cx - 7, neck_y + 2),
    ], VOID_BLK, fill=True)
    # Subtle dark burgundy-wine inner collar fold accent
    sp.line(cx - 9, neck_y - 4, cx - 8, neck_y + 1, SASH_WINE)
    sp.line(cx + 9, neck_y - 5, cx + 8, neck_y + 1, SASH_WINE)
    # Razor-crisp tapered gleaming silver outer collar rims (zero blocky corner nubs!)
    sp.line(cx - 11, neck_y - 6, cx - 9, neck_y + 2, SLV_HI)
    sp.line(cx - 10, neck_y - 5, cx - 6, neck_y - 3, SLV_MID)
    sp.line(cx + 11, neck_y - 7, cx + 10, neck_y + 2, SLV_MID)
    sp.line(cx + 10, neck_y - 6, cx + 6, neck_y - 4, SLV_HI)
    sp.px(cx - 11, neck_y - 6, PURE_WHT)
    sp.px(cx + 11, neck_y - 7, PURE_WHT)

    # 2) Sweeping back cloak wings parted cleanly around tall boots!
    top_y = neck_y + 3
    bot_y = GROUND_Y - 4  # y = 74

    if pose == "strike":
        wind_r = 12.0
        wind_l = -1.0
    elif pose == "windup":
        wind_r = 7.5
        wind_l = -2.5
    elif pose == "hurt":
        wind_r = 1.0
        wind_l = -6.5
    else:
        wind_r = 5.5 + sway * 1.4
        wind_l = -2.5 + sway * 0.6

    rows_l = {}
    rows_r = {}
    split_y = GROUND_Y - 17  # y = 61

    for y in range(top_y, bot_y + 1):
        t = (y - top_y) / max(1, bot_y - top_y)
        lx = int(round(cx - 8 - (6.0 + abs(wind_l)) * (t ** 0.90) + math.sin(t * 3.1) * 1.0))
        rx = int(round(cx + 9 + (10.0 + wind_r) * (t ** 0.84) + math.sin(t * 2.6) * 1.2))
        lx = max(2, lx)
        rx = min(W - 3, rx)

        if y < split_y:
            hspan(sp, y, lx, rx, CLK_SH1)
            hspan(sp, y, max(lx + 2, cx - 6), min(rx - 3, cx + 7), VOID_BLK)
            rows_l[y] = (lx, cx - 3)
            rows_r[y] = (cx + 4, rx)
        else:
            st = (y - split_y) / max(1, bot_y - split_y)
            l_in = int(round(cx - 8 - st * 3.6))
            if l_in >= lx + 1:
                hspan(sp, y, lx, l_in, CLK_SH1)
                rows_l[y] = (lx, l_in)
            r_in = int(round(cx + 7 + st * (4.2 + wind_r * 0.28)))
            if rx >= r_in + 1:
                hspan(sp, y, r_in, rx, CLK_SH1)
                rows_r[y] = (r_in, rx)

    # Moonlit cloak folds & gothic silver-thorn filigree along hem
    for y, (lx, l_in) in rows_l.items():
        t = (y - top_y) / max(1, bot_y - top_y)
        if lx + 2 <= l_in:
            hspan(sp, y, lx, lx + 1, CLK_MID)
            if t > 0.22:
                sp.px(lx, y, CLK_HI if t < 0.72 else SLV_SH2)
        if t > 0.56 and lx + 2 <= l_in:
            sp.px(l_in, y, SLV_MID if t > 0.76 else SLV_SH1)

    for y, (r_in, rx) in rows_r.items():
        t = (y - top_y) / max(1, bot_y - top_y)
        if t > 0.54 and r_in + 1 <= rx:
            sp.px(r_in, y, SLV_SH1 if t < 0.75 else SLV_MID)
        fold1 = int(round(cx + 11 + t * (6.2 + wind_r * 0.50)))
        fold2 = int(round(cx + 15 + t * (8.5 + wind_r * 0.72)))
        if r_in + 1 < fold1 < rx - 1:
            hspan(sp, y, fold1 - 1, fold1, CLK_MID)
            if t < 0.80:
                sp.px(fold1 - 1, y, CLK_HI)
        if r_in + 1 < fold2 < rx:
            hspan(sp, y, fold2, min(rx, fold2 + 1), CLK_MID)
        if 0.60 < t < 0.92:
            fil_x = rx - 2 - int(round(math.sin(t * 14.0) * 1.4))
            if r_in + 2 < fil_x < rx:
                sp.px(fil_x, y, SLV_MID if int(t * 18) % 2 == 0 else SLV_SH1)

    # 3) Sculpt razor-tapered jagged gothic cloak tatters!
    if bot_y in rows_l:
        blx, bl_in = rows_l[bot_y]
        for tx, length, dx_dir, lit in [(blx, 4, -1, True), (min(bl_in, blx + 3), 3, -1, False)]:
            for k in range(length):
                ty = bot_y + k
                if ty >= H - 2:
                    break
                w = 2 if k < length - 1 else 1
                px_x = max(2, tx + (dx_dir * k) // 2)
                hspan(sp, ty, px_x, px_x + w - 1, CLK_MID if k < 2 else CLK_SH1)
                if lit and k == 1:
                    sp.px(px_x, ty, SLV_SH1)

    if bot_y in rows_r:
        br_in, brx = rows_r[bot_y]
        for y in range(bot_y - 2, bot_y + 1):
            for x in range(br_in + 1, brx):
                phase = (x - br_in) % 5
                depth = y - (bot_y - 2)
                if (phase == 2 and depth >= 1) or (phase in (1, 3) and depth >= 2):
                    sp.px(x, y, None)

        span_r = max(1, brx - br_in)
        r_tatters = [
            (br_in + 1, 4, 1, False),
            (br_in + span_r // 2, 5, 1, True),
            (brx - 2, 4, 1, True),
        ]
        for tx, length, dx_dir, silver_tip in r_tatters:
            for k in range(length):
                ty = bot_y - 1 + k
                if ty >= H - 2:
                    break
                w = 3 if k == 0 else (2 if k < length - 1 else 1)
                px_x = max(br_in, min(W - 3, tx + (dx_dir * k) // 2))
                hspan(sp, ty, px_x, min(W - 3, px_x + w - 1), CLK_MID if k < 2 else CLK_SH1)
                if silver_tip and k == 1:
                    sp.px(px_x, ty, SLV_MID)


def draw_back_hair(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Sleek short-medium bishounen espresso nape hair stopping cleanly ABOVE the upturned collar!"""
    sp.layer("back_hair")
    shift = -1 if pose == "hurt" else (1 if pose == "strike" else 0)

    for dy, (dl, dr) in [
        (13, (-9, 9)),
        (15, (-10, 10)),
        (17, (-9, 10)),
        (19, (-8, 9)),
        (21, (-6, 8)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_SH2)
        hspan(sp, head_y + dy + 1, cx + dl, cx + dr, HAIR_SH1)

    # Stylish tousled dark-espresso windblown spikes flaring RIGHT (matches rowan_eclipse.png!)
    spikes_r = [
        (cx + 9,  head_y + 13, 4, 0),
        (cx + 10, head_y + 16, 5, 1),
        (cx + 8,  head_y + 20, 4, 1),
    ]
    for sx, sy, slen, dy_d in spikes_r:
        for k in range(slen):
            px_x = sx + k + shift
            px_y = sy + (k * dy_d) // 2
            col = HAIR_MID if k < 2 else (HAIR_SH1 if k < slen - 1 else HAIR_SH2)
            sp.px(px_x, px_y, col)
            if k < slen - 2:
                sp.px(px_x, px_y + 1, HAIR_SH1)

    # Tapered wispy lock on far-left cheek side (with generous clearance from Eclipse Staff!)
    for k in range(3):
        sp.px(cx - 10 - (k // 2) + shift, head_y + 15 + k, HAIR_MID if k == 0 else HAIR_SH1)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Sleek tailored aristocratic dark trousers + tall knee-high black gothic boots with
    moonlit leather shin luster & silver cuffs, locked squarely to GROUND_Y = 78."""
    sp.layer("legs")

    if pose == "strike":
        front_fx, front_fy = cx - 11, ground_y
        back_fx, back_fy = cx + 4, ground_y
        front_top_x = cx - 5
        back_top_x = cx + 2
    elif pose == "windup":
        front_fx, front_fy = cx - 7, ground_y
        back_fx, back_fy = cx + 3, ground_y
        front_top_x = cx - 4
        back_top_x = cx + 2
    elif pose == "hurt":
        front_fx, front_fy = cx - 8, ground_y - 2
        back_fx, back_fy = cx + 3, ground_y
        front_top_x = cx - 4
        back_top_x = cx + 2
    else:
        front_fx, front_fy = cx - 7, ground_y
        back_fx, back_fy = cx + 2, ground_y
        front_top_x = cx - 4
        back_top_x = cx + 2

    hip_y = ground_y - 26  # y = 52

    def _draw_one_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        boot_top_y = foot_y - 13
        pant_hi  = CLK_MID if is_far else CLK_HI
        pant_mid = CLK_SH1 if is_far else CLK_MID
        pant_sh  = VOID_BLK if is_far else CLK_SH1

        boot_hi  = CLK_MID if is_far else CLK_HI
        boot_mid = CLK_SH1 if is_far else CLK_MID
        boot_sh  = VOID_BLK if is_far else CLK_SH1

        span_h = max(1, boot_top_y - hip_y)
        for y in range(hip_y, boot_top_y):
            t = (y - hip_y) / span_h
            lx = int(round(top_x + (foot_x - top_x) * t))
            w = 5 if t < 0.42 else 4
            hspan(sp, y, lx, lx + w - 1, pant_mid)
            sp.px(lx, y, pant_hi)
            sp.px(lx + w - 1, y, pant_sh)
            if y < hip_y + 3:
                hspan(sp, y, lx, lx + w - 1, pant_sh)

        # Tall knee-high gothic boot shaft + silver rim + moonlit leather shin gleam!
        bx = foot_x
        hspan(sp, boot_top_y, bx, bx + 3, SLV_MID if not is_far else SLV_SH1)
        sp.px(bx, boot_top_y, SLV_HI if not is_far else SLV_MID)
        sp.px(bx + 3, boot_top_y, SLV_SH2)

        for y in range(boot_top_y + 1, foot_y - 2):
            hspan(sp, y, bx, bx + 3, boot_mid)
            sp.px(bx, y, boot_hi)
            if not is_far and y in (boot_top_y + 2, boot_top_y + 3, boot_top_y + 4, boot_top_y + 6):
                sp.px(bx + 1, y, SLV_SH2 if y != boot_top_y + 3 else SLV_SH1)
            elif is_far and y in (boot_top_y + 3, boot_top_y + 4):
                sp.px(bx + 1, y, CLK_HI)
            sp.px(bx + 3, y, boot_sh)

        # Sleek pointed aristocratic boot toe facing LEFT with specular toe-cap gleam!
        hspan(sp, foot_y - 2, bx - 1, bx + 3, boot_mid)
        sp.px(bx - 1, foot_y - 2, SLV_SH2 if not is_far else boot_hi)
        sp.px(bx + 3, foot_y - 2, boot_sh)

        hspan(sp, foot_y - 1, bx - 2, bx + 3, boot_mid)
        hspan(sp, foot_y - 1, bx - 1, bx + 1, boot_hi)
        if not is_far:
            sp.px(bx - 1, foot_y - 1, SLV_SH2)
        sp.px(bx + 3, foot_y - 1, boot_sh)

        # Solid boot sole locked squarely at foot_y
        hspan(sp, foot_y, bx - 2, bx + 3, VOID_BLK)
        sp.px(bx, foot_y, boot_sh)

    _draw_one_leg(front_top_x, front_fx, front_fy, is_far=True)
    _draw_one_leg(back_top_x, back_fx, back_fy, is_far=False)

    hspan(sp, hip_y, cx - 4, cx + 4, CLK_SH1)
    hspan(sp, hip_y + 1, cx - 4, cx + 4, VOID_BLK)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """Aristocratic black double-breasted waistcoat, nocturnal indigo brocade peek,
    flowing black cravat with silver throat jewel, 3 silver buttons, wine sash & silver waist chains!"""
    sp.layer("torso")

    for y in range(neck_y - 2, neck_y + 1):
        hspan(sp, y, cx - 2, cx + 1, SKIN_SH1)
        sp.px(cx - 2, y, SKIN_MID)
        sp.px(cx + 1, y, SKIN_SH2)
    hspan(sp, neck_y - 2, cx - 2, cx + 1, SKIN_SH2)

    hspan(sp, neck_y, cx - 3, cx + 3, CLK_SH1)
    sp.px(cx - 2, neck_y, CLK_MID)
    sp.px(cx + 1, neck_y, SLV_HI)

    torso_shape = {
        1:  (-6, 6),
        2:  (-7, 7),
        3:  (-7, 7),
        4:  (-6, 7),
        5:  (-6, 6),
        6:  (-6, 6),
        7:  (-5, 6),
        8:  (-5, 5),
        9:  (-5, 5),
        10: (-5, 5),
        11: (-5, 5),
        12: (-5, 5),
        13: (-5, 5),
        14: (-5, 6),
        15: (-5, 6),
        16: (-5, 6),
        17: (-5, 6),
    }
    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, CLK_SH1)
        hspan(sp, y, cx + dl, cx - 1, CLK_MID)
        if dy <= 13:
            sp.px(cx + dl, y, CLK_HI)
        sp.px(cx + dr, y, VOID_BLK)

    for dy in range(3, 10):
        y = neck_y + dy
        sp.px(cx - 3, y, BROC_BLU if dy % 2 == 0 else CLK_MID)
        sp.px(cx + 1, y, BROC_BLU if dy % 2 == 1 else CLK_SH1)
        sp.px(cx + 2, y, BROC_BLU if dy % 2 == 0 else CLK_SH1)

    for dy in range(7, 15):
        y = neck_y + dy
        sp.px(cx - 3, y, SLV_MID if dy % 2 == 0 else SLV_SH1)
        sp.px(cx + 1, y, SLV_SH1 if dy % 2 == 0 else SLV_SH2)

    # Flowing black silk cravat / jabot down chest
    for dy, (dl, dr) in [
        (2, (-2, 0)),
        (3, (-2, 1)),
        (4, (-3, 1)),
        (5, (-3, 1)),
        (6, (-3, 0)),
        (7, (-3, 0)),
        (8, (-2, 0)),
        (9, (-2, -1)),
    ]:
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, CLK_SH1)
        sp.px(cx + dl, y, CLK_MID)
        if dy in (5, 6, 7):
            sp.px(cx + dl + 1, y, CLK_HI)
        sp.px(cx + dr, y, VOID_BLK)

    # Ornate silver & obsidian throat brooch + collar chain
    by = neck_y + 1
    sp.px(cx - 1, by, SLV_HI)
    sp.px(cx, by, PURE_WHT)
    sp.px(cx - 1, by + 1, VOID_BLK)
    sp.px(cx, by + 1, SLV_MID)
    sp.px(cx - 1, by + 2, SLV_MID)
    sp.px(cx + 1, by + 2, SLV_MID)
    sp.px(cx + 2, by + 3, SLV_SH1)
    sp.px(cx + 3, by + 3, SLV_MID)
    sp.px(cx + 4, by + 2, SLV_HI)

    # 3 gleaming ornate silver waistcoat buttons!
    for btn_dy in (10, 12, 14):
        sp.px(cx - 2, neck_y + btn_dy, SLV_HI)
        sp.px(cx - 1, neck_y + btn_dy, SLV_SH1)

    # Dark crimson-wine waist sash
    sy = neck_y + 15
    hspan(sp, sy, cx - 5, cx + 5, SASH_WINE)
    hspan(sp, sy, cx - 5, cx - 1, SASH_HI)
    hspan(sp, sy + 1, cx - 5, cx + 5, SASH_WINE)
    sp.px(cx - 4, sy + 1, SASH_HI)
    sp.px(cx + 5, sy + 1, VOID_BLK)

    # Draped silver waist chains & central hanging diamond pendant
    cy = neck_y + 17
    for dx_c, dy_c, col_c in [
        (-5, 0, SLV_HI), (-4, 1, SLV_MID), (-3, 1, SLV_HI), (-2, 2, SLV_MID),
        (-1, 2, PURE_WHT), (0, 2, SLV_HI), (1, 1, SLV_MID), (2, 1, SLV_HI),
        (3, 1, SLV_SH1), (4, 0, SLV_MID),
    ]:
        sp.px(cx + dx_c, cy + dy_c, col_c)
    sp.px(cx - 1, cy + 3, SLV_HI)
    sp.px(cx - 1, cy + 4, SLV_MID)
    sp.px(cx - 1, cy + 5, SLV_SH1)
    sp.px(cx, cy + 3, SLV_SH1)


def draw_cloak_front(sp: Sprite, cx: int, neck_y: int, pose: str, sway: int):
    """Open gothic aristocratic cloak front panels with smooth Bresenham silver filigree lapels
    tapering cleanly into ornate Gothic coat-tail points."""
    sp.layer("cloak_front")

    # 1) Far (left) cloak lapel framing left chest & peeling outward-left along left thigh
    left_lapel = [
        (cx - 8, neck_y + 1),
        (cx - 4, neck_y + 2),
        (cx - 5, neck_y + 10),
        (cx - 8, neck_y + 17),
        (cx - 11, neck_y + 29),
        (cx - 14, neck_y + 33),
        (cx - 12, neck_y + 16),
        (cx - 10, neck_y + 5),
    ]
    sp.polygon(left_lapel, CLK_MID, fill=True)
    sp.line(cx - 5, neck_y + 2, cx - 5, neck_y + 9, SLV_HI)
    sp.line(cx - 5, neck_y + 10, cx - 11, neck_y + 28, SLV_MID)
    sp.line(cx - 6, neck_y + 10, cx - 12, neck_y + 28, SLV_SH2)
    sp.line(cx - 10, neck_y + 4, cx - 12, neck_y + 15, CLK_HI)
    sp.px(cx - 5, neck_y + 2, PURE_WHT)
    sp.px(cx - 6, neck_y + 11, SLV_HI)
    sp.polygon([
        (cx - 5, neck_y + 4),
        (cx - 9, neck_y + 7),
        (cx - 6, neck_y + 10),
    ], CLK_SH1, fill=True)
    sp.line(cx - 5, neck_y + 4, cx - 9, neck_y + 7, SLV_HI)
    sp.px(cx - 9, neck_y + 7, PURE_WHT)

    # 2) Near (right) cloak front panel with smooth tapered silver filigree lapel!
    wind = 5 if pose == "strike" else (3 if pose == "windup" else (-2 if pose == "hurt" else sway))
    r_bot_in_x = cx + 8 + wind // 2
    r_bot_out_x = min(W - 4, cx + 17 + wind)

    right_panel = [
        (cx + 4,  neck_y + 2),
        (cx + 10, neck_y + 1),
        (cx + 13, neck_y + 8),
        (min(W - 4, cx + 15 + wind // 2), neck_y + 22),
        (r_bot_out_x, neck_y + 34),
        (r_bot_in_x,  neck_y + 35),
        (cx + 6,  neck_y + 22),
        (cx + 4,  neck_y + 11),
    ]
    sp.polygon(right_panel, CLK_MID, fill=True)

    sp.polygon([
        (cx + 8, neck_y + 6),
        (cx + 12, neck_y + 8),
        (min(W - 5, cx + 14 + wind // 2), neck_y + 25),
        (r_bot_in_x + 2, neck_y + 34),
        (cx + 7, neck_y + 20),
    ], CLK_SH1, fill=True)
    sp.line(cx + 6, neck_y + 5, cx + 8, neck_y + 20, CLK_HI)
    sp.line(cx + 11, neck_y + 5, min(W - 5, cx + 13 + wind // 2), neck_y + 22, CLK_HI)

    # Smooth Bresenham silver filigree inner border tapering cleanly to a gothic diamond point!
    rim_top = bresenham_pts(cx + 4, neck_y + 2, cx + 5, neck_y + 14)
    rim_bot = bresenham_pts(cx + 5, neck_y + 14, r_bot_in_x, neck_y + 34)
    rim_all = rim_top + rim_bot[1:]
    n_rim = len(rim_all)
    for i, (rx_p, ry_p) in enumerate(rim_all):
        if i < n_rim - 3:
            sp.px(rx_p, ry_p, PURE_WHT if i % 6 == 0 else SLV_HI)
            sp.px(rx_p + 1, ry_p, SLV_MID if i % 2 == 0 else SLV_SH1)
            if i % 5 == 2 and i > 4:
                sp.px(rx_p + 2, ry_p, SLV_SH1)
        elif i < n_rim - 1:
            sp.px(rx_p, ry_p, SLV_MID)
            sp.px(rx_p + 1, ry_p, SLV_SH1)
        else:
            # Tapered Gothic silver coat-tail point!
            sp.px(rx_p, ry_p, SLV_SH1)
            sp.px(rx_p, ry_p + 1, SLV_SH2)

    # Flared aristocratic right chest lapel wing
    sp.polygon([
        (cx + 4, neck_y + 3),
        (cx + 9, neck_y + 7),
        (cx + 5, neck_y + 10),
    ], CLK_SH1, fill=True)
    sp.line(cx + 4, neck_y + 3, cx + 9, neck_y + 7, SLV_HI)
    sp.line(cx + 9, neck_y + 7, cx + 5, neck_y + 10, SLV_MID)
    sp.px(cx + 9, neck_y + 7, PURE_WHT)

    # Hanging silver filigree diamond pendant tassel near right thigh
    tx = cx + 8 + wind // 3
    ty = neck_y + 25
    for k in range(4):
        sp.px(tx, ty + k, SLV_MID if k % 2 == 0 else SLV_SH1)
    sp.px(tx - 1, ty + 4, SLV_SH1)
    sp.px(tx, ty + 4, SLV_HI)
    sp.px(tx + 1, ty + 4, SLV_SH1)
    sp.px(tx, ty + 5, CLK_SH1)
    sp.px(tx, ty + 6, CLK_MID)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Handsome dangerous aristocratic vampire head facing LEFT:
    sharp pale alabaster jawline, crisp 1px eyelid separation under sleek brows,
    piercing narrow silver-violet eyes, confident smirk, & asymmetric tousled espresso bangs!"""
    sp.layer("head")

    # 1) Sleek aristocratic pale alabaster 3/4 face facing LEFT
    face_rows = {
        9:  (-7, 6),
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
        23: (-4, 2),
        24: (-3, 0),
    }
    for dy, (dl, dr) in face_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, SKIN_MID)
        if 14 <= dy <= 21:
            hspan(sp, y, cx + dl + 1, cx - 2, SKIN_HI)
        if 14 <= dy <= 23:
            sp.px(cx + dr, y, SKIN_SH1)
            if dy >= 19:
                sp.px(cx + dr - 1, y, SKIN_SH1)
        if dy == 23:
            sp.px(cx + dl, y, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)
        if dy == 24:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    # Subtle pale aristocratic ear peeking on near (right) side
    sp.px(cx + 7, head_y + 15, SKIN_MID)
    sp.px(cx + 8, head_y + 15, SKIN_SH1)
    sp.px(cx + 8, head_y + 16, SKIN_SH1)
    sp.px(cx + 7, head_y + 16, SKIN_SH2)
    sp.px(cx + 7, head_y + 17, SKIN_SH1)

    # Soft cool shadow cast under bangs onto upper forehead
    for x in range(cx - 7, cx + 6):
        sp.px(x, head_y + 11, SKIN_SH1)

    # 2) PIERCING NARROW SILVER-VIOLET VAMPIRE EYES (facing LEFT!)
    ey = head_y + 14
    lx0 = cx - 7  # far eye: 4x4
    rx0 = cx      # near eye: 5x4

    if pose == "blink":
        hspan(sp, ey + 2, lx0, lx0 + 3, VOID_BLK)
        hspan(sp, ey + 3, lx0 + 1, lx0 + 2, SKIN_SH1)
        hspan(sp, ey + 2, rx0, rx0 + 4, VOID_BLK)
        sp.px(rx0 + 5, ey + 1, VOID_BLK)
        hspan(sp, ey + 3, rx0 + 1, rx0 + 3, SKIN_SH1)

    elif pose == "hurt":
        # Fierce irritated Saint-Rank Vampire Boss glare & recoil grimace (sharp downward-inward intensity!)
        sp.px(lx0 - 1, ey + 1, VOID_BLK)
        hspan(sp, ey + 1, lx0, lx0 + 2, VOID_BLK)
        sp.px(lx0 + 3, ey + 2, VOID_BLK)
        sp.px(lx0, ey + 2, PURE_WHT)
        sp.px(lx0 + 1, ey + 2, VIO_HI)
        sp.px(lx0 + 2, ey + 2, VOID_BLK)
        hspan(sp, ey + 3, lx0 + 1, lx0 + 2, SKIN_SH2)

        sp.px(rx0, ey + 2, VOID_BLK)
        hspan(sp, ey + 1, rx0 + 1, rx0 + 4, VOID_BLK)
        sp.px(rx0 + 5, ey, VOID_BLK)
        sp.px(rx0 + 1, ey + 2, VIO_HI)
        sp.px(rx0 + 2, ey + 2, VOID_BLK)
        sp.px(rx0 + 3, ey + 2, VIO_MID)
        sp.px(rx0 + 4, ey + 2, PURE_WHT)
        hspan(sp, ey + 3, rx0 + 1, rx0 + 3, SKIN_SH2)

    else:
        intense = pose in ("windup", "strike")

        # --- FAR EYE (left, 4x4 narrow hooded silver-violet eye) ---
        sp.px(lx0 - 1, ey + 1, VOID_BLK)
        if intense:
            hspan(sp, ey, lx0, lx0 + 2, VOID_BLK)
            sp.px(lx0 + 3, ey + 1, VOID_BLK)
        else:
            hspan(sp, ey, lx0, lx0 + 3, VOID_BLK)

        sp.px(lx0, ey + 1, SLV_HI)
        sp.px(lx0 + 1, ey + 1, PURE_WHT)
        sp.px(lx0 + 2, ey + 1, VIO_DEEP if not intense else VOID_BLK)
        sp.px(lx0 + 3, ey + 1, VIO_DARK)

        sp.px(lx0, ey + 2, PURE_WHT)
        sp.px(lx0 + 1, ey + 2, VIO_MID if not intense else VIO_HI)
        sp.px(lx0 + 2, ey + 2, VOID_BLK)
        sp.px(lx0 + 3, ey + 2, VIO_MID)

        sp.px(lx0, ey + 3, SKIN_MID)
        sp.px(lx0 + 1, ey + 3, VIO_HI if not intense else PURE_WHT)
        sp.px(lx0 + 2, ey + 3, VIO_MID)
        sp.px(lx0 + 3, ey + 3, SKIN_SH1)

        # --- NEAR EYE (right, 5x4 sleek hooded calculating vampire eye!) ---
        if intense:
            sp.px(rx0, ey + 1, VOID_BLK)
            hspan(sp, ey, rx0 + 1, rx0 + 4, VOID_BLK)
        else:
            hspan(sp, ey, rx0, rx0 + 4, VOID_BLK)
        sp.px(rx0 + 5, ey + 1, VOID_BLK)

        sp.px(rx0, ey + 1, VIO_DEEP if not intense else VOID_BLK)
        sp.px(rx0 + 1, ey + 1, PURE_WHT)
        sp.px(rx0 + 2, ey + 1, VIO_DEEP if not intense else VOID_BLK)
        sp.px(rx0 + 3, ey + 1, VIO_DARK)
        sp.px(rx0 + 4, ey + 1, SLV_HI)

        sp.px(rx0, ey + 2, VIO_MID)
        sp.px(rx0 + 1, ey + 2, VIO_MID if not intense else VIO_HI)
        sp.px(rx0 + 2, ey + 2, VOID_BLK)
        sp.px(rx0 + 3, ey + 2, VIO_MID)
        sp.px(rx0 + 4, ey + 2, PURE_WHT)

        sp.px(rx0, ey + 3, SKIN_SH1)
        sp.px(rx0 + 1, ey + 3, VIO_HI)
        sp.px(rx0 + 2, ey + 3, PURE_WHT if intense else VIO_HI)
        sp.px(rx0 + 3, ey + 3, VIO_MID)
        sp.px(rx0 + 4, ey + 3, SKIN_MID)

    # Subtle aristocratic nose bridge dot
    sp.px(cx - 3, ey + 4, SKIN_SH1)

    # 3) CONFIDENT ARISTOCRATIC VAMPIRE SMIRK / BATTLE EXPRESSIONS
    my = head_y + 21
    mx = cx - 2
    if pose == "strike":
        sp.px(mx - 2, my, SKIN_SH2)
        sp.px(mx - 1, my, INK_SKIN)
        sp.px(mx, my, INK_SKIN)
        sp.px(mx + 1, my - 1, INK_SKIN)
        sp.px(mx + 2, my - 2, SKIN_SH2)
    elif pose == "hurt":
        # Fierce gritted boss jaw (tense horizontal clench, NOT a sad pout!)
        sp.px(mx - 2, my, SKIN_SH2)
        sp.px(mx - 1, my, INK_SKIN)
        sp.px(mx, my, VOID_BLK)
        sp.px(mx + 1, my, INK_SKIN)
        sp.px(mx + 2, my, SKIN_SH2)
    elif pose == "windup":
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx, my, INK_SKIN)
        sp.px(mx + 1, my - 1, INK_SKIN)
        sp.px(mx + 2, my - 1, SKIN_SH2)
    else:
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx, my, SKIN_SH2)
        sp.px(mx + 1, my - 1, INK_SKIN)

    # 4) ASYMMETRIC DIAGONALLY-SWEPT DARK-ESPRESSO HAIR CROWN & SHARP FEATHERY V-BANGS!
    crown_rows = {
        1:  (-2, 4),
        2:  (-5, 7),
        3:  (-7, 9),
        4:  (-9, 10),
        5:  (-10, 10),
        6:  (-11, 11),
        7:  (-11, 11),
        8:  (-11, 11),
        9:  (-11, 11),
        10: (-11, 10),
        11: (-10, 10),
    }
    for dy, (dl, dr) in crown_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, HAIR_SH1)
        if 2 <= dy <= 6:
            hi_l = cx + max(dl + 1, -8)
            hi_r = cx + min(dr - 2, 5)
            if hi_r >= hi_l:
                hspan(sp, y, hi_l, hi_r, HAIR_MID)
        if dr >= 8:
            hspan(sp, y, cx + dr - 2, cx + dr, HAIR_SH2)

    # Curved broken diagonal anime hair crown highlight flowing from top-right part down-left!
    for hx_o, hy_o, col_h in [
        (-7, 5, HAIR_HI), (-6, 5, HAIR_HI), (-5, 5, HAIR_MID),
        (-8, 6, HAIR_HI), (-7, 6, HAIR_MID), (-4, 4, HAIR_HI), (-3, 4, HAIR_HI),
        (-2, 4, HAIR_HI), (-1, 5, HAIR_HI), (0, 5, HAIR_MID),
        (2, 4, HAIR_HI), (3, 4, HAIR_HI), (4, 5, HAIR_HI), (5, 5, HAIR_HI),
        (6, 6, HAIR_HI), (7, 6, HAIR_MID), (7, 7, HAIR_MID),
    ]:
        sp.px(cx + hx_o, head_y + hy_o, col_h)

    # Dynamic windswept tousled cowlicks & stray crown locks
    sp.px(cx - 2, head_y + 0, HAIR_MID)
    sp.px(cx - 1, head_y + 0, HAIR_HI)
    sp.px(cx,     head_y + 0, HAIR_SH1)
    sp.px(cx + 4, head_y + 1, HAIR_HI)
    sp.px(cx + 5, head_y + 1, HAIR_MID)
    sp.px(cx + 8, head_y + 3, HAIR_MID)
    w_s = -1 if pose == "hurt" else 0
    sp.px(cx - 12 + w_s, head_y + 8, HAIR_MID)
    sp.px(cx - 12 + w_s, head_y + 9, HAIR_SH1)

    # Off-center crown hair part
    for dy in (2, 3, 4):
        sp.px(cx + 1, head_y + dy, HAIR_SH2)

    # Broken diagonal espresso strand grooves below highlight arc
    for (sx, sy0, sy1, dx_step) in [
        (cx - 6, 7, 10, -0.35),
        (cx - 2, 6, 11, -0.25),
        (cx + 3, 7, 10,  0.25),
        (cx + 7, 7, 11,  0.25),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, HAIR_SH2)

    # Airy pale forehead breathing windows directly above both eyes so brows & lids read ultra-crisp!
    for x in (cx - 6, cx - 5, cx + 1, cx + 2, cx + 3, cx + 4):
        sp.px(x, head_y + 11, SKIN_MID)
    for x in (cx - 6, cx - 5, cx + 2, cx + 3):
        sp.px(x, head_y + 10, SKIN_SH1)

    # Signature diagonal feathery V-tapered bangs
    for dy, (dl, dr) in [
        (10, (-4, 0)), (11, (-4, -1)), (12, (-4, -1)),
        (13, (-3, -1)), (14, (-3, -2)), (15, (-3, -2)), (16, (-2, -2)), (17, (-2, -2)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_SH1 if dy < 16 else HAIR_SH2)
        if dy <= 14:
            sp.px(cx + dl, head_y + dy, HAIR_MID)

    for dy, (dl, dr) in [
        (10, (-10, -7)), (11, (-10, -8)), (12, (-10, -8)),
        (13, (-10, -8)), (14, (-10, -9)), (15, (-10, -9)), (16, (-9, -9)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_SH1 if dy < 15 else HAIR_SH2)
        if dy <= 13:
            sp.px(cx + dl, head_y + dy, HAIR_MID)

    sp.px(cx + 0, head_y + 11, HAIR_MID)
    sp.px(cx + 0, head_y + 12, HAIR_SH1)
    sp.px(cx + 0, head_y + 13, HAIR_SH2)

    for dy, (dl, dr) in [
        (10, (5, 10)), (11, (5, 10)), (12, (6, 10)), (13, (6, 10)),
        (14, (6, 9)), (15, (6, 6)), (16, (6, 6)), (17, (5, 6)), (18, (5, 5)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_SH1)
        if dy <= 13:
            sp.px(cx + dl, head_y + dy, HAIR_MID)
        sp.px(cx + dr, head_y + dy, HAIR_SH2)
    for dy, (dl, dr) in [(13, (9, 11)), (14, (9, 11)), (15, (9, 11)), (16, (9, 10)), (17, (9, 9))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_SH1 if dy < 16 else HAIR_SH2)
        if dy <= 15:
            sp.px(cx + dl, head_y + dy, HAIR_MID)

    # 5) SLEEK ARISTOCRATIC EYEBROWS WITH CRISP 1PX UPPER EYELID SEPARATION!
    brow_y = ey - 2
    if pose in ("windup", "strike"):
        # Fierce imperious angled brows with clean pale lid space underneath!
        sp.px(lx0, brow_y, HAIR_SH2)
        sp.px(lx0 + 1, brow_y, VOID_BLK)
        sp.px(lx0 + 2, brow_y + 1, VOID_BLK)
        sp.px(rx0 + 1, brow_y + 1, VOID_BLK)
        sp.px(rx0 + 2, brow_y, VOID_BLK)
        sp.px(rx0 + 3, brow_y, HAIR_SH2)
    elif pose == "hurt":
        # Fierce furrowed boss scowl angled sharply downward inward!
        sp.px(lx0, brow_y, HAIR_SH2)
        sp.px(lx0 + 1, brow_y, VOID_BLK)
        sp.px(lx0 + 2, brow_y + 1, VOID_BLK)
        sp.px(rx0 + 1, brow_y + 1, VOID_BLK)
        sp.px(rx0 + 2, brow_y, VOID_BLK)
        sp.px(rx0 + 3, brow_y, HAIR_SH2)
    else:
        # Cool aristocratic brows hovering cleanly 1px above hooded upper lashes!
        hspan(sp, brow_y, lx0, lx0 + 2, HAIR_SH2)
        hspan(sp, brow_y, rx0 + 1, rx0 + 4, HAIR_SH2)


def draw_eclipse_crescent_head(
    sp: Sprite,
    ox: int,
    oy: int,
    pose: str,
    sway: int,
    angle_deg: float = 0.0,
):
    """Draw the ICONIC HOLLOW Crescent Eclipse Staff Head (晦轮杖)!
    - Generous HOLLOW silver crescent ring (`r_outer = 9.9`, `r_inner = 7.2`) with true open
      transparent negative space windows inside around the floating pitch-black eclipsed moon orb!
    - Razor-tapered open lunar horns curving gracefully to the left!
    - Luminous pale-violet eclipse corona hugging tightly around the obsidian moon orb!
    - Crisp tiny inner silver crescent + slender horizontal spoke + tall Gothic spire!
    """
    sp.layer("staff")

    rad = math.radians(angle_deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)

    def rot(lx: float, ly: float) -> tuple[int, int]:
        rx = ox + lx * cos_a - ly * sin_a
        ry = oy + lx * sin_a + ly * cos_a
        return int(round(rx)), int(round(ry))

    # Floating pitch-black eclipsed moon orb nestled cleanly inside the crescent!
    orb_x, orb_y = rot(-1.9, 0.0)

    # 1) Tight eerie pale-violet eclipse corona hugging ONLY the black orb's rim (r = 3.0..3.95)
    # Guarantees a crystal-clear 2-3px transparent hollow sky window inside the silver crescent!
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            d = math.hypot(dx, dy)
            px_x, px_y = orb_x + dx, orb_y + dy
            if not (1 <= px_x < W - 1 and 1 <= px_y < H - 1):
                continue
            if 2.9 <= d <= 3.95:
                if d <= 3.45:
                    col = PURE_WHT if (pose in ("windup", "strike") and dx <= 0) else VIO_HI
                else:
                    col = VIO_MID if (pose in ("windup", "strike") or sway != 0) else VIO_DARK
                sp.px(px_x, px_y, col)

    # 2) Pitch-black eclipsed moon orb (radius 3, pure obsidian VOID_BLK!)
    sp.circle(orb_x, orb_y, 3, VOID_BLK, fill=True)
    sp.px(orb_x + 1, orb_y - 2, VIO_DEEP)
    sp.px(orb_x + 2, orb_y - 1, VIO_DEEP)

    # 3) Tiny crisp inner silver crescent cradling the lower-left edge of the black orb!
    draw_connected_arc(
        sp, orb_x, orb_y, 3.5, 3.5,
        122 + angle_deg, 242 + angle_deg,
        lambda t: PURE_WHT if 0.25 <= t <= 0.75 else SLV_HI,
        step_deg=8.0,
    )

    # 4) MASSIVE HOLLOW ORNATE SILVER CRESCENT RING WITH RAZOR LUNAR HORNS!
    for dy in range(-11, 12):
        for dx in range(-11, 12):
            lx = dx * cos_a + dy * sin_a
            ly = -dx * sin_a + dy * cos_a
            d_outer = math.hypot(lx, ly)
            # Inner hollow cavity shifted LEFT (-2.3, 0) -> lush ornate crescent on right,
            # tapering into delicate curved lunar horns on upper-left & lower-left!
            d_inner = math.hypot(lx + 2.3, ly)

            px_x, px_y = ox + dx, oy + dy
            if not (1 <= px_x < W - 1 and 1 <= px_y < H - 1):
                continue

            if d_outer <= 9.8 and d_inner >= 7.1:
                ang_loc = math.degrees(math.atan2(ly, lx))
                if abs(ang_loc) > 146:
                    continue
                if abs(ang_loc) > 136:
                    # Razor-sharp gleaming moon horn tips!
                    col = PURE_WHT if ly < 0 else SLV_HI
                elif d_outer >= 8.9:
                    col = SLV_HI if (ly < 2 or lx < 2) else SLV_SH1
                elif d_inner <= 7.9:
                    col = PURE_WHT if ly < 1 else SLV_HI
                else:
                    col = SLV_MID if ((int(round(lx)) + int(round(ly))) % 2 == 0) else SLV_HI
                if ly > 6 and lx > 1:
                    col = SLV_SH1 if d_outer > 8.7 else SLV_MID
                sp.px(px_x, px_y, col)

    # 5) Slender Gothic Crossbar & Cardinal Finial Spires (cleanly preserving hollow sky cutouts!)
    # Single sleek 1px silver spoke anchoring orb horizontally to right crescent spine
    p0 = rot(2.6, 0)
    p1 = rot(7.9, 0)
    sp.line(p0[0], p0[1], p1[0], p1[1], SLV_HI)

    # Slender silver filament anchoring orb down to staff throat
    q0 = rot(-1.2, 3.8)
    q1 = rot(0.0, 8.8)
    sp.line(q0[0], q0[1], q1[0], q1[1], SLV_MID)

    # Tall iconic Gothic top spire!
    for k in range(0, 5):
        tx, ty = rot(0, -10 - k)
        if 1 <= tx < W - 1 and 1 <= ty < H - 1:
            sp.px(tx, ty, PURE_WHT if k >= 3 else SLV_HI)
            if k < 2:
                tx2, ty2 = rot(1, -10 - k)
                tx3, ty3 = rot(-1, -10 - k)
                sp.px(tx2, ty2, SLV_MID)
                sp.px(tx3, ty3, SLV_HI)

    # Crisp compact 2px right gothic diamond finial (guarantees clean 2px sky gap before Rowan's hair!)
    for k in range(0, 2):
        rx, ry = rot(10 + k, 0)
        if 1 <= rx < W - 1 and 1 <= ry < H - 1:
            sp.px(rx, ry, PURE_WHT if k == 1 else SLV_HI)
    r2x, r2y = rot(10, -1)
    r3x, r3y = rot(10, 1)
    sp.px(r2x, r2y, SLV_HI)
    sp.px(r3x, r3y, SLV_SH1)

    # Bottom gothic collar mount joining crescent to staff shaft
    for k in range(0, 3):
        bx, by = rot(0, 10 + k)
        if 1 <= bx < W - 1 and 1 <= by < H - 1:
            sp.px(bx, by, SLV_HI if k < 2 else SLV_MID)
            if k < 2:
                bx_l, by_l = rot(-1, 10 + k)
                bx_r, by_r = rot(1, 10 + k)
                sp.px(bx_l, by_l, SLV_MID)
                sp.px(bx_r, by_r, SLV_SH1)


def draw_arms_and_staff(sp: Sprite, cx: int, torso_y: int, pose: str, sway: int):
    """Draw Rowan's arms, black gloves, ornate silver shoulder crest, hollow Crescent Eclipse Staff,
    and 100% 4-connected eclipse magic VFX!"""
    if pose == "windup":
        # Staff raised HIGH aloft with comfortable top margin & pulsing dark-violet eclipse ribbons!
        hx, hy = cx - 21, torso_y + 5
        head_cx, head_cy = cx - 27, 15           # y = 15 -> top spire at y=2, aura at y=3!
        bot_x, bot_y = cx - 15, 67
        staff_angle = -13.0
        far_el_x, far_el_y = cx - 13, torso_y + 9
        near_el_x, near_el_y = cx + 11, torso_y + 10
        near_hx, near_hy = cx + 4, torso_y + 9
    elif pose == "strike":
        # Fierce dynamic lunge LEFT thrusting the Eclipse Staff with crisp separation from Crescent Wave!
        hx, hy = cx - 10, torso_y + 10
        head_cx, head_cy = cx - 18, torso_y + 7  # x = 23, y = 42 -> clean 3px energy channel before slash wave!
        bot_x, bot_y = cx + 4, torso_y + 19
        staff_angle = -64.0
        far_el_x, far_el_y = cx - 6, torso_y + 7
        near_el_x, near_el_y = cx + 11, torso_y + 11
        near_hx, near_hy = cx + 10, torso_y + 17
    elif pose == "hurt":
        # Recoil defensive stance — staff pulled back-up diagonally, near hand guarding chest!
        hx, hy = cx - 19, torso_y + 12
        head_cx, head_cy = cx - 26, 21
        bot_x, bot_y = cx - 13, 71
        staff_angle = -18.0
        far_el_x, far_el_y = cx - 12, torso_y + 10
        near_el_x, near_el_y = cx + 11, torso_y + 10
        near_hx, near_hy = cx + 4, torso_y + 6
    else:
        # Poised aristocratic Vampire Boss stance with crisp 2px open sky channel between staff & hair!
        bob_h = -1 if pose == "idle2" else 0
        hx, hy = cx - 21, torso_y + 14 + bob_h
        head_cx, head_cy = cx - 26, 20 + bob_h   # x = 18, y = 20 -> right finial at x=29, hair at x=32!
        bot_x, bot_y = cx - 15, 75 + bob_h
        staff_angle = -10.0
        far_el_x, far_el_y = cx - 14, torso_y + 11 + bob_h
        near_el_x, near_el_y = cx + 11, torso_y + 12 + bob_h
        near_hx, near_hy = cx + 10, torso_y + 19 + bob_h

    # ------------------------------------------------------------------
    # 1) Far (Right) Arm extending to staff grip (layer: far_arm)
    # ------------------------------------------------------------------
    sp.layer("far_arm")
    sh_x, sh_y = cx - 8, torso_y + 2
    sp.polygon([
        (sh_x - 2, sh_y),
        (sh_x + 2, sh_y + 1),
        (far_el_x + 2, far_el_y + 2),
        (far_el_x - 2, far_el_y + 1),
    ], CLK_MID, fill=True)
    sp.line(sh_x - 2, sh_y, far_el_x - 2, far_el_y, CLK_HI)
    sp.line(sh_x + 1, sh_y + 2, far_el_x + 1, far_el_y + 2, CLK_SH1)

    sp.polygon([
        (far_el_x - 2, far_el_y),
        (far_el_x + 2, far_el_y + 2),
        (hx + 2, hy + 1),
        (hx - 1, hy - 1),
    ], CLK_MID, fill=True)
    sp.line(far_el_x - 2, far_el_y, hx - 1, hy - 1, CLK_HI)
    cuff_x = int(round((far_el_x + hx * 2) / 3))
    cuff_y = int(round((far_el_y + hy * 2) / 3))
    sp.px(cuff_x, cuff_y - 1, SLV_HI)
    sp.px(cuff_x + 1, cuff_y, SLV_MID)
    sp.px(cuff_x + 1, cuff_y + 1, SLV_SH1)

    # ------------------------------------------------------------------
    # 2) CRESCENT ECLIPSE STAFF (晦轮杖) Shaft, Gothic Collar & Hollow Head
    # ------------------------------------------------------------------
    sp.layer("staff")

    sdx = bot_x - head_cx
    sdy = bot_y - head_cy
    slen = max(1.0, math.hypot(sdx, sdy))
    ux, uy = sdx / slen, sdy / slen
    px_o, py_o = (-1, 0) if abs(sdy) >= abs(sdx) else (0, -1)

    neck_sx = int(round(head_cx + ux * 10.2))
    neck_sy = int(round(head_cy + uy * 10.2))

    shaft_pts = bresenham_pts(neck_sx, neck_sy, bot_x, bot_y)
    n_s = max(1, len(shaft_pts) - 1)
    for i, (sx, sy) in enumerate(shaft_pts):
        t = i / n_s
        if t < 0.24:
            sp.px(sx, sy, SLV_MID)
            sp.px(sx + px_o, sy + py_o, SLV_HI if i % 2 == 0 else PURE_WHT)
            sp.px(sx - px_o, sy - py_o, SLV_SH1)
        elif t > 0.88:
            sp.px(sx, sy, SLV_HI if t > 0.94 else SLV_MID)
            if t < 0.95:
                sp.px(sx + px_o, sy + py_o, SLV_HI)
        else:
            sp.px(sx, sy, CLK_SH1)
            sp.px(sx + px_o, sy + py_o, SLV_SH2 if (i % 5 == 0) else CLK_MID)

    # Ornate Gothic thorn-flares on the staff neck collar
    if len(shaft_pts) > 8:
        tx_m, ty_m = shaft_pts[4]
        sp.px(tx_m + px_o * 2, ty_m + py_o * 2, SLV_HI)
        sp.px(tx_m + px_o * 3, ty_m + py_o * 3 - 1, PURE_WHT)
        sp.px(tx_m - px_o * 2, ty_m - py_o * 2, SLV_MID)
        sp.px(tx_m - px_o * 3, ty_m - py_o * 3 + 1, SLV_SH1)

    # Hollow iconic Crescent Eclipse Head!
    draw_eclipse_crescent_head(sp, head_cx, head_cy, pose, sway, angle_deg=staff_angle)

    # Black gloved right hand wrapping solidly OVER staff shaft
    sp.layer("staff_hand")
    sp.rect(hx - 1, hy - 1, hx + 2, hy + 2, CLK_SH1)
    sp.px(hx - 1, hy - 1, CLK_HI)
    sp.px(hx, hy - 1, CLK_MID)
    sp.px(hx - 1, hy, CLK_MID)
    sp.px(hx + 2, hy + 2, VOID_BLK)
    sp.px(hx, hy, SLV_SH1)

    # ------------------------------------------------------------------
    # 3) Near (Left) Cloaked Shoulder + Ornate Silver Crest + Tassel + Hand
    # ------------------------------------------------------------------
    sp.layer("near_arm")
    nsh_x, nsh_y = cx + 9, torso_y + 2
    sp.polygon([
        (nsh_x - 3, nsh_y - 1),
        (nsh_x + 3, nsh_y + 1),
        (near_el_x + 3, near_el_y + 2),
        (near_el_x - 3, near_el_y + 2),
        (nsh_x - 4, nsh_y + 6),
    ], CLK_MID, fill=True)
    sp.line(nsh_x - 2, nsh_y, near_el_x - 2, near_el_y + 1, CLK_HI)
    sp.line(nsh_x + 2, nsh_y + 2, near_el_x + 2, near_el_y + 2, CLK_SH1)

    # Ornate silver filigree gothic shoulder crest + draped chain + long black tassel!
    cr_x, cr_y = nsh_x + 1, nsh_y + 4
    sp.px(cr_x, cr_y - 2, PURE_WHT)
    sp.px(cr_x - 1, cr_y - 1, SLV_HI)
    sp.px(cr_x, cr_y - 1, SLV_MID)
    sp.px(cr_x + 1, cr_y - 1, SLV_HI)
    sp.px(cr_x - 1, cr_y, SLV_MID)
    sp.px(cr_x, cr_y, CLK_SH1)
    sp.px(cr_x + 1, cr_y, SLV_MID)
    sp.px(cr_x - 1, cr_y + 1, SLV_SH1)
    sp.px(cr_x, cr_y + 1, SLV_HI)
    sp.px(cr_x + 1, cr_y + 1, SLV_SH1)
    sp.px(cr_x, cr_y + 2, SLV_MID)
    sp.px(cr_x - 2, cr_y + 2, SLV_MID)
    sp.px(cr_x - 3, cr_y + 2, SLV_SH1)
    sp.px(cr_x - 4, cr_y + 1, SLV_MID)
    for k in range(3, 8):
        sp.px(cr_x + 1, cr_y + k, SLV_MID if k % 2 == 1 else SLV_SH1)
    sp.px(cr_x + 1, cr_y + 8, SLV_HI)
    sp.px(cr_x + 1, cr_y + 9, CLK_SH1)
    sp.px(cr_x + 1, cr_y + 10, CLK_MID)
    sp.px(cr_x + 2, cr_y + 10, CLK_SH1)

    if pose in ("windup", "hurt"):
        sp.line(near_el_x, near_el_y + 1, near_hx, near_hy, CLK_MID)
        sp.line(near_el_x - 1, near_el_y + 1, near_hx - 1, near_hy, CLK_HI)
        sp.line(near_el_x + 1, near_el_y + 2, near_hx + 1, near_hy, CLK_SH1)
        sp.rect(near_hx - 1, near_hy - 1, near_hx + 1, near_hy + 1, CLK_SH1)
        sp.px(near_hx - 1, near_hy - 1, CLK_HI)
        sp.px(near_hx, near_hy, SLV_SH1)
    else:
        sp.rect(near_hx - 1, near_hy - 1, near_hx + 1, near_hy + 1, CLK_SH1)
        sp.px(near_hx - 1, near_hy - 1, CLK_MID)

    # ------------------------------------------------------------------
    # 4) ICONIC 4-CONNECTED ECLIPSE MAGIC VFX (layer: fx — ZERO isolated px!)
    # ------------------------------------------------------------------
    sp.layer("fx")
    cast_x, cast_y = head_cx, head_cy

    if pose == "idle2":
        wx, wy = head_cx - 11, head_cy - 5
        sp.px(wx, wy, VIO_HI)
        sp.px(wx + 1, wy, VIO_MID)
        sp.px(wx, wy + 1, VIO_DARK)
        wx2, wy2 = head_cx - 10, head_cy + 7
        sp.px(wx2, wy2, VIO_MID)
        sp.px(wx2 + 1, wy2, VIO_DARK)

    elif pose == "windup":
        # Swirling ink-violet & pale-silver eclipse ribbons orbiting OUTSIDE the crescent
        # (comfortable 2-3px safety margin from top/left borders; black orb 100% unobstructed!)
        draw_connected_arc(
            sp, head_cx, head_cy, 12.6, 12.0, -162, -48,
            lambda t: PURE_WHT if 0.36 < t < 0.60 else (VIO_HI if 0.15 < t < 0.85 else VIO_MID),
            step_deg=5.0,
        )
        draw_connected_arc(
            sp, head_cx, head_cy, 11.6, 11.1, -148, -62,
            lambda t: VIO_DARK if 0.2 < t < 0.8 else VOID_BLK,
            step_deg=6.0,
        )
        draw_connected_arc(
            sp, head_cx, head_cy, 12.4, 11.8, 48, 162,
            lambda t: VIO_HI if 0.25 < t < 0.72 else VIO_MID,
            step_deg=5.0,
        )
        draw_connected_arc(
            sp, head_cx, head_cy, 11.4, 10.8, 66, 152,
            lambda t: VOID_BLK if 0.2 < t < 0.75 else VIO_DEEP,
            step_deg=6.0,
        )
        # Crisp luminous violet eclipse diamond rune in Rowan's raised near casting hand!
        rx_r, ry_r = near_hx - 2, near_hy - 1
        sp.px(rx_r, ry_r, PURE_WHT)
        sp.px(rx_r - 1, ry_r, VIO_HI)
        sp.px(rx_r + 1, ry_r, VIO_HI)
        sp.px(rx_r, ry_r - 1, VIO_HI)
        sp.px(rx_r, ry_r + 1, VIO_HI)
        sp.px(rx_r - 2, ry_r, VIO_MID)
        sp.px(rx_r, ry_r - 2, VIO_MID)
        sp.px(rx_r, ry_r + 2, VIO_MID)

    elif pose == "strike":
        # DRAMATIC RAZOR-SHARP SHADOW-SILVER & PALE-VIOLET CRESCENT ENERGY WAVE slashing LEFT!
        # Separated cleanly ahead of the thrust Crescent Eclipse Staff (`head_cx = 23`)!
        arc_cx = 13
        arc_cy = head_cy
        cast_x = 3
        cast_y = arc_cy

        draw_connected_arc(
            sp, arc_cx, arc_cy, 10.6, 14.5, 114, 246,
            lambda t: PURE_WHT if 0.28 <= t <= 0.72 else SLV_HI,
            step_deg=3.0,
        )
        draw_connected_arc(
            sp, arc_cx, arc_cy, 9.6, 13.4, 118, 242,
            lambda t: PURE_WHT if 0.36 <= t <= 0.64 else VIO_HI,
            step_deg=3.0,
        )
        draw_connected_arc(
            sp, arc_cx, arc_cy, 8.6, 12.2, 124, 236,
            lambda t: VIO_HI if 0.30 <= t <= 0.70 else VIO_MID,
            step_deg=3.0,
        )
        draw_connected_arc(
            sp, arc_cx, arc_cy, 7.6, 10.8, 132, 228,
            lambda t: VIO_DARK,
            step_deg=4.0,
        )
        draw_connected_arc(
            sp, arc_cx, arc_cy, 6.6, 9.2, 142, 218,
            lambda t: VOID_BLK if 0.30 <= t <= 0.70 else VIO_DEEP,
            step_deg=4.0,
        )

        # Blazing eclipse cast flash cross right at leading center tip (cast_x, cast_y)
        for k in range(-2, 5):
            px_s = max(1, cast_x + k)
            sp.px(px_s, cast_y, PURE_WHT if -1 <= k <= 2 else VIO_HI)
        for k in range(-2, 3):
            sp.px(cast_x, cast_y + k, PURE_WHT if abs(k) <= 1 else VIO_HI)

        # Crisp luminous horizontal eclipse streaks bridging staff thrust to crescent shockwave!
        hspan(sp, head_cy - 6, 8, 14, VIO_MID)
        sp.px(8, head_cy - 6, VIO_HI)
        sp.px(9, head_cy - 6, PURE_WHT)
        hspan(sp, head_cy, 9, 13, VIO_HI)
        hspan(sp, head_cy + 6, 8, 14, VIO_DARK)
        sp.px(8, head_cy + 6, VIO_MID)

    return cast_x, cast_y


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    # (pose, dx, bob, sway, dur_ms)
    ("idle1",   0,   0,    0, 260),
    ("idle2",   0,  -1,    1, 260),
    ("blink",   0,   0,    0, 140),
    ("windup",  2,   0,    1, 180),
    ("strike", -3,   1,    2, 160),
    ("hurt",    3,   1,   -2, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "back_cloak",
        "back_hair",
        "legs",
        "torso",
        "cloak_front",
        "head",
        "far_arm",
        "staff",
        "staff_hand",
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
        head_y = 6 + bob
        neck_y = head_y + 27   # y = 33
        torso_y = neck_y + 1   # y = 34

        draw_back_cloak(sp, cx, neck_y, pose, sway)
        draw_back_hair(sp, cx, head_y, pose, sway)
        draw_legs_boots(sp, cx, GROUND_Y, pose)
        draw_torso(sp, cx, neck_y, pose)
        draw_cloak_front(sp, cx, neck_y, pose, sway)
        draw_head(sp, cx, head_y, pose, sway)
        cast_x, cast_y = draw_arms_and_staff(sp, cx, torso_y, pose, sway)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx - 1, head_y + 15)
            anchors["hit_px"] = (cx - 1, torso_y + 11)
        if pose == "strike":
            anchors["cast_px"] = (cast_x, cast_y)

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
        ("3x Light Sky #DCE7F6 (Red=Foot Anchor, Violet=Cast Anchor)", (220, 231, 246), 0),
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
                draw.ellipse([cx_m - 3, cy_m - 3, cx_m + 3, cy_m + 3], fill=(175, 110, 255), outline=(255, 255, 255))

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
    x0, y0, x1, y1 = 22, 3, 62, 41
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

    assert info["semi_alpha_px"] == 0, f"Expected 0 semi-alpha px, got {info['semi_alpha_px']}"
    assert not info["near_duplicate_colors"], f"Unexpected near-dup colors: {info['near_duplicate_colors']}"
    iso_errors = {}
    for fi in range(1, N_FRAMES + 1):
        sp.frame(fi)
        st = sp.stats(print_=False)
        if st["isolated_px"]:
            iso_errors[fi] = st["isolated_px"]

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
        "id": "rowan",
        "file": "assets/sprites/rowan_sheet.png",
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
        "buildScript": "tools/pixel_art/rowan/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=5)
    render_face_zoom(sp, FACE_ZOOM_PATH, scale=12)

    assert not iso_errors, f"Isolated px found: {iso_errors}"


if __name__ == "__main__":
    main()
