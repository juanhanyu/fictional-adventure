/* =========================================================================
   《转生千金》V3.2 · 0.25x 命中前慢镜缩圈与线性等阶差格挡独立模块
   文件：js/combat-timing-ring.js
   导出：window.CombatTimingRing（兼容 CommonJS module.exports）
   职责：
   - 15 招精确拍数与左手 6 键 (Q/W/E/A/S/D) 序列生成（含旧别名映射）
   - 攻击缩圈平直奖励（BAD -10% / GOOD 0% / GREAT +8% / PERFECT +15%）与休闲模式兜底
   - 原著七阶 (1-7) 线性等阶差空格格挡减伤公式（无人工封顶与保底）
   - 纯 realDt 60fps RAF 状态机（TELEGRAPH -> SHRINK_SLOWMO -> RESOLVE）
   - 受管持久化偏好 (combat_ring_assist_mode / combat_casual_mode) 与事件通知
   ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY_ASSIST = 'combat_ring_assist_mode';
  var STORAGE_KEY_CASUAL = 'combat_casual_mode';

  var GRADES = Object.freeze(['BAD', 'GOOD', 'GREAT', 'PERFECT']);
  var GRADE_ORDER = Object.freeze({ BAD: 0, GOOD: 1, GREAT: 2, PERFECT: 3 });

  var RING_BONUS = Object.freeze({
    BAD: -0.10,
    GOOD: 0.00,
    GREAT: 0.08,
    PERFECT: 0.15,
  });

  var BLOCK_BASE = Object.freeze({
    BAD: 0.00,
    GOOD: 0.08,
    GREAT: 0.18,
    PERFECT: 0.30,
  });

  var KEY_POOL = Object.freeze(['Q', 'W', 'E', 'A', 'S', 'D']);
  var KEY_POOL_SET = Object.freeze({ Q: 1, W: 1, E: 1, A: 1, S: 1, D: 1 });
  var ASSIST_MODES = Object.freeze(['standard', 'relaxed', 'off']);

  var RELAXED_SCALE = 1.35;
  var TELEGRAPH_MS = 165;
  var SLOWMO_SCALE = 0.25;
  var SLOWMO_FAST_SCALE = 0.38;
  var HITSTOP_MS = 55;
  var INTER_BEAT_MS = 135;
  var FINAL_RESOLVE_MS = 115;
  var JUDGE_FLOAT_TTL_MS = 680;

  var R_START = 64;
  var R_TARGET_ATTACK = 26;
  var R_TARGET_BLOCK = 29;
  var R_MIN = 8;

  var ATTACK_WINDOWS = Object.freeze({
    0:  Object.freeze({ durationMs: 580, perfectMs: 46, greatMs: 105, goodMs: 190 }),
    20: Object.freeze({ durationMs: 530, perfectMs: 42, greatMs: 96,  goodMs: 175 }),
    40: Object.freeze({ durationMs: 480, perfectMs: 38, greatMs: 88,  goodMs: 160 }),
    60: Object.freeze({ durationMs: 430, perfectMs: 34, greatMs: 78,  goodMs: 142 }),
  });

  var BLOCK_WINDOW = Object.freeze({
    durationMs: 540,
    perfectMs: 45,
    greatMs: 102,
    goodMs: 185,
  });

  var CONSTANTS = Object.freeze({
    BAD: -0.10,
    GOOD: 0,
    GREAT: 0.08,
    PERFECT: 0.15,
    GRADES: GRADES,
    RING_BONUS: RING_BONUS,
    BLOCK_BASE: BLOCK_BASE,
    RANK_MIN: 1,
    RANK_MAX: 7,
    BLOCK_HIGHER_STEP: 0.12,
    BLOCK_LOWER_STEP: 0.10,
    KEY_POOL: KEY_POOL,
    BLOCK_KEY: 'Space',
    ASSIST_MODES: ASSIST_MODES,
    RELAXED_SCALE: RELAXED_SCALE,
    TELEGRAPH_MS: TELEGRAPH_MS,
    SLOWMO_SCALE: SLOWMO_SCALE,
    SLOWMO_FAST_SCALE: SLOWMO_FAST_SCALE,
    HITSTOP_MS: HITSTOP_MS,
    ATTACK_WINDOWS: ATTACK_WINDOWS,
    BLOCK_WINDOW: BLOCK_WINDOW,
    STORAGE_KEYS: Object.freeze({
      ASSIST_MODE: STORAGE_KEY_ASSIST,
      CASUAL_MODE: STORAGE_KEY_CASUAL,
    }),
  });

  // 全 15 招标准拍数与键位规格表
  var SKILL_SPECS = Object.freeze({
    // 0 拍瞬发（5 招）
    shield_1_ice:      Object.freeze({ beats: 0, mode: 'instant',         keyRule: 'none',     dynamic: false, slowMoScale: 1.0,  finalSlowMoScale: 1.0,  vfxIcicles: null }),
    shield_2_mirror:   Object.freeze({ beats: 0, mode: 'instant',         keyRule: 'none',     dynamic: false, slowMoScale: 1.0,  finalSlowMoScale: 1.0,  vfxIcicles: null }),
    shield_3_steel:    Object.freeze({ beats: 0, mode: 'instant',         keyRule: 'none',     dynamic: false, slowMoScale: 1.0,  finalSlowMoScale: 1.0,  vfxIcicles: null }),
    sword_1_basic:     Object.freeze({ beats: 0, mode: 'instant',         keyRule: 'none',     dynamic: false, slowMoScale: 1.0,  finalSlowMoScale: 1.0,  vfxIcicles: null }),
    move_afterimage:   Object.freeze({ beats: 0, mode: 'instant',         keyRule: 'none',     dynamic: false, slowMoScale: 1.0,  finalSlowMoScale: 1.0,  vfxIcicles: null }),

    // 1 拍随机（5 招）
    ice_1_crystal:     Object.freeze({ beats: 1, mode: 'single',          keyRule: 'random',   dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),
    water_1_ball:      Object.freeze({ beats: 1, mode: 'single',          keyRule: 'random',   dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),
    frost_1_step:      Object.freeze({ beats: 1, mode: 'single',          keyRule: 'random',   dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),
    frost_2_breath:    Object.freeze({ beats: 1, mode: 'single',          keyRule: 'random',   dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),
    sword_2_cold_edge: Object.freeze({ beats: 1, mode: 'single',          keyRule: 'random',   dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),

    // 2 拍连续异字母（3 招）
    water_2_surge:     Object.freeze({ beats: 2, mode: 'combo_distinct',  keyRule: 'distinct', dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),
    water_3_blade:     Object.freeze({ beats: 2, mode: 'combo_distinct',  keyRule: 'distinct', dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),
    ice_3_starfrost:   Object.freeze({ beats: 2, mode: 'combo_distinct',  keyRule: 'distinct', dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: Object.freeze([2, 2]) }),

    // 3 拍固定同字母（1 招）
    ice_2_prism:       Object.freeze({ beats: 3, mode: 'triple_same',     keyRule: 'same',     dynamic: false, slowMoScale: 0.25, finalSlowMoScale: 0.25, vfxIcicles: null }),

    // 动态 N 拍逐目标穿刺（1 招）
    frost_3_thorns:    Object.freeze({ beats: 1, mode: 'dynamic_targets', keyRule: 'distinct', dynamic: true,  slowMoScale: 0.38, finalSlowMoScale: 0.25, vfxIcicles: null }),
  });

  // 旧技能别名映射（保持历史配置与新 15 招一致）
  var SKILL_ALIASES = Object.freeze({
    hand_ice_wall: 'shield_1_ice',
    hand_water_veil: 'shield_2_mirror',
    hand_root_shield: 'shield_3_steel',
    sword_basic: 'sword_1_basic',
    basic_attack: 'sword_1_basic',
    sword_afterimage: 'move_afterimage',
    sword_wind_afterimage: 'move_afterimage',
    sword_root_step: 'move_afterimage',
    hand_ice_crystal: 'ice_1_crystal',
    ice_crystal: 'ice_1_crystal',
    hand_water_surge: 'water_2_surge',
    water_surge: 'water_2_surge',
    hand_thorn_field: 'frost_3_thorns',
    thorn_field: 'frost_3_thorns',
    sword_water_edge: 'sword_2_cold_edge',
  });

  // 模块内部运行状态
  var prefsCache = {
    assistMode: 'standard',
    casualMode: false,
    initialized: false,
  };

  var runtime = {
    active: false,
    sessionToken: 0,
    mode: null, // 'attack' | 'block'
    phase: 'IDLE', // 'IDLE' | 'TELEGRAPH' | 'SHRINK_SLOWMO' | 'RESOLVE'
    rafId: 0,
    timers: [],
    keyListener: null,
    layerEl: null,
    anchorEl: null,
    preTelegraph: null,
    fadingAnchors: [],
    cancelResolve: null,
    onKeyAttempt: null,
    layoutVersion: 0,
    activeAnchorTracker: null,
  };

  /* -------------------- 基础工具 -------------------- */
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function round6(v) {
    return Math.round(v * 1000000) / 1000000;
  }

  function nowMs() {
    try {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
    } catch (e) {}
    return Date.now();
  }

  function isJsdomEnv() {
    try {
      var ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
      return /jsdom/i.test(ua);
    } catch (e) {
      return false;
    }
  }

  function canRunInteractive(opts) {
    if (opts && opts.headless) return false;
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (isJsdomEnv() && !(opts && opts.forceInteractive)) return false;
    return true;
  }

  function normalizeGrade(g) {
    var s = typeof g === 'string' ? g.trim().toUpperCase() : '';
    if (s === 'BAD' || s === 'GOOD' || s === 'GREAT' || s === 'PERFECT') return s;
    return 'GOOD';
  }

  function normalizeAssistMode(mode) {
    var s = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    if (s === 'relaxed' || s === 'off' || s === 'standard') return s;
    return 'standard';
  }

  function coerceBool(val) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      var s = val.trim().toLowerCase();
      if (s === 'false' || s === '0' || s === '' || s === 'off' || s === 'no') return false;
      if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
    }
    return !!val;
  }

  function readStorage(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  }

  function writeStorage(key, value) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(key, String(value));
      }
    } catch (e) {}
  }

  function ensurePrefsLoaded() {
    if (prefsCache.initialized) return;
    prefsCache.initialized = true;
    var rawAssist = readStorage(STORAGE_KEY_ASSIST);
    if (rawAssist !== null) {
      prefsCache.assistMode = normalizeAssistMode(rawAssist);
    }
    var rawCasual = readStorage(STORAGE_KEY_CASUAL);
    if (rawCasual !== null) {
      prefsCache.casualMode = coerceBool(rawCasual);
    }
  }

  function dispatchPrefsChange() {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('combat:prefschange', {
          detail: {
            assistMode: getAssistMode(),
            casualMode: isCasualMode(),
          },
        }));
      }
    } catch (e) {}
  }

  /* -------------------- 1. 受管持久化设置 -------------------- */
  function getAssistMode() {
    ensurePrefsLoaded();
    var stored = readStorage(STORAGE_KEY_ASSIST);
    if (stored !== null) {
      prefsCache.assistMode = normalizeAssistMode(stored);
    }
    return prefsCache.assistMode;
  }

  function setAssistMode(mode) {
    ensurePrefsLoaded();
    var valid = normalizeAssistMode(mode);
    prefsCache.assistMode = valid;
    writeStorage(STORAGE_KEY_ASSIST, valid);
    dispatchPrefsChange();
    return valid;
  }

  function isCasualMode() {
    ensurePrefsLoaded();
    var stored = readStorage(STORAGE_KEY_CASUAL);
    if (stored !== null) {
      prefsCache.casualMode = coerceBool(stored);
    }
    return !!prefsCache.casualMode;
  }

  function setCasualMode(bool) {
    ensurePrefsLoaded();
    var next = coerceBool(bool);
    prefsCache.casualMode = next;
    writeStorage(STORAGE_KEY_CASUAL, next ? 'true' : 'false');
    dispatchPrefsChange();
    return next;
  }

  /* -------------------- 2. 全 15 招拍数规格与键位序列 -------------------- */
  function resolveCanonicalSkillId(skillId) {
    var raw = typeof skillId === 'string' ? skillId.trim() : '';
    if (!raw) return '';
    if (SKILL_SPECS[raw]) return raw;
    if (SKILL_ALIASES[raw]) return SKILL_ALIASES[raw];
    return raw;
  }

  function resolveAliveCount(optsOrCount) {
    if (typeof optsOrCount === 'number' && isFinite(optsOrCount)) {
      return clamp(Math.floor(optsOrCount) || 1, 1, 6);
    }
    if (optsOrCount && typeof optsOrCount === 'object') {
      if (typeof optsOrCount.aliveCount === 'number' && isFinite(optsOrCount.aliveCount)) {
        return clamp(Math.floor(optsOrCount.aliveCount) || 1, 1, 6);
      }
      if (typeof optsOrCount.targetCount === 'number' && isFinite(optsOrCount.targetCount)) {
        return clamp(Math.floor(optsOrCount.targetCount) || 1, 1, 6);
      }
      if (Array.isArray(optsOrCount.targetActorKeys) && optsOrCount.targetActorKeys.length > 0) {
        return clamp(optsOrCount.targetActorKeys.length, 1, 6);
      }
      if (Array.isArray(optsOrCount.enemies)) {
        var alive = 0;
        for (var i = 0; i < optsOrCount.enemies.length; i++) {
          var e = optsOrCount.enemies[i];
          if (e && (e.hp === undefined || e.hp > 0) && !e.dead) alive++;
        }
        return clamp(alive || 1, 1, 6);
      }
    }
    return 1;
  }

  function getBeatSpec(skillId, optsOrCount) {
    var rawId = typeof skillId === 'string' ? skillId.trim() : '';
    var canonicalId = resolveCanonicalSkillId(rawId);
    var base = SKILL_SPECS[canonicalId];
    if (!base) {
      return {
        skillId: rawId,
        canonicalId: canonicalId,
        beats: 0,
        mode: 'instant',
        keyRule: 'none',
        dynamic: false,
        slowMoScale: 1.0,
        finalSlowMoScale: 1.0,
        beatSlowMoScales: [],
        vfxIcicles: null,
      };
    }

    var beats = base.dynamic ? resolveAliveCount(optsOrCount) : base.beats;
    var beatSlowMoScales = [];
    for (var i = 0; i < beats; i++) {
      if (base.dynamic) {
        beatSlowMoScales.push(i < beats - 1 ? SLOWMO_FAST_SCALE : SLOWMO_SCALE);
      } else {
        beatSlowMoScales.push(base.slowMoScale);
      }
    }

    return {
      skillId: rawId,
      canonicalId: canonicalId,
      beats: beats,
      mode: base.mode,
      keyRule: base.keyRule,
      dynamic: base.dynamic,
      slowMoScale: beats > 1 && base.dynamic ? SLOWMO_FAST_SCALE : (beats > 0 ? SLOWMO_SCALE : 1.0),
      finalSlowMoScale: beats > 0 ? base.finalSlowMoScale : 1.0,
      beatSlowMoScales: beatSlowMoScales,
      vfxIcicles: base.vfxIcicles ? base.vfxIcicles.slice() : null,
    };
  }

  function pickRandomKey(rng, excludeKey) {
    var fn = typeof rng === 'function' ? rng : Math.random;
    var candidates = [];
    for (var i = 0; i < KEY_POOL.length; i++) {
      if (KEY_POOL[i] !== excludeKey) candidates.push(KEY_POOL[i]);
    }
    var r = Number(fn());
    if (!isFinite(r) || r < 0) r = 0;
    if (r >= 1) r = 0.999999;
    var idx = Math.floor(r * candidates.length);
    return candidates[clamp(idx, 0, candidates.length - 1)];
  }

  function generateKeySequence(skillIdOrSpec, optsOrCount) {
    var spec;
    var rng = null;
    if (skillIdOrSpec && typeof skillIdOrSpec === 'object' && typeof skillIdOrSpec.beats === 'number') {
      spec = skillIdOrSpec;
      if (optsOrCount && typeof optsOrCount === 'object' && typeof optsOrCount.rng === 'function') {
        rng = optsOrCount.rng;
      }
    } else {
      spec = getBeatSpec(skillIdOrSpec, optsOrCount);
      if (optsOrCount && typeof optsOrCount === 'object' && typeof optsOrCount.rng === 'function') {
        rng = optsOrCount.rng;
      }
    }

    var n = Math.max(0, Math.floor(spec.beats || 0));
    if (n === 0 || spec.keyRule === 'none') return [];

    var seq = [];
    if (spec.keyRule === 'same') {
      var fixed = pickRandomKey(rng, null);
      for (var s = 0; s < n; s++) seq.push(fixed);
      return seq;
    }

    if (spec.keyRule === 'distinct') {
      var prev = null;
      for (var d = 0; d < n; d++) {
        var nextKey = pickRandomKey(rng, prev);
        seq.push(nextKey);
        prev = nextKey;
      }
      return seq;
    }

    for (var i = 0; i < n; i++) {
      seq.push(pickRandomKey(rng, null));
    }
    return seq;
  }

  /* -------------------- 3. 数值核心公式 -------------------- */
  function calcRingBonus(judgments, opts) {
    var casual;
    if (typeof opts === 'boolean') {
      casual = opts;
    } else if (opts && typeof opts === 'object' && typeof opts.casualMode === 'boolean') {
      casual = opts.casualMode;
    } else {
      casual = isCasualMode();
    }

    var list;
    if (Array.isArray(judgments)) {
      list = judgments;
    } else if (typeof judgments === 'string' && judgments.trim()) {
      list = [judgments];
    } else if (judgments && typeof judgments === 'object' && typeof judgments.grade === 'string') {
      list = [judgments.grade];
    } else {
      return 0;
    }

    if (list.length === 0) return 0;

    var sum = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var rawGrade = (item && typeof item === 'object') ? item.grade : item;
      var grade = normalizeGrade(rawGrade);
      if (casual && grade === 'BAD') {
        grade = 'GOOD';
      }
      sum += RING_BONUS[grade];
    }
    return round6(sum / list.length);
  }

  function calcBlockRate(gradeOrOpts, defRank, atkRank) {
    var grade;
    var dRankRaw;
    var aRankRaw;

    if (gradeOrOpts && typeof gradeOrOpts === 'object') {
      grade = normalizeGrade(gradeOrOpts.grade);
      dRankRaw = gradeOrOpts.defRank;
      aRankRaw = gradeOrOpts.atkRank;
    } else {
      grade = normalizeGrade(gradeOrOpts);
      dRankRaw = defRank;
      aRankRaw = atkRank;
    }

    var base = BLOCK_BASE[grade];
    if (!base) return 0;

    var dRank = clamp(Math.round(Number(dRankRaw) || 1), 1, 7);
    var aRank = clamp(Math.round(Number(aRankRaw) || 1), 1, 7);
    var d = dRank - aRank;
    var scale = d >= 0
      ? (1 + 0.12 * d)
      : Math.max(0, 1 - 0.10 * Math.abs(d));

    return round6(Math.min(1, base * scale));
  }

  /* -------------------- 4. 窗口参数与判定计算 -------------------- */
  function resolveAttackWindow(ampPct, assistMode) {
    var raw = Number(ampPct) || 0;
    var pct = clamp(raw > 1 ? raw : raw * 100, 0, 60);

    var loKey;
    var hiKey;
    if (pct <= 20) {
      loKey = 0; hiKey = 20;
    } else if (pct <= 40) {
      loKey = 20; hiKey = 40;
    } else {
      loKey = 40; hiKey = 60;
    }

    var lo = ATTACK_WINDOWS[loKey];
    var hi = ATTACK_WINDOWS[hiKey];
    var ratio = (hiKey === loKey) ? 0 : (pct - loKey) / (hiKey - loKey);

    var durationMs = Math.round(lo.durationMs + (hi.durationMs - lo.durationMs) * ratio);
    var perfectMs = Math.round(lo.perfectMs + (hi.perfectMs - lo.perfectMs) * ratio);
    var greatMs = Math.round(lo.greatMs + (hi.greatMs - lo.greatMs) * ratio);
    var goodMs = Math.round(lo.goodMs + (hi.goodMs - lo.goodMs) * ratio);

    var scale = assistMode === 'relaxed' ? RELAXED_SCALE : 1;
    durationMs = Math.round(durationMs * scale);
    perfectMs = Math.round(perfectMs * scale);
    greatMs = Math.round(greatMs * scale);
    goodMs = Math.round(goodMs * scale);

    return {
      durationMs: durationMs,
      perfectMs: perfectMs,
      greatMs: greatMs,
      goodMs: goodMs,
      targetTimeMs: Math.max(60, durationMs - goodMs),
    };
  }

  function resolveBlockWindow(assistMode) {
    var scale = assistMode === 'relaxed' ? RELAXED_SCALE : 1;
    var durationMs = Math.round(BLOCK_WINDOW.durationMs * scale);
    var perfectMs = Math.round(BLOCK_WINDOW.perfectMs * scale);
    var greatMs = Math.round(BLOCK_WINDOW.greatMs * scale);
    var goodMs = Math.round(BLOCK_WINDOW.goodMs * scale);
    return {
      durationMs: durationMs,
      perfectMs: perfectMs,
      greatMs: greatMs,
      goodMs: goodMs,
      targetTimeMs: Math.max(60, durationMs - goodMs),
    };
  }

  function judgeDelta(deltaMs, win) {
    var absD = Math.abs(deltaMs);
    if (absD <= win.perfectMs) return 'PERFECT';
    if (absD <= win.greatMs) return 'GREAT';
    if (absD <= win.goodMs) return 'GOOD';
    return 'BAD';
  }

  /* -------------------- 5. 音频 / VFX 桥接 -------------------- */
  function playCue(cueName, opts) {
    try {
      var merged = Object.assign({ force: true }, opts || null);
      if (global && global.CrystalSFX && typeof global.CrystalSFX.play === 'function') {
        global.CrystalSFX.play(cueName, merged);
        return;
      }
      if (global && typeof global.playSfx === 'function') {
        global.playSfx(cueName, merged);
        return;
      }
      if (global && typeof global.sfx === 'function') {
        global.sfx(cueName, merged);
      }
    } catch (e) {}
  }

  function setVfxSlowMo(scale) {
    try {
      var vfx = global && global.CombatPixelVFX;
      if (vfx && typeof vfx.setSlowMoScale === 'function') {
        vfx.setSlowMoScale(scale);
      }
    } catch (e) {}
  }

  function triggerVfxHitStop(ms) {
    try {
      var vfx = global && global.CombatPixelVFX;
      if (vfx && typeof vfx.triggerHitStop === 'function') {
        vfx.triggerHitStop(ms);
      }
    } catch (e) {}
  }

  function getArenaField() {
    if (typeof document === 'undefined' || !document.querySelector) return null;
    return (
      document.querySelector('#battle-screen .cb-arena-field') ||
      document.getElementById('battle-screen') ||
      document.body
    );
  }

  function getAttackAnchorLiftY(mode) {
    if (mode === 'block') return 0;
    if (typeof window === 'undefined') return 0;
    var vw = window.innerWidth || 0;
    var vh = window.innerHeight || 0;
    // 1280x720 桌面紧凑视口下将非格挡攻击缩圈略微上移 9px（由 clampPointToField 防裁顶），避免底弧压到敌方脚下血条名牌
    if ((vw > 1024 && vw <= 1360) || (vh > 640 && vh <= 760)) {
      return 9;
    }
    return 0;
  }

  function applyAnchorTransform(anchor, x, y) {
    if (!anchor) return;
    anchor.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) translate(-50%, -50%)';
  }

  function resolveActorPoint(actorKey, field, mode) {
    var keyStr = String(actorKey || 'enemy:0');
    var isLeft = keyStr === 'player' || keyStr.indexOf('ally:') === 0;
    var attackLiftY = getAttackAnchorLiftY(mode);
    var fRect = null;
    var getFRect = function () {
      if (fRect) return fRect;
      fRect = field && typeof field.getBoundingClientRect === 'function'
        ? field.getBoundingClientRect()
        : { left: 0, top: 0, width: 1280, height: 520 };
      return fRect;
    };

    // 优先通过 CombatPixelVFX.getActorScreenPoint 获取内存缓存的精确受击点（零 DOM 布局回流）
    try {
      var vfx = global && global.CombatPixelVFX;
      if (vfx && typeof vfx.getActorScreenPoint === 'function') {
        var pt = vfx.getActorScreenPoint(keyStr);
        if (pt && typeof pt === 'object') {
          var vx = isFinite(pt.x) ? pt.x : (isFinite(pt.hitX) ? pt.hitX : (isFinite(pt.screenX) ? pt.screenX : NaN));
          var vy = isFinite(pt.y) ? pt.y : (isFinite(pt.hitY) ? pt.hitY : (isFinite(pt.screenY) ? pt.screenY : NaN));
          if (isFinite(vx) && isFinite(vy)) {
            if (!pt.viewport && isFinite(pt.fieldW) && pt.fieldW > 40 && isFinite(pt.fieldH) && pt.fieldH > 40) {
              return clampPointToField(vx, vy - attackLiftY, pt.fieldW, pt.fieldH);
            }
            var vr = getFRect();
            if (pt.viewport && vr.width > 40) {
              vx -= vr.left;
              vy -= vr.top;
            }
            var vW = vr.width > 40 ? vr.width : 1280;
            var vH = vr.height > 40 ? vr.height : 520;
            return clampPointToField(vx, vy - attackLiftY, vW, vH);
          }
        }
      }
    } catch (e) {}

    // DOM 节点兜底定位（仅当内存受击点不可用时触碰布局读取）
    var rect = getFRect();
    var fW = rect.width > 40 ? rect.width : 1280;
    var fH = rect.height > 40 ? rect.height : 520;
    try {
      if (field && typeof field.querySelector === 'function') {
        var el = field.querySelector('.cb-px-actor[data-actor-key="' + keyStr.replace(/"/g, '') + '"]');
        if (!el) {
          if (keyStr === 'player') {
            el = document.getElementById('cb-p-portrait') || field.querySelector('.cb-player-stage');
          } else if (keyStr.indexOf('ally:') === 0) {
            el = field.querySelector('#cb-ally-formation [data-actor-key="' + keyStr.replace(/"/g, '') + '"]') ||
              field.querySelector('.cb-ally-slot [data-actor-key="' + keyStr.replace(/"/g, '') + '"]');
          } else if (keyStr.indexOf('enemy:') === 0) {
            var eIdx = Number(keyStr.split(':')[1]) || 0;
            el = field.querySelector('.cb-enemy-card[data-eidx="' + eIdx + '"] .cb-e-stage') ||
              field.querySelector('.cb-enemy-card[data-eidx="' + eIdx + '"]') ||
              field.querySelector('.cb-enemy-card .cb-e-stage');
          }
        }
        if (el && typeof el.getBoundingClientRect === 'function') {
          var r = el.getBoundingClientRect();
          if (r.width > 8 && r.height > 8) {
            var dx = (r.left - rect.left) + r.width * 0.5;
            var dy = (r.top - rect.top) + r.height * 0.48;
            return clampPointToField(dx, dy - attackLiftY, fW, fH);
          }
        }
      }
    } catch (e) {}

    // 居中偏左 / 居中偏右安全兜底
    return clampPointToField(
      fW * (isLeft ? 0.28 : 0.72),
      fH * 0.48 - attackLiftY,
      fW,
      fH
    );
  }

  function handleViewportResize() {
    runtime.layoutVersion += 1;
    if (runtime.preTelegraph) {
      runtime.preTelegraph.layoutDirty = true;
    }
    var tracker = runtime.activeAnchorTracker;
    if (tracker && tracker.anchor && tracker.anchor.isConnected) {
      var refreshed = resolveActorPoint(tracker.actorKey, tracker.field, tracker.mode);
      applyAnchorTransform(tracker.anchor, refreshed.x, refreshed.y);
      if (typeof tracker.onUpdate === 'function') {
        tracker.onUpdate(refreshed);
      }
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    try {
      window.addEventListener('resize', handleViewportResize, { passive: true });
    } catch (e) {
      window.addEventListener('resize', handleViewportResize);
    }
  }

  function clampPointToField(x, y, fW, fH) {
    var padX = Math.min(84, fW * 0.14);
    var padY = Math.min(82, fH * 0.18);
    return {
      x: Math.round(clamp(x, padX, Math.max(padX, fW - padX))),
      y: Math.round(clamp(y, padY, Math.max(padY, fH - padY))),
    };
  }

  /* -------------------- 6. 渲染层挂载与节点构建 -------------------- */
  function ensureLayer() {
    var field = getArenaField();
    if (!field || typeof document === 'undefined') return null;

    if (runtime.layerEl && runtime.layerEl.isConnected && runtime.layerEl.parentNode === field) {
      return runtime.layerEl;
    }

    var existing = field.querySelector ? field.querySelector(':scope > .cb-timing-ring-layer') : null;
    if (existing) {
      runtime.layerEl = existing;
      return existing;
    }

    var layer = document.createElement('div');
    layer.className = 'cb-timing-ring-layer';
    layer.setAttribute('aria-hidden', 'true');
    field.appendChild(layer);
    runtime.layerEl = layer;
    return layer;
  }

  function createSvgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      var keys = Object.keys(attrs);
      for (var i = 0; i < keys.length; i++) {
        el.setAttribute(keys[i], String(attrs[keys[i]]));
      }
    }
    return el;
  }

  function mountReticle(layer, opts) {
    unmountAnchor();

    var isBlock = opts.mode === 'block';
    var targetR = isBlock ? R_TARGET_BLOCK : R_TARGET_ATTACK;
    var anchor = document.createElement('div');
    anchor.className = 'cb-tr-anchor ' + (isBlock ? 'is-block' : 'is-attack') + ' is-telegraph';
    applyAnchorTransform(anchor, opts.x, opts.y);

    // 单层锐利 SVG 棱晶缩圈
    var svg = createSvgEl('svg', {
      class: 'cb-tr-svg',
      viewBox: '0 0 160 160',
      width: '160',
      height: '160',
      fill: 'none',
    });

    // 目标靶环柔和冰光基底
    var halo = createSvgEl('circle', {
      class: 'cb-tr-halo',
      cx: '80',
      cy: '80',
      r: String(targetR),
    });
    svg.appendChild(halo);

    // 固定内靶环（攻击为冰蓝棱晶环，格挡为护盾冰青环）
    var targetRing = createSvgEl('circle', {
      class: 'cb-tr-target',
      cx: '80',
      cy: '80',
      r: String(targetR),
    });
    svg.appendChild(targetRing);

    // 四向极细冰晶准星刻线（无圆框嵌套）
    var tickInner = targetR + 3;
    var tickOuter = targetR + 10;
    var tickCoords = [
      [80, 80 - tickOuter, 80, 80 - tickInner],
      [80, 80 + tickInner, 80, 80 + tickOuter],
      [80 - tickOuter, 80, 80 - tickInner, 80],
      [80 + tickInner, 80, 80 + tickOuter, 80],
    ];
    for (var t = 0; t < tickCoords.length; t++) {
      svg.appendChild(createSvgEl('line', {
        class: 'cb-tr-tick',
        x1: tickCoords[t][0],
        y1: tickCoords[t][1],
        x2: tickCoords[t][2],
        y2: tickCoords[t][3],
      }));
    }

    // 外层匀速收缩冰晶主环（固定 r="64"，逐帧仅改写纯 GPU scale，配合 non-scaling-stroke 保持线宽匀称）
    var shrinkRing = createSvgEl('circle', {
      class: 'cb-tr-shrink',
      cx: '80',
      cy: '80',
      r: String(R_START),
      'vector-effect': 'non-scaling-stroke',
    });
    shrinkRing.style.transformOrigin = '80px 80px';
    shrinkRing.style.transform = 'scale(1)';
    svg.appendChild(shrinkRing);

    // 同半径细折光高亮虚环（固定 r="64"，逐帧仅改写纯 GPU scale）
    var shrinkGlint = createSvgEl('circle', {
      class: 'cb-tr-shrink-glint',
      cx: '80',
      cy: '80',
      r: String(R_START),
      'vector-effect': 'non-scaling-stroke',
    });
    shrinkGlint.style.transformOrigin = '80px 80px';
    shrinkGlint.style.transform = 'scale(1)';
    svg.appendChild(shrinkGlint);

    // 命中爆裂波纹环
    var burstRing = createSvgEl('circle', {
      class: 'cb-tr-burst',
      cx: '80',
      cy: '80',
      r: String(targetR),
    });
    svg.appendChild(burstRing);

    anchor.appendChild(svg);

    // 45° 切角键帽徽标（无外框嵌套、零圆框套圆框）
    var keycap = document.createElement('div');
    keycap.className = 'cb-tr-keycap' + (isBlock ? ' is-space' : '');
    keycap.textContent = isBlock ? 'SPACE' : String(opts.expectedKey || 'Q');
    anchor.appendChild(keycap);

    // 多拍节奏钻石刻点（仅 beats > 1 时显示，无外框胶囊）
    if (opts.totalBeats > 1) {
      var beatsRow = document.createElement('div');
      beatsRow.className = 'cb-tr-beats';
      for (var b = 0; b < opts.totalBeats; b++) {
        var pip = document.createElement('span');
        pip.className = 'cb-tr-pip';
        if (b < opts.beatIndex) {
          var prevGrade = opts.prevGrades && opts.prevGrades[b] ? opts.prevGrades[b].toLowerCase() : 'good';
          pip.classList.add('is-done', 'is-' + prevGrade);
        } else if (b === opts.beatIndex) {
          pip.classList.add('is-current');
        }
        beatsRow.appendChild(pip);
      }
      anchor.appendChild(beatsRow);
    }

    layer.appendChild(anchor);
    runtime.anchorEl = anchor;

    return {
      anchor: anchor,
      shrinkRing: shrinkRing,
      shrinkGlint: shrinkGlint,
      burstRing: burstRing,
      keycap: keycap,
      targetR: targetR,
    };
  }

  function clearFadingAnchors() {
    if (!runtime.fadingAnchors || !runtime.fadingAnchors.length) return;
    for (var i = 0; i < runtime.fadingAnchors.length; i++) {
      var el = runtime.fadingAnchors[i];
      try {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (e) {}
    }
    runtime.fadingAnchors.length = 0;
  }

  function removeRuntimeTimer(tid) {
    var idx = runtime.timers.indexOf(tid);
    if (idx >= 0) runtime.timers.splice(idx, 1);
  }

  function unmountAnchor() {
    if (runtime.anchorEl) {
      try {
        if (runtime.anchorEl.parentNode) {
          runtime.anchorEl.parentNode.removeChild(runtime.anchorEl);
        }
      } catch (e) {}
      runtime.anchorEl = null;
    }
  }

  function scheduleResolvedAnchorCleanup(anchorEl, delayMs) {
    if (!anchorEl) return;
    runtime.fadingAnchors.push(anchorEl);
    var tid = setTimeout(function () {
      removeRuntimeTimer(tid);
      var idx = runtime.fadingAnchors.indexOf(anchorEl);
      if (idx >= 0) runtime.fadingAnchors.splice(idx, 1);
      try {
        if (anchorEl.parentNode) anchorEl.parentNode.removeChild(anchorEl);
      } catch (e) {}
    }, delayMs || 220);
    runtime.timers.push(tid);
  }

  function spawnJudgeFloat(layer, x, y, grade, subText, mode) {
    if (!layer || typeof document === 'undefined') return;
    var norm = normalizeGrade(grade);
    var safeY = Math.max(18, Math.round(Number(y) || 18));
    var pop = document.createElement('div');
    pop.className = 'cb-tr-judge is-' + norm.toLowerCase() + (mode === 'block' ? ' is-block' : '');
    pop.style.left = Math.round(Number(x) || 0) + 'px';
    pop.style.top = safeY + 'px';

    var wordEl = document.createElement('span');
    wordEl.className = 'cb-tr-judge-word';
    wordEl.textContent = norm;
    pop.appendChild(wordEl);

    if (subText) {
      var subEl = document.createElement('span');
      subEl.className = 'cb-tr-judge-sub';
      subEl.textContent = subText;
      pop.appendChild(subEl);
    }

    layer.appendChild(pop);
    var tid = setTimeout(function () {
      removeRuntimeTimer(tid);
      try {
        if (pop.parentNode) pop.parentNode.removeChild(pop);
      } catch (e) {}
    }, JUDGE_FLOAT_TTL_MS);
    runtime.timers.push(tid);
  }

  function formatAttackSubText(grade, casualMode) {
    var eff = (casualMode && grade === 'BAD') ? 'GOOD' : grade;
    var bonus = RING_BONUS[eff];
    var pct = Math.round(bonus * 100);
    if (pct > 0) return '+' + pct + '%';
    if (pct < 0) return pct + '%';
    return '0%';
  }

  function formatBlockSubText(blockRate) {
    var pct = Math.round((Number(blockRate) || 0) * 100);
    return 'BLOCK ' + pct + '%';
  }

  /* -------------------- 7. 捕获阶段键盘拦截 -------------------- */
  function extractLetterFromEvent(ev) {
    if (!ev) return null;
    if (typeof ev.code === 'string' && /^Key[A-Z]$/.test(ev.code)) {
      return ev.code.slice(3);
    }
    if (typeof ev.key === 'string' && /^[a-zA-Z]$/.test(ev.key)) {
      return ev.key.toUpperCase();
    }
    return null;
  }

  function isSpaceEvent(ev) {
    if (!ev) return false;
    return ev.code === 'Space' || ev.key === ' ' || ev.key === 'Spacebar';
  }

  function attachKeyListener() {
    detachKeyListener();
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    var onKeyDown = function (ev) {
      if (!runtime.active) return;
      if (!ev) return;

      var isAttack = runtime.mode === 'attack';
      var isBlock = runtime.mode === 'block';
      var letter = extractLetterFromEvent(ev);
      var space = isSpaceEvent(ev);

      if (isAttack) {
        if (letter && (KEY_POOL_SET[letter] || runtime.phase === 'SHRINK_SLOWMO')) {
          ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (ev.repeat) return;
          if (runtime.phase === 'SHRINK_SLOWMO' && typeof runtime.onKeyAttempt === 'function') {
            runtime.onKeyAttempt(letter);
          }
        }
        return;
      }

      if (isBlock) {
        if (space) {
          ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (ev.repeat) return;
          if (runtime.phase === 'SHRINK_SLOWMO' && typeof runtime.onKeyAttempt === 'function') {
            runtime.onKeyAttempt('Space');
          }
          return;
        }
        if (letter && runtime.phase === 'SHRINK_SLOWMO') {
          ev.preventDefault();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
          if (ev.repeat) return;
          if (typeof runtime.onKeyAttempt === 'function') {
            runtime.onKeyAttempt(letter);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    runtime.keyListener = onKeyDown;
  }

  function detachKeyListener() {
    if (runtime.keyListener && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      try {
        window.removeEventListener('keydown', runtime.keyListener, true);
      } catch (e) {}
    }
    runtime.keyListener = null;
  }

  /* -------------------- 8. 纯 realDt 60fps 单拍状态机 -------------------- */
  function waitRealMs(durationMs, token) {
    return new Promise(function (resolve) {
      if (durationMs <= 0) {
        resolve(token === runtime.sessionToken);
        return;
      }
      var hasRaf = typeof requestAnimationFrame === 'function';
      if (!hasRaf) {
        var tid = setTimeout(function () {
          resolve(token === runtime.sessionToken);
        }, durationMs);
        runtime.timers.push(tid);
        return;
      }
      var elapsed = 0;
      var lastTs = nowMs();
      var step = function () {
        if (token !== runtime.sessionToken) {
          resolve(false);
          return;
        }
        var cur = nowMs();
        var realDt = clamp(cur - lastTs, 0, 64);
        lastTs = cur;
        elapsed += realDt;
        if (elapsed >= durationMs) {
          resolve(true);
          return;
        }
        runtime.rafId = requestAnimationFrame(step);
      };
      runtime.rafId = requestAnimationFrame(step);
    });
  }

  function runSingleBeat(params, token) {
    return new Promise(function (resolve) {
      var layer = ensureLayer();
      var field = getArenaField();
      var cachedPt = resolveActorPoint(params.actorKey, field, params.mode);

      var ui = layer ? mountReticle(layer, {
        mode: params.mode,
        expectedKey: params.expectedKey,
        x: cachedPt.x,
        y: cachedPt.y,
        beatIndex: params.beatIndex,
        totalBeats: params.totalBeats,
        prevGrades: params.prevGrades,
      }) : null;

      if (ui && ui.anchor) {
        runtime.activeAnchorTracker = {
          actorKey: params.actorKey,
          field: field,
          mode: params.mode,
          anchor: ui.anchor,
          onUpdate: function (nextPt) {
            cachedPt = nextPt;
          },
        };
      }

      // Phase 1: TELEGRAPH（t = 0ms 立即亮键 + 播 ring_telegraph）
      runtime.phase = 'TELEGRAPH';
      runtime.onKeyAttempt = null;
      playCue('ring_telegraph');

      var shrinkWindow = params.window;
      var targetR = ui ? ui.targetR : (params.mode === 'block' ? R_TARGET_BLOCK : R_TARGET_ATTACK);
      var shrinkVelocity = (R_START - targetR) / Math.max(1, shrinkWindow.targetTimeMs);

      var settled = false;
      var finishBeat = function (grade, deltaMs, pressedKey) {
        if (settled) return;
        settled = true;
        runtime.onKeyAttempt = null;
        if (runtime.activeAnchorTracker && ui && runtime.activeAnchorTracker.anchor === ui.anchor) {
          runtime.activeAnchorTracker = null;
        }
        if (runtime.rafId && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(runtime.rafId);
          runtime.rafId = 0;
        }

        // Phase 3: RESOLVE（命中瞬间立即恢复 1.0x + 55ms HitStop + 判定音效 + 英文飘字）
        runtime.phase = 'RESOLVE';
        setVfxSlowMo(1.0);
        if (layer) {
          layer.classList.remove('is-slowmo', 'is-block-mode');
        }
        triggerVfxHitStop(HITSTOP_MS);
        playCue('judge_' + grade.toLowerCase());

        if (ui && ui.anchor) {
          ui.anchor.classList.remove('is-telegraph', 'is-shrinking', 'is-sweet');
          ui.anchor.classList.add('is-resolved', 'is-grade-' + grade.toLowerCase());
        }

        var subText = typeof params.formatSubText === 'function'
          ? params.formatSubText(grade)
          : '';
        // 上移至目标外环正上方外侧（y - targetR - 26px，上边界 >= 18px），与下一拍 .cb-tr-keycap 保持 0px 重叠
        var judgeY = Math.max(18, Math.round(cachedPt.y - targetR - 26));
        spawnJudgeFloat(layer, cachedPt.x, judgeY, grade, subText, params.mode);

        var result = {
          grade: grade,
          deltaMs: Math.round(deltaMs),
          pressedKey: pressedKey,
          x: cachedPt.x,
          y: cachedPt.y,
        };
        resolve(result);
      };

      // 开始 TELEGRAPH 计时 -> 自动切入 SHRINK_SLOWMO
      var telegraphElapsed = 0;
      var shrinkElapsed = 0;
      var inShrink = false;
      var lastSweet = false;
      var lastTs = nowMs();

      var enterShrinkSlowMo = function () {
        if (settled || token !== runtime.sessionToken) return;
        inShrink = true;
        lastTs = nowMs();
        runtime.phase = 'SHRINK_SLOWMO';
        setVfxSlowMo(params.slowMoScale);
        if (layer) {
          layer.classList.add('is-slowmo');
          if (params.mode === 'block') layer.classList.add('is-block-mode');
          else layer.classList.remove('is-block-mode');
        }
        if (ui && ui.anchor) {
          ui.anchor.classList.remove('is-telegraph');
          ui.anchor.classList.add('is-shrinking');
        }
        playCue('ring_slowmo_in');

        runtime.onKeyAttempt = function (pressedKey) {
          if (settled || token !== runtime.sessionToken) return;
          var liveElapsed = shrinkElapsed + Math.max(0, Math.min(64, nowMs() - lastTs));
          var deltaMs = liveElapsed - shrinkWindow.targetTimeMs;
          var isRightKey = params.mode === 'block'
            ? pressedKey === 'Space'
            : pressedKey === params.expectedKey;
          var grade = isRightKey ? judgeDelta(deltaMs, shrinkWindow) : 'BAD';
          finishBeat(grade, deltaMs, pressedKey);
        };
      };

      var tickFrame = function () {
        if (settled || token !== runtime.sessionToken) return;
        var cur = nowMs();
        var realDt = clamp(cur - lastTs, 0, 64);
        lastTs = cur;

        if (!inShrink) {
          telegraphElapsed += realDt;
          if (telegraphElapsed >= TELEGRAPH_MS) {
            enterShrinkSlowMo();
          } else {
            runtime.rafId = requestAnimationFrame(tickFrame);
            return;
          }
        }

        shrinkElapsed += realDt;
        var currentR = Math.max(R_MIN, R_START - shrinkVelocity * shrinkElapsed);
        if (ui && ui.shrinkRing) {
          var scaleStr = 'scale(' + (currentR / R_START).toFixed(4) + ')';
          ui.shrinkRing.style.transform = scaleStr;
          if (ui.shrinkGlint) ui.shrinkGlint.style.transform = scaleStr;
          var absD = Math.abs(shrinkElapsed - shrinkWindow.targetTimeMs);
          var isSweet = absD <= shrinkWindow.greatMs;
          if (ui.anchor && isSweet !== lastSweet) {
            lastSweet = isSweet;
            if (isSweet) ui.anchor.classList.add('is-sweet');
            else ui.anchor.classList.remove('is-sweet');
          }
        }

        if (shrinkElapsed >= shrinkWindow.durationMs) {
          finishBeat('BAD', shrinkElapsed - shrinkWindow.targetTimeMs, null);
          return;
        }

        runtime.rafId = requestAnimationFrame(tickFrame);
      };

      if (typeof requestAnimationFrame === 'function') {
        runtime.rafId = requestAnimationFrame(tickFrame);
      } else {
        // 无 RAF 环境降级（仅当强制交互测试时触发）
        var fallbackTid = setTimeout(function () {
          if (token !== runtime.sessionToken) return;
          enterShrinkSlowMo();
          var endTid = setTimeout(function () {
            if (token !== runtime.sessionToken) return;
            finishBeat('BAD', shrinkWindow.durationMs - shrinkWindow.targetTimeMs, null);
          }, shrinkWindow.durationMs);
          runtime.timers.push(endTid);
        }, TELEGRAPH_MS);
        runtime.timers.push(fallbackTid);
      }
    });
  }

  /* -------------------- 9. 公共流程 API：攻击缩圈 / 格挡提示 / 强制取消 -------------------- */
  function isActive() {
    return !!runtime.active;
  }

  function clearRuntimeTimers() {
    for (var i = 0; i < runtime.timers.length; i++) {
      try { clearTimeout(runtime.timers[i]); } catch (e) {}
    }
    runtime.timers.length = 0;
  }

  function cancel(reason) {
    runtime.sessionToken += 1;
    var wasActive = runtime.active;
    runtime.active = false;
    runtime.mode = null;
    runtime.phase = 'IDLE';
    runtime.onKeyAttempt = null;
    runtime.activeAnchorTracker = null;

    if (runtime.rafId && typeof cancelAnimationFrame === 'function') {
      try { cancelAnimationFrame(runtime.rafId); } catch (e) {}
    }
    runtime.rafId = 0;

    clearRuntimeTimers();
    cancelPreTelegraph();
    clearFadingAnchors();
    detachKeyListener();
    setVfxSlowMo(1.0);
    unmountAnchor();

    if (runtime.layerEl) {
      try {
        runtime.layerEl.classList.remove('is-slowmo', 'is-block-mode');
        runtime.layerEl.innerHTML = '';
        if (runtime.layerEl.parentNode) {
          runtime.layerEl.parentNode.removeChild(runtime.layerEl);
        }
      } catch (e) {}
      runtime.layerEl = null;
    }

    if (typeof runtime.cancelResolve === 'function') {
      var cb = runtime.cancelResolve;
      runtime.cancelResolve = null;
      try { cb(reason || 'cancelled'); } catch (e) {}
    }
    return wasActive;
  }

  function summarizeGrades(judgments) {
    if (!judgments || judgments.length === 0) {
      return { bestGrade: 'GOOD', worstGrade: 'GOOD' };
    }
    var best = judgments[0];
    var worst = judgments[0];
    for (var i = 1; i < judgments.length; i++) {
      var g = judgments[i];
      if (GRADE_ORDER[g] > GRADE_ORDER[best]) best = g;
      if (GRADE_ORDER[g] < GRADE_ORDER[worst]) worst = g;
    }
    return { bestGrade: best, worstGrade: worst };
  }

  function buildAutoAttackResult(spec, opts, assistMode, casualMode, keys) {
    var judgments = [];
    var beatsDetail = [];
    var targetKeys = Array.isArray(opts.targetActorKeys) && opts.targetActorKeys.length
      ? opts.targetActorKeys
      : null;

    for (var i = 0; i < spec.beats; i++) {
      var actorKey = targetKeys
        ? targetKeys[i % targetKeys.length]
        : (opts.targetActorKey || 'enemy:0');
      var detail = {
        beatIndex: i,
        key: keys[i] || null,
        pressedKey: null,
        actorKey: actorKey,
        grade: 'GOOD',
        effectiveGrade: 'GOOD',
        deltaMs: 0,
        bonus: 0,
        slowMoScale: 1.0,
      };
      judgments.push('GOOD');
      beatsDetail.push(detail);
      if (typeof opts.onBeatResolve === 'function') {
        try { opts.onBeatResolve(detail); } catch (e) {}
      }
    }

    var bonus = calcRingBonus(judgments, { casualMode: casualMode });
    var summary = summarizeGrades(judgments);
    return {
      skillId: spec.skillId,
      canonicalId: spec.canonicalId,
      beats: spec.beats,
      skipped: true,
      cancelled: false,
      assistMode: assistMode,
      casualMode: casualMode,
      keys: keys,
      judgments: judgments,
      beatsDetail: beatsDetail,
      bonus: bonus,
      multiplier: round6(1 + bonus),
      bestGrade: summary.bestGrade,
      worstGrade: summary.worstGrade,
      vfxIcicles: spec.vfxIcicles ? spec.vfxIcicles.slice() : null,
    };
  }

  function runAttackSequence(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var assistMode = opts.assistMode !== undefined ? normalizeAssistMode(opts.assistMode) : getAssistMode();
    var casualMode = opts.casualMode !== undefined ? coerceBool(opts.casualMode) : isCasualMode();
    var spec = getBeatSpec(opts.skillId, opts);

    // 0 拍瞬发技直接跳过
    if (spec.beats <= 0) {
      return Promise.resolve({
        skillId: spec.skillId,
        canonicalId: spec.canonicalId,
        beats: 0,
        skipped: true,
        cancelled: false,
        assistMode: assistMode,
        casualMode: casualMode,
        keys: [],
        judgments: [],
        beatsDetail: [],
        bonus: 0,
        multiplier: 1,
        bestGrade: 'GOOD',
        worstGrade: 'GOOD',
        vfxIcicles: null,
      });
    }

    var keys = (Array.isArray(opts.keys) && opts.keys.length === spec.beats)
      ? opts.keys.map(function (k) { return String(k).toUpperCase(); })
      : generateKeySequence(spec, { rng: opts.rng });

    // 关闭辅助或无头/jsdom 环境安全降级为全自动 GOOD
    if (assistMode === 'off' || !canRunInteractive(opts)) {
      return Promise.resolve(buildAutoAttackResult(spec, opts, assistMode, casualMode, keys));
    }

    if (runtime.active) {
      cancel('superseded');
    }

    var token = ++runtime.sessionToken;
    runtime.active = true;
    runtime.mode = 'attack';
    runtime.phase = 'TELEGRAPH';
    attachKeyListener();

    var win = resolveAttackWindow(opts.ampPct, assistMode);
    var targetKeys = Array.isArray(opts.targetActorKeys) && opts.targetActorKeys.length
      ? opts.targetActorKeys
      : null;

    return new Promise(function (resolve) {
      var judgments = [];
      var beatsDetail = [];
      var done = false;

      var finalize = function (cancelled, cancelReason) {
        if (done) return;
        done = true;
        if (token === runtime.sessionToken) {
          runtime.active = false;
          runtime.mode = null;
          runtime.phase = 'IDLE';
          runtime.cancelResolve = null;
          detachKeyListener();
          setVfxSlowMo(1.0);
          unmountAnchor();
        }
        var bonus = calcRingBonus(judgments, { casualMode: casualMode });
        var summary = summarizeGrades(judgments);
        resolve({
          skillId: spec.skillId,
          canonicalId: spec.canonicalId,
          beats: spec.beats,
          skipped: false,
          cancelled: !!cancelled,
          cancelReason: cancelled ? (cancelReason || 'cancelled') : null,
          assistMode: assistMode,
          casualMode: casualMode,
          keys: keys.slice(),
          judgments: judgments,
          beatsDetail: beatsDetail,
          bonus: bonus,
          multiplier: round6(1 + bonus),
          bestGrade: summary.bestGrade,
          worstGrade: summary.worstGrade,
          vfxIcicles: spec.vfxIcicles ? spec.vfxIcicles.slice() : null,
        });
      };

      runtime.cancelResolve = function (reason) {
        finalize(true, reason);
      };

      var runNext = function (beatIndex) {
        if (done || token !== runtime.sessionToken) return;
        if (beatIndex >= spec.beats) {
          finalize(false, null);
          return;
        }

        var actorKey = targetKeys
          ? targetKeys[beatIndex % targetKeys.length]
          : (opts.targetActorKey || 'enemy:0');
        var beatSlowMo = spec.beatSlowMoScales[beatIndex] || SLOWMO_SCALE;
        var expectedKey = keys[beatIndex];

        if (typeof opts.onBeatStart === 'function') {
          try {
            opts.onBeatStart({
              beatIndex: beatIndex,
              totalBeats: spec.beats,
              key: expectedKey,
              actorKey: actorKey,
              slowMoScale: beatSlowMo,
            });
          } catch (e) {}
        }

        runSingleBeat({
          mode: 'attack',
          actorKey: actorKey,
          expectedKey: expectedKey,
          beatIndex: beatIndex,
          totalBeats: spec.beats,
          prevGrades: judgments,
          window: win,
          slowMoScale: beatSlowMo,
          formatSubText: function (grade) {
            return formatAttackSubText(grade, casualMode);
          },
        }, token).then(function (beatRes) {
          if (done || token !== runtime.sessionToken) return;
          var effGrade = (casualMode && beatRes.grade === 'BAD') ? 'GOOD' : beatRes.grade;
          var detail = {
            beatIndex: beatIndex,
            key: expectedKey,
            pressedKey: beatRes.pressedKey,
            actorKey: actorKey,
            grade: beatRes.grade,
            effectiveGrade: effGrade,
            deltaMs: beatRes.deltaMs,
            bonus: RING_BONUS[effGrade],
            slowMoScale: beatSlowMo,
          };
          judgments.push(beatRes.grade);
          beatsDetail.push(detail);

          if (typeof opts.onBeatResolve === 'function') {
            try { opts.onBeatResolve(detail); } catch (e) {}
          }

          var holdMs = beatIndex < spec.beats - 1 ? INTER_BEAT_MS : FINAL_RESOLVE_MS;
          waitRealMs(holdMs, token).then(function (stillAlive) {
            if (!stillAlive || done || token !== runtime.sessionToken) return;
            unmountAnchor();
            runNext(beatIndex + 1);
          });
        });
      };

      runNext(0);
    });
  }

  function runBlockPrompt(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var assistMode = opts.assistMode !== undefined ? normalizeAssistMode(opts.assistMode) : getAssistMode();
    var defRank = clamp(Math.round(Number(opts.defRank) || 1), 1, 7);
    var atkRank = clamp(Math.round(Number(opts.atkRank) || 1), 1, 7);
    var rankDiff = defRank - atkRank;

    // 关闭辅助或无头/jsdom 环境全自动按 GOOD 结算
    if (assistMode === 'off' || !canRunInteractive(opts)) {
      var autoRate = calcBlockRate('GOOD', defRank, atkRank);
      var autoRes = {
        grade: 'GOOD',
        blockRate: autoRate,
        defRank: defRank,
        atkRank: atkRank,
        rankDiff: rankDiff,
        deltaMs: 0,
        pressedKey: null,
        skipped: true,
        cancelled: false,
        assistMode: assistMode,
      };
      if (typeof opts.onResolve === 'function') {
        try { opts.onResolve(autoRes); } catch (e) {}
      }
      return Promise.resolve(autoRes);
    }

    if (runtime.active) {
      cancel('superseded');
    }

    var token = ++runtime.sessionToken;
    runtime.active = true;
    runtime.mode = 'block';
    runtime.phase = 'TELEGRAPH';
    attachKeyListener();

    var win = resolveBlockWindow(assistMode);
    var actorKey = opts.actorKey || 'player';

    if (typeof opts.onStart === 'function') {
      try {
        opts.onStart({
          actorKey: actorKey,
          defRank: defRank,
          atkRank: atkRank,
          rankDiff: rankDiff,
          slowMoScale: SLOWMO_SCALE,
        });
      } catch (e) {}
    }

    return new Promise(function (resolve) {
      var done = false;

      var finalize = function (result) {
        if (done) return;
        done = true;
        if (token === runtime.sessionToken) {
          runtime.active = false;
          runtime.mode = null;
          runtime.phase = 'IDLE';
          runtime.cancelResolve = null;
          detachKeyListener();
          setVfxSlowMo(1.0);
          unmountAnchor();
        }
        if (typeof opts.onResolve === 'function') {
          try { opts.onResolve(result); } catch (e) {}
        }
        resolve(result);
      };

      runtime.cancelResolve = function (reason) {
        finalize({
          grade: 'BAD',
          blockRate: 0,
          defRank: defRank,
          atkRank: atkRank,
          rankDiff: rankDiff,
          deltaMs: 0,
          pressedKey: null,
          skipped: false,
          cancelled: true,
          cancelReason: reason || 'cancelled',
          assistMode: assistMode,
        });
      };

      runSingleBeat({
        mode: 'block',
        actorKey: actorKey,
        expectedKey: 'Space',
        beatIndex: 0,
        totalBeats: 1,
        prevGrades: [],
        window: win,
        slowMoScale: SLOWMO_SCALE,
        formatSubText: function (grade) {
          return formatBlockSubText(calcBlockRate(grade, defRank, atkRank));
        },
      }, token).then(function (beatRes) {
        if (done || token !== runtime.sessionToken) return;
        var rate = calcBlockRate(beatRes.grade, defRank, atkRank);
        var result = {
          grade: beatRes.grade,
          blockRate: rate,
          defRank: defRank,
          atkRank: atkRank,
          rankDiff: rankDiff,
          deltaMs: beatRes.deltaMs,
          pressedKey: beatRes.pressedKey,
          skipped: false,
          cancelled: false,
          cancelReason: null,
          assistMode: assistMode,
        };
        waitRealMs(FINAL_RESOLVE_MS, token).then(function (stillAlive) {
          if (!stillAlive || done || token !== runtime.sessionToken) return;
          finalize(result);
        });
      });
    });
  }

  /* -------------------- 9B. 门控单拍接口：showPreTelegraph / cancelPreTelegraph / runGateBeat -------------------- */
  function cancelPreTelegraph() {
    var pre = runtime.preTelegraph;
    if (!pre) return false;
    runtime.preTelegraph = null;
    if (pre.rafId && typeof cancelAnimationFrame === 'function') {
      try { cancelAnimationFrame(pre.rafId); } catch (e) {}
    }
    if (pre.safetyTimer) {
      try { clearTimeout(pre.safetyTimer); } catch (e) {}
    }
    if (pre.ui && pre.ui.anchor) {
      if (runtime.activeAnchorTracker && runtime.activeAnchorTracker.anchor === pre.ui.anchor) {
        runtime.activeAnchorTracker = null;
      }
      try {
        if (pre.ui.anchor.parentNode) {
          pre.ui.anchor.parentNode.removeChild(pre.ui.anchor);
        }
      } catch (e) {}
      if (runtime.anchorEl === pre.ui.anchor) {
        runtime.anchorEl = null;
      }
    }
    return true;
  }

  function showPreTelegraph(options) {
    var opts = options && typeof options === 'object' ? options : {};
    cancelPreTelegraph();

    var assistMode = opts.assistMode !== undefined ? normalizeAssistMode(opts.assistMode) : getAssistMode();
    if (assistMode === 'off' || !canRunInteractive(opts)) {
      return false;
    }

    var mode = opts.mode === 'block' ? 'block' : 'attack';
    var expectedKey = mode === 'block'
      ? 'Space'
      : String(opts.key || opts.expectedKey || 'Q').trim().toUpperCase();
    var beatIndex = Math.max(0, Math.floor(Number(opts.beatIdx != null ? opts.beatIdx : opts.beatIndex) || 0));
    var totalBeats = Math.max(1, Math.floor(Number(opts.totalBeats != null ? opts.totalBeats : opts.beats) || 1));
    var actorKey = opts.anchorTargetKey || opts.actorKey || opts.targetActorKey || (mode === 'block' ? 'player' : 'enemy:0');

    var layer = ensureLayer();
    var field = getArenaField();
    if (!layer) return false;

    clearFadingAnchors();
    var cachedPt = resolveActorPoint(actorKey, field, mode);
    var ui = mountReticle(layer, {
      mode: mode,
      expectedKey: expectedKey,
      x: cachedPt.x,
      y: cachedPt.y,
      beatIndex: beatIndex,
      totalBeats: totalBeats,
      prevGrades: Array.isArray(opts.prevGrades) ? opts.prevGrades : [],
    });

    playCue('ring_telegraph');

    var preState = {
      ui: ui,
      mode: mode,
      expectedKey: expectedKey,
      actorKey: actorKey,
      beatIndex: beatIndex,
      totalBeats: totalBeats,
      pt: cachedPt,
      layoutVersion: runtime.layoutVersion,
      layoutDirty: false,
      rafId: 0,
      safetyTimer: null,
      startedAt: nowMs(),
    };
    runtime.preTelegraph = preState;

    if (ui && ui.anchor) {
      runtime.activeAnchorTracker = {
        actorKey: actorKey,
        field: field,
        mode: mode,
        anchor: ui.anchor,
        onUpdate: function (nextPt) {
          preState.pt = nextPt;
          preState.layoutVersion = runtime.layoutVersion;
          preState.layoutDirty = false;
        },
      };
    }

    preState.safetyTimer = setTimeout(function () {
      if (runtime.preTelegraph === preState) {
        cancelPreTelegraph();
      }
    }, 2600);

    return true;
  }

  function runGateBeat(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var mode = opts.mode === 'block' ? 'block' : 'attack';
    var assistMode = opts.assistMode !== undefined ? normalizeAssistMode(opts.assistMode) : getAssistMode();
    var casualMode = opts.casualMode !== undefined ? coerceBool(opts.casualMode) : isCasualMode();
    var beatIdx = Math.max(0, Math.floor(Number(opts.beatIdx != null ? opts.beatIdx : opts.beatIndex) || 0));
    var totalBeats = Math.max(1, Math.floor(Number(opts.totalBeats != null ? opts.totalBeats : opts.beats) || 1));
    var isFinalBeat = opts.isFinalBeat !== undefined ? coerceBool(opts.isFinalBeat) : (beatIdx >= totalBeats - 1);
    var actorKey = opts.anchorTargetKey || opts.actorKey || opts.targetActorKey || (mode === 'block' ? 'player' : 'enemy:0');
    var expectedKey = mode === 'block'
      ? 'Space'
      : String(opts.key || opts.expectedKey || pickRandomKey(opts.rng, null)).trim().toUpperCase();
    var defRank = clamp(Math.round(Number(opts.playerRank != null ? opts.playerRank : opts.defRank) || 1), 1, 7);
    var atkRank = clamp(Math.round(Number(opts.enemyRank != null ? opts.enemyRank : opts.atkRank) || 1), 1, 7);

    var rawSlowMo = Number(opts.slowMoScale);
    var spec = opts.skillId ? getBeatSpec(opts.skillId, { aliveCount: totalBeats }) : null;
    var effSlowMoScale;
    if (isFinite(rawSlowMo) && rawSlowMo > 0) {
      effSlowMoScale = clamp(rawSlowMo, 0.05, 1.0);
    } else if (mode === 'block') {
      effSlowMoScale = SLOWMO_SCALE;
    } else if (spec && spec.dynamic && !isFinalBeat) {
      effSlowMoScale = SLOWMO_FAST_SCALE;
    } else {
      effSlowMoScale = SLOWMO_SCALE;
    }

    // 辅助关闭或无头环境安全降级（零阻塞、直接返回 GOOD）
    if (assistMode === 'off' || !canRunInteractive(opts)) {
      cancelPreTelegraph();
      var skipBlockReduce = mode === 'block' ? calcBlockRate('GOOD', defRank, atkRank) : 0;
      var skipBonus = mode === 'attack' ? calcRingBonus(['GOOD'], { casualMode: casualMode }) : 0;
      var skipRes = {
        grade: 'GOOD',
        effectiveGrade: 'GOOD',
        bonus: skipBonus,
        multiplier: round6(1 + skipBonus),
        blockReduce: skipBlockReduce,
        blockRate: skipBlockReduce,
        deltaMs: 0,
        pressedKey: null,
        timedOut: false,
        skipped: true,
        cancelled: false,
        assistMode: assistMode,
        casualMode: casualMode,
        key: expectedKey,
        beatIdx: beatIdx,
        totalBeats: totalBeats,
      };
      if (typeof opts.onResolve === 'function') {
        try { opts.onResolve(skipRes); } catch (e) {}
      }
      return Promise.resolve(skipRes);
    }

    // 尝试无缝承接 showPreTelegraph 已挂载的预告键帽，避免闪屏重载并复用已缓存坐标
    var adoptedUi = null;
    var adoptedPt = null;
    if (!runtime.active && runtime.preTelegraph) {
      var pre = runtime.preTelegraph;
      var sameAnchor = (
        pre.mode === mode &&
        pre.expectedKey === expectedKey &&
        pre.actorKey === actorKey &&
        pre.beatIndex === beatIdx &&
        pre.totalBeats === totalBeats &&
        pre.ui && pre.ui.anchor && pre.ui.anchor.isConnected
      );
      if (sameAnchor) {
        runtime.preTelegraph = null;
        if (pre.rafId && typeof cancelAnimationFrame === 'function') {
          try { cancelAnimationFrame(pre.rafId); } catch (e) {}
        }
        if (pre.safetyTimer) {
          try { clearTimeout(pre.safetyTimer); } catch (e) {}
        }
        adoptedUi = pre.ui;
        if (!pre.layoutDirty && pre.layoutVersion === runtime.layoutVersion && pre.pt) {
          adoptedPt = pre.pt;
        }
      } else {
        cancelPreTelegraph();
      }
    } else {
      cancelPreTelegraph();
    }

    if (runtime.active) {
      cancel('superseded');
    }

    var token = ++runtime.sessionToken;
    runtime.active = true;
    runtime.mode = mode;
    runtime.phase = 'SHRINK_SLOWMO';
    attachKeyListener();

    var win = mode === 'block'
      ? resolveBlockWindow(assistMode)
      : resolveAttackWindow(opts.ampPct, assistMode);
    var layer = ensureLayer();
    var field = getArenaField();
    var cachedPt = adoptedPt || resolveActorPoint(actorKey, field, mode);

    var ui = adoptedUi;
    if (!ui && layer) {
      clearFadingAnchors();
      ui = mountReticle(layer, {
        mode: mode,
        expectedKey: expectedKey,
        x: cachedPt.x,
        y: cachedPt.y,
        beatIndex: beatIdx,
        totalBeats: totalBeats,
        prevGrades: Array.isArray(opts.prevGrades) ? opts.prevGrades : [],
      });
    } else if (ui && ui.anchor) {
      runtime.anchorEl = ui.anchor;
      if (!adoptedPt) {
        applyAnchorTransform(ui.anchor, cachedPt.x, cachedPt.y);
      }
    }

    if (ui && ui.anchor) {
      runtime.activeAnchorTracker = {
        actorKey: actorKey,
        field: field,
        mode: mode,
        anchor: ui.anchor,
        onUpdate: function (nextPt) {
          cachedPt = nextPt;
        },
      };
    }

    if (typeof opts.onStart === 'function') {
      try {
        opts.onStart({
          mode: mode,
          key: expectedKey,
          beatIdx: beatIdx,
          totalBeats: totalBeats,
          actorKey: actorKey,
          slowMoScale: effSlowMoScale,
        });
      } catch (e) {}
    }

    return new Promise(function (resolve) {
      var settled = false;
      var targetR = ui ? ui.targetR : (mode === 'block' ? R_TARGET_BLOCK : R_TARGET_ATTACK);
      var shrinkVelocity = (R_START - targetR) / Math.max(1, win.targetTimeMs);
      var shrinkElapsed = 0;
      var lastSweet = false;
      var lastTs = nowMs();

      var cleanupSessionState = function () {
        if (runtime.rafId && typeof cancelAnimationFrame === 'function') {
          try { cancelAnimationFrame(runtime.rafId); } catch (e) {}
        }
        runtime.rafId = 0;
        if (runtime.activeAnchorTracker && ui && runtime.activeAnchorTracker.anchor === ui.anchor) {
          runtime.activeAnchorTracker = null;
        }
        if (token === runtime.sessionToken) {
          runtime.active = false;
          runtime.mode = null;
          runtime.phase = 'IDLE';
          runtime.onKeyAttempt = null;
          runtime.cancelResolve = null;
          detachKeyListener();
          setVfxSlowMo(1.0);
        }
        if (layer) {
          layer.classList.remove('is-slowmo', 'is-block-mode');
        }
      };

      var finishGateBeat = function (grade, deltaMs, pressedKey, timedOut) {
        if (settled) return;
        settled = true;
        cleanupSessionState();

        // 唯一一次命中顿帧 (55ms) 与即时判定音效
        triggerVfxHitStop(HITSTOP_MS);
        playCue('judge_' + grade.toLowerCase());

        if (ui && ui.anchor) {
          ui.anchor.classList.remove('is-telegraph', 'is-shrinking', 'is-sweet');
          ui.anchor.classList.add('is-resolved', 'is-grade-' + grade.toLowerCase());
          if (runtime.anchorEl === ui.anchor) {
            runtime.anchorEl = null;
          }
          scheduleResolvedAnchorCleanup(ui.anchor, 220);
        }

        var blockReduce = mode === 'block' ? calcBlockRate(grade, defRank, atkRank) : 0;
        var effGrade = (mode === 'attack' && casualMode && grade === 'BAD') ? 'GOOD' : grade;
        var bonus = mode === 'attack' ? calcRingBonus([grade], { casualMode: casualMode }) : 0;
        var subText = mode === 'block'
          ? formatBlockSubText(blockReduce)
          : formatAttackSubText(grade, casualMode);
        var judgeY = Math.max(18, Math.round(cachedPt.y - targetR - 26));
        spawnJudgeFloat(layer, cachedPt.x, judgeY, grade, subText, mode);

        var result = {
          grade: grade,
          effectiveGrade: effGrade,
          bonus: bonus,
          multiplier: round6(1 + bonus),
          blockReduce: blockReduce,
          blockRate: blockReduce,
          deltaMs: Math.round(deltaMs),
          pressedKey: pressedKey,
          timedOut: !!timedOut,
          skipped: false,
          cancelled: false,
          assistMode: assistMode,
          casualMode: casualMode,
          key: expectedKey,
          beatIdx: beatIdx,
          totalBeats: totalBeats,
        };
        if (typeof opts.onResolve === 'function') {
          try { opts.onResolve(result); } catch (e) {}
        }
        resolve(result);
      };

      runtime.cancelResolve = function (reason) {
        if (settled) return;
        settled = true;
        cleanupSessionState();
        unmountAnchor();
        var cancelBonus = mode === 'attack' ? calcRingBonus(['BAD'], { casualMode: casualMode }) : 0;
        var cancelRes = {
          grade: 'BAD',
          effectiveGrade: (mode === 'attack' && casualMode) ? 'GOOD' : 'BAD',
          bonus: cancelBonus,
          multiplier: round6(1 + cancelBonus),
          blockReduce: 0,
          blockRate: 0,
          deltaMs: 0,
          pressedKey: null,
          timedOut: false,
          skipped: false,
          cancelled: true,
          cancelReason: reason || 'cancelled',
          assistMode: assistMode,
          casualMode: casualMode,
          key: expectedKey,
          beatIdx: beatIdx,
          totalBeats: totalBeats,
        };
        if (typeof opts.onResolve === 'function') {
          try { opts.onResolve(cancelRes); } catch (e) {}
        }
        resolve(cancelRes);
      };

      // 零延迟直入 slowMoScale 慢镜缩圈
      setVfxSlowMo(effSlowMoScale);
      if (layer) {
        layer.classList.add('is-slowmo');
        if (mode === 'block') layer.classList.add('is-block-mode');
        else layer.classList.remove('is-block-mode');
      }
      if (ui && ui.anchor) {
        ui.anchor.classList.remove('is-telegraph');
        ui.anchor.classList.add('is-shrinking');
      }
      playCue('ring_slowmo_in');

      runtime.onKeyAttempt = function (pressedKey) {
        if (settled || token !== runtime.sessionToken) return;
        var liveElapsed = shrinkElapsed + Math.max(0, Math.min(64, nowMs() - lastTs));
        var deltaMs = liveElapsed - win.targetTimeMs;
        var isRightKey = mode === 'block'
          ? pressedKey === 'Space'
          : pressedKey === expectedKey;
        var grade = isRightKey ? judgeDelta(deltaMs, win) : 'BAD';
        finishGateBeat(grade, deltaMs, pressedKey, false);
      };

      var tickGateFrame = function () {
        if (settled || token !== runtime.sessionToken) return;
        var cur = nowMs();
        var realDt = clamp(cur - lastTs, 0, 64);
        lastTs = cur;

        shrinkElapsed += realDt;
        var currentR = Math.max(R_MIN, R_START - shrinkVelocity * shrinkElapsed);
        if (ui && ui.shrinkRing) {
          var scaleStr = 'scale(' + (currentR / R_START).toFixed(4) + ')';
          ui.shrinkRing.style.transform = scaleStr;
          if (ui.shrinkGlint) ui.shrinkGlint.style.transform = scaleStr;
          var absD = Math.abs(shrinkElapsed - win.targetTimeMs);
          var isSweet = absD <= win.greatMs;
          if (ui.anchor && isSweet !== lastSweet) {
            lastSweet = isSweet;
            if (isSweet) ui.anchor.classList.add('is-sweet');
            else ui.anchor.classList.remove('is-sweet');
          }
        }

        if (shrinkElapsed >= win.durationMs) {
          finishGateBeat('BAD', shrinkElapsed - win.targetTimeMs, null, true);
          return;
        }

        runtime.rafId = requestAnimationFrame(tickGateFrame);
      };

      if (typeof requestAnimationFrame === 'function') {
        runtime.rafId = requestAnimationFrame(tickGateFrame);
      } else {
        var endTid = setTimeout(function () {
          removeRuntimeTimer(endTid);
          if (settled || token !== runtime.sessionToken) return;
          finishGateBeat('BAD', win.durationMs - win.targetTimeMs, null, true);
        }, win.durationMs);
        runtime.timers.push(endTid);
      }
    });
  }

  /* -------------------- 10. 全局与 CommonJS 导出 -------------------- */
  var api = {
    getAssistMode: getAssistMode,
    setAssistMode: setAssistMode,
    isCasualMode: isCasualMode,
    setCasualMode: setCasualMode,
    getBeatSpec: getBeatSpec,
    generateKeySequence: generateKeySequence,
    calcRingBonus: calcRingBonus,
    calcBlockRate: calcBlockRate,
    isActive: isActive,
    showPreTelegraph: showPreTelegraph,
    cancelPreTelegraph: cancelPreTelegraph,
    runGateBeat: runGateBeat,
    runAttackSequence: runAttackSequence,
    runBlockPrompt: runBlockPrompt,
    cancel: cancel,
    CONSTANTS: CONSTANTS,
  };

  if (global) {
    global.CombatTimingRing = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
