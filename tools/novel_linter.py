#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动化小说文风与违禁词铁面审校器 (tools/novel_linter.py)

支持扫描任意 .md / .txt 小说原稿、js/story*.js 剧本文件，以及模块化叙事脚本
（js/relics-and-events.js、js/ai-personas.js、js/vn-ux.js 等，支持 glob 通配符），
输出结构化 JSON 报告。
- 默认无参运行时自动扫描 novel/、js/story-vol3.js、js/story-vol4.js、
  js/relics-and-events.js、js/ai-personas.js、js/vn-ux.js（存在即纳入）。
- 存在 error 时始终返回非零退出码 (1)；传入 --strict 时，任何 error 或 warning 均返回非零退出码 (1)。

核心审校规则（西幻 / 异世界轻小说文风护栏）：
1. no_bushi              : 严打 AI 纠正式转折腔（「不是A，而是/却/但/偏偏/反倒B」「并非……，而是……」），
                           允许自然日常语境中合理的单独「不是」（如「我不是故意的」「是不是」等）
2. no_slang_mechanic     : 零技工词、土味口语与违和武侠镖局腔（外面看、法子、冻出、想把.*提上去、老夫、拱手、抱剑行礼、诸位大人、庙堂、申时/戌时等）
3. no_xianxia            : 零修仙玄幻词（修为、内力、真元、运功、调息、走火入魔、玄乎、浑气、灵气、丹田、功法、神识、天骄、祭出、真气、道韵、修士等）
4. no_precise_numbers    : 零机械精确数字（拦截零点几秒、三十七度、二十五米、百分之等叙事正文中的违和精确数字；跳过游戏数值/机制与元提示字段）
5. no_telegraph_staccato : 零电报短碎句连发（跨段或单段内连续 >=3 句不足字数且非对话的机械断句）
6. no_close_repetition   : 近距离词频复读检测（120 字滑动窗口内高频实词/形容词/句尾结构重复告警）
7. no_recycled_gags      : 老笑点复用拦截（打碎花瓶、烧焦窗帘、拿反地图等老包袱换皮）
"""

from __future__ import annotations

import argparse
import glob as pyglob
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple


@dataclass
class Issue:
    file: str
    line: int
    rule: str
    severity: str  # "error" | "warning"
    message: str
    snippet: str


@dataclass
class Segment:
    text: str
    line: int
    is_dialogue_hint: bool = False
    scene_id: str = ""
    is_choice_label: bool = False
    skip_precise_numbers: bool = False


# ---------------------------------------------------------------------------
# 1. 正则规则定义
# ---------------------------------------------------------------------------

BUSHI_CONTRAST_RE = re.compile(
    r"不是[^。！？\n”」』]{1,36}?[，,、]\s*(?:而是|却|但|偏偏|反倒)"
    r"|不是[^。！？\n”」』]{1,24}?而是"
    r"|并非[^。！？\n”」』]{1,36}?[，,、]?\s*而是"
)

SLANG_PATTERNS: List[Tuple[re.Pattern[str], str]] = [
    (re.compile(r"外面看"), "严禁使用技工口语「外面看」"),
    (re.compile(r"法子"), "严禁使用土味口语「法子」"),
    (re.compile(r"冻出"), "严禁使用技工词「冻出」（请改用凝起、覆上、结成等）"),
    (re.compile(r"想把[^\n。！？；”」]{1,22}?提上去"), "严禁使用技工口语「想把……提上去」"),
    (re.compile(r"老夫"), "严禁在西幻语境串入古装武侠自称「老夫」"),
    (re.compile(r"拱手|抱拳|抱剑行礼"), "严禁在西幻语境串入中式武侠礼仪「拱手/抱拳/抱剑行礼」"),
    (re.compile(r"诸位大人"), "严禁串入古装官场套话「诸位大人」"),
    (re.compile(r"分内之事"), "严禁串入镖局武侠套话「分内之事」"),
    (re.compile(r"庙堂"), "严禁在西幻王国语境串入中式古文词「庙堂」"),
    (re.compile(r"掎角之势"), "严禁串入古兵书成语套话「掎角之势」"),
    (re.compile(r"(?:子|丑|寅|卯|辰|巳|午|未|申|酉|戌|亥)时"), "严禁在西幻正文中混入传统天干地支时辰"),
]

XIANXIA_WORDS = (
    "修为", "内力", "真元", "运功", "调息", "走火入魔",
    "玄乎", "浑气", "灵气", "丹田", "功法", "神识",
    "天骄", "祭出", "真气", "道韵", "修士",
    "筑基", "金丹", "元婴", "渡劫", "灵根", "法宝", "仙人", "心法", "神通",
)
XIANXIA_RE = re.compile("|".join(sorted((re.escape(w) for w in XIANXIA_WORDS), key=len, reverse=True)))

CN_NUM_CHARS = "零一二三四五六七八九十百千万两几"

PRECISE_NUMBER_PATTERNS: List[Tuple[re.Pattern[str], str]] = [
    (
        re.compile(rf"零点[{CN_NUM_CHARS}\d]+\s*(?:秒钟|秒|分钟|分|米|毫米|厘米|公分|寸|尺|度|倍)?"),
        "严禁使用机械精确小数「零点……」",
    ),
    (
        re.compile(r"(?<!第)\b\d+\.\d+\s*(?:秒钟|秒|分钟|分|小时|米|毫米|厘米|公分|公里|千米|度|倍)(?!章)"),
        "严禁使用阿拉伯小数精确计量",
    ),
    (
        re.compile(rf"[{CN_NUM_CHARS}]+点[{CN_NUM_CHARS}\d]+\s*(?:秒钟|秒|分钟|米|毫米|厘米|公分|度|倍)"),
        "严禁使用中文小数精确计量",
    ),
    (
        re.compile(
            r"(?:零下\s*[零一二三四五六七八九十百\d]+|"
            r"(?:十[一二三四五六七八九]|[二三四五六七八九]十[一二三四五六七八九]?|[一二三四五六七八九]百[零一二三四五六七八九十]*|\d{2,}))"
            r"\s*(?:摄氏)?度"
        ),
        "严禁使用违和精确温度/角度数值",
    ),
    (
        re.compile(
            rf"(?:[{CN_NUM_CHARS}]+|\d+)\s*(?:毫米|厘米|公分|分米|千米|公里|毫升|千克|公斤|秒钟)"
        ),
        "严禁使用现代公制/精确时间量词",
    ),
    (
        re.compile(
            r"(?:[一二三四五六七八九十百千万两]+|\d+)\s*米(?![粒饭粥粉面汤粮袋缸酒糕饼筐桶])"
        ),
        "严禁使用现代公制精确距离「……米」（请改用数步、丈许、附近、不远等）",
    ),
    (
        re.compile(
            r"(?:[一二三四五六七八九十百千万两]+|\d+)\s*(?:秒|分钟)"
        ),
        "严禁使用现代精确计时「……秒/分钟」（请改用一息、片刻、须臾、半晌等）",
    ),
    (
        re.compile(rf"百分之[{CN_NUM_CHARS}点\d]+|\d+(?:\.\d+)?\s*%"),
        "严禁在叙事正文中使用百分比数值",
    ),
]

RECYCLED_GAG_PATTERNS: List[Tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"(?:打碎|摔碎|碰倒|弄倒|撞翻|踢翻|撞碎)[^。！？\n]{0,8}(?:花瓶|瓷瓶)|(?:花瓶|瓷瓶)[^。！？\n]{0,8}(?:打碎|摔碎|碰倒|弄倒|碎了一地)"),
        "严禁复用原著老包袱：打碎/碰倒花瓶",
    ),
    (
        re.compile(r"(?:烧焦|烧着|点着|燎着|烧破|烧穿|引燃)[^。！？\n]{0,8}窗帘|窗帘[^。！？\n]{0,8}(?:烧焦|烧着|着了火|冒起黑烟|烧出个洞)"),
        "严禁复用原著老包袱：烧焦窗帘",
    ),
    (
        re.compile(r"(?:拿反|看反|倒着拿|倒过来看|上下颠倒)[^。！？\n]{0,8}(?:地图|海图|舆图|图纸)|(?:地图|海图|舆图|图纸)[^。！？\n]{0,8}(?:拿反|看反|倒着拿|倒过来看|上下颠倒)"),
        "严禁复用原著老包袱：拿反地图",
    ),
]

FUNCTION_CHARS = set(
    "的得地了着过在从向往把被让给和与跟同及或而但却又也还就才都只更最很太真好"
    "不没无非别莫勿是作当成有在到去来上下里外中前后左右内间之其此那这哪谁什怎"
    "几多少每各某自他她它我你您们个位件条只口把根张片块层阵股缕丝点些次遍回番"
    "声下处边头面儿兮乎哉焉耳啊呀吧呢吗哦嗯噢唉喂嘿一二三四五六七八九十百千两半"
)

PROPER_NOUN_WHITELIST = {
    "希尔维亚", "维斯特利亚", "贝阿特丽丝", "贝蒂", "爱丽丝", "索菲亚", "克劳德",
    "雷纳德", "诺艾儿", "艾玛", "夏洛特", "贝尔蒙", "艾诺", "塔尔维", "海伦娜",
    "阿琼", "霍尔", "安娜", "药神", "法神", "风神", "风帝", "剑神", "万神", "圣女", "魔神",
    "眷寒渔", "霁馆", "霁岚", "老霁", "霁清", "澄岚", "北林", "阿蓿", "萤尾羊",
    "凯尔", "玛莎", "穆萨", "沛霖", "莱恩", "阿斯拉", "苏秦", "赫兰", "巴依",
    "北风堡", "冰封峡谷", "北极铃兰", "伊诺", "霜脊影豺", "灰棘狼", "铁牙猪", "巨角鹿",
    "霜齿雪狼", "裂岩冰蜥", "魔战循环", "风行残像", "冰晶宫殿", "魔力精算", "寒息感知",
    "生根步", "风暴眼", "月虹螺", "姐姐大人", "公爵府", "冒险者", "魔法师", "魔剑士", "防卫队",
}

WATCH_MODIFIERS = (
    "微微", "轻轻", "缓缓", "慢慢", "静静", "紧紧", "死死", "渐渐", "默默", "悄悄",
    "忽然", "突然", "骤然", "猛然", "猛地", "刹那", "瞬间", "转眼", "霎时",
    "冰冷", "刺骨", "凛冽", "清冷", "寒冷", "滚烫", "温热", "温暖", "柔和",
    "通透", "清晰", "清楚", "均匀", "平整", "光滑", "锋利", "尖锐", "粗粝",
    "安静", "寂静", "死寂", "沉默", "平淡", "平静", "冷淡", "漠然",
    "苍白", "惨白", "灰白", "漆黑", "幽暗", "昏暗", "明亮", "清澈",
    "小心翼翼", "悄无声息", "干干净净", "整整齐齐", "密密麻麻", "断断续续", "一模一样",
)
WATCH_MODIFIER_RE = re.compile("|".join(sorted((re.escape(w) for w in WATCH_MODIFIERS), key=len, reverse=True)))

PURE_CONTENT_CHUNK_RE = re.compile(
    rf"[^\W\d_a-zA-Z{''.join(re.escape(c) for c in FUNCTION_CHARS)}]{{2,6}}"
)

SENTENCE_END_RE = re.compile(r"([\u4e00-\u9fff]{3})[。！？]")
CLAUSE_TAIL_PATTERNS = {
    "了起来", "了下去", "了出来", "了过去", "了回来", "了进去",
    "着什么", "的地方", "的时候", "的样子", "的声音", "的气息",
}

CN_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")
SUB_SENTENCE_SPLIT_RE = re.compile(r"[^。！？!?；;\n]+[。！？!?]")
HTML_TAG_RE = re.compile(r"<[a-zA-Z!/][^>]*>")
STORY_CHAPTERS_ARRAY_RE = re.compile(r"^STORY_.*CHAPTERS$")

# 已知非剧本模块化 JS 文件名（走模块化叙事字段提取路径）
MODULAR_NON_STORY_FILENAMES = {
    "relics-and-events.js",
    "ai-personas.js",
    "vn-ux.js",
    "branching-director.js",
    "combat-engine.js",
    "ai-chat-panel.js",
    "ambient-fx.js",
    "tavern-bridge.js",
}

# JS 词法：若前一个有效 token 为以下关键字或运算符，则 '/' 开启正则字面量而非除号
JS_REGEX_PREV_KEYWORDS = {
    "return", "case", "throw", "in", "instanceof", "typeof",
    "void", "delete", "new", "yield", "await", "of", "else", "do",
}
JS_STATEMENT_KEYWORDS = {
    "var", "let", "const", "return", "if", "else", "for",
    "while", "switch", "case", "break", "continue", "throw",
}

# 模块化 JS 中需整块跳过的反例、词表、系统提示红线、UI 数值与 DOM 工具作用域
MODULAR_IGNORED_SCOPES = {
    # 反例示范与清洗器词表
    "bad", "badExample", "badExamples",
    "TECH_JARGON", "XIANXIA_JARGON",
    "FORBIDDEN_CORRECTION", "FORBIDDEN_CORRECTION_RE", "FORBIDDEN_PLAIN_RE",
    "sanitizeNarrativeOutput",
    # 系统提示词防剧透禁令、规则文本与 JSON Schema 说明
    "stageBans", "forbiddenSpoilers", "STYLE_RULES_TEXT", "RESPONSE_SCHEMA",
    "allowedTopics", "causalNotes",
    # 游戏数值角标、增益流水与配置清单
    "deltas", "costBadge", "rewardBadge", "unlockAliases",
    "SAFE_FLAG_KEYS", "VALID_EMOTIONS", "RELIC_ORDER", "BOND_ORDER",
    "STORY_CHAPTERS", "STORY_VOL3_CHAPTERS", "STORY_VOL4_CHAPTERS",
    # 非叙事工具/弹窗/DOM 调用
    "sysPopup", "statusPanelHTML", "toast", "toastSafe",
    "log", "warn", "error", "RegExp", "escapeHtml",
    "querySelector", "querySelectorAll", "getElementById",
    "getAttribute", "setAttribute", "createElement",
}

# 模块化 JS 中按完整叙事规则审校的面向玩家/正例散文字段
MODULAR_PROSE_FIELDS = {
    "intro", "epilogue", "lore", "desc", "description",
    "quote", "quotes", "opening", "openings", "openingLine",
    "greeting", "greetings", "flavor", "flavorText",
    "caption", "excerpt", "summary", "commentary",
    "story", "narrative", "prologue", "outro",
    "text", "line", "lines", "unlockHint", "hint",
    "sylviaAnchor", "backstory", "relationship",
    "memoryEcho", "echo", "echoes", "note",
}

# 模块化 JS 中代表角色台词/对话语气的字段（豁免非对话电报短碎句连发）
MODULAR_DIALOGUE_FIELDS = {
    "quote", "quotes", "reply", "user",
    "opening", "openings", "openingLine",
    "greeting", "greetings",
}

# 模块化 JS 中仅在正例示范容器内提取的字段
MODULAR_GOOD_EXAMPLE_FIELDS = {"user", "action", "reply"}
MODULAR_GOOD_CONTAINER_TAGS = {"good", "goodExample", "goodExamples", "fewShot", "openings", "samples"}

# 模块化 JS 中所有键值均为关系暗流叙事描写的容器对象
MODULAR_AXIS_CONTAINER_TAGS = {"axisFlavor"}

# 模块化 JS 中属于游戏数值机制说明或 AI 元风格指令的字段：
# 仍严格审校 no_bushi / no_slang_mechanic / no_xianxia / no_recycled_gags 等规则，
# 但跳过 no_precise_numbers（如 +20%、35%、1.5 倍伤 或元提示中的「一秒切换」）。
MODULAR_MECHANICS_OR_META_FIELDS = {
    "effectText", "effectDesc", "effect", "bonusText",
    "synergyDesc", "synergyEffect", "mechanicText", "statDesc",
    "tooltip", "buffDesc", "shortDesc",
    "surfaceTone", "subtextHabits", "tone", "habits", "speechStyle",
}

# 模块化 JS 中包含游戏数值机制描述（如 desc: '额外回复 10% 最大魔力'）的容器作用域
MODULAR_STAT_CONTAINER_TAGS = {
    "RELIC_SYNERGIES", "SYNERGIES", "tiers",
    "RELICS_CATALOG", "BOND_ASSISTS",
}


# ---------------------------------------------------------------------------
# 2. 文本提取器（Markdown / TXT / 真正跨行 AST 状态机 JS 提取器）
# ---------------------------------------------------------------------------

def extract_segments_from_text(content: str) -> List[Segment]:
    lines = content.splitlines()
    segments: List[Segment] = []
    in_frontmatter = False

    for idx, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if idx == 1 and stripped == "---":
            in_frontmatter = True
            continue
        if in_frontmatter:
            if stripped == "---":
                in_frontmatter = False
            continue
        if not stripped:
            continue
        is_diag = stripped.startswith(("“", "「", "『", '"'))
        segments.append(Segment(text=stripped, line=idx, is_dialogue_hint=is_diag))
    return segments


def _is_story_js(content: str, file_path: Optional[Path] = None) -> bool:
    """区分剧本脚本（js/story*.js 及含 SCENES 剧本辅助调用的文件）与非剧本模块化 JS。"""
    if file_path is not None:
        name_lower = file_path.name.lower()
        if name_lower in MODULAR_NON_STORY_FILENAMES:
            return False
        if re.match(r"^story(?:[-_].*)?\.js$", name_lower):
            return True
    has_scenes_dsl = bool(
        re.search(r"\bSCENES\b", content)
        and re.search(r"\b(?:DUO|SAY|MONO|DIM|T|N)\s*\(", content)
    )
    if has_scenes_dsl:
        return True
    if file_path is None:
        # 兼容无路径直接调用：若含典型模块化常量则走模块化提取，否则保持剧本提取
        if re.search(r"\b(?:RELICS_CATALOG|SEASONAL_EVENTS|PERSONAS|FEATURED_QUICK_JUMPS)\b", content):
            return False
        return True
    return False


def extract_segments_from_js(content: str, file_path: Optional[Path] = None) -> List[Segment]:
    """
    通过跨行词法与括号栈状态机提取 JS 文件中的叙事文本：
    - 完整识别单/双引号、模板字符串与 JS 正则字面量（避免 /"/g 等正则破坏词法状态）
    - 区分剧本模式（js/story*.js）与非剧本模块化模式（relics-and-events.js / ai-personas.js / vn-ux.js 等）：
      * 剧本模式：精准提取跨行 DUO / SAY / say / T / N / MONO / DIM / { text: ... } / choices，
        跳过 sysPopup / toast / card / item 与 STORY_*CHAPTERS 元数据。
      * 模块化模式：仅提取面向玩家的叙事散文与正例字段（intro / epilogue / lore / desc / quote /
        opening / sylviaAnchor / axisFlavor / good 正例 / surfaceTone / subtextHabits / choices.label 等），
        跳过 HTML/CSS、代码逻辑、UI 数值角标及反例/词表/防剧透规则块（bad / TECH_JARGON / XIANXIA_JARGON /
        stageBans / forbiddenSpoilers / STYLE_RULES_TEXT / sanitizeNarrativeOutput），
        并对游戏数值机制与元风格字段豁免 no_precise_numbers。
    """
    is_story = _is_story_js(content, file_path)
    segments: List[Segment] = []
    n = len(content)
    i = 0
    line = 1
    current_scene = ""
    mod_group_seq = 0

    # Stack entries: {open, tag, recv, arg_idx, cur_prop, in_val, has_speaker, is_obj}
    stack: List[dict] = []
    ident_chain: List[str] = []
    last_ident = ""
    last_prop = ""
    assign_target = ""
    after_colon = False
    prev_tok = "start"  # "start" | "op" | "kw_expr" | "expr_end"
    last_open_hint = "start"  # 协助区分对象字面量 '{' 与代码块 '{'
    expect_func_name = False
    pending_func_name = ""

    STORY_IGNORED_CALLS = {
        "sysPopup", "statusPanelHTML", "toast", "log", "warn", "error",
        "P", "flag", "ach", "know", "love", "addSkill",
    }
    STORY_IGNORED_OBJ_PROPS = {"card", "item"}
    STORY_IGNORED_ARRAY_NAMES = {"STORY_CHAPTERS", "STORY_VOL3_CHAPTERS", "STORY_VOL4_CHAPTERS"}

    while i < n:
        ch = content[i]

        # Newline tracking
        if ch == "\n":
            line += 1
            i += 1
            continue

        # Line comment
        if ch == "/" and i + 1 < n and content[i + 1] == "/":
            end_nl = content.find("\n", i + 2)
            if end_nl == -1:
                break
            i = end_nl
            continue

        # Block comment
        if ch == "/" and i + 1 < n and content[i + 1] == "*":
            end_blk = content.find("*/", i + 2)
            if end_blk == -1:
                break
            line += content.count("\n", i, end_blk + 2)
            i = end_blk + 2
            continue

        # JS RegExp literal (/pattern/flags) — 避免 /"/g 或 /<[^>]+>/g 误触发字符串字面量
        if ch == "/" and prev_tok in ("start", "op", "kw_expr"):
            j = i + 1
            in_char_class = False
            closed = False
            while j < n and content[j] != "\n":
                rc = content[j]
                if rc == "\\":
                    j += 2
                    continue
                if rc == "[":
                    in_char_class = True
                elif rc == "]":
                    in_char_class = False
                elif rc == "/" and not in_char_class:
                    j += 1
                    while j < n and content[j].isalpha():
                        j += 1
                    closed = True
                    break
                j += 1
            if closed:
                i = j
                prev_tok = "expr_end"
                last_open_hint = "expr_end"
                ident_chain = []
                last_ident = ""
                continue

        # String literal
        if ch in ("'", '"', "`"):
            quote = ch
            start_line = line
            buf: List[str] = []
            i += 1
            while i < n:
                c = content[i]
                if c == "\\":
                    if i + 1 < n:
                        nxt = content[i + 1]
                        if nxt == "n":
                            buf.append("\n")
                        elif nxt == "t":
                            buf.append("\t")
                        elif nxt == "\n":
                            line += 1
                        else:
                            buf.append(nxt)
                        i += 2
                        continue
                if c == "\n":
                    line += 1
                if c == quote:
                    i += 1
                    break
                # Skip template interpolation ${...}
                if quote == "`" and c == "$" and i + 1 < n and content[i + 1] == "{":
                    depth = 1
                    i += 2
                    while i < n and depth > 0:
                        if content[i] == "\n":
                            line += 1
                        elif content[i] == "{":
                            depth += 1
                        elif content[i] == "}":
                            depth -= 1
                        i += 1
                    continue
                buf.append(c)
                i += 1

            val = "".join(buf)
            cn_chars = CN_CHAR_RE.findall(val)
            if len(cn_chars) >= 2:
                top = stack[-1] if stack else None
                if is_story:
                    in_ignored = any(
                        fr["tag"] in STORY_IGNORED_CALLS
                        or fr["tag"] in STORY_IGNORED_OBJ_PROPS
                        or fr["tag"] in STORY_IGNORED_ARRAY_NAMES
                        or bool(STORY_CHAPTERS_ARRAY_RE.match(fr["tag"]))
                        for fr in stack
                    )
                    skip = in_ignored

                    if not skip and top is not None:
                        # Skip ['sylvia', '希尔维亚', 'smile'] tuple short names inside [...]
                        if top["open"] == "[" and len(cn_chars) <= 8:
                            parent_tag = stack[-2]["tag"] if len(stack) >= 2 else ""
                            if parent_tag in ("DUO", "DIM", "P", "portraits"):
                                skip = True
                        # Skip speaker display name arg in SAY(id, speaker, emo, text, extra)
                        if top["open"] == "(" and top["tag"] == "SAY" and top.get("arg_idx") == 1:
                            skip = True
                        # Skip non-narrative object properties like speaker: '希尔维亚', name: '...', short: '...'
                        if top["open"] == "{" and top.get("is_obj") and top.get("in_val"):
                            prop = top.get("cur_prop", "")
                            if prop in ("speaker", "vol", "t", "s", "name", "short", "role", "area", "icon"):
                                skip = True
                        # Skip S.alias = '眷寒渔' or comparisons
                        if last_prop == "alias" and len(cn_chars) <= 6:
                            skip = True

                    if not skip:
                        # Determine whether this string is a spoken dialogue line from innermost call/object frame
                        is_diag = False
                        DIALOGUE_TEXT_ARG = {"DUO": 3, "SAY": 3, "say": 1}
                        NARRATION_CALLS = {"T", "N", "DIM", "MONO"}
                        for fr in reversed(stack):
                            tag = fr["tag"]
                            if fr["open"] == "(":
                                if tag in DIALOGUE_TEXT_ARG:
                                    is_diag = fr.get("arg_idx") == DIALOGUE_TEXT_ARG[tag]
                                    break
                                if tag in NARRATION_CALLS:
                                    is_diag = False
                                    break
                            elif fr["open"] == "{" and fr.get("is_obj"):
                                if fr.get("has_speaker") and fr.get("cur_prop") in ("text", ""):
                                    is_diag = True
                                else:
                                    is_diag = False
                                break
                        # 仅针对 choices: [ { text: '...' } ] 的直接选项按钮文案豁免电报短碎句计数；
                        # 选项内部 lines: [ T('...') ] 等剧情旁白仍按正常旁白从严审校。
                        is_choice_label = (
                            len(stack) >= 2
                            and stack[-1]["open"] == "{"
                            and stack[-1].get("is_obj")
                            and stack[-1].get("cur_prop") in ("text", "")
                            and stack[-2]["open"] == "["
                            and stack[-2]["tag"] == "choices"
                        )

                        for part in val.splitlines():
                            p_strip = part.strip()
                            if not p_strip:
                                continue
                            segments.append(
                                Segment(
                                    text=p_strip,
                                    line=start_line,
                                    is_dialogue_hint=is_diag or p_strip.startswith(("“", "「", "『")),
                                    scene_id=current_scene,
                                    is_choice_label=is_choice_label,
                                )
                            )
                else:
                    # 非剧本模块化 JS：仅提取面向玩家的叙事散文/正例/机制说明字段，跳过 HTML、代码与反例词表
                    in_ignored = any(
                        fr["tag"] in MODULAR_IGNORED_SCOPES
                        or fr["recv"] in MODULAR_IGNORED_SCOPES
                        or bool(STORY_CHAPTERS_ARRAY_RE.match(fr["tag"]))
                        for fr in stack
                    )
                    if not in_ignored and not HTML_TAG_RE.search(val):
                        field = ""
                        in_call = bool(top and top["open"] == "(" and top["tag"])
                        if not in_call:
                            if top is not None and top["open"] == "{" and top.get("is_obj"):
                                if top.get("in_val"):
                                    field = top.get("cur_prop", "")
                            elif top is not None and top["open"] == "[":
                                field = top.get("tag", "")
                            elif assign_target:
                                field = assign_target

                        ancestor_tags = {fr["tag"] for fr in stack if fr["tag"]}
                        top_obj_tag = (
                            top.get("tag", "")
                            if (top is not None and top["open"] == "{" and top.get("is_obj") and top.get("in_val"))
                            else ""
                        )

                        extract_mod = False
                        skip_nums = False
                        is_diag_mod = False
                        is_choice_mod = False

                        if field in MODULAR_MECHANICS_OR_META_FIELDS:
                            extract_mod = True
                            skip_nums = True
                        elif field in ("desc", "description") and (ancestor_tags & MODULAR_STAT_CONTAINER_TAGS):
                            extract_mod = True
                            skip_nums = True
                        elif field in MODULAR_PROSE_FIELDS and not (field == "prologue" and top_obj_tag == "map"):
                            extract_mod = True
                            is_diag_mod = field in MODULAR_DIALOGUE_FIELDS
                        elif field in MODULAR_GOOD_EXAMPLE_FIELDS and (ancestor_tags & MODULAR_GOOD_CONTAINER_TAGS):
                            extract_mod = True
                            is_diag_mod = field in MODULAR_DIALOGUE_FIELDS
                        elif top_obj_tag in MODULAR_AXIS_CONTAINER_TAGS and field:
                            extract_mod = True
                        elif field == "label" and "choices" in ancestor_tags:
                            extract_mod = True
                            is_choice_mod = True

                        if extract_mod:
                            mod_group_seq += 1
                            mod_scene_id = f"mod:{field or top_obj_tag}:{mod_group_seq}"
                            for part in val.splitlines():
                                p_strip = part.strip()
                                if not p_strip or len(CN_CHAR_RE.findall(p_strip)) < 2:
                                    continue
                                segments.append(
                                    Segment(
                                        text=p_strip,
                                        line=start_line,
                                        is_dialogue_hint=is_diag_mod or p_strip.startswith(("“", "「", "『")),
                                        scene_id=mod_scene_id,
                                        is_choice_label=is_choice_mod,
                                        skip_precise_numbers=skip_nums,
                                    )
                                )
            after_colon = False
            prev_tok = "expr_end"
            last_open_hint = "expr_end"
            ident_chain = []
            continue

        # Number literal
        if ch.isdigit():
            while i < n and (content[i].isalnum() or content[i] in (".", "_")):
                i += 1
            prev_tok = "expr_end"
            last_open_hint = "expr_end"
            ident_chain = []
            last_ident = ""
            continue

        # Identifiers (detect SCENES.xxx, function names, member chains, object keys)
        if ch.isalpha() or ch in ("_", "$"):
            start = i
            while i < n and (content[i].isalnum() or content[i] in ("_", "$")):
                i += 1
            ident = content[start:i]

            if start > 0 and content[start - 1] == ".":
                ident_chain.append(ident)
            else:
                ident_chain = [ident]

            # Track `function name(...) {`
            if ident == "function":
                expect_func_name = True
                pending_func_name = ""
            elif expect_func_name:
                pending_func_name = ident
                expect_func_name = False

            if ident in JS_STATEMENT_KEYWORDS:
                assign_target = ""

            # Check SCENES.<scene_id>
            if last_ident == "SCENES" and start >= 7 and content[start - 1] == ".":
                current_scene = ident

            # Peek next non-space char to see if this is an object property key `ident:`
            j = i
            while j < n and content[j] in (" ", "\t", "\r"):
                j += 1
            if (
                j < n
                and content[j] == ":"
                and stack
                and stack[-1]["open"] == "{"
                and stack[-1].get("is_obj")
                and not stack[-1].get("in_val")
            ):
                stack[-1]["cur_prop"] = ident
                if ident in ("ch", "speaker"):
                    stack[-1]["has_speaker"] = True

            last_ident = ident
            last_prop = ident
            prev_tok = "kw_expr" if ident in JS_REGEX_PREV_KEYWORDS else "expr_end"
            last_open_hint = "return" if ident == "return" else ("else" if ident in ("else", "try", "finally", "do") else "expr_end")
            continue

        if ch == "=":
            prev_c = content[i - 1] if i > 0 else ""
            next_c = content[i + 1] if i + 1 < n else ""
            if next_c == ">":
                # Arrow function `=>`
                i += 2
                prev_tok = "op"
                last_open_hint = "arrow"
                ident_chain = []
                last_ident = ""
                continue
            if prev_c not in ("=", "!", "<", ">") and next_c != "=":
                if ident_chain:
                    assign_target = ident_chain[-1]
                last_open_hint = "obj_ok"
            else:
                last_open_hint = "op"
            prev_tok = "op"
            ident_chain = []
            last_ident = ""
            i += 1
            continue

        if ch == ":":
            after_colon = True
            if stack and stack[-1]["open"] == "{" and stack[-1].get("is_obj"):
                stack[-1]["in_val"] = True
            prev_tok = "op"
            last_open_hint = "obj_ok"
            ident_chain = []
            last_ident = ""
            i += 1
            continue

        if ch == ",":
            after_colon = False
            if stack:
                stack[-1]["arg_idx"] += 1
                if stack[-1]["open"] == "{" and stack[-1].get("is_obj"):
                    stack[-1]["cur_prop"] = ""
                    stack[-1]["in_val"] = False
            else:
                assign_target = ""
            prev_tok = "op"
            last_open_hint = "obj_ok"
            ident_chain = []
            last_ident = ""
            i += 1
            continue

        if ch in ("(", "{", "["):
            tag = ""
            recv = ""
            is_obj = False
            if ch == "(":
                expect_func_name = False
                if ident_chain:
                    tag = ident_chain[-1]
                    recv = ident_chain[-2] if len(ident_chain) >= 2 else ""
            elif ch == "{":
                is_obj = last_open_hint in ("obj_ok", "return", "start")
                if is_obj:
                    if stack and stack[-1]["open"] == "{" and stack[-1].get("is_obj") and stack[-1].get("in_val"):
                        tag = stack[-1].get("cur_prop", "")
                    elif assign_target:
                        tag = assign_target
                    assign_target = ""
                else:
                    if pending_func_name:
                        tag = pending_func_name
                        pending_func_name = ""
                    elif stack and stack[-1]["open"] == "{" and stack[-1].get("is_obj") and stack[-1].get("in_val"):
                        tag = stack[-1].get("cur_prop", "")
                    assign_target = ""
            elif ch == "[":
                if stack and stack[-1]["open"] == "{" and stack[-1].get("is_obj") and stack[-1].get("in_val"):
                    tag = stack[-1].get("cur_prop", "")
                elif assign_target:
                    tag = assign_target
                elif last_ident in STORY_IGNORED_ARRAY_NAMES or STORY_CHAPTERS_ARRAY_RE.match(last_ident):
                    tag = last_ident
                assign_target = ""

            stack.append(
                {
                    "open": ch,
                    "tag": tag,
                    "recv": recv,
                    "arg_idx": 0,
                    "cur_prop": "",
                    "in_val": False,
                    "has_speaker": False,
                    "is_obj": is_obj,
                }
            )
            after_colon = False
            ident_chain = []
            last_ident = ""
            prev_tok = "op"
            last_open_hint = "obj_ok" if ch in ("(", "[") else "start"
            i += 1
            continue

        if ch in (")", "}", "]"):
            popped = stack.pop() if stack else None
            after_colon = False
            ident_chain = []
            last_ident = ""
            if ch == "}":
                if popped and not popped.get("is_obj"):
                    assign_target = ""
                prev_tok = "op"
                last_open_hint = "close_brace"
            elif ch == ")":
                prev_tok = "expr_end"
                last_open_hint = "close_paren"
            else:
                prev_tok = "expr_end"
                last_open_hint = "expr_end"
            i += 1
            continue

        if ch == ";":
            assign_target = ""
            pending_func_name = ""
            expect_func_name = False
            ident_chain = []
            last_ident = ""
            prev_tok = "op"
            last_open_hint = "start"
            i += 1
            continue

        if ch == ".":
            prev_tok = "op"
            last_open_hint = "op"
            i += 1
            continue

        if ch in ("?", "|", "&"):
            prev_tok = "op"
            last_open_hint = "obj_ok"
            ident_chain = []
            last_ident = ""
            i += 1
            continue

        if not ch.isspace():
            ident_chain = []
            last_ident = ""
            prev_tok = "op"
            last_open_hint = "op"
        i += 1

    return segments


# ---------------------------------------------------------------------------
# 3. 核心审校逻辑
# ---------------------------------------------------------------------------

def check_segment_line_rules(file_label: str, seg: Segment) -> List[Issue]:
    issues: List[Issue] = []
    txt = seg.text

    is_heading = txt.startswith("#")
    if txt in ("◇", "---", "***", "* * *"):
        return issues

    # 规则 1：严打 AI 纠正式转折腔（「不是A，而是/却/但/偏偏/反倒B」「并非……，而是……」）
    for cm in BUSHI_CONTRAST_RE.finditer(txt):
        issues.append(
            Issue(
                file=file_label,
                line=seg.line,
                rule="no_bushi",
                severity="error",
                message="严禁出现含「不是/并非……而是/却/但……」的 AI 纠正式转折句式",
                snippet=cm.group(0),
            )
        )

    # 规则 2：零技工词、土味口语与违和武侠腔
    for pat, msg in SLANG_PATTERNS:
        for sm in pat.finditer(txt):
            start = max(0, sm.start() - 6)
            end = min(len(txt), sm.end() + 6)
            issues.append(
                Issue(
                    file=file_label,
                    line=seg.line,
                    rule="no_slang_mechanic",
                    severity="error",
                    message=msg,
                    snippet=txt[start:end],
                )
            )

    # 规则 3：零修仙玄幻词
    for xm in XIANXIA_RE.finditer(txt):
        start = max(0, xm.start() - 6)
        end = min(len(txt), xm.end() + 6)
        issues.append(
            Issue(
                file=file_label,
                line=seg.line,
                rule="no_xianxia",
                severity="error",
                message=f"严禁使用修仙玄幻词汇「{xm.group(0)}」",
                snippet=txt[start:end],
            )
        )

    # 规则 4：零机械精确数字（跳过标题与游戏数值机制/AI 元提示字段）
    if not is_heading and not seg.skip_precise_numbers:
        num_spans: List[Tuple[int, int]] = []
        for pat, msg in PRECISE_NUMBER_PATTERNS:
            for nm in pat.finditer(txt):
                if any(not (nm.end() <= s or nm.start() >= e) for s, e in num_spans):
                    continue
                num_spans.append((nm.start(), nm.end()))
                start = max(0, nm.start() - 6)
                end = min(len(txt), nm.end() + 6)
                issues.append(
                    Issue(
                        file=file_label,
                        line=seg.line,
                        rule="no_precise_numbers",
                        severity="error",
                        message=msg,
                        snippet=txt[start:end],
                    )
                )

    # 规则 7：老笑点复用拦截
    for pat, msg in RECYCLED_GAG_PATTERNS:
        for gm in pat.finditer(txt):
            issues.append(
                Issue(
                    file=file_label,
                    line=seg.line,
                    rule="no_recycled_gags",
                    severity="error",
                    message=msg,
                    snippet=gm.group(0),
                )
            )

    return issues


def check_telegraph_staccato(file_label: str, segments: Sequence[Segment]) -> List[Issue]:
    """
    规则 5：零电报短碎句连发
    1) 跨段检测：连续 >=3 段每段不足 6 个汉字且非对话、非标题、非分隔符。
    2) 单段内检测：非对话段内部连续 >=3 个句末终结短句每句不足 5 个汉字（如“风停了。雪落了。人走了。”）。
    """
    issues: List[Issue] = []
    streak: List[Segment] = []

    def flush_streak() -> None:
        nonlocal streak
        if len(streak) >= 3:
            joined = " / ".join(s.text for s in streak)
            issues.append(
                Issue(
                    file=file_label,
                    line=streak[0].line,
                    rule="no_telegraph_staccato",
                    severity="error",
                    message=f"检测到连续 {len(streak)} 段不足 6 字的非对话电报短碎句连发",
                    snippet=joined[:60],
                )
            )
        streak = []

    prev_scene = None
    for seg in segments:
        if seg.scene_id != prev_scene:
            flush_streak()
            prev_scene = seg.scene_id

        t = seg.text.strip()
        if (
            not t
            or t in ("◇", "---", "***", "* * *")
            or t.startswith(("#", ">", "*"))
            or seg.is_dialogue_hint
            or seg.is_choice_label
            or "“" in t
            or "「" in t
            or "『" in t
        ):
            flush_streak()
            continue

        # 单段内部连续短碎句检测
        sub_sents = [m.group(0).strip() for m in SUB_SENTENCE_SPLIT_RE.finditer(t)]
        if len(sub_sents) >= 3:
            sub_streak: List[str] = []
            for ss in sub_sents:
                if 0 < len(CN_CHAR_RE.findall(ss)) < 5:
                    sub_streak.append(ss)
                else:
                    if len(sub_streak) >= 3:
                        break
                    sub_streak = []
            if len(sub_streak) >= 3:
                issues.append(
                    Issue(
                        file=file_label,
                        line=seg.line,
                        rule="no_telegraph_staccato",
                        severity="error",
                        message=f"检测到单段内连续 {len(sub_streak)} 句超短电报断句",
                        snippet="".join(sub_streak)[:60],
                    )
                )

        cn_len = len(CN_CHAR_RE.findall(t))
        if 0 < cn_len < 6:
            streak.append(seg)
        else:
            flush_streak()

    flush_streak()
    return issues


def check_close_repetition(
    file_label: str,
    segments: Sequence[Segment],
    window_chars: int = 120,
) -> List[Issue]:
    """
    规则 6：近距离词频复读检测
    在 120 字滑动窗口内检测高频实词/形容词以及雷同句尾结构。
    """
    issues: List[Issue] = []
    if not segments:
        return issues

    groups: List[List[Segment]] = []
    cur_group: List[Segment] = []
    cur_scene: Optional[str] = None

    for seg in segments:
        if seg.text.startswith("#") or seg.text in ("◇", "---", "***"):
            if cur_group:
                groups.append(cur_group)
                cur_group = []
            continue
        if cur_scene is not None and seg.scene_id != cur_scene:
            if cur_group:
                groups.append(cur_group)
                cur_group = []
        cur_scene = seg.scene_id
        cur_group.append(seg)
    if cur_group:
        groups.append(cur_group)

    reported_keys = set()

    for grp in groups:
        full_chars: List[str] = []
        char_lines: List[int] = []
        for seg in grp:
            for ch in seg.text:
                full_chars.append(ch)
                char_lines.append(seg.line)
            full_chars.append("\n")
            char_lines.append(seg.line)

        stream = "".join(full_chars)
        total_len = len(stream)
        if total_len == 0:
            continue

        step = 30
        for start in range(0, total_len, step):
            end = min(total_len, start + window_chars)
            window = stream[start:end]

            # 6a. 重点修饰词/形容词/副词复读（四字词 >=2 次，双字修饰词 >=3 次）
            mod_positions: dict[str, List[int]] = {}
            for mm in WATCH_MODIFIER_RE.finditer(window):
                w = mm.group(0)
                if w in PROPER_NOUN_WHITELIST:
                    continue
                mod_positions.setdefault(w, []).append(start + mm.start())

            for w, pos_list in mod_positions.items():
                cnt = len(pos_list)
                threshold = 2 if len(w) >= 4 else 3
                if cnt >= threshold:
                    hit_pos = pos_list[0]
                    hit_line = char_lines[hit_pos]
                    dedup_key = ("mod", w, hit_line // 12)
                    if dedup_key not in reported_keys:
                        reported_keys.add(dedup_key)
                        snip_s = max(0, hit_pos - 10)
                        snip_e = min(total_len, pos_list[-1] + len(w) + 10)
                        issues.append(
                            Issue(
                                file=file_label,
                                line=hit_line,
                                rule="no_close_repetition",
                                severity="warning",
                                message=f"{window_chars} 字窗口内修饰词/形容词「{w}」密集重复 {cnt} 次",
                                snippet=stream[snip_s:snip_e].replace("\n", " ")[:60],
                            )
                        )

            # 6b. 通用实词块复读（120 字内同一双字及以上实词出现 >=4 次）
            masked_window = window
            for pn in PROPER_NOUN_WHITELIST:
                if pn in masked_window:
                    masked_window = masked_window.replace(pn, " " * len(pn))
            noun_positions: dict[str, List[int]] = {}
            for cm in PURE_CONTENT_CHUNK_RE.finditer(masked_window):
                chunk = cm.group(0)
                if chunk in PROPER_NOUN_WHITELIST or chunk in mod_positions:
                    continue
                if 2 <= len(chunk) <= 4:
                    if len(set(chunk)) == 1:
                        continue
                    noun_positions.setdefault(chunk, []).append(start + cm.start())

            for w, pos_list in noun_positions.items():
                cnt = len(pos_list)
                if cnt >= 4:
                    hit_pos = pos_list[0]
                    hit_line = char_lines[hit_pos]
                    dedup_key = ("noun", w, hit_line // 12)
                    if dedup_key not in reported_keys:
                        reported_keys.add(dedup_key)
                        snip_s = max(0, hit_pos - 10)
                        snip_e = min(total_len, pos_list[-1] + len(w) + 10)
                        issues.append(
                            Issue(
                                file=file_label,
                                line=hit_line,
                                rule="no_close_repetition",
                                severity="warning",
                                message=f"{window_chars} 字窗口内实词「{w}」高频复读 {cnt} 次",
                                snippet=stream[snip_s:snip_e].replace("\n", " ")[:60],
                            )
                        )

            # 6c. 句尾结构复读（120 字内相同句尾三字补语结构 >=3 次）
            tail_positions: dict[str, List[int]] = {}
            for tm in SENTENCE_END_RE.finditer(window):
                tail = tm.group(1)
                if tail in CLAUSE_TAIL_PATTERNS or tail.startswith(("了", "着", "的")):
                    tail_positions.setdefault(tail, []).append(start + tm.start())

            for tail, pos_list in tail_positions.items():
                cnt = len(pos_list)
                if cnt >= 3:
                    hit_pos = pos_list[0]
                    hit_line = char_lines[hit_pos]
                    dedup_key = ("tail", tail, hit_line // 12)
                    if dedup_key not in reported_keys:
                        reported_keys.add(dedup_key)
                        snip_s = max(0, hit_pos - 12)
                        snip_e = min(total_len, pos_list[-1] + 6)
                        issues.append(
                            Issue(
                                file=file_label,
                                line=hit_line,
                                rule="no_close_repetition",
                                severity="warning",
                                message=f"{window_chars} 字窗口内句尾结构「……{tail}」重复 {cnt} 次",
                                snippet=stream[snip_s:snip_e].replace("\n", " ")[:60],
                            )
                        )

            if end >= total_len:
                break

    return issues


def lint_file(path: Path, root: Optional[Path] = None, window_chars: int = 120) -> List[Issue]:
    content = path.read_text(encoding="utf-8")
    try:
        label = str(path.resolve().relative_to(root.resolve())).replace("\\", "/") if root else str(path)
    except ValueError:
        label = str(path)

    suffix = path.suffix.lower()
    if suffix == ".js":
        segments = extract_segments_from_js(content, file_path=path)
    else:
        segments = extract_segments_from_text(content)

    issues: List[Issue] = []
    for seg in segments:
        issues.extend(check_segment_line_rules(label, seg))
    issues.extend(check_telegraph_staccato(label, segments))
    issues.extend(check_close_repetition(label, segments, window_chars=window_chars))
    issues.sort(key=lambda x: (x.line, x.rule))
    return issues


def collect_target_files(targets: Iterable[str]) -> List[Path]:
    result: List[Path] = []
    seen = set()

    def add_path(p: Path) -> None:
        rp = p.resolve()
        if rp not in seen:
            seen.add(rp)
            result.append(p)

    for raw in targets:
        # Support glob wildcards (e.g. js/story*.js on Windows PowerShell)
        if any(ch in raw for ch in ("*", "?", "[")):
            matched = sorted(Path(m) for m in pyglob.glob(raw, recursive=True))
            if not matched:
                raise FileNotFoundError(f"通配符未匹配到任何文件: {raw}")
            for mp in matched:
                if mp.is_file():
                    add_path(mp)
            continue

        p = Path(raw)
        if p.is_file():
            add_path(p)
        elif p.is_dir():
            for child in sorted(p.rglob("*")):
                if child.is_file() and child.suffix.lower() in {".md", ".txt", ".js"}:
                    if child.name.endswith("_beats.md") or "beats" in child.parts:
                        continue
                    add_path(child)
        else:
            raise FileNotFoundError(f"未找到目标路径: {raw}")
    return result


def run_lint(
    targets: Sequence[str],
    window_chars: int = 120,
    root: Optional[Path] = None,
) -> dict:
    files = collect_target_files(targets)
    all_issues: List[Issue] = []
    file_summaries = []

    for f in files:
        f_issues = lint_file(f, root=root, window_chars=window_chars)
        all_issues.extend(f_issues)
        errs = sum(1 for x in f_issues if x.severity == "error")
        warns = sum(1 for x in f_issues if x.severity == "warning")
        try:
            rel = str(f.resolve().relative_to(root.resolve())).replace("\\", "/") if root else str(f)
        except ValueError:
            rel = str(f)
        file_summaries.append(
            {
                "file": rel,
                "errors": errs,
                "warnings": warns,
                "total": len(f_issues),
            }
        )

    by_rule: dict[str, int] = {}
    for item in all_issues:
        by_rule[item.rule] = by_rule.get(item.rule, 0) + 1

    error_count = sum(1 for x in all_issues if x.severity == "error")
    warning_count = sum(1 for x in all_issues if x.severity == "warning")

    return {
        "ok": len(all_issues) == 0,
        "summary": {
            "files_scanned": len(files),
            "errors": error_count,
            "warnings": warning_count,
            "total_issues": len(all_issues),
            "by_rule": by_rule,
        },
        "files": file_summaries,
        "issues": [asdict(x) for x in all_issues],
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    repo_root = Path(__file__).resolve().parent.parent
    candidate_targets = [
        repo_root / "novel",
        repo_root / "js" / "story-vol3.js",
        repo_root / "js" / "story-vol4.js",
        repo_root / "js" / "relics-and-events.js",
        repo_root / "js" / "ai-personas.js",
        repo_root / "js" / "vn-ux.js",
    ]
    default_targets: List[str] = [str(p) for p in candidate_targets if p.exists()]
    if not default_targets:
        default_targets = ["novel"]

    parser = argparse.ArgumentParser(description="自动化小说文风与违禁词铁面审校器")
    parser.add_argument(
        "targets",
        nargs="*",
        default=default_targets,
        help="待扫描的 .md / .txt / .js 文件、目录或通配符（默认覆盖 novel/、story-vol3/4.js、relics-and-events.js、ai-personas.js、vn-ux.js）",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="严格模式：存在任何 error 或 warning 均返回非零退出码 (1)",
    )
    parser.add_argument(
        "--window",
        type=int,
        default=120,
        help="近距离词频复读检测滑动窗口字数（默认: 120）",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="可选：将 JSON 报告同时写入指定文件路径",
    )
    args = parser.parse_args(argv)

    try:
        report = run_lint(args.targets, window_chars=args.window, root=repo_root)
    except FileNotFoundError as exc:
        err_payload = {"ok": False, "error": str(exc)}
        print(json.dumps(err_payload, ensure_ascii=False, indent=2))
        return 2

    json_text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json_text, encoding="utf-8")
    print(json_text)

    # 非 strict 模式下，只要有 error 即返回非零退出码；strict 模式下连 warning 也返回非零退出码
    if report["summary"]["errors"] > 0:
        return 1
    if args.strict and report["summary"]["total_issues"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
