/* =========================================================================
   《转生千金》V3 标题页空间连续性总控与手绘晶簇引擎 (js/title-director.js)
   美学体系：《冰晶宫殿 · 极简晶簇与空间连续性》
   window.TitleDirector = {
     init, replay, openArchiveMode, openSettingsMode, returnToMain,
     syncAudioButton, syncArchiveMeta, getMode,
     indexMenuItems, getParallax, playCardExitVeil, syncCardBackdrop, destroy
   }
   ========================================================================= */
(function (root) {
  'use strict';

  var OPENING_MS = 1150;
  var VEIL_MS = 400;
  var WRITE_EPS = 0.0012;
  var SETTLE_EPS = 0.0008;
  var STAGE_DIM = 520;
  var STAGE_HALF = 260;
  var SHARD_W_FRAC = 0.24;
  var SHARD_H_FRAC = 0.41;
  var ORBIT_RX = 204;
  var ORBIT_RY = 104;
  var ORBIT_TILT = -14 * Math.PI / 180;
  var ORBIT_COS = Math.cos(ORBIT_TILT);
  var ORBIT_SIN = Math.sin(ORBIT_TILT);
  var ORBIT_FRONT_ANGLE = 2.38;

  /* 7 枚独立可变换多面体冰晶的主雕塑簇拥坐标（不对称哥特冰晶剪影，紧密拱卫中央 260,260 蓝宝石核） */
  var CLUSTER_LAYOUT = [
    { x: 236, y: 158, rot: -7, sc: 1.12, z: 22, variant: 0, slotId: 1 },
    { x: 294, y: 184, rot: 14, sc: 0.96, z: 21, variant: 1, slotId: 2 },
    { x: 204, y: 244, rot: -18, sc: 0.92, z: 23, variant: 2, slotId: 3 },
    { x: 312, y: 256, rot: 21, sc: 0.88, z: 22, variant: 1, slotId: 4 },
    { x: 262, y: 344, rot: 175, sc: 1.0, z: 24, variant: 0, slotId: 5 },
    { x: 220, y: 316, rot: -158, sc: 0.78, z: 23, variant: 2, slotId: 6 },
    { x: 188, y: 186, rot: -26, sc: 0.56, z: 19, variant: 3, slotId: null }
  ];

  var SOUNDTRACK_CATALOG = [
    { key: 'peaceful1', title: '银蓝晨光 I', mood: '公爵府 · 悠然日常' },
    { key: 'sacred2', title: '冰晶宫殿 II', mood: '极北秘境 · 星霜回响' },
    { key: 'academy1', title: '阿斯拉钟塔 I', mood: '魔法学府 · 晨钟长廊' },
    { key: 'relax1', title: '雪夜壁炉 I', mood: '静谧夜色 · 暖灯微光' },
    { key: 'cheerful1', title: '集市晴日 I', mood: '领地街巷 · 明朗欢歌' },
    { key: 'romantic', title: '月虹潮声', mood: '盛夏海湾 · 月下轻语' },
    { key: 'emotional1', title: '远行余温', mood: '北行旅途 · 深情余韵' },
    { key: 'sad1', title: '灰烬初雪', mood: '黑夜变故 · 风雪离歌' },
    { key: 'comedy_medium', title: '微服出游曲', mood: '姐妹趣事 · 轻快中速' },
    { key: 'battle1', title: '锋刃交错 I', mood: '战术演武 · 交锋决意' },
    { key: 'battle2', title: '霜原决意 II', mood: '冰封峡谷 · 雪原死斗' }
  ];

  var TYPE_SPEED_OPTS = [
    { value: 'instant', label: '即时' },
    { value: 'fast', label: '快速' },
    { value: 'normal', label: '舒缓' }
  ];

  var st = {
    inited: false,
    mode: 'main',
    opening: 'ready',
    readyT: 0,
    initIdxT: 0,
    raf: 0,
    lastTs: 0,
    dustRaf: 0,
    dustLastTs: 0,
    dustMotes: null,
    tx: 0, ty: 0, cx: 0, cy: 0,
    wx: 0, wy: 0, wrote: false,
    reduced: false,
    fine: false,
    mqlMotion: null,
    mqlPointer: null,
    menuObs: null,
    titleObs: null,
    muteObs: null,
    continueObs: null,
    cardObs: null,
    cleanups: [],
    selectedSlotId: 1,
    orbitStep: 0,
    latestSlotId: -1,
    pendingDeleteSlot: null,
    pendingDeleteT: 0,
    settingsTab: 'general',
    auditionTrackKey: null,
    auditionTrackTitle: '',
    lastSfxPingAt: 0,
    focusedMenuId: null
  };

  var hasDom = function () { return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.documentElement; };
  var isJsdom = function () { return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || ''); };
  var clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  var getTitle = function () { return hasDom() ? document.getElementById('title-screen') : null; };
  var isTitleVis = function () {
    var el = getTitle();
    return !!(el && !el.classList.contains('hidden') && (!el.style || el.style.display !== 'none'));
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function playSfxSafe(cue, opts) {
    try {
      if (root && root.CrystalSFX && typeof root.CrystalSFX.play === 'function') {
        root.CrystalSFX.play(cue, opts);
        return;
      }
      if (root && typeof root.sfx === 'function') {
        root.sfx(cue);
      }
    } catch (e) {}
  }

  function isAnyModalBlocking() {
    try {
      if (root && root.VNUx && typeof root.VNUx.isAnyBlockingOverlayOpen === 'function') {
        if (root.VNUx.isAnyBlockingOverlayOpen()) return true;
      }
    } catch (e) {}
    if (!hasDom()) return false;
    var checkIds = ['letter-demo', 'codex', 'help-screen', 'arena-overlay', 'vn-chapters-modal', 'vn-saveload-modal', 'vn-prefs-modal', 'card', 'sys-popup'];
    for (var i = 0; i < checkIds.length; i++) {
      var el = document.getElementById(checkIds[i]);
      if (el && !el.classList.contains('hidden') && (!el.style || el.style.display !== 'none')) return true;
    }
    return false;
  }

  function readMedia() {
    if (!hasDom() || typeof window.matchMedia !== 'function') { st.reduced = false; st.fine = false; return; }
    try {
      st.mqlMotion = st.mqlMotion || window.matchMedia('(prefers-reduced-motion: reduce)');
      st.reduced = !!st.mqlMotion.matches;
    } catch (e) { st.reduced = false; }
    try {
      st.mqlPointer = st.mqlPointer || window.matchMedia('(hover: hover) and (pointer: fine)');
      st.fine = !!st.mqlPointer.matches;
    } catch (e) { st.fine = false; }
  }

  function clearTimers() {
    if (st.readyT) { clearTimeout(st.readyT); st.readyT = 0; }
  }

  function clearPendingDelete() {
    st.pendingDeleteSlot = null;
    if (st.pendingDeleteT) { clearTimeout(st.pendingDeleteT); st.pendingDeleteT = 0; }
    var delBtn = hasDom() ? document.getElementById('v3-arc-del') : null;
    if (delBtn) {
      delBtn.classList.remove('is-confirming');
      delBtn.innerHTML = '<span>DELETE</span><span class="v3-act-zh">// 清除记忆</span>';
    }
  }

  /* =========================================================================
     1. 3D 鼠标视差与全画布多景深菱形微尘 (#v3-dust-canvas)
     ========================================================================= */

  function stopRaf() {
    if (st.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.lastTs = 0;
  }

  function writeVars(el, x, y, force) {
    if (!el || !el.style) return;
    if (!force && st.wrote && Math.abs(x - st.wx) < WRITE_EPS && Math.abs(y - st.wy) < WRITE_EPS) return;
    el.style.setProperty('--px', x.toFixed(4));
    el.style.setProperty('--py', y.toFixed(4));
    st.wx = x; st.wy = y; st.wrote = true;
  }

  function resetParallax(flushZero) {
    stopRaf();
    st.tx = 0; st.ty = 0; st.cx = 0; st.cy = 0;
    if (flushZero && st.wrote) writeVars(getTitle(), 0, 0, true);
  }

  function stepParallax(ts) {
    st.raf = 0;
    if (isJsdom() || st.reduced || !st.fine || document.hidden || !isTitleVis() || st.opening === 'playing') return;
    var dt = st.lastTs ? clamp(ts - st.lastTs, 4, 48) : 16.67;
    st.lastTs = ts;
    var ease = 1 - Math.pow(0.0014, dt / 1000);
    st.cx += (st.tx - st.cx) * ease;
    st.cy += (st.ty - st.cy) * ease;
    var done = Math.abs(st.tx - st.cx) < SETTLE_EPS && Math.abs(st.ty - st.cy) < SETTLE_EPS;
    if (done) { st.cx = st.tx; st.cy = st.ty; }
    writeVars(getTitle(), st.cx, st.cy, done);
    if (!done && typeof requestAnimationFrame === 'function') st.raf = requestAnimationFrame(stepParallax);
    else st.lastTs = 0;
  }

  function kickParallax() {
    if (st.raf || isJsdom() || st.reduced || !st.fine || st.opening === 'playing' || document.hidden || !isTitleVis()) return;
    if (typeof requestAnimationFrame !== 'function') return;
    st.lastTs = 0;
    st.raf = requestAnimationFrame(stepParallax);
  }

  function stopDustLoop() {
    if (st.dustRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(st.dustRaf);
    st.dustRaf = 0;
    st.dustLastTs = 0;
  }

  function isAmbientFxAllowed() {
    try {
      if (root && root.AmbientFX && typeof root.AmbientFX.isEnabled === 'function') {
        return !!root.AmbientFX.isEnabled();
      }
      if (root && root.VNUx && typeof root.VNUx.getPrefs === 'function') {
        var p = root.VNUx.getPrefs();
        if (p && p.fxEnabled === false) return false;
      }
    } catch (e) {}
    return true;
  }

  function ensureDustMotes(cw, ch) {
    if (st.dustMotes && st.dustMotes.length) return st.dustMotes;
    var list = [];
    var total = 44;
    for (var i = 0; i < total; i++) {
      var mod = i % 12;
      var tone = mod === 0 ? 'champagne' : (mod <= 4 ? 'sapphire' : (mod <= 6 ? 'ice' : 'ink'));
      var depth = i < 16 ? 0.45 : (i < 34 ? 0.78 : 1.15);
      list.push({
        x: Math.random() * cw,
        y: Math.random() * ch,
        r: (1.5 + Math.random() * 2.4) * (0.72 + depth * 0.32),
        vx: (Math.random() - 0.35) * 0.14 * depth,
        vy: (-0.08 - Math.random() * 0.16) * depth,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.009),
        phase: Math.random() * Math.PI * 2,
        vphase: 0.015 + Math.random() * 0.02,
        alpha: (tone === 'sapphire' ? 0.44 : (tone === 'champagne' ? 0.56 : (tone === 'ice' ? 0.58 : 0.3))) + Math.random() * 0.22,
        tone: tone,
        depth: depth
      });
    }
    st.dustMotes = list;
    return list;
  }

  function drawDustFrame(canvas, ctx, dt) {
    var titleEl = getTitle();
    if (!titleEl) return;
    var cw = titleEl.clientWidth || window.innerWidth || 1440;
    var ch = titleEl.clientHeight || window.innerHeight || 900;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.max(1, Math.round(cw * dpr));
    var ph = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    if (!isAmbientFxAllowed()) return;

    var motes = ensureDustMotes(cw, ch);
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      if (dt > 0) {
        m.phase += m.vphase * dt;
        m.rot += m.vrot * dt;
        m.x += (m.vx + Math.sin(m.phase * 0.65) * 0.08) * dt;
        m.y += m.vy * dt;
        if (m.y < -14) { m.y = ch + 12; m.x = Math.random() * cw; }
        if (m.y > ch + 14) { m.y = -10; }
        if (m.x < -14) { m.x = cw + 12; }
        if (m.x > cw + 14) { m.x = -12; }
      }
      var shimmer = 0.68 + 0.32 * Math.sin(m.phase);
      var a = m.alpha * shimmer;
      var px = m.x + st.cx * (-14 * m.depth);
      var py = m.y + st.cy * (-10 * m.depth);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(m.rot);
      ctx.beginPath();
      ctx.moveTo(0, -m.r);
      ctx.lineTo(m.r * 0.62, 0);
      ctx.lineTo(0, m.r);
      ctx.lineTo(-m.r * 0.62, 0);
      ctx.closePath();
      if (m.tone === 'sapphire') {
        ctx.fillStyle = 'rgba(28, 76, 184, ' + a.toFixed(3) + ')';
      } else if (m.tone === 'ice') {
        ctx.fillStyle = 'rgba(107, 197, 248, ' + a.toFixed(3) + ')';
      } else if (m.tone === 'champagne') {
        ctx.fillStyle = 'rgba(201, 180, 138, ' + a.toFixed(3) + ')';
      } else {
        ctx.fillStyle = 'rgba(82, 96, 120, ' + (a * 0.72).toFixed(3) + ')';
      }
      ctx.fill();
      ctx.restore();
    }
  }

  function startDustLoop() {
    if (!hasDom() || isJsdom()) return;
    var canvas = document.getElementById('v3-dust-canvas');
    if (!canvas || !isTitleVis()) { stopDustLoop(); return; }
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) {}
    if (!ctx) return;

    if (!isAmbientFxAllowed() || st.reduced) {
      stopDustLoop();
      drawDustFrame(canvas, ctx, 0);
      return;
    }

    if (st.dustRaf || typeof requestAnimationFrame !== 'function') return;
    var step = function (ts) {
      if (!isTitleVis() || document.hidden || !isAmbientFxAllowed() || st.reduced) {
        st.dustRaf = 0;
        st.dustLastTs = 0;
        if (canvas && ctx && !isAmbientFxAllowed()) drawDustFrame(canvas, ctx, 0);
        return;
      }
      var dt = st.dustLastTs ? clamp((ts - st.dustLastTs) / 16.667, 0.25, 2.6) : 1;
      st.dustLastTs = ts;
      drawDustFrame(canvas, ctx, dt);
      st.dustRaf = requestAnimationFrame(step);
    };
    st.dustRaf = requestAnimationFrame(step);
  }

  /* =========================================================================
     2. 手绘多层 SVG 冰晶宫殿雕塑模板（核心宝石 + 7 枚独立碎片 + 断裂星轨）
     ========================================================================= */

  function buildOpeningVeilMarkup() {
    return '' +
      '<svg class="v3-bloom-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<defs>' +
          '<filter id="v3-mist-displace" x="-25%" y="-25%" width="150%" height="150%">' +
            '<feTurbulence type="fractalNoise" baseFrequency="0.014 0.018" numOctaves="4" seed="7" result="noise"/>' +
            '<feDisplacementMap in="SourceGraphic" in2="noise" scale="96" xChannelSelector="R" yChannelSelector="G"/>' +
          '</filter>' +
          '<mask id="v3-frost-bloom-mask">' +
            '<rect width="1440" height="900" fill="#ffffff"/>' +
            '<g class="v3-bloom-hole-group">' +
              '<circle cx="496" cy="442" r="360" fill="#000000" filter="url(#v3-mist-displace)"/>' +
            '</g>' +
          '</mask>' +
          '<radialGradient id="v3-mist-edge-grad" cx="50%" cy="50%" r="50%">' +
            '<stop offset="52%" stop-color="#fafbfd" stop-opacity="0"/>' +
            '<stop offset="76%" stop-color="#d7eeff" stop-opacity="0.34"/>' +
            '<stop offset="92%" stop-color="#2b364d" stop-opacity="0.45"/>' +
            '<stop offset="100%" stop-color="#141820" stop-opacity="0"/>' +
          '</radialGradient>' +
        '</defs>' +
        '<g class="v3-bloom-veil-fade">' +
          '<rect width="1440" height="900" fill="#141820" mask="url(#v3-frost-bloom-mask)"/>' +
          '<g class="v3-bloom-mist-ring">' +
            '<circle cx="496" cy="442" r="380" fill="url(#v3-mist-edge-grad)" filter="url(#v3-mist-displace)"/>' +
          '</g>' +
        '</g>' +
      '</svg>';
  }

  function buildAstrolabeLayerMarkup() {
    return '' +
      '<svg class="v3-astrolabe-layer" viewBox="0 0 520 520" fill="none" aria-hidden="true">' +
        '<g class="v3-astrolabe-ring-slow">' +
          '<path d="M 122 152 A 176 176 0 0 1 228 87" stroke="#8e9db5" stroke-width="0.9" stroke-linecap="round"/>' +
          '<path d="M 304 90 A 176 176 0 0 1 434 234" stroke="#9aa8bf" stroke-width="0.85" stroke-linecap="round"/>' +
          '<path d="M 412 348 A 176 176 0 0 1 286 434" stroke="#8e9db5" stroke-width="0.9" stroke-linecap="round"/>' +
          '<path d="M 196 424 A 176 176 0 0 1 92 312" stroke="#9aa8bf" stroke-width="0.8" stroke-linecap="round"/>' +
          '<circle cx="394" cy="144" r="2.6" fill="#fafbfd" stroke="#526078" stroke-width="0.95"/>' +
          '<polygon points="104,220 107.5,223.5 104,227 100.5,223.5" fill="#1c4cb8" fill-opacity="0.72"/>' +
        '</g>' +
        '<g class="v3-astrolabe-ring-counter">' +
          '<path d="M 148 168 A 144 144 0 0 1 242 117" stroke="#adb9ce" stroke-width="0.75" stroke-dasharray="2.5 6"/>' +
          '<path d="M 326 132 A 144 144 0 0 1 402 276" stroke="#b5c1d4" stroke-width="0.75"/>' +
          '<path d="M 358 366 A 144 144 0 0 1 172 374" stroke="#adb9ce" stroke-width="0.75" stroke-dasharray="3 7"/>' +
          '<path d="M 124 306 A 144 144 0 0 1 124 214" stroke="#b5c1d4" stroke-width="0.75"/>' +
        '</g>' +
        '<g class="v3-astrolabe-circuits">' +
          '<polyline points="246,94 246,48 228,30 228,16" stroke="#7c8ba4" stroke-width="0.85"/>' +
          '<polyline points="252,86 252,54 238,40" stroke="#aebacf" stroke-width="0.7"/>' +
          '<circle cx="228" cy="14" r="3" fill="#fafbfd" stroke="#1b2333" stroke-width="0.95"/>' +
          '<circle cx="238" cy="40" r="1.8" fill="#1c4cb8"/>' +
          '<polyline points="118,286 72,286 52,266" stroke="#7c8ba4" stroke-width="0.85"/>' +
          '<circle cx="50" cy="264" r="3" fill="#fafbfd" stroke="#1b2333" stroke-width="0.95"/>' +
          '<path d="M 50 261 A 3 3 0 0 1 50 267 Z" fill="#1b2333"/>' +
          '<line x1="88" y1="286" x2="88" y2="278" stroke="#9aa8bf" stroke-width="0.75"/>' +
          '<polyline points="296,416 296,454 278,472 278,496" stroke="#7c8ba4" stroke-width="0.85"/>' +
          '<circle cx="278" cy="498" r="2.8" fill="#1c4cb8"/>' +
          '<circle cx="296" cy="454" r="2" fill="#fafbfd" stroke="#526078" stroke-width="0.85"/>' +
          '<polyline points="384,158 412,130 434,130" stroke="#aebacf" stroke-width="0.75"/>' +
          '<polygon points="438,130 441.5,126.5 445,130 441.5,133.5" fill="none" stroke="#c9b48a" stroke-width="1"/>' +
          '<circle cx="152" cy="390" r="1.8" fill="#c9b48a"/>' +
        '</g>' +
      '</svg>';
  }

  function buildOrbitRingsMarkup() {
    return '' +
      '<svg class="v3-orbit-rings-layer" viewBox="0 0 520 520" fill="none" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="v3-tether-grad" gradientUnits="userSpaceOnUse" x1="80" y1="140" x2="440" y2="380">' +
            '<stop offset="0%" stop-color="#1c4cb8" stop-opacity="0.92"/>' +
            '<stop offset="48%" stop-color="#7cd0ff" stop-opacity="0.98"/>' +
            '<stop offset="100%" stop-color="#1c4cb8" stop-opacity="0.92"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<g transform="translate(260, 260) rotate(-14)">' +
          '<path d="M -184 -48 A 204 104 0 0 1 174 -54" stroke="#8b9ab3" stroke-width="0.9" stroke-linecap="round"/>' +
          '<path d="M 196 -28 A 204 104 0 0 1 138 77" stroke="#99a8c0" stroke-width="0.85" stroke-linecap="round"/>' +
          '<path d="M 88 94 A 204 104 0 0 1 -194 32" stroke="#8b9ab3" stroke-width="0.9" stroke-linecap="round"/>' +
          '<ellipse cx="0" cy="0" rx="154" ry="78" stroke="#b0bdd2" stroke-width="0.72" stroke-dasharray="2.5 7"/>' +
          '<path d="M -92 -18 A 96 49 0 0 1 88 -20" stroke="#bdc8da" stroke-width="0.72"/>' +
          '<path d="M 84 24 A 96 49 0 0 1 -86 22" stroke="#bdc8da" stroke-width="0.72"/>' +
        '</g>' +
        '<g id="v3-tether-group">' +
          '<line id="v3-tether-solid" x1="260" y1="260" x2="260" y2="260" stroke="#6bc5f8" stroke-width="2.2" stroke-opacity="0" stroke-linecap="round"/>' +
          '<line id="v3-tether-line" x1="260" y1="260" x2="260" y2="260" stroke="url(#v3-tether-grad)" stroke-width="0.95" stroke-opacity="0" stroke-linecap="round"/>' +
          '<polygon id="v3-tether-start" points="260,256 264,260 260,264 256,260" fill="#1c4cb8" stroke="#fafbfd" stroke-width="0.9" opacity="0"/>' +
          '<polygon id="v3-tether-dot" points="260,255.2 264.8,260 260,264.8 255.2,260" fill="#1c4cb8" stroke="#fafbfd" stroke-width="1" opacity="0"/>' +
          '<circle id="v3-tether-glint" cx="260" cy="260" r="1.35" fill="#e6f5ff" opacity="0"/>' +
          '<circle id="v3-tether-core-ring" cx="260" cy="260" r="34" fill="none" stroke="#1c4cb8" stroke-width="0.85" stroke-opacity="0"/>' +
        '</g>' +
      '</svg>';
  }

  function buildCoreGemSvg() {
    return '' +
      '<svg class="v3-core-svg" viewBox="0 0 140 224" fill="none" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="v3-sapphire-table" x1="30%" y1="10%" x2="75%" y2="90%">' +
            '<stop offset="0%" stop-color="#2e6cf0"/>' +
            '<stop offset="42%" stop-color="#1c4cb8"/>' +
            '<stop offset="100%" stop-color="#0b2060"/>' +
          '</linearGradient>' +
          '<linearGradient id="v3-sapphire-spec" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#eaf6ff"/>' +
            '<stop offset="52%" stop-color="#6bc5f8"/>' +
            '<stop offset="100%" stop-color="#1c4cb8"/>' +
          '</linearGradient>' +
          '<linearGradient id="v3-filigree-metal" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#dfd0b0"/>' +
            '<stop offset="46%" stop-color="#c3d2e6"/>' +
            '<stop offset="100%" stop-color="#cbb791"/>' +
          '</linearGradient>' +
          '<linearGradient id="v3-filigree-silver" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#e5edf7"/>' +
            '<stop offset="55%" stop-color="#d2c09d"/>' +
            '<stop offset="100%" stop-color="#b4c4db"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<line x1="70" y1="6" x2="70" y2="30" stroke="url(#v3-filigree-metal)" stroke-width="0.95"/>' +
        '<polygon points="70,12 73.5,17 70,22 66.5,17" fill="#fafbfd" stroke="#c9b48a" stroke-width="0.9"/>' +
        '<path d="M 54 40 C 60 28, 80 28, 86 40" stroke="url(#v3-filigree-silver)" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
        '<path d="M 46 80 C 28 96, 30 134, 56 156" stroke="url(#v3-filigree-metal)" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
        '<path d="M 49 85 C 35 99, 37 129, 57 149" stroke="url(#v3-filigree-silver)" stroke-width="0.7" stroke-opacity="0.88" fill="none" stroke-linecap="round"/>' +
        '<path d="M 94 74 C 112 92, 110 130, 84 154" stroke="url(#v3-filigree-metal)" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
        '<path d="M 91 81 C 105 95, 103 125, 83 147" stroke="url(#v3-filigree-silver)" stroke-width="0.7" stroke-opacity="0.88" fill="none" stroke-linecap="round"/>' +
        '<polygon points="70,32 97,98 70,174 43,98" fill="#0e2b78" stroke="rgba(18, 38, 92, 0.56)" stroke-width="0.95" stroke-linejoin="round"/>' +
        '<polygon points="70,32 82,66 70,74 58,66" fill="#2c67e2"/>' +
        '<polygon points="70,32 97,98 82,66" fill="url(#v3-sapphire-spec)"/>' +
        '<polygon points="70,32 58,66 43,98" fill="#1741a6"/>' +
        '<polygon points="58,66 70,74 70,136 56,102" fill="#13368c"/>' +
        '<polygon points="82,66 97,98 84,102 70,74" fill="#4696f6"/>' +
        '<polygon points="70,74 84,102 70,136 56,102" fill="url(#v3-sapphire-table)"/>' +
        '<polygon points="43,98 56,102 70,136 70,174" fill="#091a4d"/>' +
        '<polygon points="97,98 70,174 70,136 84,102" fill="#1643ad"/>' +
        '<polygon points="70,136 84,102 76,144" fill="#3b82f6" fill-opacity="0.72"/>' +
        '<polygon points="78,56 88,82 81,86 73,64" fill="#eef7ff" fill-opacity="0.9"/>' +
        '<polyline points="45,96 58,66 70,34 82,66" stroke="rgba(255, 255, 255, 0.86)" stroke-width="0.85" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<line x1="70" y1="32" x2="70" y2="174" stroke="#d7eeff" stroke-width="0.65" stroke-opacity="0.62"/>' +
        '<polyline points="43,98 56,102 70,74 84,102 97,98" stroke="#e4f3ff" stroke-width="0.7" stroke-opacity="0.68"/>' +
        '<path d="M 52 54 C 74 68, 98 92, 92 126 C 88 148, 66 164, 52 178" stroke="url(#v3-filigree-metal)" stroke-width="1.25" fill="none" stroke-linecap="round"/>' +
        '<path d="M 88 62 C 62 84, 44 114, 54 146" stroke="url(#v3-filigree-silver)" stroke-width="0.95" stroke-opacity="0.9" fill="none" stroke-linecap="round"/>' +
        '<path d="M 41 96 C 46 93, 50 96, 52 102" stroke="url(#v3-filigree-metal)" stroke-width="1.05" fill="none" stroke-linecap="round"/>' +
        '<path d="M 99 96 C 94 93, 90 96, 88 102" stroke="url(#v3-filigree-metal)" stroke-width="1.05" fill="none" stroke-linecap="round"/>' +
        '<circle cx="42" cy="98" r="1.9" fill="#fafbfd" stroke="#c9b48a" stroke-width="0.85"/>' +
        '<circle cx="98" cy="98" r="1.9" fill="#fafbfd" stroke="#c9b48a" stroke-width="0.85"/>' +
        '<line x1="70" y1="174" x2="70" y2="212" stroke="url(#v3-filigree-metal)" stroke-width="0.95"/>' +
        '<polygon points="70,206 73.5,213 70,220 66.5,213" fill="#d7eeff" stroke="#1c4cb8" stroke-width="0.85"/>' +
        '<line x1="60" y1="168" x2="57" y2="191" stroke="#b3c3da" stroke-width="0.8"/>' +
        '<circle cx="57" cy="193" r="2.1" fill="#fafbfd" stroke="#c9b48a" stroke-width="0.85"/>' +
        '<line x1="80" y1="164" x2="83" y2="184" stroke="#b3c3da" stroke-width="0.8"/>' +
        '<circle cx="83" cy="186" r="1.8" fill="#d7eeff" stroke="#1c4cb8" stroke-width="0.8"/>' +
      '</svg>';
  }

  function buildShardSvg(variant) {
    if (variant === 0) {
      return '' +
        '<svg class="v3-shard-svg" viewBox="0 0 120 220" fill="none" aria-hidden="true">' +
          '<polygon class="sh-f2" points="60,8 92,76 80,174 60,212 36,164 28,84"/>' +
          '<polygon class="sh-f1" points="60,8 62,102 28,84"/>' +
          '<polygon class="sh-f3" points="60,8 92,76 62,102"/>' +
          '<polygon class="sh-f4" points="28,84 62,102 36,164"/>' +
          '<polygon class="sh-f5" points="62,102 92,76 80,174"/>' +
          '<polygon class="sh-f2" points="36,164 62,102 60,212"/>' +
          '<polygon class="sh-f3" points="62,102 80,174 60,212"/>' +
          '<polygon class="sh-hi" points="58,20 64,74 52,82"/>' +
          '<polyline class="sh-inner-line" points="60,8 62,102 60,212"/>' +
          '<polyline class="sh-inner-line" points="28,84 62,102 92,76"/>' +
          '<polyline class="sh-inner-line" points="36,164 62,102 80,174"/>' +
          '<polyline class="sh-gleam" points="31,84 60,11 89,75"/>' +
          '<polyline class="sh-gleam" points="60,15 62,100 32,86"/>' +
          '<polygon class="sh-outline" points="60,8 92,76 80,174 60,212 36,164 28,84" fill="none"/>' +
        '</svg>';
    }
    if (variant === 1) {
      return '' +
        '<svg class="v3-shard-svg" viewBox="0 0 120 220" fill="none" aria-hidden="true">' +
          '<polygon class="sh-f2" points="68,14 98,64 88,158 54,208 26,144 34,68"/>' +
          '<polygon class="sh-f1" points="68,14 58,92 34,68"/>' +
          '<polygon class="sh-f3" points="68,14 98,64 58,92"/>' +
          '<polygon class="sh-f4" points="34,68 58,92 26,144"/>' +
          '<polygon class="sh-f5" points="58,92 98,64 88,158"/>' +
          '<polygon class="sh-f1" points="26,144 58,92 54,208"/>' +
          '<polygon class="sh-f3" points="58,92 88,158 54,208"/>' +
          '<polygon class="sh-hi" points="65,24 72,72 59,80"/>' +
          '<polyline class="sh-inner-line" points="68,14 58,92 54,208"/>' +
          '<polyline class="sh-inner-line" points="34,68 58,92 98,64"/>' +
          '<polyline class="sh-inner-line" points="26,144 58,92 88,158"/>' +
          '<polyline class="sh-gleam" points="36,69 68,17 95,63"/>' +
          '<polyline class="sh-gleam" points="67,20 58,90 36,70"/>' +
          '<polygon class="sh-outline" points="68,14 98,64 88,158 54,208 26,144 34,68" fill="none"/>' +
        '</svg>';
    }
    if (variant === 2) {
      return '' +
        '<svg class="v3-shard-svg" viewBox="0 0 120 220" fill="none" aria-hidden="true">' +
          '<polygon class="sh-f2" points="54,18 88,82 94,148 62,206 30,152 24,78"/>' +
          '<polygon class="sh-f1" points="54,18 60,106 24,78"/>' +
          '<polygon class="sh-f3" points="54,18 88,82 60,106"/>' +
          '<polygon class="sh-f4" points="24,78 60,106 30,152"/>' +
          '<polygon class="sh-f5" points="60,106 88,82 94,148"/>' +
          '<polygon class="sh-f2" points="30,152 60,106 62,206"/>' +
          '<polygon class="sh-f3" points="60,106 94,148 62,206"/>' +
          '<polygon class="sh-hi" points="52,32 58,86 44,80"/>' +
          '<polyline class="sh-inner-line" points="54,18 60,106 62,206"/>' +
          '<polyline class="sh-inner-line" points="24,78 60,106 88,82"/>' +
          '<polyline class="sh-inner-line" points="30,152 60,106 94,148"/>' +
          '<polyline class="sh-gleam" points="27,79 54,21 86,81"/>' +
          '<polyline class="sh-gleam" points="54,24 60,104 28,81"/>' +
          '<polygon class="sh-outline" points="54,18 88,82 94,148 62,206 30,152 24,78" fill="none"/>' +
        '</svg>';
    }
    return '' +
      '<svg class="v3-shard-svg" viewBox="0 0 120 220" fill="none" aria-hidden="true">' +
        '<polygon class="sh-f2" points="60,34 86,98 60,186 34,104"/>' +
        '<polygon class="sh-f1" points="60,34 60,110 34,104"/>' +
        '<polygon class="sh-f3" points="60,34 86,98 60,110"/>' +
        '<polygon class="sh-f4" points="34,104 60,110 60,186"/>' +
        '<polygon class="sh-f5" points="60,110 86,98 60,186"/>' +
        '<polyline class="sh-inner-line" points="60,34 60,186"/>' +
        '<polyline class="sh-inner-line" points="34,104 60,110 86,98"/>' +
        '<polyline class="sh-gleam" points="37,103 60,37 83,97"/>' +
        '<polygon class="sh-outline" points="60,34 86,98 60,186 34,104" fill="none"/>' +
      '</svg>';
  }

  function buildPrismFacetsSvg() {
    return '' +
      '<svg class="v3-prism-facets" viewBox="0 0 340 60" preserveAspectRatio="none" fill="none" aria-hidden="true">' +
        '<polygon points="44,0 170,0 136,28 0,30" fill="#7dd0ff" fill-opacity="0.26"/>' +
        '<polygon points="170,0 296,0 340,30 204,28" fill="#52a9f7" fill-opacity="0.2"/>' +
        '<polygon points="136,28 170,2 204,28 170,58" fill="#1c4cb8" fill-opacity="0.34"/>' +
        '<polygon points="0,30 136,28 170,60 44,60" fill="#091b52" fill-opacity="0.44"/>' +
        '<polygon points="204,28 340,30 296,60 170,60" fill="#0e2b78" fill-opacity="0.34"/>' +
        '<polygon points="94,0 138,0 86,60 56,60" fill="#ffffff" fill-opacity="0.09"/>' +
        '<line x1="44" y1="0.8" x2="296" y2="0.8" stroke="#eef7ff" stroke-width="1" stroke-opacity="0.58"/>' +
        '<line x1="44" y1="0" x2="136" y2="28" stroke="#e4f3ff" stroke-width="0.8" stroke-opacity="0.44"/>' +
        '<line x1="296" y1="0" x2="204" y2="28" stroke="#d7eeff" stroke-width="0.8" stroke-opacity="0.36"/>' +
        '<line x1="0" y1="30" x2="136" y2="28" stroke="#d7eeff" stroke-width="0.65" stroke-opacity="0.28"/>' +
        '<line x1="204" y1="28" x2="340" y2="30" stroke="#d7eeff" stroke-width="0.65" stroke-opacity="0.24"/>' +
        '<line x1="44" y1="60" x2="136" y2="28" stroke="#7dd0ff" stroke-width="0.6" stroke-opacity="0.22"/>' +
        '<line x1="296" y1="60" x2="204" y2="28" stroke="#7dd0ff" stroke-width="0.6" stroke-opacity="0.2"/>' +
      '</svg>';
  }

  function buildPrismWingsSvg(isTop) {
    if (isTop) {
      return '' +
        '<svg class="v3-prism-wings v3-prism-wings-top" viewBox="0 0 340 14" preserveAspectRatio="none" fill="none" aria-hidden="true">' +
          '<polyline points="26,13 46,2 112,2" stroke="currentColor" stroke-width="0.9"/>' +
          '<polyline points="314,13 294,2 228,2" stroke="currentColor" stroke-width="0.9"/>' +
          '<polygon points="170,1 174,5 170,9 166,5" fill="currentColor" fill-opacity="0.58"/>' +
        '</svg>';
    }
    return '' +
      '<svg class="v3-prism-wings v3-prism-wings-bot" viewBox="0 0 340 14" preserveAspectRatio="none" fill="none" aria-hidden="true">' +
        '<polyline points="26,1 46,12 112,12" stroke="currentColor" stroke-width="0.9"/>' +
        '<polyline points="314,1 294,12 228,12" stroke="currentColor" stroke-width="0.9"/>' +
        '<circle cx="170" cy="9" r="1.8" fill="currentColor" fill-opacity="0.65"/>' +
      '</svg>';
  }

  function applyShardPose(shardEl, svgX, svgY, rotDeg, scale, opacity, zIndex, badgeScale) {
    if (!shardEl || !shardEl.style) return;
    var fx = (svgX - STAGE_HALF) / STAGE_DIM;
    var fy = (svgY - STAGE_HALF) / STAGE_DIM;
    var txPct = (fx / SHARD_W_FRAC) * 100;
    var tyPct = (fy / SHARD_H_FRAC) * 100;
    shardEl.style.setProperty('--tx', txPct.toFixed(2) + '%');
    shardEl.style.setProperty('--ty', tyPct.toFixed(2) + '%');
    shardEl.style.setProperty('--rot', rotDeg.toFixed(2) + 'deg');
    shardEl.style.setProperty('--sc', scale.toFixed(3));
    shardEl.style.setProperty('--op', opacity.toFixed(3));
    shardEl.style.setProperty('--sz', String(zIndex));
    shardEl.style.setProperty('--bsc', (badgeScale || 1).toFixed(3));
  }

  function layoutShardsForCluster() {
    var anchor = document.getElementById('v3-crystal-anchor');
    if (!anchor) return;
    var shards = anchor.querySelectorAll('.v3-shard');
    for (var i = 0; i < shards.length && i < CLUSTER_LAYOUT.length; i++) {
      var cfg = CLUSTER_LAYOUT[i];
      shards[i].classList.remove('is-selected', 'is-occupied', 'is-empty', 'is-latest', 'is-back-arc');
      applyShardPose(shards[i], cfg.x, cfg.y, cfg.rot, cfg.sc, 1, cfg.z, 1);
    }
    var coreBtn = document.getElementById('v3-core-gem');
    if (coreBtn) coreBtn.classList.remove('is-selected');
    updateTetherSvg(STAGE_HALF, STAGE_HALF, false, false);
  }

  function diamondPoints(cx, cy, r) {
    return cx.toFixed(1) + ',' + (cy - r).toFixed(1) + ' ' +
      (cx + r).toFixed(1) + ',' + cy.toFixed(1) + ' ' +
      cx.toFixed(1) + ',' + (cy + r).toFixed(1) + ' ' +
      (cx - r).toFixed(1) + ',' + cy.toFixed(1);
  }

  function updateTetherSvg(targetX, targetY, showLine, showCoreRing) {
    var solid = document.getElementById('v3-tether-solid');
    var line = document.getElementById('v3-tether-line');
    var startNode = document.getElementById('v3-tether-start');
    var dot = document.getElementById('v3-tether-dot');
    var glint = document.getElementById('v3-tether-glint');
    var ring = document.getElementById('v3-tether-core-ring');
    var dx = targetX - STAGE_HALF;
    var dy = targetY - STAGE_HALF;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var startOffset = Math.min(28, dist * 0.22);
    var sx = STAGE_HALF + (dx / dist) * startOffset;
    var sy = STAGE_HALF + (dy / dist) * startOffset;
    if (solid) {
      solid.setAttribute('x1', sx.toFixed(1));
      solid.setAttribute('y1', sy.toFixed(1));
      solid.setAttribute('x2', targetX.toFixed(1));
      solid.setAttribute('y2', targetY.toFixed(1));
      solid.setAttribute('stroke-opacity', showLine ? '0.24' : '0');
    }
    if (line) {
      line.setAttribute('x1', sx.toFixed(1));
      line.setAttribute('y1', sy.toFixed(1));
      line.setAttribute('x2', targetX.toFixed(1));
      line.setAttribute('y2', targetY.toFixed(1));
      line.setAttribute('stroke-opacity', showLine ? '0.94' : '0');
    }
    if (startNode) {
      startNode.setAttribute('points', diamondPoints(sx, sy, 3.6));
      startNode.setAttribute('opacity', showLine ? '1' : '0');
    }
    if (dot) {
      dot.setAttribute('points', diamondPoints(targetX, targetY, 4.6));
      dot.setAttribute('opacity', showLine ? '1' : '0');
    }
    if (glint) {
      glint.setAttribute('cx', targetX.toFixed(1));
      glint.setAttribute('cy', targetY.toFixed(1));
      glint.setAttribute('opacity', showLine ? '0.95' : '0');
    }
    if (ring) {
      ring.setAttribute('stroke-opacity', showCoreRing ? '0.78' : '0');
    }
  }

  /* =========================================================================
     3. 挂载至 V3 index.html DOM 宿主（全幂等，绝不重复建节点）
     ========================================================================= */

  function ensureCrystalStage(titleEl) {
    if (!titleEl) return;

    /* 开场水墨霜雾遮罩：直接填充进 index.html 已有的 #v3-opening-veil */
    var veil = document.getElementById('v3-opening-veil');
    if (!veil) {
      veil = document.createElement('div');
      veil.id = 'v3-opening-veil';
      veil.className = 'v3-opening-veil';
      veil.setAttribute('aria-hidden', 'true');
      titleEl.appendChild(veil);
    }
    if (!veil.querySelector('.v3-bloom-svg')) {
      veil.innerHTML = buildOpeningVeilMarkup();
      veil.addEventListener('click', skipOpeningImmediately);
    }

    /* 全画布菱形微尘画布 */
    if (!document.getElementById('v3-dust-canvas')) {
      var dust = document.createElement('canvas');
      dust.id = 'v3-dust-canvas';
      dust.setAttribute('aria-hidden', 'true');
      titleEl.insertBefore(dust, titleEl.firstChild);
    }

    /* 晶簇雕塑宿主：直接填充进 index.html 已有的 #v3-crystal-anchor */
    var anchor = document.getElementById('v3-crystal-anchor');
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.id = 'v3-crystal-anchor';
      anchor.className = 'v3-crystal-anchor';
      var stageHost = document.getElementById('v3-title-stage') || titleEl;
      stageHost.insertBefore(anchor, stageHost.firstChild);
    }

    if (!anchor.querySelector('.v3-sculpture-stage')) {
      var stage = document.createElement('div');
      stage.className = 'v3-sculpture-stage';
      stage.innerHTML = buildAstrolabeLayerMarkup() + buildOrbitRingsMarkup();

      var coreBtn = document.createElement('button');
      coreBtn.type = 'button';
      coreBtn.id = 'v3-core-gem';
      coreBtn.setAttribute('data-slot', '0');
      coreBtn.setAttribute('aria-label', '自动存档核心 AUTO');
      coreBtn.innerHTML = buildCoreGemSvg() + '<span class="v3-core-auto-label">AUTO</span>';
      coreBtn.addEventListener('click', function () {
        if (st.mode !== 'archive') return;
        playSfxSafe('title_hover', { step: 0 });
        selectArchiveSlot(0);
      });
      stage.appendChild(coreBtn);

      for (var i = 0; i < CLUSTER_LAYOUT.length; i++) {
        var cfg = CLUSTER_LAYOUT[i];
        var shard = document.createElement('button');
        shard.type = 'button';
        shard.className = 'v3-shard';
        shard.setAttribute('data-shard', String(i));
        shard.style.setProperty('--si', String(i));
        if (cfg.slotId != null) {
          shard.setAttribute('data-slot', String(cfg.slotId));
          shard.setAttribute('aria-label', '记忆晶体槽位 0' + cfg.slotId);
          shard.innerHTML =
            '<div class="v3-shard-float">' + buildShardSvg(cfg.variant) + '</div>' +
            '<span class="v3-shard-badge">' +
              '<span class="v3-shard-num">0' + cfg.slotId + '</span>' +
              '<span class="v3-shard-latest">· LATEST</span>' +
            '</span>';
          (function (slotNum, shardIdx) {
            shard.addEventListener('click', function () {
              if (st.mode !== 'archive') return;
              playSfxSafe('title_hover', { step: shardIdx });
              selectArchiveSlot(slotNum);
            });
          })(cfg.slotId, i);
        } else {
          shard.setAttribute('aria-hidden', 'true');
          shard.tabIndex = -1;
          shard.innerHTML = '<div class="v3-shard-float">' + buildShardSvg(cfg.variant) + '</div>';
        }
        stage.appendChild(shard);
      }

      anchor.appendChild(stage);
      layoutShardsForCluster();
    }
  }

  function enhanceTitleMenu(titleEl) {
    if (!titleEl) return;
    var menuEl = titleEl.querySelector('.title-menu');
    if (menuEl) {
      var btnSettings = document.getElementById('btn-title-settings');
      if (!btnSettings) {
        btnSettings = document.createElement('button');
        btnSettings.type = 'button';
        btnSettings.id = 'btn-title-settings';
        btnSettings.className = 'tbtn tbtn-editorial';
        btnSettings.innerHTML = '<span class="tbtn-en">SETTINGS</span><span class="tbtn-text">系统设置</span>';
        var helpBtn = document.getElementById('btn-help');
        if (helpBtn && helpBtn.parentNode === menuEl) menuEl.insertBefore(btnSettings, helpBtn);
        else menuEl.appendChild(btnSettings);
      }
      if (!btnSettings.onclick && !btnSettings.getAttribute('data-v3-set-bound')) {
        btnSettings.setAttribute('data-v3-set-bound', '1');
        btnSettings.addEventListener('click', function () { openSettingsMode(); });
      }

      var btnLoads = document.getElementById('btn-title-loads');
      if (btnLoads) {
        var loadTxt = btnLoads.querySelector('.tbtn-text');
        if (loadTxt) loadTxt.textContent = '记忆晶体';
        var loadEn = btnLoads.querySelector('.tbtn-en');
        if (loadEn) loadEn.textContent = 'ARCHIVE';
        if (!btnLoads.onclick && !btnLoads.getAttribute('data-v3-arc-bound')) {
          btnLoads.setAttribute('data-v3-arc-bound', '1');
          btnLoads.addEventListener('click', function () { openArchiveMode(); });
        }
      }

      /* 保证 7 枚无框菜单严格按画廊韵律排序 */
      var orderedIds = ['btn-new', 'btn-title-loads', 'btn-title-chapters', 'btn-arena-title', 'btn-codex', 'btn-title-settings', 'btn-help'];
      for (var i = 0; i < orderedIds.length; i++) {
        var item = document.getElementById(orderedIds[i]);
        if (item && item.parentNode === menuEl) {
          menuEl.appendChild(item);
        }
      }
    }

    /* 雕刻唯一深海蓝宝石菱形主 CTA 区 (.v3-cta-zone) */
    var ctaZone = titleEl.querySelector('.v3-cta-zone');
    if (ctaZone) {
      var prismWrap = ctaZone.querySelector('.v3-prism-cta-wrap');
      if (!prismWrap) {
        prismWrap = document.createElement('div');
        prismWrap.className = 'v3-prism-cta-wrap';
        prismWrap.innerHTML = buildPrismWingsSvg(true) + '<div class="v3-prism-drop"></div>' + buildPrismWingsSvg(false);
        var metaRef = document.getElementById('v3-archive-meta');
        if (metaRef && metaRef.parentNode === ctaZone) ctaZone.insertBefore(prismWrap, metaRef);
        else ctaZone.appendChild(prismWrap);
      }

      var prismDrop = prismWrap.querySelector('.v3-prism-drop');
      var prismBtns = [document.getElementById('btn-continue'), document.getElementById('v3-prism-start')];
      for (var p = 0; p < prismBtns.length; p++) {
        var pb = prismBtns[p];
        if (!pb || !prismDrop) continue;
        pb.classList.add('v3-prism-cta');
        if (!pb.querySelector('.v3-prism-facets')) {
          pb.insertAdjacentHTML('afterbegin', buildPrismFacetsSvg() + '<span class="v3-prism-sheen" aria-hidden="true"></span>');
        }
        if (pb.id === 'v3-prism-start') {
          var startEn = pb.querySelector('.v3-prism-en');
          if (startEn && startEn.textContent === 'BEGIN') startEn.textContent = 'START JOURNEY';
          if (!pb.onclick && !pb.getAttribute('data-v3-start-bound')) {
            pb.setAttribute('data-v3-start-bound', '1');
            pb.addEventListener('click', function () {
              var bn = document.getElementById('btn-new');
              if (bn && typeof bn.click === 'function') bn.click();
            });
          }
        }
        if (pb.parentNode !== prismDrop) prismDrop.appendChild(pb);
      }
    }
  }

  function ensureSpatialViews(titleEl) {
    if (!titleEl) return;
    var folio = titleEl.querySelector('.v3-right-folio') || titleEl;

    /* 空间模式 1：直接填充进 index.html 已有的 #v3-view-archive */
    var arcView = document.getElementById('v3-view-archive');
    if (!arcView) {
      arcView = document.createElement('div');
      arcView.id = 'v3-view-archive';
      arcView.className = 'v3-view v3-view-archive hidden';
      arcView.setAttribute('data-view', 'archive');
      folio.appendChild(arcView);
    }
    if (!arcView.querySelector('#v3-arc-slot-code')) {
      arcView.setAttribute('aria-label', '记忆晶体档案');
      arcView.innerHTML =
        '<div class="v3-arc-head">' +
          '<h2 class="v3-arc-heading v3-archive-kicker">' +
            '<span class="v3-arc-heading-dot" aria-hidden="true"></span>' +
            '<span id="v3-arc-slot-code">ARCHIVE // MEMORY 01</span>' +
          '</h2>' +
          '<span id="v3-arc-latest" class="v3-arc-latest-tag hidden">· LATEST</span>' +
        '</div>' +
        '<div id="v3-arc-title" class="v3-arc-title is-empty">尚未刻录的记忆晶体</div>' +
        '<div id="v3-arc-meta" class="v3-arc-meta-list"></div>' +
        '<div class="v3-arc-actions">' +
          '<button type="button" id="v3-arc-load" class="v3-bare-action is-primary">' +
            '<span class="v3-act-gem" aria-hidden="true"></span>' +
            '<span>LOAD</span>' +
            '<span class="v3-act-zh">// 读取记忆</span>' +
          '</button>' +
          '<button type="button" id="v3-arc-del" class="v3-bare-action is-danger">' +
            '<span>DELETE</span>' +
            '<span class="v3-act-zh">// 清除记忆</span>' +
          '</button>' +
        '</div>' +
        '<div class="v3-arc-stepper">' +
          '<button type="button" id="v3-arc-prev" class="v3-step-btn" aria-label="上一个记忆槽位">‹ 上一晶簇</button>' +
          '<span id="v3-arc-pos" class="v3-step-pos v3-step-counter">01 / 06</span>' +
          '<button type="button" id="v3-arc-next" class="v3-step-btn" aria-label="下一个记忆槽位">下一晶簇 ›</button>' +
          '<button type="button" id="v3-arc-auto-btn" class="v3-step-btn v3-step-auto" aria-label="查看自动存档核心">AUTO</button>' +
        '</div>' +
        '<button type="button" id="v3-arc-return" class="v3-return-btn">' +
          '<span>← RETURN</span><span class="v3-ret-zh">// 返回主菜单</span>' +
        '</button>';

      arcView.querySelector('#v3-arc-load').addEventListener('click', handleArchiveLoad);
      arcView.querySelector('#v3-arc-del').addEventListener('click', handleArchiveDelete);
      arcView.querySelector('#v3-arc-prev').addEventListener('click', function () { stepOrbit(-1); });
      arcView.querySelector('#v3-arc-next').addEventListener('click', function () { stepOrbit(1); });
      arcView.querySelector('#v3-arc-auto-btn').addEventListener('click', function () {
        playSfxSafe('title_hover', { step: 0 });
        selectArchiveSlot(0);
      });
      arcView.querySelector('#v3-arc-return').addEventListener('click', function () {
        playSfxSafe('modal_close');
        returnToMain();
      });
    }

    /* 空间模式 2：直接填充进 index.html 已有的 #v3-view-settings */
    var setView = document.getElementById('v3-view-settings');
    if (!setView) {
      setView = document.createElement('div');
      setView.id = 'v3-view-settings';
      setView.className = 'v3-view v3-view-settings hidden';
      setView.setAttribute('data-view', 'settings');
      folio.appendChild(setView);
    }
    if (!setView.querySelector('#v3-set-bgm')) {
      setView.setAttribute('aria-label', '系统设置');
      setView.innerHTML =
        '<div class="v3-set-head">' +
          '<h2 class="v3-set-heading">' +
            '<span class="v3-set-heading-dot" aria-hidden="true"></span>' +
            '<span>SETTINGS</span>' +
            '<span class="v3-set-heading-zh">// 系统设置</span>' +
          '</h2>' +
          '<div class="v3-set-tabs" role="tablist">' +
            '<button type="button" class="v3-set-tab is-active" role="tab" aria-selected="true" data-v3-stab="general">' +
              '<span>GENERAL</span><span class="v3-tab-zh">// 常规设置</span>' +
            '</button>' +
            '<button type="button" class="v3-set-tab" role="tab" aria-selected="false" data-v3-stab="soundtrack">' +
              '<span>SOUNDTRACK</span><span class="v3-tab-zh">// 曲库试听</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="v3-set-body">' +
          '<div class="v3-set-pane" data-v3-pane="general">' +
            '<div class="v3-set-section">' +
              '<div class="v3-set-sec-lbl">AUDIO / 音频</div>' +
              '<div class="v3-slider-row">' +
                '<label class="v3-slider-lbl" for="v3-set-bgm">背景音乐</label>' +
                '<input id="v3-set-bgm" class="v3-hairline-range" type="range" min="0" max="100" step="1" value="50"/>' +
                '<span id="v3-set-bgm-val" class="v3-slider-val">50%</span>' +
              '</div>' +
              '<div class="v3-slider-row">' +
                '<label class="v3-slider-lbl" for="v3-set-sfx">冰晶音效</label>' +
                '<input id="v3-set-sfx" class="v3-hairline-range" type="range" min="0" max="100" step="1" value="65"/>' +
                '<span id="v3-set-sfx-val" class="v3-slider-val">65%</span>' +
              '</div>' +
              '<div class="v3-slider-row">' +
                '<label class="v3-slider-lbl" for="v3-set-bright">背景亮度</label>' +
                '<input id="v3-set-bright" class="v3-hairline-range" type="range" min="45" max="100" step="1" value="100"/>' +
                '<span id="v3-set-bright-val" class="v3-slider-val">100%</span>' +
              '</div>' +
            '</div>' +
            '<div class="v3-set-section">' +
              '<div class="v3-set-sec-lbl">DISPLAY / 演出</div>' +
              '<div class="v3-switch-row">' +
                '<span class="v3-slider-lbl">文字速度</span>' +
                '<div class="v3-bare-switcher">' +
                  '<button type="button" id="v3-speed-prev" class="v3-sw-arrow" aria-label="上一档文字速度">‹</button>' +
                  '<span id="v3-speed-val" class="v3-sw-val">舒缓</span>' +
                  '<button type="button" id="v3-speed-next" class="v3-sw-arrow" aria-label="下一档文字速度">›</button>' +
                '</div>' +
              '</div>' +
              '<div class="v3-switch-row">' +
                '<span class="v3-slider-lbl">霜尘特效</span>' +
                '<div class="v3-bare-switcher">' +
                  '<button type="button" id="v3-fx-prev" class="v3-sw-arrow" aria-label="切换霜尘特效">‹</button>' +
                  '<span id="v3-fx-val" class="v3-sw-val">开启</span>' +
                  '<button type="button" id="v3-fx-next" class="v3-sw-arrow" aria-label="切换霜尘特效">›</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="v3-set-pane hidden" data-v3-pane="soundtrack">' +
            '<div id="v3-ost-list" class="v3-ost-list"></div>' +
          '</div>' +
        '</div>' +
        '<div class="v3-set-foot">' +
          '<button type="button" id="v3-set-return" class="v3-return-btn">' +
            '<span>← RETURN</span><span class="v3-ret-zh">// 返回主菜单</span>' +
          '</button>' +
        '</div>';

      bindSettingsControls(setView);
    }
  }

  /* =========================================================================
     4. 3D 椭圆星轨记忆档案逻辑
     ========================================================================= */

  function readSaveSlots() {
    try {
      if (root && root.VNUx && typeof root.VNUx.getSlotList === 'function') {
        var list = root.VNUx.getSlotList();
        if (Array.isArray(list) && list.length) return list;
      }
    } catch (e) {}
    var fallback = [{ slotId: 0, isAuto: true, empty: true, meta: null, ts: 0 }];
    for (var i = 1; i <= 6; i++) {
      fallback.push({ slotId: i, isAuto: false, empty: true, meta: null, ts: 0 });
    }
    return fallback;
  }

  function findLatestSlot(slots) {
    var best = null;
    var bestTs = -1;
    for (var i = 0; i < slots.length; i++) {
      var sl = slots[i];
      if (!sl || sl.empty) continue;
      var ts = Number(sl.ts) || 0;
      if (!best || ts > bestTs || (ts === bestTs && !sl.isAuto && best.isAuto)) {
        best = sl;
        bestTs = ts;
      }
    }
    return best;
  }

  function layoutShardsForOrbit() {
    var anchor = document.getElementById('v3-crystal-anchor');
    if (!anchor) return;
    var slots = readSaveSlots();
    var slotById = {};
    for (var k = 0; k < slots.length; k++) {
      slotById[slots[k].slotId] = slots[k];
    }
    var latest = findLatestSlot(slots);
    st.latestSlotId = latest ? latest.slotId : -1;

    var coreBtn = document.getElementById('v3-core-gem');
    if (coreBtn) {
      coreBtn.classList.toggle('is-selected', st.selectedSlotId === 0);
    }

    var shards = anchor.querySelectorAll('.v3-shard');
    var activeX = STAGE_HALF;
    var activeY = STAGE_HALF;
    var activeHasTether = false;

    for (var i = 0; i < shards.length; i++) {
      var shardEl = shards[i];
      var sidAttr = shardEl.getAttribute('data-slot');
      if (!sidAttr) {
        shardEl.classList.remove('is-selected', 'is-occupied', 'is-empty', 'is-latest', 'is-back-arc');
        applyShardPose(shardEl, STAGE_HALF, STAGE_HALF, 0, 0.12, 0, 1, 1);
        continue;
      }

      var sid = Number(sidAttr);
      var sl = slotById[sid] || { slotId: sid, empty: true, meta: null };
      var ringIndex = sid - 1;
      var theta = ORBIT_FRONT_ANGLE + (ringIndex - st.orbitStep) * (Math.PI * 2 / 6);
      var sinT = Math.sin(theta);
      var cosT = Math.cos(theta);
      var rawX = ORBIT_RX * cosT;
      var rawY = ORBIT_RY * sinT;
      var ox = STAGE_HALF + rawX * ORBIT_COS - rawY * ORBIT_SIN;
      var oy = STAGE_HALF + rawX * ORBIT_SIN + rawY * ORBIT_COS;
      var depth = (sinT + 1) * 0.5;
      var isSel = (st.selectedSlotId === sid);
      var isBackArc = sinT < -0.45;
      var sc = (0.42 + depth * 0.25) * (isSel ? 1.12 : 1);
      var badgeSc = clamp(1 / Math.max(0.4, sc), 1.0, 2.25);
      var op = sl.empty ? (0.48 + depth * 0.34) : (0.76 + depth * 0.24);
      if (isSel) op = 1;
      var z = Math.round(12 + depth * 28) + (isSel ? 6 : 0);
      var rot = cosT * -9;

      shardEl.classList.toggle('is-empty', !!sl.empty);
      shardEl.classList.toggle('is-occupied', !sl.empty);
      shardEl.classList.toggle('is-selected', isSel);
      shardEl.classList.toggle('is-latest', st.latestSlotId === sid && !sl.empty);
      shardEl.classList.toggle('is-back-arc', isBackArc);

      applyShardPose(shardEl, ox, oy, rot, sc, op, z, badgeSc);

      if (isSel) {
        activeX = ox;
        activeY = oy;
        activeHasTether = true;
      }
    }

    updateTetherSvg(activeX, activeY, activeHasTether, st.selectedSlotId === 0);
    renderArchiveInspector(slotById[st.selectedSlotId] || { slotId: st.selectedSlotId, isAuto: st.selectedSlotId === 0, empty: true, meta: null });
  }

  function renderArchiveInspector(slot) {
    var codeEl = document.getElementById('v3-arc-slot-code');
    var latestEl = document.getElementById('v3-arc-latest');
    var titleEl = document.getElementById('v3-arc-title');
    var metaEl = document.getElementById('v3-arc-meta');
    var loadBtn = document.getElementById('v3-arc-load');
    var delBtn = document.getElementById('v3-arc-del');
    var posEl = document.getElementById('v3-arc-pos');
    var autoBtn = document.getElementById('v3-arc-auto-btn');
    if (!codeEl || !titleEl || !metaEl) return;

    var isAuto = !!(slot && (slot.isAuto || slot.slotId === 0));
    var isEmpty = !slot || !!slot.empty;
    var meta = (slot && slot.meta) || {};
    var isLatest = !isEmpty && slot.slotId === st.latestSlotId;

    codeEl.textContent = isAuto ? 'ARCHIVE // AUTO CORE' : ('ARCHIVE // MEMORY 0' + slot.slotId);
    if (latestEl) latestEl.classList.toggle('hidden', !isLatest);
    if (posEl) posEl.textContent = isAuto ? 'AUTO' : ('0' + slot.slotId + ' / 06');
    if (autoBtn) autoBtn.classList.toggle('is-active', isAuto);

    titleEl.classList.toggle('is-empty', isEmpty);
    if (isEmpty) {
      titleEl.textContent = isAuto ? '尚未生成自动记忆' : '尚未刻录的记忆晶体';
      metaEl.innerHTML = '<p class="v3-arc-empty-copy">此晶簇当前为空白状态。进入旅程后，可随时于综合面板中刻录时空片段，或由章节节点自动写入核心。</p>';
    } else {
      titleEl.textContent = meta.chapterTitle || meta.locName || '维斯特利亚旅途片段';
      var rows = [];
      if (meta.savedAt) rows.push('<div class="v3-arc-meta-row"><span class="v3-arc-meta-lbl">保存时间</span><span>' + escapeHtml(meta.savedAt) + '</span></div>');
      var progressParts = [meta.name || '希尔维亚', meta.ageStr || '0岁', 'Lv.' + (meta.lv || 1)];
      rows.push('<div class="v3-arc-meta-row"><span class="v3-arc-meta-lbl">角色进度</span><span>' + escapeHtml(progressParts.join(' · ')) + '</span></div>');
      var stageParts = [meta.phaseName, meta.locName].filter(Boolean);
      if (stageParts.length) {
        rows.push('<div class="v3-arc-meta-row"><span class="v3-arc-meta-lbl">所处阶段</span><span>' + escapeHtml(stageParts.join(' · ')) + '</span></div>');
      }
      metaEl.innerHTML = rows.join('');
    }

    if (loadBtn) {
      loadBtn.disabled = isEmpty;
      loadBtn.classList.toggle('hidden', isEmpty);
    }
    if (delBtn) {
      delBtn.classList.toggle('hidden', isEmpty || isAuto);
      if (st.pendingDeleteSlot !== slot.slotId) {
        clearPendingDelete();
      }
    }
  }

  function selectArchiveSlot(slotId) {
    clearPendingDelete();
    var sid = Number(slotId);
    if (sid >= 1 && sid <= 6) {
      var targetIdx = sid - 1;
      var curMod = ((st.orbitStep % 6) + 6) % 6;
      var diff = targetIdx - curMod;
      if (diff > 3) diff -= 6;
      if (diff < -3) diff += 6;
      st.orbitStep += diff;
      st.selectedSlotId = sid;
    } else {
      st.selectedSlotId = 0;
    }
    if (st.mode === 'archive') layoutShardsForOrbit();
  }

  function stepOrbit(dir) {
    playSfxSafe('title_hover', { step: dir > 0 ? 2 : 1 });
    if (st.selectedSlotId === 0) {
      selectArchiveSlot(dir > 0 ? 1 : 6);
      return;
    }
    var next = st.selectedSlotId + (dir > 0 ? 1 : -1);
    if (next > 6) next = 1;
    if (next < 1) next = 6;
    selectArchiveSlot(next);
  }

  function handleArchiveLoad() {
    var slots = readSaveSlots();
    var hit = null;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].slotId === st.selectedSlotId) { hit = slots[i]; break; }
    }
    if (!hit || hit.empty) return;
    clearPendingDelete();
    if (root && root.VNUx && typeof root.VNUx.loadFromSlot === 'function') {
      var res = root.VNUx.loadFromSlot(hit.slotId);
      if (res && res.ok) {
        setMode('main', { silent: true });
      }
    }
  }

  function handleArchiveDelete() {
    var sid = st.selectedSlotId;
    if (!(sid >= 1 && sid <= 6)) return;
    var delBtn = document.getElementById('v3-arc-del');
    if (st.pendingDeleteSlot === sid) {
      clearPendingDelete();
      if (root && root.VNUx && typeof root.VNUx.deleteSlot === 'function') {
        root.VNUx.deleteSlot(sid);
      }
      playSfxSafe('glass_tap');
      syncArchiveMeta();
      layoutShardsForOrbit();
      return;
    }
    clearPendingDelete();
    st.pendingDeleteSlot = sid;
    if (delBtn) {
      delBtn.classList.add('is-confirming');
      delBtn.innerHTML = '<span>CONFIRM DELETE</span><span class="v3-act-zh">// 再次点击确认清除</span>';
    }
    playSfxSafe('glass_tap');
    st.pendingDeleteT = setTimeout(clearPendingDelete, 3500);
  }

  /* =========================================================================
     5. 无框平移系统设置与曲库试听逻辑
     ========================================================================= */

  function readLiveSettings() {
    var res = { bgm: 0.5, sfx: 0.65, bright: 1, typeSpeed: 'normal', fxEnabled: true };
    try {
      if (root && root.VNUx && typeof root.VNUx.getPrefs === 'function') {
        var p = root.VNUx.getPrefs();
        if (p) {
          if (typeof p.bgmVol === 'number') res.bgm = clamp(p.bgmVol, 0, 1);
          if (typeof p.sfxVol === 'number') res.sfx = clamp(p.sfxVol, 0, 1);
          if (typeof p.bright === 'number') res.bright = clamp(p.bright, 0.45, 1.0);
          if (p.typeSpeed) res.typeSpeed = String(p.typeSpeed);
          if (typeof p.fxEnabled === 'boolean') res.fxEnabled = p.fxEnabled;
        }
      }
    } catch (e) {}
    try {
      if (root && typeof root.bgmGetVolume === 'function') {
        var bv = Number(root.bgmGetVolume());
        if (!isNaN(bv)) res.bgm = clamp(bv, 0, 1);
      }
      if (root && typeof root.sfxGetVolume === 'function') {
        var sv = Number(root.sfxGetVolume());
        if (!isNaN(sv)) res.sfx = clamp(sv, 0, 1);
      }
      if (root && typeof root.getTypeSpeed === 'function') {
        var ts = root.getTypeSpeed();
        if (ts) res.typeSpeed = String(ts);
      }
    } catch (e) {}
    return res;
  }

  function updateSliderVisual(inputEl, valEl, valPct, minPct, maxPct) {
    if (!inputEl) return;
    inputEl.value = String(valPct);
    var ratio = ((valPct - minPct) / Math.max(1, maxPct - minPct)) * 100;
    inputEl.style.setProperty('--v3-pct', clamp(ratio, 0, 100).toFixed(1) + '%');
    if (valEl) valEl.textContent = valPct + '%';
  }

  function syncSettingsDOM() {
    var s = readLiveSettings();
    updateSliderVisual(document.getElementById('v3-set-bgm'), document.getElementById('v3-set-bgm-val'), Math.round(s.bgm * 100), 0, 100);
    updateSliderVisual(document.getElementById('v3-set-sfx'), document.getElementById('v3-set-sfx-val'), Math.round(s.sfx * 100), 0, 100);
    updateSliderVisual(document.getElementById('v3-set-bright'), document.getElementById('v3-set-bright-val'), Math.round(clamp(s.bright, 0.45, 1.0) * 100), 45, 100);

    var speedEl = document.getElementById('v3-speed-val');
    if (speedEl) {
      var found = TYPE_SPEED_OPTS[2];
      for (var i = 0; i < TYPE_SPEED_OPTS.length; i++) {
        if (TYPE_SPEED_OPTS[i].value === s.typeSpeed) { found = TYPE_SPEED_OPTS[i]; break; }
      }
      speedEl.textContent = found.label;
    }

    var fxEl = document.getElementById('v3-fx-val');
    if (fxEl) fxEl.textContent = s.fxEnabled ? '开启' : '关闭';

    renderSoundtrackRows();
  }

  function applySettingValue(kind, val) {
    if (kind === 'bgm') {
      var v = clamp(Number(val), 0, 1);
      try { if (root && root.VNUx && root.VNUx.setPref) root.VNUx.setPref('bgmVol', v); } catch (e) {}
      try { if (root && typeof root.setSetting === 'function') root.setSetting('bgm', v); } catch (e) {}
      try { if (root && typeof root.bgmSetVolume === 'function') root.bgmSetVolume(v); } catch (e) {}
    } else if (kind === 'sfx') {
      var sv = clamp(Number(val), 0, 1);
      try { if (root && root.VNUx && root.VNUx.setPref) root.VNUx.setPref('sfxVol', sv); } catch (e) {}
      try { if (root && typeof root.setSetting === 'function') root.setSetting('sfx', sv); } catch (e) {}
      try { if (root && typeof root.sfxSetVolume === 'function') root.sfxSetVolume(sv); } catch (e) {}
      var now = Date.now();
      if (now - st.lastSfxPingAt > 180) {
        st.lastSfxPingAt = now;
        playSfxSafe('glass_tap');
      }
    } else if (kind === 'bright') {
      var bv = clamp(Number(val), 0.45, 1.0);
      try { if (root && root.VNUx && root.VNUx.setPref) root.VNUx.setPref('bright', bv); } catch (e) {}
      try { if (root && typeof root.setSetting === 'function') root.setSetting('bright', bv); } catch (e) {}
    } else if (kind === 'typeSpeed') {
      try { if (root && root.VNUx && root.VNUx.setPref) root.VNUx.setPref('typeSpeed', val); } catch (e) {}
      try { if (root && typeof root.setTypeSpeed === 'function') root.setTypeSpeed(val); } catch (e) {}
      playSfxSafe('glass_tap');
    } else if (kind === 'fxEnabled') {
      var on = !!val;
      try { if (root && root.VNUx && root.VNUx.setPref) root.VNUx.setPref('fxEnabled', on); } catch (e) {}
      try { if (root && root.AmbientFX && root.AmbientFX.setEnabled) root.AmbientFX.setEnabled(on); } catch (e) {}
      if (on) startDustLoop();
      else {
        stopDustLoop();
        var c = document.getElementById('v3-dust-canvas');
        if (c) { try { var cx = c.getContext('2d'); if (cx) cx.clearRect(0, 0, c.width, c.height); } catch (e) {} }
      }
      playSfxSafe('glass_tap');
    }
  }

  function renderSoundtrackRows() {
    var listEl = document.getElementById('v3-ost-list');
    if (!listEl) return;
    var bgmFiles = (root && root.BGM_FILES) || {};
    var html = [];
    for (var i = 0; i < SOUNDTRACK_CATALOG.length; i++) {
      var item = SOUNDTRACK_CATALOG[i];
      if (Object.keys(bgmFiles).length && !bgmFiles[item.key]) continue;
      var playing = st.auditionTrackKey === item.key;
      html.push(
        '<button type="button" class="v3-ost-row' + (playing ? ' is-playing' : '') + '" data-v3-track="' + escapeHtml(item.key) + '">' +
          '<span class="v3-ost-left">' +
            '<span class="v3-ost-gem" aria-hidden="true"></span>' +
            '<span class="v3-ost-title">' + escapeHtml(item.title) + '</span>' +
            '<span class="v3-ost-mood">' + escapeHtml(item.mood) + '</span>' +
          '</span>' +
          '<span class="v3-ost-state">' + (playing ? 'STOP' : 'PLAY') + '</span>' +
        '</button>'
      );
    }
    listEl.innerHTML = html.join('');
    var rows = listEl.querySelectorAll('[data-v3-track]');
    for (var j = 0; j < rows.length; j++) {
      rows[j].addEventListener('click', function () {
        toggleSoundtrackAudition(this.getAttribute('data-v3-track'));
      });
    }
  }

  function toggleSoundtrackAudition(trackKey) {
    if (!trackKey) return;
    if (st.auditionTrackKey === trackKey) {
      st.auditionTrackKey = null;
      st.auditionTrackTitle = '';
      try { if (root && typeof root.bgmStop === 'function') root.bgmStop(true); } catch (e) {}
      renderSoundtrackRows();
      syncTitleAudioButton(false);
      return;
    }
    var meta = null;
    for (var i = 0; i < SOUNDTRACK_CATALOG.length; i++) {
      if (SOUNDTRACK_CATALOG[i].key === trackKey) { meta = SOUNDTRACK_CATALOG[i]; break; }
    }
    st.auditionTrackKey = trackKey;
    st.auditionTrackTitle = meta ? meta.title : trackKey;
    try {
      if (root && typeof root.bgmUnlock === 'function') root.bgmUnlock();
      if (root && typeof root.bgmPlay === 'function') root.bgmPlay(trackKey, { fade: false });
    } catch (e) {}
    renderSoundtrackRows();
    syncTitleAudioButton(false);
  }

  function switchSettingsTab(tabName) {
    st.settingsTab = tabName === 'soundtrack' ? 'soundtrack' : 'general';
    var panel = document.getElementById('v3-view-settings');
    if (!panel) return;
    var tabs = panel.querySelectorAll('[data-v3-stab]');
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i].getAttribute('data-v3-stab') === st.settingsTab;
      tabs[i].classList.toggle('is-active', active);
      tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    var panes = panel.querySelectorAll('[data-v3-pane]');
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle('hidden', panes[j].getAttribute('data-v3-pane') !== st.settingsTab);
    }
    if (st.settingsTab === 'soundtrack') renderSoundtrackRows();
  }

  function bindSettingsControls(panel) {
    var tabs = panel.querySelectorAll('[data-v3-stab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        playSfxSafe('glass_tap');
        switchSettingsTab(this.getAttribute('data-v3-stab'));
      });
    }

    var bgmIn = panel.querySelector('#v3-set-bgm');
    var bgmVal = panel.querySelector('#v3-set-bgm-val');
    if (bgmIn) {
      bgmIn.addEventListener('input', function () {
        var pct = clamp(Number(bgmIn.value) || 0, 0, 100);
        updateSliderVisual(bgmIn, bgmVal, pct, 0, 100);
        applySettingValue('bgm', pct / 100);
      });
    }

    var sfxIn = panel.querySelector('#v3-set-sfx');
    var sfxVal = panel.querySelector('#v3-set-sfx-val');
    if (sfxIn) {
      sfxIn.addEventListener('input', function () {
        var pct = clamp(Number(sfxIn.value) || 0, 0, 100);
        updateSliderVisual(sfxIn, sfxVal, pct, 0, 100);
        applySettingValue('sfx', pct / 100);
      });
    }

    var brIn = panel.querySelector('#v3-set-bright');
    var brVal = panel.querySelector('#v3-set-bright-val');
    if (brIn) {
      brIn.addEventListener('input', function () {
        var pct = clamp(Number(brIn.value) || 100, 45, 100);
        updateSliderVisual(brIn, brVal, pct, 45, 100);
        applySettingValue('bright', pct / 100);
      });
    }

    var stepTypeSpeed = function (delta) {
      var s = readLiveSettings();
      var idx = 2;
      for (var k = 0; k < TYPE_SPEED_OPTS.length; k++) {
        if (TYPE_SPEED_OPTS[k].value === s.typeSpeed) { idx = k; break; }
      }
      idx = (idx + delta + TYPE_SPEED_OPTS.length) % TYPE_SPEED_OPTS.length;
      applySettingValue('typeSpeed', TYPE_SPEED_OPTS[idx].value);
      syncSettingsDOM();
    };
    var spPrev = panel.querySelector('#v3-speed-prev');
    var spNext = panel.querySelector('#v3-speed-next');
    if (spPrev) spPrev.addEventListener('click', function () { stepTypeSpeed(-1); });
    if (spNext) spNext.addEventListener('click', function () { stepTypeSpeed(1); });

    var toggleFx = function () {
      var s = readLiveSettings();
      applySettingValue('fxEnabled', !s.fxEnabled);
      syncSettingsDOM();
    };
    var fxPrev = panel.querySelector('#v3-fx-prev');
    var fxNext = panel.querySelector('#v3-fx-next');
    if (fxPrev) fxPrev.addEventListener('click', toggleFx);
    if (fxNext) fxNext.addEventListener('click', toggleFx);

    var retBtn = panel.querySelector('#v3-set-return');
    if (retBtn) {
      retBtn.addEventListener('click', function () {
        playSfxSafe('modal_close');
        returnToMain();
      });
    }
  }

  /* =========================================================================
     6. 空间模式切换 (main / archive / settings) + 状态同步
     ========================================================================= */

  function updateFooterHintsForMode(mode) {
    var titleEl = getTitle();
    if (!titleEl) return;
    var hints = titleEl.querySelector('.v3-key-hints');
    if (!hints) return;
    if (mode === 'archive') {
      hints.textContent = '←→ 旋转星轨   Enter 读取记忆   Esc 返回';
    } else if (mode === 'settings') {
      hints.textContent = '滑块与选项即时生效   Esc 返回主菜单';
    } else {
      hints.textContent = '↑↓ 选择   Enter 确认   Esc 返回';
    }
  }

  function setMode(nextMode, opts) {
    var titleEl = getTitle();
    if (!titleEl) return st.mode;
    var mode = (nextMode === 'archive' || nextMode === 'settings') ? nextMode : 'main';
    st.mode = mode;
    titleEl.setAttribute('data-title-mode', mode);
    var stageEl = document.getElementById('v3-title-stage');
    if (stageEl) stageEl.setAttribute('data-title-mode', mode);

    var anchor = document.getElementById('v3-crystal-anchor');
    if (anchor) anchor.setAttribute('aria-hidden', mode === 'archive' ? 'false' : 'true');

    var mainView = titleEl.querySelector('.v3-view-main');
    var arcView = document.getElementById('v3-view-archive');
    var setView = document.getElementById('v3-view-settings');
    if (mainView) mainView.classList.toggle('hidden', mode !== 'main');
    if (arcView) arcView.classList.toggle('hidden', mode !== 'archive');
    if (setView) setView.classList.toggle('hidden', mode !== 'settings');

    updateFooterHintsForMode(mode);

    if (mode === 'archive') {
      clearPendingDelete();
      var slots = readSaveSlots();
      var latest = findLatestSlot(slots);
      var pick = latest ? latest.slotId : 1;
      if (pick >= 1 && pick <= 6) {
        st.selectedSlotId = pick;
        st.orbitStep = pick - 1;
      } else {
        st.selectedSlotId = 0;
        st.orbitStep = 0;
      }
      layoutShardsForOrbit();
      if (!opts || !opts.silent) playSfxSafe('page_open');
    } else if (mode === 'settings') {
      clearPendingDelete();
      layoutShardsForCluster();
      syncSettingsDOM();
      if (!opts || !opts.silent) playSfxSafe('page_open');
    } else {
      clearPendingDelete();
      layoutShardsForCluster();
      syncArchiveMeta();
    }
    return st.mode;
  }

  function openArchiveMode() {
    if (!hasDom()) return api;
    ensureCrystalStage(getTitle());
    ensureSpatialViews(getTitle());
    setMode('archive');
    return api;
  }

  function openSettingsMode(tabName) {
    if (!hasDom()) return api;
    ensureCrystalStage(getTitle());
    ensureSpatialViews(getTitle());
    if (tabName) switchSettingsTab(tabName);
    setMode('settings');
    return api;
  }

  function returnToMain(opts) {
    if (!hasDom()) return api;
    setMode('main', opts);
    return api;
  }

  function getMode() {
    return st.mode;
  }

  function setFocusedMenuItem(targetBtn) {
    var titleEl = getTitle();
    if (!titleEl) return;
    var items = titleEl.querySelectorAll('.title-menu .tbtn.tbtn-editorial:not(.hidden)');
    var visible = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].style && items[i].style.display === 'none') continue;
      visible.push(items[i]);
    }
    if (!visible.length) return;
    var picked = null;
    if (targetBtn && visible.indexOf(targetBtn) >= 0) {
      picked = targetBtn;
    } else if (st.focusedMenuId) {
      for (var k = 0; k < visible.length; k++) {
        if (visible[k].id === st.focusedMenuId) { picked = visible[k]; break; }
      }
    }
    if (!picked) picked = visible[0];
    st.focusedMenuId = picked.id || null;
    for (var j = 0; j < visible.length; j++) {
      var isCur = (visible[j] === picked);
      if (visible[j].classList.contains('is-focus') !== isCur) {
        visible[j].classList.toggle('is-focus', isCur);
      }
    }
  }

  function indexMenuItems() {
    var titleEl = getTitle();
    if (!titleEl) return 0;
    var nodes = titleEl.querySelectorAll('.title-menu .tbtn:not(.hidden)');
    var idx = 0;
    for (var i = 0; i < nodes.length; i++) {
      var btn = nodes[i];
      if (btn.style && btn.style.display === 'none') continue;
      var val = String(idx++);
      if (btn.style.getPropertyValue('--i') !== val) btn.style.setProperty('--i', val);
    }
    setFocusedMenuItem(null);
    return idx;
  }

  function syncArchiveMeta() {
    if (!hasDom()) return '';
    var btnCont = document.getElementById('btn-continue');
    var startPrism = document.getElementById('v3-prism-start');
    var hasContinue = !!(btnCont && !btnCont.classList.contains('hidden') && (!btnCont.style || btnCont.style.display !== 'none'));
    if (startPrism) {
      startPrism.classList.toggle('hidden', hasContinue);
    }

    var metaEl = document.getElementById('v3-archive-meta');
    if (!metaEl) return '';

    var slots = readSaveSlots();
    var latest = findLatestSlot(slots);
    var text = 'CHRONICLE // 维斯特利亚公爵领 · 卷一至卷四';
    if (latest && latest.meta) {
      var tag = latest.isAuto ? '自动记忆' : ('槽位 0' + latest.slotId);
      var m = latest.meta;
      var parts = [tag, m.ageStr, m.phaseName || m.locName].filter(Boolean);
      text = 'ARCHIVE // ' + parts.join(' · ');
    }
    if (metaEl.textContent !== text) metaEl.textContent = text;
    return text;
  }

  function resolveMuteState(btn, preferDom) {
    if (preferDom && btn) {
      return btn.classList.contains('is-muted') || btn.getAttribute('aria-pressed') === 'true';
    }
    try {
      if (root && typeof root.isMuted === 'function') return !!root.isMuted();
    } catch (e) {}
    if (btn) {
      return btn.classList.contains('is-muted') || btn.getAttribute('aria-pressed') === 'true';
    }
    return false;
  }

  function syncTitleAudioButton(preferDom) {
    if (!hasDom()) return false;
    var btn = document.getElementById('btn-title-mute');
    if (!btn) return false;
    var isM = resolveMuteState(btn, preferDom);
    var wantPressed = isM ? 'true' : 'false';
    var trackLabel = st.auditionTrackTitle || '冰晶协奏';
    var wantText = isM ? 'BGM // 已静音' : ('BGM // ' + trackLabel);
    var wantTitle = isM ? '当前已静音（点击开启声音）' : ('正在播放：' + trackLabel + '（点击静音）');

    if (btn.classList.contains('is-muted') !== isM) {
      btn.classList.toggle('is-muted', isM);
    }
    if (btn.getAttribute('aria-pressed') !== wantPressed) {
      btn.setAttribute('aria-pressed', wantPressed);
    }
    if (btn.getAttribute('aria-label') !== wantTitle) {
      btn.setAttribute('aria-label', wantTitle);
    }
    if (btn.title !== wantTitle) {
      btn.title = wantTitle;
    }

    var labelEl = btn.querySelector('.v3-bgm-label');
    if (!labelEl) {
      var spans = btn.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        if (!spans[i].classList.contains('v3-bgm-eq') && !spans[i].classList.contains('v3-eq')) {
          labelEl = spans[i];
          break;
        }
      }
    }
    if (labelEl && labelEl.textContent !== wantText) {
      labelEl.textContent = wantText;
    }
    return isM;
  }

  /* =========================================================================
     7. V3 瓷白断裂星盘章节报幕帘 (#card) 与退幕遮罩 (.card-exit-veil)
     ========================================================================= */

  function resolveCardWatermarkGlyph(volText, titleText) {
    var vol = String(volText || '').trim();
    var ttl = String(titleText || '').trim();
    var combined = vol + ' ' + ttl;
    if (/终幕|终章|尾声|EPILOGUE|FINALE/i.test(combined)) return 'FIN';
    if (/序章|PROLOGUE/i.test(combined)) return '0';
    if (/第四卷|VOL\.?\s*IV\b|VOL\.?\s*4\b/i.test(vol)) return 'IV';
    if (/第三卷|VOL\.?\s*III\b|VOL\.?\s*3\b/i.test(vol)) return 'III';
    if (/第二卷|VOL\.?\s*II\b|VOL\.?\s*2\b/i.test(vol)) return 'II';
    if (/第一卷|VOL\.?\s*I\b|VOL\.?\s*1\b/i.test(vol)) return 'I';
    var romanMatch = combined.match(/\b(IV|III|II|I|V)\b/);
    if (romanMatch) return romanMatch[1];
    return 'I';
  }

  function buildCardAstrolabeMarkup() {
    return '' +
      '<svg class="card-astrolabe-svg" viewBox="0 0 600 600" fill="none" aria-hidden="true">' +
        '<g class="card-astrolabe-outer">' +
          '<path d="M 118 176 A 226 226 0 0 1 428 112" stroke="#9aa8bf" stroke-width="0.9" stroke-linecap="round"/>' +
          '<path d="M 498 202 A 226 226 0 0 1 452 466" stroke="#9aa8bf" stroke-width="0.85" stroke-linecap="round"/>' +
          '<path d="M 382 508 A 226 226 0 0 1 114 426" stroke="#9aa8bf" stroke-width="0.9" stroke-linecap="round"/>' +
          '<path d="M 80 356 A 226 226 0 0 1 88 228" stroke="#b0bdd2" stroke-width="0.8" stroke-dasharray="3 8"/>' +
          '<path d="M 300 62 Q 300 74 312 74 Q 300 74 300 86 Q 300 74 288 74 Q 300 74 300 62 Z" fill="#1c4cb8" fill-opacity="0.54"/>' +
          '<circle cx="300" cy="74" r="1.5" fill="#fafbfd"/>' +
          '<path d="M 300 514 Q 300 526 312 526 Q 300 526 300 538 Q 300 526 288 526 Q 300 526 300 514 Z" fill="#1c4cb8" fill-opacity="0.54"/>' +
          '<circle cx="300" cy="526" r="1.5" fill="#fafbfd"/>' +
          '<path d="M 74 289 Q 74 300 85 300 Q 74 300 74 311 Q 74 300 63 300 Q 74 300 74 289 Z" fill="#3b82f6" fill-opacity="0.52"/>' +
          '<circle cx="74" cy="300" r="1.4" fill="#fafbfd"/>' +
          '<path d="M 526 289 Q 526 300 537 300 Q 526 300 526 311 Q 526 300 515 300 Q 526 300 526 289 Z" fill="#3b82f6" fill-opacity="0.52"/>' +
          '<circle cx="526" cy="300" r="1.4" fill="#fafbfd"/>' +
        '</g>' +
        '<g class="card-astrolabe-inner">' +
          '<path d="M 164 218 A 164 164 0 0 1 398 168" stroke="#b5c2d6" stroke-width="0.8" stroke-dasharray="2.5 7"/>' +
          '<path d="M 436 382 A 164 164 0 0 1 202 432" stroke="#b5c2d6" stroke-width="0.8" stroke-dasharray="2.5 7"/>' +
          '<polyline points="282,74 282,42 264,24" stroke="#8f9eb6" stroke-width="0.8"/>' +
          '<circle cx="262" cy="22" r="2.4" fill="#fafbfd" stroke="#1b2333" stroke-width="0.85"/>' +
          '<polyline points="318,526 318,558 336,576" stroke="#8f9eb6" stroke-width="0.8"/>' +
          '<circle cx="338" cy="578" r="2.4" fill="#1c4cb8" fill-opacity="0.72"/>' +
        '</g>' +
      '</svg>';
  }

  function ensureCardBackdrop() {
    if (!hasDom()) return null;
    var cardEl = document.getElementById('card');
    if (!cardEl) return null;
    var backdrop = cardEl.querySelector('.card-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'card-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.innerHTML =
        '<div class="card-emblem-stage">' +
          buildCardAstrolabeMarkup() +
          '<div class="card-watermark">' +
            '<span class="card-watermark-roman">I</span>' +
          '</div>' +
        '</div>' +
        '<span class="card-watermark-latin">HOUSE OF VESTERIA · CHRONICLE</span>';
      cardEl.insertBefore(backdrop, cardEl.firstChild);
    }
    syncCardWatermark();
    return backdrop;
  }

  function syncCardWatermark() {
    if (!hasDom()) return;
    var cardEl = document.getElementById('card');
    if (!cardEl) return;
    var romanEl = cardEl.querySelector('.card-watermark-roman');
    if (!romanEl) return;
    var volEl = document.getElementById('card-vol');
    var titleEl = document.getElementById('card-t');
    var glyph = resolveCardWatermarkGlyph(volEl ? volEl.textContent : '', titleEl ? titleEl.textContent : '');
    if (romanEl.textContent !== glyph) {
      romanEl.textContent = glyph;
    }
  }

  function playCardExitVeil() {
    if (!hasDom() || isJsdom() || !document.body) return null;
    if (!st.mqlMotion) readMedia();
    if (st.reduced) return null;
    var veil = document.createElement('div');
    veil.className = 'card-exit-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
    var done = false;
    var timer = 0;
    var clean = function () {
      if (done) return;
      done = true;
      if (timer) { clearTimeout(timer); timer = 0; }
      if (veil.parentNode) veil.parentNode.removeChild(veil);
    };
    veil.addEventListener('animationend', clean, { once: true });
    timer = setTimeout(clean, VEIL_MS + 60);
    return veil;
  }

  /* =========================================================================
     8. 开场水墨霜雾绽放重播与即时跳过
     ========================================================================= */

  function skipOpeningImmediately() {
    if (st.opening !== 'playing') return;
    clearTimers();
    st.opening = 'ready';
    var titleEl = getTitle();
    if (titleEl) titleEl.setAttribute('data-opening', 'ready');
    if (Math.abs(st.tx - st.cx) > SETTLE_EPS || Math.abs(st.ty - st.cy) > SETTLE_EPS) kickParallax();
  }

  function replay() {
    clearTimers();
    indexMenuItems();
    syncArchiveMeta();
    syncTitleAudioButton(false);
    var titleEl = getTitle();
    if (!titleEl) return api;
    readMedia();
    resetParallax(true);

    if (isJsdom() || st.reduced || !isTitleVis()) {
      st.opening = 'ready';
      titleEl.setAttribute('data-opening', 'ready');
      startDustLoop();
      return api;
    }

    st.opening = 'playing';
    titleEl.removeAttribute('data-opening');
    void titleEl.offsetWidth;
    titleEl.setAttribute('data-opening', 'playing');
    startDustLoop();

    st.readyT = setTimeout(function () {
      st.readyT = 0;
      st.opening = 'ready';
      var el = getTitle();
      if (el) el.setAttribute('data-opening', 'ready');
      if (Math.abs(st.tx - st.cx) > SETTLE_EPS || Math.abs(st.ty - st.cy) > SETTLE_EPS) kickParallax();
    }, OPENING_MS);

    return api;
  }

  function getParallax() {
    return (isJsdom() || st.reduced || !st.fine || !isTitleVis()) ? { x: 0, y: 0 } : { x: st.cx, y: st.cy };
  }

  /* =========================================================================
     9. 事件监听、键盘导航（↑↓ / ←→ / Enter / Esc）与观察器
     ========================================================================= */

  function getFocusableMainButtons() {
    var titleEl = getTitle();
    if (!titleEl) return [];
    var all = titleEl.querySelectorAll('.v3-view-main button');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      if (!b.disabled && !b.classList.contains('hidden') && (!b.style || b.style.display !== 'none')) {
        out.push(b);
      }
    }
    return out;
  }

  function attachListeners() {
    var titleEl = getTitle();
    if (!titleEl) return;

    if (typeof MutationObserver === 'function') {
      var menuEl = titleEl.querySelector('.title-menu');
      if (menuEl) {
        st.menuObs = new MutationObserver(function () {
          indexMenuItems();
          syncArchiveMeta();
        });
        st.menuObs.observe(menuEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      st.titleObs = new MutationObserver(function () {
        if (!isTitleVis()) {
          clearTimers();
          resetParallax(true);
          stopDustLoop();
          if (st.opening === 'playing') {
            st.opening = 'ready';
            titleEl.setAttribute('data-opening', 'ready');
          }
          if (st.mode !== 'main') {
            setMode('main', { silent: true });
          }
        } else {
          indexMenuItems();
          syncArchiveMeta();
          syncTitleAudioButton(false);
          startDustLoop();
        }
      });
      st.titleObs.observe(titleEl, { attributes: true, attributeFilter: ['class'] });

      var btnCont = document.getElementById('btn-continue');
      if (btnCont) {
        st.continueObs = new MutationObserver(syncArchiveMeta);
        st.continueObs.observe(btnCont, { attributes: true, attributeFilter: ['class', 'style'] });
      }

      var muteBtn = document.getElementById('btn-title-mute');
      if (muteBtn) {
        st.muteObs = new MutationObserver(function () {
          syncTitleAudioButton(true);
        });
        st.muteObs.observe(muteBtn, { attributes: true, attributeFilter: ['class', 'aria-pressed'] });
      }

      var cardEl = document.getElementById('card');
      if (cardEl) {
        st.cardObs = new MutationObserver(ensureCardBackdrop);
        st.cardObs.observe(cardEl, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true, characterData: true });
      }
    }

    var menuElForFocus = titleEl.querySelector('.title-menu');
    if (menuElForFocus) {
      var onMenuPointerOver = function (ev) {
        var btn = ev && ev.target && ev.target.closest ? ev.target.closest('.tbtn.tbtn-editorial') : null;
        if (btn && menuElForFocus.contains(btn)) setFocusedMenuItem(btn);
      };
      var onMenuFocusIn = function (ev) {
        var btn = ev && ev.target && ev.target.closest ? ev.target.closest('.tbtn.tbtn-editorial') : null;
        if (btn && menuElForFocus.contains(btn)) setFocusedMenuItem(btn);
      };
      menuElForFocus.addEventListener('mouseover', onMenuPointerOver);
      menuElForFocus.addEventListener('focusin', onMenuFocusIn);
      st.cleanups.push(function () {
        menuElForFocus.removeEventListener('mouseover', onMenuPointerOver);
        menuElForFocus.removeEventListener('focusin', onMenuFocusIn);
      });
    }

    var onMuteClick = function (ev) {
      var hit = ev && ev.target && ev.target.closest ? ev.target.closest('#btn-title-mute, #btn-mute') : null;
      if (!hit) return;
      setTimeout(function () { syncTitleAudioButton(false); }, 0);
    };
    document.addEventListener('click', onMuteClick);
    st.cleanups.push(function () { document.removeEventListener('click', onMuteClick); });

    var onKeyDown = function (ev) {
      if (!isTitleVis()) return;
      if (isAnyModalBlocking()) return;
      var tgt = ev.target;
      var tag = tgt && tgt.tagName ? tgt.tagName.toUpperCase() : '';
      if (tag === 'INPUT' && tgt.type !== 'range') return;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (tgt && tgt.isContentEditable)) return;

      if (st.opening === 'playing' && (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'Escape')) {
        skipOpeningImmediately();
        ev.preventDefault();
        return;
      }

      if (ev.key === 'Escape' && st.mode !== 'main') {
        ev.preventDefault();
        if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        playSfxSafe('modal_close');
        returnToMain();
        return;
      }

      if (st.mode === 'archive') {
        if (ev.key === 'ArrowLeft') {
          ev.preventDefault();
          stepOrbit(-1);
        } else if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          stepOrbit(1);
        } else if (ev.key === 'Enter' && tag !== 'BUTTON') {
          ev.preventDefault();
          handleArchiveLoad();
        }
        return;
      }

      if (st.mode === 'main') {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          var btns = getFocusableMainButtons();
          if (!btns.length) return;
          ev.preventDefault();
          var curIdx = btns.indexOf(document.activeElement);
          if (curIdx < 0 && st.focusedMenuId) {
            for (var fi = 0; fi < btns.length; fi++) {
              if (btns[fi].id === st.focusedMenuId) { curIdx = fi; break; }
            }
          }
          var nextIdx = curIdx < 0
            ? (ev.key === 'ArrowDown' ? 0 : btns.length - 1)
            : (curIdx + (ev.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
          btns[nextIdx].focus();
          if (btns[nextIdx].classList.contains('tbtn-editorial')) {
            setFocusedMenuItem(btns[nextIdx]);
          }
          playSfxSafe('title_hover', { step: nextIdx });
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    st.cleanups.push(function () { document.removeEventListener('keydown', onKeyDown, true); });

    if (isJsdom()) return;

    var onAnyOpeningPointer = function () {
      if (st.opening === 'playing') skipOpeningImmediately();
    };
    titleEl.addEventListener('pointerdown', onAnyOpeningPointer, { passive: true });
    st.cleanups.push(function () { titleEl.removeEventListener('pointerdown', onAnyOpeningPointer); });

    var bindMql = function (mql, fn) {
      if (!mql) return;
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', fn);
        st.cleanups.push(function () { mql.removeEventListener('change', fn); });
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(fn);
        st.cleanups.push(function () { mql.removeListener(fn); });
      }
    };
    bindMql(st.mqlMotion, function (ev) {
      st.reduced = !!(ev ? ev.matches : st.mqlMotion.matches);
      if (st.reduced) {
        clearTimers(); resetParallax(true); stopDustLoop();
        st.opening = 'ready';
        var el = getTitle(); if (el) el.setAttribute('data-opening', 'ready');
      } else {
        startDustLoop();
      }
    });
    bindMql(st.mqlPointer, function (ev) {
      st.fine = !!(ev ? ev.matches : st.mqlPointer.matches);
      if (!st.fine) resetParallax(true);
    });

    var onMove = function (ev) {
      if (!st.fine || st.reduced || document.hidden || !isTitleVis()) return;
      if (ev.pointerType && ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
      var el = getTitle(); if (!el) return;
      var r = el.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return;
      st.tx = clamp(((ev.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      st.ty = clamp(((ev.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      kickParallax();
    };
    var onCenter = function () { if (st.fine && !st.reduced) { st.tx = 0; st.ty = 0; kickParallax(); } };
    var onVis = function () {
      if (document.hidden) { stopRaf(); stopDustLoop(); }
      else if (isTitleVis()) { startDustLoop(); }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onCenter, { passive: true });
    window.addEventListener('blur', onCenter);
    document.addEventListener('visibilitychange', onVis);
    st.cleanups.push(function () {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onCenter);
      window.removeEventListener('blur', onCenter);
      document.removeEventListener('visibilitychange', onVis);
    });
  }

  function init() {
    if (!hasDom()) return api;
    var titleEl = getTitle();
    readMedia();
    if (titleEl) {
      var initMode = titleEl.getAttribute('data-title-mode') || 'main';
      titleEl.setAttribute('data-title-mode', initMode);
      var stageEl = document.getElementById('v3-title-stage');
      if (stageEl) stageEl.setAttribute('data-title-mode', initMode);
      ensureCrystalStage(titleEl);
      enhanceTitleMenu(titleEl);
      ensureSpatialViews(titleEl);
    }
    indexMenuItems();
    syncArchiveMeta();
    syncTitleAudioButton(false);
    ensureCardBackdrop();
    if (st.inited) return api;
    st.inited = true;
    attachListeners();
    replay();
    st.initIdxT = setTimeout(function () {
      st.initIdxT = 0;
      enhanceTitleMenu(getTitle());
      indexMenuItems();
      syncArchiveMeta();
      syncTitleAudioButton(false);
    }, 0);
    return api;
  }

  function destroy() {
    if (st.initIdxT) { clearTimeout(st.initIdxT); st.initIdxT = 0; }
    clearTimers();
    clearPendingDelete();
    resetParallax(true);
    stopDustLoop();
    if (st.menuObs) { try { st.menuObs.disconnect(); } catch (e) {} st.menuObs = null; }
    if (st.titleObs) { try { st.titleObs.disconnect(); } catch (e) {} st.titleObs = null; }
    if (st.continueObs) { try { st.continueObs.disconnect(); } catch (e) {} st.continueObs = null; }
    if (st.muteObs) { try { st.muteObs.disconnect(); } catch (e) {} st.muteObs = null; }
    if (st.cardObs) { try { st.cardObs.disconnect(); } catch (e) {} st.cardObs = null; }
    for (var i = 0; i < st.cleanups.length; i++) { try { st.cleanups[i](); } catch (e) {} }
    st.cleanups = [];
    st.mqlMotion = null;
    st.mqlPointer = null;
    st.inited = false;
    return api;
  }

  var api = {
    init: init,
    replay: replay,
    openArchiveMode: openArchiveMode,
    openSettingsMode: openSettingsMode,
    returnToMain: returnToMain,
    syncAudioButton: syncTitleAudioButton,
    syncArchiveMeta: syncArchiveMeta,
    getMode: getMode,
    indexMenuItems: indexMenuItems,
    getParallax: getParallax,
    playCardExitVeil: playCardExitVeil,
    syncCardBackdrop: ensureCardBackdrop,
    destroy: destroy
  };

  if (root) root.TitleDirector = api;
  if (hasDom()) {
    if (getTitle() || document.readyState !== 'loading') {
      init();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          init();
          indexMenuItems();
          syncArchiveMeta();
          syncTitleAudioButton(false);
          ensureCardBackdrop();
        }, { once: true });
      }
    } else {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
