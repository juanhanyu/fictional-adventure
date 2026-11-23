'use strict';
// 验证七座山剧情能正常触发（13岁12月，academy阶段）
const h=require('./harness.js');
const win=h.win;
win.__setTypingStub(true);
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};

// 场景必须存在
ok('七座山场景存在', !!win.SCENES.s_seven_mountains);

// 13岁12月 academy，前置flag齐全（不含 ch_seven_mountains）→ 应触发
function test(ageY,year,month,phase,preFlags){
  win.__resetS();
  const s=win.__getS();
  Object.assign(s,{ageY,year,month,day:1,phase,tod:1});
  Object.assign(s.flags,{ch_academy:1,ch_opening_ceremony:1,met_noelle:1,met_aino:1,met_charlotte:1,ch_helena:1,ch_aino_sparring:1,met_ajun:1,ch_ice_melt_1:1},preFlags||{});
  win.__setS(s);
  const before = win.__getStoryChain();
  let ret=false; try{ ret=win.checkStoryGates(); }catch(e){ console.log('err',e); }
  const chain=win.__getStoryChain();
  return { ret, queue: chain?chain.queue:[], chainBefore:before };
}

// 13岁12月 应触发
let r=test(13,13,12,'academy',{});
ok('13岁12月 触发七座山', r.ret && r.queue.includes('s_seven_mountains'));

// 已触发过（ch_seven_mountains=1）→ 不再触发
r=test(13,13,12,'academy',{ch_seven_mountains:1});
ok('已触发后不再重复', !r.queue.includes('s_seven_mountains'));

// 13岁9月（未到冬）→ 不触发
r=test(13,13,9,'academy',{});
ok('13岁9月 不触发', !r.queue.includes('s_seven_mountains'));

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
