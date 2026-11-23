'use strict';
// 微服私访 BGM：comedy_medium key 必须映射到真实存在的 Comical_medium-speed.mp3，且场景确实播放它
const h=require('./harness.js');
const win=h.win;
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};

// 1) BGM_FILES 映射存在
const file=win.BGM_FILES['comedy_medium'];
ok('BGM_FILES.comedy_medium 有映射', !!file);
ok('映射到 Comical_medium-speed.mp3', file && file.includes('Comical_medium-speed.mp3'));
ok('文件真实存在', !!file && fs.existsSync(path.join(ROOT, file)));

// 2) BGM_GROUPS 含 comedy_medium
ok('BGM_GROUPS.comedy_medium 存在', !!(win.BGM_GROUPS && win.BGM_GROUPS['comedy_medium']));

// 3) 微服场景配了 comedy_medium
const sc=win.SCENES['s_micro'];
ok('s_micro 配了 bgm', sc && !!sc.bgm);
ok('s_micro bgm == comedy_medium', sc && sc.bgm==='comedy_medium');

// 4) 场景启动实际把 Comical_medium-speed.mp3 设为 src
let srcs=[];
win.HTMLMediaElement.prototype.play=function(){ srcs.push(this.src); return Promise.resolve(); };
win.__setTypingStub(true);
win.__resetS();
win.__setS(Object.assign(win.__getS(),{ageY:8,year:8,month:6,day:1,phase:'youth',flags:{named:1}}));
try{ win.__runScene('s_micro'); }catch(e){ console.log('  崩溃', e.message); }
ok('场景启动实际播放 Comical_medium-speed.mp3', srcs.some(s=>decodeURIComponent(s).includes('Comical_medium-speed.mp3')));
console.log('  实际 src:', srcs.map(s=>decodeURIComponent(s).split('/').pop()).join(', '));

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
