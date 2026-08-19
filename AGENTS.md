# 转生千金～到了异世界就要悠闲地生活 — 协作规则（永久设定）

本仓库是一个中文 **Galgame / 视觉小说网页游戏**，纯静态（无需构建）：
`index.html` + `game.js`（引擎）+ `js/story.js`（剧情数据）+ `style.css` + `assets/`。
所有剧情文本用中文；源码里换行写作 `\n`，运行期由 `escapeText` 转成 `<br>`。

> 本文件是所有协助本项目 AI **都必须遵守** 的永久约定。改动剧情 / 立绘 / 场景前，请先读完本文件与下方「引擎要点」。

## 一、剧情编写永久规则（硬性）

1. **照搬原作**：剧情内容严格依照原著《转生千金～到了异世界就要悠闲地生活》对应章节，
   不自行添加、篡改原著没有的台词或事件；人名、设定、时间线与原著保持一致。
2. **每句话的场景都要合理**：每段剧情必须设置合理的 `bg`（背景图类，见下）与 `loc`
   （`LOCS` 中存在的地点 key）；切场景时二者要一起切。地点栏只能用合法 `LOCS` key，
   否则显示「──」。
3. **对话中所有对话人物的立绘都要放**：对话行必须同时显示参与对话的**双方**立绘
   （用 `portraits` 数组或两个单人立绘写法），不能只显示说话人。
4. **每次对话框显示一句话**：每一句对话单独占一个对话框（一个 line 对象），
   不要把多句台词塞进同一个 `text`。
5. **正在说话的角色的立绘高亮**：用立绘的 `active` 状态高亮当前说话者，另一方用 `dim` 置暗。
   **立绘位置必须稳定（永久）**：同一段对话中，各角色固定站在各自位置，**不得随说话人来回左右换位**。
   用 `DUO()` 时（主角在场→主角固定左、对方固定右；主角不在场→贝阿特丽丝等主导者固定左、对方固定右），
   只切换 `active` 高亮，不交换位置。手写 `portraits` 同理保持位置稳定。
6. **立绘的出场/保留/回收（永久）**：立绘必须在剧情中被有意管理，遵循以下规则，避免出现"旁白已转到下一桥段、立绘却还停在上一人"：
   - **说话/登场**：某人说话或登场时，该人立绘 `active` 高亮；在场的他人 `active:false`（置暗）但不移除。
   - **主角心理描写**：若是主角（希尔维亚）的内心独白，主角立绘高亮（`active:true`）。
   - **对话中的旁白**：若旁白穿插在多人对话之间（如叙述某人动作/反应），保留当前在场立绘但**全部置暗**（`active:false`），**不回收**。
   - **转换剧情事件**：当剧情推进到另一个时间/地点/事件（如"某天晚上""离开某地"），应**同时回收（清空）立绘**（`portraits: []`），再按新桥段的角色重新放出。
   - 一句话一框（见第4条），对话用 `DUO`/`say` 逐句拆分，每句说话人高亮。

## 二、引擎要点（改剧情前必读）

- 剧情数据写在 `js/story.js` 的 `SCENES` 对象里，运行期由 `game.js` 的 `mergeStory()`
  合并覆盖同名场景（**同名场景以 story.js 为准**）。`game.js` 内的旧同名场景已删除。
- 行格式（`js/story.js` 顶部助手函数）：
  - `T(text, extra)` — 旁白；`say(ch, text, extra)` — 单人台词（自动取 `CHARS[ch].short` 为名条）；
  - `N(text, ids, extra)` — 旁白 + 焦点立绘（`ids` 为单人则只显示该人，用于「出场亮相」）；
  - `P(ids)` — 立绘列表（`'id'` 或 `['id','slot','emo']`，slot：`left/center/right`）；
  - `DUO(a, b, speaker, text, extra)` — **双人对话**：`a/b` 为 `[id, short, emo?]`，
    同时显示双方立绘并把 `speaker` 那一方 `active` 高亮、另一方 `dim`。
  - 行可带 `bg` / `loc` / `flag` / `know` / `love` / `sfx` / `do` / `freeRoam` / `card` / `pickTier` 等字段。
- `bg` 必须是 `style.css` 里**已定义**的类：背景图类（如 `bg-img-classroom`、`bg-img-auditorium`、
  `bg-img-training`、`bg-img-dorm`、`bg-img-garden`…）可叠加色调类（`bg-hall` / `bg-school` /
  `bg-room` / `bg-garden` / `bg-plain` / `bg-night` …）。**只有色调类（如 `bg-plain`）而没有背景图类，
  背景会不显示**——教室/训练场等务必带 `bg-img-*`。
- `loc` 必须是 `LOCS` 的合法 key；课堂场景用 `water_class`（水属性教室，bg=`bg-img-classroom bg-school`），
  训练/比试用 `training_field`（bg=`bg-img-training bg-plain`）。
- 触发：季度推进时 `checkStoryGates()` 按 `dateAtLeast(y,m)`（如 `dateAtLeast(12,3)`）与 `flag`
  触发场景。多个场景用 `runSceneQueue([...])` 顺序播放，会在各自 `freeRoam` 处**自动衔接**下一个场景。
- 立绘文件在 `assets/portraits/`，命名 `assets/portraits/<id>_<emo>.png`；新增 `ch` 必须同时在
  `PORTRAIT_FILES`、`CHARS`、`CSS_CHARS` 里登记，否则回退到 CSS 占位立绘。
- 法神（fashen）**仅**在明确剧本需要的对话/剧情中出现立绘；已移除其在学院内随机出现（自由探索）的设定。

## 二点五、背景音乐 BGM 永久规则（硬性）

音乐文件放在仓库根目录 `Music/`（`Music/<情境> <序号>.mp3`，如 `Music/Battle & Tension 1.mp3`）。
引擎在 `game.js` 的 BGM 区块维护 `BGM_FILES`（曲目 key → 文件路径）与 `BGM_GROUPS`（情境类型 → 曲目 key 数组）。

1. **所有场景必须显式配置 bgm（全覆盖）**：每个 `SCENES.x` 场景对象都必须带 `bgm: '类型'` 字段，
   **严禁**依赖背景推断兜底。类型必须是 `BGM_GROUPS` 的 key 之一：
   `battle` / `cheerful` / `academy` / `peaceful` / `relax` / `sacred` / `sad` / `emotional`
   / `comedy_fast` / `comedy_medium` / `romantic` / `upset`。
   新增场景若漏配 `bgm`，`tests/bgm_mapping.js` 会判失败——配好才算完成。
2. **剧情场景用显式 bgm**：场景级 `bgm` 字段在场景启动时由 `runScene` / `stepChain` 强制播放
   （`bgmPlayType(bgm, {force:true})`），**覆盖**背景推断。选曲要贴合剧情情绪（离别/逃亡用 `sad`，
   欢快/热闹用 `cheerful`，学院课堂用 `academy`，礼堂/神圣用 `sacred`，夜晚用 `relax`，一般日常用 `peaceful`）。
2b. **滑稽音乐分中速/快速（永久）**：
   - `comedy_medium`（滑稽中速）：用于**连贯动感但节奏适中**的闯祸/搞笑段落（如微服私访逛街、日常小闹剧）——整体流畅、不急促。
   - `comedy_fast`（滑稽快速）：用于**连贯动感、急促活跃**的段落（如追赶/抓猫、仓皇逃窜、连环闹剧）——节奏快、紧张但仍是搞笑而非战斗。
   微服私访用 `comedy_medium`；若某段是"抓猫式"急促追逐才用 `comedy_fast`。
3. **自由探索按背景推断（也要全覆盖）**：切换地点走 `setBG` → `bgmSyncFromBG` → `bgmTypeForBg`，
   由 `BG_CLASS_TYPE` 映射表把**每个**背景类对应到确定类型（兜底 `peaceful`）。新增背景类必须在
   `BG_CLASS_TYPE` 里登记，否则视为遗漏。
4. **同类型分组轮换（策略 B）**：`BGM_GROUPS` 内多首（如 `peaceful1`/`peaceful2`、`academy1`/`academy2`）
   在同类型间**顺序交替**；**同类型不打断**——当前正播同类型时不重开，切换类型时才淡出→换曲→淡入。
5. **曲目文件必须存在**：`BGM_FILES` 引用的 `.mp3` 必须真实存在于 `Music/`（测试会校验）。缺文件则
   该场景静默无 BGM，属缺陷。
6. 战斗 / 勇者之赐 / 决斗等特殊背景映射到对应类型（`bg-battle`→battle、`bg-pick`→sacred、`bg-duel`→battle），
   自动覆盖日常音乐。

## 三、常见坑

- 「背景不显示」多半是 `bg` 缺 `bg-img-*` 类，或 `loc` 写错 key。
- 多场景连续触发（如开学季的学院篇）必须放进**同一个** `runSceneQueue` 队列，
  否则会拖到后续季度才触发。
- 单句对话里塞多句话会违背「每次对话框显示一句话」；对话请拆成多个 `DUO`/`say` 行。
- **面板表现形式规则（永久）**：原著受限于文本表达形式，在文中直接打出了系统面板参数；但在网页游戏呈现中，所有系统/状态/属性面板必须通过实际的游戏 UI 弹窗（如 `sysPopup`）或 HUD 呈现，**严禁在对话框剧情文本（`text`）中用纯文字打印面板参数**。
- **状态面板必须实时渲染（永久）**：凡是「打开状态面板」的弹窗，正文一律调用 `statusPanelHTML()`（`game.js` 提供的单一数据源，右上角「📖 面板」也用它），**严禁硬编码等级/生命/魔力/攻击等数值**——否则会与玩家实际成长、右上角面板不一致。角色专属的叙事字段（如出生时的「性别 / 天赋亲和 / 状态」）可作为附加行写在 `statusPanelHTML()` 结果之前/之后。
- 改完请用 jsdom 测试台跑一遍：`cd tests && npm test`（或 `node tests/run.js`），确认无 JS 报错、立绘/背景/面板符合预期。套件含静态校验（validate）、运行时冒烟（smoke）、门控流程（gate_flow）、全时间线通关（full_playthrough）、面板一致性（panel_consistency）。
