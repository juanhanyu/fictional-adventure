'use strict';
/**
 * V2 全面焕新回归守卫 (tests/v2_overhaul_guard.js)
 * 覆盖 Wave-1 / Wave-2 全部核心交付：
 * 1. 存档 Schema 统一（旧版 game.js 槽位归一化 + VNUx 槽位双向兼容，零 undefined 渲染）
 * 2. 音频与设置统一（BGM/SFX 双向同步、亮度不扰动 BGM、静音锁定、bgmStop→bgmPlay 音量恢复、CrystalSFX 25+ 音色有/无 AudioContext 双环境零报错）
 * 3. 养成总控台与多结局（#sylvia-hub 挂载、rollSeasonChars 合法房间且无食堂海伦娜、五大弹窗开合与 Esc 关闭、openWaxLetter 复原标题爱丽丝信笺、evaluateEnding 双轨结局写入 codex.endings、S.gold 永不跌破 0）
 * 4. 明亮冰晶绘本色板与布局静态守卫（零暗黑/旧金残留、#app 无 z-index:3、body.ui-hidden 隐藏 #btn-arena、#am-close 脱离 .arena-mode-bar、新 JS 模块零「不是」）
 */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { win, errors } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const doc = win.document;
const $ = (id) => doc.getElementById(id);

if (win.HTMLMediaElement && win.HTMLMediaElement.prototype) {
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.HTMLMediaElement.prototype.pause = () => {};
}

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (cond) pass++;
  else fail++;
}

function isElVisible(el) {
  if (!el || !doc.body.contains(el)) return false;
  if (el.hidden) return false;
  if (el.classList && el.classList.contains('hidden')) return false;
  if (el.style && el.style.display === 'none') return false;
  return true;
}

function vis(id) {
  return isElVisible($(id));
}

function pressEscape() {
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

function stripCssComments(css) {
  return String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * 解析 CSS 规则块（跳过 @keyframes，支持按 topLevelOnly 过滤 @media 等嵌套块）
 */
function parseCssRules(cssText, { topLevelOnly = false } = {}) {
  const src = stripCssComments(cssText);
  const rules = [];
  const len = src.length;

  function walk(startIdx, endIdx, insideAtBlock) {
    let i = startIdx;
    while (i < endIdx) {
      while (i < endIdx && /\s/.test(src[i])) i++;
      if (i >= endIdx) break;
      if (src[i] === '}') { i++; continue; }

      const braceIdx = src.indexOf('{', i);
      const semiIdx = src.indexOf(';', i);
      if (braceIdx === -1 || braceIdx >= endIdx) break;
      if (semiIdx !== -1 && semiIdx < braceIdx) {
        i = semiIdx + 1;
        continue;
      }

      const header = src.slice(i, braceIdx).trim();
      let depth = 1;
      let j = braceIdx + 1;
      while (j < endIdx && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      const innerStart = braceIdx + 1;
      const innerEnd = j - 1;

      if (header.startsWith('@')) {
        if (!/^@(?:-webkit-)?keyframes\b/i.test(header) && !topLevelOnly) {
          walk(innerStart, innerEnd, true);
        }
      } else if (!topLevelOnly || !insideAtBlock) {
        rules.push({ selector: header, body: src.slice(innerStart, innerEnd) });
      }
      i = j;
    }
  }

  walk(0, len, false);
  return rules;
}

function snapshotVisibleModals() {
  const set = new Set();
  doc.querySelectorAll('section, div, aside, dialog').forEach((el) => {
    if (isElVisible(el)) set.add(el);
  });
  return set;
}

function detectOpenedModal(beforeSet, retVal) {
  const skipIds = new Set(['sylvia-hub', 'toast', 'bg', 'bg-veil', 'fx', 'app', 'game-screen', 'title-screen', 'stage']);
  if (retVal && retVal.nodeType === 1 && !skipIds.has(retVal.id) && isElVisible(retVal)) {
    return retVal;
  }
  const candidates = [];
  const sel = [
    '.overlay',
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[id*="modal"]',
    '[id*="overlay"]',
    '[id*="schedule"]',
    '[id*="planner"]',
    '[id*="report"]',
    '[id*="shop"]',
    '[id*="mail"]',
    '[id*="ending"]',
    '[class*="modal"]',
    '[class*="overlay"]',
    '[class*="ending"]',
  ].join(', ');
  doc.querySelectorAll(sel).forEach((el) => {
    if (skipIds.has(el.id)) return;
    if (!beforeSet.has(el) && isElVisible(el)) {
      candidates.push(el);
    }
  });
  if (candidates.length) {
    // 优先选择最外层弹窗/遮罩节点
    const roots = candidates.filter((el) => !candidates.some((other) => other !== el && other.contains(el)));
    return roots[0] || candidates[0];
  }
  return null;
}

async function run() {
  const VN = win.VNUx;
  const RH = win.RaisingHub;
  const CSFX = win.CrystalSFX;

  console.log('\n===== V2 全面焕新自动化回归守卫 (v2_overhaul_guard) =====');

  // =========================================================================
  // 1. Save Schema Unification（存档 Schema 统一）
  // =========================================================================
  console.log('\n[1/4] 存档 Schema 统一校验');
  const MANUAL_KEY = 'ojousama_manual_slots_v1';
  win.localStorage.removeItem(MANUAL_KEY);
  win.__resetS();
  const legacyState = Object.assign(win.baseState(), {
    name: '希尔维亚',
    phase: 'academy',
    ageY: 12,
    year: 12,
    month: 3,
    day: 1,
    season: '春',
    loc: 'dorm',
    freeRoam: true,
    flags: { named: 1, ch_academy: 1 },
  });
  win.__setS(legacyState);
  win.show('title-screen', 0);
  win.show('game-screen', 1);

  const legacyPayload = {
    '1': {
      ts: 1,
      label: '旧档',
      date: '12年',
      loc: '宿舍',
      data: legacyState,
    },
  };
  win.localStorage.setItem(MANUAL_KEY, JSON.stringify(legacyPayload));

  const normalizedList = VN && typeof VN.getSlotList === 'function' ? VN.getSlotList() : [];
  const slot1 = Array.isArray(normalizedList) ? normalizedList.find((s) => Number(s.slotId) === 1) : null;
  const slot1MetaStr = slot1 && slot1.meta ? JSON.stringify(slot1.meta) : '';
  const vnNormalizedOk = !!(slot1 && slot1.empty === false && slot1.meta && !/\bundefined\b/i.test(slot1MetaStr));

  win.openPanel('saves');
  const panelBody = $('panel-body');
  const panelText1 = ((panelBody && panelBody.textContent) || '').trim();
  const loadBtn1 = doc.querySelector('#panel-body [data-slot-load="1"], #panel-body [data-sl-load="1"]');
  const panelClean1 = vis('panel')
    && panelText1.length > 0
    && !/\bundefined\b/i.test(panelText1)
    && !/\bNaN\b/.test(panelText1)
    && !!(loadBtn1 && !loadBtn1.disabled);

  // 反向：VNUx 写入槽位 2，再由 openPanel('saves') 渲染同样零 undefined
  if (VN && typeof VN.saveToSlot === 'function') {
    VN.saveToSlot(2);
  }
  win.openPanel('saves');
  const panelText2 = ((panelBody && panelBody.textContent) || '').trim();
  const loadBtn2 = doc.querySelector('#panel-body [data-slot-load="2"], #panel-body [data-sl-load="2"]');
  const panelClean2 = panelText2.length > 0
    && !/\bundefined\b/i.test(panelText2)
    && !/\bNaN\b/.test(panelText2)
    && !!(loadBtn2 && !loadBtn2.disabled);

  pressEscape();
  win.localStorage.removeItem(MANUAL_KEY);

  ok('旧版 game.js 槽位写入 ojousama_manual_slots_v1 后，VNUx.getSlotList() 正确归一化且非空',
    vnNormalizedOk,
    `slot1=${JSON.stringify(slot1)}`);
  ok("openPanel('saves') 兼容旧版与 VNUx 双向存档格式，渲染零 undefined/NaN 且读档按钮可用",
    panelClean1 && panelClean2,
    `legacyPanel=${panelClean1}, vnPanel=${panelClean2}`);

  // =========================================================================
  // 2. Audio & Settings Unification（音频与设置统一）
  // =========================================================================
  console.log('\n[2/4] 音频、音量与设置双向统一校验');
  if (VN && typeof VN.resetPrefs === 'function') VN.resetPrefs();
  if (typeof win.setMuted === 'function') win.setMuted(false);

  const hasSetSetting = typeof win.setSetting === 'function';
  if (hasSetSetting) win.setSetting('bgm', 0.25);
  const prefsAfterBgm = VN && typeof VN.getPrefs === 'function' ? VN.getPrefs() : {};
  const engineBgmAfter = typeof win.bgmGetVolume === 'function' ? win.bgmGetVolume() : -1;
  ok("setSetting('bgm', 0.25) 双向同步 VNUx.getPrefs().bgmVol === 0.25 与 bgmGetVolume() === 0.25",
    hasSetSetting
      && Math.abs(Number(prefsAfterBgm.bgmVol) - 0.25) < 0.005
      && Math.abs(Number(engineBgmAfter) - 0.25) < 0.005,
    `pref=${prefsAfterBgm.bgmVol}, engine=${engineBgmAfter}`);

  if (VN && typeof VN.setPref === 'function') VN.setPref('sfxVol', 0.42);
  const engineSfxAfter = typeof win.sfxGetVolume === 'function' ? win.sfxGetVolume() : -1;
  const crystalVolAfter = CSFX && typeof CSFX.getVolume === 'function' ? CSFX.getVolume() : 0.42;
  ok("VNUx.setPref('sfxVol', 0.42) 同步 sfxGetVolume() === 0.42 与 CrystalSFX",
    Math.abs(Number(engineSfxAfter) - 0.42) < 0.005
      && Math.abs(Number(crystalVolAfter) - 0.42) < 0.005,
    `sfxGetVolume=${engineSfxAfter}, crystalVol=${crystalVolAfter}`);

  // 亮度调整不得触碰或中断 BGM
  const bgmKeys = Object.keys(win.BGM_FILES || {});
  const bgmKey1 = bgmKeys[0] || 'peaceful1';
  const bgmKey2 = bgmKeys[1] || bgmKey1;
  if (typeof win.bgmPlay === 'function') win.bgmPlay(bgmKey1, { fade: false });
  const bgmEl = $('bgm-audio');
  const volBeforeBright = typeof win.bgmGetVolume === 'function' ? win.bgmGetVolume() : -1;
  const elVolBeforeBright = bgmEl ? bgmEl.volume : -1;
  const srcBeforeBright = bgmEl ? bgmEl.src : '';
  let brightPlayCalls = 0;
  let brightPauseCalls = 0;
  const origElPlay = bgmEl ? bgmEl.play : null;
  const origElPause = bgmEl ? bgmEl.pause : null;
  if (bgmEl) {
    bgmEl.play = () => { brightPlayCalls++; return Promise.resolve(); };
    bgmEl.pause = () => { brightPauseCalls++; };
  }
  if (hasSetSetting) win.setSetting('bright', 0.85);
  const volAfterBright = typeof win.bgmGetVolume === 'function' ? win.bgmGetVolume() : -1;
  const elVolAfterBright = bgmEl ? bgmEl.volume : -1;
  const srcAfterBright = bgmEl ? bgmEl.src : '';
  const bgFilter = ($('bg') && $('bg').style && $('bg').style.filter) || '';
  if (bgmEl) {
    bgmEl.play = origElPlay;
    bgmEl.pause = origElPause;
  }
  if (hasSetSetting) win.setSetting('bright', 1);
  ok("setSetting('bright', 0.85) 仅应用背景亮度，完全不触碰 BGM 音量与播放状态",
    Math.abs(volAfterBright - volBeforeBright) < 0.005
      && Math.abs(elVolAfterBright - elVolBeforeBright) < 0.005
      && srcAfterBright === srcBeforeBright
      && brightPlayCalls === 0
      && brightPauseCalls === 0
      && bgFilter.includes('brightness(0.85)'),
    `vol=${volBeforeBright}->${volAfterBright}, elVol=${elVolBeforeBright}->${elVolAfterBright}, play=${brightPlayCalls}, pause=${brightPauseCalls}, filter=${bgFilter}`);

  // setMuted(true) 锁定 isMuted() === true
  const hasMuteApi = typeof win.setMuted === 'function' && typeof win.isMuted === 'function';
  let muteLocked = false;
  let muteUnlocked = false;
  let crystalMutedSync = true;
  if (hasMuteApi) {
    win.setMuted(true);
    muteLocked = win.isMuted() === true;
    if (CSFX && typeof CSFX.isMuted === 'function') {
      crystalMutedSync = CSFX.isMuted() === true;
    }
    win.setMuted(false);
    muteUnlocked = win.isMuted() === false;
  }
  ok('setMuted(true) 锁定 isMuted() === true 并联动 CrystalSFX，setMuted(false) 正常解锁',
    hasMuteApi && muteLocked && crystalMutedSync && muteUnlocked,
    `hasApi=${hasMuteApi}, locked=${muteLocked}, crystal=${crystalMutedSync}, unlocked=${muteUnlocked}`);

  // bgmPlay(..., {fade:false}) after bgmStop(true) restores non-zero volume
  if (hasSetSetting) win.setSetting('bgm', 0.45);
  if (hasMuteApi) win.setMuted(false);
  if (typeof win.bgmPlay === 'function') win.bgmPlay(bgmKey1, { fade: false });
  if (typeof win.bgmStop === 'function') win.bgmStop(true);
  if (bgmEl) bgmEl.volume = 0; // 模拟淡出归零后立刻无淡入重启
  if (typeof win.bgmPlay === 'function') win.bgmPlay(bgmKey2, { fade: false });
  const volImmediate = bgmEl ? bgmEl.volume : 0;
  await new Promise((resolve) => setTimeout(resolve, 140));
  const volSustained = bgmEl ? bgmEl.volume : 0;
  if (typeof win.bgmStop === 'function') win.bgmStop(false);
  ok('bgmStop(true) 后调用 bgmPlay(..., {fade:false}) 立即并持续恢复非零音量（无残留淡出定时器压回 0）',
    volImmediate > 0.1 && volSustained > 0.3,
    `immediate=${volImmediate}, after140ms=${volSustained}`);

  // CrystalSFX 25+ 音色：Stubbed AudioContext 与 AudioContext = undefined 双环境零报错
  const cueList = CSFX && typeof CSFX.listCues === 'function' ? CSFX.listCues() : [];
  let stubPlayThrows = 0;
  let stubPlayCount = 0;
  if (CSFX && typeof CSFX.play === 'function') {
    if (typeof CSFX.unlock === 'function') CSFX.unlock();
    if (hasMuteApi) win.setMuted(false);
    if (typeof win.sfxSetVolume === 'function') win.sfxSetVolume(0.65);
    for (const cue of cueList) {
      try {
        CSFX.play(cue, { force: true });
        stubPlayCount++;
      } catch (e) {
        stubPlayThrows++;
      }
    }
  }

  // 独立洁净 JSDOM 验证 AudioContext = undefined 优雅静默降级
  let noAudioThrows = 0;
  let noAudioConsoleErrs = [];
  let noAudioCueCount = 0;
  const sfxFilePath = path.join(ROOT, 'js', 'sfx-suite.js');
  if (fs.existsSync(sfxFilePath)) {
    const noAudioVc = new (require('jsdom').VirtualConsole)();
    noAudioVc.on('error', (...a) => noAudioConsoleErrs.push(a.map(String).join(' ')));
    noAudioVc.on('jsdomError', (...a) => noAudioConsoleErrs.push(a.map(String).join(' ')));
    const noAudioDom = new JSDOM('<!doctype html><html><body><section id="title-screen"></section></body></html>', {
      url: 'http://localhost/',
      runScripts: 'dangerously',
      virtualConsole: noAudioVc,
    });
    const nw = noAudioDom.window;
    nw.AudioContext = undefined;
    nw.webkitAudioContext = undefined;
    try {
      const el = nw.document.createElement('script');
      el.textContent = fs.readFileSync(sfxFilePath, 'utf8');
      nw.document.body.appendChild(el);
      if (nw.CrystalSFX && typeof nw.CrystalSFX.play === 'function') {
        if (typeof nw.CrystalSFX.unlock === 'function') nw.CrystalSFX.unlock();
        const nwCues = typeof nw.CrystalSFX.listCues === 'function' ? nw.CrystalSFX.listCues() : cueList;
        for (const cue of nwCues) {
          nw.CrystalSFX.play(cue, { force: true });
          noAudioCueCount++;
        }
      } else {
        noAudioThrows++;
      }
    } catch (e) {
      noAudioThrows++;
    }
    noAudioDom.window.close();
  } else {
    noAudioThrows++;
  }

  ok('window.CrystalSFX 覆盖 25+ 音色并在 stubbed AudioContext 与 AudioContext=undefined 双环境零异常执行',
    !!CSFX
      && cueList.length >= 25
      && stubPlayCount === cueList.length
      && stubPlayThrows === 0
      && noAudioCueCount >= 25
      && noAudioThrows === 0
      && noAudioConsoleErrs.length === 0,
    `cues=${cueList.length}, stubPlayed=${stubPlayCount}, stubErr=${stubPlayThrows}, noAudioPlayed=${noAudioCueCount}, noAudioErr=${noAudioThrows}/${noAudioConsoleErrs.length}`);

  // =========================================================================
  // 3. Raising Hub & Endings（养成总控台、预掷角色、弹窗、封蜡信笺、双轨结局与金币防负）
  // =========================================================================
  console.log('\n[3/4] 养成总控台 (RaisingHub)、角色预掷与双轨结局校验');

  // 3a) #sylvia-hub 自由探索挂载
  win.__resetS();
  const roamState = Object.assign(win.__getS(), {
    name: '希尔维亚',
    phase: 'academy',
    ageY: 12,
    year: 12,
    month: 9,
    day: 1,
    season: '秋',
    loc: 'dorm',
    freeRoam: true,
    gold: 120,
    st: 10,
    mst: 10,
    flags: {
      named: 1,
      ch_academy: 1,
      ch_beatrice_leaves: 1,
      met_noelle: 1,
      met_aino: 1,
      met_ajun: 1,
      ch_helena: 1,
    },
  });
  win.__setS(roamState);
  Object.values(win.__LOCS || {}).forEach((L) => {
    L.unlock = (L.area === '魔法大学');
  });
  win.show('title-screen', 0);
  win.show('game-screen', 1);
  if (typeof win.enterFreeRoam === 'function') win.enterFreeRoam();
  const hubEl = $('sylvia-hub');
  ok('window.RaisingHub 就绪并在自由探索态挂载可见 #sylvia-hub',
    !!RH && !!hubEl && isElVisible(hubEl),
    `RH=${!!RH}, hubExists=${!!hubEl}, visible=${isElVisible(hubEl)}`);

  // 3b) rollSeasonChars() 预掷合法已解锁房间且无海伦娜出现在食堂
  const rollFn = typeof win.rollSeasonChars === 'function'
    ? win.rollSeasonChars
    : (RH && typeof RH.rollSeasonChars === 'function' ? RH.rollSeasonChars : null);
  let rollCountOk = true;
  let rollRoomsValid = true;
  let helenaInCafe = false;
  const rollIssues = [];
  if (rollFn) {
    for (let i = 0; i < 10; i++) {
      const curS = win.__getS();
      curS.seasonChars = {};
      curS.seasonCharsMeta = null;
      curS.phase = 'academy';
      curS.ageY = 12;
      curS.year = 12;
      curS.month = 9;
      curS.season = '秋';
      curS.loc = 'dorm';
      const ret = rollFn(curS, true);
      const map = (curS.seasonChars && (curS.seasonChars[curS.season]
        || curS.seasonChars[`${curS.year}_${curS.season}`]
        || Object.values(curS.seasonChars).find((v) => v && typeof v === 'object')))
        || (ret && typeof ret === 'object' ? ret : {});
      const entries = Object.entries(map);
      if (entries.length === 0) {
        rollCountOk = false;
        rollIssues.push(`iter${i}:empty`);
      }
      for (const [cid, locId] of entries) {
        const L = win.__LOCS && win.__LOCS[locId];
        const areaOk = typeof win.phaseAreaAllowed === 'function' ? win.phaseAreaAllowed(L && L.area) : true;
        if (!L || !L.unlock || !areaOk) {
          rollRoomsValid = false;
          rollIssues.push(`${cid}->${locId}(unlock=${L && L.unlock},areaOk=${areaOk})`);
        }
        if (cid === 'helena' && locId === 'cafeteria') {
          helenaInCafe = true;
          rollIssues.push('helena->cafeteria');
        }
      }
      curS.loc = 'cafeteria';
      if (typeof win.whoIsHere === 'function' && win.whoIsHere().includes('helena')) {
        helenaInCafe = true;
        rollIssues.push('whoIsHere:helena@cafeteria');
      }
    }
  } else {
    rollCountOk = false;
    rollIssues.push('missing rollSeasonChars');
  }
  ok('rollSeasonChars() 仅预掷已解锁合法房间且海伦娜绝不出现在食堂',
    !!rollFn && rollCountOk && rollRoomsValid && !helenaInCafe,
    rollIssues.slice(0, 6).join('; '));

  // 3c) evaluateEnding() 返回职业+羁绊双轨结局，showEndingScreen() 写入 codex.endings 并响应 Escape
  const evalEndingFn = (RH && typeof RH.evaluateEnding === 'function' && RH.evaluateEnding)
    || (typeof win.evaluateEnding === 'function' && win.evaluateEnding)
    || null;
  const endState = Object.assign(win.__getS(), {
    phase: 'finale',
    ageY: 16,
    year: 16,
    month: 12,
    season: '冬',
    lv: 22,
    stats: { body: 72, mind: 84, mana: 88, charm: 76 },
    gold: 260,
    love: { alice: 5, aino: 4, beatrice: 4, noelle: 3 },
    know: { alice: 96, aino: 92, beatrice: 90, noelle: 80 },
  });
  win.__setS(endState);
  if (RH && RH.ENDINGS_STORAGE_KEY) {
    win.localStorage.removeItem(RH.ENDINGS_STORAGE_KEY);
  }
  if (win.codex) {
    win.codex.endings = [];
    if (typeof win.saveCodex === 'function') win.saveCodex();
  }
  let endingRes = null;
  if (evalEndingFn) {
    endingRes = evalEndingFn();
  }
  const hasCareerTrack = !!(endingRes && (endingRes.career || endingRes.careerEnding || endingRes.path || endingRes.profession));
  const hasBondTrack = !!(endingRes && (endingRes.bond || endingRes.bondEnding || endingRes.companion || endingRes.partner || endingRes.relationship));

  // 触发 showEndingScreen 检验终幕渲染、Esc 关闭以及 codex.endings 持久化写入
  const showEndingFn = (RH && typeof RH.showEndingScreen === 'function' && RH.showEndingScreen)
    || (typeof win.showEndingScreen === 'function' && win.showEndingScreen)
    || null;
  let endingModalClean = false;
  let endingModalClosed = false;
  if (showEndingFn) {
    const beforeEnd = snapshotVisibleModals();
    const endRet = showEndingFn();
    const endEl = detectOpenedModal(beforeEnd, endRet);
    const endTxt = ((endEl && endEl.textContent) || '').trim();
    endingModalClean = !!(endEl && endTxt.length > 0 && !/\bundefined\b/i.test(endTxt) && !/\bNaN\b/.test(endTxt));
    pressEscape();
    endingModalClosed = !!(endEl && !isElVisible(endEl));
  }
  const codexMemRecorded = !!(win.codex && Array.isArray(win.codex.endings) && win.codex.endings.length >= 1);
  let codexStoredRecorded = false;
  try {
    const savedCodex = JSON.parse(win.localStorage.getItem('ojousama_codex_v1') || '{}');
    codexStoredRecorded = Array.isArray(savedCodex.endings) && savedCodex.endings.length >= 1;
  } catch (e) {}
  ok('evaluateEnding() 返回职业+羁绊双轨结局并持久写入 codex.endings',
    !!evalEndingFn && hasCareerTrack && hasBondTrack && codexMemRecorded && codexStoredRecorded,
    `fn=${!!evalEndingFn}, career=${hasCareerTrack}, bond=${hasBondTrack}, mem=${codexMemRecorded}, stored=${codexStoredRecorded}`);

  // 3d) 五大弹窗开合与 Escape 关闭
  win.__getS().phase = 'academy';
  win.__getS().ageY = 12;
  win.__getS().loc = 'cafeteria';
  win.__getS().freeRoam = true;
  const modalSpecs = [
    { name: 'openSchedulePlanner', args: () => [] },
    { name: 'openSeasonReport', args: () => [] },
    { name: 'openShopModal', args: () => [] },
    { name: 'openMailboxModal', args: () => [] },
  ];
  const modalFails = [];
  if (!showEndingFn) modalFails.push('showEndingScreen:missing');
  else if (!endingModalClean || !endingModalClosed) {
    modalFails.push(`showEndingScreen(clean=${endingModalClean},closed=${endingModalClosed})`);
  }
  for (const spec of modalSpecs) {
    const fn = (RH && typeof RH[spec.name] === 'function' && RH[spec.name])
      || (typeof win[spec.name] === 'function' && win[spec.name])
      || null;
    if (!fn) {
      modalFails.push(`${spec.name}:missing`);
      continue;
    }
    const before = snapshotVisibleModals();
    const ret = fn.apply(RH || win, spec.args());
    const openedEl = detectOpenedModal(before, ret);
    if (!openedEl) {
      modalFails.push(`${spec.name}:not-opened`);
      continue;
    }
    const txt = (openedEl.textContent || '').trim();
    const cleanText = txt.length > 0 && !/\bundefined\b/i.test(txt) && !/\bNaN\b/.test(txt);
    pressEscape();
    const closed = !isElVisible(openedEl);
    if (!cleanText || !closed) {
      modalFails.push(`${spec.name}(clean=${cleanText},closed=${closed})`);
    }
  }
  ok('openSchedulePlanner / openSeasonReport / openShopModal / openMailboxModal / showEndingScreen 正常渲染并响应 Escape 关闭',
    modalFails.length === 0,
    modalFails.join('; '));

  // 3e) openWaxLetter() / openMailboxLetter() 复原标题 #btn-letter-test 默认爱丽丝信笺
  const openWaxFn = (RH && typeof RH.openWaxLetter === 'function' && RH.openWaxLetter)
    || (typeof win.openWaxLetter === 'function' && win.openWaxLetter)
    || null;
  const openMailLetterFn = (RH && typeof RH.openMailboxLetter === 'function' && RH.openMailboxLetter) || null;
  const letterDemoEl = $('letter-demo');
  const titleLetterBtn = $('btn-letter-test');
  let customOpened = false;
  let customClosed = false;
  let defaultRestored = false;
  let waxMarker = '苹果派';
  if ((openWaxFn || openMailLetterFn) && letterDemoEl && titleLetterBtn) {
    if (openWaxFn) {
      openWaxFn({
        id: 'v2_guard_custom_wax',
        from: '贝阿特丽丝',
        sender: '贝阿特丽丝',
        kicker: 'A letter from Beatrice',
        title: '王都来信',
        heading: '王都来信',
        to: '亲爱的希尔维亚：',
        salutation: '亲爱的希尔维亚：',
        paragraphs: ['王都的烤苹果派香气四溢，真想立刻带一盒给你。'],
        body: '王都的烤苹果派香气四溢，真想立刻带一盒给你。',
        sign: '贝阿特丽丝',
      });
      const customTxt = letterDemoEl.textContent || '';
      customOpened = vis('letter-demo') && (customTxt.includes('苹果派') || customTxt.includes('贝阿特丽丝') || customTxt.includes('王都'));
    } else {
      const catalog = (RH && Array.isArray(RH.MAILBOX_CATALOG)) ? RH.MAILBOX_CATALOG : [];
      const nonAlice = catalog.find((m) => m && !m.useAliceDynamic) || catalog[0];
      if (nonAlice) {
        waxMarker = nonAlice.heading || nonAlice.title || nonAlice.sign || '';
        openMailLetterFn(nonAlice.id, win.__getS());
        const customTxt = letterDemoEl.textContent || '';
        customOpened = vis('letter-demo') && (!!waxMarker && customTxt.includes(waxMarker));
      }
    }
    pressEscape();
    if (vis('letter-demo') && $('letter-close')) $('letter-close').click();
    customClosed = !vis('letter-demo');

    titleLetterBtn.click();
    const restoredTxt = letterDemoEl.textContent || '';
    defaultRestored = vis('letter-demo')
      && restoredTxt.includes('爱丽丝')
      && restoredTxt.includes('风铃草')
      && (!waxMarker || !restoredTxt.includes(waxMarker));
    pressEscape();
    if (vis('letter-demo') && $('letter-close')) $('letter-close').click();
  }
  ok('openWaxLetter() / openMailboxLetter() 展示自定义来信后，标题页 #btn-letter-test 完整复原默认爱丽丝信笺',
    !!(openWaxFn || openMailLetterFn) && customOpened && customClosed && defaultRestored,
    `wax=${!!openWaxFn}, mail=${!!openMailLetterFn}, customOpen=${customOpened}, customClose=${customClosed}, restored=${defaultRestored}`);

  // 3f) S.gold 永不跌破 0（剧情扣款 + 商店零银币购买双重验证）
  const goldS = win.__getS();
  goldS.loc = 'cafeteria';
  goldS.ageY = 12;
  goldS.gold = 5;
  if (typeof win.applyLineEffects === 'function') {
    win.applyLineEffects({ gold: -30 });
  }
  const afterLineGold = win.__getS().gold;
  win.__getS().gold = 0;
  let buyRejected = true;
  if (RH && typeof RH.buyCozyItem === 'function' && Array.isArray(RH.COZY_SHOP_CATALOG) && RH.COZY_SHOP_CATALOG.length) {
    const buyRes = RH.buyCozyItem(RH.COZY_SHOP_CATALOG[0].id, win.__getS());
    buyRejected = !!(buyRes && buyRes.ok === false && buyRes.reason === 'no_gold');
  }
  if (RH && typeof RH.openShopModal === 'function') {
    const beforeShop = snapshotVisibleModals();
    const shopRet = RH.openShopModal();
    const shopEl = detectOpenedModal(beforeShop, shopRet);
    if (shopEl) {
      const buyBtns = shopEl.querySelectorAll('[data-buy-item], [data-shop-buy], [data-buy], .shop-buy-btn, button');
      buyBtns.forEach((b) => {
        if (!b.disabled && /买|购/.test(b.textContent || '')) {
          try { b.click(); } catch (e) {}
        }
      });
    }
    pressEscape();
  }
  const finalGold = win.__getS().gold;
  ok('S.gold 在剧情扣费与商店零银币购买场景下均严守 >= 0 不为负',
    afterLineGold >= 0 && finalGold >= 0 && buyRejected,
    `afterLineGold=${afterLineGold}, finalGold=${finalGold}, buyRejected=${buyRejected}`);

  // 3g) 分地域集市商铺守卫（非商业地点隐藏入口+拒买+纯礼囊赠礼，6 处商铺精准展示对应货架，舆图预载与终幕入口门控）
  const venueExpectations = {
    town: {
      name: '利维莫尔镇集市',
      shortBadge: '镇集市',
      items: ['shop_caramel_cookie', 'shop_mint_tea', 'shop_honey_pancake', 'shop_parchment_journal', 'shop_frost_cedar_sachet', 'shop_silver_moon_clip', 'shop_ice_bookmark', 'shop_sword_tassel_oil'],
      forbidden: 'shop_osmanthus_cake',
    },
    market: {
      name: '王都中央材料市场',
      shortBadge: '王都集市',
      items: ['shop_parchment_journal', 'shop_ice_bookmark', 'shop_sword_tassel_oil', 'shop_frost_cedar_sachet', 'shop_silver_moon_clip', 'shop_magic_theory_notes', 'shop_warming_frost_stone'],
      forbidden: 'shop_honey_pancake',
    },
    cafeteria: {
      name: '学院食堂 · 甜点茶饮柜',
      shortBadge: '甜点柜',
      items: ['shop_caramel_cookie', 'shop_mint_tea', 'shop_honey_pancake'],
      forbidden: 'shop_magic_theory_notes',
    },
    flowerhouse: {
      name: '校园花坊 · 温室花礼角',
      shortBadge: '花坊',
      items: ['shop_polar_lily_dried', 'shop_frost_cedar_sachet', 'shop_mint_tea'],
      forbidden: 'shop_caramel_cookie',
    },
    chenglan_guild: {
      name: '澄岚街市与公会补给柜',
      shortBadge: '澄岚集市',
      items: ['shop_osmanthus_cake', 'shop_caramel_cookie', 'shop_mint_tea', 'shop_parchment_journal', 'shop_sword_tassel_oil', 'shop_silver_moon_clip', 'shop_frost_cedar_sachet'],
      forbidden: 'shop_warming_frost_stone',
    },
    ice_canyon: {
      name: '北境前线 · 行商补给摊',
      shortBadge: '行商摊',
      items: ['shop_warming_frost_stone', 'shop_polar_lily_dried', 'shop_ice_bookmark', 'shop_sword_tassel_oil', 'shop_caramel_cookie', 'shop_mint_tea'],
      forbidden: 'shop_osmanthus_cake',
    },
  };
  const shopFails = [];
  const shopS = win.__getS();
  shopS.freeRoam = true;
  shopS.gold = 200;
  shopS.ageY = 12;
  shopS.phase = 'academy';
  if (!RH || !RH.SHOP_VENUES || typeof RH.getShopVenueAtLoc !== 'function' || typeof RH.isShopLocation !== 'function') {
    shopFails.push('missing SHOP_VENUES/getShopVenueAtLoc/isShopLocation');
  } else {
    const venueKeys = Object.keys(RH.SHOP_VENUES).sort();
    const expectedKeys = Object.keys(venueExpectations).sort();
    if (venueKeys.join(',') !== expectedKeys.join(',')) {
      shopFails.push(`venues=${venueKeys.join(',')}`);
    }
    if (Object.prototype.hasOwnProperty.call(RH.SHOP_VENUES, 'parlor')) {
      shopFails.push('parlor-still-in-SHOP_VENUES');
    }

    // 4 岁以下在任何地点均返回 null/false 且隐藏按钮
    shopS.ageY = 3;
    shopS.loc = 'town';
    RH.syncSylviaHub(shopS);
    if (RH.getShopVenueAtLoc('town', shopS) !== null || RH.isShopLocation('town', shopS) !== false) {
      shopFails.push('age<4-allowed-shop');
    }
    if (isElVisible($('btn-raising-shop'))) {
      shopFails.push('age<4-btn-visible');
    }

    // 非商业地点（dorm / parlor / northforest）：按钮隐藏、货架空、拒买、openShopModal('gift'|'market') 纯礼囊无购买钮
    shopS.ageY = 12;
    for (const nonLoc of ['dorm', 'parlor', 'northforest']) {
      shopS.loc = nonLoc;
      shopS.gold = 200;
      RH.syncSylviaHub(shopS);
      const btnShop = $('btn-raising-shop');
      if (RH.isShopLocation(nonLoc, shopS)) shopFails.push(`${nonLoc}:isShopLocation`);
      if (btnShop && !btnShop.classList.contains('hidden')) shopFails.push(`${nonLoc}:btn-not-hidden`);
      const avail = RH.getAvailableShopItems(shopS);
      if (!Array.isArray(avail) || avail.length !== 0) shopFails.push(`${nonLoc}:stock=${avail && avail.length}`);
      const crossBuy = RH.buyCozyItem('shop_caramel_cookie', shopS);
      if (!crossBuy || crossBuy.ok !== false || crossBuy.reason !== 'not_sold_here' || shopS.gold !== 200) {
        shopFails.push(`${nonLoc}:crossBuy=${JSON.stringify(crossBuy)}`);
      }
      for (const tabArg of ['gift', 'market']) {
        const shopEl = RH.openShopModal(tabArg);
        const h2Text = ((shopEl && shopEl.querySelector('h2') && shopEl.querySelector('h2').textContent) || '').trim();
        const hasMarketTab = !!(shopEl && shopEl.querySelector('[data-shop-tab="market"]'));
        const buyBtns = shopEl ? Array.from(shopEl.querySelectorAll('[data-buy-item], button')).filter((b) => b.hasAttribute('data-buy-item') || /买|购/.test(b.textContent || '')) : [];
        if (h2Text !== '随身礼囊 · 心意赠礼' || hasMarketTab || buyBtns.length > 0) {
          shopFails.push(`${nonLoc}:${tabArg}(h2=${h2Text},mktTab=${hasMarketTab},buyBtns=${buyBtns.length})`);
        }
        pressEscape();
      }
    }

    // 6 处分地域商铺：按钮显隐与动态文案、专属货架、跨地拒买、弹窗精准渲染
    for (const [locId, exp] of Object.entries(venueExpectations)) {
      shopS.loc = locId;
      shopS.gold = 200;
      RH.syncSylviaHub(shopS);
      const btnShop = $('btn-raising-shop');
      const fullLbl = btnShop && btnShop.querySelector('.rh-dc-full');
      if (!RH.isShopLocation(locId, shopS)) shopFails.push(`${locId}:not-shop`);
      if (!btnShop || btnShop.classList.contains('hidden')) shopFails.push(`${locId}:btn-hidden`);
      if (!fullLbl || fullLbl.textContent.trim() !== exp.shortBadge) {
        shopFails.push(`${locId}:badge=${fullLbl && fullLbl.textContent}`);
      }
      const stockIds = RH.getAvailableShopItems(shopS).map((x) => x.id);
      if (stockIds.join(',') !== exp.items.join(',')) {
        shopFails.push(`${locId}:stockMismatch(${stockIds.join(',')})`);
      }
      const crossBuy = RH.buyCozyItem(exp.forbidden, shopS);
      if (!crossBuy || crossBuy.ok !== false || crossBuy.reason !== 'not_sold_here') {
        shopFails.push(`${locId}:allowedForbidden=${exp.forbidden}`);
      }
      const shopEl = RH.openShopModal('market');
      const h2Text = ((shopEl && shopEl.querySelector('h2') && shopEl.querySelector('h2').textContent) || '').trim();
      const cardIds = shopEl ? Array.from(shopEl.querySelectorAll('.rh-shop-card[data-item-id]')).map((el) => el.getAttribute('data-item-id')) : [];
      if (h2Text !== exp.name || cardIds.join(',') !== exp.items.join(',')) {
        shopFails.push(`${locId}:modalMismatch(h2=${h2Text},cards=${cardIds.length})`);
      }
      pressEscape();
    }

    // 舆图校验：全量 loading="eager" decoding="sync"、parlor 无商铺标、flowerhouse 显示「花坊」、秘闻替代彩蛋
    shopS.phase = 'academy';
    shopS.loc = 'dorm';
    Object.values(win.__LOCS || {}).forEach((L) => {
      L.unlock = (L.area === '魔法大学' || L.area === '王都');
    });
    RH.renderVisualMap(shopS);
    const mapImgs = Array.from(doc.querySelectorAll('#map-grid .rh-map-thumb > img'));
    const allEagerSync = mapImgs.length > 0 && mapImgs.every((img) => img.getAttribute('loading') === 'eager' && img.getAttribute('decoding') === 'sync');
    const flowerShopBadge = doc.querySelector('#map-grid [data-loc="flowerhouse"] .badge-shop');
    const cafeShopBadge = doc.querySelector('#map-grid [data-loc="cafeteria"] .badge-shop');
    const mapText = ($('map-grid') && $('map-grid').textContent) || '';
    const hasSecretBadge = !!doc.querySelector('#map-grid .badge-egg') && mapText.includes('秘闻') && !mapText.includes('彩蛋');
    if (!allEagerSync) shopFails.push(`mapImgLazy(count=${mapImgs.length})`);
    if (!flowerShopBadge || flowerShopBadge.textContent.trim() !== '花坊') shopFails.push('map:missing-flowerhouse-badge');
    if (!cafeShopBadge || cafeShopBadge.textContent.trim() !== '甜点柜') shopFails.push('map:missing-cafeteria-badge');
    if (!hasSecretBadge) shopFails.push('map:egg-not-renamed-to-秘闻');
    shopS.phase = 'youth';
    shopS.loc = 'parlor';
    Object.values(win.__LOCS || {}).forEach((L) => {
      L.unlock = (L.area === '公爵府' || L.area === '领地');
    });
    RH.renderVisualMap(shopS);
    if (doc.querySelector('#map-grid [data-loc="parlor"] .badge-shop')) shopFails.push('map:parlor-has-shop-badge');
    const townShopBadge = doc.querySelector('#map-grid [data-loc="town"] .badge-shop');
    if (!townShopBadge || townShopBadge.textContent.trim() !== '镇集市') shopFails.push('map:missing-town-badge');
    if ($('map-overlay')) $('map-overlay').classList.add('hidden');

    // 终幕回响门控：刚进 journey 未达终章不露出，达 ch_leaky_cup / finale 后显示
    shopS.phase = 'journey';
    shopS.flags = { named: 1, did_turnpoint: 1, arrived_jikan: 1, ch_distant_wind_1: 1 };
    RH.syncSylviaHub(shopS);
    if (RH.canOpenEndingForecast(shopS) || !$('btn-raising-ending').classList.contains('hidden')) {
      shopFails.push('ending-exposed-early-journey');
    }
    shopS.flags.ch_leaky_cup = 1;
    RH.syncSylviaHub(shopS);
    if (!RH.canOpenEndingForecast(shopS) || $('btn-raising-ending').classList.contains('hidden')) {
      shopFails.push('ending-hidden-after-leaky-cup');
    }
  }
  ok('分地域集市商铺（6 处特产货架 / 非商业地隐藏入口拒买与纯赠礼态 / 舆图 eager 加载与秘闻标 / 终幕入口门控）全部达标',
    shopFails.length === 0,
    shopFails.slice(0, 8).join('; '));

  // =========================================================================
  // 4. Static Bright Crystal-Fantasy Palette & Layout Guard
  // =========================================================================
  console.log('\n[4/4] 明亮冰晶色板、堆叠层与新模块文案静态守卫');

  // 4a) 零暗黑/旧金 hex 残留
  const paletteFiles = [
    'index.html',
    'style.css',
    'css/combat.css',
    'css/system-chronicle.css',
    'css/gameplay-v2.css',
    'css/ambient-fx.css',
    'css/ai-branching.css',
    'css/raising-hub.css',
    'css/title-cobalt.css',
  ];
  const forbiddenHexRe = /#(?:080e1c|d8b467|dfbd72|e4c16a|f3dca2|e8c678|e6c275)\b/gi;
  const missingPaletteFiles = [];
  const paletteLeaks = [];
  for (const rel of paletteFiles) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      missingPaletteFiles.push(rel);
      continue;
    }
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    lines.forEach((ln, idx) => {
      const hits = ln.match(forbiddenHexRe);
      if (hits) {
        hits.forEach((h) => paletteLeaks.push(`${rel}:${idx + 1}:${h}`));
      }
    });
  }
  ok('index.html 与 8 份 CSS 文件均存在且零 #080e1c / 旧棕色暗金 (#d8b467/#dfbd72/#e4c16a/#f3dca2/#e8c678/#e6c275) 残留',
    missingPaletteFiles.length === 0 && paletteLeaks.length === 0,
    [missingPaletteFiles.length ? 'missing: ' + missingPaletteFiles.join(',') : '', paletteLeaks.slice(0, 8).join('; ')].filter(Boolean).join(' | '));

  // 4b) #app 不得设置 z-index: 3
  const cssToScan = paletteFiles.filter((f) => f.endsWith('.css') && fs.existsSync(path.join(ROOT, f)));
  const appZ3Violations = [];
  for (const rel of cssToScan) {
    const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const rules = parseCssRules(txt, { topLevelOnly: false });
    for (const r of rules) {
      const sels = r.selector.split(',').map((s) => s.trim());
      if (sels.includes('#app') && /(?:^|[;\s])z-index\s*:\s*3\b/i.test(r.body)) {
        appZ3Violations.push(rel);
      }
    }
  }
  ok('#app 样式未设置 z-index: 3（避免锁死子级弹窗层叠上下文）',
    appZ3Violations.length === 0,
    appZ3Violations.join(', '));

  // 4c) body.ui-hidden 隐藏 #btn-arena（经由 :not(#btn-ui) 或显式 #btn-arena 选择器），同时保留 #btn-ui
  const btnArena = $('btn-arena');
  const btnUi = $('btn-ui');
  doc.body.classList.add('ui-hidden');
  let hidesArena = false;
  let hidesUi = false;
  let restoresUi = false;
  for (const rel of cssToScan) {
    const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const topRules = parseCssRules(txt, { topLevelOnly: true });
    for (const r of topRules) {
      const isHidingDecl = /(?:opacity\s*:\s*0\b|display\s*:\s*none\b|visibility\s*:\s*hidden\b)/i.test(r.body);
      const isRestoreUiDecl = /opacity\s*:\s*1\b/i.test(r.body);
      if (!isHidingDecl && !isRestoreUiDecl) continue;
      const sels = r.selector.split(',').map((s) => s.trim()).filter(Boolean);
      for (const sel of sels) {
        if (!/body\.ui-hidden\b/.test(sel)) continue;
        let matchedArena = false;
        let matchedUi = false;
        if (btnArena && btnUi) {
          try {
            matchedArena = btnArena.matches(sel);
            matchedUi = btnUi.matches(sel);
          } catch (e) {
            matchedArena = /#btn-arena\b|:not\(\s*#btn-ui\s*\)/.test(sel);
            matchedUi = /#btn-ui\b/.test(sel) && !/:not\(\s*#btn-ui\s*\)/.test(sel);
          }
        }
        if (isHidingDecl && matchedArena) hidesArena = true;
        if (isHidingDecl && matchedUi) hidesUi = true;
        if (isRestoreUiDecl && matchedUi) restoresUi = true;
      }
    }
  }
  doc.body.classList.remove('ui-hidden');
  const uiStaysVisible = !hidesUi || restoresUi;
  ok('body.ui-hidden 沉浸模式完整隐藏 #btn-arena（且保持 #btn-ui 恢复按钮可见）',
    !!btnArena && !!btnUi && hidesArena && uiStaysVisible,
    `hidesArena=${hidesArena}, hidesUi=${hidesUi}, restoresUi=${restoresUi}`);

  // 4d) #am-close 提升到 .arena-mode-bar 之外（实测 openArenaHub DOM 结构）
  let amHoisted = false;
  let amDetail = '';
  if (typeof win.openArenaHub === 'function') {
    win.openArenaHub({ fromTitle: false });
    const amClose = $('am-close');
    const modeBar = doc.querySelector('#arena-overlay .arena-mode-bar');
    amHoisted = !!(amClose && modeBar && !modeBar.contains(amClose) && !(amClose.closest && amClose.closest('.arena-mode-bar')));
    amDetail = `amClose=${!!amClose}, modeBar=${!!modeBar}, inside=${!!(modeBar && amClose && modeBar.contains(amClose))}`;
    if (amClose) amClose.click();
    else pressEscape();
  } else {
    amDetail = 'missing openArenaHub';
  }
  ok('#am-close 关闭按钮已提升至 .arena-mode-bar 外部容器', amHoisted, amDetail);

  // 4e) 新模块零「不是」检查
  const newJsFiles = [
    'js/raising-hub.js',
    'js/sfx-suite.js',
    'js/title-director.js',
  ];
  const missingJs = [];
  const bushiHits = [];
  for (const rel of newJsFiles) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      missingJs.push(rel);
      continue;
    }
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    lines.forEach((ln, idx) => {
      if (ln.includes('不是')) {
        bushiHits.push(`${rel}:${idx + 1}`);
      }
    });
  }
  ok('js/raising-hub.js / js/sfx-suite.js / js/title-director.js 均存在且全文零「不是」',
    missingJs.length === 0 && bushiHits.length === 0,
    [missingJs.length ? 'missing: ' + missingJs.join(',') : '', bushiHits.slice(0, 6).join('; ')].filter(Boolean).join(' | '));

  // 全程运行时异常校验
  const realErrors = errors.filter((e) => !/HTMLMediaElement|play\(\)/.test(e));
  ok('全程无未捕获 JS/DOM 运行时异常', realErrors.length === 0, realErrors.join(' | '));

  console.log(`\n通过: ${pass} | 失败: ${fail}`);
  process.exit(fail ? 1 : 0);
}

run().catch((err) => {
  console.error('v2_overhaul_guard fatal error:', err && err.stack || err);
  process.exit(1);
});
