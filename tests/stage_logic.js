'use strict';
// 舞台逻辑通用规则测试：
// ① 新角色替换对应槽位（主导者位置不动）② 单角色N聚焦 ③ 单人说保留在场者置暗
// ④ 驻场角色只更新表情/明暗，不重复播放入场动画；⑤ 位置变化保留平移逻辑
const h=require('./harness.js');
const win=h.win;
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
win.__setTypingStub(true);
const vis=id=>{const el=win.document.getElementById(id);return el&&!el.classList.contains('hidden');};
const $=id=>win.document.getElementById(id);
// 按舞台顺序(左→右)取可见立绘
function orderedStage(){
  return ['p-left','p-center','p-right','p-fourth'].filter(s=>{const el=$(s);return el&&!el.classList.contains('hidden')&&!el.classList.contains('ps-leave');}).map(s=>{
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
ok('真正新增角色仍保留淡入', $('p-right').classList.contains('ps-enter'));
// 同一组驻场对话：反复切换说话人/表情不能再次淡入。
win.applyLineEffects({ch:'beatrice',slot:'left',emo:'shy'});
ok('驻场角色说话不重复淡入', !$('p-left').classList.contains('ps-enter') && !$('p-left').classList.contains('ps-leave'));
// 焦点 portraits 暂时只显示一人时，say() 标记的同场角色也应直接驻场。
win.applyLineEffects({portraits:[{id:'alice',slot:'center',active:true}]});
win.applyLineEffects({ch:'sylvia',resident:true,emo:'normal'});
ok('驻场 say 角色不被演成插话', $('p-left').getAttribute('data-char')==='sylvia' && !$('p-left').classList.contains('ps-enter'));
ok('剧情 say 默认带驻场语义', win.SCENES.s_age4.lines.some(l=>l && l.ch==='sylvia' && l.resident===true));
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'merchant_bakery',slot:'right',active:false}]});
st=orderedStage();
ok('换回后 老板回右槽', st[0].char==='beatrice' && st[1].char==='merchant_bakery');

// ② 单角色N：替换舞台为该人（vignette 段切换）——贝蒂/老板都被老板取代
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'merchant_bakery',slot:'right',active:false}]});
win.applyLineEffects({portraits:[{id:'merchant_bakery',slot:'left',active:true}]});
st=orderedStage();
ok('单N聚焦老板后 舞台只剩老板', st.length===1 && st[0].char==='merchant_bakery');

// ③ 单人说保留在场者置暗
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'merchant_bakery',slot:'right',active:false}]});
win.applyLineEffects({ch:'beatrice', emo:'normal'});
st=orderedStage();
ok('贝蒂说后 老板保留在场', st.some(s=>s.char==='merchant_bakery'));
const boss=st.find(s=>s.char==='merchant_bakery');
ok('老板(非说话人)被置暗', boss && boss.dim===true);
win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',emo:'shy',active:true}]});
ok('立绘保留已有 emo 状态供高情绪样式读取', $('p-left').getAttribute('data-emotion')==='shy');
ok('单人构图回到原版居中位置', (()=>{ win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true}]}); return $('p-left').style.left==='50%'; })());
ok('双人构图回到原版 30/70 位置', (()=>{ win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'alice',slot:'right',active:false}]}); return $('p-left').style.left==='30%' && $('p-right').style.left==='70%'; })());
ok('四人构图回到原版 14/38/62/86 位置', (()=>{ win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'alice',slot:'center',active:false},{id:'merchant_bakery',slot:'right',active:false},{id:'sylvia',slot:'fourth',active:false}]}); return $('p-left').style.left==='14%' && $('p-center').style.left==='38%' && $('p-right').style.left==='62%' && $('p-fourth').style.left==='86%'; })());
ok('立绘平移后保留驻场角色且不重复淡入', (()=>{
  win.applyLineEffects({portraits:[{id:'beatrice',slot:'left',active:true},{id:'alice',slot:'right',active:false}]});
  return $('p-left').getAttribute('data-char')==='beatrice' && $('p-right').getAttribute('data-char')==='alice'
    && !$('p-left').classList.contains('ps-enter') && !$('p-right').classList.contains('ps-enter');
})());

// ④ 药神场景回归：DUO → 旁白/心理活动 N(数组顺序相反) → DUO，
// 主角和药神的语义槽位必须始终是「主角左、药神右」。
win.applyLineEffects({portraits:[{id:'sylvia',slot:'left',active:true},{id:'yaoshen',slot:'right',active:false}]});
let yao=orderedStage();
const yaoLeftPos=$('p-left').style.left, yaoRightPos=$('p-right').style.left;
ok('DUO 建立后 主角在左、药神在右', yao[0]?.char==='sylvia' && yao[1]?.char==='yaoshen');
win.applyLineEffects({portraits:[{id:'yaoshen',slot:'center',active:true},{id:'sylvia',slot:'right',active:false}]});
yao=orderedStage();
ok('N 数组倒序后 主角仍在左、药神仍在右', yao[0]?.char==='sylvia' && yao[1]?.char==='yaoshen');
ok('N 不改变既有左右坐标', $('p-left').style.left===yaoLeftPos && $('p-right').style.left===yaoRightPos);
win.applyLineEffects({portraits:[{id:'sylvia',slot:'left',active:false},{id:'yaoshen',slot:'right',active:true}]});
yao=orderedStage();
ok('回到 DUO 后 主角仍在左、药神仍在右', yao[0]?.char==='sylvia' && yao[1]?.char==='yaoshen');

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
