/**
 * 《转生千金～到了异世界就要悠闲地生活》
 * 正统独立游戏桌面运行时外壳与本地存档桥接层 (js/desktop-shell.js)
 *
 * 职责：
 * 1. 抑制浏览器原生冗余交互（右键菜单、文字误选、图片幽灵拖拽、F5/缩放/打印/保存网页等快捷键）
 * 2. 统一全屏控制（F11 / Alt+Enter），在 Tauri v2 桌面端调用原生窗口全屏，浏览器端回退 Fullscreen API
 * 3. 本地文件存档桥接（DesktopShell.storage）：在 Tauri v2 `.exe` 环境下将游戏存档键透明镜像至
 *    操作系统应用数据目录 Vesteria/saves/*.json，启动时自动回灌，避免缓存清理导致丢档
 * 4. 在标题页底缘页脚与系统设置页无侵入注入极简 1px 细线桌面控制项
 * 5. 全站拦截剥离浏览器原生 title 灰框，统一转为 data-indie-tip 并由雪瓷斜切游戏内 Tooltip 渲染
 */
(function (globalScope) {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  var SAVE_KEY_PREFIXES = ['ojousama_', 'vn_', 'ves_', 'combat_', 'codex_'];
  var NON_TEXT_INPUT_TYPES = {
    range: true,
    checkbox: true,
    radio: true,
    button: true,
    submit: true,
    reset: true,
    color: true,
    file: true,
    image: true,
    hidden: true,
  };

  var state = {
    initialized: false,
    tauriFullscreen: false,
    isHydrating: false,
    hydrated: false,
    pendingWrites: Object.create(null),
    inFlightPromises: new Set(),
    activeResolution: '1280x720',
    settingsObserver: null,
    titleObserver: null,
    tooltipBound: false,
  };

  /* ==================== 1. 运行时与参数探测 ==================== */

  function getTauriInvoke() {
    try {
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        return window.__TAURI__.core.invoke;
      }
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        return window.__TAURI_INTERNALS__.invoke;
      }
    } catch (e) {}
    return null;
  }

  function isTauri() {
    return getTauriInvoke() !== null;
  }

  function invokeTauri(cmd, args) {
    var fn = getTauriInvoke();
    if (!fn) {
      return Promise.reject(new Error('tauri-runtime-unavailable'));
    }
    try {
      return Promise.resolve(fn(cmd, args || {}));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function getQueryParam(name) {
    try {
      var search = (window.location && window.location.search) || '';
      if (!search || typeof URLSearchParams === 'undefined') return '';
      return String(new URLSearchParams(search).get(name) || '');
    } catch (e) {
      return '';
    }
  }

  function isDevMode() {
    return getQueryParam('dev') === '1' || getQueryParam('debug') === '1';
  }

  function isKioskMode() {
    return isTauri() || getQueryParam('kiosk') === '1' || getQueryParam('app') === '1';
  }

  function notifyToast(msg) {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(msg);
        return;
      }
      if (typeof window.toast === 'function') {
        window.toast(msg);
        return;
      }
      var el = document.getElementById('toast');
      if (el) {
        el.textContent = String(msg || '');
        el.classList.remove('hidden');
        clearTimeout(el.__indieToastTimer);
        el.__indieToastTimer = setTimeout(function () {
          el.classList.add('hidden');
        }, 2600);
      }
    } catch (e) {}
  }

  function playUiSfx(name) {
    try {
      if (window.CrystalSFX && typeof window.CrystalSFX.play === 'function') {
        window.CrystalSFX.play(name || 'click');
      }
    } catch (e) {}
  }

  /* ==================== 2. 可编辑目标识别 ==================== */

  function isEditableElement(node) {
    if (!node || node.nodeType !== 1) return false;
    var el = node;
    while (el && el.nodeType === 1) {
      var tag = (el.tagName || '').toUpperCase();
      if (tag === 'TEXTAREA') return true;
      if (tag === 'INPUT') {
        var inputType = String(el.getAttribute('type') || 'text').toLowerCase();
        return !NON_TEXT_INPUT_TYPES[inputType];
      }
      if (el.isContentEditable) return true;
      var ce = el.getAttribute && el.getAttribute('contenteditable');
      if (ce === '' || ce === 'true') return true;
      if (el.classList && el.classList.contains('allow-select')) return true;
      el = el.parentElement;
    }
    return false;
  }

  function isEditableTarget(target) {
    if (!target) return false;
    if (target.nodeType === 3) {
      return isEditableElement(target.parentElement);
    }
    return isEditableElement(target);
  }

  /* ==================== 3. 原生独立游戏交互抑制 ==================== */

  function bindBrowserSuppression() {
    // 3a) 拦截非可编辑区域的浏览器右键菜单（隐藏“检查 / 查看源代码 / 另存为”）
    document.addEventListener('contextmenu', function (ev) {
      if (isDevMode()) return;
      if (isEditableTarget(ev.target)) return;
      ev.preventDefault();
    }, true);

    // 3b) 拦截图片、立绘、画布与界面的幽灵拖拽
    document.addEventListener('dragstart', function (ev) {
      if (isEditableTarget(ev.target)) return;
      var t = ev.target;
      var tag = t && t.tagName ? String(t.tagName).toUpperCase() : '';
      if (tag === 'IMG' || tag === 'CANVAS' || tag === 'SVG' || tag === 'A' || tag === 'BUTTON' || !isDevMode()) {
        ev.preventDefault();
      }
    }, true);

    // 3c) 拦截非可编辑区域的文字选区启动（杜绝快点字幕触发高亮与复制/全选浮条）
    document.addEventListener('selectstart', function (ev) {
      if (isDevMode()) return;
      if (isEditableTarget(ev.target)) return;
      ev.preventDefault();
    }, true);

    // 3d) 拦截浏览器缩放滚轮（仅在桌面端或 ?kiosk=1）
    window.addEventListener('wheel', function (ev) {
      if (isDevMode() || !isKioskMode()) return;
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
      }
    }, { passive: false, capture: true });

    // 3e) 键盘快捷键接管：F11 / Alt+Enter 全屏 + 桌面防误刷新/防源码/防缩放
    window.addEventListener('keydown', function (ev) {
      var key = String(ev.key || '');
      var lower = key.toLowerCase();
      var mod = !!(ev.ctrlKey || ev.metaKey);

      // F11 或 Alt+Enter 切换真全屏
      if (key === 'F11' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleFullscreen();
        return;
      }
      if (key === 'Enter' && ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
        if (!isEditableTarget(ev.target)) {
          ev.preventDefault();
          ev.stopPropagation();
          toggleFullscreen();
          return;
        }
      }

      if (isDevMode()) return;

      // 桌面端 / kiosk 模式下屏蔽会导致进度丢失或暴露浏览器行为的快捷键
      if (isKioskMode()) {
        if (key === 'F5' || key === 'F7') {
          ev.preventDefault();
          return;
        }
        if (mod && (lower === 'r' || lower === 'p' || lower === 's' || lower === 'u')) {
          ev.preventDefault();
          return;
        }
        if (mod && (key === '+' || key === '=' || key === '-' || key === '_' || key === '0')) {
          ev.preventDefault();
          return;
        }
        if (ev.altKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
          ev.preventDefault();
          return;
        }
        if (mod && lower === 'a' && !isEditableTarget(ev.target)) {
          ev.preventDefault();
          return;
        }
      }
    }, true);
  }

  /* ==================== 4. 全屏、分辨率与窗口控制 ==================== */

  function isBrowserFullscreen() {
    try {
      return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
    } catch (e) {
      return false;
    }
  }

  function isFullscreen() {
    return isTauri() ? !!state.tauriFullscreen : isBrowserFullscreen();
  }

  function syncFullscreenUi() {
    var active = isFullscreen();
    try {
      if (document.body) {
        document.body.classList.toggle('indie-fullscreen', active);
      }
      var footerBtn = document.getElementById('btn-indie-fullscreen');
      if (footerBtn) {
        footerBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        var lbl = footerBtn.querySelector('.indie-win-label');
        if (lbl) lbl.textContent = active ? '退出全屏' : '全屏切换';
      }
      var setWinBtn = document.getElementById('indie-set-mode-window');
      var setFsBtn = document.getElementById('indie-set-mode-full');
      if (setWinBtn) setWinBtn.classList.toggle('is-active', !active);
      if (setFsBtn) setFsBtn.classList.toggle('is-active', active);
    } catch (e) {}
  }

  function toggleFullscreen() {
    if (isTauri()) {
      return invokeTauri('indie_toggle_fullscreen')
        .then(function (nextState) {
          state.tauriFullscreen = !!nextState;
          syncFullscreenUi();
          return state.tauriFullscreen;
        })
        .catch(function () {
          return state.tauriFullscreen;
        });
    }

    try {
      if (isBrowserFullscreen()) {
        var exitFn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
        if (typeof exitFn === 'function') {
          return Promise.resolve(exitFn.call(document))
            .then(function () {
              syncFullscreenUi();
              return false;
            })
            .catch(function () {
              syncFullscreenUi();
              return isBrowserFullscreen();
            });
        }
      } else {
        var rootEl = document.documentElement;
        var reqFn = rootEl && (rootEl.requestFullscreen || rootEl.webkitRequestFullscreen || rootEl.mozRequestFullScreen);
        if (typeof reqFn === 'function') {
          return Promise.resolve(reqFn.call(rootEl))
            .then(function () {
              syncFullscreenUi();
              return true;
            })
            .catch(function () {
              syncFullscreenUi();
              return isBrowserFullscreen();
            });
        }
      }
    } catch (e) {}
    return Promise.resolve(false);
  }

  function setFullscreen(targetFullscreen) {
    var want = !!targetFullscreen;
    if (isFullscreen() === want) {
      syncFullscreenUi();
      return Promise.resolve(want);
    }
    return toggleFullscreen();
  }

  function setResolution(width, height) {
    var w = Math.max(1024, Math.min(7680, Math.round(Number(width) || 1280)));
    var h = Math.max(600, Math.min(4320, Math.round(Number(height) || 720)));
    state.activeResolution = w + 'x' + h;
    if (!isTauri()) {
      return Promise.resolve({ ok: false, reason: 'web-runtime', width: w, height: h });
    }
    return invokeTauri('indie_set_resolution', { width: w, height: h })
      .then(function () {
        state.tauriFullscreen = false;
        syncFullscreenUi();
        syncResolutionButtons();
        notifyToast('窗口分辨率已切换为 ' + w + '×' + h);
        return { ok: true, width: w, height: h };
      })
      .catch(function (err) {
        return { ok: false, error: String(err && err.message || err) };
      });
  }

  function exitApp() {
    if (!isTauri()) {
      notifyToast('旅途进度已妥善封存，直接关闭当前页面即可离开。');
      return Promise.resolve(false);
    }
    return storageApi.flush()
      .catch(function () {})
      .then(function () {
        return invokeTauri('indie_exit_app');
      })
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  /* ==================== 5. 本地文件存档桥接 (DesktopShell.storage) ==================== */

  function isManagedKey(key) {
    if (typeof key !== 'string' || !key) return false;
    for (var i = 0; i < SAVE_KEY_PREFIXES.length; i++) {
      if (key.indexOf(SAVE_KEY_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  var origSetItem = null;
  var origRemoveItem = null;

  function safeLocalStorage() {
    try {
      return window.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  function trackInFlight(promise) {
    state.inFlightPromises.add(promise);
    var cleanup = function () {
      state.inFlightPromises.delete(promise);
    };
    promise.then(cleanup, cleanup);
    return promise;
  }

  function mirrorWriteToDisk(key, value) {
    if (!isTauri() || !isManagedKey(key)) return Promise.resolve();
    var strKey = String(key);
    var strVal = String(value);
    var prev = state.pendingWrites[strKey] || Promise.resolve();
    var next = prev.catch(function () {}).then(function () {
      return invokeTauri('indie_write_store', { key: strKey, value: strVal });
    }).catch(function () {});
    state.pendingWrites[strKey] = next;
    return trackInFlight(next);
  }

  function mirrorDeleteFromDisk(key) {
    if (!isTauri() || !isManagedKey(key)) return Promise.resolve();
    var strKey = String(key);
    var prev = state.pendingWrites[strKey] || Promise.resolve();
    var next = prev.catch(function () {}).then(function () {
      return invokeTauri('indie_delete_store', { key: strKey });
    }).catch(function () {});
    state.pendingWrites[strKey] = next;
    return trackInFlight(next);
  }

  function installStorageMirror() {
    var ls = safeLocalStorage();
    if (!ls || typeof Storage === 'undefined' || !Storage.prototype) return;
    if (Storage.prototype.__indieDesktopPatched) return;

    origSetItem = Storage.prototype.setItem;
    origRemoveItem = Storage.prototype.removeItem;

    try {
      Storage.prototype.setItem = function (key, value) {
        var result = origSetItem.call(this, key, value);
        if (this === ls && !state.isHydrating && isManagedKey(String(key))) {
          mirrorWriteToDisk(String(key), String(value));
        }
        return result;
      };

      Storage.prototype.removeItem = function (key) {
        var result = origRemoveItem.call(this, key);
        if (this === ls && !state.isHydrating && isManagedKey(String(key))) {
          mirrorDeleteFromDisk(String(key));
        }
        return result;
      };

      Object.defineProperty(Storage.prototype, '__indieDesktopPatched', {
        value: true,
        enumerable: false,
        configurable: false,
      });
    } catch (e) {}
  }

  function writeLocalRaw(key, value) {
    var ls = safeLocalStorage();
    if (!ls) return;
    state.isHydrating = true;
    try {
      if (origSetItem) origSetItem.call(ls, key, value);
      else ls.setItem(key, value);
    } catch (e) {}
    state.isHydrating = false;
  }

  function getAllManaged() {
    var out = {};
    var ls = safeLocalStorage();
    if (!ls) return out;
    try {
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (isManagedKey(k)) {
          var v = ls.getItem(k);
          if (v !== null) out[k] = v;
        }
      }
    } catch (e) {}
    return out;
  }

  function refreshAfterHydration() {
    try {
      var contBtn = document.getElementById('btn-continue');
      if (contBtn && typeof window.hasSave === 'function' && window.hasSave()) {
        contBtn.classList.remove('hidden');
      }
      if (window.TitleDirector && typeof window.TitleDirector.refreshArchive === 'function') {
        window.TitleDirector.refreshArchive();
      }
    } catch (e) {}
  }

  function hydrate() {
    if (!isTauri()) {
      state.hydrated = true;
      return Promise.resolve({ hydrated: 0, syncedToDisk: 0, runtime: 'web' });
    }

    return invokeTauri('indie_read_all_stores')
      .then(function (diskMap) {
        var restored = 0;
        var synced = 0;
        var map = (diskMap && typeof diskMap === 'object') ? diskMap : {};
        var diskKeys = Object.keys(map);

        for (var i = 0; i < diskKeys.length; i++) {
          var k = diskKeys[i];
          if (!isManagedKey(k)) continue;
          var val = map[k];
          if (typeof val === 'string') {
            writeLocalRaw(k, val);
            restored++;
          }
        }

        // 将本地 WebView 已有但磁盘尚未落盘的受管存档补写到 Vesteria/saves/
        var localNow = getAllManaged();
        var localKeys = Object.keys(localNow);
        for (var j = 0; j < localKeys.length; j++) {
          var lk = localKeys[j];
          if (!Object.prototype.hasOwnProperty.call(map, lk)) {
            mirrorWriteToDisk(lk, localNow[lk]);
            synced++;
          }
        }

        state.hydrated = true;
        if (restored > 0) {
          refreshAfterHydration();
        }
        try {
          window.dispatchEvent(new CustomEvent('indie:saves-hydrated', {
            detail: { restored: restored, syncedToDisk: synced, runtime: 'tauri' },
          }));
        } catch (e) {}
        return { hydrated: restored, syncedToDisk: synced, runtime: 'tauri' };
      })
      .catch(function (err) {
        state.hydrated = true;
        return { hydrated: 0, syncedToDisk: 0, runtime: 'tauri', error: String(err && err.message || err) };
      });
  }

  function flush() {
    var list = [];
    state.inFlightPromises.forEach(function (p) { list.push(p); });
    return Promise.all(list).then(function () { return true; });
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function buildBackupBundle() {
    var now = new Date();
    var stamp = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate())
      + '-' + pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds());
    return {
      schema: 'vesteria-indie-save-bundle-v1',
      game: '转生千金～到了异世界就要悠闲地生活',
      exportedAt: now.toISOString(),
      runtime: isTauri() ? 'tauri' : 'web',
      filename: 'vesteria-saves-' + stamp + '.json',
      stores: getAllManaged(),
    };
  }

  function exportSavesZip() {
    var bundle = buildBackupBundle();
    var count = Object.keys(bundle.stores).length;
    try {
      var payload = JSON.stringify({
        schema: bundle.schema,
        game: bundle.game,
        exportedAt: bundle.exportedAt,
        runtime: bundle.runtime,
        stores: bundle.stores,
      }, null, 2);

      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        var blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = bundle.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
          try { document.body.removeChild(link); } catch (e) {}
          try { URL.revokeObjectURL(url); } catch (e) {}
        }, 120);
      }
      notifyToast('已导出本地存档备份（含 ' + count + ' 项记录）');
    } catch (e) {
      notifyToast('存档备份导出失败，请重试');
    }
    return bundle;
  }

  function importSavesBackup(input) {
    var parsed = input;
    if (typeof input === 'string') {
      parsed = JSON.parse(input);
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.stores || typeof parsed.stores !== 'object') {
      return { ok: false, restored: 0, reason: 'invalid-bundle' };
    }
    var restored = 0;
    var keys = Object.keys(parsed.stores);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!isManagedKey(k)) continue;
      var v = parsed.stores[k];
      if (typeof v === 'string') {
        try {
          var ls = safeLocalStorage();
          if (ls) ls.setItem(k, v);
          restored++;
        } catch (e) {}
      }
    }
    if (restored > 0) refreshAfterHydration();
    return { ok: true, restored: restored };
  }

  function openSavesFolder() {
    if (isTauri()) {
      return flush()
        .catch(function () {})
        .then(function () {
          return invokeTauri('indie_open_saves_dir');
        })
        .then(function (dirPath) {
          notifyToast('已打开本地存档目录：' + (dirPath || 'Vesteria/saves'));
          return { ok: true, path: dirPath || '' };
        })
        .catch(function (err) {
          notifyToast('无法打开本地存档目录，请检查系统权限');
          return { ok: false, error: String(err && err.message || err) };
        });
    }
    var bundle = exportSavesZip();
    return Promise.resolve({ ok: true, fallback: 'json-download', filename: bundle.filename });
  }

  var storageApi = {
    PREFIXES: SAVE_KEY_PREFIXES.slice(),
    isManagedKey: isManagedKey,
    hydrate: hydrate,
    flush: flush,
    getAllManaged: getAllManaged,
    writeStore: mirrorWriteToDisk,
    deleteStore: mirrorDeleteFromDisk,
    exportSavesZip: exportSavesZip,
    importSavesBackup: importSavesBackup,
    openSavesFolder: openSavesFolder,
  };

  /* ==================== 6. 桌面窗口控制 UI 注入 ==================== */

  function makeSvg(pathMarkup) {
    return '<span class="indie-win-glyph" aria-hidden="true">' +
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter">' +
      pathMarkup +
      '</svg></span>';
  }

  function injectTitleFooterControls() {
    if (document.getElementById('indie-win-controls')) return;
    var footerRight = document.querySelector('#title-screen .v3-edge-footer .v3-edge-right');
    if (!footerRight) return;

    var tauriMode = isTauri();
    var group = document.createElement('div');
    group.id = 'indie-win-controls';
    group.className = 'indie-win-controls';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', '桌面显示与窗口控制');

    var html = '' +
      '<button id="btn-indie-fullscreen" type="button" class="indie-win-btn" data-indie-act="fullscreen" aria-pressed="false" data-indie-tip="切换全屏显示 (F11 / Alt+Enter)">' +
        makeSvg('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>') +
        '<span class="indie-win-label">全屏切换</span>' +
        '<span class="indie-win-kbd">[F11]</span>' +
      '</button>' +
      '<span class="indie-win-sep" aria-hidden="true"></span>' +
      '<button id="btn-indie-saves" type="button" class="indie-win-btn" data-indie-act="saves" data-indie-tip="' +
        (tauriMode ? '打开本地存档文件夹 (Vesteria/saves)' : '导出本地存档备份文件 (.json)') + '">' +
        makeSvg('<path d="M2.5 3.5h4.2l1.3 1.5h5.5v7.5h-11z"/>') +
        '<span class="indie-win-label">' + (tauriMode ? '存档目录' : '存档备份') + '</span>' +
      '</button>';

    if (tauriMode) {
      html += '' +
        '<span class="indie-win-sep" aria-hidden="true"></span>' +
        '<button id="btn-indie-exit" type="button" class="indie-win-btn indie-win-btn-danger" data-indie-act="exit" data-indie-tip="保存并退出桌面版">' +
          makeSvg('<path d="M6.5 2.5h-4v11h4M9.5 5l3.5 3-3.5 3M6 8h7"/>') +
          '<span class="indie-win-label">退出游戏</span>' +
        '</button>';
    }

    group.innerHTML = html;

    var muteBtn = footerRight.querySelector('#btn-title-mute');
    if (muteBtn) {
      footerRight.insertBefore(group, muteBtn);
    } else {
      footerRight.appendChild(group);
    }

    group.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-indie-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-indie-act');
      playUiSfx('click');
      if (act === 'fullscreen') {
        toggleFullscreen();
      } else if (act === 'saves') {
        openSavesFolder();
      } else if (act === 'exit') {
        exitApp();
      }
    });

    syncFullscreenUi();
  }

  function syncResolutionButtons() {
    var btns = document.querySelectorAll('[data-indie-res]');
    for (var i = 0; i < btns.length; i++) {
      var res = btns[i].getAttribute('data-indie-res');
      btns[i].classList.toggle('is-active', !isFullscreen() && res === state.activeResolution);
    }
  }

  function injectTitleSettingsControls() {
    var generalPane = document.querySelector('#v3-view-settings .v3-set-pane[data-v3-pane="general"]');
    if (!generalPane || generalPane.querySelector('#indie-settings-section')) return;

    var tauriMode = isTauri();
    var sec = document.createElement('div');
    sec.id = 'indie-settings-section';
    sec.className = 'indie-settings-section';

    var resRow = '';
    if (tauriMode) {
      resRow = '' +
        '<div class="indie-settings-row">' +
          '<span class="indie-settings-name">窗口分辨率</span>' +
          '<div class="indie-settings-actions">' +
            '<button type="button" class="indie-action-btn" data-indie-res="1280x720">1280×720</button>' +
            '<button type="button" class="indie-action-btn" data-indie-res="1600x900">1600×900</button>' +
            '<button type="button" class="indie-action-btn" data-indie-res="1920x1080">1920×1080</button>' +
          '</div>' +
        '</div>';
    }

    var exitBtnHtml = tauriMode
      ? '<button type="button" id="indie-set-exit" class="indie-action-btn indie-action-btn-danger" data-indie-set="exit">退出游戏</button>'
      : '';

    sec.innerHTML = '' +
      '<div class="indie-settings-head">' +
        '<span class="indie-settings-label">DESKTOP / 桌面显示与存档</span>' +
        '<span class="indie-runtime-tag">' + (tauriMode ? 'TAURI NATIVE' : 'WEB EDITION') + '</span>' +
      '</div>' +
      '<div class="indie-settings-row">' +
        '<span class="indie-settings-name">画面模式</span>' +
        '<div class="indie-settings-actions">' +
          '<button type="button" id="indie-set-mode-window" class="indie-action-btn" data-indie-set="windowed">窗口模式</button>' +
          '<button type="button" id="indie-set-mode-full" class="indie-action-btn" data-indie-set="fullscreen">无边框全屏 [F11]</button>' +
        '</div>' +
      '</div>' +
      resRow +
      '<div class="indie-settings-row">' +
        '<span class="indie-settings-name">本地存档</span>' +
        '<div class="indie-settings-actions">' +
          '<button type="button" id="indie-set-saves" class="indie-action-btn" data-indie-set="saves">' +
            (tauriMode ? '打开存档文件夹' : '导出存档备份 (.json)') +
          '</button>' +
          exitBtnHtml +
        '</div>' +
      '</div>';

    generalPane.appendChild(sec);

    sec.addEventListener('click', function (ev) {
      var target = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if (!target) return;
      playUiSfx('click');

      var res = target.getAttribute('data-indie-res');
      if (res) {
        var parts = res.split('x');
        setResolution(Number(parts[0]), Number(parts[1]));
        return;
      }

      var act = target.getAttribute('data-indie-set');
      if (act === 'windowed') {
        setFullscreen(false);
      } else if (act === 'fullscreen') {
        setFullscreen(true);
      } else if (act === 'saves') {
        openSavesFolder();
      } else if (act === 'exit') {
        exitApp();
      }
    });

    syncFullscreenUi();
    syncResolutionButtons();
  }

  function observeSettingsMount() {
    injectTitleSettingsControls();
    var setView = document.getElementById('v3-view-settings');
    if (!setView || typeof MutationObserver === 'undefined' || state.settingsObserver) return;
    try {
      state.settingsObserver = new MutationObserver(function () {
        injectTitleSettingsControls();
      });
      state.settingsObserver.observe(setView, { childList: true, subtree: true });
    } catch (e) {}
  }

  /* ==================== 7. 全站零原生 title 拦截与雪瓷自定义 Tooltip ==================== */

  var TIP_ATTR = 'data-indie-tip';
  var TIP_EXEMPT_SELECTOR = '#text-box, .cb-trait-pill, .ib-info-btn, .aid-icon-btn[data-tip], [data-no-indie-tip]';
  var TIP_SHOW_DELAY_MS = 220;
  var TIP_EDGE_MARGIN = 12;
  var TIP_TARGET_GAP = 9;

  var tipState = {
    el: null,
    target: null,
    timer: null,
    visible: false,
    lastPointerDownAt: 0,
  };

  function isExemptTipEl(el) {
    if (!el || el.nodeType !== 1 || typeof el.matches !== 'function') return false;
    try {
      return el.matches(TIP_EXEMPT_SELECTOR);
    } catch (e) {
      return false;
    }
  }

  function ensureTooltipEl() {
    if (!document.body) return null;
    var el = tipState.el || document.getElementById('indie-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'indie-tooltip';
      el.className = 'indie-tooltip';
      el.setAttribute('role', 'tooltip');
      el.setAttribute('aria-hidden', 'true');
    }
    if (!document.body.contains(el)) {
      document.body.appendChild(el);
    }
    tipState.el = el;
    return el;
  }

  function clearTipTimer() {
    if (tipState.timer !== null) {
      clearTimeout(tipState.timer);
      tipState.timer = null;
    }
  }

  function hideTooltip() {
    clearTipTimer();
    tipState.target = null;
    tipState.visible = false;
    var el = tipState.el || document.getElementById('indie-tooltip');
    if (el) {
      el.classList.remove('is-visible');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function isTipTargetVisible(el) {
    if (!el || !document.body || !document.body.contains(el)) return false;
    if (el.hidden) return false;
    var cur = el;
    while (cur && cur.nodeType === 1) {
      if (cur.classList && cur.classList.contains('hidden')) return false;
      if (typeof window.getComputedStyle === 'function') {
        try {
          var cs = window.getComputedStyle(cur);
          if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')) {
            return false;
          }
        } catch (e) {}
      }
      if (cur === document.body) break;
      cur = cur.parentElement;
    }
    if (typeof el.getBoundingClientRect === 'function' && typeof document.body.getBoundingClientRect === 'function') {
      try {
        var bodyRect = document.body.getBoundingClientRect();
        if (bodyRect && bodyRect.height > 0) {
          var r = el.getBoundingClientRect();
          if (r && r.width === 0 && r.height === 0) return false;
        }
      } catch (e) {}
    }
    return true;
  }

  function positionTooltip(targetEl, tipEl) {
    if (!targetEl || !tipEl || typeof targetEl.getBoundingClientRect !== 'function') return;
    var rect = targetEl.getBoundingClientRect();
    var vw = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1280;
    var vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 720;

    // 临时复位至左上原点，避免贴近右边界导致折行宽度测量偏差
    tipEl.style.left = '0px';
    tipEl.style.top = '0px';
    var tipRect = typeof tipEl.getBoundingClientRect === 'function' ? tipEl.getBoundingClientRect() : { width: 0, height: 0 };
    var tipW = tipEl.offsetWidth || Math.ceil(tipRect.width) || 0;
    var tipH = tipEl.offsetHeight || Math.ceil(tipRect.height) || 0;

    var rawLeft = rect.left + (rect.width - tipW) / 2;
    var maxLeft = Math.max(TIP_EDGE_MARGIN, vw - tipW - TIP_EDGE_MARGIN);
    var left = Math.min(Math.max(rawLeft, TIP_EDGE_MARGIN), maxLeft);

    var topAbove = rect.top - tipH - TIP_TARGET_GAP;
    var topBelow = rect.bottom + TIP_TARGET_GAP;
    var placement = 'top';
    var top = topAbove;

    if (topAbove < TIP_EDGE_MARGIN) {
      if (topBelow + tipH <= vh - TIP_EDGE_MARGIN || (vh - rect.bottom) >= rect.top) {
        placement = 'bottom';
        top = topBelow;
      }
    }

    var maxTop = Math.max(TIP_EDGE_MARGIN, vh - tipH - TIP_EDGE_MARGIN);
    top = Math.min(Math.max(top, TIP_EDGE_MARGIN), maxTop);

    tipEl.setAttribute('data-placement', placement);
    tipEl.style.left = Math.round(left) + 'px';
    tipEl.style.top = Math.round(top) + 'px';
  }

  function showTooltipFor(targetEl) {
    if (!targetEl || isExemptTipEl(targetEl) || !isTipTargetVisible(targetEl)) {
      hideTooltip();
      return;
    }
    var text = String(targetEl.getAttribute(TIP_ATTR) || '').trim();
    if (!text) {
      hideTooltip();
      return;
    }
    var tipEl = ensureTooltipEl();
    if (!tipEl) return;

    tipEl.textContent = text;
    positionTooltip(targetEl, tipEl);
    tipState.target = targetEl;
    tipState.visible = true;
    tipEl.setAttribute('aria-hidden', 'false');
    tipEl.classList.add('is-visible');
  }

  function scheduleTooltip(targetEl) {
    if (!targetEl || isExemptTipEl(targetEl)) {
      hideTooltip();
      return;
    }
    if (tipState.target === targetEl && (tipState.visible || tipState.timer !== null)) {
      return;
    }
    clearTipTimer();
    if (tipState.visible && tipState.target !== targetEl && tipState.el) {
      tipState.el.classList.remove('is-visible');
      tipState.el.setAttribute('aria-hidden', 'true');
      tipState.visible = false;
    }
    tipState.target = targetEl;
    tipState.timer = setTimeout(function () {
      tipState.timer = null;
      if (tipState.target !== targetEl) return;
      showTooltipFor(targetEl);
    }, TIP_SHOW_DELAY_MS);
  }

  function harvestTitleAttr(el) {
    if (!el || el.nodeType !== 1 || typeof el.hasAttribute !== 'function') return false;
    if (!el.hasAttribute('title')) return false;

    var raw = el.getAttribute('title');
    var text = raw == null ? '' : String(raw).trim();
    try {
      el.removeAttribute('title');
    } catch (e) {}

    if (isExemptTipEl(el)) {
      if (tipState.target === el) hideTooltip();
      return true;
    }

    if (text) {
      try {
        el.setAttribute(TIP_ATTR, text);
      } catch (e) {}
      if (tipState.target === el && tipState.visible && tipState.el) {
        tipState.el.textContent = text;
        positionTooltip(el, tipState.el);
      }
    } else {
      try {
        el.removeAttribute(TIP_ATTR);
      } catch (e) {}
      if (tipState.target === el) hideTooltip();
    }
    return true;
  }

  function harvestTitlesInTree(root) {
    if (!root) return 0;
    var count = 0;
    if (root.nodeType === 1) {
      if (harvestTitleAttr(root)) count++;
      if (!root.firstElementChild) return count;
    }
    if (typeof root.querySelectorAll === 'function') {
      try {
        var nodes = root.querySelectorAll('[title]');
        for (var i = 0; i < nodes.length; i++) {
          if (harvestTitleAttr(nodes[i])) count++;
        }
      } catch (e) {}
    }
    return count;
  }

  function findTipTarget(node) {
    if (!node) return null;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || typeof el.closest !== 'function') return null;
    // 防御：同步脚本刚写入 title 且 MutationObserver 微任务尚未冲刷时当场收割
    var rawTitleHost = el.closest('[title]');
    if (rawTitleHost) {
      harvestTitleAttr(rawTitleHost);
    }
    var host = el.closest('[' + TIP_ATTR + ']');
    if (!host || isExemptTipEl(host)) return null;
    var text = String(host.getAttribute(TIP_ATTR) || '').trim();
    if (!text) return null;
    return host;
  }

  function installTitleHarvester() {
    harvestTitlesInTree(document);
    if (state.titleObserver || typeof MutationObserver === 'undefined') return;
    var observeRoot = document.documentElement || document.body;
    if (!observeRoot) return;
    try {
      state.titleObserver = new MutationObserver(function (mutations) {
        var activeRemoved = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'attributes' && m.attributeName === 'title') {
            harvestTitleAttr(m.target);
          } else if (m.type === 'childList') {
            if (m.addedNodes && m.addedNodes.length) {
              for (var j = 0; j < m.addedNodes.length; j++) {
                var added = m.addedNodes[j];
                if (added && (added.nodeType === 1 || added.nodeType === 11)) {
                  harvestTitlesInTree(added);
                }
              }
            }
            if (tipState.target && !activeRemoved && m.removedNodes && m.removedNodes.length) {
              if (!document.body || !document.body.contains(tipState.target)) {
                activeRemoved = true;
              }
            }
          }
        }
        if (activeRemoved) {
          hideTooltip();
        }
      });
      state.titleObserver.observe(observeRoot, {
        attributes: true,
        attributeFilter: ['title'],
        childList: true,
        subtree: true,
      });
    } catch (e) {}
  }

  function bindTooltipEvents() {
    ensureTooltipEl();
    if (state.tooltipBound) return;
    state.tooltipBound = true;

    document.addEventListener('pointerover', function (ev) {
      if (ev && ev.pointerType === 'touch') return;
      var host = findTipTarget(ev && ev.target);
      if (host) {
        scheduleTooltip(host);
      } else if (tipState.target && (!ev.target || !tipState.target.contains(ev.target))) {
        hideTooltip();
      }
    }, false);

    document.addEventListener('pointerout', function (ev) {
      if (!tipState.target) return;
      var related = ev && ev.relatedTarget;
      if (related && tipState.target.contains(related)) return;
      hideTooltip();
    }, false);

    document.addEventListener('focusin', function (ev) {
      if (Date.now() - tipState.lastPointerDownAt < 350) return;
      var host = findTipTarget(ev && ev.target);
      if (host) {
        scheduleTooltip(host);
      } else {
        hideTooltip();
      }
    }, true);

    document.addEventListener('focusout', function (ev) {
      if (!tipState.target) return;
      var related = ev && ev.relatedTarget;
      if (related && tipState.target.contains(related)) return;
      hideTooltip();
    }, true);

    document.addEventListener('pointerdown', function () {
      tipState.lastPointerDownAt = Date.now();
      hideTooltip();
    }, true);

    document.addEventListener('click', hideTooltip, true);

    document.addEventListener('scroll', hideTooltip, { capture: true, passive: true });
    window.addEventListener('wheel', hideTooltip, { capture: true, passive: true });

    document.addEventListener('keydown', function (ev) {
      if (ev && ev.key === 'Escape') {
        hideTooltip();
      }
    }, true);

    window.addEventListener('blur', hideTooltip);
    window.addEventListener('resize', hideTooltip);
    window.addEventListener('pagehide', hideTooltip);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) hideTooltip();
    });
  }

  /* ==================== 8. 启动初始化 ==================== */

  function onDomReady() {
    try {
      document.documentElement.setAttribute('data-indie-runtime', isTauri() ? 'tauri' : 'web');
      if (document.body) {
        document.body.classList.add('indie-desktop-ready');
        if (isTauri()) document.body.classList.add('indie-tauri');
      }
    } catch (e) {}

    injectTitleFooterControls();
    observeSettingsMount();
    installTitleHarvester();
    bindTooltipEvents();
    syncFullscreenUi();
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    installStorageMirror();
    bindBrowserSuppression();
    installTitleHarvester();

    document.addEventListener('fullscreenchange', syncFullscreenUi);
    document.addEventListener('webkitfullscreenchange', syncFullscreenUi);
    window.addEventListener('beforeunload', function () {
      if (isTauri()) storageApi.flush();
    });

    if (isTauri()) {
      hydrate();
    } else {
      state.hydrated = true;
    }

    if (document.body) {
      onDomReady();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
    }
  }

  var DesktopShell = {
    version: '1.0.0',
    isTauri: isTauri,
    isDevMode: isDevMode,
    isKioskMode: isKioskMode,
    isFullscreen: isFullscreen,
    toggleFullscreen: toggleFullscreen,
    setFullscreen: setFullscreen,
    setResolution: setResolution,
    exitApp: exitApp,
    openSavesFolder: openSavesFolder,
    exportSavesZip: exportSavesZip,
    importSavesBackup: importSavesBackup,
    hideTooltip: hideTooltip,
    storage: storageApi,
    refreshControls: function () {
      injectTitleFooterControls();
      injectTitleSettingsControls();
      harvestTitlesInTree(document);
      syncFullscreenUi();
    },
  };

  globalScope.DesktopShell = DesktopShell;
  init();
})(typeof window !== 'undefined' ? window : globalThis);
