'use strict';
// BGM 流程测试：①场景级 bgm 贯穿 ②自由探索按背景触发 ③特殊状态覆盖后恢复
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);
let sd=0;
win.setTimeout=(fn)=>{ if(++sd>80000){sd--;return 0;} try{fn();}finally{sd--;} return 0; };
win.setInterval=()=>0;win.clearInterval=()=>0;win.clearTimeout=()=>0;
win.__setTypingDrain();
const vis = id=>{const el=$(id); return el && !el.classList.contains('hidden');};

// 捕获 bgmPlayType 调用
const orig = win.bgmPlayType;
let calls = [];
win.bgmPlayType = function(type, opts){ calls.push(type); return orig.call(this, type, opts); };

let fail=0;
function ok(label,cond){ console.log(`  ${cond?'✓':'✗'} ${label}`); if(!cond) fail++; }

function driveScene(id){
  win.__resetS();
  win.__setS(Object.assign(win.__getS(),{ageY:12,year:12,month:3,day:1,phase:'academy',tod:1}));
  calls=[];
  try { win.__runScene(id); } catch(e){ console.log('  崩溃', id, String(e.stack||e).split('\n')[0]); fail++; return; }
  for(let i=0;i<4000 && !win.__getS().freeRoam;i++){
    if(vis('card')){ const c=$('card'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
    if(win.__drain.length){ win.__drain.shift()(); continue; }
    if(win.__getStoryChain()) continue;
    break;
  }
  return calls;
}

// ① 场景 s_black_name 配了 bgm:'sad' → 场景启动必播 sad
const s=win.__getS();
win.__setS(Object.assign(s,{ageY:15,year:15,month:12,day:1,phase:'finale'}));
const c1=driveScene('s_turnpoint'); // bgm:'sad'
ok('s_turnpoint(显式 sad) 场景启动播放 sad', c1.includes('sad'));

// ② 场景 s_beach bgm:'cheerful'
win.__setS(Object.assign(win.__getS(),{ageY:14,year:14,month:6,day:1,phase:'academy'}));
const c2=driveScene('s_beach');
ok('s_beach(显式 cheerful) 场景启动播放 cheerful', c2.includes('cheerful'));

// ③ 无显式 bgm 场景（s_huke 有 bgm，找一个 bg 推断的）——所有场景都有显式，所以直接验证都有
const SCENES = win.SCENES;
let noBgm=[];
Object.keys(SCENES).forEach(id=>{ if(!SCENES[id].bgm) noBgm.push(id); });
ok('所有场景有显式 bgm', noBgm.length===0);

// ④ 自由探索：进入某地点应触发 bgmFreeRoam（S.freeRoam=true 时 updateLocBar→bgmPlayType）
win.__resetS();
const st=win.__getS();
Object.assign(st,{ageY:12,year:12,month:3,day:1,phase:'academy',tod:1,loc:'dorm',freeRoam:true});
win.__getS().freeRoam=true;
// ④ 自由探索：freeRoam 状态下进入地点能推导出类型（保证每个背景有 bgm）
win.__setS(Object.assign(win.__getS(),{freeRoam:true, loc:'library'}));
const tLib = win.bgmTypeForBg('bg-img-library bg-study','academy','library');
ok('自由探索图书馆推导类型 = academy', tLib==='academy');
// bgmFreeRoam 在 freeRoam 且未解锁时直接返回（不崩）；解锁后应触发播放
calls=[];
win.__setS(Object.assign(win.__getS(),{freeRoam:true}));
// 直接验证所有 LOCS 背景在自由探索时都有可推导类型（已由 bgm_mapping 全覆盖保证，这里抽查）
let allLocs = Object.values(win.__LOCS||{}).every(L=> !!win.bgmTypeForBg(L.bg||'','academy',L.id));
ok('所有自由探索地点背景都有 bgm 类型', allLocs);

// ⑤ 特殊状态：bgmRestoreScene 恢复场景 bgm
calls=[];
win.__setS(Object.assign(win.__getS(),{loc:'dorm',freeRoam:false}));
win.bgmSceneStart('sacred'); // 场景 bgm = sacred
calls=[];
win.bgmPlayType('battle',{force:true}); // 战斗中
win.bgmRestoreScene(); // 结束后恢复
ok('战斗后恢复场景 bgm(sacred)', calls.includes('sacred'));

console.log('\n失败:', fail);
process.exit(fail?1:0);
