'use strict';
// 同地点行动不换曲；同类型地点不换曲；不同类型地点才切曲
const h = require('./harness.js');
const win = h.win;
const $=(id)=>win.document.getElementById(id);
win.__setTypingStub(true);
let plays=[];
if(win.HTMLMediaElement){ win.HTMLMediaElement.prototype.play=function(){plays.push(String(this.getAttribute('src')||''));return Promise.resolve();}; }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};

(async()=>{
  win.__resetS(); win.newGame();
  Object.values(win.__LOCS).forEach(L=>L.unlock=true);
  let cs=win.__getS(); cs.freeRoam=true; cs.loc='garden'; cs.flags.named=1; cs.ageY=8; cs.phase='childhood'; cs.year=8; win.__setS(cs);

  // 进入 garden (cheerful)
  plays=[]; win.enterLoc('garden'); await sleep(900);
  const first=plays.map(x=>x.split('/').pop()).pop();
  ok('进入花园播放 '+first, !!first);

  // 同地点行动结束（enterFreeRoam）不换曲
  plays=[]; win.enterFreeRoam(); await sleep(900);
  ok('同地点行动结束不换 bgm', plays.length===0);

  // 花园→餐厅（同 cheerful）：不换曲
  plays=[]; win.enterLoc('dining'); await sleep(900);
  ok('花园→餐厅（同类型 cheerful）不换曲', plays.length===0);

  // 餐厅→礼拜堂（cheerful→sacred）：切曲
  plays=[]; win.enterLoc('chapel'); await sleep(900);
  const s=plays.map(x=>x.split('/').pop()).pop();
  ok('餐厅→礼拜堂（不同类型）切曲 '+s, plays.length>0);

  // 礼拜堂→露台（sacred→relax）：切曲
  plays=[]; win.enterLoc('balcony'); await sleep(900);
  ok('礼拜堂→露台（不同类型）切曲', plays.length>0);

  console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
