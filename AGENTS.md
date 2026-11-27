# 转生千金～到了异世界就要悠闲地生活 — 总控与开发规范

## 一、顶层调度与并行互斥铁律

- **顶层职责边界**：最高一级只负责向用户简洁汇报、拍板统筹、维护跨总监唯一事实源、派发与验收子代理；严禁亲自读长代码、逐行改业务、跑排查或做测试截图。
- **全面子代理化**：检测、调查、编码、素材、音频、自动化测试与实机审图全交子代理；可拆分任务必须多开并行，派发前写死统一规范（数值 / UI / 键位 / 接口）与严格互斥的文件写权限列表。
- **新会话开局侦察**：新会话接手先派 1 名轻量只读侦察子代理查 `git status`、`git log -n 5` 与 `AGENTS.md`，摸清现状后再制定并行派工方案。
- **子代理无上限与测改分离**：坚持**「子代理无上限」**原则——只要任务可拆且文件写权限互斥，大胆多开并行，绝不为省子代理数量把重活硬塞进少数代理拖成 15–20 分钟长尾；小改单文件用 1 名专精代理，跨模块开发、全站巡检或长耗时验收按模块/分辨率/链路充分并行拆派，严禁把“检测 + 修复 + 重跑 + 发布”全塞进单个串行代理造成长时间卡顿，且验收红队必须保持只读独立、如实曝光全部缺陷。
- **4 条机械强约束与实测耗时配比**（目标任何并行批次在 **3–5 分钟**内齐回；静态门禁与 6 路并发 36 项全量单测约 `65 秒` → 配 **1 名**代理）：
  1. **物理 5 分钟看门狗闹钟**：凡派发可能超 2 分钟的侦察/开发/红队/发布批次，顶层必须同步挂后台 `sleep 300` 定时器，到点系统强唤醒立刻巡检 `stateDetail`，偏题/超载当场勒令收口或 `kill` 拆派；全员提前回传后立刻取消闹钟；
  2. **不可含糊的乘积红线**：真键鼠 / Playwright 代理硬上限 **`分辨率数 × 场景数 <= 3`**（测 3 分辨率必须至少拆 3 路各管 1 分辨率；多条交互链路按场景与分辨率继续并行拆派）；视觉审图代理硬上限 **`单代理截图 <= 6 张`**；
  3. **Dev 禁写 Playwright 铁律**：开发子代理完工只准过 `node --check` + 定向单测，严禁自己写多分辨率浏览器验证脚本（与红队重复劳动）；
  4. **子代理硬时间盒 + 派单亮配额单**：Playwright 子代理最多运行脚本 2 次、单次 `--timeout 45`；顶层每次派并行批次公开汇报 1 行配额单（路数 / 负载 / 闹钟状态）。

## 二、版本控制与行尾纪律

- **分支隔离**：正式改动验收后入库并推送 `origin/main`，提交后确认 `git status --short` 归零且 `HEAD == origin/main`；独立演示页与实验原型统一放 `preview/demos`，严禁混入 `main`。
- **交互演示与审阅交付**：凡交互式审阅页、多方案竞标与独立 Demo，统一推入 `preview/demos` 分支并通过 GitHub Pages 公开 HTTPS 链接交付（严禁给用户发远端 VM `localhost` 或依赖跨文件相对路径的沙盒 iframe）；遵循单文件 `< 50 MB`、总站 `< 1 GB`、控制推送频次且绝不上传任何密钥或私人凭证。
- **提交与行尾**：不提交未对齐半成品；编辑已有文件保持原行尾（如 `js/story-vol3.js` 为 CRLF，避免整文件假 diff）。

## 三、UI 与独立桌面规格

- **桌面端视觉语言**：专注桌面端 `1440×900` / `1280×720`；全站统一雪瓷冰白基底 + 皇家蓝 `#1658eb` + 冰青/淡金（冰晶折射体系），严禁另起暗黑控制台或重胶囊风格。
- **重大 UI 改版三路竞标**：重大 UI 改版须先并行 3 路子代理产出独立 HTML Demo 竞标（推 `preview/demos` 通过 GitHub Pages 审阅），用户拍板后再整合进 `main`。
- **严禁圆框套圆框**：外层已有边框或圆角时，内部按钮、标签、头像、技能项严禁再套带边框圆角盒，层级区分一律用 1px 分隔线、切角/直角、无边框色块或留白字重表达。
- **全站禁原生 `title` 系统灰框**：全站禁止任何交互元素残留浏览器原生 `title` 属性（统一经 `desktop-shell.js` 转为 `data-tip` 并由雪瓷冰白自定义 Tooltip 渲染），网页版与 `.exe` 均永不弹出 Windows/浏览器系统灰框。
- **战斗 UI 与交互范式**：P5 / 八方旅人点击逐级展开棱镜菜单（无底部技能大方格）；战斗交互采用命中前 `0.25×` 慢镜精准缩圈（`Q/W/E/A/S/D` 键池）与敌回合格挡（`Space` 空格键，群怪杂兵 `noBlockPrompt: true` 免弹格挡）。
- **战斗棱镜主菜单四行规格与锚点**：主菜单固定四行——`W` 施放技能（统筹全部攻守技能）、`E` 魔力增幅、`A` 使用道具（预留接口）、`D` 结束回合（删除「演武辅助」）；菜单始终动态锚定在**当前操作角色**身旁且 `z-index` 严格高于角色层；蓝金双菱形枢纽节点（`#cb-pw-hub-toggle`）支持一键收起/展开四选项释放前排视野。
- **严禁诡异手势机制词条**：战斗 UI/标签/意图严禁出现「双手控场」「经手释放」「限手持重术」等脱离直觉的小说手法词条。
- **Tauri v2 独立桌面封装**：桌面工程位于 `desktop/` 与 `.github/workflows/build-desktop.yml`，交互壳层由 `css/indie-desktop.css` + `js/desktop-shell.js` 管控（全局禁非编辑区选中与图片拖拽、自定义极细滚动条、保留 `:focus-visible`），完全离线自包含。
- **装填白名单与受管存档键**：根目录新增运行期入口或资源目录必须同步 `desktop/scripts/prepare-dist.mjs`（`RUNTIME_FILES` / `RUNTIME_DIRS`）；所有持久化键一律使用受管前缀 `ojousama_`、`vn_`、`ves_`、`combat_`、`codex_`。

## 四、战斗唯一数值事实源与核心契约（`combat_numeric_balance_spec.md` V3.2）

- **魔力增幅（方案一 · 1:1 线性增幅）**：`0% / +20% / +40% / +60%` 四档（线性斜率 `1.00`，`1%` 增幅 = `+1%` 增伤池与 `+1%` 额外蓝耗）：
  - `0%` 常规：`+0%` 增伤、`0%` 穿防、`+0` 破锁、护盾 `1.00×`；
  - `+20%` **★一阶·魔力盈溢**：`+20%` 增伤、`10%` 穿防、`+1` 破锁、护盾 `1.25×`；
  - `+40%` **★★二阶·极寒过载**：`+40%` 增伤、`22%` 穿防、`+2` 破锁、护盾 `1.50×`（含堡垒减伤/留盾联动）；
  - `+60%` **★★★三阶·星霜极限**：`+60%` 增伤、`35%` 穿防、`+3` 破锁、护盾 `1.50×`（香槟金三环 + 冰雷电弧 VFX + 三阶蓄力音效）。
- **线性相加增伤池与慢镜缩圈**：攻防增伤统一走线性相加池（满配池上限 `2.02×`）；精准缩圈于命中前 `0.25×` 慢镜触发（预警 `240ms` / 保底 `220ms`，命中瞬间 `0.06×` 顿帧 `55ms`），固定英文四档判定 `BAD -10% / GOOD +10% / GREAT +20% / PERFECT +30%`。
- **5+1 进化 15 招与精确拍数**：
  - **冰晶线**（上限 `60%`）：`ice_1_crystal`（1 拍）/ `ice_2_prism`（同键 3 拍）/ `ice_3_starfrost`（异键 2 拍）；
  - **水系线**（上限 `60%`）：`water_1_ball`（1 拍）/ `water_2_surge`（异键 2 拍）/ `water_3_blade`（异键 2 拍）；
  - **霜域线**（上限 `60%`）：`frost_1_step`（1 拍）/ `frost_2_breath`（1 拍）/ `frost_3_thorns`（随存活敌数 `1–6` 拍逐目标穿刺）；
  - **护盾线**（上限 `40%`）：`shield_1_ice` / `shield_2_mirror` / `shield_3_steel`（均 `0` 拍瞬发）；
  - **剑术与机动线**（上限 `0%`）：`sword_1_basic`（`0` 拍固定 `GOOD` 回 `6%` MP）/ `sword_2_cold_edge`（1 拍）/ `move_afterimage`（`0` 拍瞬发）。
- **线性等阶差格挡与独立休闲模式**：
  - 敌回合触发 `Space` 格挡，同阶减伤基线 `BAD 0% / GOOD 8% / GREAT 18% / PERFECT 30%`，按敌我等阶差线性修正（高阶 `+12%/阶`、低阶 `-10%/阶`）；群怪杂兵统一配置 `noBlockPrompt: true` 免弹格挡。
  - 独立休闲模式 `combat_casual_mode` 默认关闭（开启后敌伤 `0.60×`、敌血盾 `0.70×`、玩家回合额外回蓝 `+15%`、取消 `BAD` 惩罚，与缩圈辅助 `combat_ring_assist_mode` 解耦）。
  - 自动结束回合 `combat_auto_end_turn` 默认开启（玩家不可行动后自动结束回合，设置四端可关闭，与 `combat_casual_mode` / `combat_ring_assist_mode` 同属受管偏好键）。
- **核心数值、法杖与省蓝地板**：防御 `K=80`（穿防上限 `75%`）；全源省蓝折扣硬地板 `0.60×`；晦轮杖 `+24% MaxMP` + `100%` 真实魔伤、无自创惩罚，希尔维亚永不触发日蚀；极北圣晶杖 `+14%` 魔攻 / `+10%` 暴伤 / `-10%` 增幅蓝耗；魔战循环第 5 幕解锁，100% 尊重原著等量回蓝。
- **模块核心契约与像素骨骼生产规范**：
  1. 战斗 UI 统一读 `CombatEngine.getBattleState()` 并由 `combat:statechange` 驱动刷新；
  2. 棱镜 UI 激活时 `W/E/A/D/1..9` 归 `CombatPrismUI`，统一 `X` 结束回合、`L` 战报抽屉；缩圈期接管 `Q/W/E/A/S/D`，敌回合格挡接管 `Space`；
  3. 战斗角色统一使用 `js/sprites/` 22 套零 PNG 像素骨骼：经 `tools/pixel_gpt_pipeline/gpt_to_true_pixel.py` 导出（脚底对齐 `anchors.feet`、Lab 43–57 色量化与 RLE ASCII，局部精修用 `patches/<id>_<pose>.json` + `8×` 坐标标尺），按体型分档 `126×116`–`178×130`；基础 7 帧 `[0:idle1, 1:idle2, 2:blink, 3:windup, 4:cast_step, 5:strike/cast, 6:hurt]`，奔跑 `animMap.run` 仅用纯步态帧（无专用帧回退 `[0,1]`），双态剑+法显式声明 `animMap.magic: [7, 8]`，雷纳德 11 帧支持土/火/风三系施法。
- **战斗特效架构与审美**：已实装方案 A 全套 **75 项技能与系统特效**（`js/vfx-edition-a-core.js`、`js/vfx-pack-player.js`、`js/vfx-pack-enemies.js`、`js/vfx-pack-ally-sys.js` + 13 项系统钩子），采用**像素骨骼底层 + 高清 VFX 覆层双 Canvas 架构**；特效坚持色彩明亮、晶莹通透、体量饱满、连贯流畅的日系奇幻审美，严禁用暗黑写实毒舌评审打压明亮特效。

## 五、音频与 BGM 规范

- **全覆盖配置与双层命名铁律**：全曲库共注册 27 首 MP3（`BGM_FILES`），主界面现已由音乐总管升级并永久固定为 `Music/Title - Main Theme.mp3`（`title_overture` · `雪晶序曲`）；每个 `SCENES` 须显式配置 `bgm` 贴合剧情情绪，新增背景类同步 `BG_CLASS_TYPE`，所引用 `.mp3` 须真实存在于 `Music/`；全部 27 首曲目响度通过 `game.js` 中 `BGM_TRACK_GAIN` 平衡表无损补偿至约 `-14.5 LUFS`（兼容 `VoiceEngine` Ducking 且不改写 `bgmGetVolume()`）。全曲库采用**双层命名规则**：磁盘 `Music/*.mp3` 统一使用直白英文情绪/功能名便于代码与总管识别，游戏 UI（标题页与音乐室）向玩家展示优雅西幻文艺中文曲名并附清晰场景副标。
- **【音乐资产保护说明】**：批次 1 已验收的新版 Suno 纯西幻曲目资产包含 `Music/Title - Main Theme.mp3`（主界面 `title_overture` · `雪晶序曲`）、`Music/Sacred 1.mp3`、`Music/Sacred 2.mp3`、`Music/Peaceful & Relaxing 1.mp3`、`Music/Peaceful & Relaxing 2.mp3`、`Music/Emotional 1.mp3`、`Music/Romantic.mp3`、`Music/Melancholic & Sad 1.mp3`；**批次 2 已验收的 9 首纯西幻正式资产**包含 `Music/Peaceful 1.mp3`、`Music/Peaceful 2.mp3`、`Music/Cheerful 1.mp3`、`Music/Cheerful 2.mp3`、`Music/Comical_medium-speed.mp3`、`Music/Upset.mp3`、`Music/Suspense - Investigation.mp3`、`Music/Battle - Sparring Duel.mp3`、`Music/Battle - Arena Lobby.mp3`；**批次 3 已验收的 3 首纯西幻正式资产**包含 `Music/Battle & Tension 2.mp3`（强敌二阶段管风琴合唱曲，响度增益 `1.00`）、`Music/Story - Starry Flight.mp3`（`starry_flight` · `星河乘风`，增益 `0.92`）、`Music/Battle - Dragon Finale.mp3`（`boss_finale` · `破冰终章`，增益 `0.95`）；**批次 4 已验收的 3 首纯西幻正式资产**包含 `Music/Battle - Wind God Trial.mp3`（`boss_windgod` · `风神试剑`，增益 `1.00`）、`Music/Travel - Northern Frontier.mp3`（`northern_frontier` · `北境远行`，增益 `0.90`）、`Music/Battle - Victory March.mp3`（`victory1` · `凯旋乐章`，增益 `1.00`）。其他总管**严禁擅自将主界面曲回退为 `Comical_medium-speed.mp3` 或旧版曲目、严禁覆盖、删改或回退 `Music/` 下任何已验收曲目**；所有落选候选曲统一归档在 `archive/music-candidates` 分支，严禁混入 `main`。
- **全曲库 27 首双层对照表（中文文艺名 ↔ 英文功能文件名 ↔ 情绪/用途）**：
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
  - `northern_frontier`：`北境远行` ↔ `Music/Travel - Northern Frontier.mp3`（北境远行 · 北风堡/赫兰雪原与冻土孤旅）
  - `starry_flight`：`星河乘风` ↔ `Music/Story - Starry Flight.mp3`（星夜自由 · 萤尾羊星河/乘风飞翔）
  - `sad1`：`寒夜哀歌` ↔ `Music/Melancholic & Sad 1.mp3`（沉痛悲伤 · 政变火夜/悲剧哀悼）
  - `suspense1`：`冰晶复调` ↔ `Music/Suspense - Investigation.mp3`（冷静悬疑 · 血案推理/寒夜推演盘）
  - `upset`：`上锁书房` ↔ `Music/Upset.mp3`（压抑暗潮 · 暗潮对峙/地下酒窖/冰封峡谷）
  - `comedy_medium`：`微服谐趣` ↔ `Music/Comical_medium-speed.mp3`（轻松诙谐 · 微服私访/轻快诙谐）
  - `comedy_fast`：`追风闹剧` ↔ `Music/Comical_fast-speed.mp3`（高速搞笑 · 追逐彩蛋）
  - `duel1`：`学院剑舞 I` ↔ `Music/Battle - Sparring Duel.mp3`（轻快切磋 · 姐妹切磋/学院比试战）
  - `duel2`：`演武晴锋 II` ↔ `Music/Battle - Arena Lobby.mp3`（切磋备战 · 演武大厅/贵族试手）
  - `battle1`：`锋刃交错 I` ↔ `Music/Battle & Tension 1.mp3`（紧张实战 · 魔兽遭遇/血案死斗/突围战）
  - `battle2`：`霜原决意 II` ↔ `Music/Battle & Tension 2.mp3`（高潮死斗 · 强敌二阶段/宿命死斗）
  - `boss_windgod`：`风神试剑` ↔ `Music/Battle - Wind God Trial.mp3`（列强试炼 · 风神一阶段专属）
  - `boss_finale`：`破冰终章` ↔ `Music/Battle - Dragon Finale.mp3`（终章史诗 · 风神二阶段/终章斩龙史诗）
  - `victory1`：`凯旋乐章` ↔ `Music/Battle - Victory March.mp3`（凯旋捷音 · 战斗胜利结算与演武凯旋）
- **战斗分级、强敌升调、胜利/战败播法与覆层配乐**：
  - 9 幕 `STAGE_CONFIGS` 显式配置 `bgmType`：学院比试/轻快切磋 4 幕（`beatrice_11`、`alice_9`、`aino_sparring`、`noelle_14`）及全角色梦境虚拟决斗 `runDuel` 统一走 `duel`（优先 `duel1` `Music/Battle - Sparring Duel.mp3`，零重金属）；血案死斗/魔兽狩猎/火廊突围 4 幕（`rowan_graveyard`、`north_forest_hunt`、`hulan_beast_tide`、`turning_point_corridor`）保留 `battle`（剧情前文已播 `battle` 守卫保持不变）；Act 09 `wind_god_eye` 一阶段专属配置 `bgmType: 'wind_god'`、`bgmKey: 'boss_windgod'`（《风神试剑》）。
  - **强敌分层升调（`bgmShiftBattlePhase2(preferKey)`）**：Act 07 `hulan_beast_tide` 第二波（Wave 2）4 阶领主「霜渊裂地兽」降临自动触发 `bgmShiftBattlePhase2('battle2')`；Act 08 `turning_point_corridor` 东翼封锁官等常规 Boss 半血二阶段切 `battle2`（新版管风琴合唱曲）；Act 09 `wind_god_eye` 一阶段播放 `boss_windgod`（《风神试剑》），半血（55%）风暴眼全开二阶段自动切入 `phase2BgmKey: 'boss_finale'`（`Music/Battle - Dragon Finale.mp3`《破冰终章》）；战斗状态同步维护 `bgmType` / `bgmKey`，确保音乐室试听返回后 `bgmRestoreContext()` 精准复原当前战乐。
  - **战斗胜利/战败结算播法与上下文保护**：
    - **胜利三段式黄金声场**：进战时静默预热 `Music/Battle - Victory March.mp3` 缓存；胜利弹窗瞬间（`t = 0ms`）以 `fadeOutMs: 100`、`fadeInMs: 0` 瞬切至 `victory` / `victory1`（100ms 收战曲、0ms 全音量起号角），同步 `b.bgmType = 'victory'`、`b.bgmKey = 'victory1'`；非 S 胜用短促 `safeSfx('ok')` 避免与铜管号角冲突（S 胜保留 `grade_s`）；常规胜利经 **`1350ms`** 黄金号角独占窗后经可取消定时器 `_victoryVoiceTimer` 触发胜利语音（在 `exitBattle` / `startStage` / `startCustomOrStageBattle` / `startFromBossWaveSnapshot` 入口统一清理防串音；认输语音播映期仍走 `onEndedOnce`）。
    - **战败静音收束**：战败保留 `safeSfx('bad')` 与 `defeat` 语音，同时调用 `bgmStop(true, { preserveContext: true, fadeOutMs: 450 })` 平滑收静并清空 `b.bgmType = null`、`b.bgmKey = null`；`bgmRestoreContext()` 在战败结算弹窗期间保持静音不拉回战斗曲、胜利结算弹窗期间精准恢复 `victory1`，退出战斗后按保留上下文完好恢复外部 BGM。
  - **剧情高潮飞翔与北境远行切曲**：《萤尾羊》与《风暴眼》高潮乘风飞翔桥段切入 `flight`（`starry_flight` · `Music/Story - Starry Flight.mp3`）；第三卷北上冻土官道/雪原（`bg-img-border-snowroad` / `bg-img-plain`、`s_jikan_north_vow` 辞行踏入北境官道等）切入 `journey`（`northern_frontier` · `Music/Travel - Northern Frontier.mp3`）。
  - 演武大厅（`bgmEnterArenaHub`）播放 `duel` / `duel2`（`Music/Battle - Arena Lobby.mp3`），进切磋关时流畅切换至 `duel1`；寒夜冰晶推演盘（`deduction` overlay）播放 `suspense`（`Music/Suspense - Investigation.mp3`）；地下酒窖（`bg-img-cellar`）映射 `upset`（`Music/Upset.mp3`）。
- **章节连贯性**：普通日常/成长对话保持单一连贯 BGM（第一章 `s_start` 永久锁单一 `peaceful` → `Music/Peaceful 1.mp3`，零中途切曲），仅重大幕间转折、暗流推演揭示、北境启程、高潮乘风飞翔或突袭战斗高潮处切曲。

## 六、原著基准与叙事 / 舞台 / 面板规范

- **原著权威**：引用或还原剧情 100% 尊重 **`转生千金_1_87.txt`**；罗文血案线在月影迟滞察觉前无人怀疑罗文（此后最先怀疑者仅希尔维亚）。
- **文风与节奏**：保持西幻轻小说质感，无纠正式转折腔与修仙/模板 AI 腔（必过 `novel_linter.py --strict`）；克制非锚点具体数词；对话交代物理场景、一行一框（过长拆 `say`/`DUO`），保留角色内心戏与对话交锋。
- **舞台与立绘**：主导者固定左槽并保持最小位移，用 `DUO` 维持主副槽位（多人特写保主导者用 2 元素数组）；表情按性格定制（常态 `normal`，缺失表情不硬挪用）；同角色 2D 立绘差分须将基础立绘作为 `ImagePaths` 参考图锁画风；新增角色同步登记 `PORTRAIT_FILES`、`CHARS`、`CSS_CHARS`。
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
- **环境与禁用技能备注**：推送仓库依赖 `github` 插件；常用工具与内置技能含 Node 22、Python 3.12、Playwright Chromium、`generate_image`（或 `tools/art_pipeline/codex_imggen.py`）、`game-ui-ux`、`game-feel`、`visual-novel`、`github`；**`game-dev-combat-skill-polish` 已永久停用**。
