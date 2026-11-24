#!/usr/bin/env python3
"""Unified GPT (chatgpt-2 via codex_imggen.py) pixel-art prompt planner & batch runner.

Locks ONE coherent logical pixel density (1 logical pixel = 16x16 GPT output pixels),
canonical canvas sizes (64x64 on 1024x1024 for humanoids; 96x64 on 1536x1024 for beasts/bosses),
shared ground baseline (y=60), facing, palette discipline, and style-anchor chaining so every
character matches as one cohesive commercial JRPG sprite cast.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PIPE_DIR = Path(__file__).resolve().parent
RAW_DIR = PIPE_DIR / "raw_gpt"
PROMPT_DIR = PIPE_DIR / "prompts"
CODEX_IMGGEN = REPO_ROOT / "tools" / "art_pipeline" / "codex_imggen.py"

# Unified specification (1 logical pixel = 16x16 screen pixels on GPT's native 1024/1536 canvas)
UNIFIED_SPEC = {
    "logical_px_pitch": 16,
    "humanoid": {"gpt_size": "1024x1024", "grid_w": 64, "grid_h": 64, "ground_y": 60, "target_h_px": 54},
    "humanoid_tall": {"gpt_size": "1024x1024", "grid_w": 64, "grid_h": 64, "ground_y": 60, "target_h_px": 58},
    "quadruped": {"gpt_size": "1536x1024", "grid_w": 96, "grid_h": 64, "ground_y": 60, "target_h_px": 54},
    "boss": {"gpt_size": "1536x1024", "grid_w": 96, "grid_h": 64, "ground_y": 60, "target_h_px": 58},
    "chroma_bg": "#FF00FF",
    "display_int_scale": 3,  # 64x64 -> 192x192px, 96x64 -> 288x192px (zero fractional blur)
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
            "齐刘海加右侧长鬓发、脑后深蓝蝴蝶结与镶金蓝宝石胸针、冷淡优雅神情；"
            "身穿白衬衣、深海蓝滚金边学院马甲、深蓝百褶短裙（下摆细金边）、白色及膝长袜、深蓝金边短靴；"
            "右手平握一把晶莹冰蓝细剑（金护手），左臂自然微抬保持击剑平衡。"
        ),
        "strike_pose": (
            "同一角色希尔维亚（100%锁定外貌、发色、服饰、配色与像素块大小），姿势改为【极速冰锋突刺攻击】：身体大幅前倾右脚弓步蹬地、银发与深蓝裙摆向后烈烈飘扬，右臂完全水平向右前方刺出晶莹冰蓝细剑，剑尖凝结少量 crisp 像素风冰晶星芒（仅限实色像素块，禁止柔光半透明光晕）。"
        ),
    },
    "sylvia_disguise": {
        "name": "希尔维亚（眷寒渔·黑发伪装）",
        "kind": "humanoid",
        "facing": "right",
        "ref": "assets/portraits/sylvia_disguise_normal.png",
        "pilot": False,
        "design": (
            "14岁黑发墨绿眼眸旅装少女剑士眷寒渔（严格还原IMAGE 1外貌）。"
            "墨黑长发用深绿细布发带束成低马尾、墨绿色沉静眼眸；"
            "身穿素雅灰青旅装短褂配深棕腰带、深灰长裤与实用皮靴；右手持古朴乌木长剑（剑刃带极淡寒冰反光）。"
        ),
        "strike_pose": (
            "同一角色眷寒渔，姿势改为【斜撩斩击】：身体前冲弓步、黑色马尾后扬，双手握乌木长剑向右上方挥出干脆像素剑弧。"
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
            "面向左侧，双手或右手自信握持一把华丽炎红金纹长剑（待机斜指左下或架在身侧）。"
        ),
        "strike_pose": (
            "同一角色贝阿特丽丝（100%锁定外貌、金发高马尾、红金裙装与像素块大小），姿势改为【炽焰突进挥斩】：身体向左前冲压低重心、金色高马尾向右后方飞扬，长剑向左前方全力横挥，剑身跃动明快实色像素火焰（橙黄白纯色像素块，禁止半透明光晕）。"
        ),
    },
    "alice": {
        "name": "爱丽丝",
        "kind": "humanoid",
        "facing": "left",
        "ref": "assets/portraits/alice_teenage_normal.png",
        "pilot": False,
        "design": (
            "12岁温柔内敛金发碧眸少女爱丽丝（严格还原IMAGE 1外貌，身高略矮于希尔维亚约2像素）。"
            "柔和浅金披肩长发配淡蓝发带、恬静浅蓝眼眸；"
            "身穿淡粉白欧式贵族短裙配白围裙边与短靴，面向左侧双手持一柄轻巧银辉短剑摆出防御架势。"
        ),
        "strike_pose": (
            "同一角色爱丽丝，姿势改为【轻盈突刺】：小步向左前踏出、发丝轻扬，银辉短剑平直向左点刺。"
        ),
    },
    "aino": {
        "name": "艾诺",
        "kind": "humanoid",
        "facing": "left",
        "ref": "assets/portraits/aino_normal.png",
        "pilot": False,
        "design": (
            "清冷银白长发冰蓝眼眸少女法师艾诺（严格还原IMAGE 1外貌）。"
            "左耳侧编发配冰晶雪花发夹与深蓝丝带、高冷寡言表情；"
            "身穿深蓝雪纹高领学院披风礼服与过膝白袜深蓝靴，面向左侧单手轻托一颗菱形剔透像素冰晶施法。"
        ),
        "strike_pose": (
            "同一角色艾诺，姿势改为【冰晶齐射施法】：深蓝披风向后鼓动、右臂向左前伸展，指尖凝出三枚锐利纯色像素冰棱。"
        ),
    },
    "noelle": {
        "name": "诺艾儿",
        "kind": "humanoid",
        "facing": "left",
        "ref": "assets/portraits/noelle_normal.png",
        "pilot": False,
        "design": (
            "棕色短发琥珀眼眸严谨学院派少女法师诺艾儿（严格还原IMAGE 1外貌）。"
            "身穿深海蓝带兜帽金边学院法袍与短靴，面向左侧手持雕银水蓝法杖，另一手翻开一本摊开的魔法书。"
        ),
        "strike_pose": (
            "同一角色诺艾儿，姿势改为【水刃术咏唱释放】：高举水蓝法杖向前一点，杖尖绽出 crisp 像素水环。"
        ),
    },
    "rowan": {
        "name": "罗文（晦轮杖）",
        "kind": "humanoid_tall",
        "facing": "left",
        "ref": "assets/monsters/rowan_eclipse.png",
        "pilot": False,
        "design": (
            "阴鸷冷峻的宫廷黑袍法师罗文（严格还原IMAGE 1外貌）。"
            "深灰黑长袍带暗紫银月刺绣、苍白冷漠神情，面向左侧手握一柄顶端镶嵌黑紫月蚀环的『晦轮杖』。"
        ),
        "strike_pose": (
            "同一角色罗文，姿势改为【日蚀降临】：黑袍鼓荡、晦轮杖向左前顿地高举，杖顶月蚀环亮起暗紫银白实色像素纹路。"
        ),
    },
    "wind_god_avatar": {
        "name": "风神·岚（化身）",
        "kind": "humanoid_tall",
        "facing": "left",
        "ref": "assets/monsters/wind_god_tempest.png",
        "pilot": False,
        "design": (
            "戴着白青风纹半面具的俊美浮空风神化身（严格还原IMAGE 1外貌）。"
            "青白长发随风飘舞、翡翠青白流云长袍与飘带，面向左侧轻盈离地约3像素浮空，双掌间环绕青翠风刃。"
        ),
        "strike_pose": (
            "同一角色风神岚，姿势改为【岚风裁决】：广袖张开向左前挥落，袖前凝出锐利青白色像素风镰。"
        ),
    },
    "eastwing_commander": {
        "name": "红莲铁幕·东翼指挥官",
        "kind": "humanoid_tall",
        "facing": "left",
        "ref": "assets/monsters/eastwing_commander.png",
        "pilot": False,
        "design": (
            "威严厚重的绯红黑金重甲骑士指挥官（严格还原IMAGE 1外貌）。"
            "全覆式红羽盔甲、暗红披风、厚重肩铠，面向左侧稳健持握一柄巨型绯红重剑。"
        ),
        "strike_pose": (
            "同一角色东翼指挥官，姿势改为【重剑横斩】：沉肩跨步、绯红巨剑由上向左下猛力劈斩，伴随实色暗红像素剑芒。"
        ),
    },
    "corridor_vanguard": {
        "name": "回廊炎术突击队长",
        "kind": "humanoid_tall",
        "facing": "left",
        "ref": "assets/monsters/corridor_vanguard.png",
        "pilot": False,
        "design": (
            "身穿暗红黑金轻甲与火纹披肩的突击队长（严格还原IMAGE 1外貌）。"
            "面向左侧左手持火纹盾牌/法器、右手握炽热短矛或焰杖，警戒战斗站姿。"
        ),
        "strike_pose": (
            "同一角色突击队长，姿势改为【烈焰突刺】：身体前倾压盾，右手武器向左前方猛刺并迸发橙红实色像素火花。"
        ),
    },
    "wolf_alpha": {
        "name": "灰棘头狼",
        "kind": "quadruped",
        "facing": "left",
        "ref": "assets/monsters/wolf_alpha.png",
        "pilot": True,
        "design": (
            "凶猛矫健的北境冰原魔兽【灰棘头狼】（严格还原IMAGE 1全部特征与解剖比例）。"
            "四足着地侧面3/4站姿面向左侧；银灰厚实狼毛、颈背浓密鬃毛与蓬松长尾、头顶长出分叉剔透的冰蓝鹿角状晶角、"
            "脊背沿中线排列一排锋利淡蓝冰晶背刺、猩红凶戾双眸、微张獠牙低吼；四肢肌肉结实、爪尖锐利，完全四足落地。"
        ),
        "strike_pose": (
            "同一只灰棘头狼（100%锁定银灰毛色、冰蓝鹿角、背刺、红眼与像素块大小），姿势改为【寒霜扑咬猛击】：后腿猛蹬、整个狼身向左前方剧烈伸展低伏扑出，前爪张开狠狠拍出、大口獠牙咬合，冰角与利爪带少量 crisp 实色冰蓝像素碎屑（零半透明光晕）。"
        ),
    },
    "pack_wolf": {
        "name": "灰棘狼",
        "kind": "quadruped",
        "facing": "left",
        "ref": "assets/monsters/pack_wolf.png",
        "pilot": False,
        "design": (
            "敏捷凶狠的普通北境魔兽【灰棘狼】（严格还原IMAGE 1，体型略小于灰棘头狼且无大鹿角）。"
            "四足着地侧面3/4面向左侧；深灰银狼毛、背脊少量短小灰蓝冰棘、红瞳龇牙，狩猎低伏站姿。"
        ),
        "strike_pose": (
            "同一只灰棘狼，姿势改为【疾冲撕咬】：四肢拉长向左前扑咬，前爪抓击。"
        ),
    },
    "shadow_jackal": {
        "name": "霜脊影豺",
        "kind": "quadruped",
        "facing": "left",
        "ref": "assets/monsters/shadow_jackal.png",
        "pilot": False,
        "design": (
            "精瘦阴冷的暗紫灰魔兽【霜脊影豺】（严格还原IMAGE 1）。"
            "四足着地侧面3/4面向左侧；细长修长躯干、黑紫暗影皮毛配霜白尖耳与脊背冰刺、幽青/猩红狡诈眼神、锐利细长前爪。"
        ),
        "strike_pose": (
            "同一只霜脊影豺，姿势改为【影爪突袭】：低身疾掠向左挥出锐利双爪。"
        ),
    },
    "abyss_behemoth": {
        "name": "霜渊裂地兽",
        "kind": "boss",
        "facing": "left",
        "ref": "assets/monsters/abyss_behemoth.png",
        "pilot": False,
        "design": (
            "压迫感十足的巨型北境冰岩巨兽【霜渊裂地兽】（严格还原IMAGE 1）。"
            "四足重踏侧面3/4面向左侧；宽厚青灰岩甲脊背嵌满冰晶巨刺、粗壮如柱的前臂巨爪、低垂凶悍兽首与冰蓝发光裂纹。"
        ),
        "strike_pose": (
            "同一只霜渊裂地兽，姿势改为【裂地重砸】：沉重前肢高抬后向左下方猛烈砸地，爪前溅起数块实色像素冰岩碎块。"
        ),
    },
}


def build_prompt(char_id: str, pose: str = "idle", has_style_anchor: bool = False) -> str:
    cfg = ROSTER[char_id]
    spec = UNIFIED_SPEC[cfg["kind"]]
    gw, gh = spec["grid_w"], spec["grid_h"]
    gpt_size = spec["gpt_size"]
    pitch = UNIFIED_SPEC["logical_px_pitch"]
    target_h = spec["target_h_px"]
    h_pct = round(target_h / gh * 100)
    facing_cn = "向右（面向画面右侧）" if cfg["facing"] == "right" else "向左（面向画面左侧）"

    if has_style_anchor:
        if cfg["kind"] in ("quadruped", "boss"):
            anchor_line = (
                "【风格与像素比例绝对锁定】严格对齐 IMAGE 2 的像素颗粒粗细（每个像素格完全等大）、赛璐璐像素明暗层次、彩色暗轮廓线粗细与踩底水平线，同时保持野兽/魔兽真实凶猛的四足解剖比例（绝不画成 Q 版大头娃娃），确保与 IMAGE 2 同台战斗时像素颗粒 100% 统一。"
            )
        else:
            anchor_line = (
                "【风格与像素比例绝对锁定】严格对齐 IMAGE 2 的像素颗粒粗细（每个像素格完全等大）、二头身比例、眼睛画法、彩色暗轮廓线粗细与站立脚底水平线，确保与 IMAGE 2 放在同一个战斗场景中浑然一体。"
            )
    else:
        anchor_line = (
            "【商业日式像素 RPG 标杆质感】参考《八方旅人》《坎公骑冠剑》《火焰纹章 GBA》《碧蓝幻想》顶尖 16-bit/32-bit 二次元像素战斗小人：造型精致可爱、色彩明快通透、色块层次克制干净。"
        )

    pose_desc = cfg["design"] if pose == "idle" else cfg["strike_pose"]
    pose_tag = "战斗待机站姿（IDLE）" if pose == "idle" else "动态攻击出招帧（STRIKE）"

    return (
        f"为二次元西幻 JRPG 战斗舞台绘制单个角色的【严格原生像素网格战斗立绘 · {pose_tag}】。\n"
        f"{anchor_line}\n\n"
        f"【严格像素分辨率与比例规范（必须 100% 遵守）】\n"
        f"1. 输出画布尺寸：{gpt_size}，逻辑像素网格严格为 {gw}×{gh}（即每个逻辑像素严格占 {pitch}×{pitch} 画面像素，横纵完全对齐像素网格，绝不允许出现大小不一的混合像素 mixels、斜切碎像素或高分辨率平滑线条！）。\n"
        f"2. 视角与朝向：纯 2D 横版回合制战斗微侧 3/4 视角，角色全身严格{facing_cn}。\n"
        f"3. 统一构图占比与基准线：角色完整全身居中绘制，站立高度严格占画布总高度的约 {h_pct}%（相当于 {target_h}/{gh} 逻辑像素）；双脚/四爪踩底基准线严格停在距画布底边约 6%（第 60/64 行）的水平线上；头顶、武器、发尾与尾巴四周留足安全边距，绝对不可裁切任何身体或武器边缘。\n"
        f"4. 纯色抠图底色：背景必须是 100% 绝对平涂、毫无渐变、毫无杂色的纯洋红 {UNIFIED_SPEC['chroma_bg']}；严禁画地面阴影、严禁画地平线、严禁画景物、严禁任何文字/网格线/边框/水印。\n"
        f"5. 像素着色铁律：总色数控制在 24～32 色；纯硬边赛璐璐像素上色，严格禁止抗锯齿模糊、禁止柔光半透明羽化、禁止喷枪渐变、禁止杂乱噪点抖动；角色最外圈使用与各部位同色系的 1 逻辑像素深色轮廓线（如银发用深蓝紫描边、金发用深棕描边、皮肤用深暖褐描边，绝不使用死黑 #000000 糊成一团）。\n\n"
        f"【角色设定与动作】\n{pose_desc}\n"
    )


def run_one(char_id: str, pose: str, style_anchor: Path | None, codex_home: Path | None, force: bool) -> Path:
    cfg = ROSTER[char_id]
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROMPT_DIR.mkdir(parents=True, exist_ok=True)

    out_path = RAW_DIR / f"{char_id}_{pose}_gpt.png"
    if out_path.exists() and not force:
        print(f"[SKIP] 已存在: {out_path}")
        return out_path

    refs: list[Path] = []
    if pose == "idle":
        ref_art = REPO_ROOT / cfg["ref"]
        if ref_art.exists():
            refs.append(ref_art)
        if style_anchor and style_anchor.exists() and char_id != "sylvia_silver":
            refs.append(style_anchor)
    else:
        idle_ref = RAW_DIR / f"{char_id}_idle_gpt.png"
        if idle_ref.exists():
            refs.append(idle_ref)
        ref_art = REPO_ROOT / cfg["ref"]
        if ref_art.exists():
            refs.append(ref_art)

    prompt = build_prompt(char_id, pose, has_style_anchor=(len(refs) >= 2 and pose == "idle"))
    pfile = PROMPT_DIR / f"{char_id}_{pose}.txt"
    pfile.write_text(prompt, encoding="utf-8")

    cmd = [sys.executable, str(CODEX_IMGGEN), "--prompt-file", str(pfile), "-o", str(out_path)]
    if codex_home:
        cmd.extend(["--codex-home", str(codex_home)])
    for r in refs:
        cmd.extend(["-i", str(r)])

    print(f"[GPT chatgpt-2] 生成 {char_id} ({cfg['name']}) · {pose} ...")
    res = subprocess.run(cmd, check=False)
    if res.returncode != 0 or not out_path.exists():
        raise RuntimeError(f"生图失败: {char_id}/{pose} (rc={res.returncode})")
    return out_path


def main() -> None:
    ap = argparse.ArgumentParser(description="统一规格 GPT (chatgpt-2) 像素战斗立绘生图管线")
    ap.add_argument("--print-prompts", action="store_true", help="导出并打印先导/全员提示词 JSON 与 TXT")
    ap.add_argument("--pilot", action="store_true", help="仅处理 3 个先导角色 (sylvia_silver, beatrice, wolf_alpha)")
    ap.add_argument("--chars", nargs="*", default=None, help="指定角色 ID 列表")
    ap.add_argument("--poses", nargs="*", default=["idle", "strike"], help="要生成的姿势 (默认 idle strike)")
    ap.add_argument("--style-anchor", type=Path, default=None, help="已审核通过的希尔维亚基准像素图路径")
    ap.add_argument("--codex-home", type=Path, default=None, help="覆盖 CODEX_HOME (默认自动识别 chatgpt-2)")
    ap.add_argument("--force", action="store_true", help="强制覆盖重抽")
    args = ap.parse_args()

    target_ids = args.chars or ([k for k, v in ROSTER.items() if v["pilot"]] if args.pilot else list(ROSTER.keys()))

    if args.print_prompts:
        PROMPT_DIR.mkdir(parents=True, exist_ok=True)
        manifest = {"spec": UNIFIED_SPEC, "prompts": {}}
        for cid in target_ids:
            manifest["prompts"][cid] = {}
            for pose in args.poses:
                has_anchor = (pose == "idle" and cid != "sylvia_silver")
                txt = build_prompt(cid, pose, has_style_anchor=has_anchor)
                (PROMPT_DIR / f"{cid}_{pose}.txt").write_text(txt, encoding="utf-8")
                manifest["prompts"][cid][pose] = {
                    "name": ROSTER[cid]["name"],
                    "ref": ROSTER[cid]["ref"],
                    "kind": ROSTER[cid]["kind"],
                    "grid": f"{UNIFIED_SPEC[ROSTER[cid]['kind']]['grid_w']}x{UNIFIED_SPEC[ROSTER[cid]['kind']]['grid_h']}",
                    "gpt_size": UNIFIED_SPEC[ROSTER[cid]["kind"]]["gpt_size"],
                    "prompt_file": str(PROMPT_DIR / f"{cid}_{pose}.txt"),
                }
        out_json = PROMPT_DIR / "manifest.json"
        out_json.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已写入统一规格提示词清单: {out_json} ({len(target_ids)} 角色 × {len(args.poses)} 帧)")
        return

    anchor = args.style_anchor
    for cid in target_ids:
        for pose in args.poses:
            out = run_one(cid, pose, anchor, args.codex_home, args.force)
            if cid == "sylvia_silver" and pose == "idle" and anchor is None:
                anchor = out


if __name__ == "__main__":
    main()
