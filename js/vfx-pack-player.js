/* ============================================================================
   《转生千金》方案 A 战斗特效 Pack 1 · 主角技能 & 武器法杖全 18 招
   文件：js/vfx-pack-player.js
   注册：VfxEditionAFull.registerPack('pack1_player_core', SKILLS_META, HANDLERS, ALIASES)
   导出：window.VfxPackPlayer（兼容 CommonJS module.exports 双端加载）

   美学原则：
   - 全套保持方案 A 日系奇幻明亮炫彩审美：雪瓷冰白 / 皇家蓝 / 冰青 / 碧水青 / 香槟金 / 晶透紫银
   - PixelFX 光栅动画 × 矢量法阵/丝带/光束/冰镜/星钟/光塔 × 640 粒子池有机叠加
   - 完整支持 amp (0..3)、facing (1/-1)、from / to / targets，严禁暗黑泥泞与糊脸黑洞
   - ice_crystal 同名覆盖 Core 索引 0，完整保留节奏/色板/法阵/星辉，主冰晶块体量精确缩小 33.3%
   ============================================================================ */
(function (global) {
  'use strict';

  function resolveCore() {
    if (global && global.VfxEditionAFull && typeof global.VfxEditionAFull.registerPack === 'function') {
      return global.VfxEditionAFull;
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./vfx-edition-a-core.js');
        if (mod && typeof mod.registerPack === 'function') return mod;
      } catch (e) {}
    }
    return null;
  }

  /* -------------------- 通用坐标、多目标与几何辅助 -------------------- */
  function getDir(o) {
    return (o && o.facing < 0) ? -1 : 1;
  }

  function resolveTargetList(o) {
    if (o && Array.isArray(o.targets) && o.targets.length) {
      return o.targets;
    }
    return [{
      x: o.to.x,
      y: o.to.y,
      groundY: o.targetGroundY
    }];
  }

  function resolveSelfCenter(o) {
    const dir = getDir(o);
    return {
      cx: o.from.x - 14 * dir,
      cy: o.from.y + 4
    };
  }

  function drawDiamond(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.lineTo(x + rx, y);
    ctx.lineTo(x, y + ry);
    ctx.lineTo(x - rx, y);
    ctx.closePath();
  }

  function drawHexPoly(ctx, x, y, rx, ry, rot) {
    const r0 = rot || 0;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = r0 + (i / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * rx;
      const py = y + Math.sin(a) * ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // 专用于 PixelFX eclipse 渲染的高透紫水晶+纯银色板（杜绝中心圆盘偏暗）
  const BRIGHT_ECLIPSE_PAL = [
    '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD',
    '#DDD6FE', '#EDE9FE', '#F5F3FF', '#FFFFFF'
  ];

  /* -------------------- 18 招完整元数据 -------------------- */
  const SKILLS_META = [
    {
      id: 'ice_crystal',
      name: '冰晶术',
      en: 'Ice Crystal',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1220,
      peakMs: 510,
      accent: '#38BDF8',
      desc: '明亮聚能晶环 → 电光冰枪疾射 → 精致收敛晶块爆裂飞散（主体冰晶 -33.3%）'
    },
    {
      id: 'basic_attack',
      name: '防身平斩',
      en: 'Basic Attack',
      kind: 'melee',
      targetMode: 'single',
      duration: 960,
      peakMs: 265,
      accent: '#38BDF8',
      desc: '轻捷突进 → 银蓝雪瓷锋芒斜斩 + 清脆击打星芒'
    },
    {
      id: 'water_orb',
      name: '水球术',
      en: 'Water Orb',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1220,
      peakMs: 430,
      accent: '#22D3EE',
      desc: '碧蓝聚水环 → 晶透折射水球弧线疾射 → 水花穹顶飞溅炸裂'
    },
    {
      id: 'frost_step_floor',
      name: '蔓地薄冰',
      en: 'Frost Step Floor',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1380,
      peakMs: 520,
      accent: '#7DD3FC',
      desc: '寒霜滑步起势 → 地表六角冰镜迅速铺展 → 敌阵足底薄冰锁腿'
    },
    {
      id: 'frost_breath',
      name: '寒霜吐息',
      en: 'Frost Breath',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1420,
      peakMs: 540,
      accent: '#67E8F9',
      desc: '冰青聚气环 → 扇形晶透极寒流光吐息 → 纷扬雪晶冰花覆场'
    },
    {
      id: 'water_veil',
      name: '水幕轻纱',
      en: 'Water Veil',
      kind: 'buff',
      targetMode: 'self',
      duration: 1420,
      peakMs: 560,
      accent: '#22D3EE',
      desc: '碧青涌水阵 → 通透流动垂纱水幕护身 → 翠白净光升腾涤荡异常'
    },
    {
      id: 'ice_shield',
      name: '冰晶护盾',
      en: 'Ice Shield',
      kind: 'buff',
      targetMode: 'self',
      duration: 1460,
      peakMs: 560,
      accent: '#38BDF8',
      desc: '地脉冰根落位 → 六角晶格棱镜厚冰盾构筑 → 冰花震环锁定'
    },
    {
      id: 'mirror_frost_wall',
      name: '镜霜冰壁',
      en: 'Mirror Frost Wall',
      kind: 'buff',
      targetMode: 'self',
      duration: 1520,
      peakMs: 580,
      accent: '#93C5FD',
      desc: '银蓝冰脉定基 → 三折无瑕镜霜冰壁拔起 → 棱镜扫光与折射光丝绽放'
    },
    {
      id: 'sword_root_step',
      name: '生根步·卸力侧滑',
      en: 'Sword Root Step',
      kind: 'buff',
      targetMode: 'self',
      duration: 1180,
      peakMs: 420,
      accent: '#67E8F9',
      desc: '沉膝地脉定桩 → 银蓝侧滑卸力双残像 → 剑心棱环蓄势亮锋'
    },
    {
      id: 'sword_riposte_flash',
      name: '反击闪刃',
      en: 'Sword Riposte Flash',
      kind: 'melee',
      targetMode: 'single',
      duration: 1240,
      peakMs: 440,
      accent: '#FDE68A',
      desc: '金青弹反星花 → 极速残像居合贯冲 → 十字闪刃光痕与雷弧暴击'
    },
    {
      id: 'remote_blind_shot',
      name: '盲射穿棱',
      en: 'Remote Blind Shot',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1120,
      peakMs: 410,
      accent: '#38BDF8',
      desc: '侧翼盲区不经手瞬凝微阵 → 极速棱晶贴脸贯背穿射破招'
    },
    {
      id: 'remote_snap_spike',
      name: '瞬发冰锥',
      en: 'Remote Snap Spike',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1180,
      peakMs: 310,
      accent: '#0EA5E9',
      desc: '敌足下瞬闪冰锁 → 极锐钻石主冰锥破土直刺 → 三重破盾光环升腾'
    },
    {
      id: 'palace_time_stop',
      name: '王宫冰时凝滞',
      en: 'Palace Time Stop',
      kind: 'ultimate',
      targetMode: 'multi',
      duration: 1680,
      peakMs: 680,
      accent: '#7DD3FC',
      desc: '全场澄澈雪瓷冰晶宫殿星钟展开 → 时针凝滞锁定 → 失重冰金雪星满屏'
    },
    {
      id: 'insight_rowan_prism',
      name: '洞察·双镜夹杖',
      en: 'Insight Rowan Prism',
      kind: 'ultimate',
      targetMode: 'single',
      duration: 1500,
      peakMs: 500,
      accent: '#A78BFA',
      desc: '冰时洞察定帧 → 左右立面冰棱镜疾速合拢夹锁蚀月紫光 → 棱光星爆'
    },
    {
      id: 'insight_flaw_strike',
      name: '洞察·破绽狙击',
      en: 'Insight Flaw Strike',
      kind: 'ultimate',
      targetMode: 'single',
      duration: 1320,
      peakMs: 500,
      accent: '#FCD34D',
      desc: '绯晶冰蓝几何棱镜准星锁核 → 冰金极光束瞬时贯隙穿击破绽'
    },
    {
      id: 'eclipse_wand_toggle',
      name: '晦轮共鸣切换',
      en: 'Eclipse Wand Toggle',
      kind: 'buff',
      targetMode: 'self',
      duration: 1320,
      peakMs: 520,
      accent: '#A78BFA',
      desc: '明亮紫水晶星月法阵 → 晶透紫银双新月星轨环绕共鸣 → 银紫微环升腾'
    },
    {
      id: 'eclipse_true_cast',
      name: '晦轮真实施法',
      en: 'Eclipse True Cast',
      kind: 'beam',
      targetMode: 'single',
      duration: 1420,
      peakMs: 540,
      accent: '#C4B5FD',
      desc: '紫银新月聚能 → 明亮星月棱束穿透五重银环直击 → 晶透紫银蚀月爆'
    },
    {
      id: 'saint_staff_resonance',
      name: '北境圣杖共鸣',
      en: 'Saint Staff Resonance',
      kind: 'buff',
      targetMode: 'self',
      duration: 1560,
      peakMs: 620,
      accent: '#FDE68A',
      desc: '香槟金与冰青复合圣阵 → 通透六棱圣光晶塔直冲云霄 → 圣冠雪星辉耀'
    }
  ];

  /* -------------------- 18 招完整特效编排 -------------------- */
  const HANDLERS = {
    /* ========================================================================
       1. 冰晶术 (ice_crystal) — 同名覆盖 Core 索引 0
       1 拍原生节拍门控 + 精致缩容（ice_lance 1.15 / ribbon 6.0 / ice_shatter 1.18）
       ======================================================================== */
    ice_crystal(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale, icePal } = o;
      const { clamp, lerp, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);
      const travelMs = 200;
      const evalP = (ent, ms) => (typeof kit.evalHoldProgress === 'function'
        ? kit.evalHoldProgress(ent, ms)
        : easeOutCubic(clamp(ent.age / ms, 0, 1)));

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: icePal }, {
              x: from.x - 16 * dir, y: groundY + 2, scale: 1.2 * ampScale,
              preWarmSec: 0.92, timeScale: 2.1, durMs: 420, layer: 'back',
              glowColor: 'rgba(56,189,248,0.45)', glowRadius: 48, glowAlpha: 0.45
            });
            kit.addMagicCircle({
              x: from.x - 16 * dir, y: groundY + 2, radius: 42 * ampScale, sy: 0.32,
              goldTriple: amp >= 3, dur: 460
            });
            // 起手凝聚冰晶块
            kit.spawnPfx('ice_crystal', { palette: icePal, height: 22 }, {
              x: from.x + 8 * dir, y: from.y + 24, scale: 0.84 * ampScale,
              durMs: 260, fadeOutMs: 80, layer: 'front'
            });
            kit.addStarFlare({
              x: from.x + 8 * dir, y: from.y, r0: 4, r1: 28 * ampScale,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 240
            });
            kit.triggerAmpCastAura(from.x - 16 * dir, groundY, amp, false);
            kit.spawnBurstParticles(from.x + 8 * dir, from.y, 12, 'star', {
              spdMin: 25, spdMax: 85, colors: ['#E0F7FF', '#67E8F9', '#38BDF8'],
              gravity: -20, lifeMin: 220, lifeMax: 380
            });
          }
        },
        {
          at: 165,
          fn() {
            const startX = from.x + 6 * dir;
            const dx = to.x - startX;
            const dy = to.y - from.y;
            const ang = Math.atan2(dy, dx);
            const ribbon = kit.addRibbon({
              pts: [{ x: startX, y: from.y }],
              width: 6.0 * ampScale,
              outerColor: '#1658EB',
              midColor: '#38BDF8',
              alpha: 0.92,
              dur: 420,
              fadeOut: 220,
              holdGate: 0,
              holdTravelMs: travelMs
            });

            // 飞射电光冰枪：精致收敛至 1.15 + holdGate:0 悬停蓄压
            kit.spawnPfx('ice_lance', { palette: icePal, length: 44 }, {
              x: startX, y: from.y,
              angle: ang,
              scale: 1.15 * ampScale,
              timeScale: 1.4,
              durMs: travelMs + 70,
              fadeInMs: 25,
              fadeOutMs: 60,
              layer: 'front',
              glowColor: 'rgba(56,189,248,0.50)', glowRadius: 26, glowAlpha: 0.44,
              holdGate: 0,
              holdTravelMs: travelMs,
              snapFadeMs: 55,
              onUpdate(slot, dtSec, age) {
                const p = evalP(slot, travelMs);
                slot.x = lerp(startX, to.x, p);
                slot.y = lerp(from.y, to.y, p);
                if (p < 0.995) {
                  ribbon.pts.push({ x: slot.x, y: slot.y });
                  if (ribbon.pts.length > 20) ribbon.pts.shift();
                  if (!slot._isHolding || Math.random() < 0.35) {
                    kit.addParticle({
                      kind: Math.random() < 0.55 ? 'shard' : 'star',
                      x: slot.x - Math.cos(ang) * 12 + (Math.random() - 0.5) * 10,
                      y: slot.y - Math.sin(ang) * 12 + (Math.random() - 0.5) * 10,
                      vx: -Math.cos(ang) * 52 + (Math.random() - 0.5) * 36,
                      vy: -Math.sin(ang) * 52 + (Math.random() - 0.5) * 36,
                      size: 2.2 + Math.random() * 2.2,
                      color: Math.random() < 0.35 ? '#FFFFFF' : '#67E8F9',
                      color2: '#1658EB',
                      life: 220 + Math.random() * 160
                    });
                  }
                }
              }
            });

            kit.addShockRing({
              x: from.x + 12 * dir, y: from.y, r0: 6, r1: 28, sy: 0.85,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 2.8, dur: 200, layer: 'front'
            });
          }
        },
        {
          at: 365,
          gate: 0,
          preTelegraphMs: 110,
          gateMeta: { beatIdx: 0, totalBeats: 1, targetIdx: 0 },
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 6.5 + amp * 2.2, 240);
            kit.safeCall(o.onHitStop, 50 + amp * 14);

            // 主冰晶爆发体量精致收敛：1.32 -> 1.18
            kit.spawnPfx('ice_shatter', { palette: icePal }, {
              x: to.x, y: targetGroundY - 2,
              scale: 1.18 * ampScale,
              preWarmSec: 0.50,
              timeScale: 1.68,
              durMs: 820,
              fadeInMs: 12,
              fadeOutMs: 220,
              layer: 'main',
              glowColor: 'rgba(56,189,248,0.44)', glowRadius: 38 * ampScale, glowAlpha: 0.40
            });

            kit.spawnPfx('hit_spark', { palette: PALETTES.slash, height: 20, aim: 0.1 }, {
              x: to.x, y: to.y + 24, scale: 1.22 * ampScale,
              durMs: 360, layer: 'front'
            });

            kit.addFlash(to.x, to.y, 38 * ampScale, '#38BDF8', 150, 0.40);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 8, r1: 38 * ampScale, points: 8,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 260
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 2, r0: 10, r1: 64 * ampScale, sy: 0.30,
              color: '#0EA5E9', coreColor: '#FFFFFF', lineW: 3.4, dur: 440
            });

            // 飞散晶块精细收敛
            kit.spawnBurstParticles(to.x, to.y, 22 + amp * 7, 'shard', {
              spdMin: 72, spdMax: 225, sizeMin: 2.4, sizeMax: 5.0,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'],
              color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.44, lifeMin: 440, lifeMax: 740
            });

            if (amp >= 2) {
              kit.spawnPfx('frost_nova', { palette: icePal, reach: 56 }, {
                x: to.x, y: targetGroundY + 2, scale: 0.96 * ampScale,
                preWarmSec: 0.38, timeScale: 1.45, durMs: 640, layer: 'back'
              });
            }
            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        },
        {
          at: 510,
          fn() {
            kit.safeCall(o.onShake, 5.0 + amp, 170);
            kit.addFlash(to.x, to.y - 6, 38 * ampScale, '#67E8F9', 155, 0.36);
            kit.addStarFlare({
              x: to.x, y: to.y - 8, r0: 8, r1: 40 * ampScale, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 300
            });
            kit.addShockRing({
              x: to.x, y: to.y - 6, r0: 12, r1: 56 * ampScale, sy: 0.85,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 2.9, dur: 320, layer: 'front'
            });
            kit.spawnBurstParticles(to.x, to.y - 8, 28, 'shard', {
              spdMin: 95, spdMax: 260, upBias: 92, sizeMin: 2.6, sizeMax: 5.8,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8', '#0EA5E9'],
              color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.46, lifeMin: 400, lifeMax: 680
            });
            kit.spawnBurstParticles(to.x, to.y - 16, 16, 'snow', {
              spdMin: 20, spdMax: 72, upBias: 48, gravity: 24,
              sizeMin: 2.4, sizeMax: 4.4,
              colors: ['#FFFFFF', '#E0F7FF'], color2: '#38BDF8',
              lifeMin: 420, lifeMax: 680
            });
          }
        }
      ]);
    },

    /* ========================================================================
       2. 防身平斩 / 法杖轻挥击 (basic_attack)
       干脆利落的银蓝雪瓷轻挥弧，短促清新，零冗长拖泥带水
       ======================================================================== */
    basic_attack(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const { lerp } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addStarFlare({
              x: from.x + 10 * dir, y: from.y - 4, r0: 4, r1: 24 * ampScale, points: 4,
              outerColor: '#93C5FD', coreColor: '#FFFFFF', dur: 190
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, 'silverIce');

            const pts = [];
            for (let i = 0; i <= 8; i++) {
              const t = i / 8;
              pts.push({
                x: lerp(from.x + 6 * dir, to.x - 24 * dir, t),
                y: lerp(from.y + 2, to.y, t) - Math.sin(t * Math.PI) * 10
              });
            }
            kit.addRibbon({
              pts,
              width: 6.4 * ampScale,
              palette: 'silverIce',
              alpha: 0.86,
              dur: 320,
              fadeOut: 160
            });
          }
        },
        {
          at: 185,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 4.4 + amp * 1.5, 150);
            kit.safeCall(o.onHitStop, 34 + amp * 10);

            const swScale = 1.48 * ampScale;
            kit.spawnPfx('sword_slash', {
              palette: amp >= 3 ? PALETTES.slashGold : PALETTES.silverIce,
              sparks: PALETTES.cyanSpark,
              radius: 36
            }, {
              x: to.x - 20 * dir * swScale,
              y: to.y + 26 * swScale,
              scale: swScale,
              flipX: dir < 0,
              durMs: 460,
              fadeInMs: 10,
              fadeOutMs: 140,
              layer: 'front'
            });

            kit.addSlash({
              x: to.x - 4 * dir, y: to.y + 2,
              rx: 78 * ampScale, ry: 46 * ampScale,
              tilt: dir > 0 ? -0.44 : 0.44,
              startAngle: dir > 0 ? -2.38 : 2.38,
              endAngle: dir > 0 ? 0.68 : -0.68,
              thickness: 19.5 * ampScale,
              outerColor: amp >= 3 ? '#D97706' : '#1658EB',
              midColor: amp >= 3 ? '#FDE68A' : '#38BDF8',
              hiColor: '#E0F7FF',
              dur: 380
            });

            kit.spawnPfx('hit_spark', {
              palette: PALETTES.silverIce,
              height: 18,
              aim: 0.08 * dir
            }, {
              x: to.x, y: to.y + 22,
              scale: 1.32 * ampScale,
              durMs: 320,
              layer: 'front'
            });

            kit.addFlash(to.x, to.y, 38 * ampScale, '#93C5FD', 135, 0.36);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 6, r1: 38 * ampScale, points: 4, rot: 0.4,
              outerColor: amp >= 3 ? '#FDE68A' : '#60A5FA', coreColor: '#FFFFFF', dur: 270
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 2, r0: 10, r1: 62 * ampScale, sy: 0.28,
              color: '#60A5FA', coreColor: '#FFFFFF', lineW: 3.0, dur: 340
            });

            kit.spawnBurstParticles(to.x, to.y, 16 + amp * 5, 'spark', {
              angleBase: dir > 0 ? -0.25 : Math.PI + 0.25, spread: 1.4,
              spdMin: 120, spdMax: 290, sizeMin: 2.2, sizeMax: 4.0,
              colors: ['#FFFFFF', '#DBEAFE', '#60A5FA', '#FDE68A'],
              gravity: 130, lifeMin: 220, lifeMax: 420
            });
            kit.spawnBurstParticles(to.x, to.y, 10, 'shard', {
              spdMin: 60, spdMax: 175, sizeMin: 2.4, sizeMax: 4.6,
              colors: ['#FFFFFF', '#DBEAFE', '#93C5FD'], color2: '#2563EB',
              groundY: targetGroundY, bounce: 0.35, lifeMin: 280, lifeMax: 520
            });

            if (amp >= 1) {
              kit.addSlash({
                x: to.x + 2 * dir, y: to.y - 4,
                rx: 62 * ampScale, ry: 34 * ampScale,
                tilt: dir > 0 ? 0.52 : -0.52,
                startAngle: dir > 0 ? 2.1 : -2.1,
                endAngle: dir > 0 ? -0.5 : 0.5,
                thickness: 12 * ampScale,
                palette: amp >= 3 ? 'gold' : 'slash',
                dur: 320
              });
              kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
            }
          }
        }
      ]);
    },

    /* ========================================================================
       3. 水球术 (water_orb) — 1 拍门控
       通透多层次折射水球沿轻盈抛物弧疾射，飞至目标前 88% 挂 gate:0，放行瞬间炸裂
       ======================================================================== */
    water_orb(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const { TAU, clamp, easeOutCubic, easeOutBack, quadBezier, quadBezierTangent } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);
      const travelMs = 215;
      const evalP = (ent, ms) => (typeof kit.evalHoldProgress === 'function'
        ? kit.evalHoldProgress(ent, ms)
        : easeOutCubic(clamp(ent.age / ms, 0, 1)));

      const p0 = { x: from.x + 12 * dir, y: from.y - 6 };
      const p2 = { x: to.x, y: to.y - 2 };
      const p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 44 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: from.x - 10 * dir, y: groundY + 2, radius: 40 * ampScale, sy: 0.30,
              palette: 'water', goldTriple: amp >= 3, dur: 480
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, 'water');

            // 杖前通透聚水球（蓄力阶段）
            kit.addCustomDrawable('front', {
              age: 0, dur: 175,
              draw(ctx, p) {
                const sc = easeOutBack(clamp(p / 0.72, 0, 1));
                const r = 13.5 * ampScale * sc;
                if (r <= 1) return;
                ctx.translate(p0.x, p0.y);
                const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
                g.addColorStop(0, '#FFFFFF');
                g.addColorStop(0.32, '#CFFAFE');
                g.addColorStop(0.74, '#22D3EE');
                g.addColorStop(1, '#0284C7');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.18, p * 4, p * 4 + Math.PI * 1.3);
                ctx.stroke();
              }
            });

            kit.spawnBurstParticles(p0.x, p0.y, 12, 'drop', {
              spdMin: 35, spdMax: 110, upBias: 40, sizeMin: 2.4, sizeMax: 4.6,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE'], color2: '#0284C7',
              groundY, lifeMin: 220, lifeMax: 380
            });
          }
        },
        {
          at: 145,
          fn() {
            kit.addShockRing({
              x: p0.x, y: p0.y, r0: 6, r1: 30 * ampScale, sy: 0.85,
              color: '#22D3EE', coreColor: '#FFFFFF', lineW: 3.0, dur: 220, layer: 'front'
            });

            const ribbon = kit.addRibbon({
              pts: [p0],
              width: 11.5 * ampScale,
              palette: 'water',
              alpha: 0.90,
              dur: 460,
              fadeOut: 220,
              holdGate: 0,
              holdTravelMs: travelMs
            });

            // 晶透立体水球飞行主体（holdGate:0 悬停蓄压在目标前 0.85→0.96）
            kit.addCustomDrawable('front', {
              age: 0, dur: travelMs + 30,
              holdGate: 0,
              holdTravelMs: travelMs,
              snapFadeMs: 28,
              update() {
                const t = evalP(this, travelMs);
                const pos = quadBezier(p0, p1, p2, t);
                this.cx = pos.x;
                this.cy = pos.y;
                this.ang = quadBezierTangent(p0, p1, p2, Math.min(0.99, t));
                if (t < 0.995) {
                  ribbon.pts.push({ x: pos.x, y: pos.y });
                  if (ribbon.pts.length > 22) ribbon.pts.shift();
                  if ((!this._isHolding && Math.random() < 0.8) || (this._isHolding && Math.random() < 0.35)) {
                    kit.addParticle({
                      kind: Math.random() < 0.72 ? 'drop' : 'star',
                      x: pos.x + (Math.random() - 0.5) * 14,
                      y: pos.y + (Math.random() - 0.5) * 14,
                      vx: -Math.cos(this.ang) * 45 + (Math.random() - 0.5) * 40,
                      vy: -Math.sin(this.ang) * 45 + (Math.random() - 0.5) * 40,
                      gravity: 160,
                      size: 2.6 + Math.random() * 2.8,
                      color: Math.random() < 0.35 ? '#FFFFFF' : '#67E8F9',
                      color2: '#0284C7',
                      groundY: targetGroundY,
                      life: 240 + Math.random() * 180
                    });
                  }
                }
              },
              draw(ctx, p) {
                const cx = this.cx != null ? this.cx : p0.x;
                const cy = this.cy != null ? this.cy : p0.y;
                const ang = this.ang || 0;
                const animP = p + ((this._holdWaitMs || 0) * 0.002);
                const pulse = this._isHolding ? (1 + 0.08 * Math.sin((this._holdWaitMs || 0) * 0.025)) : 1;
                const r = (15.5 + Math.sin(animP * 12) * 1.4) * ampScale * pulse;

                ctx.translate(cx, cy);
                ctx.rotate(ang);

                // 外圈水雾光晕
                const hg = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
                hg.addColorStop(0, 'rgba(103,232,249,0.52)');
                hg.addColorStop(1, 'rgba(14,165,233,0)');
                ctx.fillStyle = hg;
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.9, 0, TAU);
                ctx.fill();

                // 微微拉伸的流线晶透水球体
                ctx.scale(1.18, 0.92);
                const bg = ctx.createRadialGradient(-r * 0.25, -r * 0.32, r * 0.1, 0, 0, r);
                bg.addColorStop(0, '#FFFFFF');
                bg.addColorStop(0.28, '#CFFAFE');
                bg.addColorStop(0.68, '#22D3EE');
                bg.addColorStop(0.92, '#0284C7');
                bg.addColorStop(1, '#0369A1');
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TAU);
                ctx.fill();

                // 内部弧形折射亮面与高光泡
                ctx.strokeStyle = 'rgba(255,255,255,0.88)';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.72, -Math.PI * 0.78, -Math.PI * 0.12);
                ctx.stroke();

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(-r * 0.32, -r * 0.30, r * 0.22, 0, TAU);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(r * 0.26, r * 0.24, r * 0.11, 0, TAU);
                ctx.fill();

                // 旋转环流丝带
                ctx.strokeStyle = '#E0F9FF';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.ellipse(0, 0, r * 1.32, r * 0.56, animP * 8, 0, Math.PI * 1.45);
                ctx.stroke();
              }
            });
          }
        },
        {
          at: 145 + travelMs,
          gate: 0,
          preTelegraphMs: 110,
          gateMeta: { beatIdx: 0, totalBeats: 1, targetIdx: 0 },
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 6.8 + amp * 2.0, 220);
            kit.safeCall(o.onHitStop, 48 + amp * 12);

            kit.spawnPfx('splash', { palette: PALETTES.water, stone: false }, {
              x: to.x, y: targetGroundY + 2,
              scale: 1.86 * ampScale,
              preWarmSec: 0.14, timeScale: 1.34, durMs: 760,
              layer: 'front',
              glowColor: 'rgba(34,211,238,0.46)', glowRadius: 58 * ampScale, glowAlpha: 0.44
            });

            kit.spawnPfx('splash', { palette: PALETTES.ice, stone: false }, {
              x: to.x - 10 * dir, y: targetGroundY + 4,
              scale: 1.46 * ampScale, flipX: dir > 0,
              preWarmSec: 0.24, timeScale: 1.42, durMs: 680,
              layer: 'back'
            });

            // 水球爆裂晶透水膜泡泡环
            kit.addCustomDrawable('main', {
              age: 0, dur: 420,
              draw(ctx, p) {
                const r = (18 + easeOutCubic(p) * 58) * ampScale;
                const a = (1 - p) * 0.85;
                if (a <= 0.02) return;
                ctx.globalAlpha = a;
                ctx.strokeStyle = '#67E8F9';
                ctx.lineWidth = 4.2 * (1 - p * 0.6);
                ctx.beginPath();
                ctx.arc(to.x, to.y, r, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2.0 * (1 - p * 0.6);
                ctx.beginPath();
                ctx.arc(to.x, to.y, r * 0.92, -Math.PI * 0.85, Math.PI * 0.15);
                ctx.stroke();
              }
            });

            kit.addFlash(to.x, to.y, 52 * ampScale, '#22D3EE', 165, 0.42);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 8, r1: 46 * ampScale, points: 6,
              outerColor: amp >= 3 ? '#FDE68A' : '#22D3EE', coreColor: '#FFFFFF', dur: 310
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 3, r0: 12, r1: 102 * ampScale, sy: 0.28,
              color: '#0EA5E9', coreColor: '#CFFAFE', lineW: 3.8, dur: 460
            });

            kit.spawnBurstParticles(to.x, to.y, 38 + amp * 10, 'drop', {
              spdMin: 85, spdMax: 290, upBias: 115, gravity: 430,
              sizeMin: 3.0, sizeMax: 6.4,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE', '#38BDF8'],
              color2: '#0284C7', groundY: targetGroundY, bounce: 0.34,
              lifeMin: 400, lifeMax: 740
            });
            kit.spawnBurstParticles(to.x, to.y - 10, 14, 'star', {
              spdMin: 55, spdMax: 185, upBias: 60, gravity: 90,
              sizeMin: 2.8, sizeMax: 5.5,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9'],
              lifeMin: 340, lifeMax: 600
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       4. 蔓地薄冰 / 寒霜滑步 (frost_step_floor) — 1 拍门控
       脚底轻盈寒霜滑步起势 → 地表六角冰镜铺至目标前 88% 挂 gate:0 → 放行锁足冰爆
       ======================================================================== */
    frost_step_floor(kit, o) {
      const { from, groundY, amp, ampScale, icePal } = o;
      const { TAU, clamp, lerp, easeOutCubic } = kit.math;
      const targets = resolveTargetList(o);
      const dir = getDir(o);
      const spreadMs = 215;
      const evalP = (ent, ms) => (typeof kit.evalHoldProgress === 'function'
        ? kit.evalHoldProgress(ent, ms)
        : easeOutCubic(clamp(ent.age / ms, 0, 1)));

      const avgX = targets.reduce((s, t) => s + t.x, 0) / targets.length;
      const avgGY = targets.reduce((s, t) => s + t.groundY, 0) / targets.length;
      const spanX = Math.max(96, Math.abs(targets[targets.length - 1].x - targets[0].x) + 120);

      const cues = [
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: icePal }, {
              x: from.x - 10 * dir, y: groundY + 3, scale: 1.24 * ampScale,
              preWarmSec: 0.90, timeScale: 2.0, durMs: 480, layer: 'back'
            });
            kit.addMagicCircle({
              x: from.x - 10 * dir, y: groundY + 3, radius: 42 * ampScale, sy: 0.30,
              palette: icePal, goldTriple: amp >= 3, dur: 540
            });
            kit.addAfterimage({
              x: from.x + 12 * dir, y: groundY - 2,
              scale: 0.96, facing: dir, spriteId: o.spriteId || null,
              palette: 'ice', alpha: 0.62, dur: 460
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, false);
          }
        },
        {
          at: 105,
          fn() {
            // 通透贴地六角冰镜薄冰毯（holdGate:0 铺至 88% 蓄压待爆）
            kit.addCustomDrawable('back', {
              age: 0, dur: 1180,
              holdGate: 0,
              holdTravelMs: spreadMs,
              draw(ctx) {
                const grow = evalP(this, spreadMs);
                const fade = this._isHolding
                  ? 1
                  : (this.age > 880 ? clamp((1180 - this.age) / 300, 0, 1) : 1);
                if (fade <= 0.02) return;

                const rx = (spanX * 0.62) * grow * ampScale;
                const ry = 28 * grow * ampScale;
                const cx = lerp(from.x + 48 * dir, avgX, grow);
                const cy = lerp(groundY + 2, avgGY + 4, grow);
                const animAge = this.age + (this._holdWaitMs || 0);

                ctx.globalAlpha = fade * 0.92;

                // 底部柔和雪瓷蓝反射冰面
                const fg = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(12, rx));
                fg.addColorStop(0, 'rgba(224,247,255,0.72)');
                fg.addColorStop(0.55, 'rgba(56,189,248,0.42)');
                fg.addColorStop(0.88, 'rgba(22,88,235,0.22)');
                fg.addColorStop(1, 'rgba(22,88,235,0)');
                ctx.fillStyle = fg;
                ctx.beginPath();
                ctx.ellipse(cx, cy, Math.max(8, rx), Math.max(4, ry), 0, 0, TAU);
                ctx.fill();

                // 精致六角冰镜晶格线
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(cx, cy, Math.max(8, rx * 0.94), Math.max(4, ry * 0.92), 0, 0, TAU);
                ctx.clip();

                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = 1.2;
                const cell = 26;
                for (let gx = cx - rx; gx <= cx + rx; gx += cell) {
                  drawHexPoly(ctx, gx, cy, 15, 7.5, 0);
                  ctx.stroke();
                  drawHexPoly(ctx, gx + cell * 0.5, cy - 11, 13, 6.2, 0);
                  ctx.stroke();
                  drawHexPoly(ctx, gx + cell * 0.5, cy + 11, 13, 6.2, 0);
                  ctx.stroke();
                }

                // 掠过冰面的镜光扫带
                const sweepX = cx - rx + ((animAge * 0.34) % (rx * 2 + 40));
                const sg = ctx.createLinearGradient(sweepX - 24, cy, sweepX + 24, cy);
                sg.addColorStop(0, 'rgba(255,255,255,0)');
                sg.addColorStop(0.5, 'rgba(255,255,255,0.58)');
                sg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = sg;
                ctx.fillRect(sweepX - 24, cy - ry - 4, 48, ry * 2 + 8);
                ctx.restore();

                // 外缘冰亮边框
                ctx.strokeStyle = amp >= 3 ? '#FDE68A' : '#7DD3FC';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.ellipse(cx, cy, Math.max(8, rx * 0.96), Math.max(4, ry * 0.94), 0, 0, TAU);
                ctx.stroke();
              }
            });

            for (let idx = 0; idx < targets.length; idx++) {
              const tg = targets[idx];
              kit.addIceVein({
                x0: from.x + 12 * dir, y0: groundY + 2,
                x1: tg.x, y1: tg.groundY + 3,
                width: 3.0 * ampScale,
                growMs: spreadMs,
                palette: icePal,
                dur: 1080,
                holdGate: 0,
                holdTravelMs: spreadMs
              });
            }
          }
        },
        {
          at: 105 + spreadMs,
          gate: 0,
          preTelegraphMs: 110,
          gateMeta: { beatIdx: 0, totalBeats: 1, targetIdx: 0 },
          fn() {
            kit.safeCall(o.onShake, 5.4 + amp * 1.5, 165);
            kit.safeCall(o.onHitStop, 38 + amp * 10);

            for (let idx = 0; idx < targets.length; idx++) {
              const tg = targets[idx];
              const isLast = idx === targets.length - 1;
              const spikeDelay = idx * 18;
              kit.safeCall(o.onImpact, idx, tg, isLast);

              kit.spawnPfx('frost_nova', { palette: icePal, reach: 64 }, {
                x: tg.x, y: tg.groundY + 3,
                scale: 1.24 * ampScale,
                preWarmSec: 0.34, timeScale: 1.48, durMs: 720,
                layer: 'back'
              });

              // 锁足低矮精致冰晶环棘（紧贴脚踝、晶莹通透）
              kit.addHeroThorns({
                x: tg.x, y: tg.groundY + 3,
                palette: icePal,
                goldAccent: amp >= 3,
                dur: 780,
                spikes: [
                  { dx: -22, h: 30 * ampScale, w: 12, lean: -10, delay: 12 + spikeDelay, primary: false },
                  { dx: 22,  h: 32 * ampScale, w: 12, lean: 11,  delay: 16 + spikeDelay, primary: false },
                  { dx: -9,  h: 44 * ampScale, w: 14, lean: -5,  delay: spikeDelay,      primary: true },
                  { dx: 10,  h: 40 * ampScale, w: 13, lean: 6,   delay: 8 + spikeDelay,  primary: true }
                ]
              });

              kit.addShockRing({
                x: tg.x, y: tg.groundY + 3, r0: 10, r1: 62 * ampScale, sy: 0.28,
                color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.2, dur: 420
              });
              kit.addStarFlare({
                x: tg.x, y: tg.groundY - 12, r0: 6, r1: 30 * ampScale, points: 6,
                outerColor: amp >= 3 ? '#FDE68A' : '#67E8F9', coreColor: '#FFFFFF', dur: 290
              });

              kit.spawnBurstParticles(tg.x, tg.groundY - 6, 14 + amp * 4, 'shard', {
                spdMin: 55, spdMax: 165, upBias: 90, sizeMin: 2.6, sizeMax: 5.0,
                colors: ['#FFFFFF', '#E0F7FF', '#7DD3FC', '#38BDF8'], color2: '#1658EB',
                groundY: tg.groundY, bounce: 0.35, lifeMin: 360, lifeMax: 620
              });
              kit.spawnBurstParticles(tg.x, tg.groundY - 14, 12, 'snow', {
                spdMin: 20, spdMax: 85, upBias: 60, gravity: 20,
                sizeMin: 2.8, sizeMax: 5.4,
                colors: ['#FFFFFF', '#E0F7FF'], color2: '#38BDF8',
                lifeMin: 460, lifeMax: 740
              });

              if (isLast) {
                kit.triggerAmpImpactUpgrade(tg.x, tg.y, tg.groundY, amp);
              }
            }
          }
        }
      ];

      kit.scheduleTimeline(cues);
    },

    /* ========================================================================
       5. 寒霜吐息 (frost_breath) — 1 拍门控
       明亮晶透的扇形极寒流光吐息波逼近 88% 挂 gate:0 → 放行瞬间覆场冻结爆裂
       ======================================================================== */
    frost_breath(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale, icePal } = o;
      const { clamp, easeOutCubic } = kit.math;
      const targets = resolveTargetList(o);
      const dir = getDir(o);
      const extendMs = 205;
      const evalP = (ent, ms) => (typeof kit.evalHoldProgress === 'function'
        ? kit.evalHoldProgress(ent, ms)
        : easeOutCubic(clamp(ent.age / ms, 0, 1)));

      const mouth = { x: from.x + 14 * dir, y: from.y - 8 };
      const aimX = targets.reduce((s, t) => s + t.x, 0) / targets.length;
      const aimY = targets.reduce((s, t) => s + t.y, 0) / targets.length;
      const dx = aimX - mouth.x;
      const dy = aimY - mouth.y;
      const dist = Math.max(150, Math.hypot(dx, dy) + 46);
      const ang = Math.atan2(dy, dx);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: from.x - 10 * dir, y: groundY + 3, radius: 44 * ampScale, sy: 0.30,
              palette: icePal, goldTriple: amp >= 3, dur: 620
            });
            kit.addShockRing({
              x: mouth.x, y: mouth.y, r0: 28 * ampScale, r1: 6, sy: 0.85,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3.0, dur: 150, layer: 'front'
            });
            kit.addStarFlare({
              x: mouth.x, y: mouth.y, r0: 4, r1: 28 * ampScale, points: 6,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 220
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, false);
          }
        },
        {
          at: 135,
          fn() {
            // 扇形清透极寒吐息锥（holdGate:0 延展至目标前 0.85→0.96 蓄压）
            kit.addCustomDrawable('main', {
              age: 0, dur: 760,
              holdGate: 0,
              holdTravelMs: extendMs,
              draw(ctx) {
                const extend = evalP(this, extendMs);
                const fade = this._isHolding
                  ? 1
                  : (this.age > 520 ? clamp((760 - this.age) / 240, 0, 1) : 1);
                if (fade <= 0.02) return;

                const len = dist * extend;
                const spread = (64 + amp * 8) * ampScale;
                const animAge = this.age + (this._holdWaitMs || 0);

                ctx.translate(mouth.x, mouth.y);
                ctx.rotate(ang);
                ctx.globalAlpha = fade;

                // 外层晶透冰雾扇面
                const cg = ctx.createLinearGradient(0, 0, len, 0);
                cg.addColorStop(0, 'rgba(255,255,255,0.88)');
                cg.addColorStop(0.28, 'rgba(186,230,253,0.68)');
                cg.addColorStop(0.72, 'rgba(56,189,248,0.40)');
                cg.addColorStop(1, 'rgba(14,165,233,0)');
                ctx.fillStyle = cg;
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.quadraticCurveTo(len * 0.45, -spread * 0.65, len, -spread);
                ctx.lineTo(len, spread);
                ctx.quadraticCurveTo(len * 0.45, spread * 0.65, 0, 6);
                ctx.closePath();
                ctx.fill();

                // 内部 5 条流动寒气高光丝带
                ctx.lineCap = 'round';
                for (let s = -2; s <= 2; s++) {
                  const frac = s / 2;
                  const endY = frac * spread * 0.78;
                  const ph = animAge * 0.028 + s * 1.3;
                  ctx.strokeStyle = s === 0 ? '#FFFFFF' : (Math.abs(s) === 1 ? '#E0F7FF' : '#7DD3FC');
                  ctx.lineWidth = s === 0 ? 3.2 : 2.0;
                  ctx.beginPath();
                  for (let k = 0; k <= 16; k++) {
                    const u = k / 16;
                    const px = u * len;
                    const py = u * endY + Math.sin(u * 9 - ph) * (5 + u * 8);
                    if (k === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                  }
                  ctx.stroke();
                }

                // 喷口菱形冰焰核心
                kit.drawStarFlare(ctx, 12, 0, 18 * ampScale, 0.25, 4, animAge * 0.01, '#67E8F9', '#FFFFFF', fade * 0.9);
              }
            });

            // 高速寒流光栅层（冰色板 water_jet 呈现流动态势）
            kit.spawnPfx('water_jet', { palette: icePal, length: Math.min(200, Math.round(dist * 0.72)) }, {
              x: mouth.x, y: mouth.y - 4,
              angle: ang,
              scale: 1.34 * ampScale,
              alpha: 0.78,
              timeScale: 1.48,
              durMs: 620,
              fadeInMs: 30, fadeOutMs: 180,
              layer: 'main',
              clipRight: 0.1,
              holdGate: 0,
              holdTravelMs: extendMs,
              onUpdate(slot) {
                const p = evalP(slot, extendMs);
                slot.clipRight = clamp(0.1 + 0.9 * p, 0.1, 1);
              }
            });

            kit.spawnBurstParticles(mouth.x + Math.cos(ang) * 28, mouth.y + Math.sin(ang) * 28, 26, 'snow', {
              angleBase: ang, spread: 0.72, spdMin: 160, spdMax: 360,
              upBias: 0, gravity: 18, drag: 1.1,
              sizeMin: 3.2, sizeMax: 6.4,
              colors: ['#FFFFFF', '#E0F7FF', '#BAE6FD'], color2: '#38BDF8',
              lifeMin: 460, lifeMax: 780
            });
          }
        },
        {
          at: 135 + extendMs,
          gate: 0,
          preTelegraphMs: 110,
          gateMeta: { beatIdx: 0, totalBeats: 1, targetIdx: 0 },
          fn() {
            kit.safeCall(o.onShake, 6.2 + amp * 1.8, 220);
            kit.safeCall(o.onHitStop, 44 + amp * 10);

            for (let idx = 0; idx < targets.length; idx++) {
              const tg = targets[idx];
              const isLast = idx === targets.length - 1;
              kit.safeCall(o.onImpact, idx, tg, isLast);

              kit.spawnPfx('snowflake_burst', { palette: icePal, count: 9 }, {
                x: tg.x, y: tg.groundY + 4,
                scale: 1.54 * ampScale,
                preWarmSec: 0.16, timeScale: 1.24, durMs: 820,
                layer: 'front'
              });
              kit.spawnPfx('frost_nova', { palette: icePal, reach: 68 }, {
                x: tg.x, y: tg.groundY + 4,
                scale: 1.26 * ampScale,
                preWarmSec: 0.36, timeScale: 1.45, durMs: 740,
                layer: 'back'
              });
              kit.addFlash(tg.x, tg.y, 44 * ampScale, '#67E8F9', 165, 0.36);
              kit.addShockRing({
                x: tg.x, y: tg.groundY + 4, r0: 10, r1: 76 * ampScale, sy: 0.28,
                color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.4, dur: 440
              });
              kit.spawnBurstParticles(tg.x, tg.y - 8, 16 + amp * 4, 'shard', {
                angleBase: ang, spread: 1.2, spdMin: 75, spdMax: 210, upBias: 40,
                sizeMin: 2.8, sizeMax: 5.4,
                colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'], color2: '#1658EB',
                groundY: tg.groundY, bounce: 0.35, lifeMin: 380, lifeMax: 680
              });
            }

            kit.spawnBurstParticles(aimX, aimY - 14, 28, 'snow', {
              spdMin: 35, spdMax: 145, upBias: 50, gravity: 22,
              sizeMin: 3.4, sizeMax: 6.8,
              colors: ['#FFFFFF', '#E0F7FF', '#FEF9C3'], color2: '#0EA5E9',
              lifeMin: 500, lifeMax: 840
            });
          }
        },
        {
          at: 520,
          fn() {
            kit.addStarFlare({
              x: aimX, y: aimY - 8, r0: 10, r1: 50 * ampScale, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#67E8F9', coreColor: '#FFFFFF', dur: 340
            });
            kit.triggerAmpImpactUpgrade(aimX, aimY, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       6. 水幕轻纱 / 折射水幕 (water_veil)
       柔韧澄澈的碧青垂纱水幕穹顶 + 翠白净化十字光尘升腾
       ======================================================================== */
    water_veil(kit, o) {
      const { groundY, amp, ampScale } = o;
      const { TAU, clamp, easeOutBack } = kit.math;
      const PALETTES = kit.PALETTES;
      const { cx, cy } = resolveSelfCenter(o);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: cx, y: groundY + 4, radius: 52 * ampScale, sy: 0.30,
              palette: 'water', goldTriple: amp >= 3, dur: 1180, fadeIn: 140, fadeOut: 260
            });
            kit.spawnPfx('splash', { palette: PALETTES.water, stone: false }, {
              x: cx, y: groundY + 4, scale: 1.32 * ampScale,
              preWarmSec: 0.20, timeScale: 1.38, durMs: 560, layer: 'back'
            });
            kit.triggerAmpCastAura(cx, groundY, amp, 'water');
          }
        },
        {
          at: 155,
          fn() {
            kit.spawnPfx('divine_shield', { palette: PALETTES.water, radius: 30 }, {
              x: cx, y: cy + 40, scale: 1.66 * ampScale,
              alpha: 0.54, lightGain: 1.0, timeScale: 1.1,
              durMs: 1060, fadeInMs: 140, fadeOutMs: 260, layer: 'back'
            });

            // 流动水幕轻纱穹顶（水波边缘 + 垂纱高光折纹 + 净光涟漪）
            kit.addCustomDrawable('main', {
              age: 0, dur: 1080,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(this.age / 220, 0, 1));
                const exit = this.age > 800 ? clamp((1080 - this.age) / 280, 0, 1) : 1;
                if (exit <= 0.02) return;

                const rx = 54 * ampScale * (0.45 + 0.55 * enter);
                const ry = 60 * ampScale * (0.45 + 0.55 * enter);
                const pulse = this.age >= 280 && this.age < 500
                  ? Math.sin(((this.age - 280) / 220) * Math.PI)
                  : 0;

                ctx.translate(cx, cy - 2);
                ctx.globalAlpha = exit;

                // 通透水膜球面渐变（中央极透，边缘碧青亮水环）
                const dg = ctx.createRadialGradient(-rx * 0.22, -ry * 0.28, rx * 0.14, 0, 0, Math.max(rx, ry));
                dg.addColorStop(0, 'rgba(255,255,255,0.06)');
                dg.addColorStop(0.55, 'rgba(103,232,249,0.16)');
                dg.addColorStop(0.84, 'rgba(34,211,238,0.34)');
                dg.addColorStop(1, 'rgba(207,250,254,0.68)');
                ctx.fillStyle = dg;
                ctx.beginPath();
                const segs = 36;
                for (let i = 0; i <= segs; i++) {
                  const a = (i / segs) * TAU;
                  const wave = Math.sin(a * 6 + this.age * 0.012) * 2.4;
                  const px = Math.cos(a) * (rx + wave);
                  const py = Math.sin(a) * (ry + wave * 0.7);
                  if (i === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();

                // 4 条优雅流动垂纱折光水丝
                ctx.lineCap = 'round';
                for (let s = -1.5; s <= 1.5; s += 1) {
                  const xOff = s * rx * 0.36;
                  ctx.strokeStyle = Math.abs(s) < 1 ? 'rgba(255,255,255,0.72)' : 'rgba(165,243,252,0.58)';
                  ctx.lineWidth = Math.abs(s) < 1 ? 2.2 : 1.5;
                  ctx.beginPath();
                  for (let k = 0; k <= 14; k++) {
                    const u = k / 14;
                    const y = (u - 0.5) * ry * 1.72;
                    const arch = Math.sqrt(Math.max(0.05, 1 - Math.pow(y / (ry * 1.02), 2)));
                    const x = xOff * arch + Math.sin(u * 7 - this.age * 0.014 + s) * 3.5;
                    if (k === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                  }
                  ctx.stroke();
                }

                // 外轮廓碧青纯白水膜高光
                ctx.strokeStyle = pulse > 0.1 ? '#FFFFFF' : '#67E8F9';
                ctx.lineWidth = 2.6 + pulse * 1.8;
                ctx.beginPath();
                ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
                ctx.stroke();

                // 左上方清透弯月高光
                ctx.strokeStyle = 'rgba(255,255,255,0.92)';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, rx * 0.86, ry * 0.86, 0, -Math.PI * 0.82, -Math.PI * 0.28);
                ctx.stroke();

                // 倾斜环绕水带
                ctx.rotate(-0.22);
                ctx.strokeStyle = amp >= 3 ? '#FDE68A' : '#22D3EE';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, rx * 1.24, ry * 0.30, 0, 0, TAU);
                ctx.stroke();
              }
            });
          }
        },
        {
          at: 440,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 2.8 + amp * 0.9, 130);

            kit.addShockRing({
              x: cx, y: cy, r0: 44 * ampScale, r1: 96 * ampScale, sy: 0.94,
              color: '#22D3EE', coreColor: '#FFFFFF', lineW: 3.2, dur: 440, layer: 'front'
            });
            kit.addShockRing({
              x: cx, y: groundY + 4, r0: 16, r1: 88 * ampScale, sy: 0.28,
              color: '#34D399', coreColor: '#ECFDF5', lineW: 3.0, dur: 460
            });
            kit.addStarFlare({
              x: cx, y: cy - 56 * ampScale, r0: 6, r1: 32 * ampScale, points: 6,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 420
            });

            // 净化异常：上升翠白光十字 + 晶莹水珠
            kit.spawnBurstParticles(cx, cy + 8, 16 + amp * 4, 'cross', {
              spdMin: 24, spdMax: 78, upBias: 95, gravity: -32,
              sizeMin: 3.8, sizeMax: 6.4,
              colors: ['#6EE7B7', '#34D399', '#A7F3D0', '#CFFAFE'], color2: '#059669',
              lifeMin: 480, lifeMax: 780
            });
            kit.spawnBurstParticles(cx, cy, 22, 'drop', {
              spdMin: 50, spdMax: 150, upBias: 75, gravity: 180,
              sizeMin: 2.8, sizeMax: 5.4,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE'], color2: '#0284C7',
              groundY, bounce: 0.3, lifeMin: 420, lifeMax: 740
            });

            if (amp >= 3) {
              kit.addMagicCircle({
                x: cx, y: groundY + 4, radius: 68, sy: 0.30,
                palette: 'gold', goldTriple: true, dur: 640, fadeIn: 80, fadeOut: 200
              });
            }
          }
        }
      ]);
    },

    /* ========================================================================
       7. 冰晶护盾 / 凝水厚冰墙 / 钢冰生根盾 (ice_shield)
       地脉冰根固定 → 前倾多面棱镜厚冰盾 + 冰晶底座 + 霜花锁定脉冲
       ======================================================================== */
    ice_shield(kit, o) {
      const { groundY, amp, ampScale, icePal } = o;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);
      const { cx, cy } = resolveSelfCenter(o);
      const sx = cx + 10 * dir;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: cx, y: groundY + 4, radius: 54 * ampScale, sy: 0.30,
              palette: icePal, goldTriple: amp >= 3, dur: 1220, fadeIn: 130, fadeOut: 260
            });
            // 脚下接地生根冰脉
            kit.addIceVein({
              x0: cx - 32 * dir, y0: groundY + 4,
              x1: sx + 34 * dir, y1: groundY + 4,
              width: 3.4 * ampScale, growMs: 190, palette: icePal, dur: 1080
            });
            kit.addIceVein({
              x0: cx, y0: groundY - 6,
              x1: sx + 22 * dir, y1: groundY + 12,
              width: 2.8 * ampScale, growMs: 210, palette: icePal, dur: 1040
            });
            kit.triggerAmpCastAura(cx, groundY, amp, false);
          }
        },
        {
          at: 165,
          fn() {
            kit.spawnPfx('divine_shield', { palette: icePal, radius: 32 }, {
              x: sx, y: cy + 42,
              scale: 1.78 * ampScale,
              alpha: 0.68, lightGain: 0.96, timeScale: 1.15,
              durMs: 1120, fadeInMs: 130, fadeOutMs: 260,
              layer: 'main',
              glowColor: 'rgba(56,189,248,0.34)', glowRadius: 60 * ampScale, glowAlpha: 0.32
            });

            kit.addPrismShield({
              x: sx, y: cy - 2,
              radius: 56 * ampScale,
              ampTier: amp,
              lockAt: 260,
              palette: amp >= 3 ? 'iceGold' : 'ice',
              dur: 1120
            });

            // 盾基两侧坚实冰晶锚座
            kit.spawnPfx('ice_crystal', { palette: icePal, height: 26 }, {
              x: sx + 30 * dir, y: groundY + 4, scale: 0.88 * ampScale,
              durMs: 920, fadeInMs: 60, fadeOutMs: 200, layer: 'back'
            });
          }
        },
        {
          at: 425,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: sx, y: cy }, true);
            kit.safeCall(o.onShake, 4.2 + amp * 1.1, 160);

            kit.spawnPfx('snowflake_burst', { palette: icePal, count: 8 }, {
              x: sx, y: cy + 16, scale: 1.32 * ampScale,
              alpha: 0.84, preWarmSec: 0.14, timeScale: 1.3, durMs: 680, layer: 'front'
            });

            kit.addStarFlare({
              x: sx, y: cy - 54 * ampScale, r0: 8, r1: 34 * ampScale, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: sx, y: cy, r0: 46 * ampScale, r1: 96 * ampScale, sy: 0.96,
              color: amp >= 3 ? '#F59E0B' : '#38BDF8', coreColor: '#FFFFFF', lineW: 3.4, dur: 420, layer: 'front'
            });
            kit.addShockRing({
              x: sx, y: groundY + 4, r0: 14, r1: 88 * ampScale, sy: 0.30,
              color: '#0EA5E9', coreColor: '#E0F7FF', lineW: 3.2, dur: 440
            });

            kit.spawnBurstParticles(sx, cy, 20 + amp * 6, 'shard', {
              spdMin: 60, spdMax: 165, upBias: 40, gravity: 110,
              sizeMin: 2.8, sizeMax: 5.6,
              colors: ['#FFFFFF', '#E0F7FF', '#7DD3FC', '#38BDF8'], color2: '#1658EB',
              groundY, bounce: 0.36, lifeMin: 420, lifeMax: 720
            });

            if (amp >= 2) {
              kit.addLightning(sx - 44, cy - 30, sx + 44, cy + 28, {
                outerColor: amp >= 3 ? '#D97706' : '#1658EB',
                midColor: amp >= 3 ? '#FDE68A' : '#67E8F9',
                width: 2.1, dur: 280, branches: 2
              });
            }
          }
        }
      ]);
    },

    /* ========================================================================
       8. 镜霜冰壁 (mirror_frost_wall)
       高耸无瑕的三折冰镜面立于身前，带炫目斜向虹彩镜面扫光与棱镜折射射线
       ======================================================================== */
    mirror_frost_wall(kit, o) {
      const { groundY, amp, ampScale } = o;
      const { TAU, clamp, easeOutBack, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);
      const { cx, cy } = resolveSelfCenter(o);
      const wx = cx + 54 * dir;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: cx, y: groundY + 4, radius: 50 * ampScale, sy: 0.30,
              palette: 'silverIce', goldTriple: amp >= 3, dur: 1180
            });
            kit.addIceVein({
              x0: cx + 6 * dir, y0: groundY + 4,
              x1: wx + 10 * dir, y1: groundY + 4,
              width: 3.4 * ampScale, growMs: 170, palette: 'silverIce', dur: 1120
            });
            kit.triggerAmpCastAura(cx, groundY, amp, 'silverIce');
          }
        },
        {
          at: 165,
          fn() {
            // 三折立面镜霜冰壁（中央高耸晶镜 + 上下斜翼 + 虹彩扫光）
            kit.addCustomDrawable('main', {
              age: 0, dur: 1160,
              draw(ctx, p) {
                const rise = easeOutBack(clamp(this.age / 230, 0, 1));
                const exit = this.age > 880 ? clamp((1160 - this.age) / 280, 0, 1) : 1;
                if (exit <= 0.02) return;

                const h = 114 * ampScale * clamp(rise, 0, 1.06);
                const w = 28 * ampScale;
                const flare = this.age >= 295 && this.age < 530
                  ? Math.sin(((this.age - 295) / 235) * Math.PI)
                  : 0;

                ctx.translate(wx, groundY + 4);
                ctx.globalAlpha = exit;

                // 冰壁脚下折射地光
                const bg = ctx.createRadialGradient(0, 0, 4, 0, 0, 44 * ampScale);
                bg.addColorStop(0, 'rgba(224,247,255,0.84)');
                bg.addColorStop(0.55, 'rgba(96,165,250,0.40)');
                bg.addColorStop(1, 'rgba(37,99,235,0)');
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.ellipse(0, 0, 44 * ampScale, 12 * ampScale, 0, 0, TAU);
                ctx.fill();

                // 三面棱镜轮廓（主面 + 后侧反光折面）
                const mainPoly = [
                  { x: -w * 0.45 * dir, y: 0 },
                  { x: -w * 0.62 * dir, y: -h * 0.78 },
                  { x: 0,               y: -h },
                  { x: w * 0.65 * dir,  y: -h * 0.80 },
                  { x: w * 0.48 * dir,  y: 0 }
                ];

                const tracePoly = pts => {
                  ctx.beginPath();
                  ctx.moveTo(pts[0].x, pts[0].y);
                  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                  ctx.closePath();
                };

                // 侧翼副冰镜（左右两块斜切小镜）
                for (let side = -1; side <= 1; side += 2) {
                  const wingX = side * w * 0.72;
                  const wingH = h * 0.72;
                  const wg = ctx.createLinearGradient(wingX, -wingH, wingX, 0);
                  wg.addColorStop(0, 'rgba(248,250,252,0.88)');
                  wg.addColorStop(0.45, 'rgba(147,197,253,0.62)');
                  wg.addColorStop(1, 'rgba(37,99,235,0.46)');
                  ctx.fillStyle = wg;
                  ctx.beginPath();
                  ctx.moveTo(wingX - 7, 0);
                  ctx.lineTo(wingX - 9, -wingH * 0.82);
                  ctx.lineTo(wingX + side * 4, -wingH);
                  ctx.lineTo(wingX + 9, -wingH * 0.76);
                  ctx.lineTo(wingX + 7, 0);
                  ctx.closePath();
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                  ctx.lineWidth = 1.4;
                  ctx.stroke();
                }

                // 主镜体通透雪瓷渐变
                const mg = ctx.createLinearGradient(-w, -h, w, 0);
                mg.addColorStop(0, 'rgba(255,255,255,0.92)');
                mg.addColorStop(0.30, 'rgba(219,234,254,0.78)');
                mg.addColorStop(0.65, 'rgba(96,165,250,0.62)');
                mg.addColorStop(1, 'rgba(29,78,216,0.52)');
                ctx.fillStyle = mg;
                tracePoly(mainPoly);
                ctx.fill();

                // 镜面内部斜切折射棱光带
                ctx.save();
                tracePoly(mainPoly);
                ctx.clip();
                const sweepY = -h * 1.1 + ((this.age * 0.22) % (h * 1.8));
                ctx.rotate(-0.42 * dir);
                const rg = ctx.createLinearGradient(0, sweepY - 18, 0, sweepY + 18);
                rg.addColorStop(0, 'rgba(255,255,255,0)');
                rg.addColorStop(0.35, 'rgba(103,232,249,0.55)');
                rg.addColorStop(0.50, `rgba(255,255,255,${0.78 + flare * 0.2})`);
                rg.addColorStop(0.68, 'rgba(253,230,138,0.48)');
                rg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = rg;
                ctx.fillRect(-w * 2, sweepY - 18, w * 4, 36);
                ctx.restore();

                // 镜脊中线与外轮廓高光
                ctx.strokeStyle = flare > 0.1 ? '#FFFFFF' : '#BAE6FD';
                ctx.lineWidth = 2.4 + flare * 1.4;
                tracePoly(mainPoly);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(0, -h + 2);
                ctx.lineTo(0, -2);
                ctx.stroke();

                // 前方扇形镜面折射光丝（落成脉冲期间闪耀）
                if (flare > 0.04) {
                  const rayLen = (68 + easeOutCubic(flare) * 44) * ampScale;
                  const rayCols = ['#67E8F9', '#FFFFFF', '#FDE68A'];
                  for (let r = -1; r <= 1; r++) {
                    const ra = r * 0.26;
                    ctx.strokeStyle = rayCols[r + 1];
                    ctx.lineWidth = (r === 0 ? 3.2 : 2.0) * flare;
                    ctx.globalAlpha = exit * flare * 0.9;
                    ctx.beginPath();
                    ctx.moveTo(w * 0.35 * dir, -h * 0.54);
                    ctx.lineTo(w * 0.35 * dir + Math.cos(ra) * rayLen * dir, -h * 0.54 + Math.sin(ra) * rayLen);
                    ctx.stroke();
                  }
                }
              }
            });

            kit.spawnPfx('parry', { palette: PALETTES.silverIce, height: 32 }, {
              x: wx, y: cy + 36, scale: 1.48 * ampScale, durMs: 520, layer: 'front'
            });
          }
        },
        {
          at: 460,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: wx, y: cy }, true);
            kit.safeCall(o.onShake, 4.4 + amp * 1.2, 160);

            kit.addStarFlare({
              x: wx, y: cy - 10, r0: 10, r1: 48 * ampScale, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#93C5FD', coreColor: '#FFFFFF', dur: 440
            });
            kit.addStarFlare({
              x: wx, y: groundY - 108 * ampScale, r0: 5, r1: 24 * ampScale, points: 4,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: wx, y: cy - 6, r0: 16, r1: 72 * ampScale, sy: 1.22,
              color: '#93C5FD', coreColor: '#FFFFFF', lineW: 3.2, dur: 440, layer: 'front'
            });
            kit.addShockRing({
              x: wx, y: groundY + 4, r0: 12, r1: 86 * ampScale, sy: 0.28,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.2, dur: 460
            });

            if (amp >= 2) {
              kit.spawnPfx('frost_nova', { palette: PALETTES.silverIce, reach: 66 }, {
                x: wx, y: groundY + 4, scale: 1.24 * ampScale,
                preWarmSec: 0.36, timeScale: 1.45, durMs: 640, layer: 'back'
              });
            }

            kit.spawnBurstParticles(wx, cy - 8, 26 + amp * 6, 'shard', {
              angleBase: dir > 0 ? 0 : Math.PI, spread: 1.7,
              spdMin: 65, spdMax: 195, upBias: 45, gravity: 100,
              sizeMin: 2.8, sizeMax: 5.8,
              colors: ['#FFFFFF', '#DBEAFE', '#93C5FD', '#67E8F9', '#FDE68A'],
              color2: '#2563EB', groundY, bounce: 0.35, lifeMin: 420, lifeMax: 740
            });
          }
        }
      ]);
    },

    /* ========================================================================
       9. 剑技·扎根踏步 / 生根步·卸力侧滑 (sword_root_step)
       沉膝扎根地脉 → 银蓝两步侧滑残像 + 卸力星花 → 剑尖青白蓄锋棱环
       ======================================================================== */
    sword_root_step(kit, o) {
      const { from, groundY, amp, ampScale } = o;
      const { TAU, clamp, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addShockRing({
              x: from.x, y: groundY + 3, r0: 8, r1: 58 * ampScale, sy: 0.28,
              color: '#0EA5E9', coreColor: '#CCFBF1', lineW: 3.6, dur: 380
            });
            // 四向短促生根定桩冰脉
            const rootAngles = [-2.5, -0.6, 0.5, 2.4];
            for (let i = 0; i < rootAngles.length; i++) {
              const a = rootAngles[i];
              kit.addIceVein({
                x0: from.x, y0: groundY + 3,
                x1: from.x + Math.cos(a) * 44 * ampScale,
                y1: groundY + 3 + Math.sin(a) * 14 * ampScale,
                segs: 4, jitter: 5, width: 2.6 * ampScale,
                growMs: 160, palette: 'silverIce', dur: 760
              });
            }
            kit.triggerAmpCastAura(from.x, groundY, amp, 'wind');
          }
        },
        {
          at: 110,
          fn() {
            // 两步侧滑晶透残像 + 弧形卸力气带
            kit.addAfterimage({
              x: from.x - 10 * dir, y: groundY - 2,
              scale: 0.98, facing: dir, spriteId: o.spriteId || null,
              palette: 'silverIce', alpha: 0.68, dur: 560
            });
            kit.addAfterimage({
              x: from.x + 18 * dir, y: groundY - 4,
              scale: 1.04, facing: dir, spriteId: o.spriteId || null,
              palette: 'wind', alpha: 0.84, dur: 620
            });

            const arcPts = [];
            for (let i = 0; i <= 14; i++) {
              const u = i / 14;
              arcPts.push({
                x: from.x - 20 * dir + u * 64 * dir,
                y: from.y + 18 - Math.sin(u * Math.PI) * 30
              });
            }
            kit.addRibbon({
              pts: arcPts,
              width: 8.5 * ampScale,
              palette: 'slashWind',
              alpha: 0.90,
              dur: 540,
              fadeOut: 240
            });

            kit.spawnPfx('parry', { palette: PALETTES.ice, height: 28 }, {
              x: from.x + 26 * dir, y: from.y + 30,
              scale: 1.48 * ampScale, durMs: 500, layer: 'front'
            });
          }
        },
        {
          at: 310,
          fn() {
            const bx = from.x + 24 * dir;
            const by = from.y - 4;
            kit.safeCall(o.onImpact, 0, { x: bx, y: by }, true);
            kit.safeCall(o.onShake, 3.8 + amp * 1.1, 150);

            kit.spawnPfx('divine_shield', { palette: PALETTES.silverIce, radius: 26 }, {
              x: from.x + 12 * dir, y: from.y + 38,
              scale: 1.42 * ampScale, alpha: 0.56, durMs: 660, layer: 'main'
            });

            // 剑心蓄势双旋转青白锐弧
            kit.addCustomDrawable('front', {
              age: 0, dur: 620,
              draw(ctx, p) {
                const fade = p > 0.65 ? clamp((1 - p) / 0.35, 0, 1) : 1;
                const r = (24 + easeOutCubic(clamp(p / 0.35, 0, 1)) * 22) * ampScale;
                ctx.translate(bx, by);
                ctx.globalAlpha = fade;

                ctx.strokeStyle = amp >= 3 ? '#FDE68A' : '#2DD4BF';
                ctx.lineWidth = 3.0;
                ctx.beginPath();
                ctx.arc(0, 0, r, p * 5.2, p * 5.2 + Math.PI * 1.15);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.78, -p * 6.4, -p * 6.4 + Math.PI * 0.95);
                ctx.stroke();

                // 剑尖横贯闪线
                const lineL = 34 * ampScale * (1 - p * 0.4);
                ctx.strokeStyle = '#E0F7FF';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(-lineL, 0);
                ctx.lineTo(lineL, 0);
                ctx.stroke();
              }
            });

            kit.addStarFlare({
              x: bx, y: by, r0: 6, r1: 42 * ampScale, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#67E8F9', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: from.x + 12 * dir, y: groundY + 3, r0: 14, r1: 82 * ampScale, sy: 0.28,
              color: '#2DD4BF', coreColor: '#FFFFFF', lineW: 3.4, dur: 440
            });

            kit.spawnBurstParticles(bx, by, 18 + amp * 5, 'leaf', {
              spdMin: 55, spdMax: 180, upBias: 60, gravity: 24, drag: 1.0,
              sizeMin: 3.6, sizeMax: 6.4,
              colors: ['#CCFBF1', '#6EE7B7', '#67E8F9', '#FFFFFF'], color2: '#059669',
              lifeMin: 420, lifeMax: 720
            });
            kit.spawnBurstParticles(bx, by, 12, 'star', {
              spdMin: 45, spdMax: 150, upBias: 45, gravity: 20,
              sizeMin: 2.8, sizeMax: 5.4,
              colors: ['#FFFFFF', '#67E8F9', '#FDE68A'],
              lifeMin: 360, lifeMax: 640
            });
          }
        }
      ]);
    },

    /* ========================================================================
       10. 剑技·反击闪刃 (sword_riposte_flash)
       金青弹反格挡星花 → 极速残像居合贯冲 → 十字闪刃光痕与雷弧暴击
       ======================================================================== */
    sword_riposte_flash(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const { clamp, lerp, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            const px = from.x + 26 * dir;
            const py = from.y - 2;
            kit.spawnPfx('parry', { palette: PALETTES.gold7, height: 30 }, {
              x: px, y: py + 32, scale: 1.66 * ampScale, durMs: 420, layer: 'front'
            });
            kit.addStarFlare({
              x: px, y: py, r0: 8, r1: 46 * ampScale, inner: 0.16, points: 4,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 280
            });
            kit.addShockRing({
              x: px, y: py, r0: 6, r1: 42 * ampScale, sy: 0.9,
              color: '#F59E0B', coreColor: '#FFFFFF', lineW: 3.4, dur: 240, layer: 'front'
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, 'slashGold');
          }
        },
        {
          at: 165,
          fn() {
            const dashPts = [];
            for (let i = 0; i <= 10; i++) {
              const t = i / 10;
              dashPts.push({
                x: lerp(from.x + 12 * dir, to.x + 16 * dir, t),
                y: lerp(from.y, to.y, t)
              });
            }
            kit.addRibbon({
              pts: dashPts,
              width: 11 * ampScale,
              palette: 'slashGold',
              alpha: 0.95,
              dur: 420,
              fadeOut: 200
            });
            kit.addAfterimage({
              x: lerp(from.x, to.x, 0.45), y: groundY - 4,
              scale: 1.04, facing: dir, spriteId: o.spriteId || null,
              palette: 'slashGold', alpha: 0.82, dur: 460
            });
          }
        },
        {
          at: 295,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 8.8 + amp * 2.2, 240);
            kit.safeCall(o.onHitStop, 68 + amp * 14);

            const dsScale = 1.76 * ampScale;
            kit.spawnPfx('double_slash', {
              palette: PALETTES.slashGold,
              sparks: PALETTES.goldSpark
            }, {
              x: to.x - 32 * dir * dsScale,
              y: to.y + 22 * dsScale,
              scale: dsScale,
              flipX: dir < 0,
              durMs: 640,
              fadeInMs: 10, fadeOutMs: 160,
              layer: 'front'
            });

            kit.addSlash({
              x: to.x, y: to.y,
              rx: 96 * ampScale, ry: 54 * ampScale,
              tilt: dir > 0 ? -0.52 : 0.52,
              startAngle: dir > 0 ? -2.5 : 2.5,
              endAngle: dir > 0 ? 0.78 : -0.78,
              thickness: 24 * ampScale,
              palette: 'slashGold',
              dur: 440
            });

            // 极速居合贯通闪刃斜切光痕
            kit.addCustomDrawable('front', {
              age: 0, dur: 440,
              draw(ctx, p) {
                const ext = easeOutCubic(clamp(this.age / 85, 0, 1));
                const fade = p > 0.45 ? clamp((1 - p) / 0.55, 0, 1) : 1;
                if (fade <= 0.02) return;

                const len = 104 * ampScale * ext;
                const w = (10 * (1 - p * 0.75)) * ampScale;
                ctx.translate(to.x, to.y);
                ctx.rotate(dir > 0 ? -0.34 : 0.34);
                ctx.globalAlpha = fade;

                ctx.fillStyle = '#0EA5E9';
                drawDiamond(ctx, 0, 0, len * 1.06, w * 1.55);
                ctx.fill();

                ctx.fillStyle = '#FDE68A';
                drawDiamond(ctx, 0, 0, len, w);
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                drawDiamond(ctx, 0, 0, len * 0.92, Math.max(1.5, w * 0.45));
                ctx.fill();
              }
            });

            kit.spawnPfx('crit_hit', { palette: PALETTES.gold, height: 24, aim: -0.14 * dir }, {
              x: to.x, y: to.y + 32, scale: 1.62 * ampScale, durMs: 520, layer: 'front'
            });

            kit.addLightning(to.x - 54 * dir, to.y + 24, to.x + 56 * dir, to.y - 26, {
              outerColor: '#D97706', midColor: '#FDE68A', width: 2.5, dur: 280, branches: 2
            });
            kit.addLightning(to.x - 36, to.y - 36, to.x + 38, to.y + 34, {
              outerColor: '#1658EB', midColor: '#67E8F9', width: 2.1, dur: 250, branches: 2
            });

            kit.addFlash(to.x, to.y, 54 * ampScale, '#FDE68A', 155, 0.38);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 12, r1: 64 * ampScale, inner: 0.14, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 3, r0: 14, r1: 108 * ampScale, sy: 0.28,
              color: '#F59E0B', coreColor: '#FFFFFF', lineW: 3.8, dur: 440
            });

            kit.spawnBurstParticles(to.x, to.y, 30 + amp * 8, 'spark', {
              spdMin: 150, spdMax: 370, sizeMin: 2.5, sizeMax: 4.8,
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#67E8F9'],
              gravity: 115, lifeMin: 260, lifeMax: 520
            });
            kit.spawnBurstParticles(to.x, to.y, 18, 'shard', {
              spdMin: 80, spdMax: 230, sizeMin: 2.8, sizeMax: 5.6,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#FDE68A'], color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.4, lifeMin: 360, lifeMax: 660
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       11. 远程·盲射穿棱 / 侧翼盲区冰弹 (remote_blind_shot)
       不经手隔空瞬凝：敌侧上方视觉盲区骤开斜角微法阵 → 贴脸超速穿棱贯背
       ======================================================================== */
    remote_blind_shot(kit, o) {
      const { from, to, targetGroundY, amp, ampScale, icePal } = o;
      const { clamp, lerp, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);

      const spawnPt = { x: to.x - 74 * dir, y: to.y - 46 };
      const exitPt = { x: to.x + 56 * dir, y: to.y + 34 };
      const ang = Math.atan2(to.y - spawnPt.y, to.x - spawnPt.x);
      const travelMs = 125;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            // 施法者指尖仅亮轻盈导魔微芒（凸显“不经手”）
            kit.addStarFlare({
              x: from.x + 10 * dir, y: from.y - 8, r0: 3, r1: 18 * ampScale, points: 4,
              outerColor: '#7DD3FC', coreColor: '#FFFFFF', dur: 190
            });

            // 敌侧上方盲区骤现倾斜微型冰棱法阵
            kit.addMagicCircle({
              x: spawnPt.x, y: spawnPt.y, radius: 30 * ampScale, sy: 0.72,
              palette: icePal, goldTriple: amp >= 3,
              dur: 420, fadeIn: 75, fadeOut: 140, layer: 'front'
            });
            kit.addStarFlare({
              x: spawnPt.x, y: spawnPt.y, r0: 4, r1: 28 * ampScale, points: 6,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 220
            });
            kit.addShockRing({
              x: spawnPt.x, y: spawnPt.y, r0: 26, r1: 6, sy: 0.85,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 2.6, dur: 155, layer: 'front'
            });
            kit.triggerAmpCastAura(spawnPt.x, targetGroundY, amp, false);
          }
        },
        {
          at: 165,
          fn() {
            const ribbon = kit.addRibbon({
              pts: [spawnPt],
              width: 8.6 * ampScale,
              palette: amp >= 3 ? 'iceGold' : 'ice',
              alpha: 0.94,
              dur: 380,
              fadeOut: 190
            });

            kit.spawnPfx('ice_lance', { palette: icePal, length: 46 }, {
              x: spawnPt.x, y: spawnPt.y,
              angle: ang,
              scale: 1.44 * ampScale,
              timeScale: 1.6,
              durMs: travelMs + 60,
              fadeInMs: 12, fadeOutMs: 45,
              layer: 'front',
              glowColor: 'rgba(56,189,248,0.52)', glowRadius: 30, glowAlpha: 0.45,
              onUpdate(slot, dtSec, age) {
                const p = easeOutCubic(clamp(age / travelMs, 0, 1));
                slot.x = lerp(spawnPt.x, to.x, p);
                slot.y = lerp(spawnPt.y, to.y, p);
                ribbon.pts.push({ x: slot.x, y: slot.y });
                if (ribbon.pts.length > 18) ribbon.pts.shift();
              }
            });

            kit.addShockRing({
              x: spawnPt.x, y: spawnPt.y, r0: 6, r1: 28 * ampScale, sy: 0.82,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 2.8, dur: 180, layer: 'front'
            });
          }
        },
        {
          at: 165 + travelMs,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 7.2 + amp * 2.0, 210);
            kit.safeCall(o.onHitStop, 58 + amp * 14);

            // 贯背穿透菱晶射线
            kit.addCustomDrawable('front', {
              age: 0, dur: 360,
              draw(ctx, p) {
                const ext = easeOutCubic(clamp(this.age / 90, 0, 1));
                const fade = p > 0.35 ? clamp((1 - p) / 0.65, 0, 1) : 1;
                if (fade <= 0.02) return;
                const ex = lerp(to.x, exitPt.x, ext);
                const ey = lerp(to.y, exitPt.y, ext);
                ctx.globalAlpha = fade;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#38BDF8';
                ctx.lineWidth = 10 * (1 - p * 0.6) * ampScale;
                ctx.beginPath();
                ctx.moveTo(spawnPt.x, spawnPt.y);
                ctx.lineTo(ex, ey);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 3.8 * (1 - p * 0.6) * ampScale;
                ctx.beginPath();
                ctx.moveTo(spawnPt.x, spawnPt.y);
                ctx.lineTo(ex, ey);
                ctx.stroke();
              }
            });

            kit.spawnPfx('ice_shatter', { palette: icePal }, {
              x: to.x, y: targetGroundY - 2,
              scale: 1.24 * ampScale,
              preWarmSec: 0.70, timeScale: 1.55, durMs: 680,
              layer: 'main'
            });
            kit.spawnPfx('crit_hit', {
              palette: amp >= 2 ? PALETTES.gold : PALETTES.iceGold,
              height: 22, aim: 0.32 * dir
            }, {
              x: to.x, y: to.y + 28,
              scale: 1.50 * ampScale, durMs: 480, layer: 'front'
            });

            kit.addLightning(spawnPt.x, spawnPt.y, exitPt.x, exitPt.y, {
              outerColor: '#1658EB', midColor: '#67E8F9', width: 2.2, dur: 240, branches: 2
            });
            kit.addFlash(to.x, to.y, 44 * ampScale, '#38BDF8', 150, 0.42);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 10, r1: 50 * ampScale, points: 8,
              outerColor: amp >= 2 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 320
            });
            kit.addShockRing({
              x: to.x, y: to.y, r0: 10, r1: 62 * ampScale, sy: 0.85,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3.2, dur: 340, layer: 'front'
            });

            kit.spawnBurstParticles(to.x, to.y, 26 + amp * 6, 'shard', {
              angleBase: ang, spread: 1.1, spdMin: 110, spdMax: 300, upBias: 30,
              sizeMin: 2.8, sizeMax: 5.8,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'], color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.4, lifeMin: 360, lifeMax: 660
            });
            kit.spawnBurstParticles(to.x, to.y, 16, 'spark', {
              angleBase: ang, spread: 1.3, spdMin: 150, spdMax: 340,
              sizeMin: 2.4, sizeMax: 4.4,
              colors: ['#FFFFFF', '#67E8F9', '#FDE68A'],
              gravity: 130, lifeMin: 240, lifeMax: 440
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       12. 远程·瞬发冰锥 / 瞬发断咏冰锥 (remote_snap_spike)
       敌足下瞬闪冰锁 → 极锐高耸钻石主冰锥 0.13s 破土直刺 → 三重破盾环升腾
       ======================================================================== */
    remote_snap_spike(kit, o) {
      const { to, targetGroundY, amp, ampScale, icePal } = o;
      const { TAU, clamp, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: to.x, y: targetGroundY + 3, radius: 36 * ampScale, sy: 0.30,
              palette: icePal, goldTriple: amp >= 3,
              dur: 460, fadeIn: 60, fadeOut: 140
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 3, r0: 46 * ampScale, r1: 8, sy: 0.30,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3.0, dur: 130, layer: 'front'
            });
            kit.addStarFlare({
              x: to.x, y: targetGroundY + 2, r0: 4, r1: 24 * ampScale, points: 4,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 150
            });
          }
        },
        {
          at: 130,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 8.2 + amp * 2.2, 230);
            kit.safeCall(o.onHitStop, 62 + amp * 14);

            // 极锐高挑主冰锥 + 两侧对称副刺
            kit.addHeroThorns({
              x: to.x, y: targetGroundY + 4,
              palette: icePal,
              goldAccent: amp >= 2,
              dur: 860,
              spikes: [
                { dx: -24, h: 48 * ampScale, w: 14, lean: -14, delay: 18, primary: false },
                { dx: 24,  h: 50 * ampScale, w: 14, lean: 14,  delay: 22, primary: false },
                { dx: -10, h: 76 * ampScale, w: 17, lean: -7,  delay: 6,  primary: true },
                { dx: 11,  h: 72 * ampScale, w: 16, lean: 8,   delay: 10, primary: true },
                { dx: 0,   h: 116 * ampScale, w: 23, lean: 0,  delay: 0,  primary: true }
              ]
            });

            kit.spawnPfx('ice_spikes', { palette: icePal, reach: 54, height: 68 }, {
              x: to.x - 28, y: targetGroundY + 4,
              scale: 1.48 * ampScale,
              preWarmSec: 0.08, timeScale: 1.65, durMs: 760,
              layer: 'main',
              glowColor: 'rgba(56,189,248,0.48)', glowRadius: 52 * ampScale, glowAlpha: 0.44
            });

            kit.spawnPfx('crit_hit', {
              palette: amp >= 2 ? PALETTES.gold : PALETTES.ice,
              height: 26, aim: -0.42
            }, {
              x: to.x, y: to.y + 22,
              scale: 1.56 * ampScale, durMs: 520, layer: 'front'
            });

            // 三重沿冰锥上升扩散的破盾光环
            kit.addCustomDrawable('front', {
              age: 0, dur: 460,
              draw(ctx, p) {
                for (let k = 0; k < 3; k++) {
                  const lp = clamp((p - k * 0.14) / 0.65, 0, 1);
                  if (lp <= 0 || lp >= 1) continue;
                  const y = targetGroundY - 12 - easeOutCubic(lp) * (92 - k * 14) * ampScale;
                  const rx = (18 + easeOutCubic(lp) * (38 + k * 8)) * ampScale;
                  const a = (1 - lp) * 0.9;
                  ctx.globalAlpha = a;
                  ctx.strokeStyle = k === 0 && amp >= 2 ? '#FDE68A' : '#67E8F9';
                  ctx.lineWidth = 3.2 * (1 - lp * 0.5);
                  ctx.beginPath();
                  ctx.ellipse(to.x, y, rx, rx * 0.28, 0, 0, TAU);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.4 * (1 - lp * 0.5);
                  ctx.beginPath();
                  ctx.ellipse(to.x, y, rx * 0.92, rx * 0.26, 0, 0, TAU);
                  ctx.stroke();
                }
              }
            });

            kit.addFlash(to.x, to.y - 6, 48 * ampScale, '#38BDF8', 155, 0.44);
            kit.addStarFlare({
              x: to.x, y: targetGroundY - 110 * ampScale, r0: 8, r1: 42 * ampScale, points: 8,
              outerColor: amp >= 2 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 360
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 12, r1: 88 * ampScale, sy: 0.28,
              color: '#0EA5E9', coreColor: '#FFFFFF', lineW: 3.8, dur: 440
            });

            kit.spawnBurstParticles(to.x, targetGroundY - 14, 28 + amp * 8, 'shard', {
              angleBase: -Math.PI * 0.5, spread: 1.1,
              spdMin: 120, spdMax: 320, upBias: 90,
              sizeMin: 3.0, sizeMax: 6.4,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'], color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.42, lifeMin: 400, lifeMax: 720
            });
            kit.spawnBurstParticles(to.x, to.y, 18, 'spark', {
              spdMin: 130, spdMax: 310, sizeMin: 2.4, sizeMax: 4.2,
              colors: ['#FFFFFF', '#67E8F9', '#FDE68A'],
              gravity: 130, lifeMin: 260, lifeMax: 480
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       13. 王宫冰时凝滞 / 冰晶宫殿 (palace_time_stop)
       澄澈雪瓷蓝与香槟金冰晶星钟法阵全场展开 → 时针凝滞锁定 → 失重雪星满屏
       ======================================================================== */
    palace_time_stop(kit, o) {
      const { groundY, amp, ampScale } = o;
      const { TAU, clamp, easeOutBack, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const targets = resolveTargetList(o);
      const cx = kit.LOGICAL_W * 0.5;
      const cy = kit.LOGICAL_H * 0.50;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('time_stop', { palette: PALETTES.ice }, {
              x: cx, y: groundY - 18,
              scale: 1.82 * ampScale,
              preWarmSec: 0.06, timeScale: 1.02, durMs: 1380,
              fadeInMs: 60, fadeOutMs: 280,
              layer: 'main',
              glowColor: 'rgba(125,211,252,0.40)', glowRadius: 84 * ampScale, glowAlpha: 0.34
            });
            kit.addShockRing({
              x: cx, y: cy, r0: 14, r1: 210 * ampScale, sy: 0.62,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 4.0, dur: 540, layer: 'front'
            });
          }
        },
        {
          at: 80,
          fn() {
            kit.addMagicCircle({
              x: cx, y: groundY + 4, radius: 104 * ampScale, sy: 0.28,
              rimColor: '#0EA5E9', starColor: '#FDE68A', runeColor: '#FFFFFF',
              innerGlow: 'rgba(224,247,255,0.62)', outerGlow: 'rgba(56,189,248,0.28)',
              goldTriple: true, lineW: 2.5,
              dur: 1420, fadeIn: 160, fadeOut: 280, layer: 'back'
            });

            // 冰晶宫殿宏伟星钟穹顶（纯洁雪瓷蓝×香槟金，清透可读）
            kit.addCustomDrawable('back', {
              age: 0, dur: 1440,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(this.age / 240, 0, 1));
                const exit = this.age > 1140 ? clamp((1440 - this.age) / 300, 0, 1) : 1;
                if (exit <= 0.02) return;

                const lockPulse = this.age >= 280 && this.age < 580
                  ? Math.sin(((this.age - 280) / 300) * Math.PI)
                  : 0;
                const r = 114 * ampScale * (0.45 + 0.55 * enter);

                // 轻薄雪瓷冰穹边缘辉光（保持通透明亮）
                const bg = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, 340);
                bg.addColorStop(0, 'rgba(224,247,255,0.22)');
                bg.addColorStop(0.52, 'rgba(56,189,248,0.12)');
                bg.addColorStop(1, 'rgba(22,88,235,0.20)');
                ctx.globalAlpha = exit;
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, kit.LOGICAL_W, kit.LOGICAL_H);

                ctx.save();
                ctx.translate(cx, cy);

                // 外双环：冰蓝 + 香槟金星轨
                ctx.strokeStyle = 'rgba(56,189,248,0.88)';
                ctx.lineWidth = 3.0;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = lockPulse > 0.1 ? '#FFFFFF' : '#FDE68A';
                ctx.lineWidth = 2.0 + lockPulse * 1.6;
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.12, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255,255,255,0.78)';
                ctx.lineWidth = 1.4;
                ctx.setLineDash([7, 7]);
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.86, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);

                // 宫殿六角几何晶窗骨架
                ctx.strokeStyle = 'rgba(186,230,253,0.72)';
                ctx.lineWidth = 1.6;
                drawHexPoly(ctx, 0, 0, r * 0.96, r * 0.96, Math.PI / 6);
                ctx.stroke();
                drawHexPoly(ctx, 0, 0, r * 0.64, r * 0.64, 0);
                ctx.stroke();

                // 12 刻度冰钻星点
                for (let i = 0; i < 12; i++) {
                  const a = (i / 12) * TAU - Math.PI * 0.5;
                  const major = i % 3 === 0;
                  const x0 = Math.cos(a) * r * (major ? 0.78 : 0.88);
                  const y0 = Math.sin(a) * r * (major ? 0.78 : 0.88);
                  const x1 = Math.cos(a) * r * 0.99;
                  const y1 = Math.sin(a) * r * 0.99;
                  ctx.strokeStyle = major ? '#FDE68A' : '#FFFFFF';
                  ctx.lineWidth = major ? 2.6 : 1.5;
                  ctx.beginPath();
                  ctx.moveTo(x0, y0);
                  ctx.lineTo(x1, y1);
                  ctx.stroke();
                }

                // 旋转后在凝滞瞬间骤停的双指针
                const spinPhase = clamp(this.age / 320, 0, 1);
                const easedSpin = 1 - Math.pow(1 - spinPhase, 3);
                const minAngle = -Math.PI * 0.5 + (1 - easedSpin) * -3.4;
                const hrAngle = -Math.PI * 0.5 + Math.PI / 6 + (1 - easedSpin) * -0.9;

                const drawHand = (angle, len, w, col) => {
                  ctx.save();
                  ctx.rotate(angle);
                  ctx.fillStyle = col;
                  ctx.beginPath();
                  ctx.moveTo(len, 0);
                  ctx.lineTo(len * 0.22, -w);
                  ctx.lineTo(-len * 0.16, 0);
                  ctx.lineTo(len * 0.22, w);
                  ctx.closePath();
                  ctx.fill();
                  ctx.restore();
                };

                drawHand(hrAngle, r * 0.54, 4.2, '#FDE68A');
                drawHand(minAngle, r * 0.80, 3.0, '#FFFFFF');

                // 中心冰钻轴芯
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(0, 0, 5.5, 0, TAU);
                ctx.fill();
                ctx.restore();
              }
            });
          }
        },
        {
          at: 360,
          fn() {
            kit.safeCall(o.onShake, 6.8 + amp * 2.0, 260);
            kit.safeCall(o.onHitStop, 85 + amp * 15);

            for (let idx = 0; idx < targets.length; idx++) {
              const tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
              if (amp >= 2) {
                kit.addMagicCircle({
                  x: tg.x, y: tg.groundY + 3, radius: 34 * ampScale, sy: 0.30,
                  palette: 'iceGold', dur: 820, fadeIn: 90, fadeOut: 220
                });
              }
            }

            kit.spawnPfx('snowflake_burst', { palette: PALETTES.iceGold, count: 12 }, {
              x: cx, y: cy + 56,
              scale: 2.05 * ampScale,
              preWarmSec: 0.14, timeScale: 0.94, durMs: 1120,
              layer: 'front'
            });

            kit.addFlash(cx, cy, 86 * ampScale, '#BAE6FD', 200, 0.36);
            kit.addStarFlare({
              x: cx, y: cy, r0: 14, r1: 86 * ampScale, inner: 0.16, points: 12,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 540
            });
            kit.addStarFlare({
              x: cx, y: cy, r0: 10, r1: 68 * ampScale, inner: 0.22, points: 6, rot: 0.26,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 500
            });
            kit.addShockRing({
              x: cx, y: cy, r0: 22, r1: 245 * ampScale, sy: 0.56,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.2, dur: 620, layer: 'front'
            });
            kit.addShockRing({
              x: cx, y: cy, r0: 16, r1: 210 * ampScale, sy: 0.56,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.2, dur: 560, layer: 'front'
            });

            // 满屏失重慢悬雪花与香槟金星尘
            const rng = kit.makeRng(kit.nextSeed());
            for (let i = 0; i < 52; i++) {
              kit.addParticle({
                kind: i % 3 === 0 ? 'star' : 'snow',
                x: 40 + rng() * (kit.LOGICAL_W - 80),
                y: 24 + rng() * (kit.LOGICAL_H - 76),
                vx: (rng() - 0.5) * 26,
                vy: -8 + rng() * 20,
                gravity: 6,
                drag: 0.8,
                size: 3.2 + rng() * 4.8,
                rot: rng() * TAU,
                vrot: (rng() - 0.5) * 2.4,
                color: i % 3 === 0 ? '#FDE68A' : '#FFFFFF',
                color2: '#38BDF8',
                life: 720 + rng() * 480
              });
            }
          }
        }
      ]);
    },

    /* ========================================================================
       14. 洞察·罗文棱镜 / 双镜合拢夹杖 (insight_rowan_prism)
       冰时洞察预兆 → 左右两面立面冰棱镜凌空疾速合拢夹锁蚀月紫光 → 棱光爆裂
       ======================================================================== */
    insight_rowan_prism(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const { clamp, lerp, easeOutCubic, easeInQuad } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('time_stop', { palette: PALETTES.ice }, {
              x: to.x, y: targetGroundY - 12,
              scale: 1.38 * ampScale, timeScale: 1.55, durMs: 680,
              layer: 'back'
            });
            kit.addStarFlare({
              x: from.x + 12 * dir, y: from.y - 12, r0: 4, r1: 28 * ampScale, points: 4,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 240
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, false);
          }
        },
        {
          at: 130,
          fn() {
            // 被双镜锁定夹持的明亮紫银蚀月光轮
            kit.spawnPfx('eclipse', { palette: BRIGHT_ECLIPSE_PAL }, {
              x: to.x, y: to.y + 6,
              scale: 1.16 * ampScale, alpha: 0.84, lightGain: 1.36,
              timeScale: 1.45, durMs: 620, layer: 'main',
              glowColor: 'rgba(196,181,253,0.46)', glowRadius: 54 * ampScale, glowAlpha: 0.40
            });

            // 左右双面晶透冰棱镜疾速向中心夹拢咬合
            kit.addCustomDrawable('front', {
              age: 0, dur: 820,
              draw(ctx, p) {
                const closeP = easeInQuad(clamp(this.age / 290, 0, 1));
                const holdFade = this.age > 560 ? clamp((820 - this.age) / 260, 0, 1) : 1;
                if (holdFade <= 0.02) return;

                const offset = lerp(98, 12, closeP) * ampScale;
                const h = 88 * ampScale;
                const w = 18 * ampScale;
                const clamped = this.age >= 285;

                ctx.globalAlpha = holdFade;

                for (let side = -1; side <= 1; side += 2) {
                  const mx = to.x + side * offset;
                  ctx.save();
                  ctx.translate(mx, to.y);
                  ctx.transform(1, 0, side * -0.14, 1, 0, 0);

                  const mg = ctx.createLinearGradient(-w, -h * 0.5, w, h * 0.5);
                  mg.addColorStop(0, 'rgba(255,255,255,0.95)');
                  mg.addColorStop(0.38, 'rgba(186,230,253,0.82)');
                  mg.addColorStop(0.75, 'rgba(56,189,248,0.68)');
                  mg.addColorStop(1, 'rgba(167,139,250,0.62)');
                  ctx.fillStyle = mg;
                  drawDiamond(ctx, 0, 0, w, h * 0.56);
                  ctx.fill();

                  ctx.strokeStyle = clamped ? '#FFFFFF' : '#67E8F9';
                  ctx.lineWidth = clamped ? 2.6 : 1.8;
                  drawDiamond(ctx, 0, 0, w, h * 0.56);
                  ctx.stroke();

                  // 镜面竖脊高光
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.moveTo(0, -h * 0.48);
                  ctx.lineTo(0, h * 0.48);
                  ctx.stroke();
                  ctx.restore();
                }

                // 合拢刹那爆发的四向棱镜折射彩虹光束
                if (clamped) {
                  const bp = clamp((this.age - 285) / 360, 0, 1);
                  const rayL = (44 + easeOutCubic(bp) * 76) * ampScale;
                  const rayAlpha = (1 - bp) * 0.92;
                  if (rayAlpha > 0.02) {
                    const angles = [-2.45, -0.68, 0.68, 2.45];
                    const cols = ['#67E8F9', '#DDD6FE', '#FDE68A', '#38BDF8'];
                    ctx.globalAlpha = rayAlpha;
                    ctx.lineCap = 'round';
                    for (let i = 0; i < 4; i++) {
                      const a = angles[i];
                      ctx.strokeStyle = cols[i];
                      ctx.lineWidth = 5.0 * (1 - bp * 0.6);
                      ctx.beginPath();
                      ctx.moveTo(to.x, to.y);
                      ctx.lineTo(to.x + Math.cos(a) * rayL, to.y + Math.sin(a) * rayL);
                      ctx.stroke();

                      ctx.strokeStyle = '#FFFFFF';
                      ctx.lineWidth = 2.0 * (1 - bp * 0.6);
                      ctx.beginPath();
                      ctx.moveTo(to.x, to.y);
                      ctx.lineTo(to.x + Math.cos(a) * rayL * 0.9, to.y + Math.sin(a) * rayL * 0.9);
                      ctx.stroke();
                    }
                  }
                }
              }
            });
          }
        },
        {
          at: 420,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 9.4 + amp * 2.2, 280);
            kit.safeCall(o.onHitStop, 80 + amp * 14);

            kit.spawnPfx('parry', { palette: PALETTES.iceGold, height: 32 }, {
              x: to.x, y: to.y + 38, scale: 1.72 * ampScale, durMs: 560, layer: 'front'
            });
            kit.spawnPfx('ice_shatter', { palette: PALETTES.ice }, {
              x: to.x, y: targetGroundY - 2,
              scale: 1.34 * ampScale, preWarmSec: 0.70, timeScale: 1.50, durMs: 740,
              layer: 'main',
              glowColor: 'rgba(103,232,249,0.44)', glowRadius: 54 * ampScale, glowAlpha: 0.40
            });

            kit.addFlash(to.x, to.y, 58 * ampScale, '#DDD6FE', 175, 0.42);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 12, r1: 68 * ampScale, inner: 0.16, points: 8,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 3, r0: 14, r1: 118 * ampScale, sy: 0.28,
              color: '#8B5CF6', coreColor: '#F5F3FF', lineW: 4.0, dur: 480
            });
            kit.addShockRing({
              x: to.x, y: to.y, r0: 12, r1: 82 * ampScale, sy: 0.92,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.4, dur: 420, layer: 'front'
            });

            kit.spawnBurstParticles(to.x, to.y, 30 + amp * 8, 'shard', {
              spdMin: 90, spdMax: 270, upBias: 80, sizeMin: 3.0, sizeMax: 6.4,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#DDD6FE'], color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.42, lifeMin: 420, lifeMax: 760
            });
            kit.spawnBurstParticles(to.x, to.y, 18, 'ringlet', {
              spdMin: 55, spdMax: 185, upBias: 40, gravity: -10,
              sizeMin: 4.2, sizeMax: 7.4,
              colors: ['#F5F3FF', '#DDD6FE', '#A78BFA'], color2: '#6D28D9',
              lifeMin: 440, lifeMax: 760
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       15. 洞察·破绽狙击 / 凝霜贯隙刺 (insight_flaw_strike)
       绯晶冰蓝几何棱镜准星疾速锁核 → 冰金极光束光速贯通破绽暴击
       ======================================================================== */
    insight_flaw_strike(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const { TAU, clamp, lerp, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);
      const ang = Math.atan2(to.y - from.y, to.x - from.x);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addStarFlare({
              x: from.x + 12 * dir, y: from.y - 4, r0: 6, r1: 32 * ampScale, points: 4,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 320
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, 'iceGold');

            // 几何棱镜破绽瞄准准星（320ms 锁死）
            kit.addCustomDrawable('front', {
              age: 0, dur: 520,
              draw(ctx, p) {
                const lockP = easeOutCubic(clamp(this.age / 310, 0, 1));
                const fade = this.age > 390 ? clamp((520 - this.age) / 130, 0, 1) : 1;
                if (fade <= 0.02) return;

                const r = lerp(54, 24, lockP) * ampScale;
                const rot = lerp(Math.PI * 0.45, 0, lockP);
                const locked = this.age >= 305;

                ctx.translate(to.x, to.y);
                ctx.globalAlpha = fade;

                // 外圈冰蓝细刻度环
                ctx.save();
                ctx.rotate(rot);
                ctx.strokeStyle = locked ? '#FDE68A' : '#38BDF8';
                ctx.lineWidth = locked ? 2.6 : 1.8;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TAU);
                ctx.stroke();

                // 四象限棱角锁定括弧
                for (let i = 0; i < 4; i++) {
                  ctx.save();
                  ctx.rotate(i * Math.PI * 0.5 + Math.PI * 0.25);
                  ctx.strokeStyle = locked ? '#FFFFFF' : '#67E8F9';
                  ctx.lineWidth = 2.6;
                  ctx.beginPath();
                  ctx.moveTo(r + 10, 0);
                  ctx.lineTo(r - 4, 0);
                  ctx.stroke();
                  ctx.restore();
                }
                ctx.restore();

                // 中心绯红宝石高光破绽菱核
                const coreR = (6.5 + (locked ? 3.0 : 0)) * ampScale;
                ctx.fillStyle = '#FB7185';
                drawDiamond(ctx, 0, 0, coreR, coreR);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                drawDiamond(ctx, 0, 0, coreR * 0.52, coreR * 0.52);
                ctx.fill();
              }
            });
          }
        },
        {
          at: 320,
          fn() {
            kit.addWaterStream({
              x0: from.x + 12 * dir, y0: from.y - 2,
              x1: to.x + 56 * dir, y1: to.y + Math.sin(ang) * 56,
              width: 11 * ampScale,
              extendMs: 80,
              palette: 'iceGold',
              dur: 380
            });

            kit.spawnPfx('ice_lance', { palette: PALETTES.iceGold, length: 58 }, {
              x: from.x + 12 * dir, y: from.y - 2,
              angle: ang,
              scale: 1.54 * ampScale,
              timeScale: 1.8,
              durMs: 165,
              fadeInMs: 10, fadeOutMs: 45,
              layer: 'front',
              onUpdate(slot, dtSec, age) {
                const p = easeOutCubic(clamp(age / 85, 0, 1));
                slot.x = lerp(from.x + 12 * dir, to.x, p);
                slot.y = lerp(from.y - 2, to.y, p);
              }
            });
          }
        },
        {
          at: 405,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 9.8 + amp * 2.4, 280);
            kit.safeCall(o.onHitStop, 76 + amp * 15);

            // 破绽贯通双道穿刺十字尖芒
            kit.addCustomDrawable('front', {
              age: 0, dur: 460,
              draw(ctx, p) {
                const ext = easeOutCubic(clamp(this.age / 95, 0, 1));
                const fade = p > 0.35 ? clamp((1 - p) / 0.65, 0, 1) : 1;
                if (fade <= 0.02) return;

                ctx.translate(to.x, to.y);
                ctx.globalAlpha = fade;

                const mainL = 128 * ampScale * ext;
                const crossL = 68 * ampScale * ext;
                const w = 9.5 * (1 - p * 0.72) * ampScale;

                ctx.save();
                ctx.rotate(ang);
                ctx.fillStyle = '#38BDF8';
                drawDiamond(ctx, 0, 0, mainL * 1.05, w * 1.45);
                ctx.fill();
                ctx.fillStyle = '#FDE68A';
                drawDiamond(ctx, 0, 0, mainL, w);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                drawDiamond(ctx, 0, 0, mainL * 0.92, Math.max(1.4, w * 0.45));
                ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.rotate(ang + Math.PI * 0.5);
                ctx.fillStyle = '#67E8F9';
                drawDiamond(ctx, 0, 0, crossL, w * 0.78);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                drawDiamond(ctx, 0, 0, crossL * 0.85, Math.max(1.2, w * 0.35));
                ctx.fill();
                ctx.restore();
              }
            });

            kit.spawnPfx('crit_hit', { palette: PALETTES.gold, height: 28, aim: 0.05 }, {
              x: to.x, y: to.y + 34, scale: 1.78 * ampScale, durMs: 580, layer: 'front'
            });
            kit.spawnPfx('ice_shatter', { palette: PALETTES.iceGold }, {
              x: to.x, y: targetGroundY - 2,
              scale: 1.26 * ampScale, preWarmSec: 0.70, timeScale: 1.55, durMs: 680,
              layer: 'main'
            });

            kit.addLightning(to.x - 42, to.y - 34, to.x + 48, to.y + 30, {
              outerColor: '#D97706', midColor: '#FDE68A', width: 2.4, dur: 270, branches: 2
            });
            kit.addLightning(to.x - 46, to.y + 28, to.x + 44, to.y - 32, {
              outerColor: '#1658EB', midColor: '#67E8F9', width: 2.2, dur: 250, branches: 2
            });

            kit.addFlash(to.x, to.y, 58 * ampScale, '#FDE68A', 160, 0.42);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 12, r1: 68 * ampScale, inner: 0.14, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 400
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 3, r0: 14, r1: 118 * ampScale, sy: 0.28,
              color: '#F59E0B', coreColor: '#FFFFFF', lineW: 4.0, dur: 480
            });

            kit.spawnBurstParticles(to.x, to.y, 32 + amp * 8, 'spark', {
              spdMin: 160, spdMax: 380, sizeMin: 2.6, sizeMax: 5.0,
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#67E8F9', '#FB7185'],
              gravity: 110, lifeMin: 280, lifeMax: 560
            });
            kit.spawnBurstParticles(to.x, to.y, 22, 'shard', {
              spdMin: 85, spdMax: 245, sizeMin: 2.8, sizeMax: 5.8,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#FDE68A'], color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.4, lifeMin: 380, lifeMax: 680
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       16. 晦轮法杖共鸣切换 (eclipse_wand_toggle)
       严格明亮通透：晶透紫水晶 + 纯银星光新月双环，零黑洞零暗泥
       ======================================================================== */
    eclipse_wand_toggle(kit, o) {
      const { groundY, amp, ampScale } = o;
      const { TAU, clamp, easeOutBack } = kit.math;
      const PALETTES = kit.PALETTES;
      const { cx, cy } = resolveSelfCenter(o);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: cx, y: groundY + 4, radius: 54 * ampScale, sy: 0.30,
              palette: 'eclipse', goldTriple: amp >= 3,
              dur: 1120, fadeIn: 120, fadeOut: 260
            });
            kit.triggerAmpCastAura(cx, groundY, amp, 'eclipse');
          }
        },
        {
          at: 130,
          fn() {
            kit.spawnPfx('eclipse', { palette: BRIGHT_ECLIPSE_PAL }, {
              x: cx, y: cy + 8,
              scale: 1.22 * ampScale, alpha: 0.76, lightGain: 1.42,
              timeScale: 1.24, durMs: 960, fadeInMs: 80, fadeOutMs: 240,
              layer: 'back',
              glowColor: 'rgba(196,181,253,0.52)', glowRadius: 64 * ampScale, glowAlpha: 0.44
            });

            // 明亮通透紫银双新月星轨环
            kit.addCustomDrawable('front', {
              age: 0, dur: 980,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(this.age / 220, 0, 1));
                const exit = this.age > 720 ? clamp((980 - this.age) / 260, 0, 1) : 1;
                if (exit <= 0.02) return;

                const r = 54 * ampScale * (0.45 + 0.55 * enter);
                const rot = this.age * 0.0028;

                ctx.translate(cx, cy - 4);
                ctx.globalAlpha = exit;

                // 轻薄紫银透光环晕
                const hg = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 1.28);
                hg.addColorStop(0, 'rgba(245,243,255,0.06)');
                hg.addColorStop(0.68, 'rgba(196,181,253,0.22)');
                hg.addColorStop(1, 'rgba(124,58,237,0)');
                ctx.fillStyle = hg;
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.28, 0, TAU);
                ctx.fill();

                // 双层交叉银紫星轨环
                for (let k = 0; k < 2; k++) {
                  const tilt = k === 0 ? -0.34 : 0.34;
                  const dirR = k === 0 ? 1 : -1;
                  ctx.save();
                  ctx.rotate(tilt);

                  ctx.strokeStyle = k === 0 ? '#A78BFA' : '#DDD6FE';
                  ctx.lineWidth = 2.6;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, r * 1.18, r * 0.36, 0, 0, TAU);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.2;
                  ctx.setLineDash([10, 8]);
                  ctx.lineDashOffset = -this.age * 0.1 * dirR;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, r * 1.14, r * 0.34, 0, 0, TAU);
                  ctx.stroke();
                  ctx.setLineDash([]);

                  // 轨道公转银白星点
                  for (let s = 0; s < 3; s++) {
                    const sa = rot * 2.2 * dirR + (s / 3) * TAU;
                    const sx = Math.cos(sa) * r * 1.18;
                    const sy = Math.sin(sa) * r * 0.36;
                    kit.drawStarFlare(ctx, sx, sy, 8.5, 0.24, 4, sa, '#DDD6FE', '#FFFFFF', exit);
                  }
                  ctx.restore();
                }

                // 顶部晶透高光紫银新月徽记
                ctx.save();
                ctx.translate(0, -r * 0.92);
                ctx.rotate(Math.sin(this.age * 0.004) * 0.12);
                ctx.fillStyle = '#C4B5FD';
                ctx.beginPath();
                ctx.arc(0, 0, 14 * ampScale, 0.35, Math.PI * 2 - 0.35, false);
                ctx.arc(5 * ampScale, -2 * ampScale, 11 * ampScale, Math.PI * 2 - 0.55, 0.55, true);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
              }
            });
          }
        },
        {
          at: 420,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 4.2 + amp * 1.2, 160);

            kit.spawnPfx('time_stop', { palette: PALETTES.eclipse }, {
              x: cx, y: groundY + 2,
              scale: 1.20 * ampScale, alpha: 0.76, lightGain: 1.22,
              timeScale: 1.55, durMs: 680, layer: 'back'
            });

            kit.addFlash(cx, cy - 4, 46 * ampScale, '#DDD6FE', 165, 0.38);
            kit.addStarFlare({
              x: cx, y: cy - 4, r0: 10, r1: 52 * ampScale, inner: 0.18, points: 8,
              outerColor: '#C4B5FD', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: cx, y: cy - 4, r0: 42 * ampScale, r1: 98 * ampScale, sy: 0.94,
              color: '#A78BFA', coreColor: '#FFFFFF', lineW: 3.4, dur: 440, layer: 'front'
            });
            kit.addShockRing({
              x: cx, y: groundY + 4, r0: 16, r1: 94 * ampScale, sy: 0.30,
              color: '#8B5CF6', coreColor: '#F5F3FF', lineW: 3.2, dur: 460
            });

            kit.spawnBurstParticles(cx, cy, 22 + amp * 6, 'ringlet', {
              spdMin: 40, spdMax: 135, upBias: 65, gravity: -16,
              sizeMin: 4.0, sizeMax: 7.4,
              colors: ['#FFFFFF', '#F5F3FF', '#DDD6FE', '#C4B5FD'], color2: '#7C3AED',
              lifeMin: 460, lifeMax: 780
            });
            kit.spawnBurstParticles(cx, cy - 8, 20, 'star', {
              spdMin: 55, spdMax: 165, upBias: 55, gravity: -10,
              sizeMin: 3.0, sizeMax: 6.2,
              colors: ['#FFFFFF', '#F5F3FF', '#DDD6FE', '#FDE68A'],
              lifeMin: 420, lifeMax: 740
            });
          }
        }
      ]);
    },

    /* ========================================================================
       17. 晦轮真实魔伤施法 (eclipse_true_cast)
       明亮紫银星月棱束穿透五重银紫星轨环 → 晶透紫银蚀月星爆（零暗黑黑洞）
       ======================================================================== */
    eclipse_true_cast(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const { TAU, clamp, lerp, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const dir = getDir(o);

      const beamStart = { x: from.x + 14 * dir, y: from.y - 6 };
      const beamEnd = { x: to.x, y: to.y - 2 };
      const dx = beamEnd.x - beamStart.x;
      const dy = beamEnd.y - beamStart.y;
      const ang = Math.atan2(dy, dx);
      const extendMs = 145;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: from.x - 10 * dir, y: groundY + 4, radius: 50 * ampScale, sy: 0.30,
              palette: 'eclipse', goldTriple: amp >= 3, dur: 640
            });
            kit.addStarFlare({
              x: beamStart.x, y: beamStart.y, r0: 6, r1: 36 * ampScale, points: 8,
              outerColor: '#C4B5FD', coreColor: '#FFFFFF', dur: 240
            });
            kit.triggerAmpCastAura(from.x - 10 * dir, groundY, amp, 'eclipse');
            kit.spawnBurstParticles(beamStart.x, beamStart.y, 14, 'ringlet', {
              spdMin: 30, spdMax: 95, upBias: 20, gravity: -8,
              sizeMin: 3.4, sizeMax: 6.0,
              colors: ['#FFFFFF', '#F5F3FF', '#DDD6FE'], color2: '#7C3AED',
              lifeMin: 260, lifeMax: 440
            });
          }
        },
        {
          at: 165,
          fn() {
            // 晶透紫银星月棱束主体（基于水柱增亮层以 eclipse 紫银色板覆写）
            kit.addWaterStream({
              x0: beamStart.x, y0: beamStart.y,
              x1: beamEnd.x, y1: beamEnd.y,
              width: 15.5 * ampScale,
              extendMs,
              palette: 'eclipse',
              dur: 580
            });

            // 沿棱束轴向排布 5 道纯银紫晶穿束星环
            kit.addCustomDrawable('front', {
              age: 0, dur: 580,
              draw(ctx, p) {
                const grow = easeOutCubic(clamp(this.age / extendMs, 0, 1));
                const fade = this.age > 380 ? clamp((580 - this.age) / 200, 0, 1) : 1;
                if (fade <= 0.02) return;

                ctx.globalAlpha = fade;
                for (let k = 0; k < 5; k++) {
                  const u = (k + 0.5) / 5;
                  if (grow < u * 0.85) continue;
                  const rx = lerp(beamStart.x, beamEnd.x, u);
                  const ry = lerp(beamStart.y, beamEnd.y, u);
                  const localP = clamp((grow - u * 0.85) / 0.25, 0, 1);
                  const rad = (14 + (k % 2 === 0 ? 9 : 4) + localP * 8) * ampScale;

                  ctx.save();
                  ctx.translate(rx, ry);
                  ctx.rotate(ang);

                  ctx.strokeStyle = k % 2 === 0 ? '#C4B5FD' : '#A78BFA';
                  ctx.lineWidth = 2.6;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rad * 0.32, rad, 0, 0, TAU);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.3;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rad * 0.28, rad * 0.92, 0, -Math.PI * 0.6, Math.PI * 0.6);
                  ctx.stroke();

                  // 环顶星芒点
                  kit.drawStarFlare(ctx, 0, -rad, 7.5, 0.22, 4, this.age * 0.01 + k, '#DDD6FE', '#FFFFFF', fade);
                  ctx.restore();
                }
              }
            });

            const ribPts = [];
            for (let i = 0; i <= 14; i++) {
              const t = i / 14;
              ribPts.push({
                x: lerp(beamStart.x, beamEnd.x, t),
                y: lerp(beamStart.y, beamEnd.y, t) + Math.sin(t * Math.PI * 3) * 10
              });
            }
            kit.addRibbon({
              pts: ribPts,
              width: 7.5 * ampScale,
              palette: 'eclipse',
              alpha: 0.88,
              dur: 520,
              fadeOut: 220
            });
          }
        },
        {
          at: 165 + extendMs,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 9.2 + amp * 2.4, 290);
            kit.safeCall(o.onHitStop, 72 + amp * 15);

            kit.spawnPfx('eclipse', { palette: BRIGHT_ECLIPSE_PAL }, {
              x: to.x, y: to.y + 8,
              scale: 1.50 * ampScale, alpha: 0.84, lightGain: 1.40,
              preWarmSec: 0.12, timeScale: 1.32, durMs: 880,
              fadeInMs: 25, fadeOutMs: 240,
              layer: 'main',
              glowColor: 'rgba(221,214,254,0.54)', glowRadius: 70 * ampScale, glowAlpha: 0.46
            });

            kit.spawnPfx('crit_hit', { palette: PALETTES.eclipse, height: 26, aim: 0.08 * dir }, {
              x: to.x, y: to.y + 34, scale: 1.66 * ampScale, lightGain: 1.22, durMs: 560, layer: 'front'
            });

            // 3 道明亮紫银穿透星雷弧
            for (let b = 0; b < 3; b++) {
              const ba = (b / 3) * TAU + 0.35;
              const len = 58 * ampScale;
              kit.addLightning(
                to.x, to.y,
                to.x + Math.cos(ba) * len, to.y + Math.sin(ba) * len * 0.78,
                { outerColor: '#7C3AED', midColor: '#DDD6FE', coreColor: '#FFFFFF', width: 2.3, dur: 280, branches: 2 }
              );
            }

            kit.addFlash(to.x, to.y, 60 * ampScale, '#DDD6FE', 175, 0.44);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 12, r1: 68 * ampScale, inner: 0.16, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#C4B5FD', coreColor: '#FFFFFF', dur: 440
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 16, r1: 128 * ampScale, sy: 0.28,
              color: '#8B5CF6', coreColor: '#F5F3FF', lineW: 4.2, dur: 520
            });
            kit.addShockRing({
              x: to.x, y: to.y, r0: 14, r1: 88 * ampScale, sy: 0.90,
              color: '#C4B5FD', coreColor: '#FFFFFF', lineW: 3.4, dur: 440, layer: 'front'
            });

            kit.spawnBurstParticles(to.x, to.y, 26 + amp * 8, 'ringlet', {
              spdMin: 75, spdMax: 245, upBias: 45, gravity: -8,
              sizeMin: 4.2, sizeMax: 8.0,
              colors: ['#FFFFFF', '#F5F3FF', '#DDD6FE', '#C4B5FD'], color2: '#6D28D9',
              lifeMin: 460, lifeMax: 820
            });
            kit.spawnBurstParticles(to.x, to.y, 24, 'star', {
              spdMin: 80, spdMax: 265, upBias: 60, gravity: 75,
              sizeMin: 3.2, sizeMax: 6.8,
              colors: ['#FFFFFF', '#F5F3FF', '#C4B5FD', '#FDE68A'],
              lifeMin: 420, lifeMax: 760
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ========================================================================
       18. 北境圣杖共鸣 (saint_staff_resonance)
       香槟金与冰青复合圣阵 → 通透六棱圣光晶塔直冲云霄 → 圣冠雪星辉耀
       ======================================================================== */
    saint_staff_resonance(kit, o) {
      const { groundY, amp, ampScale } = o;
      const { TAU, clamp, easeOutBack, easeOutCubic } = kit.math;
      const PALETTES = kit.PALETTES;
      const { cx, cy } = resolveSelfCenter(o);

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: PALETTES.iceGold }, {
              x: cx, y: groundY + 4, scale: 1.54 * ampScale,
              preWarmSec: 0.85, timeScale: 1.80, durMs: 780, layer: 'back',
              glowColor: 'rgba(253,230,138,0.42)', glowRadius: 64 * ampScale, glowAlpha: 0.38
            });
            kit.addMagicCircle({
              x: cx, y: groundY + 4, radius: 64 * ampScale, sy: 0.30,
              rimColor: '#F59E0B', starColor: '#67E8F9', runeColor: '#FFFFFF',
              innerGlow: 'rgba(254,249,195,0.68)', outerGlow: 'rgba(56,189,248,0.30)',
              goldTriple: true, lineW: 2.5,
              dur: 1360, fadeIn: 140, fadeOut: 280
            });
            kit.triggerAmpCastAura(cx, groundY, Math.max(amp, 1), 'iceGold');
          }
        },
        {
          at: 160,
          fn() {
            // 三道高空香槟金圣光斜落汇入法阵
            const beamOffsets = [-46, 0, 46];
            for (let i = 0; i < 3; i++) {
              kit.addSkyBeam({
                x0: cx + beamOffsets[i] * 1.35, y0: -18,
                x1: cx + beamOffsets[i] * 0.55, y1: groundY + 2,
                width: (i === 1 ? 8.2 : 5.4) * ampScale,
                palette: i === 1 ? 'gold' : 'iceGold',
                gold: true,
                dur: 620
              });
            }

            // 香槟金×冰青通透六棱圣光晶塔（立柱 + 双转圣环 + 悬浮冰晶冠冕）
            kit.addCustomDrawable('main', {
              age: 0, dur: 1220,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(this.age / 240, 0, 1));
                const exit = this.age > 920 ? clamp((1220 - this.age) / 300, 0, 1) : 1;
                if (exit <= 0.02) return;

                const pillarW = 46 * ampScale * (0.4 + 0.6 * enter);
                const pillarH = 230 * ampScale * clamp(enter, 0, 1.05);
                const crestPulse = this.age >= 300 && this.age < 560
                  ? Math.sin(((this.age - 300) / 260) * Math.PI)
                  : 0;

                ctx.globalAlpha = exit;

                // 1) 通透六棱圣光晶塔垂直光柱（中央极透、双翼晶亮，清晰衬托主角）
                const pg = ctx.createLinearGradient(cx - pillarW, groundY, cx + pillarW, groundY);
                pg.addColorStop(0, 'rgba(56,189,248,0)');
                pg.addColorStop(0.22, 'rgba(103,232,249,0.24)');
                pg.addColorStop(0.50, `rgba(254,249,195,${0.26 + crestPulse * 0.14})`);
                pg.addColorStop(0.78, 'rgba(103,232,249,0.24)');
                pg.addColorStop(1, 'rgba(56,189,248,0)');
                ctx.fillStyle = pg;
                ctx.fillRect(cx - pillarW, groundY + 4 - pillarH, pillarW * 2, pillarH);

                // 棱塔垂直晶脊边线（香槟金 + 冰青纯白）
                const ridgeX = [-pillarW * 0.72, -pillarW * 0.34, pillarW * 0.34, pillarW * 0.72];
                for (let i = 0; i < ridgeX.length; i++) {
                  const rx = cx + ridgeX[i];
                  const rg = ctx.createLinearGradient(rx, groundY + 4, rx, groundY + 4 - pillarH);
                  rg.addColorStop(0, i === 1 || i === 2 ? 'rgba(253,230,138,0.88)' : 'rgba(103,232,249,0.78)');
                  rg.addColorStop(0.7, 'rgba(255,255,255,0.62)');
                  rg.addColorStop(1, 'rgba(255,255,255,0)');
                  ctx.strokeStyle = rg;
                  ctx.lineWidth = (i === 1 || i === 2) ? 2.2 : 1.5;
                  ctx.beginPath();
                  ctx.moveTo(rx, groundY + 4);
                  ctx.lineTo(rx, groundY + 4 - pillarH);
                  ctx.stroke();
                }

                // 2) 中段螺旋上升的香槟金与冰青圣环
                const rot = this.age * 0.003;
                for (let rIdx = 0; rIdx < 2; rIdx++) {
                  const ry = cy - 16 - rIdx * 34;
                  const rx = (54 - rIdx * 8) * ampScale * (0.5 + 0.5 * enter);
                  ctx.save();
                  ctx.translate(cx, ry);
                  ctx.strokeStyle = rIdx === 0 ? '#F59E0B' : '#38BDF8';
                  ctx.lineWidth = 2.6;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rx, rx * 0.28, 0, 0, TAU);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.2;
                  ctx.setLineDash([8, 6]);
                  ctx.lineDashOffset = (rIdx === 0 ? -1 : 1) * this.age * 0.09;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rx * 0.94, rx * 0.26, 0, 0, TAU);
                  ctx.stroke();
                  ctx.setLineDash([]);

                  for (let c = 0; c < 4; c++) {
                    const ca = rot * (rIdx === 0 ? 1.8 : -2.1) + (c / 4) * TAU;
                    const gx = Math.cos(ca) * rx;
                    const gy = Math.sin(ca) * rx * 0.28;
                    ctx.fillStyle = c % 2 === 0 ? '#FEF9C3' : '#67E8F9';
                    drawDiamond(ctx, gx, gy, 3.6, 5.2);
                    ctx.fill();
                  }
                  ctx.restore();
                }

                // 3) 塔顶悬浮北境冰金圣晶棱冠
                const crownY = cy - 86 * ampScale - Math.sin(this.age * 0.008) * 3.5;
                ctx.save();
                ctx.translate(cx, crownY);
                const crR = 14 * ampScale * (0.5 + 0.5 * enter);
                const cg = ctx.createLinearGradient(0, -crR * 1.4, 0, crR * 1.4);
                cg.addColorStop(0, '#FFFFFF');
                cg.addColorStop(0.35, '#FEF9C3');
                cg.addColorStop(0.70, '#67E8F9');
                cg.addColorStop(1, '#1658EB');
                ctx.fillStyle = cg;
                drawDiamond(ctx, 0, 0, crR * 0.78, crR * 1.45);
                ctx.fill();
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 1.8;
                drawDiamond(ctx, 0, 0, crR * 0.78, crR * 1.45);
                ctx.stroke();

                // 两侧伴随圣晶小棱翼
                for (let side = -1; side <= 1; side += 2) {
                  ctx.fillStyle = '#FDE68A';
                  drawDiamond(ctx, side * crR * 1.35, 3, crR * 0.36, crR * 0.72);
                  ctx.fill();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.1;
                  ctx.stroke();
                }

                kit.drawStarFlare(ctx, 0, 0, (16 + crestPulse * 14) * ampScale, 0.22, 8, rot, '#FDE68A', '#FFFFFF', exit);
                ctx.restore();
              }
            });
          }
        },
        {
          at: 470,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 5.5 + amp * 1.4, 200);

            kit.spawnPfx('snowflake_burst', { palette: PALETTES.iceGold, count: 9 }, {
              x: cx, y: cy - 12,
              scale: 1.48 * ampScale, alpha: 0.86, preWarmSec: 0.18, timeScale: 1.18, durMs: 860,
              layer: 'back'
            });
            kit.spawnPfx('divine_shield', { palette: PALETTES.gold, radius: 34 }, {
              x: cx, y: cy + 44,
              scale: 1.80 * ampScale, alpha: 0.52, lightGain: 1.0, durMs: 920,
              layer: 'back'
            });

            kit.addFlash(cx, cy - 26, 66 * ampScale, '#FDE68A', 180, 0.36);
            kit.addStarFlare({
              x: cx, y: cy - 84 * ampScale, r0: 10, r1: 58 * ampScale, inner: 0.16, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 480
            });
            kit.addShockRing({
              x: cx, y: groundY + 4, r0: 18, r1: 122 * ampScale, sy: 0.30,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.2, dur: 520
            });
            kit.addShockRing({
              x: cx, y: cy - 16, r0: 28 * ampScale, r1: 108 * ampScale, sy: 0.90,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3.4, dur: 480, layer: 'front'
            });

            kit.spawnBurstParticles(cx, cy, 26 + amp * 8, 'star', {
              spdMin: 55, spdMax: 185, upBias: 95, gravity: -24,
              sizeMin: 3.4, sizeMax: 7.2,
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#67E8F9', '#38BDF8'],
              lifeMin: 500, lifeMax: 880
            });
            kit.spawnBurstParticles(cx, cy - 22, 18, 'snow', {
              spdMin: 30, spdMax: 115, upBias: 60, gravity: 18,
              sizeMin: 3.2, sizeMax: 6.2,
              colors: ['#FFFFFF', '#FEF9C3', '#E0F7FF'], color2: '#38BDF8',
              lifeMin: 520, lifeMax: 880
            });
            kit.spawnBurstParticles(cx, cy + 6, 14, 'cross', {
              spdMin: 24, spdMax: 80, upBias: 110, gravity: -32,
              sizeMin: 3.6, sizeMax: 6.2,
              colors: ['#FEF9C3', '#FDE68A', '#BAE6FD'], color2: '#D97706',
              lifeMin: 480, lifeMax: 800
            });

            if (amp >= 3) {
              for (let i = 0; i < 4; i++) {
                const a = (i / 4) * TAU + 0.35;
                kit.addLightning(
                  cx + Math.cos(a) * 34, cy - 64,
                  cx + Math.cos(a + 0.5) * 84, cy + 12,
                  { outerColor: '#D97706', midColor: '#FDE68A', width: 2.3, dur: 300, branches: 2 }
                );
              }
            }
          }
        }
      ]);
    }
  };

  /* -------------------- 玩家技能 & 武器法杖全量别名路由表 -------------------- */
  const ALIASES = {
    // 1. ice_crystal（冰晶术 · 缩小 33.3% 覆盖版）
    hand_ice_crystal:        'ice_crystal',
    ice_sphere:              'ice_crystal',
    ice_shard:               'ice_crystal',
    crystal_cast:            'ice_crystal',

    // 2. basic_attack（防身平斩 / 法杖轻挥击）
    attack:                  'basic_attack',
    sword_basic_slash:       'basic_attack',
    staff_tap:               'basic_attack',
    normal_attack:           'basic_attack',

    // 3. water_orb（水球术）
    water_ball:              'water_orb',
    aqua_orb:                'water_orb',
    water_sphere:            'water_orb',
    hand_water_orb:          'water_orb',

    // 4. frost_step_floor（蔓地薄冰 / 寒霜滑步）
    hand_frost_floor:        'frost_step_floor',
    frost_floor:             'frost_step_floor',
    frost_step:              'frost_step_floor',
    thin_ice_floor:          'frost_step_floor',

    // 5. frost_breath（寒霜吐息）
    ice_breath:              'frost_breath',
    cold_breath:             'frost_breath',
    blizzard_breath:         'frost_breath',
    hand_frost_breath:       'frost_breath',

    // 6. water_veil（水幕轻纱 / 折射水幕）
    hand_water_veil:         'water_veil',
    water_veil_s:            'water_veil',
    aqua_veil:               'water_veil',
    refract_water_veil:      'water_veil',

    // 7. ice_shield（冰晶护盾 / 凝水厚冰墙 / 钢冰生根盾）
    hand_ice_wall:           'ice_shield',
    ice_wall:                'ice_shield',
    hand_root_shield:        'ice_shield',
    root_shield:             'ice_shield',
    root_ice:                'ice_shield',
    frost_armor:             'ice_shield',
    ice_barrier:             'ice_shield',

    // 8. mirror_frost_wall（镜霜冰壁）
    mirror_ice:              'mirror_frost_wall',
    mirror_wall:             'mirror_frost_wall',
    frost_mirror:            'mirror_frost_wall',
    prism_wall:              'mirror_frost_wall',
    ice_mirror_wall:         'mirror_frost_wall',

    // 9. sword_root_step（生根步·卸力侧滑）
    root_step:               'sword_root_step',
    jikan_root_step:         'sword_root_step',
    sword_stance:            'sword_root_step',
    footwork_root:           'sword_root_step',

    // 10. sword_riposte_flash（反击闪刃）
    riposte_flash:           'sword_riposte_flash',
    parry_riposte:           'sword_riposte_flash',
    sword_counter:           'sword_riposte_flash',
    flash_riposte:           'sword_riposte_flash',

    // 11. remote_blind_shot（盲射穿棱 / 侧翼盲区冰弹 / 盲区弹指冰珠）
    blind_shot:              'remote_blind_shot',
    flank_ice_shot:          'remote_blind_shot',
    insight_aino_bead:       'remote_blind_shot',
    aino_bead:               'remote_blind_shot',

    // 12. remote_snap_spike（瞬发断咏冰锥 / 封肩地下冰柱 / 冻彻冰缝断流）
    snap_spike:              'remote_snap_spike',
    instant_ice:             'remote_snap_spike',
    ground_snap_spike:       'remote_snap_spike',
    insight_beatrice_pillar: 'remote_snap_spike',
    beatrice_pillar:         'remote_snap_spike',
    insight_alice_cage:      'remote_snap_spike',
    alice_cage:              'remote_snap_spike',
    insight_noelle_sever:    'remote_snap_spike',
    noelle_sever:            'remote_snap_spike',

    // 13. palace_time_stop（王宫冰时凝滞 / 冰晶宫殿）
    palace_timestop:         'palace_time_stop',
    ice_palace:              'palace_time_stop',
    time_stop:               'palace_time_stop',
    mind_palace:             'palace_time_stop',

    // 14. insight_rowan_prism（洞察·罗文棱镜 / 双镜合拢夹杖）
    rowan_prism:             'insight_rowan_prism',
    prism_clamp:             'insight_rowan_prism',
    dual_mirror_clamp:       'insight_rowan_prism',

    // 15. insight_flaw_strike（洞察·破绽狙击 / 凝霜贯隙刺 & 穿心看破技）
    insight_generic_flaw:    'insight_flaw_strike',
    generic_flaw:            'insight_flaw_strike',
    flaw_strike:             'insight_flaw_strike',
    insight_jackal_throat:   'insight_flaw_strike',
    jackal_throat:           'insight_flaw_strike',
    insight_hulan_resonance: 'insight_flaw_strike',
    hulan_resonance:         'insight_flaw_strike',
    insight_eastwing_draft:  'insight_flaw_strike',
    eastwing_draft:          'insight_flaw_strike',
    insight_wind_stillness:  'insight_flaw_strike',
    wind_stillness:          'insight_flaw_strike',

    // 16. eclipse_wand_toggle（晦轮法杖共鸣切换）
    wand_toggle:             'eclipse_wand_toggle',
    eclipse_wand:            'eclipse_wand_toggle',
    toggle_eclipse_wand:     'eclipse_wand_toggle',
    eclipse_resonance:       'eclipse_wand_toggle',

    // 17. eclipse_true_cast（晦轮真实魔伤施法）
    eclipse_cast:            'eclipse_true_cast',
    eclipse_true_magic:      'eclipse_true_cast',
    wand_true_cast:          'eclipse_true_cast',
    true_magic_beam:         'eclipse_true_cast',

    // 18. saint_staff_resonance（极北圣晶杖共鸣）
    north_saint_staff:       'saint_staff_resonance',
    saint_staff:             'saint_staff_resonance',
    north_staff:             'saint_staff_resonance',
    polar_saint_staff:       'saint_staff_resonance',
    staff_north_saint:       'saint_staff_resonance',
    saint_resonance:         'saint_staff_resonance',

    // 19. V3.2 全 15 招规范技能 ID 精准路由别名
    ice_1_crystal:           'ice_crystal',
    ice_2_prism:             'tri_prism_ice',
    ice_3_starfrost:         'starfrost_scatter',
    water_1_ball:            'water_orb',
    water_2_surge:           'raging_surge',
    water_3_blade:           'water_cleave',
    frost_1_step:            'frost_step_floor',
    frost_2_breath:          'frost_breath',
    frost_3_thorns:          'frost_thorn_field',
    shield_1_ice:            'ice_shield',
    shield_2_mirror:         'mirror_frost_wall',
    shield_3_steel:          ['prism_aegis', 'steel_ice_curtain'],
    sword_1_basic:           'basic_attack',
    sword_2_cold_edge:       ['sword_send_slash', 'silver_ice_slash'],
    move_afterimage:         ['sword_root_step', 'wind_afterimage']
  };

  const PACK_NAME = 'pack1_player_core';

  function registerTo(coreApi) {
    if (!coreApi || typeof coreApi.registerPack !== 'function') return null;
    return coreApi.registerPack(PACK_NAME, SKILLS_META, HANDLERS, ALIASES);
  }

  const core = resolveCore();
  const registration = registerTo(core);

  const packApi = {
    packName: PACK_NAME,
    version: '1.0.0',
    skills: SKILLS_META,
    handlers: HANDLERS,
    aliases: ALIASES,
    registration,
    registerTo
  };

  if (global) {
    global.VfxPackPlayer = packApi;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = packApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
