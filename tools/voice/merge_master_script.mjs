#!/usr/bin/env node
/**
 * tools/voice/merge_master_script.mjs
 *
 * 按固定顺序合表 6 份日语译稿批次文件：
 *   1. batch_vol1a.json
 *   2. batch_vol1b.json
 *   3. batch_vol2.json
 *   4. batch_vol3_4.json
 *   5. batch_combat_mono.json
 *   6. batch_interactive.json
 *
 * 执行全量 SSOT 与 Fish Audio Drama 3 合规核验：
 *   - 全局 1,276 条零重复 voiceId、零空 jp_text / drama3_input；
 *   - 零圆括号标签、零多角色 <|speaker:N|> 标签、零句首 [sighs]/[pause]/[inhale] 等停顿/呼吸标签；
 *   - 行内 Drama 3 韵律 XML 标签 100% 平衡闭合；
 *   - 全部 25 套 profileId 在 casting_fish_audio.json 中 100% 有定义且每套至少 2 条 audition: true 代表句
 *     （若某 profile 不足 2 条，按代表句打分规则自动补足至 2 条并打印清单）；
 *   - 校验 voiceId FNV-1a 32-bit 哈希与 audioPath / audioRelPath 符合 SSOT 契约；
 *   - 输出带完整元数据的总台本 tools/voice/script_jp_master.json。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_CASTING_PATH = path.join(__dirname, 'casting_fish_audio.json');
const DEFAULT_BATCHES_DIR = path.join(__dirname, 'translated_batches');
const DEFAULT_OUT_PATH = path.join(__dirname, 'script_jp_master.json');

const ORDERED_BATCH_FILES = [
  'batch_vol1a.json',
  'batch_vol1b.json',
  'batch_vol2.json',
  'batch_vol3_4.json',
  'batch_combat_mono.json',
  'batch_interactive.json',
];

const EXPECTED_TOTAL_LINES = 1276;
const EXPECTED_PROFILE_COUNT = 25;
const MIN_AUDITIONS_PER_PROFILE = 2;
const MODEL_TARGET = 'fishaudio/drama-3';
const MASTER_VERSION = '1.0.0';

// 与 tools/voice/batch_synthesize.py 保持逐条一致的标签与口语计数规则
const SPEAKER_TAG_RE = /<\|speaker:\d+\|>/i;
const ASCII_PAREN_TAG_RE = /\([^)]*\)/;
const FULLWIDTH_PAREN_TAG_RE = /（\s*[a-zA-Z][a-zA-Z0-9_\s,-]*\s*）/;
const INLINE_BRACKET_TAG_RE = /\[[^\]]{1,64}\]/g;
const XML_TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9_:-]*)>/g;
const ALLOWED_XML_TAGS = new Set([
  'soft',
  'emphasis',
  'fast',
  'slow',
  'forceful',
  'stress',
  'whisper',
]);

// 与 batch_synthesize.py 中 LEADING_PAUSE_TAG_RE / LEADING_BREATH_TAG_RE 对齐
const LEADING_PAUSE_TAG_RE =
  /^[\s「『"'（(]*\[(pause|short\s+pause|long\s+pause|silence|break)\]/i;
const LEADING_BREATH_TAG_RE =
  /^[\s「『"'（(]*\[(sighs?|inhale|exhale|breath|breathes?|gasps?|hesitate|whisper)\]/i;
const LEADING_BRACKET_GROUP_RE = /^[\s「『"'（(]*\[([^\]]+)\]/;
const FORBIDDEN_LEADING_TOKENS = new Set([
  'pause',
  'short pause',
  'long pause',
  'silence',
  'break',
  'sigh',
  'sighs',
  'inhale',
  'exhale',
  'breath',
  'breathe',
  'breathes',
  'gasp',
  'gasps',
  'hesitate',
  'whisper',
]);

const SPOKEN_CHAR_RE =
  /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBFA-Za-z0-9ー]/g;

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

function expectedAudioPathsForEntry(entry) {
  const vid = entry.voiceId;
  if (!vid) return { audioPath: null, audioRelPath: null };
  let audioRelPath = null;
  if (entry.tier === 'combat' || vid.startsWith('combat__')) {
    audioRelPath = `combat/${vid}.mp3`;
  } else if (entry.tier === 'interactive' || vid.startsWith('inter__')) {
    const kind = entry.kind || vid.split('__')[1] || 'misc';
    audioRelPath = `interactive/${kind}/${vid}.mp3`;
  } else {
    const sceneId = entry.sceneId || vid.split('__')[0] || 'unknown';
    audioRelPath = `story/${sceneId}/${vid}.mp3`;
  }
  return {
    audioRelPath,
    audioPath: `assets/voice/${audioRelPath}`,
  };
}

function countSpokenChars(jpText) {
  const plain = String(jpText || '')
    .replace(SPEAKER_TAG_RE, '')
    .replace(INLINE_BRACKET_TAG_RE, '')
    .replace(XML_TAG_RE, '');
  const matches = plain.match(SPOKEN_CHAR_RE);
  return matches ? matches.length : 0;
}

function hasForbiddenLeadingTag(drama3Input) {
  const text = String(drama3Input || '');
  if (LEADING_PAUSE_TAG_RE.test(text) || LEADING_BREATH_TAG_RE.test(text)) {
    return true;
  }
  const m = text.match(LEADING_BRACKET_GROUP_RE);
  if (m) {
    const tokens = m[1]
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (tokens.some((tok) => FORBIDDEN_LEADING_TOKENS.has(tok))) {
      return true;
    }
  }
  return false;
}

function checkXmlBalance(drama3Input) {
  const text = String(drama3Input || '');
  const stack = [];
  const unknownTags = [];
  let match;
  XML_TAG_RE.lastIndex = 0;
  while ((match = XML_TAG_RE.exec(text)) !== null) {
    const isClose = match[1] === '/';
    const tagName = match[2];
    if (!ALLOWED_XML_TAGS.has(tagName)) {
      unknownTags.push(tagName);
    }
    if (!isClose) {
      stack.push(tagName);
    } else {
      if (stack.length > 0 && stack[stack.length - 1] === tagName) {
        stack.pop();
      } else {
        return { balanced: false, unknownTags };
      }
    }
  }
  return { balanced: stack.length === 0, unknownTags };
}

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    castingPath: DEFAULT_CASTING_PATH,
    batchesDir: DEFAULT_BATCHES_DIR,
    outPath: DEFAULT_OUT_PATH,
    allowCountMismatch: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--allow-count-mismatch') {
      opts.allowCountMismatch = true;
    } else if (arg === '--casting' && argv[i + 1]) {
      opts.castingPath = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--batches-dir' && argv[i + 1]) {
      opts.batchesDir = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--out' && argv[i + 1]) {
      opts.outPath = path.resolve(ROOT, argv[++i]);
    } else if (arg === '--help' || arg === '-h') {
      console.log([
        'Usage: node tools/voice/merge_master_script.mjs [options]',
        '  --dry-run                Validate all 6 batches and print report without writing script_jp_master.json',
        '  --casting <path>         Path to casting_fish_audio.json',
        '  --batches-dir <path>     Path to translated_batches directory',
        '  --out <path>             Output path for script_jp_master.json',
        '  --allow-count-mismatch   Do not fail if merged totalLines differs from 1276',
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

function representativeScore(entry) {
  const tierOrder = { main: 3, combat: 2, mono: 1, interactive: 0 };
  const tierPrio = tierOrder[entry.tier] ?? 0;
  const chars = countSpokenChars(entry.jp_text);
  // 偏好 12-38 字（中枢 24 字）表现力完整、适合 30 秒定妆试音的代表句
  const lenPenalty = Math.abs(chars - 24);
  return { tierPrio, lenPenalty };
}

function mergeMasterScript(opts) {
  if (!fs.existsSync(opts.castingPath)) {
    throw new Error(`Missing casting SSOT file: ${toPosixRel(opts.castingPath)}`);
  }
  const casting = JSON.parse(fs.readFileSync(opts.castingPath, 'utf8'));
  const castingProfiles = Array.isArray(casting.profiles) ? casting.profiles : [];
  const validProfileOrder = castingProfiles.map((p) => p.profileId);
  const validProfileSet = new Set(validProfileOrder);
  const charIdToProfileId = casting.charIdToProfileId || {};

  const errors = [];
  const warnings = [];

  if (validProfileOrder.length !== EXPECTED_PROFILE_COUNT) {
    errors.push(
      `Expected ${EXPECTED_PROFILE_COUNT} profiles in casting_fish_audio.json, found ${validProfileOrder.length}`
    );
  }

  const lines = [];
  const countsByBatch = {};
  const seenVoiceIds = new Map();

  const metrics = {
    duplicateVoiceIds: 0,
    emptyJpText: 0,
    emptyDrama3Input: 0,
    parenthesisTags: 0,
    jpInlineTags: 0,
    leadingForbiddenTags: 0,
    speakerTags: 0,
    unbalancedXmlTags: 0,
    unknownXmlTags: 0,
    ssotHashMismatches: 0,
    audioPathMismatches: 0,
    unknownProfiles: 0,
    charProfileMismatches: 0,
    uncoveredProfiles: 0,
    underAuditionedProfiles: 0,
  };

  for (const filename of ORDERED_BATCH_FILES) {
    const absPath = path.join(opts.batchesDir, filename);
    if (!fs.existsSync(absPath)) {
      errors.push(`Missing translated batch file: ${toPosixRel(absPath)}`);
      continue;
    }

    const batchData = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    const batchKey = batchData.batchId || filename.replace(/\.json$/i, '');
    const items = Array.isArray(batchData.items) ? batchData.items : null;
    if (!items) {
      errors.push(`Batch file ${filename} does not contain an "items" array`);
      continue;
    }
    if (typeof batchData.count === 'number' && batchData.count !== items.length) {
      warnings.push(
        `Batch ${filename} header count=${batchData.count} differs from actual items.length=${items.length}`
      );
    }

    countsByBatch[batchKey] = items.length;

    for (let idx = 0; idx < items.length; idx++) {
      const rawItem = items[idx];
      if (!rawItem || typeof rawItem !== 'object') {
        errors.push(`${filename}[${idx}]: invalid entry object`);
        continue;
      }

      const item = {
        ...rawItem,
        jp_text: typeof rawItem.jp_text === 'string' ? rawItem.jp_text.trim() : '',
        drama3_input: typeof rawItem.drama3_input === 'string' ? rawItem.drama3_input.trim() : '',
        audition: Boolean(rawItem.audition),
      };

      const vid = String(item.voiceId || '').trim();
      if (!vid) {
        errors.push(`${filename}[${idx}]: missing voiceId`);
        continue;
      }
      if (seenVoiceIds.has(vid)) {
        metrics.duplicateVoiceIds += 1;
        errors.push(`Duplicate voiceId "${vid}" in ${filename} (first seen in ${seenVoiceIds.get(vid)})`);
        continue;
      }
      seenVoiceIds.set(vid, filename);

      if (!item.jp_text) {
        metrics.emptyJpText += 1;
        errors.push(`${filename} (${vid}): empty jp_text`);
      }
      if (!item.drama3_input) {
        metrics.emptyDrama3Input += 1;
        errors.push(`${filename} (${vid}): empty drama3_input`);
      }

      // 圆括号标签核验（严禁旧版 (calm)/(soft) 等圆括号风格标签）
      if (
        ASCII_PAREN_TAG_RE.test(item.drama3_input) ||
        FULLWIDTH_PAREN_TAG_RE.test(item.drama3_input) ||
        ASCII_PAREN_TAG_RE.test(item.jp_text) ||
        FULLWIDTH_PAREN_TAG_RE.test(item.jp_text)
      ) {
        metrics.parenthesisTags += 1;
        errors.push(`${filename} (${vid}): forbidden parenthesis tag detected`);
      }

      // jp_text 必须为纯净日文（不含 [tag] 或 <xml> 标签）
      if (INLINE_BRACKET_TAG_RE.test(item.jp_text) || XML_TAG_RE.test(item.jp_text)) {
        metrics.jpInlineTags += 1;
        errors.push(`${filename} (${vid}): jp_text contains inline bracket/XML tag`);
      }
      INLINE_BRACKET_TAG_RE.lastIndex = 0;
      XML_TAG_RE.lastIndex = 0;

      // 禁止多角色 <|speaker:N|> 标签
      if (SPEAKER_TAG_RE.test(item.drama3_input) || SPEAKER_TAG_RE.test(item.jp_text)) {
        metrics.speakerTags += 1;
        errors.push(`${filename} (${vid}): forbidden <|speaker:N|> tag detected`);
      }

      // 禁止句首 [sighs] / [pause] / [inhale] 等停顿/呼吸标签
      if (hasForbiddenLeadingTag(item.drama3_input)) {
        metrics.leadingForbiddenTags += 1;
        errors.push(
          `${filename} (${vid}): forbidden leading breath/pause tag in drama3_input: ${item.drama3_input.slice(0, 60)}`
        );
      }

      // XML 韵律标签平衡性检查
      const xmlCheck = checkXmlBalance(item.drama3_input);
      if (!xmlCheck.balanced) {
        metrics.unbalancedXmlTags += 1;
        errors.push(`${filename} (${vid}): unbalanced XML prosody tag in drama3_input`);
      }
      if (xmlCheck.unknownTags.length > 0) {
        metrics.unknownXmlTags += 1;
        errors.push(
          `${filename} (${vid}): unknown XML tag(s) [${xmlCheck.unknownTags.join(', ')}] in drama3_input`
        );
      }

      // SSOT voiceId 哈希校验
      const expectedVid = expectedVoiceIdForEntry(item);
      if (expectedVid && expectedVid !== vid) {
        metrics.ssotHashMismatches += 1;
        errors.push(`${filename} (${vid}): SSOT voiceId mismatch (expected ${expectedVid})`);
      }

      // SSOT audioPath / audioRelPath 校验
      const expPaths = expectedAudioPathsForEntry(item);
      if (
        (expPaths.audioPath && item.audioPath !== expPaths.audioPath) ||
        (expPaths.audioRelPath && item.audioRelPath !== expPaths.audioRelPath)
      ) {
        metrics.audioPathMismatches += 1;
        errors.push(
          `${filename} (${vid}): audio path mismatch (got ${item.audioPath} / ${item.audioRelPath}, expected ${expPaths.audioPath} / ${expPaths.audioRelPath})`
        );
      }

      // 角色声线 profileId 校验
      if (!validProfileSet.has(item.profileId)) {
        metrics.unknownProfiles += 1;
        errors.push(`${filename} (${vid}): undefined profileId "${item.profileId}"`);
      }
      if (item.charId && charIdToProfileId[item.charId] && charIdToProfileId[item.charId] !== item.profileId) {
        metrics.charProfileMismatches += 1;
        errors.push(
          `${filename} (${vid}): charId "${item.charId}" expects profileId "${charIdToProfileId[item.charId]}", got "${item.profileId}"`
        );
      }

      lines.push(item);
    }
  }

  if (!opts.allowCountMismatch && lines.length !== EXPECTED_TOTAL_LINES) {
    errors.push(`Expected ${EXPECTED_TOTAL_LINES} total merged lines, got ${lines.length}`);
  }

  // 按 profile 统计并校验全 25 套声线覆盖及 >= 2 条 audition 代表句（不足时自动补足并记录清单）
  const linesByProfile = new Map(validProfileOrder.map((pid) => [pid, []]));
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (linesByProfile.has(ln.profileId)) {
      linesByProfile.get(ln.profileId).push({ line: ln, index: i });
    }
  }

  const autoPromotedAuditions = [];
  for (const pid of validProfileOrder) {
    const entries = linesByProfile.get(pid) || [];
    if (entries.length === 0) {
      metrics.uncoveredProfiles += 1;
      errors.push(`Profile "${pid}" has 0 lines in merged script`);
      continue;
    }
    const existingAuditions = entries.filter((e) => e.line.audition);
    if (existingAuditions.length < MIN_AUDITIONS_PER_PROFILE) {
      const need = MIN_AUDITIONS_PER_PROFILE - existingAuditions.length;
      const candidates = entries
        .filter((e) => !e.line.audition)
        .sort((a, b) => {
          const sa = representativeScore(a.line);
          const sb = representativeScore(b.line);
          if (sa.tierPrio !== sb.tierPrio) return sb.tierPrio - sa.tierPrio;
          if (sa.lenPenalty !== sb.lenPenalty) return sa.lenPenalty - sb.lenPenalty;
          return a.index - b.index;
        });

      const promoted = candidates.slice(0, need);
      for (const pick of promoted) {
        pick.line.audition = true;
        autoPromotedAuditions.push({
          profileId: pid,
          voiceId: pick.line.voiceId,
          tier: pick.line.tier,
          jp_text: pick.line.jp_text,
        });
      }

      const finalAuditionCount = existingAuditions.length + promoted.length;
      if (finalAuditionCount < MIN_AUDITIONS_PER_PROFILE) {
        metrics.underAuditionedProfiles += 1;
        errors.push(
          `Profile "${pid}" only has ${finalAuditionCount} audition line(s) after auto top-up (minimum ${MIN_AUDITIONS_PER_PROFILE})`
        );
      }
    }
  }

  // 生成有序元数据统计表
  const countsByTier = { main: 0, mono: 0, combat: 0, interactive: 0 };
  for (const ln of lines) {
    const tier = ln.tier || 'unknown';
    countsByTier[tier] = (countsByTier[tier] || 0) + 1;
  }

  const countsByProfile = {};
  const auditionCountsByProfile = {};
  let auditionCount = 0;
  for (const pid of validProfileOrder) {
    const entries = linesByProfile.get(pid) || [];
    const audCnt = entries.filter((e) => e.line.audition).length;
    countsByProfile[pid] = entries.length;
    auditionCountsByProfile[pid] = audCnt;
    auditionCount += audCnt;
  }

  const masterPayload = {
    version: MASTER_VERSION,
    schemaVersion: MASTER_VERSION,
    project: casting.project || '转生千金～到了异世界就要悠闲地生活',
    generatedAt: new Date().toISOString(),
    modelTarget: MODEL_TARGET,
    totalLines: lines.length,
    profileCount: validProfileOrder.length,
    countsByTier,
    countsByBatch,
    countsByProfile,
    auditionCount,
    auditionCountsByProfile,
    autoPromotedAuditions,
    validation: {
      passed: errors.length === 0,
      ...metrics,
    },
    lines,
  };

  if (errors.length === 0 && !opts.dryRun) {
    fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
    fs.writeFileSync(opts.outPath, `${JSON.stringify(masterPayload, null, 2)}\n`, 'utf8');
  }

  return { masterPayload, errors, warnings };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { masterPayload, errors, warnings } = mergeMasterScript(opts);

  console.log(`[merge_master_script] ${opts.dryRun ? 'DRY-RUN' : 'MERGED'} summary:`);
  console.log(`  modelTarget   : ${masterPayload.modelTarget}`);
  console.log(`  totalLines    : ${masterPayload.totalLines}`);
  console.log(`  profileCount  : ${masterPayload.profileCount}`);
  console.log(`  auditionCount : ${masterPayload.auditionCount}`);
  console.log(`  countsByTier  : ${JSON.stringify(masterPayload.countsByTier)}`);
  console.log(`  countsByBatch : ${JSON.stringify(masterPayload.countsByBatch)}`);
  console.log(`  validation    : ${JSON.stringify(masterPayload.validation)}`);

  if (masterPayload.autoPromotedAuditions.length > 0) {
    console.log(
      `[merge_master_script] Auto-promoted ${masterPayload.autoPromotedAuditions.length} audition line(s):`
    );
    for (const item of masterPayload.autoPromotedAuditions) {
      console.log(`  + [${item.profileId}] ${item.voiceId} (${item.tier}): ${item.jp_text}`);
    }
  } else {
    console.log('[merge_master_script] Auto-promoted auditions: 0 (all 25 profiles already have >= 2 audition lines).');
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[WARN] ${w}`);
    }
  }

  if (errors.length > 0) {
    console.error(`[merge_master_script] FAILED with ${errors.length} error(s):`);
    for (const err of errors.slice(0, 30)) {
      console.error(`  - ${err}`);
    }
    if (errors.length > 30) {
      console.error(`  ... and ${errors.length - 30} more error(s)`);
    }
    process.exit(1);
  }

  if (!opts.dryRun) {
    const stat = fs.statSync(opts.outPath);
    console.log(
      `[merge_master_script] Written ${toPosixRel(opts.outPath)} (${(stat.size / 1024).toFixed(1)} KB)`
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
