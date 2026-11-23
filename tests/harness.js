'use strict';
// jsdom 加载器：以真实浏览器经典 <script> 方式把 index.html + js/story.js + js/story-vol3.js + game.js 载入同一 window
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const rawHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// 移除外链 script 标签，改由下方按顺序注入内联经典脚本，保证顶层 const/let/function 进入全局词法环境
const html = rawHtml.replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/gi, '');

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
if (!win.AudioContext) {
  win.AudioContext = class {
    constructor(){ this.currentTime = 0; this.destination = null; this.state = 'running'; }
    resume(){ return Promise.resolve(); }
    createOscillator(){
      return {
        type: 'sine',
        connect(){}, start(){}, stop(){},
        frequency: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }
      };
    }
    createGain(){
      return {
        connect(){},
        gain: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }
      };
    }
  };
}

// 测试钩子（与 story*.js / game.js 共享全局经典脚本作用域）
const hooks = `
window.__CHARS=CHARS;
window.__LOCS=LOCS;
window.__EXITS=EXITS;
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

function injectClassicScript(code, label){
  try {
    const el = win.document.createElement('script');
    el.textContent = code;
    win.document.body.appendChild(el);
  } catch (e) {
    errors.push(`[script ${label}] ` + (e && e.stack || e));
  }
}

const scriptFiles = [
  'js/story.js',
  'js/story-vol3.js',
  'js/story-vol4.js',
  'js/ai-personas.js',
  'game.js',
  'js/branching-director.js',
  'js/combat-engine.js',
  'js/ai-chat-panel.js',
  'js/relics-and-events.js',
  'js/ambient-fx.js',
  'js/vn-ux.js',
];
for (const rel of scriptFiles) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    injectClassicScript(fs.readFileSync(abs, 'utf8'), rel);
  }
}
injectClassicScript(hooks, 'hooks');

module.exports = { dom, win, errors, logs };
