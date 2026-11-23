'use strict';
// 面板一致性测试：剧情里弹出的系统面板必须与右上角面板(statusPanelHTML)实时数值一致
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);
let sd=0;
win.setTimeout=(fn)=>{ if(++sd>80000){sd--;return 0;} try{fn();}finally{sd--;} return 0; };
win.setInterval=()=>0;win.clearInterval=()=>0;win.clearTimeout=()=>0;
win.__setTypingDrain();
const vis = id=>{const el=$(id); return el && !el.classList.contains('hidden');};

let fail = 0;
function check(name, html, key, live){
  const ok = html.includes(key);
  console.log(`  ${ok?'✓':'✗'} ${name}: 期望含「${key}」 (实际${live})`);
  if(!ok) fail++;
}
function checkAbsent(name, html, key){
  const ok = !html.includes(key);
  console.log(`  ${ok?'✓':'✗'} ${name}: 不含「${key}」`);
  if(!ok) fail++;
}

// ---- 单元：statusPanelHTML 精确反映实时 S 状态 ----
win.__resetS();
win.__setS(Object.assign(win.__getS(), {lv:9, exp:123, next:400, hp:50, mhp:60, mp:30, mmp:45, st:7, mst:8, gold:99, atk:12, mag:30, pdef:5, mdef:6, phase:'academy', ageY:12}));
const html = win.statusPanelHTML();
check('等级', html, '<b>等级</b> Lv.9', 'Lv.9');
check('生命', html, '<b>生命</b> 50/60', '50/60');
check('魔力值(MP储备)', html, '<b>魔力值</b> 30/45', '30/45');
check('魔力(魔法攻击)', html, '<b>魔力</b> 30', '30');
check('体力', html, '<b>体力</b> 7/8', '7/8');
check('金币', html, '<b>金币</b> 99', '99');
check('攻击', html, '<b>攻击</b> 12', '12');
check('物抗', html, '<b>物抗</b> 5', '5');
check('法抗', html, '<b>法抗</b> 6', '6');

// ---- 集成：播放 s_child_days，捕获剧情面板，比对实时数值 ----
win.__resetS();
const s = win.__getS();
Object.assign(s, {ageY:4, year:4, month:9, day:1, phase:'childhood', tod:1, lv:7, mhp:40, mmp:60, atk:8, mag:20, pdef:3, mdef:3, exp:88, next:300, hp:40, mp:60});
win.__captureSysPopup();
win.__drain.length = 0;
try { win.__runScene('s_child_days'); } catch(e){ console.log('  ✗ s_child_days 运行崩溃:', String(e.stack||e).split('\n')[0]); fail++; }
for(let i=0;i<6000 && !vis('pick-screen') && !win.__getS().freeRoam;i++){
  if(vis('card')){ const c=$('card'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
  if(win.__drain.length){ win.__drain.shift()(); continue; }
  if(win.__getStoryChain()) continue;
  break;
}
const statusPops = (win.__capturedPopups||[]).filter(p=>/状态面板/.test(p.title));
const now = win.__getS();
console.log('捕获状态面板弹窗数:', statusPops.length, '| 播放时实际状态: Lv.'+now.lv+' 生命'+now.hp+'/'+now.mhp+' 魔力'+now.mp+'/'+now.mmp);
if(!statusPops.length){ console.log('  ✗ 未捕获到状态面板'); fail++; }
else{
  statusPops.forEach((p,i)=>{
    const live = win.statusPanelHTML();
    // 核心字段必须与实时一致
    check(`场景面板[${i}] 等级`, p.body, '<b>等级</b> Lv.'+now.lv, 'Lv.'+now.lv);
    check(`场景面板[${i}] 生命`, p.body, '<b>生命</b> '+now.hp+'/'+now.mhp, now.hp+'/'+now.mhp);
    check(`场景面板[${i}] 魔力值(MP储备)`, p.body, '<b>魔力值</b> '+now.mp+'/'+now.mmp, now.mp+'/'+now.mmp);
    check(`场景面板[${i}] 魔力(魔法攻击)`, p.body, '<b>魔力</b> '+Math.floor(now.mag), String(Math.floor(now.mag)));
    // 必须不再含硬编码旧值
    checkAbsent(`场景面板[${i}] 无硬编码Lv.2`, p.body, 'Lv.2 (升级');
    checkAbsent(`场景面板[${i}] 无硬编码Lv.5`, p.body, '等级：Lv.5');
  });
}

console.log('\n失败:', fail);
process.exit(fail?1:0);
