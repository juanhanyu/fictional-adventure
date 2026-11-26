/* =========================================================
   转生千金 · 智能空闲后台资源预加载器 (AssetPreloader)
   - 零外部依赖、零侵扰、零 JSDOM/Node 副作用
   - 自动扫描样式表 .bg-img-* 映射（自动兼容 .jpg / .webp）
   - 空闲分批预取 + 异步图片解码预热（切场景/立绘/CG 零白闪）
   ========================================================= */
(function (global) {
  'use strict';

  var MAX_CONCURRENT = 2;
  var MAX_LRU_CACHE = 48;
  var IDLE_TIMEOUT_MS = 1200;
  var FALLBACK_DELAY_MS = 120;
  var MIN_IDLE_REMAINING_MS = 8;
  var MAX_BATCH_PER_IDLE = 2;
  var TITLE_WARMUP_DELAY_MS = 800;

  var STAGE_BACKDROP_CLASS = {
    hulan_beast_tide: 'bg-img-ice-canyon',
    aino_sparring: 'bg-img-ice-classroom',
    rowan_graveyard: 'bg-img-night',
    north_forest_hunt: 'bg-img-north-forest',
    turning_point_corridor: 'bg-img-hallway',
    wind_god_eye: 'bg-img-training',
  };

  function isNonBrowserOrJsdom() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return true;
    try {
      if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
        return true;
      }
    } catch (e) {
      return true;
    }
    return false;
  }

  function createNoopApi(reason) {
    var noopApi = {
      enqueue: function () { return 0; },
      prefetchScene: function () { return 0; },
      prefetchNeighbors: function () { return 0; },
      prefetchTitleWarmup: function () { return 0; },
      getStats: function () {
        return {
          disabled: true,
          reason: reason || 'non-browser-or-jsdom',
          saveData: false,
          maxConcurrent: MAX_CONCURRENT,
          maxCache: MAX_LRU_CACHE,
          queued: 0,
          highQueued: 0,
          lowQueued: 0,
          inFlight: 0,
          seen: 0,
          started: 0,
          loaded: 0,
          decoded: 0,
          failed: 0,
          cached: 0,
          bgMapSize: 0,
          hooksInstalled: {
            runScene: false,
            runSceneQueue: false,
            vnUxOnSceneStart: false,
            enterFreeRoam: false,
            enterLoc: false,
            combatStartStage: false,
            combatStartBattle: false,
          },
        };
      },
      reset: function () {},
    };
    return noopApi;
  }

  // ===== 1. 环境守卫：Node / JSDOM 直接导出安全空壳（零定时器、零请求、零包装） =====
  if (isNonBrowserOrJsdom()) {
    var noop = createNoopApi('non-browser-or-jsdom');
    if (typeof window !== 'undefined') window.AssetPreloader = noop;
    if (global && global !== (typeof window !== 'undefined' ? window : null)) {
      global.AssetPreloader = noop;
    }
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = noop;
    }
    return;
  }

  // ===== 内部状态 =====
  var seenUrls = new Set();
  var highQueue = [];
  var lowQueue = [];
  var lruCache = new Map();
  var bgClassMap = new Map();

  var inFlight = 0;
  var scheduled = false;
  var idleHandle = null;
  var idleHandleKind = null;
  var titleWarmupTimer = null;
  var titleWarmupIdleHandle = null;
  var titleWarmupIdleKind = null;
  var titleWarmupScheduled = false;
  var epoch = 0;

  var lastPrefetchedSceneId = null;
  var lastPrefetchedSceneTs = 0;

  var stats = {
    started: 0,
    loaded: 0,
    decoded: 0,
    failed: 0,
  };

  var hooks = {
    runScene: false,
    runSceneQueue: false,
    vnUxOnSceneStart: false,
    enterFreeRoam: false,
    enterLoc: false,
    combatStartStage: false,
    combatStartBattle: false,
  };

  // ===== 环境与全局符号安全读取 =====
  function isSaveDataEnabled() {
    try {
      var conn = navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
      return !!(conn && conn.saveData);
    } catch (e) {
      return false;
    }
  }

  function readGlobal(key, lexicalFallback) {
    try {
      if (window[key] !== undefined) return window[key];
    } catch (e) {}
    try {
      if (typeof lexicalFallback === 'function') return lexicalFallback();
    } catch (e) {}
    return undefined;
  }

  function getScenes() {
    return readGlobal('SCENES', function () {
      return typeof SCENES !== 'undefined' ? SCENES : null;
    });
  }

  function getStoryChapters() {
    return readGlobal('STORY_CHAPTERS', function () {
      return typeof STORY_CHAPTERS !== 'undefined' ? STORY_CHAPTERS : null;
    });
  }

  function getLocs() {
    return readGlobal('LOCS', function () {
      if (typeof LOCS !== 'undefined') return LOCS;
      return window.__LOCS || null;
    });
  }

  function getExits() {
    return readGlobal('EXITS', function () {
      return typeof EXITS !== 'undefined' ? EXITS : null;
    });
  }

  function getState() {
    return readGlobal('S', function () {
      return typeof S !== 'undefined' ? S : null;
    });
  }

  function getPortraitFiles() {
    return readGlobal('PORTRAIT_FILES', function () {
      return typeof PORTRAIT_FILES !== 'undefined' ? PORTRAIT_FILES : null;
    });
  }

  function getCgFallbackBg() {
    return readGlobal('CG_FALLBACK_BG', function () {
      return typeof CG_FALLBACK_BG !== 'undefined' ? CG_FALLBACK_BG : null;
    });
  }

  function getFailedPortraitUrls() {
    return readGlobal('FAILED_PORTRAIT_URLS', function () {
      return typeof FAILED_PORTRAIT_URLS !== 'undefined' ? FAILED_PORTRAIT_URLS : null;
    });
  }

  function getResolvePortraitFn() {
    return readGlobal('resolvePortrait', function () {
      return typeof resolvePortrait === 'function' ? resolvePortrait : null;
    });
  }

  // ===== URL 规范化与去重键 =====
  function normalizeEntry(raw, baseHref) {
    if (typeof raw !== 'string') return null;
    var url = raw.trim();
    if (!url) return null;
    if ((url[0] === '"' && url[url.length - 1] === '"') || (url[0] === '\'' && url[url.length - 1] === '\'')) {
      url = url.slice(1, -1).trim();
    }
    if (!url) return null;
    var lower = url.toLowerCase();
    if (
      lower === 'none' ||
      lower === 'end' ||
      lower.indexOf('data:') === 0 ||
      lower.indexOf('blob:') === 0 ||
      lower.indexOf('javascript:') === 0 ||
      lower.indexOf('about:') === 0 ||
      lower.indexOf('linear-gradient') === 0 ||
      lower.indexOf('radial-gradient') === 0
    ) {
      return null;
    }

    var fetchUrl = url;
    if (baseHref && url.indexOf('../') === 0) {
      try {
        fetchUrl = new URL(url, baseHref).href;
      } catch (e) {}
    }

    var dedupKey = fetchUrl.replace(/^\.\//, '');
    try {
      var refBase = baseHref || document.baseURI || (window.location && window.location.href) || '';
      if (refBase && refBase !== 'about:blank') {
        dedupKey = new URL(fetchUrl, refBase).href;
      }
    } catch (e) {}

    return { url: fetchUrl, key: dedupKey };
  }

  // ===== 有界 LRU 解码缓存（最多 48 张） =====
  function putLru(key, img) {
    if (lruCache.has(key)) lruCache.delete(key);
    lruCache.set(key, img);
    while (lruCache.size > MAX_LRU_CACHE) {
      var oldest = lruCache.keys().next().value;
      if (oldest === undefined) break;
      lruCache.delete(oldest);
    }
  }

  function touchLru(key) {
    if (!lruCache.has(key)) return;
    var img = lruCache.get(key);
    lruCache.delete(key);
    lruCache.set(key, img);
  }

  // ===== 2. 轻量并发调度引擎 =====
  function hasQueued() {
    return highQueue.length > 0 || lowQueue.length > 0;
  }

  function dequeueNext() {
    if (highQueue.length > 0) return highQueue.shift();
    if (lowQueue.length > 0) return lowQueue.shift();
    return null;
  }

  function cancelScheduledPump() {
    if (!scheduled) return;
    scheduled = false;
    if (idleHandle !== null) {
      try {
        if (idleHandleKind === 'ric' && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleHandle);
        } else if (idleHandleKind === 'timer') {
          window.clearTimeout(idleHandle);
        }
      } catch (e) {}
    }
    idleHandle = null;
    idleHandleKind = null;
  }

  function dispatchOne(item) {
    if (typeof window.Image !== 'function') return;
    var curEpoch = epoch;
    inFlight++;
    stats.started++;

    var img = new window.Image();
    img.decoding = 'async';
    img.loading = 'eager';

    var settled = false;
    var finish = function (ok) {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;
      if (curEpoch !== epoch) return;

      inFlight = Math.max(0, inFlight - 1);
      if (ok) {
        stats.loaded++;
        putLru(item.key, img);
        if (typeof img.decode === 'function') {
          try {
            var dec = img.decode();
            if (dec && typeof dec.then === 'function') {
              dec.then(function () {
                if (curEpoch === epoch) stats.decoded++;
              }).catch(function () {});
            }
          } catch (e) {}
        }
      } else {
        stats.failed++;
      }

      if (hasQueued() && inFlight < MAX_CONCURRENT) {
        schedulePump();
      }
    };

    img.onload = function () { finish(true); };
    img.onerror = function () { finish(false); };
    try {
      img.src = item.url;
    } catch (e) {
      finish(false);
      return;
    }
    if (img.complete && img.naturalWidth > 0) {
      finish(true);
    }
  }

  function readTimeRemaining(deadline) {
    if (!deadline || typeof deadline.timeRemaining !== 'function') return 0;
    try {
      return Number(deadline.timeRemaining()) || 0;
    } catch (e) {
      return 0;
    }
  }

  function runIdleWork(deadline) {
    scheduled = false;
    idleHandle = null;
    idleHandleKind = null;

    if (!hasQueued() || inFlight >= MAX_CONCURRENT) return;

    var dispatched = 0;
    var remaining = readTimeRemaining(deadline);
    var didTimeout = !!(deadline && deadline.didTimeout);

    if (remaining > MIN_IDLE_REMAINING_MS) {
      while (dispatched < MAX_BATCH_PER_IDLE && inFlight < MAX_CONCURRENT && hasQueued()) {
        if (dispatched > 0 && readTimeRemaining(deadline) <= MIN_IDLE_REMAINING_MS) break;
        var item = dequeueNext();
        if (!item) break;
        dispatchOne(item);
        dispatched++;
      }
    } else if (didTimeout) {
      // 动画持续占用主线程触发 timeout(1200ms) 时温和放行 1 张，防止预热饿死
      var fallbackItem = dequeueNext();
      if (fallbackItem) {
        dispatchOne(fallbackItem);
        dispatched++;
      }
    }

    if (hasQueued() && inFlight < MAX_CONCURRENT) {
      schedulePump();
    }
  }

  function schedulePump() {
    if (scheduled || !hasQueued() || inFlight >= MAX_CONCURRENT) return;
    scheduled = true;
    if (typeof window.requestIdleCallback === 'function') {
      idleHandleKind = 'ric';
      idleHandle = window.requestIdleCallback(runIdleWork, { timeout: IDLE_TIMEOUT_MS });
    } else {
      idleHandleKind = 'timer';
      idleHandle = window.setTimeout(function () {
        runIdleWork({
          didTimeout: false,
          timeRemaining: function () { return 16; },
        });
      }, FALLBACK_DELAY_MS);
    }
  }

  function enqueue(urls, priority) {
    if (!urls) return 0;
    var list = Array.isArray(urls) ? urls : [urls];
    var prio = 'low';
    if (typeof priority === 'string') {
      prio = priority === 'high' ? 'high' : 'low';
    } else if (priority && typeof priority === 'object' && priority.priority === 'high') {
      prio = 'high';
    }

    var added = 0;
    for (var i = 0; i < list.length; i++) {
      var entry = normalizeEntry(list[i]);
      if (!entry) continue;

      if (seenUrls.has(entry.key)) {
        // 若仍在低优队列中等待且被高优请求命中，提升至高优队列
        var wasPromoted = false;
        if (prio === 'high') {
          for (var j = 0; j < lowQueue.length; j++) {
            if (lowQueue[j].key === entry.key) {
              var promoted = lowQueue.splice(j, 1)[0];
              highQueue.push(promoted);
              added++;
              wasPromoted = true;
              break;
            }
          }
        }
        if (!wasPromoted) touchLru(entry.key);
        continue;
      }

      seenUrls.add(entry.key);
      if (prio === 'high') highQueue.push(entry);
      else lowQueue.push(entry);
      added++;
    }

    if (added > 0 && inFlight < MAX_CONCURRENT) {
      schedulePump();
    }
    return added;
  }

  // ===== 3. 自动扫描样式表 .bg-img-* → URL 映射（兼容 .jpg / .webp） =====
  function extractUrlFromBgCss(cssValue, baseHref) {
    if (!cssValue || typeof cssValue !== 'string' || cssValue === 'none') return null;
    var re = /url\(\s*(?:(["'])([^"']+)\1|([^)"'\s]+))\s*\)/gi;
    var m;
    while ((m = re.exec(cssValue)) !== null) {
      var raw = m[2] || m[3] || '';
      var norm = normalizeEntry(raw, baseHref);
      if (norm) return norm.url;
    }
    return null;
  }

  function scanRuleList(rules, baseHref, depth) {
    if (!rules || depth > 6) return;
    var len = 0;
    try {
      len = rules.length || 0;
    } catch (e) {
      return;
    }
    var clsRe = /\.(bg-img-[a-zA-Z0-9_-]+|bg-title)(?![a-zA-Z0-9_-])/g;
    for (var i = 0; i < len; i++) {
      var rule = rules[i];
      if (!rule) continue;
      if (rule.selectorText && rule.style) {
        var bgVal = '';
        try {
          bgVal =
            rule.style.backgroundImage ||
            (typeof rule.style.getPropertyValue === 'function' ? rule.style.getPropertyValue('background-image') : '') ||
            rule.style.background ||
            '';
        } catch (e) {
          bgVal = '';
        }
        if (bgVal && bgVal.indexOf('url(') !== -1) {
          var foundUrl = extractUrlFromBgCss(bgVal, baseHref);
          if (foundUrl) {
            clsRe.lastIndex = 0;
            var cm;
            while ((cm = clsRe.exec(rule.selectorText)) !== null) {
              bgClassMap.set(cm[1], foundUrl);
            }
          }
        }
      }
      if (rule.cssRules) {
        try {
          scanRuleList(rule.cssRules, baseHref, depth + 1);
        } catch (e) {}
      }
    }
  }

  function scanStylesheets() {
    var sheets = document && document.styleSheets;
    if (!sheets) return bgClassMap.size;
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      if (!sheet) continue;
      var rules = null;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        // 跨域 stylesheet 自动跳过
        continue;
      }
      if (rules) {
        scanRuleList(rules, sheet.href || '', 0);
      }
    }
    return bgClassMap.size;
  }

  function ensureBgMap() {
    if (bgClassMap.size === 0) scanStylesheets();
  }

  function resolveBgUrls(bgSpec) {
    if (!bgSpec || typeof bgSpec !== 'string') return [];
    ensureBgMap();
    var out = [];
    var trimmed = bgSpec.trim();
    if (!trimmed) return out;

    if (trimmed.indexOf('url(') !== -1) {
      var fromCss = extractUrlFromBgCss(trimmed);
      if (fromCss) out.push(fromCss);
      return out;
    }

    if (/^(?:https?:|\/|assets\/)/i.test(trimmed) || /\.(?:webp|jpg|jpeg|png|avif)(?:\?.*)?$/i.test(trimmed)) {
      out.push(trimmed);
      return out;
    }

    var tokens = trimmed.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var cls = tokens[i].replace(/^\./, '');
      if (!cls) continue;
      var mapped = bgClassMap.get(cls);
      if (mapped && out.indexOf(mapped) === -1) {
        out.push(mapped);
      }
    }
    return out;
  }

  function resolveCgUrl(cgName) {
    if (!cgName || typeof cgName !== 'string') return null;
    var trimmed = cgName.trim();
    if (!trimmed || trimmed === 'end' || trimmed === 'none') return null;
    var fallbackMap = getCgFallbackBg();
    if (fallbackMap && fallbackMap[trimmed]) return fallbackMap[trimmed];
    if (/^(?:https?:|\/|assets\/)/i.test(trimmed)) return trimmed;
    return 'assets/cg/' + trimmed;
  }

  function resolvePortraitUrl(charId, emo) {
    if (!charId || typeof charId !== 'string') return null;
    var emotion = emo || 'normal';
    var failedSet = getFailedPortraitUrls();
    var url = null;

    var resolver = getResolvePortraitFn();
    var resolvedByFn = false;
    if (typeof resolver === 'function') {
      try {
        url = resolver(charId, emotion);
        resolvedByFn = true;
      } catch (e) {
        url = null;
        resolvedByFn = false;
      }
    }

    if (!resolvedByFn) {
      var files = getPortraitFiles();
      if (files && typeof files === 'object') {
        url =
          files[charId + '_' + emotion] ||
          files[charId + '_normal'] ||
          files[charId + '_child_' + emotion] ||
          files[charId + '_child_normal'] ||
          files[charId + '_young_' + emotion] ||
          files[charId + '_young_normal'] ||
          files[charId + '_teenage_' + emotion] ||
          files[charId + '_teenage_normal'] ||
          files[charId + '_child'] ||
          null;
      }
    }

    if (url && failedSet && typeof failedSet.has === 'function' && failedSet.has(url)) {
      return null;
    }
    return url;
  }

  function resolveCombatBgUrls(stageId) {
    var out = [];
    var ce = window.CombatEngine;
    var sc = ce && ce.STAGES && stageId ? ce.STAGES[stageId] : null;
    if (sc && sc.bg) {
      var fromStageBg = resolveBgUrls(sc.bg);
      for (var i = 0; i < fromStageBg.length; i++) {
        if (out.indexOf(fromStageBg[i]) === -1) out.push(fromStageBg[i]);
      }
    }
    if (sc && sc.bgUrl) {
      if (out.indexOf(sc.bgUrl) === -1) out.push(sc.bgUrl);
    }
    var backdropCls = (stageId && STAGE_BACKDROP_CLASS[stageId]) || 'bg-img-training';
    var fromBackdrop = resolveBgUrls(backdropCls);
    for (var j = 0; j < fromBackdrop.length; j++) {
      if (out.indexOf(fromBackdrop[j]) === -1) out.push(fromBackdrop[j]);
    }
    return out;
  }

  function pushUnique(arr, url) {
    if (url && arr.indexOf(url) === -1) arr.push(url);
  }

  function pushAllUnique(arr, list) {
    if (!Array.isArray(list)) return;
    for (var i = 0; i < list.length; i++) {
      pushUnique(arr, list[i]);
    }
  }

  function collectPortraitsFromLine(line, targetUrls, seenCharPairs) {
    if (!line || typeof line !== 'object') return 0;
    var added = 0;
    var addOne = function (cid, emo) {
      if (!cid || typeof cid !== 'string') return;
      var pairKey = cid + ':' + (emo || 'normal');
      if (seenCharPairs && seenCharPairs.has(pairKey)) return;
      if (seenCharPairs) seenCharPairs.add(pairKey);
      var pUrl = resolvePortraitUrl(cid, emo || 'normal');
      if (pUrl && targetUrls.indexOf(pUrl) === -1) {
        targetUrls.push(pUrl);
        added++;
      }
    };

    if (Array.isArray(line.portraits)) {
      for (var i = 0; i < line.portraits.length; i++) {
        var p = line.portraits[i];
        if (!p) continue;
        if (typeof p === 'string') addOne(p, 'normal');
        else if (typeof p === 'object' && p.id) addOne(p.id, p.emo || 'normal');
      }
    }
    if (line.ch) {
      addOne(line.ch, line.emo || 'normal');
    }
    return added;
  }

  function extractSceneUrls(sc, opts) {
    opts = opts || {};
    var urls = [];
    if (!sc || typeof sc !== 'object') return urls;

    var portraitLineLimit = typeof opts.portraitLineLimit === 'number' ? opts.portraitLineLimit : 20;
    var scanAllLinesForBgCg = opts.scanAllLinesForBgCg !== false;
    var maxLinesBgCg = typeof opts.maxLinesBgCg === 'number' ? opts.maxLinesBgCg : 0;
    var minFallbackPortraits = typeof opts.minFallbackPortraits === 'number' ? opts.minFallbackPortraits : 0;

    if (sc.bg) pushAllUnique(urls, resolveBgUrls(sc.bg));

    var lines = Array.isArray(sc.lines) ? sc.lines : [];
    var seenPairs = new Set();
    var portraitCount = 0;
    var bgCgLimit = scanAllLinesForBgCg ? lines.length : Math.min(lines.length, maxLinesBgCg || portraitLineLimit);

    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (!L || typeof L !== 'object') continue;

      if (i < bgCgLimit) {
        if (L.bg) pushAllUnique(urls, resolveBgUrls(L.bg));
        if (L.cg && L.cg !== 'end') pushUnique(urls, resolveCgUrl(L.cg));
        if (L.battle && L.battle.stageId && scanAllLinesForBgCg) {
          pushAllUnique(urls, resolveCombatBgUrls(L.battle.stageId));
        }
      }

      if (i < portraitLineLimit) {
        portraitCount += collectPortraitsFromLine(L, urls, seenPairs);
      } else if (minFallbackPortraits > 0 && portraitCount < minFallbackPortraits && i < 80) {
        portraitCount += collectPortraitsFromLine(L, urls, seenPairs);
      }

      if (i >= bgCgLimit && i >= portraitLineLimit && (minFallbackPortraits === 0 || portraitCount >= minFallbackPortraits || i >= 80)) {
        break;
      }
    }

    return urls;
  }

  // ===== 公开预取方法 =====
  function prefetchTitleWarmup() {
    ensureBgMap();
    var scenes = getScenes();
    var sc = scenes && scenes.s_start;
    if (!sc) return 0;

    var saveData = isSaveDataEnabled();
    var urls = [];
    if (sc.bg) pushAllUnique(urls, resolveBgUrls(sc.bg));

    var lines = Array.isArray(sc.lines) ? sc.lines : [];
    var maxBgExtra = saveData ? 0 : 2;
    var maxPortraits = saveData ? 2 : 4;
    var bgExtra = 0;
    var portraitCount = 0;
    var seenPairs = new Set();

    for (var i = 0; i < lines.length && i < 120; i++) {
      var L = lines[i];
      if (!L || typeof L !== 'object') continue;
      if (bgExtra < maxBgExtra && L.bg) {
        var bUrls = resolveBgUrls(L.bg);
        for (var j = 0; j < bUrls.length; j++) {
          if (urls.indexOf(bUrls[j]) === -1) {
            urls.push(bUrls[j]);
            bgExtra++;
            if (bgExtra >= maxBgExtra) break;
          }
        }
      }
      if (!saveData && i < 20 && L.cg && L.cg !== 'end') {
        pushUnique(urls, resolveCgUrl(L.cg));
      }
      if (portraitCount < maxPortraits) {
        portraitCount += collectPortraitsFromLine(L, urls, seenPairs);
      }
      if (bgExtra >= maxBgExtra && portraitCount >= maxPortraits) break;
    }

    return enqueue(urls, 'low');
  }

  function findNextChapterId(sceneId, currentSc) {
    var chaps = getStoryChapters();
    if (Array.isArray(chaps)) {
      for (var i = 0; i < chaps.length; i++) {
        if (chaps[i] && chaps[i].id === sceneId) {
          var next = chaps[i + 1];
          return next && next.id ? next.id : null;
        }
      }
    }
    // 非主线章节时，如末段存在显式 goto，亦可温和衔接
    var lines = currentSc && Array.isArray(currentSc.lines) ? currentSc.lines : null;
    if (lines && lines.length > 0) {
      for (var k = lines.length - 1; k >= Math.max(0, lines.length - 5); k--) {
        if (lines[k] && typeof lines[k].goto === 'string' && lines[k].goto) {
          return lines[k].goto;
        }
      }
    }
    return null;
  }

  function prefetchScene(sceneId, opts) {
    opts = opts || {};
    ensureBgMap();
    var scenes = getScenes();
    var sc = typeof sceneId === 'string' ? (scenes && scenes[sceneId]) : sceneId;
    var id = typeof sceneId === 'string' ? sceneId : null;
    if (!sc || typeof sc !== 'object') return 0;

    var saveData = isSaveDataEnabled();
    var curUrls = extractSceneUrls(sc, {
      portraitLineLimit: saveData ? 10 : 20,
      scanAllLinesForBgCg: !saveData,
      maxLinesBgCg: saveData ? 20 : 0,
      minFallbackPortraits: saveData ? 0 : 3,
    });

    var count = enqueue(curUrls, opts.priority || 'high');

    // 非省流模式：查 STORY_CHAPTERS 找到下一章，低优先级预取首幕背景与前 10 句立绘/CG
    if (!saveData && opts.includeNext !== false && id) {
      var nextId = findNextChapterId(id, sc);
      var nextSc = nextId && scenes ? scenes[nextId] : null;
      if (nextSc) {
        var nextUrls = extractSceneUrls(nextSc, {
          portraitLineLimit: 10,
          scanAllLinesForBgCg: false,
          maxLinesBgCg: 10,
          minFallbackPortraits: 0,
        });
        count += enqueue(nextUrls, 'low');
      }
    }

    return count;
  }

  function isExitReachableReadOnly(ex, state, locsMap) {
    if (!ex || !ex.to) return false;
    var L = locsMap && locsMap[ex.to];
    if (!L) return false;
    if (state && typeof state === 'object') {
      var ageY = typeof state.ageY === 'number' ? state.ageY : null;
      if (ageY !== null) {
        if (ex.needAge != null && ageY < ex.needAge) return false;
        if (ageY < 1 && !ex.babyFuss && !ex.allowInfant) return false;
      }
      if (ex.needPhase && state.phase && state.phase !== ex.needPhase) return false;
      if (ex.needFlag) {
        var hasFlag = false;
        if (state.flags && state.flags[ex.needFlag]) hasFlag = true;
        else if (typeof window.flag === 'function') {
          try { hasFlag = !!window.flag(ex.needFlag); } catch (e) {}
        }
        if (!hasFlag) return false;
      }
      if (L.area && typeof window.phaseAreaAllowed === 'function') {
        try {
          if (!window.phaseAreaAllowed(L.area)) return false;
        } catch (e) {}
      }
      if (L.unlock === false && ageY !== null) {
        var autoUnlock = (ex.needAge != null && ageY >= ex.needAge) || (ex.needAge == null && ageY >= 1);
        if (!autoUnlock) return false;
      }
    }
    return true;
  }

  function getNpcsAtLocReadOnly(locId, state) {
    if (!locId) return [];
    var res = [];
    if (state && state.seasonChars && state.season != null) {
      var seasonMap = state.seasonChars[state.season];
      if (seasonMap && typeof seasonMap === 'object') {
        var keys = Object.keys(seasonMap);
        if (keys.length > 0) {
          for (var i = 0; i < keys.length; i++) {
            var cid = keys[i];
            if (seasonMap[cid] !== locId) continue;
            if (cid === 'helena') continue;
            if (state.phase === 'academy' && cid === 'aino' && state.flags && state.flags.ch_ice_melt_1) continue;
            if ((state.phase === 'journey' || state.phase === 'finale') && (cid === 'ji' || cid === 'jilan') && state.flags && state.flags.ch_distant_wind_1) continue;
            if (res.indexOf(cid) === -1) res.push(cid);
          }
          return res;
        }
      }
    }
    // 仅当 RaisingHub 已就绪且无 seasonChars 缓存时兜底读取
    if (window.RaisingHub && typeof window.RaisingHub.getNpcsAtLoc === 'function') {
      try {
        var list = window.RaisingHub.getNpcsAtLoc(locId, state);
        if (Array.isArray(list)) return list.slice(0, 4);
      } catch (e) {}
    }
    return res;
  }

  function prefetchNeighbors(locId) {
    if (isSaveDataEnabled()) return 0;
    ensureBgMap();
    var state = getState();
    var curLoc = locId || (state && state.loc) || null;
    if (!curLoc) return 0;

    var exitsMap = getExits();
    var locsMap = getLocs();
    var rawExits = exitsMap && Array.isArray(exitsMap[curLoc]) ? exitsMap[curLoc].slice() : [];

    // 婴儿在育婴室的特殊「闹着要出去」热点目标
    if (curLoc === 'nursery' && state && typeof state.ageY === 'number' && state.ageY < 1) {
      rawExits.push({ to: 'parlor', babyFuss: true }, { to: 'hallway', babyFuss: true });
    }

    var neighborIds = [];
    for (var i = 0; i < rawExits.length; i++) {
      var ex = rawExits[i];
      if (!isExitReachableReadOnly(ex, state, locsMap)) continue;
      if (neighborIds.indexOf(ex.to) === -1) neighborIds.push(ex.to);
    }

    var urls = [];
    for (var j = 0; j < neighborIds.length; j++) {
      var nid = neighborIds[j];
      var locObj = locsMap && locsMap[nid];
      if (locObj && locObj.bg) {
        pushAllUnique(urls, resolveBgUrls(locObj.bg));
      }
      var npcs = getNpcsAtLocReadOnly(nid, state);
      for (var k = 0; k < npcs.length; k++) {
        pushUnique(urls, resolvePortraitUrl(npcs[k], 'normal'));
      }
    }

    return enqueue(urls, 'low');
  }

  function prefetchCombatStage(stageId, opts) {
    if (opts && opts.headless) return 0;
    ensureBgMap();
    var urls = resolveCombatBgUrls(stageId);
    return enqueue(urls, 'high');
  }

  // ===== 非侵入式幂等挂载三大钩子 =====
  function onSceneTriggered(sceneId) {
    if (!sceneId || typeof sceneId !== 'string') return;
    var now = Date.now();
    if (lastPrefetchedSceneId === sceneId && now - lastPrefetchedSceneTs < 80) return;
    lastPrefetchedSceneId = sceneId;
    lastPrefetchedSceneTs = now;
    try {
      prefetchScene(sceneId);
    } catch (e) {}
  }

  function installHooks() {
    // 钩子 2：window.runScene（与剧情链 runSceneQueue / VNUx.onSceneStart）
    if (!hooks.runScene && typeof window.runScene === 'function' && !window.runScene.__assetPreloaderWrapped) {
      var origRunScene = window.runScene;
      var wrappedRunScene = function (id) {
        var ret = origRunScene.apply(this, arguments);
        onSceneTriggered(id);
        return ret;
      };
      wrappedRunScene.__assetPreloaderWrapped = true;
      wrappedRunScene.__assetPreloaderOrig = origRunScene;
      window.runScene = wrappedRunScene;
      hooks.runScene = true;
    }

    if (!hooks.runSceneQueue && typeof window.runSceneQueue === 'function' && !window.runSceneQueue.__assetPreloaderWrapped) {
      var origRunSceneQueue = window.runSceneQueue;
      var wrappedRunSceneQueue = function (queue, idx) {
        var ret = origRunSceneQueue.apply(this, arguments);
        try {
          if (Array.isArray(queue) && queue.length) {
            var start = Math.max(0, Math.min(idx || 0, queue.length - 1));
            onSceneTriggered(queue[start]);
            if (!isSaveDataEnabled() && queue[start + 1]) {
              prefetchScene(queue[start + 1], { priority: 'low', includeNext: false });
            }
          }
        } catch (e) {}
        return ret;
      };
      wrappedRunSceneQueue.__assetPreloaderWrapped = true;
      wrappedRunSceneQueue.__assetPreloaderOrig = origRunSceneQueue;
      window.runSceneQueue = wrappedRunSceneQueue;
      hooks.runSceneQueue = true;
    }

    if (!hooks.vnUxOnSceneStart && window.VNUx && typeof window.VNUx.onSceneStart === 'function' && !window.VNUx.onSceneStart.__assetPreloaderWrapped) {
      var origOnSceneStart = window.VNUx.onSceneStart;
      var wrappedOnSceneStart = function (id) {
        var ret = origOnSceneStart.apply(this, arguments);
        onSceneTriggered(id);
        return ret;
      };
      wrappedOnSceneStart.__assetPreloaderWrapped = true;
      wrappedOnSceneStart.__assetPreloaderOrig = origOnSceneStart;
      window.VNUx.onSceneStart = wrappedOnSceneStart;
      hooks.vnUxOnSceneStart = true;
    }

    // 钩子 3a：自由探索 window.enterFreeRoam / window.enterLoc
    if (!hooks.enterFreeRoam && typeof window.enterFreeRoam === 'function' && !window.enterFreeRoam.__assetPreloaderWrapped) {
      var origEnterFreeRoam = window.enterFreeRoam;
      var wrappedEnterFreeRoam = function () {
        var ret = origEnterFreeRoam.apply(this, arguments);
        try {
          var st = getState();
          if (!st || st.freeRoam !== false) {
            prefetchNeighbors(st && st.loc);
          }
        } catch (e) {}
        return ret;
      };
      wrappedEnterFreeRoam.__assetPreloaderWrapped = true;
      wrappedEnterFreeRoam.__assetPreloaderOrig = origEnterFreeRoam;
      window.enterFreeRoam = wrappedEnterFreeRoam;
      hooks.enterFreeRoam = true;
    }

    if (!hooks.enterLoc && typeof window.enterLoc === 'function' && !window.enterLoc.__assetPreloaderWrapped) {
      var origEnterLoc = window.enterLoc;
      var wrappedEnterLoc = function (id) {
        var ret = origEnterLoc.apply(this, arguments);
        try {
          var st = getState();
          prefetchNeighbors((st && st.loc) || id);
        } catch (e) {}
        return ret;
      };
      wrappedEnterLoc.__assetPreloaderWrapped = true;
      wrappedEnterLoc.__assetPreloaderOrig = origEnterLoc;
      window.enterLoc = wrappedEnterLoc;
      hooks.enterLoc = true;
    }

    // 钩子 3b：战斗 CombatEngine.startStage / startBattle
    if (!hooks.combatStartStage && window.CombatEngine && typeof window.CombatEngine.startStage === 'function' && !window.CombatEngine.startStage.__assetPreloaderWrapped) {
      var origStartStage = window.CombatEngine.startStage;
      var wrappedStartStage = function (stageId, opts) {
        try {
          prefetchCombatStage(stageId, opts);
        } catch (e) {}
        return origStartStage.apply(this, arguments);
      };
      wrappedStartStage.__assetPreloaderWrapped = true;
      wrappedStartStage.__assetPreloaderOrig = origStartStage;
      window.CombatEngine.startStage = wrappedStartStage;
      hooks.combatStartStage = true;
    }

    if (!hooks.combatStartBattle && window.CombatEngine && typeof window.CombatEngine.startBattle === 'function' && !window.CombatEngine.startBattle.__assetPreloaderWrapped) {
      var origStartBattle = window.CombatEngine.startBattle;
      var wrappedStartBattle = function (cfg) {
        try {
          if (cfg && cfg.stageId) {
            prefetchCombatStage(cfg.stageId, cfg);
          }
        } catch (e) {}
        return origStartBattle.apply(this, arguments);
      };
      wrappedStartBattle.__assetPreloaderWrapped = true;
      wrappedStartBattle.__assetPreloaderOrig = origStartBattle;
      window.CombatEngine.startBattle = wrappedStartBattle;
      if (window.startBattle === origStartBattle) {
        window.startBattle = wrappedStartBattle;
      }
      hooks.combatStartBattle = true;
    }
  }

  // 钩子 1：主界面空闲预热（+800ms 空闲后静默预热序章首屏）
  function scheduleTitleWarmup() {
    if (titleWarmupScheduled) return;
    titleWarmupScheduled = true;
    var bootEpoch = epoch;
    titleWarmupTimer = window.setTimeout(function () {
      titleWarmupTimer = null;
      if (bootEpoch !== epoch) return;
      var runWarmup = function () {
        titleWarmupIdleHandle = null;
        titleWarmupIdleKind = null;
        if (bootEpoch !== epoch) return;
        try {
          scanStylesheets();
          installHooks();
          prefetchTitleWarmup();
        } catch (e) {}
      };
      if (typeof window.requestIdleCallback === 'function') {
        titleWarmupIdleKind = 'ric';
        titleWarmupIdleHandle = window.requestIdleCallback(runWarmup, { timeout: IDLE_TIMEOUT_MS });
      } else {
        titleWarmupIdleKind = 'timer';
        titleWarmupIdleHandle = window.setTimeout(runWarmup, FALLBACK_DELAY_MS);
      }
    }, TITLE_WARMUP_DELAY_MS);
  }

  function bootstrap() {
    try { scanStylesheets(); } catch (e) {}
    try { installHooks(); } catch (e) {}
    scheduleTitleWarmup();
  }

  function getStats() {
    return {
      disabled: false,
      saveData: isSaveDataEnabled(),
      maxConcurrent: MAX_CONCURRENT,
      maxCache: MAX_LRU_CACHE,
      queued: highQueue.length + lowQueue.length,
      highQueued: highQueue.length,
      lowQueued: lowQueue.length,
      inFlight: inFlight,
      seen: seenUrls.size,
      started: stats.started,
      loaded: stats.loaded,
      decoded: stats.decoded,
      failed: stats.failed,
      cached: lruCache.size,
      bgMapSize: bgClassMap.size,
      hooksInstalled: {
        runScene: hooks.runScene,
        runSceneQueue: hooks.runSceneQueue,
        vnUxOnSceneStart: hooks.vnUxOnSceneStart,
        enterFreeRoam: hooks.enterFreeRoam,
        enterLoc: hooks.enterLoc,
        combatStartStage: hooks.combatStartStage,
        combatStartBattle: hooks.combatStartBattle,
      },
    };
  }

  function reset() {
    epoch++;
    cancelScheduledPump();
    if (titleWarmupTimer !== null) {
      try { window.clearTimeout(titleWarmupTimer); } catch (e) {}
      titleWarmupTimer = null;
    }
    if (titleWarmupIdleHandle !== null) {
      try {
        if (titleWarmupIdleKind === 'ric' && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(titleWarmupIdleHandle);
        } else if (titleWarmupIdleKind === 'timer') {
          window.clearTimeout(titleWarmupIdleHandle);
        }
      } catch (e) {}
      titleWarmupIdleHandle = null;
      titleWarmupIdleKind = null;
    }
    highQueue.length = 0;
    lowQueue.length = 0;
    seenUrls.clear();
    lruCache.clear();
    inFlight = 0;
    lastPrefetchedSceneId = null;
    lastPrefetchedSceneTs = 0;
    stats.started = 0;
    stats.loaded = 0;
    stats.decoded = 0;
    stats.failed = 0;
  }

  // ===== 4. 公开 API 导出 =====
  var api = {
    enqueue: enqueue,
    prefetchScene: prefetchScene,
    prefetchNeighbors: prefetchNeighbors,
    prefetchTitleWarmup: prefetchTitleWarmup,
    getStats: getStats,
    reset: reset,
  };

  window.AssetPreloader = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  // 在 DOMContentLoaded / load 后自动幂等挂载（不修改 game.js）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
  if (document.readyState !== 'complete') {
    window.addEventListener('load', function () {
      try { scanStylesheets(); } catch (e) {}
      try { installHooks(); } catch (e) {}
    }, { once: true });
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
