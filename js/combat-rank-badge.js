/* =========================================================
   转生千金 · 战斗等阶铭牌 · 方案 C（星轨建筑印记）
   js/combat-rank-badge.js
   - 100% 还原方案 C 全 7 阶星轨几何 SVG 印徽与材质升华梯度
   - 权威原著等阶映射（覆盖全 9 幕主角/友军/敌方与存档模式）
   - combat:statechange 驱动零冲突幂等挂载，绝不破坏原文字节点或引发布局跳动
   ========================================================= */
(function (global) {
  'use strict';

  const DEFS_SVG_ID = 'cb-rank-badge-defs';
  const SERIF_FONT = "'Noto Serif SC', 'Noto Serif CJK SC', 'Songti SC', Georgia, serif";

  /**
   * 原著 7 阶定义（与 game.js TIERS[1..7] 一一对齐）
   */
  const RANKS = Object.freeze([
    Object.freeze({
      tier: 1,
      id: 1,
      key: 'novice',
      name: '初级',
      roman: 'I',
      code: '01',
      stratum: 'mortal',
      matName: '雪瓷冷银 · 单星刻',
      viewBox: '0 0 118 44',
      vbW: 118,
      vbH: 44,
      combatH: 18,
      compactH: 16,
    }),
    Object.freeze({
      tier: 2,
      id: 2,
      key: 'adept',
      name: '中级',
      roman: 'II',
      code: '02',
      stratum: 'mortal',
      matName: '冰青折光 · 双星刻',
      viewBox: '0 0 124 44',
      vbW: 124,
      vbH: 44,
      combatH: 18,
      compactH: 16,
    }),
    Object.freeze({
      tier: 3,
      id: 3,
      key: 'master',
      name: '高级',
      roman: 'III',
      code: '03',
      stratum: 'mortal',
      matName: '皇家深蓝 · 三星刻',
      viewBox: '0 0 132 46',
      vbW: 132,
      vbH: 46,
      combatH: 18,
      compactH: 16,
    }),
    Object.freeze({
      tier: 4,
      id: 4,
      key: 'saint',
      name: '圣级',
      roman: 'IV',
      code: '04',
      stratum: 'saint',
      matName: '深钴星渊 · 金星菱',
      viewBox: '0 0 140 48',
      vbW: 140,
      vbH: 48,
      combatH: 18,
      compactH: 16,
    }),
    Object.freeze({
      tier: 5,
      id: 5,
      key: 'king',
      name: '王级',
      roman: 'V',
      code: '05',
      stratum: 'sovereign',
      matName: '香槟金锻 · 冠星印',
      viewBox: '0 0 144 52',
      vbW: 144,
      vbH: 52,
      combatH: 18,
      compactH: 16,
    }),
    Object.freeze({
      tier: 6,
      id: 6,
      key: 'emperor',
      name: '帝级',
      roman: 'VI',
      code: '06',
      stratum: 'sovereign',
      matName: '深曜黑金 · 绯金冠',
      viewBox: '0 0 150 54',
      vbW: 150,
      vbH: 54,
      combatH: 18,
      compactH: 16,
    }),
    Object.freeze({
      tier: 7,
      id: 7,
      key: 'divine',
      name: '神级',
      roman: 'VII',
      code: '07',
      stratum: 'divine',
      matName: '纯白圣光 · 鎏金星环',
      viewBox: '0 0 158 58',
      vbW: 158,
      vbH: 58,
      combatH: 18,
      compactH: 16,
    }),
  ]);

  const RANK_BY_TIER = Object.create(null);
  const RANK_BY_KEY = Object.create(null);
  const RANK_BY_NAME = Object.create(null);
  const RANK_BY_ROMAN = Object.create(null);

  RANKS.forEach(spec => {
    RANK_BY_TIER[spec.tier] = spec;
    RANK_BY_KEY[spec.key] = spec;
    RANK_BY_NAME[spec.name] = spec;
    RANK_BY_ROMAN[spec.roman] = spec;
  });

  /**
   * 演武预设模式：主角希尔维亚各幕原著真实阶位
   * 严格核对《转生千金_1_87.txt》与 js/combat-engine.js STAGE_CONFIGS 预设岁数：
   * - 第 1 幕 beatrice_11（9岁，已达中级并携冰晶宫殿）→ 中级
   * - 第 2 幕 rowan_graveyard（8岁间章，刚升中级得冰晶宫殿）→ 中级
   * - 第 3 幕 alice_9（11岁，Lv.22 中级）→ 中级
   * - 第 4 幕 aino_sparring（12岁第四章，尚未习得魔战循环）→ 中级
   * - 第 5 幕 noelle_14（14岁第八章，已突破高级并解锁魔战循环）→ 高级
   * - 第 6–9 幕（14–16岁北林/赫兰/东翼/风暴眼）→ 高级
   */
  const STAGE_PLAYER_RANK = Object.freeze({
    beatrice_11: 2,
    rowan_graveyard: 2,
    alice_9: 2,
    aino_sparring: 2,
    noelle_14: 3,
    north_forest_hunt: 3,
    hulan_beast_tide: 3,
    turning_point_corridor: 3,
    wind_god_eye: 3,
  });

  /**
   * 前排友军原著权威阶位映射
   */
  const ALLY_RANK_MAP = Object.freeze({
    reno: 5,      // 雷纳德：王级（原著准顶尖多系天才，压制圣级罗文）
    charlotte: 2,
    jilan: 4,
    aino: 3,
    alice: 3,
    beatrice: 2,
    noelle: 3,
  });

  /**
   * 全部 9 幕敌方单位原著权威阶位映射（按 id / charId / aiType / crestKind 索引）
   */
  const ENEMY_RANK_MAP = Object.freeze({
    // 第 1 幕：贝阿特丽丝（11岁，原著 10 岁已突破中级）
    beatrice: 2,
    beatrice_11: 2,

    // 第 2 幕：血族侍卫罗文（原著明确标定圣级）
    rowan: 4,
    rowan_eclipse: 4,
    rowan_graveyard: 4,

    // 第 3 幕：爱丽丝（9岁虚拟决斗时尚为初级，当年稍后才破中级）
    alice: 1,
    alice_9: 1,

    // 第 4 幕：艾诺·塔尔维（学院冰系顶尖前辈）
    aino: 3,
    aino_sparring: 3,

    // 第 5 幕：诺艾儿（14岁，已研习高级魔法公式）
    noelle: 3,
    noelle_14: 3,

    // 第 6 幕：北林魔兽（普通狼初级 / 头狼高一阶中级 / 银级影豺高级）
    pack_wolf: 1,
    wolf: 1,
    wolf_b: 1,
    wolf_c: 1,
    wolf_d: 1,
    wolf_alpha: 2,
    wolf_king: 2,
    shadow_jackal: 3,
    jackal: 3,

    // 第 7 幕：赫兰冻土兽潮（狂狼/爪兽中级 / 重甲兽高级 / 裂地兽领主高一阶圣级）
    frost_hound: 2,
    frost_hound_a: 2,
    frost_hound_b: 2,
    ice_wolf: 2,
    ridge_claw: 2,
    jackal_minor: 2,
    frost_lizard: 2,
    tundra_brute: 3,
    hulan_brute: 3,
    boar: 3,
    golem: 3,
    abyss_behemoth: 4,
    hulan_lord: 4,
    hulan_beast_tide: 4,

    // 第 8 幕：转折点东翼火廊（赤炎术士中级 / 突击队长高级 / 东翼封锁官圣级）
    flame_mage: 2,
    flame_mage_a: 2,
    slime_fire: 1,
    corridor_vanguard: 3,
    inquisitor: 3,
    eastwing_commander: 4,
    eastwing_boss: 4,
    eastwing: 4,

    // 第 9 幕：七大列强 · 风神·岚（神级）
    wind_god_avatar: 7,
    wind_god_boss: 7,
    wind_god_tempest: 7,
    wind_god_eye: 7,
    wind_god: 7,
    fengshen: 7,
  });

  const SHARED_SVG_DEFS = [
    `<svg id="${DEFS_SVG_ID}" class="cb-rank-svg-defs" width="0" height="0" aria-hidden="true" focusable="false">`,
    '<defs>',
    // Tier 1: 雪瓷冷银
    '<linearGradient id="cbrb-t1-fill" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#F7FAFE"/>',
    '<stop offset="56%" stop-color="#E7EEF7"/>',
    '<stop offset="100%" stop-color="#D7E2F0"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t1-stroke" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#B0C2D8"/>',
    '<stop offset="50%" stop-color="#869BB7"/>',
    '<stop offset="100%" stop-color="#6F86A5"/>',
    '</linearGradient>',
    // Tier 2: 冰青折光
    '<linearGradient id="cbrb-t2-fill" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#EFFBFF"/>',
    '<stop offset="48%" stop-color="#C8EDFF"/>',
    '<stop offset="100%" stop-color="#9BDDFB"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t2-glint" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="rgba(255,255,255,0)"/>',
    '<stop offset="38%" stop-color="rgba(255,255,255,0.72)"/>',
    '<stop offset="55%" stop-color="rgba(255,255,255,0)"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t2-stroke" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#64C8F7"/>',
    '<stop offset="50%" stop-color="#1D95D4"/>',
    '<stop offset="100%" stop-color="#0E6BA8"/>',
    '</linearGradient>',
    // Tier 3: 皇家深蓝双面棱晶
    '<linearGradient id="cbrb-t3-fill" x1="0%" y1="0%" x2="0%" y2="100%">',
    '<stop offset="0%" stop-color="#357DF9"/>',
    '<stop offset="48.5%" stop-color="#1658EB"/>',
    '<stop offset="51.5%" stop-color="#0E308A"/>',
    '<stop offset="100%" stop-color="#081C58"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t3-stroke" x1="0%" y1="0%" x2="0%" y2="100%">',
    '<stop offset="0%" stop-color="#9BE3FF"/>',
    '<stop offset="45%" stop-color="#3B87FA"/>',
    '<stop offset="100%" stop-color="#07194E"/>',
    '</linearGradient>',
    // Tier 4: 深钴星渊 × 淡金
    '<linearGradient id="cbrb-t4-fill" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#153586"/>',
    '<stop offset="52%" stop-color="#0A1E57"/>',
    '<stop offset="100%" stop-color="#051034"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t4-gold" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#F7E8C4"/>',
    '<stop offset="45%" stop-color="#CFA968"/>',
    '<stop offset="78%" stop-color="#EFE0BE"/>',
    '<stop offset="100%" stop-color="#997330"/>',
    '</linearGradient>',
    '<radialGradient id="cbrb-t4-star-glow" cx="28%" cy="50%" r="42%">',
    '<stop offset="0%" stop-color="rgba(125,211,252,0.28)"/>',
    '<stop offset="60%" stop-color="rgba(22,88,235,0.10)"/>',
    '<stop offset="100%" stop-color="rgba(5,16,52,0)"/>',
    '</radialGradient>',
    // Tier 5: 温润香槟金锻面
    '<linearGradient id="cbrb-t5-fill" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#FFF8E5"/>',
    '<stop offset="28%" stop-color="#F0DCA6"/>',
    '<stop offset="52%" stop-color="#D7B26A"/>',
    '<stop offset="78%" stop-color="#E8CF93"/>',
    '<stop offset="100%" stop-color="#AD8238"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t5-stroke" x1="0%" y1="0%" x2="0%" y2="100%">',
    '<stop offset="0%" stop-color="#FFFDF5"/>',
    '<stop offset="25%" stop-color="#C89E4F"/>',
    '<stop offset="100%" stop-color="#6B4913"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t5-sheen" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="rgba(255,255,255,0)"/>',
    '<stop offset="42%" stop-color="rgba(255,253,242,0.58)"/>',
    '<stop offset="56%" stop-color="rgba(255,255,255,0)"/>',
    '</linearGradient>',
    // Tier 6: 深曜黑金 × 绯金冠芒
    '<linearGradient id="cbrb-t6-fill" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#291B26"/>',
    '<stop offset="48%" stop-color="#140F1A"/>',
    '<stop offset="100%" stop-color="#09070D"/>',
    '</linearGradient>',
    '<radialGradient id="cbrb-t6-crimson-core" cx="26%" cy="50%" r="48%">',
    '<stop offset="0%" stop-color="rgba(209,52,86,0.46)"/>',
    '<stop offset="58%" stop-color="rgba(158,27,58,0.16)"/>',
    '<stop offset="100%" stop-color="rgba(9,7,13,0)"/>',
    '</radialGradient>',
    '<linearGradient id="cbrb-t6-stroke" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#FCE4B0"/>',
    '<stop offset="28%" stop-color="#E04A68"/>',
    '<stop offset="56%" stop-color="#D7AF63"/>',
    '<stop offset="82%" stop-color="#B02142"/>',
    '<stop offset="100%" stop-color="#F2D498"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t6-crown" x1="0%" y1="0%" x2="0%" y2="100%">',
    '<stop offset="0%" stop-color="#FFF1CC"/>',
    '<stop offset="55%" stop-color="#E2B45E"/>',
    '<stop offset="100%" stop-color="#D13456"/>',
    '</linearGradient>',
    // Tier 7: 纯白圣光 × 鎏金星环 × 细微虹彩棱光
    '<linearGradient id="cbrb-t7-fill" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#FFFFFF"/>',
    '<stop offset="44%" stop-color="#FCFEFF"/>',
    '<stop offset="72%" stop-color="#F2F9FF"/>',
    '<stop offset="100%" stop-color="#FFFDF5"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t7-prism-wash" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="rgba(125,211,252,0.22)"/>',
    '<stop offset="32%" stop-color="rgba(255,255,255,0.05)"/>',
    '<stop offset="60%" stop-color="rgba(239,212,148,0.24)"/>',
    '<stop offset="84%" stop-color="rgba(186,184,255,0.18)"/>',
    '<stop offset="100%" stop-color="rgba(125,211,252,0.20)"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t7-stroke" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#B68731"/>',
    '<stop offset="22%" stop-color="#F2D893"/>',
    '<stop offset="44%" stop-color="#58BEF6"/>',
    '<stop offset="64%" stop-color="#D4AE5E"/>',
    '<stop offset="84%" stop-color="#9A9CEB"/>',
    '<stop offset="100%" stop-color="#A67926"/>',
    '</linearGradient>',
    '<linearGradient id="cbrb-t7-gold-ring" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#9F7222"/>',
    '<stop offset="48%" stop-color="#DFB968"/>',
    '<stop offset="100%" stop-color="#966A1D"/>',
    '</linearGradient>',
    '</defs>',
    '</svg>',
  ].join('');

  function ensureSvgDefs() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.getElementById(DEFS_SVG_ID)) return;
    const host = document.createElement('div');
    host.innerHTML = SHARED_SVG_DEFS;
    const svg = host.firstElementChild;
    if (svg) document.body.insertBefore(svg, document.body.firstChild);
  }

  function escapeAttr(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * 规范化解析任意等阶输入为标准 7 阶规格对象
   * 支持：数字 1..7、英文键名 novice..divine、中文 初级..神级、罗马数字 I..VII 或规格对象
   */
  function getRankSpec(input) {
    if (input == null) return null;
    if (typeof input === 'number') {
      const t = Math.round(input);
      return RANK_BY_TIER[t] || null;
    }
    if (typeof input === 'object') {
      if (input.tier != null) {
        const byT = getRankSpec(input.tier);
        if (byT) return byT;
      }
      if (input.rank != null) {
        const byR = getRankSpec(input.rank);
        if (byR) return byR;
      }
      if (input.key) {
        const byK = getRankSpec(input.key);
        if (byK) return byK;
      }
      if (input.name) {
        const byN = getRankSpec(input.name);
        if (byN) return byN;
      }
      if (typeof input.id === 'number') {
        const byId = getRankSpec(input.id);
        if (byId) return byId;
      }
      return null;
    }
    const raw = String(input).trim();
    if (!raw || raw === '0' || raw === '无') return null;
    if (/^[1-7]$/.test(raw)) return RANK_BY_TIER[Number(raw)] || null;
    const lower = raw.toLowerCase();
    if (RANK_BY_KEY[lower]) return RANK_BY_KEY[lower];
    if (RANK_BY_NAME[raw]) return RANK_BY_NAME[raw];
    const upper = raw.toUpperCase();
    if (RANK_BY_ROMAN[upper]) return RANK_BY_ROMAN[upper];

    // 识别别名与文本中的明确阶位词（按高阶优先匹配）
    if (raw.indexOf('神级') >= 0 || raw.indexOf('神阶') >= 0) return RANK_BY_TIER[7];
    if (raw.indexOf('帝级') >= 0 || raw.indexOf('帝阶') >= 0) return RANK_BY_TIER[6];
    if (raw.indexOf('王级') >= 0 || raw.indexOf('王阶') >= 0) return RANK_BY_TIER[5];
    if (raw.indexOf('圣级') >= 0 || raw.indexOf('圣阶') >= 0) return RANK_BY_TIER[4];
    if (raw.indexOf('高级') >= 0 || raw.indexOf('高阶') >= 0) return RANK_BY_TIER[3];
    if (raw.indexOf('中级') >= 0 || raw.indexOf('中阶') >= 0) return RANK_BY_TIER[2];
    if (raw.indexOf('初级') >= 0 || raw.indexOf('初阶') >= 0) return RANK_BY_TIER[1];
    return null;
  }

  function getSafeBattleState(ctx) {
    if (ctx && ctx.battleState) return ctx.battleState;
    try {
      if (global.CombatEngine && typeof global.CombatEngine.getBattleState === 'function') {
        return global.CombatEngine.getBattleState();
      }
    } catch (e) {}
    return null;
  }

  function getSafeRawBattle(ctx) {
    if (ctx && ctx.rawBattle) return ctx.rawBattle;
    try {
      if (global.CombatEngine && typeof global.CombatEngine.getState === 'function') {
        return global.CombatEngine.getState();
      }
    } catch (e) {}
    return null;
  }

  function getLiveSaveState() {
    try {
      if (global.S && typeof global.S === 'object') return global.S;
    } catch (e) {}
    return null;
  }

  function isLikelyPresetBattle(rawBattle, battleState) {
    if (!rawBattle) return !!(battleState && battleState.id && STAGE_PLAYER_RANK[battleState.id]);
    if (!rawBattle.fromArena) return false;
    const preset = rawBattle.stageCfg && rawBattle.stageCfg.preset;
    const rp = rawBattle.player;
    if (!preset || !rp) return true;
    // 演武选择「使用实时存档属性」时，mhp/age 常偏离 preset 且以存档为真源
    if (typeof preset.age === 'number' && typeof rp.age === 'number' && rp.age !== preset.age) {
      return false;
    }
    return true;
  }

  function resolvePlayerRank(unit, ctx) {
    // 1. 单位对象显式自带 rank / tier 时最高优先
    if (unit && typeof unit === 'object') {
      const explicit = getRankSpec(unit.rank != null ? unit.rank : unit.tier);
      if (explicit) return explicit;
    }

    const bState = getSafeBattleState(ctx);
    const rawBattle = getSafeRawBattle(ctx);
    const stageId = (ctx && ctx.stageId) || (bState && bState.id) || (rawBattle && rawBattle.id) || '';
    const liveS = getLiveSaveState();
    const usePresetRank = isLikelyPresetBattle(rawBattle, bState);

    // 2. 故事模式或演武「实时存档」模式：优先读取 game.js 实时存档 S.tier
    if (!usePresetRank && liveS && typeof liveS.tier === 'number' && liveS.tier >= 1) {
      const fromSave = getRankSpec(Math.min(7, Math.max(1, liveS.tier)));
      if (fromSave) return fromSave;
    }

    // 3. 演武预设模式（或存档尚未升阶的回退）：按幕数精准映射原著阶位
    if (stageId && STAGE_PLAYER_RANK[stageId]) {
      return RANK_BY_TIER[STAGE_PLAYER_RANK[stageId]];
    }

    // 4. 魔战循环 / 岁数推断回退（第 5 幕起解锁魔战循环 = 高级；8–12 岁初入学院 = 中级）
    const pObj = (unit && typeof unit === 'object') ? unit : (bState && bState.player) || (rawBattle && rawBattle.player);
    if (pObj) {
      if (pObj.hasManaCycle) return RANK_BY_TIER[3];
      const age = (ctx && typeof ctx.age === 'number')
        ? ctx.age
        : (typeof pObj.age === 'number' ? pObj.age : (rawBattle && rawBattle.player && typeof rawBattle.player.age === 'number' ? rawBattle.player.age : null));
      if (typeof age === 'number') {
        if (age >= 13) return RANK_BY_TIER[3];
        if (age >= 8) return RANK_BY_TIER[2];
        return RANK_BY_TIER[1];
      }
    }

    if (liveS && typeof liveS.tier === 'number' && liveS.tier >= 1) {
      return getRankSpec(Math.min(7, liveS.tier)) || RANK_BY_TIER[2];
    }

    return RANK_BY_TIER[2];
  }

  function resolveAllyRank(unit) {
    if (unit && typeof unit === 'object') {
      const explicit = getRankSpec(unit.rank != null ? unit.rank : unit.tier);
      if (explicit) return explicit;
    }
    const keys = [];
    if (typeof unit === 'string') {
      keys.push(unit);
    } else if (unit && typeof unit === 'object') {
      if (unit.id) keys.push(unit.id);
      if (unit.spriteId) keys.push(unit.spriteId);
      if (unit.charId) keys.push(unit.charId);
    }
    for (let i = 0; i < keys.length; i++) {
      const k = String(keys[i]).toLowerCase();
      if (ALLY_RANK_MAP[k]) return RANK_BY_TIER[ALLY_RANK_MAP[k]];
    }
    const name = typeof unit === 'string' ? unit : String((unit && unit.name) || '');
    const fromNameRank = getRankSpec(name);
    if (fromNameRank) return fromNameRank;
    if (name.indexOf('雷纳德') >= 0) return RANK_BY_TIER[5];
    if (name.indexOf('艾诺') >= 0 || name.indexOf('诺艾儿') >= 0) return RANK_BY_TIER[3];
    if (name.indexOf('贝阿特丽丝') >= 0 || name.indexOf('夏洛特') >= 0) return RANK_BY_TIER[2];
    if (name.indexOf('霁岚') >= 0) return RANK_BY_TIER[4];
    return RANK_BY_TIER[5];
  }

  function resolveEnemyRank(unit) {
    if (unit && typeof unit === 'object') {
      // 1. 敌人配置或实时状态自带 rank / tier 时最高优先
      const explicit = getRankSpec(unit.rank != null ? unit.rank : unit.tier);
      if (explicit) return explicit;
    }

    const name = typeof unit === 'string' ? unit : String((unit && unit.name) || '');

    // 2. 名称中显式声明的阶位词（如「罗文（圣级血族侍卫）」）
    const explicitInName = getRankSpec(name);
    if (explicitInName) return explicitInName;

    // 3. 精准 ID / charId / aiType / crestKind 映射
    const candidates = [];
    if (typeof unit === 'string') {
      candidates.push(unit);
    } else if (unit && typeof unit === 'object') {
      if (unit.id) candidates.push(unit.id);
      if (unit.charId) candidates.push(unit.charId);
      if (unit.aiType) candidates.push(unit.aiType);
      if (unit.crestKind) candidates.push(unit.crestKind);
    }
    for (let i = 0; i < candidates.length; i++) {
      const key = String(candidates[i]).toLowerCase();
      if (ENEMY_RANK_MAP[key]) return RANK_BY_TIER[ENEMY_RANK_MAP[key]];
    }

    // 4. 名称关键词兜底（覆盖动态/剧情扩展敌人）
    if (name.indexOf('风神') >= 0 || name.indexOf('岚') >= 0 || name.indexOf('法神') >= 0 || name.indexOf('药神') >= 0) {
      return RANK_BY_TIER[7];
    }
    if (name.indexOf('罗文') >= 0 || name.indexOf('封锁官') >= 0 || name.indexOf('红莲铁幕') >= 0 || name.indexOf('领主') >= 0 || name.indexOf('裂地兽') >= 0 || name.indexOf('统领') >= 0) {
      return RANK_BY_TIER[4];
    }
    if (name.indexOf('艾诺') >= 0 || name.indexOf('诺艾儿') >= 0 || name.indexOf('影豺') >= 0 || name.indexOf('重甲兽') >= 0 || name.indexOf('突击队长') >= 0) {
      return RANK_BY_TIER[3];
    }
    if (name.indexOf('爱丽丝') >= 0) {
      if (name.indexOf('12岁') >= 0) return RANK_BY_TIER[3];
      if (name.indexOf('10岁') >= 0 || name.indexOf('11岁') >= 0) return RANK_BY_TIER[2];
      return RANK_BY_TIER[1];
    }
    if (name.indexOf('贝阿特丽丝') >= 0) {
      if (name.indexOf('16岁') >= 0 || name.indexOf('17岁') >= 0) return RANK_BY_TIER[3];
      return RANK_BY_TIER[2];
    }
    if (name.indexOf('头狼') >= 0 || name.indexOf('霜原狂狼') >= 0 || name.indexOf('寒脊爪兽') >= 0 || name.indexOf('赤炎术士') >= 0 || name.indexOf('私军') >= 0) {
      return RANK_BY_TIER[2];
    }
    if (name.indexOf('灰棘狼') >= 0) {
      return RANK_BY_TIER[1];
    }

    // 5. 数值级保底推断
    if (unit && typeof unit === 'object') {
      const mhp = Number(unit.mhp || unit.hp) || 0;
      if (unit.boss) return mhp >= 550 ? RANK_BY_TIER[4] : RANK_BY_TIER[3];
      if (mhp >= 220) return RANK_BY_TIER[3];
      if (mhp >= 130) return RANK_BY_TIER[2];
    }
    return RANK_BY_TIER[1];
  }

  /**
   * 权威解析任意战斗单位等阶（返回 RANKS 中的只读规格对象）
   */
  function resolveUnitRank(unit, context) {
    const ctx = context && typeof context === 'object' ? context : {};
    const side = ctx.side || (unit && typeof unit === 'object' && (unit.side || unit.role)) || '';
    if (unit === 'player' || unit === 'sylvia' || side === 'player') {
      return resolvePlayerRank(unit === 'player' || unit === 'sylvia' ? null : unit, ctx);
    }
    if (side === 'ally' || side === 'vanguard' || unit === 'reno') {
      return resolveAllyRank(unit);
    }
    if (unit && typeof unit === 'object') {
      const uName = String(unit.name || '');
      if (uName.indexOf('希尔维亚') >= 0 || uName.indexOf('眷寒渔') >= 0) {
        return resolvePlayerRank(unit, ctx);
      }
      if (unit.id === 'reno' || uName.indexOf('雷纳德') >= 0) {
        return resolveAllyRank(unit);
      }
    }
    return resolveEnemyRank(unit);
  }

  /**
   * 构建方案 C（星轨建筑印记）7 阶高精度矢量 SVG（含 18px / 16px 实战字号光学补偿）
   */
  function buildSealSvg(spec, mode) {
    const tierId = spec.tier;
    const isMacro = mode === 'macro';
    const targetH = isMacro ? spec.vbH : (mode === 'compact' ? spec.compactH : spec.combatH);
    const targetW = isMacro ? spec.vbW : Math.round((spec.vbW / spec.vbH) * targetH);
    const svgAttrs = `class="cb-rank-svg" width="${targetW}" height="${targetH}" viewBox="${spec.viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"`;

    if (tierId === 1) {
      // 初级：雪瓷冷银 · 单星刻 · 单斜切角
      const sw = isMacro ? 1.35 : 2.35;
      const fs = isMacro ? 19.5 : 25;
      const ty = isMacro ? 29.5 : 31.4;
      const ls = isMacro ? 1.8 : 0.7;
      return `<svg ${svgAttrs}>` +
        `<polygon points="8,2 116,2 116,36 110,42 2,42 2,8" fill="url(#cbrb-t1-fill)" stroke="url(#cbrb-t1-stroke)" stroke-width="${sw}"/>` +
        '<polygon points="8,3 13,3 13,41 3,41 3,8" fill="#8EA3BE" opacity="0.48"/>' +
        '<line x1="10" y1="4.4" x2="113" y2="4.4" stroke="#FFFFFF" stroke-width="1.1" opacity="0.92"/>' +
        `<line x1="23" y1="32" x2="31.5" y2="12" stroke="#4D627E" stroke-width="${isMacro ? 2.2 : 3.4}" stroke-linecap="square"/>` +
        '<polygon points="34,9.5 35.6,12.8 39,14.4 35.6,16 34,19.3 32.4,16 29,14.4 32.4,12.8" fill="#5B7291"/>' +
        `<line x1="44" y1="10.5" x2="44" y2="33.5" stroke="#899EB9" stroke-width="${isMacro ? 1 : 1.5}" opacity="0.58"/>` +
        `<text x="79" y="${ty}" text-anchor="middle" font-family="${SERIF_FONT}" font-size="${fs}" font-weight="800" fill="#32445F" letter-spacing="${ls}">初级</text>` +
        '</svg>';
    }

    if (tierId === 2) {
      // 中级：冰青折光 · 双星刻 · 四角冰棱切
      const sw = isMacro ? 1.45 : 2.45;
      const fs = isMacro ? 19.5 : 25;
      const ty = isMacro ? 29.5 : 31.4;
      const ls = isMacro ? 1.8 : 0.7;
      return `<svg ${svgAttrs}>` +
        `<polygon points="9,2 115,2 122,9 122,35 115,42 9,42 2,35 2,9" fill="url(#cbrb-t2-fill)" stroke="url(#cbrb-t2-stroke)" stroke-width="${sw}"/>` +
        '<polygon points="28,3 54,3 38,41 12,41" fill="url(#cbrb-t2-glint)"/>' +
        '<line x1="11" y1="4.6" x2="113" y2="4.6" stroke="#FFFFFF" stroke-width="1.2" opacity="0.92"/>' +
        `<line x1="18.5" y1="32" x2="26.5" y2="12" stroke="#0B5F97" stroke-width="${isMacro ? 2.2 : 3.3}"/>` +
        `<line x1="27.5" y1="32" x2="35.5" y2="12" stroke="#0B5F97" stroke-width="${isMacro ? 2.2 : 3.3}"/>` +
        '<polygon points="38.5,9.5 41,13 38.5,16.5 36,13" fill="#1484C7"/>' +
        `<line x1="47.5" y1="10" x2="47.5" y2="34" stroke="#1E94D4" stroke-width="${isMacro ? 1 : 1.5}" opacity="0.55"/>` +
        `<text x="84" y="${ty}" text-anchor="middle" font-family="${SERIF_FONT}" font-size="${fs}" font-weight="800" fill="#06416E" letter-spacing="${ls}">中级</text>` +
        '</svg>';
    }

    if (tierId === 3) {
      // 高级：皇家深蓝双面棱晶 · 三星刻 · 六角锐切
      const sw = isMacro ? 1.55 : 2.55;
      const fs = isMacro ? 20 : 26;
      const ty = isMacro ? 30.5 : 32.6;
      const ls = isMacro ? 2.0 : 0.8;
      return `<svg ${svgAttrs}>` +
        `<polygon points="11,2 121,2 130,23 121,44 11,44 2,23" fill="url(#cbrb-t3-fill)" stroke="url(#cbrb-t3-stroke)" stroke-width="${sw}"/>` +
        '<line x1="6" y1="23" x2="126" y2="23" stroke="#7DD3FC" stroke-width="1" opacity="0.48"/>' +
        '<line x1="14" y1="5" x2="118" y2="5" stroke="#D9F3FF" stroke-width="1.2" opacity="0.75"/>' +
        `<line x1="18" y1="33" x2="24.5" y2="15.5" stroke="#BBEBFF" stroke-width="${isMacro ? 2.1 : 3.0}"/>` +
        `<line x1="26.5" y1="34" x2="34" y2="12" stroke="#FFFFFF" stroke-width="${isMacro ? 2.4 : 3.4}"/>` +
        `<line x1="35" y1="33" x2="41.5" y2="15.5" stroke="#BBEBFF" stroke-width="${isMacro ? 2.1 : 3.0}"/>` +
        '<polygon points="35.2,7.8 37.3,10.6 35.2,13.4 33.1,10.6" fill="#9CE2FF"/>' +
        `<line x1="50" y1="10" x2="50" y2="36" stroke="#7DD3FC" stroke-width="${isMacro ? 1 : 1.5}" opacity="0.46"/>` +
        `<text x="88" y="${ty}" text-anchor="middle" font-family="${SERIF_FONT}" font-size="${fs}" font-weight="900" fill="#FFFFFF" letter-spacing="${ls}">高级</text>` +
        '</svg>';
    }

    if (tierId === 4) {
      // 圣级：深钴星渊 × 淡金星菱纹章 · 超凡双翼切印
      const sw = isMacro ? 1.7 : 2.75;
      const fs = isMacro ? 20.5 : 26.5;
      const ty = isMacro ? 31.2 : 33.4;
      const ls = isMacro ? 2.2 : 0.9;
      return `<svg ${svgAttrs}>` +
        `<polygon points="14,3 126,3 132,11 138,24 132,37 126,45 14,45 8,37 2,24 8,11" fill="url(#cbrb-t4-fill)" stroke="url(#cbrb-t4-gold)" stroke-width="${sw}"/>` +
        '<polygon points="14,3 126,3 132,11 138,24 132,37 126,45 14,45 8,37 2,24 8,11" fill="url(#cbrb-t4-star-glow)"/>' +
        `<line x1="18" y1="7.2" x2="122" y2="7.2" stroke="#E8D2A1" stroke-width="${isMacro ? 0.95 : 1.25}" opacity="0.68"/>` +
        `<line x1="18" y1="40.8" x2="122" y2="40.8" stroke="#C4A46C" stroke-width="${isMacro ? 0.95 : 1.25}" opacity="0.58"/>` +
        `<polygon points="31.5,9.5 46,24 31.5,38.5 17,24" fill="none" stroke="url(#cbrb-t4-gold)" stroke-width="${isMacro ? 1.4 : 2.2}"/>` +
        '<path d="M 31.5 12.2 L 34.6 20.9 L 43.3 24 L 34.6 27.1 L 31.5 35.8 L 28.4 27.1 L 19.7 24 L 28.4 20.9 Z" fill="url(#cbrb-t4-gold)"/>' +
        '<polygon points="31.5,21.2 34.3,24 31.5,26.8 28.7,24" fill="#FFFFFF"/>' +
        '<polygon points="8.5,24 11.8,21.2 15.1,24 11.8,26.8" fill="#EFE0BE"/>' +
        '<polygon points="124.9,24 128.2,21.2 131.5,24 128.2,26.8" fill="#EFE0BE"/>' +
        `<line x1="52.5" y1="11" x2="52.5" y2="37" stroke="#C4A46C" stroke-width="${isMacro ? 1.05 : 1.5}" opacity="0.52"/>` +
        `<text x="89" y="${ty}" text-anchor="middle" font-family="${SERIF_FONT}" font-size="${fs}" font-weight="900" fill="#FAF0D6" letter-spacing="${ls}">圣级</text>` +
        '</svg>';
    }

    if (tierId === 5) {
      // 王级：温润香槟金锻面 · 冠星印 · 顶部王冠微耸切脊
      const sw = isMacro ? 1.7 : 2.75;
      const fs = isMacro ? 21 : 27;
      const ty = isMacro ? 34.2 : 36.2;
      const ls = isMacro ? 2.4 : 0.9;
      return `<svg ${svgAttrs}>` +
        `<polygon points="14,7 58,7 72,1.2 86,7 130,7 136,15 142,27 136,39 130,47 14,47 8,39 2,27 8,15" fill="url(#cbrb-t5-fill)" stroke="url(#cbrb-t5-stroke)" stroke-width="${sw}"/>` +
        '<polygon points="36,8 78,8 56,46 14,46" fill="url(#cbrb-t5-sheen)"/>' +
        `<line x1="18" y1="10.8" x2="126" y2="10.8" stroke="#FFFDF5" stroke-width="${isMacro ? 1.15 : 1.4}" opacity="0.90"/>` +
        `<line x1="18" y1="43.5" x2="126" y2="43.5" stroke="#7A561A" stroke-width="${isMacro ? 1.05 : 1.35}" opacity="0.55"/>` +
        '<polygon points="72,3.6 75.5,7 72,10.4 68.5,7" fill="#5A3D0E"/>' +
        '<path d="M 22.5 19.2 L 26 13.8 L 30 17.8 L 33 12 L 36 17.8 L 40 13.8 L 43.5 19.2 Z" fill="#2A1B07"/>' +
        '<path d="M 33 19.6 L 35.4 26.4 L 42.6 24.4 L 37.5 30 L 42.6 35.6 L 35.4 33.6 L 33 40.4 L 30.6 33.6 L 23.4 35.6 L 28.5 30 L 23.4 24.4 L 30.6 26.4 Z" fill="#2A1B07"/>' +
        '<polygon points="33,27 36,30 33,33 30,30" fill="#FFF7DF"/>' +
        `<line x1="52" y1="14" x2="52" y2="40" stroke="#785418" stroke-width="${isMacro ? 1.1 : 1.55}" opacity="0.52"/>` +
        `<text x="91" y="${ty}" text-anchor="middle" font-family="${SERIF_FONT}" font-size="${fs}" font-weight="900" fill="#221404" letter-spacing="${ls}">王级</text>` +
        '</svg>';
    }

    if (tierId === 6) {
      // 帝级：深曜黑金 × 绯金冠芒 · 双阶帝国翼锋
      const sw = isMacro ? 1.85 : 2.9;
      const fs = isMacro ? 21.5 : 27.5;
      const ty = isMacro ? 34.4 : 36.4;
      const ls = isMacro ? 2.4 : 1.0;
      return `<svg ${svgAttrs}>` +
        `<polygon points="10,27 18,16 14,16 20,8 56,8 65.5,2.6 75,7 84.5,2.6 94,8 130,8 136,16 132,16 140,27 132,38 136,38 130,46 94,46 75,51.4 56,46 20,46 14,38 18,38" fill="url(#cbrb-t6-fill)" stroke="url(#cbrb-t6-stroke)" stroke-width="${sw}"/>` +
        '<polygon points="14,27 22,10 128,10 136,27 128,44 22,44" fill="url(#cbrb-t6-crimson-core)"/>' +
        '<polygon points="1,27 9,23.2 9,30.8" fill="#E64F6D"/>' +
        '<polygon points="149,27 141,23.2 141,30.8" fill="#E64F6D"/>' +
        `<line x1="25" y1="11.8" x2="125" y2="11.8" stroke="#E8C47B" stroke-width="${isMacro ? 0.95 : 1.3}" opacity="0.72"/>` +
        `<line x1="25" y1="42.2" x2="125" y2="42.2" stroke="#DC3A5B" stroke-width="${isMacro ? 0.95 : 1.3}" opacity="0.74"/>` +
        '<path d="M 26 16.5 L 36.5 27 L 26 37.5 L 30.2 27 Z M 47 16.5 L 36.5 27 L 47 37.5 L 42.8 27 Z" fill="#E64867" opacity="0.95"/>' +
        '<path d="M 36.5 11.8 L 39.6 23.9 L 51.8 27 L 39.6 30.1 L 36.5 42.2 L 33.4 30.1 L 21.2 27 L 33.4 23.9 Z" fill="url(#cbrb-t6-crown)"/>' +
        `<polygon points="36.5,22 41.5,27 36.5,32 31.5,27" fill="#120C17" stroke="#FAE2A8" stroke-width="${isMacro ? 1.15 : 1.5}"/>` +
        '<polygon points="36.5,25 38.5,27 36.5,29 34.5,27" fill="#FF7390"/>' +
        `<line x1="56.5" y1="14" x2="56.5" y2="40" stroke="#DFB569" stroke-width="${isMacro ? 1.05 : 1.5}" opacity="0.56"/>` +
        `<text x="95" y="${ty}" text-anchor="middle" font-family="${SERIF_FONT}" font-size="${fs}" font-weight="900" fill="#FFF3D8" letter-spacing="${ls}">帝级</text>` +
        '</svg>';
    }

    // Tier 7 · 神级：纯白圣光 × 鎏金星环 × 细微虹彩棱光
    const sw = isMacro ? 1.95 : 3.05;
    const fs = isMacro ? 22 : 29;
    const ty = isMacro ? 36.2 : 38.6;
    const ls = isMacro ? 2.6 : 1.0;
    return `<svg ${svgAttrs}>` +
      `<polygon points="2,29 18,16 24,9 66,9 79,2.8 92,9 134,9 140,16 156,29 140,42 134,49 92,49 79,55.2 66,49 24,49 18,42" fill="url(#cbrb-t7-fill)" stroke="url(#cbrb-t7-stroke)" stroke-width="${sw}"/>` +
      '<polygon points="7,29 21,17.5 26,11.5 67,11.5 79,6 91,11.5 132,11.5 137,17.5 151,29 137,40.5 132,46.5 91,46.5 79,52 67,46.5 26,46.5 21,40.5" fill="url(#cbrb-t7-prism-wash)"/>' +
      `<polygon points="14,29 25,13 133,13 144,29 133,45 25,45" fill="none" stroke="#C69A44" stroke-width="${isMacro ? 0.95 : 1.35}" opacity="0.74"/>` +
      `<line x1="40.5" y1="2.4" x2="40.5" y2="55.6" stroke="url(#cbrb-t7-gold-ring)" stroke-width="${isMacro ? 1.2 : 1.85}" opacity="0.88"/>` +
      '<polygon points="9.5,29 14.5,25.8 19.5,29 14.5,32.2" fill="#C99A3E"/>' +
      '<polygon points="138.5,29 143.5,25.8 148.5,29 143.5,32.2" fill="#C99A3E"/>' +
      `<ellipse cx="40.5" cy="29" rx="17" ry="6.4" transform="rotate(-28 40.5 29)" fill="none" stroke="url(#cbrb-t7-gold-ring)" stroke-width="${isMacro ? 1.45 : 2.25}"/>` +
      `<ellipse cx="40.5" cy="29" rx="17" ry="6.4" transform="rotate(28 40.5 29)" fill="none" stroke="#36AAF0" stroke-width="${isMacro ? 1.25 : 1.95}" opacity="0.88"/>` +
      '<path d="M 40.5 13.5 L 43.2 25.6 L 55.2 29 L 43.2 32.4 L 40.5 44.5 L 37.8 32.4 L 25.8 29 L 37.8 25.6 Z" fill="url(#cbrb-t7-gold-ring)"/>' +
      '<path d="M 32.8 21.2 L 40.5 26.6 L 48.2 21.2 L 42.8 29 L 48.2 36.8 L 40.5 31.4 L 32.8 36.8 L 38.2 29 Z" fill="#C99A3E" opacity="0.78"/>' +
      '<polygon points="40.5,25.2 44.3,29 40.5,32.8 36.7,29" fill="#259CEB"/>' +
      '<polygon points="40.5,27.2 42.3,29 40.5,30.8 38.7,29" fill="#FFFFFF"/>' +
      `<line x1="62.5" y1="16" x2="62.5" y2="42" stroke="#C59C4B" stroke-width="${isMacro ? 1.05 : 1.5}" opacity="0.62"/>` +
      `<text x="98.5" y="${ty}" text-anchor="middle" font-family="${SERIF_FONT}" font-size="${fs}" font-weight="900" fill="#091D54" letter-spacing="${ls}">神级</text>` +
      '</svg>';
  }

  /**
   * 渲染方案 C 等阶铭牌 HTML
   */
  function renderBadgeHTML(rankInput, opts) {
    opts = opts || {};
    ensureSvgDefs();
    const spec = getRankSpec(rankInput) || (rankInput && typeof rankInput === 'object' ? resolveUnitRank(rankInput, opts) : null);
    if (!spec) return '';
    const mode = opts.mode || (opts.compact ? 'compact' : 'combat');
    const classes = ['cb-rank-badge', `cb-rank-t${spec.tier}`];
    if (mode === 'compact' || opts.compact) classes.push('is-compact');
    if (mode === 'macro') classes.push('is-macro');
    if (opts.className) classes.push(String(opts.className).trim());
    const tip = opts.title != null ? String(opts.title) : `等阶：${spec.name}（${spec.roman}）`;
    return `<span class="${classes.join(' ')}" data-rank="${spec.key}" data-tier="${spec.tier}" title="${escapeAttr(tip)}" aria-label="${escapeAttr(spec.name)}">${buildSealSvg(spec, mode)}</span>`;
  }

  function createBadgeElement(spec, opts) {
    if (typeof document === 'undefined' || !spec) return null;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderBadgeHTML(spec, opts);
    return tmp.firstElementChild || null;
  }

  /**
   * 幂等在名称节点最前方挂载/更新铭牌，绝不触碰原有文字节点
   */
  function mountBadgeBeforeText(nameEl, spec, opts) {
    if (!nameEl || !spec) return false;
    opts = opts || {};
    const wantCompact = !!opts.compact;

    // 清理可能残留的重复徽标节点（仅检查直接子节点）
    let existing = null;
    const children = Array.from(nameEl.children || []);
    for (let i = 0; i < children.length; i++) {
      const ch = children[i];
      if (ch.classList && ch.classList.contains('cb-rank-badge')) {
        if (!existing && i === 0) {
          existing = ch;
        } else {
          ch.remove();
        }
      }
    }

    if (
      existing &&
      existing.getAttribute('data-rank') === spec.key &&
      existing.classList.contains('is-compact') === wantCompact
    ) {
      return false;
    }

    const nextEl = createBadgeElement(spec, opts);
    if (!nextEl) return false;

    if (existing) {
      existing.replaceWith(nextEl);
    } else {
      nameEl.insertBefore(nextEl, nameEl.firstChild);
    }
    return true;
  }

  function readPlainNameText(el) {
    if (!el) return '';
    let out = '';
    const nodes = el.childNodes || [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.nodeType === 3) {
        out += n.nodeValue || '';
      } else if (n.nodeType === 1 && !(n.classList && n.classList.contains('cb-rank-badge'))) {
        out += n.textContent || '';
      }
    }
    return out.trim();
  }

  /**
   * 同步战斗界面全部四类目标节点的方案 C 等阶铭牌：
   * 1. 我方主角名称（#cb-player-pane）
   * 2. 前排与同队友军名称（#cb-ally-pane / .cb-ally-pane）
   * 3. 敌方脚下微条名称（.cb-enemy-card[data-eidx] .cb-e-title，始终 compact）
   * 4. 右下锁定目标详情卡标题（#cb-target-detail-pane .cb-td-title，标准尺寸）
   */
  function syncBattleBadges(stateOverride) {
    if (typeof document === 'undefined') return 0;
    const root = document.getElementById('battle-screen');
    if (!root) return 0;

    const state = stateOverride || getSafeBattleState();
    const rawBattle = getSafeRawBattle();
    if (!state && !rawBattle) return 0;

    ensureSvgDefs();
    let updated = 0;

    const partyPanes = root.querySelector('#cb-party-panes');
    const isCompactParty = !!(partyPanes && partyPanes.getAttribute('data-party-layout') === '3-6');

    // 1. 玩家名称节点（#cb-player-pane）
    const playerPane = root.querySelector('#cb-player-pane');
    if (playerPane) {
      const pNameEl = playerPane.querySelector('#cb-p-name') || playerPane.querySelector('.cb-p-name');
      if (pNameEl) {
        const pUnit = (state && state.player) || (rawBattle && rawBattle.player) || { name: readPlainNameText(pNameEl) };
        const pSpec = resolveUnitRank(pUnit, { side: 'player', battleState: state, rawBattle });
        if (pSpec && mountBadgeBeforeText(pNameEl, pSpec, { compact: isCompactParty })) {
          updated++;
        }
      }
    }

    // 2. 前排与同队友军名称节点（#cb-ally-pane / .cb-ally-pane）
    const allyPanes = root.querySelectorAll('#cb-ally-pane, .cb-ally-pane');
    if (allyPanes && allyPanes.length) {
      const alliesList = (state && Array.isArray(state.allies) && state.allies)
        || (rawBattle && Array.isArray(rawBattle.allies) && rawBattle.allies)
        || [];
      allyPanes.forEach((pane, paneIdx) => {
        if (pane.classList && pane.classList.contains('hidden')) return;
        const aNameEl = pane.querySelector('#cb-ally-name, #cb-a-name, .cb-ally-name, .cb-a-name');
        if (!aNameEl) return;
        const attrId = pane.getAttribute('data-ally-id') || pane.getAttribute('data-unit') || '';
        const attrIdxRaw = pane.getAttribute('data-aidx');
        const attrIdx = attrIdxRaw != null && attrIdxRaw !== '' ? Number(attrIdxRaw) : paneIdx;
        const plainName = readPlainNameText(aNameEl);
        let allyUnit = null;
        if (attrId && alliesList.length) {
          allyUnit = alliesList.find(a => a && (a.id === attrId || a.spriteId === attrId)) || null;
        }
        if (!allyUnit && Number.isInteger(attrIdx) && alliesList[attrIdx]) {
          allyUnit = alliesList[attrIdx];
        }
        if (!allyUnit && plainName && alliesList.length) {
          allyUnit = alliesList.find(a => a && a.name && plainName.indexOf(a.name) >= 0) || null;
        }
        if (!allyUnit) {
          allyUnit = { id: attrId || (plainName.indexOf('雷纳德') >= 0 ? 'reno' : `ally_${paneIdx}`), name: plainName };
        }
        const aSpec = resolveUnitRank(allyUnit, { side: 'ally', battleState: state, rawBattle });
        if (aSpec && mountBadgeBeforeText(aNameEl, aSpec, { compact: isCompactParty })) {
          updated++;
        }
      });
    }

    // 3. 每个敌人脚下微条名称节点（.cb-enemy-card[data-eidx] .cb-e-title，保持 compact）
    const enemyCards = root.querySelectorAll('.cb-enemy-card[data-eidx]');
    const enemiesList = (state && Array.isArray(state.enemies) && state.enemies)
      || (rawBattle && Array.isArray(rawBattle.enemies) && rawBattle.enemies)
      || [];

    enemyCards.forEach(card => {
      const titleEl = card.querySelector('.cb-e-title');
      if (!titleEl) return;
      const eIdx = Number(card.getAttribute('data-eidx'));
      const enemyUnit = (Number.isInteger(eIdx) && enemiesList[eIdx])
        ? enemiesList[eIdx]
        : { name: readPlainNameText(titleEl) };
      const eSpec = resolveUnitRank(enemyUnit, { side: 'enemy', battleState: state, rawBattle });
      if (eSpec && mountBadgeBeforeText(titleEl, eSpec, { compact: true })) {
        updated++;
      }
    });

    // 4. 右下唯一锁定目标详情卡标题节点（#cb-target-detail-pane .cb-td-title）
    const tdPane = root.querySelector('#cb-target-detail-pane');
    if (tdPane && !tdPane.classList.contains('is-empty')) {
      const tdTitleEl = tdPane.querySelector('.cb-td-title');
      if (tdTitleEl) {
        const attrIdxRaw = tdTitleEl.getAttribute('data-eidx') != null
          ? tdTitleEl.getAttribute('data-eidx')
          : tdPane.getAttribute('data-eidx');
        let targetIdx = (attrIdxRaw != null && attrIdxRaw !== '') ? Number(attrIdxRaw) : NaN;
        if (!Number.isInteger(targetIdx)) {
          if (state && Number.isInteger(state.targetIdx)) {
            targetIdx = state.targetIdx;
          } else if (rawBattle && Number.isInteger(rawBattle.targetIdx)) {
            targetIdx = rawBattle.targetIdx;
          }
        }
        let targetUnit = (Number.isInteger(targetIdx) && enemiesList[targetIdx])
          ? enemiesList[targetIdx]
          : null;
        if (!targetUnit) {
          const plainTdName = readPlainNameText(tdTitleEl);
          if (plainTdName && enemiesList.length) {
            targetUnit = enemiesList.find(e => e && e.name === plainTdName) || null;
          }
          if (!targetUnit && plainTdName) {
            targetUnit = { name: plainTdName };
          }
        }
        if (targetUnit) {
          const tdSpec = resolveUnitRank(targetUnit, { side: 'enemy', battleState: state, rawBattle });
          if (tdSpec && mountBadgeBeforeText(tdTitleEl, tdSpec, { compact: false })) {
            updated++;
          }
        }
      }
    }

    return updated;
  }

  // =========================================================
  // 事件驱动挂载与开战防抖同步（严禁监听子树引爆无限循环）
  // =========================================================
  let followupRafId = 0;
  let openDebounceTimer = 0;
  let lastBattleHidden = true;
  let screenClassObserver = null;

  function scheduleFollowupSync() {
    if (followupRafId || typeof global.requestAnimationFrame !== 'function') return;
    followupRafId = global.requestAnimationFrame(() => {
      followupRafId = 0;
      syncBattleBadges();
    });
  }

  function scheduleOpenSync() {
    if (openDebounceTimer) clearTimeout(openDebounceTimer);
    openDebounceTimer = setTimeout(() => {
      openDebounceTimer = 0;
      syncBattleBadges();
    }, 32);
  }

  function onCombatStateChange(ev) {
    const detail = ev && ev.detail ? ev.detail : null;
    if (!detail) return;
    syncBattleBadges(detail);
    scheduleFollowupSync();
  }

  function bindBattleScreenOpenWatcher() {
    if (typeof document === 'undefined' || screenClassObserver) return;
    const screen = document.getElementById('battle-screen');
    if (!screen) return;
    lastBattleHidden = screen.classList.contains('hidden');
    if (!lastBattleHidden) {
      scheduleOpenSync();
    }
    if (typeof global.MutationObserver !== 'function') return;
    // 仅监听 #battle-screen 自身 class 开关切换，绝不监听子树或子节点
    screenClassObserver = new global.MutationObserver(() => {
      const nowHidden = screen.classList.contains('hidden');
      if (lastBattleHidden && !nowHidden) {
        scheduleOpenSync();
      }
      lastBattleHidden = nowHidden;
    });
    screenClassObserver.observe(screen, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('combat:statechange', onCombatStateChange);
    }
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          ensureSvgDefs();
          bindBattleScreenOpenWatcher();
        }, { once: true });
      } else {
        ensureSvgDefs();
        bindBattleScreenOpenWatcher();
      }
    }
  }

  const CombatRankBadge = {
    RANKS,
    getRankSpec,
    resolveUnitRank,
    renderBadgeHTML,
    syncBattleBadges,
  };

  global.CombatRankBadge = CombatRankBadge;
  init();
})(typeof window !== 'undefined' ? window : globalThis);
