'use strict';
// 运行时冒烟测试：逐场景同步播放 lines，触发 do/if/效果副作用，捕捉崩溃
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);

let syncDepth = 0;
win.setTimeout = (fn)=>{ if(++syncDepth>20000){ syncDepth--; return 0; } try{ fn(); } finally{ syncDepth--; } return 0; };
win.setInterval = ()=>0; win.clearInterval = ()=>0; win.clearTimeout = ()=>0;
win.__setTypingStub(true);

const crashed = [], interactive = [];
const OVERLAYS = ['pick-screen','battle-screen','duel-screen','card','panel','map-overlay','stats-overlay'];
function hideAll(){ OVERLAYS.forEach(id=>{ const el=$(id); if(el) el.classList.add('hidden'); }); $('choices').innerHTML=''; }
function vis(id){ const el=$(id); return el && !el.classList.contains('hidden'); }

function driveScene(id){
  hideAll();
  try {
    win.__resetS();
    win.__runScene(id);
    for(let g=0; g<10; g++){ if(vis('card')){ $('card').onclick && $('card').onclick(); continue; } break; }
    if(vis('pick-screen')) interactive.push([id,'PICK']);
    else if(vis('battle-screen')) interactive.push([id,'BATTLE']);
    else if(vis('duel-screen')) interactive.push([id,'DUEL']);
    else if(win.__getAwaiting() || $('choices').children.length) interactive.push([id,'CHOICE']);
    else if(win.__getS().freeRoam) interactive.push([id,'freeRoam']);
    else interactive.push([id,'end']);
  } catch(e){
    crashed.push([id, (e && e.stack) || e]);
  }
}

const SCENES = win.SCENES || win.__SCENES;
Object.keys(SCENES).forEach(driveScene);

const byType = {};
interactive.forEach(([id,t])=> byType[t]=(byType[t]||0)+1);
console.log('\n===== 运行时冒烟测试 =====');
console.log('场景总数:', Object.keys(SCENES).length, '| 崩溃:', crashed.length, '| 落点:', JSON.stringify(byType));
crashed.forEach(([id,msg])=>{ console.log(`  ✗ ${id}: ${String(msg).split('\n')[0]}`); });
if(h.errors.length){ console.log('jsdom 报错:'); h.errors.forEach(e=>console.log('  [err]', e.split('\n')[0])); }
module.exports = { crashed, interactive };
