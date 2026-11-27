/* =========================================================================
   《转生千金》Option 2 · P5 式角色锚定棱晶放射指令翼适配器 (js/combat-prism-ui.js)
   职责：
     - 挂载于 #battle-screen .cb-arena-field，在桌面端（>=1024px）动态锚定于「当前操作角色」身旁，
       将战斗指令转化为 Persona 5 式角色跟手多面体蓝宝棱晶放射四行主翼：
         [W] 施放技能  → 展开实时同步自 #b-actions 的全部攻守术式（攻伐在先、守御身法紧随，[1..9] 直施）
         [E] 魔力增幅  → 1:1 外露直按三阶魔力增幅（左键/E 原地升档 0%→20%→40%→60%→0%，
                         右键/Shift+E 原地降档 60%→40%→20%→0%，滚轮微调；技能列表顶脊 #cb-pw-amp-mini 同款直按不跳离）
         [A] 使用道具  → 展开战斗行囊道具叶（预留 battleState.battleItems / registerItemProvider 接入）
         [D] 结束回合  → 直接结束本回合（与顶栏 [X] 同步，AP 耗尽时流光提示）
         [L] 战报手札  → 棱晶模式底部单行实况战报条 + 可展开历史记录
     - 适配 6+6 站位与多友军编队，严格测量当前操作角色静止立绘容器并避让顶栏与底角队卡
     - 适配 V3.2 命中前缩圈与休闲模式：缩圈期间完全让出键盘并无阻塞暂隐棱晶翼，护手关闭时清爽隐藏拍数微标
     - 由 combat:statechange / combat:prefschange 事件驱动同步 + 签名差分复绘，彻底根除悬停与 60fps 像素帧触发的 DOM 销毁抖动
     - 零破坏既有 DOM ID 与自动化测试（JSDOM 环境下静默旁路）
   ========================================================================= */
(function (global) {
  'use strict';

  const DESKTOP_MIN_W = 1024;
  const MAX_AMP_PCT = 0.60;
  const MAX_AMP_INT = 60;
  const V32_AMP_TIERS = Object.freeze([
    Object.freeze({
      idx: 0,
      key: '1',
      pct: 0,
      tier: 0,
      mult: 1.00,
      penPct: 0,
      lockBonus: 0,
      shieldMult: 1.00,
      steelFrostBarrier: false,
      name: '常规 · 0%',
      title: '常规 · 0%',
      short: '常规',
      multLabel: '1.00×',
      effect: '常规施法 · 1.00×',
    }),
    Object.freeze({
      idx: 1,
      key: '2',
      pct: 0.20,
      tier: 1,
      mult: 1.20,
      penPct: 0.10,
      lockBonus: 1,
      shieldMult: 1.25,
      steelFrostBarrier: false,
      name: '★一阶 · 魔力盈溢 20%',
      title: '★一阶 · 魔力盈溢 20%',
      short: '★20% 盈溢',
      multLabel: '1.20×',
      effect: '+1破锁 · 10%穿抗 · 护盾1.25×',
    }),
    Object.freeze({
      idx: 2,
      key: '3',
      pct: 0.40,
      tier: 2,
      mult: 1.40,
      penPct: 0.22,
      lockBonus: 2,
      shieldMult: 1.50,
      steelFrostBarrier: true,
      name: '★★二阶 · 极寒过载 40%',
      title: '★★二阶 · 极寒过载 40%',
      short: '★★40% 过载',
      multLabel: '1.40×',
      effect: '+2破锁 · 22%穿抗 · 护盾1.50× · 钢霜壁垒',
    }),
    Object.freeze({
      idx: 3,
      key: '4',
      pct: 0.60,
      tier: 3,
      mult: 1.60,
      penPct: 0.35,
      lockBonus: 3,
      shieldMult: 1.50,
      steelFrostBarrier: false,
      name: '★★★三阶 · 星霜极限 60%',
      title: '★★★三阶 · 星霜极限 60%',
      short: '★★★60% 星霜极限',
      multLabel: '1.60×',
      effect: '+3破锁 · 35%穿抗 · 三阶输出上限',
    }),
  ]);
  const HIGHER_OVERLAY_IDS = [
    'cg-lightbox', 'sys-popup', 'arena-loadout-modal', 'vn-prefs-modal',
    'vn-backlog-modal', 'vn-saveload-modal', 'vn-chapters-modal',
    'ice-deduction-modal', 'rumor-overlay', 'panel', 'codex',
    'stats-overlay', 'ai-drawer', 'help-screen', 'map-overlay', 'backlog-overlay',
  ];
  const PRISM_COMBAT_HOTKEYS = new Set([
    'w', 'e', 'a', 'd', 'x', 'l', 'r', 'f', 'escape',
    '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ]);
  const itemProviders = [];

  function isJsdomEnv() {
    try {
      const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
      return /jsdom/i.test(ua);
    } catch (e) {
      return false;
    }
  }

  function safeSfx(cue, opts) {
    try {
      if (global.CrystalSFX && typeof global.CrystalSFX.play === 'function') {
        global.CrystalSFX.play(cue, opts);
      }
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  }

  function hasBlockingOverlay() {
    if (typeof document === 'undefined') return false;
    for (let i = 0; i < HIGHER_OVERLAY_IDS.length; i++) {
      if (isVisible(document.getElementById(HIGHER_OVERLAY_IDS[i]))) return true;
    }
    return false;
  }

  const uiState = {
    enabled: true,
    mounted: false,
    syncing: false,
    compactMulti: false,
    narrowDesktop: false,
    shortViewport: false,
    viewportW: 1440,
    viewportH: 900,
    menuMode: 'root', // 'root' | 'skills' | 'items'
    collapsed: false,
    logExpanded: false,
    hoveredWingIdx: null,
    hoveredBladeIdx: null,
    hoveredSkillId: null,
    lastHoveredSkillId: null,
    hoveringAmpMini: false,
    hoverLeaveTimer: 0,
    lastSkillCastAt: 0,
    castFlashTimer: 0,
    ampPulseTimer: 0,
    lastAmpPct: -1,
    lastAmpWheelAt: 0,
    bsObserver: null,
    modalObserver: null,
    fieldObserver: null,
    fieldObservedEl: null,
    rafId: 0,
    dissolveTimer: 0,
    timingRestoreTimer: 0,
    rigEl: null,
    svgEl: null,
    hubToggleEl: null,
    cascadeListEl: null,
    ampPanelEl: null,
    spineEl: null,
    logBarEl: null,
    avRailEl: null,
    avListEl: null,
    avForecastEl: null,
    currentItems: [],
    lastBattleWaveKey: '',
    lastBattleTurn: -1,
    lastBattleState: null,
    lastBladeSig: '',
    lastAvSig: '',
    activeActorOverride: null,
    lastActiveActorKey: 'player',
    anchorFlipLeft: false,
    guardSplitIdx: -1,
    lastAnchorX: 280,
    lastAnchorY: 280,
    lastFieldW: 1280,
    lastFieldH: 560,
    skyTopY: 0,
    skyBotY: 540,
    portraitRight: 210,
    allyPaneRight: 0,
    enemyLeftX: 0,
    hasMidCorridor: false,
    corridorLeft: 0,
    corridorRight: 0,
    corridorW: 0,
    hasVanguardActor: false,
    partyLayout: '',
    partyDockTop: 0,
    targetPaneLeft: 0,
    targetPaneTop: 0,
    obstacles: [],
    twoColBlades: false,
    animDissolveUntil: 0,
  };

  function getBattleScreen() {
    return typeof document !== 'undefined' ? document.getElementById('battle-screen') : null;
  }

  function getSkillSourceContainer() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('cb-skills') || document.getElementById('b-actions');
  }

  function isDesktopViewport() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= DESKTOP_MIN_W;
  }

  function isActive() {
    const bs = getBattleScreen();
    return !!(
      uiState.enabled &&
      !isJsdomEnv() &&
      isDesktopViewport() &&
      bs &&
      isVisible(bs) &&
      bs.classList.contains('prism-radial-active')
    );
  }

  function getEngineBattle() {
    try {
      if (global.CombatEngine && typeof global.CombatEngine.getBattleState === 'function') {
        return global.CombatEngine.getBattleState();
      }
    } catch (e) {}
    return null;
  }

  function getRawEngineBattle() {
    try {
      if (global.CombatEngine && typeof global.CombatEngine.getState === 'function') {
        return global.CombatEngine.getState();
      }
    } catch (e) {}
    return null;
  }

  function getTimingRingApi() {
    return (typeof window !== 'undefined' && window.CombatTimingRing)
      || global.CombatTimingRing
      || null;
  }

  function isTimingRingActive() {
    const api = getTimingRingApi();
    try {
      return !!(api && typeof api.isActive === 'function' && api.isActive());
    } catch (e) {
      return false;
    }
  }

  function isAsyncPhaseActive(battleOverride) {
    const b = battleOverride || getEngineBattle();
    if (b && b._asyncPhaseActive) return true;
    const raw = getRawEngineBattle();
    return !!(raw && raw._asyncPhaseActive);
  }

  function isTimingOrAsyncDissolved(battleOverride) {
    return isTimingRingActive() || isAsyncPhaseActive(battleOverride);
  }

  function isGauntletOffMode() {
    const api = getTimingRingApi();
    if (api) {
      try {
        if (typeof api.getAssistMode === 'function') {
          const m = String(api.getAssistMode() || '').toLowerCase();
          if (m) return m === 'off' || m === 'auto' || m === 'none';
        }
        if (typeof api.getGauntletMode === 'function') {
          const m = String(api.getGauntletMode() || '').toLowerCase();
          if (m) return m === 'off' || m === 'auto' || m === 'none';
        }
        if (typeof api.getMode === 'function') {
          const m = String(api.getMode() || '').toLowerCase();
          if (m) return m === 'off' || m === 'auto' || m === 'none';
        }
        if (typeof api.isGauntletOff === 'function') {
          return !!api.isGauntletOff();
        }
      } catch (e) {}
    }
    const b = uiState.lastBattleState || getEngineBattle();
    if (b && (b.assistMode != null || b.gauntletMode != null)) {
      const m = String(b.assistMode != null ? b.assistMode : b.gauntletMode).toLowerCase();
      return m === 'off' || m === 'auto' || m === 'none';
    }
    return false;
  }

  function isCasualModeActive() {
    const api = getTimingRingApi();
    try {
      return !!(api && typeof api.isCasualMode === 'function' && api.isCasualMode() === true);
    } catch (e) {
      return false;
    }
  }

  function stopTimingRestoreWatch() {
    if (uiState.timingRestoreTimer) {
      clearInterval(uiState.timingRestoreTimer);
      uiState.timingRestoreTimer = 0;
    }
  }

  function startTimingRestoreWatch() {
    if (uiState.timingRestoreTimer) return;
    uiState.timingRestoreTimer = setInterval(() => {
      if (!uiState.mounted || !isTimingOrAsyncDissolved()) {
        stopTimingRestoreWatch();
        if (uiState.mounted) sync();
      }
    }, 60);
  }

  function isEnemyTurnState(state) {
    if (!state) return false;
    if (state.isEnemyTurn || state.enemyTurn) return true;
    if (state.turnPhase && state.turnPhase !== 'player') return true;
    if (state.turnOwner && state.turnOwner !== 'player') return true;
    return false;
  }

  function shouldHardDissolve(battleOverride) {
    const bs = getBattleScreen();
    if (!bs || !isVisible(bs)) return true;
    if (document.getElementById('cb-result-modal')) return true;
    if (hasBlockingOverlay()) return true;
    const b = battleOverride || getEngineBattle();
    if (b && (b.over || isEnemyTurnState(b))) return true;
    return false;
  }

  function isBriefDissolving() {
    return Date.now() < uiState.animDissolveUntil;
  }

  function shouldDissolve(battleOverride) {
    return shouldHardDissolve(battleOverride) || isTimingOrAsyncDissolved(battleOverride) || isBriefDissolving();
  }

  function cancelDissolve() {
    if (uiState.dissolveTimer) {
      clearTimeout(uiState.dissolveTimer);
      uiState.dissolveTimer = 0;
    }
    const wasDissolving = uiState.animDissolveUntil > 0;
    uiState.animDissolveUntil = 0;
    if (uiState.rigEl && !shouldHardDissolve() && !isTimingOrAsyncDissolved()) {
      uiState.rigEl.classList.remove('dissolved', 'is-timing-dissolved');
    }
    return wasDissolving;
  }

  function startBriefDissolve() {
    if (uiState.dissolveTimer) {
      clearTimeout(uiState.dissolveTimer);
      uiState.dissolveTimer = 0;
    }
    uiState.animDissolveUntil = Date.now() + 90;
    uiState.dissolveTimer = setTimeout(() => {
      uiState.dissolveTimer = 0;
      uiState.animDissolveUntil = 0;
      sync();
    }, 95);
  }

  function readRemainingAp(state) {
    if (!state) return 0;
    if (typeof state.ap === 'number' && isFinite(state.ap)) return state.ap;
    if (state.player && typeof state.player.ap === 'number' && isFinite(state.player.ap)) return state.player.ap;
    return 0;
  }

  function isPlayerTurnActive(state) {
    if (!state || state.over) return false;
    if (isEnemyTurnState(state)) return false;
    if (typeof document !== 'undefined') {
      const endBtn = document.getElementById('cb-btn-endturn');
      if (endBtn && endBtn.disabled) return false;
    }
    return true;
  }

  function triggerEndTurnAction() {
    cancelDissolve();
    const realEnd = document.getElementById('cb-btn-endturn');
    if (!realEnd || realEnd.disabled) return false;
    uiState.collapsed = false;
    uiState.menuMode = 'root';
    uiState.hoveredBladeIdx = null;
    uiState.hoveringAmpMini = false;
    uiState.lastBladeSig = '';
    uiState.lastSkillCastAt = 0;
    clearRealHover({ resetLast: true });
    realEnd.click();
    const nextState = getEngineBattle();
    if (!shouldHardDissolve(nextState)) {
      startBriefDissolve();
    }
    sync(nextState);
    return true;
  }

  function triggerCastFlash() {
    if (!uiState.cascadeListEl || !uiState.cascadeListEl.isConnected) return;
    if (uiState.castFlashTimer) {
      clearTimeout(uiState.castFlashTimer);
      uiState.castFlashTimer = 0;
    }
    const target = uiState.cascadeListEl;
    target.classList.remove('is-cast-flash');
    void target.offsetWidth;
    target.classList.add('is-cast-flash');
    uiState.castFlashTimer = setTimeout(() => {
      uiState.castFlashTimer = 0;
      if (target && target.isConnected) target.classList.remove('is-cast-flash');
    }, 180);
  }

  function formatBeatSpecBadge(rawSpec, skillObj) {
    if (rawSpec == null || rawSpec === '') return { label: '', kind: '' };

    if (typeof rawSpec === 'string') {
      const trimmed = rawSpec.trim();
      if (!trimmed) return { label: '', kind: '' };
      if (trimmed.charAt(0) === '{') {
        try {
          return formatBeatSpecBadge(JSON.parse(trimmed), skillObj);
        } catch (e) {}
      }
      const low = trimmed.toLowerCase();
      if (low === 'off' || low === 'auto') return { label: '', kind: '' };
      if (low === '0' || low === 'instant' || low === 'none' || trimmed === '瞬发') {
        return { label: '瞬发', kind: 'instant' };
      }
      if (
        low === 'aoe' || low === 'all' || low === 'all_enemies' || low === 'all-enemies' ||
        low === 'dynamic_targets' || low === 'per_enemy' || low === 'dynamic' ||
        trimmed === '全敌' || trimmed === '全敌拍'
      ) {
        return { label: '全敌拍', kind: 'aoe' };
      }
      if (low === '1' || low === 'single' || trimmed === '1拍') {
        return { label: '1拍', kind: 'b1' };
      }
      if (low === '2' || low === 'double' || low === 'combo_distinct' || trimmed === '2拍') {
        return { label: '2拍', kind: 'b2' };
      }
      if (low === '3' || low === 'triple' || low === 'triple_same' || low === 'combo' || trimmed === '3拍' || trimmed === '3拍连击') {
        return { label: '3拍连击', kind: 'b3' };
      }
      if (/^\d+$/.test(low)) {
        const n = Number(low);
        if (n <= 0) return { label: '瞬发', kind: 'instant' };
        if (n === 1) return { label: '1拍', kind: 'b1' };
        if (n === 2) return { label: '2拍', kind: 'b2' };
        return { label: `${n}拍连击`, kind: 'b3' };
      }
      if (trimmed.length <= 6) return { label: trimmed, kind: 'b1' };
      return { label: '', kind: '' };
    }

    if (typeof rawSpec === 'number' && isFinite(rawSpec)) {
      const n = Math.round(rawSpec);
      if (n <= 0) return { label: '瞬发', kind: 'instant' };
      if (n === 1) return { label: '1拍', kind: 'b1' };
      if (n === 2) return { label: '2拍', kind: 'b2' };
      return { label: `${n}拍连击`, kind: 'b3' };
    }

    if (typeof rawSpec === 'object') {
      if (rawSpec.disabled || rawSpec.off || rawSpec.auto) return { label: '', kind: '' };
      const modeStr = String(rawSpec.mode || rawSpec.type || rawSpec.kind || rawSpec.pattern || '').toLowerCase();
      const explicit = typeof rawSpec.badge === 'string' && rawSpec.badge.trim()
        ? rawSpec.badge.trim()
        : (typeof rawSpec.shortLabel === 'string' && rawSpec.shortLabel.trim()
          ? rawSpec.shortLabel.trim()
          : (typeof rawSpec.label === 'string' && rawSpec.label.trim().length > 0 && rawSpec.label.trim().length <= 5
            ? rawSpec.label.trim()
            : ''));

      let n = null;
      if (Array.isArray(rawSpec.beats)) n = rawSpec.beats.length;
      else if (typeof rawSpec.beats === 'number' && isFinite(rawSpec.beats)) n = Math.round(rawSpec.beats);
      else if (typeof rawSpec.count === 'number' && isFinite(rawSpec.count)) n = Math.round(rawSpec.count);
      else if (typeof rawSpec.beatCount === 'number' && isFinite(rawSpec.beatCount)) n = Math.round(rawSpec.beatCount);
      else if (Array.isArray(rawSpec.keys)) n = rawSpec.keys.length;

      const isDynamicAoe = !!(
        rawSpec.dynamic === true ||
        rawSpec.aoe === true ||
        rawSpec.allEnemies === true ||
        rawSpec.perEnemy === true ||
        rawSpec.scope === 'all' ||
        modeStr === 'dynamic_targets' ||
        modeStr === 'aoe' ||
        modeStr === 'all_enemies' ||
        modeStr === 'per_enemy' ||
        modeStr.indexOf('全敌') >= 0
      );
      if (isDynamicAoe) {
        return { label: explicit || '全敌拍', kind: 'aoe' };
      }

      const isInstant = !!(rawSpec.instant === true || modeStr === 'instant' || modeStr === 'none' || n === 0);
      if (isInstant) {
        return { label: explicit || '瞬发', kind: 'instant' };
      }

      if (modeStr === 'triple_same' || (typeof n === 'number' && n >= 3)) {
        const cnt = typeof n === 'number' && n >= 3 ? n : 3;
        return { label: explicit || `${cnt}拍连击`, kind: 'b3' };
      }
      if (modeStr === 'combo_distinct' || n === 2) {
        return { label: explicit || '2拍', kind: 'b2' };
      }
      if (modeStr === 'single' || n === 1) {
        if (skillObj && skillObj.aoe && !explicit) return { label: '全敌拍', kind: 'aoe' };
        return { label: explicit || '1拍', kind: 'b1' };
      }
      if (explicit) return { label: explicit, kind: 'b1' };
    }

    return { label: '', kind: '' };
  }

  function resolveSkillBeatInfo(skillId, skillObj, btn, battleState) {
    if (isGauntletOffMode()) return { label: '', kind: '' };

    let attrBeats = '';
    if (btn) {
      const directAttr = btn.getAttribute('data-beats');
      if (directAttr != null && directAttr !== '') {
        attrBeats = directAttr;
      } else {
        const subBeat = btn.querySelector('[data-beats]');
        if (subBeat) attrBeats = subBeat.getAttribute('data-beats') || '';
      }
    }

    let apiSpec = null;
    const api = getTimingRingApi();
    if (api && typeof api.getBeatSpec === 'function' && skillId) {
      try {
        apiSpec = api.getBeatSpec(skillId, battleState || undefined);
      } catch (e) {
        apiSpec = null;
      }
    }

    if (apiSpec && (apiSpec.dynamic || apiSpec.mode === 'dynamic_targets' || (typeof apiSpec.beats === 'number' && apiSpec.beats > 0))) {
      return formatBeatSpecBadge(apiSpec, skillObj);
    }
    if (attrBeats) {
      return formatBeatSpecBadge(attrBeats, skillObj);
    }
    if (skillObj && skillObj.beatSpec != null) {
      return formatBeatSpecBadge(skillObj.beatSpec, skillObj);
    }
    if (apiSpec) {
      return formatBeatSpecBadge(apiSpec, skillObj);
    }
    return { label: '', kind: '' };
  }

  function readSkillCards(battleOverride) {
    const box = getSkillSourceContainer();
    if (!box) return [];
    const b = battleOverride || uiState.lastBattleState || getEngineBattle();
    const stateSkills = (b && b.player && Array.isArray(b.player.skills)) ? b.player.skills : [];
    const engineSkills = (global.CombatEngine && global.CombatEngine.SKILLS) ? global.CombatEngine.SKILLS : null;
    const btns = Array.from(box.querySelectorAll('.cb-skill-card'));
    return btns.map((btn, idx) => {
      const sid = btn.getAttribute('data-sk') || '';
      const skObj = stateSkills.find(s => s && s.id === sid) || (engineSkills && engineSkills[sid]) || null;
      const beatInfo = resolveSkillBeatInfo(sid, skObj, btn, b);
      const nameEl = btn.querySelector('.csc-name');
      const pathEl = btn.querySelector('.csc-path');
      const costEl = btn.querySelector('.csc-cost');
      const descEl = btn.querySelector('.csc-desc');
      const footEl = btn.querySelector('.csc-foot > span');
      const oppEl = btn.querySelector('.cb-opp-pill');
      const expWarnEl = btn.querySelector('.csc-exp-warn');
      const expSafeEl = btn.querySelector('.csc-exp-safe');
      const expWarnText = expWarnEl ? expWarnEl.textContent.trim() : '';
      const expSafeText = expSafeEl ? expSafeEl.textContent.trim() : '';
      const expText = expWarnText || expSafeText;
      const expKind = expWarnText ? 'warn' : (expSafeText ? 'safe' : '');
      const pathText = pathEl ? pathEl.textContent.replace(/^\d+\s*/, '').trim() : '';
      const isPureGuard = skObj
        ? !!(skObj.shieldBase || skObj.afterimage || (btn.classList.contains('is-guard') && !(skObj.power > 0)))
        : btn.classList.contains('is-guard');
      return {
        kind: 'skill',
        slotIdx: idx,
        key: idx < 9 ? String(idx + 1) : '·',
        skillId: sid,
        name: nameEl ? nameEl.textContent.trim() : sid,
        pathLabel: pathText,
        beatLabel: beatInfo.label,
        beatKind: beatInfo.kind,
        cost: costEl ? costEl.textContent.trim() : '',
        desc: descEl ? descEl.textContent.trim() : '',
        foot: footEl ? footEl.textContent.trim() : '',
        oppLabel: oppEl ? oppEl.textContent.trim() : '',
        expText,
        expKind,
        isGuard: isPureGuard,
        disabled: !!btn.disabled,
        sourceBtn: btn,
      };
    });
  }

  function computeV32FallbackMult(pct) {
    const dm = Math.max(0, Math.min(MAX_AMP_PCT, Number(pct) || 0));
    return Number((1.0 + dm).toFixed(4));
  }

  function formatAmpBadge(overcastPct, tier) {
    const pctInt = Math.round((Number(overcastPct) || 0) * 100);
    if (pctInt <= 0) return '常规';
    if (tier >= 3 || pctInt >= 60) return `★★★${pctInt}% 星霜极限`;
    if (tier >= 2 || pctInt >= 40) return `★★${pctInt}% 过载`;
    if (tier >= 1 || pctInt >= 20) return `★${pctInt}% 盈溢`;
    return `+${pctInt}%`;
  }

  function formatAmpShort(overcastPct, tier) {
    const pctInt = Math.round((Number(overcastPct) || 0) * 100);
    if (pctInt <= 0) return '常规';
    if (tier >= 3 || pctInt >= 60) return `★★★${pctInt}%`;
    if (tier >= 2 || pctInt >= 40) return `★★${pctInt}%`;
    if (tier >= 1 || pctInt >= 20) return `★${pctInt}%`;
    return `+${pctInt}%`;
  }

  function readOvercastInfo(battleOverride) {
    const b = battleOverride || getEngineBattle();
    const p = b && b.player ? b.player : null;

    let rawPct = 0;
    if (b && typeof b.overcastPct === 'number') rawPct = b.overcastPct;
    else if (p && typeof p.overcastPct === 'number') rawPct = p.overcastPct;
    else if (p && typeof p.ampPct === 'number') rawPct = p.ampPct;
    else if (b && typeof b.ampPct === 'number') rawPct = b.ampPct;
    else if (p && typeof p.overcastMode === 'number') {
      rawPct = p.overcastMode >= 3 ? 0.60 : p.overcastMode === 2 ? 0.40 : p.overcastMode === 1 ? 0.20 : 0;
    }

    let maxAmpCap = MAX_AMP_PCT;
    if (b && typeof b.maxAmpCap === 'number') {
      maxAmpCap = b.maxAmpCap;
    } else if (p && typeof p.maxAmpCap === 'number') {
      maxAmpCap = p.maxAmpCap;
    } else if (p && Array.isArray(p.skills) && p.skills.length) {
      let bestCap = 0;
      for (let i = 0; i < p.skills.length; i++) {
        const skCap = p.skills[i] && typeof p.skills[i].overcastCap === 'number' ? p.skills[i].overcastCap : 0;
        if (skCap > bestCap) bestCap = skCap;
      }
      maxAmpCap = bestCap;
    }
    maxAmpCap = Math.max(0, Math.min(MAX_AMP_PCT, Number(maxAmpCap) || 0));

    const overcastPct = Math.max(0, Math.min(maxAmpCap > 0 ? maxAmpCap : MAX_AMP_PCT, Number(rawPct) || 0));
    const maxMp = p ? Math.max(0, Number(p.mmp) || 0) : 0;
    const curMp = p ? Math.max(0, Number(p.mp) || 0) : 0;

    let canAmp = false;
    if (b && p && !b.over && maxMp > 0 && maxAmpCap > 0) {
      if (typeof b.canAmp === 'boolean') canAmp = b.canAmp;
      else if (typeof p.canAmp === 'boolean') canAmp = p.canAmp;
      else if (typeof p.canManaAmp === 'boolean') canAmp = p.canManaAmp;
      else canAmp = true;
    }

    const rawTier = (b && b.ampTier != null) ? b.ampTier : (p ? p.ampTier : null);
    const tier = typeof rawTier === 'number'
      ? rawTier
      : (rawTier && typeof rawTier.tier === 'number'
        ? rawTier.tier
        : (overcastPct >= 0.60 - 1e-4 ? 3 : overcastPct >= 0.40 - 1e-4 ? 2 : overcastPct >= 0.20 - 1e-4 ? 1 : 0));

    let ampTierName = '';
    if (b && typeof b.ampTierName === 'string' && b.ampTierName) ampTierName = b.ampTierName;
    else if (p && typeof p.ampTierName === 'string' && p.ampTierName) ampTierName = p.ampTierName;
    else if (rawTier && typeof rawTier.label === 'string' && rawTier.label) ampTierName = rawTier.label;
    else ampTierName = tier >= 3 ? '星霜极限' : tier >= 2 ? '极寒过载' : tier >= 1 ? '魔力盈溢' : '常规';

    let ampMult = computeV32FallbackMult(overcastPct);
    if (b && typeof b.ampMult === 'number' && isFinite(b.ampMult)) ampMult = b.ampMult;
    else if (p && typeof p.ampMult === 'number' && isFinite(p.ampMult)) ampMult = p.ampMult;

    const rawDiscount = (b && typeof b.ampDiscountFactor === 'number' && isFinite(b.ampDiscountFactor))
      ? b.ampDiscountFactor
      : (p && typeof p.ampDiscountFactor === 'number' && isFinite(p.ampDiscountFactor) ? p.ampDiscountFactor : 1);
    const ampDiscountFactor = Math.max(0, rawDiscount);
    const ampMpCostScale = (CE && CE.BALANCE && typeof CE.BALANCE.ampMpCostScale === 'number')
      ? CE.BALANCE.ampMpCostScale
      : 0.50;
    const calcFallbackExtraMp = pct => Math.max(0, Math.round(maxMp * pct * ampMpCostScale * ampDiscountFactor));

    const pctInt = Math.round(overcastPct * 100);
    const maxPctInt = Math.round(maxAmpCap * 100);
    const extraMp = (b && typeof b.ampExtraMp === 'number' && isFinite(b.ampExtraMp))
      ? Math.max(0, Math.round(b.ampExtraMp))
      : (p && typeof p.ampExtraMp === 'number' && isFinite(p.ampExtraMp))
        ? Math.max(0, Math.round(p.ampExtraMp))
        : calcFallbackExtraMp(overcastPct);

    const rawTierExtraMps = (b && Array.isArray(b.ampTierExtraMps) && b.ampTierExtraMps.length > 0)
      ? b.ampTierExtraMps
      : (p && Array.isArray(p.ampTierExtraMps) && p.ampTierExtraMps.length > 0 ? p.ampTierExtraMps : null);
    const ampTierExtraMps = V32_AMP_TIERS.map(t => (
      rawTierExtraMps && typeof rawTierExtraMps[t.tier] === 'number' && isFinite(rawTierExtraMps[t.tier])
        ? Math.max(0, Math.round(rawTierExtraMps[t.tier]))
        : calcFallbackExtraMp(t.pct)
    ));

    const lockHint = tier >= 3 ? ' · +3锁' : tier >= 2 ? ' · +2锁' : tier >= 1 ? ' · +1锁' : '';
    const multBadge = !canAmp ? 'LOCK' : `${ampMult.toFixed(2)}×`;
    const badge = !canAmp ? '不可增幅' : formatAmpBadge(overcastPct, tier);
    const shortLabel = !canAmp ? '锁定' : formatAmpShort(overcastPct, tier);
    const allowedTiers = V32_AMP_TIERS.filter(t => t.pct <= maxAmpCap + 1e-4);

    const ampTierMults = (b && Array.isArray(b.ampTierMults) && b.ampTierMults.length >= 4)
      ? b.ampTierMults
      : V32_AMP_TIERS.map(t => t.mult);

    return {
      overcastPct,
      ampPct: overcastPct,
      pctInt,
      maxAmpCap,
      maxPctInt,
      tier,
      ampTier: tier,
      ampTierName,
      ampMult,
      ampTierMults,
      ampDiscountFactor,
      ampExtraMp: extraMp,
      ampTierExtraMps,
      multVal: ampMult,
      enabled: canAmp,
      canAmp,
      hasManaCycle: !!(p && p.hasManaCycle),
      maxMp,
      curMp,
      extraMp,
      lockHint,
      multBadge,
      badge,
      shortLabel,
      allowedTiers,
    };
  }

  function registerItemProvider(fn) {
    if (typeof fn !== 'function') return false;
    if (itemProviders.indexOf(fn) === -1) {
      itemProviders.push(fn);
    }
    return function unregisterItemProvider() {
      const idx = itemProviders.indexOf(fn);
      if (idx >= 0) itemProviders.splice(idx, 1);
    };
  }

  function normalizeBattleItem(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    const count = typeof raw.count === 'number'
      ? raw.count
      : (typeof raw.qty === 'number' ? raw.qty : null);
    const disabled = !!raw.disabled || (count != null && count <= 0);
    const rawId = raw.id != null && raw.id !== '' ? String(raw.id) : `item_${idx}`;
    return {
      kind: 'item',
      slotIdx: idx,
      key: idx < 9 ? String(idx + 1) : '·',
      skillId: `item:${rawId}`,
      itemId: rawId,
      name: String(raw.name || '道具'),
      iconHtml: raw.iconHtml || '',
      pathLabel: String(raw.tag || raw.category || '道具'),
      beatLabel: '',
      beatKind: '',
      cost: raw.cost != null ? String(raw.cost) : (count != null ? `×${count}` : ''),
      desc: String(raw.desc || ''),
      foot: String(raw.foot || raw.desc || ''),
      oppLabel: String(raw.badge || ''),
      expText: '',
      expKind: '',
      isGuard: false,
      isPlaceholder: false,
      disabled,
      onUse: typeof raw.onUse === 'function' ? raw.onUse : (typeof raw.use === 'function' ? raw.use : null),
      sourceBtn: raw.sourceBtn || null,
      rawItem: raw,
    };
  }

  function readBattleItems(battleState) {
    const b = battleState || uiState.lastBattleState || getEngineBattle();
    const collected = [];
    const seenIds = new Set();

    const pushRawList = list => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        if (!entry || typeof entry !== 'object') continue;
        const idKey = entry.id != null && entry.id !== '' ? String(entry.id) : '';
        if (idKey && seenIds.has(idKey)) continue;
        if (idKey) seenIds.add(idKey);
        const normalized = normalizeBattleItem(entry, collected.length);
        if (normalized) collected.push(normalized);
      }
    };

    if (b && Array.isArray(b.battleItems)) {
      pushRawList(b.battleItems);
    }
    for (let i = 0; i < itemProviders.length; i++) {
      try {
        const supplied = itemProviders[i](b);
        pushRawList(supplied);
      } catch (e) {}
    }

    return collected;
  }

  function buildEmptyItemsPlaceholder() {
    return [{
      kind: 'placeholder',
      slotIdx: 0,
      key: '◇',
      skillId: 'item_placeholder_empty',
      itemId: '',
      name: '行囊中暂无战斗道具',
      iconHtml: '',
      pathLabel: '后续开放',
      beatLabel: '',
      beatKind: '',
      cost: '',
      desc: '药剂与战术道具将于后续章节实装 · 按 [ESC] 或右键返回',
      foot: '药剂与战术道具将于后续章节实装 · 按 [ESC] 或右键返回',
      oppLabel: '',
      expText: '',
      expKind: '',
      isGuard: false,
      isPlaceholder: true,
      disabled: true,
      sourceBtn: null,
    }];
  }

  function triggerAmpPulse() {
    if (typeof document === 'undefined') return;
    if (uiState.ampPulseTimer) {
      clearTimeout(uiState.ampPulseTimer);
      uiState.ampPulseTimer = 0;
    }
    const targets = [
      document.getElementById('cb-pw-amp'),
      document.getElementById('cb-pw-amp-mini'),
    ].filter(Boolean);
    targets.forEach(el => {
      el.classList.remove('is-amp-pulse');
      void el.offsetWidth;
      el.classList.add('is-amp-pulse');
    });
    uiState.ampPulseTimer = setTimeout(() => {
      uiState.ampPulseTimer = 0;
      targets.forEach(el => {
        if (el && el.isConnected) el.classList.remove('is-amp-pulse');
      });
    }, 360);
  }

  function cancelPendingHoverClear() {
    if (uiState.hoverLeaveTimer) {
      clearTimeout(uiState.hoverLeaveTimer);
      uiState.hoverLeaveTimer = 0;
    }
  }

  function findSkillItemAndBtn(skillId) {
    if (!skillId) return { item: null, btn: null };
    const item = uiState.currentItems.find(it => it && it.kind === 'skill' && it.skillId === skillId) || null;
    if (item) {
      return { item, btn: resolveLiveSourceBtn(item) };
    }
    if (typeof document !== 'undefined') {
      const box = getSkillSourceContainer();
      if (box) {
        const cards = box.querySelectorAll('.cb-skill-card');
        for (let i = 0; i < cards.length; i++) {
          if (cards[i].getAttribute('data-sk') === skillId) {
            return { item: null, btn: cards[i] };
          }
        }
      }
    }
    return { item: null, btn: null };
  }

  function resolveHoveredBladeSkillId() {
    if (uiState.menuMode !== 'skills') return null;
    if (uiState.cascadeListEl) {
      try {
        const hoveredBtn = uiState.cascadeListEl.querySelector('.cb-blade:hover');
        if (hoveredBtn) {
          const sid = hoveredBtn.getAttribute('data-sk') || '';
          if (sid) return sid;
        }
      } catch (e) {}
    }
    if (uiState.hoveredBladeIdx != null) {
      const it = uiState.currentItems[uiState.hoveredBladeIdx];
      if (it && it.kind === 'skill' && it.skillId) return it.skillId;
    }
    return null;
  }

  function applySkillHoverPreviewNow(skillId, battleState) {
    if (!skillId) return false;
    cancelPendingHoverClear();
    const { btn } = findSkillItemAndBtn(skillId);
    syncSkillHoverPreview(btn, true, skillId);
    syncAvForecast(skillId, battleState || uiState.lastBattleState || getEngineBattle());
    return true;
  }

  function scheduleHoverLeaveClear(expectedSkillId) {
    cancelPendingHoverClear();
    uiState.hoverLeaveTimer = setTimeout(() => {
      uiState.hoverLeaveTimer = 0;
      if (uiState.hoveringAmpMini) return;
      if (resolveHoveredBladeSkillId()) return;
      if (uiState.hoveredBladeIdx != null) return;
      if (expectedSkillId && uiState.hoveredSkillId && uiState.hoveredSkillId !== expectedSkillId) return;
      clearRealHover();
    }, 65);
  }

  function applyAmpPct(pct, opts) {
    const info = readOvercastInfo();
    if (!info.enabled) return false;
    let val = Number(pct);
    if (!isFinite(val)) val = 0;
    if (val > 1) val = val / 100;
    val = Math.max(0, Math.min(info.maxAmpCap, val));
    val = Math.round(val * 100) / 100;

    const inSkillCascade = uiState.menuMode === 'skills';
    let previewSid = resolveHoveredBladeSkillId();
    if (!previewSid && inSkillCascade && uiState.hoveredSkillId) {
      previewSid = uiState.hoveredSkillId;
    }
    if (!previewSid && inSkillCascade && (uiState.hoveringAmpMini || (opts && opts.preserveLastHover)) && uiState.lastHoveredSkillId) {
      previewSid = uiState.lastHoveredSkillId;
    }
    if (previewSid && !findSkillItemAndBtn(previewSid).btn && !uiState.currentItems.some(it => it && it.kind === 'skill' && it.skillId === previewSid)) {
      previewSid = null;
    }

    // 升/降档前先锁定引擎悬停技能，避免 renderCombatUI 重绘双血条时预扣段归零后再缓慢爬升
    if (previewSid) {
      cancelPendingHoverClear();
      syncSkillHoverPreview(findSkillItemAndBtn(previewSid).btn, true, previewSid);
    }

    const targetInt = Math.round(val * 100);
    if (global.CombatEngine && typeof global.CombatEngine.setOvercastPct === 'function') {
      global.CombatEngine.setOvercastPct(val);
    } else if (global.CombatEngine && typeof global.CombatEngine.setAmpPct === 'function') {
      global.CombatEngine.setAmpPct(val);
    } else if (global.CombatEngine && typeof global.CombatEngine.setOvercast === 'function') {
      const nextMode = val >= 0.58 ? 3 : val >= 0.38 ? 2 : val >= 0.18 ? 1 : 0;
      global.CombatEngine.setOvercast(nextMode);
    }
    if (!uiState.syncing && uiState.lastAmpPct !== targetInt) {
      sync();
    }

    if (uiState.menuMode === 'skills') {
      const liveHoverSid = resolveHoveredBladeSkillId();
      const activeSid = liveHoverSid || previewSid;
      if (activeSid) {
        if (liveHoverSid) uiState.lastHoveredSkillId = liveHoverSid;
        applySkillHoverPreviewNow(activeSid, getEngineBattle());
      }
    }
    return true;
  }

  function selectAmpTier(pct) {
    const info = readOvercastInfo();
    if (!info.enabled) return false;
    if (pct > info.maxAmpCap + 1e-4) return false;
    return applyAmpPct(pct);
  }

  function cycleAmp(delta, opts) {
    const wasDissolving = cancelDissolve();
    const wasCollapsed = !!uiState.collapsed;
    if (wasCollapsed) {
      uiState.collapsed = false;
    }
    const step = delta < 0 ? -1 : 1;
    const info = readOvercastInfo();
    if (!info.enabled || !info.allowedTiers.length) {
      if (wasDissolving || wasCollapsed) sync();
      return false;
    }
    const tiers = info.allowedTiers.map(t => t.pct);
    const cur = info.overcastPct;

    if (step > 0) {
      // 1:1 标杆左键/E 原地升档：0% → 20% → 40% → 60% → 0%（按 maxAmpCap 动态封顶循环）
      const higher = tiers.find(v => v > cur + 0.005);
      const nextVal = higher != null ? higher : tiers[0];
      const changed = applyAmpPct(nextVal, opts);
      if (wasCollapsed && !uiState.syncing && uiState.rigEl && uiState.rigEl.classList.contains('is-collapsed')) {
        sync();
      }
      return changed;
    }

    // 1:1 标杆右键/Shift+E 原地降档：60% → 40% → 20% → 0%（已在 0% 时静默止步）
    let lower = null;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (tiers[i] < cur - 0.005) {
        lower = tiers[i];
        break;
      }
    }
    const nextVal = lower != null ? lower : tiers[0];
    if (Math.abs(nextVal - cur) <= 1e-4) {
      if (wasDissolving || wasCollapsed) sync();
      return false;
    }
    const changed = applyAmpPct(nextVal, opts);
    if (wasCollapsed && !uiState.syncing && uiState.rigEl && uiState.rigEl.classList.contains('is-collapsed')) {
      sync();
    }
    return changed;
  }

  function stepAmpByWheel(delta, opts) {
    cancelDissolve();
    const step = delta < 0 ? -1 : 1;
    const info = readOvercastInfo();
    if (!info.enabled || !info.allowedTiers.length) return false;
    const tiers = info.allowedTiers.map(t => t.pct);
    const cur = info.overcastPct;

    if (step > 0) {
      const higher = tiers.find(v => v > cur + 0.005);
      if (higher == null) return false;
      return applyAmpPct(higher, opts);
    }
    let lower = null;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (tiers[i] < cur - 0.005) {
        lower = tiers[i];
        break;
      }
    }
    if (lower == null) return false;
    return applyAmpPct(lower, opts);
  }

  function onAmpWheel(ev, opts) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!ev.deltaY) return;
    const now = Date.now();
    if (now - uiState.lastAmpWheelAt < 90) return;
    uiState.lastAmpWheelAt = now;
    stepAmpByWheel(ev.deltaY < 0 ? 1 : -1, opts);
  }

  function resolveLiveSourceBtn(item) {
    if (!item) return null;
    if (item.sourceBtn && item.sourceBtn.isConnected) return item.sourceBtn;
    if (typeof document !== 'undefined') {
      if (item.kind === 'skill' && item.skillId) {
        const box = getSkillSourceContainer();
        if (box) {
          const cards = box.querySelectorAll('.cb-skill-card');
          for (let i = 0; i < cards.length; i++) {
            if (cards[i].getAttribute('data-sk') === item.skillId) return cards[i];
          }
        }
      }
    }
    return item.sourceBtn || null;
  }

  function syncSkillHoverPreview(btn, isEnter, skillId) {
    // 静音同步引擎推演条与敌方血条预扣：使用 onfocus/onblur 避免触发旧 .cb-skill-card.onmouseenter 重复播音，
    // .cb-blade 悬停音效统一由 sfx-suite.js 接管。
    try {
      if (isEnter) {
        if (btn && typeof btn.onfocus === 'function') {
          btn.onfocus();
        }
        if (skillId && global.CombatEngine && typeof global.CombatEngine.syncHoverEnemyGlow === 'function') {
          global.CombatEngine.syncHoverEnemyGlow(skillId);
        }
      } else {
        if (btn && typeof btn.onblur === 'function') {
          btn.onblur();
        }
        if (global.CombatEngine && typeof global.CombatEngine.syncHoverEnemyGlow === 'function') {
          global.CombatEngine.syncHoverEnemyGlow(null);
        }
      }
    } catch (e) {}
  }

  function clearRealHover(opts) {
    cancelPendingHoverClear();
    if (opts && opts.resetLast) {
      uiState.lastHoveredSkillId = null;
    }
    const cards = readSkillCards();
    if (cards.length && cards[0].sourceBtn) {
      syncSkillHoverPreview(cards[0].sourceBtn, false, null);
    } else {
      syncSkillHoverPreview(null, false, null);
    }
    syncAvForecast(null, uiState.lastBattleState);
  }

  function finalizeSkillCast(res, keepSkillsMode, prevWaveKey) {
    if (res && res.ok === false) {
      sync();
      return false;
    }
    uiState.lastSkillCastAt = Date.now();
    const nextState = getEngineBattle();
    const nextWaveKey = nextState ? `${nextState.battleInstanceId || 0}:${nextState.waveIdx || 0}` : '';
    const waveChanged = !!(prevWaveKey && nextWaveKey && nextWaveKey !== prevWaveKey);
    const canContinueSkills = keepSkillsMode
      && !(res && (res.battleEndedOrAdvanced || res.exposedFail || res.defeated))
      && !waveChanged
      && isPlayerTurnActive(nextState)
      && readRemainingAp(nextState) > 0;

    if (canContinueSkills) {
      // 仍有 AP 可继续出招：停留在 mode-skills 原地刷新扇叶，绝不叠加阻塞点击的 .dissolved 锁
      uiState.menuMode = 'skills';
      sync(nextState);
      triggerCastFlash();

      let keptHoverSid = null;
      let keptHoverWrap = null;
      if (uiState.cascadeListEl) {
        try {
          const hoveredBtn = uiState.cascadeListEl.querySelector('.cb-blade:hover');
          if (hoveredBtn && !hoveredBtn.disabled) {
            const hIdx = Number(hoveredBtn.getAttribute('data-prism-idx'));
            const hSid = hoveredBtn.getAttribute('data-sk') || '';
            if (isFinite(hIdx)) uiState.hoveredBladeIdx = hIdx;
            if (hSid) keptHoverSid = hSid;
            keptHoverWrap = hoveredBtn.closest('.cb-blade-wrap');
          }
        } catch (e) {}
      }
      if (keptHoverSid) {
        uiState.lastHoveredSkillId = keptHoverSid;
        if (keptHoverWrap) {
          const rot = keptHoverWrap.dataset.rot || '0';
          keptHoverWrap.classList.add('hovered');
          keptHoverWrap.style.transform = `translateX(0) rotate(${rot}deg) scale(1.015)`;
        }
        applySkillHoverPreviewNow(keptHoverSid, nextState);
      } else {
        uiState.hoveredBladeIdx = null;
        if (uiState.cascadeListEl) {
          uiState.cascadeListEl.querySelectorAll('.cb-blade-wrap.hovered').forEach(w => {
            w.classList.remove('hovered');
            const rot = w.dataset.rot || '0';
            w.style.transform = `rotate(${rot}deg)`;
          });
        }
      }
      renderCurrentSvg();
      return true;
    }

    uiState.hoveredBladeIdx = null;
    uiState.hoveringAmpMini = false;
    uiState.menuMode = 'root';
    uiState.lastBladeSig = '';
    clearRealHover({ resetLast: true });
    if (!shouldHardDissolve(nextState) && !isTimingOrAsyncDissolved(nextState)) {
      startBriefDissolve();
    }
    sync(nextState);
    return true;
  }

  function triggerSourceButton(item) {
    if (!item || isTimingOrAsyncDissolved()) return false;
    if (item.isPlaceholder || item.kind === 'placeholder') return false;

    if (item.kind === 'item') {
      if (item.disabled) return false;
      const liveBtn = resolveLiveSourceBtn(item);
      cancelDissolve();
      cancelPendingHoverClear();
      uiState.hoveredWingIdx = null;
      uiState.hoveredBladeIdx = null;
      uiState.hoveringAmpMini = false;
      uiState.menuMode = 'root';
      uiState.lastBladeSig = '';
      clearRealHover({ resetLast: true });
      if (typeof item.onUse === 'function') {
        item.onUse(getEngineBattle(), item.rawItem);
      } else if (global.CombatEngine && typeof global.CombatEngine.useBattleItem === 'function' && item.itemId) {
        global.CombatEngine.useBattleItem(item.itemId);
      } else if (liveBtn && !liveBtn.disabled) {
        liveBtn.click();
      } else {
        sync();
        return false;
      }
      sync();
      return true;
    }

    const isSkill = (item.kind === 'skill' && !!item.skillId);
    const liveBtn = resolveLiveSourceBtn(item);
    if (isSkill) {
      if (item.disabled || (liveBtn && liveBtn.disabled)) return false;
    } else {
      if (!liveBtn || liveBtn.disabled) return false;
    }

    const prevMode = uiState.menuMode;
    const prevWaveKey = uiState.lastBattleWaveKey;
    const keepSkillsMode = isSkill && prevMode === 'skills';

    cancelDissolve();
    cancelPendingHoverClear();
    uiState.hoveredWingIdx = null;
    if (keepSkillsMode) {
      // 先保持 mode-skills 并在施法后按剩余 AP 判定是否续留，避免过早收合导致连点落空
      clearRealHover();
    } else {
      uiState.hoveredBladeIdx = null;
      uiState.hoveringAmpMini = false;
      uiState.menuMode = 'root';
      uiState.lastBladeSig = '';
      clearRealHover({ resetLast: true });
    }

    let res = null;
    if (isSkill && global.CombatEngine && typeof global.CombatEngine.useSkill === 'function') {
      // 直接调用 CombatEngine.useSkill，绕开屏外隐藏 .cb-skill-card 的粗触控两段确认与 140ms 防抖
      res = global.CombatEngine.useSkill(item.skillId);
      if (res && res.ok === false) {
        sync();
        return false;
      }
    } else if (liveBtn) {
      liveBtn.click();
    }

    if (isSkill) {
      if (res && typeof res.then === 'function') {
        sync(getEngineBattle());
        res.then(
          resolved => finalizeSkillCast(resolved, keepSkillsMode, prevWaveKey),
          () => sync()
        );
        return true;
      }
      if (isTimingOrAsyncDissolved()) {
        sync(getEngineBattle());
        return true;
      }
      return finalizeSkillCast(res, keepSkillsMode, prevWaveKey);
    }

    sync();
    return true;
  }

  function setMode(nextMode) {
    cancelDissolve();
    if (nextMode === 'amp') {
      cycleAmp(1);
      return true;
    }
    if (nextMode === 'assist') {
      return false;
    }
    const wasCollapsed = !!uiState.collapsed;
    if (wasCollapsed) {
      uiState.collapsed = false;
    }
    const normalized = nextMode === 'guard' ? 'skills' : nextMode;
    const valid = normalized === 'skills' || normalized === 'items'
      ? normalized
      : 'root';
    if (uiState.menuMode !== valid) {
      cancelPendingHoverClear();
      clearRealHover({ resetLast: true });
      if (valid !== 'skills') uiState.lastSkillCastAt = 0;
      if (valid === 'root') uiState.hoveringAmpMini = false;
      uiState.menuMode = valid;
      uiState.hoveredWingIdx = null;
      uiState.hoveredBladeIdx = null;
      uiState.lastBladeSig = '';
      safeSfx('ui_tick');
    } else if (wasCollapsed) {
      safeSfx('ui_tick', { gain: 0.78 });
    }
    sync();
    return true;
  }

  function setCollapsed(flag, opts) {
    const next = !!flag;
    const prev = !!uiState.collapsed;
    const silent = !!(opts && opts.silent);
    const skipSync = !!(opts && opts.skipSync);

    if (next) {
      uiState.collapsed = true;
      uiState.menuMode = 'root';
      uiState.hoveredWingIdx = null;
      uiState.hoveredBladeIdx = null;
      uiState.hoveringAmpMini = false;
      uiState.lastBladeSig = '';
      uiState.lastSkillCastAt = 0;
      cancelPendingHoverClear();
      clearRealHover({ resetLast: true });
      syncAvForecast(null, uiState.lastBattleState || getEngineBattle());
      if (!silent && !prev) {
        safeSfx('ui_tick', { gain: 0.72 });
      }
    } else {
      uiState.collapsed = false;
      if (!silent && prev) {
        safeSfx('ui_tick', { gain: 0.78 });
      }
    }

    if (!skipSync) {
      sync();
    }
    return uiState.collapsed;
  }

  function toggleCollapsed(opts) {
    return setCollapsed(!uiState.collapsed, opts);
  }

  function openSkills() { return setMode('skills'); }
  function openAmp() { return cycleAmp(1); }
  function openItems() { return setMode('items'); }
  function openGuard() { return openSkills(); }
  function openAssist() { return false; }
  function openPalace() { return false; }
  function closeCascade() { return setMode('root'); }

  function toggleLogDrawer() {
    uiState.logExpanded = !uiState.logExpanded;
    safeSfx('ui_tick', { gain: 0.72 });
    syncLogBar();
  }

  function resolveBladeVerticalBounds(absLeft, absRight, fieldH) {
    let safeTop = 8;
    let safeBot = Math.max(140, fieldH - 12);
    const overlapsEnemyZone = uiState.enemyLeftX > 0 && absRight > uiState.enemyLeftX - 6;
    if (uiState.compactMulti && (!uiState.hasMidCorridor || overlapsEnemyZone)) {
      safeTop = Math.max(safeTop, (uiState.skyTopY || 0) + 8);
      if (uiState.skyBotY > safeTop + 120) {
        safeBot = Math.min(safeBot, uiState.skyBotY - 8);
      }
    }
    const obs = Array.isArray(uiState.obstacles) ? uiState.obstacles : [];
    for (let i = 0; i < obs.length; i++) {
      const ob = obs[i];
      if (!ob) continue;
      if (ob.right <= absLeft - 6 || ob.left >= absRight + 6) continue;
      if (ob.kind === 'intent') {
        safeTop = Math.max(safeTop, ob.bottom + 8);
      } else if (ob.kind === 'lower') {
        safeBot = Math.min(safeBot, ob.top - 8);
      }
    }
    // 兜底防极矮窗口上下包络反转：优先保障叶片落于可视场内
    if (safeBot - safeTop < 156) {
      const relaxedBot = Math.min(fieldH - 10, Math.max(safeBot, safeTop + 156));
      safeBot = relaxedBot;
      if (safeBot - safeTop < 156) {
        safeTop = Math.max(6, safeBot - 156);
      }
    }
    return {
      safeTop: Math.max(6, Math.round(safeTop)),
      safeBot: Math.min(fieldH - 8, Math.round(safeBot)),
    };
  }

  function computeBladeGeometry(count, guardSplitIdx, isPlaceholderSingle) {
    const safeCount = Math.max(1, count);
    const resolvedGuardSplit = typeof guardSplitIdx === 'number'
      ? guardSplitIdx
      : (uiState.menuMode === 'skills' ? uiState.guardSplitIdx : -1);
    const resolvedPlaceholderSingle = typeof isPlaceholderSingle === 'boolean'
      ? isPlaceholderSingle
      : (safeCount === 1 && uiState.currentItems.length === 1 && !!uiState.currentItems[0].isPlaceholder);

    const fieldW = Math.max(640, uiState.lastFieldW || 1200);
    const fieldH = Math.max(360, uiState.lastFieldH || 560);
    const anchorX = Math.max(68, uiState.lastAnchorX || 220);
    const anchorY = Math.max(88, uiState.lastAnchorY || Math.round(fieldH * 0.45));
    const flipLeft = !!uiState.anchorFlipLeft;
    const viewportW = uiState.viewportW || (typeof window !== 'undefined' ? window.innerWidth : 1440);
    const viewportH = uiState.viewportH || (typeof window !== 'undefined' ? window.innerHeight : 900);
    const isTightDesktop = viewportH <= 760 || viewportW <= 1320 || !!uiState.narrowDesktop || !!uiState.shortViewport;
    const compact = safeCount >= 7 || isTightDesktop || !!uiState.compactMulti;
    const isCompactSpine = !!(isTightDesktop || (uiState.compactMulti && uiState.narrowDesktop));
    const spineH = isCompactSpine ? 26 : 30;
    const spineGap = isCompactSpine ? 6 : 8;

    // 紧贴当前操作角色 anchorX 相对偏移（仅防越屏边 fieldW - 14 / 14，绝不向雷纳德右侧或中场走廊推飞）
    const naturalSingleW = (isTightDesktop || uiState.compactMulti) ? 288 : 326;
    const preferredBaseX = (isTightDesktop || uiState.compactMulti) ? 28 : 48;
    const preferredArcX = (isTightDesktop || uiState.compactMulti) ? 10 : 18;
    const availSideSpan = flipLeft
      ? Math.max(236, anchorX - 14)
      : Math.max(236, fieldW - anchorX - 14);
    const singleW = Math.max(220, Math.min(naturalSingleW, availSideSpan - 16));
    const singleForceW = singleW < naturalSingleW;
    let singleBaseX = preferredBaseX;
    let singleArcX = preferredArcX;
    if (singleBaseX + singleArcX + singleW > availSideSpan) {
      singleBaseX = Math.max(14, Math.min(singleBaseX, availSideSpan - singleW));
      singleArcX = Math.max(0, Math.min(singleArcX, availSideSpan - singleBaseX - singleW));
    }

    const singleAbsLeft = flipLeft
      ? Math.max(14, anchorX - (singleBaseX + singleArcX + singleW))
      : (anchorX + singleBaseX);
    const singleAbsRight = flipLeft
      ? (anchorX - singleBaseX)
      : Math.min(fieldW - 14, anchorX + singleBaseX + singleW + singleArcX);

    const singleBounds = resolveBladeVerticalBounds(singleAbsLeft, singleAbsRight, fieldH);
    const singleMinTopOff = (singleBounds.safeTop + spineH + spineGap) - anchorY;
    const singleMaxBotOff = singleBounds.safeBot - anchorY;
    const singleAvailSpan = Math.max(120, singleMaxBotOff - singleMinTopOff);
    const hasGuardSplit = !resolvedPlaceholderSingle && resolvedGuardSplit > 0 && resolvedGuardSplit < safeCount;
    const desiredGuardGap = hasGuardSplit ? (isTightDesktop ? 6 : 9) : 0;
    const minSingleH = isTightDesktop ? 32 : 34;
    const minSingleGap = safeCount >= 10 ? 2 : 3;
    const singleNeededH = safeCount * minSingleH + Math.max(0, safeCount - 1) * minSingleGap + desiredGuardGap;

    // 最多 6 招始终单列直显；仅 7 招以上且单列竖向空间不足时启用跟手双列
    const twoCol = safeCount >= 7 && singleAvailSpan < singleNeededH;

    if (twoCol) {
      const col1Count = Math.ceil(safeCount / 2);
      const col2Count = safeCount - col1Count;
      let bladeW = isTightDesktop ? 262 : 286;
      let colGap = isTightDesktop ? 12 : 16;
      let col1Dist = Math.min(preferredBaseX, 36);
      const maxSpanInRig = availSideSpan;
      if (col1Dist + bladeW * 2 + colGap > maxSpanInRig) {
        const overflow = (col1Dist + bladeW * 2 + colGap) - maxSpanInRig;
        const shiftedDist = Math.max(14, col1Dist - overflow);
        let rem = Math.max(0, overflow - (col1Dist - shiftedDist));
        col1Dist = shiftedDist;
        const nextGap = Math.max(8, colGap - rem);
        rem = Math.max(0, rem - (colGap - nextGap));
        colGap = nextGap;
        if (rem > 0) {
          bladeW = Math.max(210, Math.floor((maxSpanInRig - col1Dist - colGap) / 2));
        }
      }
      const col2Dist = col1Dist + bladeW + colGap;

      const absLeft = flipLeft ? Math.max(14, anchorX - (col2Dist + bladeW)) : (anchorX + col1Dist);
      const absRight = flipLeft ? (anchorX - col1Dist) : Math.min(fieldW - 14, anchorX + col2Dist + bladeW + 8);
      const { safeTop, safeBot } = resolveBladeVerticalBounds(absLeft, absRight, fieldH);
      const minTopOffset = (safeTop + spineH + spineGap) - anchorY;
      const maxBotOffset = safeBot - anchorY;
      const availSpan = Math.max(116, maxBotOffset - minTopOffset);

      const defaultBladeH = isTightDesktop || availSpan < 220 ? 36 : 40;
      const fitBladeH = col1Count > 0 ? Math.floor((availSpan - Math.max(0, col1Count - 1) * 2) / col1Count) : defaultBladeH;
      const bladeH = Math.max(30, Math.min(defaultBladeH, fitBladeH));
      const forceHeight = bladeH < defaultBladeH;
      const idealStep = bladeH + (isTightDesktop ? 4 : 5);
      const maxAllowedStep = col1Count > 1 ? Math.floor((availSpan - bladeH) / (col1Count - 1)) : idealStep;
      const stepY = col1Count > 1 ? Math.max(bladeH + 1, Math.min(idealStep, maxAllowedStep)) : idealStep;

      const col1TotalH = (col1Count - 1) * stepY + bladeH;
      const col2TotalH = col2Count > 0 ? ((col2Count - 1) * stepY + bladeH) : 0;
      let startY = Math.round(minTopOffset + Math.max(0, (availSpan - col1TotalH) * 0.35));
      if (startY + col1TotalH > maxBotOffset) {
        startY = Math.max(minTopOffset, maxBotOffset - col1TotalH);
      }
      if (startY < minTopOffset) startY = minTopOffset;
      const col2StartY = startY + Math.round((col1TotalH - col2TotalH) * 0.5);

      const coords = [];
      for (let i = 0; i < safeCount; i++) {
        const inCol2 = i >= col1Count;
        const idxInCol = inCol2 ? (i - col1Count) : i;
        const colSize = inCol2 ? col2Count : col1Count;
        const frac = colSize <= 1 ? 0.5 : idxInCol / (colSize - 1);
        const baseDist = inCol2 ? col2Dist : col1Dist;
        const arcX = inCol2 ? 6 : 10;
        const radialX = Math.round(baseDist + Math.sin(frac * Math.PI) * arcX);
        const left = flipLeft ? -(radialX + bladeW) : radialX;
        const topY = Math.round((inCol2 ? col2StartY : startY) + idxInCol * stepY);
        const maxRot = inCol2 ? 0.7 : 1.0;
        const baseRot = Number((-maxRot + frac * (maxRot * 2)).toFixed(2));
        const rot = flipLeft ? -baseRot : baseRot;
        coords.push({
          left,
          top: topY,
          rot,
          compact: true,
          twoCol: true,
          colIdx: inCol2 ? 1 : 0,
          showHairline: !inCol2,
          bladeH,
          bladeW,
          forceHeight,
          forceWidth: bladeW < (isTightDesktop ? 262 : 286),
          tipX: radialX + 4,
          tipY: topY + Math.round(bladeH * 0.5),
          elbowX: Math.round(radialX * 0.52),
          elbowY: Math.round((topY + Math.round(bladeH * 0.5)) * 0.65),
        });
      }
      return {
        coords,
        spineTop: Math.max(safeTop - anchorY, startY - (spineH + spineGap)),
        spineLeft: flipLeft ? -(col1Dist + bladeW) : col1Dist,
        bladeH,
        twoCol: true,
      };
    }

    // 单列跟手棱晶翼（1–6 招单列直显，攻伐在前、守御身法留轻分组间距）
    const { safeTop, safeBot } = singleBounds;
    const minTopOffset = singleMinTopOff;
    const maxBotOffset = singleMaxBotOff;
    const availSpan = singleAvailSpan;
    let defaultBladeH;
    let idealStep;
    if (resolvedPlaceholderSingle) {
      defaultBladeH = 60;
      idealStep = 64;
    } else if (safeCount <= 4) {
      defaultBladeH = compact ? 42 : 48;
      idealStep = compact ? 54 : 62;
    } else if (safeCount === 5) {
      defaultBladeH = compact ? 42 : 46;
      idealStep = compact ? 50 : 54;
    } else if (safeCount === 6) {
      defaultBladeH = isTightDesktop ? 40 : 44;
      idealStep = isTightDesktop ? 46 : 50;
    } else if (safeCount <= 8) {
      defaultBladeH = isTightDesktop ? 38 : 42;
      idealStep = isTightDesktop ? 42 : 47;
    } else {
      defaultBladeH = isTightDesktop ? 36 : 40;
      idealStep = isTightDesktop ? 39 : 44;
    }
    const effectiveGuardGap = hasGuardSplit
      ? Math.max(0, Math.min(desiredGuardGap, Math.floor(availSpan - safeCount * 30 - Math.max(0, safeCount - 1) * 2)))
      : 0;
    const usableSpan = Math.max(90, availSpan - effectiveGuardGap);
    const fitBladeH = safeCount > 0 ? Math.floor((usableSpan - Math.max(0, safeCount - 1) * minSingleGap) / safeCount) : defaultBladeH;
    const bladeH = resolvedPlaceholderSingle ? defaultBladeH : Math.max(30, Math.min(defaultBladeH, fitBladeH));
    const forceHeight = !resolvedPlaceholderSingle && (bladeH < defaultBladeH || safeCount >= 7);
    const maxAllowedStep = safeCount > 1 ? Math.floor((usableSpan - bladeH) / (safeCount - 1)) : idealStep;
    const stepY = safeCount > 1 ? Math.max(bladeH + 2, Math.min(idealStep, maxAllowedStep)) : idealStep;

    const totalH = (safeCount - 1) * stepY + bladeH + effectiveGuardGap;
    let startY = -Math.round(totalH * 0.50);
    if (startY < minTopOffset) startY = minTopOffset;
    if (startY + totalH > maxBotOffset) startY = Math.max(minTopOffset, maxBotOffset - totalH);

    const arcX = resolvedPlaceholderSingle ? 0 : singleArcX;
    const maxRot = resolvedPlaceholderSingle ? 0 : (safeCount >= 9 ? 0.9 : (compact ? 1.4 : 2.2));

    const coords = [];
    for (let i = 0; i < safeCount; i++) {
      const frac = safeCount === 1 ? 0.5 : i / (safeCount - 1);
      const radialX = Math.round(singleBaseX + Math.sin(frac * Math.PI) * arcX);
      const left = flipLeft ? -(radialX + singleW) : radialX;
      const groupOffset = (hasGuardSplit && i >= resolvedGuardSplit) ? effectiveGuardGap : 0;
      const topY = Math.round(startY + i * stepY + groupOffset);
      const baseRot = Number((-maxRot + frac * (maxRot * 2)).toFixed(2));
      const rot = flipLeft ? -baseRot : baseRot;
      coords.push({
        left,
        top: topY,
        rot,
        compact,
        twoCol: false,
        colIdx: 0,
        showHairline: true,
        bladeH,
        bladeW: singleW,
        forceHeight,
        forceWidth: singleForceW,
        tipX: radialX + 4,
        tipY: topY + Math.round(bladeH * 0.5),
        elbowX: Math.round(radialX * 0.54),
        elbowY: Math.round((topY + Math.round(bladeH * 0.5)) * 0.65),
      });
    }
    const spineLeft = flipLeft
      ? -(singleBaseX + singleW)
      : Math.max(12, singleBaseX - 6);
    return {
      coords,
      spineTop: Math.max(safeTop - anchorY, startY - (spineH + spineGap)),
      spineLeft,
      bladeH,
      twoCol: false,
    };
  }

  function renderSvgHairlines(targets, hoveredIdx) {
    if (!uiState.svgEl) return;
    const parts = [];
    parts.push('<g class="rig-rays-layer">');
    parts.push('<path class="rig-orbit-gold" d="M 8 -166 A 174 174 0 0 1 74 174" />');
    parts.push('<path class="rig-orbit-blue" d="M -8 -138 A 144 144 0 0 1 54 150" />');
    parts.push('<polygon class="rig-node-gem" points="30,-136 35,-128 30,-120 25,-128" opacity="0.88" />');
    parts.push('<polygon class="rig-node-gem blue" points="58,20 62,26 58,32 54,26" opacity="0.82" />');
    parts.push('<polygon class="rig-node-gem" points="40,146 45,153 40,160 35,153" opacity="0.85" />');

    targets.forEach((pt, idx) => {
      const targetIdx = pt.origIdx != null ? pt.origIdx : idx;
      const lit = targetIdx === hoveredIdx;
      const cls = 'rig-hairline' + (pt.hero ? ' hero-line' : '') + (lit ? ' lit' : '');
      parts.push(`<path class="${cls}" d="M 0 0 L ${pt.elbowX} ${pt.elbowY} L ${pt.tipX} ${pt.tipY}" />`);
      const gCls = 'rig-node-gem' + (pt.hero ? ' blue' : '') + (lit ? ' lit' : '');
      parts.push(`<polygon class="${gCls}" points="${pt.tipX},${pt.tipY - 4.5} ${pt.tipX + 4.5},${pt.tipY} ${pt.tipX},${pt.tipY + 4.5} ${pt.tipX - 4.5},${pt.tipY}" />`);
    });
    parts.push('</g>');

    parts.push('<g class="rig-hub-group">');
    parts.push('<polygon class="rig-hub-outer" fill="none" stroke="rgba(239,224,190,0.72)" stroke-width="1" points="0,-14 14,0 0,14 -14,0" />');
    parts.push('<polygon class="rig-hub-mid" fill="#1658EB" points="0,-8 8,0 0,8 -8,0" />');
    parts.push('<polygon class="rig-hub-inner" fill="#EFE0BE" points="0,-4.5 4.5,0 0,4.5 -4.5,0" />');
    parts.push('<polygon class="rig-hub-core" fill="#FFFFFF" points="0,-2 2,0 0,2 -2,0" />');
    parts.push('</g>');
    uiState.svgEl.innerHTML = parts.join('');
  }

  function measureBoxInField(el, field, fRectFallback) {
    if (!el || !field) return null;
    // 优先沿 offsetParent 累加静止布局坐标（相对 field 内边距盒），彻底免疫 .cb-px-actor 冲刺 translate3d 与 field 震屏 rotate
    if (field.offsetWidth > 0 && field.offsetHeight > 0 && el.offsetWidth > 0 && el.offsetHeight > 0) {
      let left = 0;
      let top = 0;
      let cur = el;
      let steps = 0;
      while (cur && cur !== field && cur !== document.body && cur !== document.documentElement && steps < 24) {
        left += cur.offsetLeft || 0;
        top += cur.offsetTop || 0;
        const parent = cur.offsetParent;
        if (parent && parent !== field) {
          left += (parent.clientLeft || 0) - (parent.scrollLeft || 0);
          top += (parent.clientTop || 0) - (parent.scrollTop || 0);
        }
        cur = parent;
        steps += 1;
      }
      if (cur === field) {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        return { left, top, right: left + w, bottom: top + h, width: w, height: h };
      }
    }
    const fRect = fRectFallback || field.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      left: r.left - fRect.left,
      top: r.top - fRect.top,
      right: r.right - fRect.left,
      bottom: r.bottom - fRect.top,
      width: r.width,
      height: r.height,
    };
  }

  function isDisplayedInLayout(el) {
    if (!isVisible(el) || el.hidden) return false;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      try {
        const cs = window.getComputedStyle(el);
        if (cs && cs.display === 'none') return false;
      } catch (e) {}
    }
    return true;
  }

  function normalizeActiveActor(input) {
    if (!input) {
      return { actorKey: 'player', id: 'sylvia', side: 'ally' };
    }
    if (typeof input === 'string') {
      const s = input.trim();
      if (!s || s === 'player' || s === 'sylvia') {
        return { actorKey: 'player', id: 'sylvia', side: 'ally' };
      }
      if (s.startsWith('ally:')) {
        return { actorKey: s, id: s.slice(5), side: 'ally' };
      }
      if (s.startsWith('enemy:')) {
        return { actorKey: s, id: s.slice(6), side: 'enemy' };
      }
      return { actorKey: `ally:${s}`, id: s, side: 'ally' };
    }
    if (typeof input === 'object') {
      const rawKey = typeof input.actorKey === 'string' ? input.actorKey.trim() : '';
      const rawId = typeof input.id === 'string' ? input.id.trim() : '';
      const side = input.side || 'ally';
      if (rawKey) {
        if (rawKey === 'player' || rawKey === 'sylvia') {
          return { actorKey: 'player', id: rawId || 'sylvia', side: 'ally' };
        }
        return { actorKey: rawKey, id: rawId || rawKey.replace(/^(?:ally|enemy):/, ''), side };
      }
      if (rawId && rawId !== 'sylvia' && rawId !== 'player') {
        const prefix = side === 'enemy' ? 'enemy:' : 'ally:';
        return { actorKey: `${prefix}${rawId}`, id: rawId, side };
      }
    }
    return { actorKey: 'player', id: 'sylvia', side: 'ally' };
  }

  function getActiveActorSpec(state) {
    if (uiState.activeActorOverride) return uiState.activeActorOverride;
    if (state && state.activeActor) return normalizeActiveActor(state.activeActor);
    return { actorKey: 'player', id: 'sylvia', side: 'ally' };
  }

  function setActiveActor(actorKey) {
    const prevActorKey = uiState.lastActiveActorKey;
    if (actorKey == null || actorKey === '') {
      uiState.activeActorOverride = null;
    } else {
      uiState.activeActorOverride = normalizeActiveActor(actorKey);
    }
    uiState.lastBladeSig = '';
    const resolved = getActiveActorSpec(uiState.lastBattleState || getEngineBattle());
    if (resolved.actorKey !== prevActorKey) {
      uiState.collapsed = false;
    }
    uiState.lastActiveActorKey = resolved.actorKey;
    if (uiState.mounted) {
      sync();
    }
    return resolved.actorKey;
  }

  function resolveActiveActorBox(state, field, fRectFallback) {
    if (typeof document === 'undefined') return null;
    const hostField = field
      || (uiState.rigEl && uiState.rigEl.parentElement)
      || document.querySelector('#battle-screen .cb-arena-field');
    if (!hostField) return null;

    const b = state || uiState.lastBattleState || getEngineBattle();
    const active = getActiveActorSpec(b);
    const actorKey = active.actorKey || 'player';

    const tryMeasure = el => {
      if (!el || !isDisplayedInLayout(el)) return null;
      const m = measureBoxInField(el, hostField, fRectFallback);
      if (!m || m.width < 20 || m.height < 20) return null;
      return {
        left: m.left,
        top: m.top,
        right: m.right,
        bottom: m.bottom,
        width: m.width,
        height: m.height,
        actorKey,
        el,
      };
    };

    const pickFirst = candidates => {
      for (let i = 0; i < candidates.length; i++) {
        const res = tryMeasure(candidates[i]);
        if (res) return res;
      }
      return null;
    };

    const playerCandidates = () => [
      hostField.querySelector('#cb-p-portrait') || document.getElementById('cb-p-portrait'),
      hostField.querySelector('#cb-player-standee-wrap') || document.getElementById('cb-player-standee-wrap'),
      hostField.querySelector('.cb-ally-slot .cb-standee-wrap:not(.cb-ally-standee)'),
      document.getElementById('cb-player-stage'),
    ];

    if (actorKey === 'player') {
      return pickFirst(playerCandidates());
    }

    const safeKey = actorKey.replace(/["\\]/g, '');
    const safeId = String(active.id || actorKey.replace(/^(?:ally|enemy):/, '')).replace(/["\\]/g, '');

    if (actorKey.startsWith('ally:')) {
      const allyHit = pickFirst([
        hostField.querySelector(`[data-actor-key="${safeKey}"]:not(.cb-px-actor) .cb-ally-portrait`),
        hostField.querySelector(`.cb-ally-vanguard-slot[data-actor-key="${safeKey}"], .cb-ally-extra-slot[data-actor-key="${safeKey}"]`),
        hostField.querySelector(`[data-ally-id="${safeId}"]:not(.cb-ally-pane) .cb-ally-portrait`),
        hostField.querySelector(`.cb-ally-vanguard-slot[data-ally-id="${safeId}"], .cb-ally-extra-slot[data-ally-id="${safeId}"]`),
        hostField.querySelector(`[data-actor-key="${safeKey}"]:not(.cb-px-actor)`),
      ]);
      if (allyHit) return allyHit;
      return pickFirst(playerCandidates());
    }

    const otherHit = pickFirst([
      hostField.querySelector(`[data-actor-key="${safeKey}"]:not(.cb-px-actor) .cb-e-stage`),
      hostField.querySelector(`[data-actor-key="${safeKey}"]:not(.cb-px-actor)`),
    ]);
    return otherHit || pickFirst(playerCandidates());
  }

  function syncRigAnchor(battleOverride) {
    if (!uiState.rigEl) return;
    const field = uiState.rigEl.parentElement;
    const playerStage = document.getElementById('cb-player-stage');
    if (!field || !playerStage) return;
    const fRectFallback = field.getBoundingClientRect();
    const fieldW = field.offsetWidth > 0 ? field.offsetWidth : fRectFallback.width;
    const fieldH = field.offsetHeight > 0 ? field.offsetHeight : fRectFallback.height;
    const pBox = measureBoxInField(playerStage, field, fRectFallback);
    if (fieldW < 100 || !pBox || pBox.width < 40) return;

    const bs = getBattleScreen();
    const b = battleOverride || uiState.lastBattleState || getEngineBattle();
    const aBox = resolveActiveActorBox(b, field, fRectFallback) || {
      left: pBox.left,
      top: pBox.top,
      right: pBox.right,
      bottom: pBox.bottom,
      width: pBox.width,
      height: pBox.height,
      actorKey: 'player',
      el: playerStage,
    };

    const eZone = document.getElementById('cb-enemy-zone');
    const enemyCount = eZone ? eZone.querySelectorAll('.cb-enemy-card').length : 0;
    const isMulti = enemyCount >= 3;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900;
    const isShortViewport = viewportH <= 760;
    const isNarrowDesktop = viewportW <= 1320 || isShortViewport;
    uiState.viewportW = viewportW;
    uiState.viewportH = viewportH;
    uiState.shortViewport = isShortViewport;
    uiState.narrowDesktop = isNarrowDesktop;

    // 测算敌方静态容器与双底角面板避障边界（仅用于竖向安全区与状态诊断；锚点严格跟手当前操作角色 aBox）
    let intentMaxBottom = 0;
    let enemyMinTop = fieldH;
    let enemyMinLeft = fieldW;
    let hasVanguardActor = !!field.querySelector('#cb-ally-vanguard-slot, .cb-ally-vanguard-slot');
    let paneTop = fieldH;
    let allyPaneTop = fieldH;
    let allyPaneRight = 0;
    let partyLayout = '';
    let partyDockTop = 0;
    let targetPaneLeft = 0;
    let targetPaneTop = 0;
    let targetPaneFound = false;
    const obstacles = [];
    const seenObstacleEls = new Set();

    const pushObstacle = (el, kind, role, preMeasured) => {
      if (!el || seenObstacleEls.has(el) || !isDisplayedInLayout(el)) return null;
      const m = preMeasured || measureBoxInField(el, field, fRectFallback);
      if (!m || m.width < 4 || m.height < 4) return null;
      seenObstacleEls.add(el);
      const box = {
        kind,
        role: role || '',
        left: m.left,
        top: m.top,
        right: m.right,
        bottom: m.bottom,
      };
      obstacles.push(box);
      return box;
    };

    if (eZone) {
      eZone.querySelectorAll('.cb-enemy-card').forEach(card => {
        const box = pushObstacle(card, 'enemy-card', 'enemy');
        if (box) {
          enemyMinLeft = Math.min(enemyMinLeft, box.left);
        }
      });
      eZone.querySelectorAll('.cb-intent-banner').forEach(el => {
        if (!el || seenObstacleEls.has(el) || !isDisplayedInLayout(el)) return;
        const m = measureBoxInField(el, field, fRectFallback);
        if (!m || m.width < 4 || m.height < 4) return;
        const ownerCard = el.closest ? el.closest('.cb-enemy-card') : null;
        const ownerStage = ownerCard ? ownerCard.querySelector('.cb-e-stage') : null;
        let isFootBanner = false;
        if (ownerStage && isDisplayedInLayout(ownerStage)) {
          const stageM = measureBoxInField(ownerStage, field, fRectFallback);
          if (stageM && stageM.height >= 4 && m.top >= stageM.bottom - 18) {
            isFootBanner = true;
          }
        }
        const isUpperIntent = !isFootBanner && m.bottom < fieldH * 0.42 && m.top < fieldH * 0.35;
        const intentKind = isUpperIntent ? 'intent' : (m.top >= fieldH * 0.58 ? 'lower' : 'enemy-card');
        const box = pushObstacle(el, intentKind, 'enemy-intent', m);
        if (box && isUpperIntent) {
          intentMaxBottom = Math.max(intentMaxBottom, box.bottom);
        }
      });
      eZone.querySelectorAll('.cb-e-stage, .cb-e-plate').forEach(el => {
        const box = pushObstacle(el, 'lower', 'enemy-lower');
        if (box && (box.bottom - box.top) > 12) {
          enemyMinTop = Math.min(enemyMinTop, box.top);
        }
      });
    }

    if (field.querySelectorAll('#cb-ally-formation .cb-ally-slot.is-occupied').length >= 2) {
      hasVanguardActor = true;
    }

    // 底部双锚点面板扫描（左下 1–6 队卡 #cb-party-panes / #cb-player-pane / #cb-ally-pane / .cb-ally-pane 与右下锁定详情卡 #cb-target-detail-pane）
    const bottomPanelEls = new Set();
    field.querySelectorAll('#cb-party-panes, #cb-player-pane, #cb-ally-pane, .cb-ally-pane, #cb-target-detail-pane').forEach(el => {
      bottomPanelEls.add(el);
    });
    const partyDockEl = field.querySelector('#cb-party-panes') || document.getElementById('cb-party-panes');
    if (partyDockEl && (!bs || bs.contains(partyDockEl))) {
      partyLayout = partyDockEl.getAttribute('data-party-layout') || '';
      bottomPanelEls.add(partyDockEl);
    }
    const targetDetailEl = field.querySelector('#cb-target-detail-pane') || document.getElementById('cb-target-detail-pane');
    if (targetDetailEl && (!bs || bs.contains(targetDetailEl))) {
      bottomPanelEls.add(targetDetailEl);
    }

    bottomPanelEls.forEach(el => {
      const isTargetDetail = el.id === 'cb-target-detail-pane';
      const isPartyDock = el.id === 'cb-party-panes';
      const role = isTargetDetail
        ? 'target-detail-pane'
        : (isPartyDock ? 'party-panes' : (el.id === 'cb-player-pane' ? 'player-pane' : 'ally-pane'));
      const box = pushObstacle(el, 'lower', role);
      if (!box) return;
      if (isPartyDock) {
        partyDockTop = Math.round(box.top);
      }
      if (isTargetDetail) {
        targetPaneLeft = Math.round(box.left);
        targetPaneTop = Math.round(box.top);
        targetPaneFound = true;
      }
      paneTop = Math.min(paneTop, box.top);
      if (!isTargetDetail) {
        allyPaneTop = Math.min(allyPaneTop, box.top);
        allyPaneRight = Math.max(allyPaneRight, box.right);
      }
    });
    if (!partyDockTop && allyPaneTop < fieldH) {
      partyDockTop = Math.round(allyPaneTop);
    }

    // 仅作状态诊断记录中场走廊尺寸（严禁用它强推当前角色菜单到雷纳德右侧）
    let hasMidCorridor = false;
    let corridorLeft = 0;
    let corridorRight = 0;
    let corridorW = 0;
    const midCorridor = document.getElementById('cb-mid-corridor') || field.querySelector('.cb-mid-corridor');
    if (midCorridor && isVisible(midCorridor)) {
      const mr = measureBoxInField(midCorridor, field, fRectFallback);
      if (mr && mr.width > 40) {
        hasMidCorridor = true;
        corridorLeft = Math.round(mr.left);
        corridorRight = Math.round(mr.right);
        corridorW = Math.round(mr.width);
      }
    }

    // 严格以当前操作角色 aBox 的右肩锚定，绝不取全体友军 Math.max，绝不被 #cb-mid-corridor 推飞
    const shoulderPull = Math.min(28, Math.round(aBox.width * 0.14));
    const idealAnchorX = Math.round(aBox.right - shoulderPull);
    const enemyLeftBound = enemyMinLeft < fieldW ? Math.round(enemyMinLeft) : Math.round(fieldW - 14);
    const availRightToEnemy = enemyLeftBound - idealAnchorX;
    const compactRig = isNarrowDesktop
      || (enemyMinLeft < fieldW && availRightToEnemy < 380)
      || (!hasMidCorridor && isMulti);

    uiState.compactMulti = compactRig;
    uiState.rigEl.classList.toggle('compact-multi', compactRig);
    uiState.rigEl.classList.toggle('narrow-desktop', isNarrowDesktop);

    const wingMinLeft = compactRig ? 24 : 46;
    const rightSpan = compactRig ? (isNarrowDesktop ? 268 : 284) : 348;
    const shouldFlipLeft = aBox.left > fieldW * 0.5 && (fieldW - idealAnchorX) < (rightSpan + 14);
    uiState.anchorFlipLeft = shouldFlipLeft;
    uiState.rigEl.classList.toggle('anchor-flip-left', shouldFlipLeft);

    let anchorX;
    if (shouldFlipLeft) {
      const leftIdealX = Math.round(aBox.left + shoulderPull);
      const minFlipAx = Math.min(fieldW - 68, rightSpan + 14);
      const maxFlipAx = Math.max(minFlipAx, Math.min(fieldW - 68, Math.round(aBox.right - aBox.width * 0.35)));
      anchorX = Math.round(Math.max(minFlipAx, Math.min(maxFlipAx, leftIdealX)));
    } else {
      const minAx = Math.max(68, Math.round(aBox.left + aBox.width * 0.35));
      const maxAx = Math.max(minAx, Math.round(fieldW - rightSpan - 14));
      anchorX = Math.round(Math.max(minAx, Math.min(maxAx, idealAnchorX)));
    }

    const wingTopExtent = (compactRig && isNarrowDesktop) ? 106 : (compactRig ? 120 : 128);
    const wingBotExtent = (compactRig && isNarrowDesktop) ? 132 : (compactRig ? 156 : 164);
    const safeTop = 8;
    let safeBot = fieldH - 10;
    const wingAbsLeft = shouldFlipLeft ? (anchorX - rightSpan) : (anchorX + wingMinLeft);
    const wingAbsRight = shouldFlipLeft ? (anchorX - wingMinLeft) : (anchorX + rightSpan);
    if (allyPaneTop < fieldH && allyPaneRight > 0 && wingAbsLeft < allyPaneRight + 6) {
      safeBot = Math.min(safeBot, allyPaneTop - 8);
    }
    if (targetPaneFound && targetPaneTop < fieldH && targetPaneLeft > 0 && wingAbsRight > targetPaneLeft - 6) {
      safeBot = Math.min(safeBot, targetPaneTop - 8);
    }
    if (paneTop < fieldH && (paneTop - 8 - wingBotExtent) >= (safeTop + wingTopExtent)) {
      safeBot = Math.min(safeBot, paneTop - 8);
    }

    let minAy = safeTop + wingTopExtent;
    let maxAy = safeBot - wingBotExtent;
    if (maxAy < minAy) {
      const fieldMaxAy = fieldH - 8 - wingBotExtent;
      if (fieldMaxAy >= minAy) {
        maxAy = Math.max(minAy, Math.min(fieldMaxAy, Math.round((safeBot + fieldH - 8) * 0.5 - wingBotExtent)));
      } else {
        minAy = Math.min(minAy, Math.max(8 + wingTopExtent, Math.round(fieldH * 0.44)));
        maxAy = minAy;
      }
    }
    const actorCy = aBox.top + aBox.height * 0.48;
    const anchorY = Math.round(Math.max(minAy, Math.min(maxAy, actorCy)));

    const nextActorKey = aBox.actorKey || 'player';
    if (uiState.lastActiveActorKey && nextActorKey !== uiState.lastActiveActorKey) {
      uiState.collapsed = false;
    }
    uiState.lastActiveActorKey = nextActorKey;
    uiState.lastFieldW = Math.round(fieldW);
    uiState.lastFieldH = Math.round(fieldH);
    uiState.skyTopY = Math.max(0, Math.round(intentMaxBottom));
    uiState.skyBotY = Math.max(uiState.skyTopY + 140, Math.round(Math.min(enemyMinTop, paneTop)));
    uiState.portraitRight = Math.round(aBox.right);
    uiState.allyPaneRight = Math.round(allyPaneRight);
    uiState.enemyLeftX = enemyMinLeft < fieldW ? Math.round(enemyMinLeft) : 0;
    uiState.hasMidCorridor = hasMidCorridor;
    uiState.corridorLeft = corridorLeft;
    uiState.corridorRight = corridorRight;
    uiState.corridorW = corridorW;
    uiState.hasVanguardActor = hasVanguardActor;
    uiState.partyLayout = partyLayout;
    uiState.partyDockTop = partyDockTop;
    uiState.targetPaneLeft = targetPaneLeft;
    uiState.targetPaneTop = targetPaneTop;
    uiState.obstacles = obstacles;

    uiState.lastAnchorX = anchorX;
    uiState.lastAnchorY = anchorY;
    uiState.rigEl.style.left = `${anchorX}px`;
    uiState.rigEl.style.top = `${anchorY}px`;
  }

  function ensureTopBarButtons() {
    const tools = document.querySelector('#battle-screen .cb-top-tools');
    if (!tools) return;
    const retreatBtn = document.getElementById('cb-btn-retreat');

    if (!document.getElementById('cb-btn-endturn-top')) {
      const endTop = document.createElement('button');
      endTop.type = 'button';
      endTop.id = 'cb-btn-endturn-top';
      endTop.className = 'cb-tool-btn prism-endturn-top';
      endTop.setAttribute('data-indie-tip', '结束本回合 [X]（最多留存 1 AP）');
      endTop.innerHTML = '结束回合 <span class="cb-kbd">X</span>';
      endTop.addEventListener('click', () => {
        triggerEndTurnAction();
      });
      if (retreatBtn && retreatBtn.parentNode === tools) {
        tools.insertBefore(endTop, retreatBtn);
      } else {
        tools.appendChild(endTop);
      }
    }

    if (!document.getElementById('cb-btn-prism-toggle')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'cb-btn-prism-toggle';
      btn.className = 'cb-tool-btn prism-toggle-btn' + (uiState.enabled ? ' active' : '');
      btn.setAttribute('data-indie-tip', '切换棱晶菜单 / 经典底栏');
      btn.textContent = uiState.enabled ? '◆ 棱晶翼' : '◇ 传统列';
      btn.addEventListener('click', () => {
        setEnabled(!uiState.enabled);
      });
      if (retreatBtn && retreatBtn.parentNode === tools) {
        tools.insertBefore(btn, retreatBtn);
      } else {
        tools.appendChild(btn);
      }
    }
  }

  function syncCasualModeBadge() {
    if (typeof document === 'undefined') return;
    const isCasual = isCasualModeActive();
    let badge = document.getElementById('cb-casual-mode-badge');
    if (!isCasual) {
      if (badge) {
        badge.classList.add('hidden');
        badge.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    ensurePrismExposureStyle();
    if (!badge) {
      const stageInfo = document.querySelector('#battle-screen .cb-stage-info');
      if (!stageInfo) return;
      badge = document.createElement('span');
      badge.id = 'cb-casual-mode-badge';
      badge.className = 'cb-casual-badge';
      badge.textContent = '✦ 休闲模式';
      badge.setAttribute('data-indie-tip', '休闲模式已开启：敌伤降低，每回合额外回蓝');
      const turnEl = document.getElementById('cb-turn');
      if (turnEl && turnEl.parentNode === stageInfo) {
        stageInfo.insertBefore(badge, turnEl.nextSibling);
      } else {
        stageInfo.appendChild(badge);
      }
    }
    badge.classList.remove('hidden');
    badge.removeAttribute('aria-hidden');
  }

  function ensureLogBar() {
    const bs = getBattleScreen();
    if (!bs) return null;
    const shell = bs.querySelector('.cb-shell');
    const forecast = document.getElementById('cb-forecast-bar');
    if (!shell || !forecast) return null;

    if (uiState.logBarEl && uiState.logBarEl.isConnected) return uiState.logBarEl;
    const existing = document.getElementById('cb-prism-log-bar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'cb-prism-log-bar';
    bar.className = 'cb-prism-log-bar';
    bar.innerHTML = `
      <div class="cb-plog-latest" id="cb-plog-latest">✦ 战斗推演就绪</div>
      <button type="button" class="cb-plog-toggle" id="cb-plog-toggle" data-indie-tip="展开/收起近期战报 [L]">战报 [L]</button>
      <div class="cb-plog-drawer hidden" id="cb-plog-drawer"></div>
    `;
    shell.insertBefore(bar, forecast);
    bar.querySelector('#cb-plog-toggle').addEventListener('click', () => toggleLogDrawer());
    uiState.logBarEl = bar;
    return bar;
  }

  function syncLogBar(battleOverride) {
    const bar = ensureLogBar();
    if (!bar) return;
    const b = battleOverride || getEngineBattle();
    const logs = b
      ? (Array.isArray(b.recentLogs) ? b.recentLogs : (Array.isArray(b.log) ? b.log : []))
      : [];
    const latestEl = bar.querySelector('#cb-plog-latest');
    const drawerEl = bar.querySelector('#cb-plog-drawer');
    const toggleBtn = bar.querySelector('#cb-plog-toggle');

    if (latestEl) {
      latestEl.innerHTML = logs.length
        ? logs[logs.length - 1]
        : '✦ 战斗推演就绪 · 悬停术式查看破招与预计伤害';
    }
    if (drawerEl) {
      drawerEl.classList.toggle('hidden', !uiState.logExpanded);
      if (uiState.logExpanded) {
        drawerEl.innerHTML = logs.length
          ? logs.slice().reverse().map(line => `<div class="cb-plog-row">${line}</div>`).join('')
          : '<div class="cb-plog-row">暂无战斗记录</div>';
      }
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', uiState.logExpanded);
      toggleBtn.textContent = uiState.logExpanded ? '收起 [L]' : '战报 [L]';
    }
  }

  function formatAvShortName(rawName, fallback) {
    const src = String(rawName == null ? '' : rawName).trim();
    if (!src) return fallback || '未知';
    const stripped = src
      .replace(/\s*(?:（[^）]*）|\([^)]*\)|「[^」]*」)\s*/g, '')
      .replace(/[·・\-—\s]+$/g, '')
      .trim();
    return stripped || src;
  }

  function formatAvSkillShortName(rawName) {
    const src = String(rawName == null ? '' : rawName).trim();
    if (!src) return '术式';
    const cleaned = src
      .replace(/^[❄️✦⚡◇◆]+\s*/u, '')
      .replace(/\s*(?:（[^）]*）|\([^)]*\)|「[^」]*」)\s*/g, '')
      .replace(/[·・\-—\s]+$/g, '')
      .trim();
    return cleaned || src;
  }

  function resolveAvSpriteId(item, battleState, pxApi) {
    if (!item) return '';
    if (item.side === 'player') {
      if (pxApi && typeof pxApi.resolvePlayerSpriteId === 'function') {
        try {
          const resolved = pxApi.resolvePlayerSpriteId(battleState, false);
          if (resolved) return resolved;
        } catch (e) {}
      }
      return item.spriteId || 'sylvia_silver';
    }
    if (item.side === 'ally') {
      const allies = battleState && Array.isArray(battleState.allies) ? battleState.allies : null;
      const allyObj = (allies && item.allyIdx != null && item.allyIdx >= 0) ? allies[item.allyIdx] : null;
      return item.spriteId || (allyObj && allyObj.spriteId) || 'reno';
    }
    if (item.side === 'enemy') {
      const enemies = battleState && Array.isArray(battleState.enemies) ? battleState.enemies : null;
      const enemyObj = (enemies && item.enemyIdx != null && item.enemyIdx >= 0) ? enemies[item.enemyIdx] : null;
      if (pxApi && typeof pxApi.resolveEnemySpriteId === 'function') {
        try {
          const resolved = pxApi.resolveEnemySpriteId(enemyObj || item.id || item.charId);
          if (resolved) return resolved;
        } catch (e) {}
      }
      return item.spriteId || (enemyObj && (enemyObj.spriteId || enemyObj.charId || enemyObj.id)) || item.charId || item.id || '';
    }
    return item.spriteId || '';
  }

  function syncAvRailTargetHighlight(targetIdx) {
    const listEl = (uiState.avListEl && uiState.avListEl.isConnected)
      ? uiState.avListEl
      : (typeof document !== 'undefined' ? document.getElementById('cb-av-list') : null);
    if (!listEl) return;
    listEl.querySelectorAll('.cb-av-row.enemy-row').forEach(row => {
      const eidx = Number(row.getAttribute('data-eidx'));
      const isTargeted = typeof targetIdx === 'number' && isFinite(targetIdx) && eidx === targetIdx;
      row.classList.toggle('is-targeted', isTargeted);
      row.setAttribute('aria-pressed', isTargeted ? 'true' : 'false');
    });
  }

  function selectAvEnemyTarget(eidx) {
    if (typeof eidx !== 'number' || !isFinite(eidx) || eidx < 0) return false;
    const bs = getBattleScreen();
    const card = bs ? bs.querySelector(`.cb-enemy-card[data-eidx="${eidx}"]`) : null;
    let triggered = false;
    if (card && !card.classList.contains('dead')) {
      card.click();
      triggered = true;
    } else if (global.CombatEngine && typeof global.CombatEngine.selectTarget === 'function') {
      triggered = !!global.CombatEngine.selectTarget(eidx);
    }
    if (triggered) {
      safeSfx('ui_tick', { gain: 0.65 });
      const latest = getEngineBattle();
      if (latest) {
        uiState.lastBattleState = latest;
        syncAvRailTargetHighlight(latest.targetIdx);
        if (uiState.hoveredSkillId) {
          syncAvForecast(uiState.hoveredSkillId, latest);
        }
      } else {
        syncAvRailTargetHighlight(eidx);
      }
    }
    return triggered;
  }

  function ensureAvRail(field) {
    if (typeof document === 'undefined') return null;
    const host = field || document.querySelector('#battle-screen .cb-arena-field');
    if (!host) return null;

    ensurePrismExposureStyle();

    if (uiState.avRailEl && uiState.avRailEl.isConnected && uiState.avRailEl.parentNode === host) {
      if (!uiState.avListEl || !uiState.avListEl.isConnected) {
        uiState.avListEl = uiState.avRailEl.querySelector('#cb-av-list');
      }
      if (!uiState.avForecastEl || !uiState.avForecastEl.isConnected) {
        uiState.avForecastEl = uiState.avRailEl.querySelector('#cb-av-forecast');
      }
      if (uiState.avListEl && uiState.avForecastEl) {
        return uiState.avRailEl;
      }
    }

    const existing = document.getElementById('cb-av-rail');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const rail = document.createElement('aside');
    rail.className = 'cb-av-rail';
    rail.id = 'cb-av-rail';
    rail.setAttribute('aria-label', '行动顺序条');
    rail.innerHTML = [
      '<div class="cb-av-list" id="cb-av-list"></div>',
      '<div class="cb-av-forecast" id="cb-av-forecast"></div>',
    ].join('');

    host.appendChild(rail);
    uiState.avRailEl = rail;
    uiState.avListEl = rail.querySelector('#cb-av-list');
    uiState.avForecastEl = rail.querySelector('#cb-av-forecast');
    uiState.lastAvSig = '';
    return rail;
  }

  function syncAvForecast(hoveredSkillId, battleState) {
    uiState.hoveredSkillId = hoveredSkillId || null;

    const forecastEl = (uiState.avForecastEl && uiState.avForecastEl.isConnected)
      ? uiState.avForecastEl
      : (typeof document !== 'undefined' ? document.getElementById('cb-av-forecast') : null);
    const listEl = (uiState.avListEl && uiState.avListEl.isConnected)
      ? uiState.avListEl
      : (typeof document !== 'undefined' ? document.getElementById('cb-av-list') : null);

    if (listEl) {
      listEl.querySelectorAll('.cb-av-row.flash-delay').forEach(el => {
        el.classList.remove('flash-delay');
      });
    }
    if (!forecastEl) return null;

    const resetForecast = () => {
      forecastEl.classList.remove('show', 'gold');
      forecastEl.textContent = '';
      return forecastEl;
    };

    if (!hoveredSkillId) {
      return resetForecast();
    }

    const state = battleState || uiState.lastBattleState || getEngineBattle();
    if (!state || state.over || !state.player) {
      return resetForecast();
    }

    const skills = Array.isArray(state.player.skills) ? state.player.skills : [];
    const skill = skills.find(sk => sk && sk.id === hoveredSkillId) || null;
    if (!skill) {
      return resetForecast();
    }

    const enemies = Array.isArray(state.enemies) ? state.enemies : [];
    const rawTargetIdx = typeof state.targetIdx === 'number' ? state.targetIdx : 0;
    let target = enemies[rawTargetIdx] || null;
    if (!target || target.alive === false || (typeof target.hp === 'number' && target.hp <= 0)) {
      target = enemies.find(e => e && e.alive !== false && (typeof e.hp !== 'number' || e.hp > 0)) || null;
    }
    const resolvedTargetIdx = target
      ? (typeof target.idx === 'number' ? target.idx : enemies.indexOf(target))
      : -1;

    const lockDamage = (skill.forecast && typeof skill.forecast.lockDamage === 'number')
      ? skill.forecast.lockDamage
      : (typeof skill.lockDamage === 'number' ? skill.lockDamage : 0);

    const targetLocks = target && typeof target.locks === 'number' ? target.locks : 0;
    const willBreakAll = !!(target && !target.broken && targetLocks > 0 && lockDamage >= targetLocks);

    if (willBreakAll) {
      const pushPctMap = (state.balance && state.balance.HSR_AV && state.balance.HSR_AV.pushPct) || {
        boss: 0.35,
        elite: 0.45,
        mob: 0.50,
      };
      const pushKey = target.boss ? 'boss' : ((Number(target.mhp) || 0) >= 220 ? 'elite' : 'mob');
      const pushPct = typeof pushPctMap[pushKey] === 'number' ? pushPctMap[pushKey] : 0.45;
      const baseAv = Number(target.baseAv) || 100;
      const curAv = (typeof target.av === 'number' && isFinite(target.av)) ? target.av : baseAv;
      const newAv = Math.round(curAv + baseAv * pushPct);
      const shortTarget = formatAvShortName(target.name, '敌方');

      forecastEl.classList.add('show', 'gold');
      forecastEl.textContent = `⚡ 击破再动 · ${shortTarget} → ${newAv}`;

      if (listEl && resolvedTargetIdx >= 0) {
        const firstEnemyRow = listEl.querySelector(`.cb-av-row.enemy-row[data-eidx="${resolvedTargetIdx}"]:not(.ghost)`)
          || listEl.querySelector(`.cb-av-row.enemy-row[data-eidx="${resolvedTargetIdx}"]`);
        if (firstEnemyRow) firstEnemyRow.classList.add('flash-delay');
      }
      return forecastEl;
    }

    if (lockDamage > 0) {
      const shortSkill = formatAvSkillShortName(skill.name || skill.id);
      forecastEl.classList.remove('gold');
      forecastEl.classList.add('show');
      forecastEl.textContent = `◇ ${shortSkill} · 碎锁 ${lockDamage}`;
      return forecastEl;
    }

    const engineSkillDef = (global.CombatEngine && global.CombatEngine.SKILLS && global.CombatEngine.SKILLS[skill.id]) || null;
    const selfAdvancePct = typeof skill.selfAdvancePct === 'number'
      ? skill.selfAdvancePct
      : (skill.forecast && typeof skill.forecast.selfAdvancePct === 'number'
        ? skill.forecast.selfAdvancePct
        : (engineSkillDef && typeof engineSkillDef.selfAdvancePct === 'number' ? engineSkillDef.selfAdvancePct : 0));

    if (selfAdvancePct > 0) {
      forecastEl.classList.remove('gold');
      forecastEl.classList.add('show');
      forecastEl.textContent = `✦ 疾步抢先 · 身法提前 ${Math.round(selfAdvancePct * 100)}%`;
      return forecastEl;
    }

    return resetForecast();
  }

  function syncAvRail(battleState, field) {
    const state = battleState || uiState.lastBattleState || getEngineBattle();
    if (state) uiState.lastBattleState = state;

    const rail = ensureAvRail(field);
    if (!rail || !uiState.avListEl || !uiState.avForecastEl) return null;

    const queue = state && Array.isArray(state.actionQueue) ? state.actionQueue : [];
    if (!state || queue.length === 0) {
      if (uiState.lastAvSig !== '__empty__') {
        uiState.avListEl.innerHTML = '';
        uiState.lastAvSig = '__empty__';
      }
      rail.classList.add('hidden');
      syncAvForecast(null, state);
      return rail;
    }

    rail.classList.remove('hidden');

    const hasVanguard = Array.isArray(state.allies) && state.allies.length > 0;
    rail.classList.toggle('is-vanguard-compact', hasVanguard);

    const maxRows = hasVanguard ? 3 : 4;
    const visibleQueue = queue.slice(0, maxRows);
    const pxApi = global.CombatPixelVFX || null;
    const stageId = state.stageId || state.id || '';
    const oneMoreActive = !!state.oneMoreActive;
    const pxReady = (pxApi && typeof pxApi.drawHeadCanvas === 'function') ? 1 : 0;

    const rowEntries = visibleQueue.map((item, idx) => {
      const side = item && item.side ? item.side : 'player';
      const spriteId = resolveAvSpriteId(item, state, pxApi);
      const avVal = Math.max(0, Math.round(Number(item && item.av) || 0));
      return {
        idx,
        side,
        spriteId,
        avVal,
        id: (item && item.id) || '',
        allyIdx: (item && item.allyIdx != null) ? Number(item.allyIdx) : -1,
        enemyIdx: (item && item.enemyIdx != null) ? Number(item.enemyIdx) : -1,
        fullName: (item && item.name) || (side === 'player' ? '希尔维亚' : side === 'ally' ? '友军' : '敌方'),
      };
    });

    const nextAvSig = [
      stageId,
      hasVanguard ? '1' : '0',
      oneMoreActive ? '1' : '0',
      pxReady,
      rowEntries.map(r => `${r.side}|${r.id}|${r.allyIdx}|${r.enemyIdx}|${r.avVal}|${r.spriteId}|${r.fullName}`).join(';'),
    ].join('::');

    if (nextAvSig !== uiState.lastAvSig || uiState.avListEl.children.length === 0) {
      uiState.lastAvSig = nextAvSig;
      uiState.avListEl.innerHTML = '';

      const seenUnits = new Set();
      rowEntries.forEach(entry => {
        const { idx, side, spriteId, avVal, allyIdx, enemyIdx, fullName, id } = entry;
        const unitKey = side === 'player'
          ? 'player'
          : (side === 'ally'
            ? `ally:${allyIdx >= 0 ? allyIdx : (id || '0')}`
            : `enemy:${enemyIdx >= 0 ? enemyIdx : (id || '0')}`);
        const isGhost = seenUnits.has(unitKey);
        seenUnits.add(unitKey);

        const isActing = idx === 0;
        const isOneMoreRow = oneMoreActive && side === 'player' && isActing && !isGhost;
        const shortName = formatAvShortName(fullName, side === 'player' ? '希尔维亚' : side === 'ally' ? '友军' : '敌方');

        const row = document.createElement('div');
        row.className = 'cb-av-row'
          + (side === 'enemy' ? ' enemy-row' : '')
          + (side === 'ally' ? ' ally-row' : '')
          + (isActing ? ' acting' : '')
          + (isGhost ? ' ghost' : '')
          + (isOneMoreRow ? ' flash-onemore' : '');
        row.setAttribute('data-side', side);
        if (side === 'enemy' && enemyIdx >= 0) {
          row.setAttribute('data-eidx', String(enemyIdx));
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            selectAvEnemyTarget(enemyIdx);
          });
          row.addEventListener('keydown', ev => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              selectAvEnemyTarget(enemyIdx);
            }
          });
        } else if (side === 'ally' && allyIdx >= 0) {
          row.setAttribute('data-aidx', String(allyIdx));
        }
        row.setAttribute('data-indie-tip', fullName);

        const inner = document.createElement('div');
        inner.className = 'cb-av-row-in';

        const portrait = document.createElement('div');
        portrait.className = 'cb-av-portrait';
        const canvas = document.createElement('canvas');
        canvas.className = 'cb-av-canvas';
        canvas.width = 34;
        canvas.height = 34;
        portrait.appendChild(canvas);

        let drawn = false;
        if (pxApi && typeof pxApi.drawHeadCanvas === 'function' && spriteId) {
          try {
            drawn = !!pxApi.drawHeadCanvas(canvas, spriteId, 34);
          } catch (e) {
            drawn = false;
          }
        }
        if (!drawn) {
          portrait.classList.add('is-fallback');
          canvas.style.display = 'none';
          const fallbackEl = document.createElement('span');
          fallbackEl.className = 'cb-av-fallback';
          fallbackEl.setAttribute('aria-hidden', 'true');
          fallbackEl.textContent = shortName.slice(0, 1) || '?';
          portrait.appendChild(fallbackEl);
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'cb-av-name';
        nameEl.textContent = shortName;

        const valEl = document.createElement('div');
        valEl.className = 'cb-av-val';
        valEl.textContent = String(avVal);

        inner.appendChild(portrait);
        inner.appendChild(nameEl);
        inner.appendChild(valEl);
        row.appendChild(inner);
        uiState.avListEl.appendChild(row);

        if (isOneMoreRow) {
          const eventStrip = document.createElement('div');
          eventStrip.className = 'cb-av-event-strip';
          eventStrip.textContent = '⚡ 击破再动 · 0';
          uiState.avListEl.appendChild(eventStrip);
        }
      });
    }

    syncAvRailTargetHighlight(state.targetIdx);
    if (uiState.hoveredSkillId) {
      syncAvForecast(uiState.hoveredSkillId, state);
    }

    return rail;
  }

  function ensurePrismExposureStyle() {
    if (typeof document === 'undefined' || document.getElementById('cb-prism-exp-inline-style')) return;
    const style = document.createElement('style');
    style.id = 'cb-prism-exp-inline-style';
    style.textContent = [
      '.cb-bl-tags-right{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;}',
      '.cb-bl-top:has(.cb-bl-art-wrap){align-items:center;}',
      '.cb-bl-name.has-art{display:inline-flex;align-items:center;gap:6px;line-height:1.15;}',
      '.cb-bl-art-wrap{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;flex-shrink:0;}',
      '.cb-bl-art-icon{width:20px;height:20px;object-fit:contain;display:block;flex-shrink:0;filter:drop-shadow(0 1px 3px rgba(14,43,120,0.28));transition:transform 0.14s ease,filter 0.16s ease;}',
      '.cb-blade.compact .cb-bl-art-wrap,.cb-blade.compact .cb-bl-art-icon{width:17px;height:17px;}',
      '.cb-blade:not(:disabled):hover .cb-bl-art-icon,.cb-blade-wrap.hovered .cb-blade:not(:disabled) .cb-bl-art-icon{filter:drop-shadow(0 0 6px rgba(217,243,255,0.82));}',
      '.cb-bl-exp{font-size:10px;font-weight:700;line-height:1.22;padding:1px 5px;white-space:nowrap;flex-shrink:0;letter-spacing:0.02em;}',
      '.cb-bl-exp.is-warn{color:#b41f35;background:rgba(201,42,62,0.13);border-left:2px solid #c92a3e;}',
      '.cb-bl-exp.is-safe{color:#0b6e76;background:rgba(15,139,146,0.11);border-left:2px solid #0f8b92;}',
      '.cb-blade:not(:disabled):hover .cb-bl-exp.is-warn,.cb-blade-wrap.hovered .cb-blade:not(:disabled) .cb-bl-exp.is-warn{color:#ffe082;background:rgba(255,209,128,0.22);border-left-color:#ffd180;}',
      '.cb-blade:not(:disabled):hover .cb-bl-exp.is-safe,.cb-blade-wrap.hovered .cb-blade:not(:disabled) .cb-bl-exp.is-safe{color:#c4f9ff;background:rgba(155,244,255,0.18);border-left-color:#9bf4ff;}',
      /* V3.2 skill blade rhythm beat micro-badges (sharp flat accent bar, zero nested rounded box) */
      '.cb-bl-beat{font-size:10px;font-weight:700;line-height:1.2;padding:1px 5px;white-space:nowrap;flex-shrink:0;letter-spacing:0.02em;}',
      '.cb-bl-beat.beat-instant{color:#0b6e76;background:rgba(14,165,233,0.10);border-left:2px solid #38bdf8;}',
      '.cb-bl-beat.beat-b1{color:#1246c4;background:rgba(22,88,235,0.10);border-left:2px solid #1658eb;}',
      '.cb-bl-beat.beat-b2{color:#0c4a9e;background:rgba(14,165,233,0.15);border-left:2px solid #0284c7;}',
      '.cb-bl-beat.beat-b3{color:#8c641e;background:rgba(212,169,74,0.18);border-left:2px solid #c9a04a;}',
      '.cb-bl-beat.beat-aoe{color:#1d4ed8;background:rgba(59,130,246,0.14);border-left:2px solid #2563eb;}',
      '.cb-blade.compact .cb-bl-beat,.cb-prism-rig.two-col-blades.narrow-desktop .cb-bl-beat{font-size:9.5px;padding:1px 4px;letter-spacing:0;}',
      '.cb-blade:not(:disabled):hover .cb-bl-beat,.cb-blade-wrap.hovered .cb-blade:not(:disabled) .cb-bl-beat{color:#d9f5ff;background:rgba(155,244,255,0.18);border-left-color:#9bf4ff;}',
      '.cb-blade:not(:disabled):hover .cb-bl-beat.beat-b3,.cb-blade-wrap.hovered .cb-blade:not(:disabled) .cb-bl-beat.beat-b3{color:#fff1be;background:rgba(245,214,125,0.22);border-left-color:#fde68a;}',
      /* V3.2 top-bar casual mode soft micro-badge (hidden by default, zero footprint) */
      '.cb-casual-badge{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:1px 7px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#0e6c78;background:linear-gradient(90deg,rgba(186,230,253,0.42),rgba(224,242,254,0.22));border-left:2px solid #38bdf8;white-space:nowrap;flex-shrink:0;line-height:1.4;}',
      '.cb-casual-badge.hidden{display:none!important;}',
      /* V3.2 timing-ring / async phase unobstructed temporary dissolve */
      '.cb-prism-rig.dissolved.is-timing-dissolved{opacity:0;pointer-events:none;transition:opacity 0.14s ease;}',
      '.cb-prism-rig.dissolved.is-timing-dissolved *{pointer-events:none!important;}',
      /* Zero-specificity fallbacks for direct-press amp pips, tier themes (ice-cyan -> royal blue -> champagne gold), and pulse */
      ':where(.cb-amp-meta){display:inline-flex;align-items:center;gap:6px;}',
      ':where(.cb-amp-pips){display:inline-flex;align-items:center;gap:4px;vertical-align:middle;line-height:1;flex-shrink:0;}',
      ':where(.cb-amp-pip){display:inline-block;width:8px;height:8px;background:rgba(22,88,235,0.20);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);transition:background 0.16s ease,transform 0.16s ease,filter 0.16s ease;}',
      ':where(.cb-amp-pip.is-locked){opacity:0.32;}',
      ':where(.cb-amp-pip.on,.cb-amp-pip.lit-t1){background:linear-gradient(135deg,#BAE6FD,#0EA5E9);transform:scale(1.16);filter:drop-shadow(0 0 3px rgba(56,189,248,0.68));}',
      ':where(.cb-amp-pip.lit-t2){background:linear-gradient(135deg,#60A5FA,#1658EB);transform:scale(1.20);filter:drop-shadow(0 0 4px rgba(22,88,235,0.75));}',
      ':where(.cb-amp-pip.gold,.cb-amp-pip.lit-t3){background:linear-gradient(135deg,#FFF3C4,#D4A94A);transform:scale(1.26);filter:drop-shadow(0 0 5px rgba(212,169,74,0.88));}',
      ':where(.cb-amp-val){font-family:var(--pr-mono,monospace);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--pr-ink-mid,#223456);white-space:nowrap;}',
      ':where(.cb-pwing.amp-t1){box-shadow:inset 0 0 0 1px rgba(56,189,248,0.52);}',
      ':where(.cb-pwing.amp-t1)::after{background:linear-gradient(180deg,#BAE6FD 0%,#38BDF8 50%,#0284C7 100%);}',
      ':where(.cb-pwing.amp-t1 .cb-amp-val,.cb-pwing.amp-t1 .cb-pw-en){color:#0284C7;}',
      ':where(.cb-pwing.amp-t2){box-shadow:inset 0 0 0 1px rgba(22,88,235,0.56);}',
      ':where(.cb-pwing.amp-t2)::after{background:linear-gradient(180deg,#93C5FD 0%,#1658EB 52%,#0E2B78 100%);}',
      ':where(.cb-pwing.amp-t2 .cb-amp-val,.cb-pwing.amp-t2 .cb-pw-en){color:#1658EB;}',
      ':where(.cb-pwing.amp-t3){box-shadow:inset 0 0 0 1px rgba(229,192,110,0.78);}',
      ':where(.cb-pwing.amp-t3)::after{background:linear-gradient(180deg,#FFF1B8 0%,#E5C06E 48%,#B38A3E 100%);}',
      ':where(.cb-pwing.amp-t3 .cb-amp-val,.cb-pwing.amp-t3 .cb-pw-en){color:#9A7228;}',
      ':where(.cb-pwing:not(.hero-prism):not(:disabled):hover .cb-amp-pip){background:rgba(217,243,255,0.34);}',
      ':where(.cb-pwing:not(.hero-prism):not(:disabled):hover .cb-amp-pip.lit-t1){background:linear-gradient(135deg,#E0F7FF,#38BDF8);}',
      ':where(.cb-pwing:not(.hero-prism):not(:disabled):hover .cb-amp-pip.lit-t2){background:linear-gradient(135deg,#DBEAFE,#93C5FD);}',
      ':where(.cb-pwing:not(.hero-prism):not(:disabled):hover .cb-amp-pip.lit-t3){background:linear-gradient(135deg,#FFF7D6,#E5C06E);}',
      ':where(.cb-pwing:not(.hero-prism):not(:disabled):hover .cb-amp-val){color:rgba(232,245,255,0.96);}',
      '#cb-pw-amp.has-mana-cycle #cb-pw-amp-sub.cb-amp-meta{display:flex;width:100%;align-items:center;gap:5px;min-width:0;}',
      '#cb-pw-amp.has-mana-cycle #cb-pw-amp-pips{margin-right:0;gap:3px;}',
      '.cb-amp-cycle{display:inline-flex;align-items:center;margin-left:auto;font-size:10px;font-weight:700;line-height:1.2;padding:1px 5px;white-space:nowrap;flex-shrink:0;letter-spacing:0.02em;color:#0E4FD6;background:rgba(22,88,235,0.10);border-left:2px solid #1658EB;}',
      '#cb-pw-amp.amp-t1 .cb-amp-cycle{color:#0369A1;background:rgba(14,165,233,0.13);border-left-color:#0EA5E9;}',
      '#cb-pw-amp.amp-t2 .cb-amp-cycle{color:#1246C4;background:rgba(22,88,235,0.14);border-left-color:#1658EB;}',
      '#cb-pw-amp.amp-t3 .cb-amp-cycle{color:#8C641E;background:rgba(212,169,74,0.18);border-left-color:#C9A04A;}',
      '#cb-pw-amp.amp-t0:not(:disabled):hover .cb-amp-cycle,#cb-pw-amp.amp-t1:not(:disabled):hover .cb-amp-cycle,#cb-pw-amp.amp-t2:not(:disabled):hover .cb-amp-cycle,.cb-pwing-wrap.hovered #cb-pw-amp.amp-t0:not(:disabled) .cb-amp-cycle,.cb-pwing-wrap.hovered #cb-pw-amp.amp-t1:not(:disabled) .cb-amp-cycle,.cb-pwing-wrap.hovered #cb-pw-amp.amp-t2:not(:disabled) .cb-amp-cycle{color:#D9F5FF;background:rgba(155,244,255,0.18);border-left-color:#9BF4FF;}',
      '#cb-pw-amp.amp-t3:not(:disabled):hover .cb-amp-cycle,.cb-pwing-wrap.hovered #cb-pw-amp.amp-t3:not(:disabled) .cb-amp-cycle{color:#FFF4CE;background:rgba(245,214,125,0.22);border-left-color:#F5D67D;}',
      '.cb-prism-rig.compact-multi #cb-pw-amp.has-mana-cycle #cb-pw-amp-sub.cb-amp-meta,.cb-prism-rig.narrow-desktop #cb-pw-amp.has-mana-cycle #cb-pw-amp-sub.cb-amp-meta{gap:4px;}',
      '.cb-prism-rig.compact-multi #cb-pw-amp.has-mana-cycle #cb-pw-amp-pips .cb-amp-pip,.cb-prism-rig.narrow-desktop #cb-pw-amp.has-mana-cycle #cb-pw-amp-pips .cb-amp-pip{width:6.5px;height:6.5px;}',
      '.cb-prism-rig.compact-multi #cb-pw-amp.has-mana-cycle .cb-amp-val,.cb-prism-rig.narrow-desktop #cb-pw-amp.has-mana-cycle .cb-amp-val{font-size:10px;min-width:0;overflow:hidden;text-overflow:ellipsis;}',
      '.cb-prism-rig.compact-multi #cb-pw-amp.has-mana-cycle .cb-amp-cycle,.cb-prism-rig.narrow-desktop #cb-pw-amp.has-mana-cycle .cb-amp-cycle{font-size:9.5px;padding:1px 4px;letter-spacing:0;}',
      ':where(.cb-mini-key){display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;flex-shrink:0;background:rgba(22,88,235,0.14);color:var(--pr-sapphire,#1658eb);font-family:var(--pr-mono,monospace);font-size:10.5px;font-weight:800;clip-path:polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%);}',
      ':where(.cb-amp-pips-mini){gap:3px;}',
      ':where(.cb-amp-pips-mini .cb-amp-pip){width:6.5px;height:6.5px;}',
      ':where(.cb-amp-mini-val){font-variant-numeric:tabular-nums;white-space:nowrap;}',
      ':where(.cb-spine-btn.amp-mini.amp-t1){background:linear-gradient(108deg,#7DD3FC 0%,#0EA5E9 52%,#0284C7 100%);color:#FFFFFF;}',
      ':where(.cb-spine-btn.amp-mini.amp-t2){background:linear-gradient(108deg,#2E77F8 0%,#1658EB 52%,#0B256E 100%);color:#EEF6FF;}',
      ':where(.cb-spine-btn.amp-mini.amp-t3){background:linear-gradient(112deg,#FFF3CE 0%,#E7C675 46%,#C9A04A 100%);color:#102044;}',
      ':where(.cb-spine-btn.amp-mini.amp-t1 .cb-mini-key,.cb-spine-btn.amp-mini.amp-t2 .cb-mini-key,.cb-spine-btn.amp-mini:hover .cb-mini-key){background:rgba(255,255,255,0.24);color:#FFFFFF;}',
      ':where(.cb-spine-btn.amp-mini.amp-t3 .cb-mini-key){background:rgba(16,32,68,0.14);color:#102044;}',
      ':where(.cb-spine-btn.amp-mini.amp-t1 .cb-amp-pip,.cb-spine-btn.amp-mini.amp-t2 .cb-amp-pip,.cb-spine-btn.amp-mini:hover .cb-amp-pip){background:rgba(255,255,255,0.30);}',
      ':where(.cb-spine-btn.amp-mini.amp-t1 .cb-amp-pip.on,.cb-spine-btn.amp-mini.amp-t2 .cb-amp-pip.on){background:#FFFFFF;filter:drop-shadow(0 0 3px rgba(255,255,255,0.85));}',
      ':where(.cb-spine-btn.amp-mini.amp-t3 .cb-amp-pip.on){background:linear-gradient(135deg,#FFFFFF,#7C5310);filter:drop-shadow(0 0 3px rgba(255,248,220,0.90));}',
      ':where(.cb-av-fallback){display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:var(--pr-serif,serif);font-size:15px;font-weight:800;line-height:1;color:var(--pr-sapphire-deep,#0e2b78);user-select:none;}',
      ':where(.cb-av-row.enemy-row .cb-av-fallback){color:#9E1B3A;}',
      ':where(.cb-av-row.ally-row .cb-av-fallback){color:#8B5B1E;}',
      '.cb-prism-rig.mode-items .cb-prism-cascade{display:block;opacity:1;transform:none;animation:prCascadeSnap 0.14s var(--pr-ease) both;}',
      '.cb-prism-rig.mode-items #cb-pw-amp-mini{display:none!important;}',
      '.cb-pwing.needs-endturn::before{background:var(--pr-caustic),linear-gradient(112deg,rgba(255,252,242,0.97) 0%,rgba(236,246,255,0.95) 56%,rgba(220,238,255,0.93) 100%);box-shadow:inset 0 0 0 1px rgba(212,169,74,0.72);}',
      '.cb-pwing.needs-endturn::after{background:linear-gradient(180deg,#FFF3CE 0%,#E5C06E 48%,#1658EB 100%);}',
      '.cb-pwing.needs-endturn .cb-pw-key{background:rgba(212,169,74,0.22);color:#8C641E;}',
      '.cb-pwing.needs-endturn .cb-pw-en{color:#8C641E;font-weight:800;}',
      '.cb-blade.is-placeholder,.cb-blade.is-placeholder:disabled{opacity:0.96;cursor:default;min-height:58px;height:auto;padding-top:8px;padding-bottom:8px;}',
      '.cb-blade.is-placeholder::before{background:linear-gradient(154deg,rgba(255,255,255,0.96) 0%,rgba(235,244,255,0.93) 100%);box-shadow:inset 0 0 0 1px rgba(96,146,224,0.34);}',
      '.cb-blade.is-placeholder::after{background:linear-gradient(180deg,#CBDDF5 0%,#7EA6DC 55%,#4A72B0 100%);}',
      '.cb-blade.is-placeholder .cb-bl-key{background:rgba(22,88,235,0.08);color:#5272A0;}',
      '.cb-blade.is-placeholder .cb-bl-name{color:#16294D;}',
      '.cb-blade.is-placeholder .cb-bl-meta{white-space:normal;line-height:1.38;overflow:visible;text-overflow:clip;color:#4A6288;}',
      '.cb-blade-wrap.is-placeholder:hover,.cb-blade-wrap.is-placeholder.hovered{filter:drop-shadow(0 8px 20px rgba(8,22,68,0.34));}',
      ':where(.cb-prism-rig.anchor-flip-left .cb-prism-svg){transform-origin:42px 250px;transform:scaleX(-1);}',
      ':where(.cb-prism-rig.anchor-flip-left .cb-pwing-wrap[data-wing="0"]){left:auto;right:52px;--rot:4.0deg;}',
      ':where(.cb-prism-rig.anchor-flip-left .cb-pwing-wrap[data-wing="1"]){left:auto;right:82px;--rot:1.3deg;}',
      ':where(.cb-prism-rig.anchor-flip-left .cb-pwing-wrap[data-wing="2"]){left:auto;right:76px;--rot:-1.7deg;}',
      ':where(.cb-prism-rig.anchor-flip-left .cb-pwing-wrap[data-wing="3"]){left:auto;right:46px;--rot:-4.4deg;}',
      ':where(.cb-prism-rig.compact-multi.anchor-flip-left .cb-pwing-wrap[data-wing="0"]){left:auto;right:26px;--rot:3.2deg;}',
      ':where(.cb-prism-rig.compact-multi.anchor-flip-left .cb-pwing-wrap[data-wing="1"]){left:auto;right:38px;--rot:1.0deg;}',
      ':where(.cb-prism-rig.compact-multi.anchor-flip-left .cb-pwing-wrap[data-wing="2"]){left:auto;right:34px;--rot:-1.2deg;}',
      ':where(.cb-prism-rig.compact-multi.anchor-flip-left .cb-pwing-wrap[data-wing="3"]){left:auto;right:24px;--rot:-3.4deg;}',
      '@keyframes cbAmpPulse{0%{filter:brightness(1);transform:scale(1);}35%{filter:brightness(1.20) drop-shadow(0 0 10px rgba(56,189,248,0.62));transform:scale(1.032);}100%{filter:brightness(1);transform:scale(1);}}',
      '@keyframes cbAmpPulseGold{0%{filter:brightness(1);transform:scale(1);}35%{filter:brightness(1.24) drop-shadow(0 0 14px rgba(229,192,110,0.85));transform:scale(1.04);}100%{filter:brightness(1);transform:scale(1);}}',
      '@keyframes cbCastFlash{0%{opacity:1;}28%{opacity:0.84;}100%{opacity:1;}}',
      ':where(.is-amp-pulse){animation:cbAmpPulse 0.34s cubic-bezier(0.22,1,0.36,1);}',
      ':where(.amp-t3.is-amp-pulse){animation:cbAmpPulseGold 0.36s cubic-bezier(0.22,1,0.36,1);}',
      ':where(#cb-prism-blade-list.is-cast-flash){animation:cbCastFlash 0.16s ease-out;}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  }

  function renderAmpPipsHtml(ampInfo, isMini) {
    const t = ampInfo && ampInfo.enabled ? ampInfo.tier : 0;
    const maxCap = ampInfo ? ampInfo.maxAmpCap : MAX_AMP_PCT;
    const pipThresholds = [0.20, 0.40, 0.60];
    const pips = pipThresholds.map((thr, idx) => {
      const lvl = idx + 1;
      const locked = !ampInfo || !ampInfo.enabled || thr > maxCap + 1e-4;
      let cls = 'cb-amp-pip';
      if (locked) {
        cls += ' is-locked';
      } else if (lvl <= t) {
        cls += ' on lit';
        if (t >= 3) cls += ' gold lit-t3';
        else if (t === 2) cls += ' lit-t2';
        else cls += ' lit-t1';
      }
      return `<span class="${cls}"></span>`;
    }).join('');
    if (isMini) {
      return `<span class="cb-amp-pips cb-amp-pips-mini" aria-hidden="true">${pips}</span>`;
    }
    return `<span class="cb-amp-pips" id="cb-pw-amp-pips" aria-hidden="true">${pips}</span>`;
  }

  function formatAmpValText(ampInfo, compactCycle) {
    if (!ampInfo || !ampInfo.enabled) return '不可增幅';
    if (compactCycle) {
      if (ampInfo.pctInt <= 0) return '+0%';
      return ampInfo.extraMp > 0 ? `+${ampInfo.pctInt}%·${ampInfo.extraMp}MP` : `+${ampInfo.pctInt}%`;
    }
    if (ampInfo.pctInt <= 0) return '+0% · 0 MP';
    const mpStr = ampInfo.extraMp > 0 ? `+${ampInfo.extraMp} MP` : '0 MP';
    return `+${ampInfo.pctInt}% · ${mpStr}`;
  }

  function buildRigDOM(field) {
    if (uiState.rigEl && uiState.rigEl.isConnected) return uiState.rigEl;

    ensurePrismExposureStyle();

    const existing = document.getElementById('cb-prism-rig');
    if (existing) existing.remove();

    const nav = document.createElement('nav');
    nav.id = 'cb-prism-rig';
    nav.className = 'cb-prism-rig mode-root';
    nav.setAttribute('aria-label', '战斗棱晶指令翼');

    nav.innerHTML = `
      <svg class="cb-prism-svg" id="cb-prism-svg" viewBox="-42 -250 470 500" aria-hidden="true"></svg>
      <div class="cb-prism-root" id="cb-prism-root">
        <div class="cb-pwing-wrap" data-wing="0">
          <button type="button" class="cb-pwing cb-prism-wing hero-prism" id="cb-pw-magic">
            <span class="cb-pw-key">W</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">施放技能</span>
                <span class="cb-pw-en">SKILLS</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-magic-sub">展开攻守术式</span>
            </div>
            <span class="cb-pw-arrow">▸</span>
          </button>
        </div>

        <div class="cb-pwing-wrap" data-wing="1">
          <button type="button" class="cb-pwing cb-prism-wing amp-t0" id="cb-pw-amp" data-indie-tip="左键/E 升档 · 右键/Shift+E 降档">
            <span class="cb-pw-key">E</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">魔力增幅</span>
                <span class="cb-pw-en" id="cb-pw-amp-en">1.00×</span>
              </div>
              <span class="cb-pw-sub cb-amp-meta" id="cb-pw-amp-sub"><span class="cb-amp-pips" id="cb-pw-amp-pips" aria-hidden="true"><span class="cb-amp-pip"></span><span class="cb-amp-pip"></span><span class="cb-amp-pip"></span></span><span class="cb-amp-val" id="cb-pw-amp-val">+0% · 0 MP</span></span>
            </div>
          </button>
        </div>

        <div class="cb-pwing-wrap" data-wing="2">
          <button type="button" class="cb-pwing cb-prism-wing" id="cb-pw-items">
            <span class="cb-pw-key">A</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">使用道具</span>
                <span class="cb-pw-en">ITEMS</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-items-sub">暂无战斗道具 · 后续开放</span>
            </div>
            <span class="cb-pw-arrow">▸</span>
          </button>
        </div>

        <div class="cb-pwing-wrap" data-wing="3">
          <button type="button" class="cb-pwing cb-prism-wing" id="cb-pw-endturn">
            <span class="cb-pw-key">D</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">结束回合</span>
                <span class="cb-pw-en">END TURN</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-endturn-sub">流转敌方回合 · 可留存 1 AP</span>
            </div>
          </button>
        </div>
      </div>

      <div class="cb-prism-cascade" id="cb-prism-cascade">
        <div class="cb-cascade-spine" id="cb-cascade-spine">
          <button type="button" class="cb-spine-btn" id="cb-pw-back">← 返回 [ESC]</button>
          <button type="button" class="cb-spine-btn amp-mini amp-t0" id="cb-pw-amp-mini" data-indie-tip="左键/E 升档 · 右键降档"><span class="cb-mini-key">E</span> <span class="cb-amp-pips cb-amp-pips-mini" aria-hidden="true"><span class="cb-amp-pip"></span><span class="cb-amp-pip"></span><span class="cb-amp-pip"></span></span><span class="cb-amp-mini-val" id="cb-pw-amp-mini-val">增幅 +0%</span></button>
        </div>
        <div id="cb-prism-blade-list" class="cb-prism-blade-list"></div>
        <div id="cb-prism-amp-panel" class="cb-prism-amp-panel hidden" hidden aria-hidden="true" style="display:none"></div>
      </div>

      <button type="button" class="cb-prism-hub-toggle" id="cb-pw-hub-toggle" aria-label="收起战斗菜单" aria-expanded="true" data-indie-tip="收起战斗菜单"></button>
    `;

    field.appendChild(nav);
    uiState.rigEl = nav;
    uiState.svgEl = nav.querySelector('#cb-prism-svg');
    uiState.hubToggleEl = nav.querySelector('#cb-pw-hub-toggle');
    uiState.cascadeListEl = nav.querySelector('#cb-prism-blade-list');
    uiState.ampPanelEl = nav.querySelector('#cb-prism-amp-panel');
    uiState.spineEl = nav.querySelector('#cb-cascade-spine');

    if (uiState.hubToggleEl) {
      uiState.hubToggleEl.addEventListener('click', ev => {
        ev.stopPropagation();
        if (shouldHardDissolve() || isTimingOrAsyncDissolved()) return;
        cancelDissolve();
        toggleCollapsed();
      });
    }

    nav.querySelectorAll('.cb-pwing-wrap').forEach(wrap => {
      const idx = Number(wrap.getAttribute('data-wing'));
      wrap.addEventListener('mouseenter', () => {
        uiState.hoveredWingIdx = idx;
        renderCurrentSvg();
      });
      wrap.addEventListener('mouseleave', () => {
        if (uiState.hoveredWingIdx === idx) uiState.hoveredWingIdx = null;
        renderCurrentSvg();
      });
    });

    const ampWingBtn = nav.querySelector('#cb-pw-amp');
    const ampMiniBtn = nav.querySelector('#cb-pw-amp-mini');

    nav.querySelector('#cb-pw-magic').addEventListener('click', () => { cancelDissolve(); openSkills(); });
    ampWingBtn.addEventListener('click', () => { cancelDissolve(); cycleAmp(1); });
    ampWingBtn.addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); cancelDissolve(); cycleAmp(-1); });
    ampWingBtn.addEventListener('wheel', onAmpWheel, { passive: false });
    nav.querySelector('#cb-pw-items').addEventListener('click', () => { cancelDissolve(); openItems(); });
    nav.querySelector('#cb-pw-endturn').addEventListener('click', () => { triggerEndTurnAction(); });
    nav.querySelector('#cb-pw-back').addEventListener('click', () => { cancelDissolve(); closeCascade(); });
    ampMiniBtn.addEventListener('mouseenter', () => {
      uiState.hoveringAmpMini = true;
      cancelPendingHoverClear();
      if (uiState.menuMode === 'skills' && uiState.lastHoveredSkillId) {
        const sid = uiState.lastHoveredSkillId;
        const stillInCascade = uiState.currentItems.some(it => it && it.kind === 'skill' && it.skillId === sid);
        if (stillInCascade && uiState.hoveredSkillId !== sid) {
          applySkillHoverPreviewNow(sid, uiState.lastBattleState || getEngineBattle());
        }
      }
    });
    ampMiniBtn.addEventListener('mouseleave', ev => {
      uiState.hoveringAmpMini = false;
      const nextEl = ev && ev.relatedTarget;
      if (nextEl && nextEl.closest && nextEl.closest('.cb-blade, #cb-pw-amp-mini')) return;
      scheduleHoverLeaveClear(uiState.hoveredSkillId);
    });
    ampMiniBtn.addEventListener('click', () => { cancelDissolve(); cycleAmp(1, { preserveLastHover: true }); });
    ampMiniBtn.addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); cancelDissolve(); cycleAmp(-1, { preserveLastHover: true }); });
    ampMiniBtn.addEventListener('wheel', ev => onAmpWheel(ev, { preserveLastHover: true }), { passive: false });

    return nav;
  }

  function renderCurrentSvg() {
    if (!uiState.rigEl) return;
    if (uiState.menuMode === 'root') {
      const rootTips = uiState.compactMulti && uiState.narrowDesktop
        ? [
          { tipX: 30, tipY: -76, elbowX: 16, elbowY: -48, hero: true },
          { tipX: 42, tipY: -15, elbowX: 22, elbowY: -10, hero: false },
          { tipX: 38, tipY: 45,  elbowX: 20, elbowY: 28,  hero: false },
          { tipX: 28, tipY: 105, elbowX: 16, elbowY: 66,  hero: false },
        ]
        : uiState.compactMulti
          ? [
            { tipX: 30, tipY: -90, elbowX: 16, elbowY: -58, hero: true },
            { tipX: 42, tipY: -16, elbowX: 22, elbowY: -10, hero: false },
            { tipX: 38, tipY: 58,  elbowX: 20, elbowY: 36,  hero: false },
            { tipX: 28, tipY: 128, elbowX: 16, elbowY: 82,  hero: false },
          ]
          : [
            { tipX: 56, tipY: -96, elbowX: 28, elbowY: -62, hero: true },
            { tipX: 86, tipY: -18, elbowX: 44, elbowY: -12, hero: false },
            { tipX: 80, tipY: 60,  elbowX: 42, elbowY: 36,  hero: false },
            { tipX: 50, tipY: 134, elbowX: 26, elbowY: 86,  hero: false },
          ];
      renderSvgHairlines(rootTips, uiState.hoveredWingIdx);
    } else {
      const { coords } = computeBladeGeometry(uiState.currentItems.length);
      const hairTargets = [];
      coords.forEach((g, idx) => {
        if (g.showHairline !== false) {
          hairTargets.push({ origIdx: idx, tipX: g.tipX, tipY: g.tipY, elbowX: g.elbowX, elbowY: g.elbowY, hero: false });
        }
      });
      renderSvgHairlines(hairTargets, uiState.hoveredBladeIdx);
    }
  }

  function buildItemsSignature(mode, items) {
    return `${mode}|${uiState.lastActiveActorKey || 'player'}|${uiState.anchorFlipLeft ? 1 : 0}|${uiState.guardSplitIdx}|${isGauntletOffMode() ? 1 : 0}|${uiState.twoColBlades ? 1 : 0}|${uiState.lastFieldW}x${uiState.lastFieldH}|${uiState.lastAnchorX},${uiState.lastAnchorY}|${uiState.portraitRight}:${uiState.allyPaneRight}:${uiState.skyTopY}:${uiState.skyBotY}:${uiState.enemyLeftX}|${uiState.compactMulti ? 1 : 0}|${uiState.narrowDesktop ? 1 : 0}|${uiState.shortViewport ? 1 : 0}|` + items.map((it, idx) =>
      `${idx}:${it.key}:${it.slotIdx != null ? it.slotIdx : ''}:${it.skillId || ''}:${it.name || ''}:${it.iconHtml ? 1 : 0}:${it.pathLabel || ''}:${it.beatKind || ''}:${it.beatLabel || ''}:${it.cost}:${it.foot || it.desc || ''}:${it.oppLabel || ''}:${it.expKind || ''}:${it.expText || ''}:${it.isGuard ? 1 : 0}:${it.isPlaceholder ? 1 : 0}:${it.disabled ? 1 : 0}`
    ).join('||') + `|${uiState.partyLayout || ''}:${Math.round(uiState.partyDockTop || 0)}:${Math.round(uiState.targetPaneLeft || 0)}:${Math.round(uiState.targetPaneTop || 0)}`;
  }

  function canPatchExistingBlades(listItems) {
    if (!uiState.cascadeListEl) return false;
    const wraps = uiState.cascadeListEl.children;
    if (wraps.length !== listItems.length) return false;
    for (let i = 0; i < listItems.length; i++) {
      const wrap = wraps[i];
      if (!wrap || wrap.getAttribute('data-prism-mode') !== uiState.menuMode) return false;
      const btn = wrap.querySelector('.cb-blade');
      if (!btn) return false;
      if ((btn.getAttribute('data-sk') || '') !== (listItems[i].skillId || '')) return false;
      if (btn.getAttribute('data-prism-idx') !== String(i)) return false;
    }
    return true;
  }

  function buildBladeRightTagsHtml(item) {
    const expHtml = item.expKind === 'warn'
      ? `<span class="cb-bl-exp is-warn" data-indie-tip="施放将增加暴露度">${escapeHtml(item.expText)}</span>`
      : (item.expKind === 'safe'
        ? `<span class="cb-bl-exp is-safe" data-indie-tip="${escapeHtml(item.expText || '隐蔽安全')}">隐蔽</span>`
        : '');
    const beatKind = item.beatKind || '';
    const beatHtml = item.beatLabel
      ? `<span class="cb-bl-beat${beatKind ? ` beat-${escapeHtml(beatKind)}` : ''}" data-indie-tip="${escapeHtml(item.beatLabel === '瞬发' ? '瞬发，无需蓄拍' : `命中节奏：${item.beatLabel}`)}">${escapeHtml(item.beatLabel)}</span>`
      : '';
    const showPath = !expHtml && !!item.pathLabel && (!beatHtml || !uiState.twoColBlades);
    const badgeHtml = item.oppLabel
      ? `<span class="cb-bl-tag opp">${escapeHtml(item.oppLabel)}</span>`
      : (showPath ? `<span class="cb-bl-tag">◆${escapeHtml(item.pathLabel)}</span>` : '');
    return {
      innerHtml: expHtml + beatHtml + badgeHtml,
      key: `${item.expKind || ''}|${item.expText || ''}|${beatKind}|${item.beatLabel || ''}|${item.oppLabel || ''}|${showPath ? item.pathLabel : ''}`,
    };
  }

  function patchBladeElement(wrap, btn, item, g, idx) {
    const rotStr = String(g.rot);
    const isPlaceholder = !!item.isPlaceholder;
    const isHovered = !isPlaceholder && uiState.hoveredBladeIdx === idx;
    wrap.setAttribute('data-prism-mode', uiState.menuMode);
    wrap.dataset.rot = rotStr;
    wrap.style.left = `${g.left}px`;
    wrap.style.top = `${g.top}px`;
    wrap.classList.toggle('is-placeholder', isPlaceholder);
    wrap.classList.toggle('is-guard', !!item.isGuard);
    wrap.classList.toggle('hovered', isHovered);
    wrap.style.transform = isHovered
      ? `translateX(0) rotate(${rotStr}deg) scale(1.015)`
      : `rotate(${rotStr}deg)`;

    const expCls = item.expKind === 'warn' ? ' is-exp-warn' : (item.expKind === 'safe' ? ' is-exp-safe' : '');
    btn.className = 'cb-blade'
      + (g.compact ? ' compact' : '')
      + (item.oppLabel ? ' opp-ready' : '')
      + (item.isGuard ? ' is-guard' : '')
      + (isPlaceholder ? ' is-placeholder' : '')
      + expCls;
    btn.disabled = !!item.disabled || isPlaceholder;
    btn.setAttribute('data-prism-idx', String(idx));
    if (item.skillId) btn.setAttribute('data-sk', item.skillId);
    else btn.removeAttribute('data-sk');
    if (item.beatLabel) btn.setAttribute('data-beats', item.beatLabel);
    else btn.removeAttribute('data-beats');

    if (g.forceHeight && g.bladeH && !isPlaceholder) {
      btn.style.height = `${g.bladeH}px`;
      btn.style.minHeight = `${g.bladeH}px`;
    } else {
      btn.style.height = '';
      btn.style.minHeight = '';
    }
    if (g.forceWidth && g.bladeW) {
      btn.style.width = `${g.bladeW}px`;
    } else {
      btn.style.width = '';
    }

    const keyEl = btn.querySelector('.cb-bl-key');
    if (keyEl && keyEl.textContent !== item.key) keyEl.textContent = item.key;

    const nameEl = btn.querySelector('.cb-bl-name');
    if (nameEl) {
      const hasArt = !!item.iconHtml;
      const nameKey = `${item.name}|${hasArt ? 1 : 0}`;
      if (nameEl.getAttribute('data-name-key') !== nameKey) {
        nameEl.setAttribute('data-name-key', nameKey);
        nameEl.classList.toggle('has-art', hasArt);
        if (hasArt) {
          nameEl.innerHTML = `<span class="cb-bl-art-wrap" aria-hidden="true">${item.iconHtml}</span>${escapeHtml(item.name)}`;
        } else {
          nameEl.textContent = item.name;
        }
      }
    }

    const topRow = btn.querySelector('.cb-bl-top');
    if (topRow) {
      const { innerHtml, key: tagsKey } = buildBladeRightTagsHtml(item);
      let tagsEl = topRow.querySelector('.cb-bl-tags-right');
      if (innerHtml) {
        if (!tagsEl) {
          tagsEl = document.createElement('span');
          tagsEl.className = 'cb-bl-tags-right';
          topRow.appendChild(tagsEl);
        }
        if (tagsEl.getAttribute('data-tags-key') !== tagsKey) {
          tagsEl.setAttribute('data-tags-key', tagsKey);
          tagsEl.innerHTML = innerHtml;
        }
      } else if (tagsEl) {
        tagsEl.remove();
      }
    }

    const metaEl = btn.querySelector('.cb-bl-meta');
    const metaText = item.foot || item.desc || '';
    if (metaEl && metaEl.textContent !== metaText) metaEl.textContent = metaText;

    const costEl = btn.querySelector('.cb-bl-cost');
    const costText = item.cost || '';
    if (costEl && costEl.textContent !== costText) costEl.textContent = costText;
  }

  function sync(battleOverride) {
    if (uiState.syncing) return;
    uiState.syncing = true;
    try {
      const bs = getBattleScreen();
      if (!bs) return;

      const b = battleOverride || getEngineBattle();
      if (b) uiState.lastBattleState = b;
      const bwKey = b ? `${b.battleInstanceId || 0}:${b.waveIdx || 0}` : '';
      if (bwKey && bwKey !== uiState.lastBattleWaveKey) {
        uiState.lastBattleWaveKey = bwKey;
        uiState.lastBattleTurn = (b && typeof b.turn === 'number') ? b.turn : -1;
        uiState.menuMode = 'root';
        uiState.collapsed = false;
        uiState.logExpanded = false;
        uiState.hoveredWingIdx = null;
        uiState.hoveredBladeIdx = null;
        uiState.hoveredSkillId = null;
        uiState.lastHoveredSkillId = null;
        uiState.hoveringAmpMini = false;
        uiState.lastSkillCastAt = 0;
        uiState.lastAmpPct = -1;
        uiState.lastBladeSig = '';
        uiState.lastAvSig = '';
        uiState.activeActorOverride = null;
        uiState.lastActiveActorKey = 'player';
        uiState.guardSplitIdx = -1;
        uiState.animDissolveUntil = 0;
        cancelPendingHoverClear();
        if (uiState.dissolveTimer) {
          clearTimeout(uiState.dissolveTimer);
          uiState.dissolveTimer = 0;
        }
        if (uiState.castFlashTimer) {
          clearTimeout(uiState.castFlashTimer);
          uiState.castFlashTimer = 0;
        }
        if (uiState.ampPulseTimer) {
          clearTimeout(uiState.ampPulseTimer);
          uiState.ampPulseTimer = 0;
        }
      } else if (b) {
        const turnChanged = typeof b.turn === 'number' && uiState.lastBattleTurn >= 0 && b.turn !== uiState.lastBattleTurn;
        if (typeof b.turn === 'number') uiState.lastBattleTurn = b.turn;
        if (turnChanged || isEnemyTurnState(b)) {
          if (uiState.collapsed) {
            uiState.collapsed = false;
          }
          if (uiState.menuMode !== 'root' || uiState.hoveredSkillId || uiState.lastHoveredSkillId) {
            uiState.menuMode = 'root';
            uiState.hoveredWingIdx = null;
            uiState.hoveredBladeIdx = null;
            uiState.hoveringAmpMini = false;
            uiState.lastSkillCastAt = 0;
            uiState.lastBladeSig = '';
            clearRealHover({ resetLast: true });
          }
        }
      }

      const usePrism = uiState.enabled && !isJsdomEnv() && isDesktopViewport() && isVisible(bs);
      if (bs.classList.contains('prism-radial-active') !== usePrism) {
        bs.classList.toggle('prism-radial-active', usePrism);
      }

      ensureTopBarButtons();
      syncCasualModeBadge();
      const toggleBtn = document.getElementById('cb-btn-prism-toggle');
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', uiState.enabled);
        toggleBtn.textContent = uiState.enabled ? '◆ 棱晶翼' : '◇ 传统列';
      }

      const field = bs.querySelector('.cb-arena-field');
      if (field) attachFieldObserver(field);

      const hardDissolved = shouldHardDissolve(b);
      const timingDissolved = isTimingOrAsyncDissolved(b);
      const dissolved = hardDissolved || timingDissolved || isBriefDissolving();
      if (timingDissolved) {
        startTimingRestoreWatch();
      } else {
        stopTimingRestoreWatch();
      }

      if (!usePrism || uiState.menuMode === 'root' || dissolved || uiState.collapsed) {
        if (uiState.hoveredSkillId) {
          syncAvForecast(null, b);
        }
      }
      if (!isJsdomEnv() && isVisible(bs) && field) {
        ensureAvRail(field);
        syncAvRail(b, field);
      }

      if (!usePrism) {
        if (uiState.rigEl) uiState.rigEl.classList.remove('dissolved', 'is-timing-dissolved', 'is-hard-dissolved');
        stopTimingRestoreWatch();
        return;
      }

      if (!field) return;
      buildRigDOM(field);
      syncLogBar(b);
      syncRigAnchor(b);

      const allSkills = readSkillCards(b);
      const offenseSkills = allSkills.filter(s => !s.isGuard);
      const guardSkillsAll = allSkills.filter(s => s.isGuard);
      const orderedSkills = offenseSkills.concat(guardSkillsAll);
      const guardSplitIdx = (offenseSkills.length > 0 && guardSkillsAll.length > 0) ? offenseSkills.length : -1;
      uiState.guardSplitIdx = guardSplitIdx;
      const enabledSkills = orderedSkills.filter(s => !s.disabled);
      const oppSkills = enabledSkills.filter(s => !!s.oppLabel);
      const ampInfo = readOvercastInfo(b);
      const battleItems = readBattleItems(b);
      const usableItems = battleItems.filter(it => !it.disabled);

      if (uiState.menuMode !== 'root' && uiState.menuMode !== 'skills' && uiState.menuMode !== 'items') {
        uiState.menuMode = 'root';
      }

      const collapsed = !!uiState.collapsed;
      uiState.rigEl.classList.toggle('dissolved', dissolved);
      uiState.rigEl.classList.toggle('is-timing-dissolved', timingDissolved);
      uiState.rigEl.classList.toggle('is-hard-dissolved', hardDissolved);
      uiState.rigEl.classList.toggle('is-collapsed', collapsed);
      uiState.rigEl.classList.toggle('mode-root', uiState.menuMode === 'root');
      uiState.rigEl.classList.toggle('mode-skills', uiState.menuMode === 'skills');
      uiState.rigEl.classList.toggle('mode-items', uiState.menuMode === 'items');
      uiState.rigEl.classList.remove('mode-amp', 'mode-guard', 'mode-assist');

      const hubToggle = (uiState.hubToggleEl && uiState.hubToggleEl.isConnected)
        ? uiState.hubToggleEl
        : document.getElementById('cb-pw-hub-toggle');
      if (hubToggle) {
        uiState.hubToggleEl = hubToggle;
        const hubTip = collapsed ? '展开战斗菜单' : '收起战斗菜单';
        hubToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        hubToggle.setAttribute('aria-label', hubTip);
        hubToggle.setAttribute('data-indie-tip', hubTip);
        hubToggle.removeAttribute('title');
      }

      const noActionsLeft = !!(b && !b.over && (b.ap <= 0 || enabledSkills.length === 0));
      const realEnd = document.getElementById('cb-btn-endturn');
      const endTurnDisabled = !!(b && b.over) || !!(realEnd && realEnd.disabled);

      // Sync Top Bar End-Turn Button (pulses when AP === 0 or no skills affordable!)
      const endTopBtn = document.getElementById('cb-btn-endturn-top');
      if (endTopBtn) {
        endTopBtn.disabled = endTurnDisabled;
        endTopBtn.classList.toggle('needs-endturn', noActionsLeft && !endTurnDisabled);
        endTopBtn.innerHTML = noActionsLeft
          ? '✦ 结束回合 <span class="cb-kbd">X</span>'
          : '结束回合 <span class="cb-kbd">X</span>';
      }

      // Sync Root Wing [W] — 施放技能 (SKILLS)
      const magicSub = document.getElementById('cb-pw-magic-sub');
      if (magicSub) {
        if (enabledSkills.length === 0 && b && !b.over) {
          magicSub.textContent = 'AP 用尽 · 结束回合 [D]';
        } else if (oppSkills.length > 0) {
          magicSub.textContent = `✦ ${oppSkills.length} 破招就绪 · ${enabledSkills.length}/${orderedSkills.length}式`;
        } else {
          magicSub.textContent = `攻守就绪 ${enabledSkills.length}/${orderedSkills.length} 式`;
        }
      }

      // Sync Root Wing [E] — 1:1 exposed direct-press amp meter (3 diamond pips .cb-amp-pips + #cb-pw-amp-val + tier theme classes)
      const ampTier = ampInfo.enabled ? Math.min(3, Math.max(0, ampInfo.tier)) : 0;
      const ampBtn = document.getElementById('cb-pw-amp');
      const ampEn = document.getElementById('cb-pw-amp-en');
      const ampSub = document.getElementById('cb-pw-amp-sub');
      if (ampBtn && ampSub) {
        const hasCycle = !!ampInfo.hasManaCycle;
        ampBtn.disabled = !ampInfo.enabled;
        ampBtn.classList.toggle('has-mana-cycle', hasCycle);
        ampBtn.classList.toggle('amp-t0', !ampInfo.enabled || ampTier === 0);
        ampBtn.classList.toggle('amp-t1', ampInfo.enabled && ampTier === 1);
        ampBtn.classList.toggle('amp-t2', ampInfo.enabled && ampTier === 2);
        ampBtn.classList.toggle('amp-t3', ampInfo.enabled && ampTier >= 3);
        ampBtn.classList.toggle('amp-charged', ampInfo.enabled && ampInfo.overcastPct > 0.001);
        ampBtn.classList.toggle('amp-tier-1', ampInfo.enabled && ampTier === 1);
        ampBtn.classList.toggle('amp-tier-2', ampInfo.enabled && ampTier === 2);
        ampBtn.classList.toggle('amp-tier-3', ampInfo.enabled && ampTier >= 3);
        ampBtn.classList.toggle('amp-max', ampInfo.enabled && ampTier >= 3);
        ampBtn.removeAttribute('title');
        ampBtn.setAttribute(
          'data-indie-tip',
          ampInfo.enabled
            ? `左键/E 升档 · 右键降档（${ampInfo.shortLabel} · ${ampInfo.multBadge}${hasCycle ? ' · 魔战循环' : ''}）`
            : '当前不可增幅'
        );
        if (ampEn) {
          ampEn.textContent = (!uiState.compactMulti && ampInfo.enabled && ampInfo.lockHint)
            ? `${ampInfo.multBadge}${ampInfo.lockHint}`
            : ampInfo.multBadge;
        }
        const pipsHtml = renderAmpPipsHtml(ampInfo, false);
        const valText = formatAmpValText(ampInfo, hasCycle && (uiState.compactMulti || uiState.narrowDesktop));
        const cycleBadgeHtml = hasCycle
          ? '<span class="cb-amp-cycle" id="cb-pw-amp-cycle">✦ 魔战循环</span>'
          : '';
        ampSub.innerHTML = `${pipsHtml}<span class="cb-amp-val" id="cb-pw-amp-val">${escapeHtml(valText)}</span>${cycleBadgeHtml}`;
      }

      // Sync Root Wing [A] — 使用道具 (ITEMS)
      const itemsSub = document.getElementById('cb-pw-items-sub');
      if (itemsSub) {
        if (battleItems.length === 0) {
          itemsSub.textContent = '暂无战斗道具 · 后续开放';
        } else if (usableItems.length > 0) {
          itemsSub.textContent = `行囊可用 ${usableItems.length}/${battleItems.length} 项`;
        } else {
          itemsSub.textContent = `已携带 ${battleItems.length} 项 · 暂不可用`;
        }
      }

      // Sync Root Wing [D] — 结束回合 (END TURN)
      const endWingBtn = document.getElementById('cb-pw-endturn');
      const endWingSub = document.getElementById('cb-pw-endturn-sub');
      if (endWingBtn) {
        endWingBtn.disabled = endTurnDisabled;
        endWingBtn.classList.toggle('needs-endturn', noActionsLeft && !endTurnDisabled);
      }
      if (endWingSub) {
        endWingSub.textContent = noActionsLeft
          ? '✦ AP 用尽 · 立即结束回合'
          : '流转敌方回合 · 可留存 1 AP';
      }

      // Sync Spine Mini Amp Button (in-place direct step inside skills cascade)
      const miniAmp = document.getElementById('cb-pw-amp-mini');
      if (miniAmp) {
        miniAmp.disabled = !ampInfo.enabled;
        miniAmp.classList.toggle('amp-t0', !ampInfo.enabled || ampTier === 0);
        miniAmp.classList.toggle('amp-t1', ampInfo.enabled && ampTier === 1);
        miniAmp.classList.toggle('amp-t2', ampInfo.enabled && ampTier === 2);
        miniAmp.classList.toggle('amp-t3', ampInfo.enabled && ampTier >= 3);
        miniAmp.classList.toggle('charged', ampInfo.enabled && ampInfo.overcastPct > 0.001);
        miniAmp.classList.toggle('tier-1', ampInfo.enabled && ampTier === 1);
        miniAmp.classList.toggle('tier-2', ampInfo.enabled && ampTier === 2);
        miniAmp.classList.toggle('tier-3', ampInfo.enabled && ampTier >= 3);
        miniAmp.classList.toggle('max-tier', ampInfo.enabled && ampTier >= 3);
        miniAmp.removeAttribute('title');
        miniAmp.setAttribute(
          'data-indie-tip',
          ampInfo.enabled ? `左键/E 升档 · 右键降档（+${ampInfo.pctInt}%）` : '当前不可增幅'
        );
        if (!ampInfo.enabled) {
          miniAmp.textContent = '◇ 不可增幅';
        } else {
          const miniSuffix = (!uiState.narrowDesktop && !uiState.compactMulti && ampInfo.extraMp > 0)
            ? ` · +${ampInfo.extraMp}MP`
            : '';
          miniAmp.innerHTML = `<span class="cb-mini-key">E</span> ${renderAmpPipsHtml(ampInfo, true)}<span class="cb-amp-mini-val" id="cb-pw-amp-mini-val">增幅 +${ampInfo.pctInt}%${miniSuffix}</span>`;
        }
      }

      const prevAmpPct = uiState.lastAmpPct;
      uiState.lastAmpPct = ampInfo.pctInt;
      if (prevAmpPct >= 0 && prevAmpPct !== ampInfo.pctInt) {
        triggerAmpPulse();
      }

      // Populate Active Cascade Mode
      let rawItems = [];
      if (uiState.menuMode === 'skills') {
        rawItems = orderedSkills;
      } else if (uiState.menuMode === 'items') {
        rawItems = battleItems.length ? battleItems : buildEmptyItemsPlaceholder();
      }
      const listItems = rawItems.map((it, idx) => (
        it.kind === 'skill' || it.kind === 'item'
          ? Object.assign({}, it, { key: idx < 9 ? String(idx + 1) : '·', displayIdx: idx })
          : Object.assign({}, it, { displayIdx: idx })
      ));
      uiState.currentItems = listItems;

      if (uiState.cascadeListEl && uiState.menuMode !== 'root') {
        const isPlaceholderSingle = listItems.length === 1 && !!listItems[0].isPlaceholder;
        const { coords, spineTop, spineLeft, twoCol } = computeBladeGeometry(
          listItems.length,
          uiState.menuMode === 'skills' ? guardSplitIdx : -1,
          isPlaceholderSingle
        );
        uiState.twoColBlades = !!twoCol;
        uiState.rigEl.classList.toggle('two-col-blades', !!twoCol);
        if (uiState.spineEl) {
          uiState.spineEl.style.top = `${spineTop}px`;
          uiState.spineEl.style.left = `${spineLeft}px`;
        }

        const nextSig = buildItemsSignature(uiState.menuMode, listItems);
        if (nextSig !== uiState.lastBladeSig) {
          uiState.lastBladeSig = nextSig;

          if (canPatchExistingBlades(listItems)) {
            // 就地刷新蓝耗/伤害/可用态与坐标，保留既有扇叶 DOM 与悬停状态，避免调档或连招后鼠标 hover 丢失
            const wraps = uiState.cascadeListEl.children;
            for (let idx = 0; idx < listItems.length; idx++) {
              const wrap = wraps[idx];
              const btn = wrap.querySelector('.cb-blade');
              patchBladeElement(wrap, btn, listItems[idx], coords[idx], idx);
            }
          } else {
            uiState.cascadeListEl.innerHTML = '';

            listItems.forEach((item, idx) => {
              const g = coords[idx];
              const wrap = document.createElement('div');
              wrap.className = 'cb-blade-wrap';

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.innerHTML = `
                <span class="cb-bl-key"></span>
                <div class="cb-bl-content">
                  <div class="cb-bl-top">
                    <span class="cb-bl-name"></span>
                  </div>
                  <div class="cb-bl-bot">
                    <span class="cb-bl-meta"></span>
                    <span class="cb-bl-cost"></span>
                  </div>
                </div>
              `;
              patchBladeElement(wrap, btn, item, g, idx);

              const onBladeEnter = () => {
                cancelPendingHoverClear();
                const liveItem = uiState.currentItems[idx];
                if (liveItem && liveItem.isPlaceholder) return;
                const rot = wrap.dataset.rot || '0';
                uiState.hoveredBladeIdx = idx;
                wrap.classList.add('hovered');
                wrap.style.transform = `translateX(0) rotate(${rot}deg) scale(1.015)`;
                if (liveItem && liveItem.kind === 'skill') {
                  uiState.lastHoveredSkillId = liveItem.skillId || null;
                  applySkillHoverPreviewNow(liveItem.skillId, uiState.lastBattleState || getEngineBattle());
                } else {
                  syncAvForecast(null, uiState.lastBattleState || getEngineBattle());
                }
                renderCurrentSvg();
              };
              const onBladeLeave = ev => {
                const liveItem = uiState.currentItems[idx];
                if (liveItem && liveItem.isPlaceholder) return;
                const rot = wrap.dataset.rot || '0';
                if (uiState.hoveredBladeIdx === idx) uiState.hoveredBladeIdx = null;
                wrap.classList.remove('hovered');
                wrap.style.transform = `rotate(${rot}deg)`;
                const nextEl = ev && ev.relatedTarget;
                const movingWithinCascadeControls = !!(nextEl && nextEl.closest && nextEl.closest('#cb-pw-amp-mini, .cb-blade'));
                if (!movingWithinCascadeControls && uiState.hoveredBladeIdx == null && !uiState.hoveringAmpMini && liveItem && liveItem.kind === 'skill') {
                  scheduleHoverLeaveClear(liveItem.skillId);
                }
                renderCurrentSvg();
              };
              btn.addEventListener('mouseenter', onBladeEnter);
              btn.addEventListener('mouseleave', onBladeLeave);
              btn.addEventListener('focus', onBladeEnter);
              btn.addEventListener('blur', onBladeLeave);
              btn.addEventListener('click', () => {
                const liveItem = uiState.currentItems[idx];
                if (liveItem && !liveItem.isPlaceholder) triggerSourceButton(liveItem);
              });

              wrap.appendChild(btn);
              uiState.cascadeListEl.appendChild(wrap);
            });
          }
        }
      }

      renderCurrentSvg();
    } finally {
      uiState.syncing = false;
    }
  }

  function scheduleSync() {
    if (uiState.rafId) return;
    if (typeof requestAnimationFrame === 'function') {
      uiState.rafId = requestAnimationFrame(() => {
        uiState.rafId = 0;
        sync();
      });
    } else {
      sync();
    }
  }

  function onKeyDown(ev) {
    if (typeof window !== 'undefined' && window.CombatTimingRing && typeof window.CombatTimingRing.isActive === 'function' && window.CombatTimingRing.isActive()) return;
    if (global.CombatTimingRing && typeof global.CombatTimingRing.isActive === 'function' && global.CombatTimingRing.isActive()) return;
    if (isAsyncPhaseActive()) return;
    if (!isActive() || shouldHardDissolve()) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const tgt = ev.target;
    if (tgt && tgt.closest && tgt.closest('input, textarea, select')) return;

    const k = String(ev.key || '').toLowerCase();
    if (ev.repeat) {
      if (PRISM_COMBAT_HOTKEYS.has(k)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
      return;
    }

    if (k === 'escape') {
      if (uiState.logExpanded) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        toggleLogDrawer();
        return;
      }
      if (uiState.menuMode !== 'root') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        closeCascade();
        return;
      }
      return;
    }

    if (k === 'l') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      toggleLogDrawer();
      return;
    }

    if (k === 'w') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      cancelDissolve();
      if (uiState.collapsed) {
        uiState.collapsed = false;
        openSkills();
        return;
      }
      if (uiState.menuMode === 'skills') {
        if (uiState.lastSkillCastAt && (Date.now() - uiState.lastSkillCastAt) < 1200) {
          // 兼容 W→2→W→3 肌肉记忆：施法后 1.2s 内首次按 W 视作确认留在技能页并消费标志，再按 W 或按 Esc 立刻返回主翼
          uiState.lastSkillCastAt = 0;
          sync();
        } else {
          closeCascade();
        }
      } else {
        openSkills();
      }
      return;
    }

    if (k === 'e') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      cancelDissolve();
      cycleAmp(ev.shiftKey ? -1 : 1);
      return;
    }

    if (k === 'a') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      cancelDissolve();
      if (uiState.collapsed) {
        uiState.collapsed = false;
        openItems();
        return;
      }
      if (uiState.menuMode === 'items') closeCascade();
      else openItems();
      return;
    }

    if (k === 'd' || k === 'x') {
      const realEnd = document.getElementById('cb-btn-endturn');
      if (realEnd && !realEnd.disabled) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (uiState.collapsed) {
          uiState.collapsed = false;
        }
        triggerEndTurnAction();
      }
      return;
    }

    if (ev.key >= '1' && ev.key <= '9' && uiState.menuMode !== 'root' && !uiState.collapsed) {
      const idx = Number(ev.key) - 1;
      const item = uiState.currentItems[idx];
      if (item && !item.disabled && !item.isPlaceholder) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        cancelDissolve();
        triggerSourceButton(item);
      }
    }
  }

  function onContextMenu(ev) {
    if (isTimingOrAsyncDissolved()) return;
    if (!isActive() || uiState.menuMode === 'root' || uiState.collapsed) return;
    if (ev.target && ev.target.closest && ev.target.closest('#cb-pw-amp, #cb-pw-amp-mini')) return;
    ev.preventDefault();
    closeCascade();
  }

  function onCombatStateChange(ev) {
    const snap = ev && ev.detail && ev.detail.player ? ev.detail : null;
    sync(snap);
  }

  function onCombatPrefsChange() {
    uiState.lastBladeSig = '';
    sync();
  }

  function onCombatTimingChange() {
    sync();
  }

  function setEnabled(flag) {
    uiState.enabled = !!flag;
    uiState.menuMode = 'root';
    uiState.collapsed = false;
    uiState.lastBladeSig = '';
    uiState.lastSkillCastAt = 0;
    uiState.hoveringAmpMini = false;
    clearRealHover({ resetLast: true });
    sync();
  }

  function attachModalObserver() {
    if (typeof MutationObserver === 'undefined') return;
    const modalSlot = document.getElementById('cb-modal-slot');
    if (modalSlot && !uiState.modalObserver) {
      uiState.modalObserver = new MutationObserver(() => sync());
      uiState.modalObserver.observe(modalSlot, { childList: true });
    }
  }

  function attachFieldObserver(fieldEl) {
    if (typeof MutationObserver === 'undefined') return;
    const target = fieldEl || document.querySelector('#battle-screen .cb-arena-field');
    if (!target) return;
    if (uiState.fieldObserver && uiState.fieldObservedEl === target) return;
    if (uiState.fieldObserver) {
      uiState.fieldObserver.disconnect();
      uiState.fieldObserver = null;
      uiState.fieldObservedEl = null;
    }
    const isTimingLayerNode = node => !!(
      node && node.nodeType === 1 && node.classList && node.classList.contains('cb-timing-ring-layer')
    );
    uiState.fieldObservedEl = target;
    uiState.fieldObserver = new MutationObserver(records => {
      let timingLayerChanged = false;
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        if (rec.addedNodes && Array.from(rec.addedNodes).some(isTimingLayerNode)) {
          timingLayerChanged = true;
          break;
        }
        if (rec.removedNodes && Array.from(rec.removedNodes).some(isTimingLayerNode)) {
          timingLayerChanged = true;
          break;
        }
      }
      if (timingLayerChanged) {
        sync();
      }
    });
    // 仅监听 .cb-arena-field 直接子节点，绝不监听子树，确保 0 帧率开销
    uiState.fieldObserver.observe(target, { childList: true, subtree: false });
  }

  function mount() {
    if (typeof document === 'undefined' || uiState.mounted) return;
    const bs = getBattleScreen();
    if (!bs) return;
    uiState.mounted = true;

    // 仅观察 #battle-screen 自身显隐 class 与 #cb-modal-slot 子节点变化，彻底杜绝 60fps 像素帧触发重绘风暴！
    if (typeof MutationObserver !== 'undefined') {
      uiState.bsObserver = new MutationObserver(records => {
        const curClean = bs.className.replace(/\bprism-radial-active\b/g, '').replace(/\s+/g, ' ').trim();
        const needsSync = records.some(r => {
          if (r.type === 'childList') return true;
          const oldClean = String(r.oldValue || '').replace(/\bprism-radial-active\b/g, '').replace(/\s+/g, ' ').trim();
          return oldClean !== curClean;
        });
        if (!needsSync) return;
        attachModalObserver();
        attachFieldObserver();
        sync();
      });
      uiState.bsObserver.observe(bs, {
        attributes: true,
        attributeFilter: ['class'],
        attributeOldValue: true,
        childList: true,
        subtree: false,
      });
      attachModalObserver();
      attachFieldObserver();
    }

    window.addEventListener('combat:statechange', onCombatStateChange);
    window.addEventListener('combat:prefschange', onCombatPrefsChange);
    window.addEventListener('combat:timingstart', onCombatTimingChange);
    window.addEventListener('combat:timingend', onCombatTimingChange);
    window.addEventListener('combat:timingchange', onCombatTimingChange);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', scheduleSync);
    sync();
  }

  function unmount() {
    if (!uiState.mounted && !uiState.avRailEl && !uiState.rigEl && !uiState.logBarEl) return;
    uiState.mounted = false;
    if (uiState.rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(uiState.rafId);
      uiState.rafId = 0;
    }
    if (uiState.dissolveTimer) {
      clearTimeout(uiState.dissolveTimer);
      uiState.dissolveTimer = 0;
    }
    stopTimingRestoreWatch();
    if (uiState.castFlashTimer) {
      clearTimeout(uiState.castFlashTimer);
      uiState.castFlashTimer = 0;
    }
    if (uiState.ampPulseTimer) {
      clearTimeout(uiState.ampPulseTimer);
      uiState.ampPulseTimer = 0;
    }
    cancelPendingHoverClear();
    if (uiState.bsObserver) {
      uiState.bsObserver.disconnect();
      uiState.bsObserver = null;
    }
    if (uiState.modalObserver) {
      uiState.modalObserver.disconnect();
      uiState.modalObserver = null;
    }
    if (uiState.fieldObserver) {
      uiState.fieldObserver.disconnect();
      uiState.fieldObserver = null;
      uiState.fieldObservedEl = null;
    }
    window.removeEventListener('combat:statechange', onCombatStateChange);
    window.removeEventListener('combat:prefschange', onCombatPrefsChange);
    window.removeEventListener('combat:timingstart', onCombatTimingChange);
    window.removeEventListener('combat:timingend', onCombatTimingChange);
    window.removeEventListener('combat:timingchange', onCombatTimingChange);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('resize', scheduleSync);
    if (uiState.rigEl && uiState.rigEl.parentNode) {
      uiState.rigEl.parentNode.removeChild(uiState.rigEl);
    }
    if (uiState.logBarEl && uiState.logBarEl.parentNode) {
      uiState.logBarEl.parentNode.removeChild(uiState.logBarEl);
    }
    const avRail = uiState.avRailEl || (typeof document !== 'undefined' ? document.getElementById('cb-av-rail') : null);
    if (avRail && avRail.parentNode) {
      avRail.parentNode.removeChild(avRail);
    }
    const casualBadge = typeof document !== 'undefined' ? document.getElementById('cb-casual-mode-badge') : null;
    if (casualBadge && casualBadge.parentNode) {
      casualBadge.parentNode.removeChild(casualBadge);
    }
    uiState.rigEl = null;
    uiState.svgEl = null;
    uiState.hubToggleEl = null;
    uiState.cascadeListEl = null;
    uiState.ampPanelEl = null;
    uiState.spineEl = null;
    uiState.logBarEl = null;
    uiState.avRailEl = null;
    uiState.avListEl = null;
    uiState.avForecastEl = null;
    uiState.collapsed = false;
    uiState.lastAvSig = '';
    uiState.lastBattleWaveKey = '';
    uiState.lastBattleTurn = -1;
    uiState.lastBattleState = null;
    uiState.activeActorOverride = null;
    uiState.lastActiveActorKey = 'player';
    uiState.anchorFlipLeft = false;
    uiState.guardSplitIdx = -1;
    uiState.hoveredSkillId = null;
    uiState.lastHoveredSkillId = null;
    uiState.hoveringAmpMini = false;
    uiState.lastSkillCastAt = 0;
    uiState.lastAmpPct = -1;
    const bs = getBattleScreen();
    if (bs) bs.classList.remove('prism-radial-active');
  }

  const CombatPrismUI = {
    V32_AMP_TIERS,
    mount,
    unmount,
    sync,
    ensureAvRail,
    syncAvRail,
    syncAvForecast,
    resolveActiveActorBox,
    setActiveActor,
    readBattleItems,
    registerItemProvider,
    setMode,
    setCollapsed,
    toggleCollapsed,
    openSkills,
    openAmp,
    openItems,
    openGuard,
    openAssist,
    openPalace,
    endTurn: triggerEndTurnAction,
    closeCascade,
    toggleLogDrawer,
    cycleAmp,
    selectAmpTier,
    setAmpPct: applyAmpPct,
    setEnabled,
    isActive,
    getState: () => ({
      enabled: uiState.enabled,
      mounted: uiState.mounted,
      active: isActive(),
      menuMode: uiState.menuMode,
      collapsed: !!uiState.collapsed,
      logExpanded: uiState.logExpanded,
      itemCount: uiState.currentItems.length,
      ampPct: uiState.lastAmpPct,
      ampTiersVersion: 'V3.2',
      timingDissolved: isTimingOrAsyncDissolved(),
      casualMode: isCasualModeActive(),
      gauntletOff: isGauntletOffMode(),
      activeActorKey: uiState.lastActiveActorKey,
      anchorFlipLeft: uiState.anchorFlipLeft,
      hasMidCorridor: uiState.hasMidCorridor,
      anchorX: uiState.lastAnchorX,
      anchorY: uiState.lastAnchorY,
      avRailMounted: !!(uiState.avRailEl && uiState.avRailEl.isConnected),
      hoveredSkillId: uiState.hoveredSkillId,
      lastHoveredSkillId: uiState.lastHoveredSkillId,
    }),
  };

  global.CombatPrismUI = CombatPrismUI;

  if (typeof document !== 'undefined' && !isJsdomEnv()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
