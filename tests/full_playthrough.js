'use strict';
// 全时间线通关模拟：从出生起逐季度推进时间并触发门控（含选卡/选项/战斗自动交互），验证整部故事 0→17 岁完整走通
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
  for(let i=0;i<60000;i++){
    rec();
    if(vis('cg-screen')){ const c=$('cg-screen'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
    if(vis('card')){ const c=$('card'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
    if(vis('pick-screen')){
      const card = win.document.querySelector('#pick-grid .pick-card:not(.disabled)');
      if(card && typeof card.onclick==='function'){ card.onclick(); continue; }
    }
    if(vis('battle-screen')){
      const doneBtn = $('cr-done');
      if(doneBtn){ doneBtn.click(); continue; }
      const skBtn = win.document.querySelector('#b-actions .cb-skill-card:not(:disabled), #b-actions .choice:not(:disabled)');
      if(skBtn){ skBtn.click(); continue; }
      const endBtn = $('cb-btn-endturn');
      if(endBtn){ endBtn.click(); continue; }
    }
    const chBox = $('choices');
    if((win.__getAwaiting() || (chBox && chBox.children.length)) && chBox){
      const cbtn = chBox.querySelector('.choice:not(:disabled)');
      if(cbtn && typeof cbtn.onclick==='function'){ cbtn.onclick(); continue; }
    }
    if(win.__drain.length){ win.__drain.shift()(); continue; }
    const chain=win.__getStoryChain();
    if(!chain){ rec(); break; }
    if(win.__getS().freeRoam){ break; }
  }
  return played;
}

win.__resetS();
const allPlayed=[];
let err=null;
outer:
for(let year=0; year<=18 && !err; year++){
  for(let q=0; q<4; q++){
    const s=win.__getS();
    s.year=year; s.month=MONTH_BY_Q[q]; s.day=1; s.tod=1; s.season=q;
    s.ageY = Math.max(s.ageY, year===0?0: year);
    s.dayCount = Math.max(s.dayCount, year*365);
    win.__drain.length=0;
    try { if(win.checkStoryGates()) allPlayed.push(...drive()); }
    catch(e){ err=(e&&e.stack)||e; break outer; }
  }
}

const unique=[...new Set(allPlayed)];
console.log('\n===== 全时间线通关模拟（0→17岁） =====');
let fail = 0;
if(err){
  console.log('  ✗ 崩溃:', String(err).split('\n')[0]);
  fail++;
} else {
  console.log(`  无崩溃。触发并播放场景 ${unique.length} 个，总行推进 ${allPlayed.length} 次场景切换`);
  console.log('  场景轨迹:', unique.join('>'));
  const mustReach = [
    's_first_word','s_child_days','s_academy_start','s_turnpoint',
    's_black_name','s_jikan_arrive','s_north_forest','s_glow_sheep',
    's_distant_wind_1','s_words_to_wind','s_eye_of_storm','s_leaky_cup','s_distant_wind_2'
  ];
  const missing = mustReach.filter(id => !unique.includes(id));
  if(missing.length){
    console.log('  ✗ 通关轨迹缺失关键场景:', missing.join(','));
    fail++;
  } else {
    console.log('  ✓ 童年期 → 学院篇 → 第三卷冰封峡谷全链路无卡死走通');
  }
}
process.exit(fail ? 1 : 0);
