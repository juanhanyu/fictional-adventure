#!/usr/bin/env node
/**
 * tools/voice/build_manifest.mjs
 *
 * 扫描 `assets/voice/` 下实际存在的 `.mp3` 文件并与 `tools/voice/script_jp_master.json`
 * （若尚未生成则在非 --strict 模式下回退至 `tools/voice/raw_extracted/batch_*.json` 预检）交叉核验：
 *   1. 严格校验 0 坏链（manifest 仅收录真实存在且 size > 0 的 `.mp3`）；
 *   2. 严格校验体量预算（单文件 < 50 MB，总音频体积 <= --budget-mb 默认 120 MB）；
 *   3. 校验 `voiceId` 与 `audioPath` 符合 `casting_fish_audio.json` SSOT 契约；
 *   4. 输出 `js/voice-manifest.js`（全局 `window.VOICE_MANIFEST`）和 `assets/voice/manifest.json`（支持 `--dry-run`）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_CASTING_PATH = path.join(__dirname, 'casting_fish_audio.json');
const DEFAULT_MASTER_PATH = path.join(__dirname, 'script_jp_master.json');
const DEFAULT_RAW_DIR = path.join(__dirname, 'raw_extracted');
const DEFAULT_VOICE_DIR = path.join(ROOT, 'assets', 'voice');
const OUT_JS_MANIFEST = path.join(ROOT, 'js', 'voice-manifest.js');
const OUT_JSON_MANIFEST = path.join(ROOT, 'assets', 'voice', 'manifest.json');

const SINGLE_FILE_HARD_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB GitHub Pages hard limit
const DEFAULT_BUDGET_MB = 120;

export function normalizeVoiceText(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

export function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    strict: false,
    budgetMb: DEFAULT_BUDGET_MB,
    masterPath: DEFAULT_MASTER_PATH,
    voiceDir: DEFAULT_VOICE_DIR,
    castingPath: DEFAULT_CASTING_PATH,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--strict') {
      opts.strict = true;
    } else if (arg === '--budget-mb' && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --budget-mb value: ${argv[i]}`);
      opts.budgetMb = n;
    } else if (arg === '--master' && argv[i + 1]) {
      opts.masterPath = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--voice-dir' && argv[i + 1]) {
      opts.voiceDir = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--casting' && argv[i + 1]) {
      opts.castingPath = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--help' || arg === '-h') {
      console.log([
        'Usage: node tools/voice/build_manifest.mjs [options]',
        '  --dry-run             Validate & print report without writing js/voice-manifest.js or assets/voice/manifest.json',
        '  --strict              Fail with non-zero exit code if script_jp_master.json or any .mp3 is missing, or orphan .mp3 exists',
        `  --budget-mb <N>       Total audio budget in MB (default: ${DEFAULT_BUDGET_MB})`,
        '  --master <path>       Path to script_jp_master.json',
        '  --voice-dir <path>    Path to assets/voice directory',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }
  return opts;
}

function toPosixRel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join('/');
}

function scanMp3Files(dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  function walk(cur) {
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      const abs = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.mp3')) {
        const stat = fs.statSync(abs);
        const voiceId = ent.name.slice(0, -4);
        results.push({
          voiceId,
          absPath: abs,
          relPath: toPosixRel(abs),
          bytes: stat.size,
        });
      }
    }
  }

  walk(dirPath);
  return results;
}

function expectedAudioPathForEntry(entry) {
  if (entry.audioPath) return String(entry.audioPath).replace(/\\/g, '/');
  if (entry.audioRelPath) {
    const clean = String(entry.audioRelPath).replace(/\\/g, '/').replace(/^\/+/, '');
    return clean.startsWith('assets/voice/') ? clean : `assets/voice/${clean}`;
  }
  const vid = entry.voiceId;
  if (!vid) return null;
  if (entry.tier === 'combat' || vid.startsWith('combat__')) {
    return `assets/voice/combat/${vid}.mp3`;
  }
  if (entry.tier === 'interactive' || vid.startsWith('inter__')) {
    const kind = entry.kind || vid.split('__')[1] || 'misc';
    return `assets/voice/interactive/${kind}/${vid}.mp3`;
  }
  const sceneId = entry.sceneId || vid.split('__')[0] || 'unknown';
  return `assets/voice/story/${sceneId}/${vid}.mp3`;
}

function expectedVoiceIdForEntry(entry) {
  if (entry.tier === 'combat' && entry.cueKey) {
    return `combat__${entry.cueKey}`;
  }
  if (entry.tier === 'interactive' && entry.kind && entry.charId && entry.zh_text) {
    return `inter__${entry.kind}__${entry.charId}__${fnv1aHex(`${entry.charId}|${normalizeVoiceText(entry.zh_text)}`)}`;
  }
  if ((entry.tier === 'main' || entry.tier === 'mono') && entry.sceneId && entry.charId && entry.zh_text) {
    return `${entry.sceneId}__${entry.charId}__${fnv1aHex(`${entry.charId}|${normalizeVoiceText(entry.zh_text)}`)}`;
  }
  return entry.voiceId || null;
}

function loadMasterCatalog(opts) {
  if (fs.existsSync(opts.masterPath)) {
    const raw = JSON.parse(fs.readFileSync(opts.masterPath, 'utf8'));
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.entries)
        ? raw.entries
        : Array.isArray(raw.items)
          ? raw.items
          : Array.isArray(raw.lines)
            ? raw.lines
            : null;
    if (!items) {
      throw new Error(`Unsupported schema in ${toPosixRel(opts.masterPath)}: expected array or { entries | items | lines }`);
    }
    return { sourceMode: 'script_jp_master', sourcePath: toPosixRel(opts.masterPath), items };
  }

  // 回退读取 raw_extracted/batch_*.json（用于尚未合成音频前的 --dry-run 预检）
  const batchFiles = fs.existsSync(DEFAULT_RAW_DIR)
    ? fs.readdirSync(DEFAULT_RAW_DIR).filter((f) => /^batch_.*\.json$/i.test(f)).sort()
    : [];
  const items = [];
  for (const bf of batchFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(DEFAULT_RAW_DIR, bf), 'utf8'));
    if (Array.isArray(data.items)) items.push(...data.items);
  }
  return {
    sourceMode: batchFiles.length ? 'raw_extracted_fallback' : 'none',
    sourcePath: batchFiles.length ? toPosixRel(DEFAULT_RAW_DIR) : null,
    items,
  };
}

function formatMB(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(3));
}

function buildManifest(opts) {
  const casting = JSON.parse(fs.readFileSync(opts.castingPath, 'utf8'));
  const master = loadMasterCatalog(opts);
  const diskMp3s = scanMp3Files(opts.voiceDir);

  const errors = [];
  const warnings = [];

  if (opts.strict && master.sourceMode !== 'script_jp_master') {
    errors.push(`Missing required master script: ${toPosixRel(opts.masterPath)}`);
  } else if (master.sourceMode === 'raw_extracted_fallback') {
    warnings.push(`script_jp_master.json not found yet; using ${master.sourcePath} (${master.items.length} entries) for preflight validation.`);
  }

  // 1. 磁盘 MP3 索引与基础完整性/体量检查
  const diskByVoiceId = new Map();
  const diskByRelPath = new Map();
  let totalDiskBytes = 0;

  for (const f of diskMp3s) {
    totalDiskBytes += f.bytes;
    if (f.bytes <= 0) {
      errors.push(`Corrupt 0-byte mp3 file: ${f.relPath}`);
      continue;
    }
    if (f.bytes >= SINGLE_FILE_HARD_LIMIT_BYTES) {
      errors.push(`Single file exceeds 50 MB GitHub Pages limit (${formatMB(f.bytes)} MB): ${f.relPath}`);
    }
    if (diskByVoiceId.has(f.voiceId)) {
      errors.push(`Duplicate mp3 voiceId on disk: ${f.voiceId} (${diskByVoiceId.get(f.voiceId).relPath} vs ${f.relPath})`);
    }
    diskByVoiceId.set(f.voiceId, f);
    diskByRelPath.set(f.relPath, f);
  }

  const budgetBytes = opts.budgetMb * 1024 * 1024;
  if (totalDiskBytes > budgetBytes) {
    errors.push(`Total voice audio size ${formatMB(totalDiskBytes)} MB exceeds budget ${opts.budgetMb} MB`);
  } else if (totalDiskBytes > budgetBytes * 0.85) {
    warnings.push(`Total voice audio size ${formatMB(totalDiskBytes)} MB is above 85% of ${opts.budgetMb} MB budget`);
  }

  // 2. 主台本 SSOT 校验与磁盘 MP3 交叉比对
  const masterByVoiceId = new Map();
  const missingMp3s = [];
  const pathMismatches = [];
  const ssotIdMismatches = [];
  const manifestEntries = {};
  const manifestFiles = {};
  const byTier = {};
  const byProfile = {};
  const byChar = {};
  let manifestTotalBytes = 0;

  for (const entry of master.items) {
    if (!entry || !entry.voiceId) {
      errors.push('Encountered master entry missing voiceId');
      continue;
    }
    if (masterByVoiceId.has(entry.voiceId)) {
      errors.push(`Duplicate voiceId in master catalog: ${entry.voiceId}`);
      continue;
    }
    masterByVoiceId.set(entry.voiceId, entry);

    const expectedVid = expectedVoiceIdForEntry(entry);
    if (expectedVid && expectedVid !== entry.voiceId) {
      ssotIdMismatches.push({
        voiceId: entry.voiceId,
        expectedVoiceId: expectedVid,
        charId: entry.charId,
        zh_text: entry.zh_text,
      });
    }

    const expRel = expectedAudioPathForEntry(entry);
    const diskMatch = (expRel && diskByRelPath.get(expRel)) || diskByVoiceId.get(entry.voiceId) || null;

    if (!diskMatch) {
      missingMp3s.push({
        voiceId: entry.voiceId,
        expectedPath: expRel,
        tier: entry.tier || null,
        charId: entry.charId || null,
      });
      continue;
    }

    if (expRel && diskMatch.relPath !== expRel) {
      pathMismatches.push({
        voiceId: entry.voiceId,
        expectedPath: expRel,
        actualPath: diskMatch.relPath,
      });
    }

    // 最终坏链硬防线：再次核验磁盘真实存在且非空
    if (!fs.existsSync(diskMatch.absPath) || diskMatch.bytes <= 0) {
      errors.push(`Broken link detected before emit: ${diskMatch.relPath}`);
      continue;
    }

    manifestFiles[entry.voiceId] = diskMatch.relPath;
    manifestEntries[entry.voiceId] = {
      path: diskMatch.relPath,
      charId: entry.charId || null,
      profileId: entry.profileId || (entry.charId && casting.charIdToProfileId[entry.charId]) || null,
      tier: entry.tier || null,
      ...(entry.sceneId ? { sceneId: entry.sceneId } : {}),
      ...(entry.kind ? { kind: entry.kind } : {}),
      ...(entry.cueKey ? { cueKey: entry.cueKey } : {}),
      bytes: diskMatch.bytes,
    };

    manifestTotalBytes += diskMatch.bytes;
    const tKey = entry.tier || 'unknown';
    const pKey = manifestEntries[entry.voiceId].profileId || 'unknown';
    const cKey = entry.charId || 'unknown';
    byTier[tKey] = (byTier[tKey] || 0) + 1;
    byProfile[pKey] = (byProfile[pKey] || 0) + 1;
    byChar[cKey] = (byChar[cKey] || 0) + 1;
  }

  // 3. 识别磁盘孤立 MP3（存在于 assets/voice/ 但不在主台本中）
  const orphanMp3s = [];
  for (const f of diskMp3s) {
    if (f.bytes <= 0) continue;
    if (!masterByVoiceId.has(f.voiceId)) {
      orphanMp3s.push({ voiceId: f.voiceId, path: f.relPath, bytes: f.bytes });
    }
  }

  if (ssotIdMismatches.length > 0) {
    errors.push(`SSOT voiceId hash mismatches: ${ssotIdMismatches.length} (first: ${ssotIdMismatches[0].voiceId} vs ${ssotIdMismatches[0].expectedVoiceId})`);
  }
  if (pathMismatches.length > 0) {
    warnings.push(`Audio path mismatches vs SSOT layout: ${pathMismatches.length}`);
  }
  if (orphanMp3s.length > 0) {
    const msg = `Orphan .mp3 files on disk not present in master catalog: ${orphanMp3s.length}`;
    if (opts.strict) errors.push(msg);
    else warnings.push(msg);
  }
  if (missingMp3s.length > 0) {
    const msg = `Master entries without synthesized .mp3 on disk: ${missingMp3s.length}/${master.items.length}`;
    if (opts.strict) errors.push(msg);
    else warnings.push(msg);
  }

  // 按 key 排序保证输出确定性
  const sortedFiles = {};
  const sortedEntries = {};
  for (const k of Object.keys(manifestFiles).sort()) {
    sortedFiles[k] = manifestFiles[k];
    sortedEntries[k] = manifestEntries[k];
  }

  // 最终 0 坏链断言
  let brokenLinks = 0;
  for (const [vid, relPath] of Object.entries(sortedFiles)) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs) || fs.statSync(abs).size <= 0) {
      brokenLinks += 1;
      errors.push(`Post-build broken link: ${vid} -> ${relPath}`);
    }
  }

  const generatedAt = new Date().toISOString();
  const count = Object.keys(sortedFiles).length;

  const jsonManifest = {
    schemaVersion: '1.0.0',
    generatedAt,
    sourceMode: master.sourceMode,
    stats: {
      masterEntryCount: master.items.length,
      diskMp3Count: diskMp3s.length,
      manifestCount: count,
      brokenLinks,
      missingMp3Count: missingMp3s.length,
      orphanMp3Count: orphanMp3s.length,
      totalBytes: manifestTotalBytes,
      totalMB: formatMB(manifestTotalBytes),
      diskTotalBytes: totalDiskBytes,
      diskTotalMB: formatMB(totalDiskBytes),
      budgetMB: opts.budgetMb,
      budgetUsedPct: Number(((totalDiskBytes / budgetBytes) * 100).toFixed(2)),
      byTier,
      byProfile,
      byChar,
    },
    files: sortedFiles,
    entries: sortedEntries,
  };

  const sortedEntriesForBrowser = {};
  for (const [vid, relPath] of Object.entries(sortedFiles)) {
    sortedEntriesForBrowser[vid] = relPath.startsWith('assets/voice/')
      ? relPath.slice('assets/voice/'.length)
      : relPath;
  }

  const browserPayload = {
    version: 1,
    format: 'mp3',
    basePath: 'assets/voice/',
    generatedAt,
    totalFiles: count,
    totalBytes: manifestTotalBytes,
    entries: sortedEntriesForBrowser,
    byChar,
    speakerAliases: casting.speakerAliases || {},
  };

  const jsManifestCode = [
    '/* Auto-generated by tools/voice/build_manifest.mjs — DO NOT EDIT MANUALLY */',
    '(function (root) {',
    "  'use strict';",
    `  root.VOICE_MANIFEST = ${JSON.stringify(browserPayload, null, 2)};`,
    "})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));",
    '',
  ].join('\n');

  const report = {
    dryRun: opts.dryRun,
    strict: opts.strict,
    sourceMode: master.sourceMode,
    sourcePath: master.sourcePath,
    stats: jsonManifest.stats,
    ssotIdMismatchCount: ssotIdMismatches.length,
    pathMismatchCount: pathMismatches.length,
    warnings,
    errors,
    outputs: {
      jsManifest: toPosixRel(OUT_JS_MANIFEST),
      jsonManifest: toPosixRel(OUT_JSON_MANIFEST),
    },
  };

  if (errors.length === 0 && !opts.dryRun) {
    fs.mkdirSync(path.dirname(OUT_JSON_MANIFEST), { recursive: true });
    fs.mkdirSync(path.dirname(OUT_JS_MANIFEST), { recursive: true });
    fs.writeFileSync(OUT_JSON_MANIFEST, `${JSON.stringify(jsonManifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT_JS_MANIFEST, jsManifestCode, 'utf8');
  }

  return { report, errors };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { report, errors } = buildManifest(opts);

  console.log(`[build_manifest] ${opts.dryRun ? 'DRY-RUN' : 'BUILD'} summary:`);
  console.log(JSON.stringify(report, null, 2));

  if (errors.length > 0) {
    console.error(`[build_manifest] FAILED with ${errors.length} error(s).`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
