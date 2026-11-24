# 《转生千金》云端无人值守生产指南（Colab Pro+ 零弹窗工厂 vs Google Cloud VPS）

## 方案对比：该选哪一个？

| 维度 | **方案 A（推荐首选）：Colab Pro+ 后台执行 + Secrets (`HF_TOKEN` + `CODEX_AUTH_B64`)** | **方案 B（仅当需要 7×24 手机 Bot/固定公网预览时）：Google Cloud Always-Free VPS (`e2-micro`)** |
| :--- | :--- | :--- |
| **额外费用** | **\$0**（直接用你已有的 Google AI Ultra / Colab Pro+） | **\$0**（Always-Free `e2-micro` 仅限 `us-west1`/`us-central1`/`us-east1` + 30GB `pd-standard`，仍需绑卡开通 GCP 结算） |
| **关电脑自动跑 1.5 卷生图** | **完美支持**（后台执行最长 24 小时，跑完自动 `runtime.unassign()` 停表） | **完美支持**（`systemd` 7×24×365 永不关机） |
| **0 弹窗免 Drive 授权** | **完美支持**（Secrets 配一次 `HF_TOKEN`，多开 1～3 标签页并行永远 0 弹窗、不挂 Drive） | **完美支持**（支持 `HF_TOKEN` 或 `rclone`） |
| **顺带跑 GPU 去噪/抠图** | **一站式搞定**（同一 Notebook Cell 2 直接调 GPU 跑 `keepcolor-denoise`） | 无 GPU，去噪仍需交给 Colab GPU |
| **手机发指令 / 固定 IP 预览** | 不适合（24h 回收，启动批次需点一次「全部运行」） | **适合**（固定公网 IP + `systemd` 常驻） |

---

## 方案 A：3 步零弹窗启动 Colab Pro+ 后台执行工厂（推荐！）

1. **在 Hugging Face（免费账号）创建一个 Write Token**：
   - 打开 `https://huggingface.co/settings/tokens` → 新建 `Write` 权限 Token（形如 `hf_xxxx`）。
2. **在本机运行 1 条命令：同步代码/进度到私有 HF 库，并把 `chatgpt-2` 登录态安全复制到剪贴板**：
   ```powershell
   $env:HF_TOKEN = "hf_你的Token"
   $env:HF_REPO_ID = "你的HF用户名/fictional-adventure-art-cloud"
   .\tools\cloud_vps\sync_to_hf_colab.ps1
   ```
   *(安全说明：脚本不会打印也不会保存明文 `auth.json`，仅将其 Base64 写入 Windows 剪贴板；且无需 `git push` 就能把本地 `23a56b1` 最新代码一起同步上云。)*
3. **在 Google Colab 打开 `tools/cloud_vps/FictionalAdventure_Colab_ZeroPopup_Factory.ipynb`**：
   - 左侧边栏点击 **🔑 Secrets**，添加 3 项并全部勾选「笔记本访问」：
     * `HF_TOKEN` = 你的 HF Write Token
     * `HF_REPO_ID` = `你的HF用户名/fictional-adventure-art-cloud`
     * `CODEX_AUTH_B64` = 直接 `Ctrl+V`（第 2 步已复制进剪贴板）
   - 顶部菜单勾选 **`代码执行程序 → 后台执行`**；
   - 如想 **3 倍极速并行**，复制成 3 个标签页分别填 `SHARD = "1/3"`、`"2/3"`、`"3/3"`（每张图独立写原子回执 `manifests/receipts/<id>.json`，绝不冲突！）；
   - 点击 **`▷ 全部运行`**，然后直接合盖/关电脑，跑完会自动 `runtime.unassign()` 释放实例停止计费！

---

## 方案 B：若以后需要 7×24 手机远程指令，启用 Google Cloud Always-Free VPS

1. 在 Google Cloud Console 创建一台 `e2-micro`（区域选 `us-central1` / `us-west1` / `us-east1`，系统盘 `30 GB 标准永久性磁盘`、Ubuntu 24.04 或 Debian 12 — 永久免费档 \$0/月）。
2. 将仓库快照与 `C:\Users\abc\ChatGPT-Accounts\2\codex\auth.json` 通过 `scp` 传入 VPS，执行 `bash tools/cloud_vps/bootstrap_vm.sh`。
3. 填入 `~/.config/fa-cloud/pipeline.env` 中的 `HF_TOKEN` + `HF_REPO_ID`（或运行 `rclone config`），执行 `sudo systemctl enable --now fa-art-pipeline`，随时用 `fa-status` / `fa-logs` 查看进度。
