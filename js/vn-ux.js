/* =========================================================================
   转生千金 · 商业级 Galgame 基础体验组件 (js/vn-ux.js)
   包含：
   1. 对话历史回看（Backlog，支持 L 键 / HUD / 对话框入口，至多 200 条）
   2. 6 槽位手动存档 / 读档系统 + 自动存档镜像（完整序列化因果、铭记与奇遇状态）
   3. 章节速览与快速重温 / 快捷试玩跳转（覆盖第一至第四卷与间章）
   4. 阅读控制栏（Auto / Skip 未读急刹 / 独立音量与打字机速度设置）
   5. 四合一「典藏图鉴馆」（CG 画廊 + 全屏鉴赏 / BGM 音乐室 / 成就墙 / 信物手札）
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

  var backlogList = [];
  var backlogSeq = 0;

  var DEFAULT_PREFS = {
    autoSpeed: 1800,
    typeSpeed: 'normal',
    bgmVol: 0.5,
    sfxVol: 0.65,
    fxEnabled: true
  };
  var vnPrefs = null;
  var readLinesSet = null;
  var autoMode = false;
  var skipMode = false;
  var autoTimer = null;
  var skipTimer = null;
  var currentLineMeta = null;
  var codexCurrentTab = 'cg';
  var codexPlayingTrack = null;
  var codexExpandedMemento = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    if (typeof dateStr === 'function') {
      try { return dateStr(); } catch (e) {}
    }
    if (!st) return '';
    var sns = ['春', '夏', '秋', '冬'];
    return (st.year || 0) + '年 · ' + (sns[st.season || 0] || '春');
  }

  function getPhaseLabel(st) {
    if (typeof phaseName === 'function') {
      try { return phaseName(); } catch (e) {}
    }
    var map = { prologue: '序章', childhood: '童年', youth: '少女期', academy: '学院篇', journey: '旅途篇', finale: '终章' };
    return (st && map[st.phase]) || '';
  }

  function getAgeLabel(st) {
    if (typeof ageStr === 'function') {
      try { return ageStr(); } catch (e) {}
    }
    if (!st) return '0岁';
    return st.ageY <= 0 ? (st.ageD || 0) + '天' : st.ageY + '岁';
  }

  function getChapterTitleForState(st, scId) {
    var chaps = typeof STORY_CHAPTERS !== 'undefined' ? STORY_CHAPTERS : (root.__STORY_CHAPTERS || []);
    var cid = scId || getCurrentSceneId();
    if (cid) {
      var found = chaps.find(function (c) { return c && c.id === cid; });
      if (found) return (found.vol ? found.vol + ' · ' : '') + found.title;
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
      return false;
    }
    backlogSeq += 1;
    backlogList.push({
      seq: backlogSeq,
      kind: kind,
      speaker: spk,
      charId: entry.charId || null,
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
        text: String(it.text || ''),
        locName: it.locName || '',
        dateStr: it.dateStr || ''
      };
    });
    backlogSeq = backlogList.length ? backlogList[backlogList.length - 1].seq : 0;
  }

  function closeBacklogModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-backlog-modal');
    if (ov) ov.classList.add('hidden');
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
    var rowsHtml = backlogList.length
      ? backlogList.map(function (item) {
          var portraitSrc = '';
          if (item.charId && typeof resolvePortrait === 'function') {
            try { portraitSrc = resolvePortrait(item.charId, 'normal') || ''; } catch (e) {}
          }
          var avatarHtml = portraitSrc
            ? '<img class="vb-av" src="' + escapeHtml(portraitSrc) + '" alt=""/>'
            : '<span class="vb-av-ph">' + (item.kind === 'choice' ? '✦' : item.kind === 'cg' ? '🎞️' : item.speaker ? '💬' : '❄️') + '</span>';
          return (
            '<div class="vb-row kind-' + escapeHtml(item.kind) + '">' +
              '<div class="vb-left">' + avatarHtml + '</div>' +
              '<div class="vb-main">' +
                '<div class="vb-meta">' +
                  '<span class="vb-spk">' + escapeHtml(item.speaker || '旁白') + '</span>' +
                  '<span class="vb-ctx">' + escapeHtml([item.dateStr, item.locName].filter(Boolean).join(' · ')) + '</span>' +
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
          '<div>' +
            '<h2>📜 对话回看 · Backlog</h2>' +
            '<p class="vn-modal-sub">共保留最近 ' + backlogList.length + ' / ' + MAX_BACKLOG + ' 条对白、心声与选项抉择（快捷键 L）</p>' +
          '</div>' +
          '<button type="button" class="tbtn ghost" id="vb-close" style="min-width:86px;padding:6px 14px">关闭</button>' +
        '</div>' +
        '<div class="vn-modal-scroll" id="vb-scroll">' + rowsHtml + '</div>' +
      '</div>';

    ov.classList.remove('hidden');
    var sc = ov.querySelector('#vb-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
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
     二、6 槽位手动存档 / 读档系统（含 1 个自动存档槽）
     ========================================================================= */
  function readManualSlots() {
    try {
      var raw = JSON.parse(localStorage.getItem(MANUAL_SLOTS_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function writeManualSlots(slotsObj) {
    try { localStorage.setItem(MANUAL_SLOTS_KEY, JSON.stringify(slotsObj || {})); } catch (e) {}
  }

  function buildMeta(st, scId, ts) {
    return {
      name: (!st.flags || !st.flags.named) ? '？？？' : (st.alias || st.name || '希尔维亚'),
      ageStr: getAgeLabel(st),
      phaseName: getPhaseLabel(st),
      locName: getLocName(st),
      chapterTitle: getChapterTitleForState(st, scId),
      lv: st.lv || 1,
      gold: st.gold || 0,
      savedAt: formatTimestamp(ts)
    };
  }

  function onAutoSave(st) {
    if (!st) return;
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
    if (typeof toast === 'function') toast('💾 已覆盖保存至存档槽 ' + sid);
    return { ok: true, slot: payload };
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
    if (typeof root.__vnApplyLoadedState === 'function') {
      root.__vnApplyLoadedState(restored, curSc, curChain);
    } else {
      root.S = restored;
    }
    setAutoMode(false);
    setSkipMode(false);
    currentLineMeta = null;
    if (Array.isArray(restoredBacklog)) {
      setBacklog(restoredBacklog);
    }
    if (typeof document !== 'undefined') {
      if (typeof show === 'function') {
        show('title-screen', 0);
        show('game-screen', 1);
        show('panel', 0);
        show('map-overlay', 0);
        show('stats-overlay', 0);
      }
      closeSaveLoadModal();
      closeBacklogModal();
      closeChaptersModal();
      closePrefsModal();
      closeCgLightbox();
    }
    // 清理残余弹窗/战斗/AI抽屉
    if (root.AIChatPanel && typeof root.AIChatPanel.closeDrawer === 'function') {
      root.AIChatPanel.closeDrawer({ wipePending: true });
    }
    if (root.CombatEngine && typeof root.CombatEngine.exitBattle === 'function') {
      root.CombatEngine.exitBattle(false, { silent: true });
    }
    if (typeof updateHUD === 'function') updateHUD();
    if (typeof updateLocBar === 'function') updateLocBar();

    if (curSc && typeof SCENES !== 'undefined' && SCENES[curSc]) {
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
      enterFreeRoam();
    }
    return true;
  }

  function loadFromSlot(slotId) {
    var sid = Number(slotId);
    if (sid === 0) {
      // 自动存档槽
      try {
        var autoRaw = localStorage.getItem(typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'ojousama_save_v1');
        if (!autoRaw) return { ok: false, reason: 'empty' };
        var parsedAuto = JSON.parse(autoRaw);
        applyRestoredPayload(parsedAuto, null, null, null);
        if (typeof toast === 'function') toast('⏩ 已读取自动存档');
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
    if (typeof toast === 'function') toast('📂 已读取存档槽 ' + sid);
    return { ok: true, slot: slot };
  }

  function deleteSlot(slotId) {
    var sid = Number(slotId);
    if (!(sid >= 1 && sid <= 6)) return false;
    var all = readManualSlots();
    if (!all[String(sid)]) return false;
    delete all[String(sid)];
    writeManualSlots(all);
    if (typeof toast === 'function') toast('🗑️ 已删除存档槽 ' + sid);
    return true;
  }

  function getSlotList() {
    var all = readManualSlots();
    var list = [];
    // 自动存档槽 0
    var autoExists = false;
    var autoMeta = null;
    try {
      var autoKey = typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'ojousama_save_v1';
      var rawAuto = localStorage.getItem(autoKey);
      if (rawAuto) {
        autoExists = true;
        var mRaw = localStorage.getItem(AUTO_META_KEY);
        if (mRaw) autoMeta = JSON.parse(mRaw);
        if (!autoMeta) {
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

  function closeSaveLoadModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-saveload-modal');
    if (ov) ov.classList.add('hidden');
    resumeAutoIfActive();
  }

  function openSaveLoadModal(mode) {
    if (typeof document === 'undefined') return null;
    var ov = document.getElementById('vn-saveload-modal');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'vn-saveload-modal';
      ov.className = 'overlay hidden';
      document.body.appendChild(ov);
    }
    var gs = document.getElementById('game-screen');
    var inGame = !!(gs && !gs.classList.contains('hidden'));
    var slots = getSlotList();

    var cardsHtml = slots.map(function (sl) {
      var title = sl.isAuto ? '⚡ 自动存档位' : ('📁 手动槽位 0' + sl.slotId);
      var body = sl.empty
        ? '<div class="sl-empty">── 空置槽位 ──</div>'
        : '<div class="sl-meta">' +
            '<div class="sl-line1"><b>' + escapeHtml(sl.meta.name) + '</b> · ' + escapeHtml(sl.meta.ageStr) + ' · Lv.' + (sl.meta.lv || 1) + '</div>' +
            '<div class="sl-line2">' + escapeHtml(sl.meta.phaseName) + ' · ' + escapeHtml(sl.meta.locName) + '</div>' +
            '<div class="sl-chap">' + escapeHtml(sl.meta.chapterTitle) + '</div>' +
            '<div class="sl-time">' + escapeHtml(sl.meta.savedAt) + '</div>' +
          '</div>';

      var btns = [];
      if (!sl.isAuto && inGame) {
        btns.push('<button type="button" class="sl-btn save" data-sl-save="' + sl.slotId + '">' + (sl.empty ? '保存至此' : '覆盖保存') + '</button>');
      }
      if (!sl.empty) {
        btns.push('<button type="button" class="sl-btn load" data-sl-load="' + sl.slotId + '">读取</button>');
      }
      if (!sl.isAuto && !sl.empty) {
        btns.push('<button type="button" class="sl-btn del" data-sl-del="' + sl.slotId + '">删除</button>');
      }

      return (
        '<article class="sl-card' + (sl.isAuto ? ' auto' : '') + (sl.empty ? ' empty' : '') + '" data-slot="' + sl.slotId + '">' +
          '<div class="sl-head"><span>' + title + '</span></div>' +
          body +
          '<div class="sl-actions">' + btns.join('') + '</div>' +
        '</article>'
      );
    }).join('');

    ov.innerHTML =
      '<div class="end-card vn-modal-card">' +
        '<div class="vn-modal-head">' +
          '<div>' +
            '<h2>💾 存档与读档中心（6 槽位 + 自动存档）</h2>' +
            '<p class="vn-modal-sub">' + (inGame ? '完整保留属性、命运暗流、随身铭记配装与对话回看记录' : '可从标题页直接读取任意手动槽位或自动存档继续游玩') + '</p>' +
          '</div>' +
          '<button type="button" class="tbtn ghost" id="sl-close" style="min-width:86px;padding:6px 14px">关闭</button>' +
        '</div>' +
        '<div class="vn-modal-scroll"><div class="sl-grid">' + cardsHtml + '</div></div>' +
      '</div>';

    ov.classList.remove('hidden');
    ov.querySelector('#sl-close').onclick = closeSaveLoadModal;
    ov.querySelectorAll('[data-sl-save]').forEach(function (b) {
      b.onclick = function () {
        saveToSlot(Number(b.getAttribute('data-sl-save')));
        openSaveLoadModal(mode);
      };
    });
    ov.querySelectorAll('[data-sl-load]').forEach(function (b) {
      b.onclick = function () {
        loadFromSlot(Number(b.getAttribute('data-sl-load')));
      };
    });
    ov.querySelectorAll('[data-sl-del]').forEach(function (b) {
      b.onclick = function () {
        deleteSlot(Number(b.getAttribute('data-sl-del')));
        openSaveLoadModal(mode);
      };
    });
    return ov;
  }

  /* =========================================================================
     三、章节速览与快速重温 / 快捷试玩跳转
     ========================================================================= */
  var FEATURED_QUICK_JUMPS = [
    { id: 's_start', label: '第一卷 · 银与蓝（开篇）', desc: '转生公爵家，开启银发蓝眸的新生。' },
    { id: 's_interlude_white_night', label: '第一卷 间章 · 白夜与细雪（7岁）', desc: '公爵府后花园的初冬薄暮，三姐妹静静并肩的片刻微光。' },
    { id: 's_micro', label: '第一卷 · 微服出行（8岁）', desc: '三姐妹溜进集市的轻喜剧日常。' },
    { id: 's_opening_ceremony', label: '第二卷 · 魔法大学入学（12岁）', desc: '踏入阿斯拉魔法大学，初遇同窗。' },
    { id: 's_aino_sparring', label: '第二卷 · 艾诺冰上实战（12岁冬）', desc: '领悟不经手隔空凝冰与三击切磋。' },
    { id: 's_turnpoint', label: '第二卷 · 转折点一（15岁冬）', desc: '黑夜突袭、东逃抉择与命运暗流汇合。' },
    { id: 's_north_forest', label: '第三卷 · 北林与霁馆（15岁春）', desc: '化名眷寒渔，在澄岚镇练就生根步与送刀。' },
    { id: 's_distant_wind_1', label: '第三卷 · 远行的风（上）', desc: '辞别霁馆父女，带乌木铁剑与木牌北行。' },
    { id: 's_distant_wind_2', label: '第三卷 · 冰封峡谷前线（下）', desc: '护药入赫兰，雪地重逢艾诺并迎战冰蜥。' },
    { id: 's_vol4_frost_watch', label: '第四卷 · 霜原守望（16岁）', desc: '冰封峡谷前线的漫长寒冬，以眷寒渔之名守望北境风雪。' }
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
    if (idx > 0) {
      for (var gi = 0; gi < idx; gi++) {
        var cidPrev = chaps[gi] && chaps[gi].id;
        var gKeys = (cidPrev && gateMap[cidPrev]) || [];
        gKeys.forEach(function (k) { st.flags[k] = 1; });
      }
    }

    var isVol4 = /^s_vol4_/.test(sceneId);
    var isVol3 = !isVol4 && /^s_(black_name|jikan_arrive|north_forest|glow_sheep|distant_wind_1|words_to_wind|eye_of_storm|leaky_cup|distant_wind_2)$/.test(sceneId);
    var isInterlude = sceneId === 's_interlude_white_night';
    var isVol2 = !isVol4 && !isVol3 && !isInterlude && (sceneId === 's_academy_start' || (idx >= chaps.findIndex(function (c) { return c && c.id === 's_opening_ceremony'; }) && idx >= 0));

    if (sceneId === 's_start') {
      st.ageY = 0; st.year = 0; st.month = 3; st.day = 1; st.phase = 'prologue'; st.loc = 'nursery';
      if (locs.nursery) locs.nursery.unlock = true;
    } else if (isInterlude) {
      st.flags.named = 1;
      st.flags.ch_first_word = 1;
      st.flags.ch_alice_born = 1;
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
    } else if (isVol4) {
      st.flags.named = 1;
      st.flags.ch_first_word = 1; st.flags.ch_alice_born = 1; st.flags.ch_beatrice_leaves = 1;
      st.flags.ch_academy = 1; st.flags.did_turnpoint = 1; st.flags.arrived_jikan = 1;
      st.flags.ch_black_name = 1; st.flags.ch_distant_wind_1 = 1; st.flags.ch_distant_wind_2 = 1;
      st.flags.met_noelle = 1; st.flags.met_aino = 1; st.flags.met_charlotte = 1;
      st.alias = '眷寒渔';
      st.phase = 'journey';
      st.ageY = 16;
      st.year = 16;
      st.month = sceneId === 's_vol4_wind_echo' ? 3 : 12;
      st.season = Math.floor(((st.month - 3 + 12) % 12) / 3);
      st.tier = 4;
      st.lv = 42; st.mhp = 275; st.hp = 275; st.mmp = 430; st.mp = 430;
      st.atk = 48; st.mag = 148; st.pdef = 44; st.mdef = 52; st.gold = 55;
      st.skills = ['virtual_duel', 'ice_palace', 'mana_cycle', 'water_ball', 'ice_crystal', 'root_step', 'soft_cut', 'wind_afterimage', 'mana_calc', 'ice_sense'];
      st.loc = sceneId === 's_vol4_frost_watch' ? 'ice_canyon' : 'road';
      ['road', 'jikan', 'chenglan_guild', 'northforest', 'ice_canyon'].forEach(function (k) {
        if (locs[k]) locs[k].unlock = true;
      });
    } else if (isVol3) {
      st.flags.named = 1;
      st.flags.ch_first_word = 1; st.flags.ch_alice_born = 1; st.flags.ch_beatrice_leaves = 1;
      st.flags.ch_academy = 1; st.flags.did_turnpoint = 1; st.flags.arrived_jikan = 1; st.flags.ch_black_name = 1;
      st.alias = sceneId === 's_black_name' ? null : '眷寒渔';
      st.phase = 'journey';
      st.ageY = (sceneId === 's_black_name' || sceneId === 's_jikan_arrive') ? 14 : (sceneId === 's_distant_wind_2' ? 16 : 15);
      st.year = st.ageY === 14 ? 15 : 16;
      st.month = sceneId === 's_distant_wind_2' ? 12 : (sceneId === 's_distant_wind_1' ? 6 : 3);
      st.season = Math.floor(((st.month - 3 + 12) % 12) / 3);
      st.tier = 3;
      st.lv = 36; st.mhp = 240; st.hp = 240; st.mmp = 385; st.mp = 385;
      st.atk = 42; st.mag = 128; st.pdef = 38; st.mdef = 44; st.gold = 35;
      st.skills = ['virtual_duel', 'ice_palace', 'mana_cycle', 'water_ball', 'ice_crystal', 'root_step', 'soft_cut'];
      st.loc = sceneId === 's_distant_wind_2' ? 'road' : 'jikan';
      ['road', 'jikan', 'chenglan_guild', 'northforest'].forEach(function (k) { if (locs[k]) locs[k].unlock = true; });
      if (sceneId === 's_distant_wind_2') {
        st.flags.ch_distant_wind_1 = 1;
        if (locs.ice_canyon) locs.ice_canyon.unlock = true;
      }
    } else if (isVol2) {
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
      // 第一卷（非 s_start）
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
      root.S = st;
      try { syncStatsToAge(); } catch (e) {}
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

    clearBacklog();
    if (typeof root.__vnApplyLoadedState === 'function') {
      root.__vnApplyLoadedState(prepared, null, null);
    } else {
      root.S = prepared;
    }

    if (typeof document !== 'undefined') {
      if (typeof show === 'function') {
        show('title-screen', 0);
        show('game-screen', 1);
        show('panel', 0);
        show('map-overlay', 0);
        show('stats-overlay', 0);
      }
      closeChaptersModal();
      closeSaveLoadModal();
      closeBacklogModal();
      closePrefsModal();
      closeCgLightbox();
    }
    if (root.AIChatPanel && typeof root.AIChatPanel.closeDrawer === 'function') {
      root.AIChatPanel.closeDrawer({ wipePending: true });
    }
    if (root.CombatEngine && typeof root.CombatEngine.exitBattle === 'function') {
      root.CombatEngine.exitBattle(false, { silent: true });
    }
    if (typeof runScene === 'function') runScene(sceneId);
    return true;
  }

  function closeChaptersModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('vn-chapters-modal');
    if (ov) ov.classList.add('hidden');
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
          '<span class="cr-tag">' + (isOpen ? '▶ 重温' : '🔒 未阅读') + '</span>' +
        '</button>'
      );
    }).join('');

    ov.innerHTML =
      '<div class="end-card vn-modal-card">' +
        '<div class="vn-modal-head">' +
          '<div>' +
            '<h2>🔖 章节速览与快速重温</h2>' +
            '<p class="vn-modal-sub">随时重温已解锁章节，或通过快捷试玩直达各卷核心舞台</p>' +
          '</div>' +
          '<button type="button" class="tbtn ghost" id="vc-close" style="min-width:86px;padding:6px 14px">关闭</button>' +
        '</div>' +
        '<div class="vn-modal-scroll">' +
          '<h4 class="rel-sec-title" style="margin-top:0">✦ 快捷试玩直达入口</h4>' +
          '<div class="chap-quick-grid">' + quickHtml + '</div>' +
          '<h4 class="rel-sec-title">📖 全卷章节记录</h4>' +
          '<div class="chap-list">' + listHtml + '</div>' +
        '</div>' +
      '</div>';

    ov.classList.remove('hidden');
    ov.querySelector('#vc-close').onclick = closeChaptersModal;
    ov.querySelectorAll('[data-jump-chap]').forEach(function (btn) {
      btn.onclick = function () {
        jumpToChapter(btn.getAttribute('data-jump-chap'));
      };
    });
    return ov;
  }

  /* =========================================================================
     四、商业级阅读控制栏（Auto / Skip 未读急刹 / 阅读与音效设置）
     ========================================================================= */
  function clampNum(v, lo, hi) {
    var n = Number(v);
    if (isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function normalizeTypeSpeed(val) {
    return (val === 'slow' || val === 'normal' || val === 'fast' || val === 'instant') ? val : 'normal';
  }

  function loadPrefs() {
    if (vnPrefs) return vnPrefs;
    var merged = Object.assign({}, DEFAULT_PREFS);
    try {
      var raw = JSON.parse(localStorage.getItem(VN_PREFS_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (raw.autoSpeed != null) merged.autoSpeed = clampNum(raw.autoSpeed, 300, 6000);
        if (raw.typeSpeed != null) merged.typeSpeed = normalizeTypeSpeed(raw.typeSpeed);
        if (raw.bgmVol != null) merged.bgmVol = clampNum(raw.bgmVol, 0, 1);
        if (raw.sfxVol != null) merged.sfxVol = clampNum(raw.sfxVol, 0, 1);
        if (raw.fxEnabled != null) merged.fxEnabled = !!raw.fxEnabled;
      }
    } catch (e) {}
    vnPrefs = merged;
    return vnPrefs;
  }

  function persistPrefs() {
    try { localStorage.setItem(VN_PREFS_KEY, JSON.stringify(loadPrefs())); } catch (e) {}
  }

  function applyPrefToEngine(key, val) {
    if (key === 'bgmVol') {
      var bgmFn = (root && typeof root.bgmSetVolume === 'function')
        ? root.bgmSetVolume
        : (typeof bgmSetVolume === 'function' ? bgmSetVolume : null);
      if (bgmFn) {
        try { bgmFn(val); } catch (e) {}
      }
    } else if (key === 'sfxVol') {
      var sfxFn = (root && typeof root.sfxSetVolume === 'function')
        ? root.sfxSetVolume
        : (typeof sfxSetVolume === 'function' ? sfxSetVolume : null);
      if (sfxFn) {
        try { sfxFn(val); } catch (e) {}
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
    }
  }

  function syncSavedPrefsToEngine() {
    var hasStored = false;
    try { hasStored = !!localStorage.getItem(VN_PREFS_KEY); } catch (e) {}
    var p = loadPrefs();
    applyPrefToEngine('sfxVol', p.sfxVol);
    applyPrefToEngine('typeSpeed', p.typeSpeed);
    applyPrefToEngine('fxEnabled', p.fxEnabled);
    if (hasStored) {
      applyPrefToEngine('bgmVol', p.bgmVol);
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
    } else if (key === 'fxEnabled') {
      p.fxEnabled = !!value;
    } else {
      return Object.assign({}, p);
    }
    persistPrefs();
    applyPrefToEngine(key, p[key]);
    if (key === 'autoSpeed' && autoMode) {
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
    applyPrefToEngine('typeSpeed', vnPrefs.typeSpeed);
    applyPrefToEngine('fxEnabled', vnPrefs.fxEnabled);
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
      'cg-lightbox', 'vn-prefs-modal', 'vn-backlog-modal', 'vn-saveload-modal',
      'vn-chapters-modal', 'arena-loadout-modal', 'ice-deduction-modal', 'rumor-overlay',
      'panel', 'map-overlay', 'stats-overlay', 'backlog-overlay', 'help-screen',
      'codex', 'pick-screen', 'arena-overlay', 'duel-screen', 'battle-screen',
      'sys-popup', 'ai-drawer', 'letter-demo', 'card'
    ];
    for (var i = 0; i < ids.length; i++) {
      if (isModalVisible(document.getElementById(ids[i]))) return true;
    }
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
    if (cs && !cs.classList.contains('hidden')) return true;
    var tb = document.getElementById('text-box');
    if (!tb || tb.classList.contains('dialog-hidden') || tb.classList.contains('season-flavor')) return false;
    return true;
  }

  function clearAutoTimer() {
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
  }

  function performAdvance() {
    if (!canAdvanceReading()) return false;
    var cs = typeof document !== 'undefined' ? document.getElementById('cg-screen') : null;
    if (cs && !cs.classList.contains('hidden')) {
      if (typeof cs.onclick === 'function') {
        try { cs.onclick(); return true; } catch (e) {}
      }
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
    var delay = loadPrefs().autoSpeed;
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (!autoMode) return;
      if (isDialogTyping()) {
        scheduleAutoStep();
        return;
      }
      if (!canAdvanceReading()) {
        // 选项、弹窗、战斗或自由探索期间静默暂停，待条件恢复后再继续
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
    if (ov) ov.classList.add('hidden');
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
    var p = loadPrefs();
    var bgmPct = Math.round(p.bgmVol * 100);
    var sfxPct = Math.round(p.sfxVol * 100);

    ov.innerHTML =
      '<div class="end-card vn-modal-card vn-prefs-card">' +
        '<div class="vn-modal-head">' +
          '<div>' +
            '<span class="rumor-kicker">READING &amp; AUDIO PREFERENCES</span>' +
            '<h2>阅读与音效设置</h2>' +
            '<p class="vn-modal-sub">所有偏好自动保存至本地，实时同步打字机、独立音量与场景粒子</p>' +
          '</div>' +
          '<button type="button" class="tbtn ghost" id="pref-close" style="min-width:78px;padding:6px 14px">关闭</button>' +
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
          '</div>' +
          '<div class="prefs-group">' +
            '<div class="prefs-row">' +
              '<div class="prefs-label"><b>场景氛围粒子</b><span>飞雪、微光与冰尘动态氛围层</span></div>' +
              '<button type="button" class="prefs-toggle' + (p.fxEnabled ? ' on' : '') + '" id="pref-fx-toggle" aria-pressed="' + (p.fxEnabled ? 'true' : 'false') + '">' +
                (p.fxEnabled ? '已开启 · 星霜微尘' : '已关闭 · 纯净画面') +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="prefs-foot">' +
          '<button type="button" class="sl-btn" id="pref-reset" style="flex:0 0 auto;padding:6px 14px">恢复默认</button>' +
          '<span class="prefs-hint">按 Esc 关闭设置面板</span>' +
        '</div>' +
      '</div>';

    ov.classList.remove('hidden');
    ov.onclick = function (e) {
      if (e.target === ov) closePrefsModal();
    };
    ov.querySelector('#pref-close').onclick = closePrefsModal;
    ov.querySelector('#pref-reset').onclick = function () {
      resetPrefs();
      showToast('✦ 已恢复阅读与音效默认设置');
    };
    ov.querySelectorAll('[data-pref-auto]').forEach(function (btn) {
      btn.onclick = function () {
        setPref('autoSpeed', Number(btn.getAttribute('data-pref-auto')));
      };
    });
    ov.querySelectorAll('[data-pref-type]').forEach(function (btn) {
      btn.onclick = function () {
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
      };
    }
    var fxBtn = ov.querySelector('#pref-fx-toggle');
    if (fxBtn) {
      fxBtn.onclick = function () {
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
     五、四合一「典藏图鉴馆」（CG 画廊 / BGM 音乐室 / 成就墙 / 信物手札）
     ========================================================================= */
  var CG_GALLERY_CATALOG = [
    {
      id: 'cool_off.png',
      file: 'cool_off.png',
      title: '午后树荫的冰霜之息',
      vol: '第一卷 · 公爵篇',
      quote: '「姐姐大人是冰系真好……嗯。再来一口？」',
      unlockKey: 'cool_off.png',
      unlockFlags: ['ch_alice_affinity', 'ch_beatrice_day', 'ch_micro', 'ch_academy'],
      unlockChapters: ['s_alice_affinity']
    },
    {
      id: 'reno_story.png',
      file: 'reno_story.png',
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
      file: 'beatrice_battle.png',
      title: '东翼死路 · 长女立阵',
      vol: '第二卷 · 学院篇',
      quote: '「十七岁的贝阿特丽丝站在仆人通道正中，前封后追，只回头留下一句：我在这里挡一下。」',
      unlockKey: 'beatrice_battle.png',
      unlockFlags: ['did_turnpoint'],
      unlockChapters: ['s_turnpoint']
    },
    {
      id: 'parting.png',
      file: 'parting.png',
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
      file: 'vol3_ash_snow.png',
      title: '暗渠之外 · 灰烬初雪',
      vol: '第三卷 · 旅途篇',
      quote: '「白雪落满她的长发，白落在白上，分不清哪些是今冬的雪，哪些是她自己。」',
      unlockKey: 'vol3_ash_snow.png',
      unlockFlags: ['ch_words_to_wind'],
      unlockChapters: ['s_words_to_wind']
    },
    {
      id: 'vol3_jikan_parting.png',
      file: 'vol3_jikan_parting.png',
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
      file: 'vol3_ice_canyon_clash.png',
      title: '风雪重逢 · 隔空钢冰',
      vol: '第三卷 · 旅途篇',
      quote: '「菱形钢冰短锥在艾诺肩后半尺凭空成形，飞雪掠过衣领，浅蓝眼眸穿过漫天雪沫笔直落来。」',
      unlockKey: 'vol3_ice_canyon_clash.png',
      unlockFlags: ['ch_distant_wind_2'],
      unlockAchs: ['frost_reunion'],
      unlockChapters: ['s_distant_wind_2']
    }
  ];

  var MEMENTO_CATALOG = [
    {
      id: 'alice_letter',
      name: '爱丽丝的风铃草信笺',
      icon: '✉️',
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
      icon: '❄️',
      owner: '艾诺 · 赫兰雪原',
      era: '学院切磋 / 冰封峡谷',
      salutation: '赫兰雪原 · 赠物纪要',
      body: '边角绣着六瓣浅蓝小雪花的洁白亚麻帕。\n在冰封峡谷的风雪里被随手抛来，接住时仍带着雪后松林般的清冽冷香。',
      sign: '艾诺',
      note: '沾上的细雪融尽之后，帕角依旧挺括干净，连折角都与主人一般利落。',
      invIds: ['aino_handkerchief', 'aino_academy_handkerchief'],
      relicIds: ['aino_handkerchief', 'aino_academy_handkerchief'],
      flags: ['aino_handkerchief', 'ch_distant_wind_2'],
      achs: ['frost_reunion']
    },
    {
      id: 'peilin_note',
      name: '沛霖的药行纸条',
      icon: '🍵',
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
      icon: '📜',
      owner: '未署名 · 冷薄荷茶香',
      era: '学院末夜与暗潮前夕',
      salutation: '未署名 · 换防抄件',
      body: '东门换岗在子时二刻，水渠南闸唯独寅初少一轮巡哨。\n字迹工整如尺量，收笔干脆，通篇未落任何家徽与名姓。',
      sign: '留香：冷薄荷茶',
      note: '抄件叠成方正的四角，连递出警示都带着一贯的体面与傲气。',
      invIds: ['belmont_schedule', 'belmont_challenge'],
      relicIds: ['belmont_schedule', 'belmont_challenge'],
      flags: ['belmont_schedule', 'did_turnpoint']
    },
    {
      id: 'ebony_sword',
      name: '乌木紫穗剑',
      icon: '🗡️',
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
      icon: '🐚',
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
    return true;
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

  function isCgUnlocked(item) {
    if (!item) return false;
    var cgMap = loadUnlockedCgs();
    if (cgMap[item.unlockKey] || cgMap[item.file]) return true;
    var st = getS();
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

  function isMementoUnlocked(item) {
    if (!item) return false;
    var st = getS();
    if (!st) return false;
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

  function closeCgLightbox() {
    if (typeof document === 'undefined') return;
    var lb = document.getElementById('cg-lightbox');
    if (lb) lb.classList.add('hidden');
  }

  function openCgLightbox(entry) {
    if (typeof document === 'undefined' || !entry) return null;
    var lb = document.getElementById('cg-lightbox');
    if (!lb) {
      lb = document.createElement('section');
      lb.id = 'cg-lightbox';
      lb.className = 'hidden';
      document.body.appendChild(lb);
    }
    var primarySrc = 'assets/cg/' + entry.file;
    var fallbackSrc = entry.fallbackSrc || '';

    lb.innerHTML =
      '<div class="cg-lb-inner">' +
        '<button type="button" class="cg-lb-close" id="cg-lb-close" aria-label="关闭大图鉴赏">×</button>' +
        '<div class="cg-lb-frame">' +
          '<img class="cg-lb-img" id="cg-lb-img" src="' + escapeHtml(primarySrc) + '" alt="' + escapeHtml(entry.title) + '"/>' +
        '</div>' +
        '<div class="cg-lb-caption">' +
          '<div class="cg-lb-meta"><span class="cg-lb-vol">' + escapeHtml(entry.vol) + '</span><h3>' + escapeHtml(entry.title) + '</h3></div>' +
          '<p class="cg-lb-quote">' + escapeHtml(entry.quote) + '</p>' +
          '<span class="cg-lb-hint">点击暗幕或按 Esc 返回画廊</span>' +
        '</div>' +
      '</div>';

    var img = lb.querySelector('#cg-lb-img');
    if (img) {
      img.onerror = function () {
        if (fallbackSrc && !img.getAttribute('data-fb-applied')) {
          img.setAttribute('data-fb-applied', '1');
          img.src = fallbackSrc;
        }
      };
    }
    lb.classList.remove('hidden');
    lb.onclick = function (e) {
      if (e.target === lb || (e.target && e.target.id === 'cg-lb-img')) closeCgLightbox();
    };
    lb.querySelector('#cg-lb-close').onclick = function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      closeCgLightbox();
    };
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
              '<div class="cg-lock-sigil" aria-hidden="true">❖</div>' +
              '<div class="cg-lock-label">尚未解锁 · 推进对应章节开启</div>' +
            '</div>' +
            '<div class="cg-card-foot">' +
              '<span class="cg-vol-pill">' + escapeHtml(item.vol) + '</span>' +
              '<div class="cg-card-title">未启封剪影</div>' +
            '</div>' +
          '</article>'
        );
      }
      var src = 'assets/cg/' + item.file;
      return (
        '<button type="button" class="codex-cg-card unlocked" data-cg-open="' + escapeHtml(item.id) + '">' +
          '<div class="cg-thumb-wrap">' +
            '<img class="cg-thumb-img" src="' + escapeHtml(src) + '" data-fallback="' + escapeHtml(item.fallbackSrc || '') + '" alt="' + escapeHtml(item.title) + '"/>' +
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
        '<span>✦ 已收录典藏 CG <b>' + unlockedCount + ' / ' + CG_GALLERY_CATALOG.length + '</b></span>' +
        '<span class="codex-sec-hint">点击已解锁画作开启高清全屏鉴赏</span>' +
      '</div>' +
      '<div class="codex-cg-grid">' + cardsHtml + '</div>';

    container.querySelectorAll('.cg-thumb-img').forEach(function (img) {
      var fb = img.getAttribute('data-fallback');
      img.onerror = function () {
        if (fb && !img.getAttribute('data-fb-applied')) {
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

  function renderCodexBgmTab(container) {
    var groups = (root && root.BGM_GROUPS) || (typeof BGM_GROUPS !== 'undefined' ? BGM_GROUPS : {});
    var files = (root && root.BGM_FILES) || (typeof BGM_FILES !== 'undefined' ? BGM_FILES : {});
    var groupKeys = Object.keys(groups);
    var totalTracks = 0;
    groupKeys.forEach(function (g) {
      if (Array.isArray(groups[g])) totalTracks += groups[g].length;
    });

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
        var fileLabel = files[tk] ? String(files[tk]).replace(/^Music\//i, '').replace(/\.mp3$/i, '') : tk;
        return (
          '<div class="bgm-track-row' + (playing ? ' active' : '') + '" data-bgm-row="' + escapeHtml(tk) + '">' +
            '<button type="button" class="bgm-play-btn" data-bgm-key="' + escapeHtml(tk) + '">' +
              (playing ? '■ 停止' : '▶ 播放') +
            '</button>' +
            '<div class="bgm-track-meta">' +
              '<span class="bgm-track-title">' + escapeHtml(title) + '</span>' +
              '<span class="bgm-track-sub">' + escapeHtml(fileLabel) + '</span>' +
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
            '<span class="bgm-now-kicker">NOW AUDITIONING · 全曲目 ' + totalTracks + ' 首</span>' +
            '<b id="bgm-now-title">' + escapeHtml(activeTitle) + '</b>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="sl-btn" id="bgm-room-stop" style="flex:0 0 auto;padding:6px 14px"' + (codexPlayingTrack ? '' : ' disabled') + '>停止试听</button>' +
      '</div>' +
      '<div class="bgm-groups-wrap">' + (groupsHtml || '<p class="vb-empty">尚未载入原声曲目目录。</p>') + '</div>';

    var stopBtn = container.querySelector('#bgm-room-stop');
    if (stopBtn) {
      stopBtn.onclick = function () {
        codexPlayingTrack = null;
        callBgmStop();
        renderCodexBgmTab(container);
      };
    }
    container.querySelectorAll('[data-bgm-key]').forEach(function (btn) {
      btn.onclick = function () {
        var key = btn.getAttribute('data-bgm-key');
        if (codexPlayingTrack === key) {
          codexPlayingTrack = null;
          callBgmStop();
        } else {
          codexPlayingTrack = key;
          callBgmPlay(key);
        }
        renderCodexBgmTab(container);
      };
    });
  }

  function renderCodexAchTab(container) {
    var achList = (root && Array.isArray(root.ACH) && root.ACH)
      || (typeof ACH !== 'undefined' && Array.isArray(ACH) ? ACH : []);
    var st = getS();
    var achMap = (st && st.ach) ? st.ach : {};
    var doneCount = achList.filter(function (a) { return a && achMap[a.id]; }).length;
    var pct = achList.length ? Math.round((doneCount / achList.length) * 100) : 0;

    var cardsHtml = achList.map(function (a) {
      var got = !!achMap[a.id];
      var isSecret = !got && /^egg_/.test(a.id);
      return (
        '<article class="ach-card' + (got ? ' unlocked' : ' locked') + '">' +
          '<div class="ach-card-top">' +
            '<span class="ach-badge">' + (got ? '✦' : '🔒') + '</span>' +
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
          '<span>✦ 成就收集进度：<b>已达成 ' + doneCount + ' / ' + achList.length + '</b></span>' +
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
              '<span class="memento-ico">🔒</span>' +
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
            '<div class="ms-crest" aria-hidden="true">❄</div>' +
            '<div class="ms-salutation">' + escapeHtml(m.salutation) + '</div>' +
            '<div class="ms-body">' + escapeHtml(m.body).replace(/\n/g, '<br>') + '</div>' +
            '<div class="ms-sign">—— ' + escapeHtml(m.sign) + '</div>' +
            '<div class="ms-note">' + escapeHtml(m.note) + '</div>' +
          '</div>'
        : '';
      return (
        '<article class="memento-card unlocked' + (expanded ? ' expanded' : '') + '" data-memento-id="' + escapeHtml(m.id) + '">' +
          '<button type="button" class="memento-toggle-btn" data-memento-open="' + escapeHtml(m.id) + '">' +
            '<span class="memento-ico">' + m.icon + '</span>' +
            '<div class="memento-titles">' +
              '<div class="memento-name">' + escapeHtml(m.name) + '</div>' +
              '<div class="memento-owner">' + escapeHtml(m.owner) + ' · ' + escapeHtml(m.era) + '</div>' +
            '</div>' +
            '<span class="memento-pill open">' + (expanded ? '收起手札 ▲' : '展阅信笺 ▼') + '</span>' +
          '</button>' +
          stationeryHtml +
        '</article>'
      );
    }).join('');

    container.innerHTML =
      '<div class="codex-section-bar">' +
        '<span>✦ 已收录旅途信物 <b>' + openCount + ' / ' + MEMENTO_CATALOG.length + '</b></span>' +
        '<span class="codex-sec-hint">点击已获得信物，展开典藏信笺卡片细读原文</span>' +
      '</div>' +
      '<div class="memento-grid">' + cardsHtml + '</div>';

    container.querySelectorAll('[data-memento-open]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-memento-open');
        codexExpandedMemento = (codexExpandedMemento === id) ? null : id;
        renderCodexMementoTab(container);
      };
    });
  }

  function openCodexGallery(tab) {
    if (typeof document === 'undefined') return null;
    var codexEl = document.getElementById('codex');
    if (!codexEl) return null;
    var validTabs = ['cg', 'bgm', 'ach', 'memento'];
    codexCurrentTab = validTabs.indexOf(tab) !== -1 ? tab : 'cg';

    var h2 = codexEl.querySelector('.modal-head h2');
    if (h2) h2.textContent = '典藏图鉴馆';

    var tabsEl = document.getElementById('codex-tabs');
    var listEl = document.getElementById('codex-list');
    if (!tabsEl || !listEl) return codexEl;

    var cgCount = CG_GALLERY_CATALOG.filter(isCgUnlocked).length;
    var achList = (root && Array.isArray(root.ACH) && root.ACH)
      || (typeof ACH !== 'undefined' && Array.isArray(ACH) ? ACH : []);
    var st = getS();
    var achCount = achList.filter(function (a) { return a && st && st.ach && st.ach[a.id]; }).length;
    var memCount = MEMENTO_CATALOG.filter(isMementoUnlocked).length;
    var filesMap = (root && root.BGM_FILES) || (typeof BGM_FILES !== 'undefined' ? BGM_FILES : {});
    var bgmTotal = Object.keys(filesMap).length;

    var tabDefs = [
      { id: 'cg', label: 'CG 画廊', badge: cgCount + '/' + CG_GALLERY_CATALOG.length },
      { id: 'bgm', label: 'BGM 音乐室', badge: String(bgmTotal) },
      { id: 'ach', label: '成就墙', badge: achCount + '/' + achList.length },
      { id: 'memento', label: '信物手札', badge: memCount + '/' + MEMENTO_CATALOG.length }
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
        openCodexGallery(btn.getAttribute('data-codex-tab'));
      };
    });

    if (codexCurrentTab === 'cg') renderCodexCgTab(listEl);
    else if (codexCurrentTab === 'bgm') renderCodexBgmTab(listEl);
    else if (codexCurrentTab === 'ach') renderCodexAchTab(listEl);
    else renderCodexMementoTab(listEl);

    if (typeof show === 'function') show('codex', 1);
    else codexEl.classList.remove('hidden');
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
        bLog.innerHTML = SVG_LOG;
        bLog.onclick = function () { toggleBacklogModal(); };
        hudRight.insertBefore(bLog, document.getElementById('btn-ui') || hudRight.firstChild);
      } else {
        // 统一接管主界面已有 #btn-backlog，使其直接打开 200 条增强回看弹窗且避免重复按钮
        var existingLog = document.getElementById('btn-backlog');
        existingLog.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          toggleBacklogModal();
        };
      }
      if (!document.getElementById('btn-saveload')) {
        var bSl = document.createElement('button');
        bSl.id = 'btn-saveload';
        bSl.className = 'chip chip-vn';
        bSl.title = '存档 / 读档（6槽位）';
        bSl.innerHTML = SVG_SAVE;
        bSl.onclick = function () { openSaveLoadModal('save'); };
        hudRight.insertBefore(bSl, document.getElementById('btn-ui') || hudRight.firstChild);
      }
      if (!document.getElementById('btn-chapters')) {
        var bCh = document.createElement('button');
        bCh.id = 'btn-chapters';
        bCh.className = 'chip chip-vn';
        bCh.title = '章节速览与快速试玩';
        bCh.innerHTML = SVG_CHAP;
        bCh.onclick = function () { openChaptersModal(); };
        hudRight.insertBefore(bCh, document.getElementById('btn-ui') || hudRight.firstChild);
      }
    }

    var tb = document.getElementById('text-box');
    if (tb) {
      // 仅在 #text-box 尚无任何回看按钮时补充入口，防止与 #btn-backlog 双重堆叠
      if (!document.getElementById('tb-backlog-btn') && !tb.querySelector('#btn-backlog')) {
        var tbBtn = document.createElement('button');
        tbBtn.type = 'button';
        tbBtn.id = 'tb-backlog-btn';
        tbBtn.className = 'tb-backlog-btn';
        tbBtn.title = '对话历史回看 (L)';
        tbBtn.innerHTML = SVG_LOG + ' <span>回看 L</span>';
        tbBtn.onclick = function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          openBacklogModal();
        };
        tb.appendChild(tbBtn);
      }

      // M5.1：对话框右上角紧邻 #btn-backlog 的半透明阅读控制簇
      if (!document.getElementById('vn-read-controls')) {
        var ctrlWrap = document.createElement('div');
        ctrlWrap.id = 'vn-read-controls';
        ctrlWrap.className = 'vn-read-controls';
        ctrlWrap.setAttribute('aria-label', '阅读控制栏');

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

        ctrlWrap.appendChild(btnAuto);
        ctrlWrap.appendChild(btnSkip);
        ctrlWrap.appendChild(btnPrefs);
        tb.appendChild(ctrlWrap);
      }
      updateReadControlUI();
    }

    // M1.3：标题页按钮与 #btn-new 保持 100% 视觉规范一致
    var titleMenu = document.querySelector('#title-screen .title-menu');
    if (titleMenu) {
      var anchor = document.getElementById('btn-arena-title') || document.getElementById('btn-codex');
      var existingLoad = document.getElementById('btn-title-loads');
      if (!existingLoad) {
        var tLoad = document.createElement('button');
        tLoad.type = 'button';
        tLoad.id = 'btn-title-loads';
        tLoad.className = 'tbtn tbtn-editorial';
        tLoad.innerHTML = '<span class="tbtn-ico" aria-hidden="true">' + SVG_SAVE_TITLE + '</span><span class="tbtn-text">存档档案</span><span class="tbtn-en">ARCHIVE</span>';
        tLoad.onclick = function () { openSaveLoadModal('load'); };
        titleMenu.insertBefore(tLoad, anchor);
      } else {
        existingLoad.className = 'tbtn tbtn-editorial';
        existingLoad.innerHTML = '<span class="tbtn-ico" aria-hidden="true">' + SVG_SAVE_TITLE + '</span><span class="tbtn-text">存档档案</span><span class="tbtn-en">ARCHIVE</span>';
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
      }
    }

    // M5.2：接管标题页图鉴入口，打开四合一「典藏图鉴馆」
    var codexBtn = document.getElementById('btn-codex');
    if (codexBtn) {
      codexBtn.onclick = function () {
        openCodexGallery('cg');
      };
    }
    var codexCloseBtn = document.getElementById('btn-codex-close');
    if (codexCloseBtn) {
      codexCloseBtn.onclick = function () {
        closeCgLightbox();
        if (typeof show === 'function') show('codex', 0);
        else {
          var cx = document.getElementById('codex');
          if (cx) cx.classList.add('hidden');
        }
      };
    }
  }

  function closeTopmostVNModal() {
    if (typeof document === 'undefined') return false;
    var order = [
      { id: 'cg-lightbox', close: closeCgLightbox },
      { id: 'vn-prefs-modal', close: closePrefsModal },
      { id: 'vn-backlog-modal', close: closeBacklogModal },
      { id: 'vn-saveload-modal', close: closeSaveLoadModal },
      { id: 'vn-chapters-modal', close: closeChaptersModal },
      {
        id: 'arena-loadout-modal',
        close: function (el) {
          if (root.RelicsAndEvents && typeof root.RelicsAndEvents.closeArenaLoadoutModal === 'function') {
            try { root.RelicsAndEvents.closeArenaLoadoutModal(); } catch (e) {}
          }
          el.classList.add('hidden');
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
        }
      },
      {
        id: 'rumor-overlay',
        close: function (el) {
          if (root.RelicsAndEvents && typeof root.RelicsAndEvents.closeRumorBoard === 'function') {
            try { root.RelicsAndEvents.closeRumorBoard(); } catch (e) {}
          }
          el.classList.add('hidden');
        }
      }
    ];

    for (var i = 0; i < order.length; i++) {
      var item = order[i];
      var el = document.getElementById(item.id);
      if (isModalVisible(el)) {
        item.close(el);
        return true;
      }
    }
    return false;
  }

  function bindHotkeys() {
    if (typeof document === 'undefined' || root.__vnUxKeyBound) return;
    root.__vnUxKeyBound = true;

    // M1.5：使用捕获阶段监听 Escape，确保永远优先关闭最顶层弹窗且杜绝与 game.js 冲突
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (closeTopmostVNModal()) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
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
    loadPrefs();
    syncSavedPrefsToEngine();
    ensureVNUIButtons();
    bindHotkeys();
  }

  var API = {
    MAX_BACKLOG: MAX_BACKLOG,
    VN_PREFS_KEY: VN_PREFS_KEY,
    READ_LINES_KEY: READ_LINES_KEY,
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
    openCgLightbox: openCgLightbox,
    closeCgLightbox: closeCgLightbox,
    markCgUnlocked: markCgUnlocked
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
