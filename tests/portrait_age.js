'use strict';
// 验证按角色年龄自动匹配立绘（三阶段：child / young / teenage）
const h=require('./harness.js');
const win=h.win;
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};

function testAge(ageY){
  win.__resetS();
  const s=win.__getS(); s.ageY=ageY; s.flags.named=1; win.__setS(s);
  return {
    sylvia: win.resolvePortrait('sylvia','normal'),
    beatrice: win.resolvePortrait('beatrice','normal'),
    alice: win.resolvePortrait('alice','normal'),
  };
}

// 主角3岁：child档；姐姐5岁child；妹妹1岁child
let r=testAge(3);
ok('主角3岁→child', r.sylvia.includes('sylvia_child'));
ok('姐姐5岁(3+2)→child', r.beatrice.includes('beatrice_child'));
ok('妹妹1岁(3-2)→child', r.alice.includes('alice_child'));

// 主角8岁：young档；姐姐10岁 young；妹妹6岁 young
r=testAge(8);
ok('主角8岁→young', r.sylvia.includes('sylvia_young'));
ok('姐姐10岁(8+2)→young', r.beatrice.includes('beatrice_young'));
ok('妹妹6岁(8-2)→young', r.alice.includes('alice_young'));

// 主角12岁：teenage档；姐姐14 teenage；妹妹10 young
r=testAge(12);
ok('主角12岁→teenage', r.sylvia.includes('sylvia_teenage'));
ok('姐姐14→teenage', r.beatrice.includes('beatrice_teenage'));
ok('妹妹10→young', r.alice.includes('alice_young'));

// 主角4岁教爱丽丝(2岁)：爱丽丝child
r=testAge(4);
ok('妹妹2岁(4-2)→child', r.alice.includes('alice_child'));

// ===== 新增：验证档位名与表情解析 =====
(function teenageCheck(){
  win.__resetS();
  const s=win.__getS(); s.ageY=14; s.flags.named=1; win.__setS(s);
  ok('档位名 teenage(主角14岁)', win.portraitTierName(win.portraitAgeTierFor('sylvia'))==='teenage');
  ok('档位名 young(主角8岁)', (function(){ const t=win.__getS(); t.ageY=8; win.__setS(t); return win.portraitTierName(win.portraitAgeTierFor('sylvia'))==='young'; })());
  (function(){ const t=win.__getS(); t.ageY=14; win.__setS(t); })(); // 恢复14岁
  ok('teenage 档解析到 sylvia_teenage_normal', win.resolvePortrait('sylvia','normal').includes('sylvia_teenage_normal'));
  ok('sylvia_teenage_normal 键存在', !!win.__PORTRAIT_FILES['sylvia_teenage_normal']);
  ok('alice_child_shy 键存在', !!win.__PORTRAIT_FILES['alice_child_shy']);
  ok('beatrice_young_wink 键存在', !!win.__PORTRAIT_FILES['beatrice_young_wink']);
  console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
  process.exit(fail?1:0);
})();
