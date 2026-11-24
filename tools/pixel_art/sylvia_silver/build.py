#!/usr/bin/env python3
"""Flagship HD anime pixel-art combat sprite builder for Sylvia Vesteria (sylvia_silver).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 72 x 80, 6 horizontal frames (432 x 80 sheet, padding=0).
Facing: right. GROUND_Y = 74, PIVOT_X = 33.

Pass 3 (Final Jewelry Polish):
- Refined upper-lash outer corners & bright sclera openings on both sapphire anime eyes
- Clean 2px soft horizontal cheek blush & crisp non-muddy focused brows
- Liquid-silk broken hair grooves across luminous angel-ring crown highlight
- Zero tangle between windup ice crossguard and side-braid navy ribbon
- Clean 1px right-margin safety buffer on strike ice thrust smear (zero border clipping)
- Clean separation of hurt defensive far hand from right cheek lock
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
PIVOT_X = 33

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "sylvia_silver_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "sylvia_silver_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 25-Color Hue-Shifted Anime JRPG Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
PURE_WHT = "#ffffff"  # Eye catchlights, sclera highlight, crystal flash core
WHT_HI   = "#edf3ff"  # Lit white blouse, knee socks, sunlit silver hair highlight
HAIR_MID = "#cfd7ee"  # Luminous silver-white hair base & blouse midtone
HAIR_SH1 = "#96a2c7"  # Cool periwinkle-silver hair shadow & cloth fold
HAIR_SH2 = "#69759e"  # Deep lavender-slate hair shadow, brows & lit hair selout

INK_DARK = "#171d38"  # Deep indigo-navy ink, shadow outlines, upper lashes
INK_MID  = "#37436c"  # Mid cool slate outline for mid-lit garments/hair
INK_ICE  = "#1a4d94"  # Deep sapphire crystal outline for rapier

SKIN_HI  = "#fff2eb"  # Warm porcelain forehead/cheek highlight
SKIN_MID = "#fcdbca"  # Warm porcelain skin base
SKIN_SH1 = "#e3ab98"  # Soft peach skin shadow
SKIN_SH2 = "#bf7e72"  # Chin/neck rose-umber shadow & soft serene smile
INK_SKIN = "#8f5858"  # Warm muted rose-umber jaw/hand selective outline
BLUSH    = "#f598b0"  # Adorable rosy anime cheek blush & open mouth interior

NVY_HI   = "#4772cc"  # Royal cobalt highlight on bows & sunlit skirt pleats
NVY_MID  = "#274ca1"  # Royal navy vest, skirt & ribbon base
NVY_SH1  = "#19306e"  # Royal navy shadow
NVY_SH2  = "#101e4a"  # Deepest midnight-navy pleat shadow & boot sole

EYE_DARK = "#153d9e"  # Deep cobalt upper iris
EYE_MID  = "#2980f0"  # Vivid sapphire mid iris & ice blade lower facet
ICE_MID  = "#5bc0fc"  # Luminous sky-frost crystal & brooch facet
ICE_HI   = "#a6ecff"  # Glowing ice-cyan lower iris crescent & blade lit facet

GLD_HI   = "#fceb9c"  # Gleaming champagne-gold highlight
GLD_MID  = "#d6ad52"  # Aristocratic gold vest trim & skirt hem
GLD_SH   = "#946a24"  # Burnished antique gold shadow

PALETTE = [
    PURE_WHT, WHT_HI, HAIR_MID, HAIR_SH1, HAIR_SH2,
    INK_DARK, INK_MID, INK_ICE,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, INK_SKIN, BLUSH,
    NVY_HI, NVY_MID, NVY_SH1, NVY_SH2,
    EYE_DARK, EYE_MID, ICE_MID, ICE_HI,
    GLD_HI, GLD_MID, GLD_SH,
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


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected selective outer outline with material- and light-aware tinting."""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_hair_lit = hex2rgba(HAIR_SH2)
    rgba_ink_mid  = hex2rgba(INK_MID)
    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_ink_skin = hex2rgba(INK_SKIN)
    rgba_ink_ice  = hex2rgba(INK_ICE)

    hair_lit_set = {hex2rgba(WHT_HI)[:3], hex2rgba(HAIR_MID)[:3]}
    hair_all_set = hair_lit_set | {hex2rgba(HAIR_SH1)[:3]}
    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3], hex2rgba(BLUSH)[:3]}
    ice_set = {hex2rgba(ICE_HI)[:3], hex2rgba(ICE_MID)[:3], hex2rgba(EYE_MID)[:3], hex2rgba(EYE_DARK)[:3], hex2rgba(PURE_WHT)[:3]}
    gold_set = {hex2rgba(GLD_HI)[:3], hex2rgba(GLD_MID)[:3]}

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

            if is_weap_nbr and any(rgb in ice_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_ice
            elif any(rgb in skin_set for rgb in rgb_list) and not any(rgb == hex2rgba(NVY_SH1)[:3] for rgb in rgb_list):
                dst[x, y] = rgba_ink_skin if y < 40 else rgba_ink_mid
            elif is_top_left and y < 38 and all(rgb in hair_all_set for rgb in rgb_list):
                dst[x, y] = rgba_hair_lit
            elif is_top_left and any(rgb in hair_lit_set or rgb in gold_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_mid
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters
# ---------------------------------------------------------------------------

def draw_back_hair(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Silky, flowing long silver-white hair with sculpted waist contour & tapered wispy tips."""
    sp.layer("back_hair")
    rows = {}
    top_y = head_y + 6
    bot_y = head_y + 52

    for i in range(bot_y - top_y + 1):
        y = top_y + i
        t = i / max(1, (bot_y - top_y))

        if pose == "strike":
            curve = -int(round(t * 9.5 + math.sin(t * 3.2) * 1.8))
        elif pose == "hurt":
            curve = -int(round(t * 7.5 - math.sin(t * 2.8) * 2.2))
        elif pose == "windup":
            curve = -int(round(t * 1.8 + math.sin(t * 2.4) * 0.7))
        else:
            curve = -int(round(t * 5.2 + math.sin(t * 2.7) * 1.4)) + int(round(sway * t * 1.8))

        if t < 0.22:
            lx = cx - 9 - int(round(t * 15)) + curve
        elif t < 0.68:
            lx = cx - 12 - int(round((t - 0.22) * 5)) + curve
        else:
            lx = cx - 14 + int(round((t - 0.68) * 8)) + curve

        if t < 0.30:
            rx = cx + 9 - int(round(t * 8))
        elif t < 0.70:
            rx = cx + 5 - int(round((t - 0.30) * 12))
        else:
            rx = cx - 1 - int(round((t - 0.70) * 10)) + int(round(curve * 0.35))

        if rx >= lx:
            rows[y] = (lx, rx)

    fill_rows(sp, rows, HAIR_SH1)

    for y, (lx, rx) in rows.items():
        t = (y - top_y) / max(1, (bot_y - top_y))
        if lx + 3 <= rx:
            hspan(sp, y, lx, lx + 3, HAIR_MID)
        if t < 0.65 and lx + 2 <= rx:
            hspan(sp, y, lx + 1, lx + 2, WHT_HI if t < 0.45 else HAIR_MID)
        strand_x = lx + 6 + int(round(math.sin(t * 4.5) * 1.4))
        if lx + 2 < strand_x < rx - 2:
            hspan(sp, y, strand_x, strand_x + 1, HAIR_MID)
            if 0.14 < t < 0.56:
                sp.px(strand_x, y, WHT_HI)
        sh_x = max(lx + 4, cx - 6)
        if sh_x <= rx:
            hspan(sp, y, sh_x, rx, HAIR_SH2)
        gr_x = lx + 4 + int(round(math.sin(t * 3.8) * 1.1))
        if lx + 1 < gr_x < rx - 1:
            sp.px(gr_x, y, HAIR_SH2 if t > 0.35 else HAIR_SH1)

    # Sculpt 3 crisp tapered wispy lock tips at the bottom!
    base_lx, base_rx = rows.get(bot_y - 3, (cx - 17, cx - 5))
    for y in range(bot_y - 1, bot_y + 1):
        for x in range(base_lx, base_rx + 2):
            sp.px(x, y, None)

    locks = [
        (base_lx,     6, -1, True),
        (base_lx + 5, 7, -1, True),
        (base_lx + 10, 5, 0, False),
    ]
    for bx, length, dir_x, is_lit in locks:
        by = bot_y - 2
        for k in range(length):
            w = 3 if k < 2 else (2 if k < length - 2 else 1)
            px_x = bx + (dir_x * k) // 2
            if k < length - 2:
                col = HAIR_MID if is_lit else HAIR_SH1
            elif k == length - 2:
                col = HAIR_SH1
            else:
                col = HAIR_SH2
            hspan(sp, by + k, px_x, px_x + w - 1, col)
            if is_lit and k < 3:
                sp.px(px_x, by + k, WHT_HI)

    # Delicate fluttering silver wisp off outer-left hair curve in motion frames
    wisp_y = head_y + 24
    wisp_lx = rows.get(wisp_y, (cx - 15, cx))[0]
    if pose in ("idle2", "strike", "hurt"):
        for k in range(5):
            wx = wisp_lx - 1 - (k // 2)
            wy = wisp_y + k
            sp.px(wx, wy, WHT_HI if k < 2 else (HAIR_MID if k < 4 else HAIR_SH1))
            if k < 3:
                sp.px(wx + 1, wy, HAIR_MID)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Crisp white knee socks + sleek dark-navy noble ankle boots locked squarely to GROUND_Y."""
    sp.layer("legs")

    if pose == "strike":
        near_fx, near_fy = cx - 9, ground_y
        far_fx, far_fy = cx + 6, ground_y
        near_top_x = cx - 4
        far_top_x = cx + 2
    elif pose == "windup":
        near_fx, near_fy = cx - 5, ground_y
        far_fx, far_fy = cx + 4, ground_y
        near_top_x = cx - 4
        far_top_x = cx + 2
    elif pose == "hurt":
        near_fx, near_fy = cx - 5, ground_y
        far_fx, far_fy = cx + 5, ground_y - 1
        near_top_x = cx - 3
        far_top_x = cx + 2
    else:
        near_fx, near_fy = cx - 5, ground_y
        far_fx, far_fy = cx + 3, ground_y
        near_top_x = cx - 4
        far_top_x = cx + 2

    hip_y = ground_y - 15

    def _draw_one_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        boot_top_y = foot_y - 6
        sock_hi = HAIR_MID if is_far else WHT_HI
        sock_mid = HAIR_SH1 if is_far else HAIR_MID
        sock_sh = HAIR_SH2 if is_far else HAIR_SH1

        boot_hi = NVY_MID if is_far else NVY_HI
        boot_mid = NVY_SH1 if is_far else NVY_MID
        boot_sh = NVY_SH2 if is_far else NVY_SH1

        span_h = max(1, boot_top_y - hip_y)
        for y in range(hip_y, boot_top_y + 1):
            t = (y - hip_y) / span_h
            lx = int(round(top_x + (foot_x - top_x) * t))
            w = 4 if t < 0.42 else 3
            hspan(sp, y, lx, lx + w - 1, sock_mid)
            sp.px(lx, y, sock_hi)
            sp.px(lx + w - 1, y, sock_sh)
            if y <= hip_y + 3:
                hspan(sp, y, lx, lx + w - 1, sock_sh)

        bx = foot_x
        hspan(sp, boot_top_y, bx, bx + 3, boot_mid)
        sp.px(bx, boot_top_y, boot_hi)
        sp.px(bx + 2, boot_top_y, GLD_HI if not is_far else GLD_MID)
        sp.px(bx + 3, boot_top_y, boot_sh)

        for y in range(boot_top_y + 1, foot_y - 2):
            hspan(sp, y, bx, bx + 3, boot_mid)
            sp.px(bx, y, boot_hi)
            sp.px(bx + 3, y, boot_sh)

        hspan(sp, foot_y - 2, bx, bx + 4, boot_mid)
        sp.px(bx + 1, foot_y - 2, boot_hi)
        sp.px(bx + 4, foot_y - 2, boot_sh)

        hspan(sp, foot_y - 1, bx, bx + 5, boot_mid)
        hspan(sp, foot_y - 1, bx + 1, bx + 3, boot_hi)
        sp.px(bx + 5, foot_y - 1, boot_sh)

        hspan(sp, foot_y, bx, bx + 5, NVY_SH2)
        sp.px(bx + 2, foot_y, boot_sh)

    _draw_one_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_one_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_far_arm(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Far (left) puffed white sleeve & delicate hand cleanly separated from jawline & rapier."""
    sp.layer("far_arm")
    sx, sy = cx + 5, torso_y + 2

    if pose == "strike":
        # Tucked neatly behind torso so thrusting near arm + ice rapier dominate silhouette!
        hx, hy = cx + 6, torso_y + 11
    elif pose == "windup":
        # Graceful noble mage-fencer balance hand extended forward-right!
        hx, hy = cx + 13, torso_y + 5
    elif pose == "hurt":
        # Defensive guard hand cleanly separated from right cheek hair lock!
        hx, hy = cx + 12, torso_y + 4
    else:
        hx, hy = cx + 10, torso_y + 11

    mid_x = (sx + hx) // 2
    mid_y = (sy + hy) // 2

    sp.polygon([
        (sx - 1, sy),
        (sx + 3, sy + 1),
        (mid_x + 2, mid_y + 1),
        (mid_x - 1, mid_y + 2),
        (sx - 1, sy + 4),
    ], HAIR_MID, fill=True)
    sp.line(sx + 2, sy + 1, mid_x + 2, mid_y + 1, HAIR_SH1)
    sp.line(sx, sy + 1, mid_x, mid_y, WHT_HI)

    # Navy sleeve ribbon band
    hspan(sp, mid_y + 1, mid_x - 1, mid_x + 2, NVY_SH1)
    sp.px(mid_x + 1, mid_y + 1, GLD_SH)

    # Forearm cuff
    sp.line(mid_x, mid_y + 2, hx, hy - 1, HAIR_MID)
    sp.line(mid_x + 1, mid_y + 2, hx + 1, hy - 1, HAIR_SH1)

    # Delicate porcelain hand
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_SH1)
    sp.px(hx, hy - 1, SKIN_MID)


def draw_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Flared royal navy pleated noble skirt with gleaming gold embroidered hem & soft white petticoat."""
    sp.layer("skirt")
    skirt_h = 13

    if pose == "strike":
        shift_bot = -3
        flare_l, flare_r = 12, 11
    elif pose == "hurt":
        shift_bot = 2
        flare_l, flare_r = 10, 12
    elif pose == "windup":
        shift_bot = -1
        flare_l, flare_r = 11, 10
    else:
        shift_bot = sway
        flare_l, flare_r = 11, 10

    for i in range(skirt_h + 1):
        y = waist_y + i
        t = i / skirt_h
        e = t ** 0.86
        lx = int(round(cx - 5 - flare_l * e + shift_bot * t))
        rx = int(round(cx + 5 + flare_r * e + shift_bot * t))

        span = max(1, rx - lx)
        for x in range(lx, rx + 1):
            u = (x - lx) / span
            pleat = (u * 4.6) % 1.0
            if u < 0.12:
                col = NVY_HI if i > 1 else NVY_MID
            elif u > 0.85:
                col = NVY_SH2
            elif pleat < 0.26:
                col = NVY_SH2 if u > 0.50 else NVY_SH1
            elif pleat < 0.66:
                col = NVY_MID if u < 0.64 else NVY_SH1
            else:
                col = NVY_HI if u < 0.58 else NVY_MID
            sp.px(x, y, col)

        if i == 0:
            hspan(sp, y, lx, rx, NVY_SH2)

        if i == skirt_h - 2:
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                pleat = (u * 4.6) % 1.0
                if pleat < 0.24 or u > 0.84:
                    gcol = GLD_SH
                elif u < 0.16 or (u < 0.50 and pleat > 0.50):
                    gcol = GLD_HI
                else:
                    gcol = GLD_MID
                sp.px(x, y, gcol)
        elif i == skirt_h:
            hspan(sp, y, lx, rx, NVY_SH2)

    y_lace = waist_y + skirt_h + 1
    lx_b = int(round(cx - 5 - flare_l + shift_bot)) + 2
    rx_b = int(round(cx + 5 + flare_r + shift_bot)) - 2
    for x in range(lx_b, rx_b + 1):
        u = (x - lx_b) / max(1, rx_b - lx_b)
        if (x - lx_b) % 4 == 3:
            sp.px(x, y_lace, HAIR_SH1)
        else:
            sp.px(x, y_lace, WHT_HI if u < 0.55 else HAIR_MID)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """High-collar white ruffled blouse, royal navy neck bow & sapphire brooch,
    and tailored gold-embroidered open royal navy vest + corset waist."""
    sp.layer("torso")

    for y in range(neck_y - 2, neck_y + 1):
        hspan(sp, y, cx - 1, cx + 2, SKIN_SH1)
        sp.px(cx - 1, y, SKIN_MID)
        sp.px(cx + 2, y, SKIN_SH2)
    hspan(sp, neck_y - 2, cx - 1, cx + 2, SKIN_SH2)

    hspan(sp, neck_y, cx - 3, cx + 3, WHT_HI)
    sp.px(cx + 3, neck_y, HAIR_MID)
    hspan(sp, neck_y + 1, cx - 3, cx + 4, WHT_HI)
    sp.px(cx + 3, neck_y + 1, HAIR_MID)
    sp.px(cx + 4, neck_y + 1, HAIR_SH1)

    torso_shape = {
        2:  (-6, 6),
        3:  (-6, 6),
        4:  (-6, 6),
        5:  (-5, 6),
        6:  (-5, 6),
        7:  (-5, 5),
        8:  (-5, 5),
        9:  (-4, 5),
        10: (-4, 4),
        11: (-4, 4),
        12: (-5, 5),
        13: (-5, 5),
    }

    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, WHT_HI)
        if 4 <= dy <= 10:
            sp.px(cx + 1, y, HAIR_MID if dy % 2 == 0 else WHT_HI)
            if dy % 2 == 1:
                sp.px(cx, y, HAIR_MID)
                sp.px(cx + 2, y, HAIR_SH1)

    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        if dy <= 10:
            vl_r = cx - 2 if dy < 7 else cx - 1
            hspan(sp, y, cx + dl, vl_r, NVY_MID)
            sp.px(cx + dl, y, NVY_HI if dy < 8 else NVY_MID)
            sp.px(vl_r, y, GLD_HI if dy % 2 == 0 else GLD_MID)

            vr_l = cx + 4 if dy < 7 else cx + 3
            hspan(sp, y, vr_l, cx + dr, NVY_SH1)
            sp.px(cx + dr, y, NVY_SH2)
            sp.px(vr_l, y, GLD_MID if dy % 2 == 0 else GLD_SH)
        else:
            hspan(sp, y, cx + dl, cx + dr, NVY_SH1)
            hspan(sp, y, cx + dl, cx - 1, NVY_MID)
            sp.px(cx + dr, y, NVY_SH2)
            if dy == 11:
                sp.px(cx - 1, y, GLD_HI)
                sp.px(cx + 2, y, GLD_MID)
            elif dy == 12:
                sp.px(cx, y, GLD_MID)
                sp.px(cx + 1, y, GLD_SH)

    # Royal Navy Neck Bow + Sparkling Gold-Rimmed Sapphire Brooch!
    by = neck_y + 2
    hspan(sp, by, cx - 3, cx - 1, NVY_HI)
    hspan(sp, by + 1, cx - 3, cx - 1, NVY_MID)
    hspan(sp, by, cx + 2, cx + 4, NVY_MID)
    hspan(sp, by + 1, cx + 2, cx + 4, NVY_SH1)
    sp.px(cx, by + 2, NVY_MID)
    sp.px(cx + 1, by + 2, NVY_SH1)
    sp.px(cx - 1, by + 3, NVY_HI)
    sp.px(cx, by + 3, NVY_MID)
    sp.px(cx + 1, by + 3, NVY_SH1)
    sp.px(cx - 1, by + 4, NVY_MID)
    sp.px(cx + 1, by + 4, NVY_SH2)

    sp.px(cx, by, GLD_HI)
    sp.px(cx + 1, by, PURE_WHT)
    sp.px(cx, by + 1, ICE_HI)
    sp.px(cx + 1, by + 1, EYE_MID)
    sp.px(cx, by + 2, GLD_MID)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Jewelry-polished 3/4 anime head, porcelain skin, luminous gemstone sapphire eyes,
    liquid-silk silver hair crown & feathery V-bangs, and iconic side-braid ribbon + sapphire brooch."""
    sp.layer("head")

    # 1) Soft tapered warm porcelain face silhouette
    face_rows = {
        9:  (-7, 7),
        10: (-8, 8),
        11: (-8, 8),
        12: (-8, 9),
        13: (-8, 9),
        14: (-8, 9),
        15: (-8, 9),
        16: (-8, 9),
        17: (-8, 9),
        18: (-8, 9),
        19: (-8, 9),
        20: (-7, 9),
        21: (-7, 8),
        22: (-6, 8),
        23: (-5, 7),
        24: (-3, 6),
        25: (-1, 4),
        26: (1, 3),
    }
    for dy, (dl, dr) in face_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, SKIN_MID)
        if 15 <= dy <= 22:
            hspan(sp, y, cx + dl + 1, cx - 2, SKIN_HI)
        if 13 <= dy <= 24:
            sp.px(cx + dr, y, SKIN_SH1)
        if dy == 25:
            sp.px(cx + dl, y, SKIN_SH1)
            sp.px(cx + dr - 1, y, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)
        if dy == 26:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    for x in (cx - 6, cx - 5, cx + 1, cx + 2, cx + 7):
        sp.px(x, head_y + 13, SKIN_SH1)

    # 2) LUMINOUS GEMSTONE SAPPHIRE ANIME EYES (crisp 1px outer lash wing + wide bright sclera!)
    ey = head_y + 15
    lx0 = cx - 4  # near eye: 5x6
    rx0 = cx + 4  # far eye:  4x6

    if pose == "blink":
        sp.px(lx0 - 1, ey + 2, INK_DARK)
        hspan(sp, ey + 3, lx0, lx0 + 3, INK_DARK)
        sp.px(lx0 + 4, ey + 2, INK_DARK)
        hspan(sp, ey + 4, lx0 + 1, lx0 + 2, SKIN_SH1)

        hspan(sp, ey + 3, rx0, rx0 + 3, INK_DARK)
        sp.px(rx0 + 4, ey + 2, INK_DARK)
        hspan(sp, ey + 4, rx0 + 1, rx0 + 2, SKIN_SH1)

    elif pose == "hurt":
        sp.px(lx0, ey + 1, INK_DARK)
        sp.px(lx0 + 1, ey + 2, INK_DARK)
        sp.px(lx0 + 2, ey + 2, INK_DARK)
        sp.px(lx0 + 3, ey + 3, INK_DARK)
        sp.px(lx0 + 2, ey + 4, INK_DARK)
        sp.px(lx0 + 1, ey + 4, INK_DARK)
        sp.px(lx0, ey + 5, INK_DARK)

        sp.px(rx0 + 3, ey + 1, INK_DARK)
        sp.px(rx0 + 2, ey + 2, INK_DARK)
        sp.px(rx0 + 1, ey + 3, INK_DARK)
        sp.px(rx0 + 2, ey + 4, INK_DARK)
        sp.px(rx0 + 3, ey + 5, INK_DARK)

    else:
        determined = pose in ("windup", "strike")

        # --- NEAR EYE (5x6 crystalline sapphire gem!) ---
        # Crisp curved upper lash + single delicate outer-left lash wing
        sp.px(lx0 - 1, ey + 1, INK_DARK)
        if determined:
            hspan(sp, ey, lx0, lx0 + 3, INK_DARK)
            sp.px(lx0 + 4, ey + 1, INK_DARK)
        else:
            hspan(sp, ey, lx0, lx0 + 4, INK_DARK)

        # Row +1: bright sclera + gleaming top-left PURE_WHT catchlight + cobalt upper iris!
        sp.px(lx0, ey + 1, HAIR_MID if not determined else PURE_WHT)  # soft upper sclera shadow (NOT blocky black!)
        sp.px(lx0 + 1, ey + 1, PURE_WHT)    # pure catchlight sparkle!
        sp.px(lx0 + 2, ey + 1, EYE_DARK)
        sp.px(lx0 + 3, ey + 1, EYE_DARK if not determined else INK_DARK)
        sp.px(lx0 + 4, ey + 1, EYE_DARK if not determined else INK_DARK)

        # Row +2: pure white sclera + crisp dark pupil + vibrant sapphire!
        sp.px(lx0, ey + 2, PURE_WHT)
        sp.px(lx0 + 1, ey + 2, EYE_DARK)
        sp.px(lx0 + 2, ey + 2, INK_DARK)
        sp.px(lx0 + 3, ey + 2, EYE_MID)
        sp.px(lx0 + 4, ey + 2, EYE_DARK)

        # Row +3: glowing sapphire azure + ice-cyan bloom
        sp.px(lx0, ey + 3, PURE_WHT)
        sp.px(lx0 + 1, ey + 3, EYE_MID)
        sp.px(lx0 + 2, ey + 3, EYE_MID)
        sp.px(lx0 + 3, ey + 3, ICE_MID)
        sp.px(lx0 + 4, ey + 3, EYE_MID)

        # Row +4: luminous ice-cyan lower crescent + secondary crystal sparkle
        sp.px(lx0, ey + 4, SKIN_MID)
        sp.px(lx0 + 1, ey + 4, ICE_HI)
        sp.px(lx0 + 2, ey + 4, ICE_HI)
        sp.px(lx0 + 3, ey + 4, PURE_WHT)
        sp.px(lx0 + 4, ey + 4, ICE_MID)

        # Row +5: soft lower lid contour
        hspan(sp, ey + 5, lx0 + 1, lx0 + 3, HAIR_SH2)

        # --- FAR EYE (4x6 3/4 perspective sapphire gem!) ---
        if determined:
            hspan(sp, ey, rx0 + 1, rx0 + 3, INK_DARK)
            sp.px(rx0, ey + 1, INK_DARK)
        else:
            hspan(sp, ey, rx0, rx0 + 3, INK_DARK)
        sp.px(rx0 + 4, ey + 1, INK_DARK)    # delicate 1px outer-right lash wing!

        sp.px(rx0, ey + 1, EYE_DARK if not determined else INK_DARK)
        sp.px(rx0 + 1, ey + 1, PURE_WHT)    # matching top-left catchlight!
        sp.px(rx0 + 2, ey + 1, EYE_DARK)
        sp.px(rx0 + 3, ey + 1, HAIR_MID if not determined else PURE_WHT)  # bright outer sclera!

        sp.px(rx0, ey + 2, EYE_DARK)
        sp.px(rx0 + 1, ey + 2, INK_DARK)
        sp.px(rx0 + 2, ey + 2, EYE_MID)
        sp.px(rx0 + 3, ey + 2, PURE_WHT)

        sp.px(rx0, ey + 3, EYE_MID)
        sp.px(rx0 + 1, ey + 3, EYE_MID)
        sp.px(rx0 + 2, ey + 3, ICE_MID)
        sp.px(rx0 + 3, ey + 3, PURE_WHT)

        sp.px(rx0, ey + 4, ICE_MID)
        sp.px(rx0 + 1, ey + 4, ICE_HI)
        sp.px(rx0 + 2, ey + 4, PURE_WHT)
        sp.px(rx0 + 3, ey + 4, SKIN_MID)

        hspan(sp, ey + 5, rx0, rx0 + 2, HAIR_SH2)

    # 3) Clean, soft 2px rosy horizontal anime cheek blush!
    hspan(sp, ey + 5, lx0 - 1, lx0, BLUSH)
    hspan(sp, ey + 5, rx0 + 2, rx0 + 3, BLUSH)

    # 4) Sweet expressive anime mouth
    my = head_y + 22
    mx = cx + 2
    if pose == "strike":
        sp.px(mx - 1, my, INK_SKIN)
        sp.px(mx, my, INK_SKIN)
        sp.px(mx - 1, my + 1, BLUSH)
        sp.px(mx, my + 1, BLUSH)
    elif pose == "hurt":
        sp.px(mx - 1, my + 1, INK_SKIN)
        sp.px(mx, my, INK_SKIN)
        sp.px(mx + 1, my + 1, INK_SKIN)
    elif pose == "windup":
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx, my, INK_SKIN)
    else:
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx, my, SKIN_SH2)
        sp.px(mx + 1, my - 1, SKIN_SH1)

    # 5) LIQUID-SILK SILVER-WHITE HAIR CROWN & FEATHERY V-BANGS!
    crown_rows = {
        0:  (-4, 4),
        1:  (-7, 6),
        2:  (-9, 8),
        3:  (-11, 9),
        4:  (-12, 10),
        5:  (-13, 11),
        6:  (-13, 11),
        7:  (-14, 11),
        8:  (-14, 11),
        9:  (-14, 11),
        10: (-14, 11),
        11: (-14, 10),
        12: (-14, 10),
    }
    for dy, (dl, dr) in crown_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, HAIR_MID)

        # Soft sunlit top-left crown sheen
        if 1 <= dy <= 5:
            hi_l = cx + max(dl + 1, -10)
            hi_r = cx + min(dr - 2, 4)
            if hi_r >= hi_l:
                hspan(sp, y, hi_l, hi_r, WHT_HI)
        # Luminous curved anime angel-ring highlight!
        if dy == 6:
            hspan(sp, y, cx - 10, cx - 5, WHT_HI)
            hspan(sp, y, cx - 3, cx + 2, WHT_HI)
            hspan(sp, y, cx + 4, cx + 7, WHT_HI)
            sp.px(cx - 8, y, PURE_WHT)
            sp.px(cx - 1, y, PURE_WHT)
            sp.px(cx + 5, y, PURE_WHT)
        elif dy == 7:
            hspan(sp, y, cx - 11, cx - 7, WHT_HI)
            hspan(sp, y, cx - 4, cx, WHT_HI)
            hspan(sp, y, cx + 5, cx + 8, WHT_HI)
            sp.px(cx - 9, y, PURE_WHT)
            sp.px(cx - 2, y, PURE_WHT)
        elif dy == 8:
            hspan(sp, y, cx - 11, cx - 9, WHT_HI)
            hspan(sp, y, cx - 5, cx - 3, WHT_HI)
            sp.px(cx + 7, y, WHT_HI)

        if dr >= 8:
            hspan(sp, y, cx + dr - 2, cx + dr, HAIR_SH1)
            if dy >= 5:
                sp.px(cx + dr, y, HAIR_SH2)

    # Delicate natural hair part at top-center (broken cleanly across angel-ring!)
    part_x = cx + 1
    for dy in (1, 2, 3, 4):
        sp.px(part_x, head_y + dy, HAIR_SH1)
    sp.px(part_x, head_y + 2, HAIR_SH2)

    # Subtle, broken liquid-silk strand grooves (only below angel-ring dy=8..12 so crown stays lush!)
    for (sx, sy0, sy1, dx_step) in [
        (cx - 6, 8, 12, -0.35),
        (cx - 1, 8, 12, -0.15),
        (cx + 4, 8, 12,  0.30),
        (cx + 8, 7, 12,  0.22),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, HAIR_SH1)

    # Airy forehead breathing room right above brows!
    for x in (cx - 3, cx - 2, cx + 5, cx + 6):
        sp.px(x, head_y + 12, SKIN_MID)

    # Sculpted feathery V-tapered bangs
    for dy, (dl, dr) in [
        (11, (-1, 3)), (12, (0, 3)), (13, (0, 3)),
        (14, (1, 3)), (15, (1, 2)), (16, (1, 2)), (17, (2, 2)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy < 16 else HAIR_SH1)
        if dy <= 14:
            sp.px(cx + dl, head_y + dy, WHT_HI)
        if dy >= 14 and dr > dl:
            sp.px(cx + dr, head_y + dy, HAIR_SH1)

    for dy, (dl, dr) in [(12, (-8, -4)), (13, (-8, -5)), (14, (-8, -6)), (15, (-8, -6)), (16, (-7, -7))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID)
        sp.px(cx + dl, head_y + dy, WHT_HI)
        if dy >= 14:
            sp.px(cx + dr, head_y + dy, HAIR_SH1)

    sp.px(cx - 3, head_y + 13, HAIR_MID)
    sp.px(cx - 3, head_y + 14, HAIR_SH1)

    for dy, (dl, dr) in [(12, (7, 10)), (13, (8, 10)), (14, (8, 10)), (15, (9, 10))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy == 12 else HAIR_SH1)
        sp.px(cx + dr, head_y + dy, HAIR_SH2)

    # 6) EXPRESSIVE DELICATE SILVER EYEBROWS (crisp separation above eyelashes!)
    brow_y = ey - 2
    if pose in ("windup", "strike"):
        # Fierce determined angled brows with 1px clean forehead gap above lash!
        sp.px(lx0 - 1, brow_y - 1, HAIR_SH2)
        sp.px(lx0, brow_y - 1, HAIR_SH2)
        sp.px(lx0 + 1, brow_y, INK_MID)
        sp.px(lx0 + 2, brow_y, INK_MID)

        sp.px(rx0 + 1, brow_y, INK_MID)
        sp.px(rx0 + 2, brow_y, INK_MID)
        sp.px(rx0 + 3, brow_y - 1, HAIR_SH2)
    elif pose == "hurt":
        sp.px(lx0, brow_y + 1, HAIR_SH2)
        sp.px(lx0 + 1, brow_y, INK_MID)
        sp.px(lx0 + 2, brow_y, HAIR_SH2)
        sp.px(rx0 + 1, brow_y, HAIR_SH2)
        sp.px(rx0 + 2, brow_y, INK_MID)
        sp.px(rx0 + 3, brow_y + 1, HAIR_SH2)
    else:
        hspan(sp, brow_y, lx0, lx0 + 2, HAIR_SH2)
        hspan(sp, brow_y, rx0 + 1, rx0 + 3, HAIR_SH2)

    # 7) LONG FACE-FRAMING FRONT SILVER LOCKS!
    for i in range(24):
        y = head_y + 13 + i
        t = i / 23.0
        off = int(round(math.sin(t * 2.6) * 1.5)) + (1 if pose == "hurt" else 0)
        lx = cx - 13 + int(round(t * 2.8)) + off
        w = 5 if i < 7 else (4 if i < 14 else (3 if i < 19 else (2 if i < 22 else 1)))
        hspan(sp, y, lx, lx + w - 1, HAIR_MID)
        sp.px(lx, y, WHT_HI if i < 17 else HAIR_MID)
        if w >= 3:
            sp.px(lx + w - 1, y, HAIR_SH1)
        if i in (5, 6, 13, 14) and w >= 4:
            sp.px(lx + 1, y, WHT_HI)

    # Far (right) slender curved cheek lock tapering smoothly inward at bottom!
    for i in range(18):
        y = head_y + 12 + i
        t = i / 17.0
        rx = cx + 9 + int(round(math.sin(t * 2.8) * 1.0)) - (1 if i >= 15 else 0)
        w = 3 if i < 6 else (2 if i < 14 else 1)
        hspan(sp, y, rx, rx + w - 1, HAIR_SH1 if i > 4 else HAIR_MID)
        if w >= 2:
            sp.px(rx + w - 1, y, HAIR_SH2)

    # 8) ICONIC WOVEN SIDE BRAID + ROYAL NAVY & WHITE-FRILLED RIBBON + SAPPHIRE BROOCH!
    bx = cx - 12
    by = head_y + 12

    for k in range(5):
        px_x = bx + k
        py_y = by + (1 if k % 2 else 0)
        sp.px(px_x, py_y - 1, WHT_HI if k % 2 == 0 else HAIR_MID)
        sp.px(px_x, py_y, HAIR_MID if k % 2 == 0 else HAIR_SH1)
        sp.px(px_x, py_y + 1, HAIR_SH2)

    # White-frilled backing bow behind navy bow
    sp.rect(bx - 3, by - 2, bx - 1, by + 1, WHT_HI)
    sp.px(bx - 3, by + 1, HAIR_MID)

    # Royal navy bow knot & lush loops
    sp.rect(bx - 3, by + 1, bx, by + 3, NVY_MID)
    sp.px(bx - 3, by + 1, NVY_HI)
    sp.px(bx, by + 3, NVY_SH2)

    # S-curved fluttering ribbon tails (tucked neatly inward in windup so sword crossguard never tangles!)
    if pose == "strike":
        sway_curve = [0, -1, -2, -3, -4, -4, -5, -5]
    elif pose == "hurt":
        sway_curve = [0, 0, -1, -1, 0, 1, 1, 2]
    elif pose == "windup":
        sway_curve = [0, 0, 0, 1, 1, 1, 1, 1]
    elif pose == "idle2":
        sway_curve = [0, 0, -1, -1, -2, -2, -3, -3]
    else:
        sway_curve = [0, 0, -1, -1, -1, -2, -2, -2]

    for k in range(8):
        ty = by + 4 + k
        tx = bx - 2 + sway_curve[k]
        sp.px(tx - 1, ty, NVY_HI if k < 3 else NVY_MID)
        sp.px(tx, ty, NVY_SH1)
        sp.px(tx + 1, ty, NVY_MID if k < 6 else GLD_MID)
        sp.px(tx + 2, ty, WHT_HI if k < 7 else HAIR_MID)
    end_tx = bx - 2 + sway_curve[7]
    sp.px(end_tx - 1, by + 11, GLD_MID)
    sp.px(end_tx, by + 11, GLD_HI)

    # Glittering Gold-Rimmed Oval Sapphire Brooch on the ribbon knot!
    sp.px(bx - 1, by - 1, GLD_HI)
    sp.px(bx - 2, by, GLD_MID)
    sp.px(bx - 1, by, PURE_WHT)
    sp.px(bx, by, GLD_HI)
    sp.px(bx - 1, by + 1, ICE_HI)
    sp.px(bx - 2, by + 1, EYE_MID)
    sp.px(bx - 1, by + 2, GLD_MID)


def draw_near_arm_and_weapon(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Near (right) puffed white sleeve with iconic royal navy sleeve ribbon & sapphire clasp,
    plus Sylvia's slender, razor-sharp crystalline ice-sapphire rapier & crisp frost VFX!"""
    sp.layer("near_arm")

    sh_x, sh_y = cx - 5, torso_y + 2

    if pose == "windup":
        # Raised cleanly up-back OUTSIDE the hair ribbon with dramatic open-sky negative space!
        el_x, el_y = cx - 10, torso_y + 5
        hx, hy = cx - 14, torso_y - 2
        tip_x, tip_y = hx - 10, hy - 22
    elif pose == "strike":
        # Fierce horizontal lunge thrust straight RIGHT with clean 1px right-edge safety buffer!
        el_x, el_y = cx + 1, torso_y + 6
        hx, hy = cx + 8, torso_y + 5
        tip_x, tip_y = hx + 21, hy
    elif pose == "hurt":
        # Recoil defensive guard clear of face
        el_x, el_y = cx - 7, torso_y + 9
        hx, hy = cx + 5, torso_y + 8
        tip_x, tip_y = hx + 18, hy - 6
    else:
        # Poised noble mage-swordswoman stance (blouse, bow & brooch 100% unobstructed!)
        el_x, el_y = cx - 8, torso_y + 9
        hx, hy = cx + 1, torso_y + 11
        tip_x, tip_y = hx + 24, hy + 7

    # 1) Generous puffed white noble upper sleeve
    sp.polygon([
        (sh_x - 2, sh_y),
        (sh_x + 2, sh_y),
        (el_x + 3, el_y),
        (el_x - 2, el_y + 1),
        (sh_x - 4, sh_y + 4),
    ], WHT_HI, fill=True)
    sp.line(sh_x + 1, sh_y + 1, el_x + 2, el_y, HAIR_MID)
    sp.line(sh_x + 2, sh_y + 2, el_x + 3, el_y, HAIR_SH1)
    sp.line(sh_x - 2, sh_y + 2, el_x - 1, el_y, WHT_HI)

    # 2) Royal Navy Sleeve Ribbon Band + Gold Trim + Sapphire Clasp!
    rx0, ry0 = el_x - 2, el_y - 1
    rx1, ry1 = el_x + 3, el_y
    sp.rect(rx0, ry0, rx1, ry1, NVY_MID)
    sp.px(rx0, ry0, NVY_HI)
    sp.px(rx1, ry1, NVY_SH2)
    sp.px(rx0 + 1, ry0, GLD_HI)
    sp.px(rx0 + 2, ry0, ICE_HI)
    sp.px(rx0 + 2, ry1, EYE_MID)
    sp.px(rx0 + 3, ry0, GLD_MID)
    sp.px(rx0 - 1, ry1 + 1, NVY_MID)
    sp.px(rx0, ry1 + 1, NVY_SH1)
    sp.px(rx0 - 1, ry1 + 2, NVY_SH2)

    # 3) Forearm white bell-cuff
    sp.polygon([
        (el_x - 1, el_y + 1),
        (el_x + 2, el_y),
        (hx, hy - 1),
        (hx - 1, hy + 2),
    ], WHT_HI, fill=True)
    sp.line(el_x + 1, el_y + 1, hx - 1, hy + 1, HAIR_MID)
    sp.line(el_x, el_y + 2, hx - 1, hy + 2, HAIR_SH1)

    # 4) RAZOR-SHARP SLENDER CRYSTALLINE ICE-SAPPHIRE RAPIER (weapon layer!)
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

    # Ornate noble gold pommel & slim grip
    pom_x = int(round(hx - ux * 3.8))
    pom_y = int(round(hy - uy * 3.8))
    sp.line(pom_x, pom_y, hx, hy, GLD_MID)
    sp.px(pom_x, pom_y, GLD_HI)
    sp.px(int(round(hx - ux * 1.8)), int(round(hy - uy * 1.8)), GLD_SH)

    # Faceted Crystalline Ice-Sapphire Diamond Crossguard
    gx = int(round(hx + ux * 2.6))
    gy = int(round(hy + uy * 2.6))
    for s in (-3, -2, -1, 0, 1, 2, 3):
        cx_g = int(round(gx + nx_u * s))
        cy_g = int(round(gy + ny_u * s))
        if abs(s) == 3:
            col = ICE_MID if s > 0 else EYE_DARK
        elif abs(s) == 2:
            col = ICE_HI if s > 0 else EYE_MID
        elif abs(s) == 1:
            col = PURE_WHT if s > 0 else ICE_HI
        else:
            col = GLD_HI
        sp.px(cx_g, cy_g, col)
    # Forward crystal guard diamond prism
    sp.px(int(round(gx + ux * 1.4)), int(round(gy + uy * 1.4)), PURE_WHT)
    sp.px(int(round(gx + ux * 1.4 - off_x)), int(round(gy + uy * 1.4 - off_y)), ICE_MID)

    # Bresenham spine for razor-sharp 2px -> 1px faceted crystal blade
    bx0 = int(round(gx + ux * 2.0))
    by0 = int(round(gy + uy * 2.0))
    spine = []
    x0, y0, x1, y1 = bx0, by0, int(tip_x), int(tip_y)
    adx, ady = abs(x1 - x0), -abs(y1 - y0)
    sx_s = 1 if x0 < x1 else -1
    sy_s = 1 if y0 < y1 else -1
    err = adx + ady
    cx_p, cy_p = x0, y0
    while True:
        spine.append((cx_p, cy_p))
        if cx_p == x1 and cy_p == y1:
            break
        e2 = 2 * err
        if e2 >= ady:
            err += ady
            cx_p += sx_s
        if e2 <= adx:
            err += adx
            cy_p += sy_s

    n_pts = max(1, len(spine) - 1)
    for i, (px_b, py_b) in enumerate(spine):
        t = i / n_pts
        if t < 0.66:
            lit_col = PURE_WHT if (0.14 < t < 0.44 or 0.56 < t < 0.66) else ICE_HI
            sh_col = ICE_MID if t < 0.25 else (EYE_MID if t < 0.52 else EYE_DARK)
            sp.px(px_b, py_b, sh_col)
            sp.px(px_b + off_x, py_b + off_y, lit_col)
        else:
            sp.px(px_b, py_b, PURE_WHT if t > 0.85 else ICE_HI)

    # 5) Porcelain hand firmly gripping hilt
    sp.layer("near_arm")
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)

    # 6) Crisp Frame-Specific Ice Magic VFX (fx layer, ZERO dark outline, ZERO edge clipping!)
    sp.layer("fx")
    if pose == "windup":
        sx, sy = int(tip_x), int(tip_y)
        sp.px(sx, sy, PURE_WHT)
        for d in (1, 2, 3, 4):
            col = PURE_WHT if d == 1 else (ICE_HI if d == 2 else (ICE_MID if d == 3 else EYE_MID))
            if sx + d < W - 1:
                sp.px(sx + d, sy, col)
            if sx - d > 0:
                sp.px(sx - d, sy, col)
            if sy + d < H - 1:
                sp.px(sx, sy + d, col)
            if sy - d > 0:
                sp.px(sx, sy - d, col)
        for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            sp.px(sx + ddx, sy + ddy, ICE_HI)
        # Connected 2px frost motes orbiting raised crystal blade
        mx_t = int(round((bx0 + tip_x) * 0.50))
        my_t = int(round((by0 + tip_y) * 0.50))
        sp.px(mx_t - 3, my_t + 1, PURE_WHT)
        sp.px(mx_t - 4, my_t + 1, ICE_HI)
        sp.px(mx_t + 3, my_t - 2, ICE_HI)
        sp.px(mx_t + 4, my_t - 2, ICE_MID)

    elif pose == "strike":
        # Crisp 7px pale-cyan piercing ice smear safely inset from right canvas border (max x=70)
        sx, sy = int(tip_x), int(tip_y)
        for k in range(-5, 5):
            px_s = min(W - 2, sx + k)
            col = PURE_WHT if -2 <= k <= 2 else (ICE_HI if k <= 3 else ICE_MID)
            sp.px(px_s, sy, col)
        for k in range(-7, 3):
            px_s = min(W - 2, sx + k)
            col = ICE_HI if k >= -2 else ICE_MID
            sp.px(px_s, sy - 1, col)
            sp.px(px_s, sy + 1, col)
        for k in range(-6, 0):
            px_s = min(W - 2, sx + k)
            sp.px(px_s, sy - 2, ICE_MID)
            sp.px(px_s, sy + 2, ICE_MID)
        sp.px(sx, sy - 3, ICE_HI)
        sp.px(sx, sy + 3, ICE_HI)
        sp.px(sx, sy - 4, ICE_MID)
        sp.px(sx, sy + 4, ICE_MID)
        # Trailing crisp 2px frost crystal glints
        sp.px(sx - 10, sy - 3, PURE_WHT)
        sp.px(sx - 9, sy - 3, ICE_HI)
        sp.px(sx - 12, sy + 3, ICE_HI)
        sp.px(sx - 11, sy + 3, ICE_MID)

    return tip_x, tip_y


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    ("idle1",   0,   0,    0, 260),
    ("idle2",   0,  -1,   -1, 260),
    ("blink",   0,   0,    0, 140),
    ("windup", -2,   1,   -1, 180),
    ("strike",  4,   0,   -2, 160),
    ("hurt",   -3,   1,    2, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
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

        draw_back_hair(sp, cx, head_y, pose, sway)
        draw_far_arm(sp, cx, torso_y, pose)
        draw_legs_boots(sp, cx, GROUND_Y, pose)
        draw_skirt(sp, cx, waist_y, pose, sway)
        draw_torso(sp, cx, neck_y, pose)
        draw_head(sp, cx, head_y, pose, sway)
        tip_x, tip_y = draw_near_arm_and_weapon(sp, cx, torso_y, pose)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx + 1, head_y + 16)
            anchors["hit_px"] = (cx + 1, torso_y + 9)
        if pose == "strike":
            anchors["cast_px"] = (min(W - 2, tip_x), tip_y)

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
    x0, y0, x1, y1 = 12, 4, 52, 42
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
        im = sp.composite(fi)
        # Bottom-most non-outline body pixel should sit at y = GROUND_Y (outline at GROUND_Y + 1)
        leg_cel = sp.frames[fi - 1].cels["legs"]
        ys = [y for y in range(H) for x in range(W) if leg_cel.getpixel((x, y))[3] > 0]
        assert max(ys) == GROUND_Y, f"Frame {fi} boot baseline {max(ys)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "sylvia_silver",
        "file": "assets/sprites/sylvia_silver_sheet.png",
        "frames": N_FRAMES,
        "frameW": W,
        "frameH": H,
        "sheetW": W * N_FRAMES,
        "sheetH": H,
        "facing": "right",
        "anchorX": round(PIVOT_X / W, 4),
        "anchorY": round(GROUND_Y / H, 4),
        "castX": round(cast_x / W, 4),
        "castY": round(cast_y / H, 4),
        "hitX": round(hit_x / W, 4),
        "hitY": round(hit_y / H, 4),
        "headX": round(head_x / W, 4),
        "headY": round(head_y / H, 4),
        "colorsUsed": info["colors_used"],
        "buildScript": "tools/pixel_art/sylvia_silver/build.py",
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
