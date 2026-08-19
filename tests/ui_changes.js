'use strict';
// 验证 UI 改动：无 btn-map、btn-ui(🌙)、阶段中文、勇者之赐计数、无记忆模块、设置模块、自由探索点对话框隐藏
const h=require('./harness.js');
const win=h.win;
const $=(id)=>win.document.getElementById(id);
let fail=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); if(!c)fail++;};

ok('右上角无地图按钮 btn-map', !$('btn-map'));
ok('右上角有隐藏UI按钮 btn-ui', !!$('btn-ui'));
ok('btn-ui 初始图标为 🌙', $('btn-ui') && $('btn-ui').textContent.includes('🌙'));
const explore = win.document.querySelector('[data-act="explore"]');
ok('底部按钮为「地图」', explore && explore.textContent.includes('地图'));

win.__resetS();
const st=win.__getS(); st.phase='academy'; win.__setS(st);
ok('phaseName(academy)=学院篇', win.phaseName()==='学院篇');
ok('内部 S.phase 仍为 academy', win.__getS().phase==='academy');

win.__resetS();
const st2=win.__getS(); st2.picksDone=[0,1]; win.__setS(st2);
win.openPanel('status');
ok('勇者之赐显示 2/7 次', $('panel-body').innerHTML.includes('2/7'));
ok('不含 s.picksdone 字面量', !/s\.picksdone/i.test($('panel-body').innerHTML));

// 面板含「设置」标签，无「记忆」
win.openPanel('status');
ok('面板含「设置」标签', $('panel-tabs').innerHTML.includes('设置'));
ok('面板不含「记忆」标签', !$('panel-tabs').innerHTML.includes('记忆'));

// 设置模块：打开设置，含 BGM 音量/亮度滑块和恢复默认按钮
win.openPanel('settings');
const sb=$('panel-body').innerHTML;
ok('设置含 BGM 音量滑块', sb.includes('set-bgm'));
ok('设置含背景亮度滑块', sb.includes('set-bright'));
ok('设置含恢复默认按钮', sb.includes('set-reset'));

// 恢复默认：设置 settings 后 reset 应清空
win.setSetting('bgm', 0.2); win.setSetting('bright', 0.8);
ok('设置生效 (bgm=0.2)', Math.abs(win.getSettings().bgm-0.2)<0.001);
win.resetSettings();
ok('恢复默认 (bgm=0.5)', Math.abs(win.getSettings().bgm-0.5)<0.001);

// 隐藏UI切换
$('btn-ui').onclick(); ok('点击隐藏UI', win.document.body.classList.contains('ui-hidden'));
$('btn-ui').onclick(); ok('再点恢复UI', !win.document.body.classList.contains('ui-hidden'));

// 自由探索点对话框隐藏
win.__resetS(); const st3=win.__getS(); st3.freeRoam=true; win.__setS(st3);
const tb=$('text-box');
tb.onclick({target:tb}); ok('自由探索点对话框隐藏', tb.classList.contains('dialog-hidden'));
tb.onclick({target:tb}); ok('再点恢复对话框', !tb.classList.contains('dialog-hidden'));

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
