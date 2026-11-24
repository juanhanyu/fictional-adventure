/* =====================================================================
   《转生千金》60fps 像素战斗精灵动画 × patch-gg/pixelfx 法术特效引擎
   (js/combat-pixel-vfx.js)
   导出：window.CombatPixelVFX
   - 14 套 6 帧横向像素精灵注册表与状态机（呼吸/随机眨眼/浮空/蓄势/出击/受击）
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

  /* -------------------- 14 套像素精灵完整清单（含精确内联默认值 + 懒同步 JSON） -------------------- */
  const SPRITE_MANIFEST = {
    sylvia_silver: {
      id: 'sylvia_silver',
      file: 'assets/sprites/sylvia_silver_sheet.png',
      metaFile: 'assets/sprites/sylvia_silver_meta.json',
      frames: 6,
      frameW: 72,
      frameH: 80,
      facing: 'right',
      anchorX: 0.4583,
      anchorY: 0.925,
      castX: 0.9167,
      castY: 0.5125,
      hitX: 0.4722,
      hitY: 0.5625,
      headX: 0.4722,
      headY: 0.2875,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    sylvia_disguise: {
      id: 'sylvia_disguise',
      file: 'assets/sprites/sylvia_disguise_sheet.png',
      metaFile: 'assets/sprites/sylvia_disguise_meta.json',
      frames: 6,
      frameW: 72,
      frameH: 80,
      facing: 'right',
      anchorX: 0.4583,
      anchorY: 0.925,
      castX: 0.9167,
      castY: 0.5125,
      hitX: 0.4722,
      hitY: 0.5625,
      headX: 0.4722,
      headY: 0.2875,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    beatrice: {
      id: 'beatrice',
      file: 'assets/sprites/beatrice_sheet.png',
      metaFile: 'assets/sprites/beatrice_meta.json',
      frames: 6,
      frameW: 72,
      frameH: 80,
      facing: 'left',
      anchorX: 0.5278,
      anchorY: 0.925,
      castX: 0.0833,
      castY: 0.4875,
      hitX: 0.5139,
      hitY: 0.55,
      headX: 0.5139,
      headY: 0.275,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    alice: {
      id: 'alice',
      file: 'assets/sprites/alice_sheet.png',
      metaFile: 'assets/sprites/alice_meta.json',
      frames: 6,
      frameW: 72,
      frameH: 80,
      facing: 'left',
      anchorX: 0.5417,
      anchorY: 0.925,
      castX: 0.0556,
      castY: 0.5125,
      hitX: 0.5278,
      hitY: 0.575,
      headX: 0.5278,
      headY: 0.3,
      scaleMult: 0.98,
      shadowW: 58,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    aino: {
      id: 'aino',
      file: 'assets/sprites/aino_sheet.png',
      metaFile: 'assets/sprites/aino_meta.json',
      frames: 6,
      frameW: 72,
      frameH: 80,
      facing: 'left',
      anchorX: 0.5417,
      anchorY: 0.925,
      castX: 0.0417,
      castY: 0.5,
      hitX: 0.5278,
      hitY: 0.5625,
      headX: 0.5278,
      headY: 0.2875,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    noelle: {
      id: 'noelle',
      file: 'assets/sprites/noelle_sheet.png',
      metaFile: 'assets/sprites/noelle_meta.json',
      frames: 6,
      frameW: 72,
      frameH: 80,
      facing: 'left',
      anchorX: 0.5278,
      anchorY: 0.925,
      castX: 0.1806,
      castY: 0.5125,
      hitX: 0.5139,
      hitY: 0.5625,
      headX: 0.5139,
      headY: 0.2875,
      scaleMult: 1.0,
      shadowW: 60,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    rowan: {
      id: 'rowan',
      file: 'assets/sprites/rowan_sheet.png',
      metaFile: 'assets/sprites/rowan_meta.json',
      frames: 6,
      frameW: 76,
      frameH: 84,
      facing: 'left',
      anchorX: 0.5789,
      anchorY: 0.9286,
      castX: 0.0658,
      castY: 0.4643,
      hitX: 0.5658,
      hitY: 0.5357,
      headX: 0.5658,
      headY: 0.25,
      scaleMult: 0.96,
      shadowW: 62,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    wind_god_avatar: {
      id: 'wind_god_avatar',
      file: 'assets/sprites/wind_god_avatar_sheet.png',
      metaFile: 'assets/sprites/wind_god_avatar_meta.json',
      frames: 6,
      frameW: 84,
      frameH: 88,
      facing: 'left',
      anchorX: 0.5476,
      anchorY: 0.9318,
      castX: 0.0714,
      castY: 0.4545,
      hitX: 0.5476,
      hitY: 0.5227,
      headX: 0.5357,
      headY: 0.2841,
      scaleMult: 0.94,
      shadowW: 54,
      floatAmp: 3.2,
      archetype: 'boss',
    },
    eastwing_commander: {
      id: 'eastwing_commander',
      file: 'assets/sprites/eastwing_commander_sheet.png',
      metaFile: 'assets/sprites/eastwing_commander_meta.json',
      frames: 6,
      frameW: 80,
      frameH: 86,
      facing: 'left',
      anchorX: 0.55,
      anchorY: 0.9302,
      castX: 0.0375,
      castY: 0.5349,
      hitX: 0.5375,
      hitY: 0.5116,
      headX: 0.55,
      headY: 0.2791,
      scaleMult: 0.95,
      shadowW: 64,
      floatAmp: 0,
      archetype: 'boss',
    },
    corridor_vanguard: {
      id: 'corridor_vanguard',
      file: 'assets/sprites/corridor_vanguard_sheet.png',
      metaFile: 'assets/sprites/corridor_vanguard_meta.json',
      frames: 6,
      frameW: 76,
      frameH: 82,
      facing: 'left',
      anchorX: 0.5658,
      anchorY: 0.9268,
      castX: 0.0921,
      castY: 0.5122,
      hitX: 0.5526,
      hitY: 0.5122,
      headX: 0.5395,
      headY: 0.2561,
      scaleMult: 0.96,
      shadowW: 62,
      floatAmp: 0,
      archetype: 'humanoid',
    },
    wolf_alpha: {
      id: 'wolf_alpha',
      file: 'assets/sprites/wolf_alpha_sheet.png',
      metaFile: 'assets/sprites/wolf_alpha_meta.json',
      frames: 6,
      frameW: 88,
      frameH: 72,
      facing: 'left',
      anchorX: 0.5,
      anchorY: 0.9167,
      castX: 0.0795,
      castY: 0.6389,
      hitX: 0.4773,
      hitY: 0.5556,
      headX: 0.2614,
      headY: 0.5694,
      scaleMult: 0.98,
      shadowW: 76,
      floatAmp: 0,
      archetype: 'beast',
    },
    pack_wolf: {
      id: 'pack_wolf',
      file: 'assets/sprites/pack_wolf_sheet.png',
      metaFile: 'assets/sprites/pack_wolf_meta.json',
      frames: 6,
      frameW: 80,
      frameH: 64,
      facing: 'left',
      anchorX: 0.5125,
      anchorY: 0.9062,
      castX: 0.0625,
      castY: 0.5156,
      hitX: 0.4625,
      hitY: 0.5156,
      headX: 0.225,
      headY: 0.3906,
      scaleMult: 0.96,
      shadowW: 74,
      floatAmp: 0,
      archetype: 'beast',
    },
    shadow_jackal: {
      id: 'shadow_jackal',
      file: 'assets/sprites/shadow_jackal_sheet.png',
      metaFile: 'assets/sprites/shadow_jackal_meta.json',
      frames: 6,
      frameW: 84,
      frameH: 68,
      facing: 'left',
      anchorX: 0.5238,
      anchorY: 0.9118,
      castX: 0.0714,
      castY: 0.5735,
      hitX: 0.5,
      hitY: 0.5294,
      headX: 0.2619,
      headY: 0.4706,
      scaleMult: 0.98,
      shadowW: 74,
      floatAmp: 0,
      archetype: 'beast',
    },
    abyss_behemoth: {
      id: 'abyss_behemoth',
      file: 'assets/sprites/abyss_behemoth_sheet.png',
      metaFile: 'assets/sprites/abyss_behemoth_meta.json',
      frames: 6,
      frameW: 96,
      frameH: 84,
      facing: 'left',
      anchorX: 0.4792,
      anchorY: 0.9286,
      castX: 0.125,
      castY: 0.8571,
      hitX: 0.4167,
      hitY: 0.5833,
      headX: 0.2292,
      headY: 0.5476,
      scaleMult: 0.92,
      shadowW: 78,
      floatAmp: 0,
      archetype: 'boss',
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
    flame_mage_a: 'corridor_vanguard',
    flame_mage: 'corridor_vanguard',
    slime_fire: 'corridor_vanguard',
    wolf_alpha: 'wolf_alpha',
    wolf_king: 'wolf_alpha',
    north_forest_hunt: 'wolf_alpha',
    wolf_b: 'pack_wolf',
    wolf_c: 'pack_wolf',
    wolf_d: 'pack_wolf',
    pack_wolf: 'pack_wolf',
    wolf: 'pack_wolf',
    frost_hound_a: 'pack_wolf',
    frost_hound_b: 'pack_wolf',
    frost_hound: 'pack_wolf',
    ice_wolf: 'pack_wolf',
    shadow_jackal: 'shadow_jackal',
    jackal: 'shadow_jackal',
    ridge_claw: 'shadow_jackal',
    jackal_minor: 'shadow_jackal',
    abyss_behemoth: 'abyss_behemoth',
    tundra_brute: 'abyss_behemoth',
    hulan_brute: 'abyss_behemoth',
    hulan_lord: 'abyss_behemoth',
    hulan_beast_tide: 'abyss_behemoth',
    boar: 'abyss_behemoth',
    golem: 'abyss_behemoth',
    frost_lizard: 'abyss_behemoth',
  };

  const POSE_TO_FRAME = {
    idle: 0,
    idle1: 0,
    idle2: 1,
    blink: 2,
    windup: 3,
    strike: 4,
    hurt: 5,
  };

  /* -------------------- 冰晶故事绘本色板（贴合雪瓷蓝宝石美术基调） -------------------- */
  const PALETTES = {
    ice: ['#0c1a3d', '#16357a', '#1c56c8', '#3898f0', '#6bc5f8', '#b8e8ff', '#e4f7ff', '#ffffff'],
    water: ['#081b38', '#0e366d', '#165aa6', '#2183d2', '#3eb4ef', '#86dcfa', '#d0f4ff', '#ffffff'],
    wind: ['#0a2422', '#124640', '#1c7266', '#2ca490', '#58d4bc', '#9cf2df', '#d8fff4', '#ffffff'],
    swordIce: ['#16357a', '#1c56c8', '#3898f0', '#6bc5f8', '#c0e8ff', '#eef9ff', '#ffffff'],
    swordSparks: ['#ffffff', '#dcfbff', '#6bc5f8', '#1c56c8'],
    fire: ['#4a1712', '#8a1f17', '#c9281f', '#f2561d', '#ff8a2a', '#ffc23d', '#ffe26b', '#fff3a6', '#ffffff'],
    eclipse: ['#090516', '#1b0f38', '#331868', '#5224a4', '#7e42d8', '#b07cf4', '#dcc4ff', '#f8f2ff'],
    claw: ['#2a0808', '#5c0f12', '#a51d1d', '#e2401f', '#ff8a2a', '#ffd166', '#fff3c4', '#ffffff'],
  };

  /* -------------------- 运行态缓存 -------------------- */
  const _metaFetched = new Set();
  const _imgPreloaded = new Map(); // id -> 'loading' | 'ok' | 'err'
  const _actors = new Map(); // actorKey -> state object
  const _activeEffects = []; // live PixelFX entries
  const _scheduled = []; // timed choreography callbacks
  const _rawTimers = new Set();

  let _rafId = 0;
  let _lastRafTs = 0;
  let _hitStopId = 0;
  let _hitStopScale = 1.0;
  let _hitStopTimer = null;

  let _canvas = null;
  let _ctx = null;
  let _frame = null;
  let _imgData = null;
  let _bufW = 0;
  let _bufH = 0;
  let _canvasDirty = false;
  let _lastBattleRef = null;
  let _fxSeed = 11;

  const _flashStamps = [];
  const MAX_FLASHES_PER_SEC = 2;

  /* -------------------- 辅助工具 -------------------- */
  function escapeAttr(val) {
    return String(val == null ? '' : val).replace(/"/g, '&quot;');
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

  function getSpriteMeta(spriteId) {
    return SPRITE_MANIFEST[spriteId] || SPRITE_MANIFEST.sylvia_silver;
  }

  function resolvePlayerSpriteId(battleState, isVol3Disguise) {
    if (isVol3Disguise) return 'sylvia_disguise';
    if (battleState) {
      const sid = battleState.id || (battleState.stageCfg && battleState.stageCfg.id) || '';
      const pname = battleState.player && battleState.player.name ? battleState.player.name : '';
      if (sid === 'north_forest_hunt' || sid === 'hulan_beast_tide' || sid === 'wind_god_eye' || pname.includes('眷寒渔')) {
        return 'sylvia_disguise';
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
    if (joined.includes('corridor') || joined.includes('inquisitor') || joined.includes('flame_mage')) return 'corridor_vanguard';
    if (joined.includes('rowan')) return 'rowan';
    if (joined.includes('beatrice')) return 'beatrice';
    if (joined.includes('alice')) return 'alice';
    if (joined.includes('aino')) return 'aino';
    if (joined.includes('noelle')) return 'noelle';
    if (joined.includes('alpha')) return 'wolf_alpha';
    if (joined.includes('jackal') || joined.includes('ridge_claw')) return 'shadow_jackal';
    if (joined.includes('behemoth') || joined.includes('hulan') || joined.includes('brute') || joined.includes('lord') || joined.includes('lizard')) return 'abyss_behemoth';
    return 'pack_wolf';
  }

  /* -------------------- 真像素矩阵库（零 PNG · 逐像素索引渲染到 Canvas） -------------------- */
  const _bankFrameCache = new Map(); // `${id}:${frame}` -> ImageData
  const BANK_CHARS = '.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~';

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
    const palRgb = entry.palette.map(hexToRgbTriplet);
    const rows = entry.frames[idx] || [];
    for (let y = 0; y < h && y < rows.length; y++) {
      const line = expandPixelRow(rows[y], w);
      for (let x = 0; x < w && x < line.length; x++) {
        const sym = line[x];
        if (sym === '.') continue;
        const pi = BANK_CHARS.indexOf(sym);
        const rgb = pi > 0 ? palRgb[pi] : null;
        if (!rgb) continue;
        const off = (y * w + x) * 4;
        rgba[off] = rgb[0];
        rgba[off + 1] = rgb[1];
        rgba[off + 2] = rgb[2];
        rgba[off + 3] = 255;
      }
    }
    const imgData = new ImageData(rgba, w, h);
    _bankFrameCache.set(cacheKey, imgData);
    return imgData;
  }

  function drawBankFrameOnCanvas(canvasEl, spriteId, frameIdx) {
    if (!canvasEl || canvasEl.tagName !== 'CANVAS') return;
    const imgData = decodeBankFrame(spriteId, frameIdx);
    if (!imgData) return;
    if (canvasEl.width !== imgData.width) canvasEl.width = imgData.width;
    if (canvasEl.height !== imgData.height) canvasEl.height = imgData.height;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(imgData, 0, 0);
  }

  function hasPngSheetInstalled(spriteId) {
    const list = global.PIXEL_PNG_SHEETS_INSTALLED;
    if (list === true) return true;
    if (Array.isArray(list)) return list.indexOf(spriteId) !== -1;
    return false;
  }

  /* -------------------- 精灵预加载与 JSON 元数据懒同步 -------------------- */
  function preloadSpriteSheet(spriteId) {
    if (!isEnabled()) return;
    const meta = getSpriteMeta(spriteId);
    if (!meta || _imgPreloaded.has(meta.id)) return;
    if (getPixelBankEntry(meta.id)) {
      _imgPreloaded.set(meta.id, 'bank');
      return;
    }
    if (!hasPngSheetInstalled(meta.id)) {
      _imgPreloaded.set(meta.id, 'err');
      return;
    }
    _imgPreloaded.set(meta.id, 'loading');
    try {
      const img = new global.Image();
      img.onload = () => {
        _imgPreloaded.set(meta.id, 'ok');
      };
      img.onerror = () => {
        _imgPreloaded.set(meta.id, 'err');
        document.querySelectorAll(`.cb-px-actor[data-sprite-id="${meta.id}"]`).forEach(el => {
          el.classList.add('is-sheet-missing');
        });
      };
      img.src = meta.file;
    } catch (e) {}
  }

  function syncSpriteMeta(spriteId) {
    if (!isEnabled()) return;
    const meta = getSpriteMeta(spriteId);
    if (!meta || _metaFetched.has(meta.id)) return;
    const bank = getPixelBankEntry(meta.id);
    if (bank) {
      _metaFetched.add(meta.id);
      meta.frameW = bank.w;
      meta.frameH = bank.h;
      meta.frames = bank.frames.length;
      if (typeof bank.facing === 'string') meta.facing = bank.facing;
      if (typeof bank.scaleMult === 'number') meta.scaleMult = bank.scaleMult;
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
      return;
    }
    if (!meta.metaFile || !hasPngSheetInstalled(meta.id)) return;
    _metaFetched.add(meta.id);
    if (typeof global.fetch !== 'function') return;
    try {
      const proto = global.location && global.location.protocol ? global.location.protocol : '';
      if (proto !== 'http:' && proto !== 'https:') return;
      global.fetch(meta.metaFile, { cache: 'force-cache' })
        .then(res => (res && res.ok ? res.json() : null))
        .then(data => {
          if (!data || typeof data !== 'object') return;
          const numKeys = ['frameW', 'frameH', 'frames', 'anchorX', 'anchorY', 'castX', 'castY', 'hitX', 'hitY', 'headX', 'headY'];
          numKeys.forEach(k => {
            if (typeof data[k] === 'number' && Number.isFinite(data[k])) meta[k] = data[k];
          });
          if (typeof data.facing === 'string') meta.facing = data.facing;
          document.querySelectorAll(`.cb-px-actor[data-sprite-id="${meta.id}"]`).forEach(el => {
            el.style.setProperty('--px-fw', `${meta.frameW}px`);
            el.style.setProperty('--px-fh', `${meta.frameH}px`);
            el.style.setProperty('--px-ax', `${(meta.anchorX * 100).toFixed(2)}%`);
            el.style.setProperty('--px-ay', `${(meta.anchorY * 100).toFixed(2)}%`);
          });
        })
        .catch(() => {});
    } catch (e) {}
  }

  /* -------------------- 精灵状态机管理 -------------------- */
  function createActorState(actorKey, spriteId) {
    return {
      key: actorKey,
      spriteId,
      el: null,
      rigEl: null,
      sheetEl: null,
      shadowEl: null,
      pose: 'idle',
      frame: 0,
      lastDrawnKey: '',
      poseOverride: null,
      poseTimer: 0,
      poseLock: false,
      breathElapsed: Math.random() * 0.5,
      breathPeriod: 0.44 + Math.random() * 0.11, // 每角色错开周期，群狼永不同步机械呼吸
      breathStep: Math.random() < 0.5 ? 0 : 1,
      blinkCooldown: 2.2 + Math.random() * 2.6,
      blinkLeft: 0,
      floatPhase: Math.random() * Math.PI * 2,
      floatElapsed: 0,
      dx: 0,
      dy: 0,
      sx: 1,
      sy: 1,
      dashTween: null,
      squashTween: null,
      flashLeft: 0,
      ghostTimer: 0,
      ghostTone: 'ice',
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
      st.lastDrawnKey = '';
    }
    return st;
  }

  function renderActorMarkup(spriteId, opts) {
    opts = opts || {};
    const meta = getSpriteMeta(spriteId);
    preloadSpriteSheet(meta.id);
    syncSpriteMeta(meta.id);

    const bank = getPixelBankEntry(meta.id);
    const actorKey = opts.actorKey || (meta.facing === 'right' ? 'player' : 'enemy:0');
    const st = getOrCreateActor(actorKey, meta.id);
    st.dead = !!opts.dead;

    const curPose = st.poseOverride || st.pose || 'idle';
    const curFrame = typeof st.frame === 'number' ? st.frame : 0;
    const missingCls = (!bank && _imgPreloaded.get(meta.id) === 'err') ? ' is-sheet-missing' : '';
    const deadCls = opts.dead ? ' is-dead' : '';
    const archCls = ` arch-${meta.archetype || 'humanoid'}`;
    const safeLabel = escapeAttr(opts.label || meta.id);

    let fallbackMarkup = '';
    if (opts.fallbackHtml) {
      fallbackMarkup = `<div class="cb-px-fallback" aria-hidden="true">${opts.fallbackHtml}</div>`;
    } else if (opts.fallbackImg) {
      fallbackMarkup = `<div class="cb-px-fallback" aria-hidden="true"><img src="${escapeAttr(opts.fallbackImg)}" alt="${safeLabel}"/></div>`;
    }

    const sheetMarkup = bank
      ? `<canvas class="cb-px-sheet" width="${bank.w}" height="${bank.h}" role="img" aria-label="${safeLabel}"></canvas>`
      : `<div class="cb-px-sheet" style="${missingCls ? '' : `background-image:url('${escapeAttr(meta.file)}');background-position:${curFrame * 20}% 0%;`}" role="img" aria-label="${safeLabel}"></div>`;

    return (
      `<div class="cb-px-actor${archCls}${deadCls}${missingCls}"` +
      ` data-actor-key="${escapeAttr(actorKey)}"` +
      ` data-sprite-id="${escapeAttr(meta.id)}"` +
      ` data-pose="${escapeAttr(curPose)}"` +
      ` data-frame="${curFrame}"` +
      ` data-facing="${escapeAttr(meta.facing)}"` +
      ` style="--px-fw:${meta.frameW}px;--px-fh:${meta.frameH}px;--px-sm:${meta.scaleMult};--px-ax:${(meta.anchorX * 100).toFixed(2)}%;--px-ay:${(meta.anchorY * 100).toFixed(2)}%;--px-sw:${meta.shadowW}%;">` +
      `<div class="cb-px-shadow" aria-hidden="true"></div>` +
      `<div class="cb-px-rig">` +
      sheetMarkup +
      `</div>` +
      fallbackMarkup +
      `</div>`
    );
  }

  function applyActorVisual(st) {
    if (!st || !st.el) return;
    const meta = getSpriteMeta(st.spriteId);
    const frame = clamp(st.frame | 0, 0, (meta.frames || 6) - 1);
    const poseName = st.poseOverride || st.pose || 'idle';

    if (st.el.getAttribute('data-frame') !== String(frame)) {
      st.el.setAttribute('data-frame', String(frame));
    }
    if (st.el.getAttribute('data-pose') !== poseName) {
      st.el.setAttribute('data-pose', poseName);
    }
    if (st.sheetEl) {
      if (st.sheetEl.tagName === 'CANVAS') {
        const drawKey = `${st.spriteId}:${frame}`;
        if (st.lastDrawnKey !== drawKey) {
          st.lastDrawnKey = drawKey;
          drawBankFrameOnCanvas(st.sheetEl, st.spriteId, frame);
        }
      } else {
        const posStr = `${frame * 20}% 0%`;
        if (st.sheetEl.style.backgroundPosition !== posStr) {
          st.sheetEl.style.backgroundPosition = posStr;
        }
      }
    }

    const reduced = prefersReducedMotion();
    const floatY = (!reduced && !st.dead && meta.floatAmp > 0)
      ? -Math.sin(st.floatElapsed * 2.5 + st.floatPhase) * meta.floatAmp
      : 0;

    const tx = Math.abs(st.dx) > 0.05 ? st.dx : 0;
    const ty = Math.abs(st.dy) > 0.05 ? st.dy : 0;
    st.el.style.transform = (tx !== 0 || ty !== 0)
      ? `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`
      : '';
    st.el.classList.toggle('is-dashing', Math.abs(tx) > 10);

    if (st.rigEl) {
      const needRig = Math.abs(floatY) > 0.05 || Math.abs(st.sx - 1) > 0.004 || Math.abs(st.sy - 1) > 0.004;
      st.rigEl.style.transform = needRig
        ? `translate3d(0, ${floatY.toFixed(1)}px, 0) scale(${st.sx.toFixed(3)}, ${st.sy.toFixed(3)})`
        : '';
      st.rigEl.classList.toggle('is-hit-flash', st.flashLeft > 0);
    }

    if (st.shadowEl && meta.floatAmp > 0) {
      const liftRatio = clamp(-floatY / 6, -0.5, 1);
      const shScale = (1 - liftRatio * 0.14).toFixed(3);
      st.shadowEl.style.transform = `translate(-50%, -45%) scale(${shScale})`;
    }
  }

  function spawnDashGhost(st, tone) {
    if (!st || !st.el || !st.sheetEl || prefersReducedMotion()) return;
    if (st.el.classList.contains('is-sheet-missing')) return;
    const parent = st.el.parentElement;
    if (!parent) return;
    const meta = getSpriteMeta(st.spriteId);
    const isCanvas = st.sheetEl.tagName === 'CANVAS';
    const ghost = document.createElement(isCanvas ? 'canvas' : 'div');
    ghost.className = `cb-px-ghost tone-${tone || 'ice'}`;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${st.el.offsetWidth || (meta.frameW * 3)}px`;
    ghost.style.height = `${st.el.offsetHeight || (meta.frameH * 3)}px`;
    ghost.style.left = `${st.el.offsetLeft}px`;
    ghost.style.top = `${st.el.offsetTop}px`;
    ghost.style.transform = `translate3d(${st.dx.toFixed(1)}px, ${st.dy.toFixed(1)}px, 0)`;
    if (isCanvas) {
      drawBankFrameOnCanvas(ghost, st.spriteId, st.frame | 0);
    } else {
      ghost.style.backgroundImage = st.sheetEl.style.backgroundImage;
      ghost.style.backgroundPosition = `${(st.frame | 0) * 20}% 0%`;
    }
    parent.appendChild(ghost);
    trackRealTimer(() => {
      if (ghost.parentNode) ghost.remove();
    }, 230);
  }

  /* -------------------- Canvas 2D pixelfx 缓冲管理 -------------------- */
  function ensureVfxCanvas() {
    if (!isEnabled()) return null;
    const field = document.querySelector('#battle-screen .cb-arena-field');
    if (!field) return null;

    let canvas = field.querySelector('#cb-pixel-vfx-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'cb-pixel-vfx-canvas';
      canvas.className = 'cb-pixel-vfx-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      field.appendChild(canvas);
    }

    const rect = field.getBoundingClientRect();
    const w = Math.max(1, rect.width || 960);
    const h = Math.max(1, rect.height || 440);
    const targetW = w < 520 ? 240 : 480;
    const targetH = clamp(Math.round(targetW * (h / w)), 148, 340);

    if (_canvas !== canvas || Math.abs(_bufW - targetW) >= 4 || Math.abs(_bufH - targetH) >= 4) {
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
    return _canvas;
  }

  function getActorCanvasPoints(actorKey, includeDash) {
    ensureVfxCanvas();
    const field = document.querySelector('#battle-screen .cb-arena-field');
    if (!field || !_bufW || !_bufH) {
      const isPlayer = actorKey === 'player';
      const fallbackX = isPlayer ? 110 : 340;
      const fallbackY = 148;
      return {
        anchor: { x: fallbackX, y: fallbackY },
        cast: { x: fallbackX + (isPlayer ? 28 : -28), y: fallbackY - 28 },
        hit: { x: fallbackX, y: fallbackY - 26 },
        head: { x: fallbackX, y: fallbackY - 50 },
        screenX: isPlayer ? 180 : 780,
        screenY: 260,
        fieldW: 960,
        fieldH: 440,
      };
    }

    const fRect = field.getBoundingClientRect();
    const fW = Math.max(1, fRect.width);
    const fH = Math.max(1, fRect.height);
    const scaleX = _bufW / fW;
    const scaleY = _bufH / fH;

    const st = _actors.get(actorKey);
    let el = st && st.el && st.el.isConnected ? st.el : field.querySelector(`.cb-px-actor[data-actor-key="${actorKey}"]`);
    let meta = st ? getSpriteMeta(st.spriteId) : SPRITE_MANIFEST.sylvia_silver;

    if (!el) {
      if (actorKey === 'player') {
        el = document.getElementById('cb-p-portrait');
      } else {
        const idx = Number(String(actorKey).split(':')[1]) || 0;
        el = field.querySelector(`.cb-enemy-card[data-eidx="${idx}"] .cb-e-stage`) ||
          field.querySelector('.cb-enemy-card .cb-e-stage');
      }
    }

    if (!el) {
      const isP = actorKey === 'player';
      return {
        anchor: { x: _bufW * (isP ? 0.2 : 0.72), y: _bufH * 0.74 },
        cast: { x: _bufW * (isP ? 0.27 : 0.65), y: _bufH * 0.54 },
        hit: { x: _bufW * (isP ? 0.2 : 0.72), y: _bufH * 0.56 },
        head: { x: _bufW * (isP ? 0.2 : 0.72), y: _bufH * 0.36 },
        screenX: fW * (isP ? 0.2 : 0.72),
        screenY: fH * 0.65,
        fieldW: fW,
        fieldH: fH,
      };
    }

    const r = el.getBoundingClientRect();
    const dashOffsetX = (!includeDash && st) ? st.dx : 0;
    const dashOffsetY = (!includeDash && st) ? st.dy : 0;
    const baseLeft = (r.left - fRect.left) - dashOffsetX;
    const baseTop = (r.top - fRect.top) - dashOffsetY;
    const rw = Math.max(16, r.width);
    const rh = Math.max(16, r.height);

    const toC = (nx, ny) => ({
      x: (baseLeft + rw * nx) * scaleX,
      y: (baseTop + rh * ny) * scaleY,
    });

    return {
      anchor: toC(meta.anchorX, meta.anchorY),
      cast: toC(meta.castX, meta.castY),
      hit: toC(meta.hitX, meta.hitY),
      head: toC(meta.headX, meta.headY),
      screenX: baseLeft + rw * meta.anchorX,
      screenY: baseTop + rh * meta.anchorY,
      screenW: rw,
      screenH: rh,
      fieldW: fW,
      fieldH: fH,
    };
  }

  /* -------------------- PixelFX 特效调度 -------------------- */
  function spawnFx(fxName, opts, control) {
    if (!isEnabled()) return null;
    const PFX = global.PixelFX;
    if (!PFX || !PFX.FX || !PFX.FX[fxName]) return null;
    ensureVfxCanvas();
    if (!_frame || !_ctx) return null;

    control = control || {};
    const def = PFX.FX[fxName];
    const mergedOpts = Object.assign({ seed: nextSeed() }, opts || {});
    const inst = PFX.createFx(def, mergedOpts);

    // 限制超长循环或持久特效的停留时间，保证回合节奏干脆利落
    const defaultStop = def.meta && def.meta.loop ? 0.65 : Math.min(1.15, (def.meta && def.meta.duration) || 1.0);
    const stopAt = control.stopAt != null ? control.stopAt : defaultStop;

    const entry = {
      name: fxName,
      inst,
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
    const aim = aimOpts(fromPt, toPt);
    const travelSec = Math.max(0.08, (travelMs || 190) / 1000);
    let impacted = false;
    const fxOpts = Object.assign(
      {
        x: fromPt.x,
        y: fromPt.y,
        flip: aim.flip,
        angle: aim.angle,
      },
      opts || {}
    );

    return spawnFx(fxName, fxOpts, {
      stopAt: travelSec + 0.04,
      onUpdate(dt, entry) {
        const p = clamp(entry.elapsed / travelSec, 0, 1);
        const eased = EASE.outCubic(p);
        entry.inst.options.x = lerp(fromPt.x, toPt.x, eased);
        entry.inst.options.y = lerp(fromPt.y, toPt.y, eased);
        if (p >= 1 && !impacted) {
          impacted = true;
          entry.inst.stop();
          entry.stopped = true;
          if (typeof onImpact === 'function') onImpact();
        }
      },
    });
  }

  /* -------------------- 动作编排原子操作 -------------------- */
  function scheduleAction(delayMs, fn) {
    if (!isEnabled()) return;
    if (delayMs <= 0) {
      fn();
      return;
    }
    _scheduled.push({ wait: delayMs / 1000, fn });
    ensureLoopRunning();
  }

  function setActorPoseInternal(actorKey, pose, holdMs, locked) {
    const st = _actors.get(actorKey);
    if (!st) return;
    if (!pose || pose === 'idle') {
      st.poseOverride = null;
      st.pose = 'idle';
      st.poseTimer = 0;
      st.poseLock = false;
      st.frame = st.breathStep ? 1 : 0;
    } else {
      st.poseOverride = pose;
      st.pose = pose;
      st.frame = POSE_TO_FRAME[pose] != null ? POSE_TO_FRAME[pose] : 0;
      st.poseLock = !!locked;
      st.poseTimer = locked ? 0 : Math.max(0.05, (holdMs || 420) / 1000);
    }
    applyActorVisual(st);
  }

  function dashActor(actorKey, toX, toY, durationMs, easeName, withGhosts, ghostTone) {
    const st = _actors.get(actorKey);
    if (!st) return;
    if (prefersReducedMotion()) {
      st.dx = 0;
      st.dy = 0;
      st.dashTween = null;
      applyActorVisual(st);
      return;
    }
    st.dashTween = {
      fromX: st.dx,
      fromY: st.dy,
      toX: Number(toX) || 0,
      toY: Number(toY) || 0,
      elapsed: 0,
      duration: Math.max(0.03, (durationMs || 120) / 1000),
      ease: EASE[easeName] || EASE.outCubic,
      withGhosts: !!withGhosts,
      ghostTone: ghostTone || 'ice',
    };
    st.ghostTimer = 0;
    ensureLoopRunning();
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
  function triggerHitStop(durationMs) {
    if (!isEnabled() || prefersReducedMotion()) return;
    _hitStopId += 1;
    const myId = _hitStopId;
    const dur = clamp(Number(durationMs) || 70, 45, 130);
    _hitStopScale = 0.06;

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
  }

  /* -------------------- 玩家技能全套编排 (21 项技能全覆盖) -------------------- */
  const ICE_PROJECTILE_SKILLS = new Set([
    'hand_ice_crystal',
    'remote_blind_shot',
    'remote_snap_spike',
    'insight_aino_bead',
    'insight_generic_flaw',
  ]);
  const ICE_AOE_GROUND_SKILLS = new Set([
    'hand_thorn_field',
    'hand_frost_floor',
    'insight_beatrice_pillar',
    'insight_alice_cage',
    'insight_noelle_sever',
    'insight_hulan_resonance',
  ]);
  const MELEE_DASH_SKILLS = new Set([
    'basic_attack',
    'sword_water_edge',
    'insight_jackal_throat',
    'insight_eastwing_draft',
    'insight_wind_stillness',
  ]);
  const SWORD_FOOTWORK_SKILLS = new Set([
    'sword_root_step',
    'sword_wind_afterimage',
  ]);
  const SHIELD_GUARD_SKILLS = new Set([
    'hand_root_shield',
    'hand_ice_wall',
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
    if (!isEnabled() || !info) return;
    ensureVfxCanvas();
    ensureLoopRunning();

    const skillId = info.skillId || 'hand_ice_crystal';
    const primaryIdx = info.targetIdx != null ? info.targetIdx : 0;
    const targets = (Array.isArray(info.targetIndices) && info.targetIndices.length)
      ? info.targetIndices
      : [primaryIdx];
    const targetKey = `enemy:${primaryIdx}`;
    const isHeavy = !!(info.didCrit || info.didBreak || info.didRiposte || info.shieldBroken || skillId.startsWith('insight_'));

    const pPts = getActorCanvasPoints('player', false);
    const tPts = getActorCanvasPoints(targetKey, false);

    // 1) 罗文专属看破：双镜合拢夹杖（eclipse + time_stop + parry + ice_shatter）
    if (skillId === 'insight_rowan_prism') {
      setActorPoseInternal('player', 'windup', 160, false);
      squashActor('player', 0.93, 1.08, 160);
      spawnFx('time_stop', { x: _bufW * 0.5, y: _bufH * 0.78, palette: PALETTES.ice }, { stopAt: 0.78 });

      scheduleAction(140, () => {
        setActorPoseInternal('player', 'strike', 340, false);
        dashActor('player', 16, 0, 110, 'outQuad', true, 'ice');
        spawnFx('eclipse', { x: tPts.hit.x, y: tPts.hit.y, palette: PALETTES.eclipse }, { stopAt: 0.85 });
        spawnFx('parry', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.72 });
        spawnFx('ice_shatter', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.85 });
        triggerHitReaction(targetKey, 16, true);
        triggerHitStop(90);
        triggerTrauma(0.76);
      });
      scheduleAction(420, () => dashActor('player', 0, 0, 210, 'outCubic', false));
      return;
    }

    // 2) 冰晶投射 / 侧翼瞬凝精准打击
    if (ICE_PROJECTILE_SKILLS.has(skillId)) {
      const isRemote = skillId.startsWith('remote_') || skillId === 'insight_aino_bead';
      setActorPoseInternal('player', 'windup', 150, false);
      squashActor('player', 0.94, 1.07, 150);
      spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.52 });
      if (info.usedWand) {
        spawnFx('eclipse', { x: pPts.cast.x, y: pPts.cast.y, palette: PALETTES.eclipse }, { stopAt: 0.55 });
      }

      scheduleAction(140, () => {
        setActorPoseInternal('player', 'strike', 300, false);
        squashActor('player', 1.08, 0.94, 170);
        dashActor('player', 12, 0, 95, 'outQuad', false);

        const launchFrom = isRemote
          ? { x: lerp(pPts.cast.x, tPts.hit.x, 0.45), y: tPts.hit.y - 16 }
          : pPts.cast;
        const travelMs = isRemote ? 145 : 190;

        spawnProjectile('ice_lance', launchFrom, tPts.hit, { palette: PALETTES.ice, length: 46 }, travelMs, () => {
          if (info.missed) {
            spawnFx('snowflake_burst', { x: tPts.hit.x, y: tPts.anchor.y, count: 5, palette: PALETTES.ice }, { stopAt: 0.55 });
            return;
          }
          triggerHitReaction(targetKey, isHeavy ? 16 : 10, isHeavy);
          spawnFx('ice_shatter', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.78 });
          spawnFx('hit_spark', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.48 });
          if (isHeavy) {
            spawnFx('crit_hit', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.75 });
            spawnFx('snowflake_burst', { x: tPts.anchor.x, y: tPts.anchor.y, count: 7, palette: PALETTES.ice }, { stopAt: 0.8 });
            triggerHitStop(85);
            triggerTrauma(0.72);
          } else {
            triggerHitStop(55);
            triggerTrauma(0.36);
          }
        });
      });
      scheduleAction(360, () => dashActor('player', 0, 0, 180, 'outCubic', false));
      return;
    }

    // 3) 冰系群体 / 地脉控场（冰棘群刺阵、蔓地薄冰、封肩地下冰柱、十字冰栏、冻彻断流、伊诺共鸣）
    if (ICE_AOE_GROUND_SKILLS.has(skillId)) {
      const isSetupOnly = skillId === 'hand_frost_floor';
      const hitList = skillId === 'hand_thorn_field' || isSetupOnly
        ? getLivingEnemyIndices(battleState, primaryIdx)
        : targets;

      setActorPoseInternal('player', 'windup', 160, false);
      squashActor('player', 0.93, 1.08, 150);
      spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.62 });

      scheduleAction(145, () => {
        setActorPoseInternal('player', 'strike', 360, false);
        squashActor('player', 1.1, 0.92, 180);

        const firstPts = getActorCanvasPoints(`enemy:${hitList[0] || 0}`, false);
        spawnFx('frost_nova', { x: firstPts.anchor.x, y: firstPts.anchor.y, reach: isSetupOnly ? 68 : 96, palette: PALETTES.ice }, { stopAt: 0.85 });

        hitList.forEach((eIdx, order) => {
          scheduleAction(order * 48, () => {
            const eKey = `enemy:${eIdx}`;
            const ePts = getActorCanvasPoints(eKey, false);
            spawnFx('ice_spikes', {
              x: ePts.anchor.x - 26,
              y: ePts.anchor.y,
              reach: 62,
              height: isSetupOnly ? 30 : 54,
              palette: PALETTES.ice,
            }, { stopAt: 0.85 });
            spawnFx('snowflake_burst', { x: ePts.anchor.x, y: ePts.anchor.y, count: 6, palette: PALETTES.ice }, { stopAt: 0.78 });

            if (!isSetupOnly) {
              if (skillId === 'hand_thorn_field' || skillId === 'insight_hulan_resonance' || skillId === 'insight_alice_cage') {
                spawnFx('icicle_fall', { x: ePts.anchor.x, y: ePts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.88 });
              }
              triggerHitReaction(eKey, isHeavy ? 15 : 10, isHeavy);
              if (order === 0) {
                if (isHeavy) {
                  spawnFx('crit_hit', { x: ePts.anchor.x, y: ePts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.72 });
                }
                triggerHitStop(isHeavy ? 88 : 65);
                triggerTrauma(isHeavy ? 0.78 : 0.48);
              }
            }
          });
        });
      });
      return;
    }

    // 4) 水系魔法（覆潮水弹 / 折射水幕）
    if (skillId === 'hand_water_surge') {
      setActorPoseInternal('player', 'windup', 145, false);
      spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.5 });

      scheduleAction(130, () => {
        setActorPoseInternal('player', 'strike', 330, false);
        const dist = clamp(Math.hypot(tPts.hit.x - pPts.cast.x, tPts.hit.y - pPts.cast.y), 70, 260);
        const aim = aimOpts(pPts.cast, tPts.hit);
        spawnFx('water_jet', {
          x: pPts.cast.x,
          y: pPts.cast.y,
          length: dist,
          flip: aim.flip,
          angle: aim.angle,
          palette: PALETTES.water,
        }, { stopAt: 0.34 });

        scheduleAction(125, () => {
          triggerHitReaction(targetKey, isHeavy ? 15 : 11, isHeavy);
          spawnFx('wave_crash', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.82 });
          spawnFx('splash', { x: tPts.anchor.x, y: tPts.anchor.y, stone: false, palette: PALETTES.water }, { stopAt: 0.72 });
          if (isHeavy) {
            spawnFx('crit_hit', { x: tPts.anchor.x, y: tPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.7 });
          }
          triggerHitStop(isHeavy ? 80 : 60);
          triggerTrauma(isHeavy ? 0.68 : 0.38);
        });
      });
      return;
    }

    if (skillId === 'hand_water_veil') {
      setActorPoseInternal('player', 'windup', 120, false);
      scheduleAction(110, () => {
        setActorPoseInternal('player', 'strike', 300, false);
        squashActor('player', 1.08, 0.94, 200);
        spawnFx('splash', { x: pPts.anchor.x, y: pPts.anchor.y, stone: false, palette: PALETTES.water }, { stopAt: 0.75 });
        spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 30, palette: PALETTES.water }, { stopAt: 0.92 });
      });
      return;
    }

    // 5) 护盾与立障（钢冰生根盾 / 凝水厚冰墙）
    if (SHIELD_GUARD_SKILLS.has(skillId)) {
      setActorPoseInternal('player', 'windup', 120, false);
      squashActor('player', 1.06, 0.94, 130);
      scheduleAction(110, () => {
        setActorPoseInternal('player', 'strike', 320, false);
        squashActor('player', 0.94, 1.08, 220);
        spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 32, palette: PALETTES.ice }, { stopAt: 1.02 });
        spawnFx('ice_crystal', { x: pPts.anchor.x, y: pPts.anchor.y, height: 38, palette: PALETTES.ice }, { stopAt: 0.96 });
      });
      return;
    }

    // 6) 霁馆步法 / 风行残像（侧滑与残影蓄势）
    if (SWORD_FOOTWORK_SKILLS.has(skillId)) {
      const isWind = skillId === 'sword_wind_afterimage';
      setActorPoseInternal('player', 'windup', 120, false);
      dashActor('player', -12, 0, 85, 'inQuad', false);
      scheduleAction(95, () => {
        setActorPoseInternal('player', 'strike', 260, false);
        dashActor('player', 34, 0, 110, 'outCubic', true, isWind ? 'wind' : 'ice');
        if (isWind) {
          spawnFx('blizzard_vortex', { x: pPts.anchor.x, y: pPts.anchor.y, height: 56, palette: PALETTES.wind }, { stopAt: 0.72 });
        } else {
          spawnFx('parry', { x: pPts.anchor.x + 10, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.65 });
          spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 28, palette: PALETTES.ice }, { stopAt: 0.7 });
        }
      });
      scheduleAction(270, () => dashActor('player', 0, 0, 180, 'outCubic', true, isWind ? 'wind' : 'ice'));
      return;
    }

    // 7) 剑术冲刺突斩（平斩、送刀覆水极薄冰锋、看破封喉/回风/穿心）
    if (MELEE_DASH_SKILLS.has(skillId) || true) {
      const rawDist = tPts.screenX - pPts.screenX - 96;
      const dashDist = clamp(rawDist, 54, Math.min(390, Math.max(90, pPts.fieldW * 0.42)));
      const useDouble = !!(isHeavy || skillId !== 'basic_attack');
      const slashPal = skillId === 'insight_wind_stillness' ? PALETTES.wind : PALETTES.swordIce;

      // 0ms: 蓄力收腰
      setActorPoseInternal('player', 'windup', 110, false);
      squashActor('player', 1.1, 0.92, 100);
      dashActor('player', -14, 0, 85, 'inQuad', false);

      // 90ms: 爆发前冲 + 青色残影
      scheduleAction(90, () => {
        dashActor('player', dashDist, 0, 105, 'outQuart', true, 'ice');
      });

      // 185ms: 挥剑斩击 + 顿帧 + 击退
      scheduleAction(185, () => {
        setActorPoseInternal('player', 'strike', 240, false);
        squashActor('player', 1.12, 0.9, 170);

        const slashX = tPts.anchor.x - 32;
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

      // 420ms: 轻盈回弹归位
      scheduleAction(420, () => {
        dashActor('player', 0, 0, 210, 'outCubic', false);
      });
    }
  }

  /* -------------------- 敌方回合动作全套编排 -------------------- */
  function playEnemyAction(battleState, info) {
    if (!isEnabled() || !info) return;
    ensureVfxCanvas();
    ensureLoopRunning();

    const eIdx = info.enemyIdx != null ? info.enemyIdx : 0;
    const eKey = `enemy:${eIdx}`;
    const spriteId = info.spriteId || resolveEnemySpriteId(info.enemy);
    const ePts = getActorCanvasPoints(eKey, false);
    const pPts = getActorCanvasPoints('player', false);
    const intent = info.intent || {};
    const heavy = !!(intent.shatterPlayerShield || (intent.dmg && intent.dmg >= 55) || (info.hpLoss && info.hpLoss >= 45));

    const applyPlayerImpact = () => {
      if (info.parried) {
        // 玩家生根步卸力反斩！
        setActorPoseInternal('player', 'strike', 260, false);
        dashActor('player', 24, 0, 90, 'outQuad', true, 'ice');
        spawnFx('parry', { x: pPts.anchor.x + 12, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.68 });
        spawnFx('sword_slash', { x: ePts.anchor.x - 30, y: ePts.anchor.y, palette: PALETTES.swordIce, sparks: PALETTES.swordSparks }, { stopAt: 0.65 });
        triggerHitReaction(eKey, 16, true);
        triggerHitStop(85);
        triggerTrauma(0.62);
        scheduleAction(230, () => dashActor('player', 0, 0, 170, 'outCubic', false));
        return;
      }
      if (info.evaded) {
        // 风行残像闪避
        dashActor('player', -24, 0, 95, 'outQuad', true, 'wind');
        spawnFx('parry', { x: pPts.anchor.x + 10, y: pPts.anchor.y, palette: PALETTES.wind }, { stopAt: 0.55 });
        scheduleAction(200, () => dashActor('player', 0, 0, 170, 'outCubic', false));
        return;
      }
      if (info.blocked) {
        // 护盾格挡
        setActorPoseInternal('player', 'windup', 220, false);
        squashActor('player', 1.08, 0.94, 180);
        spawnFx('parry', { x: pPts.anchor.x + 14, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.62 });
        spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 28, palette: PALETTES.ice }, { stopAt: 0.48 });
        triggerTrauma(0.22);
        return;
      }
      // 玩家真实受击
      triggerHitReaction('player', heavy ? -16 : -10, heavy);
      spawnFx('hit_spark', { x: pPts.anchor.x, y: pPts.anchor.y, flip: true }, { stopAt: 0.45 });
      if (heavy) {
        triggerHitStop(65);
        triggerTrauma(0.62);
      } else {
        triggerTrauma(0.3);
      }
    };

    // 0ms: 敌方蓄力后拉
    setActorPoseInternal(eKey, 'windup', 120, false);
    squashActor(eKey, 1.08, 0.93, 110);
    dashActor(eKey, 12, 0, 90, 'inQuad', false);

    // A) 烈焰系：贝阿特丽丝 / 东翼统领 / 宫廷封锁官
    if (spriteId === 'beatrice' || spriteId === 'eastwing_commander' || spriteId === 'corridor_vanguard') {
      const isMelee = intent.stance === 'CLOSE_LUNGE' || intent.stance === 'GUARD_COUNTER';
      scheduleAction(105, () => {
        setActorPoseInternal(eKey, 'strike', 290, false);
        if (isMelee) {
          const dashLeft = -clamp(ePts.screenX - pPts.screenX - 104, 48, 320);
          dashActor(eKey, dashLeft, 0, 110, 'outQuart', true, 'fire');
          scheduleAction(105, () => {
            spawnFx('heavy_cleave', { x: pPts.anchor.x + 28, y: pPts.anchor.y, flip: true, palette: PALETTES.fire }, { stopAt: 0.78 });
            applyPlayerImpact();
          });
          scheduleAction(330, () => dashActor(eKey, 0, 0, 200, 'outCubic', false));
        } else {
          dashActor(eKey, -12, 0, 90, 'outQuad', false);
          spawnProjectile('fireball', ePts.cast, pPts.hit, { palette: PALETTES.fire, radius: 6 }, 185, () => {
            spawnFx(heavy ? 'flame_pillar' : 'fire_ring', { x: pPts.anchor.x, y: pPts.anchor.y, height: 112, reach: 76, palette: PALETTES.fire }, { stopAt: 0.85 });
            applyPlayerImpact();
          });
          scheduleAction(280, () => dashActor(eKey, 0, 0, 180, 'outCubic', false));
        }
      });
      return;
    }

    // B) 罗文：晦轮月影与暗影触须
    if (spriteId === 'rowan') {
      scheduleAction(110, () => {
        setActorPoseInternal(eKey, 'strike', 320, false);
        dashActor(eKey, -16, 0, 100, 'outQuad', false);
        spawnFx('eclipse', { x: pPts.hit.x, y: pPts.hit.y, palette: PALETTES.eclipse }, { stopAt: 0.88 });
        scheduleAction(95, () => {
          spawnFx('shadow_tendrils', { x: pPts.anchor.x, y: pPts.anchor.y, flip: true, palette: PALETTES.eclipse }, { stopAt: 0.85 });
          applyPlayerImpact();
        });
        scheduleAction(310, () => dashActor(eKey, 0, 0, 180, 'outCubic', false));
      });
      return;
    }

    // C) 爱丽丝 / 风神化身：青岚旋风 + 疾风双斩
    if (spriteId === 'alice' || spriteId === 'wind_god_avatar') {
      scheduleAction(100, () => {
        setActorPoseInternal(eKey, 'strike', 300, false);
        const dashLeft = -clamp(ePts.screenX - pPts.screenX - 108, 44, 300);
        dashActor(eKey, dashLeft, 0, 105, 'outQuart', true, 'wind');
        scheduleAction(95, () => {
          spawnFx('blizzard_vortex', { x: pPts.anchor.x, y: pPts.anchor.y, height: 74, palette: PALETTES.wind }, { stopAt: 0.82 });
          spawnFx('double_slash', { x: pPts.anchor.x + 28, y: pPts.anchor.y, flip: true, palette: PALETTES.wind, sparks: PALETTES.swordSparks }, { stopAt: 0.72 });
          applyPlayerImpact();
        });
        scheduleAction(330, () => dashActor(eKey, 0, 0, 195, 'outCubic', false));
      });
      return;
    }

    // D) 艾诺：无气泡极寒冰枪 + 地棘
    if (spriteId === 'aino') {
      scheduleAction(110, () => {
        setActorPoseInternal(eKey, 'strike', 300, false);
        dashActor(eKey, -12, 0, 90, 'outQuad', false);
        spawnProjectile('ice_lance', ePts.cast, pPts.hit, { palette: PALETTES.ice, length: 46 }, 180, () => {
          spawnFx('ice_spikes', { x: pPts.anchor.x + 24, y: pPts.anchor.y, reach: 62, height: 48, flip: true, palette: PALETTES.ice }, { stopAt: 0.8 });
          applyPlayerImpact();
        });
        scheduleAction(290, () => dashActor(eKey, 0, 0, 180, 'outCubic', false));
      });
      return;
    }

    // E) 诺艾儿：高压水箭 + 浪涛拍岸
    if (spriteId === 'noelle') {
      scheduleAction(110, () => {
        setActorPoseInternal(eKey, 'strike', 310, false);
        dashActor(eKey, -12, 0, 90, 'outQuad', false);
        const dist = clamp(Math.hypot(pPts.hit.x - ePts.cast.x, pPts.hit.y - ePts.cast.y), 70, 260);
        const aim = aimOpts(ePts.cast, pPts.hit);
        spawnFx('water_jet', { x: ePts.cast.x, y: ePts.cast.y, length: dist, flip: aim.flip, angle: aim.angle, palette: PALETTES.water }, { stopAt: 0.36 });
        scheduleAction(120, () => {
          spawnFx('wave_crash', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.water }, { stopAt: 0.82 });
          applyPlayerImpact();
        });
        scheduleAction(290, () => dashActor(eKey, 0, 0, 180, 'outCubic', false));
      });
      return;
    }

    // F) 魔兽系：灰棘头狼 / 灰棘狼 / 霜脊影豺 / 霜渊裂地兽领主（前扑利爪 / 裂地重震）
    const isSlam = spriteId === 'abyss_behemoth' || intent.shatterPlayerShield || intent.stance === 'HEAVY_WINDUP';
    scheduleAction(95, () => {
      const dashLeft = -clamp(ePts.screenX - pPts.screenX - 102, 52, 330);
      dashActor(eKey, dashLeft, 0, 105, 'outQuart', true, 'claw');
      scheduleAction(100, () => {
        setActorPoseInternal(eKey, 'strike', 240, false);
        squashActor(eKey, 1.14, 0.88, 170);
        if (isSlam) {
          spawnFx('ground_slam', { x: pPts.anchor.x, y: pPts.anchor.y, reach: 88, palette: spriteId === 'abyss_behemoth' ? PALETTES.ice : undefined }, { stopAt: 0.86 });
        }
        spawnFx('claw_swipe', { x: pPts.anchor.x + 28, y: pPts.anchor.y, flip: true, palette: PALETTES.claw }, { stopAt: 0.68 });
        applyPlayerImpact();
      });
      scheduleAction(330, () => dashActor(eKey, 0, 0, 200, 'outCubic', false));
    });
  }

  function playEnemySequence(battleState, actions) {
    if (!isEnabled() || !Array.isArray(actions) || !actions.length) return;
    actions.forEach((act, idx) => {
      scheduleAction(idx * 230, () => playEnemyAction(battleState, act));
    });
  }

  /* -------------------- 特殊演出：晦轮杖 / 冰晶宫殿时停 / 艾诺崖顶冰枪 / 心念援护 -------------------- */
  function playWandToggle() {
    if (!isEnabled()) return;
    ensureVfxCanvas();
    const pPts = getActorCanvasPoints('player', false);
    setActorPoseInternal('player', 'windup', 140, false);
    scheduleAction(120, () => {
      setActorPoseInternal('player', 'strike', 300, false);
      spawnFx('eclipse', { x: pPts.hit.x, y: pPts.hit.y, palette: PALETTES.eclipse }, { stopAt: 0.88 });
      spawnFx('time_stop', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.eclipse }, { stopAt: 0.72 });
      triggerTrauma(0.28);
    });
  }

  function playPalaceTimeStop() {
    if (!isEnabled()) return;
    ensureVfxCanvas();
    ensureLoopRunning();
    spawnFx('time_stop', { x: _bufW * 0.5, y: _bufH * 0.76, palette: PALETTES.ice }, { stopAt: 1.12 });
    spawnFx('snowflake_burst', { x: _bufW * 0.5, y: _bufH * 0.76, count: 11, palette: PALETTES.ice }, { stopAt: 1.05 });
  }

  function playAinoSpearSupport(enemyIdx) {
    if (!isEnabled()) return;
    ensureVfxCanvas();
    const eKey = `enemy:${enemyIdx != null ? enemyIdx : 0}`;
    const tPts = getActorCanvasPoints(eKey, false);
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
    const pPts = getActorCanvasPoints('player', false);
    setActorPoseInternal('player', 'strike', 300, false);
    if (charId === 'alice') {
      spawnFx('blizzard_vortex', { x: pPts.anchor.x, y: pPts.anchor.y, height: 68, palette: PALETTES.wind }, { stopAt: 0.9 });
    } else if (charId === 'charlotte') {
      spawnFx('divine_shield', { x: pPts.anchor.x, y: pPts.anchor.y, radius: 34, palette: PALETTES.ice }, { stopAt: 1.05 });
    } else if (charId === 'jilan') {
      spawnFx('double_slash', { x: pPts.anchor.x + 18, y: pPts.anchor.y, palette: PALETTES.swordIce, sparks: PALETTES.swordSparks }, { stopAt: 0.78 });
    } else {
      spawnFx('magic_circle_cast', { x: pPts.anchor.x, y: pPts.anchor.y, palette: PALETTES.ice }, { stopAt: 0.8 });
      spawnFx('snowflake_burst', { x: pPts.anchor.x, y: pPts.anchor.y, count: 8, palette: PALETTES.ice }, { stopAt: 0.85 });
    }
  }

  /* -------------------- 舞台 DOM 同步与统一单 RAF 主循环 -------------------- */
  function syncStage(battleState) {
    if (!isEnabled()) return;
    _lastBattleRef = battleState || _lastBattleRef;
    const bs = document.getElementById('battle-screen');
    if (!bs || bs.classList.contains('hidden')) return;

    ensureVfxCanvas();

    const seenKeys = new Set();
    bs.querySelectorAll('.cb-px-actor[data-actor-key]').forEach(el => {
      const key = el.getAttribute('data-actor-key');
      const spriteId = el.getAttribute('data-sprite-id') || 'sylvia_silver';
      seenKeys.add(key);
      const st = getOrCreateActor(key, spriteId);
      st.el = el;
      st.rigEl = el.querySelector('.cb-px-rig');
      st.sheetEl = el.querySelector('.cb-px-sheet');
      st.shadowEl = el.querySelector('.cb-px-shadow');
      st.dead = el.classList.contains('is-dead');
      applyActorVisual(st);
    });

    // 移除已离开当前波次的旧敌人状态
    Array.from(_actors.keys()).forEach(k => {
      if (!seenKeys.has(k)) _actors.delete(k);
    });

    ensureLoopRunning();
  }

  function ensureLoopRunning() {
    if (!isEnabled() || _rafId) return;
    if (typeof global.requestAnimationFrame !== 'function') return;
    _lastRafTs = 0;
    _rafId = global.requestAnimationFrame(tick);
  }

  function tick(ts) {
    _rafId = 0;
    if (!isEnabled()) return;

    const bs = document.getElementById('battle-screen');
    if (!bs || bs.classList.contains('hidden')) {
      return;
    }

    if (document.hidden) {
      _lastRafTs = 0;
      _rafId = global.requestAnimationFrame(tick);
      return;
    }

    const now = typeof ts === 'number' ? ts : Date.now();
    const realDt = _lastRafTs > 0 ? clamp((now - _lastRafTs) / 1000, 0.001, 0.05) : 0.016;
    _lastRafTs = now;
    const simDt = realDt * _hitStopScale;
    const reduced = prefersReducedMotion();

    // 1) 推进编排事件队列
    for (let i = _scheduled.length - 1; i >= 0; i--) {
      const item = _scheduled[i];
      item.wait -= simDt;
      if (item.wait <= 0) {
        _scheduled.splice(i, 1);
        try { item.fn(); } catch (e) {}
      }
    }

    // 2) 更新每个角色 6 帧状态机 + 平滑缓动位移/挤压
    _actors.forEach(st => {
      if (!st.el || !st.el.isConnected) return;
      const meta = getSpriteMeta(st.spriteId);

      // 呼吸与浮空计时
      st.floatElapsed += simDt;

      // 命中闪白衰减（实时时钟，避免卡在过曝）
      if (st.flashLeft > 0) {
        st.flashLeft = Math.max(0, st.flashLeft - realDt);
      }

      // 位移缓动（冲刺/击退/回弹）
      if (st.dashTween) {
        const tw = st.dashTween;
        tw.elapsed += simDt;
        const p = clamp(tw.elapsed / tw.duration, 0, 1);
        const k = tw.ease(p);
        st.dx = lerp(tw.fromX, tw.toX, k);
        st.dy = lerp(tw.fromY, tw.toY, k);
        if (tw.withGhosts && p > 0.08 && p < 0.92) {
          st.ghostTimer += simDt;
          if (st.ghostTimer >= 0.032) {
            st.ghostTimer = 0;
            spawnDashGhost(st, tw.ghostTone);
          }
        }
        if (p >= 1) {
          st.dx = tw.toX;
          st.dy = tw.toY;
          st.dashTween = null;
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

      // 姿势帧选择
      if (st.poseOverride) {
        if (!st.poseLock) {
          st.poseTimer -= simDt;
          if (st.poseTimer <= 0) {
            st.poseOverride = null;
            st.pose = 'idle';
          }
        }
      }

      if (!st.poseOverride) {
        if (st.dead) {
          st.pose = 'hurt';
          st.frame = 5;
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
            st.frame = 2;
          } else {
            st.blinkCooldown -= simDt;
            if (st.blinkCooldown <= 0) {
              st.blinkLeft = 0.13;
              st.blinkCooldown = 3.2 + Math.random() * 1.6;
              st.pose = 'blink';
              st.frame = 2;
            } else {
              st.pose = 'idle';
              st.frame = st.breathStep ? 1 : 0;
            }
          }
        }
      } else {
        st.frame = POSE_TO_FRAME[st.poseOverride] != null ? POSE_TO_FRAME[st.poseOverride] : 0;
      }

      // 避免帧号越界
      if (st.frame >= (meta.frames || 6)) st.frame = 0;
      applyActorVisual(st);
    });

    // 3) 渲染全舞台 pixelfx 透明合成帧（空载时零像素开销）
    const PFX = global.PixelFX;
    if (_activeEffects.length > 0 && PFX && _frame && _ctx && _imgData) {
      for (let i = _activeEffects.length - 1; i >= 0; i--) {
        const entry = _activeEffects[i];
        entry.elapsed += simDt;
        if (!entry.stopped && entry.stopAt > 0 && entry.elapsed >= entry.stopAt) {
          entry.stopped = true;
          entry.inst.stop();
        }
        entry.inst.update(simDt);
        if (entry.onUpdate) {
          try { entry.onUpdate(simDt, entry); } catch (e) {}
        }
        if (entry.inst.done()) {
          _activeEffects.splice(i, 1);
          if (entry.onDone) {
            try { entry.onDone(); } catch (e) {}
          }
        }
      }

      PFX.clearFrame(_frame);
      for (let i = 0; i < _activeEffects.length; i++) {
        _activeEffects[i].inst.draw(_frame, 'back');
      }
      for (let i = 0; i < _activeEffects.length; i++) {
        _activeEffects[i].inst.draw(_frame, 'front');
      }
      PFX.composite(_frame, _imgData.data, null, 1.0);
      _ctx.putImageData(_imgData, 0, 0);
      _canvasDirty = true;
    } else if (_canvasDirty && _ctx && _canvas) {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      _canvasDirty = false;
    }

    _rafId = global.requestAnimationFrame(tick);
  }

  /* -------------------- 清理重置 -------------------- */
  function clearEffects() {
    _scheduled.length = 0;
    _activeEffects.length = 0;
    _hitStopId += 1;
    _hitStopScale = 1.0;
    if (_hitStopTimer) {
      clearTimeout(_hitStopTimer);
      _hitStopTimer = null;
    }
    if (_ctx && _canvas) {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    }
    _canvasDirty = false;
    if (typeof document !== 'undefined') {
      const field = document.querySelector('#battle-screen .cb-arena-field');
      if (field) field.classList.remove('cb-hitstop-75');
      document.querySelectorAll('#battle-screen .cb-px-ghost').forEach(el => el.remove());
    }
  }

  function cleanup() {
    if (_rafId && typeof global.cancelAnimationFrame === 'function') {
      global.cancelAnimationFrame(_rafId);
    }
    _rafId = 0;
    _lastRafTs = 0;
    clearEffects();
    _rawTimers.forEach(tid => clearTimeout(tid));
    _rawTimers.clear();
    _actors.forEach(st => {
      st.dx = 0;
      st.dy = 0;
      st.sx = 1;
      st.sy = 1;
      st.dashTween = null;
      st.squashTween = null;
      st.flashLeft = 0;
      st.poseOverride = null;
      st.poseLock = false;
      applyActorVisual(st);
    });
    _actors.clear();
  }

  /* -------------------- QA 实时触发与单帧检查 API -------------------- */
  function demoSkill(skillId, enemyIdx) {
    if (!isEnabled()) return false;
    const b = _lastBattleRef || (global.CombatEngine && global.CombatEngine.getState ? global.CombatEngine.getState() : null);
    syncStage(b);
    const idx = enemyIdx != null ? enemyIdx : (b && b.targetIdx ? b.targetIdx : 0);
    const sid = skillId || 'hand_ice_crystal';
    const isAoe = sid === 'hand_thorn_field' || sid === 'hand_frost_floor';
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
    const b = _lastBattleRef || (global.CombatEngine && global.CombatEngine.getState ? global.CombatEngine.getState() : null);
    syncStage(b);
    const idx = enemyIdx != null ? enemyIdx : 0;
    const enemy = b && b.enemies && b.enemies[idx] ? b.enemies[idx] : null;
    const actorEl = document.querySelector(`#battle-screen .cb-px-actor[data-actor-key="enemy:${idx}"]`);
    const spriteId = (actorEl && actorEl.getAttribute('data-sprite-id')) || resolveEnemySpriteId(enemy);
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
    const key = side === 'player' ? 'player' : `enemy:${idx != null ? idx : 0}`;
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
        sx: Math.round(st.sx * 100) / 100,
      };
    });
    return {
      enabled: isEnabled(),
      canvasW: _bufW,
      canvasH: _bufH,
      activeEffects: _activeEffects.map(e => e.name),
      activeEffectsCount: _activeEffects.length,
      scheduledCount: _scheduled.length,
      timeScale: _hitStopScale,
      hitStopId: _hitStopId,
      actors: actorSummary,
    };
  }

  /* -------------------- 监听窗口尺寸变化与页签切换 -------------------- */
  if (typeof window !== 'undefined' && !isJsdomEnv()) {
    window.addEventListener('resize', () => {
      const bs = document.getElementById('battle-screen');
      if (bs && !bs.classList.contains('hidden')) {
        ensureVfxCanvas();
      }
    });
    document.addEventListener('visibilitychange', () => {
      _lastRafTs = 0;
    });
  }

  global.CombatPixelVFX = {
    SPRITE_MANIFEST,
    ENEMY_SPRITE_ALIAS,
    PALETTES,
    isEnabled,
    getSpriteMeta,
    resolvePlayerSpriteId,
    resolveEnemySpriteId,
    renderActorMarkup,
    syncStage,
    playSkillAction,
    playEnemyAction,
    playEnemySequence,
    playWandToggle,
    playPalaceTimeStop,
    playAinoSpearSupport,
    playBondAssist,
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
})(typeof window !== 'undefined' ? window : globalThis);
