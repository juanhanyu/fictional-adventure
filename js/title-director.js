/* =========================================================================
   《转生千金》标题页开场编排与视差总控 (js/title-director.js)
   window.TitleDirector = { init, replay, indexMenuItems, getParallax, playCardExitVeil, destroy }
   ========================================================================= */
(function (root) {
  'use strict';

  var REFRESH_MS = 920;
  var READY_MS = 940;
  var VEIL_MS = 440;
  var WRITE_EPS = 0.0012;
  var SETTLE_EPS = 0.0008;

  var st = {
    inited: false,
    opening: 'ready',
    initIdxT: 0,
    refreshT: 0,
    readyT: 0,
    raf: 0,
    lastTs: 0,
    tx: 0, ty: 0, cx: 0, cy: 0,
    wx: 0, wy: 0, wrote: false,
    reduced: false,
    fine: false,
    mqlMotion: null,
    mqlPointer: null,
    menuObs: null,
    titleObs: null,
    muteObs: null,
    cardObs: null,
    cleanups: []
  };

  var hasDom = function () { return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.documentElement; };
  var isJsdom = function () { return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || ''); };
  var clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  var getTitle = function () { return hasDom() ? document.getElementById('title-screen') : null; };
  var isTitleVis = function () {
    var el = getTitle();
    return !!(el && !el.classList.contains('hidden') && (!el.style || el.style.display !== 'none'));
  };

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
    if (st.refreshT) { clearTimeout(st.refreshT); st.refreshT = 0; }
    if (st.readyT) { clearTimeout(st.readyT); st.readyT = 0; }
  }

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
    var ease = 1 - Math.pow(0.0012, dt / 1000);
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

  function indexMenuItems() {
    var titleEl = getTitle();
    if (!titleEl) return 0;
    var nodes = titleEl.querySelectorAll('.title-menu > .tbtn:not(.hidden)');
    var idx = 0;
    for (var i = 0; i < nodes.length; i++) {
      var btn = nodes[i];
      if (btn.style && btn.style.display === 'none') continue;
      var val = String(idx++);
      if (btn.style.getPropertyValue('--i') !== val) btn.style.setProperty('--i', val);
    }
    return idx;
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
    var wantText = isM ? '已静音' : '声音 · 开';
    var wantTitle = isM ? '当前已静音（点击开启声音）' : '声音已开启（点击静音）';

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

    var labelEl = btn.querySelector('span');
    if (labelEl && labelEl.textContent !== wantText) {
      labelEl.textContent = wantText;
    }
    return isM;
  }

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
    var ticks = '';
    for (var i = 0; i < 24; i++) {
      var deg = i * 15;
      var major = (i % 6 === 0);
      var mid = (i % 3 === 0);
      var r1 = major ? 236 : (mid ? 243 : 249);
      var r2 = 258;
      var rad = deg * Math.PI / 180;
      var x1 = (300 + r1 * Math.cos(rad)).toFixed(1);
      var y1 = (300 + r1 * Math.sin(rad)).toFixed(1);
      var x2 = (300 + r2 * Math.cos(rad)).toFixed(1);
      var y2 = (300 + r2 * Math.sin(rad)).toFixed(1);
      ticks += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#1250E6" stroke-width="' + (major ? '1.35' : '0.85') + '" stroke-opacity="' + (major ? '0.26' : '0.14') + '"/>';
    }
    return '' +
      '<svg class="card-astrolabe-svg" viewBox="0 0 600 600" fill="none" aria-hidden="true">' +
        '<g class="card-astrolabe-outer">' +
          '<circle cx="300" cy="300" r="268" stroke="#1250E6" stroke-width="0.9" stroke-opacity="0.14"/>' +
          '<circle cx="300" cy="300" r="258" stroke="#38BDF8" stroke-width="0.8" stroke-opacity="0.22"/>' +
          ticks +
          '<polygon points="300,24 306,32 300,40 294,32" fill="#1250E6" fill-opacity="0.26"/>' +
          '<polygon points="300,560 306,568 300,576 294,568" fill="#1250E6" fill-opacity="0.26"/>' +
          '<polygon points="24,300 32,294 40,300 32,306" fill="#1250E6" fill-opacity="0.26"/>' +
          '<polygon points="560,300 568,294 576,300 568,306" fill="#1250E6" fill-opacity="0.26"/>' +
        '</g>' +
        '<g class="card-astrolabe-inner">' +
          '<circle cx="300" cy="300" r="220" stroke="#1250E6" stroke-width="1" stroke-dasharray="3 10" stroke-opacity="0.18"/>' +
          '<circle cx="300" cy="300" r="174" stroke="#1250E6" stroke-width="0.85" stroke-opacity="0.12"/>' +
          '<path d="M132 232 A180 180 0 0 1 232 132" stroke="#38BDF8" stroke-width="1.6" stroke-opacity="0.32" stroke-linecap="round"/>' +
          '<path d="M468 368 A180 180 0 0 1 368 468" stroke="#38BDF8" stroke-width="1.6" stroke-opacity="0.32" stroke-linecap="round"/>' +
          '<polygon points="300,118 318,282 482,300 318,318 300,482 282,318 118,300 282,282" stroke="#1250E6" stroke-width="0.9" stroke-opacity="0.13" fill="#38BDF8" fill-opacity="0.035"/>' +
          '<polygon points="300,174 389,211 426,300 389,389 300,426 211,389 174,300 211,211" stroke="#1250E6" stroke-width="0.75" stroke-opacity="0.11"/>' +
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
        '<div class="card-slash-accent"></div>' +
        '<div class="card-horizon-rule"></div>' +
        '<span class="card-side-index">CHRONICLE OF SILVER &amp; AZURE</span>' +
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

  function replay() {
    clearTimers();
    indexMenuItems();
    syncTitleAudioButton(false);
    var titleEl = getTitle();
    if (!titleEl) return api;
    readMedia();
    resetParallax(true);

    if (isJsdom() || st.reduced || !isTitleVis()) {
      st.opening = 'ready';
      titleEl.setAttribute('data-opening', 'ready');
      return api;
    }

    st.opening = 'playing';
    titleEl.removeAttribute('data-opening');
    void titleEl.offsetWidth;
    titleEl.setAttribute('data-opening', 'playing');

    st.refreshT = setTimeout(function () {
      st.refreshT = 0;
      if (isTitleVis() && root && root.LiquidPrism && typeof root.LiquidPrism.refresh === 'function') {
        try { root.LiquidPrism.refresh(); } catch (e) {}
      }
    }, REFRESH_MS);

    st.readyT = setTimeout(function () {
      st.readyT = 0;
      st.opening = 'ready';
      var el = getTitle();
      if (el) el.setAttribute('data-opening', 'ready');
      if (Math.abs(st.tx - st.cx) > SETTLE_EPS || Math.abs(st.ty - st.cy) > SETTLE_EPS) kickParallax();
    }, READY_MS);

    return api;
  }

  function getParallax() {
    return (isJsdom() || st.reduced || !st.fine || !isTitleVis()) ? { x: 0, y: 0 } : { x: st.cx, y: st.cy };
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

  function attachListeners() {
    var titleEl = getTitle();
    if (!titleEl) return;
    if (typeof MutationObserver === 'function') {
      var menuEl = titleEl.querySelector('.title-menu');
      if (menuEl) {
        st.menuObs = new MutationObserver(indexMenuItems);
        st.menuObs.observe(menuEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
      st.titleObs = new MutationObserver(function () {
        if (!isTitleVis()) {
          clearTimers();
          resetParallax(true);
          if (st.opening === 'playing') {
            st.opening = 'ready';
            titleEl.setAttribute('data-opening', 'ready');
          }
        } else {
          indexMenuItems();
          syncTitleAudioButton(false);
        }
      });
      st.titleObs.observe(titleEl, { attributes: true, attributeFilter: ['class'] });

      var muteBtn = document.getElementById('btn-title-mute');
      if (muteBtn) {
        st.muteObs = new MutationObserver(function () {
          syncTitleAudioButton(true);
        });
        st.muteObs.observe(muteBtn, { attributes: true, attributeFilter: ['class', 'aria-pressed'] });
      }

      var cardEl = document.getElementById('card');
      if (cardEl) {
        st.cardObs = new MutationObserver(function () {
          ensureCardBackdrop();
        });
        st.cardObs.observe(cardEl, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true, characterData: true });
      }
    }

    var onMuteClick = function (ev) {
      var hit = ev && ev.target && ev.target.closest ? ev.target.closest('#btn-title-mute, #btn-mute') : null;
      if (!hit) return;
      setTimeout(function () { syncTitleAudioButton(false); }, 0);
    };
    document.addEventListener('click', onMuteClick);
    st.cleanups.push(function () { document.removeEventListener('click', onMuteClick); });

    if (isJsdom()) return;

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
        clearTimers(); resetParallax(true); st.opening = 'ready';
        var el = getTitle(); if (el) el.setAttribute('data-opening', 'ready');
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
    var onVis = function () { if (document.hidden) stopRaf(); };

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
    readMedia();
    indexMenuItems();
    syncTitleAudioButton(false);
    ensureCardBackdrop();
    if (st.inited) return api;
    st.inited = true;
    attachListeners();
    replay();
    st.initIdxT = setTimeout(function () {
      st.initIdxT = 0;
      indexMenuItems();
      syncTitleAudioButton(false);
    }, 0);
    return api;
  }

  function destroy() {
    if (st.initIdxT) { clearTimeout(st.initIdxT); st.initIdxT = 0; }
    clearTimers();
    resetParallax(true);
    if (st.menuObs) { try { st.menuObs.disconnect(); } catch (e) {} st.menuObs = null; }
    if (st.titleObs) { try { st.titleObs.disconnect(); } catch (e) {} st.titleObs = null; }
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
    indexMenuItems: indexMenuItems,
    syncAudioButton: syncTitleAudioButton,
    syncCardBackdrop: ensureCardBackdrop,
    getParallax: getParallax,
    playCardExitVeil: playCardExitVeil,
    destroy: destroy
  };
  if (root) root.TitleDirector = api;
  if (hasDom()) {
    if (getTitle() || document.readyState !== 'loading') {
      init();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          indexMenuItems();
          syncTitleAudioButton(false);
          ensureCardBackdrop();
        }, { once: true });
      }
    } else {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
