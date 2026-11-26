/* ============================================================================
   《转生千金》方案 A 战斗特效 Pack 2 · 友军、羁绊援护与全套系统反馈
   文件：js/vfx-pack-ally-sys.js
   注册包名：pack2_ally_system（共 23 项特效 + 全量事件别名路由）
   视觉基准：雪瓷冰白高可读基底 × 明亮晶透炫彩日系奇幻（零暗黑脏灰、零遮脸杂乱）
   兼容性：浏览器全局 window.VfxEditionAFull + CommonJS module.exports 双端加载
   ============================================================================ */
(function (global) {
  'use strict';

  const PACK_NAME = 'pack2_ally_system';
  const TAU = Math.PI * 2;

  /* -------------------- 23 项特效元数据清单 -------------------- */
  const SKILLS_META = [
    // 一、友军与援护（5 项）
    {
      id: 'ally_reno_earth',
      name: '雷纳德·大地裂岩',
      en: 'Reno: Tectonic Amber Spike',
      kind: 'ally',
      targetMode: 'single',
      duration: 1360,
      peakMs: 540,
      accent: '#F59E0B',
      desc: '金琥珀晶岩地脉奔涌破土，绽放璀璨琥珀石棱簇与双重震荡光环'
    },
    {
      id: 'ally_reno_fire',
      name: '雷纳德·烈焰斩波',
      en: 'Reno: Crimson Blaze Wave',
      kind: 'ally',
      targetMode: 'single',
      duration: 1340,
      peakMs: 520,
      accent: '#F97316',
      desc: '绯红流金火浪弧刃奔袭命中，升腾明焰光柱并漫天飞舞灼金火瓣'
    },
    {
      id: 'ally_reno_wind',
      name: '雷纳德·疾风破阵',
      en: 'Reno: Gale Breaker Cyclone',
      kind: 'ally',
      targetMode: 'single',
      duration: 1300,
      peakMs: 490,
      accent: '#10B981',
      desc: '双股连贯翠青风带疾卷穿阵，化作高速回旋疾风双刃与翡翠旋涡'
    },
    {
      id: 'ally_reno_guard',
      name: '雷纳德·前排岩盾援护',
      en: 'Reno: Amber Bulwark Guard',
      kind: 'ally_guard',
      targetMode: 'self',
      duration: 1380,
      peakMs: 540,
      accent: '#FCD34D',
      desc: '前排稳步立起金琥珀多面晶岩壁垒与护佑圣环，明澈阻挡敌锋'
    },
    {
      id: 'support_aino_spear',
      name: '艾诺·冰枪援护',
      en: 'Aino: Glacial Spear Support',
      kind: 'support',
      targetMode: 'single',
      duration: 1380,
      peakMs: 510,
      accent: '#60A5FA',
      desc: '银蓝修长冰枪自天际飞跃贯落，炸开冰棱碎星与双层旋转霜环'
    },

    // 二、5 位羁绊援护（5 项）
    {
      id: 'bond_alice_wind',
      name: '爱丽丝·微风花祈',
      en: 'Bond: Alice Breeze Prayer',
      kind: 'bond',
      targetMode: 'self',
      duration: 1460,
      peakMs: 580,
      accent: '#34D399',
      desc: '翠金双色流风缎带轻盈盘旋而上，漫洒柔暖风花瓣与晴光星尘'
    },
    {
      id: 'bond_noelle_calc',
      name: '诺艾尔·星轨推演',
      en: 'Bond: Noelle Astral Calibration',
      kind: 'bond',
      targetMode: 'self',
      duration: 1500,
      peakMs: 620,
      accent: '#3B82F6',
      desc: '澄蓝纯银精密星象仪法阵缓缓旋转，澄澈折光瞄准线定格魔力回路'
    },
    {
      id: 'bond_aino_frost',
      name: '艾诺·北境凛霜',
      en: 'Bond: Aino Northern Frost Crown',
      kind: 'bond',
      targetMode: 'multi',
      duration: 1500,
      peakMs: 620,
      accent: '#93C5FD',
      desc: '纯银冰雪冠冕于高空凝成，垂落晶莹霜幕并向敌阵降下北境冰花'
    },
    {
      id: 'bond_jilan_step',
      name: '吉兰·紫电轻步',
      en: 'Bond: Jilan Violet Flash Step',
      kind: 'bond',
      targetMode: 'single',
      duration: 1380,
      peakMs: 520,
      accent: '#818CF8',
      desc: '亮紫银三段晶透残像轻步疾闪，携紫电微弧挥出澄澈星辉斩弧'
    },
    {
      id: 'bond_charlotte_noble',
      name: '夏洛特·贵族礼赞',
      en: 'Bond: Charlotte Noble Salute',
      kind: 'bond',
      targetMode: 'self',
      duration: 1480,
      peakMs: 600,
      accent: '#FBBF24',
      desc: '香槟金皇家纹章光轮于背后盛放，结成华美冰金护镜与璀璨星爆'
    },

    // 三、13 项全套系统 & 状态反馈特效（13 项）
    {
      id: 'fx_weakness_break',
      name: '弱点击破·再动辉光',
      en: 'System: Weakness Break & ONE MORE',
      kind: 'system',
      targetMode: 'single',
      duration: 1280,
      peakMs: 380,
      accent: '#38BDF8',
      desc: '璀璨冰晶碎裂星爆叠加棱镜震环，触发 ONE MORE 时加冕香槟金光冠'
    },
    {
      id: 'fx_crit_starburst',
      name: '暴击星爆',
      en: 'System: Critical Starburst',
      kind: 'system',
      targetMode: 'single',
      duration: 960,
      peakMs: 260,
      accent: '#FDE68A',
      desc: '八角金白光芒骤然绽开，斜向棱镜闪裂与飞散星尘一闪定胜负'
    },
    {
      id: 'fx_block_bad',
      name: '格挡·失误涟漪',
      en: 'System: Block Bad',
      kind: 'system',
      targetMode: 'self',
      duration: 780,
      peakMs: 220,
      accent: '#93C5FD',
      desc: '清澈冰蓝微裂护纹轻震并溅起少量晶滴，辨识明晰且干净通透'
    },
    {
      id: 'fx_block_good',
      name: '格挡·良好新月护弧',
      en: 'System: Block Good',
      kind: 'system',
      targetMode: 'self',
      duration: 860,
      peakMs: 260,
      accent: '#38BDF8',
      desc: '清爽冰青新月护弧迎锋划开，迸射明亮洁净的偏折火花'
    },
    {
      id: 'fx_block_great',
      name: '格挡·极佳双环棱盾',
      en: 'System: Block Great',
      kind: 'system',
      targetMode: 'self',
      duration: 980,
      peakMs: 300,
      accent: '#1658EB',
      desc: '皇家蓝与纯银双环棱盾高速偏折来袭，四溅通透冰晶碎芒'
    },
    {
      id: 'fx_block_perfect',
      name: '格挡·完美圣盾弹反',
      en: 'System: Block Perfect Parry',
      kind: 'system',
      targetMode: 'self',
      duration: 1160,
      peakMs: 340,
      accent: '#F59E0B',
      desc: '香槟金与冰青六棱圣盾强势反震，绽放双重冲击环与漫天星辉'
    },
    {
      id: 'fx_shield_hit',
      name: '护盾承伤与碎盾',
      en: 'System: Shield Absorb / Shatter',
      kind: 'system',
      targetMode: 'self',
      duration: 1060,
      peakMs: 260,
      accent: '#67E8F9',
      desc: '常态触发棱面冰盾波纹吸伤，破盾时展现晶莹冰玻璃全景碎散'
    },
    {
      id: 'fx_heal_emerald',
      name: '翠玉治疗回血',
      en: 'System: Emerald Heal',
      kind: 'system',
      targetMode: 'self',
      duration: 1360,
      peakMs: 540,
      accent: '#10B981',
      desc: '通透翠玉光柱沐浴周身，水玉柔光环伴随翠绿十字光尘缓缓升腾'
    },
    {
      id: 'fx_mana_cycle_flow',
      name: '魔战循环回蓝流光',
      en: 'System: Mana Cycle Flow',
      kind: 'system',
      targetMode: 'single',
      duration: 1280,
      peakMs: 520,
      accent: '#0EA5E9',
      desc: '两条晶透皇家蓝与冰青魔力丝带自目标弧线回流，绽放灵动魔力微环'
    },
    {
      id: 'fx_enemy_defeat',
      name: '敌方晶光退场消散',
      en: 'System: Enemy Crystal Dissolve',
      kind: 'system',
      targetMode: 'single',
      duration: 1380,
      peakMs: 480,
      accent: '#BAE6FD',
      desc: '轻盈明亮的银蓝晶光星尘向天际升腾，柔光消散环洁净收尾'
    },
    {
      id: 'fx_boss_phase2',
      name: 'Boss 二阶段觉醒',
      en: 'System: Boss Phase 2 Awakening',
      kind: 'system',
      targetMode: 'single',
      duration: 1620,
      peakMs: 680,
      accent: '#F97316',
      desc: '多环法阵于 Boss 脚下盛大展开，冲天元素光柱配绚丽气场脉冲'
    },
    {
      id: 'fx_wave_transition',
      name: '多波次换场清风',
      en: 'System: Wave Transition Breeze',
      kind: 'system',
      targetMode: 'global',
      duration: 1180,
      peakMs: 500,
      accent: '#7DD3FC',
      desc: '通透天青银金棱光风幕横扫全屏，携轻盈星尘衔接下一波攻势'
    },
    {
      id: 'fx_status_micro',
      name: '状态微反馈光环',
      en: 'System: Status Micro Feedback',
      kind: 'system',
      targetMode: 'self',
      duration: 860,
      peakMs: 280,
      accent: '#38BDF8',
      desc: '按增益/减益/寒颤/灼烧/守势/增幅呈现轻巧灵动的微光环与星尘'
    }
  ];

  /* -------------------- 全量事件与现役引擎别名表 -------------------- */
  const ALIASES = {
    // 友军雷纳德 & 艾诺冰枪
    reno_earth:            'ally_reno_earth',
    reno_support_earth:    'ally_reno_earth',
    ally_earth:            'ally_reno_earth',
    reno_fire:             'ally_reno_fire',
    reno_support_fire:     'ally_reno_fire',
    ally_fire:             'ally_reno_fire',
    reno_wind:             'ally_reno_wind',
    reno_support_wind:     'ally_reno_wind',
    ally_wind:             'ally_reno_wind',
    reno_guard:            'ally_reno_guard',
    reno_support_guard:    'ally_reno_guard',
    reno_rock_block:       'ally_reno_guard',
    rock_block:            'ally_reno_guard',
    ally_guard:            'ally_reno_guard',
    bond_reno:             'ally_reno_guard',
    aino_spear:            'support_aino_spear',
    aino_spear_support:    'support_aino_spear',
    aino_cliff_spear:      'support_aino_spear',
    support_aino:          'support_aino_spear',

    // 5 位羁绊心念援护
    bond_alice:            'bond_alice_wind',
    ally_alice:            'bond_alice_wind',
    bond_assist_alice:     'bond_alice_wind',
    alice_assist:          'bond_alice_wind',
    bond_noelle:           'bond_noelle_calc',
    ally_noelle:           'bond_noelle_calc',
    bond_assist_noelle:    'bond_noelle_calc',
    noelle_assist:         'bond_noelle_calc',
    bond_aino:             'bond_aino_frost',
    ally_aino:             'bond_aino_frost',
    bond_assist_aino:      'bond_aino_frost',
    aino_assist:           'bond_aino_frost',
    bond_jilan:            'bond_jilan_step',
    ally_jilan:            'bond_jilan_step',
    bond_assist_jilan:     'bond_jilan_step',
    jilan_assist:          'bond_jilan_step',
    bond_charlotte:        'bond_charlotte_noble',
    ally_charlotte:        'bond_charlotte_noble',
    bond_assist_charlotte: 'bond_charlotte_noble',
    charlotte_assist:      'bond_charlotte_noble',

    // 系统 & 状态反馈
    weakness_break:        'fx_weakness_break',
    lock_break:            'fx_weakness_break',
    guard_break:           'fx_weakness_break',
    stagger_break:         'fx_weakness_break',
    break_chime:           'fx_weakness_break',
    break:                 'fx_weakness_break',
    one_more:              'fx_weakness_break',
    onemore:               'fx_weakness_break',

    crit:                  'fx_crit_starburst',
    crit_starburst:        'fx_crit_starburst',
    crit_hit:              'fx_crit_starburst',
    critical:              'fx_crit_starburst',
    did_crit:              'fx_crit_starburst',

    block_bad:             'fx_block_bad',
    guard_bad:             'fx_block_bad',
    parry_bad:             'fx_block_bad',
    block_miss:            'fx_block_bad',
    block_good:            'fx_block_good',
    guard_good:            'fx_block_good',
    parry_good:            'fx_block_good',
    enemy_blocked:         'fx_block_good',
    shield_block:          'fx_block_good',
    block_great:           'fx_block_great',
    guard_great:           'fx_block_great',
    parry_great:           'fx_block_great',
    block_perfect:         'fx_block_perfect',
    guard_perfect:         'fx_block_perfect',
    parry_perfect:         'fx_block_perfect',
    perfect_parry:         'fx_block_perfect',
    perfect_block:         'fx_block_perfect',
    enemy_parried:         'fx_block_perfect',
    parry_riposte:         'fx_block_perfect',

    shield_hit:            'fx_shield_hit',
    shield_absorb:         'fx_shield_hit',
    shield_shatter:        'fx_shield_hit',
    shield_break:          'fx_shield_hit',
    shatter_shield:        'fx_shield_hit',
    player_shield_hit:     'fx_shield_hit',

    heal:                  'fx_heal_emerald',
    heal_emerald:          'fx_heal_emerald',
    hp_heal:               'fx_heal_emerald',
    recover_hp:            'fx_heal_emerald',
    heal_touch:            ['heal_touch', 'fx_heal_emerald'],
    item_heal:             ['item_heal', 'fx_heal_emerald'],

    mana_cycle_flow:       'fx_mana_cycle_flow',
    mana_flow:             'fx_mana_cycle_flow',
    mp_recover:            'fx_mana_cycle_flow',
    mana_refund:           'fx_mana_cycle_flow',
    mana_cycle:            ['mana_cycle', 'fx_mana_cycle_flow'],
    mana_sip:              ['mana_sip', 'fx_mana_cycle_flow'],
    item_mana:             ['item_mana', 'fx_mana_cycle_flow'],

    enemy_defeat:          'fx_enemy_defeat',
    defeat:                'fx_enemy_defeat',
    enemy_ko:              'fx_enemy_defeat',
    enemy_vanish:          'fx_enemy_defeat',
    ko:                    'fx_enemy_defeat',

    boss_phase2:           'fx_boss_phase2',
    phase2:                'fx_boss_phase2',
    phase_2:               'fx_boss_phase2',
    phase2_awaken:         'fx_boss_phase2',
    boss_awaken:           'fx_boss_phase2',

    wave_transition:       'fx_wave_transition',
    wave_change:           'fx_wave_transition',
    wave_advance:          'fx_wave_transition',
    next_wave:             'fx_wave_transition',

    status_micro:          'fx_status_micro',
    status:                'fx_status_micro',
    status_buff:           'fx_status_micro',
    status_debuff:         'fx_status_micro',
    status_chill:          'fx_status_micro',
    status_burn:           'fx_status_micro',
    status_guard:          'fx_status_micro',
    status_amp:            'fx_status_micro'
  };

  /* -------------------- 内部几何与色板辅助 -------------------- */
  function resolveDir(o) {
    if (Number.isFinite(o.facing) && o.facing !== 0) return o.facing > 0 ? 1 : -1;
    if (o.from && o.to && o.to.x !== o.from.x) return o.to.x >= o.from.x ? 1 : -1;
    return 1;
  }

  function resolveSelfAnchor(o) {
    if (o.pos && Number.isFinite(o.pos.x) && Number.isFinite(o.pos.y)) {
      return {
        x: o.pos.x,
        y: o.pos.y,
        groundY: Number.isFinite(o.pos.groundY) ? o.pos.groundY : o.groundY
      };
    }
    if (o.side === 'enemy') {
      return { x: o.to.x, y: o.to.y, groundY: o.targetGroundY };
    }
    return { x: o.from.x, y: o.from.y, groundY: o.groundY };
  }

  function resolveTargetAnchor(o) {
    if (o.pos && Number.isFinite(o.pos.x) && Number.isFinite(o.pos.y)) {
      return {
        x: o.pos.x,
        y: o.pos.y,
        groundY: Number.isFinite(o.pos.groundY) ? o.pos.groundY : o.targetGroundY
      };
    }
    return { x: o.to.x, y: o.to.y, groundY: o.targetGroundY };
  }

  function addDirectedSlash(kit, dir, cfg) {
    const d = dir >= 0 ? 1 : -1;
    if (d > 0) return kit.addSlash(cfg);
    return kit.addSlash(Object.assign({}, cfg, {
      tilt: -(cfg.tilt || 0),
      startAngle: Math.PI - (cfg.startAngle || 0),
      endAngle: Math.PI - (cfg.endAngle || 0)
    }));
  }

  function drawRegularPoly(ctx, x, y, r, sides, rot, sy) {
    const scaleY = sy != null ? sy : 1;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU + (rot || 0);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * scaleY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawDiamond(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.lineTo(x + rx, y);
    ctx.lineTo(x, y + ry);
    ctx.lineTo(x - rx, y);
    ctx.closePath();
  }

  function resolveBossTheme(o, PALETTES) {
    const raw = String(o.theme || o.variant || o.rawSkillId || '').toLowerCase();
    if (raw.includes('storm') || raw.includes('wind')) {
      return {
        key: 'storm',
        pal: PALETTES.wind,
        sparkPal: PALETTES.windSpark,
        primary: '#10B981',
        bright: '#6EE7B7',
        pale: '#CCFBF1',
        accent: '#FDE68A',
        pfx: 'blizzard_vortex',
        particleKind: 'leaf',
        color2: '#059669'
      };
    }
    if (raw.includes('eclipse') || raw.includes('rowan') || raw.includes('violet')) {
      return {
        key: 'eclipse',
        pal: PALETTES.eclipse,
        sparkPal: PALETTES.eclipseSpark,
        primary: '#7C3AED',
        bright: '#C4B5FD',
        pale: '#F5F3FF',
        accent: '#DDD6FE',
        pfx: 'eclipse',
        particleKind: 'ringlet',
        color2: '#4C1D95'
      };
    }
    if (raw.includes('frost') || raw.includes('ice') || raw.includes('silver')) {
      return {
        key: 'frost',
        pal: PALETTES.iceGold,
        sparkPal: PALETTES.cyanSpark,
        primary: '#0EA5E9',
        bright: '#7DD3FC',
        pale: '#E0F7FF',
        accent: '#FDE68A',
        pfx: 'frost_nova',
        particleKind: 'snow',
        color2: '#1658EB'
      };
    }
    if (raw.includes('gold') || raw.includes('royal') || raw.includes('noble')) {
      return {
        key: 'gold',
        pal: PALETTES.gold,
        sparkPal: PALETTES.goldSpark,
        primary: '#F59E0B',
        bright: '#FCD34D',
        pale: '#FEF9C3',
        accent: '#FFFFFF',
        pfx: 'fire_ring',
        particleKind: 'star',
        color2: '#B45309'
      };
    }
    // 默认：红莲铁幕火金主题 (ember)
    return {
      key: 'ember',
      pal: PALETTES.fire,
      sparkPal: PALETTES.fireSpark,
      primary: '#EA580C',
      bright: '#FCD34D',
      pale: '#FEF08A',
      accent: '#FB923C',
      pfx: 'flame_pillar',
      particleKind: 'petal',
      color2: '#DC2626'
    };
  }

  function resolveStatusVariant(o) {
    const raw = String(o.variant || o.mode || '').toLowerCase().trim();
    if (raw) {
      if (raw === 'buff' || raw === 'debuff' || raw === 'chill' || raw === 'burn' || raw === 'guard' || raw === 'amp') {
        return raw;
      }
      if (raw.includes('chill') || raw.includes('frost') || raw.includes('freeze')) return 'chill';
      if (raw.includes('burn') || raw.includes('fire') || raw.includes('flame')) return 'burn';
      if (raw.includes('guard') || raw.includes('shield') || raw.includes('root')) return 'guard';
      if (raw.includes('amp') || raw.includes('charge') || raw.includes('overcast')) return 'amp';
      if (raw.includes('debuff') || raw.includes('vuln') || raw.includes('blind') || raw.includes('seal')) return 'debuff';
      return 'buff';
    }
    const idLow = String(o.rawSkillId || '').toLowerCase();
    if (idLow.includes('chill')) return 'chill';
    if (idLow.includes('burn')) return 'burn';
    if (idLow.includes('guard')) return 'guard';
    if (idLow.includes('amp')) return 'amp';
    if (idLow.includes('debuff') || idLow.includes('vuln')) return 'debuff';
    return 'buff';
  }

  /* ============================================================================
     23 项特效编排句柄
     ============================================================================ */
  const HANDLERS = {

    /* ==========================================================================
       1. 雷纳德·大地裂岩 (ally_reno_earth)
       ========================================================================== */
    ally_reno_earth(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const dir = resolveDir(o);
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;
      const pal = kit.PALETTES.earthGold;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: pal }, {
              x: from.x - dir * 10, y: groundY + 4, scale: 1.32 * ampScale,
              preWarmSec: 0.90, timeScale: 2.0, durMs: 520, layer: 'back',
              glowColor: 'rgba(245,158,11,0.38)', glowRadius: 50, glowAlpha: 0.36
            });
            kit.addMagicCircle({
              x: from.x - dir * 10, y: groundY + 4, radius: 46 * ampScale, sy: 0.30,
              palette: 'earthGold', goldTriple: amp >= 3, dur: 560
            });
            kit.triggerAmpCastAura(from.x - dir * 10, groundY, amp, 'earthGold');
            kit.spawnBurstParticles(from.x, groundY - 4, 14, 'shard', {
              palette: 'earthGold', spdMin: 40, spdMax: 135, upBias: 95,
              sizeMin: 3.0, sizeMax: 5.5, groundY, bounce: 0.35, lifeMin: 340, lifeMax: 540
            });
          }
        },
        {
          at: 115,
          fn() {
            kit.addIceVein({
              x0: from.x + dir * 14, y0: groundY + 2,
              x1: to.x, y1: targetGroundY + 2,
              palette: 'earthGold',
              width: 4.2 * ampScale,
              growMs: 215,
              dur: 980
            });
            kit.addShockRing({
              x: from.x + dir * 18, y: groundY + 4, r0: 8, r1: 54 * ampScale, sy: 0.28,
              color: '#F59E0B', coreColor: '#FEF3C7', lineW: 3.6, dur: 320
            });
          }
        },
        {
          at: 320,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 8.6 + amp * 2.0, 260);
            kit.safeCall(o.onHitStop, 56 + amp * 12);

            const brightEarth7 = ['#B45309', '#D97706', '#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7', '#FFFFFF'];
            kit.spawnPfx('ground_slam', { palette: brightEarth7, stone: '#FBBF24', reach: 86 }, {
              x: to.x, y: targetGroundY + 4, scale: 1.48 * ampScale,
              preWarmSec: 0.16, timeScale: 1.75, durMs: 880, layer: 'back',
              glowColor: 'rgba(251,191,36,0.42)', glowRadius: 68 * ampScale, glowAlpha: 0.38
            });

            kit.spawnPfx('ice_spikes', { palette: pal, reach: 72, height: 64 }, {
              x: to.x - dir * 34, y: targetGroundY + 4, scale: 1.56 * ampScale,
              flipX: dir < 0, preWarmSec: 0.08, timeScale: 1.52, durMs: 840, layer: 'main'
            });

            kit.spawnPfx('hit_spark', { palette: kit.PALETTES.gold7, height: 24, aim: dir > 0 ? 0.12 : 3.0 }, {
              x: to.x, y: to.y + 30, scale: 1.58 * ampScale, durMs: 420, layer: 'front'
            });

            // 璀璨金琥珀多面晶岩突刺簇
            kit.addHeroThorns({
              x: to.x, y: targetGroundY + 4,
              palette: 'earthGold',
              goldAccent: true,
              dur: 900,
              spikes: [
                { dx: -30, h: 48 * ampScale, w: 17, lean: -16, delay: 15, primary: false },
                { dx: 30,  h: 52 * ampScale, w: 17, lean: 17,  delay: 20, primary: false },
                { dx: -11, h: 78 * ampScale, w: 22, lean: -7,  delay: 0,  primary: true },
                { dx: 13,  h: 72 * ampScale, w: 20, lean: 9,   delay: 10, primary: true },
                { dx: 0,   h: 92 * ampScale, w: 25, lean: dir * 5, delay: 0, primary: true }
              ]
            });

            // 地面琥珀晶阵裂环
            kit.addCustomDrawable('back', {
              dur: 840,
              draw(ctx, p) {
                const env = p < 0.18 ? easeOutBack(p / 0.18) : 1;
                const fade = p > 0.68 ? clamp((1 - p) / 0.32, 0, 1) : 1;
                const r = lerp(22, 92 * ampScale, easeOutCubic(p)) * env;
                ctx.save();
                ctx.translate(to.x, targetGroundY + 4);
                ctx.scale(1, 0.30);
                ctx.globalAlpha = fade * 0.85;
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 3.6 * (1 - p * 0.45);
                drawRegularPoly(ctx, 0, 0, r, 6, p * 0.45, 1);
                ctx.stroke();

                ctx.strokeStyle = '#FEF3C7';
                ctx.lineWidth = 1.6;
                drawRegularPoly(ctx, 0, 0, r * 0.82, 6, -p * 0.35 + 0.5, 1);
                ctx.stroke();

                ctx.fillStyle = toRgba('#FCD34D', 0.22 * fade);
                drawRegularPoly(ctx, 0, 0, r * 0.72, 6, 0.25, 1);
                ctx.fill();
                ctx.restore();
              }
            });

            kit.addFlash(to.x, to.y, 52 * ampScale, '#FCD34D', 150, 0.36);
            kit.addStarFlare({
              x: to.x, y: to.y - 10, r0: 10, r1: 48 * ampScale, points: 6,
              outerColor: '#F59E0B', coreColor: '#FFFFFF', dur: 360
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 14, r1: 112 * ampScale, sy: 0.28,
              color: '#F59E0B', coreColor: '#FEF3C7', lineW: 4.2, dur: 500
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 8, r1: 82 * ampScale, sy: 0.28,
              color: '#FCD34D', coreColor: '#FFFFFF', lineW: 3.0, dur: 440, layer: 'front'
            });

            kit.spawnBurstParticles(to.x, targetGroundY - 12, 26 + amp * 6, 'shard', {
              palette: 'earthGold', spdMin: 90, spdMax: 270, upBias: 145,
              sizeMin: 3.6, sizeMax: 7.4, groundY: targetGroundY, bounce: 0.46,
              lifeMin: 440, lifeMax: 780
            });
            kit.spawnBurstParticles(to.x, to.y, 16, 'spark', {
              colors: ['#FFFFFF', '#FEF3C7', '#FCD34D', '#F59E0B'],
              spdMin: 130, spdMax: 300, gravity: 150, sizeMin: 2.4, sizeMax: 4.4,
              lifeMin: 260, lifeMax: 480
            });
            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        },
        {
          at: 470,
          fn() {
            kit.addStarFlare({
              x: to.x + dir * 4, y: to.y - 26, r0: 8, r1: 42 * ampScale, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 320
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 20, r1: 126 * ampScale, sy: 0.27,
              color: '#D97706', coreColor: '#FEF9C3', lineW: 3.2, dur: 420
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       2. 雷纳德·烈焰斩波 (ally_reno_fire)
       ========================================================================== */
    ally_reno_fire(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const dir = resolveDir(o);
      const { clamp, lerp, easeOutCubic, quadBezier, quadBezierTangent } = kit.math;
      const pal = kit.PALETTES.fire;
      const travelMs = 190;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: pal }, {
              x: from.x - dir * 8, y: groundY + 4, scale: 1.32 * ampScale,
              preWarmSec: 0.90, timeScale: 2.0, durMs: 520, layer: 'back',
              glowColor: 'rgba(249,115,22,0.40)', glowRadius: 50, glowAlpha: 0.36
            });
            kit.addMagicCircle({
              x: from.x - dir * 8, y: groundY + 4, radius: 44 * ampScale, sy: 0.30,
              palette: 'fire', goldTriple: amp >= 3, dur: 540
            });
            kit.triggerAmpCastAura(from.x - dir * 8, groundY, amp, 'fire');
            kit.spawnBurstParticles(from.x + dir * 10, from.y, 14, 'petal', {
              colors: ['#FEF08A', '#FCD34D', '#FB923C', '#F97316'], color2: '#DC2626',
              spdMin: 35, spdMax: 115, upBias: 75, gravity: -18,
              sizeMin: 4.0, sizeMax: 6.8, lifeMin: 360, lifeMax: 580
            });
          }
        },
        {
          at: 135,
          fn() {
            const p0 = { x: from.x + dir * 14, y: from.y - 4 };
            const p2 = { x: to.x, y: to.y - 2 };
            const p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 24 };
            const ribbon = kit.addRibbon({
              pts: [p0],
              width: 11.5 * ampScale,
              palette: 'fire',
              alpha: 0.94,
              dur: 560,
              fadeOut: 240
            });

            // 炽亮烈焰斩波月牙弧形气浪前进
            kit.addCustomDrawable('front', {
              dur: travelMs + 90,
              draw(ctx, p) {
                const moveP = easeOutCubic(clamp(p / 0.78, 0, 1));
                const fade = p > 0.72 ? clamp((1 - p) / 0.28, 0, 1) : 1;
                const pos = quadBezier(p0, p1, p2, moveP);
                const ang = quadBezierTangent(p0, p1, p2, Math.min(0.99, moveP));
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(ang);
                ctx.globalAlpha = fade * 0.92;
                const r = (34 + moveP * 14) * ampScale;

                ctx.strokeStyle = '#DC2626';
                ctx.lineWidth = 10 * ampScale;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(-r * 0.45, 0, r, -0.95, 0.95);
                ctx.stroke();

                ctx.strokeStyle = '#FB923C';
                ctx.lineWidth = 6 * ampScale;
                ctx.beginPath();
                ctx.arc(-r * 0.42, 0, r, -0.88, 0.88);
                ctx.stroke();

                ctx.strokeStyle = '#FEF08A';
                ctx.lineWidth = 2.6 * ampScale;
                ctx.beginPath();
                ctx.arc(-r * 0.38, 0, r, -0.78, 0.78);
                ctx.stroke();
                ctx.restore();
              }
            });

            kit.spawnPfx('fireball', { palette: pal, radius: 6 }, {
              x: p0.x, y: p0.y,
              angle: quadBezierTangent(p0, p1, p2, 0),
              scale: 1.56 * ampScale,
              timeScale: 1.45,
              durMs: travelMs + 60,
              fadeInMs: 18,
              fadeOutMs: 55,
              layer: 'front',
              glowColor: 'rgba(251,146,60,0.48)', glowRadius: 34, glowAlpha: 0.42,
              onUpdate(slot, dtSec, age) {
                const t = easeOutCubic(clamp(age / travelMs, 0, 1));
                const pos = quadBezier(p0, p1, p2, t);
                slot.x = pos.x;
                slot.y = pos.y;
                slot.angle = quadBezierTangent(p0, p1, p2, Math.min(0.99, t));
                if (t < 1) {
                  ribbon.pts.push({ x: pos.x, y: pos.y });
                  if (ribbon.pts.length > 22) ribbon.pts.shift();
                  if (Math.random() < 0.78) {
                    kit.addParticle({
                      kind: Math.random() < 0.65 ? 'petal' : 'spark',
                      x: pos.x + (Math.random() - 0.5) * 14,
                      y: pos.y + (Math.random() - 0.5) * 16,
                      vx: -dir * (30 + Math.random() * 65),
                      vy: -25 + (Math.random() - 0.5) * 45,
                      gravity: -16, drag: 0.9,
                      size: 4.2 + Math.random() * 3.4,
                      rot: Math.random() * TAU,
                      vrot: (Math.random() - 0.5) * 8,
                      color: Math.random() < 0.45 ? '#FEF08A' : '#FB923C',
                      color2: '#DC2626',
                      life: 320 + Math.random() * 240
                    });
                  }
                }
              }
            });
          }
        },
        {
          at: 135 + travelMs,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 8.4 + amp * 2.0, 260);
            kit.safeCall(o.onHitStop, 56 + amp * 12);

            kit.spawnPfx('flame_pillar', { palette: pal, stone: '#F59E0B', height: 118 }, {
              x: to.x, y: targetGroundY + 6, scale: 1.32 * ampScale,
              preWarmSec: 0.22, timeScale: 2.1, durMs: 860, layer: 'main',
              glowColor: 'rgba(251,146,60,0.40)', glowRadius: 66 * ampScale, glowAlpha: 0.36
            });
            kit.spawnPfx('fire_ring', { palette: pal, reach: 82 }, {
              x: to.x, y: targetGroundY + 4, scale: 1.46 * ampScale,
              preWarmSec: 0.14, timeScale: 1.9, durMs: 820, layer: 'back'
            });
            kit.spawnPfx('crit_hit', { palette: pal, height: 24, aim: dir > 0 ? 0.1 : 3.04 }, {
              x: to.x, y: to.y + 32, scale: 1.62 * ampScale, durMs: 480, layer: 'front'
            });

            addDirectedSlash(kit, dir, {
              x: to.x, y: to.y,
              rx: 96 * ampScale, ry: 56 * ampScale,
              tilt: -0.42, startAngle: -2.52, endAngle: 0.84,
              thickness: 24 * ampScale,
              palette: 'fire', dur: 460
            });

            kit.addFlash(to.x, to.y, 56 * ampScale, '#FB923C', 160, 0.38);
            kit.addStarFlare({
              x: to.x, y: to.y - 6, r0: 10, r1: 54 * ampScale, points: 8,
              outerColor: '#FCD34D', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 16, r1: 122 * ampScale, sy: 0.28,
              color: '#EA580C', coreColor: '#FEF08A', lineW: 4.2, dur: 520
            });

            // 绚丽飞舞火瓣 (petal)
            kit.spawnBurstParticles(to.x, to.y - 6, 32 + amp * 8, 'petal', {
              colors: ['#FFFFFF', '#FEF08A', '#FCD34D', '#FB923C'],
              color2: '#DC2626',
              spdMin: 68, spdMax: 240, upBias: 115, gravity: -14, drag: 1.05,
              sizeMin: 4.5, sizeMax: 8.2, lifeMin: 500, lifeMax: 860
            });
            kit.spawnBurstParticles(to.x, to.y, 20, 'spark', {
              colors: ['#FFFFFF', '#FEF08A', '#FDBA74', '#EA580C'],
              spdMin: 150, spdMax: 340, gravity: 120, sizeMin: 2.5, sizeMax: 4.6,
              lifeMin: 280, lifeMax: 500
            });
            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        },
        {
          at: 455,
          fn() {
            addDirectedSlash(kit, dir, {
              x: to.x + dir * 4, y: to.y - 6,
              rx: 88 * ampScale, ry: 48 * ampScale,
              tilt: 0.48, startAngle: 2.45, endAngle: -0.78,
              thickness: 20 * ampScale,
              outerColor: '#EA580C', midColor: '#FCD34D', hiColor: '#FEF08A',
              dur: 400
            });
            kit.spawnBurstParticles(to.x, to.y - 16, 16, 'petal', {
              colors: ['#FEF08A', '#FCD34D', '#FB923C'], color2: '#DC2626',
              spdMin: 45, spdMax: 165, upBias: 95, gravity: -16,
              sizeMin: 4.2, sizeMax: 7.4, lifeMin: 420, lifeMax: 720
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       3. 雷纳德·疾风破阵 (ally_reno_wind)
       ========================================================================== */
    ally_reno_wind(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const dir = resolveDir(o);
      const { clamp, lerp, easeOutCubic } = kit.math;
      const pal = kit.PALETTES.wind;
      const travelMs = 175;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: from.x - dir * 8, y: groundY + 4, radius: 44 * ampScale, sy: 0.30,
              palette: 'wind', goldTriple: amp >= 3, dur: 520
            });
            kit.spawnPfx('blizzard_vortex', { palette: pal, height: 60 }, {
              x: from.x - dir * 6, y: groundY + 4, scale: 1.24 * ampScale,
              timeScale: 1.5, durMs: 480, fadeOutMs: 180, layer: 'back',
              glowColor: 'rgba(16,185,129,0.34)', glowRadius: 46, glowAlpha: 0.34
            });
            kit.triggerAmpCastAura(from.x - dir * 8, groundY, amp, true);
          }
        },
        {
          at: 110,
          fn() {
            const sx = from.x + dir * 12;
            const sy = from.y;
            const ex = to.x;
            const ey = to.y;
            const ang = Math.atan2(ey - sy, ex - sx);

            // 连贯翠青双股旋风风带
            const bandA = [];
            const bandB = [];
            const segs = 24;
            for (let i = 0; i <= segs; i++) {
              const t = i / segs;
              const bx = lerp(sx, ex, t);
              const by = lerp(sy, ey, t);
              const wave = Math.sin(t * Math.PI * 3.0) * 16;
              bandA.push({ x: bx, y: by - 8 + wave });
              bandB.push({ x: bx, y: by + 10 - wave });
            }
            kit.addRibbon({
              pts: bandA, width: 10.2 * ampScale,
              outerColor: '#059669', midColor: '#34D399', coreColor: '#FFFFFF',
              alpha: 0.90, dur: 640, fadeOut: 260
            });
            kit.addRibbon({
              pts: bandB, width: 7.8 * ampScale,
              outerColor: '#0D9488', midColor: '#6EE7B7', coreColor: '#CCFBF1',
              alpha: 0.84, dur: 660, fadeOut: 260
            });

            kit.spawnPfx('ice_lance', { palette: pal, length: 48 }, {
              x: sx, y: sy, angle: ang, scale: 1.52 * ampScale,
              timeScale: 1.5, durMs: travelMs + 55, fadeInMs: 15, fadeOutMs: 50,
              layer: 'front',
              onUpdate(slot, dtSec, age) {
                const p = easeOutCubic(clamp(age / travelMs, 0, 1));
                slot.x = lerp(sx, ex, p);
                slot.y = lerp(sy, ey, p);
              }
            });
          }
        },
        {
          at: 110 + travelMs,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 7.2 + amp * 1.8, 220);
            kit.safeCall(o.onHitStop, 48 + amp * 10);

            kit.spawnPfx('blizzard_vortex', { palette: pal, height: 82 }, {
              x: to.x, y: targetGroundY + 6, scale: 1.70 * ampScale,
              timeScale: 1.45, durMs: 840, fadeInMs: 30, fadeOutMs: 240, layer: 'main',
              glowColor: 'rgba(52,211,153,0.38)', glowRadius: 62 * ampScale, glowAlpha: 0.36
            });

            const dsScale = 1.82 * ampScale;
            kit.spawnPfx('double_slash', { palette: kit.PALETTES.slashWind, sparks: kit.PALETTES.windSpark }, {
              x: to.x - dir * 32 * dsScale, y: to.y + 23 * dsScale,
              scale: dsScale, flipX: dir < 0, durMs: 660, layer: 'front'
            });

            addDirectedSlash(kit, dir, {
              x: to.x, y: to.y - 4,
              rx: 94 * ampScale, ry: 54 * ampScale,
              tilt: -0.45, startAngle: -2.55, endAngle: 0.85,
              thickness: 22 * ampScale, palette: 'slashWind', dur: 440
            });
            addDirectedSlash(kit, dir, {
              x: to.x + dir * 2, y: to.y + 4,
              rx: 88 * ampScale, ry: 48 * ampScale,
              tilt: 0.52, startAngle: 2.45, endAngle: -0.82,
              thickness: 20 * ampScale, palette: 'slashWind', dur: 420
            });

            // 回旋疾风环刃
            kit.addCustomDrawable('front', {
              dur: 680,
              draw(ctx, p) {
                const fade = p > 0.65 ? clamp((1 - p) / 0.35, 0, 1) : 1;
                const rad = lerp(26, 78 * ampScale, easeOutCubic(p));
                const rot = p * 7.5 * dir;
                ctx.save();
                ctx.translate(to.x, to.y - 2);
                ctx.scale(1, 0.42);
                ctx.rotate(rot);
                ctx.globalAlpha = fade * 0.90;
                for (let k = 0; k < 3; k++) {
                  const a0 = (k / 3) * TAU;
                  ctx.strokeStyle = k === 0 ? '#059669' : '#10B981';
                  ctx.lineWidth = 6.5 * (1 - p * 0.4);
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.arc(0, 0, rad, a0, a0 + 1.15);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 2.0;
                  ctx.beginPath();
                  ctx.arc(0, 0, rad * 0.96, a0 + 0.12, a0 + 1.0);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });

            kit.addFlash(to.x, to.y, 50 * ampScale, '#34D399', 150, 0.34);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 10, r1: 48 * ampScale, points: 8,
              outerColor: '#34D399', coreColor: '#FFFFFF', dur: 340
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 14, r1: 116 * ampScale, sy: 0.28,
              color: '#10B981', coreColor: '#CCFBF1', lineW: 4.0, dur: 480
            });

            kit.spawnBurstParticles(to.x, to.y - 8, 30 + amp * 6, 'leaf', {
              colors: ['#CCFBF1', '#A7F3D0', '#6EE7B7', '#34D399'], color2: '#059669',
              spdMin: 75, spdMax: 245, upBias: 95, gravity: 18, drag: 1.05,
              sizeMin: 4.2, sizeMax: 7.8, lifeMin: 480, lifeMax: 840
            });
            kit.spawnBurstParticles(to.x, to.y, 18, 'star', {
              colors: ['#FFFFFF', '#CCFBF1', '#6EE7B7'],
              spdMin: 60, spdMax: 200, upBias: 65, gravity: 10,
              sizeMin: 3.0, sizeMax: 6.0, lifeMin: 400, lifeMax: 720
            });
            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ==========================================================================
       4. 雷纳德·前排岩盾援护 (ally_reno_guard)
       ========================================================================== */
    ally_reno_guard(kit, o) {
      const { amp, ampScale } = o;
      const dir = resolveDir(o);
      const anchor = resolveSelfAnchor(o);
      const cx = anchor.x + dir * 16;
      const cy = anchor.y + 2;
      const gy = anchor.groundY;
      const { clamp, easeOutBack, easeOutCubic } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: anchor.x, y: gy + 4, radius: 54 * ampScale, sy: 0.30,
              palette: 'earthGold', goldTriple: amp >= 2, dur: 1120
            });
            const brightEarth7 = ['#B45309', '#D97706', '#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7', '#FFFFFF'];
            kit.spawnPfx('ground_slam', { palette: brightEarth7, stone: '#FBBF24', reach: 64 }, {
              x: cx + dir * 16, y: gy + 4, scale: 1.18 * ampScale,
              preWarmSec: 0.14, timeScale: 1.8, durMs: 740, layer: 'back',
              glowColor: 'rgba(251,191,36,0.34)', glowRadius: 56, glowAlpha: 0.30
            });
            kit.spawnBurstParticles(cx + dir * 16, gy - 6, 16, 'shard', {
              palette: 'earthGold', spdMin: 45, spdMax: 135, upBias: 110,
              sizeMin: 3.0, sizeMax: 5.8, groundY: gy, bounce: 0.35, lifeMin: 380, lifeMax: 660
            });
          }
        },
        {
          at: 140,
          fn() {
            kit.spawnPfx('divine_shield', { palette: kit.PALETTES.gold, radius: 34 }, {
              x: cx + dir * 6, y: cy + 44, scale: 1.72 * ampScale,
              alpha: 0.38, lightGain: 0.90, timeScale: 1.2, durMs: 1040,
              fadeInMs: 110, fadeOutMs: 240, layer: 'back',
              glowColor: 'rgba(252,211,77,0.24)', glowRadius: 58 * ampScale, glowAlpha: 0.24
            });

            // 背后镂空金琥珀护盾外环（中心通透，角色面部零遮挡）
            kit.addCustomDrawable('back', {
              dur: 1060,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.22, 0, 1));
                const exit = p > 0.76 ? clamp((1 - p) / 0.24, 0, 1) : 1;
                const R = 60 * ampScale * enter;
                ctx.save();
                ctx.translate(cx + dir * 4, cy - 2);
                ctx.globalAlpha = exit * 0.90;
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 3.2;
                drawRegularPoly(ctx, 0, 0, R, 8, Math.PI / 8, 1.04);
                ctx.stroke();
                ctx.strokeStyle = '#FEF3C7';
                ctx.lineWidth = 1.6;
                drawRegularPoly(ctx, 0, 0, R * 1.07, 8, Math.PI / 8, 1.04);
                ctx.stroke();

                // 斜向公转琥珀晶环
                ctx.rotate(-0.24);
                ctx.strokeStyle = '#FCD34D';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.ellipse(0, 0, R * 1.24, R * 0.30, 0, 0, TAU);
                ctx.stroke();
                for (let c = 0; c < 3; c++) {
                  const ca = p * 3.8 + (c / 3) * TAU;
                  ctx.fillStyle = c === 0 ? '#FFFFFF' : '#FDE68A';
                  drawDiamond(ctx, Math.cos(ca) * R * 1.24, Math.sin(ca) * R * 0.30, 4.8, 7.6);
                  ctx.fill();
                }
                ctx.restore();
              }
            });

            // 前排三联金琥珀棱面晶岩盾板（立于身前迎敌外侧，零遮脸）
            kit.addCustomDrawable('front', {
              dur: 1060,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.22, 0, 1));
                const exit = p > 0.76 ? clamp((1 - p) / 0.24, 0, 1) : 1;
                const wallX = cx + dir * 42 * ampScale;
                const wallY = cy + 6;
                const h = 76 * ampScale * enter;
                const w = 22 * ampScale;
                const lockFlash = p > 0.24 && p < 0.44 ? Math.sin(((p - 0.24) / 0.20) * Math.PI) : 0;

                ctx.save();
                ctx.translate(wallX, wallY);
                ctx.scale(dir, 1);
                ctx.globalAlpha = exit * 0.94;

                // 三块交叠六角晶岩壁板
                const plates = [
                  { ox: -10, oy: -22, rw: w * 0.72, rh: h * 0.46 },
                  { ox: -8,  oy: 22,  rw: w * 0.72, rh: h * 0.44 },
                  { ox: 4,   oy: 0,   rw: w * 0.92, rh: h * 0.62 }
                ];
                for (let i = 0; i < plates.length; i++) {
                  const pl = plates[i];
                  const g = ctx.createLinearGradient(pl.ox - pl.rw, pl.oy - pl.rh, pl.ox + pl.rw, pl.oy + pl.rh);
                  g.addColorStop(0, toRgba('#FEF3C7', 0.56 + lockFlash * 0.24));
                  g.addColorStop(0.45, toRgba('#FCD34D', 0.44 + lockFlash * 0.20));
                  g.addColorStop(1, toRgba('#D97706', 0.48));
                  ctx.fillStyle = g;
                  ctx.beginPath();
                  ctx.moveTo(pl.ox + pl.rw * 0.35, pl.oy - pl.rh);
                  ctx.lineTo(pl.ox + pl.rw, pl.oy - pl.rh * 0.38);
                  ctx.lineTo(pl.ox + pl.rw, pl.oy + pl.rh * 0.38);
                  ctx.lineTo(pl.ox + pl.rw * 0.35, pl.oy + pl.rh);
                  ctx.lineTo(pl.ox - pl.rw * 0.55, pl.oy + pl.rh * 0.55);
                  ctx.lineTo(pl.ox - pl.rw * 0.55, pl.oy - pl.rh * 0.55);
                  ctx.closePath();
                  ctx.fill();

                  ctx.strokeStyle = lockFlash > 0.15 ? '#FFFFFF' : '#FDE68A';
                  ctx.lineWidth = 2.0 + lockFlash * 1.4;
                  ctx.stroke();

                  // 内部棱面亮脊
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.2;
                  ctx.beginPath();
                  ctx.moveTo(pl.ox + pl.rw * 0.35, pl.oy - pl.rh);
                  ctx.lineTo(pl.ox + pl.rw * 0.2, pl.oy);
                  ctx.lineTo(pl.ox + pl.rw * 0.35, pl.oy + pl.rh);
                  ctx.stroke();
                }

                // 迎锋竖向折射波纹
                if (p > 0.22 && p < 0.65) {
                  const rp = easeOutCubic((p - 0.22) / 0.43);
                  ctx.strokeStyle = toRgba('#FEF3C7', (1 - rp) * 0.9);
                  ctx.lineWidth = 3.0 * (1 - rp * 0.5);
                  ctx.beginPath();
                  ctx.ellipse(8, 0, 14 + rp * 26, (38 + rp * 34) * ampScale, 0, -Math.PI * 0.45, Math.PI * 0.45);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 390,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 4.6 + amp, 160);

            kit.spawnPfx('parry', { palette: kit.PALETTES.gold7, height: 28 }, {
              x: cx + dir * 36, y: cy + 40, scale: 1.42 * ampScale,
              alpha: 0.68, durMs: 460, layer: 'front'
            });
            kit.addStarFlare({
              x: cx + dir * 44, y: cy - 36 * ampScale, r0: 6, r1: 30 * ampScale, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 420
            });
            kit.addStarFlare({
              x: cx + dir * 48, y: cy + 4, r0: 6, r1: 26 * ampScale, points: 4,
              outerColor: '#F59E0B', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: cx, y: gy + 4, r0: 18, r1: 102 * ampScale, sy: 0.30,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 3.6, dur: 480
            });
            kit.spawnBurstParticles(cx + dir * 26, cy, 22, 'star', {
              colors: ['#FFFFFF', '#FEF3C7', '#FCD34D', '#F59E0B'],
              spdMin: 60, spdMax: 165, upBias: 45, gravity: -12,
              sizeMin: 3.2, sizeMax: 6.4, lifeMin: 440, lifeMax: 740
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       5. 艾诺·冰枪援护 (support_aino_spear)
       ========================================================================== */
    support_aino_spear(kit, o) {
      const { to, targetGroundY, amp, ampScale } = o;
      const dir = resolveDir(o);
      const { clamp, lerp, easeOutCubic, easeInQuad } = kit.math;
      const { toRgba } = kit.color;
      const pal = kit.PALETTES.silverIce;
      const skyOrigin = { x: clamp(to.x - dir * 188, 28, 612), y: 20 };
      const travelMs = 195;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: skyOrigin.x, y: skyOrigin.y + 8, radius: 42 * ampScale, sy: 0.42,
              palette: 'silverIce', lineW: 2.2, dur: 420, layer: 'front'
            });
            kit.addStarFlare({
              x: skyOrigin.x, y: skyOrigin.y + 4, r0: 8, r1: 42 * ampScale, points: 8,
              outerColor: '#93C5FD', coreColor: '#FFFFFF', dur: 340
            });
            // 目标处银蓝锁定菱印
            kit.addCustomDrawable('back', {
              dur: 340,
              draw(ctx, p) {
                const fade = p > 0.78 ? clamp((1 - p) / 0.22, 0, 1) : 1;
                const r = lerp(46, 22, easeOutCubic(p));
                ctx.save();
                ctx.translate(to.x, targetGroundY + 2);
                ctx.scale(1, 0.30);
                ctx.globalAlpha = fade * 0.88;
                ctx.strokeStyle = '#60A5FA';
                ctx.lineWidth = 2.4;
                drawRegularPoly(ctx, 0, 0, r, 4, p * 2.2, 1);
                ctx.stroke();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.65, 0, TAU);
                ctx.stroke();
                ctx.restore();
              }
            });
          }
        },
        {
          at: 105,
          fn() {
            const ang = Math.atan2(to.y - skyOrigin.y, to.x - skyOrigin.x);
            kit.addSkyBeam({
              x0: skyOrigin.x, y0: skyOrigin.y,
              x1: to.x, y1: targetGroundY,
              width: 8.4 * ampScale, palette: 'silverIce', dur: 480
            });

            const ribbon = kit.addRibbon({
              pts: [skyOrigin],
              width: 10.5 * ampScale,
              palette: 'silverIce',
              alpha: 0.95, dur: 520, fadeOut: 220
            });

            // 银蓝飞跃长冰枪实体棱镜枪身 + 音爆霜环
            kit.addCustomDrawable('front', {
              dur: travelMs + 90,
              draw(ctx, p) {
                const t = easeInQuad(clamp(p / 0.76, 0, 1));
                const fade = p > 0.76 ? clamp((1 - p) / 0.24, 0, 1) : 1;
                const px = lerp(skyOrigin.x, to.x, t);
                const py = lerp(skyOrigin.y, to.y, t);
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(ang);
                ctx.globalAlpha = fade;

                const len = 76 * ampScale;
                const w = 9.5 * ampScale;
                const grad = ctx.createLinearGradient(-len, 0, 22, 0);
                grad.addColorStop(0, toRgba('#2563EB', 0));
                grad.addColorStop(0.35, '#60A5FA');
                grad.addColorStop(0.78, '#DBEAFE');
                grad.addColorStop(1, '#FFFFFF');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(22 * ampScale, 0);
                ctx.lineTo(-4, -w);
                ctx.lineTo(-len, -w * 0.22);
                ctx.lineTo(-len * 1.15, 0);
                ctx.lineTo(-len, w * 0.22);
                ctx.lineTo(-4, w);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(-len * 0.85, 0);
                ctx.lineTo(20 * ampScale, 0);
                ctx.stroke();

                // 枪身破空双霜环
                for (let r = 0; r < 2; r++) {
                  const rx = -14 - r * 24;
                  ctx.strokeStyle = r === 0 ? '#FFFFFF' : '#93C5FD';
                  ctx.lineWidth = 2.0;
                  ctx.beginPath();
                  ctx.ellipse(rx, 0, 5, (14 + r * 6) * ampScale, 0, 0, TAU);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });

            kit.spawnPfx('ice_lance', { palette: pal, length: 60 }, {
              x: skyOrigin.x, y: skyOrigin.y, angle: ang, scale: 1.72 * ampScale,
              timeScale: 1.5, durMs: travelMs + 60, fadeInMs: 15, fadeOutMs: 50,
              layer: 'front',
              onUpdate(slot, dtSec, age) {
                const t = easeInQuad(clamp(age / travelMs, 0, 1));
                slot.x = lerp(skyOrigin.x, to.x, t);
                slot.y = lerp(skyOrigin.y, to.y, t);
                if (t < 1) {
                  ribbon.pts.push({ x: slot.x, y: slot.y });
                  if (ribbon.pts.length > 22) ribbon.pts.shift();
                }
              }
            });
          }
        },
        {
          at: 105 + travelMs,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 9.8 + amp * 2.2, 300);
            kit.safeCall(o.onHitStop, 76 + amp * 12);

            kit.spawnPfx('icicle_fall', { palette: pal }, {
              x: to.x, y: targetGroundY + 2, scale: 1.66 * ampScale,
              preWarmSec: 0.44, timeScale: 1.68, durMs: 840, layer: 'main'
            });
            kit.spawnPfx('ice_shatter', { palette: kit.PALETTES.ice }, {
              x: to.x, y: targetGroundY - 2, scale: 1.80 * ampScale,
              preWarmSec: 0.38, timeScale: 1.68, durMs: 840, layer: 'main',
              glowColor: 'rgba(96,165,250,0.42)', glowRadius: 64 * ampScale, glowAlpha: 0.38
            });
            kit.spawnPfx('crit_hit', { palette: pal, height: 26, aim: dir > 0 ? 0.35 : 2.8 }, {
              x: to.x, y: to.y + 34, scale: 1.72 * ampScale, durMs: 540, layer: 'front'
            });

            const spearAng = Math.atan2(to.y - skyOrigin.y, to.x - skyOrigin.x);
            // 命中贯入地面的银蓝晶莹长冰枪本体（维持至 peakMs 后晶解消散）
            kit.addCustomDrawable('front', {
              dur: 560,
              draw(ctx, p) {
                const fade = p > 0.56 ? clamp((1 - p) / 0.44, 0, 1) : 1;
                if (fade <= 0.02) return;
                const vib = p < 0.25 ? Math.sin(p * 65) * 1.8 * (1 - p / 0.25) : 0;
                ctx.save();
                ctx.translate(to.x + vib, to.y + 8);
                ctx.rotate(spearAng);
                ctx.globalAlpha = fade * 0.96;

                const shaftLen = 136 * ampScale;
                const tipW = 10.5 * ampScale;
                const g = ctx.createLinearGradient(-shaftLen, 0, 26, 0);
                g.addColorStop(0, toRgba('#2563EB', 0.12));
                g.addColorStop(0.28, '#3B82F6');
                g.addColorStop(0.68, '#DBEAFE');
                g.addColorStop(1, '#FFFFFF');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(28 * ampScale, 0);
                ctx.lineTo(-6, -tipW);
                ctx.lineTo(-22, -tipW * 0.34);
                ctx.lineTo(-shaftLen, -tipW * 0.22);
                ctx.lineTo(-shaftLen - 16, 0);
                ctx.lineTo(-shaftLen, tipW * 0.22);
                ctx.lineTo(-22, tipW * 0.34);
                ctx.lineTo(-6, tipW);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#1D4ED8';
                ctx.lineWidth = 1.4;
                ctx.stroke();

                // 菱形银冰枪锷与纯白中脊
                ctx.fillStyle = '#FFFFFF';
                drawDiamond(ctx, -18, 0, 6.5 * ampScale, 15 * ampScale);
                ctx.fill();
                ctx.strokeStyle = '#60A5FA';
                ctx.lineWidth = 1.6;
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.moveTo(-shaftLen * 0.92, 0);
                ctx.lineTo(25 * ampScale, 0);
                ctx.stroke();
                ctx.restore();
              }
            });

            // 银蓝双霜环（倾斜立体双环 + 地面霜纹）
            kit.addCustomDrawable('front', {
              dur: 760,
              draw(ctx, p) {
                const fade = p > 0.62 ? clamp((1 - p) / 0.38, 0, 1) : 1;
                const r1 = lerp(18, 96 * ampScale, easeOutCubic(p));
                const r2 = lerp(10, 74 * ampScale, easeOutCubic(clamp((p - 0.08) / 0.92, 0, 1)));
                ctx.save();
                ctx.translate(to.x, to.y + 4);
                ctx.globalAlpha = fade * 0.92;

                ctx.save();
                ctx.rotate(-0.28 * dir);
                ctx.scale(1, 0.36);
                ctx.strokeStyle = '#60A5FA';
                ctx.lineWidth = 4.2 * (1 - p * 0.45);
                ctx.beginPath();
                ctx.arc(0, 0, r1, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.6;
                drawRegularPoly(ctx, 0, 0, r1 * 0.88, 6, p * 1.4, 1);
                ctx.stroke();
                ctx.restore();

                ctx.save();
                ctx.rotate(0.32 * dir);
                ctx.scale(1, 0.34);
                ctx.strokeStyle = '#93C5FD';
                ctx.lineWidth = 3.2 * (1 - p * 0.4);
                ctx.beginPath();
                ctx.arc(0, 0, r2, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = '#F8FAFC';
                ctx.lineWidth = 1.4;
                ctx.setLineDash([10, 6]);
                ctx.beginPath();
                ctx.arc(0, 0, r2 * 1.08, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                ctx.restore();
              }
            });

            kit.addFlash(to.x, to.y, 58 * ampScale, '#93C5FD', 165, 0.38);
            kit.addStarFlare({
              x: to.x, y: to.y - 6, r0: 12, r1: 62 * ampScale, points: 8,
              outerColor: '#60A5FA', coreColor: '#FFFFFF', dur: 400
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 16, r1: 124 * ampScale, sy: 0.28,
              color: '#2563EB', coreColor: '#DBEAFE', lineW: 4.4, dur: 520
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 10, r1: 92 * ampScale, sy: 0.28,
              color: '#93C5FD', coreColor: '#FFFFFF', lineW: 3.0, dur: 460, layer: 'front'
            });

            kit.spawnBurstParticles(to.x, to.y - 6, 30 + amp * 6, 'shard', {
              palette: 'silverIce', spdMin: 95, spdMax: 295, upBias: 115,
              sizeMin: 3.5, sizeMax: 7.5, groundY: targetGroundY, bounce: 0.44,
              lifeMin: 460, lifeMax: 820
            });
            kit.spawnBurstParticles(to.x, to.y - 18, 22, 'snow', {
              colors: ['#FFFFFF', '#DBEAFE', '#93C5FD'], color2: '#2563EB',
              spdMin: 30, spdMax: 125, upBias: 70, gravity: 22,
              sizeMin: 3.5, sizeMax: 6.8, lifeMin: 500, lifeMax: 840
            });
            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        },
        {
          at: 440,
          fn() {
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 22, r1: 138 * ampScale, sy: 0.26,
              color: '#60A5FA', coreColor: '#FFFFFF', lineW: 3.0, dur: 460
            });
            kit.addStarFlare({
              x: to.x, y: to.y - 24, r0: 8, r1: 42 * ampScale, points: 4, rot: 0.4,
              outerColor: '#93C5FD', coreColor: '#FFFFFF', dur: 320
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       6. 爱丽丝·微风花祈 (bond_alice_wind)
       ========================================================================== */
    bond_alice_wind(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const anchor = resolveSelfAnchor(o);
      const cx = anchor.x - dir * 6;
      const cy = anchor.y;
      const gy = anchor.groundY;
      const { clamp, lerp, easeOutCubic } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: cx, y: gy + 4, radius: 56 * ampScale, sy: 0.30,
              rimColor: '#10B981', starColor: '#FDE68A', runeColor: '#ECFDF5',
              innerGlow: 'rgba(204,251,241,0.58)', outerGlow: 'rgba(52,211,153,0.26)',
              goldTriple: true, dur: 1180, fadeIn: 140, fadeOut: 280
            });
            kit.spawnPfx('blizzard_vortex', { palette: kit.PALETTES.wind, height: 68 }, {
              x: cx, y: gy + 4, scale: 1.38 * ampScale,
              alpha: 0.34, timeScale: 1.25, durMs: 1020, fadeInMs: 120, fadeOutMs: 280,
              layer: 'back', glowColor: 'rgba(110,231,183,0.24)', glowRadius: 56, glowAlpha: 0.22
            });
          }
        },
        {
          at: 80,
          fn() {
            // 后景与前景交织的翠金双风缎（宽幅环绕身侧向上飞舞，留白面部）
            const buildHelixDrawer = wantFront => ({
              dur: 1120,
              draw(ctx, p) {
                const enter = easeOutCubic(clamp(p / 0.20, 0, 1));
                const exit = p > 0.72 ? clamp((1 - p) / 0.28, 0, 1) : 1;
                const alpha = enter * exit;
                if (alpha <= 0.02) return;

                const strands = [
                  { phase: 0,       outer: '#10B981', mid: '#6EE7B7', core: '#FFFFFF', rBase: 64 },
                  { phase: Math.PI, outer: '#F59E0B', mid: '#FDE68A', core: '#FFFFFF', rBase: 58 }
                ];
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                for (let s = 0; s < strands.length; s++) {
                  const st = strands[s];
                  const segs = 34;
                  const headT = clamp(p * 1.38, 0, 1);
                  const tailT = clamp(p * 1.12 - 0.36, 0, 1);
                  for (let i = 1; i <= segs; i++) {
                    const u0 = lerp(tailT, headT, (i - 1) / segs);
                    const u1 = lerp(tailT, headT, i / segs);
                    const a0 = st.phase + u0 * TAU * 1.45 + p * 3.8;
                    const a1 = st.phase + u1 * TAU * 1.45 + p * 3.8;
                    const depth = Math.sin((a0 + a1) * 0.5);
                    if ((wantFront && depth < 0) || (!wantFront && depth >= 0)) continue;

                    const r0 = (st.rBase + Math.sin(u0 * Math.PI) * 14) * ampScale;
                    const r1 = (st.rBase + Math.sin(u1 * Math.PI) * 14) * ampScale;
                    const x0 = cx + Math.cos(a0) * r0;
                    const y0 = gy - 8 - u0 * 116 * ampScale + Math.sin(a0) * 10;
                    const x1 = cx + Math.cos(a1) * r1;
                    const y1 = gy - 8 - u1 * 116 * ampScale + Math.sin(a1) * 10;
                    const env = Math.sin(((i - 0.5) / segs) * Math.PI);
                    // 前景经过中央面部高度时自动轻薄柔化，保持角色面容通透
                    const centerPass = wantFront && Math.abs((x0 + x1) * 0.5 - cx) < 28 && (y0 + y1) * 0.5 < cy + 4;
                    const segFade = centerPass ? 0.28 : 1.0;
                    const w = (3.0 + 4.8 * env) * (wantFront ? 0.92 : 0.78);

                    ctx.strokeStyle = toRgba(st.outer, alpha * segFade * (wantFront ? 0.50 : 0.36));
                    ctx.lineWidth = w * 1.85;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();

                    ctx.strokeStyle = toRgba(st.mid, alpha * segFade * (wantFront ? 0.90 : 0.65));
                    ctx.lineWidth = w;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();

                    ctx.strokeStyle = toRgba(st.core, alpha * segFade * (wantFront ? 0.94 : 0.68));
                    ctx.lineWidth = Math.max(1.1, w * 0.34);
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y1);
                    ctx.stroke();
                  }
                }
                ctx.restore();
              }
            });

            kit.addCustomDrawable('back', buildHelixDrawer(false));
            kit.addCustomDrawable('front', buildHelixDrawer(true));
          }
        },
        {
          at: 160,
          fn() {
            for (let side = -1; side <= 1; side += 2) {
              kit.spawnBurstParticles(cx + side * 42 * ampScale, cy + 8, 12, 'petal', {
                colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#A7F3D0', '#FBCFE8'],
                color2: '#10B981',
                spdMin: 36, spdMax: 125, upBias: 92, gravity: -16, drag: 0.9,
                jitter: 22, sizeMin: 4.2, sizeMax: 7.6, lifeMin: 620, lifeMax: 1020
              });
              kit.spawnBurstParticles(cx + side * 46 * ampScale, cy + 12, 7, 'leaf', {
                colors: ['#CCFBF1', '#6EE7B7', '#34D399'], color2: '#059669',
                spdMin: 40, spdMax: 135, upBias: 82, gravity: -10, drag: 0.95,
                jitter: 20, sizeMin: 3.8, sizeMax: 6.8, lifeMin: 580, lifeMax: 960
              });
            }
          }
        },
        {
          at: 420,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 2.8, 120);

            kit.addStarFlare({
              x: cx, y: cy - 78 * ampScale, r0: 8, r1: 42 * ampScale, points: 6,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 480
            });
            kit.addStarFlare({
              x: cx - 54 * ampScale, y: cy - 18, r0: 5, r1: 24 * ampScale, points: 4,
              outerColor: '#34D399', coreColor: '#FFFFFF', dur: 420
            });
            kit.addStarFlare({
              x: cx + 54 * ampScale, y: cy - 22, r0: 5, r1: 24 * ampScale, points: 4,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: cx, y: gy + 4, r0: 16, r1: 112 * ampScale, sy: 0.29,
              color: '#10B981', coreColor: '#FEF9C3', lineW: 3.6, dur: 560
            });
            kit.addShockRing({
              x: cx, y: cy - 12, r0: 28, r1: 98 * ampScale, sy: 0.56,
              color: '#FDE68A', coreColor: '#FFFFFF', lineW: 2.6, dur: 480, layer: 'front'
            });
            for (let side = -1; side <= 1; side += 2) {
              kit.spawnBurstParticles(cx + side * 46 * ampScale, cy - 12, 11, 'petal', {
                colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#6EE7B7', '#FBCFE8'],
                color2: '#F59E0B',
                spdMin: 44, spdMax: 155, upBias: 88, gravity: -12, drag: 0.9,
                jitter: 20, sizeMin: 4.4, sizeMax: 7.8, lifeMin: 540, lifeMax: 880
              });
              kit.spawnBurstParticles(cx + side * 44 * ampScale, cy - 24, 8, 'star', {
                colors: ['#FFFFFF', '#FEF9C3', '#6EE7B7'],
                spdMin: 38, spdMax: 130, upBias: 60, gravity: -18,
                jitter: 18, sizeMin: 3.0, sizeMax: 6.0, lifeMin: 480, lifeMax: 780
              });
            }
          }
        }
      ]);
    },

    /* ==========================================================================
       7. 诺艾尔·星轨推演 (bond_noelle_calc)
       ========================================================================== */
    bond_noelle_calc(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const anchor = resolveSelfAnchor(o);
      const cx = anchor.x - dir * 4;
      const cy = anchor.y - 6;
      const gy = anchor.groundY;
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: cx, y: gy + 4, radius: 58 * ampScale, sy: 0.30,
              palette: 'silverIce', lineW: 2.4, dur: 1240, fadeIn: 140, fadeOut: 280
            });
            kit.spawnPfx('magic_circle_cast', { palette: kit.PALETTES.silverIce }, {
              x: cx, y: gy + 4, scale: 1.38 * ampScale,
              alpha: 0.36, preWarmSec: 0.85, timeScale: 1.75, durMs: 920,
              layer: 'back', glowColor: 'rgba(96,165,250,0.22)', glowRadius: 58, glowAlpha: 0.22
            });
          }
        },
        {
          at: 100,
          fn() {
            // 后景精密星象仪魔法阵（澄蓝×纯银同心刻度环，中心全透零遮脸）
            kit.addCustomDrawable('back', {
              dur: 1220,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.22, 0, 1));
                const exit = p > 0.76 ? clamp((1 - p) / 0.24, 0, 1) : 1;
                const alpha = exit * 0.94;
                if (alpha <= 0.02) return;

                const R = 78 * ampScale * enter;
                ctx.save();
                ctx.translate(cx, cy - 4);
                ctx.globalAlpha = alpha;

                // 环形外晕（中心 0..0.60 完全透明，角色零发白）
                const bg = ctx.createRadialGradient(0, 0, R * 0.56, 0, 0, R * 1.16);
                bg.addColorStop(0, 'rgba(219,234,254,0)');
                bg.addColorStop(0.62, 'rgba(37,99,235,0.16)');
                bg.addColorStop(1, 'rgba(37,99,235,0)');
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.arc(0, 0, R * 1.16, 0, TAU);
                ctx.fill();

                // 外圈精密刻度星轨
                ctx.save();
                ctx.rotate(p * 1.15);
                ctx.strokeStyle = '#2563EB';
                ctx.lineWidth = 2.6;
                ctx.beginPath();
                ctx.arc(0, 0, R, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(0, 0, R * 0.90, 0, TAU);
                ctx.stroke();

                // 24 处经纬刻度
                for (let i = 0; i < 24; i++) {
                  const a = (i / 24) * TAU;
                  const len = i % 3 === 0 ? 8 : 4;
                  ctx.strokeStyle = i % 3 === 0 ? '#FFFFFF' : '#93C5FD';
                  ctx.lineWidth = i % 3 === 0 ? 1.8 : 1.0;
                  ctx.beginPath();
                  ctx.moveTo(Math.cos(a) * (R * 0.90), Math.sin(a) * (R * 0.90));
                  ctx.lineTo(Math.cos(a) * (R * 0.90 + len), Math.sin(a) * (R * 0.90 + len));
                  ctx.stroke();
                }

                // 旋转内接正六边形
                ctx.strokeStyle = '#60A5FA';
                ctx.lineWidth = 1.6;
                drawRegularPoly(ctx, 0, 0, R * 0.85, 6, 0, 1);
                ctx.stroke();
                ctx.restore();

                // 反向双椭圆星轨 + 纯银星体节点
                for (let k = 0; k < 2; k++) {
                  const tilt = k === 0 ? -0.46 : 0.52;
                  const orbA = p * (k === 0 ? 4.4 : -3.8) + k * 1.8;
                  ctx.save();
                  ctx.rotate(tilt);
                  ctx.strokeStyle = k === 0 ? '#60A5FA' : '#93C5FD';
                  ctx.lineWidth = 1.6;
                  ctx.setLineDash([12, 6]);
                  ctx.beginPath();
                  ctx.ellipse(0, 0, R * 1.10, R * 0.36, 0, 0, TAU);
                  ctx.stroke();
                  ctx.setLineDash([]);

                  const nx = Math.cos(orbA) * R * 1.10;
                  const ny = Math.sin(orbA) * R * 0.36;
                  ctx.fillStyle = '#FFFFFF';
                  ctx.beginPath();
                  ctx.arc(nx, ny, 3.8, 0, TAU);
                  ctx.fill();
                  ctx.strokeStyle = '#2563EB';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.arc(nx, ny, 6.6, 0, TAU);
                  ctx.stroke();
                  ctx.restore();
                }

                ctx.restore();
              }
            });

            // 前景精密折光线 + 几何校准菱格（外括五边形环绕，零横穿面部）
            kit.addCustomDrawable('front', {
              dur: 1120,
              draw(ctx, p) {
                const drawP = easeOutCubic(clamp(p / 0.36, 0, 1));
                const exit = p > 0.72 ? clamp((1 - p) / 0.28, 0, 1) : 1;
                if (exit <= 0.02) return;

                const nodes = [
                  { x: cx - 72 * ampScale, y: cy - 42 * ampScale },
                  { x: cx + 8 * ampScale,  y: cy - 82 * ampScale },
                  { x: cx + 82 * ampScale, y: cy - 16 * ampScale },
                  { x: cx + 56 * ampScale, y: cy + 50 * ampScale },
                  { x: cx - 60 * ampScale, y: cy + 44 * ampScale }
                ];
                ctx.save();
                ctx.globalAlpha = exit * 0.92;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                // 折光线逐段连结
                const total = nodes.length;
                const progress = drawP * total;
                for (let i = 0; i < total; i++) {
                  if (progress <= i) break;
                  const segP = clamp(progress - i, 0, 1);
                  const a = nodes[i];
                  const b = nodes[(i + 1) % total];
                  const ex = lerp(a.x, b.x, segP);
                  const ey = lerp(a.y, b.y, segP);

                  ctx.strokeStyle = toRgba('#2563EB', 0.50);
                  ctx.lineWidth = 4.0;
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.lineTo(ex, ey);
                  ctx.stroke();

                  ctx.strokeStyle = '#93C5FD';
                  ctx.lineWidth = 2.0;
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.lineTo(ex, ey);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.0;
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.lineTo(ex, ey);
                  ctx.stroke();

                  // 折点菱形星标
                  ctx.fillStyle = '#FFFFFF';
                  drawDiamond(ctx, a.x, a.y, 4.0, 4.0);
                  ctx.fill();
                  ctx.strokeStyle = '#2563EB';
                  ctx.lineWidth = 1.3;
                  ctx.stroke();
                }

                // 精准校准脉冲（p ≈ 0.30~0.62）
                if (p > 0.30 && p < 0.62) {
                  const lockP = Math.sin(((p - 0.30) / 0.32) * Math.PI);
                  ctx.strokeStyle = toRgba('#FFFFFF', lockP * 0.88);
                  ctx.lineWidth = 1.6;
                  for (let i = 0; i < nodes.length; i++) {
                    const nd = nodes[i];
                    ctx.beginPath();
                    ctx.arc(nd.x, nd.y, 6 + (1 - lockP) * 9, 0, TAU);
                    ctx.stroke();
                  }
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 440,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 3.2, 130);

            kit.spawnPfx('time_stop', { palette: kit.PALETTES.silverIce }, {
              x: cx, y: gy + 4, scale: 1.24 * ampScale,
              alpha: 0.28, preWarmSec: 0.25, timeScale: 2.2, durMs: 740, layer: 'back'
            });

            kit.addStarFlare({
              x: cx + 8 * ampScale, y: cy - 82 * ampScale, r0: 6, r1: 38 * ampScale, points: 8,
              outerColor: '#60A5FA', coreColor: '#FFFFFF', dur: 460
            });
            kit.addStarFlare({
              x: cx - 72 * ampScale, y: cy - 42 * ampScale, r0: 5, r1: 24 * ampScale, points: 4,
              outerColor: '#93C5FD', coreColor: '#FFFFFF', dur: 420
            });
            kit.addStarFlare({
              x: cx + 82 * ampScale, y: cy - 16 * ampScale, r0: 5, r1: 26 * ampScale, points: 4,
              outerColor: '#3B82F6', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: cx, y: gy + 4, r0: 18, r1: 118 * ampScale, sy: 0.29,
              color: '#2563EB', coreColor: '#FFFFFF', lineW: 3.6, dur: 540
            });
            kit.spawnBurstParticles(cx, cy, 20, 'ringlet', {
              colors: ['#FFFFFF', '#DBEAFE', '#93C5FD'], color2: '#2563EB',
              spdMin: 38, spdMax: 135, upBias: 45, gravity: -16,
              sizeMin: 4.0, sizeMax: 7.5, lifeMin: 480, lifeMax: 820
            });
            kit.spawnBurstParticles(cx, cy - 10, 22, 'star', {
              colors: ['#FFFFFF', '#DBEAFE', '#60A5FA'],
              spdMin: 48, spdMax: 155, upBias: 55, gravity: -14,
              sizeMin: 3.0, sizeMax: 6.2, lifeMin: 460, lifeMax: 780
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       8. 艾诺·北境凛霜 (bond_aino_frost)
       ========================================================================== */
    bond_aino_frost(kit, o) {
      const { from, groundY, targets, ampScale } = o;
      const list = Array.isArray(targets) && targets.length ? targets : [resolveTargetAnchor(o)];
      const midX = list.reduce((s, t) => s + t.x, 0) / list.length;
      const midY = list.reduce((s, t) => s + t.y, 0) / list.length;
      const midGroundY = list.reduce((s, t) => s + (t.groundY || o.targetGroundY), 0) / list.length;
      const spanW = Math.max(150, (list[list.length - 1].x - list[0].x) + 120);
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;
      const pal = kit.PALETTES.silverIce;

      const cues = [
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: from.x - 8, y: groundY + 4, radius: 44 * ampScale, sy: 0.30,
              palette: 'silverIce', dur: 640
            });

            // 高空纯银冰雪冠冕（悬浮于敌阵正上方，晶莹对称）
            kit.addCustomDrawable('front', {
              dur: 1280,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.22, 0, 1));
                const exit = p > 0.76 ? clamp((1 - p) / 0.24, 0, 1) : 1;
                const alpha = exit * 0.96;
                if (alpha <= 0.02) return;

                const crownX = midX;
                const crownY = clamp(midY - 88 * ampScale, 46, 150) + Math.sin(p * 6.0) * 3.0;
                const sc = enter * ampScale;

                ctx.save();
                ctx.translate(crownX, crownY);
                ctx.scale(sc, sc);
                ctx.globalAlpha = alpha;

                // 冠冕背后银蓝圣晕
                const hg = ctx.createRadialGradient(0, 0, 4, 0, 0, 56);
                hg.addColorStop(0, 'rgba(248,250,252,0.72)');
                hg.addColorStop(0.5, 'rgba(147,197,253,0.34)');
                hg.addColorStop(1, 'rgba(59,130,246,0)');
                ctx.fillStyle = hg;
                ctx.beginPath();
                ctx.arc(0, 0, 56, 0, TAU);
                ctx.fill();

                // 底层银蓝椭环基座
                ctx.strokeStyle = '#3B82F6';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.ellipse(0, 12, 42, 10, 0, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.ellipse(0, 12, 40, 8.8, 0, 0, TAU);
                ctx.stroke();

                // 五枚对称纯银冰晶冠尖
                const spires = [
                  { x: -34, h: 24, w: 7 },
                  { x: -18, h: 34, w: 8 },
                  { x: 0,   h: 46, w: 11 },
                  { x: 18,  h: 34, w: 8 },
                  { x: 34,  h: 24, w: 7 }
                ];
                for (let i = 0; i < spires.length; i++) {
                  const sp = spires[i];
                  const g = ctx.createLinearGradient(sp.x, 12 - sp.h, sp.x, 12);
                  g.addColorStop(0, '#FFFFFF');
                  g.addColorStop(0.55, '#DBEAFE');
                  g.addColorStop(1, '#3B82F6');
                  ctx.fillStyle = g;
                  ctx.beginPath();
                  ctx.moveTo(sp.x, 12 - sp.h);
                  ctx.lineTo(sp.x + sp.w, 12);
                  ctx.lineTo(sp.x - sp.w, 12);
                  ctx.closePath();
                  ctx.fill();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.2;
                  ctx.stroke();
                }

                // 冠顶中央冰花星芒
                kit.drawStarFlare(ctx, 0, -34, 15 * (0.85 + 0.15 * Math.sin(p * 14)), 0.22, 6, p * 1.2, '#93C5FD', '#FFFFFF', alpha);
                ctx.restore();
              }
            });
          }
        },
        {
          at: 170,
          fn() {
            // 晶莹银蓝霜幕垂落
            kit.addCustomDrawable('back', {
              dur: 1120,
              draw(ctx, p) {
                const dropP = easeOutCubic(clamp(p / 0.28, 0, 1));
                const exit = p > 0.72 ? clamp((1 - p) / 0.28, 0, 1) : 1;
                if (exit <= 0.02) return;

                const topY = Math.max(34, midY - 90);
                const curBotY = lerp(topY + 12, midGroundY + 8, dropP);
                const leftX = midX - spanW * 0.5;

                ctx.save();
                ctx.globalAlpha = exit;
                // 轻透极光霜幕面纱
                const cg = ctx.createLinearGradient(0, topY, 0, curBotY);
                cg.addColorStop(0, 'rgba(248,250,252,0.34)');
                cg.addColorStop(0.45, 'rgba(147,197,253,0.22)');
                cg.addColorStop(1, 'rgba(59,130,246,0.04)');
                ctx.fillStyle = cg;
                ctx.fillRect(leftX, topY, spanW, curBotY - topY);

                // 10 道竖向晶莹冰棱垂丝
                for (let i = 0; i < 10; i++) {
                  const u = (i + 0.5) / 10;
                  const rx = leftX + u * spanW + Math.sin(p * 5 + i) * 3;
                  const shimmer = 0.5 + 0.5 * Math.sin(p * 12 + i * 1.3);
                  const lg = ctx.createLinearGradient(rx, topY, rx, curBotY);
                  lg.addColorStop(0, toRgba('#FFFFFF', 0.65 * shimmer));
                  lg.addColorStop(0.6, toRgba('#93C5FD', 0.35 * shimmer));
                  lg.addColorStop(1, 'rgba(96,165,250,0)');
                  ctx.strokeStyle = lg;
                  ctx.lineWidth = i % 2 === 0 ? 2.6 : 1.5;
                  ctx.beginPath();
                  ctx.moveTo(rx, topY);
                  ctx.lineTo(rx, curBotY);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });

            kit.spawnPfx('frost_nova', { palette: pal, reach: 102 }, {
              x: midX, y: midGroundY + 4, scale: 1.72 * ampScale,
              preWarmSec: 0.38, timeScale: 1.48, durMs: 960, layer: 'back'
            });
            kit.spawnPfx('snowflake_burst', { palette: pal, count: 11 }, {
              x: midX, y: midGroundY + 10, scale: 1.92 * ampScale,
              preWarmSec: 0.16, timeScale: 1.25, durMs: 1020, layer: 'front'
            });
          }
        }
      ];

      // 逐目标落霜共鸣
      for (let i = 0; i < list.length; i++) {
        const tg = list[i];
        const tGy = tg.groundY || o.targetGroundY;
        const isLast = i === list.length - 1;
        cues.push({
          at: 380 + i * 60,
          fn() {
            kit.safeCall(o.onImpact, i, tg, isLast);
            kit.safeCall(o.onShake, isLast ? 6.4 : 3.2, isLast ? 220 : 120);
            if (isLast) kit.safeCall(o.onHitStop, 48);

            kit.addShockRing({
              x: tg.x, y: tGy + 4, r0: 12, r1: 78 * ampScale, sy: 0.28,
              color: '#3B82F6', coreColor: '#FFFFFF', lineW: 3.4, dur: 460
            });
            kit.addStarFlare({
              x: tg.x, y: tg.y - 12, r0: 8, r1: 38 * ampScale, points: 6,
              outerColor: '#93C5FD', coreColor: '#FFFFFF', dur: 360
            });
            kit.spawnBurstParticles(tg.x, tg.y - 26, 16, 'snow', {
              colors: ['#FFFFFF', '#F8FAFC', '#DBEAFE', '#93C5FD'], color2: '#2563EB',
              spdMin: 26, spdMax: 115, upBias: 45, gravity: 24,
              sizeMin: 3.6, sizeMax: 7.2, lifeMin: 560, lifeMax: 860
            });
            kit.spawnBurstParticles(tg.x, tg.y, 10, 'shard', {
              palette: 'silverIce', spdMin: 60, spdMax: 175, upBias: 70,
              sizeMin: 3.0, sizeMax: 5.8, groundY: tGy, bounce: 0.35,
              lifeMin: 400, lifeMax: 680
            });
          }
        });
      }

      kit.scheduleTimeline(cues);
    },

    /* ==========================================================================
       9. 吉兰·紫电轻步 (bond_jilan_step)
       ========================================================================== */
    bond_jilan_step(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const dir = resolveDir(o);
      const { quadBezier } = kit.math;
      const pal = kit.PALETTES.jilanViolet;
      const p0 = { x: from.x - dir * 8, y: from.y + 8 };
      const p2 = { x: to.x - dir * 20, y: to.y + 4 };
      const p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 38 };
      const sprId = o.spriteId || 'jilan';

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: from.x, y: groundY + 4, radius: 42 * ampScale, sy: 0.30,
              palette: 'jilanViolet', dur: 520
            });
            kit.addShockRing({
              x: from.x, y: groundY + 4, r0: 10, r1: 58 * ampScale, sy: 0.28,
              color: '#6366F1', coreColor: '#E0E7FF', lineW: 3.4, dur: 320
            });
            kit.addStarFlare({
              x: from.x + dir * 8, y: from.y, r0: 6, r1: 32 * ampScale, points: 4,
              outerColor: '#A5B4FC', coreColor: '#FFFFFF', dur: 240
            });
          }
        },
        {
          at: 75,
          fn() {
            const ptsA = [];
            const ptsB = [];
            for (let i = 0; i <= 20; i++) {
              const t = i / 20;
              const bp = quadBezier(p0, p1, p2, t);
              const w = Math.sin(t * Math.PI * 3.0) * 12;
              ptsA.push({ x: bp.x, y: bp.y - 6 + w });
              ptsB.push({ x: bp.x, y: bp.y + 8 - w });
            }
            kit.addRibbon({
              pts: ptsA, width: 9.5 * ampScale, palette: 'jilanViolet',
              alpha: 0.92, dur: 640, fadeOut: 260
            });
            kit.addRibbon({
              pts: ptsB, width: 6.5 * ampScale,
              outerColor: '#6366F1', midColor: '#E0E7FF', coreColor: '#FFFFFF',
              alpha: 0.85, dur: 660, fadeOut: 260
            });
            kit.addLightning(p0.x, p0.y - 10, p2.x, p2.y - 10, {
              outerColor: '#4F46E5', midColor: '#C4B5FD', coreColor: '#FFFFFF',
              width: 2.0, jitter: 16, dur: 280, branches: 2
            });
          }
        },
        {
          at: 95,
          fn() {
            const pos = quadBezier(p0, p1, p2, 0.22);
            kit.addAfterimage({
              x: pos.x, y: groundY - 2, scale: 1.00, facing: dir,
              spriteId: sprId, palette: 'jilanViolet', alpha: 0.72, dur: 660
            });
          }
        },
        {
          at: 170,
          fn() {
            const pos = quadBezier(p0, p1, p2, 0.50);
            kit.addAfterimage({
              x: pos.x, y: groundY - 10, scale: 1.04, facing: dir,
              spriteId: sprId, palette: 'jilanViolet', alpha: 0.86, dur: 660
            });
          }
        },
        {
          at: 245,
          fn() {
            const pos = quadBezier(p0, p1, p2, 0.78);
            kit.addAfterimage({
              x: pos.x, y: groundY - 4, scale: 1.08, facing: dir,
              spriteId: sprId, palette: 'jilanViolet', alpha: 0.96, dur: 660
            });
          }
        },
        {
          at: 335,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 7.6 + amp * 1.8, 240);
            kit.safeCall(o.onHitStop, 58 + amp * 10);

            const swScale = 1.92 * ampScale;
            kit.spawnPfx('sword_slash', { palette: pal, sparks: kit.PALETTES.eclipseSpark, radius: 46 }, {
              x: to.x - dir * 24 * swScale, y: to.y + 36 * swScale,
              scale: swScale, flipX: dir < 0, durMs: 620, layer: 'front'
            });
            kit.spawnPfx('parry', { palette: pal, height: 28 }, {
              x: to.x, y: to.y + 42, scale: 1.54 * ampScale, durMs: 500, layer: 'front'
            });

            // 亮紫银星辉斩弧
            addDirectedSlash(kit, dir, {
              x: to.x, y: to.y,
              rx: 104 * ampScale, ry: 58 * ampScale,
              tilt: -0.36, startAngle: -2.55, endAngle: 0.88,
              thickness: 24 * ampScale, palette: 'jilanViolet', dur: 460
            });
            addDirectedSlash(kit, dir, {
              x: to.x + dir * 4, y: to.y - 4,
              rx: 88 * ampScale, ry: 46 * ampScale,
              tilt: 0.42, startAngle: 2.38, endAngle: -0.78,
              thickness: 16 * ampScale,
              outerColor: '#6366F1', midColor: '#C4B5FD', hiColor: '#FFFFFF', dur: 420
            });

            kit.addLightning(to.x - 42, to.y - 34, to.x + 44, to.y + 28, {
              outerColor: '#4F46E5', midColor: '#A5B4FC', coreColor: '#FFFFFF',
              width: 2.3, dur: 280, branches: 2
            });
            kit.addFlash(to.x, to.y, 54 * ampScale, '#A5B4FC', 155, 0.36);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 12, r1: 62 * ampScale, inner: 0.16, points: 8,
              outerColor: '#818CF8', coreColor: '#FFFFFF', dur: 400
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 14, r1: 112 * ampScale, sy: 0.28,
              color: '#6366F1', coreColor: '#E0E7FF', lineW: 3.8, dur: 480
            });

            kit.spawnBurstParticles(to.x, to.y, 18, 'ringlet', {
              colors: ['#FFFFFF', '#E0E7FF', '#A5B4FC'], color2: '#4F46E5',
              spdMin: 55, spdMax: 185, upBias: 55, gravity: -12,
              sizeMin: 4.0, sizeMax: 7.5, lifeMin: 440, lifeMax: 760
            });
            kit.spawnBurstParticles(to.x, to.y, 26, 'star', {
              colors: ['#FFFFFF', '#E0E7FF', '#A5B4FC', '#818CF8'],
              spdMin: 80, spdMax: 250, upBias: 60, gravity: 45,
              sizeMin: 3.2, sizeMax: 6.8, lifeMin: 420, lifeMax: 740
            });
            kit.spawnBurstParticles(to.x, to.y, 20, 'spark', {
              colors: ['#FFFFFF', '#E0E7FF', '#A5B4FC'],
              spdMin: 150, spdMax: 340, gravity: 110, sizeMin: 2.2, sizeMax: 4.2,
              lifeMin: 260, lifeMax: 480
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       10. 夏洛特·贵族礼赞 (bond_charlotte_noble)
       ========================================================================== */
    bond_charlotte_noble(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const anchor = resolveSelfAnchor(o);
      const cx = anchor.x - dir * 6;
      const cy = anchor.y - 2;
      const gy = anchor.groundY;
      const { clamp, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: cx, y: gy + 4, radius: 58 * ampScale, sy: 0.30,
              palette: 'gold', goldTriple: true, dur: 1240, fadeIn: 140, fadeOut: 280
            });
            kit.spawnPfx('magic_circle_cast', { palette: kit.PALETTES.gold }, {
              x: cx, y: gy + 4, scale: 1.40 * ampScale,
              alpha: 0.36, preWarmSec: 0.86, timeScale: 1.78, durMs: 920,
              layer: 'back', glowColor: 'rgba(253,230,138,0.24)', glowRadius: 62, glowAlpha: 0.24
            });
          }
        },
        {
          at: 110,
          fn() {
            // 香槟金皇家纹章光轮（背后盛开，中心透明留白，角色庄重璀璨零遮脸）
            kit.addCustomDrawable('back', {
              dur: 1220,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.24, 0, 1));
                const exit = p > 0.76 ? clamp((1 - p) / 0.24, 0, 1) : 1;
                const alpha = exit * 0.96;
                if (alpha <= 0.02) return;

                const R = 78 * ampScale * enter;
                ctx.save();
                ctx.translate(cx, cy - 8);
                ctx.globalAlpha = alpha;

                // 环形香槟金外圣晕（内芯 0..0.48 全透，绝不遮盖角色）
                const bg = ctx.createRadialGradient(0, 0, R * 0.48, 0, 0, R * 1.18);
                bg.addColorStop(0, 'rgba(254,249,195,0)');
                bg.addColorStop(0.55, 'rgba(251,191,36,0.22)');
                bg.addColorStop(1, 'rgba(245,158,11,0)');
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.arc(0, 0, R * 1.18, 0, TAU);
                ctx.fill();

                ctx.save();
                ctx.rotate(p * 0.85);
                // 皇家双金轮框
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 3.4;
                ctx.beginPath();
                ctx.arc(0, 0, R, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FEF9C3';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.arc(0, 0, R * 0.88, 0, TAU);
                ctx.stroke();

                // 12 道皇家玫瑰窗外圈金棱（从 0.56R 起笔，中心留白）
                for (let i = 0; i < 12; i++) {
                  const a = (i / 12) * TAU;
                  const len = i % 2 === 0 ? R * 0.98 : R * 0.84;
                  ctx.strokeStyle = i % 2 === 0 ? '#FDE68A' : '#F59E0B';
                  ctx.lineWidth = i % 2 === 0 ? 2.2 : 1.3;
                  ctx.beginPath();
                  ctx.moveTo(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56);
                  ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
                  ctx.stroke();

                  // 外轮棱钻纹章铆点
                  const mx = Math.cos(a) * (R * 1.07);
                  const my = Math.sin(a) * (R * 1.07);
                  ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#FDE68A';
                  drawDiamond(ctx, mx, my, i % 2 === 0 ? 4.4 : 2.8, i % 2 === 0 ? 4.4 : 2.8);
                  ctx.fill();
                }

                // 反向八角纹章星外框
                ctx.rotate(-p * 1.6);
                ctx.strokeStyle = toRgba('#FDE68A', 0.88);
                ctx.lineWidth = 1.8;
                drawRegularPoly(ctx, 0, 0, R * 0.82, 4, 0, 1);
                ctx.stroke();
                drawRegularPoly(ctx, 0, 0, R * 0.82, 4, Math.PI / 4, 1);
                ctx.stroke();
                ctx.restore();

                // 轮顶皇家小皇冠纹饰
                ctx.save();
                ctx.translate(0, -R - 10);
                ctx.fillStyle = '#FDE68A';
                ctx.strokeStyle = '#D97706';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(-14, 6);
                ctx.lineTo(-16, -6);
                ctx.lineTo(-6, 1);
                ctx.lineTo(0, -11);
                ctx.lineTo(6, 1);
                ctx.lineTo(16, -6);
                ctx.lineTo(14, 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();

                ctx.restore();
              }
            });

            kit.spawnPfx('divine_shield', { palette: kit.PALETTES.gold, radius: 33 }, {
              x: cx, y: cy + 44, scale: 1.66 * ampScale,
              alpha: 0.30, timeScale: 1.15, durMs: 1020, fadeInMs: 120, fadeOutMs: 260, layer: 'back'
            });

            // 前景镂空贵族冰金镜框 + 公转香槟金棱钻（角色零遮挡）
            kit.addCustomDrawable('front', {
              dur: 1040,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.22, 0, 1));
                const exit = p > 0.74 ? clamp((1 - p) / 0.26, 0, 1) : 1;
                const R = 64 * ampScale * enter;
                ctx.save();
                ctx.translate(cx, cy - 2);
                ctx.globalAlpha = exit * 0.94;

                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 2.8;
                drawRegularPoly(ctx, 0, 0, R, 8, Math.PI / 8, 1.04);
                ctx.stroke();

                ctx.strokeStyle = '#67E8F9';
                ctx.lineWidth = 1.5;
                drawRegularPoly(ctx, 0, 0, R * 0.92, 8, Math.PI / 8, 1.04);
                ctx.stroke();

                // 倾斜冰金公转轨与 4 枚棱钻
                ctx.rotate(-0.24);
                ctx.strokeStyle = '#FDE68A';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.ellipse(0, 0, R * 1.18, R * 0.28, 0, 0, TAU);
                ctx.stroke();
                for (let c = 0; c < 4; c++) {
                  const ca = p * 3.6 + (c / 4) * TAU;
                  const gx = Math.cos(ca) * R * 1.18;
                  const gyOff = Math.sin(ca) * R * 0.28;
                  ctx.fillStyle = c % 2 === 0 ? '#FEF9C3' : '#67E8F9';
                  drawDiamond(ctx, gx, gyOff, 4.6, 7.4);
                  ctx.fill();
                  ctx.strokeStyle = '#D97706';
                  ctx.lineWidth = 1.0;
                  ctx.stroke();
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 420,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 4.2, 160);

            kit.spawnPfx('parry', { palette: kit.PALETTES.gold7, height: 28 }, {
              x: cx, y: cy + 44, scale: 1.50 * ampScale, alpha: 0.42, durMs: 520, layer: 'back'
            });
            kit.addStarFlare({
              x: cx, y: cy - 86 * ampScale, r0: 10, r1: 52 * ampScale, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 480
            });
            kit.addStarFlare({
              x: cx - 70 * ampScale, y: cy - 8, r0: 6, r1: 30 * ampScale, points: 4,
              outerColor: '#FBBF24', coreColor: '#FFFFFF', dur: 440
            });
            kit.addStarFlare({
              x: cx + 70 * ampScale, y: cy - 8, r0: 6, r1: 30 * ampScale, points: 4,
              outerColor: '#FBBF24', coreColor: '#FFFFFF', dur: 440
            });
            kit.addShockRing({
              x: cx, y: cy - 4, r0: 54 * ampScale, r1: 122 * ampScale, sy: 0.96,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 3.6, dur: 500, layer: 'front'
            });
            kit.addShockRing({
              x: cx, y: gy + 4, r0: 18, r1: 114 * ampScale, sy: 0.29,
              color: '#FBBF24', coreColor: '#FFFFFF', lineW: 3.4, dur: 520
            });

            for (let side = -1; side <= 1; side += 2) {
              kit.spawnBurstParticles(cx + side * 46 * ampScale, cy - 10, 14, 'star', {
                colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#FBBF24', '#67E8F9'],
                spdMin: 60, spdMax: 195, upBias: 50, gravity: -12,
                jitter: 22, sizeMin: 3.6, sizeMax: 7.2, lifeMin: 500, lifeMax: 860
              });
              kit.spawnBurstParticles(cx + side * 42 * ampScale, cy - 18, 8, 'petal', {
                colors: ['#FEF9C3', '#FDE68A', '#FCD34D'], color2: '#D97706',
                spdMin: 44, spdMax: 145, upBias: 85, gravity: -10,
                jitter: 18, sizeMin: 4.2, sizeMax: 7.0, lifeMin: 500, lifeMax: 840
              });
            }
          }
        }
      ]);
    },

    /* ==========================================================================
       11. 弱点击破 + ONE MORE (fx_weakness_break)
       ========================================================================== */
    fx_weakness_break(kit, o) {
      const { ampScale } = o;
      const pos = resolveTargetAnchor(o);
      const gy = pos.groundY;
      const rawId = String(o.rawSkillId || '').toLowerCase();
      const isOneMore = !!(o.oneMore || rawId.includes('one_more') || rawId.includes('onemore'));
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, pos, true);
            kit.safeCall(o.onShake, isOneMore ? 11.2 : 9.0, 280);
            kit.safeCall(o.onHitStop, isOneMore ? 84 : 64);

            kit.spawnPfx('ice_shatter', { palette: isOneMore ? kit.PALETTES.iceGold : kit.PALETTES.ice }, {
              x: pos.x, y: gy - 2, scale: 1.90 * ampScale,
              preWarmSec: 0.36, timeScale: 1.68, durMs: 860, layer: 'main',
              glowColor: isOneMore ? 'rgba(253,230,138,0.44)' : 'rgba(56,189,248,0.46)',
              glowRadius: 68 * ampScale, glowAlpha: 0.42
            });
            kit.spawnPfx('crit_hit', { palette: isOneMore ? kit.PALETTES.gold : kit.PALETTES.ice, height: 26, aim: 0.1 }, {
              x: pos.x, y: pos.y + 34, scale: 1.80 * ampScale, durMs: 560, layer: 'front'
            });

            // 八角晶锁碎裂与飞散棱镜片
            kit.addCustomDrawable('front', {
              dur: 760,
              draw(ctx, p) {
                const fade = p > 0.62 ? clamp((1 - p) / 0.38, 0, 1) : 1;
                const spread = easeOutCubic(p);
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.globalAlpha = fade;

                // 飞裂的 8 枚晶莹多面碎片
                for (let i = 0; i < 8; i++) {
                  const a = (i / 8) * TAU + 0.22;
                  const dist = lerp(12, 86 * ampScale, spread);
                  const sx = Math.cos(a) * dist;
                  const sy = Math.sin(a) * dist * 0.88;
                  ctx.save();
                  ctx.translate(sx, sy);
                  ctx.rotate(a + p * 3.4 * (i % 2 === 0 ? 1 : -1));
                  const sz = (11.5 - spread * 4.5) * ampScale;
                  ctx.fillStyle = i % 2 === 0 ? '#67E8F9' : (isOneMore ? '#FDE68A' : '#BAE6FD');
                  ctx.beginPath();
                  ctx.moveTo(sz, 0);
                  ctx.lineTo(-sz * 0.35, -sz * 0.62);
                  ctx.lineTo(-sz * 0.85, sz * 0.15);
                  ctx.lineTo(0, sz * 0.58);
                  ctx.closePath();
                  ctx.fill();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.4;
                  ctx.stroke();
                  ctx.restore();
                }

                // 棱镜震环
                const pr = lerp(18, 102 * ampScale, spread);
                ctx.strokeStyle = toRgba('#38BDF8', (1 - spread) * 0.95);
                ctx.lineWidth = 4.2 * (1 - spread * 0.5);
                drawRegularPoly(ctx, 0, 0, pr, 8, p * 0.6, 0.92);
                ctx.stroke();
                ctx.strokeStyle = toRgba('#FFFFFF', (1 - spread) * 0.95);
                ctx.lineWidth = 1.8;
                drawRegularPoly(ctx, 0, 0, pr * 0.92, 8, -p * 0.5, 0.92);
                ctx.stroke();
                ctx.restore();
              }
            });

            kit.addFlash(pos.x, pos.y, 60 * ampScale, '#67E8F9', 165, 0.38);
            kit.addStarFlare({
              x: pos.x, y: pos.y, r0: 14, r1: 72 * ampScale, inner: 0.16, points: 8,
              outerColor: isOneMore ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 440
            });
            kit.addShockRing({
              x: pos.x, y: pos.y, r0: 14, r1: 108 * ampScale, sy: 0.90,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 4.0, dur: 460, layer: 'front'
            });
            kit.addShockRing({
              x: pos.x, y: gy + 4, r0: 16, r1: 126 * ampScale, sy: 0.28,
              color: '#1658EB', coreColor: '#67E8F9', lineW: 4.2, dur: 520
            });

            kit.spawnBurstParticles(pos.x, pos.y, 34, 'shard', {
              colors: isOneMore ? ['#FFFFFF', '#FEF9C3', '#FDE68A', '#67E8F9', '#38BDF8'] : ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'],
              color2: '#1658EB',
              spdMin: 110, spdMax: 320, upBias: 95, sizeMin: 3.8, sizeMax: 8.2,
              groundY: gy, bounce: 0.45, lifeMin: 460, lifeMax: 820
            });
            kit.spawnBurstParticles(pos.x, pos.y, 22, 'spark', {
              colors: ['#FFFFFF', '#67E8F9', '#FDE68A'],
              spdMin: 150, spdMax: 360, gravity: 110, sizeMin: 2.4, sizeMax: 4.6,
              lifeMin: 280, lifeMax: 520
            });
          }
        },
        {
          at: 140,
          fn() {
            if (!isOneMore) {
              kit.addShockRing({
                x: pos.x, y: pos.y, r0: 22, r1: 92 * ampScale, sy: 0.86,
                color: '#67E8F9', coreColor: '#FFFFFF', lineW: 2.8, dur: 420, layer: 'front'
              });
              return;
            }
            // ONE MORE 专属香槟金再动光冠！
            kit.addMagicCircle({
              x: pos.x, y: gy + 4, radius: 66 * ampScale, sy: 0.30,
              palette: 'gold', goldTriple: true, dur: 980, fadeIn: 100, fadeOut: 240
            });
            kit.spawnPfx('parry', { palette: kit.PALETTES.gold7, height: 30 }, {
              x: pos.x, y: pos.y + 42, scale: 1.66 * ampScale, durMs: 560, layer: 'front'
            });
            kit.addCustomDrawable('front', {
              dur: 980,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.22, 0, 1));
                const exit = p > 0.72 ? clamp((1 - p) / 0.28, 0, 1) : 1;
                const alpha = exit;
                if (alpha <= 0.02) return;

                const crownY = pos.y - 84 * ampScale - Math.sin(p * Math.PI) * 6;
                ctx.save();
                ctx.translate(pos.x, crownY);
                ctx.scale(enter * ampScale, enter * ampScale);
                ctx.globalAlpha = alpha;

                // 双层香槟金光冠环
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 3.8;
                ctx.beginPath();
                ctx.ellipse(0, 0, 52, 16, 0, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FEF9C3';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.ellipse(0, 0, 44, 13, 0, 0, TAU);
                ctx.stroke();

                // 冠顶 6 枚金芒星尖
                for (let i = 0; i < 6; i++) {
                  const a = (i / 6) * TAU + p * 2.4;
                  const gx = Math.cos(a) * 52;
                  const gyOff = Math.sin(a) * 16;
                  ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#FDE68A';
                  drawDiamond(ctx, gx, gyOff, 5.2, 6.4);
                  ctx.fill();
                }

                // 中央 ONE MORE 璀璨八角金星
                kit.drawStarFlare(ctx, 0, -10, 26 * (0.9 + 0.1 * Math.sin(p * 16)), 0.18, 8, p * 1.4, '#F59E0B', '#FFFFFF', alpha);
                ctx.restore();
              }
            });
            kit.addShockRing({
              x: pos.x, y: pos.y, r0: 26, r1: 128 * ampScale, sy: 0.92,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.0, dur: 540, layer: 'front'
            });
            kit.spawnBurstParticles(pos.x, pos.y - 24, 24, 'star', {
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#F59E0B'],
              spdMin: 60, spdMax: 210, upBias: 95, gravity: -15,
              sizeMin: 3.8, sizeMax: 7.6, lifeMin: 520, lifeMax: 860
            });
            kit.spawnBurstParticles(pos.x, pos.y - 12, 12, 'ringlet', {
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A'], color2: '#D97706',
              spdMin: 45, spdMax: 155, upBias: 60, gravity: -14,
              sizeMin: 4.5, sizeMax: 8.5, lifeMin: 480, lifeMax: 800
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       12. 暴击星爆 (fx_crit_starburst)
       ========================================================================== */
    fx_crit_starburst(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const pos = resolveTargetAnchor(o);
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, pos, true);
            kit.safeCall(o.onShake, 8.8, 220);
            kit.safeCall(o.onHitStop, 68);

            kit.spawnPfx('crit_hit', { palette: kit.PALETTES.gold, height: 26, aim: dir > 0 ? 0.14 : 3.0 }, {
              x: pos.x, y: pos.y + 34, scale: 1.92 * ampScale, durMs: 640, layer: 'front',
              glowColor: 'rgba(253,230,138,0.46)', glowRadius: 58 * ampScale, glowAlpha: 0.40
            });

            // 棱镜斜向闪裂 + 八角金白星芒裂纹
            kit.addCustomDrawable('front', {
              dur: 560,
              draw(ctx, p) {
                const pop = easeOutBack(clamp(p / 0.20, 0, 1));
                const fade = p > 0.55 ? clamp((1 - p) / 0.45, 0, 1) : 1;
                const ext = easeOutCubic(clamp(p / 0.26, 0, 1));
                const len = 114 * ampScale * ext;

                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.globalAlpha = fade;

                // 斜向棱镜闪裂光带（冰青×香槟金×纯白）
                ctx.save();
                ctx.rotate(-0.56 * dir);
                ctx.fillStyle = toRgba('#38BDF8', 0.55 * fade);
                ctx.beginPath();
                ctx.moveTo(-len, 0);
                ctx.lineTo(0, -10.5 * (1 - p * 0.55) * pop);
                ctx.lineTo(len, 0);
                ctx.lineTo(0, 10.5 * (1 - p * 0.55) * pop);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = toRgba('#FDE68A', 0.88 * fade);
                ctx.beginPath();
                ctx.moveTo(-len * 0.94, 0);
                ctx.lineTo(0, -6.5 * (1 - p * 0.5) * pop);
                ctx.lineTo(len * 0.94, 0);
                ctx.lineTo(0, 6.5 * (1 - p * 0.5) * pop);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(-len * 0.84, 0);
                ctx.lineTo(0, -2.8 * (1 - p * 0.4));
                ctx.lineTo(len * 0.84, 0);
                ctx.lineTo(0, 2.8 * (1 - p * 0.4));
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // 棱镜菱形震波外框
                const r = lerp(16, 86 * ampScale, easeOutCubic(p));
                ctx.strokeStyle = toRgba('#F59E0B', (1 - p) * 0.9);
                ctx.lineWidth = 3.2 * (1 - p * 0.5);
                drawRegularPoly(ctx, 0, 0, r, 4, p * 0.5, 1);
                ctx.stroke();
                ctx.strokeStyle = toRgba('#67E8F9', (1 - p) * 0.8);
                ctx.lineWidth = 1.8;
                drawRegularPoly(ctx, 0, 0, r * 0.82, 4, Math.PI / 4 - p * 0.4, 1);
                ctx.stroke();

                ctx.restore();
              }
            });

            kit.addFlash(pos.x, pos.y, 54 * ampScale, '#FDE68A', 145, 0.26);
            kit.addStarFlare({
              x: pos.x, y: pos.y, r0: 14, r1: 82 * ampScale, inner: 0.14, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 460
            });
            kit.addStarFlare({
              x: pos.x, y: pos.y, r0: 10, r1: 96 * ampScale, inner: 0.08, points: 4, rot: 0.32,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: pos.x, y: pos.y, r0: 10, r1: 94 * ampScale, sy: 0.88,
              color: '#F59E0B', coreColor: '#FFFFFF', lineW: 3.8, dur: 400, layer: 'front'
            });

            kit.spawnBurstParticles(pos.x, pos.y, 28, 'spark', {
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#F59E0B', '#67E8F9'],
              spdMin: 165, spdMax: 390, gravity: 95, sizeMin: 2.5, sizeMax: 4.8,
              lifeMin: 260, lifeMax: 520
            });
            kit.spawnBurstParticles(pos.x, pos.y, 26, 'star', {
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#67E8F9'],
              spdMin: 75, spdMax: 255, upBias: 40, gravity: 55,
              sizeMin: 3.2, sizeMax: 7.2, lifeMin: 400, lifeMax: 760
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       13. 格挡·失误 (fx_block_bad)
       ========================================================================== */
    fx_block_bad(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const pos = resolveSelfAnchor(o);
      const sx = pos.x + dir * 24;
      const sy = pos.y;
      const { clamp, lerp, easeOutCubic } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: sx, y: sy }, true);
            kit.safeCall(o.onShake, 4.0, 120);

            kit.spawnPfx('hit_spark', { palette: kit.PALETTES.silverIce, height: 22, aim: dir > 0 ? 3.0 : 0.14 }, {
              x: sx, y: sy + 28, scale: 1.08 * ampScale, alpha: 0.72, durMs: 360, layer: 'front'
            });

            // 清澈冰蓝微裂护弧涟漪（干净透亮，绝无泥灰脏感）
            kit.addCustomDrawable('front', {
              dur: 520,
              draw(ctx, p) {
                const fade = p > 0.52 ? clamp((1 - p) / 0.48, 0, 1) : 1;
                const r = lerp(24, 42 * ampScale, easeOutCubic(p));
                ctx.save();
                ctx.translate(sx, sy);
                ctx.scale(dir, 1);
                ctx.globalAlpha = fade * 0.88;

                // 外层清透微裂护弧
                ctx.strokeStyle = toRgba('#60A5FA', 0.85);
                ctx.lineWidth = 3.2 * (1 - p * 0.4);
                ctx.beginPath();
                ctx.arc(-10, 0, r, -0.92, -0.14);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-10, 0, r, 0.12, 0.92);
                ctx.stroke();

                // 清澈细微裂纹（冰蓝白）
                const cr = lerp(6, 20, easeOutCubic(p));
                ctx.strokeStyle = '#E0F7FF';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(r - 12, -2);
                ctx.lineTo(r - 12 - cr * 0.7, -cr * 0.55);
                ctx.moveTo(r - 12, 2);
                ctx.lineTo(r - 12 - cr * 0.85, cr * 0.45);
                ctx.moveTo(r - 12, 0);
                ctx.lineTo(r - 12 - cr * 0.4, -cr * 0.12);
                ctx.stroke();
                ctx.restore();
              }
            });

            kit.addShockRing({
              x: sx, y: sy, r0: 10, r1: 48 * ampScale, sy: 0.90,
              color: '#93C5FD', coreColor: '#FFFFFF', lineW: 2.4, dur: 380, layer: 'front'
            });
            kit.spawnBurstParticles(sx, sy, 12, 'drop', {
              colors: ['#FFFFFF', '#E0F7FF', '#93C5FD', '#60A5FA'], color2: '#2563EB',
              spdMin: 55, spdMax: 155, upBias: 35, gravity: 280,
              sizeMin: 2.6, sizeMax: 5.0, groundY: pos.groundY, bounce: 0.25,
              lifeMin: 320, lifeMax: 580
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       14. 格挡·良好 (fx_block_good)
       ========================================================================== */
    fx_block_good(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const pos = resolveSelfAnchor(o);
      const sx = pos.x + dir * 28;
      const sy = pos.y;
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: sx, y: sy }, true);
            kit.safeCall(o.onShake, 3.6, 130);
            kit.safeCall(o.onHitStop, 26);

            kit.spawnPfx('parry', { palette: kit.PALETTES.slash, height: 26 }, {
              x: sx, y: sy + 36, scale: 1.24 * ampScale, alpha: 0.78, durMs: 440, layer: 'front'
            });

            // 清爽冰青新月护弧
            kit.addCustomDrawable('front', {
              dur: 580,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.20, 0, 1));
                const fade = p > 0.58 ? clamp((1 - p) / 0.42, 0, 1) : 1;
                const R = 44 * ampScale * enter;
                ctx.save();
                ctx.translate(sx, sy);
                ctx.scale(dir, 1);
                ctx.globalAlpha = fade;

                // 冰青新月护盾实体（厚中尖端）
                const buildArc = (thick, rShift) => {
                  const segs = 20;
                  ctx.beginPath();
                  for (let i = 0; i <= segs; i++) {
                    const u = i / segs;
                    const a = lerp(-1.18, 1.18, u);
                    const rx = Math.cos(a) * (R + rShift) - 14;
                    const ry = Math.sin(a) * (R * 1.12 + rShift);
                    if (i === 0) ctx.moveTo(rx, ry);
                    else ctx.lineTo(rx, ry);
                  }
                  for (let i = segs; i >= 0; i--) {
                    const u = i / segs;
                    const a = lerp(-1.18, 1.18, u);
                    const w = thick * Math.sin(u * Math.PI);
                    const rx = Math.cos(a) * (R + rShift - w) - 14;
                    const ry = Math.sin(a) * (R * 1.12 + rShift - w * 0.7);
                    ctx.lineTo(rx, ry);
                  }
                  ctx.closePath();
                };

                ctx.fillStyle = '#0EA5E9';
                buildArc(14, 2);
                ctx.fill();

                ctx.fillStyle = '#67E8F9';
                buildArc(9.5, 0.8);
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                buildArc(4.2, 0);
                ctx.fill();
                ctx.restore();
              }
            });

            kit.addStarFlare({
              x: sx + dir * 18, y: sy, r0: 6, r1: 34 * ampScale, points: 4,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 320
            });
            kit.addShockRing({
              x: sx + dir * 10, y: sy, r0: 12, r1: 68 * ampScale, sy: 0.92,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.0, dur: 420, layer: 'front'
            });
            kit.spawnBurstParticles(sx + dir * 14, sy, 18, 'spark', {
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'],
              spdMin: 125, spdMax: 270, gravity: 120, sizeMin: 2.2, sizeMax: 4.2,
              lifeMin: 260, lifeMax: 480
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       15. 格挡·极佳 (fx_block_great)
       ========================================================================== */
    fx_block_great(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const pos = resolveSelfAnchor(o);
      const sx = pos.x + dir * 30;
      const sy = pos.y;
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: sx, y: sy }, true);
            kit.safeCall(o.onShake, 5.2, 160);
            kit.safeCall(o.onHitStop, 44);

            kit.spawnPfx('divine_shield', { palette: kit.PALETTES.silverIce, radius: 30 }, {
              x: sx - dir * 6, y: sy + 40, scale: 1.50 * ampScale,
              alpha: 0.56, durMs: 680, fadeInMs: 40, fadeOutMs: 200, layer: 'main'
            });
            kit.spawnPfx('parry', { palette: kit.PALETTES.slash, height: 28 }, {
              x: sx + dir * 6, y: sy + 40, scale: 1.54 * ampScale, durMs: 540, layer: 'front'
            });

            // 皇家蓝×纯银双环棱盾偏折
            kit.addCustomDrawable('front', {
              dur: 700,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.18, 0, 1));
                const fade = p > 0.62 ? clamp((1 - p) / 0.38, 0, 1) : 1;
                const R = 48 * ampScale * enter;

                ctx.save();
                ctx.translate(sx + dir * 8, sy);
                ctx.scale(dir, 1);
                ctx.globalAlpha = fade;

                // 透亮六棱冰镜面（横向微透视）
                ctx.save();
                ctx.scale(0.54, 1);
                const bg = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
                bg.addColorStop(0, 'rgba(248,250,252,0.48)');
                bg.addColorStop(0.55, 'rgba(56,189,248,0.28)');
                bg.addColorStop(1, 'rgba(22,88,235,0.45)');
                ctx.fillStyle = bg;
                drawRegularPoly(ctx, 0, 0, R, 6, Math.PI / 6, 1);
                ctx.fill();

                // 外环：皇家蓝
                ctx.strokeStyle = '#1658EB';
                ctx.lineWidth = 4.6;
                ctx.beginPath();
                ctx.arc(0, 0, R * 1.12, 0, TAU);
                ctx.stroke();

                // 内环：纯银高速反旋虚线环
                ctx.rotate(p * 3.8);
                ctx.strokeStyle = '#F8FAFC';
                ctx.lineWidth = 2.6;
                ctx.setLineDash([14, 8]);
                ctx.beginPath();
                ctx.arc(0, 0, R * 0.90, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.strokeStyle = '#67E8F9';
                ctx.lineWidth = 2.0;
                drawRegularPoly(ctx, 0, 0, R, 6, Math.PI / 6, 1);
                ctx.stroke();
                ctx.restore();

                // 上下偏折折光束
                const rayLen = lerp(18, 62 * ampScale, easeOutCubic(p));
                ctx.strokeStyle = toRgba('#FFFFFF', fade * 0.92);
                ctx.lineWidth = 2.4 * (1 - p * 0.5);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(8, -6);
                ctx.lineTo(8 + rayLen * 0.72, -rayLen * 0.75);
                ctx.moveTo(8, 6);
                ctx.lineTo(8 + rayLen * 0.72, rayLen * 0.75);
                ctx.stroke();
                ctx.restore();
              }
            });

            kit.addStarFlare({
              x: sx + dir * 12, y: sy, r0: 8, r1: 48 * ampScale, points: 6,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: sx + dir * 10, y: sy, r0: 14, r1: 88 * ampScale, sy: 0.92,
              color: '#1658EB', coreColor: '#FFFFFF', lineW: 3.6, dur: 460, layer: 'front'
            });
            kit.addShockRing({
              x: sx + dir * 10, y: sy, r0: 10, r1: 68 * ampScale, sy: 0.92,
              color: '#93C5FD', coreColor: '#F8FAFC', lineW: 2.6, dur: 400, layer: 'front'
            });

            kit.spawnBurstParticles(sx + dir * 12, sy, 22, 'shard', {
              palette: 'silverIce', spdMin: 85, spdMax: 245, upBias: 60,
              sizeMin: 3.0, sizeMax: 6.4, groundY: pos.groundY, bounce: 0.35,
              lifeMin: 400, lifeMax: 700
            });
            kit.spawnBurstParticles(sx + dir * 12, sy, 18, 'spark', {
              colors: ['#FFFFFF', '#DBEAFE', '#67E8F9', '#38BDF8'],
              spdMin: 140, spdMax: 320, gravity: 110, sizeMin: 2.4, sizeMax: 4.4,
              lifeMin: 260, lifeMax: 480
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       16. 格挡·完美弹反 (fx_block_perfect)
       ========================================================================== */
    fx_block_perfect(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const pos = resolveSelfAnchor(o);
      const sx = pos.x + dir * 32;
      const sy = pos.y;
      const gy = pos.groundY;
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: sx, y: sy }, true);
            kit.safeCall(o.onShake, 7.8, 240);
            kit.safeCall(o.onHitStop, 76);

            kit.spawnPfx('parry', { palette: kit.PALETTES.gold7, height: 30 }, {
              x: sx + dir * 6, y: sy + 42, scale: 1.88 * ampScale, durMs: 640, layer: 'front',
              glowColor: 'rgba(253,230,138,0.48)', glowRadius: 60 * ampScale, glowAlpha: 0.44
            });
            kit.spawnPfx('crit_hit', { palette: kit.PALETTES.iceGold, height: 28, aim: dir > 0 ? 0.08 : 3.06 }, {
              x: sx + dir * 10, y: sy + 38, scale: 1.56 * ampScale, durMs: 520, layer: 'front'
            });

            // 香槟金×冰青六棱圣盾反震
            kit.addCustomDrawable('front', {
              dur: 840,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.16, 0, 1));
                const fade = p > 0.64 ? clamp((1 - p) / 0.36, 0, 1) : 1;
                const R = 56 * ampScale * enter;

                ctx.save();
                ctx.translate(sx + dir * 8, sy);
                ctx.scale(dir, 1);
                ctx.globalAlpha = fade;

                // 立体六棱圣盾主体
                ctx.save();
                ctx.scale(0.60, 1);
                const g = ctx.createRadialGradient(0, 0, 6, 0, 0, R);
                g.addColorStop(0, 'rgba(255,255,255,0.52)');
                g.addColorStop(0.48, 'rgba(103,232,249,0.30)');
                g.addColorStop(0.84, 'rgba(253,230,138,0.44)');
                g.addColorStop(1, 'rgba(245,158,11,0.58)');
                ctx.fillStyle = g;
                drawRegularPoly(ctx, 0, 0, R, 6, Math.PI / 6, 1);
                ctx.fill();

                // 内部六棱晶格
                ctx.strokeStyle = '#67E8F9';
                ctx.lineWidth = 2.0;
                drawRegularPoly(ctx, 0, 0, R * 0.64, 6, Math.PI / 6, 1);
                ctx.stroke();
                for (let i = 0; i < 6; i++) {
                  const a = (i / 6) * TAU + Math.PI / 6;
                  ctx.beginPath();
                  ctx.moveTo(Math.cos(a) * R * 0.64, Math.sin(a) * R * 0.64);
                  ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
                  ctx.stroke();
                }

                // 外框香槟金圣盾边框
                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 4.6;
                drawRegularPoly(ctx, 0, 0, R, 6, Math.PI / 6, 1);
                ctx.stroke();

                ctx.strokeStyle = '#FEF9C3';
                ctx.lineWidth = 2.0;
                drawRegularPoly(ctx, 0, 0, R * 1.07, 6, Math.PI / 6, 1);
                ctx.stroke();

                // 旋转圣光环
                ctx.rotate(p * 3.2);
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.8;
                ctx.setLineDash([16, 10]);
                ctx.beginPath();
                ctx.arc(0, 0, R * 1.22, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                // 反震定向冲击锥
                const coneP = easeOutCubic(clamp(p / 0.45, 0, 1));
                const cxOff = lerp(12, 54 * ampScale, coneP);
                ctx.strokeStyle = toRgba('#FDE68A', (1 - coneP) * 0.95);
                ctx.lineWidth = 4.5 * (1 - coneP * 0.5);
                ctx.beginPath();
                ctx.arc(cxOff - 24, 0, 38 + coneP * 42, -0.82, 0.82);
                ctx.stroke();
                ctx.strokeStyle = toRgba('#67E8F9', (1 - coneP) * 0.9);
                ctx.lineWidth = 2.6 * (1 - coneP * 0.5);
                ctx.beginPath();
                ctx.arc(cxOff - 14, 0, 28 + coneP * 54, -0.70, 0.70);
                ctx.stroke();
                ctx.restore();
              }
            });

            // 双重冲击环 + 地面金青环
            kit.addShockRing({
              x: sx + dir * 10, y: sy, r0: 16, r1: 118 * ampScale, sy: 0.94,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.4, dur: 520, layer: 'front'
            });
            kit.addShockRing({
              x: sx + dir * 10, y: sy, r0: 10, r1: 92 * ampScale, sy: 0.94,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.2, dur: 460, layer: 'front'
            });
            kit.addShockRing({
              x: pos.x + dir * 12, y: gy + 4, r0: 18, r1: 124 * ampScale, sy: 0.28,
              color: '#F59E0B', coreColor: '#FFFFFF', lineW: 3.8, dur: 540
            });

            kit.addFlash(sx + dir * 10, sy, 62 * ampScale, '#FDE68A', 160, 0.40);
            kit.addStarFlare({
              x: sx + dir * 12, y: sy, r0: 14, r1: 72 * ampScale, inner: 0.14, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 440
            });
            kit.addStarFlare({
              x: sx + dir * 12, y: sy, r0: 10, r1: 92 * ampScale, inner: 0.08, points: 4, rot: 0.25,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 380
            });

            // 两道金青弹反电弧
            kit.addLightning(sx + dir * 8, sy - 34, sx + dir * 68, sy - 52, {
              outerColor: '#D97706', midColor: '#FDE68A', coreColor: '#FFFFFF',
              width: 2.2, dur: 260, branches: 2
            });
            kit.addLightning(sx + dir * 8, sy + 30, sx + dir * 68, sy + 48, {
              outerColor: '#1658EB', midColor: '#67E8F9', coreColor: '#FFFFFF',
              width: 2.0, dur: 260, branches: 1
            });

            kit.spawnBurstParticles(sx + dir * 12, sy, 30, 'star', {
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#67E8F9', '#38BDF8'],
              spdMin: 85, spdMax: 270, upBias: 45, gravity: 35,
              sizeMin: 3.4, sizeMax: 7.4, lifeMin: 460, lifeMax: 840
            });
            kit.spawnBurstParticles(sx + dir * 12, sy, 24, 'spark', {
              colors: ['#FFFFFF', '#FEF9C3', '#F59E0B', '#67E8F9'],
              spdMin: 165, spdMax: 380, gravity: 100, sizeMin: 2.4, sizeMax: 4.6,
              lifeMin: 280, lifeMax: 520
            });
          }
        },
        {
          at: 180,
          fn() {
            kit.addShockRing({
              x: sx + dir * 12, y: sy, r0: 28, r1: 132 * ampScale, sy: 0.94,
              color: '#FDE68A', coreColor: '#FFFFFF', lineW: 2.8, dur: 440, layer: 'front'
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       17. 护盾承伤 / 碎盾 (fx_shield_hit)
       ========================================================================== */
    fx_shield_hit(kit, o) {
      const { ampScale } = o;
      const dir = resolveDir(o);
      const pos = resolveSelfAnchor(o);
      const gy = pos.groundY;
      const rawId = String(o.rawSkillId || '').toLowerCase();
      const shattered = !!(o.shattered || rawId.includes('shatter') || rawId.includes('break'));
      const { clamp, lerp, easeOutCubic } = kit.math;
      const { toRgba } = kit.color;

      if (shattered) {
        // 碎盾模式：晶莹冰玻璃全景碎散
        const rng = kit.makeRng(kit.nextSeed());
        const panes = [];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + (rng() - 0.5) * 0.25;
          panes.push({
            a,
            r0: 14 + rng() * 34,
            spd: 76 + rng() * 145,
            rot0: rng() * TAU,
            vrot: (rng() - 0.5) * 8.5,
            w: (10 + rng() * 10) * ampScale,
            h: (7 + rng() * 9) * ampScale,
            tint: i % 3 === 0 ? '#E0F7FF' : (i % 3 === 1 ? '#67E8F9' : '#BAE6FD')
          });
        }

        kit.scheduleTimeline([
          {
            at: 0,
            fn() {
              kit.safeCall(o.onImpact, 0, pos, true);
              kit.safeCall(o.onShake, 8.4, 240);
              kit.safeCall(o.onHitStop, 62);

              kit.spawnPfx('ice_shatter', { palette: kit.PALETTES.ice }, {
                x: pos.x, y: gy - 2, scale: 1.84 * ampScale,
                preWarmSec: 0.34, timeScale: 1.68, durMs: 840, layer: 'main',
                glowColor: 'rgba(103,232,249,0.44)', glowRadius: 62 * ampScale, glowAlpha: 0.38
              });

              kit.addCustomDrawable('front', {
                dur: 860,
                draw(ctx, p) {
                  const fade = p > 0.62 ? clamp((1 - p) / 0.38, 0, 1) : 1;
                  ctx.save();
                  ctx.translate(pos.x, pos.y);
                  ctx.globalAlpha = fade;

                  // 初瞬冰盾龟裂白闪 (0 ~ 0.16)
                  if (p < 0.18) {
                    const crP = p / 0.18;
                    const R = 56 * ampScale * (1 + crP * 0.08);
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 3.0;
                    drawRegularPoly(ctx, 0, 0, R, 8, Math.PI / 8, 1.04);
                    ctx.stroke();
                    for (let k = 0; k < 6; k++) {
                      const a = (k / 6) * TAU + 0.3;
                      ctx.beginPath();
                      ctx.moveTo(0, 0);
                      ctx.lineTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55);
                      ctx.lineTo(Math.cos(a + 0.18) * R, Math.sin(a + 0.18) * R);
                      ctx.stroke();
                    }
                  }

                  // 14 枚晶莹冰玻璃多面体全景碎散
                  const flyP = easeOutCubic(clamp((p - 0.04) / 0.96, 0, 1));
                  const gravY = p * p * 74;
                  for (let i = 0; i < panes.length; i++) {
                    const pn = panes[i];
                    const dist = pn.r0 + pn.spd * flyP;
                    const px = Math.cos(pn.a) * dist;
                    const py = Math.sin(pn.a) * dist * 0.92 + gravY;
                    ctx.save();
                    ctx.translate(px, py);
                    ctx.rotate(pn.rot0 + pn.vrot * p);
                    ctx.fillStyle = toRgba(pn.tint, 0.72 * fade);
                    ctx.beginPath();
                    ctx.moveTo(pn.w * 0.65, 0);
                    ctx.lineTo(0, -pn.h * 0.58);
                    ctx.lineTo(-pn.w * 0.55, pn.h * 0.15);
                    ctx.lineTo(pn.w * 0.1, pn.h * 0.55);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.4;
                    ctx.stroke();
                    ctx.restore();
                  }
                  ctx.restore();
                }
              });

              kit.addFlash(pos.x, pos.y, 58 * ampScale, '#67E8F9', 155, 0.38);
              kit.addStarFlare({
                x: pos.x, y: pos.y, r0: 12, r1: 58 * ampScale, points: 8,
                outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 360
              });
              kit.addShockRing({
                x: pos.x, y: pos.y, r0: 20, r1: 112 * ampScale, sy: 0.96,
                color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.8, dur: 480, layer: 'front'
              });

              kit.spawnBurstParticles(pos.x, pos.y, 34, 'shard', {
                colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'], color2: '#1658EB',
                spdMin: 105, spdMax: 300, upBias: 90, sizeMin: 3.6, sizeMax: 8.0,
                groundY: gy, bounce: 0.45, lifeMin: 460, lifeMax: 840
              });
              kit.spawnBurstParticles(pos.x, pos.y - 10, 16, 'snow', {
                colors: ['#FFFFFF', '#E0F7FF'], color2: '#38BDF8',
                spdMin: 30, spdMax: 110, upBias: 50, gravity: 24,
                sizeMin: 3.0, sizeMax: 5.8, lifeMin: 420, lifeMax: 740
              });
            }
          }
        ]);
        return;
      }

      // 承伤模式：棱面冰盾波纹吸伤
      const hitX = pos.x + dir * 26;
      const hitY = pos.y - 2;
      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: hitX, y: hitY }, true);
            kit.safeCall(o.onShake, 3.8, 130);

            kit.spawnPfx('divine_shield', { palette: kit.PALETTES.shield, radius: 32 }, {
              x: pos.x, y: pos.y + 42, scale: 1.66 * ampScale,
              alpha: 0.42, durMs: 740, fadeInMs: 30, fadeOutMs: 220, layer: 'back'
            });
            kit.spawnPfx('hit_spark', { palette: kit.PALETTES.slash, height: 22, aim: dir > 0 ? 3.0 : 0.14 }, {
              x: hitX, y: hitY + 28, scale: 1.24 * ampScale, alpha: 0.84, durMs: 380, layer: 'front'
            });

            // 棱面蜂巢冰盾波纹吸伤层
            kit.addCustomDrawable('front', {
              dur: 720,
              draw(ctx, p) {
                const fade = p > 0.58 ? clamp((1 - p) / 0.42, 0, 1) : 1;
                const R = 58 * ampScale;
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.globalAlpha = fade;

                // 轻薄八角棱镜外框（保持角色面部清晰通透）
                ctx.strokeStyle = toRgba('#38BDF8', 0.90 * fade);
                ctx.lineWidth = 2.8;
                drawRegularPoly(ctx, 0, 0, R, 8, Math.PI / 8, 1.04);
                ctx.stroke();

                ctx.strokeStyle = toRgba('#FDE68A', 0.76 * fade);
                ctx.lineWidth = 1.6;
                drawRegularPoly(ctx, 0, 0, R * 1.05, 8, Math.PI / 8, 1.04);
                ctx.stroke();

                // 剪裁至盾面内部，展示 3 层吸伤折射波纹 + 棱面晶格点亮
                ctx.save();
                drawRegularPoly(ctx, 0, 0, R, 8, Math.PI / 8, 1.04);
                ctx.clip();

                const lx = dir * 28;
                for (let k = 0; k < 3; k++) {
                  const rp = easeOutCubic(clamp((p - k * 0.10) / 0.74, 0, 1));
                  if (rp <= 0.01) continue;
                  const rad = lerp(10, R * 1.75, rp);
                  ctx.strokeStyle = k === 0 ? toRgba('#FFFFFF', (1 - rp) * 0.96) : toRgba('#38BDF8', (1 - rp) * 0.94);
                  ctx.lineWidth = (4.6 - k * 0.8) * (1 - rp * 0.42);
                  ctx.beginPath();
                  ctx.arc(lx, -2, rad, 0, TAU);
                  ctx.stroke();
                }

                // 撞击处亮起 4 枚棱面六角格（集中在迎敌侧，不挡面部）
                const hexPulse = Math.sin(clamp(p / 0.62, 0, 1) * Math.PI);
                if (hexPulse > 0.02) {
                  const cells = [
                    { x: lx - dir * 2,  y: -2 },
                    { x: lx - dir * 14, y: -20 },
                    { x: lx - dir * 14, y: 16 },
                    { x: lx + dir * 8,  y: -14 }
                  ];
                  for (let c = 0; c < cells.length; c++) {
                    ctx.fillStyle = toRgba('#67E8F9', hexPulse * 0.42);
                    ctx.strokeStyle = toRgba('#FFFFFF', hexPulse * 0.96);
                    ctx.lineWidth = 1.8;
                    drawRegularPoly(ctx, cells[c].x, cells[c].y, 13 * ampScale, 6, 0, 1);
                    ctx.fill();
                    ctx.stroke();
                  }
                }
                ctx.restore();
                ctx.restore();
              }
            });

            kit.addStarFlare({
              x: hitX, y: hitY, r0: 6, r1: 34 * ampScale, points: 4,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 320
            });
            kit.addShockRing({
              x: hitX, y: hitY, r0: 8, r1: 64 * ampScale, sy: 0.90,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.2, dur: 420, layer: 'front'
            });
            kit.spawnBurstParticles(hitX, hitY, 14, 'star', {
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#FDE68A'],
              spdMin: 55, spdMax: 175, upBias: 35, gravity: 45,
              sizeMin: 2.8, sizeMax: 5.8, lifeMin: 340, lifeMax: 620
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       18. 翠玉治疗回血 (fx_heal_emerald)
       ========================================================================== */
    fx_heal_emerald(kit, o) {
      const { ampScale } = o;
      const pos = resolveSelfAnchor(o);
      const cx = pos.x;
      const cy = pos.y;
      const gy = pos.groundY;
      const { clamp, lerp, easeOutCubic } = kit.math;
      const { toRgba } = kit.color;

      const emitFlankingCrosses = (countPerSide, baseY, sizeMin, sizeMax, lifeMin, lifeMax) => {
        for (let side = -1; side <= 1; side += 2) {
          kit.spawnBurstParticles(cx + side * 42 * ampScale, baseY, countPerSide, 'cross', {
            colors: ['#FFFFFF', '#ECFDF5', '#A7F3D0', '#34D399'], color2: '#059669',
            spdMin: 12, spdMax: 44, upBias: 76, gravity: -38, drag: 0.85,
            jitter: 22, sizeMin, sizeMax, lifeMin, lifeMax
          });
        }
      };

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, pos, true);

            kit.addMagicCircle({
              x: cx, y: gy + 4, radius: 54 * ampScale, sy: 0.30,
              palette: 'heal', dur: 1120, fadeIn: 140, fadeOut: 280
            });
            kit.spawnPfx('magic_circle_cast', { palette: kit.PALETTES.heal }, {
              x: cx, y: gy + 4, scale: 1.32 * ampScale,
              alpha: 0.36, preWarmSec: 0.86, timeScale: 1.65, durMs: 900,
              layer: 'back', glowColor: 'rgba(52,211,153,0.26)', glowRadius: 56, glowAlpha: 0.24
            });

            // 后景轻盈通透翠玉光柱（边缘澄亮、中心极淡，绝不遮盖角色面部）
            kit.addCustomDrawable('back', {
              dur: 1140,
              draw(ctx, p) {
                const enter = easeOutCubic(clamp(p / 0.22, 0, 1));
                const exit = p > 0.68 ? clamp((1 - p) / 0.32, 0, 1) : 1;
                const alpha = enter * exit;
                if (alpha <= 0.02) return;

                const colW = 92 * ampScale * (0.88 + 0.12 * Math.sin(p * 6));
                const colH = 165 * ampScale;
                ctx.save();
                ctx.globalAlpha = alpha;

                const vg = ctx.createLinearGradient(cx, gy + 4, cx, gy - colH);
                vg.addColorStop(0, 'rgba(16,185,129,0.28)');
                vg.addColorStop(0.45, 'rgba(110,231,183,0.16)');
                vg.addColorStop(1, 'rgba(236,253,245,0)');
                ctx.fillStyle = vg;
                ctx.fillRect(cx - colW * 0.5, gy - colH, colW, colH + 4);

                // 轻柔升腾竖向玉光丝（偏于光柱双侧）
                const lanes = [-0.46, -0.32, -0.18, 0.18, 0.32, 0.46];
                for (let i = 0; i < lanes.length; i++) {
                  const lx = cx + lanes[i] * colW;
                  const phase = ((p * 1.6 + i * 0.23) % 1);
                  const lyBot = gy - phase * colH * 0.55;
                  const lyTop = lyBot - 48 * ampScale;
                  const lg = ctx.createLinearGradient(lx, lyBot, lx, lyTop);
                  lg.addColorStop(0, 'rgba(236,253,245,0)');
                  lg.addColorStop(0.5, toRgba('#A7F3D0', 0.68 * Math.sin(phase * Math.PI)));
                  lg.addColorStop(1, 'rgba(255,255,255,0)');
                  ctx.strokeStyle = lg;
                  ctx.lineWidth = 2.0;
                  ctx.beginPath();
                  ctx.moveTo(lx, lyBot);
                  ctx.lineTo(lx, lyTop);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });

            // 前景三道缓缓升腾的水玉柔光环
            kit.addCustomDrawable('front', {
              dur: 1080,
              draw(ctx, p) {
                ctx.save();
                for (let k = 0; k < 3; k++) {
                  const rp = clamp((p - k * 0.16) / 0.64, 0, 1);
                  if (rp <= 0.01 || rp >= 0.99) continue;
                  const alpha = Math.sin(rp * Math.PI) * 0.85;
                  const ry = lerp(gy - 4, gy - 114 * ampScale, easeOutCubic(rp));
                  const rad = (48 + Math.sin(rp * Math.PI) * 14) * ampScale;

                  ctx.globalAlpha = alpha;
                  ctx.strokeStyle = k % 2 === 0 ? '#34D399' : '#A7F3D0';
                  ctx.lineWidth = 3.0 * (1 - rp * 0.35);
                  ctx.beginPath();
                  ctx.ellipse(cx, ry, rad, rad * 0.26, 0, 0, TAU);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.2;
                  ctx.beginPath();
                  ctx.ellipse(cx, ry, rad * 0.96, rad * 0.24, 0, 0, TAU);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 70,
          fn() {
            emitFlankingCrosses(6, gy - 14, 4.4, 7.6, 640, 980);
          }
        },
        {
          at: 260,
          fn() {
            emitFlankingCrosses(7, cy + 12, 4.8, 8.2, 600, 920);
            for (let side = -1; side <= 1; side += 2) {
              kit.spawnBurstParticles(cx + side * 44 * ampScale, cy, 7, 'star', {
                colors: ['#FFFFFF', '#ECFDF5', '#6EE7B7'],
                spdMin: 22, spdMax: 80, upBias: 65, gravity: -28,
                jitter: 22, sizeMin: 2.8, sizeMax: 5.4, lifeMin: 540, lifeMax: 860
              });
            }
          }
        },
        {
          at: 440,
          fn() {
            kit.addStarFlare({
              x: cx, y: cy - 76 * ampScale, r0: 6, r1: 36 * ampScale, points: 4,
              outerColor: '#6EE7B7', coreColor: '#FFFFFF', dur: 460
            });
            kit.addShockRing({
              x: cx, y: gy + 4, r0: 16, r1: 106 * ampScale, sy: 0.28,
              color: '#34D399', coreColor: '#ECFDF5', lineW: 3.4, dur: 520
            });
            emitFlankingCrosses(5, cy - 8, 4.4, 7.4, 520, 780);
          }
        }
      ]);
    },

    /* ==========================================================================
       19. 魔战循环回蓝 (fx_mana_cycle_flow)
       ========================================================================== */
    fx_mana_cycle_flow(kit, o) {
      const { from, to, groundY, ampScale } = o;
      const src = { x: to.x, y: to.y };
      const dst = { x: from.x, y: from.y };
      const { clamp, lerp, easeInOutSine, quadBezier } = kit.math;
      const { toRgba } = kit.color;
      const flowMs = 430;
      const midX = (src.x + dst.x) * 0.5;
      const ctrlHigh = { x: midX, y: Math.min(src.y, dst.y) - 72 };
      const ctrlLow = { x: midX, y: Math.max(src.y, dst.y) + 52 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addStarFlare({
              x: src.x, y: src.y, r0: 6, r1: 32 * ampScale, points: 4,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 280
            });
            kit.addShockRing({
              x: src.x, y: src.y, r0: 8, r1: 52 * ampScale, sy: 0.88,
              color: '#1658EB', coreColor: '#67E8F9', lineW: 3.0, dur: 340, layer: 'front'
            });
            kit.spawnBurstParticles(src.x, src.y, 10, 'ringlet', {
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9'], color2: '#1658EB',
              spdMin: 35, spdMax: 105, upBias: 30, gravity: -10,
              sizeMin: 3.6, sizeMax: 6.4, lifeMin: 360, lifeMax: 580
            });
          }
        },
        {
          at: 45,
          fn() {
            const rbHigh = kit.addRibbon({
              pts: [src],
              width: 9.2 * ampScale,
              outerColor: '#1658EB', midColor: '#38BDF8', coreColor: '#FFFFFF',
              alpha: 0.94, dur: 760, fadeOut: 280
            });
            const rbLow = kit.addRibbon({
              pts: [src],
              width: 8.2 * ampScale,
              outerColor: '#0284C7', midColor: '#67E8F9', coreColor: '#FFFFFF',
              alpha: 0.92, dur: 780, fadeOut: 280
            });

            // 两条晶透皇家蓝/冰青魔力流光首节点与拖尾实时推进
            kit.addCustomDrawable('front', {
              dur: flowMs + 220,
              _lastStep: -1,
              update(dt, dtSec, p) {
                const t = easeInOutSine(clamp((this.age) / flowMs, 0, 1));
                const step = Math.floor(t * 24);
                if (step > this._lastStep && t <= 1) {
                  this._lastStep = step;
                  const pH = quadBezier(src, ctrlHigh, dst, t);
                  const pL = quadBezier(src, ctrlLow, dst, t);
                  rbHigh.pts.push(pH);
                  rbLow.pts.push(pL);
                  if (rbHigh.pts.length > 26) rbHigh.pts.shift();
                  if (rbLow.pts.length > 26) rbLow.pts.shift();

                  if (step % 2 === 0 && t < 0.96) {
                    const chosen = step % 4 === 0 ? pH : pL;
                    kit.addParticle({
                      kind: step % 4 === 0 ? 'ringlet' : 'star',
                      x: chosen.x + (Math.random() - 0.5) * 8,
                      y: chosen.y + (Math.random() - 0.5) * 8,
                      vx: (Math.random() - 0.5) * 32,
                      vy: -18 + (Math.random() - 0.5) * 28,
                      gravity: -8, drag: 1.1,
                      size: 3.8 + Math.random() * 2.8,
                      color: step % 4 === 0 ? '#E0F7FF' : '#67E8F9',
                      color2: '#1658EB',
                      life: 320 + Math.random() * 180
                    });
                  }
                }
              },
              draw(ctx, p) {
                const t = easeInOutSine(clamp(this.age / flowMs, 0, 1));
                const fade = this.age > flowMs ? clamp(1 - (this.age - flowMs) / 220, 0, 1) : 1;
                if (fade <= 0.02) return;

                const heads = [
                  { pos: quadBezier(src, ctrlHigh, dst, t), col: '#38BDF8', rim: '#1658EB' },
                  { pos: quadBezier(src, ctrlLow, dst, t),  col: '#67E8F9', rim: '#0284C7' }
                ];
                const shrink = t > 0.88 ? clamp(1 - (t - 0.88) / 0.12, 0.25, 1) : 1;
                ctx.save();
                ctx.globalAlpha = fade * shrink;
                for (let i = 0; i < heads.length; i++) {
                  const h = heads[i];
                  const gr = ctx.createRadialGradient(h.pos.x, h.pos.y, 1, h.pos.x, h.pos.y, 15 * ampScale * shrink);
                  gr.addColorStop(0, '#FFFFFF');
                  gr.addColorStop(0.45, toRgba(h.col, 0.82));
                  gr.addColorStop(1, toRgba(h.rim, 0));
                  ctx.fillStyle = gr;
                  ctx.beginPath();
                  ctx.arc(h.pos.x, h.pos.y, 15 * ampScale * shrink, 0, TAU);
                  ctx.fill();

                  kit.drawStarFlare(ctx, h.pos.x, h.pos.y, 12 * ampScale * shrink, 0.24, 4, p * 6 + i, h.col, '#FFFFFF', fade * shrink);
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 445,
          fn() {
            kit.safeCall(o.onImpact, 0, dst, true);
            kit.safeCall(o.onShake, 2.2, 100);

            kit.addMagicCircle({
              x: dst.x, y: groundY + 4, radius: 48 * ampScale, sy: 0.30,
              palette: 'ice', dur: 700, fadeIn: 90, fadeOut: 220
            });
            kit.addStarFlare({
              x: dst.x, y: dst.y - 68 * ampScale, r0: 8, r1: 38 * ampScale, points: 6,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 400
            });
            kit.addShockRing({
              x: dst.x, y: dst.y, r0: 20, r1: 92 * ampScale, sy: 0.90,
              color: '#1658EB', coreColor: '#67E8F9', lineW: 3.4, dur: 460, layer: 'front'
            });
            kit.addShockRing({
              x: dst.x, y: groundY + 4, r0: 14, r1: 98 * ampScale, sy: 0.28,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.2, dur: 480
            });

            // 希尔维亚周身绽放晶莹魔力微环 (ringlet)（环绕双侧绽放，不挡面容）
            for (let side = -1; side <= 1; side += 2) {
              kit.spawnBurstParticles(dst.x + side * 34 * ampScale, dst.y - 6, 11, 'ringlet', {
                colors: ['#FFFFFF', '#E0F7FF', '#7DD3FC', '#38BDF8'], color2: '#1658EB',
                spdMin: 46, spdMax: 155, upBias: 48, gravity: -18, drag: 1.0,
                jitter: 18, sizeMin: 4.8, sizeMax: 9.6, lifeMin: 460, lifeMax: 760
              });
              kit.spawnBurstParticles(dst.x + side * 32 * ampScale, dst.y - 8, 9, 'star', {
                colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'],
                spdMin: 48, spdMax: 160, upBias: 55, gravity: -20,
                jitter: 18, sizeMin: 3.0, sizeMax: 6.2, lifeMin: 420, lifeMax: 720
              });
            }
          }
        }
      ]);
    },

    /* ==========================================================================
       20. 敌方退场消散 (fx_enemy_defeat)
       ========================================================================== */
    fx_enemy_defeat(kit, o) {
      const { ampScale } = o;
      const pos = resolveTargetAnchor(o);
      const gy = pos.groundY;
      const { clamp, lerp, easeOutCubic } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, pos, true);
            kit.safeCall(o.onShake, 4.8, 160);
            kit.safeCall(o.onHitStop, 44);

            kit.spawnPfx('snowflake_burst', { palette: kit.PALETTES.silverIce, count: 10 }, {
              x: pos.x, y: gy + 6, scale: 1.56 * ampScale,
              alpha: 0.86, preWarmSec: 0.14, timeScale: 1.25, durMs: 980, layer: 'front'
            });

            // 轻盈升腾的柔光消散环与向天际飘散的晶光丝
            kit.addCustomDrawable('front', {
              dur: 1120,
              draw(ctx, p) {
                const fade = p > 0.65 ? clamp((1 - p) / 0.35, 0, 1) : 1;
                if (fade <= 0.02) return;

                ctx.save();
                // 柔白银蓝天际光幕丝
                const liftH = lerp(40, 185 * ampScale, easeOutCubic(p));
                const beamW = 72 * ampScale * (1 - p * 0.35);
                const bg = ctx.createLinearGradient(pos.x, gy, pos.x, gy - liftH);
                bg.addColorStop(0, toRgba('#DBEAFE', 0.28 * fade));
                bg.addColorStop(0.5, toRgba('#BAE6FD', 0.18 * fade));
                bg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = bg;
                ctx.fillRect(pos.x - beamW * 0.5, gy - liftH, beamW, liftH);

                // 三层柔光消散虚线环缓缓上浮
                for (let k = 0; k < 3; k++) {
                  const rp = clamp((p - k * 0.14) / 0.72, 0, 1);
                  if (rp <= 0.01 || rp >= 0.99) continue;
                  const rAlpha = Math.sin(rp * Math.PI) * 0.88;
                  const rad = lerp(24, (78 + k * 14) * ampScale, easeOutCubic(rp));
                  const ry = lerp(gy - 12, pos.y - 78 * ampScale, rp);

                  ctx.save();
                  ctx.globalAlpha = rAlpha;
                  ctx.strokeStyle = k === 1 ? '#FEF9C3' : '#93C5FD';
                  ctx.lineWidth = 2.6 * (1 - rp * 0.45);
                  ctx.setLineDash([12, 8]);
                  ctx.lineDashOffset = -rp * 36;
                  ctx.beginPath();
                  ctx.ellipse(pos.x, ry, rad, rad * 0.30, 0, 0, TAU);
                  ctx.stroke();
                  ctx.setLineDash([]);

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.1;
                  ctx.beginPath();
                  ctx.ellipse(pos.x, ry, rad * 0.94, rad * 0.28, 0, 0, TAU);
                  ctx.stroke();
                  ctx.restore();
                }
                ctx.restore();
              }
            });

            kit.addFlash(pos.x, pos.y, 56 * ampScale, '#BAE6FD', 200, 0.36);
            kit.addStarFlare({
              x: pos.x, y: pos.y - 6, r0: 10, r1: 58 * ampScale, points: 8,
              outerColor: '#93C5FD', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: pos.x, y: gy + 4, r0: 14, r1: 112 * ampScale, sy: 0.28,
              color: '#60A5FA', coreColor: '#FFFFFF', lineW: 3.4, dur: 540
            });
          }
        },
        {
          at: 50,
          fn() {
            kit.spawnBurstParticles(pos.x, pos.y + 8, 28, 'star', {
              colors: ['#FFFFFF', '#F8FAFC', '#E0F7FF', '#93C5FD', '#FEF9C3'],
              spdMin: 32, spdMax: 125, upBias: 125, gravity: -68, drag: 0.65,
              jitter: 56, sizeMin: 3.2, sizeMax: 7.0, lifeMin: 680, lifeMax: 1120
            });
            kit.spawnBurstParticles(pos.x, pos.y, 14, 'ringlet', {
              colors: ['#FFFFFF', '#DBEAFE', '#FEF9C3'], color2: '#60A5FA',
              spdMin: 24, spdMax: 92, upBias: 95, gravity: -48, drag: 0.7,
              jitter: 44, sizeMin: 3.8, sizeMax: 7.4, lifeMin: 620, lifeMax: 1040
            });
          }
        },
        {
          at: 260,
          fn() {
            kit.spawnBurstParticles(pos.x, pos.y - 12, 22, 'snow', {
              colors: ['#FFFFFF', '#E0F7FF', '#FEF9C3'], color2: '#60A5FA',
              spdMin: 22, spdMax: 98, upBias: 135, gravity: -58, drag: 0.6,
              jitter: 62, sizeMin: 3.0, sizeMax: 6.4, lifeMin: 640, lifeMax: 980
            });
            kit.spawnBurstParticles(pos.x, pos.y - 24, 16, 'star', {
              colors: ['#FFFFFF', '#FEF9C3', '#BAE6FD'],
              spdMin: 28, spdMax: 110, upBias: 150, gravity: -72, drag: 0.6,
              jitter: 52, sizeMin: 2.8, sizeMax: 6.0, lifeMin: 580, lifeMax: 920
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       21. Boss 二阶段觉醒 (fx_boss_phase2)
       ========================================================================== */
    fx_boss_phase2(kit, o) {
      const { ampScale } = o;
      const pos = resolveTargetAnchor(o);
      const gy = pos.groundY;
      const th = resolveBossTheme(o, kit.PALETTES);
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            // 多环法阵于 Boss 脚下盛大展开
            kit.addMagicCircle({
              x: pos.x, y: gy + 4, radius: 58 * ampScale, sy: 0.30,
              palette: th.pal, goldTriple: false, lineW: 2.6, dur: 1460, fadeIn: 140, fadeOut: 280
            });
            kit.addMagicCircle({
              x: pos.x, y: gy + 4, radius: 92 * ampScale, sy: 0.28,
              rimColor: th.primary, starColor: th.bright, runeColor: '#FFFFFF',
              innerGlow: toRgba(th.pale, 0.56), outerGlow: toRgba(th.primary, 0.28),
              goldTriple: true, vrot: -0.0020, lineW: 2.8, dur: 1480, fadeIn: 160, fadeOut: 300
            });
            kit.spawnPfx('magic_circle_cast', { palette: th.pal }, {
              x: pos.x, y: gy + 4, scale: 1.66 * ampScale,
              preWarmSec: 0.72, timeScale: 1.75, durMs: 1120, layer: 'back',
              glowColor: toRgba(th.bright, 0.40), glowRadius: 74 * ampScale, glowAlpha: 0.38
            });
          }
        },
        {
          at: 210,
          fn() {
            kit.safeCall(o.onImpact, 0, pos, true);
            kit.safeCall(o.onShake, 11.2, 360);
            kit.safeCall(o.onHitStop, 76);

            // 响应主题色板的主体 PixelFX 元素爆发
            if (th.pfx === 'flame_pillar') {
              kit.spawnPfx('flame_pillar', { palette: th.pal, stone: th.bright, height: 142 }, {
                x: pos.x, y: gy + 6, scale: 1.44 * ampScale,
                preWarmSec: 0.22, timeScale: 2.0, durMs: 1120, layer: 'back',
                glowColor: toRgba(th.bright, 0.42), glowRadius: 76 * ampScale, glowAlpha: 0.38
              });
              kit.spawnPfx('fire_ring', { palette: th.pal, reach: 96 }, {
                x: pos.x, y: gy + 4, scale: 1.62 * ampScale,
                preWarmSec: 0.14, timeScale: 1.85, durMs: 1040, layer: 'back'
              });
            } else if (th.pfx === 'blizzard_vortex') {
              kit.spawnPfx('blizzard_vortex', { palette: th.pal, height: 92 }, {
                x: pos.x, y: gy + 6, scale: 1.84 * ampScale,
                alpha: 0.76, timeScale: 1.45, durMs: 1120, layer: 'back'
              });
              kit.spawnPfx('frost_nova', { palette: th.pal, reach: 102 }, {
                x: pos.x, y: gy + 4, scale: 1.68 * ampScale,
                preWarmSec: 0.36, timeScale: 1.5, durMs: 1040, layer: 'back'
              });
            } else if (th.pfx === 'eclipse') {
              kit.spawnPfx('eclipse', { palette: th.pal }, {
                x: pos.x, y: pos.y - 24, scale: 1.38 * ampScale,
                alpha: 0.76, timeScale: 1.4, durMs: 1120, layer: 'back'
              });
              kit.spawnPfx('frost_nova', { palette: th.pal, reach: 100 }, {
                x: pos.x, y: gy + 4, scale: 1.66 * ampScale,
                preWarmSec: 0.36, timeScale: 1.5, durMs: 1040, layer: 'back'
              });
            } else {
              kit.spawnPfx('frost_nova', { palette: th.pal, reach: 104 }, {
                x: pos.x, y: gy + 4, scale: 1.72 * ampScale,
                preWarmSec: 0.36, timeScale: 1.5, durMs: 1060, layer: 'back'
              });
              kit.spawnPfx('snowflake_burst', { palette: th.pal, count: 11 }, {
                x: pos.x, y: gy + 8, scale: 1.86 * ampScale,
                preWarmSec: 0.16, timeScale: 1.3, durMs: 1060, layer: 'front'
              });
            }

            // 后景冲天元素光柱（贯穿至画布顶端，通透高彩零遮脸）
            kit.addCustomDrawable('back', {
              dur: 1220,
              draw(ctx, p) {
                const surge = easeOutBack(clamp(p / 0.18, 0, 1));
                const exit = p > 0.70 ? clamp((1 - p) / 0.30, 0, 1) : 1;
                const alpha = exit;
                if (alpha <= 0.02) return;

                const colW = (106 + Math.sin(p * 12) * 10) * ampScale * surge;
                ctx.save();
                ctx.globalAlpha = alpha;

                const cg = ctx.createLinearGradient(pos.x - colW * 0.5, 0, pos.x + colW * 0.5, 0);
                cg.addColorStop(0, toRgba(th.primary, 0));
                cg.addColorStop(0.20, toRgba(th.primary, 0.36));
                cg.addColorStop(0.50, toRgba(th.pale, 0.28));
                cg.addColorStop(0.80, toRgba(th.primary, 0.36));
                cg.addColorStop(1, toRgba(th.primary, 0));
                ctx.fillStyle = cg;
                ctx.fillRect(pos.x - colW * 0.5, 0, colW, gy + 6);

                // 光柱内部上升双螺旋元素能量流
                for (let s = 0; s < 2; s++) {
                  ctx.strokeStyle = s === 0 ? toRgba(th.bright, 0.82) : toRgba('#FFFFFF', 0.85);
                  ctx.lineWidth = s === 0 ? 3.4 : 1.8;
                  ctx.beginPath();
                  for (let y = gy; y >= 0; y -= 10) {
                    const u = (gy - y) / Math.max(1, gy);
                    const wx = pos.x + Math.sin(u * 10 - p * 14 + s * Math.PI) * (colW * 0.38);
                    if (y === gy) ctx.moveTo(wx, y);
                    else ctx.lineTo(wx, y);
                  }
                  ctx.stroke();
                }
                ctx.restore();
              }
            });

            // 前景三层绚丽气场脉冲环向上逐级升腾
            kit.addCustomDrawable('front', {
              dur: 1120,
              draw(ctx, p) {
                ctx.save();
                for (let k = 0; k < 3; k++) {
                  const rp = clamp((p - k * 0.16) / 0.62, 0, 1);
                  if (rp <= 0.01 || rp >= 0.99) continue;
                  const a = Math.sin(rp * Math.PI) * 0.92;
                  const ry = lerp(gy + 2, 34, easeOutCubic(rp));
                  const rx = lerp(42, 128 * ampScale, easeOutCubic(rp));
                  ctx.globalAlpha = a;
                  ctx.strokeStyle = k % 2 === 0 ? th.primary : th.accent;
                  ctx.lineWidth = 4.2 * (1 - rp * 0.5);
                  ctx.beginPath();
                  ctx.ellipse(pos.x, ry, rx, rx * 0.26, 0, 0, TAU);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.ellipse(pos.x, ry, rx * 0.95, rx * 0.24, 0, 0, TAU);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });

            // 四道觉醒元素电弧
            for (let b = 0; b < 4; b++) {
              const ang = (b / 4) * TAU + 0.35;
              const r0 = 36;
              const r1 = 92 * ampScale;
              kit.addLightning(
                pos.x + Math.cos(ang) * r0, pos.y + Math.sin(ang) * r0 * 0.65,
                pos.x + Math.cos(ang + 0.35) * r1, pos.y + Math.sin(ang + 0.35) * r1 * 0.65 - 24,
                { outerColor: th.primary, midColor: th.bright, coreColor: '#FFFFFF', width: 2.4, dur: 320, branches: 2 }
              );
            }

            kit.addFlash(pos.x, pos.y - 12, 68 * ampScale, th.bright, 180, 0.28);
            kit.addStarFlare({
              x: pos.x, y: pos.y - 82 * ampScale, r0: 14, r1: 64 * ampScale, points: 8,
              outerColor: th.bright, coreColor: '#FFFFFF', dur: 460
            });
            kit.addShockRing({
              x: pos.x, y: gy + 4, r0: 18, r1: 152 * ampScale, sy: 0.28,
              color: th.primary, coreColor: '#FFFFFF', lineW: 4.8, dur: 600
            });

            kit.spawnBurstParticles(pos.x, pos.y, 34, th.particleKind, {
              colors: ['#FFFFFF', th.pale, th.bright, th.accent], color2: th.color2,
              spdMin: 68, spdMax: 245, upBias: 135, gravity: -22, drag: 0.9,
              sizeMin: 4.2, sizeMax: 8.2, lifeMin: 620, lifeMax: 1080
            });
            kit.spawnBurstParticles(pos.x, pos.y - 16, 26, 'star', {
              colors: ['#FFFFFF', th.pale, th.bright, '#FDE68A'],
              spdMin: 75, spdMax: 265, upBias: 105, gravity: -15,
              sizeMin: 3.4, sizeMax: 7.2, lifeMin: 560, lifeMax: 980
            });
          }
        },
        {
          at: 520,
          fn() {
            kit.safeCall(o.onShake, 7.2, 220);
            kit.addShockRing({
              x: pos.x, y: gy + 4, r0: 24, r1: 164 * ampScale, sy: 0.28,
              color: th.accent, coreColor: '#FFFFFF', lineW: 4.0, dur: 560
            });
            kit.addStarFlare({
              x: pos.x, y: pos.y - 88 * ampScale, r0: 12, r1: 58 * ampScale, points: 8, rot: 0.4,
              outerColor: th.accent, coreColor: '#FFFFFF', dur: 440
            });
            kit.spawnBurstParticles(pos.x, gy - 18, 22, 'spark', {
              colors: ['#FFFFFF', th.pale, th.bright, th.primary],
              spdMin: 120, spdMax: 310, upBias: 140, gravity: 45,
              sizeMin: 2.5, sizeMax: 4.8, lifeMin: 380, lifeMax: 680
            });
          }
        }
      ]);
    },

    /* ==========================================================================
       22. 多波次换场清风 (fx_wave_transition)
       ========================================================================== */
    fx_wave_transition(kit, o) {
      const dir = resolveDir(o);
      const W = kit.LOGICAL_W;
      const H = kit.LOGICAL_H;
      const { clamp, lerp, easeInOutSine } = kit.math;
      const { toRgba } = kit.color;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: W * 0.5, y: H * 0.5 }, true);

            // 横扫 640×360 全屏的通透天青银金棱光风幕
            kit.addCustomDrawable('front', {
              dur: 1040,
              draw(ctx, p) {
                const env = Math.sin(clamp(p, 0, 1) * Math.PI);
                if (env <= 0.01) return;

                const sweep = easeInOutSine(p);
                const headX = dir > 0 ? lerp(-100, W + 220, sweep) : lerp(W + 100, -220, sweep);
                const bandW = 290;

                ctx.save();
                ctx.globalAlpha = env;

                // 1) 斜向通透天青银金棱光风幕带
                ctx.save();
                const g = ctx.createLinearGradient(headX - bandW * dir, 0, headX + 80 * dir, 0);
                g.addColorStop(0, 'rgba(56,189,248,0)');
                g.addColorStop(0.30, 'rgba(56,189,248,0.20)');
                g.addColorStop(0.58, 'rgba(224,247,255,0.32)');
                g.addColorStop(0.80, 'rgba(253,230,138,0.26)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(headX - bandW * dir, 0);
                ctx.lineTo(headX + 80 * dir, 0);
                ctx.lineTo(headX + 26 * dir, H);
                ctx.lineTo(headX - (bandW + 54) * dir, H);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // 2) 6 道贯穿全屏的丝滑清风流线（天青 / 银白 / 香槟金）
                const streamColors = [
                  { outer: '#38BDF8', core: '#FFFFFF', y: 58,  amp: 12, w: 3.6 },
                  { outer: '#7DD3FC', core: '#E0F7FF', y: 112, amp: 15, w: 4.4 },
                  { outer: '#FDE68A', core: '#FFFFFF', y: 164, amp: 11, w: 3.8 },
                  { outer: '#38BDF8', core: '#FFFFFF', y: 218, amp: 14, w: 4.6 },
                  { outer: '#93C5FD', core: '#F8FAFC', y: 272, amp: 10, w: 3.4 },
                  { outer: '#FCD34D', core: '#FFFFFF', y: 318, amp: 8,  w: 2.8 }
                ];
                ctx.lineCap = 'round';
                for (let s = 0; s < streamColors.length; s++) {
                  const st = streamColors[s];
                  const segLead = headX + (s % 3 - 1) * 32 * dir;
                  const segLen = 320 + (s % 2) * 90;
                  const xStart = segLead - segLen * dir;
                  const xEnd = segLead;

                  const lg = ctx.createLinearGradient(xStart, st.y, xEnd, st.y);
                  lg.addColorStop(0, toRgba(st.outer, 0));
                  lg.addColorStop(0.55, toRgba(st.outer, 0.82));
                  lg.addColorStop(0.90, toRgba(st.core, 0.94));
                  lg.addColorStop(1, toRgba(st.core, 0));

                  ctx.strokeStyle = lg;
                  ctx.lineWidth = st.w;
                  ctx.beginPath();
                  for (let i = 0; i <= 24; i++) {
                    const u = i / 24;
                    const px = lerp(xStart, xEnd, u);
                    const py = st.y + Math.sin(u * TAU * 1.2 + p * 7 + s * 1.2) * st.amp;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                  }
                  ctx.stroke();
                }

                // 3) 棱光前锋斜向晶芒斜线与闪星
                for (let k = 0; k < 4; k++) {
                  const rx = headX - (18 + k * 28) * dir;
                  const ry = 62 + k * 74;
                  ctx.strokeStyle = k % 2 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(253,230,138,0.68)';
                  ctx.lineWidth = 2.0;
                  ctx.beginPath();
                  ctx.moveTo(rx - 22, ry + 34);
                  ctx.lineTo(rx + 26, ry - 38);
                  ctx.stroke();

                  kit.drawStarFlare(ctx, rx + 4, ry - 4, 16 * env, 0.22, 4, p * 4 + k, k % 2 === 0 ? '#7DD3FC' : '#FDE68A', '#FFFFFF', env * 0.94);
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 60,
          fn() {
            const rng = kit.makeRng(kit.nextSeed());
            for (let i = 0; i < 34; i++) {
              const sx = dir > 0 ? (20 + rng() * 240) : (W - 20 - rng() * 240);
              kit.addParticle({
                kind: i % 4 === 0 ? 'petal' : (i % 3 === 0 ? 'snow' : 'star'),
                x: sx,
                y: 32 + rng() * (H - 64),
                vx: dir * (160 + rng() * 220),
                vy: -20 + rng() * 44,
                gravity: 6, drag: 0.45,
                size: 3.4 + rng() * 4.4,
                rot: rng() * TAU,
                vrot: (rng() - 0.5) * 6,
                color: i % 4 === 0 ? '#FDE68A' : (i % 2 === 0 ? '#FFFFFF' : '#7DD3FC'),
                color2: i % 4 === 0 ? '#F59E0B' : '#0EA5E9',
                life: 620 + rng() * 380
              });
            }
          }
        },
        {
          at: 260,
          fn() {
            kit.addShockRing({
              x: W * 0.5, y: 288, r0: 40, r1: 260, sy: 0.14,
              color: '#7DD3FC', coreColor: '#FEF9C3', lineW: 3.0, dur: 540
            });
            const rng = kit.makeRng(kit.nextSeed());
            for (let i = 0; i < 28; i++) {
              kit.addParticle({
                kind: i % 3 === 0 ? 'petal' : 'star',
                x: W * 0.5 + (rng() - 0.5) * 260,
                y: 44 + rng() * (H - 88),
                vx: dir * (145 + rng() * 210),
                vy: -24 + rng() * 48,
                gravity: 6, drag: 0.5,
                size: 3.2 + rng() * 4.2,
                rot: rng() * TAU,
                vrot: (rng() - 0.5) * 6,
                color: i % 3 === 0 ? '#FEF9C3' : '#FFFFFF',
                color2: '#38BDF8',
                life: 520 + rng() * 320
              });
            }
          }
        }
      ]);
    },

    /* ==========================================================================
       23. 状态微反馈 (fx_status_micro)
       支持 variant: 'buff' | 'debuff' | 'chill' | 'burn' | 'guard' | 'amp'
       ========================================================================== */
    fx_status_micro(kit, o) {
      const { ampScale } = o;
      const variant = resolveStatusVariant(o);
      const pos = resolveSelfAnchor(o);
      const cx = pos.x;
      const cy = pos.y;
      const gy = pos.groundY;
      const { clamp, lerp, easeOutCubic, easeOutBack } = kit.math;
      const { toRgba } = kit.color;

      const styles = {
        buff: {
          primary: '#38BDF8', bright: '#FDE68A', pale: '#FEF9C3', color2: '#1658EB',
          particleKind: 'star', upBias: 82, gravity: -32, dirY: -1
        },
        debuff: {
          primary: '#A78BFA', bright: '#FB7185', pale: '#FFE4E6', color2: '#6D28D9',
          particleKind: 'ringlet', upBias: -25, gravity: 52, dirY: 1
        },
        chill: {
          primary: '#0EA5E9', bright: '#BAE6FD', pale: '#E0F7FF', color2: '#1658EB',
          particleKind: 'snow', upBias: 35, gravity: 18, dirY: 0
        },
        burn: {
          primary: '#EA580C', bright: '#FCD34D', pale: '#FEF08A', color2: '#DC2626',
          particleKind: 'petal', upBias: 85, gravity: -28, dirY: -1
        },
        guard: {
          primary: '#1658EB', bright: '#FDE68A', pale: '#E0F7FF', color2: '#0284C7',
          particleKind: 'star', upBias: 42, gravity: -12, dirY: 0
        },
        amp: {
          primary: '#1658EB', bright: '#F59E0B', pale: '#FEF9C3', color2: '#D97706',
          particleKind: 'star', upBias: 68, gravity: -24, dirY: -1
        }
      };
      const st = styles[variant] || styles.buff;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.safeCall(o.onImpact, 0, pos, true);

            // 轻巧灵动的微光环与形态标识（紧贴身侧/头顶/脚底，绝无杂乱遮脸）
            kit.addCustomDrawable('front', {
              dur: 720,
              draw(ctx, p) {
                const enter = easeOutBack(clamp(p / 0.22, 0, 1));
                const fade = p > 0.60 ? clamp((1 - p) / 0.40, 0, 1) : 1;
                if (fade <= 0.02) return;

                ctx.save();
                ctx.globalAlpha = fade;

                if (variant === 'buff') {
                  // 双重向上跃升光翼人字徽（悬浮于头顶上方，零遮发丝面容）
                  const rise = lerp(-34 * ampScale, -72 * ampScale, easeOutCubic(p));
                  for (let k = 0; k < 2; k++) {
                    const yOff = cy + rise + k * 14;
                    const w = 32 * ampScale * enter;
                    ctx.strokeStyle = k === 0 ? st.bright : st.primary;
                    ctx.lineWidth = 3.6;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(cx - w, yOff + 9);
                    ctx.lineTo(cx, yOff - 9);
                    ctx.lineTo(cx + w, yOff + 9);
                    ctx.stroke();

                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cx - w * 0.8, yOff + 7);
                    ctx.lineTo(cx, yOff - 7);
                    ctx.lineTo(cx + w * 0.8, yOff + 7);
                    ctx.stroke();
                  }
                } else if (variant === 'debuff') {
                  // 明亮宝石紫×玫瑰红向下收敛印环（带亮白外描边，深色衣袍上依然锐利清晰）
                  const drop = lerp(-44 * ampScale, 8, easeOutCubic(p));
                  const rad = lerp(48, 30, easeOutCubic(p)) * ampScale;
                  ctx.save();
                  ctx.translate(cx, cy + drop);
                  ctx.strokeStyle = st.bright;
                  ctx.lineWidth = 3.6;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rad, rad * 0.34, 0, 0, TAU);
                  ctx.stroke();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.4;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rad * 0.94, rad * 0.30, 0, 0, TAU);
                  ctx.stroke();
                  ctx.strokeStyle = st.primary;
                  ctx.lineWidth = 2.2;
                  drawRegularPoly(ctx, 0, 0, rad * 0.82, 3, Math.PI / 2, 0.38);
                  ctx.stroke();
                  ctx.restore();
                } else if (variant === 'chill') {
                  // 晶莹六角寒霜晶体环
                  const rad = 42 * ampScale * enter;
                  ctx.save();
                  ctx.translate(cx, cy - 4);
                  ctx.rotate(p * 1.4);
                  ctx.strokeStyle = st.primary;
                  ctx.lineWidth = 2.8;
                  drawRegularPoly(ctx, 0, 0, rad, 6, 0, 1);
                  ctx.stroke();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.4;
                  drawRegularPoly(ctx, 0, 0, rad * 0.82, 6, Math.PI / 6, 1);
                  ctx.stroke();
                  for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * TAU;
                    ctx.fillStyle = '#FFFFFF';
                    drawDiamond(ctx, Math.cos(a) * rad, Math.sin(a) * rad, 3.6, 3.6);
                    ctx.fill();
                  }
                  ctx.restore();
                } else if (variant === 'burn') {
                  // 跃动灼金火瓣环
                  const rad = (36 + Math.sin(p * Math.PI) * 10) * ampScale * enter;
                  ctx.save();
                  ctx.translate(cx, gy - 14 - p * 26);
                  ctx.strokeStyle = st.primary;
                  ctx.lineWidth = 3.2;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rad, rad * 0.32, 0, 0, TAU);
                  ctx.stroke();
                  ctx.strokeStyle = st.pale;
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rad * 0.86, rad * 0.26, 0, 0, TAU);
                  ctx.stroke();
                  ctx.restore();
                } else if (variant === 'guard') {
                  // 皇家蓝×香槟金轻巧棱盾微章
                  const R = 42 * ampScale * enter;
                  ctx.save();
                  ctx.translate(cx, cy);
                  ctx.fillStyle = toRgba('#38BDF8', 0.14 * fade);
                  drawRegularPoly(ctx, 0, 0, R, 6, Math.PI / 6, 1.05);
                  ctx.fill();
                  ctx.strokeStyle = st.primary;
                  ctx.lineWidth = 3.0;
                  ctx.stroke();
                  ctx.strokeStyle = st.bright;
                  ctx.lineWidth = 1.8;
                  drawRegularPoly(ctx, 0, 0, R * 1.12, 6, Math.PI / 6, 1.05);
                  ctx.stroke();
                  ctx.restore();
                } else {
                  // 'amp': 皇家蓝×香槟金蓄能双环脉冲
                  const rOut = lerp(58, 34, easeOutCubic(clamp(p / 0.5, 0, 1))) * ampScale;
                  const rIn = lerp(18, 52, easeOutCubic(p)) * ampScale;
                  ctx.save();
                  ctx.translate(cx, cy - 2);
                  ctx.strokeStyle = st.bright;
                  ctx.lineWidth = 3.0;
                  ctx.beginPath();
                  ctx.arc(0, 0, rOut, 0, TAU);
                  ctx.stroke();
                  ctx.strokeStyle = '#38BDF8';
                  ctx.lineWidth = 2.4;
                  ctx.setLineDash([10, 6]);
                  ctx.rotate(p * 3.6);
                  ctx.beginPath();
                  ctx.arc(0, 0, rIn, 0, TAU);
                  ctx.stroke();
                  ctx.setLineDash([]);
                  ctx.restore();
                }
                ctx.restore();
              }
            });

            if (variant === 'amp') {
              kit.addLightning(cx - 32, cy - 22, cx + 32, cy + 16, {
                outerColor: '#D97706', midColor: '#FDE68A', coreColor: '#FFFFFF',
                width: 1.9, dur: 240, branches: 1
              });
            }

            kit.addShockRing({
              x: cx, y: gy + 4, r0: 12, r1: 72 * ampScale, sy: 0.28,
              color: st.primary, coreColor: st.pale, lineW: 3.0, dur: 440
            });
            kit.addStarFlare({
              x: cx, y: cy - (variant === 'debuff' ? -10 : 48) * ampScale,
              r0: 6, r1: 30 * ampScale, points: variant === 'chill' ? 6 : 4,
              outerColor: st.bright, coreColor: '#FFFFFF', dur: 360
            });

            kit.spawnBurstParticles(cx, cy, 16, st.particleKind, {
              colors: ['#FFFFFF', st.pale, st.bright, st.primary], color2: st.color2,
              spdMin: 34, spdMax: 125, upBias: st.upBias, gravity: st.gravity, drag: 0.9,
              jitter: 42, sizeMin: 3.4, sizeMax: 6.8, lifeMin: 400, lifeMax: 720
            });
          }
        }
      ]);
    }
  };

  /* -------------------- 注册入口与自动挂载 -------------------- */
  function register(coreApi) {
    const api = coreApi || global.VfxEditionAFull;
    if (!api || typeof api.registerPack !== 'function') return null;
    return api.registerPack(PACK_NAME, SKILLS_META, HANDLERS, ALIASES);
  }

  let registrationResult = null;
  if (global.VfxEditionAFull && typeof global.VfxEditionAFull.registerPack === 'function') {
    registrationResult = register(global.VfxEditionAFull);
  } else if (typeof require === 'function') {
    try {
      const coreMod = require('./vfx-edition-a-core.js');
      if (coreMod && typeof coreMod.registerPack === 'function') {
        registrationResult = register(coreMod);
      }
    } catch (e) {}
  }

  const packExport = {
    packName: PACK_NAME,
    SKILLS_META,
    HANDLERS,
    ALIASES,
    register,
    registrationResult
  };

  global.VfxPackAllySys = packExport;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = packExport;
  }
})(typeof window !== 'undefined' ? window : globalThis);
