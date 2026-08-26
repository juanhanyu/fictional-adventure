'use strict';
// 吸血鬼间章：门控、分支、冰晶宫殿回看与剧情战斗收束
const h = require('./harness.js');
const win = h.win;
const $ = id => win.document.getElementById(id);
const ok = (label, condition) => {
  console.log(`  ${condition ? '✓' : '✗'} ${label}`);
  if (!condition) fail++;
};
let fail = 0;

win.__setTypingSync();
win.setTimeout = fn => { if (typeof fn === 'function') fn(); return 0; };
win.setInterval = () => 0;
win.clearTimeout = () => {};
win.clearInterval = () => {};

const choose = label => {
  const button = [...$('choices').querySelectorAll('button')]
    .find(b => b.textContent.includes(label));
  if (!button) throw new Error(`choice not found: ${label}`);
  button.onclick();
};
const start = () => {
  win.__resetS();
  const s = win.__getS();
  Object.assign(s, { ageY: 8, year: 8, month: 9, day: 1, phase: 'youth', tod: 1 });
  s.flags.ch_micro = 1;
  win.__runScene('s_vampire_interlude');
  if (!$('card').classList.contains('hidden')) $('card').onclick();
  return s;
};

try {
  ok('章节目录登记间章', win.__STORY_CHAPTERS.some(c => c.id === 's_vampire_interlude'));
  ok('间章场景已注册', !!win.SCENES.s_vampire_interlude);

  const earlyFlags = [
    'ch_first_word', 'ch_alice_born', 'ch_child_days', 'ch_age4',
    'ch_yaoshen', 'ch_sisters_grow', 'ch_reno_arrive', 'ch_alice_affinity',
    'ch_beatrice_day', 'ch_micro',
  ];
  win.__resetS();
  let gateState = win.__getS();
  Object.assign(gateState, { ageY: 8, year: 8, month: 8, phase: 'youth' });
  earlyFlags.forEach(k => { gateState.flags[k] = 1; });
  ok('间章在触发季度前保持锁定', win.checkStoryGates() === false);
  gateState.month = 9;
  ok('间章在八岁秋季进入门控队列', win.checkStoryGates() === true && win.__getCurrentScene() === 's_vampire_interlude');

  // 放弃路线应结束本场景，不进入吸血鬼战斗。
  let s = start();
  choose('放弃任务');
  ok('放弃路线写入标记', s.flags.vampire_abandoned === 1);
  ok('放弃路线回到自由探索', s.freeRoam === true && win.__getCurrentScene() === null);

  // 小说路线：三次回看节点都出现，最后进入剧情战斗并领取法杖。
  s = start();
  s.skills.push('ice_palace');
  choose('坚持调查');
  ok('坚持路线进入首个回看节点', win.__getAwaiting() && $('text').textContent.includes('诊所'));
  choose('进入冰晶宫殿');
  ok('冰晶宫殿保存调查记忆', s.memories.some(m => m.id === 'vampire_case'));
  choose('凭记忆继续');
  choose('进入冰晶宫殿');
  ok('回看后进入剧情战斗', !$('battle-screen').classList.contains('hidden'));
  for (let i = 0; i < 3; i++) {
    const endTurn = [...$('battle-screen').querySelectorAll('button')]
      .find(b => b.textContent.includes('结束回合'));
    if (!endTurn) throw new Error('story battle turn control missing');
    endTurn.onclick();
  }
  ok('剧情战斗由雷纳德收束', s.freeRoam === true && s.flags.vampire_resolved === true);
  ok('任务完成', s.tasks.vampire_trace && s.tasks.vampire_trace.done === true);
  ok('获得月蚀空间杖', s.inv.some(it => it.id === 'moon_space_staff'));

  console.log(fail === 0 ? '\n  ✓ 吸血鬼间章测试通过' : `\n  ✗ ${fail} 处失败`);
} catch (e) {
  console.error('  ✗ 测试异常:', e && e.stack || e);
  fail++;
}
process.exit(fail ? 1 : 0);
