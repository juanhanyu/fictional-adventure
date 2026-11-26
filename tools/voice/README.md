# 转生千金 · 日语全配音一键生产（Colab 极简版）

3 步直接产出全角色日语成品语音包（全量 **1,276 句** / 主线+战斗 **900 句**，`-16 LUFS` 响度统一、`64 kbps mono MP3`）：

1. **打开 Colab**：[点此打开 `fish_drama3_colab.ipynb`](https://colab.research.google.com/github/juanhanyu/fictional-adventure/blob/main/tools/voice/fish_drama3_colab.ipynb)（首选 **G4 (RTX PRO 6000 Blackwell 96GB)**，亦支持 **H100 / A100**；L4 / T4 / CPU 自动直连 Fish Audio API）。
2. **填 Key 并全部运行**：在 **Cell 1** 填入 `FISH_API_KEY`（或存进 Colab 左侧 🔑 Secrets），保持默认 `SCOPE = "all"`，点击菜单 **代码执行程序 → 全部运行 (Run All)**。
   - **G4 (RTX PRO 6000 Blackwell 96GB) / H100 / H200 / B200**：自动启用满血原版 `fishaudio/drama-3`（FP8）
   - **A100 80GB**：自动启用 `fishaudio/drama-3-int4`
   - **A100 40GB**：自动启用 `fishaudio/drama-3-int4` + 5 项显存收紧参数（参考音 `<= 19s`）
   - **L4 / T4 / CPU**：免下 22GB 权重，自动切 Fish Audio API（默认 `drama-3`，可一键改 `s2.1-pro-free`）
   - 默认挂载 Google Drive 保存 SHA-256 断点，断线重跑不丢进度。
3. **下载并解压生效**：运行结束后自动弹出下载 `ojousama_jp_voice_pack.zip`（同时备份到 Google Drive 根目录），解压覆盖进游戏仓库根目录即可生效：
   ```bash
   unzip -o ojousama_jp_voice_pack.zip -d .
   ```

---

### 本地命令行（可选）

```bash
export FISH_API_KEY="your_api_key"
# 本地 GPU 模式（A100 / H100）
python3 tools/voice/fetch_fish_refs.py
sgl-omni serve --model-path fishaudio/drama-3 --port 8000 --allowed-local-media-path "$PWD/tools/voice/refs_cache"
python3 tools/voice/batch_synthesize.py --backend sglang --scope all

# 无大卡直连 Fish Audio API 模式
python3 tools/voice/batch_synthesize.py --backend fish_api --fish-api-model drama-3 --scope all
node tools/voice/build_manifest.mjs
```
