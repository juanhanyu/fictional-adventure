'use strict';
// 童年夏天·树荫乘凉 CG（cool_off.webp）：s_sisters_grow（五岁）内插入了主角用冰霜之息给爱丽丝降温的 CG 段
const h=require('./harness.js');
const win=h.win;
const $=(id)=>win.document.getElementById(id);
win.__setTypingDrain();
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  win.__resetS();
  win.__setS(Object.assign(win.__getS(),{ageY:5,year:5,month:6,day:1,phase:'youth',tod:1}));
  let cgCount=0, err=null, guard=0; const seen=new Set();
  try {
    win.__runScene('s_sisters_grow');
    while(!win.__getS().freeRoam && guard<500){
      guard++;
      if(!$('cg-screen').classList.contains('hidden')){
        cgCount++;
        const bg=$('cg-bg').style.backgroundImage||'';
        const m=bg.match(/assets\/cg\/([^)'"]+)/);
        if(m) seen.add(m[1]);
        $('cg-screen').onclick && $('cg-screen').onclick();
      }
      else if(win.__drain && win.__drain.length){ win.__drain.shift()(); }
      else if($('card') && !$('card').classList.contains('hidden')){ $('card').onclick&&$('card').onclick(); }
      await sleep(3);
    }
  } catch(e){ err=e; }
  const st=win.__getS();
  ok('场景无崩溃', !err);
  ok('触发了 CG 演出（>=6 句）', cgCount>=6);
  ok('使用了 cool_off.webp', seen.has('cool_off.webp'));
  console.log('  CG图集:', [...seen].join(', ') || '(无)');
  ok('走到自由探索', st.freeRoam===true);
  console.log('  CG推进:', cgCount, '| guard:', guard);
  console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
