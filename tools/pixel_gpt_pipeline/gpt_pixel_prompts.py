#!/usr/bin/env python3
"""Unified GPT (chatgpt-2 via codex_imggen.py) pixel-art prompt planner & batch runner.

Supports TWO distinct unified pixel-density tiers for side-by-side comparison:
- tier64 (Chunky Classic 16-bit GBA/SNES Chibi, 3x integer display = 192px):
    * Bold simplified retro shapes (NO tiny filigree/chains), big chunky ~20px pixel blocks
    * Humanoids:  1:1 square -> 64x64   (char height 54/58px, ground y=60)
    * Quadrupeds: 3:2 wide   -> 96x64   (char height 54/58px, ground y=60)
- tier128 (Flagship Commercial 32-bit JRPG Pixel, native gpt-image-2 1:1 lattice, 2x display = 224-256px):
    * Native crisp ~9.8px pixel blocks on 1254x1254 -> exact 1:1 128x128 true pixel grid (zero rescale blur!)
    * Humanoids:  1:1 square -> 128x128 (char height 108-114px, ground y=122)
    * Quadrupeds: 3:2 wide   -> 192x128 square grid, cropped cleanly to 160x128 (ground y=122)
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PIPE_DIR = Path(__file__).resolve().parent
RAW_BASE = PIPE_DIR / "raw_gpt"
PROMPT_BASE = PIPE_DIR / "prompts"
CODEX_IMGGEN = REPO_ROOT / "tools" / "art_pipeline" / "codex_imggen.py"

TIERS = {
    "tier64": {
        "label": "Tier A · 64×64 人形 / 96×64 魔兽（复古经典 16-bit Q 版，3× = 192px）",
        "pitch_desc": "粗大明显的约 16～20×16～20 正方形大像素块",
        "display_int_scale": 3,
        "chroma_bg": "#FF00FF",
        "humanoid": {"gpt_size": "1024x1024", "prompt_grid": "64×64", "grid_w": 64, "grid_h": 64, "ground_y": 60, "target_h_px": 54, "max_colors": 26},
        "humanoid_tall": {"gpt_size": "1024x1024", "prompt_grid": "64×64", "grid_w": 64, "grid_h": 64, "ground_y": 60, "target_h_px": 58, "max_colors": 26},
        "quadruped": {"gpt_size": "1536x1024", "prompt_grid": "96×64", "grid_w": 96, "grid_h": 64, "ground_y": 60, "target_h_px": 54, "max_colors": 26},
        "boss": {"gpt_size": "1536x1024", "prompt_grid": "96×64", "grid_w": 96, "grid_h": 64, "ground_y": 60, "target_h_px": 58, "max_colors": 28},
    },
    "tier128": {
        "label": "Tier B · 128×128 人形 / 160×128 魔兽（商业高精 32-bit 日系像素，2× = 256px）",
        "pitch_desc": "规整清晰的约 10×10 正方形像素块",
        "display_int_scale": 2,
        "chroma_bg": "#FF00FF",
        "humanoid": {"gpt_size": "1024x1024", "prompt_grid": "128×128", "grid_w": 128, "grid_h": 128, "ground_y": 122, "target_h_px": 110, "max_colors": 36},
        "humanoid_tall": {"gpt_size": "1024x1024", "prompt_grid": "128×128", "grid_w": 128, "grid_h": 128, "ground_y": 122, "target_h_px": 116, "max_colors": 36},
        "quadruped": {"gpt_size": "1536x1024", "prompt_grid": "192×128（居中主图区 160×128）", "grid_w": 160, "grid_h": 128, "ground_y": 122, "target_h_px": 108, "max_colors": 36},
        "boss": {"gpt_size": "1536x1024", "prompt_grid": "192×128（居中主图区 160×128）", "grid_w": 160, "grid_h": 128, "ground_y": 122, "target_h_px": 116, "max_colors": 38},
    },
}

ROSTER: dict[str, dict] = {
    "sylvia_silver": {
        "name": "希尔维亚（银发本尊）",
        "kind": "humanoid",
        "facing": "right",
        "ref": "assets/portraits/sylvia_teenage_normal.png",
        "pilot": True,
        "design": (
            "14岁银白长发蓝宝石眼眸的贵族少女剑士希尔维亚（严格还原IMAGE 1外貌）。"
            "齐刘海加长鬓发、脑后深蓝蝴蝶结与金框蓝宝石发饰、冷淡优雅神情；"
            "身穿白衬衣、深海蓝滚金边学院马甲、深蓝百褶短裙（金边下摆）、白色及膝长袜、深蓝金边短靴；"
            "右手平握一把晶莹冰蓝细剑（金护手），左臂微抬保持击剑平衡。"
        ),
        "design_chunky": (
            "14岁银白长发蓝瞳少女剑士希尔维亚（还原IMAGE 1配色与发型，做复古 64×64 像素简化）："
            "大颗粒银白长发、脑后简洁深蓝蝴蝶结、清晰大颗蓝宝石像素眼、冷淡小嘴；"
            "简洁白领+深蓝马甲与短裙（用粗金边色块概括，不画细碎花纹链条）、白袜蓝靴；右手平持简洁冰蓝像素细剑。"
        ),
        "strike_pose": (
            "严格基于 IMAGE 1 同一角色希尔维亚（100% 锁定外貌、发色、服饰、配色、像素颗粒粗细与脚底高度），"
            "将姿势改为【极速冰锋突刺攻击】：身体大幅向右前倾弓步蹬地、银白长发与深蓝裙摆向左侧烈烈飘扬，"
            "右臂完全水平向右前方全力刺出冰蓝细剑，剑身周围带几块干脆的纯实色冰蓝/纯白像素星芒碎片（严禁任何半透明柔光光晕）。"
        ),
    },
    "beatrice": {
        "name": "贝阿特丽丝",
        "kind": "humanoid",
        "facing": "left",
        "ref": "assets/portraits/beatrice_teenage_normal.png",
        "pilot": True,
        "design": (
            "16岁金发蓝眸元气阳光少女剑士贝阿特丽丝（严格还原IMAGE 1外貌）。"
            "耀眼金色高马尾配鲜红大蝴蝶结、明亮湛蓝大眼与自信爽朗露齿笑；"
            "身穿绯红滚金边贵族立领短外套（白蕾丝胸巾）、绯红金边百褶裙、白短袜、红金短靴；"
            "面向左侧，右手自信平持或斜举一把华丽炎红金纹长剑，左手叉腰或微抬保持战姿。"
        ),
        "design_chunky": (
            "16岁金发蓝瞳元气少女剑士贝阿特丽丝（还原IMAGE 1配色与高马尾，做复古 64×64 像素简化）："
            "大颗粒耀眼金发高马尾配鲜红蝴蝶结、明亮大颗湛蓝像素眼与元气笑容；"
            "简洁绯红金边短外套与红裙（用大色块概括，不画细碎蕾丝）、白袜红靴；面向左侧持炎红金柄像素长剑。"
        ),
        "strike_pose": (
            "严格基于 IMAGE 1 同一角色贝阿特丽丝（100% 锁定外貌、金发高马尾、红金裙装、像素颗粒粗细与脚底高度），"
            "将姿势改为【炽焰突进挥斩】：身体向左前方猛冲压低弓步、金色高马尾向右后方高高飞扬，"
            "双手或右手向左前方全力横挥炎红长剑，剑刃绽出干脆的纯实色橙红/金黄/纯白像素火焰块（严禁半透明模糊光晕）。"
        ),
    },
    "wolf_alpha": {
        "name": "灰棘头狼",
        "kind": "quadruped",
        "facing": "left",
        "ref": "assets/monsters/wolf_alpha.png",
        "pilot": True,
        "design": (
            "凶猛矫健的北境冰原魔兽【灰棘头狼】（严格还原IMAGE 1全部特征与真实四足解剖比例）。"
            "四足稳稳着地、侧面 3/4 站姿面向左侧；银灰厚实狼毛与颈背浓密鬃毛、蓬松翘尾、"
            "头顶生出分叉剔透的冰蓝鹿角状晶角、脊背沿中线排列一排锋利淡蓝冰晶背刺、猩红凶戾双眸、微张獠牙低吼；"
            "四肢肌肉结实、黑爪锐利，四爪均停在底部水平线上。"
        ),
        "design_chunky": (
            "北境冰原魔兽【灰棘头狼】（还原IMAGE 1配色、冰鹿角、脊刺与四足姿态，做复古 96×64 像素简化）："
            "粗大清晰像素块绘出的凶猛银灰巨狼，面向左侧四足站立；清晰分叉冰蓝鹿角、背脊数根简洁冰蓝背刺、醒目猩红像素眼与白獠牙、蓬松灰尾。"
        ),
        "strike_pose": (
            "严格基于 IMAGE 1 同一只灰棘头狼（100% 锁定银灰毛色、冰蓝鹿角、背刺、红眼与像素颗粒粗细），"
            "将姿势改为【寒霜扑咬猛击】：后腿发力蹬地、整个狼身向左前方剧烈伸展压低扑出，"
            "前爪张开狠狠向左前方挥拍、大口獠牙凶猛咬合，利爪前飞溅数颗纯实色冰蓝/纯白像素冰屑（严禁半透明光晕）。"
        ),
    },
}


def build_prompt(char_id: str, tier_id: str = "tier128", pose: str = "idle", has_style_anchor: bool = False) -> str:
    cfg = ROSTER[char_id]
    tier = TIERS[tier_id]
    spec = tier[cfg["kind"]]
    gh = spec["grid_h"]
    target_h = spec["target_h_px"]
    ground_y = spec["ground_y"]
    h_pct = round(target_h / gh * 100)
    max_col = spec["max_colors"]
    facing_cn = "向右（面向画面右侧）" if cfg["facing"] == "right" else "向左（面向画面左侧）"

    if tier_id == "tier64":
        style_core = (
            "【强约束：低分辨率复古 16-bit 大颗粒像素风（严禁画成高精细小像素！）】"
            "必须像《火焰纹章 GBA》《星露谷物语》《八方旅人》那种肉眼清晰可见每一颗粗大方块像素的经典 64×64 Sprite："
            "造型大胆概括、头部约占身高 45%（1.8头身超萌 Q 版）、眼睛用约 4×5 颗大像素块清晰点出瞳孔与白高光，"
            "彻底省略细碎蕾丝/细金链/微雕花纹，只保留最核心、最醒目的大色块轮廓！"
        )
    else:
        style_core = (
            "【商业日式 32-bit 高精像素 RPG 标杆质感】参考《碧蓝幻想》《魔界战记》《星之海洋 2R》顶尖二次元像素战斗立绘："
            "造型精致可爱、2.3头身完美比例、色彩明快通透、色块层次干净利落、每一颗像素方正锐利无模糊。"
        )

    if has_style_anchor:
        if cfg["kind"] in ("quadruped", "boss"):
            anchor_line = (
                "【风格与像素颗粒绝对锁定】严格对齐 IMAGE 2 的像素方块粗细（单颗像素边长与 IMAGE 2 完全一致！）、赛璐璐像素明暗质感、彩色暗轮廓线粗细与底部踩地水平线，"
                "同时保持魔兽真实凶猛的四足野兽解剖比例（绝不画成 Q 版大头娃娃），确保与 IMAGE 2 同屏战斗浑然一体。"
            )
        else:
            anchor_line = (
                "【风格与像素颗粒绝对锁定】严格对齐 IMAGE 2 的像素方块粗细（单颗像素边长与 IMAGE 2 完全一致！）、头身比例、眼睛画法、彩色暗轮廓线粗细与双脚踩底水平线，"
                "确保与 IMAGE 2 并肩/对决时看起来出自同一位像素画师之手。"
            )
    else:
        anchor_line = style_core

    if pose == "idle":
        pose_desc = cfg["design_chunky"] if (tier_id == "tier64" and "design_chunky" in cfg) else cfg["design"]
    else:
        pose_desc = cfg["strike_pose"]
    pose_tag = "战斗待机站姿（IDLE）" if pose == "idle" else "动态攻击出招帧（STRIKE）"

    aspect_note = "1:1 正方形构图" if spec["gpt_size"] == "1024x1024" else "3:2 横版宽幅构图（确保长条形狼身/鹿角/长尾完全容纳且像素仍为严格正方形）"

    return (
        f"为二次元西幻 JRPG 战斗舞台绘制单个角色的【纯正原生像素网格战斗立绘 · {pose_tag}】。\n"
        f"{anchor_line}\n"
        f"{style_core if has_style_anchor and tier_id == 'tier64' else ''}\n\n"
        f"【严格像素分辨率与比例规范（必须 100% 遵守）】\n"
        f"1. 画布比例与像素网格：{aspect_note}，逻辑像素网格严格为 {spec['prompt_grid']}（每颗逻辑像素为{tier['pitch_desc']}，横纵严格对齐方格网格，绝不允许出现混合大小像素 mixels 或高分辨率平滑细线！）。\n"
        f"2. 视角与朝向：纯 2D 横版回合制战斗微侧 3/4 视角，角色全身严格{facing_cn}。\n"
        f"3. 统一构图占比与基准线：角色完整全身居中绘制，站立高度严格占画布总高度的约 {h_pct}%（相当于 {target_h}/{gh} 逻辑像素）；双脚/四爪踩底基准线严格停在距画布底边约 5%（第 {ground_y}/{gh} 行）的水平线上；头顶、剑尖、发尾、鹿角与尾巴四周留足安全边距，绝不裁切任何边缘。\n"
        f"4. 纯色抠图底色：背景必须是 100% 绝对平涂、毫无渐变、毫无杂色的纯洋红 {tier['chroma_bg']}；严禁画地面阴影、严禁画地平线、严禁画景物、严禁任何文字/网格线/边框/水印。\n"
        f"5. 像素着色铁律：总色数控制在 {max_col - 6}～{max_col} 色；纯硬边赛璐璐像素上色，严禁抗锯齿模糊、严禁柔光半透明羽化、严禁喷枪渐变；角色最外圈使用与各部位同色系的 1 逻辑像素深色轮廓线（银发用深蓝紫、金发用深棕、皮肤用深暖褐，不用死黑 #000000）。\n\n"
        f"【角色设定与动作】\n{pose_desc}\n"
    )


def run_one(char_id: str, tier_id: str, pose: str, style_anchor: Path | None, codex_home: Path | None, force: bool) -> Path:
    cfg = ROSTER[char_id]
    raw_dir = RAW_BASE / tier_id
    prompt_dir = PROMPT_BASE / tier_id
    raw_dir.mkdir(parents=True, exist_ok=True)
    prompt_dir.mkdir(parents=True, exist_ok=True)

    out_path = raw_dir / f"{char_id}_{pose}_gpt.png"
    if out_path.exists():
        if not force:
            print(f"[SKIP] 已存在: {out_path}")
            return out_path
        out_path.unlink()

    refs: list[Path] = []
    if pose == "idle":
        ref_art = REPO_ROOT / cfg["ref"]
        if ref_art.exists():
            refs.append(ref_art)
        if style_anchor and style_anchor.exists() and char_id != "sylvia_silver":
            refs.append(style_anchor)
    else:
        idle_ref = style_anchor if (style_anchor and style_anchor.exists()) else (raw_dir / f"{char_id}_idle_gpt.png")
        if idle_ref.exists():
            refs.append(idle_ref)
        ref_art = REPO_ROOT / cfg["ref"]
        if ref_art.exists():
            refs.append(ref_art)

    prompt = build_prompt(char_id, tier_id, pose, has_style_anchor=(len(refs) >= 2 and pose == "idle"))
    pfile = prompt_dir / f"{char_id}_{pose}.txt"
    pfile.write_text(prompt, encoding="utf-8")

    cmd = [sys.executable, str(CODEX_IMGGEN), "--prompt-file", str(pfile), "-o", str(out_path)]
    if codex_home:
        cmd.extend(["--codex-home", str(codex_home)])
    for r in refs:
        cmd.extend(["-i", str(r)])

    print(f"[GPT chatgpt-2 | {tier_id}] 生成 {char_id} ({cfg['name']}) · {pose} ...")
    res = subprocess.run(cmd, check=False)
    if res.returncode != 0 or not out_path.exists():
        raise RuntimeError(f"生图失败: {tier_id}/{char_id}/{pose} (rc={res.returncode})")
    return out_path


def main() -> None:
    ap = argparse.ArgumentParser(description="统一规格 GPT (chatgpt-2) 像素战斗立绘生图管线（tier64 复古 vs tier128 商业高精）")
    ap.add_argument("--tier", choices=["tier64", "tier128"], default="tier128")
    ap.add_argument("--chars", nargs="*", default=["sylvia_silver", "beatrice", "wolf_alpha"])
    ap.add_argument("--poses", nargs="*", default=["idle", "strike"])
    ap.add_argument("--style-anchor", type=Path, default=None)
    ap.add_argument("--codex-home", type=Path, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    anchor = args.style_anchor
    for cid in args.chars:
        for pose in args.poses:
            out = run_one(cid, args.tier, pose, anchor, args.codex_home, args.force)
            if cid == "sylvia_silver" and pose == "idle" and anchor is None:
                anchor = out


if __name__ == "__main__":
    main()
