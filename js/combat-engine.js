/* =========================================================
   转生千金 · 策略智斗引擎 (js/combat-engine.js)
   核心：精简五线进化技能 × 线性相加增伤池 × 三阶魔力增幅 × 比值防御(K=80) × 晦轮杖真实魔伤 × 精准缩圈与线性等阶差格挡
   ========================================================= */
(function (global) {
  'use strict';

  const ARENA_SAVE_KEY = 'ojousama_arena_records_v1';
  const CASUAL_MODE_KEY = 'combat_casual_mode';
  const RING_ASSIST_KEY = 'combat_ring_assist_mode';
  const AMP_TIERS = [0, 0.20, 0.40, 0.60];

  const COMBAT_BALANCE_V32 = {
    version: '3.2.0',
    defK: 80,
    DEF_K: 80,
    maxDefPierce: 0.75,
    MAX_DEF_PIERCE: 0.75,
    minMpDiscountFloor: 0.60,
    MIN_MP_DISCOUNT_FLOOR: 0.60,
    manaCycleReturnRatio: 1.00,
    grades: ['BAD', 'GOOD', 'GREAT', 'PERFECT'],
    ringAtkBonus: { BAD: -0.10, GOOD: 0.00, GREAT: 0.08, PERFECT: 0.15 },
    blockBaseSameRank: { BAD: 0.00, GOOD: 0.08, GREAT: 0.18, PERFECT: 0.30 },
    blockRankSlope: { higher: 0.12, lower: 0.10 },
    breakAdd: 0.10,
    critBaseChance: 0.05,
    critBaseMult: 1.50,
    critMaxMult: 1.70,
    SHIELD_RETAIN_RATE: { default: 0.20, rootIce: 0.30, fortress: 0.45 },
    CRATE_GUARD_RETAIN_RATE: { default: 0.30, fortress: 0.50 },
    ampTiers: [
      { pct: 0.00, tier: 0, label: '常规',     addDmg: 0.00, defPierce: 0.00, extraLocks: 0, shieldMult: 1.00, crateGuardMirror: 24, crateGuardSteel: 36 },
      { pct: 0.20, tier: 1, label: '魔力盈溢', addDmg: 0.20, defPierce: 0.10, extraLocks: 1, shieldMult: 1.25, crateGuardMirror: 38, crateGuardSteel: 55 },
      { pct: 0.40, tier: 2, label: '极寒过载', addDmg: 0.40, defPierce: 0.22, extraLocks: 2, shieldMult: 1.50, crateGuardMirror: 56, crateGuardSteel: 85,
        fortressDmgMult: 0.88, fortressShieldRetain: 0.45, fortressCrateRetain: 0.50, hulanResonanceBonus: 1 },
      { pct: 0.60, tier: 3, label: '星霜极限', addDmg: 0.60, defPierce: 0.35, extraLocks: 3, shieldMult: 1.50 },
    ],
    OVERCAST: {
      linearSlope: 1.00,
      seg1End: 0.20,
      seg1Slope: 1.00,
      seg2End: 0.40,
      seg2Slope: 1.00,
      seg3Slope: 1.00,
      tier1: { at: 0.20, addDmg: 0.20, mult: 1.20, extraLocks: 1, defPierce: 0.10, shieldMult: 1.25, label: '魔力盈溢' },
      tier2: { at: 0.40, addDmg: 0.40, mult: 1.40, extraLocks: 2, defPierce: 0.22, shieldMult: 1.50, label: '极寒过载' },
      tier3: { at: 0.60, addDmg: 0.60, mult: 1.60, extraLocks: 3, defPierce: 0.35, shieldMult: 1.50, label: '星霜极限' },
      skillCaps: {
        HAND_HEAVY: 0.60,
        REMOTE: 0.60,
        SHIELD: 0.40,
        SWORD: 0.00,
        MOVE: 0.00,
        INSIGHT: 0.00,
      },
    },
    MANA_CYCLE: {
      returnRatio: 1.00,
    },
    STAVES: {
      none: {
        id: 'none', name: '徒手导魔', trueMagic: false,
        canTriggerEclipse: false,
        matkMult: 1.00, critDmgBonus: 0.00, extraMpPct: 0.00, overcastMpDiscount: 0.00,
      },
      eclipse_wand: {
        id: 'eclipse_wand', name: '晦轮杖',
        trueMagic: true,
        canTriggerEclipse: false,
        matkMult: 1.00, critDmgBonus: 0.00,
        extraMpPct: 0.24,
        overcastMpDiscount: 0.00,
        cooldown: 0, blocksManaCycle: false, selfShieldVuln: 0,
      },
      north_saint_staff: {
        id: 'north_saint_staff', name: '极北圣晶杖',
        trueMagic: false,
        canTriggerEclipse: false,
        matkMult: 1.14, critDmgBonus: 0.10,
        extraMpPct: 0.00, overcastMpDiscount: 0.10,
      },
    },
    HSR_AV: {
      baseNumerator: 10000,
      breakAdd: 0.10,
      breakVulnMult: 1.10,
      breakBurstMatkRatio: 0.50,
      breakRecoveryAtkMult: 0.75,
      pushPct: { mob: 0.50, elite: 0.45, boss: 0.35 },
      maxOneMorePerNaturalTurn: 1,
      oneMoreMpRefundPct: 0.12,
      overflowBreakBonus: { mpPct: 0.10, selfAdvancePct: 0.10 },
    },
    AGE_FLOOR_V3: {
      7:  { mhp: 145, mmp: 225, atk: 11, mag: 50,  pdef: 8,  mdef: 11 },
      8:  { mhp: 150, mmp: 235, atk: 12, mag: 52,  pdef: 8,  mdef: 11 },
      9:  { mhp: 162, mmp: 230, atk: 14, mag: 58,  pdef: 9,  mdef: 12 },
      11: { mhp: 170, mmp: 275, atk: 15, mag: 68,  pdef: 10, mdef: 14 },
      12: { mhp: 185, mmp: 285, atk: 18, mag: 82,  pdef: 12, mdef: 16 },
      14: { mhp: 218, mmp: 300, atk: 24, mag: 105, pdef: 15, mdef: 21 },
      15: { mhp: 235, mmp: 315, atk: 42, mag: 118, pdef: 17, mdef: 23 },
      16: { mhp: 255, mmp: 330, atk: 46, mag: 130, pdef: 19, mdef: 26 },
    },
    SOFT_CAP_RATIOS: {
      hp:   { gain: 0.20, scale: 0.70, floor: 0.94 },
      mp:   { gain: 0.18, scale: 0.70, floor: 0.94 },
      atk:  { gain: 0.24, scale: 0.95, floor: 0.92 },
      matk: { gain: 0.24, scale: 0.95, floor: 0.92 },
      def:  { gain: 0.25, scale: 1.00, floor: 0.92 },
      mdef: { gain: 0.25, scale: 1.00, floor: 0.92 },
    },
    SAVE_MATK_SOFT_CAP: { gain: 0.24, scale: 0.95, floor: 0.92 },
    ACTS_PLAYER_PRESET: {
      beatrice_11:            { age: 9,  rank: 2, hp: 165, mp: 230, atk: 14, matk: 35, def:  9, mdef: 12, spd: 100 },
      rowan_graveyard:        { age: 8,  rank: 2, hp: 155, mp: 240, atk: 12, matk: 34, def:  8, mdef: 12, spd: 96  },
      alice_9:                { age: 11, rank: 2, hp: 170, mp: 275, atk: 15, matk: 38, def: 10, mdef: 14, spd: 102 },
      aino_sparring:          { age: 12, rank: 2, hp: 185, mp: 285, atk: 18, matk: 44, def: 12, mdef: 16, spd: 105 },
      noelle_14:              { age: 14, rank: 3, hp: 215, mp: 300, atk: 22, matk: 48, def: 14, mdef: 20, spd: 106 },
      north_forest_hunt:      { age: 15, rank: 3, hp: 235, mp: 315, atk: 42, matk: 50, def: 17, mdef: 23, spd: 110 },
      hulan_beast_tide:       { age: 16, rank: 3, hp: 255, mp: 330, atk: 46, matk: 55, def: 19, mdef: 26, spd: 110 },
      turning_point_corridor: { age: 14, rank: 3, hp: 225, mp: 305, atk: 24, matk: 52, def: 16, mdef: 22, spd: 108 },
      wind_god_eye:           { age: 16, rank: 3, hp: 255, mp: 330, atk: 48, matk: 56, def: 19, mdef: 26, spd: 112 },
    },
    casualModeKey: CASUAL_MODE_KEY,
    casualMode: {
      enemyDmgMult: 0.60,
      enemyHpShieldMult: 0.70,
      playerTurnExtraMpPct: 0.15,
      noBadPenalty: true,
      uiDesc: '开启后战斗难度大幅下降，适合想要轻松享受剧情的休闲玩家',
    },
    slowMoQte: {
      keyPool: ['Q', 'W', 'E', 'A', 'S', 'D'],
      previewTelegraphMs: 170,
      slowMoScale: 0.25,
      hitStopScale: 0.06,
      hitStopMs: 55,
      ringWindowMs: [580, 530, 480, 430],
    },
  };

  const COMBAT_BALANCE_V22 = COMBAT_BALANCE_V32;

  const SKILL_BEAT_SPEC_V32 = {
    ice_1_crystal:     { beats: 1, keyRule: 'random_1' },
    ice_2_prism:       { beats: 3, keyRule: 'same_3' },
    ice_3_starfrost:   { beats: 2, keyRule: 'diff_2', vfxIcicles: [2, 2] },
    water_1_ball:      { beats: 1, keyRule: 'random_1' },
    water_2_surge:     { beats: 2, keyRule: 'diff_2' },
    water_3_blade:     { beats: 2, keyRule: 'diff_2' },
    frost_1_step:      { beats: 1, keyRule: 'random_1' },
    frost_2_breath:    { beats: 1, keyRule: 'random_1' },
    frost_3_thorns:    { beats: 'alive_enemies', min: 1, max: 6, keyRule: 'per_target_impale' },
    shield_1_ice:      { beats: 0, keyRule: 'instant_0' },
    shield_2_mirror:   { beats: 0, keyRule: 'instant_0' },
    shield_3_steel:    { beats: 0, keyRule: 'instant_0' },
    sword_1_basic:     { beats: 0, keyRule: 'instant_0', fixedGrade: 'GOOD', mpRegenPct: 0.06 },
    sword_2_cold_edge: { beats: 1, keyRule: 'random_1', zeroMpFallbackRegenPct: 0.06 },
    move_afterimage:   { beats: 0, keyRule: 'instant_0' },
  };

  const SKILL_VOICE_CUE_MAP = {
    ice_1_crystal:     'skill_hand_ice_crystal',
    ice_2_prism:       'skill_remote_blind_shot',
    ice_3_starfrost:   'skill_remote_snap_spike',
    water_1_ball:      'skill_hand_water_surge',
    water_2_surge:     'skill_hand_water_surge',
    water_3_blade:     'skill_sword_water_edge',
    frost_1_step:      'skill_hand_frost_floor',
    frost_2_breath:    'skill_hand_thorn_field',
    frost_3_thorns:    'skill_hand_thorn_field',
    shield_1_ice:      'skill_hand_ice_wall',
    shield_2_mirror:   'skill_hand_water_veil',
    shield_3_steel:    'skill_hand_root_shield',
    sword_1_basic:     'skill_basic_attack',
    sword_2_cold_edge: 'skill_sword_water_edge',
    move_afterimage:   'skill_sword_wind_afterimage',
  };

  let _casualModeMem = false;
  let _assistModeMem = 'standard';

  function normalizeAssistMode(val) {
    const s = String(val == null ? '' : val).toLowerCase().trim();
    if (s === 'relaxed' || s === 'off') return s;
    return 'standard';
  }

  function normalizeCasualBool(val) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const s = val.toLowerCase().trim();
      return s === 'true' || s === '1' || s === 'on';
    }
    return !!val;
  }

  function dispatchCombatPrefsSync(assist, casual, source) {
    try {
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('combat:prefschange', {
          detail: {
            assistMode: normalizeAssistMode(assist),
            casualMode: !!casual,
            source: source || 'combat-engine',
          },
        }));
      }
    } catch (e) {}
  }

  function isCasualMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CASUAL_MODE_KEY);
        if (raw !== null && raw !== '') {
          _casualModeMem = normalizeCasualBool(raw);
          return _casualModeMem;
        }
      }
    } catch (e) {}
    try {
      const ctr = global.CombatTimingRing;
      if (ctr && typeof ctr.isCasualMode === 'function') {
        _casualModeMem = !!ctr.isCasualMode();
        return _casualModeMem;
      }
    } catch (e) {}
    return !!_casualModeMem;
  }

  function setCasualMode(val, opts) {
    const next = normalizeCasualBool(val);
    _casualModeMem = next;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CASUAL_MODE_KEY, next ? 'true' : 'false');
      }
    } catch (e) {}
    try {
      const ctr = global.CombatTimingRing;
      if (ctr && typeof ctr.setCasualMode === 'function' && !(opts && opts.fromTimingRing)) {
        ctr.setCasualMode(next);
      }
    } catch (e) {}
    if (!(opts && opts.silent)) {
      dispatchCombatPrefsSync(getAssistMode(), next, 'combat-engine');
    }
    return next;
  }

  function getAssistMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(RING_ASSIST_KEY);
        if (raw !== null && raw !== '') {
          _assistModeMem = normalizeAssistMode(raw);
          return _assistModeMem;
        }
      }
    } catch (e) {}
    try {
      const ctr = global.CombatTimingRing;
      if (ctr && typeof ctr.getAssistMode === 'function') {
        _assistModeMem = normalizeAssistMode(ctr.getAssistMode());
        return _assistModeMem;
      }
    } catch (e) {}
    return _assistModeMem || 'standard';
  }

  function setAssistMode(mode, opts) {
    const next = normalizeAssistMode(mode);
    _assistModeMem = next;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(RING_ASSIST_KEY, next);
      }
    } catch (e) {}
    try {
      const ctr = global.CombatTimingRing;
      if (ctr && typeof ctr.setAssistMode === 'function' && !(opts && opts.fromTimingRing)) {
        ctr.setAssistMode(next);
      }
    } catch (e) {}
    if (!(opts && opts.silent)) {
      dispatchCombatPrefsSync(next, isCasualMode(), 'combat-engine');
    }
    if (typeof document !== 'undefined') {
      syncAssistModeBtn();
    }
    return next;
  }

  function computeBlockRate(defRank, atkRank, grade) {
    const normGrade = String(grade || 'BAD').toUpperCase().trim();
    const base = COMBAT_BALANCE_V32.blockBaseSameRank[normGrade];
    if (!base || base <= 0) return 0;
    const d = (Number(defRank) || 2) - (Number(atkRank) || 2);
    const slope = COMBAT_BALANCE_V32.blockRankSlope;
    const scale = d >= 0 ? (1.0 + slope.higher * d) : Math.max(0, 1.0 - slope.lower * Math.abs(d));
    return Math.min(1.0, Number((base * scale).toFixed(6)));
  }

  function resolveSkillVoiceCue(sid) {
    if (!sid) return 'skill_basic_attack';
    if (SKILL_VOICE_CUE_MAP[sid]) return SKILL_VOICE_CUE_MAP[sid];
    const sk = typeof TACTICAL_SKILLS !== 'undefined' ? TACTICAL_SKILLS[sid] : null;
    if (sk) {
      if (sk.line === 1) return 'skill_hand_ice_crystal';
      if (sk.line === 2) return 'skill_hand_water_surge';
      if (sk.line === 3) return 'skill_hand_thorn_field';
      if (sk.line === 4) return 'skill_hand_root_shield';
      if (sk.line === 5) return sk.atkKind === 'hybrid' ? 'skill_sword_water_edge' : 'skill_basic_attack';
      if (sk.line === 6) return 'skill_sword_wind_afterimage';
    }
    return `skill_${sid}`;
  }

  function safeSfx(type, opts) {
    try {
      if (global.CrystalSFX && typeof global.CrystalSFX.play === 'function') {
        global.CrystalSFX.play(type, opts);
        return;
      }
      if (typeof global.sfx === 'function') global.sfx(type, opts);
    } catch (e) {}
  }

  const ALLY_ELEM_META = {
    earth: { short: '土', skillName: '地陷岩棱', badge: '土 · 地陷岩棱' },
    fire:  { short: '火', skillName: '赤焰封线', badge: '火 · 赤焰封线' },
    wind:  { short: '风', skillName: '疾风截势', badge: '风 · 疾风截势' },
  };

  const ENEMY_FORMATION_SLOTS = {
    1: [1],
    2: [0, 2],
    3: [0, 2, 4],
    4: [0, 2, 3, 5],
    5: [0, 1, 2, 3, 5],
    6: [0, 1, 2, 3, 4, 5],
  };

  function resolveEnemyFormationSlots(enemies) {
    const list = Array.isArray(enemies) ? enemies : [];
    const count = Math.max(1, Math.min(6, list.length || 1));
    const defaults = ENEMY_FORMATION_SLOTS[count] || ENEMY_FORMATION_SLOTS[6];
    const used = new Set();
    const assigned = new Array(list.length).fill(-1);
    list.forEach((e, idx) => {
      if (e && Number.isInteger(e.slot) && e.slot >= 0 && e.slot <= 5 && !used.has(e.slot)) {
        assigned[idx] = e.slot;
        used.add(e.slot);
      }
    });
    let defCursor = 0;
    for (let idx = 0; idx < list.length; idx++) {
      if (assigned[idx] >= 0) continue;
      let picked = -1;
      while (defCursor < defaults.length) {
        const cand = defaults[defCursor++];
        if (!used.has(cand)) { picked = cand; break; }
      }
      if (picked < 0) {
        for (let s = 0; s < 6; s++) {
          if (!used.has(s)) { picked = s; break; }
        }
      }
      if (picked < 0) picked = idx % 6;
      assigned[idx] = picked;
      used.add(picked);
    }
    return assigned;
  }

  function getFormationSlotCoords(side, slotIdx) {
    const s = Math.max(0, Math.min(5, Number(slotIdx) || 0));
    const row = s % 3;
    const col = side === 'ally'
      ? (s < 3 ? 'back' : 'front')
      : (s < 3 ? 'front' : 'back');
    return { slot: s, row, col };
  }

  function logTag(cls, txt, bold) {
    const tag = bold ? 'b' : 'span';
    return `<${tag} class="${cls}">${txt}</${tag}>`;
  }

  function formatShortMoveName(raw) {
    return String(raw || '').replace(/（[^）]*）\s*$/, '').replace(/\([^)]*\)\s*$/, '').trim();
  }

  function shortEnemyPlateName(name) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    const stripped = raw
      .replace(/[（(][^）)]*[）)]/g, '')
      .replace(/[·・]?\s*「[^」]*」\s*$/, '')
      .trim();
    return stripped || raw.replace(/[（()）]/g, '').trim() || raw;
  }

  function shortPartyCardName(name) {
    const base = shortEnemyPlateName(name);
    if (base.length > 5 && /[·・]/.test(base)) {
      const head = base.split(/[·・]/)[0].trim();
      if (head) return head;
    }
    return base;
  }

  function shortAllyRoleLabel(role, fallback) {
    const raw = String(role || '').trim();
    if (!raw) return fallback || '前排主力';
    if (raw.length > 6 && /\s*[·・]\s*/.test(raw)) {
      const head = raw.split(/\s*[·・]\s*/)[0].trim();
      if (head) return head;
    }
    return raw;
  }

  const ELEM_LABEL = {
    ice: '冰系',
    water: '水系',
    fire: '火系',
    wind: '风系',
    earth: '土系',
    dark: '暗系',
    light: '光系',
    phys: '剑术',
  };

  const ELEM_COUNTER = {
    water: 'fire',
    fire: 'ice',
    ice: 'wind',
    wind: 'earth',
    earth: 'water',
    light: 'dark',
    dark: 'light',
  };

  function getElemMult(atkElem, defElem) {
    if (!atkElem || !defElem || atkElem === 'phys' || defElem === 'phys') return 1.0;
    if (ELEM_COUNTER[atkElem] === defElem) return 1.5;
    if (ELEM_COUNTER[defElem] === atkElem) return 0.75;
    return 1.0;
  }

  const PATH_META = {
    HAND: { tag: '【冰水术式】', short: '冰水术式', pill: '术式', desc: '凝聚冰霜与水流正面破局、控场护御，可自由调配魔力增幅档位' },
    REMOTE: { tag: '【进阶断咏】', short: '进阶断咏', pill: '断咏', desc: '高阶冰水术式可精准打断重术蓄势' },
    SWORD: { tag: '【剑步身法】', short: '剑步身法', pill: '剑步', desc: '近身导魔回蓝并迎锋化解贴身突袭，收束外显波动' },
    INSIGHT: { tag: '【精算研判】', short: '精算研判', pill: '研判', desc: '精准捕捉敌方破绽并针对性破局' },
  };

  const STANCE_META = {
    DUAL_CAST: {
      short: '重术蓄势',
      badge: '重术蓄势 · 咏唱空档',
      hint: '宜用进阶冰水术式或一阶以上魔力增幅截断蓄势',
    },
    CLOSE_LUNGE: {
      short: '贴身突袭',
      badge: '贴身突袭 · 高速扑杀',
      hint: '宜用「寒锋斩 / 护御盾幕 / 风行残像」迎锋卸力或闪避',
    },
    HEAVY_WINDUP: {
      short: '蓄力重击',
      badge: '蓄力重击 · 重心前压',
      hint: '宜立盾稳固防线，或把握空格格挡时机减免冲击',
    },
    GUARD_COUNTER: {
      short: '严密防反',
      badge: '严密防反 · 零留白守势',
      hint: '敌方守势严密，宜切换克制属性或借霜域与增幅破防',
    },
    UNDER_SEEP: {
      short: '诡道暗流',
      badge: '诡道杀机 · 暗流越位',
      hint: '致命暗招！宜施展「冰霜之息」冻绝地面暗流或以「风行残像」避险',
    },
    STAGGERED: {
      short: '架势失衡',
      badge: '架势崩解 · 蓄能受阻',
      hint: '敌方本回合行动已中断，乘势集火输出',
    },
  };

  const CB_SVG = {
    crystal: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v16M3 6l14 8M17 6L3 14"/><polygon points="10,4.5 14.8,7.2 14.8,12.8 10,15.5 5.2,12.8 5.2,7.2"/></svg>',
    palaceEmblem: '<svg viewBox="0 0 28 28" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="14,2 23,8 23,20 14,26 5,20 5,8" fill="rgba(56,189,248,0.14)"/><polygon points="14,6.5 19.5,14 14,21.5 8.5,14" fill="rgba(29,99,255,0.14)"/><path d="M14 2v24M5 8l18 12M23 8L5 20"/></svg>',
    wand: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16L13.5 6.5"/><circle cx="14.5" cy="5.5" r="2.6"/><path d="M10.5 3.2v1.3M16.8 9.5h-1.3"/></svg>',
    assist: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5l2.1 5.4 5.4 2.1-5.4 2.1L10 17.5l-2.1-5.4L2.5 10l5.4-2.1L10 2.5z"/></svg>',
    retreat: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5L3.5 9.5 8 14"/><path d="M3.5 9.5H13a3.5 3.5 0 010 7H10"/></svg>',
    soundOn: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M13.5 7.2a4.2 4.2 0 010 5.6"/><path d="M15.8 4.8a7.4 7.4 0 010 10.4"/></svg>',
    soundOff: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M13.2 7.5l4.2 5M17.4 7.5l-4.2 5"/></svg>',
    sliders: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"/><circle cx="7.5" cy="5.5" r="1.6" fill="currentColor"/><circle cx="13" cy="10" r="1.6" fill="currentColor"/><circle cx="9" cy="14.5" r="1.6" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>',
    hourglass: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 3h9M5.5 17h9M6.5 3c0 3.8 3.5 5.2 3.5 7s-3.5 3.2-3.5 7M13.5 3c0 3.8-3.5 5.2-3.5 7s3.5 3.2 3.5 7"/></svg>',
    swords: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3.5l1.5 1.5-9 9-2.5.5.5-2.5 9.5-8.5z"/><path d="M5 3.5L3.5 5l4 4M11.5 13l3 3 1.5-1.5-3-3"/></svg>',
    shield: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5l6 2.5v4.8c0 3.8-2.6 6.8-6 7.8-3.4-1-6-4-6-7.8V5l6-2.5z"/></svg>',
    scale: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3v14M6 17h8M4.5 6.5h11M4.5 6.5L2.5 12h4l-2-5.5zM15.5 6.5L13.5 12h4l-2-5.5z"/></svg>',
    chart: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15.5V9.5M10 15.5V4.5M16 15.5V7.5"/></svg>',
    warn: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L2.5 16.5h15L10 3z"/><path d="M10 8v3.8M10 14.2h.01"/></svg>',
    target: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6"/><circle cx="10" cy="10" r="2"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18"/></svg>',
    chain: '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 11.5l3-3"/><path d="M6.8 13.2l-1.3 1.3a2.6 2.6 0 01-3.7-3.7l2.6-2.6a2.6 2.6 0 013.7 0"/><path d="M13.2 6.8l1.3-1.3a2.6 2.6 0 013.7 3.7l-2.6 2.6a2.6 2.6 0 01-3.7 0"/></svg>',
    palaceFrostAccent: '<svg class="cp-head-frost-svg" viewBox="0 0 120 72" width="120" height="72" fill="none" aria-hidden="true"><g stroke="#1658EB" stroke-opacity="0.22" stroke-width="1.2"><polygon points="60,6 84,20 84,48 60,62 36,48 36,20" fill="#38BDF8" fill-opacity="0.08"/><polygon points="60,16 74,34 60,52 46,34" fill="#FFFFFF" fill-opacity="0.32"/><path d="M60 2v64M32 18l56 32M88 18L32 50"/><polygon points="104,14 112,24 104,34 96,24" fill="#38BDF8" fill-opacity="0.14"/><polygon points="18,38 25,46 18,54 11,46" fill="#1658EB" fill-opacity="0.1"/></g></svg>',
  };

  function resolveBattleBgUrl(stageCfg) {
    const id = stageCfg && stageCfg.id ? stageCfg.id : '';
    if (id === 'hulan_beast_tide') return 'assets/bg/ice_canyon.jpg';
    if (id === 'aino_sparring') return 'assets/bg/ice_classroom.jpg';
    if (id === 'rowan_graveyard') return 'assets/bg_night.jpg';
    if (id === 'north_forest_hunt') return 'assets/bg/north_forest.jpg';
    if (id === 'turning_point_corridor') return 'assets/bg/hallway.jpg';
    if (id === 'wind_god_eye') return 'assets/bg/training.jpg';
    return 'assets/bg/training.jpg';
  }

  const MONSTER_ART_FILES = {
    rowan: 'assets/monsters/rowan_eclipse.webp',
    rowan_graveyard: 'assets/monsters/rowan_eclipse.webp',
    rowan_eclipse: 'assets/monsters/rowan_eclipse.webp',
    wolf_alpha: 'assets/monsters/wolf_alpha.webp',
    wolf_king: 'assets/monsters/wolf_alpha.webp',
    north_forest_hunt: 'assets/monsters/wolf_alpha.webp',
    pack_wolf: 'assets/monsters/pack_wolf.webp',
    wolf: 'assets/monsters/pack_wolf.webp',
    wolf_b: 'assets/monsters/pack_wolf.webp',
    wolf_c: 'assets/monsters/pack_wolf.webp',
    wolf_d: 'assets/monsters/pack_wolf.webp',
    shadow_jackal: 'assets/monsters/shadow_jackal.webp',
    jackal: 'assets/monsters/shadow_jackal.webp',
    tundra_brute: 'assets/monsters/tundra_brute.webp',
    hulan_brute: 'assets/monsters/tundra_brute.webp',
    boar: 'assets/monsters/tundra_brute.webp',
    golem: 'assets/monsters/tundra_brute.webp',
    frost_hound: 'assets/monsters/frost_hound.webp',
    frost_hound_a: 'assets/monsters/frost_hound.webp',
    frost_hound_b: 'assets/monsters/frost_hound.webp',
    ice_wolf: 'assets/monsters/frost_hound.webp',
    abyss_behemoth: 'assets/monsters/abyss_behemoth.webp',
    hulan_lord: 'assets/monsters/abyss_behemoth.webp',
    hulan_beast_tide: 'assets/monsters/abyss_behemoth.webp',
    ridge_claw: 'assets/monsters/ridge_claw.webp',
    jackal_minor: 'assets/monsters/ridge_claw.webp',
    corridor_vanguard: 'assets/monsters/corridor_vanguard.webp',
    inquisitor: 'assets/monsters/corridor_vanguard.webp',
    flame_mage: 'assets/monsters/flame_mage.webp',
    flame_mage_a: 'assets/monsters/flame_mage.webp',
    slime_fire: 'assets/monsters/flame_mage.webp',
    eastwing_commander: 'assets/monsters/eastwing_commander.webp',
    eastwing: 'assets/monsters/eastwing_commander.webp',
    turning_point_corridor: 'assets/monsters/eastwing_commander.webp',
    wind_god_tempest: 'assets/monsters/wind_god_tempest.webp',
    wind_god_avatar: 'assets/monsters/wind_god_tempest.webp',
    wind_god_eye: 'assets/monsters/wind_god_tempest.webp',
    wind_god: 'assets/monsters/wind_god_tempest.webp',
    frost_lizard: 'assets/monsters/frost_lizard.webp',
  };

  function isJsdomEnv() {
    try {
      const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
      return /jsdom/i.test(ua);
    } catch (e) {
      return false;
    }
  }

  function getPixelVfxApi() {
    if (isJsdomEnv()) return null;
    const api = global.CombatPixelVFX;
    if (!api || typeof api.isEnabled !== 'function' || !api.isEnabled()) return null;
    return api;
  }

  function queuePixelAction(b, action) {
    if (!b || b.headless || !action || !getPixelVfxApi()) return;
    b._pendingPixelActions = b._pendingPixelActions || [];
    b._pendingPixelActions.push(Object.assign({ waveIdx: b.waveIdx || 0 }, action));
  }

  function isCoarseTouchDevice() {
    if (isJsdomEnv()) return false;
    try {
      return !!(
        typeof global !== 'undefined' &&
        typeof global.matchMedia === 'function' &&
        global.matchMedia('(hover: none), (pointer: coarse)').matches
      );
    } catch (e) {
      return false;
    }
  }

  const DEFAULT_INSTALLED_MONSTER_ART = [
    'assets/monsters/rowan_eclipse.webp',
    'assets/monsters/wolf_alpha.webp',
    'assets/monsters/pack_wolf.webp',
    'assets/monsters/shadow_jackal.webp',
    'assets/monsters/tundra_brute.webp',
    'assets/monsters/frost_hound.webp',
    'assets/monsters/abyss_behemoth.webp',
    'assets/monsters/ridge_claw.webp',
    'assets/monsters/corridor_vanguard.webp',
    'assets/monsters/flame_mage.webp',
    'assets/monsters/eastwing_commander.webp',
    'assets/monsters/wind_god_tempest.webp',
    'assets/monsters/frost_lizard.webp',
  ];

  function isMonsterArtEnabled(key, url) {
    const raw = typeof window !== 'undefined' ? window.MONSTER_ART_INSTALLED : undefined;
    if (raw === false) return false;
    const installed = raw !== undefined && raw !== null ? raw : (isJsdomEnv() ? null : DEFAULT_INSTALLED_MONSTER_ART);
    if (!installed) return false;
    if (installed === true) return true;
    if (Array.isArray(installed)) return installed.includes(key) || installed.includes(url);
    return !!(installed[key] || installed[url]);
  }

  function resolveMonsterArtUrl(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (k && MONSTER_ART_FILES[k] && isMonsterArtEnabled(k, MONSTER_ART_FILES[k])) {
        return MONSTER_ART_FILES[k];
      }
    }
    return null;
  }

  const HUMANOID_MONSTER_ART = new Set([
    'assets/monsters/rowan_eclipse.webp',
    'assets/monsters/corridor_vanguard.webp',
    'assets/monsters/eastwing_commander.webp',
    'assets/monsters/flame_mage.webp',
    'assets/monsters/wind_god_tempest.webp',
  ]);

  function renderEnemyVisualHTML(opts) {
    opts = opts || {};
    const alt = String(opts.alt || '').replace(/"/g, '&quot;');
    const charImg = opts.charImg || null;
    const monsterUrl = resolveMonsterArtUrl(opts.monsterKeys || []);
    const crestKey = opts.crestKey || '';
    const jsdom = isJsdomEnv();
    const isCgPortrait = !!(charImg && /(?:fengshen_normal\.png|assets\/cg\/)/i.test(charImg));
    const isHumanoidArt = !!(monsterUrl && HUMANOID_MONSTER_ART.has(monsterUrl));
    const monsterCls = isHumanoidArt ? 'cb-monster-img is-humanoid' : 'cb-monster-img';

    if (charImg) {
      if (monsterUrl && !jsdom) {
        const safeChar = String(charImg).replace(/'/g, "\\'");
        return {
          isSvg: false,
          isCgPortrait: false,
          html: `<img src="${monsterUrl}" class="${monsterCls}" alt="${alt}" onerror="this.onerror=null;this.src='${safeChar}';${isCgPortrait ? "this.classList.add('is-cg-portrait');" : ''}" />`,
        };
      }
      return {
        isSvg: false,
        isCgPortrait,
        html: `<img src="${charImg}"${isCgPortrait ? ' class="is-cg-portrait"' : ''} alt="${alt}" />`,
      };
    }

    const svgHtml = renderBeastCrestSVG(crestKey);
    if (monsterUrl && !jsdom) {
      return {
        isSvg: true,
        isCgPortrait: false,
        html: `<img src="${monsterUrl}" class="${monsterCls}" alt="${alt}" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" /><span class="cb-crest-fallback" style="display:none">${svgHtml}</span>`,
      };
    }
    return {
      isSvg: true,
      isCgPortrait: false,
      html: svgHtml,
    };
  }

  function renderBeastCrestSVG(kind) {
    const k = String(kind || '').toLowerCase();
    // 第8幕：东翼红莲铁幕 / 宫廷封锁官 — 绯红鎏金烈焰长戟徽章
    if (k.indexOf('eastwing') >= 0 || k.indexOf('inquisitor') >= 0 || k.indexOf('corridor') >= 0 || k.indexOf('flame_mage') >= 0) {
      const isBoss = k.indexOf('eastwing') >= 0 || k.indexOf('boss') >= 0 || k.indexOf('commander') >= 0;
      return '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">' +
        (isBoss
          ? '<circle cx="60" cy="60" r="54" stroke="#e8b861" stroke-width="1.8" stroke-dasharray="6 3"/>' +
            '<circle cx="60" cy="60" r="47" stroke="rgba(239,99,119,0.58)" stroke-width="1.5"/>'
          : '<circle cx="60" cy="60" r="49" stroke="rgba(239,99,119,0.4)" stroke-width="1.4" stroke-dasharray="4 4"/>') +
        '<polygon points="60,12 96,34 92,84 60,108 28,84 24,34" fill="rgba(34,12,20,0.9)" stroke="#d8b467" stroke-width="2"/>' +
        '<path d="M60 18L67 40L60 48L53 40Z" fill="#ff746c" stroke="#f7dfa0" stroke-width="1.5"/>' +
        '<path d="M60 22V100" stroke="#f4dca0" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M40 44C46 34 52 38 60 50C68 38 74 34 80 44C76 58 68 62 60 66C52 62 44 58 40 44Z" fill="rgba(232,76,68,0.44)" stroke="#ff8a7a" stroke-width="1.8"/>' +
        '<path d="M35 66C42 74 51 77 60 76C69 77 78 74 85 66" stroke="#e8c373" stroke-width="1.9" stroke-linecap="round"/>' +
        '<path d="M44 82L60 94L76 82" stroke="#ff7a84" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="60" cy="57" r="4.2" fill="#ffe6a8"/>' +
      '</svg>';
    }
    // 第9幕：风神·风暴眼 — 青银旋岚气眼螺旋徽章
    if (k.indexOf('wind_god') >= 0 || k.indexOf('tempest') >= 0 || k.indexOf('fengshen') >= 0) {
      return '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="53" stroke="rgba(126,242,212,0.48)" stroke-width="1.6"/>' +
        '<circle cx="60" cy="60" r="45" stroke="rgba(216,180,103,0.42)" stroke-width="1.2" stroke-dasharray="3 5"/>' +
        '<circle cx="60" cy="60" r="40" fill="rgba(10,28,44,0.88)"/>' +
        '<path d="M60 18C84 18 100 37 98 60C96 80 79 94 60 94C44 94 31 82 31 66C31 53 41 43 53 43C64 43 71 50 71 59" stroke="#8ff2dc" stroke-width="2.3" stroke-linecap="round"/>' +
        '<path d="M60 102C36 102 20 83 22 60C24 40 41 26 60 26C76 26 89 38 89 54C89 67 79 77 67 77C56 77 49 70 49 61" stroke="#b9e9ff" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="60" cy="60" r="10" fill="rgba(176,248,242,0.2)" stroke="#f4dca0" stroke-width="1.6"/>' +
        '<circle cx="60" cy="60" r="4.2" fill="#e8fffb"/>' +
        '<path d="M60 10V17M60 103V110M10 60H17M103 60H110" stroke="#d8b467" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    }
    // 第2幕：罗文 — 银弯月与晦轮杖折光徽章
    if (k.indexOf('rowan') >= 0) {
      return '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="52" stroke="rgba(186,166,244,0.42)" stroke-width="1.5"/>' +
        '<circle cx="60" cy="60" r="44" fill="rgba(13,16,38,0.92)" stroke="rgba(210,224,248,0.34)" stroke-width="1.2"/>' +
        '<path d="M77 25A34 34 0 1044 92A26 26 0 1177 25Z" fill="rgba(202,216,246,0.22)" stroke="#dce8ff" stroke-width="1.8"/>' +
        '<circle cx="60" cy="40" r="13" fill="rgba(18,22,52,0.95)" stroke="#c9b4ff" stroke-width="2"/>' +
        '<circle cx="60" cy="40" r="8" stroke="#f0d9a0" stroke-width="1.3" stroke-dasharray="3 2"/>' +
        '<path d="M60 53V102" stroke="#dce8ff" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M47 64L60 56L73 64" stroke="#b9a0ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="60" cy="40" r="3.4" fill="#eef4ff"/>' +
      '</svg>';
    }
    // 霜脊影豺 / 寒脊爪兽 — 疾影钢霜利齿徽章
    if (k.indexOf('jackal') >= 0) {
      return '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="50" stroke="rgba(139,211,255,0.28)" stroke-width="1.5" stroke-dasharray="4 4"/>' +
        '<polygon points="60,14 96,42 84,92 60,106 36,92 24,42" fill="rgba(16,24,48,0.85)" stroke="#9dd4ff" stroke-width="2"/>' +
        '<path d="M38 38L49 20L56 36L60 22L64 36L71 20L82 38L74 66L60 88L46 66Z" fill="rgba(42,64,108,0.65)" stroke="#d8b467" stroke-width="1.8"/>' +
        '<polygon points="48,54 55,58 47,61" fill="#ff7d91"/>' +
        '<polygon points="72,54 65,58 73,61" fill="#ff7d91"/>' +
        '<path d="M48 74l6 8 6-6 6 6 6-8" stroke="#e4eefc" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
    }
    // 赫兰冻土重甲兽 / 霜渊裂地兽领主 / 裂岩冰蜥 — 冰岩晶核重甲徽章
    if (k.indexOf('hulan') >= 0 || k.indexOf('lord') >= 0 || k.indexOf('behemoth') >= 0 || k.indexOf('brute') >= 0 || k.indexOf('lizard') >= 0) {
      return '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="52" stroke="rgba(139,211,255,0.34)" stroke-width="1.5"/>' +
        '<path d="M22 44L36 22L50 38L60 16L70 38L84 22L98 44L88 86L60 104L32 86Z" fill="rgba(14,34,68,0.88)" stroke="#8bd3ff" stroke-width="2.2"/>' +
        '<polygon points="60,46 73,64 60,84 47,64" fill="rgba(139,211,255,0.32)" stroke="#f4dca0" stroke-width="1.8"/>' +
        '<circle cx="60" cy="64" r="5" fill="#d8f4ff"/>' +
        '<path d="M40 54l10 4M80 54l-10 4" stroke="#8bd3ff" stroke-width="2.4" stroke-linecap="round"/>' +
      '</svg>';
    }
    // 灰棘头狼 / 狼群领主 — 冰霜王冠 + 猩红双眸 + 鎏金外环光晕（一眼区分集火主目标）
    if (k.indexOf('alpha') >= 0) {
      return '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="54" stroke="#e8c370" stroke-width="2"/>' +
        '<circle cx="60" cy="60" r="47" stroke="rgba(155,228,255,0.52)" stroke-width="1.3" stroke-dasharray="5 3"/>' +
        '<path d="M40 28L47 13L55 24L60 9L65 24L73 13L80 28Z" fill="rgba(168,232,255,0.28)" stroke="#f4dca0" stroke-width="1.9" stroke-linejoin="round"/>' +
        '<path d="M31 46L39 24L52 38H68L81 24L89 46L94 67L60 103L26 67Z" fill="rgba(22,34,66,0.94)" stroke="#f0d284" stroke-width="2.2"/>' +
        '<path d="M44 48L60 76L76 48" stroke="#9ee4ff" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<polygon points="41,56 54,59 44,65" fill="#ff4260" stroke="#ffd2da" stroke-width="0.7"/>' +
        '<polygon points="79,56 66,59 76,65" fill="#ff4260" stroke="#ffd2da" stroke-width="0.7"/>' +
        '<path d="M48 80l5 7 7-5 7 5 5-7" stroke="#fff0c8" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
    }
    // 普通灰棘狼 / 霜原狂狼 — 极简银蓝狼影简章（清晰弱于头狼王冠金环）
    return '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="46" stroke="rgba(146,198,242,0.26)" stroke-width="1.3" stroke-dasharray="4 5"/>' +
      '<path d="M39 46L45 26L55 40H65L75 26L81 46L85 65L60 94L35 65Z" fill="rgba(14,26,50,0.82)" stroke="#8cbbe6" stroke-width="1.7"/>' +
      '<path d="M49 52L60 72L71 52" stroke="rgba(160,210,248,0.45)" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<polygon points="46,56 53,58 48,62" fill="#8bd3ff"/>' +
      '<polygon points="74,56 67,58 72,62" fill="#8bd3ff"/>' +
      '<path d="M53 77l3.5 4.5 3.5-3 3.5 3 3.5-4.5" stroke="#cfe6fa" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';
  }

  /* =========================================================
     1. 玩家五线进化技能库 + 独立身法槽（全部 15 招）
     ========================================================= */
  const TACTICAL_SKILLS = {
    // —— 线 1：冰晶主炮线 ——
    ice_1_crystal: {
      id: 'ice_1_crystal',
      name: '冰晶术',
      line: 1,
      tier: 1,
      lineLabel: '冰晶主炮',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 26,
      cooldown: 0,
      power: 1.55,
      overcastCap: 0.60,
      lockDamage: 1,
      chill: 1,
      exposure: 55,
      canInterrupt: false,
      beats: 1,
      keyRule: 'random_1',
      beatSpec: SKILL_BEAT_SPEC_V32.ice_1_crystal,
      shortDesc: '1拍 · 破锁1 · 寒冷1',
      desc: '凝结澄澈无气泡冰晶直射目标，正面破防稳健并附带寒气侵蚀。',
    },
    ice_2_prism: {
      id: 'ice_2_prism',
      name: '三棱冰晶',
      line: 1,
      tier: 2,
      lineLabel: '冰晶主炮',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 36,
      cooldown: 0,
      power: 1.80,
      overcastCap: 0.60,
      lockDamage: 1,
      chill: 1,
      exposure: 62,
      canInterrupt: true,
      beats: 3,
      keyRule: 'same_3',
      beatSpec: SKILL_BEAT_SPEC_V32.ice_2_prism,
      shortDesc: '3拍同键 · 可断重术蓄势',
      desc: '折射出三棱晶簇连射压迫，抓住重术蓄势空档即可瞬断敌方咏唱。',
    },
    ice_3_starfrost: {
      id: 'ice_3_starfrost',
      name: '星霜散华',
      line: 1,
      tier: 3,
      lineLabel: '冰晶主炮',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 42,
      cooldown: 0,
      power: 2.02,
      overcastCap: 0.60,
      lockDamage: 1,
      chill: 2,
      exposure: 68,
      canInterrupt: true,
      innatePierce: 0.08,
      beats: 2,
      keyRule: 'diff_2',
      vfxIcicles: [2, 2],
      beatSpec: SKILL_BEAT_SPEC_V32.ice_3_starfrost,
      shortDesc: '2拍异键 · 寒冷2 · 穿抗8% · 断蓄势',
      desc: '四枚极寒晶锥化作星霜齐射，固有穿透法抗并打断重术蓄势。',
    },

    // —— 线 2：水系破局线 ——
    water_1_ball: {
      id: 'water_1_ball',
      name: '水球术',
      line: 2,
      tier: 1,
      lineLabel: '水系破局',
      path: 'HAND',
      elem: 'water',
      atkKind: 'matk',
      ap: 1,
      mp: 22,
      cooldown: 0,
      power: 1.38,
      overcastCap: 0.60,
      lockDamage: 1,
      douseFire: 1,
      clearBlind: true,
      exposure: 0,
      canInterrupt: false,
      beats: 1,
      keyRule: 'random_1',
      beatSpec: SKILL_BEAT_SPEC_V32.water_1_ball,
      shortDesc: '1拍 · 灭火灵1 · 净盲 · 零暴露',
      desc: '凝水成球迎面冲刷，熄灭火灵斗气并洗净扬尘遮眼，不留冰系外显痕迹。',
    },
    water_2_surge: {
      id: 'water_2_surge',
      name: '激流涌',
      line: 2,
      tier: 2,
      lineLabel: '水系破局',
      path: 'HAND',
      elem: 'water',
      atkKind: 'matk',
      ap: 1,
      mp: 30,
      cooldown: 0,
      power: 1.62,
      overcastCap: 0.60,
      lockDamage: 1,
      douseFire: 1,
      clearBlind: true,
      clearBurn: true,
      exposure: 0,
      canInterrupt: true,
      beats: 2,
      keyRule: 'diff_2',
      beatSpec: SKILL_BEAT_SPEC_V32.water_2_surge,
      shortDesc: '2拍异键 · 灭火净灼 · 断蓄势',
      desc: '两重急流交错奔涌，冲熄火灵并涤净自身灼烧与致盲，可截断重术蓄势。',
    },
    water_3_blade: {
      id: 'water_3_blade',
      name: '断水刃',
      line: 2,
      tier: 3,
      lineLabel: '水系破局',
      path: 'HAND',
      elem: 'water',
      atkKind: 'matk',
      ap: 1,
      mp: 36,
      cooldown: 0,
      power: 1.78,
      overcastCap: 0.60,
      lockDamage: 1,
      douseFire: 2,
      clearBlind: true,
      clearBurn: true,
      exposure: 0,
      canInterrupt: true,
      innatePierce: 0.25,
      pierceHalfShield: true,
      beats: 2,
      keyRule: 'diff_2',
      beatSpec: SKILL_BEAT_SPEC_V32.water_3_blade,
      shortDesc: '2拍异键 · 穿半盾 · 穿抗25% · 灭火2',
      desc: '极压水刃切开半数护盾并深入法抗裂隙，双层灭火涤净异常且可截断重术蓄势。',
    },

    // —— 线 3：霜域控场线 ——
    frost_1_step: {
      id: 'frost_1_step',
      name: '冰履',
      line: 3,
      tier: 1,
      lineLabel: '霜域控场',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 18,
      cooldown: 1,
      power: 0.85,
      overcastCap: 0.60,
      lockDamage: 1,
      aoe: true,
      sureHit: true,
      layFrostFloor: 2,
      chill: 1,
      exposure: 50,
      beats: 1,
      keyRule: 'random_1',
      beatSpec: SKILL_BEAT_SPEC_V32.frost_1_step,
      shortDesc: '1拍 · 全体必中 · 铺冰2回合',
      desc: '沿地表平铺一层薄冰覆盖敌阵，全体必中并令对手步履受阻。',
    },
    frost_2_breath: {
      id: 'frost_2_breath',
      name: '冰霜之息',
      line: 3,
      tier: 2,
      lineLabel: '霜域控场',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 34,
      cooldown: 1,
      power: 1.18,
      overcastCap: 0.60,
      lockDamage: 1,
      aoe: true,
      sureHit: true,
      layFrostFloor: 2,
      chill: 2,
      severSeep: true,
      drainWindMp: 15,
      stripEvade: 1,
      exposure: 58,
      beats: 1,
      keyRule: 'random_1',
      beatSpec: SKILL_BEAT_SPEC_V32.frost_2_breath,
      shortDesc: '1拍 · 冻绝暗流 · 吸风魔15 · 剥闪避',
      desc: '凛冽寒息席卷全场，彻底冻死脚底暗流并剥离风步闪避、削减敌方风魔。',
    },
    frost_3_thorns: {
      id: 'frost_3_thorns',
      name: '霜域棘阵',
      line: 3,
      tier: 3,
      lineLabel: '霜域控场',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 2,
      mp: 56,
      cooldown: 1,
      power: 1.56,
      overcastCap: 0.60,
      lockDamage: 1,
      aoe: true,
      sureHit: true,
      layFrostFloor: 2,
      chill: 2,
      severSeep: true,
      drainWindMp: 18,
      stripEvade: 1,
      breakStillness: true,
      exposure: 70,
      beats: 'alive_enemies',
      keyRule: 'per_target_impale',
      beatSpec: SKILL_BEAT_SPEC_V32.frost_3_thorns,
      shortDesc: '按存活敌数连拍 · 群攻必中 · 破风眼静滞',
      desc: '九向极寒冰棘破土齐发，覆盖全体目标并贯穿风暴眼圆心的无风静滞。',
    },

    // —— 线 4：冰盾护御线（0 拍瞬发） ——
    shield_1_ice: {
      id: 'shield_1_ice',
      name: '冰盾',
      line: 4,
      tier: 1,
      lineLabel: '冰盾护御',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 26,
      cooldown: 1,
      power: 0,
      overcastCap: 0.40,
      lockDamage: 0,
      shieldKind: 'solid',
      shieldBase: 32,
      shieldScale: 0.62,
      rooted: 1,
      thornsDmg: 0,
      crateGuardTiers: [0, 0, 0],
      clearDebuffOnAmp: false,
      exposure: 55,
      beats: 0,
      keyRule: 'instant_0',
      beatSpec: SKILL_BEAT_SPEC_V32.shield_1_ice,
      shortDesc: '0拍瞬发 · 实体冰盾 · 扎根防滑',
      desc: '掌前瞬凝厚实实体冰壁并令双足扎根防滑，可调配增幅强化护壁厚度。',
    },
    shield_2_mirror: {
      id: 'shield_2_mirror',
      name: '镜霜壁',
      line: 4,
      tier: 2,
      lineLabel: '冰盾护御',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 32,
      cooldown: 1,
      power: 0,
      overcastCap: 0.40,
      lockDamage: 0,
      shieldKind: 'solid',
      shieldBase: 38,
      shieldScale: 0.68,
      rooted: 1,
      thornsDmg: 12,
      iceThorns: 12,
      protectCrate: 24,
      crateGuardTiers: [24, 38, 56],
      clearDebuffOnAmp: true,
      exposure: 60,
      beats: 0,
      keyRule: 'instant_0',
      beatSpec: SKILL_BEAT_SPEC_V32.shield_2_mirror,
      shortDesc: '0拍瞬发 · 反刺12 · 护箱 · 增幅净异常',
      desc: '立起如镜霜壁扎根护身，受近身或重击时反刺并撕开反击空档，增幅可净异常。',
    },
    shield_3_steel: {
      id: 'shield_3_steel',
      name: '钢冰护幕',
      line: 4,
      tier: 3,
      lineLabel: '冰盾护御',
      path: 'HAND',
      elem: 'ice',
      atkKind: 'matk',
      ap: 1,
      mp: 36,
      cooldown: 1,
      power: 0,
      overcastCap: 0.40,
      lockDamage: 0,
      shieldKind: 'solid',
      shieldBase: 44,
      shieldScale: 0.74,
      rooted: 1,
      thornsDmg: 15,
      iceThorns: 15,
      protectCrate: 36,
      crateGuardTiers: [36, 55, 85],
      clearDebuff: true,
      fortressOnTier2: true,
      exposure: 62,
      beats: 0,
      keyRule: 'instant_0',
      beatSpec: SKILL_BEAT_SPEC_V32.shield_3_steel,
      shortDesc: '0拍瞬发 · 反刺15 · 全档净异常 · 二阶钢霜壁垒',
      desc: '魔力入地凝成高密度钢冰护幕，全档净化异常并庇护补给线，二阶增幅更启钢霜壁垒。',
    },

    // —— 线 5：近战导魔线 ——
    sword_1_basic: {
      id: 'sword_1_basic',
      name: '普通攻击',
      line: 5,
      tier: 1,
      lineLabel: '近战导魔',
      path: 'SWORD',
      elem: 'phys',
      atkKind: 'atk',
      ap: 1,
      mp: 0,
      cooldown: 0,
      power: 0.85,
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 0,
      mpRegenPct: 0.06,
      exposure: 0,
      beats: 0,
      keyRule: 'instant_0',
      beatSpec: SKILL_BEAT_SPEC_V32.sword_1_basic,
      shortDesc: '0拍瞬发 · 零耗蓝 · 立即回蓝6%',
      desc: '利落平斩不耗魔力，顺势导回一缕魔力并保持零外显波动。',
    },
    sword_2_cold_edge: {
      id: 'sword_2_cold_edge',
      name: '寒锋斩',
      line: 5,
      tier: 2,
      lineLabel: '近战导魔',
      path: 'SWORD',
      elem: 'water',
      atkKind: 'hybrid',
      ap: 1,
      mp: 12,
      cooldown: 0,
      power: 1.35,
      lungeRipostePower: 2.10,
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 1,
      counterLunge: true,
      rooted: 1,
      exposure: -12,
      allowZeroMpFallback: true,
      zeroMpFallbackPower: 0.85,
      zeroMpFallbackRegenPct: 0.06,
      beats: 1,
      keyRule: 'random_1',
      beatSpec: SKILL_BEAT_SPEC_V32.sword_2_cold_edge,
      shortDesc: '1拍 · 迎击突袭2.1× · 化水降暴露 · 零蓝兜底回蓝',
      desc: '沉膝迎锋送出覆水寒刃，专克贴身突袭与风暴眼连刃；魔力耗尽时仍可平斩导蓝。',
    },

    // —— 独立身法槽（0 拍瞬发） ——
    move_afterimage: {
      id: 'move_afterimage',
      name: '风行残像',
      line: 6,
      tier: 1,
      lineLabel: '风行身法',
      path: 'SWORD',
      elem: 'wind',
      atkKind: 'atk',
      ap: 1,
      mp: 18,
      cooldown: 3,
      power: 0,
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 0,
      afterimage: 1,
      nextApBonus: 1,
      selfAdvancePct: 0.25,
      exposure: 0,
      beats: 0,
      keyRule: 'instant_0',
      beatSpec: SKILL_BEAT_SPEC_V32.move_afterimage,
      shortDesc: '0拍瞬发 · 残像1 · 抢占先手 · 下回合+1 AP',
      desc: '借风向折射留下一道逼真残影，避开常规来袭并令下回合行动更加从容。',
    },
  };

  /* =========================================================
     2. 九幕代表性战斗关卡配置表（严格对齐成长时间线与阶位体系）
     ========================================================= */
  const STAGE_CONFIGS = {
    beatrice_11: {
      id: 'beatrice_11',
      order: 1,
      title: '贝阿特丽丝（11岁·虚拟决斗）',
      chapter: '第一卷 · 梦境初试（9岁）',
      stars: '★★☆☆☆',
      charId: 'beatrice',
      emoji: '🔥',
      bg: 'bg-duel',
      bgmType: 'duel',
      mainline: true,
      tags: ['水克火1.5x', '双层烈焰斗气', '融冰剑障防反'],
      summary: '初试梦境交锋！以水球术浇弱烈焰斗气并规避融冰剑障反劈，趁弱点击破顺势速决。',
      preset: {
        age: 9,
        rank: 2,
        hp: 165, mhp: 165, mp: 230, mmp: 230,
        atk: 14, matk: 35, def: 9, mdef: 12, spd: 100,
        skills: ['ice_1_crystal', 'water_1_ball', 'frost_1_step', 'shield_1_ice', 'sword_1_basic'],
        passives: [],
        manaCycle: false,
        eclipseWand: false,
      },
      reward: { duelKey: 'beatrice_11', skillId: 'temp_sense', skillName: '温度感知', exp: 50, gold: 0 },
      waves: [
        {
          intro: '贝阿特丽丝叉着腰掌心冒火：「来决斗？正好贝阿特丽丝大人手痒了，可不会手下留情哦！」',
          enemies: [
            {
              id: 'beatrice',
              charId: 'beatrice',
              name: '贝阿特丽丝（11岁）',
              rank: 2,
              emoji: '🔥',
              elem: 'fire',
              hp: 405,
              mhp: 405,
              shield: 0,
              shieldKind: 'magic',
              atk: 44,
              def: 11,
              mdef: 18,
              spd: 96,
              maxLocks: 4,
              fireAura: 2,
              noBlockPrompt: false,
              trait: '双层烈焰斗气：每层减免10%伤害并逐回合升温；受水球术浇弱，剑障防反时忌盲丢冰晶。',
              aiType: 'beatrice',
            },
          ],
        },
      ],
    },

    rowan_graveyard: {
      id: 'rowan_graveyard',
      order: 2,
      title: '罗文（8岁间章·乱葬岗活捉战）',
      chapter: '第一卷 · 间章《白昼里的夜》',
      stars: '★★★★☆',
      crestKind: 'rowan',
      emoji: '🌑',
      bg: 'bg-img-night bg-night',
      bgmType: 'battle',
      mainline: true,
      tags: ['8岁童年配装', '王级雷纳德主攻', '冰履岩棱合围', '冰盾拦飞旋掷杖'],
      summary: '王级雷纳德立于前排以火土风三系压制强敌，你须在后排以冰履铺场配合岩棱合围，并在飞旋掷杖袭心回合立起冰盾反制活捉。',
      sealRule: true,
      allies: [
        {
          id: 'reno',
          name: '雷纳德',
          title: '前排主力',
          rank: 5,
          spriteId: 'reno',
          role: 'vanguard',
          slot: 4,
          hp: 560,
          mhp: 560,
          atk: 62,
          matk: 82,
          def: 34,
          mdef: 38,
          spd: 118,
          shield: 45,
          maxShield: 160,
          shieldKind: 'solid',
          tauntFront: true,
          coverPlayerMitigate: 0.45,
          elements: ['fire', 'earth', 'wind'],
        },
      ],
      preset: {
        age: 8,
        rank: 2,
        hp: 155, mhp: 155, mp: 240, mmp: 240,
        atk: 12, matk: 34, def: 8, mdef: 12, spd: 96,
        skills: ['ice_1_crystal', 'water_1_ball', 'frost_1_step', 'shield_1_ice', 'sword_1_basic'],
        passives: [],
        manaCycle: false,
        eclipseWand: false,
      },
      reward: { exp: 140, gold: 0 },
      waves: [
        {
          intro: '雷纳德从歪脖子树跳下挡在你身前：「别当着家长的面打小孩。」前排交由雷纳德主攻压制，留意绕后黑光与飞旋掷杖，立冰盾自保并铺冰履合围活捉！',
          enemies: [
            {
              id: 'rowan',
              name: '罗文（圣级血族侍卫）',
              rank: 4,
              emoji: '🌑',
              elem: 'dark',
              hp: 1460,
              mhp: 1460,
              shield: 85,
              shieldKind: 'magic',
              atk: 58,
              def: 24,
              mdef: 28,
              spd: 114,
              maxLocks: 5,
              noBlockPrompt: false,
              trait: '圣级刺客：正面交锋由雷纳德承担，绕后晦轮黑光与飞旋掷杖直袭后排；立冰盾可阻尼并截停旋杖，铺冰履可配合岩棱大幅推进活捉。',
              aiType: 'rowan',
            },
          ],
        },
      ],
    },

    alice_9: {
      id: 'alice_9',
      order: 3,
      title: '爱丽丝（9岁·虚拟决斗）',
      chapter: '第一卷 · 风与羽毛（11岁）',
      stars: '★★★☆☆',
      charId: 'alice',
      emoji: '💨',
      bg: 'bg-duel',
      bgmType: 'duel',
      mainline: true,
      tags: ['扬尘净盲', '冰霜之息榨风魔', '第四回合狂岚检定'],
      summary: '扬尘遮眼叠加双层风步闪避！先以水球术涤净视线，连发冰霜之息剥闪榨魔，令她第四回合狂躁风暴魔力枯竭溃散。',
      preset: {
        age: 11,
        rank: 2,
        hp: 170, mhp: 170, mp: 275, mmp: 275,
        atk: 15, matk: 38, def: 10, mdef: 14, spd: 102,
        skills: ['ice_1_crystal', 'water_1_ball', 'frost_2_breath', 'shield_1_ice', 'sword_1_basic'],
        passives: ['temp_sense'],
        manaCycle: false,
        eclipseWand: false,
      },
      reward: { duelKey: 'alice_9', skillId: 'wind_afterimage', skillName: '风行残像', exp: 75, gold: 0 },
      waves: [
        {
          intro: '爱丽丝安静站定：「……请姐姐大人多多指教。」微风在她周身凝成两层轻羽护流。',
          enemies: [
            {
              id: 'alice',
              charId: 'alice',
              name: '爱丽丝（9岁）',
              rank: 2,
              emoji: '💨',
              elem: 'wind',
              hp: 520,
              mhp: 520,
              mp: 84,
              mmp: 84,
              shield: 0,
              shieldKind: 'magic',
              windCushion: true,
              evadeCharges: 2,
              maxEvadeCharges: 2,
              atk: 38,
              def: 10,
              mdef: 18,
              spd: 122,
              maxLocks: 4,
              noBlockPrompt: false,
              trait: '微风护体：风垫缓冲并维持风步闪避，冰霜之息可榨取风魔并令冰面限制闪避回复；狂岚蓄力若魔力不足即溃散认输。',
              aiType: 'alice',
            },
          ],
        },
      ],
    },

    aino_sparring: {
      id: 'aino_sparring',
      order: 4,
      title: '艾诺·塔尔维（冰上之战·三击制）',
      chapter: '第二卷 · 第四章 距离（12岁）',
      stars: '★★★★☆',
      charId: 'aino',
      emoji: '🧊',
      bg: 'bg-img-training bg-plain',
      bgmType: 'duel',
      mainline: true,
      tags: ['三击定胜负', '七回合限时', '镜霜壁反刺开窗', '三棱冰晶断蓄势'],
      summary: '纯冰系切磋，七回合内抢满三次有效命中方能取胜！以三棱冰晶截断重术蓄势，或借镜霜壁反刺撕开正面镜冰空档。',
      hitRule: true,
      targetHits: 3,
      turnLimit: 7,
      iceOnlyRule: true,
      preset: {
        age: 12,
        rank: 2,
        hp: 185, mhp: 185, mp: 285, mmp: 285,
        atk: 18, matk: 44, def: 12, mdef: 16, spd: 105,
        skills: ['ice_2_prism', 'frost_2_breath', 'shield_2_mirror', 'sword_1_basic', 'move_afterimage'],
        passives: ['temp_sense'],
        manaCycle: false,
        eclipseWand: false,
      },
      reward: { duelKey: 'aino_cur', skillId: 'root_ice', skillName: '生根之冰', taskId: 'ice_hits', exp: 120, gold: 0 },
      waves: [
        {
          intro: '艾诺：「规则简单。只用冰系魔法，七回合内打中三次算赢。战斗可不会给你片刻准备时间。」',
          enemies: [
            {
              id: 'aino',
              charId: 'aino',
              name: '艾诺·塔尔维',
              rank: 3,
              emoji: '🧊',
              elem: 'ice',
              hp: 999,
              mhp: 999,
              nonLethalSpar: true,
              shield: 0,
              shieldKind: 'solid',
              atk: 48,
              def: 16,
              mdef: 20,
              spd: 116,
              maxLocks: 3,
              mirrorGuard: true,
              noBlockPrompt: false,
              trait: '无瑕镜冰：常态正面拦截普通攻势；抓住寒脉蓄势空档以三棱冰晶截断，或用镜霜壁反刺开窗后追击记作有效命中。',
              aiType: 'aino',
            },
          ],
        },
      ],
    },

    noelle_14: {
      id: 'noelle_14',
      order: 5,
      title: '诺艾儿（14岁·虚拟决斗）',
      chapter: '第二卷 · 第八章 冰融之际',
      stars: '★★★★☆',
      charId: 'noelle',
      emoji: '💧',
      bg: 'bg-duel',
      bgmType: 'duel',
      mainline: true,
      tags: ['魔战循环解锁', '尺量水幕', '冰霜之息冻绝暗流'],
      summary: '魔战循环首秀！诺艾儿每回合精算布设水幕，半血以下潜入脚底暗流陷阱，施展冰霜之息即可彻底冻绝暗流并碎盾反攻。',
      preset: {
        age: 14,
        rank: 3,
        hp: 215, mhp: 215, mp: 300, mmp: 300,
        atk: 22, matk: 48, def: 14, mdef: 20, spd: 106,
        skills: ['ice_2_prism', 'water_2_surge', 'frost_2_breath', 'shield_2_mirror', 'sword_1_basic', 'move_afterimage'],
        passives: ['temp_sense', 'root_ice'],
        manaCycle: true,
        eclipseWand: false,
      },
      reward: { duelKey: 'noelle_14', skillId: 'mana_calc', skillName: '魔力精算', achId: 'mana_calc', exp: 150, gold: 0 },
      waves: [
        {
          intro: '诺艾儿站在数步之外，每一滴魔力都当最后一滴用。借魔战循环以战养战，并提防脚下冰缝的暗流！',
          enemies: [
            {
              id: 'noelle',
              charId: 'noelle',
              name: '诺艾儿（14岁）',
              rank: 3,
              emoji: '💧',
              elem: 'water',
              hp: 1040,
              mhp: 1040,
              mp: 220,
              mmp: 220,
              shield: 38,
              shieldKind: 'magic',
              atk: 122,
              def: 18,
              mdef: 24,
              spd: 104,
              maxLocks: 5,
              boss: true,
              seepStacks: 0,
              noBlockPrompt: false,
              trait: '尺量水幕与冰缝暗流：每回合精算重整水幕；血量或魔力跌破半数即布设脚底暗流陷阱，宜用冰霜之息冻绝暗流并碎盾。',
              aiType: 'noelle',
            },
          ],
        },
      ],
    },

    north_forest_hunt: {
      id: 'north_forest_hunt',
      order: 6,
      title: '北林群狼 + 霜脊影豺突袭（连续波次）',
      chapter: '第三卷 · 第三章 北林（15岁）',
      stars: '★★★★☆',
      emoji: '🐺',
      bg: 'bg-img-forest bg-forest',
      bgmType: 'battle',
      mainline: true,
      bossWaveRetry: true,
      tags: ['双波连战', '群狼霜域清场', '耳目禁冰暴露', '寒锋斩迎击影豺'],
      summary: '前波四只灰棘狼合围扑近，以霜域棘阵极速清场并借魔战循环汲满魔力；后波耳目迫近，改以寒锋斩迎击锁喉与断水刃收割影豺。',
      preset: {
        age: 15,
        rank: 3,
        hp: 235, mhp: 235, mp: 315, mmp: 315,
        atk: 42, matk: 50, def: 17, mdef: 23, spd: 110,
        skills: ['ice_3_starfrost', 'water_3_blade', 'frost_3_thorns', 'shield_3_steel', 'sword_2_cold_edge', 'move_afterimage'],
        passives: ['temp_sense', 'root_ice', 'mana_calc'],
        manaCycle: true,
        eclipseWand: true,
      },
      reward: { skillId: 'stealth_edge', skillName: '覆水无痕', exp: 180, gold: 35 },
      waves: [
        {
          witnessActive: false,
          intro: '【第一波 · 无人深林】四只灰棘狼呈扇形扑来！四周无人，立即以霜域棘阵清场并借魔战循环蓄满魔力！',
          enemies: [
            { id: 'wolf_alpha', name: '灰棘头狼', rank: 2, emoji: '🐺', elem: 'wind', hp: 186, mhp: 186, shield: 12, shieldKind: 'solid', atk: 26, def: 11, mdef: 11, spd: 108, maxLocks: 4, noBlockPrompt: true, trait: '群狼头领：仰首群嚎鼓舞狼群攻势，群攻霜域可迅速击溃。', aiType: 'pack_wolf' },
            { id: 'wolf_b', name: '灰棘狼·甲', rank: 1, emoji: '🐺', elem: 'wind', hp: 144, mhp: 144, shield: 0, shieldKind: 'solid', atk: 20, def: 8, mdef: 8, spd: 102, maxLocks: 2, noBlockPrompt: true, trait: '迅捷合围：集群行动但防线脆弱。', aiType: 'pack_wolf' },
            { id: 'wolf_c', name: '灰棘狼·乙', rank: 1, emoji: '🐺', elem: 'wind', hp: 144, mhp: 144, shield: 0, shieldKind: 'solid', atk: 20, def: 8, mdef: 8, spd: 102, maxLocks: 2, noBlockPrompt: true, trait: '迅捷合围：集群行动但防线脆弱。', aiType: 'pack_wolf' },
            { id: 'wolf_d', name: '灰棘狼·丙', rank: 1, emoji: '🐺', elem: 'wind', hp: 144, mhp: 144, shield: 0, shieldKind: 'solid', atk: 20, def: 8, mdef: 8, spd: 102, maxLocks: 2, noBlockPrompt: true, trait: '迅捷合围：集群行动但防线脆弱。', aiType: 'pack_wolf' },
          ],
        },
        {
          witnessActive: true,
          initialExposure: 35,
          intro: '⚠️【第二波 · 耳目迫近】银级「霜脊影豺」突袭！林外冒险小队正在勘察——慎用外显冰系与晦轮杖，以寒锋斩迎击锁喉、断水刃穿盾制胜！',
          enemies: [
            {
              id: 'shadow_jackal',
              name: '霜脊影豺（银级）',
              rank: 3,
              emoji: '🦊',
              elem: 'ice',
              hp: 1240,
              mhp: 1240,
              shield: 52,
              shieldKind: 'magic',
              evadeCharges: 1,
              maxEvadeCharges: 1,
              atk: 108,
              def: 24,
              mdef: 36,
              spd: 124,
              maxLocks: 5,
              noBlockPrompt: false,
              trait: '疾影锁喉：常备闪避层规避鲁莽直击；以寒锋斩迎击锁喉扑杀可卸力破闪并化水降低暴露。',
              aiType: 'jackal',
            },
          ],
        },
      ],
    },

    hulan_beast_tide: {
      id: 'hulan_beast_tide',
      order: 7,
      title: '赫兰冰封峡谷·冻土兽潮协防战',
      chapter: '第三卷 · 第四章 奔赴北境',
      stars: '★★★★★',
      crestKind: 'abyss_behemoth',
      emoji: '🏔️',
      bg: 'bg-snow',
      bgmType: 'battle',
      bgmKey: 'battle1',
      wave2BgmKey: 'battle2',
      mainline: true,
      bossWaveRetry: true,
      crateRule: true,
      ainoSupport: true,
      tags: ['守护医疗药箱', '钢冰护幕钢霜壁垒', '艾诺双矛破核', '双波连战'],
      summary: '冻土兽潮猛冲补给线！以二阶增幅钢冰护幕筑起钢霜壁垒护箱共鸣，配合星霜散华与断水刃截断双臂聚寒，引落崖顶艾诺双矛震碎领主晶核。',
      preset: {
        age: 16,
        rank: 3,
        hp: 255, mhp: 255, mp: 330, mmp: 330,
        atk: 46, matk: 55, def: 19, mdef: 26, spd: 110,
        skills: ['ice_3_starfrost', 'water_3_blade', 'frost_3_thorns', 'shield_3_steel', 'sword_2_cold_edge', 'move_afterimage'],
        passives: ['temp_sense', 'root_ice', 'mana_calc'],
        manaCycle: true,
        eclipseWand: true,
      },
      reward: { achId: 'hulan_vanguard', exp: 260, gold: 80 },
      waves: [
        {
          witnessActive: false,
          intro: '【第一波 · 峡谷防线】冻土重甲兽携霜原狂狼扑向医疗药箱！以霜域清狼并抓紧截断重甲兽蓄力，稳妥护住补给药箱！',
          enemies: [
            { id: 'tundra_brute', name: '冻土重甲兽', rank: 3, emoji: '🐗', elem: 'earth', hp: 262, mhp: 262, shield: 42, shieldKind: 'solid', solidArmor: 0.30, atk: 84, def: 30, mdef: 26, spd: 84, maxLocks: 4, noBlockPrompt: false, trait: '实体重甲：具30%实体甲阻尼并撞击药箱，以星霜散华或断水刃截断聚甲即可稳妥化解。', aiType: 'hulan_brute' },
            { id: 'frost_hound_a', name: '霜原狂狼·甲', rank: 2, emoji: '🐺', elem: 'ice', hp: 146, mhp: 146, shield: 0, shieldKind: 'solid', atk: 32, def: 10, mdef: 12, spd: 106, maxLocks: 2, noBlockPrompt: true, trait: '成群撕咬：群攻破阵可顺势回蓝。', aiType: 'pack_wolf' },
            { id: 'frost_hound_b', name: '霜原狂狼·乙', rank: 2, emoji: '🐺', elem: 'ice', hp: 146, mhp: 146, shield: 0, shieldKind: 'solid', atk: 32, def: 10, mdef: 12, spd: 106, maxLocks: 2, noBlockPrompt: true, trait: '成群撕咬：群攻破阵可顺势回蓝。', aiType: 'pack_wolf' },
          ],
        },
        {
          witnessActive: false,
          intro: '❄️【第二波 · 领主降临 & 故人冰枪】霜渊裂地兽破冰而出！截断双臂聚寒或以二阶钢冰护幕叠起共鸣，引落两道艾诺冰枪贯通晶核破甲！',
          enemies: [
            {
              id: 'abyss_behemoth',
              name: '霜渊裂地兽（领主）',
              rank: 4,
              emoji: '🗿',
              elem: 'earth',
              hp: 1065,
              mhp: 1065,
              shield: 98,
              shieldKind: 'solid',
              solidArmor: 0.35,
              atk: 142,
              def: 38,
              mdef: 36,
              spd: 88,
              maxLocks: 5,
              boss: true,
              noBlockPrompt: false,
              trait: '冻土领主：晶核未碎前具35%实体甲并寒震药箱；断双臂聚寒获+2共鸣、二阶钢冰护幕获+1共鸣，两道艾诺冰枪即可彻底震碎晶核！',
              aiType: 'hulan_lord',
            },
            {
              id: 'ridge_claw',
              name: '寒脊爪兽',
              rank: 2,
              emoji: '🦎',
              elem: 'wind',
              hp: 165,
              mhp: 165,
              shield: 0,
              shieldKind: 'solid',
              atk: 44,
              def: 12,
              mdef: 14,
              spd: 118,
              maxLocks: 2,
              noBlockPrompt: true,
              trait: '侧翼袭扰：高速突袭补给防线。',
              aiType: 'jackal_minor',
            },
          ],
        },
      ],
    },

    turning_point_corridor: {
      id: 'turning_point_corridor',
      order: 8,
      title: '转折点·东翼火廊突围战',
      chapter: '第二卷 · 终章 转折点（14岁）',
      stars: '★★★★★',
      crestKind: 'eastwing',
      emoji: '🔥',
      bg: 'bg-img-hallway bg-battle',
      bgmType: 'battle',
      bgmKey: 'battle1',
      phase2BgmKey: 'battle2',
      mainline: true,
      bossWaveRetry: true,
      tags: ['14岁东翼突围', '红莲铁幕二阶段', '水克火断锁火', '晦轮杖穿魔盾'],
      summary: '政变火夜东翼长廊！前波速破守卫与赤炎术士夹击；后波面对红莲铁幕半血觉醒变阵，以激流涌克火截断封廊锁火并适时催动晦轮杖穿透魔盾。',
      preset: {
        age: 14,
        rank: 3,
        hp: 225, mhp: 225, mp: 305, mmp: 305,
        atk: 24, matk: 52, def: 16, mdef: 22, spd: 108,
        skills: ['ice_2_prism', 'water_2_surge', 'frost_2_breath', 'shield_2_mirror', 'sword_1_basic', 'move_afterimage'],
        passives: ['temp_sense', 'root_ice', 'mana_calc'],
        manaCycle: true,
        eclipseWand: true,
      },
      reward: { exp: 280, gold: 90 },
      waves: [
        {
          witnessActive: false,
          intro: '【第一波 · 东翼突围】宫廷突击队长与赤炎术士封住了长廊！先断术士火墙咏唱并速破双守卫夹击！',
          enemies: [
            {
              id: 'corridor_vanguard',
              name: '宫廷突击队长',
              rank: 3,
              crestKind: 'inquisitor',
              emoji: '🛡️',
              elem: 'phys',
              hp: 270,
              mhp: 270,
              shield: 34,
              shieldKind: 'solid',
              atk: 72,
              def: 20,
              mdef: 18,
              spd: 94,
              maxLocks: 3,
              noBlockPrompt: false,
              trait: '宫廷重戟：交替发动长戟突刺与重盾护阵。',
              aiType: 'corridor_vanguard',
            },
            {
              id: 'flame_mage_a',
              name: '赤炎术士',
              rank: 2,
              crestKind: 'inquisitor',
              emoji: '🔥',
              elem: 'fire',
              hp: 205,
              mhp: 205,
              shield: 22,
              shieldKind: 'magic',
              atk: 76,
              def: 14,
              mdef: 18,
              spd: 102,
              maxLocks: 3,
              noBlockPrompt: false,
              trait: '走廊纵火：炎印蓄势燃起火墙并附加灼烧，宜用激流涌截断并净灼。',
              aiType: 'flame_mage',
            },
          ],
        },
        {
          witnessActive: false,
          intro: '🔥【第二波 · 红莲铁幕】东翼封锁官横戟拦路！半血将觉醒变阵展开红莲铁幕，以激流涌克火截断封廊锁火，巧用晦轮杖穿破魔法火盾！',
          enemies: [
            {
              id: 'eastwing_commander',
              name: '东翼封锁官·「红莲铁幕」',
              rank: 4,
              crestKind: 'eastwing',
              emoji: '⚔️',
              elem: 'fire',
              hp: 1950,
              mhp: 1950,
              shield: 98,
              shieldKind: 'magic',
              atk: 130,
              def: 26,
              mdef: 30,
              spd: 108,
              maxLocks: 6,
              fireAura: 2,
              boss: true,
              phase: 1,
              phase2HpPct: 0.50,
              noBlockPrompt: false,
              trait: '红莲铁幕：半血觉醒蓄能并重整魔法火盾，二阶段交替施放必断危招封廊锁火与穿半盾破阵冲锋。',
              aiType: 'eastwing_boss',
            },
          ],
        },
      ],
    },

    wind_god_eye: {
      id: 'wind_god_eye',
      order: 9,
      title: '风神·岚（演武大厅专属·神级试剑）',
      chapter: '演武特别试炼 · 岚之试剑',
      stars: '★★★★★',
      charId: 'fengshen',
      crestKind: 'wind_god',
      emoji: '🌪️',
      bg: 'bg-img-training bg-battle',
      bgmType: 'battle',
      bgmKey: 'battle1',
      phase2BgmKey: 'boss_finale',
      mainline: false,
      arenaTestOnly: true,
      godTierChallenge: true,
      tags: ['演武专属', '真神级7阶', '寒锋斩斩风瞬反', '霜域破风眼静滞'],
      summary: '直面七大列强「风神·岚」的真神级七阶极限试剑！未破壁前外圈风壁大幅减伤，二阶段须以寒锋斩迎击真空连刃、以霜域棘阵或二阶增幅击破风眼静滞。',
      preset: {
        age: 16,
        rank: 3,
        hp: 255, mhp: 255, mp: 330, mmp: 330,
        atk: 48, matk: 56, def: 19, mdef: 26, spd: 112,
        skills: ['ice_3_starfrost', 'water_3_blade', 'frost_3_thorns', 'shield_3_steel', 'sword_2_cold_edge', 'move_afterimage'],
        passives: ['temp_sense', 'root_ice', 'mana_calc', 'frost_edge'],
        manaCycle: true,
        eclipseWand: false,
      },
      reward: { exp: 340, gold: 120 },
      waves: [
        {
          witnessActive: false,
          intro: '🌪️【真神级试剑 · 风神·岚】「既然妹妹把你夸得天花乱坠，便让我亲手试一试你的剑步与冰霜。」注意：外圈风壁大幅削弱盲攻，须善用寒锋斩迎击真空连刃、霜域棘阵破除风眼静滞！',
          enemies: [
            {
              id: 'wind_god_avatar',
              charId: 'fengshen',
              crestKind: 'wind_god',
              name: '风神·岚「风暴眼试剑」',
              rank: 7,
              emoji: '🌪️',
              elem: 'wind',
              hp: 2810,
              mhp: 2810,
              shield: 210,
              shieldKind: 'magic',
              evadeCharges: 1,
              maxEvadeCharges: 1,
              atk: 156,
              def: 46,
              mdef: 56,
              spd: 160,
              maxLocks: 7,
              boss: true,
              phase: 1,
              phase2HpPct: 0.55,
              noBlockPrompt: false,
              trait: '真神级七阶：先手疾风压境，外圈风壁偏折盲攻；过半血量觉醒全开风暴眼，寒锋斩可迎击真空连刃触发斩风瞬反，霜域棘阵或二阶以上增幅可破风眼静滞。',
              aiType: 'wind_god_boss',
            },
          ],
        },
      ],
    },
  };
  /* =========================================================
     3. 存档读取辅助、四大铭记套装共鸣与独立演武隔离
     ========================================================= */
  let arenaUseSaveStats = false;
  let arenaReturnToTitle = false;
  let hoveredSkillId = null;
  let armedSkillId = null;

  const RELIC_ALIASES = {
    aino_academy_handkerchief: ['aino_academy_handkerchief', 'snow_handkerchief'],
    snow_handkerchief: ['aino_academy_handkerchief', 'snow_handkerchief'],
    frost_cipher: ['frost_cipher', 'frost_seal_mark'],
    frost_seal_mark: ['frost_cipher', 'frost_seal_mark'],
    ice_pebble: ['ice_pebble', 'ice_blue_pebble'],
    ice_blue_pebble: ['ice_pebble', 'ice_blue_pebble'],
  };

  const FALLBACK_SYNERGY_SETS = [
    {
      id: 'dukedom_memory',
      name: '公爵府遗忆',
      members: ['ice_pebble', 'blue_vial', 'alice_flower_cake'],
      tiers: {
        2: '首回合额外 +1 AP 与 +10 护盾',
        3: '首回合 +1 AP 与 +10 护盾；每回合首次水/冰技回复 10% 最大 MP，首次护盾技赠 1 层风行残像',
      },
    },
    {
      id: 'academy_stars',
      name: '学院星辉',
      members: ['noelle_manuscript', 'belmont_schedule', 'cross', 'shell_pin'],
      tiers: {
        2: '截断破招或弱点击破回复 12% 最大 MP，截断额外削减 1 层破防锁',
        3: '基础蓝耗 0.85×（受 0.60× 省蓝下限约束），暴击威势 +10%（上限 1.70×），破招击破回蓝 12%',
      },
    },
    {
      id: 'jikan_blade',
      name: '霁馆剑心',
      members: ['ebony_sword', 'frost_cipher'],
      tiers: {
        2: '剑技迎锋或破招时魔战回蓝翻倍，剑技暴击或破招每回合限 1 次 +1 AP',
      },
    },
    {
      id: 'north_frost',
      name: '北境霜锋',
      members: ['aino_academy_handkerchief', 'aino_frost_shard', 'northwind_pass'],
      tiers: {
        2: '每回合开始获得 +10 护盾，冰系攻击穿透 15% 法抗',
        3: '每回合初 +10 护盾且冰系穿抗 15%；每回合首次冰晶或霜域技附加 2 层寒颤并获 +5% 相加增伤',
      },
    },
  ];

  function getFallbackSynergyMeta(setId) {
    return FALLBACK_SYNERGY_SETS.find(s => s.id === setId) || null;
  }

  function resolveActiveSynergies(relicIds) {
    const equipped = Array.isArray(relicIds) ? relicIds : [];
    const relApi = getRelicsApi();
    const synergies = [];
    const synergyMap = {};

    if (relApi && typeof relApi.getActiveSynergies === 'function') {
      try {
        const rawRes = relApi.getActiveSynergies(equipped);
        const list = Array.isArray(rawRes) ? rawRes : (rawRes && Array.isArray(rawRes.active) ? rawRes.active : []);
        list.forEach(item => {
          if (!item || item.active === false) return;
          const setId = item.id || item.setId;
          if (!setId) return;
          const rawTier = Number(item.tier || item.activeTier || item.count || item.matchedCount || 0);
          if (rawTier < 2) return;
          const fb = getFallbackSynergyMeta(setId);
          const effectiveTier = rawTier >= 3 && (!fb || fb.tiers[3]) ? 3 : 2;
          const desc = (fb && (fb.tiers[effectiveTier] || fb.tiers[2])) || item.shortDesc || item.activeDesc || item.desc || item.effectText || '';
          const norm = Object.assign({}, item, {
            id: setId,
            setId,
            name: item.name || (fb ? fb.name : setId),
            count: Number(item.count || rawTier),
            tier: effectiveTier,
            desc,
          });
          synergies.push(norm);
          synergyMap[setId] = Math.max(synergyMap[setId] || 0, effectiveTier);
        });
        if (equipped.indexOf('academy_star_3pc') !== -1 && (synergyMap.academy_stars || 0) < 3) {
          synergyMap.academy_stars = 3;
        }
        if (equipped.indexOf('north_frost_3pc') !== -1 && (synergyMap.north_frost || 0) < 3) {
          synergyMap.north_frost = 3;
        }
        return { synergies, synergyMap };
      } catch (e) {}
    }

    FALLBACK_SYNERGY_SETS.forEach(setDef => {
      const count = setDef.members.filter(id => {
        const keys = RELIC_ALIASES[id] || [id];
        return keys.some(k => equipped.indexOf(k) !== -1);
      }).length;
      if (count >= 2) {
        const tier = (count >= 3 && setDef.tiers[3]) ? 3 : 2;
        synergies.push({
          id: setDef.id,
          setId: setDef.id,
          name: setDef.name,
          count,
          tier,
          desc: setDef.tiers[tier] || setDef.tiers[2] || '',
        });
        synergyMap[setDef.id] = tier;
      }
    });
    if (equipped.indexOf('academy_star_3pc') !== -1 && (synergyMap.academy_stars || 0) < 3) {
      synergyMap.academy_stars = 3;
    }
    if (equipped.indexOf('north_frost_3pc') !== -1 && (synergyMap.north_frost || 0) < 3) {
      synergyMap.north_frost = 3;
    }
    return { synergies, synergyMap };
  }

  function getSynergyTier(player, setId) {
    return (player && player.synergyMap && player.synergyMap[setId]) || 0;
  }

  function getEquippedStaffDef(player) {
    const id = (player && player.wandActive) ? 'eclipse_wand' : ((player && player.equippedStaff) || 'none');
    return COMBAT_BALANCE_V32.STAVES[id] || COMBAT_BALANCE_V32.STAVES.none;
  }

  function getPlayerCritMult(player) {
    let mult = COMBAT_BALANCE_V32.critBaseMult;
    const staff = getEquippedStaffDef(player);
    if (staff && staff.critDmgBonus > 0) mult += staff.critDmgBonus;
    if (getSynergyTier(player, 'academy_stars') >= 3 || hasRelic(player, 'academy_star_3pc')) {
      mult += 0.10;
    }
    return Math.min(COMBAT_BALANCE_V32.critMaxMult, Number(mult.toFixed(4)));
  }

  function getGameS() {
    return (typeof S !== 'undefined' && S) ? S : global.S;
  }
  function getPortraitMap() {
    return (typeof PORTRAIT_FILES !== 'undefined' && PORTRAIT_FILES) ? PORTRAIT_FILES : global.PORTRAIT_FILES;
  }
  function getCharMap() {
    return (typeof CHARS !== 'undefined' && CHARS) ? CHARS : global.CHARS;
  }
  function getEnemyTplMap() {
    return (typeof ENEMY_TEMPLATES !== 'undefined' && ENEMY_TEMPLATES) ? ENEMY_TEMPLATES : global.ENEMY_TEMPLATES;
  }

  function loadArenaRecords() {
    try {
      return JSON.parse(localStorage.getItem(ARENA_SAVE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveArenaRecord(stageId, grade, turns, casualMode) {
    const rankOrder = { S: 4, A: 3, B: 2, C: 1 };
    const rec = loadArenaRecords();
    const prev = rec[stageId];
    const isBetter = !prev
      || (rankOrder[grade] || 0) > (rankOrder[prev.grade] || 0)
      || (prev.grade === grade && turns < prev.turns)
      || (prev.grade === grade && !!prev.casualMode && !casualMode);
    if (isBetter) {
      rec[stageId] = { grade, turns, casualMode: !!casualMode, ts: Date.now() };
      try { localStorage.setItem(ARENA_SAVE_KEY, JSON.stringify(rec)); } catch (e) {}
    }
  }

  function hasEclipseInSave() {
    const curS = getGameS();
    if (!curS) return false;
    return !!(
      (curS.inv || []).some(it => it.id === 'eclipse_wand' || (it.name && it.name.includes('晦轮'))) ||
      (curS.flags && curS.flags.got_eclipse_wand)
    );
  }

  function getRelicsApi() {
    return (typeof RelicsAndEvents !== 'undefined' && RelicsAndEvents) ? RelicsAndEvents : global.RelicsAndEvents || null;
  }

  function getItemArtApi() {
    return (typeof window !== 'undefined' && window.ItemArtRegistry)
      || (typeof ItemArtRegistry !== 'undefined' && ItemArtRegistry)
      || global.ItemArtRegistry
      || null;
  }

  function renderWandArtIcon() {
    const art = getItemArtApi();
    if (art && typeof art.renderIconHTML === 'function') {
      const html = art.renderIconHTML('eclipse_wand', { size: 18, cls: 'cb-wand-art', decorative: true, eager: true });
      if (html) return html;
    }
    return CB_SVG.wand;
  }

  function renderRelicMicroArt(itemId) {
    const art = getItemArtApi();
    if (art && typeof art.renderIconHTML === 'function') {
      if (typeof art.hasArt === 'function' && !art.hasArt(itemId)) return '';
      return art.renderIconHTML(itemId, { size: 16, cls: 'cb-relic-micro-art', decorative: true, eager: true }) || '';
    }
    return '';
  }

  function hasRelic(player, relicId) {
    if (!player || !Array.isArray(player.relics) || !relicId) return false;
    const keys = RELIC_ALIASES[relicId] || [relicId];
    for (let i = 0; i < keys.length; i++) {
      if (player.relics.indexOf(keys[i]) !== -1) return true;
    }
    return false;
  }

  function computeBaseAv(spd) {
    const safeSpd = Math.max(40, Number(spd) || 100);
    return Math.round(COMBAT_BALANCE_V32.HSR_AV.baseNumerator / safeSpd);
  }

  function resolveAgeFloorV3(age) {
    const a = Number(age) || 9;
    const table = COMBAT_BALANCE_V32.AGE_FLOOR_V3;
    const keys = [7, 8, 9, 11, 12, 14, 15, 16];
    let picked = 7;
    for (let i = 0; i < keys.length; i++) {
      if (a >= keys[i]) picked = keys[i];
    }
    return table[picked] || table[9];
  }

  function applyRatioTanhCap(rawVal, baseVal, key) {
    const cfg = COMBAT_BALANCE_V32.SOFT_CAP_RATIOS[key] || { gain: 0.24, scale: 0.95, floor: 0.92 };
    const bVal = Math.max(1, Number(baseVal) || 1);
    const rVal = Number(rawVal) || 0;
    if (rVal <= bVal) {
      return Math.round(Math.max(bVal * cfg.floor, rVal));
    }
    const gain = bVal * cfg.gain;
    const scale = Math.max(6.0, bVal * cfg.scale);
    return Math.round(bVal + gain * Math.tanh((rVal - bVal) / scale));
  }

  function buildEvolvedSkillDeckForSave(age, curS, learned, stageCfg) {
    const phase = (curS && curS.phase) || '';
    const isLate = age >= 15 || phase === 'journey' || phase === 'finale';
    const isMid = age >= 12 || phase === 'academy';
    const isCorridor14 = !!(stageCfg && stageCfg.id === 'turning_point_corridor');
    const iceOnly = !!(stageCfg && stageCfg.iceOnlyRule);

    const deck = [];
    // 线 1：冰晶主炮线
    if (isLate && !isCorridor14) deck.push('ice_3_starfrost');
    else if (isMid || learned.has('instant_ice')) deck.push('ice_2_prism');
    else deck.push('ice_1_crystal');

    // 线 2：水系破局线（纯冰切磋规则下隐藏）
    if (!iceOnly) {
      if (isLate && !isCorridor14) deck.push('water_3_blade');
      else if (age >= 14 || isCorridor14) deck.push('water_2_surge');
      else deck.push('water_1_ball');
    }

    // 线 3：霜域控场线
    if (isLate && !isCorridor14) deck.push('frost_3_thorns');
    else if (age >= 11) deck.push('frost_2_breath');
    else deck.push('frost_1_step');

    // 线 4：冰盾护御线
    if (isLate && !isCorridor14) deck.push('shield_3_steel');
    else if (isMid) deck.push('shield_2_mirror');
    else deck.push('shield_1_ice');

    // 线 5：近战导魔线（第 8 幕严格 14 岁未习剑步）
    const canColdEdge = !isCorridor14 && !iceOnly && (
      isLate || learned.has('root_step') || learned.has('soft_cut') || learned.has('frost_edge')
    );
    deck.push(canColdEdge ? 'sword_2_cold_edge' : 'sword_1_basic');

    // 独立身法槽：严格校验是否已习得风行残像
    if (learned.has('wind_afterimage') || learned.has('wind_step_s')) {
      deck.push('move_afterimage');
    }

    return deck;
  }

  function buildPlayerCombatant(stageCfg, opts) {
    opts = opts || {};
    const curS = getGameS() || {};
    const usePreset = opts.usePreset !== undefined ? opts.usePreset : !arenaUseSaveStats;
    const p = stageCfg && stageCfg.preset;
    const relApi = getRelicsApi();
    const activeRelics = Array.isArray(opts.relics)
      ? opts.relics.slice()
      : (relApi ? relApi.getActiveRelicsForBattle(Object.assign({}, opts, { state: curS })) : []);
    const activeAssist = opts.bondAssist !== undefined
      ? opts.bondAssist
      : (relApi ? relApi.getActiveBondAssistForBattle(Object.assign({}, opts, { state: curS })) : null);
    const baseCrit = COMBAT_BALANCE_V32.critBaseChance + (activeRelics.indexOf('belmont_schedule') !== -1 ? 0.15 : 0);
    const synInfo = resolveActiveSynergies(activeRelics);
    const actPreset = stageCfg && COMBAT_BALANCE_V32.ACTS_PLAYER_PRESET[stageCfg.id];
    let selectedStaff = 'none';
    if (opts.staff && COMBAT_BALANCE_V32.STAVES[opts.staff]) {
      selectedStaff = opts.staff;
    } else if (!opts.headless) {
      const winRel = (typeof window !== 'undefined' && window.RelicsAndEvents) || relApi;
      const rawStaff = (winRel && typeof winRel.getActiveStaffForBattle === 'function')
        ? winRel.getActiveStaffForBattle({ fromArena: !!opts.fromArena, headless: !!opts.headless, state: curS })
        : ((curS && curS.equippedStaff) || 'none');
      if (rawStaff && COMBAT_BALANCE_V32.STAVES[rawStaff]) {
        selectedStaff = rawStaff;
      }
    }

    if (usePreset && p) {
      const pAge = typeof p.age === 'number' ? p.age : ((actPreset && actPreset.age) || 14);
      const pRank = p.rank || (actPreset && actPreset.rank) || (pAge >= 14 ? 3 : 2);
      const pSpd = p.spd || (actPreset && actPreset.spd) || 100;
      const pBaseAv = computeBaseAv(pSpd);
      return {
        name: (stageCfg.id === 'turning_point_corridor') ? '希尔维亚' : ((stageCfg.order >= 6) ? '眷寒渔（希尔维亚）' : '希尔维亚'),
        age: pAge,
        rank: pRank,
        hp: p.hp,
        mhp: p.mhp,
        mp: p.mp,
        mmp: p.mmp,
        atk: p.atk,
        matk: p.matk,
        def: p.def,
        mdef: p.mdef,
        spd: pSpd,
        baseAv: pBaseAv,
        av: pBaseAv,
        shield: 0,
        shieldKind: 'solid',
        maxShield: Math.round(p.mhp * 0.85),
        skills: p.skills.slice(),
        unlockedInsights: [],
        usedMaxSkills: {},
        cooldowns: {},
        passives: (p.passives || []).slice(),
        relics: activeRelics,
        synergies: synInfo.synergies,
        synergyMap: synInfo.synergyMap,
        critChance: baseCrit,
        bondAssist: activeAssist,
        bondAssistUsed: false,
        hasManaCycle: !!p.manaCycle,
        canAmp: (p.mmp || 0) > 0,
        canManaAmp: (p.mmp || 0) > 0,
        hasEclipseWand: !!p.eclipseWand || selectedStaff === 'eclipse_wand',
        equippedStaff: selectedStaff,
        wandPersistent: selectedStaff === 'eclipse_wand',
        wandActive: selectedStaff === 'eclipse_wand',
        wandCooldown: 0,
        overcastMode: 0,
        _lastOvercastMode: 0,
        overcastPct: 0,
        ampPct: 0,
        ampTier: 0,
        ampTierName: '常规',
        ampAdd: 0,
        ampMult: 1.0,
        ampDefPierce: 0,
        ampExtraLocks: 0,
        ampShieldMult: 1.0,
        ampTiers: AMP_TIERS.slice(),
        maxAmpCap: 0.60,
        palaceLeft: 0,
        palaceMax: 0,
        status: {},
      };
    }

    // 主线存档出战：按年龄成长保底与六维比例双曲正切软上限映射，并按年龄自动进化五线加身法技能组
    const age = Number(curS.ageY != null ? curS.ageY : ((p && p.age) || (actPreset && actPreset.age) || 14));
    const af = resolveAgeFloorV3(age);
    const body = (curS.stats && curS.stats.body) != null ? curS.stats.body : (8 + age);
    const mind = (curS.stats && curS.stats.mind) != null ? curS.stats.mind : (18 + age);
    const mana = (curS.stats && curS.stats.mana) != null ? curS.stats.mana : (14 + age);
    const charm = (curS.stats && curS.stats.charm) != null ? curS.stats.charm : (10 + age);

    const baseP = p || actPreset || {
      age,
      rank: age >= 14 ? 3 : 2,
      hp: af.mhp,
      mhp: af.mhp,
      mp: af.mmp,
      mmp: af.mmp,
      atk: af.atk,
      matk: Math.round(af.mag * 0.45 + (14 + age) * 0.35),
      def: af.pdef,
      mdef: af.mdef,
      spd: age >= 15 ? 110 : age >= 12 ? 105 : 100,
    };

    const sMhp = Math.max(af.mhp, curS.mhp || 0);
    const sMmp = Math.max(af.mmp, curS.mmp || 0);
    const sAtk = Math.max(af.atk, curS.atk || 0);
    const sMag = Math.max(af.mag, curS.mag || 0);
    const sPdef = Math.max(af.pdef, curS.pdef || 0);
    const sMdef = Math.max(af.mdef, curS.mdef || 0);

    const rawAtk = sAtk + body * 0.35;
    const rawMatk = sMag * 0.45 + mana * 0.35;
    const rawDef = sPdef + body * 0.18 + charm * 0.10;
    const rawMdef = sMdef + mind * 0.22;

    const mhp = applyRatioTanhCap(sMhp, baseP.mhp || baseP.hp || af.mhp, 'hp');
    const mmp = applyRatioTanhCap(sMmp, baseP.mmp || baseP.mp || af.mmp, 'mp');
    const mappedAtk = applyRatioTanhCap(rawAtk, baseP.atk || af.atk, 'atk');
    const mappedMatk = applyRatioTanhCap(rawMatk, baseP.matk || 35, 'matk');
    const mappedDef = applyRatioTanhCap(rawDef, baseP.def || af.pdef, 'def');
    const mappedMdef = applyRatioTanhCap(rawMdef, baseP.mdef || af.mdef, 'mdef');

    const clampRatio = v => Math.max(0, Math.min(1, v));
    const hpRatio = (curS.mhp > 0 && typeof curS.hp === 'number' && Number.isFinite(curS.hp))
      ? clampRatio(curS.hp / curS.mhp)
      : 1;
    const mpRatio = (curS.mmp > 0 && typeof curS.mp === 'number' && Number.isFinite(curS.mp))
      ? clampRatio(curS.mp / curS.mmp)
      : 1;
    const hp = opts.fullRestore
      ? mhp
      : Math.min(mhp, Math.max(Math.round(mhp * hpRatio), Math.max(1, Math.round(mhp * 0.35))));
    const mp = opts.fullRestore
      ? mmp
      : Math.min(mmp, Math.max(Math.round(mmp * mpRatio), Math.min(mmp, 60)));

    const learned = new Set([...(curS.skills || []), ...(curS.skillsLearned || [])]);
    const evolvedSkills = buildEvolvedSkillDeckForSave(age, curS, learned, stageCfg);

    const passives = [];
    if (learned.has('temp_sense') || learned.has('ice_sense')) passives.push('temp_sense');
    if (learned.has('root_ice')) passives.push('root_ice');
    if (learned.has('mana_calc')) passives.push('mana_calc');
    if (learned.has('frost_edge')) passives.push('frost_edge');
    if (learned.has('instant_ice')) passives.push('instant_ice');

    const saveSpd = Math.max(96, Math.min(116, (baseP.spd || (age >= 15 ? 110 : age >= 12 ? 105 : 100)) + Math.floor(Math.max(0, body - 20) * 0.12)));
    const saveBaseAv = computeBaseAv(saveSpd);
    const saveRank = (stageCfg && stageCfg.preset && stageCfg.preset.rank) || (age >= 14 ? 3 : 2);

    return {
      name: curS.alias || '希尔维亚',
      age,
      rank: saveRank,
      hp,
      mhp,
      mp,
      mmp,
      atk: mappedAtk,
      matk: mappedMatk,
      def: mappedDef,
      mdef: mappedMdef,
      spd: saveSpd,
      baseAv: saveBaseAv,
      av: saveBaseAv,
      shield: 0,
      shieldKind: 'solid',
      maxShield: Math.round(mhp * 0.85),
      skills: evolvedSkills,
      unlockedInsights: [],
      usedMaxSkills: {},
      cooldowns: {},
      passives,
      relics: activeRelics,
      synergies: synInfo.synergies,
      synergyMap: synInfo.synergyMap,
      critChance: baseCrit,
      bondAssist: activeAssist,
      bondAssistUsed: false,
      hasManaCycle: learned.has('mana_cycle') || !!(p && p.manaCycle && age >= 14),
      canAmp: mmp > 0,
      canManaAmp: mmp > 0,
      hasEclipseWand: hasEclipseInSave() || selectedStaff === 'eclipse_wand',
      equippedStaff: selectedStaff,
      wandPersistent: selectedStaff === 'eclipse_wand',
      wandActive: selectedStaff === 'eclipse_wand',
      wandCooldown: 0,
      overcastMode: 0,
      _lastOvercastMode: 0,
      overcastPct: 0,
      ampPct: 0,
      ampTier: 0,
      ampTierName: '常规',
      ampAdd: 0,
      ampMult: 1.0,
      ampDefPierce: 0,
      ampExtraLocks: 0,
      ampShieldMult: 1.0,
      ampTiers: AMP_TIERS.slice(),
      maxAmpCap: 0.60,
      palaceLeft: 0,
      palaceMax: 0,
      status: {},
    };
  }

  /* =========================================================
     4. 动态敌方架势预告引擎（九幕精确节拍与危招编排）
     ========================================================= */
  function decideEnemyIntent(enemy, b) {
    if (enemy.hp <= 0) {
      enemy.intent = null;
      return;
    }
    if (enemy.status && enemy.status.stagger > 0) {
      enemy.intent = {
        stance: 'STAGGERED',
        moveName: enemy._phase2Awakening ? '觉醒蓄能·阵势蜕变' : '架势失衡·气息紊乱',
        dmg: 0,
        elem: enemy.elem || 'phys',
        desc: enemy._phase2Awakening ? '首领正在重整二阶段架势，下回合释放高压杀招。' : '动作被截断，本回合无法组织攻势。',
      };
      return;
    }

    const wt = b.waveTurn || b.turn || 1;
    const ai = enemy.aiType || 'generic';

    // 1. 贝阿特丽丝（四拍切换：抬肩重劈 / 暴走火蛇 / 融冰防反 / 爆炎重劈）
    if (ai === 'beatrice') {
      const step = (wt - 1) % 4;
      const fa = enemy.fireStacks || 0;
      if (step === 0) {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '抬右肩·烈焰重劈',
          dmg: 46 + fa * 4,
          elem: 'fire',
          addBurn: 1,
          gainFire: 1,
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '烈焰塑形·暴走火蛇',
          dmg: 42 + fa * 4,
          elem: 'fire',
          addBurn: 1,
          gainFire: 1,
        };
      } else if (step === 2) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '烈焰剑障·融冰防反',
          dmg: 38 + fa * 4,
          elem: 'fire',
          meltIceCounter: true,
          gainShield: 22,
        };
      } else {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '爆炎踏步重劈',
          dmg: 48 + fa * 4,
          elem: 'fire',
          addBurn: 1,
        };
      }
      return;
    }

    // 2. 罗文（四回合紧致协同活捉节拍：越位黑光 / 窄道突围 / 飞旋掷杖袭心）
    if (ai === 'rowan') {
      const step = (wt - 1) % 3;
      if (step === 0) {
        enemy.intent = {
          stance: 'UNDER_SEEP',
          moveName: '晦轮银环·越位蚀心黑光',
          dmg: 56,
          allyDmg: 80,
          elem: 'dark',
          eclipseTrueMagic: true,
          renoRockBlock: true,
          refractIceCrystal: true,
          targetRole: 'backline',
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '血魔震土·石碑窄道突围',
          dmg: 30,
          allyDmg: 94,
          elem: 'dark',
          narrowPassWindow: true,
          gainShield: 45,
          targetRole: 'frontline',
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '虚刺雷纳德·飞旋掷杖袭心',
          dmg: 60,
          allyDmg: 68,
          elem: 'dark',
          eclipseTrueMagic: true,
          renoRockBlock: true,
          thrownStaff: true,
          targetRole: 'backline',
        };
      }
      return;
    }

    // 3. 爱丽丝（第 4/7 回合狂躁风暴魔力检定，其余三拍扬尘/风刃/风镰）
    if (ai === 'alice') {
      const isStormTurn = wt === 4 || (wt > 4 && (wt - 4) % 3 === 0);
      if (isStormTurn) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '聚风成涡·狂躁风暴蓄力',
          dmg: 96,
          elem: 'wind',
          mpCost: 22,
          selfFizzleIfLowMp: true,
        };
        return;
      }
      const subStep = (wt - 1) % 3;
      if (subStep === 0) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '侧滑扬尘·绕侧风刃',
          dmg: 36,
          elem: 'wind',
          mpCost: 7,
          inflictBlind: 1,
        };
      } else if (subStep === 1) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '借风掠影·透明风刃',
          dmg: 40,
          elem: 'wind',
          mpCost: 7,
        };
      } else {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '旋风障壁·回旋风镰',
          dmg: 44,
          elem: 'wind',
          mpCost: 7,
          inflictBlind: 1,
        };
      }
      return;
    }

    // 4. 艾诺（冰上三击制紧致节拍：寒脉蓄势 / 近身双刺 / 破土冰莲）
    if (ai === 'aino') {
      const step = (wt - 1) % 3;
      if (step === 0) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '寒脉震地·极寒双翼刺阵',
          dmg: 54,
          elem: 'ice',
          slipStrike: true,
          scoresHit: true,
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '贴地滑冰·近身双刺',
          dmg: 48,
          elem: 'ice',
          slipStrike: true,
          scoresHit: true,
        };
      } else {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '破土冰莲合拢',
          dmg: 52,
          elem: 'ice',
          scoresHit: true,
        };
      }
      return;
    }

    // 5. 诺艾儿（半血以下或残魔布设脚底暗流陷阱，硬吃降为 115 防未解锁风行残像卡关）
    if (ai === 'noelle') {
      if (!enemy.seepSevered && (enemy.hp <= Math.round(enemy.mhp * 0.48) || (enemy.mp != null && enemy.mp <= 45))) {
        enemy.intent = {
          stance: 'UNDER_SEEP',
          moveName: '残魔退守·冰缝暗流',
          dmg: 132,
          trapDmg: 115,
          ambushTrap: true,
          elem: 'water',
          mpCost: 10,
        };
        return;
      }
      const step = (wt - 1) % 3;
      if (step === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '等距后撤·双幕收口水刃',
          dmg: 144,
          elem: 'water',
          mpCost: 8,
          refreshCurtain: 36,
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '尺量水幕平切',
          dmg: 132,
          elem: 'water',
          mpCost: 6,
          refreshCurtain: 40,
        };
      }
      return;
    }

    // 6. 灰棘狼群 & 霜脊影豺
    if (ai === 'pack_wolf') {
      if (enemy.id === 'wolf_alpha' && wt % 2 === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '仰首群嚎·凶性激发',
          dmg: 28,
          elem: 'wind',
          buffPack: 5,
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '群狼合围撕咬',
          dmg: (enemy.atk || 20) + 4,
          elem: 'phys',
        };
      }
      return;
    }

    if (ai === 'jackal' || ai === 'jackal_minor') {
      if (ai === 'jackal') {
        if (!enemy.evadeBrokenThisTurn) {
          enemy.evadeCharges = enemy.maxEvadeCharges || 1;
        }
        enemy.evadeBrokenThisTurn = false;
      }
      const step = (wt - 1) % 3;
      if (step === 2 && ai === 'jackal') {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '霜脊蓄寒·冰刺喷吐',
          dmg: 106,
          elem: 'ice',
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '银影腾空·锁喉扑杀',
          dmg: ai === 'jackal' ? 110 : 42,
          elem: 'phys',
        };
      }
      return;
    }

    // 7. 赫兰冻土重甲兽 & 霜渊裂地兽领主
    if (ai === 'hulan_brute') {
      const step = (wt - 1) % 2;
      if (step === 0) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '冻土聚甲撞箱',
          dmg: 88,
          crateDmg: 38,
          gainShield: 28,
          elem: 'earth',
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '厚岩蛮冲药箱',
          dmg: 90,
          crateDmg: 38,
          elem: 'earth',
        };
      }
      return;
    }

    if (ai === 'hulan_lord') {
      const step = (wt - 1) % 4;
      if (step === 0 || step === 2) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '双臂聚寒·极北霜岩风暴',
          dmg: 166,
          crateDmg: 50,
          gainShield: 48,
          elem: 'ice',
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '冻甲壁垒·冰峡崩震',
          dmg: 158,
          crateDmg: 48,
          elem: 'earth',
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '裂地横扫扑击',
          dmg: 144,
          crateDmg: 40,
          elem: 'phys',
        };
      }
      return;
    }

    // 8. 东翼火廊突围战（宫廷突击队长 / 赤炎术士 / 红莲铁幕）
    if (ai === 'corridor_vanguard') {
      const step = (wt - 1) % 2;
      if (step === 0) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '十字长戟突刺',
          dmg: 76,
          elem: 'phys',
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '宫廷重盾反击',
          dmg: 68,
          elem: 'phys',
          gainShield: 26,
        };
      }
      return;
    }

    if (ai === 'flame_mage') {
      const step = (wt - 1) % 2;
      if (step === 0) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '炎印炽涌·封廊赤炎火墙',
          dmg: 82,
          elem: 'fire',
          addBurn: 2,
          heavyWarn: true,
        };
      } else {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '赤炎爆裂火球',
          dmg: 74,
          elem: 'fire',
          addBurn: 2,
        };
      }
      return;
    }

    if (ai === 'eastwing_boss') {
      const p2 = (enemy.phase || 1) >= 2;
      if (p2) {
        const p2Step = (enemy.phase2Step || 0) % 2;
        if (p2Step === 0) {
          enemy.intent = {
            moveKey: 'FLAME_CORRIDOR_SEAL',
            stance: 'DUAL_CAST',
            moveName: '红莲铁幕·封廊锁火（必断咏唱！）',
            dmg: 180,
            elem: 'fire',
            shatterPlayerShield: true,
            addBurn: 2,
            gainShield: 46,
            heavyWarn: true,
          };
        } else {
          enemy.intent = {
            moveKey: 'CROSSROAD_BREACH',
            stance: 'CLOSE_LUNGE',
            moveName: '红莲突袭·岔口破阵冲锋',
            dmg: 158,
            elem: 'phys',
            bypassHalfShield: true,
            addBurn: 2,
            heavyWarn: true,
          };
        }
        return;
      }
      const step = (wt - 1) % 3;
      if (step === 0) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '炽焰引燃·长廊炎壁',
          dmg: 130,
          elem: 'fire',
          gainShield: 38,
          addBurn: 2,
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '炎戟突进·封喉直刺',
          dmg: 124,
          elem: 'phys',
          addBurn: 1,
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '红莲铁幕·融冰守势',
          dmg: 116,
          elem: 'fire',
          meltIceCounter: true,
          gainShield: 40,
        };
      }
      return;
    }

    // 9. 风神·岚（演武大厅专属 · 真神级七阶）
    if (ai === 'wind_god_boss') {
      const p2 = (enemy.phase || 1) >= 2;
      if (!(enemy.status && enemy.status.evadeSealed > 0)) {
        if (!enemy.evadeBrokenThisTurn) {
          enemy.evadeCharges = enemy.maxEvadeCharges || 1;
        }
      } else {
        enemy.evadeCharges = 0;
      }
      enemy.evadeBrokenThisTurn = false;

      if (p2) {
        const p2Step = (enemy.phase2Step || 0) % 2;
        if (p2Step === 0) {
          enemy.intent = {
            moveKey: 'TEMPEST_VACUUM',
            stance: 'CLOSE_LUNGE',
            moveName: '神域·风暴眼真空连刃',
            dmg: 228,
            followupDmg: 76,
            elem: 'wind',
            bypassHalfShield: true,
            pierceAfterimage: true,
            tempestVacuum: true,
            heavyWarn: true,
          };
        } else {
          enemy.intent = {
            moveKey: 'EYE_STILLNESS',
            stance: 'GUARD_COUNTER',
            moveName: '神域·风眼静滞圆心反制',
            dmg: 196,
            followupDmg: 66,
            elem: 'wind',
            gainShield: 106,
            eyeStillnessStance: true,
            bypassHalfShield: true,
            pierceAfterimage: true,
            heavyWarn: true,
          };
        }
        return;
      }
      const step = (wt - 1) % 3;
      if (step === 0) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '神速·翠岚试剑三连',
          dmg: 150,
          followupDmg: 50,
          elem: 'wind',
          bypassHalfShield: true,
          pierceAfterimage: true,
        };
      } else if (step === 1) {
        enemy.evadeCharges = 0;
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '神威·双袖引风气旋',
          dmg: 180,
          elem: 'wind',
          gainShield: 94,
          bypassHalfShield: true,
          pierceAfterimage: true,
          heavyWarn: true,
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '神域·风壁听劲反斩',
          dmg: 144,
          followupDmg: 44,
          elem: 'wind',
          gainShield: 96,
          windGuardCounter: true,
          bypassHalfShield: true,
          pierceAfterimage: true,
        };
      }
      return;
    }

    const gStep = (wt - 1) % 3;
    enemy.intent = gStep === 1
      ? { stance: 'DUAL_CAST', moveName: '蓄势咆哮猛击', dmg: Math.round(enemy.atk * 1.25), elem: enemy.elem || 'phys' }
      : gStep === 2
        ? { stance: 'CLOSE_LUNGE', moveName: '贴身疾扑', dmg: Math.round(enemy.atk * 1.1), elem: 'phys' }
        : { stance: 'HEAVY_WINDUP', moveName: '正面强袭', dmg: enemy.atk, elem: enemy.elem || 'phys' };
  }

  function predictNextIntentTendency(enemy, b) {
    if (!enemy || enemy.hp <= 0) return '已失去战意';
    if (enemy.intent && enemy.intent.stance === 'STAGGERED') {
      return '蓄能恢复中（准备重新蓄势反扑）';
    }
    const cloneE = Object.assign({}, enemy, { status: Object.assign({}, enemy.status || {}) });
    delete cloneE.status.stagger;
    if ((cloneE.phase || 1) >= 2) {
      cloneE.phase2Step = ((cloneE.phase2Step || 0) + 1) % 2;
    }
    const fakeB = Object.assign({}, b, {
      waveTurn: (b.waveTurn || b.turn || 1) + 1,
      aiMemory: Object.assign({}, b.aiMemory || {}),
    });
    decideEnemyIntent(cloneE, fakeB);
    const nextSt = cloneE.intent ? cloneE.intent.stance : 'HEAVY_WINDUP';
    const labelMap = {
      DUAL_CAST: '重术蓄势（可留进阶冰水术式或一阶增幅截断）',
      CLOSE_LUNGE: '贴身突袭（可备寒锋斩迎击或风行残像避险）',
      HEAVY_WINDUP: '蓄力重击（宜提前立起冰盾护御）',
      GUARD_COUNTER: '严密防反（宜切换克制属性或霜域破防）',
      UNDER_SEEP: '诡道暗流（宜施展冰霜之息冻绝暗流）',
    };
    return labelMap[nextSt] || '常规试探';
  }

  /* =========================================================
     5. 魔战循环 · 线性相加增伤池 · 魔力增幅 · 晦轮杖真伤 · 比值防御精算核心
     ========================================================= */
  function resolveSkillBeats(skill, b) {
    if (!skill) return 0;
    const spec = skill.beatSpec || SKILL_BEAT_SPEC_V32[skill.id] || null;
    const rawBeats = spec ? spec.beats : skill.beats;
    if (rawBeats === 'alive_enemies' || rawBeats === -1) {
      const alive = (b && Array.isArray(b.enemies)) ? b.enemies.filter(e => e && e.hp > 0).length : 1;
      const minB = (spec && spec.min) || 1;
      const maxB = (spec && spec.max) || 6;
      return Math.max(minB, Math.min(maxB, alive));
    }
    return Math.max(0, Number(rawBeats) || 0);
  }

  function computeSkillApCost(bState, skill) {
    if (!skill) return 0;
    const baseAp = skill.ap || 0;
    if (bState && bState.turn === 1 && !bState._handkerchiefFreeIceUsed &&
        hasRelic(bState.player, 'aino_academy_handkerchief') && skill.line === 1) {
      return 0;
    }
    return baseAp;
  }

  function getSkillOvercastCap(skill) {
    if (!skill) return 0;
    if (typeof skill.overcastCap === 'number') return Math.max(0, Math.min(0.60, skill.overcastCap));
    if (skill.noOvercast) return 0;
    const caps = COMBAT_BALANCE_V32.OVERCAST.skillCaps;
    if (skill.line === 5 || skill.path === 'SWORD') return caps.SWORD;
    if (skill.line === 6) return caps.MOVE;
    if (skill.shieldBase > 0) return caps.SHIELD;
    if (skill.atkKind !== 'matk' || !(skill.power > 0)) return 0;
    return caps.HAND_HEAVY;
  }

  function getSkillBaseLockDamage(skill) {
    if (!skill || !(skill.power > 0)) return 0;
    if (typeof skill.lockDamage === 'number') return skill.lockDamage;
    if (skill.id === 'sword_1_basic') return 0;
    return 1;
  }

  function isEclipseStaffForSkill(player, skill) {
    if (!player || !skill || !(skill.power > 0) || skill.atkKind !== 'matk') return false;
    if (player.wandActive) return true;
    if (player.hasEclipseWand) return false;
    const staff = getEquippedStaffDef(player);
    return !!(staff && staff.trueMagic);
  }

  function computeAmpAddDmg(ampPct) {
    return Number(Math.max(0, Math.min(0.60, Number(ampPct) || 0)).toFixed(4));
  }

  function getAmpTierInfo(ampPct) {
    const dm = Math.max(0, Math.min(0.60, Number(ampPct) || 0));
    const addDmg = computeAmpAddDmg(dm);
    const shieldMult = Number((1.0 + 1.25 * Math.min(dm, 0.40)).toFixed(4));
    const tiers = COMBAT_BALANCE_V32.ampTiers;
    if (dm >= 0.60 - 1e-4) {
      const t = tiers[3];
      return { tier: 3, addDmg, mult: Number((1 + addDmg).toFixed(4)), extraLocks: t.extraLocks, defPierce: t.defPierce, shieldMult, label: t.label, name: t.label };
    }
    if (dm >= 0.40 - 1e-4) {
      const t = tiers[2];
      return { tier: 2, addDmg, mult: Number((1 + addDmg).toFixed(4)), extraLocks: t.extraLocks, defPierce: t.defPierce, shieldMult, label: t.label, name: t.label };
    }
    if (dm >= 0.20 - 1e-4) {
      const t = tiers[1];
      return { tier: 1, addDmg, mult: Number((1 + addDmg).toFixed(4)), extraLocks: t.extraLocks, defPierce: t.defPierce, shieldMult, label: t.label, name: t.label };
    }
    return { tier: 0, addDmg, mult: Number((1 + addDmg).toFixed(4)), extraLocks: 0, defPierce: 0, shieldMult, label: '', name: '常规' };
  }

  function computeAmpDamageMult(ampPct) {
    return Number((1.0 + computeAmpAddDmg(ampPct)).toFixed(4));
  }

  function computeShieldAmpMult(ampPct) {
    const p = Math.max(0, Math.min(0.40, Number(ampPct) || 0));
    return Number((1.0 + 1.25 * p).toFixed(4));
  }

  function isAmpableSkill(skill) {
    if (!skill || skill.noOvercast) return false;
    if (getSkillOvercastCap(skill) <= 0) return false;
    if (skill.power > 0 && skill.atkKind === 'matk' && skill.elem !== 'phys') return true;
    if (skill.shieldBase > 0) return true;
    return false;
  }

  function getPlayerMaxAmpCap(player) {
    if (!player || !(player.mmp > 0)) return 0;
    const list = Array.isArray(player.skills) ? player.skills : [];
    let maxCap = 0;
    for (let i = 0; i < list.length; i++) {
      const sk = TACTICAL_SKILLS[list[i]];
      if (!sk || !isAmpableSkill(sk)) continue;
      const cap = getSkillOvercastCap(sk);
      if (cap > maxCap) maxCap = cap;
    }
    return Math.max(0, Math.min(0.60, maxCap));
  }

  function canPlayerAmp(player) {
    return !!(player && (player.mmp || 0) > 0 && getPlayerMaxAmpCap(player) > 0);
  }

  function getAmpTiers(b) {
    const live = b || activeBattle;
    const maxCap = live && live.player ? getPlayerMaxAmpCap(live.player) : 0.60;
    if (maxCap <= 0) return [0];
    return AMP_TIERS.filter(t => t <= maxCap + 1e-6);
  }

  function syncPlayerAmpFromMode(player) {
    if (!player) return 0;
    const maxCap = getPlayerMaxAmpCap(player);
    const mode = Math.max(0, Math.min(3, player.overcastMode | 0));
    if (player._lastOvercastMode !== mode) {
      player._lastOvercastMode = mode;
      const mapped = AMP_TIERS[mode] != null ? AMP_TIERS[mode] : 0;
      player.ampPct = Math.min(maxCap, mapped);
    }
    const rawVal = Number(player.ampPct != null ? player.ampPct : player.overcastPct) || 0;
    const clamped = Math.round(Math.max(0, Math.min(maxCap, rawVal)) * 100) / 100;
    player.ampPct = clamped;
    player.overcastPct = clamped;
    return clamped;
  }

  function getEffectiveAmpPct(player, skill) {
    if (!canPlayerAmp(player)) return 0;
    const rawPct = syncPlayerAmpFromMode(player);
    if (!skill) return rawPct;
    if (!isAmpableSkill(skill)) return 0;
    return Math.min(rawPct, getSkillOvercastCap(skill));
  }

  function computeMpDiscountFactor(player, isAmpExtra, staffIdOverride) {
    if (!player) return 1.0;
    let f = 1.0;
    if (player.passives && player.passives.includes('mana_calc')) f *= 0.85;
    if (hasRelic(player, 'noelle_manuscript')) f *= (isAmpExtra ? 0.80 : 0.85);
    if (!isAmpExtra && (getSynergyTier(player, 'academy_stars') >= 3 || hasRelic(player, 'academy_star_3pc'))) {
      f *= 0.85;
    }
    const staff = staffIdOverride
      ? (COMBAT_BALANCE_V32.STAVES[staffIdOverride] || COMBAT_BALANCE_V32.STAVES.none)
      : getEquippedStaffDef(player);
    if (isAmpExtra && staff && staff.overcastMpDiscount > 0) {
      f *= (1 - staff.overcastMpDiscount);
    }
    return Math.max(COMBAT_BALANCE_V32.minMpDiscountFloor, Number(f.toFixed(6)));
  }

  function computeBaseMpCost(player, skill) {
    const rawBase = (skill && skill.mp) || 0;
    if (rawBase <= 0) return 0;
    const df = computeMpDiscountFactor(player, false);
    return Math.max(1, Math.round(rawBase * df));
  }

  function computeWandExtraMp(player, skill) {
    if (!isEclipseStaffForSkill(player, skill)) return 0;
    const extraPct = COMBAT_BALANCE_V32.STAVES.eclipse_wand.extraMpPct;
    const df = computeMpDiscountFactor(player, false, 'eclipse_wand');
    return Math.max(1, Math.round(Math.max(1, player.mmp || 100) * extraPct * df));
  }

  function computeAmpDiscountFactor(player) {
    return computeMpDiscountFactor(player, true);
  }

  function computeDiscountedAmpExtraMp(mmp, ampPct, discountFactor) {
    const pct = Math.max(0, Number(ampPct) || 0);
    if (pct <= 0) return 0;
    const safeMmp = Math.max(1, Number(mmp) || 100);
    const df = Math.max(COMBAT_BALANCE_V32.minMpDiscountFloor, Number(discountFactor) || 1.0);
    return Math.max(1, Math.round(safeMmp * pct * df));
  }

  function computeAmpProfile(player, skill, opts) {
    opts = opts || {};
    const mmp = Math.max(1, (player && player.mmp) || 100);
    const mpNow = Math.max(0, (player && player.mp) || 0);
    const discountFactor = computeAmpDiscountFactor(player);
    if (!canPlayerAmp(player) || !isAmpableSkill(skill)) {
      return { ampPct: 0, requestedAmpPct: 0, addDmg: 0, mult: 1.0, shieldMult: 1.0, tier: 0, extraLocks: 0, defPierce: 0, label: '', extraMp: 0, discountedExtraMp: 0, discountFactor };
    }
    const requestedAmpPct = getEffectiveAmpPct(player, skill);
    const base = computeBaseMpCost(player, skill);
    const wandExtra = computeWandExtraMp(player, skill);
    const desiredDiscounted = computeDiscountedAmpExtraMp(mmp, requestedAmpPct, discountFactor);

    let actualAmpPct = requestedAmpPct;
    let actualDiscounted = desiredDiscounted;
    if (opts.clampToMp !== false && !(player.status && player.status.zeroMpThisTurn)) {
      const reqFixed = base + wandExtra;
      if (mpNow >= reqFixed && mpNow < reqFixed + desiredDiscounted && desiredDiscounted > 0) {
        actualDiscounted = Math.max(0, mpNow - reqFixed);
        actualAmpPct = Math.min(requestedAmpPct, (actualDiscounted / Math.max(0.05, discountFactor)) / mmp);
      }
    }

    const tierInfo = getAmpTierInfo(actualAmpPct);
    const addDmg = computeAmpAddDmg(actualAmpPct);
    const mult = computeAmpDamageMult(actualAmpPct);
    const shieldMult = skill.shieldBase > 0 ? computeShieldAmpMult(actualAmpPct) : 1.0;

    return {
      ampPct: actualAmpPct,
      requestedAmpPct,
      addDmg,
      mult,
      shieldMult,
      tier: tierInfo.tier,
      extraLocks: tierInfo.extraLocks,
      defPierce: tierInfo.defPierce,
      label: tierInfo.label,
      extraMp: Math.round(mmp * actualAmpPct),
      discountedExtraMp: actualDiscounted,
      discountFactor,
    };
  }

  function computeOvercastPowerMp(player, skill) {
    if (!skill) return 0;
    const base = computeBaseMpCost(player, skill);
    const wandExtra = computeWandExtraMp(player, skill);
    const prof = computeAmpProfile(player, skill);
    return base + wandExtra + prof.extraMp;
  }

  function computeSkillMpCost(player, skill) {
    if (!skill) return 0;
    if (player && player.status && player.status.zeroMpThisTurn) return 0;
    const base = computeBaseMpCost(player, skill);
    const wandExtra = computeWandExtraMp(player, skill);
    const prof = computeAmpProfile(player, skill);
    return base + wandExtra + prof.discountedExtraMp;
  }

  function computeManaCycleMultiplier(player, mpSpent, skill) {
    if (!canPlayerAmp(player) || !isAmpableSkill(skill) || mpSpent <= 0) {
      return 1.0;
    }
    return computeAmpProfile(player, skill).mult;
  }

  function pickPrimaryAmpSkill(player, preferredId) {
    if (preferredId && TACTICAL_SKILLS[preferredId]) {
      const pref = TACTICAL_SKILLS[preferredId];
      if ((!player || !Array.isArray(player.skills) || player.skills.includes(preferredId)) && isAmpableSkill(pref)) {
        return pref;
      }
    }
    const list = (player && Array.isArray(player.skills)) ? player.skills : [];
    let bestAtk = null;
    let bestAtkCap = -1;
    let bestAny = null;
    let bestAnyCap = -1;
    for (let i = 0; i < list.length; i++) {
      const sk = TACTICAL_SKILLS[list[i]];
      if (!sk || !isAmpableSkill(sk)) continue;
      const cap = getSkillOvercastCap(sk);
      if (sk.power > 0 && cap > bestAtkCap) {
        bestAtk = sk;
        bestAtkCap = cap;
      }
      if (cap > bestAnyCap) {
        bestAny = sk;
        bestAnyCap = cap;
      }
    }
    return bestAtk || bestAny || TACTICAL_SKILLS.ice_1_crystal;
  }

  function computeSkillShieldGain(player, skill, ampProfile) {
    if (!player || !skill || !(skill.shieldBase > 0)) return 0;
    let gain = skill.shieldBase + (player.matk || 0) * (skill.shieldScale || 0);
    if (skill.elem === 'ice' && player.passives && player.passives.includes('root_ice')) {
      gain *= 1.20;
    }
    if (hasRelic(player, 'cross')) gain *= 1.15;
    const prof = ampProfile || computeAmpProfile(player, skill);
    const shieldAmpMult = prof && prof.shieldMult > 1.001 ? prof.shieldMult : 1.0;
    gain *= shieldAmpMult;
    return Math.max(0, Math.round(gain));
  }

  function computeSkillCrateGuard(skill, ampProfile) {
    if (!skill) return 0;
    const tierIdx = Math.max(0, Math.min(2, (ampProfile && ampProfile.tier) || 0));
    if (Array.isArray(skill.crateGuardTiers) && skill.crateGuardTiers.length >= 3) {
      return Number(skill.crateGuardTiers[tierIdx]) || 0;
    }
    if (skill.protectCrate > 0) {
      return tierIdx >= 1 ? skill.protectCrate * 2 : skill.protectCrate;
    }
    return 0;
  }

  function computeDerivedAmpState(player) {
    const mmp = Math.max(1, (player && player.mmp) || 100);
    const maxAmpCap = getPlayerMaxAmpCap(player);
    const canAmp = !!(player && (player.mmp || 0) > 0 && maxAmpCap > 0);
    const ampTiers = maxAmpCap <= 0 ? [0] : AMP_TIERS.filter(t => t <= maxAmpCap + 1e-6);
    const overcastPct = canAmp ? Math.min(maxAmpCap, syncPlayerAmpFromMode(player)) : 0;
    const tierInfo = getAmpTierInfo(overcastPct);
    const ampTier = tierInfo.tier;
    const ampTierName = tierInfo.name;
    const overcastMode = ampTier;
    const refSk = pickPrimaryAmpSkill(player, null);
    const refProf = computeAmpProfile(player, refSk, { clampToMp: false });
    const shieldCap = COMBAT_BALANCE_V32.OVERCAST.skillCaps.SHIELD;
    const shieldPct = Math.min(overcastPct, shieldCap);
    const ampShieldMult = Number(computeShieldAmpMult(shieldPct).toFixed(4));
    const ampMult = Number(((refSk && refSk.shieldBase > 0 && !(refSk.power > 0)) ? refProf.shieldMult : refProf.mult).toFixed(4));
    const ampDiscountFactor = computeAmpDiscountFactor(player);
    const ampExtraMp = canAmp ? computeDiscountedAmpExtraMp(mmp, overcastPct, ampDiscountFactor) : 0;
    const ampTierExtraMps = ampTiers.map(t => (canAmp ? computeDiscountedAmpExtraMp(mmp, t, ampDiscountFactor) : 0));
    const tierMultAt = pct => {
      const clamped = Math.min(maxAmpCap, Math.max(0, pct));
      if (refSk && refSk.shieldBase > 0 && !(refSk.power > 0)) {
        const sPct = Math.min(clamped, shieldCap);
        return Number(computeShieldAmpMult(sPct).toFixed(4));
      }
      return Number(computeAmpDamageMult(clamped).toFixed(4));
    };
    const ampTierMults = [1.0, tierMultAt(0.20), tierMultAt(0.40), tierMultAt(0.60)];
    return {
      overcastPct,
      ampPct: overcastPct,
      overcastMode,
      ampTier,
      ampTierName,
      ampAdd: tierInfo.addDmg,
      ampMult,
      ampTierMults,
      ampDefPierce: tierInfo.defPierce,
      ampExtraLocks: tierInfo.extraLocks,
      ampShieldMult,
      ampTiers,
      ampDiscountFactor,
      ampExtraMp,
      ampTierExtraMps,
      maxAmpCap,
      canAmp,
    };
  }

  function syncDerivedBattleState(b) {
    if (!b || !b.player) return;
    const p = b.player;
    const d = computeDerivedAmpState(p);
    p.canAmp = d.canAmp;
    p.canManaAmp = d.canAmp;
    p.maxAmpCap = d.maxAmpCap;
    p.ampTiers = d.ampTiers.slice();
    p.overcastPct = d.overcastPct;
    p.ampPct = d.ampPct;
    p.overcastMode = d.overcastMode;
    p._lastOvercastMode = d.overcastMode;
    p.ampTier = d.ampTier;
    p.ampTierName = d.ampTierName;
    p.ampAdd = d.ampAdd;
    p.ampMult = d.ampMult;
    p.ampTierMults = d.ampTierMults.slice();
    p.ampDefPierce = d.ampDefPierce;
    p.ampExtraLocks = d.ampExtraLocks;
    p.ampShieldMult = d.ampShieldMult;
    p.ampDiscountFactor = d.ampDiscountFactor;
    p.ampExtraMp = d.ampExtraMp;
    p.ampTierExtraMps = d.ampTierExtraMps.slice();
    b.overcastPct = d.overcastPct;
    b.ampPct = d.ampPct;
    b.overcastMode = d.overcastMode;
    b.ampTier = d.ampTier;
    b.ampTierName = d.ampTierName;
    b.ampAdd = d.ampAdd;
    b.ampMult = d.ampMult;
    b.ampTierMults = d.ampTierMults.slice();
    b.ampDefPierce = d.ampDefPierce;
    b.ampExtraLocks = d.ampExtraLocks;
    b.ampShieldMult = d.ampShieldMult;
    b.ampTiers = d.ampTiers.slice();
    b.ampDiscountFactor = d.ampDiscountFactor;
    b.ampExtraMp = d.ampExtraMp;
    b.ampTierExtraMps = d.ampTierExtraMps.slice();
    b.maxAmpCap = d.maxAmpCap;
    b.canAmp = d.canAmp;
    b.recentLogs = (b.log || []).slice(-14);
  }

  function emitCombatStateChange(b) {
    try {
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('combat:statechange', { detail: b ? getBattleState(b) : null }));
      }
    } catch (e) {}
  }

  function getPlayerCritChance(player) {
    const base = COMBAT_BALANCE_V32.critBaseChance;
    const bonus = hasRelic(player, 'belmont_schedule') ? 0.15 : 0;
    return Math.max(0, Math.min(0.95, Number((base + bonus).toFixed(4))));
  }

  function estimateSkillDamage(bState, skill, targetEnemy, opts) {
    opts = opts || {};
    const p = bState.player;
    if (!skill || !skill.power || skill.power <= 0) {
      return { dmg: 0, mult: 1, mcMult: 1, addPool: 1, mpCost: opts.mpCost != null ? opts.mpCost : computeSkillMpCost(p, skill), willInterrupt: false, willRiposte: false };
    }
    const e = targetEnemy || getPrimaryAliveEnemy(bState);
    if (!e) return { dmg: 0, mult: 1, mcMult: 1, addPool: 1, mpCost: 0, willInterrupt: false, willRiposte: false };

    const zeroMpFallback = !!opts.zeroMpFallback;
    const mpCost = zeroMpFallback ? 0 : (opts.mpCost != null ? opts.mpCost : computeSkillMpCost(p, skill));
    const powerMp = zeroMpFallback ? 0 : (opts.powerMp != null ? opts.powerMp : computeOvercastPowerMp(p, skill));
    const ampProfile = zeroMpFallback
      ? { ampPct: 0, addDmg: 0, mult: 1.0, shieldMult: 1.0, tier: 0, extraLocks: 0, defPierce: 0 }
      : (opts.ampProfile || computeAmpProfile(p, skill));
    const mcMult = (!zeroMpFallback && canPlayerAmp(p) && isAmpableSkill(skill) && powerMp > 0) ? ampProfile.mult : 1.0;
    const stance = e.intent ? e.intent.stance : 'HEAVY_WINDUP';
    const wandOn = !zeroMpFallback && isEclipseStaffForSkill(p, skill);
    const staff = wandOn ? COMBAT_BALANCE_V32.STAVES.eclipse_wand : getEquippedStaffDef(p);
    const staffMatkMult = (staff && staff.matkMult) ? staff.matkMult : 1.0;
    const isTempestVacuum = !!(e.aiType === 'wind_god_boss' && e.intent && (e.intent.tempestVacuum || e.intent.moveKey === 'TEMPEST_VACUUM'));
    const isEyeStillness = !!(e.aiType === 'wind_god_boss' && e.intent && (e.intent.eyeStillnessStance || e.intent.moveKey === 'EYE_STILLNESS'));

    const effMatk = p.matk * staffMatkMult;
    let atkStat = effMatk;
    if (skill.atkKind === 'atk' || zeroMpFallback) atkStat = p.atk;
    else if (skill.atkKind === 'hybrid') atkStat = p.atk * 0.95 + effMatk * 0.55;

    let willRiposte = false;
    let willInterrupt = false;
    let rootStepParryTrigger = false;
    let brokeStillness = false;

    if (!zeroMpFallback && skill.counterLunge && stance === 'CLOSE_LUNGE') {
      willRiposte = true;
      if (isTempestVacuum) {
        willInterrupt = true;
        rootStepParryTrigger = true;
      }
    }
    if (!zeroMpFallback && isEyeStillness && (skill.breakStillness || (ampProfile && ampProfile.tier >= 2))) {
      brokeStillness = true;
      willInterrupt = true;
    }
    if (!zeroMpFallback && stance === 'DUAL_CAST' && (skill.canInterrupt || (ampProfile && ampProfile.tier >= 1 && !skill.aoe))) {
      willInterrupt = true;
    }

    const pwr = zeroMpFallback
      ? (skill.zeroMpFallbackPower || 0.85)
      : ((willRiposte && skill.lungeRipostePower) ? skill.lungeRipostePower : skill.power);

    // 紧缩型统一相加增伤池：AddPool = max(0.35, 1 + ampAdd + ringBonus + breakAdd + passiveAdd + relicAdd)
    const ampAdd = (!zeroMpFallback && canPlayerAmp(p) && isAmpableSkill(skill) && powerMp > 0) ? (ampProfile.addDmg || 0) : 0;
    const ringBonus = Number(opts.ringBonus) || 0;
    const breakAdd = e.broken ? COMBAT_BALANCE_V32.breakAdd : 0;
    const passiveAdd = (!zeroMpFallback && (skill.line === 5 || skill.atkKind === 'hybrid') && p.passives && p.passives.includes('frost_edge')) ? 0.05 : 0;

    let relicAdd = 0;
    if (!zeroMpFallback) {
      if (skill.elem === 'ice' && hasRelic(p, 'aino_academy_handkerchief')) relicAdd += 0.02;
      if ((skill.elem === 'water' || skill.elem === 'wind') && hasRelic(p, 'shell_pin')) relicAdd += 0.03;
      if (skill.line === 5 && hasRelic(p, 'ebony_sword')) relicAdd += 0.04;
    }
    const northFrostShatter = !!(
      !zeroMpFallback &&
      (skill.line === 1 || skill.line === 3) &&
      (getSynergyTier(p, 'north_frost') >= 3 || hasRelic(p, 'north_frost_3pc')) &&
      bState._synNorthFrostTurn !== bState.turn
    );
    if (northFrostShatter) relicAdd += 0.05;

    const addPool = Math.max(0.35, Number((1.00 + ampAdd + ringBonus + breakAdd + passiveAdd + relicAdd).toFixed(6)));

    // 场地与机制状态系数 FieldMod
    let fieldMod = 1.0;
    if (e.fireAura > 0) {
      fieldMod *= (1.0 - 0.10 * Math.min(3, e.fireAura));
    }
    if (e.aiType === 'wind_god_boss' && !(e.broken || (e.status && e.status.stagger > 0) || willInterrupt || willRiposte || brokeStillness)) {
      fieldMod *= 0.42;
    }
    if (e.windCushion && (e.mp || 0) > 0) {
      fieldMod *= 0.80;
    }
    const alivePackCount = bState.enemies ? bState.enemies.filter(x => x.hp > 0 && x.aiType === 'pack_wolf').length : 0;
    if (alivePackCount >= 3 && !skill.aoe) {
      fieldMod *= 0.45;
    }

    const elemMult = zeroMpFallback ? 1.0 : getElemMult(skill.elem, e.elem);

    // 艾诺正面镜冰阻挡：需以截断蓄势或镜霜壁反刺窗口破镜
    const mirrorRiposteReady = !!(p.status && p.status.mirrorRiposteWindow > 0 && skill.line === 1);
    const frostMirrorOpen = !!(skill.line === 3 && ampProfile && ampProfile.tier >= 1);
    if (e.mirrorGuard && !willInterrupt && !mirrorRiposteReady && !frostMirrorOpen) {
      return {
        dmg: 0, mult: elemMult, mcMult, addPool, mpCost,
        willInterrupt: false, willRiposte: false, mirrorBlocked: true,
        trueMagic: wandOn, ampTier: ampProfile.tier, ampPct: ampProfile.ampPct, extraLocks: 0,
      };
    }

    // 晦轮杖真实魔伤 vs 比值防御（K=80，穿抗封顶 75%）
    let defMit = 1.0;
    let defPierce = 0;
    if (wandOn && skill.atkKind === 'matk') {
      const solidArmor = Math.max(0, Math.min(0.85, Number(e.solidArmor) || 0));
      defMit = 1.0 - solidArmor;
    } else {
      const defVal = (skill.atkKind === 'atk' || zeroMpFallback)
        ? e.def
        : (skill.atkKind === 'hybrid' ? Math.min(e.def, e.mdef) * 0.75 : e.mdef);
      if (ampProfile && ampProfile.defPierce > 0) defPierce += ampProfile.defPierce;
      if (!zeroMpFallback && skill.innatePierce > 0) defPierce += skill.innatePierce;
      if (!zeroMpFallback && skill.elem === 'ice' && getSynergyTier(p, 'north_frost') >= 2) defPierce += 0.15;
      if (!zeroMpFallback && skill.elem === 'ice' && p.status && p.status.frostPierce > 0 && hasRelic(p, 'aino_frost_shard')) defPierce += 0.25;
      const clampedPierce = Math.min(COMBAT_BALANCE_V32.maxDefPierce, defPierce);
      const effDef = Math.max(0, defVal * (1 - clampedPierce));
      defMit = COMBAT_BALANCE_V32.defK / (COMBAT_BALANCE_V32.defK + effDef);
    }

    const raw = atkStat * pwr * addPool * fieldMod * elemMult * defMit;
    return {
      dmg: Math.max(4, Math.round(raw)),
      mult: elemMult,
      mcMult,
      addPool,
      ringBonus,
      mpCost,
      willInterrupt,
      willRiposte,
      rootStepParryTrigger,
      brokeStillness,
      mirrorRiposteReady,
      northFrostShatter,
      wandRefract: wandOn,
      trueMagic: wandOn,
      ampTier: ampProfile ? ampProfile.tier : 0,
      ampPct: ampProfile ? ampProfile.ampPct : 0,
      extraLocks: ampProfile ? ampProfile.extraLocks : 0,
      defPierce,
      defMit,
      zeroMpFallback,
    };
  }

  function computeTacticalForecast(bState, skill, targetEnemy) {
    if (!bState || !skill) return null;
    const p = bState.player;
    const e = targetEnemy || getPrimaryAliveEnemy(bState);
    if (!e) return null;
    const apCost = computeSkillApCost(bState, skill);
    const mpCost = computeSkillMpCost(p, skill);
    const zeroMpFallback = !!(skill.allowZeroMpFallback && p.mp < mpCost);
    const stance = e.intent ? e.intent.stance : 'HEAVY_WINDUP';
    const wandOn = !zeroMpFallback && isEclipseStaffForSkill(p, skill);

    if (!skill.power || skill.power <= 0) {
      const ampProf = computeAmpProfile(p, skill);
      const estShield = skill.shieldBase > 0 ? computeSkillShieldGain(p, skill, ampProf) : 0;
      const shieldMult = estShield > 0 && ampProf.shieldMult > 1.001 ? ampProf.shieldMult : 1.0;
      const estCrateGuard = (bState.crateHp != null) ? computeSkillCrateGuard(skill, ampProf) : 0;
      let headline = '稳固防线 / 战术身法';
      if (estShield > 0) {
        const ampTxt = shieldMult > 1.001 ? `（增幅 ${shieldMult.toFixed(2)}×）` : '';
        const crateTxt = estCrateGuard > 0 ? ` · 护箱 +${estCrateGuard}` : '';
        const fortTxt = (skill.fortressOnTier2 && ampProf.tier >= 2) ? ' · 钢霜壁垒' : '';
        headline = `预计实体护盾 +${estShield}${ampTxt}${crateTxt}${fortTxt}`;
      } else if (skill.afterimage) {
        headline = '风行残像（闪避常规攻击 · 抢占先手 · 下回合 +1 AP）';
      }
      return {
        skillId: skill.id,
        apCost,
        mpCost,
        dmgMin: 0,
        dmgMax: 0,
        estShield,
        shieldMult,
        estCrateGuard,
        elemMult: 1,
        mcMult: shieldMult,
        ampTier: ampProf.tier || 0,
        ampPct: ampProf.ampPct || 0,
        lockDamage: 0,
        manaReturn: 0,
        critChance: 0,
        trueMagic: false,
        willInterrupt: false,
        willRiposte: false,
        guardPenalty: false,
        mirrorBlocked: false,
        evadeBlocked: false,
        headline,
        kind: 'utility',
      };
    }

    const est = estimateSkillDamage(bState, skill, e, { zeroMpFallback });
    const critChance = getPlayerCritChance(p);
    const critMult = getPlayerCritMult(p);
    const bypassEvade = !!(skill.aoe || skill.sureHit || wandOn || stance === 'STAGGERED' || est.willRiposte || est.brokeStillness || skill.stripEvade);
    const evadeBlocked = !bypassEvade && e.evadeCharges > 0;
    const guardPenalty = !!((e.aiType === 'beatrice' || e.aiType === 'eastwing_boss') && stance === 'GUARD_COUNTER' && e.intent && e.intent.meltIceCounter && skill.elem === 'ice')
      || !!(e.aiType === 'wind_god_boss' && e.intent && e.intent.windGuardCounter && !skill.aoe);

    const dmgMin = (est.mirrorBlocked || evadeBlocked) ? 0 : est.dmg;
    const dmgMax = (est.mirrorBlocked || evadeBlocked) ? 0 : (critChance > 0 ? Math.round(est.dmg * critMult) : est.dmg);

    let effShield = e.shield || 0;
    if (wandOn && (e.shieldKind || 'magic') === 'magic') effShield = 0;
    else if (skill.pierceHalfShield) effShield = Math.floor(effShield * 0.5);
    const estHpLoss = Math.min(e.hp, Math.max(0, dmgMin - effShield));

    let manaReturn = 0;
    if (skill.mpRegenPct || zeroMpFallback) {
      manaReturn += Math.round((p.mmp || 0) * (skill.mpRegenPct || skill.zeroMpFallbackRegenPct || 0.06));
    }
    if (p.hasManaCycle && skill.elem !== 'phys' && !zeroMpFallback && estHpLoss > 0) {
      const jikanDouble = (skill.line === 5 && (est.willRiposte || est.willInterrupt) && getSynergyTier(p, 'jikan_blade') >= 2);
      manaReturn += jikanDouble ? estHpLoss * 2 : Math.round(estHpLoss * COMBAT_BALANCE_V32.manaCycleReturnRatio);
    }

    let lockDamage = 0;
    if (!(est.mirrorBlocked || evadeBlocked || zeroMpFallback)) {
      if (est.willInterrupt || est.willRiposte || est.brokeStillness) {
        lockDamage = getSkillBaseLockDamage(skill) + 1 + (est.extraLocks || 0);
      } else if (est.mult > 1.0) {
        lockDamage = getSkillBaseLockDamage(skill) + (est.extraLocks || 0);
      } else if ((est.extraLocks || 0) > 0) {
        lockDamage = est.extraLocks;
      }
      if (skill.aoe && lockDamage > 1) lockDamage = 1;
    }

    let headline = `预计伤害 ${dmgMin}${dmgMax > dmgMin ? `~${dmgMax}` : ''}`;
    let kind = 'normal';
    if (zeroMpFallback) {
      headline = `魔力不足兜底平斩（回蓝 +${manaReturn} MP）`;
      kind = 'normal';
    } else if (est.mirrorBlocked) {
      headline = '将被正面镜冰格挡（宜抓重术蓄势或镜霜壁反刺开窗）';
      kind = 'warn';
    } else if (evadeBlocked) {
      headline = `将被敌方闪避层抵消（余 ${e.evadeCharges} 层）`;
      kind = 'warn';
    } else if (guardPenalty) {
      headline = '敌方防反守势，强攻将招致反击！';
      kind = 'warn';
    } else if (est.rootStepParryTrigger) {
      headline = '✦ 寒锋斩·斩风瞬反！（截断真空连刃并获 +1 AP！）';
      kind = 'riposte';
    } else if (est.brokeStillness) {
      headline = '✦ 破风眼静滞！（震散风壁并打断圆心反制！）';
      kind = 'interrupt';
    } else if (est.willInterrupt) {
      headline = '✦ 触发截断破招！';
      kind = 'interrupt';
    } else if (est.willRiposte) {
      headline = '✦ 迎击突袭 2.10×（减伤 60% 并破闪！）';
      kind = 'riposte';
    } else if (wandOn) {
      headline = (e.solidArmor > 0)
        ? `✦ 晦轮杖真伤（实体甲阻尼 ${Math.round(e.solidArmor * 100)}%）`
        : '✦ 晦轮杖 100% 魔法真伤（无视法抗与魔法盾）！';
      kind = 'chain';
    }

    return {
      skillId: skill.id,
      apCost,
      mpCost: zeroMpFallback ? 0 : mpCost,
      dmgMin,
      dmgMax,
      estHpLoss,
      elemMult: est.mult,
      mcMult: est.mcMult,
      addPool: est.addPool,
      ampTier: est.ampTier || 0,
      ampPct: est.ampPct || 0,
      lockDamage,
      trueMagic: wandOn,
      manaReturn,
      critChance,
      willInterrupt: est.willInterrupt,
      willRiposte: est.willRiposte,
      rootStepParryTrigger: !!est.rootStepParryTrigger,
      brokeStillness: !!est.brokeStillness,
      guardPenalty,
      mirrorBlocked: !!est.mirrorBlocked,
      evadeBlocked,
      zeroMpFallback,
      headline,
      kind,
    };
  }
  /* =========================================================
     6. 战场状态与交互结算核心
     ========================================================= */
  let activeBattle = null;
  let _battleInstanceSeq = 0;

  function ensureValidTarget(b) {
    if (!b || !Array.isArray(b.enemies) || !b.enemies.length) return -1;
    const locked = b.enemies[b.targetIdx];
    if (locked && locked.hp > 0) return b.targetIdx;
    const idx = b.enemies.findIndex(e => e && e.hp > 0);
    if (idx >= 0) {
      b.targetIdx = idx;
      return idx;
    }
    return -1;
  }

  function getPrimaryAliveEnemy(b) {
    const idx = ensureValidTarget(b);
    return idx >= 0 ? b.enemies[idx] : null;
  }

  function refreshSkillCardsTargetPreviewInPlace(b, primary) {
    if (!b || b.headless || typeof document === 'undefined') return;
    const actGrid = document.getElementById('b-actions');
    if (!actGrid) return;
    const p = b.player;
    const targetStance = primary && primary.intent ? primary.intent.stance : '';
    const targetMoveKey = primary && primary.intent ? primary.intent.moveKey : '';
    const curAmpTier = (p && p.ampTier) || 0;
    actGrid.querySelectorAll('.cb-skill-card[data-sk]').forEach(btn => {
      const skId = btn.getAttribute('data-sk');
      const sk = TACTICAL_SKILLS[skId];
      if (!sk) return;
      const cd = p.cooldowns[skId] || 0;
      const usedUp = sk.maxUses && (p.usedMaxSkills[skId] || 0) >= sk.maxUses;
      const disabled = !!btn.disabled;
      const mpCostNow = computeSkillMpCost(p, sk);
      const zeroFallback = !!(sk.allowZeroMpFallback && p.mp < mpCostNow);
      const est = sk.power > 0 ? estimateSkillDamage(b, sk, primary, { zeroMpFallback: zeroFallback }) : null;

      let oppText = '';
      let oppCls = 'cb-opp-pill';
      if (!disabled && targetMoveKey === 'TEMPEST_VACUUM' && sk.counterLunge && !zeroFallback) {
        oppText = '✦ 斩风瞬反';
      } else if (!disabled && targetMoveKey === 'EYE_STILLNESS' && (sk.breakStillness || (isAmpableSkill(sk) && curAmpTier >= 2))) {
        oppText = '✦ 破风眼静滞';
      } else if (!disabled && targetStance === 'DUAL_CAST' && (sk.canInterrupt || (isAmpableSkill(sk) && !sk.aoe && curAmpTier >= 1))) {
        oppText = '✦ 可截断';
      } else if (!disabled && sk.counterLunge && targetStance === 'CLOSE_LUNGE' && !zeroFallback) {
        oppText = '✦ 迎击2.1×';
      } else if (!disabled && targetStance === 'UNDER_SEEP' && sk.severSeep) {
        oppText = '✦ 冻绝暗流';
      }
      btn.classList.toggle('opp-glow', !!oppText);
      const nameRow = btn.querySelector('.csc-name-row');
      if (nameRow) {
        let pill = nameRow.querySelector('.cb-opp-pill');
        if (oppText) {
          if (!pill) {
            pill = document.createElement('span');
            const armPill = nameRow.querySelector('.cb-arm-pill');
            if (armPill) nameRow.insertBefore(pill, armPill);
            else nameRow.appendChild(pill);
          }
          pill.className = oppCls;
          pill.textContent = oppText;
        } else if (pill) {
          pill.remove();
        }
      }
      const footSpan = btn.querySelector('.csc-foot > span:first-child');
      if (footSpan && !usedUp && cd <= 0 && est) {
        footSpan.textContent = est.mirrorBlocked ? '将被镜冰格挡' : `预计 ~${est.dmg}${sk.aoe ? ' (全体)' : ''}`;
      }
    });
  }

  function buildEnemyBuffChipsHTML(e) {
    if (!e) return '';
    const eBuffs = [];
    if (e.boss && (e.phase || 1) >= 2) eBuffs.push(`<span class="cb-buff-chip synergy">✦ 倾力变阵</span>`);
    if (e.broken) eBuffs.push(`<span class="cb-buff-chip gold">✦ 弱点击破 +10%</span>`);
    else if (e.maxLocks > 0 && e.hp > 0) eBuffs.push(`<span class="cb-buff-chip">锁 ${e.locks}/${e.maxLocks}</span>`);
    if (e.shield > 0) eBuffs.push(`<span class="cb-buff-chip shield">${e.shieldKind === 'solid' ? '实体盾' : '魔法盾'} ${e.shield}</span>`);
    if (e.solidArmor > 0) eBuffs.push(`<span class="cb-buff-chip">实体甲 ${Math.round(e.solidArmor * 100)}%</span>`);
    if (e.fireAura > 0) eBuffs.push(`<span class="cb-buff-chip gold">烈焰斗气×${e.fireAura}</span>`);
    if (e.evadeCharges > 0) eBuffs.push(`<span class="cb-buff-chip">闪避层×${e.evadeCharges}</span>`);
    if (e.status && e.status.evadeSealed > 0) eBuffs.push(`<span class="cb-buff-chip debuff">风步已封(${e.status.evadeSealed})</span>`);
    if (e.seepStacks > 0 && !e.seepSevered) eBuffs.push(`<span class="cb-buff-chip debuff">暗水线×${e.seepStacks}</span>`);
    if (e.seepSevered) eBuffs.push(`<span class="cb-buff-chip">暗流已冻绝</span>`);
    if (e.status && e.status.chill > 0) eBuffs.push(`<span class="cb-buff-chip">寒颤(${e.status.chill})</span>`);
    return eBuffs.join('');
  }
  function renderTargetDetailPane(b) {
    if (typeof document === 'undefined') return;
    const pane = document.getElementById('cb-target-detail-pane');
    if (!pane) return;
    if (!b || b.headless || !Array.isArray(b.enemies)) {
      pane.innerHTML = '';
      pane.classList.add('is-empty');
      pane.classList.remove('is-broken', 'is-phase2');
      pane.removeAttribute('data-eidx');
      return;
    }
    const primary = getPrimaryAliveEnemy(b);
    const tIdx = primary ? b.enemies.indexOf(primary) : -1;
    if (!primary || tIdx < 0) {
      pane.innerHTML = '';
      pane.classList.add('is-empty');
      pane.classList.remove('is-broken', 'is-phase2');
      pane.removeAttribute('data-eidx');
      return;
    }

    const intent = primary.intent || { stance: 'STAGGERED', moveName: '已倒下', dmg: 0 };
    const sm = STANCE_META[intent.stance] || STANCE_META.HEAVY_WINDUP;
    const traitHtml = primary.trait
      ? `<span class="cb-trait-wrap"><button type="button" class="cb-trait-pill">特性</button><span class="cb-trait-tip" role="tooltip">${primary.trait}</span></span>`
      : '';
    const hpPct = primary.nonLethalSpar
      ? 100
      : Math.max(0, Math.min(100, (primary.hp / Math.max(1, primary.mhp)) * 100));
    const hpLabel = primary.nonLethalSpar ? '切磋耐力（三击制）' : '生命值 HP';
    const hpVal = `${primary.nonLethalSpar ? '点到为止' : `${primary.hp}/${primary.mhp}`}${primary.shield ? ` (+盾${primary.shield})` : ''}`;

    const maxLocks = Math.max(0, Number(primary.maxLocks) || 0);
    const curLocks = primary.broken ? 0 : Math.max(0, Math.min(maxLocks, primary.locks != null ? primary.locks : maxLocks));
    let locksRowHtml = '';
    if (maxLocks > 0) {
      const gems = [];
      for (let i = 0; i < maxLocks; i++) {
        const solid = i < curLocks;
        gems.push(`<span class="cb-td-lock-gem${solid ? ' is-solid' : ' is-cracked'}" aria-hidden="true">${solid ? '◆' : '◇'}</span>`);
      }
      locksRowHtml = `
        <div class="cb-td-locks${primary.broken ? ' is-broken' : ''}" aria-label="破防锁 ${curLocks}/${maxLocks}">
          <span class="cb-td-locks-label">破防锁</span>
          <span class="cb-td-locks-gems">${gems.join('')}</span>
          <span class="cb-td-locks-val">${curLocks}/${maxLocks}${primary.broken ? ' · BREAK' : ''}</span>
        </div>`;
    }

    const dmgPillText = intent.dmg > 0
      ? (intent.shatterPlayerShield ? `预计 ${intent.dmg} · 破盾` : `预计 ${intent.dmg}`)
      : '失衡';
    const showNextTendency = hasRelic(b.player, 'belmont_schedule');
    const nextTendencyHtml = (showNextTendency && primary.hp > 0)
      ? `<div class="cb-td-next-tendency">✦ 下回合预判：${predictNextIntentTendency(primary, b)}</div>`
      : '';
    const eBuffsHtml = buildEnemyBuffChipsHTML(primary);

    pane.classList.remove('is-empty');
    pane.setAttribute('data-eidx', String(tIdx));
    pane.classList.toggle('is-broken', !!primary.broken);
    pane.classList.toggle('is-phase2', !!(primary.boss && (primary.phase || 1) >= 2));

    pane.innerHTML = `
      <div class="cb-td-head">
        <span class="cb-td-title" data-eidx="${tIdx}">${primary.name}</span>
        <span class="cb-td-badges cb-e-badges">
          ${traitHtml}
          <span class="cb-elem-tag elem-${primary.elem || 'phys'}">${ELEM_LABEL[primary.elem] || '剑术'}</span>
        </span>
      </div>
      <div class="cb-td-bars cb-bars-wrap">
        <div class="cb-stat-row">
          <div class="cb-stat-top">
            <span class="cb-stat-label">${hpLabel}</span>
            <span class="cb-stat-val">${hpVal}</span>
          </div>
          <div class="cb-stat-track">
            <div class="cb-stat-fill ehp" style="width:${hpPct.toFixed(1)}%"></div>
            <div class="cb-td-hp-preview cb-hp-preview" data-eidx="${tIdx}"></div>
          </div>
        </div>
        ${primary.mmp != null ? `
        <div class="cb-stat-row">
          <div class="cb-stat-top">
            <span class="cb-stat-label">魔力 MP</span>
            <span class="cb-stat-val">${primary.mp}/${primary.mmp}</span>
          </div>
          <div class="cb-stat-track">
            <div class="cb-stat-fill emp" style="width:${Math.max(0, Math.min(100, (primary.mp / Math.max(1, primary.mmp)) * 100)).toFixed(1)}%"></div>
          </div>
        </div>` : ''}
        ${locksRowHtml}
      </div>
      <div class="cb-td-intent stance-${intent.stance}">
        <div class="cb-td-intent-row">
          <span class="ib-stance-tag">${sm.short}</span>
          <span class="cb-td-move-name">${intent.moveName}</span>
          <span class="ib-dmg-pill">${dmgPillText}</span>
        </div>
        <div class="cb-td-intent-hint">${sm.hint}</div>
        ${nextTendencyHtml}
      </div>
      <div class="cb-td-buffs cb-buff-list">${eBuffsHtml}</div>
    `;

    const traitBtn = pane.querySelector('.cb-trait-pill');
    if (traitBtn) {
      traitBtn.onclick = ev => {
        ev.stopPropagation();
        const wrap = traitBtn.closest('.cb-trait-wrap');
        if (!wrap) return;
        const wasOpen = wrap.classList.contains('tip-open');
        const eZoneEl = document.getElementById('cb-enemy-zone');
        if (eZoneEl) {
          eZoneEl.querySelectorAll('.cb-intent-banner.tip-open, .cb-trait-wrap.tip-open').forEach(el => el.classList.remove('tip-open'));
        }
        pane.querySelectorAll('.cb-trait-wrap.tip-open').forEach(el => el.classList.remove('tip-open'));
        if (!wasOpen) wrap.classList.add('tip-open');
      };
    }
  }

  function applyTargetSelectionInPlace(b) {
    if (!b || b.headless || typeof document === 'undefined') return;
    const eZone = document.getElementById('cb-enemy-zone');
    if (eZone) {
      eZone.querySelectorAll('.cb-enemy-card').forEach(card => {
        const cIdx = Number(card.getAttribute('data-eidx'));
        card.classList.toggle('targeted', cIdx === b.targetIdx);
      });
    }
    const primary = getPrimaryAliveEnemy(b);
    if (primary) {
      const elEmoji = document.getElementById('b-emoji');
      const elName = document.getElementById('b-ename');
      const elHp = document.getElementById('b-ehp');
      const elHpNum = document.getElementById('b-ehp-num');
      if (elEmoji) elEmoji.textContent = primary.emoji || '';
      if (elName) elName.textContent = primary.name;
      if (elHp) elHp.style.width = `${Math.max(0, primary.hp / primary.mhp * 100)}%`;
      if (elHpNum) elHpNum.textContent = `${primary.hp}/${primary.mhp}`;
    }
    renderTargetDetailPane(b);
    refreshSkillCardsTargetPreviewInPlace(b, primary);
    updateOvercastPreviewUI(b, hoveredSkillId);
    emitCombatStateChange(b);
  }

  function selectTarget(idx, b) {
    b = b || activeBattle;
    if (!b || b.over || !Array.isArray(b.enemies)) return false;
    const target = b.enemies[idx];
    if (!target || target.hp <= 0) return false;
    b.targetIdx = idx;
    armedSkillId = null;
    if (!b.headless) applyTargetSelectionInPlace(b);
    return true;
  }

  let _logBatchDepth = 0;
  let _logScrollRaf = 0;

  function flushCombatLogDOM(b) {
    if (!b || b.headless || typeof document === 'undefined') return;
    if (!b._logDirty) return;
    const el = document.getElementById('b-log');
    if (!el) return;
    b._logDirty = false;
    el.innerHTML = b.log.join('<br>');
    if (!isJsdomEnv() && typeof global.requestAnimationFrame === 'function') {
      if (!_logScrollRaf) {
        _logScrollRaf = global.requestAnimationFrame(() => {
          _logScrollRaf = 0;
          const cur = document.getElementById('b-log');
          if (cur) cur.scrollTop = 1e6;
        });
      }
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }

  function pushLog(b, html) {
    if (!b) return;
    b.log.push(html);
    if (b.log.length > 70) b.log.shift();
    b.recentLogs = b.log.slice(-14);
    b._logDirty = true;
    if (_logBatchDepth === 0 && !b.headless && typeof document !== 'undefined') {
      flushCombatLogDOM(b);
    }
  }

  function spawnBanner(b, text, kind) {
    if (!b || b.headless || typeof document === 'undefined') return;
    const layer = document.getElementById('cb-callout-layer');
    if (!layer) return;
    const div = document.createElement('div');
    div.className = 'cb-banner-fx ' + (kind || 'interrupt');
    div.textContent = text;
    layer.appendChild(div);
    trackVfxTimer(() => { if (div.parentNode) div.remove(); }, 920);
  }

  /* =========================================================
     6.5 AAA Combat-Feel ("Juice") & Elemental Ice/Water VFX
     ========================================================= */
  const VFX_FLASH_STAMPS = [];
  const VFX_MAX_FLASHES_PER_SEC = 2; // WCAG 2.3.1 safe (strictly <= 2/sec)
  const _activeVfxTimers = new Set();
  let _vfxSvgSeq = 0;
  let _hitStopId = 0;
  let _hitStopTimer = null;

  const TRAUMA_STATE = {
    trauma: 0,
    t: 0,
    rafId: 0,
    lastTs: 0,
    decay: 1.45,
    maxX: 11,
    maxY: 7,
    maxRoll: 0.65,
    strength: 1.0,
  };

  function prefersReducedMotion() {
    try {
      return !!(
        typeof global !== 'undefined' &&
        typeof global.matchMedia === 'function' &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch (e) {
      return false;
    }
  }

  function trackVfxTimer(fn, ms) {
    let tid = null;
    let done = false;
    tid = setTimeout(() => {
      done = true;
      if (tid != null) _activeVfxTimers.delete(tid);
      fn();
    }, ms);
    if (!done && tid != null) {
      if (typeof tid.unref === 'function') tid.unref();
      _activeVfxTimers.add(tid);
    }
    return tid;
  }

  function canTriggerVfxFlash() {
    if (prefersReducedMotion()) return false;
    const now = Date.now();
    while (VFX_FLASH_STAMPS.length && now - VFX_FLASH_STAMPS[0] >= 1000) {
      VFX_FLASH_STAMPS.shift();
    }
    if (VFX_FLASH_STAMPS.length >= VFX_MAX_FLASHES_PER_SEC) return false;
    VFX_FLASH_STAMPS.push(now);
    return true;
  }

  function resetCombatTrauma() {
    if (TRAUMA_STATE.rafId && typeof global.cancelAnimationFrame === 'function') {
      global.cancelAnimationFrame(TRAUMA_STATE.rafId);
    }
    TRAUMA_STATE.rafId = 0;
    TRAUMA_STATE.trauma = 0;
    TRAUMA_STATE.lastTs = 0;
    if (typeof document !== 'undefined') {
      const field = document.querySelector('#battle-screen .cb-arena-field');
      if (field) field.style.transform = '';
    }
  }

  function stepCombatTrauma(ts) {
    TRAUMA_STATE.rafId = 0;
    if (typeof document === 'undefined' || prefersReducedMotion()) {
      resetCombatTrauma();
      return;
    }
    const bs = document.getElementById('battle-screen');
    const field = bs ? bs.querySelector('.cb-arena-field') : null;
    if (!field || (bs && bs.classList.contains('hidden'))) {
      resetCombatTrauma();
      return;
    }
    const now = typeof ts === 'number' ? ts : Date.now();
    const realDt = TRAUMA_STATE.lastTs > 0
      ? Math.min(0.05, Math.max(0.001, (now - TRAUMA_STATE.lastTs) / 1000))
      : 0.016;
    TRAUMA_STATE.lastTs = now;

    TRAUMA_STATE.trauma = Math.max(0, TRAUMA_STATE.trauma - TRAUMA_STATE.decay * realDt);
    if (TRAUMA_STATE.trauma <= 0.001) {
      TRAUMA_STATE.trauma = 0;
      TRAUMA_STATE.lastTs = 0;
      field.style.transform = '';
      return;
    }

    TRAUMA_STATE.t += realDt * 30.0;
    const shake = TRAUMA_STATE.trauma * TRAUMA_STATE.trauma * TRAUMA_STATE.strength;
    const offsetX = TRAUMA_STATE.maxX * shake * Math.sin(TRAUMA_STATE.t * 1.7);
    const offsetY = TRAUMA_STATE.maxY * shake * Math.sin(TRAUMA_STATE.t * 2.3);
    const roll = TRAUMA_STATE.maxRoll * shake * Math.sin(TRAUMA_STATE.t * 1.1);
    field.style.transform = `translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0) rotate(${roll.toFixed(2)}deg)`;

    if (typeof global.requestAnimationFrame === 'function') {
      TRAUMA_STATE.rafId = global.requestAnimationFrame(stepCombatTrauma);
    }
  }

  function addCombatTrauma(amount, b) {
    const battle = b !== undefined ? b : activeBattle;
    if (battle && battle.headless) return 0;
    const add = Math.max(0, Math.min(1, Number(amount) || 0));
    if (add <= 0) return TRAUMA_STATE.trauma;

    if (prefersReducedMotion()) {
      TRAUMA_STATE.trauma = 0;
      return 0;
    }

    TRAUMA_STATE.trauma = Math.min(1, TRAUMA_STATE.trauma + add);
    if (typeof document === 'undefined' || isJsdomEnv() || typeof global.requestAnimationFrame !== 'function') {
      return TRAUMA_STATE.trauma;
    }

    if (!TRAUMA_STATE.rafId) {
      TRAUMA_STATE.lastTs = 0;
      TRAUMA_STATE.rafId = global.requestAnimationFrame(stepCombatTrauma);
    }
    return TRAUMA_STATE.trauma;
  }

  function triggerImpactHitStop(durationMs) {
    if (typeof document === 'undefined' || prefersReducedMotion() || isJsdomEnv()) return;
    const field = document.querySelector('#battle-screen .cb-arena-field');
    if (!field) return;
    _hitStopId += 1;
    const myId = _hitStopId;
    const dur = Math.max(40, Math.min(140, Number(durationMs) || 75));
    field.classList.add('cb-hitstop-75');
    if (_hitStopTimer) {
      clearTimeout(_hitStopTimer);
      _activeVfxTimers.delete(_hitStopTimer);
      _hitStopTimer = null;
    }
    _hitStopTimer = trackVfxTimer(() => {
      if (myId === _hitStopId) {
        _hitStopTimer = null;
        const curField = document.querySelector('#battle-screen .cb-arena-field');
        if (curField) curField.classList.remove('cb-hitstop-75');
      }
    }, dur);
  }

  function clearAllJuiceVfx(opts) {
    const preserveWaveContext = !!(opts && opts.preserveWaveContext);
    resetCombatTrauma();
    if (_logScrollRaf && typeof global.cancelAnimationFrame === 'function') {
      global.cancelAnimationFrame(_logScrollRaf);
    }
    _logScrollRaf = 0;
    _hitStopId += 1;
    _hitStopTimer = null;
    _activeVfxTimers.forEach(tid => clearTimeout(tid));
    _activeVfxTimers.clear();
    if (global.CombatPixelVFX) {
      if (preserveWaveContext && typeof global.CombatPixelVFX.clearEffects === 'function') {
        global.CombatPixelVFX.clearEffects();
      } else if (typeof global.CombatPixelVFX.cleanup === 'function') {
        global.CombatPixelVFX.cleanup();
      }
    }
    if (typeof document !== 'undefined') {
      const field = document.querySelector('#battle-screen .cb-arena-field');
      if (field) field.classList.remove('cb-hitstop', 'cb-hitstop-75');
      const fl = document.getElementById('cb-vfx-flash');
      if (fl) fl.classList.remove('active');
      document.querySelectorAll('#battle-screen .cb-elem-vfx-layer, #battle-screen .cb-phase2-banner').forEach(el => el.remove());
    }
  }

  function buildElementVfxMarkup(vfxKind, allowFlash) {
    const uid = ++_vfxSvgSeq;
    if (vfxKind === 'water') {
      const drops = [
        { dx: -56, dy: -46, rot: -48, d: 0 },
        { dx: -16, dy: -66, rot: -12, d: 25 },
        { dx: 34, dy: -58, rot: 28, d: 15 },
        { dx: 66, dy: -20, rot: 72, d: 35 },
        { dx: 54, dy: 34, rot: 124, d: 20 },
        { dx: 8, dy: 56, rot: 170, d: 45 },
        { dx: -44, dy: 44, rot: -136, d: 30 },
        { dx: -68, dy: -4, rot: -92, d: 15 },
      ];
      return `
        <svg class="cb-elem-vfx-svg" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <radialGradient id="cbWaterWash_${uid}" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#e0f2fe" stop-opacity="${allowFlash ? '0.42' : '0.18'}"/>
              <stop offset="68%" stop-color="#38bdf8" stop-opacity="0.16"/>
              <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="cbDropGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f8fafc"/>
              <stop offset="55%" stop-color="#38bdf8"/>
              <stop offset="100%" stop-color="#1d4ed8"/>
            </linearGradient>
          </defs>
          <circle class="cb-vfx-water-ring cb-vfx-flash-core" cx="100" cy="100" r="36" fill="url(#cbWaterWash_${uid})" stroke="#f8fafc" stroke-width="2.2" style="--delay:0ms"/>
          <circle class="cb-vfx-water-ring" cx="100" cy="100" r="32" fill="none" stroke="rgba(14,116,144,0.58)" stroke-width="1.2" style="--delay:0ms"/>
          <circle class="cb-vfx-water-ring" cx="100" cy="100" r="46" fill="none" stroke="#38bdf8" stroke-width="3.2" stroke-opacity="0.42" style="--delay:70ms"/>
          <circle class="cb-vfx-water-ring" cx="100" cy="100" r="46" fill="none" stroke="#e0f2fe" stroke-width="1.5" style="--delay:70ms"/>
          <circle class="cb-vfx-water-ring" cx="100" cy="100" r="56" fill="none" stroke="#f0f9ff" stroke-width="1.15" stroke-dasharray="16 7 7 5" stroke-opacity="0.88" style="--delay:135ms"/>
          ${drops.map(p => `
            <g class="cb-vfx-water-drop" style="--dx:${p.dx}px;--dy:${p.dy}px;--rot:${p.rot}deg;--delay:${p.d}ms">
              <path d="M100,87 C104.5,94 105.5,99.5 100,103 C94.5,99.5 95.5,94 100,87 Z" fill="url(#cbDropGrad_${uid})" stroke="#f8fafc" stroke-width="0.95"/>
              <circle cx="98.6" cy="96.2" r="1.35" fill="#ffffff"/>
            </g>
          `).join('')}
        </svg>
      `;
    }

    if (vfxKind === 'sword') {
      const sparks = [
        { dx: -54, dy: 42, d: 35 },
        { dx: 58, dy: -46, d: 20 },
        { dx: -26, dy: 58, d: 55 },
        { dx: 36, dy: -62, d: 45 },
      ];
      return `
        <svg class="cb-elem-vfx-svg" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="cbSlashGrad_${uid}" x1="12%" y1="88%" x2="88%" y2="12%">
              <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.22"/>
              <stop offset="38%" stop-color="#2563eb" stop-opacity="0.88"/>
              <stop offset="72%" stop-color="#38bdf8" stop-opacity="0.96"/>
              <stop offset="100%" stop-color="#ffffff" stop-opacity="1"/>
            </linearGradient>
          </defs>
          <path class="cb-vfx-slash-outer" d="M 22,160 Q 94,76 180,26 Q 114,104 34,172 Z" fill="url(#cbSlashGrad_${uid})"/>
          <path class="cb-vfx-slash-core cb-vfx-flash-core" d="M 18,164 Q 98,80 184,22" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>
          <path class="cb-vfx-slash-trail" d="M 38,176 Q 112,96 176,44" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.88"/>
          <g class="cb-vfx-core-glint cb-vfx-flash-core">
            <polygon points="102,68 108,90 130,96 108,102 102,124 96,102 74,96 96,90" fill="#ffffff" stroke="#38bdf8" stroke-width="1.1"/>
            <circle cx="102" cy="96" r="6" fill="#e0f2fe" opacity="${allowFlash ? '0.92' : '0.35'}"/>
          </g>
          ${sparks.map(s => `
            <polygon class="cb-vfx-ice-glint" points="100,95 103,100 100,105 97,100" fill="#e0f2fe" style="--dx:${s.dx}px;--dy:${s.dy}px;--delay:${s.d}ms"/>
          `).join('')}
        </svg>
      `;
    }

    if (vfxKind === 'prism') {
      const splinters = [
        { dx: -64, dy: -50, spin: -42, d: 0 },
        { dx: 58, dy: -56, spin: 38, d: 20 },
        { dx: 72, dy: 12, spin: 54, d: 10 },
        { dx: 44, dy: 62, spin: -36, d: 30 },
        { dx: -48, dy: 60, spin: 48, d: 15 },
        { dx: -72, dy: 8, spin: -52, d: 25 },
      ];
      return `
        <svg class="cb-elem-vfx-svg" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="cbPrismAxis_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="55%" stop-color="#7dd3fc"/>
              <stop offset="100%" stop-color="#1d4ed8"/>
            </linearGradient>
            <linearGradient id="cbPrismGold_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="50%" stop-color="#bae6fd"/>
              <stop offset="100%" stop-color="#38bdf8"/>
            </linearGradient>
          </defs>
          <polygon class="cb-vfx-prism-ring" points="100,44 139,61 156,100 139,139 100,156 61,139 44,100 61,61" fill="none" stroke="#e0f2fe" stroke-width="2" stroke-opacity="0.92"/>
          <polygon class="cb-vfx-prism-ring" points="100,58 142,100 100,142 58,100" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.86"/>
          <g class="cb-vfx-prism-star cb-vfx-flash-core">
            <polygon points="100,18 110,88 182,100 110,112 100,182 90,112 18,100 90,88" fill="url(#cbPrismAxis_${uid})" stroke="#ffffff" stroke-width="1.2"/>
            <polygon points="100,48 114,86 152,100 114,114 100,152 86,114 48,100 86,86" fill="url(#cbPrismGold_${uid})" transform="rotate(45 100 100)" opacity="0.9"/>
            <polygon points="100,82 118,100 100,118 82,100" fill="#ffffff" opacity="${allowFlash ? '0.96' : '0.4'}"/>
          </g>
          ${splinters.map(sp => `
            <polygon class="cb-vfx-prism-splinter" points="100,88 109,104 94,107" fill="url(#cbPrismAxis_${uid})" stroke="#ffffff" stroke-width="0.9" style="--dx:${sp.dx}px;--dy:${sp.dy}px;--spin:${sp.spin}deg;--delay:${sp.d}ms"/>
          `).join('')}
        </svg>
      `;
    }

    // Default: 'ice' — 6 faceted cobalt/ice-white polygon shards + expanding frost-ring shockwave
    const shards = [
      { dx: -18, dy: -66, rot: -15, d: 0 },
      { dx: 54, dy: -40, rot: 54, d: 18 },
      { dx: 64, dy: 28, rot: 112, d: 10 },
      { dx: 12, dy: 68, rot: 170, d: 28 },
      { dx: -56, dy: 42, rot: -126, d: 14 },
      { dx: -64, dy: -26, rot: -68, d: 22 },
    ];
    const dust = [
      { dx: 34, dy: -62, d: 25 },
      { dx: 70, dy: -8, d: 40 },
      { dx: 36, dy: 58, d: 30 },
      { dx: -36, dy: 62, d: 45 },
      { dx: -70, dy: 12, d: 20 },
      { dx: -40, dy: -56, d: 35 },
    ];
    return `
      <svg class="cb-elem-vfx-svg" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="cbIceDark_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="55%" stop-color="#2563eb"/>
            <stop offset="100%" stop-color="#1e3a8a"/>
          </linearGradient>
          <linearGradient id="cbIceBright_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="55%" stop-color="#bae6fd"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
        </defs>
        <polygon class="cb-vfx-frost-ring" points="100,48 145,74 145,126 100,152 55,126 55,74" fill="none" stroke="#e0f2fe" stroke-width="2.1"/>
        <circle class="cb-vfx-frost-ring-inner" cx="100" cy="100" r="38" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-opacity="0.88"/>
        <polygon class="cb-vfx-frost-ring-inner cb-vfx-flash-core" points="100,82 118,100 100,118 82,100" fill="#e0f2fe" opacity="${allowFlash ? '0.78' : '0.26'}"/>
        ${shards.map(sh => `
          <g class="cb-vfx-ice-shard" style="--dx:${sh.dx}px;--dy:${sh.dy}px;--rot:${sh.rot}deg;--delay:${sh.d}ms">
            <polygon points="100,66 92.5,98 100,108" fill="url(#cbIceDark_${uid})"/>
            <polygon points="100,66 107.5,98 100,108" fill="url(#cbIceBright_${uid})"/>
            <line x1="100" y1="68" x2="100" y2="106" stroke="#ffffff" stroke-width="1.25" stroke-opacity="0.96"/>
            <polygon points="100,66 107.5,98 100,108 92.5,98" fill="none" stroke="#e0f2fe" stroke-width="0.9"/>
          </g>
        `).join('')}
        ${dust.map(pt => `
          <polygon class="cb-vfx-ice-glint" points="100,96 103,100 100,104 97,100" fill="#f0f9ff" style="--dx:${pt.dx}px;--dy:${pt.dy}px;--delay:${pt.d}ms"/>
        `).join('')}
      </svg>
    `;
  }

  function normalizeElementVfxKind(rawKind) {
    const k = String(rawKind || 'ice').toLowerCase();
    if (k === 'water' || k === 'hydro') return 'water';
    if (k === 'sword' || k === 'phys' || k === 'slash' || k === 'wind') return 'sword';
    if (k === 'insight' || k === 'break' || k === 'crit' || k === 'prism' || k === 'shatter') return 'prism';
    return 'ice';
  }

  function spawnCombatElementVFX(arg1, arg2, arg3, arg4) {
    let b = activeBattle;
    let rawKind = 'ice';
    let side = 'enemy';
    let enemyIdx = 0;
    let targetEl = null;
    let skipHitStop = false;

    if (arg1 && typeof arg1 === 'object' && ('enemies' in arg1 || 'player' in arg1 || 'headless' in arg1)) {
      b = arg1;
      if (arg2 === 'enemy' || arg2 === 'player') {
        side = arg2;
        rawKind = arg3 || 'ice';
        enemyIdx = typeof arg4 === 'number' ? arg4 : 0;
      } else {
        rawKind = arg2 || 'ice';
        if (typeof arg3 === 'object' && arg3) {
          side = arg3.side || 'enemy';
          enemyIdx = arg3.enemyIdx != null ? arg3.enemyIdx : (b.targetIdx || 0);
          targetEl = arg3.targetEl || null;
          skipHitStop = !!arg3.skipHitStop;
        } else if (typeof arg3 === 'string') {
          side = arg3;
          enemyIdx = typeof arg4 === 'number' ? arg4 : (b.targetIdx || 0);
        } else if (typeof arg3 === 'number') {
          enemyIdx = arg3;
        } else {
          enemyIdx = b.targetIdx || 0;
        }
      }
    } else {
      rawKind = typeof arg1 === 'string' ? arg1 : 'ice';
      if (arg2 && typeof arg2 === 'object') {
        if (arg2.b) b = arg2.b;
        side = arg2.side || 'enemy';
        enemyIdx = arg2.enemyIdx != null ? arg2.enemyIdx : ((b && b.targetIdx) || 0);
        targetEl = arg2.targetEl || null;
        skipHitStop = !!arg2.skipHitStop;
      } else if (typeof arg2 === 'number') {
        enemyIdx = arg2;
      } else if (arg2 === 'player' || arg2 === 'enemy' || arg2 === 'ally') {
        side = arg2;
        enemyIdx = typeof arg3 === 'number' ? arg3 : ((b && b.targetIdx) || 0);
      } else {
        enemyIdx = (b && b.targetIdx) || 0;
      }
    }

    if ((b && b.headless) || typeof document === 'undefined') return null;

    let host = targetEl;
    if (!host) {
      if (side === 'player') {
        const pPort = document.getElementById('cb-p-portrait');
        host = (pPort && pPort.closest('.cb-standee-wrap'))
          || document.querySelector('#battle-screen #cb-player-stage .cb-standee-wrap:not(.cb-ally-standee)')
          || document.getElementById('cb-player-stage');
      } else if (side === 'ally') {
        host = document.querySelector('#battle-screen #cb-ally-vanguard-slot .cb-standee-wrap')
          || document.getElementById('cb-ally-vanguard-slot')
          || document.getElementById('cb-player-stage');
      } else {
        host = document.querySelector(`#battle-screen .cb-enemy-card[data-eidx="${enemyIdx}"] .cb-e-stage`)
          || document.querySelector('#battle-screen .cb-enemy-card .cb-e-stage');
      }
    }
    if (!host) return null;

    const vfxKind = normalizeElementVfxKind(rawKind);
    const allowFlash = canTriggerVfxFlash();

    const layer = document.createElement('div');
    layer.className = `cb-elem-vfx-layer vfx-${vfxKind}${allowFlash ? '' : ' vfx-dim-flash'}`;
    layer.setAttribute('data-vfx-kind', vfxKind);
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = buildElementVfxMarkup(vfxKind, allowFlash);
    host.appendChild(layer);

    if (vfxKind === 'prism' && !skipHitStop) {
      triggerImpactHitStop(75);
    }

    trackVfxTimer(() => {
      if (layer.parentNode) layer.remove();
    }, 650);

    return layer;
  }

  function queueElementVFX(b, kind, side, enemyIdx, opts) {
    if (!b || b.headless) return;
    b._pendingElementVFX = b._pendingElementVFX || [];
    b._pendingElementVFX.push({
      kind: kind || 'ice',
      side: side || 'enemy',
      enemyIdx: enemyIdx || 0,
      waveIdx: b.waveIdx || 0,
      skipHitStop: !!(opts && opts.skipHitStop),
    });
  }

  function triggerShake(b, heavy) {
    if (typeof b === 'boolean') {
      heavy = b;
      b = activeBattle;
    }
    const battle = b || activeBattle;
    if (!battle || battle.headless || typeof document === 'undefined') return;
    addCombatTrauma(heavy ? 0.64 : 0.32, battle);
  }

  const triggerScreenShake = triggerShake;

  function spawnCombatFloat(b, side, text, kind, enemyIdx) {
    if (!b || b.headless || typeof document === 'undefined') return;
    const layer = document.getElementById('cb-callout-layer');
    if (!layer) return;
    const div = document.createElement('div');
    div.className = 'cb-float-num ' + (kind || 'dmg');
    div.textContent = text;

    let positioned = false;
    if (!isJsdomEnv()) {
      const field = document.querySelector('#battle-screen .cb-arena-field');
      if (field && typeof field.getBoundingClientRect === 'function') {
        const fRect = field.getBoundingClientRect();
        if (fRect && fRect.width > 40 && fRect.height > 40) {
          let anchorEl = null;
          if (side === 'player') {
            anchorEl = document.getElementById('cb-p-portrait')
              || document.querySelector('#cb-player-stage .cb-standee-wrap:not(.cb-ally-standee)');
          } else if (side === 'ally') {
            anchorEl = document.getElementById('cb-ally-vanguard-slot')
              || document.querySelector('#cb-ally-formation .cb-ally-standee');
          } else {
            const idx = Math.max(0, Number(enemyIdx) || 0);
            anchorEl = document.querySelector(`#cb-enemy-zone .cb-enemy-card[data-eidx="${idx}"] .cb-e-stage`)
              || document.querySelector(`#cb-enemy-zone .cb-enemy-card[data-eidx="${idx}"]`);
          }
          if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
            const aRect = anchorEl.getBoundingClientRect();
            if (aRect && aRect.width > 4 && aRect.height > 4) {
              const cx = (aRect.left + aRect.width * 0.5) - fRect.left;
              const yRatio = kind === 'mp' ? 0.44 : kind === 'shield' ? 0.34 : side === 'enemy' ? 0.22 : 0.24;
              const cy = (aRect.top + aRect.height * yRatio) - fRect.top;
              const leftPct = Math.max(6, Math.min(94, (cx / fRect.width) * 100));
              const topPct = Math.max(8, Math.min(82, (cy / fRect.height) * 100));
              div.style.left = leftPct.toFixed(1) + '%';
              div.style.top = topPct.toFixed(1) + '%';
              positioned = true;
            }
          }
        }
      }
    }

    if (!positioned) {
      if (side === 'player') {
        const hasAllies = !!(b.allies && b.allies.length > 0);
        div.style.left = hasAllies ? '12%' : '22%';
        div.style.top = kind === 'mp' ? '44%' : kind === 'shield' ? '36%' : '28%';
      } else if (side === 'ally') {
        div.style.left = '27%';
        div.style.top = kind === 'shield' ? '36%' : '28%';
      } else {
        const total = Math.max(1, (b.enemies || []).length);
        const idx = Math.max(0, Math.min(total - 1, enemyIdx || 0));
        const pct = 58 + ((idx + 0.5) / total) * 36;
        div.style.left = pct.toFixed(1) + '%';
        div.style.top = '34%';
      }
    }

    layer.appendChild(div);
    trackVfxTimer(() => { if (div.parentNode) div.remove(); }, 1060);
  }

  function queueHitPulse(b, side, enemyIdx) {
    if (!b || b.headless) return;
    b._pendingHitPulses = b._pendingHitPulses || [];
    b._pendingHitPulses.push({ side, enemyIdx: enemyIdx || 0 });
  }

  function triggerPalaceFlash() {
    if (typeof document === 'undefined') return;
    const pxApi = getPixelVfxApi();
    if (pxApi && typeof pxApi.playPalaceTimeStop === 'function') {
      pxApi.playPalaceTimeStop();
    }
    if (!canTriggerVfxFlash()) return;
    const fl = document.getElementById('cb-vfx-flash');
    if (!fl) return;
    fl.classList.remove('active');
    void fl.offsetWidth;
    fl.classList.add('active');
    trackVfxTimer(() => fl.classList.remove('active'), 480);
  }

  function triggerBreakJuice(b, soundKind) {
    if (!b || b.headless || typeof document === 'undefined') return;
    safeSfx(soundKind || 'break_chime');
    try {
      if (global.AmbientFX && typeof global.AmbientFX.triggerFrostSlash === 'function') {
        global.AmbientFX.triggerFrostSlash();
      }
    } catch (e) {}
    if (prefersReducedMotion()) return;
    triggerImpactHitStop(75);
    const field = document.querySelector('#battle-screen .cb-arena-field');
    if (field) {
      field.classList.remove('cb-hitstop');
      void field.offsetWidth;
      field.classList.add('cb-hitstop');
      trackVfxTimer(() => field.classList.remove('cb-hitstop'), 240);
    }
  }

  function spawnPhase2Overlay(b, boss, title, quote, theme) {
    if (!b || b.headless || typeof document === 'undefined') return;
    const root = document.getElementById('battle-screen');
    if (!root) return;
    const prev = root.querySelector('.cb-phase2-banner');
    if (prev) prev.remove();
    const el = document.createElement('div');
    el.className = `cb-phase2-banner theme-${theme || 'ember'}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <div class="cb-p2-stripe" aria-hidden="true"></div>
      <div class="cb-p2-inner">
        <div class="cb-p2-title">${title || '绝境变阵 · 全力以赴'}</div>
        <div class="cb-p2-boss">${boss ? boss.name : ''}</div>
        <div class="cb-p2-quote">${quote || ''}</div>
      </div>
      <div class="cb-p2-stripe bottom" aria-hidden="true"></div>
    `;
    root.appendChild(el);
    trackVfxTimer(() => { if (el.parentNode) el.remove(); }, 2200);
  }

  function emitCombatVoiceCue(b, cueKey, meta) {
    if (!b || b.headless || !cueKey) return false;
    const payload = Object.assign({ cueKey, stageId: b.id, waveIdx: b.waveIdx || 0 }, meta || {});
    try {
      if (typeof window !== 'undefined' && window.VoiceEngine && typeof window.VoiceEngine.playCombatCue === 'function') {
        window.VoiceEngine.playCombatCue(cueKey, payload);
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('combat:voice', { detail: payload }));
      }
    } catch (e) {}
    return true;
  }

  const _pendingAsyncDelays = new Set();
  const _activeGateBrokers = new Set();
  const _activeVfxHandles = new Set();

  function parseGateCallbackArgs(arg0, arg1) {
    if (arg0 && typeof arg0 === 'object') {
      const idx = arg0.beatIdx != null
        ? arg0.beatIdx
        : (arg0.beatIndex != null ? arg0.beatIndex : (arg0.gateIdx != null ? arg0.gateIdx : 0));
      return { k: Math.max(0, Number(idx) || 0), meta: arg0 };
    }
    return {
      k: Math.max(0, Number(arg0) || 0),
      meta: (arg1 && typeof arg1 === 'object') ? arg1 : {},
    };
  }

  function createBeatGateBroker(gateCount) {
    const readyMeta = new Map();
    const waiters = new Map();
    const timers = new Set();
    let aborted = false;

    const broker = {
      gateCount: Math.max(1, Number(gateCount) || 1),
      notifyReady(beatIdx, meta) {
        if (aborted) return;
        const k = Math.max(0, Number(beatIdx) || 0);
        const m = (meta && typeof meta === 'object') ? meta : {};
        if (waiters.has(k)) {
          const w = waiters.get(k);
          waiters.delete(k);
          if (w.tid != null) {
            clearTimeout(w.tid);
            timers.delete(w.tid);
          }
          w.resolve({ timedOut: false, aborted: false, meta: m });
        } else {
          readyMeta.set(k, m);
        }
      },
      waitForBeat(beatIdx, timeoutMs) {
        const k = Math.max(0, Number(beatIdx) || 0);
        if (aborted) return Promise.resolve({ timedOut: true, aborted: true, meta: {} });
        if (readyMeta.has(k)) {
          const m = readyMeta.get(k);
          readyMeta.delete(k);
          return Promise.resolve({ timedOut: false, aborted: false, meta: m });
        }
        return new Promise(resolve => {
          const tid = setTimeout(() => {
            timers.delete(tid);
            const cur = waiters.get(k);
            if (cur && cur.tid === tid) {
              waiters.delete(k);
              resolve({ timedOut: true, aborted: false, meta: {} });
            }
          }, Math.max(200, Number(timeoutMs) || 2500));
          if (tid && typeof tid.unref === 'function') tid.unref();
          timers.add(tid);
          waiters.set(k, { resolve, tid });
        });
      },
      abort() {
        aborted = true;
        timers.forEach(tid => { try { clearTimeout(tid); } catch (e) {} });
        timers.clear();
        waiters.forEach(w => {
          try { w.resolve({ timedOut: true, aborted: true, meta: {} }); } catch (e) {}
        });
        waiters.clear();
        readyMeta.clear();
      },
    };
    _activeGateBrokers.add(broker);
    return broker;
  }

  function releaseGateBroker(broker) {
    if (!broker) return;
    _activeGateBrokers.delete(broker);
    try { broker.abort(); } catch (e) {}
  }

  function abortVfxHandle(h) {
    if (!h) return;
    _activeVfxHandles.delete(h);
    try { if (typeof h.releaseAll === 'function') h.releaseAll(); } catch (e) {}
    try { if (typeof h.abort === 'function') h.abort(); } catch (e) {}
    try { if (typeof h.finishActorReturn === 'function') h.finishActorReturn(); } catch (e) {}
  }

  function isUsableVfxHandle(h, pxApi) {
    if (!h || typeof h.releaseGate !== 'function') return false;
    if (h.noop || h.isNoop) return false;
    if (pxApi && typeof pxApi.isEnabled === 'function' && !pxApi.isEnabled()) return false;
    return true;
  }

  function buildSkillBeatPlan(skillId, primaryPos, targetActorKeys, aliveCount, effBeats) {
    const ctr = global.CombatTimingRing;
    const spec = (ctr && typeof ctr.getBeatSpec === 'function')
      ? ctr.getBeatSpec(skillId, { aliveCount: Math.max(1, aliveCount || 1), targetActorKeys })
      : null;
    const total = Math.max(1, effBeats || (spec && spec.beats) || 1);
    let keys = (ctr && typeof ctr.generateKeySequence === 'function')
      ? ctr.generateKeySequence(spec || skillId, { aliveCount: Math.max(1, aliveCount || 1) })
      : [];
    const pool = ['Q', 'W', 'E', 'A', 'S', 'D'];
    if (!Array.isArray(keys) || keys.length !== total) {
      keys = [];
      if (skillId === 'ice_2_prism') {
        const fixed = pool[Math.floor(Math.random() * pool.length)];
        for (let i = 0; i < total; i++) keys.push(fixed);
      } else {
        let prev = null;
        for (let i = 0; i < total; i++) {
          const cands = pool.filter(ch => ch !== prev);
          const pick = cands[Math.floor(Math.random() * cands.length)] || pool[0];
          keys.push(pick);
          prev = pick;
        }
      }
    }
    const beats = [];
    const hasMultiTargets = total > 1 && Array.isArray(targetActorKeys) && targetActorKeys.length > 1;
    for (let k = 0; k < total; k++) {
      const anchorKey = hasMultiTargets
        ? targetActorKeys[k % targetActorKeys.length]
        : `enemy:${primaryPos}`;
      const smScale = (spec && Array.isArray(spec.beatSlowMoScales) && spec.beatSlowMoScales[k] > 0)
        ? spec.beatSlowMoScales[k]
        : ((skillId === 'frost_3_thorns' && k < total - 1) ? 0.38 : 0.25);
      beats.push({
        beatIdx: k,
        key: String(keys[k] || pool[k % pool.length]).toUpperCase(),
        anchorTargetKey: anchorKey,
        slowMoScale: smScale,
      });
    }
    return beats;
  }

  function forwardPreTelegraphToRing(payload) {
    try {
      const c = global.CombatTimingRing;
      if (!c) return;
      if (typeof c.showPreTelegraph === 'function') {
        c.showPreTelegraph(payload);
      } else if (typeof c.preTelegraph === 'function') {
        c.preTelegraph(payload);
      }
    } catch (e) {}
  }

  function sleepTracked(ms) {
    return new Promise(resolve => {
      const entry = { tid: null, resolve };
      entry.tid = setTimeout(() => {
        _pendingAsyncDelays.delete(entry);
        resolve('done');
      }, Math.max(0, Number(ms) || 0));
      if (entry.tid && typeof entry.tid.unref === 'function') entry.tid.unref();
      _pendingAsyncDelays.add(entry);
    });
  }

  function cancelPendingAsyncDelays() {
    _pendingAsyncDelays.forEach(entry => {
      if (entry && entry.tid != null) clearTimeout(entry.tid);
      if (entry && typeof entry.resolve === 'function') entry.resolve('cancelled');
    });
    _pendingAsyncDelays.clear();
  }

  function cancelTimingRing(reason) {
    cancelPendingAsyncDelays();
    _activeGateBrokers.forEach(broker => {
      try { broker.abort(); } catch (e) {}
    });
    _activeGateBrokers.clear();
    Array.from(_activeVfxHandles).forEach(h => abortVfxHandle(h));
    _activeVfxHandles.clear();
    _actionInProgress = false;
    if (activeBattle) {
      activeBattle._timingBusy = false;
      activeBattle._asyncPhaseActive = false;
      activeBattle.isEnemyTurn = false;
    }
    try {
      if (global.CombatTimingRing && typeof global.CombatTimingRing.cancel === 'function') {
        global.CombatTimingRing.cancel(reason || 'exit');
      }
    } catch (e) {}
  }

  function shouldRunAsyncTiming(b) {
    if (!b || b.headless || b.over) return false;
    if (isJsdomEnv()) return false;
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    if (getAssistMode() === 'off') return false;
    const ctr = global.CombatTimingRing;
    if (!ctr) return false;
    const hasGate = typeof ctr.runGateBeat === 'function';
    const hasLegacy = typeof ctr.runAttackSequence === 'function' && typeof ctr.runBlockPrompt === 'function';
    if (!hasGate && !hasLegacy) return false;
    return true;
  }

  function normalizeRingGrade(g) {
    const s = String(g || 'GOOD').toUpperCase().trim();
    if (s === 'BAD' || s === 'GOOD' || s === 'GREAT' || s === 'PERFECT') return s;
    return 'GOOD';
  }

  function evaluateRingAttackResult(res, casualMode) {
    const rawGrades = Array.isArray(res && res.judgments)
      ? res.judgments
      : (Array.isArray(res && res.grades) ? res.grades : []);
    if (!rawGrades.length) {
      const fallbackBonus = (res && typeof res.bonus === 'number' && isFinite(res.bonus))
        ? res.bonus
        : ((res && typeof res.avgBonus === 'number' && isFinite(res.avgBonus)) ? res.avgBonus : 0);
      const effBonus = (casualMode && fallbackBonus < 0) ? 0 : fallbackBonus;
      return { grades: ['GOOD'], avgBonus: effBonus };
    }
    const table = COMBAT_BALANCE_V32.ringAtkBonus;
    let sum = 0;
    const grades = rawGrades.map(rawG => {
      let g = normalizeRingGrade(rawG);
      if (casualMode && g === 'BAD') g = 'GOOD';
      sum += (table[g] != null ? table[g] : 0);
      return g;
    });
    const avgBonus = Number((sum / grades.length).toFixed(6));
    return { grades, avgBonus };
  }

  function clonePlainData(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return Object.assign({}, obj);
    }
  }

  function triggerBossPhase2(b, enemy) {
    if (!b || !enemy || (enemy.phase || 1) >= 2) return false;
    const hpShdScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyHpShieldMult : 1.0;
    enemy.phase = 2;
    enemy.phase2Step = 0;
    enemy.broken = false;
    if (enemy.maxLocks) enemy.locks = enemy.maxLocks;
    if (b.metrics) b.metrics.phase2Triggered = true;

    // 首领转二阶段觉醒缓冲铁律：当回合蓄能变阵、下回合起释放二阶段杀招，杜绝零行动点跨阈值猝死
    enemy.status = enemy.status || {};
    enemy.status.stagger = Math.max(enemy.status.stagger || 0, 1);
    enemy._phase2Awakening = true;

    let bannerTitle = '倾力变阵 · 阵势蜕变';
    let quote = `${enemy.name} 气息骤然凝实，当回合蓄能重整二阶段架势！`;
    let theme = 'ember';
    let refreshShield = Math.round(60 * hpShdScale);

    if (enemy.aiType === 'eastwing_boss') {
      bannerTitle = '倾力变阵 · 红莲铁幕封廊';
      quote = '「封死东翼全部窗门！今夜谁也休想踏出维斯特利亚公爵府半步！」';
      theme = 'ember';
      refreshShield = Math.round(112 * hpShdScale);
      enemy.fireAura = Math.max(enemy.fireAura || 0, 2);
      enemy.spd = Math.max(enemy.spd || 108, 116);
      enemy.baseAv = computeBaseAv(enemy.spd);
      enemy.av = Math.min(enemy.av || enemy.baseAv, enemy.baseAv);
    } else if (enemy.aiType === 'wind_god_boss') {
      bannerTitle = '倾力变阵 · 风暴眼全开';
      quote = '「热身到此为止。飓风最中心其实是静止的——接得住这一剑，才算摸到风暴眼的门槛。」';
      theme = 'storm';
      refreshShield = Math.round(195 * hpShdScale);
      enemy.spd = Math.max(enemy.spd || 160, 160);
      enemy.baseAv = computeBaseAv(enemy.spd);
      enemy.av = Math.min(enemy.av || enemy.baseAv, enemy.baseAv);
      if (!(enemy.status && enemy.status.evadeSealed > 0)) {
        enemy.evadeCharges = Math.max(enemy.evadeCharges || 0, 1);
      }
    } else {
      bannerTitle = enemy.phase2Title || bannerTitle;
      quote = enemy.phase2Quote || quote;
      theme = enemy.phase2Theme || ((enemy.elem === 'ice' || enemy.elem === 'water') ? 'frost' : theme);
      refreshShield = Math.round((enemy.phase2Shield || 60) * hpShdScale);
    }

    enemy.shield = Math.max(enemy.shield || 0, refreshShield);
    decideEnemyIntent(enemy, b);

    pushLog(b, logTag('cbl-star', `✦【${bannerTitle}】${enemy.name} 觉醒变阵（护盾重整至 ${enemy.shield}，本回合蓄能缓冲）！${quote}`, true));
    spawnPhase2Overlay(b, enemy, bannerTitle, quote, theme);
    addCombatTrauma(0.92, b);
    const bossIdx = b.enemies ? b.enemies.indexOf(enemy) : 0;
    if (bossIdx >= 0) {
      queueElementVFX(b, 'break', 'enemy', bossIdx);
      queuePixelAction(b, {
        type: 'system_fx',
        fxId: 'fx_boss_phase2',
        side: 'enemy',
        enemyIdx: bossIdx,
        actorKey: `enemy:${bossIdx}`,
        theme,
        delayMs: 240,
      });
    }
    const bossPhase2Cue = enemy.aiType === 'eastwing_boss'
      ? 'boss_eastwing_phase2'
      : enemy.aiType === 'wind_god_boss'
        ? 'boss_fengshen_phase2'
        : `boss_phase2_${enemy.aiType || enemy.id || 'boss'}`;
    emitCombatVoiceCue(b, bossPhase2Cue, {
      enemyId: enemy.id,
      aiType: enemy.aiType,
      charId: enemy.aiType === 'wind_god_boss' ? 'fengshen' : (enemy.aiType === 'eastwing_boss' ? 'eastwing_commander' : enemy.id),
    });
    const phase2BgmKey = (b.stageCfg && b.stageCfg.phase2BgmKey)
      || (enemy && enemy.phase2BgmKey)
      || (b.bgmType === 'duel' ? null : 'battle2');
    if (phase2BgmKey) {
      b.bgmKey = phase2BgmKey;
      const resolvedP2Type = (typeof global.bgmResolveTypeForKey === 'function' && global.bgmResolveTypeForKey(phase2BgmKey))
        || (phase2BgmKey === 'boss_finale' ? 'finale_boss' : 'battle');
      b.bgmType = resolvedP2Type;
    }
    if (!b.headless) {
      safeSfx('phase2');
      if (typeof global.bgmShiftBattlePhase2 === 'function') {
        if (phase2BgmKey) global.bgmShiftBattlePhase2(phase2BgmKey);
        else if (b.bgmType !== 'duel') global.bgmShiftBattlePhase2();
      }
    }
    return true;
  }

  function buildAllyCombatants(stageCfg) {
    const list = (stageCfg && Array.isArray(stageCfg.allies)) ? stageCfg.allies : [];
    return list.map((tpl, idx) => {
      const aSpd = tpl.spd || 110;
      const aBaseAv = computeBaseAv(aSpd);
      const elems = Array.isArray(tpl.elements) && tpl.elements.length ? tpl.elements.slice() : ['fire', 'earth', 'wind'];
      return Object.assign({}, tpl, {
        idx,
        id: tpl.id || `ally_${idx}`,
        name: tpl.name || '友军',
        title: tpl.title || '前排主力',
        rank: tpl.rank || 5,
        spriteId: tpl.spriteId || tpl.id || 'reno',
        role: tpl.role || 'vanguard',
        slot: Number.isInteger(tpl.slot) && tpl.slot >= 0 && tpl.slot <= 5 ? tpl.slot : 4,
        hp: tpl.hp != null ? tpl.hp : (tpl.mhp || 560),
        mhp: tpl.mhp != null ? tpl.mhp : (tpl.hp || 560),
        atk: tpl.atk || 62,
        matk: tpl.matk || 82,
        def: tpl.def || 34,
        mdef: tpl.mdef || 38,
        spd: aSpd,
        baseAv: aBaseAv,
        av: Math.round(aBaseAv * 0.25),
        shield: Math.max(0, tpl.shield || 0),
        maxShield: Math.max(tpl.shield || 0, tpl.maxShield || 160),
        shieldKind: tpl.shieldKind || 'solid',
        tauntFront: tpl.tauntFront !== false,
        coverPlayerMitigate: tpl.coverPlayerMitigate != null ? tpl.coverPlayerMitigate : 0.45,
        elements: elems,
        elemCycleIdx: 0,
        nextElement: elems[0],
        totalDmgDealt: 0,
        actionsTaken: 0,
        status: {},
      });
    });
  }

  function initWave(b, waveIdx, waveOpts) {
    waveOpts = waveOpts || {};
    const sc = b.stageCfg;
    const w = sc.waves[waveIdx];
    const hpShdScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyHpShieldMult : 1.0;
    b.waveIdx = waveIdx;
    b.waveTurn = 1;
    b.ainoSpearsFiredInWave = 0;
    b.oneMoreUsedThisTurn = false;
    b.oneMoreActive = false;
    if (b.player) b.player.av = 0;
    if (!Array.isArray(b.allies)) b.allies = buildAllyCombatants(sc);
    b.allies.forEach(a => {
      if (a) a.av = Math.round((a.baseAv || computeBaseAv(a.spd || 110)) * 0.25);
    });
    if (b.aiMemory) b.aiMemory.turtleStreak = 0;
    b._pendingElementVFX = [];
    b._pendingPixelActions = [];
    b._pendingHitPulses = [];
    if (waveIdx > 0) {
      if (b.crateHp != null && b.crateMax != null) {
        b.crateHp = Math.min(b.crateMax, b.crateHp + 25);
      }
      if (!b.headless) {
        clearAllJuiceVfx({ preserveWaveContext: true });
        if (typeof document !== 'undefined') {
          const callout = document.getElementById('cb-callout-layer');
          if (callout) callout.innerHTML = '';
          const pm = document.getElementById('cb-palace-modal');
          if (pm && pm.parentNode) pm.parentNode.innerHTML = '';
          const bs = document.getElementById('battle-screen');
          if (bs) bs.classList.remove('palace-timestop');
          const actGrid = document.getElementById('b-actions');
          if (actGrid) actGrid._lastHtml = '';
        }
      }
    }
    if (b === activeBattle) {
      hoveredSkillId = null;
      armedSkillId = null;
    }
    b.witnessActive = !!w.witnessActive;
    b.frostFloorTurns = 0;

    if (w.witnessActive && b.exposure < (w.initialExposure || 35)) {
      b.exposure = w.initialExposure || 35;
    }
    const enemySlots = resolveEnemyFormationSlots(w.enemies);
    b.enemies = w.enemies.map((tpl, idx) => {
      const eSpd = tpl.spd || (tpl.boss ? 112 : 95);
      const eBaseAv = computeBaseAv(eSpd);
      const eMaxLocks = tpl.maxLocks != null ? tpl.maxLocks : (tpl.boss ? 4 : 3);
      const rawHp = tpl.hp != null ? tpl.hp : (tpl.mhp || 100);
      const scaledHp = tpl.nonLethalSpar ? rawHp : Math.max(1, Math.round(rawHp * hpShdScale));
      const scaledShield = Math.round(Math.max(0, tpl.shield || 0) * hpShdScale);
      return Object.assign({}, tpl, {
        slot: enemySlots[idx],
        rank: tpl.rank || (tpl.boss ? 4 : 2),
        noBlockPrompt: !!tpl.noBlockPrompt,
        hp: scaledHp,
        mhp: scaledHp,
        status: {},
        shield: scaledShield,
        shieldKind: tpl.shieldKind || 'magic',
        solidArmor: Math.max(0, Math.min(0.85, Number(tpl.solidArmor) || 0)),
        spd: eSpd,
        baseAv: eBaseAv,
        av: Math.round(eBaseAv * (0.45 + idx * 0.14)),
        maxLocks: eMaxLocks,
        locks: eMaxLocks,
        broken: false,
        mp: tpl.mp != null ? tpl.mp : null,
        mmp: tpl.mmp != null ? tpl.mmp : null,
        evadeCharges: tpl.evadeCharges || 0,
        maxEvadeCharges: tpl.maxEvadeCharges || 0,
        phase: tpl.phase || 1,
        phase2Step: 0,
        _phase2Awakening: false,
        fireStacks: 0,
        seepSevered: false,
        seepTriggeredOnce: false,
        coreShattered: false,
        evadeBrokenThisTurn: false,
        intent: null,
      });
    });
    b.targetIdx = 0;
    ensureValidTarget(b);

    b.enemies.forEach(e => {
      decideEnemyIntent(e, b);
    });

    if (hasRelic(b.player, 'northwind_pass')) {
      const beforeS = b.player.shield;
      b.player.shield = Math.min(b.player.maxShield, b.player.shield + 12);
      if (b.player.shield > beforeS) {
        pushLog(b, logTag('cbl-ice', `🪪【北风堡木牌】寒铁护盾 +${b.player.shield - beforeS}（当前 ${b.player.shield}/${b.player.maxShield}）。`));
      }
    }
    if (getSynergyTier(b.player, 'north_frost') >= 2) {
      const beforeNF = b.player.shield;
      b.player.shield = Math.min(b.player.maxShield, b.player.shield + 10);
      if (b.player.shield > beforeNF) {
        pushLog(b, logTag('cbl-ice', `✦【共鸣·北境霜锋(2件)】霜锋寒甲护体 +${b.player.shield - beforeNF} 护盾（当前 ${b.player.shield}/${b.player.maxShield}）。`));
      }
    }

    if (w.intro) pushLog(b, logTag('cbl-ice', w.intro));
    syncDerivedBattleState(b);

    // 双波关卡首领波重开快照（在首领波初始化完毕后深拷贝存档点）
    if (waveIdx > 0 && sc && sc.bossWaveRetry) {
      b._bossWaveSnapshot = {
        stageId: b.id,
        waveIdx,
        turn: b.turn,
        naturalTurnCount: b.naturalTurnCount || b.turn,
        fromArena: !!b.fromArena,
        fullRestore: !!b.fullRestore,
        usePreset: b._usePreset !== undefined ? b._usePreset : undefined,
        crateHp: b.crateHp,
        crateMax: b.crateMax,
        ainoResonance: b.ainoResonance || 0,
        exposure: b.exposure || 0,
        witnessActive: !!b.witnessActive,
        player: clonePlainData(b.player),
        allies: clonePlainData(b.allies || []),
      };
      b._bossWaveDone = b.done || null;
    }

    if (waveIdx > 0) {
      const hasSinglePhaseWaveBoss = Array.isArray(b.enemies) && b.enemies.some(e => e && e.boss && !e.phase2HpPct);
      const waveBgmKey = (w && w.bgmKey)
        || (waveIdx === 1 && sc && sc.wave2BgmKey)
        || ((b.bgmType !== 'duel' && hasSinglePhaseWaveBoss) ? 'battle2' : null);
      if (waveBgmKey) {
        b.bgmKey = waveBgmKey;
        const resolvedWaveType = (typeof global.bgmResolveTypeForKey === 'function' && global.bgmResolveTypeForKey(waveBgmKey))
          || (waveBgmKey === 'boss_finale' ? 'finale_boss' : 'battle');
        b.bgmType = resolvedWaveType;
        if (!b.headless && !waveOpts.skipWaveBgm && typeof global.bgmShiftBattlePhase2 === 'function') {
          global.bgmShiftBattlePhase2(waveBgmKey);
        }
      }
      emitCombatVoiceCue(b, `stage_start_${b.id}_w${waveIdx + 1}`, { stageId: b.id, waveIdx, charId: 'sylvia' });
    }
  }

  function isPalaceReady() {
    return false;
  }

  function createBattleState(stageCfg, opts) {
    opts = opts || {};
    const player = buildPlayerCombatant(stageCfg, opts);
    const allies = buildAllyCombatants(stageCfg);
    const casual = opts.casualMode !== undefined ? !!opts.casualMode : isCasualMode();
    const initBgmType = opts.bgmType || stageCfg.bgmType || 'battle';
    const initBgmKey = opts.bgmKey || stageCfg.bgmKey || (initBgmType === 'duel' ? 'duel1' : null);
    const b = {
      id: stageCfg.id,
      battleInstanceId: ++_battleInstanceSeq,
      stageCfg,
      bgmType: initBgmType,
      bgmKey: initBgmKey,
      casualMode: casual,
      _usePreset: opts.usePreset,
      _timingBusy: false,
      _asyncPhaseActive: false,
      isEnemyTurn: false,
      player,
      allies,
      enemies: [],
      targetIdx: 0,
      waveIdx: 0,
      waveTurn: 1,
      totalWaves: stageCfg.waves.length,
      turn: 1,
      naturalTurnCount: 1,
      ap: 2,
      apMax: 3,
      apPerTurn: 2,
      oneMoreUsedThisTurn: false,
      oneMoreActive: false,
      over: false,
      won: false,
      grade: null,
      headless: !!opts.headless,
      done: opts.done || null,
      fromArena: !!opts.fromArena,
      fullRestore: !!opts.fullRestore,
      _forceCrit: !!opts.forceCrit,
      _bossWaveSnapshot: null,
      _bossWaveDone: opts.done || null,
      // 专属战场仪表
      playerHits: 0,
      enemyHits: 0,
      sealProgress: 0,
      frostFloorTurns: 0,
      exposure: 0,
      witnessActive: false,
      exposureWarningTriggered: false,
      crateHp: stageCfg.crateRule ? 120 : null,
      crateMax: stageCfg.crateRule ? 120 : null,
      ainoResonance: 0,
      ainoSpearsFiredInWave: 0,
      // 行为记忆黑板
      aiMemory: {
        lastSkillId: null,
        sameSkillStreak: 0,
        lastAtkSkillId: null,
        sameAtkSkillStreak: 0,
        lastPath: null,
        samePathStreak: 0,
        lastTurnDmgDealt: 0,
        currentTurnDmgDealt: 0,
        turtleStreak: 0,
      },
      // 评分与实战统计
      metrics: {
        interrupts: 0,
        ripostes: 0,
        insights: 0,
        manaRecycled: 0,
        wandHits: 0,
        maxOvercastMult: 1.0,
        enemyActions: 0,
        enteredUnderSeep: false,
        manaFizzleWin: false,
        phase2Triggered: false,
        weaknessBreaks: 0,
        oneMoreCount: 0,
        overflowBreaksIntercepted: 0,
        allyActions: 0,
        allyDmgDealt: 0,
        playerDmgDealt: 0,
        perfectRings: 0,
        perfectBlocks: 0,
      },
      palaceInspectedWaves: {},
      log: [],
      recentLogs: [],
    };
    initWave(b, 0);

    if (b.casualMode) {
      pushLog(b, logTag('cbl-emerald', `✦【休闲模式已开启】敌方伤害 -40%、敌方生命与护盾 -30%、每回合末回复 15% 魔力、缩圈无负罚。`));
    }

    // 第九幕真神级开局抢先手「神威疾风压境」
    if (stageCfg.godTierChallenge && b.enemies[0] && b.enemies[0].spd >= 150) {
      const wg = b.enemies[0];
      const dmgScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyDmgMult : 1.0;
      const blk0 = computeBlockRate(b.player.rank || 3, wg.rank || 7, 'GOOD');
      const preDmg = Math.max(1, Math.round(50 * dmgScale * (COMBAT_BALANCE_V32.defK / (COMBAT_BALANCE_V32.defK + (b.player.mdef || 0))) * (1 - blk0)));
      b.player.hp = Math.max(1, b.player.hp - preDmg);
      pushLog(b, logTag('cbl-emerald', `🌪️【神威疾风压境】${wg.name} 凭神级极速先手试剑，翠岚疾风掠过造成 ${preDmg} 伤害！`, true));
    }

    if (hasRelic(b.player, 'alice_flower_cake')) {
      b.player.status.afterimage = (b.player.status.afterimage || 0) + 1;
      pushLog(b, logTag('cbl-emerald', `🌼【风之花饼】袖间清香微散，开局自带 1 层「风行残像」！`));
    }
    if (getSynergyTier(b.player, 'dukedom_memory') >= 2) {
      b.ap = Math.min(b.apMax, b.ap + 1);
      const beforeDk = b.player.shield;
      b.player.shield = Math.min(b.player.maxShield, b.player.shield + 10);
      pushLog(b, logTag('cbl-star', `✦【共鸣·公爵府遗忆(2件)】首回合先声夺人，+1 AP、+${b.player.shield - beforeDk} 护盾！`));
    }
    if (b.player.relics && b.player.relics.length) {
      const api = getRelicsApi();
      const relMap = (api && (api.RELICS_CATALOG || api.RELICS)) || {};
      const names = b.player.relics.map(id => (relMap[id] ? `${relMap[id].icon}${relMap[id].name}` : id)).join(' · ');
      pushLog(b, logTag('cbl-violet', `✦ 随身铭记已生效：${names}`));
    }
    if (b.player.synergies && b.player.synergies.length) {
      const synNames = b.player.synergies.map(s => `${s.name}(${s.tier || s.count}件)`).join(' · ');
      pushLog(b, logTag('cbl-star', `✦ 套装共鸣已点亮：${synNames}`));
    }
    syncDerivedBattleState(b);
    return b;
  }

  function setOvercastPct(pct, b, opts) {
    if (b && typeof b === 'object' && !('player' in b) && !('enemies' in b)) {
      opts = b;
      b = activeBattle;
    }
    b = b || activeBattle;
    if (!b || b.over || !canPlayerAmp(b.player)) {
      const zeroTier = getAmpTierInfo(0);
      return { ok: false, overcastPct: 0, ampPct: 0, overcastMode: 0, ampTier: 0, ampTierName: zeroTier.name, tier: zeroTier };
    }
    const maxCap = getPlayerMaxAmpCap(b.player);
    let val = Number(pct);
    if (!isFinite(val)) val = 0;
    if (val > 1) val = val / 100;
    val = Math.max(0, Math.min(maxCap, val));
    if (opts && opts.snap) {
      const snaps = getAmpTiers(b).filter(t => t > 1e-4);
      for (let i = 0; i < snaps.length; i++) {
        if (Math.abs(val - snaps[i]) <= 0.02 + 1e-6) {
          val = snaps[i];
          break;
        }
      }
    }
    val = Math.round(val * 100) / 100;
    val = Math.max(0, Math.min(maxCap, val));
    const prevAmp = Number(b.player.ampPct) || 0;
    const prevTier = getAmpTierInfo(prevAmp).tier;
    const tierInfo = getAmpTierInfo(val);
    const nextMode = tierInfo.tier;
    const changed = Math.abs(prevAmp - val) > 1e-4 || b.player.overcastMode !== nextMode;
    b.player.ampPct = val;
    b.player.overcastPct = val;
    b.player.overcastMode = nextMode;
    b.player._lastOvercastMode = nextMode;
    b.overcastPct = val;
    b.overcastMode = nextMode;
    armedSkillId = null;
    syncDerivedBattleState(b);
    if (!b.headless) {
      if (changed && !(opts && opts.silent)) {
        safeSfx('amp_charge', { ampPct: val });
        if (tierInfo.tier > prevTier && tierInfo.tier >= 1) {
          const nowTs = Date.now();
          if (nowTs - (b._lastAmpVoiceTs || 0) >= 650) {
            b._lastAmpVoiceTs = nowTs;
            emitCombatVoiceCue(b, `amp_tier_${tierInfo.tier}`, { tier: tierInfo.tier, ampPct: val, charId: 'sylvia' });
          }
        }
        try {
          const pxApi = getPixelVfxApi();
          if (pxApi && typeof pxApi.playAmpChargeBurst === 'function') {
            pxApi.playAmpChargeBurst(val);
          }
        } catch (e) {}
      }
      renderCombatUI();
    } else if (changed) {
      emitCombatStateChange(b);
    }
    return {
      ok: true,
      overcastPct: val,
      ampPct: val,
      overcastMode: nextMode,
      ampTier: tierInfo.tier,
      ampTierName: tierInfo.name,
      tier: tierInfo,
    };
  }

  function setOvercast(mode, b) {
    b = b || activeBattle;
    if (!b || b.over || !canPlayerAmp(b.player)) return false;
    const nextMode = Math.max(0, Math.min(3, mode | 0));
    const nextAmp = AMP_TIERS[nextMode] != null ? AMP_TIERS[nextMode] : 0;
    const res = setOvercastPct(nextAmp, b);
    return !!(res && res.ok);
  }

  function cycleOvercast(delta, b, opts) {
    if (delta && typeof delta === 'object' && ('player' in delta || 'enemies' in delta)) {
      opts = b;
      b = delta;
      delta = 1;
    }
    b = b || activeBattle;
    if (!b || b.over || !canPlayerAmp(b.player)) {
      const zeroTier = getAmpTierInfo(0);
      return { ok: false, overcastPct: 0, ampPct: 0, overcastMode: 0, ampTier: 0, ampTierName: zeroTier.name, tier: zeroTier };
    }
    const tiers = getAmpTiers(b);
    const step = (typeof delta === 'number' && delta < 0) ? -1 : 1;
    const cur = syncPlayerAmpFromMode(b.player);
    let nextVal = tiers[0];
    if (step > 0) {
      let found = false;
      for (let i = 0; i < tiers.length; i++) {
        if (tiers[i] > cur + 1e-4) {
          nextVal = tiers[i];
          found = true;
          break;
        }
      }
      if (!found) nextVal = tiers[0];
    } else {
      let found = false;
      for (let i = tiers.length - 1; i >= 0; i--) {
        if (tiers[i] < cur - 1e-4) {
          nextVal = tiers[i];
          found = true;
          break;
        }
      }
      if (!found) nextVal = tiers[tiers.length - 1];
    }
    return setOvercastPct(nextVal, b, opts);
  }

  const setAmpPct = setOvercastPct;
  const cycleAmpStep = cycleOvercast;

  function setEquippedStaff(staffId, b) {
    b = b || activeBattle;
    if (!b || b.over) return false;
    const def = COMBAT_BALANCE_V32.STAVES[staffId];
    if (!def) return false;
    const p = b.player;
    p.equippedStaff = staffId;
    if (staffId === 'eclipse_wand') {
      p.hasEclipseWand = true;
      p.wandActive = true;
      p.wandPersistent = true;
      p.wandCooldown = 0;
    } else {
      p.wandActive = false;
      p.wandPersistent = false;
      p.wandCooldown = 0;
    }
    armedSkillId = null;
    syncDerivedBattleState(b);
    if (staffId === 'north_saint_staff') {
      queuePixelAction(b, { type: 'staff_switch', staffId: 'north_saint_staff' });
    } else if (staffId === 'eclipse_wand') {
      queuePixelAction(b, { type: 'wand_toggle' });
    }
    if (!b.headless) {
      safeSfx('tab_switch');
      renderCombatUI();
    }
    return true;
  }

  function toggleEclipseWand(forceVal, b) {
    b = b || activeBattle;
    if (!b || b.over) return false;
    const p = b.player;
    if (!p.hasEclipseWand) return false;
    // 晦轮杖零冷却，提供 100% 真实魔伤与额外 24% MaxMP 耗蓝，希尔维亚永不触发日蚀
    p.wandCooldown = 0;
    armedSkillId = null;
    p.wandActive = forceVal !== undefined ? !!forceVal : !p.wandActive;
    if (!p.wandActive) {
      p.wandPersistent = false;
      if (p.equippedStaff === 'eclipse_wand' && !p.hasEclipseWand) p.equippedStaff = 'none';
    }
    syncDerivedBattleState(b);
    if (!b.headless) safeSfx(p.wandActive ? 'eclipse_cast' : 'tab_switch', p.wandActive ? { gain: 0.72 } : undefined);
    if (p.wandActive) {
      if (b.witnessActive) {
        b.exposure = Math.min(100, b.exposure + 25);
        if (b.exposure >= 70) b.exposureWarningTriggered = true;
      }
      const extraMpNow = Math.round(Math.max(1, p.mmp || 100) * COMBAT_BALANCE_V32.STAVES.eclipse_wand.extraMpPct);
      pushLog(b, logTag('cbl-violet', `🪄 催动「晦轮杖」暗银细环：下一次魔法附带【100% 魔法真伤】（无视法抗与魔法盾，仅物理实体甲阻尼；额外耗蓝 +${extraMpNow} MP，保留暴击与魔战循环）！${b.witnessActive ? `（⚠️ 耳目附近拔杖引动异象，暴露风险升至 ${b.exposure}%！）` : ''}`));
      spawnBanner(b, '🪄 晦轮杖 · 魔法真伤', 'wand');
      queuePixelAction(b, { type: 'wand_toggle' });
      emitCombatVoiceCue(b, 'eclipse_wand', { charId: 'sylvia' });
      if (b.witnessActive && b.exposure >= 100) {
        finishBattle(b, false, 'exposed');
        return false;
      }
    } else {
      pushLog(b, logTag('cbl-muted', `🪄 收敛晦轮杖银环微光。`));
    }
    if (!b.headless) renderCombatUI();
    return p.wandActive;
  }

  function getCurrentPalaceConfig() {
    return { sceneText: '', clues: [], deductions: [] };
  }

  // 兼容空壳：战斗内冰晶宫殿看破已精简移除，保留接口防外部调用报错
  function inspectClue() {
    return { ok: false, reason: 'removed_in_streamlined_combat', correct: false, feedback: '' };
  }

  function dealDamageToEnemy(b, enemy, dmg, opts) {
    opts = opts || {};
    const wasAlive = enemy.hp > 0;
    const safeDmg = Math.max(0, Math.round(Number(dmg) || 0));
    enemy.shield = Math.max(0, enemy.shield || 0);

    if (opts.shatterShield && enemy.shield > 0) {
      pushLog(b, logTag('cbl-ice', `💥 击碎了 ${enemy.name} 的 ${enemy.shield} 点护盾！`));
      enemy.shield = 0;
    }

    let rem = safeDmg;
    let shieldAbsorbed = 0;
    let magicShieldBypassed = false;
    if (enemy.shield > 0) {
      if (opts.trueMagic || opts.wandRefract) {
        if ((enemy.shieldKind || 'magic') === 'magic') {
          magicShieldBypassed = true;
        } else {
          const blk = Math.min(enemy.shield, rem);
          enemy.shield = Math.max(0, enemy.shield - blk);
          shieldAbsorbed = blk;
          rem = Math.max(0, rem - blk);
        }
      } else if (opts.pierceHalfShield) {
        const effShield = Math.floor(enemy.shield * 0.5);
        const blk = Math.min(effShield, rem);
        enemy.shield = Math.max(0, enemy.shield - blk);
        shieldAbsorbed = blk;
        rem = Math.max(0, rem - blk);
      } else {
        const blk = Math.min(enemy.shield, rem);
        enemy.shield = Math.max(0, enemy.shield - blk);
        shieldAbsorbed = blk;
        rem = Math.max(0, rem - blk);
      }
    }

    const minHp = (enemy.nonLethalSpar || opts.nonLethalCap) ? 1 : 0;
    const maxCanLose = Math.max(0, enemy.hp - minHp);
    const actualHpLoss = Math.min(maxCanLose, rem);
    enemy.hp = Math.max(minHp, enemy.hp - rem);

    // 诺艾儿跌破 48% 血量时自动切入脚底冰缝暗流预告（不锁血、硬吃 115 防软锁）
    if (enemy.aiType === 'noelle' && !enemy.seepTriggeredOnce && !enemy.seepSevered && !opts.severSeep && enemy.hp > 0 && enemy.hp <= Math.round(enemy.mhp * 0.48)) {
      enemy.seepTriggeredOnce = true;
      b.metrics.enteredUnderSeep = true;
      if (!(enemy.status && enemy.status.stagger > 0)) {
        decideEnemyIntent(enemy, b);
      }
      spawnBanner(b, '💧 冰面暗流 · 杀阵成型！', 'danger');
      pushLog(b, logTag('cbl-ice', `💧 诺艾儿借水垫后撤拉距，脚下冰缝暗水线悄然渗近（宜以「冰霜之息」彻底冻绝）！`, true));
      emitCombatVoiceCue(b, 'boss_phase2_noelle', { enemyId: enemy.id, aiType: 'noelle', charId: 'noelle' });
    }

    if (enemy.hp <= 0) {
      if (wasAlive) {
        const deadIdx = b.enemies ? b.enemies.indexOf(enemy) : -1;
        if (deadIdx >= 0) {
          queuePixelAction(b, {
            type: 'system_fx',
            fxId: 'fx_enemy_defeat',
            side: 'enemy',
            enemyIdx: deadIdx,
            actorKey: `enemy:${deadIdx}`,
            delayMs: 260,
          });
        }
      }
      ensureValidTarget(b);
    }

    // 首领跨入二阶段阈值：立即觉醒、刷新护盾与破防锁，并强制赋予 1 回合觉醒缓冲
    if (enemy.boss && enemy.phase2HpPct && (enemy.phase || 1) < 2 && enemy.hp > 0 && enemy.hp <= Math.floor(enemy.mhp * enemy.phase2HpPct)) {
      triggerBossPhase2(b, enemy);
      return { actualHpLoss, shieldAbsorbed, magicShieldBypassed, phase2Triggered: true };
    }

    return { actualHpLoss, shieldAbsorbed, magicShieldBypassed };
  }

  let _actionInProgress = false;
  let _lastEndTurnUiTs = 0;
  let _lastSkillUiClick = { id: '', ts: 0 };

  function triggerEndTurnFromUI() {
    if (!activeBattle || activeBattle.over || _actionInProgress) return false;
    if (!isJsdomEnv()) {
      const now = Date.now();
      if (now - _lastEndTurnUiTs < 250) return false;
      _lastEndTurnUiTs = now;
    }
    return endTurn();
  }

  function triggerBreakOrInterruptRelics(b, targetEnemy, isInterrupt) {
    const p = b.player;
    if (!p) return;
    if (!b._frostSealUsed && hasRelic(p, 'frost_cipher')) {
      b._frostSealUsed = true;
      const recMp = Math.max(10, Math.round(p.mmp * 0.18));
      const beforeMp = p.mp;
      p.mp = Math.min(p.mmp, p.mp + recMp);
      const gained = Math.max(0, p.mp - beforeMp);
      b.ap = Math.min(b.apMax, b.ap + 1);
      b.metrics.manaRecycled += gained;
      if (gained > 0) spawnCombatFloat(b, 'player', `+${gained} MP`, 'mp');
      pushLog(b, logTag('cbl-ice', `💠【霜印徽章】首次破招/击破触发魔脉回涌 +${gained} MP、+1 AP！`));
    }
    if (getSynergyTier(p, 'academy_stars') >= 2 || hasRelic(p, 'academy_star_3pc')) {
      const synMp = Math.max(8, Math.round(p.mmp * 0.12));
      const beforeSyn = p.mp;
      p.mp = Math.min(p.mmp, p.mp + synMp);
      const gainedSyn = Math.max(0, p.mp - beforeSyn);
      b.metrics.manaRecycled += gainedSyn;
      if (gainedSyn > 0) spawnCombatFloat(b, 'player', `+${gainedSyn} MP`, 'mp');
      if (isInterrupt && targetEnemy && !targetEnemy.broken && (targetEnemy.locks || 0) > 0) {
        targetEnemy.locks = Math.max(0, targetEnemy.locks - 1);
      }
      pushLog(b, logTag('cbl-star', `✦【共鸣·学院星辉】破招/击破回流 +${gainedSyn} MP${isInterrupt ? '并额外削减 1 层破防锁' : ''}！`));
    }
  }

  function resolveAinoSpearQueue(b) {
    let ainoGuard = 0;
    let shatteredAny = false;
    while (b.stageCfg && b.stageCfg.ainoSupport && b.ainoResonance >= 2 && ainoGuard++ < 12) {
      const bossTarget = getPrimaryAliveEnemy(b);
      if (!bossTarget) break;
      b.ainoResonance -= 2;
      b.ainoSpearsFiredInWave = (b.ainoSpearsFiredInWave || 0) + 1;
      const spearDmg = 130;
      dealDamageToEnemy(b, bossTarget, spearDmg, { pierceHalfShield: true });
      const spearPos = b.enemies.indexOf(bossTarget);
      if (spearPos >= 0) {
        queueElementVFX(b, 'ice', 'enemy', spearPos);
        queuePixelAction(b, { type: 'aino_spear', enemyIdx: spearPos });
      }
      if (!getPixelVfxApi()) addCombatTrauma(0.64, b);
      if (!b.headless) safeSfx('ice_shatter');
      spawnBanner(b, '❄️ 艾诺支援 · 极寒冰枪贯落！', 'interrupt');
      emitCombatVoiceCue(b, 'aino_spear', { enemyId: bossTarget.id, charId: 'aino' });
      pushLog(b, logTag('cbl-cobalt', `❄️【冰原共鸣】峡谷崖顶艾诺射落第 ${b.ainoSpearsFiredInWave} 道极寒冰枪，重创 ${bossTarget.name} ${spearDmg} 伤害！`, true));
      if (bossTarget.aiType === 'hulan_lord' && !bossTarget.coreShattered && b.ainoSpearsFiredInWave >= 2) {
        bossTarget.coreShattered = true;
        bossTarget.shield = 0;
        bossTarget.solidArmor = 0;
        bossTarget.def = Math.round(bossTarget.def * 0.30);
        bossTarget.mdef = Math.round(bossTarget.mdef * 0.30);
        shatteredAny = true;
        pushLog(b, logTag('cbl-ice', `❄️💥 第二道极寒冰枪贯入领主腹下，幽蓝晶核轰然震碎（实体重甲清零、双抗骤降 70%）！`, true));
      }
    }
    return shatteredAny;
  }

  function useSkill(skillId, targetIdx, b) {
    b = b || activeBattle;
    if (_actionInProgress) return { ok: false, reason: 'busy' };
    if (!b || b.over) return { ok: false, reason: 'over' };
    const p = b.player;
    const sk = TACTICAL_SKILLS[skillId];
    if (!sk || !p.skills.includes(skillId)) return { ok: false, reason: 'locked' };
    if (sk.maxUses && (p.usedMaxSkills[skillId] || 0) >= sk.maxUses) return { ok: false, reason: 'max_uses' };
    if ((p.cooldowns[skillId] || 0) > 0) return { ok: false, reason: 'cooldown' };
    const apCost = computeSkillApCost(b, sk);
    if (b.ap < apCost) return { ok: false, reason: 'no_ap' };
    const mpCost = computeSkillMpCost(p, sk);
    const zeroMpFallback = !!(sk.allowZeroMpFallback && p.mp < mpCost);
    if (p.mp < mpCost && !zeroMpFallback) return { ok: false, reason: 'no_mp' };

    if (targetIdx != null && b.enemies[targetIdx] && b.enemies[targetIdx].hp > 0) {
      b.targetIdx = targetIdx;
    }
    const primary = getPrimaryAliveEnemy(b);
    if (!primary) return { ok: false, reason: 'no_target' };

    const effBeats = resolveSkillBeats(sk, b);
    const willMissBlind = !!(sk.power > 0 && p.status.blind > 0 && !sk.aoe && !sk.sureHit && !sk.clearBlind);

    // 实时浏览器异步 0.25x 慢镜缩圈轨（无头 / JSDOM / 护手关闭 / 0拍瞬发技 100% 走下方原同步路径！）
    if (shouldRunAsyncTiming(b) && effBeats > 0 && !willMissBlind) {
      _actionInProgress = true;
      b._timingBusy = true;
      b._asyncPhaseActive = true;
      const instId = b.battleInstanceId;
      const primaryPos = Math.max(0, b.enemies.indexOf(primary));
      const aliveIndices = [];
      for (let i = 0; i < b.enemies.length; i++) {
        if (b.enemies[i] && b.enemies[i].hp > 0) aliveIndices.push(i);
      }
      const targetIndices = sk.aoe ? aliveIndices : [primaryPos];
      const targetActorKeys = targetIndices.map(i => `enemy:${i}`);
      const ampProfile = zeroMpFallback
        ? { ampPct: 0, tier: 0 }
        : computeAmpProfile(p, sk);
      const usedWand = !zeroMpFallback && isEclipseStaffForSkill(p, sk);

      // 提前亮键：立即播放语音锚点并按 V3.2 规则预生成拍键序列
      const mappedCue = resolveSkillVoiceCue(skillId);
      emitCombatVoiceCue(b, mappedCue, { skillId, path: sk.path, fallbackCueKey: `skill_path_${sk.path}`, charId: 'sylvia' });
      const ctr = global.CombatTimingRing;
      const pxApi = getPixelVfxApi();
      const beats = buildSkillBeatPlan(skillId, primaryPos, targetActorKeys, aliveIndices.length || 1, effBeats);
      const collectedGrades = [];
      const wantsGatedSync = !!(ctr && typeof ctr.runGateBeat === 'function' && pxApi && typeof pxApi.playSkillAction === 'function');
      const gateBroker = wantsGatedSync ? createBeatGateBroker(beats.length) : null;
      let vfxHandle = null;
      let preCastPlayed = false;

      if (pxApi && typeof pxApi.playSkillAction === 'function') {
        try {
          const playPayload = {
            type: 'skill',
            skillId,
            targetIdx: primaryPos,
            targetIndices,
            critTargetIndices: [],
            brokenIndices: [],
            oneMoreIndices: [],
            shieldHitTargets: [],
            didRiposte: false,
            usedWand,
            ampPct: ampProfile ? ampProfile.ampPct : 0,
            ampTier: ampProfile ? ampProfile.tier : 0,
            beats: beats.length,
            beatKeys: beats.map(bt => bt.key),
            missed: false,
          };
          if (wantsGatedSync) {
            playPayload.gated = true;
            playPayload.gateCount = beats.length;
            playPayload.onPreTelegraph = (kArg, metaArg) => {
              const parsed = parseGateCallbackArgs(kArg, metaArg);
              const bt = beats[parsed.k] || beats[0];
              if (!bt) return;
              forwardPreTelegraphToRing({
                skillId,
                key: bt.key,
                mode: 'attack',
                beatIdx: parsed.k,
                beatIndex: parsed.k,
                totalBeats: beats.length,
                ampPct: ampProfile ? ampProfile.ampPct : 0,
                anchorTargetKey: parsed.meta.anchorTargetKey || parsed.meta.actorKey || bt.anchorTargetKey,
                prevGrades: collectedGrades.slice(),
                assistMode: getAssistMode(),
              });
            };
            playPayload.onBeatReady = (kArg, metaArg) => {
              const parsed = parseGateCallbackArgs(kArg, metaArg);
              if (gateBroker) gateBroker.notifyReady(parsed.k, parsed.meta);
            };
          }
          const maybeHandle = pxApi.playSkillAction(b, playPayload);
          preCastPlayed = true;
          if (isUsableVfxHandle(maybeHandle, pxApi)) {
            vfxHandle = maybeHandle;
            _activeVfxHandles.add(vfxHandle);
          }
        } catch (e) {}
      }

      emitCombatStateChange(b);

      return (async () => {
        let finalGateReleased = false;
        let finalBeatIdx = Math.max(0, beats.length - 1);
        const buildReleasePayload = (summary, rawGrade, ringEval) => {
          const s = summary || {};
          const critIdxs = Array.isArray(s.critTargetIndices) ? s.critTargetIndices : [];
          const brkIdxs = Array.isArray(s.brokenIndices) ? s.brokenIndices : [];
          const omIdxs = Array.isArray(s.oneMoreIndices) ? s.oneMoreIndices : [];
          const shTargets = Array.isArray(s.shieldHitTargets) ? s.shieldHitTargets : [];
          const hitIdxs = (Array.isArray(s.hitTargetIndices) && s.hitTargetIndices.length) ? s.hitTargetIndices : targetIndices;
          return {
            isMidBeat: false,
            isFinalBeat: true,
            grade: rawGrade || 'GOOD',
            grades: ringEval ? ringEval.grades : collectedGrades.slice(),
            ringBonus: ringEval ? ringEval.avgBonus : 0,
            dmg: Number(s.dmg) || 0,
            totalDmg: Number(s.dmg) || 0,
            crit: !!s.crit,
            didCrit: !!s.crit,
            broken: !!s.broken,
            didBreak: !!s.broken,
            oneMore: !!s.oneMore,
            didOneMore: !!s.oneMore,
            shieldShattered: !!s.shieldShattered,
            shieldBroken: !!s.shieldShattered,
            didRiposte: !!s.didRiposte,
            missed: !!s.missed,
            critTargetIndices: critIdxs,
            brokenIndices: brkIdxs,
            oneMoreIndices: omIdxs,
            shieldHitTargets: shTargets,
            hitTargetIndices: hitIdxs,
            targetIndices: hitIdxs,
          };
        };

        try {
          if (vfxHandle && gateBroker && ctr && typeof ctr.runGateBeat === 'function') {
            let finalOut = null;
            for (let k = 0; k < beats.length; k++) {
              const waitRes = await gateBroker.waitForBeat(k, 2500);
              if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
                abortVfxHandle(vfxHandle);
                return { ok: false, reason: 'stale_battle' };
              }
              const meta = (waitRes && waitRes.meta) || {};
              const beat = beats[k];
              const isFinalBeat = (k === beats.length - 1);
              const beatAnchorKey = meta.anchorTargetKey || meta.actorKey || beat.anchorTargetKey;
              const beatSlowMo = (meta.slowMoScale != null && Number.isFinite(Number(meta.slowMoScale)))
                ? Number(meta.slowMoScale)
                : beat.slowMoScale;

              const beatRes = await ctr.runGateBeat({
                skillId,
                key: beat.key,
                mode: 'attack',
                beatIdx: k,
                beatIndex: k,
                totalBeats: beats.length,
                prevGrades: collectedGrades.slice(),
                ampPct: ampProfile ? ampProfile.ampPct : 0,
                anchorTargetKey: beatAnchorKey,
                actorKey: beatAnchorKey,
                slowMoScale: beatSlowMo,
                isFinalBeat,
                casualMode: !!b.casualMode,
                assistMode: getAssistMode(),
              });
              if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
                abortVfxHandle(vfxHandle);
                return { ok: false, reason: 'stale_battle' };
              }

              const rawGrade = (beatRes && !beatRes.cancelled && beatRes.grade)
                ? normalizeRingGrade(beatRes.grade)
                : 'GOOD';
              collectedGrades.push(rawGrade);

              if (!isFinalBeat) {
                try {
                  vfxHandle.releaseGate(k, {
                    isMidBeat: true,
                    isFinalBeat: false,
                    grade: rawGrade,
                    beatIdx: k,
                    totalBeats: beats.length,
                    anchorTargetKey: beatAnchorKey,
                  });
                } catch (e) {}
              } else {
                const ringEval = evaluateRingAttackResult({ judgments: collectedGrades }, !!b.casualMode);
                finalBeatIdx = k;
                _logBatchDepth += 1;
                try {
                  finalOut = _useSkillCore(skillId, targetIdx, b, {
                    ringBonus: ringEval.avgBonus,
                    ringGrades: ringEval.grades,
                    skipPreCastAction: true,
                    skipPlayAction: true,
                    skipVoiceCue: true,
                    onImpactResolved(impactSummary) {
                      if (finalGateReleased) return;
                      finalGateReleased = true;
                      try {
                        vfxHandle.releaseGate(k, buildReleasePayload(impactSummary, rawGrade, ringEval));
                      } catch (e) {}
                    },
                  });
                } finally {
                  _logBatchDepth = Math.max(0, _logBatchDepth - 1);
                  if (_logBatchDepth === 0) flushCombatLogDOM(b);
                }

                if (!finalGateReleased) {
                  finalGateReleased = true;
                  try {
                    vfxHandle.releaseGate(k, buildReleasePayload(finalOut, rawGrade, ringEval));
                  } catch (e) {}
                }

                if (typeof vfxHandle.finishActorReturn === 'function') {
                  try {
                    const retP = vfxHandle.finishActorReturn();
                    if (!b.over && retP && typeof retP.then === 'function') {
                      await Promise.race([retP, sleepTracked(460)]);
                    }
                  } catch (e) {}
                }
              }
            }
            return finalOut || { ok: true };
          }

          // 兼容回退轨：当门控句柄或 runGateBeat 不可用时走原序列化缩圈轨（无重复 HitStop）
          const ringRes = await ctr.runAttackSequence({
            skillId,
            ampPct: ampProfile ? ampProfile.ampPct : 0,
            aliveCount: aliveIndices.length || 1,
            keys: beats.map(bt => bt.key),
            targetActorKey: `enemy:${primaryPos}`,
            targetActorKeys,
            casualMode: !!b.casualMode,
            assistMode: getAssistMode(),
          });
          if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
            return { ok: false, reason: 'stale_battle' };
          }
          const ringEval = evaluateRingAttackResult(ringRes, !!b.casualMode);
          _logBatchDepth += 1;
          try {
            return _useSkillCore(skillId, targetIdx, b, {
              ringBonus: ringEval.avgBonus,
              ringGrades: ringEval.grades,
              skipPreCastAction: preCastPlayed,
              skipVoiceCue: true,
            });
          } finally {
            _logBatchDepth = Math.max(0, _logBatchDepth - 1);
            if (_logBatchDepth === 0) flushCombatLogDOM(b);
          }
        } catch (err) {
          if (vfxHandle && !finalGateReleased) {
            finalGateReleased = true;
            try { vfxHandle.releaseGate(finalBeatIdx, buildReleasePayload(null, 'GOOD', null)); } catch (e) {}
            try { if (typeof vfxHandle.finishActorReturn === 'function') vfxHandle.finishActorReturn(); } catch (e) {}
          }
          if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
            return { ok: false, reason: 'error' };
          }
          _logBatchDepth += 1;
          try {
            return _useSkillCore(skillId, targetIdx, b, {
              ringBonus: 0,
              ringGrades: ['GOOD'],
              skipPreCastAction: preCastPlayed,
              skipPlayAction: !!vfxHandle,
              skipVoiceCue: true,
            });
          } finally {
            _logBatchDepth = Math.max(0, _logBatchDepth - 1);
            if (_logBatchDepth === 0) flushCombatLogDOM(b);
          }
        } finally {
          releaseGateBroker(gateBroker);
          if (vfxHandle) _activeVfxHandles.delete(vfxHandle);
          _actionInProgress = false;
          if (b) {
            b._timingBusy = false;
            b._asyncPhaseActive = false;
          }
          if (b && activeBattle === b && !b.headless) {
            if (!b.over) renderCombatUI();
            emitCombatStateChange(b);
          }
        }
      })();
    }

    // 同步零阻塞轨（无头单测 / JSDOM / 自动轨 / 0 拍瞬发技）
    _actionInProgress = true;
    _logBatchDepth += 1;
    try {
      return _useSkillCore(skillId, targetIdx, b, { ringBonus: 0, ringGrades: effBeats > 0 ? ['GOOD'] : [] });
    } finally {
      _actionInProgress = false;
      _logBatchDepth = Math.max(0, _logBatchDepth - 1);
      if (_logBatchDepth === 0) flushCombatLogDOM(b || activeBattle);
      if (b && activeBattle === b && !b.headless) {
        if (!b.over) renderCombatUI();
        emitCombatStateChange(b);
      }
    }
  }

  function _useSkillCore(skillId, targetIdx, b, timingOpts) {
    timingOpts = timingOpts || {};
    b = b || activeBattle;
    if (!b || b.over) return { ok: false, reason: 'over' };
    const p = b.player;
    const sk = TACTICAL_SKILLS[skillId];
    if (!sk || !p.skills.includes(skillId)) return { ok: false, reason: 'locked' };
    if (sk.maxUses && (p.usedMaxSkills[skillId] || 0) >= sk.maxUses) return { ok: false, reason: 'max_uses' };
    if ((p.cooldowns[skillId] || 0) > 0) return { ok: false, reason: 'cooldown' };
    const apCost = computeSkillApCost(b, sk);
    if (b.ap < apCost) return { ok: false, reason: 'no_ap' };

    const rawMpCost = computeSkillMpCost(p, sk);
    const zeroMpFallback = !!(sk.allowZeroMpFallback && p.mp < rawMpCost);
    if (p.mp < rawMpCost && !zeroMpFallback) return { ok: false, reason: 'no_mp' };
    const mpCost = zeroMpFallback ? 0 : rawMpCost;

    const powerMp = zeroMpFallback ? 0 : computeOvercastPowerMp(p, sk);
    const ampProfile = zeroMpFallback
      ? { ampPct: 0, addDmg: 0, mult: 1.0, shieldMult: 1.0, tier: 0, extraLocks: 0, defPierce: 0, label: '' }
      : computeAmpProfile(p, sk);
    const mcMult = zeroMpFallback ? 1.0 : computeManaCycleMultiplier(p, powerMp, sk);
    if (mcMult > b.metrics.maxOvercastMult) b.metrics.maxOvercastMult = mcMult;

    if (targetIdx != null && b.enemies[targetIdx] && b.enemies[targetIdx].hp > 0) {
      b.targetIdx = targetIdx;
    }
    const primary = getPrimaryAliveEnemy(b);
    if (!primary) return { ok: false, reason: 'no_target' };

    const usedWand = !zeroMpFallback && isEclipseStaffForSkill(p, sk);
    const dmgScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyDmgMult : 1.0;
    const hpShdScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyHpShieldMult : 1.0;
    const ringBonus = (sk.beats === 0 || zeroMpFallback) ? 0 : (Number(timingOpts.ringBonus) || 0);
    const ringGrades = Array.isArray(timingOpts.ringGrades) ? timingOpts.ringGrades : [];
    if (ringGrades.includes('PERFECT')) {
      b.metrics.perfectRings = (b.metrics.perfectRings || 0) + ringGrades.filter(g => g === 'PERFECT').length;
    }

    armedSkillId = null;
    if (b === activeBattle) hoveredSkillId = null;

    // 扣除资源与冷却
    if (apCost === 0 && sk.ap > 0 && sk.line === 1 && b.turn === 1 && !b._handkerchiefFreeIceUsed && hasRelic(p, 'aino_academy_handkerchief')) {
      b._handkerchiefFreeIceUsed = true;
      pushLog(b, logTag('cbl-ice', `🧣【雪纹手帕】首回合初次冰晶主炮免除 AP 消耗！`));
    }
    b.ap = Math.max(0, b.ap - apCost);
    p.mp = Math.max(0, p.mp - mpCost);
    if (sk.maxUses) p.usedMaxSkills[skillId] = (p.usedMaxSkills[skillId] || 0) + 1;
    if (sk.cooldown) p.cooldowns[skillId] = sk.cooldown;
    if (usedWand) {
      p.wandCooldown = 0;
      if (!p.wandPersistent) p.wandActive = false;
      b.metrics.wandHits += 1;
    }

    // 公爵府遗忆(3件)：每回合首次水/冰系技能回复 10% 最大 MP
    if ((sk.elem === 'water' || sk.elem === 'ice') && !zeroMpFallback && getSynergyTier(p, 'dukedom_memory') >= 3 && b._synDukedomElemTurn !== b.turn) {
      b._synDukedomElemTurn = b.turn;
      const recMp = Math.max(8, Math.round(p.mmp * 0.10));
      const beforeMp = p.mp;
      p.mp = Math.min(p.mmp, p.mp + recMp);
      const gained = Math.max(0, p.mp - beforeMp);
      b.metrics.manaRecycled += gained;
      if (gained > 0) spawnCombatFloat(b, 'player', `+${gained} MP`, 'mp');
      pushLog(b, logTag('cbl-star', `✦【共鸣·公爵府遗忆(3件)】水冰调和回涌 +${gained} MP！`));
    }

    // 记录记忆黑板
    if (b.aiMemory.lastSkillId === skillId) b.aiMemory.sameSkillStreak += 1;
    else { b.aiMemory.lastSkillId = skillId; b.aiMemory.sameSkillStreak = 1; }
    if (sk.power > 0) {
      if (b.aiMemory.lastAtkSkillId === skillId) b.aiMemory.sameAtkSkillStreak += 1;
      else { b.aiMemory.lastAtkSkillId = skillId; b.aiMemory.sameAtkSkillStreak = 1; }
      if (b.aiMemory.lastPath === sk.path) b.aiMemory.samePathStreak += 1;
      else { b.aiMemory.lastPath = sk.path; b.aiMemory.samePathStreak = 1; }
    }

    // 暴露度结算
    if (b.witnessActive) {
      let expDelta = zeroMpFallback ? 0 : (sk.exposure || 0);
      if (usedWand) expDelta += 55;
      if (hasRelic(p, 'ebony_sword') && sk.line === 5) {
        expDelta = Math.min(0, expDelta);
      }
      b.exposure = Math.max(0, Math.min(100, b.exposure + expDelta));
      if (expDelta > 0) {
        pushLog(b, logTag('cbl-danger', `👁️ 魔力外显惊动林外耳目，暴露风险 +${expDelta}%（当前 ${b.exposure}%）！`));
      } else if (expDelta < 0) {
        pushLog(b, logTag('cbl-emerald', `🍃 剑锋化水收痕，暴露风险 ${expDelta}%（当前 ${b.exposure}%）。`));
      }
      if (b.exposure >= 100) {
        b.exposureWarningTriggered = true;
        pushLog(b, logTag('cbl-danger', `🚨 暴露风险达 100%！「极光」小队循着魔力波动冲入林间，行踪败露！`, true));
        finishBattle(b, false, 'exposed');
        return { ok: true, exposedFail: true };
      }
      if (b.exposure >= 70) b.exposureWarningTriggered = true;
    }

    // 玩家出手语音锚点（15 招通过 SKILL_VOICE_CUE_MAP 精准映射到已有语音文件）
    if (!timingOpts.skipVoiceCue) {
      const veCast = (typeof window !== 'undefined' && window.VoiceEngine) ? window.VoiceEngine : null;
      const mappedCue = resolveSkillVoiceCue(skillId);
      const fallbackPathCue = `skill_path_${sk.path}`;
      const fallbackPathLower = `skill_path_${String(sk.path || '').toLowerCase()}`;
      const resolvedSkillCue = (veCast && typeof veCast.hasVoice === 'function' && typeof veCast.makeCombatKey === 'function')
        ? (veCast.hasVoice(veCast.makeCombatKey(mappedCue))
            ? mappedCue
            : (veCast.hasVoice(veCast.makeCombatKey(fallbackPathCue))
                ? fallbackPathCue
                : (veCast.hasVoice(veCast.makeCombatKey(fallbackPathLower)) ? fallbackPathLower : mappedCue)))
        : mappedCue;
      emitCombatVoiceCue(b, resolvedSkillCue, { skillId, path: sk.path, fallbackCueKey: fallbackPathCue, charId: 'sylvia' });
    }

    // 自身净化 / 护盾 / 场地 / 导魔回蓝效果
    let playerGuardMicroQueued = false;
    let playerBuffMicroQueued = false;
    const washedBlindJustNow = !!(sk.clearBlind && !zeroMpFallback && p.status.blind > 0);
    if (washedBlindJustNow) {
      delete p.status.blind;
      pushLog(b, logTag('cbl-ice', `💧 水流冲净了眼前的扬尘，视野恢复清晰！`));
    }
    if (sk.clearBurn && !zeroMpFallback && p.status.burn > 0) {
      delete p.status.burn;
      pushLog(b, logTag('cbl-ice', `💧 激流涤净了身上的烈焰灼烧！`));
    }
    if (sk.clearDebuff || (sk.clearDebuffOnAmp && ampProfile.tier >= 1)) {
      const hadDebuff = !!(p.status.blind > 0 || p.status.burn > 0);
      delete p.status.blind;
      delete p.status.burn;
      if (hadDebuff) {
        pushLog(b, logTag('cbl-ice', `🛡️ 冰幕清霜净化了自身异常状态！`));
      }
    }
    if (sk.layFrostFloor) {
      b.frostFloorTurns = Math.max(b.frostFloorTurns || 0, sk.layFrostFloor);
      b.aiMemory.turtleStreak = 0;
      pushLog(b, logTag('cbl-ice', `❄️ 地面覆上一层寒霜薄冰（持续 ${b.frostFloorTurns} 回合）！`));
    }
    if (sk.mpRegenPct || zeroMpFallback) {
      const regenPct = zeroMpFallback ? (sk.zeroMpFallbackRegenPct || 0.06) : (sk.mpRegenPct || 0.06);
      const regenAmt = Math.max(1, Math.round(p.mmp * regenPct));
      const beforeRegen = p.mp;
      p.mp = Math.min(p.mmp, p.mp + regenAmt);
      const gainedRegen = Math.max(0, p.mp - beforeRegen);
      b.metrics.manaRecycled += gainedRegen;
      if (gainedRegen > 0) spawnCombatFloat(b, 'player', `+${gainedRegen} MP`, 'mp');
      if (zeroMpFallback) {
        pushLog(b, logTag('cbl-ice', `🗡️ 魔力不足，「${sk.name}」转为近身平斩并导魔回流 +${gainedRegen} MP！`));
      } else if (gainedRegen > 0) {
        pushLog(b, logTag('cbl-ice', `🗡️ 「${sk.name}」导魔回流 +${gainedRegen} MP（当前 ${p.mp}/${p.mmp}）。`));
      }
    }

    // 冰蓝鹅卵石：每回合首次施放魔攻/护盾技（线 1-4）获 +8 护盾
    if (sk.line >= 1 && sk.line <= 4 && hasRelic(p, 'ice_pebble') && b._pebbleTurn !== b.turn) {
      b._pebbleTurn = b.turn;
      const beforePeb = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + 8);
      if (beforePeb <= 0) p.shieldKind = 'solid';
      if (p.shield > beforePeb && !playerGuardMicroQueued) {
        playerGuardMicroQueued = true;
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'guard', side: 'player', actorKey: 'player', delayMs: 160 });
      }
      pushLog(b, logTag('cbl-ice', `💎【冰蓝鹅卵石】调魔额外凝结 ${Math.max(0, p.shield - beforePeb)} 护盾（当前 ${p.shield}/${p.maxShield}）。`));
    }

    if (sk.shieldBase) {
      const shieldAmpMult = ampProfile && ampProfile.shieldMult > 1.001 ? ampProfile.shieldMult : 1.0;
      const gain = computeSkillShieldGain(p, sk, ampProfile);
      const beforeS = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + gain);
      p.shieldKind = sk.shieldKind || 'solid';
      const shieldDelta = p.shield - beforeS;
      if (shieldDelta > 0) {
        spawnCombatFloat(b, 'player', `+${shieldDelta} 护盾`, 'shield');
        if (!playerGuardMicroQueued) {
          playerGuardMicroQueued = true;
          queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'guard', side: 'player', actorKey: 'player', delayMs: 140 });
        }
      }
      const ampTag = shieldAmpMult > 1.001 ? ` [增幅${shieldAmpMult.toFixed(2)}×]` : '';
      pushLog(b, logTag('cbl-ice', `🛡️ 「${sk.name}」构筑 ${shieldDelta} 点实体护盾${ampTag}（当前 ${p.shield}/${p.maxShield}）。`));

      if (hasRelic(p, 'cross') && (p.status.burn > 0 || p.status.blind > 0)) {
        if (p.status.burn > 0) delete p.status.burn;
        else if (p.status.blind > 0) delete p.status.blind;
        pushLog(b, logTag('cbl-ice', `✝️【银十字架】微光护盾净化了 1 项负面异常！`));
      }
      if (getSynergyTier(p, 'dukedom_memory') >= 3 && b._synDukedomShieldTurn !== b.turn) {
        b._synDukedomShieldTurn = b.turn;
        p.status.afterimage = (p.status.afterimage || 0) + 1;
        pushLog(b, logTag('cbl-emerald', `✦【共鸣·公爵府遗忆(3件)】护盾余风凝形，额外获得 1 层「风行残像」！`));
      }

      // 护箱与 40% 钢霜壁垒（减伤 12% / 盾留 45% / 护箱 85 / 箱留 50% / 赫兰共鸣 +1）
      const crateAdd = (b.crateHp != null) ? computeSkillCrateGuard(sk, ampProfile) : 0;
      if (crateAdd > 0 && b.crateHp != null) {
        p.status.crateGuard = Math.min(105, (p.status.crateGuard || 0) + crateAdd);
        pushLog(b, logTag('cbl-emerald', `📦 冰障延伸护住医疗药箱（当前护箱 ${p.status.crateGuard}）！`));
      }
      if (ampProfile.tier >= 2) {
        p.status.fortress = 1;
        pushLog(b, logTag('cbl-star', `🛡️✦【钢霜壁垒】二阶护盾展开：承伤与箱伤 -12%、盾留 45%、护箱留存 50%！`, true));
        if (b.stageCfg && b.stageCfg.ainoSupport) {
          b.ainoResonance += 1;
          pushLog(b, logTag('cbl-ice', `❄️ 钢霜壁垒震响峡谷回音，艾诺冰枪共鸣 +1（当前 ${b.ainoResonance}/2）！`));
          resolveAinoSpearQueue(b);
        }
      }

      // 第 2 幕罗文：飞旋掷杖袭心回合立起冰盾折射拦截并推进活捉！
      if (b.stageCfg && b.stageCfg.sealRule && primary && primary.hp > 0 && primary.intent && primary.intent.thrownStaff) {
        const boost = ampProfile.tier >= 1 ? 22 : 18;
        b.sealProgress = Math.min(100, (b.sealProgress || 0) + boost);
        primary.status.stagger = 1;
        b.metrics.interrupts += 1;
        decideEnemyIntent(primary, b);
        spawnBanner(b, '🛡️❄️ 冰盾折射 · 截停飞旋掷杖！', 'interrupt');
        triggerBreakJuice(b, 'break_chime');
        pushLog(b, logTag('cbl-star', `🛡️❄️ 你的实体冰盾硬生生折射夹停了飞旋掷来的晦轮杖，罗文架势受挫——合围封锁度 +${boost}%（${b.sealProgress}%）！`, true));
      }
    }

    if (sk.rooted && !zeroMpFallback) p.status.rooted = 1;
    if (sk.thornsDmg > 0) p.status.iceThorns = Math.max(p.status.iceThorns || 0, sk.thornsDmg);
    if (sk.afterimage) p.status.afterimage = (p.status.afterimage || 0) + sk.afterimage;
    if (sk.selfAdvancePct) {
      p.av = Math.max(0, Math.round((p.av || 0) - (p.baseAv || 100) * sk.selfAdvancePct));
    }
    if (sk.nextApBonus) p.status.nextAp = (p.status.nextAp || 0) + sk.nextApBonus;
    if (!playerBuffMicroQueued && (sk.afterimage || sk.nextApBonus || washedBlindJustNow || sk.clearDebuff)) {
      playerBuffMicroQueued = true;
      queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'buff', side: 'player', actorKey: 'player', delayMs: 160 });
    }

    // 攻击结算
    let totalManaReturned = 0;
    const consumedChain = !!(sk.power && sk.power > 0 && p.status.breakChain > 0 && sk.id !== 'sword_1_basic' && !zeroMpFallback);
    let anyHitDealt = false;
    let activatedChain = false;
    let usedFrostPierce = false;
    let activatedFrostPierce = false;
    let usedNorthFrostShatter = false;
    let playedBreakOrParry = false;
    let playedBladeClash = false;
    let anyDidCrit = false;
    let anyDidBreak = false;
    let anyDidRiposte = false;
    let anyShieldShattered = false;
    let totalSkillDmg = 0;
    const skipPlayAction = !!(timingOpts.skipPlayAction || timingOpts.skipPreCastAction);
    const hitTargetIndices = [];
    const critTargetIndices = [];
    const brokenIndices = [];
    const oneMoreIndices = [];
    const shieldHitTargets = [];

    if ((!sk.power || sk.power <= 0) && (sk.shieldBase || sk.afterimage || washedBlindJustNow)) {
      const defVfxKind = sk.elem === 'water' ? 'water' : (sk.path === 'SWORD' || sk.elem === 'phys') ? 'sword' : 'ice';
      queueElementVFX(b, defVfxKind, 'player', 0, { skipHitStop: true });
      if (!skipPlayAction) {
        queuePixelAction(b, {
          type: 'skill',
          skillId,
          targetIdx: Math.max(0, b.enemies.indexOf(primary)),
          targetIndices: [Math.max(0, b.enemies.indexOf(primary))],
          critTargetIndices: [],
          brokenIndices: [],
          oneMoreIndices: [],
          shieldHitTargets: [],
          didRiposte: false,
          usedWand,
          ampPct: ampProfile ? ampProfile.ampPct : 0,
          ampTier: ampProfile ? ampProfile.tier : 0,
          missed: false,
        });
      }
    }

    if (sk.power && sk.power > 0) {
      const targets = sk.aoe ? b.enemies.filter(e => e.hp > 0) : [primary];
      let peakCastTrauma = 0;
      let castHitStopQueued = false;

      // 致盲（扬尘遮眼）失手判定
      if (p.status.blind > 0 && !sk.aoe && !sk.sureHit) {
        p.status.blind -= 1;
        if (p.status.blind <= 0) delete p.status.blind;
        pushLog(b, logTag('cbl-star', `🌫️ 视线受扬尘遮蔽，你的「${sk.name}」偏斜落空！（提示：用水系术式洗净视野，或用霜域全体覆盖）`));
        if (p.overcastMode >= 3 && isAmpableSkill(sk) && getSkillOvercastCap(sk) >= 0.60 - 1e-6) {
          p.overcastMode = 0;
          p._lastOvercastMode = 0;
          p.ampPct = 0;
          p.overcastPct = 0;
        }
        syncDerivedBattleState(b);
        const missIdx = Math.max(0, b.enemies.indexOf(primary));
        if (!skipPlayAction) {
          queuePixelAction(b, {
            type: 'skill',
            skillId,
            targetIdx: missIdx,
            targetIndices: [missIdx],
            critTargetIndices: [],
            brokenIndices: [],
            oneMoreIndices: [],
            shieldHitTargets: [],
            didRiposte: false,
            usedWand,
            ampPct: ampProfile ? ampProfile.ampPct : 0,
            ampTier: ampProfile ? ampProfile.tier : 0,
            missed: true,
          });
        }
        if (!b.headless) {
          safeSfx((sk.path === 'SWORD' || sk.elem === 'phys') ? 'sword_slash' : sk.elem === 'water' ? 'water_surge' : 'ice_cast');
          renderCombatUI();
        }
        return { ok: true, missedByBlind: true };
      }

      targets.forEach(e => {
        if (!e || e.hp <= 0 || p.hp <= 0 || b.over) return;
        const stance = e.intent ? e.intent.stance : 'HEAVY_WINDUP';
        if (stance === 'UNDER_SEEP' && e.aiType === 'noelle') {
          b.metrics.enteredUnderSeep = true;
        }

        // 第 5 幕诺艾儿：冰缝暗流陷阱（冰霜之息冻绝碎盾 / 风行残像替身 / 硬吃降为 115 防软锁）
        if (e.intent && e.intent.ambushTrap && !e.seepSevered) {
          if (sk.severSeep) {
            e.seepSevered = true;
            e.seepStacks = 0;
            e.intent.ambushTrap = false;
            e.status.stagger = 1;
            e.shield = 0;
            b.metrics.interrupts += 1;
            decideEnemyIntent(e, b);
            spawnBanner(b, '❄️ 冰霜之息 · 冻绝暗流！', 'interrupt');
            triggerBreakJuice(b, 'break_chime');
            playedBreakOrParry = true;
            pushLog(b, logTag('cbl-ice', `❄️「${sk.name}」将脚底冰缝暗流彻底冻死斩断，顺势粉碎诺艾儿的水幕并令其架势受阻！`, true));
          } else if (p.status.afterimage > 0) {
            p.status.afterimage = Math.max(0, p.status.afterimage - 1);
            e.seepSevered = true;
            e.intent.ambushTrap = false;
            pushLog(b, logTag('cbl-emerald', `💨 脚底冰缝暗流骤然暴起，幸亏「风行残像」替身引爆了暗流杀阵，你真身安然避开！`));
          } else {
            const trapDmg = Math.round((e.intent.trapDmg || 115) * dmgScale);
            p.hp = Math.max(0, p.hp - trapDmg);
            addCombatTrauma(0.85, b);
            queueElementVFX(b, 'water', 'player', 0);
            spawnCombatFloat(b, 'player', `-${trapDmg}`, 'enemy-dmg');
            spawnBanner(b, '💧 冰缝暗流 · 绕盾穿心！', 'danger');
            pushLog(b, logTag('cbl-danger', `💥 脚底冰缝暗水线绕过护盾骤然刺起，造成 ${trapDmg} 点重创！（可用「冰霜之息」冻绝暗流）`, true));
            e.intent.ambushTrap = false;
            if (p.hp <= 0) return;
          }
        }
        if (p.hp <= 0) return;

        // 贝阿特丽丝 / 红莲铁幕：融冰守势反劈
        if (e.intent && e.intent.meltIceCounter && sk.elem === 'ice' && !zeroMpFallback) {
          const meltDmg = Math.round(34 * dmgScale);
          const blk = Math.min(Math.max(0, p.shield), meltDmg);
          p.shield = Math.max(0, p.shield - blk);
          p.hp = Math.max(0, p.hp - (meltDmg - blk));
          p.status.burn = (p.status.burn || 0) + 1;
          queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'burn', side: 'player', actorKey: 'player', delayMs: 220 });
          triggerShake(b, false);
          if (!b.headless && !playedBladeClash) { safeSfx('blade_clash'); playedBladeClash = true; }
          pushLog(b, logTag('cbl-danger', `🔥 ${e.name} 借烈焰剑障反劈冰晶，造成 ${meltDmg - blk} 伤害并附灼烧（宜改用水系术式浇灭）！`));
          if (p.hp <= 0) return;
        }

        // 第 9 幕风神：风眼静滞破阵（霜域棘阵或 >=40% 二阶增幅）vs 听劲风壁反切
        let brokeStillness = false;
        if (e.intent && e.intent.eyeStillnessStance && !zeroMpFallback && (sk.breakStillness || ampProfile.tier >= 2)) {
          brokeStillness = true;
          e.status.stagger = 1;
          e.shield = Math.max(0, (e.shield || 0) - 90);
          e.evadeCharges = 0;
          e.evadeBrokenThisTurn = true;
          b.metrics.interrupts += 1;
          decideEnemyIntent(e, b);
          triggerBreakOrInterruptRelics(b, e, true);
          spawnBanner(b, '❄️🌪️ 破风眼静滞！', 'interrupt');
          triggerBreakJuice(b, 'break_chime');
          playedBreakOrParry = true;
          pushLog(b, logTag('cbl-star', `❄️🌪️「${sk.name}」直贯飓风圆心无风静滞点，削去 90 点风壁并截断风神反制阵！`, true));
        } else if (e.intent && e.intent.windGuardCounter && !sk.aoe) {
          const retal = Math.round(60 * dmgScale);
          const halfBlk = Math.min(Math.floor(Math.max(0, p.shield) * 0.5), retal);
          p.shield = Math.max(0, p.shield - halfBlk);
          p.hp = Math.max(0, p.hp - (retal - halfBlk));
          e.shield = Math.max(0, e.shield || 0) + Math.round(28 * hpShdScale);
          triggerShake(b, false);
          if (!b.headless && !playedBladeClash) { safeSfx('blade_clash'); playedBladeClash = true; }
          pushLog(b, logTag('cbl-emerald', `🌪️ 风神借风壁听劲反切，穿盾造成 ${retal - halfBlk} 伤害并补强风壁！`));
          if (p.hp <= 0) return;
        }

        // 寒锋斩迎击 CLOSE_LUNGE（减伤 60%、破闪；对风神真空连刃触发斩风瞬反）
        let didTempestRiposte = false;
        let didLungeRiposte = false;
        if (!zeroMpFallback && sk.counterLunge && stance === 'CLOSE_LUNGE') {
          didLungeRiposte = true;
          p.status.lungeMitigate = 1;
          e.evadeCharges = 0;
          e.evadeBrokenThisTurn = true;
          b.metrics.ripostes += 1;
          if (e.intent && (e.intent.tempestVacuum || e.intent.moveKey === 'TEMPEST_VACUUM')) {
            didTempestRiposte = true;
            e.status.stagger = 1;
            p.status.breakChain = 1;
            b.ap = Math.min(b.apMax, b.ap + 1);
            b.metrics.interrupts += 1;
            decideEnemyIntent(e, b);
            triggerBreakOrInterruptRelics(b, e, true);
            spawnBanner(b, '✦ 寒锋斩 · 斩风瞬反！', 'riposte');
            triggerBreakJuice(b, 'parry');
            playedBreakOrParry = true;
            emitCombatVoiceCue(b, 'parry', { skillId, enemyId: e.id, charId: 'sylvia' });
            pushLog(b, logTag('cbl-emerald', `✦ 寒锋斩·斩风瞬反！迎锋劈开风神真空连刃，打断攻势并赢得 +1 AP！`, true));
          } else {
            spawnBanner(b, '⚡ 寒锋迎击 · 卸力破闪！', 'riposte');
            triggerBreakJuice(b, 'parry');
            playedBreakOrParry = true;
            emitCombatVoiceCue(b, 'parry', { skillId, enemyId: e.id, charId: 'sylvia' });
          }
        }

        if (sk.stripEvade && !zeroMpFallback) {
          e.evadeCharges = Math.max(0, (e.evadeCharges || 0) - sk.stripEvade);
          e.evadeBrokenThisTurn = true;
        }

        // 闪避层数判定
        const bypassEvade = !!(sk.aoe || sk.sureHit || usedWand || stance === 'STAGGERED' || didLungeRiposte || brokeStillness);
        if (!bypassEvade && e.evadeCharges > 0) {
          e.evadeCharges -= 1;
          if (e.mp != null && sk.mp > 0) {
            e.mp = Math.max(0, e.mp - 6);
          }
          pushLog(b, logTag('cbl-muted', `💨 ${e.name} 消耗 1 层闪避轻盈避开了「${sk.name}」（余闪避×${e.evadeCharges}）！`));
          return;
        }

        // 临时恢复 wandActive 供精算读取
        const prevWand = p.wandActive;
        if (usedWand) p.wandActive = true;
        const est = estimateSkillDamage(b, sk, e, { mpCost, powerMp, ampProfile, ringBonus, zeroMpFallback });
        p.wandActive = prevWand;

        // 艾诺正面镜冰判定
        let ainoCleanHit = false;
        if (e.mirrorGuard) {
          if (est.willInterrupt || (p.status.mirrorRiposteWindow > 0 && sk.line === 1)) {
            ainoCleanHit = true;
            delete p.status.mirrorRiposteWindow;
          } else if (sk.line === 3 && ampProfile.tier >= 1) {
            p.status.mirrorRiposteWindow = 1;
            e.status.chill = Math.max(e.status.chill || 0, 2);
            pushLog(b, logTag('cbl-ice', `❄️ 增幅霜息逼得艾诺微偏镜壁，下一次冰晶主炮可直穿镜冰！`));
          } else {
            if (!b.headless && !playedBladeClash) { safeSfx('blade_clash'); playedBladeClash = true; }
            pushLog(b, logTag('cbl-muted', `🧊 艾诺凝出正面镜冰挡下「${sk.name}」：「路径太直，这不算有效命中。」`));
            emitCombatVoiceCue(b, 'boss_aino_block', { enemyId: e.id, charId: 'aino' });
            return;
          }
        }

        // 截断 DUAL_CAST 破招判定
        let didInterrupt = false;
        if (!brokeStillness && !didTempestRiposte && est.willInterrupt && stance === 'DUAL_CAST') {
          didInterrupt = true;
          e.status.stagger = 1;
          b.metrics.interrupts += 1;
          triggerBreakOrInterruptRelics(b, e, true);
          if (b.stageCfg.ainoSupport) {
            b.ainoResonance += (e.aiType === 'hulan_lord' ? 2 : 1);
          }
          decideEnemyIntent(e, b);
          spawnBanner(b, '💥 截断破招 INTERRUPT!', 'interrupt');
          triggerBreakJuice(b, 'break_chime');
          playedBreakOrParry = true;
          emitCombatVoiceCue(b, 'interrupt', { skillId, enemyId: e.id, charId: 'sylvia' });
        }

        // 第 2 幕罗文：冰履铺场配合冰系截断窄道突围推进活捉
        if (b.stageCfg.sealRule && stance === 'DUAL_CAST' && b.frostFloorTurns > 0 && sk.elem === 'ice' && !zeroMpFallback) {
          b.frostFloorTurns = 0;
          e.status.stagger = 1;
          didInterrupt = true;
          b.metrics.interrupts += 1;
          b.sealProgress = Math.min(100, (b.sealProgress || 0) + 20);
          decideEnemyIntent(e, b);
          spawnBanner(b, '🪨❄️ 冰履滑步 · 岩冰合围！', 'interrupt');
          triggerBreakJuice(b, 'break_chime');
          playedBreakOrParry = true;
          pushLog(b, logTag('cbl-star', `🪨❄️ 罗文踩碎你铺开的冰履慢了半步，雷纳德趁势压上——合围封锁度 +20%（${b.sealProgress}%）！`, true));
        }

        const ePos = b.enemies.indexOf(e);
        const critRate = getPlayerCritChance(p);
        const didCrit = !!(b._forceCrit || (critRate > 0 && Math.random() < critRate));
        if (didCrit) {
          anyDidCrit = true;
          if (ePos >= 0 && !critTargetIndices.includes(ePos)) critTargetIndices.push(ePos);
        }
        const critMult = getPlayerCritMult(p);
        const finalDmg = didCrit ? Math.max(4, Math.round(est.dmg * critMult)) : est.dmg;

        if (sk.elem === 'ice' && p.status.frostPierce > 0 && hasRelic(p, 'aino_frost_shard')) {
          usedFrostPierce = true;
        }
        let appliedChill = false;
        if (est.northFrostShatter) {
          usedNorthFrostShatter = true;
          e.status.chill = Math.max(e.status.chill || 0, 2);
          appliedChill = true;
        }

        const shieldBeforeHit = e.shield || 0;
        const dmgRes = dealDamageToEnemy(b, e, finalDmg, {
          wandRefract: est.wandRefract,
          trueMagic: !!est.trueMagic,
          pierceHalfShield: !zeroMpFallback && !!sk.pierceHalfShield,
          severSeep: !zeroMpFallback && !!sk.severSeep,
          nonLethalCap: !!b.stageCfg.sealRule,
        });
        const shieldBroken = shieldBeforeHit > 0 && (e.shield || 0) <= 0;
        const shieldWasHit = shieldBeforeHit > 0 && (dmgRes.shieldAbsorbed > 0 || shieldBroken);
        if (shieldBroken) anyShieldShattered = true;
        if (shieldWasHit && ePos >= 0) {
          shieldHitTargets.push({ enemyIdx: ePos, shattered: shieldBroken });
        }
        anyHitDealt = true;

        if (sk.douseFire && !zeroMpFallback) {
          const douseN = typeof sk.douseFire === 'number' ? sk.douseFire : 1;
          if (e.fireStacks) e.fireStacks = Math.max(0, e.fireStacks - 1);
          if (e.fireAura > 0) {
            e.fireAura = Math.max(0, e.fireAura - douseN);
            pushLog(b, logTag('cbl-ice', `💧 水流浇灭 ${e.name} 烈焰斗气（剩余斗气×${e.fireAura}）！`));
          }
        }
        if (sk.chill && !zeroMpFallback) {
          e.status.chill = Math.max(e.status.chill || 0, sk.chill);
          appliedChill = true;
        }
        if (sk.drainWindMp && !zeroMpFallback && e.mp != null) {
          e.mp = Math.max(0, e.mp - sk.drainWindMp);
          pushLog(b, logTag('cbl-ice', `❄️ 寒霜压制风步走位，迫使 ${e.name} 损耗 ${sk.drainWindMp} MP（剩余 ${e.mp}/${e.mmp}）！`));
        }
        if (dmgRes.actualHpLoss > 0 && !zeroMpFallback && sk.line === 5 && p.passives && p.passives.includes('frost_edge')) {
          e.status.chill = Math.max(e.status.chill || 0, 1);
          appliedChill = true;
        }

        if (didCrit && sk.line === 5 && hasRelic(p, 'ebony_sword') && b._ebonyApRefundTurn !== b.turn) {
          b._ebonyApRefundTurn = b.turn;
          b.ap = Math.min(b.apMax, b.ap + 1);
          pushLog(b, logTag('cbl-violet', `🗡️【乌木紫穗剑】剑锋暴击破风，返还 1 AP（当前 ${b.ap}/${b.apMax}）！`));
        }
        if (sk.line === 5 && (didCrit || didInterrupt || didTempestRiposte) && getSynergyTier(p, 'jikan_blade') >= 2 && b._synJikanApTurn !== b.turn) {
          b._synJikanApTurn = b.turn;
          b.ap = Math.min(b.apMax, b.ap + 1);
          pushLog(b, logTag('cbl-violet', `✦【共鸣·霁馆剑心(2件)】剑势贯通返还 +1 AP（当前 ${b.ap}/${b.apMax}）！`));
        }
        if (didInterrupt || didLungeRiposte || brokeStillness) {
          if (hasRelic(p, 'aino_frost_shard')) activatedFrostPierce = true;
          if (didInterrupt || didTempestRiposte) activatedChain = true;
        }

        if (ePos >= 0) hitTargetIndices.push(ePos);
        if (didInterrupt || brokeStillness) anyDidBreak = true;
        if (didLungeRiposte || didTempestRiposte) anyDidRiposte = true;
        totalSkillDmg += finalDmg;
        if (dmgRes.actualHpLoss > 0 || dmgRes.shieldAbsorbed > 0 || finalDmg > 0) {
          const ringTag = ringGrades.length ? ` ${ringGrades[ringGrades.length - 1]}` : '';
          let floatLabel;
          if (didCrit) floatLabel = `✦ -${finalDmg} 暴击!`;
          else if (didTempestRiposte) floatLabel = `✦ -${finalDmg} 斩风瞬反!`;
          else if (didInterrupt || brokeStillness) floatLabel = `-${finalDmg} 破招!`;
          else if (didLungeRiposte) floatLabel = `-${finalDmg} 迎击!`;
          else floatLabel = `-${finalDmg}`;
          const floatKind = didCrit
            ? 'gold-crit'
            : (didInterrupt || brokeStillness || est.mult > 1 || est.trueMagic) ? 'crit' : 'dmg';
          spawnCombatFloat(b, 'enemy', floatLabel, floatKind, ePos);
          queueHitPulse(b, 'enemy', ePos);

          const isHeavyImpact = !!(didCrit || didInterrupt || didLungeRiposte || brokeStillness || shieldBroken || sk.aoe);
          peakCastTrauma = Math.max(peakCastTrauma, didCrit || sk.aoe ? 0.85 : isHeavyImpact ? 0.58 : 0.30);

          const primaryVfx = (sk.line === 5 || sk.elem === 'phys') ? 'sword' : sk.elem === 'water' ? 'water' : 'ice';
          queueElementVFX(b, primaryVfx, 'enemy', ePos, { skipHitStop: castHitStopQueued });
          if (didCrit || isHeavyImpact) {
            queueElementVFX(b, didCrit ? 'crit' : 'break', 'enemy', ePos, { skipHitStop: castHitStopQueued });
            castHitStopQueued = true;
          }
          if (e.hp > 0 && ePos >= 0 && appliedChill) {
            queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'chill', side: 'enemy', enemyIdx: ePos, actorKey: `enemy:${ePos}`, delayMs: 240 });
          }

          const tagStr = [
            ringTag ? logTag('cbl-ice', `[${ringTag.trim()}]`) : '',
            didTempestRiposte ? logTag('cbl-emerald', '【斩风瞬反！】', true) : '',
            brokeStillness ? logTag('cbl-star', '【破风眼静滞！】', true) : '',
            didInterrupt ? logTag('cbl-star', '【截断破招！】', true) : '',
            didLungeRiposte && !didTempestRiposte ? logTag('cbl-emerald', '【迎击2.1×】', true) : '',
            didCrit ? logTag('cbl-star', `【暴击${critMult.toFixed(2)}×】`, true) : '',
            est.trueMagic ? logTag('cbl-violet', dmgRes.magicShieldBypassed ? '【晦轮真伤·穿盾】' : '【晦轮真伤】', true) : '',
            est.mult > 1 ? logTag('cbl-cobalt', '【属性克制】', true) : '',
            ampProfile.addDmg > 0.005 ? logTag('cbl-star', `[增幅+${Math.round(ampProfile.addDmg * 100)}%]`) : '',
          ].filter(Boolean).join(' ');

          pushLog(b, `⚔️ 「${sk.name}」命中 ${e.name}，造成 <b>${finalDmg}</b> 伤害${dmgRes.shieldAbsorbed ? `（破盾${dmgRes.shieldAbsorbed}）` : ''} ${tagStr}`);
        }

        b.aiMemory.currentTurnDmgDealt += dmgRes.actualHpLoss;
        b.metrics.playerDmgDealt = (b.metrics.playerDmgDealt || 0) + dmgRes.actualHpLoss + (dmgRes.shieldAbsorbed || 0);

        // 第 4 幕艾诺三击制计分
        if (b.stageCfg.hitRule && ainoCleanHit) {
          b.playerHits += 1;
          pushLog(b, logTag('cbl-star', `🎯 有效命中！比分：希尔维亚 ${b.playerHits} : ${b.enemyHits} 艾诺！`, true));
        }

        // 第 5 幕起魔战循环：有效生命魔伤 100% 等量回蓝
        if (p.hasManaCycle && sk.elem !== 'phys' && !zeroMpFallback && dmgRes.actualHpLoss > 0) {
          const jikanDouble = (sk.line === 5 && (didLungeRiposte || didInterrupt || didTempestRiposte) && getSynergyTier(p, 'jikan_blade') >= 2);
          const baseRet = Math.round(dmgRes.actualHpLoss * COMBAT_BALANCE_V32.manaCycleReturnRatio);
          totalManaReturned += jikanDouble ? dmgRes.actualHpLoss * 2 : baseRet;
          if (jikanDouble) {
            pushLog(b, logTag('cbl-violet', `✦【共鸣·霁馆剑心(2件)】剑步迎锋引动魔战双倍回蓝！`));
          }
        }

        // 弱点锁削减与弱点击破（破防 +10% 加法增伤、+1 AP 乘胜追击、回蓝）
        let lockDmg = 0;
        if (!zeroMpFallback) {
          if (didInterrupt || didLungeRiposte || brokeStillness) {
            lockDmg = getSkillBaseLockDamage(sk) + 1 + (est.extraLocks || 0);
          } else if (est.mult > 1.0) {
            lockDmg = getSkillBaseLockDamage(sk) + (est.extraLocks || 0);
          } else if ((est.extraLocks || 0) > 0) {
            lockDmg = est.extraLocks;
          }
          if (sk.aoe && lockDmg > 1) lockDmg = 1;
        }
        if (lockDmg > 0 && e.hp > 0 && !e.broken && (e.maxLocks || 0) > 0 && !dmgRes.phase2Triggered) {
          e.locks = Math.max(0, (e.locks != null ? e.locks : e.maxLocks) - lockDmg);
          if (e.locks <= 0) {
            e.broken = true;
            anyDidBreak = true;
            if (ePos >= 0 && !brokenIndices.includes(ePos)) brokenIndices.push(ePos);
            b.metrics.weaknessBreaks = (b.metrics.weaknessBreaks || 0) + 1;
            triggerBreakOrInterruptRelics(b, e, false);
            const pushKey = e.boss ? 'boss' : (e.mhp >= 220 ? 'elite' : 'mob');
            const pushPct = COMBAT_BALANCE_V32.HSR_AV.pushPct[pushKey] || 0.45;
            e.av = Math.round((e.av || e.baseAv || 100) + (e.baseAv || 100) * pushPct);

            if (!e.nonLethalSpar && e.hp > 0) {
              const burstDmg = Math.max(8, Math.round(p.matk * COMBAT_BALANCE_V32.HSR_AV.breakBurstMatkRatio));
              const burstRes = dealDamageToEnemy(b, e, burstDmg, {
                trueMagic: usedWand,
                nonLethalCap: !!b.stageCfg.sealRule,
              });
              if (burstRes.actualHpLoss > 0) {
                spawnCombatFloat(b, 'enemy', `✦ 击破 -${burstRes.actualHpLoss}`, 'gold-crit', ePos);
              }
            }

            if (!b.oneMoreUsedThisTurn && COMBAT_BALANCE_V32.HSR_AV.maxOneMorePerNaturalTurn > 0) {
              b.oneMoreUsedThisTurn = true;
              b.oneMoreActive = true;
              if (ePos >= 0 && !oneMoreIndices.includes(ePos)) oneMoreIndices.push(ePos);
              b.metrics.oneMoreCount = (b.metrics.oneMoreCount || 0) + 1;
              b.ap = Math.min(b.apMax, b.ap + 1);
              const omMp = Math.round(p.mmp * COMBAT_BALANCE_V32.HSR_AV.oneMoreMpRefundPct);
              const mpBeforeOm = p.mp;
              p.mp = Math.min(p.mmp, p.mp + omMp);
              const omGain = Math.max(0, p.mp - mpBeforeOm);
              b.metrics.manaRecycled += omGain;
              p.av = 0;
              if (omGain > 0) spawnCombatFloat(b, 'player', `+${omGain} MP`, 'mp');
              spawnBanner(b, '✦ ONE MORE · 乘胜追击!', 'riposte');
              pushLog(b, logTag('cbl-star', `✦【弱点击破 · 乘胜追击】击碎 ${e.name} 全部弱点锁（滞缓敌势 +${Math.round(pushPct * 100)}%），赢得 +1 AP、+${omGain} MP！`, true));
              emitCombatVoiceCue(b, 'one_more', { enemyId: e.id, charId: 'sylvia' });
              if (!b.headless) safeSfx('one_more');
              playedBreakOrParry = true;
            } else {
              b.metrics.overflowBreaksIntercepted = (b.metrics.overflowBreaksIntercepted || 0) + 1;
              const ov = COMBAT_BALANCE_V32.HSR_AV.overflowBreakBonus;
              const ovMp = Math.round(p.mmp * ov.mpPct);
              const mpBeforeOv = p.mp;
              p.mp = Math.min(p.mmp, p.mp + ovMp);
              const ovGain = Math.max(0, p.mp - mpBeforeOv);
              b.metrics.manaRecycled += ovGain;
              p.av = Math.max(0, Math.round((p.av || 0) - (p.baseAv || 100) * ov.selfAdvancePct));
              if (ovGain > 0) spawnCombatFloat(b, 'player', `+${ovGain} MP`, 'mp');
              pushLog(b, logTag('cbl-ice', `✦【余势破锁】击破 ${e.name} 弱点锁，汲回魔力 +${ovGain} MP！`));
            }
          }
        }
      });

      if (peakCastTrauma > 0 && !getPixelVfxApi()) {
        addCombatTrauma(peakCastTrauma, b);
      }
      const primaryPos = Math.max(0, b.enemies.indexOf(primary));
      if (!skipPlayAction) {
        queuePixelAction(b, {
          type: 'skill',
          skillId,
          targetIdx: primaryPos,
          targetIndices: hitTargetIndices.length ? hitTargetIndices : targets.map(t => Math.max(0, b.enemies.indexOf(t))),
          critTargetIndices,
          brokenIndices,
          oneMoreIndices,
          shieldHitTargets,
          didCrit: anyDidCrit,
          didBreak: anyDidBreak,
          didRiposte: anyDidRiposte,
          shieldBroken: anyShieldShattered,
          usedWand,
          ampPct: ampProfile ? ampProfile.ampPct : 0,
          ampTier: ampProfile ? ampProfile.tier : 0,
          missed: !anyHitDealt,
        });
      } else if (!timingOpts.skipPlayAction) {
        // 兼容非门控旧回退轨：补发破锁系统级特效（门控轨已由 releaseGate 同帧释放，绝不双播）
        brokenIndices.forEach(bIdx => {
          queuePixelAction(b, {
            type: 'system_fx',
            fxId: 'fx_weakness_break',
            side: 'enemy',
            enemyIdx: bIdx,
            actorKey: `enemy:${bIdx}`,
            oneMore: oneMoreIndices.includes(bIdx),
            delayMs: 30,
          });
        });
      }

      if (usedFrostPierce) delete p.status.frostPierce;
      if (usedNorthFrostShatter) {
        b._synNorthFrostTurn = b.turn;
      }
      if (consumedChain && anyHitDealt) {
        delete p.status.breakChain;
        const chainBonus = Math.round(p.mmp * 0.12) + (hasRelic(p, 'shell_pin') ? Math.round(p.mmp * 0.08) : 0);
        const beforeChainMp = p.mp;
        p.mp = Math.min(p.mmp, p.mp + chainBonus);
        b.metrics.manaRecycled += Math.max(0, p.mp - beforeChainMp);
        pushLog(b, logTag('cbl-star', `🔗【破招回涌】乘势追击引动魔脉回流 +${p.mp - beforeChainMp} MP！`));
      }
      if (activatedFrostPierce) {
        p.status.frostPierce = 1;
        pushLog(b, logTag('cbl-ice', `❄️【钢冰试炼笺】破招余锋凝实，下一次冰系攻击额外穿透 25% 法抗！`));
      }
      if (activatedChain) {
        p.status.breakChain = 1;
      }
      if (!playerBuffMicroQueued && (activatedChain || activatedFrostPierce)) {
        playerBuffMicroQueued = true;
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'buff', side: 'player', actorKey: 'player', delayMs: 220 });
      }

      if (resolveAinoSpearQueue(b)) {
        anyShieldShattered = true;
      }
    }

    if (p.hp > 0 && p.hp < p.mhp * 0.35 && !b._blueVialTriggered && hasRelic(p, 'blue_vial')) {
      b._blueVialTriggered = true;
      const vialHeal = Math.max(15, Math.round(p.mhp * 0.25));
      const beforeVialHp = p.hp;
      p.hp = Math.min(p.mhp, p.hp + vialHeal);
      p.status.afterimage = (p.status.afterimage || 0) + 1;
      if (p.hp > beforeVialHp) {
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_heal_emerald', side: 'player', actorKey: 'player' });
      }
      if (!b.headless) safeSfx('buff');
      pushLog(b, logTag('cbl-ice', `🧪【淡蓝小瓶】濒危安神凉雾散开，回复 ${vialHeal} 生命并幻化 1 层「风行残像」！`, true));
    }

    if (p.hp <= 0) {
      finishBattle(b, false, 'hp_zero');
      return { ok: true, defeated: true };
    }

    if (totalManaReturned > 0) {
      const mpBefore = p.mp;
      p.mp = Math.min(p.mmp, p.mp + totalManaReturned);
      b.metrics.manaRecycled += totalManaReturned;
      const mpGain = p.mp - mpBefore;
      if (mpGain > 0) spawnCombatFloat(b, 'player', `+${mpGain} MP`, 'mp');
      const flowEnemyIdx = hitTargetIndices.length ? hitTargetIndices[0] : Math.max(0, b.enemies.indexOf(primary));
      queuePixelAction(b, {
        type: 'system_fx',
        fxId: 'fx_mana_cycle_flow',
        fromKey: 'player',
        toKey: `enemy:${flowEnemyIdx}`,
        enemyIdx: flowEnemyIdx,
        delayMs: 360,
      });
      pushLog(b, logTag('cbl-ice', `⚡【魔战循环】等量有效魔伤回流 +${totalManaReturned} MP（当前 ${p.mp}/${p.mmp}）！`));
    }
    if (p.overcastMode >= 3 && isAmpableSkill(sk) && getSkillOvercastCap(sk) >= 0.60 - 1e-6) {
      p.overcastMode = 0;
      p._lastOvercastMode = 0;
      p.ampPct = 0;
      p.overcastPct = 0;
    }
    syncDerivedBattleState(b);

    if (!b.headless && !playedBreakOrParry) {
      if (anyDidCrit) {
        safeSfx('combat_crit');
      } else if (anyShieldShattered) {
        safeSfx('ice_shatter');
      } else if (!playedBladeClash) {
        if ((!sk.power || sk.power <= 0) && sk.shieldBase) {
          safeSfx('shield_up');
        } else if ((!sk.power || sk.power <= 0) && (sk.afterimage || sk.rooted || sk.selfAdvancePct || sk.nextApBonus || sk.clearDebuff || washedBlindJustNow)) {
          safeSfx('buff');
        } else if (usedWand) {
          safeSfx('eclipse_cast');
        } else if (sk.line === 5 || sk.elem === 'phys') {
          safeSfx('sword_slash');
        } else if (sk.elem === 'water') {
          safeSfx('water_surge');
        } else {
          safeSfx('ice_cast');
        }
      }
    }

    const impactSummary = {
      dmg: totalSkillDmg,
      crit: anyDidCrit,
      broken: anyDidBreak,
      oneMore: oneMoreIndices.length > 0,
      shieldShattered: anyShieldShattered,
      didRiposte: anyDidRiposte,
      missed: !!(sk.power > 0 && !anyHitDealt),
      hitTargetIndices,
      critTargetIndices,
      brokenIndices,
      oneMoreIndices,
      shieldHitTargets,
    };
    if (typeof timingOpts.onImpactResolved === 'function') {
      try { timingOpts.onImpactResolved(impactSummary); } catch (e) {}
    }

    if (checkImmediateVictoryOrNextWave(b)) {
      if (!b.headless) renderCombatUI();
      return Object.assign({ ok: true, battleEndedOrAdvanced: true, ringGrades, ringBonus }, impactSummary);
    }

    if (!b.headless) renderCombatUI();
    return Object.assign({ ok: true, ringGrades, ringBonus, zeroMpFallback }, impactSummary);
  }

  function applyTurnBoundaryCleanup(b, bankedAp) {
    const p = b.player;
    const hadFortress = !!(p.status && p.status.fortress > 0);
    delete p.status.rooted;
    delete p.status.iceThorns;
    delete p.status.lungeParry;
    delete p.status.lungeMitigate;
    delete p.status.fortress;
    delete p.status.zeroMpThisTurn;
    delete p.status.nobleReflect;
    if (p.status.burn <= 0) delete p.status.burn;
    if (p.status.blind <= 0) delete p.status.blind;
    if (p.status.afterimage < 0) p.status.afterimage = 0;

    if (b.frostFloorTurns > 0) b.frostFloorTurns = Math.max(0, b.frostFloorTurns - 1);

    // 护盾与护箱留存：钢霜壁垒 45%/50%，生根之冰 30%/30%，常规 20%/30%
    const retainRate = hadFortress
      ? COMBAT_BALANCE_V32.SHIELD_RETAIN_RATE.fortress
      : (p.passives.includes('root_ice')
          ? COMBAT_BALANCE_V32.SHIELD_RETAIN_RATE.rootIce
          : COMBAT_BALANCE_V32.SHIELD_RETAIN_RATE.default);
    p.shield = Math.max(0, Math.floor(Math.max(0, p.shield) * retainRate));
    if (p.shield <= 0) p.shieldKind = 'solid';

    if (p.status.crateGuard > 0) {
      const crateRetain = hadFortress
        ? COMBAT_BALANCE_V32.CRATE_GUARD_RETAIN_RATE.fortress
        : COMBAT_BALANCE_V32.CRATE_GUARD_RETAIN_RATE.default;
      p.status.crateGuard = Math.floor(p.status.crateGuard * crateRetain);
      if (p.status.crateGuard <= 0) delete p.status.crateGuard;
    }

    // 休闲模式：每回合末额外回复 +15% 最大魔力
    if (b.casualMode && p.hp > 0) {
      const casualMp = Math.round(p.mmp * COMBAT_BALANCE_V32.casualMode.playerTurnExtraMpPct);
      const beforeCm = p.mp;
      p.mp = Math.min(p.mmp, p.mp + casualMp);
      const gainedCm = Math.max(0, p.mp - beforeCm);
      if (gainedCm > 0) {
        b.metrics.manaRecycled += gainedCm;
        spawnCombatFloat(b, 'player', `+${gainedCm} MP`, 'mp');
        pushLog(b, logTag('cbl-emerald', `✦【休闲模式】回合末轻松调息回复 +${gainedCm} MP。`));
      }
    }

    (b.allies || []).forEach(a => {
      if (!a || a.hp <= 0) return;
      a.shield = Math.max(0, Math.floor(Math.max(0, a.shield || 0) * 0.65));
      a.av = Math.round((a.baseAv || computeBaseAv(a.spd || 110)) * 0.25);
    });

    p.wandCooldown = 0;
    Object.keys(p.cooldowns).forEach(k => {
      if (p.cooldowns[k] > 0) p.cooldowns[k]--;
      if (p.cooldowns[k] <= 0) delete p.cooldowns[k];
    });

    b.turn += 1;
    b.naturalTurnCount = (b.naturalTurnCount || 1) + 1;
    b.oneMoreUsedThisTurn = false;
    b.oneMoreActive = false;
    p.av = 0;
    const bonusAp = p.status.nextAp || 0;
    delete p.status.nextAp;
    b.ap = Math.min(b.apMax, Math.max(0, b.apPerTurn + (bankedAp || 0) + bonusAp));
  }

  function checkImmediateVictoryOrNextWave(b, opts) {
    opts = opts || {};
    if (b.over) return true;

    // 1. 艾诺三击制
    if (b.stageCfg.hitRule) {
      if (b.playerHits >= (b.stageCfg.targetHits || 3)) {
        pushLog(b, logTag('cbl-star', `❄️ 冰晶穿破镜壁命中艾诺手背！艾诺微怔：「……这算命中。三击已满，你赢了。」`, true));
        emitCombatVoiceCue(b, 'boss_aino_surrender', { enemyId: 'aino', charId: 'aino' });
        finishBattle(b, true, 'three_hits');
        return true;
      }
      ensureValidTarget(b);
      return false;
    }

    // 2. 罗文乱葬岗活捉收束
    if (b.stageCfg.sealRule) {
      const rowan = b.enemies[0];
      if (b.player && b.player.hp > 0 && (b.sealProgress >= 100 || (rowan && rowan.hp <= 1 && b.sealProgress >= 60))) {
        b.sealProgress = 100;
        if (rowan && rowan.hp < 1) rowan.hp = 1;
        pushLog(b, logTag('cbl-star', `🪨❄️ 雷纳德五指收紧，四道石棱轰然闭合将罗文压进地面，你一发冰锥钉穿他袖口摁在土面上——成功活捉留活口审问！`, true));
        finishBattle(b, true, 'sealed_rowan');
        return true;
      }
      ensureValidTarget(b);
      return false;
    }

    // 3. 常规与双波次全灭检查
    const alive = b.enemies.some(e => e.hp > 0);
    if (!alive) {
      if (b.waveIdx + 1 < b.totalWaves) {
        if (opts.fromEndTurn) {
          applyTurnBoundaryCleanup(b, opts.bankedAp || 0);
        }
        initWave(b, b.waveIdx + 1);
        b.ap = Math.max(b.ap, b.apPerTurn);
        if (b.player.wandActive && b.witnessActive) {
          b.player.wandActive = false;
          b.player.wandPersistent = false;
          pushLog(b, logTag('cbl-star', `⚠️ 察觉林外冒险小队靠近，已迅速收起晦轮杖！`));
        }
        return true;
      } else {
        finishBattle(b, true, b.metrics.manaFizzleWin ? 'alice_mana_fizzle' : 'all_defeated');
        return true;
      }
    }
    ensureValidTarget(b);
    return false;
  }

  function tickEnemyEndTurn(b, e, opts) {
    opts = opts || {};
    if (!e || e.hp <= 0 || b.over) return false;
    const dmgScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyDmgMult : 1.0;
    const hpShdScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyHpShieldMult : 1.0;

    if (e.aiType === 'alice') {
      if (e.mp != null) e.mp = Math.min(e.mmp, e.mp + 7);
      if (e.status.evadeSealed > 0) {
        e.status.evadeSealed -= 1;
        if (e.status.evadeSealed <= 0) delete e.status.evadeSealed;
        e.evadeCharges = 0;
      } else {
        e.evadeCharges = b.frostFloorTurns > 0 ? 1 : (e.maxEvadeCharges || 2);
      }
    }
    if (e.aiType === 'wind_god_boss' && e.status.evadeSealed > 0) {
      e.status.evadeSealed -= 1;
      if (e.status.evadeSealed <= 0) delete e.status.evadeSealed;
    }
    if (e.aiType === 'noelle' && !e.seepSevered && !opts.staggered) {
      e.seepStacks = (e.seepStacks || 0) + 1;
    }
    // 霜渊裂地兽领主腹下晶核未破时，每回合末再生冻甲并余震药箱
    if (!opts.staggered && e.aiType === 'hulan_lord' && !e.coreShattered && e.hp > 0 && b.crateHp != null) {
      const shGain = Math.round(20 * hpShdScale);
      e.shield = Math.max(0, e.shield || 0) + shGain;
      let remQu = Math.round(8 * dmgScale);
      if (b.player && b.player.status && b.player.status.crateGuard > 0) {
        const bq = Math.min(b.player.status.crateGuard, remQu);
        b.player.status.crateGuard -= bq;
        remQu -= bq;
      }
      if (remQu > 0) {
        b.crateHp = Math.max(0, b.crateHp - remQu);
        pushLog(b, logTag('cbl-danger', `❄️ 领主晶核未破，再生 ${shGain} 冻甲且余震损耗药箱 ${remQu}（剩余 ${b.crateHp}/${b.crateMax}）！`));
        if (b.crateHp <= 0) {
          finishBattle(b, false, 'crate_destroyed');
          return true;
        }
      }
    }
    // 第 9 幕风神二阶段风域侵蚀
    if (e.aiType === 'wind_god_boss' && (e.phase || 1) >= 2 && e.hp > 0 && b.player && b.player.hp > 0) {
      const p = b.player;
      const erode = Math.round((p.status.fortress ? 14 : 22) * dmgScale);
      const eb = Math.min(Math.floor(Math.max(0, p.shield) * 0.5), erode);
      p.shield = Math.max(0, p.shield - eb);
      const erodeLoss = Math.max(0, erode - eb);
      p.hp = Math.max(0, p.hp - erodeLoss);
      if (erodeLoss > 0) {
        spawnCombatFloat(b, 'player', `-${erodeLoss} 风蚀`, 'enemy-dmg');
        pushLog(b, logTag('cbl-emerald', `🌪️ 风暴眼风域侵蚀穿盾造成 ${erodeLoss} 伤害！`));
      }
      if (p.hp <= 0) {
        finishBattle(b, false, 'wind_god_tempest');
        return true;
      }
    }
    if (e.broken) {
      e.broken = false;
      e.locks = e.maxLocks || 3;
      e.av = e.baseAv || 100;
    } else {
      e.av = Math.max(10, Math.round((e.baseAv || 100) * 0.55));
    }
    if (e.status.vuln > 0) {
      e.status.vuln -= 1;
      if (e.status.vuln <= 0) delete e.status.vuln;
    }
    if (e.status.chill > 0) {
      e.status.chill -= 1;
      if (e.status.chill <= 0) delete e.status.chill;
    }
    if (e.status.windSuppressed > 0) {
      delete e.status.windSuppressed;
    }
    return false;
  }

  function runAlliesPhase(b, bankedAp) {
    if (!b || b.over || !Array.isArray(b.allies) || !b.allies.length) {
      return { ended: false, acted: false };
    }
    let anyActed = false;
    for (const ally of b.allies) {
      if (!ally || ally.hp <= 0 || b.over) continue;
      const target = getPrimaryAliveEnemy(b);
      if (!target || target.hp <= 0) break;
      anyActed = true;
      const targetIdx = b.enemies.indexOf(target);
      const elems = Array.isArray(ally.elements) && ally.elements.length ? ally.elements : ['fire', 'earth', 'wind'];
      const elem = ally.nextElement || elems[(ally.elemCycleIdx || 0) % elems.length] || 'fire';
      const elemMeta = ALLY_ELEM_META[elem] || ALLY_ELEM_META.earth;

      let rMult = 1.95;
      let rSeal = 12;
      let pierceHalf = false;
      let triggeredFrost = false;
      let shGain = 0;

      if (elem === 'fire') {
        rMult = 2.15;
        rSeal = 12;
      } else if (elem === 'earth') {
        rMult = 1.95;
        rSeal = 12;
        const prevSh = ally.shield || 0;
        ally.shield = Math.min(ally.maxShield || 160, prevSh + 36);
        ally.shieldKind = 'solid';
        shGain = Math.max(0, ally.shield - prevSh);
        if (shGain > 0) {
          spawnCombatFloat(b, 'ally', `+${shGain} 岩盾`, 'shield');
          queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'guard', side: 'ally', actorKey: `ally:${ally.id}`, delayMs: 140 });
        }
      } else {
        rMult = 1.85;
        rSeal = 10;
        pierceHalf = true;
      }

      let synBonus = 1.0;
      if (target.broken) {
        synBonus += 0.35;
        rSeal += 6;
      } else if (target.status && target.status.stagger > 0) {
        synBonus += 0.22;
        rSeal += 4;
      }
      if (b.frostFloorTurns > 0 && elem === 'earth') {
        triggeredFrost = true;
        synBonus += 0.20;
        rSeal += 8;
        spawnBanner(b, '🪨❄️ 冰履滑步 · 雷纳德岩棱合围！', 'interrupt');
      }
      if (target.status && target.status.chill > 0) {
        synBonus += 0.10;
      }

      const defMit = COMBAT_BALANCE_V32.defK / (COMBAT_BALANCE_V32.defK + Math.max(0, (target.mdef || 0) * 0.85));
      const finalDmg = Math.max(12, Math.round((ally.matk || 82) * rMult * synBonus * defMit));
      const dmgRes = dealDamageToEnemy(b, target, finalDmg, {
        pierceHalfShield: pierceHalf,
        nonLethalCap: !!b.stageCfg.sealRule,
      });

      const recordedDmg = Math.max(finalDmg, (dmgRes.actualHpLoss || 0) + (dmgRes.shieldAbsorbed || 0));
      ally.totalDmgDealt = (ally.totalDmgDealt || 0) + recordedDmg;
      ally.actionsTaken = (ally.actionsTaken || 0) + 1;
      b.metrics.allyActions = (b.metrics.allyActions || 0) + 1;
      b.metrics.allyDmgDealt = (b.metrics.allyDmgDealt || 0) + recordedDmg;

      let didBreak = false;
      if (target.hp > 0 && !target.broken && (target.maxLocks || 0) > 0) {
        target.locks = Math.max(0, (target.locks != null ? target.locks : target.maxLocks) - 1);
        if (target.locks <= 0) {
          target.broken = true;
          didBreak = true;
          b.metrics.weaknessBreaks = (b.metrics.weaknessBreaks || 0) + 1;
          const burstDmg = Math.round((ally.matk || 82) * 0.65);
          const bRes = dealDamageToEnemy(b, target, burstDmg, { nonLethalCap: !!b.stageCfg.sealRule });
          const bRec = (bRes.actualHpLoss || 0) + (bRes.shieldAbsorbed || 0);
          ally.totalDmgDealt += bRec;
          b.metrics.allyDmgDealt += bRec;
          const pushKey = target.boss ? 'boss' : (target.mhp >= 220 ? 'elite' : 'mob');
          const pushPct = COMBAT_BALANCE_V32.HSR_AV.pushPct[pushKey] || 0.45;
          target.av = Math.round((target.av || target.baseAv || 100) + (target.baseAv || 100) * pushPct);
        }
      }

      if (b.stageCfg.sealRule) {
        b.sealProgress = Math.min(100, (b.sealProgress || 0) + rSeal);
      }

      if (elem === 'earth' && triggeredFrost) {
        pushLog(b, logTag('cbl-star', `🪨❄️ 配合冰履合围！${ally.name}催动「地陷岩棱」重创 ${target.name} ${finalDmg} 伤害——合围封锁度 +${rSeal}%（${b.sealProgress}%）！`, true));
      } else if (elem === 'earth') {
        pushLog(b, logTag('cbl-star', `🪨 前排 ${ally.name} 催动「地陷岩棱」重击 ${target.name} ${finalDmg} 伤害（合围封锁 ${b.sealProgress}%）！`));
      } else if (elem === 'fire') {
        pushLog(b, logTag('cbl-star', `🔥 前排 ${ally.name} 挥出「赤焰封线」封堵退路，造成 ${finalDmg} 伤害（合围封锁 ${b.sealProgress}%）！`));
      } else {
        pushLog(b, logTag('cbl-star', `🌪️ 前排 ${ally.name} 卷起「疾风截势」穿透半盾造成 ${finalDmg} 伤害（合围封锁 ${b.sealProgress}%）！`));
      }

      ally.elemCycleIdx = ((ally.elemCycleIdx || 0) + 1) % elems.length;
      ally.nextElement = elems[ally.elemCycleIdx];

      spawnCombatFloat(b, 'enemy', `-${finalDmg} ${elemMeta.skillName}`, triggeredFrost ? 'gold-crit' : 'crit', targetIdx);
      queueHitPulse(b, 'enemy', targetIdx);
      queueElementVFX(b, elem === 'earth' ? 'break' : 'crit', 'enemy', targetIdx, { skipHitStop: true });
      queuePixelAction(b, {
        type: 'ally_action',
        allyKey: `ally:${ally.id}`,
        element: elem,
        targetIdx,
        dmg: finalDmg,
        label: `${ally.name} · ${elemMeta.skillName}`,
      });
      if (didBreak && targetIdx >= 0) {
        queuePixelAction(b, {
          type: 'system_fx',
          fxId: 'fx_weakness_break',
          side: 'enemy',
          enemyIdx: targetIdx,
          actorKey: `enemy:${targetIdx}`,
          oneMore: false,
          delayMs: 180,
        });
      }
      if (!b.headless) safeSfx(triggeredFrost || didBreak ? 'break_chime' : 'ice_cast');

      if (checkImmediateVictoryOrNextWave(b, { fromEndTurn: true, bankedAp })) {
        return { ended: true, acted: anyActed };
      }
    }
    return { ended: false, acted: anyActed };
  }

  function resolveEnemyFollowupHit(b, e, intent, followupGrade, normGrade, opts) {
    opts = opts || {};
    const p = b.player;
    const dmgScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyDmgMult : 1.0;
    const pxApi = getPixelVfxApi();
    if (!(intent && intent.followupDmg > 0 && p.hp > 0)) {
      return { fLoss: 0, fGrade: 'NONE', fBlk: 0, shieldAbsorbed: 0, shieldShattered: false };
    }
    let fInc = intent.followupDmg * dmgScale;
    if (e.status.chill > 0) fInc *= 0.86;
    if (p.status.fortress > 0) fInc *= 0.88;
    if (p.status.lungeMitigate > 0 && intent.stance === 'CLOSE_LUNGE') fInc *= 0.45;
    fInc *= (COMBAT_BALANCE_V32.defK / (COMBAT_BALANCE_V32.defK + Math.max(0, p.mdef || 0)));
    const fGrade = normalizeRingGrade(followupGrade || normGrade || 'GOOD');
    const fBlk = computeBlockRate(p.rank || 2, e.rank || 7, fGrade);
    fInc = Math.max(0, Math.round(fInc * (1 - fBlk)));
    const shBefore = Math.max(0, p.shield || 0);
    const fsBlk = Math.min(Math.floor(shBefore * 0.5), fInc);
    p.shield = Math.max(0, shBefore - fsBlk);
    const fLoss = Math.max(0, fInc - fsBlk);
    const fShattered = shBefore > 0 && p.shield <= 0;
    p.hp = Math.max(0, p.hp - fLoss);
    if (!opts.skipImmediateBlockVfx && b._directPlayEnemyVfx && pxApi && typeof pxApi.playBlock === 'function') {
      pxApi.playBlock(fGrade, 'player');
    }
    if (fLoss > 0) {
      spawnCombatFloat(b, 'player', `-${fLoss} 余岚`, 'enemy-dmg');
      if (!b.headless) safeSfx('bad');
      pushLog(b, logTag('cbl-danger', `🌪️ ${e.name} 追加风刃造成 ${fLoss} 伤害 [${fGrade}]！`));
    }
    return {
      fLoss,
      fGrade,
      fBlk,
      blocked: fLoss === 0,
      shieldAbsorbed: fsBlk,
      shieldShattered: fShattered,
    };
  }

  function resolveEnemyPostHitEffects(b, e, intent, hpLoss, banked, deferredActions) {
    const p = b.player;
    const defer = Array.isArray(deferredActions);
    const runOrDefer = fn => { if (defer) deferredActions.push(fn); else fn(); };

    if (intent.inflictBlind) {
      p.status.blind = (p.status.blind || 0) + intent.inflictBlind;
      runOrDefer(() => {
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'debuff', side: 'player', actorKey: 'player', delayMs: 220 });
        pushLog(b, logTag('cbl-star', `🌫️ 扬尘遮蔽视线（可用水系术式洗净，或以霜域全体覆盖）！`));
      });
    }
    if (intent.addBurn && hpLoss > 0) {
      p.status.burn = (p.status.burn || 0) + intent.addBurn;
      runOrDefer(() => {
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'burn', side: 'player', actorKey: 'player', delayMs: 220 });
      });
    }

    if (p.hp > 0 && b._hadNobleReflectThisTurn && e.hp > 0) {
      const refDmg = Math.round(p.mdef * 1.4 + 28);
      dealDamageToEnemy(b, e, refDmg, {});
      runOrDefer(() => {
        pushLog(b, logTag('cbl-star', `👑【贵族体面·回敬】礼仪冰霜震退 ${e.name}，反伤 ${refDmg}！`));
      });
      if (defer) {
        deferredActions.push(() => { checkImmediateVictoryOrNextWave(b, { fromEndTurn: true, bankedAp: banked }); });
      } else if (checkImmediateVictoryOrNextWave(b, { fromEndTurn: true, bankedAp: banked })) {
        return { battleEnded: true };
      }
    }

    if (p.hp > 0 && p.hp < p.mhp * 0.35 && !b._blueVialTriggered && hasRelic(p, 'blue_vial')) {
      b._blueVialTriggered = true;
      const vialHeal = Math.max(15, Math.round(p.mhp * 0.25));
      const beforeVialHp = p.hp;
      p.hp = Math.min(p.mhp, p.hp + vialHeal);
      p.status.afterimage = (p.status.afterimage || 0) + 1;
      const healed = p.hp > beforeVialHp;
      runOrDefer(() => {
        if (healed) {
          queuePixelAction(b, { type: 'system_fx', fxId: 'fx_heal_emerald', side: 'player', actorKey: 'player', delayMs: 260 });
        }
        if (!b.headless) safeSfx('buff');
        pushLog(b, logTag('cbl-ice', `🧪【淡蓝小瓶】濒危安神凉雾散开，回复 ${vialHeal} 生命并幻化 1 层「风行残像」！`, true));
      });
    }

    if (p.hp <= 0) {
      if (defer) {
        deferredActions.push(() => { if (!b.over) finishBattle(b, false, 'hp_zero'); });
        return { battleEnded: false, pendingDefeat: true };
      }
      finishBattle(b, false, 'hp_zero');
      return { battleEnded: true };
    }
    return { battleEnded: false };
  }

  function resolveEnemyHitOnPlayer(b, e, intent, blockGrade, followupGrade, banked, opts) {
    if (followupGrade && typeof followupGrade === 'object') {
      opts = followupGrade;
      followupGrade = opts.followupGrade != null ? opts.followupGrade : blockGrade;
      banked = opts.banked != null ? opts.banked : 0;
    }
    opts = opts || {};
    const skipPlayAction = !!opts.skipPlayAction;
    const skipImmediateBlockVfx = !!opts.skipImmediateBlockVfx;
    const deferImpactFeedback = !!opts.deferImpactFeedback;
    const skipFollowup = !!opts.skipFollowup;
    const deferredActions = deferImpactFeedback ? [] : null;
    const runOrDefer = fn => { if (deferredActions) deferredActions.push(fn); else fn(); };
    let feedbackFlushed = false;
    const flushImpactFeedback = () => {
      if (feedbackFlushed || !deferredActions) return;
      feedbackFlushed = true;
      for (let i = 0; i < deferredActions.length; i++) {
        try { deferredActions[i](); } catch (err) {}
      }
    };

    const p = b.player;
    const dmgScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyDmgMult : 1.0;
    const eIdx = b.enemies.indexOf(e);
    const frontAlly = (b.allies || []).find(a => a && a.hp > 0 && a.tauntFront);
    const noBlock = !!e.noBlockPrompt;
    const normGrade = noBlock ? 'NONE' : normalizeRingGrade(blockGrade || 'GOOD');
    if (normGrade === 'PERFECT') {
      b.metrics.perfectBlocks = (b.metrics.perfectBlocks || 0) + 1;
    }
    const blockRate = noBlock ? 0 : computeBlockRate(p.rank || 2, e.rank || 2, normGrade);

    let afterimageShearMult = 1.0;
    if (p.status.afterimage > 0) {
      p.status.afterimage = Math.max(0, p.status.afterimage - 1);
      if (intent.pierceAfterimage) {
        afterimageShearMult = 0.60;
        runOrDefer(() => {
          pushLog(b, logTag('cbl-emerald', `🌪️ ${e.name} 御风震散「风行残像」，仍削去四成余岚冲击！`));
        });
      } else {
        let cakeGain = 0;
        if (hasRelic(p, 'alice_flower_cake')) {
          const beforeMp = p.mp;
          p.mp = Math.min(p.mmp, p.mp + 10);
          cakeGain = Math.max(0, p.mp - beforeMp);
        }
        runOrDefer(() => {
          pushLog(b, logTag('cbl-emerald', `💨 「风行残像」碎裂，你真身避开了 ${e.name} 的「${intent.moveName}」！`));
          emitCombatVoiceCue(b, 'dodge', { enemyId: e.id, charId: 'sylvia' });
          if (cakeGain > 0) pushLog(b, logTag('cbl-emerald', `🌼【风之花饼】借风轻落回蓄 ${cakeGain} MP！`));
        });
        if (!skipPlayAction) {
          queuePixelAction(b, { type: 'enemy_attack', enemyIdx: eIdx, enemy: e, intent, hpLoss: 0, evaded: true, blockGrade: 'NONE', shieldAbsorbed: 0, shieldShattered: false, bypassMagicPlayerShield: false, targetActorKey: 'player' });
        }
        return {
          battleEnded: false,
          evaded: true,
          hpLoss: 0,
          blocked: false,
          blockGrade: 'NONE',
          blockRate: 0,
          shieldAbsorbed: 0,
          shieldShattered: false,
          bypassMagicPlayerShield: false,
          guardedByAlly: null,
          flushImpactFeedback,
        };
      }
    }

    let playerShieldAbsorbed = 0;
    let playerShieldShattered = false;
    if (intent.shatterPlayerShield && p.shield > 0) {
      const shShatteredAmt = p.shield;
      runOrDefer(() => {
        pushLog(b, logTag('cbl-danger', `💥 ${e.name} 的「${intent.moveName}」正面轰碎了你全部 ${shShatteredAmt} 点护盾！`));
      });
      playerShieldAbsorbed += p.shield;
      playerShieldShattered = true;
      p.shield = 0;
    }

    let incoming = intent.dmg * dmgScale * afterimageShearMult;
    if (e.broken) incoming *= COMBAT_BALANCE_V32.HSR_AV.breakRecoveryAtkMult;
    if (e.status.chill > 0) incoming *= 0.86;
    if (b.frostFloorTurns > 0 && intent.stance === 'HEAVY_WINDUP') incoming *= 0.85;
    if (intent.elem === 'fire' && p.passives.includes('temp_sense')) incoming *= 0.80;
    if (intent.slipStrike && !p.status.rooted) incoming *= 1.30;
    if (p.status.lungeMitigate > 0 && intent.stance === 'CLOSE_LUNGE') incoming *= 0.40;
    if (p.status.fortress > 0) incoming *= 0.88;

    const isRowanEclipseTrue = !!intent.eclipseTrueMagic;
    const playerShieldKind = p.shieldKind || 'solid';
    const bypassMagicPlayerShield = !!(isRowanEclipseTrue && p.shield > 0 && playerShieldKind === 'magic');
    let allyGuarded = false;

    if (frontAlly && b.stageCfg.sealRule && intent.renoRockBlock) {
      allyGuarded = true;
      queuePixelAction(b, {
        type: 'ally_guard',
        allyKey: `ally:${frontAlly.id}`,
        targetActorKey: 'player',
        label: `${frontAlly.name} · 掀石协防`,
      });
    }

    if (isRowanEclipseTrue) {
      if (p.shield > 0 && playerShieldKind === 'solid') {
        incoming *= (intent.renoRockBlock ? 0.25 : 0.50);
        runOrDefer(() => {
          pushLog(b, logTag('cbl-star', `🪨 实体冰盾与雷纳德岩板合力阻尼晦轮黑芒！`));
        });
      } else if (intent.renoRockBlock) {
        incoming *= 0.65;
      }
    } else {
      const pDef = Math.max(0, intent.elem === 'phys' ? p.def : p.mdef);
      incoming *= (COMBAT_BALANCE_V32.defK / (COMBAT_BALANCE_V32.defK + pDef));
    }

    // 线性等阶差格挡减伤
    incoming = Math.max(0, Math.round(incoming * (1 - blockRate)));

    let hpLoss = incoming;
    const playerShieldBefore = Math.max(0, p.shield || 0);
    p.shield = playerShieldBefore;
    if (intent.bypassAllShield || bypassMagicPlayerShield) {
      // 穿透魔法盾
    } else if (intent.bypassHalfShield) {
      const blk = Math.min(Math.floor(p.shield * 0.5), hpLoss);
      p.shield = Math.max(0, p.shield - blk);
      hpLoss = Math.max(0, hpLoss - blk);
      playerShieldAbsorbed += blk;
    } else {
      const blk = Math.min(p.shield, hpLoss);
      p.shield = Math.max(0, p.shield - blk);
      hpLoss = Math.max(0, hpLoss - blk);
      playerShieldAbsorbed += blk;
    }
    if (playerShieldBefore > 0 && p.shield <= 0) {
      playerShieldShattered = true;
    }

    // 镜霜壁 / 钢冰护幕反刺（对艾诺开启正面破镜窗口！）
    if (p.status.iceThorns > 0 && (intent.stance === 'HEAVY_WINDUP' || intent.stance === 'CLOSE_LUNGE')) {
      if (e.aiType === 'aino') {
        p.status.mirrorRiposteWindow = 1;
        runOrDefer(() => {
          pushLog(b, logTag('cbl-star', `❄️【镜霜反刺】反震冰芒逼开艾诺正面镜壁，下一次冰晶主炮可直击得分！`, true));
        });
      }
      if (e.hp > 1) {
        const chip = Math.min(e.hp - 1, p.status.iceThorns);
        if (chip > 0) {
          e.hp -= chip;
          runOrDefer(() => {
            pushLog(b, logTag('cbl-ice', `❄️ 霜壁表面反刺震伤 ${e.name} ${chip} 点。`));
          });
        }
      }
    }

    p.hp = Math.max(0, p.hp - hpLoss);

    const enemyActionPayload = {
      type: 'enemy_attack',
      enemyIdx: eIdx,
      enemy: e,
      intent,
      hpLoss,
      blocked: hpLoss === 0,
      blockGrade: normGrade,
      blockRate,
      shieldAbsorbed: playerShieldAbsorbed,
      shieldShattered: playerShieldShattered,
      bypassMagicPlayerShield,
      targetActorKey: 'player',
      guardedByAlly: allyGuarded ? `ally:${frontAlly.id}` : null,
    };

    const pxApi = getPixelVfxApi();
    if (!skipPlayAction) {
      if (b._directPlayEnemyVfx && pxApi) {
        if (typeof pxApi.playEnemyAction === 'function') {
          pxApi.playEnemyAction(b, enemyActionPayload);
        } else if (!skipImmediateBlockVfx && !noBlock && typeof pxApi.playBlock === 'function') {
          pxApi.playBlock(normGrade, 'player');
        }
      } else {
        queuePixelAction(b, enemyActionPayload);
      }
    }

    const baseHitSummary = {
      battleEnded: false,
      evaded: false,
      hpLoss,
      followupHpLoss: 0,
      blocked: hpLoss === 0,
      blockGrade: normGrade,
      blockRate,
      shieldAbsorbed: playerShieldAbsorbed,
      shieldShattered: playerShieldShattered,
      bypassMagicPlayerShield,
      guardedByAlly: allyGuarded ? `ally:${frontAlly.id}` : null,
      flushImpactFeedback,
    };

    const blockTag = (!noBlock && blockRate > 0) ? ` [${normGrade} 格挡-${Math.round(blockRate * 100)}%]` : '';
    if (hpLoss > 0) {
      const eHitVfx = intent.elem === 'water' ? 'water' : intent.elem === 'ice' ? 'ice' : 'sword';
      runOrDefer(() => {
        if (!pxApi) triggerShake(b, hpLoss >= 45);
        spawnCombatFloat(b, 'player', `-${hpLoss}`, 'enemy-dmg');
        queueHitPulse(b, 'player', 0);
        queueElementVFX(b, eHitVfx, 'player', 0, { skipHitStop: true });
        if (!b.headless) safeSfx('bad');
        emitCombatVoiceCue(b, hpLoss >= 45 ? 'player_hit_heavy' : 'player_hit', { hpLoss, enemyId: e.id, charId: 'sylvia' });
        pushLog(b, logTag('cbl-danger', `❗ ${e.name} 施展「${intent.moveName}」，造成 ${hpLoss} 伤害${hpLoss < incoming ? `（护盾抵消 ${incoming - hpLoss}）` : ''}${blockTag}！`));
      });
      if (intent.scoresHit && b.stageCfg.hitRule && normGrade !== 'PERFECT') {
        const hitGain = (intent.slipStrike && !p.status.rooted) ? 2 : 1;
        b.enemyHits = Math.min(b.stageCfg.targetHits || 3, b.enemyHits + hitGain);
        const curPlayerHits = b.playerHits;
        const curEnemyHits = b.enemyHits;
        runOrDefer(() => {
          pushLog(b, logTag('cbl-danger', `⚠️ ${hitGain > 1 ? '脚底打滑连中两刺！' : '被艾诺有效命中！'}比分：${curPlayerHits} : ${curEnemyHits}！`, true));
        });
        if (b.enemyHits >= (b.stageCfg.targetHits || 3)) {
          if (deferredActions) {
            deferredActions.push(() => { if (!b.over) finishBattle(b, false, 'enemy_three_hits'); });
          } else {
            finishBattle(b, false, 'enemy_three_hits');
            return Object.assign(baseHitSummary, { battleEnded: true });
          }
        }
      }
    } else {
      runOrDefer(() => {
        if (!b.headless) safeSfx('shield_block');
        emitCombatVoiceCue(b, 'shield_block', { enemyId: e.id, charId: 'sylvia' });
        pushLog(b, logTag('cbl-ice', `🛡️ 护盾稳稳挡下了 ${e.name} 的「${intent.moveName}」${blockTag}！`));
      });
    }

    if (skipFollowup) {
      if (p.hp <= 0) {
        finishBattle(b, false, 'hp_zero');
        return Object.assign(baseHitSummary, { battleEnded: true });
      }
      return baseHitSummary;
    }

    // 风神追加连击（followupDmg）
    if (intent.followupDmg > 0 && p.hp > 0) {
      const fOut = resolveEnemyFollowupHit(b, e, intent, followupGrade, normGrade, {
        skipImmediateBlockVfx,
      });
      baseHitSummary.followupHpLoss = fOut.fLoss || 0;
    }

    const postRes = resolveEnemyPostHitEffects(b, e, intent, hpLoss, banked, deferredActions);
    if (postRes.battleEnded) {
      return Object.assign(baseHitSummary, { battleEnded: true });
    }
    return baseHitSummary;
  }

  function resolveEnemyPreStrike(b, e, banked) {
    const p = b.player;
    const dmgScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyDmgMult : 1.0;
    const hpShdScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyHpShieldMult : 1.0;

    if (e.status.stagger > 0) {
      const wasAwaken = !!e._phase2Awakening;
      e._phase2Awakening = false;
      pushLog(b, logTag('cbl-ice', wasAwaken ? `✦ ${e.name} 完成二阶段觉醒蓄能，下回合正式释放高压攻势！` : `💫 ${e.name} 架势崩解，错失本回合攻势！`));
      delete e.status.stagger;
      if (e.aiType === 'hulan_lord' && !e.coreShattered && e.hp > 0 && b.crateHp != null) {
        const shAdd = Math.round(16 * hpShdScale);
        e.shield = Math.max(0, e.shield || 0) + shAdd;
        let cq = Math.round(6 * dmgScale);
        if (p.status.crateGuard > 0) {
          const bq = Math.min(p.status.crateGuard, cq);
          p.status.crateGuard -= bq;
          cq -= bq;
        }
        if (cq > 0) {
          b.crateHp = Math.max(0, b.crateHp - cq);
          pushLog(b, logTag('cbl-danger', `❄️ 领主晶核未破，再生 ${shAdd} 冻甲且寒气余震损耗药箱 ${cq}（剩余 ${b.crateHp}/${b.crateMax}）！`));
          if (b.crateHp <= 0) {
            finishBattle(b, false, 'crate_destroyed');
            return { skipAttack: true, battleEnded: true };
          }
        }
      }
      if (tickEnemyEndTurn(b, e, { staggered: true })) return { skipAttack: true, battleEnded: true };
      return { skipAttack: true, battleEnded: false };
    }

    const intent = e.intent;
    if (!intent) {
      if (tickEnemyEndTurn(b, e)) return { skipAttack: true, battleEnded: true };
      return { skipAttack: true, battleEnded: false };
    }

    b.metrics.enemyActions = (b.metrics.enemyActions || 0) + 1;

    // 爱丽丝魔力不足自断风暴认输
    if (intent.selfFizzleIfLowMp && e.mp != null && e.mp < intent.mpCost) {
      b.metrics.manaFizzleWin = true;
      pushLog(b, logTag('cbl-ice', `💨 狂躁的气流骤然散去！爱丽丝晃了一下：「……没魔力了。……认输。」`, true));
      emitCombatVoiceCue(b, 'boss_alice_surrender', { enemyId: e.id, charId: 'alice' });
      const aliceIdx = b.enemies.indexOf(e);
      e.hp = 0;
      if (aliceIdx >= 0) {
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_enemy_defeat', side: 'enemy', enemyIdx: aliceIdx, actorKey: `enemy:${aliceIdx}` });
      }
      if (checkImmediateVictoryOrNextWave(b, { fromEndTurn: true, bankedAp: banked })) {
        return { skipAttack: true, battleEnded: true };
      }
      return { skipAttack: true, battleEnded: false };
    }

    if (intent.mpCost && e.mp != null) e.mp = Math.max(0, e.mp - intent.mpCost);

    const enemyCurIdx = b.enemies.indexOf(e);
    let enemyGuardGained = false;
    let enemyBuffGained = false;
    if (intent.refreshCurtain && !e.seepSevered) {
      e.shield = Math.max(e.shield || 0, Math.round(intent.refreshCurtain * hpShdScale));
      e.shieldKind = 'magic';
      enemyGuardGained = true;
    }
    if (intent.gainShield) {
      e.shield = Math.max(0, e.shield || 0) + Math.round(intent.gainShield * hpShdScale);
      enemyGuardGained = true;
    }
    if (intent.gainFire) {
      e.fireStacks = (e.fireStacks || 0) + intent.gainFire;
      enemyBuffGained = true;
    }
    if (intent.buffPack) {
      b.enemies.forEach(allyE => { if (allyE.hp > 0) allyE.atk += intent.buffPack; });
      enemyBuffGained = true;
    }
    if (enemyCurIdx >= 0) {
      if (enemyGuardGained) {
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'guard', side: 'enemy', enemyIdx: enemyCurIdx, actorKey: `enemy:${enemyCurIdx}`, delayMs: 140 });
      } else if (enemyBuffGained) {
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'buff', side: 'enemy', enemyIdx: enemyCurIdx, actorKey: `enemy:${enemyCurIdx}`, delayMs: 140 });
      }
    }

    // 医疗药箱受击结算（含休闲减伤与钢霜壁垒 -12%）
    if (intent.crateDmg && b.crateHp != null) {
      let cDmg = Math.round(intent.crateDmg * dmgScale);
      if (p.status.fortress > 0) cDmg = Math.round(cDmg * 0.88);
      if (hasRelic(p, 'northwind_pass')) cDmg = Math.max(0, cDmg - 4);
      if (p.status.crateGuard > 0) {
        const blk = Math.min(p.status.crateGuard, cDmg);
        p.status.crateGuard = Math.max(0, p.status.crateGuard - blk);
        cDmg = Math.max(0, cDmg - blk);
      }
      if (cDmg > 0) {
        b.crateHp = Math.max(0, b.crateHp - cDmg);
        pushLog(b, logTag('cbl-danger', `📦 ${e.name} 重撞补给防线，医疗药箱耐久 -${cDmg}（剩余 ${b.crateHp}/${b.crateMax}）！`));
        if (b.crateHp <= 0) {
          pushLog(b, logTag('cbl-danger', `❌ 医疗药箱被毁，冰封峡谷前线补给崩溃！`, true));
          finishBattle(b, false, 'crate_destroyed');
          return { skipAttack: true, battleEnded: true };
        }
      } else {
        pushLog(b, logTag('cbl-emerald', `📦 冰障稳稳护住了医疗药箱！`));
      }
    }

    // 前排友军承伤（第 2 幕罗文战雷纳德）
    const frontAlly = (b.allies || []).find(a => a && a.hp > 0 && a.tauntFront);
    if (frontAlly && intent.allyDmg > 0) {
      let aInc = intent.allyDmg * dmgScale;
      if (e.broken) aInc *= COMBAT_BALANCE_V32.HSR_AV.breakRecoveryAtkMult;
      if (e.status.chill > 0) aInc *= 0.86;
      const aDef = Math.max(0, frontAlly.mdef || 38);
      aInc = Math.max(4, Math.round(aInc * (COMBAT_BALANCE_V32.defK / (COMBAT_BALANCE_V32.defK + aDef)) * 0.72));
      const aBlk = Math.min(Math.max(0, frontAlly.shield || 0), aInc);
      frontAlly.shield = Math.max(0, (frontAlly.shield || 0) - aBlk);
      const aLoss = Math.max(0, aInc - aBlk);
      frontAlly.hp = Math.max(0, frontAlly.hp - aLoss);
      if (aLoss > 0) {
        spawnCombatFloat(b, 'ally', `-${aLoss}`, 'enemy-dmg');
        queueHitPulse(b, 'ally', 0);
        pushLog(b, logTag('cbl-ice', `🪨 前排 ${frontAlly.name} 正面硬接罗文攻势，承伤 ${aLoss}（余 ${frontAlly.hp}/${frontAlly.mhp}）！`));
      } else {
        spawnCombatFloat(b, 'ally', `岩盾格挡 ${aBlk}`, 'shield');
      }
      if (frontAlly.hp <= 0) {
        finishBattle(b, false, 'ally_renard_down');
        return { skipAttack: true, battleEnded: true };
      }
    }

    if (!(intent.dmg > 0)) {
      if (tickEnemyEndTurn(b, e)) return { skipAttack: true, battleEnded: true };
      return { skipAttack: true, battleEnded: false };
    }

    return { skipAttack: false, battleEnded: false, intent };
  }

  function finishEndTurnPhase(b, banked) {
    const p = b.player;
    const dmgScale = b.casualMode ? COMBAT_BALANCE_V32.casualMode.enemyDmgMult : 1.0;

    if (p.status.burn > 0) {
      const burnDmg = Math.max(1, Math.round(8 * dmgScale));
      p.hp = Math.max(0, p.hp - burnDmg);
      p.status.burn -= 1;
      if (p.status.burn <= 0) delete p.status.burn;
      queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'burn', side: 'player', actorKey: 'player', delayMs: 240 });
      pushLog(b, logTag('cbl-danger', `🔥 烈焰灼烧损耗 ${burnDmg} 生命。`));
      if (p.hp > 0 && p.hp < p.mhp * 0.35 && !b._blueVialTriggered && hasRelic(p, 'blue_vial')) {
        b._blueVialTriggered = true;
        const vialHeal = Math.max(15, Math.round(p.mhp * 0.25));
        p.hp = Math.min(p.mhp, p.hp + vialHeal);
        p.status.afterimage = (p.status.afterimage || 0) + 1;
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_heal_emerald', side: 'player', actorKey: 'player', delayMs: 280 });
        pushLog(b, logTag('cbl-ice', `🧪【淡蓝小瓶】濒危安神凉雾散开，回复 ${vialHeal} 生命并幻化 1 层「风行残像」！`, true));
      }
      if (p.hp <= 0) {
        finishBattle(b, false, 'burn_death');
        return true;
      }
    }

    if (hasRelic(p, 'cross') && p.hp > 0 && p.hp < p.mhp) {
      const crossHeal = Math.max(2, Math.round(p.mhp * 0.06));
      const beforeHp = p.hp;
      p.hp = Math.min(p.mhp, p.hp + crossHeal);
      if (p.hp > beforeHp) {
        queuePixelAction(b, { type: 'system_fx', fxId: 'fx_heal_emerald', side: 'player', actorKey: 'player', delayMs: 280 });
        pushLog(b, logTag('cbl-ice', `✝️【银十字架】微光抚平伤势，回复 ${p.hp - beforeHp} 生命。`));
      }
    }

    if (b.stageCfg.turnLimit && b.turn >= b.stageCfg.turnLimit) {
      pushLog(b, logTag('cbl-danger', `⏱️ ${b.stageCfg.turnLimit} 回合时限已到，未能拿满三次有效命中，切磋告负！`, true));
      finishBattle(b, false, 'turn_limit');
      return true;
    }

    applyTurnBoundaryCleanup(b, banked);
    b.waveTurn = (b.waveTurn || 1) + 1;

    let newTurnShieldGained = false;
    if (hasRelic(p, 'northwind_pass')) {
      const beforeS = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + 12);
      if (beforeS <= 0) p.shieldKind = 'solid';
      if (p.shield > beforeS) {
        newTurnShieldGained = true;
        pushLog(b, logTag('cbl-ice', `🪪【北风堡木牌】新回合寒铁护盾 +${p.shield - beforeS}（当前 ${p.shield}/${p.maxShield}）。`));
      }
    }
    if (getSynergyTier(p, 'north_frost') >= 2) {
      const beforeNF = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + 10);
      if (beforeNF <= 0) p.shieldKind = 'solid';
      if (p.shield > beforeNF) {
        newTurnShieldGained = true;
        pushLog(b, logTag('cbl-ice', `✦【共鸣·北境霜锋(2件)】新回合霜锋寒甲 +${p.shield - beforeNF} 护盾（当前 ${p.shield}/${p.maxShield}）。`));
      }
    }
    if (newTurnShieldGained) {
      queuePixelAction(b, { type: 'system_fx', fxId: 'fx_status_micro', variant: 'guard', side: 'player', actorKey: 'player', delayMs: 300 });
    }

    b.enemies.forEach(e => {
      if (e.aiType === 'noelle' && e.seepTriggeredOnce && !e.seepSevered) {
        b.metrics.enteredUnderSeep = true;
      }
      if (e.hp > 0 && (e.phase || 1) >= 2) {
        e.phase2Step = ((e.phase2Step || 0) + 1) % 2;
      }
      decideEnemyIntent(e, b);
    });
    ensureValidTarget(b);
    syncDerivedBattleState(b);
    if (!b.headless) renderCombatUI();
    return true;
  }

  function endTurn(b) {
    b = b || activeBattle;
    if (_actionInProgress || !b || b.over) return false;
    if (!b.headless) safeSfx('ui_tick', { gain: 0.72 });

    // 实时浏览器异步敌方回合轨（杂兵 noBlockPrompt 600ms 极速衔接 / 精英与首领弹空格格挡）
    if (shouldRunAsyncTiming(b)) {
      _actionInProgress = true;
      b._timingBusy = true;
      b._asyncPhaseActive = true;
      b.isEnemyTurn = true;
      const instId = b.battleInstanceId;
      emitCombatStateChange(b);

      return (async () => {
        try {
          const p = b.player;
          armedSkillId = null;
          if (b === activeBattle) hoveredSkillId = null;
          delete p.status.breakChain;
          b._hadNobleReflectThisTurn = !!(p.status && p.status.nobleReflect > 0);
          b.aiMemory.lastTurnDmgDealt = b.aiMemory.currentTurnDmgDealt;
          b.aiMemory.turtleStreak = b.aiMemory.currentTurnDmgDealt <= 5 ? ((b.aiMemory.turtleStreak || 0) + 1) : 0;
          b.aiMemory.currentTurnDmgDealt = 0;
          const banked = Math.min(1, Math.max(0, b.ap));

          const allyRes = runAlliesPhase(b, banked);
          if (allyRes.ended) {
            renderCombatUI();
            return true;
          }
          if (allyRes.acted) {
            renderCombatUI();
            await sleepTracked(420);
            if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) return false;
          }

          b._directPlayEnemyVfx = true;
          try {
            for (const e of b.enemies) {
              if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) return false;
              if (!e || e.hp <= 0) continue;

              const pre = resolveEnemyPreStrike(b, e, banked);
              if (pre.battleEnded || b.over) {
                renderCombatUI();
                return true;
              }
              if (pre.skipAttack) {
                renderCombatUI();
                await sleepTracked(320);
                continue;
              }

              const intent = pre.intent;
              const eIdx = b.enemies.indexOf(e);
              const pxApi = getPixelVfxApi();
              const ctr = global.CombatTimingRing;
              const willFullEvade = !!(p.status.afterimage > 0 && !intent.pierceAfterimage);
              let blockGrade = 'GOOD';
              let followupGrade = 'GOOD';

              if (e.noBlockPrompt) {
                // 群怪杂兵：不弹 Space，将伤害飘字与受击反馈精准挂入 onImpact（500ms 安全兜底），消除提前掉血
                blockGrade = 'NONE';
                if (pxApi && typeof pxApi.playEnemyAction === 'function') {
                  const hitOut = resolveEnemyHitOnPlayer(b, e, intent, 'NONE', 'NONE', banked, {
                    skipPlayAction: true,
                    skipImmediateBlockVfx: true,
                    deferImpactFeedback: true,
                  });
                  await new Promise(resolveImpact => {
                    let impactDone = false;
                    const cancelEntry = { tid: null, resolve: null };
                    const finishImpact = () => {
                      if (impactDone) return;
                      impactDone = true;
                      if (cancelEntry.tid != null) {
                        clearTimeout(cancelEntry.tid);
                        cancelEntry.tid = null;
                      }
                      _pendingAsyncDelays.delete(cancelEntry);
                      if (activeBattle === b && b.battleInstanceId === instId && !b.over) {
                        if (hitOut && typeof hitOut.flushImpactFeedback === 'function') {
                          hitOut.flushImpactFeedback();
                        }
                        if (!b.over) renderCombatUI();
                      }
                      resolveImpact();
                    };
                    cancelEntry.resolve = () => {
                      if (!impactDone) {
                        impactDone = true;
                        resolveImpact();
                      }
                    };
                    cancelEntry.tid = setTimeout(finishImpact, 500);
                    if (cancelEntry.tid && typeof cancelEntry.tid.unref === 'function') cancelEntry.tid.unref();
                    _pendingAsyncDelays.add(cancelEntry);
                    try {
                      pxApi.playEnemyAction(b, {
                        type: 'enemy_attack',
                        enemyIdx: eIdx,
                        enemy: e,
                        intent,
                        hpLoss: hitOut.hpLoss || 0,
                        blocked: !!hitOut.blocked,
                        evaded: !!hitOut.evaded,
                        blockGrade: 'NONE',
                        blockRate: 0,
                        noBlockPrompt: true,
                        shieldAbsorbed: hitOut.shieldAbsorbed || 0,
                        shieldShattered: !!hitOut.shieldShattered,
                        bypassMagicPlayerShield: !!hitOut.bypassMagicPlayerShield,
                        targetActorKey: 'player',
                        guardedByAlly: hitOut.guardedByAlly || null,
                        gated: false,
                        onImpact: finishImpact,
                      });
                    } catch (err) {
                      finishImpact();
                    }
                  });
                  if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId) return false;
                  if (b.over) return true;
                  if (tickEnemyEndTurn(b, e, { evaded: !!hitOut.evaded })) { renderCombatUI(); return true; }
                  await sleepTracked(300);
                } else {
                  const hitOut = resolveEnemyHitOnPlayer(b, e, intent, 'NONE', 'NONE', banked);
                  renderCombatUI();
                  if (hitOut.battleEnded || b.over) return true;
                  if (tickEnemyEndTurn(b, e, { evaded: !!hitOut.evaded })) { renderCombatUI(); return true; }
                  await sleepTracked(600);
                }
              } else if (willFullEvade) {
                const hitOut = resolveEnemyHitOnPlayer(b, e, intent, 'NONE', 'NONE', banked, {
                  skipPlayAction: !!(pxApi && typeof pxApi.playEnemyAction === 'function'),
                  skipImmediateBlockVfx: true,
                });
                if (pxApi && typeof pxApi.playEnemyAction === 'function') {
                  try {
                    pxApi.playEnemyAction(b, {
                      type: 'enemy_attack',
                      enemyIdx: eIdx,
                      enemy: e,
                      intent,
                      hpLoss: 0,
                      evaded: true,
                      blockGrade: 'NONE',
                      shieldAbsorbed: 0,
                      shieldShattered: false,
                      bypassMagicPlayerShield: false,
                      targetActorKey: 'player',
                      gated: false,
                    });
                  } catch (err) {}
                }
                renderCombatUI();
                if (hitOut.battleEnded || b.over) return true;
                if (tickEnemyEndTurn(b, e, { evaded: true })) { renderCombatUI(); return true; }
                await sleepTracked(460);
              } else {
                // 需格挡敌人：正序翻转（敌先起手/冲刺/发射弹道 -> 临面门控缩圈 Space -> 按键当帧单次格挡 VFX + 伤害飘字）
                const hasFollowup = !!(intent.followupDmg > 0);
                const gateCount = hasFollowup ? 2 : 1;
                const canUseGatedBlock = !!(ctr && typeof ctr.runGateBeat === 'function' && pxApi && typeof pxApi.playEnemyAction === 'function');
                const gateBroker = canUseGatedBlock ? createBeatGateBroker(gateCount) : null;
                let vfxHandle = null;
                let playedEnemyAlready = false;

                if (canUseGatedBlock) {
                  try {
                    const maybeHandle = pxApi.playEnemyAction(b, {
                      type: 'enemy_attack',
                      enemyIdx: eIdx,
                      enemy: e,
                      intent,
                      targetActorKey: 'player',
                      noBlockPrompt: false,
                      gated: true,
                      autoImpactGate: true,
                      gateCount,
                      onPreTelegraph(kArg, metaArg) {
                        const parsed = parseGateCallbackArgs(kArg, metaArg);
                        forwardPreTelegraphToRing({
                          mode: 'block',
                          key: 'Space',
                          beatIdx: parsed.k,
                          beatIndex: parsed.k,
                          totalBeats: gateCount,
                          enemyRank: parsed.k > 0 ? (e.rank || 7) : (e.rank || 2),
                          playerRank: p.rank || 2,
                          atkRank: parsed.k > 0 ? (e.rank || 7) : (e.rank || 2),
                          defRank: p.rank || 2,
                          anchorTargetKey: parsed.meta.anchorTargetKey || 'player',
                          assistMode: getAssistMode(),
                        });
                      },
                      onBeatReady(kArg, metaArg) {
                        const parsed = parseGateCallbackArgs(kArg, metaArg);
                        if (gateBroker) gateBroker.notifyReady(parsed.k, parsed.meta);
                      },
                    });
                    playedEnemyAlready = true;
                    if (isUsableVfxHandle(maybeHandle, pxApi)) {
                      vfxHandle = maybeHandle;
                      _activeVfxHandles.add(vfxHandle);
                    }
                  } catch (err) {
                    vfxHandle = null;
                  }
                }

                try {
                  if (vfxHandle && gateBroker) {
                    const wait0 = await gateBroker.waitForBeat(0, 2500);
                    if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
                      abortVfxHandle(vfxHandle);
                      return false;
                    }
                    const meta0 = (wait0 && wait0.meta) || {};
                    const anchor0 = meta0.anchorTargetKey || meta0.actorKey || 'player';
                    const blkRes = await ctr.runGateBeat({
                      mode: 'block',
                      key: 'Space',
                      beatIdx: 0,
                      beatIndex: 0,
                      totalBeats: gateCount,
                      enemyRank: e.rank || 2,
                      playerRank: p.rank || 2,
                      atkRank: e.rank || 2,
                      defRank: p.rank || 2,
                      anchorTargetKey: anchor0,
                      actorKey: anchor0,
                      slowMoScale: (meta0.slowMoScale != null && Number.isFinite(Number(meta0.slowMoScale))) ? Number(meta0.slowMoScale) : 0.25,
                      isFinalBeat: !hasFollowup,
                      assistMode: getAssistMode(),
                    });
                    if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
                      abortVfxHandle(vfxHandle);
                      return false;
                    }
                    blockGrade = (blkRes && !blkRes.cancelled && blkRes.grade) ? normalizeRingGrade(blkRes.grade) : 'GOOD';

                    if (!hasFollowup) {
                      const hitOut = resolveEnemyHitOnPlayer(b, e, intent, blockGrade, 'GOOD', banked, {
                        skipPlayAction: true,
                        skipImmediateBlockVfx: true,
                      });
                      const gatePayload = {
                        isMidBeat: false,
                        isFinalBeat: true,
                        hpLoss: hitOut.hpLoss || 0,
                        blocked: !!hitOut.blocked,
                        evaded: !!hitOut.evaded,
                        blockGrade: hitOut.blockGrade || blockGrade,
                        blockRate: hitOut.blockRate || 0,
                        shieldAbsorbed: hitOut.shieldAbsorbed || 0,
                        shieldShattered: !!hitOut.shieldShattered,
                        bypassMagicPlayerShield: !!hitOut.bypassMagicPlayerShield,
                        guardedByAlly: hitOut.guardedByAlly || null,
                      };
                      try { vfxHandle.releaseGate(0, gatePayload); } catch (err) {}
                      let returnPromise = null;
                      if (typeof vfxHandle.finishActorReturn === 'function') {
                        try { returnPromise = vfxHandle.finishActorReturn(gatePayload); } catch (err) {}
                      }
                      renderCombatUI();
                      if (hitOut.battleEnded || b.over) return true;
                      if (tickEnemyEndTurn(b, e, { evaded: !!hitOut.evaded })) { renderCombatUI(); return true; }
                      if (returnPromise && typeof returnPromise.then === 'function') {
                        await Promise.race([returnPromise, sleepTracked(520)]);
                      } else {
                        await sleepTracked(380);
                      }
                    } else {
                      // 双段攻击（如风神追加风刃）：第 1 拍即时结算主击并释放 gate 0，第 2 拍衔接追加风刃格挡
                      const hitOut = resolveEnemyHitOnPlayer(b, e, intent, blockGrade, 'GOOD', banked, {
                        skipPlayAction: true,
                        skipImmediateBlockVfx: true,
                        skipFollowup: true,
                      });
                      const gate0Payload = {
                        isMidBeat: true,
                        isFinalBeat: false,
                        hpLoss: hitOut.hpLoss || 0,
                        blocked: !!hitOut.blocked,
                        evaded: !!hitOut.evaded,
                        blockGrade: hitOut.blockGrade || blockGrade,
                        blockRate: hitOut.blockRate || 0,
                        shieldAbsorbed: hitOut.shieldAbsorbed || 0,
                        shieldShattered: !!hitOut.shieldShattered,
                        bypassMagicPlayerShield: !!hitOut.bypassMagicPlayerShield,
                        guardedByAlly: hitOut.guardedByAlly || null,
                      };
                      try { vfxHandle.releaseGate(0, gate0Payload); } catch (err) {}
                      renderCombatUI();
                      if (hitOut.battleEnded || b.over) {
                        try { if (typeof vfxHandle.finishActorReturn === 'function') vfxHandle.finishActorReturn(); } catch (err) {}
                        return true;
                      }

                      const wait1 = await gateBroker.waitForBeat(1, 700);
                      if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
                        abortVfxHandle(vfxHandle);
                        return false;
                      }
                      const meta1 = (wait1 && wait1.meta) || {};
                      const anchor1 = meta1.anchorTargetKey || meta1.actorKey || 'player';
                      const fRes = await ctr.runGateBeat({
                        mode: 'block',
                        key: 'Space',
                        beatIdx: 1,
                        beatIndex: 1,
                        totalBeats: 2,
                        enemyRank: e.rank || 7,
                        playerRank: p.rank || 2,
                        atkRank: e.rank || 7,
                        defRank: p.rank || 2,
                        anchorTargetKey: anchor1,
                        actorKey: anchor1,
                        slowMoScale: (meta1.slowMoScale != null && Number.isFinite(Number(meta1.slowMoScale))) ? Number(meta1.slowMoScale) : 0.25,
                        isFinalBeat: true,
                        assistMode: getAssistMode(),
                      });
                      if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) {
                        abortVfxHandle(vfxHandle);
                        return false;
                      }
                      followupGrade = (fRes && !fRes.cancelled && fRes.grade) ? normalizeRingGrade(fRes.grade) : blockGrade;
                      const fOut = resolveEnemyFollowupHit(b, e, intent, followupGrade, blockGrade, {
                        skipImmediateBlockVfx: !wait1.timedOut,
                      });
                      const postRes = resolveEnemyPostHitEffects(b, e, intent, hitOut.hpLoss || 0, banked, null);
                      const gate1Payload = {
                        isMidBeat: false,
                        isFinalBeat: true,
                        hpLoss: fOut.fLoss || 0,
                        blocked: !!fOut.blocked,
                        blockGrade: fOut.fGrade || followupGrade,
                        blockRate: fOut.fBlk || 0,
                        shieldAbsorbed: fOut.shieldAbsorbed || 0,
                        shieldShattered: !!fOut.shieldShattered,
                      };
                      try { vfxHandle.releaseGate(1, gate1Payload); } catch (err) {}
                      let returnPromise = null;
                      if (typeof vfxHandle.finishActorReturn === 'function') {
                        try { returnPromise = vfxHandle.finishActorReturn(gate1Payload); } catch (err) {}
                      }
                      renderCombatUI();
                      if (postRes.battleEnded || b.over) return true;
                      if (tickEnemyEndTurn(b, e, { evaded: false })) { renderCombatUI(); return true; }
                      if (returnPromise && typeof returnPromise.then === 'function') {
                        await Promise.race([returnPromise, sleepTracked(520)]);
                      } else {
                        await sleepTracked(380);
                      }
                    }
                  } else {
                    // 兼容回退轨（旧版无门控句柄或 runGateBeat 不可用）
                    const blkRes = await ctr.runBlockPrompt({
                      defRank: p.rank || 2,
                      atkRank: e.rank || 2,
                      actorKey: 'player',
                      assistMode: getAssistMode(),
                    });
                    if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) return false;
                    blockGrade = (blkRes && !blkRes.cancelled && blkRes.grade) ? normalizeRingGrade(blkRes.grade) : 'GOOD';
                    if (hasFollowup) {
                      const fRes = await ctr.runBlockPrompt({
                        defRank: p.rank || 2,
                        atkRank: e.rank || 7,
                        actorKey: 'player',
                        assistMode: getAssistMode(),
                      });
                      if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) return false;
                      followupGrade = (fRes && !fRes.cancelled && fRes.grade) ? normalizeRingGrade(fRes.grade) : blockGrade;
                    }
                    const hitOut = resolveEnemyHitOnPlayer(b, e, intent, blockGrade, followupGrade, banked, {
                      skipPlayAction: playedEnemyAlready,
                      skipImmediateBlockVfx: !playedEnemyAlready,
                    });
                    renderCombatUI();
                    if (hitOut.battleEnded || b.over) return true;
                    if (tickEnemyEndTurn(b, e, { evaded: !!hitOut.evaded })) { renderCombatUI(); return true; }
                    await sleepTracked(460);
                  }
                } finally {
                  releaseGateBroker(gateBroker);
                  if (vfxHandle) _activeVfxHandles.delete(vfxHandle);
                }
              }
            }
          } finally {
            b._directPlayEnemyVfx = false;
          }

          if (!activeBattle || activeBattle !== b || b.battleInstanceId !== instId || b.over) return false;
          b.isEnemyTurn = false;
          b._asyncPhaseActive = false;
          b._timingBusy = false;
          return finishEndTurnPhase(b, banked);
        } finally {
          _actionInProgress = false;
          if (b) {
            b._directPlayEnemyVfx = false;
            b._timingBusy = false;
            b._asyncPhaseActive = false;
            b.isEnemyTurn = false;
          }
          if (b && activeBattle === b && !b.headless) {
            if (!b.over) renderCombatUI();
            emitCombatStateChange(b);
          }
        }
      })();
    }

    // 同步零阻塞轨（无头 / JSDOM / 自动轨）
    _actionInProgress = true;
    _logBatchDepth += 1;
    try {
      return _endTurnCore(b);
    } finally {
      _actionInProgress = false;
      _logBatchDepth = Math.max(0, _logBatchDepth - 1);
      if (_logBatchDepth === 0) flushCombatLogDOM(b || activeBattle);
      if (b && activeBattle === b && !b.headless) {
        if (!b.over) renderCombatUI();
        emitCombatStateChange(b);
      }
    }
  }

  function _endTurnCore(b) {
    b = b || activeBattle;
    if (!b || b.over) return false;
    armedSkillId = null;
    if (b === activeBattle) hoveredSkillId = null;
    const p = b.player;
    delete p.status.breakChain;
    b._hadNobleReflectThisTurn = !!(p.status && p.status.nobleReflect > 0);

    b.aiMemory.lastTurnDmgDealt = b.aiMemory.currentTurnDmgDealt;
    b.aiMemory.turtleStreak = b.aiMemory.currentTurnDmgDealt <= 5 ? ((b.aiMemory.turtleStreak || 0) + 1) : 0;
    b.aiMemory.currentTurnDmgDealt = 0;

    const banked = Math.min(1, Math.max(0, b.ap));

    const allyRes = runAlliesPhase(b, banked);
    if (allyRes.ended) {
      if (!b.headless) renderCombatUI();
      return true;
    }

    for (const e of b.enemies) {
      if (!e || e.hp <= 0 || b.over) continue;
      const pre = resolveEnemyPreStrike(b, e, banked);
      if (pre.battleEnded || b.over) {
        if (!b.headless) renderCombatUI();
        return true;
      }
      if (pre.skipAttack) continue;

      const hitOut = resolveEnemyHitOnPlayer(b, e, pre.intent, e.noBlockPrompt ? 'NONE' : 'GOOD', 'GOOD', banked);
      if (hitOut.battleEnded || b.over) {
        if (!b.headless) renderCombatUI();
        return true;
      }
      if (tickEnemyEndTurn(b, e, { evaded: !!hitOut.evaded })) {
        if (!b.headless) renderCombatUI();
        return true;
      }
    }

    return finishEndTurnPhase(b, banked);
  }

  function useBondAssist(b) {
    b = b || activeBattle;
    if (!b || b.over) return { ok: false, reason: 'over' };
    const p = b.player;
    if (!p.bondAssist) return { ok: false, reason: 'none' };
    if (p.bondAssistUsed) return { ok: false, reason: 'used' };

    const api = getRelicsApi();
    const meta = (api && api.BOND_ASSISTS && api.BOND_ASSISTS[p.bondAssist]) || null;
    const cid = p.bondAssist;
    p.bondAssistUsed = true;
    armedSkillId = null;
    if (b === activeBattle) hoveredSkillId = null;
    const primary = getPrimaryAliveEnemy(b);

    if (cid === 'alice') {
      delete p.status.blind;
      delete p.status.burn;
      p.status.afterimage = (p.status.afterimage || 0) + 1;
      const recMp = Math.round(p.mmp * 0.15);
      p.mp = Math.min(p.mmp, p.mp + recMp);
      pushLog(b, logTag('cbl-emerald', `🍃【心念援护·爱丽丝·清风托翼】「${meta ? meta.quote : ''}」清除视野/灼烧，获 1 层「风行残像」并回复 ${recMp} MP！`, true));
    } else if (cid === 'noelle') {
      p.status.zeroMpThisTurn = 1;
      const recMp = Math.round(p.mmp * 0.20);
      p.mp = Math.min(p.mmp, p.mp + recMp);
      pushLog(b, logTag('cbl-ice', `📐【心念援护·诺艾儿·精算校准】「${meta ? meta.quote : ''}」本回合所有技能零耗蓝，并立即回复 ${recMp} MP！`, true));
    } else if (cid === 'aino') {
      b.enemies.forEach(e => {
        if (e.hp > 0) {
          e.status.chill = (e.status.chill || 0) + 2;
        }
      });
      if (primary && primary.shield > 0) {
        primary.shield = Math.max(0, Math.floor(primary.shield * 0.7));
      }
      pushLog(b, logTag('cbl-ice', `❄️【心念援护·艾诺·霜域共鸣】「${meta ? meta.quote : ''}」全体附加 2 回合寒颤，当前目标削盾 30%！`, true));
    } else if (cid === 'jilan') {
      b.ap = Math.min(b.apMax, b.ap + 1);
      if (primary && primary.evadeCharges > 0) primary.evadeCharges -= 1;
      if (p.status.blind > 0) delete p.status.blind;
      else if (p.status.burn > 0) delete p.status.burn;
      pushLog(b, logTag('cbl-violet', `💜【心念援护·霁岚·霁馆借步】「${meta ? meta.quote : ''}」+1 AP 并震破目标 1 层闪避！`, true));
    } else if (cid === 'charlotte') {
      p.shield = Math.min(p.maxShield, Math.max(p.shield, 0) + 45);
      p.status.nobleReflect = 1;
      pushLog(b, logTag('cbl-star', `👑【心念援护·夏洛特·贵族体面】「${meta ? meta.quote : ''}」护盾强化并展开冰镜反震！`, true));
    }

    syncDerivedBattleState(b);
    spawnBanner(b, `💞 ${meta ? `${meta.icon} ${meta.name}·${meta.title}` : '心念援护'}！`, 'riposte');
    queuePixelAction(b, { type: 'bond_assist', charId: cid });
    emitCombatVoiceCue(b, `bond_assist_${cid}`, { charId: cid });
    if (!b.headless) safeSfx('egg');
    if (!b.headless) renderCombatUI();
    return { ok: true, charId: cid };
  }

  /* =========================================================
     7. 评级计算与独立梦境演武隔离
     ========================================================= */
  function calculateGrade(b) {
    if (!b.won) return 'F';
    let score = 74;
    const parTurns = (b.stageCfg && b.stageCfg.order >= 8) ? 8 : (b.totalWaves > 1 ? 7 : 5);
    if (b.turn <= parTurns) score += 14;
    else if (b.turn <= parTurns + 2) score += 8;
    else if (b.turn > parTurns + 6) score -= 8;

    if (b.metrics.interrupts > 0 || b.metrics.ripostes > 0 || b.metrics.manaFizzleWin) score += 10;
    if ((b.metrics.perfectRings || 0) + (b.metrics.perfectBlocks || 0) >= 2) score += 6;
    const hpRatio = b.player.hp / Math.max(1, b.player.mhp);
    if (hpRatio >= 0.5) score += 6;
    else if (hpRatio >= 0.25) score += 2;
    if (b.crateHp != null && b.crateHp < 60) score -= 15;

    let grade = score >= 95 ? 'S' : score >= 80 ? 'A' : 'B';
    if (b.exposureWarningTriggered) grade = 'B';
    return grade;
  }

  function applyStageRewardsToGame(b) {
    // 独立梦境演武（fromArena: true）绝不改写主线存档 S 的属性、经验、金币或道具
    if (!b || b.headless || b.fromArena) return;
    const curS = getGameS();
    if (!curS) return;

    const rew = b.stageCfg.reward || {};
    const isDreamDuel = !!rew.duelKey;

    if (!b.won) {
      if (!isDreamDuel) {
        curS.deaths = (curS.deaths || 0) + 1;
        curS.hp = 1;
        curS.mp = Math.max(5, Math.min(curS.mmp, b.player.mp));
        if (curS.lastSafe) curS.loc = curS.lastSafe;
      }
      if (typeof global.updateHUD === 'function') global.updateHUD();
      return;
    }

    if (!isDreamDuel) {
      curS.hp = Math.max(1, Math.min(curS.mhp, b.player.hp));
      curS.mp = Math.max(0, Math.min(curS.mmp, b.player.mp));
    }

    const alreadyWonDuel = isDreamDuel && (curS.duelWins || []).includes(rew.duelKey);
    if (!alreadyWonDuel) {
      if (rew.exp && typeof global.addExp === 'function') global.addExp(rew.exp);
      if (rew.gold) curS.gold = (curS.gold || 0) + rew.gold;
      if (rew.skillId && typeof global.addSkill === 'function') global.addSkill(rew.skillId);
      if (rew.duelKey) {
        curS.duelWins = curS.duelWins || [];
        curS.duelWins.push(rew.duelKey);
        if (typeof global.ach === 'function') global.ach('virtual_first');
      }
      if (rew.taskId && typeof global.doneTask === 'function') global.doneTask(rew.taskId);
      if (rew.achId && typeof global.ach === 'function') global.ach(rew.achId);
    }

    if (typeof global.updateHUD === 'function') global.updateHUD();
    if (typeof global.save === 'function') global.save();
  }

  function finishBattle(b, won, reason) {
    if (b.over) return;
    b.over = true;
    b.won = !!won;
    b.endReason = reason || '';
    b.grade = won ? calculateGrade(b) : 'F';
    cancelTimingRing('battle_end');

    if (won) {
      saveArenaRecord(b.id, b.grade, b.turn, !!b.casualMode);
      if (!b.headless) safeSfx(b.grade === 'S' ? 'grade_s' : 'level');
      const winCue = b.grade === 'S' ? 'victory_s' : 'victory';
      const isSurrenderWin = reason === 'three_hits' || !!(b.metrics && b.metrics.manaFizzleWin);
      const veWin = (typeof window !== 'undefined' && window.VoiceEngine) ? window.VoiceEngine : null;
      const activeVid = (veWin && typeof veWin.getCurrentVoiceId === 'function') ? veWin.getCurrentVoiceId() : '';
      const surrenderPlaying = isSurrenderWin && veWin && typeof veWin.isPlaying === 'function' && veWin.isPlaying()
        && (activeVid === 'combat__boss_aino_surrender' || activeVid === 'combat__boss_alice_surrender');
      if (!b.headless && surrenderPlaying && typeof veWin.onEndedOnce === 'function') {
        veWin.onEndedOnce(() => {
          if (activeBattle === b) emitCombatVoiceCue(b, winCue, { grade: b.grade, stageId: b.id, charId: 'sylvia' });
        });
      } else {
        emitCombatVoiceCue(b, winCue, { grade: b.grade, stageId: b.id, charId: 'sylvia' });
      }
    } else {
      if (!b.headless) safeSfx('bad');
      emitCombatVoiceCue(b, 'defeat', { reason: b.endReason, stageId: b.id, charId: 'sylvia' });
    }
    applyStageRewardsToGame(b);

    if (!b.headless) {
      renderCombatUI();
      showResultModal(b);
    }
  }
  /* =========================================================
     8. UI 渲染层（实时悬停魔力增幅预览 + 护手速切 + 演武大厅）
     ========================================================= */
  const VOL3_DISGUISE_STAGES = new Set(['north_forest_hunt', 'hulan_beast_tide', 'wind_god_eye']);

  function resolveCharImg(charId, emo, stageAge, opts) {
    if (!charId) return null;
    opts = opts || {};
    const pMap = getPortraitMap();
    const curS = getGameS();
    const emotion = emo || 'normal';

    if (charId === 'sylvia') {
      const activeStageId = activeBattle && activeBattle.stageCfg ? activeBattle.stageCfg.id : '';
      const activeAlias = activeBattle && activeBattle.player ? activeBattle.player.name : '';
      const isDisguise = !!(
        opts.disguise ||
        VOL3_DISGUISE_STAGES.has(activeStageId) ||
        (activeAlias && activeAlias.includes('眷寒渔')) ||
        (!(activeBattle && activeBattle.fromArena) && curS && (curS.disguised || (curS.alias && curS.alias.includes('眷寒渔'))))
      );
      if (isDisguise) {
        return (pMap && (pMap[`sylvia_disguise_${emotion}`] || pMap.sylvia_disguise_normal))
          || 'assets/portraits/sylvia_disguise_normal.png';
      }
    }

    const namedInGame = !!(curS && curS.flags && curS.flags.named);
    const useStageAge = stageAge != null || !!(activeBattle && activeBattle.fromArena) || !namedInGame;
    if (useStageAge && pMap) {
      const baseAge = stageAge != null
        ? stageAge
        : ((activeBattle && activeBattle.stageCfg && activeBattle.stageCfg.preset && activeBattle.stageCfg.preset.age) || 14);
      const charAge = charId === 'beatrice' ? baseAge + 2 : charId === 'alice' ? Math.max(0, baseAge - 2) : baseAge;
      const tier = charAge <= 5 ? 'child' : charAge <= 11 ? 'young' : 'teenage';
      return pMap[`${charId}_${tier}_${emotion}`]
        || pMap[`${charId}_${tier}_normal`]
        || pMap[`${charId}_${emotion}`]
        || pMap[`${charId}_normal`]
        || pMap[`${charId}_child`]
        || null;
    }
    if (typeof global.resolvePortrait === 'function') {
      if (charId === 'sylvia' && pMap) {
        return global.resolvePortrait('sylvia', emo || 'serious') || pMap.sylvia_teenage_serious || pMap.sylvia_young_normal;
      }
      return global.resolvePortrait(charId, emotion);
    }
    return null;
  }

  function shuffleCopy(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function isGlobalAudioMuted() {
    try {
      if (typeof global.bgmGetState === 'function') {
        const st = global.bgmGetState();
        if (st && typeof st.muted === 'boolean') return st.muted;
      }
    } catch (e) {}
    if (typeof document !== 'undefined') {
      const hudMute = document.getElementById('btn-mute');
      if (hudMute) return hudMute.classList.contains('is-muted') || hudMute.getAttribute('aria-pressed') === 'true';
    }
    return false;
  }

  function syncBattleMuteBtn() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('cb-btn-mute');
    if (!btn) return;
    const isM = isGlobalAudioMuted();
    btn.classList.toggle('is-muted', isM);
    btn.setAttribute('aria-pressed', isM ? 'true' : 'false');
    btn.title = isM ? '已静音（点击恢复音乐与音效）' : '静音切换';
    btn.setAttribute('aria-label', isM ? '取消静音' : '静音');
    btn.innerHTML = isM ? CB_SVG.soundOff : CB_SVG.soundOn;
  }

  function formatAssistModeLabel(mode) {
    const m = normalizeAssistMode(mode);
    if (m === 'relaxed') return '护手: 宽松';
    if (m === 'off') return '护手: 自动';
    return '护手: 标准';
  }

  function syncAssistModeBtn() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('cb-btn-assist-mode');
    if (!btn) return;
    const mode = getAssistMode();
    btn.textContent = formatAssistModeLabel(mode);
    btn.setAttribute('data-assist-mode', mode);
    btn.title = '切换精准缩圈与格挡护手档位（标准 / 宽松 / 自动）';
  }

  function ensureBattleDOM() {
    if (typeof document === 'undefined') return null;
    const root = document.getElementById('battle-screen');
    if (!root) return null;
    if (root.querySelector('.cb-shell')) return root;

    // CSS Grid 2列×3行（行优先流）：每行依次 [左列, 右列]，使后排(0,1,2)居左列、前排(3,4,5)居右列靠中场
    const allySlotsHtml = [0, 3, 1, 4, 2, 5].map(s => {
      const c = getFormationSlotCoords('ally', s);
      const standeeHtml = s === 4
        ? '<div class="cb-standee-wrap" id="cb-player-standee-wrap"><div class="cb-magic-circle" aria-hidden="true"></div><div class="cb-p-portrait" id="cb-p-portrait"></div></div>'
        : '';
      return `<div class="cb-slot cb-ally-slot${s === 4 ? ' is-occupied' : ' is-empty'}" data-side="ally" data-slot="${c.slot}" data-row="${c.row}" data-col="${c.col}"><div class="cb-slot-pad"></div>${standeeHtml}</div>`;
    }).join('');

    root.innerHTML = `
      <div class="cb-backdrop" id="cb-backdrop"></div>
      <div class="cb-vignette" aria-hidden="true"></div>
      <div class="cb-palace-frost" id="cb-palace-frost" aria-hidden="true"></div>
      <div class="cb-vfx-flash" id="cb-vfx-flash" aria-hidden="true"></div>
      <div class="cb-shell">
        <header class="cb-topbar">
          <div class="cb-stage-info">
            <span class="cb-wave-pill" id="cb-wave">WAVE 1/1</span>
            <span class="cb-stage-title" id="cb-title">战术交锋</span>
            <span class="cb-turn-badge" id="cb-turn">第 1 回合</span>
          </div>
          <div class="cb-meters" id="cb-meters"></div>
          <div class="cb-top-tools">
            <button type="button" class="cb-tool-btn assist-mode-btn" id="cb-btn-assist-mode" data-assist-mode="standard" title="切换精准缩圈与格挡护手档位（标准 / 宽松 / 自动）">护手: 标准</button>
            <button class="cb-tool-btn wand-btn hidden" id="cb-btn-wand">${renderWandArtIcon()} 晦轮杖 <span class="cb-kbd">R</span></button>
            <button class="cb-tool-btn assist-btn locked-hint hidden" id="cb-btn-assist" disabled>${CB_SVG.assist} 心念援护 <span class="cb-kbd">F</span></button>
            <button class="cb-tool-btn retreat-btn" id="cb-btn-retreat">${CB_SVG.retreat} 撤出</button>
            <button type="button" class="cb-tool-btn mute-btn" id="cb-btn-mute" title="静音切换" aria-label="静音切换" aria-pressed="false" style="padding:5px 8px;">${CB_SVG.soundOn}</button>
            <button type="button" class="cb-tool-btn prefs-btn" id="cb-btn-prefs" title="阅读与音效设置" aria-label="打开设置" style="padding:5px 8px;">${CB_SVG.sliders}</button>
          </div>
        </header>

        <div class="cb-arena-field">
          <canvas id="cb-pixel-vfx-canvas" class="cb-pixel-vfx-canvas" aria-hidden="true"></canvas>
          <div class="cb-callout-layer" id="cb-callout-layer"></div>

          <div class="cb-player-stage" id="cb-player-stage">
            <div class="cb-formation-grid cb-ally-grid" id="cb-ally-formation">
              ${allySlotsHtml}
            </div>
            <div class="cb-party-panes" id="cb-party-panes" data-party-layout="1-2" data-party-count="1">
              <aside class="cb-player-pane" id="cb-player-pane">
                <div class="cb-p-header">
                  <div class="cb-p-title">
                    <div class="cb-p-name" id="cb-p-name">希尔维亚</div>
                    <div class="cb-p-sub" id="cb-p-sub">物攻 -- · 魔攻 --</div>
                  </div>
                  <div class="cb-ap-row" id="cb-ap-row"></div>
                </div>
                <div class="cb-bars-wrap">
                  <div class="cb-stat-row">
                    <div class="cb-stat-top"><span>生命值 HP</span><span id="cb-php-txt">0/0</span></div>
                    <div class="cb-stat-track"><div class="cb-stat-fill hp" id="cb-php-bar"></div></div>
                  </div>
                  <div class="cb-stat-row">
                    <div class="cb-stat-top"><span>魔力池 MP</span><span id="cb-pmp-txt">0/0</span></div>
                    <div class="cb-stat-track">
                      <div class="cb-stat-fill mp" id="cb-pmp-bar"></div>
                      <div class="cb-mp-commit" id="cb-mp-commit"></div>
                      <div class="cb-stat-ticks"></div>
                    </div>
                  </div>
                </div>
                <div class="cb-buff-list" id="cb-p-buffs"></div>
              </aside>
            </div>
          </div>

          <div class="cb-mid-corridor" id="cb-mid-corridor" aria-hidden="true"></div>

          <section class="cb-enemy-zone cb-formation-grid cb-enemy-grid" id="cb-enemy-zone"></section>

          <aside class="cb-target-detail-pane" id="cb-target-detail-pane" aria-label="当前锁定目标详情"></aside>
        </div>

        <div class="cb-forecast-bar" id="cb-forecast-bar">${isCoarseTouchDevice() ? '轻点技能卡查看破招与预计伤害，再次点击施放' : '悬停任意技能卡，实时推演架势克制、破招截断、预计伤害与魔力增幅'}</div>

        <div id="b-enemy" class="hidden">
          <span id="b-emoji"></span><span id="b-ename"></span>
          <i id="b-ehp"></i><em id="b-ehp-num"></em>
        </div>

        <footer class="cb-deck">
          <div class="cb-left-console">
            <div class="cb-overcast-box" id="cb-overcast-box">
              <div class="cb-oc-head">
                <span><span id="cb-oc-title">魔力增幅</span> <span class="cb-kbd">E</span></span>
                <span class="cb-oc-mult" id="cb-oc-mult">1.00x</span>
              </div>
              <div class="cb-oc-seg" id="cb-oc-seg">
                <button type="button" class="cb-oc-btn" data-oc="0" data-amp="0" title="0% 常规施法 · 1.00× 常规魔导出力">0% 常规</button>
                <button type="button" class="cb-oc-btn" data-oc="1" data-amp="0.20" title="★一阶·魔力盈溢（20%）：+1破锁 · 10%穿抗 · +20%增伤（护盾1.25×）">★20%</button>
                <button type="button" class="cb-oc-btn" data-oc="2" data-amp="0.40" title="★★二阶·极寒过载（40%）：+2破锁 · 22%穿抗 · +40%增伤（护盾1.50×·钢霜壁垒）">★★40%</button>
                <button type="button" class="cb-oc-btn all-in" data-oc="3" data-amp="0.60" title="★★★三阶·星霜极限（60%）：+3破锁 · 35%穿抗 · +60%增伤（三阶输出上限）">★★★60%</button>
              </div>
              <div class="cb-oc-slider-row" id="cb-oc-slider-row" style="display:flex;align-items:center;gap:8px;margin-top:5px;padding:0;">
                <input type="range" class="cb-oc-slider" id="cb-oc-slider" min="0" max="60" step="1" value="0" aria-label="魔力增幅百分比微调" style="flex:1;min-width:0;height:4px;margin:0;accent-color:#1658eb;cursor:pointer;" />
                <span class="cb-oc-pct" id="cb-oc-pct" style="font-size:11px;font-weight:700;color:#1658eb;font-variant-numeric:tabular-nums;min-width:38px;text-align:right;white-space:nowrap;">0%</span>
              </div>
            </div>
            <div id="b-log" class="cb-log-box"></div>
          </div>

          <div id="b-actions" class="cb-skills-grid"></div>

          <div class="cb-turn-col">
            <button class="cb-endturn-btn" id="cb-btn-endturn">
              <span class="cb-endturn-seal" aria-hidden="true">${CB_SVG.hourglass}</span>
              <span class="cb-endturn-main">结束回合 <span class="cb-kbd">X</span></span>
              <small>可留存 1 点 AP</small>
            </button>
          </div>
        </footer>
      </div>
      <div id="cb-modal-slot"></div>
    `;

    root.querySelector('#cb-oc-seg').onclick = e => {
      const btn = e.target.closest('.cb-oc-btn');
      if (!btn || btn.disabled) return;
      const ampAttr = btn.getAttribute('data-amp');
      if (ampAttr != null) {
        setOvercastPct(Number(ampAttr));
      } else if (btn.hasAttribute('data-oc')) {
        setOvercast(Number(btn.getAttribute('data-oc')));
      }
    };
    const ocSlider = root.querySelector('#cb-oc-slider');
    if (ocSlider) {
      let sliderKeyStep = false;
      ocSlider.onkeydown = ev => {
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown' || ev.key === 'Home' || ev.key === 'End' || ev.key === 'PageUp' || ev.key === 'PageDown') {
          sliderKeyStep = true;
        }
      };
      ocSlider.onpointerdown = () => { sliderKeyStep = false; };
      ocSlider.onmousedown = () => { sliderKeyStep = false; };
      ocSlider.oninput = () => {
        if (ocSlider.disabled) return;
        const pct = Number(ocSlider.value) / 100;
        const useSnap = !sliderKeyStep;
        sliderKeyStep = false;
        const res = setOvercastPct(pct, activeBattle, { snap: useSnap });
        if (res && res.ok) {
          ocSlider.value = String(Math.round(res.overcastPct * 100));
        }
      };
    }
    const assistModeBtn = root.querySelector('#cb-btn-assist-mode');
    if (assistModeBtn) {
      assistModeBtn.onclick = () => {
        const order = ['standard', 'relaxed', 'off'];
        const cur = getAssistMode();
        const next = order[(order.indexOf(cur) + 1) % order.length];
        setAssistMode(next);
        syncAssistModeBtn();
        safeSfx('tab_switch');
        if (activeBattle && !activeBattle.headless) renderCombatUI();
      };
    }
    root.querySelector('#cb-btn-wand').onclick = () => toggleEclipseWand();
    root.querySelector('#cb-btn-assist').onclick = () => useBondAssist();
    root.querySelector('#cb-btn-endturn').onclick = () => {
      triggerEndTurnFromUI();
    };
    root.querySelector('#cb-btn-retreat').onclick = () => {
      safeSfx('modal_close');
      exitBattle(false);
    };
    const muteBtn = root.querySelector('#cb-btn-mute');
    if (muteBtn) {
      muteBtn.onclick = () => {
        let nowMuted = false;
        if (typeof global.bgmToggleMute === 'function') {
          nowMuted = !!global.bgmToggleMute();
        } else {
          const hudMute = document.getElementById('btn-mute');
          if (hudMute && typeof hudMute.click === 'function') hudMute.click();
          nowMuted = isGlobalAudioMuted();
        }
        if (!nowMuted) safeSfx('glass_tap');
        syncBattleMuteBtn();
      };
    }
    const prefsBtn = root.querySelector('#cb-btn-prefs');
    if (prefsBtn) {
      prefsBtn.onclick = () => {
        safeSfx('modal_open');
        if (global.VNUx && typeof global.VNUx.openPrefsModal === 'function') {
          global.VNUx.openPrefsModal();
          const ov = document.getElementById('vn-prefs-modal');
          if (ov && ov.style) {
            ov.style.zIndex = '95';
          }
        } else if (typeof global.openPanel === 'function') {
          global.openPanel('settings');
        }
      };
    }
    syncBattleMuteBtn();
    syncAssistModeBtn();

    return root;
  }

  function syncHoverEnemyGlow(sid, bOverride) {
    if (typeof document === 'undefined') return;
    if (sid && typeof sid === 'object' && ('enemies' in sid || 'player' in sid)) {
      bOverride = sid;
      sid = hoveredSkillId || null;
    }
    const b = bOverride || activeBattle;
    const eZone = document.getElementById('cb-enemy-zone');
    const tdPane = document.getElementById('cb-target-detail-pane');
    if (!eZone) return;

    eZone.querySelectorAll('.cb-enemy-card').forEach(card => {
      card.classList.remove('counter-target-glow', 'is-lethal');
    });
    eZone.querySelectorAll('.cb-hp-preview, .cb-ehp-preview').forEach(el => {
      el.style.width = '0%';
      el.style.left = '0%';
      el.classList.remove('is-active', 'is-lethal', 'is-break');
    });
    eZone.querySelectorAll('.cb-hp-microtag').forEach(tag => {
      tag.textContent = '';
      tag.classList.remove('show', 'is-lethal', 'is-break');
    });
    if (tdPane) {
      tdPane.querySelectorAll('.cb-td-hp-preview').forEach(el => {
        el.style.width = '0%';
        el.style.left = '0%';
        el.classList.remove('is-active', 'is-lethal', 'is-break');
      });
    }

    if (!sid || !b || b.headless) return;
    const sk = TACTICAL_SKILLS[sid];
    if (!sk) return;

    const primary = getPrimaryAliveEnemy(b);
    const targets = sk.aoe ? b.enemies : (primary ? [primary] : []);
    const p = b.player;

    targets.forEach(en => {
      if (!en || en.hp <= 0) return;
      const eIdx = b.enemies.indexOf(en);
      if (eIdx < 0) return;

      const cardEl = eZone.querySelector(`.cb-enemy-card[data-eidx="${eIdx}"]`);
      const prevEl = eZone.querySelector(`.cb-hp-preview[data-eidx="${eIdx}"]`)
        || eZone.querySelector(`.cb-ehp-preview[data-eidx="${eIdx}"]`);
      const tdPrevEl = tdPane ? tdPane.querySelector(`.cb-td-hp-preview[data-eidx="${eIdx}"]`) : null;
      const tagEl = eZone.querySelector(`.cb-hp-microtag[data-eidx="${eIdx}"]`);

      const est = sk.power > 0 ? estimateSkillDamage(b, sk, en) : null;
      const stance = en.intent ? en.intent.stance : 'HEAVY_WINDUP';
      const wandOn = isEclipseStaffForSkill(p, sk);
      const isEyeStillness = !!(
        en.aiType === 'wind_god_boss' &&
        (en.phase || 1) >= 2 &&
        en.intent &&
        en.intent.moveKey === 'EYE_STILLNESS'
      );
      const bypassEvade = !!(
        sk.aoe ||
        sk.sureHit ||
        wandOn ||
        stance === 'STAGGERED' ||
        (est && est.rootStepParryTrigger) ||
        (isEyeStillness && est && est.willInterrupt)
      );
      const evadeBlocked = !!(sk.power > 0 && !bypassEvade && en.evadeCharges > 0);
      const effDmg = (est && !est.mirrorBlocked && !evadeBlocked) ? est.dmg : 0;

      let effShield = en.shield || 0;
      if (sk.shatterShield) effShield = 0;
      else if (wandOn && (en.shieldKind || 'magic') === 'magic') effShield = 0;
      else if (sk.pierceHalfShield) effShield = Math.floor(effShield * 0.5);

      const rawHpDmg = Math.max(0, effDmg - effShield);
      const hpDmg = en.nonLethalSpar ? 0 : Math.min(en.hp, Math.max(0, rawHpDmg));
      const maxHp = Math.max(1, en.mhp || en.maxHp || 1);

      const canBreak = !!(
        (est && !est.mirrorBlocked && !evadeBlocked && (est.willInterrupt || est.willRiposte)) ||
        (sk.counterLunge && en.intent && en.intent.stance === 'CLOSE_LUNGE') ||
        (sk.breakStillness && isEyeStillness) ||
        (sk.severSeep && en.aiType === 'noelle' && en.seepTriggeredOnce && !en.seepSevered)
      );
      const willShieldBreak = !!(effDmg > 0 && (en.shield || 0) > 0 && (sk.shatterShield || effDmg >= (en.shield || 0)));
      const phaseLocked = !!(en.boss && en.phase2HpPct && (en.phase || 1) < 2);
      const seepLocked = !!(en.aiType === 'noelle' && !en.seepTriggeredOnce && !en.seepSevered && !sk.severSeep && en.hp > Math.round(maxHp * 0.48));
      const isLethal = !!(!en.nonLethalSpar && !phaseLocked && !seepLocked && hpDmg >= en.hp && en.hp > 0);

      if (canBreak && cardEl) {
        cardEl.classList.add('counter-target-glow');
      }

      if (hpDmg > 0 && (prevEl || tdPrevEl)) {
        const leftPct = Math.max(0, ((en.hp - hpDmg) / maxHp) * 100);
        const widthPct = Math.max(0, Math.min(100 - leftPct, (hpDmg / maxHp) * 100));
        const leftStr = `${leftPct.toFixed(2)}%`;
        const widthStr = `${widthPct.toFixed(2)}%`;
        if (prevEl) {
          prevEl.style.left = leftStr;
          prevEl.style.width = widthStr;
          prevEl.classList.add('is-active');
          if (isLethal) {
            prevEl.classList.add('is-lethal');
            if (cardEl) cardEl.classList.add('is-lethal');
          } else if (canBreak || willShieldBreak) {
            prevEl.classList.add('is-break');
          }
        }
        if (tdPrevEl) {
          tdPrevEl.style.left = leftStr;
          tdPrevEl.style.width = widthStr;
          tdPrevEl.classList.add('is-active');
          if (isLethal) {
            tdPrevEl.classList.add('is-lethal');
          } else if (canBreak || willShieldBreak) {
            tdPrevEl.classList.add('is-break');
          }
        }
      }

      if (tagEl) {
        if (isLethal && (canBreak || willShieldBreak)) {
          tagEl.textContent = '✦ 斩杀 · BREAK';
          tagEl.classList.add('show', 'is-lethal');
        } else if (isLethal) {
          tagEl.textContent = '✦ 斩杀';
          tagEl.classList.add('show', 'is-lethal');
        } else if (canBreak || willShieldBreak) {
          tagEl.textContent = '✦ BREAK';
          tagEl.classList.add('show', 'is-break');
        }
      }
    });
  }

  function updateOvercastPreviewUI(b, refSkillId) {
    if (!b || b.headless || typeof document === 'undefined') return;
    const p = b.player;
    const ocMultEl = document.getElementById('cb-oc-mult');
    const commitBar = document.getElementById('cb-mp-commit');
    const forecastBar = document.getElementById('cb-forecast-bar');
    if (!ocMultEl || !commitBar) return;

    const mpPct = Math.max(0, Math.min(100, p.mp / Math.max(1, p.mmp) * 100));
    const refSkill = (refSkillId && TACTICAL_SKILLS[refSkillId])
      ? TACTICAL_SKILLS[refSkillId]
      : pickPrimaryAmpSkill(p, null);

    if (!canPlayerAmp(p)) {
      ocMultEl.textContent = '不可增幅';
      commitBar.style.width = '0%';
    } else {
      // 精确联动悬停技能或当前主力增幅技能的真实蓝耗（含零耗蓝/魔力精算/省魔手稿与晦轮杖附加耗蓝）
      const realSpend = computeSkillMpCost(p, refSkill);
      const refProf = computeAmpProfile(p, refSkill);
      const isShieldRef = !!(refSkill.shieldBase > 0 && !(refSkill.power > 0));
      if (isShieldRef) {
        ocMultEl.textContent = `${refSkill.name} 护盾${refProf.shieldMult.toFixed(2)}x (耗${realSpend})`;
      } else {
        const powerMp = computeOvercastPowerMp(p, refSkill);
        const realMult = computeManaCycleMultiplier(p, powerMp, refSkill);
        ocMultEl.textContent = `${refSkill.name} ${realMult.toFixed(2)}x (耗${realSpend})`;
      }
      const spendPct = Math.min(mpPct, Math.min(p.mp, realSpend) / Math.max(1, p.mmp) * 100);
      commitBar.style.left = `${Math.max(0, mpPct - spendPct)}%`;
      commitBar.style.width = `${spendPct}%`;
    }

    // 实时同步敌方血条预扣段、斩杀/BREAK 微标与上方战术预测条
    syncHoverEnemyGlow(refSkillId || null, b);

    if (forecastBar) {
      if (refSkillId && TACTICAL_SKILLS[refSkillId]) {
        const hoverSk = TACTICAL_SKILLS[refSkillId];
        const target = getPrimaryAliveEnemy(b);
        const fc = computeTacticalForecast(b, hoverSk, target);
        if (fc) {
          forecastBar.className = `cb-forecast-bar active kind-${fc.kind}`;
          const counterPills = [];
          if (fc.willInterrupt && !fc.evadeBlocked && !fc.mirrorBlocked) {
            counterPills.push('<span class="cfb-counter-pill interrupt">✦ 破招可打断</span>');
          }
          if (fc.willRiposte && !fc.evadeBlocked && !fc.mirrorBlocked) {
            counterPills.push('<span class="cfb-counter-pill riposte">✦ 剑步可闪反</span>');
          }
          const dmgPart = fc.dmgMin > 0
            ? `伤害 <b>${fc.dmgMin}${fc.dmgMax > fc.dmgMin ? `~${fc.dmgMax}` : ''}</b>`
            : (fc.estShield > 0
              ? `护盾 <b>+${fc.estShield}</b>${fc.shieldMult > 1.001 ? ` · 增幅 <b>${fc.shieldMult.toFixed(2)}×</b>` : ''}`
              : '战术增益/防反');
          const ampLabel = p.hasManaCycle ? '魔战' : '增幅';
          const returnPart = (p.hasManaCycle || fc.manaReturn > 0) ? ` · 回蓝 <b>+${fc.manaReturn}</b>` : '';
          const multPart = fc.dmgMin > 0
            ? `克制 <b>${fc.elemMult.toFixed(2)}×</b> · ${ampLabel} <b>${fc.mcMult.toFixed(2)}×</b>${returnPart}`
            : `消耗 AP ${fc.apCost}${fc.mpCost > 0 ? ` · MP ${fc.mpCost}` : ''}`;
          forecastBar.innerHTML = `<span class="cfb-name">${CB_SVG.target} ${hoverSk.name}</span>${counterPills.join('')}<span class="cfb-head">${fc.headline}</span><span class="cfb-meta">${dmgPart} · ${multPart}${fc.critChance > 0 && fc.dmgMin > 0 ? ` · 暴击 ${(fc.critChance * 100).toFixed(0)}%` : ''}</span>`;
        }
      } else {
        forecastBar.className = 'cb-forecast-bar';
        forecastBar.textContent = isCoarseTouchDevice()
          ? '轻点技能卡查看破招与预计伤害，再次点击施放'
          : (p.hasManaCycle
            ? '悬停任意技能卡，实时推演架势克制、破招截断、预计伤害与魔战回蓝'
            : '悬停任意技能卡，实时推演架势克制、破招截断、预计伤害与魔力增幅');
      }
    }
  }

  function renderCombatUI() {
    const b = activeBattle;
    if (!b || b.headless || typeof document === 'undefined') return;
    const root = ensureBattleDOM();
    if (!root) return;
    syncDerivedBattleState(b);
    syncBattleMuteBtn();
    syncAssistModeBtn();

    const p = b.player;
    const stageAge = (b.fromArena && b.stageCfg && b.stageCfg.preset && b.stageCfg.preset.age) || null;
    root.classList.toggle('wand-refract', !!p.wandActive);
    root.classList.toggle('palace-timestop', !!document.getElementById('cb-palace-modal'));
    const backdropEl = document.getElementById('cb-backdrop');
    if (backdropEl) {
      const nextBgUrl = `url('${resolveBattleBgUrl(b.stageCfg)}')`;
      if (backdropEl.dataset.bgUrl !== nextBgUrl) {
        backdropEl.dataset.bgUrl = nextBgUrl;
        backdropEl.style.backgroundImage = nextBgUrl;
      }
    }

    document.getElementById('cb-wave').textContent = `WAVE ${b.waveIdx + 1}/${b.totalWaves}`;
    document.getElementById('cb-title').textContent = b.stageCfg.title;
    document.getElementById('cb-turn').textContent = b.stageCfg.turnLimit
      ? `第 ${b.turn}/${b.stageCfg.turnLimit} 回合`
      : `第 ${b.turn} 回合`;

    const meters = [];
    if (b.stageCfg.hitRule) {
      const pDots = '●'.repeat(b.playerHits) + '○'.repeat(Math.max(0, 3 - b.playerHits));
      const eDots = '●'.repeat(b.enemyHits) + '○'.repeat(Math.max(0, 3 - b.enemyHits));
      meters.push(`<div class="cb-meter-pill hit-counter">三击制：<b>我方 ${pDots}</b> vs <b>${eDots} 艾诺</b></div>`);
    }
    if (b.stageCfg.sealRule) {
      meters.push(`<div class="cb-meter-pill reno">合围封锁：<b>${b.sealProgress}%</b>${b.frostFloorTurns > 0 ? ' (薄冰已铺)' : ''}
        <span class="cb-mini-bar"><i class="cb-mini-fill fill-seal" style="width:${b.sealProgress}%"></i></span></div>`);
    }
    if (b.witnessActive) {
      meters.push(`<div class="cb-meter-pill exposure${b.exposure >= 60 ? ' danger' : ''}">暴露风险：<b>${b.exposure}%</b>
        <span class="cb-mini-bar"><i class="cb-mini-fill fill-exposure" style="width:${b.exposure}%"></i></span></div>`);
    }
    if (b.crateHp != null) {
      meters.push(`<div class="cb-meter-pill crate">医疗药箱：<b>${b.crateHp}/${b.crateMax}</b>
        <span class="cb-mini-bar"><i class="cb-mini-fill fill-crate" style="width:${b.crateHp}%"></i></span></div>`);
    }
    if (b.stageCfg.ainoSupport) {
      meters.push(`<div class="cb-meter-pill aino-aid">艾诺冰枪共鸣：<b>${b.ainoResonance}/2</b></div>`);
    }
    document.getElementById('cb-meters').innerHTML = meters.join('');

    const wBtn = document.getElementById('cb-btn-wand');
    if (p.hasEclipseWand) {
      wBtn.classList.remove('hidden');
      wBtn.classList.toggle('active', !!p.wandActive);
      const extraMpTip = Math.round(Math.max(1, p.mmp || 100) * COMBAT_BALANCE_V32.STAVES.eclipse_wand.extraMpPct);
      wBtn.title = `晦轮杖：100% 魔法真伤，无视法抗与魔法盾，仅物理实体甲阻尼；额外耗蓝 +${extraMpTip} MP，可连回合催动`;
      const wandIcon = renderWandArtIcon();
      wBtn.innerHTML = p.wandActive
        ? `${wandIcon} 晦轮杖：真伤 ON <span class="cb-kbd">R</span>`
        : `${wandIcon} 晦轮杖：收鞘 <span class="cb-kbd">R</span>`;
      wBtn.disabled = b.over;
    } else {
      wBtn.classList.add('hidden');
    }

    const assistBtn = document.getElementById('cb-btn-assist');
    if (assistBtn) {
      const api = getRelicsApi();
      const aMeta = p.bondAssist && api && api.BOND_ASSISTS ? api.BOND_ASSISTS[p.bondAssist] : null;
      if (aMeta) {
        assistBtn.classList.remove('hidden', 'locked-hint');
        assistBtn.disabled = b.over || !!p.bondAssistUsed;
        assistBtn.title = `${aMeta.effectDesc} — ${aMeta.quote}`;
        assistBtn.innerHTML = p.bondAssistUsed
          ? `${CB_SVG.assist} ${aMeta.title} (已援护)`
          : `${CB_SVG.assist} ${aMeta.name}·${aMeta.title} <span class="cb-kbd">F</span>`;
      } else {
        assistBtn.classList.add('hidden', 'locked-hint');
        assistBtn.disabled = true;
        assistBtn.title = '深化羁绊（好感≥2、了解度≥35 或推动命运暗流）解锁心念援护';
        assistBtn.innerHTML = `${CB_SVG.assist} 心念援护 <span class="cb-kbd">F</span>`;
      }
    }

    const pane = document.getElementById('cb-player-pane');
    pane.classList.toggle('rooted-aura', !!(p.status.rooted || p.shield > 0));
    pane.classList.toggle('wand-aura', !!p.wandActive);

    const pxApi = getPixelVfxApi();
    const isVol3Disguise = VOL3_DISGUISE_STAGES.has(b.id) || (p.name && p.name.includes('眷寒渔'));
    const pImg = resolveCharImg('sylvia', p.hp < p.mhp * 0.4 ? 'serious' : 'normal', stageAge, { disguise: isVol3Disguise });
    const allies = Array.isArray(b.allies) ? b.allies : [];
    const totalParty = 1 + allies.length;
    const isCompactParty = totalParty >= 3;
    const hasVanguardAlly = allies.length > 0;
    const playerStage = document.getElementById('cb-player-stage');
    if (playerStage) {
      playerStage.classList.toggle('has-vanguard-ally', hasVanguardAlly);
    }
    const allyGrid = document.getElementById('cb-ally-formation');
    const pPortEl = document.getElementById('cb-p-portrait');
    const pStandeeWrap = document.getElementById('cb-player-standee-wrap') || (pPortEl ? pPortEl.closest('.cb-standee-wrap') : null);
    const playerSlotIdx = hasVanguardAlly ? 1 : 4;
    const occupiedAllySlots = new Set([playerSlotIdx]);

    if (allyGrid && pStandeeWrap) {
      const pTargetSlot = allyGrid.querySelector(`.cb-ally-slot[data-slot="${playerSlotIdx}"]`);
      if (pTargetSlot && pStandeeWrap.parentElement !== pTargetSlot) {
        pTargetSlot.appendChild(pStandeeWrap);
      }
    }

    if (pxApi && pPortEl) {
      const pSpriteId = pxApi.resolvePlayerSpriteId(b, isVol3Disguise);
      pPortEl.classList.remove('is-svg');
      pPortEl.classList.add('has-px-actor');
      if (pStandeeWrap) pStandeeWrap.classList.add('has-px-actor');
      const existingPx = pPortEl.querySelector(`.cb-px-actor[data-sprite-id="${pSpriteId}"]`);
      if (!existingPx) {
        pPortEl.innerHTML = pxApi.renderActorMarkup(pSpriteId, {
          actorKey: 'player',
          label: p.name,
          dead: p.hp <= 0,
          fallbackImg: pImg,
        });
      } else {
        existingPx.classList.toggle('is-dead', p.hp <= 0);
      }
    } else if (pPortEl) {
      pPortEl.classList.remove('has-px-actor');
      if (pStandeeWrap) pStandeeWrap.classList.remove('has-px-actor');
      pPortEl.classList.toggle('is-svg', !pImg);
      pPortEl.innerHTML = pImg ? `<img src="${pImg}" alt="${p.name}"/>` : renderBeastCrestSVG('wolf');
    }

    const primaryAlly = allies[0] || null;
    const partyPanes = document.getElementById('cb-party-panes');
    if (partyPanes) {
      partyPanes.setAttribute('data-party-layout', totalParty <= 2 ? '1-2' : '3-6');
      partyPanes.setAttribute('data-party-count', String(totalParty));
      partyPanes.querySelectorAll('.cb-ally-extra-pane').forEach(el => el.remove());
    }
    if (allyGrid) {
      allyGrid.querySelectorAll('.cb-ally-extra-slot').forEach(el => el.remove());
    }

    if (primaryAlly && allyGrid) {
      const aSlotIdx = (Number.isInteger(primaryAlly.slot) && primaryAlly.slot >= 0 && primaryAlly.slot <= 5 && !occupiedAllySlots.has(primaryAlly.slot))
        ? primaryAlly.slot
        : ([4, 3, 5, 0, 2, 1].find(s => !occupiedAllySlots.has(s)) ?? 4);
      occupiedAllySlots.add(aSlotIdx);
      const aTargetSlot = allyGrid.querySelector(`.cb-ally-slot[data-slot="${aSlotIdx}"]`);
      let vWrap = document.getElementById('cb-ally-vanguard-slot');
      const aActorKey = `ally:${primaryAlly.id}`;
      const aSpriteId = primaryAlly.spriteId || primaryAlly.id || 'reno';
      if (!vWrap) {
        vWrap = document.createElement('div');
        vWrap.id = 'cb-ally-vanguard-slot';
        vWrap.className = 'cb-ally-vanguard-slot';
        vWrap.innerHTML = `<div class="cb-standee-wrap cb-ally-standee"><div class="cb-magic-circle ally" aria-hidden="true"></div><div class="cb-ally-portrait" id="cb-ally-portrait"></div></div>`;
      }
      vWrap.setAttribute('data-ally-id', primaryAlly.id);
      vWrap.setAttribute('data-aidx', '0');
      vWrap.setAttribute('data-actor-key', aActorKey);
      vWrap.setAttribute('data-slot', String(aSlotIdx));
      if (aTargetSlot && vWrap.parentElement !== aTargetSlot) {
        aTargetSlot.appendChild(vWrap);
      }
      const allyStandee = vWrap.querySelector('.cb-ally-standee');
      const allyPortEl = vWrap.querySelector('#cb-ally-portrait');
      const aImg = resolveCharImg(primaryAlly.id, 'normal', stageAge);
      if (pxApi && allyPortEl) {
        allyPortEl.classList.remove('is-svg');
        allyPortEl.classList.add('has-px-actor');
        if (allyStandee) allyStandee.classList.add('has-px-actor');
        const existingAllyPx = allyPortEl.querySelector(`.cb-px-actor[data-sprite-id="${aSpriteId}"][data-actor-key="${aActorKey}"]`);
        if (!existingAllyPx) {
          allyPortEl.innerHTML = pxApi.renderActorMarkup(aSpriteId, {
            actorKey: aActorKey,
            label: primaryAlly.name,
            dead: primaryAlly.hp <= 0,
            fallbackImg: aImg,
          });
        } else {
          existingAllyPx.classList.toggle('is-dead', primaryAlly.hp <= 0);
        }
      } else if (allyPortEl) {
        allyPortEl.classList.remove('has-px-actor');
        if (allyStandee) allyStandee.classList.remove('has-px-actor');
        allyPortEl.classList.toggle('is-svg', !aImg);
        allyPortEl.innerHTML = aImg ? `<img src="${aImg}" alt="${primaryAlly.name}"/>` : `<span class="cb-ally-fallback-badge">${primaryAlly.name}</span>`;
      }

      if (partyPanes) {
        let allyPane = document.getElementById('cb-ally-pane');
        if (!allyPane) {
          allyPane = document.createElement('aside');
          allyPane.id = 'cb-ally-pane';
          allyPane.className = 'cb-ally-pane';
          partyPanes.appendChild(allyPane);
        }
        allyPane.setAttribute('data-ally-id', primaryAlly.id);
        allyPane.setAttribute('data-aidx', '0');
        const nextElem = primaryAlly.nextElement || (primaryAlly.elements && primaryAlly.elements[0]) || 'earth';
        const elemMeta = ALLY_ELEM_META[nextElem] || ALLY_ELEM_META.earth;
        const aHpPct = Math.max(0, Math.min(100, (primaryAlly.hp / Math.max(1, primaryAlly.mhp)) * 100));
        const aShPct = Math.max(0, Math.min(100, ((primaryAlly.shield || 0) / Math.max(1, primaryAlly.maxShield || 160)) * 100));
        const primaryAllyDisplayName = isCompactParty ? shortPartyCardName(primaryAlly.name) : primaryAlly.name;
        const primaryAllyRole = shortAllyRoleLabel(primaryAlly.title, '前排主力');
        const primaryAllyTitleAttr = String(primaryAlly.name || '').replace(/"/g, '&quot;');
        const primaryAllyHpNumHtml = isCompactParty
          ? `<span class="cb-party-hp-num" title="HP ${primaryAlly.hp}/${primaryAlly.mhp}">${primaryAlly.hp}/${primaryAlly.mhp}</span>`
          : '';
        allyPane.innerHTML = `
          <div class="cb-ally-header">
            <div class="cb-ally-title">
              <div class="cb-ally-name" title="${primaryAllyTitleAttr}">${primaryAllyDisplayName}</div>
              <div class="cb-ally-role">${primaryAllyRole}</div>
            </div>
            ${primaryAllyHpNumHtml}
            <span class="cb-ally-elem-badge elem-${nextElem}" data-next-elem="${nextElem}">下回合 · ${elemMeta.badge}</span>
          </div>
          <div class="cb-bars-wrap">
            <div class="cb-stat-row">
              <div class="cb-stat-top"><span>生命值 HP</span><span class="cb-ally-hp-txt">${primaryAlly.hp}/${primaryAlly.mhp}</span></div>
              <div class="cb-stat-track"><div class="cb-stat-fill hp ally-hp" style="width:${aHpPct.toFixed(1)}%"></div></div>
            </div>
            <div class="cb-stat-row">
              <div class="cb-stat-top"><span>岩盾护壁</span><span class="cb-ally-shield-txt">${primaryAlly.shield || 0}/${primaryAlly.maxShield || 160}</span></div>
              <div class="cb-stat-track"><div class="cb-stat-fill shield ally-shield" style="width:${aShPct.toFixed(1)}%"></div></div>
            </div>
          </div>
        `;
      }

      if (allies.length > 1) {
        const extraSlotOrder = [3, 5, 0, 2, 1, 4];
        const maxAllyCount = Math.min(5, allies.length);
        for (let aIdx = 1; aIdx < maxAllyCount; aIdx++) {
          const extraAlly = allies[aIdx];
          if (!extraAlly) continue;
          const exSlotIdx = (Number.isInteger(extraAlly.slot) && extraAlly.slot >= 0 && extraAlly.slot <= 5 && !occupiedAllySlots.has(extraAlly.slot))
            ? extraAlly.slot
            : extraSlotOrder.find(s => !occupiedAllySlots.has(s));
          if (exSlotIdx == null) break;
          occupiedAllySlots.add(exSlotIdx);
          const exTargetSlot = allyGrid.querySelector(`.cb-ally-slot[data-slot="${exSlotIdx}"]`);
          const exId = extraAlly.id || `ally_${aIdx}`;
          const exActorKey = `ally:${exId}`;
          const exSpriteId = extraAlly.spriteId || extraAlly.id || 'reno';
          const exName = extraAlly.name || '友军';

          const exWrap = document.createElement('div');
          exWrap.className = 'cb-ally-vanguard-slot cb-ally-extra-slot';
          exWrap.setAttribute('data-ally-id', exId);
          exWrap.setAttribute('data-aidx', String(aIdx));
          exWrap.setAttribute('data-actor-key', exActorKey);
          exWrap.setAttribute('data-slot', String(exSlotIdx));
          exWrap.innerHTML = `<div class="cb-standee-wrap cb-ally-standee"><div class="cb-magic-circle ally" aria-hidden="true"></div><div class="cb-ally-portrait"></div></div>`;
          if (exTargetSlot) {
            exTargetSlot.appendChild(exWrap);
          }

          const exStandee = exWrap.querySelector('.cb-ally-standee');
          const exPortEl = exWrap.querySelector('.cb-ally-portrait');
          const exImg = resolveCharImg(extraAlly.charId || extraAlly.id, 'normal', stageAge);
          if (pxApi && exPortEl) {
            exPortEl.classList.remove('is-svg');
            exPortEl.classList.add('has-px-actor');
            if (exStandee) exStandee.classList.add('has-px-actor');
            exPortEl.innerHTML = pxApi.renderActorMarkup(exSpriteId, {
              actorKey: exActorKey,
              label: exName,
              dead: (extraAlly.hp || 0) <= 0,
              fallbackImg: exImg,
            });
          } else if (exPortEl) {
            exPortEl.classList.remove('has-px-actor');
            if (exStandee) exStandee.classList.remove('has-px-actor');
            exPortEl.classList.toggle('is-svg', !exImg);
            exPortEl.innerHTML = exImg
              ? `<img src="${exImg}" alt="${exName}"/>`
              : `<span class="cb-ally-fallback-badge">${exName}</span>`;
          }

          if (partyPanes) {
            const exPane = document.createElement('aside');
            exPane.className = 'cb-ally-pane cb-ally-extra-pane';
            exPane.setAttribute('data-ally-id', exId);
            exPane.setAttribute('data-aidx', String(aIdx));
            if ((extraAlly.hp || 0) <= 0) exPane.classList.add('is-dead');
            const exElem = extraAlly.nextElement || extraAlly.elem || (extraAlly.elements && extraAlly.elements[0]) || 'ice';
            const exElemMeta = ALLY_ELEM_META[exElem];
            const exBadgeTxt = exElemMeta ? exElemMeta.badge : (ELEM_LABEL[exElem] || '协战');
            const exHp = extraAlly.hp != null ? extraAlly.hp : (extraAlly.mhp || 100);
            const exMhp = Math.max(1, extraAlly.mhp != null ? extraAlly.mhp : exHp);
            const exHpPct = Math.max(0, Math.min(100, (exHp / exMhp) * 100));
            const exShield = Math.max(0, extraAlly.shield || 0);
            const exMaxShield = Math.max(exShield, extraAlly.maxShield || 120);
            const exShPct = Math.max(0, Math.min(100, (exShield / Math.max(1, exMaxShield)) * 100));
            const exHasMp = extraAlly.mmp != null && extraAlly.mmp > 0;
            const exMp = exHasMp ? Math.max(0, extraAlly.mp != null ? extraAlly.mp : extraAlly.mmp) : 0;
            const exMpPct = exHasMp ? Math.max(0, Math.min(100, (exMp / Math.max(1, extraAlly.mmp)) * 100)) : 0;
            const exSecondBarHtml = exHasMp
              ? `
                <div class="cb-stat-row">
                  <div class="cb-stat-top"><span>魔力 MP</span><span class="cb-ally-mp-txt">${exMp}/${extraAlly.mmp}</span></div>
                  <div class="cb-stat-track"><div class="cb-stat-fill mp ally-mp" style="width:${exMpPct.toFixed(1)}%"></div></div>
                </div>`
              : `
                <div class="cb-stat-row">
                  <div class="cb-stat-top"><span>护壁</span><span class="cb-ally-shield-txt">${exShield}/${exMaxShield}</span></div>
                  <div class="cb-stat-track"><div class="cb-stat-fill shield ally-shield" style="width:${exShPct.toFixed(1)}%"></div></div>
                </div>`;
            const exDisplayName = isCompactParty ? shortPartyCardName(exName) : exName;
            const exRoleLabel = shortAllyRoleLabel(extraAlly.title, '同队协战');
            const exTitleAttr = String(exName).replace(/"/g, '&quot;');
            const exHpNumHtml = isCompactParty
              ? `<span class="cb-party-hp-num" title="HP ${exHp}/${exMhp}">${exHp}/${exMhp}</span>`
              : '';
            exPane.innerHTML = `
              <div class="cb-ally-header">
                <div class="cb-ally-title">
                  <div class="cb-ally-name" title="${exTitleAttr}">${exDisplayName}</div>
                  <div class="cb-ally-role">${exRoleLabel}</div>
                </div>
                ${exHpNumHtml}
                <span class="cb-ally-elem-badge elem-${exElem}" data-next-elem="${exElem}">${exBadgeTxt}</span>
              </div>
              <div class="cb-bars-wrap">
                <div class="cb-stat-row">
                  <div class="cb-stat-top"><span>生命值 HP</span><span class="cb-ally-hp-txt">${exHp}/${exMhp}${exHasMp && exShield > 0 ? ` (+盾${exShield})` : ''}</span></div>
                  <div class="cb-stat-track"><div class="cb-stat-fill hp ally-hp" style="width:${exHpPct.toFixed(1)}%"></div></div>
                </div>
                ${exSecondBarHtml}
              </div>
            `;
            partyPanes.appendChild(exPane);
          }
        }
      }
    } else {
      const oldV = document.getElementById('cb-ally-vanguard-slot');
      if (oldV && oldV.parentNode) oldV.remove();
      const oldPane = document.getElementById('cb-ally-pane');
      if (oldPane && oldPane.parentNode) oldPane.remove();
    }

    if (allyGrid) {
      allyGrid.querySelectorAll('.cb-ally-slot').forEach(slotEl => {
        const sIdx = Number(slotEl.getAttribute('data-slot'));
        const occ = occupiedAllySlots.has(sIdx);
        slotEl.classList.toggle('is-occupied', occ);
        slotEl.classList.toggle('is-empty', !occ);
      });
    }

    const pNameEl = document.getElementById('cb-p-name');
    if (pNameEl) {
      pNameEl.textContent = isCompactParty ? shortPartyCardName(p.name) : p.name;
      pNameEl.title = p.name || '';
    }
    document.getElementById('cb-p-sub').textContent = `物攻 ${p.atk} · 魔攻 ${p.matk} · 双抗 ${p.def}/${p.mdef}`;

    const pHeaderEl = pane ? pane.querySelector('.cb-p-header') : null;
    if (pHeaderEl) {
      let pHpNumEl = document.getElementById('cb-p-hp-num');
      if (isCompactParty) {
        if (!pHpNumEl) {
          pHpNumEl = document.createElement('span');
          pHpNumEl.id = 'cb-p-hp-num';
          pHpNumEl.className = 'cb-party-hp-num';
          const apRowEl = document.getElementById('cb-ap-row');
          if (apRowEl && apRowEl.parentNode === pHeaderEl) {
            pHeaderEl.insertBefore(pHpNumEl, apRowEl);
          } else {
            pHeaderEl.appendChild(pHpNumEl);
          }
        }
        pHpNumEl.textContent = `${p.hp}/${p.mhp}`;
        pHpNumEl.title = `HP ${p.hp}/${p.mhp}${p.shield > 0 ? ` (+盾${p.shield})` : ''}`;
      } else if (pHpNumEl && pHpNumEl.parentNode) {
        pHpNumEl.remove();
      }
    }

    let gemsHtml = '';
    for (let i = 0; i < b.apMax; i++) {
      gemsHtml += `<span class="cb-ap-gem${i < b.ap ? ' on' : ''}"></span>`;
    }
    gemsHtml += `<span class="cb-ap-label">AP ${b.ap}/${b.apMax}</span>`;
    document.getElementById('cb-ap-row').innerHTML = gemsHtml;

    document.getElementById('cb-php-txt').textContent = `${p.hp}/${p.mhp}${p.shield > 0 ? ` (+盾${p.shield})` : ''}`;
    document.getElementById('cb-php-bar').style.width = `${Math.max(0, Math.min(100, p.hp / p.mhp * 100))}%`;
    document.getElementById('cb-pmp-txt').textContent = `${p.mp}/${p.mmp}`;
    document.getElementById('cb-pmp-bar').style.width = `${Math.max(0, Math.min(100, p.mp / p.mmp * 100))}%`;

    const buffs = [];
    if (b.casualMode) buffs.push(`<span class="cb-buff-chip gold">✦ 休闲模式</span>`);
    if (b.oneMoreActive) buffs.push(`<span class="cb-buff-chip gold">✦ ONE MORE</span>`);
    if (p.shield > 0) buffs.push(`<span class="cb-buff-chip shield">${p.shieldKind === 'magic' ? '魔法盾' : '实体盾'} ${p.shield}/${p.maxShield}</span>`);
    if (p.status.fortress > 0) buffs.push(`<span class="cb-buff-chip shield">钢霜壁垒 -12%伤</span>`);
    if (p.status.mirrorRiposteWindow > 0) buffs.push(`<span class="cb-buff-chip gold">✦ 破镜反击就绪</span>`);
    if (p.status.frostPierce > 0) buffs.push(`<span class="cb-buff-chip">透冰破抗 25%</span>`);
    if (p.status.zeroMpThisTurn > 0) buffs.push(`<span class="cb-buff-chip gold">本回合零耗蓝</span>`);
    if (p.status.nobleReflect > 0) buffs.push(`<span class="cb-buff-chip gold">冰镜反震</span>`);
    if (b.frostFloorTurns > 0) buffs.push(`<span class="cb-buff-chip">地面薄冰(${b.frostFloorTurns})</span>`);
    if (p.status.rooted > 0) buffs.push(`<span class="cb-buff-chip">下盘生根</span>`);
    if (p.status.afterimage > 0) buffs.push(`<span class="cb-buff-chip">残像闪避×${p.status.afterimage}</span>`);
    if (p.status.lungeParry > 0) buffs.push(`<span class="cb-buff-chip">侧滑待反</span>`);
    if (p.status.poise > 0) buffs.push(`<span class="cb-buff-chip gold">剑势蓄力</span>`);
    if (p.passives.includes('temp_sense')) buffs.push(`<span class="cb-buff-chip">温度感知</span>`);
    if (p.passives.includes('mana_calc')) buffs.push(`<span class="cb-buff-chip">魔力精算-15%</span>`);
    if (p.passives.includes('root_ice')) buffs.push(`<span class="cb-buff-chip">生根之冰</span>`);
    if (p.passives.includes('frost_edge')) buffs.push(`<span class="cb-buff-chip">覆冰锋+5%</span>`);
    if (p.synergies && p.synergies.length) {
      p.synergies.forEach(syn => {
        const synDesc = String(syn.desc || syn.activeDesc || '').replace(/"/g, '&quot;');
        buffs.push(`<span class="cb-buff-chip synergy" title="【${syn.name}·${syn.tier || syn.count}件共鸣】${synDesc}">✦ ${syn.name}·${syn.tier || syn.count}件</span>`);
      });
    }
    if (p.equippedStaff === 'north_saint_staff') {
      const stArt = renderRelicMicroArt('north_saint_staff');
      const stLead = stArt || '✦ ';
      buffs.push(`<span class="cb-buff-chip relic staff-chip${stArt ? ' has-art' : ''}" title="【极北圣晶杖】魔导威力 +14% · 暴伤 +10% · 增幅额外耗蓝降低 10%">${stLead}<span class="cb-chip-label">极北圣晶杖</span></span>`);
    }
    if (p.relics && p.relics.length) {
      const api = getRelicsApi();
      const relMap = (api && (api.RELICS_CATALOG || api.RELICS)) || {};
      p.relics.forEach(rid => {
        const rm = relMap[rid];
        if (rm) {
          const microArt = renderRelicMicroArt(rid);
          const lead = microArt || '✦ ';
          buffs.push(`<span class="cb-buff-chip relic${microArt ? ' has-art' : ''}" title="${String(rm.effectText || '').replace(/"/g, '&quot;')}">${lead}<span class="cb-chip-label">${rm.name}</span></span>`);
        }
      });
    }
    if (p.status.blind > 0) buffs.push(`<span class="cb-buff-chip debuff">视线受阻×${p.status.blind}</span>`);
    if (p.status.burn > 0) buffs.push(`<span class="cb-buff-chip debuff">灼烧(${p.status.burn})</span>`);
    document.getElementById('cb-p-buffs').innerHTML = buffs.join('');

    const curAmpPct = syncPlayerAmpFromMode(p);
    const ampAllowed = canPlayerAmp(p);
    const maxAmpCap = getPlayerMaxAmpCap(p);
    const ocTitleEl = document.getElementById('cb-oc-title');
    if (ocTitleEl) {
      ocTitleEl.textContent = p.hasManaCycle ? '魔战循环 · 魔力增幅' : '魔力增幅';
    }
    root.querySelectorAll('#cb-oc-seg .cb-oc-btn').forEach(btn => {
      const ampVal = Number(btn.getAttribute('data-amp'));
      const m = btn.hasAttribute('data-oc') ? Number(btn.getAttribute('data-oc')) : -1;
      const exceedsCap = Number.isFinite(ampVal) && ampVal > maxAmpCap + 1e-6;
      btn.disabled = !ampAllowed || b.over || exceedsCap;
      const isAct = ampAllowed && !exceedsCap && (Number.isFinite(ampVal) ? Math.abs(curAmpPct - ampVal) < 0.005 : p.overcastMode === m);
      btn.classList.toggle('active', isAct);
    });
    const ocSliderEl = document.getElementById('cb-oc-slider');
    const ocPctEl = document.getElementById('cb-oc-pct');
    const pctInt = Math.round(curAmpPct * 100);
    if (ocSliderEl) {
      ocSliderEl.max = String(Math.max(20, Math.round(maxAmpCap * 100)));
      ocSliderEl.value = String(pctInt);
      ocSliderEl.disabled = !ampAllowed || b.over;
    }
    if (ocPctEl) {
      const tInfo = getAmpTierInfo(curAmpPct);
      const starPrefix = tInfo.tier >= 3 ? '★★★' : tInfo.tier >= 2 ? '★★' : tInfo.tier >= 1 ? '★' : '';
      ocPctEl.textContent = `${starPrefix}${pctInt}%`;
    }

    const primary = getPrimaryAliveEnemy(b);
    if (primary) {
      document.getElementById('b-emoji').textContent = primary.emoji || '';
      document.getElementById('b-ename').textContent = primary.name;
      document.getElementById('b-ehp').style.width = `${Math.max(0, primary.hp / primary.mhp * 100)}%`;
      document.getElementById('b-ehp-num').textContent = `${primary.hp}/${primary.mhp}`;
    }

    const showNextTendency = hasRelic(p, 'belmont_schedule');
    const isMultiEnemy = b.enemies.length > 1;
    const eZone = document.getElementById('cb-enemy-zone');
    eZone.classList.toggle('multi-enemies', isMultiEnemy);
    eZone.setAttribute('data-enemy-count', String(b.enemies.length));

    // 复用既有敌方像素精灵 DOM：严格核对 battleInstanceId 与 waveIdx，杜绝跨波次/重开串用残态精灵！
    const waveSig = `${b.battleInstanceId || 0}:${b.waveIdx || 0}`;
    const preservedEnemyActors = new Map();
    if (pxApi && eZone.dataset.waveSig === waveSig) {
      eZone.querySelectorAll('.cb-px-actor[data-actor-key]').forEach(el => {
        const aKey = el.getAttribute('data-actor-key');
        const spId = el.getAttribute('data-sprite-id');
        if (aKey && spId) {
          preservedEnemyActors.set(`${aKey}:${spId}`, el);
        }
      });
    }
    eZone.dataset.waveSig = waveSig;

    const enemySlotAssignments = resolveEnemyFormationSlots(b.enemies);
    const enemyBySlot = new Map();
    b.enemies.forEach((e, idx) => {
      const assignedSlot = enemySlotAssignments[idx];
      e.slot = assignedSlot;
      enemyBySlot.set(assignedSlot, { e, idx, slot: assignedSlot });
    });

    // CSS Grid 2列×3行（行优先流）：每行依次 [前排靠中场(0,1,2), 后排(3,4,5)]
    eZone.innerHTML = [0, 3, 1, 4, 2, 5].map(s => {
      const coords = getFormationSlotCoords('enemy', s);
      const entry = enemyBySlot.get(s);
      if (!entry) {
        return `<div class="cb-slot cb-enemy-slot is-empty" data-side="enemy" data-slot="${coords.slot}" data-row="${coords.row}" data-col="${coords.col}"><div class="cb-slot-pad"></div></div>`;
      }
      const { e, idx, slot } = entry;
      const intent = e.intent || { stance: 'STAGGERED', moveName: '已倒下', dmg: 0 };
      const sm = STANCE_META[intent.stance] || STANCE_META.HEAVY_WINDUP;
      const eImg = e.charId ? resolveCharImg(e.charId, 'normal', stageAge) : null;
      const crestKey = [e.crestKind, e.id, e.aiType, e.name].filter(Boolean).join(':');
      const isHeavyWarn = !!(e.hp > 0 && intent && (
        intent.heavyWarn ||
        intent.stance === 'HEAVY_WINDUP' ||
        intent.stance === 'UNDER_SEEP' ||
        intent.shatterPlayerShield ||
        (intent.dmg && intent.dmg >= 65)
      ));

      const nextLine = (showNextTendency && e.hp > 0)
        ? `<div class="ib-next-tendency cb-sr-only">✦ 下回合预判：${predictNextIntentTendency(e, b)}</div>`
        : '';

      const eVisual = renderEnemyVisualHTML({
        charImg: eImg,
        alt: e.name,
        monsterKeys: [e.id, e.aiType, e.crestKind],
        crestKey,
      });

      const shortMove = formatShortMoveName(intent.moveName);
      const dmgPillText = intent.dmg > 0
        ? (intent.shatterPlayerShield ? `预计 ${intent.dmg} · 破盾` : `预计 ${intent.dmg}`)
        : '失衡';
      const lockPipHtml = e.broken
        ? `<span class="cb-e-lock-pip is-broken" title="弱点击破">BREAK</span>`
        : (e.maxLocks > 0 && e.hp > 0
            ? `<span class="cb-e-lock-pip" title="破防锁">◆${e.locks != null ? e.locks : e.maxLocks}</span>`
            : '');
      const eHpPct = e.nonLethalSpar
        ? 100
        : Math.max(0, Math.min(100, (e.hp / Math.max(1, e.mhp)) * 100));

      const eSpriteId = pxApi ? pxApi.resolveEnemySpriteId(e) : null;
      const eActorKey = `enemy:${idx}`;
      const canReusePx = !!(pxApi && eSpriteId && preservedEnemyActors.has(`${eActorKey}:${eSpriteId}`));
      const eStageHtml = pxApi
        ? `<div class="cb-e-avatar has-px-actor" data-px-slot="${eActorKey}:${eSpriteId}">${canReusePx ? '' : pxApi.renderActorMarkup(eSpriteId, {
            actorKey: eActorKey,
            label: e.name,
            dead: e.hp <= 0,
            fallbackHtml: eVisual.html,
          })}</div>`
        : `<div class="cb-e-avatar${eVisual.isSvg ? ' is-svg' : ''}${eVisual.isCgPortrait ? ' is-cg-portrait' : ''}">${eVisual.html}</div>`;

      const safeEnemyFullName = String(e.name || '').replace(/"/g, '&quot;');
      const shortEnemyName = shortEnemyPlateName(e.name);

      return `
        <div class="cb-slot cb-enemy-slot is-occupied" data-side="enemy" data-slot="${coords.slot}" data-row="${coords.row}" data-col="${coords.col}">
          <div class="cb-slot-pad"></div>
          <article class="cb-enemy-card${idx === b.targetIdx ? ' targeted' : ''}${e.hp <= 0 ? ' dead' : ''}${intent.stance === 'STAGGERED' ? ' staggered' : ''}${isHeavyWarn ? ' intent-heavy-warn' : ''}${e.boss && (e.phase || 1) >= 2 ? ' phase2-boss' : ''}" data-eidx="${idx}" data-slot="${slot}">
            <div class="cb-e-stage${pxApi ? ' has-px-actor' : ''}">
              <div class="cb-magic-circle enemy" aria-hidden="true"></div>
              ${eStageHtml}
            </div>

            <div class="cb-e-plate">
              <span class="cb-hp-microtag" data-eidx="${idx}"></span>
              <div class="cb-e-micro-head">
                <span class="cb-lock-diamond" aria-hidden="true"></span>
                <span class="cb-e-title" title="${safeEnemyFullName}">${shortEnemyName}</span>
                ${lockPipHtml}
              </div>
              <div class="cb-stat-track">
                <div class="cb-stat-fill ehp" style="width:${eHpPct.toFixed(1)}%"></div>
                <div class="cb-ehp-preview cb-hp-preview" data-eidx="${idx}"></div>
              </div>
              <div class="cb-intent-banner stance-${intent.stance}" tabindex="0">
                <div class="ib-row">
                  <span class="ib-stance-tag">${sm.short}</span>
                  <span class="ib-move-name">${shortMove}</span>
                  <span class="ib-dmg-pill">${dmgPillText}</span>
                  <button type="button" class="ib-info-btn" aria-label="查看架势对策">i</button>
                </div>
                ${nextLine}
                <div class="cb-intent-tip" role="tooltip">
                  <div class="ib-tip-head">${sm.badge}</div>
                  <div class="ib-tip-move">招式：<b>${intent.moveName}</b></div>
                  <div class="ib-tip-hint">${sm.hint}</div>
                </div>
              </div>
            </div>
          </article>
        </div>
      `;
    }).join('');

    if (pxApi && preservedEnemyActors.size > 0) {
      b.enemies.forEach((e, idx) => {
        const eSpriteId = pxApi.resolveEnemySpriteId(e);
        const slotKey = `enemy:${idx}:${eSpriteId}`;
        const reused = preservedEnemyActors.get(slotKey);
        if (!reused) return;
        const slotEl = eZone.querySelector(`.cb-e-avatar[data-px-slot="${slotKey}"]`);
        if (slotEl) {
          reused.classList.toggle('is-dead', e.hp <= 0);
          slotEl.appendChild(reused);
        }
      });
    }

    renderTargetDetailPane(b);
    updateOvercastPreviewUI(b, hoveredSkillId);

    eZone.querySelectorAll('.ib-info-btn').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        const banner = btn.closest('.cb-intent-banner');
        if (!banner) return;
        const wasOpen = banner.classList.contains('tip-open');
        eZone.querySelectorAll('.cb-intent-banner.tip-open, .cb-trait-wrap.tip-open').forEach(el => el.classList.remove('tip-open'));
        const tdPaneEl = document.getElementById('cb-target-detail-pane');
        if (tdPaneEl) {
          tdPaneEl.querySelectorAll('.cb-trait-wrap.tip-open').forEach(el => el.classList.remove('tip-open'));
        }
        if (!wasOpen) banner.classList.add('tip-open');
      };
    });

    eZone.querySelectorAll('.cb-trait-pill').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        const wrap = btn.closest('.cb-trait-wrap');
        if (!wrap) return;
        const wasOpen = wrap.classList.contains('tip-open');
        eZone.querySelectorAll('.cb-intent-banner.tip-open, .cb-trait-wrap.tip-open').forEach(el => el.classList.remove('tip-open'));
        if (!wasOpen) wrap.classList.add('tip-open');
      };
    });

    eZone.querySelectorAll('.cb-enemy-card').forEach(card => {
      card.onclick = () => {
        const idx = Number(card.getAttribute('data-eidx'));
        if (b.enemies[idx] && b.enemies[idx].hp > 0) {
          selectTarget(idx, b);
        }
      };
    });

    const logEl = document.getElementById('b-log');
    if (logEl && !logEl.innerHTML && b.log.length) b._logDirty = true;
    flushCombatLogDOM(b);

    const actGrid = document.getElementById('b-actions');
    actGrid.classList.toggle('cards-compact', p.skills.length > 6);
    actGrid.classList.toggle('cols-5', p.skills.length >= 9);
    const targetStance = primary && primary.intent ? primary.intent.stance : '';
    const targetMoveKey = primary && primary.intent ? primary.intent.moveKey : '';
    const nextActHtml = p.skills.map((skId, slotIdx) => {
      const sk = TACTICAL_SKILLS[skId];
      if (!sk) return '';
      const pm = PATH_META[sk.path] || PATH_META.HAND;
      const apCost = computeSkillApCost(b, sk);
      const costMp = computeSkillMpCost(p, sk);
      const zeroMpFallback = !!(sk.allowZeroMpFallback && p.mp < costMp);
      const cd = p.cooldowns[skId] || 0;
      const usedUp = sk.maxUses && (p.usedMaxSkills[skId] || 0) >= sk.maxUses;
      const disabled = b.over || _actionInProgress || usedUp || cd > 0 || b.ap < apCost || (p.mp < costMp && !zeroMpFallback);
      const est = sk.power > 0 ? estimateSkillDamage(b, sk, primary) : null;
      const beatCnt = resolveSkillBeats(sk, b);
      const beatSpec = sk.beatSpec || SKILL_BEAT_SPEC_V32[sk.id] || null;
      const beatAttr = (beatSpec && beatSpec.beats === 'alive_enemies')
        ? '全敌拍'
        : (beatCnt <= 0 ? '瞬发' : (beatCnt >= 3 ? `${beatCnt}拍连击` : `${beatCnt}拍`));

      let oppBadge = '';
      if (!disabled && targetMoveKey === 'TEMPEST_VACUUM' && sk.counterLunge) {
        oppBadge = '<span class="cb-opp-pill">✦ 斩风瞬反</span>';
      } else if (!disabled && targetMoveKey === 'EYE_STILLNESS' && (sk.breakStillness || sk.counterLunge || (sk.interruptsHeavy && p.wandActive))) {
        oppBadge = '<span class="cb-opp-pill">✦ 破风眼静滞</span>';
      } else if (!disabled && sk.severSeep && primary && primary.aiType === 'noelle' && primary.seepTriggeredOnce && !primary.seepSevered) {
        oppBadge = '<span class="cb-opp-pill">✦ 冻绝暗流</span>';
      } else if (!disabled && sk.interruptsHeavy && targetStance === 'DUAL_CAST') {
        oppBadge = '<span class="cb-opp-pill">✦ 可截断</span>';
      } else if (!disabled && sk.counterLunge && targetStance === 'CLOSE_LUNGE') {
        oppBadge = '<span class="cb-opp-pill">✦ 迎击反斩</span>';
      } else if (!disabled && sk.line === 1 && p.status.mirrorRiposteWindow > 0 && primary && primary.aiType === 'aino') {
        oppBadge = '<span class="cb-opp-pill">✦ 破镜直击</span>';
      }

      let expHint = '';
      if (b.witnessActive) {
        let expVal = (sk.exposure || 0) + (!zeroMpFallback && isEclipseStaffForSkill(p, sk) ? 55 : 0);
        if (hasRelic(p, 'ebony_sword') && sk.path === 'SWORD') expVal = Math.min(0, expVal);
        expHint = expVal > 0
          ? `<span class="csc-exp-warn">暴露+${expVal}%</span>`
          : `<span class="csc-exp-safe">隐蔽安全</span>`;
      }

      const keyHint = slotIdx < 9 ? `<span class="cb-kbd">${slotIdx + 1}</span> ` : '';
      const pillPath = sk.lineLabel || pm.pill || pm.short.slice(0, 2);
      const isGuardCard = !!(sk.shieldBase || sk.afterimage || sk.layFrostFloor);
      const safeFullDesc = String(sk.desc || '').replace(/"/g, '&quot;');
      let shieldFoot = '';
      if (!est && sk.shieldBase > 0) {
        const sProf = computeAmpProfile(p, sk);
        const estSh = computeSkillShieldGain(p, sk, sProf);
        shieldFoot = `预计护盾 +${estSh}${sProf.shieldMult > 1.001 ? ` (${sProf.shieldMult.toFixed(2)}×)` : ''}`;
      }
      const costText = zeroMpFallback
        ? `AP ${apCost} · 零蓝导魔`
        : `AP ${apCost}${costMp > 0 ? ` · MP ${costMp}` : ''}`;
      const footText = usedUp
        ? '已使用'
        : cd > 0
          ? `冷却 ${cd} 回合`
          : zeroMpFallback
            ? `物理兜底 · 回蓝 +6%`
            : est
              ? (est.mirrorBlocked ? '将被镜冰格挡' : `预计 ~${est.dmg}${sk.aoe ? ' (全体)' : ''}`)
              : (shieldFoot || '战术护卫 / 身法');

      return `
        <button type="button" class="cb-skill-card path-${sk.path} elem-${sk.elem || 'phys'}${isGuardCard ? ' is-guard' : ''}${oppBadge ? ' opp-glow' : ''}${armedSkillId === sk.id ? ' is-armed' : ''}" data-sk="${sk.id}" data-beats="${beatAttr}" title="${safeFullDesc}" ${disabled ? 'disabled' : ''}>
          <div>
            <div class="csc-head">
              <span class="csc-path">${keyHint}${pillPath}</span>
              <span class="csc-cost">${costText}</span>
            </div>
            <div class="csc-name-row">
              <span class="csc-name">${sk.name}</span>
              ${oppBadge}
              <span class="cb-arm-pill">再点施放</span>
            </div>
            <div class="csc-desc">${sk.shortDesc || sk.desc}</div>
          </div>
          <div class="csc-foot">
            <span>${footText}</span>
            ${expHint}
          </div>
        </button>
      `;
    }).join('');
    if (actGrid._lastHtml !== nextActHtml || actGrid._lastBattleId !== (b.battleInstanceId || 0)) {
      actGrid._lastHtml = nextActHtml;
      actGrid._lastBattleId = b.battleInstanceId || 0;
      actGrid.innerHTML = nextActHtml;
      actGrid.querySelectorAll('.cb-skill-card').forEach(btn => {
        const sid = btn.getAttribute('data-sk');
        btn.onmouseenter = () => {
          hoveredSkillId = sid;
          if (activeBattle) updateOvercastPreviewUI(activeBattle, sid);
        };
        btn.onfocus = () => {
          hoveredSkillId = sid;
          if (activeBattle) updateOvercastPreviewUI(activeBattle, sid);
        };
        btn.onmouseleave = () => {
          hoveredSkillId = armedSkillId;
          if (activeBattle) updateOvercastPreviewUI(activeBattle, armedSkillId);
        };
        btn.onblur = () => {
          hoveredSkillId = armedSkillId;
          if (activeBattle) updateOvercastPreviewUI(activeBattle, armedSkillId);
        };
        btn.onclick = () => {
          if (btn.disabled || !activeBattle) return;
          if (isCoarseTouchDevice() && armedSkillId !== sid) {
            armedSkillId = sid;
            hoveredSkillId = sid;
            actGrid.querySelectorAll('.cb-skill-card.is-armed').forEach(el => el.classList.remove('is-armed'));
            btn.classList.add('is-armed');
            safeSfx('card_hover');
            updateOvercastPreviewUI(activeBattle, sid);
            return;
          }
          if (!isJsdomEnv()) {
            const now = Date.now();
            if (_lastSkillUiClick.id === sid && now - _lastSkillUiClick.ts < 140) return;
            _lastSkillUiClick = { id: sid, ts: now };
          }
          armedSkillId = null;
          useSkill(sid);
        };
      });
    }

    if (pxApi) {
      pxApi.syncStage(b);
      if (b._pendingHitPulses) b._pendingHitPulses.length = 0;
      if (b._pendingElementVFX) b._pendingElementVFX.length = 0;
      if (b._pendingPixelActions && b._pendingPixelActions.length) {
        const pxQueue = b._pendingPixelActions.slice();
        b._pendingPixelActions.length = 0;
        const turnBatch = [];
        pxQueue.forEach(act => {
          if (act.waveIdx !== (b.waveIdx || 0)) return;
          if (act.type === 'enemy_attack' || act.type === 'ally_action' || act.type === 'ally_guard') {
            turnBatch.push(act);
          } else if (act.type === 'skill') {
            pxApi.playSkillAction(b, act);
          } else if (act.type === 'wand_toggle') {
            pxApi.playWandToggle();
          } else if (act.type === 'staff_switch') {
            if (typeof pxApi.playStaffSwitch === 'function') pxApi.playStaffSwitch(act.staffId);
          } else if (act.type === 'system_fx') {
            if (typeof pxApi.playSystemFx === 'function') pxApi.playSystemFx(act.fxId, act);
          } else if (act.type === 'aino_spear') {
            pxApi.playAinoSpearSupport(act.enemyIdx);
          } else if (act.type === 'bond_assist') {
            pxApi.playBondAssist(act.charId);
          }
        });
        if (turnBatch.length) {
          if (typeof pxApi.playTurnSequence === 'function') {
            pxApi.playTurnSequence(b, turnBatch);
          } else {
            const allyActs = turnBatch.filter(a => a.type === 'ally_action');
            const allyGuards = turnBatch.filter(a => a.type === 'ally_guard');
            const enemyActs = turnBatch.filter(a => a.type === 'enemy_attack');
            allyActs.forEach(a => {
              if (typeof pxApi.playAllyAction === 'function') {
                pxApi.playAllyAction(b, a);
              } else if (typeof pxApi.playRenoSupport === 'function') {
                pxApi.playRenoSupport(a.element, { enemyIdx: a.targetIdx, tagText: a.label });
              }
            });
            const runEnemyHalf = () => {
              allyGuards.forEach(a => {
                if (typeof pxApi.playAllyGuard === 'function') {
                  pxApi.playAllyGuard(b, a);
                }
              });
              if (enemyActs.length) {
                pxApi.playEnemySequence(b, enemyActs);
              }
            };
            if (allyActs.length > 0 && (allyGuards.length > 0 || enemyActs.length > 0) && typeof global.setTimeout === 'function') {
              trackVfxTimer(() => {
                if (activeBattle === b && !b.headless && getPixelVfxApi()) {
                  runEnemyHalf();
                }
              }, 380);
            } else {
              runEnemyHalf();
            }
          }
        }
      }
    } else {
      if (b._pendingHitPulses && b._pendingHitPulses.length) {
        const pulses = b._pendingHitPulses.slice();
        b._pendingHitPulses.length = 0;
        pulses.forEach(pt => {
          const el = pt.side === 'player'
            ? document.getElementById('cb-p-portrait')
            : pt.side === 'ally'
              ? (document.getElementById('cb-ally-portrait') || document.getElementById('cb-ally-vanguard-slot'))
              : eZone.querySelector(`.cb-enemy-card[data-eidx="${pt.enemyIdx}"] .cb-e-avatar`);
          if (el) {
            el.classList.remove('cb-unit-hit');
            void el.offsetWidth;
            el.classList.add('cb-unit-hit');
            trackVfxTimer(() => el.classList.remove('cb-unit-hit'), 380);
          }
        });
      }

      if (b._pendingElementVFX && b._pendingElementVFX.length) {
        const vfxList = b._pendingElementVFX.slice();
        b._pendingElementVFX.length = 0;
        vfxList.forEach(item => {
          if (item.waveIdx !== (b.waveIdx || 0)) return;
          spawnCombatElementVFX(b, item.kind, {
            side: item.side,
            enemyIdx: item.enemyIdx,
            skipHitStop: item.skipHitStop,
          });
        });
      }
    }

    document.getElementById('cb-btn-endturn').disabled = b.over;

    emitCombatStateChange(b);
  }

  function openIcePalaceModal() {
    // 战斗内独立冰晶推演弹窗已退役，保留空壳以兼容外部旧调用
    return false;
  }

  function buildTacticalBreakdown(b) {
    const m = b.metrics || {};
    const p = b.player || {};
    const turns = b.turn || 1;
    const counters = (m.interrupts || 0) + (m.ripostes || 0);
    const perfects = (m.perfectRings || 0) + (m.perfectBlocks || 0);
    const manaRecycled = m.manaRecycled || 0;
    const isCrateStage = b.crateHp != null;
    const integrityLabel = isCrateStage ? '药箱完整度' : '护盾与生命完整度';
    const integrityPct = isCrateStage
      ? Math.max(0, Math.min(100, Math.round((b.crateHp / Math.max(1, b.crateMax || 120)) * 100)))
      : Math.max(0, Math.min(100, Math.round(((p.hp + Math.round((p.shield || 0) * 0.5)) / Math.max(1, p.mhp || 1)) * 100)));
    const tier = b.won ? (b.grade || 'B') : 'F';
    const tierLabelMap = { S: 'S 级 · 完美破局', A: 'A 级 · 稳健制胜', B: 'B 级 · 险中求胜', F: '失利 · 战术待修' };
    const tierLabel = tierLabelMap[tier] || '战术复盘';

    const parts = [];
    if (!b.won) {
      if (b.stageCfg && b.stageCfg.sealRule) {
        parts.push('罗文的晦轮黑光与飞旋掷杖会绕过前排雷纳德直袭后排；面对偷袭回合务必立起冰墙自保，配合雷纳德压制与蔓地薄冰即可稳妥合围活捉。');
      } else if (b.endReason === 'crate_destroyed') {
        parts.push('医疗药箱在持续冲撞下失守；面对蓄力撞箱回合应将钢冰护幕增幅至二阶钢霜壁垒协防，并以星霜冰柱或裂流斩截断蓄势、累积艾诺共鸣。');
      } else if (b.endReason === 'exposed') {
        parts.push('耳目近在咫尺之际魔力外显过高，招致巡查逼近；第二波多以魔剑基础、寒锋斩与冰晶射收束魔力痕迹。');
      } else if (b.endReason === 'enemy_three_hits') {
        parts.push('正面硬攻屡遭镜壁反刺丢分；可立起镜霜壁反震破开镜壁，或在艾诺寒脉蓄势时出折射冰棱直接截断抢分。');
      } else if (m.phase2Triggered) {
        parts.push('已成功逼出敌将倾力变阵，终盘却在高压杀招下受挫；变阵后须把握觉醒空档补盾留行动点，以截断或寒锋迎击化解杀招。');
      } else {
        parts.push(`本场完成 ${counters} 次破招反制，正面承受了过多蓄力重击；紧盯敌方意图横幅、善用缩圈与格挡即可扭转局面。`);
      }
    } else {
      if (tier === 'S') {
        parts.push(m.phase2Triggered
          ? `直面敌将倾力变阵的高压攻势仍于 ${turns} 回合内干脆定局，攻防节拍严丝合缝。`
          : `全战仅耗 ${turns} 回合便彻底瓦解敌阵，节奏掌控老练果决。`);
      } else if (tier === 'A') {
        parts.push(`历时 ${turns} 回合稳健取胜，危招应对得当，仍有压缩回合与提速收尾的余地。`);
      } else {
        parts.push(`耗时 ${turns} 回合艰难过关，中盘承压略重；若更早抢占截断与破锁窗口，战损会显著收敛。`);
      }

      if (counters >= 2) {
        parts.push(`累计达成 ${counters} 次破招与迎击反制，精准掐断敌方发力链条。`);
      } else if (m.manaFizzleWin) {
        parts.push('以霜息步法封锁风步、榨干对手魔力池令狂岚自行溃散，凭借谋略轻松制敌。');
      } else if (tier === 'S') {
        parts.push(counters === 1
          ? '关键节点一击破招直入要害，以干脆高效的攻势节奏速战速决。'
          : '凭借凌厉的攻势压制与五线术式轮转抢先定局，未给对手留下反扑余地。');
      } else {
        parts.push(`主动反制偏少（${counters} 次），多针对重术蓄势与贴身突袭切换克制术式可再提一层上限。`);
      }

      if (perfects >= 2) {
        parts.push(`精准缩圈与格挡 PERFECT 累计触发 ${perfects} 次，出招手感与临场判断俱佳。`);
      }
      if (p.hasManaCycle && manaRecycled >= 120) {
        parts.push(`魔战循环合计回流 ${manaRecycled} MP，魔力增幅爆发衔接极为流畅。`);
      }
      if (b.casualMode) {
        parts.push('本场以休闲模式完成演练，随时可切回标准难度冲刺纯血战绩。');
      }

      if (isCrateStage) {
        parts.push(integrityPct >= 80
          ? `医疗药箱完整度守在 ${integrityPct}%，前线补给线固若金汤。`
          : `药箱完整度滑落至 ${integrityPct}%，护箱回合的钢霜壁垒与破招衔接仍有补强空间。`);
      } else if (integrityPct < 45) {
        parts.push(`终盘防线完整度仅余 ${integrityPct}%，面对高伤蓄力宜多借钢冰护幕或风行残像化解。`);
      }
    }

    return {
      turns,
      counters,
      perfects,
      manaRecycled,
      integrityLabel,
      integrityPct,
      tier,
      tierLabel,
      commentary: parts.join(''),
    };
  }

  function showResultModal(b) {
    if (typeof document === 'undefined') return;
    const slot = document.getElementById('cb-modal-slot');
    if (!slot) return;
    const rew = b.stageCfg.reward || {};
    const tb = buildTacticalBreakdown(b);
    const showRiposteRow = (b.metrics && b.metrics.ripostes > 0) ||
      !!(b.player && Array.isArray(b.player.skills) && b.player.skills.some(sid => {
        const sk = TACTICAL_SKILLS[sid];
        return sk && sk.counterLunge;
      }));
    const showManaRecycleRow = !!(b.player && b.player.hasManaCycle) || tb.manaRecycled > 0;
    const canRetryBossWave = !!(!b.won && b.waveIdx > 0 && b.stageCfg && b.stageCfg.bossWaveRetry && b._bossWaveSnapshot);
    const warnHtml = b.exposureWarningTriggered
      ? `<div class="cr-warn-box">${CB_SVG.warn} <b>行踪暴露代价触发：</b>耳目附近的外显冰系/晦轮杖波动已被「极光」小队察觉，「北林哑巴幽灵」传闻发酵，本次评级封顶为 B！</div>`
      : '';

    let rewardText = '';
    if (b.won) {
      if (b.fromArena) {
        rewardText = '独立演武梦境挑战完成！战绩已记入演武榜（演武梦境不改写旅途历练与行囊）。';
      } else {
        rewardText = `获得实战收益：${rew.skillName ? `习得「<b>${rew.skillName}</b>」 · ` : ''}经验 +${rew.exp || 30}${rew.gold ? ` · 银币 +${rew.gold}` : ''}`;
      }
    } else {
      rewardText = (b.stageCfg && b.stageCfg.sealRule)
        ? '战术提示：雷纳德顶在前排主攻，留意罗文偷袭黑光与飞旋掷杖回合立起冰墙自保！'
        : '战术提示：紧盯敌方架势预告，灵活搭配增幅破锁、霜域控场与空格格挡！';
    }

    const gradeKey = b.won ? (b.grade || 'B') : 'F';
    const stageAge = (b.fromArena && b.stageCfg && b.stageCfg.preset && b.stageCfg.preset.age) || null;
    const isVol3Disguise = VOL3_DISGUISE_STAGES.has(b.id) || (b.player && b.player.name && b.player.name.includes('眷寒渔'));
    const sylviaResImg = resolveCharImg('sylvia', b.won ? 'smile' : 'serious', stageAge, { disguise: isVol3Disguise });
    const sylviaAlt = (b.player && b.player.name) ? b.player.name : '希尔维亚';
    const retryLabel = b.fromArena ? '1 秒再战 [R]' : '再次挑战';
    const casualChecked = isCasualMode() ? 'checked' : '';
    slot.innerHTML = `
      <div class="cb-result-modal" id="cb-result-modal">
        <div class="cb-result-card${b.won ? ' is-victory' : ' is-defeat'}">
          <div class="cr-head">
            <div class="cr-head-left">
              ${sylviaResImg ? `<div class="cr-portrait-badge ${b.won ? 'is-win' : 'is-loss'}"><img src="${sylviaResImg}" alt="${sylviaAlt}"/></div>` : ''}
              <div class="cr-head-copy">
                <span class="cr-status-badge ${b.won ? 'is-win' : 'is-loss'}">${b.won ? '战术制胜' : '战局失利'}${b.casualMode ? ' · 休闲' : ''}</span>
                <h2 class="cr-title">${b.stageCfg.title}</h2>
              </div>
            </div>
            <div class="cr-grade grade-${gradeKey}">${b.won ? b.grade : '败'}</div>
          </div>
          <div class="cr-body">
            <div class="cr-tactical-breakdown tier-${tb.tier}">
              <div class="crtb-head">
                <span class="crtb-title">战术复盘拆解</span>
                <span class="crtb-tier-pill tier-${tb.tier}">${tb.tierLabel}</span>
              </div>
              <div class="crtb-grid">
                <div class="crtb-cell"><span>总回合数</span><b>${tb.turns} 回合</b></div>
                <div class="crtb-cell"><span>截断破招</span><b>${b.metrics.interrupts || 0} 次</b></div>
                ${showRiposteRow ? `<div class="crtb-cell"><span>迎击闪反</span><b>${b.metrics.ripostes || 0} 次</b></div>` : ''}
                <div class="crtb-cell"><span>PERFECT 触发</span><b>${tb.perfects} 次</b></div>
                ${showManaRecycleRow ? `<div class="crtb-cell"><span>${b.player && b.player.hasManaCycle ? '魔战回蓝' : '魔力回流'}</span><b>+${tb.manaRecycled} MP</b></div>` : ''}
                <div class="crtb-cell"><span>${tb.integrityLabel}</span><b>${tb.integrityPct}%</b></div>
              </div>
              <div class="crtb-commentary">${tb.commentary}</div>
            </div>
            ${warnHtml}
            <p class="cr-reward-note">${rewardText}</p>
            <label class="cr-casual-row" style="display:flex;align-items:center;gap:8px;margin:8px 0 4px;padding-top:8px;border-top:1px solid rgba(22,88,235,0.12);font-size:12.5px;color:#475569;cursor:pointer;user-select:none;">
              <input type="checkbox" id="cr-casual-checkbox" ${casualChecked} style="accent-color:#1658eb;width:15px;height:15px;cursor:pointer;" />
              <span>休闲模式（敌方血盾减三成 · 来袭伤害减四成 · 回合末额外回蓝 · 缩圈免负）</span>
            </label>
            <div class="end-btns">
              ${canRetryBossWave ? '<button type="button" class="tbtn" id="cr-retry-boss">从首领波重开</button>' : ''}
              <button type="button" class="tbtn ghost" id="cr-retry">${retryLabel}</button>
              <button type="button" class="tbtn" id="cr-done">确认返回</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const casualCb = slot.querySelector('#cr-casual-checkbox');
    if (casualCb) {
      casualCb.onchange = () => {
        setCasualMode(!!casualCb.checked);
        safeSfx('tab_switch');
      };
    }
    const retryBossBtn = slot.querySelector('#cr-retry-boss');
    if (retryBossBtn) {
      retryBossBtn.onclick = () => {
        slot.innerHTML = '';
        safeSfx('open');
        startFromBossWaveSnapshot(b);
      };
    }
    slot.querySelector('#cr-retry').onclick = () => {
      slot.innerHTML = '';
      safeSfx('open');
      if (STAGE_CONFIGS[b.id]) {
        startStage(b.id, { fromArena: b.fromArena, fullRestore: !!(b.fromArena || b.fullRestore), done: b.done });
      } else {
        startCustomOrStageBattle(b._customCfg || {}, b.done);
      }
    };
    const doneBtn = slot.querySelector('#cr-done');
    doneBtn.onclick = () => {
      slot.innerHTML = '';
      safeSfx('modal_close');
      exitBattle(b.won);
    };
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }

  function exitBattle(won, opts) {
    opts = opts || {};
    const b = activeBattle;
    cancelTimingRing('exit');
    _actionInProgress = false;
    if (typeof window !== 'undefined' && window.VoiceEngine && typeof window.VoiceEngine.stop === 'function') {
      try { window.VoiceEngine.stop({ reason: 'battle_exit' }); } catch (e) {}
    }
    activeBattle = null;
    hoveredSkillId = null;
    armedSkillId = null;
    _lastEndTurnUiTs = 0;
    _lastSkillUiClick = { id: '', ts: 0 };
    if (typeof global.B !== 'undefined') global.B = null;
    clearAllJuiceVfx();
    if (typeof document === 'undefined') return;

    const slot = document.getElementById('cb-modal-slot');
    if (slot) slot.innerHTML = '';
    const callout = document.getElementById('cb-callout-layer');
    if (callout) callout.innerHTML = '';
    const actGrid = document.getElementById('b-actions');
    if (actGrid) {
      actGrid._lastHtml = '';
      actGrid._lastBattleId = 0;
    }
    const eZone = document.getElementById('cb-enemy-zone');
    if (eZone) delete eZone.dataset.waveSig;
    const tdPane = document.getElementById('cb-target-detail-pane');
    if (tdPane) {
      tdPane.innerHTML = '';
      tdPane.classList.add('is-empty');
      tdPane.classList.remove('is-broken', 'is-phase2');
      tdPane.removeAttribute('data-eidx');
    }
    const pPort = document.getElementById('cb-p-portrait');
    if (pPort) pPort.innerHTML = '';
    const allySlot = document.getElementById('cb-ally-vanguard-slot');
    if (allySlot && allySlot.parentNode) allySlot.remove();
    const allyPane = document.getElementById('cb-ally-pane');
    if (allyPane && allyPane.parentNode) allyPane.remove();
    document.querySelectorAll('#battle-screen .cb-ally-extra-slot, #battle-screen .cb-ally-extra-pane').forEach(el => {
      if (el && el.parentNode) el.remove();
    });
    const pHpNum = document.getElementById('cb-p-hp-num');
    if (pHpNum && pHpNum.parentNode) pHpNum.remove();
    const partyPanes = document.getElementById('cb-party-panes');
    if (partyPanes) {
      partyPanes.setAttribute('data-party-layout', '1-2');
      partyPanes.setAttribute('data-party-count', '1');
    }
    const pStage = document.getElementById('cb-player-stage');
    if (pStage) pStage.classList.remove('has-vanguard-ally');
    const bs = document.getElementById('battle-screen');
    if (bs) {
      bs.classList.add('hidden');
      bs.classList.remove('palace-timestop', 'wand-refract', 'hit-shake', 'heavy-shake');
    }
    if (document.body) document.body.classList.remove('cb-battle-active');
    const ds = document.getElementById('duel-screen');
    if (ds) ds.classList.add('hidden');
    emitCombatStateChange(null);

    if (opts.silent) {
      const ao = document.getElementById('arena-overlay');
      if (ao) ao.classList.add('hidden');
      return;
    }

    if (b && b.fromArena) {
      if (arenaReturnToTitle) {
        if (typeof global.setBG === 'function') global.setBG('bg-title');
      } else {
        const curS = getGameS();
        if (curS && curS.freeRoam && typeof global.updateLocBar === 'function') global.updateLocBar();
      }
      openArenaHub({ fromTitle: arenaReturnToTitle });
      return;
    }

    const titleElNow = document.getElementById('title-screen');
    if (arenaReturnToTitle && titleElNow && !titleElNow.classList.contains('hidden')) {
      if (typeof global.bgmPlayTitle === 'function') global.bgmPlayTitle({ fade: true });
      return;
    }

    if (typeof global.bgmEndBattle === 'function') global.bgmEndBattle();
    const curS = getGameS();
    if (curS && curS.freeRoam && typeof global.updateLocBar === 'function') {
      global.updateLocBar();
    }

    if (b && typeof b.done === 'function') {
      b.done(won);
      return;
    }
    if (curS && curS.freeRoam && typeof global.enterFreeRoam === 'function') {
      global.enterFreeRoam();
    }
  }

  /* =========================================================
     9. ⚔️ 战术演武场独立梦境大厅
     ========================================================= */
  function openArenaHub(opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return;
    if (typeof window !== 'undefined' && typeof window.closeHudMoreDrawer === 'function') window.closeHudMoreDrawer();
    const titleScr = document.getElementById('title-screen');
    if (opts.fromTitle !== undefined) {
      arenaReturnToTitle = !!opts.fromTitle;
    } else {
      arenaReturnToTitle = !!(titleScr && !titleScr.classList.contains('hidden'));
    }
    if (arenaReturnToTitle) arenaUseSaveStats = false;

    const ov = document.getElementById('arena-overlay');
    if (!ov) return;
    const records = loadArenaRecords();
    const list = Object.values(STAGE_CONFIGS).sort((a, b) => a.order - b.order);
    const api = getRelicsApi();
    const loadoutBarHtml = (!arenaUseSaveStats && api && api.renderArenaLoadoutBarHTML) ? api.renderArenaLoadoutBarHTML() : '';

    ov.innerHTML = `
      <div class="arena-hub-card">
        <div class="arena-hub-head">
          <div class="arena-head-top">
            <div class="arena-title-row">
              <div class="arena-title-crest" aria-hidden="true">${CB_SVG.swords}</div>
              <div class="arena-title-copy">
                <h2 class="arena-hub-title">战术演武场 · 九幕智斗试炼</h2>
                <p class="arena-hub-sub">循历年足迹再现 ${list.length} 场名战幻境 · 独立演武梦境（不改写旅途历练与行囊）</p>
              </div>
            </div>
            <button type="button" class="arena-close-x" id="am-close" title="关闭演武大厅" aria-label="关闭演武大厅">${CB_SVG.close}</button>
          </div>
          <div class="arena-mode-bar">
            <span class="arena-sandbox-pill">${CB_SVG.shield} 独立梦境演武 · 不涉主途历程</span>
            <div class="arena-mode-group">
              <button type="button" class="arena-mode-chip${!arenaUseSaveStats ? ' active' : ''}" id="am-preset">${CB_SVG.scale} 当时境况仪装</button>
              <button type="button" class="arena-mode-chip${arenaUseSaveStats ? ' active' : ''}" id="am-save" ${arenaReturnToTitle ? 'disabled title="开始旅程或读取存档后，可用当前存档属性出战试演"' : ''}>${CB_SVG.chart} ${arenaReturnToTitle ? '存档出战（需先开始旅程）' : '当前存档属性试演'}</button>
            </div>
          </div>
        </div>
        <div class="arena-scroll-body">
          ${loadoutBarHtml}
          <div class="arena-stage-grid" id="arena-stage-grid">
            ${list.map(st => {
              const rec = records[st.id];
              const stageAge = (st.preset && st.preset.age) || 14;
              const img = st.charId ? resolveCharImg(st.charId, 'normal', stageAge) : null;
              const crestKey = st.crestKind || (st.id === 'north_forest_hunt' ? 'wolf_alpha' : st.id);
              const lastWave = st.waves && st.waves[st.waves.length - 1];
              const leadEn = lastWave && lastWave.enemies && (lastWave.enemies.find(en => en.boss) || lastWave.enemies[0]);
              const stageVisual = renderEnemyVisualHTML({
                charImg: img,
                alt: st.title,
                monsterKeys: [st.id, st.crestKind, leadEn && leadEn.id, leadEn && leadEn.aiType],
                crestKey,
              });
              const isBossTrial = !!(st.waves && st.waves.some(w => (w.enemies || []).some(en => en.boss)));
              const caseNum = String(st.order).padStart(2, '0');
              return `
                <button type="button" class="arena-stage-card${isBossTrial ? ' is-boss-trial' : ''}" data-stage="${st.id}">
                  <div>
                    <div class="asc-dossier-bar">
                      <span class="asc-case-no">ACT ${caseNum}</span>
                      <span class="asc-dossier-chap">${st.chapter}</span>
                      ${st.godTierChallenge || st.arenaTestOnly ? '<span class="asc-boss-seal">演武专属 · 神级试炼</span>' : (isBossTrial ? '<span class="asc-boss-seal">强敌 · 决战</span>' : '')}
                    </div>
                    <div class="asc-top">
                      <div class="asc-avatar${stageVisual.isSvg ? ' is-svg' : ''}${stageVisual.isCgPortrait ? ' is-cg-portrait' : ''}">${stageVisual.html}</div>
                      <div class="asc-meta">
                        <div class="asc-name">${st.title}</div>
                        <div class="asc-stars">难度 ${st.stars}</div>
                      </div>
                      <div class="asc-rank-badge ${rec ? 'rank-' + rec.grade : 'is-unplayed'}">${rec ? rec.grade : '未挑战'}</div>
                    </div>
                    <div class="asc-tags">
                      ${st.tags.map(t => `<span class="asc-tag${t.includes('禁') || t.includes('失败') || t.includes('绕过') || t.includes('变阵') || t.includes('风暴眼') ? ' warn' : ''}">${t}</span>`).join('')}
                    </div>
                    <div class="asc-desc">${st.summary}</div>
                  </div>
                  <div class="asc-foot">
                    <span>${rec ? `最佳记录：${rec.grade} 级（${rec.turns} 回合${rec.casualMode ? ' · 休闲' : ''}）` : '尚未通关'}</span>
                    <span class="asc-go">开始演武 ▸</span>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    ov.classList.remove('hidden');
    if (!opts._silentOpen) {
      safeSfx('modal_open');
      if (typeof global.bgmUnlock === 'function') global.bgmUnlock();
      if (typeof global.bgmEnterArenaHub === 'function') global.bgmEnterArenaHub();
      else if (typeof global.bgmPlayType === 'function') global.bgmPlayType('duel', { force: false, key: 'duel2' });
    }

    ov.querySelector('#am-preset').onclick = () => {
      arenaUseSaveStats = false;
      safeSfx('tab_switch');
      openArenaHub({ fromTitle: arenaReturnToTitle, _silentOpen: true });
    };
    ov.querySelector('#am-save').onclick = () => {
      if (arenaReturnToTitle) return;
      arenaUseSaveStats = true;
      safeSfx('tab_switch');
      openArenaHub({ fromTitle: false, _silentOpen: true });
    };
    ov.querySelector('#am-close').onclick = () => closeArenaHub();
    const openLoadoutBtn = ov.querySelector('#am-open-loadout');
    if (openLoadoutBtn && api && api.openArenaLoadoutModal) {
      openLoadoutBtn.onclick = () => api.openArenaLoadoutModal(() => openArenaHub({ fromTitle: arenaReturnToTitle, _silentOpen: true }));
    }
    const clearLoadoutBtn = ov.querySelector('#am-clear-loadout');
    if (clearLoadoutBtn && api) {
      clearLoadoutBtn.onclick = () => {
        if (api.setArenaSandboxStaff) api.setArenaSandboxStaff('none');
        if (api.setArenaSandboxRelics) api.setArenaSandboxRelics([]);
        if (api.setArenaSandboxAssist) api.setArenaSandboxAssist(null);
        safeSfx('tab_switch');
        openArenaHub({ fromTitle: arenaReturnToTitle, _silentOpen: true });
      };
    }
    ov.querySelectorAll('[data-stage]').forEach(btn => {
      btn.onclick = () => {
        const sid = btn.getAttribute('data-stage');
        safeSfx('open');
        ov.classList.add('hidden');
        startStage(sid, { fromArena: true, fullRestore: true });
      };
    });
  }

  function closeArenaHub() {
    if (typeof document === 'undefined') return;
    const ov = document.getElementById('arena-overlay');
    const wasVisible = !!(ov && !ov.classList.contains('hidden'));
    if (ov) ov.classList.add('hidden');
    if (wasVisible) safeSfx('modal_close');
    if (arenaReturnToTitle) {
      if (typeof global.setBG === 'function') global.setBG('bg-title');
      const ts = document.getElementById('title-screen');
      if (ts) ts.classList.remove('hidden');
      if (typeof global.bgmLeaveArenaHub === 'function') global.bgmLeaveArenaHub(true);
      else if (typeof global.bgmPlayTitle === 'function') global.bgmPlayTitle({ fade: true });
    } else if (wasVisible) {
      if (typeof global.bgmLeaveArenaHub === 'function') global.bgmLeaveArenaHub(false);
      else if (typeof global.bgmRestoreContext === 'function') global.bgmRestoreContext();
    }
  }

  /* =========================================================
     10. 启动入口、主线虚拟决斗门控与无头仿真器
     ========================================================= */
  function closeGlobalModalsBeforeBattle() {
    if (typeof document === 'undefined') return;
    try {
      if (typeof global.closeHudMoreDrawer === 'function') global.closeHudMoreDrawer();
    } catch (e) {}
    try {
      const aiEl = document.getElementById('ai-drawer');
      if (aiEl && !aiEl.classList.contains('hidden') && global.AIChatPanel && typeof global.AIChatPanel.closeDrawer === 'function') {
        global.AIChatPanel.closeDrawer();
      }
    } catch (e) {}
    const modalIds = [
      'panel',
      'vn-saveload-modal',
      'vn-prefs-modal',
      'vn-backlog-modal',
      'vn-chapters-modal',
      'rumor-overlay',
      'shop-overlay',
      'map-overlay',
      'codex',
      'help-screen',
      'ai-drawer',
      'arena-loadout-modal',
    ];
    modalIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.classList) el.classList.add('hidden');
    });
    if (document.body && document.body.classList) {
      document.body.classList.remove('ai-drawer-open');
    }
  }

  function resetBattleDomForStart(bs) {
    _lastEndTurnUiTs = 0;
    _lastSkillUiClick = { id: '', ts: 0 };
    closeGlobalModalsBeforeBattle();
    if (!bs) return;
    const slot = bs.querySelector('#cb-modal-slot');
    if (slot) slot.innerHTML = '';
    const callout = bs.querySelector('#cb-callout-layer');
    if (callout) callout.innerHTML = '';
    const actGrid = bs.querySelector('#b-actions');
    if (actGrid) {
      actGrid._lastHtml = '';
      actGrid._lastBattleId = 0;
    }
    const eZone = bs.querySelector('#cb-enemy-zone');
    if (eZone) delete eZone.dataset.waveSig;
    const tdPane = bs.querySelector('#cb-target-detail-pane');
    if (tdPane) {
      tdPane.innerHTML = '';
      tdPane.classList.add('is-empty');
      tdPane.classList.remove('is-broken', 'is-phase2');
      tdPane.removeAttribute('data-eidx');
    }
    const pPort = bs.querySelector('#cb-p-portrait');
    if (pPort) pPort.innerHTML = '';
    const allySlot = bs.querySelector('#cb-ally-vanguard-slot');
    if (allySlot && allySlot.parentNode) allySlot.remove();
    const allyPane = bs.querySelector('#cb-ally-pane');
    if (allyPane && allyPane.parentNode) allyPane.remove();
    bs.querySelectorAll('.cb-ally-extra-slot, .cb-ally-extra-pane').forEach(el => {
      if (el && el.parentNode) el.remove();
    });
    const pHpNum = bs.querySelector('#cb-p-hp-num');
    if (pHpNum && pHpNum.parentNode) pHpNum.remove();
    const partyPanes = bs.querySelector('#cb-party-panes');
    if (partyPanes) {
      partyPanes.setAttribute('data-party-layout', '1-2');
      partyPanes.setAttribute('data-party-count', '1');
    }
    const pStage = bs.querySelector('#cb-player-stage');
    if (pStage) pStage.classList.remove('has-vanguard-ally');
    const ao = document.getElementById('arena-overlay');
    if (ao) ao.classList.add('hidden');
    const cardEl = typeof document !== 'undefined' ? document.getElementById('card') : null;
    if (cardEl && cardEl.classList) cardEl.classList.add('hidden');
    bs.classList.remove('palace-timestop', 'wand-refract', 'hit-shake', 'heavy-shake', 'hidden');
  }

  function ensureBattleBgmOnStart(bgmType, preferKey, b) {
    if (typeof global.bgmUnlock === 'function') global.bgmUnlock();
    const targetType = bgmType || 'battle';
    const targetKey = preferKey || (targetType === 'duel' ? 'duel1' : null);
    const st = (typeof global.bgmGetState === 'function') ? global.bgmGetState() : null;

    const syncBattleBgmState = () => {
      if (!b) return;
      const stAfter = (typeof global.bgmGetState === 'function') ? global.bgmGetState() : null;
      if (stAfter && stAfter.key) {
        b.bgmKey = stAfter.key;
        if (stAfter.type) b.bgmType = stAfter.type;
      } else {
        b.bgmType = targetType;
        if (targetKey) b.bgmKey = targetKey;
      }
    };

    if (targetType === 'duel') {
      const alreadyTargetDuel = !!(st && st.type === 'duel' && (!targetKey || st.key === targetKey) && !st.paused);
      if (alreadyTargetDuel) {
        syncBattleBgmState();
        return;
      }
      if (typeof global.bgmPlayType === 'function') {
        // 演武大厅播 duel2 时进切磋关可流畅切至 duel1；若已在播 duel1 且未暂停则上方已提前返回
        global.bgmPlayType('duel', { force: true, fade: true, key: targetKey });
      } else if (typeof global.bgmPlay === 'function' && targetKey) {
        global.bgmPlay(targetKey, { fade: true, type: 'duel' });
      }
      syncBattleBgmState();
      return;
    }

    if (typeof global.bgmPlayType !== 'function') {
      syncBattleBgmState();
      return;
    }
    const alreadyBattlePlaying = !!(st && st.type === targetType && st.key && !st.paused && (!targetKey || st.key === targetKey));
    if (alreadyBattlePlaying) {
      global.bgmPlayType(targetType, { force: false });
    } else {
      global.bgmPlayType(targetType, { force: true, key: targetKey || undefined });
    }
    syncBattleBgmState();
  }

  function startStage(stageId, opts) {
    opts = opts || {};
    const sc = STAGE_CONFIGS[stageId];
    if (!sc) return null;

    cancelTimingRing('restart');
    _actionInProgress = false;
    const b = createBattleState(sc, opts);
    activeBattle = b;
    hoveredSkillId = null;
    armedSkillId = null;
    if (typeof global !== 'undefined') global.B = b;

    if (!b.headless && typeof document !== 'undefined') {
      clearAllJuiceVfx();
      closeGlobalModalsBeforeBattle();
      const ds = document.getElementById('duel-screen');
      if (ds) ds.classList.add('hidden');
      if (typeof global.setBG === 'function') global.setBG(sc.bg || 'bg-battle');
      const stageBgmType = b.bgmType || sc.bgmType || 'battle';
      const stageBgmKey = b.bgmKey || sc.bgmKey || (stageBgmType === 'duel' ? 'duel1' : null);
      ensureBattleBgmOnStart(stageBgmType, stageBgmKey, b);
      const bs = ensureBattleDOM();
      resetBattleDomForStart(bs);
      if (document.body) document.body.classList.add('cb-battle-active');
      renderCombatUI();
      const stageIntroVoiceMap = {
        beatrice_11:     { cueKey: 'boss_beatrice_intro',  charId: 'beatrice' },
        rowan_graveyard: { cueKey: 'reno_graveyard_start', charId: 'reno' },
        alice_9:         { cueKey: 'boss_alice_intro',     charId: 'alice' },
        aino_sparring:   { cueKey: 'boss_aino_intro',      charId: 'aino' },
        wind_god_eye:    { cueKey: 'boss_fengshen_intro',  charId: 'fengshen' },
      };
      const introVoice = stageIntroVoiceMap[b.id];
      if (introVoice) {
        emitCombatVoiceCue(b, introVoice.cueKey, { stageId: b.id, waveIdx: 0, charId: introVoice.charId, fallbackCueKey: `stage_start_${b.id}` });
      } else {
        emitCombatVoiceCue(b, `stage_start_${b.id}`, { stageId: b.id, waveIdx: 0, charId: 'sylvia' });
      }
    }
    return b;
  }

  function startFromBossWaveSnapshot(snapshotOrBattle, opts) {
    opts = opts || {};
    const snap = (snapshotOrBattle && snapshotOrBattle._bossWaveSnapshot)
      ? snapshotOrBattle._bossWaveSnapshot
      : snapshotOrBattle;
    if (!snap || !snap.stageId || !STAGE_CONFIGS[snap.stageId]) return null;
    const sc = STAGE_CONFIGS[snap.stageId];
    const targetWave = Number(snap.waveIdx) || 1;
    if (!sc.waves || !sc.waves[targetWave]) return null;

    cancelTimingRing('boss_wave_retry');
    _actionInProgress = false;

    const inheritedDone = opts.done !== undefined
      ? opts.done
      : ((snapshotOrBattle && snapshotOrBattle._bossWaveDone) || (snapshotOrBattle && snapshotOrBattle.done) || null);
    const casual = opts.casualMode !== undefined ? !!opts.casualMode : isCasualMode();
    const b = createBattleState(sc, {
      fromArena: !!snap.fromArena,
      fullRestore: !!snap.fullRestore,
      usePreset: snap.usePreset,
      headless: !!opts.headless,
      casualMode: casual,
      done: inheritedDone,
    });

    if (snap.player) {
      const restoredP = clonePlainData(snap.player);
      restoredP.hp = Math.min(restoredP.mhp, Math.max(restoredP.hp || 1, Math.round(restoredP.mhp * 0.80)));
      restoredP.mp = Math.min(restoredP.mmp, Math.max(restoredP.mp || 0, Math.round(restoredP.mmp * 0.80)));
      restoredP.status = Object.assign({}, restoredP.status || {});
      delete restoredP.status.blind;
      delete restoredP.status.burn;
      restoredP.cooldowns = {};
      restoredP.av = 0;
      b.player = restoredP;
    }
    if (Array.isArray(snap.allies)) {
      b.allies = clonePlainData(snap.allies);
    }
    b.turn = Math.max(1, Number(snap.turn) || 1);
    b.naturalTurnCount = Math.max(1, Number(snap.naturalTurnCount) || b.turn);
    b.ainoResonance = Number(snap.ainoResonance) || 0;
    b.exposure = Number(snap.exposure) || 0;
    b.witnessActive = !!snap.witnessActive;
    b.ap = b.apMax;
    b.log = [];

    initWave(b, targetWave, { skipWaveBgm: true });

    // 对齐快照时点的药箱与护盾，避免重复叠加跨波回复
    if (snap.crateHp != null) {
      b.crateHp = snap.crateHp;
      if (snap.crateMax != null) b.crateMax = snap.crateMax;
    }
    if (snap.player) {
      b.player.shield = snap.player.shield || 0;
      b.player.shieldKind = snap.player.shieldKind || 'solid';
    }
    b._bossWaveSnapshot = clonePlainData(snap);
    b._bossWaveDone = inheritedDone;
    pushLog(b, logTag('cbl-star', '↺ 已从首领波检查点重新部署，直接再战首领！', true));
    syncDerivedBattleState(b);

    activeBattle = b;
    hoveredSkillId = null;
    armedSkillId = null;
    if (typeof global !== 'undefined') global.B = b;

    if (!b.headless && typeof document !== 'undefined') {
      clearAllJuiceVfx();
      closeGlobalModalsBeforeBattle();
      const ds = document.getElementById('duel-screen');
      if (ds) ds.classList.add('hidden');
      if (typeof global.setBG === 'function') global.setBG(sc.bg || 'bg-battle');
      const stageBgmType = b.bgmType || sc.bgmType || 'battle';
      const stageBgmKey = b.bgmKey || sc.bgmKey || (stageBgmType === 'duel' ? 'duel1' : null);
      ensureBattleBgmOnStart(stageBgmType, stageBgmKey, b);
      const bs = ensureBattleDOM();
      resetBattleDomForStart(bs);
      if (document.body) document.body.classList.add('cb-battle-active');
      renderCombatUI();
    }
    return b;
  }

  function startCustomOrStageBattle(cfg, done) {
    cfg = cfg || {};
    cancelTimingRing('restart');
    _actionInProgress = false;
    closeGlobalModalsBeforeBattle();
    if (cfg.stageId && STAGE_CONFIGS[cfg.stageId]) {
      return startStage(cfg.stageId, {
        done,
        fromArena: !!cfg.fromArena,
        usePreset: !!cfg.usePreset,
        fullRestore: !!cfg.fullRestore,
        bgmType: cfg.bgmType,
      });
    }
    const tplMap = getEnemyTplMap() || {};
    const tplKey = cfg.tpl || 'encounter';
    const t = tplMap[cfg.tpl] || cfg;
    const curS = getGameS();
    const lv = (curS && curS.lv) || 10;
    const scale = cfg.scale || 1;
    const customStage = {
      id: 'custom_' + tplKey,
      order: 99,
      title: `${t.name || '魔物'} · 遭遇战`,
      chapter: '野外实战',
      stars: '★★☆☆☆',
      emoji: t.emoji || '🐺',
      bg: cfg.bg || 'bg-battle',
      bgmType: cfg.bgmType || 'battle',
      tags: ['架势博弈'],
      summary: t.desc || '野外魔物遭遇。',
      reward: { exp: t.exp || 30, gold: t.gold || 6 },
      waves: [
        {
          intro: `${t.name || '魔物'}拦住了去路！留意其架势预告徽章。`,
          enemies: [
            {
              id: tplKey,
              crestKind: cfg.crestKind || tplKey,
              name: t.name || '魔物',
              emoji: t.emoji || '🐺',
              elem: t.elem || 'wind',
              hp: Math.max(70, Math.round(((t.hp || 55) + lv * 2) * scale)),
              mhp: Math.max(70, Math.round(((t.hp || 55) + lv * 2) * scale)),
              atk: Math.max(20, Math.round(((t.atk || 14) + lv * 0.6) * scale)),
              def: t.def || 5,
              mdef: t.mdef || 5,
              spd: t.spd || 96,
              maxLocks: t.maxLocks || 3,
              trait: t.desc || '留意重术蓄势空档与贴身扑击。',
              aiType: cfg.aiType || 'generic',
            },
          ],
        },
      ],
    };
    const b = createBattleState(customStage, { done, usePreset: false, fromArena: false });
    b._customCfg = cfg;
    activeBattle = b;
    hoveredSkillId = null;
    armedSkillId = null;
    global.B = b;
    clearAllJuiceVfx();
    const ds = typeof document !== 'undefined' ? document.getElementById('duel-screen') : null;
    if (ds) ds.classList.add('hidden');
    if (typeof global.setBG === 'function') global.setBG(customStage.bg || 'bg-battle');
    const customBgmType = b.bgmType || customStage.bgmType || 'battle';
    const customBgmKey = b.bgmKey || customStage.bgmKey || (customBgmType === 'duel' ? 'duel1' : null);
    ensureBattleBgmOnStart(customBgmType, customBgmKey, b);
    const bs = ensureBattleDOM();
    resetBattleDomForStart(bs);
    if (typeof document !== 'undefined' && document.body) document.body.classList.add('cb-battle-active');
    renderCombatUI();
    emitCombatVoiceCue(b, `stage_start_${b.id}`, { stageId: b.id, waveIdx: 0, charId: 'sylvia' });
    return b;
  }

  function getActionQueue(b, count) {
    if (typeof b === 'number') {
      count = b;
      b = activeBattle;
    }
    b = b || activeBattle;
    if (!b || !b.player) return [];
    const total = Math.max(1, Math.min(16, Number(count) || 8));
    const p = b.player;
    const pBaseAv = p.baseAv || computeBaseAv(p.spd || 100);
    const units = [
      {
        id: 'player',
        side: 'player',
        allyIdx: -1,
        enemyIdx: -1,
        name: p.name || '希尔维亚',
        charId: 'sylvia',
        spd: p.spd || 100,
        baseAv: pBaseAv,
        simAv: b.oneMoreActive ? 0 : Math.max(0, Number(p.av) || 0),
        isOneMore: !!b.oneMoreActive,
        broken: false,
      },
    ];
    (b.allies || []).forEach((a, idx) => {
      if (!a || a.hp <= 0) return;
      const aBaseAv = a.baseAv || computeBaseAv(a.spd || 110);
      units.push({
        id: a.id || `ally_${idx}`,
        side: 'ally',
        allyIdx: idx,
        enemyIdx: -1,
        name: a.name,
        charId: a.id || null,
        spriteId: a.spriteId || a.id || 'reno',
        spd: a.spd || 110,
        baseAv: aBaseAv,
        simAv: Math.max(1, Number(a.av) || Math.round(aBaseAv * 0.25)),
        isOneMore: false,
        broken: false,
        nextElement: a.nextElement || (a.elements && a.elements[0]) || 'earth',
      });
    });
    (b.enemies || []).forEach((e, idx) => {
      if (!e || e.hp <= 0) return;
      const eBaseAv = e.baseAv || computeBaseAv(e.spd || 95);
      units.push({
        id: e.id || `enemy_${idx}`,
        side: 'enemy',
        allyIdx: -1,
        enemyIdx: idx,
        name: e.name,
        charId: e.charId || null,
        spd: e.spd || 95,
        baseAv: eBaseAv,
        simAv: Math.max(1, Number(e.av) || eBaseAv),
        isOneMore: false,
        broken: !!e.broken,
        locks: e.locks != null ? e.locks : (e.maxLocks || 0),
        maxLocks: e.maxLocks || 0,
        intentStance: e.intent ? e.intent.stance : 'HEAVY_WINDUP',
      });
    });

    const sideRank = s => (s === 'player' ? 0 : s === 'ally' ? 1 : 2);
    const queue = [];
    let cumAv = 0;
    for (let step = 0; step < total && units.length > 0; step++) {
      let best = units[0];
      for (let i = 1; i < units.length; i++) {
        const u = units[i];
        if (u.simAv < best.simAv || (u.simAv === best.simAv && sideRank(u.side) < sideRank(best.side))) {
          best = u;
        }
      }
      const delta = Math.max(0, best.simAv);
      cumAv += delta;
      units.forEach(u => { u.simAv = Math.max(0, u.simAv - delta); });
      queue.push({
        order: step,
        id: best.id,
        side: best.side,
        allyIdx: best.allyIdx != null ? best.allyIdx : -1,
        enemyIdx: best.enemyIdx,
        name: best.name,
        charId: best.charId,
        spriteId: best.spriteId || null,
        av: Math.round(cumAv),
        deltaAv: Math.round(delta),
        spd: best.spd,
        baseAv: best.baseAv,
        isOneMore: step === 0 && best.side === 'player' && best.isOneMore,
        broken: best.broken,
        locks: best.locks,
        maxLocks: best.maxLocks,
        intentStance: best.intentStance || null,
        nextElement: best.nextElement || null,
      });
      best.simAv = best.baseAv;
      best.isOneMore = false;
    }
    return queue;
  }

  function getBattleState(b) {
    b = b || activeBattle;
    if (!b || !b.player) return null;
    ensureValidTarget(b);
    const p = b.player;
    const derived = computeDerivedAmpState(p);
    const staffDef = getEquippedStaffDef(p);
    const primary = getPrimaryAliveEnemy(b);
    const hasAllies = Array.isArray(b.allies) && b.allies.length > 0;
    const playerSlot = hasAllies ? 1 : 4;
    const enemySlotMap = resolveEnemyFormationSlots(b.enemies);
    return {
      id: b.id,
      activeActor: (b.activeActor && typeof b.activeActor === 'object')
        ? Object.assign({ actorKey: 'player', id: 'sylvia', side: 'ally', slot: playerSlot }, b.activeActor)
        : { actorKey: 'player', id: 'sylvia', side: 'ally', slot: playerSlot },
      battleItems: Array.isArray(b.battleItems) ? b.battleItems.slice() : [],
      battleInstanceId: b.battleInstanceId || 0,
      bgmType: b.bgmType || (b.stageCfg && b.stageCfg.bgmType) || 'battle',
      bgmKey: b.bgmKey || null,
      title: b.stageCfg ? b.stageCfg.title : '',
      chapter: b.stageCfg ? b.stageCfg.chapter : '',
      turn: b.turn,
      naturalTurnCount: b.naturalTurnCount || b.turn,
      waveIdx: b.waveIdx,
      waveTurn: b.waveTurn,
      totalWaves: b.totalWaves,
      ap: b.ap,
      apMax: b.apMax,
      over: b.over,
      won: b.won,
      grade: b.grade,
      endReason: b.endReason || '',
      targetIdx: b.targetIdx,
      casualMode: !!b.casualMode,
      assistMode: getAssistMode(),
      timingBusy: !!(b._timingBusy || _actionInProgress),
      _asyncPhaseActive: !!b._asyncPhaseActive,
      isEnemyTurn: !!b.isEnemyTurn,
      bossWaveRetryAvailable: !!(b.waveIdx > 0 && b.stageCfg && b.stageCfg.bossWaveRetry && b._bossWaveSnapshot),
      oneMoreActive: !!b.oneMoreActive,
      oneMoreUsedThisTurn: !!b.oneMoreUsedThisTurn,
      overcastPct: derived.overcastPct,
      overcastMode: derived.overcastMode,
      ampPct: derived.ampPct,
      ampTier: derived.ampTier,
      ampTierName: derived.ampTierName,
      ampMult: derived.ampMult,
      ampTierMults: derived.ampTierMults.slice(),
      ampDefPierce: derived.ampDefPierce,
      ampExtraLocks: derived.ampExtraLocks,
      ampShieldMult: derived.ampShieldMult,
      ampTiers: derived.ampTiers.slice(),
      ampDiscountFactor: derived.ampDiscountFactor,
      ampExtraMp: derived.ampExtraMp,
      ampTierExtraMps: derived.ampTierExtraMps.slice(),
      maxAmpCap: derived.maxAmpCap,
      canAmp: derived.canAmp,
      recentLogs: (b.log || []).slice(-14),
      player: {
        name: p.name,
        rank: p.rank || 2,
        slot: hasAllies ? 1 : 4,
        hp: p.hp,
        mhp: p.mhp,
        mp: p.mp,
        mmp: p.mmp,
        shield: p.shield,
        maxShield: p.maxShield,
        shieldKind: p.shieldKind || 'solid',
        atk: p.atk,
        matk: p.matk,
        def: p.def,
        mdef: p.mdef,
        spd: p.spd || 100,
        av: p.av || 0,
        baseAv: p.baseAv || computeBaseAv(p.spd || 100),
        hasManaCycle: !!p.hasManaCycle,
        canAmp: derived.canAmp,
        canManaAmp: derived.canAmp,
        overcastPct: derived.overcastPct,
        overcastMode: derived.overcastMode,
        ampPct: derived.ampPct,
        ampTier: derived.ampTier,
        ampTierName: derived.ampTierName,
        ampMult: derived.ampMult,
        ampTierMults: derived.ampTierMults.slice(),
        ampDefPierce: derived.ampDefPierce,
        ampExtraLocks: derived.ampExtraLocks,
        ampShieldMult: derived.ampShieldMult,
        ampTiers: derived.ampTiers.slice(),
        ampDiscountFactor: derived.ampDiscountFactor,
        ampExtraMp: derived.ampExtraMp,
        ampTierExtraMps: derived.ampTierExtraMps.slice(),
        maxAmpCap: derived.maxAmpCap,
        hasEclipseWand: !!p.hasEclipseWand,
        wandActive: !!p.wandActive,
        wandPersistent: !!p.wandPersistent,
        wandCooldown: p.wandCooldown || 0,
        equippedStaff: p.equippedStaff || (p.wandActive ? 'eclipse_wand' : 'none'),
        staffName: staffDef.name,
        canTriggerEclipse: false,
        palaceLeft: 0,
        palaceMax: 0,
        palaceReady: false,
        bondAssist: p.bondAssist || null,
        bondAssistUsed: !!p.bondAssistUsed,
        status: Object.assign({}, p.status),
        cooldowns: Object.assign({}, p.cooldowns),
        skills: (p.skills || []).map(skId => {
          const sk = TACTICAL_SKILLS[skId];
          if (!sk) return null;
          const apCost = computeSkillApCost(b, sk);
          const mpCost = computeSkillMpCost(p, sk);
          const zeroMpFallback = !!(sk.allowZeroMpFallback && p.mp < mpCost);
          const cd = p.cooldowns[skId] || 0;
          const usedUp = !!(sk.maxUses && (p.usedMaxSkills[skId] || 0) >= sk.maxUses);
          const canUse = !b.over && !_actionInProgress && !usedUp && cd === 0 && b.ap >= apCost && (p.mp >= mpCost || zeroMpFallback);
          const forecast = primary ? computeTacticalForecast(b, sk, primary) : null;
          const beatSpec = sk.beatSpec || SKILL_BEAT_SPEC_V32[sk.id] || null;
          return {
            id: sk.id,
            name: sk.name,
            path: sk.path,
            line: sk.line || 0,
            lineLabel: sk.lineLabel || '',
            tier: sk.tier || 1,
            elem: sk.elem,
            apCost,
            mpCost,
            cooldown: cd,
            usedUp,
            allowZeroMpFallback: !!sk.allowZeroMpFallback,
            zeroMpFallback,
            canUse,
            beats: resolveSkillBeats(sk, b),
            beatSpec,
            keyRule: beatSpec ? beatSpec.keyRule : '',
            voiceCue: resolveSkillVoiceCue(sk.id),
            overcastCap: getSkillOvercastCap(sk),
            lockDamage: forecast ? forecast.lockDamage : getSkillBaseLockDamage(sk),
            forecast,
          };
        }).filter(Boolean),
      },
      allies: (b.allies || []).map((a, idx) => ({
        idx,
        id: a.id || `ally_${idx}`,
        name: a.name,
        title: a.title || '',
        spriteId: a.spriteId || a.id || 'reno',
        role: a.role || 'vanguard',
        slot: Number.isInteger(a.slot) ? a.slot : 4,
        rank: a.rank || 4,
        hp: a.hp,
        mhp: a.mhp,
        atk: a.atk,
        matk: a.matk,
        def: a.def,
        mdef: a.mdef,
        spd: a.spd || 110,
        av: a.av || 0,
        baseAv: a.baseAv || computeBaseAv(a.spd || 110),
        shield: a.shield || 0,
        maxShield: a.maxShield || 160,
        shieldKind: a.shieldKind || 'solid',
        tauntFront: !!a.tauntFront,
        coverPlayerMitigate: a.coverPlayerMitigate || 0,
        elements: Array.isArray(a.elements) ? a.elements.slice() : ['earth'],
        nextElement: a.nextElement || (a.elements && a.elements[0]) || 'earth',
        totalDmgDealt: a.totalDmgDealt || 0,
        actionsTaken: a.actionsTaken || 0,
        alive: a.hp > 0,
        status: Object.assign({}, a.status),
      })),
      enemies: (b.enemies || []).map((e, idx) => ({
        idx,
        slot: Number.isInteger(e.slot) ? e.slot : enemySlotMap[idx],
        id: e.id || `enemy_${idx}`,
        name: e.name,
        charId: e.charId || null,
        rank: e.rank || 2,
        noBlockPrompt: !!e.noBlockPrompt,
        hp: e.hp,
        mhp: e.mhp,
        mp: e.mp,
        mmp: e.mmp,
        shield: e.shield || 0,
        shieldKind: e.shieldKind || 'magic',
        solidArmor: e.solidArmor || 0,
        elem: e.elem,
        atk: e.atk,
        def: e.def,
        mdef: e.mdef,
        spd: e.spd || 95,
        av: e.av || 0,
        baseAv: e.baseAv || computeBaseAv(e.spd || 95),
        locks: e.locks != null ? e.locks : (e.maxLocks || 0),
        maxLocks: e.maxLocks || 0,
        broken: !!e.broken,
        boss: !!e.boss,
        phase: e.phase || 1,
        evadeCharges: e.evadeCharges || 0,
        fireAura: e.fireAura || 0,
        flawToken: e.flawToken || 0,
        targeted: idx === b.targetIdx,
        alive: e.hp > 0,
        status: Object.assign({}, e.status),
        intent: e.intent ? Object.assign({}, e.intent) : null,
      })),
      actionQueue: getActionQueue(b, 8),
      meters: {
        playerHits: b.playerHits || 0,
        enemyHits: b.enemyHits || 0,
        sealProgress: b.sealProgress || 0,
        frostFloorTurns: b.frostFloorTurns || 0,
        exposure: b.exposure || 0,
        witnessActive: !!b.witnessActive,
        crateHp: b.crateHp,
        crateMax: b.crateMax,
        ainoResonance: b.ainoResonance || 0,
      },
      metrics: Object.assign({}, b.metrics),
      balance: COMBAT_BALANCE_V32,
    };
  }

  function useSkillById(skillId, targetIdx, b) {
    return useSkill(skillId, targetIdx, b);
  }

  function useBattleItem(itemId, targetIdx, b) {
    b = b || activeBattle;
    if (!b || b.over) return { ok: false, reason: 'over' };
    return {
      ok: false,
      reason: 'not_implemented',
      itemId: itemId || null,
      targetIdx: targetIdx != null ? targetIdx : null,
    };
  }

  function mapCharToStageId(charId) {
    if (charId === 'beatrice') return 'beatrice_11';
    if (charId === 'alice') return 'alice_9';
    if (charId === 'aino') return 'aino_sparring';
    if (charId === 'noelle') return 'noelle_14';
    return null;
  }

  function simulateBattle(stageId, policyFn, opts) {
    opts = opts || {};
    const maxTurns = opts.maxTurns || 26;
    const b = startStage(stageId, {
      headless: true,
      usePreset: opts.usePreset !== false,
      fromArena: true,
      relics: opts.relics,
      staff: opts.staff,
      bondAssist: opts.bondAssist,
      forceCrit: opts.forceCrit,
      casualMode: opts.casualMode,
    });
    let safety = 0;
    while (!b.over && b.turn <= maxTurns && safety++ < 400) {
      const action = policyFn(b, CombatEngine);
      if (!action || action.type === 'endTurn') {
        endTurn(b);
      } else if (action.type === 'palace') {
        endTurn(b);
      } else if (action.type === 'overcast') {
        setOvercast(action.mode, b);
      } else if (action.type === 'amp') {
        setOvercastPct(action.pct, b);
      } else if (action.type === 'wand' || action.type === 'eclipse') {
        const okWand = toggleEclipseWand(action.on, b);
        if (action.on && !okWand) {
          b._wandSkipTurn = b.turn;
        }
      } else if (action.type === 'assist') {
        const aRes = useBondAssist(b);
        if (!aRes.ok) {
          endTurn(b);
        }
      } else if (action.type === 'skill') {
        const res = useSkill(action.skillId, action.targetIdx, b);
        if (!res.ok) {
          endTurn(b);
        }
      } else {
        endTurn(b);
      }
    }
    if (!b.over) {
      finishBattle(b, false, 'timeout');
    }
    activeBattle = null;
    return {
      won: b.won,
      grade: b.grade,
      turns: b.turn,
      endReason: b.endReason,
      casualMode: !!b.casualMode,
      playerHits: b.playerHits,
      enemyHits: b.enemyHits,
      sealProgress: b.sealProgress,
      exposure: b.exposure,
      exposureWarned: b.exposureWarningTriggered,
      crateHp: b.crateHp,
      hpRemaining: b.player.hp,
      mpRemaining: b.player.mp,
      metrics: Object.assign({}, b.metrics),
      log: b.log.slice(),
    };
  }

  const CombatEngine = {
    COMBAT_BALANCE_V32,
    COMBAT_BALANCE_V22,
    SKILL_BEAT_SPEC_V32,
    SKILL_VOICE_CUE_MAP,
    resolveSkillVoiceCue,
    computeBlockRate,
    isCasualMode,
    setCasualMode,
    getAssistMode,
    setAssistMode,
    startFromBossWaveSnapshot,
    shouldRunAsyncTiming,
    AMP_TIERS: AMP_TIERS.slice(),
    STAGES: STAGE_CONFIGS,
    SKILLS: TACTICAL_SKILLS,
    PATH_META,
    STANCE_META,
    openArenaHub,
    closeArenaHub,
    openIcePalaceModal,
    showResultModal,
    startStage,
    startBattle: startCustomOrStageBattle,
    getAmpTiers,
    setOvercastPct,
    setOvercast,
    cycleOvercast,
    setAmpPct,
    cycleAmpStep,
    setEquippedStaff,
    selectTarget,
    toggleEclipseWand,
    useBondAssist,
    isPalaceReady,
    inspectClue,
    useSkill,
    useSkillById,
    useBattleItem,
    endTurn,
    exitBattle,
    simulateBattle,
    triggerBossPhase2,
    renderBeastCrestSVG,
    MONSTER_ART_FILES,
    resolveMonsterArtUrl,
    renderEnemyVisualHTML,
    resolveActiveSynergies,
    buildTacticalBreakdown,
    computeSkillApCost,
    computeSkillMpCost,
    computeManaCycleMultiplier,
    computeAmpProfile,
    estimateSkillDamage,
    computeTacticalForecast,
    predictNextIntentTendency,
    getCurrentPalaceConfig,
    addCombatTrauma,
    spawnCombatElementVFX,
    triggerScreenShake,
    syncHoverEnemyGlow,
    getActionQueue,
    getBattleState,
    getState: () => activeBattle,
    loadArenaRecords,
  };

  global.CombatEngine = CombatEngine;
  global.openArenaHub = openArenaHub;
  global.startBattle = startCustomOrStageBattle;

  // 故事内虚拟决斗：保留正篇「已习得 virtual_duel 且了解度 >= 90%」门控
  global.openDuelMenu = function () {
    const curS = getGameS();
    if (!curS || !(curS.skills || []).includes('virtual_duel')) {
      if (typeof global.toast === 'function') global.toast('尚未掌握「虚拟决斗」（可点右上角 ⚔️ 进入独立战术演武场）');
      return false;
    }
    const cMap = getCharMap() || {};
    const ready = Object.keys(curS.know || {}).filter(id => (curS.know[id] || 0) >= 90);
    if (!ready.length) {
      if (typeof global.toast === 'function') global.toast('尚无了解度≥90%的可挑战对象');
      return false;
    }
    const choices = ready.map(id => ({
      text: `梦中挑战 ${cMap[id]?.short || id}（了解度 ${curS.know[id]}%）`,
      do: () => global.runDuel(id),
    }));
    choices.push({ text: '暂不决斗', do: () => { if (typeof global.enterFreeRoam === 'function') global.enterFreeRoam(); } });
    if (typeof global.playLines === 'function') {
      global.playLines([{ text: '意识沉入梦境虚空，要挑战哪位对手？', choices }]);
    }
    return true;
  };

  global.runDuel = function (charId) {
    const mapped = mapCharToStageId(charId);
    if (mapped) {
      startStage(mapped, {
        fromArena: false,
        usePreset: false,
        fullRestore: true,
        bgmType: 'duel',
        done: () => {
          const curS = getGameS();
          if (curS && curS.freeRoam && typeof global.enterFreeRoam === 'function') {
            global.enterFreeRoam();
          }
        },
      });
      return;
    }
    const cMap = getCharMap();
    const ch = (cMap && cMap[charId]) || { name: charId };
    startCustomOrStageBattle({
      name: ch.name,
      emoji: '⚔️',
      elem: 'water',
      bg: 'bg-duel',
      bgmType: 'duel',
      hp: 210,
      atk: 34,
      def: 10,
      mdef: 12,
      exp: 45,
      gold: 0,
      desc: '梦境重构的对手投影。',
    }, () => {
      const curS = getGameS();
      if (curS && curS.freeRoam && typeof global.enterFreeRoam === 'function') {
        global.enterFreeRoam();
      }
    });
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('combat:prefschange', ev => {
      const det = (ev && ev.detail) || {};
      if (det.source === 'combat-engine') return;
      if (det.assistMode != null) _assistModeMem = normalizeAssistMode(det.assistMode);
      if (det.casualMode != null) _casualModeMem = normalizeCasualBool(det.casualMode);
      syncAssistModeBtn();
      if (typeof document !== 'undefined') {
        const cb = document.getElementById('cr-casual-checkbox');
        if (cb && det.casualMode != null) cb.checked = !!det.casualMode;
      }
      if (activeBattle && !activeBattle.headless) emitCombatStateChange(activeBattle);
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      TRAUMA_STATE.lastTs = 0;
    });

    const bindButtons = () => {
      const btnTitle = document.getElementById('btn-arena-title');
      if (btnTitle) btnTitle.onclick = () => openArenaHub({ fromTitle: true });
      const btnHud = document.getElementById('btn-arena');
      if (btnHud) btnHud.onclick = () => openArenaHub({ fromTitle: false });
    };
    bindButtons();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindButtons);
    }

    const HIGHER_OVERLAY_IDS = [
      'cg-lightbox', 'sys-popup', 'arena-loadout-modal', 'vn-prefs-modal',
      'vn-backlog-modal', 'vn-saveload-modal', 'vn-chapters-modal',
      'ice-deduction-modal', 'rumor-overlay', 'panel', 'codex',
      'stats-overlay', 'ai-drawer', 'help-screen', 'map-overlay', 'backlog-overlay',
    ];

    // 键盘系统：缩圈激活时完全让渡键盘；放行焦点按钮原生 Enter/Space；支持 1~9 / W / R / E / F / X 战术热键与结算 1 秒再战 [R]
    document.addEventListener('keydown', e => {
      if (global.CombatTimingRing && typeof global.CombatTimingRing.isActive === 'function' && global.CombatTimingRing.isActive()) return;
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const hasHigherOverlay = HIGHER_OVERLAY_IDS.some(id => {
        const el = document.getElementById(id);
        return !!(el && !el.classList.contains('hidden') && el.style.display !== 'none');
      });
      if (hasHigherOverlay) return;

      const bs = document.getElementById('battle-screen');
      const ao = document.getElementById('arena-overlay');
      const battleVis = bs && !bs.classList.contains('hidden');
      const arenaVis = ao && !ao.classList.contains('hidden');
      if (!battleVis && !arenaVis) return;

      const tgt = e.target;
      const isInteractiveEl = tgt && tgt.closest && tgt.closest('button, a, input, select, textarea, [tabindex]');

      if (e.key === 'Escape') {
        const rm = document.getElementById('cb-result-modal');
        if (rm && rm.parentNode) {
          rm.parentNode.innerHTML = '';
          safeSfx('modal_close');
          exitBattle(activeBattle ? activeBattle.won : false);
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
          return;
        }
        if (arenaVis && !battleVis) {
          closeArenaHub();
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
          return;
        }
      }

      // 结算弹窗开启时按 R 触发 1 秒再战
      const resModal = document.getElementById('cb-result-modal');
      if (battleVis && resModal) {
        const rk = String(e.key || '').toLowerCase();
        if (rk === 'r' && (!tgt || !tgt.closest || !tgt.closest('input[type="text"], textarea'))) {
          const retryBtn = document.getElementById('cr-retry');
          if (retryBtn && !retryBtn.disabled) {
            retryBtn.click();
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
          }
        }
      }

      // 若焦点已在按钮等可交互控件上，放行原生 Enter/Space 点击，仅阻止冒泡到底层 game.js 的全局 keydown！
      if (e.key === ' ' || e.key === 'Enter') {
        if (isInteractiveEl) {
          e.stopPropagation();
          return;
        }
        const confirmDone = document.getElementById('cr-done') || document.getElementById('cp-confirm');
        if (confirmDone) {
          confirmDone.click();
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // 战斗进行中且无模态弹窗时的战术快捷键（与 P5 棱晶翼严格协同，绝不抢键冲突）
      if (battleVis && activeBattle && !activeBattle.over && !resModal) {
        if (_actionInProgress) return;
        const prismActive = !!(global.CombatPrismUI && typeof global.CombatPrismUI.isActive === 'function' && global.CombatPrismUI.isActive());
        const k = String(e.key || '').toLowerCase();
        if (k === 'r') {
          const wb = document.getElementById('cb-btn-wand');
          if (wb && !wb.classList.contains('hidden') && !wb.disabled) { wb.click(); e.stopPropagation(); }
        } else if (k === 'f') {
          const ab = document.getElementById('cb-btn-assist');
          if (ab && !ab.classList.contains('hidden') && !ab.disabled) { ab.click(); e.stopPropagation(); }
        } else if (k === 'x') {
          triggerEndTurnFromUI();
          e.stopPropagation();
        } else if (!prismActive) {
          if (e.key >= '1' && e.key <= '9') {
            const cards = bs.querySelectorAll('#b-actions .cb-skill-card');
            const pick = cards[Number(e.key) - 1];
            if (pick && !pick.disabled) {
              pick.click();
              e.stopPropagation();
            }
          } else if (k === 'e' || k === 'w') {
            if (canPlayerAmp(activeBattle.player)) {
              cycleOvercast(1, activeBattle);
              e.stopPropagation();
            }
          }
        }
      }
    }, true);
  }
})(typeof window !== 'undefined' ? window : globalThis);
