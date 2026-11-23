<#
.SYNOPSIS
  一键打包本地《转生千金》最新代码、当前台账与已生成原图并同步至你的私有 Hugging Face 仓库，
  同时将 chatgpt-2 的 auth.json Base64 安全写入剪贴板（绝不打印日志、绝不落盘进 Git），供 Colab Secrets 一次性粘贴。

.EXAMPLE
  $env:HF_TOKEN = "hf_xxxxxxxx"
  $env:HF_REPO_ID = "你的用户名/fictional-adventure-art-cloud"
  .\tools\cloud_vps\sync_to_hf_colab.ps1
#>
param(
  [string]$HfToken = $env:HF_TOKEN,
  [string]$HfRepoId = $env:HF_REPO_ID,
  [string]$CodexAuthPath = "C:\Users\abc\ChatGPT-Accounts\2\codex\auth.json",
  [switch]$ClipboardAuthOnly
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

# 1. 安全读取 chatgpt-2 auth.json 并仅复制到剪贴板（不输出明文、不写磁盘）
if (Test-Path $CodexAuthPath) {
  $bytes = [System.IO.File]::ReadAllBytes($CodexAuthPath)
  $b64 = [Convert]::ToBase64String($bytes)
  Set-Clipboard -Value $b64
  Write-Host "✅ 已将 chatgpt-2 auth.json 的 Base64 安全复制到系统剪贴板（长度 $($b64.Length) 字符，未输出明文、未落盘）。" -ForegroundColor Green
  Write-Host "   👉 请在 Colab 左侧 🔑 Secrets 中新建 CODEX_AUTH_B64 并直接 Ctrl+V 粘贴（勾选 Notebook 访问权限）。" -ForegroundColor Cyan
} else {
  Write-Warning "未找到 $CodexAuthPath，跳过剪贴板复制。"
}

if ($ClipboardAuthOnly) { exit 0 }

if (-not $HfToken -or -not $HfRepoId) {
  Write-Host "`n⚠️ 尚未传入 HF_TOKEN 或 HF_REPO_ID，仅完成了 CODEX_AUTH_B64 剪贴板复制。" -ForegroundColor Yellow
  Write-Host '用法：$env:HF_TOKEN="hf_xxx"; $env:HF_REPO_ID="你的用户名/fictional-adventure-art-cloud"; .\tools\cloud_vps\sync_to_hf_colab.ps1'
  exit 0
}

# 2. 打包当前仓库完整本地提交（含未 push 的 23a56b1 等提交）
$TmpDir = Join-Path $env:TEMP ("fa_hf_sync_" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
$BundlePath = Join-Path $TmpDir "fictional-adventure.bundle"

Push-Location $RepoRoot
try {
  Write-Host "📦 正在打包本地 Git 仓库快照（无需 git push）..."
  git bundle create $BundlePath --all
} finally {
  Pop-Location
}

# 3. 通过 Python huggingface_hub 上传 bundle + 最新台账 + 本地已完成原图（自动建私有库）
$PyCode = @'
import os, sys
from pathlib import Path
from huggingface_hub import HfApi

token = os.environ["FA_SYNC_HF_TOKEN"]
repo_id = os.environ["FA_SYNC_HF_REPO"]
repo_root = Path(os.environ["FA_SYNC_REPO_ROOT"])
bundle_path = Path(os.environ["FA_SYNC_BUNDLE"])

api = HfApi(token=token)
api.create_repo(repo_id=repo_id, repo_type="dataset", private=True, exist_ok=True)
print(f"🔒 私有仓库就绪: https://huggingface.co/datasets/{repo_id}")

api.upload_file(path_or_fileobj=str(bundle_path), path_in_repo="repo/fictional-adventure.bundle", repo_id=repo_id, repo_type="dataset", commit_message="sync repo bundle")
print("✅ 已上传 repo/fictional-adventure.bundle")

mf = repo_root / "tools/art_pipeline/production_manifest.json"
if mf.is_file():
    api.upload_file(path_or_fileobj=str(mf), path_in_repo="manifests/production_manifest.json", repo_id=repo_id, repo_type="dataset", commit_message="sync production_manifest.json")
    print("✅ 已上传 manifests/production_manifest.json")

nb = repo_root / "tools/cloud_vps/FictionalAdventure_Colab_ZeroPopup_Factory.ipynb"
if nb.is_file():
    api.upload_file(path_or_fileobj=str(nb), path_in_repo="notebooks/FictionalAdventure_Colab_ZeroPopup_Factory.ipynb", repo_id=repo_id, repo_type="dataset", commit_message="sync colab zero-popup notebook")
    print("✅ 已上传 notebooks/FictionalAdventure_Colab_ZeroPopup_Factory.ipynb")

raw_dir = repo_root / "tools/art_pipeline/raw"
if raw_dir.is_dir():
    existing = set(api.list_repo_files(repo_id=repo_id, repo_type="dataset"))
    uploaded = 0
    for png in sorted(raw_dir.glob("*.png")):
        rel = f"game_batch_raw/{png.name}"
        if rel not in existing:
            api.upload_file(path_or_fileobj=str(png), path_in_repo=rel, repo_id=repo_id, repo_type="dataset", commit_message=f"seed raw {png.name}")
            uploaded += 1
    print(f"✅ 已同步本地原图（新上传 {uploaded} 张，已存在自动跳过）")
'@

$env:FA_SYNC_HF_TOKEN = $HfToken
$env:FA_SYNC_HF_REPO = $HfRepoId
$env:FA_SYNC_REPO_ROOT = $RepoRoot
$env:FA_SYNC_BUNDLE = $BundlePath

try {
  python -c "import huggingface_hub" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 安装轻量依赖 huggingface_hub..."
    python -m pip install -q huggingface_hub
  }
  $PyCode | python -
  Write-Host "`n🎉 全部云端同步完成！现在在 Colab 打开 FictionalAdventure_Colab_ZeroPopup_Factory.ipynb -> 开启【后台执行】-> 点击【全部运行】即可关机！" -ForegroundColor Green
} finally {
  Remove-Item Env:FA_SYNC_HF_TOKEN, Env:FA_SYNC_HF_REPO, Env:FA_SYNC_REPO_ROOT, Env:FA_SYNC_BUNDLE -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}
