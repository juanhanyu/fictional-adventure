# 《转生千金～到了异世界就要悠闲地生活》桌面正式版封装指南（Tauri v2）

本目录是游戏的正统独立游戏桌面封装工程，基于 **Tauri v2 + Rust + 系统 WebView2**，将纯静态游戏资源打包为轻量化 Windows 安装包（NSIS `.exe` / `.msi`）及免安装绿色可执行文件，并具备原生本地存档落盘、自动播放标题 BGM、无浏览器右键/选中/默认滚动条等特性。

---

## 一、桌面版核心特性

1. **纯净独立游戏体验**：
   - 屏蔽非输入区域的文字选中与“复制 / 全选”系统浮条，点击推进字幕绝不误选。
   - 屏蔽浏览器默认右键菜单、图片幽灵拖拽，以及 `F5` / `Ctrl+R` / `Ctrl+P` / `Ctrl+S` / `Ctrl+U` / 缩放快捷键。
   - 全局使用棱镜蓝宝石极细滚动条，消灭浏览器默认上下滑轮。
   - 保留 AI 对话框与 API 设置输入框的正常文本选区与复制粘贴功能。
2. **标题页 BGM 自动开声**：
   - 已在 `src-tauri/tauri.conf.json` 为 WebView2 配置 `additionalBrowserArgs: "--autoplay-policy=no-user-gesture-required"`，启动即可自然响起标题曲。
3. **本地文件双保险存档（支持 Steam Cloud / 手动备份）**：
   - 桌面端自动将 `ojousama_*` / `vn_*` / `ves_*` / `combat_*` / `codex_*` 键透明镜像写入操作系统应用数据目录的 `Vesteria/saves/*.json`（Windows 下位于 `%APPDATA%\com.vesteria.fictionaladventure\Vesteria\saves\`）。
   - 启动时自动从磁盘回灌至游戏，即使清空 WebView 缓存也不丢档；可在标题页底缘点击「存档目录」直达该文件夹。
4. **窗口与显示快捷键**：
   - `F11` 或 `Alt + Enter`：无缝切换无边框全屏与窗口模式。
   - 标题页「系统设置 → 常规设置」中可直接切换 `1280×720` / `1600×900` / `1920×1080` 窗口分辨率与退出游戏。

---

## 二、方式 A：GitHub Actions 一键云端打包（推荐，无需本地配置环境）

仓库已内置自动化工作流 `.github/workflows/build-desktop.yml`：

1. 在 GitHub 仓库页面打开 **Actions → Build Windows Desktop (.exe)**。
2. 点击 **Run workflow** 手动触发（或推送以 `v` 开头的版本标签，例如 `git tag v1.0.0 && git push origin v1.0.0`）。
3. 等待构建完成后，在本次运行页面的 **Artifacts** 区域下载：
   - `vesteria-windows-installers`：Windows 中文 NSIS 安装包（`*-setup.exe`）与 `.msi` 安装包。
   - `vesteria-windows-portable`：免安装绿色运行版（`vesteria-desktop.exe`）。

---

## 三、方式 B：Windows 本地构建 `.exe`

### 1. 环境准备（仅首次）

- **Node.js 20+**（推荐使用 LTS）
- **Rust 工具链**（[rustup.rs](https://rustup.rs/)，安装 MSVC 工具链）
- **Visual Studio Build Tools**（勾选「使用 C++ 的桌面开发」工作负载）
- Windows 10 / 11 默认自带 **Edge WebView2 Runtime**

### 2. 安装依赖并打包

在仓库根目录执行：

```bash
cd desktop
npm install
npm run prepare:dry   # 可选：先预演检查装填文件清单与总体积
npm run build         # 正式装填运行时资源并生成 NSIS (.exe) 与 MSI 安装包
```

调试开发模式（热启动桌面窗口）：

```bash
cd desktop
npm run dev
```

### 3. 构建产物位置

构建完成后，产物位于 `desktop/src-tauri/target/release/`：

- **NSIS 中文安装程序**：`desktop/src-tauri/target/release/bundle/nsis/*-setup.exe`
- **MSI 安装程序**：`desktop/src-tauri/target/release/bundle/msi/*.msi`
- **绿色单文件执行程序**：`desktop/src-tauri/target/release/vesteria-desktop.exe`

---

## 四、后续版本维护须知

- `desktop/scripts/prepare-dist.mjs` 仅装填运行期必需资源（`index.html`、`game.js`、`style.css`、`manifest.json`、`css/`、`js/`、`assets/`、`Music/`），自动排除 `tests/`、`tools/`、小说原文 `.txt` 等开发文件。
- **凡后续在根目录新增运行期目录或静态入口文件，务必同步登记至 `desktop/scripts/prepare-dist.mjs` 的 `RUNTIME_FILES` / `RUNTIME_DIRS`。**
- 调试时可在浏览器 URL 后追加 `?dev=1` 临时开放右键审查与默认快捷键；追加 `?kiosk=1` 可在普通浏览器里提前模拟桌面端快捷键防护行为。
