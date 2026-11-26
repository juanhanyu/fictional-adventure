'use strict';
/**
 * 自动化测试套件：角色专属灵魂卡矩阵 + 细粒度阶段认知锁 + 5轴全闭环蝴蝶效应 + 状态机防泄漏 + 代理安全白名单
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./harness.js');

const ROOT = path.resolve(__dirname, '..');
const win = h.win;
const $ = id => win.document.getElementById(id);

let syncDepth = 0;
win.setTimeout = fn => { if (++syncDepth > 60000) { syncDepth--; return 0; } try { fn(); } finally { syncDepth--; } return 0; };
win.setInterval = () => 0;
win.clearInterval = () => 0;
win.clearTimeout = () => 0;
win.__setTypingStub(true);

let passed = 0;
let failed = 0;
function ok(label, cond) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  if (cond) passed++;
  else failed++;
}

(async () => {
  console.log('\n===== 1. 角色专属灵魂卡矩阵（15人）与文风铁律校验 =====');
  const Personas = win.AI_PERSONAS;
  assert.ok(Personas, 'AI_PERSONAS 已挂载');

  const required15 = [
    'alice', 'beatrice', 'noelle', 'aino', 'charlotte',
    'helena', 'emma', 'ajun', 'reno', 'hol',
    'sophia', 'claude', 'jilan', 'ji', 'anna'
  ];
  const all15Present = required15.every(id => {
    const p = Personas.PERSONAS[id];
    return p && p.surfaceTone && Array.isArray(p.subtextHabits) && p.subtextHabits.length >= 2
      && p.sylviaAnchor && p.fewShot && p.fewShot.good.length >= 1 && p.fewShot.bad.length >= 1;
  });
  ok('15 位指定角色灵魂卡全部完整（语调/小动作/锚点/正反例 Few-shot）', all15Present);

  // 标志性细节抽检
  ok('爱丽丝灵魂卡底库含攥裙侧与碎贝壳手绳细节',
    /裙/.test(Personas.PERSONAS.alice.subtextHabits.join('')) && /碎贝壳/.test(Personas.PERSONAS.alice.subtextHabits.join('')));
  ok('诺艾儿灵魂卡底库含左手背日程表与倒拿书挡脸细节',
    /左手背/.test(Personas.PERSONAS.noelle.subtextHabits.join('')) && /倒/.test(Personas.PERSONAS.noelle.subtextHabits.join('')));
  ok('艾诺灵魂卡底库含喷嚏掉雪花、怕烫与「还行」口癖',
    /阿嚏/.test(Personas.PERSONAS.aino.subtextHabits.join('')) && /还行/.test(Personas.PERSONAS.aino.surfaceTone));
  ok('夏洛特灵魂卡底库含折扇耳根泛红与母亲旧树浅沟',
    /折扇/.test(Personas.PERSONAS.charlotte.subtextHabits.join('')) && /耳根/.test(Personas.PERSONAS.charlotte.subtextHabits.join('')));
  ok('霍尔灵魂卡底库含赫兰闲书与窗台冻土白霜',
    /赫兰/.test(Personas.PERSONAS.hol.subtextHabits.join('')) && /白霜/.test(Personas.PERSONAS.hol.subtextHabits.join('')));

  // 新增源码文件禁用二字转折词扫描
  const forbiddenWord = '\u4e0d' + '\u662f';
  const checkedFiles = [
    'js/ai-personas.js',
    'js/branching-director.js',
    'js/ai-chat-panel.js',
    'server/gemini-proxy.mjs',
    'tavern-prompt.mjs',
    'tavern-extension.js',
    'js/tavern-bridge.js'
  ];
  const forbiddenHits = [];
  for (const rel of checkedFiles) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (content.includes(forbiddenWord)) forbiddenHits.push(rel);
  }
  ok('全部新增与升级模块源码零匹配禁用转折词', forbiddenHits.length === 0);

  // sanitizeNarrativeOutput 测试
  const dirty = '她' + forbiddenWord + '讨厌你，而是底层逻辑里灵气不足。';
  const cleaned = Personas.sanitizeNarrativeOutput(dirty);
  ok('sanitizeNarrativeOutput 自动净化禁用转折句、技工词与修仙词',
    !cleaned.includes(forbiddenWord) && !cleaned.includes('底层逻辑') && !cleaned.includes('灵气'));

  console.log('\n===== 2. 动态时间锁 + 角色内部细粒度年龄/进度分档防穿帮 =====');
  const infantSnap = { playing: true, phase: 'prologue', player: { name: '希尔维亚', age: 0, year: 0, month: 4 } };
  const gateInfant = Personas.getTemporalGate('sophia', infantSnap);
  ok('婴儿期时间锁：禁止读心且不提前提及未出生的爱丽丝或学院人物',
    gateInfant.era === 'infant' && gateInfant.forbiddenSpoilers.some(s => /读心/.test(s)) && gateInfant.forbiddenSpoilers.some(s => /爱丽丝尚未出生/.test(s)));

  // 细粒度分档校验 ①：主角 5 岁（爱丽丝 3 岁幼童）绝不出现 13 岁海滨碎贝壳手绳与学院两点十三分
  const aliceAge5Block = Personas.buildPersonaCardBlock('alice', {
    playing: true, phase: 'childhood', flags: {}, player: { name: '希尔维亚', age: 5, year: 5, month: 6 }
  });
  const aliceHabitsAge5 = Personas.resolvePersonaStage('alice', {
    playing: true, phase: 'childhood', flags: {}, player: { name: '希尔维亚', age: 5, year: 5, month: 6 }
  });
  const aliceHabitsAge14 = Personas.resolvePersonaStage('alice', {
    playing: true, phase: 'academy', flags: { ch_beach: true }, player: { name: '希尔维亚', age: 14, year: 14, month: 9 }
  });
  ok('细粒度分档 [爱丽丝]：3岁幼童期无碎贝壳手绳/无风系亲和，14岁海滨归来后才解锁碎贝壳手绳与两点十三分',
    !/碎贝壳/.test(aliceHabitsAge5.subtextHabits.join(''))
    && !/两点十三分/.test(aliceHabitsAge5.subtextHabits.join(''))
    && /尚未测出风系亲和/.test(aliceAge5Block)
    && /碎贝壳/.test(aliceHabitsAge14.subtextHabits.join('')));

  // 细粒度分档校验 ②：主角 6 岁时贝阿特丽丝（8岁）绝不咬笔帽改大学外交论文
  const beaEarlyStage = Personas.resolvePersonaStage('beatrice', {
    playing: true, phase: 'youth', flags: {}, player: { name: '希尔维亚', age: 6, year: 6, month: 6 }
  });
  const beaLateStage = Personas.resolvePersonaStage('beatrice', {
    playing: true, phase: 'academy', flags: { ch_beatrice_leaves: true, ch_tree: true }, player: { name: '希尔维亚', age: 15, year: 15, month: 6 }
  });
  ok('细粒度分档 [贝阿特丽丝]：幼年在家绝不提咬笔帽改大学外交论文，五年级提前毕业期才出现外交论文细节',
    !/外交论文|边贸条款/.test(beaEarlyStage.subtextHabits.join('') + beaEarlyStage.sylviaAnchor)
    && /外交论文/.test(beaLateStage.subtextHabits.join('')));

  // 细粒度分档校验 ③：12岁刚入学第一天初遇诺艾儿/艾诺/夏洛特/霍尔时，严防提前剧透后期私密心结
  const day1Snap = { playing: true, phase: 'academy', flags: {}, player: { name: '希尔维亚', age: 12, year: 12, month: 9 } };
  const noelleDay1 = Personas.resolvePersonaStage('noelle', day1Snap);
  const ainoDay1 = Personas.resolvePersonaStage('aino', day1Snap);
  const charlotteDay1 = Personas.resolvePersonaStage('charlotte', day1Snap);
  const holDay1 = Personas.resolvePersonaStage('hol', day1Snap);
  ok('细粒度分档 [学院初遇]：12岁初入学时不提前暴露诺艾儿侦探书单、艾诺北极铃兰、夏洛特母亲旧树薄荷茶、霍尔窗台白霜',
    !/侦探小说|橘猫/.test(noelleDay1.subtextHabits.join('') + noelleDay1.sylviaAnchor)
    && !/北极铃兰|伊诺/.test(ainoDay1.subtextHabits.join('') + ainoDay1.sylviaAnchor)
    && !/薄荷茶|母亲旧树/.test(charlotteDay1.subtextHabits.join('') + charlotteDay1.sylviaAnchor)
    && !/白霜/.test(holDay1.subtextHabits.join('') + holDay1.sylviaAnchor));

  const journeySnap = { playing: true, phase: 'journey', location: '霁馆', player: { name: '眷寒渔', age: 15, year: 16, month: 3 } };
  const gateJilan = Personas.getTemporalGate('jilan', journeySnap);
  const gateJi = Personas.getTemporalGate('ji', journeySnap);
  ok('第三卷澄岚身份锁：霁岚与霁馆主只认得黑发墨绿眼的「渔」，严禁知晓公爵千金与冰系魔法',
    gateJilan.isChenglanDisguise && /渔/.test(gateJilan.knownPlayerName) && /黑发墨绿眼/.test(gateJilan.knownPlayerIdentity)
    && gateJilan.forbiddenSpoilers.some(s => /冰系魔法/.test(s)) && /渔/.test(gateJi.knownPlayerName));

  console.log('\n===== 3. 双层因果暗流引擎 + 双幕双模小场景 + 状态机防泄漏验证 =====');
  const Director = win.BranchingDirector;
  assert.ok(Director, 'BranchingDirector 已挂载');

  // 热点防遮挡校验：全部 8 个小场景热点避开中心立绘区域 (x <= 25 或 x >= 75)
  const allHotspotsClearCenter = Director.VIGNETTE_CATALOG.every(v => v.x <= 25 || v.x >= 75);
  ok('全部小场景微光热点均布局于舞台两侧通透区（避开 x=50% 中心立绘遮挡）', allHotspotsClearCenter);

  win.__resetS();
  const s0 = win.__getS();
  Director.ensureCausalState(s0);
  ok('存档初始包含 5 组关系双轴、4 项暗线拼图、6 项主线蝴蝶效应台账与回声池',
    !!s0.causal && Object.keys(s0.causal.axes).length === 5 && Object.keys(s0.causal.clues).length === 4 && Object.keys(Director.PAYOFF_META).length === 6);

  // 测试回声池容量上限与高权重保留
  for (let i = 0; i < 11; i++) {
    Director.recordEcho({ id: 'e_' + i, charId: 'alice', quote: '普通低权重回声第' + i + '句', weight: 1 }, { silent: true });
  }
  Director.recordEcho({ id: 'e_vip', charId: 'alice', quote: '高权重核心承诺：终会在高处重逢', weight: 5 }, { silent: true });
  ok('动态回声池最多保留 8 条且高权重承诺置顶保留',
    s0.causal.echoes.length === 8 && s0.causal.echoes[0].id === 'e_vip');

  function playVignetteOffline(vId, setupState, choiceIndices) {
    win.__resetS();
    const st = Object.assign(win.__getS(), setupState, { freeRoam: true });
    st.flags = Object.assign({ named: 1 }, setupState.flags || {});
    win.__setS(st);
    Director.ensureCausalState(st);
    win.renderHotspots();
    const spot = win.document.querySelector(`[data-vignette="${vId}"]`);
    const hasSpot = !!spot;
    win.__runScene(vId);
    let stepIdx = 0;
    for (let guard = 0; guard < 120 && !win.__getS().freeRoam; guard++) {
      const choiceBtns = win.document.querySelectorAll('#choices .choice');
      if (choiceBtns.length) {
        const pick = choiceIndices[stepIdx] != null ? choiceIndices[stepIdx] : 0;
        stepIdx++;
        choiceBtns[Math.min(pick, choiceBtns.length - 1)].click();
        continue;
      }
      win.advanceDialog();
    }
    return { hasSpot, finishedToFreeRoam: !!win.__getS().freeRoam, causal: win.__getS().causal };
  }

  const v1 = playVignetteOffline('v_alice_shade', { ageY: 6, year: 6, month: 6, phase: 'youth', loc: 'study', flags: { ch_alice_born: 1 } }, [0, 0]);
  ok('小场景 1 [童年书房·爱丽丝陪坐] 离线通关 → 独立思考轴+3 & 铭刻回声',
    v1.hasSpot && v1.finishedToFreeRoam && v1.causal.axes.alice.independence === 3 && v1.causal.vignettesDone.v_alice_shade);

  const v2 = playVignetteOffline('v_beatrice_practice', { ageY: 6, year: 6, month: 9, phase: 'youth', loc: 'training' }, [0, 0]);
  ok('小场景 2 [童年训练场·贝蒂木梳微火] 离线通关 → 记录边防隐忧与回声',
    v2.hasSpot && v2.finishedToFreeRoam && !!win.__getS().flags.heard_duke_border_worry && v2.causal.vignettesDone.v_beatrice_practice);

  const v3 = playVignetteOffline('v_noelle_clocktower', { ageY: 13, year: 13, month: 3, phase: 'academy', loc: 'clocktower', flags: { met_noelle: 1 } }, [0, 0]);
  ok('小场景 3 [学院钟塔·诺艾儿撸猫] 离线通关 → 平等同盟轴+3',
    v3.hasSpot && v3.finishedToFreeRoam && v3.causal.axes.noelle.partnership === 3 && v3.causal.vignettesDone.v_noelle_clocktower);

  const v4 = playVignetteOffline('v_aino_flowerhouse', { ageY: 13, year: 13, month: 6, phase: 'academy', loc: 'flowerhouse', flags: { met_aino: 1 } }, [0, 0]);
  ok('小场景 4 [学院花坊·艾诺北极铃兰与咖喱] 离线通关 → 解锁 polar_lily_bond',
    v4.hasSpot && v4.finishedToFreeRoam && v4.causal.clues.polar_lily_bond === true && v4.causal.axes.aino.kinship === 3);

  const v5 = playVignetteOffline('v_charlotte_memorial', { ageY: 14, year: 14, month: 6, phase: 'academy', loc: 'memorial', flags: { met_charlotte: 1 } }, [0, 0]);
  ok('小场景 5 [纪念林雨后·夏洛特排水沟] 离线通关 → 卸下面具+4 & 解锁 belmont_troop_shift',
    v5.hasSpot && v5.finishedToFreeRoam && v5.causal.axes.charlotte.candor === 4 && v5.causal.clues.belmont_troop_shift === true);

  const v6 = playVignetteOffline('v_helena_corridor', { ageY: 12, year: 12, month: 9, phase: 'academy', loc: 'auditorium', flags: { ch_helena: 1 } }, [1, 0]);
  ok('小场景 6 [日落长廊·海伦娜信笺] 离线通关 → 边境盘查线索与星光信笺回声',
    v6.hasSpot && v6.finishedToFreeRoam && v6.causal.clues.belmont_troop_shift === true && v6.causal.echoes.some(e => e.charId === 'helena'));

  const v7 = playVignetteOffline('v_ajun_kitchen', { ageY: 14, year: 14, month: 9, phase: 'academy', loc: 'cafeteria', flags: { met_ajun: 1 } }, [0, 0]);
  ok('小场景 7 [公共厨房·阿琼宴会食谱] 离线通关 → 点亮核心暗线 bayi_banquet_leak',
    v7.hasSpot && v7.finishedToFreeRoam && v7.causal.clues.bayi_banquet_leak === true);

  const v8 = playVignetteOffline('v_jilan_night', { ageY: 15, year: 16, month: 3, phase: 'journey', alias: '眷寒渔', loc: 'jikan', flags: { arrived_jikan: 1 } }, [1, 1]);
  ok('小场景 8 [澄岚霁馆夜廊·院角老树] 离线通关 → 并肩远行+3 & 解锁 wind_god_echo',
    v8.hasSpot && v8.finishedToFreeRoam && v8.causal.axes.jilan.wanderlust === 3 && v8.causal.clues.wind_god_echo === true);

  // 深度验证：第 1 幕开启「✨ 灵魂交谈」刷出 rivalry+2 后点击舞台继续按钮 → 不被 fallbackPole(candor) 篡改，且进入 _r2 第 2 幕！
  win.__resetS();
  const stFreeTalk = Object.assign(win.__getS(), {
    ageY: 14, year: 14, month: 6, phase: 'academy', loc: 'memorial', freeRoam: true,
    flags: { named: 1, met_charlotte: 1 }
  });
  win.__setS(stFreeTalk);
  win.show('game-screen', 1);
  win.__runScene('v_charlotte_memorial');
  for (let g = 0; g < 20 && !win.document.querySelectorAll('#choices .choice').length; g++) win.advanceDialog();
  const origFetch0 = win.fetch;
  win.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              action: '夏洛特扬起下巴，折扇在掌心轻敲一下。',
              reply: '哼，期末榜单我绝不让步！',
              emotion: 'serious',
              causal_deltas: { axis: 'rivalry', delta: 2, clue: 'none' },
              memory_echo: ''
            })
          }]
        }
      }]
    })
  });
  win.AIChatPanel.saveConfig({ mode: 'direct', apiKey: 'test-key', proxyUrl: '', model: 'gemini-2.5-flash' });
  const act1AiBtn = Array.from(win.document.querySelectorAll('#choices .choice')).find(b => b.textContent.includes('灵魂交谈'));
  act1AiBtn.click();
  $('aid-input').value = '期末考场上见真章吧。';
  $('aid-send').click();
  await new Promise(r => origSetTimeout(r, 25));
  win.fetch = origFetch0;

  // 点击舞台中央的「✨ 已聊尽兴，继续推进本段剧情 ▸」按钮
  const stageContinueBtn = Array.from(win.document.querySelectorAll('#choices .choice')).find(b => b.textContent.includes('继续推进本段剧情'));
  assert.ok(stageContinueBtn, '舞台继续按钮存在');
  stageContinueBtn.click();
  for (let g = 0; g < 10 && !win.document.querySelectorAll('#choices .choice').length; g++) win.advanceDialog();
  const curScAfterAct1 = win.eval('currentScene');
  const axesAfterAct1 = win.__getS().causal.axes.charlotte;
  ok('第 1 幕 AI 自由交谈刷出 rivalry+2 后点击舞台继续按钮：保留 rivalry=2/candor=0 零污染，并无缝衔入 v_charlotte_memorial_r2 第 2 幕',
    curScAfterAct1 === 'v_charlotte_memorial_r2' && axesAfterAct1.rivalry === 2 && axesAfterAct1.candor === 0);

  // 继续跑完第 2 幕验证获得东郊调防线索
  win.document.querySelectorAll('#choices .choice')[1].click();
  for (let g = 0; g < 15 && !win.__getS().freeRoam; g++) win.advanceDialog();
  ok('AI 推进衔接第 2 幕完成后完整解锁东郊调防线索并回归自由探索',
    win.__getS().freeRoam && win.__getS().causal.clues.belmont_troop_shift === true && win.__getS().causal.vignettesDone.v_charlotte_memorial === true);

  // 验证抽屉右上角「×」关闭防泄漏：在钟塔打开小场景抽屉后点 × 关闭，切去宿舍面对艾玛与爱丽丝，下拉框绝不锁死且无幽灵角色！
  win.__resetS();
  const stLeakCheck = Object.assign(win.__getS(), {
    ageY: 14, year: 14, month: 9, phase: 'academy', loc: 'clocktower', freeRoam: true,
    flags: { named: 1, met_noelle: 1 }
  });
  win.__setS(stLeakCheck);
  win.__runScene('v_noelle_clocktower');
  for (let g = 0; g < 20 && !win.document.querySelectorAll('#choices .choice').length; g++) win.advanceDialog();
  Array.from(win.document.querySelectorAll('#choices .choice')).find(b => b.textContent.includes('灵魂交谈')).click();
  $('aid-btn-close').click(); // 用户直接点右上角 × 关闭抽屉
  // 切换到宿舍自由探索，场上只有 emma 和 alice
  win.__getS().loc = 'dorm';
  win.__getS().freeRoam = true;
  win.eval("currentScene = 'free-roam'; stage = [{id:'emma', emo:'normal', active:true}, {id:'alice', emo:'normal', active:false}];");
  win.AIChatPanel.openDrawer();
  const targetSel = $('aid-target');
  const optionIds = Array.from(targetSel.options).map(o => o.value);
  ok('点击抽屉「×」或切换场景后彻底清理 vignetteSession：下拉框不锁死，不在场旧角色零幽灵残留',
    targetSel.disabled === false
    && $('aid-vignette-banner').classList.contains('hidden')
    && !optionIds.includes('noelle')
    && optionIds.includes('emma')
    && optionIds.includes('alice'));
  win.AIChatPanel.closeDrawer({ wipePending: true });

  console.log('\n===== 4. 全部 5 组双轴 + 6 大主线蝴蝶效应分歧与北风堡完整收束验证 =====');
  // 4.1 验证艾诺双轴在 s_ice_melt_1 的主线分歧闭环 (kinship vs austere_mentor)
  function runAinoMeltScene(poleKey) {
    win.__resetS();
    const st = Object.assign(win.__getS(), {
      ageY: 13, year: 13, month: 11, phase: 'academy', loc: 'ice_class', mdef: 2, mag: 20, mmp: 40, mp: 40,
      flags: { named: 1, met_aino: 1 }
    });
    Director.ensureCausalState(st);
    st.causal.axes.aino[poleKey] = 3;
    win.__setS(st);
    win.__runScene('s_ice_melt_1');
    for (let g = 0; g < 160 && !win.__getS().freeRoam; g++) {
      if (!$('card').classList.contains('hidden')) { $('card').onclick && $('card').onclick(); continue; }
      win.advanceDialog();
    }
    return win.__getS();
  }
  const ainoKinState = runAinoMeltScene('kinship');
  const ainoMentorState = runAinoMeltScene('austere_mentor');
  ok('蝴蝶效应【艾诺双轴闭环】：极北知己线获赠「雪纹手帕」加魔防魔力，严苛试炼线获赠「钢冰试炼笺」加魔攻物攻',
    ainoKinState.causal.payoffsTriggered.aino_arc === true
    && ainoKinState.inv.some(x => x.id === 'aino_academy_handkerchief')
    && ainoMentorState.causal.payoffsTriggered.aino_arc === true
    && ainoMentorState.inv.some(x => x.id === 'aino_frost_shard'));

  // 4.2 验证诺艾儿双轴、暗潮先觉、夏洛特双轴、爱丽丝双轴在 s_turnpoint 的完整引爆
  win.__resetS();
  const tpState = Object.assign(win.__getS(), {
    ageY: 15, year: 15, month: 12, phase: 'academy', loc: 'dorm', gold: 10, mag: 50, mmp: 60, mp: 60,
    flags: { named: 1 }
  });
  Director.ensureCausalState(tpState);
  tpState.causal.clues.bayi_banquet_leak = true;
  tpState.causal.clues.belmont_troop_shift = true;
  tpState.causal.axes.noelle.partnership = 4;
  tpState.causal.axes.charlotte.candor = 4;
  tpState.causal.axes.charlotte.rivalry = 1;
  tpState.causal.axes.alice.obsession = 4;
  Director.recordEcho({ charId: 'noelle', speaker: '诺艾儿', quote: '用一杯水打赢一桶水的仗。', weight: 4 }, { silent: true });
  Director.recordEcho({ charId: 'charlotte', speaker: '夏洛特', quote: '树影下的话只限于你我知晓。', weight: 4 }, { silent: true });
  Director.recordEcho({ charId: 'alice', speaker: '希尔维亚', quote: '待在我看得见的地方就好。', weight: 4 }, { silent: true });
  win.__setS(tpState);

  win.eval('window.__seenHook = []; const _t = typeText; typeText = function(str, cb){ window.__seenHook.push(String(str||"")); return _t(str, cb); };');
  win.__runScene('s_turnpoint');
  for (let g = 0; g < 320 && !win.__getS().freeRoam; g++) {
    if (!$('card').classList.contains('hidden')) { $('card').onclick && $('card').onclick(); continue; }
    if (!$('cg-screen').classList.contains('hidden')) { $('cg-screen').onclick && $('cg-screen').onclick(); continue; }
    win.advanceDialog();
  }
  const joinedTurnpoint = (win.__seenHook || []).join('\n');
  win.__setTypingStub(true);
  const invIds = win.__getS().inv.map(x => x.id);

  ok('蝴蝶效应【诺艾儿同盟线】：寒假离校前图书馆获赠「诺艾儿的省魔手稿」并永久提升魔力上限',
    joinedTurnpoint.includes('平等同盟') && invIds.includes('noelle_manuscript') && win.__getS().causal.payoffsTriggered.noelle_arc === true);
  ok('蝴蝶效应【暗潮先觉】：政变前夜触发书房推演并获得「霜封暗记」',
    joinedTurnpoint.includes('暗潮先觉') && invIds.includes('frost_cipher') && win.__getS().causal.payoffsTriggered.dark_tide === true);
  ok('蝴蝶效应【政敌的体面】：夏洛特暗递换防时间表、嵌入真实回声并获得「无名巡防抄件」',
    joinedTurnpoint.includes('政敌的体面') && joinedTurnpoint.includes('树影下的话只限于你我知晓') && invIds.includes('belmont_schedule') && win.__getS().gold >= 25);
  ok('蝴蝶效应【风之弧光】：主线触发爱丽丝花饼台词与拆信演出双轨分流',
    joinedTurnpoint.includes('右腕的碎贝壳') && invIds.includes('alice_flower_cake'));

  // 验证诺艾儿另一极 guarded_pride 与夏洛特另一极 rivalry 的主线响应
  win.__resetS();
  const tpAlt = Object.assign(win.__getS(), { ageY: 15, year: 15, month: 12, phase: 'academy', loc: 'dorm', flags: { named: 1 } });
  Director.ensureCausalState(tpAlt);
  tpAlt.causal.axes.noelle.guarded_pride = 3;
  tpAlt.causal.axes.charlotte.rivalry = 3;
  win.__setS(tpAlt);
  win.__runScene('s_turnpoint');
  for (let g = 0; g < 320 && !win.__getS().freeRoam; g++) {
    if (!$('card').classList.contains('hidden')) { $('card').onclick && $('card').onclick(); continue; }
    if (!$('cg-screen').classList.contains('hidden')) { $('cg-screen').onclick && $('cg-screen').onclick(); continue; }
    win.advanceDialog();
  }
  const altInv = win.__getS().inv.map(x => x.id);
  ok('诺艾儿「自尊防线」与夏洛特「骄傲较劲」右轴在主线同样拥有专属信物（精算勘误册 + 烫金战书）',
    altInv.includes('noelle_errata') && altInv.includes('belmont_challenge'));

  // 4.3 验证第三卷压轴收束章 s_jikan_north_vow：丰满叙事且自然落点于塞北官道 road（不瞬移回霁馆）
  const northVowSceneDef = win.eval('SCENES.s_jikan_north_vow');
  win.__resetS();
  const nvState = Object.assign(win.__getS(), {
    ageY: 15, year: 16, month: 3, phase: 'journey', alias: '眷寒渔', loc: 'jikan', flags: { named: 1, arrived_jikan: 1 }
  });
  Director.ensureCausalState(nvState);
  nvState.causal.clues.polar_lily_bond = true;
  nvState.causal.clues.wind_god_echo = true;
  nvState.causal.axes.jilan.wanderlust = 3;
  win.__setS(nvState);
  win.__runScene('s_jikan_north_vow');
  for (let g = 0; g < 80 && !win.__getS().freeRoam; g++) {
    if (!$('card').classList.contains('hidden')) { $('card').onclick && $('card').onclick(); continue; }
    win.advanceDialog();
  }
  ok('第三卷压轴收束章 s_jikan_north_vow 扩展为 20+ 行完整叙事，获乌木紫穗剑与北风堡木牌，并自然收束于塞北官道 road',
    northVowSceneDef.lines.length >= 20
    && win.__getS().loc === 'road'
    && win.__getS().freeRoam === true
    && win.__getS().causal.payoffsTriggered.northern_vow === true
    && win.__getS().inv.some(x => x.id === 'ebony_sword')
    && win.__getS().inv.some(x => x.id === 'northwind_pass'));

  console.log('\n===== 5. 舞台角色情绪钩子（零情绪文字角标） + 酒馆尾注双向联动 + CSS 层级检验 =====');
  win.show('game-screen', 1);
  win.applyLineEffects({ portraits: [{ id: 'sylvia', slot: 'left', active: false }, { id: 'charlotte', slot: 'right', emo: 'normal', active: true }] });
  const charlotteSlot = win.document.querySelector('.p-slot[data-char="charlotte"]');
  const normalNoBadge = !!charlotteSlot && !charlotteSlot.querySelector('.p-emo-badge');
  // 注入模拟旧残留 .p-emo-badge，验证切换情绪时自动清理且不再向 .p-slot 渲染可见文字角标
  if (charlotteSlot) {
    const staleBadge = win.document.createElement('div');
    staleBadge.className = 'p-emo-badge emo-happy';
    staleBadge.textContent = '浅笑';
    charlotteSlot.appendChild(staleBadge);
  }
  Director.applyAIOutcome('charlotte', { emotion: 'shy', causal_deltas: { axis: 'none', delta: 0, clue: 'none' }, memory_echo: '' }, { silent: true });
  const remainingBadges = charlotteSlot ? charlotteSlot.querySelectorAll('.p-emo-badge') : [];
  const cssContent = fs.readFileSync(path.join(ROOT, 'css/ai-branching.css'), 'utf8');
  const styleCssContent = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  ok('舞台立绘切换情绪时同步 data-emo="shy"，彻底清理残留且不再向 .p-slot 渲染任何 .p-emo-badge 文字角标（css/ai-branching.css 同步隐藏双保险）',
    normalNoBadge
    && !!charlotteSlot
    && charlotteSlot.getAttribute('data-emo') === 'shy'
    && remainingBadges.length === 0
    && /\.p-emo-badge\s*\{[^}]*display:\s*none\s*!important/.test(cssContent));

  // 检验 CSS 层级与隐藏模式规则
  ok('CSS 层级规范：#portraits(8) > #css-portraits(7) > #hotspots(6)，.ai-drawer(42) < .overlay(50)，且兼容 ui-hidden / pov-hidden / cg-mode',
    /#hotspots\s*\{[^}]*z-index:\s*6\b/.test(cssContent)
    && /#hotspots\s*\{[^}]*z-index:\s*6\b/.test(styleCssContent)
    && /#css-portraits\s*\{[^}]*z-index:\s*7\b/.test(styleCssContent)
    && /#portraits\s*\{[^}]*z-index:\s*8\b/.test(styleCssContent)
    && /\.ai-drawer\s*\{[\s\S]*?z-index:\s*42/.test(cssContent)
    && /body\.ui-hidden[\s\S]*?#btn-ai-drawer/.test(cssContent)
    && /body\.cg-mode\s+\.ai-drawer/.test(cssContent));

  // 检验酒馆 tavern-prompt.mjs 的尾注解析器与净水器联动
  const tavernPrompt = await import('../tavern-prompt.mjs');
  const parsedTavern = tavernPrompt.parseTavernReply(
    '夏洛特咔哒合上折扇，这' + forbiddenWord + '示弱，而是底层逻辑使然。\n「下回考场再见分晓！」\n⟦state:emotion=shy|axis=candor+2|clue=belmont_troop_shift|echo=树影底下说的话只限于你我知晓⟧',
    'charlotte'
  );
  ok('酒馆 parseTavernReply 解析并剥离 ⟦state:...⟧ 尾注，执行原著净水并生成完整舞台表情与因果 payload',
    !parsedTavern.display.includes('⟦state:')
    && !parsedTavern.display.includes(forbiddenWord)
    && !parsedTavern.display.includes('底层逻辑')
    && parsedTavern.effect.emotion === 'shy'
    && parsedTavern.effect.causal_deltas.axis === 'candor'
    && parsedTavern.effect.causal_deltas.delta === 2
    && parsedTavern.effect.causal_deltas.clue === 'belmont_troop_shift'
    && parsedTavern.effect.memory_echo.includes('树影底下'));

  console.log('\n===== 6. gemini-proxy.mjs 静态白名单防泄露 & 严格 CORS 防盗刷端到端实测 =====');
  const proxyMod = await import('../server/gemini-proxy.mjs');
  let upstreamPayload = null;
  const srv = proxyMod.createGeminiProxyServer({
    apiKey: 'server-env-key',
    fetchImpl: async (endpoint, init) => {
      upstreamPayload = { endpoint, headers: init.headers, body: JSON.parse(init.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  action: '霁岚把竹剑往地上一杵，紫蝴蝶跟着一翘。',
                  reply: '渔！快进屋喝粥，这回我爸真没煮糊！',
                  emotion: 'happy',
                  causal_deltas: { axis: 'hearth', delta: 1, clue: 'none' },
                  memory_echo: '快进屋喝粥，第三排竹剑给你留着。'
                })
              }]
            }
          }]
        })
      };
    }
  });

  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const port = srv.address().port;
  try {
    const base = `http://127.0.0.1:${port}`;
    const indexRes = await fetch(`${base}/index.html`);
    const personaJsRes = await fetch(`${base}/js/ai-personas.js`);
    const novelTxtRes = await fetch(`${base}/${encodeURIComponent('转生贵族～到了异世界就要悠闲生活.txt')}`);
    const serverSrcRes = await fetch(`${base}/server/gemini-proxy.mjs`);
    const agentsMdRes = await fetch(`${base}/AGENTS.md`);
    const dotFileRes = await fetch(`${base}/.gitignore`);

    ok('静态白名单隔离：前端 index.html / js/* 正常访问(200)，原著全书 .txt / 服务端源码 / AGENTS.md / 隐藏文件一律 403 拦截',
      indexRes.status === 200
      && personaJsRes.status === 200
      && novelTxtRes.status === 403
      && serverSrcRes.status === 403
      && agentsMdRes.status === 403
      && dotFileRes.status === 403);

    // 恶意第三方 Origin 跨域探测与盗刷拦截验证
    const evilCorsPost = await fetch(`${base}/api/gemini/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-attacker.example'
      },
      body: JSON.stringify({ text: 'steal quota' })
    });
    const localCorsOptions = await fetch(`${base}/api/gemini/chat`, {
      method: 'OPTIONS',
      headers: { 'Origin': 'http://localhost:8000' }
    });
    ok('严格 CORS 白名单：拒绝外部恶意 Origin (HTTP 403 且零反射 CORS 头)，仅放行本机同源/localhost',
      evilCorsPost.status === 403
      && evilCorsPost.headers.get('access-control-allow-origin') === null
      && localCorsOptions.status === 204
      && localCorsOptions.headers.get('access-control-allow-origin') === 'http://localhost:8000');

    const proxyChatRes = await fetch(`${base}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${port}` },
      body: JSON.stringify({
        snapshot: {
          playing: true,
          scene: 'free-roam',
          location: '霁馆',
          phase: 'journey',
          player: { name: '眷寒渔', age: 15, year: 16, month: 3, day: 1 },
          people: [{ id: 'jilan', name: '霁岚', role: '剑馆' }],
          text: '院子里的粥热着。'
        },
        characterId: 'jilan',
        history: [],
        text: '我从北林回来了。'
      })
    }).then(r => r.json());

    const sysInstruction = upstreamPayload?.body?.systemInstruction?.parts?.[0]?.text || '';
    ok('gemini-proxy.mjs 兼容旧端点：注入澄岚身份锁与 responseSchema，返回干净结构化结果',
      proxyChatRes.emotion === 'happy'
      && proxyChatRes.causal_deltas.axis === 'hearth'
      && /黑发墨绿眼/.test(sysInstruction)
      && !!upstreamPayload?.body?.generationConfig?.responseSchema);

    // 新增：验证 GPT / OpenAI 兼容主通道 (/api/chat) + 自定义中转 Base URL
    let gptPayload = null;
    const gptSrv = proxyMod.createGeminiProxyServer({
      openaiApiKey: 'sk-test-gpt',
      openaiBaseUrl: 'https://relay.example.com/v1',
      fetchImpl: async (endpoint, init) => {
        gptPayload = { endpoint, headers: init.headers, body: JSON.parse(init.body) };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  action: '霁岚把竹剑靠回廊柱，笑意藏不住。',
                  reply: '渔，北林风大，先烤火再说！',
                  emotion: 'happy',
                  causal_deltas: { axis: 'hearth', delta: 1, clue: 'none' },
                  memory_echo: '北林风大，先烤火再说。'
                })
              }
            }]
          })
        };
      }
    });
    await new Promise(resolve => gptSrv.listen(0, '127.0.0.1', resolve));
    try {
      const gptPort = gptSrv.address().port;
      const gptRes = await fetch(`http://127.0.0.1:${gptPort}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${gptPort}` },
        body: JSON.stringify({
          model: 'gpt-4.1',
          snapshot: {
            playing: true,
            scene: 'free-roam',
            location: '霁馆',
            phase: 'journey',
            player: { name: '眷寒渔', age: 15, year: 16, month: 3, day: 1 },
            people: [{ id: 'jilan', name: '霁岚', role: '剑馆' }],
            text: '院子里的火炉亮着。'
          },
          characterId: 'jilan',
          history: [],
          text: '刚练完剑回来。'
        })
      }).then(r => r.json());
      const gptSys = gptPayload?.body?.messages?.[0]?.content || '';
      ok('GPT / OpenAI 兼容主通道 (/api/chat)：正确拼装中转端点、Bearer 鉴权、澄岚身份锁与 json_object 结构化返回',
        gptRes.emotion === 'happy'
        && gptRes.model === 'gpt-4.1'
        && gptPayload.endpoint === 'https://relay.example.com/v1/chat/completions'
        && gptPayload.headers.Authorization === 'Bearer sk-test-gpt'
        && /黑发墨绿眼/.test(gptSys)
        && gptPayload.body.response_format?.type === 'json_object');
    } finally {
      await new Promise(resolve => gptSrv.close(resolve));
    }

    // 新增：验证本机 chatgpt-2 订阅桥接模式 (provider: 'codex'，无需任何 API Key)
    let codexSeen = null;
    const codexSrv = proxyMod.createGeminiProxyServer({
      codexRunner: async (payload) => {
        codexSeen = payload;
        return JSON.stringify({
          action: '艾诺目光在雪地上一顿，轻声收剑。',
          reply: '渔，风势要变了，先退回哨塔后侧。',
          emotion: 'serious',
          causal_deltas: { axis: 'kinship', delta: 1, clue: 'none' },
          memory_echo: '风势要变了，退回哨塔后侧。'
        });
      }
    });
    await new Promise(resolve => codexSrv.listen(0, '127.0.0.1', resolve));
    try {
      const cPort = codexSrv.address().port;
      const cRes = await fetch(`http://127.0.0.1:${cPort}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${cPort}` },
        body: JSON.stringify({
          provider: 'codex',
          snapshot: {
            playing: true,
            scene: 'free-roam',
            location: '冰封峡谷',
            phase: 'journey',
            player: { name: '眷寒渔', age: 16, year: 16, month: 4, day: 1 },
            people: [{ id: 'aino', name: '艾诺', role: '前线' }],
            text: '峡谷风雪渐紧。'
          },
          characterId: 'aino',
          history: [],
          text: '前面岩壁有动静。'
        })
      }).then(r => r.json());
      ok('chatgpt-2 订阅桥接主通道 (provider: codex，零 API Key)：走本地 Codex 桥接并返回结构化表情与因果',
        cRes.model === 'chatgpt-2-codex-bridge'
        && cRes.emotion === 'serious'
        && cRes.causal_deltas.axis === 'kinship'
        && Boolean(codexSeen?.messages?.[0]?.content));
    } finally {
      await new Promise(resolve => codexSrv.close(resolve));
    }
  } finally {
    await new Promise(resolve => srv.close(resolve));
  }

  console.log('\n===== 7. M4 深化校验：旅途灵魂卡、4 阶记忆档、主动开场白、星轨趋向与 504 超时 =====');
  // 7.1) 新旅途灵魂卡 (lein / peilin / musa) + 深化 ji / jilan / ajun + 澄岚/商路/北境伪装身份锁
  const journeyNewIds = ['lein', 'peilin', 'musa'];
  ok('新增第三卷/旅途灵魂卡 lein / peilin / musa 全部具备完整语调、小动作与正反例',
    journeyNewIds.every(id => {
      const p = Personas.PERSONAS[id];
      return p && p.surfaceTone && Array.isArray(p.subtextHabits) && p.subtextHabits.length >= 3
        && p.sylviaAnchor && p.fewShot && p.fewShot.good.length >= 1 && p.fewShot.bad.length >= 1;
    }));
  ok('莱恩/沛霖/穆萨与深化版老霁/霁岚/阿琼保留原著专属标志细节',
    /草叶船/.test(Personas.PERSONAS.lein.subtextHabits.join(''))
    && /皮水囊/.test(Personas.PERSONAS.lein.subtextHabits.join(''))
    && /珞叶青/.test(Personas.PERSONAS.peilin.subtextHabits.join(''))
    && /学徒补贴/.test(Personas.PERSONAS.peilin.surfaceTone + Personas.PERSONAS.peilin.subtextHabits.join(''))
    && /白苔/.test(Personas.PERSONAS.musa.subtextHabits.join(''))
    && /孜然圆馕/.test(Personas.PERSONAS.musa.subtextHabits.join(''))
    && /爆炒火焰鼠尾/.test(Personas.PERSONAS.ji.surfaceTone)
    && /生根步/.test(Personas.PERSONAS.ji.subtextHabits.join(''))
    && /亮紫色蝴蝶发饰/.test(Personas.PERSONAS.jilan.subtextHabits.join(''))
    && /粉红碎花围裙/.test(Personas.PERSONAS.ajun.subtextHabits.join('')));

  const disguiseLockIds = ['lein', 'peilin', 'musa', 'jilan', 'ji'];
  const disguiseChecks = disguiseLockIds.every(cid => {
    const g = Personas.getTemporalGate(cid, {
      playing: true, phase: 'journey', location: cid === 'musa' ? '冰封峡谷' : '澄岚官道',
      player: { name: '眷寒渔', age: 16, year: 16, month: 11 },
      flags: { named: true, arrived_jikan: true, ch_distant_wind_1: true }
    });
    const noIdentityLeak = !/维斯特利亚公爵|银灰色长发|银发蓝眸|蓝色眼眸/.test(g.knownPlayerIdentity + '\n' + g.allowedTopics.join('\n'));
    return g.isChenglanDisguise && /渔|眷寒渔/.test(g.knownPlayerName)
      && g.knownPlayerIdentity.includes('黑发') && g.knownPlayerIdentity.includes('墨绿眼')
      && noIdentityLeak && g.forbiddenSpoilers.some(s => /身份/.test(s));
  });
  ok('澄岚/东行商路/北风堡 5 人身份锁严守黑发墨绿眼「眷寒渔/渔」，零公爵/银发剧透', disguiseChecks);

  // 7.2) 艾诺 & 爱丽丝 4 阶记忆档位验证
  const ainoStages = [
    Personas.resolvePersonaStage('aino', { playing: true, phase: 'academy', flags: {}, player: { name: '希尔维亚', age: 12 } }),
    Personas.resolvePersonaStage('aino', { playing: true, phase: 'academy', flags: { ch_aino_sparring: true }, player: { name: '希尔维亚', age: 13 } }),
    Personas.resolvePersonaStage('aino', { playing: true, phase: 'academy', flags: { ch_aino_sparring: true, ch_ice_melt_1: true }, player: { name: '希尔维亚', age: 13 } }),
    Personas.resolvePersonaStage('aino', { playing: true, phase: 'journey', location: '冰封峡谷', flags: { ch_aino_sparring: true, ch_ice_melt_1: true, ch_distant_wind_1: true }, player: { name: '眷寒渔', age: 16 } }),
  ];
  ok('艾诺具备完整 4 阶记忆档位（初遇挑刺 -> 周六花坊 -> 冰融交接 -> 赫兰前线重逢保密档）',
    ainoStages[0].stageLabel === '课堂初遇挑刺期'
    && ainoStages[1].stageLabel === '周六陪练与花坊期'
    && ainoStages[2].stageLabel === '冰融交接极北知己期'
    && ainoStages[3].stageLabel === '赫兰冰封峡谷前线重逢期'
    && /左下角/.test(ainoStages[3].subtextHabits.join(''))
    && /热麦汤/.test(ainoStages[3].subtextHabits.join('')));

  const aliceStages = [
    Personas.resolvePersonaStage('alice', { playing: true, phase: 'childhood', flags: {}, player: { name: '希尔维亚', age: 5 } }),
    Personas.resolvePersonaStage('alice', { playing: true, phase: 'youth', flags: { ch_alice_affinity: true }, player: { name: '希尔维亚', age: 8 } }),
    Personas.resolvePersonaStage('alice', { playing: true, phase: 'academy', flags: { ch_alice_affinity: true, ch_beach: true, ch_ice_melt_2: true }, player: { name: '希尔维亚', age: 14 } }),
    Personas.resolvePersonaStage('alice', { playing: true, phase: 'journey', flags: { ch_eye_of_storm: true }, player: { name: '眷寒渔', age: 16 } }),
  ];
  ok('爱丽丝具备完整 4 阶记忆档位（幼童 -> 少年风感 -> 学院同校 -> 风神亲传凛冬历练期）',
    aliceStages[0].stageLabel.includes('幼童期')
    && aliceStages[1].stageLabel.includes('少年风感期')
    && aliceStages[2].stageLabel === '魔法大学同校期'
    && aliceStages[3].stageLabel === '风神亲传凛冬历练期'
    && /风神岚/.test(aliceStages[3].subtextHabits.join(''))
    && /碎贝壳手绳/.test(aliceStages[3].subtextHabits.join('')));

  // 7.3) AIChatPanel.buildProactiveOpening 地点/因果响应与初生盲听身份遮罩
  const maskedOpening = win.AIChatPanel.buildProactiveOpening('sophia', {
    playing: true, phase: 'prologue', location: '育婴室', flags: {},
    player: { name: '希尔维亚', age: 0, year: 0, month: 3 }, people: []
  });
  const ainoFrontOpening = win.AIChatPanel.buildProactiveOpening('aino', {
    playing: true, phase: 'journey', location: '冰封峡谷',
    flags: { named: true, met_aino: true, ch_aino_sparring: true, ch_ice_melt_1: true, ch_distant_wind_1: true },
    player: { name: '眷寒渔', age: 16, year: 16, month: 12 },
    people: [{ id: 'aino', name: '艾诺·塔尔维', short: '艾诺', role: '前线指挥' }]
  });
  const charlotteCausal = { axes: { charlotte: { candor: 4, rivalry: 0 } }, clues: {}, echoes: [{ charId: 'charlotte', quote: '排水浅沟只告诉你一个人' }] };
  const charlotteOpening = win.AIChatPanel.buildProactiveOpening('charlotte', {
    playing: true, phase: 'academy', location: '纪念林',
    flags: { named: true, met_charlotte: true, ch_tree: true },
    player: { name: '希尔维亚', age: 14, year: 14, month: 6 },
    people: [{ id: 'charlotte', name: '夏洛特·贝尔蒙', short: '夏洛特', role: '对手' }]
  }, charlotteCausal);
  ok('AIChatPanel.buildProactiveOpening 严守未识名遮罩，并随地点/阶段/因果暗流动态生成开场白',
    maskedOpening.hidden === true && maskedOpening.speaker !== '索菲亚' && maskedOpening.stageLabel.includes('尚未识名')
    && ainoFrontOpening.hidden === false && ainoFrontOpening.stageLabel === '赫兰冰封峡谷前线重逢期'
    && ainoFrontOpening.greeting.includes('魔剑士') && !ainoFrontOpening.greeting.includes('希尔维亚')
    && charlotteOpening.hidden === false && charlotteOpening.emotion === 'shy'
    && charlotteOpening.greeting.includes('排水浅沟只告诉你一个人') && charlotteOpening.starters.length >= 2);

  // 7.4) BranchingDirector.getEndingTendency & getCausalDialogueHooks
  const stFresh = win.baseState();
  Director.ensureCausalState(stFresh);
  const tendFresh = Director.getEndingTendency(stFresh);

  const stDawn = win.baseState();
  Director.ensureCausalState(stDawn);
  stDawn.causal.axes.noelle.partnership = 4;
  stDawn.causal.axes.charlotte.candor = 4;
  stDawn.causal.clues.bayi_banquet_leak = true;
  stDawn.causal.clues.belmont_troop_shift = true;
  const tendDawn = Director.getEndingTendency(stDawn);
  const hooksTurnpoint = Director.getCausalDialogueHooks('s_turnpoint', stDawn);

  const stTwin = win.baseState();
  Director.ensureCausalState(stTwin);
  stTwin.causal.axes.alice.independence = 4;
  stTwin.causal.axes.jilan.wanderlust = 4;
  stTwin.causal.clues.wind_god_echo = true;
  stTwin.causal.clues.polar_lily_bond = true;
  const tendTwin = Director.getEndingTendency(stTwin);
  const hooksWind = Director.getCausalDialogueHooks('s_leaky_cup', stTwin);

  const stFrost = win.baseState();
  Director.ensureCausalState(stFrost);
  stFrost.causal.axes.aino.austere_mentor = 5;
  stFrost.causal.axes.charlotte.rivalry = 5;
  stFrost.causal.axes.noelle.guarded_pride = 4;
  const tendFrost = Director.getEndingTendency(stFrost);

  ok('BranchingDirector.getEndingTendency 准确区分初始静水、破晓明约、双风并翼与霜冕孤锋趋向',
    tendFresh.id === 'unwritten_snow'
    && tendDawn.id === 'dawn_reunion' && tendDawn.confidence >= 50
    && tendTwin.id === 'twin_winds'
    && tendFrost.id === 'frost_sovereign');
  ok('BranchingDirector.getCausalDialogueHooks 按主线场景输出定制因果钩子与终局趋向快照',
    hooksTurnpoint.sceneId === 's_turnpoint'
    && hooksTurnpoint.activeHooks.some(h => h.id === 'clue_bayi_banquet_leak')
    && hooksTurnpoint.activeHooks.some(h => h.charId === 'charlotte')
    && hooksTurnpoint.endingTendency.id === 'dawn_reunion'
    && hooksWind.activeHooks.some(h => h.charId === 'alice')
    && hooksWind.activeHooks.some(h => h.id === 'clue_wind_god_echo'));

  // 7.5) server/gemini-proxy.mjs extractJsonObject（无语言裸围栏 + 散文包裹）与 HTTP 504 超时保护
  const bareFenceExtracted = JSON.parse(proxyMod.extractJsonObject('```\n{"action":"轻敲折扇","reply":"哼，别迟到。","emotion":"shy"}\n```'));
  const proseWrappedExtracted = JSON.parse(proxyMod.extractJsonObject('好的，下面是角色回复（附注{草稿说明}）：\n```json\n{"action":"抬眼","reply":"风势变了。","emotion":"serious"}\n```\n以上供参考。'));
  const bareProseExtracted = JSON.parse(proxyMod.extractJsonObject('思考过程{无reply字段}，最终JSON：{"action":"点点头","reply":"走吧。","emotion":"normal"} 结束'));
  ok('extractJsonObject 精准提取无语言裸围栏、json 围栏与散文包裹中的合法 reply JSON',
    bareFenceExtracted.reply === '哼，别迟到。'
    && proseWrappedExtracted.reply === '风势变了。'
    && bareProseExtracted.reply === '走吧。');

  const slowCodexSrv = proxyMod.createGeminiProxyServer({
    codexTimeoutMs: 60,
    codexRunner: (_payload, { signal }) => new Promise((_resolve) => {
      const tm = setTimeout(() => _resolve('{"reply":"late"}'), 500);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(tm); });
    })
  });
  await new Promise(resolve => slowCodexSrv.listen(0, '127.0.0.1', resolve));
  let codexTimeoutStatus = 0;
  let codexTimeoutErr = '';
  try {
    const p1 = slowCodexSrv.address().port;
    const r1 = await fetch(`http://127.0.0.1:${p1}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${p1}` },
      body: JSON.stringify({
        provider: 'codex', characterId: 'aino', text: '测试超时',
        snapshot: { playing: true, phase: 'journey', location: '冰封峡谷', player: { name: '眷寒渔', age: 16 }, people: [{ id: 'aino', name: '艾诺', role: '前线' }] }
      })
    });
    codexTimeoutStatus = r1.status;
    codexTimeoutErr = (await r1.json()).error || '';
  } finally {
    await new Promise(resolve => slowCodexSrv.close(resolve));
  }

  const slowFetchSrv = proxyMod.createGeminiProxyServer({
    openaiApiKey: 'sk-timeout-test',
    timeoutMs: 60,
    fetchImpl: (_url, init) => new Promise((_resolve) => {
      const tm = setTimeout(() => _resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
      if (init && init.signal) init.signal.addEventListener('abort', () => { clearTimeout(tm); });
    })
  });
  await new Promise(resolve => slowFetchSrv.listen(0, '127.0.0.1', resolve));
  let fetchTimeoutStatus = 0;
  let fetchTimeoutErr = '';
  try {
    const p2 = slowFetchSrv.address().port;
    const r2 = await fetch(`http://127.0.0.1:${p2}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${p2}` },
      body: JSON.stringify({
        provider: 'openai', characterId: 'jilan', text: '测试上游超时',
        snapshot: { playing: true, phase: 'journey', location: '霁馆', player: { name: '眷寒渔', age: 16 }, people: [{ id: 'jilan', name: '霁岚', role: '剑馆' }] }
      })
    });
    fetchTimeoutStatus = r2.status;
    fetchTimeoutErr = (await r2.json()).error || '';
  } finally {
    await new Promise(resolve => slowFetchSrv.close(resolve));
  }
  ok('gemini-proxy.mjs 在 codexRunner 与上游 fetch 超时时均精准返回 HTTP 504 与中文超时提示',
    codexTimeoutStatus === 504 && /超时/.test(codexTimeoutErr)
    && fetchTimeoutStatus === 504 && /超时/.test(fetchTimeoutErr));

  h.dom.window.close();
  console.log(`\n通过: ${passed} | 失败: ${failed}`);
  if (failed > 0) process.exit(1);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

function origSetTimeout(fn, ms) {
  return setTimeout(fn, ms);
}
