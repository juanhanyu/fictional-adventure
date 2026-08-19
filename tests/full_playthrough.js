'use strict';
// 全时间线通关模拟：从出生起逐季度推进时间并触发门控，验证整部故事能走通、无崩溃无卡死
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);
let sd=0;
win.setTimeout=(fn)=>{ if(++sd>200000){sd--;return 0;} try{fn();}finally{sd--;} return 0; };
win.setInterval=()=>0;win.clearInterval=()=>0;win.clearTimeout=()=>0;
win.__setTypingDrain();
const vis = id=>{const el=$(id); return el && !el.classList.contains('hidden');};
const MONTH_BY_Q=[3,6,9,12];

function drive(){
  const played=[]; let last=null;
  const rec=()=>{ const cs=win.__getCurrentScene(); if(cs&&cs!==last){played.push(cs); last=cs;} };
  for(let i=0;i<40000;i++){
    rec();
    if(vis('cg-screen')){ const c=$('cg-screen'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
    if(vis('card')){ const c=$('card'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
    if(win.__drain.length){ win.__drain.shift()(); continue; }
    const chain=win.__getStoryChain();
    if(!chain){ rec(); break; }
    if(win.__getAwaiting() || vis('pick-screen') || vis('battle-screen') || win.__getS().freeRoam){ break; }
  }
  return played;
}

win.__resetS();
const allPlayed=[];
let err=null, stuckQ=0;
outer:
for(let year=0; year<=20 && !err; year++){
  for(let q=0; q<4; q++){
    const s=win.__getS();
    s.year=year; s.month=MONTH_BY_Q[q]; s.day=1; s.tod=1;
    s.ageY = Math.max(s.ageY, year===0?0: year); // 粗略年龄（出生年=0）
    s.dayCount = Math.max(s.dayCount, year*365); // 让旅途篇 dayCount 门控可触发
    win.__drain.length=0;
    try { if(win.checkStoryGates()) allPlayed.push(...drive()); }
    catch(e){ err=(e&&e.stack)||e; break outer; }
  }
}

const unique=[...new Set(allPlayed)];
console.log('\n===== 全时间线通关模拟（0→17岁） =====');
if(err){ console.log('  ✗ 崩溃:', String(err).split('\n')[0]); }
else {
  console.log(`  无崩溃。触发并播放场景 ${unique.length} 个，总行推进 ${allPlayed.length} 次场景切换`);
  console.log('  场景轨迹:', unique.join('>'));
}
