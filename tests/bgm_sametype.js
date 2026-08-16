'use strict';
// 同类型地点间（育婴室→起居室，都是 peaceful）不换曲；不同类型地点（→花园 cheerful）才切曲
const h=require('./harness.js');
const win=h.win;
const $=(id)=>win.document.getElementById(id);
win.__setTypingStub(true);
let plays=[];
if(win.HTMLMediaElement){win.HTMLMediaElement.prototype.play=function(){plays.push(String(this.getAttribute('src')||''));return Promise.resolve();};}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
(async()=>{
  win.__resetS(); win.newGame();
  Object.values(win.__LOCS).forEach(L=>L.unlock=true);
  let cs=win.__getS(); cs.freeRoam=true; cs.loc='nursery'; cs.flags.named=1; cs.ageY=8; cs.phase='childhood'; cs.year=8; win.__setS(cs);
  // 先确立当前曲为 cheerful（花园类）
  win.bgmPlayType('cheerful', {force:true}); await sleep(200);

  // 进入育婴室（peaceful，与当前 cheerful 不同）→ 应切到 peaceful
  plays=[]; win.enterLoc('nursery'); await sleep(900);
  const n=plays.map(x=>x.split('/').pop()).pop();
  ok('进入育婴室（类型变 peaceful）切曲 '+n, !!n);

  // 育婴室→起居室（同 peaceful）：不换曲
  plays=[]; win.enterLoc('parlor'); await sleep(900);
  ok('育婴室→起居室（同类型）不换曲', plays.length===0);

  // 起居室→图书室（同 peaceful）：仍不换
  plays=[]; win.enterLoc('study'); await sleep(900);
  ok('起居室→图书室（同类型）不换曲', plays.length===0);

  // 图书室→花园（peaceful→cheerful）：切曲
  plays=[]; win.enterLoc('garden'); await sleep(900);
  ok('图书室→花园（不同类型）切曲', plays.length>0);

  console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
