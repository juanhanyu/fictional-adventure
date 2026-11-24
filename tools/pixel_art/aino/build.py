#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Aino Talvi (aino) — Act 4 Ice Mage Rival.

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 72 x 80, 6 horizontal frames (432 x 80 sheet, padding=0).
Facing: left. GROUND_Y = 74, PIVOT_X = 39.

Pass 3 (Final Jewelry Polish):
- Luminous symmetrical half-lidded pale glacier-blue eyes: balanced upper sclera depth,
  matching top-left pure-white catchlights, glowing icy-white lower crescents & soft silver lower lid
- Clean forehead above brows across all 6 frames (removed stray brow-touch pixel) + centered hurt > <
- High-contrast 5x5 glittering silver snowflake hairpin with soft upper-temple INK_MID selout
  and silky split-tail dark-navy ribbons revealing a sliver of silver hair between tails
- Razor-clean levitating geometric mirror-ice hexagon silhouette (idle1 calm gleam -> idle2
  1px lift + radiant peak-breath sparkle), separated dual-prism windup (zero barbell stick!),
  and needle-sharp 3-shard glacial lance strike with 2px left-margin safety buffer
- Butter-smooth tapered straight silver back-hair tips kissing the curved silver-trimmed coat hem
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
PIVOT_X = 39

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "aino_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "aino_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 22-Color Hue-Shifted Northern Ice-Mage Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
PURE_WHT = "#ffffff"  # Eye catchlights, pure sclera, snowflake sparkle core, bright ice edge
HAIR_HI  = "#ecf2ff"  # Sunlit icy silver-white hair crown, crisp shirt collar, bright platinum trim
HAIR_MID = "#ced8ee"  # Straight icy silver-white hair base & cool silver shirt midtone
HAIR_SH1 = "#98a6c7"  # Cool lilac-slate hair shadow, soft lower lash & metallic silver embroidery
HAIR_SH2 = "#67769c"  # Deep cool slate-indigo hair shadow, pale brows & top-lit hair selout

INK_DARK = "#0b1022"  # Deep northern nocturnal ink, shadow outlines, upper lashes, boot sole
INK_MID  = "#3b4668"  # Mid cool slate-indigo outline for mid-lit coat/limbs/hair/hairpin
INK_ICE  = "#1a4f96"  # Deep sapphire-glacier outline for crystalline mirror-ice prisms & shards

SKIN_HI  = "#fff4f0"  # Pale northern alabaster forehead/cheek highlight
SKIN_MID = "#fae0d6"  # Cool porcelain skin base
SKIN_SH1 = "#dfb0a6"  # Soft cool rose-peach skin shadow
SKIN_SH2 = "#b57d7b"  # Cool mauve-umber chin/neck shadow & composed lips
INK_SKIN = "#84515b"  # Delicate muted rose-plum selective outline for jaw & hands
BLUSH    = "#f2a2b6"  # Refined pale-rose aristocratic cheek blush

NVY_EDGE = "#4f6ca8"  # Cool steel-cobalt rim light on mantle lapels, ribbons & boot shine
NVY_HI   = "#354b82"  # Lit deep midnight-navy northern mage coat/mantle highlight
NVY_MID  = "#213059"  # Deep midnight-navy northern mage coat, mantle & ribbon base
NVY_SH1  = "#141d36"  # Deep midnight-navy coat shadow, dark trousers & shaded folds

ICE_CORE = "#c4f2ff"  # Frost-white lower glacier iris crescent & mirror-ice specular face
ICE_HI   = "#7cdbff"  # Luminous glacier-cyan mirror-ice prism glow & icy iris bloom
ICE_MID  = "#42a5f5"  # Clear glacier-blue iris midtone & crystalline bevel
EYE_DARK = "#2665b8"  # Deep cool glacier-blue upper iris & shaded crystal facet

PALETTE = [
    PURE_WHT, HAIR_HI, HAIR_MID, HAIR_SH1, HAIR_SH2,
    INK_DARK, INK_MID, INK_ICE,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, INK_SKIN, BLUSH,
    NVY_EDGE, NVY_HI, NVY_MID, NVY_SH1,
    ICE_CORE, ICE_HI, ICE_MID, EYE_DARK,
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
    """4-connected material- & top-left-light-aware selective outer outline."""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_hair_lit = hex2rgba(HAIR_SH2)
    rgba_ink_mid  = hex2rgba(INK_MID)
    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_ink_skin = hex2rgba(INK_SKIN)
    rgba_ink_ice  = hex2rgba(INK_ICE)

    hair_lit_set = {hex2rgba(HAIR_HI)[:3], hex2rgba(HAIR_MID)[:3], hex2rgba(PURE_WHT)[:3]}
    hair_all_set = hair_lit_set | {hex2rgba(HAIR_SH1)[:3]}
    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3], hex2rgba(BLUSH)[:3]}
    ice_set = {hex2rgba(ICE_CORE)[:3], hex2rgba(ICE_HI)[:3], hex2rgba(ICE_MID)[:3], hex2rgba(EYE_DARK)[:3], hex2rgba(PURE_WHT)[:3]}
    navy_dark_set = {hex2rgba(NVY_SH1)[:3], hex2rgba(NVY_MID)[:3]}

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
            elif any(rgb in skin_set for rgb in rgb_list) and not any(rgb in navy_dark_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_skin if y < 40 else rgba_ink_mid
            elif is_top_left and y < 38 and all(rgb in hair_all_set for rgb in rgb_list):
                dst[x, y] = rgba_hair_lit
            elif y < 23 and any(rgb in (hex2rgba(ICE_CORE)[:3], hex2rgba(ICE_HI)[:3], hex2rgba(PURE_WHT)[:3]) for rgb in rgb_list):
                # Soft metallic silver-indigo edge around glittering snowflake hairpin
                dst[x, y] = rgba_ink_mid
            elif is_top_left and any(rgb in hair_lit_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_mid
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters (facing="left", top-left lighting)
# ---------------------------------------------------------------------------

def draw_back_hair(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Long, sleek, straight icy silver-white hair with sculpted waist sweep & butter-smooth tapered tips."""
    sp.layer("back_hair")
    rows = {}
    top_y = head_y + 6
    bot_y = head_y + 51

    for i in range(bot_y - top_y + 1):
        y = top_y + i
        t = i / max(1, (bot_y - top_y))

        if pose == "strike":
            curve = int(round(t * 10.5 + math.sin(t * 2.9) * 1.5))
        elif pose == "hurt":
            curve = int(round(t * 7.6 - math.sin(t * 2.5) * 1.7))
        elif pose == "windup":
            curve = int(round(t * 2.2 + math.sin(t * 2.3) * 0.7))
        else:
            curve = int(round(t * 4.6 + math.sin(t * 2.6) * 1.0)) + int(round(sway * t * 1.5))

        if t < 0.30:
            lx = cx - 9 + int(round(t * 9))
        elif t < 0.72:
            lx = cx - 5 + int(round((t - 0.30) * 13))
        else:
            lx = cx + 1 + int(round((t - 0.72) * 11)) + int(round(curve * 0.35))

        if t < 0.24:
            rx = cx + 10 + int(round(t * 14)) + curve
        elif t < 0.66:
            rx = cx + 13 + int(round((t - 0.24) * 5.0 - math.sin((t - 0.24) * 4.5) * 1.0)) + curve
        else:
            rx = cx + 15 - int(round((t - 0.66) * 9.5)) + curve

        rx = min(W - 2, rx)
        lx = min(rx, lx)
        if rx >= lx:
            rows[y] = (lx, rx)

    fill_rows(sp, rows, HAIR_SH1)

    for y, (lx, rx) in rows.items():
        t = (y - top_y) / max(1, (bot_y - top_y))
        span = rx - lx
        if span >= 4:
            s1 = lx + max(2, int(span * 0.34))
            hspan(sp, y, s1, min(rx - 2, s1 + 2), HAIR_MID)
            if t < 0.60:
                sp.px(s1, y, HAIR_HI)
            s2 = rx - 3 + int(round(math.sin(t * 4.2) * 0.8))
            if s1 + 2 < s2 < rx:
                sp.px(s2, y, HAIR_MID if t < 0.72 else HAIR_SH1)
                if 0.12 < t < 0.50:
                    sp.px(s2 - 1, y, HAIR_HI)
        if rx - 1 >= lx:
            sp.px(rx, y, HAIR_SH2)
            if t > 0.42 and rx - 2 >= lx:
                sp.px(rx - 1, y, HAIR_SH2 if t > 0.72 else HAIR_SH1)
        occ_r = min(rx - 2, cx + 6)
        if lx <= occ_r:
            hspan(sp, y, lx, occ_r, HAIR_SH2)

    # Butter-smooth feathered V-cascade of 3 sleek straight silver tips!
    base_lx, base_rx = rows.get(bot_y - 3, (cx + 6, cx + 16))
    for y in range(bot_y - 1, bot_y + 1):
        for x in range(base_lx - 1, min(W - 1, base_rx + 3)):
            sp.px(x, y, None)

    locks = [
        (base_lx + 1, 5, 0, False),
        (base_lx + 4, 7, 1, True),
        (min(W - 5, base_lx + 8), 5, 1, True),
    ]
    for bx, length, dir_x, is_lit in locks:
        by = bot_y - 2
        for k in range(length):
            w = 3 if k < 2 else (2 if k < length - 2 else 1)
            px_x = min(W - 2 - w, bx + (dir_x * k) // 2)
            if k < length - 2:
                col = HAIR_MID if is_lit else HAIR_SH1
            elif k == length - 2:
                col = HAIR_SH1
            else:
                col = HAIR_SH2
            hspan(sp, by + k, px_x, px_x + w - 1, col)
            if is_lit and k < 3:
                sp.px(px_x, by + k, HAIR_HI)

    # Delicate straight fluttering silver wisp off outer-right hair in dynamic frames
    wisp_y = head_y + 26
    wisp_rx = rows.get(wisp_y, (cx, cx + 15))[1]
    if pose in ("idle2", "strike", "hurt") and wisp_rx < W - 4:
        for k in range(5):
            wx = min(W - 2, wisp_rx + 1 + (k // 2))
            wy = wisp_y + k
            sp.px(wx, wy, HAIR_HI if k < 2 else (HAIR_MID if k < 4 else HAIR_SH1))
            if k < 3 and wx - 1 >= 0:
                sp.px(wx - 1, wy, HAIR_MID)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Slim dark northern trousers + tall midnight-navy frost boots with silver cuff & ice clasp."""
    sp.layer("legs")

    if pose == "strike":
        far_fx, far_fy = cx - 9, ground_y
        near_fx, near_fy = cx + 5, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2
    elif pose == "windup":
        far_fx, far_fy = cx - 6, ground_y
        near_fx, near_fy = cx + 3, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2
    elif pose == "hurt":
        far_fx, far_fy = cx - 7, ground_y - 1
        near_fx, near_fy = cx + 3, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2
    else:
        far_fx, far_fy = cx - 6, ground_y
        near_fx, near_fy = cx + 2, ground_y
        far_top_x = cx - 4
        near_top_x = cx + 2

    hip_y = ground_y - 16

    def _draw_one_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        boot_top_y = foot_y - 8
        tight_hi = NVY_MID if is_far else NVY_HI
        tight_mid = NVY_SH1 if is_far else NVY_MID
        tight_sh = INK_DARK if is_far else NVY_SH1

        boot_hi = NVY_HI if is_far else NVY_EDGE
        boot_mid = NVY_MID if is_far else NVY_HI
        boot_sh = NVY_SH1 if is_far else NVY_MID

        span_h = max(1, boot_top_y - hip_y)
        for y in range(hip_y, boot_top_y + 1):
            t = (y - hip_y) / span_h
            lx = int(round(top_x + (foot_x - top_x) * t))
            w = 4 if t < 0.45 else 3
            hspan(sp, y, lx, lx + w - 1, tight_mid)
            sp.px(lx, y, tight_hi)
            sp.px(lx + w - 1, y, tight_sh)
            if y <= hip_y + 3:
                hspan(sp, y, lx, lx + w - 1, tight_sh)

        bx = foot_x
        # Silver-frost embroidered top boot cuff
        hspan(sp, boot_top_y, bx, bx + 3, HAIR_MID if not is_far else HAIR_SH1)
        sp.px(bx, boot_top_y, HAIR_HI if not is_far else HAIR_MID)
        sp.px(bx + 3, boot_top_y, HAIR_SH2)

        # Crisp crease beneath cuff + glowing ice-crystal clasp
        hspan(sp, boot_top_y + 1, bx, bx + 3, NVY_SH1 if is_far else NVY_MID)
        sp.px(bx, boot_top_y + 1, boot_hi)
        sp.px(bx + 1, boot_top_y + 1, ICE_HI if not is_far else ICE_MID)

        for y in range(boot_top_y + 2, foot_y - 2):
            w_sh = 4 if y < foot_y - 4 else 3
            hspan(sp, y, bx, bx + w_sh - 1, boot_mid)
            sp.px(bx, y, boot_hi)
            sp.px(bx + w_sh - 1, y, boot_sh)

        hspan(sp, foot_y - 2, bx - 1, bx + 3, boot_mid)
        sp.px(bx - 1, foot_y - 2, boot_hi)
        sp.px(bx, foot_y - 2, boot_hi)
        sp.px(bx + 3, foot_y - 2, boot_sh)

        hspan(sp, foot_y - 1, bx - 2, bx + 3, boot_mid)
        hspan(sp, foot_y - 1, bx - 1, bx + 1, boot_hi)
        sp.px(bx + 3, foot_y - 1, boot_sh)

        # Grounded dark sole at exact y == foot_y
        hspan(sp, foot_y, bx - 2, bx + 3, INK_DARK)
        sp.px(bx, foot_y, NVY_SH1)

    _draw_one_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_one_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_far_arm(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Far (left) midnight-navy mage sleeve with steel-blue top-left rim, silver cuff & poised hand."""
    sp.layer("far_arm")
    sx, sy = cx - 5, torso_y + 2

    if pose == "windup":
        hx, hy = cx - 12, torso_y - 1
    elif pose == "strike":
        hx, hy = cx - 11, torso_y + 8
    elif pose == "hurt":
        hx, hy = cx - 12, torso_y + 9
    else:
        hx, hy = cx - 11, torso_y + 7

    mid_x = (sx + hx) // 2
    mid_y = (sy + hy) // 2 + 1

    sp.polygon([
        (sx + 1, sy),
        (sx - 3, sy + 1),
        (mid_x - 2, mid_y),
        (mid_x + 1, mid_y + 2),
        (sx + 1, sy + 4),
    ], NVY_MID, fill=True)
    sp.line(sx - 3, sy + 1, mid_x - 2, mid_y, NVY_EDGE)
    sp.line(sx - 2, sy + 2, mid_x - 1, mid_y + 1, NVY_HI)
    sp.line(sx, sy + 3, mid_x, mid_y + 2, NVY_SH1)

    sp.line(mid_x, mid_y, hx + 2, hy, NVY_MID)
    sp.line(mid_x - 1, mid_y, hx + 1, hy - 1, NVY_EDGE)
    sp.line(mid_x, mid_y + 1, hx + 2, hy + 1, NVY_SH1)

    sp.px(hx + 2, hy - 1, HAIR_HI)
    sp.px(hx + 2, hy, HAIR_MID)
    sp.px(hx + 2, hy + 1, HAIR_SH1)

    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)
    if pose in ("idle1", "idle2", "blink", "windup"):
        sp.px(hx - 2, hy - 1, SKIN_HI)

    return hx, hy


def draw_coat_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Tailored long split-front deep midnight-navy northern mage coat with curved fold-shaded silver hem."""
    sp.layer("skirt")
    coat_h = 15

    if pose == "strike":
        shift_bot = 4
        flare_l, flare_r = 9, 13
    elif pose == "hurt":
        shift_bot = -2
        flare_l, flare_r = 10, 10
    elif pose == "windup":
        shift_bot = 1
        flare_l, flare_r = 9, 10
    else:
        shift_bot = sway
        flare_l, flare_r = 9, 10

    for i in range(coat_h + 1):
        y = waist_y + i
        t = i / coat_h
        e = t ** 0.88
        lx = int(round(cx - 5 - flare_l * e + shift_bot * t))
        rx = int(round(cx + 5 + flare_r * e + shift_bot * t))

        split_c = int(round(cx - 2 + shift_bot * t * 0.45))
        split_half = 0 if i < 3 else (1 if i < 9 else 2)

        span = max(1, rx - lx)
        for x in range(lx, rx + 1):
            u = (x - lx) / span
            dist_split = abs(x - split_c)
            local_end = coat_h - (1 if dist_split <= 3 else 0)
            if i > local_end:
                continue
            if i >= coat_h - 4 and dist_split < split_half:
                if i == coat_h - 4:
                    sp.px(x, y, NVY_SH1)
                continue

            fold = (u * 3.4) % 1.0
            if u < 0.14:
                col = NVY_EDGE if i > 1 else NVY_HI
            elif u > 0.86:
                col = INK_DARK
            elif fold < 0.24:
                col = NVY_SH1 if u < 0.55 else INK_DARK
            elif fold < 0.68:
                col = NVY_MID if u < 0.65 else NVY_SH1
            else:
                col = NVY_HI if u < 0.54 else NVY_MID
            sp.px(x, y, col)

            if i == local_end - 2 and lx < x < rx:
                if fold < 0.24 or u > 0.82:
                    scol = HAIR_SH1
                elif u < 0.32 or (u < 0.60 and fold > 0.62):
                    scol = HAIR_HI
                else:
                    scol = HAIR_MID
                sp.px(x, y, scol)
            elif i == local_end - 1 and lx < x < rx:
                if (x - lx) % 4 == 1:
                    sp.px(x, y, HAIR_MID if u < 0.45 else HAIR_SH1)
                else:
                    sp.px(x, y, NVY_SH1)
            elif i == local_end:
                sp.px(x, y, INK_DARK)

        if i == 0:
            hspan(sp, y, lx, rx, INK_DARK)

        if 1 <= i <= coat_h - 2:
            l_edge = split_c - split_half
            r_edge = split_c + split_half
            if lx < l_edge < rx:
                sp.px(l_edge, y, HAIR_HI if i % 3 != 2 else HAIR_MID)
            if lx < r_edge < rx:
                sp.px(r_edge, y, HAIR_MID if i % 3 != 2 else HAIR_SH1)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """High-collared ice-white shirt, midnight-blue necktie, gleaming silver snowflake collar brooch,
    and tailored deep midnight-navy northern mage mantle/coat with silver trim & chest chain."""
    sp.layer("torso")

    for y in range(neck_y - 2, neck_y + 1):
        hspan(sp, y, cx - 2, cx + 1, SKIN_SH1)
        sp.px(cx - 2, y, SKIN_MID)
        sp.px(cx + 1, y, SKIN_SH2)
    hspan(sp, neck_y - 2, cx - 2, cx + 1, SKIN_SH2)

    # Stiff turned high collar of northern silver-white dress shirt
    hspan(sp, neck_y - 1, cx - 3, cx + 3, HAIR_HI)
    sp.px(cx + 2, neck_y - 1, HAIR_MID)
    sp.px(cx + 3, neck_y - 1, HAIR_SH1)
    hspan(sp, neck_y, cx - 4, cx + 4, HAIR_HI)
    sp.px(cx - 4, neck_y, PURE_WHT)
    sp.px(cx + 2, neck_y, HAIR_MID)
    sp.px(cx + 3, neck_y, HAIR_SH1)
    sp.px(cx + 4, neck_y, HAIR_SH2)
    hspan(sp, neck_y + 1, cx - 3, cx + 3, HAIR_MID)
    sp.px(cx - 2, neck_y + 1, HAIR_HI)
    sp.px(cx + 3, neck_y + 1, HAIR_SH1)

    torso_shape = {
        2:  (-6, 7),
        3:  (-6, 7),
        4:  (-6, 7),
        5:  (-6, 6),
        6:  (-5, 6),
        7:  (-5, 6),
        8:  (-5, 5),
        9:  (-5, 5),
        10: (-4, 5),
        11: (-4, 5),
        12: (-5, 5),
        13: (-5, 5),
    }

    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, NVY_MID)
        sp.px(cx + dl, y, NVY_EDGE if dy < 9 else NVY_HI)
        if dl + 1 <= dr:
            sp.px(cx + dl + 1, y, NVY_HI if dy < 10 else NVY_MID)
        sp.px(cx + dr, y, INK_DARK)
        if dr - 1 >= dl:
            sp.px(cx + dr - 1, y, NVY_SH1)
        if dy >= 6 and dr - 2 >= dl:
            sp.px(cx + dr - 2, y, NVY_SH1)

    # Inner shirt V-opening & midnight-blue silk necktie
    for dy in range(2, 8):
        y = neck_y + dy
        if dy <= 4:
            hspan(sp, y, cx - 3, cx - 1, HAIR_HI if dy < 4 else HAIR_MID)
        sp.px(cx - 2, y, NVY_HI if dy < 5 else NVY_MID)
        if dy >= 5:
            sp.px(cx - 1, y, NVY_SH1)

    # Tailored silver V-lapel piping
    for dy in range(2, 11):
        y = neck_y + dy
        lx_p = cx - 4 if dy < 5 else (cx - 3 if dy < 8 else cx - 2)
        sp.px(lx_p, y, HAIR_HI if dy < 6 else HAIR_MID)
        rx_p = cx + 1 if dy < 5 else (cx if dy < 8 else cx - 1)
        sp.px(rx_p, y, HAIR_MID if dy < 6 else HAIR_SH1)

    # Draped northern mantle shoulder-seam silver embroidery
    for mx_t, mdy in [(cx + 2, 2), (cx + 3, 3), (cx + 4, 4), (cx + 5, 5), (cx + 6, 6)]:
        sp.px(mx_t, neck_y + mdy, HAIR_HI if mdy < 4 else HAIR_MID)
        sp.px(mx_t - 1, neck_y + mdy + 1, NVY_SH1)

    # Delicate diagonal silver chest chain clasp
    sp.px(cx - 4, neck_y + 7, HAIR_MID)
    sp.px(cx - 3, neck_y + 8, HAIR_HI)
    sp.px(cx - 1, neck_y + 9, HAIR_MID)
    sp.px(cx + 1, neck_y + 9, HAIR_SH1)
    sp.px(cx + 3, neck_y + 8, HAIR_MID)

    # Tailored silver waist clasp
    hspan(sp, neck_y + 11, cx - 4, cx + 4, NVY_SH1)
    sp.px(cx - 3, neck_y + 11, HAIR_MID)
    sp.px(cx - 2, neck_y + 11, PURE_WHT)
    sp.px(cx - 1, neck_y + 11, HAIR_MID)
    sp.px(cx, neck_y + 11, HAIR_SH1)

    # GLITTERING SILVER SNOWFLAKE COLLAR BROOCH (centered at cx - 2, neck_y + 2)!
    bx, by = cx - 2, neck_y + 2
    sp.px(bx, by - 1, HAIR_HI)
    sp.px(bx - 1, by, HAIR_HI)
    sp.px(bx, by, PURE_WHT)
    sp.px(bx + 1, by, ICE_CORE)
    sp.px(bx, by + 1, ICE_HI)
    sp.px(bx - 1, by + 1, HAIR_SH1)
    sp.px(bx + 1, by + 1, HAIR_SH1)
    sp.px(bx, by + 2, HAIR_MID)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Jewelry-polished aristocratic 3/4 LEFT anime head: cool alabaster porcelain skin,
    luminous half-lidded pale glacier-blue eyes, sleek straight icy silver-white hair crown,
    woven side braid, tucked glittering silver snowflake hairpin & silky split dark-navy ribbons!"""
    sp.layer("head")

    # 1) Slender pale porcelain 3/4 LEFT face silhouette
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
            hspan(sp, y, cx + dl + 1, cx - 2, SKIN_HI)
        if 13 <= dy <= 24:
            sp.px(cx + dr, y, SKIN_SH1)
            if dy >= 19 and dr - 1 >= dl:
                sp.px(cx + dr - 1, y, SKIN_SH1)
        if dy == 25:
            sp.px(cx + dl, y, SKIN_SH1)
            sp.px(cx + dr - 1, y, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)
        if dy == 26:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    # 2) LUMINOUS HALF-LIDDED PALE GLACIER-BLUE ANIME EYES (facing 3/4 LEFT!)
    ey = head_y + 16
    fx0 = cx - 7  # far (left) eye: 4x5
    nx0 = cx      # near (right) eye: 5x5

    if pose == "blink":
        sp.px(fx0 - 1, ey + 1, INK_DARK)
        hspan(sp, ey + 2, fx0, fx0 + 3, INK_DARK)
        hspan(sp, ey + 3, fx0 + 1, fx0 + 2, SKIN_SH1)

        hspan(sp, ey + 2, nx0, nx0 + 4, INK_DARK)
        sp.px(nx0 + 5, ey + 1, INK_DARK)
        hspan(sp, ey + 3, nx0 + 1, nx0 + 3, SKIN_SH1)

    elif pose == "hurt":
        # Clean, perfectly centered aristocratic > < wince!
        sp.px(fx0, ey, INK_DARK)
        sp.px(fx0 + 1, ey + 1, INK_DARK)
        sp.px(fx0 + 2, ey + 2, INK_DARK)
        sp.px(fx0 + 1, ey + 3, INK_DARK)
        sp.px(fx0, ey + 4, INK_DARK)

        sp.px(nx0 + 4, ey, INK_DARK)
        sp.px(nx0 + 3, ey + 1, INK_DARK)
        sp.px(nx0 + 2, ey + 2, INK_DARK)
        sp.px(nx0 + 3, ey + 3, INK_DARK)
        sp.px(nx0 + 4, ey + 4, INK_DARK)

    else:
        sharp = pose in ("windup", "strike")

        # --- FAR EYE (left, 4x5 cool half-lidded pale glacier-blue gem!) ---
        sp.px(fx0 - 1, ey, INK_DARK)          # crisp outer-left lash wing
        if sharp:
            hspan(sp, ey, fx0, fx0 + 2, INK_DARK)
            sp.px(fx0 + 3, ey + 1, INK_DARK)
        else:
            hspan(sp, ey, fx0, fx0 + 3, INK_DARK)

        # Row +1: soft shaded upper sclera + single crisp pure-white top-left catchlight + glacier rim!
        sp.px(fx0, ey + 1, HAIR_MID if not sharp else PURE_WHT)
        sp.px(fx0 + 1, ey + 1, PURE_WHT)      # gleaming catchlight!
        sp.px(fx0 + 2, ey + 1, EYE_DARK if not sharp else INK_DARK)
        sp.px(fx0 + 3, ey + 1, EYE_DARK)

        # Row +2: bright sclera corner + translucent glacier iris & cool pupil
        sp.px(fx0, ey + 2, PURE_WHT)
        sp.px(fx0 + 1, ey + 2, ICE_MID)
        sp.px(fx0 + 2, ey + 2, EYE_DARK)
        sp.px(fx0 + 3, ey + 2, ICE_HI)

        # Row +3: glowing glacier-white lower crescent + crystalline micro-sparkle!
        sp.px(fx0, ey + 3, SKIN_MID)
        sp.px(fx0 + 1, ey + 3, ICE_CORE)
        sp.px(fx0 + 2, ey + 3, ICE_CORE)
        sp.px(fx0 + 3, ey + 3, PURE_WHT)

        # Row +4: delicate soft silver-slate lower eyelid contour (zero dark bags!)
        hspan(sp, ey + 4, fx0 + 1, fx0 + 3, HAIR_SH1)

        # --- NEAR EYE (right, 5x5 cool half-lidded pale glacier-blue gem!) ---
        if sharp:
            sp.px(nx0, ey + 1, INK_DARK)
            hspan(sp, ey, nx0 + 1, nx0 + 4, INK_DARK)
        else:
            hspan(sp, ey, nx0, nx0 + 4, INK_DARK)
        sp.px(nx0 + 5, ey, INK_DARK)          # sleek aristocratic outer-right lash wing!

        # Row +1: shadowed upper iris rim + matching top-left catchlight + soft shaded outer sclera!
        sp.px(nx0, ey + 1, EYE_DARK if not sharp else INK_DARK)
        sp.px(nx0 + 1, ey + 1, PURE_WHT)      # crisp matching catchlight!
        sp.px(nx0 + 2, ey + 1, EYE_DARK)
        sp.px(nx0 + 3, ey + 1, EYE_DARK if sharp else ICE_MID)
        sp.px(nx0 + 4, ey + 1, HAIR_MID if not sharp else PURE_WHT)

        # Row +2: translucent pale glacier iris + steel-sapphire pupil + bright outer sclera!
        sp.px(nx0, ey + 2, ICE_MID)
        sp.px(nx0 + 1, ey + 2, ICE_HI)
        sp.px(nx0 + 2, ey + 2, EYE_DARK)
        sp.px(nx0 + 3, ey + 2, ICE_HI)
        sp.px(nx0 + 4, ey + 2, PURE_WHT)

        # Row +3: luminous frost-white lower crescent + secondary sparkle!
        sp.px(nx0, ey + 3, ICE_HI)
        sp.px(nx0 + 1, ey + 3, ICE_CORE)
        sp.px(nx0 + 2, ey + 3, ICE_CORE)
        sp.px(nx0 + 3, ey + 3, PURE_WHT)
        sp.px(nx0 + 4, ey + 3, SKIN_MID)

        # Row +4: delicate soft silver-slate lower eyelid contour
        hspan(sp, ey + 4, nx0 + 1, nx0 + 3, HAIR_SH1)

    # 3) Refined 2px pale-rose aristocratic cheek blush
    hspan(sp, ey + 4, fx0 - 1, fx0, BLUSH)
    hspan(sp, ey + 4, nx0 + 3, nx0 + 4, BLUSH)

    # 4) Cool composed aristocratic mouth
    my = head_y + 23
    mx = cx - 2
    if pose == "strike":
        sp.px(mx, my, INK_SKIN)
        sp.px(mx + 1, my, INK_SKIN)
        sp.px(mx, my + 1, BLUSH)
        sp.px(mx + 1, my + 1, SKIN_SH2)
    elif pose == "hurt":
        sp.px(mx - 1, my + 1, INK_SKIN)
        sp.px(mx, my, INK_SKIN)
        sp.px(mx + 1, my + 1, INK_SKIN)
    elif pose == "windup":
        sp.px(mx, my, INK_SKIN)
        sp.px(mx + 1, my, SKIN_SH2)
    else:
        sp.px(mx, my, SKIN_SH2)
        sp.px(mx + 1, my, SKIN_SH2)

    # 5) SLEEK STRAIGHT ICY SILVER-WHITE HAIR CROWN & STRAIGHT CURTAIN BANGS!
    crown_rows = {
        0:  (-4, 4),
        1:  (-6, 7),
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
            hi_r = cx + min(dr - 2, 7)
            if hi_r >= hi_l:
                hspan(sp, y, hi_l, hi_r, HAIR_HI)
        # Liquid-silver curved anime angel-ring highlight across crown
        if dy == 6:
            hspan(sp, y, cx - 8, cx - 4, HAIR_HI)
            hspan(sp, y, cx - 2, cx + 3, HAIR_HI)
            hspan(sp, y, cx + 5, cx + 10, HAIR_HI)
            sp.px(cx - 6, y, PURE_WHT)
            sp.px(cx, y, PURE_WHT)
            sp.px(cx + 7, y, PURE_WHT)
        elif dy == 7:
            hspan(sp, y, cx - 9, cx - 5, HAIR_HI)
            hspan(sp, y, cx - 1, cx + 4, HAIR_HI)
            hspan(sp, y, cx + 7, cx + 11, HAIR_HI)
            sp.px(cx - 7, y, PURE_WHT)
            sp.px(cx + 2, y, PURE_WHT)
        elif dy == 8:
            hspan(sp, y, cx - 8, cx - 7, HAIR_HI)
            hspan(sp, y, cx + 2, cx + 4, HAIR_HI)
            sp.px(cx + 9, y, HAIR_HI)

        if dr >= 8:
            hspan(sp, y, cx + dr - 2, cx + dr, HAIR_SH1)
            if dy >= 5:
                sp.px(cx + dr, y, HAIR_SH2)

    # Natural straight hair part at center-left
    part_x = cx - 1
    for dy in (1, 2, 3, 4):
        sp.px(part_x, head_y + dy, HAIR_SH1)
    sp.px(part_x, head_y + 2, HAIR_SH2)
    sp.px(part_x - 1, head_y + 5, PURE_WHT)

    # Subtle straight silk grooves below angel-ring
    for (sx, sy0, sy1, dx_step) in [
        (cx - 7, 8, 12, -0.20),
        (cx - 3, 8, 12, -0.15),
        (cx + 2, 8, 12,  0.15),
        (cx + 7, 8, 12,  0.28),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, HAIR_SH1)

    # Airy forehead breathing room cleanly above BOTH brows across all 6 frames!
    for x in (cx - 6, cx - 5, cx + 1, cx + 2, cx + 3):
        sp.px(x, head_y + 12, SKIN_MID)
        sp.px(x, head_y + 13, SKIN_MID)

    # Feathery straight center-left bang tapering between eyes
    for dy, (dl, dr) in [
        (11, (-3, 0)), (12, (-3, 0)), (13, (-3, -1)),
        (14, (-3, -1)), (15, (-2, -1)), (16, (-2, -2)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy < 15 else HAIR_SH1)
        if dy <= 14:
            sp.px(cx + dl, head_y + dy, HAIR_HI)
        if dy >= 14 and dr > dl:
            sp.px(cx + dr, head_y + dy, HAIR_SH1)

    # Right temple straight wispy bang framing near eye
    for dy, (dl, dr) in [(12, (4, 8)), (13, (5, 8)), (14, (6, 8)), (15, (7, 8)), (16, (7, 7))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID)
        sp.px(cx + dl, head_y + dy, HAIR_HI)
        if dy >= 14:
            sp.px(cx + dr, head_y + dy, HAIR_SH1)

    # Far (left) temple bang blending seamlessly into cheek lock
    for dy, (dl, dr) in [(12, (-10, -7)), (13, (-10, -8)), (14, (-10, -8)), (15, (-10, -9))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, HAIR_MID if dy == 12 else HAIR_SH1)
        sp.px(cx + dl, head_y + dy, HAIR_HI if dy < 14 else HAIR_MID)

    # 6) REFINED SLENDER PALE-SILVER EYEBROWS (100% crisp separation above lashes & bangs!)
    brow_y = ey - 2
    if pose in ("windup", "strike"):
        sp.px(fx0, brow_y - 1, HAIR_SH2)
        sp.px(fx0 + 1, brow_y, INK_MID)
        sp.px(fx0 + 2, brow_y, INK_MID)

        sp.px(nx0 + 1, brow_y, INK_MID)
        sp.px(nx0 + 2, brow_y, INK_MID)
        sp.px(nx0 + 3, brow_y - 1, HAIR_SH2)
        sp.px(nx0 + 4, brow_y - 1, HAIR_SH2)
    elif pose == "hurt":
        sp.px(fx0, brow_y + 1, HAIR_SH2)
        sp.px(fx0 + 1, brow_y, INK_MID)
        sp.px(fx0 + 2, brow_y, HAIR_SH2)
        sp.px(nx0 + 2, brow_y, HAIR_SH2)
        sp.px(nx0 + 3, brow_y, INK_MID)
        sp.px(nx0 + 4, brow_y + 1, HAIR_SH2)
    else:
        sp.px(fx0, brow_y, HAIR_SH1)
        sp.px(fx0 + 1, brow_y, HAIR_SH2)
        sp.px(fx0 + 2, brow_y, HAIR_SH2)

        sp.px(nx0 + 1, brow_y, HAIR_SH2)
        sp.px(nx0 + 2, brow_y, HAIR_SH2)
        sp.px(nx0 + 3, brow_y, HAIR_SH1)

    # 7) LONG SLEEK STRAIGHT FACE-FRAMING SILVER SIDE LOCKS (hugging jawline seamlessly!)
    for i in range(25):
        y = head_y + 13 + i
        t = i / 24.0
        off = -int(round(math.sin(t * 2.2) * 0.9)) - (1 if pose == "hurt" else 0)
        rx = cx + 8 - int(round(t * 2.0)) + off
        w = 4 if i < 9 else (3 if i < 17 else (2 if i < 22 else 1))
        hspan(sp, y, rx, rx + w - 1, HAIR_MID)
        sp.px(rx, y, HAIR_HI if i < 18 else HAIR_MID)
        if w >= 3:
            sp.px(rx + w - 1, y, HAIR_SH1)
        if i in (5, 6, 13, 14) and w >= 3:
            sp.px(rx + 1, y, PURE_WHT if i < 7 else HAIR_HI)

    for i in range(18):
        y = head_y + 12 + i
        if i < 9:
            lx = cx - 10
            w = 3 if i < 5 else 2
        elif i < 14:
            lx = cx - 9
            w = 2
        else:
            lx = cx - 8
            w = 2 if i < 16 else 1
        hspan(sp, y, lx, lx + w - 1, HAIR_MID if i < 10 else HAIR_SH1)
        sp.px(lx, y, HAIR_HI if i < 12 else HAIR_MID)
        if w >= 2:
            sp.px(lx + w - 1, y, HAIR_SH1 if i < 11 else HAIR_SH2)

    # 8) ICONIC WOVEN SIDE BRAID + TUCKED GLITTERING SILVER SNOWFLAKE HAIRPIN + SPLIT DARK-NAVY RIBBONS!
    bx = cx + 10
    by = head_y + 11

    # Horizontal woven silver side braid across right temple
    for k in range(5):
        px_x = bx - 2 + k
        py_y = by + (1 if k % 2 else 0)
        sp.px(px_x, py_y - 1, HAIR_HI if k % 2 == 0 else HAIR_MID)
        sp.px(px_x, py_y, HAIR_MID if k % 2 == 0 else HAIR_SH1)
        sp.px(px_x, py_y + 1, HAIR_SH2)

    # Sleek dark-navy ribbon knot & split twin tails revealing silver hair between tails!
    sp.rect(bx + 1, by + 1, bx + 2, by + 3, NVY_MID)
    sp.px(bx + 1, by + 1, NVY_EDGE)

    if pose == "strike":
        sway_curve = [0, 1, 2, 3, 4, 5, 5, 6, 7, 7]
    elif pose == "hurt":
        sway_curve = [0, 0, 1, 1, 1, 0, 0, -1, -1, 0]
    elif pose == "windup":
        sway_curve = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2]
    elif pose == "idle2":
        sway_curve = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3]
    else:
        sway_curve = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2]

    for k in range(10):
        ty = by + 3 + k
        tx = min(W - 4, bx + 1 + sway_curve[k])
        # Sleek front dark-navy ribbon tail
        sp.px(tx, ty, NVY_EDGE if k < 4 else NVY_HI)
        sp.px(tx + 1, ty, NVY_MID if k < 7 else NVY_SH1)
        # Clean split gap (1px sliver of silver hair at k >= 5) before slender rear ribbon tail!
        sep = 2 if k < 5 else 3
        if tx + sep < W - 2:
            sp.px(tx + sep, ty, NVY_MID if k < 6 else NVY_SH1)
        # Gleaming silver diamond ribbon ornament mid-length (faithful to aino_normal.png!)
        if k == 5:
            sp.px(tx + 1, ty, HAIR_HI)
        elif k == 9:
            sp.px(tx, ty, NVY_SH1)
            sp.px(tx + 1, ty, INK_DARK)

    # Tucked GLITTERING SILVER SNOWFLAKE HAIRPIN pinned cleanly on braid/knot (sx = bx + 1)!
    sx, sy = bx + 1, by
    for ddx, ddy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        sp.px(sx + ddx, sy + ddy, NVY_MID)
    sp.px(sx, sy, PURE_WHT)            # bright diamond snowflake core
    sp.px(sx, sy - 2, PURE_WHT)        # top crystal spire
    sp.px(sx, sy - 1, ICE_CORE)
    sp.px(sx, sy + 1, ICE_HI)          # bottom crystal spire
    sp.px(sx, sy + 2, HAIR_HI)
    sp.px(sx - 2, sy, PURE_WHT)        # left crystal spire
    sp.px(sx - 1, sy, ICE_CORE)
    sp.px(sx + 1, sy, ICE_HI)          # right crystal spire
    sp.px(sx + 2, sy, HAIR_HI)


def draw_ice_hexagon(sp: Sprite, mx: int, my: int, tall: bool = True, bright: bool = False):
    """Draw a razor-crisp geometric crystalline MIRROR-ICE HEXAGON prism on `weapon` layer."""
    if tall:
        hex_rows = {
            -5: (0, 0),
            -4: (-1, 1),
            -3: (-2, 2),
            -2: (-3, 3),
            -1: (-3, 3),
             0: (-3, 3),
             1: (-3, 3),
             2: (-3, 3),
             3: (-2, 2),
             4: (-1, 1),
             5: (0, 0),
        }
        max_dy = 5
    else:
        hex_rows = {
            -4: (0, 0),
            -3: (-1, 1),
            -2: (-2, 2),
            -1: (-2, 2),
             0: (-2, 2),
             1: (-2, 2),
             2: (-2, 2),
             3: (-1, 1),
             4: (0, 0),
        }
        max_dy = 4

    for dy, (dl, dr) in hex_rows.items():
        y = my + dy
        for dx in range(dl, dr + 1):
            x = mx + dx
            is_border = (dx == dl or dx == dr or abs(dy) == max_dy)
            if is_border:
                if dx < 0 and dy <= 0:
                    col = PURE_WHT if bright else ICE_CORE
                elif dx <= 0 or dy < -1:
                    col = ICE_CORE if bright else ICE_HI
                elif dx > 0 and dy >= 1:
                    col = EYE_DARK
                else:
                    col = ICE_MID
            else:
                diag = dx + dy
                if diag in (-1, 0):
                    col = PURE_WHT if (bright or abs(dx) <= 1) else ICE_CORE
                elif diag < -1:
                    col = ICE_CORE if bright else ICE_HI
                elif diag == 1:
                    col = ICE_HI
                else:
                    col = ICE_MID
            sp.px(x, y, col)
    # Peak-shimmer pure-white crystal star gleam inside bright hexagon center
    if bright:
        sp.px(mx, my, PURE_WHT)
        sp.px(mx - 1, my, PURE_WHT)
        sp.px(mx, my - 1, PURE_WHT)


def draw_near_arm_and_magic(sp: Sprite, cx: int, torso_y: int, pose: str, far_hx: int, far_hy: int):
    """Near (right) tailored midnight-navy northern mage mantle sleeve with prominent SNOWFLAKE SHOULDER CREST,
    plus Aino's razor-clean hovering mirror-ice hexagons & 3-shard glacial lance barrage!"""
    sp.layer("near_arm")

    sh_x, sh_y = cx + 6, torso_y + 2

    if pose == "windup":
        el_x, el_y = cx + 3, torso_y + 9
        hx, hy = cx - 7, torso_y + 9
    elif pose == "strike":
        el_x, el_y = cx - 2, torso_y + 5
        hx, hy = cx - 12, torso_y + 4
    elif pose == "hurt":
        el_x, el_y = cx + 6, torso_y + 9
        hx, hy = cx - 3, torso_y + 6
    else:
        el_x, el_y = cx + 8, torso_y + 8
        hx, hy = cx + 4, torso_y + 12

    # 1) Tailored Midnight-Navy Northern Mage Upper Mantle Sleeve
    sp.polygon([
        (sh_x - 2, sh_y),
        (sh_x + 4, sh_y + 1),
        (el_x + 3, el_y + 1),
        (el_x - 2, el_y + 1),
        (sh_x - 3, sh_y + 5),
    ], NVY_MID, fill=True)
    sp.line(sh_x - 2, sh_y + 1, el_x - 2, el_y, NVY_EDGE)
    sp.line(sh_x - 1, sh_y + 2, el_x - 1, el_y + 1, NVY_HI)
    sp.line(sh_x + 3, sh_y + 1, el_x + 3, el_y + 1, NVY_SH1)
    sp.line(sh_x + 4, sh_y + 2, el_x + 3, el_y + 1, INK_DARK)

    # Silver shoulder mantle trim piping
    sp.line(sh_x - 1, sh_y, sh_x + 3, sh_y + 1, HAIR_MID)
    sp.px(sh_x - 1, sh_y, HAIR_HI)

    # 2) PROMINENT SNOWFLAKE SHOULDER CREST on near upper sleeve!
    if pose != "strike":
        cr_x = sh_x + 1 if pose in ("windup", "hurt") else sh_x + 2
        cr_y = sh_y + 3
        sp.px(cr_x, cr_y - 2, HAIR_HI)
        sp.px(cr_x - 1, cr_y - 1, HAIR_MID)
        sp.px(cr_x, cr_y - 1, ICE_CORE)
        sp.px(cr_x + 1, cr_y - 1, HAIR_SH1)
        sp.px(cr_x - 2, cr_y, HAIR_MID)
        sp.px(cr_x - 1, cr_y, ICE_HI)
        sp.px(cr_x, cr_y, PURE_WHT)
        sp.px(cr_x + 1, cr_y, ICE_HI)
        sp.px(cr_x + 2, cr_y, HAIR_SH1)
        sp.px(cr_x - 1, cr_y + 1, HAIR_SH1)
        sp.px(cr_x, cr_y + 1, ICE_CORE)
        sp.px(cr_x + 1, cr_y + 1, HAIR_SH2)
        sp.px(cr_x, cr_y + 2, HAIR_MID)

    # 3) Forearm sleeve + metallic silver cuff
    sp.polygon([
        (el_x - 1, el_y - 1),
        (el_x + 2, el_y + 1),
        (hx + 2, hy + 1),
        (hx + 1, hy - 1),
    ], NVY_MID, fill=True)
    sp.line(el_x - 1, el_y - 1, hx + 1, hy - 1, NVY_EDGE)
    sp.line(el_x + 2, el_y + 1, hx + 2, hy + 1, NVY_SH1)

    sp.px(hx + 1, hy - 1, HAIR_HI)
    sp.px(hx + 2, hy, HAIR_MID)
    sp.px(hx + 1, hy + 1, HAIR_SH1)

    # 4) Delicate pale porcelain hand
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)
    if pose == "strike":
        sp.px(hx - 2, hy - 1, SKIN_HI)
        sp.px(hx - 2, hy, SKIN_MID)

    # 5) HOVERING CRYSTALLINE MIRROR-ICE HEXAGON PRISMS & RAZOR GLACIAL SHARDS!
    sp.layer("weapon")
    cast_x, cast_y = far_hx - 10, far_hy - 3

    if pose in ("idle1", "idle2", "blink"):
        # Razor-clean geometric mirror-ice hexagon silhouette floating gracefully before her left hand!
        float_y = far_hy - 3 - (1 if pose == "idle2" else 0)
        float_x = far_hx - 10
        draw_ice_hexagon(sp, float_x, float_y, tall=True, bright=(pose == "idle2"))

        # Peak-breath micro crystal sparkle floating cleanly above-left ONLY on idle2 (alive loop!)
        if pose == "idle2":
            sp.layer("fx")
            gx, gy = float_x - 5, float_y - 6
            sp.px(gx, gy, PURE_WHT)
            sp.px(gx - 1, gy, ICE_HI)
            sp.px(gx + 1, gy, ICE_HI)
            sp.px(gx, gy - 1, ICE_HI)
            sp.px(gx, gy + 1, ICE_MID)
        cast_x, cast_y = float_x - 3, float_y

    elif pose == "windup":
        # DUAL independently levitating glowing mirror-ice HEXAGON prisms (clean air gap, zero stick!)
        p1_x, p1_y = far_hx - 10, far_hy - 2
        p2_x, p2_y = hx - 12, hy + 3
        draw_ice_hexagon(sp, p1_x, p1_y, tall=True, bright=True)
        draw_ice_hexagon(sp, p2_x, p2_y, tall=False, bright=True)

        # Intense snowflake-star arcane charge flares on fx layer!
        sp.layer("fx")
        # Radiant 4-point snowflake-star flare crowning upper prism
        sx, sy = p1_x, p1_y - 8
        sp.px(sx, sy, PURE_WHT)
        for d in (1, 2, 3):
            col = PURE_WHT if d == 1 else (ICE_HI if d == 2 else ICE_MID)
            sp.px(sx + d, sy, col)
            sp.px(sx - d, sy, col)
            sp.px(sx, sy + d, col)
            sp.px(sx, sy - d, col)
        for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            sp.px(sx + ddx, sy + ddy, ICE_CORE)

        # Crisp frost resonance spark floating cleanly beside lower prism
        sp.px(p2_x - 5, p2_y, PURE_WHT)
        sp.px(p2_x - 6, p2_y, ICE_HI)
        sp.px(p2_x - 5, p2_y - 1, ICE_CORE)
        sp.px(p2_x - 5, p2_y + 1, ICE_MID)

        # Delicate frost gathering glint right at raised fingertips
        sp.px(far_hx - 4, far_hy - 2, PURE_WHT)
        sp.px(far_hx - 5, far_hy - 2, ICE_HI)
        cast_x, cast_y = p1_x - 3, (p1_y + p2_y) // 2

    elif pose == "strike":
        # Open faceted mirror-ice hexagon gate framing her outstretched left palm,
        # launching 3 STAGGERED RAZOR-SHARP GLACIAL SHARDS shooting LEFT (2px left-margin buffer)!
        ring_x, ring_y = hx - 5, hy
        draw_ice_hexagon(sp, ring_x, ring_y, tall=False, bright=True)

        # 1) Lead central needle-sharp glacial crystal lance (tip at x = 3, fx halo at x = 2!)
        tip_x = max(3, ring_x - 15)
        tip_y = ring_y
        lance_len = ring_x - 3 - tip_x
        for k in range(lance_len + 1):
            px_s = tip_x + k
            t = k / max(1, lance_len)
            if t < 0.28:
                sp.px(px_s, tip_y, PURE_WHT)
            elif t < 0.62:
                sp.px(px_s, tip_y - 1, PURE_WHT if t < 0.46 else ICE_CORE)
                sp.px(px_s, tip_y, ICE_HI)
            else:
                sp.px(px_s, tip_y - 1, ICE_CORE)
                sp.px(px_s, tip_y, PURE_WHT if t < 0.78 else ICE_HI)
                sp.px(px_s, tip_y + 1, ICE_MID if t < 0.85 else EYE_DARK)

        # 2) Upper staggered razor-sharp needle glacial shard (tapered tip AND tail!)
        u_tip_x = max(5, ring_x - 13)
        u_tip_y = ring_y - 6
        for k in range(9):
            px_u = u_tip_x + k
            if k < 2:
                sp.px(px_u, u_tip_y, PURE_WHT)
            elif k < 6:
                sp.px(px_u, u_tip_y, PURE_WHT if k < 4 else ICE_CORE)
                sp.px(px_u, u_tip_y + 1, ICE_HI if k < 5 else ICE_MID)
            else:
                sp.px(px_u, u_tip_y, ICE_HI if k < 8 else ICE_MID)

        # 3) Lower staggered razor-sharp needle glacial shard (tapered tip AND tail!)
        d_tip_x = max(4, ring_x - 14)
        d_tip_y = ring_y + 6
        for k in range(8):
            px_d = d_tip_x + k
            if k < 2:
                sp.px(px_d, d_tip_y, PURE_WHT)
            elif k < 5:
                sp.px(px_d, d_tip_y, ICE_CORE if k < 4 else ICE_HI)
                sp.px(px_d, d_tip_y + 1, ICE_MID if k < 4 else EYE_DARK)
            else:
                sp.px(px_d, d_tip_y, ICE_HI if k < 7 else ICE_MID)

        # Sleek piercing frost speed-smears on fx layer (safely x >= 2!)
        sp.layer("fx")
        sp.px(max(2, tip_x - 1), tip_y, ICE_HI)
        sp.px(tip_x, tip_y, PURE_WHT)
        sp.px(tip_x + 1, tip_y - 1, ICE_HI)
        sp.px(tip_x + 2, tip_y - 1, PURE_WHT)
        sp.px(tip_x + 1, tip_y + 1, ICE_HI)
        sp.px(tip_x + 2, tip_y + 1, ICE_MID)

        # Vertical crystalline flash cross at mirror gate
        for dy_f in (-6, -5, 5, 6):
            sp.px(ring_x, ring_y + dy_f, ICE_HI if abs(dy_f) == 5 else ICE_MID)

        # Crisp connected trailing frost wakes behind upper & lower shards
        for k in range(3):
            sp.px(u_tip_x + 9 + k, u_tip_y, ICE_HI if k < 2 else ICE_MID)
            sp.px(d_tip_x + 8 + k, d_tip_y, ICE_HI if k < 2 else ICE_MID)

        cast_x, cast_y = tip_x, tip_y

    elif pose == "hurt":
        # Two crisp fractured mirror-ice crystal splinters + dynamic recoil glint!
        f1_x, f1_y = far_hx - 9, far_hy - 6
        f2_x, f2_y = far_hx - 11, far_hy + 2

        sp.px(f1_x, f1_y - 2, PURE_WHT)
        hspan(sp, f1_y - 1, f1_x - 1, f1_x + 1, ICE_CORE)
        sp.px(f1_x + 1, f1_y - 1, ICE_HI)
        hspan(sp, f1_y, f1_x - 1, f1_x + 1, ICE_HI)
        sp.px(f1_x + 1, f1_y, EYE_DARK)
        sp.px(f1_x, f1_y + 1, ICE_MID)

        sp.px(f2_x, f2_y - 2, PURE_WHT)
        hspan(sp, f2_y - 1, f2_x - 1, f2_x + 1, ICE_CORE)
        hspan(sp, f2_y, f2_x - 1, f2_x + 1, ICE_HI)
        sp.px(f2_x + 1, f2_y, ICE_MID)
        sp.px(f2_x, f2_y + 1, EYE_DARK)

        # Dynamic shatter spark trail on fx layer (connected 2px cluster!)
        sp.layer("fx")
        sp.px(f1_x - 3, f1_y - 2, PURE_WHT)
        sp.px(f1_x - 4, f1_y - 2, ICE_HI)
        cast_x, cast_y = f1_x, f1_y

    return cast_x, cast_y


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    ("idle1",   0,   0,    0, 260),
    ("idle2",   0,  -1,    1, 260),
    ("blink",   0,   0,    0, 140),
    ("windup",  2,   1,    1, 180),
    ("strike", -4,   0,    2, 160),
    ("hurt",    3,   1,   -2, 220),
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
        waist_y = neck_y + 12

        draw_back_hair(sp, cx, head_y, pose, sway)
        far_hx, far_hy = draw_far_arm(sp, cx, torso_y, pose)
        draw_legs_boots(sp, cx, GROUND_Y, pose)
        draw_coat_skirt(sp, cx, waist_y, pose, sway)
        draw_torso(sp, cx, neck_y, pose)
        draw_head(sp, cx, head_y, pose, sway)
        cast_x, cast_y = draw_near_arm_and_magic(sp, cx, torso_y, pose, far_hx, far_hy)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx - 1, head_y + 16)
            anchors["hit_px"] = (cx - 1, torso_y + 9)
        if pose == "strike":
            anchors["cast_px"] = (max(2, cast_x), cast_y)

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
        assert max(ys) == GROUND_Y, f"Frame {fi} boot baseline {max(ys)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "aino",
        "file": "assets/sprites/aino_sheet.png",
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
        "buildScript": "tools/pixel_art/aino/build.py",
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
