# 《转生千金》云端沙箱专属工程任务总书（零 Colab / 零 GPU / 纯代码·剧情·UI·系统·测试）

> **打包基线**：`fictional-adventure` `main`（本地提交 `b5d043f` / 核心合流 `23a56b1`）  
> **打包原则**：本包已预置完整源码、原著全书 `.txt`、全部自动化测试（含 `tests/node_modules` 的离线 `jsdom`）、轻量化预览 `assets/` 与静音 `Music/` 占位文件——解压后**零 `npm install` 即可直接跑通 `node tests/run.js`（31/31 全绿）与 `python tools/novel_linter.py --strict`（0 报错）**。

---

## 一、边界与铁律（云端沙箱必须 100% 遵守）

1. **严禁触碰的资产线（已由 Colab GPU 专线负责）**：
   - **不要修改、重画或回传覆盖 `assets/` 与 `Music/` 里的文件**！本包里的图片和音乐是为了支持云端沙箱跑 Playwright/浏览器截图与测试而生成的轻量预览版，合并回宿主仓库时仅合入代码/样式/剧本/测试改动。
   - **严禁安装或运行 PyTorch / 扩散生图模型**；不需要调用任何 Gemini API（游戏内 AI 代理已全线改为 `codex` / OpenAI 兼容端点）。
2. **文案与质量红线**：
   - 所有新增剧情、奇遇、台词、技能、铭记、人格卡片、UI 文案**严禁出现禁用词 `"不是"`**（务必遵循原著文风与 `AGENTS.md` 设定），且必须通过 `python tools/novel_linter.py --strict`（0 errors, 0 warnings）。
   - 任何 UI / 交互改动**必须接受零通胀毒舌视觉监修**（完整红线见 `tools/GAME_DIRECTOR_CRITIC_SPEC.md`）：若云端沙箱具备 Playwright / 无头浏览器，必须在 **1440×900** 下实拍截图自检；杜绝原生亮白滚动条、按钮重叠、文字溢出、`???` 剧透泄露。
   - 每次修改完成后必须跑通全量 **`node tests/run.js`**（0 失败）与 **`python tools/novel_linter.py --strict`**（0 报错）。
3. **最终交付方式（安全防覆写）**：
   - 全部任务验收收敛后，直接运行仓库内自带的 **`python tools/export_cloud_patch.py`**，会自动对比打包基线 SHA-256，**严格剔除 `assets/`、`Music/`、`tests/node_modules/`**，输出一份干净的 `cloud_sandbox_deliverable.zip`（只包含你新增/修改的代码、样式、剧本、测试文件）及变更清单 `CLOUD_CHANGES_MANIFEST.json`，方便宿主一键无损合回本地高清主仓库！

---

## 二、六大可并行拆解任务（无需 Colab，适合多 Agent 火力全开！）

> 建议按文件边界开 **3～6 个并行 Agent / 子任务**同步推进，最后由主 Agent 统一合流跑全量测试 + 1440×900 视觉审计！

### 模块 M1：终版 1440×900 实机审计遗留的 5 项商业级 UI 抛光（优先级 P0）
> **涉及文件**：`style.css`、`css/combat.css`、`css/gameplay-v2.css`、`index.html`、`game.js`、`js/combat-engine.js`、`js/vn-ux.js`
1. **CG 全屏去黑边**：将 `#cg-bg` 的 `background-size` 从 `contain` 升级为 `cover`（配合 `background-position: center` 与底部柔和暗色文字可读性渐隐遮罩），彻底消除 1440×900（16:10）下 3:2 电影级 CG 左右约 45px 黑边。
2. **自由探索浮动热点防挡脸**：全面检查 `game.js` 中 `EXITS`（特别是 `jikan` 霁馆里的「北林」热点 `x:70, y:30` 与「官道」热点 `y:75`），重新调整避让坐标，确保任意场景的热点胶囊绝不压住居中/左右立绘角色的头部与五官，且不贴死对话框顶边（与 `#text-box` 保持 ≥ 24px 安全间距）。
3. **标题页菜单排版微瑕精修**：
   - 修复第 6 项按钮中突兀的「图鉴 1 CODEX」未对齐数字角标（改为优雅的右侧微型胶囊计数或隐藏未解锁计数，确保 7 个标题按钮视觉节奏 100% 统一）；
   - 确保 `js/vn-ux.js` 注入的「存档档案 ARCHIVE」与「章节速览 CHAPTERS」在 DOM 文本间隔、字重、字间距上与「开始新生活 NEW STORY」完全同源一致。
4. **演武场多怪视觉区分 & 未解锁援护清晰提示**：
   - 在 `js/combat-engine.js` 的 `renderBeastCrestSVG` 中为「头狼 / 领主」与普通小狼（甲/乙/丙）设计差异化 SVG 纹章（如头狼带冰霜王冠+猩红眼眸+金边光环，小狼为银蓝简版），一眼分清集火目标；
   - 演武场或主线尚未解锁羁绊援护时，顶部工具栏展示低调灰锁态的 `✦ 心念援护 F` 提示芯片（`disabled` + `title` 悬浮说明解锁条件），不再凭空消失。
5. **交互与窄屏护栏闭环**：
   - 为 `#action-bar` 里的「奇遇」按钮补上明确的 `id="btn-rumor"`；
   - 修复 `js/vn-ux.js` 对话回看弹窗（`#vn-backlog-modal`）按 `Escape` 键稳定关闭（检查事件捕获顺序，防止被 `game.js` 拦截吞掉）；
   - 为 `< 960px` 窄屏补充战斗区垂直滚动/紧凑缩放保护，杜绝敌方卡片向下压住第一行技能卡。

---

### 模块 M2：深度玩法系统 v2.5 扩容——铭记套装共鸣 × 演武场二阶段 Boss 战（优先级 P0）
> **涉及文件**：`js/relics-and-events.js`、`js/combat-engine.js`、`css/gameplay-v2.css`、`css/combat.css`、`tests/gameplay_depth_v2.js`
1. **12 件随身铭记增加「4 大原著套装共鸣（Synergy）」**：
   - 装备同主题 **2 件 / 3 件**铭记时触发质变羁绊共鸣（例如：「公爵府遗忆」「学院星辉」「霁馆剑心」「北境霜锋」），分别赋予独特战斗规则（如首回合额外 +1 AP、冰晶宫殿洞察附带脆弱层数、剑技反制返还魔力翻倍等）；
   - 在 `✦ 铭记` 面板顶部实时显示已激活共鸣卡片，并在战斗左上角状态栏亮起专属金蓝共鸣徽章。
2. **战术演武大厅新增 2 幕高难 Boss 试炼（第 8、9 幕）+ 二阶段机制转场**：
   - 依据原著《转生贵族～到了异世界就要悠闲生活.txt》忠实设计（如：第 8 幕「转折点·东翼火廊突围战」或「北境裂岩霜龙领主防线战」、第 9 幕「风神·风暴眼试剑」）；
   - 为高难 Boss 实装 **HP 降至 50% 触发二阶段转场演出**（全屏霜金警示横幅 + 原著感台词 + 招式池切换与新破招机制）；
   - 结算界面新增 **S / A / B 战术复盘拆解卡**（展示：总回合数、成功破招次数、魔战回蓝总量、药箱/护盾完整度，给出针对性战术评语）。
3. **跨季度链式连续奇遇**：
   - 将 `js/relics-and-events.js` 中 3 条高光支线升级为 **2～3 幕跨季度连续奇遇链**（如「沛霖与莱恩的暗线商单」「北境白藓药草走私谜案」「学院星象塔旧信」），前序抉择真实写入 `S.causal` 并在后续季度产生不同结局与专属铭记解锁。

---

### 模块 M3：新立绘/表情差分协议接线 + 第三卷补完与第四卷前期主线实装（优先级 P1）
> **涉及文件**：`game.js`、`js/story-vol3.js`、新建 `js/story-vol4.js`、`index.html`、`tests/story_vol3_and_lint.js`
1. **提前接好 2 位新角色 + 9 张新表情差分协议（配合 Colab 即将回流的 24 张成品图）**：
   - 参考 `tools/art_pipeline/production_manifest.json`，在 `game.js` 的 `CHARS` 与立绘解析器中正式注册：
     * 新立绘：`lein`（莱恩 `assets/portraits/lein_normal.png`）、`peilin`（沛霖 `assets/portraits/peilin_normal.png`）；
     * 新表情差分：`aino`（`serious`/`smile`/`shy`）、`jilan`（`serious`/`shy`/`teary`）、`charlotte`（`shy`/`smile`）、`noelle`（`smile`）；
     * 新 CG：`assets/cg/vol3_jikan_parting.png`（接入 `s_distant_wind_1` 霁馆雪晨辞行名场面）；
   - 必须做好**优雅降级**：若某张差分图片尚未回流磁盘（或加载触发 `onerror`），自动无缝回退到该角色的 `normal` 立绘 + 情绪角标，绝不出现裂图！
2. **基于原著全书 `.txt` 推进第三卷收尾支线 & 第四卷前期主线（`js/story-vol4.js`）**：
   - 严读根目录 `转生贵族～到了异世界就要悠闲生活.txt` 对应章节，确保人物称呼、时间线、地点、技能等级与伏笔 100% 忠实原著；
   - 补齐第三卷冰封峡谷自由探索支线（与艾诺、穆萨、防线士兵的深度互动，以及通过 `S.causal` 触发的隐藏微支线）；
   - 起草并接入 `js/story-vol4.js`（至少 2～3 个高质量核心场景 + 1 场原著遭遇战 + 1 段多视角间章），接入 `index.html`、`game.js` `mergeStory()` 与 `VNUx` 章节速览目录；
   - 全程严禁 `"不是"`，过 `novel_linter.py --strict` 0 错误 0 警告。

---

### 模块 M4：AI 角色灵魂卡全员补全 + 命运暗流深层联动（优先级 P1）
> **涉及文件**：`js/ai-personas.js`、`js/branching-director.js`、`js/ai-chat-panel.js`、`server/gemini-proxy.mjs`、`tests/branching_and_personas.js`
1. **补齐第三卷 & 旅途篇核心角色 AI 灵魂卡**：
   - 为 **老霁、霁岚、莱恩、沛霖、阿琼、穆萨** 补写深度原著人格卡（含口癖、知识边界、禁忌剧透锁——例如澄岚/北风堡角色绝不知道「希尔维亚·维斯特利亚」真名与银发蓝眸，只认黑发墨绿眼的「眷寒渔」）；
   - 补强艾诺（学院期 vs 冰封峡谷重逢期）、爱丽丝（童年期 vs 风神亲传期）的分阶段记忆档位。
2. **命运暗流（`S.causal`）反哺主线与奇遇**：
   - 让五组双轴数值真正驱动主线隐藏对话选项、AI 主动开场白记忆回声以及多结局分歧判据，不再只是面板数字。
3. **本地 GPT/Codex 代理健壮性加固（`server/gemini-proxy.mjs`）**：
   - 保持默认 `provider: 'codex'`（`chatgpt-2` 桥接）+ OpenAI 兼容端点，严禁引入 Gemini API；补充 JSON 容错提取、请求超时可控中止、以及更完整的 mock 单测覆盖。

---

### 模块 M5：商业 Galgame 体验全面补齐（优先级 P2）
> **涉及文件**：`js/vn-ux.js`、`game.js`、`index.html`、`style.css`、`css/gameplay-v2.css`
1. **阅读体验控制栏**：在对话框右上角/设置弹窗新增 **Auto 自动播放**（可调停顿速度）、**Skip 快进（仅跳过已读台词，未读自动刹车）**、**打字机速度调节**、**BGM / SFX 独立音量滑块**（全部持久化到 `localStorage`）。
2. **典藏图鉴（`#codex`）升级为「CG 鉴赏画廊 + BGM 音乐室 + 成就墙」**：
   - 已解锁 CG 支持点击全屏高清赏析（配原著经典台词摘录），未解锁显示加密霜蓝剪影防剧透；
   - BGM 音乐室支持按情境分组试听全部曲目并显示曲名与播放波形动效；
   - 成就墙展示已解锁与隐藏成就进度条。

---

### 模块 M6：全量自动化回归防火墙 + 静态/DOM 毒舌质检脚本（优先级 P0 贯穿收尾）
> **涉及文件**：`tests/`、`tools/novel_linter.py`、`tests/run.js`
1. 将 `tools/novel_linter.py` 扩展到同时扫描 `js/story-vol4.js`、`js/relics-and-events.js`、`js/ai-personas.js`、`js/vn-ux.js`，强制全量零 `"不是"` 与语法洁净；
2. 新增 `tests/ui_and_polish_guard.js` 与 `tests/vol4_and_synergy.js` 并接入 `tests/run.js`（目标 **35+ 项全绿**），自动校验：
   - 所有模态弹窗支持 `Escape` 关闭；
   - `#cg-bg` 为 `cover`、`#btn-rumor` 存在、无重复 ID、无未定义场景/背景类/立绘资源死链；
   - 全部 4 套铭记共鸣、新 Boss 二阶段、Auto/Skip/音量持久化、CG 画廊与新角色降级逻辑均通过自动化断言；
3. 若云端沙箱有 Playwright / 浏览器环境，用 `1440×900` 对 M1–M5 所有新界面实拍截图并对照 `tools/GAME_DIRECTOR_CRITIC_SPEC.md` 逐项打分（< 8.5/10 直接打回修到过关为止）。

---

## 三、云端沙箱一键开场白（直接复制贴入云端对话即可开工！）

```text
请先解压我上传的 fictional-adventure-cloud-sandbox-pack.zip，然后完整阅读根目录的 CLOUD_SANDBOX_TASKS.md、AGENTS.md 与 tools/GAME_DIRECTOR_CRITIC_SPEC.md。

执行要求：
1. 本次任务 100% 不需要 Colab、不需要 GPU、不需要生图！不要修改或覆盖 assets/ 与 Music/ 目录里的预览替身文件。
2. 先运行 `node tests/run.js` 与 `python tools/novel_linter.py --strict` 确认开局 31/31 全绿基线。
3. 请直接并行拆解并火力全开完成 CLOUD_SANDBOX_TASKS.md 中的全部 6 大模块（M1 终版 UI 5 项抛光 → M2 铭记套装共鸣+演武场 8/9 幕二阶段 Boss+链式奇遇 → M3 新立绘差分协议接线+第三卷支线补完与第四卷前期 js/story-vol4.js → M4 全员 AI 灵魂卡+命运暗流联动 → M5 Auto/Skip/音量/CG画廊与音乐室 → M6 全量 35+ 项自动化回归与 1440×900 视觉审计）。
4. 严格执行零通胀毒舌审稿标准：每完成一轮必须跑通 `node tests/run.js`（0 失败）与 `python tools/novel_linter.py --strict`（0 报错 0 警告，严禁出现禁用词「不是」）；如沙箱支持浏览器/Playwright，务必在 1440×900 实拍截图肉眼自检并修掉所有视觉瑕疵。
5. 全部验收达标后，运行 `python tools/export_cloud_patch.py` 导出仅含代码/样式/剧本/测试改动的干净交付包 `cloud_sandbox_deliverable.zip` 供我直接合回本地高清主仓库！
```
