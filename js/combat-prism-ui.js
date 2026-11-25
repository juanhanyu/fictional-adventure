/* =========================================================================
   《转生千金》Option 2 · P5 式希尔维亚周身棱晶放射指令翼适配器 (js/combat-prism-ui.js)
   职责：
     - 挂载于 #battle-screen .cb-arena-field，在桌面端（>=1024px）将技能选择转化为
       Persona 5 式角色锚定多面体蓝宝棱晶放射翼：
         [W] 冰水术式  → 展开实时同步自 #cb-skills / #b-actions 的斜切术式级联翼
         [E] 魔力增幅  → 联动 #cb-oc-seg 魔战循环倾注（常规 / 半蓝强击 / 孤注一掷）
         [A] 守势/护盾 → 优先瞬发当前可用守势护盾技，多项时展开守势翼，无可用时稳守回合
         [D] 演武辅助  → 展开冰晶宫殿 / 心念援护 / 晦轮杖 / 结束回合四项战术翼
     - 零破坏既有 DOM ID 与自动化测试（仅代理真实按钮，JSDOM 环境下静默旁路）
     - 动画、模态弹窗（冰晶宫殿 / 战果结算）与胜负结束时自动消散退场
   ========================================================================= */
(function (global) {
  'use strict';

  const DESKTOP_MIN_W = 1024;
  const HIGHER_OVERLAY_IDS = [
    'cg-lightbox', 'sys-popup', 'arena-loadout-modal', 'vn-prefs-modal',
    'vn-backlog-modal', 'vn-saveload-modal', 'vn-chapters-modal',
    'ice-deduction-modal', 'rumor-overlay', 'panel', 'codex',
    'stats-overlay', 'ai-drawer', 'help-screen', 'map-overlay', 'backlog-overlay',
  ];

  const AMP_LABELS = ['常规 1.0×', '半蓝强击', '孤注一掷'];

  function isJsdomEnv() {
    try {
      const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
      return /jsdom/i.test(ua);
    } catch (e) {
      return false;
    }
  }

  function safeSfx(cue) {
    try {
      if (global.CrystalSFX && typeof global.CrystalSFX.play === 'function') {
        global.CrystalSFX.play(cue);
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
    menuMode: 'root', // 'root' | 'skills' | 'guard' | 'assist'
    hoveredWingIdx: null,
    hoveredBladeIdx: null,
    observer: null,
    rafId: 0,
    rigEl: null,
    svgEl: null,
    cascadeListEl: null,
    currentItems: [],
    lastSkillCount: -1,
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
      if (global.CombatEngine && typeof global.CombatEngine.getState === 'function') {
        return global.CombatEngine.getState();
      }
    } catch (e) {}
    return null;
  }

  function shouldDissolve() {
    const bs = getBattleScreen();
    if (!bs || !isVisible(bs)) return true;
    if (document.getElementById('cb-palace-modal') || document.getElementById('cb-result-modal')) return true;
    if (hasBlockingOverlay()) return true;
    if (Date.now() < uiState.animDissolveUntil) return true;
    const b = getEngineBattle();
    if (b && (b.over || b.resolving || b.animating || b.enemyActing || b.turnLocked)) return true;
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
        isGuard: btn.classList.contains('is-guard'),
        disabled: !!btn.disabled,
        sourceBtn: btn,
      };
    });
  }

  function readOvercastInfo() {
    const b = getEngineBattle();
    const p = b && b.player ? b.player : null;
    const ocSeg = document.getElementById('cb-oc-seg');
    const multEl = document.getElementById('cb-oc-mult');
    const btns = ocSeg ? Array.from(ocSeg.querySelectorAll('.cb-oc-btn[data-oc]')) : [];
    let mode = p ? Number(p.overcastMode || 0) : 0;
    let enabled = p ? !!p.hasManaCycle && !b.over : false;

    if (!p && btns.length) {
      enabled = btns.some(btn => !btn.disabled);
      const act = btns.find(btn => btn.classList.contains('active'));
      if (act) mode = Number(act.getAttribute('data-oc') || 0);
    }

    const multRaw = multEl ? multEl.textContent.trim() : '';
    const multMatch = multRaw.match(/(\d+\.\d+x(?:\s*\([^)]*\))?)/);
    return {
      mode,
      enabled,
      label: AMP_LABELS[mode] || AMP_LABELS[0],
      multText: multMatch ? multMatch[1] : (enabled ? `${mode === 0 ? '1.00x' : mode === 1 ? '半蓝增幅' : '全力倾注'}` : '未习得'),
      buttons: btns,
    };
  }

  function readAssistItems() {
    const items = [];
    const palBtn = document.getElementById('cb-btn-palace');
    if (palBtn && isVisible(palBtn)) {
      const txt = palBtn.textContent.replace(/\s+/g, ' ').replace(/\bQ\b/g, '').trim();
      items.push({
        kind: 'tool',
        key: 'Q',
        name: '冰晶宫殿',
        pathLabel: '时停推演',
        foot: txt || '审视敌方破绽',
        cost: palBtn.disabled ? '暂不可用' : '就绪',
        oppLabel: !palBtn.disabled && palBtn.classList.contains('pulse-hint') ? '✦ 可审视' : '',
        disabled: !!palBtn.disabled,
        sourceBtn: palBtn,
      });
    }

    const assistBtn = document.getElementById('cb-btn-assist');
    if (assistBtn && isVisible(assistBtn)) {
      const txt = assistBtn.textContent.replace(/\s+/g, ' ').replace(/\bF\b/g, '').trim();
      items.push({
        kind: 'tool',
        key: 'F',
        name: '心念援护',
        pathLabel: '羁绊连携',
        foot: txt || '羁绊支援',
        cost: assistBtn.disabled ? '未就绪' : '可用',
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
        name: '晦轮杖',
        pathLabel: '折光切换',
        foot: isOn ? '折光已开启 · 穿透护盾' : '收鞘态 · 点击展开折光',
        cost: wandBtn.disabled ? '冷却中' : (isOn ? 'ON' : 'OFF'),
        oppLabel: isOn ? '✦ 折光中' : '',
        disabled: !!wandBtn.disabled,
        sourceBtn: wandBtn,
      });
    }

    const endBtn = document.getElementById('cb-btn-endturn');
    if (endBtn && isVisible(endBtn)) {
      items.push({
        kind: 'tool',
        key: 'E',
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

  function cycleAmp(delta) {
    const step = delta < 0 ? -1 : 1;
    const info = readOvercastInfo();
    if (!info.enabled) return false;
    const nextMode = (info.mode + step + 3) % 3;
    const targetBtn = info.buttons.find(btn => Number(btn.getAttribute('data-oc')) === nextMode);
    if (targetBtn && !targetBtn.disabled) {
      targetBtn.click();
    } else if (global.CombatEngine && typeof global.CombatEngine.setOvercast === 'function') {
      global.CombatEngine.setOvercast(nextMode);
    }
    safeSfx('ui_tick');
    scheduleSync();
    return true;
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
    if (!item || !item.sourceBtn || item.sourceBtn.disabled) return false;
    uiState.hoveredBladeIdx = null;
    uiState.hoveredWingIdx = null;
    uiState.menuMode = 'root';
    // Briefly dissolve rig for crisp P5 cast feedback before state re-syncs
    if (item.kind === 'skill') {
      uiState.animDissolveUntil = Date.now() + 260;
      setTimeout(() => scheduleSync(), 280);
    }
    clearRealHover();
    item.sourceBtn.click();
    scheduleSync();
    return true;
  }

  function setMode(nextMode) {
    const valid = nextMode === 'skills' || nextMode === 'guard' || nextMode === 'assist' ? nextMode : 'root';
    if (uiState.menuMode !== valid) {
      clearRealHover();
      uiState.menuMode = valid;
      uiState.hoveredWingIdx = null;
      uiState.hoveredBladeIdx = null;
      safeSfx('ui_tick');
    }
    sync();
  }

  function openSkills() { setMode('skills'); }
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
      scheduleSync();
    }
  }
  function openAssist() { setMode('assist'); }
  function closeCascade() { setMode('root'); }

  function computeBladeGeometry(count) {
    const safeCount = Math.max(1, count);
    const stepY = safeCount <= 4 ? 72 : safeCount === 5 ? 64 : safeCount === 6 ? 56 : 48;
    const totalH = (safeCount - 1) * stepY;
    const startY = Math.max(-150, -Math.round(totalH * 0.52));
    const coords = [];
    for (let i = 0; i < safeCount; i++) {
      const frac = safeCount === 1 ? 0.5 : i / (safeCount - 1);
      const curveX = Math.round(52 + Math.sin(frac * Math.PI) * 32);
      const topY = Math.round(startY + i * stepY);
      const rot = Number((-2.8 + frac * 5.6).toFixed(2));
      coords.push({
        left: curveX,
        top: topY,
        rot,
        tipX: curveX + 4,
        tipY: topY + 25,
        elbowX: Math.round(curveX * 0.54),
        elbowY: Math.round((topY + 25) * 0.65),
      });
    }
    return coords;
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
      const lit = idx === hoveredIdx;
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

    const anchorX = Math.round(Math.min(fRect.width * 0.42, (pRect.right - fRect.left) - 42));
    const anchorY = Math.round(Math.max(220, Math.min(fRect.height - 190, fRect.height * 0.45)));
    uiState.rigEl.style.left = `${anchorX}px`;
    uiState.rigEl.style.top = `${anchorY}px`;
  }

  function ensureToggleButton() {
    const tools = document.querySelector('#battle-screen .cb-top-tools');
    if (!tools || document.getElementById('cb-btn-prism-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cb-btn-prism-toggle';
    btn.className = 'cb-tool-btn prism-toggle-btn' + (uiState.enabled ? ' active' : '');
    btn.title = '切换 P5 棱晶放射指令翼 / 传统底部技能栏';
    btn.textContent = uiState.enabled ? '◆ 棱晶翼' : '◇ 传统列';
    btn.addEventListener('click', () => {
      setEnabled(!uiState.enabled);
    });
    const retreatBtn = document.getElementById('cb-btn-retreat');
    if (retreatBtn && retreatBtn.parentNode === tools) {
      tools.insertBefore(btn, retreatBtn);
    } else {
      tools.appendChild(btn);
    }
  }

  function buildRigDOM(field) {
    if (uiState.rigEl && uiState.rigEl.isConnected) return uiState.rigEl;

    const existing = document.getElementById('cb-prism-rig');
    if (existing) existing.remove();

    const nav = document.createElement('nav');
    nav.id = 'cb-prism-rig';
    nav.className = 'cb-prism-rig mode-root';
    nav.setAttribute('aria-label', '希尔维亚棱晶放射指令翼');

    nav.innerHTML = `
      <svg class="cb-prism-svg" id="cb-prism-svg" viewBox="-42 -230 470 460" aria-hidden="true"></svg>
      <div class="cb-prism-root" id="cb-prism-root">
        <div class="cb-pwing-wrap" data-wing="0">
          <button type="button" class="cb-pwing hero-prism" id="cb-pw-magic">
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
          <button type="button" class="cb-pwing" id="cb-pw-amp" title="左键升档 / 右键降档">
            <span class="cb-pw-key">E</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">魔力增幅</span>
                <span class="cb-pw-en">AMP</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-amp-sub">常规 · 1.00x</span>
            </div>
          </button>
        </div>

        <div class="cb-pwing-wrap" data-wing="2">
          <button type="button" class="cb-pwing" id="cb-pw-guard">
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
          <button type="button" class="cb-pwing" id="cb-pw-assist">
            <span class="cb-pw-key">D</span>
            <div class="cb-pw-body">
              <div class="cb-pw-top">
                <span class="cb-pw-title">演武辅助</span>
                <span class="cb-pw-en">ASSIST</span>
              </div>
              <span class="cb-pw-sub" id="cb-pw-assist-sub">冰晶宫殿 · 援护 · 回合</span>
            </div>
            <span class="cb-pw-arrow">▸</span>
          </button>
        </div>
      </div>

      <div class="cb-prism-cascade" id="cb-prism-cascade">
        <div class="cb-cascade-spine">
          <button type="button" class="cb-spine-btn" id="cb-pw-back">← 返回 [ESC]</button>
          <button type="button" class="cb-spine-btn amp-mini" id="cb-pw-amp-mini" title="点击切换魔力增幅 / 右键降档">✦ 增幅 常规</button>
        </div>
        <div id="cb-prism-blade-list"></div>
      </div>
    `;

    field.appendChild(nav);
    uiState.rigEl = nav;
    uiState.svgEl = nav.querySelector('#cb-prism-svg');
    uiState.cascadeListEl = nav.querySelector('#cb-prism-blade-list');

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
    nav.querySelector('#cb-pw-amp').addEventListener('click', () => cycleAmp(1));
    nav.querySelector('#cb-pw-amp').addEventListener('contextmenu', ev => { ev.preventDefault(); cycleAmp(-1); });
    nav.querySelector('#cb-pw-guard').addEventListener('click', () => openGuard());
    nav.querySelector('#cb-pw-assist').addEventListener('click', () => openAssist());
    nav.querySelector('#cb-pw-back').addEventListener('click', () => closeCascade());
    nav.querySelector('#cb-pw-amp-mini').addEventListener('click', () => cycleAmp(1));
    nav.querySelector('#cb-pw-amp-mini').addEventListener('contextmenu', ev => { ev.preventDefault(); cycleAmp(-1); });

    return nav;
  }

  function renderCurrentSvg() {
    if (!uiState.rigEl) return;
    if (uiState.menuMode === 'root') {
      renderSvgHairlines(
        [
          { tipX: 56, tipY: -96, elbowX: 28, elbowY: -62, hero: true },
          { tipX: 86, tipY: -18, elbowX: 44, elbowY: -12, hero: false },
          { tipX: 80, tipY: 60,  elbowX: 42, elbowY: 36,  hero: false },
          { tipX: 50, tipY: 134, elbowX: 26, elbowY: 86,  hero: false },
        ],
        uiState.hoveredWingIdx
      );
    } else {
      const geom = computeBladeGeometry(uiState.currentItems.length);
      renderSvgHairlines(
        geom.map(g => ({ tipX: g.tipX, tipY: g.tipY, elbowX: g.elbowX, elbowY: g.elbowY, hero: false })),
        uiState.hoveredBladeIdx
      );
    }
  }

  function sync() {
    const bs = getBattleScreen();
    if (!bs) return;

    const usePrism = uiState.enabled && !isJsdomEnv() && isDesktopViewport() && isVisible(bs);
    bs.classList.toggle('prism-radial-active', usePrism);

    const toggleBtn = document.getElementById('cb-btn-prism-toggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', uiState.enabled);
      toggleBtn.textContent = uiState.enabled ? '◆ 棱晶翼' : '◇ 传统列';
    }

    if (!usePrism) {
      if (uiState.rigEl) uiState.rigEl.classList.add('dissolved');
      return;
    }

    const field = bs.querySelector('.cb-arena-field');
    if (!field) return;
    ensureToggleButton();
    buildRigDOM(field);
    syncRigAnchor();

    const dissolved = shouldDissolve();
    uiState.rigEl.classList.toggle('dissolved', dissolved);
    uiState.rigEl.classList.toggle('mode-root', uiState.menuMode === 'root');
    uiState.rigEl.classList.toggle('mode-skills', uiState.menuMode === 'skills');
    uiState.rigEl.classList.toggle('mode-guard', uiState.menuMode === 'guard');
    uiState.rigEl.classList.toggle('mode-assist', uiState.menuMode === 'assist');

    const allSkills = readSkillCards();
    const enabledSkills = allSkills.filter(s => !s.disabled);
    const oppSkills = enabledSkills.filter(s => !!s.oppLabel);
    const guardSkills = allSkills.filter(s => s.isGuard && !s.disabled);
    const ampInfo = readOvercastInfo();
    const assistItems = readAssistItems();

    // Sync Root Wing [W]
    const magicSub = document.getElementById('cb-pw-magic-sub');
    if (magicSub) {
      if (oppSkills.length > 0) {
        magicSub.textContent = `✦ ${oppSkills.length} 项破招/看破就绪 · 共 ${enabledSkills.length}/${allSkills.length} 式`;
      } else {
        magicSub.textContent = `展开术式级联 · 可用 ${enabledSkills.length}/${allSkills.length} 式`;
      }
    }

    // Sync Root Wing [E]
    const ampBtn = document.getElementById('cb-pw-amp');
    const ampSub = document.getElementById('cb-pw-amp-sub');
    if (ampBtn && ampSub) {
      ampBtn.disabled = !ampInfo.enabled;
      ampBtn.classList.toggle('amp-charged', ampInfo.enabled && ampInfo.mode >= 1);
      const pips = [0, 1, 2].map(lvl => {
        const cls = lvl <= ampInfo.mode && ampInfo.enabled
          ? (ampInfo.mode >= 2 ? 'cb-amp-pip gold' : 'cb-amp-pip on')
          : 'cb-amp-pip';
        return `<i class="${cls}"></i>`;
      }).join('');
      ampSub.innerHTML = `<span class="cb-amp-pips">${pips}</span>${escapeHtml(ampInfo.label)} · ${escapeHtml(ampInfo.multText)}`;
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
      const readyHighlights = assistItems.filter(it => !it.disabled && it.key !== 'E').map(it => it.name);
      assistSub.textContent = readyHighlights.length
        ? `✦ ${readyHighlights.join(' / ')} 就绪`
        : '冰晶宫殿 · 援护 · 结束回合';
    }

    // Sync Spine Mini Amp Button
    const miniAmp = document.getElementById('cb-pw-amp-mini');
    if (miniAmp) {
      miniAmp.disabled = !ampInfo.enabled;
      miniAmp.classList.toggle('charged', ampInfo.enabled && ampInfo.mode >= 1);
      miniAmp.textContent = ampInfo.enabled
        ? `✦ [E] 增幅 ${ampInfo.label}`
        : '◇ 魔战循环未习得';
    }

    // Populate Active Diagonal Cascade List
    let listItems = [];
    if (uiState.menuMode === 'skills') {
      listItems = allSkills;
    } else if (uiState.menuMode === 'guard') {
      listItems = allSkills.filter(s => s.isGuard);
    } else if (uiState.menuMode === 'assist') {
      listItems = assistItems;
    }
    uiState.currentItems = listItems;

    if (uiState.cascadeListEl && uiState.menuMode !== 'root') {
      const geom = computeBladeGeometry(listItems.length);
      uiState.cascadeListEl.innerHTML = '';

      listItems.forEach((item, idx) => {
        const g = geom[idx];
        const wrap = document.createElement('div');
        wrap.className = 'cb-blade-wrap' + (uiState.hoveredBladeIdx === idx ? ' hovered' : '');
        wrap.style.left = `${g.left}px`;
        wrap.style.top = `${g.top}px`;
        wrap.style.transform = uiState.hoveredBladeIdx === idx
          ? `translateX(14px) rotate(${g.rot}deg) scale(1.025)`
          : `rotate(${g.rot}deg)`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cb-blade' + (item.oppLabel ? ' opp-ready' : '');
        btn.disabled = !!item.disabled;
        btn.setAttribute('data-prism-idx', String(idx));

        const badgeHtml = item.oppLabel
          ? `<span class="cb-bl-tag opp">${escapeHtml(item.oppLabel)}</span>`
          : (item.pathLabel ? `<span class="cb-bl-tag">◆${escapeHtml(item.pathLabel)}</span>` : '');

        btn.innerHTML = `
          <span class="cb-bl-key">${escapeHtml(item.key)}</span>
          <div class="cb-bl-content">
            <div class="cb-bl-top">
              <span class="cb-bl-name">${escapeHtml(item.name)}</span>
              ${badgeHtml}
            </div>
            <div class="cb-bl-bot">
              <span class="cb-bl-meta">${escapeHtml(item.foot || item.desc)}</span>
              <span class="cb-bl-cost">${escapeHtml(item.cost)}</span>
            </div>
          </div>
        `;

        btn.addEventListener('mouseenter', () => {
          uiState.hoveredBladeIdx = idx;
          wrap.classList.add('hovered');
          wrap.style.transform = `translateX(14px) rotate(${g.rot}deg) scale(1.025)`;
          if (item.kind === 'skill') dispatchRealHover(item.sourceBtn, true);
          renderCurrentSvg();
        });
        btn.addEventListener('mouseleave', () => {
          if (uiState.hoveredBladeIdx === idx) uiState.hoveredBladeIdx = null;
          wrap.classList.remove('hovered');
          wrap.style.transform = `rotate(${g.rot}deg)`;
          if (item.kind === 'skill') dispatchRealHover(item.sourceBtn, false);
          renderCurrentSvg();
        });
        btn.addEventListener('click', () => {
          triggerSourceButton(item);
        });

        wrap.appendChild(btn);
        uiState.cascadeListEl.appendChild(wrap);
      });
    }

    renderCurrentSvg();
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
    if (ev.repeat) return;
    const tgt = ev.target;
    if (tgt && tgt.closest && tgt.closest('input, textarea, select')) return;

    const k = String(ev.key || '').toLowerCase();
    if (k === 'escape' && uiState.menuMode !== 'root') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      closeCascade();
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
      if (uiState.menuMode === 'assist') {
        const endBtn = document.getElementById('cb-btn-endturn');
        if (endBtn && !endBtn.disabled) endBtn.click();
        closeCascade();
      } else {
        cycleAmp(1);
      }
      return;
    }

    if (k === 'a' && uiState.menuMode === 'root') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      openGuard();
      return;
    }

    if (k === 'd') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (uiState.menuMode === 'assist') closeCascade();
      else openAssist();
      return;
    }
  }

  function onContextMenu(ev) {
    if (!isActive() || uiState.menuMode === 'root') return;
    if (ev.target && ev.target.closest && ev.target.closest('#cb-pw-amp, #cb-pw-amp-mini')) return;
    ev.preventDefault();
    closeCascade();
  }

  function setEnabled(flag) {
    uiState.enabled = !!flag;
    uiState.menuMode = 'root';
    clearRealHover();
    sync();
  }

  function mount() {
    if (typeof document === 'undefined' || uiState.mounted) return;
    const bs = getBattleScreen();
    if (!bs) return;
    uiState.mounted = true;

    if (typeof MutationObserver !== 'undefined') {
      uiState.observer = new MutationObserver((mutations) => {
        // Ignore mutations originated solely inside our own rig to prevent feedback loops
        const relevant = mutations.some(m => {
          if (!uiState.rigEl) return true;
          return !uiState.rigEl.contains(m.target);
        });
        if (relevant) scheduleSync();
      });
      uiState.observer.observe(bs, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', scheduleSync);
    sync();
  }

  function unmount() {
    if (!uiState.mounted) return;
    uiState.mounted = false;
    if (uiState.observer) {
      uiState.observer.disconnect();
      uiState.observer = null;
    }
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('resize', scheduleSync);
    if (uiState.rigEl && uiState.rigEl.parentNode) {
      uiState.rigEl.parentNode.removeChild(uiState.rigEl);
    }
    uiState.rigEl = null;
    uiState.svgEl = null;
    uiState.cascadeListEl = null;
    const bs = getBattleScreen();
    if (bs) bs.classList.remove('prism-radial-active');
  }

  const CombatPrismUI = {
    mount,
    unmount,
    sync,
    setMode,
    openSkills,
    openGuard,
    openAssist,
    closeCascade,
    cycleAmp,
    setEnabled,
    isActive,
    getState: () => ({
      enabled: uiState.enabled,
      mounted: uiState.mounted,
      active: isActive(),
      menuMode: uiState.menuMode,
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
