'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { win, errors } = require('./harness');

if (win.HTMLMediaElement && win.HTMLMediaElement.prototype) {
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.HTMLMediaElement.prototype.pause = () => {};
}
win.__setTypingStub(true);

const CE = win.CombatEngine;
const RE = win.RelicsAndEvents;
const VN = win.VNUx;
const BD = win.BranchingDirector;

assert(CE && RE && VN && BD, '核心模块 CombatEngine / RelicsAndEvents / VNUx / BranchingDirector 必须全部就绪');

function freshPlayableState(phase) {
  const s = win.baseState();
  s.storyGateVersion = 3;
  s.freeRoam = true;
  s.flags.named = 1;
  s.flags.ch_first_word = 1;
  s.flags.ch_alice_born = 1;
  s.flags.ch_child_days = 1;
  s.flags.ch_age4 = 1;
  s.flags.ch_yaoshen = 1;
  s.flags.ch_sisters_grow = 1;
  s.flags.ch_reno_arrive = 1;
  s.flags.ch_alice_affinity = 1;
  s.flags.ch_beatrice_day = 1;
  s.flags.ch_micro = 1;
  s.flags.ch_alice_wind = 1;
  s.flags.ch_beatrice_leaves = 1;
  if (phase === 'academy' || phase === 'journey') {
    s.flags.ch_academy = 1;
    s.flags.ch_opening_ceremony = 1;
  }
  if (phase === 'journey') {
    s.flags.met_noelle = 1;
    s.flags.met_aino = 1;
    s.flags.met_charlotte = 1;
    s.flags.ch_helena = 1;
    s.flags.ch_aino_sparring = 1;
    s.flags.met_ajun = 1;
    s.flags.ch_ice_melt_1 = 1;
    s.flags.ch_seven_mountains = 1;
    s.flags.ch_ice_melt_2 = 1;
    s.flags.ch_beach = 1;
    s.flags.ch_tree = 1;
    s.flags.ch_star = 1;
    s.flags.did_turnpoint = 1;
    s.flags.arrived_jikan = 1;
    s.flags.ch_black_name = 1;
  }
  s.alias = phase === 'journey' ? '眷寒渔' : '希尔维亚';
  s.phase = phase || 'academy';
  s.ageY = phase === 'journey' ? 15 : phase === 'academy' ? 13 : 8;
  s.year = s.ageY;
  s.month = 6;
  s.season = 1;
  s.lv = 30;
  s.mhp = 200; s.hp = 200;
  s.mmp = 300; s.mp = 300;
  s.atk = 36; s.mag = 90;
  s.pdef = 26; s.mdef = 28;
  s.st = 5; s.mst = 5;
  s.gold = 60;
  s.skills = ['virtual_duel', 'ice_palace', 'mana_cycle', 'water_ball', 'ice_crystal', 'root_step', 'soft_cut'];
  BD.ensureCausalState(s);
  RE.ensureRelicsState(s);
  return s;
}

// ---------------------------------------------------------------------------
// 1. 随身铭记系统：12 件秘宝目录、自动映射解锁、3 槽上限、UI 面板 & 规则质变
// ---------------------------------------------------------------------------
console.log('--- 1. 验证 12 件随身铭记秘宝配装与规则质变 ---');
assert.strictEqual(RE.RELIC_ORDER.length, 12, '须包含完整 12 件随身铭记');
assert.strictEqual(RE.MAX_EQUIPPED_RELICS, 3, '至多佩带 3 件随身铭记');

// 验证所有物品映射（含 alias）与 3 槽位上限
const sRel = freshPlayableState('academy');
win.__setS(sRel);
win.S = sRel;
['aino_handkerchief', 'noelle_errata', 'belmont_challenge', 'cross'].forEach(itemId => {
  RE.onItemAdded({ id: itemId, name: itemId }, sRel);
});
assert(RE.isRelicUnlocked('aino_academy_handkerchief', sRel), 'aino_handkerchief 应映射解锁雪纹手帕');
assert(RE.isRelicUnlocked('noelle_manuscript', sRel), 'noelle_errata 应映射解锁省魔手稿');
assert(RE.isRelicUnlocked('belmont_schedule', sRel), 'belmont_challenge 应映射解锁无名巡防抄件');
assert(RE.isRelicUnlocked('cross', sRel), 'cross 应解锁银十字架');

assert.strictEqual(RE.equipRelic('aino_academy_handkerchief', { state: sRel }).ok, true);
assert.strictEqual(RE.equipRelic('noelle_manuscript', { state: sRel }).ok, true);
assert.strictEqual(RE.equipRelic('belmont_schedule', { state: sRel }).ok, true);
const fullTry = RE.equipRelic('cross', { state: sRel });
assert.strictEqual(fullTry.ok, false, '超出 3 件上限应拒绝装配');
assert.strictEqual(fullTry.reason, 'max_3');
assert.strictEqual(sRel.equippedRelics.length, 3);

// 验证面板「✦ 铭记」渲染且绝不包含禁用字样「记忆」
win.openPanel('relics');
const tabsHtml = win.document.getElementById('panel-tabs').innerHTML;
assert(tabsHtml.includes('✦ 铭记'), '综合面板应渲染 ✦ 铭记 标签');
assert(!tabsHtml.includes('记忆'), 'panel-tabs 严禁出现 记忆 二字');
const panelBodyHtml = win.document.getElementById('panel-body').innerHTML;
assert(panelBodyHtml.includes('雪纹手帕') && panelBodyHtml.includes('省魔手稿'), '铭记面板应展示秘宝卡片');
win.show('panel', 0);

// 验证演武沙盒独立配装不影响主线存档且 headless simulateBattle 默认不偷穿沙盒秘宝
RE.setArenaSandboxRelics(['ebony_sword', 'frost_cipher']);
assert.strictEqual(RE.getArenaSandboxRelics().length, 2);
assert.strictEqual(RE.getActiveRelicsForBattle({ fromArena: true, headless: true }).length, 0, 'headless simulateBattle 默认零秘宝以免干扰盲按基线测试');
assert.strictEqual(sRel.equippedRelics.length, 3, '演武沙盒配装不污染主线状态');
RE.setArenaSandboxRelics([]);

// 逐件验证全部 12 件秘宝的实战规则生效：
// (1) aino_academy_handkerchief：Turn 1 首次隔空瞬凝 0 AP + 冰系伤 +20%
{
  const bBase = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  const bRel = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['aino_academy_handkerchief'] });
  const remoteSk = CE.SKILLS.remote_snap_spike;
  const iceSk = CE.SKILLS.hand_ice_crystal;
  assert.strictEqual(CE.computeSkillApCost(bBase, remoteSk), 1, '无手帕时隔空瞬凝消耗 1 AP');
  assert.strictEqual(CE.computeSkillApCost(bRel, remoteSk), 0, '雪纹手帕首回合首次隔空瞬凝 0 AP');
  const dBase = CE.estimateSkillDamage(bBase, iceSk, bBase.enemies[0]).dmg;
  const dRel = CE.estimateSkillDamage(bRel, iceSk, bRel.enemies[0]).dmg;
  assert(dRel > dBase, `雪纹手帕应提升冰系伤害（${dRel} > ${dBase}）`);
  const useRes = CE.useSkill('remote_snap_spike', 0, bRel);
  assert(useRes.ok);
  assert.strictEqual(bRel.ap, 2, '首回合首次隔空瞬凝应不扣 AP');
}

// (2) aino_frost_shard：破招激活 frostPierce，下一次冰系攻击无视 25% 冰抗并消耗
{
  const bNo = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  const bShard = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['aino_frost_shard'] });
  bNo.enemies[0].intent = { stance: 'DUAL_CAST', moveName: '测试双施法', dmg: 10 };
  bShard.enemies[0].intent = { stance: 'DUAL_CAST', moveName: '测试双施法', dmg: 10 };
  CE.useSkill('remote_snap_spike', 0, bNo);
  CE.useSkill('remote_snap_spike', 0, bShard);
  assert.strictEqual(bShard.player.status.frostPierce, 1, '钢冰试炼笺破招后应激活 frostPierce');
  const eNo = CE.estimateSkillDamage(bNo, CE.SKILLS.hand_ice_crystal, bNo.enemies[0]).dmg;
  const eSh = CE.estimateSkillDamage(bShard, CE.SKILLS.hand_ice_crystal, bShard.enemies[0]).dmg;
  assert(eSh > eNo, `钢冰试炼笺应穿透 25% 抗性提高冰伤（${eSh} > ${eNo}）`);
  CE.useSkill('hand_ice_crystal', 0, bShard);
  assert.strictEqual(bShard.player.status.frostPierce, undefined, '打出冰系攻击后应消耗 frostPierce');
}

// (3) noelle_manuscript：基础蓝耗 -20%，半蓝过载额外消耗减半同时保留伤害倍增
{
  const bNo = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  const bMs = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['noelle_manuscript'] });
  const sk = CE.SKILLS.hand_ice_crystal;
  const baseMpNo = CE.computeSkillMpCost(bNo.player, sk);
  const baseMpMs = CE.computeSkillMpCost(bMs.player, sk);
  assert(baseMpMs < baseMpNo, `省魔手稿常规耗蓝更低（${baseMpMs} < ${baseMpNo}）`);
  bNo.player.overcastMode = 1;
  bMs.player.overcastMode = 1;
  const ocSpendNo = CE.computeSkillMpCost(bNo.player, sk);
  const ocSpendMs = CE.computeSkillMpCost(bMs.player, sk);
  assert(ocSpendMs < ocSpendNo, `省魔手稿半蓝强击实扣应减半缓冲（${ocSpendMs} < ${ocSpendNo}）`);
  const dNo = CE.estimateSkillDamage(bNo, sk, bNo.enemies[0]).dmg;
  const dMs = CE.estimateSkillDamage(bMs, sk, bMs.enemies[0]).dmg;
  assert.strictEqual(dMs, dNo, '省魔手稿不削减魔战倾注爆发倍率');
}

// (4) belmont_schedule：暴击率 +15% 且 UI 敌方意图条显示下回合预判
{
  const bSched = CE.startStage('aino_sparring', { headless: false, usePreset: true, relics: ['belmont_schedule'] });
  assert(bSched.player.critChance >= 0.15, '无名巡防抄件应提供 >= 15% 暴击率');
  const nextHtml = win.document.getElementById('cb-enemy-zone').innerHTML;
  assert(nextHtml.includes('下回合预判'), '无名巡防抄件应在敌方意图栏显示下回合架势预判');
  CE.exitBattle(false, { silent: true });
}

// (5) alice_flower_cake：开局自带 1 层残像；残像闪避后回复 10 MP
{
  const bCake = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['alice_flower_cake'] });
  assert.strictEqual(bCake.player.status.afterimage, 1, '风之花饼开局赠送 1 层风行残像');
  bCake.player.mp = 40;
  bCake.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '烈焰扫击', dmg: 35, elem: 'fire' };
  CE.endTurn(bCake);
  assert.strictEqual(bCake.player.status.afterimage, 0);
  assert.strictEqual(bCake.player.mp, 50, '风之花饼借残像避击后应回复 10 MP');
}

// (6) ebony_sword：剑步零冰系暴露 + 暴击返还 1 AP + 增伤
{
  const bNo = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: [] });
  const bEb = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: ['ebony_sword'], forceCrit: true });
  bNo.witnessActive = true; bEb.witnessActive = true;
  bNo.exposure = 10; bEb.exposure = 10;
  const dNo = CE.estimateSkillDamage(bNo, CE.SKILLS.sword_water_edge, bNo.enemies[0]).dmg;
  const dEb = CE.estimateSkillDamage(bEb, CE.SKILLS.sword_water_edge, bEb.enemies[0]).dmg;
  assert(dEb > dNo, `乌木紫穗剑应提升霁馆剑步伤害（${dEb} > ${dNo}）`);
  const apBefore = bEb.ap;
  CE.useSkill('sword_water_edge', 0, bEb);
  assert(bEb.exposure <= 10, '乌木紫穗剑应保持零正向冰系暴露');
  assert.strictEqual(bEb.ap, apBefore, '霁馆剑步消耗 1 AP 后因暴击应立刻返还 1 AP');
}

// (7) frost_cipher：冰晶宫殿看破后立即回复 18% MP 与 +1 AP
{
  const bCip = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['frost_cipher'] });
  bCip.waveTurn = 2;
  bCip.ap = 1;
  bCip.player.mp = 50;
  const cfg = CE.getCurrentPalaceConfig(bCip);
  const cOk = cfg.clues.find(c => c.correct);
  const dOk = cfg.deductions.find(d => d.correct);
  const expectedMpGain = Math.max(10, Math.round(bCip.player.mmp * 0.18));
  const res = CE.inspectClue(cOk.id, dOk.id, bCip);
  assert(res.correct);
  assert.strictEqual(bCip.ap, 2, '霜封暗记看破后应 +1 AP');
  assert.strictEqual(bCip.player.mp, Math.min(bCip.player.mmp, 50 + expectedMpGain), '霜封暗记应回复 18% MP');
}

// (8) northwind_pass：开局/每回合 +12 寒铁护盾 + 减免药箱受击 4 点
{
  const bNo = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: [] });
  const bPass = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: ['northwind_pass'] });
  assert.strictEqual(bPass.player.shield, 12, '北风堡木牌开局获得 12 点寒铁护盾');
  bNo.enemies.forEach(e => { e.intent = { stance: 'HEAVY_WINDUP', moveName: '测试撞箱', dmg: 0, crateDmg: 10 }; });
  bPass.enemies.forEach(e => { e.intent = { stance: 'HEAVY_WINDUP', moveName: '测试撞箱', dmg: 0, crateDmg: 10 }; });
  bNo.crateHp = 100;
  bPass.crateHp = 100;
  CE.endTurn(bNo);
  CE.endTurn(bPass);
  assert.strictEqual(bPass.crateHp, bNo.crateHp + bPass.enemies.length * 4, `北风堡木牌应每次减免 4 点药箱受击损耗（无牌 ${bNo.crateHp} / 有牌 ${bPass.crateHp}）`);
  assert(bPass.player.shield >= 12, '新回合开始北风堡木牌再次提供 12 点寒铁护盾');
}

// (9) cross：防御盾技 +20% 护盾且净化异常，回合末回复 6% 最大生命
{
  const bNo = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: [] });
  const bCr = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['cross'] });
  bCr.player.status.burn = 2;
  bCr.player.hp = 100;
  CE.useSkill('hand_ice_wall', 0, bNo);
  CE.useSkill('hand_ice_wall', 0, bCr);
  assert(bCr.player.shield > bNo.player.shield, `银十字架应 +20% 护盾（${bCr.player.shield} > ${bNo.player.shield}）`);
  assert(!bCr.player.status.burn, '银十字架使用盾技应净化 burn 异常');
  bCr.enemies.forEach(e => { e.intent = { stance: 'HEAVY_WINDUP', moveName: '无伤观察', dmg: 0 }; });
  const hpBeforeEnd = bCr.player.hp;
  CE.endTurn(bCr);
  assert.strictEqual(bCr.player.hp, hpBeforeEnd + Math.max(2, Math.round(bCr.player.mhp * 0.06)), '银十字架回合末应回复 6% HP');
}

// (10) shell_pin：水风技 +18% 伤害 + 连携追击额外回 8% MP
{
  const bNo = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: [] });
  const bPin = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['shell_pin'] });
  const dNo = CE.estimateSkillDamage(bNo, CE.SKILLS.hand_water_surge, bNo.enemies[0]).dmg;
  const dPin = CE.estimateSkillDamage(bPin, CE.SKILLS.hand_water_surge, bPin.enemies[0]).dmg;
  assert(dPin > dNo, `月虹螺胸针应提高水系伤害（${dPin} > ${dNo}）`);
  bNo.player.status.breakChain = 1; bNo.player.mp = 80;
  bPin.player.status.breakChain = 1; bPin.player.mp = 80;
  const rNo = CE.useSkill('hand_water_surge', 0, bNo);
  const rPin = CE.useSkill('hand_water_surge', 0, bPin);
  assert(rNo.ok && rPin.ok, '水弹应有足够 MP 施放');
  assert(bPin.player.mp > bNo.player.mp, `月虹螺胸针触发连携应额外多回 8% MP（${bPin.player.mp} > ${bNo.player.mp}）`);
}

// (11) ice_pebble：每回合首次经手构筑额外 +8 护盾
{
  const bPeb = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['ice_pebble'] });
  const r1 = CE.useSkill('hand_water_surge', 0, bPeb);
  assert(r1.ok, '手牌经手构筑应成功施放');
  assert.strictEqual(bPeb.player.shield, 8, '冰蓝石子首次施放经手构筑应额外凝结 8 点护盾');
  CE.useSkill('hand_ice_crystal', 0, bPeb);
  assert.strictEqual(bPeb.player.shield, 8, '每回合仅触发 1 次额外 +8 护盾');
}

// (12) blue_vial：首次生命跌破 35% 自启回复 25% 最大生命并获 1 层风行残像
{
  const bVial = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['blue_vial'] });
  bVial.player.hp = Math.floor(bVial.player.mhp * 0.40);
  bVial.player.shield = 0;
  bVial.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '低伤试探', dmg: Math.floor(bVial.player.mhp * 0.15) + 12, elem: 'phys' };
  CE.endTurn(bVial);
  assert.strictEqual(bVial._blueVialTriggered, true, '淡蓝小瓶跌破 35% HP 应自动触发保命');
  assert.strictEqual(bVial.player.status.afterimage, 1, '淡蓝小瓶触发后应赠 1 层风行残像');
  assert(bVial.player.hp >= Math.floor(bVial.player.mhp * 0.35), '淡蓝小瓶触发后生命应抬升回 35% 以上');
}

// ---------------------------------------------------------------------------
// 2. 季度动态奇遇与风险博弈（>= 18 事件、时间线防剧透、风险回报与零禁词）
// ---------------------------------------------------------------------------
console.log('--- 2. 验证 21 个季度奇遇防剧透、风险博弈与文风扫描 ---');
assert(RE.SEASONAL_EVENTS.length >= 18, `季度奇遇需 >= 18 个（当前 ${RE.SEASONAL_EVENTS.length}）`);
const byPhase = { duke: 0, academy: 0, journey: 0 };
RE.SEASONAL_EVENTS.forEach(ev => {
  byPhase[ev.phasePool] = (byPhase[ev.phasePool] || 0) + 1;
  const corpus = [ev.title, ev.tag, ev.locationLabel, ev.intro]
    .concat((ev.choices || []).map(c => c.label + ' ' + c.costBadge + ' ' + c.rewardBadge))
    .join('\n');
  assert(!corpus.includes('不是'), `事件 ${ev.id} 严禁包含“不是”二字`);
  assert(!/(修为|内力|真元|运功|调息|吐纳|法宝|灵气|丹田|功法|神识|底层逻辑|闭环|复盘)/.test(corpus), `事件 ${ev.id} 包含禁止词`);
});
assert(byPhase.duke >= 6 && byPhase.academy >= 6 && byPhase.journey >= 6, '三大阶段均须充实事件池');

// 时间线防剧透检验
const sYouth = freshPlayableState('youth');
const eligYouth = RE.getEligibleEvents(sYouth);
assert(eligYouth.every(e => e.phasePool === 'duke'), '公爵府时期绝对不得刷出学院/北境未来剧透事件');

const sEarlyAcad = freshPlayableState('academy');
sEarlyAcad.ageY = 12; sEarlyAcad.year = 12;
const eligEarlyAcad = RE.getEligibleEvents(sEarlyAcad);
assert(eligEarlyAcad.every(e => e.phasePool === 'academy'), '学院期只能刷出学院事件');
assert(!eligEarlyAcad.some(e => e.id === 'enc_acad_aino_glacier_drill'), '未结识艾诺前不得剧透极北冰窟切磋事件');

const sJourney = freshPlayableState('journey');
sJourney.flags.ch_distant_wind_1 = 1;
const eligJourney = RE.getEligibleEvents(sJourney);
assert(eligJourney.every(e => e.phasePool === 'journey'), '流亡旅途期只刷旅途与北境前线事件');

// 冰晶宫殿隐藏选项门控 + 因果推进 + 刷新/重掷机制
const sBoard = freshPlayableState('academy');
sBoard.flags.met_noelle = 1;
sBoard.skills = ['ice_crystal']; // 未学 ice_palace
win.__setS(sBoard); win.S = sBoard;
RE.refreshSeasonalBoard(sBoard, { rerolled: false });
const bInfo = RE.getSeasonalBoard(sBoard);
assert(bInfo.offers.length >= 2 && bInfo.offers.length <= 3, '每季度刷新 2-3 件奇遇');

// 测试带有 requiresIcePalace 的事件在未学与已学两种情况下的门控
const evWithPalace = RE.SEASONAL_EVENTS.find(e => e.phasePool === 'academy' && e.choices.some(c => c.requiresIcePalace));
assert(evWithPalace, '学院阶段须有含冰晶宫殿洞察选项的奇遇');
const pIdx = evWithPalace.choices.findIndex(c => c.requiresIcePalace);
sBoard.seasonalBoard.offers = [evWithPalace.id];
sBoard.seasonalBoard.done = {};
const blocked = RE.resolveEncounterChoice(evWithPalace.id, pIdx, sBoard);
assert.strictEqual(blocked.ok, false, '未习得冰晶宫殿时不得选取隐秘洞察选项');

sBoard.skills.push('ice_palace');
const prevSt = sBoard.st;
const okPick = RE.resolveEncounterChoice(evWithPalace.id, pIdx, sBoard);
assert.strictEqual(okPick.ok, true, '习得冰晶宫殿后应解锁并结算高回报隐秘选项');
assert(sBoard.st < prevSt || okPick.deltas.length > 0, '奇遇选项应真实消耗资源或产生收益变动');
assert(!okPick.epilogue.includes('不是'), '奇遇尾声文案严禁出现“不是”');

const rFailTwice = RE.resolveEncounterChoice(evWithPalace.id, pIdx, sBoard);
assert.strictEqual(rFailTwice.ok, false, '同季度已完成奇遇不可重复刷');

const rr1 = RE.rerollSeasonalBoard(sBoard);
assert.strictEqual(rr1.ok, true, '另探风声消耗 1 体力应成功刷新');
const rr2 = RE.rerollSeasonalBoard(sBoard);
assert.strictEqual(rr2.ok, false, '同一季度限刷新 1 次风声');
RE.onSeasonAdvanced(sBoard);
assert.strictEqual(sBoard.seasonalBoard.rerolled, false, '换季后应自动刷新传闻并重置重掷次数');

// Rumor Board DOM 弹窗可正常打开与关闭
RE.openRumorBoard();
assert(!win.document.getElementById('rumor-overlay').classList.contains('hidden'), '点击🎴奇遇入口应弹出传闻板');
RE.closeRumorBoard();

// ---------------------------------------------------------------------------
// 3. 战斗深度：实时战术悬停预测 / 破招连锁窗口 / 5 大羁绊心念援护
// ---------------------------------------------------------------------------
console.log('--- 3. 验证实时悬停预测、破招连锁窗口与 5 大羁绊心念援护 ---');
{
  const bUi = CE.startStage('noelle_14', { headless: false, usePreset: true, relics: [] });
  bUi.enemies[0].intent = { stance: 'DUAL_CAST', moveName: '悬空凝冰', dmg: 30 };
  // 悬停隔空瞬凝 -> 应预测触发截断破招 + 更新敌方血条预扣宽度
  const remoteBtn = win.document.querySelector('#b-actions [data-sk="remote_snap_spike"]');
  assert(remoteBtn, '技能栏应存在瞬发断咏冰锥按钮');
  remoteBtn.onmouseenter();
  const fcBar = win.document.getElementById('cb-forecast-bar');
  assert(fcBar.textContent.includes('截断破招'), `悬停瞬发断咏冰锥应显示破招预测（实得：${fcBar.textContent}）`);
  const previewBar = win.document.querySelector('.cb-ehp-preview[data-eidx="0"]');
  assert(previewBar && parseFloat(previewBar.style.width) > 0, '悬停技能时敌方血条应出现预扣区段');

  // 切至严密防反，预测应给出警告
  bUi.enemies[0].intent = { stance: 'GUARD_COUNTER', moveName: '高密冰盾', dmg: 18, counterRemoteHit: true };
  remoteBtn.onmouseenter();
  assert(fcBar.textContent.includes('严密防反'), '面对 GUARD_COUNTER 悬停远程应警示将衰减反击');
  CE.exitBattle(false, { silent: true });
}

// 破招连锁窗口 (breakChain): 1.35× 伤害 + 额外返还 15% MP，且 basic_attack 不消耗
{
  const bNoChain = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  const bChain = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  bChain.enemies[0].intent = { stance: 'DUAL_CAST', moveName: '双冰蛇阵', dmg: 40 };
  CE.useSkill('remote_snap_spike', 0, bChain);
  assert.strictEqual(bChain.player.status.breakChain, 1, '成功截断破招后本回合应开启连携追击状态');

  // basic_attack 不触发也不消耗 breakChain
  bChain.ap = 3;
  assert.strictEqual(CE.useSkill('basic_attack', 0, bChain).ok, true);
  assert.strictEqual(bChain.player.status.breakChain, 1, '基础平砍不应白白消耗连携追击');

  bChain.player.mp = 40;
  bNoChain.player.mp = 40;
  bNoChain.enemies[0].status.stagger = 1; // 同步失衡系数以确保只对比 breakChain 本身！
  bNoChain.enemies[0].intent = { stance: 'STAGGERED', moveName: '架势崩解', dmg: 0 };
  const dmgPlain = CE.estimateSkillDamage(bNoChain, CE.SKILLS.hand_ice_crystal, bNoChain.enemies[0]).dmg;
  const dmgBoosted = CE.estimateSkillDamage(bChain, CE.SKILLS.hand_ice_crystal, bChain.enemies[0]).dmg;
  const ratio = dmgBoosted / Math.max(1, dmgPlain);
  assert(ratio >= 1.30 && ratio <= 1.42, `连携追击增伤倍率应约 1.35×（实测 ${ratio.toFixed(3)}×）`);

  assert.strictEqual(CE.useSkill('hand_ice_crystal', 0, bChain).ok, true);
  assert(!bChain.player.status.breakChain, '打出非基础攻击牌后应消耗连携追击窗口');
  assert(bChain.player.mp > 40, '连携追击消耗后应返还额外魔力');
}

// 5 大羁绊心念援护：story+羁绊解锁门控、0 AP、每场 1 次、5 人效果全实装
{
  const sBond = freshPlayableState('journey');
  sBond.flags.ch_alice_born = 1;
  sBond.flags.met_noelle = 1;
  sBond.flags.met_aino = 1;
  sBond.flags.arrived_jikan = 1;
  sBond.flags.met_charlotte = 1;
  sBond.love.alice = 3; sBond.love.noelle = 3; sBond.love.aino = 3; sBond.love.jilan = 3; sBond.love.charlotte = 3;
  const unlockedBonds = RE.getUnlockedBondAssists(sBond);
  assert.strictEqual(unlockedBonds.length, 5, '结缘后 5 位伙伴均应解锁心念援护');

  // Alice：清 blind/burn + +1 afterimage + 15% MP（0 AP，仅 1 次）
  const bAl = CE.startStage('beatrice_11', { headless: true, usePreset: true, bondAssist: 'alice' });
  bAl.player.status.blind = 1; bAl.player.status.burn = 1; bAl.player.mp = 20;
  const ap0 = bAl.ap;
  assert.strictEqual(CE.useBondAssist(bAl).ok, true);
  assert.strictEqual(bAl.ap, ap0, '心念援护不消耗 AP');
  assert(!bAl.player.status.blind && !bAl.player.status.burn && bAl.player.status.afterimage === 1);
  assert(bAl.player.mp > 20);
  assert.strictEqual(CE.useBondAssist(bAl).ok, false, '每场战斗限用 1 次心念援护');

  // Noelle：本回合零耗蓝 + 回复 20% MP
  const bNoe = CE.startStage('noelle_14', { headless: true, usePreset: true, bondAssist: 'noelle' });
  bNoe.player.mp = 20;
  assert.strictEqual(CE.useBondAssist(bNoe).ok, true);
  assert.strictEqual(CE.computeSkillMpCost(bNoe.player, CE.SKILLS.hand_ice_crystal), 0, '诺艾儿援护本回合零耗蓝');
  assert(bNoe.player.mp > 20);

  // Aino：全体附加 2 层易伤与寒颤 + 当前目标削盾 30%
  const bAi = CE.startStage('noelle_14', { headless: true, usePreset: true, bondAssist: 'aino' });
  const sh0 = bAi.enemies[0].shield;
  assert.strictEqual(CE.useBondAssist(bAi).ok, true);
  assert.strictEqual(bAi.enemies[0].status.vuln, 2);
  assert.strictEqual(bAi.enemies[0].status.chill, 2);
  assert(bAi.enemies[0].shield <= Math.floor(sh0 * 0.7));

  // Jilan：+1 AP + 剑势蓄力 + 破目标 1 层闪避
  const bJi = CE.startStage('alice_9', { headless: true, usePreset: true, bondAssist: 'jilan' });
  bJi.ap = 1;
  const ev0 = bJi.enemies[0].evadeCharges;
  assert.strictEqual(CE.useBondAssist(bJi).ok, true);
  assert.strictEqual(bJi.ap, 2);
  assert.strictEqual(bJi.player.status.poise, 1);
  assert.strictEqual(bJi.enemies[0].evadeCharges, Math.max(0, ev0 - 1));

  // Charlotte：护盾补满（至少 +40）并开启冰镜反震，受击时反伤敌人
  const bCh = CE.startStage('beatrice_11', { headless: true, usePreset: true, bondAssist: 'charlotte' });
  bCh.player.shield = 0;
  assert.strictEqual(CE.useBondAssist(bCh).ok, true);
  assert(bCh.player.shield >= bCh.player.maxShield);
  assert.strictEqual(bCh.player.status.nobleReflect, 1);
  const eHp0 = bCh.enemies[0].hp;
  bCh.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '重劈', dmg: 20, elem: 'phys' };
  CE.endTurn(bCh);
  assert(bCh.enemies[0].hp < eHp0, '夏洛特贵族体面应使敌人在攻势中吃下冰镜反伤');
}

// ---------------------------------------------------------------------------
// 4. Galgame 基础 UX：Backlog（L 键 / 200 上限）、6 槽存读档、章节速览跳转
// ---------------------------------------------------------------------------
console.log('--- 4. 验证商业 Galgame UX 闭环（Backlog / 6槽存读档 / 章节跳转） ---');
{
  VN.clearBacklog();
  const sPlay = freshPlayableState('academy');
  sPlay.causal.axes.noelle.partnership = 3;
  RE.unlockRelic('frost_cipher', sPlay);
  RE.equipRelic('frost_cipher', { state: sPlay });
  sPlay.selectedBondAssist = 'noelle';
  RE.refreshSeasonalBoard(sPlay, { rerolled: false });
  win.__setS(sPlay); win.S = sPlay;

  win.show('title-screen', 0);
  win.show('game-screen', 1);
  win.playLines([
    { speaker: '诺艾儿', text: '把数据核验完再签字。' },
    { ch: 'sylvia', text: '正合我意。', choices: [{ text: '核对账目明细', do: () => {} }] },
  ]);
  win.document.getElementById('text-box').click();
  // 点击选项记录选择决策
  const chBtn = win.document.querySelector('#choices .choice');
  assert(chBtn, '推进到带选项的台词后应渲染剧情选项按钮');
  chBtn.click();

  const log1 = VN.getBacklog();
  assert(log1.length >= 3, `Backlog 应记录旁白/台词与抉择（当前 ${log1.length} 条）`);
  assert(log1.some(x => x.text.includes('核对账目明细') && x.kind === 'choice'), 'Backlog 须忠实记录玩家选项决策');

  // 测试 L 快捷键与 200 条上限
  for (let i = 0; i < 205; i++) VN.recordLine('旁白', `回看测试行-${i}`);
  assert.strictEqual(VN.getBacklog().length, 200, 'Backlog 上限应严格控制在 200 条');

  const keyEvt = new win.KeyboardEvent('keydown', { key: 'l', bubbles: true });
  win.document.dispatchEvent(keyEvt);
  assert(!win.document.getElementById('vn-backlog-modal').classList.contains('hidden'), '按下 L 键应打开 Backlog 回看面板');
  VN.closeBacklogModal();

  // 6 槽位手动存读档 + 1 自动存档槽完整序列化还原（含 S.causal、秘宝、季节奇遇、Backlog）
  const saveRes = VN.saveToSlot(3);
  assert.strictEqual(saveRes.ok, true);
  win.save(); // 触发自动存档镜像

  const slots = VN.getSlotList();
  assert.strictEqual(slots.length, 7, '应包含 1 自动档位 + 6 手动档位');
  assert.strictEqual(slots[0].isAuto, true);
  assert.strictEqual(slots[3].empty, false);
  assert(slots[3].meta.locName && slots[3].meta.ageStr, '存档槽摘要应含年龄、地点等元信息');

  // 故意改坏当前状态后从槽位 3 还原
  const dirty = freshPlayableState('youth');
  dirty.causal.axes.noelle.partnership = 0;
  dirty.equippedRelics = [];
  dirty.selectedBondAssist = null;
  VN.clearBacklog();
  win.__setS(dirty); win.S = dirty;

  const loadRes = VN.loadFromSlot(3);
  assert.strictEqual(loadRes.ok, true);
  const restored = win.__getS();
  assert.strictEqual(restored.phase, 'academy');
  assert.strictEqual(restored.causal.axes.noelle.partnership, 3, '读档应完整恢复 S.causal');
  assert(restored.equippedRelics.includes('frost_cipher'), '读档应完整恢复秘宝佩带');
  assert.strictEqual(restored.selectedBondAssist, 'noelle', '读档应完整恢复心念援护选择');
  assert.strictEqual(VN.getBacklog().length, 200, '读档应完整恢复该槽位保存的对话历史');

  assert.strictEqual(VN.deleteSlot(3), true);
  assert.strictEqual(VN.getSlotList()[3].empty, true, '删除槽位后应恢复空置');

  // 章节跳转：Vol 1 / Vol 2 / Vol 3 全部核心入口无崩溃切换
  ['s_start', 's_opening_ceremony', 's_north_forest', 's_leaky_cup'].forEach(chapId => {
    const okJump = VN.jumpToChapter(chapId);
    assert.strictEqual(okJump, true, `章节跳转 ${chapId} 应成功执行`);
    const stAfter = win.__getS();
    assert(stAfter && stAfter.loc, `章节跳转 ${chapId} 后应具备有效位置与状态`);
    if (chapId === 's_opening_ceremony') assert.strictEqual(stAfter.phase, 'academy');
    if (chapId === 's_north_forest') assert.strictEqual(stAfter.phase, 'journey');
    if (chapId === 's_leaky_cup') assert.strictEqual(win.__LOCS.ice_canyon.unlock, true);
  });
}

// ---------------------------------------------------------------------------
// 5. 全量新文案扫描：零禁用转折腔 + 零修仙/技工违禁词
// ---------------------------------------------------------------------------
console.log('--- 5. 校验全部新增模块化 JS 文案不含纠正式转折腔与修仙/技工禁用词 ---');
const CONTRASTIVE_RE = /不是[^。！？\n”」』]{1,36}?[，,、]\s*(?:而是|却|但|偏偏|反倒)|并非[^。！？\n”」』]{1,36}?[，,、]?\s*而是/;
const FORBIDDEN_PROSE_RE = /(修为|内力|真元|运功|调息|吐纳|法宝|灵气|丹田|功法|神识|底层逻辑|闭环|复盘|外面看|法子|冻出)/;
['js/relics-and-events.js', 'js/vn-ux.js'].forEach(rel => {
  const txt = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  assert(!txt.includes('不是'), `${rel} 须保持零“不是”二字`);
  assert(!CONTRASTIVE_RE.test(txt), `${rel} 严禁出现纠正式转折腔（不是……，而是/却/但）`);
  assert(!FORBIDDEN_PROSE_RE.test(txt), `${rel} 严禁出现修仙/现代技工禁用词`);
});

assert.strictEqual(errors.length, 0, '全程不得出现任何 JS/DOM 异常: ' + errors.join('\n'));
console.log('✅ gameplay_depth_v2 全部测试通过');
