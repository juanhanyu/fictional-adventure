/* =========================================================================
   转生千金 · 商业级 Galgame 基础体验组件 (js/vn-ux.js)
   包含：
   1. 对话历史回看（Backlog，支持 L 键 / HUD / 对话框入口，至多 200 条，含破图优雅降级）
   2. 6 槽位手动存档 / 读档系统 + 自动存档镜像（兼容旧 4 槽格式升级、防误删两段确认）
   3. 章节速览与快速重温 / 快捷试玩跳转（覆盖第一至第三卷与间章）
   4. 阅读控制栏（Auto / Skip 未读急刹 / 独立音量、明度与打字机速度设置）
   5. 五合一「典藏图鉴馆」（CG 画廊 + 全屏鉴赏 / BGM 音乐室 / 成就墙 / 信物手札 / 终幕典藏）
   6. 全站统一顶层 Escape 分层调度与遮罩状态探测 (isAnyBlockingOverlayOpen)
   ========================================================================= */
(function (root) {
  'use strict';

  var MAX_BACKLOG = 200;
  var MANUAL_SLOTS_KEY = 'ojousama_manual_slots_v1';
  var AUTO_META_KEY = 'ojousama_auto_meta_v1';
  var UNLOCKED_CHAPTERS_KEY = 'ojousama_unlocked_chapters_v1';
  var VN_PREFS_KEY = 'ojousama_vn_prefs_v1';
  var READ_LINES_KEY = 'ojousama_read_lines_v1';
  var CG_UNLOCKED_KEY = 'ojousama_cg_unlocked_v1';
  var CODEX_ARCHIVE_KEY = 'ojousama_codex_archive_v1';
  var ENDINGS_UNLOCKED_KEY = 'ojousama_endings_unlocked_v1';
  var SETTINGS_KEY = 'ojousama_settings_v1';

  var vnInitialized = false;
  var backlogList = [];
  var backlogSeq = 0;

  var DEFAULT_PREFS = {
    autoSpeed: 1800,
    typeSpeed: 'normal',
    bgmVol: 0.5,
    sfxVol: 0.65,
    voiceVol: 0.90,
    voiceEnabled: true,
    voiceAutoWait: true,
    fxEnabled: true,
    bright: 1
  };
  var vnPrefs = null;
  var readLinesSet = null;
  var autoMode = false;
  var skipMode = false;
  var autoTimer = null;
  var skipTimer = null;
  var autoVoiceWaitGen = 0;
  var inExternalAudioSync = false;
  var currentLineMeta = null;

  var pendingDeleteSlotId = null;
  var pendingDeleteTimer = null;
  var lastSfxPingAt = 0;

  var codexCurrentTab = 'cg';
  var codexPlayingTrack = null;
  var codexAuditionDirty = false;
  var preCodexBgmSnapshot = null;
  var codexExpandedMemento = null;
  var codexExpandedEnding = null;

  var lightboxUnlockedList = [];
  var lightboxIndex = -1;

  /* ---------- 精工矢量图标库（彻底取代原生 Emoji 字符） ---------- */
  var UI_SVG = {
    scroll: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="2.8" width="11" height="12.4" rx="1.6"/><line x1="6.2" y1="6.4" x2="11.8" y2="6.4"/><line x1="6.2" y1="9.2" x2="11.8" y2="9.2"/><line x1="6.2" y1="12" x2="9.6" y2="12"/></svg>',
    save: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.8 3h8.4L14.8 5.6V15H3.8V3z"/><path d="M6 3v4h5.4V3"/><rect x="6" y="10.2" width="5.8" height="4.8"/></svg>',
    bookmark: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h8v12l-4-2.8L5 15V3z"/></svg>',
    book: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.8 4C2.8 3.3 3.4 2.8 4 2.8H9v12.4H4a1.2 1.2 0 01-1.2-1.2V4z"/><path d="M15.2 4c0-.7-.6-1.2-1.2-1.2H9v12.4h5a1.2 1.2 0 001.2-1.2V4z"/></svg>',
    bolt: '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="10.2,2 4.5,10 9,10 7.8,16 13.5,8 9,8"/></svg>',
    folder: '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.6 5.2A1.4 1.4 0 014 3.8h3.4l1.4 1.6H14a1.4 1.4 0 011.4 1.4v6.6a1.4 1.4 0 01-1.4 1.4H4a1.4 1.4 0 01-1.4-1.4V5.2z"/></svg>',
    lock: '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8.2" width="10" height="7" rx="1.4"/><path d="M6.2 8.2V6a2.8 2.8 0 015.6 0v2.2"/></svg>',
    film: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.6" y="4" width="12.8" height="10" rx="1.4"/><path d="M6 4v10M12 4v10M2.6 7.4h3.4M12 7.4h3.4M2.6 10.6h3.4M12 10.6h3.4"/></svg>',
    chat: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.2h12v8H7.2L4 14.8v-2.6H3v-8z"/></svg>',
    snowflake: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="9" y1="2.2" x2="9" y2="15.8"/><line x1="3.1" y1="5.6" x2="14.9" y2="12.4"/><line x1="14.9" y1="5.6" x2="3.1" y2="12.4"/><path d="M7.3 3.9L9 5.5l1.7-1.6M7.3 14.1L9 12.5l1.7 1.6"/></svg>',
    letter: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.6" y="4.2" width="12.8" height="9.6" rx="1.4"/><path d="M3 5l6 4.8L15 5"/></svg>',
    tea: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.4h8.2v4.1a3.2 3.2 0 01-3.2 3.2H6.7a3.2 3.2 0 01-3.2-3.2V7.4z"/><path d="M11.7 8.2h1.6a1.8 1.8 0 010 3.6h-1.6"/><path d="M6.2 4.8c0-.8.8-1 .8-1.8M9 4.8c0-.8.8-1 .8-1.8"/></svg>',
    document: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.2 2.8h6.6L14 6v9.2H4.2V2.8z"/><path d="M10.6 2.8V6H14"/><line x1="6.4" y1="9" x2="11.6" y2="9"/><line x1="6.4" y1="11.8" x2="10.4" y2="11.8"/></svg>',
    sword: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.8 3.2l1 1-7.4 7.4-2.2.6.6-2.2 8-6.8z"/><path d="M4.6 10.6l2.8 2.8M3.4 14.6l1.8-1.8"/></svg>',
    shell: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14.8c-3.8 0-6.2-2.6-6.2-5.8a6.2 6.2 0 0112.4 0c0 3.2-2.4 5.8-6.2 5.8z"/><path d="M9 14.8V3.2M9 14.8L5.2 4.8M9 14.8l3.8-10"/></svg>',
    sliders: '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="5" x2="15" y2="5"/><circle cx="7" cy="5" r="1.7" fill="currentColor"/><line x1="3" y1="9" x2="15" y2="9"/><circle cx="11.5" cy="9" r="1.7" fill="currentColor"/><line x1="3" y1="13" x2="15" y2="13"/><circle cx="6.2" cy="13" r="1.7" fill="currentColor"/></svg>',
    star: '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="9,2.2 11,7 15.8,9 11,11 9,15.8 7,11 2.2,9 7,7"/></svg>',
    crown: '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13.6L4.2 6l3.4 3.2L9 4.5l1.4 4.7L13.8 6 15 13.6H3z"/><line x1="3.4" y1="15.4" x2="14.6" y2="15.4"/></svg>',
    compass: '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="6.4"/><polygon points="11.8,6.2 10.2,10.2 6.2,11.8 7.8,7.8"/></svg>',
    play: '<svg viewBox="0 0 14 14" width="11" height="11" fill="currentColor" aria-hidden="true"><polygon points="3.6,2.2 11.6,7 3.6,11.8"/></svg>',
    stop: '<svg viewBox="0 0 14 14" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.2"/></svg>',
    voice: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3,7.2 6.6,7.2 10.2,4.2 10.2,13.8 6.6,10.8 3,10.8"/><path d="M12.6 6.4a3.6 3.6 0 010 5.2M14.7 4.4a6.4 6.4 0 010 9.2"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    chevronUp: '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3.5,8.8 7,5.2 10.5,8.8"/></svg>',
    chevronDown: '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3.5,5.2 7,8.8 10.5,5.2"/></svg>'
  };

  function getSvg(name) {
    return UI_SVG[name] || UI_SVG.star;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function playSfx(type) {
    var fn = (root && typeof root.sfx === 'function')
      ? root.sfx
      : (typeof sfx === 'function' ? sfx : null);
    if (fn) {
      try { fn(type); } catch (e) {}
    }
  }

  function playSfxAuditionPing() {
    var now = Date.now();
    if (now - lastSfxPingAt < 160) return;
    lastSfxPingAt = now;
    playSfx('glass_tap');
  }

  function getS() {
    if (typeof S !== 'undefined' && S) return S;
    return root && root.S ? root.S : null;
  }

  function getCurrentSceneId() {
    if (typeof currentScene !== 'undefined' && currentScene) return currentScene;
    if (root && typeof root.__getCurrentScene === 'function') {
      try { return root.__getCurrentScene() || null; } catch (e) {}
    }
    return null;
  }

  function getLocName(st) {
    if (!st || !st.loc) return '未知地点';
    var locs = typeof LOCS !== 'undefined' ? LOCS : (root.__LOCS || {});
    return (locs[st.loc] && locs[st.loc].name) || st.loc;
  }

  function getDateLabel(st) {
    var liveS = getS();
    if ((!st || st === liveS) && typeof dateStr === 'function') {
      try { return dateStr(); } catch (e) {}
    }
    if (!st) return '';
    var sns = ['春', '夏', '秋', '冬'];
    return (st.year || 0) + '年 · ' + (sns[st.season || 0] || '春');
  }

  function getPhaseLabel(st) {
    var map = { prologue: '序章', childhood: '童年', youth: '少女期', academy: '学院篇', journey: '旅途篇', finale: '终章' };
    if (st && st.phase) return map[st.phase] || String(st.phase);
    if (typeof phaseName === 'function') {
      try { return phaseName(); } catch (e) {}
    }
    return '';
  }

  function getAgeLabel(st) {
    if (st && typeof st.ageY === 'number') {
      return st.ageY <= 0 ? (st.ageD || 0) + '天' : st.ageY + '岁';
    }
    if (typeof ageStr === 'function') {
      try { return ageStr(); } catch (e) {}
    }
    if (!st) return '0岁';
    return (st.ageY || 0) <= 0 ? (st.ageD || 0) + '天' : st.ageY + '岁';
  }

  function getChapterTitleForState(st, scId) {
    var chaps = typeof STORY_CHAPTERS !== 'undefined' ? STORY_CHAPTERS : (root.__STORY_CHAPTERS || []);
    var cid = scId || (st && st === getS() ? getCurrentSceneId() : null);
    if (cid) {
      var found = chaps.find(function (c) { return c && c.id === cid; });
      if (found) return (found.vol ? found.vol + ' · ' : '') + (found.title || found.t || cid);
      var scenes = typeof SCENES !== 'undefined' ? SCENES : (root.SCENES || {});
      if (scenes[cid] && scenes[cid].card) {
        return (scenes[cid].card.vol || '') + ' · ' + (scenes[cid].card.s || scenes[cid].card.t || cid);
      }
      return cid;
    }
    return '自由探索 · ' + getLocName(st);
  }

  function formatTimestamp(ts) {
    var d = new Date(ts || Date.now());
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return null; }
  }

  function showToast(msg) {
    var fn = (root && typeof root.toast === 'function') ? root.toast : (typeof toast === 'function' ? toast : null);
    if (fn) {
      try { fn(msg); } catch (e) {}
    }
  }

  function hideElementById(id) {
    if (typeof document === 'undefined' || !id) return false;
    var el = document.getElementById(id);
    if (!el) return false;
    if (typeof show === 'function') {
      try { show(id, 0); } catch (e) { el.classList.add('hidden'); }
    } else {
      el.classList.add('hidden');
    }
    return true;
  }

  /* =========================================================================
     一、对话历史回看（Backlog）
     ========================================================================= */
  function recordLine(entry, optText) {
    if (optText !== undefined || typeof entry === 'string' || entry == null) {
      entry = { speaker: entry || '', text: optText == null ? '' : String(optText) };
    }
    if (!entry) return false;
    var rawText = String(entry.text || '').trim();
    if (!rawText || rawText === '◇') return false;
    var st = getS();
    var spk = entry.speaker ? String(entry.speaker).trim() : '';
    var kind = entry.kind || 'line';
    var last = backlogList.length ? backlogList[backlogList.length - 1] : null;
    if (last && last.text === rawText && last.speaker === spk && last.kind === kind) {
      if (entry.voiceId && !last.voiceId) last.voiceId = String(entry.voiceId);
      return false;
    }
    backlogSeq += 1;
    backlogList.push({
      seq: backlogSeq,
      kind: kind,
      speaker: spk,
      charId: entry.charId || null,
      voiceId: entry.voiceId ? String(entry.voiceId) : null,
      text: rawText,
      locName: getLocName(st),
      dateStr: getDateLabel(st)
    });
    if (backlogList.length > MAX_BACKLOG) {
      backlogList.splice(0, backlogList.length - MAX_BACKLOG);
    }
    if (kind === 'cg') {
      captureCurrentCgUnlock();
    }
    if (kind !== 'choice') {
      handleLineRecorded(entry.sceneId || getCurrentSceneId() || 'roam', rawText);
    }
    return true;
  }

  function recordChoice(choiceText) {
    if (skipMode) setSkipMode(false);
    var clean = String(choiceText || '').replace(/<[^>]+>/g, '').trim();
    if (!clean) return false;
    return recordLine({
      kind: 'choice',
      speaker: '抉择',
      text: '▸ ' + clean
    });
  }

  function clearBacklog() {
    backlogList = [];
    backlogSeq = 0;
    currentLineMeta = null;
    setAutoMode(false);
    setSkipMode(false);
  }

  function getBacklog() {
    return backlogList.slice();
  }

  function setBacklog(arr) {
    if (!Array.isArray(arr)) {
      clearBacklog();
      return;
    }
    backlogList = arr.slice(-MAX_BACKLOG).map(function (it, idx) {
      return {
        seq: it.seq || idx + 1,
        kind: it.kind || 'line',
        speaker: it.speaker || '',
        charId: it.charId || null,
        voiceId: it.voiceId ? String(it.voiceId) : null,
        text: String(it.text || ''),
        locName: it.locName || '',
        dateStr: it.dateStr || ''
      };
    });
    backlogSeq = backlogList.length ? backlogList[backlogList.length - 1].seq : 0;
  }

  function createBacklogFallbackSpan(speaker, kind) {
    var span = document.createElement('span');
    span.className = 'vb-av-ph';
    var spk = String(speaker || '').trim();
    if (spk && kind !== 'choice' && kind !== 'cg') {
      span.classList.add('vb-av-mono');
      span.textContent = spk.charAt(0);
    } else {
      span.innerHTML = kind === 'choice' ? getSvg('star') : kind === 'cg' ? getSvg('film') : spk ? getSvg('chat') : getSvg('snowflake');
    }
    return span;
  }

  function closeBacklogModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-backlog-modal');
    if (ov && !ov.classList.contains('hidden')) {
      ov.classList.add('hidden');
      playSfx('modal_close');
    }
    resumeAutoIfActive();
  }

  function openBacklogModal() {
    if (typeof document === 'undefined') return null;
    var ov = document.getElementById('vn-backlog-modal');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'vn-backlog-modal';
      ov.className = 'overlay hidden';
      document.body.appendChild(ov);
    }
    var wasHidden = ov.classList.contains('hidden');
    var failedSet = (root && root.FAILED_PORTRAIT_URLS) || (typeof FAILED_PORTRAIT_URLS !== 'undefined' ? FAILED_PORTRAIT_URLS : null);
    var resolveFn = (root && typeof root.resolvePortrait === 'function')
      ? root.resolvePortrait
      : (typeof resolvePortrait === 'function' ? resolvePortrait : null);
    var ve = root && root.VoiceEngine;

    var rowsHtml = backlogList.length
      ? backlogList.map(function (item) {
          var portraitSrc = '';
          if (item.charId && resolveFn) {
            try { portraitSrc = resolveFn(item.charId, 'normal') || ''; } catch (e) {}
          }
          if (portraitSrc && failedSet && typeof failedSet.has === 'function' && failedSet.has(portraitSrc)) {
            portraitSrc = '';
          }
          var phIcon = item.kind === 'choice'
            ? getSvg('star')
            : item.kind === 'cg'
              ? getSvg('film')
              : item.speaker
                ? getSvg('chat')
                : getSvg('snowflake');
          var avatarHtml = portraitSrc
            ? '<img class="vb-av" src="' + escapeHtml(portraitSrc) + '" data-char-id="' + escapeHtml(item.charId || '') + '" data-speaker="' + escapeHtml(item.speaker || '') + '" data-kind="' + escapeHtml(item.kind || 'line') + '" alt=""/>'
            : '<span class="vb-av-ph">' + phIcon + '</span>';
          var hasEntryVoice = !!(item.voiceId && ve && typeof ve.hasVoice === 'function' && ve.hasVoice(item.voiceId));
          var isEntryPlaying = !!(hasEntryVoice && typeof ve.getCurrentVoiceId === 'function' && ve.getCurrentVoiceId() === item.voiceId);
          var voiceBtnHtml = hasEntryVoice
            ? '<button type="button" class="vb-voice-btn' + (isEntryPlaying ? ' is-playing' : '') + '" data-vb-voice="' + escapeHtml(item.voiceId) + '" data-vb-char="' + escapeHtml(item.charId || '') + '" title="重听此句语音" aria-label="重听此句语音">' + getSvg('voice') + '<span>重听</span></button>'
            : '';
          return (
            '<div class="vb-row kind-' + escapeHtml(item.kind) + '">' +
              '<div class="vb-left">' + avatarHtml + '</div>' +
              '<div class="vb-main">' +
                '<div class="vb-meta">' +
                  '<span class="vb-spk">' + escapeHtml(item.speaker || '旁白') + '</span>' +
                  '<span class="vb-meta-right">' +
                    voiceBtnHtml +
                    '<span class="vb-ctx">' + escapeHtml([item.dateStr, item.locName].filter(Boolean).join(' · ')) + '</span>' +
                  '</span>' +
                '</div>' +
                '<div class="vb-text">' + escapeHtml(item.text).replace(/\n/g, '<br>') + '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('')
      : '<p class="vb-empty">尚未记录对白。开启剧情或与角色交谈后，过往台词与抉择都会留在这里供随时翻阅。</p>';

    ov.innerHTML =
      '<div class="end-card vn-modal-card">' +
        '<div class="vn-modal-head">' +
          '<div class="vn-modal-head-copy">' +
            '<h2><span class="vn-head-ico" aria-hidden="true">' + getSvg('scroll') + '</span><span>对话回看 · Backlog</span></h2>' +
            '<p class="vn-modal-sub">共保留最近 ' + backlogList.length + ' / ' + MAX_BACKLOG + ' 条对白、心声与选项抉择（快捷键 L）</p>' +
          '</div>' +
          '<button type="button" class="modal-close-x" id="vb-close" aria-label="关闭对话回看">×</button>' +
        '</div>' +
        '<div class="vn-modal-scroll" id="vb-scroll">' + rowsHtml + '</div>' +
      '</div>';

    var fbFn = (root && typeof root.resolvePortraitFallback === 'function')
      ? root.resolvePortraitFallback
      : (typeof resolvePortraitFallback === 'function' ? resolvePortraitFallback : null);

    ov.querySelectorAll('.vb-av').forEach(function (img) {
      img.onerror = function () {
        var failedSrc = img.getAttribute('src') || '';
        if (failedSrc && failedSet && typeof failedSet.add === 'function') {
          failedSet.add(failedSrc);
        }
        var charId = img.getAttribute('data-char-id') || '';
        if (charId && fbFn && !img.getAttribute('data-fb-tried')) {
          img.setAttribute('data-fb-tried', '1');
          var nextSrc = '';
          try { nextSrc = fbFn(charId, 'normal') || ''; } catch (e) {}
          if (nextSrc && nextSrc !== failedSrc && !(failedSet && failedSet.has && failedSet.has(nextSrc))) {
            img.src = nextSrc;
            return;
          }
        }
        var sp = createBacklogFallbackSpan(img.getAttribute('data-speaker'), img.getAttribute('data-kind'));
        if (img.parentNode) img.parentNode.replaceChild(sp, img);
      };
    });

    ov.querySelectorAll('.vb-voice-btn').forEach(function (btn) {
      btn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var vid = btn.getAttribute('data-vb-voice') || '';
        var cid = btn.getAttribute('data-vb-char') || '';
        if (vid && root && root.VoiceEngine && typeof root.VoiceEngine.playById === 'function') {
          root.VoiceEngine.playById(vid, { force: true, ignoreSkip: true, mode: 'backlog', charId: cid || null, updateReplaySlot: false });
        }
      };
    });

    ov.classList.remove('hidden');
    if (wasHidden) playSfx('modal_open');
    var sc = ov.querySelector('#vb-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
    ov.onclick = function (e) {
      if (e.target === ov) closeBacklogModal();
    };
    ov.querySelector('#vb-close').onclick = closeBacklogModal;
    return ov;
  }

  function toggleBacklogModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-backlog-modal');
    if (ov && !ov.classList.contains('hidden')) closeBacklogModal();
    else openBacklogModal();
  }

  /* =========================================================================
     二、6 槽位手动存档 / 读档系统（含 1 个自动存档槽与旧格式无损升级）
     ========================================================================= */
  function buildMeta(st, scId, ts) {
    var safeSt = st && typeof st === 'object' ? st : {};
    return {
      name: (!safeSt.flags || !safeSt.flags.named) ? '？？？' : (safeSt.alias || safeSt.name || '希尔维亚'),
      ageStr: getAgeLabel(safeSt),
      phaseName: getPhaseLabel(safeSt),
      locName: getLocName(safeSt),
      chapterTitle: getChapterTitleForState(safeSt, scId),
      lv: safeSt.lv || 1,
      gold: safeSt.gold || 0,
      savedAt: formatTimestamp(ts)
    };
  }

  function normalizeManualSlot(raw, slotId) {
    if (!raw || typeof raw !== 'object') return null;
    var sid = Number(slotId || raw.slotId || 0);
    var ts = Number(raw.ts) || Date.now();

    if (raw.state && typeof raw.state === 'object') {
      var fallbackMeta = buildMeta(raw.state, raw.currentScene || null, ts);
      var rawMeta = (raw.meta && typeof raw.meta === 'object') ? raw.meta : {};
      var mergedMeta = {
        name: rawMeta.name != null ? String(rawMeta.name) : fallbackMeta.name,
        ageStr: rawMeta.ageStr != null ? String(rawMeta.ageStr) : fallbackMeta.ageStr,
        phaseName: rawMeta.phaseName != null ? String(rawMeta.phaseName) : fallbackMeta.phaseName,
        locName: rawMeta.locName != null ? String(rawMeta.locName) : fallbackMeta.locName,
        chapterTitle: rawMeta.chapterTitle != null ? String(rawMeta.chapterTitle) : fallbackMeta.chapterTitle,
        lv: rawMeta.lv != null ? Number(rawMeta.lv) || 1 : fallbackMeta.lv,
        gold: rawMeta.gold != null ? Number(rawMeta.gold) || 0 : fallbackMeta.gold,
        savedAt: rawMeta.savedAt != null ? String(rawMeta.savedAt) : fallbackMeta.savedAt
      };
      return {
        version: 2,
        slotId: sid,
        ts: ts,
        meta: mergedMeta,
        state: raw.state,
        currentScene: raw.currentScene || null,
        storyChain: raw.storyChain || null,
        backlog: Array.isArray(raw.backlog) ? raw.backlog : []
      };
    }

    // 兼容旧版 4 槽存档格式（.data 无 .state），在内存中平滑升级为 v2 结构
    if (raw.data && typeof raw.data === 'object') {
      var upgradedMeta = buildMeta(raw.data, null, ts);
      if (raw.loc && (!upgradedMeta.locName || upgradedMeta.locName === '未知地点')) {
        upgradedMeta.locName = String(raw.loc);
      }
      if (raw.phase && !upgradedMeta.phaseName) {
        upgradedMeta.phaseName = String(raw.phase);
      }
      return {
        version: 2,
        slotId: sid,
        ts: ts,
        meta: upgradedMeta,
        state: raw.data,
        currentScene: null,
        storyChain: null,
        backlog: []
      };
    }

    return null;
  }

  function readManualSlots() {
    var normalized = {};
    try {
      var raw = JSON.parse(localStorage.getItem(MANUAL_SLOTS_KEY) || '{}');
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        Object.keys(raw).forEach(function (k) {
          var item = normalizeManualSlot(raw[k], k);
          if (item) normalized[String(k)] = item;
        });
      }
    } catch (e) {
      return {};
    }
    return normalized;
  }

  function writeManualSlots(slotsObj) {
    try { localStorage.setItem(MANUAL_SLOTS_KEY, JSON.stringify(slotsObj || {})); } catch (e) {}
  }

  function onAutoSave(st) {
    if (!st) return;
    syncCodexArchiveFromState(st);
    var meta = buildMeta(st, typeof currentScene !== 'undefined' ? currentScene : null, Date.now());
    try { localStorage.setItem(AUTO_META_KEY, JSON.stringify(meta)); } catch (e) {}
  }

  function saveToSlot(slotId) {
    var sid = Number(slotId);
    if (!(sid >= 1 && sid <= 6)) return { ok: false, reason: 'bad_slot' };
    var st = getS();
    if (!st) return { ok: false, reason: 'no_state' };
    if (root.RelicsAndEvents && root.RelicsAndEvents.ensureRelicsState) {
      root.RelicsAndEvents.ensureRelicsState(st);
    }
    if (root.BranchingDirector && root.BranchingDirector.ensureCausalState) {
      root.BranchingDirector.ensureCausalState(st);
    }
    if (root.RaisingHub && typeof root.RaisingHub.ensureRaisingState === 'function') {
      try { root.RaisingHub.ensureRaisingState(st); } catch (e) {}
    }
    syncCodexArchiveFromState(st);
    var ts = Date.now();
    var curSc = typeof currentScene !== 'undefined' ? currentScene : null;
    var curChain = typeof storyChain !== 'undefined' && storyChain ? deepClone(storyChain) : null;
    var payload = {
      version: 2,
      slotId: sid,
      ts: ts,
      meta: buildMeta(st, curSc, ts),
      state: deepClone(st),
      currentScene: curSc,
      storyChain: curChain,
      backlog: deepClone(backlogList)
    };
    var all = readManualSlots();
    all[String(sid)] = payload;
    writeManualSlots(all);
    playSfx('glass_tap');
    showToast('已覆盖保存至存档槽 ' + sid);
    return { ok: true, slot: payload };
  }

  function cleanupTransientsOnStateSwitch() {
    if (typeof document !== 'undefined') {
      if (typeof show === 'function') {
        show('title-screen', 0);
        show('game-screen', 1);
        show('panel', 0);
        show('map-overlay', 0);
        show('stats-overlay', 0);
        show('backlog-overlay', 0);
        show('help-screen', 0);
        show('sys-popup', 0);
      }
      [
        'ending-screen', 'schedule-overlay', 'season-report-overlay',
        'shop-overlay', 'mailbox-overlay', 'arena-loadout-modal',
        'rumor-overlay', 'ice-deduction-modal', 'hud-drawer',
        'battle-screen', 'arena-overlay', 'duel-screen',
        'card', 'pick-screen'
      ].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.classList.add('hidden');
          el.classList.remove('open');
          if (id === 'card') el.onclick = null;
        }
      });
      var pickBar = document.getElementById('pick-confirm-bar');
      if (pickBar && pickBar.parentNode) pickBar.parentNode.removeChild(pickBar);
      if (typeof cgHide === 'function') {
        try { cgHide(true); } catch (e) {}
      } else if (root && typeof root.cgHide === 'function') {
        try { root.cgHide(true); } catch (e) {}
      }
      var cgScr = document.getElementById('cg-screen');
      if (cgScr) {
        cgScr.classList.add('hidden');
        cgScr.classList.remove('faded');
        cgScr.onclick = null;
      }
      var cgBg = document.getElementById('cg-bg');
      if (cgBg) cgBg.style.backgroundImage = '';
      var cgTxt = document.getElementById('cg-text');
      if (cgTxt) cgTxt.innerHTML = '';
      if (document.body) document.body.classList.remove('cg-mode');

      if (typeof setPov === 'function') {
        try { setPov(false); } catch (e) {}
      } else if (root && typeof root.setPov === 'function') {
        try { root.setPov(false); } catch (e) {}
      } else {
        if (document.body) document.body.classList.remove('pov-hidden');
        var hudEl = document.getElementById('hud');
        if (hudEl) { hudEl.style.opacity = ''; hudEl.style.pointerEvents = ''; }
        var locEl = document.getElementById('loc-bar');
        if (locEl) { locEl.style.opacity = ''; locEl.style.pointerEvents = ''; }
      }
      var ld = document.getElementById('letter-demo');
      if (ld && !ld.classList.contains('hidden')) {
        if (typeof closeLetterDemo === 'function') {
          try { closeLetterDemo(); } catch (e) { ld.classList.add('hidden'); }
        } else {
          ld.classList.remove('playing', 'revealed');
          ld.classList.add('hidden');
        }
      }
      closeSaveLoadModal();
      closeBacklogModal();
      closeChaptersModal();
      closePrefsModal();
      closeCodexGallery();
      closeCgLightbox();
    }
    if (root.AIChatPanel && typeof root.AIChatPanel.closeDrawer === 'function') {
      try { root.AIChatPanel.closeDrawer({ wipePending: true }); } catch (e) {}
    }
    if (typeof document !== 'undefined') {
      var aiEl = document.getElementById('ai-drawer');
      if (aiEl) aiEl.classList.add('hidden');
      if (document.body) document.body.classList.remove('ai-drawer-open');
    }
    if (root.CombatEngine && typeof root.CombatEngine.exitBattle === 'function') {
      try { root.CombatEngine.exitBattle(false, { silent: true }); } catch (e) {}
    }
  }

  function applyRestoredPayload(rawState, curSc, curChain, restoredBacklog) {
    if (!rawState || typeof rawState !== 'object') return false;
    var restored = typeof migrateStorySave === 'function' ? migrateStorySave(deepClone(rawState)) : deepClone(rawState);
    if (typeof baseState === 'function') {
      restored = Object.assign(baseState(), restored);
    }
    if (root.BranchingDirector && root.BranchingDirector.ensureCausalState) {
      root.BranchingDirector.ensureCausalState(restored);
    }
    if (root.RelicsAndEvents && root.RelicsAndEvents.ensureRelicsState) {
      root.RelicsAndEvents.ensureRelicsState(restored);
    }
    if (root.RaisingHub && typeof root.RaisingHub.ensureRaisingState === 'function') {
      try { root.RaisingHub.ensureRaisingState(restored); } catch (e) {}
    }
    if (typeof root.__vnApplyLoadedState === 'function') {
      root.__vnApplyLoadedState(restored, curSc, curChain);
    }
    root.S = restored;
    if (typeof window !== 'undefined') window.S = restored;

    setAutoMode(false);
    setSkipMode(false);
    currentLineMeta = null;
    if (Array.isArray(restoredBacklog)) {
      setBacklog(restoredBacklog);
    }
    cleanupTransientsOnStateSwitch();
    syncCodexArchiveFromState(restored);
    if (root && typeof root.bgmUnlock === 'function') {
      try { root.bgmUnlock(); } catch (e) {}
    }

    if (typeof updateHUD === 'function') updateHUD();
    var willResumeScene = !!(curSc && typeof SCENES !== 'undefined' && SCENES[curSc]);
    if (!willResumeScene && typeof updateLocBar === 'function') updateLocBar();
    if (root.RaisingHub && typeof root.RaisingHub.onStateLoaded === 'function') {
      try { root.RaisingHub.onStateLoaded(restored); } catch (e) {}
    }

    if (willResumeScene) {
      if (curChain && Array.isArray(curChain.queue) && curChain.queue.length && typeof runSceneQueue === 'function') {
        var resumeIdx = Math.max(0, (curChain.idx || 1) - 1);
        runSceneQueue(curChain.queue, resumeIdx);
      } else if (typeof runScene === 'function') {
        runScene(curSc);
      }
    } else if (typeof resumePendingStories === 'function' && resumePendingStories()) {
      // resumed pending
    } else if (typeof checkStoryGates === 'function' && checkStoryGates()) {
      // triggered due gates
    } else if (typeof enterFreeRoam === 'function') {
      enterFreeRoam({ restoreLoc: true });
    }
    return true;
  }

  function loadFromSlot(slotId) {
    var sid = Number(slotId);
    if (sid === 0) {
      try {
        var autoRaw = localStorage.getItem(typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'ojousama_save_v1');
        if (!autoRaw) return { ok: false, reason: 'empty' };
        var parsedAuto = JSON.parse(autoRaw);
        applyRestoredPayload(parsedAuto, null, null, null);
        playSfx('page_open');
        showToast('已读取自动存档');
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: 'corrupt' };
      }
    }
    if (!(sid >= 1 && sid <= 6)) return { ok: false, reason: 'bad_slot' };
    var all = readManualSlots();
    var slot = all[String(sid)];
    if (!slot || !slot.state) return { ok: false, reason: 'empty' };
    applyRestoredPayload(slot.state, slot.currentScene, slot.storyChain, slot.backlog);
    playSfx('page_open');
    showToast('已读取存档槽 ' + sid);
    return { ok: true, slot: slot };
  }

  function deleteSlot(slotId) {
    var sid = Number(slotId);
    if (!(sid >= 1 && sid <= 6)) return false;
    var all = readManualSlots();
    if (!all[String(sid)]) return false;
    delete all[String(sid)];
    writeManualSlots(all);
    showToast('已删除存档槽 ' + sid);
    return true;
  }

  function getSlotList() {
    var all = readManualSlots();
    var list = [];
    var autoExists = false;
    var autoMeta = null;
    try {
      var autoKey = typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'ojousama_save_v1';
      var rawAuto = localStorage.getItem(autoKey);
      if (rawAuto) {
        autoExists = true;
        var mRaw = localStorage.getItem(AUTO_META_KEY);
        if (mRaw) autoMeta = JSON.parse(mRaw);
        if (!autoMeta || !autoMeta.name) {
          var parsed = JSON.parse(rawAuto);
          autoMeta = buildMeta(parsed, null, Date.now());
        }
      }
    } catch (e) {}
    list.push({ slotId: 0, isAuto: true, empty: !autoExists, meta: autoMeta });

    for (var i = 1; i <= 6; i++) {
      var s = all[String(i)];
      list.push({
        slotId: i,
        isAuto: false,
        empty: !(s && s.state),
        meta: s && s.meta ? s.meta : null,
        ts: s ? s.ts : 0
      });
    }
    return list;
  }

  function clearPendingDeleteConfirm() {
    pendingDeleteSlotId = null;
    if (pendingDeleteTimer) {
      clearTimeout(pendingDeleteTimer);
      pendingDeleteTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('#vn-saveload-modal [data-sl-del].confirming').forEach(function (btn) {
        btn.classList.remove('confirming');
        btn.textContent = '删除';
        btn.setAttribute('aria-label', '删除存档槽 ' + btn.getAttribute('data-sl-del'));
      });
    }
  }

  function closeSaveLoadModal() {
    clearPendingDeleteConfirm();
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-saveload-modal');
    if (ov && !ov.classList.contains('hidden')) {
      ov.classList.add('hidden');
      playSfx('modal_close');
    }
    resumeAutoIfActive();
  }

  function openSaveLoadModal(mode) {
    if (typeof document === 'undefined') return null;
    clearPendingDeleteConfirm();
    var ov = document.getElementById('vn-saveload-modal');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'vn-saveload-modal';
      ov.className = 'overlay hidden';
      document.body.appendChild(ov);
    }
    var wasHidden = ov.classList.contains('hidden');
    var gs = document.getElementById('game-screen');
    var inGame = !!(gs && !gs.classList.contains('hidden'));
    var slots = getSlotList();

    var cardsHtml = slots.map(function (sl) {
      var headIcon = sl.isAuto ? getSvg('bolt') : getSvg('folder');
      var titleText = sl.isAuto ? '自动存档位' : ('手动槽位 0' + sl.slotId);
      var meta = sl.meta || {};
      var body = sl.empty
        ? '<div class="sl-empty">── 空置槽位 ──</div>'
        : '<div class="sl-meta">' +
            '<div class="sl-line1"><b>' + escapeHtml(meta.name || '希尔维亚') + '</b> · ' + escapeHtml(meta.ageStr || '0岁') + ' · Lv.' + (meta.lv || 1) + '</div>' +
            '<div class="sl-line2">' + escapeHtml([meta.phaseName, meta.locName].filter(Boolean).join(' · ')) + '</div>' +
            '<div class="sl-chap">' + escapeHtml(meta.chapterTitle || '') + '</div>' +
            '<div class="sl-time">' + escapeHtml(meta.savedAt || '') + '</div>' +
          '</div>';

      var btns = [];
      if (!sl.isAuto && inGame) {
        btns.push('<button type="button" class="sl-btn save" data-sl-save="' + sl.slotId + '">' + (sl.empty ? '保存至此' : '覆盖保存') + '</button>');
      }
      if (!sl.empty) {
        btns.push('<button type="button" class="sl-btn load" data-sl-load="' + sl.slotId + '">读取</button>');
      }
      if (!sl.isAuto && !sl.empty) {
        btns.push('<button type="button" class="sl-btn del" data-sl-del="' + sl.slotId + '" aria-label="删除存档槽 ' + sl.slotId + '">删除</button>');
      }

      return (
        '<article class="sl-card' + (sl.isAuto ? ' auto sl-auto-wide' : '') + (sl.empty ? ' empty' : '') + '" data-slot="' + sl.slotId + '">' +
          '<div class="sl-head"><span class="sl-head-label"><span class="vn-inline-ico" aria-hidden="true">' + headIcon + '</span><span>' + titleText + '</span></span></div>' +
          body +
          '<div class="sl-actions">' + btns.join('') + '</div>' +
        '</article>'
      );
    }).join('');

    ov.innerHTML =
      '<div class="end-card vn-modal-card">' +
        '<div class="vn-modal-head">' +
          '<div class="vn-modal-head-copy">' +
            '<h2><span class="vn-head-ico" aria-hidden="true">' + getSvg('save') + '</span><span>存档与读档中心（6 槽位 + 自动存档）</span></h2>' +
            '<p class="vn-modal-sub">' + (inGame ? '完整保留属性、命运暗流、随身铭记配装与对话回看记录' : '可从标题页直接读取任意手动槽位或自动存档继续游玩') + '</p>' +
          '</div>' +
          '<button type="button" class="modal-close-x" id="sl-close" aria-label="关闭存档中心">×</button>' +
        '</div>' +
        '<div class="vn-modal-scroll"><div class="sl-grid">' + cardsHtml + '</div></div>' +
      '</div>';

    ov.classList.remove('hidden');
    if (wasHidden) playSfx('modal_open');
    ov.onclick = function (e) {
      if (e.target === ov) closeSaveLoadModal();
    };
    ov.querySelector('#sl-close').onclick = closeSaveLoadModal;
    ov.querySelectorAll('[data-sl-save]').forEach(function (b) {
      b.onclick = function () {
        clearPendingDeleteConfirm();
        saveToSlot(Number(b.getAttribute('data-sl-save')));
        openSaveLoadModal(mode);
      };
    });
    ov.querySelectorAll('[data-sl-load]').forEach(function (b) {
      b.onclick = function () {
        clearPendingDeleteConfirm();
        loadFromSlot(Number(b.getAttribute('data-sl-load')));
      };
    });
    ov.querySelectorAll('[data-sl-del]').forEach(function (b) {
      b.onclick = function () {
        var sid = Number(b.getAttribute('data-sl-del'));
        if (pendingDeleteSlotId === sid && b.classList.contains('confirming')) {
          clearPendingDeleteConfirm();
          deleteSlot(sid);
          playSfx('glass_tap');
          openSaveLoadModal(mode);
          return;
        }
        clearPendingDeleteConfirm();
        pendingDeleteSlotId = sid;
        b.classList.add('confirming');
        b.textContent = '确认删除？';
        b.setAttribute('aria-label', '再次点击确认删除存档槽 ' + sid);
        playSfx('glass_tap');
        pendingDeleteTimer = setTimeout(function () {
          clearPendingDeleteConfirm();
        }, 3500);
      };
    });
    return ov;
  }

  /* =========================================================================
     三、章节速览与快速重温 / 快捷试玩跳转
     ========================================================================= */
  var FEATURED_QUICK_JUMPS = [
    { id: 's_start', label: '第一卷 · 银与蓝（开篇）', desc: '转生公爵家，开启银发蓝眸的新生。' },
    { id: 's_interlude_white_night', label: '间章 · 白昼里的夜（6～8岁）', desc: '城西命案、冰晶宫殿推演与白昼日蚀的暗流。' },
    { id: 's_micro', label: '第一卷 · 微服出行（8岁）', desc: '三姐妹溜进集市的轻喜剧日常。' },
    { id: 's_opening_ceremony', label: '第二卷 · 魔法大学入学（12岁）', desc: '踏入阿斯拉魔法大学，初遇同窗。' },
    { id: 's_aino_sparring', label: '第二卷 · 艾诺冰上实战（12岁冬）', desc: '领悟不经手隔空凝冰与三击切磋。' },
    { id: 's_turnpoint', label: '第二卷 · 转折点一（15岁冬）', desc: '黑夜突袭、东逃抉择与命运暗流汇合。' },
    { id: 's_north_forest', label: '第三卷 · 北林与霁馆（15岁春）', desc: '化名眷寒渔，在澄岚镇练就生根步与送刀。' },
    { id: 's_distant_wind_1', label: '第三卷 · 远行的风（上）', desc: '辞别霁馆父女，带乌木铁剑与木牌北行进入赫兰。' },
    { id: 's_leaky_cup', label: '第三卷 · 间章·漏水的水杯', desc: '松林篝火旁的爱丽丝与风神岚的旧日独白。' }
  ];

  function loadUnlockedChapters() {
    var base = { s_start: true };
    try {
      var raw = JSON.parse(localStorage.getItem(UNLOCKED_CHAPTERS_KEY) || '{}');
      if (raw && typeof raw === 'object') return Object.assign(base, raw);
    } catch (e) {}
    return base;
  }

  function markChapterUnlocked(sceneId) {
    if (!sceneId) return;
    var map = loadUnlockedChapters();
    if (!map[sceneId]) {
      map[sceneId] = true;
      try { localStorage.setItem(UNLOCKED_CHAPTERS_KEY, JSON.stringify(map)); } catch (e) {}
    }
  }

  function prepareChapterState(sceneId) {
    var st = typeof baseState === 'function' ? baseState() : (getS() || {});
    var locs = typeof LOCS !== 'undefined' ? LOCS : (root.__LOCS || {});
    Object.values(locs).forEach(function (L) { L.unlock = false; });

    var chaps = typeof STORY_CHAPTERS !== 'undefined' ? STORY_CHAPTERS : (root.__STORY_CHAPTERS || []);
    var idx = chaps.findIndex(function (c) { return c && c.id === sceneId; });
    st.storyGateVersion = 3;
    var gateMap = typeof STORY_GATE_BY_SCENE !== 'undefined' ? STORY_GATE_BY_SCENE : (root.STORY_GATE_BY_SCENE || {});
    var isVol3 = /^s_(black_name|jikan_arrive|north_forest|glow_sheep|distant_wind_1|words_to_wind|eye_of_storm|leaky_cup)$/.test(sceneId);
    var isInterlude = sceneId === 's_interlude_white_night';
    var isVol2 = !isVol3 && !isInterlude && (sceneId === 's_academy_start' || (idx >= chaps.findIndex(function (c) { return c && c.id === 's_opening_ceremony'; }) && idx >= 0));

    if (!isInterlude && idx > 0) {
      for (var gi = 0; gi < idx; gi++) {
        var cidPrev = chaps[gi] && chaps[gi].id;
        var gKeys = (cidPrev && gateMap[cidPrev]) || [];
        gKeys.forEach(function (k) { st.flags[k] = 1; });
      }
    }

    if (sceneId === 's_start') {
      st.ageY = 0; st.year = 0; st.month = 3; st.day = 1; st.phase = 'prologue'; st.loc = 'nursery';
      ['nursery', 'hallway', 'parlor', 'garden', 'dining'].forEach(function (k) {
        if (locs[k]) locs[k].unlock = true;
      });
    } else if (sceneId === 's_first_word') {
      st.flags.system_awakened = 1;
      st.flags.named = 1;
      st.flags.brave_gift_known = 1;
      st.ageY = 0; st.year = 0; st.month = 7; st.day = 1;
      st.season = Math.floor(((st.month - 3 + 12) % 12) / 3);
      st.phase = 'childhood';
      st.tier = 0;
      st.lv = 1;
      st.loc = 'nursery';
      ['nursery', 'hallway', 'parlor', 'garden', 'dining'].forEach(function (k) {
        if (locs[k]) locs[k].unlock = true;
      });
    } else if (isInterlude) {
      st.flags.system_awakened = 1;
      st.flags.brave_gift_known = 1;
      st.flags.named = 1;
      st.flags.ch_first_word = 1;
      st.flags.ch_alice_born = 1;
      st.flags.ch_child_days = 1;
      st.flags.ch_age4 = 1;
      st.flags.ch_yaoshen = 1;
      st.flags.ch_sisters_grow = 1;
      st.flags.ch_reno_arrive = 1;
      st.ageY = 7; st.year = 7; st.month = 12; st.season = 3;
      st.phase = 'youth';
      st.tier = 0;
      st.lv = 12; st.mhp = 90; st.hp = 90; st.mmp = 130; st.mp = 130;
      st.atk = 10; st.mag = 40; st.pdef = 10; st.mdef = 12; st.gold = 20;
      st.skills = ['virtual_duel', 'ice_palace', 'water_ball', 'ice_crystal'];
      st.loc = 'garden';
      Object.values(locs).forEach(function (L) {
        if (L.area === '公爵府' || L.area === '领地') L.unlock = true;
      });
      if (locs.garden) locs.garden.unlock = true;
    } else if (isVol3) {
      st.flags.system_awakened = 1;
      st.flags.brave_gift_known = 1;
      st.flags.named = 1;
      st.flags.ch_first_word = 1; st.flags.ch_alice_born = 1; st.flags.ch_beatrice_leaves = 1;
      st.flags.ch_academy = 1; st.flags.did_turnpoint = 1; st.flags.arrived_jikan = 1; st.flags.ch_black_name = 1;
      st.alias = sceneId === 's_black_name' ? null : '眷寒渔';
      st.phase = 'journey';
      st.ageY = (sceneId === 's_black_name' || sceneId === 's_jikan_arrive') ? 14 : 15;
      st.year = st.ageY === 14 ? 15 : 16;
      st.month = (sceneId === 's_eye_of_storm' || sceneId === 's_leaky_cup') ? 9 : ((sceneId === 's_distant_wind_1' || sceneId === 's_words_to_wind') ? 6 : 3);
      st.season = Math.floor(((st.month - 3 + 12) % 12) / 3);
      st.tier = 3;
      st.lv = 36; st.mhp = 240; st.hp = 240; st.mmp = 385; st.mp = 385;
      st.atk = 42; st.mag = 128; st.pdef = 38; st.mdef = 44; st.gold = 35;
      st.skills = ['virtual_duel', 'ice_palace', 'mana_cycle', 'water_ball', 'ice_crystal', 'root_step', 'soft_cut'];
      st.loc = (sceneId === 's_words_to_wind' || sceneId === 's_eye_of_storm' || sceneId === 's_leaky_cup') ? 'road' : 'jikan';
      ['road', 'jikan', 'chenglan_guild', 'northforest'].forEach(function (k) { if (locs[k]) locs[k].unlock = true; });
      if (sceneId === 's_words_to_wind' || sceneId === 's_eye_of_storm' || sceneId === 's_leaky_cup') {
        st.flags.ch_distant_wind_1 = 1;
        if (locs.ice_canyon) locs.ice_canyon.unlock = true;
      }
    } else if (isVol2) {
      st.flags.system_awakened = 1;
      st.flags.brave_gift_known = 1;
      st.flags.named = 1;
      st.flags.ch_first_word = 1; st.flags.ch_alice_born = 1; st.flags.ch_beatrice_leaves = 1;
      st.flags.ch_academy = 1;
      st.phase = 'academy';
      var lateAcad = ['s_star_festival', 's_turnpoint', 's_tree', 's_beach'].indexOf(sceneId) !== -1;
      st.ageY = lateAcad ? 15 : (['s_ice_melt_1', 's_seven_mountains', 's_ice_melt_2'].indexOf(sceneId) !== -1 ? 13 : 12);
      st.year = st.ageY;
      st.month = sceneId === 's_turnpoint' ? 12 : (sceneId === 's_aino_sparring' ? 12 : 9);
      st.season = Math.floor(((st.month - 3 + 12) % 12) / 3);
      st.tier = st.ageY >= 14 ? 2 : 1;
      st.lv = st.ageY >= 15 ? 34 : 28;
      st.mhp = 190; st.hp = 190; st.mmp = 320; st.mp = 320;
      st.atk = 22; st.mag = 95; st.pdef = 24; st.mdef = 28; st.gold = 40;
      st.skills = ['virtual_duel', 'ice_palace', 'water_ball', 'ice_crystal'];
      if (st.ageY >= 14) st.skills.push('mana_cycle');
      if (sceneId !== 's_opening_ceremony' && sceneId !== 's_academy_start') {
        st.flags.met_noelle = 1; st.flags.met_aino = 1; st.flags.met_charlotte = 1;
      }
      st.loc = 'dorm';
      Object.values(locs).forEach(function (L) {
        if (L.area === '魔法大学' || L.area === '公爵府') L.unlock = true;
      });
    } else {
      st.flags.system_awakened = 1;
      st.flags.brave_gift_known = 1;
      st.flags.named = 1;
      var ageGuess = sceneId === 's_micro' ? 8 : (sceneId === 's_beatrice_day' || sceneId === 's_alice_affinity' ? 7 : (sceneId === 's_reno_arrive' ? 6 : 4));
      st.ageY = ageGuess; st.year = ageGuess; st.month = 6; st.season = 1;
      st.phase = ageGuess >= 6 ? 'youth' : 'childhood';
      st.flags.ch_first_word = 1;
      if (ageGuess >= 3) st.flags.ch_alice_born = 1;
      st.tier = ageGuess >= 8 ? 1 : 0;
      st.lv = ageGuess >= 8 ? 15 : 8;
      st.mhp = ageGuess >= 8 ? 105 : 55; st.hp = st.mhp;
      st.mmp = ageGuess >= 8 ? 155 : 80; st.mp = st.mmp;
      st.atk = ageGuess >= 8 ? 12 : 5; st.mag = ageGuess >= 8 ? 48 : 24;
      st.skills = ageGuess >= 8 ? ['virtual_duel', 'ice_palace', 'water_ball', 'ice_crystal'] : ['virtual_duel', 'ice_crystal'];
      st.loc = ageGuess >= 8 ? 'ownroom' : 'nursery';
      Object.values(locs).forEach(function (L) {
        if (L.area === '公爵府' || L.area === '领地') L.unlock = true;
      });
    }

    if (typeof syncStatsToAge === 'function') {
      var prevS = root.S;
      root.S = st;
      try { syncStatsToAge(); } catch (e) {}
      root.S = prevS;
    }
    return st;
  }

  function jumpToChapter(sceneId) {
    var scenes = typeof SCENES !== 'undefined' ? SCENES : (root.SCENES || {});
    if (!scenes[sceneId]) return false;
    markChapterUnlocked(sceneId);

    var curS = getS();
    var preservedRelics = curS && curS.relicsUnlocked ? deepClone(curS.relicsUnlocked) : {};
    var preservedEq = curS && Array.isArray(curS.equippedRelics) ? curS.equippedRelics.slice() : [];
    var prepared = prepareChapterState(sceneId);
    prepared.relicsUnlocked = preservedRelics || {};
    prepared.equippedRelics = preservedEq;

    if (root.BranchingDirector && root.BranchingDirector.ensureCausalState) {
      root.BranchingDirector.ensureCausalState(prepared);
    }
    if (root.RelicsAndEvents && root.RelicsAndEvents.ensureRelicsState) {
      root.RelicsAndEvents.ensureRelicsState(prepared);
    }
    if (root.RaisingHub && typeof root.RaisingHub.ensureRaisingState === 'function') {
      try { root.RaisingHub.ensureRaisingState(prepared); } catch (e) {}
    }

    clearBacklog();
    if (typeof root.__vnApplyLoadedState === 'function') {
      root.__vnApplyLoadedState(prepared, null, null);
    }
    root.S = prepared;
    if (typeof window !== 'undefined') window.S = prepared;

    cleanupTransientsOnStateSwitch();
    if (root && typeof root.bgmUnlock === 'function') {
      try { root.bgmUnlock(); } catch (e) {}
    }
    if (root.RaisingHub && typeof root.RaisingHub.onStateLoaded === 'function') {
      try { root.RaisingHub.onStateLoaded(prepared); } catch (e) {}
    }
    playSfx('page_open');
    if (typeof runScene === 'function') runScene(sceneId);
    return true;
  }

  function closeChaptersModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-chapters-modal');
    if (ov && !ov.classList.contains('hidden')) {
      ov.classList.add('hidden');
      playSfx('modal_close');
    }
    resumeAutoIfActive();
  }

  function openChaptersModal() {
    if (typeof document === 'undefined') return null;
    var ov = document.getElementById('vn-chapters-modal');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'vn-chapters-modal';
      ov.className = 'overlay hidden';
      document.body.appendChild(ov);
    }
    var wasHidden = ov.classList.contains('hidden');
    var unlocked = loadUnlockedChapters();
    var chaps = (typeof STORY_CHAPTERS !== 'undefined' ? STORY_CHAPTERS : (root.__STORY_CHAPTERS || []))
      .filter(function (c) { return c && c.id && c.id !== 's_ending_menu'; });

    var quickHtml = FEATURED_QUICK_JUMPS.map(function (q) {
      return (
        '<button type="button" class="chap-quick-card" data-jump-chap="' + q.id + '">' +
          '<div class="cqc-title">✦ ' + escapeHtml(q.label) + '</div>' +
          '<div class="cqc-desc">' + escapeHtml(q.desc) + '</div>' +
        '</button>'
      );
    }).join('');

    var listHtml = chaps.map(function (c) {
      var isOpen = !!unlocked[c.id];
      return (
        '<button type="button" class="chap-row' + (isOpen ? ' unlocked' : ' locked') + '" ' +
          (isOpen ? 'data-jump-chap="' + c.id + '"' : 'disabled') + '>' +
          '<span class="cr-vol">' + escapeHtml(c.vol || '篇章') + '</span>' +
          '<span class="cr-tit">' + escapeHtml(c.title) + '</span>' +
          '<span class="cr-tag">' + (isOpen ? '▸ 重温' : '<span class="vn-inline-ico" aria-hidden="true">' + getSvg('lock') + '</span>未阅读') + '</span>' +
        '</button>'
      );
    }).join('');

    ov.innerHTML =
      '<div class="end-card vn-modal-card">' +
        '<div class="vn-modal-head">' +
          '<div class="vn-modal-head-copy">' +
            '<h2><span class="vn-head-ico" aria-hidden="true">' + getSvg('bookmark') + '</span><span>章节速览与快速重温</span></h2>' +
            '<p class="vn-modal-sub">随时重温已解锁章节，或通过快捷试玩直达各卷核心舞台</p>' +
          '</div>' +
          '<button type="button" class="modal-close-x" id="vc-close" aria-label="关闭章节速览">×</button>' +
        '</div>' +
        '<div class="vn-modal-scroll">' +
          '<h4 class="rel-sec-title is-first"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('star') + '</span><span>快捷试玩直达入口</span></h4>' +
          '<div class="chap-quick-grid">' + quickHtml + '</div>' +
          '<h4 class="rel-sec-title"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('book') + '</span><span>全卷章节记录</span></h4>' +
          '<div class="chap-list">' + listHtml + '</div>' +
        '</div>' +
      '</div>';

    ov.classList.remove('hidden');
    if (wasHidden) playSfx('modal_open');
    ov.onclick = function (e) {
      if (e.target === ov) closeChaptersModal();
    };
    ov.querySelector('#vc-close').onclick = closeChaptersModal;
    ov.querySelectorAll('[data-jump-chap]').forEach(function (btn) {
      btn.onclick = function () {
        jumpToChapter(btn.getAttribute('data-jump-chap'));
      };
    });
    return ov;
  }

  /* =========================================================================
     四、商业级阅读控制栏（Auto / Skip 未读急刹 / 阅读、明度与音效设置）
     ========================================================================= */
  function clampNum(v, lo, hi) {
    var n = Number(v);
    if (isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function normalizeTypeSpeed(val) {
    return (val === 'slow' || val === 'normal' || val === 'fast' || val === 'instant') ? val : 'normal';
  }

  function readExternalBrightness() {
    var getSetFn = (root && typeof root.getSettings === 'function')
      ? root.getSettings
      : (typeof getSettings === 'function' ? getSettings : null);
    if (getSetFn) {
      try {
        var cur = getSetFn();
        if (cur && cur.bright != null && !isNaN(Number(cur.bright))) {
          return clampNum(cur.bright, 0.5, 1.5);
        }
      } catch (e) {}
    }
    try {
      var raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (raw && raw.bright != null && !isNaN(Number(raw.bright))) {
        return clampNum(raw.bright, 0.5, 1.5);
      }
    } catch (e) {}
    return DEFAULT_PREFS.bright;
  }

  function loadPrefs() {
    if (vnPrefs) return vnPrefs;
    var merged = Object.assign({}, DEFAULT_PREFS);
    merged.bright = readExternalBrightness();
    try {
      if (root && root.VoiceEngine) {
        if (typeof root.VoiceEngine.getVolume === 'function') merged.voiceVol = clampNum(root.VoiceEngine.getVolume(), 0, 1);
        if (typeof root.VoiceEngine.isEnabled === 'function') merged.voiceEnabled = !!root.VoiceEngine.isEnabled();
        if (typeof root.VoiceEngine.getAutoWait === 'function') merged.voiceAutoWait = !!root.VoiceEngine.getAutoWait();
      }
    } catch (e) {}
    try {
      var raw = JSON.parse(localStorage.getItem(VN_PREFS_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (raw.autoSpeed != null) merged.autoSpeed = clampNum(raw.autoSpeed, 300, 6000);
        if (raw.typeSpeed != null) merged.typeSpeed = normalizeTypeSpeed(raw.typeSpeed);
        if (raw.bgmVol != null) merged.bgmVol = clampNum(raw.bgmVol, 0, 1);
        if (raw.sfxVol != null) merged.sfxVol = clampNum(raw.sfxVol, 0, 1);
        if (raw.voiceVol != null) merged.voiceVol = clampNum(raw.voiceVol, 0, 1);
        if (raw.voiceEnabled != null) merged.voiceEnabled = !!raw.voiceEnabled;
        if (raw.voiceAutoWait != null) merged.voiceAutoWait = !!raw.voiceAutoWait;
        if (raw.fxEnabled != null) merged.fxEnabled = !!raw.fxEnabled;
        if (raw.bright != null) merged.bright = clampNum(raw.bright, 0.5, 1.5);
      }
    } catch (e) {}
    vnPrefs = merged;
    return vnPrefs;
  }

  function persistPrefs() {
    try { localStorage.setItem(VN_PREFS_KEY, JSON.stringify(loadPrefs())); } catch (e) {}
  }

  function syncSettingsKeyField(k, v) {
    try {
      var cur = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (!cur || typeof cur !== 'object') cur = {};
      cur[k] = v;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cur));
    } catch (e) {}
  }

  function applyPrefToEngine(key, val) {
    if (key === 'bgmVol') {
      var bgmFn = (root && typeof root.bgmSetVolume === 'function')
        ? root.bgmSetVolume
        : (typeof bgmSetVolume === 'function' ? bgmSetVolume : null);
      if (bgmFn) {
        try { bgmFn(val); } catch (e) {}
      }
      syncSettingsKeyField('bgm', val);
    } else if (key === 'sfxVol') {
      var sfxFn = (root && typeof root.sfxSetVolume === 'function')
        ? root.sfxSetVolume
        : (typeof sfxSetVolume === 'function' ? sfxSetVolume : null);
      if (sfxFn) {
        try { sfxFn(val); } catch (e) {}
      }
    } else if (key === 'voiceVol') {
      if (root && root.VoiceEngine && typeof root.VoiceEngine.setVolume === 'function') {
        try { root.VoiceEngine.setVolume(val, { notifyVnUx: false }); } catch (e) {}
      }
      syncSettingsKeyField('voiceVol', val);
    } else if (key === 'voiceEnabled') {
      if (root && root.VoiceEngine && typeof root.VoiceEngine.setEnabled === 'function') {
        try { root.VoiceEngine.setEnabled(!!val, { notifyVnUx: false }); } catch (e) {}
      }
      syncSettingsKeyField('voiceEnabled', !!val);
    } else if (key === 'voiceAutoWait') {
      if (root && root.VoiceEngine && typeof root.VoiceEngine.setAutoWait === 'function') {
        try { root.VoiceEngine.setAutoWait(!!val, { notifyVnUx: false }); } catch (e) {}
      }
    } else if (key === 'typeSpeed') {
      var tsFn = (root && typeof root.setTypeSpeed === 'function')
        ? root.setTypeSpeed
        : (typeof setTypeSpeed === 'function' ? setTypeSpeed : null);
      if (tsFn) {
        try { tsFn(val); } catch (e) {}
      }
    } else if (key === 'fxEnabled') {
      if (root && root.AmbientFX && typeof root.AmbientFX.setEnabled === 'function') {
        try { root.AmbientFX.setEnabled(!!val); } catch (e) {}
      }
      if (root && root.LiquidPrism && typeof root.LiquidPrism.setEnabled === 'function') {
        try { root.LiquidPrism.setEnabled(!!val); } catch (e) {}
      }
    } else if (key === 'bright') {
      var setFn = (root && typeof root.setSetting === 'function')
        ? root.setSetting
        : (typeof setSetting === 'function' ? setSetting : null);
      if (setFn) {
        try { setFn('bright', val); } catch (e) {}
      } else {
        syncSettingsKeyField('bright', val);
        if (typeof document !== 'undefined') {
          var bgEl = document.getElementById('bg');
          if (bgEl) bgEl.style.filter = (val && Math.abs(val - 1) > 0.005) ? ('brightness(' + val + ')') : '';
        }
      }
    }
  }

  function syncExternalAudioPrefs(patch) {
    if (inExternalAudioSync) return Object.assign({}, loadPrefs());
    inExternalAudioSync = true;
    try {
      var p = loadPrefs();
      var bgmGet = (root && typeof root.bgmGetVolume === 'function')
        ? root.bgmGetVolume
        : (typeof bgmGetVolume === 'function' ? bgmGetVolume : null);
      if (bgmGet) {
        try {
          var bv = Number(bgmGet());
          if (!isNaN(bv)) p.bgmVol = clampNum(bv, 0, 1);
        } catch (e) {}
      }
      var sfxGet = (root && typeof root.sfxGetVolume === 'function')
        ? root.sfxGetVolume
        : (typeof sfxGetVolume === 'function' ? sfxGetVolume : null);
      if (sfxGet) {
        try {
          var sv = Number(sfxGet());
          if (!isNaN(sv)) p.sfxVol = clampNum(sv, 0, 1);
        } catch (e) {}
      }
      if (root && root.VoiceEngine) {
        try {
          if (typeof root.VoiceEngine.getVolume === 'function') {
            var vv = Number(root.VoiceEngine.getVolume());
            if (!isNaN(vv)) p.voiceVol = clampNum(vv, 0, 1);
          }
          if (typeof root.VoiceEngine.isEnabled === 'function') {
            p.voiceEnabled = !!root.VoiceEngine.isEnabled();
          }
          if (typeof root.VoiceEngine.getAutoWait === 'function') {
            p.voiceAutoWait = !!root.VoiceEngine.getAutoWait();
          }
        } catch (e) {}
      }
      if (patch && typeof patch === 'object') {
        if (patch.bgmVol != null) p.bgmVol = clampNum(patch.bgmVol, 0, 1);
        if (patch.sfxVol != null) p.sfxVol = clampNum(patch.sfxVol, 0, 1);
        if (patch.voiceVol != null) p.voiceVol = clampNum(patch.voiceVol, 0, 1);
        if (patch.voiceEnabled != null) p.voiceEnabled = !!patch.voiceEnabled;
        if (patch.voiceAutoWait != null) p.voiceAutoWait = !!patch.voiceAutoWait;
      }
      p.bright = readExternalBrightness();
      syncPrefsModalDOM();
      return Object.assign({}, p);
    } finally {
      inExternalAudioSync = false;
    }
  }

  function syncSavedPrefsToEngine() {
    var hasStored = false;
    try { hasStored = !!localStorage.getItem(VN_PREFS_KEY); } catch (e) {}
    var p = loadPrefs();
    applyPrefToEngine('typeSpeed', p.typeSpeed);
    applyPrefToEngine('fxEnabled', p.fxEnabled);
    if (hasStored) {
      applyPrefToEngine('bgmVol', p.bgmVol);
      applyPrefToEngine('sfxVol', p.sfxVol);
      applyPrefToEngine('voiceVol', p.voiceVol);
      applyPrefToEngine('voiceEnabled', p.voiceEnabled);
      applyPrefToEngine('voiceAutoWait', p.voiceAutoWait);
      applyPrefToEngine('bright', p.bright);
    } else {
      syncExternalAudioPrefs();
    }
  }

  function getPrefs() {
    return Object.assign({}, loadPrefs());
  }

  function setPref(key, value) {
    var p = loadPrefs();
    if (key === 'autoSpeed') {
      p.autoSpeed = clampNum(value, 300, 6000);
    } else if (key === 'typeSpeed') {
      p.typeSpeed = normalizeTypeSpeed(value);
    } else if (key === 'bgmVol') {
      p.bgmVol = clampNum(value, 0, 1);
    } else if (key === 'sfxVol') {
      p.sfxVol = clampNum(value, 0, 1);
    } else if (key === 'voiceVol') {
      p.voiceVol = clampNum(value, 0, 1);
    } else if (key === 'voiceEnabled') {
      p.voiceEnabled = !!value;
    } else if (key === 'voiceAutoWait') {
      p.voiceAutoWait = !!value;
    } else if (key === 'fxEnabled') {
      p.fxEnabled = !!value;
    } else if (key === 'bright') {
      p.bright = clampNum(value, 0.5, 1.5);
    } else {
      return Object.assign({}, p);
    }
    persistPrefs();
    applyPrefToEngine(key, p[key]);
    if ((key === 'autoSpeed' || key === 'voiceAutoWait') && autoMode) {
      scheduleAutoStep();
    }
    syncPrefsModalDOM();
    return Object.assign({}, p);
  }

  function resetPrefs() {
    vnPrefs = Object.assign({}, DEFAULT_PREFS);
    persistPrefs();
    applyPrefToEngine('bgmVol', vnPrefs.bgmVol);
    applyPrefToEngine('sfxVol', vnPrefs.sfxVol);
    applyPrefToEngine('voiceVol', vnPrefs.voiceVol);
    applyPrefToEngine('voiceEnabled', vnPrefs.voiceEnabled);
    applyPrefToEngine('voiceAutoWait', vnPrefs.voiceAutoWait);
    applyPrefToEngine('typeSpeed', vnPrefs.typeSpeed);
    applyPrefToEngine('fxEnabled', vnPrefs.fxEnabled);
    applyPrefToEngine('bright', vnPrefs.bright);
    syncPrefsModalDOM();
    return Object.assign({}, vnPrefs);
  }

  function loadReadLines() {
    if (readLinesSet) return readLinesSet;
    var map = {};
    try {
      var raw = JSON.parse(localStorage.getItem(READ_LINES_KEY) || '[]');
      if (Array.isArray(raw)) {
        raw.forEach(function (k) { if (k) map[String(k)] = 1; });
      } else if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach(function (k) { if (raw[k]) map[k] = 1; });
      }
    } catch (e) {}
    readLinesSet = map;
    return readLinesSet;
  }

  function persistReadLines() {
    var map = loadReadLines();
    var keys = Object.keys(map);
    if (keys.length > 4800) {
      var trimmed = keys.slice(keys.length - 4800);
      var nextMap = {};
      trimmed.forEach(function (k) { nextMap[k] = 1; });
      readLinesSet = nextMap;
      keys = trimmed;
    }
    try { localStorage.setItem(READ_LINES_KEY, JSON.stringify(keys)); } catch (e) {}
  }

  function buildLineKey(sceneId, text) {
    var sc = sceneId || getCurrentSceneId() || 'roam';
    var txt = String(text == null ? '' : text);
    return sc + ':' + txt.slice(0, 32);
  }

  function normalizeReadKey(keyOrScene, optText) {
    if (optText !== undefined) {
      return buildLineKey(keyOrScene, optText);
    }
    if (keyOrScene && typeof keyOrScene === 'object') {
      if (keyOrScene.key) return String(keyOrScene.key);
      return buildLineKey(keyOrScene.sceneId, keyOrScene.text);
    }
    return String(keyOrScene || '');
  }

  function markLineRead(keyOrScene, optText) {
    var k = normalizeReadKey(keyOrScene, optText);
    if (!k) return false;
    var map = loadReadLines();
    if (!map[k]) {
      map[k] = 1;
      persistReadLines();
    }
    return true;
  }

  function isLineRead(keyOrScene, optText) {
    var k = normalizeReadKey(keyOrScene, optText);
    if (!k) return false;
    var map = loadReadLines();
    return !!map[k];
  }

  function isModalVisible(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  }

  function isHudDrawerVisible(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    if (el.style && el.style.display === 'none') return false;
    if (el.classList && el.classList.contains('open')) return true;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'false') return true;
    return false;
  }

  function isAwaitingChoice() {
    if (typeof awaitingChoice !== 'undefined' && awaitingChoice) return true;
    if (typeof document === 'undefined') return false;
    var ch = document.getElementById('choices');
    return !!(ch && ch.querySelector('.choice'));
  }

  function isDialogTyping() {
    if (typeof typing !== 'undefined' && typing) return true;
    if (typeof cgTyping !== 'undefined' && cgTyping) return true;
    return false;
  }

  function isAnyBlockingOverlayOpen() {
    if (typeof document === 'undefined') return false;
    var ids = [
      'cg-lightbox', 'letter-demo', 'sys-popup', 'vn-prefs-modal',
      'arena-loadout-modal', 'rumor-overlay', 'vn-backlog-modal',
      'vn-saveload-modal', 'vn-chapters-modal', 'ending-screen',
      'schedule-overlay', 'season-report-overlay', 'shop-overlay',
      'mailbox-overlay', 'ice-deduction-modal', 'panel', 'stats-overlay',
      'map-overlay', 'codex', 'backlog-overlay', 'help-screen',
      'pick-screen', 'arena-overlay', 'duel-screen', 'battle-screen',
      'ai-drawer', 'card'
    ];
    for (var i = 0; i < ids.length; i++) {
      if (isModalVisible(document.getElementById(ids[i]))) return true;
    }
    if (isHudDrawerVisible(document.getElementById('hud-drawer'))) return true;
    return false;
  }

  function canAdvanceReading() {
    if (typeof document === 'undefined') return false;
    var gs = document.getElementById('game-screen');
    if (!gs || gs.classList.contains('hidden')) return false;
    var st = getS();
    if (st && st.freeRoam) return false;
    if (isAwaitingChoice()) return false;
    if (isAnyBlockingOverlayOpen()) return false;
    var cs = document.getElementById('cg-screen');
    if (cs && !cs.classList.contains('hidden') && typeof cs.onclick === 'function') return true;
    var tb = document.getElementById('text-box');
    if (!tb || tb.classList.contains('dialog-hidden') || tb.classList.contains('season-flavor')) return false;
    return true;
  }

  function clearAutoTimer() {
    autoVoiceWaitGen += 1;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function clearSkipTimer() {
    if (skipTimer) {
      clearTimeout(skipTimer);
      skipTimer = null;
    }
  }

  function updateVoiceReplayButton() {
    if (typeof document === 'undefined') return;
    var ve = root && root.VoiceEngine;
    var canReplay = !!(ve && typeof ve.canReplayCurrent === 'function' && ve.canReplayCurrent());
    var isVoicing = !!(ve && typeof ve.isPlaying === 'function' && ve.isPlaying());
    var curId = (ve && typeof ve.getCurrentVoiceId === 'function') ? ve.getCurrentVoiceId() : null;
    var btn = document.getElementById('btn-vn-voice-replay');
    if (btn) {
      btn.classList.toggle('is-unavailable', !canReplay);
      btn.classList.toggle('is-playing', canReplay && isVoicing);
      btn.disabled = !canReplay;
    }
    var backlogOv = document.getElementById('vn-backlog-modal');
    if (backlogOv && !backlogOv.classList.contains('hidden')) {
      backlogOv.querySelectorAll('.vb-voice-btn').forEach(function (b) {
        var vid = b.getAttribute('data-vb-voice') || '';
        b.classList.toggle('is-playing', !!(isVoicing && curId && vid === curId));
      });
    }
  }

  function updateReadControlUI() {
    if (typeof document === 'undefined') return;
    var bAuto = document.getElementById('btn-vn-auto');
    if (bAuto) {
      bAuto.classList.toggle('active', !!autoMode);
      bAuto.setAttribute('aria-pressed', autoMode ? 'true' : 'false');
    }
    var bSkip = document.getElementById('btn-vn-skip');
    if (bSkip) {
      bSkip.classList.toggle('active', !!skipMode);
      bSkip.setAttribute('aria-pressed', skipMode ? 'true' : 'false');
    }
    updateVoiceReplayButton();
  }

  function performAdvance() {
    if (!canAdvanceReading()) return false;
    var cs = typeof document !== 'undefined' ? document.getElementById('cg-screen') : null;
    if (cs && !cs.classList.contains('hidden') && typeof cs.onclick === 'function') {
      try { cs.onclick(); return true; } catch (e) {}
      return false;
    }
    var advFn = (root && typeof root.advanceDialog === 'function')
      ? root.advanceDialog
      : (typeof advanceDialog === 'function' ? advanceDialog : null);
    if (advFn) {
      try { advFn(); return true; } catch (e) {}
    }
    var tb = typeof document !== 'undefined' ? document.getElementById('text-box') : null;
    if (tb && typeof tb.click === 'function') {
      try { tb.click(); return true; } catch (e) {}
    }
    return false;
  }

  function stopSkipAtUnread() {
    setSkipMode(false);
    showToast('已抵达未读台词，快进已自动停止');
  }

  function resumeAutoIfActive() {
    if (autoMode && canAdvanceReading()) {
      scheduleAutoStep();
    }
  }

  function scheduleAutoStep() {
    clearAutoTimer();
    if (!autoMode) return;
    if (isDialogTyping()) {
      autoTimer = setTimeout(function () {
        autoTimer = null;
        scheduleAutoStep();
      }, 120);
      return;
    }
    var prefs = loadPrefs();
    var ve = root && root.VoiceEngine;
    if (prefs.voiceAutoWait && ve && typeof ve.isPlaying === 'function' && ve.isPlaying()) {
      var myGen = autoVoiceWaitGen;
      if (typeof ve.onEndedOnce === 'function') {
        ve.onEndedOnce(function () {
          if (myGen !== autoVoiceWaitGen || !autoMode) return;
          if (canAdvanceReading()) scheduleAutoStep();
        });
      }
      return;
    }
    var delay = prefs.autoSpeed;
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (!autoMode) return;
      if (isDialogTyping()) {
        scheduleAutoStep();
        return;
      }
      var curPrefs = loadPrefs();
      var curVe = root && root.VoiceEngine;
      if (curPrefs.voiceAutoWait && curVe && typeof curVe.isPlaying === 'function' && curVe.isPlaying()) {
        scheduleAutoStep();
        return;
      }
      if (!canAdvanceReading()) {
        return;
      }
      performAdvance();
    }, delay);
  }

  function scheduleSkipStep() {
    clearSkipTimer();
    if (!skipMode) return;
    skipTimer = setTimeout(function () {
      skipTimer = null;
      if (!skipMode) return;
      if (isAwaitingChoice()) {
        setSkipMode(false);
        return;
      }
      if (!canAdvanceReading()) {
        var st = getS();
        if (st && st.freeRoam) setSkipMode(false);
        return;
      }
      if (currentLineMeta && !currentLineMeta.wasRead && !isLineRead(currentLineMeta.key)) {
        stopSkipAtUnread();
        return;
      }
      if (isDialogTyping()) {
        performAdvance();
        if (skipMode && canAdvanceReading()) {
          performAdvance();
        }
      } else {
        performAdvance();
      }
    }, 85);
  }

  function setAutoMode(on) {
    var next = !!on;
    if (next && skipMode) setSkipMode(false);
    autoMode = next;
    clearAutoTimer();
    updateReadControlUI();
    if (autoMode && canAdvanceReading() && !isDialogTyping()) {
      scheduleAutoStep();
    }
    return autoMode;
  }

  function toggleAutoMode() {
    playSfx('glass_tap');
    return setAutoMode(!autoMode);
  }

  function isAutoMode() {
    return !!autoMode;
  }

  function setSkipMode(on) {
    var next = !!on;
    if (next && autoMode) setAutoMode(false);
    skipMode = next;
    clearSkipTimer();
    updateReadControlUI();
    if (skipMode) {
      if (root && root.VoiceEngine && typeof root.VoiceEngine.stop === 'function') {
        try { root.VoiceEngine.stop({ reason: 'skip' }); } catch (e) {}
      }
      if (isAwaitingChoice()) {
        skipMode = false;
        updateReadControlUI();
        return false;
      }
      if (currentLineMeta) {
        var curRead = !!(currentLineMeta.wasRead || isLineRead(currentLineMeta.key));
        if (!curRead) {
          skipMode = false;
          updateReadControlUI();
          showToast('已抵达未读台词，快进已自动停止');
          return false;
        }
        if (canAdvanceReading()) {
          scheduleSkipStep();
        }
      }
    }
    return skipMode;
  }

  function toggleSkipMode() {
    playSfx('glass_tap');
    return setSkipMode(!skipMode);
  }

  function isSkipMode() {
    return !!skipMode;
  }

  function handleLineRecorded(sceneId, rawText) {
    if (currentLineMeta && currentLineMeta.key) {
      markLineRead(currentLineMeta.key);
    }
    var sig = buildLineKey(sceneId, rawText);
    var already = isLineRead(sig);
    currentLineMeta = {
      key: sig,
      wasRead: already,
      sceneId: sceneId,
      text: rawText
    };
    if (skipMode) {
      if (isAwaitingChoice()) {
        setSkipMode(false);
        return;
      }
      if (!already) {
        stopSkipAtUnread();
        return;
      }
      scheduleSkipStep();
    } else if (autoMode) {
      scheduleAutoStep();
    }
  }

  function onLineComplete(arg1, arg2) {
    if (arg1 && typeof arg1 === 'object' && arg1.isChoice) {
      clearAutoTimer();
      if (skipMode) setSkipMode(false);
      return;
    }
    var hasExplicit = arg1 !== undefined;
    var sig = '';
    if (hasExplicit) {
      if (typeof arg1 === 'string' && arg2 === undefined) {
        if (currentLineMeta && currentLineMeta.text === arg1) {
          sig = currentLineMeta.key;
        } else if (arg1.indexOf(':') > 0 && /^s_[a-z0-9_]+:/i.test(arg1)) {
          sig = arg1;
        } else {
          sig = buildLineKey(null, arg1);
        }
      } else {
        sig = normalizeReadKey(arg1, arg2);
      }
    } else if (currentLineMeta && currentLineMeta.key) {
      sig = currentLineMeta.key;
    } else if (typeof document !== 'undefined') {
      var tEl = document.getElementById('text');
      if (tEl && tEl.textContent) {
        sig = buildLineKey(null, tEl.textContent.trim());
      }
    }

    var wasAlreadyRead = false;
    if (sig) {
      if (currentLineMeta && currentLineMeta.key === sig) {
        wasAlreadyRead = !!currentLineMeta.wasRead;
      } else {
        wasAlreadyRead = isLineRead(sig);
      }
    }

    if (isAwaitingChoice()) {
      clearAutoTimer();
      if (skipMode) setSkipMode(false);
      if (sig) markLineRead(sig);
      return;
    }

    if (skipMode) {
      if (!wasAlreadyRead) {
        stopSkipAtUnread();
        if (sig) {
          markLineRead(sig);
          if (currentLineMeta && currentLineMeta.key === sig) currentLineMeta.wasRead = true;
        }
        return;
      }
      scheduleSkipStep();
      return;
    }

    if (sig) {
      markLineRead(sig);
      if (currentLineMeta && currentLineMeta.key === sig) currentLineMeta.wasRead = true;
    }
    if (autoMode && canAdvanceReading()) {
      scheduleAutoStep();
    }
  }

  function syncPrefsModalDOM() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-prefs-modal');
    if (!ov || ov.classList.contains('hidden')) return;
    var p = loadPrefs();
    ov.querySelectorAll('[data-pref-auto]').forEach(function (btn) {
      var val = Number(btn.getAttribute('data-pref-auto'));
      btn.classList.toggle('active', Math.abs(val - p.autoSpeed) < 50);
    });
    ov.querySelectorAll('[data-pref-type]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-pref-type') === p.typeSpeed);
    });
    var bgmSlider = ov.querySelector('#pref-bgm-vol');
    var bgmVal = ov.querySelector('#pref-bgm-val');
    if (bgmSlider) bgmSlider.value = String(Math.round(p.bgmVol * 100));
    if (bgmVal) bgmVal.textContent = Math.round(p.bgmVol * 100) + '%';

    var sfxSlider = ov.querySelector('#pref-sfx-vol');
    var sfxVal = ov.querySelector('#pref-sfx-val');
    if (sfxSlider) sfxSlider.value = String(Math.round(p.sfxVol * 100));
    if (sfxVal) sfxVal.textContent = Math.round(p.sfxVol * 100) + '%';

    var voiceSlider = ov.querySelector('#pref-voice-vol');
    var voiceVal = ov.querySelector('#pref-voice-val');
    var voicePct = Math.round(clampNum(p.voiceVol != null ? p.voiceVol : 0.90, 0, 1) * 100);
    if (voiceSlider) voiceSlider.value = String(voicePct);
    if (voiceVal) voiceVal.textContent = voicePct + '%';

    var voiceToggleBtn = ov.querySelector('#pref-voice-toggle');
    if (voiceToggleBtn) {
      voiceToggleBtn.classList.toggle('on', !!p.voiceEnabled);
      voiceToggleBtn.textContent = p.voiceEnabled ? '已开启 · 角色配音' : '已关闭 · 静音';
      voiceToggleBtn.setAttribute('aria-pressed', p.voiceEnabled ? 'true' : 'false');
    }

    var voiceWaitBtn = ov.querySelector('#pref-voice-autowait');
    if (voiceWaitBtn) {
      voiceWaitBtn.classList.toggle('on', !!p.voiceAutoWait);
      voiceWaitBtn.textContent = p.voiceAutoWait ? '已开启 · 播完翻页' : '已关闭 · 按时翻页';
      voiceWaitBtn.setAttribute('aria-pressed', p.voiceAutoWait ? 'true' : 'false');
    }

    var brightSlider = ov.querySelector('#pref-bright');
    var brightVal = ov.querySelector('#pref-bright-val');
    var brightPct = Math.round(clampNum(p.bright != null ? p.bright : 1, 0.5, 1.5) * 100);
    if (brightSlider) brightSlider.value = String(brightPct);
    if (brightVal) brightVal.textContent = brightPct + '%';

    var fxBtn = ov.querySelector('#pref-fx-toggle');
    if (fxBtn) {
      fxBtn.classList.toggle('on', !!p.fxEnabled);
      fxBtn.textContent = p.fxEnabled ? '已开启 · 星霜微尘' : '已关闭 · 纯净画面';
      fxBtn.setAttribute('aria-pressed', p.fxEnabled ? 'true' : 'false');
    }
  }

  function closePrefsModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-prefs-modal');
    if (ov && !ov.classList.contains('hidden')) {
      ov.classList.add('hidden');
      playSfx('modal_close');
    }
    resumeAutoIfActive();
  }

  function openPrefsModal() {
    if (typeof document === 'undefined') return null;
    clearAutoTimer();
    clearSkipTimer();
    var ov = document.getElementById('vn-prefs-modal');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'vn-prefs-modal';
      ov.className = 'overlay hidden';
      document.body.appendChild(ov);
    }
    var wasHidden = ov.classList.contains('hidden');
    syncExternalAudioPrefs();
    var p = loadPrefs();
    var bgmPct = Math.round(p.bgmVol * 100);
    var sfxPct = Math.round(p.sfxVol * 100);
    var voicePct = Math.round(clampNum(p.voiceVol != null ? p.voiceVol : 0.90, 0, 1) * 100);
    var brightPct = Math.round(clampNum(p.bright != null ? p.bright : 1, 0.5, 1.5) * 100);

    ov.innerHTML =
      '<div class="end-card vn-modal-card vn-prefs-card">' +
        '<div class="vn-modal-head">' +
          '<div class="vn-modal-head-copy">' +
            '<h2><span class="vn-head-ico" aria-hidden="true">' + getSvg('sliders') + '</span><span>阅读与音效设置</span></h2>' +
            '<p class="vn-modal-sub">所有偏好自动保存至本地，实时同步打字机、独立音量、画面明度与氛围粒子</p>' +
          '</div>' +
          '<button type="button" class="modal-close-x" id="pref-close" aria-label="关闭阅读与音效设置">×</button>' +
        '</div>' +
        '<div class="vn-modal-scroll prefs-body">' +
          '<div class="prefs-group">' +
            '<div class="prefs-row">' +
              '<div class="prefs-label"><b>Auto 停顿速度</b><span>自动推进每句台词之间的阅读停顿</span></div>' +
              '<div class="prefs-seg">' +
                '<button type="button" class="prefs-seg-btn' + (p.autoSpeed >= 2400 ? ' active' : '') + '" data-pref-auto="2800">慢</button>' +
                '<button type="button" class="prefs-seg-btn' + (p.autoSpeed > 1300 && p.autoSpeed < 2400 ? ' active' : '') + '" data-pref-auto="1800">适中</button>' +
                '<button type="button" class="prefs-seg-btn' + (p.autoSpeed <= 1300 ? ' active' : '') + '" data-pref-auto="1000">快</button>' +
              '</div>' +
            '</div>' +
            '<div class="prefs-row">' +
              '<div class="prefs-label"><b>打字机速度</b><span>调整对白逐字显现的节奏</span></div>' +
              '<div class="prefs-seg">' +
                '<button type="button" class="prefs-seg-btn' + (p.typeSpeed === 'slow' ? ' active' : '') + '" data-pref-type="slow">缓</button>' +
                '<button type="button" class="prefs-seg-btn' + (p.typeSpeed === 'normal' ? ' active' : '') + '" data-pref-type="normal">标</button>' +
                '<button type="button" class="prefs-seg-btn' + (p.typeSpeed === 'fast' ? ' active' : '') + '" data-pref-type="fast">疾</button>' +
                '<button type="button" class="prefs-seg-btn' + (p.typeSpeed === 'instant' ? ' active' : '') + '" data-pref-type="instant">瞬显</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="prefs-group">' +
            '<div class="prefs-row prefs-slider-row">' +
              '<div class="prefs-label"><b>BGM 音乐音量</b><span>场景配乐与音乐室试听音量</span></div>' +
              '<div class="prefs-slider-wrap">' +
                '<input type="range" class="prefs-slider" id="pref-bgm-vol" min="0" max="100" step="1" value="' + bgmPct + '"/>' +
                '<span class="prefs-val" id="pref-bgm-val">' + bgmPct + '%</span>' +
              '</div>' +
            '</div>' +
            '<div class="prefs-row prefs-slider-row">' +
              '<div class="prefs-label"><b>SFX 音效音量</b><span>点击、翻页、施法与界面交互音效</span></div>' +
              '<div class="prefs-slider-wrap">' +
                '<input type="range" class="prefs-slider" id="pref-sfx-vol" min="0" max="100" step="1" value="' + sfxPct + '"/>' +
                '<span class="prefs-val" id="pref-sfx-val">' + sfxPct + '%</span>' +
              '</div>' +
            '</div>' +
            '<div class="prefs-row prefs-slider-row">' +
              '<div class="prefs-label"><b>角色语音音量</b><span>剧情对白、互动问候与战斗演出语音</span></div>' +
              '<div class="prefs-slider-wrap">' +
                '<input type="range" class="prefs-slider" id="pref-voice-vol" min="0" max="100" step="1" value="' + voicePct + '"/>' +
                '<span class="prefs-val" id="pref-voice-val">' + voicePct + '%</span>' +
              '</div>' +
            '</div>' +
            '<div class="prefs-row">' +
              '<div class="prefs-label"><b>角色语音开关</b><span>开启或静默全部角色配音</span></div>' +
              '<button type="button" class="prefs-toggle' + (p.voiceEnabled ? ' on' : '') + '" id="pref-voice-toggle" aria-pressed="' + (p.voiceEnabled ? 'true' : 'false') + '">' +
                (p.voiceEnabled ? '已开启 · 角色配音' : '已关闭 · 静音') +
              '</button>' +
            '</div>' +
            '<div class="prefs-row">' +
              '<div class="prefs-label"><b>Auto 等待语音播完</b><span>自动阅读模式下等待当前语音播毕再翻页</span></div>' +
              '<button type="button" class="prefs-toggle' + (p.voiceAutoWait ? ' on' : '') + '" id="pref-voice-autowait" aria-pressed="' + (p.voiceAutoWait ? 'true' : 'false') + '">' +
                (p.voiceAutoWait ? '已开启 · 播完翻页' : '已关闭 · 按时翻页') +
              '</button>' +
            '</div>' +
            '<div class="prefs-row prefs-slider-row">' +
              '<div class="prefs-label"><b>背景明度</b><span>单独调节场景底图亮度，平稳顺滑不打断配乐</span></div>' +
              '<div class="prefs-slider-wrap">' +
                '<input type="range" class="prefs-slider" id="pref-bright" min="50" max="150" step="1" value="' + brightPct + '"/>' +
                '<span class="prefs-val" id="pref-bright-val">' + brightPct + '%</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="prefs-group">' +
            '<div class="prefs-row">' +
              '<div class="prefs-label"><b>场景氛围粒子与棱镜</b><span>飞雪、微光、冰尘与晶透折射视觉层</span></div>' +
              '<button type="button" class="prefs-toggle' + (p.fxEnabled ? ' on' : '') + '" id="pref-fx-toggle" aria-pressed="' + (p.fxEnabled ? 'true' : 'false') + '">' +
                (p.fxEnabled ? '已开启 · 星霜微尘' : '已关闭 · 纯净画面') +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="prefs-foot">' +
          '<button type="button" class="sl-btn is-compact" id="pref-reset">恢复默认</button>' +
          '<span class="prefs-hint">按 Esc 或点击遮罩外侧关闭设置面板</span>' +
        '</div>' +
      '</div>';

    ov.classList.remove('hidden');
    if (wasHidden) playSfx('modal_open');
    ov.onclick = function (e) {
      if (e.target === ov) closePrefsModal();
    };
    ov.querySelector('#pref-close').onclick = closePrefsModal;
    ov.querySelector('#pref-reset').onclick = function () {
      resetPrefs();
      playSfx('glass_tap');
      showToast('✦ 已恢复阅读与音效默认设置');
    };
    ov.querySelectorAll('[data-pref-auto]').forEach(function (btn) {
      btn.onclick = function () {
        playSfx('glass_tap');
        setPref('autoSpeed', Number(btn.getAttribute('data-pref-auto')));
      };
    });
    ov.querySelectorAll('[data-pref-type]').forEach(function (btn) {
      btn.onclick = function () {
        playSfx('glass_tap');
        setPref('typeSpeed', btn.getAttribute('data-pref-type'));
      };
    });
    var bgmInput = ov.querySelector('#pref-bgm-vol');
    if (bgmInput) {
      bgmInput.oninput = function () {
        setPref('bgmVol', Number(bgmInput.value) / 100);
      };
    }
    var sfxInput = ov.querySelector('#pref-sfx-vol');
    if (sfxInput) {
      sfxInput.oninput = function () {
        setPref('sfxVol', Number(sfxInput.value) / 100);
        playSfxAuditionPing();
      };
    }
    var voiceInput = ov.querySelector('#pref-voice-vol');
    if (voiceInput) {
      voiceInput.oninput = function () {
        setPref('voiceVol', Number(voiceInput.value) / 100);
      };
    }
    var voiceToggleBtn = ov.querySelector('#pref-voice-toggle');
    if (voiceToggleBtn) {
      voiceToggleBtn.onclick = function () {
        playSfx('glass_tap');
        setPref('voiceEnabled', !loadPrefs().voiceEnabled);
      };
    }
    var voiceWaitBtn = ov.querySelector('#pref-voice-autowait');
    if (voiceWaitBtn) {
      voiceWaitBtn.onclick = function () {
        playSfx('glass_tap');
        setPref('voiceAutoWait', !loadPrefs().voiceAutoWait);
      };
    }
    var brightInput = ov.querySelector('#pref-bright');
    if (brightInput) {
      brightInput.oninput = function () {
        setPref('bright', Number(brightInput.value) / 100);
      };
    }
    var fxBtn = ov.querySelector('#pref-fx-toggle');
    if (fxBtn) {
      fxBtn.onclick = function () {
        playSfx('glass_tap');
        setPref('fxEnabled', !loadPrefs().fxEnabled);
      };
    }
    return ov;
  }

  function togglePrefsModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-prefs-modal');
    if (ov && !ov.classList.contains('hidden')) closePrefsModal();
    else openPrefsModal();
  }

  /* =========================================================================
     五、五合一「典藏图鉴馆」（CG 画廊 / BGM 音乐室 / 成就墙 / 信物手札 / 终幕典藏）
     ========================================================================= */
  var CG_GALLERY_CATALOG = [
    {
      id: 'cool_off.png',
      file: 'cool_off.webp',
      title: '午后树荫的冰霜之息',
      vol: '第一卷 · 公爵篇',
      quote: '「姐姐大人是冰系真好……嗯。再来一口？」',
      unlockKey: 'cool_off.png',
      unlockFlags: ['ch_alice_affinity', 'ch_beatrice_day', 'ch_micro', 'ch_academy'],
      unlockChapters: ['s_alice_affinity']
    },
    {
      id: 'reno_story.png',
      file: 'reno_story.webp',
      title: '浪人叔叔的远方奇谈',
      vol: '第一卷 · 公爵篇',
      quote: '「驰弩帝国北边的雪狼，跑起来像一团滚动的雪球！等你去了魔法大学，报我名字就行。」',
      unlockKey: 'reno_story.png',
      unlockFlags: ['ch_reno_arrive', 'ch_academy'],
      unlockChapters: ['s_reno_arrive']
    },
    {
      id: 'parents_battle.jpg',
      file: 'parents_battle.jpg',
      title: '西翼走廊 · 夫妇并肩',
      vol: '第二卷 · 学院篇',
      quote: '「短杖落在掌心，西翼走廊轰然炸开。两个人守住一条线，只为给女儿多争片刻脱身光阴。」',
      unlockKey: 'parents_battle.jpg',
      unlockFlags: ['did_turnpoint'],
      unlockChapters: ['s_turnpoint']
    },
    {
      id: 'beatrice_battle.png',
      file: 'beatrice_battle.webp',
      title: '东翼死路 · 长女立阵',
      vol: '第二卷 · 学院篇',
      quote: '「十七岁的贝阿特丽丝站在仆人通道正中，前封后追，只回头留下一句：我在这里挡一下。」',
      unlockKey: 'beatrice_battle.png',
      unlockFlags: ['did_turnpoint'],
      unlockChapters: ['s_turnpoint']
    },
    {
      id: 'parting.png',
      file: 'parting.webp',
      title: '火光如日 · 姐妹诀别',
      vol: '第二卷 · 学院篇',
      quote: '「听好了，听贝阿特丽丝大人的话。跑得越远越好，然后——找到希尔维亚。」',
      unlockKey: 'parting.png',
      unlockFlags: ['did_turnpoint'],
      unlockChapters: ['s_turnpoint']
    },
    {
      id: 'reno_battle.jpg',
      file: 'reno_battle.jpg',
      title: '十字路口 · 岩廊独守',
      vol: '第二卷 · 学院篇',
      quote: '「石板翘起、碎裂、重组，四条走廊化作坚固迷宫。每多撑一会儿，侄女们便能多跑出一段。」',
      unlockKey: 'reno_battle.jpg',
      unlockFlags: ['did_turnpoint'],
      unlockChapters: ['s_turnpoint']
    },
    {
      id: 'reno_diji.jpg',
      file: 'reno_diji.jpg',
      title: '铁锈余温 · 浪人谢幕',
      vol: '第二卷 · 学院篇',
      quote: '「……贝尔蒙家的私军。他靠着石墙慢慢合上眼，默默数着拖下的光阴——应该够了。」',
      unlockKey: 'reno_diji.jpg',
      unlockFlags: ['did_turnpoint'],
      unlockChapters: ['s_turnpoint']
    },
    {
      id: 'vol3_ash_snow.png',
      file: 'vol3_ash_snow.webp',
      title: '暗渠之外 · 灰烬初雪',
      vol: '第三卷 · 旅途篇',
      quote: '「白雪落满她的长发，白落在白上，分不清哪些是今冬的雪，哪些是她自己。」',
      unlockKey: 'vol3_ash_snow.png',
      unlockFlags: ['ch_words_to_wind'],
      unlockChapters: ['s_words_to_wind']
    },
    {
      id: 'vol3_jikan_parting.png',
      file: 'vol3_jikan_parting.webp',
      fallbackSrc: 'assets/bg/jikan.jpg',
      title: '晨雾霁馆 · 糖面饼与窗影',
      vol: '第三卷 · 旅途篇',
      quote: '「门槛青石上摆着尚有余温的糖面饼，二楼紧闭的糊窗纸后，映着一道安静伫立的少女剪影。」',
      unlockKey: 'vol3_jikan_parting.png',
      unlockFlags: ['ch_distant_wind_1'],
      unlockChapters: ['s_distant_wind_1']
    },
    {
      id: 'vol3_ice_canyon_clash.png',
      file: 'vol3_ice_canyon_clash.webp',
      title: '风雪重逢 · 隔空钢冰',
      vol: '第三卷 · 旅途篇',
      quote: '「菱形钢冰短锥在艾诺肩后半步凭空成形，飞雪掠过衣领，浅蓝眼眸穿过漫天雪沫笔直落来。」',
      unlockKey: 'vol3_ice_canyon_clash.png',
      unlockFlags: ['ch_distant_wind_1', 'ch_leaky_cup'],
      unlockAchs: ['frost_reunion'],
      unlockChapters: ['s_distant_wind_1', 's_leaky_cup']
    }
  ];

  var MEMENTO_CATALOG = [
    {
      id: 'alice_letter',
      name: '爱丽丝的风铃草信笺',
      iconKey: 'letter',
      owner: '爱丽丝 · 学院北侧',
      era: '公爵府与学院岁月',
      salutation: '姐姐大人：',
      body: '学院北侧的风铃草开了。\n我把最安静的一朵夹在信里。\n如果你又忘了按时吃饭，就让这封信替我提醒你。\n等你回来，我想听你讲路上的雪。',
      sign: '爱丽丝',
      note: '淡蓝信纸的折痕被压得极平，夹页间仍残存着一丝清浅的风息与花香。',
      invIds: ['alice_letter'],
      relicIds: ['alice_letter', 'alice_flower_cake'],
      flags: ['alice_letter', 'read_alice_letter', 'ch_words_to_wind', 'ch_academy']
    },
    {
      id: 'aino_handkerchief',
      name: '雪花纹手帕',
      iconKey: 'snowflake',
      owner: '艾诺 · 赫兰雪原',
      era: '学院切磋 / 冰封峡谷',
      salutation: '赫兰雪原 · 赠物纪要',
      body: '边角绣着六瓣浅蓝小雪花的洁白亚麻帕。\n在冰封峡谷的风雪里被随手抛来，接住时仍带着雪后松林般的清冽冷香。',
      sign: '艾诺',
      note: '沾上的细雪融尽之后，帕角依旧挺括干净，连折角都与主人一般利落。',
      invIds: ['aino_handkerchief', 'aino_academy_handkerchief'],
      relicIds: ['aino_handkerchief', 'aino_academy_handkerchief'],
      flags: ['aino_handkerchief', 'ch_distant_wind_1'],
      achs: ['frost_reunion']
    },
    {
      id: 'peilin_note',
      name: '沛霖的药行纸条',
      iconKey: 'tea',
      owner: '沛霖 · 商路药行',
      era: '苏秦商路与北境药线',
      salutation: '苏秦商路 · 药行便笺',
      body: '止血青藓畏热亦畏极寒，封箱须留半指气隙；北行跨过风雪界碑后，白藓膏与暖炭同价。\n若途经北风堡，可持此笺寻随队药师问讯。',
      sign: '药商 沛霖',
      note: '裁得工整的粗纹便笺，纸角带着微苦的干草药与温茶余韵。',
      invIds: ['peilin_note'],
      relicIds: ['peilin_note'],
      flags: ['peilin_note', 'met_peilin', 'ch_north_forest', 'ch_distant_wind_1']
    },
    {
      id: 'belmont_schedule',
      name: '无名巡防抄件',
      iconKey: 'document',
      owner: '未署名 · 冷薄荷茶香',
      era: '学院末夜与暗潮前夕',
      salutation: '未署名 · 换防抄件',
      body: '东门换岗在午夜过半，水渠南闸唯独凌晨三点少一轮巡哨。\n字迹工整如尺量，收笔干脆，通篇未落任何家徽与名姓。',
      sign: '留香：冷薄荷茶',
      note: '抄件叠成方正的四角，连递出警示都带着一贯的体面与傲气。',
      invIds: ['belmont_schedule', 'belmont_challenge'],
      relicIds: ['belmont_schedule', 'belmont_challenge'],
      flags: ['belmont_schedule', 'did_turnpoint']
    },
    {
      id: 'ebony_sword',
      name: '乌木紫穗剑',
      iconKey: 'sword',
      owner: '老霁与霁岚 · 澄岚霁馆',
      era: '第三卷 · 辞行北上',
      salutation: '澄岚霁馆 · 辞行赠剑',
      body: '老霁相伴三十载的百炼凡铁长剑，乌黑木鞘朴素沉稳，剑柄粗布早已浸得温润发亮。\n柄端系着霁岚亲手编织的密实紫色剑穗，与她发间的紫蝴蝶同色。',
      sign: '老霁 · 霁岚',
      note: '「剑留在架子上只会落灰，有人带着它去见见北边的风雪，总比困在小院里强。」',
      invIds: ['ebony_sword'],
      relicIds: ['ebony_sword'],
      flags: ['ebony_sword', 'ch_distant_wind_1']
    },
    {
      id: 'shell_pin',
      name: '月虹螺胸针',
      iconKey: 'shell',
      owner: '三姐妹 · 夏日礁石',
      era: '学院暑假 · 海滨之约',
      salutation: '夏日海滨 · 三姐妹纪念',
      body: '贝阿特丽丝偷偷学了半个夏天的游泳，才陪着妹妹们一齐潜入礁石缝里拾起的月虹螺。\n螺壳内壁泛着海潮退去后的珍珠虹彩，背扣打磨得光滑贴手。',
      sign: '贝阿特丽丝 · 希尔维亚 · 爱丽丝',
      note: '贴近耳畔，仿佛还能听见盛夏海湾的潮声与三姐妹并肩时的笑闹。',
      invIds: ['shell_pin'],
      relicIds: ['shell_pin'],
      flags: ['shell_pin', 'ch_beach'],
      achs: ['shell_gift']
    }
  ];

  var FALLBACK_BOND_ENDINGS = [
    {
      id: 'dawn_reunion',
      badge: '破晓明约',
      accent: 'cobalt',
      title: '凛冬破晓 · 众星同归',
      subtitle: '洞悉暗潮并守住同盟与体面，风雪散后共迎晨光',
      hint: '在学院与旅途中点亮王都暗线拼图，并以平等坦诚维系伙伴同盟。',
      epilogue: '漫长霜夜终于迎来初明。往昔签下的同盟、未署名的警示与并肩之约，在雪融后的长路尽头汇成一片清朗晨空。'
    },
    {
      id: 'twin_winds',
      badge: '双风并翼',
      accent: 'emerald',
      title: '双风并翼 · 远行之誓',
      subtitle: '妹妹学会独自听风，旧友奔赴山海，终在高处重逢',
      hint: '引导爱丽丝独立听风，回应霁岚的塞北剑约，并追寻高天旧风回响。',
      epilogue: '清风掠过澄岚老树，也拂过极北冰原。两道早已走出旧日院墙的身影，在开阔的天穹下重新并肩而立。'
    },
    {
      id: 'sheltered_hearth',
      badge: '霜檐暖灯',
      accent: 'rose',
      title: '霜檐暖灯 · 执手归处',
      subtitle: '紧握碎贝壳与霁馆灯火，替漂泊之人留一处暖炉',
      hint: '珍视咫尺身畔最深的牵挂与霁馆灯火，让远行之人始终有处可归。',
      epilogue: '寒雪落在檐外，屋里炉火温润如初。一碗热粥、一枚碎贝壳手绳与未熄的窗灯，轻声牵引着彼此安然归航。'
    },
    {
      id: 'frost_sovereign',
      badge: '霜冕孤锋',
      accent: 'glacier',
      title: '孤锋霜冕 · 极北独行',
      subtitle: '以严苛试炼与无瑕锋芒自成秩序，凭剑与冰破局',
      hint: '在每次切磋与竞逐中以最凌厉的标准磨砺自我，凭霜锋劈开寒夜。',
      epilogue: '无气泡之冰与乌木铁剑映出清冽星芒。无需借任何庇护，那道银蓝孤影本身便成了风雪中凛然不可撼的秩序。'
    }
  ];

  var ENDING_ROUTE_ACCENTS = {
    dawn_reunion: 'cobalt',
    frost_sovereign: 'glacier',
    twin_winds: 'emerald',
    sheltered_hearth: 'rose',
    unwritten_snow: 'silver'
  };

  var FALLBACK_CAREER_CATALOG = [
    {
      id: 'polar_archmage',
      title: '极北冰晶大魔导师',
      badge: '冰道绝巅',
      seal: '魔导',
      hint: '着重精修魔力适性与高阶冰水魔导术式即可迈向此生涯。'
    },
    {
      id: 'jikan_twin_blade',
      title: '霁馆双剑传人',
      badge: '生根剑心',
      seal: '剑道',
      hint: '钻研体能并在澄岚霁馆修习步法与挥剑即可迈向此生涯。'
    },
    {
      id: 'asla_visiting_scholar',
      title: '阿斯拉魔导客座教授',
      badge: '明晰学理',
      seal: '学理',
      hint: '深耕心智四维并完成多门学院或理论课程进阶即可解锁。'
    },
    {
      id: 'leisurely_heiress',
      title: '悠闲庄园千金',
      badge: '初衷圆满',
      seal: '本心',
      hint: '保持丰沛悠闲度并涵养优雅气质，贯彻悠闲生活初心即可解锁。'
    },
    {
      id: 'wandering_spellblade',
      title: '自由旅途的魔剑士',
      badge: '剑魔双修',
      seal: '行游',
      hint: '兼修体能与魔力适性并踏足远行旅途即可解锁。'
    },
    {
      id: 'quiet_traveler',
      title: '霜雪行旅之人',
      badge: '静水行远',
      seal: '霜旅',
      hint: '随心经历四季流转，自然步入终幕即可收录。'
    }
  ];

  var FALLBACK_COMPANION_ARCS = [
    { charId: 'alice', name: '爱丽丝', leftLabel: '独立思考', rightLabel: '执念依恋' },
    { charId: 'noelle', name: '诺艾儿', leftLabel: '平等同盟', rightLabel: '自尊防线' },
    { charId: 'charlotte', name: '夏洛特', leftLabel: '卸下面具', rightLabel: '骄傲较劲' },
    { charId: 'aino', name: '艾诺', leftLabel: '极北知己', rightLabel: '严苛试炼' },
    { charId: 'jilan', name: '霁岚', leftLabel: '归处暖灯', rightLabel: '并肩远行' }
  ];

  var BGM_MOOD_LABELS = {
    peaceful: '悠然日常 · Peaceful',
    relax: '静谧夜色 · Relaxing',
    cheerful: '明朗欢歌 · Cheerful',
    academy: '魔法学府 · Academy',
    sacred: '星霜圣域 · Sacred',
    emotional: '深情余韵 · Emotional',
    romantic: '月下轻语 · Romantic',
    sad: '风雪离歌 · Melancholic',
    upset: '暗潮骤起 · Upset',
    battle: '交锋决意 · Battle & Tension',
    comedy_medium: '轻快趣景 · Comical (中速)',
    comedy_fast: '喧闹追逐 · Comical (疾速)'
  };

  var BGM_TRACK_TITLES = {
    peaceful1: '银蓝晨光 I',
    peaceful2: '公爵庭院 II',
    relax1: '雪夜壁炉 I',
    relax2: '霜月静思 II',
    cheerful1: '集市晴日 I',
    cheerful2: '三姐妹午后 II',
    academy1: '阿斯拉钟塔 I',
    academy2: '星穹书库 II',
    sacred1: '勇者之赐 I',
    sacred2: '冰晶宫殿 II',
    emotional1: '远行余温',
    romantic: '月虹潮声',
    sad1: '灰烬初雪',
    upset: '黑夜暗涌',
    battle1: '锋刃交错 I',
    battle2: '霜原决意 II',
    comedy_medium: '微服出游曲',
    comedy_fast: '追风小闹剧'
  };

  var BGM_TRACK_SCENES = {
    peaceful1: '日常晴朗 · 公爵府与小镇',
    peaceful2: '庭院午后 · 闲适茶歇与漫步',
    relax1: '雪夜灯火 · 寝室书房与暖炉',
    relax2: '霜月静谧 · 夜色独思与回望',
    cheerful1: '市集明快 · 街巷采买与出游',
    cheerful2: '姐妹欢聚 · 庭园嬉闹与假日',
    academy1: '学府晨钟 · 阿斯拉礼堂与长廊',
    academy2: '书海研习 · 魔导课堂与书库',
    sacred1: '神域回响 · 勇者之赐与星辉',
    sacred2: '极北秘境 · 冰晶宫殿与秘仪',
    emotional1: '羁绊余温 · 心声倾诉与回响',
    romantic: '月色轻柔 · 海滨拾贝与相伴',
    sad1: '风雪别离 · 逃亡夜路与远行',
    upset: '暗潮压境 · 异变突生与戒备',
    battle1: '战场紧迫 · 决斗交锋与危机',
    battle2: '雪原对决 · 凌厉剑锋与死斗',
    comedy_medium: '轻快逸趣 · 微服私访与日常闹剧',
    comedy_fast: '疾步趣追 · 仓皇插曲与连环闹剧'
  };

  var BGM_MOOD_SCENE_FALLBACK = {
    peaceful: '日常晴朗 · 悠闲生活与庭园',
    relax: '夜色静谧 · 休憩与夜谈',
    cheerful: '明朗欢快 · 集市与假日相伴',
    academy: '魔法学府 · 课堂与书库',
    sacred: '神圣秘境 · 礼堂与仪典',
    emotional: '深情回响 · 倾诉与重逢',
    romantic: '柔和微光 · 月下与海风',
    sad: '风雪离歌 · 别离与远行',
    upset: '暗潮骤起 · 戒备与迷局',
    battle: '战场紧迫 · 决斗与危机',
    comedy_medium: '轻快逸趣 · 微服漫游与趣事',
    comedy_fast: '疾步趣追 · 追逐与小闹剧'
  };

  function loadCodexArchive() {
    var empty = { cgs: {}, achs: {}, mementos: {}, endings: {}, endingMeta: {} };
    try {
      var raw = JSON.parse(localStorage.getItem(CODEX_ARCHIVE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        return {
          cgs: (raw.cgs && typeof raw.cgs === 'object') ? raw.cgs : {},
          achs: (raw.achs && typeof raw.achs === 'object') ? raw.achs : {},
          mementos: (raw.mementos && typeof raw.mementos === 'object') ? raw.mementos : {},
          endings: (raw.endings && typeof raw.endings === 'object') ? raw.endings : {},
          endingMeta: (raw.endingMeta && typeof raw.endingMeta === 'object') ? raw.endingMeta : {}
        };
      }
    } catch (e) {}
    return empty;
  }

  function saveCodexArchive(arch) {
    try { localStorage.setItem(CODEX_ARCHIVE_KEY, JSON.stringify(arch)); } catch (e) {}
  }

  function getGlobalCodex() {
    if (root && root.codex && typeof root.codex === 'object') return root.codex;
    if (typeof codex !== 'undefined' && codex && typeof codex === 'object') return codex;
    return null;
  }

  function loadUnlockedCgs() {
    try {
      var raw = JSON.parse(localStorage.getItem(CG_UNLOCKED_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function markCgUnlocked(file) {
    if (!file) return false;
    var map = loadUnlockedCgs();
    if (!map[file]) {
      map[file] = 1;
      try { localStorage.setItem(CG_UNLOCKED_KEY, JSON.stringify(map)); } catch (e) {}
    }
    var arch = loadCodexArchive();
    if (!arch.cgs[file]) {
      arch.cgs[file] = 1;
      saveCodexArchive(arch);
    }
    var gc = getGlobalCodex();
    if (gc) {
      if (!gc.cgs || typeof gc.cgs !== 'object') gc.cgs = {};
      if (!gc.cgs[file]) {
        gc.cgs[file] = true;
        var saveFn = (root && typeof root.saveCodex === 'function')
          ? root.saveCodex
          : (typeof saveCodex === 'function' ? saveCodex : null);
        if (saveFn) { try { saveFn(); } catch (e) {} }
      }
    }
    return true;
  }

  function markEndingUnlocked(endingId, meta) {
    if (!endingId) return false;
    var idStr = String(endingId);
    var arch = loadCodexArchive();
    arch.endings[idStr] = 1;
    if (meta && typeof meta === 'object') {
      arch.endingMeta[idStr] = Object.assign({ unlockedAt: Date.now() }, arch.endingMeta[idStr] || {}, meta);
    } else if (!arch.endingMeta[idStr]) {
      arch.endingMeta[idStr] = { unlockedAt: Date.now() };
    }
    saveCodexArchive(arch);

    try {
      var stored = JSON.parse(localStorage.getItem(ENDINGS_UNLOCKED_KEY) || '{}');
      if (Array.isArray(stored)) {
        if (stored.indexOf(idStr) === -1) stored.push(idStr);
        localStorage.setItem(ENDINGS_UNLOCKED_KEY, JSON.stringify(stored));
      } else {
        if (!stored || typeof stored !== 'object') stored = {};
        stored[idStr] = arch.endingMeta[idStr] || true;
        localStorage.setItem(ENDINGS_UNLOCKED_KEY, JSON.stringify(stored));
      }
    } catch (e) {}
    return true;
  }

  function isMementoUnlockedInState(item, st) {
    if (!item || !st) return false;
    if (Array.isArray(st.inv) && Array.isArray(item.invIds)) {
      for (var i = 0; i < item.invIds.length; i++) {
        var targetId = item.invIds[i];
        if (st.inv.some(function (x) { return x && x.id === targetId; })) return true;
      }
    }
    if (st.relicsUnlocked && Array.isArray(item.relicIds)) {
      for (var j = 0; j < item.relicIds.length; j++) {
        if (st.relicsUnlocked[item.relicIds[j]]) return true;
      }
    }
    if (st.flags && Array.isArray(item.flags)) {
      for (var k = 0; k < item.flags.length; k++) {
        if (st.flags[item.flags[k]]) return true;
      }
    }
    if (st.ach && Array.isArray(item.achs)) {
      for (var m = 0; m < item.achs.length; m++) {
        if (st.ach[item.achs[m]]) return true;
      }
    }
    return false;
  }

  function syncCodexArchiveFromState(targetS) {
    var st = targetS || getS();
    var arch = loadCodexArchive();
    var dirty = false;

    if (st && st.ach && typeof st.ach === 'object') {
      Object.keys(st.ach).forEach(function (aid) {
        if (st.ach[aid] && !arch.achs[aid]) {
          arch.achs[aid] = 1;
          dirty = true;
        }
      });
    }

    if (st && st.unlockedCGs) {
      if (Array.isArray(st.unlockedCGs)) {
        st.unlockedCGs.forEach(function (cgId) {
          if (cgId && !arch.cgs[cgId]) { arch.cgs[cgId] = 1; dirty = true; }
        });
      } else if (typeof st.unlockedCGs === 'object') {
        Object.keys(st.unlockedCGs).forEach(function (cgId) {
          if (st.unlockedCGs[cgId] && !arch.cgs[cgId]) { arch.cgs[cgId] = 1; dirty = true; }
        });
      }
    }

    var gc = getGlobalCodex();
    if (gc && gc.cgs && typeof gc.cgs === 'object') {
      Object.keys(gc.cgs).forEach(function (cgId) {
        if (gc.cgs[cgId] && !arch.cgs[cgId]) { arch.cgs[cgId] = 1; dirty = true; }
      });
    }

    if (st) {
      MEMENTO_CATALOG.forEach(function (item) {
        if (!arch.mementos[item.id] && isMementoUnlockedInState(item, st)) {
          arch.mementos[item.id] = 1;
          dirty = true;
        }
      });
    }

    if (dirty) saveCodexArchive(arch);
    return arch;
  }

  function captureCurrentCgUnlock() {
    if (typeof cgImage !== 'undefined' && cgImage) {
      markCgUnlocked(cgImage);
      return;
    }
    if (typeof document === 'undefined') return;
    var el = document.getElementById('cg-bg');
    if (!el || !el.style || !el.style.backgroundImage) return;
    var m = /assets\/cg\/([^"')]+)/.exec(el.style.backgroundImage);
    if (m && m[1]) markCgUnlocked(m[1]);
  }

  function getCgImageSrc(entry) {
    if (!entry) return '';
    if (entry.assetPending && entry.fallbackSrc) return entry.fallbackSrc;
    return 'assets/cg/' + entry.file;
  }

  function isCgUnlocked(item) {
    if (!item) return false;
    var cgMap = loadUnlockedCgs();
    if (cgMap[item.unlockKey] || cgMap[item.file] || cgMap[item.id]) return true;

    var arch = loadCodexArchive();
    if (arch.cgs[item.unlockKey] || arch.cgs[item.file] || arch.cgs[item.id]) return true;

    var gc = getGlobalCodex();
    if (gc && gc.cgs && (gc.cgs[item.unlockKey] || gc.cgs[item.file] || gc.cgs[item.id])) return true;

    var st = getS();
    if (st && st.unlockedCGs) {
      if (Array.isArray(st.unlockedCGs)) {
        if (st.unlockedCGs.indexOf(item.unlockKey) !== -1 || st.unlockedCGs.indexOf(item.file) !== -1 || st.unlockedCGs.indexOf(item.id) !== -1) {
          return true;
        }
      } else if (typeof st.unlockedCGs === 'object') {
        if (st.unlockedCGs[item.unlockKey] || st.unlockedCGs[item.file] || st.unlockedCGs[item.id]) return true;
      }
    }
    if (st && st.flags && Array.isArray(item.unlockFlags)) {
      for (var i = 0; i < item.unlockFlags.length; i++) {
        if (st.flags[item.unlockFlags[i]]) return true;
      }
    }
    if (st && st.ach && Array.isArray(item.unlockAchs)) {
      for (var j = 0; j < item.unlockAchs.length; j++) {
        if (st.ach[item.unlockAchs[j]]) return true;
      }
    }
    var chMap = loadUnlockedChapters();
    if (Array.isArray(item.unlockChapters)) {
      for (var k = 0; k < item.unlockChapters.length; k++) {
        if (chMap[item.unlockChapters[k]]) return true;
      }
    }
    return false;
  }

  function isAchUnlocked(achId) {
    if (!achId) return false;
    var st = getS();
    if (st && st.ach && st.ach[achId]) return true;
    var arch = loadCodexArchive();
    return !!arch.achs[achId];
  }

  function isMementoUnlocked(item) {
    if (!item) return false;
    var st = getS();
    if (isMementoUnlockedInState(item, st)) return true;
    var arch = loadCodexArchive();
    return !!arch.mementos[item.id];
  }

  function normalizeCatalogEntries(source, fallbackList) {
    if (Array.isArray(source) && source.length) {
      return source.map(function (it, idx) {
        return Object.assign({ id: (it && it.id) || ('item_' + idx) }, it);
      });
    }
    if (source && typeof source === 'object') {
      var keys = Object.keys(source);
      if (keys.length) {
        return keys.map(function (k) {
          var v = source[k];
          return Object.assign({ id: k }, v && typeof v === 'object' ? v : { title: String(v) });
        });
      }
    }
    return fallbackList.slice();
  }

  function readUnlockedEndingsStore() {
    var unlockedMap = {};
    var metaMap = {};
    var replayIdMap = {};

    function absorbEntry(id, metaVal) {
      if (!id) return;
      var key = String(id);
      unlockedMap[key] = true;
      var mObj = (metaVal && typeof metaVal === 'object') ? metaVal : null;
      if (mObj) {
        metaMap[key] = Object.assign({}, metaMap[key] || {}, mObj);
      }
      if (key.indexOf('__') > 0) {
        var parts = key.split('__');
        if (parts[0]) {
          unlockedMap[parts[0]] = true;
          if (!replayIdMap[parts[0]]) replayIdMap[parts[0]] = key;
          if (mObj) metaMap[parts[0]] = Object.assign({}, metaMap[parts[0]] || {}, mObj);
        }
        if (parts[1]) {
          unlockedMap[parts[1]] = true;
          if (!replayIdMap[parts[1]]) replayIdMap[parts[1]] = key;
          if (mObj) metaMap[parts[1]] = Object.assign({}, metaMap[parts[1]] || {}, mObj);
        }
      }
      if (mObj) {
        if (mObj.bondId) {
          unlockedMap[mObj.bondId] = true;
          if (mObj.compositeId && !replayIdMap[mObj.bondId]) replayIdMap[mObj.bondId] = mObj.compositeId;
          metaMap[mObj.bondId] = Object.assign({}, metaMap[mObj.bondId] || {}, mObj);
        }
        if (mObj.careerId) {
          unlockedMap[mObj.careerId] = true;
          if (mObj.compositeId && !replayIdMap[mObj.careerId]) replayIdMap[mObj.careerId] = mObj.compositeId;
          metaMap[mObj.careerId] = Object.assign({}, metaMap[mObj.careerId] || {}, mObj);
        }
      }
    }

    var rh = root && root.RaisingHub ? root.RaisingHub : null;
    if (rh && typeof rh.getUnlockedEndingsArchive === 'function') {
      try {
        var rhArch = rh.getUnlockedEndingsArchive();
        if (rhArch && rhArch.byId && typeof rhArch.byId === 'object') {
          Object.keys(rhArch.byId).forEach(function (cid) {
            absorbEntry(cid, rhArch.byId[cid]);
          });
        }
        if (rhArch && rhArch.unlockedBonds) {
          Object.keys(rhArch.unlockedBonds).forEach(function (bid) {
            if (rhArch.unlockedBonds[bid]) unlockedMap[bid] = true;
          });
        }
        if (rhArch && rhArch.unlockedCareers) {
          Object.keys(rhArch.unlockedCareers).forEach(function (cid) {
            if (rhArch.unlockedCareers[cid]) unlockedMap[cid] = true;
          });
        }
      } catch (e) {}
    }

    var gc = getGlobalCodex();
    if (gc) {
      if (Array.isArray(gc.endings)) {
        gc.endings.forEach(function (eid) { absorbEntry(eid); });
      } else if (gc.endings && typeof gc.endings === 'object') {
        Object.keys(gc.endings).forEach(function (eid) {
          if (gc.endings[eid]) absorbEntry(eid, typeof gc.endings[eid] === 'object' ? gc.endings[eid] : null);
        });
      }
      if (gc.endingMeta && typeof gc.endingMeta === 'object') {
        Object.keys(gc.endingMeta).forEach(function (eid) {
          if (gc.endingMeta[eid]) absorbEntry(eid, gc.endingMeta[eid]);
        });
      }
      if (gc.careers && typeof gc.careers === 'object') {
        if (Array.isArray(gc.careers)) {
          gc.careers.forEach(function (cid) { absorbEntry(cid); });
        } else {
          Object.keys(gc.careers).forEach(function (cid) {
            if (gc.careers[cid]) absorbEntry(cid, typeof gc.careers[cid] === 'object' ? gc.careers[cid] : null);
          });
        }
      }
    }

    var arch = loadCodexArchive();
    Object.keys(arch.endings).forEach(function (eid) {
      if (arch.endings[eid]) absorbEntry(eid, arch.endingMeta[eid]);
    });

    try {
      var stored = JSON.parse(localStorage.getItem(ENDINGS_UNLOCKED_KEY) || 'null');
      if (Array.isArray(stored)) {
        stored.forEach(function (eid) { absorbEntry(eid); });
      } else if (stored && typeof stored === 'object') {
        if (Array.isArray(stored.endings)) {
          stored.endings.forEach(function (eid) { absorbEntry(eid); });
        }
        if (Array.isArray(stored.careers)) {
          stored.careers.forEach(function (cid) { absorbEntry(cid); });
        }
        if (stored.meta && typeof stored.meta === 'object') {
          Object.keys(stored.meta).forEach(function (eid) { absorbEntry(eid, stored.meta[eid]); });
        }
        Object.keys(stored).forEach(function (k) {
          if (k === 'endings' || k === 'careers' || k === 'meta') return;
          if (stored[k]) absorbEntry(k, typeof stored[k] === 'object' ? stored[k] : null);
        });
      }
    } catch (e) {}

    var st = getS();
    if (st && st.unlockedEndings) {
      if (Array.isArray(st.unlockedEndings)) {
        st.unlockedEndings.forEach(function (eid) { absorbEntry(eid); });
      } else if (typeof st.unlockedEndings === 'object') {
        Object.keys(st.unlockedEndings).forEach(function (eid) {
          if (st.unlockedEndings[eid]) absorbEntry(eid, typeof st.unlockedEndings[eid] === 'object' ? st.unlockedEndings[eid] : null);
        });
      }
    }

    return { unlockedMap: unlockedMap, metaMap: metaMap, replayIdMap: replayIdMap };
  }

  function getEndingsSummaryCounts() {
    var rh = root && root.RaisingHub ? root.RaisingHub : null;
    var rawBonds = normalizeCatalogEntries(rh && rh.BOND_ENDING_CATALOG, FALLBACK_BOND_ENDINGS);
    var careerList = normalizeCatalogEntries(rh && rh.CAREER_CATALOG, FALLBACK_CAREER_CATALOG);
    var store = readUnlockedEndingsStore();
    var bondList = rawBonds.filter(function (b) {
      return b.id !== 'unwritten_snow' || !!store.unlockedMap[b.id];
    });
    if (!bondList.length) bondList = FALLBACK_BOND_ENDINGS.slice();
    var bondGot = bondList.filter(function (b) { return !!store.unlockedMap[b.id]; }).length;
    var careerGot = careerList.filter(function (c) { return !!store.unlockedMap[c.id]; }).length;
    return {
      bondList: bondList,
      careerList: careerList,
      store: store,
      bondGot: bondGot,
      careerGot: careerGot,
      unlockedTotal: bondGot + careerGot,
      catalogTotal: bondList.length + careerList.length
    };
  }

  function callBgmPlay(key) {
    var fn = (root && typeof root.bgmPlay === 'function')
      ? root.bgmPlay
      : (typeof bgmPlay === 'function' ? bgmPlay : null);
    if (fn) {
      try { fn(key, { fade: false }); } catch (e) {}
    }
  }

  function callBgmStop() {
    var fn = (root && typeof root.bgmStop === 'function')
      ? root.bgmStop
      : (typeof bgmStop === 'function' ? bgmStop : null);
    if (fn) {
      try { fn(false); } catch (e) {}
      return;
    }
    if (typeof document !== 'undefined') {
      var el = document.getElementById('bgm-audio');
      if (el && typeof el.pause === 'function') {
        try { el.pause(); } catch (e) {}
      }
    }
  }

  function capturePreCodexBgm() {
    if (preCodexBgmSnapshot) return;
    var gs = typeof document !== 'undefined' ? document.getElementById('game-screen') : null;
    var ts = typeof document !== 'undefined' ? document.getElementById('title-screen') : null;
    var bgEl = typeof document !== 'undefined' ? document.getElementById('bg') : null;
    var st = getS();
    preCodexBgmSnapshot = {
      inGame: !!(gs && !gs.classList.contains('hidden')),
      onTitle: !!(ts && !ts.classList.contains('hidden')),
      freeRoam: !!(st && st.freeRoam),
      phase: st ? st.phase : null,
      loc: st ? st.loc : null,
      bgClass: bgEl ? bgEl.className : '',
      sceneId: getCurrentSceneId()
    };
  }

  function restorePreCodexBgm() {
    var snap = preCodexBgmSnapshot;
    preCodexBgmSnapshot = null;
    if (!codexPlayingTrack && !codexAuditionDirty) return;
    codexPlayingTrack = null;
    codexAuditionDirty = false;

    if (!snap || (!snap.inGame && snap.onTitle)) {
      var mutedNow = !!(root && typeof root.isMuted === 'function' && root.isMuted());
      if (!mutedNow && root && typeof root.bgmPlayTitle === 'function') {
        try { root.bgmPlayTitle({ fade: true }); return; } catch (e) {}
      }
      callBgmStop();
      return;
    }

    if (!snap.inGame) {
      callBgmStop();
      return;
    }

    if (root && typeof root.bgmRestoreContext === 'function') {
      try { root.bgmRestoreContext(); return; } catch (e) {}
    }

    callBgmStop();
    var scenes = typeof SCENES !== 'undefined' ? SCENES : (root.SCENES || {});
    var scObj = snap.sceneId && scenes[snap.sceneId] ? scenes[snap.sceneId] : null;
    if (!snap.freeRoam && scObj && scObj.bgm) {
      var playTypeFn = (root && typeof root.bgmPlayType === 'function')
        ? root.bgmPlayType
        : (typeof bgmPlayType === 'function' ? bgmPlayType : null);
      if (playTypeFn) {
        try { playTypeFn(scObj.bgm, { force: true }); return; } catch (e) {}
      }
    }
    var syncFn = (root && typeof root.bgmSyncFromBG === 'function')
      ? root.bgmSyncFromBG
      : (typeof bgmSyncFromBG === 'function' ? bgmSyncFromBG : null);
    if (syncFn && snap.bgClass) {
      try { syncFn(snap.bgClass, snap.phase, snap.loc); return; } catch (e) {}
    }
    var typeFn = (root && typeof root.bgmTypeForBg === 'function')
      ? root.bgmTypeForBg
      : (typeof bgmTypeForBg === 'function' ? bgmTypeForBg : null);
    var ptFn = (root && typeof root.bgmPlayType === 'function')
      ? root.bgmPlayType
      : (typeof bgmPlayType === 'function' ? bgmPlayType : null);
    if (typeFn && ptFn && snap.bgClass) {
      try {
        var t = typeFn(snap.bgClass, snap.phase, snap.loc);
        if (t) ptFn(t, { force: true });
      } catch (e) {}
    }
  }

  function closeCgLightbox() {
    if (typeof document === 'undefined') return;
    var lb = document.getElementById('cg-lightbox');
    if (lb && !lb.classList.contains('hidden')) {
      lb.classList.add('hidden');
      playSfx('modal_close');
    }
  }

  function navigateCgLightbox(delta) {
    if (!lightboxUnlockedList.length || lightboxUnlockedList.length <= 1) return false;
    var len = lightboxUnlockedList.length;
    var nextIdx = (lightboxIndex + delta + len) % len;
    playSfx('page_open');
    openCgLightbox(lightboxUnlockedList[nextIdx], { fromNav: true });
    return true;
  }

  function openCgLightbox(entry, opts) {
    if (typeof document === 'undefined' || !entry) return null;
    var lb = document.getElementById('cg-lightbox');
    if (!lb) {
      lb = document.createElement('section');
      lb.id = 'cg-lightbox';
      lb.className = 'hidden';
      document.body.appendChild(lb);
    }
    var unlocked = CG_GALLERY_CATALOG.filter(isCgUnlocked);
    var idx = unlocked.findIndex(function (c) { return c.id === entry.id; });
    if (idx === -1) {
      unlocked = [entry];
      idx = 0;
    }
    lightboxUnlockedList = unlocked;
    lightboxIndex = idx;

    var primarySrc = getCgImageSrc(entry);
    var fallbackSrc = entry.fallbackSrc || '';
    var canCycle = lightboxUnlockedList.length > 1;
    var counterText = (lightboxIndex + 1) + ' / ' + lightboxUnlockedList.length;
    var pendingBadgeHtml = entry.assetPending
      ? '<span class="cg-pending-badge">实景底图代映</span>'
      : '';

    lb.innerHTML =
      '<button type="button" class="cg-lb-close" id="cg-lb-close" aria-label="关闭大图鉴赏">' + getSvg('close') + '</button>' +
      '<div class="cg-lb-inner">' +
        '<div class="cg-lb-stage">' +
          '<button type="button" class="cg-lb-nav prev" id="cg-lb-prev" aria-label="上一张典藏画作"' + (canCycle ? '' : ' disabled') + '>' + getSvg('chevronLeft') + '</button>' +
          '<div class="cg-lb-frame">' +
            '<img class="cg-lb-img" id="cg-lb-img" src="' + escapeHtml(primarySrc) + '" alt="' + escapeHtml(entry.title) + '"/>' +
          '</div>' +
          '<button type="button" class="cg-lb-nav next" id="cg-lb-next" aria-label="下一张典藏画作"' + (canCycle ? '' : ' disabled') + '>' + getSvg('chevronRight') + '</button>' +
        '</div>' +
        '<div class="cg-lb-caption">' +
          '<div class="cg-lb-meta">' +
            '<span class="cg-lb-vol">' + escapeHtml(entry.vol) + '</span>' +
            '<h3>' + escapeHtml(entry.title) + '</h3>' +
            pendingBadgeHtml +
            '<span class="cg-lb-counter" id="cg-lb-counter">' + escapeHtml(counterText) + '</span>' +
          '</div>' +
          '<p class="cg-lb-quote">' + escapeHtml(entry.quote) + '</p>' +
          '<span class="cg-lb-hint">' + (canCycle ? '点击暗幕或按 Esc 返回画廊 · 方向键 ← → 切换画作' : '点击暗幕或按 Esc 返回画廊') + '</span>' +
        '</div>' +
      '</div>';

    var img = lb.querySelector('#cg-lb-img');
    if (img) {
      img.onerror = function () {
        if (fallbackSrc && !img.getAttribute('data-fb-applied') && img.getAttribute('src') !== fallbackSrc) {
          img.setAttribute('data-fb-applied', '1');
          img.src = fallbackSrc;
        }
      };
    }
    var wasHidden = lb.classList.contains('hidden');
    lb.classList.remove('hidden');
    if (wasHidden && !(opts && opts.fromNav)) playSfx('page_open');

    lb.onclick = function (e) {
      if (e.target === lb || (e.target && e.target.id === 'cg-lb-img')) closeCgLightbox();
    };
    lb.querySelector('#cg-lb-close').onclick = function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      closeCgLightbox();
    };
    var prevBtn = lb.querySelector('#cg-lb-prev');
    if (prevBtn) {
      prevBtn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        navigateCgLightbox(-1);
      };
    }
    var nextBtn = lb.querySelector('#cg-lb-next');
    if (nextBtn) {
      nextBtn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        navigateCgLightbox(1);
      };
    }
    return lb;
  }

  function renderCodexCgTab(container) {
    var unlockedCount = CG_GALLERY_CATALOG.filter(isCgUnlocked).length;
    var cardsHtml = CG_GALLERY_CATALOG.map(function (item) {
      var open = isCgUnlocked(item);
      if (!open) {
        return (
          '<article class="codex-cg-card locked" data-cg-id="' + escapeHtml(item.id) + '">' +
            '<div class="cg-thumb-wrap locked-veil">' +
              '<div class="cg-lock-sigil" aria-hidden="true">' + getSvg('lock') + '</div>' +
              '<div class="cg-lock-label">尚未解锁 · 推进对应章节开启</div>' +
            '</div>' +
            '<div class="cg-card-foot">' +
              '<span class="cg-vol-pill">' + escapeHtml(item.vol) + '</span>' +
              '<div class="cg-card-title">未启封剪影</div>' +
            '</div>' +
          '</article>'
        );
      }
      var src = getCgImageSrc(item);
      var pendingBadge = item.assetPending
        ? '<span class="cg-pending-badge">实景底图代映</span>'
        : '';
      return (
        '<button type="button" class="codex-cg-card unlocked" data-cg-open="' + escapeHtml(item.id) + '">' +
          '<div class="cg-thumb-wrap">' +
            '<img class="cg-thumb-img" src="' + escapeHtml(src) + '" data-fallback="' + escapeHtml(item.fallbackSrc || '') + '" alt="' + escapeHtml(item.title) + '"/>' +
            pendingBadge +
            '<span class="cg-zoom-badge">全屏鉴赏</span>' +
          '</div>' +
          '<div class="cg-card-foot">' +
            '<span class="cg-vol-pill">' + escapeHtml(item.vol) + '</span>' +
            '<div class="cg-card-title">' + escapeHtml(item.title) + '</div>' +
          '</div>' +
        '</button>'
      );
    }).join('');

    container.innerHTML =
      '<div class="codex-section-bar">' +
        '<span class="codex-bar-title"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('star') + '</span><span>已收录典藏 CG <b>' + unlockedCount + ' / ' + CG_GALLERY_CATALOG.length + '</b></span></span>' +
        '<span class="codex-sec-hint">点击已解锁画作开启高清全屏鉴赏</span>' +
      '</div>' +
      '<div class="codex-cg-grid">' + cardsHtml + '</div>';

    container.querySelectorAll('.cg-thumb-img').forEach(function (img) {
      var fb = img.getAttribute('data-fallback');
      img.onerror = function () {
        if (fb && !img.getAttribute('data-fb-applied') && img.getAttribute('src') !== fb) {
          img.setAttribute('data-fb-applied', '1');
          img.src = fb;
        }
      };
    });
    container.querySelectorAll('[data-cg-open]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-cg-open');
        var found = CG_GALLERY_CATALOG.find(function (c) { return c.id === id; });
        if (found) openCgLightbox(found);
      };
    });
  }

  function getTrackTitle(key, filesMap) {
    if (BGM_TRACK_TITLES[key]) return BGM_TRACK_TITLES[key];
    var f = filesMap && filesMap[key] ? String(filesMap[key]) : key;
    return f.replace(/^Music\//i, '').replace(/\.mp3$/i, '');
  }

  function getTrackSceneTag(key, groupKey) {
    if (BGM_TRACK_SCENES[key]) return BGM_TRACK_SCENES[key];
    if (groupKey && BGM_MOOD_SCENE_FALLBACK[groupKey]) return BGM_MOOD_SCENE_FALLBACK[groupKey];
    return '典藏乐章 · 原声配乐';
  }

  function padTrackNum(n) {
    var v = Number(n) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function renderCodexBgmTab(container) {
    var groups = (root && root.BGM_GROUPS) || (typeof BGM_GROUPS !== 'undefined' ? BGM_GROUPS : {});
    var files = (root && root.BGM_FILES) || (typeof BGM_FILES !== 'undefined' ? BGM_FILES : {});
    var groupKeys = Object.keys(groups);
    var flatTracks = [];
    groupKeys.forEach(function (g) {
      if (Array.isArray(groups[g])) {
        groups[g].forEach(function (tk) { flatTracks.push(tk); });
      }
    });
    var totalTracks = flatTracks.length;
    var activeIdx = codexPlayingTrack ? flatTracks.indexOf(codexPlayingTrack) : -1;
    var idxBadgeText = (activeIdx >= 0 ? padTrackNum(activeIdx + 1) : '--') + ' / ' + padTrackNum(totalTracks);

    var activeTitle = codexPlayingTrack ? getTrackTitle(codexPlayingTrack, files) : '未在试听 · 请点选曲目';
    var waveHtml =
      '<span class="bgm-wave' + (codexPlayingTrack ? ' playing' : '') + '" aria-hidden="true">' +
        '<i></i><i></i><i></i><i></i><i></i>' +
      '</span>';

    var groupsHtml = groupKeys.map(function (gk) {
      var tracks = Array.isArray(groups[gk]) ? groups[gk] : [];
      var rows = tracks.map(function (tk) {
        var playing = codexPlayingTrack === tk;
        var title = getTrackTitle(tk, files);
        var sceneLabel = getTrackSceneTag(tk, gk);
        return (
          '<div class="bgm-track-row' + (playing ? ' active' : '') + '" data-bgm-row="' + escapeHtml(tk) + '">' +
            '<button type="button" class="bgm-play-btn" data-bgm-key="' + escapeHtml(tk) + '">' +
              '<span class="bgm-play-ico" aria-hidden="true">' + (playing ? getSvg('stop') : getSvg('play')) + '</span>' +
              '<span>' + (playing ? '停止' : '播放') + '</span>' +
            '</button>' +
            '<div class="bgm-track-meta">' +
              '<span class="bgm-track-title">' + escapeHtml(title) + '</span>' +
              '<span class="bgm-track-sub">' + escapeHtml(sceneLabel) + '</span>' +
            '</div>' +
            '<span class="bgm-wave' + (playing ? ' playing' : '') + '" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="bgm-room-group">' +
          '<div class="bgm-group-head">' + escapeHtml(BGM_MOOD_LABELS[gk] || gk) + '</div>' +
          '<div class="bgm-group-list">' + rows + '</div>' +
        '</div>'
      );
    }).join('');

    container.innerHTML =
      '<div class="bgm-now-bar">' +
        '<div class="bgm-now-left">' +
          waveHtml +
          '<div class="bgm-now-text">' +
            '<span class="bgm-now-kicker">原声音乐室 · 全曲目 ' + totalTracks + ' 首</span>' +
            '<b id="bgm-now-title">' + escapeHtml(activeTitle) + '</b>' +
          '</div>' +
        '</div>' +
        '<div class="bgm-now-actions">' +
          '<span class="bgm-track-idx' + (activeIdx >= 0 ? ' is-playing' : '') + '" id="bgm-now-index" aria-label="当前曲目序号">' + escapeHtml(idxBadgeText) + '</span>' +
          '<button type="button" class="sl-btn is-compact" id="bgm-room-stop"' + (codexPlayingTrack ? '' : ' disabled') + '>停止试听</button>' +
        '</div>' +
      '</div>' +
      '<div class="bgm-groups-wrap">' + (groupsHtml || '<p class="vb-empty">尚未载入原声曲目目录。</p>') + '</div>';

    var stopBtn = container.querySelector('#bgm-room-stop');
    if (stopBtn) {
      stopBtn.onclick = function () {
        codexPlayingTrack = null;
        codexAuditionDirty = true;
        callBgmStop();
        playSfx('glass_tap');
        renderCodexBgmTab(container);
      };
    }
    container.querySelectorAll('[data-bgm-key]').forEach(function (btn) {
      btn.onclick = function () {
        var key = btn.getAttribute('data-bgm-key');
        codexAuditionDirty = true;
        if (codexPlayingTrack === key) {
          codexPlayingTrack = null;
          callBgmStop();
        } else {
          codexPlayingTrack = key;
          callBgmPlay(key);
        }
        playSfx('glass_tap');
        renderCodexBgmTab(container);
      };
    });
  }

  function renderCodexAchTab(container) {
    var achList = (root && Array.isArray(root.ACH) && root.ACH)
      || (typeof ACH !== 'undefined' && Array.isArray(ACH) ? ACH : []);
    var doneCount = achList.filter(function (a) { return a && isAchUnlocked(a.id); }).length;
    var pct = achList.length ? Math.round((doneCount / achList.length) * 100) : 0;

    var cardsHtml = achList.map(function (a) {
      var got = isAchUnlocked(a.id);
      var isSecret = !got && /^egg_/.test(a.id);
      return (
        '<article class="ach-card' + (got ? ' unlocked' : ' locked') + '">' +
          '<div class="ach-card-top">' +
            '<span class="ach-badge" aria-hidden="true">' + (got ? getSvg('star') : getSvg('lock')) + '</span>' +
            '<b>' + escapeHtml(got ? a.name : (isSecret ? '隐秘彩蛋 · ???' : a.name)) + '</b>' +
            (got && a.reward ? '<span class="ach-reward-pill">' + escapeHtml(a.reward) + '</span>' : '') +
          '</div>' +
          '<p class="ach-desc">' + escapeHtml(got ? a.desc : (isSecret ? '隐藏在角落里的细碎回响，静待有心人发掘。' : '尚未达成 · 继续旅途即可开启。')) + '</p>' +
        '</article>'
      );
    }).join('');

    container.innerHTML =
      '<div class="ach-progress-wrap">' +
        '<div class="ach-progress-head">' +
          '<span class="codex-bar-title"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('star') + '</span><span>成就收集进度：<b>已达成 ' + doneCount + ' / ' + achList.length + '</b></span></span>' +
          '<span class="ach-progress-pct">' + pct + '%</span>' +
        '</div>' +
        '<div class="ach-progress-bar"><i class="ach-progress-fill" style="width:' + pct + '%"></i></div>' +
      '</div>' +
      '<div class="ach-grid">' + (cardsHtml || '<p class="vb-empty">暂无成就数据。</p>') + '</div>';
  }

  function renderCodexMementoTab(container) {
    var openCount = MEMENTO_CATALOG.filter(isMementoUnlocked).length;
    var cardsHtml = MEMENTO_CATALOG.map(function (m) {
      var open = isMementoUnlocked(m);
      var expanded = open && codexExpandedMemento === m.id;
      if (!open) {
        return (
          '<article class="memento-card locked" data-memento-id="' + escapeHtml(m.id) + '">' +
            '<div class="memento-head">' +
              '<span class="memento-ico" aria-hidden="true">' + getSvg('lock') + '</span>' +
              '<div class="memento-titles">' +
                '<div class="memento-name">未启封信物</div>' +
                '<div class="memento-owner">' + escapeHtml(m.era) + '</div>' +
              '</div>' +
              '<span class="memento-pill">尚未收录</span>' +
            '</div>' +
            '<p class="memento-lock-hint">推进对应章节或收集关键物件后，便可在此展阅手札真迹。</p>' +
          '</article>'
        );
      }
      var stationeryHtml = expanded
        ? '<div class="memento-stationery">' +
            '<div class="ms-crest" aria-hidden="true">' + getSvg('snowflake') + '</div>' +
            '<div class="ms-salutation">' + escapeHtml(m.salutation) + '</div>' +
            '<div class="ms-body">' + escapeHtml(m.body).replace(/\n/g, '<br>') + '</div>' +
            '<div class="ms-sign">—— ' + escapeHtml(m.sign) + '</div>' +
            '<div class="ms-note">' + escapeHtml(m.note) + '</div>' +
          '</div>'
        : '';
      return (
        '<article class="memento-card unlocked' + (expanded ? ' expanded' : '') + '" data-memento-id="' + escapeHtml(m.id) + '">' +
          '<button type="button" class="memento-toggle-btn" data-memento-open="' + escapeHtml(m.id) + '">' +
            '<span class="memento-ico" aria-hidden="true">' + getSvg(m.iconKey) + '</span>' +
            '<div class="memento-titles">' +
              '<div class="memento-name">' + escapeHtml(m.name) + '</div>' +
              '<div class="memento-owner">' + escapeHtml(m.owner) + ' · ' + escapeHtml(m.era) + '</div>' +
            '</div>' +
            '<span class="memento-pill open"><span>' + (expanded ? '收起手札' : '展阅信笺') + '</span><span class="memento-chev" aria-hidden="true">' + (expanded ? getSvg('chevronUp') : getSvg('chevronDown')) + '</span></span>' +
          '</button>' +
          stationeryHtml +
        '</article>'
      );
    }).join('');

    container.innerHTML =
      '<div class="codex-section-bar">' +
        '<span class="codex-bar-title"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('letter') + '</span><span>已收录旅途信物 <b>' + openCount + ' / ' + MEMENTO_CATALOG.length + '</b></span></span>' +
        '<span class="codex-sec-hint">点击已获得信物，展开典藏信笺卡片细读原文</span>' +
      '</div>' +
      '<div class="memento-grid">' + cardsHtml + '</div>';

    container.querySelectorAll('[data-memento-open]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-memento-open');
        codexExpandedMemento = (codexExpandedMemento === id) ? null : id;
        playSfx('letter_fold');
        renderCodexMementoTab(container);
      };
    });
  }

  function renderCodexEndingsTab(container) {
    var st = getS();
    var rh = root && root.RaisingHub ? root.RaisingHub : null;
    var bd = root && root.BranchingDirector ? root.BranchingDirector : null;
    var summary = getEndingsSummaryCounts();

    var tendency = null;
    if (bd && typeof bd.getEndingTendency === 'function') {
      try { tendency = bd.getEndingTendency(st); } catch (e) {}
    }
    if (!tendency) {
      tendency = {
        id: 'unwritten_snow',
        badge: '静水初雪',
        title: '初雪未落 · 静水待明',
        subtitle: '星轨尚在蓄势，因果之弦待你落笔',
        summary: '各条关系双轴与暗线拼图仍处于初始平衡。在学院与旅途中做出的每次回应，都会拨动远方终局的指针。',
        confidence: 18,
        unlockedClues: 0,
        totalAxisPoints: 0
      };
    }

    var evalResult = null;
    if (rh && typeof rh.evaluateEnding === 'function') {
      try { evalResult = rh.evaluateEnding(st); } catch (e) {}
    }
    var projectedCareerTitle = '';
    if (evalResult) {
      if (evalResult.career && evalResult.career.title) projectedCareerTitle = evalResult.career.title;
      else if (evalResult.careerTitle) projectedCareerTitle = evalResult.careerTitle;
    }

    var confPct = Math.max(8, Math.min(100, Number(tendency.confidence) || 18));
    var bannerHtml =
      '<section class="ending-tendency-banner" aria-label="当前星轨收束趋向">' +
        '<div class="etb-head">' +
          '<span class="etb-badge"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('star') + '</span><span>当前星轨收束趋向 · ' + escapeHtml(tendency.badge || '静水初雪') + '</span></span>' +
          '<div class="etb-head-right">' +
            (projectedCareerTitle ? '<span class="etb-career-proj">预计称号 · ' + escapeHtml(projectedCareerTitle) + '</span>' : '') +
            '<span class="etb-confidence">收束度 ' + confPct + '%</span>' +
          '</div>' +
        '</div>' +
        '<h3 class="etb-title">' + escapeHtml(tendency.title || '初雪未落 · 静水待明') + '</h3>' +
        '<p class="etb-sub">' + escapeHtml(tendency.subtitle || '') + '</p>' +
        '<p class="etb-summary">' + escapeHtml(tendency.summary || '') + '</p>' +
        '<div class="etb-meter-track"><i class="etb-meter-fill" style="width:' + confPct + '%"></i></div>' +
        '<div class="etb-meta-row">' +
          '<span class="etb-meta-pill">已点亮暗线拼图 ' + (tendency.unlockedClues || 0) + ' / 4</span>' +
          '<span class="etb-meta-pill">已积累因果权重 ' + (tendency.totalAxisPoints || 0) + '</span>' +
          '<span class="etb-meta-pill">已收录终幕 ' + summary.bondGot + ' / ' + summary.bondList.length + ' · 称号 ' + summary.careerGot + ' / ' + summary.careerList.length + '</span>' +
        '</div>' +
      '</section>';

    var bondCardsHtml = summary.bondList.map(function (b) {
      var unlocked = !!summary.store.unlockedMap[b.id];
      var meta = summary.store.metaMap[b.id] || null;
      var badgeText = b.badge || b.tag || '星轨终幕';
      var hintText = b.unlockHint || b.hint || '在旅途关键抉择与伙伴羁绊中收束此条星轨。';
      var routeAccent = b.accent || ENDING_ROUTE_ACCENTS[b.id] || 'cobalt';
      if (!unlocked) {
        return (
          '<article class="ending-bond-card locked" data-ending-id="' + escapeHtml(b.id) + '" data-route-accent="' + escapeHtml(routeAccent) + '">' +
            '<div class="ebc-top">' +
              '<span class="ebc-ico" aria-hidden="true">' + getSvg('lock') + '<i class="ebc-seal-dot" aria-hidden="true"></i></span>' +
              '<div class="ebc-titles">' +
                '<span class="ebc-badge"><i class="ebc-accent-dot" aria-hidden="true"></i><span>' + escapeHtml(badgeText) + '</span></span>' +
                '<h4 class="ebc-title">未启封终幕剪影</h4>' +
              '</div>' +
              '<span class="ebc-status-pill">未抵达</span>' +
            '</div>' +
            '<p class="ebc-hint">' + escapeHtml(hintText) + '</p>' +
          '</article>'
        );
      }
      var expanded = codexExpandedEnding === b.id;
      var tsLabel = (meta && meta.unlockedAt) ? ('收录于 ' + formatTimestamp(meta.unlockedAt)) : '已收入星轨典藏';
      var epilogueText = (meta && meta.epilogue) || b.epilogue || b.summary || b.subtitle || '';
      var epilogueBox = expanded && epilogueText
        ? '<div class="ebc-epilogue-box"><p>' + escapeHtml(epilogueText).replace(/\n/g, '<br>') + '</p></div>'
        : '';
      return (
        '<article class="ending-bond-card unlocked' + (expanded ? ' expanded' : '') + '" data-ending-id="' + escapeHtml(b.id) + '" data-route-accent="' + escapeHtml(routeAccent) + '">' +
          '<div class="ebc-top">' +
            '<span class="ebc-ico" aria-hidden="true">' + getSvg('star') + '</span>' +
            '<div class="ebc-titles">' +
              '<span class="ebc-badge"><i class="ebc-accent-dot" aria-hidden="true"></i><span>' + escapeHtml(badgeText) + '</span></span>' +
              '<h4 class="ebc-title">' + escapeHtml(b.title || b.name || b.id) + '</h4>' +
            '</div>' +
            '<span class="ebc-status-pill open">已达成</span>' +
          '</div>' +
          '<p class="ebc-sub">' + escapeHtml(b.subtitle || b.summary || '') + '</p>' +
          epilogueBox +
          '<div class="ebc-foot">' +
            '<span class="ebc-time">' + escapeHtml(tsLabel) + '</span>' +
            '<button type="button" class="ending-replay-btn" data-replay-ending="' + escapeHtml(b.id) + '">重温终幕</button>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    var careerStampsHtml = summary.careerList.map(function (c) {
      var unlocked = !!summary.store.unlockedMap[c.id];
      var sealText = c.seal || c.badge || (c.title ? String(c.title).slice(0, 2) : '印');
      var hintText = c.unlockHint || c.hint || c.desc || '持续磨砺对应养成方向以铭刻此称号。';
      return (
        '<article class="ending-career-stamp' + (unlocked ? ' unlocked' : ' locked') + '" data-career-id="' + escapeHtml(c.id) + '">' +
          '<div class="ecs-seal" aria-hidden="true">' + (unlocked ? escapeHtml(sealText) : getSvg('lock')) + '</div>' +
          '<div class="ecs-body">' +
            '<div class="ecs-title">' + escapeHtml(unlocked ? (c.title || c.name || c.id) : '未镌刻称号') + '</div>' +
            '<div class="ecs-hint">' + escapeHtml(unlocked ? (c.desc || c.subtitle || hintText) : hintText) + '</div>' +
            '<span class="ecs-status">' + (unlocked ? '<span class="vn-inline-ico" aria-hidden="true">' + getSvg('star') + '</span><span>已获印章</span>' : '待解锁') + '</span>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    var arcItems = [];
    if (bd && bd.AXIS_META && typeof bd.getAxisSummary === 'function') {
      Object.keys(bd.AXIS_META).forEach(function (cid) {
        try {
          var s = bd.getAxisSummary(cid, st);
          if (s) arcItems.push(s);
        } catch (e) {}
      });
    }
    if (!arcItems.length) {
      arcItems = FALLBACK_COMPANION_ARCS.map(function (a) {
        return {
          charId: a.charId,
          name: a.name,
          leftLabel: a.leftLabel,
          rightLabel: a.rightLabel,
          leftVal: 0,
          rightVal: 0,
          ratio: 50,
          dominantLabel: '静水未分'
        };
      });
    }

    var arcsHtml = arcItems.map(function (arc) {
      var ratio = Math.max(4, Math.min(96, Number(arc.ratio) || 50));
      return (
        '<div class="ending-arc-card" data-arc-char="' + escapeHtml(arc.charId) + '">' +
          '<div class="eac-head">' +
            '<span class="eac-name">' + escapeHtml(arc.name) + '</span>' +
            '<span class="eac-dominant">' + escapeHtml(arc.dominantLabel || '静水未分') + '</span>' +
          '</div>' +
          '<div class="eac-poles">' +
            '<span class="eac-pole-left">' + escapeHtml(arc.leftLabel) + ' <em>' + (arc.leftVal || 0) + '</em></span>' +
            '<span class="eac-pole-right"><em>' + (arc.rightVal || 0) + '</em> ' + escapeHtml(arc.rightLabel) + '</span>' +
          '</div>' +
          '<div class="eac-bar">' +
            '<span class="eac-bar-fill" style="width:' + ratio + '%"></span>' +
            '<i class="eac-bar-marker" style="left:' + ratio + '%"></i>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    container.innerHTML =
      '<div class="endings-album">' +
        bannerHtml +
        '<div class="codex-sub-head">' +
          '<span class="codex-sub-title"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('star') + '</span><span>核心羁绊终幕</span></span>' +
          '<em class="codex-sub-count">' + summary.bondGot + ' / ' + summary.bondList.length + '</em>' +
        '</div>' +
        '<div class="ending-bond-grid">' + bondCardsHtml + '</div>' +
        '<div class="codex-sub-head">' +
          '<span class="codex-sub-title"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('crown') + '</span><span>旅途称号印章</span></span>' +
          '<em class="codex-sub-count">' + summary.careerGot + ' / ' + summary.careerList.length + '</em>' +
        '</div>' +
        '<div class="ending-career-grid">' + careerStampsHtml + '</div>' +
        '<div class="codex-sub-head">' +
          '<span class="codex-sub-title"><span class="vn-inline-ico" aria-hidden="true">' + getSvg('compass') + '</span><span>五位伙伴双轴脉络</span></span>' +
          '<em class="codex-sub-count">5 条星轨</em>' +
        '</div>' +
        '<div class="ending-arcs-strip"><div class="ending-arcs-grid">' + arcsHtml + '</div></div>' +
      '</div>';

    container.querySelectorAll('[data-replay-ending]').forEach(function (btn) {
      btn.onclick = function () {
        var eid = btn.getAttribute('data-replay-ending');
        var replayTarget = (summary.store.replayIdMap && summary.store.replayIdMap[eid]) || eid;
        var liveRh = root && root.RaisingHub ? root.RaisingHub : null;
        if (liveRh && typeof liveRh.showEndingScreen === 'function') {
          playSfx('page_open');
          try {
            liveRh.showEndingScreen(String(replayTarget), { previewOnly: true });
            return;
          } catch (e) {}
        }
        codexExpandedEnding = (codexExpandedEnding === eid) ? null : eid;
        playSfx('letter_fold');
        renderCodexEndingsTab(container);
      };
    });
  }

  function closeCodexGallery() {
    if (typeof document === 'undefined') return;
    closeCgLightbox();
    restorePreCodexBgm();
    var codexEl = document.getElementById('codex');
    var wasOpen = !!(codexEl && !codexEl.classList.contains('hidden'));
    if (codexEl) {
      if (typeof show === 'function') show('codex', 0);
      else codexEl.classList.add('hidden');
    }
    if (wasOpen) playSfx('modal_close');
    resumeAutoIfActive();
  }

  function openCodexGallery(tab) {
    if (typeof document === 'undefined') return null;
    var codexEl = document.getElementById('codex');
    if (!codexEl) return null;
    var wasHidden = codexEl.classList.contains('hidden');
    if (wasHidden) {
      capturePreCodexBgm();
    }
    syncCodexArchiveFromState();

    var validTabs = ['cg', 'bgm', 'ach', 'memento', 'endings'];
    codexCurrentTab = validTabs.indexOf(tab) !== -1 ? tab : 'cg';

    var h2 = codexEl.querySelector('.modal-head h2');
    if (h2) h2.textContent = '典藏图鉴馆';

    var tabsEl = document.getElementById('codex-tabs');
    var listEl = document.getElementById('codex-list');
    if (!tabsEl || !listEl) return codexEl;

    var cgCount = CG_GALLERY_CATALOG.filter(isCgUnlocked).length;
    var achList = (root && Array.isArray(root.ACH) && root.ACH)
      || (typeof ACH !== 'undefined' && Array.isArray(ACH) ? ACH : []);
    var achCount = achList.filter(function (a) { return a && isAchUnlocked(a.id); }).length;
    var memCount = MEMENTO_CATALOG.filter(isMementoUnlocked).length;
    var filesMap = (root && root.BGM_FILES) || (typeof BGM_FILES !== 'undefined' ? BGM_FILES : {});
    var bgmTotal = Object.keys(filesMap).length;
    var endSummary = getEndingsSummaryCounts();

    var tabDefs = [
      { id: 'cg', label: 'CG 画廊', badge: cgCount + '/' + CG_GALLERY_CATALOG.length },
      { id: 'bgm', label: 'BGM 音乐室', badge: String(bgmTotal) },
      { id: 'ach', label: '成就墙', badge: achCount + '/' + achList.length },
      { id: 'memento', label: '信物手札', badge: memCount + '/' + MEMENTO_CATALOG.length },
      { id: 'endings', label: '终幕典藏', badge: endSummary.unlockedTotal + '/' + endSummary.catalogTotal }
    ];

    tabsEl.innerHTML = tabDefs.map(function (t) {
      return (
        '<button type="button" class="ptab codex-tab-btn' + (codexCurrentTab === t.id ? ' on' : '') + '" data-codex-tab="' + t.id + '">' +
          '<span>' + escapeHtml(t.label) + '</span>' +
          '<em class="codex-tab-count">' + escapeHtml(t.badge) + '</em>' +
        '</button>'
      );
    }).join('');

    tabsEl.querySelectorAll('[data-codex-tab]').forEach(function (btn) {
      btn.onclick = function () {
        playSfx('tab_switch');
        openCodexGallery(btn.getAttribute('data-codex-tab'));
      };
    });

    if (codexCurrentTab === 'cg') renderCodexCgTab(listEl);
    else if (codexCurrentTab === 'bgm') renderCodexBgmTab(listEl);
    else if (codexCurrentTab === 'ach') renderCodexAchTab(listEl);
    else if (codexCurrentTab === 'endings') renderCodexEndingsTab(listEl);
    else renderCodexMementoTab(listEl);

    var modalShell = codexEl.querySelector('.modal-shell');
    var scrollEl = codexEl.querySelector('.modal-scroll');
    if (scrollEl) {
      scrollEl.classList.add('codex-scroll');
      scrollEl.scrollTop = 0;
    }
    if (modalShell && scrollEl) {
      var fadeEl = modalShell.querySelector('.codex-scroll-fade');
      if (!fadeEl) {
        fadeEl = document.createElement('div');
        fadeEl.className = 'codex-scroll-fade';
        fadeEl.setAttribute('aria-hidden', 'true');
        modalShell.appendChild(fadeEl);
      }
      var syncCodexFade = function () {
        var hasOverflow = scrollEl.scrollHeight - scrollEl.clientHeight > 10;
        var atEnd = !hasOverflow || (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 8);
        fadeEl.classList.toggle('is-end', atEnd);
      };
      if (!scrollEl.__codexFadeBound) {
        scrollEl.__codexFadeBound = true;
        scrollEl.addEventListener('scroll', function () {
          var liveFade = modalShell.querySelector('.codex-scroll-fade');
          if (!liveFade) return;
          var hasOv = scrollEl.scrollHeight - scrollEl.clientHeight > 10;
          var endNow = !hasOv || (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 8);
          liveFade.classList.toggle('is-end', endNow);
        }, { passive: true });
      }
      syncCodexFade();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(syncCodexFade);
      }
    }

    codexEl.onclick = function (e) {
      if (e.target === codexEl) closeCodexGallery();
    };
    var closeX = codexEl.querySelector('.modal-close-x');
    if (closeX) closeX.onclick = closeCodexGallery;
    var closeBtn = document.getElementById('btn-codex-close');
    if (closeBtn) closeBtn.onclick = closeCodexGallery;

    if (typeof show === 'function') show('codex', 1);
    else codexEl.classList.remove('hidden');
    if (modalShell && scrollEl) {
      var postFade = modalShell.querySelector('.codex-scroll-fade');
      if (postFade) {
        var syncPost = function () {
          var hasOv = scrollEl.scrollHeight - scrollEl.clientHeight > 10;
          var endNow = !hasOv || (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 8);
          postFade.classList.toggle('is-end', endNow);
        };
        syncPost();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncPost);
      }
    }
    if (wasHidden) playSfx('modal_open');
    return codexEl;
  }

  /* =========================================================================
     六、UI 按钮挂载（含标题页对齐与对话框阅读栏）与捕获阶段快捷键绑定
     ========================================================================= */
  function ensureVNUIButtons() {
    if (typeof document === 'undefined') return;

    var SVG_SAVE = '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3h8.5L15 5.5V15H4V3z"/><path d="M6.2 3v4h5.2V3"/><rect x="6.2" y="10.2" width="5.6" height="4.8"/></svg>';
    var SVG_CHAP = '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3.2h8v12l-4-2.8-4 2.8v-12z"/></svg>';
    var SVG_LOG = '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3" width="11" height="12" rx="1.6"/><line x1="6.2" y1="6.8" x2="11.8" y2="6.8"/><line x1="6.2" y1="9.6" x2="11.8" y2="9.6"/><line x1="6.2" y1="12.4" x2="9.6" y2="12.4"/></svg>';
    var SVG_SAVE_TITLE = '<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3.5h9L16.5 6.5V16.5h-12v-13z"/><path d="M7 3.5v4.5h5.8V3.5"/><rect x="7" y="11.2" width="6" height="5.3"/></svg>';
    var SVG_CHAP_TITLE = '<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 3.5h9v13l-4.5-3-4.5 3v-13z"/></svg>';
    var SVG_GEAR = '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="2.6"/><path d="M9 2.6v1.6M9 13.8v1.6M2.6 9h1.6M13.8 9h1.6M4.5 4.5l1.1 1.1M12.4 12.4l1.1 1.1M13.5 4.5l-1.1 1.1M5.6 12.4l-1.1 1.1"/></svg>';

    var hudRight = document.querySelector('#hud .hud-right');
    if (hudRight) {
      if (!document.getElementById('btn-backlog')) {
        var bLog = document.createElement('button');
        bLog.id = 'btn-backlog';
        bLog.className = 'chip chip-vn';
        bLog.title = '对话回看 (L)';
        bLog.setAttribute('aria-label', '对话回看');
        bLog.innerHTML = SVG_LOG;
        bLog.onclick = function () { toggleBacklogModal(); };
        hudRight.insertBefore(bLog, document.getElementById('btn-ui') || hudRight.firstChild);
      } else {
        var existingLog = document.getElementById('btn-backlog');
        existingLog.setAttribute('aria-label', '对话回看');
        if (existingLog.classList.contains('tb-backlog-btn')) {
          existingLog.innerHTML = SVG_LOG + '<span>回看</span><kbd class="vn-key-hint">L</kbd>';
        }
        existingLog.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          toggleBacklogModal();
        };
      }
      var existingSl = document.getElementById('btn-saveload');
      if (!existingSl) {
        var bSl = document.createElement('button');
        bSl.id = 'btn-saveload';
        bSl.className = 'chip chip-vn';
        bSl.title = '存档 / 读档（6槽位）';
        bSl.setAttribute('aria-label', '存档读档');
        bSl.innerHTML = SVG_SAVE;
        bSl.onclick = function () { openSaveLoadModal('save'); };
        hudRight.insertBefore(bSl, document.getElementById('btn-ui') || hudRight.firstChild);
      } else {
        existingSl.setAttribute('aria-label', '存档读档');
      }
      var existingCh = document.getElementById('btn-chapters');
      if (!existingCh) {
        var bCh = document.createElement('button');
        bCh.id = 'btn-chapters';
        bCh.className = 'chip chip-vn';
        bCh.title = '章节速览与快速试玩';
        bCh.setAttribute('aria-label', '章节速览');
        bCh.innerHTML = SVG_CHAP;
        bCh.onclick = function () { openChaptersModal(); };
        hudRight.insertBefore(bCh, document.getElementById('btn-ui') || hudRight.firstChild);
      } else {
        existingCh.setAttribute('aria-label', '章节速览');
      }
    }

    var tb = document.getElementById('text-box');
    if (tb) {
      if (!document.getElementById('tb-backlog-btn') && !tb.querySelector('#btn-backlog')) {
        var tbBtn = document.createElement('button');
        tbBtn.type = 'button';
        tbBtn.id = 'tb-backlog-btn';
        tbBtn.className = 'tb-backlog-btn';
        tbBtn.title = '对话历史回看 (L)';
        tbBtn.setAttribute('aria-label', '对话回看');
        tbBtn.innerHTML = SVG_LOG + '<span>回看</span><kbd class="vn-key-hint">L</kbd>';
        tbBtn.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          openBacklogModal();
        };
        tb.appendChild(tbBtn);
      }

      if (!document.getElementById('vn-read-controls')) {
        var ctrlWrap = document.createElement('div');
        ctrlWrap.id = 'vn-read-controls';
        ctrlWrap.className = 'vn-read-controls';
        ctrlWrap.setAttribute('aria-label', '阅读控制栏');

        var btnVoiceReplay = document.createElement('button');
        btnVoiceReplay.type = 'button';
        btnVoiceReplay.id = 'btn-vn-voice-replay';
        btnVoiceReplay.className = 'vn-ctrl-btn vn-ctrl-voice is-unavailable';
        btnVoiceReplay.title = '重播当前语音';
        btnVoiceReplay.setAttribute('aria-label', '重播当前语音');
        btnVoiceReplay.disabled = true;
        btnVoiceReplay.innerHTML = getSvg('voice') + '<span>重播</span>';
        btnVoiceReplay.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          if (root && root.VoiceEngine && typeof root.VoiceEngine.replayCurrent === 'function') {
            root.VoiceEngine.replayCurrent();
          }
        };

        var btnAuto = document.createElement('button');
        btnAuto.type = 'button';
        btnAuto.id = 'btn-vn-auto';
        btnAuto.className = 'vn-ctrl-btn';
        btnAuto.title = '自动播放对话';
        btnAuto.setAttribute('aria-pressed', 'false');
        btnAuto.textContent = 'AUTO';
        btnAuto.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          toggleAutoMode();
        };

        var btnSkip = document.createElement('button');
        btnSkip.type = 'button';
        btnSkip.id = 'btn-vn-skip';
        btnSkip.className = 'vn-ctrl-btn';
        btnSkip.title = '已读台词快进（遇未读台词自动停止）';
        btnSkip.setAttribute('aria-pressed', 'false');
        btnSkip.textContent = 'SKIP';
        btnSkip.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          toggleSkipMode();
        };

        var btnPrefs = document.createElement('button');
        btnPrefs.type = 'button';
        btnPrefs.id = 'btn-vn-prefs';
        btnPrefs.className = 'vn-ctrl-btn vn-ctrl-icon';
        btnPrefs.title = '阅读与音效设置';
        btnPrefs.setAttribute('aria-label', '阅读与音效设置');
        btnPrefs.innerHTML = SVG_GEAR;
        btnPrefs.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          togglePrefsModal();
        };

        ctrlWrap.appendChild(btnVoiceReplay);
        ctrlWrap.appendChild(btnAuto);
        ctrlWrap.appendChild(btnSkip);
        ctrlWrap.appendChild(btnPrefs);
        tb.appendChild(ctrlWrap);
      }
      updateReadControlUI();
    }

    var titleMenu = document.querySelector('#title-screen .title-menu');
    if (titleMenu) {
      var anchor = document.getElementById('btn-arena-title') || document.getElementById('btn-codex');
      var onTitleLoadsClick = function () {
        var titleEl = document.getElementById('title-screen');
        var isTitleVisible = !!(titleEl && !titleEl.classList.contains('hidden') && (!titleEl.style || titleEl.style.display !== 'none'));
        var td = (typeof window !== 'undefined' && window.TitleDirector) ? window.TitleDirector : (root && root.TitleDirector);
        if (isTitleVisible && td && typeof td.openArchiveMode === 'function') {
          td.openArchiveMode();
          return;
        }
        openSaveLoadModal('load');
      };

      var existingLoad = document.getElementById('btn-title-loads');
      if (!existingLoad) {
        var tLoad = document.createElement('button');
        tLoad.type = 'button';
        tLoad.id = 'btn-title-loads';
        tLoad.className = 'tbtn tbtn-editorial';
        tLoad.innerHTML = '<span class="tbtn-ico" aria-hidden="true">' + SVG_SAVE_TITLE + '</span><span class="tbtn-text">记忆晶体</span><span class="tbtn-en">ARCHIVE</span>';
        tLoad.onclick = onTitleLoadsClick;
        titleMenu.insertBefore(tLoad, anchor);
      } else {
        existingLoad.className = 'tbtn tbtn-editorial';
        existingLoad.innerHTML = '<span class="tbtn-ico" aria-hidden="true">' + SVG_SAVE_TITLE + '</span><span class="tbtn-text">记忆晶体</span><span class="tbtn-en">ARCHIVE</span>';
        existingLoad.onclick = onTitleLoadsClick;
      }

      var existingChap = document.getElementById('btn-title-chapters');
      if (!existingChap) {
        var tChap = document.createElement('button');
        tChap.type = 'button';
        tChap.id = 'btn-title-chapters';
        tChap.className = 'tbtn tbtn-editorial';
        tChap.innerHTML = '<span class="tbtn-ico" aria-hidden="true">' + SVG_CHAP_TITLE + '</span><span class="tbtn-text">章节速览</span><span class="tbtn-en">CHAPTERS</span>';
        tChap.onclick = function () { openChaptersModal(); };
        titleMenu.insertBefore(tChap, anchor);
      } else {
        existingChap.className = 'tbtn tbtn-editorial';
        existingChap.innerHTML = '<span class="tbtn-ico" aria-hidden="true">' + SVG_CHAP_TITLE + '</span><span class="tbtn-text">章节速览</span><span class="tbtn-en">CHAPTERS</span>';
        existingChap.onclick = function () { openChaptersModal(); };
      }
    }

    var codexBtn = document.getElementById('btn-codex');
    if (codexBtn) {
      codexBtn.onclick = function () {
        openCodexGallery('cg');
      };
    }
    var codexCloseBtn = document.getElementById('btn-codex-close');
    if (codexCloseBtn) {
      codexCloseBtn.onclick = closeCodexGallery;
    }
    var codexEl = document.getElementById('codex');
    if (codexEl) {
      var codexX = codexEl.querySelector('.modal-close-x');
      if (codexX) codexX.onclick = closeCodexGallery;
    }
  }

  function closeTopmostVNModal() {
    if (typeof document === 'undefined') return false;
    var order = [
      { id: 'cg-lightbox', close: closeCgLightbox },
      {
        id: 'letter-demo',
        close: function (el) {
          if (typeof closeLetterDemo === 'function') {
            try { closeLetterDemo(); return; } catch (e) {}
          }
          el.classList.remove('playing', 'revealed');
          el.classList.add('hidden');
          playSfx('modal_close');
        }
      },
      {
        id: 'sys-popup',
        close: function () {
          hideElementById('sys-popup');
          playSfx('modal_close');
        }
      },
      { id: 'vn-prefs-modal', close: closePrefsModal },
      {
        id: 'arena-loadout-modal',
        close: function (el) {
          if (root.RelicsAndEvents && typeof root.RelicsAndEvents.closeArenaLoadoutModal === 'function') {
            try { root.RelicsAndEvents.closeArenaLoadoutModal(); } catch (e) {}
          }
          el.classList.add('hidden');
          playSfx('modal_close');
        }
      },
      {
        id: 'rumor-overlay',
        close: function (el) {
          if (root.RelicsAndEvents && typeof root.RelicsAndEvents.closeRumorBoard === 'function') {
            try { root.RelicsAndEvents.closeRumorBoard(); } catch (e) {}
          }
          el.classList.add('hidden');
          playSfx('modal_close');
        }
      },
      { id: 'vn-backlog-modal', close: closeBacklogModal },
      { id: 'vn-saveload-modal', close: closeSaveLoadModal },
      { id: 'vn-chapters-modal', close: closeChaptersModal },
      {
        id: 'ending-screen',
        close: function (el) {
          if (root.RaisingHub && typeof root.RaisingHub.closeEndingScreen === 'function') {
            try { root.RaisingHub.closeEndingScreen(); } catch (e) {}
          }
          hideElementById('ending-screen');
          el.classList.add('hidden');
          if (root && typeof root.bgmLeaveOverlay === 'function') {
            try { root.bgmLeaveOverlay('ending'); } catch (e) {}
          }
          playSfx('modal_close');
        }
      },
      {
        id: 'schedule-overlay',
        close: function (el) {
          if (root.RaisingHub) {
            var fn = root.RaisingHub.closeSchedulePlanner || root.RaisingHub.closeScheduleOverlay;
            if (typeof fn === 'function') {
              try { fn(); } catch (e) {}
            }
          }
          el.classList.add('hidden');
          playSfx('modal_close');
        }
      },
      {
        id: 'season-report-overlay',
        close: function (el) {
          if (root.RaisingHub && typeof root.RaisingHub.closeSeasonReport === 'function') {
            try { root.RaisingHub.closeSeasonReport(); } catch (e) {}
          }
          el.classList.add('hidden');
          playSfx('modal_close');
        }
      },
      {
        id: 'shop-overlay',
        close: function (el) {
          if (root.RaisingHub) {
            var fn = root.RaisingHub.closeShopModal || root.RaisingHub.closeShopOverlay;
            if (typeof fn === 'function') {
              try { fn(); } catch (e) {}
            }
          }
          el.classList.add('hidden');
          playSfx('modal_close');
        }
      },
      {
        id: 'mailbox-overlay',
        close: function (el) {
          if (root.RaisingHub) {
            var fn = root.RaisingHub.closeMailboxModal || root.RaisingHub.closeMailboxOverlay;
            if (typeof fn === 'function') {
              try { fn(); } catch (e) {}
            }
          }
          el.classList.add('hidden');
          playSfx('modal_close');
        }
      },
      {
        id: 'ice-deduction-modal',
        close: function (el) {
          if (root.AmbientFX && typeof root.AmbientFX.closeDeductionBoard === 'function') {
            try { root.AmbientFX.closeDeductionBoard(true); } catch (e) {}
          } else if (root.IceDeduction && typeof root.IceDeduction.close === 'function') {
            try { root.IceDeduction.close(); } catch (e) {}
          }
          el.classList.add('hidden');
          if (root && typeof root.bgmLeaveOverlay === 'function') {
            try { root.bgmLeaveOverlay('deduction'); } catch (e) {}
          }
          playSfx('modal_close');
        }
      },
      {
        id: 'panel',
        close: function () {
          hideElementById('panel');
          playSfx('modal_close');
        }
      },
      {
        id: 'stats-overlay',
        close: function () {
          hideElementById('stats-overlay');
          playSfx('modal_close');
        }
      },
      {
        id: 'map-overlay',
        close: function () {
          hideElementById('map-overlay');
          playSfx('modal_close');
        }
      },
      { id: 'codex', close: closeCodexGallery },
      {
        id: 'backlog-overlay',
        close: function () {
          hideElementById('backlog-overlay');
          playSfx('modal_close');
        }
      },
      {
        id: 'help-screen',
        close: function () {
          hideElementById('help-screen');
          playSfx('modal_close');
        }
      },
      {
        id: 'hud-drawer',
        isOpen: isHudDrawerVisible,
        close: function (el) {
          el.classList.remove('open');
          el.classList.add('hidden');
          el.setAttribute('aria-hidden', 'true');
          playSfx('modal_close');
        }
      },
      {
        id: 'ai-drawer',
        close: function (el) {
          if (root.AIChatPanel && typeof root.AIChatPanel.closeDrawer === 'function') {
            try { root.AIChatPanel.closeDrawer({ wipePending: true }); } catch (e) {}
          }
          el.classList.add('hidden');
          if (document.body) document.body.classList.remove('ai-drawer-open');
          playSfx('modal_close');
        }
      }
    ];

    for (var i = 0; i < order.length; i++) {
      var item = order[i];
      var el = document.getElementById(item.id);
      var openNow = item.isOpen ? item.isOpen(el) : isModalVisible(el);
      if (openNow) {
        item.close(el);
        return true;
      }
    }
    return false;
  }

  function bindHotkeys() {
    if (typeof document === 'undefined' || root.__vnUxKeyBound) return;
    root.__vnUxKeyBound = true;

    // 捕获阶段统一拦截 Escape（严格按视觉层级逐层关闭并阻止冒泡双关）与 Lightbox 方向键
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (closeTopmostVNModal()) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }
        return;
      }
      var lb = document.getElementById('cg-lightbox');
      if (isModalVisible(lb)) {
        if (e.key === 'ArrowLeft') {
          if (navigateCgLightbox(-1)) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          }
        } else if (e.key === 'ArrowRight') {
          if (navigateCgLightbox(1)) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          }
        }
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      var tgt = e.target;
      var tag = tgt && tgt.tagName ? tgt.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tgt && tgt.isContentEditable)) return;

      var ai = document.getElementById('ai-drawer');
      if (ai && !ai.classList.contains('hidden')) return;
      var bs = document.getElementById('battle-screen');
      if (bs && !bs.classList.contains('hidden')) return;

      if (e.key === 'l' || e.key === 'L') {
        var gs = document.getElementById('game-screen');
        if (gs && !gs.classList.contains('hidden')) {
          e.preventDefault();
          toggleBacklogModal();
        }
      }
    });
  }

  function init() {
    if (vnInitialized) return;
    vnInitialized = true;
    loadPrefs();
    syncSavedPrefsToEngine();
    ensureVNUIButtons();
    bindHotkeys();
    if (root && typeof root.addEventListener === 'function') {
      root.addEventListener('voice:statechange', updateVoiceReplayButton);
    }
    updateVoiceReplayButton();
  }

  var API = {
    MAX_BACKLOG: MAX_BACKLOG,
    VN_PREFS_KEY: VN_PREFS_KEY,
    READ_LINES_KEY: READ_LINES_KEY,
    CODEX_ARCHIVE_KEY: CODEX_ARCHIVE_KEY,
    ENDINGS_UNLOCKED_KEY: ENDINGS_UNLOCKED_KEY,
    FEATURED_QUICK_JUMPS: FEATURED_QUICK_JUMPS,
    CG_GALLERY_CATALOG: CG_GALLERY_CATALOG,
    MEMENTO_CATALOG: MEMENTO_CATALOG,
    init: init,
    recordLine: recordLine,
    recordChoice: recordChoice,
    clearBacklog: clearBacklog,
    getBacklog: getBacklog,
    setBacklog: setBacklog,
    openBacklogModal: openBacklogModal,
    closeBacklogModal: closeBacklogModal,
    toggleBacklogModal: toggleBacklogModal,
    normalizeManualSlot: normalizeManualSlot,
    onAutoSave: onAutoSave,
    saveToSlot: saveToSlot,
    loadFromSlot: loadFromSlot,
    deleteSlot: deleteSlot,
    getSlotList: getSlotList,
    openSaveLoadModal: openSaveLoadModal,
    closeSaveLoadModal: closeSaveLoadModal,
    markChapterUnlocked: markChapterUnlocked,
    loadUnlockedChapters: loadUnlockedChapters,
    prepareChapterState: prepareChapterState,
    jumpToChapter: jumpToChapter,
    openChaptersModal: openChaptersModal,
    closeChaptersModal: closeChaptersModal,
    onSceneStart: markChapterUnlocked,
    getPrefs: getPrefs,
    setPref: setPref,
    resetPrefs: resetPrefs,
    syncExternalAudioPrefs: syncExternalAudioPrefs,
    toggleAutoMode: toggleAutoMode,
    setAutoMode: setAutoMode,
    isAutoMode: isAutoMode,
    toggleSkipMode: toggleSkipMode,
    setSkipMode: setSkipMode,
    isSkipMode: isSkipMode,
    markLineRead: markLineRead,
    isLineRead: isLineRead,
    onLineComplete: onLineComplete,
    openPrefsModal: openPrefsModal,
    closePrefsModal: closePrefsModal,
    togglePrefsModal: togglePrefsModal,
    openCodexGallery: openCodexGallery,
    closeCodexGallery: closeCodexGallery,
    openCgLightbox: openCgLightbox,
    closeCgLightbox: closeCgLightbox,
    markCgUnlocked: markCgUnlocked,
    markEndingUnlocked: markEndingUnlocked,
    syncCodexArchive: syncCodexArchiveFromState,
    isAnyBlockingOverlayOpen: isAnyBlockingOverlayOpen,
    closeTopmostVNModal: closeTopmostVNModal
  };

  root.VNUx = API;
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
