# 转生千金 · Fish Audio Drama 3 日语配音批产与质检流水线

本目录承载《转生千金～到了异世界就要悠闲地生活》的全角色日语配音生产工具链，基于 **Fish Audio Drama 3 (SGLang-Omni)** 与 **Fish Audio Cloud API** 双后端，支持 Colab 一键开跑、SHA-256 断点续传、四层工业级自动质检与响度统一。

---

## 一、目录结构与核心组件

| 文件 / 目录 | 作用 |
|---|---|
| `tools/voice/casting_fish_audio.json` | 25 套角色声线选角表（每套含首选 `primary` 与备选 `backup` Fish Audio 模型 ID） |
| `tools/voice/script_jp_master.json` | 全剧与战斗日语总台本（含 `voiceId`、`tier`、`sceneId`、`profileId`、`zh_text`、`jp_text`、`drama3_input`、`audioRelPath`、`audition`） |
| `tools/voice/fetch_fish_refs.py` | 调用公开元数据 API (`GET /model/{id}`，零 TTS 计费) 拉取参考音，清洗展示标记并转为 44.1 kHz 单声道 WAV，输出 `refs_resolved.json` |
| `tools/voice/batch_synthesize.py` | 双后端批产器 + 四层自动质检 + 静音修剪 + 双遍 `loudnorm` + `MP3 64 kbps mono` 落盘 + 生成 `qa_report.json` 并构建 `js/voice-manifest.js` |
| `tools/voice/fish_drama3_colab.ipynb` | 7-Cell 开箱即用 Google Colab Notebook（自动适配显卡、30 秒试音墙、一键全量批产与 Drive 打包） |
| `tools/voice/build_manifest.mjs` | 扫描成品 `assets/voice/` 生成运行期索引 `js/voice-manifest.js` |
| `tools/voice/custom_refs/` | 本地手工干声覆写目录（放置 `<profileId>.wav` + `<profileId>.txt` 即优先接管对应角色参考音） |
| `tools/voice/refs_cache/` | 标准化后的 44.1 kHz 单声道参考 WAV 缓存（不入 Git） |
| `tools/voice/qa_report.json` | 批产质检汇总报告（成功率、平均时长、重抽记录、待人工复听的高 CER 句清单、总包体积 MB） |

---

## 二、Colab 开卡建议与四档 GPU 自动适配策略

打开 [`tools/voice/fish_drama3_colab.ipynb`](./fish_drama3_colab.ipynb) 运行 Cell 1，脚本会实时探测显存与 Compute Capability (`sm_XX`) 并自动切换最佳方案，**绝不写死卡型**：

| 硬件档位 | 自动选型 | 显存 / 启动策略 | 推荐场景与成本评估 |
|---|---|---|---|
| **H100 80GB (`sm_90`)** | `fishaudio/drama-3`（原版 FP8, 41.5 GB）<br>支持一键切换 `Aratako/Drama-3-Japanese` | 默认满血 FP8；参考音上限 `55s`（最多 2 段） | **最推荐（速度与质量双最优）**：30 秒试音 ~30s，全主线+战斗 (~965 句) 约 8–12 分钟 |
| **A100 80GB (`sm_80`)** | 自动切换 **`fishaudio/drama-3-int4`**（22.1 GB） | GPTQ-Marlin SM80 原生核，**彻底规避 FP8 反量化爆显存** | 性价比首选：WER 与 FP8 持平，全主线约 12–16 分钟 |
| **A100 40GB (`sm_80`)** | 自动切换 **`fishaudio/drama-3-int4`** | 自动附加显存收紧参数：<br>`--tts_engine.gpu_memory_fraction 0.58`<br>`--vocoder.gpu_memory_fraction 0.12`<br>`--tts_engine.factory.max_new_tokens 1024`<br>`--preprocessing.total_reserve_bytes 3GiB`<br>`--preprocessing.factory.max_reference_audio_seconds 20` | 稳定运行单卡 40GB；自动将单段参考音收紧至 `<= 19s`（每角色 1 段） |
| **L4 (24GB) / T4 (16GB) / CPU** | 自动回退 **Fish Audio Cloud API** | 友好提示本地加载 Drama 3 会 OOM，自动切换 `--backend fish_api`；支持 **`$0` 免费 `s2.1-pro-free`** 或付费 `drama-3`，**直传 `reference_id`，无需拉取参考音** | 零大卡成本快速试音或免费出全包 |

> **如何配置密钥**：在 Colab 左侧边栏 **🔑 Secrets** 中新建 `FISH_API_KEY` 并开启 Notebook 访问权限；若未配置，Cell 3 也会弹出隐藏密码框 (`getpass`) 读取，**严禁将任何 API Key 写入代码或提交至仓库**。

---

## 三、标准操作流（Colab 与 CLI）

### 方式 A：Colab 一键执行（推荐）
1. **Cell 1**：探测 GPU 档位并挂载 Google Drive（持久化 `HF_HOME` 权重缓存与断点进度）。
2. **Cell 2**：同步仓库并按模式安装 `ffmpeg`、`uv`、`sglang-omni[fishaudio]`（Cloud API 模式仅装轻量依赖）及可选 `litagin/anime-whisper` + `pykakasi`。
3. **Cell 3**：读取 `FISH_API_KEY`，运行 `fetch_fish_refs.py` 拉取并清洗 25 套参考样本，直接在 Notebook 试听原声参考。
4. **Cell 4**：后台启动 `sgl-omni serve --allowed-local-media-path <REF_DIR>` 并实时打印日志等待 `/health` HTTP 200（Cloud API 模式自动跳过）。
5. **Cell 5（30 秒定妆试音）**：运行 `--scope audition`（25 角色 × 2 句 ≈ 50 句），直接在内置 HTML 试听墙听完所有角色表现。
6. **Cell 6（分档/全量批产）**：按需选择 `p1`（第一章 + 高潮幕 + 全战斗 ~380 句）/ `main`（全主线 + 全战斗 ~965 句）/ `all`（含独白与养成支线 ~1,330 句）一键跑完，自动执行四层质检、响度统一与 `build_manifest.mjs`。
7. **Cell 7（质检抽查与归档）**：在 Notebook 点听高 CER 警告句，导出 `voice_release_pack.tar.gz` 至 Google Drive。

### 方式 B：命令行直接运行
```bash
# 1. 拉取并标准化 25 套参考音（可选加 --verify-asr 用 anime-whisper 复核参考转写）
export FISH_API_KEY="your_token_here"
python3 tools/voice/fetch_fish_refs.py --verify-asr

# 2. 启动本地 Drama 3 服务（以 H100 为例；A100 请改用 fishaudio/drama-3-int4）
sgl-omni serve \
  --model-path fishaudio/drama-3 \
  --port 8000 \
  --allowed-local-media-path "$PWD/tools/voice/refs_cache"

# 3. 30 秒试音（25 位角色各 2 句）
python3 tools/voice/batch_synthesize.py --backend sglang --scope audition --asr-qc

# 4. 全主线 + 全战斗批量生产（支持 SHA-256 断点续传）
python3 tools/voice/batch_synthesize.py --backend sglang --scope main --asr-qc --max-retries 3

# 5. 无大卡时直接走 $0 免费 Fish Audio Cloud API（无需第 1、2 步！）
python3 tools/voice/batch_synthesize.py \
  --backend fish_api \
  --fish-api-model s2.1-pro-free \
  --scope audition
```

---

## 四、选角替换方法

试音后若对某位角色声线不满意，有两种零侵入替换方式：

### 1. 更换 Fish Audio 社区模型 ID
编辑 `tools/voice/casting_fish_audio.json`，将对应 `profileId` 的 `primary`（或 `backup`）替换为新的 Fish Audio 模型 ID 或 `https://fish.audio/m/<id>` 链接，然后仅刷新该声线参考音并重跑：
```bash
python3 tools/voice/fetch_fish_refs.py --only-profiles sylvia --force
python3 tools/voice/batch_synthesize.py --scope audition --only-profiles sylvia
```
> 由于 `refHash` 会随新参考 WAV 自动变化，SHA-256 缓存会自动只失效该角色相关台词，其余 24 位角色 100% 秒跳过！

### 2. 本地手工干声覆写（`custom_refs/`）
直接将干净的日语干声音频与对应日文转写文本放入 `tools/voice/custom_refs/`（Colab 下放入 Google Drive 的 `fictional_adventure_voice/custom_refs/`）：
```text
tools/voice/custom_refs/
├── sylvia.wav       # 也支持 .mp3 / .flac / .m4a，会自动转为 44.1 kHz 单声道 WAV（建议 8–20 秒）
└── sylvia.txt       # 与干声逐字对应的纯日文台词（若省略，可开启 --verify-asr 自动转写）
```
再次运行 `fetch_fish_refs.py --only-profiles sylvia --force`，该角色会被标记为 `custom_override` 并接管克隆参考源。

---

## 五、单句返修与质检复听

1. 打开 `tools/voice/qa_report.json`（或在 Colab Cell 7 的复听表查看），定位 `highCerReviewList` 或 `failedLines` 中需返修的 `voiceId`。
2. 如台本断句、假名读音或情感标签需微调，直接修改 `tools/voice/script_jp_master.json` 对应条目的 `drama3_input`（例如汉字改平假名防误读、调整行内情感标签）。
3. 使用 `--only-ids` + `--force` 精准单句重抽（可传逗号分隔或 `@ids.txt` 清单文件）：
```bash
python3 tools/voice/batch_synthesize.py \
  --backend sglang \
  --only-ids v_s_start_0012,v_combat_sylvia_03 \
  --force \
  --asr-qc \
  --max-retries 3
```
完成后脚本会自动更新对应 `.mp3`、刷新 `qa_report.json` 并重新执行 `node tools/voice/build_manifest.mjs`。

---

## 六、关键技术规范与质检红线

- **SGLang-Omni 采样铁律**：固定 `temperature: 1.0`、`top_p: 0.9`；**代码级断言禁止 `top_k`（防中途静音）与 `seed`（服务端拒收）**；单角色单句请求，自动剔除误混 `<|speaker:N|>`。
- **动态 `max_new_tokens`**：按日文字数估算时长 × `21.5` 帧/秒 × `1.8` 冗余并夹在 `[220, 1024]`，彻底防止尾部拖音/死寂幻觉。
- **首词静音 Bug 防护**：自动检测并微调位于句首的 `[pause]` / `[sighs]` 等标签，避免 Drama 3 首词后陷入静音。
- **四层自动质检 + 广播级声学交付**：
  1. **时长校验**：基于日语 4.5–8 字/秒区间拦截吞字截断与拖音幻觉；
  2. **波形校验**：拦截无声/极低电平与削波失真；
  3. **反向 ASR 质检（`--asr-qc`）**：使用 `litagin/anime-whisper`（**严格禁止传入 `initial_prompt`**）结合 `pykakasi` 计算去标点假名 CER，超过 `18%` 自动重抽最多 3 次并保留最低 CER 版本；
  4. **后处理**：精确保留首 `40ms` + 尾 `120ms` 防切爆破音 → 双遍 EBU R128 `loudnorm` 至 **`-16 LUFS / -1.5 dBTP / LRA=7`**（显式 `aresample=44100` 与 `-ar 44100 -ac 1` 避开 192 kHz 采样坑）→ 编码 **`MP3 64 kbps mono`**（全量 1,330 句约 35–48 MB）。

---

## 七、合入主仓库与验收步骤

1. **下载并解压发布包**（仅保留成品音频与 manifest，不提交 `refs_cache/`、`.synth_cache.json` 等缓存文件）：
   ```bash
   tar -xzf voice_release_pack.tar.gz
   node tools/voice/build_manifest.mjs
   ```
2. **确认桌面端装填白名单**：检查 `desktop/scripts/prepare-dist.mjs`，确认 `assets/voice` 与 `js/voice-manifest.js` 均在桌面端打包白名单中。
3. **执行项目四关门禁验收**：
   ```bash
   node --check js/voice-manifest.js
   python3 tools/novel_linter.py --strict
   node tests/run.js
   ```
   并在 `1440×900` 与 `1280×720` 下跑通 Playwright 实机播放验收（0 `pageerror` / 0 控制台报错 / 0 资源 404）。
4. **单次提交推送（防二进制历史撑爆 `.git`）**：待试音与全量复听定稿后再做一次性 `git commit` 推送 `origin/main`（如需反复迭代试音，请勿将中间版 MP3 多次 push 到 `main`）。
