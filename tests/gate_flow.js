'use strict';
// 门控流程集成测试：模拟特定时间/flag 触发门控，用「逐行排空」异步驱动验证场景按序完整播放
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);
let sd=0;
win.setTimeout=(fn)=>{ if(++sd>80000){sd--;return 0;} try{fn();}finally{sd--;} return 0; };
win.setInterval=()=>0;win.clearInterval=()=>0;win.clearTimeout=()=>0;
win.__setTypingDrain(); // 打字机改为入队，逐行推进（模拟真实异步时序）
const vis = id=>{const el=$(id); return el && !el.classList.contains('hidden');};

const PRE_FLAGS = {
  ch_first_word:1, ch_alice_born:1, ch_child_days:1, ch_age4:1,
  ch_yaoshen:1, ch_sisters_grow:1, ch_reno_arrive:1, ch_alice_affinity:1,
  ch_beatrice_day:1, ch_micro:1, ch_vampire_interlude:1, ch_beatrice_leaves:1,
};

// 驱动器：逐行推进 + 点卡片，返回按序播放的场景列表
function drive(){
  const played = [];
  let last = null;
  const record = ()=>{ const cs = win.__getCurrentScene(); if(cs && cs!==last){ played.push(cs); last = cs; } };
  for(let i=0;i<30000;i++){
    record();
    if(vis('card')){ const c=$('card'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
    if(win.__drain.length){ win.__drain.shift()(); continue; }
    const chain = win.__getStoryChain();
    if(!chain){ record(); break; }
    // 卡在交互（选择/选卡/战斗/自由行动）
    if(win.__getAwaiting() || vis('pick-screen') || vis('battle-screen') || win.__getS().freeRoam){ break; }
  }
  return played;
}

function runCase(label, ageY, year, month, phase, extraFlags, expect){
  win.__resetS();
  const s = win.__getS();
  Object.assign(s, {ageY, year, month, day:1, phase, tod:1});
  Object.assign(s.flags, PRE_FLAGS, extraFlags || {});
  win.__drain.length = 0;
  let played = [];
  let crashed = null;
  try { win.checkStoryGates(); played = drive(); }
  catch(e){ crashed = (e && e.stack) || e; }
  if(crashed){ console.log(`  ✗ ${label}: 崩溃 ${String(crashed).split('\n')[0]}`); return false; }
  const seen = [...new Set(played)];
  const ok = expect.every(id=> seen.includes(id));
  console.log(`  ${ok?'✓':'✗'} ${label}: 轨迹=[${seen.join('>')}]${ok?'':'  (缺失: '+expect.filter(id=>!seen.includes(id)).join(',')+')'}`);
  return ok;
}

let fail=0;
console.log('\n===== 门控流程集成测试（异步驱动·完整播放） =====');
if(!runCase('12岁春·学院门控(5场景)', 12,12,3,'youth', {}, ['s_academy_start','s_opening_ceremony','s_noelle_meet','s_aino_meet','s_charlotte_meet'])) fail++;
if(!runCase('14岁3月·冰融下', 14,14,3,'academy', {ch_academy:1,ch_opening_ceremony:1,met_noelle:1,met_aino:1,met_charlotte:1,ch_helena:1,ch_aino_sparring:1,met_ajun:1,ch_ice_melt_1:1,ch_beach:1,ch_tree:1,ch_star:1}, ['s_ice_melt_2'])) fail++;
if(!runCase('15岁12月·转折点一', 15,15,12,'academy', {ch_academy:1,ch_opening_ceremony:1,met_noelle:1,met_aino:1,met_charlotte:1,ch_helena:1,ch_aino_sparring:1,met_ajun:1,ch_ice_melt_1:1,ch_ice_melt_2:1,ch_beach:1,ch_tree:1,ch_star:1}, ['s_turnpoint'])) fail++;
if(!runCase('4岁3月·四岁', 4,4,3,'childhood', {ch_first_word:1,ch_alice_born:1,ch_age4:0}, ['s_age4'])) fail++;
console.log('失败:', fail, '/ 4');
