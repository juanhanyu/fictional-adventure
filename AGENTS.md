# 转生千金～到了异世界就要悠闲地生活 — 总控与开发规范

## 一、顶层调度与并行互斥铁律

- **顶层职责边界**：最高一级只负责向用户简洁汇报、拍板统筹、维护跨总监唯一事实源、派发与验收子代理；严禁亲自读长代码、逐行改业务、跑排查或做测试截图。
- **全面子代理化**：检测、调查、编码、素材、音频、自动化测试与实机审图全交子代理；可拆分任务必须多开并行，派发前写死统一规范（数值 / UI / 键位 / 接口）与严格互斥的文件写权限列表。

## 二、版本控制与行尾纪律

- **分支隔离**：正式改动验收后入库并推送 `origin/main`，提交后确认 `git status --short` 归零且 `HEAD == origin/main`；独立演示页与实验原型统一放 `preview/demos`，严禁混入 `main`。
- **交互演示与审阅交付**：凡交互式审阅页、多方案竞标与独立 Demo，统一推入 `preview/demos` 分支并通过 GitHub Pages 公开 HTTPS 链接交付（严禁给用户发远端 VM `localhost` 或依赖跨文件相对路径的沙盒 iframe）；遵循单文件 `< 50 MB`、总站 `< 1 GB`、控制推送频次且绝不上传任何密钥或私人凭证。
- **提交与行尾**：不提交未对齐半成品；编辑已有文件保持原行尾（如 `js/story-vol3.js` 为 CRLF，避免整文件假 diff）。

## 三、UI 与独立桌面规格

- **桌面端视觉语言**：专注桌面端 `1440×900` / `1280×720`；全站统一雪瓷冰白基底 + 皇家蓝 `#1658eb` + 冰青/淡金（冰晶折射体系），严禁另起暗黑控制台或重胶囊风格。
- **严禁圆框套圆框**：外层已有边框或圆角时，内部按钮、标签、头像、技能项严禁再套带边框圆角盒，层级区分一律用 1px 分隔线、切角/直角、无边框色块或留白字重表达。
- **战斗 UI 范式**：P5 / 八方旅人点击逐级展开棱镜菜单（无底部技能大方格，无空格 QTE）。
- **Tauri v2 独立桌面封装**：桌面工程位于 `desktop/` 与 `.github/workflows/build-desktop.yml`，交互壳层由 `css/indie-desktop.css` + `js/desktop-shell.js` 管控（全局禁非编辑区选中与图片拖拽、自定义极细滚动条、保留 `:focus-visible`），完全离线自包含。
- **装填白名单与受管存档键**：根目录新增运行期入口或资源目录必须同步 `desktop/scripts/prepare-dist.mjs`（`RUNTIME_FILES` / `RUNTIME_DIRS`）；所有持久化键一律使用受管前缀 `ojousama_`、`vn_`、`ves_`、`combat_`、`codex_`。

## 四、战斗唯一数值事实源与核心契约（`combat_numeric_balance_spec.md` V2.2）

- **魔力增幅（三阶·方案 B）**：`0%–60%` 自由微调并磁吸，三段曲线斜率 `1.60`（`0%–20%`）/ `0.60`（`20%–40%`）/ `0.40`（`40%–60%`）：
  - `0%` 常规；
  - `20%` **★一阶·魔力盈溢**：`+1` 破锁、`10%` 穿抗、`1.08×`；护盾 `1.35×` 且货箱守卫 `×2`；
  - `40%` **★★二阶·极寒过载**：`+2` 破锁、`20%` 穿抗、`1.18×`；护盾 `1.45×`；
  - `60%` **★★★三阶·星霜极限**：`+3` 破锁、`30%` 穿抗、`1.30×`；护盾 `1.45×`（香槟金三环 + 冰雷电弧 VFX + 三阶蓄力音效）。
- **技能增幅上限**：`HAND_HEAVY 60%`、`REMOTE 40%`、`SHIELD 40%`、`SWORD / INSIGHT 0%`（由 `overcastCap` 驱动）。
- **核心数值与原著机制**：防御 `K=80`；晦轮杖 `+24% MaxMP` + `100%` 真实魔伤、无自创惩罚，希尔维亚永不触发日蚀；魔战循环第 5 幕解锁，100% 尊重原著等量回蓝。
- **模块核心契约**：
  1. 战斗 UI 统一读 `CombatEngine.getBattleState()` 并由 `combat:statechange` 驱动刷新；
  2. 棱镜 UI 激活时 `W/E/A/D/1..9` 归 `CombatPrismUI`，统一 `X` 结束回合、`L` 战报抽屉；
  3. 战斗角色统一使用 `js/sprites/` 22 套零 PNG 像素骨骼与显式 `animMap`；奔跑循环仅用纯步态帧（无专用帧回退 `[0,1]`），雷纳德支持土/火/风三系施法。
- **战斗特效审美**：战斗特效坚持色彩明亮、晶莹通透、体量饱满、连贯流畅的日系奇幻审美，严禁用暗黑写实毒舌评审打压明亮特效。

## 五、音频与 BGM 规范

- **全覆盖配置与双层命名铁律**：全曲库共注册 22 首 MP3（`BGM_FILES`），主界面现已由音乐总管升级并永久固定为 `Music/Title - Main Theme.mp3`（`title_overture` · `雪晶序曲`）；每个 `SCENES` 须显式配置 `bgm` 贴合剧情情绪，新增背景类同步 `BG_CLASS_TYPE`，所引用 `.mp3` 须真实存在于 `Music/`；全部 22 首曲目响度通过 `game.js` 中 `BGM_TRACK_GAIN` 平衡表无损补偿至约 `-14.5 LUFS`（兼容 `VoiceEngine` Ducking 且不改写 `bgmGetVolume()`）。全曲库采用**双层命名规则**：磁盘 `Music/*.mp3` 统一使用直白英文情绪/功能名便于代码与总管识别，游戏 UI（标题页与音乐室）向玩家展示优雅西幻文艺中文曲名并附清晰场景副标。
- **【音乐资产保护说明】**：批次 1 已验收的新版 Suno 纯西幻曲目资产包含 `Music/Title - Main Theme.mp3`（主界面 `title_overture` · `雪晶序曲`）、`Music/Sacred 1.mp3`、`Music/Sacred 2.mp3`、`Music/Peaceful & Relaxing 1.mp3`、`Music/Peaceful & Relaxing 2.mp3`、`Music/Emotional 1.mp3`、`Music/Romantic.mp3`、`Music/Melancholic & Sad 1.mp3`；**批次 2 已验收的 9 首纯西幻正式资产**包含 `Music/Peaceful 1.mp3`、`Music/Peaceful 2.mp3`、`Music/Cheerful 1.mp3`、`Music/Cheerful 2.mp3`、`Music/Comical_medium-speed.mp3`、`Music/Upset.mp3`、`Music/Suspense - Investigation.mp3`、`Music/Battle - Sparring Duel.mp3`、`Music/Battle - Arena Lobby.mp3`。其他总管**严禁擅自将主界面曲回退为 `Comical_medium-speed.mp3` 或旧版曲目、严禁覆盖、删改或回退 `Music/` 下任何已验收曲目**；所有落选候选曲统一归档在 `archive/music-candidates` 分支，严禁混入 `main`。
- **全曲库 22 首双层对照表（中文文艺名 ↔ 英文功能文件名 ↔ 情绪/用途）**：
  - `title_overture`：`雪晶序曲` ↔ `Music/Title - Main Theme.mp3`（主界面 · 奇幻开篇）
  - `peaceful1`：`晨光圆舞 I` ↔ `Music/Peaceful 1.mp3`（日常平静 · 第一章锁播/宅邸清晨日常）
  - `peaceful2`：`公爵午后 II` ↔ `Music/Peaceful 2.mp3`（日常平静 · 宅邸午后/霁馆烟火）
  - `cheerful1`：`阳光集市 I` ↔ `Music/Cheerful 1.mp3`（轻快热闹 · 集市小镇/花园/海滨）
  - `cheerful2`：`庭院嬉游 II` ↔ `Music/Cheerful 2.mp3`（轻快优雅 · 三姐妹午后/澄岚公会）
  - `academy1`：`阿斯拉钟塔 I` ↔ `Music/Magical Academy 1.mp3`（魔法学院 · 教室/图书馆）
  - `academy2`：`星穹书库 II` ↔ `Music/Magical Academy 2.mp3`（魔法学院 · 学院走廊/课间日常）
  - `relax1`：`雪夜壁炉 I` ↔ `Music/Peaceful & Relaxing 1.mp3`（夜晚休憩 · 宿舍夜谈/篝火休憩）
  - `relax2`：`霜月静思 II` ↔ `Music/Peaceful & Relaxing 2.mp3`（夜晚休憩 · 雪夜露台/星祭/花坊）
  - `sacred1`：`贵族纹章 I` ↔ `Music/Sacred 1.mp3`（庄严神圣 · 大礼堂/勇者之赐/仪典）
  - `sacred2`：`冰晶宫殿 II` ↔ `Music/Sacred 2.mp3`（庄严神圣 · 礼拜堂/觉醒/七座山）
  - `emotional1`：`霜月挽歌` ↔ `Music/Emotional 1.mp3`（温柔催泪 · 离巢告别/冰融/双轨终幕）
  - `romantic`：`炉火余韵` ↔ `Music/Romantic.mp3`（深情温暖 · 海与贝壳/黄昏谈心/求婚）
  - `sad1`：`寒夜哀歌` ↔ `Music/Melancholic & Sad 1.mp3`（沉痛悲伤 · 政变火夜/悲剧哀悼）
  - `suspense1`：`冰晶复调` ↔ `Music/Suspense - Investigation.mp3`（冷静悬疑 · 血案推理/寒夜推演盘）
  - `upset`：`上锁书房` ↔ `Music/Upset.mp3`（压抑暗潮 · 暗潮对峙/地下酒窖/冰封峡谷）
  - `comedy_medium`：`微服谐趣` ↔ `Music/Comical_medium-speed.mp3`（轻松诙谐 · 微服私访/轻快诙谐）
  - `comedy_fast`：`追风闹剧` ↔ `Music/Comical_fast-speed.mp3`（高速搞笑 · 追逐彩蛋）
  - `duel1`：`学院剑舞 I` ↔ `Music/Battle - Sparring Duel.mp3`（轻快切磋 · 姐妹切磋/学院比试战）
  - `duel2`：`演武晴锋 II` ↔ `Music/Battle - Arena Lobby.mp3`（切磋备战 · 演武大厅/贵族试手）
  - `battle1`：`锋刃交错 I` ↔ `Music/Battle & Tension 1.mp3`（紧张实战 · 魔兽遭遇/血案死斗/突围战）
  - `battle2`：`霜原决意 II` ↔ `Music/Battle & Tension 2.mp3`（高潮死斗 · 强敌二阶段/Boss 压轴）
- **战斗分级与覆层配乐**：
  - 9 幕 `STAGE_CONFIGS` 显式配置 `bgmType`：学院比试/轻快切磋 4 幕（`beatrice_11`、`alice_9`、`aino_sparring`、`noelle_14`）及全角色梦境虚拟决斗 `runDuel` 统一走 `duel`（优先 `duel1` `Music/Battle - Sparring Duel.mp3`，零重金属）；血案死斗/魔兽狩猎/火廊突围/列强试剑 5 幕（`rowan_graveyard`、`north_forest_hunt`、`hulan_beast_tide`、`turning_point_corridor`、`wind_god_eye`）保留 `battle`（二阶段 `bgmShiftBattlePhase2()` 与剧情前文已播 `battle` 守卫保持不变）。
  - 演武大厅（`bgmEnterArenaHub`）播放 `duel` / `duel2`（`Music/Battle - Arena Lobby.mp3`），进切磋关时流畅切换至 `duel1`；寒夜冰晶推演盘（`deduction` overlay）播放 `suspense`（`Music/Suspense - Investigation.mp3`）；地下酒窖（`bg-img-cellar`）映射 `upset`（`Music/Upset.mp3`）。
- **章节连贯性**：普通日常/成长对话保持单一连贯 BGM（第一章 `s_start` 永久锁单一 `peaceful` → `Music/Peaceful 1.mp3`，零中途切曲），仅重大幕间转折、暗流推演揭示或突袭战斗高潮处切曲。

## 六、原著基准与叙事 / 舞台 / 面板规范

- **原著权威**：引用或还原剧情 100% 尊重 **`转生千金_1_87.txt`**；罗文血案线在月影迟滞察觉前无人怀疑罗文（此后最先怀疑者仅希尔维亚）。
- **文风与节奏**：保持西幻轻小说质感，无纠正式转折腔与修仙/模板 AI 腔（必过 `novel_linter.py --strict`）；克制非锚点具体数词；对话交代物理场景、一行一框（过长拆 `say`/`DUO`），保留角色内心戏与对话交锋。
- **舞台与立绘**：主导者固定左槽并保持最小位移，用 `DUO` 维持主副槽位（多人特写保主导者用 2 元素数组）；表情按性格定制（常态 `normal`，缺失表情不硬挪用）；新增角色同步登记 `PORTRAIT_FILES`、`CHARS`、`CSS_CHARS`。
- **实时面板**：所有系统/属性面板须通过 UI 弹窗（`sysPopup`）或 HUD 实时调用 `statusPanelHTML()` 渲染，严禁在剧情正文打纯文字面板或硬编码属性。

## 七、交付门禁与防卡死规则

- **四关必过**（均由子代理执行并回传结果）：
  1. `node --check`：改动 JS 0 语法错；
  2. `python3 tools/novel_linter.py --strict`：0 错 0 警；
  3. `node tests/run.js`：`36/36` 全通过；
  4. Playwright 实机跑通 `1440×900` 与 `1280×720`（0 `pageerror` / 0 控制台报错 / 0 资源 404），子代理逐张视觉审图验收。
- **防 `waiting_for_dependents` 卡死**：
  - 严禁裸放后台静态服（如 `http.server &`）；临时服与非交互长命令统一套 `python3 tools/run_safe.py [--serve .] --timeout <秒> -- <命令>`（或 Python 内 `temp_http_server`），自动关 `stdin` 并在结束/超时按进程组清剿后代树。
  - 超过 10 秒的 `run_command` 必设 `NotificationTimeoutSeconds`；发现子代理挂起及时查 `transcript` 处置，阶段交付完成后及时 `kill` 已完工空闲子代理。
