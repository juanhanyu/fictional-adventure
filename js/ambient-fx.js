/* =========================================================================
   转生千金 · 氛围影院粒子层与冰晶宫殿推演盘 (js/ambient-fx.js)
   导出：window.AmbientFX
   包含：
   1. 全视口氛围粒子画布 (#ambient-fx-canvas)：监听 #bg 类名自动切换雪/萤火/余烬/浮尘
   2. 舞台影院级特效助手：冰晶宫殿视界滤镜 (triggerIcePalaceFilter) 与 420ms 霜刃弧斩 (triggerFrostSlash)
   3. 交互式「冰晶宫殿·寒夜推演盘」(openDeductionBoard / closeDeductionBoard)
   ========================================================================= */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'ojousama_fx_enabled_v1';
  var VALID_MODES = { snow: true, firefly: true, ember: true, dust: true, none: true };
  var ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  var SNOW_CLASSES = {
    'bg-img-ice-canyon': true,
    'bg-img-border-snowroad': true,
    'bg-snow': true
  };

  var DUST_CLASSES = {
    'bg-img-jikan': true,
    'bg-img-library': true,
    'bg-img-study': true,
    'bg-img-classroom': true,
    'bg-img-chenglan-guild': true,
    'bg-img-parlor': true,
    'bg-img-flowerhouse': true
  };

  var ABSTRACT_CLASSES = {
    'bg-void': true,
    'bg-pick': true,
    'bg-duel': true,
    'bg-ending': true,
    'bg-img-crosswalk-accident': true
  };

  var MODE_COUNTS = {
    snow: 36,
    firefly: 26,
    ember: 32,
    dust: 28,
    none: 0
  };

  var state = {
    initialized: false,
    enabled: true,
    reducedMotion: false,
    canvas: null,
    ctx: null,
    canDraw: false,
    width: 1440,
    height: 900,
    dpr: 1,
    detectedMode: 'none',
    activeMode: 'none',
    particles: [],
    rafId: 0,
    lastTs: 0,
    modeAlpha: 0,
    bgObserver: null,
    mql: null,
    deduction: null
  };

  function isBrowserDoc() {
    return typeof document !== 'undefined' && !!document.documentElement;
  }

  function isJsdomEnv() {
    return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
  }

  function readSavedEnabled() {
    try {
      if (typeof localStorage === 'undefined') return true;
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null || raw === undefined || raw === '') return true;
      return raw !== '0' && raw !== 'false';
    } catch (e) {
      return true;
    }
  }

  function writeSavedEnabled(val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, val ? '1' : '0');
      }
    } catch (e) {}
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function checkReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      state.reducedMotion = false;
      return false;
    }
    try {
      var mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      state.mql = mql;
      state.reducedMotion = !!mql.matches;
      var onChange = function (ev) {
        state.reducedMotion = !!(ev && ev.matches);
        applyCanvasState();
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(onChange);
      }
    } catch (e) {
      state.reducedMotion = false;
    }
    return state.reducedMotion;
  }

  /* =========================================================================
     一、背景类名到氛围粒子模式映射
     ========================================================================= */
  function resolveMode(className) {
    var raw = String(className || '').trim();
    if (!raw) return 'none';

    var list = raw.split(/\s+/);
    var tokens = Object.create(null);
    var hasFireOrHallway = false;
    for (var i = 0; i < list.length; i++) {
      var tok = list[i].toLowerCase();
      if (!tok) continue;
      tokens[tok] = true;
      if (
        tok === 'bg-img-hallway' ||
        tok === 'bg-fire' ||
        tok === 'bg-ember' ||
        /hallway|fire|flame|ember|burn/.test(tok)
      ) {
        hasFireOrHallway = true;
      }
    }

    if (tokens['bg-battle'] && hasFireOrHallway) {
      return 'ember';
    }

    for (var sKey in SNOW_CLASSES) {
      if (tokens[sKey]) return 'snow';
    }

    if (
      tokens['bg-img-glow-sheep-hill'] ||
      ((tokens['bg-img-garden'] || tokens['bg-garden']) && tokens['bg-night'])
    ) {
      return 'firefly';
    }

    for (var dKey in DUST_CLASSES) {
      if (tokens[dKey]) return 'dust';
    }

    for (var aKey in ABSTRACT_CLASSES) {
      if (tokens[aKey]) return 'none';
    }

    return 'none';
  }

  /* =========================================================================
     二、氛围粒子画布 (#ambient-fx-canvas)
     ========================================================================= */
  function ensureCanvas() {
    if (!isBrowserDoc()) return null;
    var host = document.getElementById('app') || document.body;
    if (!host) return null;

    var canvas = document.getElementById('ambient-fx-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'ambient-fx-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      host.insertBefore(canvas, host.firstChild);
    }
    state.canvas = canvas;

    if (isJsdomEnv()) {
      state.ctx = null;
      state.canDraw = false;
      return canvas;
    }

    if (!state.ctx) {
      var ctx = null;
      try {
        ctx = canvas.getContext('2d');
      } catch (e) {
        ctx = null;
      }
      state.ctx = ctx;
      state.canDraw = !!ctx && typeof requestAnimationFrame === 'function';
    }
    resizeCanvas();
    return canvas;
  }

  function resizeCanvas() {
    if (!state.canvas) return;
    var w = (typeof window !== 'undefined' && window.innerWidth) || 1440;
    var h = (typeof window !== 'undefined' && window.innerHeight) || 900;
    var dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    state.width = w;
    state.height = h;
    state.dpr = dpr;
    if (!state.canDraw || !state.ctx) return;
    var targetW = Math.max(1, Math.round(w * dpr));
    var targetH = Math.max(1, Math.round(h * dpr));
    if (state.canvas.width !== targetW || state.canvas.height !== targetH) {
      state.canvas.width = targetW;
      state.canvas.height = targetH;
    }
    if (typeof state.ctx.setTransform === 'function') {
      state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function createParticle(mode, idx, scatterY) {
    var w = state.width || 1440;
    var h = state.height || 900;

    if (mode === 'snow') {
      var depth = rand(0.45, 1.0);
      var isCrystal = idx % 6 === 0;
      return {
        x: rand(-20, w + 40),
        y: scatterY ? rand(-20, h + 10) : rand(-36, -6),
        r: isCrystal ? rand(1.15, 2.0) : rand(0.85, 2.25) * depth,
        vx: -rand(0.28, 0.72) * depth,
        vy: rand(0.42, 1.02) * depth,
        alpha: rand(0.2, 0.54) * (0.72 + depth * 0.28),
        phase: rand(0, Math.PI * 2),
        spin: rand(0.012, 0.032),
        sway: rand(0.12, 0.36),
        kind: isCrystal ? (idx % 12 === 0 ? 'gold' : 'crystal') : 'flake'
      };
    }

    if (mode === 'firefly') {
      var isGold = idx % 3 === 0;
      return {
        x: rand(w * 0.04, w * 0.96),
        y: rand(h * 0.14, h * 0.86),
        r: rand(1.05, 1.85),
        vx: rand(-0.22, 0.22),
        vy: rand(-0.18, 0.16),
        alpha: rand(0.24, 0.55),
        phase: rand(0, Math.PI * 2),
        spin: rand(0.015, 0.034),
        sway: rand(0.16, 0.42),
        kind: isGold ? 'gold' : 'cyan'
      };
    }

    if (mode === 'ember') {
      var warmKind = idx % 4 === 0 ? 'gold' : (idx % 3 === 0 ? 'copper' : 'amber');
      return {
        x: rand(w * 0.03, w * 0.97),
        y: scatterY ? rand(h * 0.12, h + 20) : rand(h + 4, h + 46),
        r: rand(1.0, 2.2),
        vx: rand(-0.24, 0.28),
        vy: -rand(0.42, 1.08),
        alpha: rand(0.22, 0.56),
        phase: rand(0, Math.PI * 2),
        spin: rand(0.025, 0.06),
        sway: rand(0.22, 0.55),
        kind: warmKind
      };
    }

    if (mode === 'dust') {
      return {
        x: rand(w * 0.04, w * 0.96),
        y: rand(h * 0.06, h * 0.84),
        r: rand(0.85, 2.05),
        vx: rand(-0.08, 0.14),
        vy: rand(-0.07, 0.09),
        alpha: rand(0.18, 0.42),
        phase: rand(0, Math.PI * 2),
        spin: rand(0.008, 0.02),
        sway: rand(0.06, 0.18),
        kind: idx % 3 === 0 ? 'ivory' : 'mote'
      };
    }

    return null;
  }

  function rebuildParticles(mode) {
    var count = MODE_COUNTS[mode] || 0;
    var arr = [];
    for (var i = 0; i < count; i++) {
      var p = createParticle(mode, i, true);
      if (p) arr.push(p);
    }
    state.particles = arr;
    state.modeAlpha = 0;
  }

  function clearCanvas() {
    if (!state.canDraw || !state.ctx || !state.canvas) return;
    state.ctx.clearRect(0, 0, state.width, state.height);
  }

  function stopLoop() {
    if (state.rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = 0;
    state.lastTs = 0;
  }

  function shouldAnimate() {
    if (!state.canDraw || !state.ctx) return false;
    if (!state.enabled || state.reducedMotion) return false;
    if (state.activeMode === 'none') return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    return true;
  }

  function drawCrystalDiamond(ctx, x, y, r, fillStyle) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.45);
    ctx.lineTo(x + r * 0.95, y);
    ctx.lineTo(x, y + r * 1.45);
    ctx.lineTo(x - r * 0.95, y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function renderFrame(ts) {
    state.rafId = 0;
    if (!shouldAnimate()) return;

    var dt = state.lastTs ? Math.min((ts - state.lastTs) / 16.667, 2.4) : 1;
    state.lastTs = ts;

    var ctx = state.ctx;
    var w = state.width;
    var h = state.height;
    var mode = state.activeMode;

    state.modeAlpha = Math.min(1, state.modeAlpha + 0.032 * dt);
    ctx.clearRect(0, 0, w, h);

    var list = state.particles;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      p.phase += p.spin * dt;

      if (mode === 'snow') {
        p.x += (p.vx - Math.sin(p.phase) * p.sway * 0.35) * dt;
        p.y += p.vy * dt;
        if (p.y > h + 14 || p.x < -28) {
          p.x = rand(-10, w + 80);
          p.y = rand(-28, -4);
        }
        var snowShimmer = 0.78 + 0.22 * Math.sin(p.phase * 1.4);
        var aSnow = Math.min(0.58, p.alpha * snowShimmer * state.modeAlpha);
        if (p.kind === 'gold') {
          drawCrystalDiamond(ctx, p.x, p.y, p.r, 'rgba(240, 214, 152, ' + aSnow.toFixed(3) + ')');
        } else if (p.kind === 'crystal') {
          drawCrystalDiamond(ctx, p.x, p.y, p.r, 'rgba(184, 228, 255, ' + aSnow.toFixed(3) + ')');
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(218, 238, 255, ' + aSnow.toFixed(3) + ')';
          ctx.fill();
        }
      } else if (mode === 'firefly') {
        p.x += (p.vx + Math.cos(p.phase * 0.85) * p.sway * 0.5) * dt;
        p.y += (p.vy + Math.sin(p.phase * 0.7) * p.sway * 0.42) * dt;
        if (p.x < -16) p.x = w + 12;
        else if (p.x > w + 16) p.x = -12;
        if (p.y < h * 0.08) p.vy = Math.abs(p.vy) + 0.03;
        else if (p.y > h * 0.9) p.vy = -Math.abs(p.vy) - 0.03;

        var pulse = 0.32 + 0.68 * (0.5 + 0.5 * Math.sin(p.phase));
        var aFf = Math.min(0.56, p.alpha * pulse * state.modeAlpha);
        var haloR = p.r * 4.4;
        var haloGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
        if (p.kind === 'gold') {
          haloGrad.addColorStop(0, 'rgba(244, 218, 146, ' + (aFf * 0.92).toFixed(3) + ')');
          haloGrad.addColorStop(0.45, 'rgba(216, 180, 103, ' + (aFf * 0.34).toFixed(3) + ')');
          haloGrad.addColorStop(1, 'rgba(216, 180, 103, 0)');
        } else {
          haloGrad.addColorStop(0, 'rgba(196, 238, 255, ' + (aFf * 0.95).toFixed(3) + ')');
          haloGrad.addColorStop(0.45, 'rgba(126, 200, 255, ' + (aFf * 0.36).toFixed(3) + ')');
          haloGrad.addColorStop(1, 'rgba(126, 200, 255, 0)');
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
        ctx.fillStyle = haloGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = p.kind === 'gold'
          ? 'rgba(255, 244, 204, ' + Math.min(0.58, aFf * 1.1).toFixed(3) + ')'
          : 'rgba(232, 248, 255, ' + Math.min(0.58, aFf * 1.1).toFixed(3) + ')';
        ctx.fill();
      } else if (mode === 'ember') {
        p.x += (p.vx + Math.sin(p.phase) * p.sway * 0.48) * dt;
        p.y += p.vy * dt;
        if (p.y < -18 || p.x < -24 || p.x > w + 24) {
          p.x = rand(w * 0.04, w * 0.96);
          p.y = rand(h + 4, h + 38);
        }
        var heightFade = Math.max(0, Math.min(1, p.y / (h * 0.72)));
        var flicker = 0.65 + 0.35 * Math.sin(p.phase * 1.9);
        var aEm = Math.min(0.56, p.alpha * flicker * (0.28 + 0.72 * heightFade) * state.modeAlpha);
        var emColor = p.kind === 'gold'
          ? 'rgba(246, 210, 134, ' + aEm.toFixed(3) + ')'
          : p.kind === 'copper'
            ? 'rgba(226, 118, 76, ' + aEm.toFixed(3) + ')'
            : 'rgba(242, 166, 92, ' + aEm.toFixed(3) + ')';

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx) * 0.25);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 0.78, p.r * 1.65, 0, 0, Math.PI * 2);
        ctx.fillStyle = emColor;
        ctx.fill();
        ctx.restore();
      } else if (mode === 'dust') {
        p.x += (p.vx + Math.sin(p.phase) * p.sway * 0.3) * dt;
        p.y += (p.vy + Math.cos(p.phase * 0.8) * p.sway * 0.24) * dt;
        if (p.x < -12) p.x = w + 10;
        else if (p.x > w + 12) p.x = -10;
        if (p.y < -12) p.y = h * 0.86;
        else if (p.y > h * 0.92) p.y = 8;

        var breath = 0.52 + 0.48 * Math.sin(p.phase);
        var aDu = Math.min(0.46, p.alpha * breath * state.modeAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.kind === 'ivory'
          ? 'rgba(244, 224, 178, ' + aDu.toFixed(3) + ')'
          : 'rgba(226, 232, 246, ' + (aDu * 0.86).toFixed(3) + ')';
        ctx.fill();
      }
    }

    state.rafId = requestAnimationFrame(renderFrame);
  }

  function startLoop() {
    if (!shouldAnimate()) return;
    if (state.rafId) return;
    state.lastTs = 0;
    state.rafId = requestAnimationFrame(renderFrame);
  }

  function applyCanvasState() {
    var effective = (state.enabled && !state.reducedMotion) ? state.detectedMode : 'none';
    var modeChanged = effective !== state.activeMode;
    state.activeMode = effective;

    if (state.canvas) {
      state.canvas.dataset.mode = effective;
      state.canvas.dataset.enabled = state.enabled ? '1' : '0';
      if (effective === 'none') {
        state.canvas.classList.add('afx-hidden');
      } else {
        state.canvas.classList.remove('afx-hidden');
      }
    }

    if (effective === 'none') {
      stopLoop();
      clearCanvas();
      state.particles = [];
      return;
    }

    if (modeChanged || !state.particles.length) {
      rebuildParticles(effective);
    }
    startLoop();
  }

  function syncFromBg(className) {
    ensureCanvas();
    var cls = className;
    if (cls === undefined || cls === null) {
      var bgEl = isBrowserDoc() ? document.getElementById('bg') : null;
      cls = bgEl ? bgEl.className : '';
    }
    state.detectedMode = resolveMode(cls);
    applyCanvasState();
    return state.activeMode;
  }

  function setMode(mode) {
    ensureCanvas();
    var m = VALID_MODES[mode] ? mode : 'none';
    state.detectedMode = m;
    applyCanvasState();
    return state.activeMode;
  }

  function getMode() {
    return state.activeMode;
  }

  function setEnabled(bool) {
    state.enabled = !!bool;
    writeSavedEnabled(state.enabled);
    applyCanvasState();
    return state.enabled;
  }

  function isEnabled() {
    return state.enabled;
  }

  function observeBg() {
    if (!isBrowserDoc() || typeof MutationObserver !== 'function') return;
    var bgEl = document.getElementById('bg');
    if (!bgEl) return;
    if (state.bgObserver) {
      try { state.bgObserver.disconnect(); } catch (e) {}
    }
    var obs = new MutationObserver(function () {
      syncFromBg(bgEl.className);
    });
    obs.observe(bgEl, { attributes: true, attributeFilter: ['class'] });
    state.bgObserver = obs;
  }

  /* =========================================================================
     三、舞台影院级特效助手
     ========================================================================= */
  function triggerIcePalaceFilter(active) {
    if (!isBrowserDoc() || !document.body) return false;
    var next = typeof active === 'boolean'
      ? active
      : !document.body.classList.contains('ice-palace-lens');
    document.body.classList.toggle('ice-palace-lens', next);
    return next;
  }

  function triggerFrostSlash(options) {
    if (!isBrowserDoc()) return null;
    var host = document.getElementById('app') || document.body;
    if (!host) return null;

    var opts = options || {};
    var wrap = document.createElement('div');
    wrap.className = 'afx-frost-slash' + (opts.reverse ? ' is-reversed' : '');
    wrap.setAttribute('aria-hidden', 'true');

    var gradSuffix = String(Date.now()) + '_' + Math.floor(Math.random() * 10000);
    wrap.innerHTML =
      '<svg viewBox="0 0 1200 720" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="afxIceArc_' + gradSuffix + '" x1="92%" y1="14%" x2="10%" y2="86%">' +
            '<stop offset="0%" stop-color="#e8f7ff" stop-opacity="0"/>' +
            '<stop offset="22%" stop-color="#a8dcff" stop-opacity="0.92"/>' +
            '<stop offset="58%" stop-color="#f4fbff" stop-opacity="1"/>' +
            '<stop offset="100%" stop-color="#7ec8ff" stop-opacity="0"/>' +
          '</linearGradient>' +
          '<linearGradient id="afxGoldArc_' + gradSuffix + '" x1="90%" y1="18%" x2="14%" y2="82%">' +
            '<stop offset="0%" stop-color="#f4dca0" stop-opacity="0"/>' +
            '<stop offset="48%" stop-color="#f4dca0" stop-opacity="0.88"/>' +
            '<stop offset="100%" stop-color="#d8b467" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<path class="afx-slash-glow" d="M 1030 126 Q 620 278 168 576" stroke="url(#afxIceArc_' + gradSuffix + ')" stroke-width="11" stroke-linecap="round"/>' +
        '<path class="afx-slash-core" d="M 1038 122 Q 622 276 164 578" stroke="#f5fbff" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path class="afx-slash-gold" d="M 1010 156 Q 626 306 206 588" stroke="url(#afxGoldArc_' + gradSuffix + ')" stroke-width="1.35" stroke-linecap="round"/>' +
        '<g class="afx-slash-shards">' +
          '<polygon points="842,196 849,212 865,219 849,226 842,242 835,226 819,219 835,212" fill="#d9f0ff" opacity="0.88"/>' +
          '<polygon points="628,286 633,298 645,303 633,308 628,320 623,308 611,303 623,298" fill="#f4dca0" opacity="0.82"/>' +
          '<polygon points="416,408 422,422 436,428 422,434 416,448 410,434 396,428 410,422" fill="#bfe4ff" opacity="0.9"/>' +
          '<polygon points="274,504 278,513 287,517 278,521 274,530 270,521 261,517 270,513" fill="#e6f5ff" opacity="0.84"/>' +
        '</g>' +
      '</svg>';

    host.appendChild(wrap);

    var cleaned = false;
    var cleanup = function () {
      if (cleaned) return;
      cleaned = true;
      if (wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
    };

    var timer = setTimeout(cleanup, 420);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
    return wrap;
  }

  /* =========================================================================
     四、交互式「冰晶宫殿·寒夜推演盘」(openDeductionBoard)
     ========================================================================= */
  function buildDeductionModalShell() {
    var modal = document.getElementById('ice-deduction-modal');
    if (!modal) {
      modal = document.createElement('section');
      modal.id = 'ice-deduction-modal';
      modal.className = 'overlay hidden';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      var host = document.getElementById('app') || document.body;
      if (host) host.appendChild(modal);
    }
    return modal;
  }

  function renderCornerSvg(posClass, dPath, diamondPoints) {
    return (
      '<svg class="idb-corner ' + posClass + '" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">' +
        '<path d="' + dPath + '" stroke="#d8b467" stroke-width="1.25" opacity="0.82"/>' +
        '<polygon points="' + diamondPoints + '" fill="#8fd2ff" opacity="0.78"/>' +
      '</svg>'
    );
  }

  function isDeductionOpen() {
    return !!(state.deduction && state.deduction.open);
  }

  function closeDeductionBoard(skipped) {
    var session = state.deduction;
    if (!session || !session.open) {
      var stray = isBrowserDoc() ? document.getElementById('ice-deduction-modal') : null;
      if (stray) stray.classList.add('hidden');
      return false;
    }

    session.open = false;
    state.deduction = null;

    if (session.keyHandler && isBrowserDoc()) {
      document.removeEventListener('keydown', session.keyHandler, true);
    }

    if (session.modal) {
      session.modal.classList.add('hidden');
    }

    if (!session.hadIceLensBefore && isBrowserDoc() && document.body) {
      document.body.classList.remove('ice-palace-lens');
    }

    var payload = {
      resolved: !skipped,
      skipped: !!skipped,
      selectedIds: Array.from(session.selectedIds)
    };

    if (typeof session.onDone === 'function') {
      session.onDone(payload);
    }
    return true;
  }

  function openDeductionBoard(config, onDone) {
    var cfg = config && typeof config === 'object' ? config : {};
    var rawClues = Array.isArray(cfg.clues) ? cfg.clues : [];
    var clues = rawClues.map(function (c, idx) {
      var item = c && typeof c === 'object' ? c : {};
      return {
        id: item.id != null ? String(item.id) : 'clue_' + idx,
        label: item.label ? String(item.label) : ('证物 ' + (idx + 1)),
        detail: item.detail ? String(item.detail) : '',
        isKey: !!item.isKey
      };
    });

    var requiredIds = Array.isArray(cfg.requiredIds) && cfg.requiredIds.length
      ? cfg.requiredIds.map(function (id) { return String(id); })
      : clues.filter(function (c) { return c.isKey; }).map(function (c) { return c.id; });

    var requiredSet = new Set(requiredIds);
    clues.forEach(function (c) {
      if (requiredSet.has(c.id)) c.isKey = true;
    });

    if (cfg.autoResolve || !isBrowserDoc()) {
      if (typeof onDone === 'function') {
        onDone({
          resolved: true,
          skipped: false,
          autoResolved: true,
          selectedIds: requiredIds.slice()
        });
      }
      return null;
    }

    if (state.deduction && state.deduction.open) {
      if (state.deduction.keyHandler) {
        document.removeEventListener('keydown', state.deduction.keyHandler, true);
      }
      state.deduction.open = false;
      state.deduction = null;
    }

    var modal = buildDeductionModalShell();
    var hadIceLensBefore = !!(document.body && document.body.classList.contains('ice-palace-lens'));
    triggerIcePalaceFilter(true);

    var title = cfg.title ? String(cfg.title) : '冰晶宫殿 · 寒夜推演盘';
    var subtitle = cfg.subtitle ? String(cfg.subtitle) : 'ICE PALACE · PRISM DEDUCTION';
    var prompt = cfg.prompt ? String(cfg.prompt) : '逐一点选证物卡片，在冰晶棱镜内凝结脉络';
    var conclusion = cfg.conclusion ? String(cfg.conclusion) : '散落的细节已在冰晶棱镜中首尾相连。';
    var skipLabel = cfg.skipLabel ? String(cfg.skipLabel) : '略过推演 · 直通下文';

    var clueCardsHtml = clues.map(function (clue, idx) {
      var numeral = ROMAN_NUMERALS[idx] || String(idx + 1);
      return (
        '<button type="button" class="idb-clue" data-clue-id="' + escapeHtml(clue.id) + '" aria-pressed="false">' +
          '<div class="idb-clue-top">' +
            '<span class="idb-clue-index">' +
              '<svg class="idb-clue-facet" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">' +
                '<polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/>' +
                '<circle cx="8" cy="8" r="1.4" fill="currentColor"/>' +
              '</svg>' +
              '<span>' + escapeHtml(numeral) + '</span>' +
            '</span>' +
            '<span class="idb-clue-badge">待检视</span>' +
          '</div>' +
          '<div class="idb-clue-label">' + escapeHtml(clue.label) + '</div>' +
          '<div class="idb-clue-snippet">' + escapeHtml(clue.detail) + '</div>' +
        '</button>'
      );
    }).join('');

    var pipsHtml = requiredIds.map(function (reqId) {
      return '<i class="idb-pip" data-req-id="' + escapeHtml(reqId) + '"></i>';
    }).join('');

    modal.innerHTML =
      '<div class="idb-shell">' +
        renderCornerSvg('tl', 'M2 20V3.5C2 2.7 2.7 2 3.5 2H20', '6.5,6.5 9.5,6.5 6.5,9.5') +
        renderCornerSvg('tr', 'M22 20V3.5C22 2.7 21.3 2 20.5 2H4', '17.5,6.5 14.5,6.5 17.5,9.5') +
        renderCornerSvg('bl', 'M2 4V20.5C2 21.3 2.7 22 3.5 22H20', '6.5,17.5 9.5,17.5 6.5,14.5') +
        renderCornerSvg('br', 'M22 4V20.5C22 21.3 21.3 22 20.5 22H4', '17.5,17.5 14.5,17.5 17.5,14.5') +

        '<header class="idb-head">' +
          '<div class="idb-head-left">' +
            '<div class="idb-emblem" aria-hidden="true">' +
              '<svg viewBox="0 0 36 36" width="28" height="28" fill="none">' +
                '<circle cx="18" cy="18" r="15" stroke="rgba(216,180,103,0.45)" stroke-width="1" stroke-dasharray="3 4"/>' +
                '<polygon points="18,4 30,18 18,32 6,18" stroke="#8fd2ff" stroke-width="1.25" fill="rgba(126,200,255,0.14)"/>' +
                '<polygon points="18,9.5 25,18 18,26.5 11,18" stroke="#f4dca0" stroke-width="1.1"/>' +
                '<circle cx="18" cy="18" r="2" fill="#f4dca0"/>' +
              '</svg>' +
            '</div>' +
            '<div class="idb-titles">' +
              '<div class="idb-subtitle">' + escapeHtml(subtitle) + '</div>' +
              '<h2 class="idb-title">' + escapeHtml(title) + '</h2>' +
            '</div>' +
          '</div>' +
          '<div class="idb-head-right">' +
            '<div class="idb-progress-pill" id="idb-progress-pill">' +
              '<span id="idb-progress-text">关键疑点 0 / ' + requiredIds.length + '</span>' +
              '<span class="idb-pips">' + pipsHtml + '</span>' +
            '</div>' +
            '<button type="button" class="idb-close-btn" id="idb-close-x" aria-label="关闭推演盘">×</button>' +
          '</div>' +
        '</header>' +

        '<div class="idb-prompt-bar">' +
          '<span class="idb-prompt-mark" aria-hidden="true">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35">' +
              '<polygon points="8,1.8 14.2,8 8,14.2 1.8,8"/>' +
            '</svg>' +
          '</span>' +
          '<span>' + escapeHtml(prompt) + '</span>' +
        '</div>' +

        '<div class="idb-body">' +
          '<div class="idb-clues-grid" id="idb-clues-grid">' + clueCardsHtml + '</div>' +

          '<section class="idb-prism-panel" id="idb-prism-panel" aria-live="polite">' +
            '<div class="idb-seal-sigil" aria-hidden="true">' +
              '<svg viewBox="0 0 64 64" width="58" height="58" fill="none">' +
                '<circle class="idb-seal-ring" cx="32" cy="32" r="26" stroke="rgba(154,214,255,0.34)" stroke-width="1"/>' +
                '<polygon points="32,8 54,32 32,56 10,32" stroke="rgba(154,214,255,0.52)" stroke-width="1.15" fill="rgba(126,200,255,0.08)"/>' +
                '<path class="idb-seal-links" d="M32 10 L50 32 L32 54 L14 32 Z M14 32 L50 32 M32 10 L32 54" stroke="#f4dca0" stroke-width="1.25"/>' +
                '<circle cx="32" cy="10" r="2.2" fill="#a8dcff"/>' +
                '<circle cx="50" cy="32" r="2.2" fill="#f4dca0"/>' +
                '<circle cx="32" cy="54" r="2.2" fill="#a8dcff"/>' +
                '<circle cx="14" cy="32" r="2.2" fill="#f4dca0"/>' +
                '<circle cx="32" cy="32" r="2.6" fill="#f4dca0"/>' +
              '</svg>' +
            '</div>' +
            '<div class="idb-prism-copy">' +
              '<div class="idb-prism-meta">' +
                '<span class="idb-prism-tag" id="idb-prism-tag">冰晶棱镜 · 待凝结</span>' +
                '<span class="idb-prism-name" id="idb-prism-name"></span>' +
              '</div>' +
              '<div class="idb-prism-detail" id="idb-prism-detail">点选上方证物，在冰晶宫殿内映照细节。</div>' +
              '<div class="idb-conclusion-block hidden" id="idb-conclusion-block">' +
                escapeHtml(conclusion).replace(/\n/g, '<br>') +
              '</div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<footer class="idb-foot">' +
          '<button type="button" class="idb-skip-btn" id="idb-skip-btn">' + escapeHtml(skipLabel) + '</button>' +
          '<button type="button" class="idb-confirm-btn" id="idb-confirm-btn" disabled>✦ 凝结推演结论</button>' +
        '</footer>' +
      '</div>';

    var selectedIds = new Set();
    var inspectedId = null;

    var clueMap = Object.create(null);
    clues.forEach(function (c) { clueMap[c.id] = c; });

    var progressPill = modal.querySelector('#idb-progress-pill');
    var progressText = modal.querySelector('#idb-progress-text');
    var prismPanel = modal.querySelector('#idb-prism-panel');
    var prismTag = modal.querySelector('#idb-prism-tag');
    var prismName = modal.querySelector('#idb-prism-name');
    var prismDetail = modal.querySelector('#idb-prism-detail');
    var conclusionBlock = modal.querySelector('#idb-conclusion-block');
    var confirmBtn = modal.querySelector('#idb-confirm-btn');
    var skipBtn = modal.querySelector('#idb-skip-btn');
    var closeX = modal.querySelector('#idb-close-x');

    function updateBoardUI() {
      var matchedCount = 0;
      requiredIds.forEach(function (reqId) {
        if (selectedIds.has(reqId)) matchedCount += 1;
      });
      var unlocked = requiredIds.length === 0
        ? selectedIds.size > 0
        : matchedCount >= requiredIds.length;

      if (progressText) {
        progressText.textContent = '关键疑点 ' + matchedCount + ' / ' + requiredIds.length;
      }
      if (progressPill) {
        progressPill.classList.toggle('is-complete', unlocked);
      }

      var pips = modal.querySelectorAll('.idb-pip');
      for (var pIdx = 0; pIdx < pips.length; pIdx++) {
        var reqKey = pips[pIdx].getAttribute('data-req-id');
        pips[pIdx].classList.toggle('is-lit', selectedIds.has(reqKey));
      }

      var buttons = modal.querySelectorAll('.idb-clue');
      for (var bIdx = 0; bIdx < buttons.length; bIdx++) {
        var btn = buttons[bIdx];
        var cid = btn.getAttribute('data-clue-id');
        var clue = clueMap[cid];
        var isSel = selectedIds.has(cid);
        var isSealed = unlocked && isSel && requiredSet.has(cid);
        btn.classList.toggle('is-selected', isSel);
        btn.classList.toggle('is-inspected', cid === inspectedId);
        btn.classList.toggle('is-sealed', isSealed);
        btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');

        var badge = btn.querySelector('.idb-clue-badge');
        if (badge) {
          if (isSealed) badge.textContent = '银金合印';
          else if (isSel) badge.textContent = (clue && clue.isKey) ? '棱镜共鸣' : '已冻结';
          else badge.textContent = '待检视';
        }
      }

      if (prismPanel) {
        prismPanel.classList.toggle('is-unlocked', unlocked);
      }

      var activeClue = inspectedId ? clueMap[inspectedId] : null;
      if (unlocked) {
        if (prismTag) prismTag.textContent = '银金星印 · 脉络合拢';
        if (prismName) prismName.textContent = activeClue ? activeClue.label : '';
        if (prismDetail) {
          prismDetail.textContent = activeClue
            ? activeClue.detail
            : '全部关键疑点已于冰晶宫殿中完成映照。';
        }
        if (conclusionBlock) conclusionBlock.classList.remove('hidden');
      } else if (activeClue) {
        if (prismTag) {
          prismTag.textContent = activeClue.isKey ? '棱镜共鸣 · 关键留影' : '留影归档 · 常规记录';
        }
        if (prismName) prismName.textContent = activeClue.label;
        if (prismDetail) prismDetail.textContent = activeClue.detail;
        if (conclusionBlock) conclusionBlock.classList.add('hidden');
      } else {
        if (prismTag) prismTag.textContent = '冰晶棱镜 · 待凝结';
        if (prismName) prismName.textContent = '';
        if (prismDetail) prismDetail.textContent = '点选上方证物，在冰晶宫殿内映照细节。';
        if (conclusionBlock) conclusionBlock.classList.add('hidden');
      }

      if (confirmBtn) {
        confirmBtn.disabled = !unlocked;
      }
    }

    var clueBtns = modal.querySelectorAll('.idb-clue');
    for (var i = 0; i < clueBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var cid = btn.getAttribute('data-clue-id');
          if (!cid) return;
          if (!selectedIds.has(cid)) {
            selectedIds.add(cid);
            inspectedId = cid;
          } else if (inspectedId !== cid) {
            inspectedId = cid;
          } else if (!requiredSet.has(cid)) {
            selectedIds.delete(cid);
            inspectedId = null;
          }
          updateBoardUI();
        });
      })(clueBtns[i]);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (confirmBtn.disabled) return;
        closeDeductionBoard(false);
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        closeDeductionBoard(true);
      });
    }

    if (closeX) {
      closeX.addEventListener('click', function () {
        closeDeductionBoard(true);
      });
    }

    var keyHandler = function (e) {
      if (!isDeductionOpen()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeDeductionBoard(true);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        var activeEl = document.activeElement;
        if (activeEl && modal.contains(activeEl) && activeEl.tagName === 'BUTTON' && !activeEl.disabled) {
          activeEl.click();
        }
      }
    };

    document.addEventListener('keydown', keyHandler, true);

    state.deduction = {
      open: true,
      modal: modal,
      selectedIds: selectedIds,
      onDone: onDone,
      keyHandler: keyHandler,
      hadIceLensBefore: hadIceLensBefore
    };

    modal.classList.remove('hidden');
    updateBoardUI();
    return modal;
  }

  /* =========================================================================
     五、自动挂载与生命周期管理
     ========================================================================= */
  function handleVisibilityChange() {
    if (typeof document !== 'undefined' && document.hidden) {
      stopLoop();
    } else {
      startLoop();
    }
  }

  function init() {
    if (!isBrowserDoc()) return;
    if (!state.initialized) {
      state.initialized = true;
      state.enabled = readSavedEnabled();
      checkReducedMotion();
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('resize', resizeCanvas);
      }
      if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    }
    ensureCanvas();
    observeBg();
    syncFromBg();
  }

  var api = {
    init: init,
    resolveMode: resolveMode,
    syncFromBg: syncFromBg,
    setMode: setMode,
    getMode: getMode,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    triggerIcePalaceFilter: triggerIcePalaceFilter,
    triggerFrostSlash: triggerFrostSlash,
    openDeductionBoard: openDeductionBoard,
    closeDeductionBoard: closeDeductionBoard,
    isDeductionOpen: isDeductionOpen
  };

  if (root) {
    root.AmbientFX = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (isBrowserDoc()) {
    if (document.getElementById('app') || document.readyState !== 'loading') {
      init();
    } else {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
