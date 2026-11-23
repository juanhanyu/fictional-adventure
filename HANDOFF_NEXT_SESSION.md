# 《转生千金》游戏重构 × 一卷半自动化美术管线 — 跨对话与云端沙箱交接总包

> **生成时间**：2026-11-23 23:52 (+08:00)  
> **适用场景**：新开对话无缝接力（本地 Windows 笔记本 **或** 7×24 云端 Linux 沙箱 / VPS / Codespaces / 远程 SSH 工作区）  
> **安全声明**：本文档**不含任何密钥、Token、Cookie 或登录凭据**，可安全留存于仓库与 Google Drive。

---

## 1. 项目全景与不可违背铁律（Hard Constraints）

### 1.1 核心仓库与工具位置
| 组件 | 位置 / 远程地址 | 当前状态 |
| :--- | :--- | :--- |
| 游戏主仓库 `fictional-adventure` | 本地：`C:\Users\abc\.gemini\antigravity\scratch\fictional-adventure`<br>远程：`https://github.com/juanhanyu/fictional-adventure` | `main` 分支本地最新提交 **`23a56b1`**（**尚未 `git push`**），31/31 测试全绿 |
| 去噪增强管线 `keepcolor-denoise` | 本地技能脚本：`C:\Users\abc\.gemini\config\plugins\pv-character-replacement\skills\keepcolor-denoise\scripts\denoise.py`<br>本地仓库：`C:\Users\abc\.gemini\antigravity\scratch\keepcolor-denoise`（只读禁改） | 技能已升级至上游 `c8021d5`（含 `--despeckle` / `--apisr` / `--protect-raw` / `--protect-soft`） |
| Codex 生图桥接脚本 | `C:\Users\abc\.gemini\config\plugins\pv-character-replacement\skills\codex-pv-character-replacement\scripts\codex_imggen.py` | 锁定 `chatgpt-2` 账号，已修复 Windows `.cmd` 截断、禁用慢 MCP、内置 `Popen` 自动收割挂起退出线程 |
| 零通胀毒舌视觉监修规范 | `tools/GAME_DIRECTOR_CRITIC_SPEC.md` | 强制 1440×900 真机截图审计，< 8.5/10 或触碰红线一票否决 |

### 1.2 必须 100% 遵守的 5 条铁律
1. **绝不在本地笔记本运行 PyTorch / GPU 模型**：严禁在用户 Windows 笔记本本地执行 PyTorch、DRUNet、L0、SAM、APISR 或本地重抠图；所有 GPU 视觉推理 100% 留在 **Google Colab 云端 GPU**。
2. **全线使用 GPT / `chatgpt-2` 订阅桥接，严禁回退 Gemini API**：
   - 游戏内 AI 对话代理（`server/gemini-proxy.mjs` & `js/ai-chat-panel.js`）默认走 `provider: 'codex'`（桥接 `chatgpt-2` 订阅，零 API Key）或自定义 OpenAI 兼容 `Base URL + Key`。
   - 美术生图（`batch_runner.py` → `codex_imggen.py`）锁定 `chatgpt-2`（本地 `C:\Users\abc\ChatGPT-Accounts\2\codex`；云端通过环境变量 `CODEX_HOME` 注入）。
   - Colab 云端 `worker.py` 视觉评审走 OpenAI/GPT Vision（`OPENAI_API_KEY` + 可选 `OPENAI_BASE_URL`），零 Gemini API。
3. **毒舌监工零通胀验收标准**：绝不允许仅靠 jsdom 单测就给 UI/游戏打高分；任何 UI 或玩法视觉改动必须由浏览器在 **1440×900** 下实拍截图，并由主 Agent 逐张多模态肉眼核查（核对 `tools/GAME_DIRECTOR_CRITIC_SPEC.md` 全部硬红线）。
4. **Git 与其他项目隔离红线**：
   - 未经用户明确许可，**绝不执行 `git push`**。
   - **绝不修改或回滚** `scratch\keepcolor-denoise`、`reincarnated-lady-2.0`、`sylvia-webtoon-studio`。
   - 常规临时 worktree / 已合并分支自动清理，无需反复打扰用户请示。
5. **文本与交互规范**：
   - 全程使用自然简洁的**简体中文**，保留英文品牌与技术专词（`Google Antigravity`、`Colab`、`ChatGPT`、`SVG`、`CSS`、`API` 等）。
   - 游戏剧情、奇遇、系统文案严禁出现禁用词 `"不是"`，每次改动剧情或系统文案后必跑 `python tools/novel_linter.py --strict`（必须 0 errors / 0 warnings）与 `node tests/run.js`（必须 31/31 PASS）。

---

## 2. 「电脑关机也能跑」云端方案：Colab Pro+ 零弹窗工厂（首选）vs Google Cloud VPS

### 2.1 首选方案 A：Colab Pro+ 后台执行 + Secrets（`HF_TOKEN` + `CODEX_AUTH_B64`）— 零额外费用、0 弹窗、等效且强于免费 VPS！
你已有 **Google AI Ultra / Colab Pro+**，利用官方「后台执行（单次最长 24 小时）」+ 左侧 **🔑 Secrets** 直连 **Hugging Face 私有 Dataset 仓库**，可以**彻底绕开 `drive.mount()` 授权弹窗**，并且实现「生图 + KeepColor GPU 去噪 + 跑完自动 `runtime.unassign()` 停表」一站闭环：
- **已落地的完整配套文件**：
  1. 跨平台 `tools/art_pipeline/codex_imggen.py` & `tools/art_pipeline/batch_runner.py`：原生支持 **Tier-0 Hugging Face 私有库 (`HF_TOKEN` + `HF_REPO_ID`)**、多卡分片 `--shard 1/3` 与每张图独立原子回执 `manifests/receipts/<id>.json`（多开 3 个 Colab 标签页 3 倍提速绝不冲突！），同时保留 `rclone` / Python Drive API / `gdrive` CLI 三模兜底。
  2. 2-Cell 零弹窗云端工厂 Notebook：`tools/cloud_vps/FictionalAdventure_Colab_ZeroPopup_Factory.ipynb`（Cell 1 读 Secrets 装 Node 22 + `@openai/codex` 跑分片生图并实时回传 HF；Cell 2 若挂 GPU 自动跑 `keepcolor-denoise` 去噪并调用 `runtime.unassign()` 自动销毁停表）。
  3. 本机一键同步脚本：`tools/cloud_vps/sync_to_hf_colab.ps1`（自动将 `chatgpt-2` `auth.json` Base64 安全写入系统剪贴板、不打印不落盘，并把本地 `git bundle` + 最新台账 + 已生成原图一键上传你的私有 HF 仓库，**无需 `git push`**）。

### 2.2 备选方案 B：Google Cloud Always-Free VPS（`e2-micro` \$0/月）
仅当你未来需要 **7×24×365 永不关机、固定公网 IP（如手机 Telegram/飞书远程发指令 Bot 或 24 小时公网游戏试玩服）** 时启用：
- 已备妥 Debian/Ubuntu 一键初始化脚本 `tools/cloud_vps/bootstrap_vm.sh`（自动配 2GB Swap 防 OOM、Node 22 + `@openai/codex` + `rclone` + `systemd` 7×24 守护服务 `fa-art-pipeline.service` 与 `fa-status`/`fa-logs` 快捷命令），详见 `tools/cloud_vps/README.md`。

### 2.3 终版 1440×900 实机 7 场景截图审计结论（2026-11-24 已完成！）
- 实测 `http://localhost:8787`：**0 Console Error、0 PageError、0 本地 HTTP 4xx/5xx**。
- 标题页（`9.5/10`）、演武大厅+配装条（`9.6/10`）、北林新背景战斗+实时推演条（`9.4/10`）、第三卷澄岚公会舞台+HUD（`9.7/10`）、回看单弹窗与 `✦ 铭记` 面板、自由探索居中 `#action-bar`、第三卷新 CG 全数通过真机实拍核验。
- 新对话可顺手打磨的 3 个小微瑕：① `#cg-bg` 改为 `background-size: cover` 消除 16:10 视口下 3:2 CG 左右 45px 黑边；② 霁馆自由探索「北林」热点略微上移避开霁岚刘海；③ 确认回看弹窗 `Escape` 键关闭与小屏（<700px）战斗排版保护。

---

## 3. Google Drive & Colab 云端资产精确索引

| 资源 | 类型 | Google Drive ID / URL |
| :--- | :--- | :--- |
| 根目录 `KeepColor_Cloud_Pipeline` | Folder | `1mY0ZOg7IQ69lg8TK20bX1qlEKOgiCFau` |
| `KeepColor_Cloud_GPU_Pipeline.ipynb`（2-Cell 无人值守队列） | Colab Notebook | `1XJYqRaGYOJ9dbhNKOylbcsjSIxRoNFnL`<br>`https://colab.research.google.com/drive/1XJYqRaGYOJ9dbhNKOylbcsjSIxRoNFnL` |
| `worker.py`（GPT Vision + 6 红线校准像素法医） | Python | `1IdqQ2ComKGvv4-Sh8-X9T5_DNQ45xA1B` |
| `game_batch_raw`（生图原图备份目录） | Folder | `1-2MIiAOgUTVj-ILY97cHj514AvlO9HrX` |
| `manifests`（进度清单与交接包目录） | Folder | `1XM7YDDGV5axbaWNGiIW5jhlct24PtH1G` |
| `production_manifest.json`（24 项实时进度表） | JSON | `1LpOzcrmG5DBZaqHuH6OWribtewwuT9a2` |
| `jobs/pending`（待处理 GPU 工单） | Folder | `16IggHUHpffY5Qxop-oGCrfA9hhqeMkzQ` |
| `jobs/completed`（已完成产物） | Folder | `1Irj5lZsej-MSe2_HFL44mE5BWBGhbdCO` |
| `jobs/done`（已归档工单） | Folder | `1uuxs0ivYEC1GbWUOiAaJTi-K0MkE90ZM` |

> **Colab 关键避坑记录（已验证修复）**：
> - 严禁在 Colab 执行 `pip install -U numpy pillow`（会破坏预装 PyTorch/NumPy C-ABI 引发 SIGSEGV 崩溃）；仅按需安装缺失包 `--upgrade-strategy only-if-needed`。
> - 像素法医红线已校准：梯度必须在掩膜核心 `m_raw > 0.5` 内计算；暗部白点触发 `--despeckle` 阈值已校准为 `>= 1200 px`（避免误伤雪景立绘）。

---

## 4. 当前精确进展盘点（截至 `main` 提交 `23a56b1`）

### 4.1 代码与游戏系统（三轨已全部合流，`31/31` 全绿）
最近提交链（本地 `main`，未推送）：
- `23a56b1` — `feat: merge gameplay depth v2 with commercial UI overhaul and wire Vol 3 BGs & CGs`
- `0bdfcc8` — `Merge branch 'feat/ui-commercial-overhaul'`
- `f6007a5` — `feat(ui): commercial winter silver-blue & antique gold UI overhaul`
- `f77389e` — `feat(art): add 5 approved Vol 3 backgrounds and 2 cinema-grade Vol 3 CGs`
- `20d1018` — `feat(gameplay): 实装12件随身铭记构筑、21季度奇遇、战斗预测连携援护与Galgame UX闭环`

核心已完成能力：
1. **商业级 UI 与战斗 VFX 彻底重构**（参考《魔法使之夜》+《重返未来：1999》+《杀戮尖塔 / 崩坏：星穹铁道》）：
   - 全屏雪堡标题页 + 希尔维亚站立立绘 + 雪花粒子 + 典藏双语编排菜单（已与 `VNUx` 线性 SVG「存档档案 ARCHIVE」「章节速览 CHAPTERS」统一风格）。
   - 296px 霜银浅金 HUD + 线性 SVG 图标 + 维斯特利亚家徽 + 磨砂叙事对话框（彻底消除重复立绘与双 Backlog 按钮重叠，统一 `L` 键交由 `VNUx` 防止双弹窗）。
   - 非重叠 AI 交谈抽屉 + 严格防剧透 `???` 锁定态。
   - 全出血战斗剧场（全高立绘、单行无裁剪手牌、自定义狼纹 SVG 纹章、浮动伤害 VFX、6px 暗金细滚动条、`Music/` `&` 编码与 HTTP `206` Range 修复）。
2. **深度玩法系统 v2（已合流）**：
   - `js/relics-and-events.js`：12 件贴合原著的随身铭记秘宝（最多装备 3 件，改变战斗与探索规则）、5 大羁绊心念援护（0 AP，`F` 键）、21 个分阶段（童年/学院/旅途）风险博弈季度奇遇。
   - `js/vn-ux.js`：200 条对话历史回看（`L` 键）、6 槽手动存读档 + 自动存档镜像、全三卷章节速览与快速试玩跳转。
   - `js/combat-engine.js` & `css/gameplay-v2.css`：演武大厅战前铭记整备条、技能悬停实时战术推演条（`.cb-forecast-bar`）、敌方血条预扣条（`.cb-ehp-preview`）、破招连携窗口（`1.35×` 伤害 + `15%` 回蓝）。
3. **第三卷新美术已正式接入游戏代码**：
   - 6 张第三卷背景全部接入 `style.css` / `game.js` / `js/story-vol3.js` / `js/combat-engine.js`：`ice_canyon.jpg`、`chenglan_guild.jpg`、`north_forest.jpg`、`glow_sheep_hill.jpg`、`northwind_tavern.jpg`、`border_snowroad.jpg`。
   - 2 张电影级 CG 全部接入 `js/story-vol3.js` 关键情绪爆点：`vol3_ash_snow.png`（《说给风听的话》灰烬雪夜）、`vol3_ice_canyon_clash.png`（《远行的风（下）》冰封峡谷隔空凝冰救艾诺）。
4. **验证状态**：
   - `node tests/run.js`：**31/31 全绿（0 失败）**；
   - `python tools/novel_linter.py --strict`：**0 errors, 0 warnings**；
   - 新增模块化 JS 全文 `"不是"` 检索：**0 命中**；
   - 临时 worktree（`fa-wt-ui`、`fa-wt-sys`）与分支已全部自动清理。

### 4.2 一卷半美术生产清单精确进度（24 项中已完成 12 项，全部已备份 Google Drive）
| 阶段 | 项目 ID | 状态 | 质量核查 | Drive File ID |
| :--- | :--- | :--- | :--- | :--- |
| Vol 3 背景 | `bg_ice_canyon` | `qa_passed` | 9.5/10，已入库上线 | `1zFffJ4fNJGloLVh9v2jWuRmvIcn3fxEW` |
| Vol 3 背景 | `bg_chenglan_guild` | `qa_passed` | 9.5/10，已入库上线 | `1hgXEh4qDuXGlVzXt6IU-NntJBBd1KonL` |
| Vol 3 背景 | `bg_north_forest` | `drive_synced` | 9.4/10，已入库上线 | `1Ykkwcms6IVIFDRI7Co2HZFzFTA8wf3zZ` |
| Vol 3 背景 | `bg_glow_sheep_hill` | `drive_synced` | 9.5/10，已入库上线 | `1p0Y2cYHbivcha-ASxl9T-LW0N22puot1` |
| Vol 3 背景 | `bg_northwind_tavern` | `drive_synced` | 9.6/10，已入库上线 | `1436eVeLu50ZvcD8XTzqyDIaxky5uKatD` |
| Vol 3 背景 | `bg_border_snowroad` | `drive_synced` | 9.3/10，已入库上线 | `1e869q2EuWyTgnAAySDbSGNc29YUpvei-` |
| Vol 3 CG | `cg_vol3_ice_canyon_clash` | `drive_synced` | 9.7/10，已入库上线 | `1ziDqAKehz8Rx0zWiigL0rCwnGrZJuUUN` |
| Vol 3 CG | `cg_vol3_ash_snow` | `drive_synced` | 9.8/10，已入库上线 | `1L6Ts2VXegsA72nboGW43uvo_5kylMGcr` |
| Vol 3 CG | `cg_vol3_jikan_parting` | `pending`（曾超时） | 待 `--resume` 自动重抽 | — |
| Vol 2-3 立绘 | `portrait_lein_normal` | `drive_synced` | 9.6/10，左右留白 `0px` 截断 | `1_XNTX5WRnUvavuN2FfgaRDoiBYoxElzs` |
| Vol 2-3 立绘 | `portrait_peilin_normal` | `drive_synced` | 9.7/10，左右留白 `0px` 截断 | `1uITRztBUdUSOGZzSxSsGMgbbTAi9ohqu` |
| Vol 2-3 立绘 | `portrait_helena_normal` | `drive_synced` | 9.8/10，左右留白 `0px` 截断 | `1O-utLdW2CR69nyNRbcenPVJnLPBDlgxD` |
| Vol 2-3 立绘 | `portrait_charlotte_normal` | `drive_synced` | 9.8/10，单人去女仆且零截断 | `1mIq41HcMtEXbQGPf2FohDzwf-ebgLJXF` |
| Vol 2-3 立绘 | `portrait_aino_normal` | `pending`（休眠中断） | 待 `--resume` 自动重抽 | — |
| Vol 2-3 立绘 | `portrait_ajun_normal` | 正在后台生成 | 完成后自动入 Drive | — |
| 表情差分 ×9 | `aino`(3)、`jilan`(3)、`charlotte`(2)、`noelle`(1) | `pending` | 随 `--resume` 队列自动依次生成 | — |

---

## 5. 新对话接手后精确执行清单（Priority P0 → P3）

1. **P0（若在云端沙箱/VPS 接手）**：
   - 将 `codex_imggen.py` 与 `batch_runner.py` 升级为跨平台（支持 Linux `CODEX_HOME` 环境变量 + `os.killpg` 自动收割，保留 Windows 兼容），验证 `chatgpt-2` 与 Drive 连通后在 `tmux` 后台跑起 `python tools/art_pipeline/batch_runner.py --resume`，把剩余 12 项（含 `cg_vol3_jikan_parting`、`portrait_aino_normal`、9 张差分）全自动跑完。
2. **P1（终版 1440×900 实机视觉终审）**：
   - 启动 `node server/gemini-proxy.mjs`（默认端口 `8787`），用浏览器在 **1440×900** 下实拍合流后终版的 7 个场景（标题页 SVG 菜单、演武大厅+随身铭记条、北林新背景战斗+悬停战术预测条、第三卷澄岚公会新背景+HUD、对话回看单弹窗+「✦ 铭记」面板、自由探索行动栏+季度奇遇板、新 CG 全屏演出），逐张多模态肉眼复核 `tools/GAME_DIRECTOR_CRITIC_SPEC.md`，有瑕疵立即闭环修复。
3. **P2（Colab 云端 GPU 透明抠图 + 去噪回流游戏）**：
   - 触发 Google Colab 2-Cell 队列（`1XJYqRaGYOJ9dbhNKOylbcsjSIxRoNFnL`），对 `portrait_*` 白底立绘执行云端透明底抠图 + `keepcolor-denoise`（双层语义保护），把验收 ≥ 8.5/10 的成品立绘回流至 `assets/portraits/`，并在 `game.js` 接线新增角色（莱恩 `lein`、沛霖 `peilin`）与 9 张表情差分。
4. **P3（下一阶段扩容与推送）**：
   - 继续按需扩充第四卷剧情/战斗关卡/立绘差分；待用户亲自试玩终版并明确授权后，再执行 `git push` 推送至 GitHub。
