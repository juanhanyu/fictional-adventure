/* =========================================================================
   转生千金 · 冰晶与绘本微音效引擎 (js/sfx-suite.js)
   零外部音频、零网络请求、全纯 WebAudio D 大调霜晶钢片琴音色体系
   导出：window.CrystalSFX
   ========================================================================= */
(function (root) {
  'use strict';

  var MAX_ACTIVE_VOICES = 14;
  var SUPPRESSION_MS = 45;
  var LOCAL_VOL_KEY = 'ojousama_sfx_vol';
  var LOCAL_MUTE_KEY = 'ojousama_muted';
  var MIN_EXP_GAIN = 0.00015;
  var MIN_ATTACK = 0.002;
  var MAX_ATTACK = 0.014;
  var TITLE_BTN_SELECTOR = '.title-menu button, .corner-tool-btn';

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
    boundTitleEl: null,
    titlePointerHandler: null,
    titleClickHandler: null,
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
    return Math.pow(clamped, 1.65) * 0.26;
  }

  function getAudioCtor() {
    try {
      if (!root) return null;
      return root.AudioContext || root.webkitAudioContext || null;
    } catch (e) {
      return null;
    }
  }

  function buildMasterChain(c) {
    try {
      if (!c) return null;
      var bus = typeof c.createGain === 'function' ? c.createGain() : null;
      if (!bus) return null;
      safeSetParam(bus.gain, 1.0, safeTime(c));

      var dest = c.destination;
      var connected = false;
      if (typeof c.createDynamicsCompressor === 'function') {
        try {
          var comp = c.createDynamicsCompressor();
          var t = safeTime(c);
          safeSetParam(comp.threshold, -10, t);
          safeSetParam(comp.knee, 12, t);
          safeSetParam(comp.ratio, 6, t);
          safeSetParam(comp.attack, 0.004, t);
          safeSetParam(comp.release, 0.14, t);
          if (typeof bus.connect === 'function' && typeof comp.connect === 'function') {
            bus.connect(comp);
            comp.connect(dest);
            state.compressor = comp;
            connected = true;
          }
        } catch (e) {
          state.compressor = null;
        }
      }
      if (!connected && typeof bus.connect === 'function') {
        try {
          bus.connect(dest);
        } catch (e) {}
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

  function connectOut(c, node, pan) {
    if (!node) return;
    var target = state.masterBus || (c ? c.destination : null);
    try {
      if (pan && Math.abs(pan) > 0.01 && c && typeof c.createStereoPanner === 'function') {
        var panner = c.createStereoPanner();
        safeSetParam(panner.pan, clamp(pan, -0.85, 0.85), safeTime(c));
        node.connect(panner);
        panner.connect(target);
        return;
      }
    } catch (e) {}
    try {
      if (typeof node.connect === 'function') {
        node.connect(target);
      }
    } catch (e) {}
  }

  function createFilterNode(c, filterCfg, st, dur) {
    if (!filterCfg || !c || typeof c.createBiquadFilter !== 'function') return null;
    try {
      var f = c.createBiquadFilter();
      if (filterCfg.type) f.type = filterCfg.type;
      var fStart = Math.max(40, filterCfg.freq || 2400);
      safeSetParam(f.frequency, fStart, st);
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
      connectOut(c, g, cfg.pan);
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
      pan: cfg.pan
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
      connectOut(c, g, cfg.pan);
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

    // --- 战斗与冰晶魔法 ---
    ice_shatter: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // 沉实冲击 + 高频碎冰 + 四片散落冰晶
        playTone(c, t, now, vol, prio, {
          freq: 155,
          slideTo: 48,
          wave: 'sine',
          delay: 0,
          dur: 0.125,
          attack: 0.003,
          gain: 0.62,
          filter: { type: 'lowpass', freq: 360, q: 0.8 }
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'crackle',
          delay: 0.004,
          dur: 0.088,
          attack: 0.002,
          gain: 0.48,
          filter: { type: 'highpass', freq: 2200, q: 1.1 }
        });
        var shards = [
          { f: NOTE.E7, to: 1860, d: 0.014, dur: 0.11, g: 0.36, p: -0.35, w: 'sine' },
          { f: 3135.96, to: NOTE.D7, d: 0.042, dur: 0.13, g: 0.30, p: 0.32, w: 'sine' },
          { f: 2093.00, to: NOTE.Fs6, d: 0.070, dur: 0.14, g: 0.28, p: -0.18, w: 'triangle' },
          { f: NOTE.A7, to: NOTE.Fs7, d: 0.102, dur: 0.15, g: 0.22, p: 0.22, w: 'sine' }
        ];
        for (var i = 0; i < shards.length; i++) {
          var s = shards[i];
          playTone(c, t, now, vol, prio, {
            freq: s.f,
            slideTo: s.to,
            wave: s.w,
            delay: s.d,
            dur: s.dur,
            attack: 0.002,
            gain: s.g,
            filter: s.w === 'triangle' ? { type: 'lowpass', freq: 5200, q: 0.7 } : null,
            pan: s.p,
            ornament: i >= 2
          });
        }
      }
    },

    blade_clash: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // 寒钢交击泛音 + 带通火星爆发
        playNoise(c, t, now, vol, prio, {
          kind: 'white',
          delay: 0,
          dur: 0.075,
          attack: 0.002,
          gain: 0.44,
          filter: { type: 'bandpass', freq: 3300, endFreq: 1750, q: 2.6 }
        });
        playTone(c, t, now, vol, prio, {
          freq: 1140,
          slideTo: 1085,
          wave: 'triangle',
          delay: 0,
          dur: 0.24,
          attack: 0.002,
          gain: 0.46,
          filter: { type: 'bandpass', freq: 2300, q: 2.0 },
          pan: -0.12
        });
        playTone(c, t, now, vol, prio, {
          freq: 1698,
          slideTo: 1660,
          wave: 'sine',
          delay: 0.002,
          dur: 0.20,
          attack: 0.002,
          gain: 0.34,
          pan: 0.14
        });
        playTone(c, t, now, vol, prio, {
          freq: 2690,
          wave: 'sine',
          delay: 0.003,
          dur: 0.14,
          attack: 0.002,
          gain: 0.24,
          ornament: true
        });
      }
    },

    parry: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // 格挡寒钢鸣响 + 上扬反击冰铃
        playNoise(c, t, now, vol, prio, {
          kind: 'white',
          delay: 0,
          dur: 0.056,
          attack: 0.002,
          gain: 0.38,
          filter: { type: 'bandpass', freq: 3450, endFreq: 2100, q: 2.8 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.E6,
          slideTo: 1265,
          wave: 'triangle',
          delay: 0,
          dur: 0.14,
          attack: 0.002,
          gain: 0.46,
          filter: { type: 'lowpass', freq: 5000, q: 0.8 },
          pan: -0.14
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.E6,
          slideTo: NOTE.A6,
          wave: 'sine',
          delay: 0.032,
          dur: 0.17,
          attack: 0.003,
          gain: 0.50,
          pan: 0.12
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D7,
          wave: 'sine',
          delay: 0.075,
          dur: 0.26,
          attack: 0.003,
          gain: 0.36,
          detune: 5,
          pan: 0.2
        });
      }
    },

    break_chime: {
      prio: 4,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // 破韧碎晶 + 共鸣 B 大调霜铃三和弦 (B4 / B5 / D#6 / F#6)
        playTone(c, t, now, vol, prio, {
          freq: 162,
          slideTo: 54,
          wave: 'sine',
          delay: 0,
          dur: 0.11,
          attack: 0.003,
          gain: 0.52,
          filter: { type: 'lowpass', freq: 360, q: 0.8 }
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'crackle',
          delay: 0.003,
          dur: 0.082,
          attack: 0.002,
          gain: 0.44,
          filter: { type: 'highpass', freq: 2150, q: 1.1 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.B4,
          wave: 'triangle',
          delay: 0.024,
          dur: 0.50,
          attack: 0.005,
          gain: 0.42,
          filter: { type: 'lowpass', freq: 2800, q: 0.7 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.B5,
          wave: 'sine',
          delay: 0.030,
          dur: 0.44,
          attack: 0.003,
          gain: 0.50,
          pan: -0.18
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Ds6,
          wave: 'sine',
          delay: 0.068,
          dur: 0.45,
          attack: 0.003,
          gain: 0.46,
          pan: 0.04
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          wave: 'sine',
          delay: 0.108,
          dur: 0.48,
          attack: 0.004,
          gain: 0.44,
          pan: 0.22
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.B6,
          wave: 'sine',
          delay: 0.130,
          dur: 0.36,
          attack: 0.005,
          gain: 0.22,
          detune: 6,
          ornament: true
        });
      }
    },

    combat_crit: {
      prio: 3,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        playTone(c, t, now, vol, prio, {
          freq: 185,
          slideTo: 58,
          wave: 'sine',
          delay: 0,
          dur: 0.115,
          attack: 0.003,
          gain: 0.58,
          filter: { type: 'lowpass', freq: 420, q: 0.9 }
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'white',
          delay: 0,
          dur: 0.068,
          attack: 0.002,
          gain: 0.36,
          filter: { type: 'bandpass', freq: 2700, endFreq: 4200, q: 2.2 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A5,
          slideTo: NOTE.D6,
          wave: 'triangle',
          delay: 0.015,
          dur: 0.21,
          attack: 0.003,
          gain: 0.48,
          filter: { type: 'lowpass', freq: 5000, q: 0.7 },
          pan: -0.14
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A6,
          wave: 'sine',
          delay: 0.044,
          dur: 0.28,
          attack: 0.003,
          gain: 0.42,
          pan: 0.14
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D7,
          wave: 'sine',
          delay: 0.072,
          dur: 0.24,
          attack: 0.003,
          gain: 0.24,
          detune: 5,
          ornament: true
        });
      }
    },

    shield_block: {
      prio: 2,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // 霜晶结界弹反
        playTone(c, t, now, vol, prio, {
          freq: 295,
          slideTo: 162,
          wave: 'sine',
          delay: 0,
          dur: 0.115,
          attack: 0.003,
          gain: 0.52,
          filter: { type: 'lowpass', freq: 720, q: 1.0 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Fs5,
          wave: 'sine',
          delay: 0.008,
          dur: 0.19,
          attack: 0.003,
          gain: 0.34,
          pan: -0.12
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Cs6,
          wave: 'sine',
          delay: 0.014,
          dur: 0.17,
          attack: 0.003,
          gain: 0.24,
          detune: 8,
          pan: 0.12,
          ornament: true
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.072,
          attack: 0.004,
          gain: 0.26,
          filter: { type: 'bandpass', freq: 1550, endFreq: 2750, q: 2.4 },
          ornament: true
        });
      }
    },

    sword_slash: {
      prio: 2,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.13,
          attack: 0.006,
          gain: 0.44,
          filter: { type: 'bandpass', freq: 760, endFreq: 2950, q: 1.9 }
        });
        playTone(c, t, now, vol, prio, {
          freq: 1460,
          slideTo: 610,
          wave: 'sine',
          delay: 0.004,
          dur: 0.105,
          attack: 0.004,
          gain: 0.32
        });
        playTone(c, t, now, vol, prio, {
          freq: 2480,
          slideTo: 1940,
          wave: 'triangle',
          delay: 0.014,
          dur: 0.065,
          attack: 0.003,
          gain: 0.18,
          filter: { type: 'lowpass', freq: 4400, q: 0.8 },
          ornament: true
        });
      }
    },

    ice_cast: {
      prio: 2,
      cooldown: 55,
      fn: function (c, t, now, vol, prio) {
        // 冰系魔导咏唱凝结
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0,
          dur: 0.22,
          attack: 0.012,
          gain: 0.22,
          filter: { type: 'bandpass', freq: 1450, endFreq: 3750, q: 2.4 },
          ornament: true
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A5,
          wave: 'sine',
          delay: 0,
          dur: 0.18,
          attack: 0.004,
          gain: 0.40,
          pan: -0.18
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D6,
          wave: 'sine',
          delay: 0.044,
          dur: 0.22,
          attack: 0.004,
          gain: 0.44,
          pan: 0
        });
        playCelesta(c, t, now, vol, prio, {
          freq: NOTE.Fs6,
          delay: 0.092,
          dur: 0.28,
          attack: 0.004,
          gain: 0.42,
          overtoneRatio: 1.5,
          overtoneGain: 0.24,
          pan: 0.18
        });
      }
    },

    phase2: {
      prio: 4,
      cooldown: 220,
      fn: function (c, t, now, vol, prio) {
        // 强敌二阶段觉醒（温暖低通共鸣，零刺耳未滤波毛刺）
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D3,
          slideTo: NOTE.A2,
          wave: 'triangle',
          delay: 0,
          dur: 0.56,
          attack: 0.014,
          gain: 0.60,
          filter: { type: 'lowpass', freq: 620, endFreq: 240, q: 1.8 }
        });
        playNoise(c, t, now, vol, prio, {
          kind: 'pink',
          delay: 0.03,
          dur: 0.36,
          attack: 0.014,
          gain: 0.24,
          filter: { type: 'bandpass', freq: 900, endFreq: 2950, q: 1.8 },
          ornament: true
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.D4,
          slideTo: NOTE.A4,
          wave: 'triangle',
          delay: 0.07,
          dur: 0.44,
          attack: 0.010,
          gain: 0.46,
          filter: { type: 'lowpass', freq: 1900, q: 0.9 }
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.A5,
          wave: 'sine',
          delay: 0.14,
          dur: 0.42,
          attack: 0.006,
          gain: 0.42,
          pan: -0.15
        });
        playTone(c, t, now, vol, prio, {
          freq: NOTE.Cs6,
          wave: 'sine',
          delay: 0.22,
          dur: 0.46,
          attack: 0.006,
          gain: 0.38,
          detune: 5,
          pan: 0.15
        });
      }
    }
  };

  // 向后兼容与语义别名映射
  var ALIASES = {
    page_open: 'modal_open',
    glass_tap: 'tab_switch',
    ice_click: 'click',
    heart: 'gift_loved',
    gift_liked: 'stat_gain',
    sparkle_chord: 'schedule_done',
    grade_s: 'season_report',
    egg: 'season_report',
    letter_open: 'wax_seal',
    shatter: 'ice_shatter',
    magic: 'ice_cast'
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

      if (!recipe.hoverOnly && c.state === 'suspended' && typeof c.resume === 'function') {
        try {
          var rp = c.resume();
          if (rp && typeof rp.catch === 'function') {
            rp.catch(function () {});
          }
        } catch (e) {}
      }

      var masterVol = computeMasterVol(rawVol);
      if (options && typeof options.gain === 'number' && isFinite(options.gain)) {
        masterVol *= clamp(options.gain, 0.1, 1.6);
      }
      if (masterVol <= 0.0001) return false;

      state.cooldowns[canonical] = now;
      state.lastAnyTime = now;
      state.lastAnyPrio = recipe.prio;

      var baseT = safeTime(c);
      recipe.fn(c, baseT, now, masterVol, recipe.prio, options);
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
          if (btn.id === 'btn-new' || btn.id === 'btn-continue') return;
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

  function bindGestureUnlock() {
    try {
      if (state.gestureBound || typeof document === 'undefined' || !document.addEventListener) return;
      state.gestureBound = true;
      var onceUnlock = function () {
        unlock();
        try {
          document.removeEventListener('pointerdown', onceUnlock, true);
          document.removeEventListener('keydown', onceUnlock, true);
          document.removeEventListener('touchstart', onceUnlock, true);
        } catch (e) {}
      };
      document.addEventListener('pointerdown', onceUnlock, { capture: true, passive: true });
      document.addEventListener('keydown', onceUnlock, { capture: true, passive: true });
      document.addEventListener('touchstart', onceUnlock, { capture: true, passive: true });
    } catch (e) {}
  }

  function autoInit() {
    bindGestureUnlock();
    bindTitleDelegation();
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

  var api = {
    play: play,
    unlock: unlock,
    setVolume: setVolume,
    getVolume: getVolume,
    setMuted: setMuted,
    isMuted: isMuted,
    listCues: listCues,
    bindTitleDelegation: bindTitleDelegation
  };

  if (root) {
    root.CrystalSFX = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
