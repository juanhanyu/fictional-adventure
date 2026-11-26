/* =========================================================================
   转生千金 · 商业级角色语音播放引擎 (js/voice-engine.js)
   特性：
   - SSOT 确定性 FNV-1a 哈希键与角色别名归一化（与语音管线逐比特一致）
   - 严格清单校验（零盲猜请求 / 0 资源 404）
   - 单主声道复用 + seq 竞态防串台 + LRU(16) 后继预取
   - 平滑 BGM Ducking (0.42 / 160ms → 延迟 300ms 回弹 1.0 / 360ms)
   - Auto 等待播完 / Skip 静默 / 三向音量与静音联动 / .is-voicing 舞台状态
   导出：window.VoiceEngine
   ========================================================================= */
(function (root) {
  'use strict';

  var STORAGE_KEYS = {
    VOL: 'ojousama_voice_vol',
    ENABLED: 'ojousama_voice_enabled',
    AUTO_WAIT: 'ojousama_voice_auto_wait',
    INTERRUPT: 'ojousama_voice_interrupt'
  };
  var SETTINGS_KEY = 'ojousama_settings_v1';
  var VN_PREFS_KEY = 'ojousama_vn_prefs_v1';

  var DEFAULT_VOL = 0.90;
  var PREFETCH_LRU_CAP = 16;
  var DUCK_RATIO = 0.42;
  var DUCK_ATTACK_MS = 160;
  var DUCK_RELEASE_DELAY_MS = 300;
  var DUCK_RELEASE_MS = 360;

  /* ---------- 1. SSOT 哈希与 Key 计算 ---------- */
  function normalizeVoiceText(s) {
    return String(s || '')
      .replace(/\r\n/g, '\n')
      .replace(/[\u3000\s]+/g, ' ')
      .trim();
  }

  function fnv1aHex(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  /* ---------- 2. 角色别名归一化表（对齐 CHARS 与配音选角表） ---------- */
  var CHAR_ALIAS_MAP = {
    sylvia: 'sylvia',
    '希尔维亚': 'sylvia',
    '希尔维亚·维斯特利亚': 'sylvia',
    '渔': 'sylvia',
    '眷寒渔': 'sylvia',
    '我': 'sylvia',

    beatrice: 'beatrice',
    '贝阿特丽丝': 'beatrice',
    '贝阿特丽丝·维斯特利亚': 'beatrice',
    '贝蒂': 'beatrice',

    alice: 'alice',
    '爱丽丝': 'alice',
    '爱丽丝·维斯特利亚': 'alice',

    sophia: 'sophia',
    '索菲亚': 'sophia',
    '索菲亚·维斯特利亚': 'sophia',
    '母亲': 'sophia',
    '妈妈': 'sophia',

    claude: 'claude',
    '克劳德': 'claude',
    '克劳德·维斯特利亚': 'claude',
    '父亲': 'claude',
    '爸爸': 'claude',

    noelle: 'noelle',
    '诺艾儿': 'noelle',

    emma: 'emma',
    '艾玛': 'emma',
    '艾玛·克莱尔': 'emma',

    charlotte: 'charlotte',
    '夏洛特': 'charlotte',
    '夏洛特·贝尔蒙': 'charlotte',

    aino: 'aino',
    '艾诺': 'aino',
    '艾诺·塔尔维': 'aino',

    helena: 'helena',
    '海伦娜': 'helena',
    '海伦娜·德尔菲': 'helena',

    ajun: 'ajun',
    '阿琼': 'ajun',
    '阿琼·普拉塔': 'ajun',

    reno: 'reno',
    '雷纳德': 'reno',
    '雷纳德·维斯特利亚': 'reno',
    '叔叔': 'reno',

    rowan: 'rowan',
    '罗文': 'rowan',

    yaoshen: 'yaoshen',
    '药神': 'yaoshen',

    fashen: 'fashen',
    '法神': 'fashen',

    fengshen: 'fengshen',
    '风神': 'fengshen',
    '岚': 'fengshen',
    '兰': 'fengshen',

    jianshen: 'jianshen',
    '剑神': 'jianshen',

    wanshen: 'wanshen',
    '万神': 'wanshen',

    shengnu: 'shengnu',
    '圣女': 'shengnu',

    moshen: 'moshen',
    '魔神': 'moshen',

    ji: 'ji',
    '霁馆主': 'ji',
    '老霁': 'ji',
    '霁叔': 'ji',

    jilan: 'jilan',
    '霁岚': 'jilan',

    jiqing: 'jiqing',
    '霁清': 'jiqing',

    lein: 'lein',
    '莱恩': 'lein',

    peilin: 'peilin',
    '沛霖': 'peilin',

    huke: 'huke',
    '虎克': 'huke',

    hol: 'hol',
    '霍尔': 'hol',

    anna: 'anna',
    '安娜': 'anna',
    '安娜·贝尔': 'anna',

    masha: 'masha',
    '玛莎': 'masha',

    kyle: 'kyle',
    '凯尔': 'kyle',

    mage_aurora: 'mage_aurora',
    '极光女法师': 'mage_aurora',
    '女法师': 'mage_aurora',

    axu: 'axu',
    '阿蓿': 'axu',

    musa: 'musa',
    '穆萨': 'musa',
    '巴依随军药师': 'musa',
    '随军老药师': 'musa',

    teacher: 'teacher',
    '家庭教师': 'teacher',

    lecturer: 'lecturer',

    teacher_middle: 'teacher_middle',
    '中年教师': 'teacher_middle',
    '格雷教授': 'teacher_middle',

    instructor: 'instructor',
    '剑术教官': 'instructor',
    '教官': 'instructor',

    maid: 'maid',
    '女仆': 'maid',

    merchant_bakery: 'merchant_bakery',
    '点心店老板': 'merchant_bakery',

    merchant_jewel: 'merchant_jewel',
    '首饰店老板': 'merchant_jewel',

    servant_a: 'servant_a',
    '侍从': 'servant_a',
    '侍卫': 'servant_a',
    '问询骑士': 'servant_a',
    '魔法师': 'servant_a',

    eastwing_commander: 'eastwing_commander',
    '东翼封锁官': 'eastwing_commander',
    '红莲铁幕': 'eastwing_commander',

    narrator: 'narrator',
    '旁白': 'narrator'
  };

  function isMysterySpeaker(s) {
    if (!s) return true;
    return /^[？?·\s]+$/.test(s);
  }

  function lookupAlias(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (Object.prototype.hasOwnProperty.call(CHAR_ALIAS_MAP, s)) {
      return CHAR_ALIAS_MAP[s];
    }
    var low = s.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CHAR_ALIAS_MAP, low)) {
      return CHAR_ALIAS_MAP[low];
    }
    var chars = root && (root.CHARS || root.__CHARS);
    if (chars && typeof chars === 'object') {
      if (Object.prototype.hasOwnProperty.call(chars, low)) return low;
      var keys = Object.keys(chars);
      for (var i = 0; i < keys.length; i++) {
        var meta = chars[keys[i]];
        if (meta && (meta.short === s || meta.name === s)) {
          return keys[i];
        }
      }
    }
    return '';
  }

  function resolveCharId(charId, speaker, sceneId) {
    var rawCh = String(charId || '').trim();
    var rawSpk = String(speaker || '').trim();

    // 1. 家庭教师特例（s_sisters_grow[7] 中 ch:'lecturer' 但 speaker:'家庭教师'）
    if (rawSpk === '家庭教师') return 'teacher';

    // 2. 霁清成年/少年区分（s_eye_of_storm 求婚段 ch/立绘为 ji 时必须保持 ji）
    if (rawSpk === '霁清') {
      if (rawCh === 'ji') return 'ji';
      return 'jiqing';
    }

    var spkMystery = isMysterySpeaker(rawSpk);
    var chMapped = lookupAlias(rawCh);

    // 3. 未知说话人署名「？？？」：按 ch -> 高亮立绘 -> 场景上下文精准识别
    if (rawSpk && spkMystery) {
      if (chMapped) return chMapped;
      if (rawCh && /^[a-z][a-z0-9_]*$/i.test(rawCh)) return rawCh.toLowerCase();
      if (typeof document !== 'undefined') {
        try {
          var activeSlot = document.querySelector('#portraits .p-slot.active:not(.hidden)');
          if (activeSlot) {
            var dc = activeSlot.getAttribute('data-char') || '';
            var dcMapped = lookupAlias(dc);
            if (dcMapped) return dcMapped;
            if (dc && /^[a-z][a-z0-9_]*$/i.test(dc)) return dc.toLowerCase();
          }
        } catch (e) {}
      }
      if (sceneId === 's_yaoshen') return 'yaoshen';
      if (sceneId === 's_start') return 'sophia';
      return '';
    }

    // 4. 显式说话人别名映射优先（对齐 extract_game_lines.mjs）
    if (rawSpk) {
      var spkMapped = lookupAlias(rawSpk);
      if (spkMapped) return spkMapped;
    }

    // 5. ch 字段兜底
    if (chMapped) return chMapped;
    if (rawCh && /^[a-z][a-z0-9_]*$/i.test(rawCh)) {
      return rawCh.toLowerCase();
    }

    return '';
  }

  function makeStoryKey(sceneId, charId, text) {
    var sc = String(sceneId || 'roam').trim() || 'roam';
    var cid = resolveCharId(charId, '', sc) || String(charId || '').trim() || 'narrator';
    var norm = normalizeVoiceText(text);
    if (!norm) return '';
    return sc + '__' + cid + '__' + fnv1aHex(cid + '|' + norm);
  }

  function makeCombatKey(cueKey) {
    var ck = String(cueKey || '').trim();
    return ck ? ('combat__' + ck) : '';
  }

  function makeInteractiveKey(kind, charId, text) {
    var k = String(kind || 'misc').trim() || 'misc';
    var cid = resolveCharId(charId, '', '') || String(charId || '').trim() || 'sylvia';
    var norm = normalizeVoiceText(text);
    if (!norm) return '';
    return 'inter__' + k + '__' + cid + '__' + fnv1aHex(cid + '|' + norm);
  }

  /* ---------- 3. 持久化与内部状态 ---------- */
  function clamp01(v, fallback) {
    var n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  function readBoolKey(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (v === null || v === undefined || v === '') return fallback;
      return v !== '0' && v !== 'false';
    } catch (e) {
      return fallback;
    }
  }

  function readInitialVolume() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.VOL);
      if (raw !== null && raw !== undefined && raw !== '') {
        var n = parseFloat(raw);
        if (Number.isFinite(n)) return clamp01(n, DEFAULT_VOL);
      }
      var st = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (st && typeof st === 'object' && Number.isFinite(Number(st.voiceVol))) {
        return clamp01(st.voiceVol, DEFAULT_VOL);
      }
    } catch (e) {}
    return DEFAULT_VOL;
  }

  function readInitialEnabled() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.ENABLED);
      if (raw !== null && raw !== undefined && raw !== '') {
        return raw !== '0' && raw !== 'false';
      }
      var st = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (st && typeof st === 'object' && typeof st.voiceEnabled === 'boolean') {
        return st.voiceEnabled;
      }
    } catch (e) {}
    return true;
  }

  function readInitialMuted() {
    try {
      if (root && typeof root.isMuted === 'function') {
        return !!root.isMuted();
      }
      return localStorage.getItem('ojousama_muted') === '1' || localStorage.getItem('ojousama_bgm_muted') === '1';
    } catch (e) {
      return false;
    }
  }

  function isJsdomEnv() {
    try {
      return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
    } catch (e) {
      return false;
    }
  }

  var state = {
    volume: readInitialVolume(),
    enabled: readInitialEnabled(),
    autoWait: readBoolKey(STORAGE_KEYS.AUTO_WAIT, true),
    interruptOnAdvance: readBoolKey(STORAGE_KEYS.INTERRUPT, true),
    muted: readInitialMuted(),
    unlocked: false,

    audioEl: null,
    playSeq: 0,
    playing: false,
    activeVoiceId: null,
    activeCharId: null,
    activeMode: null,

    lastReplayId: null,
    lastReplayCharId: null,
    lastReplayMode: null,

    ducked: false,
    duckRestoreTimer: null,
    endedOnceQueue: [],
    prefetchCache: new Map(),
    inSync: false
  };

  /* ---------- 4. 清单解析（严守零 404 铁律） ---------- */
  function getManifest() {
    var m = root && root.VOICE_MANIFEST;
    if (!m || typeof m !== 'object' || !m.entries || typeof m.entries !== 'object') {
      return null;
    }
    return m;
  }

  function getEntry(voiceId) {
    if (!voiceId || typeof voiceId !== 'string') return null;
    var m = getManifest();
    if (!m) return null;
    if (!Object.prototype.hasOwnProperty.call(m.entries, voiceId)) return null;
    var ent = m.entries[voiceId];
    return ent ? ent : null;
  }

  function hasVoice(voiceId) {
    return !!getEntry(voiceId);
  }

  function encodeRelativePath(p) {
    var s = String(p || '');
    if (/^(?:https?:|data:|blob:)/i.test(s)) return s;
    return s.split('/').map(function (seg) {
      if (!seg || seg === '.' || seg === '..') return seg;
      try { return encodeURIComponent(decodeURIComponent(seg)); }
      catch (e) { return encodeURIComponent(seg); }
    }).join('/');
  }

  function resolveAudioUrl(voiceId, entry) {
    if (!entry) return '';
    var m = getManifest();
    var basePath = (m && typeof m.basePath === 'string') ? m.basePath : 'assets/voice/';
    if (basePath && basePath.charAt(basePath.length - 1) !== '/') basePath += '/';
    var fmt = (m && typeof m.format === 'string' && m.format) ? m.format : 'mp3';

    var raw = '';
    if (typeof entry === 'string') {
      raw = entry;
    } else if (typeof entry === 'object') {
      if (typeof entry.url === 'string' && entry.url) return entry.url;
      if (typeof entry.path === 'string' && entry.path) raw = entry.path;
      else if (typeof entry.file === 'string' && entry.file) raw = entry.file;
    }
    if (!raw) {
      raw = voiceId + '.' + fmt;
    }
    if (/^(?:https?:|data:|blob:|\/)/i.test(raw)) {
      return encodeRelativePath(raw);
    }
    if (basePath && raw.indexOf(basePath) === 0) {
      return encodeRelativePath(raw);
    }
    if (raw.indexOf('assets/') === 0) {
      return encodeRelativePath(raw);
    }
    return encodeRelativePath(basePath + raw);
  }

  /* ---------- 5. BGM Ducking / 舞台状态类 / 事件派发 ---------- */
  function clearDuckTimer() {
    if (state.duckRestoreTimer) {
      clearTimeout(state.duckRestoreTimer);
      state.duckRestoreTimer = null;
    }
  }

  function engageBgmDuck() {
    clearDuckTimer();
    if (!state.ducked) {
      state.ducked = true;
      try {
        if (root && typeof root.bgmSetDuck === 'function') {
          root.bgmSetDuck(DUCK_RATIO, DUCK_ATTACK_MS);
        }
      } catch (e) {}
    }
  }

  function scheduleBgmDuckRestore(immediate) {
    clearDuckTimer();
    if (!state.ducked) return;
    var doRestore = function () {
      state.duckRestoreTimer = null;
      if (state.playing) return;
      if (!state.ducked) return;
      state.ducked = false;
      try {
        if (root && typeof root.bgmSetDuck === 'function') {
          root.bgmSetDuck(1.0, immediate ? 0 : DUCK_RELEASE_MS);
        }
      } catch (e) {}
    };
    if (immediate) {
      doRestore();
    } else {
      state.duckRestoreTimer = setTimeout(doRestore, DUCK_RELEASE_DELAY_MS);
    }
  }

  function syncStageVoicingClasses(isVoicing, charId, mode) {
    if (typeof document === 'undefined') return;
    try {
      var tb = document.getElementById('text-box');
      if (tb) {
        var boxActive = !!(isVoicing && mode !== 'combat');
        tb.classList.toggle('is-voicing', boxActive);
      }
      var slots = document.querySelectorAll('#portraits .p-slot');
      for (var i = 0; i < slots.length; i++) {
        slots[i].classList.remove('is-voicing');
      }
      if (isVoicing && mode !== 'combat') {
        var target = null;
        if (charId) {
          for (var j = 0; j < slots.length; j++) {
            var sl = slots[j];
            if (!sl.classList.contains('hidden') && sl.getAttribute('data-char') === charId) {
              target = sl;
              break;
            }
          }
        }
        if (!target) {
          target = document.querySelector('#portraits .p-slot.active:not(.hidden)');
        }
        if (target) {
          target.classList.add('is-voicing');
        }
      }
    } catch (e) {}
  }

  function dispatchVoiceState() {
    if (!root || typeof root.dispatchEvent !== 'function') return;
    var detail = {
      playing: !!state.playing,
      voiceId: state.playing ? state.activeVoiceId : (state.lastReplayId || null),
      activeVoiceId: state.playing ? state.activeVoiceId : null,
      charId: state.playing ? state.activeCharId : (state.lastReplayCharId || null),
      mode: state.playing ? state.activeMode : (state.lastReplayMode || null),
      replayableVoiceId: state.lastReplayId && hasVoice(state.lastReplayId) ? state.lastReplayId : null,
      canReplay: !!(state.lastReplayId && hasVoice(state.lastReplayId))
    };
    try {
      var CE = root.CustomEvent || (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
      if (CE) {
        root.dispatchEvent(new CE('voice:statechange', { detail: detail }));
      }
    } catch (e) {}
  }

  function flushEndedOnceCallbacks(reason) {
    if (!state.endedOnceQueue.length) return;
    var list = state.endedOnceQueue.slice();
    state.endedOnceQueue.length = 0;
    for (var i = 0; i < list.length; i++) {
      try { list[i](reason || 'ended'); } catch (e) {}
    }
  }

  function isSkipModeActive() {
    try {
      return !!(root && root.VNUx && typeof root.VNUx.isSkipMode === 'function' && root.VNUx.isSkipMode());
    } catch (e) {
      return false;
    }
  }

  /* ---------- 6. 单主声道 <audio> 管理与预加载 ---------- */
  function computeEffectiveAudioVol() {
    if (state.muted || !state.enabled) return 0;
    return clamp01(state.volume, DEFAULT_VOL);
  }

  function ensureAudioElement() {
    if (state.audioEl) return state.audioEl;
    var el = null;
    try {
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        el = document.createElement('audio');
      } else if (typeof Audio !== 'undefined') {
        el = new Audio();
      }
    } catch (e) {
      el = null;
    }
    if (!el) return null;
    try { el.preload = 'auto'; } catch (e) {}
    try { el.volume = computeEffectiveAudioVol(); } catch (e) {}

    var onFinish = function (reason) {
      if (el._voiceSeq !== state.playSeq) return;
      if (!state.playing) return;
      state.playing = false;
      state.activeVoiceId = null;
      state.activeCharId = null;
      state.activeMode = null;
      syncStageVoicingClasses(false, null, null);
      dispatchVoiceState();
      flushEndedOnceCallbacks(reason);
      scheduleBgmDuckRestore(false);
    };

    if (typeof el.addEventListener === 'function') {
      el.addEventListener('ended', function () { onFinish('ended'); });
      el.addEventListener('error', function () { onFinish('error'); });
      el.addEventListener('pause', function () {
        if (el._voiceSeq !== state.playSeq) return;
        if (el.ended) onFinish('ended');
      });
    }
    state.audioEl = el;
    return el;
  }

  function prefetch(voiceIds) {
    var list = Array.isArray(voiceIds) ? voiceIds : (voiceIds ? [voiceIds] : []);
    var count = 0;
    for (var i = 0; i < list.length; i++) {
      var vid = list[i];
      if (!vid || typeof vid !== 'string') continue;
      var entry = getEntry(vid);
      if (!entry) continue;
      var url = resolveAudioUrl(vid, entry);
      if (!url) continue;

      if (state.prefetchCache.has(vid)) {
        var existing = state.prefetchCache.get(vid);
        state.prefetchCache.delete(vid);
        state.prefetchCache.set(vid, existing);
        count++;
        continue;
      }

      while (state.prefetchCache.size >= PREFETCH_LRU_CAP) {
        var oldestKey = state.prefetchCache.keys().next().value;
        var oldestVal = state.prefetchCache.get(oldestKey);
        state.prefetchCache.delete(oldestKey);
        if (oldestVal && oldestVal.el) {
          try { oldestVal.el.src = ''; } catch (e) {}
        }
      }

      var preEl = null;
      if (!isJsdomEnv() && typeof Audio !== 'undefined') {
        try {
          preEl = new Audio();
          preEl.preload = 'auto';
          preEl.src = url;
          if (typeof preEl.load === 'function') preEl.load();
        } catch (e) {
          preEl = null;
        }
      }
      state.prefetchCache.set(vid, { url: url, el: preEl, ts: Date.now() });
      count++;
    }
    return count;
  }

  /* ---------- 7. 核心播放控制 API ---------- */
  function stop(opts) {
    opts = opts || {};
    var wasPlaying = state.playing;
    var hadLast = !!state.lastReplayId;
    state.playSeq += 1;
    state.playing = false;
    state.activeVoiceId = null;
    state.activeCharId = null;
    state.activeMode = null;

    if (opts.clearCurrent || opts.reason === 'scene_change' || opts.reason === 'advance' || opts.reason === 'return_title') {
      state.lastReplayId = null;
      state.lastReplayCharId = null;
      state.lastReplayMode = null;
    }

    if (state.audioEl) {
      state.audioEl._voiceSeq = state.playSeq;
      try {
        if (typeof state.audioEl.pause === 'function') state.audioEl.pause();
      } catch (e) {}
      try {
        if (typeof state.audioEl.currentTime === 'number' && !isNaN(state.audioEl.currentTime)) {
          state.audioEl.currentTime = 0;
        }
      } catch (e) {}
    }

    syncStageVoicingClasses(false, null, null);
    if (wasPlaying || (hadLast && !state.lastReplayId)) {
      dispatchVoiceState();
    }
    flushEndedOnceCallbacks(opts.reason || 'stop');
    scheduleBgmDuckRestore(!!opts.immediateDuck);
  }

  function playById(voiceId, opts) {
    opts = opts || {};
    var mode = opts.mode || 'story';
    var charId = opts.charId || null;

    // 跳过模式下禁播普通剧情/交互语音（显式手动重播 force:true 除外）
    if (!opts.force && !opts.ignoreSkip && isSkipModeActive()) {
      if (state.playing) stop({ reason: 'skip' });
      return false;
    }

    // 清单白名单铁律：未登记于 VOICE_MANIFEST.entries 时绝不发起任何音频请求
    var entry = getEntry(voiceId);
    if (!entry) {
      if (mode === 'story' && opts.updateReplaySlot !== false) {
        var hadReplay = !!state.lastReplayId;
        state.lastReplayId = null;
        state.lastReplayCharId = null;
        state.lastReplayMode = null;
        if (hadReplay) dispatchVoiceState();
      }
      return false;
    }

    if (mode === 'story' || mode === 'interactive' || opts.updateReplaySlot) {
      state.lastReplayId = voiceId;
      state.lastReplayCharId = charId || (entry && entry.charId) || null;
      state.lastReplayMode = mode;
    }

    // 语音开关关闭或全局静音或音量为 0 时不发声，但保留可重播槽位记录
    if (!state.enabled || state.muted || state.volume <= 0.001) {
      if (state.playing) stop({ reason: 'muted' });
      else dispatchVoiceState();
      return false;
    }

    var url = resolveAudioUrl(voiceId, entry);
    if (!url) return false;

    var el = ensureAudioElement();
    if (!el) return false;

    var seq = ++state.playSeq;
    // 切换语音前先释放旧挂起的 onEndedOnce 回调，避免旧句 Auto 误推进新句
    if (state.endedOnceQueue.length) {
      state.endedOnceQueue.length = 0;
    }

    try {
      if (typeof el.pause === 'function') el.pause();
    } catch (e) {}

    el._voiceSeq = seq;
    state.playing = true;
    state.activeVoiceId = voiceId;
    state.activeCharId = charId || (entry && entry.charId) || null;
    state.activeMode = mode;

    try { el.volume = computeEffectiveAudioVol(); } catch (e) {}
    try { el.src = url; } catch (e) {
      state.playing = false;
      state.activeVoiceId = null;
      state.activeCharId = null;
      state.activeMode = null;
      syncStageVoicingClasses(false, null, null);
      dispatchVoiceState();
      return false;
    }
    try { el.currentTime = 0; } catch (e) {}

    engageBgmDuck();
    syncStageVoicingClasses(true, state.activeCharId, mode);
    dispatchVoiceState();

    var p = null;
    try {
      if (typeof el.play === 'function') {
        p = el.play();
      }
    } catch (err) {
      if (seq === state.playSeq) {
        state.playing = false;
        state.activeVoiceId = null;
        state.activeCharId = null;
        state.activeMode = null;
        syncStageVoicingClasses(false, null, null);
        dispatchVoiceState();
        flushEndedOnceCallbacks('play_error');
        scheduleBgmDuckRestore(false);
      }
      return false;
    }

    if (p && typeof p.then === 'function') {
      p.then(function () {
        // 正常起播，等待 ended/error/stop
      }).catch(function () {
        // 静默吞掉 NotAllowedError 等浏览器自动播放限制异常（零 console error）
        if (seq !== state.playSeq) return;
        state.playing = false;
        state.activeVoiceId = null;
        state.activeCharId = null;
        state.activeMode = null;
        syncStageVoicingClasses(false, null, null);
        dispatchVoiceState();
        flushEndedOnceCallbacks('blocked');
        scheduleBgmDuckRestore(false);
      });
    }

    return true;
  }

  function playStoryLine(params) {
    params = params || {};
    var sceneId = params.sceneId || 'roam';
    var text = params.text || '';
    var resolvedChar = resolveCharId(params.charId, params.speaker, sceneId);
    var voiceId = params.explicitVoice || (resolvedChar ? makeStoryKey(sceneId, resolvedChar, text) : makeStoryKey(sceneId, 'narrator', text));

    // 后继 2 句预取（仅对 manifest 存在项生效）
    if (Array.isArray(params.nextLines) && params.nextLines.length) {
      var toPrefetch = [];
      for (var i = 0; i < params.nextLines.length && toPrefetch.length < 2; i++) {
        var nl = params.nextLines[i];
        if (!nl) continue;
        if (typeof nl === 'string') {
          if (hasVoice(nl)) toPrefetch.push(nl);
          continue;
        }
        if (typeof nl === 'object') {
          var nChar = resolveCharId(nl.charId || nl.ch, nl.speaker, nl.sceneId || sceneId);
          var nKey = nl.explicitVoice || nl.voice || (nl.text ? makeStoryKey(nl.sceneId || sceneId, nChar || 'narrator', nl.text) : '');
          if (nKey && hasVoice(nKey)) {
            toPrefetch.push(nKey);
          } else if (nChar && nl.text) {
            var bKey = makeInteractiveKey('branch', nChar, nl.text);
            if (bKey && hasVoice(bKey)) toPrefetch.push(bKey);
          }
        }
      }
      if (toPrefetch.length) prefetch(toPrefetch);
    }

    if (!voiceId) {
      if (state.lastReplayId) {
        state.lastReplayId = null;
        state.lastReplayCharId = null;
        state.lastReplayMode = null;
        dispatchVoiceState();
      }
      return false;
    }

    return playById(voiceId, {
      mode: 'story',
      charId: resolvedChar || null,
      updateReplaySlot: true
    });
  }

  function playInteractive(kind, charId, text, opts) {
    opts = opts || {};
    var resolvedChar = resolveCharId(charId, opts.speaker || '', '');
    var voiceId = makeInteractiveKey(kind, resolvedChar || charId || 'sylvia', text);
    if (!voiceId) return false;
    return playById(voiceId, {
      mode: 'interactive',
      charId: resolvedChar || charId || null,
      updateReplaySlot: !!opts.updateReplaySlot,
      ignoreSkip: opts.ignoreSkip !== undefined ? !!opts.ignoreSkip : true,
      force: !!opts.force
    });
  }

  function playCombatCue(cueKey, meta) {
    meta = meta || {};
    var primaryKey = makeCombatKey(cueKey);
    var targetKey = '';
    if (primaryKey && hasVoice(primaryKey)) {
      targetKey = primaryKey;
    } else if (meta.fallbackCueKey) {
      var fbKey = makeCombatKey(meta.fallbackCueKey);
      if (fbKey && hasVoice(fbKey)) {
        targetKey = fbKey;
      } else {
        var fbLower = makeCombatKey(String(meta.fallbackCueKey).toLowerCase());
        if (fbLower && hasVoice(fbLower)) targetKey = fbLower;
      }
    }
    if (!targetKey) return false;
    return playById(targetKey, {
      mode: 'combat',
      charId: meta.charId || 'sylvia',
      ignoreSkip: true,
      updateReplaySlot: false
    });
  }

  function replayCurrent() {
    var vid = state.lastReplayId;
    if (!vid || !hasVoice(vid)) return false;
    return playById(vid, {
      mode: state.lastReplayMode || 'story',
      charId: state.lastReplayCharId,
      force: true,
      ignoreSkip: true,
      updateReplaySlot: true
    });
  }

  function onEndedOnce(fn) {
    if (typeof fn !== 'function') return;
    if (!state.playing) {
      try { fn('idle'); } catch (e) {}
      return;
    }
    state.endedOnceQueue.push(fn);
  }

  /* ---------- 8. 音量 / 开关 / Auto等待 / 静音 / 解锁 ---------- */
  function syncExternalSettingsMirrors(patch, opts) {
    opts = opts || {};
    if (state.inSync) return;
    state.inSync = true;
    try {
      if (opts.syncSettings !== false) {
        try {
          var cur = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
          if (!cur || typeof cur !== 'object') cur = {};
          if (patch.voiceVol !== undefined) cur.voiceVol = patch.voiceVol;
          if (patch.voiceEnabled !== undefined) cur.voiceEnabled = patch.voiceEnabled;
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(cur));
        } catch (e) {}
      }
      if (opts.syncVnPrefs !== false) {
        try {
          var vp = JSON.parse(localStorage.getItem(VN_PREFS_KEY) || '{}');
          if (!vp || typeof vp !== 'object') vp = {};
          if (patch.voiceVol !== undefined) vp.voiceVol = patch.voiceVol;
          if (patch.voiceEnabled !== undefined) vp.voiceEnabled = patch.voiceEnabled;
          if (patch.voiceAutoWait !== undefined) vp.voiceAutoWait = patch.voiceAutoWait;
          localStorage.setItem(VN_PREFS_KEY, JSON.stringify(vp));
        } catch (e) {}
      }
      if (typeof document !== 'undefined' && patch.voiceVol !== undefined) {
        var pct = Math.round(patch.voiceVol * 100);
        var sl = document.getElementById('set-voice');
        if (sl && Number(sl.value) !== pct) sl.value = String(pct);
        var vl = document.getElementById('set-voice-val');
        if (vl) vl.textContent = pct + '%';
      }
      if (opts.notifyVnUx !== false && root && root.VNUx && typeof root.VNUx.syncExternalAudioPrefs === 'function') {
        root.VNUx.syncExternalAudioPrefs(patch);
      }
      if (opts.notifyTitle !== false && root && root.TitleDirector && typeof root.TitleDirector.syncSettingsDOM === 'function') {
        root.TitleDirector.syncSettingsDOM();
      }
    } catch (e) {
    } finally {
      state.inSync = false;
    }
  }

  function getVolume() {
    return state.volume;
  }

  function setVolume(v, opts) {
    opts = opts || {};
    var next = clamp01(v, state.volume);
    state.volume = next;
    try { localStorage.setItem(STORAGE_KEYS.VOL, String(next)); } catch (e) {}
    if (state.audioEl) {
      try { state.audioEl.volume = computeEffectiveAudioVol(); } catch (e) {}
    }
    if (!opts.silentSync) {
      syncExternalSettingsMirrors({ voiceVol: next }, opts);
    }
    return next;
  }

  function isEnabled() {
    return !!state.enabled;
  }

  function setEnabled(flag, opts) {
    opts = opts || {};
    var next = !!flag;
    state.enabled = next;
    try { localStorage.setItem(STORAGE_KEYS.ENABLED, next ? '1' : '0'); } catch (e) {}
    if (!next && state.playing) {
      stop({ reason: 'disabled' });
    } else if (state.audioEl) {
      try { state.audioEl.volume = computeEffectiveAudioVol(); } catch (e) {}
    }
    if (!opts.silentSync) {
      syncExternalSettingsMirrors({ voiceEnabled: next }, opts);
    }
    return next;
  }

  function getAutoWait() {
    return !!state.autoWait;
  }

  function setAutoWait(flag, opts) {
    opts = opts || {};
    var next = !!flag;
    state.autoWait = next;
    try { localStorage.setItem(STORAGE_KEYS.AUTO_WAIT, next ? '1' : '0'); } catch (e) {}
    if (!opts.silentSync) {
      syncExternalSettingsMirrors({ voiceAutoWait: next }, opts);
    }
    return next;
  }

  function getInterruptOnAdvance() {
    return !!state.interruptOnAdvance;
  }

  function setInterruptOnAdvance(flag) {
    var next = !!flag;
    state.interruptOnAdvance = next;
    try { localStorage.setItem(STORAGE_KEYS.INTERRUPT, next ? '1' : '0'); } catch (e) {}
    return next;
  }

  function syncMuted(isMutedFlag) {
    var next = !!isMutedFlag;
    state.muted = next;
    if (state.audioEl) {
      try { state.audioEl.volume = computeEffectiveAudioVol(); } catch (e) {}
    }
    if (next && state.playing) {
      stop({ reason: 'muted' });
    }
    return next;
  }

  function isMuted() {
    return !!state.muted;
  }

  function unlock() {
    state.unlocked = true;
    return true;
  }

  /* ---------- 9. 导出公开 API ---------- */
  var API = {
    STORAGE_KEYS: STORAGE_KEYS,
    normalizeVoiceText: normalizeVoiceText,
    fnv1aHex: fnv1aHex,
    makeStoryKey: makeStoryKey,
    makeInteractiveKey: makeInteractiveKey,
    makeCombatKey: makeCombatKey,
    resolveCharId: resolveCharId,
    hasVoice: hasVoice,
    getEntry: getEntry,
    prefetch: prefetch,
    playById: playById,
    playStoryLine: playStoryLine,
    playInteractive: playInteractive,
    playCombatCue: playCombatCue,
    replayCurrent: replayCurrent,
    stop: stop,
    isPlaying: function () { return !!state.playing; },
    getCurrentVoiceId: function () { return state.playing ? state.activeVoiceId : null; },
    getLastVoiceId: function () { return state.lastReplayId; },
    canReplayCurrent: function () { return !!(state.lastReplayId && hasVoice(state.lastReplayId)); },
    onEndedOnce: onEndedOnce,
    getVolume: getVolume,
    setVolume: setVolume,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    getAutoWait: getAutoWait,
    setAutoWait: setAutoWait,
    getInterruptOnAdvance: getInterruptOnAdvance,
    setInterruptOnAdvance: setInterruptOnAdvance,
    shouldInterruptOnAdvance: getInterruptOnAdvance,
    syncMuted: syncMuted,
    isMuted: isMuted,
    unlock: unlock,
    _getAudioElement: function () { return state.audioEl; },
    _getPrefetchSize: function () { return state.prefetchCache.size; }
  };

  root.VoiceEngine = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
