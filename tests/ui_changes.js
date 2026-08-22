'use strict';
// 验证 UI 改动：按钮/设置、自由探索提示关闭、季度直接推进与对话框恢复
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

// 不再显示地点出口教学框；季度风物框只允许右下角三角关闭
win.__resetS(); const st3=win.__getS(); st3.freeRoam=true; st3.season=2; win.__setS(st3);
const tb=$('text-box'), more=$('more');
win.enterFreeRoam();
ok('自由探索不显示地点出口教学框', tb.classList.contains('dialog-hidden'));
ok('地点出口教学文案已移除', !win.enterFreeRoam.toString().includes('点击画面出口移动') && !win.playLines.toString().includes('点击画面出口移动'));
let seasonClosed=false;
win.showSeasonFlavor(()=>{ seasonClosed=true; });
ok('季度切换显示风物对话框', !tb.classList.contains('dialog-hidden') && $('text').textContent.includes('风物：'));
ok('季度风物保留底部 UI', !$('action-bar').classList.contains('hidden'));
ok('季度风物标记为 season', tb.getAttribute('data-roam-prompt')==='season');
tb.onclick({target:tb});
ok('点击风物框其他位置不关闭', !tb.classList.contains('dialog-hidden'));
win.document.dispatchEvent(new win.KeyboardEvent('keydown', {key:' '}));
ok('按空格不关闭季度风物框', !tb.classList.contains('dialog-hidden'));
// 模拟上一段剧情遗留的推进回调：提示框三角仍应独立关闭并执行季度回调。
win.eval('lineCB=()=>{};');
tb.onclick({target:more});
ok('右下角小三角关闭季度风物框', tb.classList.contains('dialog-hidden'));
ok('关闭季度风物框后执行后续逻辑', seasonClosed);
ok('关闭自由探索提示时清理旧推进状态', win.eval('lineCB===null && typing===false && typeDoneCB===null'));

// 回归：季度推进先持久化到期剧情，且不提前把剧情写成“已完成”。
win.__resetS();
const gateState=win.__getS();
gateState.ageY=1; gateState.ageD=0; gateState.year=0; gateState.month=6; gateState.season=1;
gateState.phase='childhood'; gateState.loc='nursery'; gateState.freeRoam=true; gateState.flags={};
win.__setS(gateState);
win.doNextTime();
ok('剧情门控前先显示季度风物框', tb.getAttribute('data-roam-prompt')==='season');
ok('风物框出现前已持久化待播剧情',
  Array.isArray(win.__getS().storyPending) && win.__getS().storyPending.includes('s_first_word'));
ok('排队阶段不提前写入剧情完成标记', !win.__getS().flags.ch_first_word);
ok('右下角小三角有独立的提示关闭处理器', typeof more.onclick==='function');
more.onclick({stopPropagation(){}});
ok('点击小三角后直接触发到期剧情', win.__getCurrentScene()==='s_first_word' && !win.__getS().freeRoam);
win.eval("storyChain=null; currentScene=null; S.storyPending=[]; resetDialogAdvanceState(); show('card',0);");

// 即使待播队列被自由探索重置，未完成标记仍为空，下一次门控检查可以重新排队。
win.__resetS();
const lostQueueState=win.__getS();
lostQueueState.ageY=1; lostQueueState.year=1; lostQueueState.month=3; lostQueueState.season=0;
lostQueueState.phase='childhood'; lostQueueState.loc='nursery'; lostQueueState.freeRoam=true; lostQueueState.flags={};
win.__setS(lostQueueState);
win.eval('checkStoryGates({defer:true})');
win.__getS().storyPending=[];
win.eval('checkStoryGates({defer:true})');
ok('待播队列丢失后能够重新建立',
  !win.__getS().flags.ch_first_word && win.__getS().storyPending.includes('s_first_word'));

// v3 迁移修复此前版本在排队阶段提前写入的 ch_* 标记。
const repaired=win.eval(`migrateStorySave({
  phase:'childhood',
  storyGateVersion:2,
  storyPending:[],
  flags:{ch_first_word:1,ch_alice_born:1}
})`);
ok('v2 旧存档会清除失配的已触发标记',
  repaired.storyGateVersion===3 && !repaired.flags.ch_first_word && !repaired.flags.ch_alice_born);

// 页面中断后保存在 storyPending 的剧情，读档时必须能够继续。
win.__resetS();
const pendingState=win.__getS();
pendingState.ageY=1; pendingState.year=0; pendingState.month=9; pendingState.season=2;
pendingState.phase='childhood'; pendingState.flags={};
pendingState.storyGateVersion=3; pendingState.storyPending=['s_first_word'];
win.__setS(pendingState);
win.eval('resumePendingStories()');
ok('读档恢复点能重新启动中断剧情',
  win.__getCurrentScene()==='s_first_word' && !win.__getS().freeRoam);
win.eval("storyChain=null; currentScene=null; S.storyPending=[]; resetDialogAdvanceState(); show('card',0);");

// 婴儿期两个抱出按钮都可用，点击后进入抱出剧情并恢复对话框
win.__resetS(); const infant=win.__getS(); infant.ageY=0; infant.loc='nursery'; infant.freeRoam=true; infant.st=5; win.__setS(infant);
win.renderHotspots();
const babyButtons=win.document.querySelectorAll('.hotspot.locked-baby');
ok('婴儿期显示两个出去按钮', babyButtons.length===2);
ok('人物点击使用透明像素命中检测', win.renderHotspots.toString().includes('portraitPixelIsOpaque') && win.renderHotspots.toString().includes('forwardPortraitClick'));
const passButton=win.document.createElement('button');
passButton.className='hotspot';
let transparentForwarded=false;
passButton.onclick=()=>{ transparentForwarded=true; };
$('hotspots').appendChild(passButton);
const oldElementFromPoint=win.document.elementFromPoint;
win.document.elementFromPoint=()=>passButton;
ok('透明区域可把点击转交给下层出口', win.forwardPortraitClick(20,20) && transparentForwarded);
win.document.elementFromPoint=oldElementFromPoint;
let babyClickOK=true;
try{ babyButtons[0].click(); }catch(e){ babyClickOK=false; }
ok('婴儿出去按钮点击不报错', babyClickOK);
ok('点击后进入抱出剧情', !win.__getS().freeRoam);
ok('剧情开始恢复对话框', !tb.classList.contains('dialog-hidden'));
ok('下个季度按钮直接推进并显示风物框', !win.doNextTime.toString().includes('choices') && win.doNextTime.toString().includes('showSeasonFlavor'));

// 进入空地点不再播放环境描述；有人时显示情境问候且保留底部 UI
ok('普通进入地点不再调用环境描述对话', !win.eval('_enterLocRaw.toString()').includes('ambientText'));
win.__resetS(); const greetState=win.__getS(); greetState.freeRoam=true; greetState.ageY=8; greetState.loc='garden'; win.__setS(greetState);
const ageGreeting=win.roamGreetingText('sophia','garden');
const placeGreeting=win.roamGreetingText('sophia','library');
ok('问候内容随地点变化', ageGreeting!==placeGreeting);
const older=win.__getS(); older.ageY=15; win.__setS(older);
ok('问候内容随主角年龄变化', win.roamGreetingText('sophia','garden')!==ageGreeting);
const child=win.__getS(); child.ageY=4; win.__setS(child);
const childGreetings=win.roamGreetingText('sophia','garden')+win.roamGreetingText('claude','garden');
ok('幼年问候不再暗示主角乱跑', !childGreetings.includes('跑太快') && !childGreetings.includes('慢一点'));
const auto=win.__getS();
auto.freeRoam=true; auto.phase='childhood'; auto.ageY=4; auto.year=4; auto.season=1; auto.loc='garden';
auto.seasonChars={1:{beatrice:'hallway',alice:'nursery',sophia:'garden'}};
win.__setS(auto);
win.enterFreeRoam();
ok('无人机位空闲时自动显示本季度角色问候', tb.getAttribute('data-roam-prompt')==='greeting' && tb.getAttribute('data-greeting-char')==='sophia');
ok('人物问候保留底部 UI', !$('action-bar').classList.contains('hidden'));
ok('人物问候显示角色小立绘', !$('tb-speaker').classList.contains('hidden'));
tb.onclick({target:more});
ok('点击问候三角后记录角色与季度', win.roamGreetingDismissed('sophia'));
win.enterFreeRoam();
ok('同角色同季度不再自动问候', tb.classList.contains('dialog-hidden'));
const nextQuarter=win.__getS();
nextQuarter.season=2;
nextQuarter.seasonChars[2]={beatrice:'hallway',alice:'nursery',sophia:'garden'};
win.__setS(nextQuarter);
win.enterFreeRoam();
ok('换季度后角色问候重新出现', tb.getAttribute('data-roam-prompt')==='greeting' && tb.getAttribute('data-greeting-char')==='sophia');

// 无底部 UI 时最多使用三行，并按实际行数垂直居中
win.document.body.classList.remove('roam');
win.setDialogRows('一行');
ok('一行文本使用居中行位', tb.classList.contains('dialog-rows-1'));
win.setDialogRows('第一行\n第二行');
ok('两行文本使用居中行位', tb.classList.contains('dialog-rows-2'));
win.setDialogRows('一\n二\n三');
ok('三行文本使用完整三行', tb.classList.contains('dialog-rows-3'));
win.setDialogRows('一\n二\n三\n四');
ok('四行及以上按三行容量处理', tb.classList.contains('dialog-rows-3') && !tb.classList.contains('dialog-rows-4'));

// 底部 UI 高度以实测值写入 --abh，供自由探索对话框动态扣减
const actionBar=$('action-bar'), gameScreen=$('game-screen');
const oldRect=actionBar.getBoundingClientRect.bind(actionBar);
actionBar.getBoundingClientRect=()=>({height:59});
win.syncActionBarHeight();
ok('底部 UI 实测高度写入 --abh', gameScreen.style.getPropertyValue('--abh')==='59px');
actionBar.getBoundingClientRect=oldRect;

console.log(fail===0?'\n  ✓ 全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
