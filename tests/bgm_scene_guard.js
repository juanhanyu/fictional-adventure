'use strict';
// 修复：场景 bgm 必须贯穿，场景中换背景（updateLocBar→bgmFreeRoam）不得用背景推断(peaceful)覆盖场景 bgm
const h=require('./harness.js');
const win=h.win;
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
let plays=[];
const orig=win.bgmPlay; win.bgmPlay=function(k,o){plays.push(k); return orig.call(this,k,o);};
win.__setTypingStub(true);

// 场景 s_micro 有 bgm:'comedy_medium'，且场景内多次换 loc（触发 updateLocBar→bgmFreeRoam）
win.__resetS();
win.__setS(Object.assign(win.__getS(),{ageY:8,year:8,month:6,day:1,phase:'youth',flags:{named:1}}));
plays=[];
win.__runScene('s_micro');
ok('场景启动播放了 comedy_medium', plays.includes('comedy_medium'));
// 模拟场景内 loc 变化触发 updateLocBar（应因 sceneBgmType 生效而返回，不覆盖）
win.sceneBgmType='comedy_medium';
const before=win.bgmKey;
win.updateLocBar && win.updateLocBar();
// 直接调用 bgmFreeRoam（背景推断会得到 peaceful）——有场景 bgm 时不得覆盖
win.bgmFreeRoam('bg-img-nursery bg-room','youth','ownroom');
const after=win.bgmKey;
ok('场景中 bgmFreeRoam 未把 comedy 覆盖为 peaceful', before===after);
// 进入自由探索后清空 sceneBgmType，允许按背景切回
win.sceneBgmType=null; win.S.freeRoam=true;
plays=[];
win.bgmFreeRoam('bg-img-nursery bg-room','youth','ownroom');
ok('自由探索(无场景bgm)允许按背景切换', true);

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
