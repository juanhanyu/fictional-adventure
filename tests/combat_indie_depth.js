'use strict';
// =========================================================
// 《转生千金》V3.2 核心战斗单测与深度平衡验证套件
// 覆盖：COMBAT_BALANCE_V32 唯一数值事实源 + 全 15 招 5+1 进化技能 + CombatTimingRing 缩圈与线性等阶差格挡
//       + Boss P2 觉醒缓冲 + 双波首领重开快照 + 独立休闲模式 4 杠杆 + 主线 1–8 幕常规/休闲可解 + 第 9 幕神级风神
//       + 主线存档 AGE_FLOOR_V3/六维 tanh 软上限 + 6+6 DOM/原地切靶/CrystalSFX amp_charge
// =========================================================
const fs = require('fs');
const path = require('path');
const h = require('./harness.js');
const win = h.win;
const $ = id => win.document.getElementById(id);

let fail = 0;
let pass = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (cond) pass++;
  else fail++;
}

function approx(a, b, eps = 1e-4) {
  return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= eps;
}

const CE = win.CombatEngine;
const CTR = win.CombatTimingRing;

ok('Harness 零错误载入且同时挂载 CombatEngine 与 CombatTimingRing',
  h.errors.length === 0 &&
  !!CE && typeof CE.simulateBattle === 'function' &&
  !!CTR && typeof CTR.getBeatSpec === 'function' && typeof CTR.calcRingBonus === 'function' && typeof CTR.calcBlockRate === 'function',
  JSON.stringify({ errors: h.errors.slice(0, 3), hasCE: !!CE, hasCTR: !!CTR }));

ok('收录全部 9 场代表性关卡与 15 招 5+1 进化技能，COMBAT_BALANCE_V32 别名同步',
  CE && Object.keys(CE.STAGES).length === 9 && Object.keys(CE.SKILLS).length === 15 &&
  !!CE.COMBAT_BALANCE_V32 && CE.COMBAT_BALANCE_V32 === CE.COMBAT_BALANCE_V22,
  JSON.stringify({ stages: CE && Object.keys(CE.STAGES).length, skills: CE && Object.keys(CE.SKILLS).length }));

// 统一初始偏好状态（测试末尾恢复默认）
CE.setCasualMode(false);
CE.setAssistMode('standard');

function canUseSkill(b, id) {
  const sk = CE.SKILLS[id];
  if (!sk || !b.player.skills.includes(id)) return false;
  if ((b.player.cooldowns[id] || 0) > 0) return false;
  if (sk.maxUses && (b.player.usedMaxSkills[id] || 0) >= sk.maxUses) return false;
  if (b.ap < CE.computeSkillApCost(b, sk)) return false;
  const mpCost = CE.computeSkillMpCost(b.player, sk);
  if (b.player.mp < mpCost && !sk.allowZeroMpFallback) return false;
  return true;
}

// ===== 1. COMBAT_BALANCE_V32 唯一数值事实源与运行时精算校验 =====
console.log('\n[1] COMBAT_BALANCE_V32 唯一数值事实源、线性增幅/省蓝下限/法杖/壁垒与原著铁律校验');
{
  const B32 = CE.COMBAT_BALANCE_V32;
  ok('V3.2 基础常量对齐：defK=80 / maxDefPierce=0.75 / minMpDiscountFloor=0.60 / manaCycleReturnRatio=1.00 / breakAdd=0.10 / critMaxMult=1.70',
    B32.defK === 80 && B32.DEF_K === 80 &&
    B32.maxDefPierce === 0.75 &&
    B32.minMpDiscountFloor === 0.60 && B32.MIN_MP_DISCOUNT_FLOOR === 0.60 &&
    B32.manaCycleReturnRatio === 1.00 && B32.MANA_CYCLE.returnRatio === 1.00 &&
    B32.breakAdd === 0.10 && B32.HSR_AV.breakAdd === 0.10 &&
    B32.critBaseChance === 0.05 && B32.critBaseMult === 1.50 && B32.critMaxMult === 1.70,
    JSON.stringify({ defK: B32.defK, floor: B32.minMpDiscountFloor, breakAdd: B32.breakAdd, critMax: B32.critMaxMult }));

  const tierAdd = B32.ampTiers.map(t => t.addDmg);
  const tierPierce = B32.ampTiers.map(t => t.defPierce);
  const tierLocks = B32.ampTiers.map(t => t.extraLocks);
  const tierShield = B32.ampTiers.map(t => t.shieldMult);
  ok('三阶魔力增幅唯一事实源：ampAdd=[0,0.20,0.40,0.60] / defPierce=[0,0.10,0.22,0.35] / extraLocks=[0,1,2,3] / shieldMult=[1.00,1.25,1.50,1.50]',
    JSON.stringify(tierAdd) === '[0,0.2,0.4,0.6]' &&
    JSON.stringify(tierPierce) === '[0,0.1,0.22,0.35]' &&
    JSON.stringify(tierLocks) === '[0,1,2,3]' &&
    JSON.stringify(tierShield) === '[1,1.25,1.5,1.5]' &&
    B32.ampTiers[2].fortressDmgMult === 0.88 &&
    B32.ampTiers[2].fortressShieldRetain === 0.45 &&
    B32.ampTiers[2].fortressCrateRetain === 0.50 &&
    B32.SHIELD_RETAIN_RATE.fortress === 0.45 &&
    B32.CRATE_GUARD_RETAIN_RATE.fortress === 0.50,
    JSON.stringify({ tierAdd, tierPierce, tierLocks, tierShield, t2: B32.ampTiers[2] }));

  ok('缩圈平直增伤池：BAD=-0.10 / GOOD=+0.10 / GREAT=+0.20 / PERFECT=+0.30（Engine 与 TimingRing 100% 一致）',
    B32.ringAtkBonus.BAD === -0.10 &&
    B32.ringAtkBonus.GOOD === 0.10 &&
    B32.ringAtkBonus.GREAT === 0.20 &&
    B32.ringAtkBonus.PERFECT === 0.30 &&
    CTR.CONSTANTS.RING_BONUS.BAD === -0.10 &&
    CTR.CONSTANTS.RING_BONUS.GOOD === 0.10 &&
    CTR.CONSTANTS.RING_BONUS.GREAT === 0.20 &&
    CTR.CONSTANTS.RING_BONUS.PERFECT === 0.30,
    JSON.stringify({ eng: B32.ringAtkBonus, ctr: CTR.CONSTANTS.RING_BONUS }));

  const ns = B32.STAVES.north_saint_staff;
  const ew = B32.STAVES.eclipse_wand;
  ok('双魔杖规格：极北圣晶杖 (1.14×/+0.10/-0.10) 与晦轮杖 (100%真伤/+24%MP/永不日蚀/零冷却)',
    ns.matkMult === 1.14 && ns.critDmgBonus === 0.10 && ns.overcastMpDiscount === 0.10 && !ns.trueMagic && !ns.canTriggerEclipse &&
    ew.trueMagic === true && ew.canTriggerEclipse === false && ew.extraMpPct === 0.24 && ew.cooldown === 0 && ew.blocksManaCycle === false && ew.selfShieldVuln === 0,
    JSON.stringify({ ns, ew }));

  const presetMismatches = Object.entries(CE.STAGES).filter(([sid, sc]) => {
    const a = B32.ACTS_PLAYER_PRESET[sid];
    const p = sc.preset;
    return !a || a.age !== p.age || a.rank !== p.rank || a.hp !== p.hp || a.mp !== p.mp ||
      a.atk !== p.atk || a.matk !== p.matk || a.def !== p.def || a.mdef !== p.mdef || a.spd !== p.spd;
  }).map(([sid]) => sid);
  ok('ACTS_PLAYER_PRESET 与全部 9 幕 STAGE_CONFIGS.preset 100% 同步（age/rank/hp/mp/atk/matk/def/mdef/spd）',
    Object.keys(B32.ACTS_PLAYER_PRESET).length === 9 && presetMismatches.length === 0,
    JSON.stringify(presetMismatches));

  // 运行时校验：线性相加增伤池 (ampAdd + breakAdd + ringBonus) 与 ampTierMults 自洽
  const bLin = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: [] });
  bLin.player.mp = bLin.player.mmp;
  CE.setOvercastPct(0.60, bLin);
  const stLin = CE.getBattleState(bLin);
  const p0 = CE.computeAmpProfile(Object.assign({}, bLin.player, { ampPct: 0, overcastPct: 0, overcastMode: 0, _lastOvercastMode: 0 }), CE.SKILLS.ice_3_starfrost, { clampToMp: false });
  const p20 = CE.computeAmpProfile(Object.assign({}, bLin.player, { ampPct: 0.20, overcastPct: 0.20, overcastMode: 1, _lastOvercastMode: 1 }), CE.SKILLS.ice_3_starfrost, { clampToMp: false });
  const p40 = CE.computeAmpProfile(Object.assign({}, bLin.player, { ampPct: 0.40, overcastPct: 0.40, overcastMode: 2, _lastOvercastMode: 2 }), CE.SKILLS.ice_3_starfrost, { clampToMp: false });
  const p60 = CE.computeAmpProfile(bLin.player, CE.SKILLS.ice_3_starfrost, { clampToMp: false });
  const estNormal = CE.estimateSkillDamage(bLin, CE.SKILLS.ice_3_starfrost, bLin.enemies[0], { ringBonus: 0.30 });
  bLin.enemies[0].broken = true;
  const estBroken = CE.estimateSkillDamage(bLin, CE.SKILLS.ice_3_starfrost, bLin.enemies[0], { ringBonus: 0.30 });
  ok('线性相加增伤池运行时自洽：ampTierMults=[1,1.2,1.4,1.6]、PERFECT=+0.30、breakAdd=+0.10 精确叠加 (1.90/2.00)',
    JSON.stringify(stLin.ampTierMults) === '[1,1.2,1.4,1.6]' &&
    approx(p0.addDmg, 0) && approx(p20.addDmg, 0.20) && approx(p40.addDmg, 0.40) && approx(p60.addDmg, 0.60) &&
    approx(estNormal.addPool, 1.90) &&
    approx(estBroken.addPool, 2.00),
    JSON.stringify({ tierMults: stLin.ampTierMults, normalPool: estNormal.addPool, brokenPool: estBroken.addPool }));

  // 运行时校验：省蓝折扣系数与 0.60 下限 + ampExtraMp 同源
  const bNoDisc = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  CE.setOvercastPct(0.40, bNoDisc);
  const stNoDisc = CE.getBattleState(bNoDisc);
  ok('无省蓝折扣时 ampDiscountFactor===1、ampMpCostScale===1 且 ampExtraMp / ampTierExtraMps 与 MaxMP 100% 对齐',
    stNoDisc.ampDiscountFactor === 1 &&
    B32.ampMpCostScale === 1.00 &&
    stNoDisc.ampExtraMp === Math.round(bNoDisc.player.mmp * 0.40) &&
    JSON.stringify(stNoDisc.ampTierExtraMps) === JSON.stringify([0, Math.round(bNoDisc.player.mmp * 0.20), Math.round(bNoDisc.player.mmp * 0.40), Math.round(bNoDisc.player.mmp * 0.60)]),
    JSON.stringify({ df: stNoDisc.ampDiscountFactor, scale: B32.ampMpCostScale, ex: stNoDisc.ampExtraMp, tiers: stNoDisc.ampTierExtraMps }));

  const bDisc = CE.startStage('north_forest_hunt', {
    headless: true,
    usePreset: true,
    relics: ['noelle_manuscript', 'belmont_schedule', 'cross'],
    staff: 'north_saint_staff',
  });
  CE.setOvercastPct(0.40, bDisc);
  const stDisc = CE.getBattleState(bDisc);
  const expectedAmpDf = Number(Math.max(0.60, 0.85 * 0.80 * 0.90).toFixed(6)); // 0.612 >= 0.60
  const baseIceMp = CE.computeSkillMpCost(Object.assign({}, bDisc.player, { ampPct: 0, overcastPct: 0, overcastMode: 0, _lastOvercastMode: 0 }), CE.SKILLS.ice_3_starfrost);
  const ampIceMp = CE.computeSkillMpCost(bDisc.player, CE.SKILLS.ice_3_starfrost);
  const rawBaseCost = CE.SKILLS.ice_3_starfrost.mp;
  ok('mana_calc × 手稿 × 极北圣晶杖 × 学院星辉3件叠加严守 0.60 省蓝下限且与 computeSkillMpCost 同源',
    stDisc.ampDiscountFactor === expectedAmpDf &&
    stDisc.ampDiscountFactor >= 0.60 &&
    stDisc.ampExtraMp === (ampIceMp - baseIceMp) &&
    stDisc.ampTierExtraMps[2] === stDisc.ampExtraMp &&
    baseIceMp >= Math.round(rawBaseCost * 0.60),
    JSON.stringify({ df: stDisc.ampDiscountFactor, expectedAmpDf, baseIceMp, ampIceMp, extra: stDisc.ampExtraMp }));

  // 运行时校验：极北圣晶杖 1.14× 魔攻 + 暴伤叠加封顶 critMaxMult=1.70
  const bStaffBase = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [], staff: 'none' });
  const bStaffNS = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [], staff: 'north_saint_staff' });
  const bStaffCap = CE.startStage('noelle_14', {
    headless: true,
    usePreset: true,
    relics: ['noelle_manuscript', 'belmont_schedule', 'cross', 'academy_star_3pc'],
    staff: 'north_saint_staff',
    forceCrit: true,
  });
  const fcBase = CE.computeTacticalForecast(bStaffBase, CE.SKILLS.ice_2_prism, bStaffBase.enemies[0]);
  const fcNS = CE.computeTacticalForecast(bStaffNS, CE.SKILLS.ice_2_prism, bStaffNS.enemies[0]);
  const fcCap = CE.computeTacticalForecast(bStaffCap, CE.SKILLS.ice_2_prism, bStaffCap.enemies[0]);
  const ratioNS = fcNS.dmgMax / Math.max(1, fcNS.dmgMin);
  const ratioCap = fcCap.dmgMax / Math.max(1, fcCap.dmgMin);
  ok('极北圣晶杖运行时生效：魔导威力 +14%、单杖暴伤 1.60×、叠加学院星辉 3 件严格封顶 critMaxMult=1.70×',
    fcNS.dmgMin > fcBase.dmgMin &&
    approx(fcNS.dmgMin / fcBase.dmgMin, 1.14, 0.03) &&
    approx(ratioNS, 1.60, 0.02) &&
    approx(ratioCap, 1.70, 0.02) &&
    ratioCap <= 1.72,
    JSON.stringify({ baseMin: fcBase.dmgMin, nsMin: fcNS.dmgMin, ratioNS, ratioCap }));

  // 运行时校验：护盾增幅 1.00 / 1.25 / 1.50（封顶 40%）+ 钢冰护幕 40% 钢霜壁垒 (承伤×0.88 / 盾留45% / 护箱留50% / 艾诺共鸣+1)
  const bFort = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: [] });
  CE.setOvercastPct(0.60, bFort);
  const shP0 = CE.computeAmpProfile(Object.assign({}, bFort.player, { ampPct: 0, overcastPct: 0, overcastMode: 0, _lastOvercastMode: 0 }), CE.SKILLS.shield_3_steel, { clampToMp: false });
  const shP20 = CE.computeAmpProfile(Object.assign({}, bFort.player, { ampPct: 0.20, overcastPct: 0.20, overcastMode: 1, _lastOvercastMode: 1 }), CE.SKILLS.shield_3_steel, { clampToMp: false });
  const shP60 = CE.computeAmpProfile(bFort.player, CE.SKILLS.shield_3_steel, { clampToMp: false });
  // 清掉杂兵只留重甲兽，测试钢霜壁垒承伤×0.88与留存率
  bFort.enemies[1].hp = 0;
  bFort.enemies[2].hp = 0;
  bFort.enemies[0].intent = { stance: 'GUARD_COUNTER', moveName: '测试撞击', dmg: 100, crateDmg: 40, elem: 'earth' };
  const ainoBefore = bFort.ainoResonance;
  CE.useSkill('shield_3_steel', 0, bFort);
  const fortActive = bFort.player.status.fortress === 1;
  const fortCrateGuard = bFort.player.status.crateGuard;
  const fortShieldBefore = bFort.player.shield;
  const ainoAfter = bFort.ainoResonance;
  // 对比无壁垒同条件承伤（验证 fortressDmgMult=0.88）
  const bNoFort = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: [] });
  bNoFort.enemies[1].hp = 0;
  bNoFort.enemies[2].hp = 0;
  bNoFort.enemies[0].intent = { stance: 'GUARD_COUNTER', moveName: '测试撞击', dmg: 100, crateDmg: 40, elem: 'earth' };
  bNoFort.player.shield = 0;
  bFort.player.shield = 0;
  const hpF0 = bFort.player.hp;
  const hpNF0 = bNoFort.player.hp;
  CE.endTurn(bFort);
  CE.endTurn(bNoFort);
  const dmgFort = hpF0 - bFort.player.hp;
  const dmgNoFort = hpNF0 - bNoFort.player.hp;
  // 验证盾留 45% 与护箱留存 50%
  const bRet = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: [] });
  bRet.enemies.forEach(e => { e.status.stagger = 1; });
  CE.setOvercastPct(0.40, bRet);
  CE.useSkill('shield_3_steel', 0, bRet);
  const shPre = bRet.player.shield;
  const cgPre = bRet.player.status.crateGuard;
  CE.endTurn(bRet);
  ok('护盾增幅 1.00/1.25/1.50（60% 封顶 40%）+ 钢冰护幕二阶钢霜壁垒生效（承伤×0.88 / 盾留45% / 护箱85→留50% / 艾诺共鸣+1）',
    approx(shP0.shieldMult, 1.00) && approx(shP20.shieldMult, 1.25) &&
    approx(shP60.ampPct, 0.40) && approx(shP60.shieldMult, 1.50) &&
    fortActive && fortCrateGuard === 85 && fortShieldBefore > 0 &&
    ainoAfter === ainoBefore + 1 &&
    dmgFort < dmgNoFort && approx(dmgFort / dmgNoFort, 0.88, 0.04) &&
    bRet.player.shield === Math.floor(shPre * 0.45) &&
    bRet.player.status.crateGuard === Math.floor(cgPre * 0.50),
    JSON.stringify({ shMults: [shP0.shieldMult, shP20.shieldMult, shP60.shieldMult], fortCrateGuard, aino: [ainoBefore, ainoAfter], dmg: [dmgFort, dmgNoFort], retainSh: [shPre, bRet.player.shield], retainCg: [cgPre, bRet.player.status.crateGuard] }));

  // 运行时校验：晦轮杖 100% 魔法真伤（穿魔法盾、仅受 solidArmor 阻尼、+24% MaxMP、不阻断魔战循环）
  const bWand = CE.startStage('turning_point_corridor', { headless: true, usePreset: true, relics: [] });
  const mage = bWand.enemies[1]; // magic shield=22, solidArmor=0, mdef=18
  const mageShield0 = mage.shield;
  const mageHp0 = mage.hp;
  CE.toggleEclipseWand(true, bWand);
  const wandExtraCost = CE.computeSkillMpCost(bWand.player, CE.SKILLS.water_2_surge) -
    CE.computeSkillMpCost(Object.assign({}, bWand.player, { wandActive: false }), CE.SKILLS.water_2_surge);
  const mpBeforeWand = bWand.player.mp;
  CE.useSkill('water_2_surge', 1, bWand);
  const hpLossWand = mageHp0 - mage.hp;
  ok('晦轮杖运行时真伤：无视法抗与魔法盾直伤生命、额外耗蓝+24%MaxMP、零冷却且正常触发 100% 魔战回蓝',
    mage.shield === mageShield0 && hpLossWand > 0 &&
    wandExtraCost === Math.round(bWand.player.mmp * 0.24 * 0.85) &&
    bWand.player.wandCooldown === 0 &&
    bWand.metrics.manaRecycled === hpLossWand &&
    bWand.player.mp === Math.min(bWand.player.mmp, mpBeforeWand - CE.computeSkillMpCost(Object.assign({}, bWand.player, { wandActive: true }), CE.SKILLS.water_2_surge) + hpLossWand),
    JSON.stringify({ shieldAfter: mage.shield, mageShield0, hpLossWand, wandExtraCost, manaRecycled: bWand.metrics.manaRecycled }));

  // 原著时间线与 AGENTS.md 文本红线
  const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'combat-engine.js'), 'utf8');
  ok('原著时间线与 AGENTS.md 铁律：8岁罗文战(order:2)早于12岁艾诺战(order:4)、背景夜色且源码零「静止的日蚀」「不是」',
    CE.STAGES.rowan_graveyard.order === 2 &&
    CE.STAGES.rowan_graveyard.order < CE.STAGES.aino_sparring.order &&
    CE.STAGES.rowan_graveyard.bg === 'bg-img-night bg-night' &&
    !engineSrc.includes('静止的日蚀') && !engineSrc.includes('不是'));
}

// ===== 2. 全 15 招 5+1 进化技能、SKILL_BEAT_SPEC_V32 与 CombatTimingRing 深度校验 =====
console.log('\n[2] 全 15 招 5+1 进化技能、SKILL_BEAT_SPEC_V32 与 CombatTimingRing.getBeatSpec / calcRingBonus 校验');
{
  const expected15 = [
    'ice_1_crystal', 'ice_2_prism', 'ice_3_starfrost',
    'water_1_ball', 'water_2_surge', 'water_3_blade',
    'frost_1_step', 'frost_2_breath', 'frost_3_thorns',
    'shield_1_ice', 'shield_2_mirror', 'shield_3_steel',
    'sword_1_basic', 'sword_2_cold_edge',
    'move_afterimage',
  ];
  const actualIds = Object.keys(CE.SKILLS);
  const specIds = Object.keys(CE.SKILL_BEAT_SPEC_V32);
  ok('全 15 招 5+1 进化技能 ID 在 CE.SKILLS 与 SKILL_BEAT_SPEC_V32 中 100% 完整对齐',
    expected15.every(id => actualIds.includes(id) && specIds.includes(id)) &&
    actualIds.length === 15 && specIds.length === 15,
    JSON.stringify({ actualIds, specIds }));

  // 逐招校验 SKILL_BEAT_SPEC_V32 与 CombatTimingRing.getBeatSpec() / generateKeySequence()
  const keyPool = new Set(['Q', 'W', 'E', 'A', 'S', 'D']);
  const instant5 = ['shield_1_ice', 'shield_2_mirror', 'shield_3_steel', 'sword_1_basic', 'move_afterimage'];
  const single5 = ['ice_1_crystal', 'water_1_ball', 'frost_1_step', 'frost_2_breath', 'sword_2_cold_edge'];
  const diff2_3 = ['water_2_surge', 'water_3_blade', 'ice_3_starfrost'];

  const instantOk = instant5.every(id => {
    const sp = CTR.getBeatSpec(id);
    const seq = CTR.generateKeySequence(id);
    return CE.SKILL_BEAT_SPEC_V32[id].beats === 0 && sp.beats === 0 && sp.mode === 'instant' && seq.length === 0;
  });
  const singleOk = single5.every(id => {
    const sp = CTR.getBeatSpec(id);
    const seq = CTR.generateKeySequence(id);
    return CE.SKILL_BEAT_SPEC_V32[id].beats === 1 && sp.beats === 1 && sp.mode === 'single' && seq.length === 1 && keyPool.has(seq[0]);
  });
  const diff2Ok = diff2_3.every(id => {
    const sp = CTR.getBeatSpec(id);
    const seq = CTR.generateKeySequence(id);
    const vfxOk = id !== 'ice_3_starfrost' || (Array.isArray(sp.vfxIcicles) && sp.vfxIcicles[0] === 2 && sp.vfxIcicles[1] === 2);
    return CE.SKILL_BEAT_SPEC_V32[id].beats === 2 && sp.beats === 2 && sp.mode === 'combo_distinct' &&
      seq.length === 2 && keyPool.has(seq[0]) && keyPool.has(seq[1]) && seq[0] !== seq[1] && vfxOk;
  });
  const prismSpec = CTR.getBeatSpec('ice_2_prism');
  const prismSeq = CTR.generateKeySequence('ice_2_prism');
  const prismOk = CE.SKILL_BEAT_SPEC_V32.ice_2_prism.beats === 3 &&
    prismSpec.beats === 3 && prismSpec.mode === 'triple_same' &&
    prismSeq.length === 3 && prismSeq[0] === prismSeq[1] && prismSeq[1] === prismSeq[2] && keyPool.has(prismSeq[0]);

  const thornsSpec4 = CTR.getBeatSpec('frost_3_thorns', 4);
  const thornsSpecCap = CTR.getBeatSpec('frost_3_thorns', 9);
  const thornsSeq4 = CTR.generateKeySequence('frost_3_thorns', 4);
  const thornsDistinctAdj = thornsSeq4.length === 4 && thornsSeq4.every((k, i) => keyPool.has(k) && (i === 0 || k !== thornsSeq4[i - 1]));
  const thornsOk = CE.SKILL_BEAT_SPEC_V32.frost_3_thorns.beats === 'alive_enemies' &&
    thornsSpec4.beats === 4 && thornsSpec4.dynamic === true &&
    JSON.stringify(thornsSpec4.beatSlowMoScales) === '[0.38,0.38,0.38,0.25]' &&
    thornsSpecCap.beats === 6 && thornsDistinctAdj;

  ok('15 招拍数与左手 6 键序列规格 100% 校验通过（5招瞬发 / 5招1拍 / 3招2拍异键含星霜[2,2] / 1招3拍同键 / 1招动态敌数穿刺）',
    instantOk && singleOk && diff2Ok && prismOk && thornsOk,
    JSON.stringify({ instantOk, singleOk, diff2Ok, prismOk, thornsOk, prismSeq, thornsSeq4 }));

  // CombatTimingRing.calcRingBonus() 标准与休闲模式（含 BAD=-0.10 与 BAD->GOOD +0.10）
  const bBadStd = CTR.calcRingBonus(['BAD'], { casualMode: false });
  const bGoodStd = CTR.calcRingBonus(['GOOD'], { casualMode: false });
  const bGreatStd = CTR.calcRingBonus(['GREAT'], { casualMode: false });
  const bPerfStd = CTR.calcRingBonus(['PERFECT'], { casualMode: false });
  const bMixStd = CTR.calcRingBonus(['PERFECT', 'BAD'], { casualMode: false });
  const bBadCas = CTR.calcRingBonus(['BAD'], { casualMode: true });
  const bMixCas = CTR.calcRingBonus(['BAD', 'PERFECT'], { casualMode: true });
  ok('CombatTimingRing.calcRingBonus 精确计算：标准 BAD=-0.10/GOOD=+0.10/GREAT=+0.20/PERFECT=+0.30，休闲 BAD→GOOD(+0.10) 免负罚',
    bBadStd === -0.10 && bGoodStd === 0.10 && bGreatStd === 0.20 && bPerfStd === 0.30 &&
    approx(bMixStd, 0.10) && bBadCas === 0.10 && approx(bMixCas, 0.20),
    JSON.stringify({ bBadStd, bGoodStd, bGreatStd, bPerfStd, bMixStd, bBadCas, bMixCas }));

  // sword_1_basic：0 蓝立即回 +6% MaxMP，且纯物理不触发魔战生命回蓝
  const bSw1 = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  bSw1.player.mp = 100;
  const expectedSw1Regen = Math.round(bSw1.player.mmp * 0.06);
  const physMult = CE.computeManaCycleMultiplier(bSw1.player, 50, CE.SKILLS.sword_1_basic);
  CE.useSkill('sword_1_basic', 0, bSw1);
  ok('sword_1_basic 0 拍零耗蓝立即导魔回蓝 +6% MaxMP，且纯物理不吃魔战增幅/不触发魔战生命回蓝',
    CE.SKILLS.sword_1_basic.mp === 0 && CE.SKILLS.sword_1_basic.beats === 0 &&
    physMult === 1.0 &&
    bSw1.player.mp === 100 + expectedSw1Regen &&
    bSw1.metrics.manaRecycled === expectedSw1Regen,
    JSON.stringify({ mpAfter: bSw1.player.mp, expected: 100 + expectedSw1Regen, recycled: bSw1.metrics.manaRecycled }));

  // 魔战循环：有效魔法生命伤害 100% 等量回蓝
  const bMc = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: [] });
  bMc.player.mp = 100;
  CE.setOvercastPct(0, bMc);
  const wolfHp0 = bMc.enemies[1].hp;
  const iceCost = CE.computeSkillMpCost(bMc.player, CE.SKILLS.ice_3_starfrost);
  CE.useSkill('ice_3_starfrost', 1, bMc);
  const wolfLoss = wolfHp0 - bMc.enemies[1].hp;
  ok('魔战循环严格按 100% 有效魔法生命伤害等量回蓝',
    wolfLoss > 0 && bMc.metrics.manaRecycled === wolfLoss &&
    bMc.player.mp === Math.min(bMc.player.mmp, 100 - iceCost + wolfLoss),
    JSON.stringify({ wolfLoss, iceCost, mpAfter: bMc.player.mp, recycled: bMc.metrics.manaRecycled }));

  // sword_2_cold_edge：零蓝兜底回 +6% MaxMP + 常规迎击 CLOSE_LUNGE 2.10× 与降暴露
  const bSw2 = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: [] });
  bSw2.player.mp = 0;
  const expectedSw2Regen = Math.round(bSw2.player.mmp * 0.06);
  const sw2FallbackRes = CE.useSkill('sword_2_cold_edge', 1, bSw2);
  ok('sword_2_cold_edge 在 MP=0 时触发零蓝兜底平斩，零耗蓝并立即回蓝 +6% MaxMP（绝不卡死）',
    sw2FallbackRes.ok === true && sw2FallbackRes.zeroMpFallback === true &&
    bSw2.player.mp === expectedSw2Regen,
    JSON.stringify({ res: sw2FallbackRes, mp: bSw2.player.mp, expected: expectedSw2Regen }));

  // move_afterimage：残像闪避常规来袭 + 下回合 +1 AP + 3回合冷却
  const bMove = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [] });
  const hpM0 = bMove.player.hp;
  CE.useSkill('move_afterimage', 0, bMove);
  const hasAfterimage = bMove.player.status.afterimage === 1;
  const hasNextAp = bMove.player.status.nextAp === 1;
  const moveCd = bMove.player.cooldowns.move_afterimage;
  CE.endTurn(bMove);
  ok('move_afterimage 瞬发赠 1 层残像完全闪避常规攻击、冷却 3 回合且下回合生效 +1 AP',
    hasAfterimage && hasNextAp && moveCd === 3 &&
    bMove.player.hp === hpM0 && bMove.player.status.afterimage === 0 && bMove.ap === 3,
    JSON.stringify({ hasAfterimage, hasNextAp, moveCd, hpDiff: hpM0 - bMove.player.hp, apNext: bMove.ap }));

  // 致盲偏斜 vs 水球术净盲、影豺真实闪避、艾诺三击制防误胜
  const bBlind = CE.startStage('alice_9', { headless: true, usePreset: true, relics: [] });
  bBlind.player.status.blind = 1;
  bBlind.enemies[0].evadeCharges = 0;
  const blindMiss = CE.useSkill('ice_1_crystal', 0, bBlind);
  bBlind.ap = 2;
  bBlind.player.status.blind = 1;
  const aliceHp0 = bBlind.enemies[0].hp;
  CE.useSkill('water_1_ball', 0, bBlind);
  ok('视线受阻(blind)致单体冰晶偏斜落空，而 water_1_ball 立即净盲并命中造伤',
    blindMiss.missedByBlind === true && !bBlind.player.status.blind && bBlind.enemies[0].hp < aliceHp0);

  const bJack = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: [] });
  bJack.enemies.forEach(e => { e.hp = 0; });
  bJack.enemies[0].hp = 1; bJack.enemies[0].shield = 0;
  CE.useSkill('water_3_blade', 0, bJack); // 推进到 W2 影豺
  const jackal = bJack.enemies[0];
  const jHp0 = jackal.hp;
  jackal.intent = { stance: 'DUAL_CAST', moveName: '蓄寒', dmg: 100, elem: 'ice' };
  const hadEvade = jackal.evadeCharges === 1;
  CE.useSkill('water_3_blade', 0, bJack);
  ok('W2 霜脊影豺开局带 1 层真实闪避，零暴露非必中直击消耗闪避且未扣血',
    hadEvade && jackal.evadeCharges === 0 && jackal.hp === jHp0,
    JSON.stringify({ hadEvade, evadeAfter: jackal.evadeCharges, hp: jackal.hp, jHp0, over: bJack.over, endReason: bJack.endReason }));

  const bAinoGuard = CE.startStage('aino_sparring', { headless: true, usePreset: true, relics: [] });
  bAinoGuard.enemies[0].hp = 1;
  CE.useSkill('shield_2_mirror', 0, bAinoGuard);
  CE.endTurn(bAinoGuard);
  ok('艾诺三击制中即便耐力触底且触发反刺，playerHits===0 绝不误判玩家获胜',
    !bAinoGuard.won && bAinoGuard.enemies[0].hp >= 1);
}

// ===== 3. 线性等阶差格挡 computeBlockRate 与 7 杂兵 / 12 精英首领 noBlockPrompt 校验 =====
console.log('\n[3] 线性等阶差格挡 computeBlockRate(d=+6/+2/0/-2/-4/-6) 与 7 杂兵 / 12 精英首领 noBlockPrompt 校验');
{
  const matrix = [
    { defRank: 7, atkRank: 1, d: +6, exp: { BAD: 0, GOOD: 0.1376, GREAT: 0.3096, PERFECT: 0.5160 } },
    { defRank: 4, atkRank: 2, d: +2, exp: { BAD: 0, GOOD: 0.0992, GREAT: 0.2232, PERFECT: 0.3720 } },
    { defRank: 3, atkRank: 3, d: 0,  exp: { BAD: 0, GOOD: 0.0800, GREAT: 0.1800, PERFECT: 0.3000 } },
    { defRank: 2, atkRank: 4, d: -2, exp: { BAD: 0, GOOD: 0.0640, GREAT: 0.1440, PERFECT: 0.2400 } },
    { defRank: 3, atkRank: 7, d: -4, exp: { BAD: 0, GOOD: 0.0480, GREAT: 0.1080, PERFECT: 0.1800 } },
    { defRank: 1, atkRank: 7, d: -6, exp: { BAD: 0, GOOD: 0.0320, GREAT: 0.0720, PERFECT: 0.1200 } },
  ];
  const mismatches = [];
  for (const row of matrix) {
    for (const g of ['BAD', 'GOOD', 'GREAT', 'PERFECT']) {
      const rCE = CE.computeBlockRate(row.defRank, row.atkRank, g);
      const rCTR = CTR.calcBlockRate(g, row.defRank, row.atkRank);
      if (!approx(rCE, row.exp[g], 1e-6) || !approx(rCTR, row.exp[g], 1e-6)) {
        mismatches.push(`d=${row.d}:${g}(CE=${rCE},CTR=${rCTR},exp=${row.exp[g]})`);
      }
    }
  }
  ok('线性等阶差格挡公式在 d=+6/+2/0/-2/-4/-6 × 四档判定下 Engine 与 TimingRing 100% 精确一致（无人工保底/封顶）',
    mismatches.length === 0, mismatches.join(', '));

  const mobs = [];
  const elites = [];
  for (const st of Object.values(CE.STAGES)) {
    for (const w of st.waves) {
      for (const e of w.enemies) {
        if (e.noBlockPrompt === true) mobs.push(`${st.id}:${e.id}`);
        else if (e.noBlockPrompt === false) elites.push(`${st.id}:${e.id}`);
      }
    }
  }
  const expectedMobs = [
    'north_forest_hunt:wolf_alpha', 'north_forest_hunt:wolf_b', 'north_forest_hunt:wolf_c', 'north_forest_hunt:wolf_d',
    'hulan_beast_tide:frost_hound_a', 'hulan_beast_tide:frost_hound_b', 'hulan_beast_tide:ridge_claw',
  ];
  ok(`全 9 幕敌人严格区分 7 种杂兵 (noBlockPrompt:true) 与 12 名精英/首领 (noBlockPrompt:false) (实测 ${mobs.length}/${elites.length})`,
    mobs.length === 7 && elites.length === 12 && expectedMobs.every(id => mobs.includes(id)),
    JSON.stringify({ mobs, elites }));
}

// ===== 4. Boss 转 P2 觉醒缓冲、双波 bossWaveRetry 快照与独立休闲模式 4 杠杆 =====
console.log('\n[4] Boss 转 P2 觉醒缓冲(stagger>=1)、双波 bossWaveRetry 快照重开与独立休闲模式 4 杠杆校验');
{
  // 4.1 东翼封锁官 & 风神 转 P2 觉醒缓冲 stagger >= 1
  const bP2East = CE.startStage('turning_point_corridor', { headless: true, usePreset: true, relics: [] });
  bP2East.enemies.forEach(e => { e.hp = 0; });
  bP2East.enemies[0].hp = 1; bP2East.enemies[0].shield = 0;
  CE.useSkill('water_2_surge', 0, bP2East); // 进入 Wave 2 红莲铁幕
  const eastBoss = bP2East.enemies[0];
  eastBoss.shield = 0;
  eastBoss.hp = Math.floor(eastBoss.mhp * eastBoss.phase2HpPct) + 15;
  CE.useSkill('water_2_surge', 0, bP2East); // 跨过 50% 阈值触发 P2
  const eastAwakeOk = eastBoss.phase === 2 && eastBoss.status.stagger >= 1 && eastBoss._phase2Awakening === true &&
    eastBoss.intent.stance === 'STAGGERED' && eastBoss.locks === eastBoss.maxLocks && eastBoss.broken === false &&
    eastBoss.shield >= 86 && bP2East.metrics.phase2Triggered === true;
  const eastActionsBefore = bP2East.metrics.enemyActions;
  const eastPlayerHpBefore = bP2East.player.hp;
  CE.endTurn(bP2East); // 觉醒缓冲回合：Boss 不得直接出手秒人
  const eastSkipOk = bP2East.metrics.enemyActions === eastActionsBefore && bP2East.player.hp === eastPlayerHpBefore &&
    eastBoss._phase2Awakening === false &&
    ['FLAME_CORRIDOR_SEAL', 'CROSSROAD_BREACH'].includes(eastBoss.intent && eastBoss.intent.moveKey);

  const bP2Wg = CE.startStage('wind_god_eye', { headless: true, usePreset: true, relics: [] });
  const wgBoss = bP2Wg.enemies[0];
  wgBoss.shield = 0;
  wgBoss.evadeCharges = 0;
  wgBoss.hp = Math.floor(wgBoss.mhp * wgBoss.phase2HpPct) + 10;
  CE.useSkill('frost_3_thorns', 0, bP2Wg); // 跨过 55% 阈值触发 P2
  const wgAwakeOk = wgBoss.phase === 2 && wgBoss.status.stagger >= 1 && wgBoss._phase2Awakening === true &&
    wgBoss.intent.stance === 'STAGGERED' && wgBoss.locks === 7 && wgBoss.shield >= 145;
  const wgActionsBefore = bP2Wg.metrics.enemyActions;
  CE.endTurn(bP2Wg);
  const wgSkipOk = bP2Wg.metrics.enemyActions === wgActionsBefore && wgBoss._phase2Awakening === false &&
    ['TEMPEST_VACUUM', 'EYE_STILLNESS'].includes(wgBoss.intent && wgBoss.intent.moveKey);

  ok('Boss 转 P2 觉醒缓冲铁律（红莲铁幕 + 风神）：跨阈值立即 stagger>=1 / 重整盾锁 / 当回合不直接突袭 / 下回合切入二阶段招式',
    eastAwakeOk && eastSkipOk && wgAwakeOk && wgSkipOk,
    JSON.stringify({ eastAwakeOk, eastSkipOk, wgAwakeOk, wgSkipOk, eastNext: eastBoss.intent && eastBoss.intent.moveKey, wgNext: wgBoss.intent && wgBoss.intent.moveKey }));

  // 4.2 双波 bossWaveRetry: true 与 startFromBossWaveSnapshot 校验（无头快照 + DOM 按钮重开）
  const dualStages = Object.values(CE.STAGES).filter(s => s.waves.length > 1).map(s => s.id);
  const retryFlagsOk = dualStages.length === 3 &&
    ['north_forest_hunt', 'hulan_beast_tide', 'turning_point_corridor'].every(id => CE.STAGES[id].bossWaveRetry === true) &&
    Object.values(CE.STAGES).filter(s => s.waves.length === 1).every(s => !s.bossWaveRetry);

  const bSnap = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: [] });
  bSnap.player.hp = 40;
  bSnap.player.mp = 80;
  bSnap.player.status.burn = 2;
  bSnap.player.status.blind = 1;
  bSnap.crateHp = 82;
  bSnap.enemies.forEach(e => { e.hp = 0; });
  bSnap.enemies[0].hp = 1; bSnap.enemies[0].shield = 0;
  CE.useSkill('frost_3_thorns', 0, bSnap); // 全体必中穿透致盲清 W1 进 W2，捕获含残血残蓝/灼烧/致盲/冷却的快照
  const snapCaptured = bSnap.waveIdx === 1 && !!bSnap._bossWaveSnapshot && CE.getBattleState(bSnap).bossWaveRetryAvailable === true;
  const snapCrate = bSnap._bossWaveSnapshot ? bSnap._bossWaveSnapshot.crateHp : -1;
  // 模拟 W2 战败并调用 startFromBossWaveSnapshot 重开
  bSnap.crateHp = 10;
  bSnap.player.hp = 0;
  bSnap.over = true;
  bSnap.won = false;
  const bRetry = CE.startFromBossWaveSnapshot(bSnap, { headless: true });
  const snapRestoredOk = !!bRetry && bRetry.waveIdx === 1 && !bRetry.over &&
    bRetry.player.hp >= Math.round(bRetry.player.mhp * 0.80) &&
    bRetry.player.mp >= Math.round(bRetry.player.mmp * 0.80) &&
    !bRetry.player.status.burn && !bRetry.player.status.blind &&
    Object.keys(bRetry.player.cooldowns).length === 0 &&
    bRetry.ap === bRetry.apMax &&
    bRetry.crateHp === snapCrate &&
    bRetry.enemies[0].hp === bRetry.enemies[0].mhp &&
    !!bRetry._bossWaveSnapshot;

  // DOM 模式下第 8 幕 W2 落败展示 #cr-retry-boss 按钮并一键重开首领波
  CE.startStage('turning_point_corridor', { fromArena: true });
  const bDomW2 = CE.getState();
  bDomW2.enemies.forEach(e => { e.hp = 0; });
  bDomW2.enemies[0].hp = 1; bDomW2.enemies[0].shield = 0;
  CE.useSkill('water_2_surge', 0, bDomW2);
  bDomW2.player.hp = 1; bDomW2.player.shield = 0; bDomW2.player.status = {};
  bDomW2.enemies[0].status = {};
  bDomW2.enemies[0].intent = { stance: 'HEAVY_WINDUP', moveName: '重击', dmg: 200, elem: 'fire' };
  CE.endTurn(bDomW2);
  const hasRetryBossBtn = !!$('cr-retry-boss') && !!$('cr-casual-checkbox');
  if ($('cr-retry-boss')) $('cr-retry-boss').click();
  const bDomAfter = CE.getState();
  const domRetryOk = hasRetryBossBtn && !!bDomAfter && bDomAfter.waveIdx === 1 && !bDomAfter.over &&
    bDomAfter.enemies[0].id === 'eastwing_commander' && bDomAfter.enemies[0].hp === bDomAfter.enemies[0].mhp;
  CE.exitBattle(false, { silent: true });

  ok('双波关卡 bossWaveRetry:true 与 startFromBossWaveSnapshot 快照重开（血蓝保底80% / 清异常与CD / 对齐药箱 / DOM #cr-retry-boss）',
    retryFlagsOk && snapCaptured && snapRestoredOk && domRetryOk,
    JSON.stringify({ retryFlagsOk, snapCaptured, snapRestoredOk, domRetryOk }));

  // 4.3 独立休闲模式 4 杠杆校验
  CE.setCasualMode(true);
  const prefSyncOn = CE.isCasualMode() === true && CTR.isCasualMode() === true &&
    win.localStorage.getItem('combat_casual_mode') === 'true';

  const bStd = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [], casualMode: false });
  const bCas = CE.startStage('noelle_14', { headless: true, usePreset: true, relics: [], casualMode: true });
  const lever1HpShield = bCas.enemies[0].mhp === Math.round(bStd.enemies[0].mhp * 0.70) &&
    bCas.enemies[0].shield === Math.round(bStd.enemies[0].shield * 0.70);

  // 杠杆 2：敌伤 ×0.60（含直伤与药箱伤）
  const bDmgStd = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: [], casualMode: false });
  const bDmgCas = CE.startStage('hulan_beast_tide', { headless: true, usePreset: true, relics: [], casualMode: true });
  bDmgStd.enemies[1].hp = 0; bDmgStd.enemies[2].hp = 0;
  bDmgCas.enemies[1].hp = 0; bDmgCas.enemies[2].hp = 0;
  bDmgStd.enemies[0].intent = { stance: 'GUARD_COUNTER', moveName: '重撞', dmg: 100, crateDmg: 50, elem: 'earth' };
  bDmgCas.enemies[0].intent = { stance: 'GUARD_COUNTER', moveName: '重撞', dmg: 100, crateDmg: 50, elem: 'earth' };
  const sHp0 = bDmgStd.player.hp, cHp0 = bDmgCas.player.hp;
  const sCr0 = bDmgStd.crateHp, cCr0 = bDmgCas.crateHp;
  CE.endTurn(bDmgStd);
  CE.endTurn(bDmgCas);
  const stdLoss = sHp0 - bDmgStd.player.hp;
  const casLoss = cHp0 - bDmgCas.player.hp;
  const stdCrLoss = sCr0 - bDmgStd.crateHp;
  const casCrLoss = cCr0 - bDmgCas.crateHp;
  const lever2Dmg = approx(casLoss / stdLoss, 0.60, 0.03) && casCrLoss === Math.round(stdCrLoss * 0.60);

  // 杠杆 3：回合末额外回蓝 +15% MaxMP
  const bMpStd = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: [], casualMode: false });
  const bMpCas = CE.startStage('beatrice_11', { headless: true, usePreset: true, relics: [], casualMode: true });
  bMpStd.player.mp = 50; bMpCas.player.mp = 50;
  bMpStd.enemies[0].status.stagger = 1; bMpCas.enemies[0].status.stagger = 1;
  CE.endTurn(bMpStd);
  CE.endTurn(bMpCas);
  const expectedCasMp = Math.round(bMpCas.player.mmp * 0.15);
  const lever3Mp = bMpStd.player.mp === 50 && bMpCas.player.mp === 50 + expectedCasMp;

  // 杠杆 4：BAD → GOOD (+10%) 免负罚
  const lever4NoBad = CTR.calcRingBonus(['BAD']) === 0.10 && CTR.calcRingBonus(['BAD'], { casualMode: false }) === -0.10;

  CE.setCasualMode(false);
  const prefSyncOff = CE.isCasualMode() === false && CTR.isCasualMode() === false &&
    win.localStorage.getItem('combat_casual_mode') === 'false';

  ok('独立休闲模式 4 杠杆全部精准生效（偏好同步 / 敌血盾×0.70 / 敌伤与箱伤×0.60 / 回合末+15%MaxMP / BAD→GOOD +10%）',
    prefSyncOn && prefSyncOff && lever1HpShield && lever2Dmg && lever3Mp && lever4NoBad,
    JSON.stringify({ prefSyncOn, prefSyncOff, lever1HpShield, lever2Dmg, dmg: [casLoss, stdLoss], cr: [casCrLoss, stdCrLoss], lever3Mp, lever4NoBad }));
}

// ===== 5. 主线 1–8 幕常规可解性、休闲模式全主线通杀与第 9 幕神级风神校验 =====
console.log('\n[5] 主线 1–8 幕常规可解性（含罗文活捉/第5幕无残像防卡关/6-8幕双波）、休闲通杀与第 9 幕神级风神校验');
{
  // 1) 贝阿特丽丝（11岁）
  const r1 = CE.simulateBattle('beatrice_11', b => {
    const e = b.enemies[0], st = e.intent ? e.intent.stance : '';
    if ((st === 'HEAVY_WINDUP' || b.player.status.burn > 0) && b.player.shield < 20 && canUseSkill(b, 'shield_1_ice') && e.hp > 60) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'shield_1_ice' };
    }
    if (st === 'DUAL_CAST' && b.player.mp >= 75 && b.ap >= 1) {
      if (b.player.ampPct !== 0.20) return { type: 'amp', pct: 0.20 };
      return { type: 'skill', skillId: 'water_1_ball' };
    }
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if (canUseSkill(b, 'water_1_ball')) return { type: 'skill', skillId: 'water_1_ball' };
    if (canUseSkill(b, 'sword_1_basic')) return { type: 'skill', skillId: 'sword_1_basic' };
    return { type: 'endTurn' };
  });
  ok(`主线第 1 幕「贝阿特丽丝」常规战术通关 (${r1.grade}级 / ${r1.turns}T / 余血${r1.hpRemaining})`,
    r1.won && ['S', 'A'].includes(r1.grade) && r1.metrics.enemyActions >= 1,
    JSON.stringify({ won: r1.won, grade: r1.grade, turns: r1.turns, hp: r1.hpRemaining }));

  // 2) 罗文（8岁间章·6+6 雷纳德主力活捉）
  const r2 = CE.simulateBattle('rowan_graveyard', b => {
    const e = b.enemies[0], st = e.intent ? e.intent.stance : '';
    if ((st === 'UNDER_SEEP' || st === 'CLOSE_LUNGE') && canUseSkill(b, 'shield_1_ice')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'shield_1_ice' };
    }
    if (b.frostFloorTurns === 0 && canUseSkill(b, 'frost_1_step')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'frost_1_step' };
    }
    if (st === 'DUAL_CAST' && b.frostFloorTurns > 0 && canUseSkill(b, 'ice_1_crystal')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'ice_1_crystal' };
    }
    return { type: 'endTurn' };
  });
  ok(`主线第 2 幕「8岁罗文乱葬岗」雷纳德主力压制 + 冰盾截旋杖/冰履合围活捉 (${r2.grade}级 / ${r2.turns}T / 雷纳德伤${r2.metrics.allyDmgDealt}>主角${r2.metrics.playerDmgDealt})`,
    r2.won && r2.endReason === 'sealed_rowan' && r2.sealProgress >= 100 &&
    r2.metrics.allyDmgDealt > r2.metrics.playerDmgDealt && r2.metrics.allyActions >= 3,
    JSON.stringify({ won: r2.won, end: r2.endReason, seal: r2.sealProgress, allyDmg: r2.metrics.allyDmgDealt, pDmg: r2.metrics.playerDmgDealt }));

  // 3) 爱丽丝（9岁·扬尘净盲 + 冰霜之息榨风魔自断狂岚）
  const r3 = CE.simulateBattle('alice_9', b => {
    const e = b.enemies[0];
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if (b.player.status.blind > 0 && canUseSkill(b, 'water_1_ball')) return { type: 'skill', skillId: 'water_1_ball' };
    if (canUseSkill(b, 'frost_2_breath')) return { type: 'skill', skillId: 'frost_2_breath' };
    if (b.player.shield < 20 && canUseSkill(b, 'shield_1_ice') && b.player.hp < 120) return { type: 'skill', skillId: 'shield_1_ice' };
    if (e.evadeCharges === 0 && canUseSkill(b, 'ice_1_crystal')) return { type: 'skill', skillId: 'ice_1_crystal' };
    if (canUseSkill(b, 'water_1_ball')) return { type: 'skill', skillId: 'water_1_ball' };
    return { type: 'endTurn' };
  });
  const aliceDustAndWash = r3.log.some(l => l.includes('扬尘遮蔽视线')) && r3.log.some(l => l.includes('水流冲净'));
  ok(`主线第 3 幕「爱丽丝」触发扬尘+洗尘+狂岚榨蓝自断认输 (${r3.grade}级 / ${r3.turns}T)`,
    r3.won && r3.metrics.manaFizzleWin === true && r3.endReason === 'alice_mana_fizzle' && aliceDustAndWash,
    JSON.stringify({ won: r3.won, grade: r3.grade, turns: r3.turns, fizzle: r3.metrics.manaFizzleWin, dustWash: aliceDustAndWash }));

  // 4) 艾诺（冰上三击制）
  const r4 = CE.simulateBattle('aino_sparring', b => {
    const e = b.enemies[0], st = e.intent ? e.intent.stance : '';
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if ((st === 'DUAL_CAST' || b.player.status.mirrorRiposteWindow > 0) && canUseSkill(b, 'ice_2_prism')) {
      return { type: 'skill', skillId: 'ice_2_prism' };
    }
    if (st === 'CLOSE_LUNGE' && canUseSkill(b, 'shield_2_mirror')) return { type: 'skill', skillId: 'shield_2_mirror' };
    if (b.player.shield < 30 && canUseSkill(b, 'shield_2_mirror')) return { type: 'skill', skillId: 'shield_2_mirror' };
    return { type: 'endTurn' };
  });
  ok(`主线第 4 幕「艾诺·三击制」截断与镜霜反刺抢满 3 击获胜 (${r4.grade}级 / ${r4.turns}T / 比分${r4.playerHits}:${r4.enemyHits})`,
    r4.won && r4.endReason === 'three_hits' && r4.playerHits >= 3 && r4.turns <= 7,
    JSON.stringify({ won: r4.won, turns: r4.turns, hits: `${r4.playerHits}:${r4.enemyHits}` }));

  // 5) 诺艾儿（第 5 幕：严测无 move_afterimage 防卡关！预设禁用残像 + 14岁主线未习风行残像存档双通 + 硬吃82暗流不秒杀）
  const noellePolicyNoAfterimage = b => {
    const e = b.enemies[0], st = e.intent ? e.intent.stance : '';
    if (st === 'UNDER_SEEP' && !e.seepSevered && canUseSkill(b, 'frost_2_breath')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'frost_2_breath' };
    }
    if (st === 'DUAL_CAST' && canUseSkill(b, 'ice_2_prism')) {
      const want = b.player.mp >= 160 ? 0.20 : 0;
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'ice_2_prism' };
    }
    if (!(e.status && e.status.stagger) && b.player.shield < 45 && canUseSkill(b, 'shield_2_mirror')) {
      const want = b.player.mp >= 150 ? 0.20 : 0;
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'shield_2_mirror' };
    }
    if (canUseSkill(b, 'ice_2_prism')) {
      const want = (e.seepSevered && b.player.mp >= 220) ? 0.60 : (b.player.mp >= 180 ? 0.20 : 0);
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'ice_2_prism' };
    }
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if (canUseSkill(b, 'sword_1_basic')) return { type: 'skill', skillId: 'sword_1_basic' };
    return { type: 'endTurn' };
  };
  const r5Preset = CE.simulateBattle('noelle_14', noellePolicyNoAfterimage);
  win.__resetS();
  const s14NoMove = win.__getS();
  s14NoMove.ageY = 14; s14NoMove.phase = 'academy'; s14NoMove.lv = 22;
  s14NoMove.mhp = 218; s14NoMove.hp = 218; s14NoMove.mmp = 300; s14NoMove.mp = 300;
  s14NoMove.atk = 24; s14NoMove.mag = 105; s14NoMove.pdef = 15; s14NoMove.mdef = 21;
  s14NoMove.skills = ['virtual_duel', 'temp_sense', 'root_ice']; // 刻意未习 wind_afterimage
  win.__setS(s14NoMove);
  const bNoMoveDeck = CE.startStage('noelle_14', { headless: true, usePreset: false, fullRestore: true });
  const noAfterimageInDeck = !bNoMoveDeck.player.skills.includes('move_afterimage') && bNoMoveDeck.player.hasManaCycle === true;
  const r5SaveNoMove = CE.simulateBattle('noelle_14', noellePolicyNoAfterimage, { usePreset: false });
  // 校验脚底暗流硬吃 82 伤防软锁
  const bTrapCheck = CE.startStage('noelle_14', { headless: true, usePreset: true });
  bTrapCheck.enemies[0].hp = Math.round(bTrapCheck.enemies[0].mhp * 0.45);
  bTrapCheck.enemies[0].seepTriggeredOnce = true;
  bTrapCheck.enemies[0].intent = { stance: 'UNDER_SEEP', moveName: '残魔退守·冰缝暗流', dmg: 132, trapDmg: 82, ambushTrap: true, elem: 'water', mpCost: 10 };
  const hpBeforeTrap = bTrapCheck.player.hp;
  CE.useSkill('ice_2_prism', 0, bTrapCheck);
  ok(`主线第 5 幕「诺艾儿」无 move_afterimage 防卡关双验通过（预设${r5Preset.turns}T + 无残像存档${r5SaveNoMove.turns}T + 暗流硬吃82可存活）`,
    r5Preset.won && r5Preset.metrics.enteredUnderSeep === true &&
    noAfterimageInDeck && r5SaveNoMove.won && r5SaveNoMove.metrics.enteredUnderSeep === true &&
    (hpBeforeTrap - bTrapCheck.player.hp) === 82 && bTrapCheck.player.hp > 0,
    JSON.stringify({ preset: r5Preset.won, save: r5SaveNoMove.won, noAfterimageInDeck, trapLoss: hpBeforeTrap - bTrapCheck.player.hp }));

  // 6) 北林双波次（W1 霜域清狼 + W2 寒锋迎击影豺 + 断水刃零暴露）
  const r6 = CE.simulateBattle('north_forest_hunt', b => {
    if (b.waveIdx === 0) {
      if (canUseSkill(b, 'frost_3_thorns')) {
        const want = b.player.mp >= 180 ? 0.20 : 0;
        if (b.player.ampPct !== want) return { type: 'amp', pct: want };
        return { type: 'skill', skillId: 'frost_3_thorns' };
      }
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      if (canUseSkill(b, 'water_3_blade')) return { type: 'skill', skillId: 'water_3_blade' };
      return { type: 'endTurn' };
    }
    const e = b.enemies[0], st = e.intent ? e.intent.stance : '';
    if (st === 'CLOSE_LUNGE' && !b.player.status.lungeMitigate && canUseSkill(b, 'sword_2_cold_edge')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'sword_2_cold_edge' };
    }
    if (st === 'DUAL_CAST' && canUseSkill(b, 'water_3_blade')) {
      const want = (e.evadeCharges === 0 && b.player.mp >= 190) ? 0.40 : 0;
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'water_3_blade' };
    }
    if (b.player.hp < 180 && !b.player.status.afterimage && !(e.status && e.status.stagger) && canUseSkill(b, 'move_afterimage')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'move_afterimage' };
    }
    if (e.evadeCharges === 0 && canUseSkill(b, 'water_3_blade')) {
      const want = b.player.mp >= 210 ? 0.60 : (b.player.mp >= 160 ? 0.40 : (b.player.mp >= 100 ? 0.20 : 0));
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'water_3_blade' };
    }
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if (canUseSkill(b, 'sword_2_cold_edge')) return { type: 'skill', skillId: 'sword_2_cold_edge' };
    return { type: 'endTurn' };
  });
  ok(`主线第 6 幕「北林双波次」W1清狼 + W2寒锋迎击影豺零暴露通关 (${r6.grade}级 / ${r6.turns}T / ripostes=${r6.metrics.ripostes})`,
    r6.won && r6.metrics.ripostes >= 1 && !r6.exposureWarned,
    JSON.stringify({ won: r6.won, grade: r6.grade, turns: r6.turns, exp: r6.exposure, warn: r6.exposureWarned, rip: r6.metrics.ripostes }));

  // 7) 赫兰冰封峡谷双波次（钢霜壁垒护箱 + 艾诺双矛震碎领主晶核）
  const r7 = CE.simulateBattle('hulan_beast_tide', b => {
    const alive = b.enemies.filter(x => x.hp > 0);
    if (b.waveIdx === 0) {
      const brute = b.enemies[0];
      if (brute && brute.hp > 0 && brute.intent && brute.intent.stance === 'DUAL_CAST' && canUseSkill(b, 'ice_3_starfrost')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'ice_3_starfrost', targetIdx: 0 };
      }
      if (brute && brute.hp > 0 && !(brute.status && brute.status.stagger) && !b.player.status.fortress && canUseSkill(b, 'shield_3_steel')) {
        const want = b.player.mp >= 150 ? 0.40 : 0.20;
        if (b.player.ampPct !== want) return { type: 'amp', pct: want };
        return { type: 'skill', skillId: 'shield_3_steel' };
      }
      if (alive.length >= 2 && canUseSkill(b, 'frost_3_thorns')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'frost_3_thorns' };
      }
      if (canUseSkill(b, 'water_3_blade')) {
        const want = b.player.mp >= 190 ? 0.40 : (b.player.mp >= 120 ? 0.20 : 0);
        if (b.player.ampPct !== want) return { type: 'amp', pct: want };
        return { type: 'skill', skillId: 'water_3_blade', targetIdx: brute && brute.hp > 0 ? 0 : undefined };
      }
      return { type: 'endTurn' };
    }
    const boss = b.enemies[0], claw = b.enemies[1];
    const bst = boss && boss.intent ? boss.intent.stance : '';
    if (boss && boss.hp > 0 && bst === 'DUAL_CAST' && canUseSkill(b, 'ice_3_starfrost')) {
      const want = b.player.mp >= 170 ? 0.20 : 0;
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'ice_3_starfrost', targetIdx: 0 };
    }
    if (boss && boss.hp > 0 && !(boss.status && boss.status.stagger) && !b.player.status.fortress && canUseSkill(b, 'shield_3_steel')) {
      const want = b.player.mp >= 150 ? 0.40 : (b.player.mp >= 90 ? 0.20 : 0);
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'shield_3_steel' };
    }
    if (boss && boss.hp > 0 && bst === 'CLOSE_LUNGE' && !b.player.status.lungeMitigate && canUseSkill(b, 'sword_2_cold_edge')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'sword_2_cold_edge', targetIdx: 0 };
    }
    if (claw && claw.hp > 0 && canUseSkill(b, 'ice_3_starfrost') && (!boss || boss.hp <= 0 || boss.status.stagger)) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'ice_3_starfrost', targetIdx: 1 };
    }
    if (boss && boss.hp > 0 && canUseSkill(b, 'ice_3_starfrost')) {
      const want = (boss.coreShattered && b.player.mp >= 220) ? 0.60 : (b.player.mp >= 190 ? 0.40 : (b.player.mp >= 120 ? 0.20 : 0));
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'ice_3_starfrost', targetIdx: 0 };
    }
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if (canUseSkill(b, 'sword_2_cold_edge')) return { type: 'skill', skillId: 'sword_2_cold_edge' };
    return { type: 'endTurn' };
  });
  const hulanCoreShattered = r7.log.some(l => l.includes('幽蓝晶核轰然震碎'));
  ok(`主线第 7 幕「赫兰冰封峡谷双波次」护药箱(${r7.crateHp}/120) + 艾诺双矛震碎领主晶核通关 (${r7.grade}级 / ${r7.turns}T)`,
    r7.won && r7.crateHp >= 60 && hulanCoreShattered,
    JSON.stringify({ won: r7.won, grade: r7.grade, turns: r7.turns, crateHp: r7.crateHp, shattered: hulanCoreShattered }));

  // 8) 东翼火廊突围战双波次（14岁无寒锋斩 + 红莲铁幕二阶段 + 激流涌克火 + 晦轮杖穿魔盾）
  const r8 = CE.simulateBattle('turning_point_corridor', b => {
    if (b.waveIdx === 0) {
      const mage = b.enemies[1];
      if (mage && mage.hp > 0 && mage.intent && mage.intent.stance === 'DUAL_CAST' && canUseSkill(b, 'water_2_surge')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'water_2_surge', targetIdx: 1 };
      }
      if (b.enemies.filter(x => x.hp > 0).length >= 2 && canUseSkill(b, 'frost_2_breath')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'frost_2_breath' };
      }
      if (b.player.hp < 150 && b.player.shield < 35 && canUseSkill(b, 'shield_2_mirror')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'shield_2_mirror' };
      }
      const targetIdx = mage && mage.hp > 0 ? 1 : 0;
      if (canUseSkill(b, 'water_2_surge')) {
        const want = b.player.mp >= 160 ? 0.20 : 0;
        if (b.player.ampPct !== want) return { type: 'amp', pct: want };
        return { type: 'skill', skillId: 'water_2_surge', targetIdx };
      }
      return { type: 'endTurn' };
    }
    const boss = b.enemies[0], st = boss.intent ? boss.intent.stance : '';
    if (st === 'DUAL_CAST' && canUseSkill(b, 'water_2_surge')) {
      if (boss.shield >= 40 && b.player.hasEclipseWand && !b.player.wandActive && b.player.mp >= 110) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'wand', on: true };
      }
      const want = (!b.player.wandActive && b.player.mp >= 180) ? 0.40 : ((!b.player.wandActive && b.player.mp >= 110) ? 0.20 : 0);
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'water_2_surge', targetIdx: 0 };
    }
    if (st === 'CLOSE_LUNGE' && b.player.hp < 185) {
      if (canUseSkill(b, 'move_afterimage')) return { type: 'skill', skillId: 'move_afterimage' };
      if (b.player.shield < 45 && canUseSkill(b, 'shield_2_mirror')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'shield_2_mirror' };
      }
    }
    if (boss.shield >= 45 && b.player.hasEclipseWand && !b.player.wandActive && b.player.mp >= 115 && b.ap >= 1) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'wand', on: true };
    }
    if (canUseSkill(b, 'water_2_surge')) {
      const want = b.player.wandActive ? 0 : (b.player.mp >= 210 ? 0.40 : (b.player.mp >= 140 ? 0.20 : 0));
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'water_2_surge', targetIdx: 0 };
    }
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if (canUseSkill(b, 'sword_1_basic')) return { type: 'skill', skillId: 'sword_1_basic' };
    return { type: 'endTurn' };
  });
  ok(`主线第 8 幕「东翼火廊突围战双波次」14岁配装触发红莲铁幕二阶段 + 晦轮真伤通关 (${r8.grade}级 / ${r8.turns}T / wandHits=${r8.metrics.wandHits})`,
    r8.won && r8.metrics.phase2Triggered === true && r8.metrics.wandHits >= 1 &&
    !CE.STAGES.turning_point_corridor.preset.skills.includes('sword_2_cold_edge'),
    JSON.stringify({ won: r8.won, grade: r8.grade, turns: r8.turns, p2: r8.metrics.phase2Triggered, wandHits: r8.metrics.wandHits }));

  // 休闲模式主线 1–8 幕全通杀（统一轻松零增幅策略）
  const mainlineIds = [
    'beatrice_11', 'rowan_graveyard', 'alice_9', 'aino_sparring',
    'noelle_14', 'north_forest_hunt', 'hulan_beast_tide', 'turning_point_corridor',
  ];
  const casualFails = [];
  for (const sid of mainlineIds) {
    const res = CE.simulateBattle(sid, b => {
      const e = b.enemies.find(x => x.hp > 0);
      if (!e) return { type: 'endTurn' };
      const st = e.intent ? e.intent.stance : '';
      const sks = b.player.skills;
      const shieldSk = sks.find(s => s.startsWith('shield_'));
      const iceSk = sks.find(s => s.startsWith('ice_'));
      const waterSk = sks.find(s => s.startsWith('water_'));
      const frostSk = sks.find(s => s.startsWith('frost_'));
      const swordSk = sks.find(s => s.startsWith('sword_'));

      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      if (sid === 'aino_sparring') {
        if ((st === 'DUAL_CAST' || b.player.status.mirrorRiposteWindow > 0) && iceSk && canUseSkill(b, iceSk)) return { type: 'skill', skillId: iceSk };
        if (shieldSk && canUseSkill(b, shieldSk)) return { type: 'skill', skillId: shieldSk };
        return { type: 'endTurn' };
      }
      if (sid === 'rowan_graveyard') {
        if ((st === 'UNDER_SEEP' || st === 'CLOSE_LUNGE') && shieldSk && canUseSkill(b, shieldSk)) return { type: 'skill', skillId: shieldSk };
        if (b.frostFloorTurns === 0 && frostSk && canUseSkill(b, frostSk)) return { type: 'skill', skillId: frostSk };
        if (st === 'DUAL_CAST' && iceSk && canUseSkill(b, iceSk)) return { type: 'skill', skillId: iceSk };
        return { type: 'endTurn' };
      }
      if (sid === 'north_forest_hunt' && b.waveIdx === 1) {
        if (st === 'CLOSE_LUNGE' && swordSk && canUseSkill(b, swordSk)) return { type: 'skill', skillId: swordSk };
        if (waterSk && canUseSkill(b, waterSk)) return { type: 'skill', skillId: waterSk };
        if (swordSk && canUseSkill(b, swordSk)) return { type: 'skill', skillId: swordSk };
        return { type: 'endTurn' };
      }
      if (b.player.status.blind > 0 && waterSk && canUseSkill(b, waterSk)) return { type: 'skill', skillId: waterSk };
      if (st === 'UNDER_SEEP' && frostSk && canUseSkill(b, frostSk)) return { type: 'skill', skillId: frostSk };
      if (b.enemies.filter(x => x.hp > 0).length >= 2 && frostSk && canUseSkill(b, frostSk)) return { type: 'skill', skillId: frostSk };
      if ((b.player.hp < b.player.mhp * 0.7 || (b.crateHp != null && !b.player.status.crateGuard)) && b.player.shield < 35 && shieldSk && canUseSkill(b, shieldSk) && !(e.status && e.status.stagger)) {
        return { type: 'skill', skillId: shieldSk };
      }
      if (st === 'DUAL_CAST' && waterSk && e.elem === 'fire' && canUseSkill(b, waterSk)) return { type: 'skill', skillId: waterSk };
      if (st === 'DUAL_CAST' && iceSk && canUseSkill(b, iceSk)) return { type: 'skill', skillId: iceSk };
      if (e.elem === 'fire' && waterSk && canUseSkill(b, waterSk)) return { type: 'skill', skillId: waterSk };
      if (sid === 'alice_9' && frostSk && canUseSkill(b, frostSk)) return { type: 'skill', skillId: frostSk };
      if (iceSk && canUseSkill(b, iceSk)) return { type: 'skill', skillId: iceSk };
      if (waterSk && canUseSkill(b, waterSk)) return { type: 'skill', skillId: waterSk };
      if (swordSk && canUseSkill(b, swordSk)) return { type: 'skill', skillId: swordSk };
      return { type: 'endTurn' };
    }, { casualMode: true });
    if (!res.won || !res.casualMode) casualFails.push(`${sid}:${res.endReason}`);
  }
  ok('休闲模式全主线 1–8 幕通杀（统一零增幅轻松策略 8/8 胜出）',
    casualFails.length === 0, casualFails.join(', '));

  // 9) 第 9 幕神级风神：arenaTestOnly + godTierChallenge + 七阶机制 + 满配/休闲可解
  const wgCfg = CE.STAGES.wind_god_eye;
  const wgTpl = wgCfg.waves[0].enemies[0];
  const wgMetaOk = wgCfg.mainline === false && wgCfg.arenaTestOnly === true && wgCfg.godTierChallenge === true &&
    wgTpl.rank === 7 && wgTpl.spd === 160 && wgTpl.hp === 2200 && wgTpl.maxLocks === 7 && wgTpl.phase2HpPct === 0.55;

  const bWgMech = CE.startStage('wind_god_eye', { headless: true, usePreset: true, relics: [] });
  const preStrikeOk = bWgMech.player.hp < bWgMech.player.mhp && bWgMech.log.some(l => l.includes('神威疾风压境'));
  const estWall = CE.estimateSkillDamage(bWgMech, CE.SKILLS.ice_3_starfrost, bWgMech.enemies[0]);
  bWgMech.enemies[0].broken = true;
  const estUnwalled = CE.estimateSkillDamage(bWgMech, CE.SKILLS.ice_3_starfrost, bWgMech.enemies[0]);
  const wallMitOk = estWall.dmg < estUnwalled.dmg * 0.50;
  // 测试寒锋斩·斩风瞬反（TEMPEST_VACUUM）与 霜域棘阵破风眼静滞（EYE_STILLNESS）
  bWgMech.enemies[0].broken = false;
  bWgMech.enemies[0].intent = { moveKey: 'TEMPEST_VACUUM', stance: 'CLOSE_LUNGE', moveName: '神域·风暴眼真空连刃', dmg: 228, elem: 'wind', tempestVacuum: true };
  bWgMech.ap = 2;
  CE.useSkill('sword_2_cold_edge', 0, bWgMech);
  const vacuumParryOk = bWgMech.enemies[0].status.stagger >= 1 && bWgMech.ap === 2 && bWgMech.metrics.ripostes >= 1 && bWgMech.metrics.interrupts >= 1;

  delete bWgMech.enemies[0].status.stagger;
  bWgMech.enemies[0].shield = 150;
  bWgMech.enemies[0].intent = { moveKey: 'EYE_STILLNESS', stance: 'GUARD_COUNTER', moveName: '神域·风眼静滞圆心反制', dmg: 196, elem: 'wind', eyeStillnessStance: true };
  bWgMech.ap = 2;
  CE.useSkill('frost_3_thorns', 0, bWgMech);
  const stillnessBreakOk = bWgMech.enemies[0].status.stagger >= 1 && bWgMech.enemies[0].shield <= 60;

  const windGodPolicy = b => {
    const e = b.enemies[0], st = e.intent ? e.intent.stance : '', mk = e.intent ? e.intent.moveKey : '';
    if (b.player.bondAssist && !b.player.bondAssistUsed && b.player.hp < 160) return { type: 'assist' };
    if ((mk === 'TEMPEST_VACUUM' || st === 'CLOSE_LUNGE') && !b.player.status.lungeMitigate && canUseSkill(b, 'sword_2_cold_edge')) {
      if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
      return { type: 'skill', skillId: 'sword_2_cold_edge' };
    }
    if (mk === 'EYE_STILLNESS') {
      if (canUseSkill(b, 'frost_3_thorns')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'frost_3_thorns' };
      }
      if (canUseSkill(b, 'ice_3_starfrost') && b.player.mp >= 150) {
        if (b.player.ampPct !== 0.40) return { type: 'amp', pct: 0.40 };
        return { type: 'skill', skillId: 'ice_3_starfrost' };
      }
    }
    if (st === 'DUAL_CAST' && canUseSkill(b, 'ice_3_starfrost')) {
      const want = b.player.mp >= 190 ? 0.40 : (b.player.mp >= 120 ? 0.20 : 0);
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'ice_3_starfrost' };
    }
    if (!(e.status && e.status.stagger) && !b.player.status.fortress && canUseSkill(b, 'shield_3_steel')) {
      const want = b.player.mp >= 150 ? 0.40 : 0.20;
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'shield_3_steel' };
    }
    if (e.broken || st === 'STAGGERED') {
      if (canUseSkill(b, 'ice_3_starfrost')) {
        const want = b.player.mp >= 210 ? 0.60 : (b.player.mp >= 150 ? 0.40 : 0.20);
        if (b.player.ampPct !== want) return { type: 'amp', pct: want };
        return { type: 'skill', skillId: 'ice_3_starfrost' };
      }
    }
    if (st === 'GUARD_COUNTER' && !e.broken) {
      if (canUseSkill(b, 'frost_3_thorns')) {
        if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
        return { type: 'skill', skillId: 'frost_3_thorns' };
      }
      if (canUseSkill(b, 'move_afterimage') && !b.player.status.afterimage) return { type: 'skill', skillId: 'move_afterimage' };
      return { type: 'endTurn' };
    }
    if (canUseSkill(b, 'ice_3_starfrost')) {
      const want = b.player.mp >= 200 ? 0.40 : 0;
      if (b.player.ampPct !== want) return { type: 'amp', pct: want };
      return { type: 'skill', skillId: 'ice_3_starfrost' };
    }
    if (b.player.ampPct !== 0) return { type: 'amp', pct: 0 };
    if (canUseSkill(b, 'sword_2_cold_edge')) return { type: 'skill', skillId: 'sword_2_cold_edge' };
    return { type: 'endTurn' };
  };
  const r9Full = CE.simulateBattle('wind_god_eye', windGodPolicy, {
    staff: 'north_saint_staff',
    relics: ['aino_academy_handkerchief', 'aino_frost_shard', 'northwind_pass', 'blue_vial'],
    bondAssist: 'alice',
  });
  const r9Cas = CE.simulateBattle('wind_god_eye', windGodPolicy, { casualMode: true });
  ok(`第 9 幕神级风神「演武专属」：元数据/先手疾风/风壁减伤/斩风瞬反/破风眼静滞全验证，终局满配(${r9Full.grade}/${r9Full.turns}T)与休闲(${r9Cas.grade}/${r9Cas.turns}T)双通`,
    wgMetaOk && preStrikeOk && wallMitOk && vacuumParryOk && stillnessBreakOk &&
    r9Full.won && r9Full.metrics.phase2Triggered && r9Cas.won && r9Cas.metrics.phase2Triggered,
    JSON.stringify({ wgMetaOk, preStrikeOk, wallMitOk, vacuumParryOk, stillnessBreakOk, full: r9Full.won, cas: r9Cas.won }));

  // 反无脑底线：纯平砍复读在全部 9 关胜率 = 0%
  const mashLeaks = Object.keys(CE.STAGES).filter(sid => {
    const res = CE.simulateBattle(sid, b => {
      const sw = b.player.skills.find(s => s.startsWith('sword_'));
      if (sw && canUseSkill(b, sw)) return { type: 'skill', skillId: sw };
      return { type: 'endTurn' };
    });
    return res.won;
  });
  ok('反无脑底线：纯剑技单键复读在全部 9 关胜率 = 0.00%', mashLeaks.length === 0, mashLeaks.join(', '));
}

// ===== 6. 主线存档 AGE_FLOOR_V3 + 六维 tanh 软上限与进化技能组校验 =====
console.log('\n[6] 主线存档 AGE_FLOOR_V3 保底、六维比例 tanh 软上限与按年龄进化技能组校验');
{
  const B32 = CE.COMBAT_BALANCE_V32;
  const ageKeys = [7, 8, 9, 11, 12, 14, 15, 16];
  const statKeys = ['hp', 'mp', 'atk', 'matk', 'def', 'mdef'];
  ok('AGE_FLOOR_V3 覆盖 7/8/9/11/12/14/15/16 岁且 SOFT_CAP_RATIOS 覆盖全部六维',
    ageKeys.every(a => !!B32.AGE_FLOOR_V3[a]) &&
    statKeys.every(k => B32.SOFT_CAP_RATIOS[k] && B32.SOFT_CAP_RATIOS[k].gain > 0 && B32.SOFT_CAP_RATIOS[k].floor > 0));

  // 低练度存档触发 AGE_FLOOR_V3 + floor 保底
  win.__resetS();
  const lowS = win.__getS();
  lowS.ageY = 16; lowS.phase = 'journey'; lowS.lv = 1;
  lowS.mhp = 1; lowS.hp = 1; lowS.mmp = 1; lowS.mp = 1;
  lowS.atk = 1; lowS.mag = 1; lowS.pdef = 1; lowS.mdef = 1;
  lowS.stats = { body: 1, mind: 1, mana: 1, charm: 1 };
  lowS.skills = ['virtual_duel'];
  win.__setS(lowS);
  const bLow16 = CE.startStage('hulan_beast_tide', { headless: true, usePreset: false, fullRestore: true });
  const p16 = CE.STAGES.hulan_beast_tide.preset;
  const floorOk = bLow16.player.mhp >= Math.round(p16.mhp * B32.SOFT_CAP_RATIOS.hp.floor) &&
    bLow16.player.mmp >= Math.round(p16.mmp * B32.SOFT_CAP_RATIOS.mp.floor) &&
    bLow16.player.atk >= Math.round(p16.atk * B32.SOFT_CAP_RATIOS.atk.floor) &&
    bLow16.player.matk >= Math.round(p16.matk * B32.SOFT_CAP_RATIOS.matk.floor) &&
    bLow16.player.def >= Math.round(p16.def * B32.SOFT_CAP_RATIOS.def.floor) &&
    bLow16.player.mdef >= Math.round(p16.mdef * B32.SOFT_CAP_RATIOS.mdef.floor);

  // 极限肝帝爆表存档触发六维 tanh 软上限（绝不数值崩溃）
  win.__resetS();
  const godS = win.__getS();
  godS.ageY = 16; godS.phase = 'journey'; godS.lv = 99;
  godS.mhp = 9999; godS.hp = 9999; godS.mmp = 9999; godS.mp = 9999;
  godS.atk = 999; godS.mag = 999; godS.pdef = 999; godS.mdef = 999;
  godS.stats = { body: 999, mind: 999, mana: 999, charm: 999 };
  godS.skills = ['virtual_duel', 'wind_afterimage'];
  win.__setS(godS);
  const bGod16 = CE.startStage('hulan_beast_tide', { headless: true, usePreset: false, fullRestore: true });
  const capMax = (base, key) => Math.round(base * (1 + B32.SOFT_CAP_RATIOS[key].gain)) + 1;
  const tanhCapOk = bGod16.player.mhp <= capMax(p16.mhp, 'hp') && bGod16.player.mhp > p16.mhp &&
    bGod16.player.mmp <= capMax(p16.mmp, 'mp') && bGod16.player.mmp > p16.mmp &&
    bGod16.player.atk <= capMax(p16.atk, 'atk') && bGod16.player.atk > p16.atk &&
    bGod16.player.matk <= capMax(p16.matk, 'matk') && bGod16.player.matk > p16.matk &&
    bGod16.player.def <= capMax(p16.def, 'def') && bGod16.player.def > p16.def &&
    bGod16.player.mdef <= capMax(p16.mdef, 'mdef') && bGod16.player.mdef > p16.mdef;

  // 进化技能组按年龄与规则精确匹配
  win.__resetS();
  const s12 = win.__getS();
  s12.ageY = 12; s12.phase = 'academy'; s12.skills = ['virtual_duel'];
  win.__setS(s12);
  const bAinoSave = CE.startStage('aino_sparring', { headless: true, usePreset: false, fullRestore: true });
  const ainoDeckOk = bAinoSave.player.skills.includes('ice_2_prism') &&
    !bAinoSave.player.skills.some(s => s.startsWith('water_')) &&
    !bAinoSave.player.skills.includes('move_afterimage');

  win.__resetS();
  const s14Cor = win.__getS();
  s14Cor.ageY = 14; s14Cor.phase = 'academy'; s14Cor.skills = ['virtual_duel', 'wind_afterimage'];
  win.__setS(s14Cor);
  const bCorSave = CE.startStage('turning_point_corridor', { headless: true, usePreset: false, fullRestore: true });
  const corDeckOk = bCorSave.player.skills.includes('ice_2_prism') &&
    bCorSave.player.skills.includes('water_2_surge') &&
    bCorSave.player.skills.includes('sword_1_basic') &&
    !bCorSave.player.skills.includes('sword_2_cold_edge') &&
    bCorSave.player.skills.includes('move_afterimage');

  const godDeckOk = bGod16.player.skills.includes('ice_3_starfrost') &&
    bGod16.player.skills.includes('water_3_blade') &&
    bGod16.player.skills.includes('frost_3_thorns') &&
    bGod16.player.skills.includes('shield_3_steel') &&
    bGod16.player.skills.includes('sword_2_cold_edge') &&
    bGod16.player.skills.includes('move_afterimage');

  ok('主线存档 AGE_FLOOR_V3 保底、六维 tanh 软上限（极低不崩 / 极高不爆表）与分龄进化技能组校验全通过',
    floorOk && tanhCapOk && ainoDeckOk && corDeckOk && godDeckOk,
    JSON.stringify({
      floorOk, tanhCapOk, ainoDeckOk, corDeckOk, godDeckOk,
      low: { hp: bLow16.player.mhp, mp: bLow16.player.mmp, matk: bLow16.player.matk },
      god: { hp: bGod16.player.mhp, mp: bGod16.player.mmp, atk: bGod16.player.atk, matk: bGod16.player.matk, def: bGod16.player.def, mdef: bGod16.player.mdef },
    }));
}

// ===== 7. 6+6 DOM 站位、原地切靶、演武沙盒零污染、键鼠滑条与 CrystalSFX amp_charge 校验 =====
console.log('\n[7] 6+6 站位 DOM、原地切靶零重建、演武沙盒零污染、键鼠滑条与 CrystalSFX amp_charge 校验');
{
  win.__resetS();
  const babyS = win.__getS();
  const snapBefore = { lv: babyS.lv, exp: babyS.exp, gold: babyS.gold, invLen: babyS.inv.length, skillsLen: babyS.skills.length };

  $('title-screen').classList.remove('hidden');
  $('btn-arena-title').click();
  const arenaOv = $('arena-overlay');
  ok('演武大厅展开渲染全部 9 关且按钮焦点 Enter 不被全局捕获吞死',
    !arenaOv.classList.contains('hidden') && arenaOv.querySelectorAll('.arena-stage-card').length === 9);

  const firstCard = arenaOv.querySelector('.arena-stage-card');
  firstCard.focus();
  const enterEvt = new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  firstCard.dispatchEvent(enterEvt);
  ok('演武卡片按钮聚焦时按 Enter 放行原生触发（defaultPrevented===false）', enterEvt.defaultPrevented === false);

  // 7.1 经典 6+6 站位 DOM（罗文战：希尔维亚后排 slot 1 + 雷纳德前排 slot 4）
  arenaOv.querySelector('[data-stage="rowan_graveyard"]').click();
  const rowanSt = CE.getBattleState();
  const allySlots = $('cb-ally-formation').querySelectorAll('.cb-ally-slot');
  const enemySlots = $('cb-enemy-zone').querySelectorAll('.cb-enemy-slot');
  const midCorridor = $('cb-mid-corridor');
  const playerStage = $('cb-player-stage');
  const sylviaSlot = $('cb-p-portrait') && $('cb-p-portrait').closest('.cb-ally-slot');
  const renoSlot = $('cb-ally-vanguard-slot') && $('cb-ally-vanguard-slot').closest('.cb-ally-slot');
  const allyPane = $('cb-ally-pane');
  const allySlotOrder = Array.from(allySlots).map(el => Number(el.getAttribute('data-slot')));
  const enemySlotOrder = Array.from(enemySlots).map(el => Number(el.getAttribute('data-slot')));
  ok('罗文战经典 6+6 站位 DOM：2列×3行 [0,3,1,4,2,5]、中场留空、主角后排 slot 1、雷纳德前排 slot 4（火土风三系）及雪瓷信息板',
    allySlots.length === 6 && enemySlots.length === 6 && !!midCorridor &&
    JSON.stringify(allySlotOrder) === '[0,3,1,4,2,5]' &&
    JSON.stringify(enemySlotOrder) === '[0,3,1,4,2,5]' &&
    playerStage.classList.contains('has-vanguard-ally') &&
    sylviaSlot && sylviaSlot.getAttribute('data-slot') === '1' && sylviaSlot.getAttribute('data-col') === 'back' &&
    renoSlot && renoSlot.getAttribute('data-slot') === '4' && renoSlot.getAttribute('data-col') === 'front' &&
    !!allyPane && allyPane.textContent.includes('雷纳德') && allyPane.textContent.includes('岩盾') &&
    rowanSt.player.slot === 1 && rowanSt.allies.length === 1 && rowanSt.allies[0].slot === 4 &&
    rowanSt.allies[0].nextElement === 'fire' && rowanSt.enemies[0].slot === 1,
    JSON.stringify({ allySlotOrder, enemySlotOrder, nextEl: rowanSt.allies[0] && rowanSt.allies[0].nextElement, sSlot: sylviaSlot && sylviaSlot.getAttribute('data-slot'), rSlot: renoSlot && renoSlot.getAttribute('data-slot') }));
  CE.exitBattle(false);

  // 7.2 单人多敌站位 + 原地切靶零 DOM 重建
  CE.startStage('north_forest_hunt', { fromArena: true });
  const soloSt = CE.getBattleState();
  const soloSylviaSlot = $('cb-p-portrait') && $('cb-p-portrait').closest('.cb-ally-slot');
  const card0Before = $('cb-enemy-zone').querySelector('.cb-enemy-card[data-eidx="0"]');
  const card1Before = $('cb-enemy-zone').querySelector('.cb-enemy-card[data-eidx="1"]');
  card1Before.onclick();
  const card0After = $('cb-enemy-zone').querySelector('.cb-enemy-card[data-eidx="0"]');
  const card1After = $('cb-enemy-zone').querySelector('.cb-enemy-card[data-eidx="1"]');
  ok('单人多敌战主角归位前排 slot 4、4 敌落位 [0,2,3,5]，且点选敌卡原地切靶 .targeted 零 DOM 重建',
    soloSylviaSlot && soloSylviaSlot.getAttribute('data-slot') === '4' &&
    !$('cb-ally-pane') &&
    JSON.stringify(soloSt.enemies.map(e => e.slot)) === '[0,2,3,5]' &&
    CE.getState().targetIdx === 1 &&
    card0Before === card0After && card1Before === card1After &&
    !card0After.classList.contains('targeted') && card1After.classList.contains('targeted'),
    JSON.stringify({ sSlot: soloSylviaSlot && soloSylviaSlot.getAttribute('data-slot'), eSlots: soloSt.enemies.map(e => e.slot), targetIdx: CE.getState().targetIdx }));

  // 7.3 护手档位速切 + 沙盒获胜零主线存档污染
  const assistBtn = $('cb-btn-assist-mode');
  assistBtn.click();
  const m1 = CE.getAssistMode() === 'relaxed' && CTR.getAssistMode() === 'relaxed';
  assistBtn.click();
  const m2 = CE.getAssistMode() === 'off' && CTR.getAssistMode() === 'off';
  assistBtn.click();
  const m3 = CE.getAssistMode() === 'standard' && CTR.getAssistMode() === 'standard';
  ok('顶部护手速切按钮 #cb-btn-assist-mode 在 standard/relaxed/off 间循环并与 CombatTimingRing 同步', m1 && m2 && m3);

  CE.startStage('beatrice_11', { fromArena: true });
  const bBeat = CE.getState();
  const fcIdle1 = $('cb-forecast-bar').textContent;
  $('battle-screen').querySelector('[data-sk="water_1_ball"]').onmouseenter();
  const fcHover1 = $('cb-forecast-bar').textContent;
  const previewWater = $('cb-oc-mult').textContent;
  $('battle-screen').querySelector('[data-sk="ice_1_crystal"]').onmouseenter();
  const previewIce = $('cb-oc-mult').textContent;

  const ocSegEl = $('cb-oc-seg');
  const ocSliderEl = $('cb-oc-slider');
  const snap1 = CE.setOvercastPct(0.01, bBeat, { snap: true });
  const snap19 = CE.setOvercastPct(0.19, bBeat, { snap: true });
  ocSliderEl.value = '1'; ocSliderEl.onkeydown({ key: 'ArrowRight' }); ocSliderEl.oninput();
  const keyStep1 = bBeat.player.ampPct;
  ocSliderEl.value = '19'; ocSliderEl.onkeydown({ key: 'ArrowRight' }); ocSliderEl.oninput();
  const keyStep19 = bBeat.player.ampPct;
  ocSliderEl.value = '21'; ocSliderEl.onkeydown({ key: 'ArrowRight' }); ocSliderEl.oninput();
  const keyStep21 = bBeat.player.ampPct;
  ocSliderEl.onpointerdown(); ocSliderEl.value = '19'; ocSliderEl.oninput();
  const dragSnap19 = bBeat.player.ampPct;

  CE.setOvercast(0, bBeat);
  const turnBeforeKeys = bBeat.turn;
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  const modeAfterW = bBeat.player.overcastMode;
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  const modeAfterE = bBeat.player.overcastMode;
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'x', repeat: true, bubbles: true }));
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'x', ctrlKey: true, bubbles: true }));
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'x', metaKey: true, bubbles: true }));
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'e', altKey: true, bubbles: true }));
  const turnAfterGuard = bBeat.turn;
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'x', bubbles: true }));
  const turnAfterX = bBeat.turn;

  ok('第 1–4 幕预估栏用「增幅」无「魔战」、悬停实时联动耗蓝、#cb-oc-seg 无内联列宽、滑条键步不磁吸/拖拽磁吸',
    !fcIdle1.includes('魔战') && fcHover1.includes('增幅') && !fcHover1.includes('魔战') &&
    previewWater !== previewIce && previewWater.includes('水球术') && previewIce.includes('冰晶术') &&
    ocSegEl.style.gridTemplateColumns === '' &&
    snap1.overcastPct === 0.01 && snap19.overcastPct === 0.20 &&
    keyStep1 === 0.01 && keyStep19 === 0.19 && keyStep21 === 0.21 && dragSnap19 === 0.20,
    JSON.stringify({ previewWater, previewIce, snap1: snap1.overcastPct, snap19: snap19.overcastPct, keyStep1, keyStep19, keyStep21, dragSnap19 }));

  ok('战斗热键 W/E 切增幅不误跳回合、repeat 与 Ctrl/Meta/Alt 组合键严格拦截、普通 X 正常结束回合',
    modeAfterW === 1 && modeAfterE === 2 && turnAfterGuard === turnBeforeKeys && turnAfterX === turnBeforeKeys + 1,
    JSON.stringify({ modeAfterW, modeAfterE, turnBeforeKeys, turnAfterGuard, turnAfterX }));

  // 演武获胜零主线污染 + 退回标题页清理 BGM
  bBeat.enemies[0].hp = 1; bBeat.enemies[0].shield = 0;
  CE.setOvercast(0, bBeat);
  CE.useSkill('water_1_ball', 0, bBeat);
  ok('演武沙盒获胜弹出结算面板并确认返回', !!$('cb-result-modal') && bBeat.won === true);
  $('cr-done').click();
  const afterS = win.__getS();
  ok('演武场沙盒通关绝不污染 0 岁主线存档等级/经验/金币/背包/技能',
    afterS.lv === snapBefore.lv && afterS.exp === snapBefore.exp && afterS.gold === snapBefore.gold &&
    afterS.inv.length === snapBefore.invLen && afterS.skills.length === snapBefore.skillsLen);
  $('am-close').click();
  const bgmAudio = $('bgm-audio');
  ok('关闭演武大厅恢复标题页且战斗 BGM 无残留泄漏',
    !$('title-screen').classList.contains('hidden') && (!bgmAudio.getAttribute('src') || bgmAudio.paused));

  // 主线未习得 virtual_duel 时拦截 openDuelMenu
  win.__resetS();
  const storyS = win.__getS();
  storyS.ageY = 6; storyS.phase = 'youth'; storyS.freeRoam = true;
  win.__setS(storyS);
  ok('未习得 virtual_duel 时调用 openDuelMenu 被原著规则拦截', win.openDuelMenu() === false);

  // 7.4 CrystalSFX amp_charge 三阶泛音阈值严格对齐 20% / 40% / 60%
  if (win.CrystalSFX && typeof win.CrystalSFX.play === 'function' && win.AudioContext && win.AudioContext.prototype) {
    const origCreateOsc = win.AudioContext.prototype.createOscillator;
    const origCreateBuf = win.AudioContext.prototype.createBufferSource;
    const origPerfNow = win.performance && typeof win.performance.now === 'function' ? win.performance.now.bind(win.performance) : null;
    let clockOffsetMs = 10000;
    const measureVoices = pct => {
      const spawned = [];
      let oscCount = 0;
      clockOffsetMs += 5000;
      if (origPerfNow) {
        const off = clockOffsetMs;
        win.performance.now = () => origPerfNow() + off;
      }
      win.AudioContext.prototype.createOscillator = function () {
        const node = origCreateOsc.apply(this, arguments);
        oscCount += 1;
        spawned.push(node);
        return node;
      };
      win.AudioContext.prototype.createBufferSource = function () {
        const node = origCreateBuf.apply(this, arguments);
        spawned.push(node);
        return node;
      };
      try {
        win.CrystalSFX.play('amp_charge', { ampPct: pct, force: true });
      } finally {
        win.AudioContext.prototype.createOscillator = origCreateOsc;
        win.AudioContext.prototype.createBufferSource = origCreateBuf;
        if (origPerfNow) win.performance.now = origPerfNow;
        spawned.forEach(n => { if (typeof n.onended === 'function') n.onended(); });
      }
      return oscCount;
    };
    const v19 = measureVoices(0.19);
    const v20 = measureVoices(0.20);
    const v39 = measureVoices(0.39);
    const v40 = measureVoices(0.40);
    const v59 = measureVoices(0.59);
    const v60 = measureVoices(0.60);
    ok('CrystalSFX amp_charge 三阶泛音严格在 20%/40%/60% 触发（19%/39%/59% 绝不提前响起质变和弦）',
      v19 < v20 && v20 === v39 && v39 < v40 && v40 === v59 && v59 < v60,
      JSON.stringify({ v19, v20, v39, v40, v59, v60 }));
  } else {
    ok('CrystalSFX 模块就绪可测 amp_charge', false, 'CrystalSFX or AudioContext missing');
  }

  // 7.5 自动结束回合偏好与 hasAnyPlayerActionAvailable 防误切回合校验
  const hasAutoEndApi = typeof CE.isAutoEndTurn === 'function' &&
    typeof CE.setAutoEndTurn === 'function' &&
    typeof CE.hasAnyPlayerActionAvailable === 'function';
  if (hasAutoEndApi) {
    const autoDef = CE.isAutoEndTurn() === true;
    CE.setAutoEndTurn(false);
    const autoOff = CE.isAutoEndTurn() === false;
    CE.setAutoEndTurn(true);
    const autoOn = CE.isAutoEndTurn() === true;

    const bAuto = CE.startStage('north_forest_hunt', { headless: true, usePreset: true, relics: [] });
    bAuto.player.skills = ['ice_3_starfrost'];
    bAuto.player.bondAssist = null;
    bAuto.player.bondAssistUsed = true;
    bAuto.player.mp = bAuto.player.mmp;
    CE.setOvercastPct(0, bAuto);
    const mpCost0 = CE.computeSkillMpCost(bAuto.player, CE.SKILLS.ice_3_starfrost);
    CE.setOvercastPct(0.60, bAuto);
    const mpCost60 = CE.computeSkillMpCost(bAuto.player, CE.SKILLS.ice_3_starfrost);

    bAuto.ap = 0;
    const availAp0 = CE.hasAnyPlayerActionAvailable(bAuto);

    bAuto.ap = 1;
    bAuto.player.mp = mpCost0; // 仅 0% 增幅够蓝、60% 增幅不够蓝
    const availAp1LowMpAt60 = CE.hasAnyPlayerActionAvailable(bAuto);

    ok('自动结束回合默认开启/切换与 hasAnyPlayerActionAvailable 精确判定（AP=0→false，AP=1仅60%增幅蓝不足时0%够蓝→true防误切）',
      autoDef && autoOff && autoOn && mpCost0 < mpCost60 && availAp0 === false && availAp1LowMpAt60 === true,
      JSON.stringify({ autoDef, autoOff, autoOn, mpCost0, mpCost60, availAp0, availAp1LowMpAt60 }));
  } else {
    ok('CombatEngine 自动结束回合 API 就绪（isAutoEndTurn/setAutoEndTurn/hasAnyPlayerActionAvailable）', false, 'API missing');
  }
}

// 恢复默认偏好
CE.setCasualMode(false);
CE.setAssistMode('standard');
if (typeof CE.setAutoEndTurn === 'function') CE.setAutoEndTurn(true);

console.log(fail === 0 ? `\n  ✅ V3.2 核心战斗深度单测全部 ${pass}/${pass} 项断言 100% 通过！` : `\n  ❌ ${fail} 项断言失败（通过 ${pass} 项）`);
process.exit(fail ? 1 : 0);
