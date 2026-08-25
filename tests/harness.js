'use strict';
// jsdom 加载器：把 index.html + js/story.js + game.js 载入同一 window（共享同一 eval 作用域）
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
window.__paginateDialogText=paginateDialogText;
window.__measureDialogRows=measureDialogRows;
window.__dialogMaxRows=dialogMaxRows;
window.__skipType=skipType;
window.__advanceDialog=advanceDialog;
window.__dialogPaging=function(){ return {pages:dialogPages.slice(),index:dialogPageIndex,typing:typing}; };
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

try { win.eval(storyJs + '\n' + gameJs + '\n' + hooks); }
catch (e) { errors.push('[eval combined] ' + (e && e.stack || e)); }

module.exports = { dom, win, errors, logs };
