#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Sylvia Disguise "眷寒渔" (sylvia_disguise).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 72 x 80, 6 horizontal frames (432 x 80 sheet, padding=0).
Facing: right. GROUND_Y = 74, PIVOT_X = 33.

Pass 3 (Final Jewelry Polish):
- Removed stray hair pixel touching near eyebrow so both brows float cleanly over porcelain skin
- Warmed lower eyelid contour from cool grey-slate to delicate rose-umber (#bf7e72) for bright, youthful anime eyes
- Sculpted crisp 1px pinched waist on emerald-forest satin bow without heavy dark-ink indentation
- Separated windup frost-sheen glint cleanly from blade edge for an unbroken razor-thin steel silhouette
- Verified 0 semi-alpha px, 0 isolated px, 0 near-duplicate colors, and exact GROUND_Y=74 baseline lock
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

SHEET_PATH = os.path.join(SPRITES_DIR, "sylvia_disguise_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "sylvia_disguise_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 27-Color Hue-Shifted Anime JRPG Palette (all pairs RGB-dist > 12!)
# ---------------------------------------------------------------------------
PURE_WHT = "#ffffff"  # Eye catchlights, sclera white, frost-blade specular core
WHT_HI   = "#e8effa"  # Lit white ruffled blouse, knee socks, steel bright sheen
WHT_MID  = "#c4cfe3"  # Blouse ruffle midtone, far sock lit, forged steel body
WHT_SH   = "#95a3bd"  # Blouse shadow fold, far sock shadow, crown top specular glint

INK_DARK = "#0b0e17"  # Deep cool obsidian-indigo ink, shadow outlines, lashes, pupil
CHR_SH   = "#161a26"  # Deep cool slate-charcoal hair & outfit shadow, lit hair selout
CHR_MID  = "#283044"  # Lustrous slate-charcoal hair base, vest, skirt & boots mid
CHR_HI1  = "#434e68"  # Sunlit charcoal hair locks, vest lapels, skirt pleats
CHR_HI2  = "#6e7b98"  # Lustrous cool slate-silver hair angel-ring sheen & cold steel spine

SKIN_HI  = "#fff2eb"  # Warm porcelain forehead/cheek highlight
SKIN_MID = "#fcdbca"  # Warm porcelain skin base
SKIN_SH1 = "#e3ab98"  # Soft peach skin shadow
SKIN_SH2 = "#bf7e72"  # Chin/neck rose-umber shadow & calm composed smile
INK_SKIN = "#8f5858"  # Warm muted rose-umber jaw/hand selective outline
BLUSH    = "#f598b0"  # Soft rosy anime cheek blush & battle mouth interior

GRN_SH   = "#103828"  # Deep forest-emerald side ribbon fold shadow
GRN_MID  = "#246b4c"  # Rich emerald-forest green satin ribbon base
GRN_HI   = "#44a376"  # Sunlit emerald-forest satin ribbon highlight

EYE_DARK = "#0d4a34"  # Deep emerald gemstone upper iris
EYE_MID  = "#1c9466"  # Vivid saturated emerald-jade mid iris
EYE_HI   = "#7bf0b8"  # Luminous mint-emerald glowing lower iris crescent

GLD_HI   = "#f5e193"  # Gleaming champagne-gold highlight (vest filigree, buttons)
GLD_MID  = "#c99f4c"  # Refined antique-gold vest embroidery & subtle skirt hem
GLD_SH   = "#876124"  # Burnished antique-gold shadow & corset chain

ICE_HI   = "#bdf6ff"  # Razor-sharp frost-tempered silver-cyan blade edge gleam
ICE_MID  = "#5bc2e8"  # Cold water-frost sword sheen & thrust smear trail
INK_STL  = "#245478"  # Cool tempered-steel cyan-slate blade selective outline

PALETTE = [
    PURE_WHT, WHT_HI, WHT_MID, WHT_SH,
    INK_DARK, CHR_SH, CHR_MID, CHR_HI1, CHR_HI2,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, INK_SKIN, BLUSH,
    GRN_SH, GRN_MID, GRN_HI,
    EYE_DARK, EYE_MID, EYE_HI,
    GLD_HI, GLD_MID, GLD_SH,
    ICE_HI, ICE_MID, INK_STL,
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hspan(sp: Sprite, y: int, x0: int, x1: int, col: str | None, only=None):
    if x1 < x0:
        x0, x1 = x1, x0
    for x in range(int(x0), int(x1) + 1):
        sp.px(x, int(y), col, only=only)


def fill_rows(sp: Sprite, rows: dict[int, tuple[int, int]], col: str, only=None):
    for y, (x0, x1) in rows.items():
        hspan(sp, y, x0, x1, col, only=only)


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected selective outer outline with material- and light-aware tinting.

    Tuned so charcoal hair uses #161a26 on lit top-left curves (keeping crisp separation on
    both light winter sky AND dark dusk #2A344B) while white sleeves/blouse use #283044,
    porcelain skin uses warm rose-umber #8f5858, emerald ribbon uses #103828, and the
    frost-tempered thin steel blade uses cool steel-cyan #245478.
    """
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_chr_mid  = hex2rgba(CHR_MID)
    rgba_chr_sh   = hex2rgba(CHR_SH)
    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_ink_skin = hex2rgba(INK_SKIN)
    rgba_ink_stl  = hex2rgba(INK_STL)
    rgba_grn_sh   = hex2rgba(GRN_SH)

    lit_white_set = {hex2rgba(WHT_HI)[:3], hex2rgba(WHT_MID)[:3], hex2rgba(PURE_WHT)[:3]}
    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3], hex2rgba(BLUSH)[:3]}
    blade_set = {
        hex2rgba(ICE_HI)[:3], hex2rgba(ICE_MID)[:3],
        hex2rgba(PURE_WHT)[:3], hex2rgba(WHT_HI)[:3],
        hex2rgba(WHT_MID)[:3], hex2rgba(WHT_SH)[:3],
        hex2rgba(CHR_HI2)[:3],
    }
    green_set = {hex2rgba(GRN_HI)[:3], hex2rgba(GRN_MID)[:3], hex2rgba(GRN_SH)[:3]}
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

            if is_weap_nbr and any(rgb in blade_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_stl
            elif any(rgb in skin_set for rgb in rgb_list) and not any(rgb == hex2rgba(CHR_SH)[:3] for rgb in rgb_list):
                dst[x, y] = rgba_ink_skin if y < 40 else rgba_chr_mid
            elif is_top_left and any(rgb in green_set for rgb in rgb_list):
                dst[x, y] = rgba_grn_sh
            elif is_top_left and any(rgb in lit_white_set or rgb in gold_set for rgb in rgb_list):
                dst[x, y] = rgba_chr_mid
            elif is_top_left:
                dst[x, y] = rgba_chr_sh
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters
# ---------------------------------------------------------------------------

def draw_back_hair(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Long lustrous charcoal-black hair with cool slate sheen ridges & wispy tapered tips."""
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
            curve = -int(round(t * 1.5 + math.sin(t * 2.4) * 0.6))
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

    # Rich cool slate-charcoal base
    fill_rows(sp, rows, CHR_MID)

    # Sculpted lustrous slate highlight ribbons & deep charcoal strand grooves
    for y, (lx, rx) in rows.items():
        t = (y - top_y) / max(1, (bot_y - top_y))
        if lx + 3 <= rx:
            hspan(sp, y, lx, lx + 3, CHR_HI1)
        if t < 0.70 and lx + 2 <= rx:
            hspan(sp, y, lx + 1, lx + 2, CHR_HI2 if t < 0.46 else CHR_HI1)
        # Sinuous secondary lustrous hair strand ridge
        strand_x = lx + 6 + int(round(math.sin(t * 4.4) * 1.5))
        if lx + 2 < strand_x < rx - 2:
            hspan(sp, y, strand_x, strand_x + 1, CHR_HI1)
            if 0.16 < t < 0.54:
                sp.px(strand_x, y, CHR_HI2)
        # Deep shadow volume behind torso & skirt
        sh_x = max(lx + 4, cx - 6)
        if sh_x <= rx:
            hspan(sp, y, sh_x, rx, CHR_SH)
        # Crisp strand crevice groove
        gr_x = lx + 4 + int(round(math.sin(t * 3.8) * 1.1))
        if lx + 1 < gr_x < rx - 1:
            sp.px(gr_x, y, CHR_SH)

    # Sculpt 3 crisp tapered wispy charcoal lock tips at bottom
    base_lx, base_rx = rows.get(bot_y - 3, (cx - 17, cx - 5))
    for y in range(bot_y - 1, bot_y + 1):
        for x in range(base_lx, base_rx + 2):
            sp.px(x, y, None)

    locks = [
        (base_lx,      6, -1, True),
        (base_lx + 5,  7, -1, True),
        (base_lx + 10, 5,  0, False),
    ]
    for bx, length, dir_x, is_lit in locks:
        by = bot_y - 2
        for k in range(length):
            w = 3 if k < 2 else (2 if k < length - 2 else 1)
            px_x = bx + (dir_x * k) // 2
            if k < length - 2:
                col = CHR_HI1 if is_lit else CHR_MID
            elif k == length - 2:
                col = CHR_MID
            else:
                col = CHR_SH
            hspan(sp, by + k, px_x, px_x + w - 1, col)
            if is_lit and k < 3:
                sp.px(px_x, by + k, CHR_HI2)

    # Delicate fluttering charcoal hair wisp off outer-left curve in motion frames
    wisp_y = head_y + 24
    wisp_lx = rows.get(wisp_y, (cx - 15, cx))[0]
    if pose in ("idle2", "strike", "hurt"):
        for k in range(5):
            wx = wisp_lx - 1 - (k // 2)
            wy = wisp_y + k
            sp.px(wx, wy, CHR_HI2 if k < 2 else (CHR_HI1 if k < 4 else CHR_MID))
            if k < 3:
                sp.px(wx + 1, wy, CHR_HI1)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Crisp white knee socks + sleek dark-charcoal noble ankle boots locked to GROUND_Y."""
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
        sock_hi = WHT_MID if is_far else WHT_HI
        sock_mid = WHT_SH if is_far else WHT_MID
        sock_sh = CHR_HI2 if is_far else WHT_SH

        boot_hi = CHR_MID if is_far else CHR_HI1
        boot_mid = CHR_SH if is_far else CHR_MID
        boot_sh = INK_DARK if is_far else CHR_SH

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

        hspan(sp, foot_y, bx, bx + 5, INK_DARK)
        sp.px(bx + 2, foot_y, boot_sh)

    _draw_one_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_one_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_far_arm(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Far (left) puffed white noble sleeve with charcoal-gold band & delicate porcelain hand."""
    sp.layer("far_arm")
    sx, sy = cx + 5, torso_y + 2

    if pose == "strike":
        hx, hy = cx + 6, torso_y + 11
    elif pose == "windup":
        hx, hy = cx + 13, torso_y + 5
    elif pose == "hurt":
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
    ], WHT_MID, fill=True)
    sp.line(sx + 2, sy + 1, mid_x + 2, mid_y + 1, WHT_SH)
    sp.line(sx, sy + 1, mid_x, mid_y, WHT_HI)

    # Charcoal sleeve ribbon band with thin antique-gold stripe
    hspan(sp, mid_y + 1, mid_x - 1, mid_x + 2, CHR_SH)
    sp.px(mid_x + 1, mid_y + 1, GLD_SH)

    # Forearm bell-cuff
    sp.line(mid_x, mid_y + 2, hx, hy - 1, WHT_MID)
    sp.line(mid_x + 1, mid_y + 2, hx + 1, hy - 1, WHT_SH)

    # Delicate porcelain hand
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_SH1)
    sp.px(hx, hy - 1, SKIN_MID)


def draw_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Flared charcoal-black pleated noble skirt with subtle antique-gold hem & white petticoat."""
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
            if u < 0.13:
                col = CHR_HI1 if i > 1 else CHR_MID
            elif u > 0.85:
                col = INK_DARK
            elif pleat < 0.26:
                col = INK_DARK if u > 0.50 else CHR_SH
            elif pleat < 0.65:
                col = CHR_MID if u < 0.64 else CHR_SH
            else:
                col = CHR_HI1 if u < 0.58 else CHR_MID
            sp.px(x, y, col)

        if i == 0:
            hspan(sp, y, lx, rx, CHR_SH)

        # Subtle antique-gold embroidered hem stripe
        if i == skirt_h - 2:
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                pleat = (u * 4.6) % 1.0
                if pleat < 0.26 or u > 0.84:
                    gcol = GLD_SH
                elif u < 0.18 or (u < 0.48 and pleat > 0.56):
                    gcol = GLD_HI
                else:
                    gcol = GLD_MID
                sp.px(x, y, gcol)
        elif i == skirt_h:
            hspan(sp, y, lx, rx, INK_DARK)

    # Crisp white petticoat lace peeking below skirt hem
    y_lace = waist_y + skirt_h + 1
    lx_b = int(round(cx - 5 - flare_l + shift_bot)) + 2
    rx_b = int(round(cx + 5 + flare_r + shift_bot)) - 2
    for x in range(lx_b, rx_b + 1):
        u = (x - lx_b) / max(1, rx_b - lx_b)
        if (x - lx_b) % 4 == 3:
            sp.px(x, y_lace, WHT_SH)
        else:
            sp.px(x, y_lace, WHT_HI if u < 0.55 else WHT_MID)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """High-collar crisp white ruffled noble blouse, charcoal satin neck bow,
    refined gold-embroidered dark-charcoal open vest & corset waist with twin gold buttons + chain."""
    sp.layer("torso")

    # Porcelain neck with chin cast shadow
    for y in range(neck_y - 2, neck_y + 1):
        hspan(sp, y, cx - 1, cx + 2, SKIN_SH1)
        sp.px(cx - 1, y, SKIN_MID)
        sp.px(cx + 2, y, SKIN_SH2)
    hspan(sp, neck_y - 2, cx - 1, cx + 2, SKIN_SH2)

    # Crisp high-collar white blouse neckband
    hspan(sp, neck_y, cx - 3, cx + 3, PURE_WHT)
    sp.px(cx + 3, neck_y, WHT_MID)
    hspan(sp, neck_y + 1, cx - 3, cx + 4, WHT_HI)
    sp.px(cx + 3, neck_y + 1, WHT_MID)
    sp.px(cx + 4, neck_y + 1, WHT_SH)

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

    # Bright, clean white ruffled jabot blouse base (wide breathable white center V!)
    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, WHT_HI)
        if 5 <= dy <= 10:
            # Crisp sunlit white ruffle front + subtle soft fold shading (NOT noisy!)
            sp.px(cx, y, PURE_WHT if dy % 2 == 0 else WHT_HI)
            sp.px(cx + 1, y, WHT_HI if dy % 2 == 0 else WHT_MID)
            sp.px(cx + 2, y, WHT_MID if dy % 2 == 1 else WHT_HI)
            if dy in (7, 9):
                sp.px(cx + 1, y, WHT_SH)  # delicate tiny pearl-silver blouse button

    # Tailored dark-charcoal open vest with refined gold lapel trim + corset waist
    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        if dy <= 10:
            # Sweeping open V-vest opening revealing crisp white ruffled blouse!
            vl_r = cx - 3 if dy < 6 else (cx - 2 if dy < 9 else cx - 1)
            hspan(sp, y, cx + dl, vl_r, CHR_MID)
            sp.px(cx + dl, y, CHR_HI1 if dy < 8 else CHR_MID)
            # Clean continuous antique-gold lapel piping (smooth & aristocratic, never noisy!)
            sp.px(vl_r, y, GLD_HI if dy in (3, 5, 8) else GLD_MID)

            vr_l = cx + 4 if dy < 8 else cx + 3
            hspan(sp, y, vr_l, cx + dr, CHR_SH)
            sp.px(cx + dr, y, INK_DARK)
            sp.px(vr_l, y, GLD_MID if dy in (3, 5, 8) else GLD_SH)
        else:
            # High-waisted charcoal corset with twin champagne-gold buttons & draped chain
            hspan(sp, y, cx + dl, cx + dr, CHR_SH)
            hspan(sp, y, cx + dl, cx - 1, CHR_MID)
            sp.px(cx + dr, y, INK_DARK)
            if dy == 11:
                sp.px(cx - 1, y, GLD_HI)
                sp.px(cx + 2, y, GLD_HI)
            elif dy == 12:
                sp.px(cx, y, GLD_MID)
                sp.px(cx + 1, y, GLD_SH)

    # Crisp Sculpted Charcoal-Black Satin Neck Bow (unmistakable bow wings + twin neat tails!)
    by = neck_y + 2
    # Left lit wing
    hspan(sp, by, cx - 3, cx - 1, CHR_HI1)
    hspan(sp, by + 1, cx - 3, cx - 1, CHR_MID)
    sp.px(cx - 2, by, CHR_HI2)
    # Right shaded wing
    hspan(sp, by, cx + 2, cx + 4, CHR_MID)
    hspan(sp, by + 1, cx + 2, cx + 4, CHR_SH)
    # Center knot
    sp.px(cx, by, CHR_HI2)
    sp.px(cx + 1, by, CHR_MID)
    sp.px(cx, by + 1, CHR_MID)
    sp.px(cx + 1, by + 1, CHR_SH)
    # Clean symmetrical tapered tails resting atop upper white ruffles
    sp.px(cx, by + 2, CHR_HI1)
    sp.px(cx + 1, by + 2, CHR_SH)
    sp.px(cx - 1, by + 3, CHR_HI1)
    sp.px(cx, by + 3, CHR_MID)
    sp.px(cx + 1, by + 3, CHR_SH)
    sp.px(cx - 1, by + 4, CHR_MID)
    sp.px(cx + 1, by + 4, CHR_SH)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """3/4 anime head, warm porcelain skin, deep luminous emerald-green gemstone anime eyes,
    curved liquid-silk slate-charcoal hair crown & layered V-bangs, braided side lock & pinched emerald ribbon!"""
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

    # Subtle bang cast shadow dots on upper forehead (clear of eyebrows!)
    for x in (cx - 6, cx + 1, cx + 2, cx + 7):
        sp.px(x, head_y + 12, SKIN_SH1)

    # 2) RICH LUMINOUS EMERALD-GREEN GEMSTONE ANIME EYES (5x6 near eye, 4x6 far eye!)
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

        # --- NEAR EYE (5x6 deep rich emerald gemstone!) ---
        sp.px(lx0 - 1, ey + 1, INK_DARK)
        if determined:
            hspan(sp, ey, lx0, lx0 + 3, INK_DARK)
            sp.px(lx0 + 4, ey + 1, INK_DARK)
        else:
            hspan(sp, ey, lx0, lx0 + 4, INK_DARK)

        # Row +1: bright sclera + gleaming top-left PURE_WHT catchlight + deep emerald upper iris
        sp.px(lx0, ey + 1, WHT_MID if not determined else PURE_WHT)
        sp.px(lx0 + 1, ey + 1, PURE_WHT)
        sp.px(lx0 + 2, ey + 1, EYE_DARK)
        sp.px(lx0 + 3, ey + 1, EYE_DARK if not determined else INK_DARK)
        sp.px(lx0 + 4, ey + 1, EYE_DARK if not determined else INK_DARK)

        # Row +2: crisp white sclera + deep pupil + saturated emerald iris
        sp.px(lx0, ey + 2, PURE_WHT)
        sp.px(lx0 + 1, ey + 2, EYE_DARK)
        sp.px(lx0 + 2, ey + 2, INK_DARK)
        sp.px(lx0 + 3, ey + 2, EYE_MID)
        sp.px(lx0 + 4, ey + 2, EYE_DARK)

        # Row +3: saturated emerald-jade core (maximum green gemstone chroma!)
        sp.px(lx0, ey + 3, PURE_WHT)
        sp.px(lx0 + 1, ey + 3, EYE_MID)
        sp.px(lx0 + 2, ey + 3, EYE_MID)
        sp.px(lx0 + 3, ey + 3, EYE_MID)
        sp.px(lx0 + 4, ey + 3, EYE_DARK)

        # Row +4: luminous mint-emerald lower crescent (rich green glow without washing out!)
        sp.px(lx0, ey + 4, SKIN_MID)
        sp.px(lx0 + 1, ey + 4, EYE_MID)
        sp.px(lx0 + 2, ey + 4, EYE_HI)
        sp.px(lx0 + 3, ey + 4, EYE_HI)
        sp.px(lx0 + 4, ey + 4, EYE_MID)

        # Row +5: delicate warm rose-umber lower lid contour (NO dark cool bags under eyes!)
        hspan(sp, ey + 5, lx0 + 1, lx0 + 2, SKIN_SH2)
        sp.px(lx0 + 3, ey + 5, SKIN_SH1)

        # --- FAR EYE (4x6 3/4 perspective emerald gem!) ---
        if determined:
            hspan(sp, ey, rx0 + 1, rx0 + 3, INK_DARK)
            sp.px(rx0, ey + 1, INK_DARK)
        else:
            hspan(sp, ey, rx0, rx0 + 3, INK_DARK)
        sp.px(rx0 + 4, ey + 1, INK_DARK)

        sp.px(rx0, ey + 1, EYE_DARK if not determined else INK_DARK)
        sp.px(rx0 + 1, ey + 1, PURE_WHT)
        sp.px(rx0 + 2, ey + 1, EYE_DARK)
        sp.px(rx0 + 3, ey + 1, WHT_MID if not determined else PURE_WHT)

        sp.px(rx0, ey + 2, EYE_DARK)
        sp.px(rx0 + 1, ey + 2, INK_DARK)
        sp.px(rx0 + 2, ey + 2, EYE_MID)
        sp.px(rx0 + 3, ey + 2, PURE_WHT)

        sp.px(rx0, ey + 3, EYE_MID)
        sp.px(rx0 + 1, ey + 3, EYE_MID)
        sp.px(rx0 + 2, ey + 3, EYE_MID)
        sp.px(rx0 + 3, ey + 3, PURE_WHT)

        sp.px(rx0, ey + 4, EYE_MID)
        sp.px(rx0 + 1, ey + 4, EYE_HI)
        sp.px(rx0 + 2, ey + 4, EYE_HI)
        sp.px(rx0 + 3, ey + 4, SKIN_MID)

        sp.px(rx0, ey + 5, SKIN_SH1)
        hspan(sp, ey + 5, rx0 + 1, rx0 + 2, SKIN_SH2)

    # 3) Cute 2px rosy anime cheek blush
    hspan(sp, ey + 5, lx0 - 1, lx0, BLUSH)
    hspan(sp, ey + 5, rx0 + 2, rx0 + 3, BLUSH)

    # 4) Expressive composed anime mouth
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

    # 5) CURVED LIQUID-SILK SLATE-CHARCOAL HAIR CROWN & AIRY LAYERED V-BANGS!
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
    }
    for dy, (dl, dr) in crown_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, CHR_MID)

        # Soft top-left cool slate volume lighting along upper skull curve
        if 1 <= dy <= 4:
            hi_l = cx + max(dl + 1, -10)
            hi_r = cx + min(dr - 2, 4)
            if hi_r >= hi_l:
                hspan(sp, y, hi_l, hi_r, CHR_HI1)

        # Right-side shadow depth on crown
        if dr >= 8:
            hspan(sp, y, cx + dr - 2, cx + dr, CHR_SH)
            if dy >= 5:
                sp.px(cx + dr, y, INK_DARK)

    # Organic curved anime angel-ring sheen following skull curvature (NOT a flat bar!)
    # Arches higher in center (dy=4..5) and sweeps gently downward along left & right temples (dy=6..8)
    angel_ring = [
        # (dx, dy, color)
        (-11, 8, CHR_HI1), (-11, 7, CHR_HI2), (-10, 7, WHT_SH),  (-10, 6, CHR_HI2),
        (-9,  6, WHT_SH),  (-9,  5, CHR_HI1), (-8,  6, CHR_HI2), (-8,  5, CHR_HI2),
        (-7,  5, CHR_HI1),
        # Break notch at dx=-6 for silky hair lock separation!
        (-5,  5, CHR_HI2), (-5,  4, CHR_HI1), (-4,  5, WHT_SH),  (-4,  4, CHR_HI2),
        (-3,  5, CHR_HI2), (-3,  4, CHR_HI2), (-2,  5, CHR_HI1),
        # Break notch at dx=-1..0 around hair part!
        (1,   4, CHR_HI1), (2,   5, CHR_HI2), (2,   4, CHR_HI2), (3,   5, WHT_SH),
        (4,   5, CHR_HI2), (4,   6, CHR_HI1),
        # Break notch at dx=5!
        (6,   6, CHR_HI2), (7,   6, CHR_HI2), (7,   7, CHR_HI1), (8,   7, CHR_HI1),
    ]
    for adx, ady, acol in angel_ring:
        sp.px(cx + adx, head_y + ady, acol)

    # Soft natural top-center hair part (delicate 3px dip, NEVER a harsh slash)
    sp.px(cx, head_y + 1, CHR_SH)
    sp.px(cx, head_y + 2, CHR_SH)
    sp.px(cx + 1, head_y + 2, CHR_SH)
    sp.px(cx + 1, head_y + 3, CHR_SH)

    # Silky strand separation grooves sweeping smoothly downward into bangs
    for (sx, sy0, sy1, dx_step) in [
        (cx - 6, 7, 11, -0.30),
        (cx - 1, 7, 11, -0.15),
        (cx + 5, 7, 11,  0.28),
        (cx + 8, 8, 11,  0.20),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, CHR_SH)

    # Generous warm porcelain forehead arches directly above BOTH eyebrows!
    hspan(sp, head_y + 11, cx - 5, cx - 2, SKIN_MID)
    hspan(sp, head_y + 11, cx + 4, cx + 7, SKIN_MID)

    # Sculpted layered feathery V-bangs with crisp slate highlight rims (100% portrait-faithful!)
    # Central V-lock tapering gracefully down between her bright emerald eyes
    for dy, (dl, dr) in [
        (10, (-1, 3)), (11, (0, 3)), (12, (0, 3)),
        (13, (1, 3)), (14, (1, 2)), (15, (1, 2)), (16, (2, 2)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, CHR_MID if dy < 15 else CHR_SH)
        if dy <= 14:
            sp.px(cx + dl, head_y + dy, CHR_HI2 if dy <= 12 else CHR_HI1)
        if dy >= 13 and dr > dl:
            sp.px(cx + dr, head_y + dy, CHR_SH)

    # Left temple sweeping layered bang lock (cleanly framing left eye without crowding brow!)
    for dy, (dl, dr) in [(11, (-9, -6)), (12, (-9, -6)), (13, (-8, -6)), (14, (-8, -7)), (15, (-7, -7))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, CHR_MID)
        sp.px(cx + dl, head_y + dy, CHR_HI2 if dy <= 12 else CHR_HI1)
        if dy >= 13 and dr > dl:
            sp.px(cx + dr, head_y + dy, CHR_SH)

    # Far-right bang lock framing outer-right brow cleanly
    for dy, (dl, dr) in [(11, (8, 10)), (12, (8, 10)), (13, (9, 10)), (14, (9, 10))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, CHR_MID if dy <= 12 else CHR_SH)
        sp.px(cx + dr, head_y + dy, INK_DARK)

    # 6) CRISP, CLEANLY SEPARATED DELICATE DARK-CHARCOAL EYEBROWS (pure porcelain clearance!)
    brow_y = ey - 2
    if pose in ("windup", "strike"):
        sp.px(lx0 - 1, brow_y - 1, CHR_HI1)
        sp.px(lx0, brow_y - 1, CHR_MID)
        sp.px(lx0 + 1, brow_y, CHR_SH)
        sp.px(lx0 + 2, brow_y, CHR_SH)

        sp.px(rx0 + 1, brow_y, CHR_SH)
        sp.px(rx0 + 2, brow_y, CHR_SH)
        sp.px(rx0 + 3, brow_y - 1, CHR_MID)
    elif pose == "hurt":
        sp.px(lx0, brow_y + 1, CHR_MID)
        sp.px(lx0 + 1, brow_y, CHR_SH)
        sp.px(lx0 + 2, brow_y, CHR_MID)
        sp.px(rx0 + 1, brow_y, CHR_MID)
        sp.px(rx0 + 2, brow_y, CHR_SH)
        sp.px(rx0 + 3, brow_y + 1, CHR_MID)
    else:
        sp.px(lx0, brow_y, CHR_HI1)
        sp.px(lx0 + 1, brow_y, CHR_MID)
        sp.px(lx0 + 2, brow_y, CHR_MID)
        sp.px(rx0 + 1, brow_y, CHR_MID)
        sp.px(rx0 + 2, brow_y, CHR_MID)
        sp.px(rx0 + 3, brow_y, CHR_HI1)

    # 7) LONG FACE-FRAMING LAYERED CHARCOAL SIDE LOCKS (sleek portrait taper, ZERO chin-loop hook!)
    for i in range(23):
        y = head_y + 12 + i
        t = i / 22.0
        off = int(round(math.sin(t * 2.5) * 1.4)) + (1 if pose == "hurt" else 0)
        lx = cx - 13 + int(round(t * 2.6)) + off
        w = 5 if i < 7 else (4 if i < 13 else (3 if i < 18 else (2 if i < 21 else 1)))
        hspan(sp, y, lx, lx + w - 1, CHR_MID)
        sp.px(lx, y, CHR_HI1 if i < 17 else CHR_MID)
        if w >= 3:
            sp.px(lx + w - 1, y, CHR_SH)
        if i in (4, 5, 6, 11, 12, 13) and w >= 4:
            sp.px(lx + 1, y, CHR_HI2)

    # Far (right) graceful cheek lock tapering cleanly along cheek edge (stops neatly beside chin — NO awkward hook!)
    for i in range(15):
        y = head_y + 12 + i
        t = i / 14.0
        # Hugs gently along cheek curve and tapers sleekly straight down-inward to a fine 1px tip
        rx = cx + 9 + (1 if 2 <= i <= 7 else 0) - (1 if i >= 12 else 0)
        w = 3 if i < 5 else (2 if i < 11 else 1)
        hspan(sp, y, rx, rx + w - 1, CHR_SH if i > 4 else CHR_MID)
        if w >= 2:
            sp.px(rx + w - 1, y, INK_DARK)

    # 8) ICONIC WOVEN CHARCOAL SIDE BRAID + PINCHED EMERALD-FOREST SATIN BOW & TWIN TAILS!
    bx = cx - 12
    by = head_y + 12

    # Braided charcoal side lock swept back to the emerald satin bow
    for k in range(5):
        px_x = bx + k
        py_y = by + (1 if k % 2 else 0)
        sp.px(px_x, py_y - 1, CHR_HI2 if k % 2 == 0 else CHR_HI1)
        sp.px(px_x, py_y, CHR_HI1 if k % 2 == 0 else CHR_MID)
        sp.px(px_x, py_y + 1, CHR_SH)

    # Pinched emerald-forest satin butterfly bow (unmistakable bow silhouette!)
    # Upper flared satin loop curving outward-up
    hspan(sp, by - 2, bx - 3, bx - 2, GRN_HI)
    hspan(sp, by - 1, bx - 4, bx - 1, GRN_MID)
    sp.px(bx - 3, by - 1, GRN_HI)
    hspan(sp, by, bx - 3, bx - 1, GRN_MID)
    sp.px(bx - 1, by, GRN_SH)
    # Crisp pinched center ribbon knot (clean 1px V-indent, zero black ink bite!)
    sp.px(bx - 2, by + 1, GRN_SH)
    sp.px(bx - 1, by + 1, GRN_HI)
    sp.px(bx, by + 1, GRN_MID)
    sp.px(bx - 1, by + 2, GRN_SH)
    sp.px(bx, by + 2, GRN_SH)
    # Lower flared satin bow wing
    hspan(sp, by + 2, bx - 4, bx - 2, GRN_MID)
    sp.px(bx - 3, by + 2, GRN_HI)
    hspan(sp, by + 3, bx - 3, bx - 1, GRN_SH)
    sp.px(bx - 2, by + 3, GRN_MID)

    # Twin cleanly separated fluttering emerald satin ribbon tails!
    if pose == "strike":
        sway_curve = [0, -1, -2, -3, -4, -4, -5, -6]
    elif pose == "hurt":
        sway_curve = [0, 0, -1, -1, 0, 1, 1, 2]
    elif pose == "windup":
        sway_curve = [0, 0, 1, 1, 1, 2, 2, 2]
    elif pose == "idle2":
        sway_curve = [0, 0, -1, -1, -2, -2, -3, -3]
    else:
        sway_curve = [0, 0, -1, -1, -2, -2, -2, -3]

    # Outer longer sunlit emerald tail (2px wide tapering to 1px!)
    for k in range(8):
        ty = by + 4 + k
        tx = bx - 3 + sway_curve[k]
        if k < 6:
            sp.px(tx, ty, GRN_HI if k < 4 else GRN_MID)
            sp.px(tx + 1, ty, GRN_MID if k < 4 else GRN_SH)
        elif k == 6:
            sp.px(tx, ty, GRN_MID)
        else:
            sp.px(tx, ty, GRN_SH)

    # Inner slightly shorter deeper-emerald tail (distinct 1px gap showing twin tails!)
    for k in range(6):
        ty = by + 4 + k
        tx = bx + int(round(sway_curve[k] * 0.6))
        if k < 4:
            sp.px(tx, ty, GRN_MID if k < 2 else GRN_SH)
            sp.px(tx + 1, ty, GRN_SH)
        else:
            sp.px(tx, ty, GRN_SH)


def draw_near_arm_and_weapon(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Near (right) puffed white noble sleeve with charcoal & gold ribbon bow,
    plus Sylvia Disguise's sleek frost-tempered thin steel sword (覆水极薄冰锋)!"""
    sp.layer("near_arm")

    sh_x, sh_y = cx - 5, torso_y + 2

    if pose == "windup":
        # Raised cleanly up-back with generous open sky separating thin steel sword from emerald bow!
        el_x, el_y = cx - 11, torso_y + 5
        hx, hy = cx - 15, torso_y - 2
        tip_x, tip_y = hx - 9, hy - 22
    elif pose == "strike":
        # Razor-fast horizontal lunge thrust straight RIGHT with clean 1px right-edge safety buffer
        el_x, el_y = cx + 1, torso_y + 6
        hx, hy = cx + 8, torso_y + 5
        tip_x, tip_y = hx + 21, hy
    elif pose == "hurt":
        # Recoil defensive steel guard clear of cheek & hair
        el_x, el_y = cx - 7, torso_y + 9
        hx, hy = cx + 5, torso_y + 8
        tip_x, tip_y = hx + 18, hy - 6
    else:
        # Poised noble blade stance (white ruffled blouse & charcoal bow 100% unobstructed!)
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
    sp.line(sh_x + 1, sh_y + 1, el_x + 2, el_y, WHT_MID)
    sp.line(sh_x + 2, sh_y + 2, el_x + 3, el_y, WHT_SH)
    sp.line(sh_x - 2, sh_y + 2, el_x - 1, el_y, WHT_HI)

    # 2) Charcoal-Black Satin Sleeve Ribbon Band + Thin Antique-Gold Piping + Bow Tails
    rx0, ry0 = el_x - 2, el_y - 1
    rx1, ry1 = el_x + 3, el_y
    sp.rect(rx0, ry0, rx1, ry1, CHR_MID)
    sp.px(rx0, ry0, CHR_HI1)
    sp.px(rx1, ry1, INK_DARK)
    sp.px(rx0 + 1, ry0, GLD_HI)
    sp.px(rx0 + 2, ry0, GLD_MID)
    sp.px(rx0 + 3, ry0, GLD_SH)
    sp.px(rx0 - 1, ry1 + 1, CHR_HI1)
    sp.px(rx0, ry1 + 1, CHR_SH)
    sp.px(rx0 - 1, ry1 + 2, CHR_SH)

    # 3) Forearm white bell-cuff
    sp.polygon([
        (el_x - 1, el_y + 1),
        (el_x + 2, el_y),
        (hx, hy - 1),
        (hx - 1, hy + 2),
    ], WHT_HI, fill=True)
    sp.line(el_x + 1, el_y + 1, hx - 1, hy + 1, WHT_MID)
    sp.line(el_x, el_y + 2, hx - 1, hy + 2, WHT_SH)

    # 4) SLEEK FROST-TEMPERED THIN STEEL SWORD (覆水极薄冰锋 — weapon layer!)
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

    # Slim dark-charcoal wrapped grip + gleaming champagne-gold pommel jewel
    pom_x = int(round(hx - ux * 3.8))
    pom_y = int(round(hy - uy * 3.8))
    sp.line(pom_x, pom_y, hx, hy, CHR_MID)
    sp.px(pom_x, pom_y, GLD_HI)
    sp.px(int(round(hx - ux * 2.5)), int(round(hy - uy * 2.5)), GLD_MID)
    sp.px(int(round(hx - ux * 1.4)), int(round(hy - uy * 1.4)), CHR_SH)

    # Sleek noble silver-steel & antique-gold fencing crossguard (crisp gleaming contrast!)
    gx = int(round(hx + ux * 2.4))
    gy = int(round(hy + uy * 2.4))
    for s in (-2, -1, 0, 1, 2):
        cx_g = int(round(gx + nx_u * s))
        cy_g = int(round(gy + ny_u * s))
        if abs(s) == 2:
            col = PURE_WHT if s > 0 else WHT_SH
        elif abs(s) == 1:
            col = GLD_HI if s > 0 else GLD_MID
        else:
            col = PURE_WHT
        sp.px(cx_g, cy_g, col)
    # Gleaming frost-steel habaki/ferrule into blade
    sp.px(int(round(gx + ux * 1.1)), int(round(gy + uy * 1.1)), ICE_HI)

    # Bresenham spine for razor-thin frost-tempered steel blade (2px tapering to 1px needle!)
    bx0 = int(round(gx + ux * 1.7))
    by0 = int(round(gy + uy * 1.7))
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
        if t < 0.60:
            # Lower/back spine: cold forged blue-steel
            steel_col = WHT_SH if t < 0.34 else CHR_HI2
            # Upper/lit cutting edge: ultra-thin frost-tempered silver-cyan gleam!
            if 0.14 < t < 0.38 or 0.48 < t < 0.60:
                edge_col = PURE_WHT
            elif t < 0.14:
                edge_col = ICE_HI
            else:
                edge_col = ICE_HI
            sp.px(px_b, py_b, steel_col)
            sp.px(px_b + off_x, py_b + off_y, edge_col)
        else:
            # Razor-thin frost-glazed steel needle tip!
            if t > 0.84:
                tip_col = PURE_WHT
            elif t > 0.70:
                tip_col = ICE_HI
            else:
                tip_col = WHT_HI
            sp.px(px_b, py_b, tip_col)

    # 5) Porcelain hand firmly gripping sword hilt
    sp.layer("near_arm")
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)

    # 6) Sleek Frame-Specific Frost-Steel Gleam VFX (fx layer, razor-refined, ZERO dark outline!)
    sp.layer("fx")
    if pose == "windup":
        # Crisp 4-point silver-white & pale frost-cyan cold steel glint star at blade tip
        sx, sy = int(tip_x), int(tip_y)
        sp.px(sx, sy, PURE_WHT)
        for d in (1, 2, 3, 4):
            col = PURE_WHT if d == 1 else (ICE_HI if d == 2 else (ICE_MID if d == 3 else WHT_SH))
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
        # Subtle frost-sheen shimmer floating cleanly outside the razor-thin steel blade!
        mx_t = int(round((bx0 + tip_x) * 0.54))
        my_t = int(round((by0 + tip_y) * 0.54))
        sp.px(mx_t - 4, my_t + 1, PURE_WHT)
        sp.px(mx_t - 5, my_t + 1, ICE_HI)

    elif pose == "strike":
        # Razor-slender piercing silver-white & frost-cyan thrust gleam (max x=70, clean 1px right margin!)
        sx, sy = int(tip_x), int(tip_y)
        for k in range(-6, 5):
            px_s = min(W - 2, sx + k)
            col = PURE_WHT if -3 <= k <= 3 else ICE_HI
            sp.px(px_s, sy, col)
        for k in range(-7, 2):
            px_s = min(W - 2, sx + k)
            sp.px(px_s, sy - 1, ICE_HI if k >= -3 else ICE_MID)
            sp.px(px_s, sy + 1, ICE_HI if k >= -2 else ICE_MID)
        # Crisp slender vertical glint cross at piercing focal point
        sp.px(sx, sy - 2, PURE_WHT)
        sp.px(sx, sy + 2, PURE_WHT)
        sp.px(sx, sy - 3, ICE_HI)
        sp.px(sx, sy + 3, ICE_HI)
        sp.px(sx, sy - 4, ICE_MID)
        sp.px(sx, sy + 4, ICE_MID)
        # Sleek trailing speed-line frost glints
        sp.px(sx - 10, sy - 2, PURE_WHT)
        sp.px(sx - 9, sy - 2, ICE_HI)
        sp.px(sx - 12, sy + 2, ICE_HI)
        sp.px(sx - 11, sy + 2, ICE_MID)

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
        leg_cel = sp.frames[fi - 1].cels["legs"]
        ys = [y for y in range(H) for x in range(W) if leg_cel.getpixel((x, y))[3] > 0]
        assert max(ys) == GROUND_Y, f"Frame {fi} boot baseline {max(ys)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "sylvia_disguise",
        "file": "assets/sprites/sylvia_disguise_sheet.png",
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
        "buildScript": "tools/pixel_art/sylvia_disguise/build.py",
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
