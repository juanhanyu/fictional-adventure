'use strict';
// =========================================================
// 原著向策略智斗系统 · 第 3 轮终极验收测试套件
// 覆盖：4~8回合起承转合交锋节奏 + 每波独立冰晶宫殿 + Esc防白嫖 + 无冰宫基本功险胜路径 + 单/二/三键盲打 0.00% 穷举
// =========================================================
const h = require('./harness.js');
const win = h.win;
const $ = id => win.document.getElementById(id);

let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (!cond) fail++;
}

const CE = win.CombatEngine;
ok('CombatEngine 模块成功挂载', !!CE && typeof CE.simulateBattle === 'function' && typeof CE.isPalaceReady === 'function');
ok('收录全部 9 场代表性关卡（含第 8/9 幕高难 Boss 试炼）', CE && Object.keys(CE.STAGES).length === 9);

// ===== 1. 原著时间线、设定严谨性与冰晶宫殿反盲蒙字数校验 =====
console.log('\n[1] 原著时间线、晦轮杖铁律与冰晶宫殿字数均衡校验');
{
  const stages = CE.STAGES;
  ok('8岁间章「罗文乱葬岗」排序(order:2)早于12岁学院「艾诺战」(order:4)',
    stages.rowan_graveyard.order < stages.aino_sparring.order && stages.rowan_graveyard.order === 2);
  ok('8岁罗文战背景包含 bg-img-night 与 bg-night',
    stages.rowan_graveyard.bg === 'bg-img-night bg-night');
  const rowanSkills = stages.rowan_graveyard.preset.skills;
  const rowanPassives = stages.rowan_graveyard.preset.passives || [];
  ok('8岁罗文战严格移除12岁艾诺隔空瞬凝/生根之冰及9岁风行残像',
    !rowanSkills.some(s => s.startsWith('remote_')) &&
    !rowanSkills.includes('hand_root_shield') &&
    !rowanSkills.includes('sword_wind_afterimage') &&
    !rowanPassives.includes('root_ice'));
  ok('罗文战冰晶宫殿准确还原「月升影复常 + 调阅第四面冰镜白昼日影 + 预判脱手掷杖」',
    stages.rowan_graveyard.palace.sceneText.includes('影子已恢复') &&
    stages.rowan_graveyard.palace.clues.some(c => c.correct && c.text.includes('第四面冰镜日影')));

  const fs = require('fs');
  const path = require('path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'combat-engine.js'), 'utf8');
  ok('严守 AGENTS.md 晦轮杖设定：不含伪造「静止的日蚀」名称与「不是」句式',
    !engineSrc.includes('静止的日蚀') && !engineSrc.includes('不是'));

  const allPalacePacks = [];
  Object.values(stages).forEach(st => {
    if (st.palace) allPalacePacks.push([st.id, st.palace]);
    if (st.palaceByWave) {
      Object.entries(st.palaceByWave).forEach(([w, p]) => allPalacePacks.push([`${st.id}_w${w}`, p]));
    }
  });
  let strictlyLongestCorrectCount = 0;
  let maxSpread = 0;
  allPalacePacks.forEach(([, pack]) => {
    const lens = pack.clues.map(c => c.text.length);
    const spread = Math.max(...lens) - Math.min(...lens);
    if (spread > maxSpread) maxSpread = spread;
    const correctClue = pack.clues.find(c => c.correct);
    const otherMax = Math.max(...pack.clues.filter(c => !c.correct).map(c => c.text.length));
    if (correctClue.text.length > otherMax) strictlyLongestCorrectCount++;
  });
  ok(`全部 ${allPalacePacks.length} 组冰晶宫殿观察点字数高度均衡 (最大字数差=${maxSpread}<=3，正确项严格最长占比=${strictlyLongestCorrectCount}/${allPalacePacks.length})`,
    maxSpread <= 3 && strictlyLongestCorrectCount === 0);
}

// ===== 2. UI 交互：第1回合凝结采集中、第2步 Esc 防白嫖、双波次独立重置与沙盒零污染校验 =====
console.log('\n[2] 冰宫首回合凝结门控、第2步Esc防白嫖、双波次重置与演武沙盒零污染校验');
{
  win.__resetS();
  const babyS = win.__getS();
  const snapBefore = { lv: babyS.lv, exp: babyS.exp, gold: babyS.gold, invLen: babyS.inv.length, skillsLen: babyS.skills.length };

  $('title-screen').classList.remove('hidden');
  $('btn-arena-title').click();
  const arenaOv = $('arena-overlay');
  ok('点击标题页演武按钮展开大厅且渲染 9 关', !arenaOv.classList.contains('hidden') && arenaOv.querySelectorAll('.arena-stage-card').length === 9);

  const firstCard = arenaOv.querySelector('.arena-stage-card');
  firstCard.focus();
  const enterEvt = new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  firstCard.dispatchEvent(enterEvt);
  ok('焦点位于按钮上时按 Enter 不被全局捕获 preventDefault 吞死', enterEvt.defaultPrevented === false);

  // 进入诺艾儿战
  arenaOv.querySelector('[data-stage="noelle_14"]').click();
  const battleScr = $('battle-screen');
  const palBtn = $('cb-btn-palace');
  ok('进入战斗第 1 回合时冰晶宫殿处于「凝结采集中」禁用态且绝不闪烁诱导',
    palBtn.disabled === true && !palBtn.classList.contains('pulse-hint') && palBtn.textContent.includes('凝结采集中'));
  const earlyPalaceRes = CE.inspectClue('ice_crack_waterline', 'freeze_seep', CE.getState());
  ok('第 1 回合直接调用 inspectClue 被底层 gathering_turn1 严格拦截', earlyPalaceRes.ok === false && earlyPalaceRes.reason === 'gathering_turn1');

  // 实时悬停倾注倍率预览与 W 热键
  const crystalBtn = battleScr.querySelector('[data-sk="hand_ice_crystal"]');
  const thornBtn = battleScr.querySelector('[data-sk="hand_thorn_field"]');
  crystalBtn.onmouseenter();
  const previewCrystal = $('cb-oc-mult').textContent;
  thornBtn.onmouseenter();
  const previewThorn = $('cb-oc-mult').textContent;
  ok('倾注面板随悬停技能真实蓝耗动态变化预览倍率',
    previewCrystal !== previewThorn && previewCrystal.includes('凝华冰晶') && previewThorn.includes('冰棘群刺阵'));

  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  ok('战斗热键 W 正常切换魔战倾注档位', CE.getState().player.overcastMode === 1);
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  ok('战斗热键 W 循环归位至常规档', CE.getState().player.overcastMode === 0);

  // 按 E 结束第 1 回合，经历 1 次敌方行动进入第 2 回合后冰晶宫殿解锁！
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  ok('经历敌方首轮出手进入第 2 回合后冰晶宫殿解锁就绪并亮起提示',
    CE.getState().waveTurn === 2 && palBtn.disabled === false && palBtn.classList.contains('pulse-hint'));

  // 验证第 2 步按 Escape 逃课漏洞已被彻底封堵！
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'q', bubbles: true }));
  $('cb-palace-modal').querySelector('[data-clue="ice_crack_waterline"]').click();
  ok('点击第 1 步观察点进入第 2 步瞬间即锁定扣除 palaceLeft=0',
    $('cb-palace-card').textContent.includes('第 2 / 2 步') && CE.getState().player.palaceLeft === 0);
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('在第 2 步按 Escape 强关弹窗后审视次数维持 0 且未白嫖看破技',
    !$('cb-palace-modal') && CE.getState().player.palaceLeft === 0 && !CE.getState().player.skills.includes('insight_noelle_sever') && palBtn.disabled === true);

  // 重开一局验证完整两步推演成功解锁 + 沙盒获胜零存档污染
  CE.startStage('noelle_14', { fromArena: true });
  CE.endTurn(); // 进入第 2 回合
  win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'q', bubbles: true }));
  $('cb-palace-modal').querySelector('[data-clue="ice_crack_waterline"]').click();
  $('cb-palace-card').querySelector('[data-ded="freeze_seep"]').click();
  ok('正常完成两步推演后碎镜解锁「看破·冻彻冰缝断流」且次数归零',
    CE.getState().player.palaceLeft === 0 && CE.getState().player.skills.includes('insight_noelle_sever'));
  $('cp-confirm').click();

  const curB = CE.getState();
  curB.enemies[0].hp = 1;
  curB.enemies[0].shield = 0;
  curB.enemies[0].seepSevered = true;
  CE.useSkill('hand_ice_crystal', 0, curB);
  ok('演武沙盒获胜弹出评级面板', !!$('cb-result-modal') && curB.won === true);
  $('cr-done').click();

  const afterS = win.__getS();
  ok('演武场沙盒通关绝不污染 0 岁主线存档等级/经验/金币/背包/技能',
    afterS.lv === snapBefore.lv &&
    afterS.exp === snapBefore.exp &&
    afterS.gold === snapBefore.gold &&
    afterS.inv.length === snapBefore.invLen &&
    afterS.skills.length === snapBefore.skillsLen);

  // 验证双波次关卡 Wave 1 用掉冰宫后进入 Wave 2 自动重置本波 1 次审视机会！
  arenaOv.querySelector('[data-stage="hulan_beast_tide"]').click();
  const hulanB = CE.getState();
  ok('双波次关卡 W1 第 1 回合冰宫禁用于采集中且不闪烁', $('cb-btn-palace').disabled === true && !$('cb-btn-palace').classList.contains('pulse-hint'));
  CE.endTurn(hulanB); // W1 Turn 2
  CE.inspectClue('armor_joint', 'guard_joint', hulanB);
  ok('双波次关卡 W1 使用冰宫后显示「下波重置」且停止闪烁',
    hulanB.player.palaceLeft === 0 && $('cb-btn-palace').textContent.includes('下波重置') && !$('cb-btn-palace').classList.contains('pulse-hint'));
  // 清空 W1 敌人推进至 W2
  hulanB.enemies.forEach(e => { e.hp = 0; });
  hulanB.enemies[0].hp = 1;
  hulanB.enemies[0].shield = 0;
  CE.useSkill('hand_ice_crystal', 0, hulanB);
  ok('进入 Wave 2 后冰晶宫殿自动恢复 palaceLeft=1（W2 第1回合先凝结采集，第2回合可用）',
    hulanB.waveIdx === 1 && hulanB.player.palaceLeft === 1 && hulanB.waveTurn === 1);
  CE.endTurn(hulanB); // W2 Turn 2
  ok('Wave 2 第 2 回合冰晶宫殿正常就绪可用（彻底根治初见杀软锁死）',
    CE.isPalaceReady(hulanB) === true && !$('cb-btn-palace').disabled && $('cb-btn-palace').classList.contains('pulse-hint'));
  CE.exitBattle(false);

  $('am-close').click();
  const bgmAudio = $('bgm-audio');
  ok('从标题页退出演武场后恢复标题页且战斗 BGM 已停止无泄漏',
    !$('title-screen').classList.contains('hidden') && (!bgmAudio.getAttribute('src') || bgmAudio.paused));

  win.__resetS();
  const storyS = win.__getS();
  storyS.ageY = 6; storyS.phase = 'youth'; storyS.freeRoam = true;
  win.__setS(storyS);
  ok('未习得 virtual_duel 时调用 openDuelMenu 被原著规则拦截', win.openDuelMenu() === false);
  const wildB = CE.startBattle({ tpl: 'wolf' });
  ok('故事模式未习得「冰晶宫殿」时战斗中 palaceMax===0 且按钮禁用',
    wildB.player.palaceMax === 0 && $('cb-btn-palace').disabled === true);
  CE.exitBattle(false);
}

// ===== 3. 核心机制专项校验：100%魔战循环、flawToken单次销毁、真实闪避层与洗致盲、特殊胜负铁律 =====
console.log('\n[3] 100%魔战循环公式、flawToken不污染防反、真实闪避层/洗致盲与特殊胜负铁律校验');
{
  const bMc = CE.startStage('north_forest_hunt', { headless: true });
  bMc.player.mp = 100;
  const physMult = CE.computeManaCycleMultiplier(bMc.player, 50, CE.SKILLS.basic_attack);
  const mpBeforePhys = bMc.player.mp;
  CE.useSkill('basic_attack', 0, bMc);
  ok('纯物理技能不享受魔战增伤公式②且不触发魔战回蓝', physMult === 1.0 && bMc.player.mp === mpBeforePhys && bMc.metrics.manaRecycled === 0);

  bMc.ap = 2;
  bMc.player.mp = 80;
  const wolfHp0 = bMc.enemies[1].hp;
  CE.setOvercast(0, bMc);
  const iceCost = CE.computeSkillMpCost(bMc.player, CE.SKILLS.hand_ice_crystal);
  CE.useSkill('hand_ice_crystal', 1, bMc);
  const actualLoss = wolfHp0 - bMc.enemies[1].hp;
  ok('魔战循环公式①严格按 100% 等量有效魔法生命伤害回复 MP',
    actualLoss > 0 && bMc.metrics.manaRecycled === actualLoss && bMc.player.mp === Math.min(bMc.player.mmp, 80 - iceCost + actualLoss));

  // 验证 flawToken 单次销毁且绝不消除 GUARD_COUNTER 对盲丢 REMOTE 的减伤惩罚（在诺艾儿 GUARD_COUNTER 回合测）
  const bNoelle = CE.startStage('noelle_14', { headless: true });
  CE.useSkill('hand_ice_crystal', 0, bNoelle);
  CE.useSkill('hand_ice_crystal', 0, bNoelle);
  CE.endTurn(bNoelle); // Turn 2: DUAL_CAST
  CE.useSkill('remote_snap_spike', 0, bNoelle);
  CE.endTurn(bNoelle); // Turn 3: GUARD_COUNTER & waveTurn === 3
  const noelle = bNoelle.enemies[0];
  const dmgBeforePalace = CE.estimateSkillDamage(bNoelle, CE.SKILLS.remote_snap_spike, noelle).dmg;
  CE.inspectClue('ice_crack_waterline', 'freeze_seep', bNoelle);
  const dmgDuringGuardAfterPalace = CE.estimateSkillDamage(bNoelle, CE.SKILLS.remote_snap_spike, noelle).dmg;
  ok('开启冰晶宫殿绝不消除诺艾儿 GUARD_COUNTER 对隔空瞬凝的严厉减伤惩罚',
    noelle.intent.stance === 'GUARD_COUNTER' && dmgDuringGuardAfterPalace === dmgBeforePalace && dmgDuringGuardAfterPalace < 25,
    `stance=${noelle.intent.stance}, before=${dmgBeforePalace}, after=${dmgDuringGuardAfterPalace}`);
  CE.useSkill('hand_ice_crystal', 0, bNoelle);
  ok('flawToken 在命中一次后立即消耗清零不永久残留', noelle.flawToken === 0);

  const bAlice = CE.startStage('alice_9', { headless: true });
  bAlice.player.status.blind = 1;
  bAlice.enemies[0].evadeCharges = 0;
  const blindRes = CE.useSkill('hand_ice_crystal', 0, bAlice);
  ok('挂有视线受阻(blind)时释放普通单点魔法真实偏斜落空', blindRes.missedByBlind === true && !bAlice.player.status.blind);

  bAlice.ap = 2;
  bAlice.player.status.blind = 1;
  const hpAlice0 = bAlice.enemies[0].hp;
  CE.useSkill('hand_water_surge', 0, bAlice);
  ok('「覆潮水弹」出手前先冲净扬尘致盲并成功造成伤害', !bAlice.player.status.blind && bAlice.enemies[0].hp < hpAlice0);

  const bJackal = CE.startStage('north_forest_hunt', { headless: true });
  bJackal.enemies.forEach(e => { e.hp = 0; });
  bJackal.enemies[0].hp = 1;
  bJackal.enemies[0].shield = 0;
  CE.useSkill('hand_water_surge', 0, bJackal);
  const jackal = bJackal.enemies[0];
  const jHp0 = jackal.hp;
  ok('霜脊影豺开局具备真实【疾影闪避×1】层数', jackal.evadeCharges === 1);
  CE.useSkill('sword_water_edge', 0, bJackal);
  ok('霜脊影豺真实闪避首记直击并消耗 1 层闪避（绝非 0% 假面板）', jackal.hp === jHp0 && jackal.evadeCharges === 0);

  const bAino = CE.startStage('aino_sparring', { headless: true });
  bAino.enemies[0].hp = 1;
  CE.useSkill('hand_root_shield', 0, bAino);
  CE.endTurn(bAino);
  ok('艾诺三击制中即便敌耐力触底且触发霜刺，playerHits===0 绝不误判玩家获胜', !bAino.won && bAino.enemies[0].hp >= 1);

  const bRowan = CE.startStage('rowan_graveyard', { headless: true });
  CE.useSkill('hand_ice_wall', 0, bRowan);
  CE.endTurn(bRowan);
  ok('罗文战单纯立冰墙挨打封锁度保持 0%（绝不躺赢涨封锁）', bRowan.sealProgress === 0);
  bRowan.enemies[0].hp = 5;
  CE.useSkill('hand_ice_crystal', 0, bRowan);
  ok('罗文战未满 100% 封锁打空罗文 HP 直接触发化雾逃脱判败', bRowan.over && !bRowan.won && bRowan.endReason === 'rowan_escaped');
}

// ===== 4. 全排列穷举压力测试：单键复读、二键宏 & 跨路径三键盲打宏全面 0.00% 胜率校验 =====
console.log('\n[4] 全排列穷举压力测试：单键复读 / 二键盲打宏 / 跨路径三键盲打宏全面封杀校验');
{
  const stageIds = Object.keys(CE.STAGES);
  let singleKeyLeaks = [];

  for (const sid of stageIds) {
    const sc = CE.STAGES[sid];
    const skills = sc.preset.skills;
    const ocModes = sc.preset.manaCycle ? [0, 1, 2] : [0];
    const wandModes = sc.preset.eclipseWand ? [false, true] : [false];

    for (const skId of skills) {
      for (const oc of ocModes) {
        for (const wOn of wandModes) {
          const res = CE.simulateBattle(sid, b => {
            if (wOn && b.player.hasEclipseWand && !b.player.wandActive && b.player.wandCooldown === 0 && b._wandSkipTurn !== b.turn) {
              return { type: 'wand', on: true };
            }
            if (b.player.hasManaCycle && b.player.overcastMode !== oc) {
              return { type: 'overcast', mode: oc };
            }
            const sk = CE.SKILLS[skId];
            const cost = CE.computeSkillMpCost(b.player, sk);
            if (b.ap >= sk.ap && b.player.mp >= cost && !(b.player.cooldowns[skId] > 0)) {
              return { type: 'skill', skillId: skId };
            }
            return { type: 'endTurn' };
          });
          if (res.won) {
            singleKeyLeaks.push(`${sid}:${skId}(oc=${oc},wand=${wOn})->${res.grade}/${res.turns}T`);
          }
        }
      }
    }
  }
  ok('【全 7 关单键穷举】所有可用技能 × 倾注0/1/2 × 晦轮开关 单键无脑复读胜率 = 0.00%',
    singleKeyLeaks.length === 0, singleKeyLeaks.join(', '));

  let twoKeyLeaks = [];
  const defSkillPool = ['hand_ice_wall', 'hand_root_shield', 'hand_water_veil', 'sword_root_step', 'sword_wind_afterimage', 'hand_frost_floor'];
  for (const sid of stageIds) {
    const sc = CE.STAGES[sid];
    const availDefs = sc.preset.skills.filter(s => defSkillPool.includes(s));
    const availAtks = sc.preset.skills.filter(s => CE.SKILLS[s] && CE.SKILLS[s].power > 0);
    const thresholds = [25, 50];
    const ocModes = sc.preset.manaCycle ? [0, 1] : [0];
    const wandModes = sc.preset.eclipseWand ? [false, true] : [false];

    for (const dSk of availDefs) {
      for (const aSk of availAtks) {
        for (const th of thresholds) {
          for (const oc of ocModes) {
            for (const wOn of wandModes) {
              const res = CE.simulateBattle(sid, b => {
                if (wOn && b.player.hasEclipseWand && !b.player.wandActive && b.player.wandCooldown === 0 && b._wandSkipTurn !== b.turn) {
                  return { type: 'wand', on: true };
                }
                if (b.player.hasManaCycle && b.player.overcastMode !== oc) {
                  return { type: 'overcast', mode: oc };
                }
                const defObj = CE.SKILLS[dSk];
                const defCost = CE.computeSkillMpCost(b.player, defObj);
                const needDef = dSk === 'sword_root_step'
                  ? !b.player.status.lungeParry
                  : dSk === 'sword_wind_afterimage'
                    ? !b.player.status.afterimage
                    : dSk === 'hand_frost_floor'
                      ? b.frostFloorTurns === 0
                      : b.player.shield < th;
                if (needDef && !(b.player.cooldowns[dSk] > 0) && b.ap >= defObj.ap && b.player.mp >= defCost) {
                  return { type: 'skill', skillId: dSk };
                }
                const atkObj = CE.SKILLS[aSk];
                const atkCost = CE.computeSkillMpCost(b.player, atkObj);
                if (!(b.player.cooldowns[aSk] > 0) && b.ap >= atkObj.ap && b.player.mp >= atkCost) {
                  return { type: 'skill', skillId: aSk };
                }
                return { type: 'endTurn' };
              });
              if (res.won) {
                twoKeyLeaks.push(`${sid}:[${dSk}<${th}+${aSk}(oc=${oc},w=${wOn})]->${res.grade}/${res.turns}T`);
              }
            }
          }
        }
      }
    }
  }
  ok('【全 7 关二键宏全排列穷举】所有「补盾/步法/薄冰 + 单攻键 × 倾注 × 晦轮（不看意图不开冰宫）」胜率 = 0.00%',
    twoKeyLeaks.length === 0, twoKeyLeaks.join(', '));

  // 跨路径三键无脑轮转宏穷举（补盾/步法 + 两招进攻技能 × 倾注0/1 × 晦轮开关 不看敌方意图机械轮流按）
  let threeKeyLeaks = [];
  for (const sid of stageIds) {
    const sc = CE.STAGES[sid];
    const availDefs = sc.preset.skills.filter(s => defSkillPool.includes(s));
    const availAtks = sc.preset.skills.filter(s => CE.SKILLS[s] && CE.SKILLS[s].power > 0 && s !== 'basic_attack');
    const ocModes = sc.preset.manaCycle ? [0, 1] : [0];
    const wandModes = sc.preset.eclipseWand ? [false, true] : [false];
    for (const dSk of availDefs) {
      for (let i = 0; i < availAtks.length; i++) {
        for (let j = i + 1; j < availAtks.length; j++) {
          for (const oc of ocModes) {
            for (const wOn of wandModes) {
              const a1 = availAtks[i];
              const a2 = availAtks[j];
              let toggle = 0;
              const res = CE.simulateBattle(sid, b => {
                if (wOn && b.player.hasEclipseWand && !b.player.wandActive && b.player.wandCooldown === 0 && b._wandSkipTurn !== b.turn) {
                  return { type: 'wand', on: true };
                }
                if (b.player.hasManaCycle && b.player.overcastMode !== oc) {
                  return { type: 'overcast', mode: oc };
                }
                const defObj = CE.SKILLS[dSk];
                const defCost = CE.computeSkillMpCost(b.player, defObj);
                const needDef = dSk === 'sword_root_step'
                  ? !b.player.status.lungeParry
                  : dSk === 'sword_wind_afterimage'
                    ? !b.player.status.afterimage
                    : dSk === 'hand_frost_floor'
                      ? b.frostFloorTurns === 0
                      : b.player.shield < 30;
                if (needDef && !(b.player.cooldowns[dSk] > 0) && b.ap >= defObj.ap && b.player.mp >= defCost) {
                  return { type: 'skill', skillId: dSk };
                }
                const pickAtk = (toggle++ % 2 === 0) ? a1 : a2;
                const altAtk = pickAtk === a1 ? a2 : a1;
                for (const cand of [pickAtk, altAtk]) {
                  const obj = CE.SKILLS[cand];
                  const cost = CE.computeSkillMpCost(b.player, obj);
                  if (!(b.player.cooldowns[cand] > 0) && b.ap >= obj.ap && b.player.mp >= cost) {
                    return { type: 'skill', skillId: cand };
                  }
                }
                return { type: 'endTurn' };
              });
              if (res.won) {
                threeKeyLeaks.push(`${sid}:[${dSk}+${a1}+${a2}(oc=${oc},w=${wOn})]->${res.grade}/${res.turns}T`);
              }
            }
          }
        }
      }
    }
  }
  ok('【全 7 关三键盲打宏穷举】所有「护盾/步法 + 双攻键轮转 × 倾注 × 晦轮（不看架势不开冰宫）」胜率 = 0.00%',
    threeKeyLeaks.length === 0, threeKeyLeaks.join(', '));
}

// ===== 5. 原著智斗 AI（开启冰晶宫殿 S 级路径）：验证 4~8 回合起承转合节奏 + 100% 机制登场 + 双波次全开冰宫 =====
console.log('\n[5] 原著智斗 AI（开启冰晶宫殿）：验证 4~8 回合起承转合节奏、核心机制 100% 登场与全 S 级通关');
{
  // 1) 贝阿特丽丝（11岁）：至少出手 2 次展示火球与斗气，第 4 回合抬右肩时地下冰柱破招终结（4~8 回合 S 级）
  const res1 = CE.simulateBattle('beatrice_11', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if (CE.isPalaceReady(b)) return { type: 'palace', clueId: 'shoulder_lift', deductionId: 'under_pillar' };
    if (st === 'HEAVY_WINDUP' && b.player.skills.includes('insight_beatrice_pillar') && !b.player.usedMaxSkills.insight_beatrice_pillar && b.ap >= 1 && b.player.mp >= 18) {
      return { type: 'skill', skillId: 'insight_beatrice_pillar' };
    }
    if ((st === 'HEAVY_WINDUP' || b.player.status.burn > 0) && b.player.shield < 20 && !b.player.cooldowns.hand_water_veil && b.ap >= 1 && b.player.mp >= 26 && e.hp > 90) {
      return { type: 'skill', skillId: 'hand_water_veil' };
    }
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 38) {
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (b.ap >= 1 && b.player.mp >= 30) return { type: 'skill', skillId: 'hand_water_surge' };
    if (b.ap >= 1) return { type: 'skill', skillId: 'basic_attack' };
    return { type: 'endTurn' };
  });
  ok(`关卡 1「贝阿特丽丝」开冰宫 S 级通关 (${res1.turns}T, 敌出手=${res1.metrics.enemyActions}>=2)`,
    res1.won && res1.grade === 'S' && res1.turns >= 4 && res1.turns <= 8 && res1.metrics.enemyActions >= 2,
    JSON.stringify({ won: res1.won, grade: res1.grade, turns: res1.turns, metrics: res1.metrics }));

  // 2) 罗文（8岁乱葬岗）：窄道铺冰(+38%) + 冰宫双镜夹杖(+44%) + 二次窄道铺冰 达成 100% 活捉（4~8 回合 S 级）
  const res2 = CE.simulateBattle('rowan_graveyard', b => {
    const st = b.enemies[0].intent ? b.enemies[0].intent.stance : '';
    if (CE.isPalaceReady(b)) return { type: 'palace', clueId: 'mirror_thumb', deductionId: 'clamp_staff' };
    if (b.frostFloorTurns === 0 && (st === 'UNDER_SEEP' || st === 'DUAL_CAST') && !b.player.cooldowns.hand_frost_floor && b.ap >= 1 && b.player.mp >= 24) {
      return { type: 'skill', skillId: 'hand_frost_floor' };
    }
    if (st === 'UNDER_SEEP' && b.player.shield < 20 && !b.player.cooldowns.hand_ice_wall && b.ap >= 1 && b.player.mp >= 28) {
      return { type: 'skill', skillId: 'hand_ice_wall' };
    }
    if (st === 'DUAL_CAST' && b.frostFloorTurns > 0 && b.ap >= 1 && b.player.mp >= 38) {
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (st === 'CLOSE_LUNGE' && b.player.skills.includes('insight_rowan_prism') && !b.player.usedMaxSkills.insight_rowan_prism && b.ap >= 1 && b.player.mp >= 20) {
      return { type: 'skill', skillId: 'insight_rowan_prism' };
    }
    if (st === 'CLOSE_LUNGE' && b.player.shield < 25 && !b.player.cooldowns.hand_water_veil && b.ap >= 1 && b.player.mp >= 26) {
      return { type: 'skill', skillId: 'hand_water_veil' };
    }
    return { type: 'endTurn' };
  });
  ok(`关卡 2「8岁间章·罗文乱葬岗」开冰宫 100% 封锁活捉 S 级通关 (${res2.turns}T)`,
    res2.won && res2.grade === 'S' && res2.sealProgress >= 100 && res2.turns >= 4 && res2.turns <= 8,
    JSON.stringify({ won: res2.won, grade: res2.grade, turns: res2.turns, seal: res2.sealProgress }));

  // 3) 爱丽丝（9岁）：真正触发扬尘遮眼 -> 水弹洗尘 -> 十字冰栏封风轨 -> 冰棘榨蓝 -> 第4回合蓄力狂岚魔力耗尽自断认输！
  const res3 = CE.simulateBattle('alice_9', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if (b.player.status.blind > 0 && b.ap >= 1 && b.player.mp >= 30) {
      return { type: 'skill', skillId: 'hand_water_surge' };
    }
    if (CE.isPalaceReady(b)) return { type: 'palace', clueId: 'skirt_wind', deductionId: 'cross_cage' };
    if (b.player.skills.includes('insight_alice_cage') && !b.player.usedMaxSkills.insight_alice_cage && b.ap >= 1 && b.player.mp >= 20) {
      return { type: 'skill', skillId: 'insight_alice_cage' };
    }
    if (!b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 62 && e.mp >= 12) {
      return { type: 'skill', skillId: 'hand_thorn_field' };
    }
    if (st === 'GUARD_COUNTER' && b.player.shield < 20 && !b.player.cooldowns.hand_water_veil && b.ap >= 1 && b.player.mp >= 26) {
      return { type: 'skill', skillId: 'hand_water_veil' };
    }
    if (b.ap >= 1 && b.player.mp >= 30 && e.mp >= 22) {
      return { type: 'skill', skillId: 'hand_water_surge' };
    }
    return { type: 'endTurn' };
  });
  const aliceHasDustAndWash = res3.log.some(l => l.includes('扬尘遮蔽视线')) && res3.log.some(l => l.includes('水流冲净'));
  ok(`关卡 3「爱丽丝」完整触发扬尘+洗尘+第${res3.turns}回合狂岚缺蓝自断认输 S 级通关`,
    res3.won && res3.grade === 'S' && res3.turns >= 4 && res3.turns <= 8 && res3.metrics.manaFizzleWin === true && aliceHasDustAndWash,
    JSON.stringify({ won: res3.won, grade: res3.grade, turns: res3.turns, fizzle: res3.metrics.manaFizzleWin, dustWash: aliceHasDustAndWash }));

  // 4) 艾诺（冰上三击制）：严抓空档破招 + 看破弹手背抢满 3 次有效命中（4~8 回合 S 级）
  const res4 = CE.simulateBattle('aino_sparring', b => {
    const st = b.enemies[0].intent ? b.enemies[0].intent.stance : '';
    if (CE.isPalaceReady(b)) return { type: 'palace', clueId: 'left_shoulder_gap', deductionId: 'snap_bead' };
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 26) {
      return { type: 'skill', skillId: 'remote_blind_shot' };
    }
    if (b.playerHits >= 2 && b.player.skills.includes('insight_aino_bead') && !b.player.usedMaxSkills.insight_aino_bead && b.ap >= 1 && b.player.mp >= 18) {
      return { type: 'skill', skillId: 'insight_aino_bead' };
    }
    if ((st === 'HEAVY_WINDUP' || st === 'CLOSE_LUNGE') && b.player.shield < 35 && b.ap >= 1) {
      if (!b.player.cooldowns.sword_wind_afterimage && !b.player.status.afterimage && b.player.mp >= 18) return { type: 'skill', skillId: 'sword_wind_afterimage' };
      if (!b.player.cooldowns.hand_root_shield && b.player.mp >= 34) return { type: 'skill', skillId: 'hand_root_shield' };
    }
    if (b.aiMemory.currentTurnDmgDealt === 0 && b.ap >= 2) {
      return { type: 'skill', skillId: 'basic_attack' };
    }
    return { type: 'endTurn' };
  });
  ok(`关卡 4「艾诺·三击制」严抓空档破招 + 看破弹手背 S 级通关 (${res4.turns}T)`,
    res4.won && res4.grade === 'S' && res4.playerHits >= 3 && res4.turns >= 4 && res4.turns <= 8,
    JSON.stringify({ won: res4.won, grade: res4.grade, turns: res4.turns, hits: res4.playerHits }));

  // 5) 诺艾儿（14岁）：必须真正进入 UNDER_SEEP 冰缝暗流阶段 + 看破断流 + 2.0x 孤注一掷终结（4~8 回合 S 级）
  const res5 = CE.simulateBattle('noelle_14', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if (CE.isPalaceReady(b)) return { type: 'palace', clueId: 'ice_crack_waterline', deductionId: 'freeze_seep' };
    if (!e.seepSevered && st === 'UNDER_SEEP' && b.player.skills.includes('insight_noelle_sever') && !b.player.usedMaxSkills.insight_noelle_sever && b.ap >= 1 && b.player.mp >= 24) {
      if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
      return { type: 'skill', skillId: 'insight_noelle_sever' };
    }
    if (e.seepSevered && e.hp <= 150 && b.ap >= 1 && b.player.mp >= 220) {
      if (b.player.overcastMode !== 2) return { type: 'overcast', mode: 2 };
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 40) {
      if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
      return { type: 'skill', skillId: 'remote_snap_spike' };
    }
    if (b.player.hp < 80 && b.ap >= 1) {
      if (!b.player.cooldowns.hand_root_shield && b.player.shield < 25 && b.player.mp >= 34) {
        return { type: 'skill', skillId: 'hand_root_shield' };
      }
    }
    if (b.ap >= 1 && b.player.mp >= 38) {
      // 交替混用冰晶与群刺防止触发诺艾儿同招预演加厚水幕
      if (b.aiMemory.sameAtkSkillStreak >= 2 && !b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 62) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'hand_thorn_field' };
      }
      const wantOc = (b.player.mp >= 190 && e.hp > 260) ? 1 : 0;
      if (b.player.overcastMode !== wantOc) return { type: 'overcast', mode: wantOc };
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    return { type: 'endTurn' };
  });
  ok(`关卡 5「诺艾儿」进入冰缝暗流阶段 + 看破断流 + ${res5.metrics.maxOvercastMult.toFixed(2)}x孤注一掷 S 级通关 (${res5.turns}T)`,
    res5.won && res5.grade === 'S' && res5.turns >= 4 && res5.turns <= 8 && res5.metrics.enteredUnderSeep === true && res5.metrics.maxOvercastMult >= 1.92,
    JSON.stringify({ won: res5.won, grade: res5.grade, turns: res5.turns, seep: res5.metrics.enteredUnderSeep, maxOc: res5.metrics.maxOvercastMult }));

  // 6) 北林双波次：显式在 W1 与 W2 均开启冰晶宫殿（insights===2），且 W2 影豺扑杀触发 ripostes >= 1！
  const res6 = CE.simulateBattle('north_forest_hunt', b => {
    if (CE.isPalaceReady(b)) {
      return b.waveIdx === 0
        ? { type: 'palace', clueId: 'wet_leaves', deductionId: 'thorn_sweep' }
        : { type: 'palace', clueId: 'midair_jaw', deductionId: 'water_throat' };
    }
    if (b.waveIdx === 0) {
      if (b.player.skills.includes('insight_generic_flaw') && !b.player.usedMaxSkills.insight_generic_flaw && b.ap >= 1 && b.player.mp >= 20) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'insight_generic_flaw' };
      }
      if (!b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 55) {
        const wantOc = b.player.mp >= 160 ? 1 : 0;
        if (b.player.overcastMode !== wantOc) return { type: 'overcast', mode: wantOc };
        return { type: 'skill', skillId: 'hand_thorn_field' };
      }
      if (b.ap >= 1 && b.player.mp >= 26) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'hand_water_surge' };
      }
      return { type: 'endTurn' };
    }
    // Wave 2: 首回合影豺锁喉扑杀 -> 生根步卸力闪反(ripostes>=1)，第 2 回合冰宫看破覆水斩 + 送刀终结！
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if (st === 'CLOSE_LUNGE' && !b.player.status.lungeParry && !b.player.cooldowns.sword_root_step && b.ap >= 1 && b.player.mp >= 10 && b.metrics.ripostes === 0) {
      return { type: 'skill', skillId: 'sword_root_step' };
    }
    if (b.player.skills.includes('insight_jackal_throat') && !b.player.usedMaxSkills.insight_jackal_throat && b.ap >= 1 && b.player.mp >= 16) {
      return { type: 'skill', skillId: 'insight_jackal_throat' };
    }
    if (e.evadeCharges === 0 && b.ap >= 1 && b.player.mp >= 20) {
      return { type: 'skill', skillId: 'sword_water_edge' };
    }
    if (!b.player.cooldowns.hand_water_veil && b.player.shield < 20 && b.ap >= 1 && b.player.mp >= 22) {
      return { type: 'skill', skillId: 'hand_water_veil' };
    }
    if (st === 'CLOSE_LUNGE' && !b.player.status.lungeParry && !b.player.cooldowns.sword_root_step && b.ap >= 1 && b.player.mp >= 10) {
      return { type: 'skill', skillId: 'sword_root_step' };
    }
    return { type: 'endTurn' };
  });
  ok(`关卡 6「北林双波次」W1与W2双开冰宫(insights=${res6.metrics.insights}) + 生根步闪反(ripostes=${res6.metrics.ripostes}>=1) S 级通关 (${res6.turns}T)`,
    res6.won && res6.grade === 'S' && res6.metrics.insights === 2 && res6.metrics.ripostes >= 1 && !res6.exposureWarned && res6.turns >= 4 && res6.turns <= 8,
    JSON.stringify({ won: res6.won, grade: res6.grade, turns: res6.turns, metrics: res6.metrics, exp: res6.exposure }));

  // 7) 赫兰冰封峡谷5星终极战：显式在 W1 与 W2 均开启冰晶宫殿（insights===2，彻底根治 W1 开冰宫软锁死！）+ 2.0x 倾注斩领主！
  const res7 = CE.simulateBattle('hulan_beast_tide', b => {
    if (CE.isPalaceReady(b)) {
      return b.waveIdx === 0
        ? { type: 'palace', clueId: 'armor_joint', deductionId: 'guard_joint' }
        : { type: 'palace', clueId: 'fissure_core', deductionId: 'aino_sync' };
    }
    if (b.waveIdx === 0) {
      const brute = b.enemies[0];
      const aliveCount = b.enemies.filter(x => x.hp > 0).length;
      if (b.player.skills.includes('insight_generic_flaw') && !b.player.usedMaxSkills.insight_generic_flaw && brute && brute.hp > 0 && b.ap >= 1 && b.player.mp >= 20) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'insight_generic_flaw', targetIdx: 0 };
      }
      if (!b.player.status.crateGuard && !b.player.cooldowns.hand_root_shield && brute && brute.hp > 0 && !(brute.status && brute.status.stagger) && b.ap >= 1 && b.player.mp >= 30) {
        return { type: 'skill', skillId: 'hand_root_shield' };
      }
      if (brute && brute.hp > 0 && brute.intent && brute.intent.stance === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 34) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'remote_snap_spike', targetIdx: 0 };
      }
      if (aliveCount >= 2 && !b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 55) {
        if (b.player.overcastMode !== 1 && b.player.mp >= 150) return { type: 'overcast', mode: 1 };
        return { type: 'skill', skillId: 'hand_thorn_field' };
      }
      if (brute && brute.hp > 0 && b.ap >= 1 && b.player.mp >= 85) {
        if (!b.player.wandActive && b.player.wandCooldown === 0) return { type: 'wand', on: true };
        if (b.player.overcastMode !== 1 && b.player.mp >= 170) return { type: 'overcast', mode: 1 };
        return { type: 'skill', skillId: 'hand_ice_crystal', targetIdx: 0 };
      }
      if (b.ap >= 1 && b.player.mp >= 33) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'hand_ice_crystal' };
      }
      return { type: 'endTurn' };
    }

    // Wave 2: W2 第1回合先断咏重击领主，第2回合开启 W2 冰晶宫殿引动伊诺共鸣碎核 + 晦轮折光 2.0x 终结！
    const boss = b.enemies[0];
    const bossSt = boss && boss.intent ? boss.intent.stance : '';
    if (b.player.skills.includes('insight_hulan_resonance') && !b.player.usedMaxSkills.insight_hulan_resonance && b.ap >= 1 && b.player.mp >= 36) {
      if (b.player.overcastMode !== 1 && b.player.mp >= 150) return { type: 'overcast', mode: 1 };
      return { type: 'skill', skillId: 'insight_hulan_resonance', targetIdx: 0 };
    }
    if (boss && boss.hp > 0 && bossSt === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 34) {
      if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
      return { type: 'skill', skillId: 'remote_snap_spike', targetIdx: 0 };
    }
    if (!b.player.cooldowns.hand_thorn_field && b.enemies.filter(x => x.hp > 0).length >= 2 && b.ap >= 2 && b.player.mp >= 55) {
      if (b.player.overcastMode !== 1 && b.player.mp >= 140) return { type: 'overcast', mode: 1 };
      return { type: 'skill', skillId: 'hand_thorn_field' };
    }
    if (boss && boss.hp > 0 && boss.coreShattered && boss.hp <= 250 && b.ap >= 1 && b.player.mp >= 160) {
      if (!b.player.wandActive && b.player.wandCooldown === 0) return { type: 'wand', on: true };
      if (b.player.overcastMode !== 2) return { type: 'overcast', mode: 2 };
      return { type: 'skill', skillId: 'hand_ice_crystal', targetIdx: 0 };
    }
    if (!b.player.status.crateGuard && !b.player.cooldowns.hand_root_shield && b.ap >= 1 && b.player.mp >= 30) {
      return { type: 'skill', skillId: 'hand_root_shield' };
    }
    if (b.ap >= 1 && b.player.mp >= 40) {
      if (!b.player.wandActive && b.player.wandCooldown === 0 && b.player.mp >= 110) return { type: 'wand', on: true };
      const wantOc = b.player.mp >= 180 ? 1 : 0;
      if (b.player.overcastMode !== wantOc) return { type: 'overcast', mode: wantOc };
      return { type: 'skill', skillId: 'hand_ice_crystal', targetIdx: boss && boss.hp > 0 ? 0 : 1 };
    }
    return { type: 'endTurn' };
  });
  ok(`关卡 7「赫兰冰封峡谷5星终极战」W1与W2双开冰宫(insights=${res7.metrics.insights}) + 护药箱(${res7.crateHp}) S 级通关 (${res7.turns}T)`,
    res7.won && res7.grade === 'S' && res7.metrics.insights === 2 && res7.crateHp >= 65 && res7.turns >= 5 && res7.turns <= 9,
    JSON.stringify({ won: res7.won, grade: res7.grade, turns: res7.turns, crateHp: res7.crateHp, metrics: res7.metrics }));
}

// ===== 6. 无冰晶宫殿纯基本功智斗验证（noPalace: true）：全 7 关消除死档，B/A 级苦战险胜校验 =====
console.log('\n[6] 无冰晶宫殿纯基本功智斗路径（noPalace: true）：验证主线未选冰宫/推演失误时全 7 关 B/A 级可解无死档');
{
  // 1) 贝蒂（无冰宫）：读架势用覆潮水弹逐层浇灭 3 层斗气 + 双火蛇用凝华冰晶冻核 + 抬肩重劈开水幕化灼烧
  const np1 = CE.simulateBattle('beatrice_11', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if ((st === 'HEAVY_WINDUP' || b.player.status.burn > 0) && b.player.shield < 25 && b.ap >= 1 && e.hp > 60) {
      if (!b.player.cooldowns.hand_water_veil && b.player.mp >= 26) return { type: 'skill', skillId: 'hand_water_veil' };
      if (!b.player.cooldowns.hand_ice_wall && b.player.mp >= 28) return { type: 'skill', skillId: 'hand_ice_wall' };
    }
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 38) {
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (b.aiMemory.sameAtkSkillStreak >= 2 && st !== 'GUARD_COUNTER' && b.ap >= 1 && b.player.mp >= 38) {
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (b.ap >= 1 && b.player.mp >= 30) return { type: 'skill', skillId: 'hand_water_surge' };
    if (b.ap >= 1) return { type: 'skill', skillId: 'basic_attack' };
    return { type: 'endTurn' };
  }, { noPalace: true });
  ok(`无冰宫基本功 1「贝阿特丽丝」水冰交替灭焰 ${np1.grade} 级通关 (${np1.turns}T)`,
    np1.won && ['A', 'B'].includes(np1.grade) && np1.metrics.insights === 0,
    JSON.stringify({ won: np1.won, grade: np1.grade, turns: np1.turns, hp: np1.hpRemaining }));

  // 2) 罗文（无冰宫）：3 次窄道铺冰配合 (+38% × 3 = 100%) 精打细算留魔力苦战撑过旋杖活捉成功！
  const np2 = CE.simulateBattle('rowan_graveyard', b => {
    const st = b.enemies[0].intent ? b.enemies[0].intent.stance : '';
    if (b.frostFloorTurns === 0 && (st === 'UNDER_SEEP' || st === 'DUAL_CAST') && !b.player.cooldowns.hand_frost_floor && b.ap >= 1 && b.player.mp >= 18) {
      return { type: 'skill', skillId: 'hand_frost_floor' };
    }
    if (st === 'DUAL_CAST' && b.frostFloorTurns > 0 && b.ap >= 1 && b.player.mp >= 38) {
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (st === 'UNDER_SEEP' && b.player.shield < 20 && !b.player.cooldowns.hand_ice_wall && b.ap >= 1 && b.player.mp >= 84) {
      return { type: 'skill', skillId: 'hand_ice_wall' };
    }
    if (st === 'CLOSE_LUNGE' && b.ap >= 1 && b.player.mp >= 84) {
      if (!b.player.cooldowns.hand_ice_wall && b.player.shield < 35) return { type: 'skill', skillId: 'hand_ice_wall' };
    }
    return { type: 'endTurn' };
  }, { noPalace: true });
  ok(`无冰宫基本功 2「罗文乱葬岗」三次窄道铺冰锁腿 100% 活捉 ${np2.grade} 级通关 (${np2.turns}T)`,
    np2.won && np2.sealProgress >= 100 && ['A', 'B'].includes(np2.grade) && np2.metrics.insights === 0,
    JSON.stringify({ won: np2.won, grade: np2.grade, turns: np2.turns, seal: np2.sealProgress, hp: np2.hpRemaining }));

  // 3) 爱丽丝（无冰宫）：交替水弹洗尘与地棘压迫耗蓝 + 第4回合双盾硬抗首轮狂岚留一线生机 -> 第7回合狂岚自断！
  const np3 = CE.simulateBattle('alice_9', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    // 第 4/7 回合狂岚且爱丽丝魔力够释放时，双盾齐开保命留一线生机！
    if (st === 'DUAL_CAST' && e.mp >= 22 && b.ap >= 1) {
      if (!b.player.cooldowns.hand_ice_wall && b.player.mp >= 28) return { type: 'skill', skillId: 'hand_ice_wall' };
      if (!b.player.cooldowns.hand_water_veil && b.player.mp >= 26) return { type: 'skill', skillId: 'hand_water_veil' };
      return { type: 'endTurn' };
    }
    if (b.player.hp < 70 && b.player.shield < 20 && !b.player.cooldowns.hand_water_veil && b.ap >= 1 && b.player.mp >= 26) {
      return { type: 'skill', skillId: 'hand_water_veil' };
    }
    if ((b.player.status.blind > 0 || b.aiMemory.lastAtkSkillId === 'hand_thorn_field') && b.ap >= 1 && b.player.mp >= 30 && e.mp >= 12) {
      return { type: 'skill', skillId: 'hand_water_surge' };
    }
    if (!b.player.status.blind && b.aiMemory.lastAtkSkillId !== 'hand_thorn_field' && !b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 116 && e.mp >= 12) {
      return { type: 'skill', skillId: 'hand_thorn_field' };
    }
    return { type: 'endTurn' };
  }, { noPalace: true });
  ok(`无冰宫基本功 3「爱丽丝」双盾抗过首轮狂岚并耗空其魔力 ${np3.grade} 级险胜 (${np3.turns}T)`,
    np3.won && ['A', 'B'].includes(np3.grade) && np3.metrics.insights === 0,
    JSON.stringify({ won: np3.won, grade: np3.grade, turns: np3.turns, hp: np3.hpRemaining, mp: np3.mpRemaining }));

  // 4) 艾诺（无冰宫）：残像与生根盾不重叠轮转省蓝，抓满第 2/5/8 回合三次 DUAL_CAST 破招获胜！
  const np4 = CE.simulateBattle('aino_sparring', b => {
    const st = b.enemies[0].intent ? b.enemies[0].intent.stance : '';
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 26) {
      return { type: 'skill', skillId: 'remote_blind_shot' };
    }
    if ((st === 'HEAVY_WINDUP' || st === 'CLOSE_LUNGE') && b.ap >= 1) {
      if (!b.player.cooldowns.sword_wind_afterimage && !b.player.status.afterimage && b.player.mp >= 18) return { type: 'skill', skillId: 'sword_wind_afterimage' };
      if (!b.player.status.afterimage && !b.player.cooldowns.hand_root_shield && b.player.shield < 35 && b.player.mp >= 34) return { type: 'skill', skillId: 'hand_root_shield' };
    }
    if (b.aiMemory.currentTurnDmgDealt === 0 && b.ap >= 1) {
      return { type: 'skill', skillId: 'basic_attack' };
    }
    return { type: 'endTurn' };
  }, { noPalace: true });
  ok(`无冰宫基本功 4「艾诺·三击制」三抓空档破招 ${np4.grade} 级获胜 (${np4.turns}T)`,
    np4.won && np4.playerHits >= 3 && ['A', 'B'].includes(np4.grade) && np4.metrics.insights === 0,
    JSON.stringify({ won: np4.won, grade: np4.grade, turns: np4.turns, hits: np4.playerHits }));

  // 5) 诺艾儿（无冰宫）：留存风行残像替身踩爆脚底冰缝暗流陷阱，再以 2.0x 倾注强破残局！
  const np5 = CE.simulateBattle('noelle_14', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if (st === 'UNDER_SEEP' && e.intent && e.intent.ambushTrap) {
      if (!b.player.status.afterimage && !b.player.cooldowns.sword_wind_afterimage && b.ap >= 1 && b.player.mp >= 18) {
        return { type: 'skill', skillId: 'sword_wind_afterimage' };
      }
      if (!b.player.status.afterimage) {
        // 若残像冷却未好则立生根盾暂缓前压，绝不盲踩陷阱
        if (!b.player.cooldowns.hand_root_shield && b.ap >= 1 && b.player.mp >= 34) return { type: 'skill', skillId: 'hand_root_shield' };
        return { type: 'endTurn' };
      }
    }
    if (st === 'UNDER_SEEP' && (!e.intent.ambushTrap || b.player.status.afterimage > 0) && b.ap >= 1 && b.player.mp >= 180) {
      if (b.player.overcastMode !== 2) return { type: 'overcast', mode: 2 };
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 40) {
      if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
      return { type: 'skill', skillId: 'remote_snap_spike' };
    }
    if (b.player.hp < 95 && !b.player.cooldowns.hand_root_shield && b.player.shield < 25 && b.ap >= 1 && b.player.mp >= 34) {
      return { type: 'skill', skillId: 'hand_root_shield' };
    }
    if (b.ap >= 1 && b.player.mp >= 38) {
      if (b.aiMemory.sameAtkSkillStreak >= 2 && !b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 62) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'hand_thorn_field' };
      }
      const wantOc = b.player.mp >= 180 ? 1 : 0;
      if (b.player.overcastMode !== wantOc) return { type: 'overcast', mode: wantOc };
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    return { type: 'endTurn' };
  }, { noPalace: true });
  ok(`无冰宫基本功 5「诺艾儿」风行残像破暗流陷阱 ${np5.grade} 级获胜 (${np5.turns}T)`,
    np5.won && np5.metrics.enteredUnderSeep === true && ['A', 'B'].includes(np5.grade) && np5.metrics.insights === 0,
    JSON.stringify({ won: np5.won, grade: np5.grade, turns: np5.turns, hp: np5.hpRemaining }));

  // 6) 北林（无冰宫）：W1 群刺回蓝 + W2 生根步卸力破闪避 + 覆水剑锋无痕猎杀！
  const np6 = CE.simulateBattle('north_forest_hunt', b => {
    if (b.waveIdx === 0) {
      if (!b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 55) {
        const wantOc = b.player.mp >= 160 ? 1 : 0;
        if (b.player.overcastMode !== wantOc) return { type: 'overcast', mode: wantOc };
        return { type: 'skill', skillId: 'hand_thorn_field' };
      }
      if (b.ap >= 1 && b.player.mp >= 26) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'hand_water_surge' };
      }
      return { type: 'endTurn' };
    }
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if (st === 'CLOSE_LUNGE' && !b.player.status.lungeParry && !b.player.cooldowns.sword_root_step && b.ap >= 1 && b.player.mp >= 10) {
      return { type: 'skill', skillId: 'sword_root_step' };
    }
    if (e.evadeCharges === 0 && b.ap >= 1 && b.player.mp >= 20) {
      return { type: 'skill', skillId: 'sword_water_edge' };
    }
    if (!b.player.cooldowns.hand_water_veil && b.player.shield < 20 && b.ap >= 1 && b.player.mp >= 22) {
      return { type: 'skill', skillId: 'hand_water_veil' };
    }
    if (b.ap >= 1 && b.player.mp >= 26) return { type: 'skill', skillId: 'hand_water_surge' };
    return { type: 'endTurn' };
  }, { noPalace: true });
  ok(`无冰宫基本功 6「北林双波次」生根步闪反+覆水送刀 ${np6.grade} 级获胜 (${np6.turns}T, ripostes=${np6.metrics.ripostes})`,
    np6.won && np6.metrics.ripostes >= 1 && !np6.exposureWarned && ['A', 'B'].includes(np6.grade) && np6.metrics.insights === 0,
    JSON.stringify({ won: np6.won, grade: np6.grade, turns: np6.turns, ripostes: np6.metrics.ripostes }));

  // 7) 赫兰5星终极战（无冰宫）：W2 连续两次抓准 DUAL_CAST 截断破招引落第 2 发艾诺极寒冰枪震裂领主晶核！
  const np7 = CE.simulateBattle('hulan_beast_tide', b => {
    if (b.waveIdx === 0) {
      const brute = b.enemies[0];
      const aliveCount = b.enemies.filter(x => x.hp > 0).length;
      if (brute && brute.hp > 0 && brute.intent && brute.intent.stance === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 34) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'remote_snap_spike', targetIdx: 0 };
      }
      if (!b.player.status.crateGuard && !b.player.cooldowns.hand_root_shield && brute && brute.hp > 0 && !(brute.status && brute.status.stagger) && b.ap >= 1 && b.player.mp >= 30) {
        return { type: 'skill', skillId: 'hand_root_shield' };
      }
      if (aliveCount >= 2 && !b.player.cooldowns.hand_thorn_field && b.ap >= 2 && b.player.mp >= 55) {
        if (b.player.overcastMode !== 1 && b.player.mp >= 150) return { type: 'overcast', mode: 1 };
        return { type: 'skill', skillId: 'hand_thorn_field' };
      }
      if (brute && brute.hp > 0 && b.ap >= 1 && b.player.mp >= 85) {
        if (!b.player.wandActive && b.player.wandCooldown === 0) return { type: 'wand', on: true };
        if (b.player.overcastMode !== 1 && b.player.mp >= 170) return { type: 'overcast', mode: 1 };
        return { type: 'skill', skillId: 'hand_ice_crystal', targetIdx: 0 };
      }
      if (b.ap >= 1 && b.player.mp >= 33) {
        if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
        return { type: 'skill', skillId: 'hand_ice_crystal' };
      }
      return { type: 'endTurn' };
    }

    const boss = b.enemies[0];
    const bossSt = boss && boss.intent ? boss.intent.stance : '';
    if (boss && boss.hp > 0 && bossSt === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 34) {
      if (b.player.overcastMode !== 0) return { type: 'overcast', mode: 0 };
      return { type: 'skill', skillId: 'remote_snap_spike', targetIdx: 0 };
    }
    if (!b.player.status.crateGuard && !b.player.cooldowns.hand_root_shield && boss && !(boss.status && boss.status.stagger) && b.ap >= 1 && b.player.mp >= 30) {
      return { type: 'skill', skillId: 'hand_root_shield' };
    }
    if (!b.player.cooldowns.hand_thorn_field && b.enemies.filter(x => x.hp > 0).length >= 2 && b.ap >= 2 && b.player.mp >= 55) {
      if (b.player.overcastMode !== 1 && b.player.mp >= 140) return { type: 'overcast', mode: 1 };
      return { type: 'skill', skillId: 'hand_thorn_field' };
    }
    if (boss && boss.hp > 0 && boss.coreShattered && boss.hp <= 230 && b.ap >= 1 && b.player.mp >= 150) {
      if (!b.player.wandActive && b.player.wandCooldown === 0) return { type: 'wand', on: true };
      if (b.player.overcastMode !== 2) return { type: 'overcast', mode: 2 };
      return { type: 'skill', skillId: 'hand_ice_crystal', targetIdx: 0 };
    }
    if (b.ap >= 1 && b.player.mp >= 40) {
      if (!b.player.wandActive && b.player.wandCooldown === 0 && b.player.mp >= 110) return { type: 'wand', on: true };
      const wantOc = b.player.mp >= 180 ? 1 : 0;
      if (b.player.overcastMode !== wantOc) return { type: 'overcast', mode: wantOc };
      return { type: 'skill', skillId: 'hand_ice_crystal', targetIdx: boss && boss.hp > 0 ? 0 : 1 };
    }
    return { type: 'endTurn' };
  }, { noPalace: true });
  const shatteredBySecondSpear = np7.log.some(l => l.includes('幽蓝晶核轰然震碎'));
  ok(`无冰宫基本功 7「赫兰终极战」连续破招引落第二发艾诺冰枪震碎晶核 ${np7.grade} 级获胜 (${np7.turns}T, crate=${np7.crateHp})`,
    np7.won && shatteredBySecondSpear && ['A', 'B'].includes(np7.grade) && np7.metrics.insights === 0,
    JSON.stringify({ won: np7.won, grade: np7.grade, turns: np7.turns, crate: np7.crateHp, shatteredBySecondSpear }));

  // 8) 容错验证：即便玩家在单次冰晶宫殿推演中失手选错（扣除 1 AP 且 0 看破技），依然可凭基本功逆转获胜！
  const misclickRes = CE.simulateBattle('beatrice_11', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 38 && b.aiMemory.lastAtkSkillId !== 'hand_ice_crystal') {
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (CE.isPalaceReady(b)) return { type: 'palace', clueId: 'ponytail' }; // 故意选错扣 1 AP 且耗尽 palaceLeft！
    if (st === 'HEAVY_WINDUP' && b.player.shield < 25 && b.ap >= 1 && e.hp > 60) {
      if (!b.player.cooldowns.hand_water_veil && b.player.mp >= 26) return { type: 'skill', skillId: 'hand_water_veil' };
      if (!b.player.cooldowns.hand_ice_wall && b.player.mp >= 28) return { type: 'skill', skillId: 'hand_ice_wall' };
    }
    if (b.aiMemory.sameAtkSkillStreak >= 2 && st !== 'GUARD_COUNTER' && e.hp > 85 && b.ap >= 1 && b.player.mp >= 38) {
      return { type: 'skill', skillId: 'hand_ice_crystal' };
    }
    if (b.ap >= 1 && b.player.mp >= 30) return { type: 'skill', skillId: 'hand_water_surge' };
    if (b.ap >= 1) return { type: 'skill', skillId: 'basic_attack' };
    return { type: 'endTurn' };
  });
  ok(`容错校验：冰晶宫殿故意点错一次（扣1 AP且无看破卡）仍可凭基本功 ${misclickRes.grade} 级逆转获胜 (${misclickRes.turns}T)`,
    misclickRes.won && misclickRes.metrics.insights === 0 && misclickRes.log.some(l => l.includes('误判')));

  // 9) 主线存档真实流派校验（usePreset: false）：9岁未选 ice_palace（选了二重咏唱等其他流派）挑战贝蒂可正常通关！
  win.__resetS();
  const s9 = win.__getS();
  s9.ageY = 9; s9.phase = 'youth'; s9.lv = 14;
  s9.mhp = 155; s9.hp = 155; s9.mmp = 225; s9.mp = 225;
  s9.atk = 13; s9.mag = 65; s9.pdef = 8; s9.mdef = 11;
  s9.skills = ['virtual_duel', 'dual_chant']; // 未选 ice_palace
  win.__setS(s9);
  const storyDuelRes = CE.simulateBattle('beatrice_11', b => {
    const e = b.enemies[0];
    const st = e.intent ? e.intent.stance : '';
    if ((st === 'HEAVY_WINDUP' || b.player.status.burn > 0) && b.player.shield < 25 && b.ap >= 1 && e.hp > 60) {
      if (!b.player.cooldowns.hand_water_veil && b.player.mp >= 26) return { type: 'skill', skillId: 'hand_water_veil' };
      if (!b.player.cooldowns.hand_ice_wall && b.player.mp >= 28) return { type: 'skill', skillId: 'hand_ice_wall' };
    }
    if (st === 'DUAL_CAST' && b.ap >= 1 && b.player.mp >= 38) return { type: 'skill', skillId: 'hand_ice_crystal' };
    if (b.aiMemory.sameAtkSkillStreak >= 2 && st !== 'GUARD_COUNTER' && b.ap >= 1 && b.player.mp >= 38) return { type: 'skill', skillId: 'hand_ice_crystal' };
    if (b.ap >= 1 && b.player.mp >= 30) return { type: 'skill', skillId: 'hand_water_surge' };
    if (b.ap >= 1) return { type: 'skill', skillId: 'basic_attack' };
    return { type: 'endTurn' };
  }, { usePreset: false });
  ok(`主线存档校验（usePreset:false 未学冰晶宫殿）：9岁存档挑战贝蒂 ${storyDuelRes.grade} 级顺畅通关 (${storyDuelRes.turns}T)`,
    storyDuelRes.won && storyDuelRes.metrics.insights === 0);
}

console.log(fail === 0 ? '\n  ✅ 第 3 轮全排列反无脑穷举、4~8回合交锋节奏与双路径可解性深度校验 100% 通过！' : `\n  ❌ ${fail} 项断言失败`);
process.exit(fail ? 1 : 0);
