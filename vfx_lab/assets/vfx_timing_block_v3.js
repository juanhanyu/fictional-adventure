/* =========================================================================
   《转生千金》新版战斗交互手感特效模块 V3
   (/tmp/vfx_r2/vfx_timing_block_v3.js)
   导出：window.VfxTimingBlockV3（零外部依赖、自包含浏览器 IIFE）

   核心三大模块（严格遵循 3 条极简硬规则）：
   1. 切角八角/菱形冰晶棱镜缩圈 × 随机左手键四档（Bad/Good/Great/Perfect）
      × 三阶魔力增幅视觉与速度共振（0% 760ms / 20% 660ms / 40% 580ms / 60% 500ms）
      支持真实键盘 Q/W/E/A/S/D 与单拍/多拍连击（冰晶术 1 拍 / 三棱冰晶 3 拍 / 星霜散华 4 拍）
   2. 空格等阶差格挡弹反（Space 实操，等阶差线性相加公式：无人工封顶、无人工保底）：
      高于敌 d 阶 ×(1 + 0.12×d) / 同阶基准 [0/8/18/30%] / 低于敌 |d| 阶 ×max(0, 1 - 0.10×|d|)
      +6 ×1.72 最高51.6% / +2 ×1.24 最高37.2% / 0 同阶 30.0% / -2 ×0.80 最高24.0% / -4 高打神 18.0% / -6 初打神 12.0%
   3. 第 5 线剑技 & 风行残像高精像素特效：
      - basic_attack（1 拍干脆寒光斩）
      - sword_send_slash（卷三「送刀斩」2 拍覆水极薄冰锋弧斩 + 化水散雾）
      - wind_afterimage（「风行残像」3 重渐隐冰青风影残像 + 疾风螺旋环）
   ========================================================================= */
(function (root) {
  'use strict';

  var VERSION = '3.1.0';

  /* ==================== 0. 视觉色板与数学常量（与主工程雪瓷蓝宝石 100% 同源） ==================== */
  var PALETTE = {
    inkAbyss: '#081A54',
    inkDeep: '#0E2B78',
    inkText: '#1A2436',
    sapphireMid: '#103FA8',
    sapphire: '#1658EB',
    sapphireHi: '#2E77F8',
    iceBlue: '#3898F0',
    iceCyan: '#6BC5F8',
    icePrism: '#7DD3FC',
    icePale: '#B8E8FF',
    iceSnow: '#E4F7FF',
    white: '#FFFFFF',
    goldDeep: '#B8893A',
    goldChampagne: '#C4A46C',
    goldMid: '#E8C574',
    goldBright: '#FDE68A',
    goldCore: '#FFFBEB',
    slateDark: '#3A4B66',
    slateMid: '#64768E',
    slateLight: '#9FB0C4',
    waterAbyss: '#0E366D',
    waterDeep: '#165AA6',
    waterMid: '#2183D2',
    waterHi: '#3EB4EF',
    waterFoam: '#86DCFA',
    waterMist: '#D0F4FF',
    windAbyss: '#0A2422',
    windDeep: '#124640',
    windMid: '#1C7266',
    windTeal: '#2CA490',
    windBright: '#58D4BC',
    windPale: '#9CF2DF',
    windMist: '#D8FFF4',
    crimsonWarn: '#E2401F',
    amberWarn: '#FF9E3D',
    violetWarn: '#8B5CF6'
  };

  var KEY_POOL = ['Q', 'W', 'E', 'A', 'S', 'D'];

  // 三阶魔力增幅 × 缩圈时长 & Perfect 增伤唯一事实源
  var OVERCAST_TIERS = [
    {
      tier: 0,
      pct: 0,
      durationMs: 760,
      perfectBonus: 0.25,
      name: '常规施法',
      shortLabel: '0%',
      ringStyle: 'clear_cyan'
    },
    {
      tier: 1,
      pct: 20,
      durationMs: 660,
      perfectBonus: 0.30,
      name: '★一阶·魔力盈溢',
      shortLabel: '20% ★',
      ringStyle: 'ice_refract'
    },
    {
      tier: 2,
      pct: 40,
      durationMs: 580,
      perfectBonus: 0.35,
      name: '★★二阶·极寒过载',
      shortLabel: '40% ★★',
      ringStyle: 'royal_dual_cross'
    },
    {
      tier: 3,
      pct: 60,
      durationMs: 500,
      perfectBonus: 0.40,
      name: '★★★三阶·星霜极限',
      shortLabel: '60% ★★★',
      ringStyle: 'gold_triple_arc'
    }
  ];

  // 四档即时判定基础定义（Perfect 增幅按三阶魔力增幅动态取 +25%/+30%/+35%/+40%）
  var TIMING_GRADES = {
    bad: {
      id: 'bad',
      label: 'BAD',
      bonus: -0.15,
      mult: 0.85,
      hitStopMs: 0,
      shake: 1.5
    },
    good: {
      id: 'good',
      label: 'GOOD',
      bonus: 0.00,
      mult: 1.00,
      hitStopMs: 0,
      shake: 1.2
    },
    great: {
      id: 'great',
      label: 'GREAT',
      bonus: 0.12,
      mult: 1.12,
      hitStopMs: 0,
      shake: 2.6
    },
    perfect: {
      id: 'perfect',
      label: 'PERFECT!',
      bonus: 0.25, // 随增幅阶梯提升至 0.30 / 0.35 / 0.40
      mult: 1.25,
      hitStopMs: 45,
      shake: 4.8
    }
  };

  // 空格格挡同阶基准减伤（Bad/Good/Great/Perfect = 0/8/18/30%，无人工封顶、无人工保底）
  var BLOCK_BASE_RATES = {
    bad: 0.00,
    good: 0.08,
    great: 0.18,
    perfect: 0.30
  };

  // 等阶差格挡预设（playerTier - enemyTier，线性相加公式）
  var BLOCK_PRESETS = {
    crush_plus6: {
      id: 'crush_plus6',
      label: '+6 ×1.72 最高51.6%',
      tierDiff: 6,
      enemyName: '边疆斥候',
      telegraphColor: '#3898F0',
      telegraphCore: '#E4F7FF',
      durationMs: 680,
      telegraphMs: 220
    },
    crush_plus5: {
      id: 'crush_plus5',
      label: '+5 ×1.60 最高48.0%',
      tierDiff: 5,
      enemyName: '边疆斥候',
      telegraphColor: '#3898F0',
      telegraphCore: '#E4F7FF',
      durationMs: 680,
      telegraphMs: 220
    },
    adv_plus2: {
      id: 'adv_plus2',
      label: '+2 ×1.24 最高37.2%',
      tierDiff: 2,
      enemyName: '初级灰棘狼',
      telegraphColor: '#3898F0',
      telegraphCore: '#E4F7FF',
      durationMs: 660,
      telegraphMs: 220
    },
    equal_0: {
      id: 'equal_0',
      label: '0 同阶 30.0%',
      tierDiff: 0,
      enemyName: '近卫剑士',
      telegraphColor: '#F2561D',
      telegraphCore: '#FFF3A6',
      durationMs: 640,
      telegraphMs: 220
    },
    under_minus2: {
      id: 'under_minus2',
      label: '-2 ×0.80 最高24.0%',
      tierDiff: -2,
      enemyName: '圣级强敌',
      telegraphColor: '#8B5CF6',
      telegraphCore: '#EAD8FF',
      durationMs: 600,
      telegraphMs: 210
    },
    god_minus4: {
      id: 'god_minus4',
      label: '-4 高打神 18.0%',
      tierDiff: -4,
      enemyName: '风神·岚',
      telegraphColor: '#2CA490',
      telegraphCore: '#D8FFF4',
      durationMs: 560,
      telegraphMs: 200
    },
    god_minus6: {
      id: 'god_minus6',
      label: '-6 初打神 12.0%',
      tierDiff: -6,
      enemyName: '风之神威',
      telegraphColor: '#2CA490',
      telegraphCore: '#D8FFF4',
      durationMs: 540,
      telegraphMs: 195
    }
  };

  // 技能多拍节拍预设
  var SKILL_PRESETS = {
    ice_crystal: {
      id: 'ice_crystal',
      name: '冰晶术',
      beats: 1,
      gapMs: 0,
      keys: null, // 随机左手键
      offsets: [{ dx: 0, dy: 0 }],
      skillVfx: null
    },
    tri_prism: {
      id: 'tri_prism',
      name: '三棱冰晶',
      beats: 3,
      gapMs: 135,
      keys: ['Q', 'W', 'E'],
      offsets: [
        { dx: -44, dy: -26 },
        { dx: 44, dy: -10 },
        { dx: 0, dy: 28 }
      ],
      skillVfx: null
    },
    frost_blossom: {
      id: 'frost_blossom',
      name: '星霜散华',
      beats: 4,
      gapMs: 105,
      keys: ['Q', 'W', 'E', 'A'],
      offsets: [
        { dx: -52, dy: -32 },
        { dx: 52, dy: -32 },
        { dx: -44, dy: 28 },
        { dx: 44, dy: 28 }
      ],
      skillVfx: null
    },
    basic_attack: {
      id: 'basic_attack',
      name: '普通攻击·寒光斩',
      beats: 1,
      gapMs: 0,
      keys: null,
      offsets: [{ dx: 0, dy: 0 }],
      skillVfx: 'basic_attack'
    },
    sword_send_slash: {
      id: 'sword_send_slash',
      name: '送刀斩·覆水极薄冰锋',
      beats: 2,
      gapMs: 145,
      keys: ['Q', 'E'],
      offsets: [
        { dx: -32, dy: -16 },
        { dx: 32, dy: 16 }
      ],
      skillVfx: 'sword_send_slash'
    },
    wind_afterimage: {
      id: 'wind_afterimage',
      name: '风行残像',
      beats: 0,
      gapMs: 0,
      keys: [],
      offsets: [{ dx: 0, dy: 0 }],
      skillVfx: 'wind_afterimage'
    }
  };

  /* ==================== 1. 工具函数与纯确定性核心算法 ==================== */
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    var u = 1 - clamp(t, 0, 1);
    return 1 - u * u * u;
  }

  function easeOutQuart(t) {
    var u = 1 - clamp(t, 0, 1);
    return 1 - u * u * u * u;
  }

  function easeOutBack(t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    var x = clamp(t, 0, 1) - 1;
    return 1 + c3 * x * x * x + c1 * x * x;
  }

  function easeInQuad(t) {
    var x = clamp(t, 0, 1);
    return x * x;
  }

  function prefersReducedMotion() {
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (e) {}
    return false;
  }

  /**
   * 规范化魔力增幅输入（兼容 0/20/40/60 百分比与 0/0.2/0.4/0.6 小数）
   */
  function normalizeOvercastPct(val) {
    var n = Number(val);
    if (!isFinite(n) || n <= 0) return 0;
    if (n > 0 && n <= 1) n = Math.round(n * 100);
    return clamp(n, 0, 60);
  }

  /**
   * 获取三阶魔力增幅共振配置（0% 760ms / 20% 660ms / 40% 580ms / 60% 500ms）
   */
  function getOvercastConfig(overcastPct) {
    var pct = normalizeOvercastPct(overcastPct);
    var tierIdx = 0;
    if (pct >= 60) tierIdx = 3;
    else if (pct >= 40) tierIdx = 2;
    else if (pct >= 20) tierIdx = 1;
    var base = OVERCAST_TIERS[tierIdx];
    return {
      tier: base.tier,
      pct: pct,
      tierPct: base.pct,
      durationMs: base.durationMs,
      perfectBonus: base.perfectBonus,
      name: base.name,
      shortLabel: base.shortLabel,
      ringStyle: base.ringStyle
    };
  }

  /**
   * 计算缩圈四档判定窗口（越靠近倒计时结束 elapsedMs === durationMs 按越好）
   */
  function getTimingWindows(durationMs) {
    var d = Math.max(200, Number(durationMs) || 760);
    return {
      durationMs: d,
      perfectPreMs: Math.round(d * 0.13),   // 0%:99ms / 20%:86ms / 40%:75ms / 60%:65ms
      perfectPostMs: Math.round(d * 0.085), // 0%:65ms / 20%:56ms / 40%:49ms / 60%:43ms
      greatPreMs: Math.round(d * 0.285),    // 0%:217ms / 20%:188ms / 40%:165ms / 60%:143ms
      greatPostMs: Math.round(d * 0.14),    // 0%:106ms / 20%:92ms / 40%:81ms / 60%:70ms
      goodPreMs: Math.round(d * 0.52),      // 0%:395ms -> 进度 >= 48%
      graceMs: Math.round(d * 0.155)        // 超过 durationMs + graceMs 判定超时 Bad
    };
  }

  /**
   * 纯函数：根据已过时间、缩圈总时长、魔力增幅与按键是否匹配，计算四档判定结果
   */
  function evaluateTiming(elapsedMs, durationMs, overcastPct, opts) {
    opts = opts || {};
    var oc = getOvercastConfig(overcastPct);
    var dur = Number(durationMs) > 0 ? Number(durationMs) : oc.durationMs;
    var win = getTimingWindows(dur);
    var elapsed = Number(elapsedMs);
    if (!isFinite(elapsed)) elapsed = dur + win.graceMs + 1;
    var deltaMs = dur - elapsed; // >0 偏早，0 正中倒计时结束，<0 偏晚
    var keyMatch = opts.keyMatch !== false;
    var isTimeout = !!opts.timeout || elapsed > dur + win.graceMs;

    var gradeId = 'bad';
    var reason = 'ok';
    if (!keyMatch) {
      gradeId = 'bad';
      reason = 'wrong_key';
    } else if (isTimeout) {
      gradeId = 'bad';
      reason = 'timeout';
    } else if (deltaMs <= win.perfectPreMs && deltaMs >= -win.perfectPostMs) {
      gradeId = 'perfect';
      reason = 'perfect';
    } else if (deltaMs <= win.greatPreMs && deltaMs >= -win.greatPostMs) {
      gradeId = 'great';
      reason = deltaMs >= 0 ? 'early_great' : 'late_great';
    } else if (deltaMs <= win.goodPreMs && deltaMs >= -win.graceMs) {
      gradeId = 'good';
      reason = deltaMs >= 0 ? 'early_good' : 'late_good';
    } else {
      gradeId = 'bad';
      reason = 'too_early';
    }

    var def = TIMING_GRADES[gradeId];
    var bonus = gradeId === 'perfect' ? oc.perfectBonus : def.bonus;
    var mult = Number((1 + bonus).toFixed(4));
    var bonusText = bonus > 0
      ? ('+' + Math.round(bonus * 100) + '%')
      : (bonus < 0 ? (Math.round(bonus * 100) + '%') : '±0%');

    return {
      grade: gradeId,
      label: def.label,
      bonus: bonus,
      bonusPct: Math.round(bonus * 100),
      bonusText: bonusText,
      multiplier: mult,
      hitStopMs: def.hitStopMs,
      shake: def.shake,
      deltaMs: Math.round(deltaMs),
      elapsedMs: Math.round(elapsed),
      durationMs: dur,
      progress: clamp(elapsed / dur, 0, 1.25),
      overcastTier: oc.tier,
      overcastPct: oc.pct,
      reason: reason
    };
  }

  /**
   * 纯函数：等阶差线性相加格挡系数（playerTier - enemyTier），无人工封顶、无人工保底
   * - d >= 0：1 + 0.12 * d（每高 1 阶 +12% 相加：+2 阶 ×1.24 最高 37.2%，+6 阶 ×1.72 最高 51.6%，仅受物理上限 100% 约束）
   * - d <  0：max(0, 1 - 0.10 * |d|)（每低 1 阶 -10% 相加：-2 阶 ×0.80 最高 24.0%，-4 阶高打神 ×0.60 最高 18.0%，-6 阶初打神 ×0.40 最高 12.0%）
   */
  function computeBlockScale(tierDiff) {
    var d = Number(tierDiff);
    if (!isFinite(d)) d = 0;
    return d >= 0 ? 1 + 0.12 * d : Math.max(0, 1 - 0.10 * Math.abs(d));
  }

  /**
   * 纯函数：计算空格格挡减伤结果（仅受物理减伤上限 [0, 1] 约束，无人工封顶/保底）
   */
  function computeBlockResult(grade, tierDiff) {
    var g = TIMING_GRADES[grade] ? grade : 'bad';
    var d = Number(tierDiff);
    if (!isFinite(d)) d = 0;
    var base = BLOCK_BASE_RATES[g];
    var scale = computeBlockScale(d);
    var rawReduction = base * scale;
    var reduction = clamp(rawReduction, 0, 1);
    var reductionPct = Number((reduction * 100).toFixed(1));
    var reductionPctText = (reduction * 100).toFixed(1) + '%';
    var isFullParry = reduction >= 0.999;
    var isOverwhelmed = d <= -4 && g !== 'bad';
    var isCrushedZero = d <= -4 && reductionPct <= 5;

    var calloutTitle = '';
    if (g === 'bad') {
      calloutTitle = 'MISS · 0.0%';
    } else if (isFullParry) {
      calloutTitle = 'PERFECT · 100% 完全弹反';
    } else {
      var gradeTag = g.toUpperCase();
      calloutTitle = gradeTag + ' · -' + reductionPctText;
    }

    return {
      grade: g,
      tierDiff: d,
      baseReduction: base,
      tierScale: Number(scale.toFixed(4)),
      rawReduction: Number(rawReduction.toFixed(4)),
      reduction: Number(reduction.toFixed(4)),
      reductionPct: reductionPct,
      reductionPctText: reductionPctText,
      damageTakenMult: Number((1 - reduction).toFixed(4)),
      isFullParry: isFullParry,
      isOverwhelmed: isOverwhelmed,
      isCrushedZero: isCrushedZero,
      calloutText: calloutTitle,
      hitStopMs: isFullParry ? 52 : (g === 'perfect' && !isOverwhelmed ? 26 : 0),
      shake: isFullParry ? 5.5 : (isOverwhelmed ? 6.0 : (g === 'perfect' ? 3.2 : (g === 'bad' ? 4.2 : 2.0)))
    };
  }

  function getBlockTable(tierDiff) {
    return {
      tierDiff: Number(tierDiff) || 0,
      bad: computeBlockResult('bad', tierDiff),
      good: computeBlockResult('good', tierDiff),
      great: computeBlockResult('great', tierDiff),
      perfect: computeBlockResult('perfect', tierDiff)
    };
  }

  /**
   * 从左手键池 Q/W/E/A/S/D 生成不连续重复的随机键序列
   */
  function pickRandomKeys(count, opts) {
    opts = opts || {};
    var n = Math.max(1, Math.floor(Number(count) || 1));
    var pool = Array.isArray(opts.pool) && opts.pool.length ? opts.pool.slice() : KEY_POOL.slice();
    var rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    var out = [];
    var prev = null;
    for (var i = 0; i < n; i++) {
      var candidates = pool.length > 1 && prev
        ? pool.filter(function (k) { return k !== prev; })
        : pool;
      var pick = candidates[Math.floor(rng() * candidates.length) % candidates.length];
      out.push(String(pick).toUpperCase());
      prev = pick;
    }
    return out;
  }

  function normalizeKeyInput(evOrKey) {
    if (!evOrKey) return '';
    if (typeof evOrKey === 'string') {
      var s = evOrKey.trim().toUpperCase();
      if (s === ' ' || s === 'SPACEBAR' || s === 'KEYSPACE') return 'SPACE';
      if (s.indexOf('KEY') === 0 && s.length === 4) return s.slice(3);
      return s;
    }
    var code = evOrKey.code || '';
    if (code === 'Space') return 'SPACE';
    if (code.indexOf('Key') === 0 && code.length === 4) return code.slice(3).toUpperCase();
    var k = evOrKey.key || '';
    if (k === ' ' || k === 'Spacebar') return 'SPACE';
    return String(k).toUpperCase();
  }

  /* ==================== 2. 零依赖 WebAudio 冰晶钢片琴 & 战斗拟音引擎 ==================== */
  function createAudioSynth() {
    var ctx = null;
    var muted = false;
    var volume = 0.58;
    var noiseBuf = null;

    var NOTE = {
      D3: 146.83,
      A3: 220.00,
      D4: 293.66,
      Fs4: 369.99,
      A4: 440.00,
      B4: 493.88,
      D5: 587.33,
      E5: 659.25,
      Fs5: 739.99,
      A5: 880.00,
      B5: 987.77,
      D6: 1174.66,
      E6: 1318.51,
      Fs6: 1479.98,
      A6: 1760.00
    };

    function ensureContext() {
      if (muted) return null;
      try {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return null;
        if (!ctx) ctx = new AC();
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
          ctx.resume().catch(function () {});
        }
        return ctx;
      } catch (e) {
        return null;
      }
    }

    function getNoiseBuffer(ac) {
      if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
      var len = Math.floor(ac.sampleRate * 0.45);
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noiseBuf = buf;
      return buf;
    }

    // D 大调霜晶钢片琴单音（沿用主工程 [1.0, 2.756, 5.404] 晶体泛音列）
    function playCrystalBell(ac, freq, startOffset, dur, gainPeak, bright) {
      var now = ac.currentTime + (startOffset || 0);
      var master = ac.createGain();
      var peak = Math.max(0.001, gainPeak * volume);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(peak, now + 0.006);
      master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      master.connect(ac.destination);

      var ratios = bright ? [1.0, 2.756, 5.404] : [1.0, 2.756];
      var weights = bright ? [0.72, 0.22, 0.10] : [0.78, 0.22];
      for (var i = 0; i < ratios.length; i++) {
        var osc = ac.createOscillator();
        var g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * ratios[i], now);
        g.gain.setValueAtTime(weights[i], now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur / (1 + i * 0.55));
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + dur + 0.02);
      }
    }

    function playFilteredNoise(ac, startOffset, dur, freqStart, freqEnd, q, gainPeak, filterType) {
      var now = ac.currentTime + (startOffset || 0);
      var src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      var flt = ac.createBiquadFilter();
      flt.type = filterType || 'bandpass';
      flt.Q.setValueAtTime(q || 2.5, now);
      flt.frequency.setValueAtTime(Math.max(60, freqStart), now);
      if (freqEnd && freqEnd !== freqStart) {
        flt.frequency.exponentialRampToValueAtTime(Math.max(60, freqEnd), now + dur);
      }
      var g = ac.createGain();
      var peak = Math.max(0.001, gainPeak * volume);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + Math.min(0.015, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(flt);
      flt.connect(g);
      g.connect(ac.destination);
      src.start(now);
      src.stop(now + dur + 0.02);
    }

    function playToneSlide(ac, type, f0, f1, startOffset, dur, gainPeak) {
      var now = ac.currentTime + (startOffset || 0);
      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(Math.max(40, f0), now);
      if (f1 && f1 !== f0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now + dur);
      }
      var peak = Math.max(0.001, gainPeak * volume);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    function play(name, opts) {
      opts = opts || {};
      var ac = ensureContext();
      if (!ac) return;
      try {
        var tier = Number(opts.tier) || 0;
        switch (name) {
          case 'ring_spawn':
            playCrystalBell(ac, NOTE.A4 * (1 + tier * 0.14), 0, 0.11, 0.16, tier >= 2);
            if (tier >= 3) {
              playFilteredNoise(ac, 0.01, 0.08, 4200, 6800, 5.0, 0.09, 'bandpass');
            }
            break;

          case 'grade_bad':
            // 低沉闷音
            playToneSlide(ac, 'triangle', 158, 76, 0, 0.19, 0.34);
            playToneSlide(ac, 'sine', 124, 68, 0.01, 0.16, 0.22);
            playFilteredNoise(ac, 0, 0.12, 420, 140, 1.4, 0.22, 'lowpass');
            break;

          case 'grade_good':
            // 轻水晶音
            playCrystalBell(ac, NOTE.D5, 0, 0.26, 0.30, false);
            break;

          case 'grade_great':
            // 亮丽双音（D5 -> A5 五度晶铃）
            playCrystalBell(ac, NOTE.D5, 0, 0.28, 0.28, true);
            playCrystalBell(ac, NOTE.A5, 0.048, 0.34, 0.32, true);
            break;

          case 'grade_perfect':
            // 清越星晶和弦（D5 - F#5 - A5 - D6 - E6 星霜琶音）
            playCrystalBell(ac, NOTE.D5, 0.000, 0.44, 0.28, true);
            playCrystalBell(ac, NOTE.Fs5, 0.020, 0.46, 0.26, true);
            playCrystalBell(ac, NOTE.A5, 0.042, 0.50, 0.30, true);
            playCrystalBell(ac, NOTE.D6, 0.066, 0.56, 0.34, true);
            if (tier >= 2) {
              playCrystalBell(ac, NOTE.E6, 0.092, 0.52, 0.24, true);
              playCrystalBell(ac, NOTE.Fs6, 0.112, 0.48, 0.18, true);
            }
            playFilteredNoise(ac, 0, 0.14, 3400, 7200, 4.0, 0.12, 'bandpass');
            break;

          case 'enemy_telegraph':
            playToneSlide(ac, 'sine', 520, 1080, 0, 0.12, 0.18);
            playFilteredNoise(ac, 0, 0.10, 2200, 4800, 4.0, 0.10, 'bandpass');
            break;

          case 'block_parry_100':
            // 100% 完美弹反：低频晶盾震锁 + 脆亮金铁弹开 + 清越回响和弦
            playToneSlide(ac, 'sine', 210, 82, 0, 0.16, 0.38);
            playCrystalBell(ac, NOTE.A5, 0.000, 0.52, 0.38, true);
            playCrystalBell(ac, NOTE.D6, 0.024, 0.58, 0.36, true);
            playCrystalBell(ac, NOTE.Fs6, 0.052, 0.62, 0.30, true);
            playFilteredNoise(ac, 0, 0.18, 2800, 6600, 3.2, 0.22, 'bandpass');
            break;

          case 'block_guard':
            // 同阶晶盾格挡：干脆晶盾敲击 + 轻亮晶鸣
            playToneSlide(ac, 'triangle', 260, 118, 0, 0.12, 0.30);
            playCrystalBell(ac, NOTE.Fs5, 0.004, 0.28, 0.26, true);
            playFilteredNoise(ac, 0, 0.09, 1800, 3600, 2.8, 0.14, 'bandpass');
            break;

          case 'block_crush':
            // 越级威压贯穿：晶面脆裂 + 重压贯穿 + 细碎冰碴散落
            playToneSlide(ac, 'sawtooth', 148, 52, 0, 0.26, 0.32);
            playFilteredNoise(ac, 0, 0.22, 2600, 520, 1.5, 0.28, 'bandpass');
            playCrystalBell(ac, NOTE.E6, 0.02, 0.12, 0.16, true);
            playCrystalBell(ac, NOTE.B5, 0.06, 0.10, 0.13, false);
            playCrystalBell(ac, NOTE.Fs5, 0.11, 0.09, 0.10, false);
            break;

          case 'block_miss':
            playToneSlide(ac, 'triangle', 130, 56, 0, 0.20, 0.34);
            playFilteredNoise(ac, 0, 0.14, 520, 150, 1.2, 0.24, 'lowpass');
            break;

          case 'sword_basic':
            // 普通攻击：干脆寒光斩
            playFilteredNoise(ac, 0, 0.14, 1400, 4800, 2.2, 0.24, 'bandpass');
            playToneSlide(ac, 'triangle', 680, 240, 0.02, 0.11, 0.18);
            playCrystalBell(ac, NOTE.A5, 0.03, 0.18, 0.18, true);
            break;

          case 'sword_send_1':
            // 送刀斩第 1 拍：覆水柔韧弧斩
            playFilteredNoise(ac, 0, 0.20, 900, 3200, 1.8, 0.24, 'bandpass');
            playCrystalBell(ac, NOTE.E5, 0.02, 0.24, 0.20, true);
            break;

          case 'sword_send_2':
            // 送刀斩第 2 拍：极薄冰锋斩断 + 化水散雾
            playFilteredNoise(ac, 0, 0.16, 2600, 6200, 3.4, 0.24, 'bandpass');
            playCrystalBell(ac, NOTE.D6, 0.01, 0.34, 0.26, true);
            playFilteredNoise(ac, 0.10, 0.30, 3600, 1100, 1.6, 0.16, 'bandpass');
            playCrystalBell(ac, NOTE.A5, 0.16, 0.14, 0.12, false);
            playCrystalBell(ac, NOTE.Fs5, 0.23, 0.12, 0.10, false);
            break;

          case 'wind_afterimage':
            // 风行残像：疾风螺旋升调 + 三重风影晶鸣
            playFilteredNoise(ac, 0, 0.42, 480, 2800, 2.6, 0.22, 'bandpass');
            playCrystalBell(ac, NOTE.D5, 0.02, 0.24, 0.18, false);
            playCrystalBell(ac, NOTE.Fs5, 0.085, 0.24, 0.19, false);
            playCrystalBell(ac, NOTE.A5, 0.150, 0.28, 0.21, true);
            playCrystalBell(ac, NOTE.D6, 0.220, 0.36, 0.22, true);
            break;

          default:
            break;
        }
      } catch (e) {}
    }

    return {
      play: play,
      setMuted: function (v) { muted = !!v; },
      isMuted: function () { return muted; },
      setVolume: function (v) { volume = clamp(Number(v) || 0, 0, 1); },
      getVolume: function () { return volume; }
    };
  }

  /* ==================== 3. 高精几何棱镜 & 像素级绘制基元 ==================== */

  // 绘制切角八角棱镜路径（严禁圆框！）
  function traceChamferedOctagon(ctx, cx, cy, r, rot) {
    var angleOffset = (rot || 0) + Math.PI / 8;
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = angleOffset + (i * Math.PI) / 4;
      var px = cx + Math.cos(a) * r;
      var py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // 绘制菱形切角盾牌路径（空格格挡专属轮廓，一眼区分攻击八角）
  function tracePrismShield(ctx, cx, cy, rx, ry) {
    var cutX = rx * 0.62;
    var cutY = ry * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + cutX, cy - ry + cutY * 0.68);
    ctx.lineTo(cx + rx, cy - cutY * 0.15);
    ctx.lineTo(cx + rx * 0.78, cy + ry * 0.45);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx * 0.78, cy + ry * 0.45);
    ctx.lineTo(cx - rx, cy - cutY * 0.15);
    ctx.lineTo(cx - cutX, cy - ry + cutY * 0.68);
    ctx.closePath();
  }

  // 绘制锐利切角八角矩形条（用于 SPACE 键标）
  function traceChamferedRect(ctx, x, y, w, h, cut) {
    var c = Math.min(cut, w * 0.45, h * 0.45);
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  }

  // 绘制单个冰晶棱镜外环（带深海军蓝高对比轮廓 + 折光高光边 + 四向晶芒刻度）
  function drawPrismOctagonRing(ctx, cx, cy, r, opts) {
    var rot = opts.rot || 0;
    var strokeColor = opts.color || PALETTE.iceCyan;
    var coreColor = opts.coreColor || PALETTE.white;
    var outlineColor = opts.outlineColor || 'rgba(8, 26, 84, 0.88)';
    var lineW = opts.lineWidth || 3;
    var alpha = opts.alpha != null ? opts.alpha : 1;
    var glow = opts.glow || 0;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // 1) 深海蓝对比描边（雪瓷亮底与暗场皆清晰）
    traceChamferedOctagon(ctx, cx, cy, r, rot);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 3;
    ctx.lineWidth = lineW + 3.2;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // 2) 主体晶色折光环
    if (glow > 0) {
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = glow;
    }
    traceChamferedOctagon(ctx, cx, cy, r, rot);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3) 内侧纤锐雪白反光棱线
    traceChamferedOctagon(ctx, cx, cy, Math.max(2, r - lineW * 0.45), rot);
    ctx.lineWidth = Math.max(1, lineW * 0.38);
    ctx.strokeStyle = coreColor;
    ctx.globalAlpha = clamp(alpha * 0.85, 0, 1);
    ctx.stroke();

    // 4) 四向顶点小菱晶刻度
    if (opts.cornerTicks) {
      var tickSize = opts.tickSize || 4.5;
      ctx.fillStyle = coreColor;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.2;
      for (var i = 0; i < 4; i++) {
        var a = rot + (i * Math.PI) / 2;
        var vx = cx + Math.cos(a) * (r * 0.96);
        var vy = cy + Math.sin(a) * (r * 0.96);
        ctx.beginPath();
        ctx.moveTo(vx, vy - tickSize);
        ctx.lineTo(vx + tickSize * 0.72, vy);
        ctx.lineTo(vx, vy + tickSize);
        ctx.lineTo(vx - tickSize * 0.72, vy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 确定性伪随机（用于 60% 三阶细锐冰雷电弧，每 45ms 刷新一次折线不抖成糊团）
  function hashRand(seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  // 绘制三阶星霜极限的细锐冰雷电弧脉冲
  function drawIceLightningArc(ctx, x1, y1, x2, y2, seed, jitter, px) {
    var segs = 6;
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    var pts = [{ x: x1, y: y1 }];
    for (var i = 1; i < segs; i++) {
      var t = i / segs;
      var amp = Math.sin(t * Math.PI) * jitter;
      var off = (hashRand(seed + i * 13.7) * 2 - 1) * amp;
      var qx = x1 + dx * t + nx * off;
      var qy = y1 + dy * t + ny * off;
      if (px > 1) {
        qx = Math.round(qx / px) * px;
        qy = Math.round(qy / px) * px;
      }
      pts.push({ x: qx, y: qy });
    }
    pts.push({ x: x2, y: y2 });

    ctx.save();
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    // 外层冰青电晕
    ctx.beginPath();
    for (var j = 0; j < pts.length; j++) {
      if (j === 0) ctx.moveTo(pts[j].x, pts[j].y);
      else ctx.lineTo(pts[j].x, pts[j].y);
    }
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.78)';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // 芯部白金锐弧
    ctx.strokeStyle = PALETTE.goldCore;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  // 绘制香槟金×冰青八芒十字星裂（Perfect 标志特效）
  function drawEightPointStarburst(ctx, cx, cy, mainR, diagR, alpha, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // 次级 45° 斜向冰青棱芒
    for (var d = 0; d < 4; d++) {
      ctx.save();
      ctx.rotate(Math.PI / 4 + (d * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -diagR);
      ctx.lineTo(diagR * 0.11, 0);
      ctx.lineTo(0, diagR * 0.14);
      ctx.lineTo(-diagR * 0.11, 0);
      ctx.closePath();
      ctx.fillStyle = PALETTE.icePrism;
      ctx.fill();
      ctx.strokeStyle = PALETTE.sapphire;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 主级 0°/90° 香槟金×雪白针锐十字芒
    for (var m = 0; m < 4; m++) {
      ctx.save();
      ctx.rotate((m * Math.PI) / 2);
      // 外层香槟金刃芒
      ctx.beginPath();
      ctx.moveTo(0, -mainR);
      ctx.lineTo(mainR * 0.105, -mainR * 0.12);
      ctx.lineTo(mainR * 0.055, 0);
      ctx.lineTo(-mainR * 0.055, 0);
      ctx.lineTo(-mainR * 0.105, -mainR * 0.12);
      ctx.closePath();
      ctx.fillStyle = PALETTE.goldBright;
      ctx.fill();
      ctx.strokeStyle = 'rgba(14, 43, 120, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // 内芯纯白高光针
      ctx.beginPath();
      ctx.moveTo(0, -mainR * 0.88);
      ctx.lineTo(mainR * 0.042, 0);
      ctx.lineTo(-mainR * 0.042, 0);
      ctx.closePath();
      ctx.fillStyle = PALETTE.white;
      ctx.fill();
      ctx.restore();
    }

    // 中心切面菱核
    var coreR = Math.max(4, mainR * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, -coreR);
    ctx.lineTo(coreR, 0);
    ctx.lineTo(0, coreR);
    ctx.lineTo(-coreR, 0);
    ctx.closePath();
    ctx.fillStyle = PALETTE.white;
    ctx.fill();
    ctx.strokeStyle = PALETTE.goldMid;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.restore();
  }

  // 高精像素化圆弧斩击光栅绘制（Sea of Stars 级锯齿感+锐利尖端+多层寒光）
  function drawPixelSlashArc(ctx, opts) {
    var cx = opts.cx;
    var cy = opts.cy;
    var radiusX = opts.radiusX || 62;
    var radiusY = opts.radiusY || 44;
    var rot = opts.rot || 0;
    var startAng = opts.startAng;
    var endAng = opts.endAng;
    var maxThick = opts.thickness || 16;
    var px = Math.max(2, opts.px || 2);
    var headT = clamp(opts.headT != null ? opts.headT : 1, 0, 1);
    var tailT = clamp(opts.tailT != null ? opts.tailT : 0, 0, 1);
    if (headT <= tailT + 0.01) return;

    var colors = opts.colors || {
      outline: PALETTE.inkDeep,
      outer: PALETTE.sapphire,
      mid: PALETTE.iceCyan,
      core: PALETTE.white
    };

    var steps = Math.max(28, Math.round((Math.max(radiusX, radiusY) * 2.1) / px));
    var cosR = Math.cos(rot);
    var sinR = Math.sin(rot);

    ctx.save();
    ctx.globalAlpha = clamp(opts.alpha != null ? opts.alpha : 1, 0, 1);

    function plotCell(lx, ly, color) {
      var wx = cx + lx * cosR - ly * sinR;
      var wy = cy + lx * sinR + ly * cosR;
      var gx = Math.round(wx / px) * px;
      var gy = Math.round(wy / px) * px;
      ctx.fillStyle = color;
      ctx.fillRect(gx, gy, px, px);
    }

    for (var i = 0; i <= steps; i++) {
      var u = i / steps;
      if (u < tailT || u > headT) continue;
      var localU = (u - tailT) / (headT - tailT); // 0=尾尖 -> 1=刃锋前沿
      // 锋利非对称月牙厚度：前沿偏厚带锐尖，尾端收细拖尾
      var profile = Math.sin(Math.pow(localU, 0.72) * Math.PI);
      var thick = Math.max(px, maxThick * profile);
      var ang = lerp(startAng, endAng, u);
      var ca = Math.cos(ang);
      var sa = Math.sin(ang);

      var halfN = Math.ceil(thick / (px * 2));
      for (var k = -halfN; k <= halfN; k++) {
        var radialOff = k * px;
        var norm = halfN > 0 ? radialOff / (halfN * px) : 0;
        var absN = Math.abs(norm);
        // 尾端做像素镂空拖痕，增强斩击速度感
        if (localU < 0.25 && ((i + k) & 1) === 1 && absN > 0.35) continue;

        var col;
        if (absN > 0.84) col = colors.outline;
        else if (norm > 0.25) col = colors.core;        // 外锋极亮雪白/冰白刃口
        else if (absN < 0.38) col = colors.mid;         // 中脊冰蓝/水青
        else col = colors.outer;                        // 内缘深蓝/水影

        if (localU > 0.84 && absN < 0.72) col = colors.core;

        var lx = (radiusX + radialOff) * ca;
        var ly = (radiusY + radialOff) * sa;
        plotCell(lx, ly, col);
      }
    }

    ctx.restore();
  }

  // 内置高精像素希尔维亚疾行剪影（20×24 精雕贵族少女侧身突进像素阵：飘逸长发/丝带+束腰裙摆+前探剑势）
  var SYLVIA_DASH_PIXEL_GRID = [
    '.........4444.......',
    '........433334......',
    '.....4443332234.....',
    '...443333222234.....',
    '..43322.43222345....',
    '.432...43322234.....',
    '43....432.22344.....',
    '......3...1223444...',
    '.........1222334455.',
    '........122233445555',
    '........122233444...',
    '.......12222334.....',
    '......122222334.....',
    '.....12222222334....',
    '....1222122222334...',
    '...122211222222334..',
    '..1222111222222233..',
    '.12221..11222..223..',
    '.122....1122....23..',
    '........112.....234.',
    '.......112.......34.',
    '......112........34.',
    '.....11...........4.',
    '....11..............'
  ];

  function drawPixelAfterimageSilhouette(ctx, cx, cy, opts) {
    var px = Math.max(2, Math.round(opts.px || 3));
    var flipX = !!opts.flipX;
    var alpha = clamp(opts.alpha != null ? opts.alpha : 0.7, 0, 1);
    var shear = opts.shear || 0;
    var spriteSource = opts.spriteSource || null;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (spriteSource && spriteSource.width > 0) {
      var sw = opts.spriteW || 72;
      var sh = opts.spriteH || 84;
      ctx.translate(cx, cy);
      if (flipX) ctx.scale(-1, 1);
      ctx.transform(1, 0, -0.14 - shear * 0.12, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.filter = 'hue-rotate(148deg) saturate(1.8) brightness(1.35)';
      ctx.drawImage(spriteSource, -sw * 0.5, -sh * 0.88, sw, sh);
      ctx.filter = 'none';
      ctx.restore();
      return;
    }

    var rows = SYLVIA_DASH_PIXEL_GRID.length;
    var cols = SYLVIA_DASH_PIXEL_GRID[0].length;
    var originX = cx - (cols * px) * 0.5;
    var originY = cy - rows * px * 0.86;
    var paletteMap = {
      '1': PALETTE.windDeep,
      '2': PALETTE.windTeal,
      '3': PALETTE.windBright,
      '4': PALETTE.windPale,
      '5': PALETTE.white
    };

    for (var r = 0; r < rows; r++) {
      var line = SYLVIA_DASH_PIXEL_GRID[r];
      var rowShear = Math.round(((rows - r) / rows) * shear * 1.4) * px;
      var firstCol = -1;
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === '.') continue;
        if (firstCol < 0) firstCol = c;
        if (alpha < 0.42 && ((r + c) & 1) === 1 && ch !== '5' && ch !== '4') continue;
        var drawC = flipX ? (cols - 1 - c) : c;
        var gx = Math.round((originX + drawC * px - rowShear) / px) * px;
        var gy = Math.round((originY + r * px) / px) * px;
        ctx.fillStyle = paletteMap[ch] || PALETTE.windBright;
        ctx.fillRect(gx, gy, px, px);
      }
      // 从发梢、肩部、裙摆拉出细长冰青风影牵丝
      if (firstCol >= 0 && (r === 3 || r === 8 || r === 14 || r === 17)) {
        var trailLen = (4 + ((r * 5) % 6)) * px;
        var edgeCol = flipX ? (cols - firstCol) : firstCol;
        var tx = originX + edgeCol * px - rowShear;
        var ty = Math.round((originY + r * px) / px) * px;
        ctx.fillStyle = PALETTE.windPale;
        ctx.globalAlpha = alpha * 0.62;
        ctx.fillRect(Math.round((tx + (flipX ? px : -trailLen)) / px) * px, ty, trailLen, px);
        ctx.globalAlpha = alpha;
      }
    }

    ctx.restore();
  }

  /* ==================== 4. 核心引擎工厂：VfxTimingBlockEngine ==================== */
  function createEngine(initOpts) {
    initOpts = initOpts || {};

    var canvas = null;
    var ownedCanvas = false;
    var ctx = null;
    var width = initOpts.width || 1280;
    var height = initOpts.height || 720;
    var dpr = initOpts.dpr || (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    var pixelScale = Math.max(2, Math.round(initOpts.pixelScale || 2));

    var audio = createAudioSynth();
    if (initOpts.muted) audio.setMuted(true);
    if (initOpts.volume != null) audio.setVolume(initOpts.volume);

    var rafId = 0;
    var running = false;
    var lastFrameTs = 0;
    var clockMs = 0;
    var keyboardEnabled = initOpts.listenKeyboard !== false;
    var keyListenerAttached = false;

    // 顿帧与创伤震屏状态
    var hitStopRemainMs = 0;
    var shakeTrauma = 0;
    var shakeMag = 0;
    var shakeOffset = { x: 0, y: 0 };

    // 钩子回调
    var onHitStop = typeof initOpts.onHitStop === 'function' ? initOpts.onHitStop : null;
    var onShake = typeof initOpts.onShake === 'function' ? initOpts.onShake : null;

    // 当前交互状态（缩圈连拍队列 / 空格格挡）
    var activeSequence = null; // 攻击缩圈序列
    var activeBlock = null;    // 空格等阶差格挡

    // 动态视觉池
    var shockwaves = [];
    var starbursts = [];
    var shields = [];
    var particles = [];
    var slashes = [];
    var afterimages = [];
    var windRings = [];
    var callouts = [];
    var screenFlashes = [];

    /* ---------- 画面震屏与顿帧 ---------- */
    function addShake(amount) {
      if (prefersReducedMotion() && !initOpts.ignoreReducedMotion) {
        amount *= 0.25;
      }
      shakeTrauma = clamp(shakeTrauma + amount * 0.16, 0, 1);
      shakeMag = Math.max(shakeMag, amount);
      if (onShake) {
        try { onShake(amount); } catch (e) {}
      }
    }

    function triggerHitStop(ms, context) {
      if (!ms || ms <= 0) return;
      if (prefersReducedMotion() && !initOpts.ignoreReducedMotion) return;
      hitStopRemainMs = Math.max(hitStopRemainMs, ms);
      if (onHitStop) {
        try { onHitStop(ms, context || {}); } catch (e) {}
      }
    }

    /* ---------- 粒子与爆字生成器 ---------- */
    function spawnParticle(p) {
      if (particles.length >= 260) particles.shift();
      particles.push({
        x: p.x,
        y: p.y,
        vx: p.vx || 0,
        vy: p.vy || 0,
        ax: p.ax || 0,
        ay: p.ay != null ? p.ay : 0,
        drag: p.drag != null ? p.drag : 0.96,
        size: p.size || 3,
        w: p.w || 0,
        h: p.h || 0,
        color: p.color || PALETTE.iceCyan,
        outline: p.outline || null,
        shape: p.shape || 'pixel', // 'pixel' | 'diamond' | 'shard' | 'streak' | 'mist'
        rot: p.rot || 0,
        vrot: p.vrot || 0,
        age: 0,
        life: p.life || 420,
        alpha: p.alpha != null ? p.alpha : 1
      });
    }

    function spawnCallout(opts) {
      callouts.push({
        text: opts.text || '',
        subtext: opts.subtext || '',
        x: opts.x,
        y: opts.y,
        color: opts.color || PALETTE.white,
        accent: opts.accent || PALETTE.iceCyan,
        outline: opts.outline || PALETTE.inkAbyss,
        scale: opts.scale || 1,
        age: 0,
        life: opts.life || 760,
        cracked: !!opts.cracked,
        prominent: !!opts.prominent
      });
    }

    /* ---------- 1) 缩圈四档判定视觉爆裂 ---------- */
    function spawnTimingFeedback(grade, x, y, opts) {
      opts = opts || {};
      var g = TIMING_GRADES[grade] ? grade : 'bad';
      var oc = getOvercastConfig(opts.overcastPct || 0);
      var bonus = opts.bonus != null ? opts.bonus : (g === 'perfect' ? oc.perfectBonus : TIMING_GRADES[g].bonus);
      var bonusText = opts.bonusText || (bonus > 0 ? ('+' + Math.round(bonus * 100) + '%') : (bonus < 0 ? (Math.round(bonus * 100) + '%') : '±0%'));
      var rBase = opts.radius || 30;

      if (g === 'bad') {
        audio.play('grade_bad', { tier: oc.tier });
        addShake(1.6);
        // 淡灰蓝棱环黯然碎散（非对称崩裂碎片下坠）
        for (var i = 0; i < 16; i++) {
          var ang = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
          var spd = 55 + Math.random() * 105;
          spawnParticle({
            x: x + Math.cos(ang) * rBase * (0.78 + Math.random() * 0.3),
            y: y + Math.sin(ang) * rBase * (0.78 + Math.random() * 0.3),
            vx: Math.cos(ang) * spd * 0.72,
            vy: Math.sin(ang) * spd * 0.55 + 48,
            ay: 360,
            drag: 0.95,
            size: 4 + Math.random() * 4.5,
            color: i % 2 === 0 ? PALETTE.slateLight : PALETTE.slateMid,
            outline: PALETTE.slateDark,
            shape: 'shard',
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 9,
            life: 460 + Math.random() * 160
          });
        }
        shockwaves.push({
          kind: 'broken_octagon',
          x: x,
          y: y,
          r0: rBase * 0.95,
          r1: rBase * 1.48,
          rot: 0.16,
          color: PALETTE.slateMid,
          coreColor: PALETTE.slateLight,
          lineWidth: 2.2,
          age: 0,
          life: 260
        });
        spawnCallout({
          text: 'BAD',
          subtext: bonusText,
          x: x,
          y: y - rBase - 32,
          color: '#E2E8F0',
          accent: PALETTE.slateMid,
          outline: '#1E293B',
          scale: 0.95,
          life: 640
        });
        return;
      }

      if (g === 'good') {
        audio.play('grade_good', { tier: oc.tier });
        addShake(1.2);
        // 清脆冰青单菱闪 + 中心小四芒晶闪
        shockwaves.push({
          kind: 'diamond',
          x: x,
          y: y,
          r0: rBase * 0.85,
          r1: rBase * 2.2,
          rot: 0,
          color: PALETTE.iceCyan,
          coreColor: PALETTE.white,
          lineWidth: 3.4,
          age: 0,
          life: 320
        });
        starbursts.push({
          x: x,
          y: y,
          mainR: rBase * 1.05,
          diagR: rBase * 0.42,
          rot: 0,
          tier: 0,
          age: 0,
          life: 240
        });
        for (var j = 0; j < 10; j++) {
          var ga = (j / 10) * Math.PI * 2;
          var gspd = 115 + Math.random() * 85;
          spawnParticle({
            x: x,
            y: y,
            vx: Math.cos(ga) * gspd,
            vy: Math.sin(ga) * gspd,
            drag: 0.91,
            size: 4.0,
            color: j % 2 === 0 ? PALETTE.white : PALETTE.iceCyan,
            outline: PALETTE.inkDeep,
            shape: 'diamond',
            life: 320 + Math.random() * 100
          });
        }
        spawnCallout({
          text: 'GOOD',
          subtext: bonusText,
          x: x,
          y: y - rBase - 36,
          color: PALETTE.iceSnow,
          accent: PALETTE.iceCyan,
          outline: PALETTE.inkAbyss,
          scale: 1.0,
          life: 680
        });
        return;
      }

      if (g === 'great') {
        audio.play('grade_great', { tier: oc.tier });
        addShake(2.8);
        // 皇家蓝双层菱镜冲击
        shockwaves.push({
          kind: 'octagon',
          x: x,
          y: y,
          r0: rBase * 0.78,
          r1: rBase * 2.65,
          rot: 0,
          color: PALETTE.sapphire,
          coreColor: PALETTE.icePale,
          lineWidth: 4.2,
          age: 0,
          life: 360
        });
        shockwaves.push({
          kind: 'diamond',
          x: x,
          y: y,
          r0: rBase * 0.55,
          r1: rBase * 2.2,
          rot: Math.PI / 8,
          color: PALETTE.icePrism,
          coreColor: PALETTE.white,
          lineWidth: 2.8,
          age: -40,
          life: 330
        });
        for (var k = 0; k < 14; k++) {
          var ka = (k / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
          var kspd = 145 + Math.random() * 130;
          spawnParticle({
            x: x,
            y: y,
            vx: Math.cos(ka) * kspd,
            vy: Math.sin(ka) * kspd,
            drag: 0.90,
            size: 4 + Math.random() * 3,
            color: k % 3 === 0 ? PALETTE.white : (k % 2 === 0 ? PALETTE.sapphireHi : PALETTE.icePrism),
            outline: PALETTE.inkAbyss,
            shape: k % 2 === 0 ? 'diamond' : 'shard',
            rot: ka,
            vrot: (Math.random() - 0.5) * 8,
            life: 380 + Math.random() * 140
          });
        }
        spawnCallout({
          text: 'GREAT',
          subtext: bonusText,
          x: x,
          y: y - rBase - 46,
          color: '#FFFFFF',
          accent: PALETTE.sapphireHi,
          outline: PALETTE.inkAbyss,
          scale: 1.12,
          life: 740
        });
        return;
      }

      // PERFECT: 香槟金×冰青八芒十字星裂 + 瞬间 45ms 微顿帧 + 细微震屏 + 清越星晶和弦
      audio.play('grade_perfect', { tier: oc.tier });
      triggerHitStop(45, { kind: 'timing_perfect', tier: oc.tier });
      addShake(4.8 + oc.tier * 0.45);

      starbursts.push({
        x: x,
        y: y,
        mainR: rBase * (2.6 + oc.tier * 0.26),
        diagR: rBase * (1.75 + oc.tier * 0.18),
        rot: 0,
        tier: oc.tier,
        age: 0,
        life: 440
      });
      shockwaves.push({
        kind: 'octagon',
        x: x,
        y: y,
        r0: rBase * 0.72,
        r1: rBase * (3.1 + oc.tier * 0.22),
        rot: 0,
        color: PALETTE.goldBright,
        coreColor: PALETTE.white,
        lineWidth: 4.5,
        age: 0,
        life: 410
      });
      shockwaves.push({
        kind: 'diamond',
        x: x,
        y: y,
        r0: rBase * 0.60,
        r1: rBase * 2.55,
        rot: 0,
        color: PALETTE.icePrism,
        coreColor: PALETTE.goldCore,
        lineWidth: 3.0,
        age: -28,
        life: 370
      });
      screenFlashes.push({
        color: oc.tier >= 3 ? 'rgba(253, 230, 138, 0.20)' : 'rgba(184, 232, 255, 0.16)',
        age: 0,
        life: 140
      });

      var shardCount = 20 + oc.tier * 4;
      for (var p = 0; p < shardCount; p++) {
        var pa = (p / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
        var pspd = 170 + Math.random() * 210;
        var isGold = p % 2 === 0;
        spawnParticle({
          x: x,
          y: y,
          vx: Math.cos(pa) * pspd,
          vy: Math.sin(pa) * pspd,
          drag: 0.89,
          size: isGold ? (4.5 + Math.random() * 3.5) : (3.5 + Math.random() * 3),
          color: isGold ? (p % 4 === 0 ? PALETTE.goldCore : PALETTE.goldBright) : (p % 3 === 0 ? PALETTE.white : PALETTE.icePrism),
          outline: PALETTE.inkDeep,
          shape: p % 3 === 0 ? 'streak' : 'diamond',
          rot: pa,
          vrot: (Math.random() - 0.5) * 6,
          life: 420 + Math.random() * 190
        });
      }

      spawnCallout({
        text: 'PERFECT!',
        subtext: bonusText,
        x: x,
        y: y - rBase - 64,
        color: PALETTE.goldBright,
        accent: PALETTE.icePrism,
        outline: PALETTE.inkAbyss,
        scale: 1.18,
        prominent: true,
        life: 860
      });
    }

    /* ---------- 1B) 缩圈多拍序列控制 ---------- */
    function startTimingSequence(opts) {
      opts = opts || {};
      var preset = opts.preset && SKILL_PRESETS[opts.preset] ? SKILL_PRESETS[opts.preset] : null;
      var oc = getOvercastConfig(opts.overcastPct != null ? opts.overcastPct : 0);
      var baseX = opts.x != null ? opts.x : width * 0.64;
      var baseY = opts.y != null ? opts.y : height * 0.48;
      var dur = opts.durationMs != null ? opts.durationMs : oc.durationMs;
      var gapMs = opts.gapMs != null ? opts.gapMs : (preset ? preset.gapMs : 130);
      var autoPlaySkillVfx = opts.autoPlaySkillVfx !== false;
      var skillVfx = opts.skillVfx !== undefined ? opts.skillVfx : (preset ? preset.skillVfx : null);

      var beats = [];
      if (Array.isArray(opts.beats) && opts.beats.length) {
        for (var i = 0; i < opts.beats.length; i++) {
          var b = opts.beats[i];
          beats.push({
            index: i,
            key: normalizeKeyInput(b.key) || pickRandomKeys(1)[0],
            x: b.x != null ? b.x : baseX,
            y: b.y != null ? b.y : baseY,
            durationMs: b.durationMs != null ? b.durationMs : dur,
            radius: b.radius || opts.radius || 30,
            tag: b.tag || ''
          });
        }
      } else {
        var count = opts.beatCount != null ? opts.beatCount : (preset ? preset.beats : 1);
        count = Math.max(1, count);
        var keys;
        if (Array.isArray(opts.keys) && opts.keys.length >= count) {
          keys = opts.keys.slice(0, count).map(normalizeKeyInput);
        } else if (opts.randomKeys === true) {
          keys = pickRandomKeys(count);
        } else if (preset && Array.isArray(preset.keys) && preset.keys.length >= count && opts.usePresetKeys !== false) {
          keys = preset.keys.slice(0, count);
        } else {
          keys = pickRandomKeys(count);
        }
        var offsets = (preset && preset.offsets) || [{ dx: 0, dy: 0 }];
        for (var bi = 0; bi < count; bi++) {
          var off = offsets[bi % offsets.length] || { dx: 0, dy: 0 };
          beats.push({
            index: bi,
            key: keys[bi],
            x: baseX + off.dx,
            y: baseY + off.dy,
            durationMs: dur,
            radius: opts.radius || 30,
            tag: ''
          });
        }
      }

      // 替换旧缩圈（格挡与攻击互斥）
      activeBlock = null;
      activeSequence = {
        id: 'seq_' + Math.round(clockMs) + '_' + Math.floor(Math.random() * 9999),
        presetId: preset ? preset.id : (opts.preset || 'custom'),
        name: opts.name || (preset ? preset.name : '魔导缩圈'),
        overcast: oc,
        beats: beats,
        currentIndex: 0,
        state: 'active', // 'active' | 'gap'
        elapsedMs: 0,
        gapRemainMs: 0,
        gapMs: gapMs,
        results: [],
        autoPlaySkillVfx: autoPlaySkillVfx,
        skillVfx: skillVfx,
        casterX: opts.casterX != null ? opts.casterX : width * 0.28,
        casterY: opts.casterY != null ? opts.casterY : height * 0.52,
        targetX: baseX,
        targetY: baseY,
        onBeatResolve: typeof opts.onBeatResolve === 'function' ? opts.onBeatResolve : null,
        onSequenceComplete: typeof opts.onSequenceComplete === 'function' ? opts.onSequenceComplete : null
      };

      audio.play('ring_spawn', { tier: oc.tier });
      return activeSequence.id;
    }

    function startTimingBeat(opts) {
      opts = opts || {};
      var beatOpts = Object.assign({}, opts, { beatCount: 1 });
      if (opts.key) beatOpts.keys = [normalizeKeyInput(opts.key)];
      return startTimingSequence(beatOpts);
    }

    function resolveCurrentTimingBeat(keyMatch, isTimeout, pressedKey) {
      if (!activeSequence || activeSequence.state !== 'active') return null;
      var seq = activeSequence;
      var beat = seq.beats[seq.currentIndex];
      var evalRes = evaluateTiming(seq.elapsedMs, beat.durationMs, seq.overcast.pct, {
        keyMatch: keyMatch,
        timeout: isTimeout
      });
      evalRes.beatIndex = beat.index;
      evalRes.totalBeats = seq.beats.length;
      evalRes.expectedKey = beat.key;
      evalRes.pressedKey = pressedKey || null;
      evalRes.x = beat.x;
      evalRes.y = beat.y;
      evalRes.presetId = seq.presetId;

      seq.results.push(evalRes);

      spawnTimingFeedback(evalRes.grade, beat.x, beat.y, {
        overcastPct: seq.overcast.pct,
        bonus: evalRes.bonus,
        bonusText: evalRes.bonusText,
        radius: beat.radius
      });

      // 自动联动第 5 线剑技特效
      if (seq.autoPlaySkillVfx && seq.skillVfx) {
        if (seq.skillVfx === 'basic_attack') {
          playBasicAttack({
            x: seq.targetX,
            y: seq.targetY,
            fromX: seq.casterX,
            fromY: seq.casterY,
            grade: evalRes.grade
          });
        } else if (seq.skillVfx === 'sword_send_slash') {
          playSwordSendSlash({
            x: seq.targetX,
            y: seq.targetY,
            fromX: seq.casterX,
            fromY: seq.casterY,
            phase: beat.index % 2,
            grade: evalRes.grade
          });
        }
      }

      if (seq.onBeatResolve) {
        try { seq.onBeatResolve(evalRes); } catch (e) {}
      }

      // 推进到下一拍或收尾
      if (seq.currentIndex + 1 < seq.beats.length) {
        seq.currentIndex += 1;
        seq.state = 'gap';
        seq.gapRemainMs = seq.gapMs;
        seq.elapsedMs = 0;
      } else {
        var totalMult = 0;
        var perfectCount = 0;
        for (var i = 0; i < seq.results.length; i++) {
          totalMult += seq.results[i].multiplier;
          if (seq.results[i].grade === 'perfect') perfectCount++;
        }
        var summary = {
          sequenceId: seq.id,
          presetId: seq.presetId,
          overcastTier: seq.overcast.tier,
          overcastPct: seq.overcast.pct,
          beats: seq.results.slice(),
          perfectCount: perfectCount,
          allPerfect: perfectCount === seq.results.length,
          averageMultiplier: Number((totalMult / seq.results.length).toFixed(4))
        };
        activeSequence = null;
        if (seq.onSequenceComplete) {
          try { seq.onSequenceComplete(summary); } catch (e) {}
        }
      }

      return evalRes;
    }

    /* ---------- 2) 空格等阶差格挡弹反特效 ---------- */
    function spawnBlockFeedback(grade, tierDiff, x, y, opts) {
      opts = opts || {};
      var res = computeBlockResult(grade, tierDiff);
      var enemyX = opts.enemyX != null ? opts.enemyX : x + 320;
      var enemyY = opts.enemyY != null ? opts.enemyY : y - 16;
      var dirToEnemy = enemyX >= x ? 1 : -1;
      var attackColor = opts.attackColor || PALETTE.amberWarn;

      if (res.grade === 'bad') {
        audio.play('block_miss');
        addShake(res.shake);
        // 失格受击：淡灰盾影瞬间破碎 + 敌击贯入
        shockwaves.push({
          kind: 'shield',
          x: x,
          y: y,
          r0: 36,
          r1: 58,
          color: PALETTE.slateMid,
          coreColor: PALETTE.slateLight,
          lineWidth: 2,
          age: 0,
          life: 220
        });
        for (var bm = 0; bm < 10; bm++) {
          var bma = Math.random() * Math.PI * 2;
          spawnParticle({
            x: x,
            y: y,
            vx: -dirToEnemy * (70 + Math.random() * 110) + Math.cos(bma) * 35,
            vy: Math.sin(bma) * 90,
            ay: 240,
            drag: 0.94,
            size: 3.5,
            color: bm % 2 === 0 ? attackColor : PALETTE.slateLight,
            shape: 'shard',
            life: 320 + Math.random() * 100
          });
        }
        spawnCallout({
          text: res.calloutText,
          x: x,
          y: y - 54,
          color: '#CBD5E1',
          accent: PALETTE.slateMid,
          outline: '#1E293B',
          scale: 0.95,
          life: 700
        });
        return res;
      }

      if (res.isFullParry) {
        // === 高打低 100% 完美弹反 ===
        // 冰蓝×淡金棱镜盾面全开、火花/气浪反向弹飞敌方斩击、跳出「PERFECT · 100% 完全弹反」
        audio.play('block_parry_100');
        triggerHitStop(res.hitStopMs, { kind: 'block_parry_100', tierDiff: res.tierDiff });
        addShake(res.shake);

        shields.push({
          mode: 'parry100',
          x: x + dirToEnemy * 14,
          y: y,
          dir: dirToEnemy,
          rx: 38,
          ry: 62,
          age: 0,
          life: 560
        });

        starbursts.push({
          x: x + dirToEnemy * 22,
          y: y,
          mainR: 86,
          diagR: 54,
          rot: 0,
          tier: 3,
          age: 0,
          life: 440
        });

        // 反向弹飞气浪（朝敌方疾冲弹开敌方斩击）
        slashes.push({
          kind: 'parry_rebound',
          cx: x + dirToEnemy * 24,
          cy: y,
          dir: dirToEnemy,
          targetX: enemyX,
          targetY: enemyY,
          age: 0,
          life: 360
        });

        screenFlashes.push({
          color: 'rgba(253, 230, 138, 0.22)',
          age: 0,
          life: 150
        });

        // 朝敌方迸射的香槟金×冰蓝弹反火花与棱晶碎片
        for (var fp = 0; fp < 26; fp++) {
          var spread = (Math.random() - 0.5) * 1.15;
          var spd = 210 + Math.random() * 280;
          spawnParticle({
            x: x + dirToEnemy * 22,
            y: y + (Math.random() - 0.5) * 32,
            vx: dirToEnemy * Math.cos(spread) * spd,
            vy: Math.sin(spread) * spd - 20,
            drag: 0.90,
            size: fp % 2 === 0 ? (4.5 + Math.random() * 3) : (3 + Math.random() * 2.5),
            color: fp % 3 === 0 ? PALETTE.goldCore : (fp % 2 === 0 ? PALETTE.goldBright : PALETTE.icePrism),
            outline: PALETTE.inkAbyss,
            shape: fp % 3 === 0 ? 'streak' : 'diamond',
            rot: spread,
            vrot: (Math.random() - 0.5) * 9,
            life: 380 + Math.random() * 220
          });
        }

        spawnCallout({
          text: res.calloutText,
          x: x + dirToEnemy * 26,
          y: y - 88,
          color: PALETTE.goldBright,
          accent: PALETTE.icePrism,
          outline: PALETTE.inkAbyss,
          scale: 1.12,
          prominent: true,
          life: 980
        });
        return res;
      }

      if (res.isOverwhelmed) {
        // === 越级强敌威压（如面对神级风神 d = -4） ===
        // 晶盾迎击瞬间产生锐利裂纹 + 向后飞溅细碎冰碴 + 贯穿冲击波，绝不印笨拙「越4阶威压」说明文！
        audio.play('block_crush');
        addShake(res.shake);

        shields.push({
          mode: 'crushed',
          x: x + dirToEnemy * 10,
          y: y,
          dir: dirToEnemy,
          rx: 32,
          ry: 54,
          attackColor: attackColor,
          age: 0,
          life: 520
        });

        // 贯穿式敌方风压/威压光刃穿透晶盾向希尔维亚身后扫过
        slashes.push({
          kind: 'crush_pierce',
          cx: x,
          cy: y,
          dir: -dirToEnemy,
          attackColor: attackColor,
          age: 0,
          life: 360
        });

        // 大量细碎锐利冰碴与晶屑向希尔维亚身后猛烈飞溅
        for (var cr = 0; cr < 34; cr++) {
          var backAng = (Math.random() - 0.5) * 1.18;
          var backSpd = 210 + Math.random() * 340;
          spawnParticle({
            x: x + dirToEnemy * 6 + (Math.random() - 0.5) * 16,
            y: y + (Math.random() - 0.5) * 54,
            vx: -dirToEnemy * Math.cos(backAng) * backSpd,
            vy: Math.sin(backAng) * backSpd - 34,
            ay: 310,
            drag: 0.95,
            size: 2.8 + Math.random() * 5.0,
            color: cr % 4 === 0 ? PALETTE.white : (cr % 3 === 0 ? PALETTE.icePale : (cr % 2 === 0 ? PALETTE.iceCyan : attackColor)),
            outline: PALETTE.inkDeep,
            shape: cr % 5 === 0 ? 'pixel' : 'shard',
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 15,
            life: 480 + Math.random() * 260
          });
        }
        // 身后伴随扬起的冰雾散尘
        for (var cm = 0; cm < 8; cm++) {
          spawnParticle({
            x: x - dirToEnemy * (18 + Math.random() * 44),
            y: y + (Math.random() - 0.5) * 40,
            vx: -dirToEnemy * (90 + Math.random() * 140),
            vy: (Math.random() - 0.5) * 55,
            drag: 0.94,
            size: 8 + Math.random() * 8,
            color: PALETTE.iceSnow,
            shape: 'mist',
            alpha: 0.45,
            life: 360 + Math.random() * 160
          });
        }

        // 纯战斗数字爆字（绝不印笨拙说明文！）
        spawnCallout({
          text: res.calloutText,
          x: x - dirToEnemy * 10,
          y: y - 76,
          color: '#E2E8F0',
          accent: PALETTE.iceCyan,
          outline: PALETTE.inkAbyss,
          scale: 1.0,
          cracked: true,
          life: 840
        });
        return res;
      }

      // === 同阶 / 低敌 2 阶常规晶盾格挡 ===
      // 干脆的盾面斜切受击波纹与清脆晶盾震鸣
      audio.play('block_guard');
      if (res.hitStopMs > 0) triggerHitStop(res.hitStopMs, { kind: 'block_guard', grade: res.grade });
      addShake(res.shake);

      shields.push({
        mode: 'guard',
        grade: res.grade,
        x: x + dirToEnemy * 12,
        y: y,
        dir: dirToEnemy,
        rx: res.grade === 'perfect' ? 35 : (res.grade === 'great' ? 31 : 27),
        ry: res.grade === 'perfect' ? 56 : (res.grade === 'great' ? 50 : 44),
        age: 0,
        life: 440
      });

      shockwaves.push({
        kind: 'shield',
        x: x + dirToEnemy * 12,
        y: y,
        r0: 26,
        r1: res.grade === 'perfect' ? 76 : 62,
        color: res.grade === 'perfect' ? PALETTE.sapphireHi : PALETTE.iceCyan,
        coreColor: PALETTE.white,
        lineWidth: res.grade === 'perfect' ? 3.8 : 2.8,
        age: 0,
        life: 320
      });

      var sparkN = res.grade === 'perfect' ? 16 : (res.grade === 'great' ? 11 : 7);
      for (var sg = 0; sg < sparkN; sg++) {
        // 沿斜切切线方向散开
        var tangent = (sg % 2 === 0 ? -1 : 1) * (0.75 + Math.random() * 0.65);
        var gSpd = 120 + Math.random() * 145;
        spawnParticle({
          x: x + dirToEnemy * 16,
          y: y + (Math.random() - 0.5) * 20,
          vx: dirToEnemy * Math.cos(tangent) * gSpd * 0.7,
          vy: Math.sin(tangent) * gSpd,
          drag: 0.91,
          size: 3 + Math.random() * 2.5,
          color: sg % 3 === 0 ? PALETTE.white : (sg % 2 === 0 ? PALETTE.icePrism : PALETTE.sapphireHi),
          outline: PALETTE.inkAbyss,
          shape: 'diamond',
          life: 300 + Math.random() * 150
        });
      }

      spawnCallout({
        text: res.calloutText,
        x: x,
        y: y - 64,
        color: res.grade === 'perfect' ? PALETTE.iceSnow : (res.grade === 'great' ? PALETTE.icePale : PALETTE.iceCyan),
        accent: res.grade === 'perfect' ? PALETTE.sapphireHi : PALETTE.iceCyan,
        outline: PALETTE.inkAbyss,
        scale: res.grade === 'perfect' ? 1.12 : 1.0,
        life: 820
      });
      return res;
    }

    function startBlockPrompt(opts) {
      opts = opts || {};
      var preset = opts.preset && BLOCK_PRESETS[opts.preset] ? BLOCK_PRESETS[opts.preset] : null;
      var tierDiff = opts.tierDiff != null ? Number(opts.tierDiff) : (preset ? preset.tierDiff : 0);
      var x = opts.x != null ? opts.x : width * 0.30;
      var y = opts.y != null ? opts.y : height * 0.52;
      var enemyX = opts.enemyX != null ? opts.enemyX : width * 0.72;
      var enemyY = opts.enemyY != null ? opts.enemyY : height * 0.48;
      var durationMs = opts.durationMs != null ? opts.durationMs : (preset ? preset.durationMs : 640);
      var telegraphMs = opts.telegraphMs != null ? opts.telegraphMs : (preset ? preset.telegraphMs : 220);

      activeSequence = null;
      activeBlock = {
        id: 'blk_' + Math.round(clockMs) + '_' + Math.floor(Math.random() * 9999),
        presetId: preset ? preset.id : (opts.preset || 'custom'),
        tierDiff: tierDiff,
        x: x,
        y: y,
        enemyX: enemyX,
        enemyY: enemyY,
        durationMs: durationMs,
        telegraphMs: telegraphMs,
        elapsedMs: 0,
        radius: opts.radius || 34,
        attackColor: opts.attackColor || (preset ? preset.telegraphColor : PALETTE.amberWarn),
        attackCore: opts.attackCore || (preset ? preset.telegraphCore : PALETTE.white),
        onBlockResolve: typeof opts.onBlockResolve === 'function' ? opts.onBlockResolve : null
      };

      audio.play('enemy_telegraph');
      return activeBlock.id;
    }

    function resolveActiveBlock(keyMatch, isTimeout, pressedKey) {
      if (!activeBlock) return null;
      var blk = activeBlock;
      activeBlock = null;

      var timingRes = evaluateTiming(blk.elapsedMs, blk.durationMs, 0, {
        keyMatch: keyMatch,
        timeout: isTimeout
      });
      var blockRes = spawnBlockFeedback(timingRes.grade, blk.tierDiff, blk.x, blk.y, {
        enemyX: blk.enemyX,
        enemyY: blk.enemyY,
        attackColor: blk.attackColor
      });
      blockRes.deltaMs = timingRes.deltaMs;
      blockRes.elapsedMs = timingRes.elapsedMs;
      blockRes.durationMs = blk.durationMs;
      blockRes.reason = timingRes.reason;
      blockRes.pressedKey = pressedKey || null;
      blockRes.presetId = blk.presetId;

      if (blk.onBlockResolve) {
        try { blk.onBlockResolve(blockRes); } catch (e) {}
      }
      return blockRes;
    }

    /* ---------- 3) 第 5 线剑技 & 风行残像高精像素特效 ---------- */

    // 3A. 普通攻击：1 拍干脆寒光斩
    function playBasicAttack(opts) {
      opts = opts || {};
      var x = opts.x != null ? opts.x : width * 0.65;
      var y = opts.y != null ? opts.y : height * 0.50;
      var grade = opts.grade || 'great';
      var isPerf = grade === 'perfect';

      audio.play('sword_basic');
      if (isPerf) {
        triggerHitStop(45, { kind: 'basic_attack_perfect' });
        addShake(4.2);
      } else {
        addShake(2.2);
      }

      slashes.push({
        kind: 'basic_attack',
        cx: x - 24,
        cy: y + 26,
        hitX: x,
        hitY: y,
        radiusX: isPerf ? 78 : 68,
        radiusY: isPerf ? 52 : 44,
        rot: 0.45,
        startAng: -2.35,
        endAng: 0.25,
        thickness: isPerf ? 18 : 14,
        isPerfect: isPerf,
        age: 0,
        life: 360
      });

      // 命中十字寒光星芒 + 像素碎星火花
      var sparkN = isPerf ? 18 : 11;
      for (var i = 0; i < sparkN; i++) {
        var ang = -0.45 + (Math.random() - 0.5) * 1.45;
        var spd = 120 + Math.random() * 210;
        spawnParticle({
          x: x + (Math.random() - 0.5) * 18,
          y: y + (Math.random() - 0.5) * 18,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.90,
          size: i % 3 === 0 ? 4 : 3,
          color: (isPerf && i % 4 === 0) ? PALETTE.goldBright : (i % 2 === 0 ? PALETTE.white : PALETTE.iceCyan),
          outline: PALETTE.inkDeep,
          shape: i % 2 === 0 ? 'streak' : 'pixel',
          rot: ang,
          life: 260 + Math.random() * 140
        });
      }
    }

    // 3B. 卷三「送刀斩」：2 拍覆水极薄冰锋弧斩 + 化水散雾
    function playSwordSendSlash(opts) {
      opts = opts || {};
      var x = opts.x != null ? opts.x : width * 0.65;
      var y = opts.y != null ? opts.y : height * 0.50;
      var grade = opts.grade || 'perfect';
      var isPerf = grade === 'perfect';
      var phase = opts.phase; // 0 = 第一拍覆水起势弧斩, 1 = 第二拍极薄冰锋+化水散雾, undefined = 完整两拍编排

      function triggerPhase0(delayOffset) {
        if (!delayOffset) audio.play('sword_send_1');
        addShake(2.6);
        slashes.push({
          kind: 'send_water_arc',
          cx: x + 16,
          cy: y - 22,
          hitX: x,
          hitY: y,
          radiusX: 84,
          radiusY: 46,
          rot: -0.35,
          startAng: 2.85,
          endAng: 0.25,
          thickness: 16,
          isPerfect: isPerf,
          age: -(delayOffset || 0),
          life: 440
        });
        // 覆水飞溅细水珠
        for (var w = 0; w < 16; w++) {
          var wa = -0.35 + (Math.random() - 0.5) * 1.6;
          var wspd = 95 + Math.random() * 165;
          spawnParticle({
            x: x + (Math.random() - 0.5) * 38,
            y: y + (Math.random() - 0.5) * 24,
            vx: Math.cos(wa) * wspd,
            vy: Math.sin(wa) * wspd - 35,
            ay: 260,
            drag: 0.94,
            size: 3 + Math.random() * 2.5,
            color: w % 3 === 0 ? PALETTE.white : (w % 2 === 0 ? PALETTE.waterFoam : PALETTE.waterHi),
            outline: PALETTE.waterAbyss,
            shape: 'pixel',
            life: 380 + Math.random() * 180
          });
        }
      }

      function triggerPhase1(delayOffset) {
        if (!delayOffset) {
          audio.play('sword_send_2');
          if (isPerf) triggerHitStop(45, { kind: 'sword_send_perfect' });
          addShake(isPerf ? 4.6 : 3.2);
        }
        // 极薄冰锋反手剪裁弧斩（更锐更薄更亮，横贯目标身躯构成水冰十字剪）
        slashes.push({
          kind: 'send_ice_razor',
          cx: x - 20,
          cy: y + 26,
          hitX: x,
          hitY: y,
          radiusX: 90,
          radiusY: 46,
          rot: 0.36,
          startAng: -2.42,
          endAng: 0.28,
          thickness: 11,
          isPerfect: isPerf,
          age: -(delayOffset || 0),
          life: 460
        });

        // 化水散雾：极薄冰膜融解为上升水雾 + 晶莹坠落细水滴
        for (var m = 0; m < 18; m++) {
          var mx = x + (Math.random() - 0.5) * 96;
          var my = y + (Math.random() - 0.5) * 52;
          spawnParticle({
            x: mx,
            y: my,
            vx: (Math.random() - 0.5) * 42,
            vy: -28 - Math.random() * 48,
            ay: -12,
            drag: 0.96,
            size: 8 + Math.random() * 10,
            color: m % 2 === 0 ? PALETTE.waterMist : PALETTE.waterFoam,
            shape: 'mist',
            alpha: 0.56,
            life: 580 + Math.random() * 260
          });
        }
        for (var dr = 0; dr < 16; dr++) {
          spawnParticle({
            x: x + (Math.random() - 0.5) * 86,
            y: y + (Math.random() - 0.5) * 44,
            vx: (Math.random() - 0.5) * 85,
            vy: -20 + Math.random() * 45,
            ay: 320,
            drag: 0.95,
            size: dr % 3 === 0 ? 4 : 2.5,
            color: dr % 3 === 0 ? PALETTE.white : PALETTE.waterFoam,
            outline: PALETTE.waterDeep,
            shape: 'diamond',
            life: 460 + Math.random() * 220
          });
        }
      }

      if (phase === 0) {
        triggerPhase0(0);
      } else if (phase === 1) {
        triggerPhase1(0);
      } else {
        // 独立演示完整 2 拍送刀斩
        triggerPhase0(0);
        triggerPhase1(210);
      }
    }

    // 3C. 「风行残像」：3 重渐隐冰青风影残像 + 疾风螺旋环
    function playWindAfterimage(opts) {
      opts = opts || {};
      var toX = opts.x != null ? opts.x : (opts.toX != null ? opts.toX : width * 0.34);
      var toY = opts.y != null ? opts.y : (opts.toY != null ? opts.toY : height * 0.56);
      var fromX = opts.fromX != null ? opts.fromX : (toX - 132);
      var fromY = opts.fromY != null ? opts.fromY : (toY + 12);
      var flipX = !!opts.flipX;
      var px = Math.max(2, Math.round(opts.px || 3));

      audio.play('wind_afterimage');
      addShake(2.0);

      // 3 重渐隐冰青风影残像（沿位移轨迹等距排布、逐层递减透明度与风蚀错切）
      var alphas = [0.34, 0.58, 0.84];
      var shears = [1.4, 0.85, 0.35];
      for (var i = 0; i < 3; i++) {
        var frac = i / 2.25; // 0, 0.44, 0.89 留出终点主身位呼吸空间
        afterimages.push({
          x: lerp(fromX, toX, frac),
          y: lerp(fromY, toY, frac),
          baseAlpha: alphas[i],
          shear: shears[i],
          flipX: flipX,
          px: px,
          spriteSource: opts.spriteSource || null,
          spriteW: opts.spriteW || 72,
          spriteH: opts.spriteH || 84,
          age: -i * 58,
          life: 680 + i * 70
        });
      }

      // 疾风螺旋环（落点周身 3 层斜切旋转像素风环 + 贯穿气刃流痕）
      windRings.push({
        fromX: fromX,
        fromY: fromY,
        x: toX,
        y: toY,
        age: 0,
        life: 780
      });

      // 伴随冰青风叶与像素疾风微粒
      for (var wp = 0; wp < 22; wp++) {
        var fracP = Math.random();
        var sx = lerp(fromX, toX, fracP) + (Math.random() - 0.5) * 32;
        var sy = lerp(fromY, toY, fracP) - 18 + (Math.random() - 0.5) * 58;
        spawnParticle({
          x: sx,
          y: sy,
          vx: (toX - fromX) * (0.9 + Math.random() * 0.9),
          vy: -35 - Math.random() * 65,
          drag: 0.93,
          size: wp % 3 === 0 ? 4 : 2.5,
          color: wp % 3 === 0 ? PALETTE.windMist : (wp % 2 === 0 ? PALETTE.windPale : PALETTE.windBright),
          outline: PALETTE.windDeep,
          shape: wp % 2 === 0 ? 'streak' : 'diamond',
          rot: Math.atan2(toY - fromY, toX - fromX),
          life: 440 + Math.random() * 260
        });
      }
    }

    function playSwordVfx(skillId, opts) {
      if (skillId === 'basic_attack') return playBasicAttack(opts);
      if (skillId === 'sword_send_slash' || skillId === 'sword_water_edge') return playSwordSendSlash(opts);
      if (skillId === 'wind_afterimage' || skillId === 'sword_wind_afterimage') return playWindAfterimage(opts);
      return playBasicAttack(opts);
    }

    /* ---------- 5. 键盘与程序化触发 ---------- */
    function triggerKey(rawKey, opts) {
      opts = opts || {};
      var key = normalizeKeyInput(rawKey);
      if (!key) return null;

      // 空格优先触发激活中的格挡
      if (activeBlock) {
        if (key === 'SPACE') {
          if (opts.elapsedMs != null) activeBlock.elapsedMs = Number(opts.elapsedMs);
          return resolveActiveBlock(true, false, key);
        }
        return null;
      }

      // 攻击缩圈接收 Q/W/E/A/S/D
      if (activeSequence && activeSequence.state === 'active') {
        if (KEY_POOL.indexOf(key) === -1) return null;
        var beat = activeSequence.beats[activeSequence.currentIndex];
        if (opts.elapsedMs != null) activeSequence.elapsedMs = Number(opts.elapsedMs);
        var match = key === beat.key;
        return resolveCurrentTimingBeat(match, false, key);
      }

      return null;
    }

    function handleKeyDown(ev) {
      if (!keyboardEnabled) return;
      if (!ev) return;
      if (ev.repeat) return;
      if (ev.target && ev.target.tagName) {
        var tag = ev.target.tagName.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      var key = normalizeKeyInput(ev);
      if (!key) return;
      if (activeBlock && key === 'SPACE') {
        if (typeof ev.preventDefault === 'function') ev.preventDefault();
        triggerKey(key);
        return;
      }
      if (activeSequence && activeSequence.state === 'active' && KEY_POOL.indexOf(key) !== -1) {
        if (typeof ev.preventDefault === 'function') ev.preventDefault();
        triggerKey(key);
      }
    }

    function attachKeyboardListener() {
      if (keyListenerAttached || typeof window === 'undefined') return;
      window.addEventListener('keydown', handleKeyDown, { passive: false });
      keyListenerAttached = true;
    }

    function detachKeyboardListener() {
      if (!keyListenerAttached || typeof window === 'undefined') return;
      window.removeEventListener('keydown', handleKeyDown);
      keyListenerAttached = false;
    }

    /* ---------- 6. 帧推进（支持 45ms 顿帧 & 确定性步进） ---------- */
    function step(rawDtMs) {
      var dt = clamp(Number(rawDtMs) || 16.67, 0, 80);
      clockMs += dt;

      // 震屏衰减（顿帧期间保持细微张力抖动）
      if (shakeTrauma > 0) {
        shakeTrauma = Math.max(0, shakeTrauma - dt / 260);
        var amp = shakeMag * shakeTrauma * shakeTrauma;
        shakeOffset.x = (Math.sin(clockMs * 0.085) + Math.cos(clockMs * 0.143)) * 0.5 * amp;
        shakeOffset.y = (Math.cos(clockMs * 0.097) - Math.sin(clockMs * 0.131)) * 0.5 * amp;
      } else {
        shakeOffset.x = 0;
        shakeOffset.y = 0;
        shakeMag = 0;
      }

      // 45ms 顿帧：冻结粒子/冲击运动，仅微幅推进屏幕闪光，制造利落打击卡肉感
      if (hitStopRemainMs > 0) {
        hitStopRemainMs = Math.max(0, hitStopRemainMs - dt);
        for (var sf = screenFlashes.length - 1; sf >= 0; sf--) {
          screenFlashes[sf].age += dt * 0.35;
          if (screenFlashes[sf].age >= screenFlashes[sf].life) screenFlashes.splice(sf, 1);
        }
        return;
      }

      // 1) 更新缩圈连拍状态机
      if (activeSequence) {
        if (activeSequence.state === 'gap') {
          activeSequence.gapRemainMs -= dt;
          if (activeSequence.gapRemainMs <= 0) {
            activeSequence.state = 'active';
            activeSequence.elapsedMs = 0;
            audio.play('ring_spawn', { tier: activeSequence.overcast.tier });
          }
        } else if (activeSequence.state === 'active') {
          activeSequence.elapsedMs += dt;
          var curBeat = activeSequence.beats[activeSequence.currentIndex];
          var curWin = getTimingWindows(curBeat.durationMs);
          if (activeSequence.elapsedMs > curBeat.durationMs + curWin.graceMs) {
            resolveCurrentTimingBeat(true, true, null);
          }
        }
      }

      // 2) 更新空格格挡时机环
      if (activeBlock) {
        activeBlock.elapsedMs += dt;
        var blkWin = getTimingWindows(activeBlock.durationMs);
        if (activeBlock.elapsedMs > activeBlock.durationMs + blkWin.graceMs) {
          resolveActiveBlock(true, true, null);
        }
      }

      // 3) 推进各类 VFX 实体
      var i;
      for (i = shockwaves.length - 1; i >= 0; i--) {
        shockwaves[i].age += dt;
        if (shockwaves[i].age >= shockwaves[i].life) shockwaves.splice(i, 1);
      }
      for (i = starbursts.length - 1; i >= 0; i--) {
        starbursts[i].age += dt;
        if (starbursts[i].age >= starbursts[i].life) starbursts.splice(i, 1);
      }
      for (i = shields.length - 1; i >= 0; i--) {
        shields[i].age += dt;
        if (shields[i].age >= shields[i].life) shields.splice(i, 1);
      }
      for (i = slashes.length - 1; i >= 0; i--) {
        var sl = slashes[i];
        var prevAge = sl.age;
        sl.age += dt;
        if (prevAge < 0 && sl.age >= 0 && sl.kind === 'send_ice_razor') {
          audio.play('sword_send_2');
          addShake(sl.isPerfect ? 4.4 : 3.0);
        }
        if (sl.age >= sl.life) slashes.splice(i, 1);
      }
      for (i = afterimages.length - 1; i >= 0; i--) {
        afterimages[i].age += dt;
        if (afterimages[i].age >= afterimages[i].life) afterimages.splice(i, 1);
      }
      for (i = windRings.length - 1; i >= 0; i--) {
        windRings[i].age += dt;
        if (windRings[i].age >= windRings[i].life) windRings.splice(i, 1);
      }
      for (i = callouts.length - 1; i >= 0; i--) {
        callouts[i].age += dt;
        if (callouts[i].age >= callouts[i].life) callouts.splice(i, 1);
      }
      for (i = screenFlashes.length - 1; i >= 0; i--) {
        screenFlashes[i].age += dt;
        if (screenFlashes[i].age >= screenFlashes[i].life) screenFlashes.splice(i, 1);
      }

      var dtSec = dt / 1000;
      var dragScale = Math.pow(0.95, dt / 16.67);
      for (i = particles.length - 1; i >= 0; i--) {
        var pt = particles[i];
        pt.age += dt;
        if (pt.age >= pt.life) {
          particles.splice(i, 1);
          continue;
        }
        var dFactor = pt.drag !== 0.95 ? Math.pow(pt.drag, dt / 16.67) : dragScale;
        pt.vx = (pt.vx + pt.ax * dtSec) * dFactor;
        pt.vy = (pt.vy + pt.ay * dtSec) * dFactor;
        pt.x += pt.vx * dtSec;
        pt.y += pt.vy * dtSec;
        pt.rot += pt.vrot * dtSec;
      }
    }

    /* ---------- 7. 渲染管线（纯冰晶棱镜 + 高精像素艺术） ---------- */

    function renderActiveTimingRing(c) {
      if (!activeSequence || activeSequence.state !== 'active') return;
      var seq = activeSequence;
      var beat = seq.beats[seq.currentIndex];
      var tier = seq.overcast.tier;
      var dur = beat.durationMs;
      var win = getTimingWindows(dur);
      var p = seq.elapsedMs / dur; // 0 -> 1.0 (倒计时结束甜点) -> 1.155
      var rTarget = beat.radius || 30;
      var rStart = rTarget * 2.55;
      // 外框匀速收缩至内框高亮甜点边（超过 1.0 微幅内压后保持紧贴）
      var rOuter = p <= 1 ? lerp(rStart, rTarget, p) : Math.max(rTarget * 0.90, rTarget - (p - 1) * rTarget * 0.72);
      var deltaMs = dur - seq.elapsedMs;
      var inPerfectZone = deltaMs <= win.perfectPreMs && deltaMs >= -win.perfectPostMs;
      var inGreatZone = !inPerfectZone && deltaMs <= win.greatPreMs && deltaMs >= -win.greatPostMs;
      var cx = beat.x;
      var cy = beat.y;

      c.save();

      // 1) 底层淡冰晶折射光晕（无圆边框，仅柔和径向微光增加可读性）
      var haloGrad = c.createRadialGradient(cx, cy, rTarget * 0.2, cx, cy, rTarget * 2.4);
      if (tier === 3) {
        haloGrad.addColorStop(0, 'rgba(253, 230, 138, 0.24)');
        haloGrad.addColorStop(0.55, 'rgba(22, 88, 235, 0.14)');
        haloGrad.addColorStop(1, 'rgba(22, 88, 235, 0)');
      } else {
        haloGrad.addColorStop(0, 'rgba(125, 211, 252, 0.22)');
        haloGrad.addColorStop(0.6, 'rgba(22, 88, 235, 0.10)');
        haloGrad.addColorStop(1, 'rgba(22, 88, 235, 0)');
      }
      c.fillStyle = haloGrad;
      c.fillRect(cx - rTarget * 2.5, cy - rTarget * 2.5, rTarget * 5, rTarget * 5);

      // 2) 内框高亮甜点边 + 皇家蓝宝石切面按键底板
      traceChamferedOctagon(c, cx, cy, rTarget, 0);
      var plateGrad = c.createLinearGradient(cx - rTarget, cy - rTarget, cx + rTarget, cy + rTarget);
      plateGrad.addColorStop(0, '#2E77F8');
      plateGrad.addColorStop(0.495, '#1658EB');
      plateGrad.addColorStop(0.505, '#0E2B78');
      plateGrad.addColorStop(1, '#081A54');
      c.fillStyle = plateGrad;
      c.globalAlpha = 0.90;
      c.fill();
      c.globalAlpha = 1;

      // 内框甜点高亮棱边（临近倒计时结束时显著点亮）
      var sweetColor = inPerfectZone
        ? (tier >= 3 ? PALETTE.goldBright : PALETTE.white)
        : (inGreatZone ? PALETTE.icePrism : PALETTE.icePale);
      drawPrismOctagonRing(c, cx, cy, rTarget, {
        rot: 0,
        color: sweetColor,
        coreColor: PALETTE.white,
        lineWidth: inPerfectZone ? 3.8 : 2.6,
        glow: inPerfectZone ? 12 : (inGreatZone ? 6 : 0),
        cornerTicks: true,
        tickSize: inPerfectZone ? 6.2 : 4.2
      });

      // 甜点区间四向星芒提示
      if (inPerfectZone) {
        var pulse = 0.72 + 0.28 * Math.sin(clockMs * 0.05);
        c.save();
        c.strokeStyle = tier >= 3 ? PALETTE.goldBright : PALETTE.white;
        c.lineWidth = 1.6;
        c.globalAlpha = pulse;
        for (var t = 0; t < 4; t++) {
          var ta = (t * Math.PI) / 2;
          c.beginPath();
          c.moveTo(cx + Math.cos(ta) * (rTarget + 3), cy + Math.sin(ta) * (rTarget + 3));
          c.lineTo(cx + Math.cos(ta) * (rTarget + 13), cy + Math.sin(ta) * (rTarget + 13));
          c.stroke();
        }
        c.restore();
      }

      // 3) 收缩外棱镜环（随三阶魔力增幅呈现 4 级阶梯华丽度）
      var outerAlpha = clamp(p * 4.5, 0.28, 1);
      if (tier === 0) {
        // 0% 常规 (760ms)：清透冰青棱环
        drawPrismOctagonRing(c, cx, cy, rOuter, {
          rot: 0,
          color: PALETTE.iceCyan,
          coreColor: PALETTE.iceSnow,
          lineWidth: 3.0,
          alpha: outerAlpha,
          glow: 5,
          cornerTicks: true,
          tickSize: 3.8
        });
      } else if (tier === 1) {
        // 20% 一阶 (660ms)：一环亮冰蓝折光 + 内侧淡冰折射丝线 + 四角对角冰晶折光尖芒
        drawPrismOctagonRing(c, cx, cy, rOuter, {
          rot: 0,
          color: PALETTE.iceBlue,
          coreColor: PALETTE.white,
          lineWidth: 3.8,
          alpha: outerAlpha,
          glow: 10,
          cornerTicks: true,
          tickSize: 5.2
        });
        drawPrismOctagonRing(c, cx, cy, rOuter * 0.90 + rTarget * 0.10, {
          rot: 0,
          color: PALETTE.icePale,
          coreColor: PALETTE.white,
          outlineColor: 'rgba(14, 43, 120, 0.50)',
          lineWidth: 1.6,
          alpha: outerAlpha * 0.78
        });
        c.save();
        c.globalAlpha = outerAlpha * 0.92;
        for (var r1 = 0; r1 < 4; r1++) {
          var ra = Math.PI / 4 + (r1 * Math.PI) / 2;
          var rx0 = cx + Math.cos(ra) * (rOuter * 0.92);
          var ry0 = cy + Math.sin(ra) * (rOuter * 0.92);
          var rx1 = cx + Math.cos(ra) * (rOuter + 14);
          var ry1 = cy + Math.sin(ra) * (rOuter + 14);
          c.beginPath();
          c.moveTo(rx0, ry0);
          c.lineTo(rx1, ry1);
          c.strokeStyle = PALETTE.inkAbyss;
          c.lineWidth = 3.4;
          c.stroke();
          c.strokeStyle = PALETTE.icePrism;
          c.lineWidth = 1.8;
          c.stroke();
        }
        c.restore();
      } else if (tier === 2) {
        // 40% 二阶 (580ms)：双环皇家蓝交叉折光（内外环反向旋转并在倒计时终点精准重合！）
        var crossRot = Math.max(0, 1 - p) * (Math.PI / 4);
        drawPrismOctagonRing(c, cx, cy, rOuter * 1.04, {
          rot: crossRot,
          color: PALETTE.sapphire,
          coreColor: PALETTE.icePrism,
          lineWidth: 3.8,
          alpha: outerAlpha,
          glow: 11,
          cornerTicks: true,
          tickSize: 5.2
        });
        drawPrismOctagonRing(c, cx, cy, rOuter * 0.95, {
          rot: -crossRot,
          color: PALETTE.sapphireHi,
          coreColor: PALETTE.white,
          lineWidth: 2.8,
          alpha: outerAlpha * 0.94,
          glow: 8,
          cornerTicks: true,
          tickSize: 4.0
        });
      } else {
        // 60% 三阶 (500ms)：香槟金三环 + 细锐冰雷电弧脉冲！
        var triRot = Math.max(0, 1 - p) * (Math.PI / 3);
        // 外环：香槟金主棱镜
        drawPrismOctagonRing(c, cx, cy, rOuter * 1.09, {
          rot: triRot * 0.65,
          color: PALETTE.goldBright,
          coreColor: PALETTE.goldCore,
          lineWidth: 4.0,
          alpha: outerAlpha,
          glow: 14,
          cornerTicks: true,
          tickSize: 5.8
        });
        // 中环：反向旋转皇家冰蓝折光环
        drawPrismOctagonRing(c, cx, cy, rOuter, {
          rot: -triRot * 0.85,
          color: PALETTE.icePrism,
          coreColor: PALETTE.white,
          lineWidth: 3.0,
          alpha: outerAlpha * 0.96,
          glow: 10,
          cornerTicks: true,
          tickSize: 4.5
        });
        // 内随动金丝环
        drawPrismOctagonRing(c, cx, cy, Math.max(rTarget, rOuter * 0.90), {
          rot: triRot * 0.35,
          color: PALETTE.goldMid,
          coreColor: PALETTE.goldCore,
          outlineColor: 'rgba(14, 43, 120, 0.55)',
          lineWidth: 1.8,
          alpha: outerAlpha * 0.86
        });

        // 细锐冰雷电弧脉冲：在八角顶点之间跳动（每 42ms 切换一次形态）
        var arcTick = Math.floor(clockMs / 42);
        var arcCount = 4;
        for (var ai = 0; ai < arcCount; ai++) {
          var vIdx = (ai * 2 + (arcTick % 2)) % 8;
          var a1 = triRot * 0.65 + Math.PI / 8 + (vIdx * Math.PI) / 4;
          var a2 = a1 + Math.PI / 4;
          var x1 = cx + Math.cos(a1) * (rOuter * 1.09);
          var y1 = cy + Math.sin(a1) * (rOuter * 1.09);
          var x2 = cx + Math.cos(a2) * (rOuter * 1.02);
          var y2 = cy + Math.sin(a2) * (rOuter * 1.02);
          drawIceLightningArc(c, x1, y1, x2, y2, arcTick * 19 + ai * 7, 9, pixelScale);
        }
      }

      // 4) 清晰左手随机键字母（Q / W / E / A / S / D）
      c.font = '800 ' + Math.round(rTarget * 0.82) + 'px "Cinzel", "Noto Sans SC", "Segoe UI", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 4;
      c.strokeStyle = PALETTE.inkAbyss;
      c.strokeText(beat.key, cx, cy + 1);
      c.fillStyle = inPerfectZone ? (tier >= 3 ? PALETTE.goldBright : PALETTE.white) : PALETTE.white;
      c.fillText(beat.key, cx, cy + 1);

      // 5) 多拍连击极简菱形节拍刻度（位于最外环下方清爽留白区，零重叠）
      if (seq.beats.length > 1) {
        var total = seq.beats.length;
        var spacing = 16;
        var startX = cx - ((total - 1) * spacing) * 0.5;
        var pipY = cy + Math.max(rTarget + 24, rOuter * 1.12 + 16);
        // 极细 1px 横向引导棱线
        c.beginPath();
        c.moveTo(startX - 8, pipY);
        c.lineTo(startX + (total - 1) * spacing + 8, pipY);
        c.strokeStyle = 'rgba(8, 26, 84, 0.55)';
        c.lineWidth = 2;
        c.stroke();

        for (var bi = 0; bi < total; bi++) {
          var px0 = startX + bi * spacing;
          var done = bi < seq.currentIndex;
          var curr = bi === seq.currentIndex;
          var sz = curr ? 5.2 : 4.0;
          c.beginPath();
          c.moveTo(px0, pipY - sz);
          c.lineTo(px0 + sz, pipY);
          c.lineTo(px0, pipY + sz);
          c.lineTo(px0 - sz, pipY);
          c.closePath();
          if (done) {
            var resGrade = seq.results[bi] ? seq.results[bi].grade : 'good';
            c.fillStyle = resGrade === 'perfect' ? PALETTE.goldBright : (resGrade === 'bad' ? PALETTE.slateMid : PALETTE.icePrism);
          } else if (curr) {
            c.fillStyle = PALETTE.white;
          } else {
            c.fillStyle = 'rgba(14, 43, 120, 0.78)';
          }
          c.fill();
          c.strokeStyle = PALETTE.inkAbyss;
          c.lineWidth = 1.6;
          c.stroke();
        }
      }

      c.restore();
    }

    function renderActiveBlockPrompt(c) {
      if (!activeBlock) return;
      var blk = activeBlock;
      var dur = blk.durationMs;
      var win = getTimingWindows(dur);
      var p = blk.elapsedMs / dur;
      var deltaMs = dur - blk.elapsedMs;
      var inPerfect = deltaMs <= win.perfectPreMs && deltaMs >= -win.perfectPostMs;
      var inGreat = !inPerfect && deltaMs <= win.greatPreMs && deltaMs >= -win.greatPostMs;

      var cx = blk.x;
      var cy = blk.y;
      var rTarget = blk.radius || 34;
      var rOuter = p <= 1 ? lerp(rTarget * 2.45, rTarget, p) : Math.max(rTarget * 0.90, rTarget - (p - 1) * rTarget * 0.7);

      c.save();

      // 1) 敌方攻击前摇闪光（敌方星芒 + 袭向希尔维亚的锐利威胁轨迹线 + 速度折矢）
      var teleProgress = clamp(blk.elapsedMs / Math.max(120, blk.telegraphMs), 0, 1);
      var strikeTravel = clamp((blk.elapsedMs - blk.telegraphMs * 0.22) / Math.max(120, dur - blk.telegraphMs * 0.22), 0, 1);
      var headX = lerp(blk.enemyX, cx, easeInQuad(strikeTravel));
      var headY = lerp(blk.enemyY, cy, easeInQuad(strikeTravel));

      // 敌方前摇十字闪光（高辨识度八芒警告星）
      if (teleProgress < 1 || p < 0.85) {
        var glintScale = teleProgress < 0.45 ? (teleProgress / 0.45) : Math.max(0.35, 1.05 - p * 0.75);
        var glintR = (blk.tierDiff <= -3 ? 52 : 36) * glintScale;
        c.save();
        c.translate(blk.enemyX, blk.enemyY);
        c.globalAlpha = clamp(glintScale, 0, 1);
        for (var g = 0; g < 4; g++) {
          c.rotate(Math.PI / 2);
          c.beginPath();
          c.moveTo(0, -glintR);
          c.lineTo(glintR * 0.16, 0);
          c.lineTo(-glintR * 0.16, 0);
          c.closePath();
          c.fillStyle = blk.attackColor;
          c.fill();
        }
        c.beginPath();
        c.moveTo(0, -glintR * 0.48);
        c.lineTo(glintR * 0.48, 0);
        c.lineTo(0, glintR * 0.48);
        c.lineTo(-glintR * 0.48, 0);
        c.closePath();
        c.fillStyle = blk.attackCore;
        c.fill();
        c.strokeStyle = PALETTE.inkAbyss;
        c.lineWidth = 1.2;
        c.stroke();
        c.restore();
      }

      // 敌方攻势预警射线与速度折矢
      var threatW = blk.tierDiff <= -3 ? 4.4 : 2.8;
      var lineGrad = c.createLinearGradient(blk.enemyX, blk.enemyY, headX, headY);
      lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
      lineGrad.addColorStop(0.45, blk.attackColor);
      lineGrad.addColorStop(1, blk.attackCore);
      c.beginPath();
      c.moveTo(blk.enemyX, blk.enemyY);
      c.lineTo(headX, headY);
      c.strokeStyle = lineGrad;
      c.lineWidth = threatW;
      c.stroke();

      // 锐利来袭尖矢
      var atkAng = Math.atan2(cy - blk.enemyY, cx - blk.enemyX);
      c.save();
      c.translate(headX, headY);
      c.rotate(atkAng);
      c.beginPath();
      c.moveTo(-10, -7);
      c.lineTo(2, 0);
      c.lineTo(-10, 7);
      c.strokeStyle = blk.attackColor;
      c.lineWidth = 2.6;
      c.stroke();
      c.restore();

      // 2) 希尔维亚身前简洁棱镜盾形时机内框
      tracePrismShield(c, cx, cy, rTarget * 0.86, rTarget * 1.12);
      var shGrad = c.createLinearGradient(cx - rTarget, cy - rTarget, cx + rTarget, cy + rTarget);
      shGrad.addColorStop(0, 'rgba(46, 119, 248, 0.75)');
      shGrad.addColorStop(0.5, 'rgba(14, 43, 120, 0.85)');
      shGrad.addColorStop(1, 'rgba(8, 26, 84, 0.92)');
      c.fillStyle = shGrad;
      c.fill();

      c.lineWidth = inPerfect ? 4.8 : 3.2;
      c.strokeStyle = PALETTE.inkAbyss;
      c.stroke();
      c.lineWidth = inPerfect ? 3.0 : 2.0;
      c.strokeStyle = inPerfect
        ? (blk.tierDiff >= 5 ? PALETTE.goldBright : PALETTE.white)
        : (inGreat ? PALETTE.icePrism : PALETTE.iceCyan);
      c.stroke();

      // 3) 收缩棱镜外盾环
      tracePrismShield(c, cx, cy, rOuter * 0.86, rOuter * 1.12);
      c.lineWidth = 5.4;
      c.strokeStyle = 'rgba(8, 26, 84, 0.85)';
      c.stroke();
      c.lineWidth = 3.2;
      c.strokeStyle = blk.tierDiff >= 5 ? PALETTE.goldBright : (inPerfect ? PALETTE.white : PALETTE.icePrism);
      if (inPerfect) {
        c.shadowColor = blk.tierDiff >= 5 ? PALETTE.goldBright : PALETTE.iceCyan;
        c.shadowBlur = 12;
      }
      c.stroke();
      c.shadowBlur = 0;

      // 4) 切角 SPACE 键帽标（绝非圆胶囊）
      var badgeW = 62;
      var badgeH = 22;
      traceChamferedRect(c, cx - badgeW * 0.5, cy - badgeH * 0.5, badgeW, badgeH, 5);
      c.fillStyle = inPerfect ? PALETTE.sapphire : PALETTE.inkAbyss;
      c.fill();
      c.lineWidth = 1.6;
      c.strokeStyle = inPerfect ? PALETTE.goldBright : PALETTE.icePale;
      c.stroke();

      c.font = '800 11px "Cinzel", "Noto Sans SC", "Segoe UI", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = PALETTE.white;
      c.fillText('SPACE', cx, cy + 0.5);

      c.restore();
    }

    function renderShieldEffects(c) {
      for (var i = 0; i < shields.length; i++) {
        var sh = shields[i];
        var t = clamp(sh.age / sh.life, 0, 1);
        var fade = t < 0.14 ? (t / 0.14) : (1 - easeInQuad((t - 0.14) / 0.86));
        var pop = t < 0.16 ? easeOutBack(t / 0.16) : 1 + (t - 0.16) * 0.10;

        c.save();
        c.globalAlpha = clamp(fade, 0, 1);

        if (sh.mode === 'parry100') {
          // 冰蓝×淡金全开棱镜盾面
          var rx = sh.rx * pop;
          var ry = sh.ry * pop;
          tracePrismShield(c, sh.x, sh.y, rx, ry);
          var pg = c.createLinearGradient(sh.x - rx, sh.y - ry, sh.x + rx, sh.y + ry);
          pg.addColorStop(0, 'rgba(253, 230, 138, 0.82)');
          pg.addColorStop(0.35, 'rgba(125, 211, 252, 0.76)');
          pg.addColorStop(0.55, 'rgba(22, 88, 235, 0.72)');
          pg.addColorStop(1, 'rgba(232, 197, 116, 0.80)');
          c.fillStyle = pg;
          c.fill();
          c.lineWidth = 5;
          c.strokeStyle = PALETTE.inkAbyss;
          c.stroke();
          c.lineWidth = 2.8;
          c.strokeStyle = PALETTE.goldBright;
          c.stroke();

          // 内部交叉棱面切割线
          c.beginPath();
          c.moveTo(sh.x, sh.y - ry);
          c.lineTo(sh.x, sh.y + ry);
          c.moveTo(sh.x - rx * 0.85, sh.y - ry * 0.1);
          c.lineTo(sh.x + rx * 0.85, sh.y - ry * 0.1);
          c.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          c.lineWidth = 1.6;
          c.stroke();
        } else if (sh.mode === 'guard') {
          // 同阶常规晶盾：干脆盾面 + 斜切受击波纹
          var grx = sh.rx * pop;
          var gry = sh.ry * pop;
          tracePrismShield(c, sh.x, sh.y, grx, gry);
          var gg = c.createLinearGradient(sh.x - grx, sh.y - gry, sh.x + grx, sh.y + gry);
          gg.addColorStop(0, 'rgba(184, 232, 255, 0.72)');
          gg.addColorStop(0.5, 'rgba(22, 88, 235, 0.56)');
          gg.addColorStop(1, 'rgba(14, 43, 120, 0.75)');
          c.fillStyle = gg;
          c.fill();
          c.lineWidth = 4;
          c.strokeStyle = PALETTE.inkAbyss;
          c.stroke();
          c.lineWidth = 2.4;
          c.strokeStyle = sh.grade === 'perfect' ? PALETTE.white : PALETTE.icePrism;
          c.stroke();

          // 斜切受击波纹掠过盾面
          var ripT = clamp(t * 2.2, 0, 1);
          c.beginPath();
          c.moveTo(sh.x - grx * 0.75, sh.y - gry * 0.45 + ripT * 18);
          c.lineTo(sh.x + grx * 0.75, sh.y + gry * 0.35 - ripT * 12);
          c.strokeStyle = PALETTE.white;
          c.lineWidth = Math.max(1, 3.6 * (1 - ripT));
          c.stroke();
        } else if (sh.mode === 'crushed') {
          // 越级强敌威压：晶盾迎击瞬间产生锐利蛛网裂纹并崩解！
          var crx = sh.rx * (1 + t * 0.08);
          var cry = sh.ry * (1 + t * 0.08);
          var shiftX = -sh.dir * easeOutCubic(t) * 16;
          var sx = sh.x + shiftX;

          tracePrismShield(c, sx, sh.y, crx, cry);
          c.fillStyle = 'rgba(184, 232, 255, 0.36)';
          c.fill();
          c.lineWidth = 3.2;
          c.strokeStyle = PALETTE.inkAbyss;
          c.stroke();
          c.lineWidth = 1.8;
          c.strokeStyle = PALETTE.icePale;
          c.stroke();

          // 锐利蛛网裂纹（6 条折线裂痕自受击中心撕裂整个盾面）
          var crackGrow = clamp(t * 5.2, 0.25, 1);
          var crackAngles = [-2.55, -1.75, -0.75, 0.42, 1.38, 2.38];
          c.strokeStyle = PALETTE.inkAbyss;
          c.lineWidth = 2.6;
          for (var ca = 0; ca < crackAngles.length; ca++) {
            var ang = crackAngles[ca];
            var rLen = (ca % 2 === 0 ? cry * 0.92 : crx * 0.95) * crackGrow;
            var midX = sx + Math.cos(ang + 0.16) * rLen * 0.48;
            var midY = sh.y + Math.sin(ang + 0.16) * rLen * 0.48;
            var endX = sx + Math.cos(ang) * rLen;
            var endY = sh.y + Math.sin(ang) * rLen;
            c.beginPath();
            c.moveTo(sx, sh.y);
            c.lineTo(midX, midY);
            c.lineTo(endX, endY);
            c.stroke();

            // 裂纹冰白亮边
            c.strokeStyle = PALETTE.white;
            c.lineWidth = 1.1;
            c.stroke();
            c.strokeStyle = PALETTE.inkAbyss;
            c.lineWidth = 2.6;
          }
        }

        c.restore();
      }
    }

    function renderSlashes(c) {
      for (var i = 0; i < slashes.length; i++) {
        var sl = slashes[i];
        if (sl.age < 0) continue;
        var t = clamp(sl.age / sl.life, 0, 1);

        if (sl.kind === 'basic_attack') {
          var headT = easeOutQuart(clamp(t * 2.5, 0, 1));
          var tailT = easeInQuad(clamp((t - 0.18) / 0.82, 0, 1));
          var alpha = t < 0.72 ? 1 : (1 - (t - 0.72) / 0.28);
          drawPixelSlashArc(c, {
            cx: sl.cx,
            cy: sl.cy,
            radiusX: sl.radiusX,
            radiusY: sl.radiusY,
            rot: sl.rot,
            startAng: sl.startAng,
            endAng: sl.endAng,
            thickness: sl.thickness,
            px: pixelScale,
            headT: headT,
            tailT: tailT,
            alpha: alpha,
            colors: {
              outline: PALETTE.inkDeep,
              outer: sl.isPerfect ? PALETTE.sapphireHi : PALETTE.sapphire,
              mid: sl.isPerfect ? PALETTE.goldBright : PALETTE.iceCyan,
              core: PALETTE.white
            }
          });
          // 命中瞬间交叉寒光针（精准锚定目标受击中心）
          if (t > 0.14 && t < 0.58) {
            var glintA = Math.sin(((t - 0.14) / 0.44) * Math.PI);
            drawEightPointStarburst(
              c,
              sl.hitX != null ? sl.hitX : sl.cx,
              sl.hitY != null ? sl.hitY : sl.cy,
              sl.isPerfect ? 38 : 26,
              sl.isPerfect ? 22 : 14,
              glintA * 0.92,
              -0.4
            );
          }
        } else if (sl.kind === 'send_water_arc') {
          // 送刀斩第 1 拍：覆水起势弧斩（碧海蓝水带 + 极薄霜白外锋）
          var wHead = easeOutCubic(clamp(t * 2.3, 0, 1));
          var wTail = easeInQuad(clamp((t - 0.22) / 0.78, 0, 1));
          var wAlpha = t < 0.68 ? 0.96 : (1 - (t - 0.68) / 0.32) * 0.96;
          drawPixelSlashArc(c, {
            cx: sl.cx,
            cy: sl.cy,
            radiusX: sl.radiusX,
            radiusY: sl.radiusY,
            rot: sl.rot,
            startAng: sl.startAng,
            endAng: sl.endAng,
            thickness: sl.thickness,
            px: pixelScale,
            headT: wHead,
            tailT: wTail,
            alpha: wAlpha,
            colors: {
              outline: PALETTE.waterAbyss,
              outer: PALETTE.waterMid,
              mid: PALETTE.waterFoam,
              core: PALETTE.white
            }
          });
        } else if (sl.kind === 'send_ice_razor') {
          // 送刀斩第 2 拍：极薄冰锋弧斩 + 冰膜闪断
          var rHead = easeOutQuart(clamp(t * 2.8, 0, 1));
          var rTail = easeInQuad(clamp((t - 0.20) / 0.80, 0, 1));
          var rAlpha = t < 0.65 ? 1 : (1 - (t - 0.65) / 0.35);
          drawPixelSlashArc(c, {
            cx: sl.cx,
            cy: sl.cy,
            radiusX: sl.radiusX,
            radiusY: sl.radiusY,
            rot: sl.rot,
            startAng: sl.startAng,
            endAng: sl.endAng,
            thickness: sl.thickness,
            px: pixelScale,
            headT: rHead,
            tailT: rTail,
            alpha: rAlpha,
            colors: {
              outline: PALETTE.waterDeep,
              outer: PALETTE.iceCyan,
              mid: PALETTE.iceSnow,
              core: PALETTE.white
            }
          });
          // 极薄冰锋残光折线（精准锚定目标受击中心）
          if (t > 0.16 && t < 0.62) {
            var fa = Math.sin(((t - 0.16) / 0.46) * Math.PI);
            drawEightPointStarburst(
              c,
              sl.hitX != null ? sl.hitX : sl.cx,
              sl.hitY != null ? sl.hitY : sl.cy,
              46,
              25,
              fa * 0.90,
              0.32
            );
          }
        } else if (sl.kind === 'parry_rebound') {
          // 100% 完美弹反反向月牙气浪（朝敌方飞出）
          var rt = easeOutCubic(t);
          var rx = lerp(sl.cx, sl.cx + sl.dir * 165, rt);
          var ry = lerp(sl.cy, sl.targetY, rt * 0.45);
          drawPixelSlashArc(c, {
            cx: rx,
            cy: ry,
            radiusX: 46 + rt * 32,
            radiusY: 56 + rt * 22,
            rot: sl.dir > 0 ? 0 : Math.PI,
            startAng: -1.15,
            endAng: 1.15,
            thickness: 14 * (1 - t * 0.45),
            px: pixelScale,
            headT: 1,
            tailT: 0,
            alpha: 1 - t,
            colors: {
              outline: PALETTE.inkAbyss,
              outer: PALETTE.icePrism,
              mid: PALETTE.goldBright,
              core: PALETTE.white
            }
          });
        } else if (sl.kind === 'crush_pierce') {
          // 越级威压贯穿气刃：锐利穿透盾面掠向身后
          var pt = easeOutQuart(t);
          var len = 148 * pt;
          var x0 = sl.cx - sl.dir * 26;
          var x1 = sl.cx + sl.dir * len;
          c.save();
          c.globalAlpha = 1 - t;
          c.beginPath();
          c.moveTo(x0, sl.cy);
          c.lineTo(x1, sl.cy - 9 * (1 - t));
          c.lineTo(x1 + sl.dir * 28, sl.cy);
          c.lineTo(x1, sl.cy + 9 * (1 - t));
          c.closePath();
          c.fillStyle = sl.attackColor || PALETTE.windTeal;
          c.fill();
          c.strokeStyle = PALETTE.white;
          c.lineWidth = 1.6;
          c.stroke();
          c.restore();
        }
      }
    }

    function renderWindAfterimages(c) {
      // 1) 3 重渐隐冰青风影残像
      for (var i = 0; i < afterimages.length; i++) {
        var af = afterimages[i];
        if (af.age < 0) continue;
        var t = clamp(af.age / af.life, 0, 1);
        var env = t < 0.12 ? (t / 0.12) : (1 - easeInQuad((t - 0.12) / 0.88));
        drawPixelAfterimageSilhouette(c, af.x, af.y, {
          px: af.px,
          flipX: af.flipX,
          alpha: af.baseAlpha * env,
          shear: af.shear + t * 0.65,
          spriteSource: af.spriteSource,
          spriteW: af.spriteW,
          spriteH: af.spriteH
        });
      }

      // 2) 疾风螺旋环与贯穿气流
      for (var j = 0; j < windRings.length; j++) {
        var wr = windRings[j];
        var wt = clamp(wr.age / wr.life, 0, 1);
        var wAlpha = wt < 0.15 ? (wt / 0.15) : (1 - easeInQuad((wt - 0.15) / 0.85));

        c.save();
        c.globalAlpha = clamp(wAlpha, 0, 1);

        // 贯穿起止点的像素疾风丝带（带深青底影增强亮底可读性）
        var bandCount = 3;
        for (var b = 0; b < bandCount; b++) {
          var by = wr.y - 44 + b * 22;
          var fy = wr.fromY - 44 + b * 22;
          var prog = clamp(wt * 2.1 - b * 0.08, 0, 1);
          var lx1 = lerp(wr.fromX, wr.x, prog);
          var lx0 = lerp(wr.fromX, wr.x, Math.max(0, prog - 0.72));
          var ly1 = lerp(fy, by, prog);
          var ly0 = lerp(fy, by, Math.max(0, prog - 0.72));

          c.beginPath();
          c.moveTo(lx0, ly0);
          c.lineTo(lx1, ly1);
          c.strokeStyle = 'rgba(18, 70, 64, 0.45)';
          c.lineWidth = b === 1 ? 5 : 3.5;
          c.stroke();
          c.strokeStyle = b === 1 ? PALETTE.white : PALETTE.windPale;
          c.lineWidth = b === 1 ? 2.6 : 1.8;
          c.stroke();
        }

        // 落点 3 重连续像素疾风螺旋环（密集采样 + 双层青白风带 + 深青外缘描边）
        for (var r = 0; r < 3; r++) {
          var rt = (wt * 1.35 + r * 0.30) % 1;
          var ringY = wr.y + 18 - rt * 86;
          var rx = 38 + r * 11 + rt * 14;
          var ry = 11 + r * 3.2;
          var spin = wt * 7.2 + r * 2.05;
          var segs = 68;
          var px = pixelScale;

          for (var s = 0; s < segs; s++) {
            var frac = s / segs;
            var ang = spin + frac * Math.PI * 1.55;
            var gx = Math.round((wr.x + Math.cos(ang) * rx) / px) * px;
            var gy = Math.round((ringY + Math.sin(ang) * ry) / px) * px;
            var bandH = frac > 0.35 && frac < 0.92 ? px * 2 : px;
            // 外缘深翠阴影点保证雪瓷亮底清晰锐利
            c.fillStyle = PALETTE.windDeep;
            c.fillRect(gx, gy + bandH, px, px);
            // 主风带
            c.fillStyle = frac > 0.78 ? PALETTE.white : (frac > 0.42 ? PALETTE.windPale : PALETTE.windTeal);
            c.fillRect(gx, gy, px * (frac > 0.72 ? 2 : 1), bandH);
          }
        }

        c.restore();
      }
    }

    function renderShockwavesAndStarbursts(c) {
      var i;
      for (i = 0; i < shockwaves.length; i++) {
        var sw = shockwaves[i];
        if (sw.age < 0) continue;
        var t = clamp(sw.age / sw.life, 0, 1);
        var r = lerp(sw.r0, sw.r1, easeOutCubic(t));
        var alpha = 1 - easeInQuad(t);
        if (sw.kind === 'octagon') {
          drawPrismOctagonRing(c, sw.x, sw.y, r, {
            rot: sw.rot || 0,
            color: sw.color,
            coreColor: sw.coreColor,
            lineWidth: Math.max(1, sw.lineWidth * (1 - t * 0.55)),
            alpha: alpha
          });
        } else if (sw.kind === 'broken_octagon') {
          // BAD 专属断裂棱边（8 段向外错位下坠裂开）
          c.save();
          c.globalAlpha = alpha * 0.85;
          var angleOffset = (sw.rot || 0) + Math.PI / 8;
          for (var seg = 0; seg < 8; seg++) {
            if (seg === 2 || seg === 6) continue; // 缺口强化碎散观感
            var a0 = angleOffset + (seg * Math.PI) / 4;
            var a1 = a0 + Math.PI / 4;
            var drift = t * (8 + (seg % 3) * 5);
            var midA = (a0 + a1) * 0.5;
            var ox = Math.cos(midA) * drift;
            var oy = Math.sin(midA) * drift + t * t * 18;
            c.beginPath();
            c.moveTo(sw.x + ox + Math.cos(a0) * r, sw.y + oy + Math.sin(a0) * r);
            c.lineTo(sw.x + ox + Math.cos(a1) * r, sw.y + oy + Math.sin(a1) * r);
            c.strokeStyle = PALETTE.slateDark;
            c.lineWidth = sw.lineWidth + 2;
            c.stroke();
            c.strokeStyle = sw.color;
            c.lineWidth = sw.lineWidth;
            c.stroke();
          }
          c.restore();
        } else if (sw.kind === 'diamond') {
          c.save();
          c.translate(sw.x, sw.y);
          c.rotate(sw.rot || 0);
          c.globalAlpha = alpha;
          c.beginPath();
          c.moveTo(0, -r);
          c.lineTo(r, 0);
          c.lineTo(0, r);
          c.lineTo(-r, 0);
          c.closePath();
          c.lineWidth = sw.lineWidth + 2.4;
          c.strokeStyle = 'rgba(8, 26, 84, 0.72)';
          c.stroke();
          c.lineWidth = Math.max(1, sw.lineWidth * (1 - t * 0.5));
          c.strokeStyle = sw.color;
          c.stroke();
          c.restore();
        } else if (sw.kind === 'shield') {
          c.save();
          c.globalAlpha = alpha;
          tracePrismShield(c, sw.x, sw.y, r * 0.72, r);
          c.lineWidth = sw.lineWidth + 2.2;
          c.strokeStyle = 'rgba(8, 26, 84, 0.65)';
          c.stroke();
          c.lineWidth = Math.max(1, sw.lineWidth * (1 - t * 0.5));
          c.strokeStyle = sw.color;
          c.stroke();
          c.restore();
        }
      }

      for (i = 0; i < starbursts.length; i++) {
        var sb = starbursts[i];
        var st = clamp(sb.age / sb.life, 0, 1);
        var scale = st < 0.18 ? easeOutBack(st / 0.18) : (1 + (st - 0.18) * 0.32);
        var sAlpha = st < 0.25 ? 1 : (1 - easeInQuad((st - 0.25) / 0.75));
        drawEightPointStarburst(c, sb.x, sb.y, sb.mainR * scale, sb.diagR * scale, sAlpha, sb.rot + st * 0.14);
      }
    }

    function renderParticles(c) {
      var px = pixelScale;
      for (var i = 0; i < particles.length; i++) {
        var pt = particles[i];
        var t = clamp(pt.age / pt.life, 0, 1);
        var a = pt.alpha * (1 - easeInQuad(t));
        if (a <= 0.01) continue;

        c.save();
        c.globalAlpha = a;

        if (pt.shape === 'mist') {
          // 像素化化水雾团（由两层像素方块叠合，保持像素艺术统一感）
          var sz = Math.round((pt.size * (0.85 + t * 0.65)) / px) * px;
          var gx = Math.round((pt.x - sz * 0.5) / px) * px;
          var gy = Math.round((pt.y - sz * 0.5) / px) * px;
          c.fillStyle = pt.color;
          c.fillRect(gx + px, gy, Math.max(px, sz - px * 2), sz);
          c.fillRect(gx, gy + px, sz, Math.max(px, sz - px * 2));
        } else if (pt.shape === 'pixel') {
          var psz = Math.max(px, Math.round(pt.size / px) * px);
          var pgx = Math.round(pt.x / px) * px;
          var pgy = Math.round(pt.y / px) * px;
          if (pt.outline) {
            c.fillStyle = pt.outline;
            c.fillRect(pgx - 1, pgy - 1, psz + 2, psz + 2);
          }
          c.fillStyle = pt.color;
          c.fillRect(pgx, pgy, psz, psz);
        } else if (pt.shape === 'streak') {
          c.translate(pt.x, pt.y);
          c.rotate(pt.rot);
          var len = pt.size * (3.0 - t * 1.4);
          var th = Math.max(1.8, pt.size * 0.45);
          c.fillStyle = pt.color;
          c.fillRect(-len * 0.5, -th * 0.5, len, th);
        } else if (pt.shape === 'shard') {
          c.translate(pt.x, pt.y);
          c.rotate(pt.rot);
          var s = pt.size * (1 - t * 0.25);
          c.beginPath();
          c.moveTo(0, -s * 1.35);
          c.lineTo(s * 0.72, 0);
          c.lineTo(-s * 0.15, s * 1.15);
          c.lineTo(-s * 0.78, -s * 0.1);
          c.closePath();
          c.fillStyle = pt.color;
          c.fill();
          if (pt.outline) {
            c.strokeStyle = pt.outline;
            c.lineWidth = 1;
            c.stroke();
          }
        } else {
          // diamond
          c.translate(pt.x, pt.y);
          c.rotate(pt.rot);
          var ds = pt.size * (1 - t * 0.35);
          c.beginPath();
          c.moveTo(0, -ds * 1.25);
          c.lineTo(ds * 0.85, 0);
          c.lineTo(0, ds * 1.25);
          c.lineTo(-ds * 0.85, 0);
          c.closePath();
          c.fillStyle = pt.color;
          c.fill();
          if (pt.outline) {
            c.strokeStyle = pt.outline;
            c.lineWidth = 1;
            c.stroke();
          }
        }

        c.restore();
      }
    }

    function renderCallouts(c) {
      for (var i = 0; i < callouts.length; i++) {
        var co = callouts[i];
        var t = clamp(co.age / co.life, 0, 1);
        var pop = t < 0.16 ? easeOutBack(t / 0.16) : 1.0;
        var alpha = t < 0.68 ? 1 : (1 - easeInQuad((t - 0.68) / 0.32));
        var driftY = -easeOutCubic(t) * 24;

        c.save();
        c.translate(co.x, co.y + driftY);
        c.scale(co.scale * pop, co.scale * pop);
        c.globalAlpha = clamp(alpha, 0, 1);

        var mainFontSize = co.prominent ? 20 : 17;
        c.font = '900 ' + mainFontSize + 'px "Cinzel", "Noto Sans SC", "Segoe UI", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.miterLimit = 2;

        // 切角棱线底衬（位于主字与副字之间，留足呼吸空隙，严禁套圆框）
        var metrics = c.measureText(co.text);
        var lineHalf = Math.max(24, metrics.width * 0.54);
        c.beginPath();
        c.moveTo(-lineHalf - 6, 14);
        c.lineTo(lineHalf + 6, 14);
        c.strokeStyle = co.accent;
        c.lineWidth = 2;
        c.stroke();

        // 主文字深蓝圆滑描边 + 亮彩填充（消除中文标点尖角伪影）
        c.lineWidth = 4.2;
        c.strokeStyle = co.outline;
        c.strokeText(co.text, 0, 0);
        c.fillStyle = co.color;
        c.fillText(co.text, 0, 0);

        if (co.subtext) {
          c.font = '800 13px "Cinzel", "Noto Sans SC", "Segoe UI", sans-serif';
          c.lineWidth = 3.4;
          c.strokeStyle = co.outline;
          c.strokeText(co.subtext, 0, 27);
          c.fillStyle = PALETTE.white;
          c.fillText(co.subtext, 0, 27);
        }

        c.restore();
      }
    }

    function render(targetCtx) {
      var c = targetCtx || ctx;
      if (!c) return;

      c.save();
      if (!targetCtx && canvas) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, width, height);
      }

      // 整层微幅震屏偏移
      if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
        c.translate(shakeOffset.x, shakeOffset.y);
      }

      // 渲染层级顺序：风行残像 → 斩击 → 格挡盾面 → 冲击波与八芒星裂 → 粒子 → 活跃缩圈/格挡环 → 爆字 → 全屏闪
      renderWindAfterimages(c);
      renderSlashes(c);
      renderShieldEffects(c);
      renderShockwavesAndStarbursts(c);
      renderParticles(c);
      renderActiveTimingRing(c);
      renderActiveBlockPrompt(c);
      renderCallouts(c);

      for (var f = 0; f < screenFlashes.length; f++) {
        var fl = screenFlashes[f];
        var ft = clamp(fl.age / fl.life, 0, 1);
        c.save();
        c.globalAlpha = 1 - ft;
        c.fillStyle = fl.color;
        c.fillRect(-20, -20, width + 40, height + 40);
        c.restore();
      }

      c.restore();
    }

    /* ---------- 8. Canvas 挂载与 RAF 循环 ---------- */
    function resize(w, h, nextDpr) {
      width = Math.max(1, Math.round(Number(w) || width));
      height = Math.max(1, Math.round(Number(h) || height));
      if (nextDpr != null) dpr = clamp(Number(nextDpr) || 1, 1, 2);
      if (canvas) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        if (ownedCanvas) {
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
        }
      }
    }

    function attach(targetCanvas, opts) {
      opts = opts || {};
      canvas = targetCanvas;
      ownedCanvas = false;
      ctx = canvas ? canvas.getContext('2d') : null;
      if (canvas) {
        var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
        var w = opts.width || (rect && rect.width) || canvas.width || width;
        var h = opts.height || (rect && rect.height) || canvas.height || height;
        resize(w, h, opts.dpr != null ? opts.dpr : dpr);
      }
      if (keyboardEnabled) attachKeyboardListener();
      if (opts.autoLoop !== false && initOpts.autoLoop !== false) start();
      return api;
    }

    function mount(container, opts) {
      opts = opts || {};
      if (!container || typeof document === 'undefined') return api;
      var el = document.createElement('canvas');
      el.className = 'vfx-timing-block-v3-canvas';
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.pointerEvents = 'none';
      el.style.zIndex = String(opts.zIndex != null ? opts.zIndex : 40);
      container.appendChild(el);
      var rect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
      attach(el, {
        width: opts.width || (rect && rect.width) || width,
        height: opts.height || (rect && rect.height) || height,
        dpr: opts.dpr,
        autoLoop: opts.autoLoop
      });
      ownedCanvas = true;
      return api;
    }

    function loop(ts) {
      if (!running) return;
      var dt = lastFrameTs ? (ts - lastFrameTs) : 16.67;
      lastFrameTs = ts;
      step(dt);
      if (ctx) render();
      rafId = root.requestAnimationFrame(loop);
    }

    function start() {
      if (running || typeof root.requestAnimationFrame !== 'function') return api;
      running = true;
      lastFrameTs = 0;
      rafId = root.requestAnimationFrame(loop);
      return api;
    }

    function stop() {
      running = false;
      if (rafId && typeof root.cancelAnimationFrame === 'function') {
        root.cancelAnimationFrame(rafId);
      }
      rafId = 0;
      return api;
    }

    function clear() {
      activeSequence = null;
      activeBlock = null;
      shockwaves.length = 0;
      starbursts.length = 0;
      shields.length = 0;
      particles.length = 0;
      slashes.length = 0;
      afterimages.length = 0;
      windRings.length = 0;
      callouts.length = 0;
      screenFlashes.length = 0;
      hitStopRemainMs = 0;
      shakeTrauma = 0;
      shakeOffset.x = 0;
      shakeOffset.y = 0;
      return api;
    }

    function destroy() {
      stop();
      detachKeyboardListener();
      clear();
      if (ownedCanvas && canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvas = null;
      ctx = null;
      ownedCanvas = false;
    }

    function getActivePrompt() {
      if (activeSequence && activeSequence.state === 'active') {
        var b = activeSequence.beats[activeSequence.currentIndex];
        return {
          type: 'timing',
          key: b.key,
          beatIndex: b.index,
          totalBeats: activeSequence.beats.length,
          elapsedMs: activeSequence.elapsedMs,
          durationMs: b.durationMs,
          progress: activeSequence.elapsedMs / b.durationMs,
          overcastTier: activeSequence.overcast.tier,
          overcastPct: activeSequence.overcast.pct,
          x: b.x,
          y: b.y
        };
      }
      if (activeBlock) {
        return {
          type: 'block',
          key: 'SPACE',
          tierDiff: activeBlock.tierDiff,
          elapsedMs: activeBlock.elapsedMs,
          durationMs: activeBlock.durationMs,
          progress: activeBlock.elapsedMs / activeBlock.durationMs,
          x: activeBlock.x,
          y: activeBlock.y
        };
      }
      return null;
    }

    function getStateSnapshot() {
      return {
        clockMs: Math.round(clockMs),
        hitStopRemainMs: Math.round(hitStopRemainMs),
        shakeOffset: { x: Number(shakeOffset.x.toFixed(2)), y: Number(shakeOffset.y.toFixed(2)) },
        activePrompt: getActivePrompt(),
        counts: {
          shockwaves: shockwaves.length,
          starbursts: starbursts.length,
          shields: shields.length,
          particles: particles.length,
          slashes: slashes.length,
          afterimages: afterimages.length,
          windRings: windRings.length,
          callouts: callouts.length
        }
      };
    }

    var api = {
      attach: attach,
      mount: mount,
      resize: resize,
      start: start,
      stop: stop,
      clear: clear,
      destroy: destroy,
      step: step,
      render: render,

      setKeyboardEnabled: function (v) {
        keyboardEnabled = !!v;
        if (keyboardEnabled) attachKeyboardListener();
        else detachKeyboardListener();
      },
      handleKeyDown: handleKeyDown,
      triggerKey: triggerKey,
      getActivePrompt: getActivePrompt,
      getShakeOffset: function () { return { x: shakeOffset.x, y: shakeOffset.y }; },
      getStateSnapshot: getStateSnapshot,

      startTimingBeat: startTimingBeat,
      startTimingSequence: startTimingSequence,
      spawnTimingFeedback: spawnTimingFeedback,

      startBlockPrompt: startBlockPrompt,
      spawnBlockFeedback: spawnBlockFeedback,

      playSwordVfx: playSwordVfx,
      playBasicAttack: playBasicAttack,
      playSwordSendSlash: playSwordSendSlash,
      playWindAfterimage: playWindAfterimage,

      setMuted: audio.setMuted,
      isMuted: audio.isMuted,
      setVolume: audio.setVolume,
      playSfx: audio.play
    };

    if (initOpts.canvas) {
      attach(initOpts.canvas, initOpts);
    } else if (initOpts.container) {
      mount(initOpts.container, initOpts);
    } else if (keyboardEnabled && initOpts.autoAttachKeyboard) {
      attachKeyboardListener();
    }

    return api;
  }

  /* ==================== 5. 顶层单例便捷入口与导出 ==================== */
  var defaultInstance = null;
  function getDefaultInstance() {
    if (!defaultInstance) defaultInstance = createEngine({ autoLoop: false, listenKeyboard: false });
    return defaultInstance;
  }

  var VfxTimingBlockV3 = {
    VERSION: VERSION,
    PALETTE: PALETTE,
    KEY_POOL: KEY_POOL.slice(),
    OVERCAST_TIERS: OVERCAST_TIERS.slice(),
    TIMING_GRADES: TIMING_GRADES,
    BLOCK_BASE_RATES: BLOCK_BASE_RATES,
    BLOCK_PRESETS: BLOCK_PRESETS,
    SKILL_PRESETS: SKILL_PRESETS,

    getOvercastConfig: getOvercastConfig,
    getTimingWindows: getTimingWindows,
    evaluateTiming: evaluateTiming,
    computeBlockScale: computeBlockScale,
    computeBlockResult: computeBlockResult,
    getBlockTable: getBlockTable,
    pickRandomKeys: pickRandomKeys,

    create: createEngine,
    getDefaultInstance: getDefaultInstance,
    attach: function (canvas, opts) {
      defaultInstance = createEngine(Object.assign({}, opts, { canvas: canvas }));
      return defaultInstance;
    },
    mount: function (container, opts) {
      defaultInstance = createEngine(Object.assign({}, opts, { container: container }));
      return defaultInstance;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VfxTimingBlockV3;
  }
  if (root) {
    root.VfxTimingBlockV3 = VfxTimingBlockV3;
  }
})(typeof window !== 'undefined' ? window : globalThis);
