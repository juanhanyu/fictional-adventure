'use strict';
// 自由探索：每个背景类型都有可播放的曲目（类型覆盖验证）
const h = require('./harness.js');
const win = h.win;
win.__setTypingStub(true);
let plays=[];
if(win.HTMLMediaElement){ win.HTMLMediaElement.prototype.play=function(){plays.push(String(this.getAttribute('src')||''));return Promise.resolve();}; }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  win.__resetS(); win.newGame();
  Object.values(win.__LOCS).forEach(L=>L.unlock=true);
  let cs=win.__getS(); cs.freeRoam=true; cs.loc='nursery'; cs.flags.named=1; cs.ageY=8; cs.phase='childhood'; cs.year=8; win.__setS(cs);

  // 对每个类型，从一个不同类型的地点进入，验证能播放该类型曲目
  const types=['peaceful','cheerful','relax','sacred','academy'];
  let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
  for(const t of types){
    const group=win.BGM_GROUPS[t];
    if(!group){ ok(`类型 ${t} 有分组`, false); continue; }
    const file=win.BGM_FILES[group[0]];
    const exists=require('fs').existsSync(require('path').join(__dirname,'..',file));
    ok(`类型 ${t} 曲目文件存在 (${file.split('/').pop()})`, !!exists);
  }

  // 实际播放：peaceful→cheerful→relax→sacred 依次用不同类型地点切换，每次都应产生新播放
  const seq=[['nursery','peaceful'],['garden','cheerful'],['balcony','relax'],['chapel','sacred']];
  for(let i=0;i<seq.length;i++){
    const [loc,t]=seq[i];
    win.bgmPlayType(t, {force:true}); await sleep(200); // 确立当前曲
    plays=[];
    win.enterLoc(loc); await sleep(900);
    const p=plays.map(x=>x.split('/').pop());
    ok(`进入 ${loc}（${t}）产生播放`, p.length>0);
  }

  console.log(fail===0?'\n  ✓ 全部类型有 bgm':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
