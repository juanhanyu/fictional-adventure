'use strict';
// 验证按角色年龄自动匹配立绘
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

// 主角8岁：youth档；姐姐10岁 normal；妹妹6岁 youth
r=testAge(8);
ok('主角8岁→youth(child占位)', r.sylvia.includes('sylvia_child')); // 当前无 youth 文件，回退child
ok('姐姐10岁(8+2)→youth(child占位)', r.beatrice.includes('beatrice_child'));
ok('妹妹6岁(8-2)→youth(child占位)', r.alice.includes('alice_normal')); // 当前 youth 映射到 normal

// 主角12岁：normal档
r=testAge(12);
ok('主角12岁→normal', r.sylvia.includes('sylvia_normal'));
ok('姐姐14→normal', r.beatrice.includes('beatrice_normal'));
ok('妹妹10→youth(normal占位)', r.alice.includes('alice_normal'));

// 主角4岁教爱丽丝(2岁)：爱丽丝child
r=testAge(4);
ok('妹妹2岁(4-2)→child', r.alice.includes('alice_child'));

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
