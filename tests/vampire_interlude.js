'use strict';
// 吸血鬼间章：门控、分支、冰晶宫殿回溯与正史收束的数据回归
const h=require('./harness.js');
const win=h.win;
let fail=0;
const ok=(label,cond)=>{ console.log(`  ${cond?'✓':'✗'} ${label}`); if(!cond) fail++; };
const textOf=scene=>(scene.lines||[]).map(line=>[
  typeof line.text==='string'?line.text:'',
  typeof line.do==='function'?line.do.toString():'',
].join('\n')).join('\n');
const choicesOf=scene=>{
  const line=(scene.lines||[]).find(item=>Array.isArray(item.choices));
  return line ? line.choices : [];
};

const ids=[
  's_vampire_rumor','s_vampire_abandon','s_vampire_investigation',
  's_vampire_review','s_vampire_deduction','s_vampire_false_lead',
  's_vampire_trap','s_vampire_eclipse','s_vampire_aftermath',
];

console.log('\n===== 吸血鬼间章回归 =====');
ok('间章场景链完整', ids.every(id=>!!win.SCENES[id]));
ok('所有间章场景均显式设置 BGM', ids.every(id=>typeof win.SCENES[id].bgm==='string' && win.SCENES[id].bgm.length>0));

const opening=choicesOf(win.SCENES.s_vampire_rumor);
ok('玩家可选择坚持或放弃调查', opening.some(c=>c.goto==='s_vampire_investigation') && opening.some(c=>c.goto==='s_vampire_abandon'));

win.__setTypingStub(true);
win.__resetS();
Object.assign(win.__getS(),{ageY:10,year:10,month:6,phase:'youth'});
win.__runScene('s_vampire_rumor');
const card=win.document.getElementById('card');
if(card && typeof card.onclick==='function') card.onclick();
const persist=[...win.document.querySelectorAll('#choices button')].find(button=>button.textContent.includes('坚持调查'));
if(persist && typeof persist.onclick==='function') persist.onclick();
ok('进入调查分支后写入门控标记', win.__getS().flags.ch_vampire===1);

const deduction=choicesOf(win.SCENES.s_vampire_investigation);
const review=deduction.find(c=>c.goto==='s_vampire_review');
win.__resetS();
win.__getS().skills=[];
ok('未获得冰晶宫殿时不显示回溯选项', review && review.if()===false);
win.__getS().skills=['ice_palace'];
ok('获得冰晶宫殿后可回看线索', review && review.if()===true);
ok('正确推断进入诱饵布局', deduction.some(c=>c.text==='领地医师维克托' && c.goto==='s_vampire_trap'));
ok('错误推断进入任务失败分支', deduction.filter(c=>c.goto==='s_vampire_false_lead').length===2);

const battle=textOf(win.SCENES.s_vampire_eclipse);
ok('日蚀战包含传说级法杖与真实伤害', battle.includes('真实伤害') && battle.includes('静止的日蚀'));
ok('罗兰为避免受控而自尽', battle.includes('罗兰拔出短刃，割开了自己的喉咙'));
ok('加文与马修贴身保护主角', battle.includes('加文和马修退到我身边'));
ok('雷纳德登场收束战斗', battle.includes('叔叔已经来到他面前'));

const eclipse=win.SCENES.s_vampire_eclipse;
const rewardLine=(eclipse.lines||[]).find(line=>typeof line.do==='function' && line.do.toString().includes('still_eclipse'));
win.__resetS();
rewardLine.do();
ok('战后获得「静止的日蚀」', win.__getS().inv.some(item=>item.id==='still_eclipse'));

console.log(fail===0?'\n  ✓ 全部通过':`\n  ✗ ${fail} 处失败`);
process.exit(fail?1:0);
