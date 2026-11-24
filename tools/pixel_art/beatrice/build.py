#!/usr/bin/env python3
"""Flagship HD anime pixel-art combat sprite builder for Beatrice Vesteria 11yo (beatrice).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 72 x 80, 6 horizontal frames (432 x 80 sheet, padding=0).
Facing: left (Act 1 Rival standing on the right facing Sylvia).
GROUND_Y = 74, PIVOT_X = 38.

Pass 3 (Final Jewelry-Grade Polish):
- Natural follow-through animation on idle2 high side ponytail (zero top-edge crowding or ballooning)
- Ultra-clean sunny smile in idle1/idle2/blink (removed buck-tooth white dot) & fierce strike cry
- Roaring, filled, asymmetric blazing flame-wave slash smear in strike (replaced hollow anchor shape)
- Anatomically crisp raised puffed crimson-gold shoulder ('抬肩前摇') in windup with zero sleeve-hair cut
- High-contrast warm-bronze steel broadsword outline popping cleanly on BOTH Light Sky & Dark Dusk
- Gemstone-crisp ruby hair brooch & chest brooch, clean porcelain separation under sapphire eyes
- Clean separation of hurt defensive far hand from broadsword blade
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

SHEET_PATH = os.path.join(SPRITES_DIR, "beatrice_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "beatrice_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 27-Color Hue-Shifted Royal Crimson & Golden-Blonde Palette
# (All color pairs separated by >12 max-channel distance — zero near-dups!)
# ---------------------------------------------------------------------------
# Selective Inks (never harsh #000000!)
INK_DARK = "#241428"  # Deep warm plum-indigo ink (shadow outlines, lashes, > <)
INK_WARM = "#4c2236"  # Rich wine-plum mid outline (lit crimson, noble steel blade top selout)
INK_HAIR = "#6e3f18"  # Warm roasted-chestnut ink (lit golden hair selout & brows)
INK_SKIN = "#945754"  # Warm muted rose-umber jaw/hand outline & mouth accents

# Crisp Whites & Noble Steel
PURE_WHT = "#ffffff"  # Eye catchlights, ruby sparkle, flame hot core, blade gleam
WHT_HI   = "#eef0ff"  # Sunlit white jabot ruffles, sleeve cuffs, white stockings, blade bevel
WHT_SH   = "#c8cde3"  # Soft cool cloth fold shadow & mid blade steel
STL_SH   = "#7e89a8"  # Crisp cool slate-steel lower blade bevel & subtle eye lower-lid rim

# Warm Porcelain Skin & Blush (matching Sylvia Vesteria family DNA)
SKIN_HI  = "#fff1e6"  # Sunlit forehead/cheek highlight
SKIN_MID = "#fcdbca"  # Porcelain skin base
SKIN_SH1 = "#e3a994"  # Soft peach skin shadow
SKIN_SH2 = "#bd7c70"  # Chin/neck rose-umber shadow
BLUSH    = "#f592ab"  # Adorable rosy anime cheek blush & sunny smile interior

# Bright Golden-Blonde Wavy Hair & Ornate Gold Embroidery
HAIR_HI  = "#fff0b3"  # Luminous pale butter-gold angel-ring sheen & gold specular
HAIR_MID = "#f2c664"  # Bright golden-blonde hair base & royal gold embroidery
HAIR_SH1 = "#c98c38"  # Rich honey-amber hair shadow & burnished gold midtone
HAIR_SH2 = "#8c5820"  # Deep warm chestnut-gold crease, eyebrows & antique gold shadow

# Royal Crimson-Scarlet Dress, Ribbons & Ruby Brooches
RUBY_HI  = "#ff6474"  # Glowing ruby brooch highlight & bright crimson rim
CRM_HI   = "#dc2d43"  # Radiant scarlet-crimson highlight on sunlit pleats & bows
CRM_MID  = "#a81931"  # Royal crimson bodice, dress skirt, puffed sleeves & boots
CRM_SH1  = "#731026"  # Deep crimson-burgundy shadow
CRM_SH2  = "#450a1c"  # Deepest velvet wine-plum pleat shadow & boot sole

# Vivid Sapphire-Blue Energetic Anime Eyes
EYE_DARK = "#14389c"  # Deep royal cobalt upper iris
EYE_MID  = "#247ef5"  # Vivid sapphire mid iris
EYE_HI   = "#7cd4ff"  # Luminous sky-cerulean lower iris crescent

# Warm Flame-Aura Broadsword Sparks & Slash Smear
FLM_HI   = "#ffd147"  # Incandescent flame-gold inner aura
FLM_MID  = "#ff841f"  # Blazing flame-orange aura & sword fuller glow

PALETTE = [
    INK_DARK, INK_WARM, INK_HAIR, INK_SKIN,
    PURE_WHT, WHT_HI, WHT_SH, STL_SH,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, BLUSH,
    HAIR_HI, HAIR_MID, HAIR_SH1, HAIR_SH2,
    RUBY_HI, CRM_HI, CRM_MID, CRM_SH1, CRM_SH2,
    EYE_DARK, EYE_MID, EYE_HI,
    FLM_HI, FLM_MID,
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

    rgba_hair = hex2rgba(INK_HAIR)
    rgba_warm = hex2rgba(INK_WARM)
    rgba_dark = hex2rgba(INK_DARK)
    rgba_skin = hex2rgba(INK_SKIN)

    hair_lit_set = {hex2rgba(HAIR_HI)[:3], hex2rgba(HAIR_MID)[:3], hex2rgba(PURE_WHT)[:3]}
    hair_all_set = hair_lit_set | {hex2rgba(HAIR_SH1)[:3]}
    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3], hex2rgba(BLUSH)[:3]}
    crm_lit_set = {hex2rgba(RUBY_HI)[:3], hex2rgba(CRM_HI)[:3], hex2rgba(WHT_HI)[:3], hex2rgba(FLM_HI)[:3], hex2rgba(FLM_MID)[:3]}
    flame_set = {hex2rgba(FLM_HI)[:3], hex2rgba(FLM_MID)[:3], hex2rgba(HAIR_HI)[:3], hex2rgba(HAIR_MID)[:3]}

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

            if is_weap_nbr:
                # Crisp warm wine-bronze top-left selout on blade/guard -> pops sharply on BOTH Light Sky & Dark Dusk!
                if is_top_left and any(rgb in flame_set for rgb in rgb_list):
                    dst[x, y] = rgba_hair
                else:
                    dst[x, y] = rgba_warm if is_top_left else rgba_dark
            elif any(rgb in skin_set for rgb in rgb_list) and not any(rgb == hex2rgba(CRM_SH1)[:3] for rgb in rgb_list):
                dst[x, y] = rgba_skin if y < 40 else rgba_warm
            elif is_top_left and y < 50 and all(rgb in hair_all_set for rgb in rgb_list):
                dst[x, y] = rgba_hair
            elif is_top_left and any(rgb in hair_lit_set or rgb in crm_lit_set for rgb in rgb_list):
                dst[x, y] = rgba_warm
            else:
                dst[x, y] = rgba_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters (Facing LEFT!)
# ---------------------------------------------------------------------------

def draw_back_hair_and_ponytail(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Voluminous wavy golden-blonde back curls + proud high energetic side ponytail with natural follow-through!"""
    sp.layer("back_hair")

    # 1) Flowing wavy golden-blonde curls cascading behind her back
    rows = {}
    top_y = head_y + 11
    bot_y = head_y + 47

    for i in range(bot_y - top_y + 1):
        y = top_y + i
        t = i / max(1, (bot_y - top_y))

        if pose == "strike":
            wave = int(round(t * 9.5 + math.sin(t * 5.0) * 2.2))
        elif pose == "hurt":
            wave = int(round(t * 7.5 - math.sin(t * 4.4) * 2.3))
        elif pose == "windup":
            wave = int(round(-1.5 + t * 0.5 + math.sin(t * 4.2) * 0.8))
        else:
            wave = int(round(t * 4.0 + math.sin(t * 4.8) * 1.9)) - int(round(sway * t * 1.6))

        if t < 0.28:
            lx = cx - 8 + int(round(t * 6))
        elif t < 0.72:
            lx = cx - 6 + int(round((t - 0.28) * 11))
        else:
            lx = cx + 0 + int(round((t - 0.72) * 8)) + int(round(wave * 0.35))

        if t < 0.16:
            rx = cx + 11 + int(round(t * 6))
        elif t < 0.65:
            rx = cx + 12 + int(round((t - 0.16) * 7)) + wave
        else:
            rx = cx + 15 - int(round((t - 0.65) * 7)) + wave

        if pose == "windup":
            rx = min(rx, cx + 12)

        if rx >= lx:
            rows[y] = (lx, rx)

    fill_rows(sp, rows, HAIR_SH1)

    for y, (lx, rx) in rows.items():
        t = (y - top_y) / max(1, (bot_y - top_y))
        if lx + 2 <= rx and t < 0.55:
            hspan(sp, y, lx, lx + 2, HAIR_MID)
        ridge_x = rx - 4 - int(round(math.sin(t * 6.4) * 1.6))
        if lx + 1 < ridge_x < rx:
            hspan(sp, y, ridge_x - 1, min(rx - 1, ridge_x + 1), HAIR_MID)
            if 0.14 < t < 0.76:
                sp.px(ridge_x - 1, y, HAIR_HI)
        if rx - 2 >= lx:
            sp.px(rx - 1, y, HAIR_MID if t < 0.72 else HAIR_SH1)
            sp.px(rx, y, HAIR_SH2 if t > 0.20 else HAIR_SH1)
        sh_end = min(rx - 3, cx + 6)
        if lx <= sh_end:
            hspan(sp, y, lx, sh_end, HAIR_SH2)
        gr_x = rx - 6 + int(round(math.cos(t * 5.8) * 1.2))
        if lx + 1 < gr_x < rx - 1:
            sp.px(gr_x, y, HAIR_SH2)

    # Sculpt 3 bouncy curled golden lock tips at bottom!
    base_lx, base_rx = rows.get(bot_y - 3, (cx + 4, cx + 16))
    for y in range(bot_y - 1, bot_y + 1):
        for x in range(base_lx - 1, base_rx + 2):
            sp.px(x, y, None)

    locks = [
        (base_rx - 1, 6,  1, True),
        (base_rx - 6, 7,  1, True),
        (base_rx - 11, 5, 0, False),
    ]
    for bx, length, dir_x, is_lit in locks:
        by = bot_y - 2
        for k in range(length):
            w = 3 if k < 2 else (2 if k < length - 2 else 1)
            px_x = bx + (dir_x * k) // 2
            col = HAIR_MID if (is_lit and k < length - 2) else (HAIR_SH1 if k < length - 1 else HAIR_SH2)
            hspan(sp, by + k, px_x - w + 1, px_x, col)
            if is_lit and k < 3:
                sp.px(px_x - w + 1, by + k, HAIR_HI)

    # 2) PROUD HIGH ENERGETIC SIDE PONYTAIL
    tie_x = cx + 10
    tie_y = head_y + 6

    if pose == "windup":
        # Compact spirited high ponytail puff keeping wide 4px sky valley before raised broadsword!
        pony_spans = [
            (-4, 1, 5),
            (-3, 0, 7),
            (-2, 0, 8),
            (-1, 1, 9),
            ( 0, 2, 9),
            ( 1, 2, 9),
            ( 2, 3, 9),
            ( 3, 4, 9),
            ( 4, 5, 8),
            ( 5, 5, 8),
            ( 6, 6, 7),
        ]
    elif pose == "strike":
        # Flying dramatically backward-right with smooth continuous base (zero awkward pinch hole!)
        pony_spans = [
            (-4, 1, 6),
            (-3, 0, 9),
            (-2, 0, 12),
            (-1, 1, 14),
            ( 0, 1, 15),
            ( 1, 2, 16),
            ( 2, 3, 16),
            ( 3, 5, 16),
            ( 4, 7, 16),
            ( 5, 9, 15),
            ( 6, 10, 15),
            ( 7, 11, 14),
            ( 8, 12, 14),
            ( 9, 12, 13),
        ]
    elif pose == "hurt":
        # Tossed sharply upward & back from recoil!
        pony_spans = [
            (-5, 1, 6),
            (-4, 0, 8),
            (-3, 0, 10),
            (-2, 1, 11),
            (-1, 2, 12),
            ( 0, 3, 13),
            ( 1, 4, 13),
            ( 2, 5, 12),
            ( 3, 6, 12),
            ( 4, 7, 11),
            ( 5, 8, 11),
            ( 6, 8, 10),
            ( 7, 9, 10),
        ]
    else:
        # Radiant bouncy high side ponytail!
        # In idle2 (body bobs UP -1px), ponytail tip lags +1px DOWN for authentic overlapping follow-through!
        lag = 1 if pose == "idle2" else 0
        pony_spans = [
            (-4 + lag, 1, 6),
            (-3 + lag, 0, 9),
            (-2 + lag, 0, 11),
            (-1 + lag, 1, 12),
            ( 0 + lag, 2, 13),
            ( 1 + lag, 3, 13),
            ( 2 + lag, 4, 13),
            ( 3 + lag, 5, 13),
            ( 4 + lag, 6, 13),
            ( 5 + lag, 6, 12),
            ( 6 + lag, 7, 12),
            ( 7 + lag, 7, 11),
            ( 8 + lag, 7, 10),
            ( 9 + lag, 8, 10),
            (10 + lag, 8,  9),
        ]

    for idx_p, (dy_off, dx0, dx1) in enumerate(pony_spans):
        py = tie_y + dy_off
        px0 = tie_x + dx0
        px1 = min(W - 3, tie_x + dx1)
        if px1 < px0:
            continue
        hspan(sp, py, px0, px1, HAIR_MID)
        if idx_p <= 6 and px0 + 1 <= px1:
            hspan(sp, py, px0, min(px1 - 1, px0 + 3), HAIR_HI)
            if idx_p in (1, 2):
                sp.px(px0 + 2, py, PURE_WHT if idx_p == 2 else HAIR_HI)
        if px1 >= px0:
            sp.px(px1, py, HAIR_SH2 if idx_p >= 4 else HAIR_SH1)
        if idx_p >= 3 and px1 - 1 >= px0:
            sp.px(px1 - 1, py, HAIR_SH1)
        if idx_p >= 7 and px0 <= px1 - 1:
            sp.px(px0, py, HAIR_SH2)
        mid_g = (px0 + px1) // 2
        if 3 <= idx_p <= 10 and px0 + 1 < mid_g < px1 - 1:
            sp.px(mid_g, py, HAIR_SH1 if idx_p < 7 else HAIR_SH2)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Crisp white noble stockings + crimson-gold royal ankle boots (toes pointing LEFT, locked on GROUND_Y)."""
    sp.layer("legs")

    if pose == "strike":
        far_fx, far_fy = cx - 10, ground_y
        near_fx, near_fy = cx + 4, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2
    elif pose == "windup":
        far_fx, far_fy = cx - 8, ground_y
        near_fx, near_fy = cx + 2, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2
    elif pose == "hurt":
        far_fx, far_fy = cx - 9, ground_y - 1
        near_fx, near_fy = cx + 1, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 1
    else:
        far_fx, far_fy = cx - 7, ground_y
        near_fx, near_fy = cx + 1, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2

    hip_y = ground_y - 15

    def _draw_one_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        boot_top_y = foot_y - 6
        sock_mid = WHT_SH if is_far else WHT_HI
        sock_sh  = STL_SH if is_far else WHT_SH

        boot_hi  = CRM_MID if is_far else CRM_HI
        boot_mid = CRM_SH1 if is_far else CRM_MID
        boot_sh  = CRM_SH2 if is_far else CRM_SH1

        span_h = max(1, boot_top_y - hip_y)
        for y in range(hip_y, boot_top_y + 1):
            t = (y - hip_y) / span_h
            lx = int(round(top_x + (foot_x - top_x) * t))
            w = 4 if t < 0.42 else 3
            hspan(sp, y, lx, lx + w - 1, sock_mid)
            if not is_far:
                sp.px(lx, y, PURE_WHT if t > 0.30 else WHT_HI)
            else:
                sp.px(lx, y, WHT_HI if t > 0.48 else WHT_SH)
            sp.px(lx + w - 1, y, sock_sh)
            if y <= hip_y + 3:
                hspan(sp, y, lx, lx + w - 1, sock_sh)

        # Crimson-gold royal noble ankle boot pointing LEFT!
        bx = foot_x
        hspan(sp, boot_top_y, bx, bx + 3, boot_mid)
        sp.px(bx,     boot_top_y, HAIR_HI if not is_far else HAIR_MID)
        sp.px(bx + 1, boot_top_y, HAIR_MID if not is_far else HAIR_SH1)
        sp.px(bx + 2, boot_top_y, boot_hi)
        sp.px(bx + 3, boot_top_y, boot_sh)

        for y in range(boot_top_y + 1, foot_y - 2):
            hspan(sp, y, bx, bx + 3, boot_mid)
            sp.px(bx, y, boot_hi)
            sp.px(bx + 3, y, boot_sh)

        hspan(sp, foot_y - 2, bx - 1, bx + 3, boot_mid)
        sp.px(bx - 1, foot_y - 2, boot_hi)
        sp.px(bx,     foot_y - 2, boot_hi)
        sp.px(bx + 3, foot_y - 2, boot_sh)

        hspan(sp, foot_y - 1, bx - 2, bx + 3, boot_mid)
        hspan(sp, foot_y - 1, bx - 1, bx + 1, boot_hi)
        sp.px(bx - 2, foot_y - 1, RUBY_HI if not is_far else CRM_HI)
        sp.px(bx + 3, foot_y - 1, boot_sh)

        hspan(sp, foot_y, bx - 2, bx + 3, CRM_SH2)
        sp.px(bx, foot_y, boot_sh)

    _draw_one_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_one_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_far_arm(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Far (left) puffed crimson royal sleeve with gold filigree trim, white lace cuff & hand."""
    sp.layer("far_arm")
    sx, sy = cx - 5, torso_y + 2

    if pose == "strike":
        hx, hy = cx - 6, torso_y + 11
    elif pose == "windup":
        # Spirited challenger left balance hand pointing forward-LEFT toward Sylvia!
        hx, hy = cx - 13, torso_y + 5
    elif pose == "hurt":
        # Cleanly tucked slightly lower/inward so it never collides with angled broadsword blade!
        hx, hy = cx - 10, torso_y + 11
    else:
        hx, hy = cx - 10, torso_y + 10

    mid_x = (sx + hx) // 2
    mid_y = (sy + hy) // 2

    sp.polygon([
        (sx + 1, sy),
        (sx - 3, sy + 1),
        (mid_x - 2, mid_y + 1),
        (mid_x + 1, mid_y + 2),
        (sx + 1, sy + 4),
    ], CRM_MID, fill=True)
    sp.line(sx - 2, sy + 1, mid_x - 2, mid_y + 1, CRM_HI)
    sp.line(sx + 1, sy + 1, mid_x + 1, mid_y + 1, CRM_SH1)

    sp.px(sx - 2, sy + 1, HAIR_MID)
    hspan(sp, mid_y + 1, mid_x - 2, mid_x + 1, HAIR_MID)
    sp.px(mid_x - 2, mid_y + 1, HAIR_HI)
    sp.px(mid_x + 1, mid_y + 1, HAIR_SH2)

    hspan(sp, mid_y + 2, mid_x - 2, mid_x + 1, WHT_HI)
    sp.px(mid_x + 1, mid_y + 2, WHT_SH)

    sp.line(mid_x, mid_y + 2, hx, hy - 1, WHT_HI)
    sp.line(mid_x + 1, mid_y + 2, hx + 1, hy - 1, WHT_SH)

    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)


def draw_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Flared royal crimson pleated dress skirt with crisp double-line gold royal hem & white petticoat lace."""
    sp.layer("skirt")
    skirt_h = 13

    if pose == "strike":
        shift_bot = 3
        flare_l, flare_r = 11, 13
    elif pose == "hurt":
        shift_bot = -2
        flare_l, flare_r = 12, 10
    elif pose == "windup":
        shift_bot = 1
        flare_l, flare_r = 10, 11
    else:
        shift_bot = -sway
        flare_l, flare_r = 11, 11

    for i in range(skirt_h + 1):
        y = waist_y + i
        t = i / skirt_h
        e = t ** 0.85
        lx = int(round(cx - 5 - flare_l * e + shift_bot * t))
        rx = int(round(cx + 5 + flare_r * e + shift_bot * t))

        span = max(1, rx - lx)
        for x in range(lx, rx + 1):
            u = (x - lx) / span
            pleat = (u * 4.6) % 1.0
            if u < 0.14:
                col = CRM_HI if i > 1 else CRM_MID
            elif u > 0.85:
                col = CRM_SH2
            elif pleat < 0.25:
                col = CRM_SH2 if u > 0.52 else CRM_SH1
            elif pleat < 0.64:
                col = CRM_MID if u < 0.66 else CRM_SH1
            else:
                col = CRM_HI if u < 0.60 else CRM_MID
            sp.px(x, y, col)

        if i == 0:
            hspan(sp, y, lx, rx, CRM_SH2)

        # Crisp royal double gold-embroidered hem border
        if i == skirt_h - 4:
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                pleat = (u * 4.6) % 1.0
                if pleat < 0.24 or u > 0.84:
                    continue
                sp.px(x, y, HAIR_MID if u < 0.55 else HAIR_SH1)
        elif i == skirt_h - 2:
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                pleat = (u * 4.6) % 1.0
                if pleat < 0.24 or u > 0.84:
                    gcol = HAIR_SH2
                elif u < 0.22 or (u < 0.58 and pleat > 0.46):
                    gcol = HAIR_HI
                else:
                    gcol = HAIR_MID
                sp.px(x, y, gcol)
        elif i == skirt_h:
            hspan(sp, y, lx, rx, CRM_SH2)

    # Crisp white ruffled petticoat lace peeking under crimson hem!
    y_lace = waist_y + skirt_h + 1
    lx_b = int(round(cx - 5 - flare_l + shift_bot)) + 2
    rx_b = int(round(cx + 5 + flare_r + shift_bot)) - 2
    for x in range(lx_b, rx_b + 1):
        u = (x - lx_b) / max(1, rx_b - lx_b)
        if (x - lx_b) % 4 == 3:
            sp.px(x, y_lace, STL_SH if u > 0.7 else WHT_SH)
        else:
            sp.px(x, y_lace, PURE_WHT if u < 0.25 else (WHT_HI if u < 0.65 else WHT_SH))


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """High ruffled white collar, lush white jabot, royal crimson neck bow + gold-rimmed ruby brooch,
    gold-embroidered crimson bodice with V-lapels & diamond buttons, and ornate golden waist sash!"""
    sp.layer("torso")

    # 1) Delicate porcelain neck
    for y in range(neck_y - 2, neck_y + 1):
        hspan(sp, y, cx - 2, cx + 1, SKIN_SH1)
        sp.px(cx - 2, y, SKIN_MID)
        sp.px(cx + 1, y, SKIN_SH2)
    hspan(sp, neck_y - 2, cx - 2, cx + 1, SKIN_SH2)

    # 2) High white ruffled noble collar
    hspan(sp, neck_y, cx - 3, cx + 3, WHT_HI)
    sp.px(cx - 3, neck_y, PURE_WHT)
    sp.px(cx + 3, neck_y, WHT_SH)
    hspan(sp, neck_y + 1, cx - 4, cx + 3, WHT_HI)
    sp.px(cx - 4, neck_y + 1, PURE_WHT)
    sp.px(cx + 2, neck_y + 1, WHT_SH)
    sp.px(cx + 3, neck_y + 1, STL_SH)

    # 3) Royal tailored crimson bodice silhouette
    torso_shape = {
        2:  (-6, 6),
        3:  (-6, 6),
        4:  (-6, 6),
        5:  (-6, 5),
        6:  (-6, 5),
        7:  (-5, 5),
        8:  (-5, 5),
        9:  (-5, 4),
        10: (-4, 4),
        11: (-4, 4),
        12: (-5, 5),
        13: (-5, 5),
    }

    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, CRM_MID)
        sp.px(cx + dl, y, CRM_HI if dy < 9 else CRM_MID)
        if dy < 7:
            sp.px(cx + dl + 1, y, CRM_HI)
        sp.px(cx + dr, y, CRM_SH2 if dy >= 5 else CRM_SH1)
        sp.px(cx + dr - 1, y, CRM_SH1)

    # 4) Lush white ruffled jabot V-plastron + gleaming gold V-trim!
    jabot_v = {
        2: (-4, 3),
        3: (-4, 3),
        4: (-4, 2),
        5: (-3, 2),
        6: (-3, 1),
        7: (-2, 0),
        8: (-1, -1),
    }
    for dy, (jl, jr) in jabot_v.items():
        y = neck_y + dy
        hspan(sp, y, cx + jl, cx + jr, WHT_HI)
        if dy <= 6:
            sp.px(cx + jl, y, PURE_WHT if dy % 2 == 0 else WHT_HI)
        if jr > jl and dy % 2 == 1:
            sp.px(cx + jr, y, WHT_SH)
            if jr - jl >= 3:
                sp.px(cx + (jl + jr) // 2, y, WHT_SH)
        sp.px(cx + jl - 1, y, HAIR_HI if dy < 6 else HAIR_MID)
        sp.px(cx + jr + 1, y, HAIR_MID if dy < 6 else HAIR_SH1)

    # 5) Gold filigree center buttons down lower bodice
    sp.px(cx - 1, neck_y + 9, HAIR_HI)
    sp.px(cx - 1, neck_y + 10, HAIR_MID)
    for dy in (6, 8, 10):
        sp.px(cx - 4, neck_y + dy, HAIR_MID)
        sp.px(cx + 2, neck_y + dy, HAIR_SH1)

    # 6) Ornate Golden Royal Waist Sash & Central Filigree Buckle (dy = 11..13)
    for dy in (11, 12):
        y = neck_y + dy
        dl, dr = torso_shape[dy]
        hspan(sp, y, cx + dl, cx + dr, HAIR_MID if dy == 11 else HAIR_SH1)
        hspan(sp, y, cx + dl, cx - 2, HAIR_HI if dy == 11 else HAIR_MID)
        sp.px(cx + dr, y, HAIR_SH2)
        sp.px(cx + dr - 1, y, HAIR_SH2 if dy == 12 else HAIR_SH1)
    sp.px(cx - 1, neck_y + 11, PURE_WHT)
    sp.px(cx - 1, neck_y + 12, HAIR_HI)
    sp.px(cx - 1, neck_y + 13, HAIR_MID)
    sp.px(cx - 2, neck_y + 12, HAIR_HI)
    sp.px(cx,     neck_y + 12, HAIR_MID)

    # 7) Crisp Royal Crimson Neck Bow + Sparkling Gold-Rimmed Ruby Brooch!
    by = neck_y + 2
    hspan(sp, by,     cx - 4, cx - 2, CRM_HI)
    hspan(sp, by + 1, cx - 4, cx - 2, CRM_MID)
    hspan(sp, by,     cx + 1, cx + 3, CRM_MID)
    hspan(sp, by + 1, cx + 1, cx + 3, CRM_SH1)
    sp.px(cx - 2, by + 2, CRM_HI)
    sp.px(cx - 2, by + 3, CRM_MID)
    sp.px(cx + 1, by + 2, CRM_MID)
    sp.px(cx + 1, by + 3, CRM_SH1)

    # Gold-rimmed oval ruby brooch with rich faceted depth + golden pendant drop!
    sp.px(cx - 1, by,     HAIR_HI)
    sp.px(cx,     by,     HAIR_MID)
    sp.px(cx - 2, by + 1, HAIR_HI)
    sp.px(cx - 1, by + 1, PURE_WHT)
    sp.px(cx,     by + 1, RUBY_HI)
    sp.px(cx + 1, by + 1, HAIR_SH1)
    sp.px(cx - 1, by + 2, CRM_HI)
    sp.px(cx,     by + 2, CRM_SH1)
    sp.px(cx - 1, by + 3, HAIR_HI)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """3/4 anime head facing LEFT: porcelain skin, sparkling aligned 5x6/4x6 sapphire eyes,
    joyful sunny smiles & spirited battle expressions, rounded golden-blonde crown with angel-ring,
    organic curly cheek locks, and gemstone-crisp crimson ruby ponytail bow + ruby brooch!"""
    sp.layer("head")

    # 1) Soft tapered warm porcelain face silhouette
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
        if 15 <= dy <= 22:
            hspan(sp, y, cx + dl + 1, cx + 1, SKIN_HI)
        if 13 <= dy <= 24:
            sp.px(cx + dr, y, SKIN_SH1)
        if dy == 25:
            sp.px(cx + dl, y, SKIN_SH1)
            sp.px(cx + dr - 1, y, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)
        if dy == 26:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    for x in (cx - 7, cx - 2, cx - 1, cx + 5, cx + 6):
        sp.px(x, head_y + 13, SKIN_SH1)

    # 2) ALIGNED LUMINOUS GEMSTONE SAPPHIRE ANIME EYES (facing LEFT!)
    ey = head_y + 15
    lx0 = cx - 7  # far eye:  4x6 (cx-7 .. cx-4)
    rx0 = cx      # near eye: 5x6 (cx .. cx+4)

    if pose == "blink":
        # Cheerful happy-curved closed eyelashes!
        sp.px(lx0 - 1, ey + 2, INK_DARK)
        hspan(sp, ey + 3, lx0, lx0 + 3, INK_DARK)
        hspan(sp, ey + 4, lx0 + 1, lx0 + 2, SKIN_SH1)

        sp.px(rx0, ey + 2, INK_DARK)
        hspan(sp, ey + 3, rx0 + 1, rx0 + 4, INK_DARK)
        sp.px(rx0 + 5, ey + 2, INK_DARK)
        hspan(sp, ey + 4, rx0 + 2, rx0 + 3, SKIN_SH1)

    elif pose == "hurt":
        # Cute flustered > < scrunched eyes!
        sp.px(lx0, ey + 1, INK_DARK)
        sp.px(lx0 + 1, ey + 2, INK_DARK)
        sp.px(lx0 + 2, ey + 3, INK_DARK)
        sp.px(lx0 + 1, ey + 4, INK_DARK)
        sp.px(lx0, ey + 5, INK_DARK)

        sp.px(rx0 + 4, ey + 1, INK_DARK)
        sp.px(rx0 + 3, ey + 2, INK_DARK)
        sp.px(rx0 + 2, ey + 2, INK_DARK)
        sp.px(rx0 + 1, ey + 3, INK_DARK)
        sp.px(rx0 + 2, ey + 4, INK_DARK)
        sp.px(rx0 + 3, ey + 4, INK_DARK)
        sp.px(rx0 + 4, ey + 5, INK_DARK)

    else:
        determined = pose in ("windup", "strike")

        # --- FAR EYE (4x6 sapphire jewel, aligned LEFT!) ---
        sp.px(lx0 - 1, ey + 1, INK_DARK)
        if determined:
            hspan(sp, ey, lx0, lx0 + 2, INK_DARK)
            sp.px(lx0 + 3, ey + 1, INK_DARK)
        else:
            hspan(sp, ey, lx0, lx0 + 3, INK_DARK)

        sp.px(lx0,     ey + 1, WHT_SH if not determined else PURE_WHT)
        sp.px(lx0 + 1, ey + 1, PURE_WHT)    # primary top-left catchlight!
        sp.px(lx0 + 2, ey + 1, EYE_DARK)
        sp.px(lx0 + 3, ey + 1, EYE_DARK if not determined else INK_DARK)

        sp.px(lx0,     ey + 2, PURE_WHT)
        sp.px(lx0 + 1, ey + 2, EYE_DARK)
        sp.px(lx0 + 2, ey + 2, INK_DARK)    # crisp pupil
        sp.px(lx0 + 3, ey + 2, EYE_MID)

        sp.px(lx0,     ey + 3, PURE_WHT)
        sp.px(lx0 + 1, ey + 3, EYE_MID)
        sp.px(lx0 + 2, ey + 3, EYE_HI)
        sp.px(lx0 + 3, ey + 3, EYE_MID)

        sp.px(lx0,     ey + 4, SKIN_MID)
        sp.px(lx0 + 1, ey + 4, EYE_HI)
        sp.px(lx0 + 2, ey + 4, EYE_HI)
        sp.px(lx0 + 3, ey + 4, PURE_WHT)    # lower-right gem sparkle!

        hspan(sp, ey + 5, lx0 + 1, lx0 + 2, STL_SH)  # crisp 2px lower iris contour (clean gap before blush!)

        # --- NEAR EYE (5x6 crystalline sapphire jewel!) ---
        if determined:
            sp.px(rx0, ey + 1, INK_DARK)
            hspan(sp, ey, rx0 + 1, rx0 + 4, INK_DARK)
        else:
            hspan(sp, ey, rx0, rx0 + 4, INK_DARK)
        sp.px(rx0 + 5, ey + 1, INK_DARK)

        sp.px(rx0,     ey + 1, EYE_DARK if not determined else INK_DARK)
        sp.px(rx0 + 1, ey + 1, PURE_WHT)    # matching top-left catchlight!
        sp.px(rx0 + 2, ey + 1, EYE_DARK)
        sp.px(rx0 + 3, ey + 1, EYE_DARK)
        sp.px(rx0 + 4, ey + 1, WHT_SH if not determined else PURE_WHT)

        sp.px(rx0,     ey + 2, EYE_DARK)
        sp.px(rx0 + 1, ey + 2, EYE_MID)
        sp.px(rx0 + 2, ey + 2, INK_DARK)    # crisp pupil
        sp.px(rx0 + 3, ey + 2, EYE_DARK)
        sp.px(rx0 + 4, ey + 2, PURE_WHT)

        sp.px(rx0,     ey + 3, EYE_MID)
        sp.px(rx0 + 1, ey + 3, EYE_HI)
        sp.px(rx0 + 2, ey + 3, EYE_MID)
        sp.px(rx0 + 3, ey + 3, EYE_MID)
        sp.px(rx0 + 4, ey + 3, PURE_WHT)

        sp.px(rx0,     ey + 4, EYE_MID)
        sp.px(rx0 + 1, ey + 4, EYE_HI)
        sp.px(rx0 + 2, ey + 4, EYE_HI)
        sp.px(rx0 + 3, ey + 4, PURE_WHT)    # lower-right gem sparkle!
        sp.px(rx0 + 4, ey + 4, SKIN_MID)

        hspan(sp, ey + 5, rx0 + 1, rx0 + 3, STL_SH)  # crisp lower iris contour (clean gap before blush!)

    # 3) Clean rosy 2px anime cheek blush!
    hspan(sp, ey + 5, lx0 - 1, lx0, BLUSH)
    hspan(sp, ey + 5, rx0 + 4, rx0 + 5, BLUSH)

    # 4) Beatrice's Signature Radiant Anime Expressions (ultra-clean, zero artifacts!)
    my = head_y + 22
    mx = cx - 2
    if pose == "strike":
        # Fierce cute open battle shout!
        hspan(sp, my, mx - 1, mx, INK_SKIN)
        sp.px(mx - 1, my + 1, CRM_HI)
        sp.px(mx,     my + 1, BLUSH)
    elif pose == "hurt":
        # Adorable flustered wince
        sp.px(mx - 1, my + 1, INK_SKIN)
        sp.px(mx,     my,     INK_SKIN)
        sp.px(mx + 1, my + 1, INK_SKIN)
    elif pose == "windup":
        # Determined confident battle smirk (faithful to beatrice_young_serious.png!)
        sp.px(mx - 1, my, INK_SKIN)
        sp.px(mx,     my, INK_SKIN)
        sp.px(mx + 1, my - 1, SKIN_SH2)
    elif pose == "idle2":
        # Radiant playful wide sunny open smile (clean coral-pink interior, zero white split!)
        hspan(sp, my, mx - 1, mx + 1, INK_SKIN)
        hspan(sp, my + 1, mx - 1, mx + 1, BLUSH)
    else:
        # Confident joyful sunny smile (faithful to beatrice_young_normal.png!)
        hspan(sp, my, mx - 1, mx + 1, INK_SKIN)
        hspan(sp, my + 1, mx - 1, mx, BLUSH)
        sp.px(mx + 1, my + 1, SKIN_SH1)

    # 5) ROUNDED LUSH GOLDEN-BLONDE CROWN & BUTTER-GOLD ANGEL-RING SHEEN!
    crown_rows = {
        0:  (-3, 3),
        1:  (-6, 6),
        2:  (-8, 9),
        3:  (-9, 11),
        4:  (-10, 12),
        5:  (-11, 13),
        6:  (-11, 13),
        7:  (-11, 14),
        8:  (-11, 14),
        9:  (-11, 14),
        10: (-11, 14),
        11: (-10, 14),
        12: (-10, 14),
    }
    for dy, (dl, dr) in crown_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, HAIR_MID)

        if 1 <= dy <= 5:
            hi_l = cx + max(dl + 1, -8)
            hi_r = cx + min(dr - 3, 6)
            if hi_r >= hi_l:
                hspan(sp, y, hi_l, hi_r, HAIR_HI)

        if dy == 6:
            hspan(sp, y, cx - 8, cx - 4, HAIR_HI)
            hspan(sp, y, cx - 2, cx + 3, HAIR_HI)
            hspan(sp, y, cx + 5, cx + 9, HAIR_HI)
            sp.px(cx - 6, y, PURE_WHT)
            sp.px(cx + 0, y, PURE_WHT)
            sp.px(cx + 7, y, PURE_WHT)
        elif dy == 7:
            hspan(sp, y, cx - 8, cx - 5, HAIR_HI)
            hspan(sp, y, cx - 1, cx + 4, HAIR_HI)
            hspan(sp, y, cx + 7, cx + 10, HAIR_HI)
            sp.px(cx - 7, y, PURE_WHT)
            sp.px(cx + 2, y, PURE_WHT)
        elif dy == 8:
            hspan(sp, y, cx - 8, cx - 6, HAIR_HI)
            hspan(sp, y, cx + 2, cx + 5, HAIR_HI)
            sp.px(cx + 9, y, HAIR_HI)

        if dr >= 8:
            hspan(sp, y, cx + dr - 2, cx + dr, HAIR_SH1)
            if dy >= 5:
                sp.px(cx + dr, y, HAIR_SH2)

    part_x = cx - 1
    for dy in (1, 2, 3, 4):
        sp.px(part_x, head_y + dy, HAIR_SH1)
    sp.px(part_x, head_y + 2, HAIR_SH2)

    for (sx, sy0, sy1, dx_step) in [
        (cx - 7, 7, 12, -0.20),
        (cx - 4, 8, 12, -0.30),
        (cx + 1, 8, 12,  0.15),
        (cx + 6, 8, 12,  0.35),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, HAIR_SH1)

    for x in (cx - 6, cx - 5, cx + 2, cx + 3):
        sp.px(x, head_y + 12, SKIN_MID)

    # Sculpted feathery golden V-bangs
    for dy, (dl, dr) in [
        (11, (-3, 1)), (12, (-3, 0)), (13, (-3, 0)),
        (14, (-3, -1)), (15, (-2, -1)), (16, (-2, -1)), (17, (-2, -2)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy < 16 else HAIR_SH1)
        if dy <= 14:
            sp.px(cx + dl, head_y + dy, HAIR_HI)
        if dy >= 14 and dr > dl:
            sp.px(cx + dr, head_y + dy, HAIR_SH1)

    for dy, (dl, dr) in [(12, (4, 8)), (13, (5, 8)), (14, (6, 8)), (15, (6, 8)), (16, (7, 7))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID)
        sp.px(cx + dl, head_y + dy, HAIR_HI)
        if dy >= 14:
            sp.px(cx + dr, head_y + dy, HAIR_SH1)

    sp.px(cx + 3, head_y + 13, HAIR_MID)
    sp.px(cx + 3, head_y + 14, HAIR_SH1)

    for dy, (dl, dr) in [(12, (-10, -7)), (13, (-10, -8)), (14, (-10, -8)), (15, (-10, -9))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy <= 13 else HAIR_SH1)
        sp.px(cx + dl, head_y + dy, HAIR_HI if dy <= 13 else HAIR_MID)

    # 6) EXPRESSIVE GOLDEN-CHESTNUT EYEBROWS
    brow_y = ey - 2
    if pose in ("windup", "strike"):
        sp.px(lx0,     brow_y - 1, HAIR_SH2)
        sp.px(lx0 + 1, brow_y,     INK_HAIR)
        sp.px(lx0 + 2, brow_y,     INK_HAIR)

        sp.px(rx0 + 1, brow_y,     INK_HAIR)
        sp.px(rx0 + 2, brow_y,     INK_HAIR)
        sp.px(rx0 + 3, brow_y - 1, HAIR_SH2)
        sp.px(rx0 + 4, brow_y - 1, HAIR_SH2)
    elif pose == "hurt":
        sp.px(lx0,     brow_y + 1, HAIR_SH2)
        sp.px(lx0 + 1, brow_y,     INK_HAIR)
        sp.px(lx0 + 2, brow_y,     HAIR_SH2)

        sp.px(rx0 + 1, brow_y,     HAIR_SH2)
        sp.px(rx0 + 2, brow_y,     INK_HAIR)
        sp.px(rx0 + 3, brow_y + 1, HAIR_SH2)
    else:
        hspan(sp, brow_y, lx0, lx0 + 2, HAIR_SH2)
        hspan(sp, brow_y, rx0 + 1, rx0 + 3, HAIR_SH2)

    # 7) LUSH ORGANIC CURLED GOLDEN FACE-FRAMING FRONT LOCKS!
    # In windup, curves gently forward-inward above shoulder so lifted crimson-gold shoulder reads cleanly!
    lock_len = 16 if pose == "windup" else 23
    for i in range(lock_len):
        y = head_y + 13 + i
        t = i / max(1, lock_len - 1)
        if pose == "windup":
            rx = cx + 8 - int(round(t * 3.0))
        else:
            off = int(round(math.sin(t * 4.0) * 1.6)) - (1 if pose == "hurt" else 0)
            rx = cx + 9 - int(round(t * 2.2)) + off
        w = 5 if i < 6 else (4 if i < 11 else (3 if i < 15 else (2 if i < lock_len - 1 else 1)))
        hspan(sp, y, rx, rx + w - 1, HAIR_MID)
        sp.px(rx, y, HAIR_HI if i < 14 else HAIR_MID)
        if w >= 3:
            sp.px(rx + w - 1, y, HAIR_SH1)
        if w >= 4 and i in (4, 5, 10, 11):
            sp.px(rx + 1, y, HAIR_HI)

    # Far (left) softly curved cheek lock hugging cheek organically!
    for i in range(16):
        y = head_y + 12 + i
        t = i / 15.0
        lx = cx - 10 + int(round(t * 2.2)) - int(round(math.sin(t * 3.2) * 0.8))
        w = 3 if i < 6 else (2 if i < 13 else 1)
        hspan(sp, y, lx, lx + w - 1, HAIR_MID if i < 11 else HAIR_SH1)
        sp.px(lx, y, HAIR_HI if i < 8 else HAIR_MID)
        if w >= 2:
            sp.px(lx + w - 1, y, HAIR_SH1)

    # 8) JEWELRY-GRADE HIGH SIDE PONYTAIL RIBBON: CRIMSON BOW + FACETED GOLD-RIMMED RUBY BROOCH!
    bx = cx + 10
    by = head_y + 7

    # Sculpted winged crimson bow loops
    sp.px(bx + 2, by - 3, CRM_HI)
    hspan(sp, by - 2, bx + 1, bx + 4, CRM_HI)
    hspan(sp, by - 1, bx + 1, bx + 4, CRM_MID)
    hspan(sp, by + 1, bx + 1, bx + 4, CRM_MID)
    hspan(sp, by + 2, bx + 1, bx + 3, CRM_SH1)
    sp.px(bx + 1, by + 1, CRM_HI)
    sp.px(bx + 4, by + 1, CRM_SH2)

    # Fluttering gold-trimmed twin crimson ribbon tails!
    if pose == "strike":
        sway_curve = [0, 1, 2, 3, 4, 5, 5]
    elif pose == "hurt":
        sway_curve = [0, 1, 2, 2, 2, 1, 1]
    elif pose == "windup":
        sway_curve = [0, 0, -1, -1, -1, -1, -1]
    elif pose == "idle2":
        sway_curve = [0, 1, 1, 2, 2, 3, 3]
    else:
        sway_curve = [0, 0, 1, 1, 2, 2, 2]

    for k in range(7):
        ty = by + 3 + k
        tx = bx + 2 + sway_curve[k]
        sp.px(tx - 1, ty, CRM_HI if k < 3 else CRM_MID)
        sp.px(tx,     ty, CRM_SH1)
        sp.px(tx + 1, ty, CRM_MID if k < 5 else HAIR_MID)
    end_tx = bx + 2 + sway_curve[6]
    sp.px(end_tx - 1, by + 9, HAIR_HI)
    sp.px(end_tx,     by + 9, HAIR_MID)

    # Gemstone-crisp Gold-Rimmed Oval Ruby Brooch with deep facet contrast!
    sp.px(bx + 1, by - 2, HAIR_HI)
    sp.px(bx + 2, by - 2, HAIR_MID)
    sp.px(bx,     by - 1, HAIR_HI)
    sp.px(bx + 1, by - 1, PURE_WHT)    # bright top-left gem glint
    sp.px(bx + 2, by - 1, RUBY_HI)     # luminous ruby glow
    sp.px(bx + 3, by - 1, HAIR_MID)
    sp.px(bx,     by,     HAIR_MID)
    sp.px(bx + 1, by,     CRM_HI)      # rich crimson ruby body
    sp.px(bx + 2, by,     CRM_SH1)     # deep ruby lower-right facet!
    sp.px(bx + 3, by,     HAIR_SH1)
    sp.px(bx + 1, by + 1, HAIR_MID)
    sp.px(bx + 2, by + 1, HAIR_SH2)


def draw_near_arm_and_weapon(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Near (right) puffed crimson royal sleeve with ornate gold embroidery & white lace cuff,
    anatomically proud lifted shoulder ('抬肩前摇') in windup, plus Beatrice's gleaming flame-aura broadsword!"""
    sp.layer("near_arm")

    if pose == "windup":
        # CANON '抬肩前摇': proud puffed crimson-gold shoulder clearly lifted cleanly below chin/curl,
        # sweeping smoothly UP-RIGHT to her poised hand & skyward blazing flame broadsword!
        sh_x, sh_y = cx + 6, torso_y + 0
        el_x, el_y = cx + 12, torso_y + 1
        hx, hy = cx + 17, torso_y - 5
        tip_x, tip_y = hx + 9, hy - 22    # x = 66, y = 8 -> clean 4px sky gap from ponytail!
    elif pose == "strike":
        # Fierce royal broadsword lunge slash straight LEFT!
        sh_x, sh_y = cx + 5, torso_y + 2
        el_x, el_y = cx - 1, torso_y + 6
        hx, hy = cx - 8, torso_y + 5
        tip_x, tip_y = hx - 19, hy - 1    # tip_x = 7, room for roaring flame-wave slash smear!
    elif pose == "hurt":
        sh_x, sh_y = cx + 5, torso_y + 2
        el_x, el_y = cx + 7, torso_y + 9
        hx, hy = cx - 4, torso_y + 8
        tip_x, tip_y = hx - 18, hy - 6
    else:
        # Poised confident noble swordswoman stance
        sh_x, sh_y = cx + 5, torso_y + 2
        el_x, el_y = cx + 8, torso_y + 9
        hx, hy = cx - 1, torso_y + 11
        tip_x, tip_y = hx - 25, hy + 3

    # 1) Generous puffed royal crimson upper sleeve with gleaming gold shoulder piping!
    if pose == "windup":
        # Full, rounded lifted royal shoulder puff angled cleanly UP-RIGHT (zero awkward thin V-kink!)
        sp.polygon([
            (sh_x - 2, sh_y - 1),
            (sh_x + 3, sh_y - 2),
            (el_x + 2, el_y - 1),
            (el_x + 2, el_y + 3),
            (sh_x - 1, sh_y + 4),
        ], CRM_MID, fill=True)
        sp.line(sh_x - 1, sh_y,     el_x + 1, el_y - 1, CRM_HI)
        sp.line(sh_x,     sh_y + 1, el_x + 1, el_y,     CRM_HI)
        sp.line(sh_x,     sh_y + 3, el_x + 2, el_y + 2, CRM_SH1)
        sp.line(sh_x - 1, sh_y + 4, el_x + 1, el_y + 3, CRM_SH2)
        # Gleaming lifted gold shoulder epaulette arc (spotlights canon 抬肩前摇!)
        sp.px(sh_x - 2, sh_y - 1, HAIR_HI)
        sp.px(sh_x - 1, sh_y - 1, PURE_WHT)
        sp.px(sh_x,     sh_y - 2, HAIR_HI)
        sp.px(sh_x + 1, sh_y - 2, HAIR_MID)
        sp.px(sh_x + 2, sh_y - 2, HAIR_MID)
        sp.px(sh_x + 3, sh_y - 2, HAIR_SH1)
    else:
        sp.polygon([
            (sh_x - 2, sh_y),
            (sh_x + 3, sh_y),
            (sh_x + 4, sh_y + 4),
            (el_x + 2, el_y + 1),
            (el_x - 3, el_y),
        ], CRM_MID, fill=True)
        sp.line(sh_x - 2, sh_y + 1, el_x - 2, el_y, CRM_HI)
        sp.line(sh_x - 1, sh_y + 1, el_x - 1, el_y, CRM_HI)
        sp.line(sh_x + 3, sh_y + 1, el_x + 2, el_y, CRM_SH1)
        sp.line(sh_x + 4, sh_y + 4, el_x + 2, el_y + 1, CRM_SH2)

        sp.px(sh_x - 2, sh_y, HAIR_HI)
        sp.px(sh_x - 1, sh_y, HAIR_HI)
        sp.px(sh_x,     sh_y, HAIR_MID)
        sp.px(sh_x + 1, sh_y, HAIR_MID)
        sp.px(sh_x + 2, sh_y, HAIR_SH1)

    # 2) Ornate Gold Filigree Sleeve Band + Crisp White Ruffled Lace Cuff!
    if pose == "windup":
        sp.rect(el_x - 1, el_y - 1, el_x + 2, el_y + 2, HAIR_MID)
        sp.px(el_x - 1, el_y - 1, HAIR_HI)
        sp.px(el_x,     el_y - 1, PURE_WHT)
        sp.px(el_x + 2, el_y + 2, HAIR_SH2)
        sp.line(el_x + 2, el_y - 1, el_x + 3, el_y + 1, WHT_HI)
        sp.px(el_x + 3, el_y + 2, WHT_SH)
        # Smooth upward-reaching forearm to hand
        sp.polygon([
            (el_x + 1, el_y - 1),
            (el_x + 3, el_y + 1),
            (hx + 1,   hy + 1),
            (hx - 1,   hy),
        ], CRM_MID, fill=True)
        sp.line(el_x + 1, el_y - 1, hx - 1, hy, CRM_HI)
        sp.line(el_x + 3, el_y + 1, hx + 1, hy + 1, CRM_SH1)
        sp.px(hx - 1, hy + 1, WHT_HI)
        sp.px(hx,     hy + 2, WHT_SH)
    else:
        rx0, ry0 = el_x - 3, el_y - 1
        rx1, ry1 = el_x + 2, el_y
        sp.rect(rx0, ry0, rx1, ry1, HAIR_MID)
        sp.px(rx0, ry0, HAIR_HI)
        sp.px(rx0 + 1, ry0, PURE_WHT)
        sp.px(rx1, ry1, HAIR_SH2)
        sp.px(rx1 - 1, ry1, HAIR_SH1)
        hspan(sp, ry1 + 1, rx0, rx1, WHT_HI)
        sp.px(rx0, ry1 + 1, PURE_WHT)
        sp.px(rx1, ry1 + 1, WHT_SH)

        sp.polygon([
            (el_x - 2, el_y + 1),
            (el_x + 1, el_y + 1),
            (hx + 1, hy + 1),
            (hx, hy - 1),
        ], CRM_MID, fill=True)
        sp.line(el_x - 1, el_y + 1, hx, hy - 1, CRM_HI)
        sp.line(el_x + 1, el_y + 1, hx + 1, hy + 1, CRM_SH1)
        sp.px(hx + 1, hy - 1, WHT_HI)
        sp.px(hx + 1, hy, WHT_SH)

    # 4) GLEAMING NOBLE FLAME-AURA BROADSWORD (weapon layer!)
    sp.layer("weapon")

    dx = tip_x - hx
    dy = tip_y - hy
    length = max(1.0, math.hypot(dx, dy))
    ux, uy = dx / length, dy / length

    nx_u, ny_u = -uy, ux
    if nx_u + ny_u > 0:
        nx_u, ny_u = -nx_u, -ny_u

    if abs(dx) >= abs(dy):
        lit_ox, lit_oy = 0, -1
        sh_ox, sh_oy = 0, 1
    else:
        lit_ox, lit_oy = -1, 0
        sh_ox, sh_oy = 1, 0

    # Ornate Royal Gold Diamond Pommel & Crimson-Wrapped Grip
    pom_x = int(round(hx - ux * 4.2))
    pom_y = int(round(hy - uy * 4.2))
    sp.line(pom_x, pom_y, hx, hy, CRM_MID)
    sp.px(int(round(hx - ux * 2.0)), int(round(hy - uy * 2.0)), CRM_SH1)
    sp.px(pom_x, pom_y, HAIR_HI)
    sp.px(pom_x + lit_ox, pom_y + lit_oy, PURE_WHT)
    sp.px(pom_x + sh_ox, pom_y + sh_oy, HAIR_SH1)

    # Swept Noble Winged Gold Crossguard with Glowing Ruby Core!
    gx = int(round(hx + ux * 3.2))
    gy = int(round(hy + uy * 3.2))
    for s in (-4, -3, -2, -1, 0, 1, 2, 3, 4):
        fwd = 1.2 if abs(s) >= 3 else (0.4 if abs(s) == 2 else 0.0)
        cx_g = int(round(gx + nx_u * s + ux * fwd))
        cy_g = int(round(gy + ny_u * s + uy * fwd))
        if abs(s) == 4:
            col = PURE_WHT if s > 0 else HAIR_SH2
        elif abs(s) == 3:
            col = HAIR_HI if s > 0 else HAIR_SH2
        elif abs(s) == 2:
            col = HAIR_HI if s > 0 else HAIR_SH1
        elif abs(s) == 1:
            col = HAIR_MID
        else:
            col = RUBY_HI
        sp.px(cx_g, cy_g, col)
    sp.px(gx, gy, RUBY_HI)
    sp.px(int(round(gx + ux * 1.1)), int(round(gy + uy * 1.1)), HAIR_HI)
    sp.px(int(round(gx + ux * 1.1 + lit_ox)), int(round(gy + uy * 1.1 + lit_oy)), PURE_WHT)
    sp.px(int(round(gx + ux * 1.1 + sh_ox)), int(round(gy + uy * 1.1 + sh_oy)), HAIR_SH1)

    # Bresenham spine for gleaming 3px -> 2px -> 1px razor-tapered noble flame-aura broadsword!
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
    is_energized = pose in ("windup", "strike")
    for i, (px_b, py_b) in enumerate(spine):
        t = i / n_pts
        if t < 0.68:
            if is_energized:
                lit_col = PURE_WHT if (0.08 < t < 0.48 or t > 0.56) else FLM_HI
                mid_col = FLM_HI if t < 0.38 else FLM_MID
                sh_col  = WHT_SH if t < 0.34 else STL_SH
            else:
                lit_col = PURE_WHT if (0.14 < t < 0.42 or 0.54 < t < 0.66) else WHT_HI
                mid_col = FLM_HI if t < 0.30 else (HAIR_HI if t < 0.52 else WHT_HI)
                sh_col  = WHT_SH if t < 0.28 else STL_SH
            sp.px(px_b + lit_ox, py_b + lit_oy, lit_col)
            sp.px(px_b, py_b, mid_col)
            sp.px(px_b + sh_ox, py_b + sh_oy, sh_col)
        elif t < 0.86:
            sp.px(px_b + lit_ox, py_b + lit_oy, PURE_WHT)
            sp.px(px_b, py_b, FLM_HI if is_energized else WHT_SH)
        else:
            sp.px(px_b, py_b, PURE_WHT if t > 0.92 else (FLM_HI if is_energized else WHT_HI))

    # 5) Porcelain hand firmly gripping the royal hilt
    sp.layer("near_arm")
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)

    # 6) CRISP WARM FLAME-GOLD & CRIMSON MAGIC VFX (fx layer — ZERO dark outline, ZERO isolated px!)
    sp.layer("fx")
    if pose == "windup":
        # Radiant 4-point warm flame-gold starburst at raised broadsword tip!
        sx, sy = int(tip_x), int(tip_y)
        sp.px(sx, sy, PURE_WHT)
        for d in (1, 2, 3, 4):
            col = PURE_WHT if d == 1 else (FLM_HI if d == 2 else (FLM_MID if d == 3 else CRM_HI))
            if sx + d < W - 1:
                sp.px(sx + d, sy, col)
            if sx - d > 0:
                sp.px(sx - d, sy, col)
            if sy + d < H - 1:
                sp.px(sx, sy + d, col)
            if sy - d > 0:
                sp.px(sx, sy - d, col)
        for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            sp.px(sx + ddx, sy + ddy, FLM_HI)
        # Connected licking flame wisps orbiting raised broadsword in open sky!
        mx_t = int(round((bx0 + tip_x) * 0.50))
        my_t = int(round((by0 + tip_y) * 0.50))
        sp.px(mx_t - 3, my_t + 1, PURE_WHT)
        sp.px(mx_t - 3, my_t,     FLM_HI)
        sp.px(mx_t - 4, my_t,     FLM_MID)
        sp.px(mx_t - 4, my_t - 1, CRM_HI)
        if mx_t + 4 < W - 1:
            sp.px(mx_t + 3, my_t - 2, FLM_HI)
            sp.px(mx_t + 3, my_t - 3, FLM_MID)
            sp.px(mx_t + 4, my_t - 3, CRM_HI)

    elif pose == "strike":
        # ROARING ORGANIC GOLDEN-CRIMSON ANIME FLAME-SLASH WAVE (sweeping fiery tongues, zero spade/anchor stiffness!)
        sx, sy = int(tip_x), int(tip_y)

        # Asymmetric roaring flame-wave: incandescent lance nose leading LEFT (max x>=2),
        # peeling backward into lively upper & lower sweeping fire-tongues wrapping over the broadsword!
        flame_rows = [
            (-6,  8, 13, None, None),
            (-5,  4, 11,  5,  7),
            (-4,  1, 13,  2,  6),
            (-3, -1, 10,  0,  5),
            (-2, -3, 12, -2,  4),
            (-1, -4, 10, -3,  5),
            ( 0, -5, 11, -4,  5),
            ( 1, -4,  9, -3,  4),
            ( 2, -2, 11, -1,  3),
            ( 3,  0,  8,  1,  3),
            ( 4,  3, 10,  4,  6),
            ( 5,  7, 11, None, None),
        ]
        for dy_f, rx0, rx1, cx0, cx1 in flame_rows:
            fy = sy + dy_f
            x_start = max(1, sx + rx0)
            x_end = sx + rx1
            for fx in range(x_start, x_end + 1):
                # Trailing wispy flame tongues & outer crest in blazing crimson-orange
                if abs(dy_f) >= 5 or fx >= x_end - 1:
                    col = CRM_HI if (fx == x_end or abs(dy_f) >= 5) else FLM_MID
                elif fx == x_start and abs(dy_f) >= 3:
                    col = FLM_HI
                elif cx0 is not None and (sx + cx0) <= fx <= (sx + cx1):
                    # White-hot incandescent flame heart right along the blade impact edge!
                    if abs(dy_f) <= 1 and (sx + cx0) <= fx <= (sx + cx1 - 1):
                        col = PURE_WHT
                    elif abs(dy_f) == 2 and fx == sx + cx0:
                        col = PURE_WHT
                    else:
                        col = FLM_HI
                else:
                    col = FLM_MID
                sp.px(fx, fy, col)

        # Sweeping 4-connected trailing ember ribbons curling smoothly back off the upper & lower flame tongues!
        sp.px(sx + 13, sy - 6, FLM_MID)
        sp.px(sx + 14, sy - 6, CRM_HI)
        sp.px(sx + 14, sy - 4, FLM_MID)
        sp.px(sx + 15, sy - 4, CRM_HI)

        sp.px(sx + 12, sy + 2, FLM_MID)
        sp.px(sx + 13, sy + 2, CRM_HI)
        sp.px(sx + 11, sy + 4, FLM_MID)
        sp.px(sx + 12, sy + 4, CRM_HI)

    return tip_x, tip_y


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    ("idle1",   0,   0,   0, 260),
    ("idle2",   0,  -1,  -1, 260),
    ("blink",   0,   0,   0, 140),
    ("windup",  2,   1,  -1, 180),
    ("strike", -4,   0,  -2, 160),
    ("hurt",    3,   1,   2, 220),
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
        head_y = 6 + bob
        neck_y = head_y + 28
        torso_y = neck_y + 1
        waist_y = neck_y + 13

        draw_back_hair_and_ponytail(sp, cx, head_y, pose, sway)
        draw_far_arm(sp, cx, torso_y, pose)
        draw_legs_boots(sp, cx, GROUND_Y, pose)
        draw_skirt(sp, cx, waist_y, pose, sway)
        draw_torso(sp, cx, neck_y, pose)
        draw_head(sp, cx, head_y, pose, sway)
        tip_x, tip_y = draw_near_arm_and_weapon(sp, cx, torso_y, pose)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx - 1, head_y + 16)
            anchors["hit_px"] = (cx - 1, torso_y + 9)
        if pose == "strike":
            anchors["cast_px"] = (max(2, tip_x - 4), tip_y)

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
        ("3x Light Sky #DCE7F6 (Red=Foot Anchor, Orange=Cast Anchor)", (220, 231, 246), 0),
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
                draw.ellipse([cx_m - 3, cy_m - 3, cx_m + 3, cy_m + 3], fill=(255, 165, 35), outline=(90, 20, 16))

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
    x0, y0, x1, y1 = 18, 1, 64, 42
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
        "id": "beatrice",
        "file": "assets/sprites/beatrice_sheet.png",
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
        "buildScript": "tools/pixel_art/beatrice/build.py",
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
