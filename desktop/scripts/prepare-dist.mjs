#!/usr/bin/env node
/**
 * 《转生千金～到了异世界就要悠闲地生活》桌面版运行时资源装填脚本
 * 仅复制纯静态游戏运行必需文件至 desktop/dist/（零外部依赖）
 *
 * 用法：
 *   node desktop/scripts/prepare-dist.mjs
 *   node desktop/scripts/prepare-dist.mjs --dry-run
 *   node desktop/scripts/prepare-dist.mjs --out /tmp/test_dist
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DESKTOP_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..');

// 运行时白名单（凡新增运行期静态目录或入口文件，须同步更新此处）
const RUNTIME_FILES = [
  'index.html',
  'game.js',
  'style.css',
  'manifest.json',
];

const RUNTIME_DIRS = [
  'css',
  'js',
  'assets',
  'Music',
];

const SKIP_BASENAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '__pycache__',
  'node_modules',
  '.git',
]);

const SKIP_EXTS = new Set([
  '.tmp',
  '.bak',
  '.pyc',
  '.pyo',
  '.log',
]);

function parseArgs(argv) {
  let dryRun = false;
  let outDir = path.join(DESKTOP_DIR, 'dist');
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--out' && argv[i + 1]) {
      outDir = path.resolve(process.cwd(), argv[++i]);
    } else if (arg.startsWith('--out=')) {
      outDir = path.resolve(process.cwd(), arg.slice('--out='.length));
    }
  }
  return { dryRun, outDir };
}

function shouldSkipEntry(name) {
  if (SKIP_BASENAMES.has(name)) return true;
  if (name.endsWith('.tmp.png')) return true;
  const ext = path.extname(name).toLowerCase();
  if (SKIP_EXTS.has(ext)) return true;
  return false;
}

function collectFilesFromDir(absDir, relPrefix, outList) {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) continue;
    const absPath = path.join(absDir, entry.name);
    const relPath = path.join(relPrefix, entry.name);
    if (entry.isDirectory()) {
      collectFilesFromDir(absPath, relPath, outList);
    } else if (entry.isFile()) {
      const stat = fs.statSync(absPath);
      outList.push({ absPath, relPath, size: stat.size });
    }
  }
}

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function main() {
  const { dryRun, outDir } = parseArgs(process.argv.slice(2));

  // 安全防呆：拒绝清空仓库根目录或桌面工程根目录
  if (outDir === REPO_ROOT || outDir === DESKTOP_DIR || outDir === path.parse(outDir).root) {
    console.error('[prepare-dist] 拒绝写入受保护目录:', outDir);
    process.exit(1);
  }

  const staged = [];
  const missingRequired = [];

  for (const rel of RUNTIME_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) {
      if (rel === 'manifest.json') continue;
      missingRequired.push(rel);
      continue;
    }
    const stat = fs.statSync(abs);
    staged.push({ absPath: abs, relPath: rel, size: stat.size });
  }

  for (const dir of RUNTIME_DIRS) {
    const absDir = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
      missingRequired.push(dir + '/');
      continue;
    }
    collectFilesFromDir(absDir, dir, staged);
  }

  if (missingRequired.length > 0) {
    console.error('[prepare-dist] 缺少必需的运行时资源:', missingRequired.join(', '));
    process.exit(1);
  }

  // 检查 index.html 桌面外壳接线状态与外链提醒
  const indexHtmlPath = path.join(REPO_ROOT, 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const hasDesktopCss = indexHtml.includes('css/indie-desktop.css');
  const hasDesktopJs = indexHtml.includes('js/desktop-shell.js');
  const hasRemoteFonts = /https?:\/\/fonts\.googleapis\.com/i.test(indexHtml);

  const totalBytes = staged.reduce((sum, item) => sum + item.size, 0);
  const byBucket = {};
  for (const item of staged) {
    const top = item.relPath.includes(path.sep) ? item.relPath.split(path.sep)[0] + '/' : '(root)';
    if (!byBucket[top]) byBucket[top] = { count: 0, bytes: 0 };
    byBucket[top].count++;
    byBucket[top].bytes += item.size;
  }

  console.log('=== 转生千金 · Tauri v2 桌面装填清单 ===');
  console.log(`模式: ${dryRun ? 'DRY-RUN（仅预演，不写入磁盘）' : 'STAGE（正式装填）'}`);
  console.log(`源目录: ${REPO_ROOT}`);
  console.log(`输出目录: ${outDir}`);
  for (const [bucket, info] of Object.entries(byBucket)) {
    console.log(`  - ${bucket.padEnd(10)} ${String(info.count).padStart(4)} 个文件  (${formatMB(info.bytes)})`);
  }
  console.log(`总计: ${staged.length} 个运行时文件，体积 ${formatMB(totalBytes)}`);

  if (!hasDesktopCss || !hasDesktopJs) {
    console.warn(
      '[prepare-dist] 提示: index.html 尚未引入 ' +
      [!hasDesktopCss && 'css/indie-desktop.css', !hasDesktopJs && 'js/desktop-shell.js'].filter(Boolean).join(' / ') +
      '，打包前请确认已接入桌面外壳两行标签。'
    );
  }
  if (hasRemoteFonts) {
    console.log('[prepare-dist] 说明: 检测到 Google Fonts 外链，离线桌面端会自动无缝回退系统宋体/黑体。');
  }

  if (dryRun) {
    console.log('[prepare-dist] Dry-run 完成，零文件写入。');
    return;
  }

  // 清空旧 dist 并按白名单干净装填
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const item of staged) {
    const dest = path.join(outDir, item.relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(item.absPath, dest);
  }

  const meta = {
    product: '转生千金～到了异世界就要悠闲地生活',
    packagedAt: new Date().toISOString(),
    fileCount: staged.length,
    totalBytes,
    buckets: byBucket,
  };
  fs.writeFileSync(path.join(outDir, 'desktop-build-meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`[prepare-dist] 装填完成 -> ${outDir}`);
}

main();
