/* =========================================================================
   转生千金 · 悠闲养成核心中枢 (js/raising-hub.js)
   覆盖五大系统：
   1. 鲜活希尔维亚养成中枢 (#sylvia-hub / #hud-mood / 36 句跨阶段轻触对白)
   2. 预掷可视化舆图引擎 (NPC_SCHEDULE_RULES / rollSeasonChars / renderVisualMap)
   3. 季度日程排班器 (#schedule-overlay) 与插画风季度手账 (#season-report-overlay)
   4. 温馨小铺 (#shop-overlay)、九人分层赠礼与火漆信匣 (#mailbox-overlay)
   5. 双轨多结局终幕系统 (#ending-screen / evaluateEnding / 终幕典藏数据源)
   独立挂载于 window.RaisingHub，零侵入既有核心引擎。
   ========================================================================= */
(function (root) {
  'use strict';

  var ENDINGS_STORAGE_KEY = 'ojousama_endings_unlocked_v1';
  var MAX_DIARY_HISTORY = 40;
  var MAX_LEISURE_HISTORY = 24;

  /* =========================================================================
     〇、基础工具与精绘线性 SVG 图标库（UI 零原生 Emoji）
     ========================================================================= */
  var SVG_ICONS = {
    calendar: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2"/><line x1="6.5" y1="2.5" x2="6.5" y2="6"/><line x1="13.5" y1="2.5" x2="13.5" y2="6"/><line x1="3" y1="8.8" x2="17" y2="8.8"/><circle cx="7.2" cy="12.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="10" cy="12.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="12.8" cy="12.5" r="0.9" fill="currentColor" stroke="none"/></svg>',
    basket: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.2 8.2h11.6l-1.1 7.6a1.4 1.4 0 0 1-1.4 1.2H6.7a1.4 1.4 0 0 1-1.4-1.2L4.2 8.2Z"/><path d="M7.2 8.2 9.2 3.8M12.8 8.2 10.8 3.8"/><line x1="2.8" y1="8.2" x2="17.2" y2="8.2"/></svg>',
    envelope: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="1.8"/><path d="M3.2 5.4 10 10.8l6.8-5.4"/><circle cx="10" cy="11.2" r="1.4" fill="currentColor" stroke="none"/></svg>',
    crown: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.2 14.5 2.5 6.8l4.1 3.2L10 4.5l3.4 5.5 4.1-3.2-.7 7.7H3.2Z"/><line x1="4" y1="17" x2="16" y2="17"/></svg>',
    crystal: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="10,2 16.2,10 10,18 3.8,10"/><polygon points="10,6.2 12.8,10 10,13.8 7.2,10" fill="currentColor" fill-opacity="0.2"/></svg>',
    spark: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.4 11.9 8.1 17.6 10l-5.7 1.9L10 17.6l-1.9-5.7L2.4 10l5.7-1.9L10 2.4Z"/></svg>',
    sword: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.6 3.4 16.6 4.4 7.8 13.2 5.4 14.2 6.4 11.8 15.6 3.4Z"/><path d="M4.6 11.2 8.8 15.4"/><line x1="3.4" y1="16.6" x2="5.8" y2="14.2"/></svg>',
    book: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.2 4.5C3.2 3.7 3.9 3 4.7 3H10v13.6H4.7c-.8 0-1.5.5-1.5 1.1V4.5Z"/><path d="M16.8 4.5c0-.8-.7-1.5-1.5-1.5H10v13.6h5.3c.8 0 1.5.5 1.5 1.1V4.5Z"/></svg>',
    ribbon: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4.2"/><path d="M7.5 11.5 6.4 17l3.6-1.8L13.6 17l-1.1-5.5"/></svg>',
    coin: '<svg class="rh-ico" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="6.8"/><polygon points="10,6.2 13,10 10,13.8 7,10" fill="currentColor" fill-opacity="0.22"/></svg>',
    stamina: '<svg class="rh-ico" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11.2,2.4 5.2,11 9.8,11 8.8,17.6 14.8,9 10.2,9"/></svg>',
    heart: '<svg class="rh-ico" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 16.5s-6.2-3.9-6.2-8.1A3.6 3.6 0 0 1 10 5.8a3.6 3.6 0 0 1 6.2 2.6c0 4.2-6.2 8.1-6.2 8.1Z"/></svg>',
    heartFill: '<svg class="rh-ico" viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M10 16.5s-6.2-3.9-6.2-8.1A3.6 3.6 0 0 1 10 5.8a3.6 3.6 0 0 1 6.2 2.6c0 4.2-6.2 8.1-6.2 8.1Z"/></svg>',
    ripple: '<svg class="rh-ico" viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.2c1.8-1.6 3.4-1.6 5.2 0s3.4 1.6 5.2 0 2.4-1.2 3.6-.3"/><path d="M3 14.2c1.8-1.6 3.4-1.6 5.2 0s3.4 1.6 5.2 0 2.4-1.2 3.6-.3"/><circle cx="10" cy="5.2" r="1.4" fill="currentColor" stroke="none"/></svg>',
    egg: '<svg class="rh-ico" viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.2c3.2 0 5.5 4.4 5.5 8.1A5.5 5.5 0 0 1 4.5 11.3C4.5 7.6 6.8 3.2 10 3.2Z"/><path d="M7.6 10.6 9.6 9l2.4 1.9"/></svg>',
    quill: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 3.5c-4.5.4-8.4 3.4-10.2 8.2L5 15l3.3-1.3c4.8-1.8 7.8-5.7 8.2-10.2Z"/><path d="M5 15 3.4 16.6"/><path d="M8.5 11.5 12 8"/></svg>',
    seal: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="6.8"/><polygon points="10,5.8 11.4,8.6 14.4,10 11.4,11.4 10,14.2 8.6,11.4 5.6,10 8.6,8.6" fill="currentColor" fill-opacity="0.22"/></svg>',
    gift: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.2" y="8.2" width="13.6" height="8.6" rx="1.4"/><line x1="10" y1="8.2" x2="10" y2="16.8"/><path d="M2.5 5.8h15v2.4h-15V5.8Z"/><path d="M10 5.8c0-1.6-1.4-2.8-2.8-2.2-1 .4-1 2.2.8 2.2H10Zm0 0c0-1.6 1.4-2.8 2.8-2.2 1 .4 1 2.2-.8 2.2H10Z"/></svg>',
    cup: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5h9.5v4.8a4.2 4.2 0 0 1-4.2 4.2H8.2A4.2 4.2 0 0 1 4 12.3V7.5Z"/><path d="M13.5 8.6h1.6a2 2 0 0 1 0 4h-1.6"/><path d="M7.2 4.8c0-.9.8-1.4.8-2.2M10.4 4.8c0-.9.8-1.4.8-2.2"/></svg>',
    compass: '<svg class="rh-ico" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7"/><polygon points="12.8,7.2 11.1,11.1 7.2,12.8 8.9,8.9" fill="currentColor" fill-opacity="0.28"/></svg>',
    check: '<svg class="rh-ico" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4.5,10.4 8.2,14.1 15.6,6.4"/></svg>',
    lock: '<svg class="rh-ico" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="1.6"/><path d="M7 9V6.8a3 3 0 0 1 6 0V9"/></svg>',
    charm: '<svg class="rh-ico" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="10,2.6 12.4,7.4 17.6,8.2 13.8,11.9 14.7,17.2 10,14.7 5.3,17.2 6.2,11.9 2.4,8.2 7.6,7.4"/></svg>',
    wind: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.2h9.2a2.2 2.2 0 1 0-2.1-2.8"/><path d="M3 12h11.4a2.2 2.2 0 1 1-2.1 2.8"/><path d="M3 15.2h5.2"/></svg>',
    tea: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.8 8.2h9.6v4.4a4.2 4.2 0 0 1-4.2 4.2H8a4.2 4.2 0 0 1-4.2-4.2V8.2Z"/><path d="M13.4 9.2h1.6a1.9 1.9 0 0 1 0 3.8h-1.6"/><line x1="3.2" y1="17.2" x2="14.2" y2="17.2"/><path d="M7.2 5.6c0-1 .9-1.4.9-2.4M10.4 5.6c0-1 .9-1.4.9-2.4"/></svg>',
    cookie: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 10.6A6.6 6.6 0 1 1 9.4 3.5a2.4 2.4 0 0 0 2.7 2.8 2.4 2.4 0 0 0 2.5 2.4 2.2 2.2 0 0 0 1.9 1.9Z"/><circle cx="7.4" cy="9.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="11.2" cy="12.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="7.8" cy="13.4" r="0.8" fill="currentColor" stroke="none"/></svg>',
    flower: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17.2V9.8"/><path d="M10 13.8c-2.6 0-4.4-1.4-4.8-3.4 2.1-.2 3.8.8 4.8 2.4Z"/><path d="M10 12.6c2.5 0 4.2-1.3 4.6-3.2-2-.2-3.6.7-4.6 2.2Z"/><path d="M10 9.8c-2.3-.4-3.6-2.4-2.8-4.7 1.3.4 2.2 1.2 2.8 2.3.6-1.1 1.5-1.9 2.8-2.3.8 2.3-.5 4.3-2.8 4.7Z"/></svg>',
    blade: '<svg class="rh-ico" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.4 3.2 13.2 4.2 6.8 10.6l2.6 2.6 6.4-6.4 1-3.6Z"/><path d="M5.4 9.8 10.2 14.6"/><path d="M6.4 13.6 3.6 16.4"/></svg>',
    flame: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.4 2.8c.6 2.6-1.4 4-1.4 6 0 1.1.8 1.9 1.8 1.9 1.4 0 2.1-1.3 2.1-2.5 1.8 1.4 2.7 3.3 2.7 5.2a5.6 5.6 0 1 1-11.2 0c0-3 2.2-5.4 4.2-7.4.8-.8 1.4-2 1.8-3.2Z"/></svg>',
    leaf: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4c-5.8.3-10.2 3.8-11 9.5 3.8 1.6 8.3-.2 10.1-4.1.6-1.4.9-3.2.9-5.4Z"/><path d="M4.2 15.8C6.6 12.6 9.8 9.8 13.5 7.4"/></svg>',
    bell: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.2v1.6"/><path d="M6.2 13.8h7.6l-1.1-4.6a2.8 2.8 0 0 0-5.4 0l-1.1 4.6Z"/><path d="M8.5 15.6a1.6 1.6 0 0 0 3 0"/></svg>',
    butterfly: '<svg class="rh-ico" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6.2v8.2"/><path d="M10 9.4C8.2 6.2 4.2 5.4 3.4 8c-.6 2 1.2 3.5 3.4 3.4-1.5.8-2.2 2.5-1.1 3.7 1.3 1.3 3.4.3 4.3-2.3"/><path d="M10 9.4c1.8-3.2 5.8-4 6.6-1.4.6 2-1.2 3.5-3.4 3.4 1.5.8 2.2 2.5 1.1 3.7-1.3 1.3-3.4.3-4.3-2.3"/></svg>'
  };

  function ico(name) {
    return SVG_ICONS[name] || SVG_ICONS.crystal;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clampNum(v, lo, hi) {
    var n = Number(v);
    if (isNaN(n)) n = lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function getS() {
    if (typeof S !== 'undefined' && S) return S;
    return (root && root.S) ? root.S : null;
  }

  function getLOCS() {
    if (typeof LOCS !== 'undefined' && LOCS) return LOCS;
    return (root && (root.LOCS || root.__LOCS)) || {};
  }

  function getCHARS() {
    if (typeof CHARS !== 'undefined' && CHARS) return CHARS;
    return (root && (root.CHARS || root.__CHARS)) || {};
  }

  function getCOURSES() {
    if (typeof COURSES !== 'undefined' && COURSES) return COURSES;
    return (root && (root.COURSES || root.__COURSES)) || {};
  }

  function flagSafe(k, st) {
    var s = st || getS();
    return !!(s && s.flags && s.flags[k]);
  }

  function dateAtLeastSafe(y, m, st) {
    var s = st || getS();
    if (!s) return false;
    var sy = Number(s.year || 0);
    var sm = Number(s.month || 3);
    return sy > y || (sy === y && sm >= m);
  }

  function phaseAreaAllowedSafe(area, st) {
    var s = st || getS();
    if (!s) return true;
    var ph = s.phase || 'prologue';
    if (ph === 'prologue' || ph === 'childhood' || ph === 'youth') {
      return area === '公爵府' || area === '领地' || area === '王都';
    }
    if (ph === 'academy') {
      return area === '魔法大学' || area === '王都';
    }
    if (ph === 'journey' || ph === 'finale') {
      return area === '旅途' || area === '澄岚镇' || area === '赫兰' || area === '王都';
    }
    return true;
  }

  function resolvePortraitSafe(charId, emo) {
    var fn = (typeof resolvePortrait === 'function')
      ? resolvePortrait
      : (root && typeof root.resolvePortrait === 'function' ? root.resolvePortrait : null);
    if (fn) {
      try {
        var res = fn(charId, emo || 'normal');
        if (res) return res;
      } catch (e) {}
    }
    var pf = (typeof PORTRAIT_FILES !== 'undefined' && PORTRAIT_FILES)
      || (root && root.__PORTRAIT_FILES) || {};
    return pf[charId + '_' + (emo || 'normal')] || pf[charId + '_normal'] || '';
  }

  function sfxSafe(type) {
    try {
      if (typeof sfx === 'function') sfx(type);
      else if (root && typeof root.sfx === 'function') root.sfx(type);
    } catch (e) {}
  }

  function toastSafe(msg) {
    try {
      if (typeof toast === 'function') toast(msg);
      else if (root && typeof root.toast === 'function') root.toast(msg);
    } catch (e) {}
  }

  function saveSafe() {
    try {
      if (typeof save === 'function') save();
      else if (root && typeof root.save === 'function') root.save();
    } catch (e) {}
  }

  function updateHudSafe() {
    try {
      if (typeof updateHUD === 'function') updateHUD();
      else if (root && typeof root.updateHUD === 'function') root.updateHUD();
    } catch (e) {}
  }

  function isJsdomEnv() {
    return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
  }

  function prefersReducedMotion() {
    if (isJsdomEnv()) return true;
    try {
      return !!(typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function seasonKeyOf(st) {
    var s = st || getS() || {};
    return String(s.year || 0) + ':' + String(s.season || 0);
  }

  function seasonPhaseKeyOf(st) {
    var s = st || getS() || {};
    return String(s.year || 0) + ':' + String(s.season || 0) + ':' + String(s.phase || 'prologue');
  }

  function seasonIndexOf(val) {
    if (typeof val === 'number' && isFinite(val)) {
      var n = Math.floor(val);
      return n < 0 ? 0 : (n > 3 ? n % 4 : n);
    }
    var map = { '春': 0, '夏': 1, '秋': 2, '冬': 3 };
    if (typeof val === 'string') {
      var s = val.trim();
      if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
      var parsed = parseInt(s, 10);
      if (isFinite(parsed)) return parsed < 0 ? 0 : (parsed > 3 ? parsed % 4 : parsed);
    }
    return 0;
  }

  function formatDateSafe(st) {
    var s = st || getS() || {};
    var sns = ['春', '夏', '秋', '冬'];
    return String(s.year || 0) + '年 · ' + (sns[seasonIndexOf(s.season)] || '春');
  }

  function formatPhaseSafe(st) {
    var s = st || getS() || {};
    var map = { prologue: '序章', childhood: '童年', youth: '少女期', academy: '学院篇', journey: '旅途篇', finale: '终章' };
    return map[s.phase] || '旅途';
  }

  function formatAgeSafe(st) {
    var s = st || getS() || {};
    return (s.ageY || 0) <= 0 ? (String(s.ageD || 0) + '天') : (String(s.ageY) + '岁');
  }

  function formatTierSafe(st) {
    var s = st || getS() || {};
    var tiers = ['无', '初级', '中级', '高级', '圣级', '王级', '帝级', '神级'];
    return tiers[s.tier || 0] || '无';
  }

  function hasSkillSafe(id, st) {
    var s = st || getS();
    if (!s) return false;
    return (Array.isArray(s.skills) && s.skills.indexOf(id) !== -1)
      || (Array.isArray(s.skillsLearned) && s.skillsLearned.indexOf(id) !== -1);
  }

  function addStatSafe(k, delta, st) {
    var s = st || getS();
    if (!s) return;
    if (!s.stats) s.stats = { body: 5, mind: 15, mana: 10, charm: 8 };
    s.stats[k] = clampNum((s.stats[k] | 0) + delta, 0, 100);
  }

  function addExpSafe(n, st) {
    var s = st || getS();
    if (!s || !(n > 0)) return;
    if (s === getS() && typeof addExp === 'function') {
      try { addExp(n); return; } catch (e) {}
    }
    s.exp = Math.floor((s.exp || 0) + n);
    while (s.exp >= (s.next || 100)) {
      s.exp -= (s.next || 100);
      s.lv = (s.lv || 1) + 1;
      s.next = Math.floor((s.next || 100) * 1.15 + 20);
      s.mhp = (s.mhp || 8) + 3;
      s.mmp = (s.mmp || 12) + 5;
      s.atk = (s.atk || 1) + 1;
      s.mag = (s.mag || 4) + 2;
      s.pdef = (s.pdef || 0) + 1;
      s.mdef = (s.mdef || 0) + 1;
    }
  }

  function loveSafe(charId, delta, st) {
    var s = st || getS();
    if (!s || !charId || !delta) return;
    if (!s.love) s.love = {};
    s.love[charId] = clampNum((s.love[charId] || 0) + delta, 0, 5);
  }

  function knowSafe(charId, delta, st) {
    var s = st || getS();
    if (!s || !charId || !delta) return;
    if (!s.know) s.know = {};
    s.know[charId] = clampNum((s.know[charId] || 0) + delta, 0, 100);
  }

  function shiftAxisSilentOrLive(charId, pole, delta) {
    if (root.BranchingDirector && typeof root.BranchingDirector.shiftAxis === 'function') {
      try { root.BranchingDirector.shiftAxis(charId, pole, delta); return true; } catch (e) {}
    }
    return false;
  }

  /* =========================================================================
     一、Pillar 1：鲜活希尔维亚养成中枢 (#sylvia-hub) 与 36 句阶段心声
     ========================================================================= */
  var STAGE_VALID_EMOS = {
    child: ['normal', 'smile', 'wink', 'shy', 'serious', 'surprised', 'happy', 'sad', 'teary'],
    young: ['normal', 'smile', 'wink', 'shy', 'serious', 'surprised', 'happy', 'sad', 'teary'],
    teenage: ['normal', 'smile', 'wink', 'serious', 'sleepy', 'surprised', 'happy', 'sad', 'teary'],
    disguise: ['normal', 'smile', 'wink', 'serious', 'sleepy', 'surprised', 'happy', 'sad', 'teary']
  };

  var KEEPSAKE_CHARM_META = {
    ice_pebble: { id: 'ice_pebble', name: '冰蓝石子', note: '花园拾得的寒凉小石，握在掌心总能定神。', icon: 'crystal' },
    blue_vial: { id: 'blue_vial', name: '淡蓝小瓶', note: '药神留下的晴空玻璃瓶，瓶塞严实如初。', icon: 'spark' },
    shell_pin: { id: 'shell_pin', name: '月虹螺胸针', note: '三姐妹在夏礁拾贝制成的胸针，留着潮声微彩。', icon: 'charm' },
    aino_academy_handkerchief: { id: 'aino_academy_handkerchief', name: '雪纹手帕', note: '六瓣赫兰霜纹亚麻帕，叠放整齐带着松林冷香。', icon: 'crystal' },
    ebony_sword: { id: 'ebony_sword', name: '紫蝶剑穗', note: '系于乌木剑柄末端的亮紫蝶穗，伴随北行风雪。', icon: 'sword' },
    shop_ice_bookmark: { id: 'shop_ice_bookmark', name: '雪晶书签', note: '薄如蝉翼的雕花书签，夹在常翻的魔导笔记页间。', icon: 'book' },
    shop_silver_moon_clip: { id: 'shop_silver_moon_clip', name: '银月发夹', note: '素雅纤巧的银蓝月牙发夹，收拢鬓边碎发刚刚好。', icon: 'charm' },
    shop_frost_cedar_sachet: { id: 'shop_frost_cedar_sachet', name: '霜杉香囊', note: '盛着干霜杉针叶的小布囊，闻起来有公爵府冬园气息。', icon: 'spark' },
    shop_warming_frost_stone: { id: 'shop_warming_frost_stone', name: '温霜怀石', note: '内蕴微温的淡青石块，寒夜揣在袖袋里格外安心。', icon: 'crystal' }
  };

  // 4 阶段 (child / young / teenage / disguise) × 3 心境 (cozy / focused / tired) × 3 句 = 36 句
  var SYLVIA_TAP_LINES = {
    child: {
      cozy: [
        '纱帐外头的太阳暖融融的，今天也想就这样晒着光发一会儿呆。',
        '红茶混着奶油松饼的香气飘进廊下，公爵府的午后总是格外舒服。',
        '窗边微风拂过耳畔，既然好不容易重活一回，日子当然要慢悠悠地过。'
      ],
      focused: [
        '把一滴水凝成规整小冰珠其实挺有意思，比听长篇礼仪课省事多了。',
        '方才在长廊瞧见父亲批阅公文，这方世界的文字排布倒是比想象中齐整。',
        '先记熟府里每条回廊的去向，往后想偷溜去花园晒太阳才更省力气。'
      ],
      tired: [
        '小身子跑两步就犯困，眼皮沉得快抬不起来，先靠着软枕眯一阵吧。',
        '贝蒂姐姐刚才拉着我转了好几圈，连头发丝都跟着晃晕了。',
        '今日的礼仪练习足够长进，剩下的精力还是留给午睡比较划算。'
      ]
    },
    young: {
      cozy: [
        '图书室高窗漏下的日影正好落在膝头，翻几页游记再喝口清茶便很惬意。',
        '贝蒂又在练武场喊着要当全府第一，爱丽丝安安静静坐我身旁，这样便很好。',
        '花园里的鸢尾迎着夏风轻晃，趁教官还没唤人，先在这里多躲一阵清闲。'
      ],
      focused: [
        '水球与冰晶的衔接还能更省魔力，趁午后安静再推演两遍路径吧。',
        '爱丽丝近来听风越发敏锐，抽空得教她如何用轻柔水流帮自己省力。',
        '雷纳德叔叔讲起北境风物眉飞色舞，那些地理见闻记进册子里准用得上。'
      ],
      tired: [
        '一连抄完几页算术与古史笔记，手腕酸得发胀，真想立刻回房间躺平。',
        '陪姐姐在庭院追完蝴蝶又听完一轮剑术课，今晚定要早些熄灯歇息。',
        '魔力池快见底时会有点发冷，去厨房讨杯热牛奶暖暖手脚再说。'
      ]
    },
    teenage: {
      cozy: [
        '钟塔顶层的风掠过尖顶，偶尔抛开榜单与课业俯瞰校园，心情也跟着敞亮起来。',
        '食堂今日供应提拉米苏，若是艾玛没抢先下手，下午茶便有着落了。',
        '靠墙双人桌总留着一格明亮天光，和诺艾儿各自看书互不打扰，最是自在。'
      ],
      focused: [
        '冰系教室窗台凉意正好，趁着眼下无人，再练几回不经手隔空凝冰的手感。',
        '梅林阻率公式与实战里的魔力分配还得对照核验，丝毫马虎都容易吃亏。',
        '纪念林那几株树苗抽了新枝，回宿舍前顺路绕去看看土壤湿润与否吧。'
      ],
      tired: [
        '连上水冰两门实操课再加训练场切磋，肩背紧绷得厉害，得泡壶薄荷茶松松弦。',
        '图书馆三排古籍翻得眼眶发涩，先把要点收进脑海，回寝室好好补一觉。',
        '傍晚钟声敲过之后走廊总算清静，今天就容我偷个懒，什么推导也不想了。'
      ]
    },
    disguise: {
      cozy: [
        '墨色长发束进深绿发带，提着乌木剑走在陌生长街，倒也落得一身轻快。',
        '霁馆院角飘来温热米粥香，卸下旧日姓氏以眷寒渔之名歇脚，心里挺踏实。',
        '寒风卷过石阶，手心里那方雪纹亚麻帕仍叠得齐整，足够抵挡漫长霜季。'
      ],
      focused: [
        '生根步讲究脚底稳如磐石，出剑时肩肘彻底放柔，方能借风雪顺势送刀。',
        '恒温薄冰膜收边务必厚薄均匀，药箱封妥了，北行路上大伙儿才少受些苦。',
        '澄岚公会的悬赏与边关哨讯都得细细过目，既扮作普通魔剑士，分寸便要拿稳。'
      ],
      tired: [
        '顶着峡谷凛风巡完东段哨墙，指尖都冻得发僵，待会儿讨碗热麦汤暖暖身子。',
        '连日奔波在北林与官道之间，眼皮直打架，今晚就靠着炉火早些合眼吧。',
        '手背旧擦伤遇冷隐隐发紧，擦些白藓膏再歇半晌，明日还得继续往前走。'
      ]
    }
  };

  var _tapIndexMap = {};
  var _tapResetTimer = null;
  var _bubbleHideTimer = null;
  var _activeCharmTipId = null;

  function ensureRaisingState(targetS) {
    var st = targetS || getS();
    if (!st) return null;
    if (typeof st.leisure !== 'number' || isNaN(st.leisure)) {
      st.leisure = (typeof st.mood === 'number' && !isNaN(st.mood)) ? clampNum(st.mood, 0, 100) : 75;
    } else {
      st.leisure = clampNum(Math.round(st.leisure), 0, 100);
    }
    st.mood = st.leisure;
    if (!Array.isArray(st.leisureHistory)) st.leisureHistory = [];
    if (!Array.isArray(st.deskCharms)) st.deskCharms = [];
    if (!Array.isArray(st.diaryHistory)) st.diaryHistory = [];
    if (!st.cozyBag || typeof st.cozyBag !== 'object' || Array.isArray(st.cozyBag)) st.cozyBag = {};
    if (!st.giftedSeason || typeof st.giftedSeason !== 'object' || Array.isArray(st.giftedSeason)) st.giftedSeason = {};
    if (!st.mailboxRead || typeof st.mailboxRead !== 'object' || Array.isArray(st.mailboxRead)) st.mailboxRead = {};
    if (!st.mailboxClaimed || typeof st.mailboxClaimed !== 'object' || Array.isArray(st.mailboxClaimed)) st.mailboxClaimed = {};
    if (st.seasonLedger === undefined) st.seasonLedger = null;
    if (typeof st.lastAction !== 'string') st.lastAction = '';
    if (st.seasonCharsMeta === undefined) st.seasonCharsMeta = null;
    syncDeskCharms(st);
    return st;
  }

  function syncDeskCharms(st) {
    var s = st || getS();
    if (!s) return [];
    if (!Array.isArray(s.deskCharms)) s.deskCharms = [];
    var addCharm = function (id) {
      if (KEEPSAKE_CHARM_META[id] && s.deskCharms.indexOf(id) === -1) {
        s.deskCharms.push(id);
      }
    };
    var inv = Array.isArray(s.inv) ? s.inv : [];
    for (var i = 0; i < inv.length; i++) {
      var it = inv[i];
      if (!it || !it.id) continue;
      if (KEEPSAKE_CHARM_META[it.id]) addCharm(it.id);
      if (it.id === 'aino_handkerchief') addCharm('aino_academy_handkerchief');
    }
    if (s.relicsUnlocked) {
      Object.keys(s.relicsUnlocked).forEach(function (rid) {
        if (s.relicsUnlocked[rid] && KEEPSAKE_CHARM_META[rid]) addCharm(rid);
      });
    }
    if (s.cozyBag) {
      ['shop_ice_bookmark', 'shop_silver_moon_clip', 'shop_frost_cedar_sachet', 'shop_warming_frost_stone'].forEach(function (cid) {
        if ((s.cozyBag[cid] || 0) > 0) addCharm(cid);
      });
    }
    return s.deskCharms;
  }

  function getMoodInfo(leisureVal) {
    var v = clampNum(leisureVal == null ? 75 : leisureVal, 0, 100);
    if (v >= 70) {
      return { key: 'cozy', label: '惬意', score: v, hint: '从容舒展，修习与人情交流格外顺手' };
    }
    if (v >= 35) {
      return { key: 'focused', label: '专注', score: v, hint: '心绪澄净，步调沉稳而有序' };
    }
    return { key: 'tired', label: '小倦', score: v, hint: '略有倦意，宜饮茶闲憩或早些歇息' };
  }

  function adjustLeisure(delta, targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return 75;
    st.leisure = clampNum(Math.round((st.leisure || 0) + Number(delta || 0)), 0, 100);
    st.mood = st.leisure;
    return st.leisure;
  }

  function getSylviaStage(targetS) {
    var st = targetS || getS();
    if (!st) return 'young';
    if (st.alias === '眷寒渔') return 'disguise';
    var age = Number(st.ageY || 0);
    if (age <= 5) return 'child';
    if (age <= 11) return 'young';
    return 'teenage';
  }

  function pickSafeSylviaEmo(stage, desired) {
    var valid = STAGE_VALID_EMOS[stage] || STAGE_VALID_EMOS.young;
    if (valid.indexOf(desired) !== -1) return desired;
    if (desired === 'sleepy') return valid.indexOf('shy') !== -1 ? 'shy' : 'normal';
    if (desired === 'shy') return valid.indexOf('smile') !== -1 ? 'smile' : 'normal';
    return 'normal';
  }

  function restingEmoFor(stage, moodKey) {
    if (moodKey === 'cozy') return pickSafeSylviaEmo(stage, 'smile');
    if (moodKey === 'tired') return pickSafeSylviaEmo(stage, 'sleepy');
    return 'normal';
  }

  function shouldShowSylviaHub(targetS) {
    var st = targetS || getS();
    if (!st || typeof document === 'undefined') return false;
    if (!st.freeRoam) return false;
    if (Number(st.ageY || 0) < 1) return false;
    var body = document.body;
    if (!body) return false;
    if (
      body.classList.contains('ui-hidden') ||
      body.classList.contains('pov-hidden') ||
      body.classList.contains('cg-mode') ||
      body.classList.contains('stage-pre-system') ||
      body.classList.contains('stage-story') ||
      body.classList.contains('stage-infant')
    ) {
      return false;
    }
    var gs = document.getElementById('game-screen');
    if (gs && gs.classList.contains('hidden')) return false;
    return true;
  }

  function ensureSylviaHubDOM() {
    if (typeof document === 'undefined') return null;
    var stageEl = document.getElementById('stage');
    if (!stageEl) return null;
    var hub = document.getElementById('sylvia-hub');
    if (hub) return hub;

    hub = document.createElement('div');
    hub.id = 'sylvia-hub';
    hub.className = 'sylvia-hub hidden';
    hub.setAttribute('data-density', 'solo');
    hub.innerHTML =
      '<div class="sh-corner-controls">' +
        '<div class="sh-top-strip">' +
          '<button type="button" id="hud-mood" class="hud-mood-pill" data-mood="cozy" aria-label="希尔维亚当前心境">' +
            '<span class="hm-ico" aria-hidden="true">' + ico('spark') + '</span>' +
            '<span class="hm-label">惬意</span>' +
            '<em class="hm-val">75</em>' +
          '</button>' +
          '<div id="sh-charms" class="sh-charms" aria-label="随身纪念挂件"></div>' +
        '</div>' +
        '<div class="sylvia-ritual-dock" role="toolbar" aria-label="悠闲养成快捷栏">' +
          '<button type="button" id="btn-raising-schedule" class="rh-dock-chip">' +
            '<span class="rh-dc-ico">' + ico('calendar') + '</span>' +
            '<span class="rh-dc-lbl"><span class="rh-dc-full">日程排班</span><span class="rh-dc-short">日程</span></span>' +
          '</button>' +
          '<button type="button" id="btn-raising-shop" class="rh-dock-chip">' +
            '<span class="rh-dc-ico">' + ico('basket') + '</span>' +
            '<span class="rh-dc-lbl"><span class="rh-dc-full">集市小铺</span><span class="rh-dc-short">小铺</span></span>' +
          '</button>' +
          '<button type="button" id="btn-raising-mailbox" class="rh-dock-chip">' +
            '<span class="rh-dc-ico">' + ico('envelope') + '</span>' +
            '<span class="rh-dc-lbl"><span class="rh-dc-full">火漆信匣</span><span class="rh-dc-short">信匣</span></span>' +
            '<em id="rh-mail-badge" class="rh-badge-count hidden">0</em>' +
          '</button>' +
          '<button type="button" id="btn-raising-ending" class="rh-dock-chip rh-dock-ending hidden">' +
            '<span class="rh-dc-ico">' + ico('crown') + '</span>' +
            '<span class="rh-dc-lbl"><span class="rh-dc-full">终幕回响</span><span class="rh-dc-short">终幕</span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div id="sh-charm-popover" class="sh-charm-popover hidden" role="status" aria-live="polite"></div>' +
      '<div class="sh-avatar-stage">' +
        '<div id="sylvia-bubble" class="sylvia-bubble hidden" role="status" aria-live="polite"></div>' +
        '<button type="button" id="sylvia-figure" class="sylvia-figure" aria-label="轻触希尔维亚互动">' +
          '<span class="sh-pedestal" aria-hidden="true"></span>' +
          '<span class="sh-frame"><img id="sylvia-hub-img" class="sh-img" src="" alt="希尔维亚"/></span>' +
          '<span class="sh-tap-cue" aria-hidden="true">轻触互动</span>' +
        '</button>' +
      '</div>';

    stageEl.appendChild(hub);

    var figBtn = hub.querySelector('#sylvia-figure');
    if (figBtn) {
      figBtn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        tapSylvia();
      };
    }
    var moodBtn = hub.querySelector('#hud-mood');
    if (moodBtn) {
      moodBtn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var st = ensureRaisingState();
        var info = getMoodInfo(st ? st.leisure : 75);
        showCharmPopover('心境 · ' + info.label + '（悠闲度 ' + info.score + '/100）', info.hint);
      };
    }
    var bSched = hub.querySelector('#btn-raising-schedule');
    if (bSched) {
      bSched.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        sfxSafe('click');
        openSchedulePlanner();
      };
    }
    var bShop = hub.querySelector('#btn-raising-shop');
    if (bShop) {
      bShop.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        sfxSafe('click');
        openShopModal();
      };
    }
    var bMail = hub.querySelector('#btn-raising-mailbox');
    if (bMail) {
      bMail.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        sfxSafe('click');
        openMailboxModal();
      };
    }
    var bEnd = hub.querySelector('#btn-raising-ending');
    if (bEnd) {
      bEnd.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        sfxSafe('open');
        showEndingScreen();
      };
    }
    return hub;
  }

  function showCharmPopover(title, desc) {
    if (typeof document === 'undefined') return;
    var pop = document.getElementById('sh-charm-popover');
    if (!pop) return;
    if (_activeCharmTipId === title && !pop.classList.contains('hidden')) {
      pop.classList.add('hidden');
      _activeCharmTipId = null;
      return;
    }
    _activeCharmTipId = title;
    pop.innerHTML = '<strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(desc) + '</span>';
    pop.classList.remove('hidden');
  }

  function hideCharmPopover() {
    if (typeof document === 'undefined') return;
    var pop = document.getElementById('sh-charm-popover');
    if (pop) pop.classList.add('hidden');
    _activeCharmTipId = null;
  }

  function tapSylvia() {
    var st = ensureRaisingState();
    if (!st || !shouldShowSylviaHub(st)) return null;
    sfxSafe('click');

    var stage = getSylviaStage(st);
    var mood = getMoodInfo(st.leisure);
    var pool = (SYLVIA_TAP_LINES[stage] && SYLVIA_TAP_LINES[stage][mood.key]) || SYLVIA_TAP_LINES.young.cozy;
    var key = stage + ':' + mood.key;
    var idx = (_tapIndexMap[key] || 0) % pool.length;
    _tapIndexMap[key] = idx + 1;
    var line = pool[idx];

    var emoPool = mood.key === 'cozy'
      ? ['smile', 'wink', 'shy']
      : (mood.key === 'focused' ? ['serious', 'smile', 'normal'] : ['sleepy', 'normal', 'serious']);
    var chosenEmo = pickSafeSylviaEmo(stage, emoPool[idx % emoPool.length]);

    var img = document.getElementById('sylvia-hub-img');
    var fig = document.getElementById('sylvia-figure');
    var bubble = document.getElementById('sylvia-bubble');
    if (img) {
      var src = resolvePortraitSafe('sylvia', chosenEmo);
      if (src) img.src = src;
      img.setAttribute('data-emo', chosenEmo);
    }
    if (fig) {
      fig.classList.remove('is-tapped');
      void fig.offsetWidth;
      fig.classList.add('is-tapped');
    }
    if (bubble) {
      bubble.textContent = line;
      bubble.classList.remove('hidden');
      bubble.setAttribute('data-stage', stage);
      bubble.setAttribute('data-mood', mood.key);
    }

    clearTimeout(_tapResetTimer);
    clearTimeout(_bubbleHideTimer);
    if (!isJsdomEnv()) {
      _tapResetTimer = setTimeout(function () {
        var curS = getS();
        var curImg = document.getElementById('sylvia-hub-img');
        if (curImg && curS) {
          var restEmo = restingEmoFor(getSylviaStage(curS), getMoodInfo(curS.leisure).key);
          var restSrc = resolvePortraitSafe('sylvia', restEmo);
          if (restSrc) curImg.src = restSrc;
          curImg.setAttribute('data-emo', restEmo);
        }
        var curFig = document.getElementById('sylvia-figure');
        if (curFig) curFig.classList.remove('is-tapped');
      }, 2800);
      _bubbleHideTimer = setTimeout(function () {
        var curB = document.getElementById('sylvia-bubble');
        if (curB) curB.classList.add('hidden');
      }, 4200);
    }

    return { stage: stage, mood: mood.key, emo: chosenEmo, line: line };
  }

  function syncSylviaHub(targetS) {
    if (typeof document === 'undefined') return null;
    var st = ensureRaisingState(targetS);
    var hub = ensureSylviaHubDOM();
    if (!hub) return null;

    if (!st || !shouldShowSylviaHub(st)) {
      hub.classList.add('hidden');
      hideCharmPopover();
      return hub;
    }

    hub.classList.remove('hidden');
    var peeps = [];
    try {
      if (typeof whoIsHere === 'function') peeps = whoIsHere() || [];
      else if (root && typeof root.whoIsHere === 'function') peeps = root.whoIsHere() || [];
      else peeps = getNpcsAtLoc(st.loc, st);
    } catch (e) {
      peeps = getNpcsAtLoc(st.loc, st);
    }
    var hasStageNpc = peeps.length > 0;
    if (!hasStageNpc && typeof document !== 'undefined') {
      var stageSlots = document.querySelectorAll('#portraits .p-slot:not(.hidden)');
      if (stageSlots && stageSlots.length > 0) hasStageNpc = true;
    }
    var density = hasStageNpc ? 'with-npc' : 'solo';
    hub.setAttribute('data-density', density);

    var stage = getSylviaStage(st);
    var mood = getMoodInfo(st.leisure);
    hub.setAttribute('data-stage', stage);

    var img = hub.querySelector('#sylvia-hub-img');
    if (img) {
      var emo = restingEmoFor(stage, mood.key);
      var src = resolvePortraitSafe('sylvia', emo);
      if (src && img.getAttribute('src') !== src) {
        img.src = src;
      }
      img.alt = st.alias === '眷寒渔' ? '眷寒渔' : '希尔维亚';
      img.setAttribute('data-emo', emo);
    }

    var moodEl = hub.querySelector('#hud-mood');
    if (moodEl) {
      moodEl.setAttribute('data-mood', mood.key);
      var lbl = moodEl.querySelector('.hm-label');
      var val = moodEl.querySelector('.hm-val');
      if (lbl) lbl.textContent = mood.label;
      if (val) val.textContent = String(mood.score);
    }

    // 随身纪念挂件（至多展示 4 枚，可点击查看手札小记）
    var charmsEl = hub.querySelector('#sh-charms');
    if (charmsEl) {
      var charms = syncDeskCharms(st).slice(-4);
      charmsEl.innerHTML = charms.map(function (cid) {
        var meta = KEEPSAKE_CHARM_META[cid];
        if (!meta) return '';
        return '<button type="button" class="sh-charm-btn" data-charm-id="' + escapeHtml(cid) + '" title="' + escapeHtml(meta.name) + '" aria-label="' + escapeHtml(meta.name) + '">' + ico(meta.icon) + '</button>';
      }).join('');
      charmsEl.querySelectorAll('[data-charm-id]').forEach(function (b) {
        b.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          var meta = KEEPSAKE_CHARM_META[b.getAttribute('data-charm-id')];
          if (meta) {
            sfxSafe('click');
            showCharmPopover(meta.name, meta.note);
          }
        };
      });
    }

    // 未读火漆来信角标与子入口渐进解锁（严格保留原有 DOM ID）
    var ageY = Number(st.ageY || 0);
    var unread = getUnreadMailCount(st);
    var badgeEl = hub.querySelector('#rh-mail-badge');
    if (badgeEl) {
      badgeEl.textContent = String(unread);
      badgeEl.classList.toggle('hidden', unread <= 0);
    }

    var schedBtn = hub.querySelector('#btn-raising-schedule');
    if (schedBtn) {
      schedBtn.classList.toggle('hidden', ageY < 1);
    }
    var shopBtn = hub.querySelector('#btn-raising-shop');
    if (shopBtn) {
      shopBtn.classList.toggle('hidden', ageY < 4);
    }
    var mailBtn = hub.querySelector('#btn-raising-mailbox');
    if (mailBtn) {
      mailBtn.classList.toggle('hidden', !(ageY >= 10 || unread > 0));
    }

    // 第三/四卷开启「终幕回响」入口
    var endBtn = hub.querySelector('#btn-raising-ending');
    if (endBtn) {
      endBtn.classList.toggle('hidden', !canOpenEndingForecast(st));
    }

    return hub;
  }

  /* =========================================================================
     二、Pillar 2：预掷可视化舆图引擎 (NPC_SCHEDULE_RULES & renderVisualMap)
     ========================================================================= */
  var LOC_BG_THUMB = {
    nursery: 'assets/bg/nursery.jpg',
    hallway: 'assets/bg/hallway.jpg',
    parlor: 'assets/bg/parlor.jpg',
    garden: 'assets/bg/garden.jpg',
    study: 'assets/bg/study.jpg',
    dining: 'assets/bg/dining.jpg',
    kitchen: 'assets/bg/kitchen.jpg',
    training: 'assets/bg/training.jpg',
    balcony: 'assets/bg/balcony.jpg',
    chapel: 'assets/bg/chapel.jpg',
    cellar: 'assets/bg/cellar.jpg',
    secret: 'assets/bg_night.jpg',
    town: 'assets/bg_town.jpg',
    market: 'assets/bg_town.jpg',
    beach: 'assets/bg/beach.jpg',
    ownroom: 'assets/bg/ownroom.jpg',
    dorm: 'assets/bg/dorm.jpg',
    water_class: 'assets/bg/classroom.jpg',
    ice_class: 'assets/bg/ice_classroom.jpg',
    library: 'assets/bg/library.jpg',
    cafeteria: 'assets/bg/cafeteria.jpg',
    clocktower: 'assets/bg/clocktower.jpg',
    flowerhouse: 'assets/bg/flowerhouse.jpg',
    training_field: 'assets/bg/training.jpg',
    memorial: 'assets/bg/memorial.jpg',
    auditorium: 'assets/bg/auditorium.jpg',
    road: 'assets/bg_plain.jpg',
    jikan: 'assets/bg/jikan.jpg',
    chenglan_guild: 'assets/bg/chenglan_guild.jpg',
    northforest: 'assets/bg/north_forest.jpg',
    ice_canyon: 'assets/bg/ice_canyon.jpg'
  };

  var SHOP_LOC_SET = {
    parlor: true,
    town: true,
    market: true,
    cafeteria: true,
    chenglan_guild: true,
    ice_canyon: true
  };

  // 严格遵守原著角色出现纪律：海伦娜绝不在食堂随机出现；艾诺在冰融之际后退出学院、远行的风(下)后驻防冰封峡谷
  var NPC_SCHEDULE_RULES = {
    early: [
      {
        id: 'sophia',
        cond: function () { return true; },
        locs: function (st) {
          var base = (st.ageY || 0) >= 8 ? ['ownroom', 'parlor', 'dining', 'garden', 'study', 'kitchen', 'chapel', 'hallway', 'beach'] : ['nursery', 'parlor', 'dining', 'hallway', 'garden', 'study', 'kitchen', 'chapel'];
          return base;
        }
      },
      {
        id: 'beatrice',
        cond: function (st) { return !flagSafe('ch_beatrice_leaves', st); },
        locs: function (st) {
          var base = (st.ageY || 0) >= 8 ? ['parlor', 'garden', 'dining', 'training', 'balcony', 'beach', 'hallway', 'ownroom'] : ['nursery', 'parlor', 'garden', 'dining', 'hallway', 'training', 'kitchen', 'balcony'];
          return base;
        }
      },
      {
        id: 'alice',
        cond: function (st) { return dateAtLeastSafe(2, 9, st); },
        locs: function (st) {
          return (st.ageY || 0) >= 8
            ? ['ownroom', 'parlor', 'study', 'garden', 'dining', 'balcony', 'beach', 'hallway']
            : ['nursery', 'parlor', 'study', 'garden', 'dining', 'balcony', 'hallway'];
        }
      },
      {
        id: 'claude',
        cond: function (st) { return (st.ageY || 0) >= 1; },
        locs: function (st) {
          var list = ['parlor', 'dining', 'study', 'hallway'];
          if ((st.ageY || 0) >= 4) list.push('chapel');
          if ((st.ageY || 0) >= 6) list.push('training', 'cellar');
          return list;
        }
      }
    ],
    academy: [
      {
        id: 'emma',
        cond: function () { return true; },
        locs: function () { return ['dorm', 'cafeteria', 'water_class', 'library']; }
      },
      {
        id: 'noelle',
        cond: function (st) { return flagSafe('met_noelle', st); },
        locs: function () { return ['library', 'cafeteria', 'dorm', 'water_class', 'clocktower']; }
      },
      {
        id: 'anna',
        cond: function () { return true; },
        locs: function () { return ['water_class', 'cafeteria', 'auditorium']; }
      },
      {
        id: 'hol',
        cond: function () { return true; },
        locs: function () { return ['ice_class', 'library', 'auditorium']; }
      },
      {
        id: 'aino',
        cond: function (st) { return flagSafe('met_aino', st) && !flagSafe('ch_ice_melt_1', st); },
        locs: function () { return ['ice_class', 'training_field', 'flowerhouse']; }
      },
      {
        id: 'ajun',
        cond: function (st) { return flagSafe('met_ajun', st); },
        locs: function () { return ['cafeteria']; }
      },
      {
        id: 'charlotte',
        cond: function (st) { return flagSafe('met_charlotte', st) || dateAtLeastSafe(12, 3, st); },
        locs: function () { return ['memorial']; }
      },
      {
        id: 'beatrice',
        cond: function () { return true; },
        locs: function (st) { return flagSafe('ch_tree', st) ? ['training_field', 'memorial'] : ['training_field']; }
      },
      {
        id: 'alice',
        cond: function (st) { return dateAtLeastSafe(14, 3, st); },
        locs: function (st) { return flagSafe('ch_tree', st) ? ['dorm', 'cafeteria', 'library', 'memorial'] : ['dorm', 'cafeteria', 'library']; }
      }
    ],
    journey: [
      {
        id: 'ji',
        cond: function (st) { return !flagSafe('ch_distant_wind_1', st); },
        locs: function () { return ['jikan']; }
      },
      {
        id: 'jilan',
        cond: function (st) { return !flagSafe('ch_distant_wind_1', st); },
        locs: function () { return ['jikan']; }
      },
      {
        id: 'masha',
        cond: function () { return true; },
        locs: function () { return ['chenglan_guild']; }
      },
      {
        id: 'aino',
        cond: function (st) { return flagSafe('ch_distant_wind_1', st); },
        locs: function () { return ['ice_canyon']; }
      },
      {
        id: 'musa',
        cond: function (st) { return flagSafe('ch_distant_wind_1', st); },
        locs: function () { return ['ice_canyon']; }
      }
    ]
  };

  function getScheduleBucketForPhase(phase) {
    if (phase === 'academy') return NPC_SCHEDULE_RULES.academy;
    if (phase === 'journey' || phase === 'finale') return NPC_SCHEDULE_RULES.journey;
    return NPC_SCHEDULE_RULES.early;
  }

  function rollSeasonChars(targetS, force) {
    var st = ensureRaisingState(targetS);
    if (!st) return {};
    if (!st.seasonChars || typeof st.seasonChars !== 'object') st.seasonChars = {};
    var sk = st.season != null ? st.season : 0;
    var metaKey = seasonPhaseKeyOf(st);
    var curMap = st.seasonChars[sk];
    var hasCurEntries = !!(curMap && typeof curMap === 'object' && Object.keys(curMap).length > 0);

    // 向后兼容：若外部测试手动注入了 seasonChars 且未带 seasonCharsMeta，则完整尊重
    if (!force && hasCurEntries && !st.seasonCharsMeta) {
      return curMap;
    }
    if (!force && hasCurEntries && st.seasonCharsMeta && st.seasonCharsMeta.key === metaKey) {
      return curMap;
    }

    var locsObj = getLOCS();
    var rules = getScheduleBucketForPhase(st.phase);
    var rolled = {};

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!rule.cond(st)) continue;
      var rawCand = typeof rule.locs === 'function' ? rule.locs(st) : rule.locs;
      var valid = (rawCand || []).filter(function (lid) {
        var L = locsObj[lid];
        return !!(L && L.unlock && phaseAreaAllowedSafe(L.area, st));
      });
      // 若处于单元测试直接设定 S.loc 的场景（部分房间尚未走剧情解锁），允许按阶段区域兜底
      if (!valid.length) {
        valid = (rawCand || []).filter(function (lid) {
          var L = locsObj[lid];
          return !!(L && phaseAreaAllowedSafe(L.area, st));
        });
      }
      if (!valid.length) continue;
      rolled[rule.id] = valid[Math.floor(Math.random() * valid.length)];
    }

    st.seasonChars[sk] = rolled;
    st.seasonCharsMeta = { key: metaKey };
    return rolled;
  }

  function getNpcsAtLoc(locId, targetS) {
    var st = ensureRaisingState(targetS);
    if (!st || !locId) return [];
    var sk = st.season != null ? st.season : 0;
    var curMap = st.seasonChars && st.seasonChars[sk];
    var metaKey = seasonPhaseKeyOf(st);
    var hasCurEntries = !!(curMap && typeof curMap === 'object' && Object.keys(curMap).length > 0);

    if (!hasCurEntries) {
      curMap = rollSeasonChars(st, true);
    } else if (st.seasonCharsMeta && st.seasonCharsMeta.key !== metaKey) {
      curMap = rollSeasonChars(st, true);
    }

    var result = [];
    Object.keys(curMap || {}).forEach(function (cid) {
      if (curMap[cid] !== locId) return;
      // 硬性防违规守卫
      if (cid === 'helena') return;
      if (st.phase === 'academy' && cid === 'aino' && flagSafe('ch_ice_melt_1', st)) return;
      if ((st.phase === 'journey' || st.phase === 'finale') && (cid === 'ji' || cid === 'jilan') && flagSafe('ch_distant_wind_1', st)) return;
      if (result.indexOf(cid) === -1) result.push(cid);
    });
    return result;
  }

  function hasVignetteAtLoc(locId, st) {
    if (!root.BranchingDirector || !Array.isArray(root.BranchingDirector.VIGNETTE_CATALOG)) return false;
    var list = root.BranchingDirector.VIGNETTE_CATALOG;
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || !Array.isArray(v.locs) || v.locs.indexOf(locId) === -1) continue;
      try {
        if (typeof v.canPlay === 'function' && v.canPlay(st)) return true;
      } catch (e) {}
    }
    if (locId === 'jikan' && (st.phase === 'journey' || st.phase === 'finale') && !flagSafe('ch_distant_wind_1', st)) {
      var c = st.causal || {};
      var triggered = !!(c.payoffsTriggered && c.payoffsTriggered.northern_vow);
      if (!triggered && typeof root.BranchingDirector.canTriggerNorthernVow === 'function') {
        try { if (root.BranchingDirector.canTriggerNorthernVow(st)) return true; } catch (e) {}
      }
    }
    return false;
  }

  function hasCombatSpotAtLoc(locId, st) {
    if (locId === 'northforest') return true;
    if (locId === 'training_field' && flagSafe('met_aino', st) && !flagSafe('ch_ice_melt_1', st)) return true;
    if (locId === 'ice_canyon' && flagSafe('ch_distant_wind_1', st)) return true;
    return false;
  }

  function hasUnclaimedEggAtLoc(L, st) {
    if (!L || !Array.isArray(L.tags) || L.tags.indexOf('egg') === -1) return false;
    if (L.id === 'flowerhouse' && flagSafe('ch_ice_melt_1', st)) return false;
    var eggs = (st && Array.isArray(st.eggs)) ? st.eggs : [];
    return eggs.indexOf(L.id) === -1;
  }

  function renderVisualMap(targetS) {
    if (typeof document === 'undefined') return false;
    var grid = document.getElementById('map-grid');
    var overlay = document.getElementById('map-overlay');
    if (!grid) return false;
    var st = ensureRaisingState(targetS);
    if (!st) return false;

    rollSeasonChars(st, false);

    var locsObj = getLOCS();
    var charsObj = getCHARS();
    var phaseLocs = Object.values(locsObj).filter(function (L) {
      if (!L || !L.unlock || !phaseAreaAllowedSafe(L.area, st)) return false;
      if ((st.phase === 'journey' || st.phase === 'finale') && (L.area === '魔法大学' || L.id === 'market')) return false;
      if ((st.ageY || 0) < 1 && L.id !== 'nursery' && L.id !== 'ownroom') return false;
      return true;
    });

    // 按区域分组：当前所在区域永远置顶，其余按已解锁地点数降序排列
    var areaOrder = [];
    var areaGroups = {};
    var curArea = (locsObj[st.loc] && locsObj[st.loc].area) || null;
    phaseLocs.forEach(function (L) {
      var a = L.area || '其他';
      if (!areaGroups[a]) {
        areaGroups[a] = [];
        areaOrder.push(a);
      }
      areaGroups[a].push(L);
    });
    areaOrder.sort(function (a, b) {
      if (a === curArea && b !== curArea) return -1;
      if (b === curArea && a !== curArea) return 1;
      var diff = areaGroups[b].length - areaGroups[a].length;
      if (diff !== 0) return diff;
      return a.localeCompare(b, 'zh-CN');
    });
    if (curArea && areaGroups[curArea] && areaGroups[curArea].length > 1) {
      areaGroups[curArea].sort(function (a, b) {
        if (a.id === st.loc && b.id !== st.loc) return -1;
        if (b.id === st.loc && a.id !== st.loc) return 1;
        return 0;
      });
    }

    if (overlay) overlay.classList.add('rh-visual-map-active');
    grid.classList.add('rh-visual-map-grid');
    grid.innerHTML = '';

    areaOrder.forEach(function (areaName) {
      var sec = document.createElement('div');
      sec.className = 'rh-map-section';

      var head = document.createElement('div');
      head.className = 'rh-map-area-head';
      head.innerHTML = '<span class="rh-map-area-title">' + escapeHtml(areaName) + '</span><span class="rh-map-area-cnt">' + areaGroups[areaName].length + ' 处</span>';
      sec.appendChild(head);

      var cardsWrap = document.createElement('div');
      cardsWrap.className = 'rh-map-cards';

      areaGroups[areaName].forEach(function (L) {
        var isHere = st.loc === L.id;
        var thumb = LOC_BG_THUMB[L.id] || 'assets/bg_plain.jpg';
        var npcs = getNpcsAtLoc(L.id, st);

        var badges = [];
        if (hasVignetteAtLoc(L.id, st)) {
          badges.push('<span class="rh-map-badge badge-vignette">' + ico('ripple') + '<span>暗流</span></span>');
        }
        if (hasCombatSpotAtLoc(L.id, st)) {
          badges.push('<span class="rh-map-badge badge-combat">' + ico('sword') + '<span>实战</span></span>');
        }
        if (SHOP_LOC_SET[L.id]) {
          badges.push('<span class="rh-map-badge badge-shop">' + ico('basket') + '<span>集市</span></span>');
        }
        if (hasUnclaimedEggAtLoc(L, st)) {
          badges.push('<span class="rh-map-badge badge-egg">' + ico('egg') + '<span>彩蛋</span></span>');
        }

        var npcHtml = npcs.map(function (cid) {
          var cm = charsObj[cid] || { short: cid };
          var av = resolvePortraitSafe(cid, 'normal');
          var lv = (st.love && st.love[cid]) || 0;
          return (
            '<span class="map-npc-pin" data-char="' + escapeHtml(cid) + '" title="' + escapeHtml(cm.short) + ' · 好感 ' + lv + '/5">' +
              (av ? '<img src="' + escapeHtml(av) + '" alt="' + escapeHtml(cm.short) + '"/>' : '<span class="mnp-init">' + escapeHtml((cm.short || cid).slice(0, 1)) + '</span>') +
              (lv > 0 ? '<em class="mnp-heart">' + ico('heartFill') + '<b>' + lv + '</b></em>' : '') +
              '<span class="map-npc-tip">' + escapeHtml(cm.short) + '</span>' +
            '</span>'
          );
        }).join('');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-cell rh-map-card' + (isHere ? ' here' : '');
        btn.setAttribute('data-loc', L.id);
        btn.innerHTML =
          '<div class="rh-map-thumb">' +
            '<img src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(L.name) + '" loading="lazy"/>' +
            '<div class="rh-map-thumb-scrim"></div>' +
            (isHere ? '<span class="rh-map-here-pill"><span class="rh-dia" aria-hidden="true"></span><span>当前所在</span></span>' : '') +
            (npcHtml ? '<div class="rh-map-npcs">' + npcHtml + '</div>' : '') +
          '</div>' +
          '<div class="rh-map-card-body">' +
            '<div class="rh-map-card-row">' +
              '<strong class="rh-map-name">' + escapeHtml(L.name) + '</strong>' +
              (badges.length ? '<div class="rh-map-badges">' + badges.join('') + '</div>' : '') +
            '</div>' +
            '<p class="rh-map-desc">' + escapeHtml(L.desc || '') + '</p>' +
          '</div>';

        btn.onclick = function () {
          if (st.loc === L.id) {
            toastSafe('已经在这里了');
            return;
          }
          if ((st.ageY || 0) < 1) {
            toastSafe('眼下还太小，没法独自走远，让家人抱着出去吧。');
            return;
          }
          if (typeof show === 'function') show('map-overlay', 0);
          else if (overlay) overlay.classList.add('hidden');
          if (typeof enterLoc === 'function') enterLoc(L.id);
          else if (root && typeof root.enterLoc === 'function') root.enterLoc(L.id);
        };

        cardsWrap.appendChild(btn);
      });

      sec.appendChild(cardsWrap);
      grid.appendChild(sec);
    });

    if (typeof show === 'function') show('map-overlay', 1);
    else if (overlay) overlay.classList.remove('hidden');
    return true;
  }

  /* =========================================================================
     三、Pillar 3：季度日程排班器 (#schedule-overlay) 与插画风季度手账 (#season-report-overlay)
     ========================================================================= */
  var COURSE_TEACHER_CHAR = {
    '家庭教师': 'teacher',
    '自学/藏书': null,
    '剑术教官': 'instructor',
    '通识教授': 'lecturer',
    '安娜·贝尔': 'anna',
    '霍尔': 'hol',
    '霁馆主': 'ji',
    '艾诺': 'aino',
    '自修·实战': 'sylvia'
  };

  // 20 篇希尔维亚季度一句话手账（4 时期 × 4 季 + 4 里程碑）
  var SYLVIA_DIARY_ENTRIES = {
    childhood_0: '春雨洒过公爵府花坛，午后晒在被褥上的阳光柔软得让人只想安稳睡去。',
    childhood_1: '夏蝉在廊外银杏树上鸣唱，端一盏微凉花露听姐姐吵闹，日子慢得刚刚好。',
    childhood_2: '秋风卷着红叶落满回廊台阶，书房里新摊开的图册还留着淡淡松烟墨香。',
    childhood_3: '初雪轻轻覆上露台栏杆，暖炉边弥漫着热奶与蜂蜜曲奇的甜暖气息。',
    youth_0: '庭院鸢尾抽出嫩芽，陪爱丽丝在树荫下辨认风向，转眼便过去一整个上午。',
    youth_1: '暑气袭来时在掌心凝一缕凉雾降暑，公爵府的夏日竟也能过得如此舒坦。',
    youth_2: '秋日练武场风清气爽，木剑相击声落定后，总能讨到厨房新烤好的甜点。',
    youth_3: '冬夜长廊灯火温润，把这一季攒下的读书笔记整齐归档，心中分外安宁。',
    academy_0: '阿斯拉钟塔下的新绿映着晴空，宿舍窗台摆好冰水笔记，新学期步调稳当。',
    academy_1: '炎夏的学院图书馆最是凉爽，靠墙双人桌伴着笔尖沙沙声，时光悄然滑过。',
    academy_2: '银杏金叶铺满纪念林小径，结束冰系实操后再去食堂点份提拉米苏，劳逸相宜。',
    academy_3: '冬雪降临魔导学院尖顶，冰晶教室窗边结着清霜，控温手艺愈发称心顺手。',
    journey_0: '澄岚镇的春风带着草木清气，晨练步法后喝一碗热粥，远行岁月也能安稳度日。',
    journey_1: '官道沿途云影高远，握稳乌木剑鞘顺着山风赶路，心中那份笃定愈发清晰。',
    journey_2: '北境秋风已有几分寒意，打点好行囊与药箱薄冰，每一步都踏在实处。',
    journey_3: '冰封峡谷的漫长严冬里，护住身后灯火与医帐药草，雪原长风也显得格外清澈。',
    milestone_mana: '魔力第一次顺着指尖轻盈流转，原以为遥远的异世界魔法，竟如呼吸般自然。',
    milestone_academy: '跨进阿斯拉魔导学院大门那刻，耳畔尽是年轻喧声，崭新画卷就此舒展。',
    milestone_jikan: '在澄岚霁馆的木桩与炊烟间习得生根步，以眷寒渔之名重新站稳脚跟。',
    milestone_canyon: '立于赫兰冰封峡谷东段哨墙，与旧识并肩守望风雪，前路虽寒却满怀微光。'
  };

  function snapshotSeasonLedger(targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return null;
    var coursesSnap = {};
    Object.keys(st.courses || {}).forEach(function (cid) {
      var cur = st.courses[cid];
      coursesSnap[cid] = { lv: (cur && cur.lv) || 0, exp: (cur && cur.exp) || 0 };
    });
    st.seasonLedger = {
      key: seasonKeyOf(st),
      dateStr: formatDateSafe(st),
      phase: st.phase || 'prologue',
      stats: Object.assign({ body: 5, mind: 15, mana: 10, charm: 8 }, st.stats || {}),
      gold: Number(st.gold || 0),
      lv: Number(st.lv || 1),
      leisure: Number(st.leisure || 75),
      love: Object.assign({}, st.love || {}),
      know: Object.assign({}, st.know || {}),
      courses: coursesSnap,
      actions: []
    };
    return st.seasonLedger;
  }

  function recordSeasonAction(label, detail, targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return;
    if (!st.seasonLedger || st.seasonLedger.key !== seasonKeyOf(st)) {
      snapshotSeasonLedger(st);
    }
    st.lastAction = String(label || '');
    if (st.seasonLedger && Array.isArray(st.seasonLedger.actions)) {
      st.seasonLedger.actions.push({ label: String(label || ''), detail: String(detail || '') });
      if (st.seasonLedger.actions.length > 12) {
        st.seasonLedger.actions.shift();
      }
    }
  }

  function getUnlockedCoursesForPlanner(st) {
    if (typeof availableCourses === 'function' && st === getS()) {
      try { return availableCourses() || []; } catch (e) {}
    }
    var all = Object.values(getCOURSES());
    return all.filter(function (c) {
      if (!c) return false;
      if (c.needAge != null && (st.ageY || 0) < c.needAge) return false;
      if (c.needFlag && !flagSafe(c.needFlag, st)) return false;
      if (c.forbidFlag && flagSafe(c.forbidFlag, st)) return false;
      if (c.id.indexOf('dojo_') === 0 && (flagSafe('ch_distant_wind_1', st) || st.loc === 'ice_canyon')) return false;
      var ph = st.phase || 'prologue';
      if (ph === 'prologue' || ph === 'childhood' || ph === 'youth') {
        return c.phase.indexOf('childhood') !== -1 || c.phase.indexOf('youth') !== -1;
      }
      if (ph === 'academy') return c.phase.indexOf('academy') !== -1;
      if (ph === 'journey' || ph === 'finale') return c.phase.indexOf('journey') !== -1;
      return true;
    });
  }

  function buildPlannerActivities(st) {
    var courses = getUnlockedCoursesForPlanner(st);
    var charsObj = getCHARS();
    var items = [];

    // 1. 课程修习
    courses.forEach(function (c) {
      var progress = (st.courses && st.courses[c.id]) || { lv: 0, exp: 0 };
      var needExp = 10 + (progress.lv || 0) * 5;
      var tChar = COURSE_TEACHER_CHAR[c.teacher] || null;
      items.push({
        id: 'course:' + c.id,
        cat: 'course',
        courseId: c.id,
        name: c.name,
        sub: c.teacher + ' · Lv.' + (progress.lv || 0),
        desc: c.desc,
        stCost: c.st || 2,
        stGain: 0,
        goldDelta: 0,
        leisureDelta: -6,
        statDelta: Object.assign({}, c.stat || {}),
        portrait: tChar ? resolvePortraitSafe(tChar, 'normal') : '',
        icon: 'book',
        courseProgress: { lv: progress.lv || 0, exp: progress.exp || 0, need: needExp, skillAt: c.skillAt || 3, skillName: c.skill ? c.skill.name : '' }
      });
    });

    // 2. 自主修习
    items.push({
      id: 'self:meditate',
      cat: 'self',
      name: '魔力冥想',
      sub: '凝神导引魔力回路',
      desc: '静坐凝结冰水魔力，稳步滋养魔力适性与魔力上限。',
      stCost: 2,
      stGain: 0,
      goldDelta: 0,
      leisureDelta: -4,
      statDelta: { mana: 2 },
      expGain: 18 + (st.tier || 0) * 4,
      mpGain: 12,
      icon: 'crystal'
    });
    items.push({
      id: 'self:read',
      cat: 'self',
      name: '藏书研读',
      sub: '批注典籍与推导',
      desc: '翻阅魔导典籍与风物游记，涵养心智并积累见闻。',
      stCost: 2,
      stGain: 0,
      goldDelta: 0,
      leisureDelta: -4,
      statDelta: { mind: 2 },
      expGain: 20 + (hasSkillSafe('ice_palace', st) || hasSkillSafe('deep_read', st) ? 10 : 0),
      mpGain: 6,
      icon: 'book'
    });
    items.push({
      id: 'self:tea',
      cat: 'self',
      name: '茶歇闲憩',
      sub: '舒缓心神恢复体力',
      desc: '烹一壶清茶配些许点心，让紧绷的思绪彻底舒展放松。',
      stCost: 0,
      stGain: 2,
      goldDelta: 0,
      leisureDelta: 18,
      statDelta: { charm: 1 },
      expGain: 6,
      mpGain: 15,
      icon: 'cup'
    });

    // 3. 阶段差事（赚取 10-26 金币）
    var ph = st.phase || 'prologue';
    if (ph === 'prologue' || ph === 'childhood' || ph === 'youth') {
      items.push({
        id: 'errand:ledger',
        cat: 'errand',
        name: '整理书房藏册',
        sub: '公爵府零花差事',
        desc: '替管家清点藏书编号与书签，领一份工整的零花金币。',
        stCost: 2,
        stGain: 0,
        goldDelta: 10,
        leisureDelta: -5,
        statDelta: { mind: 1 },
        expGain: 10,
        icon: 'coin'
      });
      items.push({
        id: 'errand:herb',
        cat: 'errand',
        name: '花房采撷香草',
        sub: '园艺协助零花',
        desc: '协助花匠拣选晒干薄荷与霜杉嫩叶，收获金币与清香。',
        stCost: 2,
        stGain: 0,
        goldDelta: 12,
        leisureDelta: -4,
        statDelta: { charm: 1 },
        expGain: 10,
        icon: 'coin'
      });
    } else if (ph === 'academy') {
      items.push({
        id: 'errand:scribe',
        cat: 'errand',
        name: '抄录魔导注疏',
        sub: '学院图书馆助研',
        desc: '替讲师誊抄规范化的术式讲义，报酬体面且磨炼心性。',
        stCost: 2,
        stGain: 0,
        goldDelta: 16,
        leisureDelta: -6,
        statDelta: { mind: 1 },
        expGain: 16,
        icon: 'coin'
      });
      items.push({
        id: 'errand:tutor',
        cat: 'errand',
        name: '水冰控温助教',
        sub: '低年级实操辅修',
        desc: '在实验室帮低年级稳住水膜与冰晶温度，赚取丰厚补贴。',
        stCost: 2,
        stGain: 0,
        goldDelta: 20,
        leisureDelta: -7,
        statDelta: { mana: 1 },
        expGain: 18,
        icon: 'coin'
      });
    } else {
      if (!flagSafe('ch_distant_wind_1', st)) {
        items.push({
          id: 'errand:guild',
          cat: 'errand',
          name: '公会魔核核验',
          sub: '澄岚支部委托',
          desc: '协助玛莎核验北林上交的魔核切口与品相，结算悬赏金币。',
          stCost: 2,
          stGain: 0,
          goldDelta: 22,
          leisureDelta: -6,
          statDelta: { body: 1 },
          expGain: 22,
          icon: 'coin'
        });
      }
      items.push({
        id: 'errand:icebox',
        cat: 'errand',
        name: '药箱恒温覆冰',
        sub: '行商药队委托',
        desc: '替北境药箱内沿覆上均匀薄冰保鲜草药，稳赚一笔路费。',
        stCost: 2,
        stGain: 0,
        goldDelta: 26,
        leisureDelta: -7,
        statDelta: { mana: 1 },
        expGain: 24,
        icon: 'coin'
      });
    }

    // 4. 伙伴同游（本季地图在场角色）
    var mapChars = rollSeasonChars(st, false);
    var locsObj = getLOCS();
    Object.keys(mapChars || {}).forEach(function (cid) {
      if (cid === 'helena') return;
      var cm = charsObj[cid];
      if (!cm) return;
      var locName = (locsObj[mapChars[cid]] && locsObj[mapChars[cid]].name) || '';
      items.push({
        id: 'outing:' + cid,
        cat: 'outing',
        charId: cid,
        name: '与' + cm.short + '同游',
        sub: (locName ? locName + ' · ' : '') + '好感 ' + ((st.love && st.love[cid]) || 0) + '/5',
        desc: '抽一段悠闲时光与' + cm.short + '散步叙旧，增进默契与了解。',
        stCost: 1,
        stGain: 0,
        goldDelta: 0,
        leisureDelta: 6,
        statDelta: { charm: 1 },
        loveChar: cid,
        expGain: 12,
        portrait: resolvePortraitSafe(cid, 'normal'),
        icon: 'heart'
      });
    });

    return items;
  }

  var _plannerState = {
    slots: [],
    activeSlotIdx: 0,
    activeCat: 'all',
    running: false,
    stepTimer: null
  };

  function getSlotLabels(st) {
    return ((st && st.mst) || 5) >= 10
      ? ['初旬', '中旬', '末旬', '闲暇']
      : ['初旬', '中旬', '末旬'];
  }

  function applyPlannerPreset(presetKey, activities, slotCount) {
    var pickBy = function (pred) {
      for (var i = 0; i < activities.length; i++) {
        if (pred(activities[i])) return activities[i].id;
      }
      return null;
    };
    var teaId = 'self:tea';
    var medId = 'self:meditate';
    var readId = 'self:read';
    var manaCourse = pickBy(function (a) { return a.cat === 'course' && a.statDelta && a.statDelta.mana; });
    var mindCourse = pickBy(function (a) { return a.cat === 'course' && a.statDelta && a.statDelta.mind; });
    var bodyCourse = pickBy(function (a) { return a.cat === 'course' && a.statDelta && a.statDelta.body; });
    var firstErrand = pickBy(function (a) { return a.cat === 'errand'; });
    var firstOuting = pickBy(function (a) { return a.cat === 'outing'; });
    var secondOuting = pickBy(function (a) { return a.cat === 'outing' && a.id !== firstOuting; }) || firstOuting;

    var seq = [];
    if (presetKey === 'balanced') {
      seq = [manaCourse || mindCourse || readId, firstOuting || firstErrand || medId, teaId, firstErrand || readId];
    } else if (presetKey === 'magic') {
      seq = [manaCourse || medId, mindCourse || readId, medId, teaId];
    } else if (presetKey === 'sword') {
      seq = [bodyCourse || firstErrand || medId, bodyCourse || medId, teaId, firstErrand || medId];
    } else if (presetKey === 'social') {
      seq = [firstOuting || teaId, secondOuting || firstErrand || teaId, teaId, firstErrand || readId];
    }
    var out = [];
    for (var s = 0; s < slotCount; s++) {
      out.push(seq[s] || teaId);
    }
    return out;
  }

  function computePlanPreview(slots, actMap, st) {
    var netSt = 0;
    var minStNeeded = 0;
    var curVirtualSt = Number((st && st.st) || 0);
    var mst = Number((st && st.mst) || 5);
    var gold = 0;
    var leisure = 0;
    var stats = { body: 0, mind: 0, mana: 0, charm: 0 };
    var filled = 0;

    for (var i = 0; i < slots.length; i++) {
      var act = slots[i] ? actMap[slots[i]] : null;
      if (!act) continue;
      filled++;
      if (act.stCost > 0) {
        curVirtualSt -= act.stCost;
        netSt += act.stCost;
        if (curVirtualSt < 0) minStNeeded = Math.max(minStNeeded, -curVirtualSt);
      }
      if (act.stGain > 0) {
        curVirtualSt = Math.min(mst, curVirtualSt + act.stGain);
        netSt -= act.stGain;
      }
      gold += act.goldDelta || 0;
      leisure += act.leisureDelta || 0;
      Object.keys(act.statDelta || {}).forEach(function (k) {
        stats[k] = (stats[k] || 0) + (act.statDelta[k] || 0);
      });
    }

    return {
      filled: filled,
      netSt: netSt,
      stShortfall: minStNeeded,
      feasible: filled > 0 && minStNeeded === 0,
      gold: gold,
      leisure: leisure,
      nextLeisure: clampNum(((st && st.leisure) || 75) + leisure, 0, 100),
      stats: stats
    };
  }

  function closeSchedulePlanner() {
    if (typeof document === 'undefined') return;
    if (_plannerState.stepTimer) {
      clearTimeout(_plannerState.stepTimer);
      _plannerState.stepTimer = null;
    }
    if (_plannerState.running) {
      _plannerState.running = false;
      _plannerState.slots = _plannerState.slots.map(function () { return null; });
      saveSafe();
      updateHudSafe();
      syncSylviaHub();
    }
    var ov = document.getElementById('schedule-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function openSchedulePlanner() {
    if (typeof document === 'undefined') return null;
    var st = ensureRaisingState();
    if (!st) return null;
    if (!st.seasonLedger || st.seasonLedger.key !== seasonKeyOf(st)) {
      snapshotSeasonLedger(st);
    }

    var ov = document.getElementById('schedule-overlay');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'schedule-overlay';
      ov.className = 'overlay hidden rh-overlay';
      document.body.appendChild(ov);
    }
    ov.classList.add('overlay', 'rh-overlay');

    var slotLabels = getSlotLabels(st);
    var activities = buildPlannerActivities(st);
    var actMap = {};
    activities.forEach(function (a) { actMap[a.id] = a; });

    if (_plannerState.slots.length !== slotLabels.length) {
      _plannerState.slots = slotLabels.map(function () { return null; });
    } else {
      // 清除阶段变化后失效的条目
      _plannerState.slots = _plannerState.slots.map(function (id) { return (id && actMap[id]) ? id : null; });
    }
    _plannerState.activeSlotIdx = Math.min(_plannerState.activeSlotIdx || 0, slotLabels.length - 1);
    _plannerState.running = false;

    function renderPlannerUI() {
      var prev = computePlanPreview(_plannerState.slots, actMap, st);
      var cats = [
        { id: 'all', label: '全部日程' },
        { id: 'course', label: '课程修习' },
        { id: 'self', label: '自主修习' },
        { id: 'errand', label: '兼职差事' },
        { id: 'outing', label: '伙伴同游' }
      ];

      var slotsHtml = slotLabels.map(function (lbl, idx) {
        var act = _plannerState.slots[idx] ? actMap[_plannerState.slots[idx]] : null;
        var active = idx === _plannerState.activeSlotIdx;
        return (
          '<div class="rh-slot-card' + (active ? ' is-active' : '') + (act ? ' is-filled' : '') + '" data-slot-idx="' + idx + '">' +
            '<div class="rh-slot-head">' +
              '<span class="rh-slot-lbl">' + escapeHtml(lbl) + '</span>' +
              (act ? '<button type="button" class="rh-slot-clear" data-clear-slot="' + idx + '" aria-label="清空该旬安排">清空</button>' : '<span class="rh-slot-empty-tag">待排定</span>') +
            '</div>' +
            (act
              ? '<div class="rh-slot-body">' +
                  '<div class="rh-slot-name">' + ico(act.icon) + '<span>' + escapeHtml(act.name) + '</span></div>' +
                  '<div class="rh-slot-meta">' +
                    (act.stCost > 0 ? '<span class="rh-tag-st">体力 -' + act.stCost + '</span>' : (act.stGain > 0 ? '<span class="rh-tag-ok">体力 +' + act.stGain + '</span>' : '')) +
                    (act.goldDelta > 0 ? '<span class="rh-tag-coin">金币 +' + act.goldDelta + '</span>' : '') +
                    '<span class="rh-tag-mood">悠闲 ' + (act.leisureDelta >= 0 ? '+' : '') + act.leisureDelta + '</span>' +
                  '</div>' +
                '</div>'
              : '<div class="rh-slot-placeholder">点击下方活动填入本旬</div>') +
          '</div>'
        );
      }).join('');

      var filteredActs = activities.filter(function (a) {
        return _plannerState.activeCat === 'all' || a.cat === _plannerState.activeCat;
      });

      var paletteHtml = filteredActs.map(function (a) {
        var statTags = Object.keys(a.statDelta || {}).map(function (k) {
          var lbls = { body: '体能', mind: '心智', mana: '魔力', charm: '气质' };
          return '<span class="rh-mini-tag">' + (lbls[k] || k) + ' +' + a.statDelta[k] + '</span>';
        }).join('');
        var courseBar = '';
        if (a.courseProgress) {
          var cp = a.courseProgress;
          var pct = cp.need ? Math.min(100, Math.round((cp.exp / cp.need) * 100)) : 0;
          courseBar =
            '<div class="rh-course-prog">' +
              '<div class="rh-cp-bar"><i style="width:' + pct + '%"></i></div>' +
              '<span class="rh-cp-txt">' + (cp.skillName && cp.lv < cp.skillAt ? ('Lv.' + cp.skillAt + ' 解锁「' + escapeHtml(cp.skillName) + '」') : ('修习进度 ' + cp.exp + '/' + cp.need)) + '</span>' +
            '</div>';
        }
        return (
          '<button type="button" class="rh-act-card" data-pick-act="' + escapeHtml(a.id) + '">' +
            '<div class="rh-act-top">' +
              (a.portrait
                ? '<span class="rh-act-av"><img src="' + escapeHtml(a.portrait) + '" alt=""/></span>'
                : '<span class="rh-act-ico">' + ico(a.icon) + '</span>') +
              '<div class="rh-act-titles">' +
                '<strong>' + escapeHtml(a.name) + '</strong>' +
                '<small>' + escapeHtml(a.sub) + '</small>' +
              '</div>' +
              '<span class="rh-act-cost' + (a.stGain > 0 ? ' is-gain' : '') + '">' + (a.stCost > 0 ? ('体力 -' + a.stCost) : (a.stGain > 0 ? ('体力 +' + a.stGain) : '无耗')) + '</span>' +
            '</div>' +
            '<p class="rh-act-desc">' + escapeHtml(a.desc) + '</p>' +
            courseBar +
            '<div class="rh-act-tags">' +
              statTags +
              (a.goldDelta > 0 ? '<span class="rh-mini-tag coin">金币 +' + a.goldDelta + '</span>' : '') +
              '<span class="rh-mini-tag ' + (a.leisureDelta >= 0 ? 'pos' : 'neg') + '">悠闲 ' + (a.leisureDelta >= 0 ? '+' : '') + a.leisureDelta + '</span>' +
            '</div>' +
          '</button>'
        );
      }).join('');

      var statPreviewParts = [];
      var statNames = { body: '体能', mind: '心智', mana: '魔力', charm: '气质' };
      Object.keys(statNames).forEach(function (k) {
        if (prev.stats[k]) statPreviewParts.push(statNames[k] + ' +' + prev.stats[k]);
      });

      var slotNumWord = ({ 1: '一', 2: '二', 3: '三', 4: '四', 5: '五' })[slotLabels.length] || String(slotLabels.length);
      var runBtnHtml = prev.feasible
        ? (ico('check') + '<span>执行本季排程</span>')
        : (prev.stShortfall > 0
            ? '<span>体力不足 · 请调入茶歇</span>'
            : '<span>请先排满' + slotNumWord + '旬</span>');

      ov.innerHTML =
        '<div class="end-card modal-shell rh-modal-shell rh-schedule-shell">' +
          '<div class="modal-head rh-modal-head">' +
            '<div class="rh-head-title">' +
              '<span class="rh-head-crest">' + ico('calendar') + '</span>' +
              '<div>' +
                '<h2>季度日程排班 · ' + escapeHtml(formatDateSafe(st)) + '</h2>' +
                '<p class="rh-head-sub">妥善安排本季各旬步调，执行后将生成本季成长手账</p>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="modal-close-x rh-close-x" id="rh-sched-close" aria-label="关闭日程排班">×</button>' +
          '</div>' +
          '<div class="modal-scroll rh-modal-scroll">' +
            '<div class="rh-sched-toolbar">' +
              '<div class="rh-preset-bar">' +
                '<span class="rh-preset-lbl">一键排程：</span>' +
                '<button type="button" class="rh-preset-btn" data-preset="balanced">悠闲均衡</button>' +
                '<button type="button" class="rh-preset-btn" data-preset="magic">魔导精修</button>' +
                '<button type="button" class="rh-preset-btn" data-preset="sword">剑术锻炼</button>' +
                '<button type="button" class="rh-preset-btn" data-preset="social">人情交游</button>' +
              '</div>' +
              '<div class="rh-plan-preview' + (prev.stShortfall > 0 ? ' is-warn' : '') + '">' +
                '<div class="rh-prev-item">' + ico('stamina') + '<span>可用体力 <b>' + st.st + '/' + st.mst + '</b>' + (prev.stShortfall > 0 ? ('（尚缺 ' + prev.stShortfall + ' 点，请调入茶歇闲憩）') : (' · 净耗 ' + prev.netSt)) + '</span></div>' +
                '<div class="rh-prev-item">' + ico('spark') + '<span>悠闲度 <b>' + st.leisure + ' → ' + prev.nextLeisure + '</b></span></div>' +
                (prev.gold > 0 ? '<div class="rh-prev-item">' + ico('coin') + '<span>预计金币 <b>+' + prev.gold + '</b></span></div>' : '') +
                (statPreviewParts.length ? '<div class="rh-prev-item">' + ico('crystal') + '<span>四维增益 <b>' + escapeHtml(statPreviewParts.join(' · ')) + '</b></span></div>' : '') +
              '</div>' +
            '</div>' +
            '<div class="rh-slots-row" style="--slot-count:' + slotLabels.length + '">' + slotsHtml + '</div>' +
            '<div id="rh-exec-ticker" class="rh-exec-ticker hidden"></div>' +
            '<div class="rh-cat-tabs">' +
              cats.map(function (c) {
                return '<button type="button" class="rh-cat-tab' + (_plannerState.activeCat === c.id ? ' on' : '') + '" data-cat="' + c.id + '">' + escapeHtml(c.label) + '</button>';
              }).join('') +
            '</div>' +
            '<div class="rh-palette-grid">' + (paletteHtml || '<p class="rh-empty-tip">当前分类暂无可用活动。</p>') + '</div>' +
          '</div>' +
          '<div class="modal-foot rh-modal-foot">' +
            '<button type="button" class="rh-btn ghost" id="rh-sched-cancel">稍后再排</button>' +
            '<button type="button" class="rh-btn primary" id="rh-sched-run"' + (prev.feasible ? '' : ' disabled') + '>' + runBtnHtml + '</button>' +
          '</div>' +
        '</div>';

      ov.onclick = function (e) {
        if (e.target === ov && !_plannerState.running) closeSchedulePlanner();
      };
      ov.querySelector('#rh-sched-close').onclick = closeSchedulePlanner;
      ov.querySelector('#rh-sched-cancel').onclick = closeSchedulePlanner;

      ov.querySelectorAll('[data-slot-idx]').forEach(function (card) {
        card.onclick = function (e) {
          if (e.target.closest('[data-clear-slot]')) return;
          _plannerState.activeSlotIdx = Number(card.getAttribute('data-slot-idx'));
          renderPlannerUI();
        };
      });
      ov.querySelectorAll('[data-clear-slot]').forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var idx = Number(btn.getAttribute('data-clear-slot'));
          _plannerState.slots[idx] = null;
          _plannerState.activeSlotIdx = idx;
          sfxSafe('click');
          renderPlannerUI();
        };
      });
      ov.querySelectorAll('[data-preset]').forEach(function (btn) {
        btn.onclick = function () {
          sfxSafe('click');
          _plannerState.slots = applyPlannerPreset(btn.getAttribute('data-preset'), activities, slotLabels.length);
          renderPlannerUI();
        };
      });
      ov.querySelectorAll('[data-cat]').forEach(function (btn) {
        btn.onclick = function () {
          _plannerState.activeCat = btn.getAttribute('data-cat');
          renderPlannerUI();
        };
      });
      ov.querySelectorAll('[data-pick-act]').forEach(function (btn) {
        btn.onclick = function () {
          var actId = btn.getAttribute('data-pick-act');
          _plannerState.slots[_plannerState.activeSlotIdx] = actId;
          // 自动跳至下一个空槽位
          var nextEmpty = _plannerState.slots.indexOf(null);
          if (nextEmpty !== -1) _plannerState.activeSlotIdx = nextEmpty;
          else _plannerState.activeSlotIdx = (_plannerState.activeSlotIdx + 1) % slotLabels.length;
          sfxSafe('click');
          renderPlannerUI();
        };
      });
      var runBtn = ov.querySelector('#rh-sched-run');
      if (runBtn) {
        runBtn.onclick = function () {
          if (!prev.feasible || _plannerState.running) return;
          executePlannedSchedule(st, _plannerState.slots.slice(), slotLabels, actMap, ov);
        };
      }
    }

    renderPlannerUI();
    ov.classList.remove('hidden');
    return ov;
  }

  function executeSingleScheduledActivity(st, act, report) {
    if (!act) return;
    if (act.stCost > 0) st.st = clampNum((st.st || 0) - act.stCost, 0, st.mst || 5);
    if (act.stGain > 0) st.st = clampNum((st.st || 0) + act.stGain, 0, st.mst || 5);
    if (act.mpGain > 0) st.mp = clampNum((st.mp || 0) + act.mpGain, 0, st.mmp || 12);
    if (act.cat === 'self' && act.id === 'self:tea') {
      st.hp = clampNum((st.hp || 0) + Math.ceil((st.mhp || 8) * 0.35), 0, st.mhp || 8);
    }

    Object.keys(act.statDelta || {}).forEach(function (k) {
      var v = act.statDelta[k] || 0;
      if (!v) return;
      addStatSafe(k, v, st);
      report.statDeltas[k] = (report.statDeltas[k] || 0) + v;
    });

    if (act.goldDelta) {
      st.gold = Math.max(0, (st.gold || 0) + act.goldDelta);
      report.goldDelta += act.goldDelta;
    }

    if (act.leisureDelta) {
      var prevL = st.leisure || 75;
      var nextL = adjustLeisure(act.leisureDelta, st);
      report.leisureDelta += (nextL - prevL);
    }

    if (act.courseId) {
      var beforeLv = (st.courses && st.courses[act.courseId] && st.courses[act.courseId].lv) || 0;
      var gainCourseExp = 5 + Math.floor(((st.stats && st.stats.mind) || 0) / 20);
      if (typeof courseProgress === 'function' && st === getS()) {
        try { courseProgress(act.courseId, gainCourseExp); } catch (e) {}
      } else {
        if (!st.courses) st.courses = {};
        var cs = st.courses[act.courseId] || { lv: 0, exp: 0 };
        cs.exp += gainCourseExp;
        while (cs.exp >= 10 + cs.lv * 5) {
          cs.exp -= 10 + cs.lv * 5;
          cs.lv++;
        }
        st.courses[act.courseId] = cs;
      }
      var afterLv = (st.courses && st.courses[act.courseId] && st.courses[act.courseId].lv) || 0;
      if (afterLv > beforeLv) {
        report.courseUps.push({ id: act.courseId, name: act.name, from: beforeLv, to: afterLv });
      }
      addExpSafe(8 + Math.floor(((st.stats && st.stats.mind) || 0) / 10), st);
    } else if (act.expGain) {
      addExpSafe(act.expGain, st);
    }

    if (act.loveChar) {
      var cid = act.loveChar;
      var beforeLove = (st.love && st.love[cid]) || 0;
      var beforeKnow = (st.know && st.know[cid]) || 0;
      if (beforeLove < 5) loveSafe(cid, 1, st);
      knowSafe(cid, 6, st);
      var afterLove = (st.love && st.love[cid]) || 0;
      var afterKnow = (st.know && st.know[cid]) || 0;
      var charsObj = getCHARS();
      report.bondGains.push({
        charId: cid,
        name: (charsObj[cid] && charsObj[cid].short) || cid,
        loveDelta: afterLove - beforeLove,
        knowDelta: afterKnow - beforeKnow
      });
    }

    report.steps.push({ name: act.name, sub: act.sub });
    recordSeasonAction(act.name, act.sub, st);
  }

  function pickSeasonalDiaryEntry(st) {
    var ph = st.phase || 'prologue';
    var loc = st.loc || '';
    var sn = seasonIndexOf(st.season);
    var seen = (st.diaryHistory || []).map(function (d) { return d.entryId; });

    // 优先按当前所在地点匹配随笔语境，再回退到阶段逻辑
    if (loc === 'ice_canyon') {
      if (seen.indexOf('milestone_canyon') === -1) {
        return { id: 'milestone_canyon', text: SYLVIA_DIARY_ENTRIES.milestone_canyon };
      }
      return { id: 'journey_3', text: SYLVIA_DIARY_ENTRIES.journey_3 };
    }
    if (loc === 'jikan') {
      if (seen.indexOf('milestone_jikan') === -1) {
        return { id: 'milestone_jikan', text: SYLVIA_DIARY_ENTRIES.milestone_jikan };
      }
      var jkKey = 'journey_' + sn;
      return { id: jkKey, text: SYLVIA_DIARY_ENTRIES[jkKey] || SYLVIA_DIARY_ENTRIES.journey_0 };
    }
    if (loc === 'chenglan_guild' || loc === 'northforest' || loc === 'road') {
      var jKey = 'journey_' + sn;
      return { id: jKey, text: SYLVIA_DIARY_ENTRIES[jKey] || SYLVIA_DIARY_ENTRIES.journey_0 };
    }
    var academyLocs = ['dorm', 'water_class', 'ice_class', 'library', 'cafeteria', 'clocktower', 'flowerhouse', 'training_field', 'memorial', 'auditorium', 'market'];
    if (academyLocs.indexOf(loc) !== -1) {
      if (seen.indexOf('milestone_academy') === -1) {
        return { id: 'milestone_academy', text: SYLVIA_DIARY_ENTRIES.milestone_academy };
      }
      var acKey = 'academy_' + sn;
      return { id: acKey, text: SYLVIA_DIARY_ENTRIES[acKey] || SYLVIA_DIARY_ENTRIES.academy_0 };
    }
    var homeLocs = ['nursery', 'ownroom', 'hallway', 'parlor', 'garden', 'study', 'dining', 'kitchen', 'training', 'balcony', 'chapel', 'cellar', 'secret', 'town', 'beach'];
    if (homeLocs.indexOf(loc) !== -1) {
      if (flagSafe('mana_awakened', st) && seen.indexOf('milestone_mana') === -1) {
        return { id: 'milestone_mana', text: SYLVIA_DIARY_ENTRIES.milestone_mana };
      }
      var homeEra = (st.ageY || 0) >= 6 ? 'youth' : 'childhood';
      var homeKey = homeEra + '_' + sn;
      return { id: homeKey, text: SYLVIA_DIARY_ENTRIES[homeKey] || SYLVIA_DIARY_ENTRIES.childhood_0 };
    }

    if (flagSafe('ch_distant_wind_1', st) && seen.indexOf('milestone_canyon') === -1) {
      return { id: 'milestone_canyon', text: SYLVIA_DIARY_ENTRIES.milestone_canyon };
    }
    if (flagSafe('arrived_jikan', st) && seen.indexOf('milestone_jikan') === -1) {
      return { id: 'milestone_jikan', text: SYLVIA_DIARY_ENTRIES.milestone_jikan };
    }
    if (ph === 'academy' && seen.indexOf('milestone_academy') === -1) {
      return { id: 'milestone_academy', text: SYLVIA_DIARY_ENTRIES.milestone_academy };
    }
    if (flagSafe('mana_awakened', st) && seen.indexOf('milestone_mana') === -1) {
      return { id: 'milestone_mana', text: SYLVIA_DIARY_ENTRIES.milestone_mana };
    }

    var era = (ph === 'prologue' || ph === 'childhood')
      ? 'childhood'
      : (ph === 'youth' ? 'youth' : (ph === 'academy' ? 'academy' : 'journey'));
    var key = era + '_' + sn;
    return { id: key, text: SYLVIA_DIARY_ENTRIES[key] || SYLVIA_DIARY_ENTRIES.childhood_0 };
  }

  function executePlannedSchedule(st, slots, slotLabels, actMap, ov) {
    _plannerState.running = true;
    var chosen = [];
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] && actMap[slots[i]]) {
        chosen.push({ label: slotLabels[i], act: actMap[slots[i]] });
      }
    }
    if (!chosen.length) {
      _plannerState.running = false;
      return;
    }

    var beforeLv = st.lv || 1;
    var report = {
      dateStr: formatDateSafe(st),
      phaseName: formatPhaseSafe(st),
      statDeltas: { body: 0, mind: 0, mana: 0, charm: 0 },
      goldDelta: 0,
      leisureDelta: 0,
      lvDelta: 0,
      courseUps: [],
      bondGains: [],
      steps: []
    };

    var finalizeAll = function (startFrom) {
      for (var k = startFrom; k < chosen.length; k++) {
        executeSingleScheduledActivity(st, chosen[k].act, report);
      }
      report.lvDelta = Math.max(0, (st.lv || 1) - beforeLv);
      report.statsAfter = Object.assign({ body: 5, mind: 15, mana: 10, charm: 8 }, st.stats || {});
      report.leisureAfter = st.leisure;
      report.goldAfter = st.gold;

      var diary = pickSeasonalDiaryEntry(st);
      report.diaryText = diary.text;
      var dKey = seasonKeyOf(st);
      var existsIdx = st.diaryHistory.findIndex(function (d) { return d.key === dKey; });
      var dRec = { key: dKey, entryId: diary.id, dateStr: report.dateStr, phase: st.phase, mood: getMoodInfo(st.leisure).label, text: diary.text };
      if (existsIdx >= 0) st.diaryHistory[existsIdx] = dRec;
      else st.diaryHistory.push(dRec);
      if (st.diaryHistory.length > MAX_DIARY_HISTORY) st.diaryHistory.shift();

      st.leisureHistory.push({ year: st.year || 0, season: st.season || 0, val: st.leisure });
      if (st.leisureHistory.length > MAX_LEISURE_HISTORY) st.leisureHistory.shift();

      _plannerState.slots = slotLabels.map(function () { return null; });
      if (_plannerState.stepTimer) {
        clearTimeout(_plannerState.stepTimer);
        _plannerState.stepTimer = null;
      }
      _plannerState.running = false;
      saveSafe();
      updateHudSafe();
      syncSylviaHub(st);
      sfxSafe('stat_gain');
      closeSchedulePlanner();
      openSeasonReport(report);
    };

    // jsdom 或减动效偏好下即时完成，零挂起定时器
    if (prefersReducedMotion()) {
      finalizeAll(0);
      return;
    }

    var ticker = ov.querySelector('#rh-exec-ticker');
    var runBtn = ov.querySelector('#rh-sched-run');
    if (runBtn) runBtn.disabled = true;
    var stepIdx = 0;
    if (_plannerState.stepTimer) {
      clearTimeout(_plannerState.stepTimer);
      _plannerState.stepTimer = null;
    }

    var tickerStepEl = null;
    var tickerNameEl = null;
    var tickerSubEl = null;
    if (ticker) {
      ticker.classList.remove('hidden');
      ticker.innerHTML =
        '<div class="rh-ticker-main">' +
          '<span class="rh-ticker-step"></span>' +
          '<strong></strong>' +
          '<span class="rh-ticker-sub"></span>' +
        '</div>' +
        '<button type="button" class="rh-btn ghost rh-ticker-skip" id="rh-ticker-skip">跳过动画</button>';
      tickerStepEl = ticker.querySelector('.rh-ticker-step');
      tickerNameEl = ticker.querySelector('strong');
      tickerSubEl = ticker.querySelector('.rh-ticker-sub');
      var skipBtn = ticker.querySelector('#rh-ticker-skip');
      if (skipBtn) {
        skipBtn.onclick = function () {
          if (!_plannerState.running) return;
          if (_plannerState.stepTimer) {
            clearTimeout(_plannerState.stepTimer);
            _plannerState.stepTimer = null;
          }
          finalizeAll(stepIdx);
        };
      }
    }

    function runStep() {
      _plannerState.stepTimer = null;
      if (!_plannerState.running) return;
      if (stepIdx >= chosen.length) {
        finalizeAll(chosen.length);
        return;
      }
      var cur = chosen[stepIdx];
      executeSingleScheduledActivity(st, cur.act, report);
      stepIdx++;
      updateHudSafe();
      sfxSafe('click');
      if (ticker) {
        if (tickerStepEl) tickerStepEl.textContent = cur.label + '（' + stepIdx + '/' + chosen.length + '）';
        if (tickerNameEl) tickerNameEl.textContent = cur.act.name;
        if (tickerSubEl) tickerSubEl.textContent = cur.act.sub;
      }
      _plannerState.stepTimer = setTimeout(runStep, 460);
    }

    runStep();
  }

  function closeSeasonReport() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('season-report-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function openSeasonReport(sampleData) {
    if (typeof document === 'undefined') return null;
    var st = ensureRaisingState();
    if (!st) return null;

    var ov = document.getElementById('season-report-overlay');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'season-report-overlay';
      ov.className = 'overlay hidden rh-overlay';
      document.body.appendChild(ov);
    }
    ov.classList.add('overlay', 'rh-overlay');

    var data = sampleData;
    if (!data) {
      var led = st.seasonLedger || snapshotSeasonLedger(st);
      var statD = {};
      ['body', 'mind', 'mana', 'charm'].forEach(function (k) {
        statD[k] = ((st.stats && st.stats[k]) || 0) - ((led && led.stats && led.stats[k]) || 0);
      });
      var diary = pickSeasonalDiaryEntry(st);
      data = {
        dateStr: formatDateSafe(st),
        phaseName: formatPhaseSafe(st),
        statDeltas: statD,
        statsAfter: Object.assign({ body: 5, mind: 15, mana: 10, charm: 8 }, st.stats || {}),
        goldDelta: (st.gold || 0) - ((led && led.gold) || 0),
        goldAfter: st.gold || 0,
        leisureDelta: (st.leisure || 75) - ((led && led.leisure) || 75),
        leisureAfter: st.leisure || 75,
        lvDelta: Math.max(0, (st.lv || 1) - ((led && led.lv) || 1)),
        courseUps: [],
        bondGains: [],
        steps: (led && led.actions) ? led.actions.map(function (a) { return { name: a.label, sub: a.detail }; }) : [],
        diaryText: diary.text
      };
    }

    var mood = getMoodInfo(data.leisureAfter != null ? data.leisureAfter : st.leisure);
    var stage = getSylviaStage(st);
    var sylviaSrc = resolvePortraitSafe('sylvia', restingEmoFor(stage, mood.key));
    var statMeta = [
      { k: 'body', name: '体能', cls: 'body' },
      { k: 'mind', name: '心智', cls: 'mind' },
      { k: 'mana', name: '魔力适性', cls: 'mana' },
      { k: 'charm', name: '气质', cls: 'charm' }
    ];

    var barsHtml = statMeta.map(function (sm) {
      var val = (data.statsAfter && data.statsAfter[sm.k] != null) ? data.statsAfter[sm.k] : ((st.stats && st.stats[sm.k]) || 0);
      var d = (data.statDeltas && data.statDeltas[sm.k]) || 0;
      var deltaChip = d > 0
        ? '<em class="rh-delta-pill is-pos">+' + d + '</em>'
        : (d < 0
            ? '<em class="rh-delta-pill is-neg">' + d + '</em>'
            : '<em class="rh-delta-pill is-flat">持平</em>');
      return (
        '<div class="rh-rep-stat ' + sm.cls + '">' +
          '<div class="rh-rs-top">' +
            '<span class="rh-rs-name"><i class="rh-rs-dot" aria-hidden="true"></i>' + sm.name + '</span>' +
            '<span class="rh-rs-val"><b>' + val + '</b>' + deltaChip + '</span>' +
          '</div>' +
          '<div class="rh-rs-track' + (val <= 0 ? ' is-zero' : '') + '"><i style="width:' + clampNum(val, 0, 100) + '%"></i></div>' +
        '</div>'
      );
    }).join('');

    var courseUpsHtml = (data.courseUps && data.courseUps.length)
      ? '<div class="rh-rep-block"><h3>' + ico('book') + '<span>课程进阶</span></h3><div class="rh-rep-chips">' +
          data.courseUps.map(function (u) {
            return '<span class="rh-rep-chip">' + escapeHtml(u.name) + ' Lv.' + u.from + ' → Lv.' + u.to + '</span>';
          }).join('') +
        '</div></div>'
      : '';

    var bondGainsHtml = (data.bondGains && data.bondGains.length)
      ? '<div class="rh-rep-block"><h3>' + ico('heart') + '<span>人情往来</span></h3><div class="rh-rep-chips">' +
          data.bondGains.map(function (b) {
            return '<span class="rh-rep-chip rose">' + escapeHtml(b.name) +
              (b.loveDelta > 0 ? (' 好感 +' + b.loveDelta) : '') +
              (b.knowDelta > 0 ? (' · 了解 +' + b.knowDelta) : '') + '</span>';
          }).join('') +
        '</div></div>'
      : '';

    var stepsHtml = (data.steps && data.steps.length)
      ? '<div class="rh-rep-steps">' + data.steps.map(function (sp, i) {
          return '<span class="rh-step-pill"><em>' + (i + 1) + '</em>' + escapeHtml(sp.name) + '</span>';
        }).join('') + '</div>'
      : '<div class="rh-rep-steps"><span class="rh-step-pill is-calm">' + ico('wind') + '<span>本季步调：静养休整 · 自由漫步</span></span></div>';

    ov.innerHTML =
      '<div class="end-card modal-shell rh-modal-shell rh-report-shell">' +
        '<div class="modal-head rh-modal-head">' +
          '<div class="rh-head-title">' +
            '<span class="rh-head-crest">' + ico('quill') + '</span>' +
            '<div>' +
              '<h2>季度成长手账</h2>' +
              '<p class="rh-head-sub">' + escapeHtml(data.dateStr || formatDateSafe(st)) + ' · ' + escapeHtml(data.phaseName || formatPhaseSafe(st)) + '</p>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="modal-close-x rh-close-x" id="rh-rep-close" aria-label="关闭季度手账">×</button>' +
        '</div>' +
        '<div class="modal-scroll rh-modal-scroll">' +
          '<div class="rh-rep-hero">' +
            '<div class="rh-rep-portrait">' + (sylviaSrc ? '<img src="' + escapeHtml(sylviaSrc) + '" alt="希尔维亚"/>' : ico('crystal')) + '</div>' +
            '<div class="rh-rep-summary">' +
              '<div class="rh-rep-stamps">' +
                '<span class="rh-mood-stamp mood-' + mood.key + '">' + ico('spark') + '<span>心境 · ' + mood.label + '（' + mood.score + '）</span></span>' +
                '<span class="rh-meta-stamp">' + ico('coin') + '<span>金币 ' + (data.goldAfter != null ? data.goldAfter : (st.gold || 0)) + (data.goldDelta ? (' (' + (data.goldDelta > 0 ? '+' : '') + data.goldDelta + ')') : '') + '</span></span>' +
                (data.lvDelta > 0 ? '<span class="rh-meta-stamp pos">等级 +' + data.lvDelta + '</span>' : '') +
              '</div>' +
              stepsHtml +
              '<div class="rh-rep-diary rh-note-quote">' +
                '<div class="rh-diary-cap">' + ico('quill') + '<span>希尔维亚的季度随笔</span></div>' +
                '<p>' + escapeHtml(data.diaryText || pickSeasonalDiaryEntry(st).text) + '</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="rh-rep-stats-grid">' + barsHtml + '</div>' +
          courseUpsHtml +
          bondGainsHtml +
        '</div>' +
        '<div class="modal-foot rh-modal-foot">' +
          '<button type="button" class="rh-btn ghost" id="rh-rep-stay">留在当前地点</button>' +
          '<button type="button" class="rh-btn primary" id="rh-rep-next">' + ico('calendar') + '<span>翻至下个季度</span></button>' +
        '</div>' +
      '</div>';

    ov.onclick = function (e) { if (e.target === ov) closeSeasonReport(); };
    ov.querySelector('#rh-rep-close').onclick = closeSeasonReport;
    ov.querySelector('#rh-rep-stay').onclick = function () {
      sfxSafe('click');
      closeSeasonReport();
      syncSylviaHub(st);
    };
    ov.querySelector('#rh-rep-next').onclick = function () {
      sfxSafe('page');
      closeSeasonReport();
      if (typeof doNextTime === 'function') doNextTime();
      else if (root && typeof root.doNextTime === 'function') root.doNextTime();
      else if (typeof advanceSeason === 'function') advanceSeason(1);
    };

    ov.classList.remove('hidden');
    return ov;
  }

  /* =========================================================================
     四、Pillar 4：温馨小铺 (#shop-overlay)、九人赠礼与火漆信匣 (#mailbox-overlay)
     ========================================================================= */
  var COZY_SHOP_CATALOG = [
    {
      id: 'shop_caramel_cookie',
      name: '焦糖黄油曲奇',
      price: 4,
      tag: '茶点',
      icon: 'cookie',
      phases: ['prologue', 'childhood', 'youth', 'academy', 'journey', 'finale'],
      desc: '酥脆香甜的手工黄油小饼，咬下时溢开微暖焦糖余韵。',
      effectDesc: '自用：体力 +1、悠闲度 +8，佐茶最宜。',
      selfEffect: { st: 1, leisure: 8 }
    },
    {
      id: 'shop_mint_tea',
      name: '冰镇薄荷叶茶',
      price: 6,
      tag: '饮品',
      icon: 'tea',
      phases: ['prologue', 'childhood', 'youth', 'academy', 'journey', 'finale'],
      desc: '清冽回甘的精选薄荷茶包，冷泡热冲皆能瞬间提神醒脑。',
      effectDesc: '自用：魔力值 +14、悠闲度 +10。',
      selfEffect: { mp: 14, leisure: 10 }
    },
    {
      id: 'shop_honey_pancake',
      name: '蜂蜜松饼礼盒',
      price: 7,
      tag: '茶点',
      icon: 'cookie',
      phases: ['prologue', 'childhood', 'youth', 'academy'],
      desc: '淋着花蜜的松软厚松饼，用浅蓝丝带扎着淡雅纸盒。',
      effectDesc: '自用：体力 +1、悠闲度 +12。',
      selfEffect: { st: 1, leisure: 12 }
    },
    {
      id: 'shop_osmanthus_cake',
      name: '澄岚桂花米糕',
      price: 8,
      tag: '风物',
      icon: 'cookie',
      phases: ['journey', 'finale'],
      desc: '澄岚镇老铺现蒸的清甜米糕，撒满细碎金桂，温润饱腹。',
      effectDesc: '自用：体力 +2、悠闲度 +10。',
      selfEffect: { st: 2, leisure: 10 }
    },
    {
      id: 'shop_parchment_journal',
      name: '羊皮抄录本',
      price: 10,
      tag: '文具',
      icon: 'book',
      phases: ['prologue', 'childhood', 'youth', 'academy', 'journey', 'finale'],
      desc: '纸页厚实匀净的随身手账本，用来记公式、日程或旅途见闻极顺手。',
      effectDesc: '自用：心智 +2、悠闲度 +4。',
      selfEffect: { stat: { mind: 2 }, leisure: 4 }
    },
    {
      id: 'shop_ice_bookmark',
      name: '雪晶雕花书签',
      price: 12,
      tag: '饰物',
      icon: 'crystal',
      phases: ['childhood', 'youth', 'academy', 'journey', 'finale'],
      desc: '仿六瓣冰花打磨的剔透金属书签，日光斜照时映出浅蓝微芒。',
      effectDesc: '自用：魔力适性 +2 · 点亮挂件。',
      selfEffect: { stat: { mana: 2 }, leisure: 5, charmId: 'shop_ice_bookmark' }
    },
    {
      id: 'shop_sword_tassel_oil',
      name: '乌木护刃清油',
      price: 12,
      tag: '养护',
      icon: 'blade',
      phases: ['youth', 'academy', 'journey', 'finale'],
      desc: '细密松香调制的保养清油，拭过木剑与铁锋后手感温润不滑。',
      effectDesc: '自用：体能 +2、攻击 +1。',
      selfEffect: { stat: { body: 2 }, atk: 1, leisure: 3 }
    },
    {
      id: 'shop_polar_lily_dried',
      name: '北极铃兰干花',
      price: 14,
      tag: '花礼',
      icon: 'flower',
      phases: ['academy', 'journey', 'finale'],
      desc: '借寒气封存的淡白铃兰标本，花瓣在玻璃夹片间完好如初。',
      effectDesc: '自用：魔力适性 +2、悠闲度 +8。',
      selfEffect: { stat: { mana: 2 }, leisure: 8 }
    },
    {
      id: 'shop_frost_cedar_sachet',
      name: '霜杉干叶香囊',
      price: 14,
      tag: '香礼',
      icon: 'flower',
      phases: ['prologue', 'childhood', 'youth', 'academy', 'journey', 'finale'],
      desc: '素白细麻缝制的清雅香囊，满载公爵府冬园般沉静的霜杉气息。',
      effectDesc: '自用：气质 +2、悠闲 +10 · 挂件。',
      selfEffect: { stat: { charm: 2 }, leisure: 10, charmId: 'shop_frost_cedar_sachet' }
    },
    {
      id: 'shop_silver_moon_clip',
      name: '银月蓝晶发夹',
      price: 15,
      tag: '饰物',
      icon: 'crystal',
      phases: ['childhood', 'youth', 'academy', 'journey', 'finale'],
      desc: '纤细银枝镶着一小粒天青晶石，别在鬓侧清丽脱俗。',
      effectDesc: '自用：气质 +3 · 点亮挂件。',
      selfEffect: { stat: { charm: 3 }, leisure: 6, charmId: 'shop_silver_moon_clip' }
    },
    {
      id: 'shop_magic_theory_notes',
      name: '梅林阻率批注集',
      price: 16,
      tag: '典籍',
      icon: 'book',
      phases: ['academy', 'journey', 'finale'],
      desc: '收录多位高阶法师实测勘误的珍贵抄本，省去大量盲目试错工夫。',
      effectDesc: '自用：心智 +2、魔力适性 +2。',
      selfEffect: { stat: { mind: 2, mana: 2 }, leisure: 2 }
    },
    {
      id: 'shop_warming_frost_stone',
      name: '温霜护手怀石',
      price: 18,
      tag: '奇物',
      icon: 'crystal',
      phases: ['academy', 'journey', 'finale'],
      desc: '赫兰匠人打磨的奇巧暖石，表层清凉却能持久散出柔和暖意。',
      effectDesc: '自用：体力 +2、魔力 +20 · 挂件。',
      selfEffect: { st: 2, mp: 20, leisure: 10, charmId: 'shop_warming_frost_stone' }
    }
  ];

  // 九位核心角色分层赠礼反应（严守澄岚/赫兰「渔」「眷寒渔」身份铁律）
  var GIFT_PREFS = {
    beatrice: {
      charId: 'beatrice',
      phases: ['prologue', 'childhood', 'youth', 'academy'],
      loved: ['shop_honey_pancake', 'shop_sword_tassel_oil', 'shop_caramel_cookie'],
      liked: ['shop_silver_moon_clip', 'shop_frost_cedar_sachet', 'shop_mint_tea'],
      reactions: {
        loved: '哇——希尔维亚！你居然记得贝阿特丽丝大人最中意这个！今日训练加倍完就跟你平分！',
        liked: '哼哼，眼光还算像样嘛！姐姐我就大方收下这份心意啦！',
        neutral: '咦，特意挑给我的吗？谢谢妹妹，那我也得琢磨回礼才行！'
      }
    },
    alice: {
      charId: 'alice',
      phases: ['childhood', 'youth', 'academy'],
      cond: function (st) { return dateAtLeastSafe(2, 9, st); },
      loved: ['shop_silver_moon_clip', 'shop_frost_cedar_sachet', 'shop_ice_bookmark'],
      liked: ['shop_caramel_cookie', 'shop_parchment_journal', 'shop_mint_tea'],
      causalByItem: {
        shop_silver_moon_clip: 'obsession',
        shop_ice_bookmark: 'independence',
        shop_parchment_journal: 'independence'
      },
      reactions: {
        loved: '……姐姐大人亲手挑的，我会一直收在最贴身的地方。谢谢你，姐姐大人。',
        liked: '……嗯，很合我心意。晚些时候我可以陪姐姐大人一起用吗？',
        neutral: '……只要是姐姐大人递来的物件，我都很珍惜。'
      }
    },
    sophia: {
      charId: 'sophia',
      phases: ['prologue', 'childhood', 'youth'],
      loved: ['shop_frost_cedar_sachet', 'shop_mint_tea', 'shop_silver_moon_clip'],
      liked: ['shop_honey_pancake', 'shop_parchment_journal', 'shop_caramel_cookie'],
      reactions: {
        loved: '真清雅的心意，希尔维亚越发体贴了。这缕霜杉香放在起居室再合适不过。',
        liked: '难为你逛街时还记挂着母亲，坐下来陪我喝杯热茶吧。',
        neutral: '谢谢你，我的小宝贝，母亲很喜欢这份礼。'
      }
    },
    noelle: {
      charId: 'noelle',
      phases: ['academy'],
      cond: function (st) { return flagSafe('met_noelle', st); },
      loved: ['shop_magic_theory_notes', 'shop_parchment_journal', 'shop_caramel_cookie'],
      liked: ['shop_ice_bookmark', 'shop_mint_tea', 'shop_honey_pancake'],
      causalPole: 'partnership',
      reactions: {
        loved: '……这份批注连第三章阻率勘误都补齐了。希尔维亚，这份人情我记在日程表里，下次一定加倍回敬。',
        liked: '咳，正好缺这个。谢谢你，待会儿图书馆靠墙那张桌位我替你留着。',
        neutral: '……怎么忽然送东西过来？那我就不客气收下了。'
      }
    },
    charlotte: {
      charId: 'charlotte',
      phases: ['academy'],
      cond: function (st) { return flagSafe('met_charlotte', st) || dateAtLeastSafe(12, 3, st); },
      loved: ['shop_mint_tea', 'shop_silver_moon_clip', 'shop_ice_bookmark'],
      liked: ['shop_frost_cedar_sachet', 'shop_magic_theory_notes', 'shop_polar_lily_dried'],
      causalPole: 'candor',
      reactions: {
        loved: '维斯特利亚，算你还有点贵族应有的品味。这薄荷茶香倒正合我意——别得意，下次榜单照样不会让你。',
        liked: '难得见你送礼这么合乎分寸。行吧，我就看在同窗体面上收下了。',
        neutral: '哼，无事献殷勤。不过既然已经递到面前，退回去反倒失礼。'
      }
    },
    aino: {
      charId: 'aino',
      phases: ['academy', 'journey', 'finale'],
      cond: function (st) {
        if (st.phase === 'academy') return flagSafe('met_aino', st) && !flagSafe('ch_ice_melt_1', st);
        return flagSafe('ch_distant_wind_1', st);
      },
      loved: ['shop_polar_lily_dried', 'shop_ice_bookmark', 'shop_warming_frost_stone'],
      liked: ['shop_caramel_cookie', 'shop_magic_theory_notes', 'shop_mint_tea'],
      frontlineLoved: ['shop_warming_frost_stone', 'shop_polar_lily_dried', 'shop_caramel_cookie'],
      frontlineLiked: ['shop_sword_tassel_oil', 'shop_ice_bookmark', 'shop_mint_tea'],
      causalPole: 'kinship',
      reactions: {
        loved: '……居然是北极铃兰的寒封标本。你的冰控温很稳，这份礼我收下了，下次实战陪你多练一轮。',
        liked: '……挺实用。谢了。',
        neutral: '……嗯，收下了。有空去花坊顺手带壶冷水便好。'
      },
      frontlineReactions: {
        loved: '……这暖石收得正是时候，守东段冰墙夜哨最用得上。谢了，眷寒渔。',
        liked: '……火候拿捏得挺好，防线上正好缺这类顺手物件。谢了，魔剑士。',
        neutral: '……嗯，边关物资紧俏，这份心意我收下了。'
      }
    },
    ji: {
      charId: 'ji',
      phases: ['journey', 'finale'],
      cond: function (st) { return !flagSafe('ch_distant_wind_1', st); },
      loved: ['shop_sword_tassel_oil', 'shop_osmanthus_cake', 'shop_mint_tea'],
      liked: ['shop_caramel_cookie', 'shop_warming_frost_stone', 'shop_parchment_journal'],
      reactions: {
        loved: '哟，渔丫头有心啦！这护刃清油正合我意，明早给你多拆两招送刀劲道！',
        liked: '哈哈，买这些零嘴破费什么，快放桌上大伙儿一起分着吃。',
        neutral: '收下啦，渔丫头练完步法记得把竹剑擦干归架。'
      }
    },
    jilan: {
      charId: 'jilan',
      phases: ['journey', 'finale'],
      cond: function (st) { return !flagSafe('ch_distant_wind_1', st); },
      loved: ['shop_osmanthus_cake', 'shop_silver_moon_clip', 'shop_sword_tassel_oil'],
      liked: ['shop_caramel_cookie', 'shop_frost_cedar_sachet', 'shop_mint_tea'],
      causalByItem: {
        shop_osmanthus_cake: 'hearth',
        shop_silver_moon_clip: 'hearth',
        shop_sword_tassel_oil: 'wanderlust'
      },
      reactions: {
        loved: '哇——渔！你居然特意去买了这个给我！太好看了吧，回头我把剑馆灯笼擦亮，煮一锅热粥犒劳你！',
        liked: '嘿嘿，渔总是这么细心！那我也替你把练功木桩再修一遍！',
        neutral: '谢谢渔！有你待在霁馆，院子里热闹多啦！'
      }
    },
    masha: {
      charId: 'masha',
      phases: ['journey', 'finale'],
      loved: ['shop_parchment_journal', 'shop_osmanthus_cake', 'shop_mint_tea'],
      liked: ['shop_caramel_cookie', 'shop_warming_frost_stone', 'shop_frost_cedar_sachet'],
      reactions: {
        loved: '哟，眷寒渔挺懂行嘛！公会登记册正缺好使的纸本，回头有顺路肥差我先替你留着。',
        liked: '谢啦，渔。坐下歇口气，今天柜台正好不太忙。',
        neutral: '难得见你这么客气，东西我收下喽，出门接委托留神安全。'
      }
    }
  };

  function getShopItem(itemId) {
    for (var i = 0; i < COZY_SHOP_CATALOG.length; i++) {
      if (COZY_SHOP_CATALOG[i].id === itemId) return COZY_SHOP_CATALOG[i];
    }
    return null;
  }

  function getShopPrice(item, targetS) {
    var st = ensureRaisingState(targetS);
    var def = typeof item === 'string' ? getShopItem(item) : item;
    if (!def) return 0;
    var charm = (st && st.stats && st.stats.charm) || 0;
    return charm >= 50 ? Math.max(1, Math.floor(def.price * 0.9)) : def.price;
  }

  function getAvailableShopItems(targetS) {
    var st = ensureRaisingState(targetS);
    var ph = (st && st.phase) || 'prologue';
    return COZY_SHOP_CATALOG.filter(function (it) {
      return !it.phases || it.phases.indexOf(ph) !== -1;
    });
  }

  function getGiftableChars(targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return [];
    var ph = st.phase || 'prologue';
    return Object.keys(GIFT_PREFS).filter(function (cid) {
      var p = GIFT_PREFS[cid];
      if (p.phases && p.phases.indexOf(ph) === -1) return false;
      if (typeof p.cond === 'function' && !p.cond(st)) return false;
      return true;
    });
  }

  function buyCozyItem(itemId, targetS) {
    var st = ensureRaisingState(targetS);
    var item = getShopItem(itemId);
    if (!st || !item) return { ok: false, reason: 'invalid' };
    var price = getShopPrice(item, st);
    if ((st.gold || 0) < price) {
      sfxSafe('bad');
      toastSafe('金币不足，需要 ' + price + ' 枚金币');
      return { ok: false, reason: 'no_gold', price: price };
    }
    st.gold -= price;
    st.cozyBag[item.id] = (st.cozyBag[item.id] || 0) + 1;
    syncDeskCharms(st);
    recordSeasonAction('购入「' + item.name + '」', '花费 ' + price + ' 金币', st);
    saveSafe();
    updateHudSafe();
    syncSylviaHub(st);
    sfxSafe('ok');
    toastSafe('已购入「' + item.name + '」');
    return { ok: true, item: item, price: price, count: st.cozyBag[item.id] };
  }

  function useCozyItem(itemId, targetS) {
    var st = ensureRaisingState(targetS);
    var item = getShopItem(itemId);
    if (!st || !item) return { ok: false, reason: 'invalid' };
    if (!((st.cozyBag[item.id] || 0) > 0)) {
      return { ok: false, reason: 'empty' };
    }
    st.cozyBag[item.id] -= 1;
    if (st.cozyBag[item.id] <= 0) delete st.cozyBag[item.id];

    var ef = item.selfEffect || {};
    if (ef.st) st.st = clampNum((st.st || 0) + ef.st, 0, st.mst || 5);
    if (ef.mp) st.mp = clampNum((st.mp || 0) + ef.mp, 0, st.mmp || 12);
    if (ef.atk) st.atk = (st.atk || 1) + ef.atk;
    if (ef.leisure) adjustLeisure(ef.leisure, st);
    if (ef.stat) {
      Object.keys(ef.stat).forEach(function (k) { addStatSafe(k, ef.stat[k], st); });
    }
    if (ef.charmId && st.deskCharms.indexOf(ef.charmId) === -1) {
      st.deskCharms.push(ef.charmId);
    }
    recordSeasonAction('享用「' + item.name + '」', item.effectDesc, st);
    saveSafe();
    updateHudSafe();
    syncSylviaHub(st);
    sfxSafe('stat_gain');
    toastSafe('已使用「' + item.name + '」');
    return { ok: true, item: item };
  }

  function giftItemToChar(itemId, charId, targetS) {
    var st = ensureRaisingState(targetS);
    var item = getShopItem(itemId);
    var pref = GIFT_PREFS[charId];
    if (!st || !item || !pref) return { ok: false, reason: 'invalid' };
    if (!((st.cozyBag[item.id] || 0) > 0)) {
      return { ok: false, reason: 'empty' };
    }

    var sk = seasonKeyOf(st);
    if (!st.giftedSeason[sk] || typeof st.giftedSeason[sk] !== 'object') {
      st.giftedSeason[sk] = {};
    }
    if (st.giftedSeason[sk][charId]) {
      toastSafe('本季已向对方致赠过心意，留待下季再赠吧');
      return { ok: false, reason: 'already_gifted' };
    }

    st.cozyBag[item.id] -= 1;
    if (st.cozyBag[item.id] <= 0) delete st.cozyBag[item.id];
    st.giftedSeason[sk][charId] = true;

    var isAinoFrontline = charId === 'aino' && (st.loc === 'ice_canyon' || flagSafe('ch_distant_wind_1', st) || st.phase === 'journey' || st.phase === 'finale');
    var lovedList = (isAinoFrontline && pref.frontlineLoved) ? pref.frontlineLoved : pref.loved;
    var likedList = (isAinoFrontline && pref.frontlineLiked) ? pref.frontlineLiked : pref.liked;
    var tier = lovedList.indexOf(item.id) !== -1
      ? 'loved'
      : (likedList.indexOf(item.id) !== -1 ? 'liked' : 'neutral');

    var reactionPool = (isAinoFrontline && pref.frontlineReactions) ? pref.frontlineReactions : pref.reactions;
    var reactionText = reactionPool[tier] || reactionPool.neutral;

    var loveGain = tier === 'loved' ? 2 : (tier === 'liked' ? 1 : 0);
    var knowGain = tier === 'loved' ? 8 : (tier === 'liked' ? 5 : 3);
    var leisureGain = tier === 'loved' ? 6 : (tier === 'liked' ? 4 : 2);
    if (loveGain) loveSafe(charId, loveGain, st);
    knowSafe(charId, knowGain, st);
    adjustLeisure(leisureGain, st);

    var axisNudged = null;
    if (tier === 'loved') {
      var pole = (pref.causalByItem && pref.causalByItem[item.id]) || pref.causalPole || null;
      if (pole && shiftAxisSilentOrLive(charId, pole, 1)) {
        axisNudged = pole;
      }
      sfxSafe('gift_loved');
    } else if (tier === 'liked') {
      sfxSafe('stat_gain');
    } else {
      sfxSafe('click');
    }

    var cm = getCHARS()[charId] || { short: charId };
    recordSeasonAction('致赠「' + item.name + '」予' + cm.short, tier === 'loved' ? '深得欢心' : (tier === 'liked' ? '欣然收下' : '礼貌致谢'), st);
    saveSafe();
    updateHudSafe();
    syncSylviaHub(st);

    return {
      ok: true,
      tier: tier,
      charId: charId,
      charName: cm.short,
      item: item,
      reaction: reactionText,
      loveGain: loveGain,
      knowGain: knowGain,
      leisureGain: leisureGain,
      axisNudged: axisNudged
    };
  }

  var _shopUiState = {
    tab: 'market',
    selectedChar: null,
    lastGiftResult: null
  };

  function closeShopModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('shop-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function openShopModal(initialTab) {
    if (typeof document === 'undefined') return null;
    var st = ensureRaisingState();
    if (!st) return null;

    var ov = document.getElementById('shop-overlay');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'shop-overlay';
      ov.className = 'overlay hidden rh-overlay';
      document.body.appendChild(ov);
    }
    ov.classList.add('overlay', 'rh-overlay');

    if (initialTab === 'market' || initialTab === 'gift') {
      _shopUiState.tab = initialTab;
    }

    function renderShopUI() {
      var discountOn = ((st.stats && st.stats.charm) || 0) >= 50;
      var stock = getAvailableShopItems(st);
      var giftChars = getGiftableChars(st);
      if (!_shopUiState.selectedChar || giftChars.indexOf(_shopUiState.selectedChar) === -1) {
        _shopUiState.selectedChar = giftChars[0] || null;
      }
      var charsObj = getCHARS();
      var sk = seasonKeyOf(st);
      var giftedMap = (st.giftedSeason && st.giftedSeason[sk]) || {};

      var bodyHtml = '';
      if (_shopUiState.tab === 'market') {
        var cards = stock.map(function (it) {
          var price = getShopPrice(it, st);
          var owned = (st.cozyBag && st.cozyBag[it.id]) || 0;
          var canAfford = (st.gold || 0) >= price;
          return (
            '<article class="rh-shop-card" data-item-id="' + escapeHtml(it.id) + '">' +
              '<div class="rh-sc-top">' +
                '<span class="rh-sc-ico" data-ico="' + escapeHtml(it.icon) + '">' + ico(it.icon) + '</span>' +
                '<div class="rh-sc-title">' +
                  '<strong>' + escapeHtml(it.name) + '</strong>' +
                  '<span class="rh-sc-tag">' + escapeHtml(it.tag) + '</span>' +
                '</div>' +
                (owned > 0 ? '<span class="rh-sc-stock">持有 ' + owned + '</span>' : '') +
              '</div>' +
              '<p class="rh-sc-desc">' + escapeHtml(it.desc) + '</p>' +
              '<div class="rh-sc-eff">' + escapeHtml(it.effectDesc) + '</div>' +
              '<div class="rh-sc-foot">' +
                '<span class="rh-sc-price">' + ico('coin') + '<b>' + price + '</b>' + (discountOn && price < it.price ? '<s class="rh-old-price">原' + it.price + '</s>' : '') + '</span>' +
                '<div class="rh-sc-actions">' +
                  (owned > 0 ? '<button type="button" class="rh-btn ghost sm" data-use-item="' + escapeHtml(it.id) + '">自用</button>' : '') +
                  (owned > 0 && giftChars.length ? '<button type="button" class="rh-btn soft sm" data-goto-gift="' + escapeHtml(it.id) + '">赠礼</button>' : '') +
                  '<button type="button" class="rh-btn rh-btn-buy sm" data-buy-item="' + escapeHtml(it.id) + '"' + (canAfford ? '' : ' disabled') + '>购入</button>' +
                '</div>' +
              '</div>' +
            '</article>'
          );
        }).join('');
        bodyHtml = '<div class="rh-shop-grid">' + cards + '</div>';
      } else {
        var ownedList = COZY_SHOP_CATALOG.filter(function (it) { return ((st.cozyBag && st.cozyBag[it.id]) || 0) > 0; });
        var charChips = giftChars.map(function (cid) {
          var cm = charsObj[cid] || { short: cid };
          var av = resolvePortraitSafe(cid, 'normal');
          var done = !!giftedMap[cid];
          var on = cid === _shopUiState.selectedChar;
          return (
            '<button type="button" class="rh-gift-char' + (on ? ' on' : '') + (done ? ' is-done' : '') + '" data-gift-char="' + escapeHtml(cid) + '">' +
              '<span class="rgc-av">' + (av ? '<img src="' + escapeHtml(av) + '" alt=""/>' : escapeHtml(cm.short.slice(0, 1))) + '</span>' +
              '<span class="rgc-info"><b>' + escapeHtml(cm.short) + '</b><small>' + (done ? '本季已赠' : ('好感 ' + ((st.love && st.love[cid]) || 0) + '/5')) + '</small></span>' +
            '</button>'
          );
        }).join('');

        var reactionBox = '';
        if (_shopUiState.lastGiftResult) {
          var gr = _shopUiState.lastGiftResult;
          var tierBadge = gr.tier === 'loved' ? '深得欢心' : (gr.tier === 'liked' ? '欣然欢喜' : '礼貌收下');
          reactionBox =
            '<div class="rh-gift-reaction tier-' + gr.tier + '">' +
              '<div class="rgr-head"><strong>' + escapeHtml(gr.charName) + '</strong><span class="rgr-badge">' + tierBadge + '</span></div>' +
              '<p>「' + escapeHtml(gr.reaction) + '」</p>' +
              '<div class="rgr-gains">' +
                (gr.loveGain > 0 ? '<span>好感 +' + gr.loveGain + '</span>' : '') +
                '<span>了解 +' + gr.knowGain + '</span>' +
                '<span>悠闲 +' + gr.leisureGain + '</span>' +
              '</div>' +
            '</div>';
        }

        var selDone = _shopUiState.selectedChar && !!giftedMap[_shopUiState.selectedChar];
        var bagHtml = ownedList.length
          ? ownedList.map(function (it) {
              var cnt = st.cozyBag[it.id] || 0;
              return (
                '<div class="rh-gift-item">' +
                  '<div class="rgi-main"><span class="rh-sc-ico" data-ico="' + escapeHtml(it.icon) + '">' + ico(it.icon) + '</span><div><strong>' + escapeHtml(it.name) + '</strong><small>持有 ' + cnt + ' · ' + escapeHtml(it.tag) + '</small></div></div>' +
                  '<button type="button" class="rh-btn rh-btn-buy sm" data-send-gift="' + escapeHtml(it.id) + '"' + (selDone || !_shopUiState.selectedChar ? ' disabled' : '') + '>' + (selDone ? '本季已赠' : '致赠此物') + '</button>' +
                '</div>'
              );
            }).join('')
          : '<p class="rh-empty-tip">礼囊暂空，先去「集市铺面」挑选几件心意小物吧。</p>';

        bodyHtml =
          '<div class="rh-gift-layout">' +
            '<div class="rh-gift-chars">' + (charChips || '<p class="rh-empty-tip">本阶段暂无可致赠对象。</p>') + '</div>' +
            reactionBox +
            '<div class="rh-gift-bag">' + bagHtml + '</div>' +
          '</div>';
      }

      ov.innerHTML =
        '<div class="end-card modal-shell rh-modal-shell rh-shop-shell">' +
          '<div class="modal-head rh-modal-head">' +
            '<div class="rh-head-title">' +
              '<span class="rh-head-crest">' + ico('basket') + '</span>' +
              '<div>' +
                '<h2>集市小铺与心意赠礼</h2>' +
                '<p class="rh-head-sub">挑选茶点、文具与风物小物，自用怡情或致赠身畔亲友</p>' +
              '</div>' +
            '</div>' +
            '<div class="rh-head-right">' +
              '<span class="rh-gold-pill">' + ico('coin') + '<b>' + (st.gold || 0) + '</b> 金币</span>' +
              (discountOn ? '<span class="rh-discount-pill">气质优待 · 九折</span>' : '') +
              '<button type="button" class="modal-close-x rh-close-x" id="rh-shop-close" aria-label="关闭集市小铺">×</button>' +
            '</div>' +
          '</div>' +
          '<div class="rh-subtabs">' +
            '<button type="button" class="rh-subtab' + (_shopUiState.tab === 'market' ? ' on' : '') + '" data-shop-tab="market">' + ico('basket') + '<span>集市铺面</span></button>' +
            '<button type="button" class="rh-subtab' + (_shopUiState.tab === 'gift' ? ' on' : '') + '" data-shop-tab="gift">' + ico('gift') + '<span>心意赠礼</span></button>' +
          '</div>' +
          '<div class="modal-scroll rh-modal-scroll">' + bodyHtml + '</div>' +
          '<div class="modal-foot rh-modal-foot">' +
            '<button type="button" class="rh-btn ghost" id="rh-shop-done">收起小铺</button>' +
          '</div>' +
        '</div>';

      ov.onclick = function (e) { if (e.target === ov) closeShopModal(); };
      ov.querySelector('#rh-shop-close').onclick = closeShopModal;
      ov.querySelector('#rh-shop-done').onclick = closeShopModal;
      ov.querySelectorAll('[data-shop-tab]').forEach(function (btn) {
        btn.onclick = function () {
          _shopUiState.tab = btn.getAttribute('data-shop-tab');
          renderShopUI();
        };
      });
      ov.querySelectorAll('[data-buy-item]').forEach(function (btn) {
        btn.onclick = function () {
          buyCozyItem(btn.getAttribute('data-buy-item'), st);
          renderShopUI();
        };
      });
      ov.querySelectorAll('[data-use-item]').forEach(function (btn) {
        btn.onclick = function () {
          useCozyItem(btn.getAttribute('data-use-item'), st);
          renderShopUI();
        };
      });
      ov.querySelectorAll('[data-goto-gift]').forEach(function (btn) {
        btn.onclick = function () {
          _shopUiState.tab = 'gift';
          renderShopUI();
        };
      });
      ov.querySelectorAll('[data-gift-char]').forEach(function (btn) {
        btn.onclick = function () {
          _shopUiState.selectedChar = btn.getAttribute('data-gift-char');
          _shopUiState.lastGiftResult = null;
          renderShopUI();
        };
      });
      ov.querySelectorAll('[data-send-gift]').forEach(function (btn) {
        btn.onclick = function () {
          var res = giftItemToChar(btn.getAttribute('data-send-gift'), _shopUiState.selectedChar, st);
          if (res && res.ok) _shopUiState.lastGiftResult = res;
          renderShopUI();
        };
      });
    }

    renderShopUI();
    ov.classList.remove('hidden');
    return ov;
  }

  /* ----- 火漆信匣 (8 封原著里程碑来信 + 复用 #letter-demo 3D 拆封演出) ----- */
  var MAILBOX_CATALOG = [
    {
      id: 'mail_beatrice_academy',
      from: 'beatrice',
      senderName: '贝阿特丽丝',
      title: '来自阿斯拉的火红火漆信',
      era: '十岁后 · 入学来信',
      sealLabel: '焰纹火漆',
      sealTone: 'crimson',
      sealIcon: 'flame',
      kicker: 'A letter from Beatrice',
      heading: '贝阿特丽丝的来信',
      salutation: '亲爱的妹妹希尔维亚：',
      paragraphs: [
        '阿斯拉魔法大学的礼堂比公爵府客厅高出足足三层，连钟楼上的风铃声都格外响亮！',
        '火系实操课我第一周就拿了优等，教官夸我火力充沛。食堂里的蜂蜜厚松饼也很美味，等你两年后入学，姐姐一定先带你吃遍全校。',
        '在家里记得替我看紧爱丽丝，别让她一个人老往凉飕飕的书架角落钻哦。'
      ],
      sign: '全校最厉害的姐姐 贝阿特丽丝',
      bonusText: '首读奖励：悠闲度 +8 · 气质 +1',
      bonus: { leisure: 8, stat: { charm: 1 } },
      canUnlock: function (st) { return flagSafe('ch_beatrice_leaves', st) || (st.ageY || 0) >= 10; }
    },
    {
      id: 'mail_sophia_autumn',
      from: 'sophia',
      senderName: '索菲亚',
      title: '公爵府秋园霜杉家书',
      era: '学院篇 · 母亲来信',
      sealLabel: '霜杉银印',
      sealTone: 'silver',
      sealIcon: 'leaf',
      kicker: 'A letter from Sophia',
      heading: '母亲的霜杉家书',
      salutation: '希尔维亚：',
      paragraphs: [
        '入秋后公爵府后园的鸢尾收了花期，花匠替你留了两枝晒干的霜杉叶夹在信封里。',
        '父亲嘴上只问你课业进度，昨夜却翻来覆去嘱咐管家多备几双厚羊绒袜寄去东区宿舍。',
        '学业固然要紧，三餐与睡眠更要顾惜。累了便歇半日，家里永远为你亮着灯。'
      ],
      sign: '爱你的母亲 索菲亚',
      bonusText: '首读奖励：悠闲度 +10 · 魔力值 +15',
      bonus: { leisure: 10, mp: 15 },
      canUnlock: function (st) { return st.phase === 'academy' || flagSafe('ch_academy', st) || (st.ageY || 0) >= 12; }
    },
    {
      id: 'mail_noelle_errata',
      from: 'noelle',
      senderName: '诺艾儿',
      title: '水系回路勘误便笺',
      era: '学院篇 · 诺艾儿手札',
      sealLabel: '水纹蓝印',
      sealTone: 'sapphire',
      sealIcon: 'ripple',
      kicker: 'Notes from Noelle',
      heading: '诺艾儿的勘误便笺',
      salutation: '希尔维亚：',
      paragraphs: [
        '图书馆三排那本旧版魔导阻率教材有两处系数印错，我顺手把正确推演抄在背面，免得你上课时白耗魔力。',
        '虎克昨日托商队捎了信来，还惦记着请银发姐姐吃王都街角的麦芽糖。',
        '周四下午靠墙那张双人桌我仍会早到占位，别又踩着钟声进门。'
      ],
      sign: '诺艾儿',
      bonusText: '首读奖励：心智 +2 · 诺艾儿了解度 +6',
      bonus: { stat: { mind: 2 }, know: ['noelle', 6] },
      canUnlock: function (st) { return flagSafe('met_noelle', st) || ((st.know && st.know.noelle) || 0) >= 25; }
    },
    {
      id: 'mail_charlotte_mint',
      from: 'charlotte',
      senderName: '夏洛特',
      title: '夹着薄荷叶的素纹信笺',
      era: '学院篇 · 夏洛特来信',
      sealLabel: '苍蓝家徽',
      sealTone: 'cerulean',
      sealIcon: 'crown',
      kicker: 'A note from Charlotte',
      heading: '夏洛特的素纹便笺',
      salutation: '维斯特利亚：',
      paragraphs: [
        '昨日路过纪念林时顺手替那株旧树松了土，顺便提醒你，下次浇水莫再漫过界石。',
        '信里附了两包王都茶庄新烘的薄荷叶，喝完记得保持清醒，期中榜单我可没打算让出前席。',
        '顺带一提，你姐姐在训练场的嗓门实在该收敛些了。'
      ],
      sign: '夏洛特·贝尔蒙',
      bonusText: '首读奖励：气质 +2 · 夏洛特了解度 +6',
      bonus: { stat: { charm: 2 }, know: ['charlotte', 6] },
      canUnlock: function (st) { return flagSafe('met_charlotte', st) || ((st.know && st.know.charlotte) || 0) >= 25; }
    },
    {
      id: 'mail_aino_herlan',
      from: 'aino',
      senderName: '艾诺',
      title: '北境来风与六瓣霜笺',
      era: '冰融之后 · 赫兰来信',
      sealLabel: '六瓣冰晶',
      sealTone: 'snow',
      sealIcon: 'crystal',
      kicker: 'A letter from Herlan',
      heading: '来自赫兰的霜笺',
      salutation: '致冰道同修：',
      paragraphs: [
        '赫兰今冬落雪比往年早了些，边关石墙根下结满厚实的青蓝坚冰。',
        '窗台那盆怕热的北极铃兰换了新土，借着极薄的恒温冰膜安稳熬过了霜夜，叶子仍旧碧绿。',
        '手背旧伤莫沾生雪，愿你在远方仍保有一手毫无气泡的利落冰锋。'
      ],
      sign: '艾诺·塔尔维',
      bonusText: '首读奖励：魔力适性 +2 · 艾诺了解度 +8',
      bonus: { stat: { mana: 2 }, know: ['aino', 8] },
      canUnlock: function (st) { return flagSafe('ch_ice_melt_1', st) || flagSafe('ch_distant_wind_1', st); }
    },
    {
      id: 'mail_alice_windbell',
      from: 'alice',
      senderName: '爱丽丝',
      title: '夹着风铃草的冰蓝家书',
      era: '动态因果 · 爱丽丝来信',
      sealLabel: '风铃冰印',
      sealTone: 'glacier',
      sealIcon: 'bell',
      kicker: 'A letter from Alice',
      heading: '爱丽丝的来信',
      useAliceDynamic: true,
      salutation: '姐姐大人：',
      paragraphs: [
        '学院北侧的风铃草开了，我把最安静的一朵夹在信里。',
        '等你回来，我想听你讲路上的雪。'
      ],
      sign: '爱丽丝',
      bonusText: '首读奖励：悠闲度 +10 · 爱丽丝好感 +1',
      bonus: { leisure: 10, love: ['alice', 1] },
      canUnlock: function (st) { return flagSafe('ch_academy', st) || (st.ageY || 0) >= 12; }
    },
    {
      id: 'mail_jilan_chenglan',
      from: 'jilan',
      senderName: '霁岚',
      title: '澄岚霁馆托商队捎来的信',
      era: '旅途篇 · 澄岚来信',
      sealLabel: '紫蝶竹印',
      sealTone: 'indigo',
      sealIcon: 'butterfly',
      kicker: 'A letter from Jikan',
      heading: '霁岚的剑馆来信',
      salutation: '亲爱的渔：',
      paragraphs: [
        '塞北的风雪一定比澄岚镇冷得多吧？乌木剑上的紫蝶剑穗若是沾了雪水，记得烤火时顺手拂干。',
        '我爹嘴上说院子清静正好睡懒觉，其实每天清晨擦完竹剑架，总会在第三排第四格多停一会儿。',
        '在外头接委托千万量力而行，哪天走累了，霁馆随时给你留着热腾腾的火腿粥！'
      ],
      sign: '澄岚霁馆 霁岚',
      bonusText: '首读奖励：体能 +2 · 悠闲度 +8 · 霁岚了解度 +8',
      bonus: { stat: { body: 2 }, leisure: 8, know: ['jilan', 8] },
      canUnlock: function (st) { return flagSafe('ch_distant_wind_1', st) || flagSafe('ch_leaky_cup', st); }
    },
    {
      id: 'mail_masha_bounty',
      from: 'masha',
      senderName: '玛莎',
      title: '澄岚冒险者公会结算回执',
      era: '旅途篇 · 澄岚公会',
      sealLabel: '澄岚铜章',
      sealTone: 'slate',
      sealIcon: 'compass',
      kicker: 'Chenglan Guild Notice',
      heading: '澄岚公会回执函',
      salutation: '眷寒渔 阁下：',
      paragraphs: [
        '此前你交付的那批北林魔核已经过商行复验，切口工整毫无碎裂，特补发尾款补贴金币十二枚。',
        '近日北林深处偶有影豺群迁徙的回报，若途经荒林哨道请务必结伴同行，切莫孤身久留。',
        '日后折返澄岚镇，凭铜级名册随时可来柜台优先挑选清净护卫差事。'
      ],
      sign: '澄岚公会接待 玛莎',
      bonusText: '首读奖励：金币 +12 · 玛莎了解度 +6',
      bonus: { gold: 12, know: ['masha', 6] },
      canUnlock: function (st) { return flagSafe('arrived_jikan', st) || st.phase === 'journey' || st.phase === 'finale'; }
    }
  ];

  var WAX_CLASS_BY_TONE = {
    crimson: 'wax-flame',
    silver: 'wax-silver',
    sapphire: 'wax-royal',
    cerulean: 'wax-ice',
    snow: 'wax-frost',
    glacier: 'wax-ice',
    indigo: 'wax-violet',
    slate: 'wax-slate'
  };

  var ALL_WAX_CLASSES = [
    'wax-flame', 'wax-ice', 'wax-slate', 'wax-royal',
    'wax-frost', 'wax-wind', 'wax-violet', 'wax-amber', 'wax-silver'
  ];

  var _defaultLetterSnapshot = null;
  var _customLetterActive = false;
  var _pendingMailBonusToast = null;
  var _mutatingLetterWax = false;

  function hasAnyLetterWaxClass(demo) {
    if (!demo || !demo.classList) return false;
    for (var i = 0; i < ALL_WAX_CLASSES.length; i++) {
      if (demo.classList.contains(ALL_WAX_CLASSES[i])) return true;
    }
    return false;
  }

  function applyLetterWaxClass(demo, waxCls) {
    if (!demo || !demo.classList) return false;
    var toRemove = [];
    for (var i = 0; i < ALL_WAX_CLASSES.length; i++) {
      var cls = ALL_WAX_CLASSES[i];
      if (cls !== waxCls && demo.classList.contains(cls)) {
        toRemove.push(cls);
      }
    }
    var needAdd = !!(waxCls && !demo.classList.contains(waxCls));
    if (toRemove.length === 0 && !needAdd) return false;
    var prevMutating = _mutatingLetterWax;
    _mutatingLetterWax = true;
    try {
      for (var j = 0; j < toRemove.length; j++) {
        demo.classList.remove(toRemove[j]);
      }
      if (needAdd) demo.classList.add(waxCls);
    } finally {
      _mutatingLetterWax = prevMutating;
    }
    return true;
  }

  function flushPendingMailToast() {
    if (!_pendingMailBonusToast) return;
    var msg = _pendingMailBonusToast;
    _pendingMailBonusToast = null;
    toastSafe(msg);
  }

  function captureDefaultLetterSnapshot() {
    if (_defaultLetterSnapshot || typeof document === 'undefined') return _defaultLetterSnapshot;
    var demo = document.getElementById('letter-demo');
    if (!demo) return null;
    var kicker = demo.querySelector('.letter-kicker');
    var heading = demo.querySelector('.letter-heading');
    var seal = demo.querySelector('.letter-seal span');
    var article = demo.querySelector('.alice-letter');
    if (article && !article.getAttribute('data-orig-html')) {
      article.setAttribute('data-orig-html', article.innerHTML);
    }
    _defaultLetterSnapshot = {
      kicker: kicker ? kicker.textContent : 'A letter from Alice',
      heading: heading ? heading.textContent : '爱丽丝的来信',
      sealHtml: seal ? seal.innerHTML : '❄',
      articleHtml: article ? article.innerHTML : ''
    };
    return _defaultLetterSnapshot;
  }

  function restoreDefaultAliceLetter() {
    _customLetterActive = false;
    if (typeof document === 'undefined') return false;
    var demo = document.getElementById('letter-demo');
    if (!demo) return false;
    applyLetterWaxClass(demo, null);
    if (!_defaultLetterSnapshot) return false;
    var kicker = demo.querySelector('.letter-kicker');
    var heading = demo.querySelector('.letter-heading');
    var seal = demo.querySelector('.letter-seal span');
    var article = demo.querySelector('.alice-letter');
    if (kicker) kicker.textContent = _defaultLetterSnapshot.kicker;
    if (heading) heading.textContent = _defaultLetterSnapshot.heading;
    if (seal) seal.innerHTML = _defaultLetterSnapshot.sealHtml;
    if (article && _defaultLetterSnapshot.articleHtml) article.innerHTML = _defaultLetterSnapshot.articleHtml;
    return true;
  }

  function getAvailableMail(targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return [];
    return MAILBOX_CATALOG.filter(function (m) {
      try { return !!(m.canUnlock && m.canUnlock(st)); } catch (e) { return false; }
    });
  }

  function getUnreadMailCount(targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return 0;
    return getAvailableMail(st).filter(function (m) {
      return !(st.mailboxRead && st.mailboxRead[m.id]);
    }).length;
  }

  function applyMailBonus(mail, st) {
    if (!mail || !mail.bonus || !st) return;
    var b = mail.bonus;
    if (b.leisure) adjustLeisure(b.leisure, st);
    if (b.mp) st.mp = clampNum((st.mp || 0) + b.mp, 0, st.mmp || 12);
    if (b.gold) st.gold = (st.gold || 0) + b.gold;
    if (b.stat) {
      Object.keys(b.stat).forEach(function (k) { addStatSafe(k, b.stat[k], st); });
    }
    if (Array.isArray(b.love)) loveSafe(b.love[0], b.love[1], st);
    if (Array.isArray(b.know)) knowSafe(b.know[0], b.know[1], st);
  }

  function openMailboxLetter(mailId, targetS) {
    var st = ensureRaisingState(targetS);
    var mail = null;
    for (var i = 0; i < MAILBOX_CATALOG.length; i++) {
      if (MAILBOX_CATALOG[i].id === mailId) { mail = MAILBOX_CATALOG[i]; break; }
    }
    if (!st || !mail) return false;

    captureDefaultLetterSnapshot();

    var wasRead = !!(st.mailboxRead && st.mailboxRead[mail.id]);
    var pendingBonusMsg = null;
    st.mailboxRead[mail.id] = true;
    if (!wasRead && !st.mailboxClaimed[mail.id]) {
      st.mailboxClaimed[mail.id] = true;
      applyMailBonus(mail, st);
      recordSeasonAction('展阅「' + mail.title + '」', mail.senderName + '来信', st);
      pendingBonusMsg = '已拆阅来信 · ' + mail.bonusText;
    }
    saveSafe();
    updateHudSafe();
    syncSylviaHub(st);

    if (typeof document !== 'undefined') {
      var demo = document.getElementById('letter-demo');
      if (demo) {
        var kicker = demo.querySelector('.letter-kicker');
        var heading = demo.querySelector('.letter-heading');
        var seal = demo.querySelector('.letter-seal span');
        var article = demo.querySelector('.alice-letter');
        var waxCls = WAX_CLASS_BY_TONE[mail.sealTone] || 'wax-ice';

        // 拆信瞬间收起活跃提示条，首读奖励提示延后至信笺收起后再播报，避免压住信头
        var activeToast = document.getElementById('toast');
        if (activeToast && activeToast.classList) activeToast.classList.remove('show');
        if (pendingBonusMsg) _pendingMailBonusToast = pendingBonusMsg;

        if (mail.useAliceDynamic) {
          restoreDefaultAliceLetter();
          if (root.BranchingDirector && typeof root.BranchingDirector.syncAliceLetterDOM === 'function') {
            try { root.BranchingDirector.syncAliceLetterDOM(); } catch (e) {}
          }
          applyLetterWaxClass(demo, waxCls);
        } else {
          _customLetterActive = true;
          applyLetterWaxClass(demo, waxCls);
          if (kicker) kicker.textContent = mail.kicker || 'A letter for you';
          if (heading) heading.textContent = mail.heading || mail.title;
          if (seal) seal.innerHTML = ico(mail.sealIcon || 'crystal');
          if (article) {
            article.innerHTML =
              '<div class="letter-crest">' + ico('seal') + '</div>' +
              '<p class="letter-to">' + escapeHtml(mail.salutation) + '</p>' +
              mail.paragraphs.map(function (p) { return '<p>' + escapeHtml(p) + '</p>'; }).join('') +
              '<p class="letter-sign">' + escapeHtml(mail.sign) + '</p>';
          }
        }

        sfxSafe('wax_seal');
        // 关闭信匣弹窗以免双层堆叠，并触发 3D 火漆拆信演出
        closeMailboxModal();
        if (typeof openLetterDemo === 'function') {
          if (mail.useAliceDynamic) {
            openLetterDemo();
          } else {
            // 直接触发动画，避免被 BranchingDirector 包装层用爱丽丝信覆写其他角色信件
            demo.classList.remove('hidden', 'playing', 'revealed');
            demo.setAttribute('aria-hidden', 'false');
            void demo.offsetWidth;
            demo.classList.add('playing');
          }
        } else {
          demo.classList.remove('hidden', 'playing');
          demo.classList.add('revealed');
          demo.setAttribute('aria-hidden', 'false');
        }
        return true;
      }
    }
    if (pendingBonusMsg) toastSafe(pendingBonusMsg);
    return true;
  }

  function closeMailboxModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('mailbox-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function openMailboxModal() {
    if (typeof document === 'undefined') return null;
    var st = ensureRaisingState();
    if (!st) return null;

    var ov = document.getElementById('mailbox-overlay');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'mailbox-overlay';
      ov.className = 'overlay hidden rh-overlay';
      document.body.appendChild(ov);
    }
    ov.classList.add('overlay', 'rh-overlay');

    var unlocked = getAvailableMail(st);
    var unlockedIds = {};
    unlocked.forEach(function (m) { unlockedIds[m.id] = true; });
    var unreadCnt = getUnreadMailCount(st);

    // 排序：已达未拆优先，其次已拆阅，未启封信函统一下沉至底部
    var sortedCatalog = MAILBOX_CATALOG.map(function (m, idx) {
      var open = !!unlockedIds[m.id];
      var read = !!(st.mailboxRead && st.mailboxRead[m.id]);
      var rank = !open ? 2 : (read ? 1 : 0);
      return { mail: m, idx: idx, rank: rank };
    }).sort(function (a, b) {
      return a.rank !== b.rank ? (a.rank - b.rank) : (a.idx - b.idx);
    });

    var cardsHtml = sortedCatalog.map(function (entry) {
      var m = entry.mail;
      var open = !!unlockedIds[m.id];
      var read = !!(st.mailboxRead && st.mailboxRead[m.id]);
      if (!open) {
        return (
          '<article class="rh-mail-card is-locked" data-mail-id="' + escapeHtml(m.id) + '">' +
            '<div class="rmc-inner">' +
              '<div class="rmc-av locked">' + ico('lock') + '</div>' +
              '<div class="rmc-body">' +
                '<div class="rmc-head-group">' +
                  '<div class="rmc-top"><strong>未启封信函</strong><span class="rmc-era">' + escapeHtml(m.era) + '</span></div>' +
                '</div>' +
                '<p class="rmc-hint">随着旅程推进与结识对应人物，驿使便会送来这封火漆信笺。</p>' +
              '</div>' +
            '</div>' +
          '</article>'
        );
      }
      var av = resolvePortraitSafe(m.from, 'normal');
      var tone = m.sealTone || 'sapphire';
      var sealIco = m.sealIcon || 'seal';
      var bonusSegs = String(m.bonusText || '').replace(/^首读奖励：/, '').split(/\s*·\s*/).filter(Boolean);
      var bonusHtml = '<span class="rmc-bonus-lbl">首读奖励：</span>' + bonusSegs.map(function (seg) {
        return '<span class="rmc-bonus-seg">' + escapeHtml(seg) + '</span>';
      }).join('<span class="rmc-bonus-dot" aria-hidden="true">·</span>');
      return (
        '<button type="button" class="rh-mail-card is-open' + (read ? ' is-read' : ' is-unread') + '" data-open-mail="' + escapeHtml(m.id) + '">' +
          '<span class="rmc-inner">' +
            '<span class="rmc-av">' + (av ? '<img src="' + escapeHtml(av) + '" alt="' + escapeHtml(m.senderName) + '"/>' : ico('envelope')) + '</span>' +
            '<span class="rmc-body">' +
              '<span class="rmc-head-group">' +
                '<span class="rmc-top">' +
                  '<strong>' + escapeHtml(m.title) + '</strong>' +
                  '<span class="rmc-seal-cluster">' +
                    '<span class="rmc-wax tone-' + escapeHtml(tone) + '" title="' + escapeHtml(m.sealLabel) + '" aria-hidden="true">' + ico(sealIco) + '</span>' +
                    '<em class="rmc-state ' + (read ? 'is-read' : 'is-unread rh-mail-unread') + '">' + (read ? '已阅' : '<i class="rmc-dot" aria-hidden="true"></i>未拆') + '</em>' +
                  '</span>' +
                '</span>' +
                '<span class="rmc-meta">' + escapeHtml(m.senderName) + ' · ' + escapeHtml(m.sealLabel) + ' · ' + escapeHtml(m.era) + '</span>' +
              '</span>' +
              '<span class="rmc-bonus">' + bonusHtml + '</span>' +
            '</span>' +
          '</span>' +
        '</button>'
      );
    }).join('');

    ov.innerHTML =
      '<div class="end-card modal-shell rh-modal-shell rh-mail-shell">' +
        '<div class="modal-head rh-modal-head">' +
          '<div class="rh-head-title">' +
            '<span class="rh-head-crest">' + ico('envelope') + '</span>' +
            '<div>' +
              '<h2>火漆信匣</h2>' +
              '<p class="rh-head-sub">已收达 ' + unlocked.length + ' / ' + MAILBOX_CATALOG.length + ' 封 · 未读 ' + unreadCnt + ' 封（点选信函启封阅读）</p>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="modal-close-x rh-close-x" id="rh-mail-close" aria-label="关闭火漆信匣">×</button>' +
        '</div>' +
        '<div class="modal-scroll rh-modal-scroll">' +
          '<div class="rh-mail-list">' + cardsHtml + '</div>' +
        '</div>' +
        '<div class="modal-foot rh-modal-foot">' +
          '<button type="button" class="rh-btn ghost" id="rh-mail-done">合上信匣</button>' +
        '</div>' +
      '</div>';

    ov.onclick = function (e) { if (e.target === ov) closeMailboxModal(); };
    ov.querySelector('#rh-mail-close').onclick = closeMailboxModal;
    ov.querySelector('#rh-mail-done').onclick = closeMailboxModal;
    ov.querySelectorAll('[data-open-mail]').forEach(function (btn) {
      btn.onclick = function () {
        openMailboxLetter(btn.getAttribute('data-open-mail'), st);
      };
    });

    ov.classList.remove('hidden');
    return ov;
  }

  /* =========================================================================
     五、Pillar 5：双轨多结局终幕系统 (#ending-screen / evaluateEnding / 图鉴数据源)
     ========================================================================= */
  var CAREER_CATALOG = {
    polar_archmage: {
      id: 'polar_archmage',
      title: '极北冰晶大魔导师',
      badge: '冰道绝巅',
      focusLabel: '魔力适性与高阶冰水造诣',
      icon: 'crystal',
      summary: '以无瑕无泡的极北冰晶术式名动大陆，隔空凝冰与恒温控场皆臻化境。',
      epilogue: '北境雪原与各国法师塔之间流传着关于银蓝冰晶的传说。无论身处边关石堡还是高塔讲坛，她抬手便能筑起澄澈无瑕的霜幕，既可护一方药草与城垣安然无恙，也能在谈笑间令漫天暴雪归于沉寂。',
      unlockHint: '着重精修魔力适性与高阶魔导术式即可迈向此生涯。'
    },
    jikan_twin_blade: {
      id: 'jikan_twin_blade',
      title: '霁馆双剑传人',
      badge: '生根剑心',
      focusLabel: '体能锤炼与澄岚剑技',
      icon: 'sword',
      summary: '承袭澄岚霁馆生根步与送刀精义，将极薄钢冰化入剑路，动静皆有法度。',
      epilogue: '乌木剑鞘上的紫蝶剑穗历经塞北风霜仍旧明亮。她把霁馆院角磨炼出的沉稳步法带向四方，收剑时温润含蓄，出刃时如风雪破雾，令澄岚剑馆的名号随远风传遍南北长道。',
      unlockHint: '钻研体能并在澄岚霁馆修习步法与挥剑即可迈向此生涯。'
    },
    asla_visiting_scholar: {
      id: 'asla_visiting_scholar',
      title: '阿斯拉魔导客座教授',
      badge: '明晰学理',
      focusLabel: '心智涵养与系统课程造诣',
      icon: 'book',
      summary: '将梅林定律与实战控魔心得编纂成册，成为令学院后辈景仰的年轻学者。',
      epilogue: '当钟塔的午后阳光再度照进图书馆靠墙双人桌，她的名字已印在新版魔导阻率勘误集的扉页。比起耀眼头衔，她更享受在讲台后轻描淡写点破繁琐术式，随后准时合卷去享一份热茶点心。',
      unlockHint: '深耕心智四维并完成多门学院或理论课程进阶即可解锁。'
    },
    leisurely_heiress: {
      id: 'leisurely_heiress',
      title: '悠闲庄园千金',
      badge: '初衷圆满',
      focusLabel: '高悠闲心境与从容气质',
      icon: 'cup',
      summary: '历经风雨却始终守住从容气度，真正过上了喝茶看雪、无忧自在的理想人生。',
      epilogue: '转生之初许下的心愿终于在风雪散尽后尘埃落定。白瓷茶盏升起细袅清雾，窗外鸢尾与冬雪各有四时之美；所有惊险波澜都沉淀作茶余笑谈，往后余生尽是慢悠悠的好光景。',
      unlockHint: '保持丰沛悠闲度并涵养优雅气质，贯彻悠闲生活初心即可解锁。'
    },
    wandering_spellblade: {
      id: 'wandering_spellblade',
      title: '自由旅途的魔剑士',
      badge: '剑魔双修',
      focusLabel: '体能与魔力均衡并进',
      icon: 'wind',
      summary: '一手寒冰术式，一手乌木长剑，不拘名号也不困樊笼，纵情行游天地之间。',
      epilogue: '官道、商旅驿站与北方雪岭都留下过她轻快沉定的足迹。既能在危急关头拔剑凝冰护住同行之人，也能在晴日街巷里挑一盒桂花米糕悠然歇脚，活成了连风神都会含笑称赞的自由旅人。',
      unlockHint: '兼修体能与魔力适性并踏足远行旅途即可解锁。'
    },
    quiet_traveler: {
      id: 'quiet_traveler',
      title: '霜雪行旅之人',
      badge: '静水行远',
      focusLabel: '随性自适的旅途历程',
      icon: 'compass',
      summary: '不执泥于宏大名号，只顺着本心丈量异世界山川与四季霜雪。',
      epilogue: '风雪来时便添件厚氅，晴日暖时便停步赏花。纵使前路仍有未知的城邦与故人等待重逢，她已攒足底气与从容，按自己的节奏一步步走进异世界的广阔天地。',
      unlockHint: '随心经历四季流转，自然步入终幕即可收录。'
    }
  };

  var BOND_ENDING_CATALOG = {
    dawn_reunion: {
      id: 'dawn_reunion',
      title: '凛冬破晓 · 众星同归',
      badge: '破晓明约',
      subtitle: '洞悉暗潮并拢住同盟与体面，风雪散后共迎晨光',
      accent: 'cobalt',
      summary: '提前看穿王都暗流，又以平视与坦诚拢住挚友同窗，终令散落各方的星光在破晓重聚。',
      epilogue: '漫长霜夜终于迎来第一线清澄晨光。从公爵书房留下的霜封暗记，到王都东郊无声让出的巡防空窗，每一份体面与信赖都在寒冬尽头汇聚成桥。昔日分隔天涯的家人与同窗重新并肩而立，往昔阴霾就此消散于晴空之下。',
      unlockHint: '点亮王都暗流线索，并在学院伙伴间偏向坦诚同盟。'
    },
    frost_sovereign: {
      id: 'frost_sovereign',
      title: '孤锋霜冕 · 极北独行',
      badge: '霜冕孤锋',
      subtitle: '以最严苛的试炼与锋芒自成秩序，凭剑与冰破局',
      accent: 'glacier',
      summary: '以寸步不让的锋芒与清冷自持迎击风暴，独自在极北雪原立起无可撼动的威名。',
      epilogue: '雪原寒风吹不弯执剑之人的脊梁。她把每一次针锋相对的赌约与生死试炼都化作掌中锋刃，无需仰赖任何施舍，仅凭清澄冷冽的冰剑与精准决断，便为自己与所守之物劈出朗朗乾坤。',
      unlockHint: '在艾诺、夏洛特与诺艾儿的交流中倾向严苛试炼与锋芒竞逐。'
    },
    twin_winds: {
      id: 'twin_winds',
      title: '双风并翼 · 远行之誓',
      badge: '双风并翼',
      subtitle: '妹妹学会独自听风，旧友奔赴山海，终在高处重逢',
      accent: 'emerald',
      summary: '独立乘风成长的爱丽丝与奔赴山海的远行之约彼此呼应，终在云端高处携手重逢。',
      epilogue: '遥远南岭吹来的清风越过重重山脊，与赫兰冰原的北风在晴空下悄然合流。曾经躲在衣袖后轻声发问的白发少女已能独自撑起风障，系着紫蝶剑穗的长剑亦踏遍边疆，她们终在更高更辽阔的天地里并翼重逢。',
      unlockHint: '引导爱丽丝独立听风，并点亮远行之约与北境旧风线索。'
    },
    sheltered_hearth: {
      id: 'sheltered_hearth',
      title: '霜檐暖灯 · 执手归处',
      badge: '霜檐暖灯',
      subtitle: '紧握碎贝壳与霁馆灯火，替漂泊之人留一处永不熄灭的炉火',
      accent: 'rose',
      summary: '将最深的牵挂留予咫尺身畔的暖灯与炉火，无论风雪行至何方终将归航重聚。',
      epilogue: '冬雪覆上飞檐，屋内炉火却映得四壁温润明亮。右腕上的白色碎贝壳手绳、霁馆空着的第三排竹剑架与桌上氤氲热气的清粥，都在默默守候旅人归来。风雪终究吹不散这份贴近心口的安暖。',
      unlockHint: '珍惜爱丽丝的依恋、霁馆暖灯与极北知己之谊即可收束此归宿。'
    },
    unwritten_snow: {
      id: 'unwritten_snow',
      title: '初雪未落 · 静水待明',
      badge: '静水初雪',
      subtitle: '星轨尚在舒展，未来仍有无限风雪与晴空待你亲笔落墨',
      accent: 'silver',
      summary: '因果之弦尚未定型，天地辽阔如初降新雪，一切可能皆仍握在掌心之中。',
      epilogue: '北风吹过尚未落满脚印的雪原，远方地平线泛出清亮天蓝。每一段擦肩而过的缘分与未完的约定都在静静积蓄微光，只要继续步履从容地向前行去，属于银发千金与旅人的新篇章才正要展开。',
      unlockHint: '在各条因果双轴保持静水平衡时达成终幕即可收录。'
    }
  };

  // 10 位核心同伴终幕后日谈（严守澄岚/赫兰「渔」「眷寒渔」身份铁律）
  var COMPANION_AFTERWORDS = [
    {
      charId: 'alice',
      name: '爱丽丝',
      role: '风之妹妹',
      isUnlocked: function (st) { return flagSafe('ch_alice_born', st) || ((st.know && st.know.alice) || 0) > 0; },
      text: function (st) {
        var mode = (root.BranchingDirector && root.BranchingDirector.getAliceArcMode) ? root.BranchingDirector.getAliceArcMode(st) : 'default';
        if (mode === 'independence') {
          return '在群山雪岭间将御风术式淬炼纯熟，带锁小本子记满北风轨迹，正一步步朝着与姐姐大人高处重逢的约定前行。';
        }
        if (mode === 'obsession') {
          return '右腕始终系着白色碎贝壳手绳，无论翻越几重山岭都记挂着姐姐大人的温度，誓言重逢后再不松手。';
        }
        return '在风神指点下愈发沉静坚定，每逢起风便仰头辨认北境雪气，默默守望着远方的姐姐。';
      }
    },
    {
      charId: 'beatrice',
      name: '贝阿特丽丝',
      role: '炽阳长姐',
      isUnlocked: function (st) { return ((st.know && st.know.beatrice) || 0) > 0 || ((st.love && st.love.beatrice) || 0) > 0 || (st.ageY || 0) >= 1; },
      text: function () {
        return '金色长发与炽烈火光始终照亮妹妹们记忆中最明亮的一角。她曾以姐姐的骄傲挡在通道尽头，也成了维斯特利亚三姐妹永不熄灭的勇气火种。';
      }
    },
    {
      charId: 'sophia',
      name: '索菲亚',
      role: '公爵夫人',
      isUnlocked: function (st) { return ((st.know && st.know.sophia) || 0) > 0 || ((st.love && st.love.sophia) || 0) > 0 || (st.ageY || 0) >= 1; },
      text: function () {
        return '那枚霜杉木簪与拨开额前碎发的温柔触感，化作女儿们纵使孤身行旅万里也绝不慌乱的底气。';
      }
    },
    {
      charId: 'noelle',
      name: '诺艾儿',
      role: '水系首席',
      isUnlocked: function (st) { return flagSafe('met_noelle', st) || ((st.know && st.know.noelle) || 0) > 0; },
      text: function (st) {
        var mode = (root.BranchingDirector && root.BranchingDirector.getNoelleArcMode) ? root.BranchingDirector.getNoelleArcMode(st) : 'default';
        if (mode === 'partnership') {
          return '仍习惯把重要约会记在左手背上，图书馆靠墙双人桌与省魔手稿一直替挚友留着位子，只待重逢时再一同推导新术式。';
        }
        return '以分毫不差的严谨成为王都公认的青年精算学者，偶尔喂完钟塔橘猫，仍会望向北方雪线念叨那笔未完的切磋账。';
      }
    },
    {
      charId: 'charlotte',
      name: '夏洛特',
      role: '贝尔蒙千金',
      isUnlocked: function (st) { return flagSafe('met_charlotte', st) || ((st.know && st.know.charlotte) || 0) > 0; },
      text: function (st) {
        var mode = (root.BranchingDirector && root.BranchingDirector.getCharlotteArcMode) ? root.BranchingDirector.getCharlotteArcMode(st) : 'default';
        if (mode === 'candor') {
          return '在王都政局的暗潮里稳住了贝尔蒙家外务，无人时仍会独自泡一盏薄荷茶，替纪念林里那株并肩的小树细心浇水。';
        }
        return '依旧端着冷傲体面的架子纵横王都社交场，抽屉最深处压着未寄出的战书羊皮笺，笃定唯有昔日劲敌配得上全力一战。';
      }
    },
    {
      charId: 'aino',
      name: '艾诺',
      role: '赫兰冰法师',
      isUnlocked: function (st) { return flagSafe('met_aino', st) || flagSafe('ch_distant_wind_1', st) || ((st.know && st.know.aino) || 0) > 0; },
      text: function (st) {
        var mode = (root.BranchingDirector && root.BranchingDirector.getAinoArcMode) ? root.BranchingDirector.getAinoArcMode(st) : 'default';
        if (mode === 'kinship') {
          return '继续驻守赫兰冰封峡谷东段哨墙，窗台那株北极铃兰借着均匀薄冰岁岁常青。她从未在外人面前点破魔剑士眷寒渔的旧名，只默默替身畔留着一碗热麦汤。';
        }
        return '凭严苛利落的冰枪术式晋升赫兰边防中坚，每逢大雪封山便邀魔剑士眷寒渔登上东段哨台拆招切磋，打完那场迟来的第四局。';
      }
    },
    {
      charId: 'jilan',
      name: '霁岚',
      role: '霁馆少女',
      isUnlocked: function (st) { return flagSafe('arrived_jikan', st) || ((st.know && st.know.jilan) || 0) > 0; },
      text: function (st) {
        var ax = (st.causal && st.causal.axes && st.causal.axes.jilan) || { hearth: 0, wanderlust: 0 };
        if ((ax.wanderlust || 0) > (ax.hearth || 0)) {
          return '把澄岚霁馆打理得有声有色之余也背起竹剑四处游历，只盼某天在塞北雪道上迎面撞见系着紫蝶剑穗的渔，并肩大干一场。';
        }
        return '每天清晨依旧把霁馆院角扫得干干净净，炉上温着不糊底的火腿粥，第三排第四格空竹剑架永远替远行的渔留着。';
      }
    },
    {
      charId: 'ji',
      name: '霁馆主',
      role: '澄岚老剑师',
      isUnlocked: function (st) { return flagSafe('arrived_jikan', st) || ((st.know && st.know.ji) || 0) > 0; },
      text: function () {
        return '靠在霁馆老树下摇着蒲扇晒太阳，听往来商旅说起北境有位步法扎实的铜级魔剑士眷寒渔时，笑纹皱得比往日更深了几分。';
      }
    },
    {
      charId: 'masha',
      name: '玛莎',
      role: '澄岚公会接待',
      isUnlocked: function (st) { return flagSafe('arrived_jikan', st) || ((st.know && st.know.masha) || 0) > 0; },
      text: function () {
        return '拨着算盘守在澄岚冒险者公会柜台后，每当新人吹嘘魔核切工，她总要抬眼念一句从前那位名叫眷寒渔的姑娘切得才叫利索。';
      }
    },
    {
      charId: 'musa',
      name: '穆萨',
      role: '北境随军老药师',
      isUnlocked: function (st) { return flagSafe('ch_distant_wind_1', st) || ((st.know && st.know.musa) || 0) > 0; },
      text: function () {
        return '在赫兰前线医帐里把恒温薄冰保鲜药草的窍门传给了新来的学徒，逢人便夸那位从苏秦北上的渔姑娘手稳心细，救活了不少伤兵。';
      }
    }
  ];

  function canOpenEndingForecast(targetS) {
    var st = targetS || getS();
    if (!st) return false;
    return st.phase === 'journey'
      || st.phase === 'finale'
      || flagSafe('did_turnpoint', st)
      || flagSafe('arrived_jikan', st)
      || flagSafe('ch_distant_wind_1', st);
  }

  function evaluateCareerId(st) {
    var stats = (st && st.stats) || { body: 5, mind: 15, mana: 10, charm: 8 };
    var body = Number(stats.body || 0);
    var mind = Number(stats.mind || 0);
    var mana = Number(stats.mana || 0);
    var charm = Number(stats.charm || 0);
    var leisure = Number((st && st.leisure != null) ? st.leisure : 75);
    var tier = Number((st && st.tier) || 0);
    var mag = Number((st && st.mag) || 0);
    var atk = Number((st && st.atk) || 0);

    var courseLvSum = 0;
    Object.keys((st && st.courses) || {}).forEach(function (cid) {
      var c = st.courses[cid];
      courseLvSum += (c && typeof c === 'object') ? Number(c.lv || 0) : Number(c || 0);
    });

    var hasSwordSkill = hasSkillSafe('root_step', st) || hasSkillSafe('soft_cut', st) || hasSkillSafe('frost_edge', st);
    var hasHighMagic = hasSkillSafe('mana_cycle', st) || hasSkillSafe('instant_ice', st) || hasSkillSafe('ice_palace', st);

    var candidates = [
      {
        id: 'polar_archmage',
        ok: mana >= 55 || (tier >= 3 && mana >= 35) || (mag >= 130 && hasHighMagic),
        score: mana * 1.85 + mind * 0.35 + tier * 10 + (hasHighMagic ? 16 : 0)
      },
      {
        id: 'jikan_twin_blade',
        ok: (body >= 45 && (hasSwordSkill || atk >= 40)) || (body >= 35 && hasSwordSkill && flagSafe('arrived_jikan', st)),
        score: body * 1.9 + atk * 0.65 + (hasSwordSkill ? 24 : 0)
      },
      {
        id: 'asla_visiting_scholar',
        ok: (mind >= 55 && courseLvSum >= 3) || (mind >= 65),
        score: mind * 1.85 + courseLvSum * 7 + (hasSkillSafe('mana_calc', st) ? 16 : 0)
      },
      {
        id: 'leisurely_heiress',
        ok: leisure >= 80 && charm >= 50,
        score: charm * 1.85 + Math.max(0, leisure - 60) * 1.15
      },
      {
        id: 'wandering_spellblade',
        ok: body >= 28 && mana >= 32 && (st.phase === 'journey' || st.phase === 'finale' || flagSafe('arrived_jikan', st)),
        score: (body + mana) * 1.1 + (st.lv || 1) * 0.5
      }
    ];

    var passed = candidates.filter(function (c) { return c.ok; });
    if (!passed.length) return 'quiet_traveler';
    passed.sort(function (a, b) { return b.score - a.score; });
    return passed[0].id;
  }

  function evaluateEnding(targetS) {
    var st = ensureRaisingState(targetS);
    var tendency = null;
    if (root.BranchingDirector && typeof root.BranchingDirector.getEndingTendency === 'function') {
      try { tendency = root.BranchingDirector.getEndingTendency(st); } catch (e) {}
    }
    var bondId = (tendency && tendency.id && BOND_ENDING_CATALOG[tendency.id]) ? tendency.id : 'unwritten_snow';
    var careerId = evaluateCareerId(st);
    var bond = BOND_ENDING_CATALOG[bondId];
    var career = CAREER_CATALOG[careerId] || CAREER_CATALOG.quiet_traveler;
    var compositeId = bond.id + '__' + career.id;

    var echoes = (st && st.causal && Array.isArray(st.causal.echoes)) ? st.causal.echoes : [];
    var featuredEcho = echoes.length ? echoes[0] : null;

    var afterwords = COMPANION_AFTERWORDS.filter(function (aw) {
      try { return aw.isUnlocked(st); } catch (e) { return false; }
    }).sort(function (a, b) {
      var sa = (((st.love && st.love[a.charId]) || 0) * 20) + ((st.know && st.know[a.charId]) || 0);
      var sb = (((st.love && st.love[b.charId]) || 0) * 20) + ((st.know && st.know[b.charId]) || 0);
      return sb - sa;
    }).slice(0, 6).map(function (aw) {
      return {
        charId: aw.charId,
        name: aw.name,
        role: aw.role,
        portrait: resolvePortraitSafe(aw.charId, 'normal'),
        text: aw.text(st)
      };
    });

    return {
      compositeId: compositeId,
      bondId: bond.id,
      careerId: career.id,
      bond: bond,
      career: career,
      tendency: tendency || { id: bond.id, badge: bond.badge, confidence: 50 },
      featuredEcho: featuredEcho,
      afterwords: afterwords,
      statsSnapshot: {
        name: (!st || !flagSafe('named', st)) ? '希尔维亚' : (st.alias || st.name || '希尔维亚'),
        ageStr: formatAgeSafe(st),
        tierName: formatTierSafe(st),
        lv: (st && st.lv) || 1,
        leisure: (st && st.leisure != null) ? st.leisure : 75,
        stats: Object.assign({ body: 5, mind: 15, mana: 10, charm: 8 }, (st && st.stats) || {})
      }
    };
  }

  function readStoredEndingsMap() {
    try {
      var raw = JSON.parse(localStorage.getItem(ENDINGS_STORAGE_KEY) || '{}');
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function persistUnlockedEnding(evalRes) {
    if (!evalRes || !evalRes.compositeId) return;
    var cid = evalRes.compositeId;
    var meta = {
      compositeId: cid,
      bondId: evalRes.bondId,
      careerId: evalRes.careerId,
      bondTitle: evalRes.bond.title,
      careerTitle: evalRes.career.title,
      unlockedAt: Date.now(),
      ageStr: evalRes.statsSnapshot.ageStr,
      lv: evalRes.statsSnapshot.lv
    };

    // 1. 写入独立 localStorage 存档键
    var stored = readStoredEndingsMap();
    if (!stored[cid]) stored[cid] = meta;
    else stored[cid] = Object.assign({}, stored[cid], meta);
    try { localStorage.setItem(ENDINGS_STORAGE_KEY, JSON.stringify(stored)); } catch (e) {}

    // 2. 同步写入全局 codex.endings 与 codex.endingMeta
    var cx = (typeof codex !== 'undefined' && codex) ? codex : (root && root.codex);
    if (cx && typeof cx === 'object') {
      if (!Array.isArray(cx.endings)) cx.endings = [];
      if (cx.endings.indexOf(cid) === -1) cx.endings.push(cid);
      if (!cx.endingMeta || typeof cx.endingMeta !== 'object') cx.endingMeta = {};
      cx.endingMeta[cid] = meta;
      if (typeof saveCodex === 'function') {
        try { saveCodex(); } catch (e) {}
      } else if (root && typeof root.saveCodex === 'function') {
        try { root.saveCodex(); } catch (e) {}
      }
    }
  }

  function getUnlockedEndingsArchive() {
    var map = readStoredEndingsMap();
    var cx = (typeof codex !== 'undefined' && codex) ? codex : (root && root.codex);
    if (cx && Array.isArray(cx.endings)) {
      cx.endings.forEach(function (cid) {
        if (!cid || map[cid]) return;
        var parts = String(cid).split('__');
        var bId = BOND_ENDING_CATALOG[parts[0]] ? parts[0] : 'unwritten_snow';
        var cId = CAREER_CATALOG[parts[1]] ? parts[1] : 'quiet_traveler';
        var fromMeta = (cx.endingMeta && cx.endingMeta[cid]) || {};
        map[cid] = Object.assign({
          compositeId: cid,
          bondId: bId,
          careerId: cId,
          bondTitle: BOND_ENDING_CATALOG[bId].title,
          careerTitle: CAREER_CATALOG[cId].title,
          unlockedAt: Date.now()
        }, fromMeta);
      });
    }

    var list = Object.values(map).sort(function (a, b) { return (b.unlockedAt || 0) - (a.unlockedAt || 0); });
    var unlockedBonds = {};
    var unlockedCareers = {};
    list.forEach(function (item) {
      if (item.bondId) unlockedBonds[item.bondId] = true;
      if (item.careerId) unlockedCareers[item.careerId] = true;
    });

    return {
      list: list,
      byId: map,
      unlockedBonds: unlockedBonds,
      unlockedCareers: unlockedCareers,
      count: list.length,
      totalCombinations: Object.keys(BOND_ENDING_CATALOG).length * Object.keys(CAREER_CATALOG).length
    };
  }

  function closeEndingScreen() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('ending-screen');
    if (ov) ov.classList.add('hidden');
  }

  function showEndingScreen(optionalId, opts) {
    if (typeof document === 'undefined') return null;
    var options = opts || {};
    var st = ensureRaisingState(options.state);
    var res = evaluateEnding(st);

    // 若指定了特定复合 ID 或羁绊 ID（如图鉴重温或测试），覆盖展示项
    if (optionalId && typeof optionalId === 'string') {
      var parts = optionalId.split('__');
      var bId = BOND_ENDING_CATALOG[parts[0]] ? parts[0] : res.bondId;
      var cId = (parts[1] && CAREER_CATALOG[parts[1]]) ? parts[1] : (CAREER_CATALOG[parts[0]] ? parts[0] : res.careerId);
      res = Object.assign({}, res, {
        bondId: bId,
        careerId: cId,
        bond: BOND_ENDING_CATALOG[bId],
        career: CAREER_CATALOG[cId],
        compositeId: bId + '__' + cId
      });
    }

    if (!options.previewOnly) {
      persistUnlockedEnding(res);
    }

    var ov = document.getElementById('ending-screen');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'ending-screen';
      ov.className = 'overlay hidden rh-overlay rh-ending-overlay';
      document.body.appendChild(ov);
    }
    ov.classList.add('overlay', 'rh-overlay', 'rh-ending-overlay');

    var sylviaStage = getSylviaStage(st);
    var sylviaPortrait = resolvePortraitSafe('sylvia', pickSafeSylviaEmo(sylviaStage, 'smile'));
    var snap = res.statsSnapshot;
    var echoHtml = (res.featuredEcho && res.featuredEcho.quote)
      ? '<blockquote class="rh-end-echo">' +
          '<div class="ree-quote">「' + escapeHtml(res.featuredEcho.quote) + '」</div>' +
          '<footer class="ree-meta">' + escapeHtml(res.featuredEcho.speaker || '往昔回声') + ' · ' + escapeHtml(res.featuredEcho.context || '旅途铭刻') + '</footer>' +
        '</blockquote>'
      : '';

    var afterwordsHtml = res.afterwords.length
      ? '<div class="rh-end-afterwords">' +
          '<h3 class="rh-end-sec-title">' + ico('quill') + '<span>同伴后日谈</span></h3>' +
          '<div class="rh-aw-grid">' +
            res.afterwords.map(function (aw) {
              return (
                '<article class="rh-aw-card">' +
                  '<div class="raw-head">' +
                    '<span class="raw-av">' + (aw.portrait ? '<img src="' + escapeHtml(aw.portrait) + '" alt="' + escapeHtml(aw.name) + '"/>' : escapeHtml(aw.name.slice(0, 1))) + '</span>' +
                    '<div><strong>' + escapeHtml(aw.name) + '</strong><small>' + escapeHtml(aw.role) + '</small></div>' +
                  '</div>' +
                  '<p>' + escapeHtml(aw.text) + '</p>' +
                '</article>'
              );
            }).join('') +
          '</div>' +
        '</div>'
      : '';

    var arch = getUnlockedEndingsArchive();

    ov.innerHTML =
      '<div class="end-card modal-shell rh-modal-shell rh-ending-shell accent-' + escapeHtml(res.bond.accent || 'cobalt') + '" data-ending-id="' + escapeHtml(res.compositeId) + '">' +
        '<div class="modal-head rh-modal-head rh-ending-head">' +
          '<div class="rh-head-title">' +
            '<span class="rh-head-crest">' + ico('crown') + '</span>' +
            '<div>' +
              '<h2 id="end-title">' + escapeHtml(res.career.title) + ' × ' + escapeHtml(res.bond.title) + '</h2>' +
              '<p class="rh-head-sub">' + escapeHtml(res.bond.subtitle) + '</p>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="modal-close-x rh-close-x" id="rh-end-close" aria-label="关闭终幕画面">×</button>' +
        '</div>' +
        '<div class="modal-scroll rh-modal-scroll">' +
          '<div class="rh-end-hero">' +
            '<div class="rh-end-portrait">' +
              (sylviaPortrait ? '<img src="' + escapeHtml(sylviaPortrait) + '" alt="' + escapeHtml(snap.name) + '"/>' : ico('crystal')) +
            '</div>' +
            '<div class="rh-end-identity">' +
              '<div class="rh-end-badges">' +
                '<span class="rh-end-pill career">' + ico(res.career.icon) + '<span>生涯称号 · ' + escapeHtml(res.career.badge) + '</span></span>' +
                '<span class="rh-end-pill bond">' + ico('spark') + '<span>羁绊归宿 · ' + escapeHtml(res.bond.badge) + '</span></span>' +
                '<span class="rh-end-pill archive">已收录终幕 ' + arch.count + '/' + arch.totalCombinations + '</span>' +
              '</div>' +
              '<div id="end-stats" class="rh-end-stats-strip">' +
                '<span><b>名号</b> ' + escapeHtml(snap.name) + '</span>' +
                '<span><b>年岁</b> ' + escapeHtml(snap.ageStr) + '</span>' +
                '<span><b>等阶</b> ' + escapeHtml(snap.tierName) + ' · Lv.' + snap.lv + '</span>' +
                '<span><b>四维</b> 体' + (snap.stats.body | 0) + ' / 智' + (snap.stats.mind | 0) + ' / 魔' + (snap.stats.mana | 0) + ' / 气' + (snap.stats.charm | 0) + '</span>' +
                '<span><b>悠闲度</b> ' + snap.leisure + '</span>' +
              '</div>' +
              echoHtml +
            '</div>' +
          '</div>' +
          '<div id="end-desc" class="rh-end-epilogues">' +
            '<section class="rh-ep-card">' +
              '<h3>' + ico('spark') + '<span>羁绊归宿 · ' + escapeHtml(res.bond.title) + '</span></h3>' +
              '<p>' + escapeHtml(res.bond.epilogue) + '</p>' +
            '</section>' +
            '<section class="rh-ep-card">' +
              '<h3>' + ico(res.career.icon) + '<span>生涯终章 · ' + escapeHtml(res.career.title) + '</span></h3>' +
              '<p>' + escapeHtml(res.career.epilogue) + '</p>' +
            '</section>' +
          '</div>' +
          afterwordsHtml +
        '</div>' +
        '<div class="modal-foot rh-modal-foot">' +
          '<button type="button" class="rh-btn primary" id="rh-end-continue">' + ico('compass') + '<span>继续旅途</span></button>' +
          '<button type="button" class="rh-btn soft" id="rh-end-codex">' + ico('book') + '<span>打开终幕图鉴</span></button>' +
          '<button type="button" class="rh-btn ghost" id="rh-end-title-btn">返回标题</button>' +
        '</div>' +
      '</div>';

    ov.onclick = function (e) { if (e.target === ov) closeEndingScreen(); };
    ov.querySelector('#rh-end-close').onclick = closeEndingScreen;
    ov.querySelector('#rh-end-continue').onclick = function () {
      sfxSafe('click');
      closeEndingScreen();
    };
    ov.querySelector('#rh-end-codex').onclick = function () {
      sfxSafe('open');
      closeEndingScreen();
      if (root.VNUx && typeof root.VNUx.openCodexGallery === 'function') {
        root.VNUx.openCodexGallery('endings');
      } else {
        var btnCodex = document.getElementById('btn-codex');
        if (btnCodex) btnCodex.click();
      }
    };
    ov.querySelector('#rh-end-title-btn').onclick = function () {
      sfxSafe('click');
      closeEndingScreen();
      var titleBtn = document.getElementById('btn-title');
      if (titleBtn) titleBtn.click();
    };

    ov.classList.remove('hidden');
    sfxSafe('grade_s');
    return ov;
  }

  /* =========================================================================
     六、统一弹窗关闭栈、换季回调与全局初始化
     ========================================================================= */
  function isVisibleEl(el) {
    return !!(el && !el.classList.contains('hidden') && el.style.display !== 'none');
  }

  function closeTopmostModal() {
    if (typeof document === 'undefined') return false;
    var order = [
      { id: 'ending-screen', close: closeEndingScreen },
      { id: 'season-report-overlay', close: closeSeasonReport },
      { id: 'schedule-overlay', close: closeSchedulePlanner },
      { id: 'shop-overlay', close: closeShopModal },
      { id: 'mailbox-overlay', close: closeMailboxModal },
      { id: 'sh-charm-popover', close: hideCharmPopover }
    ];
    for (var i = 0; i < order.length; i++) {
      var el = document.getElementById(order[i].id);
      if (isVisibleEl(el)) {
        order[i].close();
        return true;
      }
    }
    return false;
  }

  function closeAllModals() {
    if (typeof document === 'undefined') return;
    closeEndingScreen();
    closeSeasonReport();
    closeSchedulePlanner();
    closeShopModal();
    closeMailboxModal();
    hideCharmPopover();
    if (_tapResetTimer) { clearTimeout(_tapResetTimer); _tapResetTimer = null; }
    if (_bubbleHideTimer) { clearTimeout(_bubbleHideTimer); _bubbleHideTimer = null; }
    if (_customLetterActive) restoreDefaultAliceLetter();
  }

  function onSeasonAdvanced(targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return;
    // 换季自然小幅恢复悠闲度并预掷新季 NPC 分布
    adjustLeisure(10, st);
    rollSeasonChars(st, true);
    snapshotSeasonLedger(st);
    syncSylviaHub(st);
  }

  function onStateLoaded(targetS) {
    var st = ensureRaisingState(targetS);
    if (!st) return;
    if (!st.seasonLedger || st.seasonLedger.key !== seasonKeyOf(st)) {
      snapshotSeasonLedger(st);
    }
    syncSylviaHub(st);
  }

  function bindGlobalListeners() {
    if (typeof document === 'undefined' || root.__raisingHubListenersBound) return;
    root.__raisingHubListenersBound = true;

    captureDefaultLetterSnapshot();

    // 捕获阶段监听 Escape：优先收起本模块最顶层弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (closeTopmostModal()) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }
      }
    }, true);

    // 点击标题页「信笺预览」按钮前自动还原默认爱丽丝信笺，确保互不串扰
    var titleLetterBtn = document.getElementById('btn-letter-test');
    if (titleLetterBtn) {
      titleLetterBtn.addEventListener('click', function () {
        restoreDefaultAliceLetter();
      }, true);
    }

    // 信笺遮罩收起后自动还原默认爱丽丝信笺并播报延后的首读奖励提示，防止信头被遮挡或抬头残留
    var letterDemoEl = document.getElementById('letter-demo');
    if (letterDemoEl && typeof MutationObserver === 'function') {
      try {
        var letterObs = new MutationObserver(function () {
          if (_mutatingLetterWax) return;
          if (letterDemoEl.classList.contains('hidden')) {
            var hasAnyWaxClass = hasAnyLetterWaxClass(letterDemoEl);
            if (_customLetterActive || hasAnyWaxClass) {
              var prevMutating = _mutatingLetterWax;
              _mutatingLetterWax = true;
              try {
                if (_customLetterActive) {
                  restoreDefaultAliceLetter();
                } else if (hasAnyWaxClass) {
                  applyLetterWaxClass(letterDemoEl, null);
                }
                if (typeof letterObs.takeRecords === 'function') {
                  letterObs.takeRecords();
                }
              } finally {
                _mutatingLetterWax = prevMutating;
              }
            }
            flushPendingMailToast();
          }
        });
        letterObs.observe(letterDemoEl, { attributes: true, attributeFilter: ['class'] });
      } catch (e) {}
    }

    // 点击舞台空白处收起挂件说明气泡
    document.addEventListener('click', function (e) {
      var pop = document.getElementById('sh-charm-popover');
      if (pop && !pop.classList.contains('hidden')) {
        if (!e.target.closest('#sh-charm-popover') && !e.target.closest('#sh-charms') && !e.target.closest('#hud-mood')) {
          hideCharmPopover();
        }
      }
    });
  }

  function init() {
    ensureRaisingState();
    bindGlobalListeners();
    syncSylviaHub();
  }

  var API = {
    ENDINGS_STORAGE_KEY: ENDINGS_STORAGE_KEY,
    SYLVIA_TAP_LINES: SYLVIA_TAP_LINES,
    SYLVIA_DIARY_ENTRIES: SYLVIA_DIARY_ENTRIES,
    NPC_SCHEDULE_RULES: NPC_SCHEDULE_RULES,
    LOC_BG_THUMB: LOC_BG_THUMB,
    COZY_SHOP_CATALOG: COZY_SHOP_CATALOG,
    GIFT_PREFS: GIFT_PREFS,
    MAILBOX_CATALOG: MAILBOX_CATALOG,
    CAREER_CATALOG: CAREER_CATALOG,
    BOND_ENDING_CATALOG: BOND_ENDING_CATALOG,
    COMPANION_AFTERWORDS: COMPANION_AFTERWORDS,
    ensureRaisingState: ensureRaisingState,
    adjustLeisure: adjustLeisure,
    getMoodInfo: getMoodInfo,
    getSylviaStage: getSylviaStage,
    syncSylviaHub: syncSylviaHub,
    tapSylvia: tapSylvia,
    rollSeasonChars: rollSeasonChars,
    getNpcsAtLoc: getNpcsAtLoc,
    renderVisualMap: renderVisualMap,
    snapshotSeasonLedger: snapshotSeasonLedger,
    recordSeasonAction: recordSeasonAction,
    openSchedulePlanner: openSchedulePlanner,
    closeSchedulePlanner: closeSchedulePlanner,
    openSeasonReport: openSeasonReport,
    closeSeasonReport: closeSeasonReport,
    getShopPrice: getShopPrice,
    getAvailableShopItems: getAvailableShopItems,
    buyCozyItem: buyCozyItem,
    useCozyItem: useCozyItem,
    giftItemToChar: giftItemToChar,
    openShopModal: openShopModal,
    closeShopModal: closeShopModal,
    getAvailableMail: getAvailableMail,
    getUnreadMailCount: getUnreadMailCount,
    openMailboxModal: openMailboxModal,
    closeMailboxModal: closeMailboxModal,
    openMailboxLetter: openMailboxLetter,
    restoreDefaultAliceLetter: restoreDefaultAliceLetter,
    canOpenEndingForecast: canOpenEndingForecast,
    evaluateEnding: evaluateEnding,
    showEndingScreen: showEndingScreen,
    closeEndingScreen: closeEndingScreen,
    getUnlockedEndingsArchive: getUnlockedEndingsArchive,
    closeTopmostModal: closeTopmostModal,
    closeAllModals: closeAllModals,
    onSeasonAdvanced: onSeasonAdvanced,
    onStateLoaded: onStateLoaded,
    init: init
  };

  root.RaisingHub = API;
  root.openSchedulePlanner = openSchedulePlanner;
  root.openSeasonReport = openSeasonReport;
  root.openShopModal = openShopModal;
  root.openMailboxModal = openMailboxModal;
  root.showEndingScreen = showEndingScreen;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }

  if (typeof document !== 'undefined') {
    init();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
