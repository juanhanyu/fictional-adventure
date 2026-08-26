'use strict';
// 微服私访"实际玩"路径 BGM 修复：模拟 自由探索(ownroom=peaceful) → 推进到8岁春 → 门控触发 s_micro
// 验证场景确实播放 comedy_medium（Comical_medium-speed.mp3），不被背景推断(peaceful)覆盖
const h=require('./harness.js');
const win=h.win;
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
let srcs=[];
win.HTMLMediaElement.prototype.play=function(){const s=decodeURIComponent(this.src||'').split('/').pop(); if(!srcs.length||srcs[srcs.length-1]!==s) srcs.push(s); return Promise.resolve();};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const flags=['ch_first_word','ch_alice_born','ch_child_days','ch_age4','ch_yaoshen','ch_sisters_grow','ch_reno_arrive','ch_alice_affinity','ch_beatrice_day','ch_tier1_story'];
  win.__resetS();
  const s=win.__getS();
  Object.assign(s,{ageY:7,year:7,month:12,day:1,phase:'youth',tod:1,flags:{named:1}});
  flags.forEach(f=>s.flags[f]=1);
  win.__setS(s);
  s.freeRoam=true; s.loc='ownroom'; win.__setS(s);
  win.bgmPlayType('peaceful',{force:true}); await sleep(40);
  srcs=[];
  s.year=8; s.month=6; s.day=1; s.ageY=8; win.__setS(s);
  win.checkStoryGates();
  let guard=0; const vis=id=>{const el=win.document.getElementById(id);return el&&!el.classList.contains('hidden');};
  while(!win.__getS().freeRoam && guard<60){ guard++;
    if(vis('card')){win.document.getElementById('card').onclick&&win.document.getElementById('card').onclick();}
    if(win.__drain&&win.__drain.length){win.__drain.shift()();} else await sleep(80);
  }
  await sleep(1400);
  ok('实际播放了 comedy (Comical_medium-speed.mp3)', srcs.some(x=>x.includes('Comical_medium')));
  console.log('  实际序列:', JSON.stringify(srcs));
  console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
