/* =========================================================================
   转生千金 · Ice-Prism Liquid Glass Controller (js/liquid-prism.js)
   基于 naughtyduk/liquidGL v3.0.0（自动降级链：WebGPU → WebGL2 → WebGL1 → CSS backdrop-filter）
   导出：window.LiquidPrism = { init, refresh, setEnabled, isEnabled, getBackend, destroy }

   克制定向玻璃棱镜表面（仅作用于两处核心冰晶视窗，绝不滥用）：
   1. 标题页右下角阿斯特莱亚钟楼坐标徽标（.title-sector-card / .title-stage-badge）
      - 淡霜白滤色 rgba(244, 248, 255, 0.22)、锐利棱边折射与微弱色散 (aberration: 0.014)
      - 离开 #title-screen 或打开弹窗遮罩时立即同步销毁释放 GPU 资源
   2. 局内左上角角色状态棱镜（#hud .hud-left / #hud）
      - 冰瓷晴空晶透滤色 rgba(248, 251, 255, 0.34)、冷霜高光边缘、随背景切换自动刷新折射快照
      - 弹窗/标题页/CG/沉浸/POV 模式下立即同步暂停并释放 GPU 资源
   ========================================================================= */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'ojousama_fx_enabled_v1';
  var STYLE_ID = 'liquid-prism-styles';

  var TITLE_LENS_CONFIG = {
    tint: 'rgba(244, 248, 255, 0.22)',
    refraction: 0.026,
    aberration: 0.014,
    bevelDepth: 0.11,
    bevelWidth: 0.18,
    frost: 2.2,
    magnify: 1.035,
    resolution: 1.5
  };

  var HUD_LENS_CONFIG = {
    tint: 'rgba(248, 251, 255, 0.34)',
    refraction: 0.02,
    aberration: 0.008,
    bevelDepth: 0.09,
    bevelWidth: 0.15,
    frost: 2.4,
    magnify: 1.025,
    resolution: 1.25,
    zIndex: 4
  };

  var state = {
    initialized: false,
    enabled: true,
    reducedMotion: false,
    backend: 'disabled',
    gpuSupport: null, // null = unknown, 'gpu' = WebGPU/WebGL available, 'none' = fallback only
    gpuProbePromise: null,
    activeSurface: null, // 'title' | 'hud' | null
    activeLens: null,
    activeEl: null,
    activeHostEl: null,
    activeMode: null, // 'gpu' | 'css-fallback' | null
    syncTimer: 0,
    bgRefreshTimer: 0,
    mql: null,
    mqlHandler: null,
    observers: [],
    cleanups: [],
    mountSeq: 0
  };

  function isBrowserDoc() {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.documentElement;
  }

  function isJsdomEnv() {
    return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
  }

  function isTouchOrNarrowMobile() {
    if (!isBrowserDoc()) return false;
    try {
      if (typeof window.innerWidth === 'number' && window.innerWidth <= 768) return true;
      if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return true;
    } catch (e) {}
    return false;
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

  function checkReducedMotion() {
    if (!isBrowserDoc() || typeof window.matchMedia !== 'function') {
      state.reducedMotion = false;
      return false;
    }
    try {
      var mql = state.mql || window.matchMedia('(prefers-reduced-motion: reduce)');
      state.reducedMotion = !!mql.matches;
      if (!state.mql) {
        state.mql = mql;
        state.mqlHandler = function (ev) {
          state.reducedMotion = !!(ev ? ev.matches : mql.matches);
          if (state.reducedMotion) {
            teardownActiveLens();
            state.backend = 'disabled';
          } else {
            scheduleSync(40);
          }
        };
        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', state.mqlHandler);
        } else if (typeof mql.addListener === 'function') {
          mql.addListener(state.mqlHandler);
        }
      }
    } catch (e) {
      state.reducedMotion = false;
    }
    return state.reducedMotion;
  }

  function isReducedMotion() {
    if (state.mql) {
      state.reducedMotion = !!state.mql.matches;
    }
    return !!state.reducedMotion;
  }

  function hasSyncWebGL() {
    if (!isBrowserDoc()) return false;
    try {
      var c = document.createElement('canvas');
      var ctx = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!ctx) return false;
      try {
        var lose = ctx.getExtension && ctx.getExtension('WEBGL_lose_context');
        if (lose && typeof lose.loseContext === 'function') lose.loseContext();
      } catch (e) {}
      return true;
    } catch (e) {
      return false;
    }
  }

  function probeGpuSupport() {
    if (state.gpuSupport) return Promise.resolve(state.gpuSupport);
    if (state.gpuProbePromise) return state.gpuProbePromise;

    if (isJsdomEnv() || !isBrowserDoc() || typeof window.liquidGL !== 'function') {
      state.gpuSupport = 'none';
      return Promise.resolve('none');
    }

    if (window.__liquidGLNoWebGL__ === true) {
      state.gpuSupport = 'none';
      return Promise.resolve('none');
    }

    if (hasSyncWebGL()) {
      state.gpuSupport = 'gpu';
      return Promise.resolve('gpu');
    }

    if (typeof navigator !== 'undefined' && navigator.gpu && typeof navigator.gpu.requestAdapter === 'function') {
      state.gpuProbePromise = navigator.gpu.requestAdapter().then(function (adapter) {
        state.gpuSupport = adapter ? 'gpu' : 'none';
        state.gpuProbePromise = null;
        return state.gpuSupport;
      }).catch(function () {
        state.gpuSupport = 'none';
        state.gpuProbePromise = null;
        return 'none';
      });
      return state.gpuProbePromise;
    }

    state.gpuSupport = 'none';
    return Promise.resolve('none');
  }

  function ensureScopedStyles() {
    if (!isBrowserDoc() || !document.head) return;
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '/* Scoped Ice-Prism Liquid Glass surface refinements */\n' +
      '[data-liquid-prism-host="title"] {\n' +
      '  position: fixed !important;\n' +
      '}\n' +
      '[data-liquid-prism-role="title"][data-liquid-prism="active"] {\n' +
      '  border-radius: 6px !important;\n' +
      '  clip-path: none !important;\n' +
      '  border: 1px solid rgba(255, 255, 255, 0.62) !important;\n' +
      '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), inset 0 -1px 0 rgba(125, 211, 252, 0.34), 0 14px 32px -12px rgba(7, 20, 46, 0.42) !important;\n' +
      '}\n' +
      '[data-liquid-prism-role="title"][data-liquid-prism="active"] .title-badge-crest {\n' +
      '  background: rgba(18, 80, 230, 0.86) !important;\n' +
      '  border-right: 1px solid rgba(255, 255, 255, 0.36);\n' +
      '}\n' +
      '[data-liquid-prism-role="title"][data-liquid-prism="active"] .title-badge-meta {\n' +
      '  background: linear-gradient(135deg, rgba(246, 250, 255, 0.62) 0%, rgba(232, 244, 255, 0.44) 100%) !important;\n' +
      '}\n' +
      '[data-liquid-prism-role="title"][data-liquid-prism="active"] .title-badge-sector {\n' +
      '  color: #06132b !important;\n' +
      '  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);\n' +
      '}\n' +
      '[data-liquid-prism-role="title"][data-liquid-prism="active"] .title-badge-volrow {\n' +
      '  color: #163569 !important;\n' +
      '}\n' +
      '[data-liquid-prism-role="title"][data-liquid-prism="css-fallback"] {\n' +
      '  border-radius: 6px !important;\n' +
      '  clip-path: none !important;\n' +
      '  background: rgba(244, 248, 255, 0.72) !important;\n' +
      '  border: 1px solid rgba(255, 255, 255, 0.68) !important;\n' +
      '  backdrop-filter: blur(14px) saturate(1.25) !important;\n' +
      '  -webkit-backdrop-filter: blur(14px) saturate(1.25) !important;\n' +
      '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 16px 34px -10px rgba(7, 20, 46, 0.34) !important;\n' +
      '}\n' +
      '[data-liquid-prism-role="hud"][data-liquid-prism="active"] {\n' +
      '  border-radius: 10px !important;\n' +
      '  border: 1px solid rgba(125, 211, 252, 0.42) !important;\n' +
      '  border-top-color: rgba(255, 255, 255, 0.72) !important;\n' +
      '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 10px 26px -12px rgba(13, 31, 68, 0.20) !important;\n' +
      '}\n' +
      '[data-liquid-prism-role="hud"][data-liquid-prism="active"]::before {\n' +
      '  content: "";\n' +
      '  position: absolute;\n' +
      '  inset: 0;\n' +
      '  border-radius: inherit;\n' +
      '  background: linear-gradient(100deg, rgba(248, 251, 255, 0.78) 0%, rgba(242, 248, 255, 0.66) 76%, rgba(238, 246, 255, 0.52) 100%);\n' +
      '  pointer-events: none;\n' +
      '  z-index: 0;\n' +
      '}\n' +
      '[data-liquid-prism-role="hud"][data-liquid-prism="active"] > * {\n' +
      '  position: relative;\n' +
      '  z-index: 1;\n' +
      '}\n' +
      '[data-liquid-prism-role="hud"][data-liquid-prism="active"] #hud-name,\n' +
      '[data-liquid-prism-role="hud"][data-liquid-prism="active"] .hb-val {\n' +
      '  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.72);\n' +
      '}\n' +
      '[data-liquid-prism-role="hud"][data-liquid-prism="css-fallback"] {\n' +
      '  border-radius: 10px !important;\n' +
      '  border: 1px solid rgba(56, 189, 248, 0.36) !important;\n' +
      '  background: linear-gradient(100deg, rgba(248, 251, 255, 0.90) 0%, rgba(244, 249, 255, 0.84) 78%, rgba(238, 246, 255, 0.78) 100%) !important;\n' +
      '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 10px 24px -10px rgba(13, 31, 68, 0.16) !important;\n' +
      '  backdrop-filter: blur(16px) saturate(1.22) !important;\n' +
      '  -webkit-backdrop-filter: blur(16px) saturate(1.22) !important;\n' +
      '}\n';
    document.head.appendChild(style);
  }

  function removeScopedStyles() {
    if (!isBrowserDoc()) return;
    var el = document.getElementById(STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    try {
      var cs = window.getComputedStyle(el);
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) <= 0.01) {
        return false;
      }
      var rect = el.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4;
    } catch (e) {
      return false;
    }
  }

  function hasBlockingOverlay() {
    if (!isBrowserDoc()) return true;
    var selectors = [
      '.overlay:not(.hidden)',
      '#card:not(.hidden)',
      '#cg-screen:not(.hidden)',
      '#sys-popup:not(.hidden)',
      '#letter-demo:not(.hidden)',
      '#ice-deduction-modal:not(.hidden)',
      '#cg-lightbox:not(.hidden)'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        try {
          var cs = window.getComputedStyle(n);
          if (cs && cs.display !== 'none' && cs.visibility !== 'hidden') {
            return true;
          }
        } catch (e) {
          return true;
        }
      }
    }
    return false;
  }

  function resolveTitleTarget() {
    var sector = document.querySelector('#title-screen .title-sector-card') || document.querySelector('.title-sector-card');
    if (sector) return { el: sector, selector: '.title-sector-card' };
    var badge = document.querySelector('#title-screen .title-stage-badge') || document.querySelector('.title-stage-badge');
    if (badge) return { el: badge, selector: '.title-stage-badge' };
    return null;
  }

  function resolveHudTarget() {
    var hudLeft = document.querySelector('#hud .hud-left');
    if (hudLeft) return { el: hudLeft, selector: '#hud .hud-left' };
    var hud = document.getElementById('hud');
    if (hud) return { el: hud, selector: '#hud' };
    return null;
  }

  function detectDesiredSurface() {
    if (!isBrowserDoc() || isJsdomEnv()) return null;
    if (!state.enabled || isReducedMotion()) return null;
    if (document.hidden) return null;
    if (hasBlockingOverlay()) return null;

    var titleScreen = document.getElementById('title-screen');
    if (titleScreen && isElementVisible(titleScreen)) {
      var titleTarget = resolveTitleTarget();
      if (titleTarget && isElementVisible(titleTarget.el)) {
        return { kind: 'title', target: titleTarget };
      }
      return null;
    }

    var gameScreen = document.getElementById('game-screen');
    if (gameScreen && isElementVisible(gameScreen)) {
      var body = document.body;
      if (body && (
        body.classList.contains('ui-hidden') ||
        body.classList.contains('pov-hidden') ||
        body.classList.contains('cg-mode')
      )) {
        return null;
      }
      var hudTarget = resolveHudTarget();
      if (hudTarget && isElementVisible(hudTarget.el)) {
        return { kind: 'hud', target: hudTarget };
      }
    }

    return null;
  }

  function inspectLensBackend(lens) {
    if (!lens) return 'disabled';
    var renderer = lens.renderer;
    if (!renderer) return 'css-fallback';
    var backend = renderer.backend;
    if (!backend) return renderer._backendFailed ? 'css-fallback' : 'initializing';
    if (backend.kind === 'webgpu') return 'webgpu';
    if (backend.kind === 'webgl') {
      try {
        if (typeof WebGL2RenderingContext !== 'undefined' && backend.gl instanceof WebGL2RenderingContext) {
          return 'webgl2';
        }
      } catch (e) {}
      return 'webgl1';
    }
    return 'css-fallback';
  }

  function clearActiveAttributes(el, hostEl) {
    if (el && el.removeAttribute) {
      el.removeAttribute('data-liquid-prism');
      el.removeAttribute('data-liquid-prism-role');
      el.removeAttribute('data-liquid-prism-backend');
    }
    if (hostEl && hostEl.removeAttribute) {
      hostEl.removeAttribute('data-liquid-prism-host');
    }
  }

  function teardownActiveLens() {
    state.mountSeq++;
    if (state.bgRefreshTimer) {
      clearTimeout(state.bgRefreshTimer);
      state.bgRefreshTimer = 0;
    }
    var lens = state.activeLens;
    var el = state.activeEl;
    var hostEl = state.activeHostEl;
    state.activeLens = null;
    state.activeEl = null;
    state.activeHostEl = null;
    state.activeSurface = null;
    state.activeMode = null;

    if (lens && typeof lens.destroy === 'function') {
      try {
        lens.destroy();
      } catch (e) {}
    }
    clearActiveAttributes(el, hostEl);

    if (!state.enabled || isReducedMotion() || isJsdomEnv()) {
      state.backend = 'disabled';
    }
  }

  function mountCssFallback(kind, targetEl) {
    ensureScopedStyles();
    targetEl.setAttribute('data-liquid-prism-role', kind);
    targetEl.setAttribute('data-liquid-prism', 'css-fallback');
    targetEl.setAttribute('data-liquid-prism-backend', 'css-fallback');
    state.activeSurface = kind;
    state.activeEl = targetEl;
    state.activeHostEl = null;
    state.activeLens = null;
    state.activeMode = 'css-fallback';
    state.backend = 'css-fallback';
  }

  function mountSurface(spec) {
    var seq = ++state.mountSeq;
    var kind = spec.kind;
    var targetEl = spec.target.el;
    var targetSelector = spec.target.selector;

    if (!isElementVisible(targetEl)) {
      teardownActiveLens();
      return;
    }

    if (isTouchOrNarrowMobile()) {
      mountCssFallback(kind, targetEl);
      return;
    }

    var snapshotSelector = 'body';
    var snapshotEl = document.body;
    var hostEl = null;

    if (kind === 'title') {
      var blade = document.querySelector('#title-screen .title-stage-blade');
      var titleScreen = document.getElementById('title-screen');
      if (blade && isElementVisible(blade) && blade.scrollWidth > 0 && blade.scrollHeight > 0) {
        snapshotSelector = '#title-screen .title-stage-blade';
        snapshotEl = blade;
        if (blade.contains(targetEl)) {
          hostEl = blade;
        }
      } else if (titleScreen && isElementVisible(titleScreen) && titleScreen.scrollWidth > 0 && titleScreen.scrollHeight > 0) {
        snapshotSelector = '#title-screen';
        snapshotEl = titleScreen;
      }
    } else if (kind === 'hud') {
      var bgEl = document.getElementById('bg');
      if (bgEl && bgEl.scrollWidth > 0 && bgEl.scrollHeight > 0) {
        snapshotSelector = '#bg';
        snapshotEl = bgEl;
      }
    }

    if (!snapshotEl || snapshotEl.scrollWidth <= 0 || snapshotEl.scrollHeight <= 0) {
      return;
    }

    probeGpuSupport().then(function (support) {
      if (seq !== state.mountSeq) return;
      if (!state.enabled || isReducedMotion() || document.hidden) return;
      if (!isElementVisible(targetEl) || hasBlockingOverlay()) return;

      if (isTouchOrNarrowMobile() || support !== 'gpu' || typeof window.liquidGL !== 'function') {
        mountCssFallback(kind, targetEl);
        return;
      }

      ensureScopedStyles();
      if (hostEl) {
        hostEl.setAttribute('data-liquid-prism-host', kind);
      }
      targetEl.setAttribute('data-liquid-prism-role', kind);
      targetEl.setAttribute('data-liquid-prism', 'active');

      var cfg = kind === 'title' ? TITLE_LENS_CONFIG : HUD_LENS_CONFIG;
      var useContentLayer = kind === 'title' && !hostEl;
      var options = {
        engine: 'auto',
        snapshot: snapshotSelector,
        target: targetSelector,
        content: useContentLayer ? targetSelector : false,
        zIndex: kind === 'title' ? (hostEl ? undefined : 5) : cfg.zIndex,
        resolution: cfg.resolution,
        refraction: cfg.refraction,
        aberration: cfg.aberration,
        bevelDepth: cfg.bevelDepth,
        bevelWidth: cfg.bevelWidth,
        frost: cfg.frost,
        shadow: false,
        specular: true,
        reveal: 'none',
        tilt: false,
        draggable: false,
        interaction: 'none',
        magnify: cfg.magnify,
        tint: cfg.tint,
        helper: false,
        on: {
          init: function (instance) {
            if (seq !== state.mountSeq || state.activeLens !== instance) return;
            var bk = inspectLensBackend(instance);
            if (bk !== 'initializing') {
              state.backend = bk;
              targetEl.setAttribute('data-liquid-prism-backend', bk);
            }
          }
        }
      };

      var result = null;
      try {
        result = window.liquidGL(options);
      } catch (e) {
        clearActiveAttributes(targetEl, hostEl);
        mountCssFallback(kind, targetEl);
        return;
      }

      var lens = Array.isArray(result) ? result[0] : result;
      if (!lens) {
        clearActiveAttributes(targetEl, hostEl);
        mountCssFallback(kind, targetEl);
        return;
      }

      state.activeSurface = kind;
      state.activeEl = targetEl;
      state.activeHostEl = hostEl;
      state.activeLens = lens;

      if (!lens.renderer) {
        if (hostEl) {
          hostEl.removeAttribute('data-liquid-prism-host');
          state.activeHostEl = null;
        }
        state.activeMode = 'css-fallback';
        state.backend = 'css-fallback';
        targetEl.setAttribute('data-liquid-prism', 'css-fallback');
        targetEl.setAttribute('data-liquid-prism-backend', 'css-fallback');
        return;
      }

      state.activeMode = 'gpu';
      var immediateBk = inspectLensBackend(lens);
      if (immediateBk !== 'initializing') {
        state.backend = immediateBk;
        targetEl.setAttribute('data-liquid-prism-backend', immediateBk);
      }

      if (lens.renderer._backendReady && typeof lens.renderer._backendReady.then === 'function') {
        lens.renderer._backendReady.then(function (ready) {
          if (seq !== state.mountSeq || state.activeLens !== lens) return;
          if (!ready || !lens.renderer || !lens.renderer.backend) {
            try { lens.destroy(); } catch (e) {}
            state.activeLens = null;
            clearActiveAttributes(targetEl, hostEl);
            mountCssFallback(kind, targetEl);
            return;
          }
          var bk = inspectLensBackend(lens);
          state.backend = bk;
          targetEl.setAttribute('data-liquid-prism-backend', bk);
        }).catch(function () {
          if (seq !== state.mountSeq || state.activeLens !== lens) return;
          try { lens.destroy(); } catch (e) {}
          state.activeLens = null;
          clearActiveAttributes(targetEl, hostEl);
          mountCssFallback(kind, targetEl);
        });
      }
    });
  }

  function syncNow() {
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = 0;
    }
    if (!state.initialized) return;

    var desired = detectDesiredSurface();
    if (!desired) {
      if (state.activeSurface || state.activeLens || state.activeEl) {
        teardownActiveLens();
      } else if (!state.enabled || isReducedMotion() || isJsdomEnv()) {
        state.backend = 'disabled';
      }
      return;
    }

    if (state.activeSurface === desired.kind && state.activeEl === desired.target.el) {
      var wantFallbackOnly = isTouchOrNarrowMobile();
      if (
        (wantFallbackOnly && state.activeMode === 'gpu') ||
        (!wantFallbackOnly && state.activeMode === 'css-fallback' && state.gpuSupport !== 'none')
      ) {
        teardownActiveLens();
        mountSurface(desired);
      }
      return;
    }

    teardownActiveLens();
    mountSurface(desired);
  }

  function scheduleSync(delayMs) {
    if (!isBrowserDoc() || isJsdomEnv()) return;
    // Teardown synchronously the moment a modal opens or a surface disappears
    if (state.initialized && (state.activeSurface || state.activeLens)) {
      var desiredNow = detectDesiredSurface();
      if (!desiredNow || desiredNow.kind !== state.activeSurface || desiredNow.target.el !== state.activeEl) {
        teardownActiveLens();
      }
      if (!desiredNow) {
        if (state.syncTimer) {
          clearTimeout(state.syncTimer);
          state.syncTimer = 0;
        }
        return;
      }
    }
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = 0;
    }
    state.syncTimer = setTimeout(syncNow, typeof delayMs === 'number' ? delayMs : 50);
  }

  function scheduleBgRecapture() {
    if (!state.initialized || state.activeSurface !== 'hud') return;
    if (state.activeMode !== 'gpu' || !state.activeLens || !state.activeLens.renderer) return;
    if (state.bgRefreshTimer) {
      clearTimeout(state.bgRefreshTimer);
      state.bgRefreshTimer = 0;
    }
    state.bgRefreshTimer = setTimeout(function () {
      state.bgRefreshTimer = 0;
      if (state.activeSurface !== 'hud' || !state.activeLens || !state.activeLens.renderer) return;
      var renderer = state.activeLens.renderer;
      if (renderer._destroyed) return;
      var bgEl = document.getElementById('bg');
      if (bgEl) {
        try {
          var op = parseFloat(window.getComputedStyle(bgEl).opacity);
          if (!isNaN(op) && op < 0.5) {
            scheduleBgRecapture();
            return;
          }
        } catch (e) {}
      }
      try {
        renderer._captureGeneration = (renderer._captureGeneration || 0) + 1;
        renderer.captureSnapshot();
      } catch (e) {}
    }, 340);
  }

  function syncEnabledFromAmbientCanvas() {
    if (!isBrowserDoc()) return;
    var afxCanvas = document.getElementById('ambient-fx-canvas');
    if (!afxCanvas) return;
    var attr = afxCanvas.getAttribute('data-enabled');
    if (attr === '0' || attr === '1') {
      var next = attr === '1';
      if (next !== state.enabled) {
        state.enabled = next;
        if (!state.enabled) {
          teardownActiveLens();
          state.backend = 'disabled';
        } else {
          scheduleSync(20);
        }
      }
    }
  }

  function attachObservers() {
    if (!isBrowserDoc() || isJsdomEnv() || typeof MutationObserver !== 'function') return;

    var observeNode = function (node, opts, cb) {
      if (!node) return;
      try {
        var obs = new MutationObserver(cb);
        obs.observe(node, opts);
        state.observers.push(obs);
      } catch (e) {}
    };

    var onLayoutMutation = function (records) {
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        var target = rec.target;
        if (!target) continue;
        if (target.id === 'ambient-fx-canvas' && rec.attributeName === 'data-enabled') {
          syncEnabledFromAmbientCanvas();
          continue;
        }
        if (target.id !== 'battle-screen' && target.closest && target.closest('#battle-screen')) {
          continue;
        }
        if (target.hasAttribute && (
          target.hasAttribute('data-liquid-ignore') ||
          target.hasAttribute('data-liquid-prism') ||
          target.hasAttribute('data-liquid-prism-host')
        )) {
          continue;
        }
        if (rec.attributeName === 'class' || rec.attributeName === 'style') {
          var id = target.id || '';
          var cls = typeof target.className === 'string' ? target.className : '';
          if (
            target === document.body ||
            id === 'title-screen' ||
            id === 'game-screen' ||
            id === 'card' ||
            id === 'cg-screen' ||
            id === 'sys-popup' ||
            id === 'letter-demo' ||
            id === 'ice-deduction-modal' ||
            id === 'cg-lightbox' ||
            /\boverlay\b/.test(cls)
          ) {
            scheduleSync(40);
            return;
          }
        }
        if (rec.type === 'childList') {
          var added = rec.addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n && n.nodeType === 1) {
              var nCls = typeof n.className === 'string' ? n.className : '';
              if (
                n.id === 'ambient-fx-canvas' ||
                n.id === 'ice-deduction-modal' ||
                n.id === 'cg-lightbox' ||
                /\boverlay\b/.test(nCls)
              ) {
                if (n.id === 'ambient-fx-canvas') {
                  observeNode(n, { attributes: true, attributeFilter: ['data-enabled'] }, syncEnabledFromAmbientCanvas);
                  syncEnabledFromAmbientCanvas();
                } else {
                  scheduleSync(40);
                }
              }
            }
          }
        }
      }
    };

    var app = document.getElementById('app');
    if (app) {
      observeNode(app, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true
      }, onLayoutMutation);
    }

    observeNode(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true
    }, onLayoutMutation);

    var bgEl = document.getElementById('bg');
    if (bgEl) {
      observeNode(bgEl, { attributes: true, attributeFilter: ['class', 'style'] }, function () {
        scheduleBgRecapture();
      });
    }

    var afxCanvas = document.getElementById('ambient-fx-canvas');
    if (afxCanvas) {
      observeNode(afxCanvas, { attributes: true, attributeFilter: ['data-enabled'] }, syncEnabledFromAmbientCanvas);
    }

    var onVisibility = function () {
      scheduleSync(30);
    };
    document.addEventListener('visibilitychange', onVisibility);
    state.cleanups.push(function () {
      document.removeEventListener('visibilitychange', onVisibility);
    });

    var onResize = function () {
      scheduleSync(180);
    };
    window.addEventListener('resize', onResize, { passive: true });
    state.cleanups.push(function () {
      window.removeEventListener('resize', onResize);
    });

    var onStorage = function (ev) {
      if (!ev || ev.key === STORAGE_KEY) {
        var next = readSavedEnabled();
        if (next !== state.enabled) {
          state.enabled = next;
          if (!state.enabled) {
            teardownActiveLens();
            state.backend = 'disabled';
          } else {
            scheduleSync(20);
          }
        }
      }
    };
    window.addEventListener('storage', onStorage);
    state.cleanups.push(function () {
      window.removeEventListener('storage', onStorage);
    });
  }

  function disconnectObservers() {
    for (var i = 0; i < state.observers.length; i++) {
      try { state.observers[i].disconnect(); } catch (e) {}
    }
    state.observers = [];
    for (var j = 0; j < state.cleanups.length; j++) {
      try { state.cleanups[j](); } catch (e) {}
    }
    state.cleanups = [];
    if (state.mql && state.mqlHandler) {
      try {
        if (typeof state.mql.removeEventListener === 'function') {
          state.mql.removeEventListener('change', state.mqlHandler);
        } else if (typeof state.mql.removeListener === 'function') {
          state.mql.removeListener(state.mqlHandler);
        }
      } catch (e) {}
    }
    state.mql = null;
    state.mqlHandler = null;
  }

  /* =========================================================================
     Public API
     ========================================================================= */
  function init() {
    state.enabled = readSavedEnabled();
    checkReducedMotion();

    if (!isBrowserDoc() || isJsdomEnv()) {
      state.initialized = true;
      state.backend = 'disabled';
      return api;
    }

    if (state.initialized) {
      scheduleSync(20);
      return api;
    }

    state.initialized = true;
    attachObservers();
    syncEnabledFromAmbientCanvas();
    scheduleSync(80);

    if (document.readyState !== 'complete') {
      var onLoad = function () {
        window.removeEventListener('load', onLoad);
        if (!state.initialized) return;
        if (!state.activeSurface) {
          scheduleSync(40);
        } else if (state.activeMode === 'gpu' && state.activeLens && state.activeLens.renderer && !state.activeLens.renderer._destroyed) {
          try {
            var r = state.activeLens.renderer;
            r._captureGeneration = (r._captureGeneration || 0) + 1;
            r.captureSnapshot();
          } catch (e) {}
        }
      };
      window.addEventListener('load', onLoad);
      state.cleanups.push(function () {
        window.removeEventListener('load', onLoad);
      });
    }

    return api;
  }

  function refresh() {
    if (!isBrowserDoc() || isJsdomEnv()) return api;
    if (!state.initialized) {
      init();
      return api;
    }
    syncNow();
    if (state.activeMode === 'gpu' && state.activeLens && state.activeLens.renderer && !state.activeLens.renderer._destroyed) {
      try {
        var r = state.activeLens.renderer;
        r._captureGeneration = (r._captureGeneration || 0) + 1;
        r.captureSnapshot();
      } catch (e) {}
    }
    return api;
  }

  function setEnabled(bool) {
    state.enabled = !!bool;
    writeSavedEnabled(state.enabled);
    if (!state.enabled) {
      teardownActiveLens();
      state.backend = 'disabled';
    } else if (state.initialized && isBrowserDoc() && !isJsdomEnv()) {
      scheduleSync(20);
    }
    return state.enabled;
  }

  function isEnabled() {
    return !!state.enabled;
  }

  function getBackend() {
    if (!state.enabled || isReducedMotion() || isJsdomEnv() || !isBrowserDoc()) {
      return 'disabled';
    }
    if (state.activeLens) {
      var live = inspectLensBackend(state.activeLens);
      if (live !== 'initializing') state.backend = live;
    }
    return state.backend || 'disabled';
  }

  function destroy() {
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = 0;
    }
    teardownActiveLens();
    disconnectObservers();
    removeScopedStyles();
    state.initialized = false;
    state.backend = 'disabled';
    return api;
  }

  var api = {
    init: init,
    refresh: refresh,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    getBackend: getBackend,
    destroy: destroy
  };

  if (root) {
    root.LiquidPrism = api;
  }

  if (isBrowserDoc() && !isJsdomEnv()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        init();
      });
    } else {
      init();
    }
  } else {
    state.enabled = readSavedEnabled();
    state.backend = 'disabled';
  }
})(typeof window !== 'undefined' ? window : globalThis);
