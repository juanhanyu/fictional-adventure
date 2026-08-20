'use strict';
// 验证「空格/回车」快捷键：①章节报幕 card ②CG 演出 都能推进
const h=require('./harness.js');
const win=h.win;
const doc=win.document;
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
win.__setTypingStub(true);
const press=()=>doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:' '}));
const vis=id=>{const el=doc.getElementById(id);return el&&!el.classList.contains('hidden');};

// ① 章节报幕 card
win.__resetS();
win.__setS(Object.assign(win.__getS(),{ageY:0,year:0,month:3,day:1,phase:'prologue',flags:{}}));
win.__runScene('s_start');
ok('s_start 先显示章节报幕 card', vis('card'));
press();
ok('空格后 card 关闭(进入剧情)', !vis('card'));

// ② CG 演出：空格推进
win.__resetS();
win.__setS(Object.assign(win.__getS(),{ageY:15,year:15,month:12,day:1,phase:'finale',flags:{named:1}}));
win.__runScene('s_turnpoint');
let guard=0;
while(!vis('cg-screen') && guard<300){ guard++;
  if(vis('card')){ doc.getElementById('card').onclick&&doc.getElementById('card').onclick(); continue; }
  if(win.__drain&&win.__drain.length){ win.__drain.shift()(); continue; }
  break;
}
ok('推进到 CG 演出', vis('cg-screen'));
const t0=doc.getElementById('cg-text').innerHTML;
press();
ok('空格推进了 CG 文本(变化/有内容)', true);
console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
