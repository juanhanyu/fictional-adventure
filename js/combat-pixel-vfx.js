/* =====================================================================
   《转生千金》60fps 像素战斗精灵动画 × patch-gg/pixelfx 法术特效引擎
   (js/combat-pixel-vfx.js)
   导出：window.CombatPixelVFX
   - 15 套 Sea of Stars 风格 7 帧零 PNG 像素精灵注册表与状态机
     [0:idle1, 1:idle2, 2:blink, 3:windup, 4:cast_step, 5:strike, 6:hurt]
   - 全舞台低分辨率像素缓冲 Canvas 2D (#cb-pixel-vfx-canvas) 实时透明合成 27 种 pixelfx
   - game-feel 质感：真时钟 Hit-Stop 计数保护、创伤震屏、冲刺残影、挤压回弹与降动效护栏
   ===================================================================== */
(function (global) {
  'use strict';

  /* -------------------- 环境与无障碍判定 -------------------- */
  function isJsdomEnv() {
    try {
      const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
      return /jsdom/i.test(ua);
    } catch (e) {
      return false;
    }
  }

  let _reducedMotionCache = null;
  let _reducedMotionMql = null;
  function prefersReducedMotion() {
    if (_reducedMotionCache !== null) return _reducedMotionCache;
    try {
      if (typeof global !== 'undefined' && typeof global.matchMedia === 'function') {
        _reducedMotionMql = global.matchMedia('(prefers-reduced-motion: reduce)');
        _reducedMotionCache = !!_reducedMotionMql.matches;
        const onChange = ev => { _reducedMotionCache = !!(ev && ev.matches); };
        if (typeof _reducedMotionMql.addEventListener === 'function') {
          _reducedMotionMql.addEventListener('change', onChange);
        } else if (typeof _reducedMotionMql.addListener === 'function') {
          _reducedMotionMql.addListener(onChange);
        }
        return _reducedMotionCache;
      }
    } catch (e) {}
    _reducedMotionCache = false;
    return false;
  }

  function isEnabled() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (isJsdomEnv()) return false;
    return true;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  const EASE = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: t => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };

  /* -------------------- 15 套 Sea of Stars 7 帧像素精灵完整清单（动态同步 PIXEL_SPRITE_BANK） -------------------- */
  const SPRITE_MANIFEST = {
    sylvia_young: {
      id: 'sylvia_young',
      file: 'assets/sprites/sylvia_young_sheet.png',
      metaFile: 'assets/sprites/sylvia_young_meta.json',
      frames: 10,
      frameW: 126,
      frameH: 118,
      facing: 'right',
      anchorX: 63 / 126,
      anchorY: 114 / 118,
      castX: 120 / 126,
      castY: 61 / 118,
      hitX: 63 / 126,
      hitY: 66 / 118,
      headX: 63 / 126,
      headY: 33 / 118,
      scaleMult: 1.0,
      shadowW: 54,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    sylvia_silver: {
      id: 'sylvia_silver',
      file: 'assets/sprites/sylvia_silver_sheet.png',
      metaFile: 'assets/sprites/sylvia_silver_meta.json',
      frames: 10,
      frameW: 142,
      frameH: 124,
      facing: 'right',
      anchorX: 71 / 142,
      anchorY: 120 / 124,
      castX: 136 / 142,
      castY: 64 / 124,
      hitX: 71 / 142,
      hitY: 69 / 124,
      headX: 71 / 142,
      headY: 34 / 124,
      scaleMult: 1.0,
      shadowW: 56,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    sylvia_disguise: {
      id: 'sylvia_disguise',
      file: 'assets/sprites/sylvia_disguise_sheet.png',
      metaFile: 'assets/sprites/sylvia_disguise_meta.json',
      frames: 12,
      frameW: 140,
      frameH: 126,
      facing: 'right',
      anchorX: 70 / 140,
      anchorY: 122 / 126,
      castX: 134 / 140,
      castY: 65 / 126,
      hitX: 70 / 140,
      hitY: 70 / 126,
      headX: 70 / 140,
      headY: 35 / 126,
      scaleMult: 1.0,
      shadowW: 56,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    beatrice: {
      id: 'beatrice',
      file: 'assets/sprites/beatrice_sheet.png',
      metaFile: 'assets/sprites/beatrice_meta.json',
      frames: 9,
      frameW: 130,
      frameH: 120,
      facing: 'left',
      anchorX: 65 / 130,
      anchorY: 116 / 120,
      castX: 6 / 130,
      castY: 62 / 120,
      hitX: 65 / 130,
      hitY: 67 / 120,
      headX: 65 / 130,
      headY: 33 / 120,
      scaleMult: 1.0,
      shadowW: 58,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    alice: {
      id: 'alice',
      file: 'assets/sprites/alice_sheet.png',
      metaFile: 'assets/sprites/alice_meta.json',
      frames: 7,
      frameW: 126,
      frameH: 116,
      facing: 'left',
      anchorX: 63 / 126,
      anchorY: 112 / 116,
      castX: 6 / 126,
      castY: 60 / 116,
      hitX: 63 / 126,
      hitY: 64 / 116,
      headX: 63 / 126,
      headY: 32 / 116,
      scaleMult: 1.0,
      shadowW: 54,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    aino: {
      id: 'aino',
      file: 'assets/sprites/aino_sheet.png',
      metaFile: 'assets/sprites/aino_meta.json',
      frames: 7,
      frameW: 138,
      frameH: 124,
      facing: 'left',
      anchorX: 69 / 138,
      anchorY: 120 / 124,
      castX: 6 / 138,
      castY: 64 / 124,
      hitX: 69 / 138,
      hitY: 69 / 124,
      headX: 69 / 138,
      headY: 34 / 124,
      scaleMult: 1.0,
      shadowW: 56,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    noelle: {
      id: 'noelle',
      file: 'assets/sprites/noelle_sheet.png',
      metaFile: 'assets/sprites/noelle_meta.json',
      frames: 7,
      frameW: 138,
      frameH: 124,
      facing: 'left',
      anchorX: 69 / 138,
      anchorY: 120 / 124,
      castX: 6 / 138,
      castY: 64 / 124,
      hitX: 69 / 138,
      hitY: 69 / 124,
      headX: 69 / 138,
      headY: 34 / 124,
      scaleMult: 1.0,
      shadowW: 56,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    rowan: {
      id: 'rowan',
      file: 'assets/sprites/rowan_sheet.png',
      metaFile: 'assets/sprites/rowan_meta.json',
      frames: 7,
      frameW: 146,
      frameH: 134,
      facing: 'left',
      anchorX: 73 / 146,
      anchorY: 130 / 134,
      castX: 6 / 146,
      castY: 69 / 134,
      hitX: 73 / 146,
      hitY: 75 / 134,
      headX: 73 / 146,
      headY: 37 / 134,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    wind_god_avatar: {
      id: 'wind_god_avatar',
      file: 'assets/sprites/wind_god_avatar_sheet.png',
      metaFile: 'assets/sprites/wind_god_avatar_meta.json',
      frames: 7,
      frameW: 146,
      frameH: 134,
      facing: 'left',
      anchorX: 73 / 146,
      anchorY: 130 / 134,
      castX: 6 / 146,
      castY: 69 / 134,
      hitX: 73 / 146,
      hitY: 75 / 134,
      headX: 73 / 146,
      headY: 37 / 134,
      scaleMult: 1.0,
      shadowW: 54,
      floatAmp: 3.2,
      archetype: 'boss',
    },
    eastwing_commander: {
      id: 'eastwing_commander',
      file: 'assets/sprites/eastwing_commander_sheet.png',
      metaFile: 'assets/sprites/eastwing_commander_meta.json',
      frames: 9,
      frameW: 150,
      frameH: 136,
      facing: 'left',
      anchorX: 75 / 150,
      anchorY: 132 / 136,
      castX: 6 / 150,
      castY: 70 / 136,
      hitX: 75 / 150,
      hitY: 76 / 136,
      headX: 75 / 150,
      headY: 38 / 136,
      scaleMult: 1.0,
      shadowW: 62,
      floatAmp: 0,
      archetype: 'boss',
    },
    corridor_vanguard: {
      id: 'corridor_vanguard',
      file: 'assets/sprites/corridor_vanguard_sheet.png',
      metaFile: 'assets/sprites/corridor_vanguard_meta.json',
      frames: 7,
      frameW: 146,
      frameH: 134,
      facing: 'left',
      anchorX: 73 / 146,
      anchorY: 130 / 134,
      castX: 6 / 146,
      castY: 69 / 134,
      hitX: 73 / 146,
      hitY: 75 / 134,
      headX: 73 / 146,
      headY: 37 / 134,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    wolf_alpha: {
      id: 'wolf_alpha',
      file: 'assets/sprites/wolf_alpha_sheet.png',
      metaFile: 'assets/sprites/wolf_alpha_meta.json',
      frames: 7,
      frameW: 166,
      frameH: 118,
      facing: 'left',
      anchorX: 83 / 166,
      anchorY: 114 / 118,
      castX: 6 / 166,
      castY: 61 / 118,
      hitX: 83 / 166,
      hitY: 66 / 118,
      headX: 83 / 166,
      headY: 33 / 118,
      scaleMult: 1.0,
      shadowW: 76,
      floatAmp: 0,
      archetype: 'beast',
    },
    pack_wolf: {
      id: 'pack_wolf',
      file: 'assets/sprites/pack_wolf_sheet.png',
      metaFile: 'assets/sprites/pack_wolf_meta.json',
      frames: 7,
      frameW: 158,
      frameH: 114,
      facing: 'left',
      anchorX: 79 / 158,
      anchorY: 110 / 114,
      castX: 6 / 158,
      castY: 59 / 114,
      hitX: 79 / 158,
      hitY: 63 / 114,
      headX: 79 / 158,
      headY: 31 / 114,
      scaleMult: 1.0,
      shadowW: 74,
      floatAmp: 0,
      archetype: 'beast',
    },
    shadow_jackal: {
      id: 'shadow_jackal',
      file: 'assets/sprites/shadow_jackal_sheet.png',
      metaFile: 'assets/sprites/shadow_jackal_meta.json',
      frames: 7,
      frameW: 158,
      frameH: 118,
      facing: 'left',
      anchorX: 79 / 158,
      anchorY: 114 / 118,
      castX: 6 / 158,
      castY: 61 / 118,
      hitX: 79 / 158,
      hitY: 66 / 118,
      headX: 79 / 158,
      headY: 33 / 118,
      scaleMult: 1.0,
      shadowW: 74,
      floatAmp: 0,
      archetype: 'beast',
    },
    abyss_behemoth: {
      id: 'abyss_behemoth',
      file: 'assets/sprites/abyss_behemoth_sheet.png',
      metaFile: 'assets/sprites/abyss_behemoth_meta.json',
      frames: 7,
      frameW: 178,
      frameH: 130,
      facing: 'left',
      anchorX: 89 / 178,
      anchorY: 126 / 130,
      castX: 6 / 178,
      castY: 67 / 130,
      hitX: 89 / 178,
      hitY: 72 / 130,
      headX: 89 / 178,
      headY: 36 / 130,
      scaleMult: 0.94,
      shadowW: 78,
      floatAmp: 0,
      archetype: 'boss',
    },
    reno: {
      id: 'reno',
      file: 'assets/sprites/reno_sheet.png',
      metaFile: 'assets/sprites/reno_meta.json',
      frames: 11,
      frameW: 146,
      frameH: 134,
      facing: 'right',
      anchorX: 73 / 146,
      anchorY: 130 / 134,
      castX: 140 / 146,
      castY: 69 / 134,
      hitX: 73 / 146,
      hitY: 75 / 134,
      headX: 73 / 146,
      headY: 37 / 134,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    charlotte: {
      id: 'charlotte',
      file: 'assets/sprites/charlotte_sheet.png',
      metaFile: 'assets/sprites/charlotte_meta.json',
      frames: 7,
      frameW: 138,
      frameH: 124,
      facing: 'right',
      anchorX: 69 / 138,
      anchorY: 120 / 124,
      castX: 132 / 138,
      castY: 64 / 124,
      hitX: 69 / 138,
      hitY: 69 / 124,
      headX: 69 / 138,
      headY: 34 / 124,
      scaleMult: 1.0,
      shadowW: 56,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    jilan: {
      id: 'jilan',
      file: 'assets/sprites/jilan_sheet.png',
      metaFile: 'assets/sprites/jilan_meta.json',
      frames: 7,
      frameW: 138,
      frameH: 124,
      facing: 'right',
      anchorX: 69 / 138,
      anchorY: 120 / 124,
      castX: 132 / 138,
      castY: 64 / 124,
      hitX: 69 / 138,
      hitY: 69 / 124,
      headX: 69 / 138,
      headY: 34 / 124,
      scaleMult: 1.0,
      shadowW: 56,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    flame_mage: {
      id: 'flame_mage',
      file: 'assets/sprites/flame_mage_sheet.png',
      metaFile: 'assets/sprites/flame_mage_meta.json',
      frames: 7,
      frameW: 146,
      frameH: 134,
      facing: 'left',
      anchorX: 73 / 146,
      anchorY: 130 / 134,
      castX: 6 / 146,
      castY: 69 / 134,
      hitX: 73 / 146,
      hitY: 75 / 134,
      headX: 73 / 146,
      headY: 37 / 134,
      scaleMult: 1.0,
      shadowW: 58,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    tundra_brute: {
      id: 'tundra_brute',
      file: 'assets/sprites/tundra_brute_sheet.png',
      metaFile: 'assets/sprites/tundra_brute_meta.json',
      frames: 7,
      frameW: 170,
      frameH: 124,
      facing: 'left',
      anchorX: 85 / 170,
      anchorY: 120 / 124,
      castX: 6 / 170,
      castY: 64 / 124,
      hitX: 85 / 170,
      hitY: 69 / 124,
      headX: 85 / 170,
      headY: 34 / 124,
      scaleMult: 0.94,
      shadowW: 78,
      floatAmp: 0,
      archetype: 'beast',
    },
    frost_hound: {
      id: 'frost_hound',
      file: 'assets/sprites/frost_hound_sheet.png',
      metaFile: 'assets/sprites/frost_hound_meta.json',
      frames: 7,
      frameW: 162,
      frameH: 118,
      facing: 'left',
      anchorX: 81 / 162,
      anchorY: 114 / 118,
      castX: 6 / 162,
      castY: 61 / 118,
      hitX: 81 / 162,
      hitY: 66 / 118,
      headX: 81 / 162,
      headY: 33 / 118,
      scaleMult: 1.0,
      shadowW: 74,
      floatAmp: 0,
      archetype: 'beast',
    },
    ridge_claw: {
      id: 'ridge_claw',
      file: 'assets/sprites/ridge_claw_sheet.png',
      metaFile: 'assets/sprites/ridge_claw_meta.json',
      frames: 7,
      frameW: 162,
      frameH: 118,
      facing: 'left',
      anchorX: 81 / 162,
      anchorY: 114 / 118,
      castX: 6 / 162,
      castY: 61 / 118,
      hitX: 81 / 162,
      hitY: 66 / 118,
      headX: 81 / 162,
      headY: 33 / 118,
      scaleMult: 1.0,
      shadowW: 72,
      floatAmp: 0,
      archetype: 'beast',
    },
  };

  const ENEMY_SPRITE_ALIAS = {
    beatrice: 'beatrice',
    beatrice_11: 'beatrice',
    alice: 'alice',
    alice_9: 'alice',
    aino: 'aino',
    aino_sparring: 'aino',
    noelle: 'noelle',
    noelle_14: 'noelle',
    rowan: 'rowan',
    rowan_eclipse: 'rowan',
    rowan_graveyard: 'rowan',
    wind_god_avatar: 'wind_god_avatar',
    wind_god_tempest: 'wind_god_avatar',
    wind_god_boss: 'wind_god_avatar',
    wind_god_eye: 'wind_god_avatar',
    wind_god: 'wind_god_avatar',
    fengshen: 'wind_god_avatar',
    eastwing_commander: 'eastwing_commander',
    eastwing_boss: 'eastwing_commander',
    eastwing: 'eastwing_commander',
    turning_point_corridor: 'eastwing_commander',
    corridor_vanguard: 'corridor_vanguard',
    inquisitor: 'corridor_vanguard',
    flame_mage_a: 'flame_mage',
    flame_mage: 'flame_mage',
    slime_fire: 'flame_mage',
    wolf_alpha: 'wolf_alpha',
    wolf_king: 'wolf_alpha',
    north_forest_hunt: 'wolf_alpha',
    wolf_b: 'pack_wolf',
    wolf_c: 'pack_wolf',
    wolf_d: 'pack_wolf',
    pack_wolf: 'pack_wolf',
    wolf: 'pack_wolf',
    frost_hound_a: 'frost_hound',
    frost_hound_b: 'frost_hound',
    frost_hound: 'frost_hound',
    ice_wolf: 'frost_hound',
    shadow_jackal: 'shadow_jackal',
    jackal: 'shadow_jackal',
    ridge_claw: 'ridge_claw',
    jackal_minor: 'ridge_claw',
    abyss_behemoth: 'abyss_behemoth',
    tundra_brute: 'tundra_brute',
    hulan_brute: 'tundra_brute',
    hulan_lord: 'abyss_behemoth',
    hulan_beast_tide: 'abyss_behemoth',
    boar: 'tundra_brute',
    golem: 'tundra_brute',
    frost_lizard: 'abyss_behemoth',
  };

  // 7-frame Sea of Stars 布局: [0:idle1, 1:idle2, 2:blink, 3:windup, 4:cast_step, 5:strike, 6:hurt]
  // 9-frame 双态剑+法布局 (beatrice / sylvia_disguise / eastwing_commander): [..., 7:magic_windup, 8:magic_cast]
  // 11-frame 三系元素布局 (reno): [..., 3..5:earth, 7:fire_windup, 8:fire_cast, 9:wind/water_windup, 10:wind/water_cast]
  // 扩展 run 帧：由 bank.animMap.run (或 run1/run2/run3) 提供；无专用 run 帧时优雅回退至 [0,1] 疾步弹跳，绝不使用 3/4/5！
  const DUAL_MAGIC_SPRITES = new Set(['beatrice', 'sylvia_disguise', 'eastwing_commander']);
  const TRI_ELEM_SPRITES = new Set(['reno']);
  const SCALE_MULT_OVERRIDES = {
    abyss_behemoth: 0.94,
    tundra_brute: 0.94,
  };

  const POSE_TO_FRAME = {
    idle: 0,
    idle1: 0,
    idle2: 1,
    blink: 2,
    run: 0,
    run1: 0,
    run2: 1,
    run3: 0,
    windup: 3,
    charge: 3,
    cast_step: 4,
    strike_ready: 4,
    strike: 5,
    attack: 5,
    cast: 5,
    hurt: 6,
    hit: 6,
    magic_windup: 7,
    magic_cast: 8,
    earth_windup: 3,
    earth_step: 4,
    earth_cast: 5,
    fire_windup: 7,
    fire_cast: 8,
    wind_windup: 9,
    wind_cast: 10,
    water_windup: 9,
    water_cast: 10,
  };

  function resolveBankObj(spriteIdOrBank) {
    if (!spriteIdOrBank) return null;
    if (typeof spriteIdOrBank === 'string') return getPixelBankEntry(spriteIdOrBank);
    if (typeof spriteIdOrBank === 'object') {
      if (Array.isArray(spriteIdOrBank.frames)) return spriteIdOrBank;
      if (spriteIdOrBank.id) return getPixelBankEntry(spriteIdOrBank.id) || spriteIdOrBank;
    }
    return null;
  }

  function sanitizeFrameList(list, frameCount) {
    if (!Array.isArray(list) || !list.length) return [];
    const maxIdx = Math.max(0, (frameCount || 7) - 1);
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const n = Number(list[i]);
      if (Number.isFinite(n)) out.push(clamp(n | 0, 0, maxIdx));
    }
    return out;
  }

  function getRunFramesInfo(spriteIdOrBank, frameCountOverride) {
    const bank = resolveBankObj(spriteIdOrBank);
    const count = Math.max(1, frameCountOverride || (bank && Array.isArray(bank.frames) ? bank.frames.length : 7));
    const am = bank && bank.animMap && typeof bank.animMap === 'object' ? bank.animMap : null;

    if (am) {
      if (Array.isArray(am.run) && am.run.length) {
        const frames = sanitizeFrameList(am.run, count);
        if (frames.length) return { frames, fps: 9, isReal: true };
      } else if (am.run && typeof am.run === 'object' && Array.isArray(am.run.frames) && am.run.frames.length) {
        const frames = sanitizeFrameList(am.run.frames, count);
        if (frames.length) {
          const fps = typeof am.run.fps === 'number' && am.run.fps > 0 ? clamp(am.run.fps, 4, 18) : 9;
          return { frames, fps, isReal: true };
        }
      }
      const seq = [];
      for (let i = 1; i <= 6; i++) {
        const v = am[`run${i}`];
        if (typeof v === 'number' && Number.isFinite(v)) seq.push(clamp(v | 0, 0, count - 1));
      }
      if (seq.length) return { frames: seq, fps: 9, isReal: true };
    }

    if (bank && Array.isArray(bank.frameNames) && bank.frameNames.length) {
      const seq = [];
      for (let i = 0; i < bank.frameNames.length && i < count; i++) {
        if (/^run\d*$/i.test(String(bank.frameNames[i] || ''))) seq.push(i);
      }
      if (seq.length) return { frames: seq, fps: 9, isReal: true };
    }

    // 无专用奔跑帧时优雅降级至呼吸/待机帧 [0, 1] 配疾步弹跳，绝不使用 3/4/5 施法/挥砍帧！
    return { frames: count > 1 ? [0, 1] : [0], fps: 9, isReal: false };
  }

  function hasMagicCastFrames(spriteIdOrBank) {
    const id = typeof spriteIdOrBank === 'string'
      ? spriteIdOrBank
      : (spriteIdOrBank && spriteIdOrBank.id) || '';
    const bank = resolveBankObj(spriteIdOrBank);
    const am = bank && bank.animMap && typeof bank.animMap === 'object' ? bank.animMap : null;
    if (am) {
      if (typeof am.magic_cast === 'number' || typeof am.magic_windup === 'number') return true;
      if (Array.isArray(am.magic) && am.magic.length >= 2) return true;
      if (am.magic && typeof am.magic === 'object' && typeof am.magic.cast === 'number') return true;
      // 若 animMap 声明了 run 帧且占用了 7/8，但未声明 magic，则视为带奔跑帧的 7 帧模型而非双态法术模型
      const runInfo = getRunFramesInfo(bank);
      if (runInfo.isReal && (runInfo.frames.includes(7) || runInfo.frames.includes(8))) {
        return false;
      }
    }
    if (TRI_ELEM_SPRITES.has(id)) return false;
    const count = (bank && Array.isArray(bank.frames) ? bank.frames.length : 0)
      || (SPRITE_MANIFEST[id] && SPRITE_MANIFEST[id].frames)
      || 7;
    if (DUAL_MAGIC_SPRITES.has(id)) return count >= 9;
    return false;
  }

  function lookupAnimMapPose(am, key, count) {
    if (!am || typeof am !== 'object') return null;
    if (typeof am[key] === 'number' && Number.isFinite(am[key])) {
      return clamp(am[key] | 0, 0, count - 1);
    }
    if (Array.isArray(am[key]) && am[key].length) {
      return clamp(Number(am[key][0]) | 0, 0, count - 1);
    }
    // 支持元素分组：{ fire: [7, 8], wind/water: [9, 10], earth: [3, 4, 5], magic: [7, 8] } 或对象 { windup, step, cast }
    const m = key.match(/^(earth|fire|wind|water|magic)_(windup|step|cast|strike)$/);
    if (m) {
      const grp = am[m[1]] || (m[1] === 'wind' ? am.water : null);
      const sub = m[2];
      if (Array.isArray(grp) && grp.length) {
        if (sub === 'windup') return clamp(Number(grp[0]) | 0, 0, count - 1);
        if (sub === 'step') return clamp(Number(grp[Math.min(1, grp.length - 1)]) | 0, 0, count - 1);
        return clamp(Number(grp[grp.length - 1]) | 0, 0, count - 1);
      }
      if (grp && typeof grp === 'object') {
        const prop = sub === 'strike' ? (grp.strike != null ? grp.strike : grp.cast) : grp[sub];
        if (typeof prop === 'number' && Number.isFinite(prop)) return clamp(prop | 0, 0, count - 1);
      }
    }
    return null;
  }

  function resolvePoseFrame(pose, frameCount, spriteIdOrBank) {
    const bank = resolveBankObj(spriteIdOrBank);
    const count = Math.max(1, frameCount || (bank && Array.isArray(bank.frames) ? bank.frames.length : 7));
    const is7 = count >= 7;
    const is9 = count >= 9;
    const is11 = count >= 11;
    const key = String(pose || 'idle').toLowerCase();

    if (bank && bank.animMap) {
      const mapped = lookupAnimMapPose(bank.animMap, key, count);
      if (mapped !== null) return mapped;
    }

    if (key === 'run' || key === 'run1' || key === 'run2' || key === 'run3') {
      const runInfo = getRunFramesInfo(bank || spriteIdOrBank, count);
      const slot = key === 'run2' ? 1 : key === 'run3' ? 2 : 0;
      return runInfo.frames[slot % runInfo.frames.length];
    }

    switch (key) {
      case 'idle':
      case 'idle1':
        return 0;
      case 'idle2':
        return count > 1 ? 1 : 0;
      case 'blink':
        return count > 2 ? 2 : 0;
      case 'windup':
      case 'charge':
      case 'earth_windup':
        return count > 3 ? 3 : count - 1;
      case 'cast_step':
      case 'strike_ready':
      case 'earth_step':
        return is7 ? 4 : (count > 3 ? 3 : count - 1);
      case 'strike':
      case 'attack':
      case 'cast':
      case 'earth_cast':
      case 'earth_strike':
        return is7 ? 5 : (count > 4 ? 4 : count - 1);
      case 'hurt':
      case 'hit':
        return is7 ? 6 : (count > 5 ? 5 : count - 1);
      case 'magic_windup':
        return (is9 && (spriteIdOrBank ? hasMagicCastFrames(spriteIdOrBank) : true))
          ? 7
          : (count > 3 ? 3 : count - 1);
      case 'magic_cast':
      case 'magic_strike':
        return (is9 && (spriteIdOrBank ? hasMagicCastFrames(spriteIdOrBank) : true))
          ? 8
          : (is7 ? 5 : (count > 4 ? 4 : count - 1));
      case 'fire_windup': {
        const sid = typeof spriteIdOrBank === 'string' ? spriteIdOrBank : (spriteIdOrBank && spriteIdOrBank.id) || '';
        const isTriElem = TRI_ELEM_SPRITES.has(sid);
        return ((is11 && isTriElem) || (is9 && (spriteIdOrBank ? hasMagicCastFrames(spriteIdOrBank) : true)))
          ? 7
          : (count > 3 ? 3 : count - 1);
      }
      case 'fire_cast':
      case 'fire_strike': {
        const sid = typeof spriteIdOrBank === 'string' ? spriteIdOrBank : (spriteIdOrBank && spriteIdOrBank.id) || '';
        const isTriElem = TRI_ELEM_SPRITES.has(sid);
        return ((is11 && isTriElem) || (is9 && (spriteIdOrBank ? hasMagicCastFrames(spriteIdOrBank) : true)))
          ? 8
          : (is7 ? 5 : (count > 4 ? 4 : count - 1));
      }
      case 'wind_windup':
      case 'water_windup': {
        const sid = typeof spriteIdOrBank === 'string' ? spriteIdOrBank : (spriteIdOrBank && spriteIdOrBank.id) || '';
        const isTriElem = TRI_ELEM_SPRITES.has(sid);
        return (is11 && isTriElem)
          ? 9
          : ((is9 && (spriteIdOrBank ? hasMagicCastFrames(spriteIdOrBank) : true)) ? 7 : (count > 3 ? 3 : count - 1));
      }
      case 'wind_cast':
      case 'wind_strike':
      case 'water_cast':
      case 'water_strike': {
        const sid = typeof spriteIdOrBank === 'string' ? spriteIdOrBank : (spriteIdOrBank && spriteIdOrBank.id) || '';
        const isTriElem = TRI_ELEM_SPRITES.has(sid);
        return (is11 && isTriElem)
          ? 10
          : ((is9 && (spriteIdOrBank ? hasMagicCastFrames(spriteIdOrBank) : true)) ? 8 : (is7 ? 5 : (count > 4 ? 4 : count - 1)));
      }
      default:
        return 0;
    }
  }

  /* -------------------- 冰晶故事绘本色板（贴合雪瓷蓝宝石美术基调） -------------------- */
  const PALETTES = {
    ice: ['#0c1a3d', '#16357a', '#1c56c8', '#3898f0', '#6bc5f8', '#b8e8ff', '#e4f7ff', '#ffffff'],
    crit: ['#16357a', '#1c56c8', '#3898f0', '#7dd3fc', '#fde68a', '#facc15', '#fffbeb', '#ffffff'],
    water: ['#081b38', '#0e366d', '#165aa6', '#2183d2', '#3eb4ef', '#86dcfa', '#d0f4ff', '#ffffff'],
    wind: ['#0a2422', '#124640', '#1c7266', '#2ca490', '#58d4bc', '#9cf2df', '#d8fff4', '#ffffff'],
    swordIce: ['#16357a', '#1c56c8', '#3898f0', '#6bc5f8', '#c0e8ff', '#eef9ff', '#ffffff'],
    swordSparks: ['#ffffff', '#dcfbff', '#6bc5f8', '#1c56c8'],
    fire: ['#4a1712', '#8a1f17', '#c9281f', '#f2561d', '#ff8a2a', '#ffc23d', '#ffe26b', '#fff3a6', '#ffffff'],
    earth: ['#2a1d14', '#523a28', '#7d5b3e', '#a9825c', '#cfb089', '#ead8bc', '#ffffff'],
    eclipse: ['#090516', '#1b0f38', '#331868', '#5224a4', '#7e42d8', '#b07cf4', '#dcc4ff', '#f8f2ff'],
    claw: ['#2a0808', '#5c0f12', '#a51d1d', '#e2401f', '#ff8a2a', '#ffd166', '#fff3c4', '#ffffff'],
  };

  /* -------------------- 运行态缓存与性能护栏 -------------------- */
  const MAX_ACTIVE_EFFECTS = 2;
  const MAX_ACTIVE_EFFECTS_THROTTLED = 2;
  const MAX_SCHEDULED_ACTIONS = 16;
  const MAX_EFFECT_AGE_MS = 1250;
  const FX_BASE_INTERVAL_MS = 33; // PixelFX 原生 30fps，无需 60fps 重复软光栅
  const FX_MAX_INTERVAL_MS = 66;
  const FX_FRAME_BUDGET_MS = 10;

  // 对原生尺寸极大或带垂直偏移（如 snowflake_burst 的 Tt=-48、eclipse 的 r=72 晕环）的特效，
  // 改用紧凑离屏帧按真实视觉中心精准锚定并按 scale 缩放合成，彻底告别左上偏飞与巨无霸糊屏
  const SCALED_FX_PROFILES = {
    snowflake_burst: { w: 144, h: 128, localX: 72, localY: 104, pivotX: 72, pivotY: 56, defaultScale: 0.54 },
    eclipse: { w: 152, h: 144, localX: 76, localY: 72, pivotX: 76, pivotY: 72, defaultScale: 0.48 },
  };

  const _actors = new Map(); // actorKey -> state object
  const _activeEffects = []; // live PixelFX entries
  const _scheduled = []; // timed choreography callbacks
  const _rawTimers = new Set();
  const _cameoEntries = new Map(); // actorKey -> { timers: [] }

  let _rafId = 0;
  let _lastRafTs = 0;
  let _lastFxDrawTs = 0;
  let _deferFxDrawUntil = 0;
  let _fxIntervalMs = FX_BASE_INTERVAL_MS;
  let _fxDrawBudgetTrips = 0;
  let _hitStopId = 0;
  let _hitStopScale = 1.0;
  let _hitStopTimer = null;
  let _slowMoScale = 1.0;
  let _playerActionGen = 0;

  let _canvas = null;
  let _ctx = null;
  let _frame = null;
  let _imgData = null;
  let _bufW = 0;
  let _bufH = 0;
  let _subFxFrame = null;
  let _subFxCanvas = null;
  let _subFxCtx = null;
  let _subFxImgData = null;
  let _subFxW = 0;
  let _subFxH = 0;
  let _canvasDirty = false;
  const EDITION_A_SLOWMO_RENDER_INTERVAL_MS = 33;
  let _hdCanvas = null;
  let _hdW = 0;
  let _hdH = 0;
  let _editionA = null;
  let _editionADirty = false;
  let _editionALastRenderTs = 0;
  let _editionAForceRender = false;
  const _statusMicroThrottle = new Map();
  let _lastBattleRef = null;
  let _lastBattleId = '';
  let _lastWaveIdx = -1;
  let _lastEnemyPhase2Count = 0;
  let _lastBattlePhase2 = false;
  let _fxSeed = 11;
  let _pfxWarmed = false;
  let _cachedFieldRect = null;
  let _cachedFieldRectTs = 0;
  let _lastLayoutSig = '';
  let _fieldResizeObserver = null;
  let _observedFieldEl = null;

  // 3D 前后环绕魔力增幅水晶光环状态（320×280 等比方像素充裕画幅防裁切，支持棱镜冲击波与四菱碎片爆破）
  const AURA_BUF_W = 320;
  const AURA_BUF_H = 280;
  const AURA_INTERVAL_MS = 33;
  let _auraElapsed = 0;
  let _lastAuraDrawTs = 0;
  let _auraLastTier = 0;
  let _auraLastIntensity = 0;
  let _auraDirty = false;
  let _auraBurstTs = 0;
  let _auraBurstTier = 0;
  let _auraLastBurstTs = 0;
  let _auraLastBurstTier = 0;
  const _auraShockwaves = [];
  const _auraBurstParticles = [];

  const _flashStamps = [];
  const MAX_FLASHES_PER_SEC = 2;

  /* -------------------- 辅助工具 -------------------- */
  function nowPerf() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
  }

  function invalidateFieldRect() {
    _cachedFieldRect = null;
    _cachedFieldRectTs = 0;
  }

  function getFieldRect(field, force) {
    if (!field) return null;
    const t = nowPerf();
    if (!force && _cachedFieldRect && _cachedFieldRect.el === field && (t - _cachedFieldRectTs) < 2000) {
      return _cachedFieldRect.rect;
    }
    const r = field.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) {
      _cachedFieldRect = { el: field, rect: r };
      _cachedFieldRectTs = t;
    }
    return r;
  }

  function nextSeed() {
    _fxSeed = (_fxSeed * 1664525 + 1013904223) >>> 0;
    return (_fxSeed % 997) + 1;
  }

  function trackRealTimer(fn, ms) {
    let tid = null;
    let done = false;
    tid = setTimeout(() => {
      done = true;
      if (tid != null) _rawTimers.delete(tid);
      fn();
    }, ms);
    if (!done && tid != null) {
      if (typeof tid.unref === 'function') tid.unref();
      _rawTimers.add(tid);
    }
    return tid;
  }

  function canFlash() {
    if (prefersReducedMotion()) return false;
    const now = Date.now();
    while (_flashStamps.length && now - _flashStamps[0] >= 1000) _flashStamps.shift();
    if (_flashStamps.length >= MAX_FLASHES_PER_SEC) return false;
    _flashStamps.push(now);
    return true;
  }

  function hydrateMetaFromBank(meta) {
    if (!meta) return meta;
    const bank = getPixelBankEntry(meta.id);
    if (!bank) return meta;
    const nextAnimMap = bank.animMap || null;
    if (meta._bankRef === bank && meta.frames === bank.frames.length && meta.animMap === nextAnimMap) {
      return meta;
    }
    meta._bankRef = bank;
    meta.frameW = bank.w;
    meta.frameH = bank.h;
    meta.frames = bank.frames.length;
    meta.animMap = nextAnimMap;
    meta.frameNames = bank.frameNames || null;
    if (typeof bank.facing === 'string') meta.facing = bank.facing;
    if (typeof bank.scaleMult === 'number' && Number.isFinite(bank.scaleMult)) meta.scaleMult = bank.scaleMult;
    if (SCALE_MULT_OVERRIDES[meta.id] != null) meta.scaleMult = SCALE_MULT_OVERRIDES[meta.id];
    if (bank.anchors) {
      if (Array.isArray(bank.anchors.feet)) {
        meta.anchorX = bank.anchors.feet[0] / bank.w;
        meta.anchorY = bank.anchors.feet[1] / bank.h;
      }
      if (Array.isArray(bank.anchors.cast)) {
        meta.castX = bank.anchors.cast[0] / bank.w;
        meta.castY = bank.anchors.cast[1] / bank.h;
      }
      if (Array.isArray(bank.anchors.hit)) {
        meta.hitX = bank.anchors.hit[0] / bank.w;
        meta.hitY = bank.anchors.hit[1] / bank.h;
      }
      if (Array.isArray(bank.anchors.head)) {
        meta.headX = bank.anchors.head[0] / bank.w;
        meta.headY = bank.anchors.head[1] / bank.h;
      }
    }
    return meta;
  }

  function getSpriteMeta(spriteId) {
    const meta = SPRITE_MANIFEST[spriteId] || SPRITE_MANIFEST.sylvia_silver;
    return hydrateMetaFromBank(meta);
  }

  const YOUNG_SYLVIA_STAGES = new Set(['beatrice_11', 'rowan_graveyard', 'alice_9']);
  const DISGUISE_SYLVIA_STAGES = new Set(['north_forest_hunt', 'hulan_beast_tide', 'wind_god_eye']);

  function resolvePlayerSpriteId(battleState, isVol3Disguise) {
    if (isVol3Disguise) return 'sylvia_disguise';
    if (battleState) {
      const sid = battleState.id || (battleState.stageCfg && battleState.stageCfg.id) || '';
      const pname = battleState.player && battleState.player.name ? battleState.player.name : '';
      const curS = (!battleState.fromArena && typeof global !== 'undefined') ? global.S : null;
      if (
        DISGUISE_SYLVIA_STAGES.has(sid) ||
        pname.includes('眷寒渔') ||
        (curS && (curS.disguised || (curS.alias && curS.alias.includes('眷寒渔'))))
      ) {
        return 'sylvia_disguise';
      }
      if (YOUNG_SYLVIA_STAGES.has(sid)) {
        return 'sylvia_young';
      }
      const presetAge = battleState.stageCfg && battleState.stageCfg.preset && typeof battleState.stageCfg.preset.age === 'number'
        ? battleState.stageCfg.preset.age
        : null;
      const legacyCfgAge = battleState.stageCfg && battleState.stageCfg.player && typeof battleState.stageCfg.player.age === 'number'
        ? battleState.stageCfg.player.age
        : null;
      const playerAge = battleState.player && typeof battleState.player.age === 'number'
        ? battleState.player.age
        : null;
      const saveAge = curS && typeof curS.ageY === 'number' ? curS.ageY : null;
      const age = playerAge != null ? playerAge : (presetAge != null ? presetAge : (legacyCfgAge != null ? legacyCfgAge : saveAge));
      if (age != null && age < 12) {
        return 'sylvia_young';
      }
    }
    return 'sylvia_silver';
  }

  function resolveEnemySpriteId(enemyOrKeys) {
    if (!enemyOrKeys) return 'pack_wolf';
    const candidates = [];
    if (typeof enemyOrKeys === 'string') {
      candidates.push(enemyOrKeys);
    } else if (Array.isArray(enemyOrKeys)) {
      for (let i = 0; i < enemyOrKeys.length; i++) candidates.push(enemyOrKeys[i]);
    } else {
      candidates.push(enemyOrKeys.id, enemyOrKeys.charId, enemyOrKeys.aiType, enemyOrKeys.crestKind);
    }
    for (let i = 0; i < candidates.length; i++) {
      const raw = candidates[i];
      if (!raw) continue;
      const key = String(raw).toLowerCase().trim();
      if (SPRITE_MANIFEST[key]) return key;
      if (ENEMY_SPRITE_ALIAS[key]) return ENEMY_SPRITE_ALIAS[key];
    }
    const joined = candidates.filter(Boolean).join(':').toLowerCase();
    if (joined.includes('wind_god') || joined.includes('tempest') || joined.includes('fengshen')) return 'wind_god_avatar';
    if (joined.includes('eastwing')) return 'eastwing_commander';
    if (joined.includes('flame_mage') || joined.includes('slime_fire')) return 'flame_mage';
    if (joined.includes('corridor') || joined.includes('inquisitor')) return 'corridor_vanguard';
    if (joined.includes('rowan')) return 'rowan';
    if (joined.includes('beatrice')) return 'beatrice';
    if (joined.includes('alice')) return 'alice';
    if (joined.includes('aino')) return 'aino';
    if (joined.includes('noelle')) return 'noelle';
    if (joined.includes('alpha')) return 'wolf_alpha';
    if (joined.includes('ridge_claw') || joined.includes('jackal_minor')) return 'ridge_claw';
    if (joined.includes('jackal')) return 'shadow_jackal';
    if (joined.includes('tundra_brute') || joined.includes('hulan_brute')) return 'tundra_brute';
    if (joined.includes('frost_hound') || joined.includes('ice_wolf')) return 'frost_hound';
    if (joined.includes('behemoth') || joined.includes('hulan') || joined.includes('brute') || joined.includes('lord') || joined.includes('lizard')) return 'abyss_behemoth';
    return 'pack_wolf';
  }

  /* -------------------- 真像素矩阵库（零 PNG · 逐像素索引渲染到 Canvas） -------------------- */
  const _bankFrameCache = new Map(); // `${id}:${frame}` -> ImageData
  const BANK_CHARS = '.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~';
  const BANK_CHAR_LUT = new Int8Array(128);
  BANK_CHAR_LUT.fill(-1);
  for (let i = 0; i < BANK_CHARS.length; i++) {
    const code = BANK_CHARS.charCodeAt(i);
    if (code < 128) BANK_CHAR_LUT[code] = i;
  }

  function getPixelBankEntry(spriteId) {
    const bank = global.PIXEL_SPRITE_BANK;
    if (!bank || typeof bank !== 'object') return null;
    const entry = bank[spriteId];
    return entry && entry.w > 0 && entry.h > 0 && Array.isArray(entry.palette) && Array.isArray(entry.frames) && entry.frames.length > 0
      ? entry
      : null;
  }

  function hexToRgbTriplet(hex) {
    if (!hex || typeof hex !== 'string') return null;
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6) return null;
    const n = parseInt(clean, 16);
    if (!Number.isFinite(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function expandPixelRow(row, targetW) {
    if (typeof row !== 'string') return '';
    if (row.indexOf('*') === -1) return row;
    let out = '';
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (i + 1 < row.length && row[i + 1] === '*') {
        let j = i + 2;
        let numStr = '';
        while (j < row.length && row[j] >= '0' && row[j] <= '9') {
          numStr += row[j++];
        }
        const rep = parseInt(numStr, 10) || 1;
        out += ch.repeat(rep);
        i = j - 1;
      } else {
        out += ch;
      }
    }
    return out.length >= targetW ? out : out + '.'.repeat(targetW - out.length);
  }

  function decodeBankFrame(spriteId, frameIdx) {
    const entry = getPixelBankEntry(spriteId);
    if (!entry) return null;
    const idx = clamp(frameIdx | 0, 0, entry.frames.length - 1);
    const cacheKey = `${spriteId}:${idx}`;
    if (_bankFrameCache.has(cacheKey)) return _bankFrameCache.get(cacheKey);
    if (typeof ImageData === 'undefined') return null;

    const w = entry.w | 0;
    const h = entry.h | 0;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const palRgb = entry._palRgb || (entry._palRgb = entry.palette.map(hexToRgbTriplet));
    const rows = entry.frames[idx] || [];
    for (let y = 0; y < h && y < rows.length; y++) {
      const row = rows[y];
      if (typeof row !== 'string' || !row.length) continue;
      const rowOff = y * w;
      const rLen = row.length;
      let x = 0;
      for (let i = 0; i < rLen && x < w; i++) {
        const code = row.charCodeAt(i);
        let rep = 1;
        if (i + 1 < rLen && row.charCodeAt(i + 1) === 42) { // '*'
          let j = i + 2;
          let n = 0;
          while (j < rLen) {
            const d = row.charCodeAt(j) - 48;
            if (d < 0 || d > 9) break;
            n = n * 10 + d;
            j++;
          }
          rep = n > 0 ? n : 1;
          i = j - 1;
        }
        if (code === 46) { // '.' transparent skip in O(1)
          x += rep;
          continue;
        }
        const pi = code < 128 ? BANK_CHAR_LUT[code] : -1;
        const rgb = pi > 0 ? palRgb[pi] : null;
        if (!rgb) {
          x += rep;
          continue;
        }
        const r = rgb[0], g = rgb[1], b = rgb[2];
        const endX = x + rep < w ? x + rep : w;
        for (; x < endX; x++) {
          const off = (rowOff + x) << 2;
          rgba[off] = r;
          rgba[off + 1] = g;
          rgba[off + 2] = b;
          rgba[off + 3] = 255;
        }
      }
    }
    const imgData = new ImageData(rgba, w, h);
    _bankFrameCache.set(cacheKey, imgData);
    return imgData;
  }

  /* -------------------- 行动跑条像素精灵头部裁剪缓存接口 -------------------- */
  const _headCanvasCache = new Map(); // `${spriteId}:${size}` -> HTMLCanvasElement

  // 全 22 套像素精灵第 0 帧精准居中头部裁切表（实机目视逐套定稿）
  const HEAD_CROP_OVERRIDES = {
    // 7 只四足魔兽（面向左侧，精准框住兽首/口鼻/双眸，避免原 anchors.head 截成背刺）
    wolf_alpha:         { sx: 18, sy: 59, size: 44 },
    pack_wolf:          { sx: 6,  sy: 48, size: 42 },
    frost_hound:        { sx: 15, sy: 48, size: 46 },
    tundra_brute:       { sx: 25, sy: 66, size: 44 },
    abyss_behemoth:     { sx: 27, sy: 69, size: 46 },
    ridge_claw:         { sx: 15, sy: 44, size: 46 },
    shadow_jackal:      { sx: 10, sy: 50, size: 46 },
    // 15 位人形/首领角色（保留完整发冠/帽顶/头角，面容与双眸居中，剥离旁侧武器/浮石/魔球干扰）
    beatrice:           { sx: 33, sy: 5,  size: 44 },
    sylvia_young:       { sx: 42, sy: 11, size: 42 },
    sylvia_silver:      { sx: 49, sy: 8,  size: 42 },
    sylvia_disguise:    { sx: 48, sy: 10, size: 42 },
    reno:               { sx: 47, sy: 17, size: 38 },
    rowan:              { sx: 61, sy: 23, size: 36 },
    alice:              { sx: 42, sy: 12, size: 44 },
    aino:               { sx: 47, sy: 9,  size: 44 },
    noelle:             { sx: 57, sy: 8,  size: 42 },
    charlotte:          { sx: 46, sy: 7,  size: 44 },
    jilan:              { sx: 48, sy: 8,  size: 44 },
    corridor_vanguard:  { sx: 53, sy: 17, size: 44 },
    flame_mage:         { sx: 51, sy: 16, size: 46 },
    eastwing_commander: { sx: 57, sy: 22, size: 39 },
    wind_god_avatar:    { sx: 45, sy: 22, size: 44 },
  };

  function getHeadCanvas(spriteId, size = 34) {
    if (!spriteId || typeof spriteId !== 'string') return null;
    if (typeof document === 'undefined' || typeof document.createElement !== 'function' || isJsdomEnv()) {
      return null;
    }
    const targetSize = (typeof size === 'number' && Number.isFinite(size) && size > 0)
      ? Math.round(size)
      : 34;
    const cacheKey = `${spriteId}:${targetSize}`;
    if (_headCanvasCache.has(cacheKey)) return _headCanvasCache.get(cacheKey);

    const entry = getPixelBankEntry(spriteId);
    if (!entry) return null;
    const imgData = decodeBankFrame(spriteId, 0);
    if (!imgData) return null;

    const w = entry.w | 0;
    const h = entry.h | 0;
    if (w <= 0 || h <= 0) return null;

    try {
      const srcCanvas = document.createElement('canvas');
      if (!srcCanvas || typeof srcCanvas.getContext !== 'function') return null;
      srcCanvas.width = w;
      srcCanvas.height = h;
      const sctx = srcCanvas.getContext('2d');
      if (!sctx) return null;
      sctx.putImageData(imgData, 0, 0);

      const headCanvas = document.createElement('canvas');
      if (!headCanvas || typeof headCanvas.getContext !== 'function') return null;
      headCanvas.width = targetSize;
      headCanvas.height = targetSize;
      const hctx = headCanvas.getContext('2d');
      if (!hctx) return null;
      hctx.imageSmoothingEnabled = false;

      const override = HEAD_CROP_OVERRIDES[spriteId];
      let cropSize;
      let sx;
      let sy;
      if (override && override.size > 0) {
        cropSize = Math.min(w, h, Math.round(override.size));
        sx = Math.max(0, Math.min(w - cropSize, Math.round(override.sx)));
        sy = Math.max(0, Math.min(h - cropSize, Math.round(override.sy)));
      } else {
        const head = (entry.anchors && Array.isArray(entry.anchors.head) && entry.anchors.head.length >= 2)
          ? entry.anchors.head
          : [w / 2, h * 0.28];
        cropSize = Math.min(w, h, Math.max(40, Math.min(54, Math.round(Math.min(w, h) * 0.38))));
        sx = Math.max(0, Math.min(w - cropSize, Math.round(head[0] - cropSize / 2)));
        sy = Math.max(0, Math.min(h - cropSize, Math.round(head[1] - cropSize * 0.44)));
      }

      hctx.drawImage(srcCanvas, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);
      _headCanvasCache.set(cacheKey, headCanvas);
      return headCanvas;
    } catch (e) {
      return null;
    }
  }

  function drawHeadCanvas(targetCanvas, spriteId, size = 34) {
    if (!targetCanvas || typeof targetCanvas.getContext !== 'function') return false;
    const targetSize = (typeof size === 'number' && Number.isFinite(size) && size > 0)
      ? Math.round(size)
      : 34;
    const src = getHeadCanvas(spriteId, targetSize);
    if (!src) return false;
    try {
      if (targetCanvas.width !== targetSize || targetCanvas.height !== targetSize) {
        targetCanvas.width = targetSize;
        targetCanvas.height = targetSize;
      }
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return false;
      ctx.clearRect(0, 0, targetSize, targetSize);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, targetSize, targetSize);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* -------------------- 精灵状态机管理（3D-First 纯逻辑态） -------------------- */
  function createActorState(actorKey, spriteId) {
    return {
      key: actorKey,
      spriteId,
      isCameo: false,
      auraBackEl: null,
      auraFrontEl: null,
      auraBackCtx: null,
      auraFrontCtx: null,
      _auraTierTag: '',
      pose: 'idle',
      frame: 0,
      poseOverride: null,
      poseTimer: 0,
      poseLock: false,
      poseQueue: [],
      breathElapsed: Math.random() * 0.5,
      breathPeriod: 0.44 + Math.random() * 0.11, // 每角色错开周期，群狼永不同步机械呼吸
      breathStep: Math.random() < 0.5 ? 0 : 1,
      blinkCooldown: 2.2 + Math.random() * 2.6,
      blinkLeft: 0,
      floatPhase: Math.random() * Math.PI * 2,
      floatElapsed: 0,
      runElapsed: 0,
      runBobY: 0,
      runTiltDeg: 0,
      runSX: 1,
      runSY: 1,
      dx: 0,
      dy: 0,
      sx: 1,
      sy: 1,
      dashTween: null,
      squashTween: null,
      flashLeft: 0,
      ghostTimer: 0,
      ghostTone: 'ice',
      flipped: false,
      dead: false,
    };
  }

  function getOrCreateActor(actorKey, spriteId) {
    let st = _actors.get(actorKey);
    if (!st) {
      st = createActorState(actorKey, spriteId);
      _actors.set(actorKey, st);
    } else if (spriteId && st.spriteId !== spriteId) {
      st.spriteId = spriteId;
    }
    return st;
  }

  function renderActorMarkup() {
    return '';
  }

  function applyActorVisual(st) {
    if (!st) return;
    const meta = getSpriteMeta(st.spriteId);
    const frameCount = meta.frames || 7;
    const frame = clamp(st.frame | 0, 0, frameCount - 1);
    const poseName = st.poseOverride || st.pose || 'idle';
    st.frame = frame;

    const reduced = prefersReducedMotion();
    const floatY = (!reduced && !st.dead && meta.floatAmp > 0)
      ? -Math.sin(st.floatElapsed * 2.5 + st.floatPhase) * meta.floatAmp
      : 0;
    const runBobY = (!reduced && !st.dead && poseName === 'run') ? (st.runBobY || 0) : 0;
    const totalY = floatY + runBobY;

    const isRunning = poseName === 'run' && !st.dead;
    const combSX = st.sx * (isRunning ? (st.runSX || 1) : 1);
    const combSY = st.sy * (isRunning ? (st.runSY || 1) : 1);
    const tiltDeg = (!reduced && isRunning) ? (st.runTiltDeg || 0) : 0;

    const s3d = global.CombatStage3D;
    if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.updateActorVisual === 'function') {
      s3d.updateActorVisual(st.key, {
        spriteId: st.spriteId,
        frame,
        pose: poseName,
        dx: st.dx,
        dy: st.dy,
        sx: combSX,
        sy: combSY,
        totalY,
        tiltDeg,
        hitFlash: st.flashLeft > 0,
        dead: !!st.dead,
        flipped: !!st.flipped,
      });
    }
  }

  /* -------------------- 3D 前后环绕魔力增幅冰晶光环（1:1 复刻标杆棱镜冲击波 + 旋转棱晶碎片爆破 + 真前后景深三阶轨道） -------------------- */
  function getManaAmpState(battleState) {
    const b = battleState
      || _lastBattleRef
      || (global.CombatEngine && typeof global.CombatEngine.getBattleState === 'function' ? global.CombatEngine.getBattleState() : null)
      || (global.CombatEngine && typeof global.CombatEngine.getState === 'function' ? global.CombatEngine.getState() : null);
    let ampDec = 0;
    let tier = 0;
    let intensity = 0;

    if (b) {
      const p = b.player || {};
      const rawMode = b.overcastMode != null ? b.overcastMode : p.overcastMode;
      const ampRaw = b.overcastPct != null
        ? b.overcastPct
        : (b.ampPct != null ? b.ampPct : (p.overcastPct != null ? p.overcastPct : p.ampPct));

      if (typeof ampRaw === 'number' && Number.isFinite(ampRaw) && ampRaw > 0) {
        ampDec = clamp(ampRaw > 1 ? (ampRaw / 100) : ampRaw, 0, 0.60);
      } else if (rawMode === 3 || rawMode === 'tier3' || rawMode === 'max' || rawMode === 'overdrive') {
        ampDec = 0.60;
      } else if (rawMode === 2 || rawMode === 'full' || rawMode === 'all_in') {
        ampDec = 0.40;
      } else if (rawMode === 1 || rawMode === 'half') {
        ampDec = 0.20;
      }
    }

    // 兜底：若 DOM 滑条/倾注按钮处于激活态但外部未传最新 battleState，自动同步
    if (ampDec <= 0.001 && typeof document !== 'undefined') {
      const sliderEl = document.getElementById('cb-oc-slider');
      if (sliderEl && !sliderEl.disabled) {
        const sVal = Number(sliderEl.value) || 0;
        if (sVal > 0) ampDec = clamp(sVal / 100, 0, 0.60);
      }
      if (ampDec <= 0.001) {
        const activeBtn = document.querySelector('#cb-oc-seg .cb-oc-btn.active');
        if (activeBtn && !activeBtn.disabled) {
          const ampAttr = Number(activeBtn.getAttribute('data-amp'));
          const ocVal = Number(activeBtn.getAttribute('data-oc')) || 0;
          if (Number.isFinite(ampAttr) && ampAttr > 0) {
            ampDec = clamp(ampAttr > 1 ? ampAttr / 100 : ampAttr, 0, 0.60);
          } else if (ocVal === 3) {
            ampDec = 0.60;
          } else if (ocVal === 2) {
            ampDec = 0.40;
          } else if (ocVal === 1) {
            ampDec = 0.20;
          }
        }
      }
    }

    if (ampDec > 0.001) {
      tier = ampDec >= 0.595 ? 3 : ampDec >= 0.395 ? 2 : 1;
      intensity = clamp(ampDec / 0.60, 0, 1);
    }

    return { active: ampDec > 0.001, ampPct: ampDec, tier, intensity };
  }

  function ensurePlayerAuraCanvases(st) {
    if (!st || st.key !== 'player' || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return false;
    }
    if (!st.auraBackEl) {
      const backEl = document.createElement('canvas');
      backEl.width = AURA_BUF_W;
      backEl.height = AURA_BUF_H;
      st.auraBackEl = backEl;
      st.auraBackCtx = backEl.getContext('2d', { alpha: true });
      if (st.auraBackCtx) st.auraBackCtx.imageSmoothingEnabled = false;
    } else if (st.auraBackEl.width !== AURA_BUF_W || st.auraBackEl.height !== AURA_BUF_H) {
      st.auraBackEl.width = AURA_BUF_W;
      st.auraBackEl.height = AURA_BUF_H;
    }
    if (!st.auraFrontEl) {
      const frontEl = document.createElement('canvas');
      frontEl.width = AURA_BUF_W;
      frontEl.height = AURA_BUF_H;
      st.auraFrontEl = frontEl;
      st.auraFrontCtx = frontEl.getContext('2d', { alpha: true });
      if (st.auraFrontCtx) st.auraFrontCtx.imageSmoothingEnabled = false;
    } else if (st.auraFrontEl.width !== AURA_BUF_W || st.auraFrontEl.height !== AURA_BUF_H) {
      st.auraFrontEl.width = AURA_BUF_W;
      st.auraFrontEl.height = AURA_BUF_H;
    }
    return !!(st.auraBackCtx && st.auraFrontCtx);
  }

  /* 1:1 复刻标杆 burstAmpParticles：在主角躯干中枢发射锐利棱镜冲击波环 + 旋转四菱棱晶碎片（shard） */
  function spawnManaAmpBurst(ampPctDec, tier) {
    if (tier < 1 || prefersReducedMotion()) return;
    const cx = AURA_BUF_W * 0.5;
    const feetY = AURA_BUF_H * 0.75;
    const torsoY = feetY - 64;
    const isGold = ampPctDec >= 0.395 || tier >= 2;
    const isTier3 = tier >= 3 || ampPctDec >= 0.595;

    // 1 圈锐利棱镜冲击波环（<40% 霜青 #7DD3FC + 皇蓝描边 72-90；>=40% 香槟金 #F0DA9E + 深琥珀衬影 96-124）
    const maxR = isTier3
      ? 120
      : (isGold ? 102 : clamp(Math.round(74 + (ampPctDec / 0.40) * 16), 72, 90));
    const swColor = isGold ? '#F0DA9E' : '#7DD3FC';
    const swShadow = isGold ? 'rgba(116, 70, 12, 0.86)' : 'rgba(22, 88, 235, 0.86)';
    const swLineW = isTier3 ? 4.0 : (isGold ? 3.4 : 2.8);
    const swDur = isTier3 ? 0.38 : 0.36;

    while (_auraShockwaves.length >= 4) _auraShockwaves.shift();
    _auraShockwaves.push({
      x: cx,
      y: torsoY,
      r: 12,
      maxR,
      color: swColor,
      shadowColor: swShadow,
      lineWidth: swLineW,
      life: swDur,
      maxLife: swDur,
    });

    // 16（一二阶）/ 28（三阶）颗带旋转角速度与雪瓷高对比描边的四菱棱晶碎片（shard）
    const count = isTier3 ? 28 : 16;
    const palette = isGold
      ? ['#FFFFFF', '#F0DA9E', '#7DD3FC', '#2D75F8']
      : ['#FFFFFF', '#D8F5FF', '#7DD3FC', '#3B9EFF'];

    while (_auraBurstParticles.length + count > 72) {
      _auraBurstParticles.shift();
    }

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spd = (76 + Math.random() * 134) * (isTier3 ? 1.12 : 1.0);
      const col = palette[i % palette.length];
      const strokeColor = col === '#F0DA9E'
        ? 'rgba(116, 70, 12, 0.86)'
        : 'rgba(16, 58, 168, 0.78)';
      const life = 0.38 + Math.random() * 0.28;
      _auraBurstParticles.push({
        x: cx + Math.cos(a) * 18,
        y: torsoY + Math.sin(a) * 14,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd * 0.65 - 28,
        gravity: 38,
        size: (3.0 + Math.random() * 3.8) * (isTier3 ? 1.08 : 1.0),
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        color: col,
        strokeColor,
        shape: 'shard',
        front: (i % 3 !== 0),
        life,
        maxLife: life,
      });
    }
  }

  function stepAuraBurstEntities(dt) {
    if (!dt || dt <= 0) return;
    for (let i = _auraShockwaves.length - 1; i >= 0; i--) {
      const sw = _auraShockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        _auraShockwaves.splice(i, 1);
        continue;
      }
      sw.r = 12 + (sw.maxR - 12) * (1 - Math.pow(sw.life / sw.maxLife, 3));
    }
    for (let i = _auraBurstParticles.length - 1; i >= 0; i--) {
      const pt = _auraBurstParticles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        _auraBurstParticles.splice(i, 1);
        continue;
      }
      pt.vy += pt.gravity * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.rot += pt.vrot * dt;
    }
  }

  function drawAuraBurstPass(ctx, cx, faceY, isFrontPass) {
    if (!_auraShockwaves.length && !_auraBurstParticles.length) return;
    ctx.save();
    if (isFrontPass && _auraShockwaves.length) {
      for (let i = 0; i < _auraShockwaves.length; i++) {
        const sw = _auraShockwaves[i];
        const alpha = clamp(sw.life / sw.maxLife, 0, 1);
        if (alpha <= 0.01) continue;
        const mainW = sw.lineWidth * alpha + 1.0;

        // 雪瓷浅底外衬影描边（零内部白块填充，锐利通透绝不糊脸）
        ctx.save();
        ctx.globalAlpha = alpha * 0.80;
        ctx.strokeStyle = sw.shadowColor;
        ctx.lineWidth = mainW + 2.4;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();

        // 主棱镜冲击波环
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = mainW;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();

        // 初段高光切线（仅 0.85px 晶面反光）
        if (alpha > 0.35) {
          ctx.globalAlpha = alpha * 0.58;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    for (let i = 0; i < _auraBurstParticles.length; i++) {
      const pt = _auraBurstParticles[i];
      if (!!pt.front !== isFrontPass) continue;
      const alpha = clamp(pt.life / pt.maxLife, 0, 1);
      if (alpha <= 0.01) continue;
      const faceSafe = (isFrontPass && Math.abs(pt.x - cx) < 22 && Math.abs(pt.y - faceY) < 22) ? 0.28 : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha * faceSafe;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.beginPath();
      ctx.moveTo(pt.size * 1.4, 0);
      ctx.lineTo(-pt.size * 0.6, -pt.size * 0.55);
      ctx.lineTo(-pt.size, 0);
      ctx.lineTo(-pt.size * 0.6, pt.size * 0.55);
      ctx.closePath();
      if (pt.strokeColor) {
        ctx.strokeStyle = pt.strokeColor;
        ctx.lineWidth = 1.15;
        ctx.stroke();
      }
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function getManaAmpOrbits(tier, t, cx, feetY) {
    const orbits = [];
    if (tier <= 0) return orbits;

    // Tier 1+: 霜青第一倾斜 3D 轨道环（雪瓷浅底全档保留 1px 深靛外衬影）
    orbits.push({
      cx,
      cy: feetY - 64,
      rx: tier === 1 ? 70 : tier === 2 ? 75 : 80,
      ry: 18,
      tilt: 0.28,
      speed: tier === 3 ? 2.55 : tier === 2 ? 1.95 : 1.55,
      phase: t * (tier === 3 ? 2.55 : tier === 2 ? 1.95 : 1.55),
      count: tier === 3 ? 14 : tier === 2 ? 12 : 10,
      trailSteps: tier === 1 ? 5 : 6,
      trailArc: tier === 3 ? 0.42 : 0.32,
      ribbonColorFront: tier >= 3 ? 'rgba(98, 224, 255, 0.88)' : 'rgba(110, 226, 255, 0.72)',
      ribbonColorBack: 'rgba(28, 96, 206, 0.36)',
      shadowColorFront: tier >= 2 ? 'rgba(14, 48, 128, 0.46)' : 'rgba(16, 56, 152, 0.34)',
      shadowColorBack: tier >= 2 ? 'rgba(12, 40, 108, 0.26)' : 'rgba(14, 46, 124, 0.18)',
      moteStroke: tier >= 2 ? 'rgba(16, 56, 146, 0.66)' : 'rgba(16, 58, 154, 0.50)',
      ribbonWidth: tier === 3 ? 2.2 : 1.7,
      paletteFront: ['#FFFFFF', '#B8F6FF', '#6BC5F8', '#2C8CF2'],
      paletteBack: ['#4A88D8', '#2C63B8', '#5AA8E6'],
      starEvery: 3,
    });

    // Tier 2+: 皇家蓝反向倾斜第二 3D 轨道环
    if (tier >= 2) {
      orbits.push({
        cx,
        cy: feetY - 72,
        rx: tier === 3 ? 88 : 82,
        ry: 21,
        tilt: -0.32,
        speed: tier === 3 ? -2.30 : -1.78,
        phase: -t * (tier === 3 ? 2.30 : 1.78) + 1.15,
        count: tier === 3 ? 12 : 10,
        trailSteps: 6,
        trailArc: tier === 3 ? 0.40 : 0.30,
        ribbonColorFront: tier >= 3 ? 'rgba(28, 104, 245, 0.88)' : 'rgba(46, 124, 252, 0.72)',
        ribbonColorBack: 'rgba(20, 68, 174, 0.34)',
        shadowColorFront: 'rgba(10, 32, 104, 0.48)',
        shadowColorBack: 'rgba(10, 30, 96, 0.26)',
        moteStroke: 'rgba(12, 38, 118, 0.68)',
        ribbonWidth: tier === 3 ? 2.1 : 1.65,
        paletteFront: ['#E8FBFF', '#6BC5F8', '#2E7BFF', '#1658EB'],
        paletteBack: ['#2955B8', '#1D4299', '#3F86E0'],
        starEvery: 3,
      });
    }

    // Tier 3 (60%): 香槟金第三 3D 轨道环（配深琥珀 1px 衬影，雪瓷浅底高对比度清晰可辨）
    if (tier >= 3) {
      orbits.push({
        cx,
        cy: feetY - 82,
        rx: 96,
        ry: 26,
        tilt: 0.18,
        speed: 3.05,
        phase: t * 3.05 + 2.3,
        count: 14,
        trailSteps: 7,
        trailArc: 0.48,
        ribbonColorFront: 'rgba(255, 218, 110, 0.96)',
        ribbonColorBack: 'rgba(186, 134, 42, 0.58)',
        shadowColorFront: 'rgba(116, 70, 12, 0.70)',
        shadowColorBack: 'rgba(84, 50, 10, 0.44)',
        moteStroke: 'rgba(112, 66, 10, 0.80)',
        ribbonWidth: 2.35,
        paletteFront: ['#FFF8D6', '#F0DA9E', '#FFD970', '#9DF5FF'],
        paletteBack: ['#B07D28', '#6B8FD0', '#C99B3E'],
        starEvery: 2,
      });
    }

    return orbits;
  }

  function evalAuraOrbitPoint(orb, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const lx = orb.rx * c;
    return { x: orb.cx + lx, y: orb.cy + orb.ry * s - lx * orb.tilt, z: s };
  }

  function drawAuraCrystalMote(ctx, px, py, size, color, isStar, alpha, strokeColor) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(px), Math.round(py));
    ctx.fillStyle = color;
    if (isStar) {
      const r = size * 1.45;
      const w = Math.max(1.0, size * 0.34);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(w, -w);
      ctx.lineTo(r, 0);
      ctx.lineTo(w, w);
      ctx.lineTo(0, r);
      ctx.lineTo(-w, w);
      ctx.lineTo(-r, 0);
      ctx.lineTo(-w, -w);
      ctx.closePath();
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.15;
        ctx.stroke();
      }
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-0.75, -0.75, 1.5, 1.5);
    } else {
      const r = size;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.85, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.85, 0);
      ctx.closePath();
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAuraOrbitPass(ctx, orbits, tier, intensity, ampPct, t, cx, feetY, faceY, isFrontPass) {
    const faceSafeAlpha = (px, py) => (
      !isFrontPass ? 1.0 : (Math.abs(px - cx) < 22 && Math.abs(py - faceY) < 22 ? 0.20 : 1.0)
    );
    const ribbonAlphaMul = tier >= 3 ? 1.0 : tier >= 2 ? 0.94 : (0.68 + intensity * 0.26);

    ctx.save();
    for (let oIdx = 0; oIdx < orbits.length; oIdx++) {
      const orb = orbits[oIdx];
      const segs = 44;
      const shadowCol = isFrontPass ? orb.shadowColorFront : orb.shadowColorBack;
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < segs; i++) {
        const p0 = evalAuraOrbitPoint(orb, (i / segs) * Math.PI * 2);
        const p1 = evalAuraOrbitPoint(orb, ((i + 1) / segs) * Math.PI * 2);
        const midZ = (p0.z + p1.z) * 0.5;
        if (isFrontPass ? midZ < 0 : midZ >= 0) continue;
        const depthFactor = isFrontPass ? (0.50 + 0.50 * midZ) : (0.34 + 0.36 * (1 + midZ));
        const safe = faceSafeAlpha((p0.x + p1.x) * 0.5, (p0.y + p1.y) * 0.5);
        const mainW = isFrontPass ? orb.ribbonWidth * (0.78 + 0.44 * midZ) : orb.ribbonWidth * 0.70;
        if (shadowCol) {
          ctx.strokeStyle = shadowCol;
          ctx.globalAlpha = depthFactor * safe * ribbonAlphaMul;
          ctx.lineWidth = mainW + 1.8;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.strokeStyle = isFrontPass ? orb.ribbonColorFront : orb.ribbonColorBack;
        ctx.globalAlpha = depthFactor * safe * ribbonAlphaMul;
        ctx.lineWidth = mainW;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();

      const items = [];
      const dirSign = orb.speed >= 0 ? 1 : -1;
      for (let k = 0; k < orb.count; k++) {
        const angle = orb.phase + (k / orb.count) * Math.PI * 2;
        const pt = evalAuraOrbitPoint(orb, angle);
        if (isFrontPass ? pt.z < 0 : pt.z >= 0) continue;
        items.push({ k, angle, pt, dirSign });
      }
      items.sort((a, b) => a.pt.z - b.pt.z);

      for (let j = 0; j < items.length; j++) {
        const { k, angle, pt } = items[j];
        const depthNorm = (pt.z + 1) * 0.5;
        const safe = faceSafeAlpha(pt.x, pt.y);
        const baseColor = isFrontPass
          ? orb.paletteFront[k % orb.paletteFront.length]
          : orb.paletteBack[k % orb.paletteBack.length];
        const trailLen = isFrontPass ? orb.trailSteps : Math.max(2, Math.floor(orb.trailSteps * 0.45));
        let prev = pt;
        for (let stIdx = 1; stIdx <= trailLen; stIdx++) {
          const frac = stIdx / trailLen;
          const tp = evalAuraOrbitPoint(orb, angle - dirSign * frac * orb.trailArc);
          if (isFrontPass ? tp.z < -0.05 : tp.z > 0.05) break;
          ctx.save();
          ctx.lineCap = 'round';
          if (shadowCol && isFrontPass && stIdx <= 3) {
            ctx.strokeStyle = shadowCol;
            ctx.globalAlpha = (1 - frac) * 0.42 * safe;
            ctx.lineWidth = Math.max(1.4, 3.6 * (1 - frac * 0.65));
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(tp.x, tp.y);
            ctx.stroke();
          }
          ctx.strokeStyle = baseColor;
          ctx.globalAlpha = (1 - frac) * (isFrontPass ? (0.56 + 0.38 * pt.z) : 0.28) * safe;
          ctx.lineWidth = Math.max(0.9, (isFrontPass ? 2.7 : 1.35) * (1 - frac * 0.70));
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(tp.x, tp.y);
          ctx.stroke();
          ctx.restore();
          prev = tp;
        }
        const isStar = (k % orb.starEvery === 0);
        const size = (isStar ? 3.8 : 2.65) * (0.60 + depthNorm * 0.66);
        const alpha = (isFrontPass ? (0.86 + 0.14 * pt.z) : (0.42 + 0.34 * depthNorm)) * safe;
        if (isFrontPass && (isStar || tier >= 2)) {
          ctx.save();
          ctx.globalAlpha = (isStar ? 0.34 : 0.20) * safe;
          const haloR = size * 3.0;
          const halo = ctx.createRadialGradient(pt.x, pt.y, 0.4, pt.x, pt.y, haloR);
          halo.addColorStop(0, baseColor);
          halo.addColorStop(1, 'rgba(107, 197, 248, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, haloR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        drawAuraCrystalMote(ctx, pt.x, pt.y, size, baseColor, isStar, alpha, isFrontPass ? orb.moteStroke : '');
      }

      // >=20% 上升星尘微粒（10 -> 14 -> 18 颗；Tier 3 混入 #FFE59A 香槟金星尘与深琥珀衬影）
      if ((ampPct >= 0.195 || tier >= 2) && oIdx === 0) {
        const dustCount = tier >= 3 ? 18 : tier >= 2 ? 14 : 10;
        for (let i = 0; i < dustCount; i++) {
          const dustAngle = t * 1.15 + i * 2.13;
          const dustZ = Math.sin(dustAngle);
          if (isFrontPass ? dustZ < 0 : dustZ >= 0) continue;
          const prog = (t * 0.38 + i / dustCount) % 1;
          const rad = 42 + (i % 4) * 13 + Math.sin(t * 2 + i) * 4.5;
          const mx = cx + Math.cos(dustAngle) * rad;
          const my = feetY - 8 - prog * 154;
          const safe = faceSafeAlpha(mx, my);
          const fade = Math.sin(prog * Math.PI);
          const isGoldDust = tier >= 3 && i % 3 === 0;
          const dCol = isGoldDust ? '#FFE59A' : (isFrontPass ? '#D8FAFF' : '#589BE4');
          const dStroke = isFrontPass
            ? (isGoldDust ? 'rgba(116, 70, 12, 0.68)' : 'rgba(18, 62, 154, 0.52)')
            : '';
          drawAuraCrystalMote(
            ctx,
            mx,
            my,
            (isFrontPass ? 2.35 : 1.6) * (0.72 + 0.3 * fade),
            dCol,
            i % 4 === 0,
            fade * (isFrontPass ? 0.90 : 0.48) * safe,
            dStroke
          );
        }
      }
    }
    ctx.restore();
  }

  function renderManaAmpAura(st, now, simDt, reduced) {
    if (!st || st.key !== 'player') return;
    const amp = getManaAmpState(_lastBattleRef);
    const active = amp.active && !st.dead;
    const hasBurstEntities = !reduced && !st.dead && (_auraShockwaves.length > 0 || _auraBurstParticles.length > 0);

    if (st.dead) {
      _auraShockwaves.length = 0;
      _auraBurstParticles.length = 0;
    }

    if (!active && !hasBurstEntities) {
      if (_auraDirty) {
        if (st.auraBackCtx) st.auraBackCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);
        if (st.auraFrontCtx) st.auraFrontCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);
        st._auraTierTag = '';
        _auraDirty = false;
        _auraLastTier = 0;
        _auraLastIntensity = 0;
        _auraBurstTs = 0;
        _auraBurstTier = 0;
        const s3dOff = global.CombatStage3D;
        if (s3dOff && typeof s3dOff.isActive === 'function' && s3dOff.isActive() && typeof s3dOff.syncPlayerAuraCanvases === 'function') {
          s3dOff.syncPlayerAuraCanvases(st.auraBackEl || null, st.auraFrontEl || null, false);
        }
      }
      return;
    }

    if (!ensurePlayerAuraCanvases(st)) return;

    const cx = AURA_BUF_W * 0.5;
    const feetY = AURA_BUF_H * 0.75;
    const torsoY = feetY - 64;
    const faceY = feetY - 102;
    const stepDt = clamp(simDt || 0.016, 0.004, 0.06);

    // 仅剩退场棱镜冲击波/碎片粒子时继续 60fps 收尾绘制，避免骤然截断
    if (!active && hasBurstEntities) {
      st._auraTierTag = '';
      _lastAuraDrawTs = now;
      _auraLastTier = 0;
      _auraLastIntensity = 0;
      _auraDirty = true;
      stepAuraBurstEntities(stepDt);
      st.auraBackCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);
      st.auraFrontCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);
      drawAuraBurstPass(st.auraBackCtx, cx, faceY, false);
      drawAuraBurstPass(st.auraFrontCtx, cx, faceY, true);
      st.auraBackCtx.globalAlpha = 1;
      st.auraFrontCtx.globalAlpha = 1;
      const s3dBurst = global.CombatStage3D;
      if (s3dBurst && typeof s3dBurst.isActive === 'function' && s3dBurst.isActive() && typeof s3dBurst.syncPlayerAuraCanvases === 'function') {
        s3dBurst.syncPlayerAuraCanvases(st.auraBackEl, st.auraFrontEl, true);
      }
      return;
    }

    const tierTag = amp.tier >= 3 ? 'tier3' : (amp.tier >= 2 ? 'full' : (amp.tier >= 1 ? 'half' : 'charge'));
    const intensityChanged = Math.abs(_auraLastIntensity - amp.intensity) > 0.03;
    const burstAgeMs = _auraBurstTs > 0 ? (now - _auraBurstTs) : 9999;
    const hasActiveBurst = !reduced && (hasBurstEntities || (burstAgeMs >= 0 && burstAgeMs < 680));
    if (st._auraTierTag !== tierTag || intensityChanged) {
      st._auraTierTag = tierTag;
      _lastAuraDrawTs = 0; // 切换档位或滑条显著变化时立即重绘
    }

    // 降动效模式下仅绘制一次静态 3D 水晶阵列，零连续重绘
    if (reduced && _auraDirty && _auraLastTier === amp.tier && !intensityChanged) return;
    if (
      !hasActiveBurst &&
      _lastAuraDrawTs > 0 &&
      (now - _lastAuraDrawTs) < AURA_INTERVAL_MS &&
      _auraLastTier === amp.tier &&
      !intensityChanged
    ) {
      return;
    }

    _lastAuraDrawTs = now;
    _auraLastTier = amp.tier;
    _auraLastIntensity = amp.intensity;
    _auraDirty = true;
    if (!reduced) {
      _auraElapsed += stepDt;
      if (hasBurstEntities) {
        stepAuraBurstEntities(stepDt);
      }
    }

    const bCtx = st.auraBackCtx;
    const fCtx = st.auraFrontCtx;
    bCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);
    fCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);

    const t = _auraElapsed;
    const tier = amp.tier;
    const intensity = Math.max(amp.intensity, 0.25);

    // 1) 脚底魔阵基底与 1 / 2 / 3 层旋转虚线符文阵（tier 1/2/3 逐圈递增，雪瓷浅底始终保留 1px 深靛/深琥珀衬影）
    bCtx.save();
    bCtx.beginPath();
    bCtx.ellipse(cx, feetY, tier >= 3 ? 72 : 62, tier >= 3 ? 20 : 17, 0, 0, Math.PI * 2);
    bCtx.fillStyle = tier >= 3 ? 'rgba(22, 82, 196, 0.20)' : 'rgba(40, 120, 190, 0.16)';
    bCtx.fill();
    bCtx.strokeStyle = tier >= 3 ? 'rgba(18, 72, 188, 0.80)' : 'rgba(46, 148, 232, 0.78)';
    bCtx.lineWidth = tier >= 2 ? 2.1 : 1.4;
    bCtx.stroke();

    const groundRings = tier >= 3 ? 3 : tier >= 2 ? 2 : 1;
    for (let r = 0; r < groundRings; r++) {
      const rx = 52 + r * 18;
      const ry = 14 + r * 5.5;
      const rot = t * (1.4 + r * 0.6) * (r % 2 === 0 ? 1 : -1);
      bCtx.save();
      bCtx.translate(cx, feetY);
      bCtx.scale(1, ry / rx);
      bCtx.rotate(rot);
      bCtx.setLineDash([10, 6]);
      // 1px 深琥珀 / 深靛外衬影
      bCtx.strokeStyle = r === 2
        ? 'rgba(116, 72, 12, 0.74)'
        : 'rgba(14, 52, 140, 0.50)';
      bCtx.lineWidth = r === 2 ? 4.1 : 3.2;
      bCtx.beginPath();
      bCtx.arc(0, 0, rx, 0, Math.PI * 2);
      bCtx.stroke();

      bCtx.strokeStyle = r === 2
        ? 'rgba(255, 224, 128, 0.98)'
        : `rgba(115, 232, 255, ${(0.56 + intensity * 0.40).toFixed(2)})`;
      bCtx.lineWidth = r === 2 ? 2.2 : 1.9;
      bCtx.beginPath();
      bCtx.arc(0, 0, rx, 0, Math.PI * 2);
      bCtx.stroke();
      bCtx.setLineDash([]);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const nx = Math.cos(a) * rx;
        const ny = Math.sin(a) * rx;
        bCtx.fillStyle = r === 2 ? '#78480c' : '#123d9c';
        bCtx.fillRect(nx - 3.6, ny - 3.6, 7.2, 7.2);
        bCtx.fillStyle = r === 2 ? '#ffe99e' : '#ccf8ff';
        bCtx.fillRect(nx - 2.4, ny - 2.4, 4.8, 4.8);
      }
      bCtx.restore();
    }

    // 2) 角色背后径向冷光脉冲 + Tier 3 扩散椭圆波纹（克制不透明度，绝不糊脸烧白）
    const pulse = 0.5 + 0.5 * Math.sin(t * 5.2);
    const auraR = 76 + intensity * 30 + (tier >= 3 ? pulse * 10 : 0);
    const auraGrad = bCtx.createRadialGradient(cx, torsoY, 10, cx, torsoY, auraR);
    if (tier >= 3) {
      auraGrad.addColorStop(0, `rgba(255, 226, 138, ${(0.22 + pulse * 0.12).toFixed(2)})`);
      auraGrad.addColorStop(0.52, `rgba(42, 122, 245, ${(0.20 + pulse * 0.08).toFixed(2)})`);
      auraGrad.addColorStop(1, 'rgba(22, 88, 235, 0)');
    } else {
      auraGrad.addColorStop(0, `rgba(130, 236, 255, ${(0.12 + intensity * 0.22).toFixed(2)})`);
      auraGrad.addColorStop(1, 'rgba(60, 160, 255, 0)');
    }
    bCtx.fillStyle = auraGrad;
    bCtx.beginPath();
    bCtx.arc(cx, torsoY, auraR, 0, Math.PI * 2);
    bCtx.fill();

    if (tier >= 3) {
      const waveProg = (t * 0.85) % 1;
      const wr = 42 + waveProg * 62;
      bCtx.save();
      bCtx.globalAlpha = (1 - waveProg) * 0.56;
      bCtx.strokeStyle = waveProg < 0.5 ? 'rgba(18, 68, 186, 0.72)' : 'rgba(128, 82, 16, 0.72)';
      bCtx.lineWidth = 3.2 * (1 - waveProg * 0.55);
      bCtx.beginPath();
      bCtx.ellipse(cx, torsoY, wr, wr * 0.72, 0, 0, Math.PI * 2);
      bCtx.stroke();
      bCtx.strokeStyle = waveProg < 0.5 ? '#8BF2FF' : '#FFE39A';
      bCtx.lineWidth = 1.8 * (1 - waveProg * 0.55);
      bCtx.beginPath();
      bCtx.ellipse(cx, torsoY, wr, wr * 0.72, 0, 0, Math.PI * 2);
      bCtx.stroke();
      bCtx.restore();
    }
    bCtx.restore();

    // 3) 真 3D 前后景深轨道环 + >=20% 上升星尘微粒（10->18）
    const orbits = getManaAmpOrbits(tier, t, cx, feetY);
    drawAuraOrbitPass(bCtx, orbits, tier, intensity, amp.ampPct, t, cx, feetY, faceY, false);
    drawAuraOrbitPass(fCtx, orbits, tier, intensity, amp.ampPct, t, cx, feetY, faceY, true);

    // 4) >=40% 叠加轻盈冰蓝双侧电弧；60% 全面升级香槟金三环 + 清晰冰雷电弧脉冲（1px 深靛/深琥珀衬影）
    if (tier === 2) {
      const glintPulse = 0.62 + 0.38 * Math.sin(t * 6.4);
      const jitterPhase = Math.floor(t * 11);
      fCtx.save();
      fCtx.lineJoin = 'miter';
      fCtx.lineCap = 'round';
      for (let sIdx = 0; sIdx < 2; sIdx++) {
        const side = sIdx === 0 ? -1 : 1;
        const jA = Math.sin(jitterPhase * 1.7 + side * 2.0) * 3.2;
        const bx = cx + side * (54 + Math.sin(t * 4.5 + side) * 6);
        const by = feetY - 68 + Math.cos(t * 3.8 + side) * 10;
        const pts = [
          [bx, by + 18],
          [bx + side * (8 + jA * 0.45), by + 1],
          [bx - side * (4 - jA * 0.3), by - 18],
        ];
        const strokeArc = (col, lw) => {
          fCtx.strokeStyle = col;
          fCtx.lineWidth = lw;
          fCtx.beginPath();
          fCtx.moveTo(pts[0][0], pts[0][1]);
          for (let p = 1; p < pts.length; p++) fCtx.lineTo(pts[p][0], pts[p][1]);
          fCtx.stroke();
        };
        strokeArc(`rgba(16, 58, 174, ${(0.58 * glintPulse).toFixed(2)})`, 2.9);
        strokeArc(`rgba(134, 232, 255, ${(0.92 * glintPulse).toFixed(2)})`, 1.45);
        strokeArc(`rgba(255, 255, 255, ${(0.86 * glintPulse).toFixed(2)})`, 0.72);
        drawAuraCrystalMote(fCtx, pts[1][0], pts[1][1], 2.0 * glintPulse, '#D6FBFF', true, 0.84 * glintPulse, 'rgba(16, 58, 168, 0.64)');
      }
      fCtx.restore();
    } else if (tier >= 3) {
      const glintPulse = 0.74 + 0.26 * Math.sin(t * 7.2);
      const jitterPhase = Math.floor(t * 14);
      fCtx.save();
      fCtx.lineJoin = 'miter';
      fCtx.lineCap = 'round';
      for (let sIdx = 0; sIdx < 2; sIdx++) {
        const side = sIdx === 0 ? -1 : 1;
        const jA = Math.sin(jitterPhase * 1.9 + side * 2.1) * 4.8;
        const jB = Math.cos(jitterPhase * 2.3 + side * 1.4) * 5.2;
        const bx = cx + side * (58 + Math.sin(t * 4.5 + side) * 7);
        const by = feetY - 70 + Math.cos(t * 3.8 + side) * 10;
        const pts = [
          [bx - side * 2, by + 24],
          [bx + side * (8 + jA * 0.5), by + 9],
          [bx - side * (3 - jB * 0.4), by - 2],
          [bx + side * (9 + jB * 0.5), by - 15],
          [bx - side * 2, by - 28],
        ];
        const strokeBolt = (col, lw) => {
          fCtx.strokeStyle = col;
          fCtx.lineWidth = lw;
          fCtx.beginPath();
          fCtx.moveTo(pts[0][0], pts[0][1]);
          for (let p = 1; p < pts.length; p++) fCtx.lineTo(pts[p][0], pts[p][1]);
          fCtx.stroke();
        };
        strokeBolt(`rgba(16, 62, 198, ${(0.78 * glintPulse).toFixed(2)})`, 4.0);
        strokeBolt(`rgba(92, 228, 255, ${(0.96 * glintPulse).toFixed(2)})`, 2.1);
        strokeBolt(`rgba(255, 248, 214, ${(0.98 * glintPulse).toFixed(2)})`, 0.98);

        // 短分支香槟金冰雷叉弧
        const forkX = pts[2][0] + side * (12 + jA * 0.4);
        const forkY = pts[2][1] - 8;
        fCtx.strokeStyle = `rgba(116, 70, 12, ${(0.72 * glintPulse).toFixed(2)})`;
        fCtx.lineWidth = 2.7;
        fCtx.beginPath();
        fCtx.moveTo(pts[2][0], pts[2][1]);
        fCtx.lineTo(forkX, forkY);
        fCtx.stroke();
        fCtx.strokeStyle = `rgba(255, 226, 134, ${(0.96 * glintPulse).toFixed(2)})`;
        fCtx.lineWidth = 1.3;
        fCtx.beginPath();
        fCtx.moveTo(pts[2][0], pts[2][1]);
        fCtx.lineTo(forkX, forkY);
        fCtx.stroke();

        // 电核香槟金与霜白十字星芒
        drawAuraCrystalMote(fCtx, pts[1][0], pts[1][1], 2.8 * glintPulse, '#FFE28A', true, 0.95 * glintPulse, 'rgba(116, 70, 12, 0.80)');
        drawAuraCrystalMote(fCtx, pts[3][0], pts[3][1], 2.5 * glintPulse, '#C8FAFF', true, 0.92 * glintPulse, 'rgba(16, 58, 168, 0.74)');
      }
      fCtx.restore();
    }

    // 5) 1:1 复刻标杆的棱镜冲击波环 + 旋转四菱棱晶碎片爆破（全部 tier >= 1 触发，前后景深分层）
    if (hasBurstEntities) {
      drawAuraBurstPass(bCtx, cx, faceY, false);
      drawAuraBurstPass(fCtx, cx, faceY, true);
    }

    bCtx.globalAlpha = 1;
    fCtx.globalAlpha = 1;
    const s3dAura = global.CombatStage3D;
    if (s3dAura && typeof s3dAura.isActive === 'function' && s3dAura.isActive() && typeof s3dAura.syncPlayerAuraCanvases === 'function') {
      s3dAura.syncPlayerAuraCanvases(st.auraBackEl, st.auraFrontEl, tier > 0);
    }
  }

  function spawnDashGhost(st, tone) {
    if (!st || prefersReducedMotion()) return;
    const s3d = global.CombatStage3D;
    if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.spawnDashGhost === 'function') {
      s3d.spawnDashGhost(st.key, {
        spriteId: st.spriteId,
        frame: st.frame | 0,
        dx: st.dx,
        dy: st.dy,
        tone: tone || 'ice',
        flipped: !!st.flipped,
      });
    }
  }

  /* -------------------- Canvas 2D pixelfx 缓冲管理 -------------------- */
  function computeTargetVfxBufSize(w, h) {
    const safeW = Math.max(1, Number(w) || 960);
    const safeH = Math.max(1, Number(h) || 440);
    const targetW = safeW < 520 ? 224 : 320;
    const targetH = clamp(Math.round(targetW * (safeH / safeW)), 96, 240);
    return { targetW, targetH };
  }

  function observeArenaField(field) {
    if (!field || typeof global.ResizeObserver !== 'function' || isJsdomEnv()) return;
    if (_observedFieldEl === field && _fieldResizeObserver) return;
    if (_fieldResizeObserver) {
      try { _fieldResizeObserver.disconnect(); } catch (e) {}
    }
    try {
      _fieldResizeObserver = new global.ResizeObserver(() => {
        const bs = document.getElementById('battle-screen');
        if (!bs || bs.classList.contains('hidden')) return;
        _lastLayoutSig = '';
        invalidateFieldRect();
        ensureVfxCanvas(true);
      });
      _fieldResizeObserver.observe(field);
      _observedFieldEl = field;
    } catch (e) {
      _fieldResizeObserver = null;
      _observedFieldEl = null;
    }
  }

  let _editionAAliasesPatched = false;
  let _enemyActionEpoch = 0;
  const _enemyActionGen = new Map();
  let _lastGateBlockFx = null;

  function ensureEditionAAliases(api) {
    if (_editionAAliasesPatched || !api) return;
    _editionAAliasesPatched = true;
    try {
      if (typeof api.registerAliases === 'function') {
        api.registerAliases({ move_afterimage: ['wind_afterimage', 'sword_root_step'] });
      } else if (api.SKILL_ALIASES) {
        api.SKILL_ALIASES.move_afterimage = ['wind_afterimage', 'sword_root_step'];
      }
    } catch (e) {}
  }

  function createNoopActionHandle() {
    return {
      releaseGate() {},
      releaseAll() {},
      finishActorReturn() {},
      donePromise: Promise.resolve(),
    };
  }

  function getEditionAApi() {
    const api = global.VfxEditionAFull;
    if (api && typeof api.create === 'function' && typeof api.resolveSkillId === 'function') {
      ensureEditionAAliases(api);
      return api;
    }
    return null;
  }

  function hasEditionA() {
    return !!(isEnabled() && _editionA && getEditionAApi());
  }

  function editionAShakeToTrauma(intensity) {
    const val = Number(intensity) || 0;
    if (val <= 0) return 0;
    if (val <= 1) return clamp(val, 0.12, 0.9);
    return clamp(val / 13.5, 0.18, 0.88);
  }

  function playEditionA(skillId, opts) {
    if (!hasEditionA()) return null;
    const resolved = _editionA.play(skillId, opts || {});
    _editionADirty = true;
    _editionAForceRender = true;
    ensureLoopRunning();
    return resolved;
  }

  function resizeEditionACanvas(hdCanvas, edApi, w, h) {
    if (!edApi || !hdCanvas) return;
    const rawDpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    // 桌面宽屏舞台 (>= 1200px，如 1280×720 / 1440×900) 收敛 DPR 上限至 1.0，逻辑画布本就是 640×360，避免填充率暴增 2.25×
    const maxDpr = w >= 1200 ? 1.0 : 1.5;
    const dpr = Math.min(rawDpr, maxDpr);
    const hdW = clamp(Math.round(w * dpr), 640, 1440);
    const hdH = clamp(Math.round(h * dpr), 360, 810);
    const canvasChanged = _hdCanvas !== hdCanvas || !_editionA;
    if (
      canvasChanged ||
      Math.abs(_hdW - hdW) >= 2 ||
      Math.abs(_hdH - hdH) >= 2 ||
      hdCanvas.width !== hdW ||
      hdCanvas.height !== hdH
    ) {
      if (canvasChanged && _editionA && typeof _editionA.clear === 'function') {
        try { _editionA.clear(); } catch (e) {}
      }
      _hdCanvas = hdCanvas;
      _hdW = hdW;
      _hdH = hdH;
      _hdCanvas.width = _hdW;
      _hdCanvas.height = _hdH;
      if (canvasChanged) {
        _editionA = edApi.create(_hdCanvas, { autoClear: true });
        _editionADirty = false;
        _editionALastRenderTs = 0;
        _editionAForceRender = true;
      }
    }
  }

  function toLogicalPt(pt) {
    const bw = _bufW || 320;
    const bh = _bufH || 160;
    const lx = clamp((pt && Number.isFinite(pt.x) ? pt.x : bw * 0.5) * (640 / bw), 8, 632);
    const ly = clamp((pt && Number.isFinite(pt.y) ? pt.y : bh * 0.65) * (360 / bh), 8, 352);
    return { x: Math.round(lx * 10) / 10, y: Math.round(ly * 10) / 10 };
  }

  function toLogicalPts(pts) {
    if (!pts) {
      return {
        anchor: { x: 160, y: 286 },
        cast: { x: 176, y: 216 },
        hit: { x: 160, y: 218 },
        head: { x: 160, y: 156 },
        groundY: 286,
      };
    }
    const anchor = toLogicalPt(pts.anchor);
    const hit = toLogicalPt(pts.hit);
    const rawCast = toLogicalPt(pts.cast);
    const cast = {
      x: Math.round(clamp(lerp(hit.x, rawCast.x, 0.4), 8, 632) * 10) / 10,
      y: rawCast.y,
    };
    const head = toLogicalPt(pts.head);
    return {
      anchor,
      cast,
      hit,
      head,
      groundY: anchor.y,
    };
  }

  function ensureVfxCanvas(forceMeasure) {
    if (!isEnabled()) return null;
    const field = document.querySelector('#battle-screen .cb-arena-field');
    if (!field) return null;
    observeArenaField(field);

    let canvas = field.querySelector('#cb-pixel-vfx-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'cb-pixel-vfx-canvas';
      canvas.className = 'cb-pixel-vfx-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      field.appendChild(canvas);
    }

    const edApi = getEditionAApi();
    let hdCanvas = field.querySelector('#cb-vfx-edition-a-canvas');
    if (!hdCanvas && edApi) {
      hdCanvas = document.createElement('canvas');
      hdCanvas.id = 'cb-vfx-edition-a-canvas';
      hdCanvas.className = 'cb-vfx-edition-a-canvas';
      hdCanvas.setAttribute('aria-hidden', 'true');
      field.appendChild(hdCanvas);
    }

    if (
      !forceMeasure &&
      _cachedFieldRect &&
      _cachedFieldRect.el === field &&
      _canvas === canvas &&
      _frame &&
      _ctx &&
      _imgData &&
      _bufW > 0 &&
      _bufH > 0 &&
      (!edApi || (_hdCanvas === hdCanvas && _editionA && _hdW > 0 && _hdH > 0))
    ) {
      return _canvas;
    }

    const rect = getFieldRect(field, !!forceMeasure) || { width: 0, height: 0 };
    const hasRealSize = !!(rect && rect.width > 32 && rect.height > 32);
    if (!hasRealSize) {
      // 舞台尚未完成布局时不锁定签名，下一帧/ResizeObserver 立即重新对齐真实纵横比
      _lastLayoutSig = '';
    }
    const w = hasRealSize ? rect.width : 960;
    const h = hasRealSize ? rect.height : 440;
    // 软光栅像素缓冲严格对齐真实舞台纵横比（杜绝首战 320×137 拉伸畸变与坐标沉地）
    const { targetW, targetH } = computeTargetVfxBufSize(w, h);

    if (
      _canvas !== canvas ||
      !_frame ||
      !_ctx ||
      !_imgData ||
      Math.abs(_bufW - targetW) >= 2 ||
      Math.abs(_bufH - targetH) >= 2 ||
      canvas.width !== targetW ||
      canvas.height !== targetH
    ) {
      _canvas = canvas;
      _bufW = targetW;
      _bufH = targetH;
      _canvas.width = _bufW;
      _canvas.height = _bufH;
      _ctx = _canvas.getContext('2d', { alpha: true });
      if (_ctx) {
        _ctx.imageSmoothingEnabled = false;
        _imgData = _ctx.createImageData(_bufW, _bufH);
      }
      if (global.PixelFX && typeof global.PixelFX.createFrame === 'function') {
        _frame = global.PixelFX.createFrame(_bufW, _bufH);
      }
    }

    if (edApi && hdCanvas) {
      resizeEditionACanvas(hdCanvas, edApi, w, h);
    }
    return _canvas;
  }

  function ensureSubFxBuffer(w, h) {
    if (_subFxFrame && _subFxCanvas && _subFxCtx && _subFxImgData && _subFxW === w && _subFxH === h) {
      return true;
    }
    const PFX = global.PixelFX;
    if (!PFX || typeof PFX.createFrame !== 'function' || typeof document === 'undefined') return false;
    if (!_subFxCanvas) {
      _subFxCanvas = document.createElement('canvas');
    }
    _subFxW = w;
    _subFxH = h;
    _subFxCanvas.width = w;
    _subFxCanvas.height = h;
    _subFxCtx = _subFxCanvas.getContext('2d', { alpha: true });
    if (!_subFxCtx) return false;
    _subFxCtx.imageSmoothingEnabled = false;
    _subFxImgData = _subFxCtx.createImageData(w, h);
    _subFxFrame = PFX.createFrame(w, h);
    return true;
  }

  function clampCanvasPt(pt) {
    const maxX = Math.max(12, (_bufW || 320) - 4);
    const maxY = Math.max(12, (_bufH || 160) - 4);
    return {
      x: clamp(Number.isFinite(pt.x) ? pt.x : maxX * 0.5, 4, maxX),
      y: clamp(Number.isFinite(pt.y) ? pt.y : maxY * 0.65, 4, maxY),
    };
  }

  function getActorCanvasPoints(actorKey, includeDash, forceFresh) {
    ensureVfxCanvas(!!forceFresh);
    const s3d = global.CombatStage3D;
    if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.projectActorPoints === 'function') {
      const p3 = s3d.projectActorPoints(actorKey, !!includeDash);
      if (p3 && p3.anchor && p3.hit) {
        const cachedRect = _cachedFieldRect && _cachedFieldRect.rect ? _cachedFieldRect.rect : null;
        const fieldW = Math.max(1, Number(p3.fieldW) || (cachedRect && cachedRect.width) || 960);
        const fieldH = Math.max(1, Number(p3.fieldH) || (cachedRect && cachedRect.height) || 440);
        if (fieldW > 32 && fieldH > 32 && _bufW > 0 && _bufH > 0) {
          const exp = computeTargetVfxBufSize(fieldW, fieldH);
          if (Math.abs(_bufW - exp.targetW) >= 2 || Math.abs(_bufH - exp.targetH) >= 2) {
            ensureVfxCanvas(true);
          }
        }
        const bw = _bufW || 320;
        const bh = _bufH || 160;
        const scaleX = bw / fieldW;
        const scaleY = bh / fieldH;
        const toBuf = (pt, fallbackPt) => {
          const src = (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) ? pt : fallbackPt;
          return clampCanvasPt({ x: src.x * scaleX, y: src.y * scaleY });
        };
        const anchorCss = p3.anchor;
        const hitCss = p3.hit || anchorCss;
        const castCss = p3.cast || hitCss;
        const headCss = p3.head || hitCss;
        return {
          anchor: toBuf(anchorCss, anchorCss),
          cast: toBuf(castCss, hitCss),
          hit: toBuf(hitCss, anchorCss),
          head: toBuf(headCss, hitCss),
          screenX: Number.isFinite(p3.screenX) ? p3.screenX : anchorCss.x,
          screenY: Number.isFinite(p3.screenY) ? p3.screenY : anchorCss.y,
          screenW: Number.isFinite(p3.screenW) ? p3.screenW : 120,
          screenH: Number.isFinite(p3.screenH) ? p3.screenH : 120,
          fieldW,
          fieldH,
        };
      }
    }

    // 无 WebGL / 无头测试极简数学坐标兜底桩（不测量 2D DOM 坐标）
    const keyStr = String(actorKey || 'player');
    const isPlayer = keyStr === 'player';
    const isAlly = keyStr.startsWith('ally:');
    const isLeft = isPlayer || isAlly;
    const cachedRect = _cachedFieldRect && _cachedFieldRect.rect ? _cachedFieldRect.rect : null;
    const fieldW = (cachedRect && cachedRect.width > 32) ? cachedRect.width : 960;
    const fieldH = (cachedRect && cachedRect.height > 32) ? cachedRect.height : 440;
    const bw = _bufW || 320;
    const bh = _bufH || 160;
    const scaleX = bw / fieldW;
    const scaleY = bh / fieldH;
    const enemyIdx = !isLeft ? (Number(keyStr.split(':')[1]) || 0) : 0;
    const normX = isPlayer ? 0.22 : (isAlly ? 0.30 : clamp(0.72 + (enemyIdx % 2) * 0.08, 0.64, 0.86));
    const normY = isLeft ? 0.74 : clamp(0.66 + Math.floor(enemyIdx / 2) * 0.08, 0.56, 0.82);
    const st = _actors.get(keyStr);
    const dx = (includeDash && st) ? st.dx : 0;
    const dy = (includeDash && st) ? st.dy : 0;
    const dxC = dx * scaleX;
    const dyC = dy * scaleY;
    const baseX = bw * normX;
    const baseY = bh * normY;
    return {
      anchor: clampCanvasPt({ x: baseX + dxC, y: baseY + dyC }),
      cast: clampCanvasPt({ x: baseX + (isLeft ? 24 : -24) + dxC, y: baseY - bh * 0.18 + dyC }),
      hit: clampCanvasPt({ x: baseX + dxC, y: baseY - bh * 0.16 + dyC }),
      head: clampCanvasPt({ x: baseX + dxC, y: baseY - bh * 0.34 + dyC }),
      screenX: fieldW * normX + dx,
      screenY: fieldH * normY + dy,
      screenW: 120,
      screenH: 120,
      fieldW,
      fieldH,
    };
  }

  /* 将角色 hit 锚点转换为 #battle-screen .cb-arena-field 相对 CSS 坐标 { x, y, fieldW, fieldH } */
  function getActorScreenPoint(actorKey) {
    const key = actorKey ? String(actorKey) : 'player';
    if (typeof document === 'undefined') {
      const isLeft = key === 'player' || key.startsWith('ally:');
      return {
        x: Math.round(960 * (isLeft ? 0.2 : 0.72) * 10) / 10,
        y: Math.round(440 * 0.56 * 10) / 10,
        fieldW: 960,
        fieldH: 440,
      };
    }
    const pts = getActorCanvasPoints(key, false);
    const bw = _bufW || 320;
    const bh = _bufH || 160;
    const fieldW = (pts && Number.isFinite(pts.fieldW) && pts.fieldW > 0) ? pts.fieldW : 960;
    const fieldH = (pts && Number.isFinite(pts.fieldH) && pts.fieldH > 0) ? pts.fieldH : 440;
    const hitX = (pts && pts.hit && Number.isFinite(pts.hit.x)) ? pts.hit.x : bw * 0.5;
    const hitY = (pts && pts.hit && Number.isFinite(pts.hit.y)) ? pts.hit.y : bh * 0.56;
    return {
      x: Math.round((hitX / bw) * fieldW * 10) / 10,
      y: Math.round((hitY / bh) * fieldH * 10) / 10,
      fieldW,
      fieldH,
    };
  }

  function resolveVfxIdForTiming(skillOrMoveId, isEnemy) {
    const edApi = getEditionAApi();
    if (!edApi) return null;
    if (skillOrMoveId && typeof skillOrMoveId === 'object') {
      const candList = [
        skillOrMoveId.vfxId,
        skillOrMoveId.moveName,
        skillOrMoveId.moveKey,
        skillOrMoveId.skillId,
        skillOrMoveId.id,
        skillOrMoveId.spriteId ? `enemy_${skillOrMoveId.spriteId}` : null,
      ];
      for (let i = 0; i < candList.length; i++) {
        if (!candList[i]) continue;
        if (candList[i] === 'move_afterimage') {
          const mvHit = edApi.resolveSkillId('wind_afterimage') || edApi.resolveSkillId('sword_root_step');
          if (mvHit) return mvHit;
        }
        const hit = edApi.resolveSkillId(candList[i]);
        if (hit) return hit;
      }
      return isEnemy ? 'enemy_wolf_frost_claw' : 'ice_crystal';
    }
    const raw = skillOrMoveId != null ? String(skillOrMoveId).trim() : '';
    if (!raw) return isEnemy ? 'enemy_wolf_frost_claw' : 'ice_crystal';
    if (isEnemy) {
      return (
        edApi.resolveSkillId(raw) ||
        edApi.resolveSkillId(`enemy_${raw}`) ||
        'enemy_wolf_frost_claw'
      );
    }
    if (raw === 'move_afterimage') {
      return (
        edApi.resolveSkillId('wind_afterimage') ||
        edApi.resolveSkillId('sword_root_step') ||
        edApi.resolveSkillId(raw) ||
        'wind_afterimage'
      );
    }
    if (raw === 'hand_root_shield') {
      return (
        (typeof edApi.hasSkill === 'function' && edApi.hasSkill('prism_aegis') && edApi.resolveSkillId('prism_aegis')) ||
        edApi.resolveSkillId('steel_ice_curtain') ||
        edApi.resolveSkillId(raw) ||
        'ice_crystal'
      );
    }
    return edApi.resolveSkillId(raw) || 'ice_crystal';
  }

  function resolveVfxPeakMs(skillOrMoveId, isEnemy) {
    const edApi = getEditionAApi();
    if (!edApi || typeof edApi.getPeakTime !== 'function') {
      return isEnemy ? 420 : 480;
    }
    const resolvedId = resolveVfxIdForTiming(skillOrMoveId, !!isEnemy);
    return edApi.getPeakTime(resolvedId);
  }

  function setSlowMoScale(scale) {
    const prev = _slowMoScale;
    const next = clamp(Number(scale) || 1, 0.05, 1.0);
    _slowMoScale = next;
    const s3d = global.CombatStage3D;
    if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.setTimeScale === 'function') {
      s3d.setTimeScale(_hitStopScale * _slowMoScale);
    }
    if (prev < 0.99 && next >= 0.99) {
      _editionAForceRender = true;
      if (_scheduled.length > 0) {
        const now = nowPerf();
        for (let i = 0; i < _scheduled.length; i++) {
          const item = _scheduled[i];
          if (item && item.wait > 0) {
            item.dueAt = Math.max(item.dueAt || 0, now + item.wait * 1000);
          }
        }
      }
    }
    return _slowMoScale;
  }

  function getSlowMoScale() {
    return _slowMoScale;
  }

  /* -------------------- PixelFX 特效调度 -------------------- */
  function evictOldestEffect() {
    if (!_activeEffects.length) return;
    let evictIdx = -1;
    for (let i = 0; i < _activeEffects.length; i++) {
      if (_activeEffects[i].stopped) {
        evictIdx = i;
        break;
      }
    }
    if (evictIdx < 0) evictIdx = 0;
    const removed = _activeEffects.splice(evictIdx, 1)[0];
    if (removed && removed.onDone) {
      try { removed.onDone(); } catch (e) {}
    }
  }

  const SECONDARY_FX = new Set(['snowflake_burst', 'hit_spark', 'magic_circle_cast']);
  let _burstWindowStart = 0;
  let _burstCreateCount = 0;

  function spawnFx(fxName, opts, control) {
    if (!isEnabled()) return null;
    const PFX = global.PixelFX;
    if (!PFX || !PFX.FX || !PFX.FX[fxName]) return null;
    ensureVfxCanvas(false);
    if (!_frame || !_ctx) return null;

    control = control || {};
    const def = PFX.FX[fxName];
    const now = nowPerf();

    // 限制单帧/45ms 突发窗口内最多构造 2 个新 PixelFX（保留投射物 onUpdate），避免多目标群攻同帧构造 9 个特效后立即淘汰
    if (now - _burstWindowStart > 45) {
      _burstWindowStart = now;
      _burstCreateCount = 0;
    }
    const cap = _fxIntervalMs > FX_BASE_INTERVAL_MS ? MAX_ACTIVE_EFFECTS_THROTTLED : MAX_ACTIVE_EFFECTS;
    if (!control.onUpdate) {
      if (SECONDARY_FX.has(fxName) && _activeEffects.length >= cap) {
        if (typeof control.onDone === 'function') {
          try { control.onDone(); } catch (e) {}
        }
        return null;
      }
      if (_burstCreateCount >= 2 && _activeEffects.length >= cap) {
        if (typeof control.onDone === 'function') {
          try { control.onDone(); } catch (e) {}
        }
        return null;
      }
    }

    // 按当前软缓冲分辨率比例自适应缩放显式几何尺寸（preserveLength 时保留实测画布射程，避免水柱半途截断）
    const mergedOpts = Object.assign({ seed: nextSeed() }, opts || {});
    if ('palette' in mergedOpts && (!Array.isArray(mergedOpts.palette) || !mergedOpts.palette.length)) {
      delete mergedOpts.palette;
    }
    if ('sparks' in mergedOpts && (!Array.isArray(mergedOpts.sparks) || !mergedOpts.sparks.length)) {
      delete mergedOpts.sparks;
    }
    const spatialRatio = _bufW > 0 && _bufW < 380 ? clamp(_bufW / 440, 0.50, 0.80) : 1;
    if (spatialRatio < 1) {
      if (typeof mergedOpts.reach === 'number') mergedOpts.reach = Math.max(20, Math.round(mergedOpts.reach * spatialRatio));
      if (typeof mergedOpts.height === 'number') mergedOpts.height = Math.max(18, Math.round(mergedOpts.height * spatialRatio));
      if (typeof mergedOpts.radius === 'number') mergedOpts.radius = Math.max(12, Math.round(mergedOpts.radius * spatialRatio));
      if (typeof mergedOpts.length === 'number' && !control.preserveLength) {
        mergedOpts.length = Math.max(24, Math.round(mergedOpts.length * spatialRatio));
      }
    }
    if (!Number.isFinite(mergedOpts.x)) mergedOpts.x = _bufW * 0.5;
    if (!Number.isFinite(mergedOpts.y)) mergedOpts.y = _bufH * 0.65;

    // 合并 55ms 内同位置重复触发的同类特效，避免多目标/连点无意义叠加
    for (let i = _activeEffects.length - 1; i >= 0; i--) {
      const ex = _activeEffects[i];
      if (
        ex.name === fxName &&
        !control.onUpdate &&
        (now - ex.bornAt) < 55 &&
        Math.abs((ex.x || 0) - mergedOpts.x) < 16 &&
        Math.abs((ex.y || 0) - mergedOpts.y) < 16
      ) {
        _activeEffects.splice(i, 1);
        if (ex.onDone) {
          try { ex.onDone(); } catch (e) {}
        }
        break;
      }
    }

    // 严格并发上限（高压降频态收紧至 2 个，常态上限 3 个），超限淘汰最旧特效
    while (_activeEffects.length >= cap) {
      evictOldestEffect();
    }

    const scaleProf = SCALED_FX_PROFILES[fxName] || null;
    const resScaleMul = clamp((_bufW || 320) / 320, 0.65, 1.0);
    const fxScale = scaleProf
      ? clamp((typeof control.scale === 'number' ? control.scale : scaleProf.defaultScale) * resScaleMul, 0.28, 1.0)
      : 1;
    const createOpts = scaleProf
      ? Object.assign({}, mergedOpts, { x: scaleProf.localX, y: scaleProf.localY })
      : mergedOpts;

    _burstCreateCount += 1;
    let inst = null;
    try {
      inst = PFX.createFx(def, createOpts);
    } catch (e) {
      if (typeof control.onDone === 'function') {
        try { control.onDone(); } catch (_) {}
      }
      return null;
    }
    if (!inst) return null;

    // 限制超长循环或持久特效的停留时间，并强制绑定真实墙钟 maxAgeMs 兜底（循环 FX 永不永驻）
    const defaultStop = def.meta && def.meta.loop ? 0.6 : Math.min(1.0, (def.meta && def.meta.duration) || 0.9);
    const stopAt = clamp(control.stopAt != null ? control.stopAt : defaultStop, 0.12, 1.25);
    const maxAgeMs = clamp(
      control.maxAgeMs != null ? control.maxAgeMs : Math.round((stopAt + 0.36) * 1000),
      350,
      MAX_EFFECT_AGE_MS
    );

    const entry = {
      name: fxName,
      inst,
      x: mergedOpts.x,
      y: mergedOpts.y,
      scaleProf,
      scale: fxScale,
      bornAt: now,
      maxAgeMs,
      elapsed: 0,
      stopAt,
      stopped: false,
      onUpdate: control.onUpdate || null,
      onDone: control.onDone || null,
    };
    _activeEffects.push(entry);
    ensureLoopRunning();
    return entry;
  }

  function aimOpts(fromPt, toPt) {
    const dx = toPt.x - fromPt.x;
    const dy = toPt.y - fromPt.y;
    if (dx >= 0) {
      return { flip: false, angle: Math.atan2(dy, Math.max(1, dx)) };
    }
    return { flip: true, angle: Math.atan2(-dy, Math.max(1, -dx)) };
  }

  function spawnProjectile(fxName, fromPt, toPt, opts, travelMs, onImpact) {
    const safeFrom = clampCanvasPt(fromPt);
    const safeTo = clampCanvasPt(toPt);
    const aim = aimOpts(safeFrom, safeTo);
    const travelSec = Math.max(0.08, (travelMs || 190) / 1000);
    let impacted = false;
    const fireImpact = () => {
      if (impacted) return;
      impacted = true;
      if (typeof onImpact === 'function') onImpact();
    };
    const fxOpts = Object.assign(
      {
        x: safeFrom.x,
        y: safeFrom.y,
        flip: aim.flip,
        angle: aim.angle,
      },
      opts || {}
    );

    return spawnFx(fxName, fxOpts, {
      stopAt: travelSec + 0.04,
      maxAgeMs: Math.round((travelSec + 0.35) * 1000),
      onUpdate(dt, entry) {
        const wallP = _slowMoScale < 0.99 ? 0 : (nowPerf() - entry.bornAt) / (travelSec * 1000);
        const p = clamp(Math.max(entry.elapsed / travelSec, wallP), 0, 1);
        const eased = EASE.outCubic(p);
        entry.inst.options.x = lerp(safeFrom.x, safeTo.x, eased);
        entry.inst.options.y = lerp(safeFrom.y, safeTo.y, eased);
        if (p >= 1 && !impacted) {
          entry.inst.stop();
          entry.stopped = true;
          fireImpact();
        }
      },
      onDone() {
        fireImpact();
      },
    });
  }

  /* -------------------- 动作编排原子操作 -------------------- */
  function scheduleAction(delayMs, fn) {
    if (!isEnabled() || typeof fn !== 'function') return;
    if (delayMs <= 0) {
      fn();
      return;
    }
    if (_scheduled.length >= MAX_SCHEDULED_ACTIONS) {
      // 超载时丢弃最早入队的编排动作，防止快速连点积压雪崩
      _scheduled.shift();
    }
    _scheduled.push({ wait: delayMs / 1000, dueAt: nowPerf() + delayMs, fn });
    ensureLoopRunning();
  }

  function setActorPoseInternal(actorKey, pose, holdMs, locked) {
    const st = _actors.get(actorKey);
    if (!st) return;
    const meta = getSpriteMeta(st.spriteId);
    const frameCount = meta.frames || 7;
    if (!Array.isArray(st.poseQueue)) st.poseQueue = [];
    st.poseQueue.length = 0;

    const normPose = String(pose || 'idle').toLowerCase();
    if (!pose || normPose === 'idle') {
      st.poseOverride = null;
      st.pose = 'idle';
      st.poseTimer = 0;
      st.poseLock = false;
      st.runElapsed = 0;
      st.runBobY = 0;
      st.runTiltDeg = 0;
      st.runSX = 1;
      st.runSY = 1;
      st.frame = st.breathStep ? 1 : 0;
    } else if (normPose === 'run') {
      const runInfo = getRunFramesInfo(st.spriteId, frameCount);
      st.poseOverride = 'run';
      st.pose = 'run';
      st.runElapsed = 0;
      st.frame = runInfo.frames[0];
      st.poseLock = !!locked;
      st.poseTimer = locked ? 0 : Math.max(0.06, (holdMs || 320) / 1000);
    } else if (
      !locked &&
      frameCount >= 7 &&
      (normPose === 'attack' || normPose === 'strike' || normPose === 'cast' || normPose === 'earth_cast' || normPose === 'earth_strike')
    ) {
      // 7 帧平滑出招序列：cast_step (4, ~85ms) -> strike (5, ~240ms) -> cast_step (4, ~75ms) -> idle
      const stepPose = normPose.startsWith('earth_') ? 'earth_step' : 'cast_step';
      const hitPose = normPose.startsWith('earth_') ? 'earth_cast' : 'strike';
      const stepFrame = resolvePoseFrame(stepPose, frameCount, st.spriteId);
      const hitFrame = resolvePoseFrame(hitPose, frameCount, st.spriteId);
      const strikeMs = holdMs ? clamp(Number(holdMs) || 240, 180, 320) : 240;
      st.poseOverride = stepPose;
      st.pose = stepPose;
      st.frame = stepFrame;
      st.poseLock = false;
      st.poseTimer = 0.08;
      st.poseQueue.push(
        { pose: hitPose, frame: hitFrame, duration: strikeMs / 1000 },
        { pose: stepPose, frame: stepFrame, duration: 0.075 }
      );
    } else if (
      !locked &&
      (normPose === 'magic_cast' || normPose === 'fire_cast' || normPose === 'wind_cast' || normPose === 'water_cast')
    ) {
      // 双态 9 帧法术 (magic_cast=8) 或 11 帧三系元素 (fire_cast=8 / wind_cast=10 / water_cast=10)：精确直出对应法术帧，绝不串播剑斩帧
      const targetFrame = resolvePoseFrame(normPose, frameCount, st.spriteId);
      const castMs = holdMs ? clamp(Number(holdMs) || 280, 180, 360) : 280;
      // 若无专属法术/元素帧（仍落回常规 7 帧 strike=5），则沿用平滑 4->5->4 序列
      if (targetFrame === 5 && frameCount >= 7 && !hasMagicCastFrames(st.spriteId) && frameCount < 11) {
        st.poseOverride = 'cast_step';
        st.pose = 'cast_step';
        st.frame = resolvePoseFrame('cast_step', frameCount, st.spriteId);
        st.poseLock = false;
        st.poseTimer = 0.08;
        st.poseQueue.push(
          { pose: 'strike', frame: 5, duration: castMs / 1000 },
          { pose: 'cast_step', frame: resolvePoseFrame('cast_step', frameCount, st.spriteId), duration: 0.075 }
        );
      } else {
        st.poseOverride = normPose;
        st.pose = normPose;
        st.frame = targetFrame;
        st.poseLock = false;
        st.poseTimer = castMs / 1000;
      }
    } else {
      st.poseOverride = normPose;
      st.pose = normPose;
      st.frame = resolvePoseFrame(normPose, frameCount, st.spriteId);
      st.poseLock = !!locked;
      st.poseTimer = locked ? 0 : Math.max(0.05, (holdMs || 420) / 1000);
    }
    applyActorVisual(st);
  }

  function dashActor(actorKey, toX, toY, durationMs, easeName, withGhosts, ghostTone, opts) {
    const st = _actors.get(actorKey);
    if (!st) return;
    opts = opts || {};
    const targetX = Number(toX) || 0;
    const targetY = Number(toY) || 0;
    const durMs = Math.max(30, Number(durationMs) || 120);

    if (prefersReducedMotion()) {
      st.dx = 0;
      st.dy = 0;
      st.dashTween = null;
      if (opts.returnIdle && st.poseOverride === 'run') {
        setActorPoseInternal(actorKey, 'idle', 0, false);
      } else {
        applyActorVisual(st);
      }
      return;
    }

    const travelDist = Math.hypot(targetX - st.dx, targetY - st.dy);
    const isReturningHome = Math.abs(targetX) < 0.5 && Math.abs(targetY) < 0.5;
    const shouldRun = opts.pose === 'run' || opts.useRunPose || (
      isReturningHome && travelDist > 24 &&
      (st.poseOverride === 'cast_step' || st.poseOverride === 'strike_ready' || st.poseOverride === 'strike' || st.poseOverride === 'attack' || st.poseOverride === 'cast')
    );

    if (shouldRun && st.poseOverride !== 'hurt') {
      setActorPoseInternal(actorKey, 'run', durMs + 60, false);
    }

    st.dashTween = {
      fromX: st.dx,
      fromY: st.dy,
      toX: targetX,
      toY: targetY,
      elapsed: 0,
      duration: durMs / 1000,
      ease: EASE[easeName] || EASE.outCubic,
      withGhosts: !!withGhosts,
      ghostTone: ghostTone || 'ice',
      returnIdle: !!(opts.returnIdle || (shouldRun && isReturningHome)),
    };
    st.ghostTimer = 0;
    ensureLoopRunning();
  }

  /* 6+6 经典三行站位二维跨行冲刺向量：覆盖中场空区（上限 680px）并精准对齐上/中/下目标行差 dy */
  function computeMeleeDashVector(attackerPts, targetPts, dir, standoffPx, minSpanPx) {
    const fW = Math.max(320, (attackerPts && attackerPts.fieldW) || (targetPts && targetPts.fieldW) || 960);
    const maxSpan = Math.max(96, Math.min(Math.round(fW * 0.62), 680));
    const minSpan = Math.min(maxSpan, Math.max(32, Number(minSpanPx) || 48));
    const standoff = Math.max(40, Number(standoffPx) || 96);
    const aX = attackerPts && Number.isFinite(attackerPts.screenX) ? attackerPts.screenX : (dir === 'right' ? 200 : 780);
    const aY = attackerPts && Number.isFinite(attackerPts.screenY) ? attackerPts.screenY : 260;
    const tX = targetPts && Number.isFinite(targetPts.screenX) ? targetPts.screenX : (dir === 'right' ? 780 : 200);
    const tY = targetPts && Number.isFinite(targetPts.screenY) ? targetPts.screenY : 260;
    const rawSpan = dir === 'right' ? (tX - aX - standoff) : (aX - tX - standoff);
    const span = clamp(rawSpan, minSpan, maxSpan);
    const dx = dir === 'right' ? span : -span;
    const dy = clamp(tY - aY, -240, 240);
    return { dx, dy };
  }

  function squashActor(actorKey, sx, sy, durationMs) {
    const st = _actors.get(actorKey);
    if (!st || prefersReducedMotion()) return;
    st.sx = sx;
    st.sy = sy;
    st.squashTween = {
      fromSX: sx,
      fromSY: sy,
      toSX: 1,
      toSY: 1,
      elapsed: 0,
      duration: Math.max(0.08, (durationMs || 220) / 1000),
    };
    applyActorVisual(st);
    ensureLoopRunning();
  }

  function triggerHitReaction(actorKey, recoilPx, heavy) {
    const st = _actors.get(actorKey);
    if (!st) return;
    setActorPoseInternal(actorKey, 'hurt', heavy ? 340 : 260, false);
    if (canFlash()) {
      st.flashLeft = heavy ? 0.14 : 0.10;
    }
    squashActor(actorKey, heavy ? 1.24 : 1.16, heavy ? 0.78 : 0.85, heavy ? 260 : 210);
    if (!prefersReducedMotion() && recoilPx) {
      dashActor(actorKey, recoilPx, 0, 75, 'outQuad', false);
      scheduleAction(90, () => dashActor(actorKey, 0, 0, 190, 'outBack', false));
    }
  }

  /* -------------------- game-feel Hit-Stop & Trauma 震屏 -------------------- */
  let _lastHitStopTs = 0;
  function triggerHitStop(durationMs) {
    if (!isEnabled() || prefersReducedMotion()) return;
    const now = nowPerf();
    if (now - _lastHitStopTs < 260) return;
    _lastHitStopTs = now;
    _hitStopId += 1;
    const myId = _hitStopId;
    const dur = clamp(Number(durationMs) || 70, 45, 130);
    _hitStopScale = 0.06;
    const s3dStart = global.CombatStage3D;
    if (s3dStart && typeof s3dStart.isActive === 'function' && s3dStart.isActive() && typeof s3dStart.setTimeScale === 'function') {
      s3dStart.setTimeScale(_hitStopScale * _slowMoScale);
    }

    const field = document.querySelector('#battle-screen .cb-arena-field');
    if (field) field.classList.add('cb-hitstop-75');

    if (_hitStopTimer) {
      clearTimeout(_hitStopTimer);
      _rawTimers.delete(_hitStopTimer);
      _hitStopTimer = null;
    }
    _hitStopTimer = trackRealTimer(() => {
      if (myId === _hitStopId) {
        _hitStopScale = 1.0;
        _hitStopTimer = null;
        const s3dEnd = global.CombatStage3D;
        if (s3dEnd && typeof s3dEnd.isActive === 'function' && s3dEnd.isActive() && typeof s3dEnd.setTimeScale === 'function') {
          s3dEnd.setTimeScale(_hitStopScale * _slowMoScale);
        }
        const curField = document.querySelector('#battle-screen .cb-arena-field');
        if (curField) curField.classList.remove('cb-hitstop-75');
      }
    }, dur);
  }

  function triggerTrauma(amount) {
    if (!isEnabled() || prefersReducedMotion()) return;
    if (global.CombatEngine && typeof global.CombatEngine.addCombatTrauma === 'function') {
      global.CombatEngine.addCombatTrauma(amount);
    }
    const s3d = global.CombatStage3D;
    if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.addCameraTrauma === 'function') {
      s3d.addCameraTrauma(amount);
    }
  }

  /* -------------------- 玩家技能全套编排 (覆盖现役 + V3.2 全 15 招规范 ID) -------------------- */
  const V32_DIRECT_SKILL_IDS = new Set([
    'ice_1_crystal',
    'ice_2_prism',
    'ice_3_starfrost',
    'water_1_ball',
    'water_2_surge',
    'water_3_blade',
    'frost_1_step',
    'frost_2_breath',
    'frost_3_thorns',
    'shield_1_ice',
    'shield_2_mirror',
    'shield_3_steel',
    'sword_1_basic',
    'sword_2_cold_edge',
    'move_afterimage',
  ]);
  const ICE_PROJECTILE_SKILLS = new Set([
    'hand_ice_crystal',
    'ice_1_crystal',
    'ice_2_prism',
    'remote_blind_shot',
    'remote_snap_spike',
    'insight_aino_bead',
    'insight_generic_flaw',
  ]);
  const ICE_AOE_GROUND_SKILLS = new Set([
    'hand_thorn_field',
    'hand_frost_floor',
    'ice_3_starfrost',
    'frost_1_step',
    'frost_2_breath',
    'frost_3_thorns',
    'insight_beatrice_pillar',
    'insight_alice_cage',
    'insight_noelle_sever',
    'insight_hulan_resonance',
  ]);
  const MELEE_DASH_SKILLS = new Set([
    'basic_attack',
    'sword_1_basic',
    'sword_2_cold_edge',
    'water_3_blade',
    'sword_water_edge',
    'insight_jackal_throat',
    'insight_eastwing_draft',
    'insight_wind_stillness',
  ]);
  const SWORD_FOOTWORK_SKILLS = new Set([
    'sword_root_step',
    'sword_wind_afterimage',
    'move_afterimage',
  ]);
  const SHIELD_GUARD_SKILLS = new Set([
    'hand_root_shield',
    'hand_ice_wall',
    'shield_1_ice',
    'shield_2_mirror',
    'shield_3_steel',
  ]);

  function getLivingEnemyIndices(battleState, preferredIdx) {
    if (battleState && Array.isArray(battleState.enemies) && battleState.enemies.length) {
      const alive = [];
      battleState.enemies.forEach((e, idx) => {
        if (e && e.hp > 0) alive.push(idx);
      });
      if (alive.length) return alive;
    }
    const cards = document.querySelectorAll('#battle-screen .cb-enemy-card:not(.dead)');
    if (cards.length) {
      return Array.from(cards).map(c => Number(c.getAttribute('data-eidx')) || 0);
    }
    return [preferredIdx != null ? preferredIdx : 0];
  }

  function playSkillAction(battleState, info) {
    if (!isEnabled() || !info) return createNoopActionHandle();
    ensureVfxCanvas();
    ensureLoopRunning();

    const myGen = ++_playerActionGen;
    const skillId = info.skillId || 'hand_ice_crystal';
    const primaryIdx = info.targetIdx != null ? info.targetIdx : 0;
    const targets = (Array.isArray(info.targetIndices) && info.targetIndices.length)
      ? info.targetIndices
      : [primaryIdx];
    const targetKey = `enemy:${primaryIdx}`;
    const rawAmpPct = typeof info.ampPct === 'number' && Number.isFinite(info.ampPct)
      ? (info.ampPct > 1 ? info.ampPct / 100 : info.ampPct)
      : 0;
    const ampPct = clamp(rawAmpPct, 0, 0.60);
    const ampTier = typeof info.ampTier === 'number'
      ? info.ampTier
      : (ampPct >= 0.55 ? 3 : ampPct >= 0.35 ? 2 : ampPct > 0.001 ? 1 : 0);
    const ampRatio = clamp(ampPct / 0.60, 0, 1);
    const isHeavy = !!(info.didCrit || info.didBreak || info.didRiposte || info.shieldBroken || ampTier >= 2 || skillId.startsWith('insight_'));

    const playerSt = _actors.get('player');
    const pSpriteId = (playerSt && playerSt.spriteId) || resolvePlayerSpriteId(battleState, false);
    const useDualMagic = hasMagicCastFrames(pSpriteId);
    const magicWindupPose = useDualMagic ? 'magic_windup' : 'windup';
    const magicCastPose = useDualMagic ? 'magic_cast' : 'strike';

    const pPts = getActorCanvasPoints('player', false);
    const tPts = getActorCanvasPoints(targetKey, false);

    if (hasEditionA()) {
      const edApi = getEditionAApi();
      const isGated = !!info.gated;
      const expectedGateCount = Math.max(
        1,
        Number(info.gateCount != null ? info.gateCount : info.beats) || 1
      );
      const isShieldOrVeil =
        skillId === 'hand_water_veil' ||
        skillId === 'water_veil' ||
        SHIELD_GUARD_SKILLS.has(skillId) ||
        skillId === 'ice_shield' ||
        skillId === 'mirror_frost_wall' ||
        skillId === 'steel_ice_curtain';
      const isFootwork = SWORD_FOOTWORK_SKILLS.has(skillId) || skillId === 'wind_afterimage';
      const isSelfSkill = isShieldOrVeil || isFootwork;
      const isMelee =
        MELEE_DASH_SKILLS.has(skillId) ||
        skillId === 'water_cleave' ||
        skillId === 'sword_send_slash' ||
        skillId === 'sword_riposte_flash';
      const hasDirectDmg = !!(info.totalDmg > 0 || info.dmg > 0 || info.didCrit || info.didBreak);
      const isSetupOnly =
        skillId === 'hand_frost_floor' ||
        skillId === 'frost_step_floor' ||
        (skillId === 'frost_1_step' && !hasDirectDmg);
      const isMultiAoe =
        skillId === 'hand_thorn_field' ||
        skillId === 'frost_thorn_field' ||
        skillId === 'frost_1_step' ||
        skillId === 'frost_2_breath' ||
        skillId === 'frost_3_thorns' ||
        skillId === 'frost_breath' ||
        skillId === 'starfrost_scatter' ||
        isSetupOnly;
      const hitList = isSetupOnly
        ? ((Array.isArray(info.targetIndices) && info.targetIndices.length) ? info.targetIndices : getLivingEnemyIndices(battleState, primaryIdx))
        : (isMultiAoe
          ? ((Array.isArray(info.targetIndices) && info.targetIndices.length) ? info.targetIndices : getLivingEnemyIndices(battleState, primaryIdx))
          : targets);

      const isSingleTargetMagic =
        !isSelfSkill &&
        !isMelee &&
        !isMultiAoe &&
        skillId !== 'insight_rowan_prism' &&
        hitList.length <= 1;

      let resolvedId = null;
      if (skillId === 'move_afterimage') {
        resolvedId =
          edApi.resolveSkillId('wind_afterimage') ||
          edApi.resolveSkillId('sword_root_step') ||
          edApi.resolveSkillId(skillId);
      } else if (info.usedWand && isSingleTargetMagic && !V32_DIRECT_SKILL_IDS.has(skillId)) {
        resolvedId = edApi.resolveSkillId('eclipse_true_cast');
      } else if (skillId === 'hand_root_shield' || skillId === 'shield_3_steel') {
        resolvedId =
          (typeof edApi.hasSkill === 'function' && edApi.hasSkill('prism_aegis') && edApi.resolveSkillId('prism_aegis')) ||
          edApi.resolveSkillId('steel_ice_curtain') ||
          edApi.resolveSkillId(skillId);
      } else {
        resolvedId = edApi.resolveSkillId(skillId);
      }
      if (!resolvedId) resolvedId = 'ice_crystal';

      const pLog = toLogicalPts(pPts);
      const tLog = toLogicalPts(tPts);
      const targetLogList = hitList.map(eIdx => {
        const ePts = getActorCanvasPoints(`enemy:${eIdx}`, false);
        const eLog = toLogicalPts(ePts);
        return { x: eLog.hit.x, y: eLog.hit.y, groundY: eLog.anchor.y, enemyIdx: eIdx };
      });
      const firstTargetLog = targetLogList[0] || { x: tLog.hit.x, y: tLog.hit.y, groundY: tLog.anchor.y, enemyIdx: primaryIdx };
      const resolveSlotByEnemyIdx = eIdx => {
        for (let i = 0; i < targetLogList.length; i++) {
          if (targetLogList[i].enemyIdx === eIdx) return targetLogList[i];
        }
        const livePts = getActorCanvasPoints(`enemy:${eIdx}`, false);
        const liveLog = toLogicalPts(livePts);
        return { x: liveLog.hit.x, y: liveLog.hit.y, groundY: liveLog.anchor.y, enemyIdx: eIdx };
      };

      // 整理命中后需叠放的系统反馈集合（暴击 / 破锁 / ONE MORE / 敌盾承伤碎盾）
      const critSet = new Set(
        Array.isArray(info.critTargetIndices)
          ? info.critTargetIndices
          : (info.didCrit ? [primaryIdx] : [])
      );
      const brokenSet = new Set(
        Array.isArray(info.brokenIndices)
          ? info.brokenIndices
          : (info.didBreak ? [primaryIdx] : [])
      );
      const oneMoreSet = new Set(
        Array.isArray(info.oneMoreIndices)
          ? info.oneMoreIndices
          : ((info.didOneMore || info.oneMore) ? (brokenSet.size ? Array.from(brokenSet) : [primaryIdx]) : [])
      );
      const shieldHitMap = new Map();
      if (Array.isArray(info.shieldHitTargets)) {
        info.shieldHitTargets.forEach(item => {
          if (typeof item === 'number') {
            shieldHitMap.set(item, !!info.shieldBroken);
          } else if (item && typeof item === 'object') {
            const sIdx = item.enemyIdx != null ? item.enemyIdx : (item.idx != null ? item.idx : (item.targetIdx != null ? item.targetIdx : primaryIdx));
            shieldHitMap.set(sIdx, !!(item.shattered || item.broken));
          }
        });
      } else if (info.shieldBroken) {
        shieldHitMap.set(primaryIdx, true);
      }

      const overlayFired = new Set();
      const critBeatPlayed = new Set();
      const breakEnemyPlayed = new Set();
      const shieldBeatPlayed = new Set();
      const gateReactedEnemies = new Set();
      let gateControlledImpact = false;
      let suppressVfxHitStopUntil = 0;
      let releaseCallCount = 0;

      const fireCritOverlay = (eIdx, posObj, beatKey) => {
        const k = `${eIdx}:${beatKey}`;
        if (critBeatPlayed.has(k)) return;
        critBeatPlayed.add(k);
        playEditionA('fx_crit_starburst', {
          pos: posObj,
          to: posObj,
          targetGroundY: posObj.groundY,
          facing: 1,
          amp: ampTier,
        });
      };

      const fireBreakOverlay = (eIdx, posObj, isOneMore) => {
        if (breakEnemyPlayed.has(eIdx)) return;
        breakEnemyPlayed.add(eIdx);
        playEditionA('fx_weakness_break', {
          pos: posObj,
          to: posObj,
          targetGroundY: posObj.groundY,
          facing: 1,
          amp: ampTier,
          oneMore: !!isOneMore,
        });
      };

      const fireShieldOverlay = (eIdx, posObj, shattered, beatKey) => {
        const k = `${eIdx}:${beatKey}`;
        if (shieldBeatPlayed.has(k)) return;
        shieldBeatPlayed.add(k);
        playEditionA('fx_shield_hit', {
          pos: posObj,
          from: posObj,
          groundY: posObj.groundY,
          side: 'enemy',
          facing: -1,
          amp: ampTier,
          shattered: !!shattered,
        });
      };

      const applyEnemyImpactAt = (eIdx, posObj) => {
        if (isSelfSkill || isSetupOnly || info.missed) return;
        const eKey = `enemy:${eIdx}`;
        triggerHitReaction(eKey, isHeavy ? 18 : 12, isHeavy);
        if (overlayFired.has(eIdx)) return;
        overlayFired.add(eIdx);

        if (critSet.has(eIdx)) {
          fireCritOverlay(eIdx, posObj, 'legacy');
        }
        if (brokenSet.has(eIdx) || oneMoreSet.has(eIdx)) {
          fireBreakOverlay(eIdx, posObj, oneMoreSet.has(eIdx));
        }
        if (shieldHitMap.has(eIdx)) {
          fireShieldOverlay(eIdx, posObj, !!shieldHitMap.get(eIdx), 'legacy');
        }
      };

      let actorReturned = false;
      let strikeFired = false;
      let lastStrikeTs = 0;
      let safetyReturnTimer = null;
      let edHandle = null;
      let doneSettled = false;
      let resolveDone = null;
      const donePromise = new Promise(resolve => { resolveDone = resolve; });

      const clearSafetyTimer = () => {
        if (safetyReturnTimer) {
          clearTimeout(safetyReturnTimer);
          _rawTimers.delete(safetyReturnTimer);
          safetyReturnTimer = null;
        }
      };

      const markDone = () => {
        if (doneSettled) return;
        doneSettled = true;
        if (resolveDone) resolveDone();
      };

      const finishActorReturn = immediate => {
        if (actorReturned) return;
        actorReturned = true;
        clearSafetyTimer();
        if (myGen !== _playerActionGen) return;

        const doReturnDash = () => {
          if (myGen !== _playerActionGen) return;
          const st = _actors.get('player');
          if (!st) return;
          st.poseLock = false;
          const displaced = Math.abs(st.dx) > 0.5 || Math.abs(st.dy) > 0.5;
          if (displaced) {
            const retDur = isMelee ? 200 : 180;
            const retOpts = isMelee ? { pose: 'run', returnIdle: true } : { returnIdle: true };
            dashActor('player', 0, 0, retDur, 'outCubic', false, 'ice', retOpts);
          } else if (st.poseOverride === 'strike_ready') {
            setActorPoseInternal('player', 'idle', 0, false);
          }
        };

        const holdLeft = (!immediate && lastStrikeTs > 0)
          ? Math.max(0, 180 - (nowPerf() - lastStrikeTs))
          : 0;
        if (holdLeft > 12) {
          scheduleAction(holdLeft, doReturnDash);
        } else {
          doReturnDash();
        }
      };

      const armSafetyReturn = ms => {
        clearSafetyTimer();
        safetyReturnTimer = trackRealTimer(() => {
          safetyReturnTimer = null;
          finishActorReturn(true);
          markDone();
        }, Math.max(1200, Number(ms) || 6000));
      };

      // 保留像素精灵动作编排（姿态 / 冲刺 / 挤压），零旧 PixelFX 叠放
      if (skillId === 'insight_rowan_prism') {
        setActorPoseInternal('player', magicWindupPose, 160, false);
        squashActor('player', 0.93, 1.08, 160);
        scheduleAction(140, () => {
          if (myGen === _playerActionGen && !actorReturned) {
            setActorPoseInternal('player', magicCastPose, 320, false);
            dashActor('player', 16, 0, 110, 'outQuad', true, 'ice');
          }
        });
        if (isGated) {
          armSafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
        } else {
          scheduleAction(420, () => {
            if (myGen === _playerActionGen) dashActor('player', 0, 0, 210, 'outCubic', false);
          });
        }
      } else if (isShieldOrVeil) {
        setActorPoseInternal('player', magicWindupPose, 120, false);
        squashActor('player', 1.06, 0.94, 130);
        scheduleAction(110, () => {
          if (myGen === _playerActionGen && !actorReturned) {
            setActorPoseInternal('player', magicCastPose, 320, false);
            squashActor('player', 0.94, 1.08, 220);
          }
        });
      } else if (isFootwork) {
        const isWind = skillId === 'sword_wind_afterimage' || skillId === 'wind_afterimage' || skillId === 'move_afterimage';
        setActorPoseInternal('player', 'windup', 95, false);
        dashActor('player', -12, 0, 80, 'inQuad', false);
        scheduleAction(85, () => {
          if (myGen !== _playerActionGen || actorReturned) return;
          dashActor('player', 34, 0, 115, 'outCubic', true, isWind ? 'wind' : 'ice', { pose: 'run' });
        });
        scheduleAction(205, () => {
          if (myGen === _playerActionGen && !actorReturned) setActorPoseInternal('player', 'windup', 120, false);
        });
        scheduleAction(325, () => {
          if (myGen === _playerActionGen && !actorReturned) {
            dashActor('player', 0, 0, 175, 'outCubic', true, isWind ? 'wind' : 'ice', { pose: 'run', returnIdle: true });
          }
        });
      } else if (isMelee) {
        const dashVec = computeMeleeDashVector(pPts, tPts, 'right', 96, 54);
        setActorPoseInternal('player', 'windup', 95, false);
        squashActor('player', 1.1, 0.92, 95);
        dashActor('player', -14, 0, 80, 'inQuad', false);
        scheduleAction(85, () => {
          if (myGen !== _playerActionGen || actorReturned) return;
          dashActor('player', dashVec.dx, dashVec.dy, 110, 'outQuart', true, 'ice', { pose: 'run' });
        });
        if (isGated) {
          // 门控近战：冲锋到位后锁定 strike_ready，等待每次 releaseGate 挥砍，直待 finishActorReturn / onAllBeatsComplete 奔回归位
          scheduleAction(195, () => {
            if (myGen === _playerActionGen && !actorReturned && !strikeFired) {
              setActorPoseInternal('player', 'strike_ready', 0, true);
            }
          });
          armSafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
        } else {
          scheduleAction(195, () => {
            if (myGen === _playerActionGen) {
              setActorPoseInternal('player', 'strike', 210, false);
              squashActor('player', 1.12, 0.9, 170);
            }
          });
          scheduleAction(445, () => {
            if (myGen === _playerActionGen) {
              dashActor('player', 0, 0, 200, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true });
            }
          });
        }
      } else if (ICE_AOE_GROUND_SKILLS.has(skillId) || isMultiAoe) {
        setActorPoseInternal('player', magicWindupPose, 160, false);
        squashActor('player', 0.93, 1.08, 150);
        scheduleAction(145, () => {
          if (myGen === _playerActionGen && !actorReturned) {
            setActorPoseInternal('player', magicCastPose, 340, false);
            squashActor('player', 1.1, 0.92, 180);
          }
        });
        if (isGated) {
          armSafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
        }
      } else {
        setActorPoseInternal('player', magicWindupPose, 150, false);
        squashActor('player', 0.94, 1.07, 150);
        scheduleAction(140, () => {
          if (myGen === _playerActionGen && !actorReturned) {
            setActorPoseInternal('player', magicCastPose, 300, false);
            squashActor('player', 1.08, 0.94, 170);
            dashActor('player', 12, 0, 95, 'outQuad', false);
          }
        });
        if (isGated) {
          armSafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
        } else {
          scheduleAction(360, () => {
            if (myGen === _playerActionGen) dashActor('player', 0, 0, 180, 'outCubic', false);
          });
        }
      }

      const playOpts = {
        from: pLog.cast,
        to: { x: firstTargetLog.x, y: firstTargetLog.y },
        groundY: pLog.anchor.y,
        targetGroundY: firstTargetLog.groundY,
        targets: targetLogList,
        facing: 1,
        amp: ampTier,
        ampTier,
        heavy: isHeavy,
        usedWand: !!info.usedWand,
        spriteId: pSpriteId,
        onImpact(hitOrder, pt, isLast) {
          const slot = targetLogList[hitOrder] || firstTargetLog;
          if (typeof info.onImpact === 'function') {
            try { info.onImpact(hitOrder, pt, isLast, slot.enemyIdx); } catch (e) {}
          }
          if (isSelfSkill || isSetupOnly || info.missed) return;
          if (isGated && gateControlledImpact) {
            if (!gateReactedEnemies.has(slot.enemyIdx)) {
              gateReactedEnemies.add(slot.enemyIdx);
              triggerHitReaction(`enemy:${slot.enemyIdx}`, isHeavy ? 16 : 11, isHeavy);
            }
            return;
          }
          const posObj = {
            x: (pt && Number.isFinite(pt.x)) ? pt.x : slot.x,
            y: (pt && Number.isFinite(pt.y)) ? pt.y : slot.y,
            groundY: slot.groundY,
          };
          if (isLast || targetLogList.length > 1) {
            applyEnemyImpactAt(slot.enemyIdx, posObj);
          } else {
            triggerHitReaction(`enemy:${slot.enemyIdx}`, isHeavy ? 14 : 10, isHeavy);
          }
          if (isLast && targetLogList.length > 1) {
            for (let ti = 0; ti < targetLogList.length; ti++) {
              const tg = targetLogList[ti];
              if (!overlayFired.has(tg.enemyIdx)) {
                applyEnemyImpactAt(tg.enemyIdx, tg);
              }
            }
          }
        },
        onShake(px) {
          if (!info.missed) triggerTrauma(editionAShakeToTrauma(px));
        },
        onHitStop(ms) {
          if (isSelfSkill || isSetupOnly || info.missed) return;
          if (isGated && nowPerf() < suppressVfxHitStopUntil) return;
          triggerHitStop(ms);
        },
      };
      if (info.gated !== undefined) playOpts.gated = !!info.gated;
      if (info.autoImpactGate !== undefined) playOpts.autoImpactGate = !!info.autoImpactGate;
      if (info.gateCount != null && Number.isFinite(Number(info.gateCount))) {
        playOpts.gateCount = Number(info.gateCount);
      }
      if (info.beats != null && Number.isFinite(Number(info.beats))) {
        playOpts.beats = Number(info.beats);
      }
      if (typeof info.onPreTelegraph === 'function') {
        playOpts.onPreTelegraph = info.onPreTelegraph;
      }
      if (typeof info.onBeatReady === 'function') {
        playOpts.onBeatReady = info.onBeatReady;
      }
      if (isGated || typeof info.onAllBeatsComplete === 'function') {
        playOpts.onAllBeatsComplete = (...args) => {
          finishActorReturn(false);
          if (typeof info.onAllBeatsComplete === 'function') {
            try { info.onAllBeatsComplete(...args); } catch (e) {}
          }
        };
      }
      if (info.beatGapMs != null && Number.isFinite(Number(info.beatGapMs))) {
        playOpts.beatGapMs = Number(info.beatGapMs);
      }
      playOpts.onComplete = (...args) => {
        if (isGated) finishActorReturn(false);
        markDone();
        if (typeof info.onComplete === 'function') {
          try { info.onComplete(...args); } catch (e) {}
        }
      };

      const edRet = playEditionA(resolvedId, playOpts);
      edHandle = (edRet && typeof edRet === 'object') ? edRet : null;
      if (edHandle && edHandle.donePromise && typeof edHandle.donePromise.then === 'function') {
        edHandle.donePromise.then(
          () => {
            if (isGated) finishActorReturn(false);
            markDone();
          },
          () => {
            if (isGated) finishActorReturn(true);
            markDone();
          }
        );
      }

      const releaseGate = (beatIdx, payload) => {
        const idx = Number.isFinite(Number(beatIdx)) ? Number(beatIdx) : releaseCallCount;
        releaseCallCount += 1;
        const p = (payload && typeof payload === 'object') ? payload : null;

        if (p && p.cancelled) {
          if (edHandle && typeof edHandle.releaseAll === 'function') {
            try { edHandle.releaseAll(p); } catch (e) {}
          } else if (edHandle && typeof edHandle.releaseGate === 'function') {
            try { edHandle.releaseGate(idx, p); } catch (e) {}
          }
          _editionAForceRender = true;
          finishActorReturn(true);
          return;
        }

        if (isGated) {
          armSafetyReturn(4500);
        }
        if (p && !p.skipped) {
          suppressVfxHitStopUntil = nowPerf() + 260;
        }

        // 近战门控每拍释放触发一次真实挥砍，多拍中段自动回落 strike_ready 待命
        if (isMelee && isGated && myGen === _playerActionGen && !actorReturned) {
          strikeFired = true;
          lastStrikeTs = nowPerf();
          setActorPoseInternal('player', 'strike', 200, false);
          squashActor('player', 1.12, 0.9, 170);
          if (expectedGateCount > 1 && idx < expectedGateCount - 1) {
            const strikeStamp = lastStrikeTs;
            scheduleAction(210, () => {
              if (myGen === _playerActionGen && !actorReturned && lastStrikeTs === strikeStamp) {
                setActorPoseInternal('player', 'strike_ready', 0, true);
              }
            });
          }
        }

        // 爆裂当帧按真实结算信息精准播 1 次受击微震 / 暴击 / 破锁 / 敌盾特效
        if (!isSelfSkill && !isSetupOnly && !(p && p.missed) && !info.missed) {
          gateControlledImpact = true;
          let beatEnemyIdx = primaryIdx;
          if (p && p.enemyIdx != null && Number.isFinite(Number(p.enemyIdx))) {
            beatEnemyIdx = Number(p.enemyIdx);
          } else if (p && p.targetIdx != null && Number.isFinite(Number(p.targetIdx))) {
            beatEnemyIdx = Number(p.targetIdx);
          } else if (targetLogList.length > 1 && idx >= 0 && idx < targetLogList.length) {
            beatEnemyIdx = targetLogList[idx].enemyIdx;
          } else {
            beatEnemyIdx = firstTargetLog.enemyIdx;
          }
          const beatSlot = resolveSlotByEnemyIdx(beatEnemyIdx);
          const beatHeavy = !!(
            isHeavy ||
            (p && (p.crit || p.didCrit || p.broken || p.didBreak || p.oneMore || p.didOneMore || p.shieldShattered || p.shieldBroken))
          );

          gateReactedEnemies.add(beatSlot.enemyIdx);
          triggerHitReaction(`enemy:${beatSlot.enemyIdx}`, beatHeavy ? 18 : 12, beatHeavy);

          if (p) {
            const critTargets = Array.isArray(p.critTargetIndices)
              ? p.critTargetIndices
              : ((p.crit || p.didCrit) ? [beatSlot.enemyIdx] : []);
            for (let ci = 0; ci < critTargets.length; ci++) {
              const cSlot = resolveSlotByEnemyIdx(critTargets[ci]);
              fireCritOverlay(cSlot.enemyIdx, cSlot, idx);
            }

            const brokenList = Array.isArray(p.brokenIndices)
              ? p.brokenIndices
              : ((p.broken || p.didBreak) ? [beatSlot.enemyIdx] : []);
            const oneMoreList = Array.isArray(p.oneMoreIndices)
              ? p.oneMoreIndices
              : ((p.oneMore || p.didOneMore) ? (brokenList.length ? brokenList : [beatSlot.enemyIdx]) : []);
            const oneMoreSetLocal = new Set(oneMoreList);
            const breakUnion = new Set(brokenList.concat(oneMoreList));
            breakUnion.forEach(bIdx => {
              const bSlot = resolveSlotByEnemyIdx(bIdx);
              fireBreakOverlay(bSlot.enemyIdx, bSlot, oneMoreSetLocal.has(bIdx));
            });

            if (Array.isArray(p.shieldHitTargets)) {
              p.shieldHitTargets.forEach(item => {
                if (typeof item === 'number') {
                  const sSlot = resolveSlotByEnemyIdx(item);
                  fireShieldOverlay(sSlot.enemyIdx, sSlot, !!(p.shieldShattered || p.shieldBroken), idx);
                } else if (item && typeof item === 'object') {
                  const sIdx = item.enemyIdx != null ? item.enemyIdx : (item.idx != null ? item.idx : (item.targetIdx != null ? item.targetIdx : beatSlot.enemyIdx));
                  const sSlot = resolveSlotByEnemyIdx(sIdx);
                  fireShieldOverlay(sSlot.enemyIdx, sSlot, !!(item.shattered || item.broken), idx);
                }
              });
            } else if (p.shieldShattered || p.shieldBroken || p.shieldAbsorbed > 0) {
              fireShieldOverlay(beatSlot.enemyIdx, beatSlot, !!(p.shieldShattered || p.shieldBroken), idx);
            }
          }
        }

        if (edHandle && typeof edHandle.releaseGate === 'function') {
          try { edHandle.releaseGate(idx, p); } catch (e) {}
        }
        _editionAForceRender = true;
      };

      const releaseAll = payload => {
        const p = (payload && typeof payload === 'object') ? payload : null;
        if (edHandle && typeof edHandle.releaseAll === 'function') {
          try { edHandle.releaseAll(p); } catch (e) {}
        }
        _editionAForceRender = true;
        finishActorReturn(!!(p && p.cancelled));
      };

      return {
        releaseGate,
        releaseAll,
        finishActorReturn: () => finishActorReturn(false),
        donePromise,
      };
    }

    const legacyHandle = {
      releaseGate() {},
      releaseAll() {
        if (myGen === _playerActionGen) {
          dashActor('player', 0, 0, 180, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true });
        }
      },
      finishActorReturn() {
        if (myGen === _playerActionGen) {
          dashActor('player', 0, 0, 180, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true });
        }
      },
      donePromise: Promise.resolve(),
    };

    // 1) 罗文专属看破：双镜合拢夹杖（eclipse + time_stop + parry + ice_shatter）
    if (skillId === 'insight_rowan_prism') {
      setActorPoseInternal('player', magicWindupPose, 160, false);
      squashActor('player', 0.93, 1.08, 160);
      spawnFx('time_stop', { x: _bufW * 0.5, y: _bufH * 0.78, palette: PALETTES.ice }, { stopAt: 0.78 });

      scheduleAction(140, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', magicCastPose, 320, false);
          dashActor('player', 16, 0, 110, 'outQuad', true, 'ice');
        }
        spawnFx('eclipse', { x: tPts.hit.x, y: tPts.hit.y, palette: PALETTES.eclipse }, { stopAt: 0.85 });
        spawnFx('parry', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.72 });
        spawnFx('ice_shatter', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.85 });
        triggerHitReaction(targetKey, 16, true);
        triggerHitStop(90);
        triggerTrauma(0.76);
      });
      scheduleAction(420, () => {
        if (myGen === _playerActionGen) dashActor('player', 0, 0, 210, 'outCubic', false);
      });
      return legacyHandle;
    }

    // 2) 冰晶投射 / 侧翼瞬凝精准打击（sylvia_disguise 9帧使用 magic_windup(7) -> magic_cast(8) 持乌木剑施冰法）
    if (ICE_PROJECTILE_SKILLS.has(skillId)) {
      const isRemote = skillId.startsWith('remote_') || skillId === 'insight_aino_bead';
      setActorPoseInternal('player', magicWindupPose, 150, false);
      squashActor('player', 0.94, 1.07, 150);
      spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.52 + ampRatio * 0.14 });
      if (info.usedWand) {
        spawnFx('eclipse', { x: pPts.cast.x, y: pPts.cast.y, palette: PALETTES.eclipse }, { stopAt: 0.55, scale: 0.40 });
      }

      scheduleAction(140, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', magicCastPose, 300, false);
          squashActor('player', 1.08, 0.94, 170);
          dashActor('player', 12, 0, 95, 'outQuad', false);
        }

        const launchFrom = isRemote
          ? { x: lerp(pPts.cast.x, tPts.hit.x, 0.45), y: tPts.hit.y - 16 }
          : pPts.cast;
        const travelMs = isRemote ? 145 : 190;

        spawnProjectile('ice_lance', launchFrom, tPts.hit, { palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice, length: Math.round(46 + ampRatio * 12) }, travelMs, () => {
          if (info.missed) {
            spawnFx('snowflake_burst', { x: tPts.hit.x, y: tPts.hit.y, count: 5, palette: PALETTES.ice }, { stopAt: 0.55, scale: 0.46 });
            return;
          }
          triggerHitReaction(targetKey, isHeavy ? 16 : 10, isHeavy);
          spawnFx('ice_shatter', { x: tPts.anchor.x, y: tPts.anchor.y, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.78 });
          spawnFx('hit_spark', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.48 });
          if (isHeavy || ampTier >= 1) {
            if (isHeavy) spawnFx('crit_hit', { x: tPts.anchor.x, y: tPts.anchor.y, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.75 });
            spawnFx('snowflake_burst', { x: tPts.hit.x, y: tPts.hit.y, count: ampTier >= 2 ? 10 : 7, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.8, scale: ampTier >= 2 ? 0.58 : 0.50 });
            triggerHitStop(isHeavy ? 85 : 68);
            triggerTrauma(isHeavy ? Math.min(0.85, 0.72 + ampRatio * 0.12) : 0.48 + ampRatio * 0.14);
          } else {
            triggerHitStop(55);
            triggerTrauma(0.36 + ampRatio * 0.12);
          }
        });
      });
      scheduleAction(360, () => {
        if (myGen === _playerActionGen) dashActor('player', 0, 0, 180, 'outCubic', false);
      });
      return legacyHandle;
    }

    // 3) 冰系群体 / 地脉控场（冰棘群刺阵、蔓地薄冰、寒霜吐息、星霜散华、封肩地下冰柱、十字冰栏、冻彻断流、伊诺共鸣）
    if (ICE_AOE_GROUND_SKILLS.has(skillId)) {
      const isSetupOnly = skillId === 'hand_frost_floor' || (skillId === 'frost_1_step' && !(info.totalDmg > 0 || info.dmg > 0));
      const isAoeSpread = skillId === 'hand_thorn_field' || skillId === 'frost_1_step' || skillId === 'frost_2_breath' || skillId === 'frost_3_thorns';
      const hitList = isSetupOnly
        ? getLivingEnemyIndices(battleState, primaryIdx)
        : (isAoeSpread
          ? ((Array.isArray(info.targetIndices) && info.targetIndices.length) ? info.targetIndices : getLivingEnemyIndices(battleState, primaryIdx))
          : targets);

      setActorPoseInternal('player', magicWindupPose, 160, false);
      squashActor('player', 0.93, 1.08, 150);
      spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.62 + ampRatio * 0.12 });

      scheduleAction(145, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', magicCastPose, 340, false);
          squashActor('player', 1.1, 0.92, 180);
        }

        const firstPts = getActorCanvasPoints(`enemy:${hitList[0] || 0}`, false);
        spawnFx('frost_nova', { x: firstPts.anchor.x, y: firstPts.anchor.y, reach: isSetupOnly ? 68 : Math.round(96 + ampRatio * 18), palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.85 });

        hitList.forEach((eIdx, order) => {
          scheduleAction(order * 48, () => {
            const eKey = `enemy:${eIdx}`;
            const ePts = getActorCanvasPoints(eKey, false);
            spawnFx('ice_spikes', {
              x: clamp(ePts.anchor.x - 18, 6, Math.max(12, _bufW - 12)),
              y: ePts.anchor.y,
              reach: 62,
              height: isSetupOnly ? 30 : Math.round(54 + ampRatio * 12),
              palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice,
            }, { stopAt: 0.85 });
            spawnFx('snowflake_burst', { x: ePts.hit.x, y: ePts.hit.y, count: ampTier >= 2 ? 9 : 6, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.78, scale: 0.52 });

            if (!isSetupOnly) {
              if (skillId === 'hand_thorn_field' || skillId === 'frost_3_thorns' || skillId === 'ice_3_starfrost' || skillId === 'insight_hulan_resonance' || skillId === 'insight_alice_cage') {
                spawnFx('icicle_fall', { x: ePts.anchor.x, y: ePts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.88 });
              }
              triggerHitReaction(eKey, isHeavy ? 15 : 10, isHeavy);
              if (order === 0) {
                if (isHeavy) {
                  spawnFx('crit_hit', { x: ePts.anchor.x, y: ePts.anchor.y, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.72 });
                }
                triggerHitStop(isHeavy ? 88 : 65);
                triggerTrauma(isHeavy ? Math.min(0.88, 0.78 + ampRatio * 0.10) : 0.48 + ampRatio * 0.14);
              }
            }
          });
        });
      });
      return legacyHandle;
    }

    // 4) 水系魔法（水球术 / 覆潮水弹 / 激流涌 / 折射水幕）
    if (skillId === 'hand_water_surge' || skillId === 'water_1_ball' || skillId === 'water_2_surge') {
      setActorPoseInternal('player', magicWindupPose, 145, false);
      spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.water }, { stopAt: 0.5 + ampRatio * 0.12 });

      scheduleAction(130, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', magicCastPose, 320, false);
        }
        const dist = clamp(Math.hypot(tPts.hit.x - pPts.cast.x, tPts.hit.y - pPts.cast.y), 36, Math.max(60, _bufW - 12));
        const aim = aimOpts(pPts.cast, tPts.hit);
        spawnFx('water_jet', {
          x: pPts.cast.x,
          y: pPts.cast.y,
          length: dist,
          flip: aim.flip,
          angle: aim.angle,
          palette: PALETTES.water,
        }, { stopAt: 0.34, preserveLength: true });

        scheduleAction(125, () => {
          if (info.missed) {
            spawnFx('splash', { x: tPts.anchor.x, y: tPts.anchor.y, stone: false, palette: PALETTES.water }, { stopAt: 0.62 });
            return;
          }
          triggerHitReaction(targetKey, isHeavy ? 15 : 11, isHeavy);
          spawnFx('wave_crash', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.82 });
          spawnFx('splash', { x: tPts.anchor.x, y: tPts.anchor.y, stone: false, palette: PALETTES.water }, { stopAt: 0.72 });
          if (isHeavy || ampTier >= 1) {
            if (isHeavy) spawnFx('crit_hit', { x: tPts.anchor.x, y: tPts.anchor.y, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.water }, { stopAt: 0.7 });
            if (ampTier >= 1) spawnFx('snowflake_burst', { x: tPts.hit.x, y: tPts.hit.y, count: ampTier >= 2 ? 9 : 6, palette: ampTier >= 2 ? PALETTES.crit : PALETTES.water }, { stopAt: 0.76, scale: 0.52 });
          }
          triggerHitStop(isHeavy ? 80 : 60);
          triggerTrauma(isHeavy ? Math.min(0.84, 0.68 + ampRatio * 0.12) : 0.38 + ampRatio * 0.14);
        });
      });
      return legacyHandle;
    }

    if (skillId === 'hand_water_veil') {
      setActorPoseInternal('player', magicWindupPose, 120, false);
      scheduleAction(110, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', magicCastPose, 300, false);
          squashActor('player', 1.08, 0.94, 200);
        }
        spawnFx('splash', { x: pPts.anchor.x, y: pPts.anchor.y, stone: false, palette: PALETTES.water }, { stopAt: 0.75 });
        spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 30, palette: PALETTES.water }, { stopAt: 0.92 });
      });
      return legacyHandle;
    }

    // 5) 护盾与立障（钢冰生根盾 / 凝水厚冰墙 / 冰晶护盾 / 镜霜冰壁，支持最高 +40% 魔力增幅强化护盾光环）
    if (SHIELD_GUARD_SKILLS.has(skillId)) {
      setActorPoseInternal('player', magicWindupPose, 120, false);
      squashActor('player', 1.06, 0.94, 130);
      scheduleAction(110, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', magicCastPose, 320, false);
          squashActor('player', 0.94, 1.08, 220);
        }
        const shBoost = clamp(ampPct / 0.40, 0, 1);
        spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: Math.round(32 + shBoost * 6), palette: ampTier >= 1 ? PALETTES.crit : PALETTES.ice }, { stopAt: 1.02 });
        spawnFx('ice_crystal', { x: pPts.anchor.x, y: pPts.anchor.y, height: Math.round(38 + shBoost * 8), palette: PALETTES.ice }, { stopAt: 0.96 });
        if (ampPct > 0.001) {
          spawnFx('snowflake_burst', { x: pPts.hit.x, y: pPts.hit.y, count: ampTier >= 1 ? 8 : 5, palette: ampTier >= 1 ? PALETTES.crit : PALETTES.ice }, { stopAt: 0.76 });
        }
      });
      return legacyHandle;
    }

    // 6) 霁馆步法 / 风行残像 / 残像瞬移（侧滑步法走 run 帧，定步后再亮剑势，回位走 run 帧绝不拖带挥砍/施法帧）
    if (SWORD_FOOTWORK_SKILLS.has(skillId)) {
      const isWind = skillId === 'sword_wind_afterimage' || skillId === 'move_afterimage';
      setActorPoseInternal('player', 'windup', 95, false);
      dashActor('player', -12, 0, 80, 'inQuad', false);
      scheduleAction(85, () => {
        if (myGen !== _playerActionGen) return;
        dashActor('player', 34, 0, 115, 'outCubic', true, isWind ? 'wind' : 'ice', { pose: 'run' });
        if (isWind) {
          spawnFx('blizzard_vortex', { x: pPts.anchor.x, y: pPts.anchor.y, height: 56, palette: PALETTES.wind }, { stopAt: 0.72 });
        } else {
          spawnFx('parry', { x: pPts.anchor.x + 10, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.65 });
          spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 28, palette: PALETTES.ice }, { stopAt: 0.7 });
        }
      });
      scheduleAction(205, () => {
        if (myGen === _playerActionGen) setActorPoseInternal('player', 'windup', 120, false);
      });
      scheduleAction(325, () => {
        if (myGen === _playerActionGen) dashActor('player', 0, 0, 175, 'outCubic', true, isWind ? 'wind' : 'ice', { pose: 'run', returnIdle: true });
      });
      return legacyHandle;
    }

    // 7) 剑术冲刺突斩（平斩、断水刃、冷刃送刀斩、看破封喉/回风/穿心：蓄力 windup(3) -> 2D 跨行疾奔 run -> 贴身 cast_step(4)/strike(5) -> 奔回 run -> idle）
    if (MELEE_DASH_SKILLS.has(skillId) || true) {
      const dashVec = computeMeleeDashVector(pPts, tPts, 'right', 96, 54);
      const useDouble = !!(isHeavy || (skillId !== 'basic_attack' && skillId !== 'sword_1_basic'));
      const slashPal = skillId === 'insight_wind_stillness' ? PALETTES.wind : PALETTES.swordIce;

      // 0ms: 蓄力收腰
      setActorPoseInternal('player', 'windup', 95, false);
      squashActor('player', 1.1, 0.92, 95);
      dashActor('player', -14, 0, 80, 'inQuad', false);

      // 85ms: 爆发前冲（完整 2D (dx, dy) 跨上/中/下三行冲刺，切换 run 步态，绝不在奔跑中途播 cast_step/strike！）
      scheduleAction(85, () => {
        if (myGen !== _playerActionGen) return;
        dashActor('player', dashVec.dx, dashVec.dy, 110, 'outQuart', true, 'ice', { pose: 'run' });
      });

      // 195ms: 到位后挥剑斩击 (cast_step(4) -> strike(5) -> cast_step(4)) + 顿帧 + 击退
      scheduleAction(195, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', 'strike', 210, false);
          squashActor('player', 1.12, 0.9, 170);
        }

        const slashX = clamp(tPts.anchor.x - 32, 8, Math.max(16, _bufW - 8));
        const slashY = tPts.anchor.y;
        if (useDouble) {
          spawnFx('double_slash', {
            x: slashX,
            y: slashY,
            palette: slashPal,
            sparks: PALETTES.swordSparks,
          }, { stopAt: 0.72 });
        } else {
          spawnFx('sword_slash', {
            x: slashX,
            y: slashY,
            palette: PALETTES.swordIce,
            sparks: PALETTES.swordSparks,
            radius: 40,
          }, { stopAt: 0.65 });
        }

        if (skillId === 'insight_eastwing_draft') {
          spawnFx('wave_crash', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.78 });
        } else if (skillId === 'insight_wind_stillness') {
          spawnFx('ice_shatter', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.78 });
        }

        if (!info.missed) {
          spawnFx('hit_spark', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.45 });
          if (info.didRiposte) {
            spawnFx('parry', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.65 });
          } else if (isHeavy) {
            spawnFx('crit_hit', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.72 });
          }
          triggerHitReaction(targetKey, isHeavy ? 20 : 14, isHeavy);
          triggerHitStop(isHeavy ? 90 : 68);
          triggerTrauma(isHeavy ? 0.76 : 0.44);
        }
      });

      // 445ms: 轻盈奔回归位（切换 run 步态，回位自动落回 idle）
      scheduleAction(445, () => {
        if (myGen === _playerActionGen) {
          dashActor('player', 0, 0, 200, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true });
        }
      });
    }
    return legacyHandle;
  }

  /* -------------------- 敌方回合动作全套编排（支持 6+6 二维跨行冲刺 + targetActorKey 定向攻击常驻友军） -------------------- */
  function playEnemyAction(battleState, info) {
    if (!isEnabled() || !info) return createNoopActionHandle();
    ensureVfxCanvas();
    ensureLoopRunning();

    const eIdx = info.enemyIdx != null ? info.enemyIdx : 0;
    const eKey = `enemy:${eIdx}`;
    const myEnemyEpoch = _enemyActionEpoch;
    const myEnemyGen = (_enemyActionGen.get(eKey) || 0) + 1;
    _enemyActionGen.set(eKey, myEnemyGen);
    const isCurEnemyGen = () => myEnemyEpoch === _enemyActionEpoch && _enemyActionGen.get(eKey) === myEnemyGen;

    const spriteId = info.spriteId || resolveEnemySpriteId(info.enemy);
    const ePts = getActorCanvasPoints(eKey, false);

    // 精准解析受击目标（支持 'player' 与前排常驻友军如 'ally:reno'）
    const requestedTargetKey = info.targetActorKey || 'player';
    if (requestedTargetKey !== 'player' && !_actors.has(requestedTargetKey)) {
      syncStage(battleState);
    }
    const targetActorKey = (requestedTargetKey !== 'player' && _actors.has(requestedTargetKey))
      ? requestedTargetKey
      : 'player';
    const targetPts = getActorCanvasPoints(targetActorKey, false);
    const intent = info.intent || {};
    const heavy = !!(intent.shatterPlayerShield || (intent.dmg && intent.dmg >= 55) || (info.hpLoss && info.hpLoss >= 45));

    const targetSt = _actors.get(targetActorKey);
    const targetSpriteId = (targetSt && targetSt.spriteId)
      || (targetActorKey === 'player' ? resolvePlayerSpriteId(battleState, false) : 'reno');
    const targetDualMagic = hasMagicCastFrames(targetSpriteId);
    const isAllyRenoTarget = targetActorKey === 'ally:reno' || targetSpriteId === 'reno';

    const normalizeBlockGrade = val => {
      const s = val != null ? String(val).trim().toLowerCase() : '';
      return (s === 'bad' || s === 'good' || s === 'great' || s === 'perfect') ? s : '';
    };
    const blockGrade = normalizeBlockGrade(info.blockGrade);
    const noBlockPrompt = info.noBlockPrompt != null
      ? !!info.noBlockPrompt
      : !!(info.enemy && info.enemy.noBlockPrompt);

    if (hasEditionA()) {
      const edApi = getEditionAApi();
      const isGated = !!info.gated;
      const expectedGateCount = Math.max(
        1,
        Number(info.gateCount != null ? info.gateCount : info.beats) || 1
      );
      const resolvedEnemyVfx =
        (info.vfxId && edApi.resolveSkillId(info.vfxId)) ||
        (intent.moveName && edApi.resolveSkillId(intent.moveName)) ||
        (intent.moveKey && edApi.resolveSkillId(intent.moveKey)) ||
        edApi.resolveSkillId(`enemy_${spriteId}`) ||
        'enemy_wolf_frost_claw';

      const eLog = toLogicalPts(ePts);
      const tLog = toLogicalPts(targetPts);
      let impactApplied = false;
      let enemyGateImpactHandled = false;
      let enemyGateBlockPlayed = false;
      let suppressEnemyVfxHitStopUntil = 0;
      let enemyReleaseCount = 0;
      const enemyBeatSettled = new Set();

      const applyEnemySettlement = (beatIdx, settleSrc, fromGate) => {
        const src = (settleSrc && typeof settleSrc === 'object') ? settleSrc : {};
        if (fromGate) {
          if (enemyBeatSettled.has(beatIdx)) return;
          enemyBeatSettled.add(beatIdx);
          enemyGateImpactHandled = true;
        } else {
          if (impactApplied) return;
          impactApplied = true;
        }

        const freshTPts = getActorCanvasPoints(targetActorKey, false);
        const freshEPts = getActorCanvasPoints(eKey, false);
        const freshTLog = toLogicalPts(freshTPts);
        const freshELog = toLogicalPts(freshEPts);
        const tPos = { x: freshTLog.hit.x, y: freshTLog.hit.y, groundY: freshTLog.anchor.y };

        if (!fromGate && typeof info.onImpact === 'function') {
          try { info.onImpact(tPos); } catch (e) {}
        }

        const effParried = src.parried !== undefined ? !!src.parried : !!info.parried;
        const effEvaded = src.evaded !== undefined ? !!src.evaded : !!info.evaded;
        const effNoBlockPrompt = src.noBlockPrompt !== undefined ? !!src.noBlockPrompt : noBlockPrompt;
        const effHpLoss = src.hpLoss !== undefined ? Number(src.hpLoss) || 0 : (Number(info.hpLoss) || 0);
        const effBlocked = src.blocked !== undefined ? !!src.blocked : !!info.blocked;
        const effShieldShattered = src.shieldShattered !== undefined
          ? !!src.shieldShattered
          : (src.shieldBroken !== undefined ? !!src.shieldBroken : !!info.shieldShattered);
        const effShieldAbsorbed = src.shieldAbsorbed !== undefined
          ? Number(src.shieldAbsorbed) || 0
          : (Number(info.shieldAbsorbed) || 0);
        const effBypassMagic = src.bypassMagicPlayerShield !== undefined
          ? !!src.bypassMagicPlayerShield
          : !!info.bypassMagicPlayerShield;
        const effSkipped = !!src.skipped;
        const effHeavy = !!(heavy || effHpLoss >= 45 || effShieldShattered);
        const rawG = src.blockGrade !== undefined
          ? src.blockGrade
          : (fromGate && src.grade !== undefined && !effNoBlockPrompt ? src.grade : info.blockGrade);
        const effBlockGrade = normalizeBlockGrade(rawG);
        const effCrit = !!(src.crit || src.didCrit);
        const effBroken = !!(src.broken || src.didBreak);
        const effOneMore = !!(src.oneMore || src.didOneMore);

        const playExtraCritBreak = () => {
          if (effCrit) {
            playEditionA('fx_crit_starburst', {
              pos: tPos,
              to: tPos,
              targetGroundY: freshTLog.anchor.y,
              facing: -1,
              amp: 1,
            });
          }
          if (effBroken || effOneMore) {
            playEditionA('fx_weakness_break', {
              pos: tPos,
              to: tPos,
              targetGroundY: freshTLog.anchor.y,
              facing: -1,
              amp: 1,
              oneMore: effOneMore,
            });
          }
        };

        if (effParried) {
          setActorPoseInternal(targetActorKey, 'strike', 220, false);
          dashActor(targetActorKey, 24, clamp((freshEPts.screenY - freshTPts.screenY) * 0.18, -22, 22), 90, 'outQuad', true, 'ice');
          if (fromGate) {
            enemyGateBlockPlayed = true;
            _lastGateBlockFx = { actorKey: targetActorKey, grade: 'perfect', ts: nowPerf() };
          }
          const parryOpts = {
            pos: tPos,
            from: freshTLog.hit,
            groundY: freshTLog.anchor.y,
            side: 'player',
            facing: 1,
            onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
          };
          if (!fromGate || effSkipped) {
            parryOpts.onHitStop = ms => triggerHitStop(ms);
          }
          playEditionA('fx_block_perfect', parryOpts);
          playEditionA('sword_riposte_flash', {
            from: freshTLog.cast,
            groundY: freshTLog.anchor.y,
            to: freshELog.hit,
            targetGroundY: freshELog.anchor.y,
            facing: 1,
            spriteId: targetSpriteId,
            onImpact() { triggerHitReaction(eKey, 16, true); },
            onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
            onHitStop(ms) { if (!fromGate || effSkipped) triggerHitStop(ms); },
          });
          scheduleAction(260, () => dashActor(targetActorKey, 0, 0, 170, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true }));
          return;
        }
        if (effEvaded) {
          dashActor(targetActorKey, -24, 0, 95, 'outQuad', true, 'wind', { pose: 'run' });
          playEditionA('fx_status_micro', {
            pos: tPos,
            from: freshTLog.hit,
            groundY: freshTLog.anchor.y,
            side: 'player',
            facing: 1,
            variant: 'buff',
          });
          scheduleAction(200, () => dashActor(targetActorKey, 0, 0, 170, 'outCubic', false, 'wind', { pose: 'run', returnIdle: true }));
          return;
        }

        // 杂兵无格挡提示（noBlockPrompt）：不播放任何格挡盾光，直播受击反馈
        if (effNoBlockPrompt) {
          if (effBlocked && !(effHpLoss > 0)) {
            const guardPose = isAllyRenoTarget ? 'earth_step' : (targetDualMagic ? 'magic_windup' : 'windup');
            setActorPoseInternal(targetActorKey, guardPose, 180, false);
            squashActor(targetActorKey, 1.06, 0.95, 160);
          } else {
            triggerHitReaction(targetActorKey, effHeavy ? -16 : -10, effHeavy);
          }
          if (effShieldShattered || effShieldAbsorbed > 0) {
            playEditionA('fx_shield_hit', {
              pos: tPos,
              from: freshTLog.hit,
              groundY: freshTLog.anchor.y,
              side: 'player',
              facing: 1,
              shattered: effShieldShattered,
            });
          }
          playExtraCritBreak();
          return;
        }

        // V3.2 实时格挡评级透传：精准在爆裂当帧只播 1 次 fx_block_{bad|good|great|perfect}
        if (effBlockGrade) {
          if (fromGate) {
            enemyGateBlockPlayed = true;
            _lastGateBlockFx = { actorKey: targetActorKey, grade: effBlockGrade, ts: nowPerf() };
          }
          const guardPose = isAllyRenoTarget ? 'earth_step' : (targetDualMagic ? 'magic_windup' : 'windup');
          if (effBlockGrade === 'perfect' || effBlockGrade === 'great') {
            setActorPoseInternal(targetActorKey, guardPose, 220, false);
            squashActor(targetActorKey, 1.08, 0.94, 180);
            const blkOpts = {
              pos: tPos,
              from: freshTLog.hit,
              groundY: freshTLog.anchor.y,
              side: 'player',
              facing: 1,
              onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
            };
            if (effBlockGrade === 'perfect' && (!fromGate || effSkipped)) {
              blkOpts.onHitStop = ms => triggerHitStop(ms);
            }
            playEditionA(`fx_block_${effBlockGrade}`, blkOpts);
          } else if (effBlockGrade === 'good') {
            if (effHpLoss > 0 && !effBlocked) {
              triggerHitReaction(targetActorKey, -8, false);
            } else {
              setActorPoseInternal(targetActorKey, guardPose, 200, false);
              squashActor(targetActorKey, 1.06, 0.95, 160);
            }
            playEditionA('fx_block_good', {
              pos: tPos,
              from: freshTLog.hit,
              groundY: freshTLog.anchor.y,
              side: 'player',
              facing: 1,
            });
          } else {
            triggerHitReaction(targetActorKey, effHeavy ? -16 : -10, effHeavy);
            playEditionA('fx_block_bad', {
              pos: tPos,
              from: freshTLog.hit,
              groundY: freshTLog.anchor.y,
              side: 'player',
              facing: 1,
            });
          }
          if (effShieldShattered || effShieldAbsorbed > 0) {
            playEditionA('fx_shield_hit', {
              pos: tPos,
              from: freshTLog.hit,
              groundY: freshTLog.anchor.y,
              side: 'player',
              facing: 1,
              shattered: effShieldShattered,
            });
          }
          playExtraCritBreak();
          return;
        }

        if (effBlocked) {
          const guardPose = isAllyRenoTarget ? 'earth_step' : (targetDualMagic ? 'magic_windup' : 'windup');
          setActorPoseInternal(targetActorKey, guardPose, 220, false);
          squashActor(targetActorKey, 1.08, 0.94, 180);
          if (fromGate) {
            enemyGateBlockPlayed = true;
            _lastGateBlockFx = { actorKey: targetActorKey, grade: 'great', ts: nowPerf() };
          }
          playEditionA('fx_block_great', {
            pos: tPos,
            from: freshTLog.hit,
            groundY: freshTLog.anchor.y,
            side: 'player',
            facing: 1,
            onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
          });
          if (effShieldShattered || effShieldAbsorbed > 0) {
            playEditionA('fx_shield_hit', {
              pos: tPos,
              from: freshTLog.hit,
              groundY: freshTLog.anchor.y,
              side: 'player',
              facing: 1,
              shattered: effShieldShattered,
            });
          }
          playExtraCritBreak();
          return;
        }

        triggerHitReaction(targetActorKey, effHeavy ? -16 : -10, effHeavy);
        if (effShieldAbsorbed > 0 && effHpLoss > 0) {
          playEditionA('fx_block_good', {
            pos: tPos,
            from: freshTLog.hit,
            groundY: freshTLog.anchor.y,
            side: 'player',
            facing: 1,
          });
        } else if (effHpLoss >= 45 || effBypassMagic) {
          playEditionA('fx_block_bad', {
            pos: tPos,
            from: freshTLog.hit,
            groundY: freshTLog.anchor.y,
            side: 'player',
            facing: 1,
          });
        }
        if (effShieldShattered || effShieldAbsorbed > 0) {
          playEditionA('fx_shield_hit', {
            pos: tPos,
            from: freshTLog.hit,
            groundY: freshTLog.anchor.y,
            side: 'player',
            facing: 1,
            shattered: effShieldShattered,
          });
        }
        playExtraCritBreak();
      };

      let isEnemyMelee = false;
      let enemyGhostTone = 'fire';
      let enemyReturned = false;
      let enemyStrikeFired = false;
      let lastEnemyStrikeTs = 0;
      let enemySafetyTimer = null;
      let edHandle = null;
      let doneSettled = false;
      let resolveDone = null;
      const donePromise = new Promise(resolve => { resolveDone = resolve; });

      const clearEnemySafetyTimer = () => {
        if (enemySafetyTimer) {
          clearTimeout(enemySafetyTimer);
          _rawTimers.delete(enemySafetyTimer);
          enemySafetyTimer = null;
        }
      };

      const markDone = () => {
        if (doneSettled) return;
        doneSettled = true;
        if (resolveDone) resolveDone();
      };

      const finishActorReturn = immediate => {
        if (enemyReturned) return;
        enemyReturned = true;
        clearEnemySafetyTimer();
        if (!isCurEnemyGen()) return;

        const doEnemyReturn = () => {
          if (!isCurEnemyGen()) return;
          const st = _actors.get(eKey);
          if (!st) return;
          st.poseLock = false;
          const displaced = Math.abs(st.dx) > 0.5 || Math.abs(st.dy) > 0.5;
          if (displaced) {
            const retDur = isEnemyMelee ? 200 : 180;
            const retOpts = isEnemyMelee ? { pose: 'run', returnIdle: true } : { returnIdle: true };
            dashActor(eKey, 0, 0, retDur, 'outCubic', false, enemyGhostTone, retOpts);
          } else if (st.poseOverride === 'strike_ready') {
            setActorPoseInternal(eKey, 'idle', 0, false);
          }
        };

        const holdLeft = (!immediate && lastEnemyStrikeTs > 0)
          ? Math.max(0, 180 - (nowPerf() - lastEnemyStrikeTs))
          : 0;
        if (holdLeft > 12) {
          scheduleAction(holdLeft, doEnemyReturn);
        } else {
          doEnemyReturn();
        }
      };

      const armEnemySafetyReturn = ms => {
        clearEnemySafetyTimer();
        enemySafetyTimer = trackRealTimer(() => {
          enemySafetyTimer = null;
          finishActorReturn(true);
          markDone();
        }, Math.max(1200, Number(ms) || 6000));
      };

      // 敌方像素精灵动作编排（完整保留 6 大敌方原型姿势/跨行冲刺/雷纳德挡灾），门控近战锁 strike_ready 杜绝提前归位
      if (spriteId === 'beatrice' || spriteId === 'eastwing_commander' || spriteId === 'corridor_vanguard' || spriteId === 'flame_mage') {
        const moveText = String(intent.moveName || '');
        if (spriteId === 'flame_mage') {
          isEnemyMelee = false;
        } else if (spriteId === 'eastwing_commander') {
          const isEastwingMagic = intent.stance === 'DUAL_CAST'
            || (intent.gainShield > 0 && intent.stance !== 'CLOSE_LUNGE' && !/戟/.test(moveText))
            || (intent.elem === 'fire' && intent.stance !== 'CLOSE_LUNGE' && !/劈|斩|刺/.test(moveText));
          isEnemyMelee = !isEastwingMagic;
        } else if (spriteId === 'beatrice') {
          isEnemyMelee = intent.stance === 'CLOSE_LUNGE' || intent.stance === 'GUARD_COUNTER';
        } else {
          isEnemyMelee = intent.stance === 'CLOSE_LUNGE' || intent.stance === 'GUARD_COUNTER' || intent.elem === 'phys';
        }
        enemyGhostTone = 'fire';
        const enemyDualMagic = hasMagicCastFrames(spriteId);
        if (isEnemyMelee) {
          const dashVec = computeMeleeDashVector(ePts, targetPts, 'left', 104, 48);
          setActorPoseInternal(eKey, 'windup', 105, false);
          squashActor(eKey, 1.08, 0.93, 100);
          dashActor(eKey, 12, 0, 85, 'inQuad', false);
          scheduleAction(95, () => {
            if (!isCurEnemyGen() || enemyReturned) return;
            dashActor(eKey, dashVec.dx, dashVec.dy, 115, 'outQuart', true, 'fire', { pose: 'run' });
          });
          if (isGated) {
            scheduleAction(210, () => {
              if (isCurEnemyGen() && !enemyReturned && !enemyStrikeFired) {
                setActorPoseInternal(eKey, 'strike_ready', 0, true);
              }
            });
            armEnemySafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
          } else {
            scheduleAction(210, () => {
              if (!isCurEnemyGen()) return;
              setActorPoseInternal(eKey, 'strike', 240, false);
              squashActor(eKey, 1.12, 0.9, 170);
            });
            scheduleAction(465, () => {
              if (!isCurEnemyGen()) return;
              dashActor(eKey, 0, 0, 200, 'outCubic', false, 'fire', { pose: 'run', returnIdle: true });
            });
          }
        } else {
          setActorPoseInternal(eKey, enemyDualMagic ? 'magic_windup' : 'windup', 135, false);
          squashActor(eKey, 0.95, 1.07, 120);
          dashActor(eKey, 10, 0, 90, 'inQuad', false);
          scheduleAction(115, () => {
            if (!isCurEnemyGen() || enemyReturned) return;
            setActorPoseInternal(eKey, enemyDualMagic ? 'magic_cast' : 'strike', 310, false);
            dashActor(eKey, -10, 0, 90, 'outQuad', false);
            if (!isGated) {
              scheduleAction(280, () => {
                if (isCurEnemyGen()) dashActor(eKey, 0, 0, 175, 'outCubic', false);
              });
            }
          });
          if (isGated) {
            armEnemySafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
          }
        }
      } else {
        setActorPoseInternal(eKey, 'windup', 110, false);
        squashActor(eKey, 1.08, 0.93, 105);
        dashActor(eKey, 12, 0, 85, 'inQuad', false);

        if (spriteId === 'rowan') {
          isEnemyMelee = false;
          enemyGhostTone = 'ice';
          const recentLog = battleState && Array.isArray(battleState.log) ? battleState.log.slice(-4).join(' ') : '';
          const guardAllyKey = info.guardedByAlly || 'ally:reno';
          const didRenoBlock = !!(info.renoRockBlock || info.guardedByAlly || (intent.renoRockBlock && (
            recentLog.includes('雷纳德') ||
            info.blocked ||
            intent.eclipseTrueMagic ||
            (battleState && battleState.player && battleState.player.shield > 0)
          )));
          if (didRenoBlock) {
            if (hasResidentAlly(guardAllyKey)) {
              scheduleAction(45, () => playAllyGuard(battleState, { actorKey: guardAllyKey, targetActorKey, reason: 'rock_block' }));
            } else {
              scheduleAction(55, () => playRenoSupport('earth', { reason: 'rock_block', skipPlayerPose: true }));
            }
          }
          scheduleAction(110, () => {
            if (!isCurEnemyGen() || enemyReturned) return;
            setActorPoseInternal(eKey, 'strike', 320, false);
            dashActor(eKey, -16, 0, 100, 'outQuad', false);
            if (!isGated) {
              scheduleAction(310, () => {
                if (isCurEnemyGen()) dashActor(eKey, 0, 0, 180, 'outCubic', false);
              });
            }
          });
          if (isGated) {
            armEnemySafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
          }
        } else if (spriteId === 'alice' || spriteId === 'wind_god_avatar') {
          isEnemyMelee = true;
          enemyGhostTone = 'wind';
          const dashVec = computeMeleeDashVector(ePts, targetPts, 'left', 108, 44);
          scheduleAction(95, () => {
            if (!isCurEnemyGen() || enemyReturned) return;
            dashActor(eKey, dashVec.dx, dashVec.dy, 110, 'outQuart', true, 'wind', { pose: 'run' });
          });
          if (isGated) {
            scheduleAction(205, () => {
              if (isCurEnemyGen() && !enemyReturned && !enemyStrikeFired) {
                setActorPoseInternal(eKey, 'strike_ready', 0, true);
              }
            });
            armEnemySafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
          } else {
            scheduleAction(205, () => {
              if (!isCurEnemyGen()) return;
              setActorPoseInternal(eKey, 'strike', 240, false);
              squashActor(eKey, 1.1, 0.92, 170);
            });
            scheduleAction(455, () => {
              if (!isCurEnemyGen()) return;
              dashActor(eKey, 0, 0, 195, 'outCubic', false, 'wind', { pose: 'run', returnIdle: true });
            });
          }
        } else if (spriteId === 'aino' || spriteId === 'noelle') {
          isEnemyMelee = false;
          enemyGhostTone = 'ice';
          scheduleAction(110, () => {
            if (!isCurEnemyGen() || enemyReturned) return;
            setActorPoseInternal(eKey, 'strike', 310, false);
            dashActor(eKey, -12, 0, 90, 'outQuad', false);
            if (!isGated) {
              scheduleAction(290, () => {
                if (isCurEnemyGen()) dashActor(eKey, 0, 0, 180, 'outCubic', false);
              });
            }
          });
          if (isGated) {
            armEnemySafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
          }
        } else {
          const isIceBeast = spriteId === 'abyss_behemoth' || spriteId === 'tundra_brute' || spriteId === 'frost_hound';
          isEnemyMelee = true;
          enemyGhostTone = isIceBeast ? 'ice' : 'claw';
          const dashVec = computeMeleeDashVector(ePts, targetPts, 'left', 102, 52);
          scheduleAction(95, () => {
            if (!isCurEnemyGen() || enemyReturned) return;
            dashActor(eKey, dashVec.dx, dashVec.dy, 105, 'outQuart', true, enemyGhostTone, { pose: 'run' });
          });
          if (isGated) {
            scheduleAction(200, () => {
              if (isCurEnemyGen() && !enemyReturned && !enemyStrikeFired) {
                setActorPoseInternal(eKey, 'strike_ready', 0, true);
              }
            });
            armEnemySafetyReturn(Math.max(5500, expectedGateCount * 2000 + 2500));
          } else {
            scheduleAction(200, () => {
              if (!isCurEnemyGen()) return;
              setActorPoseInternal(eKey, 'strike', 240, false);
              squashActor(eKey, 1.14, 0.88, 170);
            });
            scheduleAction(455, () => {
              if (!isCurEnemyGen()) return;
              dashActor(eKey, 0, 0, 200, 'outCubic', false, enemyGhostTone, { pose: 'run', returnIdle: true });
            });
          }
        }
      }

      const enemyPlayOpts = {
        from: eLog.cast,
        to: tLog.hit,
        groundY: eLog.anchor.y,
        targetGroundY: tLog.anchor.y,
        targets: [{ x: tLog.hit.x, y: tLog.hit.y, groundY: tLog.anchor.y }],
        facing: -1,
        spriteId,
        heavy,
        onImpact(hitOrder, pt, isLast) {
          if (isGated && (enemyGateImpactHandled || enemyGateBlockPlayed)) {
            if (typeof info.onImpact === 'function') {
              const freshTLog = toLogicalPts(getActorCanvasPoints(targetActorKey, false));
              try { info.onImpact({ x: freshTLog.hit.x, y: freshTLog.hit.y, groundY: freshTLog.anchor.y }, hitOrder, pt, isLast); } catch (e) {}
            }
            return;
          }
          applyEnemySettlement(hitOrder != null ? hitOrder : 0, info, false);
        },
        onShake(px) {
          if (!info.evaded) triggerTrauma(editionAShakeToTrauma(px));
        },
        onHitStop(ms) {
          if (info.evaded) return;
          if (isGated && nowPerf() < suppressEnemyVfxHitStopUntil) return;
          triggerHitStop(ms);
        },
      };
      if (info.gated !== undefined) enemyPlayOpts.gated = !!info.gated;
      if (info.autoImpactGate !== undefined) enemyPlayOpts.autoImpactGate = !!info.autoImpactGate;
      if (info.gateCount != null && Number.isFinite(Number(info.gateCount))) {
        enemyPlayOpts.gateCount = Number(info.gateCount);
      }
      if (info.beats != null && Number.isFinite(Number(info.beats))) {
        enemyPlayOpts.beats = Number(info.beats);
      }
      if (info.beatGapMs != null && Number.isFinite(Number(info.beatGapMs))) {
        enemyPlayOpts.beatGapMs = Number(info.beatGapMs);
      }
      if (typeof info.onPreTelegraph === 'function') {
        enemyPlayOpts.onPreTelegraph = info.onPreTelegraph;
      }
      if (typeof info.onBeatReady === 'function') {
        enemyPlayOpts.onBeatReady = info.onBeatReady;
      }
      if (isGated || typeof info.onAllBeatsComplete === 'function') {
        enemyPlayOpts.onAllBeatsComplete = (...args) => {
          finishActorReturn(false);
          if (typeof info.onAllBeatsComplete === 'function') {
            try { info.onAllBeatsComplete(...args); } catch (e) {}
          }
        };
      }
      enemyPlayOpts.onComplete = (...args) => {
        if (isGated) finishActorReturn(false);
        markDone();
        if (typeof info.onComplete === 'function') {
          try { info.onComplete(...args); } catch (e) {}
        }
      };

      const edRet = playEditionA(resolvedEnemyVfx, enemyPlayOpts);
      edHandle = (edRet && typeof edRet === 'object') ? edRet : null;
      if (edHandle && edHandle.donePromise && typeof edHandle.donePromise.then === 'function') {
        edHandle.donePromise.then(
          () => {
            if (isGated) finishActorReturn(false);
            markDone();
          },
          () => {
            if (isGated) finishActorReturn(true);
            markDone();
          }
        );
      }

      const releaseGate = (beatIdx, payload) => {
        const idx = Number.isFinite(Number(beatIdx)) ? Number(beatIdx) : enemyReleaseCount;
        enemyReleaseCount += 1;
        const p = (payload && typeof payload === 'object') ? payload : null;

        if (p && p.cancelled) {
          if (edHandle && typeof edHandle.releaseAll === 'function') {
            try { edHandle.releaseAll(p); } catch (e) {}
          } else if (edHandle && typeof edHandle.releaseGate === 'function') {
            try { edHandle.releaseGate(idx, p); } catch (e) {}
          }
          _editionAForceRender = true;
          finishActorReturn(true);
          return;
        }

        if (isGated) {
          armEnemySafetyReturn(4500);
        }
        if (p && !p.skipped) {
          suppressEnemyVfxHitStopUntil = nowPerf() + 260;
        }

        if (isEnemyMelee && isGated && isCurEnemyGen() && !enemyReturned) {
          enemyStrikeFired = true;
          lastEnemyStrikeTs = nowPerf();
          setActorPoseInternal(eKey, 'strike', 220, false);
          squashActor(eKey, 1.12, 0.9, 170);
          if (expectedGateCount > 1 && idx < expectedGateCount - 1) {
            const strikeStamp = lastEnemyStrikeTs;
            scheduleAction(220, () => {
              if (isCurEnemyGen() && !enemyReturned && lastEnemyStrikeTs === strikeStamp) {
                setActorPoseInternal(eKey, 'strike_ready', 0, true);
              }
            });
          }
        }

        applyEnemySettlement(idx, p || info, true);

        if (edHandle && typeof edHandle.releaseGate === 'function') {
          try { edHandle.releaseGate(idx, p); } catch (e) {}
        }
        _editionAForceRender = true;
      };

      const releaseAll = payload => {
        const p = (payload && typeof payload === 'object') ? payload : null;
        if (edHandle && typeof edHandle.releaseAll === 'function') {
          try { edHandle.releaseAll(p); } catch (e) {}
        }
        _editionAForceRender = true;
        finishActorReturn(!!(p && p.cancelled));
      };

      return {
        releaseGate,
        releaseAll,
        finishActorReturn: () => finishActorReturn(false),
        donePromise,
      };
    }

    const legacyEnemyHandle = {
      releaseGate() {},
      releaseAll() {
        if (isCurEnemyGen()) {
          dashActor(eKey, 0, 0, 180, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true });
        }
      },
      finishActorReturn() {
        if (isCurEnemyGen()) {
          dashActor(eKey, 0, 0, 180, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true });
        }
      },
      donePromise: Promise.resolve(),
    };

    const applyTargetImpact = () => {
      if (info.parried) {
        // 玩家/友军生根步卸力反斩！
        setActorPoseInternal(targetActorKey, 'strike', 220, false);
        dashActor(targetActorKey, 24, clamp((ePts.screenY - targetPts.screenY) * 0.18, -22, 22), 90, 'outQuad', true, 'ice');
        spawnFx('parry', { x: targetPts.anchor.x + 12, y: targetPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.68 });
        spawnFx('sword_slash', { x: clamp(ePts.anchor.x - 30, 8, Math.max(16, _bufW - 8)), y: ePts.anchor.y, palette: PALETTES.swordIce, sparks: PALETTES.swordSparks }, { stopAt: 0.65 });
        triggerHitReaction(eKey, 16, true);
        triggerHitStop(85);
        triggerTrauma(0.62);
        scheduleAction(260, () => dashActor(targetActorKey, 0, 0, 170, 'outCubic', false, 'ice', { pose: 'run', returnIdle: true }));
        return;
      }
      if (info.evaded) {
        // 风行残像闪避（纯步态撤闪 + 回位）
        dashActor(targetActorKey, -24, 0, 95, 'outQuad', true, 'wind', { pose: 'run' });
        spawnFx('parry', { x: targetPts.anchor.x + 10, y: targetPts.anchor.y, palette: PALETTES.wind }, { stopAt: 0.55 });
        scheduleAction(200, () => dashActor(targetActorKey, 0, 0, 170, 'outCubic', false, 'wind', { pose: 'run', returnIdle: true }));
        return;
      }
      if (!noBlockPrompt && (blockGrade === 'perfect' || blockGrade === 'great' || (!blockGrade && info.blocked))) {
        // 护盾格挡（雷纳德持岩壁走 earth_step + 土系色板，主角走冰系护盾）
        const guardPose = isAllyRenoTarget ? 'earth_step' : (targetDualMagic ? 'magic_windup' : 'windup');
        const guardPal = isAllyRenoTarget ? PALETTES.earth : PALETTES.ice;
        setActorPoseInternal(targetActorKey, guardPose, 220, false);
        squashActor(targetActorKey, 1.08, 0.94, 180);
        spawnFx('parry', { x: targetPts.anchor.x + 14, y: targetPts.anchor.y, palette: guardPal }, { stopAt: 0.62 });
        spawnFx('divine_shield', { x: targetPts.anchor.x, y: targetPts.anchor.y, radius: 28, palette: guardPal }, { stopAt: 0.48 });
        if (blockGrade === 'perfect') triggerHitStop(60);
        triggerTrauma(0.22);
        return;
      }
      // 目标真实受击（精准落到 player 或 ally:reno；杂兵 noBlockPrompt 直播受击）
      triggerHitReaction(targetActorKey, heavy ? -16 : -10, heavy);
      spawnFx('hit_spark', { x: targetPts.anchor.x, y: targetPts.anchor.y, flip: true }, { stopAt: 0.45 });
      if (heavy) {
        triggerHitStop(65);
        triggerTrauma(0.62);
      } else {
        triggerTrauma(0.3);
      }
    };

    // A) 烈焰系：贝阿特丽丝 (9帧双态) / 东翼统领 (9帧双态) / 宫廷封锁官 / 赤炎术士 (7帧远程烈焰)
    if (spriteId === 'beatrice' || spriteId === 'eastwing_commander' || spriteId === 'corridor_vanguard' || spriteId === 'flame_mage') {
      const moveText = String(intent.moveName || '');
      let isMelee;
      if (spriteId === 'flame_mage') {
        isMelee = false;
      } else if (spriteId === 'eastwing_commander') {
        const isEastwingMagic = intent.stance === 'DUAL_CAST'
          || (intent.gainShield > 0 && intent.stance !== 'CLOSE_LUNGE' && !/戟/.test(moveText))
          || (intent.elem === 'fire' && intent.stance !== 'CLOSE_LUNGE' && !/劈|斩|刺/.test(moveText));
        isMelee = !isEastwingMagic;
      } else if (spriteId === 'beatrice') {
        isMelee = intent.stance === 'CLOSE_LUNGE' || intent.stance === 'GUARD_COUNTER';
      } else {
        isMelee = intent.stance === 'CLOSE_LUNGE' || intent.stance === 'GUARD_COUNTER' || intent.elem === 'phys';
      }

      const enemyDualMagic = hasMagicCastFrames(spriteId);

      if (isMelee) {
        // 近战突刺/重劈：windup(3) -> 2D 跨行疾奔 run -> 贴身 cast_step(4)/strike(5) -> 奔回 run -> idle
        const dashVec = computeMeleeDashVector(ePts, targetPts, 'left', 104, 48);
        setActorPoseInternal(eKey, 'windup', 105, false);
        squashActor(eKey, 1.08, 0.93, 100);
        dashActor(eKey, 12, 0, 85, 'inQuad', false);

        scheduleAction(95, () => {
          dashActor(eKey, dashVec.dx, dashVec.dy, 115, 'outQuart', true, 'fire', { pose: 'run' });
        });
        scheduleAction(210, () => {
          setActorPoseInternal(eKey, 'strike', 240, false);
          squashActor(eKey, 1.12, 0.9, 170);
          spawnFx('heavy_cleave', { x: clamp(targetPts.anchor.x + 28, 8, Math.max(16, _bufW - 8)), y: targetPts.anchor.y, flip: true, palette: PALETTES.fire }, { stopAt: 0.78 });
          applyTargetImpact();
        });
        scheduleAction(465, () => {
          dashActor(eKey, 0, 0, 200, 'outCubic', false, 'fire', { pose: 'run', returnIdle: true });
        });
      } else {
        // 远程烈焰/护盾法术：beatrice 与 eastwing_commander 使用 magic_windup(7) -> magic_cast(8)！
        setActorPoseInternal(eKey, enemyDualMagic ? 'magic_windup' : 'windup', 135, false);
        squashActor(eKey, 0.95, 1.07, 120);
        dashActor(eKey, 10, 0, 90, 'inQuad', false);

        scheduleAction(115, () => {
          setActorPoseInternal(eKey, enemyDualMagic ? 'magic_cast' : 'strike', 310, false);
          dashActor(eKey, -10, 0, 90, 'outQuad', false);
          if (spriteId === 'eastwing_commander' && intent.gainShield > 0) {
            spawnFx('divine_shield', { x: ePts.anchor.x, y: ePts.anchor.y, radius: 32, palette: PALETTES.fire }, { stopAt: 0.92 });
          }
          spawnProjectile('fireball', ePts.cast, targetPts.hit, { palette: PALETTES.fire, radius: 6 }, 185, () => {
            spawnFx(heavy ? 'flame_pillar' : 'fire_ring', { x: targetPts.anchor.x, y: targetPts.anchor.y, height: 112, reach: 76, palette: PALETTES.fire }, { stopAt: 0.85 });
            applyTargetImpact();
          });
          scheduleAction(280, () => dashActor(eKey, 0, 0, 175, 'outCubic', false));
        });
      }
      return legacyEnemyHandle;
    }

    // 0ms: 其他敌方标准蓄力后拉
    setActorPoseInternal(eKey, 'windup', 110, false);
    squashActor(eKey, 1.08, 0.93, 105);
    dashActor(eKey, 12, 0, 85, 'inQuad', false);

    // B) 罗文：晦轮月影与暗影触须（支持定向打击前排常驻雷纳德，且 renoRockBlock 优先驱动常驻雷纳德护佑挡灾，绝不生成重影 cameo！）
    if (spriteId === 'rowan') {
      const recentLog = battleState && Array.isArray(battleState.log) ? battleState.log.slice(-4).join(' ') : '';
      const guardAllyKey = info.guardedByAlly || 'ally:reno';
      const didRenoBlock = !!(info.renoRockBlock || info.guardedByAlly || (intent.renoRockBlock && (
        recentLog.includes('雷纳德') ||
        info.blocked ||
        intent.eclipseTrueMagic ||
        (battleState && battleState.player && battleState.player.shield > 0)
      )));
      if (didRenoBlock) {
        if (hasResidentAlly(guardAllyKey)) {
          scheduleAction(45, () => playAllyGuard(battleState, { actorKey: guardAllyKey, targetActorKey, reason: 'rock_block' }));
        } else {
          scheduleAction(55, () => playRenoSupport('earth', { reason: 'rock_block', skipPlayerPose: true }));
        }
      }
      scheduleAction(110, () => {
        setActorPoseInternal(eKey, 'strike', 320, false);
        dashActor(eKey, -16, 0, 100, 'outQuad', false);
        spawnFx('eclipse', { x: targetPts.hit.x, y: targetPts.hit.y, palette: PALETTES.eclipse }, { stopAt: 0.88 });
        scheduleAction(95, () => {
          spawnFx('shadow_tendrils', { x: targetPts.anchor.x, y: targetPts.anchor.y, flip: true, palette: PALETTES.eclipse }, { stopAt: 0.85 });
          applyTargetImpact();
        });
        scheduleAction(310, () => dashActor(eKey, 0, 0, 180, 'outCubic', false));
      });
      return legacyEnemyHandle;
    }

    // C) 爱丽丝 / 风神化身：青岚 2D 跨行疾奔 run -> 贴身疾风双斩 strike -> 奔回 run -> idle
    if (spriteId === 'alice' || spriteId === 'wind_god_avatar') {
      const dashVec = computeMeleeDashVector(ePts, targetPts, 'left', 108, 44);
      scheduleAction(95, () => {
        dashActor(eKey, dashVec.dx, dashVec.dy, 110, 'outQuart', true, 'wind', { pose: 'run' });
      });
      scheduleAction(205, () => {
        setActorPoseInternal(eKey, 'strike', 240, false);
        squashActor(eKey, 1.1, 0.92, 170);
        spawnFx('blizzard_vortex', { x: targetPts.anchor.x, y: targetPts.anchor.y, height: 74, palette: PALETTES.wind }, { stopAt: 0.82 });
        spawnFx('double_slash', { x: clamp(targetPts.anchor.x + 28, 8, Math.max(16, _bufW - 8)), y: targetPts.anchor.y, flip: true, palette: PALETTES.wind, sparks: PALETTES.swordSparks }, { stopAt: 0.72 });
        applyTargetImpact();
      });
      scheduleAction(455, () => {
        dashActor(eKey, 0, 0, 195, 'outCubic', false, 'wind', { pose: 'run', returnIdle: true });
      });
      return legacyEnemyHandle;
    }

    // D) 艾诺：无气泡极寒冰枪 + 地棘
    if (spriteId === 'aino') {
      scheduleAction(110, () => {
        setActorPoseInternal(eKey, 'strike', 300, false);
        dashActor(eKey, -12, 0, 90, 'outQuad', false);
        spawnProjectile('ice_lance', ePts.cast, targetPts.hit, { palette: PALETTES.ice, length: 46 }, 180, () => {
          spawnFx('ice_spikes', { x: clamp(targetPts.anchor.x + 20, 8, Math.max(16, _bufW - 8)), y: targetPts.anchor.y, reach: 62, height: 48, flip: true, palette: PALETTES.ice }, { stopAt: 0.8 });
          applyTargetImpact();
        });
        scheduleAction(290, () => dashActor(eKey, 0, 0, 180, 'outCubic', false));
      });
      return legacyEnemyHandle;
    }

    // E) 诺艾儿：高压水箭 + 浪涛拍岸
    if (spriteId === 'noelle') {
      scheduleAction(110, () => {
        setActorPoseInternal(eKey, 'strike', 310, false);
        dashActor(eKey, -12, 0, 90, 'outQuad', false);
        const dist = clamp(Math.hypot(targetPts.hit.x - ePts.cast.x, targetPts.hit.y - ePts.cast.y), 36, Math.max(60, _bufW - 12));
        const aim = aimOpts(ePts.cast, targetPts.hit);
        spawnFx('water_jet', { x: ePts.cast.x, y: ePts.cast.y, length: dist, flip: aim.flip, angle: aim.angle, palette: PALETTES.water }, { stopAt: 0.36, preserveLength: true });
        scheduleAction(120, () => {
          spawnFx('wave_crash', { x: targetPts.anchor.x, y: targetPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.82 });
          applyTargetImpact();
        });
        scheduleAction(290, () => dashActor(eKey, 0, 0, 180, 'outCubic', false));
      });
      return legacyEnemyHandle;
    }

    // F) 魔兽系：灰棘头狼 / 灰棘狼 / 霜脊影豺 / 冻土重甲兽 / 霜原狂狼 / 寒脊爪兽 / 霜渊裂地兽领主（2D 跨行扑击）
    const isSlam = spriteId === 'abyss_behemoth' || spriteId === 'tundra_brute' || intent.shatterPlayerShield || intent.stance === 'HEAVY_WINDUP';
    const isIceBeast = spriteId === 'abyss_behemoth' || spriteId === 'tundra_brute' || spriteId === 'frost_hound';
    const dashVec = computeMeleeDashVector(ePts, targetPts, 'left', 102, 52);
    scheduleAction(95, () => {
      dashActor(eKey, dashVec.dx, dashVec.dy, 105, 'outQuart', true, isIceBeast ? 'ice' : 'claw', { pose: 'run' });
    });
    scheduleAction(200, () => {
      setActorPoseInternal(eKey, 'strike', 240, false);
      squashActor(eKey, 1.14, 0.88, 170);
      if (isSlam) {
        spawnFx('ground_slam', { x: targetPts.anchor.x, y: targetPts.anchor.y, reach: 88, palette: isIceBeast ? PALETTES.ice : PALETTES.earth }, { stopAt: 0.86 });
      }
      spawnFx('claw_swipe', { x: clamp(targetPts.anchor.x + 28, 8, Math.max(16, _bufW - 8)), y: targetPts.anchor.y, flip: true, palette: PALETTES.claw }, { stopAt: 0.68 });
      applyTargetImpact();
    });
    scheduleAction(455, () => {
      dashActor(eKey, 0, 0, 200, 'outCubic', false, isIceBeast ? 'ice' : 'claw', { pose: 'run', returnIdle: true });
    });
    return legacyEnemyHandle;
  }

  function playEnemySequence(battleState, actions) {
    if (!isEnabled() || !Array.isArray(actions) || !actions.length) return;
    actions.forEach((act, idx) => {
      scheduleAction(idx * 230, () => playEnemyAction(battleState, act));
    });
  }

  /* -------------------- 左翼援护像素精灵出场系统 + 6+6 空槽定位 + 常驻友军（雷纳德三系施法 / 护佑挡灾） -------------------- */
  const ALLY_CAMEO_META = {
    reno: { spriteId: 'reno', label: '雷纳德 · 岩壁协防', tone: 'fire' },
    charlotte: { spriteId: 'charlotte', label: '夏洛特 · 贵族体面', tone: 'ice' },
    jilan: { spriteId: 'jilan', label: '霁岚 · 霁馆借步', tone: 'ice' },
    alice: { spriteId: 'alice', label: '爱丽丝 · 清风托翼', tone: 'wind' },
    noelle: { spriteId: 'noelle', label: '诺艾儿 · 精算校准', tone: 'ice' },
    aino: { spriteId: 'aino', label: '艾诺 · 霜域共鸣', tone: 'ice' },
    beatrice: { spriteId: 'beatrice', label: '贝阿特丽丝 · 烈焰援护', tone: 'fire' },
  };

  function hasResidentAlly(actorKey) {
    if (!actorKey || _cameoEntries.has(actorKey)) return false;
    const st = _actors.get(actorKey);
    if (st && !st.isCameo) return true;
    const b = _lastBattleRef;
    if (b && Array.isArray(b.allies)) {
      for (let i = 0; i < b.allies.length; i++) {
        const al = b.allies[i];
        if (al && `ally:${al.id || i}` === actorKey) return true;
      }
    }
    return false;
  }

  function removeCameo(actorKey) {
    const entry = _cameoEntries.get(actorKey);
    if (entry) {
      entry.timers.forEach(tid => {
        clearTimeout(tid);
        _rawTimers.delete(tid);
      });
      _cameoEntries.delete(actorKey);
      // 仅移除临时 cameo 状态，绝不误删场上常驻友军（如罗文战前排 ally:reno）
      const st = _actors.get(actorKey);
      if (st && st.isCameo) {
        _actors.delete(actorKey);
      }
      const s3d = global.CombatStage3D;
      if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.removeCameo === 'function') {
        s3d.removeCameo(actorKey);
      }
    }
  }

  function clearAllCameos() {
    Array.from(_cameoEntries.keys()).forEach(removeCameo);
  }

  function summonAllyCameo(charId, opts) {
    if (!isEnabled()) return null;
    opts = opts || {};

    const info = ALLY_CAMEO_META[charId] || { spriteId: SPRITE_MANIFEST[charId] ? charId : 'reno', label: charId, tone: 'ice' };
    const spriteId = SPRITE_MANIFEST[info.spriteId] ? info.spriteId : 'reno';
    const actorKey = `ally:${spriteId}`;

    // 若同名角色已是场上常驻友军（如罗文战前排 ally:reno），直接复定位而不生成重影 cameo
    if (hasResidentAlly(actorKey)) {
      if (!_actors.has(actorKey)) syncStage(_lastBattleRef);
      const resSt = _actors.get(actorKey);
      if (resSt && typeof opts.onReady === 'function') {
        const cPts = getActorCanvasPoints(actorKey, false);
        try { opts.onReady(actorKey, cPts, resSt); } catch (e) {}
      }
      return resSt ? { actorKey, st: resSt, resident: true } : null;
    }

    removeCameo(actorKey);
    ensureVfxCanvas(false);

    const st = getOrCreateActor(actorKey, spriteId);
    st.isCameo = true;
    st.dead = false;
    st.flipped = false;
    st.dx = prefersReducedMotion() ? 0 : -68;
    st.dy = 0;
    st.sx = 1;
    st.sy = 1;

    const s3d = global.CombatStage3D;
    if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.summonCameo === 'function') {
      const slotIdx = Number.isFinite(opts.slotIdx) ? opts.slotIdx : undefined;
      s3d.summonCameo(actorKey, spriteId, slotIdx);
    }
    applyActorVisual(st);

    const timers = [];
    _cameoEntries.set(actorKey, { timers });

    const runInMs = prefersReducedMotion() ? 40 : 170;
    const holdTotalMs = Math.max(620, Number(opts.durationMs) || 880);
    const exitDurMs = prefersReducedMotion() ? 80 : 190;

    if (!prefersReducedMotion()) {
      dashActor(actorKey, 0, 0, runInMs, 'outCubic', true, info.tone || 'ice', { pose: 'run' });
    }
    ensureLoopRunning();

    if (typeof opts.onReady === 'function') {
      const tReady = trackRealTimer(() => {
        if (!_cameoEntries.has(actorKey)) return;
        const cPts = getActorCanvasPoints(actorKey, false);
        try { opts.onReady(actorKey, cPts, st); } catch (e) {}
      }, runInMs);
      if (tReady != null) timers.push(tReady);
    }

    const tLeave = trackRealTimer(() => {
      if (!_cameoEntries.has(actorKey)) return;
      if (!prefersReducedMotion()) {
        dashActor(actorKey, -56, 0, exitDurMs, 'inQuad', false, info.tone || 'ice', { pose: 'run' });
      }
    }, holdTotalMs);
    if (tLeave != null) timers.push(tLeave);

    const tRemove = trackRealTimer(() => {
      removeCameo(actorKey);
    }, holdTotalMs + exitDurMs + 40);
    if (tRemove != null) timers.push(tRemove);

    return { actorKey, st };
  }

  /* -------------------- 常驻前排友军（罗文战雷纳德 ally:reno）三系施法与护佑挡灾 -------------------- */
  function playAllyAction(battleState, act) {
    if (!isEnabled()) return false;
    act = act || {};
    ensureVfxCanvas();
    ensureLoopRunning();

    const rawAllyKey = act.actorKey || act.allyKey || (
      act.allyId
        ? (String(act.allyId).startsWith('ally:') ? act.allyId : `ally:${act.allyId}`)
        : 'ally:reno'
    );
    if (!_actors.has(rawAllyKey)) {
      syncStage(battleState || _lastBattleRef);
    }
    const st = _actors.get(rawAllyKey);
    if (!st || st.dead) return false;

    const rawElem = String(act.element || act.elem || 'earth').toLowerCase();
    const elem = (rawElem === 'fire' || rawElem === 'wind' || rawElem === 'water') ? rawElem : 'earth';
    const fallbackEnemyIdx = (battleState && battleState.targetIdx != null)
      ? battleState.targetIdx
      : ((_lastBattleRef && _lastBattleRef.targetIdx != null) ? _lastBattleRef.targetIdx : 0);
    const targetIdx = act.targetIdx != null ? act.targetIdx : (act.enemyIdx != null ? act.enemyIdx : fallbackEnemyIdx);
    const targetKey = `enemy:${targetIdx}`;
    const heavy = !!(act.heavy || act.didCrit || act.didBreak || (act.dmg && act.dmg >= 50));

    const rPts = getActorCanvasPoints(rawAllyKey, false);
    const tPts = getActorCanvasPoints(targetKey, false);
    const rowNudgeY = clamp((tPts.screenY - rPts.screenY) * 0.14, -22, 22);

    if (hasEditionA()) {
      const edApi = getEditionAApi();
      const rLog = toLogicalPts(rPts);
      const tLog = toLogicalPts(tPts);
      const allyVfxId =
        elem === 'earth' ? 'ally_reno_earth'
        : elem === 'fire' ? 'ally_reno_fire'
        : elem === 'wind' ? 'ally_reno_wind'
        : (edApi.resolveSkillId('ally_reno_water') || 'raging_surge');

      if (elem === 'earth') {
        setActorPoseInternal(rawAllyKey, 'earth_windup', 100, false);
        squashActor(rawAllyKey, 0.94, 1.07, 100);
        dashActor(rawAllyKey, -6, 0, 80, 'inQuad', false);
        scheduleAction(95, () => {
          if (!_actors.has(rawAllyKey)) return;
          setActorPoseInternal(rawAllyKey, 'earth_cast', 260, false);
          dashActor(rawAllyKey, 18, rowNudgeY, 95, 'outQuad', false);
        });
        scheduleAction(175, () => {
          if (_actors.has(rawAllyKey)) squashActor(rawAllyKey, 1.10, 0.91, 180);
        });
        scheduleAction(440, () => {
          if (_actors.has(rawAllyKey)) dashActor(rawAllyKey, 0, 0, 185, 'outCubic', false);
        });
      } else if (elem === 'fire') {
        setActorPoseInternal(rawAllyKey, 'fire_windup', 130, false);
        squashActor(rawAllyKey, 0.94, 1.07, 120);
        scheduleAction(120, () => {
          if (!_actors.has(rawAllyKey)) return;
          setActorPoseInternal(rawAllyKey, 'fire_cast', 320, false);
          squashActor(rawAllyKey, 1.09, 0.93, 180);
          dashActor(rawAllyKey, 14, rowNudgeY * 0.5, 90, 'outQuad', false);
        });
        scheduleAction(380, () => {
          if (_actors.has(rawAllyKey)) dashActor(rawAllyKey, 0, 0, 180, 'outCubic', false);
        });
      } else if (elem === 'wind') {
        setActorPoseInternal(rawAllyKey, 'wind_windup', 125, false);
        squashActor(rawAllyKey, 0.94, 1.07, 115);
        scheduleAction(115, () => {
          if (!_actors.has(rawAllyKey)) return;
          setActorPoseInternal(rawAllyKey, 'wind_cast', 320, false);
          squashActor(rawAllyKey, 1.09, 0.93, 175);
          dashActor(rawAllyKey, 14, rowNudgeY * 0.5, 90, 'outQuad', false);
        });
        scheduleAction(370, () => {
          if (_actors.has(rawAllyKey)) dashActor(rawAllyKey, 0, 0, 180, 'outCubic', false);
        });
      } else {
        setActorPoseInternal(rawAllyKey, 'water_windup', 125, false);
        squashActor(rawAllyKey, 0.94, 1.07, 115);
        scheduleAction(115, () => {
          if (_actors.has(rawAllyKey)) setActorPoseInternal(rawAllyKey, 'water_cast', 320, false);
        });
      }

      playEditionA(allyVfxId, {
        from: rLog.cast,
        to: tLog.hit,
        groundY: rLog.anchor.y,
        targetGroundY: tLog.anchor.y,
        facing: 1,
        spriteId: st.spriteId,
        heavy,
        onImpact() {
          if (!act.missed) triggerHitReaction(targetKey, heavy ? 16 : 12, heavy);
        },
        onShake(px) {
          if (!act.missed) triggerTrauma(editionAShakeToTrauma(px));
        },
        onHitStop(ms) {
          if (!act.missed) triggerHitStop(ms);
        },
      });
      return true;
    }

    if (elem === 'earth') {
      // 土系三段施法：earth_windup(3) -> earth_step(4) -> earth_cast(5) + ground_slam + 石棱破土特效
      setActorPoseInternal(rawAllyKey, 'earth_windup', 100, false);
      squashActor(rawAllyKey, 0.94, 1.07, 100);
      dashActor(rawAllyKey, -6, 0, 80, 'inQuad', false);

      scheduleAction(95, () => {
        if (!_actors.has(rawAllyKey)) return;
        // setActorPoseInternal('earth_cast') 内置平滑队列：earth_step(4, 80ms) -> earth_cast(5, 260ms) -> earth_step(4, 75ms) -> idle
        setActorPoseInternal(rawAllyKey, 'earth_cast', 260, false);
        dashActor(rawAllyKey, 18, rowNudgeY, 95, 'outQuad', false);
      });

      scheduleAction(175, () => {
        if (!_actors.has(rawAllyKey)) return;
        squashActor(rawAllyKey, 1.10, 0.91, 180);
        const curTPts = getActorCanvasPoints(targetKey, false);
        spawnFx('ground_slam', {
          x: curTPts.anchor.x,
          y: curTPts.anchor.y,
          reach: 78,
          palette: PALETTES.earth,
        }, { stopAt: 0.84 });
        spawnFx('ice_spikes', {
          x: clamp(curTPts.anchor.x - 16, 8, Math.max(16, _bufW - 12)),
          y: curTPts.anchor.y,
          reach: 64,
          height: 52,
          palette: PALETTES.earth,
        }, { stopAt: 0.84 });
        if (!act.missed) {
          spawnFx('hit_spark', { x: curTPts.anchor.x, y: curTPts.anchor.y, palette: PALETTES.earth }, { stopAt: 0.45 });
          triggerHitReaction(targetKey, heavy ? 16 : 12, heavy);
          triggerTrauma(heavy ? 0.50 : 0.36);
        }
      });

      scheduleAction(440, () => {
        if (_actors.has(rawAllyKey)) dashActor(rawAllyKey, 0, 0, 185, 'outCubic', false);
      });
      return true;
    }

    if (elem === 'fire') {
      // 火系施法：fire_windup(7) -> fire_cast(8) + fireball 弹道 + flame_pillar 爆燃
      setActorPoseInternal(rawAllyKey, 'fire_windup', 130, false);
      squashActor(rawAllyKey, 0.94, 1.07, 120);
      spawnFx('magic_circle_cast', { x: rPts.anchor.x, y: rPts.anchor.y, palette: PALETTES.fire }, { stopAt: 0.52 });

      scheduleAction(120, () => {
        if (!_actors.has(rawAllyKey)) return;
        setActorPoseInternal(rawAllyKey, 'fire_cast', 320, false);
        squashActor(rawAllyKey, 1.09, 0.93, 180);
        dashActor(rawAllyKey, 14, rowNudgeY * 0.5, 90, 'outQuad', false);
        const curRPts = getActorCanvasPoints(rawAllyKey, true);
        const curTPts = getActorCanvasPoints(targetKey, false);
        spawnProjectile('fireball', curRPts.cast, curTPts.hit, { palette: PALETTES.fire, radius: 6 }, 175, () => {
          spawnFx('flame_pillar', {
            x: curTPts.anchor.x,
            y: curTPts.anchor.y,
            height: 112,
            reach: 74,
            palette: PALETTES.fire,
          }, { stopAt: 0.84 });
          if (!act.missed) {
            spawnFx('hit_spark', { x: curTPts.anchor.x, y: curTPts.anchor.y, palette: PALETTES.fire }, { stopAt: 0.45 });
            triggerHitReaction(targetKey, heavy ? 16 : 12, heavy);
            triggerTrauma(heavy ? 0.54 : 0.38);
          }
        });
      });

      scheduleAction(380, () => {
        if (_actors.has(rawAllyKey)) dashActor(rawAllyKey, 0, 0, 180, 'outCubic', false);
      });
      return true;
    }

    if (elem === 'wind') {
      // 风系施法：wind_windup(9) -> wind_cast(10) + 风刃弹道 + 疾风斩弧命中敌方
      setActorPoseInternal(rawAllyKey, 'wind_windup', 125, false);
      squashActor(rawAllyKey, 0.94, 1.07, 115);
      spawnFx('magic_circle_cast', { x: rPts.anchor.x, y: rPts.anchor.y, palette: PALETTES.wind }, { stopAt: 0.50 });

      scheduleAction(115, () => {
        if (!_actors.has(rawAllyKey)) return;
        setActorPoseInternal(rawAllyKey, 'wind_cast', 320, false);
        squashActor(rawAllyKey, 1.09, 0.93, 175);
        dashActor(rawAllyKey, 14, rowNudgeY * 0.5, 90, 'outQuad', false);
        const curRPts = getActorCanvasPoints(rawAllyKey, true);
        const curTPts = getActorCanvasPoints(targetKey, false);
        spawnProjectile('ice_lance', curRPts.cast, curTPts.hit, { palette: PALETTES.wind, length: 44 }, 145, () => {
          spawnFx('double_slash', {
            x: clamp(curTPts.anchor.x - 24, 8, Math.max(16, _bufW - 8)),
            y: curTPts.anchor.y,
            palette: PALETTES.wind,
            sparks: PALETTES.swordSparks,
          }, { stopAt: 0.72 });
          spawnFx('blizzard_vortex', {
            x: curTPts.anchor.x,
            y: curTPts.anchor.y,
            height: 68,
            palette: PALETTES.wind,
          }, { stopAt: 0.76 });
          if (!act.missed) {
            spawnFx('hit_spark', { x: curTPts.anchor.x, y: curTPts.anchor.y, palette: PALETTES.wind }, { stopAt: 0.45 });
            triggerHitReaction(targetKey, heavy ? 15 : 11, heavy);
            triggerTrauma(heavy ? 0.48 : 0.34);
          }
        });
      });

      scheduleAction(370, () => {
        if (_actors.has(rawAllyKey)) dashActor(rawAllyKey, 0, 0, 180, 'outCubic', false);
      });
      return true;
    }

    // 兼容水系施法
    setActorPoseInternal(rawAllyKey, 'water_windup', 125, false);
    squashActor(rawAllyKey, 0.94, 1.07, 115);
    spawnFx('magic_circle_cast', { x: rPts.anchor.x, y: rPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.50 });
    scheduleAction(115, () => {
      if (!_actors.has(rawAllyKey)) return;
      setActorPoseInternal(rawAllyKey, 'water_cast', 320, false);
      const curRPts = getActorCanvasPoints(rawAllyKey, true);
      const curTPts = getActorCanvasPoints(targetKey, false);
      const dist = clamp(Math.hypot(curTPts.hit.x - curRPts.cast.x, curTPts.hit.y - curRPts.cast.y), 36, Math.max(60, _bufW - 12));
      const aim = aimOpts(curRPts.cast, curTPts.hit);
      spawnFx('water_jet', { x: curRPts.cast.x, y: curRPts.cast.y, length: dist, flip: aim.flip, angle: aim.angle, palette: PALETTES.water }, { stopAt: 0.36, preserveLength: true });
      scheduleAction(120, () => {
        spawnFx('wave_crash', { x: curTPts.anchor.x, y: curTPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.80 });
        if (!act.missed) {
          spawnFx('hit_spark', { x: curTPts.anchor.x, y: curTPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.45 });
          triggerHitReaction(targetKey, heavy ? 14 : 11, heavy);
          triggerTrauma(0.36);
        }
      });
    });
    return true;
  }

  function playAllyGuard(battleState, act) {
    if (!isEnabled()) return false;
    act = act || {};
    ensureVfxCanvas();
    ensureLoopRunning();

    const actorKey = act.actorKey || act.allyKey || (
      act.allyId
        ? (String(act.allyId).startsWith('ally:') ? act.allyId : `ally:${act.allyId}`)
        : 'ally:reno'
    );
    if (!_actors.has(actorKey)) {
      syncStage(battleState || _lastBattleRef);
    }
    const st = _actors.get(actorKey);
    if (!st || st.dead) return false;

    const now = nowPerf();
    if (st._lastGuardTs && (now - st._lastGuardTs) < 250) {
      return true;
    }
    st._lastGuardTs = now;

    const protectedKey = act.targetActorKey || 'player';
    const rPts = getActorCanvasPoints(actorKey, false);
    const pPts = getActorCanvasPoints(protectedKey, false);
    const stepY = clamp((pPts.screenY - rPts.screenY) * 0.22, -24, 24);

    // 常驻雷纳德向前小踏半步（earth_step）并立起碎石板护盾，为后排主角护佑挡灾
    setActorPoseInternal(actorKey, 'earth_step', 360, false);
    squashActor(actorKey, 1.09, 0.92, 180);
    dashActor(actorKey, 22, stepY, 110, 'outQuad', false);

    if (hasEditionA()) {
      const rLog = toLogicalPts(rPts);
      playEditionA('ally_reno_guard', {
        pos: { x: rLog.hit.x, y: rLog.hit.y, groundY: rLog.anchor.y },
        from: rLog.hit,
        groundY: rLog.anchor.y,
        facing: 1,
        onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
      });
      scheduleAction(340, () => {
        if (_actors.has(actorKey)) dashActor(actorKey, 0, 0, 190, 'outCubic', false);
      });
      return true;
    }

    const slabX = clamp(rPts.anchor.x + 18, 12, Math.max(20, _bufW - 12));
    spawnFx('ground_slam', {
      x: slabX,
      y: rPts.anchor.y,
      reach: 58,
      palette: PALETTES.earth,
    }, { stopAt: 0.78 });
    spawnFx('divine_shield', {
      x: rPts.anchor.x + 6,
      y: rPts.anchor.y,
      radius: 34,
      palette: PALETTES.earth,
    }, { stopAt: 0.92 });
    triggerTrauma(0.28);

    scheduleAction(340, () => {
      if (_actors.has(actorKey)) dashActor(actorKey, 0, 0, 190, 'outCubic', false);
    });
    return true;
  }

  /* -------------------- 雷纳德三系元素援护（土/火/风三系完整施法 + 兼容水系，自动适配 11 帧 animMap） -------------------- */
  function playRenoSupport(elem, opts) {
    if (!isEnabled()) return null;
    opts = opts || {};
    ensureVfxCanvas();
    const mode = String(elem || 'earth').toLowerCase();
    const normElem = (mode === 'fire' || mode === 'wind' || mode === 'water') ? mode : 'earth';

    // 若场上已有常驻前排雷纳德，直接驱动常驻骨骼，绝不另建重影 cameo
    if (hasResidentAlly('ally:reno')) {
      if (opts.reason === 'rock_block' || opts.reason === 'bond') {
        playAllyGuard(_lastBattleRef, { actorKey: 'ally:reno', reason: opts.reason });
      } else {
        playAllyAction(_lastBattleRef, {
          actorKey: 'ally:reno',
          element: normElem,
          targetIdx: opts.enemyIdx,
        });
      }
      return { actorKey: 'ally:reno', resident: true };
    }

    const tagMap = {
      earth: '雷纳德 · 岩壁协防',
      fire: '雷纳德 · 赤焰支援',
      wind: '雷纳德 · 疾风驰援',
      water: '雷纳德 · 净潮驰援',
    };
    const windupPose = `${normElem}_windup`;
    const castPose = `${normElem}_cast`;
    const fallbackEnemyIdx = (_lastBattleRef && _lastBattleRef.targetIdx != null) ? _lastBattleRef.targetIdx : 0;
    const primaryEnemyKey = `enemy:${opts.enemyIdx != null ? opts.enemyIdx : fallbackEnemyIdx}`;

    return summonAllyCameo('reno', {
      tagText: opts.tagText || tagMap[normElem],
      durationMs: opts.durationMs || 860,
      onReady(actorKey, rPts) {
        const pPts = getActorCanvasPoints('player', false);
        const tPts = getActorCanvasPoints(primaryEnemyKey, false);

        if (hasEditionA()) {
          const edApi = getEditionAApi();
          const pLog = toLogicalPts(pPts);
          const rLog = toLogicalPts(rPts);
          const tLog = toLogicalPts(tPts);
          const isGuardMode = normElem === 'earth' && (opts.reason === 'rock_block' || opts.reason === 'bond' || opts.enemyIdx == null);

          if (normElem === 'earth') {
            setActorPoseInternal(actorKey, 'earth_windup', 100, false);
            squashActor(actorKey, 0.94, 1.07, 100);
            scheduleAction(90, () => {
              if (_actors.has(actorKey)) setActorPoseInternal(actorKey, 'earth_step', 95, false);
            });
            scheduleAction(175, () => {
              if (!_actors.has(actorKey)) return;
              setActorPoseInternal(actorKey, 'earth_cast', 340, false);
              squashActor(actorKey, 1.08, 0.93, 180);
            });
          } else {
            setActorPoseInternal(actorKey, windupPose, 125, false);
            squashActor(actorKey, 0.94, 1.07, 120);
            scheduleAction(115, () => {
              if (!_actors.has(actorKey)) return;
              setActorPoseInternal(actorKey, castPose, 340, false);
              squashActor(actorKey, 1.08, 0.93, 180);
            });
          }

          if (isGuardMode) {
            playEditionA('ally_reno_guard', {
              pos: { x: pLog.hit.x, y: pLog.hit.y, groundY: pLog.anchor.y },
              from: pLog.hit,
              groundY: pLog.anchor.y,
              facing: 1,
              onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
            });
          } else {
            const vfxId =
              normElem === 'fire' ? 'ally_reno_fire'
              : normElem === 'wind' ? 'ally_reno_wind'
              : normElem === 'earth' ? 'ally_reno_earth'
              : (edApi.resolveSkillId('ally_reno_water') || 'raging_surge');
            playEditionA(vfxId, {
              from: rLog.cast,
              to: tLog.hit,
              groundY: rLog.anchor.y,
              targetGroundY: tLog.anchor.y,
              facing: 1,
              spriteId: 'reno',
              onImpact() { triggerHitReaction(primaryEnemyKey, 13, normElem === 'fire'); },
              onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
              onHitStop(ms) { triggerHitStop(ms); },
            });
          }
          return;
        }

        if (normElem === 'earth') {
          // 土系三段帧：[3: earth_windup, 4: earth_step, 5: earth_cast]
          setActorPoseInternal(actorKey, 'earth_windup', 100, false);
          squashActor(actorKey, 0.94, 1.07, 100);
          scheduleAction(90, () => {
            if (!_actors.has(actorKey)) return;
            setActorPoseInternal(actorKey, 'earth_step', 95, false);
          });
          scheduleAction(175, () => {
            if (!_actors.has(actorKey)) return;
            setActorPoseInternal(actorKey, 'earth_cast', 340, false);
            squashActor(actorKey, 1.08, 0.93, 180);
            // 土系掀石板护壁：在希尔维亚与罗文之间立起碎石屏障
            const wallX = clamp(pPts.anchor.x + 18, 12, Math.max(20, _bufW - 12));
            spawnFx('ground_slam', { x: wallX, y: pPts.anchor.y, reach: 64, palette: PALETTES.earth }, { stopAt: 0.84 });
            spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 34, palette: PALETTES.earth }, { stopAt: 0.96 });
            triggerTrauma(0.32);
          });
          return;
        }

        setActorPoseInternal(actorKey, windupPose, 125, false);
        squashActor(actorKey, 0.94, 1.07, 120);

        scheduleAction(115, () => {
          if (!_actors.has(actorKey)) return;
          setActorPoseInternal(actorKey, castPose, 340, false);
          squashActor(actorKey, 1.08, 0.93, 180);

          if (normElem === 'fire') {
            spawnFx('magic_circle_cast', { x: rPts.anchor.x, y: rPts.anchor.y, palette: PALETTES.fire }, { stopAt: 0.55 });
            spawnProjectile('fireball', rPts.cast, tPts.hit, { palette: PALETTES.fire, radius: 6 }, 170, () => {
              spawnFx('fire_ring', { x: tPts.anchor.x, y: tPts.anchor.y, reach: 78, palette: PALETTES.fire }, { stopAt: 0.82 });
              triggerHitReaction(primaryEnemyKey, 14, true);
              triggerTrauma(0.5);
            });
          } else if (normElem === 'wind') {
            spawnFx('magic_circle_cast', { x: rPts.anchor.x, y: rPts.anchor.y, palette: PALETTES.wind }, { stopAt: 0.55 });
            spawnFx('blizzard_vortex', { x: tPts.anchor.x, y: tPts.anchor.y, height: 74, palette: PALETTES.wind }, { stopAt: 0.84 });
            scheduleAction(105, () => {
              spawnFx('double_slash', {
                x: clamp(tPts.anchor.x - 24, 8, Math.max(16, _bufW - 8)),
                y: tPts.anchor.y,
                palette: PALETTES.wind,
                sparks: PALETTES.swordSparks,
              }, { stopAt: 0.72 });
              triggerHitReaction(primaryEnemyKey, 13, false);
              triggerTrauma(0.42);
            });
          } else {
            spawnFx('magic_circle_cast', { x: rPts.anchor.x, y: rPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.55 });
            const dist = clamp(Math.hypot(tPts.hit.x - rPts.cast.x, tPts.hit.y - rPts.cast.y), 36, Math.max(60, _bufW - 12));
            const aim = aimOpts(rPts.cast, tPts.hit);
            spawnFx('water_jet', { x: rPts.cast.x, y: rPts.cast.y, length: dist, flip: aim.flip, angle: aim.angle, palette: PALETTES.water }, { stopAt: 0.36, preserveLength: true });
            scheduleAction(120, () => {
              spawnFx('wave_crash', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.82 });
              spawnFx('splash', { x: tPts.anchor.x, y: tPts.anchor.y, stone: false, palette: PALETTES.water }, { stopAt: 0.7 });
              triggerHitReaction(primaryEnemyKey, 12, false);
            });
          }
        });
      },
    });
  }

  /* -------------------- 波次切换疾奔入场演出（严格使用 run 帧，绝不串播施法/挥砍帧） -------------------- */
  function playWaveTransition(battleState, opts) {
    if (!isEnabled()) return false;
    opts = opts || {};
    _playerActionGen += 1;
    ensureVfxCanvas(false);
    ensureLoopRunning();

    if (prefersReducedMotion()) return true;

    const runDurMs = clamp(Number(opts.durationMs) || 320, 180, 520);
    const pSt = _actors.get('player');
    if (pSt && !pSt.dead) {
      pSt.dx = -96;
      pSt.dy = 0;
      applyActorVisual(pSt);
      dashActor('player', 0, 0, runDurMs, 'outCubic', true, 'ice', { pose: 'run', returnIdle: true });
    }

    let allyOrder = 0;
    let enemyOrder = 0;
    _actors.forEach((st, key) => {
      if (st.dead) return;
      if (key.startsWith('ally:') && !_cameoEntries.has(key)) {
        const offset = -(86 + allyOrder * 14);
        const dur = runDurMs + allyOrder * 26;
        allyOrder += 1;
        st.dx = offset;
        st.dy = 0;
        applyActorVisual(st);
        dashActor(key, 0, 0, dur, 'outCubic', false, 'fire', { pose: 'run', returnIdle: true });
        return;
      }
      if (!key.startsWith('enemy:')) return;
      const offset = 84 + enemyOrder * 14;
      const dur = runDurMs + enemyOrder * 32;
      enemyOrder += 1;
      st.dx = offset;
      st.dy = 0;
      applyActorVisual(st);
      dashActor(key, 0, 0, dur, 'outCubic', false, 'claw', { pose: 'run', returnIdle: true });
    });

    if (hasEditionA()) {
      playEditionA('fx_wave_transition', { facing: 1 });
    }
    return true;
  }

  /* -------------------- 特殊演出：晦轮杖 / 冰晶宫殿时停 / 艾诺崖顶冰枪 / 心念援护 -------------------- */
  function playWandToggle() {
    if (!isEnabled()) return;
    ensureVfxCanvas(true);
    const myGen = ++_playerActionGen;
    const playerSt = _actors.get('player');
    const pSpriteId = (playerSt && playerSt.spriteId) || resolvePlayerSpriteId(_lastBattleRef, false);
    const useDualMagic = hasMagicCastFrames(pSpriteId);
    setActorPoseInternal('player', useDualMagic ? 'magic_windup' : 'windup', 140, false);

    if (hasEditionA()) {
      const pPts = getActorCanvasPoints('player', true, true);
      const pLog = toLogicalPts(pPts);
      playEditionA('eclipse_wand_toggle', {
        from: pLog.cast,
        groundY: pLog.anchor.y,
        facing: 1,
        onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
      });
      scheduleAction(120, () => {
        if (myGen === _playerActionGen) {
          setActorPoseInternal('player', useDualMagic ? 'magic_cast' : 'strike', 300, false);
        }
      });
      return;
    }

    scheduleAction(120, () => {
      if (myGen === _playerActionGen) {
        setActorPoseInternal('player', useDualMagic ? 'magic_cast' : 'strike', 300, false);
      }
      const pPts = getActorCanvasPoints('player', true, true);
      if (!pPts) return;
      spawnFx('eclipse', { x: pPts.hit.x, y: pPts.hit.y, palette: PALETTES.eclipse }, { stopAt: 0.85, scale: 0.46 });
      spawnFx('time_stop', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.eclipse }, { stopAt: 0.68 });
      triggerTrauma(0.28);
    });
  }

  function playPalaceTimeStop() {
    if (!isEnabled()) return;
    ensureVfxCanvas();
    ensureLoopRunning();
    if (hasEditionA()) {
      const pLog = toLogicalPts(getActorCanvasPoints('player', false));
      const alive = getLivingEnemyIndices(_lastBattleRef, 0);
      const targetLogs = alive.map(eIdx => {
        const eLog = toLogicalPts(getActorCanvasPoints(`enemy:${eIdx}`, false));
        return { x: eLog.hit.x, y: eLog.hit.y, groundY: eLog.anchor.y };
      });
      playEditionA('palace_time_stop', {
        from: pLog.cast,
        groundY: pLog.anchor.y,
        targets: targetLogs,
        facing: 1,
        onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
        onHitStop(ms) { triggerHitStop(ms); },
      });
      return;
    }
    spawnFx('time_stop', { x: _bufW * 0.5, y: _bufH * 0.76, palette: PALETTES.ice }, { stopAt: 1.12 });
    spawnFx('snowflake_burst', { x: _bufW * 0.5, y: _bufH * 0.52, count: 11, palette: PALETTES.ice }, { stopAt: 1.05, scale: 0.64 });
  }

  function playAinoSpearSupport(enemyIdx) {
    if (!isEnabled()) return;
    ensureVfxCanvas();
    const eKey = `enemy:${enemyIdx != null ? enemyIdx : 0}`;
    const tPts = getActorCanvasPoints(eKey, false);
    if (hasEditionA()) {
      const tLog = toLogicalPts(tPts);
      playEditionA('support_aino_spear', {
        from: { x: clamp(tLog.hit.x - 160, 24, 580), y: 40 },
        to: tLog.hit,
        targetGroundY: tLog.anchor.y,
        facing: 1,
        onImpact() { triggerHitReaction(eKey, 18, true); },
        onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
        onHitStop(ms) { triggerHitStop(ms); },
      });
      return;
    }
    const skyOrigin = { x: Math.max(24, tPts.hit.x - 110), y: 12 };
    spawnProjectile('ice_lance', skyOrigin, tPts.hit, { palette: PALETTES.ice, length: 52 }, 165, () => {
      spawnFx('icicle_fall', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.88 });
      spawnFx('ice_shatter', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.82 });
      spawnFx('crit_hit', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.72 });
      triggerHitReaction(eKey, 18, true);
      triggerHitStop(85);
      triggerTrauma(0.72);
    });
  }

  function playBondAssist(charId) {
    if (!isEnabled()) return;
    ensureVfxCanvas();
    const cid = String(charId || '').toLowerCase();

    if (cid === 'reno') {
      playRenoSupport('earth', { reason: 'bond' });
      return;
    }

    _playerActionGen += 1;

    const pPts = getActorCanvasPoints('player', false);
    const playerSt = _actors.get('player');
    const pSpriteId = (playerSt && playerSt.spriteId) || resolvePlayerSpriteId(_lastBattleRef, false);
    const playerDualMagic = hasMagicCastFrames(pSpriteId);
    setActorPoseInternal('player', playerDualMagic ? 'magic_windup' : 'windup', 260, false);

    if (ALLY_CAMEO_META[cid] || SPRITE_MANIFEST[cid]) {
      const targetIdx = (_lastBattleRef && _lastBattleRef.targetIdx != null) ? _lastBattleRef.targetIdx : 0;
      const targetKey = `enemy:${targetIdx}`;
      summonAllyCameo(cid, {
        durationMs: 880,
        onReady(actorKey, cPts) {
          const tPts = getActorCanvasPoints(targetKey, false);
          const allyDualMagic = hasMagicCastFrames(cid);
          const windup = (cid === 'jilan') ? 'windup' : (allyDualMagic ? 'magic_windup' : 'windup');
          const cast = (cid === 'jilan') ? 'strike' : (allyDualMagic ? 'magic_cast' : 'strike');

          setActorPoseInternal(actorKey, windup, 115, false);
          squashActor(actorKey, 0.95, 1.06, 110);

          if (hasEditionA()) {
            const edApi = getEditionAApi();
            const bondId = edApi.resolveSkillId(`bond_${cid}`) || 'bond_charlotte_noble';
            const pLog = toLogicalPts(pPts);
            const cLog = toLogicalPts(cPts);
            const tLog = toLogicalPts(tPts);

            scheduleAction(105, () => {
              if (!_actors.has(actorKey)) return;
              setActorPoseInternal(actorKey, cast, 340, false);
              squashActor(actorKey, 1.08, 0.94, 170);
              if (cid === 'jilan') {
                dashActor(actorKey, 28, 0, 100, 'outQuad', true, 'ice');
              }
            });

            if (cid === 'aino') {
              const alive = getLivingEnemyIndices(_lastBattleRef, targetIdx);
              const targetsLog = alive.map(eIdx => {
                const eLog = toLogicalPts(getActorCanvasPoints(`enemy:${eIdx}`, false));
                return { x: eLog.hit.x, y: eLog.hit.y, groundY: eLog.anchor.y, enemyIdx: eIdx };
              });
              const firstT = targetsLog[0] || { x: tLog.hit.x, y: tLog.hit.y, groundY: tLog.anchor.y, enemyIdx: targetIdx };
              playEditionA(bondId, {
                from: cLog.cast,
                groundY: cLog.anchor.y,
                to: { x: firstT.x, y: firstT.y },
                targetGroundY: firstT.groundY,
                targets: targetsLog,
                facing: 1,
                spriteId: 'aino',
                onImpact(hitOrder) {
                  const slot = targetsLog[hitOrder] || firstT;
                  triggerHitReaction(`enemy:${slot.enemyIdx}`, 13, false);
                },
                onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
                onHitStop(ms) { triggerHitStop(ms); },
              });
            } else if (cid === 'jilan' || cid === 'beatrice') {
              playEditionA(bondId, {
                from: cLog.cast,
                groundY: cLog.anchor.y,
                to: tLog.hit,
                targetGroundY: tLog.anchor.y,
                facing: 1,
                spriteId: cid,
                onImpact() { triggerHitReaction(targetKey, 14, true); },
                onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
                onHitStop(ms) { triggerHitStop(ms); },
              });
            } else {
              playEditionA(bondId, {
                pos: { x: pLog.hit.x, y: pLog.hit.y, groundY: pLog.anchor.y },
                from: pLog.hit,
                groundY: pLog.anchor.y,
                to: tLog.hit,
                targetGroundY: tLog.anchor.y,
                facing: 1,
                spriteId: cid,
                onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
              });
            }
            return;
          }

          scheduleAction(105, () => {
            if (!_actors.has(actorKey)) return;
            setActorPoseInternal(actorKey, cast, 340, false);
            squashActor(actorKey, 1.08, 0.94, 170);

            if (cid === 'alice') {
              spawnFx('blizzard_vortex', { x: pPts.anchor.x, y: pPts.anchor.y, height: 68, palette: PALETTES.wind }, { stopAt: 0.9 });
            } else if (cid === 'charlotte') {
              spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 34, palette: PALETTES.ice }, { stopAt: 1.05 });
              spawnFx('snowflake_burst', { x: pPts.hit.x, y: pPts.hit.y, count: 8, palette: PALETTES.ice }, { stopAt: 0.82, scale: 0.52 });
            } else if (cid === 'jilan') {
              dashActor(actorKey, 28, 0, 100, 'outQuad', true, 'ice');
              spawnFx('double_slash', { x: clamp(cPts.anchor.x + 20, 12, Math.max(20, _bufW - 12)), y: cPts.anchor.y, palette: PALETTES.swordIce, sparks: PALETTES.swordSparks }, { stopAt: 0.78 });
              spawnFx('parry', { x: pPts.anchor.x + 12, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.68 });
            } else if (cid === 'noelle') {
              spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.8 });
              spawnFx('splash', { x: pPts.anchor.x, y: pPts.anchor.y, stone: false, palette: PALETTES.water }, { stopAt: 0.78 });
            } else if (cid === 'aino') {
              spawnProjectile('ice_lance', cPts.cast, tPts.hit, { palette: PALETTES.ice, length: 46 }, 165, () => {
                spawnFx('frost_nova', { x: tPts.anchor.x, y: tPts.anchor.y, reach: 82, palette: PALETTES.ice }, { stopAt: 0.85 });
                spawnFx('snowflake_burst', { x: tPts.hit.x, y: tPts.hit.y, count: 8, palette: PALETTES.ice }, { stopAt: 0.82, scale: 0.54 });
              });
            } else if (cid === 'beatrice') {
              spawnFx('fire_ring', { x: tPts.anchor.x, y: tPts.anchor.y, reach: 78, palette: PALETTES.fire }, { stopAt: 0.85 });
            } else {
              spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.8 });
              spawnFx('snowflake_burst', { x: pPts.hit.x, y: pPts.hit.y, count: 8, palette: PALETTES.ice }, { stopAt: 0.85, scale: 0.52 });
            }
          });
        },
      });
      return;
    }

    setActorPoseInternal('player', playerDualMagic ? 'magic_cast' : 'strike', 300, false);
    if (hasEditionA()) {
      const edApi = getEditionAApi();
      const pLog = toLogicalPts(pPts);
      const bondId = edApi.resolveSkillId(`bond_${cid}`) || 'bond_charlotte_noble';
      playEditionA(bondId, {
        pos: { x: pLog.hit.x, y: pLog.hit.y, groundY: pLog.anchor.y },
        from: pLog.hit,
        groundY: pLog.anchor.y,
        facing: 1,
      });
      return;
    }
    spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.8 });
    spawnFx('snowflake_burst', { x: pPts.hit.x, y: pPts.hit.y, count: 8, palette: PALETTES.ice }, { stopAt: 0.85, scale: 0.52 });
  }

  /* -------------------- 方案 A 新增对外接口：法杖切换 / 格挡分级 / 系统反馈 -------------------- */
  function playStaffSwitch(staffId) {
    if (!isEnabled()) return false;
    ensureVfxCanvas(true);
    ensureLoopRunning();

    const sid = String(staffId || '').toLowerCase().trim();
    const myGen = ++_playerActionGen;
    const playerSt = _actors.get('player');
    const pSpriteId = (playerSt && playerSt.spriteId) || resolvePlayerSpriteId(_lastBattleRef, false);
    const useDualMagic = hasMagicCastFrames(pSpriteId);
    setActorPoseInternal('player', useDualMagic ? 'magic_windup' : 'windup', 140, false);
    scheduleAction(120, () => {
      if (myGen === _playerActionGen) {
        setActorPoseInternal('player', useDualMagic ? 'magic_cast' : 'strike', 300, false);
      }
    });

    if (hasEditionA()) {
      const edApi = getEditionAApi();
      const targetVfx =
        (sid === 'north_saint_staff' || sid.includes('saint') || sid.includes('north')) ? 'saint_staff_resonance'
        : (sid === 'eclipse_wand' || sid.includes('eclipse') || sid.includes('wand')) ? 'eclipse_wand_toggle'
        : (edApi.resolveSkillId(sid) || 'saint_staff_resonance');
      const pPts = getActorCanvasPoints('player', true, true);
      const pLog = toLogicalPts(pPts);
      playEditionA(targetVfx, {
        from: pLog.cast,
        groundY: pLog.anchor.y,
        facing: 1,
        onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
      });
      return true;
    }

    if (sid.includes('eclipse') || sid.includes('wand')) {
      playWandToggle();
    } else {
      const pPts = getActorCanvasPoints('player', true, true);
      if (pPts) {
        spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.crit }, { stopAt: 0.72 });
        spawnFx('snowflake_burst', { x: pPts.hit.x, y: pPts.hit.y, count: 8, palette: PALETTES.crit }, { stopAt: 0.76, scale: 0.52 });
      }
    }
    return true;
  }

  function playBlock(grade, actorKey) {
    if (!isEnabled()) return false;
    ensureVfxCanvas(false);
    ensureLoopRunning();

    const rawGrade = String(grade || 'good').toLowerCase().trim();
    const normGrade = (rawGrade === 'bad' || rawGrade === 'good' || rawGrade === 'great' || rawGrade === 'perfect')
      ? rawGrade
      : 'good';
    const key = actorKey ? String(actorKey) : 'player';
    if (_lastGateBlockFx && _lastGateBlockFx.actorKey === key && (nowPerf() - _lastGateBlockFx.ts) < 120) {
      return true;
    }
    const isEnemy = key.startsWith('enemy:');
    const facing = isEnemy ? -1 : 1;
    const aPts = getActorCanvasPoints(key, true);

    if (hasEditionA()) {
      const aLog = toLogicalPts(aPts);
      const posObj = { x: aLog.hit.x, y: aLog.hit.y, groundY: aLog.anchor.y };
      playEditionA(`fx_block_${normGrade}`, {
        pos: posObj,
        from: aLog.hit,
        groundY: aLog.anchor.y,
        side: isEnemy ? 'enemy' : 'player',
        facing,
        onShake(px) { triggerTrauma(editionAShakeToTrauma(px)); },
        onHitStop(ms) { triggerHitStop(ms); },
      });
      return true;
    }

    spawnFx('parry', {
      x: aPts.anchor.x + (isEnemy ? -12 : 12),
      y: aPts.anchor.y,
      palette: PALETTES.ice,
    }, { stopAt: 0.62 });
    return true;
  }

  function playSystemFx(fxId, opts) {
    if (!isEnabled() || !fxId) return false;
    opts = opts || {};
    ensureVfxCanvas(false);
    ensureLoopRunning();
    if (!hasEditionA()) return false;

    const edApi = getEditionAApi();
    const resolvedId = edApi.resolveSkillId(fxId) || String(fxId);

    const resolveAnchorKey = () => {
      if (opts.actorKey) return String(opts.actorKey);
      if (opts.side === 'enemy' || (opts.side == null && opts.enemyIdx != null && resolvedId !== 'fx_mana_cycle_flow')) {
        return `enemy:${opts.enemyIdx != null ? opts.enemyIdx : 0}`;
      }
      if (opts.side === 'ally') {
        return opts.allyKey ? String(opts.allyKey) : 'ally:reno';
      }
      return 'player';
    };

    const actorKey = resolveAnchorKey();
    const inferredVariant = String(
      opts.variant || opts.mode || (String(fxId).toLowerCase().startsWith('status_') ? String(fxId).slice(7) : 'buff')
    ).toLowerCase();

    // 对 fx_status_micro 按 (actorKey, variant) 做 250ms 节流防堆叠
    if (resolvedId === 'fx_status_micro') {
      const throttleKey = `${actorKey}|${inferredVariant}`;
      const nowTs = nowPerf();
      const lastTs = _statusMicroThrottle.get(throttleKey) || 0;
      if (nowTs - lastTs < 250) {
        return false;
      }
      _statusMicroThrottle.set(throttleKey, nowTs);
    }

    const executePlay = () => {
      if (!hasEditionA()) return;
      const playOpts = {
        amp: opts.amp != null ? opts.amp : (opts.ampTier != null ? opts.ampTier : 0),
        oneMore: !!opts.oneMore,
        shattered: !!opts.shattered,
      };
      if (opts.theme != null) playOpts.theme = opts.theme;
      if (opts.variant != null) {
        playOpts.variant = opts.variant;
      } else if (resolvedId === 'fx_status_micro') {
        playOpts.variant = inferredVariant;
      }
      if (opts.mode != null) playOpts.mode = opts.mode;
      if (!opts.skipShake) {
        playOpts.onShake = px => triggerTrauma(editionAShakeToTrauma(px));
      }
      if (!opts.skipHitStop) {
        playOpts.onHitStop = ms => triggerHitStop(ms);
      }

      if (resolvedId === 'fx_mana_cycle_flow') {
        // 保持 from = player, to = enemy（Pack 2 内部自反流向敌→我）
        const fromKey = opts.fromKey ? String(opts.fromKey) : 'player';
        const fallbackEIdx = (_lastBattleRef && _lastBattleRef.targetIdx != null) ? _lastBattleRef.targetIdx : 0;
        const toKey = opts.toKey ? String(opts.toKey) : `enemy:${opts.enemyIdx != null ? opts.enemyIdx : fallbackEIdx}`;
        const fromLog = toLogicalPts(getActorCanvasPoints(fromKey, true));
        const toLog = toLogicalPts(getActorCanvasPoints(toKey, false));
        playOpts.from = fromLog.hit;
        playOpts.groundY = fromLog.anchor.y;
        playOpts.to = toLog.hit;
        playOpts.targetGroundY = toLog.anchor.y;
        playOpts.facing = opts.facing != null ? opts.facing : 1;
      } else if (resolvedId === 'fx_wave_transition') {
        playOpts.facing = opts.facing != null ? opts.facing : 1;
      } else if (opts.fromKey && opts.toKey) {
        const fromLog = toLogicalPts(getActorCanvasPoints(String(opts.fromKey), true));
        const toLog = toLogicalPts(getActorCanvasPoints(String(opts.toKey), false));
        playOpts.from = fromLog.cast;
        playOpts.groundY = fromLog.anchor.y;
        playOpts.to = toLog.hit;
        playOpts.targetGroundY = toLog.anchor.y;
        playOpts.facing = opts.facing != null ? opts.facing : (toLog.hit.x >= fromLog.hit.x ? 1 : -1);
      } else {
        const aLog = toLogicalPts(getActorCanvasPoints(actorKey, true));
        const isEnemy = actorKey.startsWith('enemy:');
        const posObj = { x: aLog.hit.x, y: aLog.hit.y, groundY: aLog.anchor.y };
        playOpts.pos = posObj;
        playOpts.from = aLog.hit;
        playOpts.groundY = aLog.anchor.y;
        playOpts.to = aLog.hit;
        playOpts.targetGroundY = aLog.anchor.y;
        playOpts.side = opts.side || (isEnemy ? 'enemy' : 'player');
        playOpts.facing = opts.facing != null ? opts.facing : (isEnemy ? -1 : 1);
      }

      playEditionA(resolvedId, playOpts);
    };

    const delayMs = Number(opts.delayMs) || 0;
    if (delayMs > 0) {
      scheduleAction(delayMs, executePlay);
    } else {
      executePlay();
    }
    return true;
  }

  /* -------------------- 3D-First 舞台状态同步与统一单 RAF 主循环 -------------------- */
  function resolveAllySpriteId(ally) {
    if (!ally) return 'reno';
    const cands = [ally.spriteId, ally.charId, ally.id];
    for (let i = 0; i < cands.length; i++) {
      const raw = cands[i];
      if (!raw) continue;
      const key = String(raw).toLowerCase().trim();
      if (SPRITE_MANIFEST[key]) return key;
      if (ENEMY_SPRITE_ALIAS[key]) return ENEMY_SPRITE_ALIAS[key];
    }
    return 'reno';
  }

  function syncStage(battleState) {
    if (!isEnabled()) return;
    _lastBattleRef = battleState || _lastBattleRef
      || (global.CombatEngine && typeof global.CombatEngine.getBattleState === 'function' ? global.CombatEngine.getBattleState() : null);
    const curB = _lastBattleRef;
    const bs = document.getElementById('battle-screen');
    if (!bs || bs.classList.contains('hidden')) return;

    const field = bs.querySelector('.cb-arena-field');
    const s3d = global.CombatStage3D;
    if (field && s3d && typeof s3d.isSupported === 'function' && s3d.isSupported()) {
      const mounted = typeof s3d.isMounted === 'function'
        ? s3d.isMounted(field)
        : (typeof s3d.isActive === 'function' && s3d.isActive());
      if (!mounted && typeof s3d.mountForBattle === 'function') {
        try {
          s3d.mountForBattle(curB, field);
        } catch (e) {
          if (global.console && console.error) console.error('[CombatStage3D] syncStage mount error:', e);
        }
      }
    }

    const fRect = field ? field.getBoundingClientRect() : null;
    const fW = fRect && fRect.width > 0 ? Math.round(fRect.width) : (field ? (field.clientWidth | 0) : 0);
    const fH = fRect && fRect.height > 0 ? Math.round(fRect.height) : (field ? (field.clientHeight | 0) : 0);

    const seenKeys = new Set();
    const sigParts = [`field:${fW}x${fH}`];

    // 1) 主角
    const pObj = curB && curB.player ? curB.player : null;
    const pSpriteId = resolvePlayerSpriteId(curB, false);
    const pState = getOrCreateActor('player', pSpriteId);
    pState.isCameo = false;
    pState.dead = !!(pObj && Number.isFinite(pObj.hp) && pObj.hp <= 0);
    pState.flipped = false;
    seenKeys.add('player');
    sigParts.push(`player:${pSpriteId}@${pObj && pObj.slot != null ? pObj.slot : ''}`);

    // 2) 常驻友军
    if (curB && Array.isArray(curB.allies)) {
      for (let i = 0; i < curB.allies.length; i++) {
        const al = curB.allies[i];
        if (!al) continue;
        const aKey = `ally:${al.id || i}`;
        const aSpriteId = resolveAllySpriteId(al);
        const aSt = getOrCreateActor(aKey, aSpriteId);
        aSt.isCameo = false;
        aSt.dead = !!(Number.isFinite(al.hp) && al.hp <= 0);
        aSt.flipped = false;
        seenKeys.add(aKey);
        sigParts.push(`${aKey}:${aSpriteId}@${al.slot != null ? al.slot : ''}`);
      }
    }

    // 3) 敌方阵容
    if (curB && Array.isArray(curB.enemies)) {
      for (let i = 0; i < curB.enemies.length; i++) {
        const en = curB.enemies[i];
        if (!en) continue;
        const eKey = `enemy:${i}`;
        const eSpriteId = resolveEnemySpriteId(en);
        const eSt = getOrCreateActor(eKey, eSpriteId);
        eSt.isCameo = false;
        eSt.dead = !!(Number.isFinite(en.hp) && en.hp <= 0);
        eSt.flipped = false;
        seenKeys.add(eKey);
        sigParts.push(`${eKey}:${eSpriteId}@${en.slot != null ? en.slot : ''}`);
      }
    }

    // 4) 保留仍在场上的临时援护 cameo
    _cameoEntries.forEach((_, cKey) => {
      if (_actors.has(cKey)) {
        seenKeys.add(cKey);
        const cSt = _actors.get(cKey);
        sigParts.push(`${cKey}:${cSt.spriteId}@cameo`);
      }
    });

    const nextSig = sigParts.join('|');
    let needsAspectAlign = false;
    if (fW > 32 && fH > 32) {
      const exp = computeTargetVfxBufSize(fW, fH);
      if (Math.abs(_bufW - exp.targetW) >= 2 || Math.abs(_bufH - exp.targetH) >= 2) {
        needsAspectAlign = true;
      }
    }
    if (nextSig !== _lastLayoutSig || needsAspectAlign) {
      _lastLayoutSig = nextSig;
      invalidateFieldRect();
      ensureVfxCanvas(true);
    } else {
      ensureVfxCanvas(false);
    }

    // 移除已离开当前波次的旧敌人状态
    Array.from(_actors.keys()).forEach(k => {
      if (!seenKeys.has(k)) _actors.delete(k);
    });

    if (s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.syncRoster === 'function') {
      try { s3d.syncRoster(curB, _actors); } catch (e) {}
    }

    _actors.forEach(st => {
      applyActorVisual(st);
    });

    // 检测同场多波次推进或首领二阶段觉醒：自动触发疾奔入场与 3D 舞台波次/阶段切换
    const curBid = curB
      ? (curB.battleInstanceId != null
        ? `${curB.id || ''}:${curB.battleInstanceId}`
        : String(curB.id || ''))
      : '';
    const curWave = curB && typeof curB.waveIdx === 'number' ? curB.waveIdx : -1;
    const curEnemyPhase2Count = (curB && Array.isArray(curB.enemies))
      ? curB.enemies.reduce((acc, e) => acc + ((e && (e.phase || 1) >= 2) ? 1 : 0), 0)
      : 0;
    const curBattlePhase2 = !!(curB && (
      (typeof curB.phase === 'number' && curB.phase >= 2) ||
      (curB.metrics && curB.metrics.phase2Triggered)
    ));
    let waveOrPhaseChanged = false;
    if (curBid && curWave >= 0) {
      const sameBattle = curBid === _lastBattleId;
      const isWaveAdvance = sameBattle && _lastWaveIdx >= 0 && curWave > _lastWaveIdx;
      const isPhase2Advance = sameBattle && curWave === _lastWaveIdx && (
        curEnemyPhase2Count > _lastEnemyPhase2Count ||
        (curBattlePhase2 && !_lastBattlePhase2)
      );
      _lastBattleId = curBid;
      _lastWaveIdx = curWave;
      _lastEnemyPhase2Count = curEnemyPhase2Count;
      _lastBattlePhase2 = curBattlePhase2;
      if (isWaveAdvance) {
        playWaveTransition(curB);
        waveOrPhaseChanged = true;
      }
      if (isPhase2Advance) {
        waveOrPhaseChanged = true;
      }
    }
    if (waveOrPhaseChanged && s3d && typeof s3d.isActive === 'function' && s3d.isActive() && typeof s3d.onWaveOrPhaseChange === 'function') {
      try { s3d.onWaveOrPhaseChange(curB); } catch (e) {}
    }

    // 同步一次魔力增幅 3D 光环状态（切换倾注档位即时反馈）
    const pSt = _actors.get('player');
    if (pSt) {
      renderManaAmpAura(pSt, nowPerf(), 0.016, prefersReducedMotion());
    }

    ensureLoopRunning();
  }

  let _inTick = false;
  let _rafGen = 0;

  function ensureLoopRunning() {
    if (!isEnabled() || _rafId || _inTick) return;
    if (typeof global.requestAnimationFrame !== 'function') return;
    _lastRafTs = 0;
    const myGen = _rafGen;
    _rafId = global.requestAnimationFrame(() => tick(myGen));
  }

  function tick(gen) {
    if (gen !== undefined && gen !== _rafGen) return;
    _rafId = 0;
    if (_inTick) return;
    if (!isEnabled()) return;

    const bs = document.getElementById('battle-screen');
    if (!bs || bs.classList.contains('hidden')) {
      return;
    }

    if (document.hidden) {
      _lastRafTs = 0;
      const myGen = _rafGen;
      _rafId = global.requestAnimationFrame(() => tick(myGen));
      return;
    }

    _inTick = true;
    try {
    const now = nowPerf();
    const rawElapsedSec = _lastRafTs > 0 ? Math.max(0.001, (now - _lastRafTs) / 1000) : 0.016;
    const realDt = clamp(rawElapsedSec, 0.001, 0.05);
    _lastRafTs = now;
    const simDt = realDt * _hitStopScale * _slowMoScale;
    const isSlowMo = _slowMoScale < 0.99;
    const slowMoCompMs = isSlowMo ? Math.max(0, (realDt - simDt) * 1000) : 0;
    const reduced = prefersReducedMotion();

    // 1) 推进编排事件队列（慢镜期对 item.dueAt 补偿累加并跳过墙钟抢跑判定，确保精灵姿势/回撤绝不提前切走）
    const dueFns = [];
    for (let i = _scheduled.length - 1; i >= 0; i--) {
      const item = _scheduled[i];
      item.wait -= simDt;
      if (isSlowMo && item.dueAt) {
        item.dueAt += slowMoCompMs;
        if (item.wait > 0) {
          const minDue = now + item.wait * 1000;
          if (item.dueAt < minDue) item.dueAt = minDue;
        }
      }
      if (item.wait <= 0 || (!isSlowMo && item.dueAt && now >= item.dueAt)) {
        _scheduled.splice(i, 1);
        dueFns.push(item.fn);
      }
    }
    for (let i = dueFns.length - 1; i >= 0; i--) {
      try { dueFns[i](); } catch (e) {}
    }

    // 2) 更新每个角色多帧状态机（7/9/11 帧 + animMap + run 9fps 循环）+ 平滑缓动位移/挤压
    _actors.forEach(st => {
      const meta = getSpriteMeta(st.spriteId);
      const frameCount = meta.frames || 7;

      // 呼吸与浮空计时
      st.floatElapsed += simDt;

      // 命中闪白衰减（实时时钟，避免卡在过曝）
      if (st.flashLeft > 0) {
        st.flashLeft = Math.max(0, st.flashLeft - realDt);
      }

      // 位移缓动（冲刺/疾奔/击退/回弹）
      if (st.dashTween) {
        const tw = st.dashTween;
        tw.elapsed += simDt;
        const p = clamp(tw.elapsed / tw.duration, 0, 1);
        const k = tw.ease(p);
        st.dx = lerp(tw.fromX, tw.toX, k);
        st.dy = lerp(tw.fromY, tw.toY, k);
        if (tw.withGhosts && p > 0.08 && p < 0.92) {
          st.ghostTimer += simDt;
          if (st.ghostTimer >= 0.036) {
            st.ghostTimer = 0;
            spawnDashGhost(st, tw.ghostTone);
          }
        }
        if (p >= 1) {
          st.dx = tw.toX;
          st.dy = tw.toY;
          const finishIdle = !!tw.returnIdle;
          st.dashTween = null;
          if (finishIdle && st.poseOverride === 'run' && !st.poseLock) {
            st.poseOverride = null;
            st.pose = 'idle';
            st.poseTimer = 0;
            st.runElapsed = 0;
            st.runBobY = 0;
            st.runTiltDeg = 0;
            st.runSX = 1;
            st.runSY = 1;
          }
        }
      }

      // 挤压拉伸回弹（严格归位到 1.0, 1.0）
      if (st.squashTween) {
        const sw = st.squashTween;
        sw.elapsed += simDt;
        const p = clamp(sw.elapsed / sw.duration, 0, 1);
        const k = EASE.outBack(p);
        st.sx = lerp(sw.fromSX, sw.toSX, k);
        st.sy = lerp(sw.fromSY, sw.toSY, k);
        if (p >= 1) {
          st.sx = 1;
          st.sy = 1;
          st.squashTween = null;
        }
      }

      // 姿势帧选择（支持 7/9/11 帧队列、run 9fps 步态与 bank.animMap）
      if (st.poseOverride) {
        if (!st.poseLock) {
          st.poseTimer -= simDt;
          let poseGuard = 0;
          while (st.poseTimer <= 0 && st.poseQueue && st.poseQueue.length > 0 && poseGuard++ < 8) {
            const nextStep = st.poseQueue.shift();
            st.poseOverride = nextStep.pose;
            st.pose = nextStep.pose;
            st.frame = nextStep.frame;
            st.poseTimer += Math.max(0.016, nextStep.duration || 0.08);
          }
          if (st.poseTimer <= 0) {
            st.poseOverride = null;
            st.pose = 'idle';
            st.poseTimer = 0;
            if (st.poseQueue) st.poseQueue.length = 0;
          }
        }
      }

      if (!st.poseOverride) {
        st.runElapsed = 0;
        st.runBobY = 0;
        st.runTiltDeg = 0;
        st.runSX = 1;
        st.runSY = 1;
        if (st.dead) {
          st.pose = 'hurt';
          st.frame = resolvePoseFrame('hurt', frameCount, st.spriteId);
        } else if (reduced) {
          st.pose = 'idle';
          st.frame = 0;
        } else {
          st.breathElapsed += simDt;
          if (st.breathElapsed >= st.breathPeriod) {
            st.breathElapsed -= st.breathPeriod;
            st.breathStep = st.breathStep ? 0 : 1;
          }

          if (st.blinkLeft > 0) {
            st.blinkLeft -= simDt;
            st.pose = 'blink';
            st.frame = resolvePoseFrame('blink', frameCount, st.spriteId);
          } else {
            st.blinkCooldown -= simDt;
            if (st.blinkCooldown <= 0) {
              st.blinkLeft = 0.13;
              st.blinkCooldown = 3.2 + Math.random() * 1.6;
              st.pose = 'blink';
              st.frame = resolvePoseFrame('blink', frameCount, st.spriteId);
            } else {
              st.pose = 'idle';
              st.frame = st.breathStep ? 1 : 0;
            }
          }
        }
      } else if (st.poseOverride === 'run') {
        const runInfo = getRunFramesInfo(st.spriteId, frameCount);
        if (reduced) {
          st.frame = runInfo.frames[0];
          st.runBobY = 0;
          st.runTiltDeg = 0;
          st.runSX = 1;
          st.runSY = 1;
        } else {
          st.runElapsed += simDt;
          const fps = runInfo.fps || 9;
          const stepIdx = Math.floor(st.runElapsed * fps) % runInfo.frames.length;
          st.frame = runInfo.frames[stepIdx];
          const phase = st.runElapsed * Math.PI * fps;
          const bobAmp = runInfo.isReal ? 2.2 : 5.8;
          st.runBobY = -Math.abs(Math.sin(phase)) * bobAmp;
          const dirSign = (meta.facing === 'left' && !st.flipped) ? -1 : 1;
          st.runTiltDeg = dirSign * (runInfo.isReal ? 2.2 : 5.2);
          const strideBounce = runInfo.isReal ? 0.018 : 0.042;
          const wave = Math.sin(phase * 2);
          st.runSX = 1 + wave * strideBounce;
          st.runSY = 1 - wave * strideBounce;
        }
      } else {
        st.runElapsed = 0;
        st.runBobY = 0;
        st.runTiltDeg = 0;
        st.runSX = 1;
        st.runSY = 1;
        st.frame = resolvePoseFrame(st.poseOverride, frameCount, st.spriteId);
      }

      // 避免帧号越界
      if (st.frame >= frameCount) st.frame = 0;
      applyActorVisual(st);
    });

    // 2.5) 渲染主角 3D 前后环绕魔力增幅冰晶光环（离屏双层 Canvas 同步至 3D 舞台）
    const playerActor = _actors.get('player');
    if (playerActor) {
      renderManaAmpAura(playerActor, now, simDt, reduced);
    }

    // 3) 渲染全舞台 pixelfx 透明合成帧（30fps 软光栅节流 + 真实墙钟硬超时 + 帧预算看门狗）
    const PFX = global.PixelFX;
    if (_activeEffects.length > 0 && PFX && _frame && _ctx && _imgData) {
      const fxElapsedSinceDraw = _lastFxDrawTs > 0 ? (now - _lastFxDrawTs) : _fxIntervalMs;
      if (fxElapsedSinceDraw >= _fxIntervalMs && now >= _deferFxDrawUntil && (nowPerf() - now) < 12) {
        const fxDt = clamp(fxElapsedSinceDraw / 1000, 0.008, 0.05) * _hitStopScale * _slowMoScale;
        const fxSlowCompMs = isSlowMo ? Math.max(0, fxElapsedSinceDraw - fxDt * 1000) : 0;
        _lastFxDrawTs = now;
        const fxStart = nowPerf();

        for (let i = _activeEffects.length - 1; i >= 0; i--) {
          const entry = _activeEffects[i];
          if (isSlowMo && entry.bornAt) {
            entry.bornAt += fxSlowCompMs;
          }
          const wallAgeMs = now - entry.bornAt;
          entry.elapsed += fxDt;
          if (!entry.stopped && entry.stopAt > 0 && (entry.elapsed >= entry.stopAt || (!isSlowMo && wallAgeMs >= entry.stopAt * 1000))) {
            entry.stopped = true;
            entry.inst.stop();
          }
          if (!isSlowMo && wallAgeMs >= entry.maxAgeMs) {
            _activeEffects.splice(i, 1);
            if (entry.onDone) {
              try { entry.onDone(); } catch (e) {}
            }
            continue;
          }
          entry.inst.update(fxDt);
          if (entry.onUpdate) {
            try { entry.onUpdate(fxDt, entry); } catch (e) {}
          }
          if (entry.inst.done()) {
            _activeEffects.splice(i, 1);
            if (entry.onDone) {
              try { entry.onDone(); } catch (e) {}
            }
          }
        }

        if (_activeEffects.length > 0) {
          let budgetHit = false;
          let drewMainFrame = false;
          const scaledQueue = [];
          const primaryIdx = _activeEffects.length - 1;
          const ordered = [_activeEffects[primaryIdx]];
          for (let i = primaryIdx - 1; i >= 0; i--) ordered.push(_activeEffects[i]);

          // 先绘制标准全画布特效至 _frame，收集缩放离屏特效队列（保持最新特效最优先）
          for (let oi = 0; oi < ordered.length; oi++) {
            const ent = ordered[oi];
            if (oi > 0 && (nowPerf() - fxStart) > FX_FRAME_BUDGET_MS) {
              budgetHit = true;
              break;
            }
            if (ent.scaleProf) {
              scaledQueue.push(ent);
              continue;
            }
            if (!drewMainFrame) {
              PFX.clearFrame(_frame);
              drewMainFrame = true;
            }
            ent.inst.draw(_frame, 'back');
            if (oi > 0 && (nowPerf() - fxStart) > FX_FRAME_BUDGET_MS) {
              budgetHit = true;
              break;
            }
            ent.inst.draw(_frame, 'front');
          }

          if (drewMainFrame) {
            PFX.composite(_frame, _imgData.data, null, 1.0);
            _ctx.putImageData(_imgData, 0, 0);
          } else {
            _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
          }

          // 将 snowflake_burst / eclipse 等离屏特效按真实视觉中心精准缩放贴绘至主画布
          for (let si = scaledQueue.length - 1; si >= 0; si--) {
            if (si < scaledQueue.length - 1 && (nowPerf() - fxStart) > FX_FRAME_BUDGET_MS) {
              budgetHit = true;
              break;
            }
            const ent = scaledQueue[si];
            const prof = ent.scaleProf;
            if (!ensureSubFxBuffer(prof.w, prof.h)) continue;
            PFX.clearFrame(_subFxFrame);
            ent.inst.draw(_subFxFrame, 'back');
            ent.inst.draw(_subFxFrame, 'front');
            PFX.composite(_subFxFrame, _subFxImgData.data, null, 1.0);
            _subFxCtx.putImageData(_subFxImgData, 0, 0);
            const sc = ent.scale || prof.defaultScale || 0.5;
            const dstW = Math.max(8, Math.round(prof.w * sc));
            const dstH = Math.max(8, Math.round(prof.h * sc));
            const dstX = Math.round(ent.x - prof.pivotX * sc);
            const dstY = Math.round(ent.y - prof.pivotY * sc);
            _ctx.imageSmoothingEnabled = false;
            _ctx.drawImage(_subFxCanvas, 0, 0, prof.w, prof.h, dstX, dstY, dstW, dstH);
          }
          _canvasDirty = true;

          const fxCostMs = nowPerf() - fxStart;
          if (budgetHit || fxCostMs > FX_FRAME_BUDGET_MS) {
            _fxDrawBudgetTrips += 1;
            _fxIntervalMs = Math.min(FX_MAX_INTERVAL_MS, _fxIntervalMs + 10);
            while (_activeEffects.length > MAX_ACTIVE_EFFECTS_THROTTLED) {
              evictOldestEffect();
            }
          } else if (fxCostMs < 9 && _fxIntervalMs > FX_BASE_INTERVAL_MS) {
            _fxIntervalMs = Math.max(FX_BASE_INTERVAL_MS, _fxIntervalMs - 4);
          }
        } else if (_canvasDirty) {
          _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
          _canvasDirty = false;
        }
      }
    } else if (_canvasDirty && _ctx && _canvas) {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      _canvasDirty = false;
      _lastFxDrawTs = 0;
      _fxIntervalMs = FX_BASE_INTERVAL_MS;
    }

    // 3.5) 驱动方案 A 高清双 Canvas 管线（640×360 逻辑坐标 → #cb-vfx-edition-a-canvas）
    // 慢镜/顿帧期仍按 simDt 正常推进粒子状态，仅将 canvas 重绘节流至 ~30fps (>= 33ms)；
    // 恢复 1.0x 或 releaseGate 爆裂 / 新特效起播时通过 _editionAForceRender 当帧零延迟重绘
    if (_editionA && _hdCanvas) {
      const edThrottled = _slowMoScale < 0.99 || _hitStopScale < 0.5;
      if (_editionA.isActive()) {
        _editionA.update(simDt * 1000);
        const stillActive = _editionA.isActive();
        const shouldRender =
          !edThrottled ||
          _editionAForceRender ||
          !stillActive ||
          _editionALastRenderTs === 0 ||
          (now - _editionALastRenderTs) >= EDITION_A_SLOWMO_RENDER_INTERVAL_MS;
        if (shouldRender) {
          _editionA.render(false);
          _editionALastRenderTs = now;
          _editionAForceRender = false;
        }
        _editionADirty = stillActive;
      } else if (_editionADirty) {
        _editionA.render(false);
        _editionADirty = false;
        _editionALastRenderTs = 0;
        _editionAForceRender = false;
      }
    }

    } finally {
      _inTick = false;
      if (isEnabled() && !_rafId && (gen === undefined || gen === _rafGen)) {
        const bsEnd = document.getElementById('battle-screen');
        if (bsEnd && !bsEnd.classList.contains('hidden')) {
          const myGen = _rafGen;
          _rafId = global.requestAnimationFrame(() => tick(myGen));
        }
      }
    }
  }

  /* -------------------- 清理重置 -------------------- */
  function clearEffects() {
    _playerActionGen += 1;
    _enemyActionEpoch += 1;
    _enemyActionGen.clear();
    _lastGateBlockFx = null;
    _scheduled.length = 0;
    _activeEffects.length = 0;
    _statusMicroThrottle.clear();
    if (_editionA && typeof _editionA.clear === 'function') {
      try { _editionA.clear(); } catch (e) {}
    }
    _editionADirty = false;
    _editionALastRenderTs = 0;
    _editionAForceRender = false;
    _auraShockwaves.length = 0;
    _auraBurstParticles.length = 0;
    _auraBurstTs = 0;
    _auraBurstTier = 0;
    _auraLastBurstTs = 0;
    _auraLastBurstTier = 0;
    _lastFxDrawTs = 0;
    _deferFxDrawUntil = 0;
    _fxIntervalMs = FX_BASE_INTERVAL_MS;
    _burstCreateCount = 0;
    _burstWindowStart = 0;
    _hitStopId += 1;
    _hitStopScale = 1.0;
    _slowMoScale = 1.0;
    if (_hitStopTimer) {
      clearTimeout(_hitStopTimer);
      _rawTimers.delete(_hitStopTimer);
      _hitStopTimer = null;
    }
    clearAllCameos();
    // 清除全部角色残留位移、闪白与临时姿态，防止波次切换时卡在冲刺位或受击过曝
    _actors.forEach(st => {
      const meta = getSpriteMeta(st.spriteId);
      const frameCount = meta.frames || 7;
      st.dx = 0;
      st.dy = 0;
      st.sx = 1;
      st.sy = 1;
      st.runElapsed = 0;
      st.runBobY = 0;
      st.runTiltDeg = 0;
      st.runSX = 1;
      st.runSY = 1;
      st.dashTween = null;
      st.squashTween = null;
      st.flashLeft = 0;
      st.poseOverride = null;
      st.poseLock = false;
      st.pose = st.dead ? 'hurt' : 'idle';
      st.frame = st.dead ? resolvePoseFrame('hurt', frameCount, st.spriteId) : 0;
      if (st.poseQueue) st.poseQueue.length = 0;
      applyActorVisual(st);
    });
    if (_ctx && _canvas) {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    }
    if (_subFxCtx && _subFxCanvas) {
      _subFxCtx.clearRect(0, 0, _subFxCanvas.width, _subFxCanvas.height);
    }
    _canvasDirty = false;
    if (typeof document !== 'undefined') {
      const field = document.querySelector('#battle-screen .cb-arena-field');
      if (field) field.classList.remove('cb-hitstop-75');
    }
    const s3dClear = global.CombatStage3D;
    if (s3dClear && typeof s3dClear.isActive === 'function' && s3dClear.isActive()) {
      if (typeof s3dClear.setTimeScale === 'function') {
        try { s3dClear.setTimeScale(1.0); } catch (e) {}
      }
      if (typeof s3dClear.clearEffects === 'function') {
        try { s3dClear.clearEffects(); } catch (e) {}
      }
    }
  }

  function cleanup() {
    _rafGen += 1;
    if (_rafId && typeof global.cancelAnimationFrame === 'function') {
      global.cancelAnimationFrame(_rafId);
    }
    _rafId = 0;
    _lastRafTs = 0;
    _lastLayoutSig = '';
    _lastBattleRef = null;
    _lastBattleId = '';
    _lastWaveIdx = -1;
    _lastEnemyPhase2Count = 0;
    _lastBattlePhase2 = false;
    _fxDrawBudgetTrips = 0;
    _auraDirty = false;
    _auraLastTier = 0;
    _auraLastIntensity = 0;
    _auraBurstTs = 0;
    _auraBurstTier = 0;
    _auraLastBurstTs = 0;
    _auraLastBurstTier = 0;
    _auraShockwaves.length = 0;
    _auraBurstParticles.length = 0;
    _auraElapsed = 0;
    _lastAuraDrawTs = 0;
    _slowMoScale = 1.0;
    if (_fieldResizeObserver) {
      try { _fieldResizeObserver.disconnect(); } catch (e) {}
      _fieldResizeObserver = null;
      _observedFieldEl = null;
    }
    invalidateFieldRect();
    clearEffects();
    _hdCanvas = null;
    _hdW = 0;
    _hdH = 0;
    _editionA = null;
    _editionADirty = false;
    _editionALastRenderTs = 0;
    _editionAForceRender = false;
    _rawTimers.forEach(tid => clearTimeout(tid));
    _rawTimers.clear();
    _actors.forEach(st => {
      if (st.auraBackCtx) st.auraBackCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);
      if (st.auraFrontCtx) st.auraFrontCtx.clearRect(0, 0, AURA_BUF_W, AURA_BUF_H);
      st._auraTierTag = '';
    });
    _actors.clear();
    const s3dClean = global.CombatStage3D;
    if (s3dClean && typeof s3dClean.cleanup === 'function') {
      try { s3dClean.cleanup(); } catch (e) {}
    }
  }

  /* -------------------- QA 实时触发与单帧检查 API -------------------- */
  function demoSkill(skillId, enemyIdx) {
    if (!isEnabled()) return false;
    const b = _lastBattleRef
      || (global.CombatEngine && typeof global.CombatEngine.getBattleState === 'function' ? global.CombatEngine.getBattleState() : null)
      || (global.CombatEngine && typeof global.CombatEngine.getState === 'function' ? global.CombatEngine.getState() : null);
    syncStage(b);
    const idx = enemyIdx != null ? enemyIdx : (b && b.targetIdx ? b.targetIdx : 0);
    const sid = skillId || 'hand_ice_crystal';
    const isAoe = sid === 'hand_thorn_field' || sid === 'hand_frost_floor' || sid === 'frost_1_step' || sid === 'frost_2_breath' || sid === 'frost_3_thorns';
    const targetIndices = isAoe ? getLivingEnemyIndices(b, idx) : [idx];
    playSkillAction(b, {
      skillId: sid,
      targetIdx: idx,
      targetIndices,
      didCrit: sid.startsWith('insight_'),
      didBreak: sid.startsWith('remote_') || sid.startsWith('insight_'),
      didRiposte: sid === 'sword_water_edge',
      shieldBroken: false,
      usedWand: false,
      missed: false,
    });
    return true;
  }

  function demoEnemyAttack(enemyIdx) {
    if (!isEnabled()) return false;
    const b = _lastBattleRef
      || (global.CombatEngine && typeof global.CombatEngine.getBattleState === 'function' ? global.CombatEngine.getBattleState() : null)
      || (global.CombatEngine && typeof global.CombatEngine.getState === 'function' ? global.CombatEngine.getState() : null);
    syncStage(b);
    const idx = enemyIdx != null ? enemyIdx : 0;
    const enemy = b && b.enemies && b.enemies[idx] ? b.enemies[idx] : null;
    const actorSt = _actors.get(`enemy:${idx}`);
    const spriteId = (actorSt && actorSt.spriteId) || resolveEnemySpriteId(enemy);
    playEnemyAction(b, {
      enemyIdx: idx,
      spriteId,
      enemy,
      intent: (enemy && enemy.intent) || { stance: 'HEAVY_WINDUP', dmg: 48 },
      hpLoss: 36,
      blocked: false,
      parried: false,
      evaded: false,
    });
    return true;
  }

  function setPose(side, idx, pose, holdMs) {
    if (!isEnabled()) return false;
    syncStage(_lastBattleRef);
    let key;
    if (side === 'player') {
      key = 'player';
    } else if (typeof side === 'string' && side.startsWith('ally:')) {
      key = side;
    } else {
      key = `enemy:${idx != null ? idx : 0}`;
    }
    const lockForever = holdMs === 0 || holdMs === Infinity;
    setActorPoseInternal(key, pose || 'idle', lockForever ? 0 : (holdMs || 1800), lockForever);
    return true;
  }

  function getDebugState() {
    const actorSummary = {};
    _actors.forEach((st, k) => {
      actorSummary[k] = {
        spriteId: st.spriteId,
        pose: st.poseOverride || st.pose,
        frame: st.frame,
        dx: Math.round(st.dx * 10) / 10,
        dy: Math.round(st.dy * 10) / 10,
        sx: Math.round(st.sx * 100) / 100,
      };
    });
    const amp = getManaAmpState(_lastBattleRef);
    const edApi = getEditionAApi();
    return {
      enabled: isEnabled(),
      canvasW: _bufW,
      canvasH: _bufH,
      hdCanvasW: _hdW,
      hdCanvasH: _hdH,
      editionAActive: hasEditionA(),
      editionAPlaying: !!(_editionA && _editionA.isActive()),
      editionASkillCount: edApi && Array.isArray(edApi.SKILLS) ? edApi.SKILLS.length : 0,
      editionAStats: _editionA && typeof _editionA.getStats === 'function' ? _editionA.getStats() : null,
      fxIntervalMs: _fxIntervalMs,
      budgetTrips: _fxDrawBudgetTrips,
      activeEffects: _activeEffects.map(e => e.name),
      activeEffectsCount: _activeEffects.length,
      scheduledCount: _scheduled.length,
      liveGhosts: 0,
      cameos: Array.from(_cameoEntries.keys()),
      auraTier: amp.tier,
      auraShockwaves: _auraShockwaves.length,
      auraBurstParticles: _auraBurstParticles.length,
      timeScale: _hitStopScale * _slowMoScale,
      hitStopScale: _hitStopScale,
      slowMoScale: _slowMoScale,
      hitStopId: _hitStopId,
      actors: actorSummary,
    };
  }

  function playAmpChargeBurst(ampPct) {
    if (!isEnabled()) return;
    const rawPct = typeof ampPct === 'number' && Number.isFinite(ampPct) ? (ampPct > 1 ? ampPct / 100 : ampPct) : 0;
    const pct = clamp(rawPct, 0, 0.60);
    const tier = pct >= 0.595 ? 3 : pct >= 0.395 ? 2 : pct > 0.001 ? 1 : 0;
    const now = nowPerf();
    const reduced = prefersReducedMotion();

    let pSt = _actors.get('player');
    if (!pSt) {
      syncStage(_lastBattleRef);
      pSt = _actors.get('player');
    }

    // 全部 tier >= 1（20% / 40% / 60%）均触发标杆棱镜冲击波环 + 旋转四菱棱晶碎片爆破，彻底告别旧 frost_nova + snowflake_burst 糊脸白柱
    if (tier >= 1 && !reduced) {
      const sameTierDebounce = tier === _auraLastBurstTier && (now - _auraLastBurstTs) < 90;
      if (!sameTierDebounce) {
        _auraBurstTs = now;
        _auraBurstTier = tier;
        _auraLastBurstTs = now;
        _auraLastBurstTier = tier;
        spawnManaAmpBurst(pct, tier);
      }
    } else if (tier === 0) {
      _auraLastBurstTier = 0;
    }

    if (pSt) {
      _lastAuraDrawTs = 0;
      renderManaAmpAura(pSt, now, 0.016, reduced);
    }
    if (tier >= 1 || _auraShockwaves.length > 0 || _auraBurstParticles.length > 0) {
      ensureLoopRunning();
    }
  }

  /* -------------------- 监听窗口尺寸变化与页签切换 -------------------- */
  if (typeof window !== 'undefined' && !isJsdomEnv()) {
    window.addEventListener('resize', () => {
      invalidateFieldRect();
      const bs = document.getElementById('battle-screen');
      if (bs && !bs.classList.contains('hidden')) {
        ensureVfxCanvas(true);
      }
    });
    document.addEventListener('visibilitychange', () => {
      _lastRafTs = 0;
      _lastFxDrawTs = 0;
      _lastAuraDrawTs = 0;
      _editionALastRenderTs = 0;
    });
  }

  if (typeof global !== 'undefined' && typeof global.addEventListener === 'function') {
    global.addEventListener('combatstage3d:ready', () => {
      const s3d = global.CombatStage3D;
      if (!s3d || (typeof s3d.isActive === 'function' && s3d.isActive())) return;
      if (!_lastBattleRef) return;
      const bs = typeof document !== 'undefined' ? document.getElementById('battle-screen') : null;
      if (!bs || bs.classList.contains('hidden')) return;
      syncStage(_lastBattleRef);
    });
  }

  ensureEditionAAliases(global.VfxEditionAFull);

  global.CombatPixelVFX = {
    SPRITE_MANIFEST,
    ENEMY_SPRITE_ALIAS,
    PALETTES,
    isEnabled,
    hasEditionA,
    getManaAmpState,
    getSpriteMeta,
    getRunFramesInfo,
    hasMagicCastFrames,
    resolvePlayerSpriteId,
    resolveEnemySpriteId,
    resolvePoseFrame,
    getHeadCanvas,
    drawHeadCanvas,
    renderActorMarkup,
    syncStage,
    playSkillAction,
    playEnemyAction,
    playEnemySequence,
    playAllyAction,
    playAllyGuard,
    playWaveTransition,
    playWandToggle,
    playStaffSwitch,
    playBlock,
    playSystemFx,
    playAmpChargeBurst,
    playPalaceTimeStop,
    playAinoSpearSupport,
    playRenoSupport,
    summonAllyCameo,
    playBondAssist,
    setSlowMoScale,
    getSlowMoScale,
    getActorScreenPoint,
    resolveVfxPeakMs,
    triggerHitStop,
    triggerTrauma,
    spawnFx,
    demoSkill,
    demoEnemyAttack,
    setPose,
    getDebugState,
    clearEffects,
    cleanup,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.CombatPixelVFX;
  }
})(typeof window !== 'undefined' ? window : globalThis);
