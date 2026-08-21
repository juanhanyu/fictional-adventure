'use strict';
// 舞台逻辑通用规则测试：
// ① 插话者替换对应槽位（主导者位置不动）② 单角色N聚焦不顶掉在场者 ③ 单人说保留在场者置暗
const h=require('./harness.js');
const win=h.win;
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
win.__setTypingStub(true);
const vis=id=>{const el=win.document.getElementById(id);return el&&!el.classList.contains('hidden');};
const $=id=>win.document.getElementById(id);
// 按舞台顺序(左→右)取可见立绘
function orderedStage(){
  return ['p-left','p-center','p-right','p-fourth'].filter(vis).map(s=>{
    const e=$(s); return {char:e.getAttribute('data-char'), dim:e.classList.contains('dim')};
  });
}
win.__resetS();
win.__setS(Object.assign(win.__getS(),{ageY:12,year:12,month:3,day:1,phase:'academy',flags:{named:1}}));

// ① 贝蒂+老板 → 爱丽丝插话替换老板槽(贝蒂保持左)
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'merchant_bakery',slot:'right',active:false}]});
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:false},{id:'alice',slot:'right',active:true}]});
let st=orderedStage();
ok('插话后 贝蒂仍驻左、爱丽丝在右', st[0].char==='beatrice' && st[1].char==='alice');
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'merchant_bakery',slot:'right',active:false}]});
st=orderedStage();
ok('换回后 老板回右槽', st[0].char==='beatrice' && st[1].char==='merchant_bakery');

// ② 单角色N聚焦保留在场者
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'merchant_bakery',slot:'right',active:false}]});
win.applyLineEffects({portraits:[{id:'merchant_bakery',slot:'left',active:true}]});
st=orderedStage();
ok('单N聚焦老板后 贝蒂保留', st.some(s=>s.char==='beatrice') && st.some(s=>s.char==='merchant_bakery'));

// ③ 单人说保留在场者置暗
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'merchant_bakery',slot:'right',active:false}]});
win.applyLineEffects({ch:'beatrice', emo:'normal'});
st=orderedStage();
ok('贝蒂说后 老板保留在场', st.some(s=>s.char==='merchant_bakery'));
const boss=st.find(s=>s.char==='merchant_bakery');
ok('老板(非说话人)被置暗', boss && boss.dim===true);

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
