/* =========================================================================
   转生千金 · 冰晶与绘本微音效 + 影院四层拟音引擎 (js/sfx-suite.js)
   零外部音频、零网络请求、全纯 WebAudio D 大调霜晶钢片琴与四层战斗拟音体系
   导出：window.CrystalSFX
   ========================================================================= */
(function (root) {
  'use strict';

  var MAX_ACTIVE_VOICES = 26;
  var SUPPRESSION_MS = 45;
  var LOCAL_VOL_KEY = 'ojousama_sfx_vol';
  var LOCAL_MUTE_KEY = 'ojousama_muted';
  var MIN_EXP_GAIN = 0.00015;
  var MIN_ATTACK = 0.002;
  var MAX_ATTACK = 0.014;
  var TITLE_BTN_SELECTOR = '.title-menu button, .v3-prism-cta, .v3-edge-link, .corner-tool-btn';
  var COMBAT_BTN_SELECTOR = '.cb-tool-btn, .cb-pwing, .cb-spine-btn, .cb-blade, .cb-amp-tier-blade, .cb-amp-tick, .cb-plog-toggle, .cb-oc-btn, .cb-skill-card, .cb-endturn-btn, .ib-info-btn, .cb-trait-pill, .cb-enemy-card:not(.dead), .cp-opt-btn, .cp-close-x, #cb-modal-slot .tbtn, #am-close, .arena-mode-chip, .arena-stage-card';
  var COMBAT_GROUP_SELECTOR = '.cb-top-tools, #cb-prism-root, #cb-prism-blade-list, .cb-cascade-spine, .cb-amp-tiers, .cb-amp-ticks, #cb-oc-seg, #b-actions, #cb-enemy-zone, .arena-mode-group, .arena-loadout-bar, .arena-stage-grid, #cb-modal-slot';
  var TITLE_OWN_SFX_IDS = {
    'btn-new': 1,
    'btn-continue': 1,
    'v3-prism-start': 1,
    'btn-title-settings': 1,
    'btn-title-loads': 1,
    'btn-title-chapters': 1,
    'btn-arena-title': 1,
    'btn-codex': 1,
    'btn-help': 1,
    'btn-letter-test': 1,
    'btn-title-mute': 1
  };
  var CRYSTAL_FM_RATIOS = [1.0, 2.756, 5.404];

  // D 大调 + B 大调冰铃标准十二平均律音高表 (A4 = 440Hz)
  var NOTE = {
    A2: 110.00,
    D3: 146.83,
    A3: 220.00,
    B3: 246.94,
    D4: 293.66,
    E4: 329.63,
    Fs4: 369.99,
    G4: 392.00,
    A4: 440.00,
    B4: 493.88,
    Cs5: 554.37,
    D5: 587.33,
    Ds5: 622.25,
    E5: 659.25,
    Fs5: 739.99,
    G5: 783.99,
    A5: 880.00,
    B5: 987.77,
    Cs6: 1108.73,
    D6: 1174.66,
    Ds6: 1244.51,
    E6: 1318.51,
    Fs6: 1479.98,
    G6: 1567.98,
    A6: 1760.00,
    B6: 1975.53,
    Cs7: 2217.46,
    D7: 2349.32,
    E7: 2637.02,
    Fs7: 2959.96,
    A7: 3520.00
  };

  var TITLE_PENTATONIC = [1174.66, 1318.51, 1479.98, 1760.00, 1975.53];
  var CARD_PENTATONIC = [1174.66, 1318.51, 1479.98, 1760.00];
  var STAT_LIFT = [1.0, 1.122462, 1.259921, 1.334840, 1.498307];

  var state = {
    ctx: null,
    masterBus: null,
    compressor: null,
    shaper: null,
    reverbBus: null,
    reverbNode: null,
    punchBus: null,
    noiseBuffers: null,
    localVol: readSavedVol(),
    localMuted: readSavedMuted(),
    inVolSync: false,
    activeVoices: [],
    cooldowns: Object.create(null),
    lastAnyTime: -10000,
    lastAnyPrio: 0,
    titleHoverCursor: 0,
    cardHoverCursor: 0,
    clickNonce: 0,
    stepNonce: 0,
    boundTitleEl: null,
    titlePointerHandler: null,
    titleClickHandler: null,
    boundCombatEls: [],
    combatPointerEnterHandler: null,
    combatPointerLeaveHandler: null,
    lastCombatHoverEl: null,
    gestureBound: false
  };

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function nowMs() {
    try {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
    } catch (e) {}
    return Date.now();
  }

  function readSavedVol() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = parseFloat(localStorage.getItem(LOCAL_VOL_KEY));
        if (isFinite(raw)) return clamp(raw, 0, 1);
      }
    } catch (e) {}
    return 0.65;
  }

  function readSavedMuted() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(LOCAL_MUTE_KEY) === '1';
      }
    } catch (e) {}
    return false;
  }

  function getLiveVolume() {
    try {
      if (root && typeof root.sfxGetVolume === 'function') {
        var v = Number(root.sfxGetVolume());
        if (isFinite(v)) return clamp(v, 0, 1);
      }
    } catch (e) {}
    return state.localVol;
  }

  function getLiveMuted() {
    try {
      if (root && typeof root.isMuted === 'function') {
        return !!root.isMuted();
      }
    } catch (e) {}
    return state.localMuted;
  }

  function computeMasterVol(rawVol) {
    var clamped = clamp(Number(rawVol) || 0, 0, 1);
    return Math.pow(clamped, 1.35) * 0.48;
  }

  function getAudioCtor() {
    try {
      if (!root) return null;
      return root.AudioContext || root.webkitAudioContext || null;
    } catch (e) {
      return null;
    }
  }

  function createSoftClipCurve(drive) {
    var samples = 1024;
    var curve = new Float32Array(samples);
    var k = Math.max(0.8, Number(drive) || 2.0);
    var norm = Math.tanh ? Math.tanh(k) : (Math.exp(2 * k) - 1) / (Math.exp(2 * k) + 1);
    for (var i = 0; i < samples; i++) {
      var x = (i * 2) / (samples - 1) - 1;
      var y = Math.tanh ? Math.tanh(x * k) : (Math.exp(2 * x * k) - 1) / (Math.exp(2 * x * k) + 1);
      curve[i] = clamp(y / (norm || 1), -1, 1);
    }
    return curve;
  }

  // 算法冰晶宫殿立体声混响脉冲：6 道镜面早反射 + 霜气丝绒高频微阻尼尾音
  function createIceHallImpulse(c, seconds) {
    try {
      if (!c || typeof c.createBuffer !== 'function') return null;
      var sr = typeof c.sampleRate === 'number' && c.sampleRate >= 8000 ? c.sampleRate : 44100;
      var dur = clamp(Number(seconds) || 1.35, 0.4, 2.2);
      var len = Math.floor(sr * dur);
      var ir = c.createBuffer(2, len, sr);
      if (!ir || typeof ir.getChannelData !== 'function') return null;
      var left = ir.getChannelData(0);
      var right = ir.getChannelData(1);
      var randL = createSeededRand(0x1CECA571);
      var randR = createSeededRand(0x7A2B9C3D);

      var taps = [
        { ms: 14, gL: 0.42, gR: 0.18 },
        { ms: 27, gL: 0.16, gR: 0.38 },
        { ms: 43, gL: 0.31, gR: 0.22 },
        { ms: 62, gL: 0.18, gR: 0.28 },
        { ms: 88, gL: 0.22, gR: 0.15 },
        { ms: 118, gL: 0.14, gR: 0.19 }
      ];
      for (var ti = 0; ti < taps.length; ti++) {
        var idx = Math.floor((taps[ti].ms / 1000) * sr);
        if (idx >= 0 && idx < len) {
          left[idx] += taps[ti].gL;
          right[idx] += taps[ti].gR;
        }
      }

      var lpL = 0;
      var lpR = 0;
      for (var i = 0; i < len; i++) {
        var sec = i / sr;
        var env = Math.exp(-sec / 0.34) * (1 - Math.exp(-sec / 0.012));
        var damp = clamp(0.42 - sec * 0.18, 0.12, 0.42);
        lpL = lpL + damp * (randL() - lpL);
        lpR = lpR + damp * (randR() - lpR);
        left[i] = clamp(left[i] + lpL * env * 0.56, -1, 1);
        right[i] = clamp(right[i] + lpR * env * 0.56, -1, 1);
      }
      return ir;
    } catch (e) {
      return null;
    }
  }

  function buildMasterChain(c) {
    try {
      if (!c) return null;
      var bus = typeof c.createGain === 'function' ? c.createGain() : null;
      if (!bus) return null;
      var t = safeTime(c);
      safeSetParam(bus.gain, 1.0, t);

      var dest = c.destination;
      var chainHead = bus;

      // 1. 柔和软限幅饱和级（WaveShaperNode，特性检测并优雅回落）
      state.shaper = null;
      if (typeof c.createWaveShaper === 'function') {
        try {
          var masterShaper = c.createWaveShaper();
          masterShaper.curve = createSoftClipCurve(1.85);
          try { masterShaper.oversample = '2x'; } catch (e) {}
          if (typeof chainHead.connect === 'function') {
            chainHead.connect(masterShaper);
            chainHead = masterShaper;
            state.shaper = masterShaper;
          }
        } catch (e) {
          state.shaper = null;
        }
      }

      // 2. 动态压缩级（DynamicsCompressorNode）
      var connected = false;
      state.compressor = null;
      if (typeof c.createDynamicsCompressor === 'function') {
        try {
          var comp = c.createDynamicsCompressor();
          safeSetParam(comp.threshold, -12, t);
          safeSetParam(comp.knee, 14, t);
          safeSetParam(comp.ratio, 5, t);
          safeSetParam(comp.attack, 0.003, t);
          safeSetParam(comp.release, 0.14, t);
          if (typeof chainHead.connect === 'function' && typeof comp.connect === 'function') {
            chainHead.connect(comp);
            comp.connect(dest);
            state.compressor = comp;
            connected = true;
          }
        } catch (e) {
          state.compressor = null;
        }
      }
      if (!connected && typeof chainHead.connect === 'function') {
        try {
          chainHead.connect(dest);
        } catch (e) {}
      }

      // 3. 并联算法冰晶宫殿混响总线（ConvolverNode，无支持时静默旁路）
      state.reverbBus = null;
      state.reverbNode = null;
      if (typeof c.createConvolver === 'function' && typeof c.createGain === 'function') {
        try {
          var irBuf = createIceHallImpulse(c, 1.35);
          if (irBuf) {
            var revIn = c.createGain();
            var conv = c.createConvolver();
            var revRet = c.createGain();
            conv.buffer = irBuf;
            safeSetParam(revIn.gain, 1.0, t);
            safeSetParam(revRet.gain, 0.36, t);
            revIn.connect(conv);
            if (typeof c.createBiquadFilter === 'function') {
              var revHp = c.createBiquadFilter();
              revHp.type = 'highpass';
              safeSetParam(revHp.frequency, 280, t);
              conv.connect(revHp);
              revHp.connect(revRet);
            } else {
              conv.connect(revRet);
            }
            revRet.connect(bus);
            state.reverbBus = revIn;
            state.reverbNode = conv;
          }
        } catch (e) {
          state.reverbBus = null;
          state.reverbNode = null;
        }
      }

      // 4. 并联次低音饱和冲击总线（WaveShaperNode + 260Hz 低通，强化打击胸腔重量）
      state.punchBus = null;
      if (typeof c.createWaveShaper === 'function' && typeof c.createGain === 'function') {
        try {
          var pIn = c.createGain();
          var pShaper = c.createWaveShaper();
          var pRet = c.createGain();
          pShaper.curve = createSoftClipCurve(3.15);
          try { pShaper.oversample = '2x'; } catch (e) {}
          safeSetParam(pIn.gain, 1.0, t);
          safeSetParam(pRet.gain, 0.9, t);
          pIn.connect(pShaper);
          if (typeof c.createBiquadFilter === 'function') {
            var pLp = c.createBiquadFilter();
            pLp.type = 'lowpass';
            safeSetParam(pLp.frequency, 260, t);
            safeSetParam(pLp.Q, 0.85, t);
            pShaper.connect(pLp);
            pLp.connect(pRet);
          } else {
            pShaper.connect(pRet);
          }
          pRet.connect(bus);
          state.punchBus = pIn;
        } catch (e) {
          state.punchBus = null;
        }
      }

      return bus;
    } catch (e) {
      return null;
    }
  }

  function ensureContext(allowCreate) {
    if (state.ctx) return state.ctx;
    if (!allowCreate) return null;
    var Ctor = getAudioCtor();
    if (!Ctor) return null;
    try {
      var c = new Ctor();
      state.ctx = c;
      state.masterBus = buildMasterChain(c);
      state.noiseBuffers = null;
      return c;
    } catch (e) {
      return null;
    }
  }

  function safeTime(c) {
    try {
      var t = c && typeof c.currentTime === 'number' && isFinite(c.currentTime) ? c.currentTime : 0;
      return t >= 0 ? t : 0;
    } catch (e) {
      return 0;
    }
  }

  function safeSetParam(param, val, t) {
    if (!param) return;
    try {
      if (typeof param.setValueAtTime === 'function') {
        param.setValueAtTime(val, t);
      } else if ('value' in param) {
        param.value = val;
      }
    } catch (e) {}
  }

  function safeLinearRamp(param, val, t) {
    if (!param) return;
    try {
      if (typeof param.linearRampToValueAtTime === 'function') {
        param.linearRampToValueAtTime(val, t);
      } else if (typeof param.setValueAtTime === 'function') {
        param.setValueAtTime(val, t);
      } else if ('value' in param) {
        param.value = val;
      }
    } catch (e) {}
  }

  function safeExpRamp(param, val, t) {
    if (!param) return;
    var safeVal = Math.max(0.0001, val);
    try {
      if (typeof param.exponentialRampToValueAtTime === 'function') {
        param.exponentialRampToValueAtTime(safeVal, t);
      } else if (typeof param.linearRampToValueAtTime === 'function') {
        param.linearRampToValueAtTime(safeVal, t);
      } else if (typeof param.setValueAtTime === 'function') {
        param.setValueAtTime(safeVal, t);
      } else if ('value' in param) {
        param.value = safeVal;
      }
    } catch (e) {}
  }

  function createSeededRand(seed) {
    var x = seed >>> 0;
    return function () {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) / 4294967296) * 2 - 1;
    };
  }

  function ensureNoiseBuffers(c) {
    if (state.noiseBuffers) return state.noiseBuffers;
    if (!c || typeof c.createBuffer !== 'function' || typeof c.createBufferSource !== 'function') {
      return null;
    }
    try {
      var sr = typeof c.sampleRate === 'number' && c.sampleRate >= 8000 ? c.sampleRate : 44100;
      var rand = createSeededRand(0x51A7F3C9);

      // 1. 细腻白噪（金属火花 / 霜气高光）
      var whiteLen = Math.floor(sr * 0.45);
      var whiteBuf = c.createBuffer(1, whiteLen, sr);
      var wd = whiteBuf && typeof whiteBuf.getChannelData === 'function' ? whiteBuf.getChannelData(0) : null;
      if (wd) {
        for (var i = 0; i < whiteLen; i++) {
          wd[i] = rand() * 0.85;
        }
      }

      // 2. 丝绒粉噪（羊皮纸翻页 / 折信 / 柔风）
      var pinkLen = Math.floor(sr * 0.65);
      var pinkBuf = c.createBuffer(1, pinkLen, sr);
      var pd = pinkBuf && typeof pinkBuf.getChannelData === 'function' ? pinkBuf.getChannelData(0) : null;
      if (pd) {
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (var j = 0; j < pinkLen; j++) {
          var w = rand();
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.0168980;
          pd[j] = clamp((b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11, -1, 1);
          b6 = w * 0.115926;
        }
      }

      // 3. 碎晶裂纹噪（火漆崩裂 / 冰晶碎裂瞬态）
      var crackLen = Math.floor(sr * 0.22);
      var crackBuf = c.createBuffer(1, crackLen, sr);
      var cd = crackBuf && typeof crackBuf.getChannelData === 'function' ? crackBuf.getChannelData(0) : null;
      if (cd) {
        for (var k = 0; k < crackLen; k++) {
          var r = rand();
          var env = Math.exp(-k / (sr * 0.045));
          var spike = Math.abs(r) > 0.91 ? (r > 0 ? 1.0 : -1.0) : r * 0.24;
          cd[k] = clamp(spike * env, -1, 1);
        }
      }

      state.noiseBuffers = {
        white: whiteBuf,
        pink: pinkBuf,
        crackle: crackBuf
      };
      return state.noiseBuffers;
    } catch (e) {
      return null;
    }
  }

  function pruneVoices(now) {
    var list = state.activeVoices;
    var write = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].endMs > now) {
        list[write++] = list[i];
      }
    }
    list.length = write;
  }

  function reserveVoice(now, delaySec, durSec, prio, isOrnament) {
    pruneVoices(now);
    var list = state.activeVoices;
    if (list.length >= MAX_ACTIVE_VOICES) {
      if (isOrnament) return null;
      // 查找更低优先级或最快结束的可回收槽位，并执行柔和淡出回收
      var victimIdx = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].prio < prio) {
          if (victimIdx < 0 || list[i].endMs < list[victimIdx].endMs) {
            victimIdx = i;
          }
        }
      }
      if (victimIdx < 0) return null;
      var victim = list.splice(victimIdx, 1)[0];
      if (victim && typeof victim.evict === 'function') {
        try { victim.evict(); } catch (e) {}
      }
    }
    var entry = {
      endMs: now + Math.max(0.02, (delaySec || 0) + (durSec || 0.05) + 0.025) * 1000,
      prio: prio || 1,
      evict: null
    };
    list.push(entry);
    return {
      entry: entry,
      release: function () {
        var idx = state.activeVoices.indexOf(entry);
        if (idx !== -1) state.activeVoices.splice(idx, 1);
      }
    };
  }

  function bindVoiceEvict(slot, c, srcNode, gainNode) {
    if (!slot || !slot.entry) return;
    slot.entry.evict = function () {
      try {
        var tNow = safeTime(c);
        if (gainNode && gainNode.gain) {
          if (typeof gainNode.gain.cancelScheduledValues === 'function') {
            gainNode.gain.cancelScheduledValues(tNow);
          }
          safeLinearRamp(gainNode.gain, 0.0001, tNow + 0.014);
        }
        if (srcNode && typeof srcNode.stop === 'function') {
          srcNode.stop(tNow + 0.018);
        }
      } catch (e) {}
    };
  }

  function connectOut(c, node, pan, sendOpts) {
    if (!node) return;
    var target = (sendOpts && sendOpts.targetBus) || state.masterBus || (c ? c.destination : null);
    var outNode = node;
    try {
      if (pan && Math.abs(pan) > 0.01 && c && typeof c.createStereoPanner === 'function') {
        var panner = c.createStereoPanner();
        safeSetParam(panner.pan, clamp(pan, -0.85, 0.85), safeTime(c));
        node.connect(panner);
        outNode = panner;
      }
    } catch (e) {}
    try {
      if (typeof outNode.connect === 'function' && target) {
        outNode.connect(target);
      }
    } catch (e) {}
    // 并联冰晶宫殿混响发送（ConvolverNode 存在时自动生效，精简环境静默跳过）
    if (sendOpts && sendOpts.reverbSend > 0.01 && state.reverbBus && c && typeof c.createGain === 'function') {
      try {
        var sendGain = c.createGain();
        safeSetParam(sendGain.gain, clamp(sendOpts.reverbSend, 0.02, 1.0), safeTime(c));
        outNode.connect(sendGain);
        sendGain.connect(state.reverbBus);
      } catch (e) {}
    }
  }

  function createFilterNode(c, filterCfg, st, dur) {
    if (!filterCfg || !c || typeof c.createBiquadFilter !== 'function') return null;
    try {
      var f = c.createBiquadFilter();
      if (filterCfg.type) f.type = filterCfg.type;
      var fStart = Math.max(40, filterCfg.freq || 2400);
      safeSetParam(f.frequency, fStart, st);
      if (filterCfg.midFreq && filterCfg.midTime) {
        safeExpRamp(f.frequency, Math.max(40, filterCfg.midFreq), st + filterCfg.midTime);
      }
      if (filterCfg.endFreq) {
        safeExpRamp(f.frequency, Math.max(40, filterCfg.endFreq), st + dur);
      }
      if (typeof filterCfg.q === 'number') {
        safeSetParam(f.Q, clamp(filterCfg.q, 0.2, 18), st);
      }
      return f;
    } catch (e) {
      return null;
    }
  }

  function playTone(c, baseT, now, masterVol, prio, cfg) {
    if (!c || typeof c.createOscillator !== 'function' || typeof c.createGain !== 'function') return false;
    var delay = Math.max(0, cfg.delay || 0);
    var dur = Math.max(0.024, cfg.dur || 0.12);
    var atk = clamp(cfg.attack !== undefined ? cfg.attack : 0.004, MIN_ATTACK, Math.min(MAX_ATTACK, dur * 0.45));
    var hold = Math.max(0, Math.min(cfg.hold || 0, dur - atk - 0.008));

    var slot = reserveVoice(now, delay, dur, prio, !!cfg.ornament);
    if (!slot) return false;

    try {
      var osc = c.createOscillator();
      var g = c.createGain();
      var st = baseT + delay;
      var peak = Math.max(0.00025, masterVol * (cfg.gain !== undefined ? cfg.gain : 0.6));

      try {
        osc.type = cfg.wave || 'sine';
      } catch (e) {}

      var startFreq = Math.max(24, cfg.freq || 440);
      safeSetParam(osc.frequency, startFreq, st);
      if (cfg.midFreq && cfg.midTime) {
        safeExpRamp(osc.frequency, Math.max(24, cfg.midFreq), st + cfg.midTime);
      }
      if (cfg.slideTo) {
        safeExpRamp(osc.frequency, Math.max(24, cfg.slideTo), st + dur);
      }
      if (cfg.detune && osc.detune) {
        safeSetParam(osc.detune, cfg.detune, st);
      }

      // 零爆音包络：柔和线性起音 + 非零指数衰减 + 极短归零尾
      safeSetParam(g.gain, 0.0001, st);
      safeLinearRamp(g.gain, peak, st + atk);
      if (hold > 0) {
        safeSetParam(g.gain, peak, st + atk + hold);
      }
      safeExpRamp(g.gain, MIN_EXP_GAIN, st + dur);
      safeLinearRamp(g.gain, 0.00001, st + dur + 0.008);

      var filter = createFilterNode(c, cfg.filter, st, dur);
      if (filter) {
        osc.connect(filter);
        filter.connect(g);
      } else {
        osc.connect(g);
      }
      connectOut(c, g, cfg.pan, {
        reverbSend: cfg.reverbSend || 0,
        targetBus: cfg.targetBus || null
      });
      bindVoiceEvict(slot, c, osc, g);

      try {
        osc.onended = function () {
          slot.release();
        };
      } catch (e) {}

      if (typeof osc.start === 'function') osc.start(st);
      if (typeof osc.stop === 'function') osc.stop(st + dur + 0.015);
      return true;
    } catch (e) {
      slot.release();
      return false;
    }
  }

  function playCelesta(c, baseT, now, masterVol, prio, cfg) {
    var freq = cfg.freq || NOTE.D6;
    var dur = cfg.dur || 0.24;
    var delay = cfg.delay || 0;
    var gain = cfg.gain !== undefined ? cfg.gain : 0.52;
    var ok1 = playTone(c, baseT, now, masterVol, prio, {
      freq: freq,
      slideTo: cfg.slideTo,
      wave: cfg.wave || 'sine',
      delay: delay,
      dur: dur,
      attack: cfg.attack !== undefined ? cfg.attack : 0.004,
      gain: gain,
      detune: cfg.detune || 0,
      filter: cfg.filter || (cfg.wave === 'triangle' ? { type: 'lowpass', freq: 4600, q: 0.7 } : null),
      pan: cfg.pan,
      reverbSend: cfg.reverbSend || 0
    });
    if (cfg.overtone !== false) {
      var ratio = cfg.overtoneRatio || 2.0;
      playTone(c, baseT, now, masterVol, prio, {
        freq: freq * ratio,
        wave: 'sine',
        delay: delay + 0.002,
        dur: Math.max(0.04, dur * (cfg.overtoneDurMul || 0.48)),
        attack: 0.003,
        gain: gain * (cfg.overtoneGain || 0.24),
        detune: (cfg.detune || 0) + 5.5,
        pan: cfg.pan ? -cfg.pan * 0.45 : 0,
        reverbSend: (cfg.reverbSend || 0) * 0.85,
        ornament: true
      });
    }
    return ok1;
  }

  function playNoise(c, baseT, now, masterVol, prio, cfg) {
    if (!c || typeof c.createBufferSource !== 'function' || typeof c.createGain !== 'function') return false;
    var bufs = ensureNoiseBuffers(c);
    if (!bufs) return false;
    var buf = bufs[cfg.kind || 'pink'] || bufs.pink;
    if (!buf) return false;

    var delay = Math.max(0, cfg.delay || 0);
    var dur = Math.max(0.025, cfg.dur || 0.09);
    var atk = clamp(cfg.attack !== undefined ? cfg.attack : 0.008, MIN_ATTACK, Math.min(MAX_ATTACK, dur * 0.48));

    var slot = reserveVoice(now, delay, dur, prio, !!cfg.ornament);
    if (!slot) return false;

    try {
      var src = c.createBufferSource();
      src.buffer = buf;
      var g = c.createGain();
      var st = baseT + delay;
      var peak = Math.max(0.00025, masterVol * (cfg.gain !== undefined ? cfg.gain : 0.25));

      safeSetParam(g.gain, 0.0001, st);
      safeLinearRamp(g.gain, peak, st + atk);
      safeExpRamp(g.gain, MIN_EXP_GAIN, st + dur);
      safeLinearRamp(g.gain, 0.00001, st + dur + 0.008);

      var filter = createFilterNode(c, cfg.filter, st, dur);
      if (filter) {
        src.connect(filter);
        filter.connect(g);
      } else {
        src.connect(g);
      }
      connectOut(c, g, cfg.pan, {
        reverbSend: cfg.reverbSend || 0,
        targetBus: cfg.targetBus || null
      });
      bindVoiceEvict(slot, c, src, g);

      try {
        src.onended = function () {
          slot.release();
        };
      } catch (e) {}

      if (typeof src.start === 'function') src.start(st);
      if (typeof src.stop === 'function') src.stop(st + dur + 0.015);
      return true;
    } catch (e) {
      slot.release();
      return false;
    }
  }

  // =========================================================================
  // 影院四层战斗拟音合成原语（Layer 1 扫频气流 / Layer 2 饱和次低音冲击 /
  // Layer 3 交错碎冰爆裂 / Layer 4 非谐波 1.0:2.756:5.404 冰晶 FM 共振）
  // =========================================================================
  function playWhoosh(c, baseT, now, masterVol, prio, cfg) {
    return playNoise(c, baseT, now, masterVol, prio, {
      kind: cfg.kind || 'pink',
      delay: cfg.delay || 0,
      dur: cfg.dur || 0.16,
      attack: cfg.attack !== undefined ? cfg.attack : 0.012,
      gain: cfg.gain !== undefined ? cfg.gain : 0.36,
      pan: cfg.pan || 0,
      reverbSend: cfg.reverbSend !== undefined ? cfg.reverbSend : 0.24,
      filter: {
        type: 'bandpass',
        freq: cfg.startFreq || 680,
        midFreq: cfg.midFreq || 0,
        midTime: cfg.midTime || 0,
        endFreq: cfg.endFreq || 2900,
        q: cfg.q !== undefined ? cfg.q : 2.1
      },
      ornament: !!cfg.ornament
    });
  }

  function playSubPunch(c, baseT, now, masterVol, prio, cfg) {
    var delay = cfg.delay || 0;
    var dur = cfg.dur || 0.135;
    var gain = cfg.gain !== undefined ? cfg.gain : 0.72;
    var ok = playTone(c, baseT, now, masterVol, prio, {
      freq: cfg.startFreq || 162,
      slideTo: cfg.endFreq || 40,
      wave: cfg.wave || 'sine',
      delay: delay,
      dur: dur,
      attack: cfg.attack !== undefined ? cfg.attack : 0.002,
      gain: gain,
      filter: { type: 'lowpass', freq: cfg.cutoff || 320, q: 0.9 },
      targetBus: state.punchBus || state.masterBus,
      reverbSend: cfg.reverbSend || 0.06
    });
    if (cfg.click !== false) {
      playTone(c, baseT, now, masterVol, prio, {
        freq: cfg.clickFreq || 1180,
        slideTo: 220,
        wave: 'triangle',
        delay: delay,
        dur: 0.026,
        attack: 0.002,
        gain: gain * 0.32,
        filter: { type: 'bandpass', freq: 1450, q: 1.6 },
        pan: cfg.pan || 0,
        ornament: true
      });
    }
    return ok;
  }

  function playShatterPops(c, baseT, now, masterVol, prio, cfg) {
    var count = clamp(cfg.count || 5, 2, 7);
    var baseDelay = cfg.delay || 0.003;
    var spread = cfg.spread || 0.095;
    var baseGain = cfg.gain !== undefined ? cfg.gain : 0.42;
    var baseHp = cfg.baseFreq || 2350;
    var rev = cfg.reverbSend !== undefined ? cfg.reverbSend : 0.34;
    var panPattern = [-0.42, 0.36, -0.22, 0.46, -0.14, 0.28, 0.0];
    var freqOffsets = [1.0, 1.38, 1.82, 1.18, 2.12, 1.56, 2.35];

    for (var i = 0; i < count; i++) {
      var frac = count > 1 ? i / (count - 1) : 0;
      var dt = baseDelay + frac * spread + (i % 2 === 1 ? 0.005 : 0);
      var popDur = clamp(0.032 + (1 - frac) * 0.036, 0.026, 0.078);
      var popGain = baseGain * (1.0 - frac * 0.42);
      var cutoff = clamp(baseHp * freqOffsets[i % freqOffsets.length], 1600, 6800);
      playNoise(c, baseT, now, masterVol, prio, {
        kind: i % 3 === 2 ? 'white' : 'crackle',
        delay: dt,
        dur: popDur,
        attack: 0.002,
        gain: popGain,
        pan: panPattern[i % panPattern.length],
        reverbSend: rev,
        filter: {
          type: i % 2 === 0 ? 'highpass' : 'bandpass',
          freq: cutoff,
          endFreq: cutoff * 0.72,
          q: i % 2 === 0 ? 1.25 : 2.6
        },
        ornament: i >= 3
      });
    }
    return true;
  }

  // 非谐波冰晶 FM 合成器：严格采用 1.0 : 2.756 : 5.404 晶柱模态比，并送入冰晶宫殿混响总线
  function playCrystalFM(c, baseT, now, masterVol, prio, cfg) {
    if (!c || typeof c.createOscillator !== 'function' || typeof c.createGain !== 'function') return false;
    var delay = Math.max(0, cfg.delay || 0);
    var dur = Math.max(0.05, cfg.dur || 0.28);
    var freq = Math.max(80, cfg.freq || NOTE.D6);
    var gain = cfg.gain !== undefined ? cfg.gain : 0.44;
    var atk = clamp(cfg.attack !== undefined ? cfg.attack : 0.003, MIN_ATTACK, Math.min(MAX_ATTACK, dur * 0.35));
    var modIndex = cfg.modIndex !== undefined ? cfg.modIndex : 1.45;
    var revSend = cfg.reverbSend !== undefined ? cfg.reverbSend : 0.44;
    var pan = cfg.pan || 0;

    var slot = reserveVoice(now, delay, dur, prio, !!cfg.ornament);
    if (!slot) return false;

    try {
      var st = baseT + delay;
      var carrier = c.createOscillator();
      var mod = c.createOscillator();
      var modGain = c.createGain();
      var outGain = c.createGain();
      var peak = Math.max(0.00025, masterVol * gain);

      try {
        carrier.type = 'sine';
        mod.type = 'sine';
      } catch (e) {}

      // 基频 1.0 × f，调制器 2.756 × f（冰晶/金属棒第 2 弯曲模态）
      safeSetParam(carrier.frequency, freq * CRYSTAL_FM_RATIOS[0], st);
      if (cfg.slideTo) {
        safeExpRamp(carrier.frequency, Math.max(80, cfg.slideTo), st + dur);
      }
      if (cfg.detune && carrier.detune) {
        safeSetParam(carrier.detune, cfg.detune, st);
      }

      var modFreq = Math.min(12500, freq * CRYSTAL_FM_RATIOS[1]);
      safeSetParam(mod.frequency, modFreq, st);
      var modDepth = Math.min(4800, freq * modIndex);
      safeSetParam(modGain.gain, Math.max(1, modDepth), st);
      safeExpRamp(modGain.gain, Math.max(0.5, modDepth * 0.06), st + Math.max(0.04, dur * 0.45));

      safeSetParam(outGain.gain, 0.0001, st);
      safeLinearRamp(outGain.gain, peak, st + atk);
      safeExpRamp(outGain.gain, MIN_EXP_GAIN, st + dur);
      safeLinearRamp(outGain.gain, 0.00001, st + dur + 0.008);

      mod.connect(modGain);
      if (carrier.frequency && typeof modGain.connect === 'function') {
        try {
          modGain.connect(carrier.frequency);
        } catch (e) {}
      }

      var filter = createFilterNode(c, cfg.filter, st, dur);
      if (filter) {
        carrier.connect(filter);
        filter.connect(outGain);
      } else {
        carrier.connect(outGain);
      }
      connectOut(c, outGain, pan, { reverbSend: revSend });
      bindVoiceEvict(slot, c, carrier, outGain);

      try {
        carrier.onended = function () {
          slot.release();
        };
      } catch (e) {}

      if (typeof mod.start === 'function') mod.start(st);
      if (typeof carrier.start === 'function') carrier.start(st);
      if (typeof mod.stop === 'function') mod.stop(st + dur + 0.015);
      if (typeof carrier.stop === 'function') carrier.stop(st + dur + 0.015);
    } catch (e) {
      slot.release();
      return false;
    }

    // 第 3 非谐波模态 5.404 × f 冰晶星芒泛音（自动防 Nyquist 混叠）
    if (cfg.thirdPartial !== false) {
      var thirdFreq = freq * CRYSTAL_FM_RATIOS[2];
      if (thirdFreq < 14500) {
        playTone(c, baseT, now, masterVol, prio, {
          freq: thirdFreq,
          slideTo: cfg.slideTo ? Math.min(14500, cfg.slideTo * CRYSTAL_FM_RATIOS[2]) : 0,
          wave: 'sine',
          delay: delay + 0.002,
          dur: Math.max(0.04, dur * 0.36),
          attack: 0.002,
          gain: gain * (cfg.thirdGain !== undefined ? cfg.thirdGain : 0.2),
          detune: (cfg.detune || 0) + 4,
          pan: -pan * 0.65,
          reverbSend: revSend * 1.15,
          ornament: true
        });
      }
    }
    return true;
  }

  // =========================================================================
  // 28 组完整 D 大调霜晶钢片琴与绘本微音效配方
  // =========================================================================
  var RECIPES = {
    // --- 标题页 ---
    title_hover: {
      prio: 1,
      cooldown: 65,
      hoverOnly: true,
      fn: function (c, t, now, vol, prio, opts) {
        var idx;
        if (opts && typeof opts.step === 'number' && isFinite(opts.step)) {
          idx = ((Math.floor(opts.step) % TITLE_PENTATONIC.length) + TITLE_PENTATONIC.length) % TITLE_PENTATONIC.length;
        } else {
          idx = state.titleHoverCursor % TITLE_PENTATONIC.length;
          state.titleHoverCursor = (state.titleHoverCursor + 1) % TITLE_PENTATONIC.length;
        }
        var f = TITLE_PENTATONIC[idx];
        var pan = (idx - 2) * 0.14;
        playCelesta(c, t, now, vol, prio, {
          freq: f,
          dur: 0.23,
          attack: 0.004,
          gain: 0.46,
          overtoneRatio: 2.0,
          overtoneGain: 0.28,
          overtoneDurMul: 0.5,
          pan: pan
        });
        playTone(c, t, now, vol, prio, {
          freq: f * 2.756,
          wave: 'sine',
          delay: 0.002,
          dur: 0.058,
          attack: 0.002,
          gain: 0.09,
          pan: -pan * 0.5,
          ornament: true
        });
      }
    },

    title_click: {
      prio: 2,
      cooldown: 80,
      fn: function (c, t, now, vol, prio) {
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.D6,
          wave: 'triangle',
          delay: 0,
          dur: 0.24,
          attack: 0.003,
          gain: 0.54,
          filter: { type: 'lowpass', freq: 5200, q: 0.7 },
          pan: -0.15
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.A6,
          delay: 0.045,
          dur: 0.27,
          attack: 0.003,
          gain: 0.46,
          overtone: false,
          pan: 0.12
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D7,
          wave: 'sine',
          delay: 0.095,
          dur: 0.36,
          attack: 0.004,
          gain: 0.36,
          detune: 4,
          pan: 0.2
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs7,
          wave: 'sine',
          delay: 0.115,
          dur: 0.22,
          attack: 0.004,
          gain: 0.13,
          detune: 8,
          ornament: true
        });
      }
    },

    title_start: {
      prio: 4,
      cooldown: 180,
      fn: function (c, t, now, vol, prio) {
        // 绘本冰晶开篇：温暖 G-maj9 → 澄澈 D-maj9 琶音 + 轻霜风息
        playTone(c, t, now, vol, prio, {
          freq: NOTE.G4,
          wave: 'triangle',
          delay: 0,
          dur: 0.72,
          attack: 0.012,
          gain: 0.38,
          filter: { type: 'lowpass', freq: 1650, q: 0.7 }
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0.02,
          dur: 0.42,
          attack: 0.014,
          gain: 0.14,
          filter: { type: 'bandpass', freq: 1400, endFreq: 3400, q: 2.0 },
          ornament: true
        });
        var arp = [
          { f: NOTE.D5, d: 0.00, dur: 0.34, g: 0.46, p: -0.25 },
          { f: NOTE.Fs5, d: 0.055, dur: 0.36, g: 0.46, p: -0.15 },
          { f: NOTE.A5, d: 0.11, dur: 0.38, g: 0.48, p: -0.05 },
          { f: NOTE.B5, d: 0.165, dur: 0.40, g: 0.44, p: 0.05 },
          { f: NOTE.D6, d: 0.225, dur: 0.46, g: 0.50, p: 0.14 },
          { f: NOTE.E6, d: 0.285, dur: 0.48, g: 0.44, p: 0.22 },
          { f: NOTE.A6, d: 0.35, dur: 0.58, g: 0.42, p: 0.28 }
        ];
        for (var i = 0; i < arp.length; i++) {
          playTone(c, t, now, vol, prio, {
            freq: arp[i].f,
            wave: i < 2 ? 'triangle' : 'sine',
            delay: arp[i].d,
            dur: arp[i].dur,
            attack: 0.004,
            gain: arp[i].g,
            detune: i === arp.length - 1 ? 5 : 0,
            filter: i < 2 ? { type: 'lowpass', freq: 3800, q: 0.7 } : null,
            pan: arp[i].p
          });
        }
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D7,
          wave: 'sine',
          delay: 0.38,
          dur: 0.46,
          attack: 0.006,
          gain: 0.18,
          detune: 7,
          ornament: true
        });
      }
    },

    // --- UI 弹窗与页签 ---
    modal_open: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.095,
          attack: 0.010,
          gain: 0.26,
          filter: { type: 'bandpass', freq: 920, endFreq: 2350, q: 1.8 }
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.E5,
          delay: 0.018,
          dur: 0.22,
          attack: 0.004,
          gain: 0.44,
          overtone: false,
          pan: -0.12
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.A5,
          delay: 0.065,
          dur: 0.30,
          attack: 0.004,
          gain: 0.48,
          overtoneRatio: 2.0,
          overtoneGain: 0.22,
          pan: 0.12
        });
      }
    },

    modal_close: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.09,
          attack: 0.010,
          gain: 0.22,
          filter: { type: 'bandpass', freq: 1950, endFreq: 760, q: 1.6 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A5,
          wave: 'sine',
          delay: 0,
          dur: 0.14,
          attack: 0.004,
          gain: 0.36,
          pan: 0.1
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs5,
          wave: 'sine',
          delay: 0.04,
          dur: 0.16,
          attack: 0.004,
          gain: 0.34,
          pan: 0
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D5,
          wave: 'triangle',
          delay: 0.082,
          dur: 0.22,
          attack: 0.005,
          gain: 0.40,
          filter: { type: 'lowpass', freq: 2400, q: 0.7 },
          pan: -0.1
        });
      }
    },

    tab_switch: {
      prio: 1,
      cooldown: 35,
      fn: function (c, t, now, vol, prio) {
        var micro = ((state.clickNonce++ % 3) - 1) * 4;
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          slideTo: NOTE.A6,
          wave: 'sine',
          delay: 0,
          dur: 0.056,
          attack: 0.002,
          gain: 0.44,
          detune: micro
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs6 * 2.75,
          wave: 'sine',
          delay: 0.001,
          dur: 0.028,
          attack: 0.002,
          gain: 0.13,
          ornament: true
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D5,
          wave: 'triangle',
          delay: 0,
          dur: 0.032,
          attack: 0.002,
          gain: 0.20,
          filter: { type: 'lowpass', freq: 2200, q: 0.7 },
          ornament: true
        });
      }
    },

    page: {
      prio: 1,
      cooldown: 35,
      fn: function (c, t, now, vol, prio) {
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.078,
          attack: 0.008,
          gain: 0.28,
          filter: { type: 'bandpass', freq: 1180, endFreq: 2650, q: 2.1 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A5,
          slideTo: NOTE.Fs5,
          wave: 'triangle',
          delay: 0.012,
          dur: 0.095,
          attack: 0.004,
          gain: 0.30,
          filter: { type: 'lowpass', freq: 3000, q: 0.7 }
        });
      }
    },

    open: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        // 澄澈系统「叮」铃音
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.A5,
          delay: 0,
          dur: 0.34,
          attack: 0.003,
          gain: 0.56,
          overtoneRatio: 2.0,
          overtoneGain: 0.36,
          overtoneDurMul: 0.65
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.E6,
          wave: 'sine',
          delay: 0.026,
          dur: 0.24,
          attack: 0.004,
          gain: 0.24,
          detune: 3,
          ornament: true
        });
      }
    },

    click: {
      prio: 1,
      cooldown: 35,
      fn: function (c, t, now, vol, prio) {
        var micro = ((state.clickNonce++ % 5) - 2) * 3;
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D6,
          slideTo: NOTE.Fs6,
          wave: 'sine',
          delay: 0,
          dur: 0.056,
          attack: 0.002,
          gain: 0.44,
          detune: micro
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D5,
          wave: 'triangle',
          delay: 0,
          dur: 0.036,
          attack: 0.002,
          gain: 0.22,
          filter: { type: 'lowpass', freq: 2500, q: 0.7 },
          ornament: true
        });
      }
    },

    card_hover: {
      prio: 1,
      cooldown: 55,
      hoverOnly: true,
      fn: function (c, t, now, vol, prio, opts) {
        var idx;
        if (opts && typeof opts.step === 'number' && isFinite(opts.step)) {
          idx = ((Math.floor(opts.step) % CARD_PENTATONIC.length) + CARD_PENTATONIC.length) % CARD_PENTATONIC.length;
        } else {
          idx = state.cardHoverCursor % CARD_PENTATONIC.length;
          state.cardHoverCursor = (state.cardHoverCursor + 1) % CARD_PENTATONIC.length;
        }
        var f = CARD_PENTATONIC[idx];
        playTone(c, t, now, vol, prio, {
          freq: f,
          slideTo: f * 1.045,
          wave: 'sine',
          delay: 0,
          dur: 0.068,
          attack: 0.003,
          gain: 0.28
        });
        playTone(c, t, now, vol, prio, {
          freq: f * 2.0,
          wave: 'sine',
          delay: 0.002,
          dur: 0.036,
          attack: 0.002,
          gain: 0.09,
          ornament: true
        });
      }
    },

    ok: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D5,
          wave: 'triangle',
          delay: 0,
          dur: 0.14,
          attack: 0.003,
          gain: 0.46,
          filter: { type: 'lowpass', freq: 3400, q: 0.7 },
          pan: -0.1
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.A5,
          delay: 0.054,
          dur: 0.24,
          attack: 0.003,
          gain: 0.52,
          overtoneRatio: 1.5,
          overtoneGain: 0.24,
          pan: 0.1
        });
      }
    },

    bad: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        // 温润低通沉闷叩击（拒绝刺耳未滤波锯齿波）
        playTone(c, t, now, vol, prio, {
          freq: 210,
          slideTo: 116,
          wave: 'triangle',
          delay: 0,
          dur: 0.21,
          attack: 0.008,
          gain: 0.62,
          filter: { type: 'lowpass', freq: 390, endFreq: 210, q: 0.9 }
        });
        playTone(c, t, now, vol, prio, {
          freq: 132,
          slideTo: 74,
          wave: 'sine',
          delay: 0.004,
          dur: 0.19,
          attack: 0.006,
          gain: 0.50
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.075,
          attack: 0.006,
          gain: 0.18,
          filter: { type: 'lowpass', freq: 420, q: 0.8 },
          ornament: true
        });
      }
    },

    // --- 养成与惊喜反馈 ---
    stat_gain: {
      prio: 2,
      cooldown: 85,
      fn: function (c, t, now, vol, prio, opts) {
        var stepIdx = opts && typeof opts.step === 'number' && isFinite(opts.step)
          ? clamp(Math.floor(opts.step), 0, STAT_LIFT.length - 1)
          : 0;
        var mul = STAT_LIFT[stepIdx];
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs5 * mul,
          wave: 'sine',
          delay: 0,
          dur: 0.14,
          attack: 0.003,
          gain: 0.42,
          pan: -0.14
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A5 * mul,
          wave: 'sine',
          delay: 0.048,
          dur: 0.17,
          attack: 0.003,
          gain: 0.46,
          pan: 0
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.D6 * mul,
          delay: 0.10,
          dur: 0.27,
          attack: 0.003,
          gain: 0.50,
          overtoneRatio: 1.5,
          overtoneGain: 0.24,
          pan: 0.16
        });
      }
    },

    gift_loved: {
      prio: 3,
      cooldown: 110,
      fn: function (c, t, now, vol, prio) {
        // 温暖五音八音盒竖琴琶音 (D5-F#5-A5-B5-D6)
        var notes = [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.B5, NOTE.D6];
        for (var i = 0; i < notes.length; i++) {
          var isLast = i === notes.length - 1;
          playTone(c, t, now, vol, prio, {
            freq: notes[i],
            wave: i < 2 ? 'triangle' : 'sine',
            delay: i * 0.052,
            dur: isLast ? 0.42 : 0.24,
            attack: 0.004,
            gain: isLast ? 0.52 : 0.44,
            filter: i < 2 ? { type: 'lowpass', freq: 4000, q: 0.7 } : null,
            pan: (i - 2) * 0.11
          });
        }
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A6,
          wave: 'sine',
          delay: 0.22,
          dur: 0.34,
          attack: 0.005,
          gain: 0.20,
          detune: 6,
          ornament: true
        });
      }
    },

    schedule_done: {
      prio: 3,
      cooldown: 110,
      fn: function (c, t, now, vol, prio) {
        // 明快 D-maj9 钢片琴华彩
        var chord = [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.Cs6, NOTE.E6];
        for (var i = 0; i < chord.length; i++) {
          playTone(c, t, now, vol, prio, {
            freq: chord[i],
            wave: i === 0 ? 'triangle' : 'sine',
            delay: i * 0.038,
            dur: 0.30 + i * 0.035,
            attack: 0.003,
            gain: 0.44,
            filter: i === 0 ? { type: 'lowpass', freq: 3800, q: 0.7 } : null,
            pan: (i - 2) * 0.12
          });
        }
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A6,
          wave: 'sine',
          delay: 0.185,
          dur: 0.38,
          attack: 0.004,
          gain: 0.24,
          detune: 5,
          ornament: true
        });
      }
    },

    level: {
      prio: 4,
      cooldown: 160,
      fn: function (c, t, now, vol, prio) {
        // 五音晶铃凯旋号角
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D4,
          wave: 'triangle',
          delay: 0,
          dur: 0.56,
          attack: 0.010,
          gain: 0.38,
          filter: { type: 'lowpass', freq: 1600, q: 0.7 }
        });
        var fanfare = [
          { f: NOTE.D5, d: 0.00, dur: 0.20, g: 0.46, p: -0.2 },
          { f: NOTE.Fs5, d: 0.062, dur: 0.22, g: 0.48, p: -0.1 },
          { f: NOTE.A5, d: 0.124, dur: 0.24, g: 0.50, p: 0 },
          { f: NOTE.B5, d: 0.186, dur: 0.26, g: 0.48, p: 0.1 },
          { f: NOTE.D6, d: 0.252, dur: 0.46, g: 0.58, p: 0.18 }
        ];
        for (var i = 0; i < fanfare.length; i++) {
          playTone(c, t, now, vol, prio, {
            freq: fanfare[i].f,
            wave: i < 3 ? 'triangle' : 'sine',
            delay: fanfare[i].d,
            dur: fanfare[i].dur,
            attack: 0.003,
            gain: fanfare[i].g,
            filter: i < 3 ? { type: 'lowpass', freq: 4400, q: 0.7 } : null,
            pan: fanfare[i].p
          });
        }
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          wave: 'sine',
          delay: 0.268,
          dur: 0.42,
          attack: 0.005,
          gain: 0.26,
          detune: 4,
          ornament: true
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A6,
          wave: 'sine',
          delay: 0.285,
          dur: 0.40,
          attack: 0.005,
          gain: 0.20,
          detune: 7,
          ornament: true
        });
      }
    },

    season_report: {
      prio: 4,
      cooldown: 180,
      fn: function (c, t, now, vol, prio) {
        // 绘本盛典钢片琴双音和声 + 霜晶微光
        var dyads = [
          [NOTE.D5, NOTE.A5, 0.00, 0.25, 0.44],
          [NOTE.Fs5, NOTE.B5, 0.11, 0.27, 0.46],
          [NOTE.A5, NOTE.D6, 0.225, 0.50, 0.52]
        ];
        for (var i = 0; i < dyads.length; i++) {
          var dy = dyads[i];
          playTone(c, t, now, vol, prio, {
            freq: dy[0],
            wave: 'triangle',
            delay: dy[2],
            dur: dy[3],
            attack: 0.004,
            gain: dy[4],
            filter: { type: 'lowpass', freq: 4200, q: 0.7 },
            pan: -0.18
          });
          playTone(c, t, now, vol, prio, {
            freq: dy[1],
            wave: 'sine',
            delay: dy[2] + 0.012,
            dur: dy[3] + 0.04,
            attack: 0.004,
            gain: dy[4] * 0.92,
            pan: 0.18
          });
        }
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          wave: 'sine',
          delay: 0.28,
          dur: 0.44,
          attack: 0.005,
          gain: 0.24,
          detune: 5,
          ornament: true
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D7,
          wave: 'sine',
          delay: 0.34,
          dur: 0.46,
          attack: 0.006,
          gain: 0.18,
          detune: 8,
          ornament: true
        });
      }
    },

    // --- 信箱与火漆拆封 ---
    wax_seal: {
      prio: 3,
      cooldown: 120,
      fn: function (c, t, now, vol, prio) {
        // 阶段一：火漆脆裂 + 真空起封啵声
        playNoise(c, t, now, vol, prio, {
          kind: 'crackle',
          delay: 0,
          dur: 0.052,
          attack: 0.002,
          gain: 0.46,
          filter: { type: 'highpass', freq: 1650, q: 1.2 }
        });
        playTone(c, t, now, vol, prio, {
          freq: 215,
          midFreq: 455,
          midTime: 0.022,
          slideTo: 168,
          wave: 'sine',
          delay: 0.006,
          dur: 0.056,
          attack: 0.003,
          gain: 0.48,
          filter: { type: 'lowpass', freq: 1150, q: 1.0 }
        });
        // 阶段二：信纸滑出展页
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0.068,
          dur: 0.14,
          attack: 0.012,
          gain: 0.30,
          filter: { type: 'bandpass', freq: 820, endFreq: 2350, q: 1.9 }
        });
        // 阶段三：冰纹家徽钢片琴微光
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A5,
          wave: 'sine',
          delay: 0.165,
          dur: 0.28,
          attack: 0.004,
          gain: 0.38,
          pan: -0.14
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D6,
          wave: 'sine',
          delay: 0.215,
          dur: 0.34,
          attack: 0.004,
          gain: 0.44,
          pan: 0.04
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          delay: 0.265,
          dur: 0.40,
          attack: 0.004,
          gain: 0.36,
          overtoneRatio: 1.5,
          overtoneGain: 0.22,
          pan: 0.18
        });
      }
    },

    letter_fold: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.115,
          attack: 0.010,
          gain: 0.28,
          filter: { type: 'bandpass', freq: 2250, endFreq: 840, q: 2.1 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs5,
          wave: 'sine',
          delay: 0.032,
          dur: 0.14,
          attack: 0.004,
          gain: 0.28,
          pan: 0.08
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D5,
          wave: 'sine',
          delay: 0.084,
          dur: 0.21,
          attack: 0.005,
          gain: 0.34,
          pan: -0.08
        });
      }
    },

    // --- 战斗与冰晶魔法（影院四层拟音：扫频气流 + 饱和次低音冲击 + 交错碎冰 + 1.0:2.756:5.404 非谐波晶振入殿堂混响） ---
    ice_shatter: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 极寒爆裂冲击气流
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 1850,
          endFreq: 420,
          dur: 0.14,
          attack: 0.004,
          gain: 0.34,
          reverbSend: 0.32
        });
        // Layer 2: 饱和次低音重击胸腔感
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 168,
          endFreq: 40,
          dur: 0.145,
          gain: 0.74,
          clickFreq: 1380
        });
        // Layer 3: 六段交错高频碎冰爆裂
        playShatterPops(c, t, now, vol, prio, {
          count: 6,
          delay: 0.003,
          spread: 0.115,
          gain: 0.48,
          baseFreq: 2250,
          reverbSend: 0.42
        });
        // Layer 4: 非谐波冰晶 FM 飞溅余韵（1.0 : 2.756 : 5.404）
        var shards = [
          { f: NOTE.E6, to: NOTE.B5, d: 0.012, dur: 0.24, g: 0.36, p: -0.36, mi: 1.6 },
          { f: NOTE.A6, to: NOTE.Fs6, d: 0.042, dur: 0.26, g: 0.32, p: 0.34, mi: 1.35 },
          { f: NOTE.D7, to: NOTE.A6, d: 0.074, dur: 0.28, g: 0.26, p: -0.20, mi: 1.15 }
        ];
        for (var i = 0; i < shards.length; i++) {
          var s = shards[i];
          playCrystalFM(c, t, now, vol, prio, {
            freq: s.f,
            slideTo: s.to,
            delay: s.d,
            dur: s.dur,
            gain: s.g,
            modIndex: s.mi,
            pan: s.p,
            reverbSend: 0.56,
            ornament: i >= 2
          });
        }
      }
    },

    blade_clash: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 寒锋高速削风 + 火星带通扫频
        playWhoosh(c, t, now, vol, prio, {
          kind: 'white',
          startFreq: 3800,
          endFreq: 1350,
          dur: 0.095,
          attack: 0.002,
          gain: 0.44,
          q: 2.8,
          reverbSend: 0.3
        });
        // Layer 2: 紧实交锋冲击体
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 195,
          endFreq: 68,
          dur: 0.082,
          gain: 0.56,
          clickFreq: 1850
        });
        // Layer 3: 寒钢火星微爆
        playShatterPops(c, t, now, vol, prio, {
          count: 3,
          delay: 0.002,
          spread: 0.042,
          gain: 0.34,
          baseFreq: 3100,
          reverbSend: 0.28
        });
        // Layer 4: 双组冷钢非谐波 FM 共鸣
        playCrystalFM(c, t, now, vol, prio, {
          freq: 1140,
          slideTo: 1085,
          delay: 0,
          dur: 0.30,
          gain: 0.44,
          modIndex: 2.1,
          pan: -0.16,
          reverbSend: 0.46
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: 1698,
          slideTo: 1645,
          delay: 0.004,
          dur: 0.25,
          gain: 0.34,
          modIndex: 1.75,
          pan: 0.18,
          reverbSend: 0.46,
          ornament: true
        });
      }
    },

    parry: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 上扬卸力寒风扫频
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 1150,
          endFreq: 3900,
          dur: 0.125,
          attack: 0.004,
          gain: 0.38,
          q: 2.4,
          reverbSend: 0.34
        });
        // Layer 2: 精准格挡次低音锁点
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 210,
          endFreq: 62,
          dur: 0.088,
          gain: 0.60,
          clickFreq: 1960
        });
        // Layer 3: 霜刃火花碎响
        playShatterPops(c, t, now, vol, prio, {
          count: 4,
          delay: 0.004,
          spread: 0.064,
          gain: 0.34,
          baseFreq: 2950,
          reverbSend: 0.38
        });
        // Layer 4: 上扬闪反三连非谐波冰铃 FM（E6 -> A6 -> D7）
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.E6,
          slideTo: NOTE.A6,
          delay: 0.006,
          dur: 0.22,
          gain: 0.48,
          modIndex: 1.85,
          pan: -0.16,
          reverbSend: 0.54
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.D7,
          delay: 0.056,
          dur: 0.34,
          gain: 0.42,
          modIndex: 1.2,
          detune: 5,
          pan: 0.22,
          reverbSend: 0.64
        });
      }
    },

    break_chime: {
      prio: 4,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 破招震荡气浪
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 620,
          midFreq: 3400,
          midTime: 0.05,
          endFreq: 980,
          dur: 0.21,
          attack: 0.005,
          gain: 0.40,
          q: 2.0,
          reverbSend: 0.42
        });
        // Layer 2: 影院级重破韧次低音落锤
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 152,
          endFreq: 36,
          dur: 0.17,
          gain: 0.78,
          clickFreq: 1480
        });
        // Layer 3: 护盾与弱点锁崩解五连脆裂
        playShatterPops(c, t, now, vol, prio, {
          count: 5,
          delay: 0.003,
          spread: 0.105,
          gain: 0.46,
          baseFreq: 2200,
          reverbSend: 0.48
        });
        // Layer 4: B 大调霜晶殿堂 FM 三和弦（B4 / B5 / D#6 / F#6 / B6）
        playTone(c, t, now, vol, prio, {
          freq: NOTE.B4,
          wave: 'triangle',
          delay: 0.022,
          dur: 0.52,
          attack: 0.005,
          gain: 0.40,
          filter: { type: 'lowpass', freq: 2600, q: 0.7 },
          reverbSend: 0.48
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.B5,
          delay: 0.028,
          dur: 0.48,
          gain: 0.48,
          modIndex: 1.45,
          pan: -0.22,
          reverbSend: 0.62
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.Ds6,
          delay: 0.064,
          dur: 0.48,
          gain: 0.44,
          modIndex: 1.25,
          pan: 0.04,
          reverbSend: 0.64
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          delay: 0.102,
          dur: 0.52,
          gain: 0.42,
          modIndex: 1.1,
          pan: 0.24,
          reverbSend: 0.68
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.B6,
          wave: 'sine',
          delay: 0.132,
          dur: 0.40,
          attack: 0.004,
          gain: 0.24,
          detune: 6,
          reverbSend: 0.72,
          ornament: true
        });
      }
    },

    combat_crit: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 高压裂空扫频
        playWhoosh(c, t, now, vol, prio, {
          kind: 'white',
          startFreq: 1950,
          endFreq: 4600,
          dur: 0.11,
          attack: 0.003,
          gain: 0.40,
          q: 2.4,
          reverbSend: 0.36
        });
        // Layer 2: 暴击重拳次低音
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 192,
          endFreq: 42,
          dur: 0.14,
          gain: 0.76,
          clickFreq: 1620
        });
        // Layer 3: 晶簇迸裂火花
        playShatterPops(c, t, now, vol, prio, {
          count: 4,
          delay: 0.004,
          spread: 0.072,
          gain: 0.40,
          baseFreq: 2650,
          reverbSend: 0.44
        });
        // Layer 4: A5->D6->A6->D7 璀璨非谐波冰晶 FM 暴击绽放
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.A5,
          slideTo: NOTE.D6,
          delay: 0.012,
          dur: 0.24,
          gain: 0.46,
          modIndex: 1.7,
          pan: -0.18,
          reverbSend: 0.56
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.A6,
          delay: 0.044,
          dur: 0.32,
          gain: 0.42,
          modIndex: 1.35,
          pan: 0.18,
          reverbSend: 0.62
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D7,
          wave: 'sine',
          delay: 0.076,
          dur: 0.28,
          attack: 0.003,
          gain: 0.26,
          detune: 5,
          reverbSend: 0.68,
          ornament: true
        });
      }
    },

    shield_block: {
      prio: 2,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 结界凝霜气流扫掠
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 1350,
          endFreq: 2950,
          dur: 0.11,
          attack: 0.004,
          gain: 0.28,
          q: 2.3,
          reverbSend: 0.34
        });
        // Layer 2: 厚实冰壁沉顿落座
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 260,
          endFreq: 96,
          dur: 0.115,
          gain: 0.58,
          cutoff: 440,
          clickFreq: 980
        });
        // Layer 3: 冰壳受冲微裂
        playShatterPops(c, t, now, vol, prio, {
          count: 3,
          delay: 0.005,
          spread: 0.048,
          gain: 0.26,
          baseFreq: 2450,
          reverbSend: 0.32
        });
        // Layer 4: 霜晶护幕 FM 谐振（F#5 / C#6）
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.Fs5,
          delay: 0.008,
          dur: 0.24,
          gain: 0.36,
          modIndex: 1.25,
          pan: -0.14,
          reverbSend: 0.48
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.Cs6,
          delay: 0.018,
          dur: 0.22,
          gain: 0.26,
          modIndex: 1.0,
          detune: 7,
          pan: 0.14,
          reverbSend: 0.52,
          ornament: true
        });
      }
    },

    sword_slash: {
      prio: 2,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 凌厉剑锋三段弧形破空扫频
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 520,
          midFreq: 3450,
          midTime: 0.055,
          endFreq: 920,
          dur: 0.155,
          attack: 0.005,
          gain: 0.48,
          q: 2.2,
          pan: -0.12,
          reverbSend: 0.26
        });
        // Layer 2: 挥剑发力短促底劲
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 175,
          endFreq: 56,
          dur: 0.078,
          gain: 0.44,
          clickFreq: 1420
        });
        // Layer 3: 寒锋霜粒擦空
        playShatterPops(c, t, now, vol, prio, {
          count: 3,
          delay: 0.018,
          spread: 0.052,
          gain: 0.24,
          baseFreq: 3200,
          reverbSend: 0.24
        });
        // Layer 4: 剑脊细微非谐波寒鸣
        playCrystalFM(c, t, now, vol, prio, {
          freq: 1480,
          slideTo: 640,
          delay: 0.006,
          dur: 0.13,
          gain: 0.30,
          modIndex: 1.5,
          pan: 0.14,
          reverbSend: 0.32
        });
      }
    },

    ice_cast: {
      prio: 2,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 凝结寒潮上行气流
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 920,
          endFreq: 4200,
          dur: 0.23,
          attack: 0.012,
          gain: 0.28,
          q: 2.5,
          reverbSend: 0.44
        });
        // Layer 2: 魔力引动温润低频基座
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 138,
          endFreq: 58,
          dur: 0.11,
          gain: 0.36,
          click: false
        });
        // Layer 3: 水汽凝结细碎冰晶爆音
        playShatterPops(c, t, now, vol, prio, {
          count: 4,
          delay: 0.02,
          spread: 0.12,
          gain: 0.24,
          baseFreq: 2800,
          reverbSend: 0.46
        });
        // Layer 4: 上行 D 大调非谐波冰晶 FM（A5 -> D6 -> F#6）
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.A5,
          delay: 0,
          dur: 0.22,
          gain: 0.38,
          modIndex: 1.2,
          pan: -0.20,
          reverbSend: 0.54
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.D6,
          delay: 0.044,
          dur: 0.26,
          gain: 0.42,
          modIndex: 1.15,
          pan: 0,
          reverbSend: 0.58
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          delay: 0.092,
          dur: 0.34,
          gain: 0.42,
          modIndex: 1.05,
          pan: 0.20,
          reverbSend: 0.64
        });
      }
    },

    water_surge: {
      prio: 2,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // Layer 1: 覆潮水弹流动扫频
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 420,
          midFreq: 2350,
          midTime: 0.075,
          endFreq: 760,
          dur: 0.20,
          attack: 0.010,
          gain: 0.40,
          q: 1.85,
          reverbSend: 0.38
        });
        // Layer 2: 水体撞击闷弹冲量
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 185,
          endFreq: 54,
          dur: 0.125,
          gain: 0.56,
          cutoff: 380,
          clickFreq: 780
        });
        // Layer 3: 水花飞溅高频水珠声
        playShatterPops(c, t, now, vol, prio, {
          count: 4,
          delay: 0.012,
          spread: 0.088,
          gain: 0.26,
          baseFreq: 1850,
          reverbSend: 0.42
        });
        // Layer 4: 水滴折射清澈音色（先升后落液态滑音）
        playTone(c, t, now, vol, prio, {
          freq: 340,
          midFreq: 680,
          midTime: 0.045,
          slideTo: 240,
          wave: 'sine',
          delay: 0.010,
          dur: 0.15,
          attack: 0.004,
          gain: 0.38,
          pan: -0.14,
          reverbSend: 0.42
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.G6,
          slideTo: NOTE.D6,
          delay: 0.048,
          dur: 0.22,
          gain: 0.26,
          modIndex: 0.85,
          pan: 0.18,
          reverbSend: 0.54,
          ornament: true
        });
      }
    },

    eclipse_cast: {
      prio: 3,
      cooldown: 60,
      fn: function (c, t, now, vol, prio) {
        // 晦轮杖暗银真伤导魔：幽邃低频吸气扫频 + 虚空沉响 + 暗银非谐波双音拍振
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 380,
          midFreq: 2150,
          midTime: 0.12,
          endFreq: 640,
          dur: 0.26,
          attack: 0.014,
          gain: 0.36,
          q: 2.6,
          reverbSend: 0.52
        });
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 128,
          endFreq: 38,
          dur: 0.19,
          gain: 0.72,
          cutoff: 260,
          clickFreq: 960
        });
        playShatterPops(c, t, now, vol, prio, {
          count: 4,
          delay: 0.018,
          spread: 0.092,
          gain: 0.34,
          baseFreq: 2600,
          reverbSend: 0.54
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.B5,
          slideTo: NOTE.As5 || 932.33,
          delay: 0.014,
          dur: 0.38,
          gain: 0.42,
          modIndex: 2.0,
          pan: -0.24,
          reverbSend: 0.68
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          slideTo: NOTE.E6,
          delay: 0.046,
          dur: 0.42,
          gain: 0.36,
          modIndex: 1.65,
          detune: -9,
          pan: 0.24,
          reverbSend: 0.72
        });
      }
    },

    one_more: {
      prio: 4,
      cooldown: 80,
      fn: function (c, t, now, vol, prio) {
        // ONE MORE 乘胜追击：凌厉霜切 + 饱满次低音踏步 + 疾速上行 D 大调冰晶号角
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 1100,
          endFreq: 4800,
          dur: 0.15,
          attack: 0.004,
          gain: 0.36,
          q: 2.3,
          reverbSend: 0.46
        });
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 172,
          endFreq: 44,
          dur: 0.145,
          gain: 0.70,
          clickFreq: 1580
        });
        playShatterPops(c, t, now, vol, prio, {
          count: 4,
          delay: 0.004,
          spread: 0.068,
          gain: 0.38,
          baseFreq: 2700,
          reverbSend: 0.48
        });
        var chord = [
          { f: NOTE.D6, d: 0.010, dur: 0.24, p: -0.24, g: 0.44 },
          { f: NOTE.Fs6, d: 0.048, dur: 0.26, p: -0.06, g: 0.44 },
          { f: NOTE.A6, d: 0.086, dur: 0.30, p: 0.12, g: 0.46 },
          { f: NOTE.D7, d: 0.128, dur: 0.42, p: 0.26, g: 0.44 }
        ];
        for (var i = 0; i < chord.length; i++) {
          var n = chord[i];
          playCrystalFM(c, t, now, vol, prio, {
            freq: n.f,
            delay: n.d,
            dur: n.dur,
            gain: n.g,
            modIndex: 1.2,
            pan: n.p,
            reverbSend: 0.66,
            ornament: i >= 3
          });
        }
      }
    },

    footstep: {
      prio: 1,
      cooldown: 65,
      fn: function (c, t, now, vol, prio) {
        // 霜雪与石砖战术踏步拟音：微幅左右声像与音高交替，自然无机械重复感
        var alt = (state.stepNonce++ % 2 === 0) ? 1 : -1;
        var pitchMul = alt > 0 ? 1.04 : 0.96;
        playSubPunch(c, t, now, vol, prio, {
          startFreq: 118 * pitchMul,
          endFreq: 44,
          dur: 0.056,
          gain: 0.38,
          cutoff: 220,
          click: false
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0.003,
          dur: 0.064,
          attack: 0.004,
          gain: 0.26,
          pan: alt * 0.12,
          reverbSend: 0.16,
          filter: { type: 'bandpass', freq: 1680 * pitchMul, endFreq: 960, q: 1.9 }
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'crackle',
          delay: 0.006,
          dur: 0.044,
          attack: 0.002,
          gain: 0.20,
          pan: alt * 0.16,
          reverbSend: 0.18,
          filter: { type: 'highpass', freq: 2750 * pitchMul, q: 1.2 },
          ornament: true
        });
      }
    },

    phase2: {
      prio: 4,
      cooldown: 220,
      fn: function (c, t, now, vol, prio) {
        // 强敌二阶段觉醒（影院四层：风暴气浪 + 深沉次低音坠击 + 冰裂预警 + 霜殿钟鸣）
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 680,
          midFreq: 3250,
          midTime: 0.14,
          endFreq: 1120,
          dur: 0.42,
          attack: 0.014,
          gain: 0.34,
          q: 1.8,
          reverbSend: 0.52
        });
        playSubPunch(c, t, now, vol, prio, {
          startFreq: NOTE.D3,
          endFreq: 36,
          dur: 0.54,
          attack: 0.012,
          gain: 0.78,
          cutoff: 280,
          clickFreq: 920
        });
        playShatterPops(c, t, now, vol, prio, {
          count: 5,
          delay: 0.025,
          spread: 0.14,
          gain: 0.36,
          baseFreq: 2100,
          reverbSend: 0.54
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D4,
          slideTo: NOTE.A4,
          wave: 'triangle',
          delay: 0.07,
          dur: 0.46,
          attack: 0.010,
          gain: 0.46,
          filter: { type: 'lowpass', freq: 1950, q: 0.9 },
          reverbSend: 0.52
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.A5,
          delay: 0.14,
          dur: 0.48,
          gain: 0.44,
          modIndex: 1.55,
          pan: -0.18,
          reverbSend: 0.66
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.Cs6,
          delay: 0.22,
          dur: 0.54,
          gain: 0.42,
          modIndex: 1.4,
          detune: 5,
          pan: 0.18,
          reverbSend: 0.72
        });
      }
    },

    ui_tick: {
      prio: 1,
      cooldown: 28,
      fn: function (c, t, now, vol, prio) {
        // 棱晶折光微声（P5 棱晶指令翼切换 / 轻触翻行）
        var micro = ((state.clickNonce++ % 4) - 1.5) * 3.5;
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A6,
          slideTo: NOTE.D7,
          wave: 'sine',
          delay: 0,
          dur: 0.044,
          attack: 0.002,
          gain: 0.34,
          detune: micro,
          reverbSend: 0.14
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D6,
          wave: 'triangle',
          delay: 0,
          dur: 0.028,
          attack: 0.002,
          gain: 0.18,
          filter: { type: 'lowpass', freq: 3400, q: 0.8 },
          ornament: true
        });
      }
    },

    shield_up: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        // 冰壁构筑护盾（清透升阶霜晶展开，区别于受击格挡的 shield_block）
        playWhoosh(c, t, now, vol, prio, {
          startFreq: 900,
          endFreq: 3400,
          dur: 0.14,
          attack: 0.008,
          gain: 0.24,
          q: 2.2,
          reverbSend: 0.36
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.D5,
          delay: 0.01,
          dur: 0.24,
          gain: 0.44,
          pan: -0.14,
          reverbSend: 0.42
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.A5,
          delay: 0.052,
          dur: 0.28,
          gain: 0.48,
          pan: 0.08,
          reverbSend: 0.48
        });
        playCrystalFM(c, t, now, vol, prio, {
          freq: NOTE.D6,
          delay: 0.095,
          dur: 0.32,
          gain: 0.40,
          modIndex: 1.05,
          pan: 0.18,
          reverbSend: 0.56,
          ornament: true
        });
      }
    },

    buff: {
      prio: 2,
      cooldown: 75,
      fn: function (c, t, now, vol, prio) {
        // 霜息增益 / 残像 / 疗愈轻铃
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.E5,
          delay: 0,
          dur: 0.20,
          gain: 0.42,
          pan: -0.16,
          reverbSend: 0.38
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.B5,
          delay: 0.048,
          dur: 0.24,
          gain: 0.46,
          pan: 0.04,
          reverbSend: 0.44
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.E6,
          delay: 0.096,
          dur: 0.32,
          gain: 0.42,
          pan: 0.18,
          reverbSend: 0.54,
          ornament: true
        });
      }
    },

    amp_charge: {
      prio: 2,
      cooldown: 45,
      fn: function (c, t, now, vol, prio, options) {
        // 魔力增幅三档蓄能晶鸣：随增幅百分比逐级升高音高（20% / 40% / 60% 逐级叠加泛音与天穹星辉）
        var pctRaw = options && typeof options.ampPct === 'number' ? options.ampPct : 0;
        var pct = clamp(pctRaw > 1 ? pctRaw / 100 : pctRaw, 0, 0.60);
        if (pct <= 0.001) {
          playCelesta(c, t, now, vol, prio, {
            freq: NOTE.D5,
            delay: 0,
            dur: 0.14,
            gain: 0.30,
            pan: -0.06,
            reverbSend: 0.25
          });
          return;
        }
        var ratio = clamp(pct / 0.60, 0.15, 1.0);
        var baseFreq = 440 * Math.pow(2, ratio * 1.05);
        playCelesta(c, t, now, vol, prio, {
          freq: baseFreq,
          delay: 0,
          dur: 0.18 + ratio * 0.16,
          gain: 0.40 + ratio * 0.16,
          pan: -0.10,
          reverbSend: 0.34 + ratio * 0.24
        });
        // Tier 1 (20%+): 叠加清冽纯五度泛音 (*1.498)
        if (pct >= 0.20 - 1e-4) {
          playCelesta(c, t, now, vol, prio, {
            freq: baseFreq * 1.498,
            delay: 0.032,
            dur: 0.24 + ratio * 0.08,
            gain: 0.38,
            pan: 0.12,
            reverbSend: 0.48,
            ornament: true
          });
        }
        // Tier 2 (40%+): 追加明亮八度泛音 (*2.0)
        if (pct >= 0.40 - 1e-4) {
          playCelesta(c, t, now, vol, prio, {
            freq: baseFreq * 2.0,
            delay: 0.064,
            dur: 0.32 + ratio * 0.08,
            gain: 0.42,
            pan: -0.06,
            reverbSend: 0.58,
            ornament: true
          });
        }
        // Tier 3 (60%): 香槟金高阶天穹星辉 (*2.498 & *3.0 钟鸣泛音 + 冰雷电弧脆裂 + 悠长晶振余韵)
        if (pct >= 0.60 - 1e-4) {
          playCelesta(c, t, now, vol, prio, {
            freq: baseFreq * 2.498,
            delay: 0.094,
            dur: 0.42,
            gain: 0.40,
            pan: 0.16,
            reverbSend: 0.70,
            ornament: true
          });
          playCelesta(c, t, now, vol, prio, {
            freq: baseFreq * 3.0,
            delay: 0.124,
            dur: 0.52,
            gain: 0.38,
            pan: 0,
            reverbSend: 0.78,
            overtone: true,
            overtoneRatio: 1.5,
            overtoneGain: 0.28,
            ornament: true
          });
          playNoise(c, t, now, vol, prio, {
            kind: 'crackle',
            delay: 0.078,
            dur: 0.11,
            attack: 0.003,
            gain: 0.24,
            pan: 0.04,
            reverbSend: 0.42,
            filter: {
              type: 'bandpass',
              freq: 3600,
              endFreq: 6800,
              q: 2.6
            },
            ornament: true
          });
          playTone(c, t, now, vol, prio, {
            freq: baseFreq * 1.996,
            slideTo: baseFreq * 2.008,
            wave: 'sine',
            delay: 0.105,
            dur: 0.62,
            attack: 0.012,
            gain: 0.22,
            pan: 0,
            reverbSend: 0.82,
            ornament: true
          });
        }
      }
    }
  };

  // 向后兼容与语义别名映射
  var ALIASES = {
    page_open: 'modal_open',
    glass_tap: 'tab_switch',
    prism_tick: 'ui_tick',
    dialog_advance: 'ui_tick',
    ice_click: 'click',
    heart: 'gift_loved',
    gift_liked: 'stat_gain',
    sparkle_chord: 'schedule_done',
    grade_s: 'season_report',
    egg: 'season_report',
    letter_open: 'wax_seal',
    shatter: 'ice_shatter',
    magic: 'ice_cast',
    ice_footstep: 'footstep',
    map_travel: 'footstep',
    step: 'footstep',
    eclipse: 'eclipse_cast',
    onemore: 'one_more',
    water: 'water_surge',
    heal: 'buff',
    shop_buy: 'ok',
    victory: 'level',
    defeat: 'bad'
  };

  function resolveCanonical(type) {
    var key = typeof type === 'string' ? type.trim() : '';
    if (!key) return 'click';
    if (RECIPES[key]) return key;
    if (ALIASES[key] && RECIPES[ALIASES[key]]) return ALIASES[key];
    return 'click';
  }

  function unlock() {
    var c = ensureContext(true);
    if (!c) return false;
    try {
      if (c.state === 'suspended' && typeof c.resume === 'function') {
        var p = c.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {});
        }
      }
    } catch (e) {}
    return true;
  }

  function play(type, opts) {
    try {
      var options = opts && typeof opts === 'object' ? opts : null;
      if (getLiveMuted()) return false;
      var rawVol = getLiveVolume();
      if (rawVol <= 0.001) return false;

      var canonical = resolveCanonical(type);
      var recipe = RECIPES[canonical];
      if (!recipe) return false;

      // 悬停音效：严禁在未解锁或挂起态创建/恢复 AudioContext，彻底避免 Chrome 自动播放告警
      if (recipe.hoverOnly) {
        if (!state.ctx) return false;
        if (state.ctx.state !== 'running') return false;
      }

      var now = nowMs();
      var force = !!(options && options.force);

      if (!force) {
        // 1. 单音效冷却节流
        var lastCue = state.cooldowns[canonical];
        if (lastCue !== undefined && (now - lastCue) < recipe.cooldown) {
          return false;
        }
        // 2. 45ms 优先级抑制窗口：防止同帧多事件叠加成浑浊音团
        if ((now - state.lastAnyTime) < SUPPRESSION_MS) {
          if (recipe.prio <= state.lastAnyPrio) return false;
        }
      }

      var c = ensureContext(!recipe.hoverOnly);
      if (!c) return false;

      var masterVol = computeMasterVol(rawVol);
      if (options && typeof options.gain === 'number' && isFinite(options.gain)) {
        masterVol *= clamp(options.gain, 0.1, 1.6);
      }
      if (masterVol <= 0.0001) return false;

      state.cooldowns[canonical] = now;
      state.lastAnyTime = now;
      state.lastAnyPrio = recipe.prio;

      var fireRecipe = function () {
        if (getLiveMuted()) return;
        var liveVol = computeMasterVol(getLiveVolume());
        if (options && typeof options.gain === 'number' && isFinite(options.gain)) {
          liveVol *= clamp(options.gain, 0.1, 1.6);
        }
        if (liveVol <= 0.0001) return;
        var baseT = safeTime(c);
        recipe.fn(c, baseT, nowMs(), liveVol, recipe.prio, options);
      };

      if (!recipe.hoverOnly && c.state === 'suspended' && typeof c.resume === 'function') {
        try {
          var rp = c.resume();
          if (rp && typeof rp.then === 'function') {
            rp.then(function () {
              try { fireRecipe(); } catch (err) {}
            }).catch(function () {});
            return true;
          }
        } catch (e) {}
      }

      fireRecipe();
      return true;
    } catch (e) {
      return false;
    }
  }

  function setVolume(v) {
    var nv = Number(v);
    if (!isFinite(nv)) nv = 0.65;
    state.localVol = clamp(nv, 0, 1);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_VOL_KEY, String(state.localVol));
      }
    } catch (e) {}
    if (!state.inVolSync && root && typeof root.sfxSetVolume === 'function') {
      var cur = getLiveVolume();
      if (Math.abs(cur - state.localVol) > 0.0005) {
        state.inVolSync = true;
        try {
          root.sfxSetVolume(state.localVol);
        } catch (e) {}
        state.inVolSync = false;
      }
    }
    return state.localVol;
  }

  function getVolume() {
    return getLiveVolume();
  }

  function setMuted(m) {
    state.localMuted = !!m;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_MUTE_KEY, state.localMuted ? '1' : '0');
      }
    } catch (e) {}
    return state.localMuted;
  }

  function isMuted() {
    return getLiveMuted();
  }

  function listCues() {
    var keys = Object.keys(RECIPES).concat(Object.keys(ALIASES));
    keys.sort();
    return keys;
  }

  // =========================================================================
  // 标题页事件委托：单监听器零泄漏绑定（幂等）
  // =========================================================================
  function bindTitleDelegation() {
    try {
      if (typeof document === 'undefined' || !document.getElementById) return false;
      var titleEl = document.getElementById('title-screen');
      if (!titleEl) return false;
      if (state.boundTitleEl === titleEl) return true;

      // 如先前绑定在已被替换的旧节点上，先安全解绑
      if (state.boundTitleEl) {
        try {
          if (state.titlePointerHandler) {
            state.boundTitleEl.removeEventListener('pointerenter', state.titlePointerHandler, true);
          }
          if (state.titleClickHandler) {
            state.boundTitleEl.removeEventListener('click', state.titleClickHandler, true);
          }
        } catch (e) {}
      }

      var onPointerEnter = function (e) {
        try {
          if (!e) return;
          if (e.pointerType && e.pointerType !== 'mouse') return;
          var target = e.target;
          if (!target || typeof target.matches !== 'function') return;
          if (!target.matches(TITLE_BTN_SELECTOR)) return;
          if (target.disabled || (target.classList && target.classList.contains('hidden'))) return;

          var all = titleEl.querySelectorAll(TITLE_BTN_SELECTOR);
          var step = 0;
          var visibleIdx = 0;
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el === target) {
              step = visibleIdx;
              break;
            }
            if (!el.disabled && (!el.classList || !el.classList.contains('hidden'))) {
              visibleIdx++;
            }
          }
          play('title_hover', { step: step });
        } catch (err) {}
      };

      var onClick = function (e) {
        try {
          if (!e || !e.target) return;
          unlock();
          var btn = typeof e.target.closest === 'function' ? e.target.closest(TITLE_BTN_SELECTOR) : null;
          if (!btn || !titleEl.contains(btn) || btn.disabled) return;
          if (btn.id && TITLE_OWN_SFX_IDS[btn.id]) return;
          play('title_click');
        } catch (err) {}
      };

      titleEl.addEventListener('pointerenter', onPointerEnter, true);
      titleEl.addEventListener('click', onClick, true);

      state.boundTitleEl = titleEl;
      state.titlePointerHandler = onPointerEnter;
      state.titleClickHandler = onClick;
      return true;
    } catch (e) {
      return false;
    }
  }

  // =========================================================================
  // 战斗与演武全按键鼠标经过音效委托（捕获阶段 pointerenter 去重 · 零泄漏幂等）
  // =========================================================================
  function isCombatBtnSkipped(el) {
    if (!el) return true;
    if (el.disabled) return true;
    if (typeof el.matches === 'function') {
      try {
        if (el.matches(':disabled')) return true;
      } catch (err) {}
    }
    if (typeof el.getAttribute === 'function' && el.getAttribute('aria-disabled') === 'true') return true;
    if (el.classList && (el.classList.contains('hidden') || el.classList.contains('dead'))) return true;
    if (typeof el.closest === 'function') {
      if (el.closest('.hidden, .dead, .dissolved')) return true;
    }
    return false;
  }

  function bindCombatDelegation() {
    try {
      if (typeof document === 'undefined' || !document.addEventListener) return false;
      var battleEl = typeof document.getElementById === 'function' ? document.getElementById('battle-screen') : null;
      var arenaEl = typeof document.getElementById === 'function' ? document.getElementById('arena-overlay') : null;
      var nextHosts = (battleEl && arenaEl) ? [battleEl, arenaEl] : [document];

      if (state.boundCombatEls && state.boundCombatEls.length === nextHosts.length) {
        var sameHosts = true;
        for (var h = 0; h < nextHosts.length; h++) {
          if (state.boundCombatEls[h] !== nextHosts[h]) {
            sameHosts = false;
            break;
          }
        }
        if (sameHosts) return true;
      }

      if (state.boundCombatEls && state.boundCombatEls.length) {
        for (var r = 0; r < state.boundCombatEls.length; r++) {
          var prevHost = state.boundCombatEls[r];
          try {
            if (prevHost && state.combatPointerEnterHandler) {
              prevHost.removeEventListener('pointerenter', state.combatPointerEnterHandler, true);
            }
            if (prevHost && state.combatPointerLeaveHandler) {
              prevHost.removeEventListener('pointerleave', state.combatPointerLeaveHandler, true);
            }
          } catch (err) {}
        }
      }

      var onCombatPointerEnter = function (e) {
        try {
          if (!e) return;
          if (e.pointerType && e.pointerType !== 'mouse') return;
          var target = e.target;
          if (!target) return;
          if (typeof target.closest !== 'function') {
            target = target.parentElement || null;
            if (!target || typeof target.closest !== 'function') return;
          }

          var btn = target.closest(COMBAT_BTN_SELECTOR);
          if (!btn) {
            if (state.lastCombatHoverEl && (
              !state.lastCombatHoverEl.isConnected ||
              (typeof state.lastCombatHoverEl.contains === 'function' && !state.lastCombatHoverEl.contains(target))
            )) {
              state.lastCombatHoverEl = null;
            }
            return;
          }

          var scopeEl = btn.closest('#battle-screen, #arena-overlay');
          if (!scopeEl) return;

          if (isCombatBtnSkipped(btn)) {
            if (state.lastCombatHoverEl === btn) state.lastCombatHoverEl = null;
            return;
          }

          if (btn === state.lastCombatHoverEl) return;
          state.lastCombatHoverEl = btn;

          var groupContainer = btn.closest(COMBAT_GROUP_SELECTOR) || btn.parentElement || scopeEl;
          var siblingSelector = (typeof btn.matches === 'function' && btn.matches('.cb-enemy-card'))
            ? '.cb-enemy-card:not(.dead)'
            : COMBAT_BTN_SELECTOR;
          var all = groupContainer && typeof groupContainer.querySelectorAll === 'function'
            ? groupContainer.querySelectorAll(siblingSelector)
            : [];
          var step = 0;
          var visibleIdx = 0;
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el === btn) {
              step = visibleIdx;
              break;
            }
            if (!isCombatBtnSkipped(el)) {
              visibleIdx++;
            }
          }
          play('title_hover', { step: step });
        } catch (err) {}
      };

      var onCombatPointerLeave = function (e) {
        try {
          if (!e || !state.lastCombatHoverEl) return;
          if (e.pointerType && e.pointerType !== 'mouse') return;
          var target = e.target;
          if (target === state.lastCombatHoverEl) {
            state.lastCombatHoverEl = null;
          } else if (
            target &&
            target !== document &&
            typeof target.contains === 'function' &&
            target.contains(state.lastCombatHoverEl)
          ) {
            state.lastCombatHoverEl = null;
          }
        } catch (err) {}
      };

      for (var k = 0; k < nextHosts.length; k++) {
        nextHosts[k].addEventListener('pointerenter', onCombatPointerEnter, true);
        nextHosts[k].addEventListener('pointerleave', onCombatPointerLeave, true);
      }

      state.boundCombatEls = nextHosts;
      state.combatPointerEnterHandler = onCombatPointerEnter;
      state.combatPointerLeaveHandler = onCombatPointerLeave;
      state.lastCombatHoverEl = null;
      return true;
    } catch (e) {
      return false;
    }
  }

  function bindGestureUnlock() {
    try {
      if (state.gestureBound || typeof document === 'undefined' || !document.addEventListener) return;
      state.gestureBound = true;
      var detachUnlock = function () {
        try {
          document.removeEventListener('pointerdown', onGesture, true);
          document.removeEventListener('keydown', onGesture, true);
          document.removeEventListener('touchstart', onGesture, true);
        } catch (e) {}
      };
      var onGesture = function () {
        unlock();
        try {
          if (root && typeof root.bgmUnlock === 'function') root.bgmUnlock();
        } catch (e) {}
        if (state.ctx && state.ctx.state === 'running') {
          detachUnlock();
        }
      };
      document.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
      document.addEventListener('keydown', onGesture, { capture: true, passive: true });
      document.addEventListener('touchstart', onGesture, { capture: true, passive: true });
    } catch (e) {}
  }

  function autoInit() {
    bindGestureUnlock();
    bindTitleDelegation();
    bindCombatDelegation();
  }

  try {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit, { once: true });
      } else {
        autoInit();
      }
    }
  } catch (e) {}

  function getEngineInfo() {
    return {
      cinemaFoley: true,
      maxVoices: MAX_ACTIVE_VOICES,
      hasContext: !!state.ctx,
      hasReverb: !!state.reverbBus,
      hasShaper: !!state.shaper,
      hasPunchBus: !!state.punchBus,
      hasCompressor: !!state.compressor,
      crystalFmRatios: CRYSTAL_FM_RATIOS.slice()
    };
  }

  var api = {
    play: play,
    unlock: unlock,
    setVolume: setVolume,
    getVolume: getVolume,
    setMuted: setMuted,
    isMuted: isMuted,
    listCues: listCues,
    bindTitleDelegation: bindTitleDelegation,
    bindCombatDelegation: bindCombatDelegation,
    getEngineInfo: getEngineInfo
  };

  if (root) {
    root.CrystalSFX = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
