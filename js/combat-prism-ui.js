/* =========================================================================
   《转生千金》Option 2 · P5 式希尔维亚周身棱晶放射指令翼适配器 (js/combat-prism-ui.js)
   职责：
     - 挂载于 #battle-screen .cb-arena-field，在桌面端（>=1024px）锚定于中场空区 #cb-mid-corridor 偏左，
       将技能选择转化为 Persona 5 式角色锚定多面体蓝宝棱晶放射翼：
         [W] 冰水术式  → 展开实时同步自 #b-actions 的斜切术式级联翼（支持 [1..9] 直施）
         [E] 魔力增幅  → 1:1 复刻标杆外露直按三阶魔力增幅（左键/E 原地升档 0%→20%→40%→60%→0%，
                         右键/Shift+E 原地降档 60%→40%→20%→0%，滚轮微调；技能列表顶脊 #cb-pw-amp-mini 同款直按不跳离）
         [A] 守势/护盾 → 优先瞬发当前可用守势护盾技，多项时展开守势翼，无可用时稳守回合
         [D] 演武辅助  → 展开冰晶宫殿 / 心念援护 / 晦轮杖 / 结束回合四项战术翼
         [X] 结束回合  → 顶栏常驻一键结束回合（AP 归零时流光提示，绝与 [E] 增幅互不冲突）
         [L] 战报手札  → 棱晶模式底部单行实况战报条 + 可展开历史记录
     - 适配 6+6 站位（含雷纳德前排 #cb-ally-vanguard-slot、.cb-ally-pane 与 #cb-enemy-zone .cb-enemy-card 避障）
     - 由 combat:statechange 事件驱动同步 + 签名差分复绘，彻底根除悬停与 60fps 像素帧触发的 DOM 销毁抖动
     - 零破坏既有 DOM ID 与自动化测试（JSDOM 环境下静默旁路）
   ========================================================================= */
(function (global) {
  'use strict';

  const DESKTOP_MIN_W = 1024;
  const MAX_AMP_PCT = 0.60;
  const MAX_AMP_INT = 60;
  const V22_AMP_TIERS = [
    {
      idx: 0,
      key: '1',
      pct: 0,
      tier: 0,
      name: '常规 · 0%',
      title: '常规 · 0%',
      short: '常规',
      multLabel: '1.00×',
      effect: '常规施法 · 1.00×',
    },
    {
      idx: 1,
      key: '2',
      pct: 0.20,
      tier: 1,
      name: '★一阶 · 魔力盈溢 20%',
      title: '★一阶 · 魔力盈溢 20%',
      short: '★20% 盈溢',
      multLabel: '1.43×',
      effect: '+1破锁 · 10%穿抗 · 护盾+35%',
    },
    {
      idx: 2,
      key: '3',
      pct: 0.40,
      tier: 2,
      name: '★★二阶 · 极寒过载 40%',
      title: '★★二阶 · 极寒过载 40%',
      short: '★★40% 过载',
      multLabel: '1.70×',
      effect: '+2破锁 · 20%穿抗 · 护盾+45%',
    },
    {
      idx: 3,
      key: '4',
      pct: 0.60,
      tier: 3,
      name: '★★★三阶 · 星霜极限 60%',
      title: '★★★三阶 · 星霜极限 60%',
      short: '★★★60% 星霜极限',
      multLabel: '1.98×',
      effect: '+3破锁 · 30%穿抗 · 限手持重术',
    },
  ];
  const HIGHER_OVERLAY_IDS = [
    'cg-lightbox', 'sys-popup', 'arena-loadout-modal', 'vn-prefs-modal',
    'vn-backlog-modal', 'vn-saveload-modal', 'vn-chapters-modal',
    'ice-deduction-modal', 'rumor-overlay', 'panel', 'codex',
    'stats-overlay', 'ai-drawer', 'help-screen', 'map-overlay', 'backlog-overlay',
  ];
  const PRISM_COMBAT_HOTKEYS = new Set([
    'w', 'e', 'a', 'd', 'x', 'l', 'q', 'r', 'f', 'escape',
    '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ]);

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
    menuMode: 'root', // 'root' | 'skills' | 'guard' | 'assist'
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
    rafId: 0,
    dissolveTimer: 0,
    rigEl: null,
    svgEl: null,
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
    if (document.getElementById('cb-palace-modal') || document.getElementById('cb-result-modal')) return true;
    if (hasBlockingOverlay()) return true;
    const b = battleOverride || getEngineBattle();
    if (b && (b.over || isEnemyTurnState(b))) return true;
    return false;
  }

  function isBriefDissolving() {
    return Date.now() < uiState.animDissolveUntil;
  }

  function shouldDissolve(battleOverride) {
    return shouldHardDissolve(battleOverride) || isBriefDissolving();
  }

  function cancelDissolve() {
    if (uiState.dissolveTimer) {
      clearTimeout(uiState.dissolveTimer);
      uiState.dissolveTimer = 0;
    }
    const wasDissolving = uiState.animDissolveUntil > 0;
    uiState.animDissolveUntil = 0;
    if (uiState.rigEl && !shouldHardDissolve()) {
      uiState.rigEl.classList.remove('dissolved');
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

  function readSkillCards() {
    const box = getSkillSourceContainer();
    if (!box) return [];
    const btns = Array.from(box.querySelectorAll('.cb-skill-card'));
    return btns.map((btn, idx) => {
      const sid = btn.getAttribute('data-sk') || '';
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
      return {
        kind: 'skill',
        slotIdx: idx,
        key: idx < 9 ? String(idx + 1) : '·',
        skillId: sid,
        name: nameEl ? nameEl.textContent.trim() : sid,
        pathLabel: pathText,
        cost: costEl ? costEl.textContent.trim() : '',
        desc: descEl ? descEl.textContent.trim() : '',
        foot: footEl ? footEl.textContent.trim() : '',
        oppLabel: oppEl ? oppEl.textContent.trim() : '',
        expText,
        expKind,
        isGuard: btn.classList.contains('is-guard'),
        disabled: !!btn.disabled,
        sourceBtn: btn,
      };
    });
  }

  function computeV22FallbackMult(pct) {
    const dm = Math.max(0, Math.min(MAX_AMP_PCT, Number(pct) || 0));
    const seg1 = Math.min(dm, 0.20);
    const seg2 = Math.max(0, Math.min(dm, 0.40) - 0.20);
    const seg3 = Math.max(0, dm - 0.40);
    const base = 1.0 + seg1 * 1.60 + seg2 * 0.60 + seg3 * 0.40;
    if (dm >= 0.60 - 1e-4) return base * 1.30;
    if (dm >= 0.40 - 1e-4) return base * 1.18;
    if (dm >= 0.20 - 1e-4) return base * 1.08;
    return base;
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

    let ampMult = computeV22FallbackMult(overcastPct);
    if (b && typeof b.ampMult === 'number' && isFinite(b.ampMult)) ampMult = b.ampMult;
    else if (p && typeof p.ampMult === 'number' && isFinite(p.ampMult)) ampMult = p.ampMult;

    const rawDiscount = (b && typeof b.ampDiscountFactor === 'number' && isFinite(b.ampDiscountFactor))
      ? b.ampDiscountFactor
      : (p && typeof p.ampDiscountFactor === 'number' && isFinite(p.ampDiscountFactor) ? p.ampDiscountFactor : 1);
    const ampDiscountFactor = Math.max(0, rawDiscount);
    const calcFallbackExtraMp = pct => Math.max(0, Math.round(maxMp * pct * ampDiscountFactor));

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
    const ampTierExtraMps = V22_AMP_TIERS.map(t => (
      rawTierExtraMps && typeof rawTierExtraMps[t.tier] === 'number' && isFinite(rawTierExtraMps[t.tier])
        ? Math.max(0, Math.round(rawTierExtraMps[t.tier]))
        : calcFallbackExtraMp(t.pct)
    ));

    const lockHint = tier >= 3 ? ' · +3锁' : tier >= 2 ? ' · +2锁' : tier >= 1 ? ' · +1锁' : '';
    const multBadge = !canAmp ? 'LOCK' : `${ampMult.toFixed(2)}×`;
    const badge = !canAmp ? '不可增幅' : formatAmpBadge(overcastPct, tier);
    const shortLabel = !canAmp ? '锁定' : formatAmpShort(overcastPct, tier);
    const allowedTiers = V22_AMP_TIERS.filter(t => t.pct <= maxAmpCap + 1e-4);

    const ampTierMults = (b && Array.isArray(b.ampTierMults) && b.ampTierMults.length >= 4)
      ? b.ampTierMults
      : null;

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

  function readAssistItems(battleOverride) {
    const items = [];
    const b = battleOverride || getEngineBattle();
    const p = b && b.player ? b.player : null;

    const palBtn = document.getElementById('cb-btn-palace');
    if (palBtn && isVisible(palBtn)) {
      let palFoot = '审视敌方招式死角';
      let palCost = palBtn.disabled ? '暂不可用' : '就绪';
      if (p) {
        const palMax = Number(p.palaceMax) || 0;
        const palLeft = Number(p.palaceLeft) || 0;
        const waveTurn = Number(b.waveTurn) || 1;
        if (palMax <= 0) {
          palFoot = '尚未习得并行推演';
          palCost = '未习得';
        } else if (palLeft > 0 && waveTurn < 2) {
          palFoot = `收集线索 ${Math.min(1, waveTurn)}/2 · 第2回合就绪`;
          palCost = '采集中';
        } else if (palLeft > 0 && !palBtn.disabled) {
          palFoot = '推演就绪 · 锁定敌方招式死角';
          palCost = `${palLeft}/${palMax} 就绪`;
        } else if (palLeft <= 0) {
          const hasNextWave = typeof b.waveIdx === 'number' && typeof b.totalWaves === 'number' && (b.waveIdx + 1 < b.totalWaves);
          palFoot = hasNextWave ? '本波已推演 · 下波重置' : '本场推演机会已用尽';
          palCost = '已使用';
        }
      } else {
        const cleaned = palBtn.textContent
          .replace(/\s+/g, ' ')
          .replace(/\bQ\b/g, '')
          .replace(/^冰晶宫殿[·・:\s]*/u, '')
          .trim();
        if (cleaned) palFoot = cleaned;
      }
      items.push({
        kind: 'tool',
        key: 'Q',
        skillId: 'tool_palace',
        name: '冰晶宫殿',
        pathLabel: '冰镜并行',
        foot: palFoot,
        cost: palCost,
        oppLabel: !palBtn.disabled && palBtn.classList.contains('pulse-hint') ? '✦ 可审视' : '',
        disabled: !!palBtn.disabled,
        sourceBtn: palBtn,
      });
    }

    const assistBtn = document.getElementById('cb-btn-assist');
    const hasConfiguredAssist = p ? !!p.bondAssist : !!(assistBtn && !assistBtn.classList.contains('locked-hint'));
    if (hasConfiguredAssist && assistBtn && isVisible(assistBtn)) {
      const cleanedAssist = assistBtn.textContent
        .replace(/\s+/g, ' ')
        .replace(/\bF\b/g, '')
        .replace(/^心念援护[·・:\s]*/u, '')
        .trim();
      const used = !!(p && p.bondAssistUsed);
      items.push({
        kind: 'tool',
        key: 'F',
        skillId: 'tool_assist',
        name: '心念援护',
        pathLabel: '羁绊连携',
        foot: cleanedAssist || (used ? '本场已发动羁绊支援' : '呼唤羁绊角色协同援护'),
        cost: used ? '已使用' : (assistBtn.disabled ? '未就绪' : '可用'),
        oppLabel: !assistBtn.disabled ? '✦ 可援护' : '',
        disabled: !!assistBtn.disabled,
        sourceBtn: assistBtn,
      });
    }

    const wandBtn = document.getElementById('cb-btn-wand');
    if (wandBtn && isVisible(wandBtn)) {
      const isOn = wandBtn.classList.contains('active');
      const artApi = (typeof window !== 'undefined' && window.ItemArtRegistry) || global.ItemArtRegistry || null;
      const wandIconHtml = (artApi && typeof artApi.renderIconHTML === 'function')
        ? (artApi.renderIconHTML('eclipse_wand', { size: 20, cls: 'cb-bl-art-icon', decorative: true, eager: true }) || '')
        : '';
      items.push({
        kind: 'tool',
        key: 'R',
        skillId: 'tool_wand',
        name: '晦轮杖',
        iconHtml: wandIconHtml,
        pathLabel: '魔法真伤',
        foot: isOn ? '真伤已展开 · 穿法抗与魔盾' : '收鞘态 · 展开享100%魔法真伤',
        cost: wandBtn.disabled ? '不可用' : (isOn ? '已展开' : '收鞘'),
        oppLabel: isOn ? '✦ 晦轮展开' : '',
        disabled: !!wandBtn.disabled,
        sourceBtn: wandBtn,
      });
    }

    const endBtn = document.getElementById('cb-btn-endturn');
    if (endBtn && isVisible(endBtn)) {
      items.push({
        kind: 'tool',
        key: 'X',
        skillId: 'tool_endturn',
        name: '结束本回合',
        pathLabel: '流转敌回',
        foot: '可留存 1 点 AP 进入下回合',
        cost: 'END',
        oppLabel: '',
        disabled: !!endBtn.disabled,
        sourceBtn: endBtn,
      });
    }

    return items;
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
    if (uiState.menuMode !== 'skills' && uiState.menuMode !== 'guard') return null;
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

    const inSkillCascade = uiState.menuMode === 'skills' || uiState.menuMode === 'guard';
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

    if (uiState.menuMode === 'skills' || uiState.menuMode === 'guard') {
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
    const step = delta < 0 ? -1 : 1;
    const info = readOvercastInfo();
    if (!info.enabled || !info.allowedTiers.length) {
      if (wasDissolving) sync();
      return false;
    }
    const tiers = info.allowedTiers.map(t => t.pct);
    const cur = info.overcastPct;

    if (step > 0) {
      // 1:1 标杆左键/E 原地升档：0% → 20% → 40% → 60% → 0%（按 maxAmpCap 动态封顶循环）
      const higher = tiers.find(v => v > cur + 0.005);
      const nextVal = higher != null ? higher : tiers[0];
      return applyAmpPct(nextVal, opts);
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
      if (wasDissolving) sync();
      return false;
    }
    return applyAmpPct(nextVal, opts);
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
      } else if (item.kind === 'tool') {
        if (item.skillId === 'tool_palace') return document.getElementById('cb-btn-palace');
        if (item.skillId === 'tool_assist') return document.getElementById('cb-btn-assist');
        if (item.skillId === 'tool_wand') return document.getElementById('cb-btn-wand');
        if (item.skillId === 'tool_endturn') return document.getElementById('cb-btn-endturn');
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

  function triggerSourceButton(item) {
    if (!item) return false;
    const isSkill = (item.kind === 'skill' && !!item.skillId)
      || (!!item.skillId && item.kind !== 'tool' && !String(item.skillId).startsWith('tool_'));
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
      if (!shouldHardDissolve(nextState)) {
        startBriefDissolve();
      }
      sync(nextState);
      return true;
    }

    if (item.skillId === 'tool_endturn') {
      const nextState = getEngineBattle();
      if (!shouldHardDissolve(nextState)) {
        startBriefDissolve();
      }
      sync(nextState);
      return true;
    }

    sync();
    return true;
  }

  function setMode(nextMode) {
    cancelDissolve();
    if (nextMode === 'amp') {
      cycleAmp(1);
      return;
    }
    const valid = nextMode === 'skills' || nextMode === 'guard' || nextMode === 'assist'
      ? nextMode
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
    }
    sync();
  }

  function openSkills() { setMode('skills'); }
  function openAmp() { return cycleAmp(1); }
  function openGuard() {
    cancelDissolve();
    const guards = readSkillCards().filter(c => c.isGuard && !c.disabled);
    if (guards.length === 1) {
      triggerSourceButton(guards[0]);
      return;
    }
    if (guards.length > 1) {
      setMode('guard');
      return;
    }
    triggerEndTurnAction();
  }
  function openAssist() { setMode('assist'); }
  function closeCascade() { setMode('root'); }

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

  function computeBladeGeometry(count) {
    const safeCount = Math.max(1, count);
    const fieldW = Math.max(640, uiState.lastFieldW || 1200);
    const fieldH = Math.max(360, uiState.lastFieldH || 560);
    const anchorX = Math.max(110, uiState.lastAnchorX || 260);
    const anchorY = Math.max(110, uiState.lastAnchorY || Math.round(fieldH * 0.45));
    const viewportW = uiState.viewportW || (typeof window !== 'undefined' ? window.innerWidth : 1440);
    const viewportH = uiState.viewportH || (typeof window !== 'undefined' ? window.innerHeight : 900);
    const isTightDesktop = viewportH <= 760 || viewportW <= 1320 || !!uiState.narrowDesktop || !!uiState.shortViewport;
    const compact = safeCount >= 7 || isTightDesktop || !!uiState.compactMulti;
    const isCompactSpine = !!(isTightDesktop || (uiState.compactMulti && uiState.narrowDesktop));
    const spineH = isCompactSpine ? 26 : 30;
    const spineGap = isCompactSpine ? 6 : 8;

    const allyRight = Math.max(120, uiState.portraitRight || 210);
    const enemyLeft = uiState.enemyLeftX > 0
      ? uiState.enemyLeftX
      : (uiState.hasMidCorridor && uiState.corridorRight > 0 ? uiState.corridorRight : fieldW - 14);
    const freeLeftAbs = Math.max(uiState.hasMidCorridor ? uiState.corridorLeft : 0, allyRight + 10);
    const freeRightAbs = Math.min(fieldW - 12, enemyLeft - 12);
    const freeWidth = Math.max(0, freeRightAbs - freeLeftAbs);
    const minLeftFromAlly = Math.max(14, freeLeftAbs - anchorX);

    // 1. 预评估中场空区单列几何：在三列 6+6 舞台下，中场走廊纵贯全场，单列可无遮挡容纳 1–12 项术式
    const naturalSingleW = (isTightDesktop || uiState.compactMulti) ? 288 : 326;
    const availRightW = uiState.hasMidCorridor
      ? Math.max(0, freeRightAbs - Math.max(freeLeftAbs, anchorX + 14))
      : freeWidth;
    const effectiveFreeW = availRightW > 0 ? Math.min(freeWidth, availRightW) : freeWidth;
    const singleW = effectiveFreeW >= 232
      ? Math.max(224, Math.min(naturalSingleW, effectiveFreeW - 14))
      : naturalSingleW;
    const singleForceW = singleW < naturalSingleW;
    let singleMinLeft = minLeftFromAlly;
    if (uiState.allyPaneRight > 0 && anchorX + singleMinLeft < uiState.allyPaneRight + 6) {
      const paneClearLeft = (uiState.allyPaneRight + 8) - anchorX;
      if (anchorX + paneClearLeft + singleW <= freeRightAbs) {
        singleMinLeft = Math.max(singleMinLeft, Math.round(paneClearLeft));
      }
    }
    let singleMaxLeft = (freeRightAbs - anchorX) - singleW;
    if (uiState.targetPaneLeft > 0 && anchorX + singleMaxLeft + singleW > uiState.targetPaneLeft - 8) {
      const targetClearMaxLeft = (uiState.targetPaneLeft - 8) - anchorX - singleW;
      if (targetClearMaxLeft >= singleMinLeft) {
        singleMaxLeft = Math.min(singleMaxLeft, Math.round(targetClearMaxLeft));
      }
    }
    const singleSlack = Math.max(0, singleMaxLeft - singleMinLeft);
    const singleArcX = Math.max(0, Math.min(uiState.compactMulti || isTightDesktop ? 10 : 18, Math.floor(singleSlack * 0.45)));
    let singleBaseX = uiState.hasMidCorridor
      ? Math.round(Math.max(singleMinLeft, Math.min(singleMaxLeft - singleArcX, uiState.compactMulti ? 26 : 42)))
      : (uiState.compactMulti ? Math.max(30, singleMinLeft) : Math.max(52, singleMinLeft));
    if (uiState.hasMidCorridor && singleMaxLeft < singleMinLeft) {
      singleBaseX = Math.round(singleMinLeft);
    }
    const singleBounds = resolveBladeVerticalBounds(
      anchorX + singleBaseX,
      anchorX + singleBaseX + singleW + singleArcX,
      fieldH
    );
    const singleMinTopOff = (singleBounds.safeTop + spineH + spineGap) - anchorY;
    const singleMaxBotOff = singleBounds.safeBot - anchorY;
    const singleAvailSpan = Math.max(120, singleMaxBotOff - singleMinTopOff);
    const minSingleH = isTightDesktop ? 32 : 34;
    const minSingleGap = safeCount >= 10 ? 2 : 3;
    const singleNeededH = safeCount * minSingleH + Math.max(0, safeCount - 1) * minSingleGap;
    const singleFitsCorridor = uiState.hasMidCorridor && effectiveFreeW >= 224 && singleAvailSpan >= singleNeededH;

    // 2. 双列触发判定：
    //    - 中场走廊极宽（单敌远置等）足以零遮挡容纳双列且技能 >= 7 时，切双列；
    //    - 若中场走廊单列能完整无遮挡容纳（含 6–12 技能），优先走中场单列彻底零压敌卡；
    //    - 若无中场走廊或窗口极矮单列放不下，退回避障双列天区排版。
    const twoColBladeW = isTightDesktop ? 262 : 286;
    const twoColIdealGap = isTightDesktop ? 12 : 16;
    const twoColFitsCorridor = safeCount >= 7 && availRightW >= (twoColBladeW * 2 + twoColIdealGap + 12);
    const needTwoColFallback = !singleFitsCorridor && (
      safeCount >= 7 || (isTightDesktop && safeCount >= 6) || (!!uiState.compactMulti && safeCount >= 6)
    );
    const twoCol = twoColFitsCorridor || needTwoColFallback;

    if (twoCol) {
      const col1Count = Math.ceil(safeCount / 2);
      const col2Count = safeCount - col1Count;
      let bladeW = twoColBladeW;
      let colGap = twoColIdealGap;
      let col1Left = minLeftFromAlly;
      if (twoColFitsCorridor && uiState.allyPaneRight > 0 && anchorX + col1Left < uiState.allyPaneRight + 6) {
        const paneClearLeft = (uiState.allyPaneRight + 8) - anchorX;
        if (anchorX + paneClearLeft + bladeW * 2 + colGap <= freeRightAbs) {
          col1Left = Math.max(col1Left, Math.round(paneClearLeft));
        }
      }
      let col2Left = col1Left + bladeW + colGap;

      // 优先贴紧中场/友方右侧，严格避免双列右沿跨入敌方卡片区
      if (uiState.enemyLeftX > 0) {
        const enemyLimitInRig = (uiState.enemyLeftX - 10) - anchorX;
        if (col2Left + bladeW > enemyLimitInRig) {
          colGap = isTightDesktop ? 10 : 12;
          const tightLeft = Math.max(12, (allyRight - anchorX) + 6);
          const neededShift = (col1Left + bladeW * 2 + colGap) - enemyLimitInRig;
          col1Left = Math.max(tightLeft, col1Left - Math.max(0, neededShift));
          col2Left = col1Left + bladeW + colGap;
        }
      }

      const maxRightInRig = fieldW - anchorX - 14;
      if (col2Left + bladeW > maxRightInRig) {
        const overflow = (col2Left + bladeW) - maxRightInRig;
        const shiftedLeft = Math.max(14, col1Left - overflow);
        const remOverflow = Math.max(0, overflow - (col1Left - shiftedLeft));
        col1Left = shiftedLeft;
        colGap = Math.max(8, colGap - remOverflow);
        col2Left = col1Left + bladeW + colGap;
      }

      const absLeft = anchorX + col1Left;
      const absRight = anchorX + col2Left + bladeW + 10;
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
        const baseX = inCol2 ? col2Left : col1Left;
        const arcX = inCol2 ? 6 : 10;
        const curveX = Math.round(baseX + Math.sin(frac * Math.PI) * arcX);
        const topY = Math.round((inCol2 ? col2StartY : startY) + idxInCol * stepY);
        const maxRot = inCol2 ? 0.7 : 1.0;
        const rot = Number((-maxRot + frac * (maxRot * 2)).toFixed(2));
        coords.push({
          left: curveX,
          top: topY,
          rot,
          compact: true,
          twoCol: true,
          colIdx: inCol2 ? 1 : 0,
          showHairline: !inCol2,
          bladeH,
          bladeW,
          forceHeight,
          forceWidth: false,
          tipX: curveX + 4,
          tipY: topY + Math.round(bladeH * 0.5),
          elbowX: Math.round(curveX * 0.52),
          elbowY: Math.round((topY + Math.round(bladeH * 0.5)) * 0.65),
        });
      }
      return {
        coords,
        spineTop: Math.max(safeTop - anchorY, startY - (spineH + spineGap)),
        spineLeft: col1Left,
        bladeH,
        twoCol: true,
      };
    }

    // 3. 单列中场棱晶翼（覆盖少技能经典弧线与 6–12 技能中场空区纵向展开，严格不压友方前排与敌方卡片）
    const { safeTop, safeBot } = singleBounds;
    const minTopOffset = singleMinTopOff;
    const maxBotOffset = singleMaxBotOff;
    const availSpan = singleAvailSpan;
    let defaultBladeH;
    let idealStep;
    if (safeCount <= 4) {
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
    const fitBladeH = safeCount > 0 ? Math.floor((availSpan - Math.max(0, safeCount - 1) * minSingleGap) / safeCount) : defaultBladeH;
    const bladeH = Math.max(30, Math.min(defaultBladeH, fitBladeH));
    const forceHeight = bladeH < defaultBladeH || safeCount >= 7;
    const maxAllowedStep = safeCount > 1 ? Math.floor((availSpan - bladeH) / (safeCount - 1)) : idealStep;
    const stepY = safeCount > 1 ? Math.max(bladeH + 2, Math.min(idealStep, maxAllowedStep)) : idealStep;

    const totalH = (safeCount - 1) * stepY + bladeH;
    let startY = -Math.round(totalH * 0.50);
    if (startY < minTopOffset) startY = minTopOffset;
    if (startY + totalH > maxBotOffset) startY = Math.max(minTopOffset, maxBotOffset - totalH);

    const arcX = uiState.hasMidCorridor ? singleArcX : (uiState.compactMulti ? 16 : 28);
    const maxRot = safeCount >= 9 ? 0.9 : (compact ? 1.4 : 2.2);

    const coords = [];
    for (let i = 0; i < safeCount; i++) {
      const frac = safeCount === 1 ? 0.5 : i / (safeCount - 1);
      const curveX = Math.round(singleBaseX + Math.sin(frac * Math.PI) * arcX);
      const topY = Math.round(startY + i * stepY);
      const rot = Number((-maxRot + frac * (maxRot * 2)).toFixed(2));
      coords.push({
        left: curveX,
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
        tipX: curveX + 4,
        tipY: topY + Math.round(bladeH * 0.5),
        elbowX: Math.round(curveX * 0.54),
        elbowY: Math.round((topY + Math.round(bladeH * 0.5)) * 0.65),
      });
    }
    const maxSpineLeft = uiState.hasMidCorridor
      ? Math.max(singleMinLeft - 4, (freeRightAbs - anchorX) - Math.min(singleW, 250))
      : singleBaseX - 8;
    const spineLeft = Math.round(Math.max(singleMinLeft - 6, Math.min(singleBaseX - 4, maxSpineLeft)));
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

    parts.push('<polygon fill="none" stroke="rgba(239,224,190,0.72)" stroke-width="1" points="0,-14 14,0 0,14 -14,0" />');
    parts.push('<polygon fill="#1658EB" points="0,-8 8,0 0,8 -8,0" />');
    parts.push('<polygon fill="#EFE0BE" points="0,-4.5 4.5,0 0,4.5 -4.5,0" />');
    parts.push('<polygon fill="#FFFFFF" points="0,-2 2,0 0,2 -2,0" />');
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

  function syncRigAnchor() {
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

    // 实时测算 6+6 对称剧场静止槽位/容器避障边界（严禁测量受冲刺 transform: translate3d 驱动的 .cb-px-actor！）：
    //   - 敌方：#cb-enemy-zone .cb-enemy-card、.cb-intent-banner（区分上半区与脚下微标）、.cb-e-stage、.cb-e-plate
    //   - 友方：#cb-ally-vanguard-slot、.cb-ally-vanguard-slot、#cb-p-portrait、#cb-ally-formation .cb-ally-slot.is-occupied
    //   - 双底角面板：#cb-party-panes / #cb-player-pane / #cb-ally-pane / .cb-ally-pane 与 #cb-target-detail-pane
    //   - 中场留空走廊：#cb-mid-corridor
    let intentMaxBottom = 0;
    let enemyMinTop = fieldH;
    let enemyMinLeft = fieldW;
    let allyActorRight = 0;
    let hasVanguardActor = false;
    let occupiedAllySlots = 0;
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
        // Stage B 敌方脚下意图微标绝不误判为顶部天花板：仅舞台上半区且位于精灵上方时作为 kind:'intent' 更新 intentMaxBottom
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
      // 仅测静止容器 .cb-e-stage / .cb-e-plate，彻底免疫敌方 .cb-px-actor 冲刺位移
      eZone.querySelectorAll('.cb-e-stage, .cb-e-plate').forEach(el => {
        const box = pushObstacle(el, 'lower', 'enemy-lower');
        if (box && (box.bottom - box.top) > 12) {
          enemyMinTop = Math.min(enemyMinTop, box.top);
        }
      });
    }

    // 友方多编队（1–6 人）静止槽位/容器右沿扫描（严格只测静止槽位，绝不测冲刺中的 .cb-px-actor）
    field.querySelectorAll('#cb-ally-vanguard-slot, .cb-ally-vanguard-slot').forEach(vSlot => {
      const box = pushObstacle(vSlot, 'ally', 'vanguard');
      if (box) {
        hasVanguardActor = true;
        allyActorRight = Math.max(allyActorRight, box.right);
      }
    });
    const sylviaPortrait = playerStage.querySelector('#cb-p-portrait') || document.getElementById('cb-p-portrait');
    if (sylviaPortrait) {
      const box = pushObstacle(sylviaPortrait, 'ally', 'sylvia');
      if (box) allyActorRight = Math.max(allyActorRight, box.right);
    }
    field.querySelectorAll('#cb-ally-formation .cb-ally-slot.is-occupied').forEach(slotEl => {
      const box = pushObstacle(slotEl, 'ally', 'ally-slot');
      if (box) {
        occupiedAllySlots += 1;
        allyActorRight = Math.max(allyActorRight, box.right);
      }
    });
    if (occupiedAllySlots >= 2) {
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

    // 中场留空走廊测量（三列经典舞台；若 #cb-mid-corridor 尚未挂载亦自动识别列1与列3间真实空隙）
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
    if (!hasMidCorridor && eZone) {
      const eBox = measureBoxInField(eZone, field, fRectFallback);
      if (eBox) {
        const impliedLeft = Math.round(pBox.right);
        const impliedRight = Math.round(eBox.left);
        const impliedW = impliedRight - impliedLeft;
        if (eBox.width > 40 && impliedW >= 160) {
          hasMidCorridor = true;
          corridorLeft = impliedLeft;
          corridorRight = impliedRight;
          corridorW = impliedW;
        }
      }
    }

    const portraitRight = allyActorRight > 12
      ? Math.round(allyActorRight)
      : Math.round(pBox.right - 80);
    const allyRightBound = Math.max(120, portraitRight);
    const enemyLeftBound = enemyMinLeft < fieldW
      ? Math.round(enemyMinLeft)
      : (hasMidCorridor ? corridorRight : Math.round(fieldW * 0.68));
    const openStart = hasMidCorridor ? Math.max(allyRightBound + 8, corridorLeft) : (allyRightBound + 8);
    const openSpan = Math.max(0, enemyLeftBound - openStart);
    const compactRig = hasMidCorridor
      ? (openSpan < 400 || isNarrowDesktop)
      : (isMulti || (hasVanguardActor && openSpan < 400));

    uiState.compactMulti = compactRig;
    uiState.rigEl.classList.toggle('compact-multi', compactRig);
    uiState.rigEl.classList.toggle('narrow-desktop', isNarrowDesktop);

    uiState.lastFieldW = Math.round(fieldW);
    uiState.lastFieldH = Math.round(fieldH);
    uiState.skyTopY = Math.max(0, Math.round(intentMaxBottom));
    uiState.skyBotY = Math.max(uiState.skyTopY + 140, Math.round(Math.min(enemyMinTop, paneTop)));
    uiState.portraitRight = allyRightBound;
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

    let anchorX;
    let anchorY;
    if (hasMidCorridor) {
      // 中场走廊居中取锚：在左翼最前锋占槽右沿与右翼最前排敌卡左沿之间丝滑居中，同时保证展开扇叶右沿不压敌阵
      const wingMinLeft = compactRig ? 24 : 46;
      const wingMaxRight = compactRig ? (isNarrowDesktop ? 260 : 272) : 352;
      const corridorOpenLeft = Math.max(corridorLeft, allyRightBound + 10);
      const corridorOpenRight = Math.min(fieldW - 12, enemyLeftBound - 10);
      const expectedFreeW = Math.max(0, (enemyLeftBound - 12) - corridorOpenLeft);
      const naturalBladeW = (compactRig || isNarrowDesktop) ? 288 : 326;
      const expectedBladeW = expectedFreeW >= 232
        ? Math.max(224, Math.min(naturalBladeW, expectedFreeW - 14))
        : naturalBladeW;
      const minAnchorX = Math.max(110, allyRightBound - wingMinLeft + 10);
      const maxAnchorX = enemyLeftBound - wingMaxRight - 10;
      const bladeFitMaxAnchorX = (enemyLeftBound - 12) - expectedBladeW - 14;
      const effectiveMaxAnchorX = maxAnchorX >= minAnchorX
        ? Math.max(minAnchorX, Math.min(maxAnchorX, bladeFitMaxAnchorX))
        : maxAnchorX;
      const centeredAnchor = Math.round((corridorOpenLeft + corridorOpenRight) * 0.5 - wingMaxRight * 0.5);
      const floorAnchor = Math.max(corridorLeft + (compactRig ? 8 : 12), allyRightBound + 12);
      const preferredAnchor = Math.max(floorAnchor, centeredAnchor);
      if (maxAnchorX >= minAnchorX) {
        anchorX = Math.round(Math.max(minAnchorX, Math.min(effectiveMaxAnchorX, preferredAnchor)));
      } else {
        const midGapX = Math.round((allyRightBound + enemyLeftBound) * 0.5 - (wingMinLeft + wingMaxRight) * 0.5);
        anchorX = Math.round(Math.max(110, Math.min(fieldW - wingMaxRight - 8, midGapX)));
      }

      const wingTopExtent = (compactRig && isNarrowDesktop) ? 104 : (compactRig ? 118 : 126);
      const wingBotExtent = (compactRig && isNarrowDesktop) ? 132 : (compactRig ? 156 : 164);
      const wingsOverlapAllyPane = allyPaneRight > 0 && (anchorX + wingMinLeft) < (allyPaneRight + 6);
      const wingsOverlapTargetPane = targetPaneFound && targetPaneLeft > 0 && (anchorX + wingMaxRight) > (targetPaneLeft - 6);
      let botLimit = fieldH - 10;
      if (wingsOverlapAllyPane && allyPaneTop < fieldH) {
        botLimit = Math.min(botLimit, allyPaneTop - 8);
      }
      if (wingsOverlapTargetPane && targetPaneTop < fieldH) {
        botLimit = Math.min(botLimit, targetPaneTop - 8);
      }
      // 双底角面板上方净空保底：上方空间充足时优先将四片根翼稳稳悬于双底角之上并纵向居中
      if (paneTop < fieldH && (paneTop - 8 - wingBotExtent) >= (wingTopExtent + 8)) {
        botLimit = Math.min(botLimit, paneTop - 8);
      }
      const topLimit = 8;
      const minAy = Math.min(topLimit + wingTopExtent + 6, Math.round(fieldH * 0.42));
      const maxAy = Math.max(minAy, Math.round(botLimit - wingBotExtent));
      const stageMidAy = Math.round((topLimit + botLimit) * 0.5 - (wingBotExtent - wingTopExtent) * 0.5);
      const idealAy = paneTop < fieldH ? Math.min(Math.round(fieldH * 0.45), stageMidAy) : Math.round(fieldH * 0.45);
      anchorY = Math.round(Math.max(minAy, Math.min(maxAy, idealAy)));
    } else {
      const stageRight = pBox.right;
      if (compactRig) {
        const pullLeft = isNarrowDesktop ? 106 : 82;
        const minX = isNarrowDesktop ? 152 : 176;
        anchorX = Math.round(Math.min(fieldW * 0.24, Math.max(minX, stageRight - pullLeft)));
        const skyMid = Math.round((uiState.skyTopY + uiState.skyBotY) * 0.52);
        if (isNarrowDesktop) {
          const minAy = Math.min(180, Math.round(fieldH * 0.34));
          const maxAy = Math.max(minAy, Math.round(fieldH - 220));
          anchorY = Math.round(Math.max(minAy, Math.min(maxAy, skyMid)));
        } else {
          const minAy = Math.min(200, Math.round(fieldH * 0.38));
          const maxAy = Math.max(minAy, Math.round(fieldH - 190));
          anchorY = Math.round(Math.max(minAy, Math.min(maxAy, skyMid)));
        }
      } else {
        anchorX = Math.round(Math.min(fieldW * 0.34, Math.max(196, stageRight - 44)));
        const minAy = Math.min(200, Math.round(fieldH * 0.42));
        const maxAy = Math.max(minAy, Math.round(fieldH - 172));
        anchorY = Math.round(Math.max(minAy, Math.min(maxAy, fieldH * 0.44)));
      }
    }

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
      endTop.title = '结束本回合，留存最多 1 点 AP（快捷键 X）';
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
      btn.title = '切换 棱晶放射翼 / 经典底栏列阵';
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
      <button type="button" class="cb-plog-toggle" id="cb-plog-toggle" title="展开/收起近期战报（快捷键 L）">战报 [L]</button>
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
        row.setAttribute('title', fullName);

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
    nav.setAttribute('aria-label', '希尔维亚棱晶放射指令翼');

    nav.innerHTML = `
      <svg class="cb-prism-svg" id="cb-prism-svg" viewBox="-42 -250 470 500" aria-hidden="true"></svg>
      <div class="cb-prism-root" id="cb-prism-root">
        <div class="cb-pwing-wrap" data-wing="0">
          <button type="button" class="cb-pwing cb-prism-wing hero-prism" id="cb-pw-magic">
            <span class="cb-pw-key">W</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">冰水术式</span>
                <span class="cb-pw-en">MAGIC</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-magic-sub">展开可用术式</span>
            </div>
            <span class="cb-pw-arrow">▸</span>
          </button>
        </div>

        <div class="cb-pwing-wrap" data-wing="1">
          <button type="button" class="cb-pwing cb-prism-wing amp-t0" id="cb-pw-amp" title="魔力增幅（左键 / E 原地升档 · 右键 / Shift+E 原地降档 · 滚轮微调）">
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
          <button type="button" class="cb-pwing cb-prism-wing" id="cb-pw-guard">
            <span class="cb-pw-key">A</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">守势/护盾</span>
                <span class="cb-pw-en">GUARD</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-guard-sub">构筑冰盾或剑步卸力</span>
            </div>
          </button>
        </div>

        <div class="cb-pwing-wrap" data-wing="3">
          <button type="button" class="cb-pwing cb-prism-wing" id="cb-pw-assist">
            <span class="cb-pw-key">D</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">演武辅助</span>
                <span class="cb-pw-en">ASSIST</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-assist-sub">推演 / 回合 [X]</span>
            </div>
            <span class="cb-pw-arrow">▸</span>
          </button>
        </div>
      </div>

      <div class="cb-prism-cascade" id="cb-prism-cascade">
        <div class="cb-cascade-spine" id="cb-cascade-spine">
          <button type="button" class="cb-spine-btn" id="cb-pw-back">← 返回 [ESC]</button>
          <button type="button" class="cb-spine-btn amp-mini amp-t0" id="cb-pw-amp-mini" title="原地调档（左键 / E 升档 · 右键 / Shift+E 降档 · 滚轮微调）"><span class="cb-mini-key">E</span> <span class="cb-amp-pips cb-amp-pips-mini" aria-hidden="true"><span class="cb-amp-pip"></span><span class="cb-amp-pip"></span><span class="cb-amp-pip"></span></span><span class="cb-amp-mini-val" id="cb-pw-amp-mini-val">增幅 +0%</span></button>
        </div>
        <div id="cb-prism-blade-list" class="cb-prism-blade-list"></div>
        <div id="cb-prism-amp-panel" class="cb-prism-amp-panel hidden" hidden aria-hidden="true" style="display:none"></div>
      </div>
    `;

    field.appendChild(nav);
    uiState.rigEl = nav;
    uiState.svgEl = nav.querySelector('#cb-prism-svg');
    uiState.cascadeListEl = nav.querySelector('#cb-prism-blade-list');
    uiState.ampPanelEl = nav.querySelector('#cb-prism-amp-panel');
    uiState.spineEl = nav.querySelector('#cb-cascade-spine');

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
    nav.querySelector('#cb-pw-guard').addEventListener('click', () => { cancelDissolve(); openGuard(); });
    nav.querySelector('#cb-pw-assist').addEventListener('click', () => { cancelDissolve(); openAssist(); });
    nav.querySelector('#cb-pw-back').addEventListener('click', () => { cancelDissolve(); closeCascade(); });
    ampMiniBtn.addEventListener('mouseenter', () => {
      uiState.hoveringAmpMini = true;
      cancelPendingHoverClear();
      if ((uiState.menuMode === 'skills' || uiState.menuMode === 'guard') && uiState.lastHoveredSkillId) {
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
    return `${mode}|${uiState.lastFieldW}x${uiState.lastFieldH}|${uiState.lastAnchorX},${uiState.lastAnchorY}|${uiState.portraitRight}:${uiState.allyPaneRight}:${uiState.corridorLeft}-${uiState.corridorRight}:${uiState.hasMidCorridor ? 1 : 0}|${uiState.skyTopY}:${uiState.skyBotY}:${uiState.enemyLeftX}|${uiState.compactMulti ? 1 : 0}|${uiState.narrowDesktop ? 1 : 0}|${uiState.shortViewport ? 1 : 0}|` + items.map((it, idx) =>
      `${idx}:${it.key}:${it.slotIdx != null ? it.slotIdx : ''}:${it.skillId || ''}:${it.name || ''}:${it.iconHtml ? 1 : 0}:${it.pathLabel || ''}:${it.cost}:${it.foot || it.desc || ''}:${it.oppLabel || ''}:${it.expKind || ''}:${it.expText || ''}:${it.disabled ? 1 : 0}`
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
      ? `<span class="cb-bl-exp is-warn" title="耳目近在咫尺，施放将增加暴露度">${escapeHtml(item.expText)}</span>`
      : (item.expKind === 'safe'
        ? `<span class="cb-bl-exp is-safe" title="${escapeHtml(item.expText || '隐蔽安全')}">隐蔽</span>`
        : '');
    const badgeHtml = item.oppLabel
      ? `<span class="cb-bl-tag opp">${escapeHtml(item.oppLabel)}</span>`
      : (!expHtml && item.pathLabel ? `<span class="cb-bl-tag">◆${escapeHtml(item.pathLabel)}</span>` : '');
    return {
      innerHtml: expHtml + badgeHtml,
      key: `${item.expKind || ''}|${item.expText || ''}|${item.oppLabel || ''}|${item.pathLabel || ''}`,
    };
  }

  function patchBladeElement(wrap, btn, item, g, idx) {
    const rotStr = String(g.rot);
    const isHovered = uiState.hoveredBladeIdx === idx;
    wrap.setAttribute('data-prism-mode', uiState.menuMode);
    wrap.dataset.rot = rotStr;
    wrap.style.left = `${g.left}px`;
    wrap.style.top = `${g.top}px`;
    wrap.classList.toggle('hovered', isHovered);
    wrap.style.transform = isHovered
      ? `translateX(0) rotate(${rotStr}deg) scale(1.015)`
      : `rotate(${rotStr}deg)`;

    const expCls = item.expKind === 'warn' ? ' is-exp-warn' : (item.expKind === 'safe' ? ' is-exp-safe' : '');
    btn.className = 'cb-blade' + (g.compact ? ' compact' : '') + (item.oppLabel ? ' opp-ready' : '') + expCls;
    btn.disabled = !!item.disabled;
    btn.setAttribute('data-prism-idx', String(idx));
    if (item.skillId) btn.setAttribute('data-sk', item.skillId);
    else btn.removeAttribute('data-sk');

    if (g.forceHeight && g.bladeH) {
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
      const toggleBtn = document.getElementById('cb-btn-prism-toggle');
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', uiState.enabled);
        toggleBtn.textContent = uiState.enabled ? '◆ 棱晶翼' : '◇ 传统列';
      }

      const field = bs.querySelector('.cb-arena-field');
      const hardDissolved = shouldHardDissolve(b);
      const dissolved = hardDissolved || isBriefDissolving();
      if (!usePrism || uiState.menuMode === 'root' || dissolved) {
        if (uiState.hoveredSkillId) {
          syncAvForecast(null, b);
        }
      }
      if (!isJsdomEnv() && isVisible(bs) && field) {
        ensureAvRail(field);
        syncAvRail(b, field);
      }

      if (!usePrism) {
        if (uiState.rigEl) uiState.rigEl.classList.remove('dissolved', 'is-hard-dissolved');
        return;
      }

      if (!field) return;
      buildRigDOM(field);
      syncLogBar(b);
      syncRigAnchor();

      const allSkills = readSkillCards();
      const enabledSkills = allSkills.filter(s => !s.disabled);
      const oppSkills = enabledSkills.filter(s => !!s.oppLabel);
      const guardSkills = allSkills.filter(s => s.isGuard && !s.disabled);
      const ampInfo = readOvercastInfo(b);
      const assistItems = readAssistItems(b);

      if (uiState.menuMode === 'amp') {
        uiState.menuMode = 'root';
      }

      uiState.rigEl.classList.toggle('dissolved', dissolved);
      uiState.rigEl.classList.toggle('is-hard-dissolved', hardDissolved);
      uiState.rigEl.classList.toggle('mode-root', uiState.menuMode === 'root');
      uiState.rigEl.classList.toggle('mode-skills', uiState.menuMode === 'skills');
      uiState.rigEl.classList.remove('mode-amp');
      uiState.rigEl.classList.toggle('mode-guard', uiState.menuMode === 'guard');
      uiState.rigEl.classList.toggle('mode-assist', uiState.menuMode === 'assist');

      // Sync Top Bar End-Turn Button (pulses when AP === 0 or no skills affordable!)
      const endTopBtn = document.getElementById('cb-btn-endturn-top');
      if (endTopBtn) {
        const noActionsLeft = !!(b && !b.over && (b.ap <= 0 || enabledSkills.length === 0));
        endTopBtn.disabled = !!(b && b.over);
        endTopBtn.classList.toggle('needs-endturn', noActionsLeft);
        endTopBtn.innerHTML = noActionsLeft
          ? '✦ 结束回合 <span class="cb-kbd">X</span>'
          : '结束回合 <span class="cb-kbd">X</span>';
      }

      // Sync Root Wing [W]（1280×720 窄翼零截断精简副标）
      const magicSub = document.getElementById('cb-pw-magic-sub');
      if (magicSub) {
        if (enabledSkills.length === 0 && b && !b.over) {
          magicSub.textContent = 'AP 用尽 · 结束回合 [X]';
        } else if (oppSkills.length > 0) {
          magicSub.textContent = `✦ ${oppSkills.length} 破招就绪 · ${enabledSkills.length}/${allSkills.length}式`;
        } else {
          magicSub.textContent = `已就绪 ${enabledSkills.length}/${allSkills.length} 式`;
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
        ampBtn.title = ampInfo.enabled
          ? (hasCycle
            ? `魔战循环 · 魔力增幅（施法命中等量回蓝；左键 / E 升档 · 右键 / Shift+E 降档 · 滚轮微调；当前：${ampInfo.badge} · +${ampInfo.extraMp} MP · ${ampInfo.multBadge}）`
            : `魔力增幅（左键 / E 升档 · 右键 / Shift+E 降档 · 滚轮微调；当前：${ampInfo.badge} · +${ampInfo.extraMp} MP · ${ampInfo.multBadge}）`)
          : '当前不可增幅';
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

      // Sync Root Wing [A]
      const guardSub = document.getElementById('cb-pw-guard-sub');
      if (guardSub) {
        if (guardSkills.length === 1) {
          guardSub.textContent = `${guardSkills[0].name} · 立即构筑`;
        } else if (guardSkills.length > 1) {
          guardSub.textContent = `${guardSkills.length} 项守势术式 · 展开选择`;
        } else {
          guardSub.textContent = '稳守结束回合 · 留存 1 AP';
        }
      }

      // Sync Root Wing [D]
      const assistSub = document.getElementById('cb-pw-assist-sub');
      if (assistSub) {
        const readyHighlights = assistItems.filter(it => !it.disabled && it.key !== 'X').map(it => it.name);
        if (readyHighlights.length) {
          assistSub.textContent = `✦ ${readyHighlights.join(' / ')} 就绪`;
        } else {
          const hasAssistItem = assistItems.some(it => it.skillId === 'tool_assist');
          const hasWandItem = assistItems.some(it => it.skillId === 'tool_wand');
          if (hasAssistItem && hasWandItem) {
            assistSub.textContent = '推演 · 援护 · 晦轮杖';
          } else if (hasAssistItem) {
            assistSub.textContent = '推演 · 援护 · 回合 [X]';
          } else if (hasWandItem) {
            assistSub.textContent = '推演 · 晦轮杖 · 回合 [X]';
          } else {
            assistSub.textContent = '推演 / 回合 [X]';
          }
        }
      }

      // Sync Spine Mini Amp Button (in-place direct step inside skill/guard/assist cascades!)
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
        miniAmp.title = ampInfo.enabled
          ? `原地调档不离列表（左键 / E 升档 · 右键 / Shift+E 降档 · 滚轮微调；当前 +${ampInfo.pctInt}% · +${ampInfo.extraMp} MP）`
          : '当前不可增幅';
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
        rawItems = allSkills;
      } else if (uiState.menuMode === 'guard') {
        rawItems = allSkills.filter(s => s.isGuard);
      } else if (uiState.menuMode === 'assist') {
        rawItems = assistItems;
      }
      const listItems = rawItems.map((it, idx) => (
        it.kind === 'skill'
          ? Object.assign({}, it, { key: idx < 9 ? String(idx + 1) : '·', displayIdx: idx })
          : Object.assign({}, it, { displayIdx: idx })
      ));
      uiState.currentItems = listItems;

      if (uiState.cascadeListEl && uiState.menuMode !== 'root') {
        const { coords, spineTop, spineLeft, twoCol } = computeBladeGeometry(listItems.length);
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
                if (liveItem) triggerSourceButton(liveItem);
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
      if (uiState.menuMode === 'guard') closeCascade();
      else openGuard();
      return;
    }

    if (k === 'd') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      cancelDissolve();
      if (uiState.menuMode === 'assist') closeCascade();
      else openAssist();
      return;
    }

    if (k === 'x') {
      const realEnd = document.getElementById('cb-btn-endturn');
      if (realEnd && !realEnd.disabled) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        triggerEndTurnAction();
      }
      return;
    }

    if (ev.key >= '1' && ev.key <= '9' && uiState.menuMode !== 'root') {
      const idx = Number(ev.key) - 1;
      const item = uiState.currentItems[idx];
      if (item && !item.disabled) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        cancelDissolve();
        triggerSourceButton(item);
      }
    }
  }

  function onContextMenu(ev) {
    if (!isActive() || uiState.menuMode === 'root') return;
    if (ev.target && ev.target.closest && ev.target.closest('#cb-pw-amp, #cb-pw-amp-mini')) return;
    ev.preventDefault();
    closeCascade();
  }

  function onCombatStateChange(ev) {
    const snap = ev && ev.detail && ev.detail.player ? ev.detail : null;
    sync(snap);
  }

  function setEnabled(flag) {
    uiState.enabled = !!flag;
    uiState.menuMode = 'root';
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
    }

    window.addEventListener('combat:statechange', onCombatStateChange);
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
    window.removeEventListener('combat:statechange', onCombatStateChange);
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
    uiState.rigEl = null;
    uiState.svgEl = null;
    uiState.cascadeListEl = null;
    uiState.ampPanelEl = null;
    uiState.spineEl = null;
    uiState.logBarEl = null;
    uiState.avRailEl = null;
    uiState.avListEl = null;
    uiState.avForecastEl = null;
    uiState.lastAvSig = '';
    uiState.lastBattleWaveKey = '';
    uiState.lastBattleTurn = -1;
    uiState.lastBattleState = null;
    uiState.hoveredSkillId = null;
    uiState.lastHoveredSkillId = null;
    uiState.hoveringAmpMini = false;
    uiState.lastSkillCastAt = 0;
    uiState.lastAmpPct = -1;
    const bs = getBattleScreen();
    if (bs) bs.classList.remove('prism-radial-active');
  }

  const CombatPrismUI = {
    mount,
    unmount,
    sync,
    ensureAvRail,
    syncAvRail,
    syncAvForecast,
    setMode,
    openSkills,
    openAmp,
    openGuard,
    openAssist,
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
      logExpanded: uiState.logExpanded,
      itemCount: uiState.currentItems.length,
      ampPct: uiState.lastAmpPct,
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
