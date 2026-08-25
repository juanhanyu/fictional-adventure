'use strict';
// jsdom 加载器：把 index.html + js/story.js + game.js 载入同一 window（共享同一全局作用域）
//
// 【加载方式说明（永久）】每个文件必须作为**独立的内联 <script> 依次注入**，
// 绝不能把多个文件拼接成一次 win.eval() 执行。原因（ECMAScript 作用域规则）：
//   1. eval 程序顶层的 let/const 只存在于该次 eval 自己的词法环境里，
//      后续 win.eval(...) 根本看不到（game.js 的 show/lineCB/typing 等都是 let/const）。
//      之前拼接加载时，ui_changes.js 里 win.eval("show('card',0)") 报
//      "show is not defined"、win.eval('lineCB===null') 恒为 false，就是这个原因。
//   2. 拼接后 game.js 顶部的 'use strict' 不再位于程序首行，整个引擎在测试里
//      退化为非严格模式，与浏览器（每个 <script> 独立、各自严格）不一致。
// 独立 <script> 注入后：顶层 let/const 进入共享的全局词法环境（后续脚本与
// win.eval 均可见），且各文件保留各自的严格模式——与真实浏览器完全一致。
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const storyJs = fs.readFileSync(path.join(ROOT, 'js', 'story.js'), 'utf8');
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

const errors = [];
const logs = [];
const vc = new (require('jsdom').VirtualConsole)();
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
vc.on('jsdomError', (...a) => errors.push('[jsdom] ' + a.map(String).join(' ')));
vc.on('warn', (...a) => logs.push('[warn] ' + a.map(String).join(' ')));

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

const win = dom.window;

// 【测试确定性（永久）】引擎大量依赖 Math.random（whoIsHere 的季度随机布位、
// 比试暴击/伤害浮动、修炼知识成长等）。不加种子时测试结果随进程随机波动——
// 实测同一份代码一次通过、十次里九次失败（问候是否弹出取决于随机布位）。
// 这里用固定种子的 mulberry32 PRNG 替换 window.Math.random，保证整套测试可复现。
// 换种子需全量跑一遍 npm test 确认全绿；也可用 TEST_RNG_SEED 环境变量临时换种子。
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNG_SEED = Number(process.env.TEST_RNG_SEED) || 20260825;
win.Math.random = mulberry32(RNG_SEED);
// 需要随机多样性的测试可自行重播种（如逐种子扫描 flaky 用例）
win.__reseed = (n) => { win.Math.random = mulberry32((n >>> 0) || 1); };

if (!win.AudioContext) {
  win.AudioContext = class {
    constructor(){ this.currentTime = 0; this.destination = null; }
    createOscillator(){ return { connect(){}, start(){}, stop(){}, frequency: { value: 0 } }; }
    createGain(){ return { connect(){}, gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} } }; }
  };
}

// 测试钩子（追加到合并脚本末尾，与 story.js/game.js 共享作用域）
const hooks = `
window.__CHARS=CHARS;
window.__LOCS=LOCS;
window.__PORTRAIT_FILES=PORTRAIT_FILES;
window.__CSS_CHARS=CSS_CHARS;
window.__ALL_PICKS=ALL_PICKS;
window.__COURSES=COURSES;
window.__STORY_CHAPTERS=STORY_CHAPTERS;
window.__origTypeText=typeText;
window.__setTypingStub=function(m){ if(m){ typeText=function(str,cb){ if(typeof cb==="function") cb(); }; } else { typeText=window.__origTypeText; } };
window.__setTypingDrain=function(){ window.__drain=[]; typeText=function(str,cb){ if(typeof cb==="function") window.__drain.push(cb); }; };
window.__setTypingSync=function(){ typeText=function(str,cb){ if(typeof cb==="function") cb(); }; };
window.__restoreTyping=function(){ typeText=window.__origTypeText; };
window.__resetS=function(){ S=baseState(); };
window.__getS=function(){ return S; };
window.__setS=function(s){ S=s; };
window.__getAwaiting=function(){ return awaitingChoice; };
window.__getCurrentScene=function(){ return currentScene; };
window.__getStoryChain=function(){ return storyChain; };
window.__runScene=function(id){ return runScene(id); };
window.__newGame=function(){ return newGame(); };
window.__captureSysPopup=function(){ const orig=sysPopup; window.__capturedPopups=[]; sysPopup=function(title,body){ window.__capturedPopups.push({title:String(title),body:String(body)}); return orig(title,body); }; };
window.__resetSysPopup=function(){ window.__capturedPopups=[]; };
`;

// 依次注入独立 <script>（jsdom 对内联脚本同步执行；顺序 = index.html 的加载顺序）
function injectScript(label, code) {
  try {
    const el = win.document.createElement('script');
    el.textContent = code;
    win.document.body.appendChild(el);
  } catch (e) {
    errors.push('[script ' + label + '] ' + (e && e.stack || e));
  }
}
injectScript('story.js', storyJs);
injectScript('game.js', gameJs);
injectScript('test-hooks', hooks);

module.exports = { dom, win, errors, logs };
