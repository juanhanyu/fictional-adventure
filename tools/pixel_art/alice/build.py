#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Alice Vesteria 9yo (alice) — Act 3 Rival.

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 72 x 80, 6 horizontal frames (432 x 80 sheet, padding=0).
Facing: left. GROUND_Y = 74, PIVOT_X = 39.

Pass 3 (Final Jewelry Polish):
- Softened arched upper lashes (INK_MID outer/inner corners) + diagonal crystal glints on sky-blue eyes
- Gently curved silky center hair part + seamless tangential outer shoulder wisp join
- Daintier balanced strike back-leg stride + gleaming Mary Jane silver strap buckle
- Untangled windup hands cupping glowing breeze vortex from underneath in open air (zero outline clash)
- Crisp open-air release gap between outstretched strike palms and sweeping crescent wind gale arc
- Soft curved hurt breeze puff (no diagonal stick) & silky shimmer on idle wind ribbon
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

SHEET_PATH = os.path.join(SPRITES_DIR, "alice_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "alice_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
FACE_ZOOM_PATH = os.path.join(HERE, "face_zoom.png")

# ---------------------------------------------------------------------------
# Master 24-Color Hue-Shifted Anime JRPG Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
PURE_WHT = "#ffffff"  # Snow-white sunlit highlights, eye catchlights, breeze gleam
SNOW_HI  = "#e2e8f8"  # Luminous snow-white hair midtone & pure white dress lit base
PERI_MID = "#aeb9d8"  # Cool pale-periwinkle hair shadow & dress ruffle fold midtone
PERI_SH  = "#7a86ad"  # Deep cool periwinkle hair grooves, skirt pleat shadow, brows, crown selout

INK_DARK = "#202747"  # Deep cool indigo ink: shadow outlines, eye upper lashes, shoe soles
INK_MID  = "#485684"  # Medium slate-indigo selective outline for lit white hair & dress flanks
INK_SKIN = "#965e62"  # Warm muted rose-umber jawline & hand selective outline

SKIN_HI  = "#fff1ea"  # Warm porcelain forehead & cheek highlight
SKIN_MID = "#fbdcc9"  # Warm porcelain skin base
SKIN_SH1 = "#e0a998"  # Soft peach-rose skin shadow
SKIN_SH2 = "#ba7b72"  # Chin/neck rose-umber shadow & gentle serene mouth
BLUSH    = "#f59cb4"  # Soft rosy anime cheek blush & casting mouth

SAP_DARK = "#1f4da6"  # Deep sky-sapphire upper iris & jewel depth
SAP_MID  = "#4490ee"  # Vivid cerulean-sky mid iris & sapphire hairpin/brooch gem
SKY_HI   = "#8fd4ff"  # Luminous crystal sky-blue lower iris crescent & gem facet

SHOE_HI  = "#c4d7f0"  # Pale silver-blue Mary Jane shoe highlight & dress hem lace sheen
SHOE_MID = "#8ea7cf"  # Pale silver-blue Mary Jane shoe base & subtle waist/hem satin ribbon
SHOE_SH  = "#5a72a3"  # Silver-blue shoe shadow & deep ruffled tier shadow accent

GLD_HI   = "#fce9a4"  # Gleaming champagne-gold filigree highlight
GLD_MID  = "#d6ad62"  # Champagne-gold hairpin filigree & vertical pendant chain
GLD_SH   = "#996f34"  # Burnished antique gold filigree shadow

WIND_HI  = "#b8f7f0"  # Luminous mint-aqua wind ribbon highlight & breeze mote glow
WIND_MID = "#5fd4c8"  # Vivid emerald-aqua wind ribbon body
WIND_DK  = "#289999"  # Crisp deep emerald-teal wind contrast accent (pops on light sky!)

PALETTE = [
    PURE_WHT, SNOW_HI, PERI_MID, PERI_SH,
    INK_DARK, INK_MID, INK_SKIN,
    SKIN_HI, SKIN_MID, SKIN_SH1, SKIN_SH2, BLUSH,
    SAP_DARK, SAP_MID, SKY_HI,
    SHOE_HI, SHOE_MID, SHOE_SH,
    GLD_HI, GLD_MID, GLD_SH,
    WIND_HI, WIND_MID, WIND_DK,
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


def draw_curve(sp: Sprite, pts: list[tuple[float, float]], col: str):
    """Draw a smooth 4/8-connected pixel curve through control points."""
    for i in range(len(pts) - 1):
        x0, y0 = int(round(pts[i][0])), int(round(pts[i][1]))
        x1, y1 = int(round(pts[i + 1][0])), int(round(pts[i + 1][1]))
        sp.line(x0, y0, x1, y1, col)


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected light- and material-aware selective outer outline:
    - Lit left/top white hair & dress flanks -> crisp slate-indigo INK_MID (soft PERI_SH at topmost crown)
    - Skin jawline -> warm rose-umber INK_SKIN
    - Shadow-side (right), undersides & shoes -> deep cool indigo INK_DARK
    Ensures white hair & pure white dress POP cleanly on BOTH light sky and dark dusk!"""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_peri_sh  = hex2rgba(PERI_SH)
    rgba_ink_mid  = hex2rgba(INK_MID)
    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_ink_skin = hex2rgba(INK_SKIN)

    white_lit_set = {hex2rgba(PURE_WHT)[:3], hex2rgba(SNOW_HI)[:3]}
    white_all_set = white_lit_set | {hex2rgba(PERI_MID)[:3]}
    skin_set = {hex2rgba(SKIN_HI)[:3], hex2rgba(SKIN_MID)[:3], hex2rgba(SKIN_SH1)[:3], hex2rgba(BLUSH)[:3]}
    gold_set = {hex2rgba(GLD_HI)[:3], hex2rgba(GLD_MID)[:3]}

    body_layers = [ln for ln in sp.layer_order if ln not in ("fx", "fx_back", "outline")]
    body_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in body_layers]

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            nbrs = []
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    if any(bp[nx, ny][3] > 0 for bp in body_pxs):
                        nbrs.append((dx, dy, src[nx, ny][:3]))
            if not nbrs:
                continue

            dirs = {(dx, dy) for dx, dy, _ in nbrs}
            rgb_list = [rgb for _, _, rgb in nbrs]

            is_top_edge = (0, 1) in dirs and (0, -1) not in dirs
            is_left_flank = (1, 0) in dirs and (-1, 0) not in dirs
            is_underside = (0, -1) in dirs and (0, 1) not in dirs

            if any(rgb in skin_set for rgb in rgb_list) and y < 37 and not any(rgb == hex2rgba(PERI_SH)[:3] for rgb in rgb_list):
                dst[x, y] = rgba_ink_skin
            elif is_top_edge and y < 14 and all(rgb in white_all_set for rgb in rgb_list):
                # Luminous soft periwinkle selout only along the very top sunlit crown arch
                dst[x, y] = rgba_peri_sh
            elif (is_top_edge or is_left_flank) and not is_underside and y < 65 and any(
                rgb in white_all_set or rgb in gold_set for rgb in rgb_list
            ):
                # Silky slate-indigo selout on all lit left-facing white hair & dress contours!
                dst[x, y] = rgba_ink_mid
            elif y >= 67:
                dst[x, y] = rgba_ink_dark
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters (Facing LEFT)
# ---------------------------------------------------------------------------

def draw_back_hair(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Flowing pure snow-white wavy long hair with sculpted waist contour, billowing S-waves,
    luminous sunlit wave crests, and 4 cleanly separated curled wispy lock tips!"""
    sp.layer("back_hair")
    rows = {}
    top_y = head_y + 6
    bot_y = head_y + 47  # Stops cleanly above skirt bottom so separated curled locks dance freely!

    for i in range(bot_y - top_y + 1):
        y = top_y + i
        t = i / max(1, (bot_y - top_y))

        # Flowing S-wave trailing RIGHT (Alice faces LEFT)
        if pose == "strike":
            wave = math.sin(t * 5.2) * 2.0
            curve = int(round(t * 11.5 + wave))
        elif pose == "hurt":
            wave = math.sin(t * 4.5 + 0.6) * 2.4
            curve = int(round(t * 5.5 + wave))
        elif pose == "windup":
            wave = math.sin(t * 5.5) * 2.2
            curve = int(round(t * 7.2 + wave))
        else:
            wave = math.sin(t * 5.2) * 1.9
            curve = int(round(t * 4.8 + wave)) + int(round(sway * t * 1.6))

        # Inner-left boundary tucks gracefully behind shoulder/waist so skirt shows clearly!
        if t < 0.25:
            lx = cx - 8 + int(round(t * 8))
        elif t < 0.62:
            lx = cx - 4 + int(round((t - 0.25) * 16))
        else:
            lx = cx + 2 + int(round((t - 0.62) * 14)) + int(round(curve * 0.42))

        # Sculpted wavy outer-right contour (gentle waist cinch around t=0.45, billowing lower flare!)
        if t < 0.24:
            rx = cx + 9 + int(round(t * 15)) + curve
        elif t < 0.54:
            # Graceful slight inward S-dip at waist before flaring outward!
            rx = cx + 12 + int(round(math.sin((t - 0.24) * 5.0) * 1.5)) + curve
        else:
            rx = cx + 13 + int(round((t - 0.54) * 5.5)) + curve

        rx = min(W - 3, rx)
        if rx >= lx:
            rows[y] = (lx, rx)

    fill_rows(sp, rows, PERI_MID)

    # Lush wavy snow-white ribbon shading (zero flat grey slabs even in strike!)
    for y, (lx, rx) in rows.items():
        t = (y - top_y) / max(1, (bot_y - top_y))
        w1 = math.sin(t * 8.0)
        w2 = math.sin(t * 6.4 + 1.8)
        span = rx - lx

        # Inner bright snow-white flow catching top-left light
        if span >= 4:
            hspan(sp, y, lx, min(rx - 2, lx + 4), SNOW_HI)
            if t < 0.72 and w1 > -0.2:
                sp.px(lx + 1, y, PURE_WHT)

        # Mid wavy silk ribbon highlight
        mid_r = lx + int(round(span * 0.52 + w1 * 1.5))
        if lx + 1 < mid_r < rx - 2:
            hspan(sp, y, mid_r - 1, mid_r + 1, SNOW_HI)
            if w1 > 0.15:
                sp.px(mid_r, y, PURE_WHT)

        # Outer wavy snow-white highlight crest before trailing shadow edge
        out_r = rx - 3 + int(round(w2 * 1.1))
        if lx + 2 < out_r < rx - 1:
            hspan(sp, y, out_r - 1, out_r, SNOW_HI if t < 0.85 else PERI_MID)
            if w2 > 0.30 and t < 0.75:
                sp.px(out_r - 1, y, PURE_WHT)

        # Cool periwinkle shadow grooves separating wavy locks
        gr1 = lx + int(round(span * 0.34 + w2 * 1.1))
        if lx + 1 < gr1 < rx - 1:
            sp.px(gr1, y, PERI_SH)
        gr2 = rx - 1
        if gr2 > lx + 2:
            sp.px(gr2, y, PERI_SH if (t > 0.25 and w1 < 0.35) else PERI_MID)
        sp.px(rx, y, PERI_SH)

        # Subtle cast shadow directly behind torso/waist on left side of back hair
        sh_w = min(rx - 4, cx + 6)
        if lx <= sh_w and 0.18 < t < 0.65:
            hspan(sp, y, lx, sh_w, PERI_SH)

    # Carve clean tapered wave-gaps at bottom & paint 4 distinct curled wispy locks!
    base_lx, base_rx = rows.get(bot_y - 3, (cx + 7, cx + 19))
    for y in range(bot_y - 2, bot_y + 1):
        for x in range(base_lx - 1, min(W - 1, base_rx + 2)):
            sp.px(x, y, None)

    # 4 separated bouncy curled snow-white locks (staggered lengths & airy gaps!)
    locks = [
        # (start_x, start_y_off, length, curl_dir, is_lit)
        (base_lx,          -3,  6,  1, False),
        (base_lx + 4,      -2,  9,  1, True),
        (base_lx + 9,      -3, 10,  1, True),
        (min(W - 5, base_rx - 2), -4,  7,  1, True),
    ]
    for bx, y_off, length, dir_x, is_lit in locks:
        by = bot_y + y_off
        for k in range(length):
            t_k = k / max(1, length - 1)
            w = 3 if k < 2 else (2 if k < length - 2 else 1)
            # Gentle curl sweep outward at tip!
            curl = int(round(dir_x * (k * 0.45 + (t_k ** 2) * 2.2)))
            px_x = min(W - 3, bx + curl)
            if k < length - 3:
                col = SNOW_HI if is_lit else PERI_MID
            elif k < length - 1:
                col = PERI_MID
            else:
                col = PERI_SH
            hspan(sp, by + k, px_x, min(W - 3, px_x + w - 1), col)
            if is_lit and k < 3:
                sp.px(px_x, by + k, PURE_WHT)

    # Playful loose curling wave strand flowing tangentially off outer-right shoulder in motion frames!
    wisp_y = head_y + 24
    wisp_rx = rows.get(wisp_y, (cx, cx + 15))[1]
    if pose in ("idle2", "windup", "strike", "hurt"):
        for k in range(6):
            wx = min(W - 3, wisp_rx + (1 if k < 2 else (2 if k < 4 else 3)))
            wy = wisp_y + k
            sp.px(wx, wy, PURE_WHT if k < 2 else (SNOW_HI if k < 4 else (PERI_MID if k < 5 else PERI_SH)))
            if k < 4 and wx - 1 >= 0:
                sp.px(wx - 1, wy, SNOW_HI if k < 2 else PERI_MID)

    # Soft wavy snow-white lock spilling lightly behind far-left shoulder (matches portrait!)
    if pose not in ("strike", "windup"):
        ly0 = head_y + 22
        for k in range(16):
            t = k / 15.0
            wy = ly0 + k
            wx = cx - 9 - int(round(math.sin(t * 4.5) * 1.3)) - (1 if pose == "hurt" else 0)
            w = 3 if k < 8 else (2 if k < 13 else 1)
            hspan(sp, wy, wx, wx + w - 1, SNOW_HI if k < 10 else PERI_MID)
            if k < 8:
                sp.px(wx, wy, PURE_WHT)
            if w >= 3:
                sp.px(wx + w - 1, wy, PERI_MID)


def draw_legs_shoes(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Crisp white stockings + dainty pale silver-blue Mary Jane shoes facing LEFT,
    locked squarely to GROUND_Y = 74, with smooth graceful strike stride."""
    sp.layer("legs")

    if pose == "strike":
        # Smooth graceful dainty glide-lunge LEFT (balanced stride!)
        far_fx, far_fy = cx - 6, ground_y
        near_fx, near_fy = cx + 5, ground_y
        far_top_x = cx - 3
        near_top_x = cx + 3
    elif pose == "windup":
        far_fx, far_fy = cx - 4, ground_y
        near_fx, near_fy = cx + 4, ground_y
        far_top_x = cx - 2
        near_top_x = cx + 3
    elif pose == "hurt":
        far_fx, far_fy = cx - 5, ground_y - 1
        near_fx, near_fy = cx + 4, ground_y
        far_top_x = cx - 2
        near_top_x = cx + 3
    else:
        far_fx, far_fy = cx - 4, ground_y
        near_fx, near_fy = cx + 4, ground_y
        far_top_x = cx - 2
        near_top_x = cx + 3

    hip_y = ground_y - 14  # y = 60

    def _draw_one_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        shoe_top_y = foot_y - 4
        sock_hi  = SNOW_HI  if is_far else PURE_WHT
        sock_mid = PERI_MID if is_far else SNOW_HI
        sock_sh  = PERI_SH  if is_far else PERI_MID

        sh_hi  = SHOE_MID if is_far else SHOE_HI
        sh_mid = SHOE_SH  if is_far else SHOE_MID
        sh_sh  = INK_MID  if is_far else SHOE_SH

        span_h = max(1, shoe_top_y - hip_y)
        for y in range(hip_y, shoe_top_y + 1):
            t = (y - hip_y) / span_h
            # Smooth linear interpolation of center-x so diagonal legs never jagged-step!
            cx_leg = top_x + (foot_x - top_x) * t
            lx = int(round(cx_leg - 1.2))
            w = 3
            hspan(sp, y, lx, lx + w - 1, sock_mid)
            sp.px(lx, y, sock_hi)
            sp.px(lx + w - 1, y, sock_sh)
            # Crisp skirt cast shadow on upper stockings
            if y <= hip_y + 3:
                hspan(sp, y, lx, lx + w - 1, PERI_SH if is_far else PERI_MID)
                sp.px(lx + w - 1, y, PERI_SH)

        # Dainty pale silver-blue Mary Jane shoe pointing LEFT!
        bx = foot_x
        # Ankle cuff + cute white stocking instep dot!
        hspan(sp, foot_y - 3, bx - 2, bx + 1, sh_mid)
        sp.px(bx - 1, foot_y - 3, sock_hi)
        sp.px(bx - 2, foot_y - 3, sh_hi)
        sp.px(bx + 1, foot_y - 3, sh_sh)

        # Mary Jane silver-blue strap + tiny gleaming silver clasp pixel on near shoe!
        hspan(sp, foot_y - 2, bx - 3, bx + 1, sh_mid)
        sp.px(bx - 2, foot_y - 2, sh_hi)
        sp.px(bx - 1, foot_y - 2, PURE_WHT if not is_far else sh_hi)
        sp.px(bx + 1, foot_y - 2, sh_sh)

        # Rounded shoe toe pointing left
        hspan(sp, foot_y - 1, bx - 4, bx + 1, sh_mid)
        hspan(sp, foot_y - 1, bx - 3, bx - 1, sh_hi)
        sp.px(bx + 1, foot_y - 1, sh_sh)

        # Grounded sole locked cleanly on foot_y (GROUND_Y = 74)
        hspan(sp, foot_y, bx - 4, bx + 1, INK_DARK)
        sp.px(bx - 2, foot_y, sh_sh)

    _draw_one_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_one_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_far_arm(sp: Sprite, cx: int, torso_y: int, pose: str):
    """Far (viewer's LEFT) puffy white fairy bell-sleeve, lace cuff & delicate porcelain hand."""
    sp.layer("far_arm")
    sx, sy = cx - 5, torso_y + 2

    if pose == "windup":
        # Cradling cleanly underneath the left side of the hovering breeze orb (zero orb overlap!)
        el_x, el_y = cx - 10, torso_y + 7
        hx, hy = cx - 18, torso_y + 5
    elif pose == "strike":
        # Extended cleanly LEFT with crisp release gap before the crescent gale arc!
        el_x, el_y = cx - 9, torso_y + 3
        hx, hy = cx - 13, torso_y + 2
    elif pose == "hurt":
        el_x, el_y = cx - 9, torso_y + 5
        hx, hy = cx - 13, torso_y + 2
    else:
        # Gentle fairy-mage poise holding the breeze softly forward-left
        el_x, el_y = cx - 8, torso_y + 7
        hx, hy = cx - 12, torso_y + 10

    # Puffy white fairy sleeve tapering smoothly into wrist (never detached!)
    sp.polygon([
        (sx + 1, sy),
        (sx - 3, sy + 1),
        (el_x - 2, el_y),
        (el_x + 2, el_y + 2),
        (sx + 1, sy + 4),
    ], SNOW_HI, fill=True)
    sp.line(sx - 2, sy + 1, el_x - 2, el_y, PURE_WHT)
    sp.line(sx, sy + 3, el_x + 1, el_y + 2, PERI_MID)

    # Full connected bell-cuff forearm to wrist
    sp.polygon([
        (el_x - 2, el_y),
        (el_x + 2, el_y + 2),
        (hx + 2, hy + 1),
        (hx + 1, hy - 2),
    ], SNOW_HI, fill=True)
    sp.line(el_x - 1, el_y, hx + 1, hy - 1, PURE_WHT)
    sp.line(el_x + 1, el_y + 2, hx + 2, hy + 1, PERI_MID)
    # Ruffled lace cuff right at wrist
    sp.px(hx + 1, hy - 1, PURE_WHT)
    sp.px(hx + 2, hy,     PERI_MID)
    sp.px(hx + 2, hy + 1, PERI_SH)

    # Delicate porcelain hand
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)

    return hx, hy


def draw_skirt(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Pure white two-tiered ruffled noble fairy-princess skirt:
    - Clean scalloped wave lace upper overskirt (zero pixel speckle!)
    - Crisp cast-shadow arc separating upper & lower skirt tiers
    - Graceful vertical pleats + pale silver-blue satin hem ribbon + scalloped lace petticoat."""
    sp.layer("skirt")
    skirt_h = 13

    if pose == "strike":
        shift_bot = 4
        flare_l, flare_r = 11, 13
    elif pose == "hurt":
        shift_bot = -2
        flare_l, flare_r = 12, 10
    elif pose == "windup":
        shift_bot = 1
        flare_l, flare_r = 12, 12
    else:
        shift_bot = sway
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
            # 4 crisp wide silk pleats across skirt (reads ultra-clean at 1x & 6x!)
            pleat = (u * 4.2) % 1.0
            if u < 0.14:
                col = PURE_WHT if i > 1 else SNOW_HI
            elif u > 0.86:
                col = PERI_SH if pleat < 0.60 else PERI_MID
            elif pleat < 0.22:
                col = PERI_SH if u > 0.45 else PERI_MID
            elif pleat < 0.58:
                col = SNOW_HI if u < 0.66 else PERI_MID
            else:
                col = PURE_WHT if u < 0.55 else SNOW_HI
            sp.px(x, y, col)

        # Gathered fairy waist sash band (clean pale silver-blue & periwinkle fold)
        if i == 0:
            hspan(sp, y, lx, rx, PERI_SH)
            hspan(sp, y, lx + 1, cx, SHOE_MID)
            hspan(sp, y, lx + 1, lx + 3, SHOE_HI)

        # Clean scalloped lace overskirt tier hem (i = 5..7) — ZERO noisy speckle!
        if i == 5:
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                # 4 wide graceful arches across overskirt
                sc = (u * 4.2) % 1.0
                if 0.20 <= sc <= 0.82:
                    sp.px(x, y, PURE_WHT if u < 0.62 else SNOW_HI)
        elif i == 6:
            # Scallop arch crests + crisp dip notches
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                sc = (u * 4.2) % 1.0
                if sc < 0.18 or sc > 0.86:
                    sp.px(x, y, PERI_SH if u > 0.40 else PERI_MID)
                else:
                    sp.px(x, y, PURE_WHT if u < 0.56 else SNOW_HI)
        elif i == 7:
            # Unbroken clean cast-shadow arc right under the overskirt ruffle!
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                sc = (u * 4.2) % 1.0
                if 0.14 <= sc <= 0.88:
                    sp.px(x, y, PERI_SH if u > 0.45 else PERI_MID)

        # Gleaming pale silver-blue satin ribbon trim near lower hem (i == skirt_h - 2)
        if i == skirt_h - 2:
            for x in range(lx + 1, rx):
                u = (x - lx) / span
                pleat = (u * 4.2) % 1.0
                if pleat < 0.22 or u > 0.84:
                    tcol = SHOE_SH
                elif u < 0.28 or (u < 0.60 and pleat > 0.56):
                    tcol = SHOE_HI
                else:
                    tcol = SHOE_MID
                sp.px(x, y, tcol)
        elif i == skirt_h:
            hspan(sp, y, lx, rx, PERI_SH)
            hspan(sp, y, lx + 1, cx, PERI_MID)

    # Scalloped pure-white lace petticoat hem peeking cleanly below skirt
    y_lace = waist_y + skirt_h + 1
    lx_b = int(round(cx - 5 - flare_l + shift_bot)) + 1
    rx_b = int(round(cx + 5 + flare_r + shift_bot)) - 1
    for x in range(lx_b, rx_b + 1):
        u = (x - lx_b) / max(1, rx_b - lx_b)
        if (x - lx_b) % 4 == 3:
            sp.px(x, y_lace, PERI_MID if u < 0.58 else PERI_SH)
        else:
            sp.px(x, y_lace, PURE_WHT if u < 0.52 else SNOW_HI)


def draw_torso(sp: Sprite, cx: int, neck_y: int, pose: str):
    """Pure white ruffled noble fairy-princess bodice:
    - High ruffled stand-up lace collar
    - Wide crisp white silk neck bow with clear under-bow fold shadow
    - Gold-rimmed oval sky-blue sapphire brooch & vertical champagne-gold pendant chain + diamond charm
    - Scalloped chest lace jabot & delicate shoulder cap-flounces."""
    sp.layer("torso")

    # Slender porcelain neck
    for y in range(neck_y - 2, neck_y + 1):
        hspan(sp, y, cx - 2, cx + 1, SKIN_MID)
        sp.px(cx - 2, y, SKIN_HI)
        sp.px(cx + 1, y, SKIN_SH1)
    hspan(sp, neck_y - 2, cx - 2, cx + 1, SKIN_SH2)

    # High ruffled white stand-up lace collar
    hspan(sp, neck_y - 1, cx - 3, cx + 2, PURE_WHT)
    sp.px(cx - 1, neck_y - 1, PERI_MID)
    sp.px(cx + 1, neck_y - 1, PERI_MID)
    sp.px(cx + 2, neck_y - 1, PERI_SH)

    hspan(sp, neck_y, cx - 4, cx + 3, SNOW_HI)
    sp.px(cx - 4, neck_y, PURE_WHT)
    sp.px(cx + 2, neck_y, PERI_MID)
    sp.px(cx + 3, neck_y, PERI_SH)

    # Dainty tailored white fairy-princess bodice
    torso_shape = {
        1:  (-5, 5),
        2:  (-6, 6),
        3:  (-6, 6),
        4:  (-5, 5),
        5:  (-5, 5),
        6:  (-5, 5),
        7:  (-4, 5),
        8:  (-4, 4),
        9:  (-4, 4),
        10: (-4, 4),
        11: (-5, 5),
        12: (-5, 5),
    }

    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        hspan(sp, y, cx + dl, cx + dr, SNOW_HI)
        hspan(sp, y, cx + dl, cx - 2, PURE_WHT)
        hspan(sp, y, cx + dr - 2, cx + dr, PERI_MID)
        sp.px(cx + dr, y, PERI_SH)

        # Crisp scalloped ruffled jabot bib contour on chest
        if 4 <= dy <= 6:
            sp.px(cx - 4, y, PERI_MID)
            sp.px(cx + 2, y, PERI_MID)
            if dy == 6:
                hspan(sp, y, cx - 4, cx + 2, PERI_MID)
                sp.px(cx - 3, y, PURE_WHT)
                sp.px(cx - 1, y, PURE_WHT)
                sp.px(cx + 1, y, SNOW_HI)
        elif 7 <= dy <= 10:
            sp.px(cx - 3, y, PERI_MID)
            sp.px(cx + 1, y, PERI_MID)
        elif dy == 11:
            # Gathered high-waist satin band
            hspan(sp, y, cx + dl, cx + dr, PERI_MID)
            hspan(sp, y, cx + dl, cx - 1, SHOE_HI)
            sp.px(cx + dr, y, PERI_SH)

    # Shoulder lace cap-flounces
    sp.px(cx - 6, neck_y + 2, PURE_WHT)
    sp.px(cx - 6, neck_y + 3, PERI_MID)
    sp.px(cx + 6, neck_y + 2, SNOW_HI)
    sp.px(cx + 6, neck_y + 3, PERI_SH)

    # Wide Crisp White Silk Collar Bow (with sharp periwinkle under-shadow so bow wings pop!)
    by = neck_y + 1
    # Left bow wing (5px wide)
    hspan(sp, by,     cx - 5, cx - 2, PURE_WHT)
    hspan(sp, by + 1, cx - 5, cx - 2, SNOW_HI)
    sp.px(cx - 5, by + 1, PURE_WHT)
    hspan(sp, by + 2, cx - 4, cx - 2, PERI_SH)  # crisp lower bow crease!
    # Right bow wing (4px wide)
    hspan(sp, by,     cx + 1, cx + 4, SNOW_HI)
    hspan(sp, by + 1, cx + 1, cx + 4, PERI_MID)
    hspan(sp, by + 2, cx + 1, cx + 3, PERI_SH)  # crisp lower bow crease!
    # Bow tails peeking below
    sp.px(cx - 3, by + 3, SNOW_HI)
    sp.px(cx - 2, by + 3, PERI_MID)
    sp.px(cx + 1, by + 3, PERI_MID)
    sp.px(cx + 2, by + 3, PERI_SH)

    # Ornate Gold-Rimmed Sky-Blue Sapphire Brooch right at bow center (cx - 1 .. cx)!
    sp.px(cx - 1, by,     GLD_HI)
    sp.px(cx,     by,     GLD_MID)
    sp.px(cx - 2, by + 1, GLD_HI)
    sp.px(cx - 1, by + 1, PURE_WHT)  # sapphire top sparkle
    sp.px(cx,     by + 1, SKY_HI)
    sp.px(cx + 1, by + 1, GLD_SH)
    sp.px(cx - 1, by + 2, SAP_MID)
    sp.px(cx,     by + 2, SAP_DARK)
    sp.px(cx - 1, by + 3, GLD_MID)

    # Iconic Vertical Champagne-Gold Pendant Chain & Filigree Diamond Charm!
    for dy in range(4, 9):
        py = by + dy
        sp.px(cx - 1, py, GLD_HI if dy % 2 == 0 else GLD_MID)
        if dy == 6:
            sp.px(cx, py, GLD_SH)
    cy_ch = by + 9
    sp.px(cx - 1, cy_ch - 1, GLD_HI)
    sp.px(cx - 2, cy_ch,     GLD_MID)
    sp.px(cx - 1, cy_ch,     PURE_WHT)
    sp.px(cx,     cy_ch,     GLD_SH)
    sp.px(cx - 1, cy_ch + 1, GLD_MID)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str, sway: int):
    """Dainty 3/4 left-facing anime head, porcelain skin, big gentle dreamy crystal sky-blue eyes,
    luminous snow-white hair crown & wispy center-parted bangs, and Alice's iconic prominent
    white lace double-bow + gold-rimmed oval sapphire hairpin with dangling pearl-gold chains!"""
    sp.layer("head")

    # 1) Soft tapered dainty warm porcelain face (facing LEFT)
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
        19: (-9, 7),
        20: (-8, 7),
        21: (-8, 6),
        22: (-7, 5),
        23: (-6, 4),
        24: (-4, 2),
        25: (-3, 0),
    }
    for dy, (dl, dr) in face_rows.items():
        y = head_y + dy
        hspan(sp, y, cx + dl, cx + dr, SKIN_MID)
        if 14 <= dy <= 21:
            hspan(sp, y, cx + dl + 1, cx + 1, SKIN_HI)
        if 12 <= dy <= 23:
            sp.px(cx + dr, y, SKIN_SH1)
        if dy == 24:
            sp.px(cx + dl, y, SKIN_SH1)
            sp.px(cx + dr - 1, y, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)
        if dy == 25:
            hspan(sp, y, cx + dl, cx + dr, SKIN_SH1)
            sp.px(cx + dr, y, SKIN_SH2)

    for x in (cx - 7, cx - 2, cx - 1, cx + 5, cx + 6):
        sp.px(x, head_y + 12, SKIN_SH1)

    # 2) LARGE GENTLE DREAMY SKY-BLUE CRYSTAL ANIME EYES (softer arched lashes!)
    ey = head_y + 14
    lx0 = cx - 7  # far eye (left):  4x6
    rx0 = cx      # near eye (right): 5x6

    if pose == "blink":
        # Gentle peaceful curved closed eyes
        sp.px(lx0 - 1, ey + 2, INK_DARK)
        hspan(sp, ey + 3, lx0, lx0 + 3, INK_DARK)
        hspan(sp, ey + 4, lx0 + 1, lx0 + 2, SKIN_SH1)

        sp.px(rx0, ey + 2, INK_DARK)
        hspan(sp, ey + 3, rx0 + 1, rx0 + 4, INK_DARK)
        sp.px(rx0 + 5, ey + 2, INK_DARK)
        hspan(sp, ey + 4, rx0 + 2, rx0 + 3, SKIN_SH1)

    elif pose == "hurt":
        # Cute startled > < wince!
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
        focused = pose in ("windup", "strike")

        # --- FAR EYE (LEFT, 4x6 soft-arched crystal sky-blue!) ---
        sp.px(lx0 - 1, ey + 1, INK_MID if not focused else INK_DARK)  # delicate outer-left lash flick
        if focused:
            hspan(sp, ey, lx0, lx0 + 2, INK_DARK)
            sp.px(lx0 + 3, ey + 1, INK_DARK)
        else:
            # Soft rounded upper lash with selective-tinted INK_MID outer corner!
            sp.px(lx0, ey, INK_MID)
            hspan(sp, ey, lx0 + 1, lx0 + 3, INK_DARK)

        # Row +1: bright sclera + BIG dreamy top-left catchlight + deep sky upper iris
        sp.px(lx0,     ey + 1, SNOW_HI if not focused else PURE_WHT)
        sp.px(lx0 + 1, ey + 1, PURE_WHT)   # big dreamy top-left catchlight!
        sp.px(lx0 + 2, ey + 1, SAP_DARK)
        sp.px(lx0 + 3, ey + 1, SAP_DARK if not focused else INK_DARK)

        # Row +2: crisp white sclera + faceted cerulean iris + crisp dark pupil
        sp.px(lx0,     ey + 2, PURE_WHT)
        sp.px(lx0 + 1, ey + 2, SAP_MID)
        sp.px(lx0 + 2, ey + 2, INK_DARK)
        sp.px(lx0 + 3, ey + 2, SAP_DARK)

        # Row +3: luminous cerulean-sky bloom
        sp.px(lx0,     ey + 3, PURE_WHT)
        sp.px(lx0 + 1, ey + 3, SAP_MID)
        sp.px(lx0 + 2, ey + 3, SKY_HI)
        sp.px(lx0 + 3, ey + 3, SAP_MID)

        # Row +4: dreamy bright crystal lower crescent + diagonal secondary sparkle!
        sp.px(lx0,     ey + 4, SKIN_MID)
        sp.px(lx0 + 1, ey + 4, SKY_HI)
        sp.px(lx0 + 2, ey + 4, SKY_HI)
        sp.px(lx0 + 3, ey + 4, PURE_WHT)

        # Row +5: delicate soft lower lid
        hspan(sp, ey + 5, lx0 + 1, lx0 + 3, PERI_SH)

        # --- NEAR EYE (RIGHT, 5x6 big dreamy crystal sky-blue gem!) ---
        if focused:
            sp.px(rx0, ey + 1, INK_DARK)
            hspan(sp, ey, rx0 + 1, rx0 + 4, INK_DARK)
        else:
            # Soft rounded upper lash arch with INK_MID soft inner/outer corners!
            sp.px(rx0,     ey, INK_MID)
            hspan(sp, ey, rx0 + 1, rx0 + 3, INK_DARK)
            sp.px(rx0 + 4, ey, INK_MID)
        sp.px(rx0 + 5, ey + 1, INK_DARK)  # crisp outer-right lash flick

        # Row +1: deep sky upper iris + BIG dreamy white catchlight + bright sclera
        sp.px(rx0,     ey + 1, SAP_DARK if not focused else INK_DARK)
        sp.px(rx0 + 1, ey + 1, PURE_WHT)   # big dreamy top-left catchlight!
        sp.px(rx0 + 2, ey + 1, SAP_DARK)
        sp.px(rx0 + 3, ey + 1, SAP_DARK)
        sp.px(rx0 + 4, ey + 1, PURE_WHT if focused else SNOW_HI)

        # Row +2: smooth top-to-bottom faceted sapphire gradient + dark pupil + pure sclera
        sp.px(rx0,     ey + 2, SAP_DARK)
        sp.px(rx0 + 1, ey + 2, SAP_MID)
        sp.px(rx0 + 2, ey + 2, INK_DARK)
        sp.px(rx0 + 3, ey + 2, SAP_MID)
        sp.px(rx0 + 4, ey + 2, PURE_WHT)

        # Row +3: glowing cerulean & luminous crystal sky-blue inner bloom
        sp.px(rx0,     ey + 3, SAP_MID)
        sp.px(rx0 + 1, ey + 3, SKY_HI)
        sp.px(rx0 + 2, ey + 3, SKY_HI)
        sp.px(rx0 + 3, ey + 3, SAP_MID)
        sp.px(rx0 + 4, ey + 3, PURE_WHT)

        # Row +4: luminous sky-blue lower crescent + diagonal lower-right crystal glint!
        sp.px(rx0,     ey + 4, SKY_HI)
        sp.px(rx0 + 1, ey + 4, SKY_HI)
        sp.px(rx0 + 2, ey + 4, SKY_HI)
        sp.px(rx0 + 3, ey + 4, PURE_WHT)
        sp.px(rx0 + 4, ey + 4, SKIN_MID)

        # Row +5: delicate soft lower lid
        hspan(sp, ey + 5, rx0 + 1, rx0 + 3, PERI_SH)

    # 3) Soft rosy anime cheek blush (2px gentle horizontal)
    hspan(sp, ey + 5, lx0 - 1, lx0, BLUSH)
    hspan(sp, ey + 5, rx0 + 4, rx0 + 5, BLUSH)

    # 4) Soft gentle anime mouth (facing LEFT -> mx = cx - 2)
    my = head_y + 21
    mx = cx - 2
    if pose == "strike":
        sp.px(mx - 1, my, INK_SKIN)
        sp.px(mx,     my, INK_SKIN)
        sp.px(mx - 1, my + 1, BLUSH)
        sp.px(mx,     my + 1, BLUSH)
    elif pose == "hurt":
        sp.px(mx - 1, my + 1, INK_SKIN)
        sp.px(mx,     my,     INK_SKIN)
        sp.px(mx + 1, my + 1, INK_SKIN)
    elif pose == "windup":
        sp.px(mx - 1, my, INK_SKIN)
        sp.px(mx,     my, SKIN_SH2)
    else:
        sp.px(mx - 1, my, SKIN_SH2)
        sp.px(mx,     my, SKIN_SH2)

    # 5) LUMINOUS PURE SNOW-WHITE HAIR CROWN & CENTER-PARTED WISPY BANGS!
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
        hspan(sp, y, cx + dl, cx + dr, SNOW_HI)

        if 1 <= dy <= 5:
            hi_l = cx + max(dl + 1, -9)
            hi_r = cx + min(dr - 2, 7)
            if hi_r >= hi_l:
                hspan(sp, y, hi_l, hi_r, PURE_WHT)

        # Angel-ring glistening crown band
        if dy == 6:
            hspan(sp, y, cx - 8, cx - 4, PURE_WHT)
            hspan(sp, y, cx - 2, cx + 3, PURE_WHT)
            hspan(sp, y, cx + 5, cx + 10, PURE_WHT)
        elif dy == 7:
            hspan(sp, y, cx - 9, cx - 6, PURE_WHT)
            hspan(sp, y, cx - 1, cx + 4, PURE_WHT)
            hspan(sp, y, cx + 6, cx + 11, PURE_WHT)
        elif dy == 8:
            hspan(sp, y, cx - 9, cx - 7, PURE_WHT)
            hspan(sp, y, cx + 8, cx + 11, PURE_WHT)

        if dr >= 8:
            hspan(sp, y, cx + dr - 2, cx + dr, PERI_MID)
            if dy >= 5:
                sp.px(cx + dr, y, PERI_SH)
        if dl <= -8 and dy >= 6:
            sp.px(cx + dl, y, PERI_MID)

    # Softly curved center hair part at top-center-left (silky natural crown!)
    part_x = cx - 1
    sp.px(part_x,     head_y + 1, PERI_MID)
    sp.px(part_x,     head_y + 2, PERI_SH)
    sp.px(part_x,     head_y + 3, PERI_MID)
    sp.px(part_x - 1, head_y + 4, PERI_MID)
    sp.px(part_x + 1, head_y + 2, PURE_WHT)
    sp.px(part_x - 1, head_y + 2, PURE_WHT)

    # Broken liquid-silk snow-white strand grooves below angel-ring
    for (sx, sy0, sy1, dx_step) in [
        (cx - 7, 8, 12, -0.25),
        (cx - 3, 8, 12, -0.20),
        (cx + 2, 8, 12,  0.20),
        (cx + 7, 8, 12,  0.30),
    ]:
        for dy in range(sy0, sy1 + 1):
            px_s = int(round(sx + (dy - sy0) * dx_step))
            sp.px(px_s, head_y + dy, PERI_MID)

    # Airy forehead breathing room above brows
    for x in (cx - 6, cx - 5, cx + 1, cx + 2):
        sp.px(x, head_y + 11, SKIN_MID)

    # Soft center wispy V-bangs
    for dy, (dl, dr) in [
        (10, (-3, 0)), (11, (-3, 0)), (12, (-3, 0)),
        (13, (-3, -1)), (14, (-2, -1)), (15, (-2, -1)), (16, (-2, -2)),
    ]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, SNOW_HI if dy < 15 else PERI_MID)
        if dy <= 13:
            sp.px(cx + dl, head_y + dy, PURE_WHT)
        if dy >= 13 and dr > dl:
            sp.px(cx + dr, head_y + dy, PERI_MID)

    # Right-side sweeping bangs framing near eye
    for dy, (dl, dr) in [(11, (4, 8)), (12, (5, 8)), (13, (6, 8)), (14, (6, 8)), (15, (7, 7))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, SNOW_HI)
        sp.px(cx + dl, head_y + dy, PURE_WHT)
        if dy >= 13:
            sp.px(cx + dr, head_y + dy, PERI_MID)

    sp.px(cx + 3, head_y + 12, SNOW_HI)
    sp.px(cx + 3, head_y + 13, PERI_MID)

    # Far-left forehead lock
    for dy, (dl, dr) in [(11, (-10, -7)), (12, (-10, -8)), (13, (-10, -8)), (14, (-10, -9))]:
        hspan(sp, head_y + dy, cx + dl, cx + dr, PURE_WHT if dy == 11 else SNOW_HI)
        sp.px(cx + dl, head_y + dy, PERI_MID if dy >= 13 else PURE_WHT)

    # 6) EXPRESSIVE DELICATE PERIWINKLE EYEBROWS
    brow_y = ey - 2
    if pose in ("windup", "strike"):
        sp.px(lx0,     brow_y - 1, PERI_SH)
        sp.px(lx0 + 1, brow_y,     INK_MID)
        sp.px(lx0 + 2, brow_y,     INK_MID)

        sp.px(rx0 + 1, brow_y,     INK_MID)
        sp.px(rx0 + 2, brow_y,     INK_MID)
        sp.px(rx0 + 3, brow_y - 1, PERI_SH)
        sp.px(rx0 + 4, brow_y - 1, PERI_SH)
    elif pose == "hurt":
        sp.px(lx0,     brow_y + 1, PERI_SH)
        sp.px(lx0 + 1, brow_y,     INK_MID)
        sp.px(lx0 + 2, brow_y,     PERI_SH)

        sp.px(rx0 + 1, brow_y,     PERI_SH)
        sp.px(rx0 + 2, brow_y,     INK_MID)
        sp.px(rx0 + 3, brow_y + 1, PERI_SH)
    else:
        hspan(sp, brow_y, lx0, lx0 + 2, PERI_SH)
        hspan(sp, brow_y, rx0 + 1, rx0 + 3, PERI_SH)

    # 7) LONG WAVY FACE-FRAMING SNOW-WHITE SIDE LOCKS!
    for i in range(25):
        y = head_y + 12 + i
        t = i / 24.0
        off = int(round(math.sin(t * 3.4) * 1.6)) + (-1 if pose == "hurt" else 0)
        rx_lock = cx + 9 - int(round(t * 2.2)) + off
        w = 5 if i < 7 else (4 if i < 15 else (3 if i < 20 else (2 if i < 23 else 1)))
        hspan(sp, y, rx_lock, rx_lock + w - 1, SNOW_HI)
        sp.px(rx_lock, y, PURE_WHT if i < 18 else SNOW_HI)
        if w >= 3:
            sp.px(rx_lock + w - 1, y, PERI_MID)
        if w >= 4:
            sp.px(rx_lock + w - 1, y, PERI_SH if i > 6 else PERI_MID)
        if i in (4, 5, 12, 13) and w >= 4:
            sp.px(rx_lock + 1, y, PURE_WHT)

    # Far (left) slender curved cheek lock tapering smoothly past chin
    for i in range(18):
        y = head_y + 11 + i
        t = i / 17.0
        lx_lock = cx - 11 - int(round(math.sin(t * 3.0) * 1.1)) + (1 if i >= 15 else 0)
        w = 3 if i < 6 else (2 if i < 14 else 1)
        hspan(sp, y, lx_lock, lx_lock + w - 1, SNOW_HI if i < 10 else PERI_MID)
        sp.px(lx_lock, y, PURE_WHT if i < 9 else SNOW_HI)
        if w >= 3:
            sp.px(lx_lock + w - 1, y, PERI_MID)

    # 8) PROMINENT ICONIC WHITE LACE DOUBLE-BOW + GOLD-RIMMED SAPPHIRE JEWEL HAIRPIN!
    # Clearly defined ruffled bow loops protruding outside the right temple (matches reference!)
    bx = cx + 11
    by = head_y + 10

    # Inner left white lace bow ear (tucked cleanly against crown with crisp PERI_SH fold)
    sp.rect(bx - 2, by - 1, bx, by + 2, PURE_WHT)
    sp.px(bx - 2, by + 2, PERI_SH)
    sp.px(bx - 1, by + 2, PERI_MID)
    sp.px(bx - 2, by - 1, PERI_MID)

    # Outer right prominent ruffled white lace bow ear sticking playfully outward!
    hspan(sp, by - 3, bx + 2, bx + 4, PURE_WHT)
    hspan(sp, by - 2, bx + 2, bx + 5, PURE_WHT)
    sp.px(bx + 5, by - 2, SNOW_HI)
    hspan(sp, by - 1, bx + 2, bx + 6, PURE_WHT)
    sp.px(bx + 4, by - 1, SNOW_HI)
    sp.px(bx + 6, by - 1, PERI_MID)
    hspan(sp, by,     bx + 2, bx + 6, SNOW_HI)
    sp.px(bx + 3, by,     PERI_MID)  # crisp center bow loop fold crease!
    sp.px(bx + 6, by,     PERI_SH)
    hspan(sp, by + 1, bx + 2, bx + 5, SNOW_HI)
    sp.px(bx + 5, by + 1, PERI_SH)
    hspan(sp, by + 2, bx + 2, bx + 4, PERI_MID)
    sp.px(bx + 4, by + 2, PERI_SH)

    # Tiered ruffled white lace ribbon tails draping gracefully down behind the jewel!
    if pose == "strike":
        tail_sway = [0, 1, 2, 3, 4, 5, 6, 7, 7]
    elif pose == "hurt":
        tail_sway = [0, 0, -1, -1, 0, 1, 1, 2, 2]
    elif pose == "windup":
        tail_sway = [0, 1, 1, 2, 2, 3, 4, 4, 5]
    elif pose == "idle2":
        tail_sway = [0, 0, 1, 1, 2, 2, 3, 3, 4]
    else:
        tail_sway = [0, 0, 1, 1, 1, 2, 2, 3, 3]

    for k in range(9):
        ty = by + 3 + k
        tx = min(W - 5, bx + 1 + tail_sway[k])
        # Two crisp ruffled lace tiers (flaring wider at k=2..3 and k=6..8!)
        w_t = 4 if k in (2, 3, 7, 8) else 3
        hspan(sp, ty, tx, min(W - 3, tx + w_t - 1), PURE_WHT if k < 4 else SNOW_HI)
        sp.px(min(W - 3, tx + w_t - 1), ty, PERI_MID if k < 5 else PERI_SH)
        if k in (3, 8):
            # Scalloped horizontal lace ruffle hem line!
            hspan(sp, ty, tx, min(W - 3, tx + w_t - 1), PERI_SH)
            sp.px(tx + 1, ty, PERI_MID)

    # Ornate Champagne-Gold Filigree Oval Hairpin + Glowing Sky-Blue Sapphire Jewel!
    sp.px(bx + 1, by - 2, GLD_HI)
    sp.px(bx,     by - 1, GLD_HI)
    sp.px(bx + 1, by - 1, PURE_WHT)  # sapphire crystal gleam
    sp.px(bx + 2, by - 1, GLD_MID)
    sp.px(bx,     by,     GLD_MID)
    sp.px(bx + 1, by,     SKY_HI)
    sp.px(bx + 2, by,     SAP_MID)
    sp.px(bx + 3, by,     GLD_SH)
    sp.px(bx,     by + 1, GLD_MID)
    sp.px(bx + 1, by + 1, SAP_DARK)
    sp.px(bx + 2, by + 1, GLD_SH)
    sp.px(bx + 1, by + 2, GLD_MID)

    # Delicate dangling champagne-gold pearl tassel below hairpin jewel!
    for k in range(3, 7):
        tx_g = bx + 1 + (tail_sway[k - 3] // 2)
        sp.px(tx_g, by + k, GLD_HI if k % 2 == 1 else GLD_MID)


def draw_near_arm_and_wind_fx(sp: Sprite, cx: int, torso_y: int, waist_y: int, pose: str, far_hand: tuple[int, int]):
    """Near (viewer's RIGHT) puffy white fairy sleeve & porcelain hand,
    PLUS Alice's ethereal emerald-aqua & cyan-white wind ribbons & breeze magic!"""
    sp.layer("near_arm")

    sh_x, sh_y = cx + 5, torso_y + 2

    if pose == "windup":
        # Cradling cleanly underneath the right rim of the hovering breeze orb!
        el_x, el_y = cx + 4, torso_y + 8
        hx, hy = cx - 9, torso_y + 6
    elif pose == "strike":
        # Sweeping cleanly LEFT launching the organic sweeping crescent wind gale!
        el_x, el_y = cx - 2, torso_y + 6
        hx, hy = cx - 10, torso_y + 6
    elif pose == "hurt":
        el_x, el_y = cx + 8, torso_y + 7
        hx, hy = cx + 3, torso_y + 9
    else:
        # Poised noble fairy-princess stance leaving white collar bow & gold pendant 100% clear!
        el_x, el_y = cx + 8, torso_y + 7
        hx, hy = cx + 5, torso_y + 12

    # 1) Generous puffy white fairy-princess upper sleeve
    sp.polygon([
        (sh_x - 2, sh_y),
        (sh_x + 2, sh_y),
        (el_x + 3, el_y + 1),
        (el_x - 2, el_y + 1),
        (sh_x - 2, sh_y + 4),
    ], SNOW_HI, fill=True)
    sp.line(sh_x - 1, sh_y + 1, el_x - 1, el_y, PURE_WHT)
    sp.line(sh_x + 2, sh_y + 1, el_x + 2, el_y, PERI_MID)
    sp.line(sh_x + 2, sh_y + 2, el_x + 3, el_y + 1, PERI_SH)

    # Subtle silver-blue elbow gather ribbon
    sp.line(el_x - 1, el_y, el_x + 2, el_y, SHOE_MID)
    sp.px(el_x - 1, el_y, SHOE_HI)
    sp.px(el_x + 2, el_y, SHOE_SH)

    # 2) Billowy white fairy forearm & ruffled lace cuff
    sp.polygon([
        (el_x - 1, el_y + 1),
        (el_x + 2, el_y + 1),
        (hx + 2, hy + 1),
        (hx, hy - 1),
    ], SNOW_HI, fill=True)
    sp.line(el_x - 1, el_y + 1, hx, hy - 1, PURE_WHT)
    sp.line(el_x + 1, el_y + 2, hx + 1, hy + 1, PERI_MID)
    sp.px(hx + 2, hy - 1, PURE_WHT)
    sp.px(hx + 2, hy,     PERI_MID)
    sp.px(hx + 2, hy + 1, PERI_SH)

    # 3) Delicate porcelain near hand
    sp.rect(hx - 1, hy - 1, hx + 1, hy + 1, SKIN_MID)
    sp.px(hx - 1, hy - 1, SKIN_HI)
    sp.px(hx + 1, hy + 1, SKIN_SH1)

    # 4) ETHEREAL EMERALD-AQUA & CYAN-WHITE WIND RIBBONS + 4-CONNECTED BREEZE MOTES!
    fx_hx, fx_hy = far_hand
    cast_x, cast_y = hx - 12, hy - 1

    if pose in ("idle1", "idle2", "blink"):
        dy_float = -1 if pose == "idle2" else 0
        # Silky, ethereal fairy wind ribbon curling gracefully in open left air & kissing skirt hem!
        sp.layer("fx")
        ribbon_pts = [
            (fx_hx - 7,  fx_hy - 7 + dy_float),
            (fx_hx - 10, fx_hy - 3 + dy_float),
            (fx_hx - 6,  fx_hy + 1 + dy_float),
            (fx_hx - 1,  fx_hy + 3 + dy_float),
            (cx - 11,    waist_y + 9 + dy_float),
            (cx - 4,     waist_y + 11 + dy_float),
            (cx + 3,     waist_y + 10 + dy_float),
        ]
        draw_curve(sp, [(x, y + 1) for x, y in ribbon_pts[:5]], WIND_DK)
        draw_curve(sp, ribbon_pts, WIND_MID)
        # Luminous mint-white highlight gliding along the entire upper & outer sweep!
        draw_curve(sp, ribbon_pts[:5], WIND_HI)
        sp.px(fx_hx - 10, fx_hy - 3 + dy_float, PURE_WHT)
        sp.px(fx_hx - 9,  fx_hy - 4 + dy_float, PURE_WHT)
        sp.px(fx_hx - 7,  fx_hy + dy_float,     PURE_WHT)
        sp.px(fx_hx - 6,  fx_hy + 1 + dy_float, PURE_WHT)
        sp.px(cx - 8,     waist_y + 10 + dy_float, PURE_WHT)
        sp.px(cx - 7,     waist_y + 10 + dy_float, WIND_HI)

        # Two dainty 4-connected breeze motes floating softly in open air on her left!
        m1x, m1y = fx_hx - 5, fx_hy - 11 + dy_float
        sp.px(m1x,     m1y,     PURE_WHT)
        sp.px(m1x + 1, m1y,     WIND_HI)
        sp.px(m1x,     m1y + 1, WIND_MID)

        m2x, m2y = fx_hx - 11, waist_y + 6 - dy_float
        sp.px(m2x,     m2y,     WIND_HI)
        sp.px(m2x + 1, m2y,     WIND_MID)
        sp.px(m2x + 1, m2y - 1, WIND_DK)

    elif pose == "windup":
        # Clean, luminous 2-arm swirling breeze vortex hovering ABOVE her two cupped palms!
        # Zero dark-outline overlap inside the orb AND crisp open gap clear of face/cheek!
        vx = cx - 16   # x = 25 (far cheek lock ends at x = 30 -> clean open air!)
        vy = torso_y   # y = 38 (palms cradle gently below at y = 43..44!)

        sp.layer("fx")
        # Arm 1: Upper-left luminous breeze spiral arc
        arm1 = [
            (vx - 5, vy + 2),
            (vx - 6, vy - 1),
            (vx - 3, vy - 5),
            (vx + 1, vy - 5),
            (vx + 4, vy - 3),
        ]
        draw_curve(sp, [(x, y + 1) for x, y in arm1[:4]], WIND_DK)
        draw_curve(sp, arm1, WIND_MID)
        draw_curve(sp, arm1[1:4], WIND_HI)
        sp.px(vx - 3, vy - 5, PURE_WHT)
        sp.px(vx - 2, vy - 5, PURE_WHT)

        # Arm 2: Rising lower-right wind ribbon coiling up from skirt hem into the vortex!
        arm2 = [
            (cx + 4, waist_y + 11),
            (cx - 6, waist_y + 10),
            (vx + 3, vy + 6),
            (vx + 5, vy + 2),
            (vx + 4, vy - 1),
        ]
        draw_curve(sp, [(x, y + 1) for x, y in arm2[:4]], WIND_DK)
        draw_curve(sp, arm2, WIND_MID)
        draw_curve(sp, arm2[2:], WIND_HI)
        sp.px(vx + 4, vy + 2, PURE_WHT)
        sp.px(vx + 4, vy + 1, PURE_WHT)

        # Gleaming cyan-white wind star core sparkling cleanly at center (vx, vy)!
        sp.px(vx,     vy,     PURE_WHT)
        sp.px(vx - 1, vy,     PURE_WHT)
        sp.px(vx + 1, vy,     WIND_HI)
        sp.px(vx,     vy - 1, PURE_WHT)
        sp.px(vx,     vy + 1, WIND_HI)
        sp.px(vx - 2, vy,     WIND_HI)
        sp.px(vx + 2, vy,     WIND_MID)
        sp.px(vx,     vy - 2, WIND_HI)
        sp.px(vx,     vy + 2, WIND_MID)
        sp.px(vx - 1, vy - 1, WIND_HI)
        sp.px(vx + 1, vy + 1, WIND_MID)

        # Two crisp 4-connected orbiting breeze motes safely in open air on her far left!
        sp.px(vx - 8, vy - 5, PURE_WHT)
        sp.px(vx - 7, vy - 5, WIND_HI)
        sp.px(vx - 7, vy - 4, WIND_MID)

        sp.px(vx - 9, vy + 6, WIND_HI)
        sp.px(vx - 8, vy + 6, WIND_MID)
        sp.px(vx - 8, vy + 5, WIND_DK)

        cast_x, cast_y = vx, vy

    elif pose == "strike":
        # ORGANIC, RAZOR-GRACEFUL SWEEPING CYAN-WHITE WIND GALE CRESCENT ARC!
        # Clean open-air release gap between extended palms (x=21..25) and crescent blade (x=4..16)!
        gx = 8
        gy = fx_hy + 3

        sp.layer("fx")
        # 1) Primary razor-curved crescent wind-blade (tapered sleek tips -> lush 4px luminous belly!)
        arc_outer = [
            (gx + 8, gy - 13),
            (gx + 7, gy - 13),
            (gx + 3, gy - 9),
            (gx - 2, gy - 4),
            (gx - 4, gy + 1),
            (gx - 2, gy + 6),
            (gx + 3, gy + 11),
            (gx + 7, gy + 13),
            (gx + 8, gy + 13),
        ]
        arc_mid = [
            (gx + 6, gy - 10),
            (gx + 1, gy - 6),
            (gx - 2, gy - 1),
            (gx - 2, gy + 3),
            (gx + 1, gy + 8),
            (gx + 6, gy + 11),
        ]
        draw_curve(sp, [(x + 2, y) for x, y in arc_mid[1:-1]], WIND_DK)
        draw_curve(sp, [(x + 1, y) for x, y in arc_mid],       WIND_MID)
        draw_curve(sp, arc_mid,                                WIND_HI)
        draw_curve(sp, [(x + 1, y) for x, y in arc_outer[1:-1]], WIND_HI)
        draw_curve(sp, arc_outer,                              WIND_MID)
        draw_curve(sp, arc_outer[2:-2],                        PURE_WHT)

        # 2) Secondary smaller curved gale echo crescent cleanly separated from far fingertips!
        echo = [
            (gx + 8, gy - 6),
            (gx + 7, gy - 5),
            (gx + 5, gy - 2),
            (gx + 5, gy + 2),
            (gx + 7, gy + 5),
            (gx + 8, gy + 6),
        ]
        draw_curve(sp, [(x + 1, y) for x, y in echo], WIND_DK)
        draw_curve(sp, echo, WIND_MID)
        draw_curve(sp, echo[2:4], WIND_HI)

        # 3) Graceful S-curved wind ribbon streaming cleanly from extended palms into the gale!
        s_ribbon = [
            (cx + 12, waist_y + 8),
            (cx + 1,  waist_y + 10),
            (cx - 10, waist_y + 5),
            (hx - 2,  hy + 1),
            (gx + 7,  gy),
            (gx + 1,  gy + 1),
        ]
        draw_curve(sp, [(x, y + 1) for x, y in s_ribbon[:4]], WIND_DK)
        draw_curve(sp, s_ribbon, WIND_MID)
        draw_curve(sp, s_ribbon[3:], WIND_HI)
        sp.px(gx + 3, gy + 1, PURE_WHT)
        sp.px(gx + 2, gy + 1, PURE_WHT)

        # 4) Crisp 4-connected wind-spark motes dancing off the gale arc!
        sp.px(max(2, gx - 3), gy - 10, PURE_WHT)
        sp.px(max(3, gx - 2), gy - 10, WIND_HI)
        sp.px(max(3, gx - 2), gy - 9,  WIND_MID)

        sp.px(max(2, gx - 2), gy + 11, WIND_HI)
        sp.px(max(3, gx - 1), gy + 11, WIND_MID)
        sp.px(max(3, gx - 1), gy + 10, WIND_DK)

        cast_x, cast_y = max(3, gx - 4), gy + 1

    elif pose == "hurt":
        # Soft curved disrupted breeze puff scattering gently on recoil (no rigid stick!)
        sp.layer("fx")
        w1 = [
            (fx_hx - 7, fx_hy - 1),
            (fx_hx - 7, fx_hy - 3),
            (fx_hx - 5, fx_hy - 5),
            (fx_hx - 3, fx_hy - 5),
            (fx_hx - 2, fx_hy - 4),
        ]
        draw_curve(sp, [(x, y + 1) for x, y in w1[1:4]], WIND_DK)
        draw_curve(sp, w1, WIND_MID)
        draw_curve(sp, w1[1:4], WIND_HI)
        sp.px(fx_hx - 5, fx_hy - 5, PURE_WHT)

        w2 = [(cx - 11, waist_y + 9), (cx - 7, waist_y + 11), (cx - 3, waist_y + 10)]
        draw_curve(sp, [(x, y + 1) for x, y in w2[:2]], WIND_DK)
        draw_curve(sp, w2, WIND_MID)
        draw_curve(sp, w2[:2], WIND_HI)

    return cast_x, cast_y


# ---------------------------------------------------------------------------
# Build All 6 Frames (Facing LEFT!)
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    ("idle1",   0,   0,   0, 260),
    ("idle2",   0,  -1,   1, 260),
    ("blink",   0,   0,   0, 140),
    ("windup",  2,   1,   1, 180),
    ("strike", -4,   0,   2, 160),
    ("hurt",    3,   1,  -2, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "fx_back",
        "outline",
        "back_hair",
        "far_arm",
        "legs",
        "skirt",
        "torso",
        "head",
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
        head_y = 9 + bob       # 2px shorter & daintier than Sylvia (7 + bob)!
        neck_y = head_y + 27   # 36 + bob
        torso_y = neck_y + 1   # 37 + bob
        waist_y = neck_y + 12  # 48 + bob

        draw_back_hair(sp, cx, head_y, pose, sway)
        far_hand = draw_far_arm(sp, cx, torso_y, pose)
        draw_legs_shoes(sp, cx, GROUND_Y, pose)
        draw_skirt(sp, cx, waist_y, pose, sway)
        draw_torso(sp, cx, neck_y, pose)
        draw_head(sp, cx, head_y, pose, sway)
        cast_x, cast_y = draw_near_arm_and_wind_fx(sp, cx, torso_y, waist_y, pose, far_hand)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx - 1, head_y + 15)
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
    x0, y0, x1, y1 = 19, 6, 59, 44
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
        "id": "alice",
        "file": "assets/sprites/alice_sheet.png",
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
        "buildScript": "tools/pixel_art/alice/build.py",
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
