/* =========================================================================
   《转生千金》Option 2 · P5 式希尔维亚周身棱晶放射指令翼适配器 (js/combat-prism-ui.js)
   职责：
     - 挂载于 #battle-screen .cb-arena-field，在桌面端（>=1024px）将技能选择转化为
       Persona 5 式角色锚定多面体蓝宝棱晶放射翼：
         [W] 冰水术式  → 展开实时同步自 #b-actions 的斜切术式级联翼（支持 [1..9] 直施）
         [E] 魔力增幅  → 展开三阶魔力增幅级联（0%常规 / ★20%魔力盈溢 / ★★40%极寒过载 / ★★★60%星霜极限）+ 0%–60% 磁吸微调滑条（展开后再按 E 快速切档，1/2/3/4 直选）
         [A] 守势/护盾 → 优先瞬发当前可用守势护盾技，多项时展开守势翼，无可用时稳守回合
         [D] 演武辅助  → 展开冰晶宫殿 / 心念援护 / 晦轮杖 / 结束回合四项战术翼
         [X] 结束回合  → 顶栏常驻一键结束回合（AP 归零时流光提示，绝与 [E] 增幅互不冲突）
         [L] 战报手札  → 棱晶模式底部单行实况战报条 + 可展开历史记录
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
    menuMode: 'root', // 'root' | 'skills' | 'amp' | 'guard' | 'assist'
    logExpanded: false,
    hoveredWingIdx: null,
    hoveredBladeIdx: null,
    hoveredAmpIdx: null,
    sliderDragging: false,
    sliderKeyStep: false,
    lastSliderAppliedPct: -1,
    onWindowPointerUp: null,
    bsObserver: null,
    modalObserver: null,
    rafId: 0,
    dissolveTimer: 0,
    rigEl: null,
    svgEl: null,
    cascadeListEl: null,
    ampPanelEl: null,
    ampSliderEl: null,
    ampTierBtns: [],
    spineEl: null,
    logBarEl: null,
    currentItems: [],
    lastBattleWaveKey: '',
    lastBladeSig: '',
    lastAnchorX: 280,
    lastAnchorY: 280,
    lastFieldW: 1280,
    lastFieldH: 560,
    skyTopY: 0,
    skyBotY: 540,
    portraitRight: 210,
    enemyLeftX: 0,
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

  function shouldDissolve(battleOverride) {
    const bs = getBattleScreen();
    if (!bs || !isVisible(bs)) return true;
    if (document.getElementById('cb-palace-modal') || document.getElementById('cb-result-modal')) return true;
    if (hasBlockingOverlay()) return true;
    if (Date.now() < uiState.animDissolveUntil) return true;
    const b = battleOverride || getEngineBattle();
    if (b && b.over) return true;
    return false;
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

  function snapAmpPctInt(rawInt, maxPctInt) {
    const cap = Math.max(0, Math.min(MAX_AMP_INT, Math.round(Number(maxPctInt) || 0)));
    const clamped = Math.max(0, Math.min(cap, Math.round(Number(rawInt) || 0)));
    if (cap >= 60 && Math.abs(clamped - 60) <= 2) return 60;
    if (cap >= 40 && Math.abs(clamped - 40) <= 2) return 40;
    if (cap >= 20 && Math.abs(clamped - 20) <= 2) return 20;
    return clamped;
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
      items.push({
        kind: 'tool',
        key: 'R',
        skillId: 'tool_wand',
        name: '晦轮杖',
        pathLabel: '魔法真伤',
        foot: isOn ? '真伤已展开 · 穿法抗与魔盾' : '收鞘态 · 展开享100%魔法真伤',
        cost: wandBtn.disabled ? '不可用' : (isOn ? 'ON' : 'OFF'),
        oppLabel: isOn ? '✦ 真伤 ON' : '',
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

  function applyAmpPct(pct) {
    const info = readOvercastInfo();
    if (!info.enabled) return false;
    let val = Number(pct);
    if (!isFinite(val)) val = 0;
    if (val > 1) val = val / 100;
    val = Math.max(0, Math.min(info.maxAmpCap, val));
    val = Math.round(val * 100) / 100;

    if (global.CombatEngine && typeof global.CombatEngine.setOvercastPct === 'function') {
      global.CombatEngine.setOvercastPct(val);
    } else if (global.CombatEngine && typeof global.CombatEngine.setAmpPct === 'function') {
      global.CombatEngine.setAmpPct(val);
    } else if (global.CombatEngine && typeof global.CombatEngine.setOvercast === 'function') {
      const nextMode = val >= 0.58 ? 3 : val >= 0.38 ? 2 : val >= 0.18 ? 1 : 0;
      global.CombatEngine.setOvercast(nextMode);
    }
    return true;
  }

  function selectAmpTier(pct) {
    const info = readOvercastInfo();
    if (!info.enabled) return false;
    if (pct > info.maxAmpCap + 1e-4) return false;
    return applyAmpPct(pct);
  }

  function cycleAmp(delta) {
    const step = delta < 0 ? -1 : 1;
    const info = readOvercastInfo();
    if (!info.enabled || !info.allowedTiers.length) return false;
    const tiers = info.allowedTiers.map(t => t.pct);
    const cur = info.overcastPct;
    let nextVal = tiers[0];

    if (step > 0) {
      const higher = tiers.find(v => v > cur + 0.005);
      nextVal = higher != null ? higher : tiers[0];
    } else {
      let lower = null;
      for (let i = tiers.length - 1; i >= 0; i--) {
        if (tiers[i] < cur - 0.005) {
          lower = tiers[i];
          break;
        }
      }
      nextVal = lower != null ? lower : tiers[tiers.length - 1];
    }
    return applyAmpPct(nextVal);
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

  function dispatchRealHover(btn, isEnter) {
    if (!btn) return;
    try {
      const evName = isEnter ? 'mouseenter' : 'mouseleave';
      if (isEnter && typeof btn.onmouseenter === 'function') {
        btn.onmouseenter(new MouseEvent(evName));
      } else if (!isEnter && typeof btn.onmouseleave === 'function') {
        btn.onmouseleave(new MouseEvent(evName));
      } else {
        btn.dispatchEvent(new MouseEvent(evName, { bubbles: false }));
      }
    } catch (e) {}
  }

  function clearRealHover() {
    const cards = readSkillCards();
    if (cards.length && cards[0].sourceBtn) {
      dispatchRealHover(cards[0].sourceBtn, false);
    }
    try {
      if (global.CombatEngine && typeof global.CombatEngine.syncHoverEnemyGlow === 'function') {
        global.CombatEngine.syncHoverEnemyGlow(null);
      }
    } catch (e) {}
  }

  function triggerSourceButton(item) {
    const liveBtn = resolveLiveSourceBtn(item);
    if (!item || !liveBtn || liveBtn.disabled) return false;
    uiState.hoveredBladeIdx = null;
    uiState.hoveredWingIdx = null;
    uiState.hoveredAmpIdx = null;
    uiState.menuMode = 'root';
    uiState.lastBladeSig = '';
    if (uiState.dissolveTimer) {
      clearTimeout(uiState.dissolveTimer);
      uiState.dissolveTimer = 0;
    }
    if (item.kind === 'skill') {
      uiState.animDissolveUntil = Date.now() + 260;
      uiState.dissolveTimer = setTimeout(() => {
        uiState.dissolveTimer = 0;
        sync();
      }, 280);
    }
    clearRealHover();
    liveBtn.click();
    sync();
    return true;
  }

  function setMode(nextMode) {
    const valid = nextMode === 'skills' || nextMode === 'amp' || nextMode === 'guard' || nextMode === 'assist'
      ? nextMode
      : 'root';
    if (uiState.menuMode !== valid) {
      if (uiState.menuMode === 'amp' && uiState.ampSliderEl && typeof document !== 'undefined' && document.activeElement === uiState.ampSliderEl) {
        uiState.ampSliderEl.blur();
      }
      clearRealHover();
      uiState.menuMode = valid;
      uiState.hoveredWingIdx = null;
      uiState.hoveredBladeIdx = null;
      uiState.hoveredAmpIdx = null;
      uiState.lastBladeSig = '';
      safeSfx('ui_tick');
    }
    sync();
  }

  function openSkills() { setMode('skills'); }
  function openAmp() {
    const info = readOvercastInfo();
    if (!info.enabled) return false;
    setMode('amp');
    return true;
  }
  function openGuard() {
    const guards = readSkillCards().filter(c => c.isGuard && !c.disabled);
    if (guards.length === 1) {
      triggerSourceButton(guards[0]);
      return;
    }
    if (guards.length > 1) {
      setMode('guard');
      return;
    }
    const endBtn = document.getElementById('cb-btn-endturn');
    if (endBtn && !endBtn.disabled) {
      endBtn.click();
      sync();
    }
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
    if (uiState.compactMulti) {
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
    const anchorX = Math.max(120, uiState.lastAnchorX || 260);
    const anchorY = Math.max(120, uiState.lastAnchorY || Math.round(fieldH * 0.44));
    const viewportW = uiState.viewportW || (typeof window !== 'undefined' ? window.innerWidth : 1440);
    const viewportH = uiState.viewportH || (typeof window !== 'undefined' ? window.innerHeight : 900);
    const isTightDesktop = viewportH <= 760 || viewportW <= 1320 || !!uiState.narrowDesktop || !!uiState.shortViewport;
    const compact = safeCount >= 8 || isTightDesktop;
    const isCompactSpine = !!(isTightDesktop || (uiState.compactMulti && uiState.narrowDesktop));
    const spineH = isCompactSpine ? 26 : 30;
    const spineGap = isCompactSpine ? 6 : 10;
    const minLeftFromPortrait = Math.max(20, (uiState.portraitRight - anchorX) + 12);

    // 凡技能 >= 7（或在矮/窄桌面 <=760h / <=1320w 或多敌时 >= 6），无论单敌还是多敌一律切双列天区紧凑排版，按真实障碍物夹紧上下包络
    const twoCol = safeCount >= 7 || (isTightDesktop && safeCount >= 6) || (!!uiState.compactMulti && safeCount >= 6);
    if (twoCol) {
      const col1Count = Math.ceil(safeCount / 2);
      const col2Count = safeCount - col1Count;
      const bladeW = isTightDesktop ? 266 : 292;
      let colGap = isTightDesktop ? 14 : 20;
      let col1Left = minLeftFromPortrait;
      let col2Left = col1Left + bladeW + colGap;

      // 单敌/双敌若双列右侧逼近敌卡，优先温和收拢列距并左贴希尔维亚立绘右沿，避免与敌卡水平撞车
      if (!uiState.compactMulti && uiState.enemyLeftX > 0) {
        const enemyLimitInRig = (uiState.enemyLeftX - 10) - anchorX;
        if (col2Left + bladeW > enemyLimitInRig) {
          colGap = isTightDesktop ? 10 : 12;
          const tightLeft = Math.max(12, (uiState.portraitRight - anchorX) + 6);
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
          forceHeight,
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

    // 少技能场景（<=5 式或宽大屏 <=6 式单敌）：延续经典弧形单列棱晶翼并动态夹紧可视边界
    const baseX = uiState.compactMulti ? Math.max(30, minLeftFromPortrait) : Math.max(52, minLeftFromPortrait);
    const singleW = isTightDesktop ? 320 : 352;
    const { safeTop, safeBot } = resolveBladeVerticalBounds(anchorX + baseX, anchorX + baseX + singleW, fieldH);
    const minTopOffset = (safeTop + spineH + spineGap) - anchorY;
    const maxBotOffset = safeBot - anchorY;
    const availSpan = Math.max(160, maxBotOffset - minTopOffset);
    const defaultBladeH = compact ? (availSpan < 340 ? 38 : 42) : 48;
    const fitBladeH = safeCount > 0 ? Math.floor((availSpan - Math.max(0, safeCount - 1) * 2) / safeCount) : defaultBladeH;
    const bladeH = Math.max(32, Math.min(defaultBladeH, fitBladeH));
    const forceHeight = bladeH < defaultBladeH;
    const idealStep = safeCount <= 4 ? 64 : safeCount === 5 ? 56 : 50;
    const maxAllowedStep = safeCount > 1 ? Math.floor((availSpan - bladeH) / (safeCount - 1)) : idealStep;
    const stepY = safeCount > 1 ? Math.max(bladeH + 2, Math.min(idealStep, maxAllowedStep)) : idealStep;

    const totalH = (safeCount - 1) * stepY + bladeH;
    let startY = -Math.round(totalH * 0.50);
    if (startY < minTopOffset) startY = minTopOffset;
    if (startY + totalH > maxBotOffset) startY = Math.max(minTopOffset, maxBotOffset - totalH);

    const arcX = uiState.compactMulti ? 16 : 28;
    const maxRot = compact ? 1.4 : 2.4;

    const coords = [];
    for (let i = 0; i < safeCount; i++) {
      const frac = safeCount === 1 ? 0.5 : i / (safeCount - 1);
      const curveX = Math.round(baseX + Math.sin(frac * Math.PI) * arcX);
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
        forceHeight,
        tipX: curveX + 4,
        tipY: topY + Math.round(bladeH * 0.5),
        elbowX: Math.round(curveX * 0.54),
        elbowY: Math.round((topY + Math.round(bladeH * 0.5)) * 0.65),
      });
    }
    return {
      coords,
      spineTop: Math.max(safeTop - anchorY, startY - (spineH + spineGap)),
      spineLeft: baseX - 8,
      bladeH,
      twoCol: false,
    };
  }

  function computeAmpPanelGeometry() {
    const fieldH = Math.max(360, uiState.lastFieldH || 560);
    const anchorX = Math.max(120, uiState.lastAnchorX || 260);
    const anchorY = Math.max(120, uiState.lastAnchorY || Math.round(fieldH * 0.44));
    const compact = !!(uiState.compactMulti || uiState.narrowDesktop || uiState.shortViewport);
    const isNarrowMulti = !!(uiState.compactMulti && uiState.narrowDesktop);
    const spineH = (isNarrowMulti || uiState.shortViewport) ? 26 : 30;
    const spineGap = (isNarrowMulti || uiState.shortViewport) ? 6 : 10;

    const tierCount = V22_AMP_TIERS.length;
    const tierH = isNarrowMulti ? 34 : (compact ? 38 : 44);
    const fineH = isNarrowMulti ? 74 : (compact ? 82 : 92);
    const panelH = tierH * tierCount + fineH;
    const minLeftFromPortrait = Math.max(28, (uiState.portraitRight - anchorX) + 12);
    const panelLeft = uiState.compactMulti ? minLeftFromPortrait : Math.max(56, minLeftFromPortrait);
    const panelW = compact ? 336 : 368;
    const { safeTop, safeBot } = resolveBladeVerticalBounds(anchorX + panelLeft, anchorX + panelLeft + panelW, fieldH);

    const minTopOffset = (safeTop + spineH + spineGap) - anchorY;
    const maxBotOffset = safeBot - anchorY;
    let panelTop = (uiState.compactMulti || uiState.shortViewport)
      ? Math.round(minTopOffset + Math.max(0, (maxBotOffset - minTopOffset - panelH) * 0.35))
      : -Math.round(panelH * 0.48);
    if (panelTop < minTopOffset) panelTop = minTopOffset;
    if (panelTop + panelH > maxBotOffset) panelTop = Math.max(minTopOffset, maxBotOffset - panelH);

    const targets = [];
    for (let i = 0; i < tierCount; i++) {
      const midY = Math.round(panelTop + tierH * (i + 0.5));
      targets.push({
        tipX: panelLeft + 3,
        tipY: midY,
        elbowX: Math.round(panelLeft * 0.54),
        elbowY: Math.round(midY * 0.66),
        hero: i === 1 || i === 3,
      });
    }
    const fineMidY = Math.round(panelTop + tierH * tierCount + fineH * 0.46);
    targets.push({
      tipX: panelLeft + 3,
      tipY: fineMidY,
      elbowX: Math.round(panelLeft * 0.54),
      elbowY: Math.round(fineMidY * 0.66),
      hero: false,
    });

    return {
      panelLeft,
      panelTop,
      panelH,
      spineTop: Math.max(safeTop - anchorY, panelTop - (spineH + spineGap)),
      spineLeft: panelLeft,
      targets,
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

  function syncRigAnchor() {
    if (!uiState.rigEl) return;
    const field = uiState.rigEl.parentElement;
    const playerStage = document.getElementById('cb-player-stage');
    if (!field || !playerStage) return;
    const fRect = field.getBoundingClientRect();
    const pRect = playerStage.getBoundingClientRect();
    if (fRect.width < 100 || pRect.width < 40) return;

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
    uiState.compactMulti = isMulti;
    uiState.narrowDesktop = isNarrowDesktop;
    uiState.rigEl.classList.toggle('compact-multi', isMulti);
    uiState.rigEl.classList.toggle('narrow-desktop', isNarrowDesktop);

    // 实时测算战场中真实遮挡边界（上方敌人意图栏底沿、下方敌方立绘/信息卡与我方面板顶沿、左侧立绘右沿）
    let intentMaxBottom = 0;
    let enemyMinTop = fRect.height;
    let enemyMinLeft = fRect.width;
    const obstacles = [];
    if (eZone) {
      eZone.querySelectorAll('.cb-enemy-card').forEach(card => {
        const cr = card.getBoundingClientRect();
        if (cr.width > 12 && cr.height > 12) {
          enemyMinLeft = Math.min(enemyMinLeft, cr.left - fRect.left);
        }
      });
      eZone.querySelectorAll('.cb-intent-banner').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.height > 4) {
          const bottom = r.bottom - fRect.top;
          intentMaxBottom = Math.max(intentMaxBottom, bottom);
          obstacles.push({
            kind: 'intent',
            left: r.left - fRect.left,
            top: r.top - fRect.top,
            right: r.right - fRect.left,
            bottom,
          });
        }
      });
      eZone.querySelectorAll('.cb-px-actor, .cb-e-plate').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.height > 12) {
          const top = r.top - fRect.top;
          enemyMinTop = Math.min(enemyMinTop, top);
          obstacles.push({
            kind: 'lower',
            left: r.left - fRect.left,
            top,
            right: r.right - fRect.left,
            bottom: r.bottom - fRect.top,
          });
        }
      });
    }
    const playerPane = document.getElementById('cb-player-pane');
    let paneTop = fRect.height;
    if (playerPane) {
      const pr = playerPane.getBoundingClientRect();
      if (pr.height > 12) {
        paneTop = pr.top - fRect.top;
        obstacles.push({
          kind: 'lower',
          left: pr.left - fRect.left,
          top: paneTop,
          right: pr.right - fRect.left,
          bottom: pr.bottom - fRect.top,
        });
      }
    }
    const pActor = document.querySelector('#cb-p-portrait .cb-px-actor') || document.getElementById('cb-p-portrait');
    const portraitRight = pActor && pActor.getBoundingClientRect().width > 12
      ? Math.round(pActor.getBoundingClientRect().right - fRect.left)
      : Math.round(pRect.right - fRect.left - 80);

    uiState.lastFieldW = Math.round(fRect.width);
    uiState.lastFieldH = Math.round(fRect.height);
    uiState.skyTopY = Math.max(0, Math.round(intentMaxBottom));
    uiState.skyBotY = Math.max(uiState.skyTopY + 140, Math.round(Math.min(enemyMinTop, paneTop)));
    uiState.portraitRight = Math.max(120, portraitRight);
    uiState.enemyLeftX = enemyMinLeft < fRect.width ? Math.round(enemyMinLeft) : 0;
    uiState.obstacles = obstacles;

    const stageRight = pRect.right - fRect.left;
    let anchorX;
    let anchorY;
    if (isMulti) {
      const pullLeft = isNarrowDesktop ? 106 : 82;
      const minX = isNarrowDesktop ? 152 : 176;
      anchorX = Math.round(Math.min(fRect.width * 0.24, Math.max(minX, stageRight - pullLeft)));
      const skyMid = Math.round((uiState.skyTopY + uiState.skyBotY) * 0.52);
      if (isNarrowDesktop) {
        const minAy = Math.min(180, Math.round(fRect.height * 0.34));
        const maxAy = Math.max(minAy, Math.round(fRect.height - 220));
        anchorY = Math.round(Math.max(minAy, Math.min(maxAy, skyMid)));
      } else {
        const minAy = Math.min(200, Math.round(fRect.height * 0.38));
        const maxAy = Math.max(minAy, Math.round(fRect.height - 190));
        anchorY = Math.round(Math.max(minAy, Math.min(maxAy, skyMid)));
      }
    } else {
      anchorX = Math.round(Math.min(fRect.width * 0.34, Math.max(196, stageRight - 44)));
      const minAy = Math.min(200, Math.round(fRect.height * 0.42));
      const maxAy = Math.max(minAy, Math.round(fRect.height - 172));
      anchorY = Math.round(Math.max(minAy, Math.min(maxAy, fRect.height * 0.44)));
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
        const realEnd = document.getElementById('cb-btn-endturn');
        if (realEnd && !realEnd.disabled) {
          uiState.menuMode = 'root';
          uiState.lastBladeSig = '';
          clearRealHover();
          realEnd.click();
          sync();
        }
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
      btn.title = '切换 P5 棱晶放射指令翼 / 传统底部技能栏';
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

  function ensurePrismExposureStyle() {
    if (typeof document === 'undefined' || document.getElementById('cb-prism-exp-inline-style')) return;
    const style = document.createElement('style');
    style.id = 'cb-prism-exp-inline-style';
    style.textContent = [
      '.cb-bl-tags-right{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;}',
      '.cb-bl-exp{font-size:10px;font-weight:700;line-height:1.22;padding:1px 5px;white-space:nowrap;flex-shrink:0;letter-spacing:0.02em;}',
      '.cb-bl-exp.is-warn{color:#b41f35;background:rgba(201,42,62,0.13);border-left:2px solid #c92a3e;}',
      '.cb-bl-exp.is-safe{color:#0b6e76;background:rgba(15,139,146,0.11);border-left:2px solid #0f8b92;}',
      '.cb-blade:not(:disabled):hover .cb-bl-exp.is-warn,.cb-blade-wrap.hovered .cb-blade:not(:disabled) .cb-bl-exp.is-warn{color:#ffe082;background:rgba(255,209,128,0.22);border-left-color:#ffd180;}',
      '.cb-blade:not(:disabled):hover .cb-bl-exp.is-safe,.cb-blade-wrap.hovered .cb-blade:not(:disabled) .cb-bl-exp.is-safe{color:#c4f9ff;background:rgba(155,244,255,0.18);border-left-color:#9bf4ff;}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);
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

    const tierBladesHtml = V22_AMP_TIERS.map(t => {
      const tierCls = t.tier === 3 ? ' is-tier-3' : (t.tier === 2 ? ' is-tier-2' : '');
      return `
      <button type="button" class="cb-amp-tier-blade${tierCls}" data-amp-tier="${t.tier}" data-amp-pct="${t.pct}">
        <span class="cb-atb-key">${t.key}</span>
        <div class="cb-atb-body">
          <div class="cb-atb-top">
            <span class="cb-atb-title">${escapeHtml(t.name)}</span>
            <span class="cb-atb-mult">${escapeHtml(t.multLabel)}</span>
          </div>
          <div class="cb-atb-bot">
            <span class="cb-atb-meta">${escapeHtml(t.effect)}</span>
            <span class="cb-atb-cost">+0 MP</span>
          </div>
        </div>
      </button>
    `;
    }).join('');

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
              <span class="cb-pw-sub" id="cb-pw-magic-sub">展开全部可用战术术式</span>
            </div>
            <span class="cb-pw-arrow">▸</span>
          </button>
        </div>

        <div class="cb-pwing-wrap" data-wing="1">
          <button type="button" class="cb-pwing cb-prism-wing" id="cb-pw-amp" title="展开三阶魔力增幅面板（快捷键 E；展开后再按 E 快速切档或 1/2/3/4 直选）">
            <span class="cb-pw-key">E</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">魔力增幅</span>
                <span class="cb-pw-en" id="cb-pw-amp-en">1.00×</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-amp-sub"><span class="cb-amp-crystals"><span class="cb-amp-crys"></span><span class="cb-amp-crys"></span><span class="cb-amp-crys"></span></span><span class="cb-amp-badge">常规</span></span>
            </div>
            <span class="cb-pw-arrow">▸</span>
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
          <button type="button" class="cb-spine-btn amp-mini" id="cb-pw-amp-mini" title="展开三阶魔力增幅或快速切档（快捷键 E）">✦ [E] 增幅 常规</button>
        </div>
        <div id="cb-prism-blade-list" class="cb-prism-blade-list"></div>
        <div id="cb-prism-amp-panel" class="cb-prism-amp-panel" role="region" aria-label="三阶魔力增幅面板">
          <div class="cb-amp-tiers" id="cb-amp-tiers">${tierBladesHtml}</div>
          <div class="cb-amp-finetune" id="cb-amp-finetune">
            <div class="cb-amp-ft-head">
              <span class="cb-amp-ft-label">精细控魔 · 魔力微调</span>
              <div class="cb-amp-ft-metrics">
                <span class="cb-amp-ft-pct" id="cb-amp-ft-pct">0%</span>
                <span class="cb-amp-ft-sep">·</span>
                <span class="cb-amp-ft-mp" id="cb-amp-ft-mp">+0 MP</span>
                <span class="cb-amp-ft-sep">·</span>
                <span class="cb-amp-ft-mult" id="cb-amp-ft-mult">1.00×</span>
              </div>
            </div>
            <div class="cb-amp-slider-wrap">
              <div class="cb-amp-rail-marks" aria-hidden="true">
                <span class="cb-amp-notch t1" id="cb-amp-notch-t1"></span>
                <span class="cb-amp-notch t2" id="cb-amp-notch-t2"></span>
                <span class="cb-amp-notch t3" id="cb-amp-notch-t3"></span>
              </div>
              <input type="range" id="cb-amp-slider" class="cb-amp-slider" min="0" max="60" step="1" value="0" aria-label="精细控魔增幅百分比" />
              <div class="cb-amp-ticks" id="cb-amp-ticks">
                <button type="button" class="cb-amp-tick" data-amp-snap="0">0%</button>
                <button type="button" class="cb-amp-tick t1" data-amp-snap="20">20% ★</button>
                <button type="button" class="cb-amp-tick t2" data-amp-snap="40">40% ★★</button>
                <button type="button" class="cb-amp-tick t3" data-amp-snap="60">60% ★★★</button>
              </div>
            </div>
            <div class="cb-amp-ft-note" id="cb-amp-ft-note">1% 步进 · 20%★ / 40%★★ / 60%★★★ 处 ±2% 磁吸吸附</div>
          </div>
        </div>
      </div>
    `;

    field.appendChild(nav);
    uiState.rigEl = nav;
    uiState.svgEl = nav.querySelector('#cb-prism-svg');
    uiState.cascadeListEl = nav.querySelector('#cb-prism-blade-list');
    uiState.ampPanelEl = nav.querySelector('#cb-prism-amp-panel');
    uiState.ampSliderEl = nav.querySelector('#cb-amp-slider');
    uiState.ampTierBtns = Array.from(nav.querySelectorAll('.cb-amp-tier-blade'));
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

    nav.querySelector('#cb-pw-magic').addEventListener('click', () => openSkills());
    nav.querySelector('#cb-pw-amp').addEventListener('click', () => openAmp());
    nav.querySelector('#cb-pw-amp').addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); cycleAmp(-1); });
    nav.querySelector('#cb-pw-guard').addEventListener('click', () => openGuard());
    nav.querySelector('#cb-pw-assist').addEventListener('click', () => openAssist());
    nav.querySelector('#cb-pw-back').addEventListener('click', () => closeCascade());
    nav.querySelector('#cb-pw-amp-mini').addEventListener('click', () => {
      if (uiState.menuMode === 'amp') cycleAmp(1);
      else openAmp();
    });
    nav.querySelector('#cb-pw-amp-mini').addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); cycleAmp(-1); });

    // Bind persistent tier blade handlers ONCE (updated strictly in-place!)
    uiState.ampTierBtns.forEach((btn, idx) => {
      const pct = Number(btn.getAttribute('data-amp-pct')) || 0;
      btn.addEventListener('mouseenter', () => {
        uiState.hoveredAmpIdx = idx;
        renderCurrentSvg();
      });
      btn.addEventListener('mouseleave', () => {
        if (uiState.hoveredAmpIdx === idx) uiState.hoveredAmpIdx = null;
        renderCurrentSvg();
      });
      btn.addEventListener('click', () => {
        if (!btn.disabled) selectAmpTier(pct);
      });
    });

    // Bind persistent slider tick shortcuts
    nav.querySelectorAll('.cb-amp-tick').forEach(tickBtn => {
      const snapVal = Number(tickBtn.getAttribute('data-amp-snap')) || 0;
      tickBtn.addEventListener('click', () => {
        if (!tickBtn.disabled) selectAmpTier(snapVal / 100);
      });
    });

    // Bind persistent magnetic fine-tune slider (NEVER recreated during drag!)
    const slider = uiState.ampSliderEl;
    if (slider) {
      const startDrag = () => {
        uiState.sliderDragging = true;
        uiState.lastSliderAppliedPct = -1;
      };
      slider.addEventListener('pointerdown', startDrag);
      slider.addEventListener('mousedown', startDrag);
      slider.addEventListener('keydown', ev => {
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
          uiState.sliderKeyStep = true;
        }
      });
      slider.addEventListener('input', () => {
        const info = readOvercastInfo();
        if (!info.enabled || info.maxPctInt <= 0) return;
        const rawInt = Number(slider.value);
        const finalInt = uiState.sliderKeyStep
          ? Math.max(0, Math.min(info.maxPctInt, Math.round(rawInt)))
          : snapAmpPctInt(rawInt, info.maxPctInt);
        uiState.sliderKeyStep = false;
        if (String(finalInt) !== slider.value) {
          slider.value = String(finalInt);
        }
        const fillPct = Math.max(0, Math.min(100, (finalInt / MAX_AMP_INT) * 100));
        slider.style.setProperty('--amp-fill', `${fillPct.toFixed(1)}%`);
        if (finalInt !== uiState.lastSliderAppliedPct) {
          uiState.lastSliderAppliedPct = finalInt;
          applyAmpPct(finalInt / 100);
        }
      });
      slider.addEventListener('change', () => {
        uiState.sliderDragging = false;
        uiState.lastSliderAppliedPct = -1;
      });
    }

    return nav;
  }

  function syncAmpPanel(ampInfo) {
    if (!uiState.ampPanelEl) return;
    const geom = computeAmpPanelGeometry();
    uiState.ampPanelEl.style.left = `${geom.panelLeft}px`;
    uiState.ampPanelEl.style.top = `${geom.panelTop}px`;
    if (uiState.rigEl) uiState.rigEl.classList.remove('two-col-blades');
    uiState.twoColBlades = false;
    if (uiState.spineEl) {
      uiState.spineEl.style.top = `${geom.spineTop}px`;
      uiState.spineEl.style.left = `${geom.spineLeft}px`;
    }

    // Update 4 canonical 3-tier amp blades in-place
    uiState.ampTierBtns.forEach((btn, i) => {
      const t = V22_AMP_TIERS[i];
      if (!t) return;
      const isLocked = !ampInfo.enabled || t.pct > ampInfo.maxAmpCap + 1e-4;
      const isActive = ampInfo.enabled && !isLocked && ampInfo.tier === t.tier;
      const isExact = isActive && Math.abs(ampInfo.overcastPct - t.pct) <= 0.005;

      btn.disabled = isLocked;
      btn.classList.toggle('is-locked', isLocked);
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('is-finetuned', isActive && !isExact);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

      const multEl = btn.querySelector('.cb-atb-mult');
      const costEl = btn.querySelector('.cb-atb-cost');
      if (multEl) {
        const liveTierMult = Array.isArray(ampInfo.ampTierMults) && typeof ampInfo.ampTierMults[t.tier] === 'number'
          ? `${ampInfo.ampTierMults[t.tier].toFixed(2)}×`
          : t.multLabel;
        multEl.textContent = isLocked ? `上限 ${ampInfo.maxPctInt}%` : liveTierMult;
      }
      if (costEl) {
        if (isLocked) {
          costEl.textContent = '已锁定';
        } else {
          const mpDelta = (Array.isArray(ampInfo.ampTierExtraMps) && typeof ampInfo.ampTierExtraMps[t.tier] === 'number' && isFinite(ampInfo.ampTierExtraMps[t.tier]))
            ? ampInfo.ampTierExtraMps[t.tier]
            : Math.round(ampInfo.maxMp * t.pct * (ampInfo.ampDiscountFactor != null ? ampInfo.ampDiscountFactor : 1));
          costEl.textContent = `+${mpDelta} MP`;
        }
      }
    });

    // Update fine-tune slider and live readouts in-place (zero DOM destruction!)
    // Range stays on fixed 0..60 scale so 20%★ (33.33%) / 40%★★ (66.67%) / 60%★★★ (100%) notches always align;
    // values above maxAmpCap are visually locked and clamped cleanly.
    const slider = uiState.ampSliderEl;
    const sliderMax = Math.max(0, ampInfo.maxPctInt);
    if (slider) {
      slider.disabled = !ampInfo.enabled || sliderMax <= 0;
      const targetStr = String(ampInfo.pctInt);
      if (!uiState.sliderDragging && slider.value !== targetStr) {
        slider.value = targetStr;
      }
      const curInt = uiState.sliderDragging
        ? Math.min(sliderMax, Number(slider.value) || 0)
        : ampInfo.pctInt;
      const fillPct = Math.max(0, Math.min(100, (curInt / MAX_AMP_INT) * 100));
      const capPct = Math.max(0, Math.min(100, (sliderMax / MAX_AMP_INT) * 100));
      slider.style.setProperty('--amp-fill', `${fillPct.toFixed(1)}%`);
      slider.style.setProperty('--amp-cap', `${capPct.toFixed(1)}%`);
      slider.classList.toggle('tier-1', ampInfo.tier === 1);
      slider.classList.toggle('tier-2', ampInfo.tier === 2);
      slider.classList.toggle('tier-3', ampInfo.tier >= 3);
    }

    const notchT1 = uiState.ampPanelEl.querySelector('#cb-amp-notch-t1');
    const notchT2 = uiState.ampPanelEl.querySelector('#cb-amp-notch-t2');
    const notchT3 = uiState.ampPanelEl.querySelector('#cb-amp-notch-t3');
    if (notchT1) {
      notchT1.style.left = '33.33%';
      notchT1.classList.toggle('is-locked', sliderMax < 20);
      notchT1.classList.toggle('lit', ampInfo.tier >= 1 && sliderMax >= 20);
    }
    if (notchT2) {
      notchT2.style.left = '66.67%';
      notchT2.classList.toggle('is-locked', sliderMax < 40);
      notchT2.classList.toggle('lit', ampInfo.tier >= 2 && sliderMax >= 40);
    }
    if (notchT3) {
      notchT3.style.left = '100%';
      notchT3.classList.toggle('is-locked', sliderMax < 60);
      notchT3.classList.toggle('lit', ampInfo.tier >= 3 && sliderMax >= 60);
    }

    const ticks = uiState.ampPanelEl.querySelectorAll('.cb-amp-tick');
    ticks.forEach(tb => {
      const snapInt = Number(tb.getAttribute('data-amp-snap')) || 0;
      const locked = !ampInfo.enabled || snapInt > sliderMax;
      tb.disabled = locked;
      tb.classList.toggle('is-locked', locked);
      tb.classList.toggle('active', !locked && Math.abs(ampInfo.pctInt - snapInt) <= 0);
      if (snapInt === 40) {
        tb.textContent = locked ? '40% 锁定' : '40% ★★';
      } else if (snapInt === 60) {
        tb.textContent = locked ? '60% 锁定' : '60% ★★★';
      }
    });

    const pctEl = uiState.ampPanelEl.querySelector('#cb-amp-ft-pct');
    const mpEl = uiState.ampPanelEl.querySelector('#cb-amp-ft-mp');
    const multEl = uiState.ampPanelEl.querySelector('#cb-amp-ft-mult');
    const noteEl = uiState.ampPanelEl.querySelector('#cb-amp-ft-note');

    if (pctEl) {
      pctEl.textContent = `${ampInfo.pctInt}%`;
      pctEl.classList.toggle('tier-1', ampInfo.tier === 1);
      pctEl.classList.toggle('tier-2', ampInfo.tier === 2);
      pctEl.classList.toggle('tier-3', ampInfo.tier >= 3);
    }
    if (mpEl) {
      mpEl.textContent = `+${ampInfo.extraMp} MP`;
    }
    if (multEl) {
      multEl.textContent = `${ampInfo.ampMult.toFixed(2)}×`;
      multEl.classList.toggle('tier-1', ampInfo.tier === 1);
      multEl.classList.toggle('tier-2', ampInfo.tier === 2);
      multEl.classList.toggle('tier-3', ampInfo.tier >= 3);
    }
    if (noteEl) {
      if (!ampInfo.enabled) {
        noteEl.textContent = '当前战局不可启用魔力增幅';
      } else if (ampInfo.pctInt <= 0) {
        noteEl.textContent = sliderMax < 60
          ? `常规施法 · 本战上限 ${sliderMax}%，拖动 1% 步进并在档位处 ±2% 磁吸`
          : '常规施法 · 拖动 1% 步进，20%★ / 40%★★ / 60%★★★ 处 ±2% 磁吸';
      } else if (ampInfo.tier >= 3) {
        noteEl.textContent = '★★★星霜极限已激活 · +3破锁 · 30%穿抗 · 限手持重术';
      } else if (ampInfo.tier >= 2) {
        noteEl.textContent = sliderMax >= 60
          ? `★★极寒过载已激活（+2破锁 · 20%穿抗）· 距 ★★★极限 差 ${Math.max(0, 60 - ampInfo.pctInt)}%`
          : '★★极寒过载已激活 · +2破锁 · 20%穿抗 · 护盾+45%';
      } else if (ampInfo.tier >= 1) {
        noteEl.textContent = sliderMax >= 40
          ? `★魔力盈溢已激活（+1破锁 · 10%穿抗）· 距 ★★过载 差 ${Math.max(0, 40 - ampInfo.pctInt)}%`
          : '★魔力盈溢已激活 · +1破锁 · 10%穿抗 · 护盾+35%';
      } else {
        noteEl.textContent = `魔力蓄势段 · 距 ★魔力盈溢 差 ${Math.max(0, 20 - ampInfo.pctInt)}%`;
      }
    }
  }

  function renderCurrentSvg(ampInfoOverride) {
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
    } else if (uiState.menuMode === 'amp') {
      const { targets } = computeAmpPanelGeometry();
      const info = ampInfoOverride || readOvercastInfo();
      const litIdx = uiState.hoveredAmpIdx != null ? uiState.hoveredAmpIdx : (info ? info.tier : 0);
      renderSvgHairlines(targets, litIdx);
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
    return `${mode}|${uiState.lastFieldW}x${uiState.lastFieldH}|${uiState.skyTopY}:${uiState.skyBotY}:${uiState.enemyLeftX}|${uiState.compactMulti ? 1 : 0}|${uiState.narrowDesktop ? 1 : 0}|${uiState.shortViewport ? 1 : 0}|` + items.map((it, idx) =>
      `${idx}:${it.key}:${it.slotIdx != null ? it.slotIdx : ''}:${it.skillId || ''}:${it.name || ''}:${it.pathLabel || ''}:${it.cost}:${it.foot || it.desc || ''}:${it.oppLabel || ''}:${it.expKind || ''}:${it.expText || ''}:${it.disabled ? 1 : 0}`
    ).join('||');
  }

  function sync(battleOverride) {
    if (uiState.syncing) return;
    uiState.syncing = true;
    try {
      const bs = getBattleScreen();
      if (!bs) return;

      const b = battleOverride || getEngineBattle();
      const bwKey = b ? `${b.battleInstanceId || 0}:${b.waveIdx || 0}` : '';
      if (bwKey && bwKey !== uiState.lastBattleWaveKey) {
        uiState.lastBattleWaveKey = bwKey;
        uiState.menuMode = 'root';
        uiState.logExpanded = false;
        uiState.hoveredWingIdx = null;
        uiState.hoveredBladeIdx = null;
        uiState.hoveredAmpIdx = null;
        uiState.sliderDragging = false;
        uiState.lastSliderAppliedPct = -1;
        uiState.lastBladeSig = '';
        uiState.animDissolveUntil = 0;
        if (uiState.dissolveTimer) {
          clearTimeout(uiState.dissolveTimer);
          uiState.dissolveTimer = 0;
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

      if (!usePrism) {
        if (uiState.rigEl) uiState.rigEl.classList.remove('dissolved');
        return;
      }

      const field = bs.querySelector('.cb-arena-field');
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

      if (uiState.menuMode === 'amp' && !ampInfo.enabled) {
        uiState.menuMode = 'root';
      }

      const dissolved = shouldDissolve(b);
      uiState.rigEl.classList.toggle('dissolved', dissolved);
      uiState.rigEl.classList.toggle('mode-root', uiState.menuMode === 'root');
      uiState.rigEl.classList.toggle('mode-skills', uiState.menuMode === 'skills');
      uiState.rigEl.classList.toggle('mode-amp', uiState.menuMode === 'amp');
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

      // Sync Root Wing [W]
      const magicSub = document.getElementById('cb-pw-magic-sub');
      if (magicSub) {
        if (enabledSkills.length === 0 && b && !b.over) {
          magicSub.textContent = 'AP 已用尽 · 请点击「结束回合 [X]」';
        } else if (oppSkills.length > 0) {
          magicSub.textContent = `✦ ${oppSkills.length} 项破招/看破就绪 · 共 ${enabledSkills.length}/${allSkills.length} 式`;
        } else {
          magicSub.textContent = `展开术式级联 · 可用 ${enabledSkills.length}/${allSkills.length} 式`;
        }
      }

      // Sync Root Wing [E] — 3 diamond crystal pips (tier 1 sapphire, tier 2 frost-sapphire, tier 3 champagne-gold) + crisp live badge
      const ampBtn = document.getElementById('cb-pw-amp');
      const ampEn = document.getElementById('cb-pw-amp-en');
      const ampSub = document.getElementById('cb-pw-amp-sub');
      if (ampBtn && ampSub) {
        ampBtn.disabled = !ampInfo.enabled;
        ampBtn.classList.toggle('amp-charged', ampInfo.enabled && ampInfo.overcastPct > 0.001);
        ampBtn.classList.toggle('amp-tier-2', ampInfo.enabled && ampInfo.tier === 2);
        ampBtn.classList.toggle('amp-tier-3', ampInfo.enabled && ampInfo.tier >= 3);
        ampBtn.classList.toggle('amp-max', ampInfo.enabled && ampInfo.tier >= 3);
        ampBtn.title = ampInfo.enabled
          ? `展开三阶魔力增幅级联（当前：${ampInfo.badge} · +${ampInfo.extraMp}MP · ${ampInfo.multBadge}）`
          : '当前不可增幅';
        if (ampEn) {
          ampEn.textContent = (!uiState.compactMulti && ampInfo.enabled && ampInfo.lockHint)
            ? `${ampInfo.multBadge}${ampInfo.lockHint}`
            : ampInfo.multBadge;
        }
        const t = ampInfo.enabled ? ampInfo.tier : 0;
        const pip1Cls = t >= 3 ? ' lit-t3' : t === 2 ? ' lit-t2' : t === 1 ? ' lit-t1' : '';
        const pip2Cls = t >= 3 ? ' lit-t3' : t === 2 ? ' lit-t2' : '';
        const pip3Cls = t >= 3 ? ' lit-t3' : '';
        const crysHtml =
          `<span class="cb-amp-crystals" aria-hidden="true">` +
            `<span class="cb-amp-crys${pip1Cls}"></span>` +
            `<span class="cb-amp-crys${pip2Cls}"></span>` +
            `<span class="cb-amp-crys${pip3Cls}"></span>` +
          `</span>`;
        const mpSuffix = (!uiState.compactMulti && ampInfo.enabled && ampInfo.extraMp > 0)
          ? `<span class="cb-amp-mp"> · +${ampInfo.extraMp}MP</span>`
          : '';
        ampSub.innerHTML = `${crysHtml}<span class="cb-amp-badge">${escapeHtml(ampInfo.badge)}</span>${mpSuffix}`;
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

      // Sync Spine Mini Amp Button
      const miniAmp = document.getElementById('cb-pw-amp-mini');
      if (miniAmp) {
        miniAmp.disabled = !ampInfo.enabled;
        miniAmp.classList.toggle('charged', ampInfo.enabled && ampInfo.overcastPct > 0.001);
        miniAmp.classList.toggle('tier-3', ampInfo.enabled && ampInfo.tier >= 3);
        miniAmp.classList.toggle('max-tier', ampInfo.enabled && ampInfo.tier >= 3);
        if (!ampInfo.enabled) {
          miniAmp.textContent = '◇ 不可增幅';
        } else if (uiState.menuMode === 'amp') {
          miniAmp.textContent = `✦ [E] 切档 · ${ampInfo.badge}`;
        } else {
          miniAmp.textContent = `✦ [E] 增幅 ${ampInfo.shortLabel} (${ampInfo.multBadge})`;
        }
      }

      // Populate Active Cascade Mode
      if (uiState.menuMode === 'amp') {
        uiState.currentItems = [];
        syncAmpPanel(ampInfo);
      } else {
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
            uiState.cascadeListEl.innerHTML = '';

            listItems.forEach((item, idx) => {
              const g = coords[idx];
              const wrap = document.createElement('div');
              wrap.className = 'cb-blade-wrap' + (uiState.hoveredBladeIdx === idx ? ' hovered' : '');
              wrap.style.left = `${g.left}px`;
              wrap.style.top = `${g.top}px`;
              wrap.style.transform = uiState.hoveredBladeIdx === idx
                ? `translateX(14px) rotate(${g.rot}deg) scale(1.025)`
                : `rotate(${g.rot}deg)`;

              const btn = document.createElement('button');
              btn.type = 'button';
              const expCls = item.expKind === 'warn' ? ' is-exp-warn' : (item.expKind === 'safe' ? ' is-exp-safe' : '');
              btn.className = 'cb-blade' + (g.compact ? ' compact' : '') + (item.oppLabel ? ' opp-ready' : '') + expCls;
              btn.disabled = !!item.disabled;
              btn.setAttribute('data-prism-idx', String(idx));
              if (item.skillId) btn.setAttribute('data-sk', item.skillId);
              if (g.forceHeight && g.bladeH) {
                btn.style.height = `${g.bladeH}px`;
                btn.style.minHeight = `${g.bladeH}px`;
              }

              const expHtml = item.expKind === 'warn'
                ? `<span class="cb-bl-exp is-warn" title="耳目近在咫尺，施放将增加暴露度">${escapeHtml(item.expText)}</span>`
                : (item.expKind === 'safe'
                  ? `<span class="cb-bl-exp is-safe" title="${escapeHtml(item.expText || '隐蔽安全')}">隐蔽</span>`
                  : '');
              const badgeHtml = item.oppLabel
                ? `<span class="cb-bl-tag opp">${escapeHtml(item.oppLabel)}</span>`
                : (!expHtml && item.pathLabel ? `<span class="cb-bl-tag">◆${escapeHtml(item.pathLabel)}</span>` : '');
              const rightTagsHtml = (expHtml || badgeHtml)
                ? `<span class="cb-bl-tags-right">${expHtml}${badgeHtml}</span>`
                : '';

              btn.innerHTML = `
                <span class="cb-bl-key">${escapeHtml(item.key)}</span>
                <div class="cb-bl-content">
                  <div class="cb-bl-top">
                    <span class="cb-bl-name">${escapeHtml(item.name)}</span>
                    ${rightTagsHtml}
                  </div>
                  <div class="cb-bl-bot">
                    <span class="cb-bl-meta">${escapeHtml(item.foot || item.desc)}</span>
                    <span class="cb-bl-cost">${escapeHtml(item.cost)}</span>
                  </div>
                </div>
              `;

              btn.addEventListener('mouseenter', () => {
                const liveItem = uiState.currentItems[idx];
                uiState.hoveredBladeIdx = idx;
                wrap.classList.add('hovered');
                wrap.style.transform = `translateX(14px) rotate(${g.rot}deg) scale(1.025)`;
                if (liveItem && liveItem.kind === 'skill') {
                  dispatchRealHover(resolveLiveSourceBtn(liveItem), true);
                }
                renderCurrentSvg();
              });
              btn.addEventListener('mouseleave', () => {
                const liveItem = uiState.currentItems[idx];
                if (uiState.hoveredBladeIdx === idx) uiState.hoveredBladeIdx = null;
                wrap.classList.remove('hovered');
                wrap.style.transform = `rotate(${g.rot}deg)`;
                if (liveItem && liveItem.kind === 'skill') {
                  dispatchRealHover(resolveLiveSourceBtn(liveItem), false);
                }
                renderCurrentSvg();
              });
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

      renderCurrentSvg(ampInfo);
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
    if (!isActive() || shouldDissolve()) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const tgt = ev.target;
    if (tgt && tgt.closest && tgt.id !== 'cb-amp-slider' && tgt.closest('input, textarea, select')) return;

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
      if (uiState.menuMode === 'skills') closeCascade();
      else openSkills();
      return;
    }

    if (k === 'e') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (uiState.menuMode !== 'amp') {
        openAmp();
      } else {
        cycleAmp(ev.shiftKey ? -1 : 1);
      }
      return;
    }

    if (k === 'a') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (uiState.menuMode === 'guard') closeCascade();
      else openGuard();
      return;
    }

    if (k === 'd') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (uiState.menuMode === 'assist') closeCascade();
      else openAssist();
      return;
    }

    if (k === 'x') {
      const realEnd = document.getElementById('cb-btn-endturn');
      if (realEnd && !realEnd.disabled) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        uiState.menuMode = 'root';
        uiState.lastBladeSig = '';
        clearRealHover();
        realEnd.click();
        sync();
      }
      return;
    }

    if (ev.key >= '1' && ev.key <= '4' && uiState.menuMode === 'amp') {
      const tierDef = V22_AMP_TIERS[Number(ev.key) - 1];
      const info = readOvercastInfo();
      if (tierDef && info.enabled && tierDef.pct <= info.maxAmpCap + 1e-4) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        selectAmpTier(tierDef.pct);
      }
      return;
    }

    if (ev.key >= '1' && ev.key <= '9' && uiState.menuMode !== 'root' && uiState.menuMode !== 'amp') {
      const idx = Number(ev.key) - 1;
      const item = uiState.currentItems[idx];
      if (item && !item.disabled) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
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
    clearRealHover();
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

    uiState.onWindowPointerUp = () => {
      uiState.sliderDragging = false;
      uiState.lastSliderAppliedPct = -1;
    };
    window.addEventListener('pointerup', uiState.onWindowPointerUp);
    window.addEventListener('mouseup', uiState.onWindowPointerUp);
    window.addEventListener('combat:statechange', onCombatStateChange);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', scheduleSync);
    sync();
  }

  function unmount() {
    if (!uiState.mounted) return;
    uiState.mounted = false;
    if (uiState.rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(uiState.rafId);
      uiState.rafId = 0;
    }
    if (uiState.dissolveTimer) {
      clearTimeout(uiState.dissolveTimer);
      uiState.dissolveTimer = 0;
    }
    if (uiState.bsObserver) {
      uiState.bsObserver.disconnect();
      uiState.bsObserver = null;
    }
    if (uiState.modalObserver) {
      uiState.modalObserver.disconnect();
      uiState.modalObserver = null;
    }
    if (uiState.onWindowPointerUp) {
      window.removeEventListener('pointerup', uiState.onWindowPointerUp);
      window.removeEventListener('mouseup', uiState.onWindowPointerUp);
      uiState.onWindowPointerUp = null;
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
    uiState.rigEl = null;
    uiState.svgEl = null;
    uiState.cascadeListEl = null;
    uiState.ampPanelEl = null;
    uiState.ampSliderEl = null;
    uiState.ampTierBtns = [];
    uiState.spineEl = null;
    uiState.logBarEl = null;
    const bs = getBattleScreen();
    if (bs) bs.classList.remove('prism-radial-active');
  }

  const CombatPrismUI = {
    mount,
    unmount,
    sync,
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
