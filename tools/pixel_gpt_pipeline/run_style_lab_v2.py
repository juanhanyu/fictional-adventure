#!/usr/bin/env python3
"""6-Style Authentic Commercial Pixel-Art Benchmark Lab for Barehanded Ice-Mage Sylvia.

High-Detail (128-tier @ 2x):
  A: a_hd_bighead      - Flagship HD Anime Big-Head (~2.1-head, cool expression, 132x128 @ 2x)
  B: b_worldflipper_hd - World Flipper / MapleStory Ultra-Cute Big-Head (~1.9-head, sel-out, 132x128 @ 2x)
  C: c_octopath_hd     - Octopath Traveler x Suikoden II / Valkyrie Profile Painterly Classical HD (132x128 @ 2x)

Chunky Retro / Modern Mid-Low Res (64~96-tier @ 3x):
  D: d_octopath_64     - AUTHENTIC Octopath Traveler 16-bit HD-2D (1x2 dot eyes, NO anime eyes, 64x64 @ 3x)
  E: e_seaofstars_64   - AUTHENTIC Sea of Stars / Chained Echoes vibrant hue-shifted chunky (64x64 @ 3x)
  F: f_guardian_80     - Guardian Tales / Retro Chibi Anime Big-Head Chunky (96x96 @ 2.5x/3x -> 88x84 @ 3x)
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PIPE_DIR = Path(__file__).resolve().parent
RAW_DIR = PIPE_DIR / "raw_gpt" / "style_lab_v2"
PROMPT_DIR = PIPE_DIR / "prompts" / "style_lab_v2"
JS_DIR = PIPE_DIR / "out_js" / "style_lab_v2"
AUDIT_DIR = PIPE_DIR / "audit" / "style_lab_v2"
CODEX_IMGGEN = REPO_ROOT / "tools" / "art_pipeline" / "codex_imggen.py"
CONVERTER = PIPE_DIR / "gpt_to_true_pixel.py"
SYLVIA_PORTRAIT = REPO_ROOT / "assets" / "portraits" / "sylvia_teenage_normal.png"
MASTER_AUTH = Path("/home/antigravity/.codex-chatgpt2/auth.json")

CANON_OUTFIT = (
    "角色身份与配色仅取自 IMAGE 1（14 岁冷淡优雅银发贵族水冰魔法少女希尔维亚，绝不拿任何剑/刀/法杖武器！）："
    "微带冷紫灰光泽的银白长发、左耳侧编发配深蓝白边蝴蝶结与蓝宝石发饰；"
    "白立领衬衣、胸前深蓝蝴蝶结配椭圆形蓝宝石胸针、深海蓝滚金边学院马甲、白泡泡袖、深海蓝金边百褶短裙、白及膝长袜、深蓝短靴。"
    "【绝对无武器铁律】：全程徒手水/冰魔法师，严禁画剑、刀、法杖、书本或任何手持武器！"
)

STYLES: dict[str, dict] = {
    "a_hd_bighead": {
        "group": "hd",
        "title": "A · 本案高精大头版（冷淡本尊）",
        "ref_game": "本案 128 档升级 · 2.1 头身大头冷淡系",
        "w": 140,
        "h": 138,
        "ground_y": 134,
        "char_h": 0,
        "colors": 38,
        "scale": 2,
        "pitch_hint": 9.3,
        "strike_prompt": (
            "为二次元西幻 JRPG 绘制主角希尔维亚的【高精大头像素战斗施法帧 · STRIKE】。\n"
            "严格锁定 IMAGE 1（待机像素原图）的 100% 全部规格：完全一致的单颗像素方块边长（约 9～10px 规整方格）、2.1 头身大头冷淡萌系比例、冷淡平静神情（不浮夸大笑）、银发深蓝金边服饰配色、描边粗细与脚底基准线（并参考 IMAGE 2 确保发饰胸针细节一致）。\n"
            "【动作改为：凝华冰晶·空手冰锥激射】：身体向右前倾踏步、银白长发与深蓝裙摆向左侧大幅飘扬，右臂向前平直伸掌空手施法（严禁画任何剑/法杖武器！），"
            "掌心前方凌空凝聚并向右激射出一枚锋利剔透的多棱面纯实色像素冰蓝大冰锥与数颗干脆纯白/冰蓝四芒星像素碎晶。\n"
            "【硬性规范】：1:1 正方形、背景 100% 绝对平涂纯洋红 #FF00FF、严禁半透明柔光光晕、严禁地面阴影/文字/网格线、角色与冰锥四周留安全边距不裁切。"
        ),
    },
    "b_worldflipper_hd": {
        "group": "hd",
        "title": "B · 弹射世界 / 冒险岛（顶流萌系高精）",
        "ref_game": "《世界弹射物语》/《冒险岛》· 1.9 头身软萌",
        "w": 142,
        "h": 140,
        "ground_y": 137,
        "char_h": 0,
        "colors": 38,
        "scale": 2,
        "pitch_hint": 9.1,
        "strike_prompt": (
            "为二次元西幻 JRPG 绘制主角希尔维亚的【《世界弹射物语 / 冒险岛》软萌超大头高精像素施法帧 · STRIKE】。\n"
            "严格锁定 IMAGE 1（待机像素原图）的 100% 全部规格：完全一致的单颗像素方块边长（约 9px 规整方格）、1.9 头身超大头娃娃比例、水润大蓝眼、高饱和清透赛璐璐配色、柔和彩色外描边 Sel-out 与脚底基准线（参考 IMAGE 2 细节）。\n"
            "【动作改为：冰晶魔法连发】：小巧身体向右前跃半步、蓬松银白长发与深蓝裙摆向左侧轻快扬起，双小手向前平推空手施法（严禁画任何剑/法杖武器！），"
            "掌前华丽凝结并向右激射出一簇晶莹锋利的纯实色像素冰蓝菱形冰锥与清脆纯白四芒星像素晶屑。\n"
            "【硬性规范】：1:1 正方形、背景 100% 绝对平涂纯洋红 #FF00FF、严禁半透明柔光光晕、严禁地面阴影/文字/网格线、角色与冰锥四周留安全边距不裁切。"
        ),
    },
    "c_octopath_hd": {
        "group": "hd",
        "title": "C · 八方旅人 × 幻想水浒传2（古典高精 HD-2D）",
        "ref_game": "《八方旅人》高精化 /《幻想水浒传2》古典厚涂",
        "w": 136,
        "h": 132,
        "ground_y": 128,
        "char_h": 0,
        "colors": 38,
        "scale": 2,
        "pitch_hint": 9.38,
        "idle_prompt": (
            "为古典西幻主机 JRPG 绘制主角希尔维亚的【《八方旅人 Octopath Traveler》高精进化版 × 《幻想水浒传2 / 皇家骑士团》古典油画点阵战斗待机图 · IDLE】。\n"
            "【严禁画成现代大眼萌系手游 Q 版！只从 IMAGE 1 借用配色、发型与服饰结构，画风彻底转译为经典日系主机古典厚涂像素！】：\n"
            "- 核心画风：Square Enix《八方旅人》HD-2D 的沉郁古典贵族氛围 + PS1/SS 时代《幻想水浒传 2》《女神侧身像》大师级 32-bit 精细点阵；\n"
            "- 比例与五官：【2.2 头身紧凑大头古典比例】（头较大但绝非软萌娃娃脸），脸型清冷利落、**眼睛必须克制小巧深邃（约 5×6 逻辑像素的古典宝石蓝细目，不要现代二次元超大萌眼、不要腮红、不要夸张睫毛）**；\n"
            "- 色彩与光影：低饱和、厚重有油画雕塑感的古典欧式配色（冷灰银长发配深石板紫阴影、暗藏青厚呢学院马甲与百褶裙、做旧古铜金边、强明暗对比与精致小面积棋盘抖动 dithering 质感）；\n"
            f"- {CANON_OUTFIT}\n"
            "- 【待机动作】：面向右侧 3/4 侧面沉静肃立，左手轻垂衣侧，右手优雅抬于身前，掌心上方悬浮一颗切割锐利、冰冷深邃的多棱面纯实色像素蓝白冰晶（绝无剑/法杖）。\n"
            "- 【严格像素规格】：1:1 正方形，逻辑像素网格严格约 120×120（每颗像素约 10×10 规整正方形，绝不画超细高清插画线！），人物高度占画布约 85%，双脚踩在底边上方 5% 水平线，背景 100% 绝对平涂纯洋红 #FF00FF，无阴影无光晕无文字。"
        ),
        "strike_prompt": (
            "为古典西幻主机 JRPG 绘制主角希尔维亚的【《八方旅人》高精古典 HD-2D 像素施法出招帧 · STRIKE】。\n"
            "严格锁定 IMAGE 1（古典高精待机像素原图）的 100% 全部规格：完全一致的单颗像素块边长、2.2 头身古典比例、克制小巧深邃眼眸、低饱和厚重油画感配色与雕塑明暗（参考 IMAGE 2 服饰结构，绝不漂移回现代大眼萌系！）。\n"
            "【动作改为：古典冰枪解放】：身体向右沉稳前踏、冷灰银长发与暗藏青裙摆向左侧猎猎鼓荡，右臂水平向右前平推伸掌空手施法（绝无剑/法杖！），"
            "掌前凌空凝结并向右激射出一道凌厉厚重、冷峻高对比的纯实色像素棱面寒冰长锥与清脆冰晶碎块。\n"
            "【硬性规范】：1:1 正方形、背景 100% 绝对平涂纯洋红 #FF00FF、严禁半透明柔光光晕、严禁地面阴影/文字/网格线、四周留安全边距。"
        ),
    },
    "d_octopath_64": {
        "group": "chunky",
        "title": "D · 八方旅人正宗 HD-2D（16-bit 点眼大颗粒）",
        "ref_game": "《八方旅人 1&2》/《三角战略》正宗 16-bit 规范",
        "w": 70,
        "h": 66,
        "ground_y": 63,
        "char_h": 0,
        "colors": 26,
        "scale": 3,
        "pitch_hint": 19.48,
        "idle_prompt": (
            "为 HD-2D 古典西幻 RPG 绘制主角希尔维亚的【100% 正宗《八方旅人 Octopath Traveler 1 & 2》/《最终幻想 VI》SFC 16-bit 大颗粒战斗精灵 · IDLE】。\n"
            "【最高优先级铁律 · 绝不能画成现代大眼二次元 Q 版！只取 IMAGE 1 的银发深蓝金边服饰元素，美术风格必须 100% 复刻真正的《八方旅人》游戏实机像素小人！】：\n"
            "- 标志性五官（灵魂！）：严格遵循《八方旅人》欧菲莉亚/普里姆萝洁/卡斯蒂的经典点阵五官——**双眼必须是极简的 1×2 纵向深蓝黑色像素小竖点（绝对禁止画眼白、禁止画现代动漫大眼、禁止画睫毛、禁止画鼻子和嘴巴！）**，纯靠简约点眼与冷银刘海表现高冷贵气！\n"
            "- 像素精度与颗粒感：极其粗大、清晰可数的复古 16-bit 大方块像素！逻辑网格严格为 48×48～56×56 有效像素居中于 64×64 画布内（每颗逻辑像素约 20×20 大正方形块，整个人物从头到脚仅约 48～52 颗大像素高！彻底抛弃细碎蕾丝/细金链！）。\n"
            "- 头身比与剪影：正宗八方旅人【2.0 头身紧凑方正像素小人】——圆润厚实的银灰长发大头 + 紧凑深海军蓝金边贵族裙装 + 利落短腿小靴。\n"
            "- 配色与光影：《八方旅人》招牌的古典低饱和深邃色板（冷灰银发、深石板紫暗部、沉稳藏青礼服、做旧暗金滚边、深靛蓝外描边），硬朗厚重的 16-bit 色块明暗。\n"
            f"- {CANON_OUTFIT}\n"
            "- 【待机动作】：经典横版回合制战斗侧面 3/4 站姿（面向右侧），双脚稳踩底部水平线，右手向前微抬、掌上方悬浮一颗由 5×7 颗粗大纯实色冰蓝/白方块构成的菱形像素冰晶（绝无剑/法杖）。\n"
            "- 【硬性规范】：1:1 正方形，背景 100% 绝对平涂纯洋红 #FF00FF，严禁半透明柔光光晕、严禁抗锯齿、严禁阴影/文字/网格线。"
        ),
        "strike_prompt": (
            "为 HD-2D 古典西幻 RPG 绘制主角希尔维亚的【100% 正宗《八方旅人 Octopath Traveler》16-bit 大颗粒战斗施法帧 · STRIKE】。\n"
            "严格锁定 IMAGE 1（正宗八方旅人 16-bit 待机小人）的 100% 全部规格：完全一致的粗大 20×20 像素方块边长、48～52 像素身高、极简 1×2 像素点状眼（绝不画大眼/眼白/嘴！）、低饱和古典深邃色板与 2.0 紧凑头身比。\n"
            "【动作改为：八方旅人经典魔法施放动作】：角色向右跨出半步前倾、银灰长发与藏青裙摆向左侧扬起，右手坚定平举向右前方出掌施法（绝无剑/法杖！），"
            "掌前凝聚并向右爆发出一枚粗大锐利的纯实色冰蓝/纯白方块冰锥与 3 颗大颗粒菱形像素冰星。\n"
            "【硬性规范】：1:1 正方形、背景 100% 绝对平涂纯洋红 #FF00FF、严禁半透明光晕、严禁地面阴影/文字/网格线。"
        ),
    },
    "e_seaofstars_64": {
        "group": "chunky",
        "title": "E · 星之海 Sea of Stars（高彩锐利中精）",
        "ref_game": "《星之海 Sea of Stars》/《火焰纹章 GBA》色相偏移标杆",
        "w": 120,
        "h": 118,
        "ground_y": 114,
        "char_h": 0,
        "colors": 34,
        "scale": 2,
        "pitch_hint": 10.78,
        "idle_prompt": (
            "为顶级现代像素 JRPG 绘制主角希尔维亚的【正宗《星之海 Sea of Stars》/《锁链回声 Chained Echoes》大师级现代 16-bit 大颗粒战斗精灵 · IDLE】。\n"
            f"- {CANON_OUTFIT}\n"
        ),
        "strike_prompt": (
            "为顶级现代像素 JRPG 绘制主角希尔维亚的【正宗《星之海 Sea of Stars / 火纹 GBA》高彩锐利像素施法攻击帧 · STRIKE】。\n"
            "严格锁定 IMAGE 1（已面向右侧的《星之海》待机像素原图）的 100% 全部规格：完全一致的单颗像素块边长（约 11px 规整方格）、干练冷冽头身比、极简犀利深蓝像素眼与高纯度色相偏移配色（冰青白发高光 + 皇家蓝礼服 + 紫靛阴影），严格面向右侧！\n"
            "【动作改为：《星之海》高张力寒冰疾射】：身体向右大幅压低弓步前冲、银白长发与皇家蓝百褶裙向左侧凌厉横飞，右臂笔直向右前方伸掌发力施法（绝无剑/法杖！），"
            "掌前爆射出一道极具冲击力的纯实色冰青/纯白/钴蓝阶梯像素冰枪锥与数颗锐利像素碎晶。\n"
            "【硬性规范】：1:1 正方形、背景 100% 绝对平涂纯洋红 #FF00FF、严禁半透明柔光光晕、严禁地面阴影/文字/网格线、四周留安全边距。"
        ),
    },
    "f_guardian_80": {
        "group": "chunky",
        "title": "F · 坎公骑冠剑 / GBA Q版（萌系中大颗粒）",
        "ref_game": "《坎公骑冠剑》/ 经典日系 Q 版中大颗粒",
        "w": 96,
        "h": 92,
        "ground_y": 87,
        "char_h": 0,
        "colors": 30,
        "scale": 3,
        "pitch_hint": 13.1,
        "strike_prompt": (
            "为二次元西幻 JRPG 绘制主角希尔维亚的【《坎公骑冠剑 / 日系萌系中大颗粒》战斗施法攻击帧 · STRIKE】。\n"
            "严格锁定 IMAGE 1（中大颗粒待机像素原图）的 100% 全部规格：完全一致的粗大清晰像素方块边长（约 13px 规整方格）、2.0 头身大头短腿 Q 版比例、清晰大颗蓝像素眼、深海蓝金边学院裙配色与脚底基准线（参考 IMAGE 2 服饰结构）。\n"
            "【动作改为：Q 版凝冰突放】：小巧身体向右前倾跨步、银白长发与深蓝裙摆向左侧扬起，右手笔直向右前方伸掌空手施法（绝无剑/法杖！），"
            "掌前凝聚并向右激射出一枚锋利醒目的粗大纯实色冰蓝/纯白像素冰锥与两三颗干脆像素冰晶星。\n"
            "【硬性规范】：1:1 正方形、背景 100% 绝对平涂纯洋红 #FF00FF、严禁半透明柔光光晕、严禁地面阴影/文字/网格线。"
        ),
    },
}


def seed_verified_winners() -> None:
    """Copy our 3 visually verified winning idle PNGs from style_lab v1 into style_lab_v2."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    v1 = PIPE_DIR / "raw_gpt" / "style_lab"
    mapping = {
        "a_hd_bighead_idle_gpt.png": v1 / "s5_seaofstars_64_idle_gpt.png",
        "b_worldflipper_hd_idle_gpt.png": v1 / "s4_worldflipper_128_idle_gpt.png",
        "f_guardian_80_idle_gpt.png": v1 / "s2_octopath_64_idle_gpt.png",
    }
    for dst_name, src in mapping.items():
        dst = RAW_DIR / dst_name
        if src.exists() and not dst.exists():
            shutil.copy2(src, dst)
            print(f"[SEED] {src.name} -> {dst.name}", flush=True)


def prepare_worker_home(tag: str) -> Path:
    wh = Path(f"/tmp/codex_v2_{tag}")
    wh.mkdir(parents=True, exist_ok=True)
    dst_auth = wh / "auth.json"
    shutil.copy2(MASTER_AUTH, dst_auth)
    os.chmod(dst_auth, 0o600)
    return wh


def generate_one(sid: str, pose: str, force: bool = False) -> tuple[str, str, Path]:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROMPT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RAW_DIR / f"{sid}_{pose}_gpt.png"
    if out_path.exists() and not force:
        print(f"[SKIP] {out_path.name} already exists", flush=True)
        return sid, pose, out_path
    if out_path.exists():
        out_path.unlink()

    st = STYLES[sid]
    prompt_key = "idle_prompt" if pose == "idle" else "strike_prompt"
    if prompt_key not in st:
        raise ValueError(f"No {prompt_key} defined for {sid}")
    prompt = st[prompt_key]
    pfile = PROMPT_DIR / f"{sid}_{pose}.txt"
    pfile.write_text(prompt, encoding="utf-8")

    refs: list[Path] = []
    if pose == "idle":
        refs.append(SYLVIA_PORTRAIT)
    else:
        idle_path = RAW_DIR / f"{sid}_idle_gpt.png"
        if not idle_path.exists():
            raise FileNotFoundError(f"Missing idle anchor: {idle_path}")
        refs.append(idle_path)
        refs.append(SYLVIA_PORTRAIT)

    wh = prepare_worker_home(f"{sid}_{pose}")
    cmd = [
        sys.executable,
        str(CODEX_IMGGEN),
        "--prompt-file",
        str(pfile),
        "-o",
        str(out_path),
        "--codex-home",
        str(wh),
    ]
    for r in refs:
        cmd.extend(["-i", str(r)])

    print(f"[GEN] {sid} · {pose} starting...", flush=True)
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not out_path.exists():
        raise RuntimeError(f"Failed {sid}/{pose} (rc={res.returncode}):\n{res.stdout}\n{res.stderr}")
    print(f"[OK]  {sid} · {pose} -> {out_path.name}", flush=True)
    return sid, pose, out_path


def convert_one(sid: str, lock_pitch: float = 0.0) -> None:
    st = STYLES[sid]
    idle_p = RAW_DIR / f"{sid}_idle_gpt.png"
    strike_p = RAW_DIR / f"{sid}_strike_gpt.png"
    out_js = JS_DIR / f"{sid}.js"
    lp = lock_pitch if lock_pitch > 0 else float(st.get("pitch_hint", 0.0))
    cmd = [
        sys.executable,
        str(CONVERTER),
        "--id",
        sid,
        "--idle",
        str(idle_p),
        "--strike",
        str(strike_p),
        "--w",
        str(st["w"]),
        "--h",
        str(st["h"]),
        "--ground-y",
        str(st["ground_y"]),
        "--char-h",
        str(st["char_h"]),
        "--colors",
        str(st["colors"]),
        "--facing",
        "right",
        "--audit-dir",
        str(AUDIT_DIR),
        "--out-js",
        str(out_js),
    ]
    if lp > 0:
        cmd.extend(["--lock-pitch", str(lp)])
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Convert failed {sid}:\n{res.stdout}\n{res.stderr}")
    print(f"[CONV] {sid}:\n{res.stdout.strip()}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", choices=["seed_idle", "strike", "convert"], required=True)
    ap.add_argument("--styles", nargs="*", default=list(STYLES.keys()))
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    if args.phase == "seed_idle":
        seed_verified_winners()
        todo = [s for s in args.styles if "idle_prompt" in STYLES[s]]
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = [ex.submit(generate_one, sid, "idle", args.force) for sid in todo]
            for f in as_completed(futs):
                f.result()
    elif args.phase == "strike":
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = [ex.submit(generate_one, sid, "strike", args.force) for sid in args.styles]
            for f in as_completed(futs):
                f.result()
    elif args.phase == "convert":
        for sid in args.styles:
            convert_one(sid)


if __name__ == "__main__":
    main()
