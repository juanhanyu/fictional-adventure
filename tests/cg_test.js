'use strict';
// 验证 CG 演出引擎
const h=require('./harness.js');
const win=h.win;
const $=(id)=>win.document.getElementById(id);
win.__setTypingStub(true);
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};
win.__resetS();

// 直接调用 CG 函数
win.cgShow('reno_battle.jpg');
ok('cgShow 显示 cg-screen', !$('cg-screen').classList.contains('hidden'));
ok('cgShow 设置背景图', $('cg-bg').style.backgroundImage.includes('reno_battle'));
ok('cgShow 加 cg-mode 类', win.document.body.classList.contains('cg-mode'));
ok('CG 进度条进入显影状态', $('cg-progress').classList.contains('is-active') && $('cg-progress').dataset.state==='typing');
win.cgText('克劳德', '穿鞋。', false);
ok('CG 台词完成后标记可继续', $('cg-screen').classList.contains('cg-ready') && $('cg-progress').dataset.state==='ready');
ok('cgText 显示说话人', $('cg-text').innerHTML.includes('穿鞋'));
ok('cgText 说话人配色', $('cg-text').innerHTML.includes('c-claude'));
win.cgHide();
ok('cgHide 加 faded 淡出', $('cg-screen').classList.contains('faded'));
ok('cgHide 移除 cg-mode', !win.document.body.classList.contains('cg-mode'));
ok('cgHide 清理进度状态', !$('cg-progress').classList.contains('is-active') && !$('cg-progress').dataset.state);

// 旁白白色
win.cgShow('parting.png'); win.cgText(null, '回头。是火光。', true);
ok('旁白用 c-narrator 白色', $('cg-text').innerHTML.includes('c-narrator'));
win.cgHide();

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
