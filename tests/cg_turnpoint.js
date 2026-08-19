'use strict';
const h=require('./harness.js');
const win=h.win;
const $=(id)=>win.document.getElementById(id);
win.__setTypingDrain();
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  win.__resetS();
  win.__setS(Object.assign(win.__getS(),{ageY:15,year:15,month:12,day:1,phase:'finale',tod:1}));
  let cgCount=0, err=null, guard=0;
  const seen=new Set();
  try {
    win.__runScene('s_turnpoint');
    while(!win.__getS().freeRoam && guard<400){
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
  ok('触发 CG 演出（>=6）', cgCount>=6);
  ok('帝级段使用 reno_diji', seen.has('reno_diji.jpg'));
  console.log('  CG图集:', [...seen].join(', '));
  ok('走到自由探索', st.freeRoam===true);
  ok('已切换眷寒渔身份', st.alias==='眷寒渔');
  ok('CG 已退出', !win.document.body.classList.contains('cg-mode'));
  console.log('  CG推进:', cgCount, '| guard:', guard);
  console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
