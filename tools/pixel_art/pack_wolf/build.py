#!/usr/bin/env python3
"""HD anime pixel-art combat sprite builder for Frost-Spine Pack Wolf (pack_wolf).

100% deterministic pixel-by-pixel authoring via pixelstudio.py.
Canvas: 80 x 64, 6 horizontal frames (480 x 64 sheet, padding=0).
Facing: left. GROUND_Y = 58, PIVOT_X = 41.

Pass 3 (Final Jewelry-Grade Polish):
- Translucent crystalline selective outlines (ICE_SH1 / ICE_SH2 lit edges + INK_ICE shadow undersides)
  on 7 organically clustered, varied-height swept-back frost spines (zero uniform comb teeth, zero antlers!)
- Widened sculpted wolf ears with rich dark inner cavities + crisp double-ear silhouette across all 6 frames
- Refined snarling upper lip & overlapping razor canines; dramatic upward yelping jaw + crisp `>` wince on hurt
- Strike frost-claw slash cleanly decoupled from jaws (erupting strictly from slashing forepaw + separate fang glint!)
- Sleek anatomical muscle creases, streamlined elbow tuft, smooth feathery multi-plume wolf tail,
  and strict margin + baseline + zero-noise assertions across all 6 frames
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
W, H = 80, 64
N_FRAMES = 6
GROUND_Y = 58
PIVOT_X = 41

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SPRITES_DIR = os.path.join(ROOT, "assets", "sprites")

SHEET_PATH = os.path.join(SPRITES_DIR, "pack_wolf_sheet.png")
META_PATH = os.path.join(SPRITES_DIR, "pack_wolf_meta.json")
PREVIEW_PATH = os.path.join(HERE, "preview.png")
PREVIEW_BG_PATH = os.path.join(HERE, "preview_bg.png")
SILHOUETTE_PATH = os.path.join(HERE, "silhouette.png")
HEAD_ZOOM_PATH = os.path.join(HERE, "head_zoom.png")

# ---------------------------------------------------------------------------
# Master 20-Color Hue-Shifted Winter-Wolf JRPG Palette (zero near-duplicates!)
# ---------------------------------------------------------------------------
PURE_WHT = "#ffffff"  # Crystal razor specular edge, fang gleam, eye spark, slash core
FUR_HI   = "#edf3fc"  # Sunlit snow-white mane ruff, cheek fluff, lit ridges & tail brush
FUR_LT   = "#c5d1e6"  # Cool silver-white upper coat, lit near limbs, ruff midtone
FUR_MID  = "#8b9cb8"  # Sleek silver-blue wolf coat base (flanks, back, thighs, tail)
FUR_SH1  = "#5c6d91"  # Cool slate-blue coat shadow, far legs midtone, lit fur selout
FUR_SH2  = "#3a4a6e"  # Deep indigo-slate underbelly, muscle crease & far-limb core shadow

INK_DARK = "#141a2e"  # Cold midnight-indigo shadow outline, nose, claws, brow, ear hollow
INK_MID  = "#273352"  # Cool steel-indigo mid-lit selective outline
INK_ICE  = "#143c7a"  # Deep glacier-sapphire shadowed crystal outline
CLAW_HI  = "#4d5e80"  # Specular sheen on dark claws & wet nose tip

ICE_HI   = "#c4f4ff"  # Luminous pale-cyan crystal lit facet
ICE_MID  = "#66c2f5"  # Vivid sky-frost crystal body facet
ICE_SH1  = "#2e82d4"  # Glacial azure crystal shadow facet & lit crystal tip selout
ICE_SH2  = "#1a54a1"  # Deep crystalline frost base facet & mid crystal selout

EYE_GLOW = "#fff096"  # Blazing pale-gold eye glint
EYE_AMB  = "#ff9421"  # Glowing fiery amber inner iris
EYE_RED  = "#eb2236"  # Fierce crimson-red wolf eye core
EYE_DRK  = "#8a1426"  # Deep blood-crimson mouth interior & dark eye rim
MAW_PNK  = "#c44d62"  # Snarling inner gum / tongue accent
FANG_SH  = "#d6cfc2"  # Warm ivory fang shading

PALETTE = [
    PURE_WHT, FUR_HI, FUR_LT, FUR_MID, FUR_SH1, FUR_SH2,
    INK_DARK, INK_MID, INK_ICE, CLAW_HI,
    ICE_HI, ICE_MID, ICE_SH1, ICE_SH2,
    EYE_GLOW, EYE_AMB, EYE_RED, EYE_DRK, MAW_PNK, FANG_SH,
]

# ---------------------------------------------------------------------------
# Geometry & Shading Helpers
# ---------------------------------------------------------------------------

def hspan(sp: Sprite, y: int, x0: int, x1: int, col: str, only=None):
    if x1 < x0:
        x0, x1 = x1, x0
    for x in range(int(x0), int(x1) + 1):
        sp.px(x, int(y), col, only=only)


def bezier(p0, p1, p2, steps=24):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1.0 - t
        x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
        y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def draw_capsule(sp: Sprite, x0: float, y0: float, x1: float, y1: float,
                 r0: float, r1: float, col: str, only=None):
    """Smooth tapered capsule between (x0,y0) radius r0 and (x1,y1) radius r1."""
    dx, dy = x1 - x0, y1 - y0
    dist = math.hypot(dx, dy)
    steps = max(2, int(math.ceil(dist * 2.5)))
    for i in range(steps + 1):
        t = i / steps
        cx = x0 + dx * t
        cy = y0 + dy * t
        r = r0 + (r1 - r0) * t
        ir = int(math.ceil(r))
        r2 = r * r
        for py in range(int(math.floor(cy - ir)), int(math.ceil(cy + ir)) + 1):
            for px in range(int(math.floor(cx - ir)), int(math.ceil(cx + ir)) + 1):
                if (px - cx) ** 2 + (py - cy) ** 2 <= r2 + 0.12:
                    sp.px(px, py, col, only=only)


def draw_shaded_limb_seg(sp: Sprite, p0, p1, r0: float, r1: float,
                         c_hi: str, c_mid: str, c_sh: str, light_dir=(-0.75, -0.65)):
    """Directional top-left shaded sleek limb segment."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    dist = max(0.001, math.hypot(dx, dy))
    nx, ny = -dy / dist, dx / dist
    if nx * light_dir[0] + ny * light_dir[1] < 0:
        nx, ny = -nx, -ny

    draw_capsule(sp, x0, y0, x1, y1, r0, r1, c_mid)
    steps = max(2, int(math.ceil(dist * 2.5)))
    for i in range(steps + 1):
        t = i / steps
        cx = x0 + dx * t
        cy = y0 + dy * t
        r = r0 + (r1 - r0) * t
        ir = int(math.ceil(r))
        r2 = r * r
        for py in range(int(math.floor(cy - ir)), int(math.ceil(cy + ir)) + 1):
            for px in range(int(math.floor(cx - ir)), int(math.ceil(cx + ir)) + 1):
                ox, oy = px - cx, py - cy
                if ox * ox + oy * oy <= r2 + 0.12:
                    proj = (ox * nx + oy * ny) / max(0.5, r)
                    if proj > 0.30:
                        sp.px(px, py, c_hi)
                    elif proj < -0.32:
                        sp.px(px, py, c_sh)


def draw_razor_ice_spine(sp: Sprite, bx: float, by: float, tx: float, ty: float,
                         base_w: float, bend: float = 0.0, far: bool = False):
    """Razor-sharp curved crystalline ice blade tapering cleanly to a gleaming 1px needle tip."""
    # Clamp tip safely inside canvas margin (y >= 2, x <= W - 3)
    ty = max(2.0, ty)
    tx = min(W - 3.0, tx)
    mx = (bx + tx) * 0.5
    my = (by + ty) * 0.5 - bend
    steps = max(14, int(math.hypot(tx - bx, ty - by) * 2.6))
    pts = bezier((bx, by), (mx, my), (tx, ty), steps=steps)

    for i, (cx, cy) in enumerate(pts):
        t = i / (len(pts) - 1)
        if i < len(pts) - 1:
            dx = pts[i + 1][0] - cx
            dy = pts[i + 1][1] - cy
        else:
            dx = cx - pts[i - 1][0]
            dy = cy - pts[i - 1][1]
        dlen = max(0.001, math.hypot(dx, dy))
        nx, ny = -dy / dlen, dx / dlen
        if nx * (-0.7) + ny * (-0.7) < 0:
            nx, ny = -nx, -ny

        if t > 0.74:
            px, py = int(round(cx)), int(round(cy))
            col = ICE_HI if far else (PURE_WHT if t > 0.84 else ICE_HI)
            sp.px(px, py, col)
            continue

        hw = max(0.38, base_w * ((1.0 - t) ** 1.18))
        n_samp = max(1, int(math.ceil(hw * 2.5)))
        for s_i in range(-n_samp, n_samp + 1):
            u = s_i / max(1, n_samp)
            px = int(round(cx + nx * (u * hw)))
            py = int(round(cy + ny * (u * hw)))
            if far:
                if u > 0.35:
                    col = ICE_MID if t < 0.52 else ICE_HI
                elif u > -0.25:
                    col = ICE_SH1
                else:
                    col = ICE_SH2
            else:
                if u > 0.44:
                    col = PURE_WHT if t > 0.16 else ICE_HI
                elif u > -0.06:
                    col = ICE_HI if t > 0.36 else ICE_MID
                elif u > -0.55:
                    col = ICE_MID if t > 0.52 else ICE_SH1
                else:
                    col = ICE_SH2
            sp.px(px, py, col)


def draw_fur_tuft(sp: Sprite, bx: int, by: int, tx: int, ty: int,
                  w: float, c_lit: str, c_mid: str, c_sh: str):
    """Crisp sculpted triangular fur lock pointing from base (bx,by) to tapered tip (tx,ty)."""
    dx, dy = tx - bx, ty - by
    dlen = max(1.0, math.hypot(dx, dy))
    nx, ny = -dy / dlen, dx / dlen
    if nx * (-0.7) + ny * (-0.7) < 0:
        nx, ny = -nx, -ny
    p1 = (int(round(bx + nx * w)), int(round(by + ny * w)))
    p2 = (int(round(bx - nx * w)), int(round(by - ny * w)))
    sp.polygon([p1, (tx, ty), p2], c_mid, fill=True)
    sp.line(p1[0], p1[1], tx, ty, c_lit)
    sp.line(p2[0], p2[1], tx, ty, c_sh)


def draw_paw(sp: Sprite, px: int, py: int, is_far: bool, angle: str = "flat"):
    """Sleek agile clawed wolf paw resting at y = py (ground contact) facing LEFT."""
    c_hi = FUR_MID if is_far else FUR_HI
    c_mid = FUR_SH1 if is_far else FUR_LT
    c_sh = FUR_SH2 if is_far else FUR_MID

    if angle == "slash":
        # Dynamic swiping outstretched clawed forepaw!
        sp.polygon([
            (px - 2, py - 2), (px + 2, py - 2),
            (px + 3, py + 1), (px - 1, py + 2),
        ], c_mid, fill=True)
        sp.line(px - 2, py - 2, px + 2, py - 2, c_hi)
        sp.line(px - 1, py + 1, px + 2, py + 1, c_sh)
        # 3 fanned dark razor claws hooking forward-left into the frost slash!
        sp.px(px - 3, py - 1, CLAW_HI if not is_far else INK_DARK)
        sp.px(px - 4, py, INK_DARK)
        sp.px(px - 3, py + 1, CLAW_HI if not is_far else INK_DARK)
        sp.px(px - 4, py + 2, INK_DARK)
        sp.px(px - 2, py + 2, INK_DARK)
        sp.px(px - 2, py + 3, INK_DARK)
        return

    if angle == "lift":
        # Recoiled tucked paw lifted cleanly off snow (hurt/leap trailing)
        sp.polygon([
            (px - 2, py - 1), (px + 2, py - 2),
            (px + 2, py + 1), (px - 1, py + 2),
        ], c_mid, fill=True)
        sp.px(px - 1, py - 1, c_hi)
        sp.px(px + 1, py - 2, c_hi)
        sp.px(px + 1, py + 1, c_sh)
        sp.px(px - 3, py, INK_DARK)
        sp.px(px - 3, py + 1, INK_DARK)
        sp.px(px - 2, py + 2, INK_DARK)
        return

    if angle == "kick":
        # Extended push-off hind paw angled downward-left on GROUND_Y
        hspan(sp, py - 2, px - 1, px + 2, c_mid)
        hspan(sp, py - 1, px - 2, px + 2, c_mid)
        hspan(sp, py, px - 2, px + 1, c_sh)
        sp.px(px - 1, py - 2, c_hi)
        sp.px(px - 2, py - 1, c_hi)
        sp.px(px - 3, py - 1, CLAW_HI if not is_far else INK_DARK)
        sp.px(px - 4, py, INK_DARK)
        sp.px(px - 3, py, INK_DARK)
        return

    # Flat planted agile wolf paw squarely locked to y = py
    hspan(sp, py - 2, px - 1, px + 2, c_mid)
    hspan(sp, py - 2, px - 1, px, c_hi)
    hspan(sp, py - 1, px - 3, px + 2, c_mid)
    hspan(sp, py - 1, px - 3, px - 1, c_hi)
    sp.px(px + 2, py - 1, c_sh)
    hspan(sp, py, px - 3, px + 2, c_sh)
    sp.px(px - 2, py, c_mid)
    sp.px(px, py, c_mid)
    # 2-3 sharp curved dark wolf claws extending left!
    sp.px(px - 4, py - 1, CLAW_HI if not is_far else INK_DARK)
    sp.px(px - 5, py, INK_DARK)
    sp.px(px - 4, py, INK_DARK)
    sp.px(px - 2, py, INK_DARK)


def draw_frost_greave(sp: Sprite, ax: int, ay: int, is_far: bool):
    """Sleek tapered crystalline frost wrap & swept-back ice barb on lower shin/wrist."""
    c_edge = ICE_HI if not is_far else ICE_MID
    c_body = ICE_MID if not is_far else ICE_SH1
    c_sh = ICE_SH1 if not is_far else ICE_SH2
    # Narrow crystal wrap hugging shin
    sp.px(ax - 1, ay - 2, c_edge)
    sp.px(ax, ay - 2, c_body)
    sp.px(ax - 1, ay - 1, PURE_WHT if not is_far else c_edge)
    sp.px(ax, ay - 1, c_edge)
    sp.px(ax + 1, ay - 1, c_sh)
    sp.px(ax, ay, c_body)
    sp.px(ax + 1, ay, c_sh)
    # Sleek tapered 2px -> 1px swept-back frost barb
    sp.px(ax + 1, ay - 2, c_body)
    sp.px(ax + 2, ay - 2, c_edge)
    sp.px(ax + 2, ay - 3, PURE_WHT if not is_far else c_edge)
    if not is_far:
        sp.px(ax + 3, ay - 3, ICE_MID)


def apply_selective_outline(sp: Sprite, frame_idx: int):
    """4-connected material- & light-aware selective outer outline.
    Translucent glacier-blue selout on lit ice spine edges; cool indigo on shadowed forms."""
    comp = sp.composite(frame_idx)
    src = comp.load()
    out_layer = sp.frames[frame_idx - 1].cels["outline"]
    dst = out_layer.load()

    rgba_ink_dark = hex2rgba(INK_DARK)
    rgba_ink_mid  = hex2rgba(INK_MID)
    rgba_ink_ice  = hex2rgba(INK_ICE)
    rgba_ice_sh2  = hex2rgba(ICE_SH2)
    rgba_ice_sh1  = hex2rgba(ICE_SH1)
    rgba_fur_sh1  = hex2rgba(FUR_SH1)

    ice_lit_set = {hex2rgba(PURE_WHT)[:3], hex2rgba(ICE_HI)[:3]}
    ice_all_set = ice_lit_set | {hex2rgba(ICE_MID)[:3], hex2rgba(ICE_SH1)[:3], hex2rgba(ICE_SH2)[:3]}
    lit_fur_set = {hex2rgba(FUR_HI)[:3], hex2rgba(FUR_LT)[:3]}

    spine_layers = ("spines_near", "spines_far")
    spine_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in spine_layers]
    body_layers = [ln for ln in sp.layer_order if ln not in ("fx", "outline")]
    body_pxs = [sp.frames[frame_idx - 1].cels[ln].load() for ln in body_layers]

    for y in range(H):
        for x in range(W):
            if src[x, y][3] > 0:
                continue
            nbrs = []
            is_spine_nbr = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H:
                    if any(bp[nx, ny][3] > 0 for bp in body_pxs):
                        nbrs.append((dx, dy, src[nx, ny][:3]))
                        if any(sp_p[nx, ny][3] > 0 for sp_p in spine_pxs):
                            is_spine_nbr = True
            if not nbrs:
                continue

            is_top_left = (
                any(dx == 1 or dy == 1 for dx, dy, _ in nbrs)
                and not any(dy == -1 for _, dy, _ in nbrs)
            )
            rgb_list = [rgb for _, _, rgb in nbrs]

            if is_spine_nbr and any(rgb in ice_all_set for rgb in rgb_list):
                # Translucent gleaming crystal selout! Light azure on top-left lit tips, deep sapphire below!
                if is_top_left and any(rgb in ice_lit_set for rgb in rgb_list):
                    dst[x, y] = rgba_ice_sh1
                elif is_top_left:
                    dst[x, y] = rgba_ice_sh2
                else:
                    dst[x, y] = rgba_ink_ice
            elif is_top_left and y < 44 and all(rgb in lit_fur_set for rgb in rgb_list):
                dst[x, y] = rgba_fur_sh1
            elif is_top_left and any(rgb in lit_fur_set for rgb in rgb_list):
                dst[x, y] = rgba_ink_mid
            else:
                dst[x, y] = rgba_ink_dark


# ---------------------------------------------------------------------------
# Pose Rig Definitions (all 6 frames — sleek agile wolf proportions!)
# ---------------------------------------------------------------------------

def get_rig(pose: str):
    """Return complete sleek anatomical rig for each of the 6 battle frames."""
    r = {
        "head_cx": 19, "head_cy": 26,
        "head_tilt": 0,       # + = tilted up (hurt yelp), - = lowered prowl (windup)
        "mouth_open": 1,      # 0=closed, 1=snarl, 2=wide bite/yelp
        "ear_pin": 0,         # 0=upright alert, 2=ear twitch, 4=pinned hunter back
        "eye_mode": "fierce", # fierce | blink | blaze | wince

        "sh_x": 30, "sh_y": 29,       # Front shoulder center
        "mid_x": 43, "mid_y": 30,     # Sleek tucked flank/waist center
        "hip_x": 55, "hip_y": 30,     # Muscular hip/rump center

        # Wide predatory 4-leg stride matching pack_wolf.png!
        "ff_el": (23, 41), "ff_wr": (18, 51), "ff_paw": (15, 57), "ff_mode": "flat",
        "nf_el": (32, 41), "nf_wr": (30, 52), "nf_paw": (28, 58), "nf_mode": "flat",
        "fh_kn": (48, 41), "fh_hk": (51, 48), "fh_paw": (46, 57), "fh_mode": "flat",
        "nh_kn": (56, 40), "nh_hk": (63, 47), "nh_paw": (59, 58), "nh_mode": "flat",

        # Tail Bezier control points (base -> ctrl -> feathered tip)
        "tail_ctrl": (69, 34), "tail_tip": (74, 49),
        "spine_flare": 0.0,
        "spine_lean": 0.0,
    }

    if pose == "idle2":
        # Noticeable breathing chest bob (+1px) + livelier elevated tail wag!
        r["head_cy"] = 27
        r["sh_y"] = 30
        r["mid_y"] = 31
        r["hip_y"] = 30
        r["nf_el"] = (32, 42)
        r["ff_el"] = (23, 42)
        r["tail_ctrl"] = (70, 26)
        r["tail_tip"] = (76, 39)

    elif pose == "blink":
        # Natural eye blink + sharp canine ear twitch!
        r["eye_mode"] = "blink"
        r["ear_pin"] = 2
        r["mouth_open"] = 0
        r["tail_ctrl"] = (69, 32)
        r["tail_tip"] = (75, 47)

    elif pose == "windup":
        # Crouched coiled pounce! Low prowling forequarters, coiled hind springs, bristling spines!
        r["head_cx"] = 21
        r["head_cy"] = 33
        r["head_tilt"] = -1
        r["mouth_open"] = 1
        r["ear_pin"] = 4
        r["eye_mode"] = "blaze"

        r["sh_x"], r["sh_y"] = 33, 35
        r["mid_x"], r["mid_y"] = 46, 33
        r["hip_x"], r["hip_y"] = 58, 31

        r["ff_el"] = (27, 46)
        r["ff_wr"] = (22, 53)
        r["ff_paw"] = (18, 57)

        r["nf_el"] = (37, 46)
        r["nf_wr"] = (33, 53)
        r["nf_paw"] = (30, 58)

        r["fh_kn"] = (49, 43)
        r["fh_hk"] = (55, 49)
        r["fh_paw"] = (49, 57)

        r["nh_kn"] = (58, 42)
        r["nh_hk"] = (66, 48)
        r["nh_paw"] = (60, 58)

        r["tail_ctrl"] = (70, 24)
        r["tail_tip"] = (76, 32)
        r["spine_flare"] = 2.0

    elif pose == "strike":
        # Explosive leaping bite & frost-claw lunge LEFT!
        # Head poised high-forward at cx=19, cy=21 so snapping jaws stay cleanly ABOVE slashing forepaw!
        r["head_cx"] = 19
        r["head_cy"] = 21
        r["head_tilt"] = 0
        r["mouth_open"] = 2
        r["ear_pin"] = 5
        r["eye_mode"] = "blaze"

        r["sh_x"], r["sh_y"] = 30, 25
        r["mid_x"], r["mid_y"] = 43, 27
        r["hip_x"], r["hip_y"] = 54, 30

        # Far front leg tucked/trailing under chest
        r["ff_el"] = (25, 37)
        r["ff_wr"] = (21, 44)
        r["ff_paw"] = (18, 48)
        r["ff_mode"] = "lift"

        # Near front leg swiping aggressively OUT-LEFT driving the frost-claw crescent!
        r["nf_el"] = (28, 36)
        r["nf_wr"] = (20, 40)
        r["nf_paw"] = (13, 42)
        r["nf_mode"] = "slash"

        # Hind legs stretched powerfully pushing off GROUND_Y!
        r["fh_kn"] = (50, 42)
        r["fh_hk"] = (56, 49)
        r["fh_paw"] = (55, 57)
        r["fh_mode"] = "kick"

        r["nh_kn"] = (58, 42)
        r["nh_hk"] = (65, 50)
        r["nh_paw"] = (65, 58)
        r["nh_mode"] = "kick"

        # Tail streaming straight back like a winter banner!
        r["tail_ctrl"] = (66, 28)
        r["tail_tip"] = (76, 31)
        r["spine_lean"] = 2.5

    elif pose == "hurt":
        # Knocked back yelp! Muzzle snapped UP-LEFT, jaw wide open in yelp, near forepaw jolted high!
        r["head_cx"] = 25
        r["head_cy"] = 22
        r["head_tilt"] = 3
        r["mouth_open"] = 2
        r["ear_pin"] = 5
        r["eye_mode"] = "wince"

        r["sh_x"], r["sh_y"] = 36, 29
        r["mid_x"], r["mid_y"] = 47, 32
        r["hip_x"], r["hip_y"] = 57, 33

        # Far front leg braced forward against knockback
        r["ff_el"] = (29, 41)
        r["ff_wr"] = (24, 51)
        r["ff_paw"] = (21, 57)

        # Near front leg jolted UP-BACK cleanly clear of far foreleg!
        r["nf_el"] = (40, 40)
        r["nf_wr"] = (36, 45)
        r["nf_paw"] = (33, 47)
        r["nf_mode"] = "lift"

        r["fh_kn"] = (50, 43)
        r["fh_hk"] = (54, 49)
        r["fh_paw"] = (50, 57)

        r["nh_kn"] = (59, 43)
        r["nh_hk"] = (65, 50)
        r["nh_paw"] = (62, 58)

        # Tail tucked sharply low in recoil
        r["tail_ctrl"] = (67, 42)
        r["tail_tip"] = (71, 55)

    return r


# ---------------------------------------------------------------------------
# Anatomical Layer Painters
# ---------------------------------------------------------------------------

def draw_far_legs(sp: Sprite, r: dict):
    """Darker shaded slender agile far-side foreleg & hindleg for instant 3D depth."""
    sp.layer("far_legs")

    ff_sh = (r["sh_x"] - 4, r["sh_y"] + 2)
    draw_shaded_limb_seg(sp, ff_sh, r["ff_el"], 3.4, 2.0, FUR_MID, FUR_SH1, FUR_SH2)
    draw_shaded_limb_seg(sp, r["ff_el"], r["ff_wr"], 1.9, 1.3, FUR_MID, FUR_SH1, FUR_SH2)
    draw_shaded_limb_seg(sp, r["ff_wr"], (r["ff_paw"][0] + 1, r["ff_paw"][1] - 1),
                         1.4, 1.2, FUR_MID, FUR_SH1, FUR_SH2)
    draw_frost_greave(sp, r["ff_wr"][0], r["ff_wr"][1], is_far=True)
    draw_paw(sp, r["ff_paw"][0], r["ff_paw"][1], is_far=True, angle=r["ff_mode"])

    fh_hip = (r["hip_x"] - 4, r["hip_y"] + 2)
    draw_shaded_limb_seg(sp, fh_hip, r["fh_kn"], 4.0, 2.3, FUR_MID, FUR_SH1, FUR_SH2)
    draw_shaded_limb_seg(sp, r["fh_kn"], r["fh_hk"], 2.2, 1.4, FUR_MID, FUR_SH1, FUR_SH2)
    draw_shaded_limb_seg(sp, r["fh_hk"], (r["fh_paw"][0] + 1, r["fh_paw"][1] - 1),
                         1.4, 1.2, FUR_MID, FUR_SH1, FUR_SH2)
    draw_frost_greave(sp, (r["fh_hk"][0] + r["fh_paw"][0]) // 2,
                      (r["fh_hk"][1] + r["fh_paw"][1]) // 2 + 1, is_far=True)
    draw_paw(sp, r["fh_paw"][0], r["fh_paw"][1], is_far=True, angle=r["fh_mode"])


def draw_tail(sp: Sprite, r: dict):
    """Lush silky-feathered silver-blue & snow-white winter wolf tail with smooth tapered plumes."""
    sp.layer("tail")
    p0 = (r["hip_x"] + 4, r["hip_y"] - 1)
    p1 = r["tail_ctrl"]
    p2 = r["tail_tip"]
    pts = bezier(p0, p1, p2, steps=28)

    # Smooth sweeping bushy volume (cool silver-blue upper coat transitioning into snow-white brush!)
    for i, (x, y) in enumerate(pts):
        t = i / (len(pts) - 1)
        # Taper smoothly: slender root -> lush billowing plume -> razor-feathered tip
        rad = max(0.55, 1.5 + math.sin(t * math.pi) * 3.1 - t * 1.15)
        ir = int(math.ceil(rad))
        for py in range(int(y - ir), int(y + ir) + 1):
            for px in range(int(x - ir), int(x + ir) + 1):
                dx, dy = px - x, py - y
                if dx * dx + dy * dy <= rad * rad + 0.08:
                    ny = dy / max(0.6, rad)
                    if ny < -0.22:
                        col = FUR_HI if t > 0.35 else FUR_LT
                    elif ny < 0.25:
                        col = FUR_LT if t > 0.48 else FUR_MID
                    elif ny < 0.68:
                        col = FUR_MID if t > 0.55 else FUR_SH1
                    else:
                        col = FUR_SH1 if t > 0.58 else FUR_SH2
                    sp.px(min(W - 3, px), min(H - 3, max(2, py)), col)

    # Smooth organic curved feather locks swept back along upper & lower contour (zero boxy spikes!)
    tucked = p2[1] > 51
    tuft_specs = (
        [(9, 2, -2, True), (17, 2, 1, True)]
        if tucked
        else [(9, 3, -2, True), (17, 3, 0, True), (13, -1, 3, False)]
    )
    for idx, off_x, off_y, is_top in tuft_specs:
        bx, by = int(round(pts[idx][0])), int(round(pts[idx][1]))
        tx = min(W - 3, bx + off_x)
        ty = min(H - 3, max(2, by + off_y))
        if is_top:
            draw_fur_tuft(sp, bx, by, tx, ty, 1.2, FUR_HI, FUR_LT, FUR_MID)
        else:
            draw_fur_tuft(sp, bx, by, tx, ty, 1.1, FUR_LT, FUR_MID, FUR_SH1)

    # Wispy tapered snow-white brush tip
    ex, ey = min(W - 3, int(round(p2[0]))), min(H - 3, max(2, int(round(p2[1]))))
    sp.px(ex, ey, FUR_HI)
    sp.px(min(W - 3, ex + 1), ey, FUR_LT)
    sp.px(min(W - 3, ex + 1), min(H - 3, ey + 1), FUR_HI)


def draw_body(sp: Sprite, r: dict):
    """Sleek athletic cool silver-blue wolf torso: deep ribcage, sharp tucked flank, strong hip."""
    sp.layer("body")
    sh = (r["sh_x"], r["sh_y"])
    mid = (r["mid_x"], r["mid_y"])
    hip = (r["hip_x"], r["hip_y"])
    neck = ((r["head_cx"] + r["sh_x"]) * 0.5 + 2, (r["head_cy"] + r["sh_y"]) * 0.5)

    draw_capsule(sp, neck[0], neck[1], sh[0], sh[1], 4.4, 6.2, FUR_MID)
    draw_capsule(sp, sh[0], sh[1] + 1, mid[0], mid[1] - 1, 6.2, 3.8, FUR_MID)
    draw_capsule(sp, mid[0], mid[1] - 1, hip[0], hip[1], 3.7, 5.0, FUR_MID)

    body_pts = (
        bezier(neck, sh, mid, steps=16)
        + bezier(mid, ((mid[0] + hip[0]) * 0.5, (mid[1] + hip[1]) * 0.5 - 1), hip, steps=14)
    )
    for i, (cx, cy) in enumerate(body_pts):
        t = i / max(1, len(body_pts) - 1)
        if t < 0.30:
            rad = 4.6 + (t / 0.30) * 1.8
        elif t < 0.66:
            rad = 6.4 - ((t - 0.30) / 0.36) * 2.6
        else:
            rad = 3.8 + ((t - 0.66) / 0.34) * 1.3

        ir = int(math.ceil(rad))
        for py in range(int(cy - ir), int(cy + ir) + 1):
            for px in range(int(cx - ir), int(cx + ir) + 1):
                if sp.get(px, py) is None:
                    continue
                dy = (py - cy) / max(1.0, rad)
                if dy < -0.58:
                    sp.px(px, py, FUR_LT)
                elif dy < 0.18:
                    sp.px(px, py, FUR_MID)
                elif dy < 0.58:
                    sp.px(px, py, FUR_SH1)
                else:
                    if 0.42 < t < 0.72 and dy > 0.72:
                        sp.px(px, py, FUR_LT)
                    else:
                        sp.px(px, py, FUR_SH2)

    # Crisp diagonal wolf fur-tuft chevrons along ribcage & flank
    for fx, fy in [
        (int(sh[0] + 5), int(sh[1] - 1)),
        (int(mid[0] - 2), int(mid[1] - 1)),
        (int(mid[0] + 4), int(mid[1] - 2)),
        (int(hip[0] - 2), int(hip[1] - 1)),
    ]:
        sp.px(fx, fy, FUR_LT)
        sp.px(fx + 1, fy, FUR_HI)
        sp.px(fx + 1, fy + 1, FUR_SH1)

    # Subtle shaggy chest-underbelly fur tufts
    for off_x, off_y in ((3, 6), (7, 5), (11, 4)):
        fx = int(round(sh[0] + off_x))
        fy = int(round(sh[1] + off_y))
        sp.px(fx, fy, FUR_SH1)
        sp.px(fx + 1, fy + 1, FUR_SH2)


def draw_spines(sp: Sprite, r: dict):
    """7 organically clustered, varied-height razor crystalline ice blades sweeping back
    along the nape, shoulders, and back ridge — ZERO forehead antlers, CLEAN air gaps!"""
    sh_x, sh_y = r["sh_x"], r["sh_y"]
    mid_x, mid_y = r["mid_x"], r["mid_y"]
    hip_x, hip_y = r["hip_x"], r["hip_y"]
    hx, hy = r["head_cx"], r["head_cy"]
    fl = r["spine_flare"]
    ln = r["spine_lean"]

    # Nape anchor stays cleanly BEHIND the near ear!
    nape_x = max(hx + 8, (hx + sh_x) * 0.5 + 3)
    nape_y = min(hy, sh_y) - 2

    # Far-side background crystalline needles (2 staggered accents for lush 3D cluster!)
    sp.layer("spines_far")
    far_specs = [
        # Steep tall background shoulder spire peeking behind hero spire
        (sh_x - 1,  sh_y - 5,  sh_x + 7 + ln,   sh_y - 19 - fl, 1.25, 1.8),
        # Lower swept background mid-back needle
        (mid_x + 2, mid_y - 4, mid_x + 14 + ln, mid_y - 13 - fl, 1.05, 1.0),
    ]
    for bx, by, tx, ty, bw, bd in far_specs:
        draw_razor_ice_spine(sp, bx, by, tx, ty, bw, bend=bd, far=True)

    # Near-side hero crystalline frost spines: bold shoulder crest -> organic gap -> sleek rump shards!
    sp.layer("spines_near")
    near_specs = [
        # 1) Nape crest blade (behind ear, steep elegant curve)
        (nape_x,     nape_y,     nape_x + 7 + ln,  nape_y - 12 - fl, 1.50, 1.5),
        # 2) Towering curved HERO shoulder frost spire!
        (sh_x + 2,   sh_y - 4,   sh_x + 15 + ln,   sh_y - 21 - fl,   1.85, 2.4),
        # 3) Swept flank shoulder blade (creates dramatic asymmetric crest cluster!)
        (sh_x + 9,   sh_y - 3,   sh_x + 22 + ln,   sh_y - 14 - fl,   1.45, 1.4),
        # (organic visual dip at mid-back for agile wolf silhouette!)
        # 4) Sleek aerodynamic lower-back crystal blade
        (mid_x + 5,  mid_y - 3,  mid_x + 18 + ln,  mid_y - 11 - fl,  1.35, 1.0),
        # 5) Low-swept hip/tail-base frost shard
        (hip_x + 1,  hip_y - 3,  hip_x + 13 + ln,  hip_y - 7 - fl,   1.15, 0.5),
    ]
    for bx, by, tx, ty, bw, bd in near_specs:
        draw_razor_ice_spine(sp, bx, by, tx, ty, bw, bend=bd, far=False)

    # Crystalline frost shoulder/spine ridge shards nestled where spines erupt from the back fur!
    ridge_pts = [
        (sh_x + 1, sh_y - 3),
        (sh_x + 6, sh_y - 3),
        (mid_x + 1, mid_y - 3),
        (hip_x - 1, hip_y - 3),
    ]
    for rx, ry in ridge_pts:
        sp.px(int(rx), int(ry), PURE_WHT)
        sp.px(int(rx + 1), int(ry), ICE_HI)
        sp.px(int(rx + 2), int(ry + 1), ICE_MID)
        sp.px(int(rx + 1), int(ry + 1), ICE_SH1)


def draw_near_legs(sp: Sprite, r: dict):
    """Bright lit agile near-side foreleg & digitigrade hindleg with crisp muscle creases,
    streamlined elbow tuft, frost spurs & dark claws."""
    sp.layer("near_legs")

    # Near Foreleg: muscular shoulder -> streamlined elbow -> slender shin -> frost wrap -> paw!
    nf_sh = (r["sh_x"] + 1, r["sh_y"] + 2)
    draw_shaded_limb_seg(sp, nf_sh, r["nf_el"], 3.8, 2.2, FUR_HI, FUR_LT, FUR_SH1)
    draw_shaded_limb_seg(sp, r["nf_el"], r["nf_wr"], 2.1, 1.4, FUR_HI, FUR_LT, FUR_MID)
    draw_shaded_limb_seg(sp, r["nf_wr"], (r["nf_paw"][0] + 1, r["nf_paw"][1] - 1),
                         1.4, 1.3, FUR_HI, FUR_LT, FUR_MID)
    # Crisp 1px shoulder-to-ribcage muscle crease for immediate anatomical pop!
    sp.line(nf_sh[0] + 3, nf_sh[1] + 2, r["nf_el"][0] + 2, r["nf_el"][1] - 2, FUR_SH2)

    # Sleek, aerodynamic elbow fur tuft (tighter than Pass 2 so belly negative space stays crisp!)
    ex, ey = r["nf_el"]
    draw_fur_tuft(sp, ex + 1, ey, ex + 4, ey - 2, 1.1, FUR_HI, FUR_LT, FUR_MID)

    draw_frost_greave(sp, r["nf_wr"][0], r["nf_wr"][1], is_far=False)
    draw_paw(sp, r["nf_paw"][0], r["nf_paw"][1], is_far=False, angle=r["nf_mode"])

    # Near Hindleg: strong muscular thigh -> bent knee -> crisp high hock -> slender ankle -> paw!
    nh_hip = (r["hip_x"] + 1, r["hip_y"] + 1)
    draw_shaded_limb_seg(sp, nh_hip, r["nh_kn"], 4.6, 2.6, FUR_HI, FUR_LT, FUR_SH1)
    draw_shaded_limb_seg(sp, r["nh_kn"], r["nh_hk"], 2.4, 1.5, FUR_LT, FUR_MID, FUR_SH1)
    draw_shaded_limb_seg(sp, r["nh_hk"], (r["nh_paw"][0] + 1, r["nh_paw"][1] - 1),
                         1.5, 1.2, FUR_HI, FUR_LT, FUR_MID)
    # Crisp thigh muscle separation accent along front of haunch
    sp.line(nh_hip[0] - 4, nh_hip[1] + 2, r["nh_kn"][0] - 3, r["nh_kn"][1] - 1, FUR_SH2)

    # Swept fur plume on rear of thigh above hock
    kx, ky = r["nh_hk"]
    draw_fur_tuft(sp, kx - 1, ky - 4, kx + 2, ky - 6, 1.1, FUR_HI, FUR_LT, FUR_MID)

    ax = (r["nh_hk"][0] + r["nh_paw"][0]) // 2
    ay = (r["nh_hk"][1] + r["nh_paw"][1]) // 2 + 1
    draw_frost_greave(sp, ax, ay, is_far=False)
    draw_paw(sp, r["nh_paw"][0], r["nh_paw"][1], is_far=False, angle=r["nh_mode"])


def draw_mane(sp: Sprite, r: dict):
    """Luminous snow-white shaggy neck & chest wolf ruff contrasting crisply with silver-blue flanks!"""
    sp.layer("mane")
    hx, hy = r["head_cx"], r["head_cy"]
    sx, sy = r["sh_x"], r["sh_y"]

    draw_capsule(sp, hx + 4, hy, sx + 1, sy + 4, 4.4, 5.4, FUR_LT)
    draw_capsule(sp, hx + 2, hy + 4, sx - 2, sy + 7, 3.6, 4.2, FUR_HI)

    mx = (hx + sx) * 0.5 + 1
    my = (hy + sy) * 0.5 + 2
    for py in range(int(hy - 6), int(sy + 14)):
        for px in range(int(hx - 2), int(sx + 10)):
            if sp.get(px, py) is None:
                continue
            dx = px - mx
            dy = py - my
            if dy < 0 and dx < 4:
                sp.px(px, py, FUR_HI)
            elif dx < -1 and dy < 5:
                sp.px(px, py, FUR_HI)
            elif dy > 6 or dx > 5:
                sp.px(px, py, FUR_MID if dy <= 8 else FUR_SH1)
            else:
                sp.px(px, py, FUR_LT)

    tufts = [
        (hx + 3, hy + 6,  hx + 0,  hy + 12, 1.6, True),
        (hx + 6, hy + 8,  hx + 4,  hy + 15, 1.7, True),
        (sx - 2, sy + 6,  sx - 4,  sy + 13, 1.7, True),
        (sx + 1, sy + 7,  sx + 1,  sy + 13, 1.6, False),
        (sx + 4, sy + 4,  sx + 9,  sy + 8,  1.5, False),
        (sx + 3, sy - 1,  sx + 9,  sy + 2,  1.5, True),
    ]
    for bx, by, tx, ty, w, is_lit in tufts:
        if is_lit:
            draw_fur_tuft(sp, bx, by, tx, ty, w, FUR_HI, FUR_LT, FUR_MID)
        else:
            draw_fur_tuft(sp, bx, by, tx, ty, w, FUR_LT, FUR_MID, FUR_SH1)


def draw_head(sp: Sprite, r: dict):
    """Sleek, fierce lupine wedge wolf head facing LEFT:
    long tapered snout, wide-base sculpted wolf ears (ZERO antlers!),
    blazing crimson-amber eye, curved snarling lip & razor canines, expressive hurt yelp."""
    sp.layer("head")
    cx = r["head_cx"]
    cy = r["head_cy"]
    tilt = r["head_tilt"]
    epin = r["ear_pin"]

    # 1) FAR POINTED WOLF EAR (forward-left on crown, clearly visible even when pinned back!)
    fe_bx, fe_by = cx - 1, cy - 4
    if epin >= 4:
        fe_tx = cx + 2
        fe_ty = cy - 11 - (tilt // 2)
    else:
        fe_tx = cx - 2 + epin
        fe_ty = cy - 12 + (epin // 2) - (tilt // 2)
    sp.polygon([
        (fe_bx - 2, fe_by + 1),
        (fe_tx, fe_ty),
        (fe_bx + 3, fe_by),
    ], FUR_SH1, fill=True)
    sp.line(fe_bx - 2, fe_by + 1, fe_tx, fe_ty, FUR_MID)
    sp.px(fe_bx, fe_by - 2, FUR_SH2)
    sp.px(fe_bx + 1, fe_by - 2, INK_DARK)

    # 2) SLEEK LOW PREDATORY WOLF CRANIUM
    sp.polygon([
        (cx - 5, cy - 2),
        (cx - 1, cy - 5),
        (cx + 5, cy - 4),
        (cx + 7, cy + 2),
        (cx + 2, cy + 5),
        (cx - 5, cy + 3),
    ], FUR_LT, fill=True)
    sp.line(cx - 4, cy - 2, cx - 1, cy - 5, FUR_HI)
    sp.line(cx - 1, cy - 5, cx + 4, cy - 4, FUR_HI)
    sp.line(cx - 3, cy - 2, cx + 3, cy - 3, FUR_HI)
    sp.line(cx - 3, cy + 3, cx + 4, cy + 4, FUR_MID)
    sp.line(cx - 2, cy + 4, cx + 3, cy + 5, FUR_SH1)

    # Dynamic swept-back wolf cheek hackles framing jaw
    draw_fur_tuft(sp, cx + 3, cy - 1, cx + 10, cy - 2, 1.5, FUR_HI, FUR_LT, FUR_MID)
    draw_fur_tuft(sp, cx + 3, cy + 2, cx + 10, cy + 3, 1.6, FUR_HI, FUR_LT, FUR_MID)
    draw_fur_tuft(sp, cx + 2, cy + 4, cx + 8,  cy + 7, 1.5, FUR_LT, FUR_MID, FUR_SH1)

    # 3) NEAR POINTED WOLF EAR (wider iconic lupine ear base + crisp dark inner hollow + white ear tuft!)
    ne_bx, ne_by = cx + 3, cy - 4
    if epin >= 4:
        # Pinned cleanly up-back with crisp shaded rear rim so it pops clearly against nape ice spine!
        ne_tx = cx + 9
        ne_ty = cy - 11 - (tilt // 2)
    else:
        ne_tx = cx + 6 + epin
        ne_ty = cy - 13 + (epin // 2) - (tilt // 2)
    sp.polygon([
        (ne_bx - 2, ne_by + 1),
        (ne_tx, ne_ty),
        (ne_bx + 4, ne_by + 2),
    ], FUR_LT, fill=True)
    sp.line(ne_bx - 2, ne_by + 1, ne_tx, ne_ty, FUR_HI)
    if epin >= 4:
        sp.line(ne_tx, ne_ty, ne_bx + 4, ne_by + 2, FUR_SH1)
    # Sculpted deep dark inner ear cavity + fluffy snow-white ear-base tuft!
    mid_ex = int(round(ne_bx + (ne_tx - ne_bx) * 0.58))
    mid_ey = int(round(ne_by + (ne_ty - ne_by) * 0.58))
    sp.polygon([
        (ne_bx, ne_by + 1),
        (mid_ex, mid_ey),
        (ne_bx + 3, ne_by + 1),
    ], FUR_SH2, fill=True)
    sp.line(ne_bx + 1, ne_by, mid_ex, mid_ey, INK_DARK)
    sp.px(ne_bx, ne_by + 1, FUR_HI)
    sp.px(ne_bx + 1, ne_by + 1, FUR_HI)

    # 4) LONG, SLEEK, TAPERED LUPINE MUZZLE & UPPER JAW (tilts sharply UP on hurt yelp!)
    sn_x = cx - 11
    sn_y = cy + 1 - tilt
    sp.polygon([
        (cx - 4, cy - 2 - (tilt // 3)),
        (sn_x, sn_y),
        (sn_x, sn_y + 2),
        (sn_x + 2, sn_y + 3),
        (cx - 3, cy + 3 - (tilt // 2)),
    ], FUR_LT, fill=True)
    # Sunlit nose bridge highlight
    sp.line(cx - 4, cy - 2 - (tilt // 3), sn_x + 1, sn_y, FUR_HI)
    sp.line(cx - 3, cy - 1 - (tilt // 3), sn_x + 2, sn_y + 1, FUR_HI)
    # Curled snarling upper lip shadow
    sp.line(sn_x + 2, sn_y + 2, cx - 3, cy + 2 - (tilt // 2), FUR_MID)
    sp.px(cx - 6, cy - (tilt // 2), FUR_MID)
    sp.px(cx - 7, cy + 1 - (tilt // 2), FUR_SH1)

    # Sharp dark triangular wolf nose at tip of long muzzle!
    sp.px(sn_x - 1, sn_y, INK_DARK)
    sp.px(sn_x, sn_y, CLAW_HI)
    sp.px(sn_x - 1, sn_y + 1, INK_DARK)
    sp.px(sn_x, sn_y + 1, INK_DARK)
    sp.px(sn_x + 1, sn_y + 1, INK_DARK)

    # 5) LOWER JAW, REFINED SNARL / BITE / YELP & RAZOR CANINES!
    m_open = r["mouth_open"]
    if m_open == 0:
        # Closed sleek wolf jaw (blink frame)
        sp.polygon([
            (sn_x + 1, sn_y + 3),
            (cx - 2, cy + 3),
            (cx - 1, cy + 5),
            (sn_x + 3, sn_y + 4),
        ], FUR_MID, fill=True)
        sp.line(sn_x + 1, sn_y + 3, cx - 3, cy + 3, INK_DARK)
        sp.line(sn_x + 3, sn_y + 4, cx - 1, cy + 5, FUR_SH1)
    elif m_open == 1:
        # Refined predatory snarl: curved white upper lip + deep dark crimson recess + overlapping razor fangs!
        sp.polygon([
            (sn_x + 2, sn_y + 3),
            (cx - 3, cy + 2),
            (cx - 3, cy + 4),
            (sn_x + 3, sn_y + 4),
        ], EYE_DRK, fill=True)
        # Curled white snarling upper-lip edge right above gums
        sp.px(sn_x + 3, sn_y + 2, FUR_HI)
        sp.px(sn_x + 4, sn_y + 2, FUR_LT)
        sp.px(sn_x + 5, sn_y + 3, MAW_PNK)
        # Sleek tapered lower jaw
        sp.polygon([
            (sn_x + 2, sn_y + 4),
            (cx - 2, cy + 4),
            (cx, cy + 6),
            (sn_x + 4, sn_y + 5),
        ], FUR_MID, fill=True)
        sp.line(sn_x + 4, sn_y + 5, cx, cy + 6, FUR_SH1)
        # Razor ivory upper canine overlapping boldly down over lower lip!
        sp.px(sn_x + 2, sn_y + 3, PURE_WHT)
        sp.px(sn_x + 2, sn_y + 4, PURE_WHT)
        sp.px(sn_x + 3, sn_y + 4, FANG_SH)
        sp.px(sn_x + 5, sn_y + 3, PURE_WHT)
    else:
        # Dramatic wide-open V-shaped predator bite (`strike`) or upward recoiling yelp (`hurt`)!
        jaw_drop = 5
        hinge_y = cy + 3 - (tilt // 2)
        tip_y = sn_y + 2 + jaw_drop
        # Crisp V-shaped crimson mouth cavity narrowing cleanly into jaw hinge
        sp.polygon([
            (sn_x + 1, sn_y + 3),
            (cx - 3, hinge_y),
            (cx - 4, hinge_y + 2),
            (sn_x + 3, tip_y),
        ], EYE_DRK, fill=True)
        # Contoured crimson tongue inside open jaw
        sp.line(sn_x + 4, sn_y + 4, cx - 5, hinge_y + 1, MAW_PNK)
        sp.px(sn_x + 4, sn_y + 5, MAW_PNK)
        # Sleek angled lower jaw bone swinging open
        sp.polygon([
            (sn_x + 2, tip_y),
            (cx - 3, hinge_y + 1),
            (cx - 1, hinge_y + 3),
            (sn_x + 4, tip_y + 1),
        ], FUR_LT, fill=True)
        sp.line(sn_x + 3, tip_y + 1, cx - 1, hinge_y + 3, FUR_SH1)
        # Prominent gleaming upper & lower canines!
        sp.px(sn_x + 1, sn_y + 3, PURE_WHT)
        sp.px(sn_x + 1, sn_y + 4, PURE_WHT)
        sp.px(sn_x + 4, sn_y + 3, FANG_SH)
        sp.px(sn_x + 3, tip_y - 1, PURE_WHT)
        sp.px(sn_x + 3, tip_y, FANG_SH)
        sp.px(sn_x + 5, tip_y - 1, PURE_WHT)

    # 6) FIERCE SLANTED GLOWING AMBER-RED LUPINE EYE!
    ex = cx - 2
    ey = cy - 1 - (tilt // 2)
    emode = r["eye_mode"]

    if emode == "blink":
        # Sleek curved dark closed wolf eye + soft brow
        sp.px(ex - 2, ey + 1, INK_DARK)
        sp.px(ex - 1, ey + 1, INK_DARK)
        sp.px(ex, ey + 1, INK_DARK)
        sp.px(ex + 1, ey, INK_DARK)
        sp.px(ex - 1, ey, FUR_SH1)
        sp.px(ex, ey, FUR_SH1)
    elif emode == "wince":
        # Crisp, unmistakable squeezed `>` hurt wolf eye with clean fur margin above open yelping jaw!
        wy = ey - 1
        sp.px(ex - 2, wy, INK_DARK)
        sp.px(ex - 1, wy + 1, INK_DARK)
        sp.px(ex, wy + 1, INK_DARK)
        sp.px(ex + 1, wy, INK_DARK)
        sp.px(ex - 1, wy + 2, INK_DARK)
        sp.px(ex - 2, wy + 2, FUR_SH2)
        sp.px(ex, wy, EYE_RED)  # crisp crimson wincing glint!
    else:
        # Sharp slanted lupine predator eye socket + blazing amber-crimson iris!
        sp.px(ex - 3, ey + 1, INK_DARK)
        sp.px(ex - 2, ey, INK_DARK)
        sp.px(ex - 1, ey, INK_DARK)
        sp.px(ex, ey - 1, INK_DARK)
        sp.px(ex + 1, ey - 1, INK_DARK)
        sp.px(ex - 2, ey + 2, INK_DARK)
        sp.px(ex - 1, ey + 2, INK_MID)
        sp.px(ex, ey + 1, INK_DARK)
        sp.px(ex - 2, ey + 1, EYE_RED)
        sp.px(ex - 1, ey + 1, EYE_AMB if emode == "fierce" else EYE_GLOW)
        sp.px(ex, ey, EYE_GLOW if emode == "fierce" else PURE_WHT)
        sp.px(ex + 1, ey, EYE_RED)
        if emode == "blaze":
            sp.px(ex - 2, ey + 1, EYE_AMB)
            sp.px(ex + 1, ey, EYE_AMB)


def draw_fx(sp: Sprite, r: dict, pose: str):
    """Crisp un-outlined frost magic & slash VFX (zero face/jaw overlap, zero isolated px!)."""
    sp.layer("fx")

    if pose == "windup":
        # Sparkling frost-charge star crackling off the hero shoulder frost spire!
        sx, sy = r["sh_x"] + 15, max(4, r["sh_y"] - 21)
        sp.px(sx, sy, PURE_WHT)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sp.px(sx + dx, sy + dy, ICE_HI)
        sp.px(sx, sy - 2, ICE_MID)
        sp.px(sx, sy + 2, ICE_MID)
        sp.px(sx - 2, sy, ICE_MID)
        sp.px(sx + 2, sy, ICE_MID)
        # Second crisp connected frost glint along nape crest spire
        nx, ny = r["sh_x"] + 2, max(4, r["sh_y"] - 18)
        sp.px(nx, ny, PURE_WHT)
        sp.px(nx + 1, ny, ICE_HI)
        sp.px(nx, ny - 1, ICE_HI)

    elif pose == "strike":
        # 1) Dramatic curved icy claw-rake slash arcs erupting strictly from slashing forepaw
        #    at (13, 42) — cleanly BELOW snapping jaws (jaw bottom is y=29, slash starts at y=33)!
        arc1 = bezier((10, 33), (2, 41), (6, 51), steps=36)
        for i, (x, y) in enumerate(arc1):
            t = i / (len(arc1) - 1)
            px, py = int(round(x)), int(round(y))
            core = PURE_WHT if 0.18 < t < 0.78 else ICE_HI
            sp.px(px, py, core)
            sp.px(px + 1, py, ICE_HI if 0.14 < t < 0.86 else ICE_MID)
            if 0.22 < t < 0.78:
                sp.px(px + 2, py, ICE_MID)

        # Second inner parallel frost-claw trail sweeping off paw claws
        arc2 = bezier((11, 38), (5, 44), (9, 52), steps=30)
        for i, (x, y) in enumerate(arc2):
            t = i / (len(arc2) - 1)
            px, py = int(round(x)), int(round(y))
            sp.px(px, py, ICE_HI if 0.2 < t < 0.8 else ICE_MID)
            sp.px(px + 1, py, ICE_MID if 0.25 < t < 0.75 else ICE_SH1)

        # 2) Separate crisp 4-point icy fang-snap sparkle clearly LEFT of snapping jaws!
        bx, by = 4, 24
        sp.px(bx, by, PURE_WHT)
        sp.px(bx - 1, by, ICE_HI)
        sp.px(bx + 1, by, ICE_HI)
        sp.px(bx, by - 1, ICE_HI)
        sp.px(bx, by + 1, ICE_HI)
        sp.px(bx - 2, by, ICE_MID)
        sp.px(bx + 2, by, ICE_MID)


# ---------------------------------------------------------------------------
# Build All 6 Frames
# ---------------------------------------------------------------------------

FRAME_SPECS = [
    ("idle1",  260),
    ("idle2",  260),
    ("blink",  140),
    ("windup", 180),
    ("strike", 160),
    ("hurt",   220),
]


def build_sprite():
    sp = Sprite(W, H, palette=PALETTE, snap=True)
    sp.layer_order = [
        "outline",
        "far_legs",
        "tail",
        "spines_far",
        "body",
        "spines_near",
        "near_legs",
        "mane",
        "head",
        "fx",
    ]
    sp.frames[0].cels = {ln: sp._blank() for ln in sp.layer_order}

    for _ in range(1, N_FRAMES):
        sp.add_frame(copy=False)

    anchors = {}

    for idx, (pose, dur) in enumerate(FRAME_SPECS, start=1):
        sp.frame(idx)
        sp.set_duration(dur)

        r = get_rig(pose)
        draw_far_legs(sp, r)
        draw_tail(sp, r)
        draw_body(sp, r)
        draw_spines(sp, r)
        draw_near_legs(sp, r)
        draw_mane(sp, r)
        draw_head(sp, r)
        draw_fx(sp, r, pose)
        apply_selective_outline(sp, idx)

        if pose == "idle1":
            anchors["head_px"] = (r["head_cx"] - 2, r["head_cy"])
            anchors["hit_px"] = (r["sh_x"] + 6, r["sh_y"] + 3)
        if pose == "strike":
            anchors["cast_px"] = (4, 39)

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


def render_head_zoom(sp: Sprite, path: str, scale: int = 10):
    x0, y0, x1, y1 = 1, 4, 46, 46
    cw, ch = (x1 - x0 + 1) * scale, (y1 - y0 + 1) * scale
    sep = 4
    out = Image.new("RGB", (N_FRAMES * cw + (N_FRAMES + 1) * sep, ch + 2 * sep), (218, 228, 244))
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
    for fi in range(1, N_FRAMES + 1):
        sp.frame(fi)
        st = sp.stats(print_=False)
        assert not st["isolated_px"], f"Frame {fi} has isolated px: {st['isolated_px']}"
        im = sp.composite(fi)
        coords = [(x, y) for y in range(H) for x in range(W) if im.getpixel((x, y))[3] > 0]
        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        assert min(xs) >= 1 and max(xs) <= W - 2, f"Frame {fi} X margin clip: {min(xs)}..{max(xs)}"
        assert min(ys) >= 1 and max(ys) <= H - 2, f"Frame {fi} Y margin clip: {min(ys)}..{max(ys)}"

    # Verify exact foot baseline lock on GROUND_Y for idle frames 1..3
    for fi in (1, 2, 3):
        leg_cel = sp.frames[fi - 1].cels["near_legs"]
        ys = [y for y in range(H) for x in range(W) if leg_cel.getpixel((x, y))[3] > 0]
        assert max(ys) == GROUND_Y, f"Frame {fi} paw baseline {max(ys)} != {GROUND_Y}"

    os.makedirs(SPRITES_DIR, exist_ok=True)
    sp.save_spritesheet(SHEET_PATH, layout="horizontal", scale=1, padding=0, json_path=None)

    cast_x, cast_y = anchors["cast_px"]
    hit_x, hit_y = anchors["hit_px"]
    head_x, head_y = anchors["head_px"]
    meta = {
        "id": "pack_wolf",
        "file": "assets/sprites/pack_wolf_sheet.png",
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
        "buildScript": "tools/pixel_art/pack_wolf/build.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"meta -> {META_PATH}")
    print(json.dumps(meta, indent=2))

    sp.preview(PREVIEW_PATH, scale=6, bg="checker", grid=False, labels=True, cols=6)
    render_preview_bg(sp, anchors, PREVIEW_BG_PATH)
    render_silhouette_strip(sp, SILHOUETTE_PATH, scale=5)
    render_head_zoom(sp, HEAD_ZOOM_PATH, scale=10)


if __name__ == "__main__":
    main()
