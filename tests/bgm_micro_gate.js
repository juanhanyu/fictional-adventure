'use strict';
// 回归测试：微服私访(s_micro)从「季度菜单」选择触发时，场景 bgm comedy_medium 必须贯穿，
// 不得被 showChoices 100ms 兜底 enterFreeRoam → 地点推断(peaceful) 覆盖。
// 同时验证：场景 bgm 生效期间 bgmFreeRoam 不得覆盖；场景真正结束进入自由探索后才允许按背景切曲。
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);
let sd=0;
win.setTimeout=(fn)=>{ if(++sd>80000){sd--;return 0;} try{fn();}finally{sd--;} return 0; };
win.setInterval=()=>0;win.clearInterval=()=>0;win.clearTimeout=()=>0;
win.__setTypingDrain();
const vis = id=>{const el=$(id); return el && !el.classList.contains('hidden');};

// 包装 bgmPlayType：引擎函数通过全局对象解析，替换 window 属性即可拦截内部调用
let calls = [];
const orig = win.bgmPlayType;
win.bgmPlayType = function(type, opts){ calls.push(type + (opts && opts.force ? '(force)' : '')); return orig.call(win, type, opts); };

let fail=0;
const ok = (label, cond)=>{ console.log(`  ${cond?'✓':'✗'} ${label}`); if(!cond) fail++; };

// ---------- 前置：8岁6月 自由探索（peaceful 播放中），仅差 ch_micro ----------
win.__resetS();
win.__setS(Object.assign(win.__getS(), {
  ageY: 8, year: 8, month: 6, day: 1, phase: 'youth', loc: 'ownroom', freeRoam: true,
  flags: { named:1, ch_first_word:1, ch_alice_born:1, ch_child_days:1, ch_age4:1, ch_yaoshen:1,
           ch_sisters_grow:1, ch_reno_arrive:1, ch_alice_affinity:1, ch_beatrice_day:1 }
}));
calls=[];
win.updateLocBar();
ok('自由探索 bgm 为地点推断 peaceful', calls.some(c=>c.startsWith('peaceful')));

// ---------- 关键路径：季度菜单选择「进入下个季度」触发 s_micro（带章节卡） ----------
calls=[];
win.eval(`playLines([{text:"这个季度要做什么？", choices:[{text:"进入下个季度", do:function(){ advanceSeason(1); checkStoryGates(); }}]}]);`);
const btn = win.document.querySelector('#choices button');
ok('季度菜单渲染出选项', !!btn);
btn.onclick();
ok('触发后进入 s_micro 场景', win.__getCurrentScene() === 's_micro');
ok('章节卡显示中（等待点击）', vis('card'));
const afterClick = calls.join(',');
ok('场景启动播放 comedy_medium', calls.some(c=>c.startsWith('comedy_medium')));
const peacefulAfterComedy = (()=>{ let sawComedy=false; for(const c of calls){ if(c.startsWith('comedy_medium')) sawComedy=true; else if(sawComedy && c.startsWith('peaceful')) return true; } return false; })();
ok('100ms 兜底未把 comedy_medium 覆盖成 peaceful（核心修复）', !peacefulAfterComedy);

// ---------- 点击章节卡，完整走完场景 ----------
if(vis('card')){ const c=$('card'); if(typeof c.onclick==='function') c.onclick(); }
calls=[];
let guard=0;
while(guard++<40000){
  if(vis('card')){ const c=$('card'); if(typeof c.onclick==='function'){ c.onclick(); continue; } }
  if(win.__drain.length){ win.__drain.shift()(); continue; }
  if(!win.__getS().freeRoam && !win.__getAwaiting() && win.__getCurrentScene()==='s_micro'){ continue; }
  break;
}
ok('场景完整走完并进入自由探索', win.__getS().freeRoam === true);
ok('场景进行期间没有切到 peaceful', !calls.some(c=>c.startsWith('peaceful')));

// ---------- 防御层：场景 bgm 生效期间，bgmFreeRoam 不得覆盖 ----------
win.bgmSceneStart('comedy_medium');            // 场景 bgm 生效
win.__getS().freeRoam = true;                  // 即便 freeRoam 为 true（兜底路径）
calls=[];
win.bgmFreeRoam('bg-img-nursery bg-room', 'youth', 'ownroom');
ok('sceneBgmType 生效时 bgmFreeRoam 不覆盖', calls.length === 0);

// ---------- 场景真正结束：清除场景 bgm，自由探索允许按背景切曲 ----------
win.enterFreeRoam();
calls=[];
win.bgmFreeRoam('bg-img-nursery bg-room', 'youth', 'ownroom');
ok('进入自由探索后允许按背景切换（peaceful）', calls.some(c=>c.startsWith('peaceful')));

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
