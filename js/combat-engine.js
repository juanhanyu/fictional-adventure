/* =========================================================
   转生千金 · 原著向策略智斗引擎 (js/combat-engine.js)
   V2.2 核心：双轨施法 × HSR行动值/弱点锁/ONE MORE × 双段质变魔力增幅 × 比值防御(K=80) × 冰晶宫殿并行推演 × 晦轮杖真伤
   ========================================================= */
(function (global) {
  'use strict';

  const ARENA_SAVE_KEY = 'ojousama_arena_records_v1';

  const COMBAT_BALANCE_V22 = {
    DEF_K: 80,
    MAX_DEF_PIERCE: 0.75,
    SAVE_MATK_SOFT_CAP: { gain: 18, scale: 32 },
    SHIELD_RETAIN_RATE: { default: 0.20, rootIce: 0.45 },
    OVERCAST: {
      seg1End: 0.25,
      seg1Slope: 1.60,
      seg2Slope: 0.50,
      tier1: { at: 0.25, mult: 1.08, extraLocks: 1, defPierce: 0.12, label: '魔力盈溢' },
      tier2: { at: 0.50, mult: 1.20, extraLocks: 2, defPierce: 0.25, label: '极寒过载' },
      skillCaps: {
        HAND_HEAVY: 0.50,
        REMOTE: 0.25,
        SHIELD: 0.25,
        SWORD: 0.00,
        INSIGHT: 0.00,
      },
    },
    MANA_CYCLE: {
      returnRatio: 1.00,
      specAltRatio: 0.55,
      aoeMaxReturnPct: 1.00,
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
        matkMult: 1.28, critDmgBonus: 0.20,
        extraMpPct: 0.00, overcastMpDiscount: 0.25,
      },
    },
    HSR_AV: {
      baseNumerator: 10000,
      breakVulnMult: 1.35,
      breakBurstMatkRatio: 0.55,
      breakRecoveryAtkMult: 0.75,
      pushPct: { mob: 0.50, elite: 0.45, boss: 0.35 },
      maxOneMorePerNaturalTurn: 1,
      oneMoreMpRefundPct: 0.12,
      overflowBreakBonus: { mpPct: 0.10, selfAdvancePct: 0.10 },
    },
    ACTS_PLAYER_PRESET: {
      beatrice_11:            { hp: 185, mp: 220, atk: 16, matk: 38, def: 12, mdef: 16, spd: 100 },
      rowan_graveyard:        { hp: 180, mp: 240, atk: 14, matk: 36, def: 12, mdef: 18, spd: 96  },
      alice_9:                { hp: 200, mp: 260, atk: 18, matk: 42, def: 13, mdef: 18, spd: 102 },
      aino_sparring:          { hp: 220, mp: 270, atk: 22, matk: 48, def: 15, mdef: 20, spd: 105 },
      noelle_14:              { hp: 245, mp: 290, atk: 26, matk: 54, def: 18, mdef: 24, spd: 106 },
      north_forest_hunt:      { hp: 270, mp: 310, atk: 46, matk: 58, def: 20, mdef: 26, spd: 110 },
      hulan_beast_tide:       { hp: 295, mp: 330, atk: 50, matk: 64, def: 24, mdef: 30, spd: 110 },
      turning_point_corridor: { hp: 290, mp: 320, atk: 44, matk: 62, def: 22, mdef: 28, spd: 110 },
      wind_god_eye:           { hp: 320, mp: 350, atk: 54, matk: 68, def: 26, mdef: 32, spd: 112 },
    },
  };

  function safeSfx(type) {
    try {
      if (global.CrystalSFX && typeof global.CrystalSFX.play === 'function') {
        global.CrystalSFX.play(type);
        return;
      }
      if (typeof global.sfx === 'function') global.sfx(type);
    } catch (e) {}
  }

  let _lastCardHoverSfxTs = 0;
  function playCardHoverSfx() {
    const now = Date.now();
    if (now - _lastCardHoverSfxTs < 65) return;
    _lastCardHoverSfxTs = now;
    safeSfx('card_hover');
  }

  function logTag(cls, txt, bold) {
    const tag = bold ? 'b' : 'span';
    return `<${tag} class="${cls}">${txt}</${tag}>`;
  }

  function formatShortMoveName(raw) {
    return String(raw || '').replace(/（[^）]*）\s*$/, '').replace(/\([^)]*\)\s*$/, '').trim();
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
    HAND: { tag: '【经手构筑】', short: '经手构筑', pill: '经手', desc: '稳固无气泡、正面高倍率与厚重防线，但具标准施法前摇' },
    REMOTE: { tag: '【隔空瞬凝】', short: '隔空瞬凝', pill: '隔空', desc: '零前摇于敌身侧生成！唯命中【双手控场】触发截断破招，盲丢严密防反仅30%威力且易遭反制' },
    SWORD: { tag: '【霁馆剑步】', short: '霁馆剑步', pill: '剑步', desc: '沉身卸力专克【贴身突袭】，享体能与物攻加成，且不产生冰系外显暴露波动' },
    INSIGHT: { tag: '【看破专武】', short: '冰宫看破', pill: '看破', desc: '经由冰晶宫殿两步微推理锁定敌方死角后解锁的单次针对性绝杀' },
  };

  const STANCE_META = {
    DUAL_CAST: {
      short: '双手控场',
      badge: '双手控场 · 侧翼真空',
      hint: '宜用「隔空瞬凝」零前摇突袭 → 触发截断破招',
    },
    CLOSE_LUNGE: {
      short: '贴身突袭',
      badge: '贴身突袭 · 高速扑杀',
      hint: '宜用「霁馆剑步 / 残像」 → 触发卸力闪反',
    },
    HEAVY_WINDUP: {
      short: '蓄力重击',
      badge: '蓄力重击 · 重心前压',
      hint: '宜立盾稳固防线，或以冰宫看破掀翻重心',
    },
    GUARD_COUNTER: {
      short: '严密防反',
      badge: '严密防反 · 零留白守势',
      hint: '忌盲丢隔空瞬凝，宜用「经手构筑」正面破防',
    },
    UNDER_SEEP: {
      short: '诡道暗流',
      badge: '诡道杀机 · 暗流越位',
      hint: '致命机制！宜开启冰晶宫殿推演破绽，切忌无防备强压',
    },
    STAGGERED: {
      short: '架势失衡',
      badge: '架势崩解 · 破招失衡',
      hint: '敌方本回合行动已中断且防线松动，承受伤害提升',
    },
  };

  const CB_SVG = {
    crystal: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v16M3 6l14 8M17 6L3 14"/><polygon points="10,4.5 14.8,7.2 14.8,12.8 10,15.5 5.2,12.8 5.2,7.2"/></svg>',
    palaceEmblem: '<svg viewBox="0 0 28 28" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="14,2 23,8 23,20 14,26 5,20 5,8" fill="rgba(56,189,248,0.14)"/><polygon points="14,6.5 19.5,14 14,21.5 8.5,14" fill="rgba(29,99,255,0.14)"/><path d="M14 2v24M5 8l18 12M23 8L5 20"/></svg>',
    wand: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16L13.5 6.5"/><circle cx="14.5" cy="5.5" r="2.6"/><path d="M10.5 3.2v1.3M16.8 9.5h-1.3"/></svg>',
    assist: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5l2.1 5.4 5.4 2.1-5.4 2.1L10 17.5l-2.1-5.4L2.5 10l5.4-2.1L10 2.5z"/></svg>',
    retreat: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5L3.5 9.5 8 14"/><path d="M3.5 9.5H13a3.5 3.5 0 010 7H10"/></svg>',
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
    rowan: 'assets/monsters/rowan_eclipse.png',
    rowan_graveyard: 'assets/monsters/rowan_eclipse.png',
    rowan_eclipse: 'assets/monsters/rowan_eclipse.png',
    wolf_alpha: 'assets/monsters/wolf_alpha.png',
    wolf_king: 'assets/monsters/wolf_alpha.png',
    north_forest_hunt: 'assets/monsters/wolf_alpha.png',
    pack_wolf: 'assets/monsters/pack_wolf.png',
    wolf: 'assets/monsters/pack_wolf.png',
    wolf_b: 'assets/monsters/pack_wolf.png',
    wolf_c: 'assets/monsters/pack_wolf.png',
    wolf_d: 'assets/monsters/pack_wolf.png',
    shadow_jackal: 'assets/monsters/shadow_jackal.png',
    jackal: 'assets/monsters/shadow_jackal.png',
    tundra_brute: 'assets/monsters/tundra_brute.png',
    hulan_brute: 'assets/monsters/tundra_brute.png',
    boar: 'assets/monsters/tundra_brute.png',
    golem: 'assets/monsters/tundra_brute.png',
    frost_hound: 'assets/monsters/frost_hound.png',
    frost_hound_a: 'assets/monsters/frost_hound.png',
    frost_hound_b: 'assets/monsters/frost_hound.png',
    ice_wolf: 'assets/monsters/frost_hound.png',
    abyss_behemoth: 'assets/monsters/abyss_behemoth.png',
    hulan_lord: 'assets/monsters/abyss_behemoth.png',
    hulan_beast_tide: 'assets/monsters/abyss_behemoth.png',
    ridge_claw: 'assets/monsters/ridge_claw.png',
    jackal_minor: 'assets/monsters/ridge_claw.png',
    corridor_vanguard: 'assets/monsters/corridor_vanguard.png',
    inquisitor: 'assets/monsters/corridor_vanguard.png',
    flame_mage: 'assets/monsters/flame_mage.png',
    flame_mage_a: 'assets/monsters/flame_mage.png',
    slime_fire: 'assets/monsters/flame_mage.png',
    eastwing_commander: 'assets/monsters/eastwing_commander.png',
    eastwing: 'assets/monsters/eastwing_commander.png',
    turning_point_corridor: 'assets/monsters/eastwing_commander.png',
    wind_god_tempest: 'assets/monsters/wind_god_tempest.png',
    wind_god_avatar: 'assets/monsters/wind_god_tempest.png',
    wind_god_eye: 'assets/monsters/wind_god_tempest.png',
    wind_god: 'assets/monsters/wind_god_tempest.png',
    frost_lizard: 'assets/monsters/frost_lizard.png',
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
    'assets/monsters/rowan_eclipse.png',
    'assets/monsters/wolf_alpha.png',
    'assets/monsters/pack_wolf.png',
    'assets/monsters/shadow_jackal.png',
    'assets/monsters/tundra_brute.png',
    'assets/monsters/frost_hound.png',
    'assets/monsters/abyss_behemoth.png',
    'assets/monsters/ridge_claw.png',
    'assets/monsters/corridor_vanguard.png',
    'assets/monsters/eastwing_commander.png',
    'assets/monsters/frost_lizard.png',
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
    'assets/monsters/rowan_eclipse.png',
    'assets/monsters/corridor_vanguard.png',
    'assets/monsters/eastwing_commander.png',
    'assets/monsters/flame_mage.png',
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
     1. 玩家战术技能库（高耗蓝匹配原著 100% 魔战循环等量回蓝）
     ========================================================= */
  const TACTICAL_SKILLS = {
    basic_attack: {
      id: 'basic_attack',
      name: '防身平斩',
      path: 'SWORD',
      elem: 'phys',
      ap: 1,
      mp: 0,
      power: 0.72,
      atkKind: 'atk',
      overcastCap: 0,
      lockDamage: 0,
      exposure: 0,
      shortDesc: '零耗蓝平斩 · 无魔战回蓝',
      desc: '基础挥击，零耗蓝，不触发魔战循环，对高防与风步收效甚微。',
    },

    // —— 【经手构筑】 ——
    hand_water_surge: {
      id: 'hand_water_surge',
      name: '覆潮水弹',
      path: 'HAND',
      elem: 'water',
      ap: 1,
      mp: 30,
      power: 1.52,
      atkKind: 'matk',
      overcastCap: 0.50,
      lockDamage: 1,
      exposure: 0,
      clearBlind: true,
      douseFire: true,
      shortDesc: '克火净尘 · 0冰暴露',
      desc: '经手压缩水流冲击，克制火系并冲净扬尘遮眼，零冰系暴露。',
    },
    hand_ice_crystal: {
      id: 'hand_ice_crystal',
      name: '凝华冰晶',
      path: 'HAND',
      elem: 'ice',
      ap: 1,
      mp: 38,
      power: 1.76,
      atkKind: 'matk',
      overcastCap: 0.50,
      lockDamage: 1,
      exposure: 66,
      chill: 1,
      shortDesc: '破盾高伤 · 附寒颤1',
      desc: '无气泡高密度凝冰直射，正面破盾力强，但施法路径较长。',
    },
    hand_ice_wall: {
      id: 'hand_ice_wall',
      name: '凝水厚冰墙',
      path: 'HAND',
      elem: 'ice',
      ap: 1,
      mp: 28,
      power: 0,
      atkKind: 'matk',
      noOvercast: true,
      overcastCap: 0.25,
      lockDamage: 0,
      shieldKind: 'solid',
      cooldown: 1,
      exposure: 65,
      shieldBase: 26,
      shieldScale: 0.55,
      shortDesc: '实体厚冰盾 · 冷却1回合',
      desc: '童年期习得的基础经手实体厚冰墙（冷却1回合），稳健抵御正面冲击并阻尼晦轮穿透。',
    },
    hand_frost_floor: {
      id: 'hand_frost_floor',
      name: '蔓地薄冰',
      path: 'HAND',
      elem: 'ice',
      ap: 1,
      mp: 18,
      power: 0,
      atkKind: 'matk',
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 0,
      cooldown: 1,
      exposure: 60,
      layFrostFloor: 2,
      shortDesc: '铺冰2回合 · 窄道锁腿',
      desc: '沿地表悄然铺开薄冰（持续2回合，冷却1回合），待敌穿过窄道时以冰晶锁腿！',
    },
    hand_root_shield: {
      id: 'hand_root_shield',
      name: '钢冰生根盾',
      path: 'HAND',
      elem: 'ice',
      ap: 1,
      mp: 34,
      power: 0,
      atkKind: 'matk',
      noOvercast: true,
      overcastCap: 0.25,
      lockDamage: 0,
      shieldKind: 'solid',
      cooldown: 1,
      exposure: 65,
      shieldBase: 31,
      shieldScale: 0.54,
      rooted: 1,
      iceThorns: 1,
      protectCrate: 32,
      shortDesc: '实体生根盾 · 防滑护药箱',
      desc: '魔力入地生根立起实体钢冰盾（冷却1回合），防冰面打滑并协防药箱。',
    },
    hand_water_veil: {
      id: 'hand_water_veil',
      name: '折射水幕',
      path: 'HAND',
      elem: 'water',
      ap: 1,
      mp: 26,
      power: 0,
      atkKind: 'matk',
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 0,
      shieldKind: 'magic',
      cooldown: 1,
      exposure: 0,
      shieldBase: 20,
      shieldScale: 0.45,
      clearDebuff: true,
      shortDesc: '柔盾净异常 · 0暴露',
      desc: '柔韧水膜护身（冷却1回合），洗净灼烧与视线受阻，零暴露。',
    },
    hand_thorn_field: {
      id: 'hand_thorn_field',
      name: '冰棘群刺阵',
      path: 'HAND',
      elem: 'ice',
      ap: 2,
      mp: 62,
      power: 1.56,
      atkKind: 'matk',
      overcastCap: 0.50,
      lockDamage: 1,
      cooldown: 1,
      aoe: true,
      sureHit: true,
      drainWindMp: 14,
      exposure: 72,
      chill: 1,
      shortDesc: '全场必中 · 群怪多倍回蓝',
      desc: '双手平推铺冰刺出九向地棘（冷却1回合）！全场必中，群怪魔战回蓝倍增！',
    },

    // —— 【隔空瞬凝（不经手 · 12岁学院艾诺点拨后习得）】 ——
    remote_blind_shot: {
      id: 'remote_blind_shot',
      name: '侧翼盲区冰弹',
      path: 'REMOTE',
      elem: 'ice',
      ap: 1,
      mp: 26,
      power: 0.92,
      interruptPower: 1.85,
      atkKind: 'matk',
      overcastCap: 0.25,
      lockDamage: 1,
      exposure: 65,
      shortDesc: '侧翼瞬凝 · 截断双手控场',
      desc: '不经手于敌身侧瞬凝！命中【双手控场】直接截断破招暴击！',
    },
    remote_snap_spike: {
      id: 'remote_snap_spike',
      name: '瞬发断咏冰锥',
      path: 'REMOTE',
      elem: 'ice',
      ap: 1,
      mp: 40,
      power: 1.08,
      interruptPower: 2.12,
      atkKind: 'matk',
      overcastCap: 0.25,
      lockDamage: 1,
      pierceHalfShield: true,
      exposure: 68,
      shortDesc: '瞬凝断咏 · 无视半数护盾',
      desc: '足下三十公分瞬凝尖锥，对【双手控场】断咏重创并无视半盾！',
    },

    // —— 【霁馆剑步（15岁澄岚霁馆习得 / 9岁决斗风行残像）】 ——
    sword_root_step: {
      id: 'sword_root_step',
      name: '生根步·卸力侧滑',
      path: 'SWORD',
      elem: 'phys',
      ap: 1,
      mp: 10,
      power: 0,
      atkKind: 'atk',
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 0,
      cooldown: 1,
      exposure: -6,
      dodgeLunge: true,
      rooted: 1,
      shortDesc: '卸力闪反突袭 · 蓄剑势',
      desc: '沉膝横移纯步法（零护盾，冷却1回合）！唯迎击【贴身突袭】触发卸力闪反并蓄势下一刀。',
    },
    sword_water_edge: {
      id: 'sword_water_edge',
      name: '送刀·覆水极薄冰锋',
      path: 'SWORD',
      elem: 'water',
      ap: 1,
      mp: 22,
      power: 1.18,
      lungeRipostePower: 2.05,
      atkKind: 'hybrid',
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 1,
      exposure: -10,
      counterLunge: true,
      shortDesc: '迎锋倍增 · 化水降暴露',
      desc: '活剑送刀裹极薄冰膜，事后化水降暴露！配合生根步蓄势或迎击扑杀威力倍增。',
    },
    sword_wind_afterimage: {
      id: 'sword_wind_afterimage',
      name: '风行残像',
      path: 'SWORD',
      elem: 'wind',
      ap: 1,
      mp: 18,
      power: 0,
      atkKind: 'atk',
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 0,
      selfAdvancePct: 0.25,
      cooldown: 3,
      exposure: 0,
      afterimage: 1,
      nextApBonus: 1,
      shortDesc: '闪避下击 · 拉条且下回合+1 AP',
      desc: '气流折射留残影（冷却3回合），闪避下一次攻击、自拉行动值并令下回合+1 AP！',
    },

    // —— 【❄️ 冰晶宫殿·专属看破反制技（每波审视解锁后限1次）】 ——
    insight_beatrice_pillar: {
      id: 'insight_beatrice_pillar',
      name: '❄️ 看破·封肩地下冰柱',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 18,
      power: 2.05,
      atkKind: 'matk',
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      maxUses: 1,
      interruptWindupOnly: true,
      shatterFireAura: true,
      applyVuln: 1,
      chill: 2,
      exposure: 20,
      shortDesc: '必中破斗气 · 截停重劈',
      desc: '算准她先抬右肩钉死重心的瞬间，地底冰柱一举掀翻全部斗气并截停重劈！',
    },
    insight_rowan_prism: {
      id: 'insight_rowan_prism',
      name: '❄️ 看破·双镜合拢夹杖',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 20,
      power: 1.65,
      atkKind: 'matk',
      overcastCap: 0,
      lockDamage: 2,
      shieldKind: 'solid',
      sureHit: true,
      maxUses: 1,
      forceInterrupt: true,
      sealBoost: 44,
      shieldBase: 30,
      shieldScale: 0.45,
      exposure: 15,
      shortDesc: '凌空夹杖 · 封锁+44%',
      desc: '识破他虚刺叔叔实则脱手掷杖袭心，双面冰镜凌空合拢死死夹住晦轮杖！',
    },
    insight_alice_cage: {
      id: 'insight_alice_cage',
      name: '❄️ 看破·封路十字冰栏',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 20,
      power: 1.65,
      atkKind: 'matk',
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      maxUses: 1,
      drainEnemyMp: 22,
      sealWindEvade: 3,
      exposure: 20,
      shortDesc: '封风步3回合 · 榨敌蓝',
      desc: '锁死左侧裙摆折射的绕后风轨，必中截停并封印风步闪避、重挫其魔力池！',
    },
    insight_aino_bead: {
      id: 'insight_aino_bead',
      name: '❄️ 看破·盲区弹指冰珠',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 18,
      power: 1.7,
      atkKind: 'matk',
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      bypassMirror: true,
      guaranteedCleanHit: true,
      maxUses: 1,
      exposure: 15,
      shortDesc: '穿镜弹手背 · 命中+1',
      desc: '越过正面无瑕镜冰，于体侧盲区瞬凝冰珠精准弹中艾诺手背（有效命中+1）！',
    },
    insight_noelle_sever: {
      id: 'insight_noelle_sever',
      name: '❄️ 看破·冻彻冰缝断流',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 16,
      power: 1.62,
      atkKind: 'matk',
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      severSeep: true,
      shatterShield: true,
      applyVuln: 1,
      maxUses: 1,
      exposure: 20,
      shortDesc: '冻绝暗流 · 碎盾附易伤',
      desc: '将暗渡至脚底冰缝的细水线彻底冻死，粉碎水幕并瓦解残血翻盘杀！',
    },
    insight_jackal_throat: {
      id: 'insight_jackal_throat',
      name: '❄️ 看破·沉身迎喉覆水斩',
      path: 'INSIGHT',
      elem: 'water',
      ap: 1,
      mp: 16,
      power: 2.15,
      atkKind: 'hybrid',
      noOvercast: true,
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      stripEvadeCharges: true,
      forceInterrupt: true,
      exposure: -15,
      maxUses: 1,
      shortDesc: '破闪必中 · 化水降暴露',
      desc: '锁死影豺腾空无法变向的下颌死角，覆水薄刃封喉且事后化水无痕！',
    },
    insight_hulan_resonance: {
      id: 'insight_hulan_resonance',
      name: '❄️ 看破·伊诺共鸣锁核',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 36,
      power: 2.25,
      atkKind: 'matk',
      overcastCap: 0.25,
      lockDamage: 2,
      sureHit: true,
      shatterShield: true,
      shredArmor: true,
      applyVuln: 2,
      protectCrate: 38,
      triggerAinoSpear: true,
      maxUses: 1,
      exposure: 0,
      shortDesc: '碎核破甲 · 引艾诺冰枪',
      desc: '锁定领主腹下微裂晶核引动共鸣，接应崖顶艾诺的无气泡极寒冰枪贯通破甲！',
    },
    insight_eastwing_draft: {
      id: 'insight_eastwing_draft',
      name: '❄️ 看破·仆道回风破幕',
      path: 'INSIGHT',
      elem: 'water',
      ap: 1,
      mp: 22,
      power: 2.2,
      atkKind: 'matk',
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      shatterShield: true,
      shatterFireAura: true,
      forceInterrupt: true,
      douseFire: true,
      clearDebuff: true,
      applyVuln: 2,
      maxUses: 1,
      exposure: 0,
      shortDesc: '回风灭火 · 碎盾破铁幕',
      desc: '借东翼仆人暗道灌入的逆向冷风，水雾裹霜直贯火幕气眼，熄灭烈焰并震碎封锁！',
    },
    insight_wind_stillness: {
      id: 'insight_wind_stillness',
      name: '❄️ 看破·风眼静滞穿心',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 24,
      power: 2.35,
      atkKind: 'hybrid',
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      shatterShield: true,
      stripEvadeCharges: true,
      sealWindEvade: 2,
      forceInterrupt: true,
      applyVuln: 2,
      chill: 2,
      maxUses: 1,
      exposure: 0,
      shortDesc: '贯破风眼 · 封身法碎盾',
      desc: '踏入飓风中心无风静滞的刹那，冰锋顺气眼贯破风暴护壁并封锁风神身法！',
    },
    insight_generic_flaw: {
      id: 'insight_generic_flaw',
      name: '❄️ 看破·凝霜贯隙刺',
      path: 'INSIGHT',
      elem: 'ice',
      ap: 1,
      mp: 20,
      power: 1.9,
      atkKind: 'matk',
      overcastCap: 0,
      lockDamage: 2,
      sureHit: true,
      shatterShield: true,
      forceInterrupt: true,
      applyVuln: 1,
      protectCrate: 28,
      maxUses: 1,
      exposure: 15,
      shortDesc: '贯隙必中 · 碎盾断蓄势',
      desc: '直击冰晶宫殿并行推演锁定的发力缝隙，击碎护甲并打断当前蓄势。',
    },
  };

  /* =========================================================
     2. 9 大代表性战斗关卡配置表（严格遵循原著时间线与能力树）
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
      tags: ['水克火1.5x', '三层烈焰斗气', '抬肩前摇看破'],
      summary: '三层烈焰斗气 + 火球重劈与剑障防反！盲目单招复读会被融冰反劈，须交替水冰破招或以冰宫地下冰柱一举掀翻斗气。',
      preset: {
        age: 9,
        hp: 165, mhp: 165, mp: 230, mmp: 230,
        atk: 14, matk: 35, def: 9, mdef: 12, spd: 100,
        skills: ['basic_attack', 'hand_water_surge', 'hand_ice_crystal', 'hand_ice_wall', 'hand_water_veil'],
        passives: [],
        manaCycle: false,
        eclipseWand: false,
        palaceCharges: 1,
      },
      reward: { duelKey: 'beatrice_11', skillId: 'temp_sense', skillName: '温度感知', exp: 50, gold: 0 },
      palace: {
        sceneText: '意识沉入冰晶宫殿，淡蓝色虚拟斗兽场的交锋画面在冰镜间并行映现。贝阿特丽丝周身环绕燥热气浪，掌心火球膨胀，正准备踏步重劈。',
        clues: [
          { id: 'ponytail', text: '高高扬起的金色马尾正随热浪向右后方飘摆', correct: false, feedback: '马尾只是随热浪自然摆动，并未暴露发力落点。' },
          { id: 'shoulder_lift', text: '甩出重型火球前，她的右肩习惯性先抬半寸', correct: true, feedback: '观察准确！她发力前必先抬右肩，重心已提前钉死。' },
          { id: 'boot_scuff', text: '靴尖重重踏进石板缝隙，带起一串细碎火星', correct: false, feedback: '直线踏步只是常规冲势，单看靴底难以提前反制。' },
        ],
        deductions: [
          { id: 'rush_face', text: '趁她抬肩正面迎上，与火焰气浪硬拼魔力输出', correct: false, feedback: '正面热浪正盛，硬拼只会白白损耗魔力。' },
          { id: 'under_pillar', text: '算准她抬肩钉死重心的落点，从地底顶出冰柱', correct: true, unlockSkill: 'insight_beatrice_pillar', feedback: '推演完成！地下冰柱可一举掀翻她的三层烈焰斗气并截停重劈！' },
        ],
      },
      waves: [
        {
          intro: '贝阿特丽丝叉着腰掌心冒火：「来决斗？正好贝阿特丽丝大人手痒了，可不会手下留情哦！」',
          enemies: [
            {
              id: 'beatrice',
              charId: 'beatrice',
              name: '贝阿特丽丝（11岁）',
              emoji: '🔥',
              elem: 'fire',
              hp: 278,
              mhp: 278,
              atk: 36,
              def: 10,
              mdef: 18,
              spd: 96,
              maxLocks: 5,
              shieldKind: 'magic',
              fireAura: 3,
              trait: '三层烈焰斗气：每层减免10%伤害并逐回合升温；受覆潮水弹逐层浇弱，或以看破冰柱一击掀翻。剑障防反时忌盲丢冰晶！',
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
      tags: ['8岁童年配装', '白昼冰镜核验', '窄道铺冰+双镜夹杖', '打死算逃脱失败'],
      summary: '秋夜月升，罗文影子已恢复正常。须用8岁基础薄冰配合雷纳德切窄道锁腿，借冰晶宫殿核验白昼第四面冰镜并识破脱手旋杖，凑满100%封锁活捉！',
      sealRule: true,
      preset: {
        age: 8,
        hp: 150, mhp: 150, mp: 255, mmp: 255,
        atk: 12, matk: 35, def: 8, mdef: 12, spd: 96,
        skills: ['basic_attack', 'hand_ice_crystal', 'hand_ice_wall', 'hand_frost_floor', 'hand_water_veil'],
        passives: [],
        manaCycle: false,
        eclipseWand: false,
        palaceCharges: 1,
      },
      reward: { exp: 140, gold: 0 },
      palace: {
        sceneText: '秋夜月升，罗文脚下影子已恢复如常。你边退边沉入冰晶宫殿核对白昼存档的四面冰镜，同时以并行记忆拆解眼前他刺向雷纳德肋下的右手。',
        clues: [
          { id: 'moon_grass', text: '月光下坟头荒草倒伏，罗文靴底沾着新翻的腐殖泥', correct: false, feedback: '乱葬岗新土本就松软，泥渍无法解释他的真正杀招。' },
          { id: 'mirror_thumb', text: '第四面冰镜日影慢半拍，且眼前他握杖拇指已半松', correct: true, feedback: '核验吻合！白昼日蚀止息时的迟滞日影证实他便是施术者，而此刻松指正是脱手掷杖前兆！' },
          { id: 'cloak_cut', text: '黑衣下摆被歪斜墓碑刮裂，露出一截暗银色内衬边', correct: false, feedback: '衣摆裂口只是穿过石碑时的擦痕，并非致命机关。' },
        ],
        deductions: [
          { id: 'aid_reno', text: '将冰墙横插在雷纳德身侧，替叔叔挡下肋下这一刺', correct: false, feedback: '雷纳德早已侧身避让，他的真正目标根本在后面！' },
          { id: 'clamp_staff', text: '预判他虚刺叔叔实则脱手掷杖袭心，双镜凌空合拢', correct: true, unlockSkill: 'insight_rowan_prism', feedback: '推演完成！解锁「双镜合拢夹杖」，待他掷杖袭心时凌空锁死晦轮杖！' },
        ],
      },
      waves: [
        {
          intro: '雷纳德从歪脖子树跳下：「别当着家长的面打小孩。」注意：必须留活口审问，打空罗文生命将致其化雾遁逃失败！',
          enemies: [
            {
              id: 'rowan',
              name: '罗文（圣级血族侍卫）',
              emoji: '🌑',
              elem: 'dark',
              hp: 290,
              mhp: 290,
              atk: 48,
              def: 15,
              mdef: 18,
              spd: 114,
              maxLocks: 4,
              shieldKind: 'magic',
              trait: '活捉铁律：纯挨打不涨封锁度，非窄道盲丢冰晶遭晦轮折射且HP归零将化雾逃脱判败！晦轮黑光无视纯魔盾，唯实体厚冰墙与石板可阻尼；须铺【蔓地薄冰】抓窄道(+38%)配【双镜夹杖】满100%活捉！',
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
      tags: ['扬尘必偏斜', '双层风步闪避', '封路榨蓝自断风暴'],
      summary: '扬尘遮蔽视线 + 每回合双层风步闪避 + 微风回蓝！普攻挥空无法耗其魔力，须用水弹洗尘、冰棘压走位或冰宫封锁风轨榨干她的魔力池！',
      preset: {
        age: 11,
        hp: 155, mhp: 155, mp: 295, mmp: 295,
        atk: 15, matk: 38, def: 9, mdef: 13, spd: 102,
        skills: ['basic_attack', 'hand_water_surge', 'hand_ice_crystal', 'hand_ice_wall', 'hand_water_veil', 'hand_thorn_field'],
        passives: ['temp_sense'],
        manaCycle: false,
        eclipseWand: false,
        palaceCharges: 1,
      },
      reward: { duelKey: 'alice_9', skillId: 'wind_afterimage', skillName: '风行残像', exp: 75, gold: 0 },
      palace: {
        sceneText: '意识沉入冰晶宫殿，地面灰尘扬起的瞬间在脑海冰镜中并列回放。微风在爱丽丝身畔轻巧盘旋，她的身影正借风向侧方滑开。',
        clues: [
          { id: 'calm_eyes', text: '白发垂落耳际，半敛的蓝眸平静注视着正前方', correct: false, feedback: '妹妹神色始终安静淡然，眼神并未指向落脚位置。' },
          { id: 'skirt_wind', text: '扬尘漫起瞬间，她左侧裙摆逆着微风轻轻内贴', correct: true, feedback: '观察准确！「是因为风在帮我」——裙摆内贴暴露了她借风绕左的气流轨！' },
          { id: 'tiny_hands', text: '双手自然微张于身前，指尖萦绕着淡青色微光', correct: false, feedback: '指尖微光只是基础导引，真正的机动藏在脚下风向里。' },
        ],
        deductions: [
          { id: 'front_wall', text: '在正前方立起高大冰墙，彻底隔绝扑面而来的尘雾', correct: false, feedback: '她已经绕向侧翼，正面冰墙只会挡住你自己的视野。' },
          { id: 'cross_cage', text: '顺着气流折射锁死左侧落点，以十字冰栏截停风步', correct: true, unlockSkill: 'insight_alice_cage', feedback: '推演完成！十字冰栏可彻底封印她的风步闪避并大幅耗损其魔力！' },
        ],
      },
      waves: [
        {
          intro: '爱丽丝安静站定：「……请姐姐大人多多指教。」微风在她周身凝成两层轻羽护流。',
          enemies: [
            {
              id: 'alice',
              charId: 'alice',
              name: '爱丽丝（9岁）',
              emoji: '💨',
              elem: 'wind',
              hp: 440,
              mhp: 440,
              mp: 64,
              mmp: 64,
              windCushion: true,
              evadeCharges: 2,
              maxEvadeCharges: 2,
              atk: 36,
              def: 9,
              mdef: 15,
              spd: 122,
              maxLocks: 3,
              shieldKind: 'magic',
              trait: '微风护体：每回合维持2层风步闪避并自然回流7 MP；第4/7回合合拢蓄力狂岚（若MP不足22将当场溃散认输）！',
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
      tags: ['唯3次有效命中可胜', '正面镜冰免伤', '盲丢瞬凝触发反刺'],
      summary: '纯冰系切磋，唯抢满3次有效命中可获胜（9回合限时）！正面经手全被无气泡镜冰格挡，非空档期乱丢隔空瞬凝将遭反刺丢分！',
      hitRule: true,
      targetHits: 3,
      turnLimit: 9,
      iceOnlyRule: true,
      preset: {
        age: 12,
        hp: 175, mhp: 175, mp: 255, mmp: 255,
        atk: 18, matk: 46, def: 11, mdef: 16, spd: 105,
        skills: ['basic_attack', 'hand_ice_crystal', 'hand_root_shield', 'remote_blind_shot', 'remote_snap_spike', 'sword_wind_afterimage'],
        passives: ['temp_sense'],
        manaCycle: false,
        eclipseWand: false,
        palaceCharges: 1,
      },
      reward: { duelKey: 'aino_cur', skillId: 'root_ice', skillName: '生根之冰', taskId: 'ice_hits', exp: 120, gold: 0 },
      palace: {
        sceneText: '训练场砂地覆霜，冰晶宫殿在意识深处并行展开两幅镜面。艾诺白发高束如出鞘利剑，双掌正同时按向地面引导双翼冰刺。',
        clues: [
          { id: 'front_mirror', text: '身前薄冰光滑如打蜡玻璃，内部找不到半点气泡', correct: false, feedback: '正面薄冰毫无瑕疵，强攻正面只会撞碎自己的冰晶。' },
          { id: 'left_shoulder_gap', text: '双掌同时贴地控冰时，左肩与右手背外侧空出半秒', correct: true, feedback: '观察准确！双手控场瞬间，体侧三十公分处于防御真空！' },
          { id: 'silver_ponytail', text: '高束的银白长发垂直落下，足尖稳稳扣住冻结砂面', correct: false, feedback: '她的下盘生根极稳，足尖并无破绽。' },
        ],
        deductions: [
          { id: 'heavy_spear', text: '凝聚更粗重的经手冰矛，全力轰击她正面的薄冰盾', correct: false, feedback: '经手释放路径太长，她一眼便能提前加厚冰盾。' },
          { id: 'snap_bead', text: '绕开正面镜冰，于她体侧盲区空气中瞬凝冰珠弹手背', correct: true, unlockSkill: 'insight_aino_bead', feedback: '推演完成！解锁「看破·盲区弹指冰珠」，直接拿下一记关键有效命中！' },
        ],
      },
      waves: [
        {
          intro: '艾诺：「规则简单。只用冰系魔法，9回合内打中三次算赢。战斗可不会给你三秒准备时间。」',
          enemies: [
            {
              id: 'aino',
              charId: 'aino',
              name: '艾诺·塔尔维',
              emoji: '🧊',
              elem: 'ice',
              hp: 999,
              mhp: 999,
              nonLethalSpar: true,
              atk: 54,
              def: 16,
              mdef: 20,
              spd: 116,
              maxLocks: 3,
              shieldKind: 'solid',
              mirrorGuard: true,
              trait: '显微镜视力：正面【经手】全被薄冰挡下；非【双手控场】回合盲丢【隔空瞬凝】不仅无效，连丢更会触发反制冰刺丢分！',
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
      tags: ['100%魔战循环解锁', '零留白水幕', '残血必入冰缝暗流杀'],
      summary: '极致省蓝大师 vs 魔战循环！每回合布设52点尺量水幕；压至残血必借水垫切入【冰缝暗流陷阱】，须以看破断流或残像避险后再以极寒过载魔力增幅斩杀！',
      preset: {
        age: 14,
        hp: 190, mhp: 190, mp: 260, mmp: 260,
        atk: 20, matk: 46, def: 13, mdef: 20, spd: 106,
        skills: ['basic_attack', 'hand_ice_crystal', 'hand_root_shield', 'hand_thorn_field', 'remote_blind_shot', 'remote_snap_spike', 'sword_wind_afterimage'],
        passives: ['temp_sense', 'root_ice'],
        manaCycle: true,
        eclipseWand: false,
        palaceCharges: 1,
      },
      reward: { duelKey: 'noelle_14', skillId: 'mana_calc', skillName: '魔力精算', achId: 'mana_calc', exp: 150, gold: 0 },
      palace: {
        sceneText: '意识沉入冰晶宫殿，灰色石板广场上刚才数步交锋被并列映出。诺艾儿每一步后撤间距分毫不差，琥珀色眸子冷静得如同正在解算方程。',
        clues: [
          { id: 'left_hand_blank', text: '左手习惯性半握在腰侧，梦境中的手背空空如也', correct: false, feedback: '梦境未同步她手背的日程字迹，这并非她的反击后手。' },
          { id: 'thin_curtain', text: '正面水幕薄如纸页，边缘尺寸恰好卡死冰晶落点', correct: false, feedback: '正面水幕只是她省蓝防守的常态，真正杀招藏在地面！' },
          { id: 'ice_crack_waterline', text: '等距后撤间，一缕细水线正顺冰缝悄悄渗向脚底', correct: true, feedback: '观察准确！她一直在借冰层裂缝向你脚底暗渡水线，正面冰盾根本挡不住脚底穿刺！' },
        ],
        deductions: [
          { id: 'rush_break', text: '趁她魔力见底水幕变薄，欺身前压倾泻冰晶强攻', correct: false, feedback: '一旦重心前压踏实，脚底暗水线便会瞬间贯穿翻盘！' },
          { id: 'freeze_seep', text: '止步稳住重心，将寒气灌入脚下冻绝冰缝暗水线', correct: true, unlockSkill: 'insight_noelle_sever', feedback: '推演完成！解锁「看破·冻彻冰缝断流」，彻底废除她的残血翻盘杀并击碎水幕！' },
        ],
      },
      waves: [
        {
          intro: '诺艾儿站在十五米外，每一滴魔力都当最后一滴用。利用【魔战循环】消耗她的魔力池，并提防冰面下的暗流！',
          enemies: [
            {
              id: 'noelle',
              charId: 'noelle',
              name: '诺艾儿（14岁）',
              emoji: '💧',
              elem: 'water',
              hp: 660,
              mhp: 660,
              mp: 175,
              mmp: 175,
              atk: 44,
              def: 14,
              mdef: 20,
              spd: 104,
              maxLocks: 5,
              shieldKind: 'magic',
              seepStacks: 0,
              trait: '尺量水幕 & 脚底暗流：每回合维持52点精准水幕；生命降至165时必借水垫退入【冰缝暗流陷阱】，无视正面护盾直刺脚底造成205点重创！',
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
      tags: ['每波独立1次冰宫', 'W1四狼逼AOE满蓝', 'W2耳目禁冰+生根步闪反'],
      summary: 'W1四只灰棘狼高伤围猎，须以冰棘群刺触发魔战多倍回满蓝条；W2银级影豺带闪避层扑喉且极光小队迫近，须先以生根步卸力闪反再覆水封喉！',
      preset: {
        age: 15,
        hp: 220, mhp: 220, mp: 280, mmp: 280,
        atk: 42, matk: 48, def: 15, mdef: 22, spd: 110,
        skills: ['hand_ice_crystal', 'hand_water_surge', 'hand_root_shield', 'hand_water_veil', 'hand_thorn_field', 'remote_snap_spike', 'sword_root_step', 'sword_water_edge', 'sword_wind_afterimage'],
        passives: ['temp_sense', 'root_ice', 'mana_calc'],
        manaCycle: true,
        eclipseWand: true,
        palaceCharges: 1,
      },
      reward: { skillId: 'stealth_edge', skillName: '覆水无痕', exp: 180, gold: 35 },
      palaceByWave: {
        0: {
          sceneText: '冬日落叶林深处，意识在冰晶宫殿并行复现狼群步距。四只灰棘狼踏在潮湿腐叶层上呈扇形合围扑近。',
          clues: [
            { id: 'wolf_fur', text: '头狼脊背硬刺根根倒竖，前爪刨开林间枯黄腐叶', correct: false, feedback: '脊背硬刺只是交付任务的素材，并非合围破绽。' },
            { id: 'wet_leaves', text: '四狼呈密集扇形争抢扑近，脚下湿腐叶极易覆冰', correct: true, feedback: '观察准确！群居魔物站位密集且地面潮湿，正是群攻良机！' },
            { id: 'dead_wood', text: '后方倒木布满青苔爪痕，灌木丛间枝条剧烈晃动', correct: false, feedback: '倒木位于外圈，无法阻挡正面四狼扑咬。' },
          ],
          deductions: [
            { id: 'single_pick', text: '逐一瞄准后排灰棘狼，以单发水弹稳健点名清理', correct: false, feedback: '四狼场攻极高，单点清理太慢会被围攻重创。' },
            { id: 'thorn_sweep', text: '平推铺开贴地薄冰，刺出九向冰棘令狼群集体失衡', correct: true, unlockSkill: 'insight_generic_flaw', feedback: '推演完成！范围覆盖天然克制群体！' },
          ],
        },
        1: {
          sceneText: '林外百步传来「极光」小队凯尔的交谈声！冰晶宫殿内并行映出扑击轨迹，银级「霜脊影豺」已四爪离地扑向咽喉！',
          clues: [
            { id: 'camo_coat', text: '银灰皮毛与枯枝色调相融，落地时足垫悄无声息', correct: false, feedback: '它已经腾空起跳，保护色不再影响交手。' },
            { id: 'midair_jaw', text: '四爪腾空扑咬离地，半空中的下颌与咽喉无法变向', correct: true, feedback: '观察准确！全力腾空后它无法在半空二次借力变向！' },
            { id: 'kyle_voice', text: '百步外林间隐约传来交谈，极光小队正在附近搜寻', correct: false, feedback: '只要不动用外显冰系与晦轮杖，他们便不会察觉。' },
          ],
          deductions: [
            { id: 'ice_blast', text: '原地张开大型冰棱阵，将半空中的影豺冻成冰雕', correct: false, feedback: '外显冰系魔力与切口会立刻引来极光小队！' },
            { id: 'water_throat', text: '沉身迎向死角送出覆水薄刃，事后化水不留痕迹', correct: true, unlockSkill: 'insight_jackal_throat', feedback: '推演完成！解锁「看破·沉身迎喉覆水斩」，零暴露一剑封喉！' },
          ],
        },
      },
      waves: [
        {
          witnessActive: false,
          intro: '【第 1/2 波 · 无人深林】四只灰棘狼合围扑来（总场攻极高）！四周无人，立即用【冰棘群刺阵】触发魔战循环多倍回满蓝条！',
          enemies: [
            { id: 'wolf_alpha', name: '灰棘头狼', emoji: '🐺', elem: 'wind', hp: 195, mhp: 195, shield: 20, shieldKind: 'solid', atk: 34, def: 8, mdef: 8, spd: 108, maxLocks: 3, trait: '群狼头领：仰首群嚎令全群攻击暴涨。', aiType: 'pack_wolf' },
            { id: 'wolf_b', name: '灰棘狼·甲', emoji: '🐺', elem: 'wind', hp: 118, mhp: 118, shieldKind: 'solid', atk: 27, def: 5, mdef: 5, spd: 102, maxLocks: 2, trait: '凶猛合围：单点清理过慢将被群狼撕碎。', aiType: 'pack_wolf' },
            { id: 'wolf_c', name: '灰棘狼·乙', emoji: '🐺', elem: 'wind', hp: 118, mhp: 118, shieldKind: 'solid', atk: 27, def: 5, mdef: 5, spd: 102, maxLocks: 2, trait: '凶猛合围：单点清理过慢将被群狼撕碎。', aiType: 'pack_wolf' },
            { id: 'wolf_d', name: '灰棘狼·丙', emoji: '🐺', elem: 'wind', hp: 118, mhp: 118, shieldKind: 'solid', atk: 27, def: 5, mdef: 5, spd: 102, maxLocks: 2, trait: '凶猛合围：单点清理过慢将被群狼撕碎。', aiType: 'pack_wolf' },
          ],
        },
        {
          witnessActive: true,
          initialExposure: 35,
          intro: '⚠️【第 2/2 波 · 耳目迫近】银级「霜脊影豺」突袭！林外极光小队正在勘察——忌用外显冰系与晦轮杖，先以【生根步】卸掉锁喉扑杀再覆水斩杀！',
          enemies: [
            {
              id: 'shadow_jackal',
              name: '霜脊影豺（银级）',
              emoji: '🦊',
              elem: 'ice',
              hp: 495,
              mhp: 495,
              evadeCharges: 1,
              maxEvadeCharges: 1,
              atk: 66,
              def: 20,
              mdef: 40,
              spd: 124,
              maxLocks: 5,
              shieldKind: 'magic',
              trait: '疾影锁喉：常备【💨疾影闪避×1】躲避鲁莽直击；须先以【生根步】卸掉锁喉扑杀破其闪避，再以覆水剑锋斩杀！',
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
      tags: ['每波独立1次冰宫', '守护医疗药箱', '破招协同艾诺冰枪', '晦轮杖真伤破甲'],
      summary: '5星终极战！守护药箱免遭冲撞，借每波冰宫看破或连续截断破招引动崖顶艾诺极寒冰枪震碎领主实体晶核，辅以晦轮杖真伤与极寒过载魔力增幅轰杀领主！',
      crateRule: true,
      ainoSupport: true,
      preset: {
        age: 16,
        hp: 250, mhp: 250, mp: 300, mmp: 300,
        atk: 45, matk: 54, def: 18, mdef: 25, spd: 110,
        skills: ['hand_ice_crystal', 'hand_root_shield', 'hand_thorn_field', 'remote_blind_shot', 'remote_snap_spike', 'sword_root_step', 'sword_water_edge', 'sword_wind_afterimage'],
        passives: ['temp_sense', 'root_ice', 'mana_calc'],
        manaCycle: true,
        eclipseWand: true,
        palaceCharges: 1,
      },
      reward: { achId: 'hulan_vanguard', exp: 260, gold: 80 },
      palaceByWave: {
        0: {
          sceneText: '赫兰暴雪如铁锤砸落，冰晶宫殿在意识中并行对照风雪与冲锋轴线。冻土重甲兽低头瞄准医疗药箱蓄力，两侧霜原狂狼同时扑近。',
          clues: [
            { id: 'snow_gust', text: '北境狂风裹挟六角暴雪，顺着狭窄冰谷呼啸灌入', correct: false, feedback: '风雪虽急，眼下最紧迫的是重甲兽撞向药箱的冲势。' },
            { id: 'armor_joint', text: '重甲兽低头冲向药箱，前膝甲片交叠缝隙正微张', correct: true, feedback: '观察准确！前膝甲缝正是截停它冲撞药箱的唯一支点！' },
            { id: 'wagon_wheel', text: '补给车木轮冻在冰层里，帆布篷顶积满厚重白雪', correct: false, feedback: '车体已冻牢，护住前侧药箱即可。' },
          ],
          deductions: [
            { id: 'ignore_box', text: '放任重甲兽撞向药箱，全力集火两侧的霜原狂狼', correct: false, feedback: '药箱一旦被撞毁，前线伤员防线便彻底崩溃！' },
            { id: 'guard_joint', text: '寒霜贯入前膝甲缝截停冲势，延展冰障护住药箱', correct: true, unlockSkill: 'insight_generic_flaw', feedback: '推演完成！截停冲锋并护住补给药箱！' },
          ],
        },
        1: {
          sceneText: '冰封峡谷剧震！冰晶宫殿将崖顶微光与地脉震波并列核对，领主级「霜渊裂地兽」披三寸灰岩冻甲破土而出，崖顶闪过一抹熟悉的浅蓝发丝与无气泡寒光。',
          clues: [
            { id: 'thick_carapace', text: '背部覆盖三寸厚灰岩冻甲，寻常冰刃难留半点痕', correct: false, feedback: '正面冻甲双抗极高，强砸背部如同挠痒。' },
            { id: 'blizzard_sky', text: '铅灰云层压得极低，漫天风雪遮蔽峡谷远端视野', correct: false, feedback: '云层并无异常，支援来自侧上方崖顶！' },
            { id: 'fissure_core', text: '震地前腹下幽蓝晶核微裂，恰与崖顶寒光成一线', correct: true, feedback: '观察准确！腹下散热晶核正处于高处艾诺冰枪的射击轴线上！' },
          ],
          deductions: [
            { id: 'solo_smash', text: '无视高处寒光轨迹，独自贴近正面硬撼灰岩重甲', correct: false, feedback: '领主重甲会不断再生，单靠蛮力来不及护住药箱。' },
            { id: 'aino_sync', text: '锁定腹下晶核引动共鸣，接应崖顶极寒冰枪破甲', correct: true, unlockSkill: 'insight_hulan_resonance', feedback: '推演完成！「冬天的孩子终会回到冬天」——解锁「伊诺共鸣锁核」贯通重甲！' },
          ],
        },
      },
      waves: [
        {
          witnessActive: false,
          intro: '【第 1/2 波 · 峡谷防线】冻土重甲兽携狂狼扑向医疗药箱！用群刺打狂狼回蓝，抓蓄力空档截断护箱，注意实体厚甲会阻尼晦轮穿透！',
          enemies: [
            { id: 'tundra_brute', name: '冻土重甲兽', emoji: '🐗', elem: 'earth', hp: 265, mhp: 265, shield: 55, shieldKind: 'solid', solidArmor: 0.35, atk: 46, def: 42, mdef: 38, spd: 82, maxLocks: 5, trait: '攻城实体重甲：具35%实体甲阻尼与高双抗且猛撞药箱；惧怕【隔空截断】与【魔力增幅】破锁！', aiType: 'hulan_brute' },
            { id: 'frost_hound_a', name: '霜原狂狼·甲', emoji: '🐺', elem: 'ice', hp: 132, mhp: 132, shieldKind: 'solid', atk: 34, def: 8, mdef: 10, spd: 106, maxLocks: 3, trait: '成群撕咬：绝佳的魔战循环回蓝踏板。', aiType: 'pack_wolf' },
            { id: 'frost_hound_b', name: '霜原狂狼·乙', emoji: '🐺', elem: 'ice', hp: 132, mhp: 132, shieldKind: 'solid', atk: 34, def: 8, mdef: 10, spd: 106, maxLocks: 3, trait: '成群撕咬：绝佳的魔战循环回蓝踏板。', aiType: 'pack_wolf' },
          ],
        },
        {
          witnessActive: false,
          intro: '❄️【第 2/2 波 · 领主降临 & 故人冰枪】领主「霜渊裂地兽」破冰而出！可用冰宫引动【伊诺共鸣】，或连续抓准【双手聚寒】破招引落两记艾诺冰枪震碎实体晶核！',
          enemies: [
            {
              id: 'abyss_behemoth',
              name: '霜渊裂地兽（领主）',
              emoji: '🗿',
              elem: 'earth',
              hp: 650,
              mhp: 650,
              shield: 115,
              shieldKind: 'solid',
              solidArmor: 0.35,
              atk: 66,
              def: 46,
              mdef: 44,
              spd: 88,
              maxLocks: 6,
              boss: true,
              trait: '冻土领主：晶核未碎前具35%实体厚甲、每回合再生冻甲并寒震药箱；可借冰宫【伊诺共鸣】或连续【截断破招】引落第二发艾诺冰枪击碎晶核清零实体甲！',
              aiType: 'hulan_lord',
            },
            {
              id: 'ridge_claw',
              name: '寒脊爪兽',
              emoji: '🦎',
              elem: 'wind',
              hp: 165,
              mhp: 165,
              shieldKind: 'solid',
              atk: 42,
              def: 12,
              mdef: 12,
              spd: 118,
              maxLocks: 3,
              trait: '侧翼袭扰：高速突袭补给线。',
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
      tags: ['二阶段红莲铁幕', '双波火廊突围', '仆道回风看破', '封廊锁火截断'],
      summary: '政变火夜公爵府东翼长廊！前波须破宫廷突击队长与赤炎术士夹击；后波「红莲铁幕」半血步入二阶段，须借仆人暗道回风看破火眼，截断锁火并迎锋破袭！',
      preset: {
        age: 14,
        hp: 235, mhp: 235, mp: 290, mmp: 290,
        atk: 36, matk: 52, def: 15, mdef: 22, spd: 110,
        skills: ['hand_water_surge', 'hand_ice_crystal', 'hand_root_shield', 'hand_water_veil', 'hand_thorn_field', 'remote_snap_spike', 'sword_root_step', 'sword_water_edge'],
        passives: ['temp_sense', 'root_ice', 'mana_calc'],
        manaCycle: true,
        eclipseWand: true,
        palaceCharges: 1,
      },
      reward: { exp: 280, gold: 90 },
      palaceByWave: {
        0: {
          sceneText: '东翼长廊浓烟翻涌，火把接连熄灭。冰晶宫殿在脑海并行回溯走廊站位，宫廷突击队长持戟前压，身后的赤炎术士正低吟蓄火封锁走廊。',
          clues: [
            { id: 'hall_halberd', text: '突击队长精钢长戟映着暗红火光，戟尖正对准长廊中轴', correct: false, feedback: '正面长戟只是压迫防线，真正封死退路的火势来自后排术士。' },
            { id: 'mage_channel', text: '赤炎术士双掌平举催动火墙，侧翼门框恰露出一线空档', correct: true, feedback: '观察准确！后排术士双手控火之际，侧翼门框正处于防御真空。' },
            { id: 'carpet_ember', text: '脚下深红绒毯边缘已燃起焦烟，碎落火星顺石砖缝蔓延', correct: false, feedback: '绒毯火星尚浅，远未构成即刻阻断去路的威胁。' },
          ],
          deductions: [
            { id: 'charge_spear', text: '正面架盾硬撼突击队长长戟，任由后排火墙缓缓合拢', correct: false, feedback: '任由后排火势成形，只会陷入灼烧与重戟的前后夹击。' },
            { id: 'cut_caster', text: '趁术士双手控火侧翼空虚，瞬发冰锥先断咏唱破夹击', correct: true, unlockSkill: 'insight_generic_flaw', feedback: '推演完成！优先切断火系咏唱，瓦解长廊合围！' },
          ],
        },
        1: {
          sceneText: '长廊尽头铁门落锁，冰晶宫殿迅速调出公爵府东翼结构图并行比对。东翼封锁官披着红莲纹绯红披风拦在火墙中央，烈焰正沿吊灯铁链向整条走廊合拢。',
          clues: [
            { id: 'crimson_cloak', text: '封锁官绯红披风绣着王都火徽，甲胄表面流转灼热魔纹', correct: false, feedback: '甲胄火纹属正面护焰，硬砸正面极易反遭烈焰灼伤。' },
            { id: 'servant_draft', text: '左侧仆人暗道门缝透出冷风，火幕唯独在该处微微内凹', correct: true, feedback: '观察准确！无人把守的仆人暗道正不断灌入逆向回风，撕开了红莲火幕的气眼！' },
            { id: 'iron_chandelier', text: '头顶锻铁吊灯在热浪里微微晃动，烛泪顺着灯座不断滴落', correct: false, feedback: '吊灯只是受热浪扰动，无法直接击破封锁官的护身火幕。' },
          ],
          deductions: [
            { id: 'smash_front_fire', text: '倾尽魔力在正面强凝厚冰墙，硬扛红莲火幕正面推进', correct: false, feedback: '正面热流最盛，厚冰墙会在封廊锁火下迅速融裂。' },
            { id: 'follow_servant_draft', text: '循仆人暗道逆向回风直贯火眼，覆水裹霜一举冲溃铁幕', correct: true, unlockSkill: 'insight_eastwing_draft', feedback: '推演完成！解锁「看破·仆道回风破幕」，借暗道冷风直熄红莲铁幕！' },
          ],
        },
      },
      waves: [
        {
          witnessActive: false,
          intro: '【第 1/2 波 · 东翼突围】宫廷突击队长与赤炎术士封住了长廊！留意术士的双手控火咏唱与前排重戟突刺，速破夹击！',
          enemies: [
            {
              id: 'corridor_vanguard',
              name: '宫廷突击队长',
              crestKind: 'inquisitor',
              emoji: '🛡️',
              elem: 'phys',
              hp: 245,
              mhp: 245,
              shield: 40,
              shieldKind: 'solid',
              atk: 44,
              def: 20,
              mdef: 16,
              spd: 94,
              maxLocks: 3,
              trait: '宫廷重戟：交替发动长戟突刺与铁壁防反，专克盲目隔空偷袭。',
              aiType: 'corridor_vanguard',
            },
            {
              id: 'flame_mage_a',
              name: '赤炎术士',
              crestKind: 'inquisitor',
              emoji: '🔥',
              elem: 'fire',
              hp: 185,
              mhp: 185,
              shield: 20,
              shieldKind: 'magic',
              atk: 46,
              def: 10,
              mdef: 18,
              spd: 102,
              maxLocks: 2,
              trait: '走廊纵火：双手结印蓄起高伤火墙，宜用隔空瞬凝断咏或覆潮水弹克制。',
              aiType: 'flame_mage',
            },
          ],
        },
        {
          witnessActive: false,
          intro: '🔥【第 2/2 波 · 红莲铁幕】东翼封锁官横戟拦路！半血将展开【二阶段·红莲铁幕封廊】，须以水克火浇弱斗气，备好破招截断锁火与剑步反制冲锋！',
          enemies: [
            {
              id: 'eastwing_commander',
              name: '东翼封锁官·「红莲铁幕」',
              crestKind: 'eastwing',
              emoji: '⚔️',
              elem: 'fire',
              hp: 620,
              mhp: 620,
              shield: 75,
              shieldKind: 'magic',
              atk: 58,
              def: 24,
              mdef: 24,
              spd: 108,
              maxLocks: 6,
              fireAura: 2,
              boss: true,
              phase: 1,
              phase2HpPct: 0.5,
              trait: '红莲铁幕：半血触发二阶段刷新魔法火盾！二阶段交替施放必断高危【封廊锁火】与穿盾【岔口冲锋】，须抓准隔空截断、霁馆剑步与仆道回风看破破局！',
              aiType: 'eastwing_boss',
            },
          ],
        },
      ],
    },

    wind_god_eye: {
      id: 'wind_god_eye',
      order: 9,
      title: '风神·风暴眼试剑',
      chapter: '第三卷 · 特别试炼 岚之试剑',
      stars: '★★★★★',
      charId: 'fengshen',
      crestKind: 'wind_god',
      emoji: '🌪️',
      bg: 'bg-img-training bg-battle',
      tags: ['七大列强试剑', '二阶段风暴眼全开', '生根步斩风瞬反', '风眼静滞看破'],
      summary: '直面七大列强「风神·岚」的高难试剑！半血后【风暴眼全开】，真空连刃与风眼静滞反制交替压迫，须借生根步斩风瞬反与冰宫看破破开风暴！',
      preset: {
        age: 16,
        hp: 255, mhp: 255, mp: 310, mmp: 310,
        atk: 48, matk: 56, def: 18, mdef: 26, spd: 112,
        skills: ['hand_ice_crystal', 'hand_root_shield', 'hand_thorn_field', 'remote_blind_shot', 'remote_snap_spike', 'sword_root_step', 'sword_water_edge', 'sword_wind_afterimage'],
        passives: ['temp_sense', 'root_ice', 'mana_calc', 'frost_edge', 'instant_ice'],
        manaCycle: true,
        eclipseWand: false,
        palaceCharges: 1,
      },
      reward: { exp: 340, gold: 120 },
      palace: {
        sceneText: '试剑场砂石翻卷，冰晶宫殿在意识间并行分解气流流速。风神岚单手负后立于飓风气眼中央，翠发在无风圆心纹丝不动，外圈风刃已蓄成真空漩涡。',
        clues: [
          { id: 'emerald_cloak', text: '风神翠色长发垂在肩侧，外圈狂风把斗篷下摆吹得猎猎作响', correct: false, feedback: '外圈狂风只是遮蔽视线的气幕，尚未触及她真正的发力轴心。' },
          { id: 'eye_stillness', text: '旋转风壁最内侧半步毫无气流，她的换气反制恰起于静滞点', correct: true, feedback: '观察准确！飓风圆心那半步静滞正是她收风反制的唯一枢纽。' },
          { id: 'floating_gravel', text: '场边碎石被气旋卷至半空打转，落地时在砂面划出环状浅沟', correct: false, feedback: '悬空碎石随外圈旋流旋转，难以借此反制她圆心内的剑路。' },
        ],
        deductions: [
          { id: 'blast_outer_wall', text: '在飓风外圈叠起厚冰棱阵，借魔力总量与风壁正面硬耗', correct: false, feedback: '外圈风壁高速卸力，正面硬耗只会白白陷入她的反切节奏。' },
          { id: 'pierce_still_eye', text: '不与外圈狂风硬拼，踏生根步顺风眼静滞瞬间贯入死角', correct: true, unlockSkill: 'insight_wind_stillness', feedback: '推演完成！解锁「看破·风眼静滞穿心」，贯破风暴护壁并封锁风神身法！' },
        ],
      },
      waves: [
        {
          witnessActive: false,
          intro: '🌪️【风神试剑 · 岚】「既然妹妹把你夸得天花乱坠，便让我亲手试一试你的剑步与冰霜。」注意：外圈风暴护壁会大幅偏折盲目强攻，半血【风暴眼全开】后，踏稳生根步迎击【真空连刃】可触发「生根步·斩风瞬反」！',
          enemies: [
            {
              id: 'wind_god_avatar',
              charId: 'fengshen',
              crestKind: 'wind_god',
              name: '风神·岚「风暴眼试剑」',
              emoji: '🌪️',
              elem: 'wind',
              hp: 940,
              mhp: 940,
              shield: 105,
              shieldKind: 'magic',
              evadeCharges: 1,
              maxEvadeCharges: 1,
              atk: 68,
              def: 28,
              mdef: 32,
              spd: 132,
              maxLocks: 6,
              boss: true,
              phase: 1,
              phase2HpPct: 0.5,
              trait: '风暴眼试剑：风暴外壁偏折盲攻，半血全开【风暴眼】！破招失衡后趁势魔力增幅爆发；面对【真空连刃】踏生根步可触发「生根步·斩风瞬反」；面对【风眼静滞】须以冰宫看破或蓄势剑步破阵！',
              aiType: 'wind_god_boss',
            },
          ],
        },
      ],
    },
  };

  /* =========================================================
     3. 存档读取辅助、4 大铭记套装共鸣与演武沙盒隔离
     ========================================================= */
  let arenaUseSaveStats = false;
  let arenaReturnToTitle = false;
  let hoveredSkillId = null;
  let armedSkillId = null;

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
        2: '冰晶宫殿看破或截断破招附加 2 层易伤并回复 12% 最大 MP',
        3: '看破/破招附 2 层易伤与 12% MP；魔法蓝耗额外降低 15%，暴击倍率升至 1.65×',
      },
    },
    {
      id: 'jikan_blade',
      name: '霁馆剑心',
      members: ['ebony_sword', 'frost_cipher'],
      tiers: {
        2: '剑技迎锋/破招时魔战回蓝翻倍，剑技暴击或破招每回合限 1 次 +1 AP',
      },
    },
    {
      id: 'north_frost',
      name: '北境霜锋',
      members: ['aino_academy_handkerchief', 'aino_frost_shard', 'northwind_pass'],
      tiers: {
        2: '每回合开始获得 +10 护盾，冰系攻击穿透 15% 法抗',
        3: '每回合初 +10 护盾且冰系穿抗 15%；每回合首次隔空冰系附加 2 层寒颤并享 +15% 碎霜增伤',
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
        const raw = relApi.getActiveSynergies(equipped);
        const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.active) ? raw.active : []);
        list.forEach(item => {
          if (!item || item.active === false) return;
          const setId = item.id || item.setId;
          if (!setId) return;
          const rawTier = Number(item.tier || item.activeTier || item.count || item.matchedCount || 0);
          if (rawTier < 2) return;
          const fb = getFallbackSynergyMeta(setId);
          const effectiveTier = rawTier >= 3 && (!fb || fb.tiers[3]) ? 3 : 2;
          const desc = item.shortDesc || item.activeDesc || item.desc || item.effectText || (fb && (fb.tiers[effectiveTier] || fb.tiers[2])) || '';
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
        return { synergies, synergyMap };
      } catch (e) {}
    }

    FALLBACK_SYNERGY_SETS.forEach(setDef => {
      const count = setDef.members.filter(id => equipped.indexOf(id) !== -1).length;
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
    return { synergies, synergyMap };
  }

  function getSynergyTier(player, setId) {
    return (player && player.synergyMap && player.synergyMap[setId]) || 0;
  }

  function getEquippedStaffDef(player) {
    const id = (player && player.equippedStaff) || (player && player.wandActive ? 'eclipse_wand' : 'none');
    return COMBAT_BALANCE_V22.STAVES[id] || COMBAT_BALANCE_V22.STAVES.none;
  }

  function getPlayerCritMult(player) {
    const base = getSynergyTier(player, 'academy_stars') >= 3 ? 1.65 : 1.5;
    const staff = getEquippedStaffDef(player);
    return base + (staff && staff.critDmgBonus ? staff.critDmgBonus : 0);
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

  function saveArenaRecord(stageId, grade, turns) {
    const rankOrder = { S: 4, A: 3, B: 2, C: 1 };
    const rec = loadArenaRecords();
    const prev = rec[stageId];
    if (!prev || (rankOrder[grade] || 0) > (rankOrder[prev.grade] || 0) ||
        (prev.grade === grade && turns < prev.turns)) {
      rec[stageId] = { grade, turns, ts: Date.now() };
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

  function hasRelic(player, relicId) {
    return !!(player && Array.isArray(player.relics) && player.relics.indexOf(relicId) !== -1);
  }

  function computeBaseAv(spd) {
    const safeSpd = Math.max(40, Number(spd) || 100);
    return Math.round(COMBAT_BALANCE_V22.HSR_AV.baseNumerator / safeSpd);
  }

  function buildPlayerCombatant(stageCfg, opts) {
    opts = opts || {};
    const curS = getGameS() || {};
    const usePreset = opts.usePreset !== undefined ? opts.usePreset : !arenaUseSaveStats;
    const p = stageCfg && stageCfg.preset;
    const relApi = getRelicsApi();
    const activeRelics = relApi ? relApi.getActiveRelicsForBattle(Object.assign({}, opts, { state: curS })) : [];
    const activeAssist = relApi ? relApi.getActiveBondAssistForBattle(Object.assign({}, opts, { state: curS })) : null;
    const baseCrit = activeRelics.indexOf('belmont_schedule') !== -1 ? 0.15 : 0;
    const synInfo = resolveActiveSynergies(activeRelics);
    const actPreset = stageCfg && COMBAT_BALANCE_V22.ACTS_PLAYER_PRESET[stageCfg.id];

    if (usePreset && p) {
      const pSpd = p.spd || (actPreset && actPreset.spd) || 100;
      const pBaseAv = computeBaseAv(pSpd);
      return {
        name: (stageCfg.id === 'turning_point_corridor') ? '希尔维亚' : ((stageCfg.order >= 6) ? '眷寒渔（希尔维亚）' : '希尔维亚'),
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
        maxShield: Math.round(p.mhp * 0.65),
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
        hasEclipseWand: !!p.eclipseWand,
        equippedStaff: 'none',
        wandPersistent: false,
        wandActive: false,
        wandCooldown: 0,
        overcastMode: 0,
        _lastOvercastMode: 0,
        ampPct: 0,
        palaceLeft: p.palaceCharges != null ? p.palaceCharges : 1,
        palaceMax: p.palaceCharges != null ? p.palaceCharges : 1,
        status: {},
      };
    }

    // 故事模式存档出战：严格遵循玩家已习得的勇者之赐与阶段技能，采用 V2.2 tanh 软递减魔攻映射
    const body = (curS.stats && curS.stats.body) || 10;
    const mind = (curS.stats && curS.stats.mind) || 15;
    const mana = (curS.stats && curS.stats.mana) || 15;
    const charm = (curS.stats && curS.stats.charm) || 10;
    const floorP = p || { hp: 120, mhp: 120, mp: 160, mmp: 160, atk: 14, matk: 34, def: 8, mdef: 10, spd: 100, skills: ['basic_attack', 'hand_water_surge', 'hand_ice_crystal', 'hand_ice_wall'] };

    const mhp = Math.max(Math.round(floorP.mhp * 0.85), curS.mhp || 80);
    const mmp = Math.max(Math.round(floorP.mmp * 0.85), curS.mmp || 120);
    const hp = opts.fullRestore ? mhp : Math.max(1, Math.min(mhp, curS.hp || mhp));
    const mp = opts.fullRestore ? mmp : Math.max(20, Math.min(mmp, curS.mp || mmp));

    const learned = new Set([...(curS.skills || []), ...(curS.skillsLearned || [])]);
    const age = curS.ageY || 0;
    const skillSet = new Set(['basic_attack', 'hand_water_surge', 'hand_ice_crystal', 'hand_ice_wall', 'hand_water_veil']);
    if (age >= 8) skillSet.add('hand_frost_floor');
    if (age >= 9 || (curS.lv || 1) >= 15) skillSet.add('hand_thorn_field');
    if (age >= 12 || curS.phase === 'academy' || curS.phase === 'journey' || curS.phase === 'finale') {
      skillSet.add('hand_root_shield');
      skillSet.add('remote_blind_shot');
      skillSet.add('remote_snap_spike');
    }
    if (learned.has('wind_afterimage') || learned.has('wind_step_s')) skillSet.add('sword_wind_afterimage');
    if (learned.has('root_step') || learned.has('soft_cut') || learned.has('frost_edge') || curS.phase === 'journey' || curS.phase === 'finale') {
      skillSet.add('sword_root_step');
      skillSet.add('sword_water_edge');
    }
    if (learned.has('instant_ice')) {
      skillSet.add('remote_blind_shot');
      skillSet.add('remote_snap_spike');
    }
    if (stageCfg && stageCfg.iceOnlyRule) {
      skillSet.delete('hand_water_surge');
      skillSet.delete('hand_water_veil');
      skillSet.delete('sword_water_edge');
    }

    const passives = [];
    if (learned.has('temp_sense') || learned.has('ice_sense')) passives.push('temp_sense');
    if (learned.has('root_ice')) passives.push('root_ice');
    if (learned.has('mana_calc')) passives.push('mana_calc');
    if (learned.has('frost_edge')) passives.push('frost_edge');
    if (learned.has('instant_ice')) passives.push('instant_ice');

    const hasPalace = learned.has('ice_palace');
    const rawMatk = (curS.mag || 28) * 0.45 + mana * 0.35;
    const softCap = COMBAT_BALANCE_V22.SAVE_MATK_SOFT_CAP;
    const mappedMatk = rawMatk <= floorP.matk
      ? Math.max(floorP.matk * 0.85, rawMatk)
      : floorP.matk + softCap.gain * Math.tanh(Math.max(0, rawMatk - floorP.matk) / softCap.scale);
    const saveSpd = Math.max(96, Math.min(116, (floorP.spd || (actPreset && actPreset.spd) || (age >= 15 ? 110 : age >= 12 ? 105 : 100)) + Math.floor(Math.max(0, body - 20) * 0.12)));
    const saveBaseAv = computeBaseAv(saveSpd);

    return {
      name: curS.alias || '希尔维亚',
      hp,
      mhp,
      mp,
      mmp,
      atk: Math.round(Math.max(floorP.atk * 0.85, (curS.atk || 8) + body * 0.35)),
      matk: Math.round(mappedMatk),
      def: Math.round(Math.max(floorP.def * 0.85, (curS.pdef || 4) + charm * 0.15)),
      mdef: Math.round(Math.max(floorP.mdef * 0.85, (curS.mdef || 6) + mind * 0.18)),
      spd: saveSpd,
      baseAv: saveBaseAv,
      av: saveBaseAv,
      shield: 0,
      shieldKind: 'solid',
      maxShield: Math.round(mhp * 0.65),
      skills: Array.from(skillSet),
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
      hasManaCycle: learned.has('mana_cycle'),
      hasEclipseWand: hasEclipseInSave(),
      equippedStaff: 'none',
      wandPersistent: false,
      wandActive: false,
      wandCooldown: 0,
      overcastMode: 0,
      _lastOvercastMode: 0,
      ampPct: 0,
      palaceLeft: hasPalace ? 1 : 0,
      palaceMax: hasPalace ? 1 : 0,
      status: {},
    };
  }

  /* =========================================================
     4. 动态反应型敌方架势 AI（感知玩家龟缩、路径复读与失衡变招）
     ========================================================= */
  function decideEnemyIntent(enemy, b) {
    if (enemy.hp <= 0) {
      enemy.intent = null;
      return;
    }
    if (enemy.status && enemy.status.stagger > 0) {
      enemy.intent = {
        stance: 'STAGGERED',
        moveName: '架势失衡·气息紊乱',
        dmg: 0,
        desc: '动作被截断，本回合无法组织攻势。',
      };
      return;
    }

    const mem = b.aiMemory || {};
    const wt = b.waveTurn || b.turn;
    const ai = enemy.aiType || 'generic';
    const playerTurtling = (mem.turtleStreak || 0) >= 2 || (b.player.shield >= 45 && (mem.lastTurnDmgDealt || 0) === 0);
    const spammingRemote = mem.lastPath === 'REMOTE' && (mem.samePathStreak || 0) >= 2;
    const spammingSameSkill = (mem.sameSkillStreak || 0) >= 3;
    const spammingSameAtk = (mem.sameAtkSkillStreak || 0) >= 3;

    // 1. 贝阿特丽丝（动态融盾重劈 + 火蛇/融冰防反/抬肩重劈四拍切换）
    if (ai === 'beatrice') {
      if (playerTurtling) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '融冰爆炎·破壁重劈',
          dmg: 54 + (enemy.fireStacks || 0) * 6,
          elem: 'fire',
          shatterPlayerShield: true,
          addBurn: 2,
        };
        return;
      }
      if (spammingSameAtk) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '看破路数·烈焰剑障反劈（忌复读单招！）',
          dmg: 46 + (enemy.fireStacks || 0) * 5,
          elem: 'fire',
          shatterPlayerShield: true,
          meltIceCounter: true,
          punishRepeatAtk: mem.lastAtkSkillId,
          addBurn: 2,
          gainFire: 1,
        };
        return;
      }
      if (enemy.wasInterruptedLastTurn) {
        enemy.wasInterruptedLastTurn = false;
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '变步近身·烈火疾斩',
          dmg: 36 + (enemy.fireStacks || 0) * 4,
          elem: 'fire',
          addBurn: 1,
        };
        return;
      }
      const step = (wt - 1) % 4;
      if (step === 0) {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '抬右肩·烈焰连球重劈',
          dmg: 38 + (enemy.fireStacks || 0) * 4,
          elem: 'fire',
          addBurn: 2,
          gainFire: 1,
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '双手塑形·暴走火蛇（宜凝华冰晶冻核）',
          dmg: 36 + (enemy.fireStacks || 0) * 4,
          elem: 'fire',
          addBurn: 1,
          gainFire: 1,
        };
      } else if (step === 2) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '烈焰剑障·融冰防反（宜覆潮水弹浇灭，忌冰晶）',
          dmg: 32 + (enemy.fireStacks || 0) * 4,
          elem: 'fire',
          meltIceCounter: true,
        };
      } else {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '抬右肩·爆炎踏步重劈',
          dmg: 40 + (enemy.fireStacks || 0) * 4,
          elem: 'fire',
          addBurn: 2,
        };
      }
      return;
    }

    // 2. 罗文（8岁乱葬岗：龟缩碎壁、窄道突围、脱手旋杖袭心；已铺设地面薄冰设伏时视为战术布阵）
    if (ai === 'rowan') {
      if (playerTurtling && !(b.frostFloorTurns > 0)) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '血魔炸土·碎壁穿心刺',
          dmg: 78,
          elem: 'dark',
          shatterPlayerShield: true,
        };
        return;
      }
      const step = (wt - 1) % 3;
      if (step === 0) {
        enemy.intent = {
          stance: 'UNDER_SEEP',
          moveName: '晦轮银环·越位蚀心黑光',
          dmg: 60,
          bypassHalfShield: true,
          eclipseTrueMagic: true,
          elem: 'dark',
          renoRockBlock: true,
          refractIceCrystal: true,
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '血魔震土·石碑窄道突围',
          dmg: 50,
          elem: 'dark',
          narrowPassWindow: true,
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '虚刺雷纳德·脱手旋杖袭心',
          dmg: 60,
          bypassHalfShield: true,
          eclipseTrueMagic: true,
          elem: 'dark',
          thrownStaff: true,
          refractIceCrystal: true,
        };
      }
      return;
    }

    // 3. 爱丽丝（第1拍必扬尘遮眼、第4/7拍双手合拢狂岚检定：MP<22当场溃散认输！）
    if (ai === 'alice') {
      const isStormTurn = wt === 4 || (wt > 4 && (wt - 4) % 3 === 0);
      if (isStormTurn) {
        const sealed = !!(enemy.status && enemy.status.evadeSealed > 0);
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '双手合拢·狂躁风暴蓄力',
          dmg: sealed ? 64 : 138,
          elem: 'wind',
          mpCost: 22,
          selfFizzleIfLowMp: true,
        };
        return;
      }
      if (playerTurtling && (enemy.mp || 0) >= 18) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '狂岚破幕卷（粉碎护盾）',
          dmg: 68,
          elem: 'wind',
          mpCost: 12,
          shatterPlayerShield: true,
        };
        return;
      }
      const subStep = wt <= 3 ? (wt - 1) : ((wt - 5) % 2);
      if (subStep === 0) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '侧滑扬尘 + 绕侧风刃',
          dmg: 30,
          elem: 'wind',
          mpCost: 7,
          inflictBlind: 1,
        };
      } else if (subStep === 1) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '借风掠影·透明风刃',
          dmg: 34,
          elem: 'wind',
          mpCost: 7,
        };
      } else {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '旋风障壁·回旋风镰',
          dmg: 38,
          elem: 'wind',
          mpCost: 7,
          inflictBlind: 1,
        };
      }
      return;
    }

    // 4. 艾诺（显微镜视力：反制盲目隔空复读、反制纯叠盾挂机、动态切空档）
    if (ai === 'aino') {
      if (spammingRemote) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '无瑕镜冰·预判反刺（忌隔空！）',
          dmg: 50,
          elem: 'ice',
          counterRemoteHit: true,
          scoresHit: true,
        };
        return;
      }
      if ((mem.turtleStreak || 0) >= 4) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '破根极寒钻刺（碎盾重击）',
          dmg: 64,
          elem: 'ice',
          shatterPlayerShield: true,
          scoresHit: true,
        };
        return;
      }
      if (enemy.wasInterruptedLastTurn) {
        enemy.wasInterruptedLastTurn = false;
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '贴地滑冰·变向双刺',
          dmg: 56,
          elem: 'ice',
          slipStrike: true,
          scoresHit: true,
        };
        return;
      }
      const step = (wt - 1) % 3;
      if (step === 0) {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '破土三连冰锥（正面镜冰）',
          dmg: 52,
          elem: 'ice',
          scoresHit: true,
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '双手压地·极寒双翼刺阵',
          dmg: 68,
          elem: 'ice',
          slipStrike: true,
          scoresHit: true,
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '贴地滑冰·近身双刺',
          dmg: 56,
          elem: 'ice',
          slipStrike: true,
          scoresHit: true,
        };
      }
      return;
    }

    // 5. 诺艾儿（残血水垫必入脚底冰缝暗流翻盘杀 + 反隔空与反单招复读尺量水幕）
    if (ai === 'noelle') {
      if (!enemy.seepSevered && (enemy.hp <= 170 || (enemy.mp != null && enemy.mp <= 40) || playerTurtling)) {
        enemy.intent = {
          stance: 'UNDER_SEEP',
          moveName: '残魔退守（脚底冰缝暗流穿心！）',
          dmg: playerTurtling ? 195 : 52,
          bypassAllShield: playerTurtling,
          trapDmg: 205,
          elem: 'water',
          mpCost: 12,
          ambushTrap: true,
        };
        return;
      }
      if (spammingRemote || enemy.wasInterruptedLastTurn) {
        enemy.wasInterruptedLastTurn = false;
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '纸薄水膜截凝 + 反切水刃',
          dmg: 46,
          elem: 'water',
          mpCost: 6,
          refreshCurtain: 52,
          counterRemoteHit: true,
        };
        return;
      }
      if (spammingSameAtk) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '方程预演·叠层尺量水幕',
          dmg: 48,
          elem: 'water',
          mpCost: 6,
          refreshCurtain: 76,
          punishRepeatAtk: mem.lastAtkSkillId,
        };
        return;
      }
      const step = (wt - 1) % 3;
      if (step === 1) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '等距后撤·双幕收口水刃',
          dmg: 54,
          elem: 'water',
          mpCost: 8,
          refreshCurtain: 44,
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '尺量零留白水幕 + 平切水刃',
          dmg: 44,
          elem: 'water',
          mpCost: 6,
          refreshCurtain: 52,
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
          dmg: 42,
          elem: 'wind',
          buffPack: 10,
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '群狼合围撕咬',
          dmg: enemy.atk + 8,
          elem: 'phys',
        };
      }
      return;
    }

    if (ai === 'jackal' || ai === 'jackal_minor') {
      if (ai === 'jackal') {
        // 影豺若未被卸力破招，自动恢复1层疾影闪避
        if (!enemy.wasInterruptedLastTurn && !enemy.evadeBrokenThisTurn) {
          enemy.evadeCharges = enemy.maxEvadeCharges || 1;
        }
        enemy.evadeBrokenThisTurn = false;
        enemy.wasInterruptedLastTurn = false;

        if (playerTurtling || spammingSameSkill) {
          mem.turtleStreak = 0;
          enemy.intent = {
            stance: 'HEAVY_WINDUP',
            moveName: '裂甲暗影重爪（撕碎护盾）',
            dmg: 68,
            elem: 'phys',
            shatterPlayerShield: true,
          };
          return;
        }
      }
      const step = (wt - 1) % 3;
      if (step === 2 && ai === 'jackal') {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '霜脊蓄寒·冰刺喷吐',
          dmg: 64,
          elem: 'ice',
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '银影腾空·锁喉扑杀',
          dmg: ai === 'jackal' ? Math.max(62, enemy.atk) : 42,
          elem: 'phys',
        };
      }
      return;
    }

    // 7. 赫兰冻土重甲兽 & 霜渊裂地兽领主
    if (ai === 'hulan_brute') {
      if (spammingRemote) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '冻土岩刺守御·反震撞箱',
          dmg: 50,
          crateDmg: 42,
          counterRemoteHit: true,
          elem: 'earth',
        };
        return;
      }
      const step = (wt - 1) % 2;
      if (step === 0) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '冻土聚甲 + 蓄力撞击药箱',
          dmg: 44,
          crateDmg: 42,
          gainShield: 45,
          elem: 'earth',
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '厚岩缩甲·蛮冲医疗药箱',
          dmg: 48,
          crateDmg: 42,
          shatterPlayerShield: playerTurtling,
          elem: 'earth',
        };
      }
      return;
    }

    if (ai === 'hulan_lord') {
      if (spammingRemote) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '极寒岩壁防反（反震药箱！）',
          dmg: 68,
          crateDmg: 40,
          counterRemoteHit: true,
          gainShield: 70,
          elem: 'earth',
        };
        return;
      }
      if (playerTurtling || spammingSameSkill) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '崩山碎盾踏（摧毁护盾与药箱！）',
          dmg: 76,
          crateDmg: 48,
          shatterPlayerShield: true,
          gainShield: 75,
          elem: 'earth',
        };
        return;
      }
      enemy.wasInterruptedLastTurn = false;
      // 第 1、3 回合亮出双手聚寒空档，让无冰宫玩家也能连续截断引落两记艾诺冰枪震裂晶核！
      const step = (wt - 1) % 4;
      if (step === 0 || step === 2) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '双臂聚寒·极北霜岩风暴',
          dmg: 72,
          crateDmg: 36,
          gainShield: 80,
          elem: 'ice',
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '冻甲壁垒·冰峡崩震（波及药箱）',
          dmg: 64,
          crateDmg: 36,
          counterRemoteHit: true,
          elem: 'earth',
        };
      } else {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '裂地横扫扑击',
          dmg: 60,
          crateDmg: 24,
          elem: 'phys',
        };
      }
      return;
    }

    // 8. 转折点·东翼火廊突围战（宫廷突击队长 / 赤炎术士 / 东翼封锁官「红莲铁幕」二阶段）
    if (ai === 'corridor_vanguard') {
      if (playerTurtling) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '破阵重戟斩（粉碎护盾！）',
          dmg: 66,
          elem: 'phys',
          shatterPlayerShield: true,
          heavyWarn: true,
        };
        return;
      }
      if (spammingRemote) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '铁壁举盾·截空反刺',
          dmg: 46,
          elem: 'phys',
          counterRemoteHit: true,
          gainShield: 40,
        };
        return;
      }
      const step = (wt - 1) % 2;
      if (step === 0) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '十字长戟·走廊突刺',
          dmg: 48,
          elem: 'phys',
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '宫廷重盾·护阵反击',
          dmg: 38,
          elem: 'phys',
          counterRemoteHit: true,
          gainShield: 38,
        };
      }
      return;
    }

    if (ai === 'flame_mage') {
      if (spammingRemote) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '炎环护身·反灼火弧',
          dmg: 48,
          elem: 'fire',
          counterRemoteHit: true,
          addBurn: 2,
        };
        return;
      }
      const step = (wt - 1) % 2;
      if (step === 0) {
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '双手结印·封廊赤炎火墙',
          dmg: 62,
          elem: 'fire',
          addBurn: 2,
          heavyWarn: true,
        };
      } else {
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '赤炎爆裂火球',
          dmg: 52,
          elem: 'fire',
          addBurn: 2,
        };
      }
      return;
    }

    if (ai === 'eastwing_boss') {
      const p2 = (enemy.phase || 1) >= 2;
      if (playerTurtling) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: p2 ? '红莲焚盾斩·焦土破壁' : '重戟焚盾劈（粉碎护盾！）',
          dmg: p2 ? 104 : 78,
          elem: 'fire',
          shatterPlayerShield: true,
          addBurn: 2,
          heavyWarn: true,
        };
        return;
      }
      if (spammingRemote && !p2) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '红莲火戟·截空反刺（忌盲丢隔空！）',
          dmg: 64,
          elem: 'fire',
          counterRemoteHit: true,
          meltIceCounter: true,
          gainShield: 55,
        };
        return;
      }
      if (spammingSameAtk && !p2) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '铁幕识破·炎甲反震（忌复读单招！）',
          dmg: 62,
          elem: 'fire',
          punishRepeatAtk: mem.lastAtkSkillId,
          meltIceCounter: true,
          gainShield: 65,
          addBurn: 2,
        };
        return;
      }
      if (p2) {
        const p2Step = (enemy.phase2Step || 0) % 2;
        if (p2Step === 0) {
          enemy.intent = {
            moveKey: 'FLAME_CORRIDOR_SEAL',
            stance: 'DUAL_CAST',
            moveName: '红莲铁幕·封廊锁火（高危必断咏唱！）',
            dmg: 112,
            elem: 'fire',
            shatterPlayerShield: true,
            addBurn: 3,
            gainShield: 58,
            heavyWarn: true,
          };
        } else {
          enemy.intent = {
            moveKey: 'CROSSROAD_BREACH',
            stance: 'CLOSE_LUNGE',
            moveName: '红莲突袭·岔口破阵冲锋（宜剑步闪反！）',
            dmg: 88,
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
          moveName: '双手引火·长廊炎壁（可隔空截断）',
          dmg: 58,
          elem: 'fire',
          gainShield: 45,
          addBurn: 2,
        };
      } else if (step === 1) {
        enemy.intent = {
          stance: 'CLOSE_LUNGE',
          moveName: '炎戟突进·封喉直刺（可剑步闪反）',
          dmg: 56,
          elem: 'phys',
          addBurn: 1,
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '红莲铁幕·融冰守势（宜覆潮水弹浇灭）',
          dmg: 52,
          elem: 'fire',
          meltIceCounter: true,
          counterRemoteHit: true,
          gainShield: 50,
        };
      }
      return;
    }

    // 9. 风神·岚「风暴眼试剑」（七大列强二阶段：真空连刃 × 风眼静滞）
    if (ai === 'wind_god_boss') {
      const p2 = (enemy.phase || 1) >= 2;
      if (!(enemy.status && enemy.status.evadeSealed > 0)) {
        if (!enemy.wasInterruptedLastTurn && !enemy.evadeBrokenThisTurn) {
          enemy.evadeCharges = enemy.maxEvadeCharges || 1;
        }
      } else {
        enemy.evadeCharges = 0;
      }
      enemy.evadeBrokenThisTurn = false;
      enemy.wasInterruptedLastTurn = false;

      if (playerTurtling) {
        mem.turtleStreak = 0;
        enemy.intent = {
          stance: 'HEAVY_WINDUP',
          moveName: '断壁裂空岚（粉碎护盾！）',
          dmg: p2 ? 124 : 98,
          elem: 'wind',
          shatterPlayerShield: true,
          pierceAfterimage: true,
          heavyWarn: true,
        };
        return;
      }
      if (spammingRemote && !p2) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '御风折锋·借岚反切（忌盲丢隔空！）',
          dmg: 78,
          elem: 'wind',
          counterRemoteHit: true,
          windGuardCounter: true,
          pierceAfterimage: true,
          gainShield: 70,
        };
        return;
      }
      if (spammingSameAtk && !p2) {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '听风破招·同路反制（忌复读单招！）',
          dmg: 74,
          elem: 'wind',
          punishRepeatAtk: mem.lastAtkSkillId,
          windGuardCounter: true,
          pierceAfterimage: true,
          gainShield: 70,
        };
        return;
      }
      if (p2) {
        const p2Step = (enemy.phase2Step || 0) % 2;
        if (p2Step === 0) {
          enemy.intent = {
            moveKey: 'TEMPEST_VACUUM',
            stance: 'CLOSE_LUNGE',
            moveName: '风暴眼·真空连刃（踏生根步可触发斩风瞬反！）',
            dmg: 122,
            elem: 'wind',
            bypassHalfShield: true,
            pierceAfterimage: true,
            heavyWarn: true,
            rootStepParryWindow: true,
          };
        } else {
          enemy.intent = {
            moveKey: 'EYE_STILLNESS',
            stance: 'GUARD_COUNTER',
            moveName: '风眼静滞·圆心反制阵（须冰宫看破或蓄势剑步破静！）',
            dmg: 96,
            elem: 'wind',
            gainShield: 78,
            counterRemoteHit: true,
            windGuardCounter: true,
            eyeStillnessStance: true,
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
          moveName: '翠岚掠影·试剑三连（宜生根步卸力破闪）',
          dmg: 74,
          elem: 'wind',
          pierceAfterimage: true,
        };
      } else if (step === 1) {
        // 双袖引风聚岚时暂撤身法闪避，亮出可截断空档
        enemy.evadeCharges = 0;
        enemy.intent = {
          stance: 'DUAL_CAST',
          moveName: '双袖引风·压场气旋（可隔空截断！）',
          dmg: 86,
          elem: 'wind',
          gainShield: 62,
          pierceAfterimage: true,
          heavyWarn: true,
        };
      } else {
        enemy.intent = {
          stance: 'GUARD_COUNTER',
          moveName: '风壁听劲·借力反斩（忌盲攻！）',
          dmg: 68,
          elem: 'wind',
          counterRemoteHit: true,
          windGuardCounter: true,
          pierceAfterimage: true,
          gainShield: 68,
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
      return '失衡恢复中（准备重新蓄势反扑）';
    }
    const cloneE = Object.assign({}, enemy, { status: Object.assign({}, enemy.status || {}) });
    delete cloneE.status.stagger;
    if ((cloneE.phase || 1) >= 2) {
      cloneE.phase2Step = ((cloneE.phase2Step || 0) + 1) % 2;
    }
    const fakeB = Object.assign({}, b, {
      waveTurn: (b.waveTurn || b.turn || 1) + 1,
      aiMemory: Object.assign({}, b.aiMemory || {})
    });
    decideEnemyIntent(cloneE, fakeB);
    const nextSt = cloneE.intent ? cloneE.intent.stance : 'HEAVY_WINDUP';
    const labelMap = {
      DUAL_CAST: '双手控场（可留【隔空瞬凝】破招）',
      CLOSE_LUNGE: '贴身突袭（可备【霁馆剑步】闪反）',
      HEAVY_WINDUP: '蓄力重击（宜提前堆叠护盾或开冰宫）',
      GUARD_COUNTER: '严密防反（宜切【经手构筑】正面破防）',
      UNDER_SEEP: '诡道暗流（须防脚底陷阱，备残像或冰宫）'
    };
    return labelMap[nextSt] || '常规试探';
  }

  /* =========================================================
     5. V2.2 魔战循环 · 双段魔力增幅 · 晦轮杖真伤 · 比值防御(K=80) 精算核心
     ========================================================= */
  function computeSkillApCost(bState, skill) {
    if (!skill) return 0;
    const baseAp = skill.ap || 0;
    if (bState && bState.turn === 1 && !bState._handkerchiefFreeRemoteUsed &&
        hasRelic(bState.player, 'aino_academy_handkerchief') && skill.path === 'REMOTE') {
      return 0;
    }
    return baseAp;
  }

  function getSkillOvercastCap(skill) {
    if (!skill) return 0;
    if (typeof skill.overcastCap === 'number') return Math.max(0, Math.min(0.5, skill.overcastCap));
    if (skill.noOvercast || skill.atkKind !== 'matk' || !(skill.power > 0)) return 0;
    const caps = COMBAT_BALANCE_V22.OVERCAST.skillCaps;
    if (skill.path === 'REMOTE') return caps.REMOTE;
    if (skill.path === 'SWORD') return caps.SWORD;
    if (skill.path === 'INSIGHT') return caps.INSIGHT;
    return caps.HAND_HEAVY;
  }

  function getSkillBaseLockDamage(skill) {
    if (!skill || !(skill.power > 0)) return 0;
    if (typeof skill.lockDamage === 'number') return skill.lockDamage;
    if (skill.path === 'INSIGHT') return 2;
    if (skill.id === 'basic_attack') return 0;
    return 1;
  }

  function isEclipseStaffForSkill(player, skill) {
    if (!player || !skill || !(skill.power > 0) || skill.atkKind !== 'matk') return false;
    const staff = getEquippedStaffDef(player);
    return !!(player.wandActive || (staff && staff.trueMagic));
  }

  function getAmpTierInfo(ampPct) {
    const dm = Math.max(0, Number(ampPct) || 0);
    const oc = COMBAT_BALANCE_V22.OVERCAST;
    if (dm >= oc.tier2.at - 1e-6) {
      return { tier: 2, mult: oc.tier2.mult, extraLocks: oc.tier2.extraLocks, defPierce: oc.tier2.defPierce, label: oc.tier2.label };
    }
    if (dm >= oc.tier1.at - 1e-6) {
      return { tier: 1, mult: oc.tier1.mult, extraLocks: oc.tier1.extraLocks, defPierce: oc.tier1.defPierce, label: oc.tier1.label };
    }
    return { tier: 0, mult: 1.0, extraLocks: 0, defPierce: 0, label: '' };
  }

  function syncPlayerAmpFromMode(player) {
    if (!player) return 0;
    const mode = Math.max(0, Math.min(2, player.overcastMode | 0));
    if (player._lastOvercastMode !== mode) {
      player._lastOvercastMode = mode;
      player.ampPct = mode === 2 ? 0.50 : mode === 1 ? 0.25 : 0;
    }
    return Math.max(0, Math.min(0.50, Number(player.ampPct) || 0));
  }

  function getEffectiveAmpPct(player, skill) {
    if (!player || !player.hasManaCycle) return 0;
    const rawPct = syncPlayerAmpFromMode(player);
    if (!skill) return rawPct;
    if (skill.noOvercast || skill.atkKind !== 'matk' || !(skill.power > 0)) return 0;
    return Math.min(rawPct, getSkillOvercastCap(skill));
  }

  function computeBaseMpCost(player, skill) {
    let base = (skill && skill.mp) || 0;
    if (base > 0 && player.passives && player.passives.includes('mana_calc')) {
      base = Math.max(1, Math.floor(base * 0.85));
    }
    if (base > 0 && hasRelic(player, 'noelle_manuscript') && skill.atkKind === 'matk') {
      base = Math.max(1, Math.floor(base * 0.8));
    }
    if (base > 0 && skill.atkKind === 'matk' && getSynergyTier(player, 'academy_stars') >= 3) {
      base = Math.max(1, Math.floor(base * 0.85));
    }
    return base;
  }

  function computeWandExtraMp(player, skill) {
    if (!isEclipseStaffForSkill(player, skill)) return 0;
    const extraPct = COMBAT_BALANCE_V22.STAVES.eclipse_wand.extraMpPct;
    let cost = Math.round(Math.max(1, player.mmp || 100) * extraPct);
    if (player.passives && player.passives.includes('mana_calc')) {
      cost = Math.max(1, Math.floor(cost * 0.85));
    }
    return cost;
  }

  function computeAmpProfile(player, skill, opts) {
    opts = opts || {};
    const mmp = Math.max(1, (player && player.mmp) || 100);
    const mpNow = Math.max(0, (player && player.mp) || 0);
    if (!player || !player.hasManaCycle || !skill || !(skill.power > 0) || skill.atkKind !== 'matk' || skill.elem === 'phys') {
      return { ampPct: 0, requestedAmpPct: 0, mult: 1.0, tier: 0, extraLocks: 0, defPierce: 0, label: '', extraMp: 0, discountedExtraMp: 0 };
    }
    const requestedAmpPct = getEffectiveAmpPct(player, skill);
    const base = computeBaseMpCost(player, skill);
    const wandExtra = computeWandExtraMp(player, skill);
    const staff = getEquippedStaffDef(player);
    let discountFactor = 1.0;
    if (player.passives && player.passives.includes('mana_calc')) discountFactor *= 0.85;
    if (hasRelic(player, 'noelle_manuscript')) discountFactor *= 0.5;
    if (staff && staff.overcastMpDiscount > 0) discountFactor *= (1 - staff.overcastMpDiscount);

    const desiredExtraMp = Math.round(mmp * requestedAmpPct);
    const desiredDiscounted = desiredExtraMp > 0 ? Math.max(1, Math.ceil(desiredExtraMp * discountFactor)) : 0;

    let actualAmpPct = requestedAmpPct;
    let actualDiscounted = desiredDiscounted;
    if (opts.clampToMp !== false && !(player.status && player.status.zeroMpThisTurn)) {
      const reqFixed = base + wandExtra;
      if (mpNow >= reqFixed && mpNow < reqFixed + desiredDiscounted && desiredDiscounted > 0) {
        actualDiscounted = Math.max(0, mpNow - reqFixed);
        actualAmpPct = Math.min(requestedAmpPct, (actualDiscounted / Math.max(0.05, discountFactor)) / mmp);
      }
    }

    const oc = COMBAT_BALANCE_V22.OVERCAST;
    const seg1 = Math.min(actualAmpPct, oc.seg1End);
    const seg2 = Math.max(0, actualAmpPct - oc.seg1End);
    const tierInfo = getAmpTierInfo(actualAmpPct);
    const tier2BaseBonus = tierInfo.tier >= 2 ? Math.min(0.10, (((skill && skill.mp) || 0) / mmp) * 0.65) : 0;
    const segMult = 1.0 + seg1 * oc.seg1Slope + seg2 * oc.seg2Slope + tier2BaseBonus;
    const mult = segMult * tierInfo.mult;

    return {
      ampPct: actualAmpPct,
      requestedAmpPct,
      mult,
      tier: tierInfo.tier,
      extraLocks: tierInfo.extraLocks,
      defPierce: tierInfo.defPierce,
      label: tierInfo.label,
      extraMp: Math.round(mmp * actualAmpPct),
      discountedExtraMp: actualDiscounted,
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
    if (player.status && player.status.zeroMpThisTurn) return 0;
    const base = computeBaseMpCost(player, skill);
    const wandExtra = computeWandExtraMp(player, skill);
    const prof = computeAmpProfile(player, skill);
    return base + wandExtra + prof.discountedExtraMp;
  }

  // V2.2 魔战循环 × 双段质变魔力增幅倍率（纯物理技恒定 1.0x）
  function computeManaCycleMultiplier(player, mpSpent, skill) {
    if (!player || !player.hasManaCycle || !skill || skill.power <= 0 || skill.atkKind !== 'matk' || skill.elem === 'phys' || mpSpent <= 0) {
      return 1.0;
    }
    return computeAmpProfile(player, skill).mult;
  }

  function getPlayerCritChance(player, skill) {
    let rate = Number(player && player.critChance) || 0;
    if (skill && skill.path === 'SWORD' && hasRelic(player, 'ebony_sword')) {
      rate += 0.25;
    }
    return Math.max(0, Math.min(0.95, rate));
  }

  function estimateSkillDamage(bState, skill, targetEnemy, opts) {
    opts = opts || {};
    const p = bState.player;
    if (!skill || !skill.power || skill.power <= 0) {
      return { dmg: 0, mult: 1, mcMult: 1, mpCost: opts.mpCost != null ? opts.mpCost : computeSkillMpCost(p, skill), willInterrupt: false, willRiposte: false };
    }
    const e = targetEnemy || getPrimaryAliveEnemy(bState);
    if (!e) return { dmg: 0, mult: 1, mcMult: 1, mpCost: 0, willInterrupt: false, willRiposte: false };

    const mpCost = opts.mpCost != null ? opts.mpCost : computeSkillMpCost(p, skill);
    const powerMp = opts.powerMp != null ? opts.powerMp : computeOvercastPowerMp(p, skill);
    const ampProfile = opts.ampProfile || computeAmpProfile(p, skill);
    const mcMult = (p.hasManaCycle && skill.atkKind === 'matk' && skill.elem !== 'phys' && powerMp > 0) ? ampProfile.mult : 1.0;
    const stance = e.intent ? e.intent.stance : 'HEAVY_WINDUP';
    const wandOn = isEclipseStaffForSkill(p, skill);
    const staff = getEquippedStaffDef(p);
    const staffMatkMult = (staff && staff.matkMult) ? staff.matkMult : 1.0;
    const isTempestVacuum = !!(e.aiType === 'wind_god_boss' && (e.phase || 1) >= 2 && e.intent && e.intent.moveKey === 'TEMPEST_VACUUM');
    const isEyeStillness = !!(e.aiType === 'wind_god_boss' && (e.phase || 1) >= 2 && e.intent && e.intent.moveKey === 'EYE_STILLNESS');

    const effMatk = p.matk * staffMatkMult;
    let atkStat = effMatk;
    if (skill.atkKind === 'atk') atkStat = p.atk;
    else if (skill.atkKind === 'hybrid') atkStat = p.atk * 0.92 + effMatk * 0.58;

    let pwr = skill.power;
    let willInterrupt = false;
    let willRiposte = false;
    let rootStepParryTrigger = false;
    let stanceMod = 1.0;

    if (skill.path === 'REMOTE') {
      // 严禁把 weaknessExposed 当作永久无视防反外挂！唯敌方处于 DUAL_CAST 才触发隔空截断！
      if (stance === 'DUAL_CAST') {
        pwr = skill.interruptPower || skill.power * 1.85;
        willInterrupt = true;
        stanceMod = 1.15;
      } else if (stance === 'GUARD_COUNTER' && !wandOn) {
        stanceMod = 0.28; // 严密防反下盲目丢隔空瞬凝仅 28% 刮痧！
      }
      if (p.passives && p.passives.includes('instant_ice')) {
        stanceMod *= (willInterrupt ? 1.22 : 1.12);
      }
    } else if (skill.path === 'SWORD') {
      if (isTempestVacuum && skill.id !== 'basic_attack' && (p.status.rooted > 0 || p.status.poise > 0)) {
        pwr = (skill.lungeRipostePower || skill.power * 1.65) * 1.18;
        willRiposte = true;
        willInterrupt = true;
        rootStepParryTrigger = true;
        stanceMod = 1.22;
      } else if (isEyeStillness && skill.counterLunge && p.status.poise > 0) {
        pwr = skill.lungeRipostePower || skill.power * 1.65;
        willRiposte = true;
        willInterrupt = true;
        stanceMod = 1.15;
      } else if (skill.counterLunge && (stance === 'CLOSE_LUNGE' || stance === 'STAGGERED' || p.status.poise > 0)) {
        pwr = skill.lungeRipostePower || skill.power * 1.6;
        willRiposte = stance === 'CLOSE_LUNGE';
      }
      if (p.status.poise > 0) stanceMod *= 1.35;
      if (p.passives && p.passives.includes('frost_edge')) {
        stanceMod *= 1.18;
      }
      if (hasRelic(p, 'ebony_sword')) {
        stanceMod *= 1.15;
      }
    } else if (skill.path === 'INSIGHT') {
      if (skill.forceInterrupt && stance !== 'STAGGERED') willInterrupt = true;
      if (skill.interruptWindupOnly && stance === 'HEAVY_WINDUP') willInterrupt = true;
      stanceMod = 1.15;
    }

    // 风神·风暴外壁：未破招失衡且风步未封时，外圈飓风偏折盲目直攻；风眼静滞下强攻更受圆心反制大幅削弱
    if (e.aiType === 'wind_god_boss' && !willInterrupt && !willRiposte && skill.path !== 'INSIGHT' && stance !== 'STAGGERED' && !(e.status && e.status.evadeSealed > 0)) {
      stanceMod *= isEyeStillness ? 0.28 : 0.36;
    } else if (isEyeStillness && !willInterrupt && skill.path !== 'INSIGHT') {
      stanceMod *= 0.34;
    }

    // 铭记增伤、北境霜锋3件碎霜与连携追击窗口（1.35×）
    if (skill.elem === 'ice' && hasRelic(p, 'aino_academy_handkerchief')) {
      stanceMod *= 1.2;
    }
    if ((skill.elem === 'water' || skill.elem === 'wind') && hasRelic(p, 'shell_pin')) {
      stanceMod *= 1.18;
    }
    const northFrostShatter = !!(
      skill.path === 'REMOTE' &&
      skill.elem === 'ice' &&
      getSynergyTier(p, 'north_frost') >= 3 &&
      bState._synNorthRemoteTurn !== bState.turn
    );
    if (northFrostShatter) {
      stanceMod *= 1.15;
    }
    const chainApplied = !!(p.status && p.status.breakChain > 0 && skill.id !== 'basic_attack');
    if (chainApplied) {
      stanceMod *= 1.35;
    }

    // 单次临时破绽印记 flawToken（打中一次立即消耗清除，且不覆盖 GUARD_COUNTER 对盲目 REMOTE 的惩罚）
    if (e.flawToken > 0 && !(skill.path === 'REMOTE' && stance === 'GUARD_COUNTER')) {
      stanceMod *= 1.2;
    }

    if (e.broken) {
      stanceMod *= COMBAT_BALANCE_V22.HSR_AV.breakVulnMult;
    } else if (stance === 'STAGGERED') {
      stanceMod *= 1.25;
    }
    if (e.status && e.status.vuln > 0) stanceMod *= 1.32;

    // 贝阿特丽丝 / 东翼封锁官：烈焰斗气与架势相克（双火蛇需冰晶冻核，融冰剑障/红莲守势需水弹浇灭）
    if (e.fireAura > 0 && !skill.shatterFireAura && skill.path !== 'INSIGHT') {
      stanceMod *= (1.0 - 0.10 * Math.min(3, e.fireAura));
    }
    if ((e.aiType === 'beatrice' || e.aiType === 'eastwing_boss') && skill.path !== 'INSIGHT') {
      if (e.aiType === 'beatrice' && stance === 'DUAL_CAST') {
        if (skill.elem === 'ice') stanceMod *= 1.32;
        else if (skill.elem === 'water') stanceMod *= 0.58;
      } else if (stance === 'GUARD_COUNTER' && e.intent && e.intent.meltIceCounter && skill.elem === 'ice') {
        stanceMod *= 0.28;
      }
    }
    if (e.intent && e.intent.punishRepeatAtk && e.intent.punishRepeatAtk === skill.id) {
      stanceMod *= 0.52;
    }

    // 爱丽丝微风缓冲：魔力尚存时借气流缓冲伤害，未被十字冰栏封印风轨前规避大半地面冰棘
    if (e.windCushion && (e.mp || 0) > 0 && skill.path !== 'INSIGHT') {
      stanceMod *= 0.78;
    }
    if (e.aiType === 'alice' && skill.aoe && !(e.status && e.status.evadeSealed > 0)) {
      stanceMod *= 0.42;
    }
    // 群狼合围牵制：场上存活群狼 >= 3 只时，单点技能受侧翼合围干扰威力大减（逼用范围冰棘破阵）
    const alivePackCount = bState.enemies ? bState.enemies.filter(x => x.hp > 0 && x.aiType === 'pack_wolf').length : 0;
    if (alivePackCount >= 3 && !skill.aoe) {
      stanceMod *= 0.42;
    }

    const elemMult = getElemMult(skill.elem, e.elem);

    // 艾诺正面无气泡镜冰阻挡非破招攻击
    if (e.mirrorGuard && !skill.bypassMirror && !willInterrupt) {
      return {
        dmg: 0, mult: elemMult, mcMult, mpCost,
        willInterrupt: false, willRiposte: false, mirrorBlocked: true, chainApplied,
        trueMagic: wandOn, ampTier: ampProfile.tier, ampPct: ampProfile.ampPct, extraLocks: 0,
      };
    }

    // V2.2 晦轮杖 100% 魔法真伤 vs K=80 双曲线比值防御
    let defMit = 1.0;
    let defPierce = 0;
    if (wandOn) {
      // 100% 无视敌方 MDEF 与 magic 护盾；唯物理实体厚甲/石壁按 (1 - solidArmor) 阻尼
      const solidArmor = Math.max(0, Math.min(0.85, Number(e.solidArmor) || 0));
      defMit = 1.0 - solidArmor;
    } else {
      const defVal = skill.atkKind === 'atk' ? e.def : skill.atkKind === 'hybrid' ? Math.min(e.def, e.mdef) * 0.7 : e.mdef;
      if (ampProfile.defPierce > 0) defPierce += ampProfile.defPierce;
      if (skill.elem === 'ice' && getSynergyTier(p, 'north_frost') >= 2) defPierce += 0.15;
      if (skill.elem === 'ice' && p.status && p.status.frostPierce > 0 && hasRelic(p, 'aino_frost_shard')) defPierce += 0.25;
      const clampedPierce = Math.min(COMBAT_BALANCE_V22.MAX_DEF_PIERCE, defPierce);
      const effDef = Math.max(0, defVal * (1 - clampedPierce));
      defMit = COMBAT_BALANCE_V22.DEF_K / (COMBAT_BALANCE_V22.DEF_K + effDef);
    }

    const raw = atkStat * pwr * mcMult * stanceMod * elemMult * defMit;
    return {
      dmg: Math.max(4, Math.round(raw)),
      mult: elemMult,
      mcMult,
      mpCost,
      willInterrupt,
      willRiposte,
      rootStepParryTrigger,
      northFrostShatter,
      wandRefract: wandOn,
      trueMagic: wandOn,
      ampTier: ampProfile.tier,
      ampPct: ampProfile.ampPct,
      extraLocks: ampProfile.extraLocks,
      defPierce,
      defMit,
      chainApplied,
    };
  }

  function computeTacticalForecast(bState, skill, targetEnemy) {
    if (!bState || !skill) return null;
    const p = bState.player;
    const e = targetEnemy || getPrimaryAliveEnemy(bState);
    if (!e) return null;
    const apCost = computeSkillApCost(bState, skill);
    const mpCost = computeSkillMpCost(p, skill);
    const stance = e.intent ? e.intent.stance : 'HEAVY_WINDUP';
    const wandOn = isEclipseStaffForSkill(p, skill);
    const isTempestVacuum = !!(e.aiType === 'wind_god_boss' && (e.phase || 1) >= 2 && e.intent && e.intent.moveKey === 'TEMPEST_VACUUM');
    const isEyeStillness = !!(e.aiType === 'wind_god_boss' && (e.phase || 1) >= 2 && e.intent && e.intent.moveKey === 'EYE_STILLNESS');

    if (!skill.power || skill.power <= 0) {
      const willParry = !!(skill.dodgeLunge && stance === 'CLOSE_LUNGE');
      const headline = (skill.dodgeLunge && isTempestVacuum)
        ? '✦ 生根步·斩风瞬反就绪！（反制真空连刃并获下回合 +1 AP）'
        : willParry
          ? '✦ 触发卸力闪反（并开启连携追击）！'
          : '稳固防线 / 战术步法';
      return {
        skillId: skill.id,
        apCost,
        mpCost,
        dmgMin: 0,
        dmgMax: 0,
        elemMult: 1,
        mcMult: 1,
        ampTier: 0,
        ampPct: 0,
        lockDamage: 0,
        manaReturn: 0,
        critChance: 0,
        trueMagic: false,
        willInterrupt: false,
        willRiposte: willParry,
        guardPenalty: false,
        mirrorBlocked: false,
        evadeBlocked: false,
        chainApplied: false,
        headline,
        kind: willParry ? 'riposte' : 'utility'
      };
    }

    const est = estimateSkillDamage(bState, skill, e);
    const critChance = getPlayerCritChance(p, skill);
    const critMult = getPlayerCritMult(p);
    const bypassEvade = !!(skill.aoe || skill.sureHit || wandOn || stance === 'STAGGERED' || est.rootStepParryTrigger || (isEyeStillness && est.willInterrupt));
    const evadeBlocked = !bypassEvade && e.evadeCharges > 0;
    const guardPenalty = (skill.path === 'REMOTE' && stance === 'GUARD_COUNTER' && !wandOn) ||
      ((e.aiType === 'beatrice' || e.aiType === 'eastwing_boss') && stance === 'GUARD_COUNTER' && e.intent && e.intent.meltIceCounter && skill.elem === 'ice' && skill.path !== 'INSIGHT') ||
      (e.aiType === 'wind_god_boss' && e.intent && e.intent.windGuardCounter && !est.willInterrupt && skill.path !== 'INSIGHT');

    const dmgMin = (est.mirrorBlocked || evadeBlocked) ? 0 : est.dmg;
    const dmgMax = (est.mirrorBlocked || evadeBlocked) ? 0 : (critChance > 0 ? Math.round(est.dmg * critMult) : est.dmg);

    let effShield = e.shield || 0;
    if (skill.shatterShield) effShield = 0;
    else if (wandOn && (e.shieldKind || 'magic') === 'magic') effShield = 0;
    else if (skill.pierceHalfShield) effShield = Math.floor(effShield * 0.5);
    const estHpLoss = Math.min(e.hp, Math.max(0, dmgMin - effShield));

    let manaReturn = 0;
    if (p.hasManaCycle && skill.elem !== 'phys' && estHpLoss > 0) {
      const jikanDouble = (skill.path === 'SWORD' && (est.willRiposte || est.willInterrupt) && getSynergyTier(p, 'jikan_blade') >= 2);
      manaReturn += jikanDouble ? estHpLoss * 2 : Math.round(estHpLoss * COMBAT_BALANCE_V22.MANA_CYCLE.returnRatio);
    }
    if (est.chainApplied) {
      manaReturn += Math.round(p.mmp * 0.15) + (hasRelic(p, 'shell_pin') ? Math.round(p.mmp * 0.08) : 0);
    }

    const fcCounterOrInsight = !!(est.willInterrupt || est.willRiposte || est.rootStepParryTrigger || skill.path === 'INSIGHT');
    const fcFresh = !bState.aiMemory || bState.aiMemory.lastAtkSkillId !== skill.id || (bState.aiMemory.sameAtkSkillStreak || 0) < 1;
    let lockDamage = 0;
    if (!(est.mirrorBlocked || evadeBlocked || guardPenalty)) {
      if (fcCounterOrInsight) {
        lockDamage = getSkillBaseLockDamage(skill) + 1 + (est.extraLocks || 0);
      } else if (fcFresh && est.mult > 1.0) {
        lockDamage = getSkillBaseLockDamage(skill) + (est.extraLocks || 0);
      } else if (fcFresh && est.mult >= 1.0 && (est.extraLocks || 0) > 0) {
        lockDamage = est.extraLocks;
      }
      if (skill.aoe && !fcCounterOrInsight && lockDamage > 1) lockDamage = 1;
    }

    let headline = `预计伤害 ${dmgMin}${dmgMax > dmgMin ? `~${dmgMax}` : ''}`;
    let kind = 'normal';
    if (est.mirrorBlocked) {
      headline = '将被正面镜冰格挡（请开冰宫或打断）';
      kind = 'warn';
    } else if (evadeBlocked) {
      headline = `将被敌方闪避层抵消（余 ${e.evadeCharges} 层）`;
      kind = 'warn';
    } else if (guardPenalty) {
      headline = '敌方严密防反，盲丢将衰减！';
      kind = 'warn';
    } else if (est.rootStepParryTrigger) {
      headline = '✦ 生根步·斩风瞬反！（截断真空连刃并获 +1 AP 与连携！）';
      kind = 'riposte';
    } else if (est.willInterrupt) {
      headline = '✦ 触发截断破招！（并激活连携追击）';
      kind = 'interrupt';
    } else if (est.willRiposte) {
      headline = '✦ 触发卸力闪反！（并激活连携追击）';
      kind = 'riposte';
    } else if (wandOn) {
      headline = (e.solidArmor > 0)
        ? `✦ 晦轮杖真伤（实体甲阻尼 ${Math.round(e.solidArmor * 100)}%）`
        : '✦ 晦轮杖 100% 魔法真伤（无视法抗与魔法盾）！';
      kind = 'chain';
    } else if (est.chainApplied) {
      headline = '✦ 连携追击生效（1.35× 伤害 + 返蓝）！';
      kind = 'chain';
    }

    return {
      skillId: skill.id,
      apCost,
      mpCost,
      dmgMin,
      dmgMax,
      estHpLoss,
      elemMult: est.mult,
      mcMult: est.mcMult,
      ampTier: est.ampTier || 0,
      ampPct: est.ampPct || 0,
      lockDamage,
      trueMagic: wandOn,
      manaReturn,
      critChance,
      willInterrupt: est.willInterrupt,
      willRiposte: est.willRiposte,
      rootStepParryTrigger: !!est.rootStepParryTrigger,
      guardPenalty,
      mirrorBlocked: !!est.mirrorBlocked,
      evadeBlocked,
      chainApplied: !!est.chainApplied,
      headline,
      kind
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

  function selectTarget(idx, b) {
    b = b || activeBattle;
    if (!b || b.over || !Array.isArray(b.enemies)) return false;
    const target = b.enemies[idx];
    if (!target || target.hp <= 0) return false;
    b.targetIdx = idx;
    armedSkillId = null;
    if (!b.headless) renderCombatUI();
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

  function clearAllJuiceVfx() {
    resetCombatTrauma();
    if (_logScrollRaf && typeof global.cancelAnimationFrame === 'function') {
      global.cancelAnimationFrame(_logScrollRaf);
    }
    _logScrollRaf = 0;
    _hitStopId += 1;
    _hitStopTimer = null;
    _activeVfxTimers.forEach(tid => clearTimeout(tid));
    _activeVfxTimers.clear();
    if (global.CombatPixelVFX && typeof global.CombatPixelVFX.cleanup === 'function') {
      global.CombatPixelVFX.cleanup();
    }
    if (typeof document !== 'undefined') {
      const field = document.querySelector('#battle-screen .cb-arena-field');
      if (field) field.classList.remove('cb-hitstop', 'cb-hitstop-75');
      document.querySelectorAll('#battle-screen .cb-elem-vfx-layer').forEach(el => el.remove());
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
      } else if (arg2 === 'player' || arg2 === 'enemy') {
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
        host = document.querySelector('#battle-screen #cb-player-stage .cb-standee-wrap')
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
    if (side === 'player') {
      div.style.left = '18%';
      div.style.top = kind === 'mp' ? '44%' : kind === 'shield' ? '36%' : '28%';
    } else {
      const total = Math.max(1, (b.enemies || []).length);
      const idx = Math.max(0, Math.min(total - 1, enemyIdx || 0));
      const pct = 40 + ((idx + 0.5) / total) * 56;
      div.style.left = pct.toFixed(1) + '%';
      div.style.top = '34%';
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
        <div class="cb-p2-title">${title || '第二阶段 · 绝境展开'}</div>
        <div class="cb-p2-boss">${boss ? boss.name : ''}</div>
        <div class="cb-p2-quote">${quote || ''}</div>
      </div>
      <div class="cb-p2-stripe bottom" aria-hidden="true"></div>
    `;
    root.appendChild(el);
    trackVfxTimer(() => { if (el.parentNode) el.remove(); }, 2200);
  }

  function triggerBossPhase2(b, enemy) {
    if (!b || !enemy || (enemy.phase || 1) >= 2) return false;
    enemy.phase = 2;
    enemy.phase2Step = 0;
    enemy.broken = false;
    if (enemy.maxLocks) enemy.locks = enemy.maxLocks;
    if (b.metrics) b.metrics.phase2Triggered = true;
    if (enemy.status) delete enemy.status.stagger;

    let bannerTitle = '第二阶段 · 阵势蜕变';
    let quote = `${enemy.name} 气息骤然凝实，改换高压攻势！`;
    let theme = 'ember';
    let refreshShield = 60;

    if (enemy.aiType === 'eastwing_boss') {
      bannerTitle = '第二阶段 · 红莲铁幕封廊';
      quote = '「封死东翼全部窗门！今夜谁也休想踏出维斯特利亚公爵府半步！」';
      theme = 'ember';
      refreshShield = 72;
      enemy.fireAura = Math.max(enemy.fireAura || 0, 2);
      enemy.spd = Math.max(enemy.spd || 108, 116);
      enemy.baseAv = computeBaseAv(enemy.spd);
      enemy.av = Math.min(enemy.av || enemy.baseAv, enemy.baseAv);
    } else if (enemy.aiType === 'wind_god_boss') {
      bannerTitle = '第二阶段 · 风暴眼全开';
      quote = '「热身到此为止。飓风最中心其实是静止的——接得住这一剑，才算摸到风暴眼的门槛。」';
      theme = 'storm';
      refreshShield = 68;
      enemy.spd = Math.max(enemy.spd || 132, 142);
      enemy.baseAv = computeBaseAv(enemy.spd);
      enemy.av = Math.min(enemy.av || enemy.baseAv, enemy.baseAv);
      if (!(enemy.status && enemy.status.evadeSealed > 0)) {
        enemy.evadeCharges = Math.max(enemy.evadeCharges || 0, 1);
      }
    } else {
      bannerTitle = enemy.phase2Title || bannerTitle;
      quote = enemy.phase2Quote || quote;
      refreshShield = enemy.phase2Shield || refreshShield;
    }

    enemy.shield = Math.max(enemy.shield || 0, refreshShield);
    decideEnemyIntent(enemy, b);

    pushLog(b, logTag('cbl-star', `✦【${bannerTitle}】${enemy.name} 步入二阶段（护盾重整至 ${enemy.shield}，失衡清除）！${quote}`, true));
    spawnPhase2Overlay(b, enemy, bannerTitle, quote, theme);
    addCombatTrauma(0.92, b);
    const bossIdx = b.enemies ? b.enemies.indexOf(enemy) : 0;
    if (bossIdx >= 0) queueElementVFX(b, 'break', 'enemy', bossIdx);
    if (!b.headless) safeSfx('phase2');
    return true;
  }

  function initWave(b, waveIdx) {
    const sc = b.stageCfg;
    const w = sc.waves[waveIdx];
    b.waveIdx = waveIdx;
    b.waveTurn = 1;
    b.ainoSpearsFiredInWave = 0;
    b.oneMoreUsedThisTurn = false;
    b.oneMoreActive = false;
    if (b.player) b.player.av = 0;
    if (b.aiMemory) b.aiMemory.turtleStreak = 0;
    b._pendingElementVFX = [];
    b._pendingPixelActions = [];
    b._pendingHitPulses = [];
    if (waveIdx > 0 && !b.headless) {
      clearAllJuiceVfx();
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
    delete b.palacePendingStep2;
    b.witnessActive = !!w.witnessActive;
    b.frostFloorTurns = 0;

    // 切换新波次时清理上一波的临时看破技，并为拥有冰晶宫殿的玩家重置本波 1 次审视机会！
    if (waveIdx > 0 && b.player.unlockedInsights && b.player.unlockedInsights.length) {
      const stale = new Set(b.player.unlockedInsights);
      b.player.skills = b.player.skills.filter(id => !stale.has(id));
      b.player.unlockedInsights = [];
    }
    if (b.player.palaceMax > 0) {
      b.player.palaceLeft = b.player.palaceMax;
    }

    if (w.witnessActive && b.exposure < (w.initialExposure || 25)) {
      b.exposure = w.initialExposure || 25;
    }
    b.enemies = w.enemies.map((tpl, idx) => {
      const eSpd = tpl.spd || (tpl.boss ? 112 : 95);
      const eBaseAv = computeBaseAv(eSpd);
      const eMaxLocks = tpl.maxLocks != null ? tpl.maxLocks : (tpl.boss ? 4 : 3);
      return Object.assign({}, tpl, {
        status: {},
        shield: Math.max(0, tpl.shield || 0),
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
        flawToken: 0,
        seepSevered: false,
        seepTriggeredOnce: false,
        wasInterruptedLastTurn: false,
        intent: null,
      });
    });
    b.targetIdx = 0;
    ensureValidTarget(b);

    b.enemies.forEach(e => {
      if (e.aiType === 'noelle') {
        e.shield = 52;
        e.shieldKind = 'magic';
      }
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
  }

  function isPalaceReady(b) {
    if (!b || b.over) return false;
    if (b.player.palaceMax <= 0 || b.player.palaceLeft <= 0) return false;
    // 原著法则：须先亲眼见识敌方本波至少出手一轮（本波第 2 回合起）方可展开冰晶宫殿并行推演！
    return (b.waveTurn || 1) >= 2;
  }

  function createBattleState(stageCfg, opts) {
    opts = opts || {};
    const player = buildPlayerCombatant(stageCfg, opts);
    const b = {
      id: stageCfg.id,
      battleInstanceId: ++_battleInstanceSeq,
      stageCfg,
      player,
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
      _forceCrit: !!opts.forceCrit,
      // 专属战场仪表
      playerHits: 0,
      enemyHits: 0,
      sealProgress: 0,
      frostFloorTurns: 0,
      exposure: 0,
      witnessActive: false,
      exposureWarningTriggered: false,
      crateHp: stageCfg.crateRule ? 100 : null,
      crateMax: stageCfg.crateRule ? 100 : null,
      ainoResonance: 0,
      ainoSpearsFiredInWave: 0,
      // 动态 AI 行为记忆黑板
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
      // 评分与实战验证统计
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
      },
      palaceInspectedWaves: {},
      log: [],
    };
    initWave(b, 0);
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
    return b;
  }

  function setOvercast(mode, b) {
    b = b || activeBattle;
    if (!b || b.over) return false;
    if (!b.player.hasManaCycle) return false;
    const nextMode = Math.max(0, Math.min(2, mode | 0));
    const nextAmp = nextMode === 2 ? 0.50 : nextMode === 1 ? 0.25 : 0;
    const changed = b.player.overcastMode !== nextMode || Math.abs((b.player.ampPct || 0) - nextAmp) > 1e-4;
    b.player.overcastMode = nextMode;
    b.player._lastOvercastMode = nextMode;
    b.player.ampPct = nextAmp;
    armedSkillId = null;
    if (!b.headless) {
      if (changed) safeSfx('tab_switch');
      renderCombatUI();
    }
    return true;
  }

  function setAmpPct(pct, b, opts) {
    if (b && typeof b === 'object' && !('player' in b) && !('enemies' in b)) {
      opts = b;
      b = activeBattle;
    }
    b = b || activeBattle;
    if (!b || b.over || !b.player.hasManaCycle) return { ok: false, ampPct: 0, overcastMode: 0, tier: getAmpTierInfo(0) };
    let val = Number(pct);
    if (!isFinite(val)) val = 0;
    if (val > 1) val = val / 100;
    val = Math.max(0, Math.min(0.50, val));
    if (opts && opts.snap) {
      const snaps = [0, 0.25, 0.50];
      for (const s of snaps) {
        if (Math.abs(val - s) <= 0.02) { val = s; break; }
      }
    }
    val = Math.round(val * 10000) / 10000;
    const nextMode = val >= 0.48 ? 2 : val >= 0.20 ? 1 : 0;
    const changed = Math.abs((b.player.ampPct || 0) - val) > 1e-4 || b.player.overcastMode !== nextMode;
    b.player.ampPct = val;
    b.player.overcastMode = nextMode;
    b.player._lastOvercastMode = nextMode;
    armedSkillId = null;
    if (!b.headless) {
      if (changed && !(opts && opts.silent)) safeSfx('tab_switch');
      renderCombatUI();
    }
    return { ok: true, ampPct: val, overcastMode: nextMode, tier: getAmpTierInfo(val) };
  }

  function setEquippedStaff(staffId, b) {
    b = b || activeBattle;
    if (!b || b.over) return false;
    const def = COMBAT_BALANCE_V22.STAVES[staffId];
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
    // V2.2：晦轮杖零冷却、无四不享受、无魔战锁，核心制约在于 +24% MaxMP 额外耗蓝与耳目暴露风险；希尔维亚无法发动日蚀
    p.wandCooldown = 0;
    armedSkillId = null;
    p.wandActive = forceVal !== undefined ? !!forceVal : !p.wandActive;
    if (!p.wandActive) {
      p.wandPersistent = false;
      if (p.equippedStaff === 'eclipse_wand') p.equippedStaff = 'none';
    }
    if (!b.headless) safeSfx('tab_switch');
    if (p.wandActive) {
      if (b.witnessActive) {
        b.exposure = Math.min(100, b.exposure + 25);
        if (b.exposure >= 70) b.exposureWarningTriggered = true;
      }
      const extraMpNow = Math.round(Math.max(1, p.mmp || 100) * COMBAT_BALANCE_V22.STAVES.eclipse_wand.extraMpPct);
      pushLog(b, logTag('cbl-violet', `🪄 催动「晦轮杖」暗银细环：下一次魔法附带【100% 魔法真伤】（无视法抗与魔法盾，仅物理实体甲阻尼；额外耗蓝 +${extraMpNow} MP，保留暴击与魔战循环，无冷却）！${b.witnessActive ? `（⚠️ 耳目附近拔杖引动异象，暴露风险升至 ${b.exposure}%！）` : ''}`));
      spawnBanner(b, '🪄 晦轮杖 · 魔法真伤', 'wand');
      queuePixelAction(b, { type: 'wand_toggle' });
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

  function getCurrentPalaceConfig(b) {
    const sc = b.stageCfg;
    if (sc.palaceByWave && sc.palaceByWave[b.waveIdx]) return sc.palaceByWave[b.waveIdx];
    if (sc.palace) return sc.palace;
    const e = getPrimaryAliveEnemy(b);
    const nm = e ? e.name : '敌方';
    return {
      sceneText: `意识沉入冰晶宫殿，多条回忆与交锋脉络在冰镜中并行展开，${nm}的发力姿态被完整拆解。`,
      clues: [
        { id: 'decoy_a', text: `表面流转的寻常魔力余波正随呼吸轻轻起伏`, correct: false, feedback: '表面余波并无异常。' },
        { id: 'true_flaw', text: `前踏发力瞬间，支撑脚踝外侧重心明显悬空`, correct: true, feedback: '观察准确！支撑脚重心已锁死！' },
        { id: 'decoy_b', text: `身后十步外的枯枝被掠过的阵风吹得微颤`, correct: false, feedback: '只是寻常林风。' },
      ],
      deductions: [
        { id: 'decoy_d', text: `原地等待对方收招，再以普通斩击正面硬拼`, correct: false, feedback: '错失转瞬即逝的重心死角。' },
        { id: 'true_d', text: `将寒霜精准打入支撑脚死角，截断发力链条`, correct: true, unlockSkill: 'insight_generic_flaw', feedback: '推演完成！锁定支撑死角！' },
      ],
    };
  }

  // 支持两步推理核验：本波第 2 回合起可用，且与弹窗第 1 步锁定扣次机制无缝衔接
  function inspectClue(clueId, deductionId, b) {
    if (deductionId && typeof deductionId === 'object') {
      b = deductionId;
      deductionId = null;
    }
    b = b || activeBattle;
    if (!b || b.over) return { ok: false, reason: 'no_battle' };

    const fromPendingStep2 = !!(b.palacePendingStep2 && b.palacePendingStep2.clueId === clueId);
    if (!fromPendingStep2) {
      if ((b.waveTurn || 1) < 2) {
        return { ok: false, reason: 'gathering_turn1' };
      }
      if (b.player.palaceLeft <= 0) {
        return { ok: false, reason: 'no_charges' };
      }
    }

    const pCfg = getCurrentPalaceConfig(b);
    const clue = (pCfg.clues || []).find(c => c.id === clueId);
    if (!clue) return { ok: false, reason: 'bad_clue' };

    if (fromPendingStep2) {
      delete b.palacePendingStep2;
    } else {
      b.player.palaceLeft -= 1;
    }

    if (!clue.correct) {
      // 选错观察点有真实战术代价：并行推演失焦损耗 1 AP（若当前有 AP）
      if (b.ap > 0) b.ap = Math.max(0, b.ap - 1);
      pushLog(b, logTag('cbl-danger', `❄️【冰晶宫殿·误判】${clue.feedback}（并行推演失焦损耗 1 AP！）`));
      if (!b.headless) renderCombatUI();
      return { ok: true, correct: false, step: 1, feedback: clue.feedback };
    }

    // 第 2 步推演核验
    const dList = pCfg.deductions || [];
    let ded = null;
    if (dList.length) {
      if (deductionId) {
        ded = dList.find(d => d.id === deductionId);
      } else {
        ded = dList.find(d => d.correct);
      }
      if (!ded || !ded.correct) {
        if (b.ap > 0) b.ap -= 1;
        const fb = ded ? ded.feedback : '推演方向偏差，未能形成有效反制。';
        pushLog(b, logTag('cbl-danger', `❄️【冰晶宫殿·推演偏差】${fb}（损耗 1 AP！）`));
        if (!b.headless) renderCombatUI();
        return { ok: true, correct: false, step: 2, feedback: fb };
      }
    }

    const skId = (ded && ded.unlockSkill) || clue.unlockSkill || 'insight_generic_flaw';
    b.metrics.insights += 1;
    b.palaceInspectedWaves[b.waveIdx] = true;
    if (!b.player.skills.includes(skId)) {
      b.player.skills.push(skId);
      b.player.unlockedInsights.push(skId);
    }
    delete b.player.usedMaxSkills[skId];

    // 仅赋予 1 层单次破绽印记 flawToken（触发一次攻击后立即销毁，绝不永久破坏 GUARD_COUNTER）
    const target = getPrimaryAliveEnemy(b);
    if (target) {
      target.flawToken = 1;
    }

    const finalFb = (ded && ded.feedback) || clue.feedback;
    pushLog(b, logTag('cbl-ice', `❄️【冰晶宫殿·两步看破】${finalFb} 解锁「${TACTICAL_SKILLS[skId].name}」！`));
    if (hasRelic(b.player, 'frost_cipher')) {
      const recMp = Math.max(10, Math.round(b.player.mmp * 0.18));
      const beforeMp = b.player.mp;
      b.player.mp = Math.min(b.player.mmp, b.player.mp + recMp);
      b.ap = Math.min(b.apMax, b.ap + 1);
      pushLog(b, logTag('cbl-ice', `💠【霜封暗记】看破瞬间魔脉回涌 +${b.player.mp - beforeMp} MP、+1 AP！`));
    }
    if (getSynergyTier(b.player, 'academy_stars') >= 2) {
      if (target) {
        target.status.vuln = (target.status.vuln || 0) + 2;
      }
      const synMp = Math.max(10, Math.round(b.player.mmp * 0.12));
      const beforeSynMp = b.player.mp;
      b.player.mp = Math.min(b.player.mmp, b.player.mp + synMp);
      const gainedSynMp = Math.max(0, b.player.mp - beforeSynMp);
      b.metrics.manaRecycled += gainedSynMp;
      if (gainedSynMp > 0) spawnCombatFloat(b, 'player', `+${gainedSynMp} MP`, 'mp');
      pushLog(b, logTag('cbl-star', `✦【共鸣·学院星辉(2件)】冰宫看破附加 2 层易伤并回流 +${synMp} MP！`));
    }
    spawnBanner(b, '❄️ 冰晶宫殿 · 破绽锁定！', 'interrupt');
    if (!b.headless) safeSfx('ice_shatter');
    if (!b.headless) renderCombatUI();
    return { ok: true, correct: true, unlockedSkill: skId, feedback: finalFb };
  }

  function dealDamageToEnemy(b, enemy, dmg, opts) {
    opts = opts || {};
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
        // V2.2 晦轮杖 100% 魔法真伤：完全无视 magic 护盾；物理实体盾（solid）仍可正常承伤
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

    // 诺艾儿二阶段保护（尺量应急水垫）：首次濒临 165 HP 以下且暗流未被斩断时，稳守 165 HP 并切入【冰缝暗流陷阱】！
    if (enemy.aiType === 'noelle' && !enemy.seepTriggeredOnce && !enemy.seepSevered && !opts.severSeep && enemy.hp > 165 && enemy.hp - rem <= 165) {
      const actualHpLoss = enemy.hp - 165;
      enemy.hp = 165;
      enemy.seepTriggeredOnce = true;
      if (enemy.mp != null) enemy.mp = Math.max(0, enemy.mp - 18);
      enemy.shield = Math.max(enemy.shield, 60);
      enemy.shieldKind = 'magic';
      delete enemy.status.stagger;
      enemy.intent = {
        stance: 'UNDER_SEEP',
        moveName: '残魔退守（脚底冰缝暗流穿心！）',
        dmg: 52,
        trapDmg: 205,
        elem: 'water',
        mpCost: 12,
        ambushTrap: true,
      };
      b.metrics.enteredUnderSeep = true;
      spawnBanner(b, '💧 冰面暗流 · 杀阵成型！', 'danger');
      pushLog(b, logTag('cbl-ice', `💧【尺量应急水垫】诺艾儿借薄水垫卸开致命追击退至十五米外（稳守 165 HP + 60 水幕），冰缝下的暗水线已彻底锁死你的脚底！`, true));
      return { actualHpLoss, shieldAbsorbed, magicShieldBypassed, enteredUnderSeep: true };
    }

    // 高难 Boss 半血二阶段锁血转场门控：确保转阶段演出与招式池切换完整触发
    if (enemy.boss && enemy.phase2HpPct && (enemy.phase || 1) < 2) {
      const threshold = Math.max(1, Math.floor(enemy.mhp * enemy.phase2HpPct));
      if (enemy.hp > threshold && enemy.hp - rem <= threshold) {
        const actualHpLoss = enemy.hp - threshold;
        enemy.hp = threshold;
        triggerBossPhase2(b, enemy);
        return { actualHpLoss, shieldAbsorbed, magicShieldBypassed, phase2Triggered: true };
      }
    }

    const minHp = (enemy.nonLethalSpar || opts.nonLethalCap) ? 1 : 0;
    const maxCanLose = Math.max(0, enemy.hp - minHp);
    const actualHpLoss = Math.min(maxCanLose, rem);
    enemy.hp = Math.max(minHp, enemy.hp - rem);

    if (enemy.hp <= 0) {
      ensureValidTarget(b);
    }

    if (enemy.boss && enemy.phase2HpPct && (enemy.phase || 1) < 2 && enemy.hp > 0 && enemy.hp <= Math.ceil(enemy.mhp * enemy.phase2HpPct)) {
      triggerBossPhase2(b, enemy);
      return { actualHpLoss, shieldAbsorbed, magicShieldBypassed, phase2Triggered: true };
    }

    return { actualHpLoss, shieldAbsorbed, magicShieldBypassed };
  }

  function useSkill(skillId, targetIdx, b) {
    _logBatchDepth += 1;
    try {
      return _useSkillCore(skillId, targetIdx, b);
    } finally {
      _logBatchDepth = Math.max(0, _logBatchDepth - 1);
      if (_logBatchDepth === 0) flushCombatLogDOM(b || activeBattle);
    }
  }

  function _useSkillCore(skillId, targetIdx, b) {
    b = b || activeBattle;
    if (!b || b.over) return { ok: false, reason: 'over' };
    const p = b.player;
    const sk = TACTICAL_SKILLS[skillId];
    if (!sk || !p.skills.includes(skillId)) return { ok: false, reason: 'locked' };
    if (sk.maxUses && (p.usedMaxSkills[skillId] || 0) >= sk.maxUses) return { ok: false, reason: 'max_uses' };
    if ((p.cooldowns[skillId] || 0) > 0) return { ok: false, reason: 'cooldown' };
    const apCost = computeSkillApCost(b, sk);
    if (b.ap < apCost) return { ok: false, reason: 'no_ap' };

    const mpCost = computeSkillMpCost(p, sk);
    if (p.mp < mpCost) return { ok: false, reason: 'no_mp' };

    const powerMp = computeOvercastPowerMp(p, sk);
    const ampProfile = computeAmpProfile(p, sk);
    const mcMult = computeManaCycleMultiplier(p, powerMp, sk);
    if (mcMult > b.metrics.maxOvercastMult) b.metrics.maxOvercastMult = mcMult;

    if (targetIdx != null && b.enemies[targetIdx] && b.enemies[targetIdx].hp > 0) {
      b.targetIdx = targetIdx;
    }
    const primary = getPrimaryAliveEnemy(b);
    if (!primary) return { ok: false, reason: 'no_target' };

    const usedWand = isEclipseStaffForSkill(p, sk);
    armedSkillId = null;

    // 扣除资源与记录冷却
    if (apCost === 0 && sk.ap > 0 && sk.path === 'REMOTE' && b.turn === 1 && !b._handkerchiefFreeRemoteUsed && hasRelic(p, 'aino_academy_handkerchief')) {
      b._handkerchiefFreeRemoteUsed = true;
      pushLog(b, logTag('cbl-ice', `🧣【雪纹手帕】首回合初次【隔空瞬凝】免除 AP 消耗！`));
    }
    b.ap = Math.max(0, b.ap - apCost);
    p.mp = Math.max(0, p.mp - mpCost);
    if (sk.maxUses) p.usedMaxSkills[skillId] = (p.usedMaxSkills[skillId] || 0) + 1;
    if (sk.cooldown) p.cooldowns[skillId] = sk.cooldown;
    if (usedWand) {
      // V2.2：晦轮杖零冷却；单发开关模式施放后自动收敛，常驻持杖模式保持激活
      p.wandCooldown = 0;
      if (!p.wandPersistent) p.wandActive = false;
      b.metrics.wandHits += 1;
    }

    // 【公爵府遗忆(3件)】：每回合首次水/冰系技能回复 10% 最大 MP
    if ((sk.elem === 'water' || sk.elem === 'ice') && getSynergyTier(p, 'dukedom_memory') >= 3 && b._synDukedomElemTurn !== b.turn) {
      b._synDukedomElemTurn = b.turn;
      const recMp = Math.max(8, Math.round(p.mmp * 0.1));
      const beforeMp = p.mp;
      p.mp = Math.min(p.mmp, p.mp + recMp);
      const gained = Math.max(0, p.mp - beforeMp);
      b.metrics.manaRecycled += gained;
      if (gained > 0) spawnCombatFloat(b, 'player', `+${gained} MP`, 'mp');
      pushLog(b, logTag('cbl-star', `✦【共鸣·公爵府遗忆(3件)】水冰调和回涌 +${recMp} MP！`));
    }

    // 记录 AI 记忆黑板（含同技能与跨护盾同攻击技能复读监测）
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
      let expDelta = sk.exposure || 0;
      if (usedWand) expDelta += 55;
      if (hasRelic(p, 'ebony_sword') && sk.path === 'SWORD') {
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
        pushLog(b, logTag('cbl-danger', `🚨 暴露风险达 100%！「极光」小队已循着魔力波动冲入林间，行踪彻底败露！`, true));
        finishBattle(b, false, 'exposed');
        return { ok: true, exposedFail: true };
      }
      if (b.exposure >= 70) b.exposureWarningTriggered = true;
    }

    // 自身净化/护盾/场地效果（注意水系先冲净 blind 再执行命中判定！）
    const washedBlindJustNow = !!(sk.clearBlind && p.status.blind > 0);
    if (washedBlindJustNow) {
      delete p.status.blind;
      pushLog(b, logTag('cbl-ice', `💧 水流冲净了眼前的扬尘，视野恢复清晰！`));
    }
    if (sk.clearDebuff) {
      delete p.status.blind;
      delete p.status.burn;
    }
    if (sk.layFrostFloor) {
      b.frostFloorTurns = Math.max(b.frostFloorTurns || 0, sk.layFrostFloor);
      b.aiMemory.turtleStreak = 0;
      pushLog(b, logTag('cbl-ice', `❄️ 一层极薄的冰面沿着乱葬岗松土悄然铺开（持续 ${b.frostFloorTurns} 回合）！`));
    }
    if (sk.shieldBase) {
      let gain = Math.round(sk.shieldBase + p.matk * (sk.shieldScale || 0));
      if (sk.elem === 'ice' && p.passives.includes('root_ice')) gain = Math.round(gain * 1.2);
      if (hasRelic(p, 'cross')) gain = Math.round(gain * 1.2);
      const beforeS = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + gain);
      // 物理实体冰盾优先保留 solid 标记，避免水幕覆盖已成型的实体冰壁
      const skShieldKind = sk.shieldKind || 'solid';
      if (beforeS <= 0 || skShieldKind === 'solid') {
        p.shieldKind = skShieldKind;
      }
      const shieldDelta = p.shield - beforeS;
      if (shieldDelta > 0) spawnCombatFloat(b, 'player', `+${shieldDelta} 护盾`, 'shield');
      pushLog(b, logTag('cbl-ice', `🛡️ 「${sk.name}」构筑 ${shieldDelta} 点${p.shieldKind === 'solid' ? '实体' : '魔法'}护盾（当前 ${p.shield}/${p.maxShield}）。`));
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
    }
    if (sk.rooted) p.status.rooted = 1;
    if (sk.iceThorns) p.status.iceThorns = 1; // 仅钢冰生根盾带微弱反刺，物理生根步绝不串味！
    if (sk.dodgeLunge) p.status.lungeParry = 1;
    if (sk.afterimage) p.status.afterimage = (p.status.afterimage || 0) + sk.afterimage;
    if (sk.selfAdvancePct) {
      p.av = Math.max(0, Math.round((p.av || 0) - (p.baseAv || 100) * sk.selfAdvancePct));
    }
    if (sk.nextApBonus) p.status.nextAp = (p.status.nextAp || 0) + sk.nextApBonus;
    if (sk.protectCrate && b.crateHp != null) {
      p.status.crateGuard = (p.status.crateGuard || 0) + sk.protectCrate;
      pushLog(b, logTag('cbl-emerald', `📦 冰障延伸护住医疗药箱（抵御冲击 ${p.status.crateGuard}）！`));
    }
    if (sk.path === 'HAND' && hasRelic(p, 'ice_pebble') && b._pebbleTurn !== b.turn) {
      b._pebbleTurn = b.turn;
      const beforePeb = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + 8);
      if (beforePeb <= 0) p.shieldKind = 'solid';
      pushLog(b, logTag('cbl-ice', `💎【冰蓝石子】经手调魔额外凝结 ${Math.max(8, p.shield - beforePeb)} 护盾（当前 ${p.shield}/${p.maxShield}）。`));
    }

    // 攻击结算
    let totalManaReturned = 0;
    const consumedChain = !!(sk.power && sk.power > 0 && p.status.breakChain > 0 && sk.id !== 'basic_attack');
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
    const hitTargetIndices = [];
    if ((!sk.power || sk.power <= 0) && (sk.shieldBase || sk.layFrostFloor || sk.dodgeLunge || sk.afterimage || washedBlindJustNow)) {
      const defVfxKind = sk.elem === 'water' ? 'water' : (sk.path === 'SWORD' || sk.elem === 'phys') ? 'sword' : 'ice';
      queueElementVFX(b, defVfxKind, 'player', 0, { skipHitStop: true });
      queuePixelAction(b, {
        type: 'skill',
        skillId,
        targetIdx: Math.max(0, b.enemies.indexOf(primary)),
        targetIndices: [Math.max(0, b.enemies.indexOf(primary))],
        usedWand,
        missed: false,
      });
    }
    if (sk.power && sk.power > 0) {
      const targets = sk.aoe ? b.enemies.filter(e => e.hp > 0) : [primary];
      const hadPoise = p.status.poise > 0;
      let peakCastTrauma = 0;
      let castHitStopQueued = false;

      // 玩家被扬尘致盲（blind）时的真实确定性失手判定！
      if (p.status.blind > 0 && !sk.aoe && !sk.sureHit) {
        p.status.blind -= 1;
        if (p.status.blind <= 0) delete p.status.blind;
        pushLog(b, logTag('cbl-star', `🌫️ 视线受扬尘遮蔽，你的「${sk.name}」偏斜落空！（提示：用覆潮水弹/折射水幕洗净视线，或用范围技覆盖）`));
        if (p.overcastMode === 2) {
          p.overcastMode = 0;
          p._lastOvercastMode = 0;
          p.ampPct = 0;
        }
        const missIdx = Math.max(0, b.enemies.indexOf(primary));
        queuePixelAction(b, {
          type: 'skill',
          skillId,
          targetIdx: missIdx,
          targetIndices: [missIdx],
          usedWand,
          missed: true,
        });
        if (!b.headless) {
          safeSfx((sk.path === 'SWORD' || sk.elem === 'phys') ? 'sword_slash' : sk.elem === 'water' ? 'water_surge' : 'ice_cast');
          renderCombatUI();
        }
        return { ok: true, missedByBlind: true };
      }

      targets.forEach(e => {
        if (!e || e.hp <= 0 || p.hp <= 0 || b.over) return;
        const stance = e.intent ? e.intent.stance : 'HEAVY_WINDUP';
        const isTempestRootParry = !!(
          e.aiType === 'wind_god_boss' &&
          (e.phase || 1) >= 2 &&
          e.intent &&
          e.intent.moveKey === 'TEMPEST_VACUUM' &&
          sk.path === 'SWORD' &&
          sk.id !== 'basic_attack' &&
          (p.status.rooted > 0 || hadPoise)
        );
        const isEyeStillnessBreak = !!(
          e.aiType === 'wind_god_boss' &&
          e.intent &&
          e.intent.eyeStillnessStance &&
          (sk.path === 'INSIGHT' || (sk.path === 'SWORD' && sk.counterLunge && hadPoise))
        );
        if (stance === 'UNDER_SEEP' && e.aiType === 'noelle') {
          b.metrics.enteredUnderSeep = true;
        }

        // 诺艾儿残血脚底冰缝暗流翻盘陷阱（100% 绕过正面护盾直刺本体！）
        if (e.intent && e.intent.ambushTrap && !e.seepSevered && !sk.severSeep) {
          if (p.status.afterimage > 0) {
            p.status.afterimage = Math.max(0, p.status.afterimage - 1);
            e.seepSevered = true;
            e.intent.ambushTrap = false;
            pushLog(b, logTag('cbl-emerald', `💨 脚底冰缝暗流骤然暴起，幸亏「风行残像」替身引爆了暗流杀阵，你真身安然避开！`));
          } else {
            const trapDmg = e.intent.trapDmg || 205;
            p.hp = Math.max(0, p.hp - trapDmg);
            addCombatTrauma(0.92, b);
            queueElementVFX(b, 'water', 'player', 0);
            spawnBanner(b, '💧 冰缝暗流 · 绕盾穿心！', 'danger');
            pushLog(b, logTag('cbl-danger', `💥 致命陷阱！你前压瞬间，诺艾儿暗渡在冰面裂缝下的水线绕过正面护盾从脚底直接刺穿，造成 ${trapDmg} 点本体重创！`, true));
            e.intent.ambushTrap = false;
            if (p.hp <= 0) return;
          }
        }
        if (p.hp <= 0) return;

        // 贝阿特丽丝 / 东翼封锁官：烈焰防反下盲丢普通冰晶触发融冰爆炎反劈
        let hitCounterPenalty = false;
        if ((e.aiType === 'beatrice' || e.aiType === 'eastwing_boss') && stance === 'GUARD_COUNTER' && e.intent && e.intent.meltIceCounter && sk.elem === 'ice' && sk.path !== 'INSIGHT') {
          hitCounterPenalty = true;
          const meltDmg = e.aiType === 'eastwing_boss' ? 40 : 34;
          const blk = Math.min(Math.max(0, p.shield), meltDmg);
          p.shield = Math.max(0, p.shield - blk);
          p.hp = Math.max(0, p.hp - (meltDmg - blk));
          p.status.burn = (p.status.burn || 0) + 1;
          e.fireAura = Math.min(3, (e.fireAura || 0) + 1);
          triggerShake(b, false);
          if (!b.headless && !playedBladeClash) { safeSfx('blade_clash'); playedBladeClash = true; }
          pushLog(b, logTag('cbl-danger', `🔥 ${e.name} 震碎正面冰晶，烈焰气浪反劈造成 ${meltDmg} 伤害并重燃1层斗气！（宜在烈焰守势时改用覆潮水弹浇灭）`));
          if (p.hp <= 0) return;
        }

        // 风神·听劲风壁 / 风眼静滞反制阵：未以冰宫看破或蓄势剑步破静而盲攻，反遭借岚反切
        if (e.aiType === 'wind_god_boss' && e.intent && (e.intent.windGuardCounter || e.intent.eyeStillnessStance) && !isEyeStillnessBreak && sk.path !== 'INSIGHT' && !(sk.path === 'REMOTE' && !usedWand)) {
          hitCounterPenalty = true;
          const stillRetal = e.intent.eyeStillnessStance ? 56 : 46;
          const halfBlk = Math.min(Math.floor(Math.max(0, p.shield) * 0.5), stillRetal);
          p.shield = Math.max(0, p.shield - halfBlk);
          p.hp = Math.max(0, p.hp - (stillRetal - halfBlk));
          e.shield = Math.max(0, e.shield || 0) + 32;
          triggerShake(b, false);
          if (!b.headless && !playedBladeClash) { safeSfx('blade_clash'); playedBladeClash = true; }
          pushLog(b, logTag('cbl-emerald', `🌪️ 风神借风壁圆心顺势反切，穿盾造成 ${stillRetal - halfBlk} 伤害并补强 32 点风壁！（宜先守势避锋，或以冰宫看破、蓄势剑步破阵）`));
          if (p.hp <= 0) return;
        }

        // 罗文非窄道窗口盲丢凝华冰晶：遭晦轮银环折射反噬
        if (e.aiType === 'rowan' && e.intent && e.intent.refractIceCrystal && sk.id === 'hand_ice_crystal') {
          hitCounterPenalty = true;
          const refDmg = 24;
          const blk = Math.min(Math.max(0, p.shield), refDmg);
          p.shield = Math.max(0, p.shield - blk);
          p.hp = Math.max(0, p.hp - (refDmg - blk));
          pushLog(b, logTag('cbl-violet', `🌑 罗文轻转晦轮杖偏折了正面冰晶余波，黑芒反噬你 ${refDmg} 伤害！（宜留魔力等他钻入石碑窄道时配合薄冰出击）`));
          if (p.hp <= 0) return;
        }

        // 敌方预判反制盲目隔空瞬凝（艾诺 / 诺艾儿 / 赫兰重甲 / 东翼 / 风神 GUARD_COUNTER + counterRemoteHit）
        if (sk.path === 'REMOTE' && stance === 'GUARD_COUNTER' && e.intent && e.intent.counterRemoteHit && !usedWand) {
          hitCounterPenalty = true;
          const counterDmg = 42;
          const blk = Math.min(Math.max(0, p.shield), counterDmg);
          p.shield = Math.max(0, p.shield - blk);
          p.hp = Math.max(0, p.hp - (counterDmg - blk));
          triggerShake(b, false);
          if (!b.headless && !playedBladeClash) { safeSfx('blade_clash'); playedBladeClash = true; }
          pushLog(b, logTag('cbl-danger', `⚡ ${e.name} 早料到你会隔空偷袭，防反护幕掐灭冰锥并反震造成 ${counterDmg} 伤害！`));
          if (b.crateHp != null && (e.aiType === 'hulan_brute' || e.aiType === 'hulan_lord')) {
            b.crateHp = Math.max(0, b.crateHp - 22);
            pushLog(b, logTag('cbl-danger', `📦 防反余波重创补给线，医疗药箱耐久 -22（剩余 ${b.crateHp}/${b.crateMax}）！`));
            if (b.crateHp <= 0) {
              finishBattle(b, false, 'crate_destroyed');
              return;
            }
          }
          if (b.stageCfg.hitRule && counterDmg > blk) {
            b.enemyHits += 1;
            pushLog(b, logTag('cbl-danger', `⚠️ 盲目复读遭艾诺反刺命中！比分：${b.playerHits} : ${b.enemyHits}！`, true));
            if (b.enemyHits >= (b.stageCfg.targetHits || 3)) {
              finishBattle(b, false, 'enemy_three_hits');
              return;
            }
          }
          if (p.hp <= 0) return;
        }

        if (sk.stripEvadeCharges) e.evadeCharges = 0;
        if (sk.sealWindEvade) {
          e.evadeCharges = 0;
          e.status.evadeSealed = sk.sealWindEvade;
        }

        // 真实确定性闪避层数判定（evadeCharges > 0，与 UI 徽章 100% 一致！）
        const bypassEvade = !!(sk.aoe || sk.sureHit || usedWand || stance === 'STAGGERED' || isTempestRootParry || isEyeStillnessBreak);
        if (!bypassEvade && e.evadeCharges > 0) {
          e.evadeCharges -= 1;
          // 普攻 basic_attack 挥空绝不消耗爱丽丝半点 MP！唯耗蓝魔法迫使她催动风步耗 6 MP
          if (e.mp != null && sk.mp > 0) {
            e.mp = Math.max(0, e.mp - 6);
          }
          // 爱丽丝风路未被封印时，若非刚用水弹冲净扬尘，借风闪开单点攻击会顺势回削一道微风气刃
          if (e.aiType === 'alice' && !(e.status.evadeSealed > 0) && sk.mp > 0 && !washedBlindJustNow) {
            const windChip = 18;
            const blk = Math.min(Math.max(0, p.shield), windChip);
            p.shield = Math.max(0, p.shield - blk);
            p.hp = Math.max(0, p.hp - (windChip - blk));
            pushLog(b, logTag('cbl-muted', `💨 ${e.name} 借微风轻盈闪开「${sk.name}」，顺风回削一道气刃造成 ${windChip} 伤害！（宜用冰晶宫殿封死风轨或用范围冰棘压走位）`));
            return;
          }
          pushLog(b, logTag('cbl-muted', `💨 ${e.name} 消耗1层闪避轻盈避开了「${sk.name}」（剩余闪避层×${e.evadeCharges}）！`));
          return;
        }

        // 临时恢复 wandActive 标志供伤害精算读取
        const prevWand = p.wandActive;
        if (usedWand) p.wandActive = true;
        const est = estimateSkillDamage(b, sk, e, { mpCost, powerMp, ampProfile });
        p.wandActive = prevWand;

        // 消耗单次破绽印记 flawToken（打一发立刻清除，绝不永久残留！）
        if (e.flawToken > 0) e.flawToken = 0;

        if (sk.shatterFireAura && e.fireAura) {
          e.fireAura = 0;
          e.fireStacks = 0;
          pushLog(b, logTag('cbl-ice', `❄️ 「${sk.name}」直贯火眼，${e.name} 周身的烈焰斗气轰然溃散！`));
        }
        if (sk.douseFire) {
          if (e.fireStacks) e.fireStacks = Math.max(0, e.fireStacks - 1);
          if (e.fireAura > 0) {
            e.fireAura = Math.max(0, e.fireAura - 1);
            pushLog(b, logTag('cbl-ice', `💧 水幕浇弱了 ${e.name} 1 层烈焰斗气（剩余斗气×${e.fireAura}）！`));
          }
        }
        if (e.aiType === 'beatrice' && stance === 'DUAL_CAST' && sk.elem === 'ice' && sk.path !== 'INSIGHT') {
          if (e.intent) e.intent.gainFire = 0;
          e.fireStacks = Math.max(0, (e.fireStacks || 0) - 1);
          pushLog(b, logTag('cbl-ice', `❄️ 凝华冰晶精准冻住暴走火蛇核心，压制了她的升温势头！`));
        }
        if (sk.severSeep) {
          e.seepSevered = true;
          e.seepStacks = 0;
          if (e.intent && e.intent.ambushTrap) {
            e.intent.ambushTrap = false;
            e.status.stagger = 1;
            decideEnemyIntent(e, b);
          }
          pushLog(b, logTag('cbl-ice', `❄️ 潜伏在冰缝下的暗渡水线被彻底冻死斩断！`));
        }
        if (sk.shredArmor) {
          e.def = Math.floor(e.def * 0.25);
          e.mdef = Math.floor(e.mdef * 0.25);
          e.solidArmor = 0;
          e.coreShattered = true;
        }
        if (sk.drainEnemyMp && e.mp != null) {
          e.mp = Math.max(0, e.mp - sk.drainEnemyMp);
          pushLog(b, logTag('cbl-ice', `💨 十字冰栏封死风路，迫使 ${e.name} 剧烈损耗 ${sk.drainEnemyMp} MP（剩余 ${e.mp}/${e.mmp}）！`));
        }
        if (sk.drainWindMp && e.mp != null) {
          if (e.status && e.status.evadeSealed > 0) {
            e.mp = Math.max(0, e.mp - 18);
            pushLog(b, logTag('cbl-ice', `❄️ 冰栏封路下满地冰棘锁死走位，逼耗 ${e.name} 18 MP（剩余 ${e.mp}/${e.mmp}）！`));
          } else if (!p.status.blind && (b.aiMemory.sameAtkSkillStreak || 0) < 2) {
            e.mp = Math.max(0, e.mp - 13);
            pushLog(b, logTag('cbl-ice', `❄️ 你看清风向交错铺开地棘，迫使 ${e.name} 催动微风腾跃耗损 13 MP（剩余 ${e.mp}/${e.mmp}）！`));
          }
        }

        // 艾诺正面无气泡镜冰阻挡
        if (est.mirrorBlocked) {
          if (!b.headless && !playedBladeClash) { safeSfx('blade_clash'); playedBladeClash = true; }
          pushLog(b, logTag('cbl-muted', `🧊 艾诺随手凝出一面无气泡薄冰挡下「${sk.name}」：「路径太慢，这不算有效命中。」`));
          return;
        }

        // 截断破招判定
        let didInterrupt = false;
        if (est.willInterrupt && stance !== 'STAGGERED') {
          didInterrupt = true;
          e.status.stagger = 1;
          e.wasInterruptedLastTurn = true;
          b.metrics.interrupts += 1;
          if (b.stageCfg.ainoSupport) {
            // 领主庞大身躯在双手聚寒被破招时直接暴露于崖顶视野（+2 共鸣），小怪破招 +1 共鸣
            b.ainoResonance += (e.aiType === 'hulan_lord' ? 2 : 1);
          }
          decideEnemyIntent(e, b);
          if (!est.rootStepParryTrigger) {
            spawnBanner(b, '💥 截断破招 INTERRUPT!', 'interrupt');
            triggerBreakJuice(b, 'break_chime');
            playedBreakOrParry = true;
          }
          if (getSynergyTier(p, 'academy_stars') >= 2) {
            e.status.vuln = (e.status.vuln || 0) + 2;
            const synMp = Math.max(10, Math.round(p.mmp * 0.12));
            const beforeSynMp = p.mp;
            p.mp = Math.min(p.mmp, p.mp + synMp);
            const gainedSynMp = Math.max(0, p.mp - beforeSynMp);
            b.metrics.manaRecycled += gainedSynMp;
            if (gainedSynMp > 0) spawnCombatFloat(b, 'player', `+${gainedSynMp} MP`, 'mp');
            pushLog(b, logTag('cbl-star', `✦【共鸣·学院星辉(2件)】截断破招附加 2 层易伤并回流 +${synMp} MP！`));
          }
        }

        // 罗文乱葬岗：窄道铺冰配合雷纳德按肩封锁（冷却后再次铺设薄冰抓窄道可重复叠加 +38%，无冰宫亦可苦战活捉）！
        if (b.stageCfg.sealRule) {
          if (stance === 'DUAL_CAST' && b.frostFloorTurns > 0 && sk.elem === 'ice') {
            b.frostFloorTurns = 0;
            e.status.stagger = 1;
            didInterrupt = true;
            b.metrics.interrupts += 1;
            b.sealProgress = Math.min(100, b.sealProgress + 38);
            decideEnemyIntent(e, b);
            spawnBanner(b, '🪨❄️ 窄道滑冰 · 雷纳德按肩锁脉！', 'interrupt');
            triggerBreakJuice(b, 'break_chime');
            playedBreakOrParry = true;
            pushLog(b, logTag('cbl-star', `🪨❄️ 罗文穿过石碑窄道恰好踏碎你铺开的薄冰，左腿慢了半步！雷纳德按肩灌入土系魔力——合围封锁度 +38%（${b.sealProgress}%）！`));
          } else if (sk.sealBoost) {
            if (stance === 'CLOSE_LUNGE') {
              b.sealProgress = Math.min(100, b.sealProgress + sk.sealBoost);
              pushLog(b, logTag('cbl-star', `❄️ 双面冰镜凌空合拢死死夹住脱手飞来的晦轮杖！雷纳德五指收紧收拢石棱——合围封锁度 +${sk.sealBoost}%（${b.sealProgress}%）！`));
            } else {
              b.sealProgress = Math.min(100, b.sealProgress + 26);
              pushLog(b, logTag('cbl-star', `❄️ 双面冰镜逼退罗文半步，合围封锁度 +26%（${b.sealProgress}%）！`));
            }
          }
        }

        // 风神二阶段专属「生根步·斩风瞬反」窗口 + 霁馆剑步迎击扑杀闪反
        if (est.rootStepParryTrigger) {
          b.metrics.ripostes += 1;
          p.status.lungeMitigate = 1;
          e.evadeCharges = 0;
          e.evadeBrokenThisTurn = true;
          e.status.vuln = (e.status.vuln || 0) + 1;
          activatedChain = true;
          b.ap = Math.min(b.apMax, b.ap + 1);
          spawnBanner(b, '✦ 生根步·斩风瞬反！', 'riposte');
          triggerBreakJuice(b, 'parry');
          playedBreakOrParry = true;
          pushLog(b, logTag('cbl-emerald', `✦ 生根步·斩风瞬反！你踏稳砂面迎锋切入真空连刃，震散风暴眼威势并斩获 +1 AP 与连携追击！`, true));
        } else if (est.willRiposte) {
          b.metrics.ripostes += 1;
          p.status.lungeMitigate = 1;
          spawnBanner(b, '⚡ 覆水迎锋 · 卸力截斩！', 'riposte');
          triggerBreakJuice(b, 'parry');
          playedBreakOrParry = true;
        }

        const critRate = getPlayerCritChance(p, sk);
        const didCrit = !!(b._forceCrit || (critRate > 0 && Math.random() < critRate));
        if (didCrit) anyDidCrit = true;
        const critMult = getPlayerCritMult(p);
        const finalDmg = didCrit ? Math.round(est.dmg * critMult) : est.dmg;
        if (sk.elem === 'ice' && p.status.frostPierce > 0 && hasRelic(p, 'aino_frost_shard')) {
          usedFrostPierce = true;
        }
        if (est.northFrostShatter) {
          usedNorthFrostShatter = true;
          e.status.chill = (e.status.chill || 0) + 2;
        }

        const shieldBeforeHit = e.shield || 0;
        const dmgRes = dealDamageToEnemy(b, e, finalDmg, {
          wandRefract: est.wandRefract,
          trueMagic: !!est.trueMagic,
          shatterShield: !!sk.shatterShield,
          pierceHalfShield: !!sk.pierceHalfShield,
          severSeep: !!sk.severSeep,
        });
        const shieldBroken = shieldBeforeHit > 0 && (e.shield || 0) <= 0;
        if (shieldBroken) anyShieldShattered = true;
        anyHitDealt = true;

        if (didCrit && sk.path === 'SWORD' && hasRelic(p, 'ebony_sword') && b._ebonyApRefundTurn !== b.turn) {
          b._ebonyApRefundTurn = b.turn;
          b.ap = Math.min(b.apMax, b.ap + 1);
          pushLog(b, logTag('cbl-violet', `🗡️【乌木紫穗剑】剑步暴击破风，返还 1 AP（当前 ${b.ap}/${b.apMax}）！`));
        }
        if (sk.path === 'SWORD' && (didCrit || didInterrupt) && getSynergyTier(p, 'jikan_blade') >= 2 && b._synJikanApTurn !== b.turn) {
          b._synJikanApTurn = b.turn;
          b.ap = Math.min(b.apMax, b.ap + 1);
          pushLog(b, logTag('cbl-violet', `✦【共鸣·霁馆剑心(2件)】剑势贯通返还 +1 AP（当前 ${b.ap}/${b.apMax}）！`));
        }

        if ((didInterrupt && sk.path === 'REMOTE') || (est.willRiposte && hadPoise)) {
          activatedChain = true;
        }
        if (didInterrupt || est.willRiposte) {
          if (hasRelic(p, 'aino_frost_shard')) activatedFrostPierce = true;
        }

        const ePos = b.enemies.indexOf(e);
        if (ePos >= 0) hitTargetIndices.push(ePos);
        if (didInterrupt) anyDidBreak = true;
        if (est.willRiposte || est.rootStepParryTrigger) anyDidRiposte = true;
        if (dmgRes.actualHpLoss > 0 || dmgRes.shieldAbsorbed > 0 || finalDmg > 0) {
          let floatLabel;
          if (didCrit && didInterrupt) floatLabel = `✦ -${finalDmg} 破招暴击!`;
          else if (didCrit && est.willRiposte) floatLabel = `✦ -${finalDmg} 迎锋暴击!`;
          else if (didCrit) floatLabel = `✦ -${finalDmg} 暴击!`;
          else if (est.rootStepParryTrigger) floatLabel = `✦ -${finalDmg} 斩风瞬反!`;
          else if (didInterrupt) floatLabel = `-${finalDmg} 破招!`;
          else if (est.willRiposte) floatLabel = `-${finalDmg} 迎锋!`;
          else floatLabel = `-${finalDmg}`;
          const floatKind = didCrit
            ? 'gold-crit'
            : (didInterrupt || est.mult > 1 || est.trueMagic) ? 'crit' : 'dmg';
          spawnCombatFloat(b, 'enemy', floatLabel, floatKind, ePos);
          queueHitPulse(b, 'enemy', ePos);

          const isBreakOrRiposte = !!(didInterrupt || est.willRiposte || est.rootStepParryTrigger || shieldBroken || sk.path === 'INSIGHT');
          const isCritOrAoe = !!(didCrit || sk.aoe);
          peakCastTrauma = Math.max(peakCastTrauma, isCritOrAoe ? 0.92 : isBreakOrRiposte ? 0.64 : 0.32);

          const primaryVfx = sk.path === 'INSIGHT'
            ? 'insight'
            : (sk.path === 'SWORD' || sk.elem === 'phys')
              ? 'sword'
              : sk.elem === 'water'
                ? 'water'
                : 'ice';
          queueElementVFX(b, primaryVfx, 'enemy', ePos, { skipHitStop: castHitStopQueued });
          if (primaryVfx === 'insight') castHitStopQueued = true;
          if (primaryVfx !== 'insight' && (didCrit || isBreakOrRiposte)) {
            queueElementVFX(b, didCrit ? 'crit' : 'break', 'enemy', ePos, { skipHitStop: castHitStopQueued });
            castHitStopQueued = true;
          }
        }

        b.aiMemory.currentTurnDmgDealt += dmgRes.actualHpLoss;

        if (sk.applyVuln) e.status.vuln = (e.status.vuln || 0) + sk.applyVuln;
        if (sk.chill) e.status.chill = (e.status.chill || 0) + sk.chill;
        if (dmgRes.actualHpLoss > 0 && p.passives) {
          if (sk.path === 'SWORD' && p.passives.includes('frost_edge')) {
            e.status.chill = Math.max(e.status.chill || 0, 1);
          } else if (sk.path === 'REMOTE' && p.passives.includes('instant_ice')) {
            e.status.chill = Math.max(e.status.chill || 0, 2);
          }
        }

        const tagStr = [
          est.rootStepParryTrigger ? logTag('cbl-emerald', '【斩风瞬反！】', true) : '',
          didInterrupt ? logTag('cbl-star', '【截断破招！】', true) : '',
          est.willRiposte && !est.rootStepParryTrigger ? logTag('cbl-emerald', '【迎锋截斩！】', true) : '',
          didCrit ? logTag('cbl-star', `【暴击${critMult.toFixed(2)}×！】`, true) : '',
          est.northFrostShatter ? logTag('cbl-ice', '【北境碎霜+15%】', true) : '',
          est.chainApplied ? logTag('cbl-star', '【连携1.35×】', true) : '',
          est.trueMagic ? logTag('cbl-violet', dmgRes.magicShieldBypassed ? '【晦轮真伤·穿盾】' : '【晦轮真伤】', true) : '',
          est.mult > 1 ? logTag('cbl-cobalt', '【属性克制】', true) : '',
          mcMult > 1.05 ? logTag('cbl-star', `[增幅${mcMult.toFixed(2)}x]`) : '',
        ].filter(Boolean).join(' ');

        pushLog(b, `⚔️ 「${sk.name}」命中 ${e.name}，造成 <b>${finalDmg}</b> 伤害${dmgRes.shieldAbsorbed ? `（破盾${dmgRes.shieldAbsorbed}）` : ''} ${tagStr}`);

        // 艾诺三击制计分铁律：唯隔空截断破招或冰晶宫殿看破手背可记有效命中
        if (b.stageCfg.hitRule && dmgRes.actualHpLoss > 0) {
          if (didInterrupt || sk.guaranteedCleanHit) {
            b.playerHits += 1;
            pushLog(b, logTag('cbl-star', `🎯 有效命中！比分：希尔维亚 ${b.playerHits} : ${b.enemyHits} 艾诺！`, true));
          }
        }

        // ⚡ 魔战循环公式①：等量有效生命伤害回流魔力（霁馆剑心2件令剑技迎锋/破招回蓝翻倍！）
        if (p.hasManaCycle && sk.elem !== 'phys' && dmgRes.actualHpLoss > 0) {
          const jikanDouble = (sk.path === 'SWORD' && (est.willRiposte || didInterrupt) && getSynergyTier(p, 'jikan_blade') >= 2);
          const baseRet = Math.round(dmgRes.actualHpLoss * COMBAT_BALANCE_V22.MANA_CYCLE.returnRatio);
          totalManaReturned += jikanDouble ? dmgRes.actualHpLoss * 2 : baseRet;
          if (jikanDouble) {
            pushLog(b, logTag('cbl-violet', `✦【共鸣·霁馆剑心(2件)】剑步迎锋引动魔战双倍回蓝！`));
          }
        }

        // V2.2 弱点锁削减 / 弱点击破推条 / ONE MORE（唯破招/闪反/看破、非复读属性克制或非复读魔力增幅过载方可破锁，盲目复读削锁为 0）
        const repeatPunished = !!(e.intent && e.intent.punishRepeatAtk && e.intent.punishRepeatAtk === sk.id);
        const lockBlocked = hitCounterPenalty || repeatPunished || (sk.path === 'REMOTE' && stance === 'GUARD_COUNTER' && !usedWand);
        const isFreshPattern = (b.aiMemory.sameAtkSkillStreak || 0) < 2;
        const isCounterOrInsight = !!(didInterrupt || est.rootStepParryTrigger || sk.path === 'INSIGHT' || (est.willRiposte && (hadPoise || isFreshPattern)));
        let lockDmg = 0;
        if (!lockBlocked) {
          if (isCounterOrInsight) {
            lockDmg = getSkillBaseLockDamage(sk) + 1 + (est.extraLocks || 0);
          } else if (isFreshPattern && est.mult > 1.0) {
            lockDmg = getSkillBaseLockDamage(sk) + (est.extraLocks || 0);
          } else if (isFreshPattern && est.mult >= 1.0 && (est.extraLocks || 0) > 0) {
            lockDmg = est.extraLocks;
          }
          if (sk.aoe && !isCounterOrInsight && lockDmg > 1) lockDmg = 1;
        }
        if (lockDmg > 0 && e.hp > 0 && !e.broken && (e.maxLocks || 0) > 0 && !dmgRes.phase2Triggered && !dmgRes.enteredUnderSeep) {
          e.locks = Math.max(0, (e.locks != null ? e.locks : e.maxLocks) - lockDmg);
          if (e.locks <= 0) {
            e.broken = true;
            anyDidBreak = true;
            b.metrics.weaknessBreaks = (b.metrics.weaknessBreaks || 0) + 1;
            const pushKey = e.boss ? 'boss' : (e.mhp >= 220 ? 'elite' : 'mob');
            const pushPct = COMBAT_BALANCE_V22.HSR_AV.pushPct[pushKey] || 0.45;
            e.av = Math.round((e.av || e.baseAv || 100) + (e.baseAv || 100) * pushPct);

            if (!e.nonLethalSpar && e.hp > 0) {
              const burstDmg = Math.max(8, Math.round(p.matk * COMBAT_BALANCE_V22.HSR_AV.breakBurstMatkRatio));
              const burstRes = dealDamageToEnemy(b, e, burstDmg, {
                trueMagic: usedWand,
                nonLethalCap: !!b.stageCfg.sealRule,
              });
              if (burstRes.actualHpLoss > 0) {
                spawnCombatFloat(b, 'enemy', `✦ 击破 -${burstRes.actualHpLoss}`, 'gold-crit', ePos);
              }
            }

            if (!b.oneMoreUsedThisTurn && COMBAT_BALANCE_V22.HSR_AV.maxOneMorePerNaturalTurn > 0) {
              b.oneMoreUsedThisTurn = true;
              b.oneMoreActive = true;
              b.metrics.oneMoreCount = (b.metrics.oneMoreCount || 0) + 1;
              b.ap = Math.min(b.apMax, b.ap + 1);
              const omMp = Math.round(p.mmp * COMBAT_BALANCE_V22.HSR_AV.oneMoreMpRefundPct);
              const mpBeforeOm = p.mp;
              p.mp = Math.min(p.mmp, p.mp + omMp);
              const omGain = Math.max(0, p.mp - mpBeforeOm);
              b.metrics.manaRecycled += omGain;
              p.av = 0;
              if (omGain > 0) spawnCombatFloat(b, 'player', `+${omGain} MP`, 'mp');
              spawnBanner(b, '✦ ONE MORE · 乘胜追击!', 'riposte');
              pushLog(b, logTag('cbl-star', `✦【弱点击破 · ONE MORE】击碎 ${e.name} 全部弱点锁（行动推条 +${Math.round(pushPct * 100)}%），赢得额外追击 +1 AP、+${omGain} MP！`, true));
              if (!b.headless) safeSfx('one_more');
              playedBreakOrParry = true;
            } else {
              b.metrics.overflowBreaksIntercepted = (b.metrics.overflowBreaksIntercepted || 0) + 1;
              const ov = COMBAT_BALANCE_V22.HSR_AV.overflowBreakBonus;
              const ovMp = Math.round(p.mmp * ov.mpPct);
              const mpBeforeOv = p.mp;
              p.mp = Math.min(p.mmp, p.mp + ovMp);
              const ovGain = Math.max(0, p.mp - mpBeforeOv);
              b.metrics.manaRecycled += ovGain;
              p.av = Math.max(0, Math.round((p.av || 0) - (p.baseAv || 100) * ov.selfAdvancePct));
              if (ovGain > 0) spawnCombatFloat(b, 'player', `+${ovGain} MP`, 'mp');
              pushLog(b, logTag('cbl-ice', `✦【溢出击破补偿】击破 ${e.name} 弱点锁（行动推条 +${Math.round(pushPct * 100)}%），转化回蓝 +${ovGain} MP、拉条 -${Math.round(ov.selfAdvancePct * 100)}% AV！`));
            }
          }
        }
      });

      if (peakCastTrauma > 0 && !getPixelVfxApi()) {
        addCombatTrauma(peakCastTrauma, b);
      }
      const primaryPos = Math.max(0, b.enemies.indexOf(primary));
      queuePixelAction(b, {
        type: 'skill',
        skillId,
        targetIdx: primaryPos,
        targetIndices: hitTargetIndices.length ? hitTargetIndices : targets.map(t => Math.max(0, b.enemies.indexOf(t))),
        didCrit: anyDidCrit,
        didBreak: anyDidBreak,
        didRiposte: anyDidRiposte,
        shieldBroken: anyShieldShattered,
        usedWand,
        missed: !anyHitDealt,
      });

      if (usedFrostPierce) delete p.status.frostPierce;
      if (usedNorthFrostShatter) {
        b._synNorthRemoteTurn = b.turn;
      }
      if (consumedChain && anyHitDealt) {
        delete p.status.breakChain;
        const chainBonus = Math.round(p.mmp * 0.15) + (hasRelic(p, 'shell_pin') ? Math.round(p.mmp * 0.08) : 0);
        const beforeChainMp = p.mp;
        p.mp = Math.min(p.mmp, p.mp + chainBonus);
        b.metrics.manaRecycled += Math.max(0, p.mp - beforeChainMp);
        pushLog(b, logTag('cbl-star', `🔗【连携追击】乘势追击引动魔脉回流 +${p.mp - beforeChainMp} MP${hasRelic(p, 'shell_pin') ? '（含月虹螺+8%）' : ''}！`));
      }
      if (activatedFrostPierce) {
        p.status.frostPierce = 1;
        pushLog(b, logTag('cbl-ice', `❄️【钢冰试炼笺】破招余锋凝实，下一次冰系攻击无视 25% 冰抗！`));
      }
      if (activatedChain) {
        p.status.breakChain = 1;
        pushLog(b, logTag('cbl-star', `✨【破招连携窗口】本回合下一张非基础攻击牌享 1.35× 伤害并额外返还 15% 魔力！`, true));
      }

      if (hadPoise && sk.path === 'SWORD') delete p.status.poise;

      // 伊诺共鸣锁核或连续破招触发崖顶艾诺极寒冰枪协同轰击！
      if (sk.triggerAinoSpear && b.stageCfg.ainoSupport) {
        b.ainoResonance += 2;
      }
      let ainoGuard = 0;
      while (b.stageCfg.ainoSupport && b.ainoResonance >= 2 && ainoGuard++ < 12) {
        const bossTarget = getPrimaryAliveEnemy(b);
        b.ainoResonance -= 2;
        if (bossTarget) {
          b.ainoSpearsFiredInWave = (b.ainoSpearsFiredInWave || 0) + 1;
          const spearDmg = 100;
          dealDamageToEnemy(b, bossTarget, spearDmg, { pierceHalfShield: true });
          const spearPos = b.enemies.indexOf(bossTarget);
          if (spearPos >= 0) {
            queueElementVFX(b, 'ice', 'enemy', spearPos);
            queuePixelAction(b, { type: 'aino_spear', enemyIdx: spearPos });
          }
          if (!getPixelVfxApi()) addCombatTrauma(0.64, b);
          spawnBanner(b, '❄️ 艾诺支援 · 极寒冰枪贯落！', 'interrupt');
          pushLog(b, logTag('cbl-cobalt', `❄️【冰原共鸣】峡谷崖顶艾诺射落第 ${b.ainoSpearsFiredInWave} 道无气泡极寒冰枪，重创 ${bossTarget.name} ${spearDmg} 伤害！`, true));
          // 无冰宫基本功路径：本波累计引落第 2 发艾诺冰枪命中领主时，同样震碎腹下晶核！
          if (bossTarget.aiType === 'hulan_lord' && !bossTarget.coreShattered && b.ainoSpearsFiredInWave >= 2) {
            bossTarget.coreShattered = true;
            bossTarget.shield = 0;
            bossTarget.solidArmor = 0;
            bossTarget.def = Math.floor(bossTarget.def * 0.28);
            bossTarget.mdef = Math.floor(bossTarget.mdef * 0.28);
            bossTarget.status.vuln = (bossTarget.status.vuln || 0) + 2;
            anyShieldShattered = true;
            pushLog(b, logTag('cbl-ice', `❄️💥 第二道极寒冰枪顺着破招裂隙贯入领主腹下，幽蓝晶核轰然震碎（重甲瓦解，地脉寒震停止）！`, true));
          }
        }
      }
    }

    if (p.hp > 0 && p.hp < p.mhp * 0.35 && !b._blueVialTriggered && hasRelic(p, 'blue_vial')) {
      b._blueVialTriggered = true;
      const vialHeal = Math.max(15, Math.round(p.mhp * 0.25));
      p.hp = Math.min(p.mhp, p.hp + vialHeal);
      p.status.afterimage = (p.status.afterimage || 0) + 1;
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
      pushLog(b, logTag('cbl-ice', `⚡【魔战循环】等量伤害回流 +${totalManaReturned} MP（当前 ${p.mp}/${p.mmp}）！`));
    }
    if (p.overcastMode === 2 && sk.power > 0 && sk.atkKind === 'matk') {
      p.overcastMode = 0;
      p._lastOvercastMode = 0;
      p.ampPct = 0;
    }

    if (!b.headless && !playedBreakOrParry) {
      if (anyDidCrit) {
        safeSfx('combat_crit');
      } else if (anyShieldShattered) {
        safeSfx('ice_shatter');
      } else if (!playedBladeClash) {
        if ((!sk.power || sk.power <= 0) && (sk.shieldBase || sk.dodgeLunge || sk.afterimage)) {
          safeSfx('shield_block');
        } else if (usedWand) {
          safeSfx('eclipse_cast');
        } else if (sk.path === 'SWORD' || sk.elem === 'phys') {
          safeSfx('sword_slash');
        } else if (sk.elem === 'water') {
          safeSfx('water_surge');
        } else {
          safeSfx('ice_cast');
        }
      }
    }

    if (checkImmediateVictoryOrNextWave(b)) {
      if (!b.headless) renderCombatUI();
      return { ok: true, battleEndedOrAdvanced: true };
    }

    if (!b.headless) renderCombatUI();
    return { ok: true };
  }

  function applyTurnBoundaryCleanup(b, bankedAp) {
    const p = b.player;
    delete p.status.rooted;
    delete p.status.iceThorns;
    delete p.status.lungeParry;
    delete p.status.lungeMitigate;
    delete p.status.crateGuard;
    delete p.status.zeroMpThisTurn;
    delete p.status.nobleReflect;
    if (p.status.burn <= 0) delete p.status.burn;
    if (p.status.blind <= 0) delete p.status.blind;
    if (p.status.afterimage < 0) p.status.afterimage = 0;

    if (b.frostFloorTurns > 0) b.frostFloorTurns = Math.max(0, b.frostFloorTurns - 1);

    const retainRate = p.passives.includes('root_ice')
      ? COMBAT_BALANCE_V22.SHIELD_RETAIN_RATE.rootIce
      : COMBAT_BALANCE_V22.SHIELD_RETAIN_RATE.default;
    p.shield = Math.max(0, Math.floor(Math.max(0, p.shield) * retainRate));
    if (p.shield <= 0) p.shieldKind = 'solid';

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

    // 1. 艾诺三击制唯一胜机铁律：绝不允许靠 HP 归零判胜，唯抢满 3 次有效命中可胜！
    if (b.stageCfg.hitRule) {
      if (b.playerHits >= (b.stageCfg.targetHits || 3)) {
        pushLog(b, logTag('cbl-star', `❄️ 冰珠弹在艾诺手背上！艾诺微怔：「……这算命中。三击已满，你赢了。」`, true));
        finishBattle(b, true, 'three_hits');
        return true;
      }
      ensureValidTarget(b);
      return false;
    }

    // 2. 罗文乱葬岗活捉铁律：凑满 100% 合围封锁判胜；若未满 100% 却把罗文打空 HP，化雾逃脱判败！
    if (b.stageCfg.sealRule) {
      if (b.sealProgress >= 100) {
        pushLog(b, logTag('cbl-star', `🪨❄️ 四道石棱轰然闭合将罗文压入地面，你一发冰锥钉穿他袖口定在离地半寸——成功活捉留口供！`, true));
        finishBattle(b, true, 'sealed_rowan');
        return true;
      }
      const rowan = b.enemies[0];
      if (rowan && rowan.hp <= 0) {
        pushLog(b, logTag('cbl-danger', `❌ 合围尚未成形（${b.sealProgress}%）！重伤的罗文借晦轮杖偏折月影化作血雾遁逃，线索断绝！`, true));
        finishBattle(b, false, 'rowan_escaped');
        return true;
      }
      ensureValidTarget(b);
      return false;
    }

    // 3. 常规与多波次全灭检查
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
          pushLog(b, logTag('cbl-star', `⚠️ 察觉林外极光小队靠近，已迅速收起晦轮杖！`));
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

  function endTurn(b) {
    _logBatchDepth += 1;
    try {
      return _endTurnCore(b);
    } finally {
      _logBatchDepth = Math.max(0, _logBatchDepth - 1);
      if (_logBatchDepth === 0) flushCombatLogDOM(b || activeBattle);
    }
  }

  function tickEnemyEndTurn(b, e, opts) {
    opts = opts || {};
    if (!e || e.hp <= 0 || b.over) return false;
    if (e.aiType === 'alice') {
      if (e.mp != null) e.mp = Math.min(e.mmp, e.mp + 7);
      if (e.status.evadeSealed > 0) {
        e.status.evadeSealed -= 1;
        if (e.status.evadeSealed <= 0) delete e.status.evadeSealed;
        e.evadeCharges = 0;
      } else if (!opts.parried) {
        e.evadeCharges = e.maxEvadeCharges || 2;
      }
    }
    if (e.aiType === 'wind_god_boss' && e.status.evadeSealed > 0) {
      e.status.evadeSealed -= 1;
      if (e.status.evadeSealed <= 0) delete e.status.evadeSealed;
    }
    if (e.aiType === 'noelle' && !e.seepSevered && !opts.staggered) {
      e.seepStacks = (e.seepStacks || 0) + 1;
    }
    // 霜渊裂地兽领主腹下晶核未破时，每回合释放地脉寒震损耗药箱并再生重甲
    if (!opts.staggered && e.aiType === 'hulan_lord' && !e.coreShattered && e.hp > 0 && b.crateHp != null) {
      e.shield = Math.max(0, e.shield || 0) + 55;
      b.crateHp = Math.max(0, b.crateHp - 16);
      pushLog(b, logTag('cbl-danger', `❄️ 领主腹下晶核未破，再生 55 点冻甲且寒震穿透冰障损耗药箱 16 耐久（剩余 ${b.crateHp}）！`));
      if (b.crateHp <= 0) {
        finishBattle(b, false, 'crate_destroyed');
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
    return false;
  }

  function _endTurnCore(b) {
    b = b || activeBattle;
    if (!b || b.over) return false;
    armedSkillId = null;
    const p = b.player;
    delete p.status.breakChain;
    const hadNobleReflect = !!(p.status && p.status.nobleReflect > 0);

    // 更新 AI 龟缩监测黑板
    b.aiMemory.lastTurnDmgDealt = b.aiMemory.currentTurnDmgDealt;
    if (b.aiMemory.currentTurnDmgDealt <= 5) {
      b.aiMemory.turtleStreak = (b.aiMemory.turtleStreak || 0) + 1;
    } else {
      b.aiMemory.turtleStreak = 0;
    }
    b.aiMemory.currentTurnDmgDealt = 0;

    const banked = Math.min(1, Math.max(0, b.ap));

    // 敌方依次行动
    for (const e of b.enemies) {
      if (e.hp <= 0 || b.over) continue;

      if (e.status.stagger > 0) {
        pushLog(b, logTag('cbl-ice', `💫 ${e.name} 架势崩解，错失本回合攻势！`));
        delete e.status.stagger;
        // 霜渊裂地兽若晶核未碎，即便眩晕亦有微弱余震（-8 药箱耐久）
        if (e.aiType === 'hulan_lord' && !e.coreShattered && e.hp > 0 && b.crateHp != null) {
          e.shield = Math.max(0, e.shield || 0) + 35;
          b.crateHp = Math.max(0, b.crateHp - 8);
          pushLog(b, logTag('cbl-danger', `❄️ 领主腹下晶核未破，再生 35 点冻甲且寒气余震损耗药箱 8 耐久（剩余 ${b.crateHp}）！`));
          if (b.crateHp <= 0) {
            finishBattle(b, false, 'crate_destroyed');
            return true;
          }
        }
        tickEnemyEndTurn(b, e, { staggered: true });
        continue;
      }

      const intent = e.intent;
      if (!intent) {
        tickEnemyEndTurn(b, e);
        continue;
      }

      b.metrics.enemyActions = (b.metrics.enemyActions || 0) + 1;

      // 爱丽丝魔力不足蓄力风暴原著自断！
      if (intent.selfFizzleIfLowMp && e.mp != null && e.mp < intent.mpCost) {
        b.metrics.manaFizzleWin = true;
        pushLog(b, logTag('cbl-ice', `💨 狂躁的气流骤然散去！爱丽丝晃了一下：「……没魔力了。……认输。」`, true));
        e.hp = 0;
        if (checkImmediateVictoryOrNextWave(b, { fromEndTurn: true, bankedAp: banked })) {
          if (!b.headless) renderCombatUI();
          return true;
        }
        continue;
      }

      if (intent.mpCost && e.mp != null) {
        e.mp = Math.max(0, e.mp - intent.mpCost);
      }

      if (intent.refreshCurtain && !e.seepSevered) {
        e.shield = Math.max(e.shield || 0, intent.refreshCurtain);
        e.shieldKind = 'magic';
      }
      if (intent.gainShield) e.shield = Math.max(0, e.shield || 0) + intent.gainShield;
      if (intent.gainFire) e.fireStacks = (e.fireStacks || 0) + intent.gainFire;
      if (intent.buffPack) {
        b.enemies.forEach(ally => { if (ally.hp > 0) ally.atk += intent.buffPack; });
      }

      // 赫兰医疗药箱受击结算
      if (intent.crateDmg && b.crateHp != null) {
        let cDmg = intent.crateDmg;
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
            return true;
          }
        } else {
          pushLog(b, logTag('cbl-emerald', `📦 生根冰障稳稳护住了医疗药箱！`));
        }
      }

      if (intent.dmg > 0) {
        let afterimageShearMult = 1.0;
        // 1) 风行残像闪避（风神多段御风招式可震散单层残像，仅减免部分余岚）
        if (p.status.afterimage > 0) {
          p.status.afterimage = Math.max(0, p.status.afterimage - 1);
          if (intent.pierceAfterimage) {
            afterimageShearMult = 0.72;
            pushLog(b, logTag('cbl-emerald', `🌪️ ${e.name} 御风震散你的「风行残像」，余岚仍旧破风袭身！`));
          } else {
            pushLog(b, logTag('cbl-emerald', `💨 「风行残像」碎裂，你真身避开了 ${e.name} 的「${intent.moveName}」！`));
            queuePixelAction(b, { type: 'enemy_attack', enemyIdx: b.enemies.indexOf(e), enemy: e, intent, hpLoss: 0, evaded: true });
            if (hasRelic(p, 'alice_flower_cake')) {
              const beforeMp = p.mp;
              p.mp = Math.min(p.mmp, p.mp + 10);
              if (p.mp > beforeMp) {
                pushLog(b, logTag('cbl-emerald', `🌼【风之花饼】借风轻落回蓄 ${p.mp - beforeMp} MP！`));
              }
            }
            if (tickEnemyEndTurn(b, e, { evaded: true })) return true;
            continue;
          }
        }

        // 2) 生根步·卸力侧滑 专克单挑 CLOSE_LUNGE 贴身扑杀与风神「真空连刃」（若陷入 >=3 只群狼合围则无法靠单人步法全身而退）！
        const packSurround = b.enemies.filter(x => x.hp > 0 && x.aiType === 'pack_wolf').length >= 3;
        const canParryMove = intent.stance === 'CLOSE_LUNGE';
        if (canParryMove && p.status.lungeParry > 0 && !packSurround) {
          p.status.lungeParry = 0;
          p.status.poise = 1; // 蓄势强化下一记送刀
          e.evadeCharges = 0;
          e.evadeBrokenThisTurn = true;
          b.metrics.ripostes += 1;
          const isTempestParry = intent.moveKey === 'TEMPEST_VACUUM';
          const riposteDmg = isTempestParry
            ? Math.round(p.atk * 1.85 + p.matk * 0.55)
            : Math.round(p.atk * 1.15);
          dealDamageToEnemy(b, e, riposteDmg, {});
          if (isTempestParry) {
            e.status.vuln = (e.status.vuln || 0) + 1;
            p.status.breakChain = 1;
            p.status.nextAp = (p.status.nextAp || 0) + 1;
            spawnCombatFloat(b, 'enemy', `✦ -${riposteDmg} 斩风瞬反!`, 'riposte', b.enemies.indexOf(e));
            spawnBanner(b, '✦ 生根步·斩风瞬反！', 'riposte');
            pushLog(b, logTag('cbl-emerald', `✦ 生根步·斩风瞬反！你沉腰踏稳卸开「${intent.moveName}」，顺势反切 ${riposteDmg} 伤害并赢得下回合 +1 AP 与连携追击！`, true));
          } else {
            spawnCombatFloat(b, 'enemy', `-${riposteDmg} 闪反!`, 'riposte', b.enemies.indexOf(e));
            spawnBanner(b, '⚡ 生根侧滑 · 卸力破闪！', 'riposte');
            pushLog(b, logTag('cbl-emerald', `🗡️ 你沉膝侧滑卸开「${intent.moveName}」，震散其闪避架势并顺势削出 ${riposteDmg} 伤害（下一记送刀强化）！`));
          }
          const ripIdx = b.enemies.indexOf(e);
          queueHitPulse(b, 'enemy', ripIdx);
          queueElementVFX(b, 'sword', 'enemy', ripIdx);
          queueElementVFX(b, 'break', 'enemy', ripIdx);
          queuePixelAction(b, { type: 'enemy_attack', enemyIdx: ripIdx, enemy: e, intent, hpLoss: 0, parried: true });
          if (!getPixelVfxApi()) addCombatTrauma(0.64, b);
          triggerBreakJuice(b, 'parry');
          if (getSynergyTier(p, 'jikan_blade') >= 2 && p.hasManaCycle && riposteDmg > 0) {
            const beforeMp = p.mp;
            p.mp = Math.min(p.mmp, p.mp + riposteDmg * 2);
            const gainedMp = Math.max(0, p.mp - beforeMp);
            b.metrics.manaRecycled += gainedMp;
            if (gainedMp > 0) spawnCombatFloat(b, 'player', `+${gainedMp} MP`, 'mp');
            pushLog(b, logTag('cbl-violet', `✦【共鸣·霁馆剑心(2件)】卸力闪反引动魔战双倍回流 +${riposteDmg * 2} MP！`));
          }
          if (checkImmediateVictoryOrNextWave(b, { fromEndTurn: true, bankedAp: banked })) {
            if (!b.headless) renderCombatUI();
            return true;
          }
          if (tickEnemyEndTurn(b, e, { parried: true })) return true;
          continue;
        }

        // 敌方破盾重锤判定（专治无脑叠盾龟缩！）
        if (intent.shatterPlayerShield && p.shield > 0) {
          pushLog(b, logTag('cbl-danger', `💥 ${e.name} 的「${intent.moveName}」正面轰碎了你全部 ${p.shield} 点护盾！`));
          p.shield = 0;
        }

        let incoming = Math.round(intent.dmg * afterimageShearMult);
        if (e.broken) incoming = Math.round(incoming * COMBAT_BALANCE_V22.HSR_AV.breakRecoveryAtkMult);
        if (e.status.chill > 0) incoming = Math.round(incoming * 0.86);
        if (intent.elem === 'fire' && p.passives.includes('temp_sense')) {
          incoming = Math.round(incoming * 0.8);
        }
        if (intent.slipStrike && !p.status.rooted) {
          incoming = Math.round(incoming * 1.3);
        }
        if (p.status.lungeMitigate > 0 && intent.stance === 'CLOSE_LUNGE') {
          incoming = Math.round(incoming * 0.4);
        }

        const isRowanEclipseTrue = !!intent.eclipseTrueMagic;
        const playerShieldKind = p.shieldKind || 'solid';
        const bypassMagicPlayerShield = !!(isRowanEclipseTrue && p.shield > 0 && playerShieldKind === 'magic');

        if (isRowanEclipseTrue) {
          // V2.2 敌我同规：罗文晦轮杖魔法真伤无视 MDEF 与魔法水幕；实体厚冰墙阻尼 50%，叠加雷纳德岩板阻尼 75%
          if (p.shield > 0 && playerShieldKind === 'solid') {
            if (b.stageCfg.sealRule && intent.renoRockBlock) {
              incoming = Math.round(incoming * 0.25);
              pushLog(b, logTag('cbl-star', `🪨 雷纳德勾起碎石板与你的实体冰墙合力阻尼 75% 晦轮真伤！（须铺设蔓地薄冰主动设伏才能推进封锁度）`));
            } else {
              incoming = Math.round(incoming * 0.50);
              pushLog(b, logTag('cbl-ice', `🧊 实体冰墙硬抗阻尼了 50% 晦轮黑芒真伤！`));
            }
          } else if (bypassMagicPlayerShield) {
            pushLog(b, logTag('cbl-violet', `🌑 罗文晦轮杖引动 100% 魔法真伤，直接洞穿法抗与魔法水幕！（宜改用凝结冰墙等实体盾抵挡）`));
          } else if (b.stageCfg.sealRule && intent.renoRockBlock) {
            incoming = Math.round(incoming * 0.65);
          }
          incoming = Math.max(4, Math.round(incoming));
        } else {
          // 罗文首击黑光等常规雷纳德岩板协助减伤
          if (b.stageCfg.sealRule && intent.renoRockBlock && p.shield > 0) {
            incoming = Math.round(incoming * 0.45);
            pushLog(b, logTag('cbl-star', `🪨 雷纳德勾起碎石板与你的冰墙合力拦下大半黑光！（提示：须铺设蔓地薄冰主动设伏才能推进封锁度）`));
          }
          // V2.2 K=80 双曲线比值防御
          const pDef = Math.max(0, intent.elem === 'phys' ? p.def : p.mdef);
          incoming = Math.max(4, Math.round(incoming * (COMBAT_BALANCE_V22.DEF_K / (COMBAT_BALANCE_V22.DEF_K + pDef))));
        }

        let hpLoss = incoming;
        p.shield = Math.max(0, p.shield || 0);
        if (intent.bypassAllShield || bypassMagicPlayerShield) {
          // 脚底穿刺或晦轮杖真伤对魔法盾完全穿透
        } else if (intent.bypassHalfShield) {
          const blk = Math.min(Math.floor(p.shield * 0.5), hpLoss);
          p.shield = Math.max(0, p.shield - blk);
          hpLoss = Math.max(0, hpLoss - blk);
        } else {
          const blk = Math.min(p.shield, hpLoss);
          p.shield = Math.max(0, p.shield - blk);
          hpLoss = Math.max(0, hpLoss - blk);
        }

        // 仅钢冰生根盾（iceThorns）产生微弱10点冰晶刮擦，且最低保留敌方1HP，绝不回蓝、绝不磨死Boss！
        if (p.status.iceThorns > 0 && e.hp > 1 && (intent.stance === 'HEAVY_WINDUP' || intent.stance === 'CLOSE_LUNGE')) {
          const chip = Math.min(e.hp - 1, 10);
          if (chip > 0) {
            e.hp -= chip;
            pushLog(b, logTag('cbl-ice', `❄️ 生根冰盾表面霜刺刮伤 ${e.name} ${chip} 点皮毛。`));
          }
        }

        p.hp = Math.max(0, p.hp - hpLoss);
        if (hpLoss > 0) {
          if (!getPixelVfxApi()) triggerShake(b, hpLoss >= 45);
          spawnCombatFloat(b, 'player', `-${hpLoss}`, 'enemy-dmg');
          queueHitPulse(b, 'player', 0);
          const eHitVfx = intent.elem === 'water' ? 'water' : intent.elem === 'ice' ? 'ice' : 'sword';
          queueElementVFX(b, eHitVfx, 'player', 0, { skipHitStop: true });
          queuePixelAction(b, { type: 'enemy_attack', enemyIdx: b.enemies.indexOf(e), enemy: e, intent, hpLoss, blocked: false });
          if (!b.headless) safeSfx('bad');
          pushLog(b, logTag('cbl-danger', `❗ ${e.name} 施展「${intent.moveName}」，造成 ${hpLoss} 伤害${hpLoss < incoming ? `（护盾抵消 ${incoming - hpLoss}）` : ''}！`));
          if (intent.scoresHit && b.stageCfg.hitRule) {
            const hitGain = (intent.slipStrike && !p.status.rooted) ? 2 : 1;
            b.enemyHits = Math.min(b.stageCfg.targetHits || 3, b.enemyHits + hitGain);
            pushLog(b, logTag('cbl-danger', `⚠️ ${hitGain > 1 ? '脚底未生根打滑连中两刺！' : '被艾诺有效命中！'}比分：${b.playerHits} : ${b.enemyHits}！`, true));
            if (b.enemyHits >= (b.stageCfg.targetHits || 3)) {
              finishBattle(b, false, 'enemy_three_hits');
              return true;
            }
          }
        } else {
          queuePixelAction(b, { type: 'enemy_attack', enemyIdx: b.enemies.indexOf(e), enemy: e, intent, hpLoss: 0, blocked: true });
          if (!b.headless) safeSfx('shield_block');
          pushLog(b, logTag('cbl-ice', `🛡️ 你的护盾稳稳挡下了 ${e.name} 的「${intent.moveName}」！`));
        }

        if (intent.inflictBlind) {
          p.status.blind = (p.status.blind || 0) + intent.inflictBlind;
          pushLog(b, logTag('cbl-star', `🌫️ 扬尘遮蔽视线（下一次非范围单点攻击必偏斜，可用覆潮水弹/折射水幕洗净）！`));
        }
        if (intent.addBurn && hpLoss > 0) {
          p.status.burn = (p.status.burn || 0) + intent.addBurn;
        }

        if (hadNobleReflect && hpLoss >= 0 && e.hp > 0) {
          const refDmg = Math.round(p.mdef * 1.4 + 28);
          dealDamageToEnemy(b, e, refDmg, {});
          pushLog(b, logTag('cbl-star', `👑【贵族体面·回敬】礼仪冰霜震退 ${e.name}，反伤 ${refDmg}！`));
          if (checkImmediateVictoryOrNextWave(b, { fromEndTurn: true, bankedAp: banked })) {
            if (!b.headless) renderCombatUI();
            return true;
          }
        }

        if (p.hp > 0 && p.hp < p.mhp * 0.35 && !b._blueVialTriggered && hasRelic(p, 'blue_vial')) {
          b._blueVialTriggered = true;
          const vialHeal = Math.max(15, Math.round(p.mhp * 0.25));
          p.hp = Math.min(p.mhp, p.hp + vialHeal);
          p.status.afterimage = (p.status.afterimage || 0) + 1;
          pushLog(b, logTag('cbl-ice', `🧪【淡蓝小瓶】濒危安神凉雾散开，回复 ${vialHeal} 生命并幻化 1 层「风行残像」！`, true));
        }

        if (p.hp <= 0) {
          finishBattle(b, false, 'hp_zero');
          return true;
        }
      }

      if (tickEnemyEndTurn(b, e)) return true;
    }

    // 玩家回合末结算
    if (p.status.burn > 0) {
      const burnDmg = 8;
      p.hp = Math.max(0, p.hp - burnDmg);
      p.status.burn -= 1;
      if (p.status.burn <= 0) delete p.status.burn;
      pushLog(b, logTag('cbl-danger', `🔥 烈焰灼烧损耗 ${burnDmg} 生命。`));
      if (p.hp > 0 && p.hp < p.mhp * 0.35 && !b._blueVialTriggered && hasRelic(p, 'blue_vial')) {
        b._blueVialTriggered = true;
        const vialHeal = Math.max(15, Math.round(p.mhp * 0.25));
        p.hp = Math.min(p.mhp, p.hp + vialHeal);
        p.status.afterimage = (p.status.afterimage || 0) + 1;
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
        pushLog(b, logTag('cbl-ice', `✝️【银十字架】微光抚平伤势，回复 ${p.hp - beforeHp} 生命。`));
      }
    }

    // 艾诺切磋回合上限判定（在递增 b.turn 之前检查）
    if (b.stageCfg.turnLimit && b.turn >= b.stageCfg.turnLimit) {
      pushLog(b, logTag('cbl-danger', `⏱️ ${b.stageCfg.turnLimit} 回合时限已到，未能拿满三次有效命中，切磋告负！`, true));
      finishBattle(b, false, 'turn_limit');
      return true;
    }

    applyTurnBoundaryCleanup(b, banked);
    b.waveTurn = (b.waveTurn || 1) + 1;

    if (hasRelic(p, 'northwind_pass')) {
      const beforeS = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + 12);
      if (beforeS <= 0) p.shieldKind = 'solid';
      if (p.shield > beforeS) {
        pushLog(b, logTag('cbl-ice', `🪪【北风堡木牌】新回合寒铁护盾 +${p.shield - beforeS}（当前 ${p.shield}/${p.maxShield}）。`));
      }
    }
    if (getSynergyTier(p, 'north_frost') >= 2) {
      const beforeNF = p.shield;
      p.shield = Math.min(p.maxShield, Math.max(0, p.shield) + 10);
      if (beforeNF <= 0) p.shieldKind = 'solid';
      if (p.shield > beforeNF) {
        pushLog(b, logTag('cbl-ice', `✦【共鸣·北境霜锋(2件)】新回合霜锋寒甲 +${p.shield - beforeNF} 护盾（当前 ${p.shield}/${p.maxShield}）。`));
      }
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

    if (!b.headless) renderCombatUI();
    return true;
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
      const recMp = Math.round(p.mmp * 0.2);
      p.mp = Math.min(p.mmp, p.mp + recMp);
      pushLog(b, logTag('cbl-ice', `📐【心念援护·诺艾儿·精算校准】「${meta ? meta.quote : ''}」本回合所有技能零耗蓝，并立即回复 ${recMp} MP！`, true));
    } else if (cid === 'aino') {
      b.enemies.forEach(e => {
        if (e.hp > 0) {
          e.status.vuln = (e.status.vuln || 0) + 2;
          e.status.chill = (e.status.chill || 0) + 2;
        }
      });
      if (primary && primary.shield > 0) {
        primary.shield = Math.max(0, Math.floor(primary.shield * 0.7));
      }
      pushLog(b, logTag('cbl-ice', `❄️【心念援护·艾诺·霜域共鸣】「${meta ? meta.quote : ''}」全体附加 2 回合易伤与寒颤，当前目标削盾 30%！`, true));
    } else if (cid === 'jilan') {
      b.ap = Math.min(b.apMax, b.ap + 1);
      p.status.poise = 1;
      if (primary && primary.evadeCharges > 0) primary.evadeCharges -= 1;
      if (p.status.blind > 0) delete p.status.blind;
      else if (p.status.burn > 0) delete p.status.burn;
      pushLog(b, logTag('cbl-violet', `💜【心念援护·霁岚·霁馆借步】「${meta ? meta.quote : ''}」+1 AP、剑势蓄力并震破目标 1 层闪避！`, true));
    } else if (cid === 'charlotte') {
      p.shield = Math.max(p.maxShield, p.shield + 40);
      p.status.nobleReflect = 1;
      pushLog(b, logTag('cbl-star', `👑【心念援护·夏洛特·贵族体面】「${meta ? meta.quote : ''}」护盾补满（至少+40）并展开冰镜反震！`, true));
    }

    spawnBanner(b, `💞 ${meta ? `${meta.icon} ${meta.name}·${meta.title}` : '心念援护'}！`, 'riposte');
    queuePixelAction(b, { type: 'bond_assist', charId: cid });
    if (!b.headless) safeSfx('egg');
    if (!b.headless) renderCombatUI();
    return { ok: true, charId: cid };
  }

  /* =========================================================
     7. 评级计算与严格存档沙盒隔离
     ========================================================= */
  function calculateGrade(b) {
    if (!b.won) return 'F';
    let score = 70;
    const parTurns = (b.stageCfg && b.stageCfg.order >= 8) ? 9 : (b.totalWaves > 1 ? 8 : 6);
    if (b.turn <= parTurns) score += 12;
    else if (b.turn <= parTurns + 3) score += 6;
    else if (b.turn > parTurns + 7) score -= 8;

    if (b.metrics.interrupts > 0 || b.metrics.ripostes > 0 || b.metrics.manaFizzleWin) score += 8;
    if (b.metrics.insights > 0) score += 15;
    const hpRatio = b.player.hp / Math.max(1, b.player.mhp);
    if (hpRatio >= 0.5) score += 6;
    else if (hpRatio >= 0.25) score += 2;
    if (b.crateHp != null && b.crateHp < 60) score -= 15;

    let grade = score >= 97 ? 'S' : score >= 80 ? 'A' : 'B';
    if (b.exposureWarningTriggered) grade = 'B';
    return grade;
  }

  function applyStageRewardsToGame(b) {
    // 核心红线：演武场独立沙盒（fromArena: true）严禁修改主线存档 S 的任何属性、经验、金币或道具！
    if (!b || b.headless || b.fromArena) return;
    const curS = getGameS();
    if (!curS) return;

    const rew = b.stageCfg.reward || {};
    const isDreamDuel = !!rew.duelKey;

    if (!b.won) {
      if (!isDreamDuel) {
        // 野外实战战败：重伤撤回安全屋
        curS.deaths = (curS.deaths || 0) + 1;
        curS.hp = 1;
        curS.mp = Math.max(5, Math.min(curS.mmp, b.player.mp));
        if (curS.lastSafe) curS.loc = curS.lastSafe;
      }
      if (typeof global.updateHUD === 'function') global.updateHUD();
      return;
    }

    // 野外实战胜利：同步写回真实 HP/MP 损耗
    if (!isDreamDuel) {
      curS.hp = Math.max(1, Math.min(curS.mhp, b.player.hp));
      curS.mp = Math.max(0, Math.min(curS.mmp, b.player.mp));
    }

    // 虚拟决斗奖励仅首次战胜发放，防止无限刷钱刷级
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

    if (won) {
      saveArenaRecord(b.id, b.grade, b.turn);
      if (!b.headless) safeSfx(b.grade === 'S' ? 'grade_s' : 'level');
    } else {
      if (!b.headless) safeSfx('bad');
    }
    applyStageRewardsToGame(b);

    if (!b.headless) {
      renderCombatUI();
      showResultModal(b);
    }
  }

  /* =========================================================
     8. UI 渲染层（实时悬停魔力增幅预览 + 两步随机洗牌冰晶宫殿 + 演武大厅）
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

  function ensureBattleDOM() {
    if (typeof document === 'undefined') return null;
    const root = document.getElementById('battle-screen');
    if (!root) return null;
    if (root.querySelector('.cb-shell')) return root;

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
            <button class="cb-tool-btn palace-btn" id="cb-btn-palace">${CB_SVG.crystal} 冰晶宫殿 <span class="cb-kbd">Q</span></button>
            <button class="cb-tool-btn wand-btn hidden" id="cb-btn-wand">${CB_SVG.wand} 晦轮杖 <span class="cb-kbd">R</span></button>
            <button class="cb-tool-btn assist-btn locked-hint" id="cb-btn-assist" disabled>${CB_SVG.assist} 心念援护 <span class="cb-kbd">F</span></button>
            <button class="cb-tool-btn retreat-btn" id="cb-btn-retreat">${CB_SVG.retreat} 撤出</button>
          </div>
        </header>

        <div class="cb-arena-field">
          <canvas id="cb-pixel-vfx-canvas" class="cb-pixel-vfx-canvas" aria-hidden="true"></canvas>
          <div class="cb-callout-layer" id="cb-callout-layer"></div>

          <div class="cb-player-stage" id="cb-player-stage">
            <div class="cb-standee-wrap">
              <div class="cb-magic-circle" aria-hidden="true"></div>
              <div class="cb-p-portrait" id="cb-p-portrait"></div>
            </div>
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

          <section class="cb-enemy-zone" id="cb-enemy-zone"></section>
        </div>

        <div class="cb-forecast-bar" id="cb-forecast-bar">${isCoarseTouchDevice() ? '轻点技能卡查看破招与预计伤害，再次点击施放' : '悬停任意技能卡，实时推演架势克制、破招截断、预计伤害与魔战回蓝'}</div>

        <div id="b-enemy" class="hidden">
          <span id="b-emoji"></span><span id="b-ename"></span>
          <i id="b-ehp"></i><em id="b-ehp-num"></em>
        </div>

        <footer class="cb-deck">
          <div class="cb-left-console">
            <div class="cb-overcast-box" id="cb-overcast-box">
              <div class="cb-oc-head">
                <span>魔战循环 · 魔力增幅 <span class="cb-kbd">W</span></span>
                <span class="cb-oc-mult" id="cb-oc-mult">1.00x</span>
              </div>
              <div class="cb-oc-seg" id="cb-oc-seg">
                <button class="cb-oc-btn" data-oc="0">常规 0%</button>
                <button class="cb-oc-btn" data-oc="1">魔力盈溢 25%</button>
                <button class="cb-oc-btn all-in" data-oc="2">极寒过载 50%</button>
              </div>
            </div>
            <div id="b-log" class="cb-log-box"></div>
          </div>

          <div id="b-actions" class="cb-skills-grid"></div>

          <div class="cb-turn-col">
            <button class="cb-endturn-btn" id="cb-btn-endturn">
              <span class="cb-endturn-seal" aria-hidden="true">${CB_SVG.hourglass}</span>
              <span class="cb-endturn-main">结束回合 <span class="cb-kbd">E</span></span>
              <small>可留存 1 点 AP</small>
            </button>
          </div>
        </footer>
      </div>
      <div id="cb-modal-slot"></div>
    `;

    root.querySelector('#cb-oc-seg').onclick = e => {
      const btn = e.target.closest('[data-oc]');
      if (!btn || btn.disabled) return;
      setOvercast(Number(btn.getAttribute('data-oc')));
    };
    root.querySelector('#cb-btn-palace').onclick = () => openIcePalaceModal();
    root.querySelector('#cb-btn-wand').onclick = () => toggleEclipseWand();
    root.querySelector('#cb-btn-assist').onclick = () => useBondAssist();
    root.querySelector('#cb-btn-endturn').onclick = () => endTurn();
    root.querySelector('#cb-btn-retreat').onclick = () => exitBattle(false);

    return root;
  }

  function syncHoverEnemyGlow(sid, bOverride) {
    if (typeof document === 'undefined') return;
    const b = bOverride || activeBattle;
    const eZone = document.getElementById('cb-enemy-zone');
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
        (sk.dodgeLunge && en.intent && (en.intent.stance === 'CLOSE_LUNGE' || en.intent.moveKey === 'EYE_STILLNESS'))
      );
      const willShieldBreak = !!(effDmg > 0 && (en.shield || 0) > 0 && (sk.shatterShield || effDmg >= (en.shield || 0)));
      const phaseLocked = !!(en.boss && en.phase2HpPct && (en.phase || 1) < 2);
      const seepLocked = !!(en.aiType === 'noelle' && !en.seepTriggeredOnce && !en.seepSevered && !sk.severSeep && en.hp > 165);
      const isLethal = !!(!en.nonLethalSpar && !phaseLocked && !seepLocked && hpDmg >= en.hp && en.hp > 0);

      if (canBreak && cardEl) {
        cardEl.classList.add('counter-target-glow');
      }

      if (hpDmg > 0 && prevEl) {
        const leftPct = Math.max(0, ((en.hp - hpDmg) / maxHp) * 100);
        const widthPct = Math.max(0, Math.min(100 - leftPct, (hpDmg / maxHp) * 100));
        prevEl.style.left = `${leftPct.toFixed(2)}%`;
        prevEl.style.width = `${widthPct.toFixed(2)}%`;
        prevEl.classList.add('is-active');
        if (isLethal) {
          prevEl.classList.add('is-lethal');
          if (cardEl) cardEl.classList.add('is-lethal');
        } else if (canBreak || willShieldBreak) {
          prevEl.classList.add('is-break');
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
    const pickId = refSkillId || p.skills.find(id => {
      const s = TACTICAL_SKILLS[id];
      return s && s.atkKind === 'matk' && s.power > 0 && !s.noOvercast;
    }) || 'hand_ice_crystal';
    const refSkill = TACTICAL_SKILLS[pickId] || TACTICAL_SKILLS.hand_ice_crystal;

    if (!p.hasManaCycle) {
      ocMultEl.textContent = '未习得';
      commitBar.style.width = '0%';
    } else {
      // 精确联动悬停技能或当前首个可用魔法技能的真实蓝耗（含 mana_calc -15% / 省魔手稿 与晦轮杖附加耗蓝）
      const realSpend = Math.min(p.mp, computeSkillMpCost(p, refSkill));
      const powerMp = Math.min(p.mp, computeOvercastPowerMp(p, refSkill));
      const realMult = computeManaCycleMultiplier(p, powerMp, refSkill);

      ocMultEl.textContent = `${refSkill.name} ${realMult.toFixed(2)}x (耗${realSpend})`;
      const spendPct = Math.min(mpPct, realSpend / Math.max(1, p.mmp) * 100);
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
            : '战术增益/防反';
          const multPart = fc.dmgMin > 0
            ? `克制 <b>${fc.elemMult.toFixed(2)}×</b> · 魔战 <b>${fc.mcMult.toFixed(2)}×</b> · 回蓝 <b>+${fc.manaReturn}</b>`
            : `消耗 AP ${fc.apCost}${fc.mpCost > 0 ? ` · MP ${fc.mpCost}` : ''}`;
          forecastBar.innerHTML = `<span class="cfb-name">${CB_SVG.target} ${hoverSk.name}</span>${counterPills.join('')}<span class="cfb-head">${fc.headline}</span><span class="cfb-meta">${dmgPart} · ${multPart}${fc.critChance > 0 && fc.dmgMin > 0 ? ` · 暴击 ${(fc.critChance * 100).toFixed(0)}%` : ''}</span>`;
        }
      } else if (p.status && p.status.breakChain > 0) {
        forecastBar.className = 'cb-forecast-bar active kind-chain';
        forecastBar.innerHTML = `<span class="cfb-head">${CB_SVG.chain} 【破招连携窗口已激活】本回合下一张非基础攻击牌享 1.35× 伤害并额外返还 15% 魔力！</span>`;
      } else {
        forecastBar.className = 'cb-forecast-bar';
        forecastBar.textContent = isCoarseTouchDevice()
          ? '轻点技能卡查看破招与预计伤害，再次点击施放'
          : '悬停任意技能卡，实时推演架势克制、破招截断、预计伤害与魔战回蓝';
      }
    }
  }

  function renderCombatUI() {
    const b = activeBattle;
    if (!b || b.headless || typeof document === 'undefined') return;
    const root = ensureBattleDOM();
    if (!root) return;

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

    const palBtn = document.getElementById('cb-btn-palace');
    if (p.palaceMax <= 0) {
      palBtn.innerHTML = `${CB_SVG.crystal} <span class="cb-btn-txt">冰晶宫殿<span class="cb-palace-detail">（未习得）</span></span>`;
      palBtn.disabled = true;
      palBtn.classList.remove('pulse-hint', 'gathering');
    } else if (p.palaceLeft > 0 && (b.waveTurn || 1) < 2) {
      palBtn.innerHTML = `${CB_SVG.crystal} <span class="cb-btn-txt">冰晶宫殿<span class="cb-palace-detail">·凝结采集中</span> (${p.palaceLeft}/${p.palaceMax})</span>`;
      palBtn.title = '须先观察敌方本波至少出手一轮，第 2 回合起可开启冰晶宫殿并行推演';
      palBtn.disabled = true;
      palBtn.classList.remove('pulse-hint');
      palBtn.classList.add('gathering');
    } else if (p.palaceLeft > 0) {
      palBtn.innerHTML = `${CB_SVG.crystal} <span class="cb-btn-txt">冰晶宫殿 (${p.palaceLeft}/${p.palaceMax})</span> <span class="cb-kbd">Q</span>`;
      palBtn.title = '展开冰晶宫殿记忆冰镜，两步并行推演敌方招式死角';
      palBtn.disabled = b.over;
      palBtn.classList.remove('gathering');
      palBtn.classList.toggle('pulse-hint', !b.over);
    } else {
      palBtn.innerHTML = `${CB_SVG.crystal} <span class="cb-btn-txt">冰晶宫殿 (0/${p.palaceMax})${b.waveIdx + 1 < b.totalWaves ? '<span class="cb-palace-detail"> · 下波重置</span>' : ''}</span>`;
      palBtn.title = b.waveIdx + 1 < b.totalWaves ? '本波已审视，进入下一波将重新凝结 1 次机会' : '本场审视机会已用尽';
      palBtn.disabled = true;
      palBtn.classList.remove('pulse-hint', 'gathering');
    }

    const wBtn = document.getElementById('cb-btn-wand');
    if (p.hasEclipseWand) {
      wBtn.classList.remove('hidden');
      wBtn.classList.toggle('active', !!p.wandActive);
      const extraMpTip = Math.round(Math.max(1, p.mmp || 100) * COMBAT_BALANCE_V22.STAVES.eclipse_wand.extraMpPct);
      wBtn.title = `晦轮杖（V2.2）：100% 魔法真伤，无视法抗与魔法盾，仅物理实体甲阻尼；额外耗蓝 +${extraMpTip} MP，无冷却`;
      wBtn.innerHTML = p.wandActive
        ? `${CB_SVG.wand} 晦轮杖：真伤 ON <span class="cb-kbd">R</span>`
        : `${CB_SVG.wand} 晦轮杖：收鞘 <span class="cb-kbd">R</span>`;
      wBtn.disabled = b.over;
    } else {
      wBtn.classList.add('hidden');
    }

    const assistBtn = document.getElementById('cb-btn-assist');
    if (assistBtn) {
      const api = getRelicsApi();
      const aMeta = p.bondAssist && api && api.BOND_ASSISTS ? api.BOND_ASSISTS[p.bondAssist] : null;
      assistBtn.classList.remove('hidden');
      if (aMeta) {
        assistBtn.classList.remove('locked-hint');
        assistBtn.disabled = b.over || !!p.bondAssistUsed;
        assistBtn.title = `${aMeta.effectDesc} — ${aMeta.quote}`;
        assistBtn.innerHTML = p.bondAssistUsed
          ? `${CB_SVG.assist} ${aMeta.title} (已援护)`
          : `${CB_SVG.assist} ${aMeta.name}·${aMeta.title} <span class="cb-kbd">F</span>`;
      } else {
        assistBtn.classList.add('locked-hint');
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
    const pPortEl = document.getElementById('cb-p-portrait');
    const pStandeeWrap = pPortEl ? pPortEl.closest('.cb-standee-wrap') : null;
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
    document.getElementById('cb-p-name').textContent = p.name;
    document.getElementById('cb-p-sub').textContent = `物攻 ${p.atk} · 魔攻 ${p.matk} · 双抗 ${p.def}/${p.mdef}`;

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
    if (b.oneMoreActive) buffs.push(`<span class="cb-buff-chip gold">✦ ONE MORE</span>`);
    if (p.shield > 0) buffs.push(`<span class="cb-buff-chip shield">${p.shieldKind === 'magic' ? '魔法盾' : '实体盾'} ${p.shield}/${p.maxShield}</span>`);
    if (p.status.breakChain > 0) buffs.push(`<span class="cb-buff-chip gold chain-active">✦ 连携追击 1.35×</span>`);
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
    if (p.passives.includes('frost_edge')) buffs.push(`<span class="cb-buff-chip">覆冰锋+18%</span>`);
    if (p.passives.includes('instant_ice')) buffs.push(`<span class="cb-buff-chip">隔空凝冰</span>`);
    if (p.synergies && p.synergies.length) {
      p.synergies.forEach(syn => {
        const synDesc = String(syn.desc || syn.activeDesc || '').replace(/"/g, '&quot;');
        buffs.push(`<span class="cb-buff-chip synergy" title="【${syn.name}·${syn.tier || syn.count}件共鸣】${synDesc}">✦ ${syn.name}·${syn.tier || syn.count}件</span>`);
      });
    }
    if (p.relics && p.relics.length) {
      const api = getRelicsApi();
      const relMap = (api && (api.RELICS_CATALOG || api.RELICS)) || {};
      p.relics.forEach(rid => {
        const rm = relMap[rid];
        if (rm) buffs.push(`<span class="cb-buff-chip relic" title="${String(rm.effectText || '').replace(/"/g, '&quot;')}">✦ ${rm.name}</span>`);
      });
    }
    if (p.status.blind > 0) buffs.push(`<span class="cb-buff-chip debuff">视线受阻×${p.status.blind}</span>`);
    if (p.status.burn > 0) buffs.push(`<span class="cb-buff-chip debuff">灼烧(${p.status.burn})</span>`);
    document.getElementById('cb-p-buffs').innerHTML = buffs.join('');

    root.querySelectorAll('#cb-oc-seg .cb-oc-btn').forEach(btn => {
      const m = Number(btn.getAttribute('data-oc'));
      btn.disabled = !p.hasManaCycle || b.over;
      btn.classList.toggle('active', p.hasManaCycle && p.overcastMode === m);
    });

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

    eZone.innerHTML = b.enemies.map((e, idx) => {
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
      const eBuffs = [];
      if (e.boss && (e.phase || 1) >= 2) eBuffs.push(`<span class="cb-buff-chip synergy">✦ 二阶段</span>`);
      if (e.broken) eBuffs.push(`<span class="cb-buff-chip gold">✦ 弱点击破 1.35×</span>`);
      else if (e.maxLocks > 0 && e.hp > 0) eBuffs.push(`<span class="cb-buff-chip">锁 ${e.locks}/${e.maxLocks}</span>`);
      if (e.shield > 0) eBuffs.push(`<span class="cb-buff-chip shield">${e.shieldKind === 'solid' ? '实体盾' : '魔法盾'} ${e.shield}</span>`);
      if (e.solidArmor > 0) eBuffs.push(`<span class="cb-buff-chip">实体甲 ${Math.round(e.solidArmor * 100)}%</span>`);
      if (e.fireAura > 0) eBuffs.push(`<span class="cb-buff-chip gold">烈焰斗气×${e.fireAura}</span>`);
      if (e.evadeCharges > 0) eBuffs.push(`<span class="cb-buff-chip">闪避层×${e.evadeCharges}</span>`);
      if (e.status.evadeSealed > 0) eBuffs.push(`<span class="cb-buff-chip debuff">风步已封(${e.status.evadeSealed})</span>`);
      if (e.flawToken > 0) eBuffs.push(`<span class="cb-buff-chip gold">下击破绽+20%</span>`);
      if (e.seepStacks > 0 && !e.seepSevered) eBuffs.push(`<span class="cb-buff-chip debuff">暗水线×${e.seepStacks}</span>`);
      if (e.seepSevered) eBuffs.push(`<span class="cb-buff-chip">暗流已冻绝</span>`);
      if (e.status.vuln > 0) eBuffs.push(`<span class="cb-buff-chip gold">易伤(${e.status.vuln})</span>`);
      if (e.status.chill > 0) eBuffs.push(`<span class="cb-buff-chip">寒颤(${e.status.chill})</span>`);

      const nextLine = (showNextTendency && e.hp > 0)
        ? `<div class="ib-next-tendency">✦ 下回合预判：${predictNextIntentTendency(e, b)}</div>`
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
      const fullTipAttr = String(`${sm.badge} | 招式：${intent.moveName} | ${sm.hint}`).replace(/"/g, '&quot;');
      const safeTrait = String(e.trait || '').replace(/"/g, '&quot;');
      const traitHtml = e.trait
        ? `<span class="cb-trait-wrap"><button type="button" class="cb-trait-pill" title="${safeTrait}">特性</button><span class="cb-trait-tip" role="tooltip">${e.trait}</span></span>`
        : '';
      const hpLabel = e.nonLethalSpar ? '切磋耐力（三击制）' : (isMultiEnemy ? 'HP' : '敌方生命');
      const mpLabel = isMultiEnemy ? 'MP' : '敌方魔力';

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

      return `
        <article class="cb-enemy-card${idx === b.targetIdx ? ' targeted' : ''}${e.hp <= 0 ? ' dead' : ''}${intent.stance === 'STAGGERED' ? ' staggered' : ''}${isHeavyWarn ? ' intent-heavy-warn' : ''}${e.boss && (e.phase || 1) >= 2 ? ' phase2-boss' : ''}" data-eidx="${idx}">
          <div class="cb-intent-banner stance-${intent.stance}" tabindex="0">
            <div class="ib-row">
              <span class="ib-stance-tag">${sm.short}</span>
              <span class="ib-move-name">${shortMove}</span>
              <span class="ib-dmg-pill">${dmgPillText}</span>
              <button type="button" class="ib-info-btn" aria-label="查看架势对策" title="${fullTipAttr}">i</button>
            </div>
            ${nextLine}
            <div class="cb-intent-tip" role="tooltip">
              <div class="ib-tip-head">${sm.badge}</div>
              <div class="ib-tip-move">招式：<b>${intent.moveName}</b></div>
              <div class="ib-tip-hint">${sm.hint}</div>
            </div>
          </div>

          <div class="cb-e-stage${pxApi ? ' has-px-actor' : ''}">
            <div class="cb-magic-circle enemy" aria-hidden="true"></div>
            ${eStageHtml}
          </div>

          <div class="cb-e-plate">
            <span class="cb-hp-microtag" data-eidx="${idx}"></span>
            <div class="cb-e-info">
              <div class="cb-e-name">
                <span class="cb-e-title">${e.name}</span>
                <span class="cb-e-badges">
                  ${traitHtml}
                  <span class="cb-elem-tag elem-${e.elem || 'phys'}">${ELEM_LABEL[e.elem] || '剑术'}</span>
                </span>
              </div>
            </div>
            <div class="cb-bars-wrap">
              <div class="cb-stat-row">
                <div class="cb-stat-top">
                  <span class="cb-stat-label">${hpLabel}</span>
                  <span class="cb-stat-val">${e.nonLethalSpar ? '点到为止' : `${e.hp}/${e.mhp}`}${e.shield ? ` (+盾${e.shield})` : ''}</span>
                </div>
                <div class="cb-stat-track">
                  <div class="cb-stat-fill ehp" style="width:${e.nonLethalSpar ? 100 : Math.max(0, e.hp / e.mhp * 100)}%"></div>
                  <div class="cb-ehp-preview cb-hp-preview" data-eidx="${idx}"></div>
                </div>
              </div>
              ${e.mmp != null ? `
              <div class="cb-stat-row">
                <div class="cb-stat-top"><span class="cb-stat-label">${mpLabel}</span><span class="cb-stat-val">${e.mp}/${e.mmp}</span></div>
                <div class="cb-stat-track"><div class="cb-stat-fill emp" style="width:${Math.max(0, e.mp / e.mmp * 100)}%"></div></div>
              </div>` : ''}
            </div>
            <div class="cb-buff-list">${eBuffs.join('')}</div>
          </div>
        </article>
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

    updateOvercastPreviewUI(b, hoveredSkillId);

    eZone.querySelectorAll('.ib-info-btn').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        const banner = btn.closest('.cb-intent-banner');
        if (!banner) return;
        const wasOpen = banner.classList.contains('tip-open');
        eZone.querySelectorAll('.cb-intent-banner.tip-open, .cb-trait-wrap.tip-open').forEach(el => el.classList.remove('tip-open'));
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
          armedSkillId = null;
          hoveredSkillId = null;
          b.targetIdx = idx;
          renderCombatUI();
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
      const cd = p.cooldowns[skId] || 0;
      const usedUp = sk.maxUses && (p.usedMaxSkills[skId] || 0) >= sk.maxUses;
      const disabled = b.over || usedUp || cd > 0 || b.ap < apCost || p.mp < costMp;
      const est = sk.power > 0 ? estimateSkillDamage(b, sk, primary) : null;

      let oppBadge = '';
      if (!disabled && targetMoveKey === 'TEMPEST_VACUUM' && sk.path === 'SWORD' && (sk.dodgeLunge || sk.counterLunge)) {
        oppBadge = '<span class="cb-opp-pill">✦ 斩风瞬反</span>';
      } else if (!disabled && targetMoveKey === 'EYE_STILLNESS' && ((sk.path === 'SWORD' && sk.dodgeLunge) || (sk.path === 'SWORD' && sk.counterLunge && p.status.poise > 0) || (sk.path === 'REMOTE' && p.wandActive))) {
        oppBadge = '<span class="cb-opp-pill">✦ 可破静滞</span>';
      } else if (!disabled && sk.path === 'REMOTE' && targetStance === 'DUAL_CAST') {
        oppBadge = '<span class="cb-opp-pill">✦ 可破招</span>';
      } else if (!disabled && sk.path === 'SWORD' && (sk.dodgeLunge || sk.counterLunge) && targetStance === 'CLOSE_LUNGE') {
        oppBadge = '<span class="cb-opp-pill">✦ 可闪反</span>';
      } else if (!disabled && sk.path === 'INSIGHT') {
        oppBadge = '<span class="cb-opp-pill">✦ 必杀看破</span>';
      } else if (!disabled && est && est.chainApplied) {
        oppBadge = '<span class="cb-opp-pill chain">✦ 连携1.35×</span>';
      }

      let expHint = '';
      if (b.witnessActive) {
        let expVal = (sk.exposure || 0) + (isEclipseStaffForSkill(p, sk) ? 55 : 0);
        if (hasRelic(p, 'ebony_sword') && sk.path === 'SWORD') expVal = Math.min(0, expVal);
        expHint = expVal > 0
          ? `<span class="csc-exp-warn">暴露+${expVal}%</span>`
          : `<span class="csc-exp-safe">隐蔽安全</span>`;
      }

      const keyHint = slotIdx < 9 ? `<span class="cb-kbd">${slotIdx + 1}</span> ` : '';
      const pillPath = pm.pill || pm.short.slice(0, 2);
      const isGuardCard = !!(sk.shieldBase || sk.dodgeLunge || sk.afterimage || sk.layFrostFloor);
      const safeFullDesc = String(sk.desc || '').replace(/"/g, '&quot;');

      return `
        <button type="button" class="cb-skill-card path-${sk.path} elem-${sk.elem || 'phys'}${isGuardCard ? ' is-guard' : ''}${oppBadge ? ' opp-glow' : ''}${armedSkillId === sk.id ? ' is-armed' : ''}" data-sk="${sk.id}" title="${safeFullDesc}" ${disabled ? 'disabled' : ''}>
          <div>
            <div class="csc-head">
              <span class="csc-path">${keyHint}${pillPath}</span>
              <span class="csc-cost">AP ${apCost}${costMp > 0 ? ` · MP ${costMp}` : ''}</span>
            </div>
            <div class="csc-name-row">
              <span class="csc-name">${sk.name}</span>
              ${oppBadge}
              <span class="cb-arm-pill">再点施放</span>
            </div>
            <div class="csc-desc">${sk.shortDesc || sk.desc}</div>
          </div>
          <div class="csc-foot">
            <span>${usedUp ? '已使用' : cd > 0 ? `冷却 ${cd} 回合` : est ? (est.mirrorBlocked ? '将被镜冰格挡' : `预计 ~${est.dmg}${sk.aoe ? ' (全体)' : ''}`) : '战术护卫 / 步法'}</span>
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
          if (!btn.disabled) playCardHoverSfx();
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
        const enemyBatch = [];
        pxQueue.forEach(act => {
          if (act.waveIdx !== (b.waveIdx || 0)) return;
          if (act.type === 'enemy_attack') {
            enemyBatch.push(act);
          } else if (act.type === 'skill') {
            pxApi.playSkillAction(b, act);
          } else if (act.type === 'wand_toggle') {
            pxApi.playWandToggle();
          } else if (act.type === 'aino_spear') {
            pxApi.playAinoSpearSupport(act.enemyIdx);
          } else if (act.type === 'bond_assist') {
            pxApi.playBondAssist(act.charId);
          }
        });
        if (enemyBatch.length) {
          pxApi.playEnemySequence(b, enemyBatch);
        }
      }
    } else {
      if (b._pendingHitPulses && b._pendingHitPulses.length) {
        const pulses = b._pendingHitPulses.slice();
        b._pendingHitPulses.length = 0;
        pulses.forEach(pt => {
          const el = pt.side === 'player'
            ? document.getElementById('cb-p-portrait')
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

    try {
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('combat:statechange', { detail: getBattleState(b) }));
      }
    } catch (e) {}
  }

  function openIcePalaceModal() {
    const b = activeBattle;
    if (!b || !isPalaceReady(b) || typeof document === 'undefined') return;
    const slot = document.getElementById('cb-modal-slot');
    if (!slot) return;
    armedSkillId = null;
    const battleRoot = document.getElementById('battle-screen');
    if (battleRoot) battleRoot.classList.add('palace-timestop');
    const pCfg = getCurrentPalaceConfig(b);
    const shuffledClues = shuffleCopy(pCfg.clues || []);
    safeSfx('modal_open');

    const closeModal = withSfx => {
      slot.innerHTML = '';
      if (battleRoot) battleRoot.classList.remove('palace-timestop');
      if (withSfx !== false) safeSfx('modal_close');
    };

    const renderStep1 = () => {
      slot.innerHTML = `
        <div class="cb-palace-modal" id="cb-palace-modal">
          <div class="cb-palace-card" id="cb-palace-card">
            <div class="cp-head">
              ${CB_SVG.palaceFrostAccent}
              <div class="cp-head-left">
                <span class="cp-emblem" aria-hidden="true">${CB_SVG.palaceEmblem}</span>
                <h3 class="cp-title">冰晶宫殿 · 并行推演</h3>
              </div>
              <div class="cp-head-right">
                <div class="cp-steps" aria-label="推演进度：第 1 / 2 步">
                  <span class="cp-step-pip is-active"></span>
                  <span class="cp-step-pip"></span>
                </div>
                <button type="button" class="cp-close-x" id="cp-close-x" title="暂不消耗（返回战局）" aria-label="关闭冰晶宫殿">${CB_SVG.close}</button>
              </div>
            </div>
            <div class="cp-body">
              <div class="cp-scene-desc">${pCfg.sceneText}</div>
              <span class="cp-step-pill">第 1 / 2 步 · 锁定冰镜回放中的异常细节（选错将损耗 1 AP）</span>
              <div class="cp-options">
                ${shuffledClues.map((c, idx) => `
                  <button type="button" class="cp-opt-btn" data-clue="${c.id}">
                    <span class="cp-opt-idx" aria-hidden="true">${idx + 1}</span>
                    <span class="cp-opt-copy"><b>观察点 ${idx + 1}：</b>${c.text}</span>
                    <span class="cp-opt-arrow" aria-hidden="true">›</span>
                  </button>
                `).join('')}
              </div>
              <div class="end-btns">
                <button type="button" class="tbtn ghost" id="cp-cancel">暂不消耗（返回战局）</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const closeXBtn = slot.querySelector('#cp-close-x');
      if (closeXBtn) closeXBtn.onclick = () => closeModal(true);
      slot.querySelector('#cp-cancel').onclick = () => closeModal(true);
      slot.querySelectorAll('[data-clue]').forEach(btn => {
        btn.onclick = () => {
          const cid = btn.getAttribute('data-clue');
          const picked = (pCfg.clues || []).find(x => x.id === cid);
          if (!picked || !picked.correct) {
            const res = inspectClue(cid, null, b);
            renderFinalFeedback(res);
            return;
          }
          // 一旦点击第 1 步即锁定扣除本波审视机会，防止进入第 2 步后按 Esc 零成本白嫖答案与重刷洗牌！
          b.player.palaceLeft = Math.max(0, b.player.palaceLeft - 1);
          b.palacePendingStep2 = { clueId: cid };
          renderCombatUI();
          renderStep2(cid, picked.feedback);
        };
      });
    };

    const renderStep2 = (clueId, step1Feedback) => {
      const shuffledDeds = shuffleCopy(pCfg.deductions || []);
      const card = slot.querySelector('#cb-palace-card');
      card.innerHTML = `
        <div class="cp-head">
          ${CB_SVG.palaceFrostAccent}
          <div class="cp-head-left">
            <span class="cp-emblem" aria-hidden="true">${CB_SVG.palaceEmblem}</span>
            <h3 class="cp-title">冰晶宫殿 · 推演反制落点</h3>
          </div>
          <div class="cp-head-right">
            <div class="cp-steps" aria-label="推演进度：第 2 / 2 步">
              <span class="cp-step-pip is-done"></span>
              <span class="cp-step-pip is-active"></span>
            </div>
          </div>
        </div>
        <div class="cp-body">
          <div class="cp-scene-desc">${step1Feedback}</div>
          <span class="cp-step-pill">第 2 / 2 步 · 推导针对性破招手段</span>
          <div class="cp-options">
            ${shuffledDeds.map((d, idx) => `
              <button type="button" class="cp-opt-btn" data-ded="${d.id}">
                <span class="cp-opt-idx" aria-hidden="true">${idx + 1}</span>
                <span class="cp-opt-copy"><b>战术推演 ${idx + 1}：</b>${d.text}</span>
                <span class="cp-opt-arrow" aria-hidden="true">›</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      card.querySelectorAll('[data-ded]').forEach(btn => {
        btn.onclick = () => {
          const did = btn.getAttribute('data-ded');
          const res = inspectClue(clueId, did, b);
          renderFinalFeedback(res);
        };
      });
    };

    const renderFinalFeedback = res => {
      const card = slot.querySelector('#cb-palace-card');
      if (!card) return;
      if (res.correct) {
        card.classList.add('shatter-win');
        triggerPalaceFlash();
      }
      card.innerHTML = `
        <div class="cp-head">
          ${CB_SVG.palaceFrostAccent}
          <div class="cp-head-left">
            <span class="cp-emblem" aria-hidden="true">${CB_SVG.palaceEmblem}</span>
            <h3 class="cp-title">${res.correct ? '破绽推演完成' : '未能锁定真死角'}</h3>
          </div>
          <div class="cp-head-right">
            <div class="cp-steps" aria-label="推演完成">
              <span class="cp-step-pip is-done"></span>
              <span class="cp-step-pip ${res.correct ? 'is-done' : 'is-fail'}"></span>
            </div>
          </div>
        </div>
        <div class="cp-body">
          <div class="cp-scene-desc">${res.feedback || ''}</div>
          <div class="end-btns">
            <button type="button" class="tbtn" id="cp-confirm">回到交锋</button>
          </div>
        </div>
      `;
      const confirmBtn = card.querySelector('#cp-confirm');
      confirmBtn.onclick = () => {
        closeModal(true);
        renderCombatUI();
      };
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    };

    renderStep1();
  }

  function buildTacticalBreakdown(b) {
    const m = b.metrics || {};
    const p = b.player || {};
    const turns = b.turn || 1;
    const counters = (m.interrupts || 0) + (m.ripostes || 0);
    const manaRecycled = m.manaRecycled || 0;
    const isCrateStage = b.crateHp != null;
    const integrityLabel = isCrateStage ? '药箱完整度' : '护盾与生命完整度';
    const integrityPct = isCrateStage
      ? Math.max(0, Math.min(100, Math.round((b.crateHp / Math.max(1, b.crateMax || 100)) * 100)))
      : Math.max(0, Math.min(100, Math.round(((p.hp + Math.round((p.shield || 0) * 0.5)) / Math.max(1, p.mhp || 1)) * 100)));
    const tier = b.won ? (b.grade || 'B') : 'F';
    const tierLabelMap = { S: 'S 级 · 完美破局', A: 'A 级 · 稳健制胜', B: 'B 级 · 险中求胜', F: '失利 · 战术待修' };
    const tierLabel = tierLabelMap[tier] || '战术复盘';

    const parts = [];
    if (!b.won) {
      if (b.endReason === 'rowan_escaped') {
        parts.push('合围封锁度尚未蓄满便耗空目标生命，罗文借晦轮杖化雾脱身；须先铺蔓地薄冰卡窄道并合拢双镜夹杖。');
      } else if (b.endReason === 'crate_destroyed') {
        parts.push('医疗药箱在持续冲撞下失守；面对蓄力撞箱回合应及时立起钢冰生根盾协防，并以隔空瞬凝截断蓄势。');
      } else if (b.endReason === 'exposed') {
        parts.push('耳目近在咫尺之际魔力外显过高，招致巡查逼近；第二波多以霁馆剑步与覆水剑锋收束魔力痕迹。');
      } else if (b.endReason === 'enemy_three_hits') {
        parts.push('正面硬攻屡遭无气泡镜冰反刺丢分；静待对手双手压地空档再出隔空瞬凝，配合冰宫看破即可抢满三击。');
      } else if (m.phase2Triggered) {
        parts.push('已成功逼出敌将二阶段变阵，终盘却在高压杀招下受挫；转阶段后须预留行动点截断封锁咏唱，或以生根步迎锋反制。');
      } else {
        parts.push(`本场仅完成 ${counters} 次破招反制，正面承受了过多蓄力重击；紧盯敌方意图横幅并切换克制路径即可扭转局面。`);
      }
    } else {
      if (tier === 'S') {
        parts.push(m.phase2Triggered
          ? `直面敌将二阶段高压变阵仍于 ${turns} 回合内干脆定局，攻防节拍严丝合缝。`
          : `全战仅耗 ${turns} 回合便彻底瓦解敌阵，节奏掌控老练果决。`);
      } else if (tier === 'A') {
        parts.push(`历时 ${turns} 回合稳健取胜，关键机制应对得当，仍有压缩回合与提速收尾的余地。`);
      } else {
        parts.push(`耗时 ${turns} 回合艰难过关，中盘承压略重；若更早抢占破招与看破窗口，战损会显著收敛。`);
      }

      if (counters >= 2) {
        parts.push(`累计达成 ${counters} 次破招与闪反（破招 ${m.interrupts || 0}、闪反 ${m.ripostes || 0}），精准掐断敌方发力链条。`);
      } else if (m.manaFizzleWin) {
        parts.push('以走位封锁榨干对手魔力池令狂岚自行溃散，凭借谋略轻松制敌。');
      } else {
        parts.push(`主动反制偏少（${counters} 次），多针对双手控场与贴身突袭切换克制技可再提一层上限。`);
      }

      if (p.hasManaCycle && manaRecycled >= 120) {
        parts.push(`魔战循环合计回流 ${manaRecycled} MP，魔力增幅爆发衔接极为流畅。`);
      } else if (m.insights > 0) {
        parts.push('冰晶宫殿并行推演直击死角，为破阵打开了决定性缺口。');
      } else if (p.palaceMax > 0 && tier !== 'S') {
        parts.push('全程凭借基本功力克强敌；若于第二回合起展开冰晶宫殿看破弱点，可更从容摘下 S 级。');
      } else if (p.palaceMax > 0) {
        parts.push('全程未启冰晶宫殿仍凭纯熟基本功摘得 S 级，临场判断无懈可击。');
      }

      if (isCrateStage) {
        parts.push(integrityPct >= 80
          ? `医疗药箱完整度守在 ${integrityPct}%，前线补给线固若金汤。`
          : `药箱完整度滑落至 ${integrityPct}%，护箱回合的生根盾与破招衔接仍有补强空间。`);
      } else if (integrityPct < 45) {
        parts.push(`终盘防线完整度仅余 ${integrityPct}%，面对高伤蓄力宜多借护盾或风行残像化解。`);
      }
    }

    return {
      turns,
      counters,
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
    const warnHtml = b.exposureWarningTriggered
      ? `<div class="cr-warn-box">${CB_SVG.warn} <b>行踪暴露代价触发：</b>耳目附近的外显冰系/晦轮杖波动已被「极光」小队察觉，「北林哑巴幽灵」传闻发酵，本次评级封顶为 B！</div>`
      : '';

    let rewardText = '';
    if (b.won) {
      if (b.fromArena) {
        rewardText = '独立演武沙盒挑战完成！战绩已记入演武榜（沙盒模式不改动主线存档数值）。';
      } else {
        rewardText = `获得实战收益：${rew.skillName ? `习得「<b>${rew.skillName}</b>」 · ` : ''}经验 +${rew.exp || 30}${rew.gold ? ` · 银币 +${rew.gold}` : ''}`;
      }
    } else {
      rewardText = b.endReason === 'rowan_escaped'
        ? '失利原因：未满 100% 合围封锁便打空罗文生命，致其借晦轮杖化雾遁逃！'
        : '战术提示：紧盯敌方架势预告，切忌无脑复读单招或原地龟缩叠盾！';
    }

    const gradeKey = b.won ? (b.grade || 'B') : 'F';
    const stageAge = (b.fromArena && b.stageCfg && b.stageCfg.preset && b.stageCfg.preset.age) || null;
    const isVol3Disguise = VOL3_DISGUISE_STAGES.has(b.id) || (b.player && b.player.name && b.player.name.includes('眷寒渔'));
    const sylviaResImg = resolveCharImg('sylvia', b.won ? 'smile' : 'serious', stageAge, { disguise: isVol3Disguise });
    const sylviaAlt = (b.player && b.player.name) ? b.player.name : '希尔维亚';
    slot.innerHTML = `
      <div class="cb-result-modal" id="cb-result-modal">
        <div class="cb-result-card${b.won ? ' is-victory' : ' is-defeat'}">
          <div class="cr-head">
            <div class="cr-head-left">
              ${sylviaResImg ? `<div class="cr-portrait-badge ${b.won ? 'is-win' : 'is-loss'}"><img src="${sylviaResImg}" alt="${sylviaAlt}"/></div>` : ''}
              <div class="cr-head-copy">
                <span class="cr-status-badge ${b.won ? 'is-win' : 'is-loss'}">${b.won ? '战术制胜' : '战局失利'}</span>
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
                <div class="crtb-cell"><span>截断破招</span><b>${b.metrics.interrupts} 次</b></div>
                <div class="crtb-cell"><span>剑步闪反</span><b>${b.metrics.ripostes} 次</b></div>
                <div class="crtb-cell"><span>冰宫看破</span><b>${b.metrics.insights} 次</b></div>
                <div class="crtb-cell"><span>魔战回蓝</span><b>+${tb.manaRecycled} MP</b></div>
                <div class="crtb-cell"><span>${tb.integrityLabel}</span><b>${tb.integrityPct}%</b></div>
              </div>
              <div class="crtb-commentary">${tb.commentary}</div>
            </div>
            ${warnHtml}
            <p class="cr-reward-note">${rewardText}</p>
            <div class="end-btns">
              <button type="button" class="tbtn ghost" id="cr-retry">再次演练</button>
              <button type="button" class="tbtn" id="cr-done">确认返回</button>
            </div>
          </div>
        </div>
      </div>
    `;

    slot.querySelector('#cr-retry').onclick = () => {
      slot.innerHTML = '';
      safeSfx('modal_close');
      if (STAGE_CONFIGS[b.id]) {
        startStage(b.id, { fromArena: b.fromArena, done: b.done });
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
    activeBattle = null;
    hoveredSkillId = null;
    armedSkillId = null;
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
    const bs = document.getElementById('battle-screen');
    if (bs) {
      bs.classList.add('hidden');
      bs.classList.remove('palace-timestop', 'wand-refract', 'hit-shake', 'heavy-shake');
    }
    if (document.body) document.body.classList.remove('cb-battle-active');
    const ds = document.getElementById('duel-screen');
    if (ds) ds.classList.add('hidden');

    if (opts.silent) {
      const ao = document.getElementById('arena-overlay');
      if (ao) ao.classList.add('hidden');
      return;
    }

    if (b && b.fromArena) {
      if (arenaReturnToTitle) {
        if (typeof global.bgmStop === 'function') global.bgmStop(false);
        if (typeof global.setBG === 'function') global.setBG('bg-title');
      } else {
        if (typeof global.bgmRestoreScene === 'function') global.bgmRestoreScene();
        const curS = getGameS();
        if (curS && curS.freeRoam && typeof global.updateLocBar === 'function') global.updateLocBar();
      }
      openArenaHub({ fromTitle: arenaReturnToTitle });
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
     9. ⚔️ 战术演武场独立沙盒大厅
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
                <p class="arena-hub-sub">按原著时间线还原 ${list.length} 场代表性关卡 · 独立试炼沙盒（不污染主线存档等级与银币）</p>
              </div>
            </div>
            <button type="button" class="arena-close-x" id="am-close" title="关闭演武大厅" aria-label="关闭演武大厅">${CB_SVG.close}</button>
          </div>
          <div class="arena-mode-bar">
            <span class="arena-sandbox-pill">${CB_SVG.shield} 独立沙盒 · 零存档污染</span>
            <div class="arena-mode-group">
              <button type="button" class="arena-mode-chip${!arenaUseSaveStats ? ' active' : ''}" id="am-preset">${CB_SVG.scale} 原著时期标准配装</button>
              <button type="button" class="arena-mode-chip${arenaUseSaveStats ? ' active' : ''}" id="am-save" ${arenaReturnToTitle ? 'disabled title="进入存档后可检验当前构筑"' : ''}>${CB_SVG.chart} 当前存档属性试演</button>
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
                      ${isBossTrial ? '<span class="asc-boss-seal">BOSS · 决战</span>' : ''}
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
                      ${st.tags.map(t => `<span class="asc-tag${t.includes('禁') || t.includes('失败') || t.includes('绕过') || t.includes('二阶段') ? ' warn' : ''}">${t}</span>`).join('')}
                    </div>
                    <div class="asc-desc">${st.summary}</div>
                  </div>
                  <div class="asc-foot">
                    <span>${rec ? `最佳记录：${rec.grade} 级（${rec.turns} 回合）` : '尚未通关'}</span>
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
    if (!opts._silentOpen) safeSfx('modal_open');

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
        if (api.setArenaSandboxRelics) api.setArenaSandboxRelics([]);
        if (api.setArenaSandboxAssist) api.setArenaSandboxAssist(null);
        safeSfx('tab_switch');
        openArenaHub({ fromTitle: arenaReturnToTitle, _silentOpen: true });
      };
    }
    ov.querySelectorAll('[data-stage]').forEach(btn => {
      btn.onclick = () => {
        const sid = btn.getAttribute('data-stage');
        ov.classList.add('hidden');
        startStage(sid, { fromArena: true });
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
      if (typeof global.bgmStop === 'function') global.bgmStop(false);
      if (typeof global.setBG === 'function') global.setBG('bg-title');
      const ts = document.getElementById('title-screen');
      if (ts) ts.classList.remove('hidden');
    }
  }

  /* =========================================================
     10. 启动入口、主线虚拟决斗原著门控与无头仿真器
     ========================================================= */
  function resetBattleDomForStart(bs) {
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
    bs.classList.remove('palace-timestop', 'wand-refract', 'hit-shake', 'heavy-shake', 'hidden');
  }

  function startStage(stageId, opts) {
    opts = opts || {};
    const sc = STAGE_CONFIGS[stageId];
    if (!sc) return null;

    const b = createBattleState(sc, opts);
    activeBattle = b;
    hoveredSkillId = null;
    armedSkillId = null;
    if (typeof global !== 'undefined') global.B = b;

    if (!b.headless && typeof document !== 'undefined') {
      clearAllJuiceVfx();
      if (typeof window !== 'undefined' && typeof window.closeHudMoreDrawer === 'function') window.closeHudMoreDrawer();
      const ds = document.getElementById('duel-screen');
      if (ds) ds.classList.add('hidden');
      if (typeof global.setBG === 'function') global.setBG(sc.bg || 'bg-battle');
      if (typeof global.bgmPlayType === 'function') global.bgmPlayType('battle', { force: true });
      const bs = ensureBattleDOM();
      resetBattleDomForStart(bs);
      if (document.body) document.body.classList.add('cb-battle-active');
      renderCombatUI();
    }
    return b;
  }

  function startCustomOrStageBattle(cfg, done) {
    cfg = cfg || {};
    if (typeof window !== 'undefined' && typeof window.closeHudMoreDrawer === 'function') window.closeHudMoreDrawer();
    if (cfg.stageId && STAGE_CONFIGS[cfg.stageId]) {
      return startStage(cfg.stageId, {
        done,
        fromArena: !!cfg.fromArena,
        usePreset: !!cfg.usePreset,
        fullRestore: !!cfg.fullRestore,
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
      bg: 'bg-battle',
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
              trait: t.desc || '留意双手蓄势空档与贴身扑击。',
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
    if (typeof global.setBG === 'function') global.setBG('bg-battle');
    if (typeof global.bgmPlayType === 'function') global.bgmPlayType('battle', { force: true });
    const bs = ensureBattleDOM();
    resetBattleDomForStart(bs);
    if (typeof document !== 'undefined' && document.body) document.body.classList.add('cb-battle-active');
    renderCombatUI();
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
    (b.enemies || []).forEach((e, idx) => {
      if (!e || e.hp <= 0) return;
      const eBaseAv = e.baseAv || computeBaseAv(e.spd || 95);
      units.push({
        id: e.id || `enemy_${idx}`,
        side: 'enemy',
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

    const queue = [];
    let cumAv = 0;
    for (let step = 0; step < total && units.length > 0; step++) {
      let best = units[0];
      for (let i = 1; i < units.length; i++) {
        const u = units[i];
        if (u.simAv < best.simAv || (u.simAv === best.simAv && u.side === 'player' && best.side !== 'player')) {
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
        enemyIdx: best.enemyIdx,
        name: best.name,
        charId: best.charId,
        av: Math.round(cumAv),
        deltaAv: Math.round(delta),
        spd: best.spd,
        baseAv: best.baseAv,
        isOneMore: step === 0 && best.side === 'player' && best.isOneMore,
        broken: best.broken,
        locks: best.locks,
        maxLocks: best.maxLocks,
        intentStance: best.intentStance || null,
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
    const ampPct = syncPlayerAmpFromMode(p);
    const ampTier = getAmpTierInfo(ampPct);
    const staffDef = getEquippedStaffDef(p);
    const primary = getPrimaryAliveEnemy(b);
    return {
      id: b.id,
      battleInstanceId: b.battleInstanceId || 0,
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
      oneMoreActive: !!b.oneMoreActive,
      oneMoreUsedThisTurn: !!b.oneMoreUsedThisTurn,
      player: {
        name: p.name,
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
        overcastMode: p.overcastMode || 0,
        ampPct,
        ampTier,
        hasEclipseWand: !!p.hasEclipseWand,
        wandActive: !!p.wandActive,
        wandPersistent: !!p.wandPersistent,
        wandCooldown: p.wandCooldown || 0,
        equippedStaff: p.equippedStaff || (p.wandActive ? 'eclipse_wand' : 'none'),
        staffName: staffDef.name,
        canTriggerEclipse: false,
        palaceLeft: p.palaceLeft || 0,
        palaceMax: p.palaceMax || 0,
        palaceReady: isPalaceReady(b),
        bondAssist: p.bondAssist || null,
        bondAssistUsed: !!p.bondAssistUsed,
        status: Object.assign({}, p.status),
        cooldowns: Object.assign({}, p.cooldowns),
        skills: (p.skills || []).map(skId => {
          const sk = TACTICAL_SKILLS[skId];
          if (!sk) return null;
          const apCost = computeSkillApCost(b, sk);
          const mpCost = computeSkillMpCost(p, sk);
          const cd = p.cooldowns[skId] || 0;
          const usedUp = !!(sk.maxUses && (p.usedMaxSkills[skId] || 0) >= sk.maxUses);
          const canUse = !b.over && !usedUp && cd === 0 && b.ap >= apCost && p.mp >= mpCost;
          const forecast = primary ? computeTacticalForecast(b, sk, primary) : null;
          return {
            id: sk.id,
            name: sk.name,
            path: sk.path,
            elem: sk.elem,
            apCost,
            mpCost,
            cooldown: cd,
            usedUp,
            canUse,
            overcastCap: getSkillOvercastCap(sk),
            lockDamage: forecast ? forecast.lockDamage : getSkillBaseLockDamage(sk),
            forecast,
          };
        }).filter(Boolean),
      },
      enemies: (b.enemies || []).map((e, idx) => ({
        idx,
        id: e.id || `enemy_${idx}`,
        name: e.name,
        charId: e.charId || null,
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
      balance: COMBAT_BALANCE_V22,
    };
  }

  function useSkillById(skillId, targetIdx, b) {
    return useSkill(skillId, targetIdx, b);
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
      bondAssist: opts.bondAssist,
      forceCrit: opts.forceCrit,
    });
    if (opts.noPalace) {
      b.player.palaceMax = 0;
      b.player.palaceLeft = 0;
    }
    let safety = 0;
    while (!b.over && b.turn <= maxTurns && safety++ < 400) {
      const action = policyFn(b, CombatEngine);
      if (!action || action.type === 'endTurn') {
        endTurn(b);
      } else if (action.type === 'palace') {
        const pRes = inspectClue(action.clueId, action.deductionId, b);
        if (!pRes.ok) {
          endTurn(b);
        }
      } else if (action.type === 'overcast') {
        setOvercast(action.mode, b);
      } else if (action.type === 'amp') {
        setAmpPct(action.pct, b);
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
    COMBAT_BALANCE_V22,
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
    setOvercast,
    setAmpPct,
    setEquippedStaff,
    selectTarget,
    toggleEclipseWand,
    useBondAssist,
    isPalaceReady,
    inspectClue,
    useSkill,
    useSkillById,
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

  // 故事内虚拟决斗：严格保留原著「已习得 virtual_duel 且了解度 >= 90%」门控！
  global.openDuelMenu = function () {
    const curS = getGameS();
    if (!curS || !(curS.skills || []).includes('virtual_duel')) {
      if (typeof global.toast === 'function') global.toast('尚未掌握「虚拟决斗」（可点右上角 ⚔️ 进入独立战术演武沙盒）');
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

    // 键盘系统：绝不吞掉焦点按钮原生的 Enter/Space，同时支持 1~9 / Q / W / R / E 战术热键与防穿透
    document.addEventListener('keydown', e => {
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
        const pm = document.getElementById('cb-palace-modal');
        if (pm && pm.parentNode) {
          if (activeBattle && activeBattle.palacePendingStep2) {
            delete activeBattle.palacePendingStep2;
            pushLog(activeBattle, logTag('cbl-danger', '❄️【冰晶宫殿·中断】你在第 2 步主动散去了冰镜推演（本波审视机会已消耗）。'));
            renderCombatUI();
          }
          pm.parentNode.innerHTML = '';
          if (bs) bs.classList.remove('palace-timestop');
          safeSfx('modal_close');
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
          return;
        }
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

      // 战斗进行中且无模态弹窗时的战术快捷键
      if (battleVis && activeBattle && !activeBattle.over && !document.getElementById('cb-palace-modal')) {
        if (e.key >= '1' && e.key <= '9') {
          const cards = bs.querySelectorAll('#b-actions .cb-skill-card');
          const pick = cards[Number(e.key) - 1];
          if (pick && !pick.disabled) {
            pick.click();
            e.stopPropagation();
          }
        } else if (e.key === 'q' || e.key === 'Q') {
          const pb = document.getElementById('cb-btn-palace');
          if (pb && !pb.disabled) { pb.click(); e.stopPropagation(); }
        } else if (e.key === 'w' || e.key === 'W') {
          if (activeBattle.player.hasManaCycle) {
            setOvercast((activeBattle.player.overcastMode + 1) % 3);
            e.stopPropagation();
          }
        } else if (e.key === 'r' || e.key === 'R') {
          const wb = document.getElementById('cb-btn-wand');
          if (wb && !wb.classList.contains('hidden') && !wb.disabled) { wb.click(); e.stopPropagation(); }
        } else if (e.key === 'f' || e.key === 'F') {
          const ab = document.getElementById('cb-btn-assist');
          if (ab && !ab.classList.contains('hidden') && !ab.disabled) { ab.click(); e.stopPropagation(); }
        } else if (e.key === 'e' || e.key === 'E') {
          endTurn();
          e.stopPropagation();
        }
      }
    }, true);
  }
})(typeof window !== 'undefined' ? window : globalThis);
