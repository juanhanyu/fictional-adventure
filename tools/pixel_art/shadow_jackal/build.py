#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Frost-Ridge Shadow Jackal (shadow_jackal).

Act 6 Wave 2 Silver-Rank Assassin Beast: 霜脊影豺
100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 84 x 68, 6 horizontal frames (504 x 68 sheet, padding=0).
Facing: left. GROUND_Y = 62, PIVOT_X = 44.

Pass 3 (Final Jewelry-Grade Polish):
- Sculpted full-length snarling jackal snout in Frame 6 (hurt) with pinned-back ears & fierce `>` wince
- Long, clearly visible bushy S-curved midnight jackal tail outside the thigh + lush living ripple in idle2
- Organic flame-tapered spectral shadow-smoke tendrils curling off rump, tail & hind ankles (zero wire loops)
- Clean jaw-to-paw daylight separation in Frame 4 (windup) coiled phantom crouch + crackling cyan spine aura
- Explosive Frame 5 (strike) forward predator diagonal + triple-claw electric-cyan slash erupting directly
  from the extended ice talons with 100% unobstructed snarling snout & eyes
- Curved lupine shoulder/thigh muscle shading, razor-crisp curved ice claws, and 1px safety margins on all frames
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
W, H = 84, 68
N_FRAMES = 6
GROUND_Y = 62
PIVOT_X = 44

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "shadow_jackal_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "shadow_jackal_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
HEAD_ZOOM_PATH = os.path.join(HERE, "head_zoom.png")

# ---------------------------------------------------------------------------
# Master 20-Color Hue-Shifted Glacial-Shadow Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
INK_VOID = "#090c1a"  # Deepest abyssal indigo ink, shadow outlines, eye masks
FUR_SH2  = "#141a38"  # Deepest midnight-indigo fur shadow & far limbs
FUR_SH1  = "#202b5c"  # Rich dark midnight-indigo fur core shadow & lit fur selout
FUR_MID  = "#2e407d"  # Primary sleek midnight-indigo coat midtone
FUR_HI1  = "#455ea3"  # Sunlit cobalt-indigo muscular fur highlight & hackles
FUR_HI2  = "#6785c9"  # Crisp frost-rimmed top-left fur highlight

SMK_DARK = "#372e63"  # Spectral plum-indigo shadow-wisp core & inner ear shadow
SMK_MID  = "#57508f"  # Ghostly twilight-indigo shadow smoke midtone
SMK_HI   = "#8588c2"  # Misty lavender-slate shadow wisp highlight
SMK_PALE = "#b5bce3"  # Pale frosty spectral mist edge

INK_ICE  = "#17488a"  # Deep sapphire crystal outline & bevel shadow
CRY_SH   = "#2970c4"  # Shadowed glacial crystal blade facet
CRY_MID  = "#52aaf2"  # Vivid sky-frost crystal midtone & claw midtone
CRY_HI   = "#9ce0ff"  # Bright glacial ice facet highlight
CRY_WHT  = "#dcf7ff"  # Gleaming frosted ice ridge edge & claw edge
PURE_WHT = "#ffffff"  # Pure specular flash, eye core, fang gleam, slash core

CYN_DEEP = "#0082ad"  # Deep electric cyan energy rim
CYN_MID  = "#18cbeb"  # Vivid electric cyan glow, brow flames & claw slash trail
CYN_HI   = "#7ef7ff"  # Blazing electric cyan eye iris & slash inner edge

MAW_PLUM = "#5c224f"  # Cold dark plum inner jaw for snarl/hurt

PALETTE = [
    INK_VOID, FUR_SH2, FUR_SH1, FUR_MID, FUR_HI1, FUR_HI2,
    SMK_DARK, SMK_MID, SMK_HI, SMK_PALE,
    INK_ICE, CRY_SH, CRY_MID, CRY_HI, CRY_WHT, PURE_WHT,
    CYN_DEEP, CYN_MID, CYN_HI, MAW_PLUM,
]

# ---------------------------------------------------------------------------
# Drawing Primitives
# ---------------------------------------------------------------------------

def hspan(sp: Sprite, y: int, x0: int, x1: int, col: str, only=None):
    if x1 < x0:
        x0, x1 = x1, x0
    for x in range(int(x0), int(x1) + 1):
        sp.px(x, int(y), col, only=only)


def draw_capsule(sp: Sprite, x0: float, y0: float, x1: float, y1: float,
                 r0: float, r1: float, col: str, only=None):
    """Tapered muscular segment painted cleanly pixel-by-pixel."""
    steps = max(1, int(math.hypot(x1 - x0, y1 - y0) * 2.5) + 1)
    for i in range(steps + 1):
        t = i / steps
        cx = x0 + (x1 - x0) * t
        cy = y0 + (y1 - y0) * t
        r = r0 + (r1 - r0) * t
        ri = int(math.ceil(r))
        for dy in range(-ri, ri + 1):
            for dx in range(-ri, ri + 1):
                if dx * dx + dy * dy <= r * r + 0.12:
                    sp.px(int(round(cx)) + dx, int(round(cy)) + dy, col, only=only)


def draw_ribbon(sp: Sprite, pts: list[tuple[float, float, float]], col: str, only=None):
    """Smooth tapered ribbon across (x, y, radius) control points."""
    for i in range(len(pts) - 1):
        x0, y0, r0 = pts[i]
        x1, y1, r1 = pts[i + 1]
        draw_capsule(sp, x0, y0, x1, y1, r0, r1, col, only=only)


def draw_smoke_flame(sp: Sprite, pts: list[tuple[float, float]], base_r: float,
                     flip_lit: bool = False):
    """Organic flame-shaped spectral shadow wisp (plump curling belly tapering to razor misty tip,
    100% 4-way connected so ZERO isolated pixels ever form!).
    """
    dense = []
    n_seg = len(pts) - 1
    for i in range(n_seg):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        steps = max(3, int(math.hypot(x1 - x0, y1 - y0) * 3))
        for s in range(steps + 1):
            t = s / steps
            px_i = int(round(x0 + (x1 - x0) * t))
            py_i = int(round(y0 + (y1 - y0) * t))
            gt = (i + t) / max(1, n_seg)
            if not dense or (px_i, py_i) != (dense[-1][0], dense[-1][1]):
                if dense:
                    lx, ly, _ = dense[-1]
                    if abs(px_i - lx) == 1 and abs(py_i - ly) == 1:
                        dense.append((px_i, ly, gt))
                dense.append((px_i, py_i, gt))

    # Flame thickness profile: swells smoothly near t=0.22 then tapers organically to a crisp 1px wisp!
    def _rad(t: float) -> float:
        env = math.sin(min(1.0, t * 1.15) * math.pi * 0.85) if t < 0.35 else (1.0 - t) ** 0.85
        return max(0.0, base_r * (0.45 + 0.65 * env) * (1.0 - t * 0.92))

    # 1) Outer ethereal twilight-indigo base
    for x, y, gt in dense:
        r = _rad(gt)
        if r < 0.45:
            sp.px(x, y, SMK_HI if gt > 0.78 else SMK_MID)
        else:
            ri = int(math.ceil(r))
            for dy in range(-ri, ri + 1):
                for dx in range(-ri, ri + 1):
                    if dx * dx + dy * dy <= r * r + 0.15:
                        sp.px(x + dx, y + dy, SMK_MID)

    # 2) Shadow plum-indigo lower/inner belly
    for x, y, gt in dense:
        if gt > 0.72:
            continue
        r = max(0.0, _rad(gt) - 0.55)
        ox_s = 1 if flip_lit else 0
        if r >= 0.45:
            ri = int(math.ceil(r))
            for dy in range(-ri, ri + 1):
                for dx in range(-ri, ri + 1):
                    if dx * dx + dy * dy <= r * r + 0.1:
                        sp.px(x + dx + ox_s, y + dy + 1, SMK_DARK)
        else:
            sp.px(x + ox_s, y + 1, SMK_DARK)

    # 3) Luminous misty lavender upper-left highlight ridge + pale frost wisp edge
    for idx_d, (x, y, gt) in enumerate(dense):
        r = _rad(gt)
        if 0.12 < gt < 0.88:
            hx = x - (0 if flip_lit else 1) if r >= 0.8 else x
            hy = y - 1 if r >= 0.8 else y
            sp.px(hx, hy, SMK_HI)
            if 0.30 < gt < 0.72 and idx_d % 3 == 0:
                sp.px(hx, hy, SMK_PALE)


def draw_crystal_blade(sp: Sprite, bx: float, by: float, tx: float, ty: float,
                       half_w: float, glow: bool = False, crisp_tip: bool = True):
    """Multi-faceted glacial crystal blade from base (bx,by) to razor tip (tx,ty).
    Lit from top-left: left/upper bevel gleams glacial white/cyan, lower-right facet deep sapphire!
    """
    vx, vy = tx - bx, ty - by
    length = max(1.0, math.hypot(vx, vy))
    ux, uy = vx / length, vy / length
    nx, ny = uy, -ux

    m_t = 0.25
    mx, my = bx + vx * m_t, by + vy * m_t

    full_poly = [
        (round(bx + nx * (half_w * 0.78)), round(by + ny * (half_w * 0.78))),
        (round(mx + nx * half_w),          round(my + ny * half_w)),
        (round(tx),                        round(ty)),
        (round(mx - nx * (half_w * 0.80)), round(my - ny * (half_w * 0.80))),
        (round(bx - nx * (half_w * 0.75)), round(by - ny * (half_w * 0.75))),
    ]
    sp.polygon(full_poly, CRY_MID, fill=True)

    # Shadow right-lower bevel facet
    sh_poly = [
        (round(bx),                        round(by)),
        (round(mx),                        round(my)),
        (round(tx),                        round(ty)),
        (round(mx - nx * (half_w * 0.80)), round(my - ny * (half_w * 0.80))),
        (round(bx - nx * (half_w * 0.75)), round(by - ny * (half_w * 0.75))),
    ]
    sp.polygon(sh_poly, CRY_SH if not glow else CRY_MID, fill=True)

    # Lit upper-left bevel facet
    hi_poly = [
        (round(bx + nx * (half_w * 0.76)), round(by + ny * (half_w * 0.76))),
        (round(mx + nx * half_w),          round(my + ny * half_w)),
        (round(tx),                        round(ty)),
        (round(mx + nx * (half_w * 0.14)), round(my + ny * (half_w * 0.14))),
        (round(bx + nx * (half_w * 0.12)), round(by + ny * (half_w * 0.12))),
    ]
    sp.polygon(hi_poly, CYN_HI if glow else CRY_HI, fill=True)

    # Razor lit leading edge
    sp.line(round(mx + nx * (half_w * 0.86)), round(my + ny * (half_w * 0.86)),
            round(tx), round(ty), PURE_WHT if glow else CRY_WHT)
    sp.line(round(bx + nx * (half_w * 0.50)), round(by + ny * (half_w * 0.50)),
            round(mx + nx * (half_w * 0.75)), round(my + ny * (half_w * 0.75)), CRY_WHT)

    # Central crystalline ridge highlight
    sp.line(round(bx + vx * 0.15), round(by + vy * 0.15),
            round(bx + vx * 0.78), round(by + vy * 0.78), PURE_WHT if glow else CRY_HI)

    if crisp_tip:
        sp.px(round(tx), round(ty), PURE_WHT)
        sp.px(round(tx - ux), round(ty - uy), PURE_WHT if glow else CRY_WHT)


def draw_paw_with_claws(sp: Sprite, px: int, py: int, is_far: bool,
                        raised: bool = False, glow: bool = False, spread: bool = False):
    """Sleek lupine paw with 3 distinct razor-curved glacial talons."""
    fur_hi = FUR_MID if is_far else FUR_HI1
    fur_m  = FUR_SH1 if is_far else FUR_MID
    fur_s  = FUR_SH2 if is_far else FUR_SH1
    c_hi   = CRY_HI if is_far else (CYN_HI if glow else CRY_WHT)
    c_mid  = CRY_SH if is_far else (CYN_MID if glow else CRY_MID)

    if spread:
        # Open slashing paw reaching forward-left in strike!
        sp.polygon([(px - 2, py - 2), (px + 3, py - 2), (px + 2, py + 2), (px - 2, py + 1)],
                   fur_m, fill=True)
        hspan(sp, py - 2, px - 2, px + 1, fur_hi)
        hspan(sp, py + 1, px - 1, px + 2, fur_s)
        # 3 wide-splayed razor ice claws slashing forward-left!
        sp.px(px - 3, py - 3, c_hi)
        sp.px(px - 4, py - 3, PURE_WHT)
        sp.px(px - 5, py - 2, c_hi)

        sp.px(px - 3, py - 1, c_hi)
        sp.px(px - 4, py - 1, PURE_WHT)
        sp.px(px - 5, py,     PURE_WHT)
        sp.px(px - 6, py + 1, c_mid)

        sp.px(px - 2, py + 1, c_hi)
        sp.px(px - 3, py + 2, PURE_WHT)
        sp.px(px - 4, py + 3, c_mid)
        return

    # Arched sleek lupine toes
    hspan(sp, py - 3, px - 1, px + 2, fur_m)
    sp.px(px - 1, py - 3, fur_hi)
    sp.px(px + 2, py - 3, fur_s)

    hspan(sp, py - 2, px - 2, px + 3, fur_m)
    hspan(sp, py - 2, px - 2, px, fur_hi)
    sp.px(px + 3, py - 2, fur_s)

    hspan(sp, py - 1, px - 2, px + 3, fur_s)
    hspan(sp, py - 1, px - 1, px + 1, fur_m)

    if not raised:
        hspan(sp, py, px - 2, px + 2, FUR_SH2)
        sp.px(px - 1, py, fur_s)
    else:
        hspan(sp, py, px - 1, px + 2, fur_s)

    # 3 crisp separated curved frost claws!
    # Outer-left longest curved talon
    sp.px(px - 3, py - 2, c_hi)
    sp.px(px - 4, py - 1, PURE_WHT if not is_far else c_hi)
    sp.px(px - 5, py,     c_hi if not is_far else c_mid)
    sp.px(px - 4, py,     c_mid)
    # Dark toe gap separating talon 1 & talon 2
    sp.px(px - 3, py - 1, INK_VOID if not is_far else FUR_SH2)
    # Middle talon
    sp.px(px - 1, py - 1, c_hi)
    sp.px(px - 2, py,     PURE_WHT if not is_far else c_hi)
    sp.px(px - 3, py,     c_mid)
    # Side talon
    sp.px(px + 1, py - 1, c_hi)
    sp.px(px,     py,     c_hi if not is_far else c_mid)
    sp.px(px + 1, py,     c_mid)


# ---------------------------------------------------------------------------
# Layer Painters
# ---------------------------------------------------------------------------

def draw_shadow_smoke(sp: Sprite, ox: int, oy: int, pose: str, ripple: int):
    """Organic flame-tapered spectral shadow-smoke tendrils curling off rump, tail & hind paws.
    Zero heavy dark outlines — reads as true ghostly phantom shadow-mist on light AND dark bgs!
    """
    sp.layer("shadow_smoke")

    if pose == "strike":
        # Sleek aerodynamic phantom slipstream flames whipping horizontally right!
        w1 = [(ox + 60, oy + 31), (ox + 67, oy + 28), (ox + 75, oy + 26), (ox + 81, oy + 25)]
        w2 = [(ox + 65, oy + 38), (ox + 73, oy + 37), (ox + 80, oy + 35)]
        w3 = [(ox + 62, oy + 58), (ox + 70, oy + 57), (ox + 77, oy + 55)]
        draw_smoke_flame(sp, w1, base_r=1.7)
        draw_smoke_flame(sp, w2, base_r=1.2)
        draw_smoke_flame(sp, w3, base_r=0.9)
        return

    elif pose == "windup":
        # Fierce surging phantom flames billowing upward behind coiled haunches!
        w1 = [(ox + 58, oy + 33), (ox + 64, oy + 27), (ox + 68, oy + 19), (ox + 65, oy + 12), (ox + 61, oy + 9)]
        w2 = [(ox + 69, oy + 40), (ox + 74, oy + 33), (ox + 76, oy + 24), (ox + 74, oy + 19)]
        w3 = [(ox + 66, oy + 58), (ox + 72, oy + 54), (ox + 76, oy + 49)]
        draw_smoke_flame(sp, w1, base_r=2.0)
        draw_smoke_flame(sp, w2, base_r=1.45)
        draw_smoke_flame(sp, w3, base_r=1.0)
        return

    elif pose == "hurt":
        # Recoil-jolted mist puff curling upward
        w1 = [(ox + 58, oy + 32), (ox + 64, oy + 24), (ox + 63, oy + 16), (ox + 59, oy + 13)]
        w2 = [(ox + 68, oy + 40), (ox + 73, oy + 33), (ox + 74, oy + 26)]
        draw_smoke_flame(sp, w1, base_r=1.75)
        draw_smoke_flame(sp, w2, base_r=1.25)
        return

    else:
        # Living S-curling twilight mist rising off rump + drifting off the bushy jackal tail!
        # Strong unmistakable ripple in idle2 (ripple=1)!
        r = ripple
        w1 = [
            (ox + 60,     oy + 32),
            (ox + 66,     oy + 27 - r),
            (ox + 71 + r, oy + 20 - r * 2),
            (ox + 68 + r, oy + 14 - r),
            (ox + 64,     oy + 13 - r),
        ]
        # Flowing phantom mist flame trailing smoothly off the upper curve of the furry tail!
        w2 = [
            (ox + 73,     oy + 41 - r * 2),
            (ox + 78,     oy + 35 - r * 2),
            (ox + 80,     oy + 28 - r * 2),
            (ox + 77 - r, oy + 24 - r),
        ]
        # Subtle ground shadow wisp curling behind the near hind ankle
        w3 = [
            (ox + 66,     oy + 59),
            (ox + 72,     oy + 57 - r),
            (ox + 76,     oy + 53 - r),
        ]
        draw_smoke_flame(sp, w1, base_r=1.85)
        draw_smoke_flame(sp, w2, base_r=1.35)
        draw_smoke_flame(sp, w3, base_r=0.95)


def draw_far_limbs(sp: Sprite, ox: int, oy: int, pose: str):
    """Slender far front & far hind legs in deeper midnight-indigo with clean daylight gaps."""
    sp.layer("far_limbs")

    if pose == "strike":
        # Far front leg dynamically angled back-right bracing explosive forward slash!
        ff_sh   = (ox + 34, oy + 40)
        ff_el   = (ox + 39, oy + 49)
        ff_paw  = (ox + 41, GROUND_Y)

        fh_hip  = (ox + 53, oy + 38)
        fh_hock = (ox + 62, oy + 48)
        fh_paw  = (ox + 58, GROUND_Y)
    elif pose == "windup":
        ff_sh   = (ox + 33, oy + 43)
        ff_el   = (ox + 37, oy + 51)
        ff_paw  = (ox + 34, GROUND_Y)

        fh_hip  = (ox + 51, oy + 41)
        fh_hock = (ox + 58, oy + 51)
        fh_paw  = (ox + 52, GROUND_Y)
    elif pose == "hurt":
        ff_sh   = (ox + 34, oy + 40)
        ff_el   = (ox + 37, oy + 50)
        ff_paw  = (ox + 35, GROUND_Y)

        fh_hip  = (ox + 52, oy + 40)
        fh_hock = (ox + 58, oy + 50)
        fh_paw  = (ox + 53, GROUND_Y)
    else:
        ff_sh   = (ox + 33, oy + 40)
        ff_el   = (ox + 37, oy + 50)
        ff_paw  = (ox + 34, GROUND_Y)

        fh_hip  = (ox + 51, oy + 38)
        fh_hock = (ox + 58, oy + 49)
        fh_paw  = (ox + 52, GROUND_Y)

    # Far Front Leg
    draw_capsule(sp, ff_sh[0], ff_sh[1], ff_el[0], ff_el[1], 2.2, 1.5, FUR_SH2)
    draw_capsule(sp, ff_el[0], ff_el[1], ff_paw[0], ff_paw[1] - 2, 1.5, 1.1, FUR_SH2)
    sp.line(ff_sh[0] - 1, ff_sh[1] + 1, ff_el[0] - 1, ff_el[1], FUR_SH1)
    sp.line(ff_el[0] - 1, ff_el[1], ff_paw[0] - 1, ff_paw[1] - 3, FUR_SH1)
    draw_paw_with_claws(sp, ff_paw[0], ff_paw[1], is_far=True)

    # Far Hind Leg
    draw_capsule(sp, fh_hip[0], fh_hip[1], fh_hock[0], fh_hock[1], 2.8, 1.6, FUR_SH2)
    draw_capsule(sp, fh_hock[0], fh_hock[1], fh_paw[0], fh_paw[1] - 2, 1.5, 1.1, FUR_SH2)
    sp.line(fh_hip[0] - 2, fh_hip[1] + 2, fh_hock[0] - 1, fh_hock[1] - 1, FUR_SH1)
    sp.line(fh_hock[0] - 1, fh_hock[1], fh_paw[0] - 1, fh_paw[1] - 3, FUR_SH1)
    draw_paw_with_claws(sp, fh_paw[0], fh_paw[1], is_far=True)


def draw_tail(sp: Sprite, ox: int, oy: int, pose: str, ripple: int):
    """Long, sleek, bushy S-curved midnight-indigo jackal tail clearly visible behind haunch!"""
    sp.layer("tail")

    if pose == "strike":
        # Stretched straight back like a deadly aerodynamic rudder!
        pts = [
            (ox + 60, oy + 33, 2.0),
            (ox + 67, oy + 33, 2.3),
            (ox + 74, oy + 32, 1.8),
            (ox + 79, oy + 31, 1.0),
            (ox + 81, oy + 30, 0.4),
        ]
    elif pose == "windup":
        # Tensed arched S-sweep behind coiled haunches!
        pts = [
            (ox + 59, oy + 35, 2.0),
            (ox + 66, oy + 39, 2.4),
            (ox + 71, oy + 44, 2.0),
            (ox + 75, oy + 40, 1.2),
            (ox + 77, oy + 35, 0.5),
        ]
    elif pose == "hurt":
        # Swept down sharply behind legs in recoil
        pts = [
            (ox + 59, oy + 34, 1.9),
            (ox + 66, oy + 38, 2.2),
            (ox + 70, oy + 46, 1.7),
            (ox + 69, oy + 52, 1.0),
            (ox + 67, oy + 55, 0.4),
        ]
    else:
        # Sweeping clearly outside the hind thigh so full bushy S-curved jackal tail shines!
        # Noticeable living wave in idle2 (ripple=1)!
        r = ripple
        pts = [
            (ox + 60, oy + 33,         2.0),
            (ox + 67, oy + 37 - r,     2.4),
            (ox + 72, oy + 43 - r * 2, 2.1),
            (ox + 76, oy + 40 - r * 2, 1.4),
            (ox + 79, oy + 35 - r * 2, 0.6),
        ]

    draw_ribbon(sp, pts, FUR_SH1)
    draw_ribbon(sp, [(x, y + 0.7, max(0.3, rad - 0.5)) for x, y, rad in pts], FUR_SH2)
    draw_ribbon(sp, [(x - 0.3, y - 0.8, max(0.3, rad - 0.8)) for x, y, rad in pts[:-1]], FUR_MID)
    # Sunlit cobalt fur ridge along upper sweep of tail
    for i in range(len(pts) - 2):
        x0, y0, r0 = pts[i]
        x1, y1, r1 = pts[i + 1]
        sp.line(round(x0), round(y0 - r0 * 0.65), round(x1), round(y1 - r1 * 0.65), FUR_HI1)

    # Jagged wolf-tail fur tufts along lower curve
    mx, my, _ = pts[1]
    sp.polygon([(round(mx - 1), round(my + 1)), (round(mx + 2), round(my + 2)),
                (round(mx), round(my + 4))], FUR_SH2, fill=True)
    mx2, my2, _ = pts[2]
    sp.polygon([(round(mx2), round(my2 + 1)), (round(mx2 + 3), round(my2 + 2)),
                (round(mx2 + 1), round(my2 + 4))], FUR_SH1, fill=True)
    # Misty frost-lavender tip tuft dissolving into shadow wisps
    tx, ty, _ = pts[-1]
    sp.px(round(tx), round(ty), SMK_HI)


def draw_body(sp: Sprite, ox: int, oy: int, pose: str):
    """Razor-lean, elongated predatory jackal torso: sleek arched neck, deep chest ruff,
    athletic sighthound waist tuck, sinewy muscular shoulders & rump.
    """
    sp.layer("body")

    if pose == "windup":
        sh_y = oy + 29
        chest_y = oy + 45
        waist_y = oy + 41
        rump_y = oy + 32
        neck_x, neck_y = ox + 25, oy + 32
    elif pose == "strike":
        sh_y = oy + 27
        chest_y = oy + 42
        waist_y = oy + 37
        rump_y = oy + 30
        neck_x, neck_y = ox + 23, oy + 29
    elif pose == "hurt":
        sh_y = oy + 27
        chest_y = oy + 43
        waist_y = oy + 39
        rump_y = oy + 32
        neck_x, neck_y = ox + 27, oy + 27
    else:
        sh_y = oy + 26
        chest_y = oy + 43
        waist_y = oy + 38
        rump_y = oy + 30
        neck_x, neck_y = ox + 23, oy + 30

    torso_poly = [
        (neck_x,     neck_y),
        (ox + 33,    sh_y),
        (ox + 44,    sh_y + 1),
        (ox + 55,    rump_y),
        (ox + 61,    rump_y + 3),
        (ox + 62,    rump_y + 10),
        (ox + 55,    waist_y + 3),
        (ox + 47,    waist_y),
        (ox + 38,    chest_y + 1),
        (ox + 30,    chest_y + 1),
        (neck_x + 2, neck_y + 9),
        (neck_x - 1, neck_y + 5),
    ]
    sp.polygon(torso_poly, FUR_MID, fill=True)

    # Deep underbelly & lower ribcage shadow
    shadow_poly = [
        (ox + 28, chest_y - 3),
        (ox + 39, chest_y - 2),
        (ox + 48, waist_y - 3),
        (ox + 56, rump_y + 6),
        (ox + 62, rump_y + 10),
        (ox + 55, waist_y + 3),
        (ox + 47, waist_y),
        (ox + 38, chest_y + 1),
        (ox + 30, chest_y + 1),
    ]
    sp.polygon(shadow_poly, FUR_SH1, fill=True)

    sp.line(ox + 30, chest_y + 1, ox + 38, chest_y + 1, FUR_SH2)
    sp.line(ox + 38, chest_y + 1, ox + 47, waist_y, FUR_SH2)
    sp.line(ox + 47, waist_y, ox + 55, waist_y + 3, FUR_SH2)
    sp.line(ox + 31, chest_y, ox + 39, chest_y, FUR_SH2)

    # Sunlit top-left cobalt muscular highlight across neck, shoulders & arched spine
    hi_back = [
        (neck_x + 1, neck_y + 1),
        (ox + 33,    sh_y),
        (ox + 44,    sh_y + 1),
        (ox + 54,    rump_y),
        (ox + 52,    rump_y + 4),
        (ox + 43,    sh_y + 5),
        (ox + 33,    sh_y + 5),
        (neck_x + 2, neck_y + 4),
    ]
    sp.polygon(hi_back, FUR_HI1, fill=True)

    # Crisp frost-rim top highlight edge
    sp.line(neck_x + 1, neck_y + 1, ox + 33, sh_y, FUR_HI2)
    sp.line(ox + 33, sh_y, ox + 44, sh_y + 1, FUR_HI2)
    sp.line(ox + 45, sh_y + 2, ox + 53, rump_y + 1, FUR_HI1)

    # Curved organic lupine rib & latissimus fur clusters
    sp.line(ox + 39, sh_y + 6, ox + 45, sh_y + 8, FUR_HI1)
    sp.line(ox + 40, sh_y + 7, ox + 46, sh_y + 9, FUR_SH1)
    sp.line(ox + 45, sh_y + 9, ox + 49, waist_y - 1, FUR_SH1)

    # Sharp swept-back chest & throat hackle tufts
    ruff = [
        [(neck_x + 1, neck_y + 6), (neck_x - 2, neck_y + 10), (neck_x + 4, neck_y + 9)],
        [(ox + 28, chest_y - 2),   (ox + 25, chest_y + 2),    (ox + 31, chest_y + 1)],
        [(ox + 35, chest_y),       (ox + 40, chest_y + 3),    (ox + 41, chest_y)],
    ]
    for tri in ruff:
        sp.polygon(tri, FUR_MID, fill=True)
        sp.line(tri[0][0], tri[0][1], tri[1][0], tri[1][1], FUR_HI1)


def draw_spines(sp: Sprite, ox: int, oy: int, pose: str):
    """Iconic Frost-Ridge (霜脊) crystal spine blades with dramatic organic assassin rhythm."""
    sp.layer("spines")

    glow = pose in ("windup", "strike", "blink")
    if pose == "windup":
        sh_y, rump_y = oy + 29, oy + 32
        ax, ay = -1, -3
    elif pose == "strike":
        sh_y, rump_y = oy + 27, oy + 30
        ax, ay = 4, 2
    elif pose == "hurt":
        sh_y, rump_y = oy + 27, oy + 32
        ax, ay = -2, -1
    else:
        sh_y, rump_y = oy + 26, oy + 30
        ax, ay = 0, 0

    blades = [
        (ox + 55, rump_y + 1, ox + 63 + ax, rump_y - 4 + ay, 1.5),
        (ox + 50, sh_y + 4,   ox + 60 + ax, sh_y - 6 + ay,   1.9),
        (ox + 44, sh_y + 2,   ox + 56 + ax, sh_y - 11 + ay,  2.3),
        (ox + 38, sh_y + 1,   ox + 52 + ax, sh_y - 16 + ay,  2.7),
        (ox + 32, sh_y + 2,   ox + 47 + ax, sh_y - 22 + ay,  3.1),
        (ox + 27, sh_y + 3,   ox + 36 + ax, sh_y - 11 + ay,  1.9),
    ]

    for i, (bx, by, tx, ty, hw) in enumerate(blades):
        tx = max(2, min(W - 3, tx))
        ty = max(2, min(H - 3, ty))
        blade_glow = glow if pose != "blink" else (i in (4, 5))
        draw_crystal_blade(sp, bx, by, tx, ty, hw, glow=blade_glow)

    # Dark fur hackles hugging crystal roots so blades erupt organically from spine
    fur_collars = [
        [(ox + 30, sh_y + 3),   (ox + 34, sh_y - 2),   (ox + 35, sh_y + 3)],
        [(ox + 37, sh_y + 2),   (ox + 41, sh_y - 2),   (ox + 42, sh_y + 3)],
        [(ox + 44, sh_y + 3),   (ox + 48, sh_y),       (ox + 48, sh_y + 4)],
        [(ox + 51, rump_y + 1), (ox + 54, rump_y - 1), (ox + 55, rump_y + 2)],
    ]
    for tri in fur_collars:
        sp.polygon(tri, FUR_SH1, fill=True)
        sp.line(tri[0][0], tri[0][1], tri[1][0], tri[1][1], FUR_HI1)

    # Embedded shoulder & flank frost shards (matches reference art!)
    draw_crystal_blade(sp, ox + 36, sh_y + 8, ox + 42, sh_y + 4, 1.1, glow=glow)
    draw_crystal_blade(sp, ox + 51, rump_y + 6, ox + 56, rump_y + 3, 1.0, glow=False)


def draw_near_limbs(sp: Sprite, ox: int, oy: int, pose: str):
    """Hero foreground legs: sinewy digitigrade hind leg + agile stalking/slashing front leg."""
    sp.layer("near_limbs")
    glow_claws = pose in ("windup", "strike")

    # --- NEAR HIND LEG ---
    if pose == "strike":
        hip  = (ox + 58, oy + 36)
        knee = (ox + 56, oy + 45)
        hock = (ox + 69, oy + 50)
        paw  = (ox + 67, GROUND_Y)
    elif pose == "windup":
        hip  = (ox + 56, oy + 39)
        knee = (ox + 52, oy + 46)
        hock = (ox + 66, oy + 51)
        paw  = (ox + 62, GROUND_Y)
    elif pose == "hurt":
        hip  = (ox + 57, oy + 37)
        knee = (ox + 54, oy + 46)
        hock = (ox + 66, oy + 50)
        paw  = (ox + 63, GROUND_Y)
    else:
        hip  = (ox + 56, oy + 35)
        knee = (ox + 53, oy + 44)
        hock = (ox + 67, oy + 49)
        paw  = (ox + 63, GROUND_Y)

    # Curved subtle shadow contour separating thigh from torso
    sp.px(hip[0] - 4, hip[1] - 1, FUR_SH1)
    sp.px(hip[0] - 4, hip[1],     FUR_SH2)
    sp.px(hip[0] - 3, hip[1] + 2, FUR_SH2)
    sp.px(knee[0] - 2, knee[1] - 2, FUR_SH1)

    thigh_poly = [
        (hip[0] - 3, hip[1] - 3),
        (hip[0] + 4, hip[1] - 2),
        (hip[0] + 5, hip[1] + 4),
        (hock[0] + 1, hock[1]),
        (hock[0] - 2, hock[1] + 1),
        (knee[0],     knee[1] + 1),
        (knee[0] - 2, knee[1] - 2),
    ]
    sp.polygon(thigh_poly, FUR_MID, fill=True)
    sp.polygon([
        (hip[0] - 3, hip[1] - 3),
        (hip[0] + 1, hip[1] - 2),
        (knee[0] + 1, knee[1]),
        (knee[0] - 2, knee[1] - 1),
    ], FUR_HI1, fill=True)
    sp.line(hip[0] - 3, hip[1] - 2, knee[0] - 2, knee[1] - 1, FUR_HI2)
    sp.line(hip[0] + 4, hip[1] + 1, hock[0] + 1, hock[1], FUR_SH1)
    sp.line(hip[0] + 5, hip[1] + 3, hock[0] + 1, hock[1] - 1, FUR_SH2)
    sp.polygon([(hock[0], hock[1] - 1), (hock[0] + 3, hock[1] + 1), (hock[0], hock[1] + 2)],
               FUR_SH1, fill=True)

    # Slender sinewy lower hind leg
    draw_capsule(sp, hock[0] - 1, hock[1], paw[0] + 1, paw[1] - 2, 1.6, 1.15, FUR_MID)
    sp.line(hock[0] - 2, hock[1] + 1, paw[0], paw[1] - 3, FUR_HI1)
    sp.line(hock[0], hock[1] + 1, paw[0] + 2, paw[1] - 2, FUR_SH1)

    draw_paw_with_claws(sp, paw[0], paw[1], is_far=False, glow=False)

    # --- NEAR FRONT LEG ---
    if pose == "strike":
        # Explosive forward-left shadow-claw swipe — ice claws directly drive the triple cyan arc!
        sh = (ox + 31, oy + 35)
        el = (ox + 26, oy + 43)
        wr = (ox + 17, oy + 46)
        draw_capsule(sp, sh[0], sh[1], el[0], el[1], 2.9, 1.9, FUR_MID)
        draw_capsule(sp, el[0], el[1], wr[0], wr[1], 1.8, 1.3, FUR_MID)
        sp.line(sh[0] - 2, sh[1] - 1, el[0] - 1, el[1] - 2, FUR_HI1)
        sp.line(el[0] - 1, el[1] - 2, wr[0], wr[1] - 1, FUR_HI2)
        sp.line(sh[0] + 1, sh[1] + 2, el[0] + 1, el[1] + 2, FUR_SH1)
        sp.polygon([(el[0] + 1, el[1] - 1), (el[0] + 5, el[1]), (el[0] + 1, el[1] + 2)],
                   FUR_SH1, fill=True)
        draw_paw_with_claws(sp, wr[0] - 1, wr[1] + 1, is_far=False, raised=True, glow=True, spread=True)
        return (wr[0] - 6, wr[1] + 1)

    elif pose == "windup":
        # Coiled raised front paw cleanly separated below snarling jaw (zero visual tangle!)
        sh  = (ox + 32, oy + 37)
        el  = (ox + 35, oy + 47)
        paw = (ox + 25, oy + 53)
        draw_capsule(sp, sh[0], sh[1], el[0], el[1], 2.9, 1.9, FUR_MID)
        draw_capsule(sp, el[0], el[1], paw[0] + 1, paw[1] - 1, 1.8, 1.3, FUR_MID)
        sp.line(sh[0] - 2, sh[1], el[0] - 2, el[1] - 1, FUR_HI1)
        sp.line(el[0] - 2, el[1] - 1, paw[0], paw[1] - 2, FUR_HI2)
        sp.line(sh[0] + 2, sh[1] + 1, el[0] + 2, el[1] + 1, FUR_SH1)
        sp.polygon([(el[0] + 1, el[1] - 1), (el[0] + 5, el[1] + 1), (el[0] + 1, el[1] + 2)],
                   FUR_SH1, fill=True)
        draw_paw_with_claws(sp, paw[0], paw[1], is_far=False, raised=True, glow=True)
        return (paw[0] - 4, paw[1])

    elif pose == "hurt":
        # Skidding/lifted recoil paw clearly separated from braced far paw
        sh  = (ox + 32, oy + 36)
        el  = (ox + 32, oy + 46)
        paw = (ox + 22, GROUND_Y - 3)
        draw_capsule(sp, sh[0], sh[1], el[0], el[1], 2.8, 1.8, FUR_MID)
        draw_capsule(sp, el[0], el[1], paw[0] + 1, paw[1] - 1, 1.7, 1.2, FUR_MID)
        sp.line(sh[0] - 2, sh[1], el[0] - 2, el[1], FUR_HI1)
        sp.line(el[0] - 2, el[1], paw[0], paw[1] - 2, FUR_HI2)
        draw_paw_with_claws(sp, paw[0], paw[1], is_far=False, raised=True, glow=False)
        return (paw[0] - 4, paw[1])

    else:
        # Agile prowling forward-reaching foreground leg!
        sh  = (ox + 31, oy + 35)
        el  = (ox + 32, oy + 46)
        paw = (ox + 22, GROUND_Y)
        draw_capsule(sp, sh[0], sh[1], el[0], el[1], 2.9, 1.9, FUR_MID)
        draw_capsule(sp, el[0], el[1], paw[0] + 1, paw[1] - 2, 1.8, 1.2, FUR_MID)
        # Organic curved shoulder-blade shadow bevel (replaces rigid vertical line!)
        sp.px(sh[0] + 3, sh[1],     FUR_SH1)
        sp.px(sh[0] + 3, sh[1] + 2, FUR_SH1)
        sp.px(sh[0] + 2, sh[1] + 4, FUR_SH2)
        sp.px(el[0] + 2, el[1] - 3, FUR_SH2)
        # Muscular top-left lighting & shadow rear edge
        sp.line(sh[0] - 2, sh[1] - 1, el[0] - 2, el[1], FUR_HI1)
        sp.line(el[0] - 2, el[1], paw[0], paw[1] - 3, FUR_HI2)
        sp.line(sh[0] + 2, sh[1] + 2, el[0] + 2, el[1], FUR_SH1)
        sp.line(el[0] + 1, el[1] + 1, paw[0] + 2, paw[1] - 3, FUR_SH1)
        # Sharp swept-back elbow hackle spike
        sp.polygon([(el[0] + 1, el[1] - 2), (el[0] + 5, el[1] - 1), (el[0] + 1, el[1] + 1)],
                   FUR_MID, fill=True)
        sp.px(el[0] + 4, el[1] - 1, FUR_HI1)
        # Tiny icy frost glint on forearm (as in reference art!)
        sp.px(el[0] - 3, el[1] + 4, CRY_HI)
        sp.px(el[0] - 4, el[1] + 5, CRY_WHT)
        draw_paw_with_claws(sp, paw[0], paw[1], is_far=False, glow=glow_claws)
        return (paw[0] - 4, paw[1])


def draw_head(sp: Sprite, ox: int, oy: int, pose: str):
    """Razor-sharp lupine jackal head: clean twin tall pointed ears, full-length tapered snout
    preserved across ALL 6 frames (including hurt recoil!), dark eye mask, blazing electric-cyan eyes!
    """
    sp.layer("head")

    hx = ox + 20
    hy = oy + 32
    if pose == "windup":
        hx += 1
        hy += 2    # lowered coiled predator snarl, cleanly separated above raised claw paw!
    elif pose == "strike":
        hx += 2    # 100% unobstructed behind the blazing left-side slash arc!
        hy += 0
    elif pose == "hurt":
        hx += 5
        hy -= 3    # recoiled up-back while preserving full sharp lupine muzzle!

    ear_pin_x = 5 if pose == "hurt" else (2 if pose == "strike" else 0)
    ear_pin_y = 5 if pose == "hurt" else (1 if pose == "strike" else 0)
    ear_flick = -1 if pose == "idle2" else 0

    # 1) FAR EAR (left-upper tall razor jackal ear — 100% clean silhouette!)
    far_tip_x = hx - 2 + ear_pin_x
    far_tip_y = hy - 18 + ear_pin_y + ear_flick
    far_ear = [
        (hx - 2, hy - 5),
        (far_tip_x, far_tip_y),
        (hx + 3, hy - 7),
    ]
    sp.polygon(far_ear, FUR_SH2, fill=True)
    sp.line(hx - 2, hy - 5, far_tip_x, far_tip_y, FUR_MID)
    sp.line(hx - 1, hy - 7, far_tip_x, far_tip_y + 2, FUR_HI1)
    sp.line(hx, hy - 7, far_tip_x + 1, far_tip_y + 5, SMK_DARK)

    # 2) SKULL & LONG RAZOR-TAPERED JACKAL SNOUT!
    if pose == "hurt":
        # Sleek long razor jackal muzzle tilted slightly up-left in snarling recoil!
        snout_x = hx - 13
        snout_y = hy + 1
        head_poly = [
            (hx + 6,      hy - 6),
            (hx,          hy - 6),
            (hx - 4,      hy - 3),
            (snout_x + 1, snout_y - 1),
            (snout_x,     snout_y),
            (snout_x + 2, snout_y + 1),
            (hx - 5,      hy + 3),
            (hx + 4,      hy + 5),
            (hx + 8,      hy),
        ]
    else:
        snout_x = hx - 12
        snout_y = hy + 4
        head_poly = [
            (hx + 6,      hy - 6),
            (hx,          hy - 6),
            (hx - 4,      hy - 2),
            (snout_x + 1, snout_y - 1),
            (snout_x,     snout_y),
            (snout_x + 1, snout_y + 2),
            (hx - 4,      hy + 5),
            (hx + 4,      hy + 5),
            (hx + 8,      hy),
        ]
    sp.polygon(head_poly, FUR_MID, fill=True)

    # Lit top-left brow & narrow snout bridge highlight
    sp.line(hx + 1, hy - 6, hx - 4, hy - (3 if pose == "hurt" else 2), FUR_HI1)
    sp.line(hx - 4, hy - (3 if pose == "hurt" else 2), snout_x + 2, snout_y - 1, FUR_HI1)
    sp.line(hx - 3, hy - (3 if pose == "hurt" else 2), snout_x + 3, snout_y - 1, FUR_HI2)
    sp.line(hx, hy - 5, hx - 3, hy - 3, FUR_HI2)

    # Deep cheek & lower muzzle shadow
    sp.polygon([
        (hx - 3, hy + 2),
        (hx + 6, hy),
        (hx + 4, hy + 5),
        (hx - 4, hy + 5),
    ], FUR_SH1, fill=True)
    sp.line(snout_x + 2, snout_y + (1 if pose == "hurt" else 2), hx - 3, hy + 5, FUR_SH2)

    # Sharp black nose tip
    sp.px(snout_x, snout_y, INK_VOID)
    sp.px(snout_x + 1, snout_y, INK_VOID)
    sp.px(snout_x + 1, snout_y - 1, FUR_SH2)

    # Jaws & crisp gleaming fangs
    if pose == "hurt":
        # Sleek open snarling recoil jaw with crisp negative-space mouth V!
        sp.polygon([
            (snout_x + 3, snout_y + 1),
            (hx - 4,      hy + 3),
            (hx - 3,      hy + 6),
            (snout_x + 5, snout_y + 4),
        ], INK_VOID, fill=True)
        sp.px(hx - 5, hy + 4, MAW_PLUM)
        sp.line(snout_x + 4, snout_y + 4, hx - 2, hy + 6, FUR_SH1)
        sp.line(snout_x + 5, snout_y + 5, hx,     hy + 6, FUR_SH2)
        sp.px(snout_x + 3, snout_y + 2, PURE_WHT)
        sp.px(snout_x + 6, snout_y + 2, CRY_WHT)
        sp.px(snout_x + 5, snout_y + 3, CRY_WHT)
    elif pose in ("windup", "strike"):
        jaw_drop = 3 if pose == "strike" else 2
        sp.polygon([
            (snout_x + 2, snout_y + 1),
            (hx - 3,      hy + 4),
            (hx - 2,      hy + 5 + jaw_drop),
            (snout_x + 3, snout_y + 2 + jaw_drop),
        ], INK_VOID, fill=True)
        sp.px(hx - 5, hy + 5, MAW_PLUM)
        sp.px(hx - 4, hy + 5, MAW_PLUM)
        sp.line(snout_x + 3, snout_y + 2 + jaw_drop, hx - 1, hy + 5 + jaw_drop, FUR_SH1)
        sp.line(snout_x + 4, snout_y + 3 + jaw_drop, hx + 1, hy + 5 + jaw_drop, FUR_SH2)
        sp.px(snout_x + 3, snout_y + 2, PURE_WHT)
        sp.px(snout_x + 3, snout_y + 3, CRY_WHT)
        sp.px(snout_x + 6, snout_y + 2, PURE_WHT)
        sp.px(snout_x + 4, snout_y + 1 + jaw_drop, CRY_WHT)
    else:
        sp.line(snout_x + 2, snout_y + 2, hx - 4, hy + 4, INK_VOID)
        sp.px(snout_x + 4, snout_y + 2, CRY_WHT)

    # 3) TALL NEAR JACKAL EAR
    near_tip_x = hx + 9 + ear_pin_x
    near_tip_y = hy - 19 + ear_pin_y + ear_flick
    near_ear = [
        (hx + 2, hy - 5),
        (near_tip_x, near_tip_y),
        (hx + 8, hy - 2),
    ]
    sp.polygon(near_ear, FUR_MID, fill=True)
    inner_ear = [
        (hx + 4, hy - 5),
        (near_tip_x - 1, near_tip_y + 4),
        (hx + 7, hy - 3),
    ]
    sp.polygon(inner_ear, SMK_DARK, fill=True)
    sp.line(hx + 5, hy - 5, near_tip_x - 2, near_tip_y + 6, INK_VOID)
    sp.line(hx + 2, hy - 5, near_tip_x, near_tip_y, FUR_HI1)
    sp.line(hx + 3, hy - 6, near_tip_x - 1, near_tip_y + 2, FUR_HI2)
    sp.px(hx + 3, hy - 4, FUR_HI1)
    sp.px(hx + 4, hy - 4, FUR_MID)

    # 4) FOREHEAD FROST DIAMOND CREST
    sp.px(hx - 2, hy - 4, CRY_HI)
    sp.px(hx - 2, hy - 3, PURE_WHT)

    # 5) BLAZING ELECTRIC-CYAN PREDATOR EYES IN DEEP DARK INK MASK!
    ex, ey = hx - 2, hy + 1
    fx, fy = hx - 7, hy + 1

    if pose == "blink":
        # Razor-narrow gleaming cyan assassin slit eye!
        hspan(sp, ey - 1, ex - 2, ex + 2, INK_VOID)
        hspan(sp, ey + 1, ex - 2, ex + 2, INK_VOID)
        hspan(sp, ey, ex - 2, ex + 2, CYN_MID)
        hspan(sp, ey, ex - 1, ex + 1, CYN_HI)
        sp.px(ex, ey, PURE_WHT)
        sp.px(fx - 1, fy, INK_VOID)
        sp.px(fx, fy, PURE_WHT)
        sp.px(fx + 1, fy, CYN_HI)
        sp.px(ex + 2, ey - 1, CYN_HI)
        sp.px(ex + 3, ey - 2, CYN_HI)
        sp.px(ex + 4, ey - 3, PURE_WHT)
    elif pose == "hurt":
        # Fierce predator `>` wincing squint!
        sp.polygon([(ex - 2, ey - 1), (ex + 2, ey - 1), (ex + 1, ey + 2), (ex - 2, ey + 2)],
                   INK_VOID, fill=True)
        sp.px(ex - 1, ey - 1, CYN_HI)
        sp.px(ex,     ey,     PURE_WHT)
        sp.px(ex - 1, ey + 1, CYN_MID)
        sp.px(ex + 1, ey,     CYN_DEEP)
        sp.px(fx, fy, CYN_MID)
        sp.px(fx - 1, fy, INK_VOID)
    else:
        intense = pose in ("windup", "strike")
        sp.polygon([(ex - 3, ey + 1), (ex - 1, ey - 1), (ex + 3, ey - 2),
                    (ex + 2, ey + 1), (ex - 1, ey + 2)], INK_VOID, fill=True)
        sp.px(ex - 2, ey + 1, CYN_MID)
        sp.px(ex - 1, ey,     CYN_HI)
        sp.px(ex,     ey,     PURE_WHT)
        sp.px(ex + 1, ey - 1, PURE_WHT if intense else CYN_HI)
        sp.px(ex + 1, ey,     CYN_MID)
        sp.px(ex,     ey + 1, CYN_HI if intense else CYN_MID)
        # Sleek tapered electric-cyan brow flame sweeping up-right!
        sp.px(ex + 2, ey - 2, CYN_HI if intense else CYN_MID)
        sp.px(ex + 3, ey - 3, CYN_MID)
        sp.px(ex + 4, ey - 4, CYN_HI if intense else CYN_DEEP)
        if intense:
            sp.px(ex + 5, ey - 5, CYN_HI)
        sp.px(ex - 1, ey + 2, CYN_DEEP)
        sp.px(ex - 2, ey + 3, CYN_MID if intense else CYN_DEEP)

        # Far eye (crisp 3/4 glowing glimpse on left muzzle edge)
        sp.px(fx - 1, fy,     INK_VOID)
        sp.px(fx,     fy - 1, INK_VOID)
        sp.px(fx,     fy,     PURE_WHT)
        sp.px(fx + 1, fy,     CYN_HI)
        sp.px(fx,     fy + 1, CYN_MID)

    # 6) REFINED ICY CRYSTAL CHEEK-FINS
    glow_ck = pose in ("windup", "strike")
    draw_crystal_blade(sp, hx + 4, hy + 2, hx + 10, hy - 1, 1.1, glow=glow_ck)
    draw_crystal_blade(sp, hx + 4, hy + 4, hx + 9,  hy + 4, 1.0, glow=glow_ck)
    sp.line(hx + 3, hy + 5, hx + 6, hy + 7, CRY_HI)
    sp.px(hx + 6, hy + 7, CRY_WHT)
    sp.px(hx - 6, hy + 3, CRY_MID)
    sp.px(hx - 7, hy + 2, CRY_HI)
    sp.px(hx - 8, hy + 2, CRY_WHT)

    return (hx, hy)


def draw_fx(sp: Sprite, ox: int, oy: int, pose: str, claw_tip: tuple[int, int]):
    """Pure pixel combat VFX layer (no muddy dark outlines around luminous cyan energy!)."""
    sp.layer("fx")

    if pose == "blink":
        # Crisp assassin predator eye-gleam star flare (4-way connected!)
        gx, gy = ox + 18, oy + 33
        hspan(sp, gy, gx - 4, gx + 5, CYN_MID)
        hspan(sp, gy, gx - 2, gx + 3, CYN_HI)
        sp.px(gx, gy - 2, CYN_MID)
        sp.px(gx, gy - 1, CYN_HI)
        sp.px(gx, gy + 1, CYN_HI)
        sp.px(gx, gy + 2, CYN_MID)
        sp.px(gx, gy, PURE_WHT)
        sp.px(gx + 1, gy, PURE_WHT)

    elif pose == "windup":
        # Coiled electric-cyan energy arc tightly framing the lowered raised slashing paw!
        cx, cy = claw_tip
        for (dx, dy, col) in [
            (-1, -3, CYN_MID), (-2, -3, CYN_MID), (-2, -2, CYN_HI), (-3, -2, CYN_MID),
            (-3, -1, CYN_HI),  (-3,  0, PURE_WHT), (-2,  0, CYN_HI), (-3,  1, CYN_HI),
            (-3,  2, CYN_MID), (-2,  2, CYN_HI),  (-2,  3, CYN_MID), (-1,  3, CYN_MID),
        ]:
            sp.px(cx + dx, cy + dy, col)

        # Blazing cyan diamond flash at dominant withers blade tip!
        tx, ty = ox + 46, oy + 4
        hspan(sp, ty, tx - 2, tx + 2, CYN_HI)
        sp.px(tx, ty - 2, CYN_MID)
        sp.px(tx, ty - 1, CYN_HI)
        sp.px(tx, ty + 1, CYN_HI)
        sp.px(tx, ty + 2, CYN_MID)
        sp.px(tx, ty, PURE_WHT)

        # Electric cyan charge-trail streaming cleanly off glaring brow!
        for (px_s, py_s, col) in [
            (ox + 25, oy + 30, CYN_HI),  (ox + 26, oy + 30, CYN_MID),
            (ox + 26, oy + 29, CYN_HI),  (ox + 27, oy + 29, CYN_MID),
            (ox + 27, oy + 28, CYN_HI),  (ox + 28, oy + 28, CYN_MID),
            (ox + 28, oy + 27, PURE_WHT),(ox + 29, oy + 27, CYN_HI),
        ]:
            sp.px(px_s, py_s, col)

    elif pose == "strike":
        # BLAZING ELECTRIC-CYAN TRIPLE-CLAW SLASH CRESCENT CLEANLY TO THE LEFT OF FACE & CLAWS!
        # Sweeps through x = 1..14, y = 21..59 — zero overlap on snout tip, erupting straight off claws!
        def _draw_slash_arc(cx0: float, cy0: float, rx: float, ry: float,
                            a0: float, a1: float, thick: float,
                            c_out: str, c_mid: str, c_in: str):
            steps = 68
            prev = None
            for i in range(steps + 1):
                t = i / steps
                ang = a0 + (a1 - a0) * t
                w = thick * (math.sin(t * math.pi) ** 0.72)
                ix = int(round(cx0 + math.cos(ang) * rx))
                iy = int(round(cy0 + math.sin(ang) * ry))
                centers = []
                if prev is not None and abs(ix - prev[0]) == 1 and abs(iy - prev[1]) == 1 and w < 0.75:
                    centers.append((ix, prev[1]))
                centers.append((ix, iy))
                prev = (ix, iy)
                ri = max(0, int(round(w)))
                for pcx, pcy in centers:
                    for dy in range(-ri, ri + 1):
                        for dx in range(-ri, ri + 1):
                            d = math.hypot(dx, dy)
                            if d <= w + 0.2:
                                xx, yy = pcx + dx, pcy + dy
                                if 1 <= xx <= W - 2 and 1 <= yy <= H - 2:
                                    if d <= w * 0.36 and 0.14 < t < 0.86:
                                        sp.px(xx, yy, c_in)
                                    elif d <= w * 0.72:
                                        sp.px(xx, yy, c_mid)
                                    else:
                                        sp.px(xx, yy, c_out)

        # Primary outer claw arc (carves furthest left to x=2!)
        _draw_slash_arc(16.0, 40.5, 14.2, 18.8, math.radians(126), math.radians(242),
                        1.85, CYN_DEEP, CYN_MID, PURE_WHT)
        # Middle parallel razor claw arc
        _draw_slash_arc(17.5, 41.0, 11.6, 15.8, math.radians(132), math.radians(238),
                        1.30, CYN_MID, CYN_HI, PURE_WHT)
        # Inner quick claw trail whipping directly from the extended ice talons!
        _draw_slash_arc(18.5, 42.0, 9.0, 12.2, math.radians(140), math.radians(232),
                        0.95, CYN_DEEP, CYN_HI, PURE_WHT)

        # Connected razor burst streaks at slash apex
        hspan(sp, 37, 1, 4, CYN_HI)
        sp.px(2, 37, PURE_WHT)
        hspan(sp, 45, 2, 5, CYN_MID)
        sp.px(3, 45, CYN_HI)

        # Tapered aerodynamic speed-streak trailing high behind spine blades!
        hspan(sp, oy + 20, ox + 65, ox + 76, CYN_DEEP)
        hspan(sp, oy + 20, ox + 67, ox + 73, CYN_MID)
        hspan(sp, oy + 20, ox + 69, ox + 71, CYN_HI)

    elif pose == "hurt":
        # Subtle crisp skid-frost dust puff right behind skidding front paw (zero floating icons!)
        sx, sy = ox + 17, GROUND_Y
        hspan(sp, sy, sx, sx + 3, CRY_HI)
        hspan(sp, sy - 1, sx + 1, sx + 2, CRY_WHT)


# ---------------------------------------------------------------------------
# Selective Material- & Light-Aware Outer Outline
# ---------------------------------------------------------------------------

def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected selective outer outline:
    - Excludes 'fx' AND 'shadow_smoke' so phantom shadow-mist & cyan energy stay luminous & ethereal!
    - Crystal spine blades & ice claws -> deep sapphire INK_ICE on lit edges, INK_VOID in crevices
    - Midnight-indigo fur body, ears & limbs -> INK_VOID on shadow sides, FUR_SH1 on sunlit top-left curves
    """
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_cel = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_cel.load()

    solid_layers = [ln for ln in sp.layer_order if ln not in ("fx", "outline", "shadow_smoke")]
    solid_pxs = {ln: sp.frames[frame_idx - 1].cels[ln].load() for ln in solid_layers}

    rgba_void = hex2rgba(INK_VOID)
    rgba_fur1 = hex2rgba(FUR_SH1)
    rgba_ice  = hex2rgba(INK_ICE)

    cry_rgbs = {
        hex2rgba(CRY_WHT)[:3], hex2rgba(CRY_HI)[:3], hex2rgba(CRY_MID)[:3],
        hex2rgba(CRY_SH)[:3], hex2rgba(PURE_WHT)[:3], hex2rgba(CYN_HI)[:3],
        hex2rgba(CYN_MID)[:3],
    }
    fur_hi_rgbs = {hex2rgba(FUR_HI2)[:3], hex2rgba(FUR_HI1)[:3]}

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            nbrs = []
            layers_hit = set()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    hit_ln = None
                    for ln in reversed(solid_layers):
                        if solid_pxs[ln][nx, ny][3] > 0:
                            hit_ln = ln
                            break
                    if hit_ln is not None:
                        nbrs.append((dx, dy, src[nx, ny][:3], hit_ln))
                        layers_hit.add(hit_ln)
            if not nbrs:
                continue

            is_top_left = any(dx == 1 or dy == 1 for dx, dy, _, _ in nbrs) and not any(
                dy == -1 for _, dy, _, _ in nbrs
            )
            rgb_list = [rgb for _, _, rgb, _ in nbrs]

            if any(rgb in cry_rgbs for rgb in rgb_list) and (
                "spines" in layers_hit or any(rgb in (hex2rgba(CRY_WHT)[:3], hex2rgba(CRY_HI)[:3]) for rgb in rgb_list)
            ):
                dst[x, y] = rgba_ice if (is_top_left or "spines" in layers_hit) else rgba_void
            elif is_top_left and any(rgb in fur_hi_rgbs for rgb in rgb_list) and y < 44:
                dst[x, y] = rgba_fur1
            else:
                dst[x, y] = rgba_void


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

# (pose, dx, bob, ripple, duration_ms)
FRAME_SPECS = [
    ("idle1",   0,  0, 0, 240),
    ("idle2",   0, -1, 1, 240),
    ("blink",   0,  0, 0, 150),
    ("windup",  3,  1, 1, 180),
    ("strike",  0,  0, 0, 150),
    ("hurt",    4,  0, 0, 220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "shadow_smoke",
        "far_limbs",
        "tail",
        "body",
        "spines",
        "near_limbs",
        "head",
        "fx",
    ]
    sp.frames[0].cels = {ln: sp._blank() for ln in sp.layer_order}

    for _ in range(1, N_FRAMES):
        sp.add_frame(copy=False)

    anchors = {}

    for idx, (pose, dx, bob, ripple, dur) in enumerate(FRAME_SPECS, start=1):
        sp.frame(idx)
        sp.set_duration(dur)

        ox = dx
        oy = bob

        draw_shadow_smoke(sp, ox, oy, pose, ripple)
        draw_far_limbs(sp, ox, oy, pose)
        draw_tail(sp, ox, oy, pose, ripple)
        draw_body(sp, ox, oy, pose)
        draw_spines(sp, ox, oy, pose)
        claw_tip = draw_near_limbs(sp, ox, oy, pose)
        head_center = draw_head(sp, ox, oy, pose)
        draw_fx(sp, ox, oy, pose, claw_tip)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (head_center[0], head_center[1])
            anchors["hit_px"] = (ox + 42, oy + 36)
        if pose == "strike":
            anchors["cast_px"] = (3, 40)

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


def render_silhouette_strip(sp: Sprite, path: str, scale: int = 4):
    fw, fh = W * scale, H * scale
    sep = 6
    out = Image.new("RGB", (N_FRAMES * fw + (N_FRAMES + 1) * sep, fh + 2 * sep), (236, 232, 222))
    fg = (24, 28, 42)
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


def render_head_zoom(sp: Sprite, path: str, scale: int = 10):
    x0, y0, x1, y1 = 1, 6, 48, 48
    cw, ch = (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale
    sep = 4
    out = Image.new("RGB", (N_FRAMES * cw + (N_FRAMES + 1) * sep, ch + 2 * sep), (42, 52, 75))
    for i in range(N_FRAMES):
        crop = sp.composite(i + 1).crop((x0, y0, x1 + 1, y1 + 1)).resize((cw, ch), NEAREST)
        out.paste(crop, (sep + i * (cw + sep), sep), crop)
    out.save(path)
    print(f"head_zoom -> {path}")


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
    assert not iso_all, f"Isolated px found: {iso_all}"

    # Verify zero border clipping (1px safety margin on all 4 edges across all 6 frames!)
    for fi in range(1, N_FRAMES + 1):
        im = sp.composite(fi)
        px_data = im.load()
        edge_hits = []
        for x in range(W):
            if px_data[x, 0][3] > 0:
                edge_hits.append((x, 0))
            if px_data[x, H - 1][3] > 0:
                edge_hits.append((x, H - 1))
        for y in range(H):
            if px_data[0, y][3] > 0:
                edge_hits.append((0, y))
            if px_data[W - 1, y][3] > 0:
                edge_hits.append((W - 1, y))
        assert not edge_hits, f"Frame {fi} touches canvas border at {edge_hits[:6]}"

    # Verify exact paw baseline lock on GROUND_Y for idle frames 1..3
    for fi in (1, 2, 3):
        near_cel = sp.frames[fi - 1].cels["near_limbs"]
        far_cel = sp.frames[fi - 1].cels["far_limbs"]
        ys_n = [y for y in range(H) for x in range(W) if near_cel.getpixel((x, y))[3] > 0]
        ys_f = [y for y in range(H) for x in range(W) if far_cel.getpixel((x, y))[3] > 0]
        assert max(ys_n) == GROUND_Y, f"Frame {fi} near paw baseline {max(ys_n)} != {GROUND_Y}"
        assert max(ys_f) == GROUND_Y, f"Frame {fi} far paw baseline {max(ys_f)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "shadow_jackal",
        "file": "assets/sprites/shadow_jackal_sheet.png",
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
        "buildScript": "tools/pixel_art/shadow_jackal/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=4)
    render_head_zoom(sp, HEAD_ZOOM_PATH, scale=10)


if __name__ == "__main__":
    main()
