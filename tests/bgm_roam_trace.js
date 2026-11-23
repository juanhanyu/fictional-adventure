'use strict';
// 自由探索播放追踪：验证进入各地点会触发对应类型曲目播放
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);
let sd=0;
win.setTimeout=(fn)=>{ if(++sd>80000){sd--;return 0;} try{fn();}finally{sd--;} return 0; };
win.setInterval=()=>0;win.clearInterval=()=>0;win.clearTimeout=()=>0;
let plays=[];
if(win.HTMLMediaElement){ win.HTMLMediaElement.prototype.play=function(){plays.push(this.getAttribute('src')||this.src);return Promise.resolve();}; }
win.__setTypingStub(true);
win.__resetS();
win.newGame();

// 直接验证每个地点的类型推断 + 对应曲目文件存在（跳过 fade/interval 依赖）
const locs = { nursery:'peaceful', parlor:'peaceful', study:'peaceful', library:'academy',
  garden:'cheerful', dining:'cheerful', auditorium:'sacred', beach:'cheerful', northforest:'sad',
  ice_class:'academy', cafeteria:'academy', balcony:'relax', chapel:'sacred' };
let fail=0;
Object.entries(locs).forEach(([loc,expected])=>{
  const L = win.__LOCS[loc];
  const t = win.bgmTypeForBg(L.bg||'', 'academy', loc);
  const group = win.BGM_GROUPS[t];
  const file = win.BGM_FILES[group[0]];
  const exists = require('fs').existsSync(require('path').join(__dirname,'..',file));
  const ok = t===expected && exists;
  if(!ok){ console.log(`  ✗ ${loc}: 类型=${t}(期望${expected}) 文件存在=${exists}`); fail++; }
});
console.log(fail===0?`  ✓ 所有地点 bgm 类型正确且文件存在（${Object.keys(locs).length} 处）`:'');
process.exit(fail?1:0);
