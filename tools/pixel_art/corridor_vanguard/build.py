#!/usr/bin/env python3
r"""HD anime pixel-art combat sprite builder for Palace Corridor Vanguard (corridor_vanguard).

Act 8 Wave 1 Elite Knight — 100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 76 x 82, 6 horizontal frames (456 x 82 sheet, padding=0).
Facing: left. GROUND_Y = 76, PIVOT_X = 43.

Pass 3 (Final Jewelry-Grade Polish):
- Parametric two-handed polearm kinematics: BOTH armored gauntlets lock mathematically onto
  the war glaive shaft across all 6 frames (eliminates idle pinhole gap & floating far hand!)
- Sleek V-pointed gothic hip tassets (eliminates flat horizontal gold bottom bar)
- Aerodynamic tapered crimson-gold strike lance shockwave (eliminates blunt vertical back edge)
- Outward-curling living crimson pixel flames dancing across idle1 / idle2 / blink blade edges
- Refined crescent horn wing-barbs, inward-tapered needle horn tips & subtle dimmed V-shutter blink
- Clean >=2px canvas border safety margin on all 6 frames (zero edge clipping in windup & strike!)
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
W, H = 76, 82
N_FRAMES = 6
GROUND_Y = 76
PIVOT_X = 43

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "corridor_vanguard_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "corridor_vanguard_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
HELM_ZOOM_PATH = os.path.join(HERE, "helm_zoom.png")

# ---------------------------------------------------------------------------
# Master 21-Color Hue-Shifted Dark-Fantasy JRPG Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
# Obsidian Steel & Ink Ramp (cool indigo-slate shadows -> silver-steel speculars)
INK_DARK = "#10111c"  # Deep obsidian-indigo shadow outline & visor recess
STL_SH2  = "#1e2235"  # Deepest obsidian plate shadow & inner under-armor
STL_SH1  = "#313852"  # Dark gunmetal plate body & lit-steel selective outline
STL_MID  = "#4c5678"  # Lit gunmetal plate midtone
STL_HI   = "#7885ab"  # Cool steel ridge bevel highlight
STL_SPEC = "#b2bfd9"  # Crisp razor-edge specular steel glint

# Burnished Imperial Gold Filigree Ramp (warm bronze shadow -> sunlit champagne gold)
GLD_SH2  = "#5c3918"  # Deep antique bronze shadow & lit gold selective outline
GLD_SH1  = "#946122"  # Burnished dark gold engraving shadow
GLD_MID  = "#cf9838"  # Royal imperial gold trim & horn filigree base
GLD_HI   = "#f5d36e"  # Sunlit gleaming gold highlight
GLD_SPEC = "#fff4bd"  # White-gold peak spark on crest & glaive filigree

# Royal Crimson Mantle & Velvet Cape Ramp (deep plum-wine -> bright scarlet velvet)
INK_RED  = "#330e1c"  # Deep plum-maroon crimson cloth outline & deep fold
CRM_SH2  = "#541322"  # Deep burgundy cape recess shadow
CRM_SH1  = "#801b28"  # Dark royal crimson velvet fold
CRM_MID  = "#ad2630"  # Royal crimson shoulder mantle & tabard base
CRM_HI   = "#d64545"  # Sunlit scarlet velvet fold crest

# Blazing Runic Fire & Visor Glow Ramp (molten crimson -> blazing orange -> white-hot core)
FIR_DEEP = "#c91c22"  # Intense molten crimson aura edge & fire selective outline
FIR_RED  = "#f5332a"  # Vivid blazing crimson runic blade & visor glow
FIR_ORG  = "#ff7726"  # Hot molten orange rune fire midtone
FIR_YLW  = "#ffbe42"  # Incandescent yellow-gold rune lightning core
PURE_WHT = "#ffffff"  # Pure white-hot core glint on visor & strike thrust tip

PALETTE = [
    INK_DARK, STL_SH2, STL_SH1, STL_MID, STL_HI, STL_SPEC,
    GLD_SH2, GLD_SH1, GLD_MID, GLD_HI, GLD_SPEC,
    INK_RED, CRM_SH2, CRM_SH1, CRM_MID, CRM_HI,
    FIR_DEEP, FIR_RED, FIR_ORG, FIR_YLW, PURE_WHT,
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
    """4-connected material- & light-aware selective outer outline (excludes fx layer)."""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_dark     = hex2rgba(INK_DARK)
    rgba_stl_lit  = hex2rgba(STL_SH1)
    rgba_gld_lit  = hex2rgba(GLD_SH2)
    rgba_red_ink  = hex2rgba(INK_RED)
    rgba_fir_lit  = hex2rgba(FIR_DEEP)

    steel_lit = {hex2rgba(STL_SPEC)[:3], hex2rgba(STL_HI)[:3], hex2rgba(STL_MID)[:3]}
    gold_set  = {hex2rgba(GLD_SPEC)[:3], hex2rgba(GLD_HI)[:3], hex2rgba(GLD_MID)[:3]}
    crim_set  = {hex2rgba(CRM_HI)[:3], hex2rgba(CRM_MID)[:3], hex2rgba(CRM_SH1)[:3]}
    fire_set  = {hex2rgba(FIR_RED)[:3], hex2rgba(FIR_ORG)[:3], hex2rgba(FIR_YLW)[:3], hex2rgba(PURE_WHT)[:3]}

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

            if is_weap_nbr and any(rgb in fire_set for rgb in rgb_list):
                dst[x, y] = rgba_fir_lit if is_top_left else rgba_red_ink
            elif is_top_left and any(rgb in gold_set for rgb in rgb_list):
                dst[x, y] = rgba_gld_lit
            elif any(rgb in crim_set for rgb in rgb_list) and not any(rgb == hex2rgba(STL_SH2)[:3] for rgb in rgb_list):
                dst[x, y] = rgba_red_ink
            elif is_top_left and any(rgb in steel_lit for rgb in rgb_list):
                dst[x, y] = rgba_stl_lit
            else:
                dst[x, y] = rgba_dark


# ---------------------------------------------------------------------------
# Anatomical Layer Painters (Facing LEFT!)
# ---------------------------------------------------------------------------

def draw_back_cape(sp: Sprite, cx: int, torso_y: int, pose: str, sway: int):
    """Billowing tattered royal crimson imperial cape with gold filigree border & swallowtail tips."""
    sp.layer("back_cape")

    top_y = torso_y + 2
    bot_y = min(GROUND_Y - 4, torso_y + 38)
    span_h = max(1, bot_y - top_y)
    # Keep a clean >=2px right margin (body max x <= W-4 = 72, outline <= 73)
    max_rx = W - 4

    rows = {}
    for i in range(span_h + 1):
        y = top_y + i
        t = i / span_h

        if pose == "strike":
            billow = int(round(t * 21.0 + math.sin(t * 2.5) * 4.2))
            lx_off = 0 + int(round(t * 8))
        elif pose == "windup":
            billow = int(round(t * 8.0 + math.sin(t * 2.8) * 1.8))
            lx_off = -2 + int(round(t * 3))
        elif pose == "hurt":
            billow = int(round(t * 11.0 - math.sin(t * 3.1) * 2.8))
            lx_off = 0 + int(round(t * 4))
        else:
            billow = int(round(t * 12.5 + math.sin(t * 2.6 + sway * 0.5) * 2.2)) + int(round(sway * t * 2.2))
            lx_off = -2 + int(round(t * 4))

        lx = cx + lx_off
        rx = min(max_rx, cx + 8 + billow)
        if t < 0.16:
            rx = min(rx, cx + 8 + int(round(t * 36)))
        if rx >= lx:
            rows[y] = (lx, rx)

    # Rich crimson velvet drapery with clean sculpted shading
    for y, (lx, rx) in rows.items():
        t = (y - top_y) / span_h
        w = max(1, rx - lx)
        for x in range(lx, rx + 1):
            u = (x - lx) / w
            fold = math.sin(u * 8.2 - t * 2.6 + sway * 0.35)
            if u < 0.24:
                col = CRM_SH2
            elif u > 0.86:
                col = CRM_HI if t < 0.68 else CRM_MID
            elif fold > 0.38:
                col = CRM_HI if (u > 0.42 and t < 0.62) else CRM_MID
            elif fold < -0.32:
                col = CRM_SH2 if u < 0.56 else CRM_SH1
            else:
                col = CRM_MID if u > 0.36 else CRM_SH1
            sp.px(x, y, col)

        # Smooth refined gold embroidered hem stripe 2px inside right cape edge!
        if rx - lx >= 5 and 0.12 < t < 0.94:
            gx = rx - 2
            sp.px(gx, y, GLD_HI if (t < 0.48) else GLD_MID)
            sp.px(rx - 1, y, CRM_MID if t < 0.72 else CRM_SH1)
            sp.px(rx, y, CRM_SH1 if t > 0.62 else CRM_MID)

    # Sculpt 3 crisp tapered flame-cut swallowtail tips at the bottom-right hem!
    if bot_y in rows:
        blx, brx = rows[bot_y]
        for y in range(bot_y - 2, bot_y + 1):
            for x in range(blx, brx + 1):
                if (x - blx) % 5 in (2, 3) and y >= bot_y - 1:
                    sp.px(x, y, None)

        tail_specs = [
            (blx + 1, 5, 1, False),
            ((blx + brx) // 2, 6, 1, True),
            (min(max_rx - 2, brx - 2), 6 if pose == "strike" else 5, 1, True),
        ]
        for bx, length, dx_dir, lit in tail_specs:
            for k in range(length):
                ty = bot_y - 1 + k
                if ty >= GROUND_Y:
                    break
                tw = 3 if k < 2 else (2 if k < length - 1 else 1)
                tx = min(max_rx - tw + 1, bx + (dx_dir * (k + (1 if pose == "strike" else 0))) // 2)
                col = CRM_MID if (lit and k < 3) else (CRM_SH1 if k < length - 1 else CRM_SH2)
                hspan(sp, ty, tx, tx + tw - 1, col)
                if k == 1 and lit:
                    sp.px(tx + tw - 1, ty, GLD_MID)

    # 2) Shadowed inner crimson cape sweep curving behind far-left knee (faithful to ref!)
    peek_top = torso_y + 21
    peek_bot = min(GROUND_Y - 3, torso_y + 38)
    for i in range(peek_bot - peek_top + 1):
        y = peek_top + i
        t = i / max(1, peek_bot - peek_top)
        shift_l = -2 if pose == "strike" else (1 if pose == "windup" else 0)
        plx = cx - 9 - int(round(t * 5.0)) + shift_l
        prx = cx - 4 - int(round(t * 2.0)) + shift_l
        if prx >= plx:
            hspan(sp, y, plx, prx, CRM_SH2)
            if t < 0.80:
                sp.px(plx, y, CRM_MID if t < 0.45 else CRM_SH1)
            if 0.22 < t < 0.85 and plx + 1 <= prx:
                sp.px(plx + 1, y, GLD_MID if t < 0.55 else GLD_SH1)
    tip_lx = cx - 14 + (-2 if pose == "strike" else (1 if pose == "windup" else 0))
    sp.px(tip_lx, peek_bot + 1, CRM_SH1)
    sp.px(tip_lx + 1, peek_bot + 1, CRM_SH2)


def draw_legs_boots(sp: Sprite, cx: int, ground_y: int, pose: str):
    """Armored gothic obsidian greaves, pointed knee poleyns & sleek pointed sabatons (facing LEFT)."""
    sp.layer("legs")

    if pose == "strike":
        far_top_x, far_fx, far_fy = cx - 4, cx - 12, ground_y
        near_top_x, near_fx, near_fy = cx + 4, cx + 10, ground_y
    elif pose == "windup":
        far_top_x, far_fx, far_fy = cx - 4, cx - 8, ground_y
        near_top_x, near_fx, near_fy = cx + 3, cx + 7, ground_y
    elif pose == "hurt":
        far_top_x, far_fx, far_fy = cx - 4, cx - 8, ground_y - 2
        near_top_x, near_fx, near_fy = cx + 3, cx + 6, ground_y
    else:
        far_top_x, far_fx, far_fy = cx - 4, cx - 9, ground_y
        near_top_x, near_fx, near_fy = cx + 3, cx + 5, ground_y

    hip_y = ground_y - 21

    def _draw_armored_leg(top_x: int, foot_x: int, foot_y: int, is_far: bool):
        knee_y = hip_y + 8
        ankle_y = foot_y - 5

        hi_c   = STL_HI if is_far else STL_MID
        mid_c  = STL_MID if is_far else STL_SH1
        sh_c   = STL_SH1 if is_far else STL_SH2
        deep_c = STL_SH2
        g_hi   = GLD_HI if is_far else GLD_MID
        g_mid  = GLD_MID if is_far else GLD_SH1

        # 1) Dark-steel thigh armor
        knee_x = int(round(top_x + (foot_x - top_x) * 0.46)) - (1 if is_far else 0)
        for y in range(hip_y, knee_y + 1):
            t = (y - hip_y) / max(1, knee_y - hip_y)
            lx = int(round(top_x + (knee_x - top_x) * t)) - 2
            w = 5 if t < 0.55 else 4
            hspan(sp, y, lx, lx + w - 1, sh_c)
            sp.px(lx, y, mid_c)
            sp.px(lx + w - 1, y, deep_c)

        # 2) Sharp Pointed Gothic Knee Poleyn + Crimson Knee Jewel (faithful to ref!)
        hspan(sp, knee_y - 1, knee_x - 3, knee_x + 1, mid_c)
        sp.px(knee_x - 3, knee_y - 1, g_hi)
        sp.px(knee_x - 2, knee_y - 1, STL_SPEC if is_far else hi_c)
        hspan(sp, knee_y, knee_x - 3, knee_x + 1, sh_c)
        sp.px(knee_x - 3, knee_y, hi_c)
        sp.px(knee_x - 2, knee_y, FIR_RED if is_far else g_hi)
        sp.px(knee_x - 1, knee_y, g_mid)
        hspan(sp, knee_y + 1, knee_x - 2, knee_x + 1, deep_c)
        sp.px(knee_x - 2, knee_y + 1, g_mid)

        # 3) Sleek Fluted Obsidian Greave with vertical cool-steel specular ridge!
        for y in range(knee_y + 2, ankle_y + 1):
            t = (y - knee_y - 2) / max(1, ankle_y - knee_y - 2)
            gx = int(round(knee_x + (foot_x - knee_x) * t)) - 2
            w = 4 if t < 0.65 else 3
            hspan(sp, y, gx, gx + w - 1, sh_c)
            sp.px(gx, y, STL_SPEC if (is_far and 0.15 < t < 0.50) else (hi_c if t < 0.80 else mid_c))
            if w >= 4:
                sp.px(gx + 1, y, mid_c if is_far else sh_c)
            sp.px(gx + w - 1, y, deep_c)

        # Burnished gold ankle trim
        ax = foot_x - 2
        hspan(sp, ankle_y, ax, ax + 3, g_mid)
        sp.px(ax, ankle_y, g_hi)

        # 4) Razor-Pointed Gothic Knight Sabaton facing LEFT (locked squarely at foot_y!)
        hspan(sp, foot_y - 4, ax, ax + 3, sh_c)
        sp.px(ax, foot_y - 4, hi_c)
        sp.px(ax + 3, foot_y - 4, deep_c)

        hspan(sp, foot_y - 3, ax - 1, ax + 3, sh_c)
        sp.px(ax - 1, foot_y - 3, hi_c)
        sp.px(ax, foot_y - 3, STL_SPEC if is_far else hi_c)
        sp.px(ax + 3, foot_y - 3, deep_c)

        hspan(sp, foot_y - 2, ax - 3, ax + 3, mid_c)
        sp.px(ax - 3, foot_y - 2, g_hi)
        sp.px(ax - 2, foot_y - 2, hi_c)
        sp.px(ax - 1, foot_y - 2, STL_SPEC if is_far else hi_c)
        sp.px(ax + 2, foot_y - 2, sh_c)
        sp.px(ax + 3, foot_y - 2, deep_c)

        hspan(sp, foot_y - 1, ax - 5, ax + 3, sh_c)
        sp.px(ax - 5, foot_y - 1, STL_HI if is_far else STL_MID)
        sp.px(ax - 4, foot_y - 1, g_hi)
        sp.px(ax - 3, foot_y - 1, mid_c)
        sp.px(ax - 1, foot_y - 1, g_mid)
        sp.px(ax + 3, foot_y - 1, deep_c)

        hspan(sp, foot_y, ax - 4, ax + 3, deep_c)
        sp.px(ax - 3, foot_y, sh_c)
        sp.px(ax - 2, foot_y, sh_c)

    _draw_armored_leg(far_top_x, far_fx, far_fy, is_far=True)
    _draw_armored_leg(near_top_x, near_fx, near_fy, is_far=False)


def draw_tassets_and_tabard(sp: Sprite, cx: int, waist_y: int, pose: str, sway: int):
    """Sleek V-pointed gothic obsidian hip tassets with delicate gold scroll rims
    framing a split royal crimson waist tabard."""
    sp.layer("tassets")

    shift_bot = 3 if pose == "strike" else (-1 if pose == "windup" else sway)

    # 1) Split Royal Crimson Imperial Waist Tabard & Rear Coat-Tail
    for i in range(16):
        y = waist_y + 2 + i
        t = i / 15.0
        # Center-front narrow crimson imperial tabard panel hanging cleanly between thighs
        if i <= 14:
            cl = cx - 4 + int(round(t * (1.2 if pose != "strike" else -1.6)))
            cr = cx + 1 + int(round(t * (0.5 if pose != "strike" else -1.0)))
            if i == 14:
                cl += 1
                cr -= 1
            if cr >= cl:
                hspan(sp, y, cl, cr, CRM_MID)
                sp.px(cl, y, GLD_MID if i < 12 else GLD_HI)
                sp.px(cr, y, GLD_SH1 if i < 12 else GLD_MID)
                if cr - cl >= 3:
                    sp.px(cl + 1, y, CRM_HI if i < 9 else CRM_MID)
                    sp.px(cr - 1, y, CRM_SH1)

        # Swirling rear-right crimson coat-skirt flaring smoothly behind near hip
        rl = cx + 3 + int(round(t * (4.2 + shift_bot * 0.6)))
        rr = min(W - 5, cx + 7 + int(round(t * (9.2 + shift_bot * 1.0))))
        if i <= 15 and rr >= rl:
            hspan(sp, y, rl, rr, CRM_MID if i < 12 else CRM_SH1)
            sp.px(rl, y, CRM_SH2)
            if rr - rl >= 3:
                sp.px(rl + 2, y, CRM_HI if i < 9 else CRM_MID)
            sp.px(rr - 1, y, GLD_MID if i < 13 else GLD_SH1)
            sp.px(rr, y, CRM_SH2)

    # 2) SLEEK V-POINTED GOTHIC OBSIDIAN HIP TASSETS (taper smoothly to gothic points!)
    # Far (left) tapered V-pointed obsidian hip tasset
    for i in range(14):
        y = waist_y + i
        t = i / 13.0
        tl = cx - 7 - int(round(min(0.68, t) * (6.2 if pose != "strike" else 7.6)))
        tr = cx - 2 - int(round(t * 2.0))
        if i >= 9:
            # Smooth diagonal V-taper inward from both sides into a sharp gothic tip!
            k = i - 8
            tl += (k // 2)
            tr -= k
        if tr >= tl:
            hspan(sp, y, tl, tr, STL_SH1)
            sp.px(tl, y, STL_HI if i < 10 else GLD_HI)
            if tr - tl >= 2:
                sp.px(tl + 1, y, STL_SPEC if i in (2, 3, 4) else (STL_MID if i < 9 else STL_SH1))
            if tr - tl >= 3:
                sp.px(tr - 1, y, STL_SH2)
            if i == 0:
                hspan(sp, y, tl, tr, GLD_MID)
                sp.px(tl, y, GLD_HI)
            elif i >= 12:
                hspan(sp, y, tl, tr, GLD_HI if i == 13 else GLD_MID)
            else:
                sp.px(tr, y, GLD_MID if i < 9 else GLD_HI)
                if i == 5 and tr - tl >= 3:
                    sp.px(tl + 2, y, GLD_SH1)
                elif i == 6 and tr - tl >= 3:
                    sp.px(tl + 1, y, GLD_MID)

    # Near (right) broad tapered V-pointed gothic obsidian hip tasset (NO flat yellow bar!)
    for i in range(15):
        y = waist_y + i
        t = i / 14.0
        tl = cx + 1 + int(round(t * 1.4))
        tr = cx + 8 + int(round(min(0.65, t) * (6.8 if pose != "strike" else 8.0)))
        if i >= 9:
            # Sculpt crisp gothic downward V-point!
            k = i - 8
            tl += k
            tr -= (k // 2)
        if tr >= tl:
            hspan(sp, y, tl, tr, STL_SH2)
            sp.px(tl, y, STL_MID if i < 10 else GLD_HI)
            if tr - tl >= 3:
                sp.px(tl + 1, y, STL_SPEC if i in (2, 3, 4) else (STL_HI if i < 8 else STL_MID))
                sp.px(tl + 2, y, STL_SH1)
            if i == 0:
                hspan(sp, y, tl, tr, GLD_SH1)
                sp.px(tl, y, GLD_HI)
                sp.px(tl + 1, y, GLD_MID)
            elif i >= 13:
                hspan(sp, y, tl, tr, GLD_HI if i == 14 else GLD_MID)
            else:
                sp.px(tl, y, GLD_MID if i < 9 else GLD_HI)
                sp.px(tr, y, GLD_SH1 if i < 10 else GLD_MID)
                if i == 5 and tr - tl >= 4:
                    sp.px(tl + 2, y, GLD_SH1)
                elif i == 6 and tr - tl >= 4:
                    sp.px(tl + 3, y, GLD_MID)

    # Ornate Gothic V-Pointed Gold Waist Clasp!
    hspan(sp, waist_y, cx - 5, cx + 6, GLD_SH1)
    hspan(sp, waist_y, cx - 4, cx + 1, GLD_MID)
    sp.px(cx - 2, waist_y, GLD_HI)
    sp.px(cx - 1, waist_y, GLD_SPEC)
    sp.px(cx - 2, waist_y + 1, GLD_MID)
    sp.px(cx - 1, waist_y + 1, GLD_HI)
    sp.px(cx - 2, waist_y + 2, GLD_SH1)


def draw_torso_and_mantle(sp: Sprite, cx: int, neck_y: int, pose: str, sway: int):
    """High flared crimson-lined collar, gothic obsidian-and-gold plate cuirass,
    and draped royal crimson shoulder mantle with iconic hanging gold tassel."""
    sp.layer("torso")

    ux = cx + (-1 if pose == "strike" else (1 if pose == "hurt" else 0))

    # 1) High Flared Winged Royal Collar (smoothly curved crimson velvet inside, sharp gold tips!)
    for dy, l0, l1, r0, r1 in [
        (-2, -10, -8,  7,  9),
        (-1,  -9, -5,  5,  9),
    ]:
        y = neck_y + dy
        hspan(sp, y, ux + l0, ux + l1, CRM_HI if dy == -1 else CRM_MID)
        sp.px(ux + l0, y, GLD_HI if dy == -2 else GLD_MID)
        hspan(sp, y, ux + r0, ux + r1, CRM_MID if dy == -1 else CRM_SH1)
        sp.px(ux + r1, y, GLD_HI if dy == -2 else GLD_MID)

    for dy, dl, dr in [(0, -8, 8), (1, -7, 7), (2, -7, 7)]:
        y = neck_y + dy
        hspan(sp, y, ux + dl, ux + dr, STL_SH2)
        hspan(sp, y, ux + dl + 1, ux - 4, CRM_HI if dy == 0 else CRM_MID)
        hspan(sp, y, ux + 3, ux + dr - 1, CRM_MID if dy == 0 else CRM_SH1)
        sp.px(ux + dl, y, GLD_MID if dy == 0 else STL_MID)
        sp.px(ux + dr, y, GLD_SH1 if dy == 0 else STL_SH2)
        hspan(sp, y, ux - 3, ux + 2, STL_SH1)
        sp.px(ux - 2, y, STL_HI if dy == 1 else STL_MID)
        if dy == 2:
            sp.px(ux - 2, y, GLD_HI)
            sp.px(ux - 1, y, GLD_MID)

    # 2) Sculpted Gothic Black-and-Gold Plate Cuirass
    torso_shape = {
        3:  (-7, 7),
        4:  (-7, 7),
        5:  (-7, 7),
        6:  (-7, 7),
        7:  (-6, 7),
        8:  (-6, 6),
        9:  (-6, 6),
        10: (-5, 6),
        11: (-5, 5),
        12: (-5, 5),
        13: (-5, 5),
        14: (-4, 5),
        15: (-5, 5),
        16: (-5, 6),
    }
    for dy, (dl, dr) in torso_shape.items():
        y = neck_y + dy
        bx = ux if dy <= 10 else cx
        hspan(sp, y, bx + dl, bx + dr, STL_SH1)
        hspan(sp, y, bx + dl, bx - 2, STL_MID if dy < 11 else STL_SH1)
        if 4 <= dy <= 10:
            sp.px(bx + dl + 1, y, STL_HI)
        if dy in (5, 6, 7):
            sp.px(bx - 4, y, STL_SPEC)
        hspan(sp, y, bx + 2, bx + dr, STL_SH2)
        sp.px(bx - 2, y, STL_SH2)

    # Refined Gothic Gold Chest Chevron + Glowing Crimson Core Ember
    sp.line(ux - 6, neck_y + 4, ux - 2, neck_y + 8, GLD_HI)
    sp.line(ux - 2, neck_y + 8, ux + 3, neck_y + 4, GLD_MID)
    sp.px(ux - 5, neck_y + 5, GLD_SPEC)
    sp.line(cx - 4, neck_y + 11, cx - 2, neck_y + 13, GLD_MID)
    sp.line(cx - 2, neck_y + 13, cx + 2, neck_y + 11, GLD_SH1)
    sp.px(ux - 2, neck_y + 7, FIR_RED)
    sp.px(ux - 2, neck_y + 8, FIR_ORG)

    # 3) Draped Royal Crimson Shoulder Mantle + Iconic Hanging Gold Tassel (mantle layer!)
    sp.layer("mantle")
    mantle_rows = [
        (3,   2,  9),
        (4,   1, 10),
        (5,   0, 11),
        (6,   0, 11),
        (7,   1, 11),
        (8,   2, 10),
        (9,   3,  9),
        (10,  4,  8),
    ]
    for dy, dl, dr in mantle_rows:
        y = neck_y + dy
        hspan(sp, y, ux + dl, ux + dr, CRM_MID)
        if dr - dl >= 3:
            sp.px(ux + dl + 1, y, CRM_HI if dy <= 6 else CRM_MID)
            sp.px(ux + dr - 1, y, CRM_SH1)
        sp.px(ux + dl, y, CRM_HI if dy <= 6 else GLD_MID)
        sp.px(ux + dr, y, CRM_SH2)
        if dy == 10:
            hspan(sp, y, ux + dl, ux + dr - 1, GLD_MID)
            sp.px(ux + dl, y, GLD_HI)

    # Far (left) short crimson shoulder drape peek under far pauldron
    for dy, dl, dr in [(5, -9, -6), (6, -9, -5), (7, -8, -5), (8, -7, -6)]:
        y = neck_y + dy
        hspan(sp, y, ux + dl, ux + dr, CRM_MID if dy < 7 else CRM_SH1)
        sp.px(ux + dl, y, CRM_HI if dy == 5 else GLD_MID)

    # Iconic hanging gold cord & royal tassel dangling cleanly on the chest!
    tx = ux + 1 + (1 if pose == "strike" else (-1 if pose == "hurt" else 0))
    ty = neck_y + 6
    sp.px(tx, ty, GLD_SPEC)
    sp.px(tx, ty + 1, GLD_HI)
    sp.px(tx, ty + 2, GLD_MID)
    sp.px(tx, ty + 3, GLD_HI)
    sp.px(tx - 1, ty + 4, GLD_HI)
    sp.px(tx, ty + 4, GLD_MID)
    sp.px(tx + 1, ty + 4, GLD_SH1)
    sp.px(tx - 1, ty + 5, GLD_MID)
    sp.px(tx, ty + 5, GLD_SH1)


def draw_head(sp: Sprite, cx: int, head_y: int, pose: str):
    """Sleek aristocratic full-visored winged obsidian-and-gold imperial helm
    with fierce V-angled glowing crimson visor eye-slits."""
    sp.layer("head")

    hx_off = 2 if pose == "hurt" else (-1 if pose == "strike" else 0)
    hx = cx + hx_off

    # 1) GRACEFUL SLENDER DOUBLE-CURVED WINGED IMPERIAL HORNS (smooth inner curves + gleaming tips!)
    left_horn = [
        (0,  -8, -8),
        (1,  -9, -8),
        (2, -10, -9),
        (3, -10, -9),
        (4, -11, -9),
        (5, -11, -8),
        (6, -11, -8),
        (7, -10, -8),
        (8, -10, -7),
        (9,  -9, -7),
        (10, -9, -6),
        (11, -8, -6),
        (12, -8, -5),
        (13, -7, -5),
    ]
    for dy, dl, dr in left_horn:
        y = head_y + 2 + dy
        hspan(sp, y, hx + dl, hx + dr, STL_SH1)
        if dy == 0:
            sp.px(hx + dl, y, GLD_SPEC)
        elif dy <= 8:
            sp.px(hx + dl, y, GLD_HI if dy % 2 == 1 else GLD_MID)
        else:
            sp.px(hx + dl, y, GLD_SH1 if dy > 10 else GLD_MID)
        if dr > dl:
            sp.px(hx + dr, y, STL_SH2)
    # Graceful swept-up outer crescent wing-barb on left temple
    sp.px(hx - 12, head_y + 9, GLD_HI)
    sp.px(hx - 12, head_y + 10, STL_HI)
    sp.px(hx - 11, head_y + 11, STL_MID)

    # Near (right) taller majestic curved imperial wing-horn
    right_horn = [
        (0,   7,  7),
        (1,   7,  8),
        (2,   8,  9),
        (3,   8, 10),
        (4,   9, 10),
        (5,   9, 11),
        (6,   8, 11),
        (7,   8, 11),
        (8,   8, 10),
        (9,   7, 10),
        (10,  7,  9),
        (11,  6,  9),
        (12,  5,  8),
        (13,  5,  8),
        (14,  4,  7),
    ]
    for dy, dl, dr in right_horn:
        y = head_y + 1 + dy
        hspan(sp, y, hx + dl, hx + dr, STL_SH2)
        sp.px(hx + dl, y, STL_MID if dy < 10 else STL_SH1)
        if dy == 0:
            sp.px(hx + dr, y, GLD_SPEC)
        elif dy <= 9:
            sp.px(hx + dr, y, GLD_HI if dy % 2 == 0 else GLD_MID)
        else:
            sp.px(hx + dr, y, GLD_SH1 if dy > 11 else GLD_MID)
    # Graceful swept-up outer crescent wing-barb on right temple
    sp.px(hx + 12, head_y + 9, GLD_HI)
    sp.px(hx + 12, head_y + 10, STL_HI)
    sp.px(hx + 11, head_y + 11, STL_SH1)

    # 2) SLEEK ARISTOCRATIC FLUTED OBSIDIAN HELM DOME & TAPERED VISOR FACEPLATE
    dome_rows = {
        7:  (-3,  1),
        8:  (-5,  3),
        9:  (-6,  4),
        10: (-6,  5),
        11: (-7,  6),
        12: (-7,  6),
        13: (-7,  7),
        14: (-7,  7),
        15: (-7,  7),
        16: (-7,  7),
        17: (-7,  7),
        18: (-7,  6),
        19: (-7,  6),
        20: (-7,  6),
        21: (-6,  5),
        22: (-6,  4),
        23: (-5,  3),
        24: (-4,  2),
        25: (-4,  0),
        26: (-3, -1),
    }
    ridge_x = hx - 3

    for dy, (dl, dr) in dome_rows.items():
        y = head_y + dy
        hspan(sp, y, hx + dl, hx + dr, STL_SH1)
        if dy <= 15:
            lit_r = min(hx + dr - 1, ridge_x + 1)
            hspan(sp, y, hx + dl, lit_r, STL_MID)
            if 8 <= dy <= 14 and hx + dl + 1 <= ridge_x:
                hspan(sp, y, hx + dl + 1, min(ridge_x - 1, hx + dl + 2), STL_HI)
            if dy in (9, 10, 11):
                sp.px(hx + dl + 2, y, STL_SPEC)
        if 10 <= dy <= 21 and hx + 2 <= hx + dr - 1:
            sp.px(hx + 1, y, STL_MID)
            if 11 <= dy <= 15:
                sp.px(hx + 2, y, STL_HI)
            if dy in (12, 13):
                sp.px(hx + 2, y, STL_SPEC)
        if hx + 4 <= hx + dr:
            hspan(sp, y, hx + 4, hx + dr, STL_SH2)
        if dy >= 21:
            hspan(sp, y, hx + dl, hx + dr, STL_SH2)
            sp.px(hx + dl, y, STL_MID if dy < 24 else STL_SH1)
            sp.px(ridge_x, y, STL_HI if dy < 25 else STL_MID)

    # Lower cheek-wing armor fins flanking the near temple
    for dy, (dl, dr) in [(16, (6, 9)), (17, (6, 9)), (18, (6, 8)), (19, (5, 7))]:
        y = head_y + dy
        hspan(sp, y, hx + dl, hx + dr, STL_SH2)
        sp.px(hx + dr, y, GLD_MID if dy == 16 else GLD_SH1)
        sp.px(hx + dl, y, STL_MID)

    # 3) REFINED IMPERIAL GOLD FOREHEAD CREST & BROW FILIGREE
    for dy in range(7, 20):
        col = GLD_SPEC if dy == 8 else (GLD_HI if dy < 13 else (GLD_MID if dy < 17 else GLD_SH1))
        sp.px(ridge_x, head_y + dy, col)
    sp.px(ridge_x - 1, head_y + 15, GLD_MID)
    sp.px(ridge_x - 2, head_y + 14, GLD_HI)
    sp.px(ridge_x - 3, head_y + 13, GLD_MID)
    sp.px(ridge_x + 1, head_y + 15, GLD_MID)
    sp.px(ridge_x + 2, head_y + 14, GLD_HI)
    sp.px(ridge_x + 3, head_y + 14, GLD_MID)
    sp.px(ridge_x + 4, head_y + 13, GLD_SH1)
    sp.px(hx - 5, head_y + 22, GLD_SH1)
    sp.px(hx - 4, head_y + 23, GLD_MID)
    sp.px(hx + 1, head_y + 22, GLD_SH1)
    sp.px(hx + 2, head_y + 21, GLD_SH1)

    # 4) FIERCE V-ANGLED DEEP VISOR RECESS & GLOWING CRIMSON EYE-SLIT!
    vy = head_y + 17
    hspan(sp, vy - 1, hx - 7, hx - 6, INK_DARK)
    hspan(sp, vy,     hx - 7, hx - 4, INK_DARK)
    hspan(sp, vy + 1, hx - 6, hx - 4, INK_DARK)
    hspan(sp, vy - 1, ridge_x + 3, hx + 5, INK_DARK)
    hspan(sp, vy,     ridge_x + 1, hx + 5, INK_DARK)
    hspan(sp, vy + 1, ridge_x + 1, ridge_x + 4, INK_DARK)
    sp.px(ridge_x, vy - 1, GLD_MID)
    sp.px(ridge_x, vy, GLD_HI)
    sp.px(ridge_x, vy + 1, STL_HI)
    sp.px(ridge_x, vy + 2, STL_MID)

    if pose == "blink":
        # Menacing dimmed V-visor shutter blink! Narrow crimson ember pulse (no harsh white flash!)
        sp.px(hx - 6, vy, FIR_DEEP)
        sp.px(hx - 5, vy + 1, FIR_DEEP)
        sp.px(hx - 4, vy + 1, FIR_RED)
        sp.px(ridge_x + 1, vy + 1, FIR_ORG)
        sp.px(ridge_x + 2, vy + 1, FIR_RED)
        sp.px(ridge_x + 3, vy, FIR_DEEP)
        sp.px(ridge_x + 4, vy, FIR_DEEP)
    elif pose == "hurt":
        sp.px(hx - 6, vy, FIR_DEEP)
        sp.px(hx - 5, vy + 1, FIR_RED)
        sp.px(ridge_x + 1, vy + 1, FIR_ORG)
        sp.px(ridge_x + 2, vy, FIR_DEEP)
        sp.px(ridge_x + 3, vy, FIR_RED)
    elif pose in ("windup", "strike"):
        # Blazing white-hot & molten crimson-gold combat visor!
        sp.px(hx - 7, vy - 1, FIR_RED)
        sp.px(hx - 6, vy, FIR_ORG)
        sp.px(hx - 5, vy + 1, FIR_YLW)
        sp.px(hx - 4, vy + 1, PURE_WHT)

        sp.px(ridge_x + 1, vy + 1, PURE_WHT)
        sp.px(ridge_x + 2, vy + 1, FIR_YLW)
        sp.px(ridge_x + 3, vy, FIR_ORG)
        sp.px(ridge_x + 4, vy, FIR_RED)
        sp.px(ridge_x + 5, vy - 1, FIR_RED)
        sp.px(ridge_x + 2, vy, FIR_ORG)
    else:
        # Iconic predatory V-angled smoldering crimson visor eyes (idle1 & idle2)!
        sp.px(hx - 7, vy - 1, FIR_DEEP)
        sp.px(hx - 6, vy, FIR_RED)
        sp.px(hx - 5, vy + 1, FIR_ORG)
        sp.px(hx - 4, vy + 1, FIR_YLW)

        sp.px(ridge_x + 1, vy + 1, FIR_YLW)
        sp.px(ridge_x + 2, vy + 1, FIR_ORG)
        sp.px(ridge_x + 3, vy, FIR_RED)
        sp.px(ridge_x + 4, vy, FIR_RED)
        sp.px(ridge_x + 5, vy - 1, FIR_DEEP)
        sp.px(ridge_x + 2, vy, FIR_RED)

    # Crisp connected crimson anime eye-gleam trail in strike!
    if pose == "strike":
        sp.layer("fx")
        sp.px(ridge_x + 5, vy - 1, FIR_ORG)
        sp.px(ridge_x + 6, vy - 1, FIR_RED)
        sp.px(ridge_x + 7, vy - 2, FIR_RED)
        sp.px(ridge_x + 8, vy - 2, FIR_DEEP)


def draw_pauldron(sp: Sprite, px0: int, py0: int, side: str, pose: str):
    """Layered spiked obsidian-and-gold imperial pauldron with gleaming steel bevels."""
    if side == "far":
        rows = [
            (-3, -6, -4),
            (-2, -6, -2),
            (-1, -5,  0),
            ( 0, -5,  1),
            ( 1, -4,  1),
            ( 2, -4,  1),
            ( 3, -3,  1),
            ( 4, -2,  1),
        ]
        for dy, dl, dr in rows:
            y = py0 + dy
            hspan(sp, y, px0 + dl, px0 + dr, STL_MID if dy <= 0 else STL_SH1)
            sp.px(px0 + dl, y, GLD_HI if dy <= -1 else (STL_HI if dy <= 2 else GLD_MID))
            if dy in (-2, -1, 0):
                sp.px(px0 + dl + 1, y, STL_SPEC if dy == -1 else STL_HI)
            if dy == 4:
                hspan(sp, y, px0 + dl, px0 + dr, GLD_MID)
                sp.px(px0 + dl, y, GLD_HI)
            elif dy == 1:
                sp.px(px0 + dl, y, GLD_MID)
                sp.px(px0 + dl + 1, y, GLD_SH1)
            sp.px(px0 + dr, y, STL_SH2)
    else:
        rows = [
            (-3,  3,  6),
            (-2,  1,  7),
            (-1, -1,  7),
            ( 0, -2,  6),
            ( 1, -2,  6),
            ( 2, -2,  5),
            ( 3, -2,  5),
            ( 4, -1,  5),
            ( 5, -1,  4),
        ]
        for dy, dl, dr in rows:
            y = py0 + dy
            hspan(sp, y, px0 + dl, px0 + dr, STL_SH1)
            if dy <= 2:
                hspan(sp, y, px0 + dl, min(px0 + dr - 1, px0 + dl + 2), STL_MID)
                sp.px(px0 + dl + 1, y, STL_HI)
            if dy in (-1, 0):
                sp.px(px0 + dl + 2, y, STL_SPEC)
            sp.px(px0 + dr, y, STL_SH2)
            if dy == -3:
                hspan(sp, y, px0 + dl, px0 + dr, GLD_HI)
                sp.px(px0 + dr, y, GLD_SPEC)
            elif dy == -2:
                sp.px(px0 + dr, y, GLD_MID)
            elif dy == 5:
                hspan(sp, y, px0 + dl, px0 + dr, GLD_MID)
                sp.px(px0 + dl, y, GLD_HI)
                sp.px(px0 + dr, y, GLD_SH1)
            elif dy == 2:
                sp.px(px0 + dl, y, GLD_MID)
                sp.px(px0 + dr, y, GLD_SH1)
            else:
                sp.px(px0 + dl, y, STL_HI if dy < 2 else STL_MID)


def draw_armored_limb(sp: Sprite, x0: int, y0: int, x1: int, y1: int, thick: int, is_lit: bool):
    """Draw a cleanly shaded armored obsidian-and-gold arm segment."""
    pts = bresenham_pts(x0, y0, x1, y1)
    n = max(1, len(pts) - 1)
    for i, (x, y) in enumerate(pts):
        t = i / n
        if thick >= 3:
            sp.px(x, y - 1, STL_HI if is_lit else STL_MID)
            sp.px(x, y, STL_MID if is_lit else STL_SH1)
            sp.px(x, y + 1, STL_SH1 if is_lit else STL_SH2)
            sp.px(x - 1, y, STL_MID if is_lit else STL_SH1)
            sp.px(x + 1, y, STL_SH2)
        else:
            sp.px(x, y - 1, STL_MID if is_lit else STL_SH1)
            sp.px(x, y, STL_SH1 if is_lit else STL_SH2)
            sp.px(x, y + 1, STL_SH2)
        if 0.68 <= t <= 0.78:
            sp.px(x, y - 1, GLD_HI if is_lit else GLD_MID)
            sp.px(x, y, GLD_MID if is_lit else GLD_SH1)


def draw_gauntlet(sp: Sprite, hx: int, hy: int, is_lit: bool):
    """Articulated obsidian-and-gold knight gauntlet firmly gripping shaft."""
    sp.rect(hx - 2, hy - 1, hx + 1, hy + 2, STL_SH1 if is_lit else STL_SH2)
    sp.px(hx - 2, hy - 1, STL_HI if is_lit else STL_MID)
    sp.px(hx - 1, hy - 1, GLD_HI if is_lit else GLD_MID)
    sp.px(hx, hy, STL_MID if is_lit else STL_SH1)
    sp.px(hx + 1, hy + 1, STL_SH2)
    sp.px(hx + 1, hy + 2, STL_SH2)


def draw_war_glaive(
    sp: Sprite,
    pom: tuple[int, int],
    tip: tuple[int, int],
    pose: str,
    flame_phase: int,
    belly_sign: int = 1,
):
    """Razor-sharp hooked gothic runic war glaive / spear with obsidian-gold filigree spine,
    living outward-curling crimson pixel flames & aerodynamic piercing strike shockwave."""
    sp.layer("weapon")
    px0, py0 = pom
    tx, ty = tip
    dx, dy = tx - px0, ty - py0
    length = max(1.0, math.hypot(dx, dy))
    ux, uy = dx / length, dy / length

    # Normal perpendicular vector pointing toward cutting belly (+1 = downward/left cutting edge)
    nx, ny = -uy, ux
    if ny * belly_sign < 0:
        nx, ny = -nx, -ny

    t_sock = 0.55
    sx = px0 + dx * t_sock
    sy = py0 + dy * t_sock

    # 1) LONG DARK-STEEL SHAFT (pommel -> socket)
    shaft_pts = bresenham_pts(px0, py0, int(round(sx)), int(round(sy)))
    n_sh = max(1, len(shaft_pts) - 1)
    off_x, off_y = (0, 1) if abs(dx) >= abs(dy) else (1, 0)
    for i, (x, y) in enumerate(shaft_pts):
        t = i / n_sh
        sp.px(x, y, STL_MID if (0.12 < t < 0.88) else STL_HI)
        sp.px(x + off_x, y + off_y, STL_SH2)
        if abs(t - 0.14) < 0.04 or abs(t - 0.82) < 0.04 or abs(t - 0.96) < 0.04:
            sp.px(x, y, GLD_HI)
            sp.px(x + off_x, y + off_y, GLD_SH1)

    # Small decorative steel spur/barb halfway along upper shaft (faithful to ref!)
    sp_base_x = int(round(px0 + dx * 0.20))
    sp_base_y = int(round(py0 + dy * 0.20))
    sp_bx = int(round(px0 + dx * 0.23 + nx * 2.2))
    sp_by = int(round(py0 + dy * 0.23 + ny * 2.2))
    sp.line(sp_base_x, sp_base_y, sp_bx, sp_by, STL_HI)
    sp.px(sp_bx, sp_by, GLD_MID)

    # 2) ORNATE DIAMOND GOLD-AND-OBSIDIAN POMMEL BUTT-SPIKE (clamped >=2px from right edge!)
    pom_tip_x = min(W - 3, int(round(px0 - ux * 2.4)))
    pom_tip_y = int(round(py0 - uy * 2.4))
    for k in (-1, 0, 1):
        cx_p = min(W - 3, int(round(px0 + nx * k)))
        cy_p = int(round(py0 + ny * k))
        sp.px(cx_p, cy_p, GLD_HI if k == 0 else GLD_MID)
    sp.px(min(W - 3, int(round(px0 - ux * 1.1))), int(round(py0 - uy * 1.1)), STL_HI)
    if 2 <= pom_tip_x <= W - 3 and 2 <= pom_tip_y <= H - 3:
        sp.px(pom_tip_x, pom_tip_y, FIR_RED)

    # 3) GOTHIC FILIGREE SOCKET & SWEPT CRESCENT REAR WING-BARBS!
    for s in (-3, -2, -1, 0, 1, 2, 3, 4):
        back = abs(s) * 0.65
        gx = int(round(sx - ux * back + nx * s))
        gy = int(round(sy - uy * back + ny * s))
        if not (2 <= gx <= W - 3 and 2 <= gy <= H - 3):
            continue
        if abs(s) >= 3:
            col = GLD_HI if s < 0 else GLD_MID
        elif abs(s) == 2:
            col = STL_HI if s < 0 else GLD_HI
        elif abs(s) == 1:
            col = GLD_SPEC if s < 0 else STL_SH1
        else:
            col = GLD_HI
        sp.px(gx, gy, col)
        if abs(s) <= 2:
            sp.px(int(round(gx + ux * 1.1)), int(round(gy + uy * 1.1)), STL_SH2 if s > 0 else STL_MID)

    # 4) RAZOR-POINTED HOOKED RUNIC WAR GLAIVE BLADE (socket -> needle tip)!
    blade_len = math.hypot(tx - sx, ty - sy)
    steps = max(16, int(round(blade_len * 2.8)))
    hot_mode = pose in ("windup", "strike")

    def _belly_width(t: float) -> float:
        if t < 0.14:
            return 1.6 + (t / 0.14) * 3.0
        if t < 0.32:
            return 4.6 - ((t - 0.14) / 0.18) * 0.4
        return 4.2 * ((1.0 - (t - 0.32) / 0.68) ** 1.18)

    for i in range(steps + 1):
        t = i / steps
        bx = sx + (tx - sx) * t
        by = sy + (ty - sy) * t

        back_w = max(0.0, 1.15 * (1.0 - t * 1.35))
        belly_w = _belly_width(t)

        w_lo = int(math.floor(-back_w))
        w_hi = int(math.ceil(belly_w)) if belly_w >= 0.45 else 0

        for w in range(w_lo, w_hi + 1):
            px_b = int(round(bx + nx * w))
            py_b = int(round(by + ny * w))
            if not (2 <= px_b <= W - 3 and 2 <= py_b <= H - 3):
                continue

            if t > 0.85:
                col = PURE_WHT if (hot_mode or t > 0.93) else FIR_YLW
            elif w <= 0:
                if t < 0.48 and (i % 5 in (0, 1)):
                    col = GLD_HI if w < 0 else GLD_MID
                elif w < 0:
                    col = STL_SPEC if (0.18 < t < 0.58) else STL_HI
                else:
                    col = STL_SH2 if t < 0.68 else STL_MID
            else:
                rel = w / max(1.0, belly_w)
                if rel < 0.38:
                    rune_pulse = math.sin(t * 25.0 + flame_phase * 1.5)
                    if rune_pulse > 0.48:
                        col = PURE_WHT if hot_mode else FIR_YLW
                    elif rune_pulse > 0.05:
                        col = FIR_ORG
                    else:
                        col = FIR_DEEP if hot_mode else STL_SH2
                elif rel < 0.72:
                    col = FIR_YLW if (hot_mode and 0.15 < t < 0.82) else (FIR_ORG if t > 0.22 else FIR_RED)
                else:
                    col = FIR_ORG if hot_mode else FIR_RED
            sp.px(px_b, py_b, col)

    if 2 <= tx <= W - 3 and 2 <= ty <= H - 3:
        sp.px(tx, ty, PURE_WHT if hot_mode else FIR_YLW)

    # 5) LIVING OUTWARD-CURLING RUNIC PIXEL FLAMES & AERODYNAMIC ATTACK VFX (fx layer!)
    sp.layer("fx")

    if pose in ("idle1", "idle2", "blink"):
        # 2 crisp outward-curling crimson-orange flame tongues licking off the glowing cutting edge!
        # Starts right on the outer belly rim and sweeps outward along normal + back-upward!
        wisp_specs = [
            (0.26 + 0.02 * flame_phase, 3),
            (0.56 - 0.02 * flame_phase, 3),
        ]
        for wt, flen in wisp_specs:
            bw = _belly_width(wt)
            fx0 = sx + (tx - sx) * wt + nx * (bw + 0.4)
            fy0 = sy + (ty - sy) * wt + ny * (bw + 0.4)
            for k in range(flen):
                # Lick cleanly OUTWARD from blade belly then curl slightly back-right!
                fx = int(round(fx0 + nx * (k * 0.75) - ux * (k * 0.65)))
                fy = int(round(fy0 + ny * (k * 0.65) - (1 if (flame_phase == 1 and k == flen - 1) else 0)))
                if 2 <= fx <= W - 3 and 2 <= fy <= H - 3:
                    col = FIR_YLW if k == 0 else (FIR_ORG if k == 1 else FIR_RED)
                    sp.px(fx, fy, col)
                    if k == 0:
                        # 2px solid flame root anchored directly to cutting edge
                        sp.px(fx - 1, fy, FIR_ORG)

    elif pose == "windup":
        # Fierce 4-point incandescent crimson-gold charge star at coiled spear tip + licking heel flames!
        sx_t, sy_t = int(tx), int(ty)
        sp.px(sx_t, sy_t, PURE_WHT)
        for d in (1, 2, 3, 4):
            col = PURE_WHT if d == 1 else (FIR_YLW if d == 2 else (FIR_ORG if d == 3 else FIR_RED))
            for ddx, ddy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                qx, qy = sx_t + ddx, sy_t + ddy
                if 2 <= qx <= W - 3 and 2 <= qy <= H - 3:
                    sp.px(qx, qy, col)
        for ddx, ddy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            sp.px(sx_t + ddx, sy_t + ddy, FIR_YLW)
        # Connected roaring flames curling off the coiled lower belly!
        for wt in (0.24, 0.52):
            bw = _belly_width(wt)
            fx0 = sx + (tx - sx) * wt + nx * (bw + 0.3)
            fy0 = sy + (ty - sy) * wt + ny * (bw + 0.3)
            for k in range(4):
                fx = int(round(fx0 + nx * (k * 0.6) - ux * (k * 0.8)))
                fy = int(round(fy0 + ny * (k * 0.6)))
                if 2 <= fx <= W - 3 and 2 <= fy <= H - 3:
                    sp.px(fx, fy, FIR_YLW if k == 0 else (FIR_ORG if k < 2 else (FIR_RED if k == 2 else FIR_DEEP)))
                    if k < 2:
                        sp.px(fx + 1, fy, FIR_ORG if k == 0 else FIR_RED)

    elif pose == "strike":
        # AERODYNAMIC, SWEPT-BACK SUPERSONIC CRIMSON-GOLD PIERCING LANCE SHOCKWAVE!
        # Tapered smoothly at BOTH front piercing point (x=2) and swept rear whiskers (ZERO vertical cliff!)
        sx_t, sy_t = int(tx), int(ty)
        # Center blazing spear-beam (k=-3 -> x=2, cleanly inset by 2px!)
        for k in range(-3, 12):
            px_s = max(2, min(W - 3, sx_t + k))
            col = PURE_WHT if -2 <= k <= 4 else (FIR_YLW if k <= 7 else (FIR_ORG if k <= 10 else FIR_RED))
            sp.px(px_s, sy_t, col)
        # Inner flame cone hugging piercing lance
        for k in range(-1, 14):
            px_s = max(2, min(W - 3, sx_t + k))
            col = FIR_YLW if k <= 3 else (FIR_ORG if k <= 9 else (FIR_RED if k <= 12 else FIR_DEEP))
            sp.px(px_s, sy_t - 1, col)
            sp.px(px_s, sy_t + 1, col)
        # Mid aerodynamic flame curve (tapers off cleanly before socket!)
        for k in range(2, 13):
            px_s = max(2, min(W - 3, sx_t + k))
            col = FIR_ORG if k <= 6 else (FIR_RED if k <= 10 else FIR_DEEP)
            sp.px(px_s, sy_t - 2, col)
            sp.px(px_s, sy_t + 2, col)
        # Sleek swept-back upper & lower shockwave flame-wings (diamond tapered, NOT a wall!)
        for k in range(5, 11):
            px_s = max(2, min(W - 3, sx_t + k))
            col = FIR_RED if k <= 8 else FIR_DEEP
            sp.px(px_s, sy_t - 3, col)
            sp.px(px_s, sy_t + 3, col)
        for k in range(8, 12):
            px_s = max(2, min(W - 3, sx_t + k))
            sp.px(px_s, sy_t - 4, FIR_DEEP)
            sp.px(px_s, sy_t + 4, FIR_DEEP)


def draw_arms_and_weapon(sp: Sprite, cx: int, torso_y: int, pose: str, flame_phase: int):
    """Draw far arm + pauldron, ornate war glaive, and near arm + pauldron with
    exact parametric two-handed grip locking BOTH gauntlets onto the polearm shaft!"""
    ux = cx + (-1 if pose == "strike" else (1 if pose == "hurt" else 0))
    far_sh_x, far_sh_y = ux - 7, torso_y + 4
    near_sh_x, near_sh_y = ux + 7, torso_y + 4

    def _lerp_pt(p0: tuple[int, int], p1: tuple[int, int], t: float) -> tuple[int, int]:
        return (int(round(p0[0] + (p1[0] - p0[0]) * t)), int(round(p0[1] + (p1[1] - p0[1]) * t)))

    # Cohesive, anatomically grounded 2-handed polearm kinematics across all 6 frames!
    if pose == "windup":
        # COILED TIGHT BACK-RIGHT: clean 2px right margin (pom_x <= 70), spearhead coiled back!
        pom = (min(W - 6, ux + 24), torso_y + 13)
        tip = (ux - 21, torso_y + 6)
        near_hand = _lerp_pt(pom, tip, 0.25)
        far_hand  = _lerp_pt(pom, tip, 0.51)
        near_el   = (near_hand[0] + 2, near_hand[1] - 2)
        far_el    = (far_sh_x - 3, far_sh_y + 6)
    elif pose == "strike":
        # EXPLOSIVE PIERCING THRUST FORWARD LEFT (+20..25px lunge & spear extension!)
        pom = (min(W - 6, ux + 19), torso_y + 10)
        tip = (5, torso_y + 10)
        near_hand = _lerp_pt(pom, tip, 0.28)
        far_hand  = _lerp_pt(pom, tip, 0.50)
        near_el   = (ux + 6, torso_y + 10)
        far_el    = (ux - 9, torso_y + 9)
    elif pose == "hurt":
        # Knockback staggered diagonal guard!
        pom = (min(W - 6, ux + 18), torso_y + 23)
        tip = (13, torso_y - 10)
        near_hand = _lerp_pt(pom, tip, 0.27)
        far_hand  = _lerp_pt(pom, tip, 0.49)
        near_el   = (ux + 11, torso_y + 12)
        far_el    = (ux - 9, torso_y + 7)
    else:
        # Poised Imperial Vanguard Sentinel Stance: BOTH gauntlets welded firmly to diagonal shaft!
        w_bob = -1 if pose == "idle2" else 0
        pom = (min(W - 6, ux + 24), torso_y + 6 + w_bob)
        tip = (7, torso_y + 30 + w_bob)
        near_hand = _lerp_pt(pom, tip, 0.26)
        far_hand  = _lerp_pt(pom, tip, 0.49)
        near_el   = (ux + 11, torso_y + 10)
        far_el    = (ux - 9, torso_y + 12)

    # 1) Far (left) Armored Arm & Layered Pauldron
    sp.layer("far_arm")
    draw_armored_limb(sp, far_sh_x, far_sh_y + 2, far_el[0], far_el[1], thick=3, is_lit=True)
    draw_armored_limb(sp, far_el[0], far_el[1], far_hand[0], far_hand[1], thick=2, is_lit=True)
    draw_gauntlet(sp, far_hand[0], far_hand[1], is_lit=True)
    draw_pauldron(sp, far_sh_x, far_sh_y, side="far", pose=pose)

    # 2) Ornate Crimson-Glowing Runic War Glaive (weapon + fx layers)
    draw_war_glaive(sp, pom, tip, pose, flame_phase, belly_sign=1)

    # 3) Near (right) Armored Arm, Gauntlet gripping OVER shaft + Far knuckle wrap + Near Pauldron
    sp.layer("near_arm")
    draw_armored_limb(sp, near_sh_x, near_sh_y + 2, near_el[0], near_el[1], thick=3, is_lit=False)
    draw_armored_limb(sp, near_el[0], near_el[1], near_hand[0], near_hand[1], thick=2, is_lit=True)
    draw_gauntlet(sp, near_hand[0], near_hand[1], is_lit=True)
    # Crisp 2px overlapping armored knuckle clasp on far hand gripping over the polearm shaft!
    sp.px(far_hand[0] - 1, far_hand[1], STL_HI)
    sp.px(far_hand[0],     far_hand[1], GLD_HI)
    sp.px(far_hand[0] - 1, far_hand[1] + 1, STL_SH1)
    sp.px(far_hand[0],     far_hand[1] + 1, STL_SH2)
    draw_pauldron(sp, near_sh_x, near_sh_y, side="near", pose=pose)

    return tip


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    # (pose, dx, bob, sway, flame_phase, dur_ms)
    ("idle1",   0,   0,   0,  0, 260),
    ("idle2",   0,  -1,   1,  1, 260),
    ("blink",   0,   0,   0,  2, 140),
    ("windup",  3,   2,   1,  1, 180),
    ("strike", -5,   0,   2,  2, 160),
    ("hurt",    3,   1,  -1,  0, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "back_cape",
        "far_arm",
        "legs",
        "tassets",
        "torso",
        "mantle",
        "head",
        "weapon",
        "near_arm",
        "fx",
    ]
    sp.frames[0].cels = {ln: sp._blank() for ln in sp.layer_order}

    for _ in range(1, N_FRAMES):
        sp.add_frame(copy=False)

    anchors = {}

    for idx, (pose, dx, bob, sway, flame_phase, dur) in enumerate(FRAME_SPECS, start=1):
        sp.frame(idx)
        sp.set_duration(dur)

        cx = PIVOT_X + dx
        head_y = 4 + bob
        neck_y = head_y + 26
        torso_y = neck_y + 2
        waist_y = neck_y + 17

        draw_back_cape(sp, cx, torso_y, pose, sway)
        draw_legs_boots(sp, cx, GROUND_Y, pose)
        draw_tassets_and_tabard(sp, cx, waist_y, pose, sway)
        draw_torso_and_mantle(sp, cx, neck_y, pose, sway)
        draw_head(sp, cx, head_y, pose)
        tip_x, tip_y = draw_arms_and_weapon(sp, cx, torso_y, pose, flame_phase)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (cx - 2, head_y + 17)
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
                draw.ellipse([cx_m - 3, cy_m - 3, cx_m + 3, cy_m + 3], fill=(255, 165, 40), outline=(90, 20, 16))

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


def render_helm_zoom(sp: Sprite, path: str, scale: int = 10):
    x0, y0, x1, y1 = 18, 2, 62, 46
    cw, ch = (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale
    sep = 4
    out = Image.new("RGB", (N_FRAMES * cw + (N_FRAMES + 1) * sep, ch + 2 * sep), (48, 56, 76))
    for i in range(N_FRAMES):
        crop = sp.composite(i + 1).crop((x0, y0, x1 + 1, y1 + 1)).resize((cw, ch), NEAREST)
        out.paste(crop, (sep + i * (cw + sep), sep), crop)
    out.save(path)
    print(f"helm_zoom -> {path}")


def main():
    sp, anchors = build_sprite()
    info = sp.stats(print_=True)

    # Strict pixel-hygiene assertions across all 6 frames
    assert info["semi_alpha_px"] == 0, f"Expected 0 semi-alpha px, got {info['semi_alpha_px']}"
    assert not info["near_duplicate_colors"], f"Near-dup colors: {info['near_duplicate_colors']}"
    for fi in range(1, N_FRAMES + 1):
        sp.frame(fi)
        st = sp.stats(print_=False)
        assert not st["isolated_px"], f"Frame {fi} has isolated px: {st['isolated_px']}"
        # Verify clean >=1px border safety buffer on all 4 canvas edges!
        im = sp.composite(fi)
        px = im.load()
        for x in range(W):
            assert px[x, 0][3] == 0 and px[x, H - 1][3] == 0, f"Frame {fi} clips top/bottom edge at x={x}"
        for y in range(H):
            assert px[0, y][3] == 0 and px[W - 1, y][3] == 0, f"Frame {fi} clips left/right edge at y={y}"

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
        "id": "corridor_vanguard",
        "file": "assets/sprites/corridor_vanguard_sheet.png",
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
        "buildScript": "tools/pixel_art/corridor_vanguard/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=5)
    render_helm_zoom(sp, HELM_ZOOM_PATH, scale=10)


if __name__ == "__main__":
    main()
