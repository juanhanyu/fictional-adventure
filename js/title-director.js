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

  // 标题页曲库试听目录（全 27 首：优雅西幻文艺曲名 + 清晰场景副标；注释标注磁盘英文功能文件名）
  var SOUNDTRACK_CATALOG = [
    { key: 'title_overture', title: '雪晶序曲', mood: '主界面 · 奇幻开篇' },           // Title - Main Theme.mp3
    { key: 'peaceful1', title: '晨光圆舞 I', mood: '第一章 · 宅邸清晨日常' },         // Peaceful 1.mp3
    { key: 'peaceful2', title: '公爵午后 II', mood: '宅邸午后 · 霁馆烟火' },          // Peaceful 2.mp3
    { key: 'cheerful1', title: '阳光集市 I', mood: '集市小镇 · 花园 · 海滨' },        // Cheerful 1.mp3
    { key: 'cheerful2', title: '庭院嬉游 II', mood: '三姐妹午后 · 澄岚公会' },        // Cheerful 2.mp3
    { key: 'academy1', title: '阿斯拉钟塔 I', mood: '魔法学院 · 教室 · 图书馆' },     // Magical Academy 1.mp3
    { key: 'academy2', title: '星穹书库 II', mood: '学院走廊 · 课间日常' },           // Magical Academy 2.mp3
    { key: 'relax1', title: '雪夜壁炉 I', mood: '宿舍夜谈 · 篝火休憩' },              // Peaceful & Relaxing 1.mp3
    { key: 'relax2', title: '霜月静思 II', mood: '雪夜露台 · 星祭 · 花坊' },          // Peaceful & Relaxing 2.mp3
    { key: 'sacred1', title: '贵族纹章 I', mood: '大礼堂 · 勇者之赐 · 仪典' },        // Sacred 1.mp3
    { key: 'sacred2', title: '冰晶宫殿 II', mood: '礼拜堂 · 觉醒 · 七座山' },         // Sacred 2.mp3
    { key: 'emotional1', title: '霜月挽歌', mood: '离巢告别 · 冰融 · 双轨终幕' },     // Emotional 1.mp3
    { key: 'romantic', title: '炉火余韵', mood: '海与贝壳 · 黄昏谈心 · 求婚' },       // Romantic.mp3
    { key: 'northern_frontier', title: '北境远行', mood: '北风堡 · 赫兰雪原与冻土孤旅' }, // Travel - Northern Frontier.mp3
    { key: 'starry_flight', title: '星河乘风', mood: '萤尾羊星河 · 乘风飞翔' },       // Story - Starry Flight.mp3
    { key: 'sad1', title: '寒夜哀歌', mood: '政变火夜 · 悲剧哀悼' },                  // Melancholic & Sad 1.mp3
    { key: 'suspense1', title: '冰晶复调', mood: '血案推理 · 寒夜推演盘' },           // Suspense - Investigation.mp3
    { key: 'upset', title: '上锁书房', mood: '暗潮对峙 · 地下酒窖 · 冰封峡谷' },      // Upset.mp3
    { key: 'comedy_medium', title: '微服谐趣', mood: '微服私访 · 轻快诙谐' },         // Comical_medium-speed.mp3
    { key: 'comedy_fast', title: '追风闹剧', mood: '高速搞笑 · 追逐彩蛋' },           // Comical_fast-speed.mp3
    { key: 'duel1', title: '学院剑舞 I', mood: '姐妹切磋 · 学院比试战' },             // Battle - Sparring Duel.mp3
    { key: 'duel2', title: '演武晴锋 II', mood: '演武大厅 · 贵族试手' },              // Battle - Arena Lobby.mp3
    { key: 'battle1', title: '锋刃交错 I', mood: '魔兽遭遇 · 血案死斗 · 突围战' },    // Battle & Tension 1.mp3
    { key: 'battle2', title: '霜原决意 II', mood: '强敌二阶段 · 宿命死斗' },          // Battle & Tension 2.mp3
    { key: 'boss_windgod', title: '风神试剑', mood: '列强试炼 · 风神一阶段专属' },     // Battle - Wind God Trial.mp3
    { key: 'boss_finale', title: '破冰终章', mood: '风神二阶段 · 终章斩龙史诗' },     // Battle - Dragon Finale.mp3
    { key: 'victory1', title: '凯旋乐章', mood: '战斗胜利 · 战术制胜与演武凯旋' }     // Battle - Victory March.mp3
  ];

  var TYPE_SPEED_OPTS = [
    { value: 'instant', label: '即时' },
    { value: 'fast', label: '快速' },
    { value: 'normal', label: '舒缓' }
  ];

  var COMBAT_RING_ASSIST_KEY = 'combat_ring_assist_mode';
  var COMBAT_CASUAL_MODE_KEY = 'combat_casual_mode';
  var COMBAT_AUTO_END_KEY = 'combat_auto_end_turn';

  var RING_ASSIST_OPTS = [
    { value: 'standard', label: '标准' },
    { value: 'relaxed', label: '宽松' },
    { value: 'off', label: '自动' }
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
    titleBgmPausedByUser: false,
    wasTitleVis: false,
    lastSfxPingAt: 0,
    focusedMenuId: null,
    fusion: null
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
    var checkIds = ['battle-screen', 'letter-demo', 'codex', 'cg-lightbox', 'help-screen', 'arena-overlay', 'arena-loadout-modal', 'ending-screen', 'rumor-overlay', 'ice-deduction-modal', 'schedule-overlay', 'shop-overlay', 'mailbox-overlay', 'vn-chapters-modal', 'vn-saveload-modal', 'vn-prefs-modal', 'card', 'sys-popup'];
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
      if (isAnyModalBlocking()) {
        st.dustLastTs = 0;
        st.dustRaf = requestAnimationFrame(step);
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
     2b. 方案 B 非欧星轨天球仪 × 方案 C 缩放高维折叠圣晶 融合渲染引擎
         三层精准景深叠合：
         [1] Back Canvas2D  : 光学焦散丝带 + 体积光晕 + 4 组天球星环后半段 + 后景分形碎晶
         [2] Center WebGL   : 透明画布缩放版「高维折叠圣晶」GLSL SDF 光线步进核心（带自动 2D 降级）
         [3] Front Canvas2D : 4 组天球星环前半段（环绕晶核前方）+ 前景碎晶 + 四芒星闪 + 引力星尘 + 点击冲击波
     ========================================================================= */

  function createFusionCrystalEngine(stageEl) {
    if (!hasDom() || isJsdom() || !stageEl) return null;

    var wrap = stageEl.querySelector('.v3-fusion-stage');
    if (wrap && st.fusion && st.fusion.wrap === wrap) return st.fusion;

    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'v3-fusion-stage';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML =
        '<canvas class="v3-fusion-2d v3-fusion-back" aria-hidden="true"></canvas>' +
        '<canvas class="v3-fusion-gl" aria-hidden="true"></canvas>' +
        '<canvas class="v3-fusion-2d v3-fusion-front" aria-hidden="true"></canvas>' +
        '<button type="button" class="v3-fusion-hit" tabindex="-1" aria-label="交互星轨高维圣晶"></button>';
      stageEl.appendChild(wrap);
    }
    stageEl.classList.add('has-fusion');

    var backCanvas = wrap.querySelector('.v3-fusion-back');
    var glCanvas = wrap.querySelector('.v3-fusion-gl');
    var frontCanvas = wrap.querySelector('.v3-fusion-front');
    var hitBtn = wrap.querySelector('.v3-fusion-hit');

    var backCtx = null;
    var frontCtx = null;
    try {
      backCtx = backCanvas.getContext('2d', { alpha: true });
      frontCtx = frontCanvas.getContext('2d', { alpha: true });
    } catch (e) {}
    if (!backCtx || !frontCtx) {
      stageEl.classList.remove('has-fusion');
      return null;
    }

    /* Snow-Porcelain Daylight Palette matching V3 Title Screen & Scheme B */
    var PAL = {
      goldMain: [198, 158, 86],
      goldBright: [242, 212, 148],
      goldSoft: [212, 178, 114],
      goldShadow: [134, 96, 40],
      sapphireDeep: [14, 52, 148],
      sapphireMid: [34, 98, 224],
      sapphireBright: [82, 168, 252],
      iceBright: [152, 220, 255],
      iceWhite: [255, 255, 255],
      violetAccent: [112, 122, 232],
      causticA: [54, 142, 240],
      causticB: [204, 164, 94],
      rayColor: [96, 172, 250],
      gridLine: [26, 48, 96],
      glintCore: [255, 255, 255],
      dustPrimary: [46, 114, 224],
      dustGold: [198, 156, 84]
    };

    function lerp(a, b, t) { return a + (b - a) * t; }
    function smoothstep(t) { return t * t * (3 - 2 * t); }
    function rgba(rgb, a) {
      return 'rgba(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ',' + clamp(a, 0, 1).toFixed(4) + ')';
    }

    function rotX(v, a) {
      var c = Math.cos(a), s = Math.sin(a);
      return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
    }
    function rotY(v, a) {
      var c = Math.cos(a), s = Math.sin(a);
      return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    }
    function rotZ(v, a) {
      var c = Math.cos(a), s = Math.sin(a);
      return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
    }
    function rotEuler(v, rx, ry, rz) {
      return rotZ(rotY(rotX(v, rx), ry), rz);
    }
    function normalize(v) {
      var l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    }
    function cross(a, b) {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
    }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

    /* 4 Counter-Rotating Non-Euclidean 3D Armillary Rings (Scheme B) */
    var ARMILLARY_RINGS = [
      {
        radius: 1.04, expandMult: 1.14, bandHalf: 0.036,
        tiltX: 1.16, tiltY: 0.34, tiltZ: 0.22,
        spinSpeed: 0.16, precessAmp: 0.14, precessFreq: 0.32,
        style: 'gold_ecliptic', ticks: 72, majorEvery: 6, nodes: 6, comets: 2
      },
      {
        radius: 0.87, expandMult: 1.17, bandHalf: 0.028,
        tiltX: -0.96, tiltY: 0.78, tiltZ: -0.45,
        spinSpeed: -0.27, precessAmp: 0.22, precessFreq: 0.48,
        style: 'sapphire_arcane', ticks: 48, majorEvery: 4, nodes: 8, comets: 2
      },
      {
        radius: 0.71, expandMult: 1.22, bandHalf: 0.022,
        tiltX: 0.58, tiltY: -1.12, tiltZ: 0.68,
        spinSpeed: 0.41, precessAmp: 0.34, precessFreq: 0.71,
        style: 'hyper_echo', ticks: 36, majorEvery: 3, nodes: 4, comets: 1
      },
      {
        radius: 0.54, expandMult: 1.28, bandHalf: 0.015,
        tiltX: 1.34, tiltY: -0.26, tiltZ: -0.52,
        spinSpeed: -0.62, precessAmp: 0.19, precessFreq: 0.94,
        style: 'platinum_inner', ticks: 24, majorEvery: 3, nodes: 6, comets: 1
      }
    ];

    function buildBipyramidMesh(rx, ry, rz, sides) {
      var verts = [[0, -ry, 0], [0, ry, 0]];
      for (var i = 0; i < sides; i++) {
        var a = (i / sides) * Math.PI * 2;
        verts.push([Math.cos(a) * rx, 0, Math.sin(a) * rz]);
      }
      var faces = [];
      for (var j = 0; j < sides; j++) {
        var curr = 2 + j;
        var next = 2 + ((j + 1) % sides);
        faces.push([0, next, curr]);
        faces.push([1, curr, next]);
      }
      return { verts: verts, faces: faces };
    }

    function buildDiamondCrystal(radius, topH, botH, crownRatio) {
      var sides = 6;
      var verts = [[0, -topH, 0], [0, botH, 0]];
      var upperR = radius * 0.78;
      var upperY = -topH * crownRatio;
      var lowerY = botH * 0.16;
      var i;
      for (i = 0; i < sides; i++) {
        var a1 = (i / sides) * Math.PI * 2;
        verts.push([Math.cos(a1) * upperR, upperY, Math.sin(a1) * upperR]);
      }
      for (i = 0; i < sides; i++) {
        var a2 = ((i + 0.5) / sides) * Math.PI * 2;
        verts.push([Math.cos(a2) * radius, lowerY, Math.sin(a2) * radius]);
      }
      var faces = [];
      for (i = 0; i < sides; i++) {
        var u0 = 2 + i;
        var u1 = 2 + ((i + 1) % sides);
        var l0 = 8 + i;
        var lPrev = 8 + ((i + sides - 1) % sides);
        faces.push([0, u1, u0]);
        faces.push([u0, u1, l0]);
        faces.push([u0, l0, lPrev]);
        faces.push([1, lPrev, l0]);
      }
      return { verts: verts, faces: faces };
    }

    var SHARD_MESH = buildBipyramidMesh(0.032, 0.088, 0.028, 4);
    var FALLBACK_OUTER_MESH = buildDiamondCrystal(0.245, 0.365, 0.395, 0.34);
    var FALLBACK_INNER_MESH = buildBipyramidMesh(0.135, 0.21, 0.135, 4);

    /* 18 Levitating 3D Micro-Crystal Shards (Mandala <-> Shattered Lissajous) */
    var SHARDS = [];
    for (var si = 0; si < 18; si++) {
      var tier = Math.floor(si / 6);
      var idx = si % 6;
      var baseAngle = (idx / 6) * Math.PI * 2 + (tier === 1 ? Math.PI / 6 : 0) - Math.PI / 2;
      SHARDS.push({
        id: si,
        tier: tier,
        idx: idx,
        baseAngle: baseAngle,
        mandalaR: tier === 0 ? 0.445 : (tier === 1 ? 0.59 : 0.745),
        mandalaZ: tier === 0 ? 0.05 : (tier === 1 ? -0.05 : 0.03),
        scale: tier === 0 ? 1.12 : (tier === 1 ? 0.90 : 0.76),
        lissA: 1 + (si % 3),
        lissB: 2 + ((si + 1) % 3),
        lissC: 1 + ((si + 2) % 2),
        phaseX: (si / 18) * Math.PI * 2 + tier * 0.7,
        phaseY: (si / 18) * Math.PI * 4 + 1.1,
        phaseZ: (si / 18) * Math.PI * 3 + 0.4,
        ampX: 0.62 + (si % 5) * 0.115,
        ampY: 0.56 + ((si + 2) % 4) * 0.12,
        ampZ: 0.46 + ((si + 1) % 3) * 0.15,
        speed: 0.36 + (si % 6) * 0.075,
        spinX: (si % 2 === 0 ? 1 : -1) * (0.7 + (si % 4) * 0.32),
        spinY: (si % 3 === 0 ? -1 : 1) * (0.9 + (si % 5) * 0.28),
        goldTint: tier === 1 ? 0.55 : (si % 3 === 0 ? 0.35 : 0.08)
      });
    }

    var TRAIL_PARTICLES = [];
    var SHOCKWAVES = [];
    var LIGHT_KEY = normalize([-0.55, -0.68, 0.48]);
    var LIGHT_RIM = normalize([0.72, 0.42, -0.55]);

    /* =====================================================================
       Transparent WebGL GLSL Core: Scheme C 「高维折叠圣晶」 (KIFS SDF)
       alpha: true, premultipliedAlpha: false -> zero black box compositing
       ===================================================================== */
    var VERT_SRC =
      'attribute vec2 aPos;\n' +
      'void main() {\n' +
      '  gl_Position = vec4(aPos, 0.0, 1.0);\n' +
      '}\n';

    var FRAG_SRC = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform vec2 uRes;',
      'uniform float uTime;',
      'uniform vec2 uOrbit;',
      'uniform float uPulseAge;',
      'uniform float uPulseAmp;',
      'uniform float uShatter;',
      'uniform float uHover;',
      'const float PI = 3.14159265359;',
      'mat2 rot2(float a) {',
      '  float c = cos(a), s = sin(a);',
      '  return mat2(c, -s, s, c);',
      '}',
      'float smin(float a, float b, float k) {',
      '  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);',
      '  return mix(b, a, h) - k * h * (1.0 - h);',
      '}',
      'float smax(float a, float b, float k) {',
      '  return -smin(-a, -b, k);',
      '}',
      'float sdOctahedron(vec3 p, float s) {',
      '  p = abs(p);',
      '  float m = p.x + p.y + p.z - s;',
      '  vec3 q;',
      '  if (3.0 * p.x < m) q = p.xyz;',
      '  else if (3.0 * p.y < m) q = p.yzx;',
      '  else if (3.0 * p.z < m) q = p.zxy;',
      '  else return m * 0.57735027;',
      '  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);',
      '  return length(vec3(q.x, q.y - s + k, q.z - k));',
      '}',
      'vec3 iridescence(float cosTheta, float shift) {',
      '  vec3 phase = vec3(0.0, 0.31, 0.64);',
      '  vec3 col = 0.56 + 0.44 * cos(6.28318 * (cosTheta * 1.48 + shift + phase));',
      '  return mix(col, vec3(0.45, 0.84, 1.0), 0.28);',
      '}',
      'mat2 mSpinY;',
      'mat2 mTiltXY;',
      'mat2 mFold1;',
      'mat2 mFold2;',
      'float mapCrystal(vec3 p) {',
      '  vec3 q = p;',
      '  q.xz *= mSpinY;',
      '  q.xy *= mTiltXY;',
      '  vec3 eq = q;',
      '  eq.y *= 0.72;',
      '  float outerGem = sdOctahedron(eq, 1.24);',
      '  if (outerGem > 0.28) return outerGem - 0.09;',
      '  vec3 k = q;',
      '  k.y *= 0.76;',
      '  float scale = 1.0;',
      '  const vec3 icoN = vec3(0.809017, 0.5, 0.309017);',
      '  for (int i = 0; i < 4; i++) {',
      '    k = abs(k);',
      '    if (k.x < k.y) k.xy = k.yx;',
      '    if (k.x < k.z) k.xz = k.zx;',
      '    if (k.y < k.z) k.yz = k.zy;',
      '    k -= 2.0 * min(0.0, dot(k, icoN)) * icoN;',
      '    k.xz *= mFold1;',
      '    k.xy *= mFold2;',
      '    float s = 1.48;',
      '    k = k * s - vec3(0.55, 0.39, 0.27) * (s - 1.0);',
      '    scale *= s;',
      '  }',
      '  float kifs = (sdOctahedron(k, 0.94) - 0.04) / scale;',
      '  float core = smax(kifs, outerGem - 0.09, 0.07);',
      '  core = smin(core, sdOctahedron(eq, 0.74), 0.11);',
      '  return core;',
      '}',
      'vec4 calcNormalAndRidge(vec3 p, float t) {',
      '  vec3 n = vec3(0.0);',
      '  float dSum = 0.0;',
      '  int z = int(min(t, 0.0));',
      '  for (int i = 0; i < 4; i++) {',
      '    int idx = i + z;',
      '    vec3 e;',
      '    if (idx == 0) e = vec3( 0.57735, -0.57735, -0.57735);',
      '    else if (idx == 1) e = vec3(-0.57735, -0.57735,  0.57735);',
      '    else if (idx == 2) e = vec3(-0.57735,  0.57735, -0.57735);',
      '    else e = vec3( 0.57735,  0.57735,  0.57735);',
      '    float d = mapCrystal(p + e * 0.0055);',
      '    n += e * d;',
      '    dSum += d;',
      '  }',
      '  float ridge = smoothstep(0.15, 0.90, abs(dSum) / 0.011);',
      '  return vec4(normalize(n), ridge);',
      '}',
      'vec3 sampleEnvironment(vec3 dir, float t) {',
      '  dir = normalize(dir);',
      '  float y = dir.y;',
      '  /* Porcelain Cathedral + Imperial Sapphire Aurora HDRI for rich jewel contrast */',
      '  vec3 sky = mix(vec3(0.05, 0.16, 0.56), vec3(0.80, 0.92, 1.0), smoothstep(-0.50, 0.78, y));',
      '  float rib = smoothstep(0.52, 0.92, abs(sin(atan(dir.z, dir.x) * 4.0 + y * 2.5 + t * 0.12)));',
      '  sky = mix(sky, vec3(0.03, 0.12, 0.48), rib * 0.64 * (1.0 - abs(y) * 0.55));',
      '  float aurWave = sin(dir.x * 4.2 + t * 0.42 + sin(dir.z * 2.8 - t * 0.26));',
      '  float aurBand = exp(-pow(y + 0.06 - aurWave * 0.14, 2.0) * 14.0);',
      '  vec3 aurCol = mix(vec3(0.14, 0.72, 1.0), vec3(0.56, 0.32, 1.0), 0.5 + 0.5 * sin(dir.x * 2.8 - t * 0.35));',
      '  sky += aurCol * aurBand * 0.48;',
      '  float win1 = smoothstep(0.86, 0.985, dot(dir, normalize(vec3(0.56, 0.68, 0.48))));',
      '  float win2 = smoothstep(0.84, 0.975, dot(dir, normalize(vec3(-0.74, 0.34, 0.58))));',
      '  float win3 = smoothstep(0.87, 0.99, dot(dir, normalize(vec3(0.16, -0.78, 0.60))));',
      '  sky += vec3(1.55, 1.72, 2.05) * win1 * 0.92;',
      '  sky += vec3(0.28, 0.76, 1.55) * win2 * 0.85;',
      '  sky += vec3(1.26, 0.98, 0.56) * win3 * 0.84;',
      '  return sky;',
      '}',
      'vec3 traceInfinityInterior(vec3 entryP, vec3 refrR, vec3 refrG, vec3 refrB, float t, float ripple) {',
      '  vec3 acc = vec3(0.0);',
      '  float dist = 0.08;',
      '  float cellScale = 2.05;',
      '  float stepSize = 0.17;',
      '  float depthMul = 1.75;',
      '  float wireSharp = 22.0;',
      '  float decayK = 1.88;',
      '  vec3 dispDelta = (refrB - refrR) * 0.72;',
      '  mat2 mStep = rot2(0.11 + ripple * 0.15);',
      '  mat2 mRot = rot2(t * 0.28);',
      '  for (int i = 0; i < 12; i++) {',
      '    float fi = float(i) / 12.0;',
      '    vec3 p = entryP + refrG * dist;',
      '    vec3 q = p * (1.0 + fi * depthMul);',
      '    q.xz *= mRot;',
      '    mRot = mRot * mStep;',
      '    vec3 cell = mod(q * cellScale + 0.5, 1.0) - 0.5;',
      '    vec3 a = abs(cell);',
      '    vec3 cellR = mod((q - dispDelta * dist * 1.85) * cellScale + 0.5, 1.0) - 0.5;',
      '    vec3 cellB = mod((q + dispDelta * dist * 1.85) * cellScale + 0.5, 1.0) - 0.5;',
      '    float latG = min(length(a.yz), min(length(a.xz), length(a.xy)));',
      '    float latR = min(length(abs(cellR).yz), min(length(abs(cellR).xz), length(abs(cellR).xy)));',
      '    float latB = min(length(abs(cellB).yz), min(length(abs(cellB).xz), length(abs(cellB).xy)));',
      '    vec3 glowWire = vec3(exp(-latR * wireSharp), exp(-latG * wireSharp), exp(-latB * wireSharp));',
      '    float node = (a.x + a.y + a.z) * 0.57735 - (0.145 + 0.03 * sin(t * 1.8 + fi * 8.0));',
      '    float glowNode = exp(-max(node, 0.0) * 18.0);',
      '    float coreStar = exp(-length(p) * 3.0);',
      '    vec3 depthTint = mix(vec3(0.12, 0.66, 1.0), vec3(0.62, 0.30, 1.0), 0.5 + 0.5 * sin(fi * 5.5 - t * 1.1));',
      '    vec3 goldFiligree = vec3(1.0, 0.84, 0.46);',
      '    vec3 sampleCol = depthTint * glowWire * 0.66',
      '                   + mix(vec3(0.60, 0.90, 1.0), goldFiligree, 0.36) * glowNode * 0.62',
      '                   + vec3(0.32, 0.82, 1.0) * coreStar * 0.34;',
      '    acc += sampleCol * exp(-fi * decayK);',
      '    dist += stepSize;',
      '  }',
      '  /* Deep royal sapphire & amethyst internal luminescence for snow-porcelain daylight */',
      '  return acc * vec3(0.34, 0.68, 1.28) + vec3(0.015, 0.06, 0.24) * length(acc);',
      '}',
      'vec3 acesToneMap(vec3 x) {',
      '  const float a = 2.51;',
      '  const float b = 0.03;',
      '  const float c = 2.43;',
      '  const float d = 0.59;',
      '  const float e = 0.14;',
      '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
      '}',
      'void main() {',
      '  vec2 pUv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
      '  float ripple = uPulseAmp * sin(uPulseAge * 9.5) * exp(-uPulseAge * 1.6);',
      '  float rippleEnv = uPulseAmp * exp(-uPulseAge * 1.2);',
      '  mSpinY = rot2(uTime * 0.28);',
      '  mTiltXY = rot2(sin(uTime * 0.38) * 0.14);',
      '  mFold1 = rot2(0.42 + 0.18 * sin(uTime * 0.55) + ripple * 0.68 + uShatter * 0.16);',
      '  mFold2 = rot2(0.28 + 0.14 * cos(uTime * 0.41) - ripple * 0.44 - uShatter * 0.10);',
      '  float zoom = 1.0 + 0.024 * sin(uTime * 2.2) + uPulseAmp * 0.055 + uHover * 0.035 - uShatter * 0.04;',
      '  float camDist = 4.72 / zoom;',
      '  float focalLen = 1.10;',
      '  vec3 ro = vec3(0.0, 0.0, camDist);',
      '  vec3 rd = normalize(vec3(pUv, -focalLen));',
      '  float yaw = uOrbit.x * 0.92;',
      '  float pitch = clamp(uOrbit.y * 0.86, -0.78, 0.78);',
      '  ro.yz *= rot2(pitch);',
      '  rd.yz *= rot2(pitch);',
      '  ro.xz *= rot2(yaw);',
      '  rd.xz *= rot2(yaw);',
      '  float hit = 0.0;',
      '  vec3 hitPos = vec3(0.0);',
      '  float haloGlow = 0.0;',
      '  float minAngle = 10.0;',
      '  float b = dot(ro, rd);',
      '  float c = dot(ro, ro) - 2.02 * 2.02;',
      '  float disc = b * b - c;',
      '  if (disc > 0.0) {',
      '    float tStart = max(0.0, -b - sqrt(disc));',
      '    float tEnd = min(8.2, -b + sqrt(disc));',
      '    float tMarch = tStart;',
      '    for (int i = 0; i < 46; i++) {',
      '      vec3 p = ro + rd * tMarch;',
      '      float dCrys = mapCrystal(p);',
      '      haloGlow += 0.0042 / (abs(dCrys) + 0.17);',
      '      float angD = dCrys / max(tMarch, 0.5);',
      '      if (angD < minAngle) minAngle = angD;',
      '      if (dCrys < 0.0024) {',
      '        hit = 1.0;',
      '        hitPos = p;',
      '        break;',
      '      }',
      '      tMarch += max(dCrys * 0.90, 0.016);',
      '      if (tMarch > tEnd) break;',
      '    }',
      '  }',
      '  if (hit > 0.5) {',
      '    vec4 nr = calcNormalAndRidge(hitPos, uTime);',
      '    vec3 n = nr.xyz;',
      '    float ridge = nr.w;',
      '    vec3 v = -rd;',
      '    float ndv = clamp(dot(n, v), 0.0, 1.0);',
      '    float fresnel = 0.08 + 0.92 * pow(1.0 - ndv, 3.0);',
      '    vec3 irid = iridescence(ndv, uTime * 0.09 + dot(hitPos, vec3(0.24, 0.36, 0.20)) + rippleEnv * 0.38);',
      '    vec3 reflDir = reflect(rd, n);',
      '    vec3 reflCol = sampleEnvironment(reflDir, uTime);',
      '    float dispBoost = 0.058 + 0.072 * rippleEnv + 0.025 * uHover;',
      '    vec3 refrR = refract(rd, n, 1.0 / (1.38 - dispBoost));',
      '    vec3 refrG = refract(rd, n, 1.0 / 1.52);',
      '    vec3 refrB = refract(rd, n, 1.0 / (1.68 + dispBoost));',
      '    if (length(refrR) < 0.01) refrR = reflDir;',
      '    if (length(refrG) < 0.01) refrG = reflDir;',
      '    if (length(refrB) < 0.01) refrB = reflDir;',
      '    vec3 envRefr;',
      '    envRefr.r = sampleEnvironment(refrR, uTime).r;',
      '    envRefr.g = sampleEnvironment(refrG, uTime).g;',
      '    envRefr.b = sampleEnvironment(refrB, uTime).b;',
      '    vec3 innerLattice = traceInfinityInterior(hitPos - n * 0.02, refrR, refrG, refrB, uTime, ripple);',
      '    float thickness = clamp(1.18 - ndv * 0.56 + 0.30 * length(hitPos), 0.26, 1.90);',
      '    vec3 absorption = exp(-thickness * vec3(2.95, 1.48, 0.22));',
      '    vec3 transmitted = envRefr * absorption * 0.72 + innerLattice * 0.86;',
      '    vec3 l1 = normalize(vec3(0.55, 0.75, 0.65));',
      '    vec3 l2 = normalize(vec3(-0.72, 0.28, 0.52));',
      '    vec3 l3 = normalize(vec3(0.18, -0.82, 0.48));',
      '    float spec1 = pow(max(dot(n, normalize(l1 + v)), 0.0), 96.0);',
      '    float spec2 = pow(max(dot(n, normalize(l2 + v)), 0.0), 48.0);',
      '    float spec3 = pow(max(dot(n, normalize(l3 + v)), 0.0), 36.0);',
      '    vec3 specCol = vec3(1.50, 1.72, 2.05) * spec1',
      '                 + vec3(0.36, 0.88, 1.55) * spec2 * 0.82',
      '                 + vec3(1.28, 0.98, 0.56) * spec3 * 0.76;',
      '    vec3 edgeFire = mix(irid, vec3(0.88, 0.97, 1.0), 0.36) * ridge * 0.72;',
      '    vec3 surface = mix(transmitted, reflCol * vec3(0.62, 0.80, 1.08), fresnel * 0.56);',
      '    surface += irid * fresnel * (0.58 + uHover * 0.18);',
      '    surface += specCol;',
      '    surface += edgeFire;',
      '    /* Imperial sapphire bevel rim so every folded crown/pavilion facet reads crisply on snow-porcelain */',
      '    float porcRim = pow(1.0 - ndv, 1.45) * (1.0 - fresnel * 0.50);',
      '    surface = mix(surface, surface * vec3(0.14, 0.32, 0.92), porcRim * 0.74);',
      '    float facetPulse = uPulseAmp * exp(-uPulseAge * 2.1) * (0.5 + 0.5 * sin(length(hitPos) * 8.0 - uPulseAge * 14.0));',
      '    surface += irid * facetPulse * 0.92;',
      '    vec3 mapped = acesToneMap(surface * 1.02);',
      '    mapped = pow(clamp(mapped, 0.0, 1.0), vec3(1.08));',
      '    gl_FragColor = vec4(mapped, 1.0);',
      '    return;',
      '  }',
      '  /* Seamless transparent exterior: delicate inner sapphire-cyan halo fading strictly to 0 before edge */',
      '  float edgeFade = smoothstep(0.47, 0.27, length(pUv));',
      '  float pixelRad = 1.20 / max(uRes.y * focalLen, 1.0);',
      '  float edgeCov = smoothstep(pixelRad * 1.60, 0.0, minAngle) * edgeFade;',
      '  float auraAlpha = clamp(haloGlow * 0.075, 0.0, 0.26) * edgeFade;',
      '  vec3 auraCol = mix(vec3(0.18, 0.48, 0.94), vec3(0.62, 0.88, 1.0), clamp(haloGlow * 0.24, 0.0, 1.0));',
      '  vec3 rimCol = mix(vec3(0.18, 0.48, 0.98), vec3(0.86, 0.95, 1.0), 0.44);',
      '  vec3 missCol = mix(auraCol, rimCol, edgeCov);',
      '  float missAlpha = clamp(max(auraAlpha, edgeCov * 0.92), 0.0, 1.0);',
      '  if (missAlpha < 0.004) {',
      '    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);',
      '  } else {',
      '    gl_FragColor = vec4(missCol, missAlpha);',
      '  }',
      '}'
    ].join('\n');

    var gl = null;
    var glProg = null;
    var glUniforms = null;
    var useWebGL = false;
    var isSoftwareGL = false;
    var shaderError = null;
    var glBackendLabel = 'canvas2d-fallback';

    function initCoreWebGL() {
      if (root && root.__titleFusionForceFallback__ === true) return false;
      var opts = {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      };
      try {
        gl = glCanvas.getContext('webgl2', opts);
        if (gl) {
          glBackendLabel = 'webgl2';
        } else {
          gl = glCanvas.getContext('webgl', opts) || glCanvas.getContext('experimental-webgl', opts);
          if (gl) glBackendLabel = 'webgl1';
        }
      } catch (e) {
        gl = null;
      }
      if (!gl) return false;

      try {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          var rend = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
          if (/swiftshader|llvmpipe|software/i.test(rend)) isSoftwareGL = true;
        }
        var vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, VERT_SRC);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
          throw new Error('VS: ' + gl.getShaderInfoLog(vs));
        }
        var fsSrc = FRAG_SRC;
        if (isSoftwareGL) {
          fsSrc = fsSrc
            .replace('for (int i = 0; i < 12; i++) {', 'for (int i = 0; i < 6; i++) {')
            .replace('float fi = float(i) / 12.0;', 'float fi = float(i) / 6.0;')
            .replace('float stepSize = 0.17;', 'float stepSize = 0.32;')
            .replace('for (int i = 0; i < 46; i++) {', 'for (int i = 0; i < 26; i++) {')
            .replace('tMarch += max(dCrys * 0.90, 0.016);', 'tMarch += max(dCrys * 0.96, 0.024);');
        }
        var fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSrc);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
          throw new Error('FS: ' + gl.getShaderInfoLog(fs));
        }
        glProg = gl.createProgram();
        gl.attachShader(glProg, vs);
        gl.attachShader(glProg, fs);
        gl.linkProgram(glProg);
        if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) {
          throw new Error('LINK: ' + gl.getProgramInfoLog(glProg));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        var aPos = gl.getAttribLocation(glProg, 'aPos');
        gl.useProgram(glProg);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        glUniforms = {
          uRes: gl.getUniformLocation(glProg, 'uRes'),
          uTime: gl.getUniformLocation(glProg, 'uTime'),
          uOrbit: gl.getUniformLocation(glProg, 'uOrbit'),
          uPulseAge: gl.getUniformLocation(glProg, 'uPulseAge'),
          uPulseAmp: gl.getUniformLocation(glProg, 'uPulseAmp'),
          uShatter: gl.getUniformLocation(glProg, 'uShatter'),
          uHover: gl.getUniformLocation(glProg, 'uHover')
        };
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        return true;
      } catch (err) {
        shaderError = String(err && err.message ? err.message : err);
        gl = null;
        glProg = null;
        glBackendLabel = 'canvas2d-fallback';
        return false;
      }
    }

    useWebGL = initCoreWebGL();
    if (!useWebGL) {
      glCanvas.style.display = 'none';
    }

    /* Simulation & Sizing State */
    var fState = {
      rafId: 0,
      running: false,
      lastTs: 0,
      time: 1.4,
      stagePx: 520,
      canvasCss: 812,
      glCss: 250,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      shatterTarget: 0,
      shatterBlend: 0,
      shatterVel: 0,
      burstPulse: 0,
      pulseAt: -10,
      pulseStrength: 0,
      normX: 0,
      normY: 0,
      tiltX: 0,
      tiltY: 0,
      hoverCore: 0,
      mouseActive: false,
      localMx: 0,
      localMy: 0,
      dragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragMoved: 0,
      dragRotX: 0,
      dragRotY: 0,
      dragTargetX: 0,
      dragTargetY: 0,
      frameCount: 0,
      lastMeasuredStagePx: 0,
      stableMeasureCount: 0
    };

    function syncSizes(forceResize) {
      var cw = stageEl.clientWidth || 0;
      var ch = stageEl.clientHeight || 0;
      if (!cw || !ch) {
        var rect = stageEl.getBoundingClientRect();
        cw = rect.width || 520;
        ch = rect.height || 520;
      }
      var sPx = Math.max(120, Math.round(Math.min(cw, ch)));
      var cCss = Math.round(sPx * 1.56);
      var gCss = Math.round(sPx * 0.56);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var sizeSettled = !!forceResize || (glCanvas.width === 0) || (backCanvas.width === 0);
      if (Math.abs(sPx - fState.lastMeasuredStagePx) <= 1) {
        fState.stableMeasureCount++;
      } else {
        fState.lastMeasuredStagePx = sPx;
        fState.stableMeasureCount = 0;
      }
      if (!sizeSettled && fState.stableMeasureCount < 2) {
        return;
      }

      fState.stagePx = sPx;
      fState.canvasCss = cCss;
      fState.glCss = gCss;
      fState.dpr = dpr;

      var pw = Math.max(1, Math.round(cCss * dpr));
      if (Math.abs(backCanvas.width - pw) >= 2 || Math.abs(backCanvas.height - pw) >= 2) {
        backCanvas.width = pw;
        backCanvas.height = pw;
      }
      if (Math.abs(frontCanvas.width - pw) >= 2 || Math.abs(frontCanvas.height - pw) >= 2) {
        frontCanvas.width = pw;
        frontCanvas.height = pw;
      }
      if (useWebGL && gl) {
        var glScale = isSoftwareGL ? 0.44 : Math.min(Math.max(dpr, 1.5), 2.0);
        var gpw = Math.max(64, Math.round(gCss * glScale));
        if (Math.abs(glCanvas.width - gpw) >= 2 || Math.abs(glCanvas.height - gpw) >= 2) {
          glCanvas.width = gpw;
          glCanvas.height = gpw;
          gl.viewport(0, 0, gpw, gpw);
        }
      }
    }

    function applyGlobalTilt(v) {
      var p = rotX(v, fState.tiltY + fState.dragRotY);
      return rotY(p, fState.tiltX + fState.dragRotX);
    }

    function project(v, cx, cy, unit) {
      var fov = 4.6;
      var persp = fov / (fov - v[2]);
      return { x: cx + v[0] * unit * persp, y: cy + v[1] * unit * persp, z: v[2], persp: persp };
    }

    function drawStarGlint(ctx, x, y, radius, alpha, colorRgb, rot) {
      if (alpha <= 0.01 || radius <= 0.5) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot || 0);
      var halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.45);
      halo.addColorStop(0, rgba(PAL.glintCore, alpha * 0.9));
      halo.addColorStop(0.28, rgba(colorRgb, alpha * 0.45));
      halo.addColorStop(1, rgba(colorRgb, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgba(PAL.glintCore, alpha * 0.95);
      ctx.beginPath();
      var inner = radius * 0.14;
      ctx.moveTo(0, -radius);
      ctx.quadraticCurveTo(inner * 0.5, -inner * 0.5, radius, 0);
      ctx.quadraticCurveTo(inner * 0.5, inner * 0.5, 0, radius);
      ctx.quadraticCurveTo(-inner * 0.5, inner * 0.5, -radius, 0);
      ctx.quadraticCurveTo(-inner * 0.5, -inner * 0.5, 0, -radius);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = rgba(colorRgb, alpha * 0.55);
      ctx.lineWidth = 0.85;
      var d = radius * 0.44;
      ctx.beginPath();
      ctx.moveTo(-d, -d); ctx.lineTo(d, d);
      ctx.moveTo(d, -d); ctx.lineTo(-d, d);
      ctx.stroke();
      ctx.restore();
    }

    function drawCompassArchitecture(ctx, cx, cy, unit, t) {
      ctx.save();
      ctx.translate(cx, cy);
      var rOuter = unit * 1.32;
      var rInner = unit * 1.22;
      ctx.strokeStyle = rgba(PAL.gridLine, 0.068);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, rInner, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.rotate(t * 0.018);
      ctx.strokeStyle = rgba(PAL.goldMain, 0.16);
      for (var i = 0; i < 4; i++) {
        var a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (rInner - 12), Math.sin(a) * (rInner - 12));
        ctx.lineTo(Math.cos(a) * (rOuter + 18), Math.sin(a) * (rOuter + 18));
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(PAL.gridLine, 0.095);
      for (var j = 0; j < 24; j++) {
        var a2 = (j / 24) * Math.PI * 2;
        var len = j % 6 === 0 ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a2) * rOuter, Math.sin(a2) * rOuter);
        ctx.lineTo(Math.cos(a2) * (rOuter + len), Math.sin(a2) * (rOuter + len));
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    function drawVolumetricCaustics(ctx, cx, cy, unit, t) {
      var sh = fState.shatterBlend;
      var pulse = 1 + fState.burstPulse * 0.22 + fState.hoverCore * 0.07;
      ctx.save();
      ctx.translate(cx, cy);

      var haloR = unit * (1.28 + sh * 0.14) * pulse;
      var bgGlow = ctx.createRadialGradient(0, 0, unit * 0.04, 0, 0, haloR);
      bgGlow.addColorStop(0, rgba(PAL.iceBright, 0.30));
      bgGlow.addColorStop(0.36, rgba(PAL.causticA, 0.105));
      bgGlow.addColorStop(0.68, rgba(PAL.causticB, 0.052));
      bgGlow.addColorStop(1, rgba(PAL.causticA, 0));
      ctx.fillStyle = bgGlow;
      ctx.beginPath();
      ctx.arc(0, 0, haloR, 0, Math.PI * 2);
      ctx.fill();

      var rayCount = 10;
      for (var i = 0; i < rayCount; i++) {
        var baseA = (i / rayCount) * Math.PI * 2 + t * (i % 2 === 0 ? 0.08 : -0.055);
        var halfW = (0.045 + (i % 3) * 0.020) * (1 + sh * 0.22);
        var len = unit * (0.94 + 0.34 * Math.sin(t * 0.7 + i * 1.4)) * pulse;
        var alpha = 0.054 * (0.65 + 0.35 * Math.sin(t * 1.1 + i * 2.1));
        var col = i % 3 === 0 ? PAL.goldBright : PAL.rayColor;
        var grad = ctx.createRadialGradient(0, 0, unit * 0.08, 0, 0, len);
        grad.addColorStop(0, rgba(col, alpha * 1.3));
        grad.addColorStop(0.55, rgba(col, alpha * 0.45));
        grad.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len, baseA - halfW, baseA + halfW);
        ctx.closePath();
        ctx.fill();
      }

      for (var r = 0; r < 3; r++) {
        var baseR = unit * (0.46 + r * 0.22 + sh * 0.11);
        var dir = r % 2 === 0 ? 1 : -1;
        var rCol = r === 1 ? PAL.causticB : PAL.causticA;
        var rAlpha = 0.115 * (1 - r * 0.18);
        ctx.beginPath();
        var steps = 84;
        for (var s = 0; s <= steps; s++) {
          var th = (s / steps) * Math.PI * 2;
          var wave =
            Math.sin(th * (3 + r) + t * 0.85 * dir) * unit * 0.040 +
            Math.cos(th * (6 - r) - t * 0.55 * dir) * unit * 0.020;
          var rr = baseR + wave;
          var rx = Math.cos(th) * rr * (1.06 - r * 0.04);
          var ry = Math.sin(th) * rr * (0.86 + r * 0.05);
          if (s === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.strokeStyle = rgba(rCol, rAlpha);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }

    function computeArmillaryRingGeometry(ring, t, cx, cy, unit) {
      var sh = fState.shatterBlend;
      var rad = ring.radius * lerp(1.0, ring.expandMult, sh);
      var spin = t * ring.spinSpeed * (1 + sh * 0.45);
      var precessX = Math.sin(t * ring.precessFreq + ring.radius * 4) * ring.precessAmp;
      var precessY = Math.cos(t * ring.precessFreq * 0.78) * ring.precessAmp;
      var rx = ring.tiltX + precessX + sh * 0.24 * (ring.spinSpeed > 0 ? 1 : -1);
      var ry = ring.tiltY + precessY + sh * 0.18;
      var rz = ring.tiltZ + Math.sin(t * 0.25 + ring.radius) * 0.12;

      var toWorld = function (localPt) {
        return applyGlobalTilt(rotEuler(localPt, rx, ry, rz));
      };

      var segs = 90;
      var outerPts = [];
      var innerPts = [];
      var midPts = [];
      var rOut = rad + ring.bandHalf;
      var rIn = rad - ring.bandHalf;
      var i, a, ca, sa;

      for (i = 0; i <= segs; i++) {
        a = (i / segs) * Math.PI * 2 + spin;
        ca = Math.cos(a); sa = Math.sin(a);
        outerPts.push(project(toWorld([ca * rOut, sa * rOut, 0]), cx, cy, unit));
        innerPts.push(project(toWorld([ca * rIn, sa * rIn, 0]), cx, cy, unit));
        midPts.push(project(toWorld([ca * rad, sa * rad, 0]), cx, cy, unit));
      }

      var echoPts = null;
      if (ring.style === 'hyper_echo') {
        echoPts = [];
        var echoRx = rx + 0.14 * Math.sin(t * 1.2);
        var echoRy = ry + 0.16 * Math.cos(t * 0.9);
        var echoR = rad * 1.045;
        for (i = 0; i <= 72; i++) {
          a = (i / 72) * Math.PI * 2 - spin * 0.5;
          var ep = applyGlobalTilt(rotEuler([Math.cos(a) * echoR, Math.sin(a) * echoR, 0], echoRx, echoRy, rz));
          echoPts.push(project(ep, cx, cy, unit));
        }
      }

      var ticks = [];
      for (i = 0; i < ring.ticks; i++) {
        a = (i / ring.ticks) * Math.PI * 2 + spin;
        var isMajor = (i % ring.majorEvery === 0);
        ca = Math.cos(a); sa = Math.sin(a);
        var tIn = rad - ring.bandHalf * (isMajor ? 1.45 : 0.72);
        var tOut = rad + ring.bandHalf * (isMajor ? 1.45 : 0.72);
        var p0 = project(toWorld([ca * tIn, sa * tIn, 0]), cx, cy, unit);
        var p1 = project(toWorld([ca * tOut, sa * tOut, 0]), cx, cy, unit);
        ticks.push({ p0: p0, p1: p1, z: (p0.z + p1.z) * 0.5, isMajor: isMajor });
      }

      var nodes = [];
      for (i = 0; i < ring.nodes; i++) {
        a = (i / ring.nodes) * Math.PI * 2 + spin + 0.25;
        var np = project(toWorld([Math.cos(a) * rad, Math.sin(a) * rad, 0]), cx, cy, unit);
        nodes.push({ p: np, z: np.z, idx: i });
      }

      var comets = [];
      for (var c = 0; c < ring.comets; c++) {
        var headA = t * (ring.spinSpeed * 2.6 + (c % 2 === 0 ? 0.5 : -0.4)) + c * Math.PI;
        var trail = [];
        var dirSign = ring.spinSpeed >= 0 ? 1 : -1;
        for (var k = 0; k < 14; k++) {
          a = headA - k * 0.045 * dirSign;
          trail.push(project(toWorld([Math.cos(a) * rad, Math.sin(a) * rad, 0]), cx, cy, unit));
        }
        comets.push(trail);
      }

      return { ring: ring, outerPts: outerPts, innerPts: innerPts, midPts: midPts, echoPts: echoPts, ticks: ticks, nodes: nodes, comets: comets, segs: segs };
    }

    function drawArmillaryRingPass(ctx, geom, isFrontPass) {
      var ring = geom.ring;
      var outerPts = geom.outerPts;
      var innerPts = geom.innerPts;
      var midPts = geom.midPts;
      var echoPts = geom.echoPts;
      var ticks = geom.ticks;
      var nodes = geom.nodes;
      var comets = geom.comets;
      var segs = geom.segs;

      var isGold = ring.style === 'gold_ecliptic';
      var isSapphire = ring.style === 'sapphire_arcane';
      var isHyper = ring.style === 'hyper_echo';
      var isInner = ring.style === 'platinum_inner';

      var primaryCol = isGold ? PAL.goldMain : (isSapphire ? PAL.sapphireMid : (isHyper ? PAL.violetAccent : PAL.sapphireBright));
      var highlightCol = isGold ? PAL.goldBright : PAL.iceBright;
      var scaleLW = clamp(fState.stagePx / 520, 0.58, 1.08);
      var i, zMid, depthFactor;

      for (i = 0; i < segs; i++) {
        zMid = (midPts[i].z + midPts[i + 1].z) * 0.5;
        if (isFrontPass ? zMid < 0 : zMid >= 0) continue;
        depthFactor = clamp((zMid + 1.3) / 2.6, 0.22, 1.0);
        var spec = 0.5 + 0.5 * Math.sin((i / segs) * Math.PI * 4 + fState.time * 0.9);
        var bandAlpha = (isGold ? 0.16 : (isSapphire ? 0.18 : 0.12)) * depthFactor * 0.9;

        ctx.fillStyle = rgba(primaryCol, bandAlpha * (0.7 + 0.45 * spec));
        ctx.beginPath();
        ctx.moveTo(outerPts[i].x, outerPts[i].y);
        ctx.lineTo(outerPts[i + 1].x, outerPts[i + 1].y);
        ctx.lineTo(innerPts[i + 1].x, innerPts[i + 1].y);
        ctx.lineTo(innerPts[i].x, innerPts[i].y);
        ctx.closePath();
        ctx.fill();

        var edgeAlpha = (isFrontPass ? 0.80 : 0.35) * depthFactor * (0.68 + 0.32 * spec);
        ctx.strokeStyle = rgba(spec > 0.72 ? highlightCol : primaryCol, edgeAlpha);
        ctx.lineWidth = (isGold ? 1.55 : (isSapphire ? 1.45 : 1.15)) * midPts[i].persp * scaleLW;
        ctx.beginPath();
        ctx.moveTo(outerPts[i].x, outerPts[i].y);
        ctx.lineTo(outerPts[i + 1].x, outerPts[i + 1].y);
        ctx.stroke();

        ctx.strokeStyle = rgba(primaryCol, edgeAlpha * 0.62);
        ctx.lineWidth = 0.85 * midPts[i].persp * scaleLW;
        ctx.beginPath();
        ctx.moveTo(innerPts[i].x, innerPts[i].y);
        ctx.lineTo(innerPts[i + 1].x, innerPts[i + 1].y);
        ctx.stroke();

        if ((i % 16) < 7 && (isSapphire || isGold || isInner)) {
          ctx.strokeStyle = rgba(highlightCol, (isFrontPass ? 0.64 : 0.22) * depthFactor);
          ctx.lineWidth = (isInner ? 1.3 : 1.0) * midPts[i].persp * scaleLW;
          ctx.beginPath();
          ctx.moveTo(midPts[i].x, midPts[i].y);
          ctx.lineTo(midPts[i + 1].x, midPts[i + 1].y);
          ctx.stroke();
        }
      }

      if (echoPts) {
        for (i = 0; i < echoPts.length - 1; i++) {
          zMid = (echoPts[i].z + echoPts[i + 1].z) * 0.5;
          if (isFrontPass ? zMid < 0 : zMid >= 0) continue;
          if (i % 3 === 2) continue;
          depthFactor = clamp((zMid + 1.2) / 2.4, 0.18, 1.0);
          ctx.strokeStyle = rgba(PAL.goldBright, (isFrontPass ? 0.44 : 0.16) * depthFactor);
          ctx.lineWidth = 1.0 * scaleLW;
          ctx.beginPath();
          ctx.moveTo(echoPts[i].x, echoPts[i].y);
          ctx.lineTo(echoPts[i + 1].x, echoPts[i + 1].y);
          ctx.stroke();
        }
      }

      for (i = 0; i < ticks.length; i++) {
        var tk = ticks[i];
        if (isFrontPass ? tk.z < 0 : tk.z >= 0) continue;
        depthFactor = clamp((tk.z + 1.2) / 2.4, 0.2, 1.0);
        ctx.strokeStyle = rgba(tk.isMajor ? highlightCol : primaryCol, (isFrontPass ? (tk.isMajor ? 0.85 : 0.44) : 0.22) * depthFactor);
        ctx.lineWidth = (tk.isMajor ? 1.35 : 0.75) * scaleLW;
        ctx.beginPath();
        ctx.moveTo(tk.p0.x, tk.p0.y);
        ctx.lineTo(tk.p1.x, tk.p1.y);
        ctx.stroke();
      }

      if (isGold) {
        for (i = 0; i < nodes.length; i++) {
          var aN = nodes[i];
          var bN = nodes[(i + 1) % nodes.length];
          var avgZ = (aN.z + bN.z) * 0.5;
          if (isFrontPass ? avgZ < 0 : avgZ >= 0) continue;
          depthFactor = clamp((avgZ + 1.2) / 2.4, 0.2, 1.0);
          ctx.strokeStyle = rgba(PAL.goldMain, (isFrontPass ? 0.24 : 0.10) * depthFactor);
          ctx.lineWidth = 0.75 * scaleLW;
          ctx.beginPath();
          ctx.moveTo(aN.p.x, aN.p.y);
          ctx.lineTo(bN.p.x, bN.p.y);
          ctx.stroke();
        }
      }

      for (i = 0; i < nodes.length; i++) {
        var nd = nodes[i];
        if (isFrontPass ? nd.z < 0 : nd.z >= 0) continue;
        depthFactor = clamp((nd.z + 1.2) / 2.4, 0.25, 1.0);
        var nr = (isGold ? 4.4 : 3.6) * nd.p.persp * scaleLW;
        var nAlpha = (isFrontPass ? 0.92 : 0.36) * depthFactor;

        ctx.save();
        ctx.translate(nd.p.x, nd.p.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = rgba(PAL.iceWhite, nAlpha * 0.92);
        ctx.strokeStyle = rgba(isGold ? PAL.goldMain : PAL.sapphireBright, nAlpha);
        ctx.lineWidth = 1.2 * scaleLW;
        ctx.beginPath();
        ctx.rect(-nr * 0.65, -nr * 0.65, nr * 1.3, nr * 1.3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        if (isFrontPass && (nd.idx % 2 === 0)) {
          drawStarGlint(ctx, nd.p.x, nd.p.y, nr * 2.5, nAlpha * 0.74, highlightCol, fState.time * 0.4 + nd.idx);
        }
      }

      for (var c = 0; c < comets.length; c++) {
        var trail = comets[c];
        var head = trail[0];
        if (isFrontPass ? head.z < 0 : head.z >= 0) continue;
        for (var k = 0; k < trail.length - 1; k++) {
          var frac = 1 - k / trail.length;
          ctx.strokeStyle = rgba(highlightCol, frac * frac * (isFrontPass ? 0.85 : 0.35));
          ctx.lineWidth = (2.2 * frac + 0.4) * trail[k].persp * scaleLW;
          ctx.beginPath();
          ctx.moveTo(trail[k].x, trail[k].y);
          ctx.lineTo(trail[k + 1].x, trail[k + 1].y);
          ctx.stroke();
        }
        if (isFrontPass) {
          drawStarGlint(ctx, head.x, head.y, 8.2 * head.persp * scaleLW, 0.95, highlightCol, fState.time * 1.2);
        }
      }
    }

    function renderCrystalMesh(ctx, mesh, transformFn, cx, cy, unit, opts) {
      var worldVerts = [];
      var projVerts = [];
      var i;
      for (i = 0; i < mesh.verts.length; i++) {
        var wv = transformFn(mesh.verts[i]);
        worldVerts.push(wv);
        projVerts.push(project(wv, cx, cy, unit));
      }

      var faceList = [];
      for (i = 0; i < mesh.faces.length; i++) {
        var fIdx = mesh.faces[i];
        var a = worldVerts[fIdx[0]], b = worldVerts[fIdx[1]], c = worldVerts[fIdx[2]];
        var n = normalize(cross(sub(b, a), sub(c, a)));
        var avgZ = (a[2] + b[2] + c[2]) / 3;
        faceList.push({ ia: fIdx[0], ib: fIdx[1], ic: fIdx[2], n: n, avgZ: avgZ, facing: n[2] });
      }
      faceList.sort(function (u, v) { return u.avgZ - v.avgZ; });

      var goldMix = opts.goldMix || 0;
      var passFilter = opts.pass || 'all';
      var baseOpacity = opts.opacity != null ? opts.opacity : 0.86;
      var isInner = !!opts.isInner;
      var scaleLW = clamp(fState.stagePx / 520, 0.58, 1.08);

      for (i = 0; i < faceList.length; i++) {
        var f = faceList[i];
        if (passFilter === 'back' && f.facing >= 0) continue;
        if (passFilter === 'front' && f.facing < 0) continue;

        var pa = projVerts[f.ia], pb = projVerts[f.ib], pc = projVerts[f.ic];
        var nEff = f.facing >= 0 ? f.n : [-f.n[0], -f.n[1], -f.n[2]];
        var diffKey = Math.max(0, dot(nEff, LIGHT_KEY));
        var diffRim = Math.max(0, dot(nEff, LIGHT_RIM));
        var fresnel = Math.pow(1 - Math.abs(f.facing), 1.9);

        var isGoldShard = goldMix > 0.3;
        var cShadow = isGoldShard ? PAL.goldShadow : (isInner ? PAL.sapphireMid : PAL.sapphireDeep);
        var cMid = isGoldShard ? PAL.goldMain : PAL.sapphireMid;
        var cHi = isGoldShard ? PAL.goldBright : PAL.iceBright;

        var keyMix = clamp(diffKey * 0.86 + 0.18, 0, 1);
        var r = lerp(cShadow[0], cMid[0], keyMix);
        var g = lerp(cShadow[1], cMid[1], keyMix);
        var bl = lerp(cShadow[2], cMid[2], keyMix);

        var specBoost = clamp(Math.pow(diffKey, 2.9) * 0.88 + fresnel * 0.48 + diffRim * 0.25, 0, 1);
        var whiteW = isInner ? 0.80 : 0.68;
        r = lerp(r, PAL.iceWhite[0], specBoost * whiteW);
        g = lerp(g, PAL.iceWhite[1], specBoost * whiteW);
        bl = lerp(bl, PAL.iceWhite[2], specBoost * whiteW);

        if (diffRim > 0.32 || goldMix > 0.2) {
          var gAmt = clamp(diffRim * 0.34 + (isGoldShard ? 0.34 : goldMix * 0.30), 0, 0.68);
          r = lerp(r, cHi[0], gAmt);
          g = lerp(g, cHi[1], gAmt);
          bl = lerp(bl, cHi[2], gAmt);
        }

        var faceAlpha = f.facing < 0 ? baseOpacity * 0.42 : baseOpacity * (0.60 + 0.36 * diffKey + 0.18 * fresnel);
        var grad = ctx.createLinearGradient(pa.x, pa.y, (pb.x + pc.x) * 0.5, (pb.y + pc.y) * 0.5);
        grad.addColorStop(0, rgba([lerp(r, 255, 0.28), lerp(g, 255, 0.28), lerp(bl, 255, 0.28)], faceAlpha));
        grad.addColorStop(1, rgba([r, g, bl], faceAlpha * 0.88));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.lineTo(pc.x, pc.y);
        ctx.closePath();
        ctx.fill();

        if (f.facing >= 0 || isInner) {
          var edgeCol = specBoost > 0.52 ? PAL.iceWhite : (isGoldShard ? PAL.goldBright : PAL.iceBright);
          ctx.strokeStyle = rgba(edgeCol, clamp((0.40 + specBoost * 0.60) * 0.92, 0, 0.96));
          ctx.lineWidth = (opts.edgeWidth || 1.1) * scaleLW;
          ctx.stroke();
        }
      }
      return projVerts;
    }

    function computeShards(t, cx, cy, unit) {
      var sh = smoothstep(clamp(fState.shatterBlend, 0, 1));
      var list = [];
      for (var i = 0; i < SHARDS.length; i++) {
        var s = SHARDS[i];
        var mandalaRot = t * (s.tier === 1 ? -0.14 : 0.11);
        var ang = s.baseAngle + mandalaRot;
        var breathe = 1 + Math.sin(t * 1.9 + s.tier * 1.15 + s.idx * 0.4) * 0.035 + fState.hoverCore * 0.05;
        var mx = Math.cos(ang) * s.mandalaR * breathe;
        var my = Math.sin(ang) * s.mandalaR * breathe;
        var mz = s.mandalaZ + Math.sin(t * 1.6 + s.idx) * 0.035;

        var lt = t * s.speed;
        var lx = Math.sin(lt * s.lissA + s.phaseX) * s.ampX;
        var ly = Math.cos(lt * s.lissB + s.phaseY) * s.ampY;
        var lz = Math.sin(lt * s.lissC + s.phaseZ) * s.ampZ;

        var arcBoost = Math.sin(sh * Math.PI) * 0.22;
        var rawPos = [
          lerp(mx, lx, sh) * (1 + arcBoost),
          lerp(my, ly, sh) * (1 + arcBoost),
          lerp(mz, lz, sh)
        ];
        var worldPos = applyGlobalTilt(rawPos);
        var projCenter = project(worldPos, cx, cy, unit);
        var mandalaOrientZ = ang + Math.PI / 2;

        list.push({
          shard: s,
          rawPos: rawPos,
          worldPos: worldPos,
          projCenter: projCenter,
          rx: lerp(0.18 * Math.sin(t * 1.4 + s.idx), t * s.spinX + s.phaseX, sh),
          ry: lerp(0.32 * Math.cos(t * 1.1 + s.idx), t * s.spinY + s.phaseY, sh),
          rz: lerp(mandalaOrientZ, t * (s.spinX * 0.5) + s.phaseZ, sh),
          z: worldPos[2]
        });
      }
      list.sort(function (a, b) { return a.z - b.z; });
      return list;
    }

    function drawMandalaFilaments(ctx, shardItems, cx, cy) {
      var mandalaWeight = clamp(1 - fState.shatterBlend * 1.35, 0, 1);
      if (mandalaWeight <= 0.01) return;
      var byId = new Array(18);
      var i;
      for (i = 0; i < shardItems.length; i++) byId[shardItems[i].shard.id] = shardItems[i];
      var scaleLW = clamp(fState.stagePx / 520, 0.62, 1.05);

      ctx.save();
      for (var tier = 0; tier < 3; tier++) {
        var base = tier * 6;
        var col = tier === 1 ? PAL.goldMain : PAL.sapphireMid;
        ctx.strokeStyle = rgba(col, mandalaWeight * 0.28 * (1 - tier * 0.14));
        ctx.lineWidth = (tier === 0 ? 1.15 : 0.88) * scaleLW;
        ctx.beginPath();
        for (i = 0; i < 6; i++) {
          var p = byId[base + i].projCenter;
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();

        if (tier === 0) {
          for (i = 0; i < 6; i++) {
            var p0 = byId[i].projCenter;
            var p1L = byId[6 + i].projCenter;
            var p1R = byId[6 + ((i + 5) % 6)].projCenter;
            var p2 = byId[12 + i].projCenter;
            ctx.strokeStyle = rgba(PAL.sapphireBright, mandalaWeight * 0.30);
            ctx.lineWidth = 1.0 * scaleLW;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(p0.x, p0.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            ctx.strokeStyle = rgba(PAL.goldMain, mandalaWeight * 0.20);
            ctx.lineWidth = 0.72 * scaleLW;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1L.x, p1L.y);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1R.x, p1R.y);
            ctx.stroke();
          }
        }
      }

      ctx.strokeStyle = rgba(PAL.goldMain, mandalaWeight * 0.26);
      ctx.lineWidth = 0.92 * scaleLW;
      for (var offset = 0; offset < 2; offset++) {
        ctx.beginPath();
        for (var k = 0; k < 3; k++) {
          var pk = byId[6 + ((k * 2 + offset) % 6)].projCenter;
          if (k === 0) ctx.moveTo(pk.x, pk.y);
          else ctx.lineTo(pk.x, pk.y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawShardItem(ctx, item, cx, cy, unit, t) {
      var s = item.shard;
      var sh = fState.shatterBlend;
      var sc = s.scale * (1 + fState.hoverCore * 0.06);
      var scaleLW = clamp(fState.stagePx / 520, 0.62, 1.05);

      if (sh > 0.08) {
        var tetherAlpha = sh * clamp((item.z + 1.2) / 2.4, 0.15, 0.75) * 0.14;
        var grad = ctx.createLinearGradient(cx, cy, item.projCenter.x, item.projCenter.y);
        grad.addColorStop(0, rgba(PAL.iceBright, 0));
        grad.addColorStop(0.55, rgba(s.goldTint > 0.4 ? PAL.goldMain : PAL.sapphireBright, tetherAlpha));
        grad.addColorStop(1, rgba(PAL.iceWhite, tetherAlpha * 1.4));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.75 * scaleLW;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(item.projCenter.x, item.projCenter.y);
        ctx.stroke();
      }

      var transformFn = function (v) {
        var oriented = rotEuler([v[0] * sc, v[1] * sc, v[2] * sc], item.rx, item.ry, item.rz);
        return applyGlobalTilt([
          oriented[0] + item.rawPos[0],
          oriented[1] + item.rawPos[1],
          oriented[2] + item.rawPos[2]
        ]);
      };

      var projVerts = renderCrystalMesh(ctx, SHARD_MESH, transformFn, cx, cy, unit, {
        opacity: 0.88,
        edgeWidth: 0.92,
        goldMix: s.goldTint
      });

      var glintWave = Math.sin(t * 2.1 + s.id * 1.7);
      if (glintWave > 0.78 && item.z > -0.2) {
        var tip = projVerts[0];
        var gAlpha = ((glintWave - 0.78) / 0.22) * 0.85;
        drawStarGlint(
          ctx, tip.x, tip.y,
          6.2 * tip.persp * s.scale * scaleLW,
          gAlpha,
          s.goldTint > 0.4 ? PAL.goldBright : PAL.iceBright,
          t * 0.8 + s.id
        );
      }
    }

    function drawFallbackCore2D(ctx, cx, cy, unit, t) {
      var sh = fState.shatterBlend;
      var pulse = 1 + Math.sin(t * 2.2) * 0.025 + fState.burstPulse * 0.14 + fState.hoverCore * 0.05;
      var coreScale = pulse * lerp(1.0, 0.92, sh);
      var outerTransform = function (v) {
        return applyGlobalTilt(rotEuler([v[0] * coreScale, v[1] * coreScale, v[2] * coreScale], 0.14 * Math.sin(t * 0.65), t * 0.36, 0.09 * Math.cos(t * 0.52)));
      };
      var innerScale = coreScale * (1.0 + Math.sin(t * 3.1) * 0.05 + sh * 0.12);
      var innerTransform = function (v) {
        return applyGlobalTilt(rotEuler([v[0] * innerScale, v[1] * innerScale, v[2] * innerScale], -t * 0.68, -t * 0.92, t * 0.44));
      };
      renderCrystalMesh(ctx, FALLBACK_OUTER_MESH, outerTransform, cx, cy, unit, { pass: 'back', opacity: 0.58, edgeWidth: 0.9, goldMix: 0.06 });
      var heartR = unit * 0.24 * pulse;
      var heartGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, heartR);
      heartGrad.addColorStop(0, rgba(PAL.iceWhite, 0.95));
      heartGrad.addColorStop(0.32, rgba(PAL.iceBright, 0.65));
      heartGrad.addColorStop(0.65, rgba(PAL.goldBright, 0.25));
      heartGrad.addColorStop(1, rgba(PAL.sapphireMid, 0));
      ctx.fillStyle = heartGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, heartR, 0, Math.PI * 2);
      ctx.fill();
      renderCrystalMesh(ctx, FALLBACK_INNER_MESH, innerTransform, cx, cy, unit, { pass: 'all', isInner: true, opacity: 0.92, edgeWidth: 1.2, goldMix: 0.60 });
      drawStarGlint(ctx, cx, cy, unit * 0.13, 0.94, PAL.goldBright, t * 0.35);
      renderCrystalMesh(ctx, FALLBACK_OUTER_MESH, outerTransform, cx, cy, unit, { pass: 'front', opacity: 0.66, edgeWidth: 1.4, goldMix: 0.10 });
    }

    function spawnShockwave(x, y, toShatter) {
      var unit = fState.stagePx * 0.40;
      SHOCKWAVES.push({
        x: x, y: y,
        r: unit * 0.16,
        maxR: unit * (toShatter ? 1.52 : 1.24),
        life: 0,
        dur: 0.85,
        gold: toShatter
      });
      for (var i = 0; i < 22; i++) {
        var ang = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
        var spd = (72 + Math.random() * 185) * clamp(fState.stagePx / 520, 0.48, 1.0);
        TRAIL_PARTICLES.push({
          x: x, y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0,
          maxLife: 0.62 + Math.random() * 0.52,
          size: (2.0 + Math.random() * 3.0) * clamp(fState.stagePx / 520, 0.6, 1.0),
          star: i % 3 === 0,
          gold: i % 4 === 0,
          attracted: false
        });
      }
    }

    function spawnCursorDust(x, y, dx, dy) {
      var count = Math.min(3, 1 + Math.floor(Math.hypot(dx, dy) / 14));
      var sc = clamp(fState.stagePx / 520, 0.58, 1.0);
      for (var i = 0; i < count; i++) {
        if (TRAIL_PARTICLES.length > 110) TRAIL_PARTICLES.shift();
        TRAIL_PARTICLES.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: dx * 0.13 + (Math.random() - 0.5) * 24,
          vy: dy * 0.13 + (Math.random() - 0.5) * 24 - 7,
          life: 0,
          maxLife: 0.78 + Math.random() * 0.62,
          size: (1.5 + Math.random() * 2.4) * sc,
          star: Math.random() < 0.30,
          gold: Math.random() < 0.34,
          attracted: true
        });
      }
    }

    function updateAndDrawFrontFx(ctx, dt, cx, cy, unit, t) {
      var scaleLW = clamp(fState.stagePx / 520, 0.58, 1.08);
      /* Subtle top & bottom apex star-glints synchronized with the WebGL crystal tips */
      var apexTop = project(applyGlobalTilt([0, -0.43, 0.04]), cx, cy, unit);
      var apexBot = project(applyGlobalTilt([0, 0.43, 0.04]), cx, cy, unit);
      var apexPulse = 0.72 + 0.24 * Math.sin(t * 2.4);
      drawStarGlint(ctx, apexTop.x, apexTop.y, 12.5 * apexTop.persp * scaleLW, apexPulse, PAL.iceBright, -t * 0.45);
      drawStarGlint(ctx, apexBot.x, apexBot.y, 9.2 * apexBot.persp * scaleLW, apexPulse * 0.78, PAL.goldBright, t * 0.38);

      var i;
      for (i = TRAIL_PARTICLES.length - 1; i >= 0; i--) {
        var p = TRAIL_PARTICLES[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          TRAIL_PARTICLES.splice(i, 1);
          continue;
        }
        if (p.attracted) {
          var dx = cx - p.x;
          var dy = cy - p.y;
          var d = Math.hypot(dx, dy) || 1;
          var g = clamp(92 / (d * 0.014 + 1), 12, 86);
          p.vx += ((dx / d) * g - (dy / d) * g * 0.38) * dt;
          p.vy += ((dy / d) * g + (dx / d) * g * 0.38) * dt;
        }
        var damp = Math.pow(0.96, dt * 60);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        var frac = 1 - p.life / p.maxLife;
        var alpha = Math.sin(frac * Math.PI) * 0.88;
        var col = p.gold ? PAL.goldMain : PAL.sapphireBright;
        if (p.star) {
          drawStarGlint(ctx, p.x, p.y, p.size * 2.3 * frac, alpha, col, p.life * 2.4);
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4 + p.life * 2);
          ctx.fillStyle = rgba(col, alpha);
          var sz = p.size * frac;
          ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
          ctx.restore();
        }
      }

      for (i = SHOCKWAVES.length - 1; i >= 0; i--) {
        var sw = SHOCKWAVES[i];
        sw.life += dt;
        if (sw.life >= sw.dur) {
          SHOCKWAVES.splice(i, 1);
          continue;
        }
        var prog = sw.life / sw.dur;
        var eased = 1 - Math.pow(1 - prog, 3);
        var rad = lerp(sw.r, sw.maxR, eased);
        var sAlpha = (1 - prog) * (1 - prog) * 0.58;
        var sCol = sw.gold ? PAL.goldMain : PAL.sapphireBright;
        ctx.strokeStyle = rgba(sCol, sAlpha);
        ctx.lineWidth = ((1 - prog) * 2.6 + 0.5) * scaleLW;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, rad, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = rgba(PAL.iceBright, sAlpha * 0.72);
        ctx.lineWidth = 1.0 * scaleLW;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, rad * 0.86, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function renderFrame(dt) {
      syncSizes();
      fState.time += dt;
      fState.frameCount++;

      /* Critically damped spring for mandala <-> shatter morph */
      var springK = 26;
      var springD = 8.4;
      var force = (fState.shatterTarget - fState.shatterBlend) * springK - fState.shatterVel * springD;
      fState.shatterVel += force * dt;
      fState.shatterBlend = clamp(fState.shatterBlend + fState.shatterVel * dt, -0.08, 1.08);

      var targetTiltX = fState.normX * 0.26;
      var targetTiltY = -fState.normY * 0.20;
      var tiltEase = 1 - Math.exp(-dt * 5.0);
      fState.tiltX = lerp(fState.tiltX, targetTiltX, tiltEase);
      fState.tiltY = lerp(fState.tiltY, targetTiltY, tiltEase);

      if (!fState.dragging) {
        var dragDecay = Math.pow(0.974, dt * 60);
        fState.dragTargetX *= dragDecay;
        fState.dragTargetY *= dragDecay;
      }
      var dragEase = 1 - Math.exp(-dt * 8.0);
      fState.dragRotX = lerp(fState.dragRotX, fState.dragTargetX, dragEase);
      fState.dragRotY = lerp(fState.dragRotY, fState.dragTargetY, dragEase);
      fState.burstPulse *= Math.pow(0.92, dt * 60);

      var cCss = fState.canvasCss;
      var cx = cCss * 0.5;
      var cy = cCss * 0.5;
      var unit = fState.stagePx * 0.40;
      var dpr = fState.dpr;

      var cursorDist = fState.mouseActive ? Math.hypot(fState.localMx - cx, fState.localMy - cy) : 9999;
      var hoverTarget = fState.mouseActive && cursorDist < unit * 1.05 ? 1 : 0;
      fState.hoverCore = lerp(fState.hoverCore, hoverTarget, 1 - Math.exp(-dt * 6.0));

      /* Precompute 4 armillary rings & 18 shards */
      var ringGeoms = [];
      var i;
      for (i = 0; i < ARMILLARY_RINGS.length; i++) {
        ringGeoms.push(computeArmillaryRingGeometry(ARMILLARY_RINGS[i], fState.time, cx, cy, unit));
      }
      var shardItems = computeShards(fState.time, cx, cy, unit);

      /* === PASS A: BACK CANVAS 2D (behind WebGL core) === */
      backCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      backCtx.clearRect(0, 0, cCss, cCss);
      drawCompassArchitecture(backCtx, cx, cy, unit, fState.time);
      drawVolumetricCaustics(backCtx, cx, cy, unit, fState.time);
      for (i = 0; i < ringGeoms.length; i++) {
        drawArmillaryRingPass(backCtx, ringGeoms[i], false);
      }
      drawMandalaFilaments(backCtx, shardItems, cx, cy);
      for (i = 0; i < shardItems.length; i++) {
        if (shardItems[i].z < 0) drawShardItem(backCtx, shardItems[i], cx, cy, unit, fState.time);
      }

      /* === PASS B: CENTER TRANSPARENT WEBGL CORE (Scaled Scheme C KIFS Crystal) === */
      if (useWebGL && gl && glProg && glUniforms) {
        var pulseAge = Math.max(0.0, fState.time - fState.pulseAt);
        var pulseAmp = pulseAge < 4.2 ? fState.pulseStrength * Math.exp(-pulseAge * 1.15) : 0.0;
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(glProg);
        gl.uniform2f(glUniforms.uRes, glCanvas.width, glCanvas.height);
        gl.uniform1f(glUniforms.uTime, fState.time);
        gl.uniform2f(glUniforms.uOrbit, fState.tiltX + fState.dragRotX, fState.tiltY + fState.dragRotY);
        gl.uniform1f(glUniforms.uPulseAge, pulseAge);
        gl.uniform1f(glUniforms.uPulseAmp, pulseAmp);
        gl.uniform1f(glUniforms.uShatter, clamp(fState.shatterBlend, 0, 1));
        gl.uniform1f(glUniforms.uHover, fState.hoverCore);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (isSoftwareGL && typeof gl.fenceSync === 'function') {
          if (fState.glSync) {
            try { gl.deleteSync(fState.glSync); } catch (e) {}
            fState.glSync = null;
          }
          try {
            fState.glSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
          } catch (e) {
            fState.glSync = null;
          }
        }
      } else {
        drawFallbackCore2D(backCtx, cx, cy, unit, fState.time);
      }

      /* === PASS C: FRONT CANVAS 2D (wrapping in front of WebGL core!) === */
      frontCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      frontCtx.clearRect(0, 0, cCss, cCss);
      for (i = 0; i < shardItems.length; i++) {
        if (shardItems[i].z >= 0) drawShardItem(frontCtx, shardItems[i], cx, cy, unit, fState.time);
      }
      for (i = 0; i < ringGeoms.length; i++) {
        drawArmillaryRingPass(frontCtx, ringGeoms[i], true);
      }
      updateAndDrawFrontFx(frontCtx, dt, cx, cy, unit, fState.time);
    }

    function toggleMorph() {
      fState.shatterTarget = fState.shatterTarget === 0 ? 1 : 0;
      fState.burstPulse = 1.0;
      fState.pulseAt = fState.time;
      fState.pulseStrength = 1.0;
      var half = fState.canvasCss * 0.5;
      spawnShockwave(half, half, fState.shatterTarget === 1);
      playSfxSafe('glass_tap');
    }

    function pulseSoft() {
      fState.burstPulse = Math.max(fState.burstPulse, 0.34);
      fState.pulseAt = fState.time;
      fState.pulseStrength = Math.max(fState.pulseStrength * 0.5, 0.42);
    }

    function isSoftwareGpuBusy() {
      if (!isSoftwareGL || !gl || !fState.glSync || typeof gl.getSyncParameter !== 'function') return false;
      try {
        var status = gl.getSyncParameter(fState.glSync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) return true;
        gl.deleteSync(fState.glSync);
        fState.glSync = null;
        return false;
      } catch (e) {
        fState.glSync = null;
        return false;
      }
    }

    function scheduleNextFrame() {
      if (!fState.running) return;
      if (isSoftwareGL) {
        fState.softTimer = setTimeout(function () {
          fState.softTimer = 0;
          if (!fState.running) return;
          if (isSoftwareGpuBusy()) {
            scheduleNextFrame();
            return;
          }
          fState.rafId = requestAnimationFrame(stepLoop);
        }, 220);
      } else {
        fState.rafId = requestAnimationFrame(stepLoop);
      }
    }

    function stepLoop(ts) {
      fState.rafId = 0;
      if (!fState.running) return;
      if (!isTitleVis() || document.hidden || st.mode === 'archive' || st.reduced) {
        stop();
        return;
      }
      if (isAnyModalBlocking()) {
        fState.lastTs = 0;
        scheduleNextFrame();
        return;
      }
      if (isSoftwareGpuBusy()) {
        scheduleNextFrame();
        return;
      }
      var dt = fState.lastTs ? clamp((ts - fState.lastTs) / 1000, 0.004, 0.05) : 0.0166;
      fState.lastTs = ts;
      renderFrame(dt);
      if (isSoftwareGL && gl && !fState.glSync) gl.flush();
      scheduleNextFrame();
    }

    function start() {
      if (!isTitleVis() || document.hidden || st.mode === 'archive') {
        stop();
        return;
      }
      if (st.reduced) {
        stop();
        renderFrame(0.016);
        return;
      }
      if (fState.running) return;
      if (typeof requestAnimationFrame !== 'function') return;
      fState.running = true;
      fState.lastTs = 0;
      if (isSoftwareGL) {
        scheduleNextFrame();
      } else {
        fState.rafId = requestAnimationFrame(stepLoop);
      }
    }

    function stop() {
      fState.running = false;
      fState.lastTs = 0;
      if (fState.softTimer) {
        clearTimeout(fState.softTimer);
        fState.softTimer = 0;
      }
      if (fState.rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(fState.rafId);
      }
      fState.rafId = 0;
      if (fState.glSync && gl && typeof gl.deleteSync === 'function') {
        try { gl.deleteSync(fState.glSync); } catch (e) {}
      }
      fState.glSync = null;
    }

    /* Interactive pointer handlers (click morph, drag tilt, gravity stardust) */
    var cleanups = [];
    var onHitDown = function (ev) {
      if (st.mode === 'archive' || !isTitleVis()) return;
      fState.dragging = true;
      fState.dragStartX = ev.clientX;
      fState.dragStartY = ev.clientY;
      fState.dragMoved = 0;
    };
    var onWinMove = function (ev) {
      if (!fState.running || !isTitleVis() || st.mode === 'archive') return;
      var rect = backCanvas.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      var lx = ev.clientX - rect.left;
      var ly = ev.clientY - rect.top;
      var dx = fState.mouseActive ? (lx - fState.localMx) : 0;
      var dy = fState.mouseActive ? (ly - fState.localMy) : 0;
      fState.localMx = lx;
      fState.localMy = ly;
      fState.mouseActive = true;

      var titleEl = getTitle();
      var tr = titleEl ? titleEl.getBoundingClientRect() : null;
      if (tr && tr.width > 0 && tr.height > 0) {
        fState.normX = clamp(((ev.clientX - tr.left) / tr.width) * 2 - 1, -1, 1);
        fState.normY = clamp(((ev.clientY - tr.top) / tr.height) * 2 - 1, -1, 1);
      }

      var distToCenter = Math.hypot(lx - rect.width * 0.5, ly - rect.height * 0.5);
      if (distToCenter < rect.width * 0.46 && Math.hypot(dx, dy) > 2.4 && isAmbientFxAllowed()) {
        spawnCursorDust(lx, ly, dx, dy);
      }

      if (fState.dragging) {
        var ddx = ev.clientX - fState.dragStartX;
        var ddy = ev.clientY - fState.dragStartY;
        fState.dragMoved += Math.hypot(ddx, ddy);
        fState.dragTargetX = clamp(fState.dragTargetX + ddx * 0.006, -0.75, 0.75);
        fState.dragTargetY = clamp(fState.dragTargetY + ddy * 0.006, -0.55, 0.55);
        fState.dragStartX = ev.clientX;
        fState.dragStartY = ev.clientY;
      }
    };
    var onWinUp = function () {
      if (!fState.dragging) return;
      fState.dragging = false;
      if (fState.dragMoved < 9 && st.mode !== 'archive' && isTitleVis()) {
        toggleMorph();
      }
    };
    var onResize = function () {
      if (!isTitleVis() || isAnyModalBlocking()) return;
      syncSizes();
      if (!fState.running && st.mode !== 'archive') {
        renderFrame(0.001);
      }
    };

    hitBtn.addEventListener('pointerdown', onHitDown);
    window.addEventListener('pointermove', onWinMove, { passive: true });
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('pointercancel', onWinUp);
    window.addEventListener('resize', onResize, { passive: true });
    cleanups.push(function () {
      hitBtn.removeEventListener('pointerdown', onHitDown);
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
      window.removeEventListener('resize', onResize);
    });

    var resizeObs = null;
    if (typeof ResizeObserver === 'function') {
      try {
        resizeObs = new ResizeObserver(onResize);
        resizeObs.observe(stageEl);
      } catch (e) { resizeObs = null; }
    }

    function destroyEngine() {
      stop();
      if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
      for (var c = 0; c < cleanups.length; c++) { try { cleanups[c](); } catch (e) {} }
      cleanups = [];
      if (gl) {
        try {
          var lose = gl.getExtension('WEBGL_lose_context');
          if (lose && typeof lose.loseContext === 'function') lose.loseContext();
        } catch (e) {}
        gl = null;
      }
    }

    var engineApi = {
      wrap: wrap,
      start: start,
      stop: stop,
      toggleMorph: toggleMorph,
      pulseSoft: pulseSoft,
      renderOnce: function () { renderFrame(0.016); },
      destroy: destroyEngine,
      getState: function () {
        return {
          running: fState.running,
          rafId: fState.rafId,
          useWebGL: useWebGL,
          backend: glBackendLabel,
          shaderError: shaderError,
          shattered: fState.shatterTarget === 1,
          frameCount: fState.frameCount,
          stagePx: fState.stagePx,
          glWidth: glCanvas.width,
          glHeight: glCanvas.height
        };
      }
    };

    syncSizes(true);
    renderFrame(0.016);
    if (root) root.__TITLE_FUSION_CRYSTAL__ = engineApi;
    return engineApi;
  }

  function startFusionLoop() {
    if (st.fusion) st.fusion.start();
  }

  function stopFusionLoop() {
    if (st.fusion) st.fusion.stop();
  }

  function destroyFusionCrystal() {
    if (st.fusion) {
      st.fusion.destroy();
      st.fusion = null;
    }
  }

  function syncCrystalFocusability(mode) {
    if (!hasDom()) return;
    var anchor = document.getElementById('v3-crystal-anchor');
    if (!anchor) return;
    var allowFocus = (mode === 'archive');
    var coreBtn = document.getElementById('v3-core-gem');
    if (coreBtn) coreBtn.tabIndex = allowFocus ? 0 : -1;
    var slotShards = anchor.querySelectorAll('.v3-shard[data-slot]');
    for (var i = 0; i < slotShards.length; i++) {
      slotShards[i].tabIndex = allowFocus ? 0 : -1;
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

    var stage = anchor.querySelector('.v3-sculpture-stage');
    if (!stage) {
      stage = document.createElement('div');
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

    syncCrystalFocusability(st.mode);

    if (!st.fusion && !isJsdom()) {
      st.fusion = createFusionCrystalEngine(stage);
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
      ensureCombatSettingsStyle();
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
                '<label class="v3-slider-lbl" for="v3-set-voice">角色语音</label>' +
                '<input id="v3-set-voice" class="v3-hairline-range" type="range" min="0" max="100" step="1" value="90"/>' +
                '<span id="v3-set-voice-val" class="v3-slider-val">90%</span>' +
              '</div>' +
              '<div class="v3-switch-row">' +
                '<span class="v3-slider-lbl">语音开关</span>' +
                '<div class="v3-bare-switcher">' +
                  '<button type="button" id="v3-set-voice-toggle" aria-pressed="true" aria-label="切换角色语音开关">' +
                    '<span class="v3-voice-dot" aria-hidden="true"></span>' +
                    '<span id="v3-voice-toggle-val" class="v3-sw-val">开启</span>' +
                  '</button>' +
                '</div>' +
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
            '<div class="v3-set-section v3-combat-section">' +
              '<div class="v3-set-sec-lbl">COMBAT / 战斗</div>' +
              '<div class="v3-switch-row">' +
                '<span class="v3-slider-lbl">精准护手</span>' +
                '<div class="v3-bare-switcher">' +
                  '<button type="button" id="v3-ring-assist-prev" class="v3-sw-arrow" aria-label="上一档精准护手">‹</button>' +
                  '<span id="v3-ring-assist-val" class="v3-sw-val">标准</span>' +
                  '<button type="button" id="v3-ring-assist-next" class="v3-sw-arrow" aria-label="下一档精准护手">›</button>' +
                '</div>' +
              '</div>' +
              '<div class="v3-switch-row v3-casual-row">' +
                '<span class="v3-slider-lbl">休闲模式</span>' +
                '<div class="v3-bare-switcher">' +
                  '<button type="button" id="v3-set-casual-toggle" class="v3-combat-toggle is-off" aria-pressed="false" aria-label="切换休闲模式" data-indie-tip="开启后战斗难度大幅下降，适合想要轻松享受剧情的休闲玩家">' +
                    '<span class="v3-casual-dot v3-combat-dot" aria-hidden="true"></span>' +
                    '<span id="v3-casual-toggle-val" class="v3-sw-val">关闭</span>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<p class="v3-combat-sub">开启后战斗难度大幅下降，适合想要轻松享受剧情的休闲玩家</p>' +
              '<div class="v3-switch-row v3-auto-end-row">' +
                '<span class="v3-slider-lbl">自动结束</span>' +
                '<div class="v3-bare-switcher">' +
                  '<button type="button" id="v3-set-auto-end-toggle" class="v3-combat-toggle" aria-pressed="true" aria-label="切换自动结束回合" data-indie-tip="无可用行动后自动切敌回合；关闭后可手动结束回合">' +
                    '<span class="v3-casual-dot v3-combat-dot" aria-hidden="true"></span>' +
                    '<span id="v3-auto-end-toggle-val" class="v3-sw-val">自动切回合</span>' +
                  '</button>' +
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

  function cleanArchiveTitle(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    return s.replace(/^([^\s·：\-—]+)\s*·\s*\1(?=[·\s：\-—]|$)/, '$1');
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
      metaEl.innerHTML = '<p class="v3-arc-empty-copy">此晶簇当前为空白状态。进入旅程后，可随时于随身手札中刻录当下片段，或于每卷重要时节自动铭入核心。</p>';
    } else {
      titleEl.textContent = cleanArchiveTitle(meta.chapterTitle || meta.locName || '维斯特利亚旅途片段');
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

  function normalizeRingAssist(val) {
    var s = String(val == null ? '' : val).trim().toLowerCase();
    if (s === 'relaxed' || s === 'off') return s;
    return 'standard';
  }

  function normalizeCasualMode(val) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      var s = val.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'on';
    }
    return !!val;
  }

  function normalizeAutoEndTurn(val) {
    if (val === false) return false;
    if (val == null || val === true) return true;
    if (typeof val === 'number') return isNaN(val) ? true : val !== 0;
    var s = String(val).trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
    return true;
  }

  function getCombatTimingRingApi() {
    if (root && root.CombatTimingRing) return root.CombatTimingRing;
    return null;
  }

  function getCombatEngineApi() {
    if (root && root.CombatEngine) return root.CombatEngine;
    return null;
  }

  function readAutoEndTurnSetting() {
    var val = true;
    try {
      if (root && root.VNUx && typeof root.VNUx.getPrefs === 'function') {
        var p = root.VNUx.getPrefs();
        if (p && p.combatAutoEndTurn != null) val = normalizeAutoEndTurn(p.combatAutoEndTurn);
      }
    } catch (e) {}
    try {
      var lsAutoEnd = localStorage.getItem(COMBAT_AUTO_END_KEY);
      if (lsAutoEnd !== null && lsAutoEnd !== '') val = normalizeAutoEndTurn(lsAutoEnd);
    } catch (e) {}
    try {
      var engAutoEnd = null;
      var ce = getCombatEngineApi();
      if (ce) {
        if (typeof ce.isAutoEndTurn === 'function') engAutoEnd = ce.isAutoEndTurn();
        else if (typeof ce.getAutoEndTurn === 'function') engAutoEnd = ce.getAutoEndTurn();
        else if (typeof ce.isCombatAutoEndTurn === 'function') engAutoEnd = ce.isCombatAutoEndTurn();
        else if (typeof ce.getCombatAutoEndTurn === 'function') engAutoEnd = ce.getCombatAutoEndTurn();
      }
      if (engAutoEnd == null) {
        var ctr = getCombatTimingRingApi();
        if (ctr) {
          if (typeof ctr.isAutoEndTurn === 'function') engAutoEnd = ctr.isAutoEndTurn();
          else if (typeof ctr.getAutoEndTurn === 'function') engAutoEnd = ctr.getAutoEndTurn();
          else if (typeof ctr.getPrefs === 'function') {
            var cp = ctr.getPrefs();
            if (cp) engAutoEnd = cp.autoEndTurn != null ? cp.autoEndTurn : cp.combatAutoEndTurn;
          }
        }
      }
      if (engAutoEnd != null && engAutoEnd !== '') val = normalizeAutoEndTurn(engAutoEnd);
    } catch (e) {}
    return val;
  }

  function writeAutoEndTurnSetting(val) {
    var next = normalizeAutoEndTurn(val);
    if (root && root.VNUx && typeof root.VNUx.setPref === 'function') {
      try { root.VNUx.setPref('combatAutoEndTurn', next); } catch (e) {}
      return next;
    }
    try { localStorage.setItem(COMBAT_AUTO_END_KEY, next ? 'true' : 'false'); } catch (e) {}
    try {
      var vnKey = (root && root.VNUx && root.VNUx.VN_PREFS_KEY) || 'ojousama_vn_prefs_v1';
      var raw = JSON.parse(localStorage.getItem(vnKey) || '{}');
      if (raw && typeof raw === 'object') {
        raw.combatAutoEndTurn = next;
        localStorage.setItem(vnKey, JSON.stringify(raw));
      }
    } catch (e) {}
    var handled = false;
    var ce = getCombatEngineApi();
    if (ce) {
      try {
        if (typeof ce.setAutoEndTurn === 'function') { ce.setAutoEndTurn(next); handled = true; }
        else if (typeof ce.setCombatAutoEndTurn === 'function') { ce.setCombatAutoEndTurn(next); handled = true; }
      } catch (e) {}
    }
    var ctr = getCombatTimingRingApi();
    if (ctr) {
      try {
        if (typeof ctr.setAutoEndTurn === 'function') { ctr.setAutoEndTurn(next); handled = true; }
        else if (typeof ctr.setCombatAutoEndTurn === 'function') { ctr.setCombatAutoEndTurn(next); handled = true; }
      } catch (e) {}
    }
    if (!handled) {
      var live = readLiveSettings();
      dispatchFallbackCombatPrefsEvent(live.combatRingAssist, live.combatCasualMode, next);
    }
    return next;
  }

  function ensureCombatSettingsStyle() {
    if (!hasDom() || !document.head || document.getElementById('v3-combat-settings-style')) return;
    var style = document.createElement('style');
    style.id = 'v3-combat-settings-style';
    style.textContent =
      '#title-screen #v3-view-settings .v3-set-body{' +
        'max-height:min(620px,68vh);' +
        'padding:10px 0 6px;' +
      '}' +
      '#title-screen #v3-view-settings .v3-set-section{margin-bottom:10px;}' +
      '#title-screen #v3-view-settings .v3-combat-section{margin-bottom:6px;}' +
      '#title-screen #v3-view-settings .v3-casual-row,' +
      '#title-screen #v3-view-settings .v3-auto-end-row{min-height:30px;padding-bottom:0;}' +
      '#title-screen #v3-view-settings .v3-combat-toggle{' +
        'display:inline-flex;align-items:center;justify-content:center;gap:8px;' +
        'width:100%;min-height:32px;padding:0 4px;' +
        'border:none;border-bottom:1px solid rgba(22,88,235,0.24);border-radius:0;' +
        'background:transparent;color:#1b2333;font-size:13.5px;font-weight:600;' +
        'letter-spacing:0.05em;cursor:pointer;' +
        'transition:color 0.18s ease,border-bottom-color 0.18s ease,background-color 0.18s ease;' +
      '}' +
      '#title-screen #v3-view-settings .v3-combat-toggle .v3-sw-val{flex:0 0 auto;}' +
      '#title-screen #v3-view-settings .v3-combat-toggle:hover,' +
      '#title-screen #v3-view-settings .v3-combat-toggle:focus-visible{' +
        'color:#1658eb;border-bottom-color:#1658eb;background:rgba(22,88,235,0.04);' +
      '}' +
      '#title-screen #v3-view-settings .v3-combat-toggle.is-off{' +
        'color:#64748b;border-bottom-color:rgba(100,116,139,0.26);' +
      '}' +
      '#title-screen #v3-view-settings .v3-combat-toggle .v3-casual-dot,' +
      '#title-screen #v3-view-settings .v3-combat-toggle .v3-combat-dot{' +
        'width:6px;height:6px;transform:rotate(45deg);background:#1658eb;flex-shrink:0;' +
        'transition:background-color 0.18s ease,opacity 0.18s ease;' +
      '}' +
      '#title-screen #v3-view-settings .v3-combat-toggle.is-off .v3-casual-dot,' +
      '#title-screen #v3-view-settings .v3-combat-toggle.is-off .v3-combat-dot{background:#94a3b8;opacity:0.55;}' +
      '#title-screen .v3-combat-sub{' +
        'margin:1px 0 2px;padding:0;font-size:11.5px;line-height:1.32;' +
        'letter-spacing:0.02em;color:#526078;' +
      '}' +
      '@media (max-height:760px) and (min-width:721px){' +
        '#title-screen #v3-view-settings .v3-set-body{padding:6px 0 4px;max-height:min(550px,72vh);}' +
        '#title-screen #v3-view-settings .v3-set-section{margin-bottom:7px;}' +
        '#title-screen #v3-view-settings .v3-combat-section{margin-bottom:5px;}' +
        '#title-screen #v3-view-settings .v3-set-sec-lbl{margin-bottom:3px;font-size:11.5px;}' +
        '#title-screen #v3-view-settings .v3-slider-row,' +
        '#title-screen #v3-view-settings .v3-switch-row{min-height:27px;padding:1px 0;}' +
        '#title-screen #v3-view-settings .v3-bare-switcher .v3-sw-arrow,' +
        '#title-screen #v3-set-voice-toggle,' +
        '#title-screen #v3-view-settings .v3-combat-toggle{min-height:25px;}' +
        '#title-screen .v3-combat-sub{margin:0 0 1px;font-size:11px;line-height:1.25;}' +
        '#title-screen #v3-view-settings .indie-settings-section{margin-top:6px;padding-top:6px;}' +
        '#title-screen #v3-view-settings .indie-settings-row{min-height:26px;padding:1px 0;}' +
      '}' +
      '@media (max-height:680px) and (min-width:721px){' +
        '#title-screen #v3-view-settings .v3-set-body{' +
          'padding:4px 0 2px;max-height:calc(100vh - 136px);max-height:calc(100dvh - 136px);' +
        '}' +
        '#title-screen #v3-view-settings .v3-set-section{margin-bottom:5px;}' +
        '#title-screen #v3-view-settings .v3-combat-section{margin-bottom:4px;}' +
        '#title-screen #v3-view-settings .v3-set-sec-lbl{margin-bottom:2px;font-size:10.5px;line-height:1.2;}' +
        '#title-screen #v3-view-settings .v3-slider-row,' +
        '#title-screen #v3-view-settings .v3-switch-row{min-height:23px;padding:0;}' +
        '#title-screen #v3-view-settings .v3-hairline-range{height:18px;}' +
        '#title-screen #v3-view-settings .v3-bare-switcher .v3-sw-arrow,' +
        '#title-screen #v3-set-voice-toggle,' +
        '#title-screen #v3-view-settings .v3-combat-toggle{min-height:22px;font-size:12px;}' +
        '#title-screen .v3-combat-sub{margin:0 0 1px;font-size:10.5px;line-height:1.2;}' +
        '#title-screen #v3-view-settings .indie-settings-section{margin-top:5px;padding-top:5px;}' +
        '#title-screen #v3-view-settings .indie-settings-head{margin-bottom:2px;}' +
        '#title-screen #v3-view-settings .indie-settings-row{min-height:22px;padding:0;}' +
        '#title-screen #v3-view-settings .indie-action-btn{min-height:21px;padding:1px 8px;font-size:11px;}' +
      '}';
    document.head.appendChild(style);
  }

  function dispatchFallbackCombatPrefsEvent(assist, casual, autoEnd) {
    if (!root || typeof root.dispatchEvent !== 'function') return;
    var CE = root.CustomEvent || (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
    if (!CE) return;
    try {
      var norm = normalizeRingAssist(assist);
      var cas = !!casual;
      var autoEndVal = normalizeAutoEndTurn(autoEnd);
      root.dispatchEvent(new CE('combat:prefschange', {
        detail: {
          assistMode: norm,
          ringAssistMode: norm,
          combatRingAssist: norm,
          casualMode: cas,
          combatCasualMode: cas,
          autoEndTurn: autoEndVal,
          combatAutoEndTurn: autoEndVal,
          source: 'title-director'
        }
      }));
    } catch (e) {}
  }

  function readLiveSettings() {
    var res = {
      bgm: 0.5,
      sfx: 0.65,
      voiceVol: 0.90,
      voiceEnabled: true,
      bright: 1,
      typeSpeed: 'normal',
      fxEnabled: true,
      combatRingAssist: 'standard',
      combatCasualMode: false,
      combatAutoEndTurn: true
    };
    try {
      if (root && root.VNUx && typeof root.VNUx.getPrefs === 'function') {
        var p = root.VNUx.getPrefs();
        if (p) {
          if (typeof p.bgmVol === 'number') res.bgm = clamp(p.bgmVol, 0, 1);
          if (typeof p.sfxVol === 'number') res.sfx = clamp(p.sfxVol, 0, 1);
          if (typeof p.voiceVol === 'number') res.voiceVol = clamp(p.voiceVol, 0, 1);
          if (typeof p.voiceEnabled === 'boolean') res.voiceEnabled = p.voiceEnabled;
          if (typeof p.bright === 'number') res.bright = clamp(p.bright, 0.45, 1.0);
          if (p.typeSpeed) res.typeSpeed = String(p.typeSpeed);
          if (typeof p.fxEnabled === 'boolean') res.fxEnabled = p.fxEnabled;
          if (p.combatRingAssist != null) res.combatRingAssist = normalizeRingAssist(p.combatRingAssist);
          if (p.combatCasualMode != null) res.combatCasualMode = normalizeCasualMode(p.combatCasualMode);
          if (p.combatAutoEndTurn != null) res.combatAutoEndTurn = normalizeAutoEndTurn(p.combatAutoEndTurn);
        }
      }
    } catch (e) {}
    try {
      var lsAssist = localStorage.getItem(COMBAT_RING_ASSIST_KEY);
      if (lsAssist !== null && lsAssist !== '') res.combatRingAssist = normalizeRingAssist(lsAssist);
      var lsCasual = localStorage.getItem(COMBAT_CASUAL_MODE_KEY);
      if (lsCasual !== null && lsCasual !== '') res.combatCasualMode = normalizeCasualMode(lsCasual);
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
      if (root && root.VoiceEngine && typeof root.VoiceEngine.getVolume === 'function') {
        var vv = Number(root.VoiceEngine.getVolume());
        if (!isNaN(vv)) res.voiceVol = clamp(vv, 0, 1);
      }
      if (root && root.VoiceEngine && typeof root.VoiceEngine.isEnabled === 'function') {
        res.voiceEnabled = !!root.VoiceEngine.isEnabled();
      }
      if (root && typeof root.getTypeSpeed === 'function') {
        var ts = root.getTypeSpeed();
        if (ts) res.typeSpeed = String(ts);
      }
      var ctr = getCombatTimingRingApi();
      if (ctr) {
        var engAssist = null;
        if (typeof ctr.getAssistMode === 'function') engAssist = ctr.getAssistMode();
        else if (typeof ctr.getRingAssistMode === 'function') engAssist = ctr.getRingAssistMode();
        else if (typeof ctr.getMode === 'function') engAssist = ctr.getMode();
        else if (typeof ctr.getPrefs === 'function') {
          var cp = ctr.getPrefs();
          if (cp) engAssist = cp.assistMode != null ? cp.assistMode : (cp.ringAssistMode != null ? cp.ringAssistMode : cp.combatRingAssist);
        }
        if (engAssist != null && engAssist !== '') res.combatRingAssist = normalizeRingAssist(engAssist);

        var engCasual = null;
        if (typeof ctr.isCasualMode === 'function') engCasual = ctr.isCasualMode();
        else if (typeof ctr.getCasualMode === 'function') engCasual = ctr.getCasualMode();
        else if (typeof ctr.isCombatCasualMode === 'function') engCasual = ctr.isCombatCasualMode();
        else if (typeof ctr.getCombatCasualMode === 'function') engCasual = ctr.getCombatCasualMode();
        else if (typeof ctr.getPrefs === 'function') {
          var cp2 = ctr.getPrefs();
          if (cp2) engCasual = cp2.casualMode != null ? cp2.casualMode : cp2.combatCasualMode;
        }
        if (engCasual != null) res.combatCasualMode = normalizeCasualMode(engCasual);
      }
    } catch (e) {}
    res.combatAutoEndTurn = readAutoEndTurnSetting();
    return res;
  }

  function updateSliderVisual(inputEl, valEl, valPct, minPct, maxPct) {
    if (!inputEl) return;
    inputEl.value = String(valPct);
    var ratio = ((valPct - minPct) / Math.max(1, maxPct - minPct)) * 100;
    inputEl.style.setProperty('--v3-pct', clamp(ratio, 0, 100).toFixed(1) + '%');
    if (valEl) valEl.textContent = valPct + '%';
  }

  function syncSettingsDOM(patch) {
    var s = readLiveSettings();
    if (patch && typeof patch === 'object') {
      var patchAssist = patch.assistMode != null ? patch.assistMode : (patch.ringAssistMode != null ? patch.ringAssistMode : patch.combatRingAssist);
      if (patchAssist != null && patchAssist !== '') s.combatRingAssist = normalizeRingAssist(patchAssist);
      var patchCasual = patch.casualMode != null ? patch.casualMode : patch.combatCasualMode;
      if (patchCasual != null) s.combatCasualMode = normalizeCasualMode(patchCasual);
      var patchAutoEnd = patch.autoEndTurn != null ? patch.autoEndTurn : (patch.combatAutoEndTurn != null ? patch.combatAutoEndTurn : patch.combat_auto_end_turn);
      if (patchAutoEnd != null) s.combatAutoEndTurn = normalizeAutoEndTurn(patchAutoEnd);
    }
    updateSliderVisual(document.getElementById('v3-set-bgm'), document.getElementById('v3-set-bgm-val'), Math.round(s.bgm * 100), 0, 100);
    updateSliderVisual(document.getElementById('v3-set-sfx'), document.getElementById('v3-set-sfx-val'), Math.round(s.sfx * 100), 0, 100);
    updateSliderVisual(document.getElementById('v3-set-voice'), document.getElementById('v3-set-voice-val'), Math.round(s.voiceVol * 100), 0, 100);
    updateSliderVisual(document.getElementById('v3-set-bright'), document.getElementById('v3-set-bright-val'), Math.round(clamp(s.bright, 0.45, 1.0) * 100), 45, 100);

    var voiceToggleBtn = document.getElementById('v3-set-voice-toggle');
    var voiceToggleVal = document.getElementById('v3-voice-toggle-val');
    if (voiceToggleBtn) {
      voiceToggleBtn.classList.toggle('is-off', !s.voiceEnabled);
      voiceToggleBtn.setAttribute('aria-pressed', s.voiceEnabled ? 'true' : 'false');
    }
    if (voiceToggleVal) voiceToggleVal.textContent = s.voiceEnabled ? '开启' : '关闭';

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

    var assistEl = document.getElementById('v3-ring-assist-val');
    if (assistEl) {
      var assistFound = RING_ASSIST_OPTS[0];
      for (var j = 0; j < RING_ASSIST_OPTS.length; j++) {
        if (RING_ASSIST_OPTS[j].value === s.combatRingAssist) { assistFound = RING_ASSIST_OPTS[j]; break; }
      }
      assistEl.textContent = assistFound.label;
    }

    var casualBtn = document.getElementById('v3-set-casual-toggle');
    var casualVal = document.getElementById('v3-casual-toggle-val');
    if (casualBtn) {
      casualBtn.classList.toggle('is-off', !s.combatCasualMode);
      casualBtn.setAttribute('aria-pressed', s.combatCasualMode ? 'true' : 'false');
    }
    if (casualVal) casualVal.textContent = s.combatCasualMode ? '开启' : '关闭';

    var autoEndBtn = document.getElementById('v3-set-auto-end-toggle');
    var autoEndVal = document.getElementById('v3-auto-end-toggle-val');
    var autoEndOn = normalizeAutoEndTurn(s.combatAutoEndTurn);
    if (autoEndBtn) {
      autoEndBtn.classList.toggle('is-off', !autoEndOn);
      autoEndBtn.setAttribute('aria-pressed', autoEndOn ? 'true' : 'false');
    }
    if (autoEndVal) autoEndVal.textContent = autoEndOn ? '自动切回合' : '手动结束';

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
    } else if (kind === 'voiceVol') {
      var vv = clamp(Number(val), 0, 1);
      try { if (root && typeof root.setSetting === 'function') root.setSetting('voiceVol', vv); } catch (e) {}
      try { if (root && root.VNUx && root.VNUx.setPref) root.VNUx.setPref('voiceVol', vv); } catch (e) {}
      try { if (root && root.VoiceEngine && root.VoiceEngine.setVolume) root.VoiceEngine.setVolume(vv); } catch (e) {}
    } else if (kind === 'voiceEnabled') {
      var von = !!val;
      try { if (root && typeof root.setSetting === 'function') root.setSetting('voiceEnabled', von); } catch (e) {}
      try { if (root && root.VNUx && root.VNUx.setPref) root.VNUx.setPref('voiceEnabled', von); } catch (e) {}
      try { if (root && root.VoiceEngine && root.VoiceEngine.setEnabled) root.VoiceEngine.setEnabled(von); } catch (e) {}
      playSfxSafe('glass_tap');
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
    } else if (kind === 'combatRingAssist') {
      var assistMode = normalizeRingAssist(val);
      if (root && root.VNUx && typeof root.VNUx.setPref === 'function') {
        try { root.VNUx.setPref('combatRingAssist', assistMode); } catch (e) {}
      } else {
        try { localStorage.setItem(COMBAT_RING_ASSIST_KEY, assistMode); } catch (e) {}
        var ctrA = getCombatTimingRingApi();
        var handledA = false;
        if (ctrA) {
          try {
            if (typeof ctrA.setAssistMode === 'function') { ctrA.setAssistMode(assistMode); handledA = true; }
            else if (typeof ctrA.setRingAssistMode === 'function') { ctrA.setRingAssistMode(assistMode); handledA = true; }
            else if (typeof ctrA.setMode === 'function') { ctrA.setMode(assistMode); handledA = true; }
          } catch (e) {}
        }
        if (!handledA) {
          var liveA = readLiveSettings();
          dispatchFallbackCombatPrefsEvent(assistMode, liveA.combatCasualMode, liveA.combatAutoEndTurn);
        }
      }
      playSfxSafe('glass_tap');
    } else if (kind === 'combatCasualMode') {
      var casualOn = normalizeCasualMode(val);
      if (root && root.VNUx && typeof root.VNUx.setPref === 'function') {
        try { root.VNUx.setPref('combatCasualMode', casualOn); } catch (e) {}
      } else {
        try { localStorage.setItem(COMBAT_CASUAL_MODE_KEY, casualOn ? 'true' : 'false'); } catch (e) {}
        var ctrC = getCombatTimingRingApi();
        var handledC = false;
        if (ctrC) {
          try {
            if (typeof ctrC.setCasualMode === 'function') { ctrC.setCasualMode(casualOn); handledC = true; }
            else if (typeof ctrC.setCombatCasualMode === 'function') { ctrC.setCombatCasualMode(casualOn); handledC = true; }
          } catch (e) {}
        }
        if (!handledC) {
          var liveC = readLiveSettings();
          dispatchFallbackCombatPrefsEvent(liveC.combatRingAssist, casualOn, liveC.combatAutoEndTurn);
        }
      }
      playSfxSafe('glass_tap');
    } else if (kind === 'combatAutoEndTurn') {
      writeAutoEndTurnSetting(val);
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
    playSfxSafe('glass_tap');
    if (st.auditionTrackKey === trackKey) {
      st.auditionTrackKey = null;
      st.auditionTrackTitle = '';
      st.titleBgmPausedByUser = true;
      try { if (root && typeof root.bgmSetTitleUserPaused === 'function') root.bgmSetTitleUserPaused(true); } catch (e) {}
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
    st.titleBgmPausedByUser = false;
    try {
      if (root && typeof root.bgmSetTitleUserPaused === 'function') root.bgmSetTitleUserPaused(false);
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

    var voiceIn = panel.querySelector('#v3-set-voice');
    var voiceVal = panel.querySelector('#v3-set-voice-val');
    if (voiceIn) {
      voiceIn.addEventListener('input', function () {
        var pct = clamp(Number(voiceIn.value) || 0, 0, 100);
        updateSliderVisual(voiceIn, voiceVal, pct, 0, 100);
        applySettingValue('voiceVol', pct / 100);
      });
    }

    var voiceToggleBtn = panel.querySelector('#v3-set-voice-toggle');
    if (voiceToggleBtn) {
      voiceToggleBtn.addEventListener('click', function () {
        var s = readLiveSettings();
        applySettingValue('voiceEnabled', !s.voiceEnabled);
        syncSettingsDOM();
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

    var stepRingAssist = function (delta) {
      var s = readLiveSettings();
      var idx = 0;
      for (var k = 0; k < RING_ASSIST_OPTS.length; k++) {
        if (RING_ASSIST_OPTS[k].value === s.combatRingAssist) { idx = k; break; }
      }
      idx = (idx + delta + RING_ASSIST_OPTS.length) % RING_ASSIST_OPTS.length;
      applySettingValue('combatRingAssist', RING_ASSIST_OPTS[idx].value);
      syncSettingsDOM();
    };
    var raPrev = panel.querySelector('#v3-ring-assist-prev');
    var raNext = panel.querySelector('#v3-ring-assist-next');
    if (raPrev) raPrev.addEventListener('click', function () { stepRingAssist(-1); });
    if (raNext) raNext.addEventListener('click', function () { stepRingAssist(1); });

    var casualToggleBtn = panel.querySelector('#v3-set-casual-toggle');
    if (casualToggleBtn) {
      casualToggleBtn.addEventListener('click', function () {
        var s = readLiveSettings();
        applySettingValue('combatCasualMode', !s.combatCasualMode);
        syncSettingsDOM();
      });
    }

    var autoEndToggleBtn = panel.querySelector('#v3-set-auto-end-toggle');
    if (autoEndToggleBtn) {
      autoEndToggleBtn.addEventListener('click', function () {
        var s = readLiveSettings();
        applySettingValue('combatAutoEndTurn', !normalizeAutoEndTurn(s.combatAutoEndTurn));
        syncSettingsDOM();
      });
    }

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
    var prevMode = st.mode;
    var mode = (nextMode === 'archive' || nextMode === 'settings') ? nextMode : 'main';
    st.mode = mode;
    titleEl.setAttribute('data-title-mode', mode);
    var stageEl = document.getElementById('v3-title-stage');
    if (stageEl) stageEl.setAttribute('data-title-mode', mode);

    var anchor = document.getElementById('v3-crystal-anchor');
    if (anchor) anchor.setAttribute('aria-hidden', mode === 'archive' ? 'false' : 'true');
    syncCrystalFocusability(mode);

    var mainView = titleEl.querySelector('.v3-view-main');
    var arcView = document.getElementById('v3-view-archive');
    var setView = document.getElementById('v3-view-settings');
    if (mainView) mainView.classList.toggle('hidden', mode !== 'main');
    if (arcView) arcView.classList.toggle('hidden', mode !== 'archive');
    if (setView) setView.classList.toggle('hidden', mode !== 'settings');

    updateFooterHintsForMode(mode);

    if (prevMode === 'settings' && mode !== 'settings') {
      var curBgmKey = (root && typeof root.bgmGetState === 'function' && root.bgmGetState()) ? root.bgmGetState().key : null;
      var titleKey = (root && root.TITLE_BGM_KEY) || 'title_overture';
      var needsTitleRestore = !!st.auditionTrackKey || (curBgmKey && curBgmKey !== titleKey);
      if (needsTitleRestore) {
        st.auditionTrackKey = null;
        st.auditionTrackTitle = '';
        renderSoundtrackRows();
        if (isTitleVis() && !st.titleBgmPausedByUser && !(root && typeof root.isMuted === 'function' && root.isMuted())) {
          try {
            if (root && typeof root.bgmPlayTitle === 'function') root.bgmPlayTitle({ fade: true });
          } catch (e) {}
        }
        syncTitleAudioButton(false);
      }
    }

    if (mode === 'archive') {
      stopFusionLoop();
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
      startFusionLoop();
      if (!opts || !opts.silent) playSfxSafe('page_open');
    } else {
      clearPendingDelete();
      layoutShardsForCluster();
      syncArchiveMeta();
      startFusionLoop();
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

  function resolveTrackLabelFromState() {
    if (st.auditionTrackTitle) return st.auditionTrackTitle;
    try {
      if (root && typeof root.bgmGetState === 'function') {
        var bs = root.bgmGetState();
        if (bs && bs.key) {
          if (root.TITLE_BGM_KEY && bs.key === root.TITLE_BGM_KEY) {
            return root.TITLE_BGM_TITLE || '雪晶序曲';
          }
          for (var k = 0; k < SOUNDTRACK_CATALOG.length; k++) {
            if (SOUNDTRACK_CATALOG[k].key === bs.key) return SOUNDTRACK_CATALOG[k].title;
          }
        }
      }
    } catch (e) {}
    return (root && root.TITLE_BGM_TITLE) || '雪晶序曲';
  }

  function syncTitleAudioButton(preferDom) {
    if (!hasDom()) return false;
    var btn = document.getElementById('btn-title-mute');
    if (!btn) return false;
    var isM = resolveMuteState(btn, preferDom);
    var isPlaying = false;
    try {
      if (!isM && root && typeof root.bgmIsActuallyPlaying === 'function') {
        isPlaying = !!root.bgmIsActuallyPlaying();
      }
    } catch (e) {}
    var isPaused = !isM && !isPlaying;
    var wantPressed = isM ? 'true' : 'false';
    var trackLabel = resolveTrackLabelFromState();
    var wantText = isM ? 'BGM // 已静音' : ('BGM // ' + trackLabel);
    var wantTitle = isM
      ? '当前已静音（点击开启标题配乐）'
      : (isPlaying
        ? ('正在播放：' + trackLabel + '（点击静音）')
        : ('等待交互起播：' + trackLabel + '（点击立即播放）'));

    if (btn.classList.contains('is-muted') !== isM) {
      btn.classList.toggle('is-muted', isM);
    }
    if (btn.classList.contains('is-playing') !== isPlaying) {
      btn.classList.toggle('is-playing', isPlaying);
    }
    if (btn.classList.contains('is-paused') !== isPaused) {
      btn.classList.toggle('is-paused', isPaused);
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

    var eqBars = btn.querySelectorAll('.v3-bgm-eq i');
    for (var bIdx = 0; bIdx < eqBars.length; bIdx++) {
      var bar = eqBars[bIdx];
      if (!bar || !bar.style) continue;
      if (isPlaying) {
        bar.style.animationPlayState = 'running';
        bar.style.opacity = '';
        bar.style.transform = '';
      } else if (!isM) {
        bar.style.animationPlayState = 'paused';
        bar.style.opacity = '0.52';
        bar.style.transform = 'scaleY(0.35)';
      } else {
        bar.style.animationPlayState = '';
        bar.style.opacity = '';
        bar.style.transform = '';
      }
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
      if (isTitleVis()) startFusionLoop();
      else stopFusionLoop();
      return api;
    }

    st.opening = 'playing';
    titleEl.removeAttribute('data-opening');
    void titleEl.offsetWidth;
    titleEl.setAttribute('data-opening', 'playing');
    startDustLoop();
    startFusionLoop();

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

      st.wasTitleVis = isTitleVis();
      st.titleObs = new MutationObserver(function () {
        var nowVis = isTitleVis();
        if (nowVis === st.wasTitleVis) return;
        st.wasTitleVis = nowVis;
        if (!nowVis) {
          clearTimers();
          resetParallax(true);
          stopDustLoop();
          stopFusionLoop();
          if (st.auditionTrackKey) {
            st.auditionTrackKey = null;
            st.auditionTrackTitle = '';
            renderSoundtrackRows();
          }
          if (st.opening === 'playing') {
            st.opening = 'ready';
            titleEl.setAttribute('data-opening', 'ready');
          }
          if (st.mode !== 'main') {
            setMode('main', { silent: true });
          }
        } else {
          st.auditionTrackKey = null;
          st.auditionTrackTitle = '';
          st.titleBgmPausedByUser = false;
          indexMenuItems();
          syncArchiveMeta();
          syncTitleAudioButton(false);
          startDustLoop();
          startFusionLoop();
        }
      });
      st.titleObs.observe(titleEl, { attributes: true, attributeFilter: ['class', 'style'] });

      var btnCont = document.getElementById('btn-continue');
      if (btnCont) {
        st.continueObs = new MutationObserver(syncArchiveMeta);
        st.continueObs.observe(btnCont, { attributes: true, attributeFilter: ['class', 'style'] });
      }

      var muteBtn = document.getElementById('btn-title-mute');
      if (muteBtn) {
        st.muteObs = new MutationObserver(function () {
          if (st._syncingAudioBtn) return;
          st._syncingAudioBtn = true;
          try { syncTitleAudioButton(false); } finally { st._syncingAudioBtn = false; }
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
        if (btn && menuElForFocus.contains(btn)) {
          setFocusedMenuItem(btn);
          if (st.fusion) st.fusion.pulseSoft();
        }
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

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      var onCombatPrefsChange = function (ev) {
        syncSettingsDOM(ev && ev.detail);
      };
      window.addEventListener('combat:prefschange', onCombatPrefsChange);
      st.cleanups.push(function () { window.removeEventListener('combat:prefschange', onCombatPrefsChange); });
    }

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
        clearTimers(); resetParallax(true); stopDustLoop(); stopFusionLoop();
        if (st.fusion && isTitleVis() && st.mode !== 'archive') st.fusion.renderOnce();
        st.opening = 'ready';
        var el = getTitle(); if (el) el.setAttribute('data-opening', 'ready');
      } else {
        startDustLoop();
        startFusionLoop();
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
      if (document.hidden) { stopRaf(); stopDustLoop(); stopFusionLoop(); }
      else if (isTitleVis()) { startDustLoop(); startFusionLoop(); }
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
    destroyFusionCrystal();
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

  function getFusionState() {
    return st.fusion ? st.fusion.getState() : null;
  }

  var api = {
    init: init,
    replay: replay,
    openArchiveMode: openArchiveMode,
    openSettingsMode: openSettingsMode,
    returnToMain: returnToMain,
    syncAudioButton: syncTitleAudioButton,
    syncSettingsDOM: syncSettingsDOM,
    syncArchiveMeta: syncArchiveMeta,
    getMode: getMode,
    indexMenuItems: indexMenuItems,
    getParallax: getParallax,
    playCardExitVeil: playCardExitVeil,
    syncCardBackdrop: ensureCardBackdrop,
    getFusionState: getFusionState,
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
