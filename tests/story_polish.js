'use strict';
// 验证：热饼干食用、药神/三姐妹对话逐句拆分、浪人叔叔立绘管理
const h=require('./harness.js');
const win=h.win;
const $=(id)=>win.document.getElementById(id);
win.__setTypingStub(true);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};

(async()=>{
  win.__resetS();
  // 1. 热饼干食用
  const s=win.__getS();
  Object.assign(s,{ageY:8,st:3,mst:10,freeRoam:true,inv:[{id:'cookie',name:'热饼干',icon:'🍪',desc:'x'}]});
  win.__setS(s);
  win.useItem('cookie');
  ok('食用热饼干后体力+1', s.st===4);
  ok('热饼干已从背包移除', !s.inv.some(i=>i.id==='cookie'));

  // 2. 药神场景对话逐句：检查场景里 dialogue 行数增多、有 DUO 高亮
  const ys=win.SCENES.s_yaoshen.lines;
  const duoCount=ys.filter(l=>l.portraits && l.portraits.length>=2).length;
  ok('药神场景有双人立绘对话', duoCount>0);
  // 每句对话 text 不包含多个「」
  const multiQuote = ys.filter(l=>typeof l.text==='string' && (l.text.match(/「/g)||[]).length>1);
  ok('药神场景无一句含多个「」', multiQuote.length===0);

  // 3. 浪人叔叔：有 loc，且关键桥段回收立绘
  const reno=win.SCENES.s_reno_arrive;
  ok('浪人叔叔场景有 loc', !!reno.loc);
  const clearPort=reno.lines.filter(l=>l.portraits && l.portraits.length===0).length;
  ok('浪人叔叔场景有清空立绘桥段', clearPort>0);

  // 4. 浪人叔叔运行后 S.loc 应为 dining
  win.__resetS();
  win.__setS(Object.assign(win.__getS(),{ageY:6,year:6,month:3,day:1,phase:'youth',tod:1}));
  win.__runScene('s_reno_arrive');
  ok('浪人叔叔运行后 S.loc=dining', win.__getS().loc==='dining');

  console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
