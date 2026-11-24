"""《转生千金》1.5 卷全自动防断电/防关机断点续传美术量产管线。

设计铁律（防中途关电脑）：
1. 原子级台账：每次状态变更均通过 .tmp + os.replace() 原子落盘，并实时镜像到 Google Drive manifests/。
2. 出 1 张、保 1 张：每生成完 1 张图，立刻做 PIL 完整性校验 +（立绘）防左右截断边缘审计 + 立刻上传 Google Drive
   game_batch_raw/ + 立刻投递单张 Colab GPU 去噪队列单至 jobs/pending/，绝不攒批！
3. 零重复开工：关机重启后执行 `python tools/art_pipeline/batch_runner.py --resume` 自动跳过已完成项，从断点继续。
4. 本机 0 GPU 负载：仅调用云端 chatgpt-2 桥接 (codex_imggen.py) + 轻量 PIL 检查 + gdrive 同步。
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image
import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
PIPE_DIR = Path(__file__).resolve().parent
RAW_DIR = PIPE_DIR / "raw"
PROMPT_DIR = PIPE_DIR / "prompts"
MANIFEST_PATH = PIPE_DIR / "production_manifest.json"
DEFAULT_PLUGIN_CODEX_IMGGEN = Path(
    r"C:\Users\abc\.gemini\config\plugins\pv-character-replacement\skills\codex-pv-character-replacement\scripts\codex_imggen.py"
)


def resolve_codex_imggen_script() -> Path:
    candidates = []
    if os.environ.get("CODEX_IMGGEN_SCRIPT"):
        candidates.append(Path(os.environ["CODEX_IMGGEN_SCRIPT"]))
    candidates.extend([
        PIPE_DIR / "codex_imggen.py",
        DEFAULT_PLUGIN_CODEX_IMGGEN,
    ])
    for cand in candidates:
        if cand.is_file():
            return cand
    return PIPE_DIR / "codex_imggen.py"


CODEX_IMGGEN = resolve_codex_imggen_script()

# Google Drive 目录 ID（已在前序步骤建立）
DRIVE_RAW_FOLDER_ID = os.environ.get("DRIVE_RAW_FOLDER_ID", "1-2MIiAOgUTVj-ILY97cHj514AvlO9HrX")       # KeepColor_Cloud_Pipeline/game_batch_raw
DRIVE_MANIFEST_FOLDER_ID = os.environ.get("DRIVE_MANIFEST_FOLDER_ID", "1XM7YDDGV5axbaWNGiIW5jhlct24PtH1G")  # KeepColor_Cloud_Pipeline/manifests
DRIVE_JOBS_PENDING_ID = os.environ.get("DRIVE_JOBS_PENDING_ID", "16IggHUHpffY5Qxop-oGCrfA9hhqeMkzQ")     # KeepColor_Cloud_Pipeline/jobs/pending
RCLONE_REMOTE = os.environ.get("RCLONE_GDRIVE_REMOTE", "gdrive").rstrip(":")
HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()
HF_REPO_ID = os.environ.get("HF_REPO_ID", "").strip()
HF_REPO_TYPE = os.environ.get("HF_REPO_TYPE", "dataset").strip() or "dataset"


def resolve_repo_path(raw: str | Path) -> Path:
    """将 Windows/Linux 历史绝对路径自动映射为当前运行环境的仓库内绝对路径，保障跨平台零报错迁移。"""
    s = str(raw or "").strip()
    if not s:
        return REPO_ROOT
    direct = Path(s)
    if direct.exists():
        return direct
    norm = s.replace("\\", "/")
    for marker in ("tools/art_pipeline/", "assets/"):
        idx = norm.lower().find(marker)
        if idx != -1:
            return REPO_ROOT / norm[idx:]
    return direct


def resolve_item_raw_path(item: dict) -> Path:
    """确保每个条目的 raw_path 始终指向当前环境的 tools/art_pipeline/raw/<id>.png。"""
    p = resolve_repo_path(item.get("raw_path") or "")
    if not str(item.get("raw_path") or "").strip() or (os.name != "nt" and ":" in str(p)):
        return RAW_DIR / f"{item['id']}.png"
    return p


def utc_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def atomic_write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def build_default_items() -> list[dict]:
    bg_ref_warm = str(REPO_ROOT / "assets/bg/jikan.jpg")
    bg_ref_cool = str(REPO_ROOT / "assets/bg/memorial.jpg")
    p_sylvia = str(REPO_ROOT / "assets/portraits/sylvia_teenage_normal.png")
    p_noelle = str(REPO_ROOT / "assets/portraits/noelle_normal.png")
    p_helena = str(REPO_ROOT / "assets/portraits/helena_normal.png")
    p_aino = str(REPO_ROOT / "assets/portraits/aino_normal.png")
    p_charlotte = str(REPO_ROOT / "assets/portraits/charlotte_normal.png")
    p_jilan = str(REPO_ROOT / "assets/portraits/jilan_normal.png")
    p_ajun = str(REPO_ROOT / "assets/portraits/ajun_normal.png")

    bg_rule = "严格要求：3:2横版(1536x1024)；画面绝不出现任何人物、绝不出现任何文字/招牌字/水印/边框；底部25%留出干净沉稳空间便于叠加Galgame对话框；严格继承参考图细腻日系轻小说厚涂光影与空气透视质感。"
    tachie_rule = "严格Galgame立绘防截断规范：2:3竖版(1024x1536)，纯白(#FFFFFF)无杂物背景，人物居中正面半身至大腿构图，头顶上方留白10%，人物双肩、双臂、衣袖与全部飘逸长发必须完整收束在画面内部，左右两侧距画布边缘严格保留至少12%纯白安全留白（严禁任何头发或衣袖触碰左右边缘被裁断！），日系精品轻小说厚涂立绘画风，禁止任何文字水印。"

    return [
        # ===== Phase 1: 第三卷全套专属背景 (6) + 名场面 CG (3) =====
        {
            "id": "bg_ice_canyon",
            "phase": "vol3_bg",
            "kind": "bg",
            "title": "冰封峡谷前线",
            "game_relpath": "assets/bg/ice_canyon.jpg",
            "css_class": "bg-img-ice-canyon",
            "bgm_type": "sad",
            "refs": [bg_ref_warm],
            "prompt": f"绘制异世界西幻轻小说Galgame场景背景【冰封峡谷前线】。两侧高耸覆盖厚雪与冰凌的灰蓝岩壁，前景覆雪军道与木石防雪矮墙、防风火盆微弱暖光，中景北境灰石哨塔与深蓝旗帜，远景淡雪冰原群山。{bg_rule}",
        },
        {
            "id": "bg_chenglan_guild",
            "phase": "vol3_bg",
            "kind": "bg",
            "title": "澄岚镇冒险者公会大厅",
            "game_relpath": "assets/bg/chenglan_guild.jpg",
            "css_class": "bg-img-chenglan-guild",
            "bgm_type": "peaceful",
            "refs": [bg_ref_warm],
            "prompt": f"绘制异世界西幻轻小说Galgame场景背景【澄岚镇冒险者公会大厅】（东方边镇朴实木构风，继承IMAGE 1温暖厚涂笔触）。挑高厚重原木横梁与木柱，温暖清晨阳光从高窗斜斜洒入木地板，左侧立着挂满泛黄羊皮纸委托单与徽记的巨大木质告示板（纸上只画模糊笔触线条绝不写清晰文字），右侧是沉稳实木接待柜台、铜算盘、账簿与热茶壶，空气里有细微尘埃光束，氛围温暖沉静有烟火气。{bg_rule}",
        },
        {
            "id": "bg_north_forest",
            "phase": "vol3_bg",
            "kind": "bg",
            "title": "澄岚北林冬末落叶寒林",
            "game_relpath": "assets/bg/north_forest.jpg",
            "css_class": "bg-img-north-forest",
            "bgm_type": "battle",
            "refs": [bg_ref_cool],
            "prompt": f"绘制异世界西幻轻小说Galgame场景背景【澄岚北林冬末落叶寒林】（继承IMAGE 1细腻笔触与层次感，但整体色调改为清冷灰褐冬末）。高大光秃的落叶乔木枝干在灰白天幕下交错成网，枯黄落叶与薄霜覆满林间小径与低矮灌木，远处山雾弥漫通往幽暗冷峻的东北岩谷，几缕冷淡冬日光从枝隙斜穿而下，带出野外魔物潜伏的寂静压迫感。{bg_rule}",
        },
        {
            "id": "bg_glow_sheep_hill",
            "phase": "vol3_bg",
            "kind": "bg",
            "title": "星夜萤尾羊缓坡",
            "game_relpath": "assets/bg/glow_sheep_hill.jpg",
            "css_class": "bg-img-glow-sheep-hill",
            "bgm_type": "relax",
            "refs": [bg_ref_cool],
            "prompt": f"绘制异世界西幻轻小说Galgame场景背景【星夜萤尾羊缓坡】（继承IMAGE 1细腻轻小说厚涂质感，改为深邃静谧夏末初春清夜）。深蓝近墨的澄澈夜空满布繁星与淡薄银河，前景是一道长满微风伏草的乡野缓坡与低矮田埂，坡下辽阔原野与远处黑黢黢树林轮廓间漂浮着十几处柔和淡青金色微小萤光光点，月色清凉宁静、充满治愈与温柔寂寥感。{bg_rule}",
        },
        {
            "id": "bg_northwind_tavern",
            "phase": "vol3_bg",
            "kind": "bg",
            "title": "北风堡内城石砌酒馆",
            "game_relpath": "assets/bg/northwind_tavern.jpg",
            "css_class": "bg-img-northwind-tavern",
            "bgm_type": "relax",
            "refs": [bg_ref_warm],
            "prompt": f"绘制异世界西幻轻小说Galgame场景背景【北风堡内城石砌酒馆】（继承IMAGE 1温暖光影质感）。北方严寒边防要塞内的厚重青灰石砌酒馆室内，石壁挂着旧盾牌与铁灯盏，壁炉正燃着噼啪暖橙炉火驱散寒意，前景摆放粗糙实木长桌、粗陶热汤碗与铁皮壶，角落整整齐齐码着几只带铜扣的木质行军药材箱，窗外透出深蓝飘雪夜色，室内暖光与窗外寒雪形成动人冷暖对比。{bg_rule}",
        },
        {
            "id": "bg_border_snowroad",
            "phase": "vol3_bg",
            "kind": "bg",
            "title": "苏秦—赫兰风雪界碑官道",
            "game_relpath": "assets/bg/border_snowroad.jpg",
            "css_class": "bg-img-border-snowroad",
            "bgm_type": "sad",
            "refs": [bg_ref_warm],
            "prompt": f"绘制异世界西幻轻小说Galgame场景背景【苏秦—赫兰风雪界碑官道】（继承IMAGE 1细腻厚涂笔触）。苍茫辽阔的北境冻土荒原，一条被车辙碾出浅痕的覆雪官道蜿蜒伸向远方灰白雪原，路旁矗立着一块风化沧桑、覆满冰霜的古老灰石国境界碑（表面只做风化凿痕绝不写文字）和几株被寒风吹弯的枯松，阴沉铅灰与淡银蓝天际飘落细碎风雪，孤寂苍凉。{bg_rule}",
        },
        {
            "id": "cg_vol3_jikan_parting",
            "phase": "vol3_cg",
            "kind": "cg",
            "title": "CG·霁馆雪晨辞行",
            "game_relpath": "assets/cg/vol3_jikan_parting.png",
            "refs": [bg_ref_warm, p_jilan],
            "prompt": "为二次元轻小说Galgame《转生千金》绘制16:9或3:2横版(1536x1024)情感名场面CG【霁馆晨雾辞行】。参考IMAGE 1东方木构剑馆晨雾院落氛围与IMAGE 2紫蝴蝶发饰黑发活泼少女霁岚的外貌。清晨微雾的霁馆院门外，身穿素雅旅装、用深绿色细布发带束起伪装黑发、墨绿色眼眸的纤细少女（化名眷寒渔，腰佩古朴乌木长剑）背着行囊站在晨光中回眸浅笑挥手；院门口紫蝴蝶发饰的霁岚一手扶着木门框用力朝她挥手，身旁沉稳微笑的中年剑馆主老霁抱臂立在屋檐阴影下，墙头一只胖灰猫蜷着尾巴看雪雾。电影级晨光丁达尔光影，情绪温暖克制带离别余韵，绝无文字水印。",
        },
        {
            "id": "cg_vol3_ice_canyon_clash",
            "phase": "vol3_cg",
            "kind": "cg",
            "title": "CG·冰封峡谷前线重逢",
            "game_relpath": "assets/cg/vol3_ice_canyon_clash.png",
            "refs": [p_aino],
            "prompt": "为二次元轻小说Galgame《转生千金》绘制3:2横版(1536x1024)战斗重逢名场面CG【冰封峡谷前线·冰锋剑影】。严冬暴雪呼啸的北境冰封峡谷岩壁下，前景左侧是黑发深绿发带、墨绿眼眸、手持覆着薄透明冰锋的乌木长剑的灵动少女剑士（眷寒渔）正滑步闪避冰屑；右侧远几步外，参考IMAGE 1银白长发冰蓝眼眸、身披深蓝雪纹边防披风与校服的冷清少女艾诺抬手凝结剔透星芒冰晶，微怔目光落在对方冰膜剑锋的左下角。漫天飞雪与冰晶寒光交织，电影级高对比光影，细节极度精致，绝无文字水印。",
        },
        {
            "id": "cg_vol3_ash_snow",
            "phase": "vol3_cg",
            "kind": "cg",
            "title": "CG·维斯特利亚灰烬雪夜",
            "game_relpath": "assets/cg/vol3_ash_snow.png",
            "refs": [bg_ref_cool],
            "prompt": "为二次元轻小说Galgame《转生千金》绘制3:2横版(1536x1024)史诗悲怆名场面CG【维斯特利亚冬夜灰烬雪】。寒冬午夜，远方巍峨的白金欧式公爵府城堡与尖顶轮廓被半边冲天暗橙火光映红，大片洁白初雪飘落时经过火光被染成残忍的暖橘与灰烬色，仿佛整座领城正下着一场灰烬做的雪；前景冷蓝暗影的雪地石渠口外，一道娇小银发少女背影（披着厚重深色斗篷，怀中紧紧按着一只带铜锁的小本子）独自站在风雪中最后回头望向火海，冷暖冲撞极具史诗张力，绝无文字水印。",
        },

        # ===== Phase 2: 缺失角色 0->1 立绘 (2) + 严重左右截断重制无截断底板 (4) =====
        {
            "id": "portrait_lein_normal",
            "phase": "vol2_3_portraits",
            "kind": "portrait",
            "title": "莱恩·药商学徒立绘（无截断）",
            "game_relpath": "assets/portraits/lein_normal.png",
            "refs": [p_noelle],
            "prompt": f"绘制二次元异世界轻小说Galgame角色立绘【莱恩】（药材商学徒旅伴，17岁爽朗朴实少年，继承IMAGE 1细腻日系线稿与厚涂上色风格）。微乱温暖亚麻棕色短发、清澈明亮茶色眼眸、阳光真诚微微笑容；身穿实用卡其灰亚麻旅行外套、浅米色立领衬衫与棕色皮质斜挎药囊皮带，双手自然微扶肩带（不背过宽突出左右边框的大包）。{tachie_rule}",
        },
        {
            "id": "portrait_peilin_normal",
            "phase": "vol2_3_portraits",
            "kind": "portrait",
            "title": "沛霖·沉稳药商师父立绘（无截断）",
            "game_relpath": "assets/portraits/peilin_normal.png",
            "refs": [p_noelle],
            "prompt": f"绘制二次元异世界轻小说Galgame角色立绘【沛霖】（走南闯北、爱泡茶馆的沉稳药材商师父，38岁温润精明中年男性，继承IMAGE 1细腻日系二次元插画质感）。微带几缕银丝的深褐整齐短发、细长洞察世事的温和深褐眼眸、下颌留极淡整洁胡茬与从容淡笑；身穿深青灰东方行商立领长袍外搭暗棕皮毛滚边短褂，腰悬小药葫芦与铜算盘坠，一手自然轻垂一手微托茶盏式手势，体态收束。{tachie_rule}",
        },
        {
            "id": "portrait_helena_normal",
            "phase": "vol2_3_portraits",
            "kind": "portrait",
            "title": "海伦娜·无截断重构立绘",
            "game_relpath": "assets/portraits/helena_normal.png",
            "refs": [p_helena, p_sylvia],
            "prompt": f"严格还原IMAGE 1金发金瞳圣女交换生【海伦娜】的五官、温暖明亮笑容、浅金长发、白金滚边圣洁头纱（带十字金饰）与白金刺绣高领圣女长袍（胸前金色十字吊坠、双手合十祈祷姿态），画风精度与构图留白完全对齐IMAGE 2。重要修复：拉远镜头至大腿半身构图，完整画出她两侧肩膀、飘落的头纱边缘、宽袖与金色长发末梢，让所有头纱与发丝柔和向内收束，彻底解决原图左右被画布切掉的问题！{tachie_rule}",
        },
        {
            "id": "portrait_aino_normal",
            "phase": "vol2_3_portraits",
            "kind": "portrait",
            "title": "艾诺·无截断重构立绘",
            "game_relpath": "assets/portraits/aino_normal.png",
            "refs": [p_aino, p_sylvia],
            "prompt": f"严格还原IMAGE 1清冷银发冰蓝瞳少女【艾诺】的精致冷淡五官、眼下极淡柔雾腮红、银白长发、左耳侧编发配冰晶雪花发夹与深蓝丝带、高领银蓝雪花徽记深蓝学院礼服外套，画风精度与留白对齐IMAGE 2。重要修复：拉远镜头至半身至大腿构图，完整呈现她双肩与深蓝衣袖，所有银白长发优雅垂落于身侧内收，绝不向左右飞散触碰画布边缘，彻底消除左右截断！{tachie_rule}",
        },
        {
            "id": "portrait_charlotte_normal",
            "phase": "vol2_3_portraits",
            "kind": "portrait",
            "title": "夏洛特·单人无截断重构立绘",
            "game_relpath": "assets/portraits/charlotte_normal.png",
            "refs": [p_charlotte, p_sylvia],
            "prompt": f"严格还原IMAGE 1中央傲娇贵族千金【夏洛特】的精致五官、略带骄傲微扬下巴神态、蓝宝石皇冠、波浪金长发与蓝金丝带、深蓝金绣宫廷礼服与双臂环抱姿态，画风与构图对齐IMAGE 2。重要修复：1）只画夏洛特单人，彻底移除原图背景左右两名女仆！2）拉远镜头至大腿半身，完整画出双肩、蓬松公主袖与向内柔顺垂落的金色卷发，左右留足纯白安全边距零截断！{tachie_rule}",
        },
        {
            "id": "portrait_ajun_normal",
            "phase": "vol2_3_portraits",
            "kind": "portrait",
            "title": "阿琼·无截断重构立绘",
            "game_relpath": "assets/portraits/ajun_normal.png",
            "refs": [p_ajun, p_sylvia],
            "prompt": f"严格还原IMAGE 1角色【阿琼】的五官、发型发色、气质与服饰细节，构图比例与画风对齐IMAGE 2。重要修复：拉远镜头至半身至大腿构图，完整补全被原图切掉的左侧与右侧肩膀、袖口与衣摆，所有轮廓收束在画布安全区内零左右截断！{tachie_rule}",
        },

        # ===== Phase 3: 核心角色高频表情差分 (9 张，以重构后的无截断底板为锚点) =====
        {
            "id": "portrait_aino_serious",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "艾诺·凝重表情差分",
            "game_relpath": "assets/portraits/aino_serious.png",
            "base_item": "portrait_aino_normal",
            "refs": [p_aino],
            "prompt": f"严格锁定参考图IMAGE 1角色艾诺的发型、头饰、姿势、肩膀与深蓝校服 100% 不变（零位移），仅微调面部表情为【凝重戒备】：微蹙银色眉尖、冰蓝眼眸眼神锐利冷静专注、唇线抿紧，眼下保留微淡冷感肌肤质感，其余全部严格一致。{tachie_rule}",
        },
        {
            "id": "portrait_aino_smile",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "艾诺·浅笑表情差分",
            "game_relpath": "assets/portraits/aino_smile.png",
            "base_item": "portrait_aino_normal",
            "refs": [p_aino],
            "prompt": f"严格锁定参考图IMAGE 1角色艾诺的发型、头饰、姿势、肩膀与深蓝校服 100% 不变（零位移），仅微调面部表情为【克制柔和的浅笑】：冰蓝眼眸微微放柔带一丝融雪般暖意、唇角极轻地上扬一点点弧度、脸颊带极淡自然红晕，符合高冷少女罕见卸防的温柔感。{tachie_rule}",
        },
        {
            "id": "portrait_aino_shy",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "艾诺·微赧表情差分",
            "game_relpath": "assets/portraits/aino_shy.png",
            "base_item": "portrait_aino_normal",
            "refs": [p_aino],
            "prompt": f"严格锁定参考图IMAGE 1角色艾诺的发型、头饰、姿势、肩膀与深蓝校服 100% 不变（零位移），仅微调面部表情为【略显局促微赧】：视线微微侧移回避、双颊与耳尖浮起柔和淡粉腮红、嘴角微抿略带窘迫，保留高冷底色下的可爱反差。{tachie_rule}",
        },
        {
            "id": "portrait_jilan_serious",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "霁岚·认真练剑表情差分",
            "game_relpath": "assets/portraits/jilan_serious.png",
            "base_item": None,
            "refs": [p_jilan],
            "prompt": f"严格锁定参考图IMAGE 1紫蝴蝶发饰黑马尾少女霁岚的发型、发饰、淡灰紫练功道服与姿势，脸颊灰尘略少、表情切换为【认真专注】：睁开明亮深紫黑眼眸直视前方、眉头微敛眼神坚定干练、唇线收起不露齿笑，保持清爽无截断留白。{tachie_rule}",
        },
        {
            "id": "portrait_jilan_shy",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "霁岚·害羞脸红表情差分",
            "game_relpath": "assets/portraits/jilan_shy.png",
            "base_item": None,
            "refs": [p_jilan],
            "prompt": f"严格锁定参考图IMAGE 1紫蝴蝶发饰黑马尾少女霁岚的发型、发饰、练功道服与姿势，将面部表情切换为【不好意思的害羞微赧】：睁开清亮眼眸微微飘向一侧、双颊明显泛起柔和红晕、嘴角微抿略带腼腆笑意，干净清爽无截断留白。{tachie_rule}",
        },
        {
            "id": "portrait_jilan_teary",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "霁岚·离别含泪表情差分",
            "game_relpath": "assets/portraits/jilan_teary.png",
            "base_item": None,
            "refs": [p_jilan],
            "prompt": f"严格锁定参考图IMAGE 1紫蝴蝶发饰黑马尾少女霁岚的发型、发饰、练功道服与姿势，将面部表情切换为【强忍不舍的含泪浅笑】：眼眶微红蓄着晶莹泪光却努力弯起嘴角逞强微笑、眉尾轻轻下垂，情绪真挚动人，干净无截断留白。{tachie_rule}",
        },
        {
            "id": "portrait_charlotte_shy",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "夏洛特·傲娇微赧表情差分",
            "game_relpath": "assets/portraits/charlotte_shy.png",
            "base_item": "portrait_charlotte_normal",
            "refs": [p_charlotte],
            "prompt": f"严格锁定参考图IMAGE 1单人金发蓝眸贵族千金夏洛特的皇冠、卷发、蓝金礼服与环抱双臂姿态（绝无女仆），仅将面部表情切换为【傲娇耳根泛红】：蓝眸微微斜睨回避视线、双颊与耳尖浮起明晰柔雾红晕、唇瓣微噘略显嘴硬心软。{tachie_rule}",
        },
        {
            "id": "portrait_charlotte_smile",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "夏洛特·坦诚浅笑表情差分",
            "game_relpath": "assets/portraits/charlotte_smile.png",
            "base_item": "portrait_charlotte_normal",
            "refs": [p_charlotte],
            "prompt": f"严格锁定参考图IMAGE 1单人金发蓝眸贵族千金夏洛特的皇冠、卷发、蓝金礼服与姿态（绝无女仆），仅将面部表情切换为【卸下防备的优雅浅笑】：蓝眸眉眼舒展柔和、嘴角勾起矜持而真诚的淡笑、高贵柔和。{tachie_rule}",
        },
        {
            "id": "portrait_noelle_smile",
            "phase": "vol2_3_diffs",
            "kind": "diff",
            "title": "诺艾儿·放松浅笑表情差分",
            "game_relpath": "assets/portraits/noelle_smile.png",
            "base_item": None,
            "refs": [p_noelle],
            "prompt": f"严格锁定参考图IMAGE 1棕色短发琥珀眼眸深蓝兜帽学院袍少女诺艾儿的发型、服饰与姿势 100% 不变，仅将原本严肃绷紧的表情切换为【罕见放松的温柔浅笑】：紧锁的眉头舒展开来、琥珀色眼眸微微弯起透出明亮神采、唇角浮现自然轻笑与微淡腮红。{tachie_rule}",
        },
    ]


def load_or_init_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text("utf-8"))
    items = []
    for raw_item in build_default_items():
        it = dict(raw_item)
        it.setdefault("status", "pending")
        it.setdefault("raw_path", str(RAW_DIR / f"{it['id']}.png"))
        it.setdefault("drive_file_id", "")
        it.setdefault("colab_job_id", "")
        it.setdefault("crop_audit", None)
        it.setdefault("attempts", 0)
        it.setdefault("last_error", "")
        it.setdefault("updated_at", utc_now())
        items.append(it)
    manifest = {
        "version": 1,
        "project": "fictional-adventure (Vol 2.5 - Vol 3 Art Pipeline)",
        "drive_manifest_file_id": "",
        "created_at": utc_now(),
        "updated_at": utc_now(),
        "items": items,
    }
    atomic_write_json(MANIFEST_PATH, manifest)
    return manifest


def check_portrait_crop(img_path: Path) -> dict:
    """检查立绘左右边缘是否截断（同时兼容透明底与纯白底 PNG）。"""
    im = Image.open(img_path).convert("RGBA")
    arr = np.asarray(im)
    h, w = arr.shape[:2]
    y_lim = int(h * 0.85)
    alpha = arr[:y_lim, :, 3]
    if alpha.min() < 250:
        fg = alpha > 15
    else:
        rgb = arr[:y_lim, :, :3]
        # 纯白底：非接近纯白 (R/G/B 任意 < 242) 视为前景人物像素
        fg = (rgb < 242).any(axis=2)
    left_hits = int(fg[:, :6].sum())
    right_hits = int(fg[:, -6:].sum())
    passed = (left_hits <= 15 and right_hits <= 15)
    return {"passed": passed, "w": w, "h": h, "left_edge_px": left_hits, "right_edge_px": right_hits}


_DRIVE_BACKEND_CACHE: str | None = None
_PY_DRIVE_SERVICE = None
_HF_API = None


def _get_hf_api():
    global _HF_API
    if _HF_API is not None:
        return _HF_API
    from huggingface_hub import HfApi
    api = HfApi(token=HF_TOKEN)
    api.create_repo(repo_id=HF_REPO_ID, repo_type=HF_REPO_TYPE, private=True, exist_ok=True)
    _HF_API = api
    return _HF_API


def detect_drive_backend() -> str:
    """自动检测最优云端存储通道：HF 私有库（Colab 0 弹窗极速首选） -> rclone -> Python Drive API -> gdrive CLI。"""
    global _DRIVE_BACKEND_CACHE
    if _DRIVE_BACKEND_CACHE is not None:
        return _DRIVE_BACKEND_CACHE

    forced = os.environ.get("FA_DRIVE_BACKEND", "").strip().lower()
    if forced in ("hf", "rclone", "pyapi", "gdrive", "none"):
        _DRIVE_BACKEND_CACHE = forced
        return forced

    # 0. Hugging Face Private Repo（Colab Pro+ 后台执行 0 弹窗、不挂 Drive、多卡并发零冲突首选）
    if HF_TOKEN and HF_REPO_ID:
        try:
            import huggingface_hub  # noqa: F401
            _DRIVE_BACKEND_CACHE = "hf"
            print(f"[cloud] 使用通道: Hugging Face 私有库 ({HF_REPO_TYPE}:{HF_REPO_ID}) — 0 弹窗高速直传", flush=True)
            return _DRIVE_BACKEND_CACHE
        except Exception:
            pass

    # 1. rclone（Google Cloud Linux VPS 首选，自动续期 OAuth 且不吃共享插件分钟限流）
    rclone_bin = shutil.which("rclone")
    if rclone_bin:
        try:
            proc = subprocess.run([rclone_bin, "listremotes"], capture_output=True, text=True, timeout=15)
            remotes = [line.strip().rstrip(":") for line in proc.stdout.splitlines() if line.strip()]
            if RCLONE_REMOTE in remotes:
                _DRIVE_BACKEND_CACHE = "rclone"
                print(f"[drive] 使用通道: rclone ({RCLONE_REMOTE}:)", flush=True)
                return _DRIVE_BACKEND_CACHE
        except Exception:
            pass

    # 2. 原生 Python Google Drive API v3（支持用户 OAuth token.json 或 Service Account）
    oauth_tok = Path(os.environ.get("GDRIVE_OAUTH_TOKEN", str(Path.home() / ".config/fa-cloud/gdrive_token.json")))
    sa_file = Path(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", str(Path.home() / ".config/fa-cloud/sa.json")))
    if oauth_tok.is_file() or sa_file.is_file():
        try:
            import googleapiclient.discovery  # noqa: F401
            _DRIVE_BACKEND_CACHE = "pyapi"
            print("[drive] 使用通道: Python Google Drive API v3", flush=True)
            return _DRIVE_BACKEND_CACHE
        except Exception:
            pass

    # 3. 兜底本地 Antigravity gdrive CLI（Windows 默认）
    if shutil.which("gdrive"):
        _DRIVE_BACKEND_CACHE = "gdrive"
        print("[drive] 使用通道: gdrive CLI", flush=True)
        return _DRIVE_BACKEND_CACHE

    _DRIVE_BACKEND_CACHE = "none"
    print("[cloud][WARN] 未检测到已授权云端通道（HF_TOKEN / rclone / OAuth / gdrive），将先本地原子落盘保存！", flush=True)
    return _DRIVE_BACKEND_CACHE


def pull_hf_receipts_into_manifest(manifest: dict) -> int:
    """在 HF 模式下启动时拉取所有分片已上传的原子回执 manifests/receipts/*.json，避免多开 Colab 重复生图。"""
    if detect_drive_backend() != "hf":
        return 0
    try:
        from huggingface_hub import hf_hub_download
        api = _get_hf_api()
        files = api.list_repo_files(repo_id=HF_REPO_ID, repo_type=HF_REPO_TYPE)
        receipt_files = [f for f in files if f.startswith("manifests/receipts/") and f.endswith(".json")]
        if not receipt_files:
            return 0
        by_id = {it["id"]: it for it in manifest["items"]}
        merged = 0
        for rf in receipt_files:
            try:
                local_f = hf_hub_download(repo_id=HF_REPO_ID, repo_type=HF_REPO_TYPE, filename=rf, token=HF_TOKEN)
                rec = json.loads(Path(local_f).read_text("utf-8"))
                it = by_id.get(rec.get("id"))
                if it and rec.get("status") in ("drive_synced", "hf_synced", "qa_passed"):
                    it["status"] = rec["status"]
                    if rec.get("hf_path"):
                        it["hf_path"] = rec["hf_path"]
                    if rec.get("crop_audit"):
                        it["crop_audit"] = rec["crop_audit"]
                    if rec.get("updated_at"):
                        it["updated_at"] = rec["updated_at"]
                    merged += 1
            except Exception:
                continue
        if merged:
            atomic_write_json(MANIFEST_PATH, manifest)
            print(f"[cloud] 已从 HF 私有库合并 {merged} 条已完成回执，自动跳过不重复生成", flush=True)
        return merged
    except Exception as e:
        print(f"[cloud][WARN] 拉取 HF 回执失败（继续使用本地台账）: {e}", flush=True)
        return 0


def _hf_subdir_for_folder(folder_id: str) -> str:
    if folder_id == DRIVE_RAW_FOLDER_ID:
        return "game_batch_raw"
    if folder_id == DRIVE_MANIFEST_FOLDER_ID:
        return "manifests"
    if folder_id == DRIVE_JOBS_PENDING_ID:
        return "jobs/pending"
    return "misc"


def _get_py_drive_service():
    global _PY_DRIVE_SERVICE
    if _PY_DRIVE_SERVICE is not None:
        return _PY_DRIVE_SERVICE
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request

    scopes = ["https://www.googleapis.com/auth/drive"]
    oauth_tok = Path(os.environ.get("GDRIVE_OAUTH_TOKEN", str(Path.home() / ".config/fa-cloud/gdrive_token.json")))
    creds = None
    if oauth_tok.is_file():
        from google.oauth2.credentials import Credentials
        creds = Credentials.from_authorized_user_file(str(oauth_tok), scopes)
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            oauth_tok.write_text(creds.to_json(), encoding="utf-8")
    else:
        import google.auth
        creds, _ = google.auth.default(scopes=scopes)

    _PY_DRIVE_SERVICE = build("drive", "v3", credentials=creds, cache_discovery=False)
    return _PY_DRIVE_SERVICE


def gdrive_run(args: list[str], timeout: int = 60) -> tuple[int, str]:
    try:
        bin_path = shutil.which("gdrive") or "gdrive"
        proc = subprocess.run([bin_path, *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
        return proc.returncode, (proc.stdout + "\n" + proc.stderr).strip()
    except Exception as e:
        return 1, str(e)


def parse_drive_id(out: str) -> str:
    import re
    m = re.search(r"\(ID:\s*([a-zA-Z0-9_\-]+)\)", out)
    return m.group(1) if m else ""


def drive_upload_or_update(local_path: Path, folder_id: str, existing_file_id: str = "", timeout: int = 120) -> tuple[bool, str, str]:
    """统一上传/更新文件到指定 Google Drive 目录，内置指数退避重试，返回 (ok, file_id, err_msg)。"""
    backend = detect_drive_backend()
    if backend == "none":
        return False, existing_file_id, "no_drive_backend"

    last_err = ""
    for attempt in range(1, 5):
        if backend == "hf":
            try:
                api = _get_hf_api()
                sub = _hf_subdir_for_folder(folder_id)
                path_in_repo = f"{sub}/{local_path.name}"
                api.upload_file(
                    path_or_fileobj=str(local_path),
                    path_in_repo=path_in_repo,
                    repo_id=HF_REPO_ID,
                    repo_type=HF_REPO_TYPE,
                    commit_message=f"art-pipeline: sync {path_in_repo}",
                )
                return True, f"hf://{HF_REPO_ID}/{path_in_repo}", ""
            except Exception as e:
                last_err = str(e)

        elif backend == "rclone":
            rclone_bin = shutil.which("rclone") or "rclone"
            target = f"{RCLONE_REMOTE}:{local_path.name}"
            cmd = [
                rclone_bin,
                "copyto",
                str(local_path),
                target,
                "--drive-root-folder-id",
                folder_id,
                "--retries",
                "3",
                "--low-level-retries",
                "5",
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
            if proc.returncode == 0:
                fid = existing_file_id
                try:
                    q = subprocess.run(
                        [rclone_bin, "lsjson", target, "--drive-root-folder-id", folder_id],
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=30,
                    )
                    if q.returncode == 0:
                        arr = json.loads(q.stdout or "[]")
                        if arr and isinstance(arr, list) and arr[0].get("ID"):
                            fid = str(arr[0]["ID"])
                except Exception:
                    pass
                return True, fid, ""
            last_err = (proc.stdout + "\n" + proc.stderr).strip()

        elif backend == "pyapi":
            try:
                from googleapiclient.http import MediaFileUpload
                svc = _get_py_drive_service()
                media = MediaFileUpload(str(local_path), resumable=True)
                if existing_file_id:
                    res = svc.files().update(
                        fileId=existing_file_id,
                        media_body=media,
                        fields="id",
                        supportsAllDrives=True,
                    ).execute()
                else:
                    res = svc.files().create(
                        body={"name": local_path.name, "parents": [folder_id]},
                        media_body=media,
                        fields="id",
                        supportsAllDrives=True,
                    ).execute()
                return True, str(res.get("id") or existing_file_id), ""
            except Exception as e:
                last_err = str(e)

        else:  # gdrive CLI
            if existing_file_id:
                code, out = gdrive_run(["mutate", "update", existing_file_id, str(local_path)], timeout=timeout)
                if code == 0:
                    return True, existing_file_id, ""
                last_err = out
            else:
                code, out = gdrive_run(["mutate", "upload", str(local_path), "--parent", folder_id], timeout=timeout)
                if code == 0:
                    return True, parse_drive_id(out) or existing_file_id, ""
                last_err = out

        # 遇到限流 / 网络抖动则退避重试
        lower = last_err.lower()
        if any(k in lower for k in ("ratelimit", "429", "quota", "timeout", "temporarily", "503", "500")):
            wait_s = min(60, 4 * (2 ** (attempt - 1)))
            print(f"  ⏳ Drive 触发瞬时限流/抖动，{wait_s}s 后第 {attempt}/4 次重试...", flush=True)
            time.sleep(wait_s)
            continue
        break

    return False, existing_file_id, last_err


def sync_manifest_to_drive(manifest: dict) -> None:
    manifest["updated_at"] = utc_now()
    atomic_write_json(MANIFEST_PATH, manifest)
    fid = manifest.get("drive_manifest_file_id") or ""
    ok, new_id, err = drive_upload_or_update(MANIFEST_PATH, DRIVE_MANIFEST_FOLDER_ID, existing_file_id=fid, timeout=60)
    if ok and new_id and new_id != fid:
        manifest["drive_manifest_file_id"] = new_id
        atomic_write_json(MANIFEST_PATH, manifest)
    elif not ok and err != "no_drive_backend":
        print(f"  [WARN] 台账镜像同步暂缓（本地已原子落盘）: {err[:140]}", flush=True)


def sync_item_to_drive_and_queue(item: dict) -> None:
    raw_path = resolve_item_raw_path(item)
    if not raw_path.exists():
        return
    # 1. 上传原图至 Drive/KeepColor_Cloud_Pipeline/game_batch_raw/
    ok, fid, err = drive_upload_or_update(raw_path, DRIVE_RAW_FOLDER_ID, existing_file_id=item.get("drive_file_id") or "", timeout=150)
    if not ok:
        print(f"  [WARN] Drive 上传失败（本地已安全保存，可稍后 --retry-drive 补传）: {err[:160]}", flush=True)
        return
    if fid:
        item["drive_file_id"] = fid
        if fid.startswith("hf://"):
            item["hf_path"] = fid

    # HF 模式下额外上传单条独立原子回执，确保多卡并行分片互不覆盖！
    if detect_drive_backend() == "hf":
        try:
            rec_tmp = PIPE_DIR / f"receipt_{item['id']}.json"
            atomic_write_json(rec_tmp, {
                "id": item["id"],
                "title": item["title"],
                "status": "hf_synced",
                "hf_path": item.get("hf_path", ""),
                "crop_audit": item.get("crop_audit"),
                "updated_at": utc_now(),
            })
            api = _get_hf_api()
            api.upload_file(
                path_or_fileobj=str(rec_tmp),
                path_in_repo=f"manifests/receipts/{item['id']}.json",
                repo_id=HF_REPO_ID,
                repo_type=HF_REPO_TYPE,
                commit_message=f"art-pipeline: receipt {item['id']}",
            )
            rec_tmp.unlink(missing_ok=True)
        except Exception as e:
            print(f"  [WARN] HF 回执写入失败: {e}", flush=True)

    # 2. 投递单张 Colab GPU 队列任务至 Drive/KeepColor_Cloud_Pipeline/jobs/pending/
    job_id = f"game_{item['id']}_{int(time.time())}"
    job_payload = {
        "job_id": job_id,
        "mode": "denoise_batch",
        "input_subdir": "game_batch_raw",
        "files": [raw_path.name],
        "plans": {
            raw_path.name: {
                "scene_summary": item["title"],
                "use_despeckle": False,
                "speck_size": 3,
                "speck_thr": 0.10,
                "sigma": 8.0 if item["kind"] in ("portrait", "diff") else 9.0,
                "use_l0": False,
                "lam": 0.001,
                "soft_sigma": 3.0,
                "protect_raw_targets": [],
                "protect_soft_targets": [],
            }
        },
    }
    job_tmp = PIPE_DIR / f"{job_id}.json"
    atomic_write_json(job_tmp, job_payload)
    jok, _, jerr = drive_upload_or_update(job_tmp, DRIVE_JOBS_PENDING_ID, existing_file_id="", timeout=60)
    try:
        job_tmp.unlink(missing_ok=True)
    except Exception:
        pass
    if jok:
        item["colab_job_id"] = job_id
        print(f"  ☁️ 已秒传 Drive 并排入 Colab GPU 队列: {raw_path.name} -> {job_id}", flush=True)
    else:
        print(f"  [WARN] Colab 工单投递失败（原图已上传 Drive）: {jerr[:140]}", flush=True)


def generate_one(item: dict, manifest: dict) -> bool:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROMPT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = resolve_item_raw_path(item)
    item["raw_path"] = str(out_path)
    tmp_out = out_path.with_suffix(".tmp.png")
    if tmp_out.exists():
        tmp_out.unlink()

    # 若差分项依赖新重制的无截断底板且底板已产出，自动切换参考图为新无截断底板！
    refs = [str(resolve_repo_path(r)) for r in (item.get("refs") or [])]
    base_id = item.get("base_item")
    if base_id:
        base_item = next((x for x in manifest["items"] if x["id"] == base_id), None)
        if base_item:
            base_raw = resolve_item_raw_path(base_item)
            if base_raw.exists():
                refs = [str(base_raw)]

    prompt_text = item["prompt"]
    max_tries = 2 if item["kind"] in ("portrait", "diff") else 1

    for attempt in range(1, max_tries + 1):
        item["attempts"] = int(item.get("attempts", 0)) + 1
        pfile = PROMPT_DIR / f"{item['id']}.txt"
        extra = ""
        if attempt > 1:
            extra = "\n\n【返修纠偏】上一版人物左右触碰画布边缘被裁断！本次务必把镜头再拉远15%，人物缩小居中，让双肩、双臂和全部发梢严格远离左右画布边缘至少15%留白！"
        pfile.write_text(prompt_text + extra, encoding="utf-8")

        cmd = [sys.executable, str(CODEX_IMGGEN), "--prompt-file", str(pfile), "-o", str(tmp_out)]
        for r in refs:
            if Path(r).exists():
                cmd.extend(["-i", str(r)])

        print(f"\n🎨 [{item['id']}] {item['title']} (尝试 {attempt}/{max_tries})...", flush=True)
        t0 = time.time()
        proc = subprocess.run(cmd, check=False)
        if proc.returncode != 0 or not tmp_out.exists() or tmp_out.stat().st_size < 10_000:
            item["last_error"] = f"codex_imggen exit={proc.returncode}"
            sync_manifest_to_drive(manifest)
            continue

        # PIL 完整性校验
        try:
            with Image.open(tmp_out) as im:
                im.verify()
        except Exception as e:
            item["last_error"] = f"corrupt_png: {e}"
            tmp_out.unlink(missing_ok=True)
            sync_manifest_to_drive(manifest)
            continue

        # 立绘防左右截断自动门禁
        if item["kind"] in ("portrait", "diff"):
            audit = check_portrait_crop(tmp_out)
            item["crop_audit"] = audit
            print(f"  📐 立绘防截断检测: {audit}", flush=True)
            if not audit["passed"] and attempt < max_tries:
                print("  ⚠️ 检测到左右触边截断，自动拉远重抽一次...", flush=True)
                tmp_out.unlink(missing_ok=True)
                continue

        # 原子落盘（断电绝不损图！）
        os.replace(tmp_out, out_path)
        item["status"] = "raw_done"
        item["last_error"] = ""
        item["updated_at"] = utc_now()
        print(f"  ✅ 本地原子落盘完成 ({time.time() - t0:.1f}s): {out_path.name} ({out_path.stat().st_size // 1024} KB)", flush=True)

        # 立刻同步 Drive + 投递 Colab 队列 + 镜像台账
        sync_item_to_drive_and_queue(item)
        if item.get("drive_file_id"):
            item["status"] = "drive_synced"
        sync_manifest_to_drive(manifest)
        return True

    return False


def main() -> None:
    ap = argparse.ArgumentParser(description="《转生千金》1.5 卷跨平台防关机断点续传美术量产执行器")
    ap.add_argument("--init-only", action="store_true", help="仅初始化台账并同步云盘")
    ap.add_argument("--phase", default="", help="只跑指定阶段 (vol3_bg | vol3_cg | vol2_3_portraits | vol2_3_diffs)")
    ap.add_argument("--shard", default="", help="多开 Colab 并行分片，例如 1/3、2/3、3/3（按待做序号取模拆分）")
    ap.add_argument("--limit", type=int, default=0, help="本次最多生成 N 张（0 表示跑完该阶段/全部待做项）")
    ap.add_argument("--resume", action="store_true", help="断点续传（默认即跳过已完成项）")
    ap.add_argument("--retry-drive", action="store_true", help="补传所有 raw_done 但未同步 Drive 的本地成品")
    ap.add_argument("--daemon", action="store_true", help="云端 7×24 守护模式：跑完当前队列后轮询重试失败项并低耗待命")
    ap.add_argument("--poll-interval", type=int, default=120, help="守护模式每轮休眠秒数（默认 120s）")
    ap.add_argument("--seed-existing", nargs=2, metavar=("ID", "PATH"), help="导入已生成的本地 PNG 并立刻云盘同步")
    args = ap.parse_args()

    manifest = load_or_init_manifest()

    if args.seed_existing:
        target_id, src_path = args.seed_existing
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        for it in manifest["items"]:
            if it["id"] == target_id:
                dst = resolve_item_raw_path(it)
                shutil.copy2(src_path, dst)
                it["raw_path"] = str(dst)
                it["status"] = "qa_passed"
                it["updated_at"] = utc_now()
                sync_item_to_drive_and_queue(it)
                sync_manifest_to_drive(manifest)
                print(f"✅ 已导入并云盘同步 {target_id}: {dst}")
                return
        raise SystemExit(f"未找到项: {target_id}")

    if args.init_only:
        sync_manifest_to_drive(manifest)
        done_cnt = sum(1 for x in manifest["items"] if x["status"] != "pending")
        print(f"📋 台账就绪: 共 {len(manifest['items'])} 项（已完成 {done_cnt}，待生成 {len(manifest['items']) - done_cnt}）")
        return

    def _retry_unsynced(mf: dict) -> int:
        fixed = 0
        for it in mf["items"]:
            if it.get("status") == "raw_done" and resolve_item_raw_path(it).exists():
                sync_item_to_drive_and_queue(it)
                if it.get("drive_file_id"):
                    it["status"] = "drive_synced"
                    fixed += 1
                sync_manifest_to_drive(mf)
        return fixed

    if args.retry_drive:
        n = _retry_unsynced(manifest)
        print(f"☁️ Drive 补传完成，本次同步 {n} 项", flush=True)
        if not args.resume and not args.daemon:
            return

    shard_idx, shard_total = 0, 1
    if args.shard:
        try:
            a, b = args.shard.split("/")
            shard_idx, shard_total = int(a) - 1, int(b)
            assert 0 <= shard_idx < shard_total
        except Exception:
            raise SystemExit(f"--shard 格式错误（应如 1/3）: {args.shard}")

    while True:
        manifest = load_or_init_manifest()
        pull_hf_receipts_into_manifest(manifest)
        _retry_unsynced(manifest)
        ran = 0
        pending_candidates = [
            it for it in manifest["items"]
            if (not args.phase or it["phase"] == args.phase) and it["status"] == "pending"
        ]
        for idx, it in enumerate(pending_candidates):
            if shard_total > 1 and (idx % shard_total) != shard_idx:
                continue
            generate_one(it, manifest)
            ran += 1
            if args.limit > 0 and ran >= args.limit:
                break

        summary: dict[str, int] = {}
        for it in manifest["items"]:
            summary[it["status"]] = summary.get(it["status"], 0) + 1
        print(f"\n🏁 本轮执行结束（新处理 {ran} 项），当前全局台账状态: {summary}", flush=True)

        if not args.daemon:
            break
        pending_left = summary.get("pending", 0)
        sleep_s = max(30, args.poll_interval) if pending_left == 0 else max(45, args.poll_interval // 2)
        print(f"🌙 [daemon] 剩余 pending={pending_left}，休眠 {sleep_s}s 后继续巡检...", flush=True)
        time.sleep(sleep_s)


if __name__ == "__main__":
    main()
