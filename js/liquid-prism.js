/* =========================================================================
   转生千金 · Ice-Prism Glass Controller (js/liquid-prism.js)
   导出：window.LiquidPrism = { init, refresh, setEnabled, isEnabled, getBackend, destroy }

   安全策略（P0 防隐身根治）：
   1. 局内核心交互界面（#hud / #hud .hud-left / #action-bar / #text-box）已由
      css/prism-refraction-ui.css 完整实现纯 CSS 切面棱镜玻璃，严禁挂载
      liquidGL GPU 劫持（避免 WebGPU 快照失败导致内联 opacity:0 / pointer-events:none 滞留）。
   2. 仅对标题页可选装饰徽标（.title-sector-card / .title-stage-badge）提供
      非阻塞纯 CSS 磨砂棱镜增强，绝不写入内联 opacity:0 或 pointer-events:none；
      卸载或离开标题页时彻底清理注入属性、内联样式与 <style id="liquid-prism-styles">。
   ========================================================================= */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'ojousama_fx_enabled_v1';
  var STYLE_ID = 'liquid-prism-styles';
  var PROTECTED_CORE_SELECTORS = ['#hud', '#hud .hud-left', '#action-bar', '#text-box'];
  var LIQUID_GL_INLINE_PROPS = [
    'opacity',
    'pointer-events',
    'background',
    'background-color',
    'background-image',
    'backdrop-filter',
    '-webkit-backdrop-filter',
    'box-shadow',
    'transition',
    'position',
    'transform',
    'transform-style',
    'transform-origin',
    'cursor',
    'touch-action'
  ];

  var state = {
    initialized: false,
    enabled: true,
    reducedMotion: false,
    backend: 'disabled',
    activeSurface: null, // 'title' | null
    activeLens: null,
    activeEl: null,
    activeHostEl: null,
    activeMode: null, // 'css-fallback' | null
    syncTimer: 0,
    mql: null,
    mqlHandler: null,
    observers: [],
    cleanups: []
  };

  function isBrowserDoc() {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.documentElement;
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

  function isProtectedCoreSurface(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el.id === 'hud' || el.id === 'action-bar' || el.id === 'text-box' || el.id === 'loc-bar') {
        return true;
      }
      if (typeof el.matches === 'function') {
        for (var i = 0; i < PROTECTED_CORE_SELECTORS.length; i++) {
          if (el.matches(PROTECTED_CORE_SELECTORS[i])) return true;
        }
      }
      if (typeof el.closest === 'function' && el.closest('#hud, #action-bar, #text-box')) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function clearActiveAttributes(el, hostEl) {
    if (el && el.removeAttribute) {
      el.removeAttribute('data-liquid-prism');
      el.removeAttribute('data-liquid-prism-role');
      el.removeAttribute('data-liquid-prism-backend');
      el.removeAttribute('data-liquidgl-tilt');
    }
    if (hostEl && hostEl.removeAttribute) {
      hostEl.removeAttribute('data-liquid-prism-host');
    }
  }

  function clearLiquidGLInlineStyles(el) {
    if (!el || !el.style) return;
    for (var i = 0; i < LIQUID_GL_INLINE_PROPS.length; i++) {
      try {
        el.style.removeProperty(LIQUID_GL_INLINE_PROPS[i]);
      } catch (e) {}
    }
  }

  function sanitizeProtectedCoreHud() {
    if (!isBrowserDoc()) return;
    for (var i = 0; i < PROTECTED_CORE_SELECTORS.length; i++) {
      var nodes = null;
      try {
        nodes = document.querySelectorAll(PROTECTED_CORE_SELECTORS[i]);
      } catch (e) {
        nodes = null;
      }
      if (!nodes || !nodes.length) continue;
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        if (!node || node.nodeType !== 1) continue;
        var hadPrismAttr = !!(
          node.hasAttribute('data-liquid-prism') ||
          node.hasAttribute('data-liquid-prism-role') ||
          node.hasAttribute('data-liquid-prism-backend') ||
          node.hasAttribute('data-liquid-prism-host') ||
          node.hasAttribute('data-liquidgl-tilt')
        );
        clearActiveAttributes(node, node);
        if (hadPrismAttr) {
          clearLiquidGLInlineStyles(node);
        }
        if (node.style) {
          var rawOp = String(node.style.opacity || '').trim();
          if (rawOp === '0' || (rawOp !== '' && !isNaN(parseFloat(rawOp)) && parseFloat(rawOp) <= 0.01)) {
            node.style.removeProperty('opacity');
          }
          if (String(node.style.pointerEvents || '').trim() === 'none') {
            node.style.removeProperty('pointer-events');
          }
        }
      }
    }
  }

  function ensureScopedStyles() {
    if (!isBrowserDoc() || !document.head) return;
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '/* Scoped Ice-Prism non-blocking CSS glass (title decorative badge only) */\n' +
      '[data-liquid-prism-role="title"][data-liquid-prism="css-fallback"] {\n' +
      '  border-radius: 6px !important;\n' +
      '  clip-path: none !important;\n' +
      '  background: rgba(244, 248, 255, 0.72) !important;\n' +
      '  border: 1px solid rgba(255, 255, 255, 0.68) !important;\n' +
      '  backdrop-filter: blur(14px) saturate(1.25) !important;\n' +
      '  -webkit-backdrop-filter: blur(14px) saturate(1.25) !important;\n' +
      '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 16px 34px -10px rgba(7, 20, 46, 0.34) !important;\n' +
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
      '#cg-lightbox:not(.hidden)',
      '#ai-drawer:not(.hidden)',
      '#hud-drawer.open:not(.hidden)'
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
    if (sector && !isProtectedCoreSurface(sector)) return { el: sector, selector: '.title-sector-card' };
    var badge = document.querySelector('#title-screen .title-stage-badge') || document.querySelector('.title-stage-badge');
    if (badge && !isProtectedCoreSurface(badge)) return { el: badge, selector: '.title-stage-badge' };
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
    }

    return null;
  }

  function teardownActiveLens() {
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
    if (el) {
      clearActiveAttributes(el, hostEl);
      clearLiquidGLInlineStyles(el);
    } else if (hostEl) {
      clearActiveAttributes(null, hostEl);
    }
    removeScopedStyles();
    sanitizeProtectedCoreHud();

    if (!state.enabled || isReducedMotion() || isJsdomEnv()) {
      state.backend = 'disabled';
    }
  }

  function mountCssFallback(kind, targetEl) {
    if (!targetEl || isProtectedCoreSurface(targetEl)) {
      sanitizeProtectedCoreHud();
      return;
    }
    ensureScopedStyles();
    clearLiquidGLInlineStyles(targetEl);
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
    if (!spec || spec.kind !== 'title' || !spec.target || !spec.target.el) {
      teardownActiveLens();
      return;
    }
    var targetEl = spec.target.el;
    if (isProtectedCoreSurface(targetEl) || !isElementVisible(targetEl)) {
      teardownActiveLens();
      return;
    }
    // 使用纯 CSS 非阻塞磨砂增强，彻底规避 liquidGL GPU 劫持写入内联 opacity:0 / pointer-events:none
    mountCssFallback('title', targetEl);
  }

  function syncNow() {
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = 0;
    }
    if (!state.initialized) return;

    sanitizeProtectedCoreHud();

    var desired = detectDesiredSurface();
    if (!desired) {
      if (state.activeSurface || state.activeLens || state.activeEl) {
        teardownActiveLens();
      } else {
        removeScopedStyles();
        if (!state.enabled || isReducedMotion() || isJsdomEnv()) {
          state.backend = 'disabled';
        } else {
          state.backend = 'css-fallback';
        }
      }
      return;
    }

    if (state.activeSurface === desired.kind && state.activeEl === desired.target.el && state.activeMode === 'css-fallback') {
      return;
    }

    teardownActiveLens();
    mountSurface(desired);
  }

  function scheduleSync(delayMs) {
    if (!isBrowserDoc() || isJsdomEnv()) return;
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

    var observedOverlays = typeof WeakSet === 'function' ? new WeakSet() : null;
    var observedOverlayList = [];

    var isTrackedOverlayNode = function (n) {
      if (!n || n.nodeType !== 1) return false;
      var nId = n.id || '';
      var nCls = typeof n.className === 'string' ? n.className : '';
      return (
        nId === 'ice-deduction-modal' ||
        nId === 'cg-lightbox' ||
        nId === 'ai-drawer' ||
        nId === 'ending-screen' ||
        nId === 'hud-drawer' ||
        /\boverlay\b/.test(nCls)
      );
    };

    var watchOverlayAttrs = function (n) {
      if (!isTrackedOverlayNode(n)) return;
      if (observedOverlays) {
        if (observedOverlays.has(n)) return;
        observedOverlays.add(n);
      } else {
        if (observedOverlayList.indexOf(n) !== -1) return;
        observedOverlayList.push(n);
      }
      observeNode(n, { attributes: true, attributeFilter: ['class', 'style'] }, onLayoutMutation);
    };

    var onLayoutMutation = function (records) {
      var needSync = false;
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
            id === 'battle-screen' ||
            id === 'card' ||
            id === 'cg-screen' ||
            id === 'sys-popup' ||
            id === 'letter-demo' ||
            id === 'ice-deduction-modal' ||
            id === 'cg-lightbox' ||
            id === 'ai-drawer' ||
            id === 'ending-screen' ||
            id === 'hud-drawer' ||
            /\boverlay\b/.test(cls)
          ) {
            needSync = true;
          }
        }
        if (rec.type === 'childList') {
          var added = rec.addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n && n.nodeType === 1) {
              if (n.id === 'ambient-fx-canvas') {
                observeNode(n, { attributes: true, attributeFilter: ['data-enabled'] }, syncEnabledFromAmbientCanvas);
                syncEnabledFromAmbientCanvas();
              } else if (isTrackedOverlayNode(n)) {
                watchOverlayAttrs(n);
                needSync = true;
              }
            }
          }
          var removed = rec.removedNodes;
          for (var k = 0; k < removed.length; k++) {
            if (isTrackedOverlayNode(removed[k])) {
              needSync = true;
            }
          }
        }
      }
      if (needSync) {
        scheduleSync(40);
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

    if (document.body && document.body.children) {
      for (var cIdx = 0; cIdx < document.body.children.length; cIdx++) {
        watchOverlayAttrs(document.body.children[cIdx]);
      }
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
    sanitizeProtectedCoreHud();

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

    return api;
  }

  function refresh() {
    sanitizeProtectedCoreHud();
    if (!isBrowserDoc() || isJsdomEnv()) return api;
    if (!state.initialized) {
      init();
      return api;
    }
    syncNow();
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
    return state.backend || 'css-fallback';
  }

  function destroy() {
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = 0;
    }
    teardownActiveLens();
    disconnectObservers();
    removeScopedStyles();
    sanitizeProtectedCoreHud();
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
