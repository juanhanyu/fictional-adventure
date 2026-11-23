#!/usr/bin/env bash
# ==============================================================================
# 《转生千金》Google Cloud Always-Free (e2-micro) / 任意 Ubuntu/Debian VPS 一键初始化脚本
# 适用场景：当你需要 7x24x365 永不关机常驻运行（例如手机远程发指令 Bot、公网预览服、常驻调度器）
# 零本地 GPU / 零 PyTorch，自动配置 2GB Swap 防止 e2-micro 1GB 内存 OOM！
# ==============================================================================
set -euo pipefail

APP_USER="${SUDO_USER:-$USER}"
APP_HOME="$(eval echo ~"$APP_USER")"
REPO_DIR="${APP_HOME}/fictional-adventure"
CODEX_DIR="${APP_HOME}/.codex-chatgpt2"

echo "=== [1/6] 配置 2GB Swap（保护 Always-Free e2-micro 不 OOM）==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  sudo sysctl vm.swappiness=20
fi

echo "=== [2/6] 安装基础工具 + Node.js 22 + @openai/codex + rclone ==="
sudo apt-get update -qq
sudo apt-get install -y -qq git curl ca-certificates gnupg tmux jq python3-venv python3-pip rclone
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
if ! command -v codex >/dev/null 2>&1; then
  sudo npm install -g @openai/codex
fi

echo "=== [3/6] 初始化 Python 轻量虚拟环境（严禁装 PyTorch！）==="
mkdir -p "${REPO_DIR}"
python3 -m venv "${APP_HOME}/.fa-venv"
"${APP_HOME}/.fa-venv/bin/pip" install -q --upgrade pip
"${APP_HOME}/.fa-venv/bin/pip" install -q pillow numpy huggingface_hub google-api-python-client google-auth google-auth-oauthlib

echo "=== [4/6] 初始化 chatgpt-2 隔离配置目录 ==="
mkdir -p "${CODEX_DIR}"
if [ ! -f "${CODEX_DIR}/config.toml" ]; then
  cat > "${CODEX_DIR}/config.toml" <<'EOF'
# 云端轻量配置（禁用桌面慢 MCP）
EOF
fi
[ -f "${CODEX_DIR}/auth.json" ] && chmod 600 "${CODEX_DIR}/auth.json"

echo "=== [5/6] 写入 systemd 7x24 自动守护服务 ==="
ENV_FILE="${APP_HOME}/.config/fa-cloud/pipeline.env"
mkdir -p "$(dirname "$ENV_FILE")"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
CODEX_IMGGEN_HOME=${CODEX_DIR}
CODEX_HOME=${CODEX_DIR}
# 如使用 Hugging Face 私有库（0 弹窗推荐），填入以下两行：
# HF_TOKEN=hf_xxxx
# HF_REPO_ID=你的用户名/fictional-adventure-art-cloud
# 如使用 rclone 挂 Google Drive，先运行 rclone config 创建名为 gdrive 的远程：
# RCLONE_GDRIVE_REMOTE=gdrive
EOF
  chmod 600 "$ENV_FILE"
fi

sudo tee /etc/systemd/system/fa-art-pipeline.service >/dev/null <<EOF
[Unit]
Description=Fictional Adventure 7x24 Art Pipeline Daemon (chatgpt-2)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${REPO_DIR}
EnvironmentFile=-${ENV_FILE}
ExecStart=${APP_HOME}/.fa-venv/bin/python ${REPO_DIR}/tools/art_pipeline/batch_runner.py --resume --daemon --poll-interval 120
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo tee /usr/local/bin/fa-status >/dev/null <<EOF
#!/usr/bin/env bash
systemctl status fa-art-pipeline --no-pager -n 15 || true
python3 -c 'import json; d=json.load(open("${REPO_DIR}/tools/art_pipeline/production_manifest.json")); c={}; [c.__setitem__(x["status"], c.get(x["status"],0)+1) for x in d["items"]]; print("MANIFEST_SUMMARY:", c)' 2>/dev/null || true
EOF
sudo chmod +x /usr/local/bin/fa-status

sudo tee /usr/local/bin/fa-logs >/dev/null <<'EOF'
#!/usr/bin/env bash
journalctl -u fa-art-pipeline -f -n 80
EOF
sudo chmod +x /usr/local/bin/fa-logs

sudo systemctl daemon-reload
echo "=== [6/6] 初始化完毕！==="
echo "1. 确认已通过 scp 上传 ${CODEX_DIR}/auth.json 与仓库至 ${REPO_DIR}"
echo "2. 在 ${ENV_FILE} 填入 HF_TOKEN + HF_REPO_ID（或执行 rclone config 配置 gdrive）"
echo "3. 执行：sudo systemctl enable --now fa-art-pipeline && fa-logs"
