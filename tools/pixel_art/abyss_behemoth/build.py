#!/usr/bin/env python3
"""HD anime JRPG pixel-art combat sprite builder for Abyssal Frost Behemoth (abyss_behemoth).

Act 7 Northern Gorge Boss (霜渊裂地兽).
100% deterministic pixel-by-pixel authoring via pixelstudio.py (zero image generation).
Canvas: 96 x 84, 6 horizontal frames (576 x 84 sheet, padding=0).
Facing: left. GROUND_Y = 78, PIVOT_X = 46.

Pass 3 (Final Jewelry-Grade Boss Polish):
- Luminous sapphire-crevice crystal faceting (SAP_DARK crystal seams instead of heavy black ink)
  and light-aware 3D depth-separation rims on foreground hero limbs, pauldron & draconic head
- Iconic Frame 4 (windup): dorsal spikes tucked back so the colossal raised frost-knuckled fist
  & gleaming silver-steel gauntlet tower UNMISTAKABLY into open top sky (y=2..26), clear of brow
  horns, claws hooked left with blazing cyan frost-charge vortex & spark stars!
- Explosive Frame 5 (strike): seamless curved tapered slam smear connecting Frame 4's raised fist
  directly into the grounded forward-left crush, clear head margin & razor bursting glacial pillars
- Crisp Frame 6 (hurt): clean right-border tail margin (x <= 92), dramatic stagger recoil, lifted
  far forepaw, bright glowing cracked carapace fissures & clean flying crystal chunks in open sky
- Refined hooked draconic snout, glowing eye socket rim reflection, clean idle1 silhouette & vivid
  idle2 core-pulse + breath billow.
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
W, H = 96, 84
N_FRAMES = 6
GROUND_Y = 78
PIVOT_X = 46

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "abyss_behemoth_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "abyss_behemoth_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")

# ---------------------------------------------------------------------------
# Master 20-Color Hue-Shifted Glacial Boss Palette (min pairwise dist > 20)
# ---------------------------------------------------------------------------
INK_DARK  = "#0e1529"  # Deepest abyssal midnight-indigo outline & crevices
HIDE_SH2  = "#1a2645"  # Deep slate-navy shadow hide & underbelly recess
HIDE_SH1  = "#273b66"  # Dark slate-blue armored hide shadow & lit-scale selout
HIDE_MID  = "#385487"  # Primary dark slate-blue scaled hide
HIDE_HI   = "#5275ab"  # Lit dorsal scale crests & brow ridge highlights
HIDE_RIM  = "#789cc9"  # Sunlit frost-dusted dorsal rim highlight

MTL_SH    = "#46526b"  # Tarnished dark carved frost-steel shadow
MTL_MID   = "#6b7b96"  # Sculpted silver-slate carapace trim base
MTL_HI    = "#97a9c2"  # Lit beveled frost-steel edge
MTL_SPEC  = "#cdd8e8"  # Specular silver metal bevel glint & frosty mist

SAP_DARK  = "#123c85"  # Deep faceted sapphire crystal shadow plane & crystal crevice
SAP_MID   = "#1e63c4"  # Royal sapphire crystal mid-facet & lit crystal selout
ICE_DEEP  = "#308ce6"  # Vivid glacier-azure crystal plane
ICE_MID   = "#5eb9fa"  # Bright sky-ice crystal facet
ICE_HI    = "#9edeff"  # Translucent pale-ice lit facet
ICE_PALE  = "#d9f5ff"  # Frost-white crystalline edge highlight

CORE_DARK = "#0a6b8c"  # Emissive deep teal-cyan core fissure rim
CORE_MID  = "#12b8db"  # Glowing bright-cyan core fissure & throat glow
CORE_HI   = "#69f5ff"  # Blazing electric-cyan eyes, core pulse & frost energy
PURE_WHT  = "#ffffff"  # Pure white specular glint, eye flare & shockwave flash

PALETTE = [
    INK_DARK, HIDE_SH2, HIDE_SH1, HIDE_MID, HIDE_HI, HIDE_RIM,
    MTL_SH, MTL_MID, MTL_HI, MTL_SPEC,
    SAP_DARK, SAP_MID, ICE_DEEP, ICE_MID, ICE_HI, ICE_PALE,
    CORE_DARK, CORE_MID, CORE_HI, PURE_WHT,
]


# ---------------------------------------------------------------------------
# Low-Level Pixel-Art Geometry & Facet Helpers
# ---------------------------------------------------------------------------

def clamp_px(sp: Sprite, x: float, y: float, col: str, only=None):
    xi, yi = int(round(x)), int(round(y))
    if 1 <= xi < W - 1 and 1 <= yi < H - 1:
        sp.px(xi, yi, col, only=only)


def hspan(sp: Sprite, y: float, x0: float, x1: float, col: str, only=None):
    yi = int(round(y))
    a, b = sorted((int(round(x0)), int(round(x1))))
    for x in range(a, b + 1):
        if 1 <= x < W - 1 and 1 <= yi < H - 1:
            sp.px(x, yi, col, only=only)


def poly_safe(sp: Sprite, pts, col: str, only=None):
    cpts = [(max(1, min(W - 2, int(round(x)))), max(1, min(H - 2, int(round(y))))) for x, y in pts]
    sp.polygon(cpts, col, fill=True, only=only)


def line_safe(sp: Sprite, x0, y0, x1, y1, col: str, only=None):
    sp.line(
        max(1, min(W - 2, int(round(x0)))),
        max(1, min(H - 2, int(round(y0)))),
        max(1, min(W - 2, int(round(x1)))),
        max(1, min(H - 2, int(round(y1)))),
        col,
        only=only,
    )


def add_layer_separation_rim(
    sp: Sprite,
    layer_name: str,
    frame_idx: int,
    strong_dark: bool = False,
    y_min: int = 1,
    y_max: int = H - 2,
):
    """Paint a refined light- and material-aware 1px 3D depth-separation rim around a foreground
    layer cel ONLY where it overlaps behind-layers (avoiding muddy over-black lines!)."""
    cel = sp.frames[frame_idx - 1].cels[layer_name]
    px = cel.load()
    lidx = sp.layer_order.index(layer_name)
    behind_layers = [ln for ln in sp.layer_order[:lidx] if ln != "outline"]
    behind_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in behind_layers]

    ice_set = {
        hex2rgba(ICE_PALE)[:3], hex2rgba(ICE_HI)[:3],
        hex2rgba(ICE_MID)[:3], hex2rgba(ICE_DEEP)[:3],
        hex2rgba(PURE_WHT)[:3], hex2rgba(CORE_HI)[:3],
    }
    c_dark = hex2rgba(INK_DARK)
    c_sh2  = hex2rgba(HIDE_SH2)
    c_sap  = hex2rgba(SAP_DARK)

    alpha = [[px[x, y][3] > 0 for x in range(W)] for y in range(H)]
    todo = []
    for y in range(max(1, y_min), min(H - 1, y_max + 1)):
        for x in range(1, W - 1):
            if alpha[y][x]:
                continue
            if not any(bp[x, y][3] > 0 for bp in behind_pxs):
                continue
            nbrs = []
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and alpha[ny][nx]:
                    nbrs.append((dx, dy, px[nx, ny][:3]))
            if not nbrs:
                continue
            is_tl = any(dx == 1 or dy == 1 for dx, dy, _ in nbrs) and not any(dy == -1 for _, dy, _ in nbrs)
            all_ice = all(rgb in ice_set for _, _, rgb in nbrs)
            if strong_dark:
                # Used on the hoisted windup fist so it pops in crisp 3D relief off the back!
                todo.append((x, y, c_sap if (is_tl and all_ice) else c_dark))
            else:
                if all_ice:
                    todo.append((x, y, c_sap))
                elif is_tl:
                    todo.append((x, y, c_sh2))
                else:
                    todo.append((x, y, c_dark))
    for x, y, cval in todo:
        px[x, y] = cval


def draw_crystal_spire(
    sp: Sprite,
    bx: float,
    by: float,
    tx: float,
    ty: float,
    half_w: float,
    lit_side: int = -1,
    dark_mode: bool = False,
    pulse: bool = False,
    internal_seam: bool = True,
    crevice_shadow: bool = True,
):
    """Draw a luminous jewel-faceted sapphire-to-pale-ice crystal spire from (bx,by) to (tx,ty).

    Uses rich SAP_DARK shadow crevices (never heavy black ink inside crystals!) and bridges
    strict 4-connectivity at the razor specular tip.
    """
    dx = tx - bx
    dy = ty - by
    length = math.hypot(dx, dy)
    if length < 1.5:
        return
    ux, uy = dx / length, dy / length
    px, py = uy * lit_side, -ux * lit_side

    b_lit = (bx + px * half_w, by + py * half_w)
    b_shd = (bx - px * half_w, by - py * half_w)
    m_t = 0.40
    m_w = half_w * 0.74
    m_lit = (bx + dx * m_t + px * m_w, by + dy * m_t + py * m_w)
    m_shd = (bx + dx * m_t - px * m_w, by + dy * m_t - py * m_w)
    r_mid = (bx + dx * 0.45 + px * (half_w * 0.14), by + dy * 0.45 + py * (half_w * 0.14))
    r_base = (bx + px * (half_w * 0.08), by + py * (half_w * 0.08))
    tip = (tx, ty)

    if dark_mode:
        c_sh_base, c_sh_mid = HIDE_SH2, SAP_DARK
        c_lt_base, c_lt_mid, c_lt_hi = SAP_DARK, SAP_MID, ICE_DEEP
        c_ridge, c_tip = ICE_MID, ICE_HI
    else:
        c_sh_base = SAP_DARK
        c_sh_mid = ICE_DEEP if pulse else SAP_MID
        c_lt_base = ICE_DEEP
        c_lt_mid = ICE_HI if pulse else ICE_MID
        c_lt_hi = ICE_PALE if pulse else ICE_HI
        c_ridge = ICE_PALE
        c_tip = PURE_WHT

    # Shadow plane (right/bottom)
    poly_safe(sp, [r_base, b_shd, m_shd, tip, r_mid], c_sh_mid)
    poly_safe(sp, [r_base, b_shd, m_shd, r_mid], c_sh_base)
    if not dark_mode:
        u_shd = (bx + dx * 0.68 - px * (half_w * 0.40), by + dy * 0.68 - py * (half_w * 0.40))
        u_mid = (bx + dx * 0.70 + px * (half_w * 0.08), by + dy * 0.70 + py * (half_w * 0.08))
        poly_safe(sp, [r_mid, m_shd, u_shd, u_mid], ICE_DEEP)

    # Lit plane (left/top)
    poly_safe(sp, [r_base, b_lit, m_lit, tip, r_mid], c_lt_mid)
    b_lit_up = (bx + dx * 0.24 + px * (half_w * 0.85), by + dy * 0.24 + py * (half_w * 0.85))
    r_low = (bx + dx * 0.22 + px * (half_w * 0.10), by + dy * 0.22 + py * (half_w * 0.10))
    poly_safe(sp, [r_base, b_lit, b_lit_up, r_low], c_lt_base)
    u_lit = (bx + dx * 0.58 + px * (half_w * 0.52), by + dy * 0.58 + py * (half_w * 0.52))
    poly_safe(sp, [r_mid, m_lit, u_lit, tip], c_lt_hi)

    # Jewel sapphire shadow crevice along shadow flank (keeps crystal clusters translucent & crisp!)
    if crevice_shadow and length >= 8:
        line_safe(sp, b_shd[0], b_shd[1], m_shd[0], m_shd[1], SAP_DARK if not dark_mode else HIDE_SH2)
        line_safe(sp, m_shd[0], m_shd[1], tip[0] - px * 0.6, tip[1] - py * 0.6, SAP_MID if not dark_mode else SAP_DARK)

    # Crisp bevel ridge highlight & internal refraction notch
    line_safe(sp, r_mid[0], r_mid[1], tip[0], tip[1], c_ridge)
    line_safe(sp, m_lit[0], m_lit[1], tip[0], tip[1], c_lt_hi)
    if internal_seam and length >= 10:
        line_safe(sp, m_lit[0], m_lit[1], r_mid[0], r_mid[1], ICE_PALE if not dark_mode else ICE_MID)
        line_safe(sp, r_mid[0], r_mid[1], m_shd[0], m_shd[1], SAP_DARK)

    # Razor tip specular sparkle (strictly 4-connected to shaft!)
    tix, tiy = int(round(tx)), int(round(ty))
    clamp_px(sp, tix, tiy, c_tip)
    step_x = -1 if dx > 0 else (1 if dx < 0 else 0)
    step_y = -1 if dy > 0 else (1 if dy < 0 else 0)
    if step_x != 0 and step_y != 0:
        clamp_px(sp, tix, tiy + step_y, ICE_PALE if not dark_mode else ICE_MID)
    if length >= 9 and not dark_mode:
        clamp_px(sp, tx - ux, ty - uy, ICE_PALE)


def draw_scale_chevron(sp: Sprite, cx: int, cy: int, w: int, h: int, lit: bool = True, deep: bool = False):
    """Crisp overlapping armored dragon scale diamond."""
    c_hi = HIDE_RIM if lit else HIDE_HI
    c_mid = HIDE_HI if lit else HIDE_MID
    c_sh = HIDE_SH1 if not deep else HIDE_SH2
    c_seam = HIDE_SH2 if not deep else INK_DARK

    pts = [(cx, cy - h), (cx + w, cy), (cx, cy + h), (cx - w, cy)]
    poly_safe(sp, pts, c_mid)
    line_safe(sp, cx - w, cy, cx, cy - h, c_hi)
    line_safe(sp, cx + w, cy, cx, cy + h, c_sh)
    line_safe(sp, cx - w + 1, cy + 1, cx, cy + h, c_seam)


def draw_claw(sp: Sprite, bx: float, by: float, tx: float, ty: float, thickness: float = 2.0, dark: bool = False):
    """Curved razor glacial talon with pale-ice top edge and dark underside separation."""
    mx = (bx + tx) * 0.5 - 1.0
    my = (by + ty) * 0.5 - 1.4
    c_base = HIDE_SH1 if dark else SAP_MID
    c_mid = HIDE_MID if dark else ICE_MID
    c_hi = HIDE_HI if dark else ICE_PALE

    pts = [
        (bx, by - thickness),
        (mx, my - thickness * 0.65),
        (tx, ty),
        (mx + 1.2, my + thickness * 0.65),
        (bx + 1.5, by + thickness * 0.7),
    ]
    poly_safe(sp, pts, c_base)
    line_safe(sp, bx, by - thickness * 0.8, mx, my - thickness * 0.4, c_mid)
    line_safe(sp, mx, my - thickness * 0.4, tx, ty, c_hi)
    line_safe(sp, bx + 1, by + thickness * 0.7, tx, ty, INK_DARK)
    if not dark:
        clamp_px(sp, tx, ty, PURE_WHT)


def draw_spark_cross(sp: Sprite, cx: int, cy: int, arm: int = 3, core_col: str = PURE_WHT, outer_col: str = CORE_HI):
    """Connected crisp 4-point glacial frost sparkle (never isolated!)."""
    clamp_px(sp, cx, cy, core_col)
    for d in range(1, arm + 1):
        col = core_col if d == 1 else (outer_col if d == 2 else CORE_MID)
        clamp_px(sp, cx + d, cy, col)
        clamp_px(sp, cx - d, cy, col)
        clamp_px(sp, cx, cy + d, col)
        clamp_px(sp, cx, cy - d, col)
    if arm >= 3:
        for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            clamp_px(sp, cx + ddx, cy + ddy, outer_col)


def draw_core_vein(sp: Sprite, pts, bright: bool = False, wide: bool = False):
    """Emissive bright-cyan crystal core fissure vein with dark crevice rim."""
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        line_safe(sp, x0, y0 + 1, x1, y1 + 1, INK_DARK)
        line_safe(sp, x0 + 1, y0, x1 + 1, y1, CORE_DARK)
        if wide:
            line_safe(sp, x0, y0 - 1, x1, y1 - 1, CORE_DARK)
            line_safe(sp, x0 - 1, y0, x1 - 1, y1, CORE_MID if bright else CORE_DARK)
        line_safe(sp, x0, y0, x1, y1, CORE_HI if bright else CORE_MID)
    if bright:
        for x, y in pts[1:-1]:
            clamp_px(sp, x, y, PURE_WHT)
            clamp_px(sp, x - 1, y, CORE_HI)


# ---------------------------------------------------------------------------
# Selective Material-Aware Outline (4-connected)
# ---------------------------------------------------------------------------

def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected outer outline tinted by adjacent material & top-left lighting."""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_cel = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_cel.load()

    rgba_dark = hex2rgba(INK_DARK)
    rgba_mid  = hex2rgba(HIDE_SH1)
    rgba_ice  = hex2rgba(SAP_MID)

    ice_lit_set = {
        hex2rgba(ICE_PALE)[:3], hex2rgba(ICE_HI)[:3],
        hex2rgba(ICE_MID)[:3], hex2rgba(PURE_WHT)[:3],
        hex2rgba(CORE_HI)[:3],
    }
    metal_lit_set = {
        hex2rgba(MTL_SPEC)[:3], hex2rgba(MTL_HI)[:3], hex2rgba(HIDE_RIM)[:3],
    }

    body_layers = [ln for ln in sp.layer_order if ln not in ("fx", "outline")]
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

            is_top_left = any(dx == 1 or dy == 1 for dx, dy, _ in nbrs) and not any(dy == -1 for _, dy, _ in nbrs)
            rgbs = [rgb for _, _, rgb in nbrs]

            if is_top_left and any(rgb in ice_lit_set for rgb in rgbs) and y < 58:
                dst[x, y] = rgba_ice
            elif is_top_left and any(rgb in metal_lit_set for rgb in rgbs) and y < 60:
                dst[x, y] = rgba_mid
            else:
                dst[x, y] = rgba_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters
# ---------------------------------------------------------------------------

def draw_tail(sp: Sprite, bx: int, by: int, pose: str, pulse: bool):
    """Sweeping armored tail arching up-right into a razor-sharp glacial crystal fan plume.
    Cleanly inset from the right canvas edge (x <= 92) across all 6 frames!"""
    sp.layer("tail")

    if pose == "idle2":
        tx_off, ty_off = 0, -2
    elif pose == "windup":
        tx_off, ty_off = -2, -2
    elif pose == "strike":
        tx_off, ty_off = -3, -6
    elif pose == "hurt":
        tx_off, ty_off = -4, 4  # Keeps hurt tail cleanly inset at x <= 92!
    else:
        tx_off, ty_off = 0, 0

    p0 = (bx + 23, by + 11)
    p1 = (min(W - 18, bx + 31 + tx_off // 2), by + 15 + ty_off // 3)
    p2 = (min(W - 13, bx + 37 + tx_off), by + 9 + ty_off // 2)
    p3 = (min(W - 10, bx + 40 + tx_off), by - 2 + ty_off)

    poly_safe(sp, [
        (p0[0], p0[1] - 4),
        (p1[0] - 1, p1[1] - 4),
        (p2[0] - 4, p2[1] - 2),
        (p3[0] - 4, p3[1] + 2),
        (p3[0] + 2, p3[1] + 3),
        (p2[0] + 3, p2[1] + 4),
        (p1[0] + 2, p1[1] + 4),
        (p0[0], p0[1] + 5),
    ], HIDE_SH1)

    poly_safe(sp, [
        (p0[0], p0[1] - 4),
        (p1[0] - 1, p1[1] - 4),
        (p2[0] - 4, p2[1] - 2),
        (p3[0] - 3, p3[1] + 1),
        (p2[0] - 1, p2[1] + 1),
        (p1[0], p1[1]),
        (p0[0], p0[1]),
    ], HIDE_MID)

    line_safe(sp, p0[0], p0[1] + 4, p1[0] + 1, p1[1] + 4, HIDE_SH2)
    line_safe(sp, p1[0] + 1, p1[1] + 4, p2[0] + 2, p2[1] + 3, INK_DARK)

    bands = [
        (p0[0] + 5, p0[1] + 1),
        (p1[0] + 1, p1[1] - 2),
        (p2[0] - 1, p2[1] - 1),
        (p3[0] - 1, p3[1] + 4),
    ]
    for sx, sy in bands:
        line_safe(sp, sx - 2, sy - 2, sx + 2, sy + 2, HIDE_SH2)
        line_safe(sp, sx - 2, sy - 3, sx + 1, sy, MTL_MID)
        clamp_px(sp, sx - 2, sy - 3, MTL_HI)

    cx_p = min(W - 11, p3[0] - 1)
    cy_p = p3[1] + 3
    spires = [
        (cx_p - 4, cy_p + 2, cx_p - 10, cy_p - 11, 2.5, False),
        (cx_p - 2, cy_p,     cx_p - 5,  cy_p - 16, 2.8, False),
        (cx_p,     cy_p - 1, cx_p + 1,  cy_p - 19, 3.3, False),
        (cx_p + 2, cy_p,     cx_p + 7,  cy_p - 14, 2.7, False),
        (cx_p + 2, cy_p + 3, cx_p + 8,  cy_p - 5,  2.3, True),
        (cx_p + 1, cy_p + 6, cx_p + 7,  cy_p + 1,  2.1, True),
    ]
    for sbx, sby, stx, sty, hw, dk in spires:
        draw_crystal_spire(sp, sbx, sby, stx, sty, hw, lit_side=-1, dark_mode=dk, pulse=pulse)

    draw_scale_chevron(sp, cx_p - 2, cy_p + 5, 3, 2, lit=True)
    draw_scale_chevron(sp, cx_p + 1, cy_p + 6, 3, 2, lit=False)


def draw_far_hind_leg(sp: Sprite, bx: int, by: int, pose: str):
    """Darkened atmospheric far hind leg tucked clearly beneath the chest/belly."""
    sp.layer("far_hind_leg")
    lx = bx - 10 + (1 if pose == "hurt" else (-1 if pose == "strike" else 0))
    foot_y = GROUND_Y - 6  # Perspective baseline y=72

    poly_safe(sp, [
        (lx - 4, by + 14),
        (lx + 5, by + 14),
        (lx + 4, foot_y - 2),
        (lx - 3, foot_y - 2),
    ], HIDE_SH2)
    poly_safe(sp, [
        (lx - 3, by + 15),
        (lx + 1, by + 15),
        (lx + 1, foot_y - 3),
        (lx - 2, foot_y - 3),
    ], HIDE_SH1)

    poly_safe(sp, [
        (lx - 6, foot_y - 3),
        (lx + 4, foot_y - 4),
        (lx + 4, foot_y),
        (lx - 6, foot_y),
    ], HIDE_SH2)
    hspan(sp, foot_y - 3, lx - 5, lx + 2, HIDE_SH1)

    draw_claw(sp, lx - 5, foot_y - 1, lx - 9, foot_y, 1.4, dark=True)
    draw_claw(sp, lx - 2, foot_y - 1, lx - 6, foot_y, 1.5, dark=True)
    draw_claw(sp, lx + 1, foot_y - 1, lx - 2, foot_y, 1.4, dark=True)


def draw_far_shoulder_crystals(sp: Sprite, bx: int, by: int, pose: str, pulse: bool):
    """Sweeping outward-left wing of tall pale-ice crystal spikes rising from the far shoulder."""
    sp.layer("far_shoulder_crystals")
    ox = bx - 32
    oy = by - 5
    if pose == "windup":
        ox += 1
        oy -= 2
    elif pose == "strike":
        ox += 0
        oy += 3
    elif pose == "hurt":
        ox += 3
        oy -= 2

    spires = [
        (ox + 6, oy + 7,  ox + 2,  oy - 14, 3.4, True),
        (ox + 2, oy + 10, ox - 5,  oy - 18, 4.3, False),
        (ox,     oy + 14, ox - 8,  oy - 7,  3.1, False),
        (ox - 1, oy + 17, ox - 8,  oy + 3,  2.4, False),
    ]
    for sbx, sby, stx, sty, hw, dk in spires:
        draw_crystal_spire(sp, sbx, sby, stx, sty, hw, lit_side=-1, dark_mode=dk, pulse=pulse)

    poly_safe(sp, [
        (ox - 2, oy + 12),
        (ox + 7, oy + 9),
        (ox + 8, oy + 15),
        (ox - 3, oy + 17),
    ], MTL_SH)
    line_safe(sp, ox - 2, oy + 12, ox + 7, oy + 9, MTL_HI)
    line_safe(sp, ox - 2, oy + 13, ox + 6, oy + 10, MTL_MID)


def draw_far_front_leg(sp: Sprite, bx: int, by: int, pose: str):
    """Massive far-left clawed forelimb anchored wide on the ground (or recoiling up in hurt)."""
    sp.layer("far_front_leg")

    if pose == "windup":
        sx, sy = bx - 27, by + 7
        fx, fy = bx - 32, GROUND_Y - 3
    elif pose == "strike":
        # Braced solidly behind the impact shockwave zone!
        sx, sy = bx - 24, by + 11
        fx, fy = bx - 27, GROUND_Y - 3
    elif pose == "hurt":
        # SHARPLY LIFTED off the ground in heavy knockback stagger!
        sx, sy = bx - 24, by + 7
        fx, fy = bx - 31, GROUND_Y - 10
    else:
        # Solidly planted at y = GROUND_Y - 2 (76) across idle1, idle2, blink!
        sx, sy = bx - 28, by + 10
        fx, fy = bx - 31, GROUND_Y - 2

    poly_safe(sp, [
        (sx - 6, sy),
        (sx + 6, sy - 2),
        (fx + 6, fy - 7),
        (fx - 5, fy - 6),
    ], HIDE_SH1)
    poly_safe(sp, [
        (sx - 6, sy),
        (sx + 1, sy),
        (fx + 1, fy - 7),
        (fx - 5, fy - 6),
    ], HIDE_MID)
    line_safe(sp, sx - 5, sy + 1, fx - 4, fy - 7, HIDE_HI)

    poly_safe(sp, [
        (fx - 5, fy - 11),
        (fx + 2, fy - 14),
        (fx + 7, fy - 9),
        (fx + 6, fy - 5),
        (fx + 1, fy - 8),
        (fx - 5, fy - 6),
    ], MTL_MID)
    line_safe(sp, fx - 5, fy - 11, fx + 2, fy - 14, MTL_HI)
    line_safe(sp, fx + 2, fy - 14, fx + 7, fy - 9, MTL_SPEC)
    line_safe(sp, fx - 5, fy - 7, fx + 1, fy - 9, MTL_SH)
    clamp_px(sp, fx + 1, fy - 11, ICE_HI)
    clamp_px(sp, fx + 1, fy - 10, ICE_MID)

    poly_safe(sp, [
        (fx - 7, fy - 5),
        (fx + 6, fy - 6),
        (fx + 7, fy - 1),
        (fx - 6, fy),
    ], HIDE_SH1)
    poly_safe(sp, [
        (fx - 6, fy - 5),
        (fx + 3, fy - 5),
        (fx + 2, fy - 2),
        (fx - 5, fy - 2),
    ], HIDE_MID)
    hspan(sp, fy - 5, fx - 5, fx + 2, HIDE_HI)

    claw_dy = -2 if pose == "hurt" else 0
    draw_claw(sp, fx - 6, fy - 3, fx - 12, fy + claw_dy,     1.8, dark=False)
    draw_claw(sp, fx - 2, fy - 2, fx - 7,  fy + 1 + claw_dy, 2.0, dark=False)
    draw_claw(sp, fx + 3, fy - 2, fx - 1,  fy + 1,           1.8, dark=False)


def draw_dorsal_crystals(sp: Sprite, bx: int, by: int, pose: str, pulse: bool):
    """Monumental fan of huge faceted sapphire & pale-ice dorsal spires crowning the arched back."""
    sp.layer("dorsal_crystals")

    lean = -4 if pose == "strike" else (5 if pose == "windup" else (4 if pose == "hurt" else 0))

    if pose == "windup":
        # In windup, pull central dorsal spikes slightly lower & swept back-right so the
        # HOISTED COLOSSAL CRYSTALLINE FIST towers cleanly into OPEN TOP SKY (y=2..26)!
        back_spires = [
            (bx - 16, by - 13, bx - 18, by - 23, 3.0, True),
            (bx + 8,  by - 15, bx + 18, by - 27, 3.6, True),
            (bx + 16, by - 10, bx + 26, by - 21, 3.2, True),
        ]
        front_spires = [
            (bx - 18, by - 12, bx - 21, by - 21, 2.9, False),
            (bx + 11, by - 13, bx + 22, by - 28, 4.2, False),
            (bx + 17, by - 9,  bx + 28, by - 20, 3.5, False),
            (bx + 21, by - 3,  bx + 30, by - 11, 2.9, False),
        ]
    else:
        back_spires = [
            (bx - 16, by - 14, bx - 19 + lean // 2, by - 27, 3.2, True),
            (bx - 6,  by - 18, bx - 5 + lean,       by - 34, 3.8, True),
            (bx + 4,  by - 17, bx + 10 + lean,      by - 33, 4.0, True),
            (bx + 15, by - 11, bx + 24 + lean,      by - 23, 3.4, True),
        ]
        front_spires = [
            (bx - 18, by - 13, bx - 20 + lean // 2, by - 24, 3.1, False),
            (bx - 10, by - 16, bx - 8 + lean // 2,  by - 33, 4.0, False),
            (bx - 1,  by - 18, bx + 5 + lean,       by - 38, 5.0, False),
            (bx + 8,  by - 15, bx + 17 + lean,      by - 34, 4.6, False),
            (bx + 16, by - 10, bx + 26 + lean,      by - 23, 3.6, False),
            (bx + 21, by - 3,  bx + 30 + lean,      by - 12, 3.0, False),
        ]

    for sbx, sby, stx, sty, hw, dk in back_spires:
        draw_crystal_spire(sp, sbx, sby, stx, sty, hw, lit_side=-1, dark_mode=dk, pulse=pulse)
    for sbx, sby, stx, sty, hw, dk in front_spires:
        draw_crystal_spire(sp, sbx, sby, stx, sty, hw, lit_side=-1, dark_mode=dk, pulse=pulse)


def draw_torso_body(sp: Sprite, bx: int, by: int, pose: str, pulse: bool):
    """Colossal hunched armored torso with dark slate-blue scales, angular frost-steel chest armor,
    glowing bright-cyan crystal core fissures, and a clean rear belly arch for monumental leg separation."""
    sp.layer("torso_body")

    torso_pts = [
        (bx - 24, by - 6),
        (bx - 14, by - 18),
        (bx + 3,  by - 20),
        (bx + 16, by - 12),
        (bx + 27, by + 1),
        (bx + 27, by + 14),
        (bx + 18, by + 15),
        (bx + 9,  by + 16),
        (bx - 5,  by + 20),
        (bx - 18, by + 21),
        (bx - 27, by + 13),
    ]
    poly_safe(sp, torso_pts, HIDE_SH1)

    poly_safe(sp, [
        (bx - 23, by - 5),
        (bx - 13, by - 18),
        (bx + 3,  by - 20),
        (bx + 15, by - 12),
        (bx + 24, by + 1),
        (bx + 12, by + 4),
        (bx - 8,  by + 2),
        (bx - 22, by + 4),
    ], HIDE_MID)

    poly_safe(sp, [
        (bx - 19, by - 10),
        (bx - 12, by - 18),
        (bx + 2,  by - 19),
        (bx + 12, by - 13),
        (bx + 5,  by - 9),
        (bx - 10, by - 10),
    ], HIDE_HI)

    poly_safe(sp, [
        (bx - 17, by + 15),
        (bx + 14, by + 11),
        (bx + 26, by + 11),
        (bx + 18, by + 15),
        (bx + 9,  by + 16),
        (bx - 5,  by + 20),
        (bx - 18, by + 21),
    ], HIDE_SH2)

    dorsal_scales = [
        (bx - 15, by - 12, True),  (bx - 8, by - 15, True),  (bx - 1, by - 16, True),
        (bx + 6,  by - 14, True),  (bx + 12, by - 10, False),
        (bx - 12, by - 7,  True),  (bx - 5, by - 10, True),  (bx + 3, by - 10, False),
        (bx + 10, by - 6,  False), (bx + 17, by - 3, False),
        (bx - 8,  by - 2,  False), (bx - 1, by - 4,  False), (bx + 6, by - 3,  False),
        (bx + 13, by + 1,  False), (bx + 20, by + 4, False),
    ]
    for sx, sy, is_lit in dorsal_scales:
        draw_scale_chevron(sp, sx, sy, 3, 2, lit=is_lit, deep=(not is_lit and sy > by - 4))

    icicles = [
        (bx - 7, by + 19, bx - 9, by + 23),
        (bx - 3, by + 19, bx - 4, by + 24),
        (bx + 2, by + 18, bx + 1, by + 22),
    ]
    for ix0, iy0, ix1, iy1 in icicles:
        line_safe(sp, ix0, iy0, ix1, iy1, HIDE_HI)
        line_safe(sp, ix0 + 1, iy0, ix1 + 1, iy1 - 1, HIDE_SH1)

    # Angular gothic chest carapace cavity + faceted sapphire & glowing cyan crystal core fissures!
    chest_poly = [
        (bx - 24, by + 4),
        (bx - 5,  by + 1),
        (bx + 3,  by + 10),
        (bx - 6,  by + 19),
        (bx - 18, by + 20),
        (bx - 26, by + 12),
    ]
    poly_safe(sp, chest_poly, SAP_DARK)

    poly_safe(sp, [
        (bx - 21, by + 6),
        (bx - 8,  by + 4),
        (bx - 3,  by + 11),
        (bx - 10, by + 17),
        (bx - 21, by + 14),
    ], SAP_MID)
    poly_safe(sp, [
        (bx - 18, by + 8),
        (bx - 10, by + 7),
        (bx - 8,  by + 13),
        (bx - 16, by + 15),
    ], ICE_DEEP)

    # Clear idle1 (steady cool cyan glow) vs idle2/combat (blazing pulsed core surge!)
    core_bright = pulse or pose in ("windup", "strike", "blink")
    draw_core_vein(sp, [(bx - 16, by + 6), (bx - 12, by + 11), (bx - 15, by + 17)], bright=core_bright, wide=core_bright)
    draw_core_vein(sp, [(bx - 12, by + 11), (bx - 5, by + 9), (bx + 1, by + 12)], bright=core_bright, wide=core_bright)
    draw_core_vein(sp, [(bx - 22, by + 10), (bx - 15, by + 12), (bx - 9, by + 16)], bright=core_bright, wide=False)

    if core_bright:
        poly_safe(sp, [
            (bx - 13, by + 8),
            (bx - 9,  by + 11),
            (bx - 13, by + 15),
            (bx - 17, by + 11),
        ], CORE_HI)
        hspan(sp, by + 11, bx - 15, bx - 11, PURE_WHT)
        hspan(sp, by + 10, bx - 14, bx - 12, PURE_WHT)
        clamp_px(sp, bx - 13, by + 12, PURE_WHT)
    else:
        clamp_px(sp, bx - 13, by + 11, CORE_HI)
        clamp_px(sp, bx - 12, by + 11, CORE_MID)
        clamp_px(sp, bx - 13, by + 12, CORE_MID)

    # Carved angular frost-steel chest filigree ribs
    rib_hi = ICE_HI if core_bright else MTL_HI
    ribs = [
        ((bx - 24, by + 5),  (bx - 14, by + 2)),
        ((bx - 14, by + 2),  (bx - 4,  by + 6)),
        ((bx - 4,  by + 6),  (bx + 2,  by + 11)),
        ((bx - 24, by + 13), (bx - 16, by + 19)),
        ((bx - 16, by + 19), (bx - 5,  by + 18)),
        ((bx - 5,  by + 18), (bx + 2,  by + 12)),
        ((bx - 20, by + 5),  (bx - 16, by + 11)),
        ((bx - 16, by + 11), (bx - 19, by + 17)),
        ((bx - 8,  by + 5),  (bx - 10, by + 11)),
        ((bx - 10, by + 11), (bx - 7,  by + 17)),
    ]
    for (x0, y0), (x1, y1) in ribs:
        line_safe(sp, x0, y0 + 1, x1, y1 + 1, INK_DARK)
        line_safe(sp, x0, y0, x1, y1, MTL_MID)
        line_safe(sp, x0, y0 - 1, (x0 + x1) // 2, (y0 + y1) // 2 - 1, rib_hi)
    clamp_px(sp, bx - 14, by + 1, MTL_SPEC)
    clamp_px(sp, bx - 16, by + 19, MTL_HI)

    # Dorsal & flank glowing cyan core vent fissures
    draw_core_vein(sp, [(bx + 1, by + 3), (bx + 7, by + 5), (bx + 13, by + 3)], bright=core_bright, wide=False)
    draw_core_vein(sp, [(bx - 6, by - 6), (bx, by - 7), (bx + 5, by - 5)], bright=core_bright, wide=False)

    line_safe(sp, bx - 6, by + 1, bx + 4, by - 5, MTL_SH)
    line_safe(sp, bx - 6, by,     bx + 4, by - 6, MTL_HI)
    clamp_px(sp, bx + 4, by - 6, MTL_SPEC)


def draw_near_hind_leg(sp: Sprite, bx: int, by: int, pose: str):
    """Heavy armored rear-right hindquarter planted firmly at x ≈ bx+26."""
    sp.layer("near_hind_leg")

    foot_y = GROUND_Y - 3  # Perspective baseline y=75 (solidly anchored!)
    hx = bx + 23 + (0 if pose == "windup" else (-2 if pose == "strike" else (0 if pose == "hurt" else 0)))
    hy = by + 8 + (1 if pose == "windup" else 0)
    fx = min(W - 10, bx + 26 + (-2 if pose == "strike" else (0 if pose == "hurt" else 0)))

    poly_safe(sp, [
        (hx - 6, hy - 2),
        (hx + 7, hy - 4),
        (fx + 6, foot_y - 10),
        (fx - 4, foot_y - 9),
    ], HIDE_SH1)
    poly_safe(sp, [
        (hx - 5, hy - 2),
        (hx + 3, hy - 3),
        (fx + 2, foot_y - 10),
        (fx - 3, foot_y - 9),
    ], HIDE_MID)
    line_safe(sp, hx - 5, hy - 1, fx - 3, foot_y - 10, HIDE_HI)

    draw_scale_chevron(sp, hx,     hy + 3, 3, 2, lit=True)
    draw_scale_chevron(sp, hx + 3, hy + 6, 3, 2, lit=False)

    poly_safe(sp, [
        (fx - 5, foot_y - 11),
        (fx + 1, foot_y - 14),
        (fx + 6, foot_y - 10),
        (fx + 5, foot_y - 6),
        (fx - 5, foot_y - 7),
    ], MTL_MID)
    line_safe(sp, fx - 5, foot_y - 11, fx + 1, foot_y - 14, MTL_HI)
    line_safe(sp, fx + 1, foot_y - 14, fx + 6, foot_y - 10, MTL_SPEC)
    line_safe(sp, fx - 5, foot_y - 7, fx + 5, foot_y - 6, MTL_SH)

    poly_safe(sp, [
        (fx - 6, foot_y - 6),
        (fx + 6, foot_y - 6),
        (fx + 7, foot_y - 1),
        (fx - 6, foot_y),
    ], HIDE_SH1)
    poly_safe(sp, [
        (fx - 5, foot_y - 6),
        (fx + 3, foot_y - 6),
        (fx + 3, foot_y - 2),
        (fx - 4, foot_y - 2),
    ], HIDE_MID)

    draw_claw(sp, fx - 5, foot_y - 2, fx - 10, foot_y,     1.7, dark=False)
    draw_claw(sp, fx - 1, foot_y - 2, fx - 5,  foot_y + 1, 1.9, dark=False)
    draw_claw(sp, fx + 4, foot_y - 2, fx + 2,  foot_y + 1, 1.7, dark=False)


def draw_near_shoulder_pauldron(sp: Sprite, bx: int, by: int, pose: str, pulse: bool):
    """Signature huge sculpted silver-steel pauldron & enormous jagged ice crystal shoulder horns."""
    sp.layer("near_shoulder_pauldron")

    sx = bx + 8
    sy = by - 1
    if pose == "windup":
        # Tilts flatter & back-right so the HOISTED COLOSSAL FIST commands the whole upper skyline!
        sx += 6
        sy += 1
    elif pose == "strike":
        sx -= 3
        sy += 2
    elif pose == "hurt":
        sx += 2
        sy -= 2

    if pose == "windup":
        spires = [
            (sx + 1, sy + 4, sx + 12, sy - 11, 3.6, False),
            (sx + 4, sy + 6, sx + 18, sy - 8,  4.0, False),
            (sx + 6, sy + 8, sx + 18, sy + 1,  3.1, True),
        ]
    else:
        tilt_x = -3 if pose == "strike" else (3 if pose == "hurt" else 0)
        spires = [
            (sx - 6, sy + 2,  sx - 9 + tilt_x,  sy - 15, 3.8, False),
            (sx - 2, sy + 4,  sx + 4 + tilt_x,  sy - 20, 4.5, False),
            (sx + 3, sy + 5,  sx + 15 + tilt_x, sy - 23, 5.2, False),
            (sx + 6, sy + 7,  sx + 18 + tilt_x, sy - 10, 3.5, True),
        ]
    for sbx, sby, stx, sty, hw, dk in spires:
        draw_crystal_spire(sp, sbx, sby, stx, sty, hw, lit_side=-1, dark_mode=dk, pulse=pulse)

    pauldron_outer = [
        (sx - 10, sy + 5),
        (sx - 6,  sy - 2),
        (sx + 1,  sy + 5),
        (sx + 11, sy + 2),
        (sx + 13, sy + 9),
        (sx + 4,  sy + 14),
        (sx - 9,  sy + 12),
    ]
    poly_safe(sp, pauldron_outer, MTL_SH)
    pauldron_inner = [
        (sx - 9,  sy + 5),
        (sx - 6,  sy - 1),
        (sx + 1,  sy + 6),
        (sx + 10, sy + 3),
        (sx + 11, sy + 8),
        (sx + 3,  sy + 12),
        (sx - 8,  sy + 10),
    ]
    poly_safe(sp, pauldron_inner, MTL_MID)
    line_safe(sp, sx - 9, sy + 5, sx - 6, sy - 1, MTL_HI)
    line_safe(sp, sx - 6, sy - 1, sx + 1, sy + 6, MTL_SPEC)
    line_safe(sp, sx + 1, sy + 6, sx + 10, sy + 3, MTL_HI)
    line_safe(sp, sx - 8, sy + 11, sx + 4, sy + 13, INK_DARK)

    core_bright = pulse or pose in ("windup", "strike", "blink")
    poly_safe(sp, [
        (sx - 5, sy + 6),
        (sx + 1, sy + 8),
        (sx + 7, sy + 6),
        (sx + 2, sy + 11),
    ], SAP_DARK)
    draw_core_vein(sp, [(sx - 4, sy + 7), (sx + 1, sy + 9), (sx + 6, sy + 7)], bright=core_bright, wide=core_bright)
    clamp_px(sp, sx + 1, sy + 9, PURE_WHT if core_bright else CORE_HI)


def draw_near_front_leg(sp: Sprite, bx: int, by: int, pose: str, pulse: bool):
    """COLOSSAL hero frost-knuckled forelimb!

    - Idle/blink: planted massively at fx = bx+3 on GROUND_Y = 78 with crisp rear leg-arch separation.
    - Windup: HOISTED HIGH OVERHEAD CLEAR OF HEAD HORNS (fist at x≈52, y≈15, towering crystal knuckles
      breaking the top skyline at y=2..8!) with gleaming silver gauntlet & left-hooked claws!
    - Strike: SLAMMED massively forward-down LEFT onto GROUND_Y = 78!
    - Hurt: Braced back & leaning diagonally in impact recoil.
    """
    sp.layer("near_front_leg")

    if pose == "windup":
        # UNMISTAKABLE TOWERING OVERHEAD GLACIAL FIST!
        # Placed cleanly ABOVE the dorsal ridge and CLEAR RIGHT of the head brow horns!
        sh_x, sh_y = bx + 13, by + 7     # (~62, 47) shoulder anchor
        el_x, el_y = bx + 16, by - 3     # (~65, 37) cocked armored elbow
        fi_x, fi_y = bx + 3,  by - 23    # (~52, 17) COLOSSAL FIST towering cleanly in open sky!

        # 1. Muscular upper arm lifting from shoulder to high cocked elbow
        poly_safe(sp, [
            (sh_x - 5, sh_y + 4),
            (sh_x + 5, sh_y + 2),
            (el_x + 5, el_y - 2),
            (el_x - 5, el_y + 3),
        ], HIDE_SH1)
        poly_safe(sp, [
            (sh_x - 4, sh_y + 2),
            (sh_x + 1, sh_y + 1),
            (el_x,     el_y),
            (el_x - 4, el_y + 2),
        ], HIDE_MID)

        # 2. Massive armored forearm surging UP-LEFT from cocked elbow to towering fist
        poly_safe(sp, [
            (el_x - 6, el_y + 4),
            (el_x + 5, el_y - 4),
            (fi_x + 10, fi_y + 5),
            (fi_x - 1,  fi_y + 12),
        ], HIDE_SH1)
        poly_safe(sp, [
            (el_x - 5, el_y + 2),
            (el_x + 1, el_y - 3),
            (fi_x + 6, fi_y + 5),
            (fi_x - 1, fi_y + 11),
        ], HIDE_MID)
        line_safe(sp, el_x - 4, el_y + 1, fi_x, fi_y + 10, HIDE_HI)

        # Crisp frost crystal elbow spurs jutting back-right
        draw_crystal_spire(sp, el_x + 3, el_y - 2, el_x + 14, el_y - 12, 2.8, lit_side=-1, pulse=True)
        draw_crystal_spire(sp, el_x + 4, el_y + 2, el_x + 13, el_y - 3,  2.3, lit_side=-1, pulse=True)

        # 3. Gleaming ornate silver-steel diamond gauntlet bracer wrapping the raised wrist!
        # High-contrast silver bevels make the lifted forearm read INSTANTLY at 1x scale!
        poly_safe(sp, [
            (fi_x + 1,  fi_y + 12),
            (fi_x + 11, fi_y + 4),
            (fi_x + 15, fi_y + 12),
            (fi_x + 5,  fi_y + 19),
        ], MTL_SH)
        poly_safe(sp, [
            (fi_x + 2,  fi_y + 12),
            (fi_x + 10, fi_y + 5),
            (fi_x + 13, fi_y + 11),
            (fi_x + 5,  fi_y + 17),
        ], MTL_MID)
        line_safe(sp, fi_x + 2, fi_y + 12, fi_x + 10, fi_y + 5, MTL_SPEC)
        line_safe(sp, fi_x + 2, fi_y + 13, fi_x + 10, fi_y + 6, MTL_HI)
        # Blazing cyan crystal gem embedded in the raised gauntlet!
        poly_safe(sp, [(fi_x + 7, fi_y + 9), (fi_x + 10, fi_y + 10), (fi_x + 8, fi_y + 14), (fi_x + 5, fi_y + 12)], CORE_HI)
        clamp_px(sp, fi_x + 8, fi_y + 11, PURE_WHT)

        # 4. COLOSSAL FROST-KNUCKLED CRYSTALLINE FIST TOWERING IN OPEN TOP SKY!
        poly_safe(sp, [
            (fi_x - 10, fi_y - 1),
            (fi_x,      fi_y - 7),
            (fi_x + 11, fi_y - 1),
            (fi_x + 10, fi_y + 8),
            (fi_x - 3,  fi_y + 11),
            (fi_x - 10, fi_y + 6),
        ], HIDE_SH1)
        poly_safe(sp, [
            (fi_x - 9, fi_y - 1),
            (fi_x,     fi_y - 6),
            (fi_x + 7, fi_y),
            (fi_x - 1, fi_y + 7),
            (fi_x - 8, fi_y + 5),
        ], HIDE_MID)
        # Beveled frost-steel knuckle guard across the top of the colossal fist!
        poly_safe(sp, [
            (fi_x - 8, fi_y - 2),
            (fi_x,     fi_y - 7),
            (fi_x + 7, fi_y - 2),
            (fi_x + 4, fi_y + 2),
            (fi_x - 6, fi_y + 2),
        ], MTL_MID)
        line_safe(sp, fi_x - 8, fi_y - 2, fi_x, fi_y - 7, MTL_SPEC)
        line_safe(sp, fi_x, fi_y - 7, fi_x + 7, fi_y - 2, MTL_HI)

        # HUGE jagged glacial knuckle spikes shooting UP into open top sky (y = 2..8)!
        draw_crystal_spire(sp, fi_x - 5, fi_y - 4, fi_x - 12, fi_y - 14, 3.2, lit_side=-1, pulse=True)
        draw_crystal_spire(sp, fi_x,     fi_y - 6, fi_x - 2,  fi_y - 15, 3.9, lit_side=-1, pulse=True)
        draw_crystal_spire(sp, fi_x + 6, fi_y - 4, fi_x + 11, fi_y - 14, 3.3, lit_side=-1, pulse=True)

        # 3 huge menacing curved ice talons hooked forward-LEFT ready to slam!
        draw_claw(sp, fi_x - 8, fi_y + 2, fi_x - 16, fi_y + 5,  2.1, dark=False)
        draw_claw(sp, fi_x - 6, fi_y + 6, fi_x - 14, fi_y + 10, 2.1, dark=False)
        draw_claw(sp, fi_x - 2, fi_y + 9, fi_x - 9,  fi_y + 13, 1.9, dark=False)

        # Blazing cyan frost-core veins & white-hot core surging inside the raised knuckles!
        draw_core_vein(sp, [(fi_x - 6, fi_y + 2), (fi_x, fi_y + 3), (fi_x + 6, fi_y + 1)], bright=True, wide=True)
        hspan(sp, fi_y + 2, fi_x - 2, fi_x + 1, PURE_WHT)
        return fi_x - 2, fi_y - 2

    elif pose == "strike":
        # EARTH-SHATTERING GLACIAL SLAM forward-down LEFT onto GROUND_Y = 78!
        sh_x, sh_y = bx + 5, by + 10
        fx, fy = bx - 4, GROUND_Y

        draw_crystal_spire(sp, sh_x + 4, sh_y + 2, sh_x + 15, sh_y - 9, 3.2, lit_side=-1, pulse=True)
        draw_crystal_spire(sp, sh_x + 6, sh_y + 6, sh_x + 15, sh_y,     2.6, lit_side=-1, pulse=True)

        poly_safe(sp, [
            (sh_x - 4, sh_y - 2),
            (sh_x + 8, sh_y),
            (fx + 10,  fy - 8),
            (fx - 5,   fy - 10),
        ], HIDE_SH1)
        poly_safe(sp, [
            (sh_x - 3, sh_y - 2),
            (sh_x + 4, sh_y),
            (fx + 4,   fy - 9),
            (fx - 4,   fy - 10),
        ], HIDE_MID)
        line_safe(sp, sh_x - 3, sh_y - 2, fx - 4, fy - 10, HIDE_HI)

        poly_safe(sp, [
            (fx - 4, fy - 17),
            (fx + 3, fy - 22),
            (fx + 10, fy - 14),
            (fx + 8, fy - 7),
            (fx + 1, fy - 12),
            (fx - 5, fy - 8),
        ], MTL_SH)
        poly_safe(sp, [
            (fx - 3, fy - 16),
            (fx + 3, fy - 20),
            (fx + 9, fy - 14),
            (fx + 7, fy - 9),
            (fx + 1, fy - 13),
            (fx - 4, fy - 9),
        ], MTL_MID)
        line_safe(sp, fx - 3, fy - 16, fx + 3, fy - 20, MTL_SPEC)
        line_safe(sp, fx + 3, fy - 20, fx + 9, fy - 14, MTL_HI)
        poly_safe(sp, [(fx + 3, fy - 18), (fx + 5, fy - 14), (fx + 3, fy - 11), (fx + 1, fy - 14)], CORE_HI)
        clamp_px(sp, fx + 3, fy - 15, PURE_WHT)

        poly_safe(sp, [
            (fx - 10, fy - 9),
            (fx + 9,  fy - 9),
            (fx + 10, fy - 1),
            (fx - 10, fy),
        ], HIDE_SH1)
        poly_safe(sp, [
            (fx - 9, fy - 9),
            (fx + 5, fy - 9),
            (fx + 4, fy - 3),
            (fx - 8, fy - 3),
        ], HIDE_MID)
        hspan(sp, fy - 8, fx - 8, fx + 4, HIDE_HI)
        draw_core_vein(sp, [(fx - 7, fy - 6), (fx - 1, fy - 5), (fx + 5, fy - 6)], bright=True, wide=True)

        draw_crystal_spire(sp, fx - 6, fy - 8, fx - 14, fy - 15, 2.7, lit_side=-1, pulse=True)
        draw_claw(sp, fx - 8, fy - 4, fx - 16, fy, 2.1, dark=False)
        draw_claw(sp, fx - 2, fy - 3, fx - 8,  fy, 2.2, dark=False)
        draw_claw(sp, fx + 4, fy - 3, fx + 1,  fy, 2.0, dark=False)
        return fx - 14, fy - 4

    else:
        if pose == "hurt":
            sx, sy = bx + 10, by + 7
            fx, fy = bx + 2, GROUND_Y
        else:
            sx, sy = bx + 7, by + 9
            fx, fy = bx + 3, GROUND_Y

        draw_crystal_spire(sp, sx + 5, sy + 4,  sx + 15, sy - 7,  3.1, lit_side=-1, pulse=pulse)
        draw_crystal_spire(sp, sx + 6, sy + 9,  sx + 15, sy + 1,  2.7, lit_side=-1, pulse=pulse)
        draw_crystal_spire(sp, sx + 5, sy + 13, sx + 12, sy + 8,  2.1, lit_side=-1, dark_mode=True)

        poly_safe(sp, [
            (sx - 6, sy - 2),
            (sx + 6, sy),
            (fx + 7, fy - 7),
            (fx - 7, fy - 7),
        ], HIDE_SH1)
        poly_safe(sp, [
            (sx - 5, sy - 2),
            (sx + 2, sy),
            (fx + 1, fy - 7),
            (fx - 6, fy - 7),
        ], HIDE_MID)
        line_safe(sp, sx - 5, sy - 1, fx - 6, fy - 8, HIDE_HI)

        greave = [
            (fx - 6, fy - 17),
            (fx + 1, fy - 24),
            (fx + 7, fy - 16),
            (fx + 7, fy - 7),
            (fx + 1, fy - 12),
            (fx - 7, fy - 7),
        ]
        poly_safe(sp, greave, MTL_SH)
        greave_in = [
            (fx - 5, fy - 16),
            (fx + 1, fy - 22),
            (fx + 6, fy - 16),
            (fx + 6, fy - 9),
            (fx + 1, fy - 13),
            (fx - 6, fy - 9),
        ]
        poly_safe(sp, greave_in, MTL_MID)
        line_safe(sp, fx - 5, fy - 16, fx + 1, fy - 22, MTL_HI)
        line_safe(sp, fx + 1, fy - 22, fx + 6, fy - 16, MTL_SPEC)
        line_safe(sp, fx - 6, fy - 9, fx + 1, fy - 13, MTL_HI)
        line_safe(sp, fx + 1, fy - 13, fx + 6, fy - 9, MTL_SH)

        poly_safe(sp, [
            (fx + 1, fy - 20),
            (fx + 3, fy - 16),
            (fx + 1, fy - 13),
            (fx - 1, fy - 16),
        ], CORE_HI if pulse else ICE_MID)
        line_safe(sp, fx + 1, fy - 20, fx - 1, fy - 16, PURE_WHT if pulse else ICE_PALE)
        clamp_px(sp, fx + 1, fy - 18, PURE_WHT if pulse else ICE_PALE)
        clamp_px(sp, fx + 2, fy - 16, SAP_MID)

        poly_safe(sp, [
            (fx - 8, fy - 8),
            (fx + 7, fy - 8),
            (fx + 8, fy - 1),
            (fx - 8, fy - 1),
        ], HIDE_SH1)
        poly_safe(sp, [
            (fx - 7, fy - 8),
            (fx + 4, fy - 8),
            (fx + 3, fy - 3),
            (fx - 6, fy - 3),
        ], HIDE_MID)
        hspan(sp, fy - 8, fx - 6, fx + 3, HIDE_HI)
        hspan(sp, fy - 5, fx - 6, fx + 5, HIDE_SH2)
        hspan(sp, fy - 6, fx - 5, fx + 3, MTL_MID)

        draw_claw(sp, fx - 7, fy - 4, fx - 14, fy, 2.1, dark=False)
        draw_claw(sp, fx - 2, fy - 3, fx - 7,  fy, 2.3, dark=False)
        draw_claw(sp, fx + 4, fy - 3, fx + 1,  fy, 2.1, dark=False)
        return fx, fy


def draw_head(sp: Sprite, bx: int, by: int, pose: str, pulse: bool):
    """Fierce, razor-sharp draconic armored boss head facing down-left with hooked armored snout,
    high-contrast twin curved brow horns, piercing glowing cyan eyes & tapered V-snarl maw."""
    sp.layer("head")

    hx = bx - 22
    hy = by + 2
    if pose == "idle2":
        hx -= 1
        hy += 1
    elif pose == "windup":
        # Roaring fiercely forward-left, cleanly clear below/left of the towering raised fist!
        hx += 0
        hy -= 1
    elif pose == "strike":
        # Clean left margin while lunging aggressively down-left into the shockwave!
        hx -= 4
        hy += 2
    elif pose == "hurt":
        hx += 5
        hy -= 5

    jaw_open = 1 if pose == "idle2" else (3 if pose in ("windup", "strike", "hurt") else 0)

    # 1. Back/far swept brow horn
    poly_safe(sp, [
        (hx - 2,  hy - 7),
        (hx - 7,  hy - 15),
        (hx - 11, hy - 24),
        (hx - 4,  hy - 18),
        (hx + 2,  hy - 9),
    ], INK_DARK)
    poly_safe(sp, [
        (hx - 2,  hy - 8),
        (hx - 7,  hy - 15),
        (hx - 11, hy - 24),
        (hx - 5,  hy - 17),
        (hx + 1,  hy - 9),
    ], MTL_MID)
    line_safe(sp, hx - 2, hy - 8, hx - 11, hy - 24, MTL_SPEC)
    line_safe(sp, hx - 6, hy - 14, hx - 11, hy - 24, ICE_PALE)
    clamp_px(sp, hx - 11, hy - 24, PURE_WHT)

    # 2. Jagged swept cheek & crown crystal armor spines
    cheek_spikes = [
        (hx + 4, hy - 5,  hx + 14, hy - 12, 2.4, False),
        (hx + 6, hy - 1,  hx + 15, hy - 4,  2.3, False),
        (hx + 6, hy + 4,  hx + 13, hy + 2,  2.1, True),
        (hx + 4, hy + 8,  hx + 10, hy + 9,  1.8, True),
    ]
    for sbx, sby, stx, sty, hw, dk in cheek_spikes:
        draw_crystal_spire(sp, sbx, sby, stx, sty, hw, lit_side=-1, dark_mode=dk, pulse=pulse)

    # 3. Tapered Armored Draconic Skull & Hooked Snout Bulk
    skull_pts = [
        (hx - 8,  hy - 4),
        (hx - 2,  hy - 10),
        (hx + 7,  hy - 8),
        (hx + 10, hy + 1),
        (hx + 5,  hy + 9),
        (hx - 4,  hy + 15 + jaw_open),
        (hx - 10, hy + 8 + jaw_open // 2),
        (hx - 12, hy + 4),   # Sleek hooked downward dragon snout tip!
        (hx - 11, hy + 1),
    ]
    poly_safe(sp, skull_pts, HIDE_SH2)

    poly_safe(sp, [
        (hx - 7,  hy - 4),
        (hx - 1,  hy - 9),
        (hx + 7,  hy - 6),
        (hx + 8,  hy + 1),
        (hx - 1,  hy + 4),
        (hx - 11, hy + 4),
        (hx - 11, hy + 1),
    ], HIDE_MID)

    # Diamond beveled frost-steel forehead plate & nose bridge
    poly_safe(sp, [
        (hx - 2, hy - 9),
        (hx + 3, hy - 5),
        (hx - 3, hy + 1),
        (hx - 7, hy - 4),
    ], MTL_MID)
    line_safe(sp, hx - 2, hy - 9, hx - 7, hy - 4, MTL_HI)
    line_safe(sp, hx - 2, hy - 9, hx + 3, hy - 5, MTL_SPEC)
    line_safe(sp, hx - 7, hy - 4, hx - 3, hy + 1, MTL_SH)
    clamp_px(sp, hx - 2, hy - 5, ICE_HI)
    clamp_px(sp, hx - 2, hy - 4, ICE_MID)

    # Sleek hooked armored snout ridge + specular scale glints + flared nostril
    line_safe(sp, hx - 4, hy - 1, hx - 11, hy + 3, MTL_HI)
    line_safe(sp, hx - 3, hy,     hx - 10, hy + 4, HIDE_HI)
    clamp_px(sp, hx - 6,  hy,     MTL_SPEC)
    clamp_px(sp, hx - 11, hy + 3, MTL_SPEC)
    clamp_px(sp, hx - 10, hy + 3, INK_DARK)

    # 4. HERO NEAR BROW HORN (slightly shorter angle in windup so zero collision with raised fist!)
    horn_dx = 12 if pose == "windup" else 16
    horn_dy = -21 if pose == "windup" else -26
    poly_safe(sp, [
        (hx + 2,       hy - 8),
        (hx + 8,       hy - 15),
        (hx + horn_dx, hy + horn_dy),
        (hx + horn_dx - 3, hy + horn_dy + 11),
        (hx + 8,       hy - 5),
    ], INK_DARK)
    poly_safe(sp, [
        (hx + 2,       hy - 8),
        (hx + 7,       hy - 15),
        (hx + horn_dx, hy + horn_dy),
        (hx + horn_dx - 5, hy + horn_dy + 11),
        (hx + 6,       hy - 6),
    ], MTL_SH)
    poly_safe(sp, [
        (hx + 2,       hy - 8),
        (hx + 7,       hy - 15),
        (hx + horn_dx - 1, hy + horn_dy + 1),
        (hx + 8,       hy - 12),
        (hx + 5,       hy - 7),
    ], MTL_MID)
    line_safe(sp, hx + 2, hy - 8, hx + 7, hy - 15, MTL_SPEC)
    line_safe(sp, hx + 7, hy - 15, hx + horn_dx, hy + horn_dy, ICE_PALE)
    line_safe(sp, hx + 5, hy - 10, hx + horn_dx - 3, hy + horn_dy + 5, ICE_MID)
    clamp_px(sp, hx + horn_dx, hy + horn_dy, PURE_WHT)

    # 5. FIERCE ANGLED V-SNARL JAWS & BLAZING GLACIAL MAW CORE
    maw_pts = [
        (hx - 11, hy + 4),
        (hx - 2,  hy + 3),
        (hx + 4,  hy + 5),
        (hx,      hy + 10 + jaw_open),
        (hx - 5,  hy + 12 + jaw_open),
        (hx - 10, hy + 7 + jaw_open // 2),
    ]
    poly_safe(sp, maw_pts, CORE_DARK)
    poly_safe(sp, [
        (hx - 9, hy + 5),
        (hx - 1, hy + 5),
        (hx + 1, hy + 7 + jaw_open // 2),
        (hx - 4, hy + 11 + jaw_open),
        (hx - 8, hy + 7 + jaw_open // 2),
    ], CORE_MID)
    poly_safe(sp, [
        (hx - 7, hy + 6),
        (hx - 2, hy + 6),
        (hx - 4, hy + 10 + jaw_open),
        (hx - 7, hy + 7 + jaw_open // 2),
    ], CORE_HI)
    if pulse or pose in ("blink", "windup", "strike", "hurt"):
        hspan(sp, hy + 7, hx - 6, hx - 3, PURE_WHT)

    poly_safe(sp, [
        (hx - 9,  hy + 8 + jaw_open // 2),
        (hx - 4,  hy + 12 + jaw_open),
        (hx + 5,  hy + 7 + jaw_open // 2),
        (hx + 4,  hy + 10 + jaw_open // 2),
        (hx - 4,  hy + 16 + jaw_open),
        (hx - 10, hy + 10 + jaw_open // 2),
    ], MTL_MID)
    line_safe(sp, hx - 9, hy + 10 + jaw_open // 2, hx - 4, hy + 16 + jaw_open, MTL_SPEC)
    line_safe(sp, hx - 4, hy + 16 + jaw_open, hx + 4, hy + 10 + jaw_open // 2, MTL_SH)
    clamp_px(sp, hx - 4, hy + 16 + jaw_open, ICE_PALE)

    upper_fangs = [(hx - 9, hy + 5), (hx - 7, hy + 5), (hx - 4, hy + 4), (hx - 1, hy + 4)]
    for fx_t, fy_t in upper_fangs:
        clamp_px(sp, fx_t, fy_t, PURE_WHT)
        clamp_px(sp, fx_t, fy_t + 1, ICE_PALE)
    lower_fangs = [(hx - 8, hy + 8 + jaw_open // 2), (hx - 5, hy + 10 + jaw_open), (hx - 2, hy + 9 + jaw_open)]
    for fx_t, fy_t in lower_fangs:
        clamp_px(sp, fx_t, fy_t, PURE_WHT)

    # 6. HEAVY HOODED BROW & PIERCING GLOWING CYAN EYES WITH LOWER RIM REFLECTION!
    poly_safe(sp, [
        (hx - 3, hy - 2),
        (hx + 4, hy - 4),
        (hx + 4, hy + 1),
        (hx - 3, hy + 2),
    ], INK_DARK)
    brow_drop = 1 if pose == "blink" else 0
    line_safe(sp, hx - 4, hy - 2 + brow_drop, hx + 4, hy - 5 + brow_drop, HIDE_SH2)
    line_safe(sp, hx - 4, hy - 3 + brow_drop, hx + 4, hy - 6 + brow_drop, MTL_HI)
    # Subtle icy-cyan glow rim catching the lower cheek scale beneath the eye socket!
    clamp_px(sp, hx,     hy + 2, CORE_DARK)
    clamp_px(sp, hx + 1, hy + 2, CORE_MID if pulse else CORE_DARK)

    clamp_px(sp, hx - 10, hy - 1, INK_DARK)
    clamp_px(sp, hx - 9,  hy - 1, INK_DARK)
    clamp_px(sp, hx - 9,  hy,     INK_DARK)

    if pose == "hurt":
        clamp_px(sp, hx - 1, hy - 1, CORE_HI)
        clamp_px(sp, hx,     hy,     PURE_WHT)
        clamp_px(sp, hx + 1, hy - 1, CORE_HI)
        clamp_px(sp, hx + 2, hy - 2, CORE_MID)
        clamp_px(sp, hx - 9, hy - 1, CORE_MID)
    elif pose == "blink":
        hspan(sp, hy, hx - 2, hx + 3, CORE_HI)
        hspan(sp, hy - 1, hx, hx + 2, PURE_WHT)
        clamp_px(sp, hx + 1, hy, PURE_WHT)
        clamp_px(sp, hx - 10, hy - 1, CORE_HI)
        clamp_px(sp, hx - 9,  hy - 1, PURE_WHT)
    else:
        clamp_px(sp, hx - 1, hy,     CORE_MID)
        clamp_px(sp, hx,     hy,     CORE_HI)
        clamp_px(sp, hx + 1, hy - 1, PURE_WHT)
        clamp_px(sp, hx + 2, hy - 1, CORE_HI)
        clamp_px(sp, hx + 2, hy - 2, CORE_MID)
        clamp_px(sp, hx - 9, hy - 1, CORE_HI)
        clamp_px(sp, hx - 10, hy - 1, CORE_MID)

    line_safe(sp, hx + 5, hy + 1, hx + 8, hy + 4, MTL_HI)
    line_safe(sp, hx + 6, hy + 5, hx + 4, hy + 9, INK_DARK)

    return hx, hy


def draw_fx(sp: Sprite, bx: int, by: int, head_xy: tuple[int, int], fist_xy: tuple[int, int], pose: str):
    """Crisp, connected pixel-art VFX (zero isolated pixels!)."""
    sp.layer("fx")
    hx, hy = head_xy
    fx, fy = fist_xy

    # Breath mist: sleek subtle frosty breath inside jaw in idle1/blink; dramatic billowing exhale in idle2!
    if pose == "idle2":
        poly_safe(sp, [(hx - 11, hy + 7), (hx - 18, hy + 4), (hx - 20, hy + 7), (hx - 14, hy + 10)], MTL_SPEC)
        poly_safe(sp, [(hx - 12, hy + 7), (hx - 17, hy + 5), (hx - 18, hy + 7), (hx - 13, hy + 9)], ICE_PALE)
        poly_safe(sp, [(hx - 19, hy + 5), (hx - 22, hy + 4), (hx - 21, hy + 7)], ICE_HI)

    if pose == "blink":
        # Predatory glaring cyan cross-flare erupting from BOTH eyes!
        ex, ey = hx + 1, hy - 1
        for d in range(1, 8):
            col = PURE_WHT if d <= 2 else (CORE_HI if d <= 5 else CORE_MID)
            clamp_px(sp, ex + d, ey, col)
            clamp_px(sp, ex - d, ey, col)
        for d in range(1, 5):
            col = PURE_WHT if d == 1 else (CORE_HI if d <= 3 else CORE_MID)
            clamp_px(sp, ex, ey + d, col)
            clamp_px(sp, ex, ey - d, col)
        clamp_px(sp, ex, ey, PURE_WHT)
        fex, fey = hx - 9, hy - 1
        hspan(sp, fey, fex - 2, fex + 2, CORE_HI)
        clamp_px(sp, fex, fey, PURE_WHT)
        clamp_px(sp, fex, fey - 1, CORE_HI)
        clamp_px(sp, fex, fey + 1, CORE_HI)

    elif pose == "windup":
        # Blazing glacial frost-charge vortex & spark stars framing the TOWERING RAISED FIST!
        draw_spark_cross(sp, fx - 13, fy - 4, arm=4, core_col=PURE_WHT, outer_col=CORE_HI)
        draw_spark_cross(sp, fx + 15, fy - 8, arm=3, core_col=PURE_WHT, outer_col=ICE_PALE)
        draw_spark_cross(sp, fx - 12, fy + 14, arm=2, core_col=ICE_PALE, outer_col=CORE_HI)
        # Sweeping cyan charge crescent arcing over the raised crystalline knuckles!
        charge_arc = [
            (fx - 15, fy + 8),
            (fx - 14, fy + 1),
            (fx - 9,  fy - 6),
            (fx - 1,  fy - 10),
            (fx + 8,  fy - 10),
        ]
        for i in range(len(charge_arc) - 1):
            x0, y0 = charge_arc[i]
            x1, y1 = charge_arc[i + 1]
            line_safe(sp, x0, y0 + 1, x1, y1 + 1, CORE_MID)
            line_safe(sp, x0, y0,     x1, y1,     CORE_HI if i in (0, 3) else PURE_WHT)

        # Heavy battle-roar frost breath jetting forward-left!
        poly_safe(sp, [(hx - 11, hy + 6), (hx - 18, hy + 3), (hx - 19, hy + 6), (hx - 12, hy + 9)], ICE_PALE)
        line_safe(sp, hx - 12, hy + 6, hx - 17, hy + 4, PURE_WHT)

    elif pose == "strike":
        # 1. Razor-tapered anime curved slam smear crescent connecting Frame 4's raised fist
        #    at (50, 15) smoothly down into the crushing forward-left impact!
        outer_arc = [
            (bx + 10, by - 22),  # Razor tip matching windup raised fist apex!
            (bx + 2,  by - 14),
            (bx - 6,  by - 3),
            (bx - 12, by + 11),
            (bx - 13, GROUND_Y - 12),
        ]
        inner_arc = [
            (bx + 10, by - 21),  # Tapers to exact 1px razor point at top!
            (bx + 4,  by - 12),
            (bx - 3,  by - 1),
            (bx - 9,  by + 12),
            (bx - 11, GROUND_Y - 11),
        ]
        poly_safe(sp, outer_arc + inner_arc[::-1], CORE_HI)
        for i in range(len(outer_arc) - 1):
            line_safe(sp, outer_arc[i][0], outer_arc[i][1], outer_arc[i + 1][0], outer_arc[i + 1][1], PURE_WHT)
            if i >= 1:
                line_safe(sp, inner_arc[i][0] + 1, inner_arc[i][1], inner_arc[i + 1][0] + 1, inner_arc[i + 1][1], CORE_MID)

        # 2. EARTH-SHATTERING GLACIAL GROUND SHOCKWAVE bursting forward-LEFT!
        imp_x = max(20, fx)
        imp_y = GROUND_Y

        # 3 dramatic jagged upward-left razor glacial spires bursting from shattered earth!
        draw_crystal_spire(sp, imp_x + 4,  imp_y,     imp_x - 3,  imp_y - 17, 3.2, lit_side=-1, pulse=True)
        draw_crystal_spire(sp, imp_x - 2,  imp_y,     imp_x - 13, imp_y - 22, 3.7, lit_side=-1, pulse=True)
        draw_crystal_spire(sp, imp_x - 8,  imp_y - 1, imp_x - 19, imp_y - 14, 2.7, lit_side=-1, pulse=True)

        # Organic jagged glacial shockwave fissure along GROUND_Y (clean 2px left safety margin!)
        poly_safe(sp, [
            (max(3, imp_x - 20), imp_y - 1),
            (max(5, imp_x - 14), imp_y - 4),
            (max(7, imp_x - 5),  imp_y - 3),
            (min(W - 3, imp_x + 9), imp_y - 2),
            (min(W - 3, imp_x + 12), imp_y + 1),
            (max(4, imp_x - 18), imp_y + 1),
        ], CORE_MID)
        poly_safe(sp, [
            (max(4, imp_x - 18), imp_y - 1),
            (max(6, imp_x - 12), imp_y - 3),
            (max(8, imp_x - 4),  imp_y - 2),
            (min(W - 4, imp_x + 7), imp_y - 1),
            (max(5, imp_x - 16), imp_y),
        ], CORE_HI)
        hspan(sp, imp_y - 1, max(5, imp_x - 15), min(W - 5, imp_x + 3), PURE_WHT)

        # Explosive shockwave star glint at impact point
        draw_spark_cross(sp, max(8, imp_x - 9), imp_y - 5, arm=5, core_col=PURE_WHT, outer_col=CORE_HI)

        # Strictly 4-connected faceted flying ice shards launching left-up!
        sx1, sy1 = max(3, imp_x - 19), imp_y - 24
        hspan(sp, sy1, sx1, sx1 + 2, ICE_PALE)
        hspan(sp, sy1 + 1, sx1 + 1, sx1 + 3, ICE_HI)
        clamp_px(sp, sx1, sy1, PURE_WHT)
        clamp_px(sp, sx1 + 2, sy1 + 2, SAP_MID)

        sx2, sy2 = max(3, imp_x - 18), imp_y - 10
        hspan(sp, sy2, sx2, sx2 + 2, PURE_WHT)
        hspan(sp, sy2 + 1, sx2 + 1, sx2 + 2, ICE_HI)

    elif pose == "hurt":
        # CRACKED CARAPACE FRACTURES + CLEAN FLYING FACETED ICE CHUNKS IN OPEN SKY!
        c1 = [(bx - 16, by + 4), (bx - 11, by + 9), (bx - 13, by + 14), (bx - 7, by + 18)]
        c2 = [(bx + 5, by + 1), (bx + 10, by + 5), (bx + 8, by + 10), (bx + 14, by + 12)]
        for chain in (c1, c2):
            for i in range(len(chain) - 1):
                x0, y0 = chain[i]
                x1, y1 = chain[i + 1]
                line_safe(sp, x0 + 1, y0 + 1, x1 + 1, y1 + 1, INK_DARK)
                line_safe(sp, x0 - 1, y0,     x1 - 1, y1,     INK_DARK)
                line_safe(sp, x0, y0 + 1, x1, y1 + 1, CORE_HI)
                line_safe(sp, x0, y0,     x1, y1,     PURE_WHT)

        draw_spark_cross(sp, bx - 11, by + 9, arm=4, core_col=PURE_WHT, outer_col=CORE_HI)

        # 3 crisp 4-connected faceted crystal chunks flying cleanly out into open top-left sky!
        chunk_specs = [
            (7,  24, 4, 3),  # Bold left-sky flying carapace shard
            (14, 13, 3, 3),  # High upper-left shard
            (25, 7,  3, 2),  # High top-left crystal splinter
        ]
        for cx_c, cy_c, cw, ch in chunk_specs:
            for ry in range(ch):
                hspan(sp, cy_c + ry, cx_c + ry, cx_c + ry + cw - 1, SAP_MID if ry == ch - 1 else ICE_MID)
            hspan(sp, cy_c, cx_c, cx_c + cw - 2, ICE_PALE)
            clamp_px(sp, cx_c, cy_c, PURE_WHT)
            clamp_px(sp, cx_c + cw, cy_c + ch - 1, INK_DARK)


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    # (pose,   body_dx, body_dy, pulse, dur_ms)
    ("idle1",   0,       0,      False, 280),
    ("idle2",   0,      -1,      True,  280),
    ("blink",   0,       0,      True,  150),
    ("windup",  3,      -2,      True,  200),
    ("strike", -3,       2,      True,  170),
    ("hurt",    4,      -2,      False, 230),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "tail",
        "far_hind_leg",
        "far_shoulder_crystals",
        "far_front_leg",
        "dorsal_crystals",
        "torso_body",
        "near_hind_leg",
        "near_shoulder_pauldron",
        "near_front_leg",
        "head",
        "fx",
    ]
    sp.frames[0].cels = {ln: sp._blank() for ln in sp.layer_order}

    for _ in range(1, N_FRAMES):
        sp.add_frame(copy=False)

    anchors = {}

    for idx, (pose, bdx, bdy, pulse, dur) in enumerate(FRAME_SPECS, start=1):
        sp.frame(idx)
        sp.set_duration(dur)

        bx = PIVOT_X + bdx
        by = 43 + bdy

        draw_tail(sp, bx, by, pose, pulse)
        draw_far_hind_leg(sp, bx, by, pose)
        draw_far_shoulder_crystals(sp, bx, by, pose, pulse)
        draw_far_front_leg(sp, bx, by, pose)
        draw_dorsal_crystals(sp, bx, by, pose, pulse)
        draw_torso_body(sp, bx, by, pose, pulse)
        draw_near_hind_leg(sp, bx, by, pose)
        draw_near_shoulder_pauldron(sp, bx, by, pose, pulse)
        fist_xy = draw_near_front_leg(sp, bx, by, pose, pulse)
        head_xy = draw_head(sp, bx, by, pose, pulse)

        # Refined light- and material-aware 3D separation rims
        add_layer_separation_rim(sp, "near_shoulder_pauldron", idx, strong_dark=False)
        add_layer_separation_rim(sp, "near_front_leg", idx, strong_dark=(pose == "windup"))
        add_layer_separation_rim(sp, "head", idx, strong_dark=False)

        draw_fx(sp, bx, by, head_xy, fist_xy, pose)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (head_xy[0] - 2, head_xy[1] + 1)
            anchors["hit_px"] = (bx - 6, by + 6)
        if pose == "strike":
            anchors["cast_px"] = (max(8, fist_xy[0] - 8), GROUND_Y - 6)

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
        ("3x Light Glacial Sky #DCE7F6 (Red=Foot Anchor, Cyan=Cast Anchor, Yellow=Head, Orange=Hit)", (220, 231, 246), 0),
        ("3x Dark Gorge Dusk #212A3E", (33, 42, 62), fh + 24),
    ]

    ax, ay = PIVOT_X, GROUND_Y
    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]

    for label, bg_rgb, oy in bgs:
        draw.rectangle([0, oy, row_w - 1, oy + fh + 23], fill=bg_rgb)
        draw.text((pad, oy + 4), label, fill=(28, 36, 56) if bg_rgb[0] > 128 else (225, 235, 250))
        for i in range(N_FRAMES):
            ox = pad + i * (fw + pad)
            fy = oy + 20
            draw.line([(ox, fy + ay * scale), (ox + fw - 1, fy + ay * scale)],
                      fill=(185, 198, 218) if bg_rgb[0] > 128 else (60, 72, 98))
            im = sp.composite(i + 1).resize((fw, fh), NEAREST)
            canvas.paste(im, (ox, fy), im)
            rx, ry = ox + ax * scale + scale // 2, fy + ay * scale + scale // 2
            draw.ellipse([rx - 3, ry - 3, rx + 3, ry + 3], fill=(235, 45, 65), outline=(255, 255, 255))
            if i == 0:
                hx_m, hy_m = ox + head_x * scale + scale // 2, fy + head_y * scale + scale // 2
                draw.ellipse([hx_m - 3, hy_m - 3, hx_m + 3, hy_m + 3], fill=(255, 215, 60), outline=(20, 20, 40))
                tx_m, ty_m = ox + hit_x * scale + scale // 2, fy + hit_y * scale + scale // 2
                draw.ellipse([tx_m - 3, ty_m - 3, tx_m + 3, ty_m + 3], fill=(255, 130, 50), outline=(20, 20, 40))
            if i == 4:
                cx_m, cy_m = ox + cast_x * scale + scale // 2, fy + cast_y * scale + scale // 2
                draw.ellipse([cx_m - 3, cy_m - 3, cx_m + 3, cy_m + 3], fill=(40, 225, 255), outline=(16, 40, 90))

    oy3 = (fh + 24) * 2
    draw.rectangle([0, oy3, row_w // 2, total_h - 1], fill=(220, 231, 246))
    draw.rectangle([row_w // 2, oy3, row_w - 1, total_h - 1], fill=(33, 42, 62))
    draw.text((pad, oy3 + 4), "1x Native Scale (Light Glacial Sky)", fill=(28, 36, 56))
    draw.text((row_w // 2 + pad, oy3 + 4), "1x Native Scale (Dark Gorge Dusk)", fill=(225, 235, 250))
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
    fg = (26, 32, 48)
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


def main():
    sp, anchors = build_sprite()
    info = sp.stats(print_=True)

    # Strict pixel-hygiene assertions across all 6 frames
    assert info["semi_alpha_px"] == 0, f"Expected 0 semi-alpha px, got {info['semi_alpha_px']}"
    assert not info["near_duplicate_colors"], f"Unexpected near-dup colors: {info['near_duplicate_colors']}"
    iso_all = {}
    for fi in range(1, N_FRAMES + 1):
        sp.frame(fi)
        st = sp.stats(print_=False)
        if st["isolated_px"]:
            iso_all[fi] = st["isolated_px"]
    assert not iso_all, f"Isolated pixels found: {iso_all}"

    # Verify exact foot baseline lock on GROUND_Y for idle frames 1..3 & strike/hurt
    for fi in (1, 2, 3, 5, 6):
        leg_cel = sp.frames[fi - 1].cels["near_front_leg"]
        ys = [y for y in range(H) for x in range(W) if leg_cel.getpixel((x, y))[3] > 0]
        assert max(ys) == GROUND_Y, f"Frame {fi} near_front_leg baseline {max(ys)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "abyss_behemoth",
        "file": "assets/sprites/abyss_behemoth_sheet.png",
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
        "buildScript": "tools/pixel_art/abyss_behemoth/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=5)


if __name__ == "__main__":
    main()
