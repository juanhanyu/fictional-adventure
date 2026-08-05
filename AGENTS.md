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

## 三、常见坑

- 「背景不显示」多半是 `bg` 缺 `bg-img-*` 类，或 `loc` 写错 key。
- 多场景连续触发（如开学季的学院篇）必须放进**同一个** `runSceneQueue` 队列，
  否则会拖到后续季度才触发。
- 单句对话里塞多句话会违背「每次对话框显示一句话」；对话请拆成多个 `DUO`/`say` 行。
- 改完请用 jsdom 测试台（参考 `node /tmp/test*.js` 之类）跑一遍，确认无 JS 报错、立绘/背景符合预期。
