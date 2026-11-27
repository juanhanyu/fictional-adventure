'use strict';
/**
 * 商业级角色语音引擎全链路回归单测 (tests/voice_engine.test.js)
 * 覆盖：
 * 1. SSOT 哈希与 Key 计算契约 + 角色别名归一化（与 tools/voice/casting_fish_audio.json 逐比特一致）
 * 2. 0-404 清单拦截铁律 + 单声道复用 + LRU(16) 预取 + NotAllowedError 静默吞吐
 * 3. BGM Ducking (0.42/160ms → 300ms 延迟 → 1.0/360ms) 与 bgmGetVolume() 隔离
 * 4. 三向设置与静音联动 (game.js ↔ VNUx ↔ TitleDirector ↔ VoiceEngine)
 * 5. bright 亮度调节零音频扰动守卫
 * 6. VN 推进语义（skipType 不停语音 / advanceDialog 打断 / MONO / branch 回退 / Auto 等语音 / Skip 禁播 / 重播按钮 / Backlog 重听 / roam_greet 纯前缀 / 养成互动）
 * 7. 战斗 headless 拦截与 54 项 SSOT 战斗语音锚点 cue 派发校验
 */
const fs = require('node:fs');
const path = require('node:path');
const { win, errors } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const doc = win.document;
const $ = (id) => doc.getElementById(id);

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (cond) pass++;
  else fail++;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function refNormalize(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}
function refFnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function run() {
  console.log('\n===== 商业级角色语音引擎自动化回归测试 (voice_engine.test.js) =====');

  const VE = win.VoiceEngine;
  const VN = win.VNUx;
  const TD = win.TitleDirector;
  const CE = win.CombatEngine;
  const RH = win.RaisingHub;

  let mediaPlayCalls = 0;
  let mediaPlayShouldReject = false;
  if (win.HTMLMediaElement && win.HTMLMediaElement.prototype) {
    win.HTMLMediaElement.prototype.play = function () {
      mediaPlayCalls += 1;
      if (mediaPlayShouldReject) {
        const err = new win.Error('NotAllowedError');
        err.name = 'NotAllowedError';
        return Promise.reject(err);
      }
      return Promise.resolve();
    };
    win.HTMLMediaElement.prototype.pause = function () {};
  }

  // =========================================================================
  // 1. SSOT 哈希与 Key 计算契约 + 角色别名归一化
  // =========================================================================
  console.log('\n[1/7] SSOT 哈希契约与角色别名归一化');
  ok('window.VoiceEngine 与 window.VOICE_MANIFEST 已正确挂载',
    !!VE && !!win.VOICE_MANIFEST && win.VOICE_MANIFEST.version === 1 && win.VOICE_MANIFEST.totalFiles === 0 && Object.keys(win.VOICE_MANIFEST.entries || {}).length === 0,
    `VE=${!!VE}, manifest=${JSON.stringify(win.VOICE_MANIFEST)}`);

  const sampleRaw = '  第一行\r\n\u3000\u3000第二行   第三段  ';
  const expectedNorm = refNormalize(sampleRaw);
  const actualNorm = VE.normalizeVoiceText(sampleRaw);
  const expectedStoryKey = `s_start__sylvia__${refFnv1aHex('sylvia|' + expectedNorm)}`;
  const actualStoryKey = VE.makeStoryKey('s_start', 'sylvia', sampleRaw);
  const expectedInterKey = `inter__tap__sylvia__${refFnv1aHex('sylvia|' + refNormalize('风很轻呢。'))}`;
  const actualInterKey = VE.makeInteractiveKey('tap', '渔', '风很轻呢。');
  const actualCombatKey = VE.makeCombatKey('one_more');

  ok('normalizeVoiceText / fnv1aHex / makeStoryKey / makeInteractiveKey / makeCombatKey 与 SSOT 逐比特一致',
    actualNorm === expectedNorm
      && VE.fnv1aHex('sylvia|' + expectedNorm) === refFnv1aHex('sylvia|' + expectedNorm)
      && actualStoryKey === expectedStoryKey
      && actualInterKey === expectedInterKey
      && actualCombatKey === 'combat__one_more',
    `story=${actualStoryKey} vs ${expectedStoryKey}, inter=${actualInterKey}`);

  const aliasChecks = [
    [VE.resolveCharId('', '渔'), 'sylvia'],
    [VE.resolveCharId('渔', ''), 'sylvia'],
    [VE.resolveCharId('', '贝蒂'), 'beatrice'],
    [VE.resolveCharId('', '罗文'), 'rowan'],
    [VE.resolveCharId('', '岚'), 'fengshen'],
    [VE.resolveCharId('', '兰'), 'fengshen'],
    [VE.resolveCharId('', '老霁'), 'ji'],
    [VE.resolveCharId('', '霁馆主'), 'ji'],
    [VE.resolveCharId('sophia', '？？？'), 'sophia'],
    [VE.resolveCharId('claude', '？？？'), 'claude'],
    [VE.resolveCharId('', '问询骑士'), 'servant_a'],
    [VE.resolveCharId('', '魔法师'), 'servant_a'],
    [VE.resolveCharId('', '侍卫'), 'servant_a'],
    [VE.resolveCharId('', '侍从'), 'servant_a'],
    [VE.resolveCharId('', '巴依随军药师'), 'musa'],
    [VE.resolveCharId('ji', '霁清', 's_eye_of_storm'), 'ji'],
    [VE.resolveCharId('jiqing', '霁清', 's_eye_of_storm'), 'jiqing'],
    [VE.resolveCharId('lecturer', '家庭教师', 's_sisters_grow'), 'teacher'],
  ];
  const aliasBad = aliasChecks.filter(([got, exp]) => got !== exp);
  const castingPathEarly = path.join(ROOT, 'tools', 'voice', 'casting_fish_audio.json');
  if (fs.existsSync(castingPathEarly)) {
    const castingEarly = JSON.parse(fs.readFileSync(castingPathEarly, 'utf8'));
    for (const [aliasKey, expectedCid] of Object.entries(castingEarly.speakerAliases || {})) {
      const gotCid = VE.resolveCharId('', aliasKey);
      if (gotCid !== expectedCid) {
        aliasBad.push([`${aliasKey}->${gotCid}`, expectedCid]);
      }
    }
  }
  ok('resolveCharId 与 extract_game_lines.mjs / casting_fish_audio.json 全部别名与特例优先级 100% 一致',
    aliasBad.length === 0,
    aliasBad.map(([g, e]) => `${g}!=${e}`).join('; '));

  // =========================================================================
  // 2. 0-404 清单拦截铁律 + 单声道复用 + LRU(16) + NotAllowedError 静默吞吐
  // =========================================================================
  console.log('\n[2/7] 0-404 清单拦截、单主声道复用与 LRU(16) 预取');
  const beforePlayCalls = mediaPlayCalls;
  const r1 = VE.playById('non_existent_voice_key');
  const r2 = VE.playStoryLine({ sceneId: 's_start', charId: 'sylvia', text: '未登记台词' });
  const r3 = VE.playInteractive('tap', 'sylvia', '未登记轻触');
  const r4 = VE.playCombatCue('victory_s');
  const pf0 = VE.prefetch(['non_existent_1', 'non_existent_2']);
  ok('空清单下全部播放与预取静默返回 false/0 且不创建 <audio> 也不触发任何播放请求（0-404 铁律）',
    r1 === false && r2 === false && r3 === false && r4 === false && pf0 === 0
      && VE._getAudioElement() === null && mediaPlayCalls === beforePlayCalls,
    `audioEl=${!!VE._getAudioElement()}, playCalls=${mediaPlayCalls - beforePlayCalls}`);

  const origEntries = win.VOICE_MANIFEST.entries;
  const testEntries = {};
  for (let i = 0; i < 20; i++) {
    testEntries[`test_lru_${i}`] = `test/test_lru_${i}.mp3`;
  }
  const testStoryText = '银白色的雪落在窗沿。';
  const testStoryKey = VE.makeStoryKey('s_test_voice', 'sylvia', testStoryText);
  testEntries[testStoryKey] = { path: `assets/voice/story/s_test_voice/${testStoryKey}.mp3`, charId: 'sylvia' };
  const testStoryText2 = '妹妹，快看外面的雪！';
  const testStoryKey2 = VE.makeStoryKey('s_test_voice', 'beatrice', testStoryText2);
  testEntries[testStoryKey2] = { path: `assets/voice/story/s_test_voice/${testStoryKey2}.mp3`, charId: 'beatrice' };
  const testMonoText = '风吹过冰晶回廊，心里安静了下来。';
  const testMonoKey = VE.makeStoryKey('s_test_voice', 'sylvia', testMonoText);
  testEntries[testMonoKey] = { path: `assets/voice/story/s_test_voice/${testMonoKey}.mp3`, charId: 'sylvia' };
  const testBranchText = '这是来自因果支线的回响台词。';
  const testBranchKey = VE.makeInteractiveKey('branch', 'alice', testBranchText);
  testEntries[testBranchKey] = { path: `assets/voice/interactive/branch/${testBranchKey}.mp3`, charId: 'alice' };
  win.VOICE_MANIFEST.entries = testEntries;

  const prefetchedCount = VE.prefetch(Array.from({ length: 20 }, (_, i) => `test_lru_${i}`).concat(['missing_999']));
  ok('prefetch 仅预取清单存在项且 LRU 缓存严格上限 16',
    prefetchedCount === 20 && VE._getPrefetchSize() === 16,
    `count=${prefetchedCount}, size=${VE._getPrefetchSize()}`);

  mediaPlayShouldReject = true;
  const errsBeforeReject = errors.length;
  VE.playById(testStoryKey, { mode: 'story', charId: 'sylvia' });
  await wait(20);
  mediaPlayShouldReject = false;
  ok('浏览器 autoplay NotAllowedError 被静默吞吐、零 console error 且状态自动回落为未播放',
    errors.length === errsBeforeReject && VE.isPlaying() === false,
    `errs=${errors.length - errsBeforeReject}, playing=${VE.isPlaying()}`);

  const stateEvents = [];
  const onVoiceState = (ev) => stateEvents.push(ev.detail);
  win.addEventListener('voice:statechange', onVoiceState);
  const started1 = VE.playById(testStoryKey, { mode: 'story', charId: 'sylvia' });
  const el1 = VE._getAudioElement();
  const started2 = VE.playById(testStoryKey2, { mode: 'story', charId: 'beatrice' });
  const el2 = VE._getAudioElement();
  let endedFired = false;
  VE.onEndedOnce(() => { endedFired = true; });
  el2.dispatchEvent(new win.Event('ended'));
  win.removeEventListener('voice:statechange', onVoiceState);
  VE.stop({ clearCurrent: true, immediateDuck: true });
  ok('单主声道 <audio> 复用、派发 voice:statechange 且 ended 正确复位并触发 onEndedOnce',
    started1 && started2 && el1 === el2 && endedFired && !VE.isPlaying()
      && stateEvents.some((e) => e.playing === true && e.voiceId === testStoryKey2)
      && stateEvents.some((e) => e.playing === false && e.canReplay === true),
    `sameEl=${el1 === el2}, ended=${endedFired}, events=${stateEvents.length}`);

  // =========================================================================
  // 3. BGM Ducking 数值校验与 bgmGetVolume() 隔离
  // =========================================================================
  console.log('\n[3/7] BGM Ducking 平滑压低与延迟回弹校验');
  if (typeof win.setMuted === 'function') win.setMuted(false);
  win.setSetting('bgm', 0.50);
  const bgmKey0 = Object.keys(win.BGM_FILES || {})[0] || 'peaceful1';
  win.bgmPlay(bgmKey0, { fade: false });
  const bgmEl = $('bgm-audio');
  const volBeforeDuck = bgmEl ? bgmEl.volume : -1;

  VE.playById(testStoryKey, { mode: 'story', charId: 'sylvia' });
  await wait(220);
  const duckedElVol = bgmEl ? bgmEl.volume : -1;
  const userBgmVolDuringDuck = win.bgmGetVolume();
  const duckGainDuringPlay = win.bgmGetDuck();

  VE._getAudioElement().dispatchEvent(new win.Event('ended'));
  await wait(120);
  const duckGainAt120ms = win.bgmGetDuck();
  await wait(650);
  const restoredElVol = bgmEl ? bgmEl.volume : -1;
  const duckGainAfterRestore = win.bgmGetDuck();

  ok('BGM Ducking 精确压低至 0.42× 且不改 bgmGetVolume()，播毕延迟 300ms 后平滑回弹至 1.0×',
    Math.abs(volBeforeDuck - 0.50) < 0.02
      && Math.abs(userBgmVolDuringDuck - 0.50) < 0.005
      && Math.abs(duckGainDuringPlay - 0.42) < 0.01
      && Math.abs(duckedElVol - 0.50 * 0.42) < 0.03
      && Math.abs(duckGainAt120ms - 0.42) < 0.01
      && Math.abs(duckGainAfterRestore - 1.0) < 0.01
      && Math.abs(restoredElVol - 0.50) < 0.03,
    `before=${volBeforeDuck}, ducked=${duckedElVol}, userVol=${userBgmVolDuringDuck}, at120=${duckGainAt120ms}, restored=${restoredElVol}`);

  // =========================================================================
  // 4. 三向音量/开关与全局静音联动
  // =========================================================================
  console.log('\n[4/7] 三向音量/开关同步 (game.js ↔ VNUx ↔ TitleDirector) 与静音联动');
  win.openPanel('settings');
  VN.openPrefsModal();
  if (TD && typeof TD.openSettingsMode === 'function') TD.openSettingsMode();

  win.setSetting('voiceVol', 0.42);
  const s1GameSlider = $('set-voice') ? Number($('set-voice').value) : -1;
  const s1VnPref = VN.getPrefs().voiceVol;
  const s1VnSlider = $('pref-voice-vol') ? Number($('pref-voice-vol').value) : -1;
  const s1TitleSlider = $('v3-set-voice') ? Number($('v3-set-voice').value) : -1;
  const s1VeVol = VE.getVolume();
  const s1Storage = parseFloat(win.localStorage.getItem('ojousama_voice_vol'));

  ok("game.js setSetting('voiceVol', 0.42) 三向实时同步 VoiceEngine / VNUx / TitleDirector / localStorage",
    s1GameSlider === 42 && s1VnSlider === 42 && s1TitleSlider === 42
      && Math.abs(s1VnPref - 0.42) < 0.005 && Math.abs(s1VeVol - 0.42) < 0.005 && Math.abs(s1Storage - 0.42) < 0.005,
    `game=${s1GameSlider}, vn=${s1VnSlider}/${s1VnPref}, title=${s1TitleSlider}, ve=${s1VeVol}, ls=${s1Storage}`);

  VN.setPref('voiceVol', 0.73);
  const s2GameSlider = $('set-voice') ? Number($('set-voice').value) : -1;
  const s2TitleSlider = $('v3-set-voice') ? Number($('v3-set-voice').value) : -1;
  const s2VeVol = VE.getVolume();
  ok("VNUx.setPref('voiceVol', 0.73) 同步 game.js / TitleDirector / VoiceEngine",
    s2GameSlider === 73 && s2TitleSlider === 73 && Math.abs(s2VeVol - 0.73) < 0.005,
    `game=${s2GameSlider}, title=${s2TitleSlider}, ve=${s2VeVol}`);

  const titleToggle = $('v3-set-voice-toggle');
  if (titleToggle) titleToggle.click();
  const disabledEverywhere = VE.isEnabled() === false && VN.getPrefs().voiceEnabled === false
    && win.localStorage.getItem('ojousama_voice_enabled') === '0';
  if (titleToggle) titleToggle.click();
  const reenabledEverywhere = VE.isEnabled() === true && VN.getPrefs().voiceEnabled === true
    && win.localStorage.getItem('ojousama_voice_enabled') === '1';
  ok('标题页 #v3-set-voice-toggle 与 VNUx / VoiceEngine / localStorage 实时双向切换语音开关',
    !!titleToggle && disabledEverywhere && reenabledEverywhere,
    `btn=${!!titleToggle}, off=${disabledEverywhere}, on=${reenabledEverywhere}`);

  VE.playById(testStoryKey, { mode: 'story', charId: 'sylvia' });
  const wasPlayingBeforeMute = VE.isPlaying();
  win.setMuted(true);
  const stoppedOnMute = VE.isMuted() === true && VE.isPlaying() === false;
  const blockedWhileMuted = VE.playById(testStoryKey, { mode: 'story', charId: 'sylvia' }) === false;
  win.setMuted(false);
  const unmutedOk = VE.isMuted() === false;
  ok('全局 setMuted(true/false) 同步 VoiceEngine 静音锁定并立刻止音',
    wasPlayingBeforeMute && stoppedOnMute && blockedWhileMuted && unmutedOk,
    `before=${wasPlayingBeforeMute}, stopped=${stoppedOnMute}, blocked=${blockedWhileMuted}, unmuted=${unmutedOk}`);

  VN.closePrefsModal();
  win.show('panel', 0);
  if (TD && typeof TD.returnToMain === 'function') TD.returnToMain({ silent: true });
  win.resetSettings();
  ok('resetSettings() 恢复 voiceVol=0.90 与 voiceEnabled=true',
    Math.abs(VE.getVolume() - 0.90) < 0.005 && VE.isEnabled() === true && Math.abs(VN.getPrefs().voiceVol - 0.90) < 0.005,
    `ve=${VE.getVolume()}/${VE.isEnabled()}, vn=${VN.getPrefs().voiceVol}`);

  // =========================================================================
  // 5. bright 亮度隔离守卫
  // =========================================================================
  console.log('\n[5/7] bright 背景明度隔离守卫');
  win.setSetting('bgm', 0.45);
  win.bgmPlay(bgmKey0, { fade: false });
  VE.playById(testStoryKey, { mode: 'story', charId: 'sylvia' });
  const voicePlayingBeforeBright = VE.isPlaying();
  const voiceVolBeforeBright = VE.getVolume();
  const bgmVolBeforeBright = win.bgmGetVolume();
  win.setSetting('bright', 0.85);
  const voicePlayingAfterBright = VE.isPlaying();
  const voiceVolAfterBright = VE.getVolume();
  const bgmVolAfterBright = win.bgmGetVolume();
  win.setSetting('bright', 1);
  VE.stop({ clearCurrent: true, immediateDuck: true });
  win.bgmStop(false);
  ok("setSetting('bright', 0.85) 不中断正在播放的语音且不改动 VoiceEngine / BGM 音量",
    voicePlayingBeforeBright && voicePlayingAfterBright
      && Math.abs(voiceVolBeforeBright - voiceVolAfterBright) < 0.001
      && Math.abs(bgmVolBeforeBright - bgmVolAfterBright) < 0.001,
    `playing=${voicePlayingBeforeBright}->${voicePlayingAfterBright}, vVol=${voiceVolBeforeBright}->${voiceVolAfterBright}`);

  // =========================================================================
  // 6. VN 推进、MONO/branch 回退、Auto/Skip/Replay/Backlog、roam_greet 纯前缀与养成互动
  // =========================================================================
  console.log('\n[6/7] VN 阅读流 (skipType/advance/MONO/branch/Auto/Skip/Replay/Backlog) 与养成互动');
  win.__resetS();
  win.show('title-screen', 0);
  win.show('game-screen', 1);
  VN.clearBacklog();
  win.__restoreTyping();
  win.SCENES.s_test_voice = {
    bgm: 'peaceful',
    bg: 'bg-room',
    lines: [
      { ch: 'sylvia', speaker: '希尔维亚', text: testStoryText },
      { ch: 'beatrice', speaker: '贝阿特丽丝', text: testStoryText2 },
      { text: '这是一句没有配音的旁白。' }
    ]
  };
  win.__runScene('s_test_voice');
  const playingLine1 = VE.isPlaying() && VE.getCurrentVoiceId() === testStoryKey;
  const replayBtn = $('btn-vn-voice-replay');
  const replayVisibleLine1 = !!(replayBtn && !replayBtn.disabled && !replayBtn.classList.contains('is-unavailable'));
  const textBoxVoicing = !!($('text-box') && $('text-box').classList.contains('is-voicing'));

  // 第一次 advanceDialog 触发 skipType() 补全文字 — 绝不停语音
  win.advanceDialog();
  const stillPlayingAfterSkipType = VE.isPlaying() && VE.getCurrentVoiceId() === testStoryKey;

  // 第二次 advanceDialog 真正切句到第 2 句
  win.advanceDialog();
  const switchedToLine2 = VE.isPlaying() && VE.getCurrentVoiceId() === testStoryKey2;

  // 播完第 2 句后，点击 #btn-vn-voice-replay 重播第 2 句
  VE._getAudioElement().dispatchEvent(new win.Event('ended'));
  const replayStillAvailableAfterEnd = !!(replayBtn && !replayBtn.disabled && !replayBtn.classList.contains('is-unavailable'));
  if (replayBtn) replayBtn.click();
  const replayedLine2 = VE.isPlaying() && VE.getCurrentVoiceId() === testStoryKey2;

  ok('skipType() 补全文字绝不中断语音；advanceDialog() 切句起播新语音；#btn-vn-voice-replay 可重播当前句',
    playingLine1 && replayVisibleLine1 && textBoxVoicing && stillPlayingAfterSkipType
      && switchedToLine2 && replayStillAvailableAfterEnd && replayedLine2,
    `l1=${playingLine1}, btn=${replayVisibleLine1}, glow=${textBoxVoicing}, skipType=${stillPlayingAfterSkipType}, l2=${switchedToLine2}, replay=${replayedLine2}`);

  // Auto 等待当前语音播完再推进
  win.advanceDialog();
  VN.setPref('autoSpeed', 300);
  VN.setPref('voiceAutoWait', true);
  VN.setAutoMode(true);
  await wait(420);
  const heldWhileVoicePlaying = VE.isPlaying() && VE.getCurrentVoiceId() === testStoryKey2;
  VE._getAudioElement().dispatchEvent(new win.Event('ended'));
  await wait(450);
  const advancedAfterVoiceEnded = ($('text') && $('text').textContent || '').includes('没有配音的旁白');
  const replayHiddenOnUnvoiced = !!(replayBtn && replayBtn.disabled && replayBtn.classList.contains('is-unavailable'));
  VN.setAutoMode(false);
  ok('Auto 模式开启 voiceAutoWait 时等待语音播毕再按 autoSpeed 翻页，无语音句自动隐藏重播按钮',
    heldWhileVoicePlaying && advancedAfterVoiceEnded && replayHiddenOnUnvoiced,
    `held=${heldWhileVoicePlaying}, advanced=${advancedAfterVoiceEnded}, hiddenBtn=${replayHiddenOnUnvoiced}`);

  // 验证 MONO 独白与 branch 支线回退
  win.__restoreTyping();
  win.SCENES.s_test_mono_branch = {
    bgm: 'peaceful',
    bg: 'bg-room',
    lines: [
      { portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: true }], text: testMonoText },
      { ch: 'alice', speaker: '爱丽丝', text: testBranchText }
    ]
  };
  // 注入 s_test_mono_branch 下的 MONO key
  const monoKeyScene = VE.makeStoryKey('s_test_mono_branch', 'sylvia', testMonoText);
  testEntries[monoKeyScene] = { path: `assets/voice/story/s_test_mono_branch/${monoKeyScene}.mp3`, charId: 'sylvia' };
  win.__runScene('s_test_mono_branch');
  const monoVid = VE.getCurrentVoiceId();
  const monoPlayed = VE.isPlaying() && monoVid === monoKeyScene;
  win.advanceDialog(); // 补全第 1 句打字
  win.advanceDialog(); // 切入第 2 句（branch 回退）
  const branchVid = VE.getCurrentVoiceId();
  const branchFallbackPlayed = VE.isPlaying() && branchVid === testBranchKey;
  ok('显式 MONO 单人独白与支线 inter__branch__* 回退均精准命中并起播',
    monoPlayed && branchFallbackPlayed,
    `mono=${monoPlayed} (${monoVid}), branch=${branchFallbackPlayed} (${branchVid})`);

  // Skip 禁播且立即止音
  win.__runScene('s_test_voice');
  const playingBeforeSkip = VE.isPlaying();
  VN.markLineRead('s_test_voice', testStoryText);
  VN.markLineRead('s_test_voice', testStoryText2);
  VN.setSkipMode(true);
  const stoppedOnSkip = VE.isPlaying() === false;
  const blockedDuringSkip = VE.playStoryLine({ sceneId: 's_test_voice', charId: 'beatrice', text: testStoryText2 }) === false;
  VN.setSkipMode(false);
  ok('Skip 模式激活立即止音，且 Skip 期间禁止起播剧情语音',
    playingBeforeSkip && stoppedOnSkip && blockedDuringSkip,
    `before=${playingBeforeSkip}, stopped=${stoppedOnSkip}, blocked=${blockedDuringSkip}`);

  // Backlog 保存 voiceId 并渲染内联 .vb-voice-btn
  const bl = VN.getBacklog();
  const hasVoiceIdInBacklog = bl.some((it) => it.voiceId === testStoryKey);
  const blOv = VN.openBacklogModal();
  const vbBtn = blOv ? blOv.querySelector(`.vb-voice-btn[data-vb-voice="${testStoryKey}"]`) : null;
  if (vbBtn) vbBtn.click();
  const backlogReplayed = VE.isPlaying() && VE.getCurrentVoiceId() === testStoryKey;
  VN.closeBacklogModal();
  VE.stop({ clearCurrent: true, immediateDuck: true });
  ok('Backlog 保存 voiceId，openBacklogModal() 渲染 .vb-voice-btn 且点击可重听原句',
    hasVoiceIdInBacklog && !!vbBtn && backlogReplayed,
    `saved=${hasVoiceIdInBacklog}, btn=${!!vbBtn}, played=${backlogReplayed}`);

  // 验证 roam_greet 剥离地点详情后缀 + RaisingHub 点触与送礼互动语音
  const firstGiftItemId = (RH && Array.isArray(RH.COZY_SHOP_CATALOG) && RH.COZY_SHOP_CATALOG[0] && RH.COZY_SHOP_CATALOG[0].id) || 'shop_honey_pancake';
  const stHub = Object.assign(win.__getS(), {
    name: '希尔维亚', phase: 'academy', ageY: 12, year: 12, month: 9, season: 2,
    loc: 'dorm', freeRoam: true, gold: 200, flags: { named: 1, ch_academy: 1 },
    cozyBag: { [firstGiftItemId]: 2 }, giftedSeason: {}
  });
  win.__setS(stHub);
  if (typeof win.enterFreeRoam === 'function') win.enterFreeRoam();
  let tapCalledWith = null;
  let giftCalledWith = null;
  let greetCalledWith = null;
  const origPlayInter = VE.playInteractive;
  VE.playInteractive = function (kind, charId, text, opts) {
    if (kind === 'tap') tapCalledWith = { kind, charId, text };
    if (kind === 'gift') giftCalledWith = { kind, charId, text };
    if (kind === 'roam_greet') greetCalledWith = { kind, charId, text };
    return origPlayInter.call(this, kind, charId, text, opts);
  };
  const tapRes = RH && typeof RH.tapSylvia === 'function' ? RH.tapSylvia() : null;
  const giftRes = RH && typeof RH.giftItemToChar === 'function' ? RH.giftItemToChar(firstGiftItemId, 'beatrice', stHub) : null;
  if (typeof win.showRoamGreeting === 'function') {
    win.showRoamGreeting('emma', 'dorm');
  }
  VE.playInteractive = origPlayInter;
  const pureGreetOk = !!(greetCalledWith && greetCalledWith.charId === 'emma' && greetCalledWith.text === '希尔维亚！你也在这里！');
  ok('RaisingHub.tapSylvia / giftItemToChar 与 roam_greet 纯前缀精准触发 playInteractive',
    !!(tapRes && tapCalledWith && tapCalledWith.charId === 'sylvia' && tapCalledWith.text === tapRes.line)
      && !!(giftRes && giftRes.ok && giftCalledWith && giftCalledWith.charId === 'beatrice' && giftCalledWith.text === giftRes.reaction)
      && pureGreetOk,
    `tap=${JSON.stringify(tapCalledWith)}, gift=${JSON.stringify(giftCalledWith)}, greet=${JSON.stringify(greetCalledWith)}`);

  // =========================================================================
  // 7. 战斗 headless 拦截与 54 项 SSOT 战斗语音锚点 cue 派发校验
  // =========================================================================
  console.log('\n[7/7] 战斗 headless 拦截与 SSOT 全黄金锚点 cue 派发');
  const combatCues = [];
  const onCombatVoice = (ev) => combatCues.push(ev.detail && ev.detail.cueKey);
  win.addEventListener('combat:voice', onCombatVoice);

  const bHeadless = CE.startStage('beatrice_11', { headless: true, usePreset: true });
  CE.setOvercastPct(0.40, bHeadless);
  CE.useSkill('ice_1_crystal', 0, bHeadless);
  CE.endTurn(bHeadless);
  const headlessZeroCues = combatCues.length === 0 && !VE.isPlaying();
  ok('headless 战斗严格拦截所有 combat:voice 事件与 VoiceEngine 播放',
    headlessZeroCues,
    `cues=${JSON.stringify(combatCues)}`);

  combatCues.length = 0;
  testEntries['combat__skill_path_HAND'] = { path: 'assets/voice/combat/combat__skill_path_HAND.mp3', charId: 'sylvia' };
  testEntries['combat__one_more'] = { path: 'assets/voice/combat/combat__one_more.mp3', charId: 'sylvia' };

  // 验证 5 幕 SSOT 开场原话 cueKey
  CE.startStage('beatrice_11', { headless: false, usePreset: true });
  CE.startStage('rowan_graveyard', { headless: false, usePreset: true });
  const bAino = CE.startStage('aino_sparring', { headless: false, usePreset: true });
  // 艾诺薄冰镜挡招 -> boss_aino_block
  bAino.ap = 3;
  bAino.player.mp = bAino.player.mmp;
  bAino.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '直刺寒枪', dmg: 35, elem: 'ice' };
  CE.useSkill('ice_2_prism', 0, bAino);
  // 镜霜壁反刺开窗 + ice_2_prism 三击认输 -> boss_aino_surrender
  CE.useSkill('shield_2_mirror', 0, bAino);
  CE.endTurn(bAino);
  bAino.playerHits = 2;
  bAino.ap = 3;
  bAino.player.mp = bAino.player.mmp;
  CE.useSkill('ice_2_prism', 0, bAino);

  const bLive = CE.startStage('noelle_14', { headless: false, usePreset: true });
  // 增幅防抖：升阶触发 + 650ms 冷却 + 降阶不触发
  CE.setOvercastPct(0.20, bLive);
  CE.setOvercastPct(0.40, bLive);
  bLive._lastAmpVoiceTs = Date.now() - 800;
  CE.setOvercastPct(0.60, bLive);
  bLive._lastAmpVoiceTs = Date.now() - 800;
  CE.setOvercastPct(0.20, bLive);
  const ampCues = combatCues.filter((c) => c && c.startsWith('amp_tier_'));
  const ampOk = ampCues.length === 2 && ampCues[0] === 'amp_tier_1' && ampCues[1] === 'amp_tier_3';

  bLive.player.hasEclipseWand = true;
  CE.toggleEclipseWand(true, bLive);
  CE.toggleEclipseWand(false, bLive);

  bLive.player.bondAssist = 'alice';
  bLive.player.bondAssistUsed = false;
  CE.useBondAssist(bLive);

  // skill_path_HAND 回退（V3.2 三棱冰晶）
  bLive.ap = 3;
  bLive.player.mp = bLive.player.mmp;
  bLive.enemies[0].locks = 5;
  bLive.enemies[0].shield = 0;
  bLive.enemies[0].hp = 900;
  CE.setOvercastPct(0, bLive, { silent: true });
  CE.useSkill('ice_2_prism', 0, bLive);

  // dodge / shield_block / player_hit / player_hit_heavy
  bLive.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '测试水击', dmg: 30, elem: 'water' };
  bLive.player.status.afterimage = 1;
  CE.endTurn(bLive);

  bLive.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '测试水击', dmg: 20, elem: 'water' };
  bLive.player.shield = 200;
  bLive.player.shieldKind = 'solid';
  CE.endTurn(bLive);

  bLive.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '轻击', dmg: 20, elem: 'water' };
  bLive.player.shield = 0;
  bLive.player.hp = 300;
  bLive.player.mhp = 300;
  CE.endTurn(bLive);

  bLive.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '重击', dmg: 120, elem: 'water' };
  bLive.player.shield = 0;
  bLive.player.hp = 300;
  CE.endTurn(bLive);

  // 爱丽丝开场 + 认输 (boss_alice_intro / boss_alice_surrender)
  const bAlice = CE.startStage('alice_9', { headless: false, usePreset: true });
  bAlice.enemies[0].mp = 0;
  bAlice.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '风岚聚势', dmg: 40, elem: 'wind', mpCost: 20, selfFizzleIfLowMp: true };
  CE.endTurn(bAlice);

  // 东翼二阶段 (boss_eastwing_phase2)
  const bEast = CE.startStage('turning_point_corridor', { headless: false, usePreset: true });
  const eastBoss = bEast.enemies.find((e) => e.aiType === 'eastwing_boss')
    || { id: 'eastwing_commander', aiType: 'eastwing_boss', name: '东翼封锁官', boss: true, phase: 1, mhp: 620, hp: 310, shield: 0, status: {} };
  CE.triggerBossPhase2(bEast, eastBoss);

  // 风神开场 + 二阶段 (<=55%) + 寒锋斩迎击闪反 + 战败 (boss_fengshen_intro / boss_fengshen_phase2 / parry / defeat)
  const bWind = CE.startStage('wind_god_eye', { headless: false, usePreset: true });
  bWind.enemies[0].shield = 0;
  bWind.enemies[0].evadeCharges = 0;
  bWind.enemies[0].hp = Math.floor(bWind.enemies[0].mhp * 0.55) + 5;
  bWind.ap = 3;
  CE.useSkill('ice_3_starfrost', 0, bWind);
  // 清除二阶段觉醒缓冲以测试寒锋斩迎击闪反与战败语音
  bWind.enemies[0].status.stagger = 0;
  bWind.enemies[0].evadeCharges = 0;
  bWind.enemies[0].intent = { stance: 'CLOSE_LUNGE', moveName: '真空连刃', dmg: 50, elem: 'wind', tempestVacuum: true };
  bWind.ap = 3;
  CE.useSkill('sword_2_cold_edge', 0, bWind);
  bWind.enemies[0].status.stagger = 0;
  bWind.player.shield = 0;
  bWind.player.hp = 1;
  bWind.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '终结风暴', dmg: 200, elem: 'wind' };
  CE.endTurn(bWind);

  // 赫兰峡谷：interrupt + one_more + aino_spear
  const bHulan = CE.startStage('hulan_beast_tide', { headless: false, usePreset: true });
  bHulan.enemies[0].intent = { stance: 'DUAL_CAST', moveName: '霜震聚势', dmg: 40, elem: 'earth' };
  bHulan.enemies[0].locks = 1;
  bHulan.ainoResonance = 1;
  bHulan.ap = 3;
  CE.useSkill('ice_3_starfrost', 0, bHulan);

  CE.exitBattle(false, { silent: true });
  win.removeEventListener('combat:voice', onCombatVoice);
  win.VOICE_MANIFEST.entries = origEntries;
  VE.stop({ clearCurrent: true, immediateDuck: true });

  const requiredCues = [
    'boss_beatrice_intro',
    'reno_graveyard_start',
    'boss_aino_intro',
    'boss_aino_block',
    'boss_aino_surrender',
    'boss_alice_intro',
    'boss_alice_surrender',
    'boss_eastwing_phase2',
    'boss_fengshen_intro',
    'boss_fengshen_phase2',
    'eclipse_wand',
    'bond_assist_alice',
    'skill_path_HAND',
    'dodge',
    'shield_block',
    'player_hit',
    'player_hit_heavy',
    'parry',
    'defeat',
    'interrupt',
    'one_more',
    'aino_spear',
  ];
  const missingCues = requiredCues.filter((c) => !combatCues.includes(c));
  const hasVictoryCue = combatCues.includes('victory') || combatCues.includes('victory_s');

  // 与 casting_fish_audio.json 54 项 combatCueKeys 交叉核验（V3.2 全部 15 招经 resolveSkillVoiceCue 零 404 映射）
  let ssotCombatOk = true;
  let ssotCombatDetail = '';
  const castingPath = path.join(ROOT, 'tools', 'voice', 'casting_fish_audio.json');
  if (fs.existsSync(castingPath)) {
    const casting = JSON.parse(fs.readFileSync(castingPath, 'utf8'));
    const allSsotKeys = [
      ...(casting.combatCueKeys.bondAssists || []),
      ...(casting.combatCueKeys.bossQuotes || []),
      ...(casting.combatCueKeys.allyCues || []),
      ...(casting.combatCueKeys.sylviaSystem || []),
      ...(casting.combatCueKeys.sylviaSkills || []),
    ];
    const skillIds = Object.keys(CE.SKILLS || {});
    const unmappedSkills = skillIds.filter((sid) => !allSsotKeys.includes(CE.resolveSkillVoiceCue(sid)));
    const skillsOk = skillIds.length === 15
      && typeof CE.resolveSkillVoiceCue === 'function'
      && unmappedSkills.length === 0;
    ssotCombatOk = allSsotKeys.length === 54 && skillsOk;
    ssotCombatDetail = `ssotCount=${allSsotKeys.length}, skillCount=${skillIds.length}, skillsOk=${skillsOk}${unmappedSkills.length ? ', unmapped=' + JSON.stringify(unmappedSkills) : ''}`;
  }

  ok('战斗全黄金锚点 cue 完整派发且与 casting_fish_audio.json 54 项 SSOT 完全对齐',
    ampOk && missingCues.length === 0 && hasVictoryCue && ssotCombatOk,
    `ampOk=${ampOk}, hasVictory=${hasVictoryCue}, missing=${JSON.stringify(missingCues)}, ${ssotCombatDetail}`);

  console.log(`\nvoice_engine.test.js: ${pass} passed, ${fail} failed`);
  if (errors.length) {
    console.error('Uncaught harness errors:', errors);
  }
  process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
