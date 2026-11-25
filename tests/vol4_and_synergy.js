'use strict';
/**
 * M3 / M4 / M6.1 第四卷主线、4 大铭记套装共鸣、跨季链式奇遇与演武第 8/9 幕综合测试
 */
const fs = require('node:fs');
const path = require('node:path');
const { win, errors } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const doc = win.document;
const $ = (id) => doc.getElementById(id);
const vis = (id) => {
  const el = $(id);
  return !!(el && !el.classList.contains('hidden'));
};

if (win.HTMLMediaElement && win.HTMLMediaElement.prototype) {
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.HTMLMediaElement.prototype.pause = () => {};
}

let sd = 0;
win.setTimeout = (fn) => { if (++sd > 160000) { sd--; return 0; } try { fn(); } finally { sd--; } return 0; };
win.setInterval = () => 0;
win.clearInterval = () => 0;
win.clearTimeout = () => 0;
win.__setTypingDrain();

const CE = win.CombatEngine;
const RE = win.RelicsAndEvents;
const BD = win.BranchingDirector;

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (cond) pass++;
  else fail++;
}

function driveUntilFree(maxSteps = 25000) {
  for (let i = 0; i < maxSteps; i++) {
    if (vis('cg-screen')) { const c = $('cg-screen'); if (typeof c.onclick === 'function') { c.onclick(); continue; } }
    if (vis('card')) { const c = $('card'); if (typeof c.onclick === 'function') { c.onclick(); continue; } }
    if (vis('pick-screen')) {
      const card = doc.querySelector('#pick-grid .pick-card:not(.disabled)');
      if (card && typeof card.onclick === 'function') { card.onclick(); continue; }
    }
    if (vis('battle-screen')) {
      const doneBtn = $('cr-done');
      if (doneBtn) { doneBtn.click(); continue; }
      const b = CE.getState();
      if (b && !b.over && b.enemies && b.enemies.length) {
        // 剧情遭遇战快进收敛，避免受随机 RNG 拖长
        b.enemies.forEach((e) => { if (e.hp > 1) e.hp = 1; e.shield = 0; e.evadeCharges = 0; });
      }
      const skBtn = doc.querySelector('#b-actions .cb-skill-card:not(:disabled), #b-actions .choice:not(:disabled)');
      if (skBtn) { skBtn.click(); continue; }
      const endBtn = $('cb-btn-endturn');
      if (endBtn) { endBtn.click(); continue; }
    }
    const chBox = $('choices');
    if ((win.__getAwaiting() || (chBox && chBox.children.length)) && chBox) {
      const cbtn = chBox.querySelector('.choice:not(:disabled)');
      if (cbtn && typeof cbtn.onclick === 'function') { cbtn.onclick(); continue; }
    }
    if (win.__drain.length) { win.__drain.shift()(); continue; }
    if (win.__getStoryChain()) continue;
    if (win.__getS().freeRoam) break;
    break;
  }
}

console.log('\n===== 1. 4 大铭记套装共鸣（RelicsAndEvents + CombatEngine 实战联动） =====');

// 1.1) getActiveSynergies 2件/3件阈值校验
const synDk2 = RE.getActiveSynergies(['ice_pebble', 'blue_vial']);
const synDk3 = RE.getActiveSynergies(['ice_pebble', 'blue_vial', 'alice_flower_cake']);
const synAc2 = RE.getActiveSynergies(['belmont_schedule', 'cross']);
const synAc3 = RE.getActiveSynergies(['noelle_manuscript', 'belmont_schedule', 'cross']);
const synJk2 = RE.getActiveSynergies(['ebony_sword', 'frost_cipher']);
const synNf2 = RE.getActiveSynergies(['aino_academy_handkerchief', 'aino_frost_shard']);
const synNf3 = RE.getActiveSynergies(['aino_academy_handkerchief', 'aino_frost_shard', 'northwind_pass']);

ok('RelicsAndEvents.getActiveSynergies 准确识别全部 4 套铭记共鸣的 2 件与 3 件阶梯',
  synDk2.length === 1 && synDk2[0].id === 'dukedom_memory' && synDk2[0].tier === 2
  && synDk3.length === 1 && synDk3[0].tier === 3
  && synAc2.length === 1 && synAc2[0].id === 'academy_stars' && synAc2[0].tier === 2
  && synAc3.length === 1 && synAc3[0].tier === 3
  && synJk2.length === 1 && synJk2[0].id === 'jikan_blade' && synJk2[0].tier === 2
  && synNf2.length === 1 && synNf2[0].id === 'north_frost' && synNf2[0].tier === 2
  && synNf3.length === 1 && synNf3[0].tier === 3);

// 1.2) 公爵府遗忆 (dukedom_memory): 2pc T1 +1 AP / +10 盾；3pc 首水/冰技回 10% MP + 首护盾技 +1 残像
{
  const bDk2 = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['ice_pebble', 'blue_vial'] });
  const bDk3 = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['ice_pebble', 'blue_vial', 'alice_flower_cake'] });
  const t1Ok = bDk2.ap === 3 && bDk2.player.shield >= 10 && bDk3.ap === 3 && bDk3.player.shield >= 10;

  bDk3.player.mp = 40;
  const beforeAi = bDk3.player.status.afterimage || 0;
  CE.useSkill('hand_water_surge', 0, bDk3);
  const elemRecOk = bDk3._synDukedomElemTurn === bDk3.turn;
  CE.useSkill('hand_ice_wall', 0, bDk3);
  const shieldAiOk = (bDk3.player.status.afterimage || 0) === beforeAi + 1;
  ok('【公爵府遗忆】2/3 件实效：首回合 +1 AP/+10 盾，首水冰技回蓝且首盾技附 1 层风行残像',
    t1Ok && elemRecOk && shieldAiOk,
    `ap=${bDk2.ap}, sh=${bDk2.player.shield}, elemRec=${elemRecOk}, ai=${beforeAi}->${bDk3.player.status.afterimage}`);
}

// 1.3) 学院星辉 (academy_stars): 2pc 冰宫看破附 2 层易伤 + 回 12% MP；3pc 额外省蓝 15% + 1.65x 暴击
{
  const bAc2 = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: ['belmont_schedule', 'cross'] });
  bAc2.waveTurn = 2;
  bAc2.player.mp = 40;
  const cfg = CE.getCurrentPalaceConfig(bAc2);
  const cOk = cfg.clues.find((c) => c.correct);
  const dOk = cfg.deductions.find((d) => d.correct);
  const expectedMp = 40 + Math.max(10, Math.round(bAc2.player.mmp * 0.12));
  const res = CE.inspectClue(cOk.id, dOk.id, bAc2);
  const t2Ok = res.correct && (bAc2.enemies[0].status.vuln || 0) >= 2 && bAc2.player.mp === expectedMp;

  const bSingle = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['noelle_manuscript'], forceCrit: true });
  const bAc3 = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['noelle_manuscript', 'belmont_schedule', 'cross'], forceCrit: true });
  const mpSingle = CE.computeSkillMpCost(bSingle.player, CE.SKILLS.hand_ice_crystal);
  const mpAc3 = CE.computeSkillMpCost(bAc3.player, CE.SKILLS.hand_ice_crystal);
  bSingle.enemies[0].shield = 0; bAc3.enemies[0].shield = 0;
  const hpS0 = bSingle.enemies[0].hp; const hp30 = bAc3.enemies[0].hp;
  CE.useSkill('hand_ice_crystal', 0, bSingle);
  CE.useSkill('hand_ice_crystal', 0, bAc3);
  const dmgSingle = hpS0 - bSingle.enemies[0].hp;
  const dmgAc3 = hp30 - bAc3.enemies[0].hp;

  ok('【学院星辉】2/3 件实效：冰宫看破附 2 层易伤并回 12% MP，3 件再省蓝 15% 且暴击升至 1.65x',
    t2Ok && mpAc3 < mpSingle && dmgAc3 > dmgSingle,
    `vuln=${bAc2.enemies[0].status.vuln}, mp=${bAc2.player.mp}/${expectedMp}, cost=${mpSingle}->${mpAc3}, critDmg=${dmgSingle}->${dmgAc3}`);
}

// 1.4) 霁馆剑心 (jikan_blade): 2pc 剑技暴击/破招额外 +1 AP + 迎锋反制魔战双倍回蓝
{
  const bEb = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: ['ebony_sword'], forceCrit: true });
  const bJk = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: ['ebony_sword', 'frost_cipher'], forceCrit: true });
  bEb.enemies[0].shield = 0; bJk.enemies[0].shield = 0;
  bEb.enemies[0].intent = { stance: 'CLOSE_LUNGE', moveName: '扑咬', dmg: 24 };
  bJk.enemies[0].intent = { stance: 'CLOSE_LUNGE', moveName: '扑咬', dmg: 24 };
  bEb.player.mp = 40; bJk.player.mp = 40;
  bEb.ap = 2; bJk.ap = 2;
  CE.useSkill('sword_water_edge', 0, bEb);
  CE.useSkill('sword_water_edge', 0, bJk);
  ok('【霁馆剑心】2 件实效：剑技暴击额外返还 AP 且迎锋反制魔战回蓝翻倍',
    bJk.ap === 3 && bEb.ap === 2 && bJk.metrics.manaRecycled > bEb.metrics.manaRecycled && bJk.player.mp > bEb.player.mp,
    `ap:${bEb.ap}->${bJk.ap}, recycled:${bEb.metrics.manaRecycled}->${bJk.metrics.manaRecycled}`);
}

// 1.5) 北境霜锋 (north_frost): 2pc 开局 +10 盾 + 冰系穿 15% 法抗；3pc 首隔空冰技附 2 层寒颤 + 15% 碎霜伤
{
  const bNf1 = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['aino_academy_handkerchief'] });
  const bNf2 = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['aino_academy_handkerchief', 'aino_frost_shard'] });
  const bNf3 = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: ['aino_academy_handkerchief', 'aino_frost_shard', 'northwind_pass'] });
  const shOk = bNf1.player.shield === 0 && bNf2.player.shield >= 10 && bNf3.player.shield >= 22;
  const iceDmg1 = CE.estimateSkillDamage(bNf1, CE.SKILLS.hand_ice_crystal, bNf1.enemies[0]).dmg;
  const iceDmg2 = CE.estimateSkillDamage(bNf2, CE.SKILLS.hand_ice_crystal, bNf2.enemies[0]).dmg;
  const remDmg2 = CE.estimateSkillDamage(bNf2, CE.SKILLS.remote_snap_spike, bNf2.enemies[0]).dmg;
  const remEst3 = CE.estimateSkillDamage(bNf3, CE.SKILLS.remote_snap_spike, bNf3.enemies[0]);
  CE.useSkill('remote_snap_spike', 0, bNf3);
  ok('【北境霜锋】2/3 件实效：回合初 +10 盾、冰系穿抗 15%，3 件首隔空冰技碎霜增伤并附 2 层寒颤',
    shOk && iceDmg2 > iceDmg1 && remEst3.northFrostShatter && remEst3.dmg > remDmg2 && (bNf3.enemies[0].status.chill || 0) >= 2,
    `sh:${bNf1.player.shield}/${bNf2.player.shield}/${bNf3.player.shield}, ice:${iceDmg1}->${iceDmg2}, rem:${remDmg2}->${remEst3.dmg}, chill=${bNf3.enemies[0].status.chill}`);
}

console.log('\n===== 2. 跨季多幕链式奇遇 (chain_peilin_trade / chain_white_moss / chain_astrolabe_letter) =====');

function makeChainState(phase) {
  const s = win.baseState();
  s.phase = phase;
  s.ageY = phase === 'journey' ? 16 : 13;
  s.year = s.ageY;
  s.month = 3;
  s.season = 0;
  s.st = 8; s.mst = 8;
  s.mp = 200; s.mmp = 200;
  s.hp = 200; s.mhp = 200;
  s.gold = 60;
  s.skills = ['ice_palace', 'ice_crystal'];
  s.flags = { named: 1, met_noelle: 1, met_charlotte: 1, arrived_jikan: 1, ch_distant_wind_1: 1 };
  BD.ensureCausalState(s);
  RE.ensureRelicsState(s);
  RE.refreshSeasonalBoard(s, { rerolled: false });
  win.__setS(s);
  win.S = s;
  return s;
}

function advanceQuarter(s) {
  s.season = (s.season + 1) % 4;
  s.month = [3, 6, 9, 12][s.season];
  if (s.season === 0) s.year += 1;
  s.st = s.mst;
  s.mp = s.mmp;
  s.hp = s.mhp;
  RE.onSeasonAdvanced(s);
}

// 2.1) chain_peilin_trade (3幕)
{
  const s = makeChainState('journey');
  const elig0 = RE.getEligibleEvents(s).map((e) => e.id);
  const act1Only = elig0.includes('enc_jrn_peilin_act1') && !elig0.includes('enc_jrn_peilin_act2') && !elig0.includes('enc_jrn_peilin_act3');
  s.seasonalBoard.offers = ['enc_jrn_peilin_act1']; s.seasonalBoard.done = {};
  const r1 = RE.resolveEncounterChoice('enc_jrn_peilin_act1', 0, s);
  const blockedSameQ = !RE.getEligibleEvents(s).some((e) => e.id === 'enc_jrn_peilin_act2');
  advanceQuarter(s);
  const elig2 = RE.getEligibleEvents(s).some((e) => e.id === 'enc_jrn_peilin_act2');
  s.seasonalBoard.offers = ['enc_jrn_peilin_act2']; s.seasonalBoard.done = {};
  const r2 = RE.resolveEncounterChoice('enc_jrn_peilin_act2', 0, s);
  advanceQuarter(s);
  const elig3 = RE.getEligibleEvents(s).some((e) => e.id === 'enc_jrn_peilin_act3');
  s.seasonalBoard.offers = ['enc_jrn_peilin_act3']; s.seasonalBoard.done = {};
  const r3 = RE.resolveEncounterChoice('enc_jrn_peilin_act3', 0, s);
  ok('链式奇遇 chain_peilin_trade 严格跨季推进 3 幕并写入 S.causal 与解锁北风堡木牌',
    act1Only && r1.ok && blockedSameQ && elig2 && r2.ok && elig3 && r3.ok
    && s.encounterChains.peilin_trade_stage === 3
    && s.causal.axes.jilan.wanderlust >= 1 && s.causal.axes.aino.kinship >= 3
    && RE.isRelicUnlocked('northwind_pass', s));
}

// 2.2) chain_white_moss (2幕)
{
  const s = makeChainState('journey');
  s.seasonalBoard.offers = ['enc_jrn_northwind_black_market']; s.seasonalBoard.done = {};
  const r1 = RE.resolveEncounterChoice('enc_jrn_northwind_black_market', 1, s); // 冰晶宫殿拓印暗号
  const sameQWait = !RE.getEligibleEvents(s).some((e) => e.id === 'enc_jrn_white_moss_audit');
  advanceQuarter(s);
  const nextQReady = RE.getEligibleEvents(s).some((e) => e.id === 'enc_jrn_white_moss_audit');
  s.seasonalBoard.offers = ['enc_jrn_white_moss_audit']; s.seasonalBoard.done = {};
  const r2 = RE.resolveEncounterChoice('enc_jrn_white_moss_audit', 0, s);
  ok('链式奇遇 chain_white_moss 跨季推进 2 幕、点亮线索写入 S.causal 并解锁钢冰试炼笺',
    r1.ok && sameQWait && nextQReady && r2.ok
    && s.encounterChains.white_moss_stage === 2
    && s.causal.clues.belmont_troop_shift === true
    && s.causal.axes.aino.austere_mentor >= 3
    && RE.isRelicUnlocked('aino_frost_shard', s));
}

// 2.3) chain_astrolabe_letter (3幕)
{
  const s = makeChainState('academy');
  s.seasonalBoard.offers = ['enc_acad_astrolabe_act1']; s.seasonalBoard.done = {};
  const r1 = RE.resolveEncounterChoice('enc_acad_astrolabe_act1', 0, s);
  advanceQuarter(s);
  const ready2 = RE.getEligibleEvents(s).some((e) => e.id === 'enc_acad_astrolabe_act2');
  s.seasonalBoard.offers = ['enc_acad_astrolabe_act2']; s.seasonalBoard.done = {};
  const r2 = RE.resolveEncounterChoice('enc_acad_astrolabe_act2', 0, s);
  advanceQuarter(s);
  const ready3 = RE.getEligibleEvents(s).some((e) => e.id === 'enc_acad_astrolabe_act3');
  s.seasonalBoard.offers = ['enc_acad_astrolabe_act3']; s.seasonalBoard.done = {};
  const r3 = RE.resolveEncounterChoice('enc_acad_astrolabe_act3', 0, s);
  ok('链式奇遇 chain_astrolabe_letter 跨季推进 3 幕、推动诺艾儿同盟轴并解锁省魔手稿',
    r1.ok && ready2 && r2.ok && ready3 && r3.ok
    && s.encounterChains.astrolabe_stage === 3
    && s.causal.axes.noelle.partnership >= 6
    && RE.isRelicUnlocked('noelle_manuscript', s));
}

console.log('\n===== 3. 战术演武第 8/9 幕、Boss 二阶段蜕变、S/A/B 复盘、狼徽区分与心念援护锁提示 =====');

ok('演武新增第 8 幕 (turning_point_corridor) 与第 9 幕 (wind_god_eye) 已完整注册',
  !!(CE.STAGES.turning_point_corridor && CE.STAGES.turning_point_corridor.order === 8
    && CE.STAGES.wind_god_eye && CE.STAGES.wind_god_eye.order === 9));

// 3.1) 第 8 幕 Wave 2 Boss 半血触发二阶段
{
  const b8 = CE.startStage('turning_point_corridor', { headless: true, usePreset: true, relics: [] });
  b8.enemies.forEach((e) => { e.shield = 0; e.hp = 1; });
  CE.useSkill('hand_thorn_field', 0, b8); // 清掉第 1 波进入第 2 波红莲铁幕
  const boss = b8.enemies[0];
  const inWave2 = b8.waveIdx === 1 && boss && boss.id === 'eastwing_commander';
  boss.shield = 0;
  boss.hp = Math.floor(boss.mhp * 0.5) + 8;
  b8.ap = 2;
  CE.useSkill('hand_water_surge', 0, b8);
  ok('第 8 幕「转折点·东翼火廊突围战」红莲铁幕 <=50% HP 触发二阶段蜕变 (phase2Triggered + 刷盾)',
    inWave2 && boss.phase === 2 && b8.metrics.phase2Triggered === true && boss.shield >= 72,
    `wave=${b8.waveIdx}, phase=${boss && boss.phase}, p2=${b8.metrics.phase2Triggered}, sh=${boss && boss.shield}`);
}

// 3.2) 第 9 幕风神半血触发二阶段 + showResultModal 渲染 S/A/B 战术复盘拆解
{
  win.show('title-screen', 0);
  win.show('game-screen', 1);
  const b9 = CE.startStage('wind_god_eye', { headless: false, fromArena: true, usePreset: true, relics: [] });
  const boss = b9.enemies[0];
  boss.evadeCharges = 0;
  boss.shield = 0;
  boss.hp = Math.floor(boss.mhp * 0.5) + 10;
  CE.useSkill('hand_ice_crystal', 0, b9);
  const p2Ok = boss.phase === 2 && b9.metrics.phase2Triggered === true && boss.shield >= 68;

  // 击破 Boss 弹出结算复盘弹窗
  boss.evadeCharges = 0;
  boss.shield = 0;
  boss.hp = 1;
  b9.ap = 2;
  CE.useSkill('hand_ice_crystal', 0, b9);
  const modal = $('cb-result-modal');
  const breakdown = modal && modal.querySelector('.cr-tactical-breakdown');
  const pillText = (modal && modal.querySelector('.crtb-tier-pill') && modal.querySelector('.crtb-tier-pill').textContent) || '';
  const commentaryText = (modal && modal.querySelector('.crtb-commentary') && modal.querySelector('.crtb-commentary').textContent) || '';
  const tbS = CE.buildTacticalBreakdown({ won: true, grade: 'S', turn: 4, metrics: { interrupts: 2, ripostes: 1, insights: 1, manaRecycled: 150, phase2Triggered: true }, player: { hp: 200, mhp: 200, shield: 20, hasManaCycle: true, palaceMax: 1 } });
  const tbA = CE.buildTacticalBreakdown({ won: true, grade: 'A', turn: 6, metrics: { interrupts: 1, ripostes: 0, insights: 0, manaRecycled: 60, phase2Triggered: false }, player: { hp: 150, mhp: 200, shield: 0, hasManaCycle: true, palaceMax: 1 } });
  const tbB = CE.buildTacticalBreakdown({ won: true, grade: 'B', turn: 9, metrics: { interrupts: 0, ripostes: 0, insights: 0, manaRecycled: 20, phase2Triggered: false }, player: { hp: 60, mhp: 200, shield: 0, hasManaCycle: true, palaceMax: 1 } });
  CE.exitBattle(true, { silent: true });

  ok('第 9 幕「风神·风暴眼试剑」半血触发二阶段，且 showResultModal 渲染 S/A/B 战术复盘拆解卡',
    p2Ok && !!breakdown && /[SAB] 级/.test(pillText) && commentaryText.length >= 10
    && tbS.tier === 'S' && tbA.tier === 'A' && tbB.tier === 'B'
    && tbS.tierLabel.includes('S') && tbA.tierLabel.includes('A') && tbB.tierLabel.includes('B'),
    `p2=${p2Ok}, pill=${pillText}`);
}

// 3.3) wolf_alpha vs pack_wolf SVG 徽章视觉区分（含第 8/9 幕徽章）
{
  const alphaSvg = CE.renderBeastCrestSVG('wolf_alpha:pack_wolf:灰棘头狼');
  const packSvg = CE.renderBeastCrestSVG('wolf_b:pack_wolf:灰棘狼·甲');
  const eastwingSvg = CE.renderBeastCrestSVG('eastwing');
  const windGodSvg = CE.renderBeastCrestSVG('wind_god');
  ok('renderBeastCrestSVG 清晰区分灰棘头狼 (wolf_alpha 金环红眸王冠) 与普通灰棘狼 (pack_wolf 银蓝简章)',
    alphaSvg.includes('<svg') && packSvg.includes('<svg')
    && alphaSvg !== packSvg && alphaSvg.includes('#ff4260') && alphaSvg.includes('#e8c370')
    && !packSvg.includes('#ff4260')
    && eastwingSvg.includes('<svg') && windGodSvg.includes('<svg') && eastwingSvg !== windGodSvg);
}

// 3.4) 未配置羁绊心念援护时隐藏 #cb-btn-assist，装备援护时清晰显示
{
  win.__resetS();
  const sNoBond = win.__getS();
  sNoBond.love = {};
  sNoBond.know = {};
  sNoBond.selectedBondAssist = null;
  win.__setS(sNoBond);
  win.S = sNoBond;
  CE.startStage('beatrice_11', { headless: false, usePreset: true, bondAssist: null });
  const assistBtn = $('cb-btn-assist');
  const hiddenOk = !!(assistBtn && assistBtn.classList.contains('hidden')
    && assistBtn.disabled === true
    && assistBtn.classList.contains('locked-hint'));
  CE.exitBattle(false, { silent: true });

  CE.startStage('beatrice_11', { headless: false, usePreset: true, bondAssist: 'alice' });
  const assistBtnShown = $('cb-btn-assist');
  const shownOk = !!(assistBtnShown && !assistBtnShown.classList.contains('hidden')
    && assistBtnShown.disabled === false
    && !assistBtnShown.classList.contains('locked-hint')
    && assistBtnShown.textContent.includes('爱丽丝'));
  CE.exitBattle(false, { silent: true });
  ok('未配置羁绊心念援护时隐藏 #cb-btn-assist，装备援护时正常显示且可用', hiddenOk && shownOk);
}

console.log('\n===== 4. 间章《白昼里的夜》剧本 (js/story-vol4.js) 合并、目录顺序、静态合规与通关 =====');

const VOL3_ORDER = [
  's_north_forest', 's_glow_sheep', 's_distant_wind_1',
  's_words_to_wind', 's_eye_of_storm', 's_leaky_cup',
];
const VOL4_SCENES = ['s_interlude_white_night'];
const chapIds = (win.__STORY_CHAPTERS || []).map((c) => c.id);
const vol3Indices = VOL3_ORDER.map((id) => chapIds.indexOf(id));
const vol4Indices = VOL4_SCENES.map((id) => chapIds.indexOf(id));
const vol3Consecutive = vol3Indices.every((idx, i) => idx >= 0 && (i === 0 || idx === vol3Indices[i - 1] + 1));
const vol4AfterVol3 = vol4Indices.every((idx, i) => idx > vol3Indices[vol3Indices.length - 1] && (i === 0 || idx > vol4Indices[i - 1]));

ok('js/story-vol4.js 原著间章合并入 SCENES 与 STORY_CHAPTERS（第三卷 6 章连续正序，且不含额外草稿章）',
  VOL4_SCENES.every((id) => !!win.SCENES[id]) && vol3Consecutive && vol4AfterVol3
  && !win.SCENES.s_distant_wind_2 && !win.SCENES.s_vol4_frost_watch && !win.SCENES.s_vol4_wind_echo
  && !chapIds.includes('s_distant_wind_2') && !chapIds.includes('s_vol4_frost_watch') && !chapIds.includes('s_vol4_wind_echo'),
  `vol3=${vol3Indices.join(',')}, vol4=${vol4Indices.join(',')}`);

// 校验 bgm / bg / loc / 零纯文本面板框字符
const styleCss = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const boxDrawingRe = /[┌┐└┘├┤┬┴┼─═║╔╗╚╝]/;
const staticIssues = [];
for (const sid of VOL4_SCENES) {
  const sc = win.SCENES[sid];
  if (!sc.bgm || !win.BGM_GROUPS[sc.bgm]) staticIssues.push(`${sid}:bad-bgm(${sc.bgm})`);
  if (!sc.loc || !win.__LOCS[sc.loc]) staticIssues.push(`${sid}:bad-loc(${sc.loc})`);
  if (!sc.bg || !sc.bg.split(/\s+/).every((cls) => styleCss.includes('.' + cls))) staticIssues.push(`${sid}:bad-bg(${sc.bg})`);
  const walkLines = (arr) => {
    for (const ln of (arr || [])) {
      if (!ln) continue;
      if (ln.text && boxDrawingRe.test(ln.text)) staticIssues.push(`${sid}:box-char`);
      if (ln.loc && !win.__LOCS[ln.loc]) staticIssues.push(`${sid}:line-bad-loc(${ln.loc})`);
      if (ln.bgm && !win.BGM_GROUPS[ln.bgm]) staticIssues.push(`${sid}:line-bad-bgm(${ln.bgm})`);
      if (ln.bg && !ln.bg.split(/\s+/).every((cls) => styleCss.includes('.' + cls))) staticIssues.push(`${sid}:line-bad-bg(${ln.bg})`);
      if (Array.isArray(ln.choices)) ln.choices.forEach((ch) => walkLines(ch.lines));
    }
  };
  walkLines(sc.lines);
}
ok('间章 s_interlude_white_night 显式配置合法 bgm / bg / loc 且零纯文本面板框线字符',
  staticIssues.length === 0, staticIssues.join(', '));

// 完整试玩到 freeRoam
win.show('title-screen', 0);
win.show('game-screen', 1);

win.__resetS();
win.__drain.length = 0;
win.__runScene('s_interlude_white_night');
driveUntilFree();
const sInter = win.__getS();
ok('间章 s_interlude_white_night 完整通关至 freeRoam 并置位 ch_interlude_white_night',
  sInter.freeRoam === true && !!sInter.flags.ch_interlude_white_night);

const realErrors = errors.filter((e) => !/HTMLMediaElement|play\(\)/.test(e));
ok('全程零未捕获 JS/DOM 运行时异常', realErrors.length === 0, realErrors.join(' | '));

console.log(`\n通过: ${pass} | 失败: ${fail}`);
process.exit(fail ? 1 : 0);
