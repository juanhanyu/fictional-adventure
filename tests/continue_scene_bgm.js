'use strict';
// 中途读档测试：剧情进行中（如微服私访 s_micro，BGM=comedy_medium 滑稽中速）刷新/回标题点「继续存档」
// 必须恢复并重播当前场景（场景 BGM 由 bgmSceneStart 按场景配置重新强制播放），
// 而不是旧行为：剧情被「（读取存档）」行丢弃、BGM 落回地点音乐（ownroom=peaceful）、章节 flag 已置位导致剧情永不重播。
// 覆盖：①独立场景恢复（s_micro）②多场景队列恢复（当前场景重播 + 后续队列衔接）③自由探索存档不受影响
// 驱动方式与 gate_flow 一致：typeText 回调入队（__setTypingDrain 式），逐行推进，避免同步桩的卡片事件竞争。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const storyJs = fs.readFileSync(path.join(ROOT, 'js', 'story.js'), 'utf8');
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
vc.on('jsdomError', (...a) => errors.push('[jsdom] ' + a.map(String).join(' ')));

const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const win = dom.window;
if (!win.AudioContext) {
  win.AudioContext = class {
    constructor(){ this.currentTime = 0; this.destination = null; }
    createOscillator(){ return { connect(){}, start(){}, stop(){}, frequency: { value: 0 } }; }
    createGain(){ return { connect(){}, gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} } }; }
  };
}

const srcLog = [];
Object.defineProperty(win.HTMLMediaElement.prototype, 'src', {
  get(){ return this.getAttribute('src') || ''; },
  set(v){ srcLog.push(decodeURIComponent(String(v).split('/').pop())); this.setAttribute('src', v); },
  configurable: true,
});
win.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
win.HTMLMediaElement.prototype.pause = function(){};
win.HTMLMediaElement.prototype.load = function(){};

const hooks = `
window.__drain=[];
typeText=function(str,cb){ if(typeof cb==="function") window.__drain.push(cb); }; // 逐行推进（模拟真实异步点击）
window.__resetS=function(){ S=baseState(); };
window.__continueGame=function(){ return continueGame(); };
window.__getS=function(){ return S; };
window.__flag=function(f,v){ flag(f,v); };
window.__getScene=function(){ return currentScene; };
window.__getChain=function(){ return storyChain; };
window.__bgmState=function(){ return { bgmKey, bgmCurType, bgmLoc, sceneBgmType }; };
window.__save=function(){ return save(); };
window.__enterFreeRoam=function(){ return enterFreeRoam(); };
window.__advanceSeason=function(n){ advanceSeason(n); };
window.__checkGates=function(){ return checkStoryGates(); };
window.__click=function(sel){ const el=document.querySelector(sel); if(el){ el.click(); return true; } return false; };
`;
try { win.eval(storyJs + '\n' + gameJs + '\n' + hooks); }
catch (e) { errors.push('[eval] ' + (e && e.stack || e)); }

let fail = 0;
const ok = (l, c) => { console.log(`  ${c ? '✓' : '✗'} ${l}`); if (!c) fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (id) => win.document.getElementById(id);
const cardVisible = () => { const c = $('card'); return c && !c.classList.contains('hidden'); };

// 驱动：逐行排空 + 自动点章节卡，直到自由探索或耗尽迭代
function drive(maxIter = 30000){
  for (let i = 0; i < maxIter; i++) {
    const c = $('card');
    if (c && !c.classList.contains('hidden') && typeof c.onclick === 'function') { c.onclick(); continue; }
    if (win.__drain.length) { win.__drain.shift()(); continue; }
    break;
  }
}

(async () => {
  win.__resetS();
  let S = win.__getS();
  // 前置章节全部完成，只留 s_micro（8年6月）待触发
  ['ch_first_word','ch_alice_born','ch_child_days','ch_age4','ch_yaoshen','ch_sisters_grow','ch_reno_arrive','ch_alice_affinity','ch_beatrice_day'].forEach(f => win.__flag(f, 1));
  S.ageY = 8; S.year = 8; S.month = 5; S.day = 1; S.season = 0; S.phase = 'youth';
  S.loc = 'ownroom'; S.lastSafe = 'ownroom'; S.freeRoam = true;
  win.__enterFreeRoam();

  // ===== ① 独立场景：微服私访剧情中途读档 =====
  win.__advanceSeason(1);           // 8年6月
  win.__checkGates();               // 触发 s_micro（停在章节卡，未播台词）
  S = win.__getS();
  ok('门控触发 s_micro', win.__getScene() === 's_micro');
  ok('场景 BGM 记录为 comedy_medium（滑稽中速）', win.__bgmState().sceneBgmType === 'comedy_medium');
  ok('存档记录进行中场景（scene/ch_micro）', S.scene === 's_micro' && S.flags['ch_micro'] === 1);
  await sleep(700);                 // 等淡出→换曲完成
  ok('audio src 已设为 Comical_medium-speed.mp3', srcLog.includes('Comical_medium-speed.mp3'));

  // 模拟刷新/回标题后点「继续存档」（load() 读 localStorage 存档）
  win.__continueGame();
  S = win.__getS();
  ok('继续后剧情未被丢弃（仍在剧情中）', S.freeRoam === false && win.__getScene() === 's_micro');
  ok('继续后场景 BGM 恢复为 comedy_medium', win.__bgmState().sceneBgmType === 'comedy_medium' && win.__bgmState().bgmKey === 'comedy_medium');
  ok('章节卡出现（场景正在重播）', cardVisible());

  drive();                          // 重播整场（逐行推进）→ 播完回自由探索
  S = win.__getS();
  ok('重播的剧情播完且未卡死', S.freeRoam === true);
  ok('剧情结束后进行中记录已清除', S.scene === null && S.queue === null);
  ok('自由探索 BGM 回到地点音乐（dining=cheerful）', win.__bgmState().bgmCurType === 'cheerful');

  // ===== ② 多场景队列：队列中途读档，当前场景重播 + 后续队列衔接 =====
  win.__drain.length = 0;
  S.ageY = 8; S.year = 8; S.month = 6; S.day = 1; S.season = 1; S.phase = 'youth';
  S.loc = 'ownroom'; S.freeRoam = true;
  win.__enterFreeRoam();
  // 构造「队列 [s_beatrice_day, s_micro, s_alice_wind_teach] 播到 s_micro 时」的存档
  S.freeRoam = false; S.scene = 's_micro'; S.queue = ['s_beatrice_day','s_micro','s_alice_wind_teach']; S.qidx = 2;
  win.__flag('ch_beatrice_day', 1); win.__flag('ch_micro', 1); win.__flag('ch_alice_wind', 1);
  win.__save();
  win.__continueGame();
  S = win.__getS();
  ok('队列存档：当前场景 s_micro 被恢复重播', win.__getScene() === 's_micro' && S.freeRoam === false);
  const chain = win.__getChain();
  ok('队列被重建（含后续场景）', !!chain && chain.queue.length === 3 && chain.idx === 2);
  ok('恢复后场景 BGM 仍为 comedy_medium', win.__bgmState().sceneBgmType === 'comedy_medium');
  drive();                          // s_micro 播完 → 自动衔接 s_alice_wind_teach → 播完 → 队列耗尽
  S = win.__getS();
  ok('队列全部播完（最后停在 s_alice_wind_teach）', win.__getScene() === 's_alice_wind_teach');
  ok('队列耗尽后进入自由探索', S.freeRoam === true);
  ok('队列耗尽后进行中记录已清除', S.scene === null && S.queue === null && !win.__getChain());

  // ===== ③ 回归：自由探索存档继续 → 正常进自由探索（不误恢复剧情）=====
  win.__drain.length = 0;
  S.freeRoam = true; S.scene = null; S.queue = null; S.qidx = null;
  win.__save();
  win.__continueGame();
  S = win.__getS();
  ok('自由探索存档：正常进入自由探索', S.freeRoam === true);
  ok('自由探索存档：未误启动剧情（章节卡不出现）', !cardVisible() && S.scene === null);

  ok('页面无 JS 错误', errors.length === 0);
  if (errors.length) errors.forEach(e => console.log('   ', e));
  console.log(fail === 0 ? '\n  ✓ 全部通过' : `\n  ✗ ${fail} 处失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
