/* ============================================================================
   《转生千金》方案 A 全套战斗特效 · 插件化核心底座 (js/vfx-edition-a-core.js)
   导出：window.VfxEditionAFull（兼容 CommonJS module.exports）
   逻辑画布：640×360（16:9 高清展示，自动适配任意分辨率目标 Canvas）

   架构特性：
   1. 48 并发 PixelFX 精灵槽位 + 640 粒子池 + 离屏 _scratchCache（直接复用全局 window.PixelFX，安全兜底零报错）
   2. 补齐全部 27/27 PixelFX 零裁边 PFX_BOUNDS 包围盒
   3. 24 套高饱和明亮宝石色板（原有 14 套 + 扩展 10 套，严禁暗黑脏灰）
   4. 原版 8 招（tri_prism_ice / starfrost_scatter / raging_surge / water_cleave /
      frost_thorn_field / steel_ice_curtain / sword_send_slash / wind_afterimage）
      及 ice_crystal 完整内置，支持外部 Pack 动态注册与同名覆盖
   5. 插件注册机制 registerPack(packName, skillsMetaArray, handlersMap, extraAliases)
      与现役 / V3.1 全技能别名解析器 resolveSkillId(rawId)
   6. 升级版运行时 kit 工具箱：归一化入参 o、spawnPfx(flipX/angle/palette/layer)、
      多色矢量图层覆写、任意 spriteId 残像、3 种新增粒子形态('cross'/'petal'/'ringlet')
      及统一生命周期自定义绘制层 kit.addCustomDrawable(layer, obj)
   ============================================================================ */
(function (global) {
  'use strict';

  const LOGICAL_W = 640;
  const LOGICAL_H = 360;
  const MAX_PFX_SLOTS = 48;
  const MAX_PARTICLES = 640;
  const MAX_AFTERIMAGE_CACHE = 160;

  /* -------------------- 24 套宝石明亮色板（原有 14 套 + 扩展 10 套） -------------------- */
  const PALETTES = {
    // 原有 14 套核心明亮色板
    ice:          ['#1E40AF', '#1658EB', '#0284C7', '#0EA5E9', '#38BDF8', '#7DD3FC', '#E0F7FF', '#FFFFFF'],
    iceGold:      ['#1658EB', '#0284C7', '#0EA5E9', '#38BDF8', '#67E8F9', '#FDE68A', '#FEF9C3', '#FFFFFF'],
    water:        ['#0369A1', '#0284C7', '#0EA5E9', '#06B6D4', '#22D3EE', '#67E8F9', '#CFFAFE', '#FFFFFF'],
    slash:        ['#1D4ED8', '#0284C7', '#0EA5E9', '#38BDF8', '#67E8F9', '#E0F9FF', '#FFFFFF'],
    slashGold:    ['#1658EB', '#0EA5E9', '#38BDF8', '#67E8F9', '#FDE68A', '#FEF9C3', '#FFFFFF'],
    slashWind:    ['#047857', '#059669', '#10B981', '#2DD4BF', '#6EE7B7', '#CCFBF1', '#FFFFFF'],
    shield:       ['#1658EB', '#0284C7', '#0EA5E9', '#38BDF8', '#7DD3FC', '#BAE6FD', '#FDE68A', '#FFFFFF'],
    wind:         ['#047857', '#059669', '#10B981', '#14B8A6', '#2DD4BF', '#6EE7B7', '#CCFBF1', '#FFFFFF'],
    gold:         ['#B45309', '#D97706', '#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#FEF9C3', '#FFFFFF'],
    gold7:        ['#D97706', '#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#FEF9C3', '#FFFFFF'],
    cyanSpark:    ['#FFFFFF', '#E0F7FF', '#67E8F9', '#0EA5E9'],
    goldSpark:    ['#FFFFFF', '#FEF9C3', '#FDE68A', '#F59E0B'],
    aquaSpark:    ['#FFFFFF', '#CFFAFE', '#22D3EE', '#0284C7'],
    windSpark:    ['#FFFFFF', '#CCFBF1', '#6EE7B7', '#059669'],

    // 新增 10 套明亮高饱和宝石色板
    fire:         ['#B91C1C', '#DC2626', '#EA580C', '#F97316', '#FB923C', '#FCD34D', '#FEF08A', '#FFFFFF'],
    fireSpark:    ['#FFFFFF', '#FEF08A', '#FDBA74', '#EA580C'],
    eclipse:      ['#4C1D95', '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA', '#DDD6FE', '#F5F3FF', '#FFFFFF'],
    eclipseSpark: ['#FFFFFF', '#F5F3FF', '#C4B5FD', '#7C3AED'],
    bloodRuby:    ['#9F1239', '#BE123C', '#E11D48', '#F43F5E', '#FB7185', '#FDA4AF', '#FFE4E6', '#FFFFFF'],
    earthGold:    ['#78350F', '#92400E', '#B45309', '#D97706', '#F59E0B', '#FCD34D', '#FEF3C7', '#FFFFFF'],
    heal:         ['#047857', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#ECFDF5', '#FFFFFF'],
    clawBright:   ['#9A3412', '#C2410C', '#EA580C', '#F97316', '#FBBF24', '#FDE68A', '#FFFBEB', '#FFFFFF'],
    silverIce:    ['#1E3A8A', '#1D4ED8', '#2563EB', '#60A5FA', '#93C5FD', '#DBEAFE', '#F8FAFC', '#FFFFFF'],
    jilanViolet:  ['#4338CA', '#4F46E5', '#6366F1', '#818CF8', '#A5B4FC', '#E0E7FF', '#FFFFFF']
  };

  /* -------------------- 全部 27/27 PixelFX 零裁边局部包围盒 -------------------- */
  const PFX_BOUNDS = {
    // 原有 18 项
    magic_circle_cast: { w: 120, h: 112, ox: -60,  oy: -68 },
    ice_lance:         { w: 168, h: 64,  ox: -144, oy: -32 },
    ice_crystal:       { w: 80,  h: 96,  ox: -40,  oy: -72 },
    ice_shatter:       { w: 144, h: 108, ox: -64,  oy: -76 },
    frost_nova:        { w: 256, h: 104, ox: -128, oy: -82 },
    ice_spikes:        { w: 210, h: 104, ox: -28,  oy: -80 },
    icicle_fall:       { w: 108, h: 136, ox: -54,  oy: -108 },
    snowflake_burst:   { w: 132, h: 124, ox: -66,  oy: -108 },
    blizzard_vortex:   { w: 120, h: 140, ox: -60,  oy: -106 },
    water_jet:         { w: 248, h: 76,  ox: -28,  oy: -30 },
    wave_crash:        { w: 236, h: 92,  ox: -118, oy: -76 },
    splash:            { w: 140, h: 120, ox: -70,  oy: -86 },
    sword_slash:       { w: 168, h: 124, ox: -74,  oy: -98 },
    double_slash:      { w: 144, h: 124, ox: -18,  oy: -88 },
    divine_shield:     { w: 96,  h: 96,  ox: -48,  oy: -72 },
    crit_hit:          { w: 168, h: 120, ox: -68,  oy: -84 },
    parry:             { w: 176, h: 100, ox: -88,  oy: -80 },
    hit_spark:         { w: 132, h: 88,  ox: -40,  oy: -64 },

    // 精准补齐其余 9 项（27/27 全覆盖）
    claw_swipe:        { w: 96,  h: 84,  ox: -16,  oy: -58 },
    heavy_cleave:      { w: 188, h: 140, ox: -60,  oy: -98 },
    fireball:          { w: 156, h: 96,  ox: -108, oy: -48 },
    flame_pillar:      { w: 188, h: 256, ox: -94,  oy: -210 },
    fire_ring:         { w: 232, h: 118, ox: -116, oy: -74 },
    eclipse:           { w: 168, h: 144, ox: -80,  oy: -78 },
    shadow_tendrils:   { w: 144, h: 132, ox: -72,  oy: -84 },
    time_stop:         { w: 144, h: 152, ox: -78,  oy: -108 },
    ground_slam:       { w: 264, h: 162, ox: -132, oy: -110 }
  };

  /* -------------------- 数学、缓动与色彩辅助 -------------------- */
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeOutQuart = t => 1 - Math.pow(1 - clamp(t, 0, 1), 4);
  const easeInQuad = t => { const u = clamp(t, 0, 1); return u * u; };
  const easeInOutSine = t => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) * 0.5;
  const easeOutBack = t => {
    const u = clamp(t, 0, 1);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  };

  function quadBezier(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  function quadBezierTangent(p0, p1, p2, t) {
    const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    return Math.atan2(dy, dx);
  }

  function makeRng(seed) {
    let s = (seed >>> 0) || 1337;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resolvePalette(pal) {
    if (!pal) return null;
    if (typeof pal === 'string') return PALETTES[pal] || null;
    if (Array.isArray(pal) && pal.length) return pal;
    return null;
  }

  function parseHexRgb(hex) {
    if (typeof hex !== 'string') return null;
    const raw = hex.trim();
    if (raw[0] === '#') {
      let body = raw.slice(1);
      if (body.length === 3) {
        body = body[0] + body[0] + body[1] + body[1] + body[2] + body[2];
      }
      if (body.length >= 6) {
        const n = parseInt(body.slice(0, 6), 16);
        if (!Number.isNaN(n)) {
          return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
      }
    }
    const m = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return [Number(m[1]) & 255, Number(m[2]) & 255, Number(m[3]) & 255];
    return null;
  }

  function toRgba(col, alpha) {
    const rgb = parseHexRgb(col);
    if (!rgb) return `rgba(56,189,248,${clamp(alpha, 0, 1)})`;
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha, 0, 1)})`;
  }

  function withZeroAlpha(col) {
    const rgb = parseHexRgb(col);
    if (!rgb) return 'rgba(56,189,248,0)';
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`;
  }

  function pickPal(pal, ratio) {
    const n = pal.length;
    const idx = clamp(Math.round(ratio * (n - 1)), 0, n - 1);
    return pal[idx];
  }

  /* -------------------- 全局 window.PixelFX 复用（无内联 190KB，安全兜底） -------------------- */
  function getPixelFX() {
    if (global.PixelFX && global.PixelFX.FX && typeof global.PixelFX.createFx === 'function') {
      return global.PixelFX;
    }
    return null;
  }

  /* -------------------- 共享可复用 PixelFX 离屏像素画布池（零 GC 抖动） -------------------- */
  const _scratchCache = new Map();
  function getScratchSurface(PFX, w, h, ox, oy) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const key = `${w}x${h}`;
    let s = _scratchCache.get(key);
    if (!s) {
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d', { alpha: true });
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = false;
      const imgData = ctx.createImageData(w, h);
      const frame = PFX.createFrame(w, h, ox, oy);
      s = { canvas: cvs, ctx, imgData, frame };
      _scratchCache.set(key, s);
    }
    s.frame.ox = ox | 0;
    s.frame.oy = oy | 0;
    return s;
  }

  /* -------------------- 插件化技能注册表与现役 / V3.1 别名路由 -------------------- */
  const SKILLS = [];
  const SKILL_MAP = Object.create(null);
  const HANDLERS = Object.create(null);
  const PACKS = Object.create(null);

  /* 现役战斗技能 + V3.1 技能 + 友军 / 敌方 / 系统演出全别名映射表
     说明：优先直击 HANDLERS 同名注册项，其次按候选列表顺序命中已注册招式 */
  const SKILL_ALIASES = Object.assign(Object.create(null), {
    // 1) 现役 23 招玩家战术技能 (js/combat-engine.js TACTICAL_SKILLS)
    basic_attack:            ['basic_attack', 'sword_basic_slash', 'sword_send_slash'],
    hand_water_surge:        ['hand_water_surge', 'raging_surge'],
    hand_ice_crystal:        ['hand_ice_crystal', 'ice_crystal'],
    hand_ice_wall:           ['hand_ice_wall', 'ice_wall', 'steel_ice_curtain'],
    hand_frost_floor:        ['hand_frost_floor', 'frost_floor', 'frost_thorn_field'],
    hand_root_shield:        ['hand_root_shield', 'root_shield', 'steel_ice_curtain'],
    hand_water_veil:         ['hand_water_veil', 'water_veil', 'steel_ice_curtain'],
    hand_thorn_field:        ['hand_thorn_field', 'frost_thorn_field'],
    remote_blind_shot:       ['remote_blind_shot', 'blind_shot', 'ice_crystal'],
    remote_snap_spike:       ['remote_snap_spike', 'snap_spike', 'ice_crystal'],
    sword_root_step:         ['sword_root_step', 'root_step', 'steel_ice_curtain'],
    sword_water_edge:        ['sword_water_edge', 'sword_send_slash', 'water_cleave'],
    sword_wind_afterimage:   ['sword_wind_afterimage', 'wind_afterimage'],
    insight_beatrice_pillar: ['insight_beatrice_pillar', 'beatrice_pillar', 'frost_thorn_field'],
    insight_rowan_prism:     ['insight_rowan_prism', 'rowan_prism', 'starfrost_scatter'],
    insight_alice_cage:      ['insight_alice_cage', 'alice_cage', 'frost_thorn_field'],
    insight_aino_bead:       ['insight_aino_bead', 'aino_bead', 'ice_crystal'],
    insight_noelle_sever:    ['insight_noelle_sever', 'noelle_sever', 'frost_thorn_field'],
    insight_jackal_throat:   ['insight_jackal_throat', 'jackal_throat', 'water_cleave'],
    insight_hulan_resonance: ['insight_hulan_resonance', 'hulan_resonance', 'starfrost_scatter'],
    insight_eastwing_draft:  ['insight_eastwing_draft', 'eastwing_draft', 'raging_surge'],
    insight_wind_stillness:  ['insight_wind_stillness', 'wind_stillness', 'wind_afterimage'],
    insight_generic_flaw:    ['insight_generic_flaw', 'generic_flaw', 'tri_prism_ice'],

    // 2) V3.1 / 旧版 / 简写技能别名
    attack:                  ['basic_attack', 'sword_basic_slash', 'sword_send_slash'],
    sword_basic_slash:       ['sword_basic_slash', 'basic_attack', 'sword_send_slash'],
    water_ball:              ['hand_water_surge', 'raging_surge'],
    water_surge:             ['hand_water_surge', 'raging_surge'],
    ice_wall:                ['hand_ice_wall', 'ice_wall', 'steel_ice_curtain'],
    frost_floor:             ['hand_frost_floor', 'frost_floor', 'frost_thorn_field'],
    root_shield:             ['hand_root_shield', 'steel_ice_curtain'],
    root_ice:                ['hand_root_shield', 'steel_ice_curtain'],
    frost_armor:             ['hand_ice_wall', 'steel_ice_curtain'],
    water_veil:              ['hand_water_veil', 'water_veil', 'steel_ice_curtain'],
    water_veil_s:            ['hand_water_veil', 'water_veil', 'steel_ice_curtain'],
    thorn_field:             ['hand_thorn_field', 'frost_thorn_field'],
    domain_frost:            ['hand_thorn_field', 'frost_thorn_field'],
    zero_field:              ['starfrost_scatter'],
    silk_thread:             ['silk_thread', 'tri_prism_ice'],
    soft_cut:                ['sword_water_edge', 'sword_send_slash'],
    frost_edge:              ['sword_water_edge', 'water_cleave'],
    stealth_edge:            ['sword_water_edge', 'water_cleave'],
    root_step:               ['sword_root_step', 'steel_ice_curtain'],
    wind_step_s:             ['wind_afterimage'],
    instant_ice:             ['remote_snap_spike', 'ice_crystal'],
    blind_shot:              ['remote_blind_shot', 'ice_crystal'],
    snap_spike:              ['remote_snap_spike', 'ice_crystal'],
    ice_sphere:              ['ice_crystal'],
    mirror_ice:              ['insight_rowan_prism', 'steel_ice_curtain'],
    mana_cycle:              ['mana_cycle', 'raging_surge'],
    multi_cast:              ['tri_prism_ice'],
    sword_mana:              ['sword_send_slash'],
    hand_tri_prism:          ['tri_prism_ice'],
    hand_starfrost:          ['starfrost_scatter'],
    sword_water_cleave:      ['water_cleave'],
    sword_send:              ['sword_send_slash'],
    v3_tri_prism:            ['tri_prism_ice'],
    v3_starfrost:            ['starfrost_scatter'],
    v3_water_cleave:         ['water_cleave'],
    v3_sword_send:           ['sword_send_slash'],
    v3_raging_surge:         ['raging_surge'],
    v3_frost_thorn:          ['frost_thorn_field'],
    v3_steel_curtain:        ['steel_ice_curtain'],
    v3_wind_afterimage:      ['wind_afterimage'],
    heal_touch:              ['heal_touch', 'item_heal', 'steel_ice_curtain'],
    mana_sip:                ['mana_sip', 'item_mana', 'steel_ice_curtain'],
    ice_palace:              ['palace_time_stop', 'palace_timestop', 'starfrost_scatter'],

    // 3) 系统 / 增幅 / 破盾 / 道具 / 再动演出别名
    wand_toggle:             ['wand_toggle', 'eclipse_wand', 'starfrost_scatter'],
    eclipse_wand:            ['eclipse_wand', 'wand_toggle', 'starfrost_scatter'],
    palace_time_stop:        ['palace_time_stop', 'palace_timestop', 'starfrost_scatter'],
    palace_timestop:         ['palace_time_stop', 'palace_timestop', 'starfrost_scatter'],
    amp_charge:              ['amp_charge_burst', 'amp_charge', 'steel_ice_curtain'],
    amp_charge_burst:        ['amp_charge_burst', 'amp_charge', 'steel_ice_curtain'],
    aino_spear:              ['aino_spear_support', 'aino_spear', 'starfrost_scatter'],
    aino_spear_support:      ['aino_spear_support', 'aino_spear', 'starfrost_scatter'],
    one_more:                ['one_more', 'amp_charge_burst', 'starfrost_scatter'],
    shield_break:            ['shield_break', 'guard_break', 'tri_prism_ice'],
    guard_break:             ['guard_break', 'shield_break', 'tri_prism_ice'],
    frost_combo:             ['frost_combo', 'starfrost_scatter'],
    item_heal:               ['item_heal', 'heal_touch', 'steel_ice_curtain'],
    item_mana:               ['item_mana', 'mana_sip', 'steel_ice_curtain'],

    // 4) 友军援护 / 心念共鸣 / 敌方招式路由别名
    ally_reno_earth:         ['ally_reno_earth', 'reno_earth', 'frost_thorn_field'],
    ally_reno_fire:          ['ally_reno_fire', 'reno_fire', 'raging_surge'],
    ally_reno_wind:          ['ally_reno_wind', 'reno_wind', 'wind_afterimage'],
    ally_reno_water:         ['ally_reno_water', 'reno_water', 'raging_surge'],
    ally_reno_guard:         ['ally_reno_guard', 'reno_guard', 'steel_ice_curtain'],
    bond_reno:               ['bond_reno', 'ally_reno_guard', 'ally_reno_earth', 'steel_ice_curtain'],
    bond_charlotte:          ['bond_charlotte', 'ally_charlotte', 'steel_ice_curtain'],
    bond_jilan:              ['bond_jilan', 'ally_jilan', 'sword_send_slash'],
    bond_alice:              ['bond_alice', 'ally_alice', 'wind_afterimage'],
    bond_noelle:             ['bond_noelle', 'ally_noelle', 'raging_surge'],
    bond_aino:               ['bond_aino', 'ally_aino', 'starfrost_scatter'],
    bond_beatrice:           ['bond_beatrice', 'ally_beatrice', 'raging_surge'],
    enemy_fire_melee:        ['enemy_fire_melee', 'enemy_heavy_cleave', 'sword_send_slash'],
    enemy_fire_magic:        ['enemy_fire_magic', 'enemy_fireball', 'raging_surge'],
    enemy_rowan_eclipse:     ['enemy_rowan_eclipse', 'rowan_eclipse', 'starfrost_scatter'],
    enemy_wind_dash:         ['enemy_wind_dash', 'enemy_alice_wind', 'wind_afterimage'],
    enemy_aino_ice:          ['enemy_aino_ice', 'aino_ice_lance', 'ice_crystal'],
    enemy_noelle_water:      ['enemy_noelle_water', 'noelle_water_jet', 'raging_surge'],
    enemy_beast_claw:        ['enemy_beast_claw', 'enemy_claw', 'water_cleave'],
    enemy_beast_slam:        ['enemy_beast_slam', 'enemy_ground_slam', 'frost_thorn_field'],
    enemy_parried:           ['enemy_parried', 'parry_riposte', 'sword_send_slash'],
    enemy_evaded:            ['enemy_evaded', 'wind_evade', 'wind_afterimage'],
    enemy_blocked:           ['enemy_blocked', 'shield_block', 'steel_ice_curtain'],

    // 5) V3.2 全 15 招规范技能 ID 精准路由别名
    ice_1_crystal:           ['ice_crystal'],
    ice_2_prism:             ['tri_prism_ice'],
    ice_3_starfrost:         ['starfrost_scatter'],
    water_1_ball:            ['water_orb', 'raging_surge'],
    water_2_surge:           ['raging_surge'],
    water_3_blade:           ['water_cleave'],
    frost_1_step:            ['frost_step_floor', 'frost_thorn_field'],
    frost_2_breath:          ['frost_breath', 'frost_thorn_field'],
    frost_3_thorns:          ['frost_thorn_field'],
    shield_1_ice:            ['ice_shield', 'steel_ice_curtain'],
    shield_2_mirror:         ['mirror_frost_wall', 'steel_ice_curtain'],
    shield_3_steel:          ['prism_aegis', 'steel_ice_curtain'],
    sword_1_basic:           ['basic_attack', 'sword_basic_slash', 'sword_send_slash'],
    sword_2_cold_edge:       ['sword_send_slash', 'silver_ice_slash'],
    move_afterimage:         ['sword_root_step', 'wind_afterimage']
  });

  function resolveSkillId(rawId) {
    if (rawId == null) return null;
    const key = String(rawId).trim();
    if (!key) return null;
    if (HANDLERS[key]) return key;

    const lower = key.toLowerCase();
    if (HANDLERS[lower]) return lower;

    const visited = new Set([key, lower]);
    const queue = [];
    const pushTarget = entry => {
      if (!entry) return;
      if (typeof entry === 'string') {
        queue.push(entry);
      } else if (Array.isArray(entry)) {
        for (let i = 0; i < entry.length; i++) {
          if (typeof entry[i] === 'string') queue.push(entry[i]);
        }
      }
    };

    pushTarget(SKILL_ALIASES[key]);
    if (lower !== key) pushTarget(SKILL_ALIASES[lower]);

    while (queue.length) {
      const cand = queue.shift();
      if (HANDLERS[cand]) return cand;
      if (visited.has(cand)) continue;
      visited.add(cand);
      pushTarget(SKILL_ALIASES[cand]);
    }

    return null;
  }

  function hasSkill(rawId) {
    const id = resolveSkillId(rawId);
    return !!(id && HANDLERS[id]);
  }

  function listSkills(filterPack) {
    if (filterPack) {
      return SKILLS.filter(s => s.pack === filterPack);
    }
    return SKILLS.slice();
  }

  function getDuration(rawId) {
    const id = resolveSkillId(rawId) || rawId;
    return (SKILL_MAP[id] && Number.isFinite(SKILL_MAP[id].duration)) ? SKILL_MAP[id].duration : 1250;
  }

  function getPeakTime(rawId) {
    const id = resolveSkillId(rawId) || rawId;
    const meta = SKILL_MAP[id];
    if (meta && Number.isFinite(meta.peakMs)) return meta.peakMs;
    return Math.round(getDuration(id) * 0.44);
  }

  function registerAliases(aliasMap) {
    if (!aliasMap || typeof aliasMap !== 'object') return;
    const keys = Object.keys(aliasMap);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = aliasMap[k];
      if (typeof v === 'string' || Array.isArray(v)) {
        SKILL_ALIASES[k] = v;
      }
    }
  }

  function registerPack(packName, skillsMetaArray, handlersMap, extraAliases) {
    const pName = String(packName || 'anonymous_pack');
    const metaList = Array.isArray(skillsMetaArray) ? skillsMetaArray : [];
    const hMap = handlersMap && typeof handlersMap === 'object' ? handlersMap : {};
    const registered = [];
    const overridden = [];

    for (let i = 0; i < metaList.length; i++) {
      const item = metaList[i];
      if (!item || !item.id) continue;
      const id = String(item.id);
      const existed = !!SKILL_MAP[id];
      const merged = Object.assign(
        {
          duration: 1250,
          peakMs: 520,
          kind: 'magic',
          targetMode: 'single',
          accent: '#38BDF8'
        },
        existed ? SKILL_MAP[id] : null,
        item,
        { id, pack: pName }
      );
      SKILL_MAP[id] = merged;
      if (existed) {
        const idx = SKILLS.findIndex(s => s.id === id);
        if (idx >= 0) SKILLS[idx] = merged;
        else SKILLS.push(merged);
        overridden.push(id);
      } else {
        SKILLS.push(merged);
        registered.push(id);
      }
      if (Array.isArray(item.aliases)) {
        for (let a = 0; a < item.aliases.length; a++) {
          const al = String(item.aliases[a] || '').trim();
          if (al && al !== id) SKILL_ALIASES[al] = id;
        }
      }
    }

    const hKeys = Object.keys(hMap);
    for (let i = 0; i < hKeys.length; i++) {
      const id = hKeys[i];
      const fn = hMap[id];
      if (typeof fn !== 'function') continue;
      const hadHandler = !!HANDLERS[id];
      HANDLERS[id] = fn;
      if (!SKILL_MAP[id]) {
        const fallbackMeta = {
          id,
          name: id,
          en: id,
          kind: 'magic',
          targetMode: 'single',
          duration: 1250,
          peakMs: 520,
          accent: '#38BDF8',
          desc: '',
          pack: pName
        };
        SKILL_MAP[id] = fallbackMeta;
        SKILLS.push(fallbackMeta);
        if (!registered.includes(id) && !overridden.includes(id)) registered.push(id);
      } else if (hadHandler && !overridden.includes(id) && !registered.includes(id)) {
        overridden.push(id);
      }
    }

    if (extraAliases && typeof extraAliases === 'object') {
      registerAliases(extraAliases);
    }

    PACKS[pName] = {
      name: pName,
      registered: registered.slice(),
      overridden: overridden.slice(),
      skillIds: Array.from(new Set(metaList.map(m => m && m.id).concat(hKeys).filter(Boolean)))
    };

    return {
      pack: pName,
      registered,
      overridden,
      totalSkills: SKILLS.length
    };
  }

  /* -------------------- 绘制辅助（明亮雪瓷高可读性矢量/像素混合原语） -------------------- */
  function drawStarFlare(ctx, x, y, radius, innerRatio, points, rot, outerColor, coreColor, alpha) {
    if (alpha <= 0.01 || radius <= 0.5) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // 紧凑明亮星晕（零模糊脏边）
    const glowR = radius * 0.56;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    g.addColorStop(0, coreColor);
    g.addColorStop(0.32, outerColor);
    g.addColorStop(1, withZeroAlpha(outerColor));
    ctx.save();
    ctx.globalAlpha = clamp(alpha * 0.48, 0, 1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 锐利外层菱星
    ctx.fillStyle = outerColor;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i * Math.PI) / points;
      const r = i % 2 === 0 ? radius : radius * innerRatio;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // 纯白尖锐星芯
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i * Math.PI) / points;
      const r = i % 2 === 0 ? radius * 0.68 : radius * innerRatio * 0.55;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMagicCircle(ctx, mc) {
    const p = clamp(mc.age / mc.dur, 0, 1);
    const envIn = easeOutBack(clamp(mc.age / mc.fadeIn, 0, 1));
    const envOut = mc.age > mc.dur - mc.fadeOut ? clamp((mc.dur - mc.age) / mc.fadeOut, 0, 1) : 1;
    const alpha = envOut * mc.alpha;
    if (alpha <= 0.01) return;

    const r = mc.radius * (0.35 + 0.65 * envIn);
    const sy = mc.sy;

    ctx.save();
    ctx.translate(mc.x, mc.y);
    ctx.scale(1, sy);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // 底部明亮折射光盘
    const bg = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.25);
    bg.addColorStop(0, mc.innerGlow);
    bg.addColorStop(0.65, mc.outerGlow);
    bg.addColorStop(1, withZeroAlpha(mc.outerGlow));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.25, 0, TAU);
    ctx.fill();

    // 外双环 + 符文刻度
    ctx.rotate(mc.rot);
    ctx.strokeStyle = mc.rimColor;
    ctx.lineWidth = mc.lineW;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1, mc.lineW * 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.87, 0, TAU);
    ctx.stroke();

    // 12 个发光符文棱点
    ctx.fillStyle = mc.runeColor;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const rx = Math.cos(a) * r * 0.935;
      const ry = Math.sin(a) * r * 0.935;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(a + Math.PI * 0.25);
      const sz = i % 3 === 0 ? 3.2 : 1.9;
      ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
      ctx.restore();
    }

    // 反向旋转六芒星
    ctx.rotate(-mc.rot * 2.1);
    ctx.strokeStyle = mc.starColor;
    ctx.lineWidth = Math.max(1.2, mc.lineW * 0.65);
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + (k * Math.PI) / 3;
        const px = Math.cos(a) * r * 0.84;
        const py = Math.sin(a) * r * 0.84;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // 三阶香槟金外星环
    if (mc.goldTriple) {
      ctx.rotate(mc.rot * 3.0);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([9, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.29, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#FEF9C3';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const gx = Math.cos(a) * r * 1.23;
        const gy = Math.sin(a) * r * 1.23;
        ctx.beginPath();
        ctx.moveTo(gx, gy - 4);
        ctx.lineTo(gx + 3, gy);
        ctx.lineTo(gx, gy + 4);
        ctx.lineTo(gx - 3, gy);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();

    // 脉冲上升晶芒光丝
    if (p < 0.78) {
      const pulse = Math.sin(clamp(p / 0.78, 0, 1) * Math.PI);
      ctx.save();
      ctx.globalAlpha = pulse * 0.34 * alpha;
      const colH = r * 1.7;
      const cg = ctx.createLinearGradient(mc.x, mc.y, mc.x, mc.y - colH);
      const beamBase = mc.beamColor || (mc.goldTriple ? 'rgba(253,230,138,0.65)' : toRgba(mc.starColor || '#38BDF8', 0.55));
      const beamMid = mc.beamMidColor || toRgba(mc.runeColor || '#7DD3FC', 0.22);
      cg.addColorStop(0, beamBase);
      cg.addColorStop(0.55, beamMid);
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(mc.x - r * 0.65, mc.y - colH, r * 1.3, colH);
      ctx.restore();
    }
  }

  function buildLightningPoints(x0, y0, x1, y1, jitter, depth, rng) {
    let pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
    let amp = jitter;
    for (let d = 0; d < depth; d++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const off = (rng() - 0.5) * 2 * amp;
        next.push({ x: mx + nx * off, y: my + ny * off }, b);
      }
      pts = next;
      amp *= 0.56;
    }
    return pts;
  }

  function drawLightningArc(ctx, arc) {
    const p = clamp(arc.age / arc.dur, 0, 1);
    const alpha = (1 - easeInQuad(p)) * (0.72 + 0.28 * Math.sin(arc.age * 0.09));
    if (alpha <= 0.02 || arc.pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = clamp(alpha, 0, 1);

    const strokePath = pts => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };

    ctx.strokeStyle = arc.outerColor;
    ctx.lineWidth = arc.width * 3.1;
    ctx.globalAlpha = clamp(alpha * 0.42, 0, 1);
    strokePath(arc.pts);

    ctx.strokeStyle = arc.midColor;
    ctx.lineWidth = arc.width * 1.75;
    ctx.globalAlpha = clamp(alpha * 0.92, 0, 1);
    strokePath(arc.pts);

    ctx.strokeStyle = arc.coreColor || '#FFFFFF';
    ctx.lineWidth = Math.max(1.1, arc.width * 0.72);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    strokePath(arc.pts);

    if (arc.branches && arc.branches.length) {
      for (let b = 0; b < arc.branches.length; b++) {
        const br = arc.branches[b];
        ctx.strokeStyle = arc.midColor;
        ctx.lineWidth = Math.max(1.1, arc.width * 0.95);
        ctx.globalAlpha = clamp(alpha * 0.78, 0, 1);
        strokePath(br);
        ctx.strokeStyle = arc.coreColor || '#FFFFFF';
        ctx.lineWidth = 0.9;
        strokePath(br);
      }
    }
    ctx.restore();
  }

  /* 棱镜通透多面体护盾（默认冰蓝×淡金，支持可选 colors / palette 覆写） */
  function resolveShieldTheme(sh) {
    const pal = resolvePalette(sh.palette);
    const c = sh.colors || {};
    if (!pal && !sh.colors) {
      return {
        dome0: 'rgba(224,247,255,0.08)',
        dome1: 'rgba(56,189,248,0.16)',
        dome2: 'rgba(22,88,235,0.28)',
        dome3: 'rgba(253,230,138,0.44)',
        outerFrame: 'rgba(22,88,235,0.78)',
        facetLine: 'rgba(56,189,248,0.82)',
        innerFrame: 'rgba(245,158,11,0.78)',
        rimGold: '#FDE68A',
        studAlt: '#FDE68A',
        ring0: 'rgba(14,165,233,0.92)',
        ring1: 'rgba(245,158,11,0.88)',
        gemDark0: '#1658EB',
        gemLight0: '#BAE6FD',
        gemDark1: '#D97706',
        gemLight1: '#FEF08A',
        lockRing: '#F59E0B'
      };
    }
    const baseDark = pal ? pickPal(pal, 0.16) : '#1658EB';
    const baseMid = pal ? pickPal(pal, 0.52) : '#38BDF8';
    const baseBright = pal ? pickPal(pal, 0.80) : '#BAE6FD';
    const accent = pal ? pickPal(pal, 0.72) : '#FDE68A';
    return {
      dome0: c.dome0 || toRgba(baseBright, 0.09),
      dome1: c.dome1 || toRgba(baseMid, 0.17),
      dome2: c.dome2 || toRgba(baseDark, 0.28),
      dome3: c.dome3 || toRgba(accent, 0.44),
      outerFrame: c.outerFrame || toRgba(baseDark, 0.82),
      facetLine: c.facetLine || toRgba(baseMid, 0.84),
      innerFrame: c.innerFrame || toRgba(accent, 0.80),
      rimGold: c.rimGold || baseBright,
      studAlt: c.studAlt || accent,
      ring0: c.ring0 || toRgba(baseMid, 0.92),
      ring1: c.ring1 || toRgba(accent, 0.88),
      gemDark0: c.gemDark0 || baseDark,
      gemLight0: c.gemLight0 || baseBright,
      gemDark1: c.gemDark1 || '#D97706',
      gemLight1: c.gemLight1 || '#FEF08A',
      lockRing: c.lockRing || accent
    };
  }

  function drawPrismShield(ctx, sh) {
    const enter = easeOutBack(clamp(sh.age / 240, 0, 1));
    const exit = sh.age > sh.dur - 280 ? clamp((sh.dur - sh.age) / 280, 0, 1) : 1;
    const alpha = exit;
    if (alpha <= 0.01) return;

    const th = resolveShieldTheme(sh);
    const r = sh.radius * (0.45 + 0.55 * enter);
    const lockFlash = sh.age >= sh.lockAt && sh.age < sh.lockAt + 210
      ? Math.sin(((sh.age - sh.lockAt) / 210) * Math.PI)
      : 0;

    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // 1) 通透明亮多面体穹顶底光
    const domeGrad = ctx.createRadialGradient(0, -4, r * 0.15, 0, 0, r * 1.08);
    domeGrad.addColorStop(0, th.dome0);
    domeGrad.addColorStop(0.55, th.dome1);
    domeGrad.addColorStop(0.84, th.dome2);
    domeGrad.addColorStop(1, th.dome3);
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 1.06;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // 2) 多面棱镜内折射晶格
    const rot = sh.age * 0.0014;
    ctx.strokeStyle = th.outerFrame;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 1.06;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = th.facetLine;
    ctx.lineWidth = 1.5;
    const innerR = r * 0.68;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const ix = Math.cos(a) * innerR;
      const iy = Math.sin(a) * innerR * 1.04;
      const ox = Math.cos(a) * r * 0.98;
      const oy = Math.sin(a) * r * 1.04;
      ctx.moveTo(ix, iy);
      ctx.lineTo(ox, oy);
    }
    ctx.stroke();

    ctx.strokeStyle = th.innerFrame;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const ix = Math.cos(a) * innerR;
      const iy = Math.sin(a) * innerR * 1.04;
      if (i === 0) ctx.moveTo(ix, iy);
      else ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = lockFlash > 0.1 ? '#FFFFFF' : th.rimGold;
    ctx.lineWidth = 2.0 + lockFlash * 2.0;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const px = Math.cos(a) * (r + 1.8);
      const py = Math.sin(a) * (r * 1.06 + 1.8);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 1.06;
      ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : th.studAlt;
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, TAU);
      ctx.fill();
    }

    // 3) 斜向通透玻璃扫光带
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 1.06;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();
    const sweepPos = -r * 1.6 + ((sh.age * 0.24) % (r * 3.4));
    ctx.rotate(-0.55);
    const sg = ctx.createLinearGradient(sweepPos - 16, 0, sweepPos + 16, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, `rgba(255,255,255,${0.32 + lockFlash * 0.28})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sweepPos - 16, -r * 1.5, 32, r * 3);
    ctx.restore();

    // 4) 倾斜 3D 旋转微光环 + 3 枚公转钻石棱晶
    for (let ringIdx = 0; ringIdx < (sh.ampTier >= 2 ? 2 : 1); ringIdx++) {
      const tilt = ringIdx === 0 ? -0.26 : 0.30;
      const orbR = r * (ringIdx === 0 ? 1.24 : 1.36);
      const dir = ringIdx === 0 ? 1 : -1;
      ctx.save();
      ctx.rotate(tilt);
      ctx.strokeStyle = ringIdx === 0 ? th.ring0 : th.ring1;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, orbR, orbR * 0.30, 0, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -sh.age * 0.09 * dir;
      ctx.beginPath();
      ctx.ellipse(0, 0, orbR * 0.96, orbR * 0.28, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let c = 0; c < 3; c++) {
        const ca = rot * 2.4 * dir + (c / 3) * TAU;
        const cx = Math.cos(ca) * orbR;
        const cy = Math.sin(ca) * orbR * 0.30;
        const depth = Math.sin(ca);
        const csz = 6.8 + depth * 2.2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = ringIdx === 0 ? th.gemDark0 : th.gemDark1;
        ctx.beginPath();
        ctx.moveTo(0, -csz * 1.4);
        ctx.lineTo(csz * 0.75, 0);
        ctx.lineTo(0, csz * 1.4);
        ctx.lineTo(-csz * 0.75, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = ringIdx === 0 ? th.gemLight0 : th.gemLight1;
        ctx.beginPath();
        ctx.moveTo(0, -csz * 1.35);
        ctx.lineTo(0, csz * 1.35);
        ctx.lineTo(-csz * 0.7, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, -csz * 0.35, 1.9, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // 5) 护幕落成闪光波纹
    if (lockFlash > 0.02) {
      const lp = clamp((sh.age - sh.lockAt) / 210, 0, 1);
      const lr = r * (1.0 + lp * 0.58);
      ctx.strokeStyle = th.lockRing;
      ctx.lineWidth = 4.2 * (1 - lp);
      ctx.globalAlpha = clamp(lockFlash * 0.92, 0, 1);
      ctx.beginPath();
      ctx.arc(0, 0, lr, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.0 * (1 - lp);
      ctx.beginPath();
      ctx.arc(0, 0, lr * 0.98, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 凌厉清晰分层月牙刀光 */
  function drawCrescentSlash(ctx, sl) {
    const p = clamp(sl.age / sl.dur, 0, 1);
    if (p <= 0 || p >= 1) return;

    const sweepP = easeOutQuart(clamp(p / 0.30, 0, 1));
    const tailP = easeInQuad(clamp((p - 0.16) / 0.84, 0, 1));
    const alpha = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
    if (alpha <= 0.02) return;

    const aHead = lerp(sl.startAngle, sl.endAngle, sweepP);
    const aTail = lerp(sl.startAngle, sl.endAngle, tailP * 0.85);
    if (Math.abs(aHead - aTail) < 0.03) return;

    const segs = 28;
    const thick = sl.thickness * (1 - tailP * 0.42);
    const rx = sl.rx;
    const ry = sl.ry;

    function buildCrescentPoly(widthScale, radialOffset) {
      const outer = [];
      const inner = [];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const a = lerp(aTail, aHead, u);
        const profile = Math.pow(Math.sin(u * Math.PI), 0.58) * (0.45 + 0.65 * u);
        const w = thick * widthScale * profile;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        outer.push({ x: cosA * (rx + radialOffset), y: sinA * (ry + radialOffset) });
        inner.push({ x: cosA * Math.max(4, rx + radialOffset - w), y: sinA * Math.max(4, ry + radialOffset - w) });
      }
      ctx.beginPath();
      ctx.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i <= segs; i++) ctx.lineTo(outer[i].x, outer[i].y);
      for (let i = segs; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);
      ctx.closePath();
    }

    ctx.save();
    ctx.translate(sl.x, sl.y);
    ctx.rotate(sl.tilt);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    ctx.fillStyle = sl.outerColor;
    buildCrescentPoly(1.22, 3.0);
    ctx.fill();

    ctx.fillStyle = sl.midColor;
    buildCrescentPoly(0.86, 1.2);
    ctx.fill();

    ctx.fillStyle = sl.hiColor;
    buildCrescentPoly(0.42, 0.5);
    ctx.fill();

    ctx.strokeStyle = sl.coreColor || '#FFFFFF';
    ctx.lineWidth = Math.max(2.0, thick * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const a = lerp(aTail, aHead, u);
      const px = Math.cos(a) * rx;
      const py = Math.sin(a) * ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    if (p < 0.60) {
      const tipX = Math.cos(aHead) * rx;
      const tipY = Math.sin(aHead) * ry;
      drawStarFlare(ctx, tipX, tipY, 17 * (1 - p * 0.8), 0.20, 4, aHead, sl.midColor, sl.coreColor || '#FFFFFF', alpha);
    }

    ctx.restore();
  }

  /* 真实像素骨骼晶透残像缓存（支持任意 spriteId + 可选 colors / palette 晶化色带） */
  const _afterimageCache = new Map();
  const _BANK_CHARS = '.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~';
  const _BANK_LUT = (function () {
    const lut = new Int8Array(128).fill(-1);
    for (let i = 0; i < _BANK_CHARS.length; i++) {
      const c = _BANK_CHARS.charCodeAt(i);
      if (c < 128) lut[c] = i;
    }
    return lut;
  })();

  const DEFAULT_AFTERIMAGE_RAMP = [
    [4, 120, 87, 230],
    [16, 185, 129, 215],
    [52, 211, 153, 215],
    [167, 243, 208, 225],
    [242, 255, 252, 242]
  ];

  function buildAfterimageRamp(paletteOrColors) {
    const pal = resolvePalette(paletteOrColors && paletteOrColors.palette ? paletteOrColors.palette : paletteOrColors);
    if (!pal) return { key: 'emerald', ramp: DEFAULT_AFTERIMAGE_RAMP };
    const alphas = [230, 215, 215, 225, 242];
    const stops = [0.05, 0.30, 0.56, 0.82, 0.98];
    const ramp = [];
    for (let i = 0; i < 5; i++) {
      const hex = pickPal(pal, stops[i]);
      const rgb = parseHexRgb(hex) || [52, 211, 153];
      ramp.push([rgb[0], rgb[1], rgb[2], alphas[i]]);
    }
    return { key: pal.join(','), ramp };
  }

  function getCrystalAfterimageCanvas(frameIdx, spriteId, paletteOrColors) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const bank = global.PIXEL_SPRITE_BANK;
    if (!bank) return null;
    const entry = (spriteId && bank[spriteId]) || bank.sylvia_silver || bank.sylvia_young || bank.sylvia_disguise;
    if (!entry || !Array.isArray(entry.frames) || !entry.frames.length) return null;

    let resolvedIdx = frameIdx;
    if (resolvedIdx == null) {
      if (entry.animMap && Array.isArray(entry.animMap.run) && entry.animMap.run.length) {
        resolvedIdx = entry.animMap.run[0];
      } else {
        resolvedIdx = 0;
      }
    }
    const idx = clamp(resolvedIdx | 0, 0, entry.frames.length - 1);
    const rampPack = buildAfterimageRamp(paletteOrColors);
    const key = `${entry.id}:${idx}:${rampPack.key}`;
    if (_afterimageCache.has(key)) return _afterimageCache.get(key);

    if (_afterimageCache.size >= MAX_AFTERIMAGE_CACHE) {
      const oldest = _afterimageCache.keys().next().value;
      if (oldest != null) _afterimageCache.delete(oldest);
    }

    const w = entry.w | 0;
    const h = entry.h | 0;
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const c = cvs.getContext('2d');
    if (!c) return null;
    const img = c.createImageData(w, h);
    const rgba = img.data;
    const palLum = entry.palette.map(hex => {
      if (!hex || hex.length < 7) return -1;
      const n = parseInt(hex.slice(1, 7), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    });

    const ramp = rampPack.ramp;
    const rows = entry.frames[idx] || [];
    for (let y = 0; y < h && y < rows.length; y++) {
      const row = rows[y];
      if (!row) continue;
      let x = 0;
      const rLen = row.length;
      for (let i = 0; i < rLen && x < w; i++) {
        const code = row.charCodeAt(i);
        let rep = 1;
        if (i + 1 < rLen && row.charCodeAt(i + 1) === 42) {
          let j = i + 2, n = 0;
          while (j < rLen) {
            const d = row.charCodeAt(j) - 48;
            if (d < 0 || d > 9) break;
            n = n * 10 + d;
            j++;
          }
          rep = n > 0 ? n : 1;
          i = j - 1;
        }
        if (code === 46) { x += rep; continue; }
        const pi = code < 128 ? _BANK_LUT[code] : -1;
        const lum = pi > 0 ? palLum[pi] : -1;
        if (lum < 0) { x += rep; continue; }
        const col = ramp[Math.min(4, Math.max(0, Math.floor(lum * 4.8)))];
        const endX = Math.min(w, x + rep);
        for (; x < endX; x++) {
          const off = (y * w + x) << 2;
          rgba[off] = col[0];
          rgba[off + 1] = col[1];
          rgba[off + 2] = col[2];
          rgba[off + 3] = col[3];
        }
      }
    }
    c.putImageData(img, 0, 0);
    const res = {
      canvas: cvs,
      w,
      h,
      facing: entry.facing || 'right',
      feet: (entry.anchors && entry.anchors.feet) || [w * 0.5, h - 4]
    };
    _afterimageCache.set(key, res);
    return res;
  }

  /* 晶透光影残像（支持任意 spriteId 与可选 colors / palette 覆写） */
  function drawWindAfterimage(ctx, af) {
    const p = clamp(af.age / af.dur, 0, 1);
    const alpha = (1 - easeInQuad(p) * 0.82) * af.alpha;
    if (alpha <= 0.02) return;

    const pal = resolvePalette(af.palette);
    const c = af.colors || {};
    const lineA = c.lineA || (pal ? toRgba(pickPal(pal, 0.35), 0.58) : 'rgba(16,185,129,0.58)');
    const lineB = c.lineB || (pal ? toRgba(pickPal(pal, 0.85), 0.85) : 'rgba(204,251,241,0.85)');
    const auraColor = c.aura || (pal ? pickPal(pal, 0.56) : 'rgba(52,211,153,0.34)');
    const auraStart = c.aura || (pal ? toRgba(auraColor, 0.34) : 'rgba(52,211,153,0.34)');
    const auraEnd = withZeroAlpha(auraColor);
    const faceDir = (af.facing != null && af.facing < 0) ? -1 : 1;

    const spr = getCrystalAfterimageCanvas(
      af.frameIdx != null ? af.frameIdx : (af.spriteId ? null : 8),
      af.spriteId || null,
      af.palette || af.colors || null
    );

    ctx.save();
    ctx.translate(af.x, af.y);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // 背后疾风尾流扫线（自动随 faceDir 镜像）
    ctx.save();
    if (faceDir < 0) ctx.scale(-1, 1);
    for (let i = 0; i < 6; i++) {
      const ly = -76 + i * 12;
      const lw = 18 + (i % 3) * 11;
      const ox = -24 - lw - p * 16;
      ctx.fillStyle = i % 2 === 0 ? lineA : lineB;
      ctx.fillRect(ox, ly, lw, 2.2);
    }
    ctx.restore();

    if (spr) {
      const sc = af.scale * 0.88;
      const nativeDir = spr.facing === 'left' ? -1 : 1;
      ctx.scale(faceDir * nativeDir, 1);
      ctx.imageSmoothingEnabled = false;
      const dw = spr.w * sc;
      const dh = spr.h * sc;
      const dx = -spr.feet[0] * sc;
      const dy = -spr.feet[1] * sc;

      const bg = ctx.createRadialGradient(0, -dh * 0.48, 6, 0, -dh * 0.48, dw * 0.46);
      bg.addColorStop(0, auraStart);
      bg.addColorStop(1, auraEnd);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, -dh * 0.48, dw * 0.46, 0, TAU);
      ctx.fill();

      ctx.drawImage(spr.canvas, dx, dy, dw, dh);
    } else {
      const s = af.scale * 0.96;
      ctx.scale(faceDir * s, s);
      const grad = ctx.createLinearGradient(-18, -72, 22, -4);
      grad.addColorStop(0, c.sil0 || (pal ? toRgba(pickPal(pal, 0.20), 0.78) : 'rgba(5,150,105,0.78)'));
      grad.addColorStop(0.55, c.sil1 || (pal ? toRgba(pickPal(pal, 0.56), 0.82) : 'rgba(52,211,153,0.82)'));
      grad.addColorStop(1, c.sil2 || (pal ? toRgba(pickPal(pal, 0.92), 0.95) : 'rgba(240,255,250,0.95)'));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-24, -60);
      ctx.quadraticCurveTo(-4, -76, 10, -68);
      ctx.quadraticCurveTo(16, -60, 10, -48);
      ctx.lineTo(28, -42);
      ctx.lineTo(12, -36);
      ctx.lineTo(20, -8);
      ctx.lineTo(-14, -8);
      ctx.lineTo(-22, -32);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.restore();
  }

  /* 高大晶亮多面英雄棘簇（默认冰蓝，支持可选 colors / palette 覆写） */
  function resolveThornsTheme(th) {
    const pal = resolvePalette(th.palette);
    const c = th.colors || {};
    if (!pal && !th.colors) {
      return {
        glowInner: 'rgba(224,247,255,0.82)',
        glowMid: 'rgba(56,189,248,0.45)',
        glowEdge: 'rgba(14,165,233,0)',
        leftTop: '#FFFFFF',
        leftMid: th.goldAccent ? '#FEF9C3' : '#BAE6FD',
        leftBot: '#38BDF8',
        rightTop: '#67E8F9',
        rightMid: '#0EA5E9',
        rightBot: '#1658EB',
        stroke: '#1E40AF',
        ridge: '#FFFFFF',
        flareOuter: th.goldAccent ? '#FDE68A' : '#38BDF8',
        flareCore: '#FFFFFF'
      };
    }
    const pStroke = pal ? pickPal(pal, 0.0) : '#1E40AF';
    const pDark = pal ? pickPal(pal, 0.18) : '#1658EB';
    const pMid = pal ? pickPal(pal, 0.44) : '#0EA5E9';
    const pBright = pal ? pickPal(pal, 0.62) : '#38BDF8';
    const pHi = pal ? pickPal(pal, 0.78) : '#67E8F9';
    const pPale = pal ? pickPal(pal, 0.90) : '#BAE6FD';
    const pCore = pal ? pickPal(pal, 1.0) : '#FFFFFF';
    return {
      glowInner: c.glowInner || toRgba(pPale, 0.82),
      glowMid: c.glowMid || toRgba(pBright, 0.45),
      glowEdge: c.glowEdge || withZeroAlpha(pMid),
      leftTop: c.leftTop || pCore,
      leftMid: c.leftMid || (th.goldAccent ? '#FEF9C3' : pPale),
      leftBot: c.leftBot || pBright,
      rightTop: c.rightTop || pHi,
      rightMid: c.rightMid || pMid,
      rightBot: c.rightBot || pDark,
      stroke: c.stroke || pStroke,
      ridge: c.ridge || '#FFFFFF',
      flareOuter: c.flareOuter || (th.goldAccent ? '#FDE68A' : pBright),
      flareCore: c.flareCore || '#FFFFFF'
    };
  }

  function drawHeroThorns(ctx, th) {
    const p = clamp(th.age / th.dur, 0, 1);
    const erupt = easeOutBack(clamp(th.age / 190, 0, 1));
    const exit = th.age > th.dur - 260 ? clamp((th.dur - th.age) / 260, 0, 1) : 1;
    const alpha = exit;
    if (alpha <= 0.02) return;

    const col = resolveThornsTheme(th);

    ctx.save();
    ctx.translate(th.x, th.y);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // 底部明亮辉光
    const gg = ctx.createRadialGradient(0, 0, 3, 0, 0, 38 * erupt);
    gg.addColorStop(0, col.glowInner);
    gg.addColorStop(0.55, col.glowMid);
    gg.addColorStop(1, col.glowEdge);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(0, 2, 38 * erupt, 12 * erupt, 0, 0, TAU);
    ctx.fill();

    for (let i = 0; i < th.spikes.length; i++) {
      const sp = th.spikes[i];
      const spErupt = easeOutBack(clamp((th.age - sp.delay) / 180, 0, 1));
      if (spErupt <= 0.02) continue;
      const h = sp.h * spErupt * (1 - clamp((p - 0.78) / 0.22, 0, 1) * 0.25);
      const w = sp.w;
      const tipX = sp.dx + sp.lean * spErupt;
      const tipY = -h;
      const baseL = sp.dx - w * 0.52;
      const baseR = sp.dx + w * 0.52;
      const midX = sp.dx - w * 0.1 + sp.lean * spErupt * 0.45;

      const leftG = ctx.createLinearGradient(tipX, tipY, baseL, 0);
      leftG.addColorStop(0, col.leftTop);
      leftG.addColorStop(0.35, col.leftMid);
      leftG.addColorStop(1, col.leftBot);
      ctx.fillStyle = leftG;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseL, 2);
      ctx.lineTo(midX, 2);
      ctx.closePath();
      ctx.fill();

      const rightG = ctx.createLinearGradient(tipX, tipY, baseR, 0);
      rightG.addColorStop(0, col.rightTop);
      rightG.addColorStop(0.42, col.rightMid);
      rightG.addColorStop(1, col.rightBot);
      ctx.fillStyle = rightG;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(midX, 2);
      ctx.lineTo(baseR, 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = col.stroke;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(baseL, 2);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseR, 2);
      ctx.stroke();

      ctx.strokeStyle = col.ridge;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY + 1);
      ctx.lineTo(midX, 0);
      ctx.stroke();

      if (th.age > sp.delay + 120 && th.age < th.dur - 240 && sp.primary) {
        const tw = 0.65 + 0.35 * Math.sin(th.age * 0.02 + i * 1.9);
        drawStarFlare(ctx, tipX, tipY, 10 * tw, 0.24, 4, th.age * 0.004, col.flareOuter, col.flareCore, alpha * tw);
      }
    }
    ctx.restore();
  }

  /* 地面晶亮脉络（默认冰脉，支持可选 colors / palette 覆写） */
  function resolveVeinTheme(vein) {
    const pal = resolvePalette(vein.palette);
    const c = vein.colors || {};
    if (!pal && !vein.colors) {
      return {
        glow: 'rgba(56,189,248,0.48)',
        outer: '#1658EB',
        mid: '#67E8F9',
        core: '#FFFFFF',
        spurOuter: '#0EA5E9',
        spurInner: '#E0F7FF',
        sparkOuter: '#38BDF8',
        sparkCore: '#FFFFFF'
      };
    }
    const pOuter = pal ? pickPal(pal, 0.18) : '#1658EB';
    const pSpur = pal ? pickPal(pal, 0.44) : '#0EA5E9';
    const pMid = pal ? pickPal(pal, 0.72) : '#67E8F9';
    const pPale = pal ? pickPal(pal, 0.88) : '#E0F7FF';
    const pCore = pal ? pickPal(pal, 1.0) : '#FFFFFF';
    return {
      glow: c.glow || toRgba(pMid, 0.48),
      outer: c.outer || pOuter,
      mid: c.mid || pMid,
      core: c.core || pCore,
      spurOuter: c.spurOuter || pSpur,
      spurInner: c.spurInner || pPale,
      sparkOuter: c.sparkOuter || pMid,
      sparkCore: c.sparkCore || pCore
    };
  }

  function drawIceVein(ctx, vein) {
    const grow = easeOutCubic(clamp(vein.age / vein.growMs, 0, 1));
    const exit = vein.age > vein.dur - 320 ? clamp((vein.dur - vein.age) / 320, 0, 1) : 1;
    if (grow <= 0.01 || exit <= 0.01) return;

    const pts = vein.pts;
    if (!pts || pts.length < 2) return;
    const totalSegs = pts.length - 1;
    const maxSeg = grow * totalSegs;
    const col = resolveVeinTheme(vein);

    function tracePartial() {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < totalSegs; i++) {
        if (i + 1 <= maxSeg) {
          ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        } else if (i < maxSeg) {
          const frac = maxSeg - i;
          ctx.lineTo(lerp(pts[i].x, pts[i + 1].x, frac), lerp(pts[i].y, pts[i + 1].y, frac));
          break;
        }
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = clamp(exit, 0, 1);

    ctx.strokeStyle = col.glow;
    ctx.lineWidth = vein.width * 3.1;
    tracePartial();
    ctx.stroke();

    ctx.strokeStyle = col.outer;
    ctx.lineWidth = vein.width * 1.7;
    tracePartial();
    ctx.stroke();

    ctx.strokeStyle = col.mid;
    ctx.lineWidth = vein.width;
    tracePartial();
    ctx.stroke();

    ctx.strokeStyle = col.core;
    ctx.lineWidth = Math.max(1.2, vein.width * 0.42);
    tracePartial();
    ctx.stroke();

    const spurs = vein.spurs || [];
    for (let b = 0; b < spurs.length; b++) {
      const sp = spurs[b];
      if (grow < sp.at) continue;
      const spP = easeOutCubic(clamp((grow - sp.at) / 0.14, 0, 1));
      ctx.strokeStyle = col.spurOuter;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + sp.dx * spP, sp.y + sp.dy * spP);
      ctx.stroke();

      ctx.strokeStyle = col.spurInner;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + sp.dx * spP, sp.y + sp.dy * spP);
      ctx.stroke();
    }

    if (grow < 0.99) {
      const idx = Math.min(totalSegs - 1, Math.floor(maxSeg));
      const frac = maxSeg - idx;
      const hx = lerp(pts[idx].x, pts[idx + 1].x, frac);
      const hy = lerp(pts[idx].y, pts[idx + 1].y, frac);
      drawStarFlare(ctx, hx, hy, 12, 0.28, 4, vein.age * 0.02, col.sparkOuter, col.sparkCore, 1);
    }

    ctx.restore();
  }

  /* 高空倾斜落下的明亮星霜冰柱/光雨（支持可选 colors / palette 覆写） */
  function drawSkyIcicleBeam(ctx, bm) {
    const p = clamp(bm.age / bm.dur, 0, 1);
    if (p <= 0 || p >= 1) return;

    const pal = resolvePalette(bm.palette);
    const c = bm.colors || {};
    const glowMid = c.glowMid || (pal ? toRgba(pickPal(pal, 0.60), 0.74) : (bm.gold ? 'rgba(253,230,138,0.75)' : 'rgba(56,189,248,0.72)'));
    const glowHead = c.glowHead || (pal ? pickPal(pal, 0.80) : (bm.gold ? '#FDE68A' : '#67E8F9'));
    const edgeColor = c.edge || (pal ? pickPal(pal, 0.22) : (bm.gold ? '#F59E0B' : '#1658EB'));
    const tipColor = c.tip || (pal ? pickPal(pal, 0.45) : '#0EA5E9');
    const impactColor = c.impact || (pal ? pickPal(pal, 0.65) : (bm.gold ? '#FDE68A' : '#38BDF8'));
    const coreColor = c.core || '#FFFFFF';

    const fallP = easeInQuad(clamp(p / 0.48, 0, 1));
    const fade = p < 0.48 ? 1 : clamp(1 - (p - 0.48) / 0.52, 0, 1);

    const headX = lerp(bm.x0, bm.x1, fallP);
    const headY = lerp(bm.y0, bm.y1, fallP);
    const tailFrac = Math.max(0, fallP - 0.45);
    const tailX = lerp(bm.x0, bm.x1, tailFrac);
    const tailY = lerp(bm.y0, bm.y1, tailFrac);

    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.lineCap = 'round';

    const g = ctx.createLinearGradient(tailX, tailY, headX, headY);
    g.addColorStop(0, withZeroAlpha(glowHead));
    g.addColorStop(0.55, glowMid);
    g.addColorStop(1, glowHead);
    ctx.strokeStyle = g;
    ctx.lineWidth = bm.width * 2.4;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = bm.width * 1.15;
    ctx.beginPath();
    ctx.moveTo(lerp(tailX, headX, 0.25), lerp(tailY, headY, 0.25));
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.strokeStyle = coreColor;
    ctx.lineWidth = Math.max(1.8, bm.width * 0.48);
    ctx.beginPath();
    ctx.moveTo(lerp(tailX, headX, 0.35), lerp(tailY, headY, 0.35));
    ctx.lineTo(headX, headY);
    ctx.stroke();

    if (p < 0.58) {
      const ang = Math.atan2(bm.y1 - bm.y0, bm.x1 - bm.x0);
      ctx.save();
      ctx.translate(headX, headY);
      ctx.rotate(ang);
      ctx.fillStyle = tipColor;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-4, -5.5);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-4, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-3, -2.8);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-3, 2.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (p >= 0.46) {
      const ip = clamp((p - 0.46) / 0.54, 0, 1);
      const ir = 10 + easeOutCubic(ip) * 28;
      ctx.strokeStyle = impactColor;
      ctx.lineWidth = 2.6 * (1 - ip);
      ctx.beginPath();
      ctx.ellipse(bm.x1, bm.y1, ir, ir * 0.32, 0, 0, TAU);
      ctx.stroke();
      drawStarFlare(ctx, bm.x1, bm.y1 - 4, 18 * (1 - ip * 0.8), 0.22, 4, ip * 1.2, impactColor, coreColor, 1 - ip);
    }

    ctx.restore();
  }

  /* 连续流光轨迹/丝带 */
  function drawLuminousRibbon(ctx, rb) {
    const pts = rb.pts;
    if (!pts || pts.length < 2) return;
    const fade = rb.age > rb.dur - rb.fadeOut ? clamp((rb.dur - rb.age) / rb.fadeOut, 0, 1) : 1;
    if (fade <= 0.01) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = clamp(fade * rb.alpha, 0, 1);

    const coreColor = rb.coreColor || '#FFFFFF';
    for (let i = 1; i < pts.length; i++) {
      const u = i / (pts.length - 1);
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const w = rb.width * (0.22 + 0.78 * Math.sin(u * Math.PI * 0.85));

      ctx.strokeStyle = rb.outerColor;
      ctx.lineWidth = w * 2.1;
      ctx.globalAlpha = clamp(fade * rb.alpha * 0.36 * u, 0, 1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.strokeStyle = rb.midColor;
      ctx.lineWidth = w;
      ctx.globalAlpha = clamp(fade * rb.alpha * 0.92 * u, 0, 1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();

      ctx.strokeStyle = coreColor;
      ctx.lineWidth = Math.max(1.2, w * 0.38);
      ctx.globalAlpha = clamp(fade * rb.alpha * u, 0, 1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 高压水流/能量光束增亮层（默认清透碧蓝水柱，支持可选 colors / palette 覆写） */
  function resolveWaterStreamTheme(ws) {
    const pal = resolvePalette(ws.palette);
    const c = ws.colors || {};
    if (!pal && !ws.colors) {
      return {
        edge: 'rgba(3,105,161,0.0)',
        mid: 'rgba(14,165,233,0.58)',
        inner: 'rgba(103,232,249,0.82)',
        strand: 'rgba(224,249,255,0.88)',
        core: 'rgba(255,255,255,0.92)',
        ring: '#67E8F9',
        ringHot: '#FFFFFF'
      };
    }
    const pEdge = pal ? pickPal(pal, 0.08) : '#0369A1';
    const pMid = pal ? pickPal(pal, 0.42) : '#0EA5E9';
    const pInner = pal ? pickPal(pal, 0.72) : '#67E8F9';
    const pPale = pal ? pickPal(pal, 0.90) : '#E0F9FF';
    const pCore = pal ? pickPal(pal, 1.0) : '#FFFFFF';
    return {
      edge: c.edge || withZeroAlpha(pEdge),
      mid: c.mid || toRgba(pMid, 0.58),
      inner: c.inner || toRgba(pInner, 0.82),
      strand: c.strand || toRgba(pPale, 0.88),
      core: c.core || toRgba(pCore, 0.92),
      ring: c.ring || pInner,
      ringHot: c.ringHot || '#FFFFFF'
    };
  }

  function drawWaterStreamOverlay(ctx, ws) {
    const grow = easeOutCubic(clamp(ws.age / ws.extendMs, 0, 1));
    const fade = ws.age > ws.dur - 190 ? clamp((ws.dur - ws.age) / 190, 0, 1) : 1;
    if (grow <= 0.02 || fade <= 0.02) return;

    const col = resolveWaterStreamTheme(ws);
    const dx = ws.x1 - ws.x0;
    const dy = ws.y1 - ws.y0;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    const len = dist * grow;
    const w = ws.width * (0.85 + 0.15 * Math.sin(ws.age * 0.045));

    ctx.save();
    ctx.translate(ws.x0, ws.y0);
    ctx.rotate(ang);
    ctx.globalAlpha = clamp(fade, 0, 1);

    const g = ctx.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, col.edge);
    g.addColorStop(0.2, col.mid);
    g.addColorStop(0.5, col.inner);
    g.addColorStop(0.8, col.mid);
    g.addColorStop(1, col.edge);
    ctx.fillStyle = g;
    ctx.fillRect(0, -w, len, w * 2);

    ctx.lineWidth = 2.6;
    ctx.strokeStyle = col.strand;
    for (let strand = 0; strand < 2; strand++) {
      ctx.beginPath();
      const ph = strand * Math.PI - ws.age * 0.026;
      for (let x = 0; x <= len; x += 8) {
        const y = Math.sin(x * 0.055 + ph) * (w * 0.62);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = col.core;
    ctx.fillRect(0, -w * 0.19, len, w * 0.38);

    for (let rIdx = 0; rIdx < 3; rIdx++) {
      const rp = ((ws.age * 0.0045 + rIdx / 3) % 1);
      const rx = rp * len;
      ctx.strokeStyle = rp > 0.7 ? col.ringHot : col.ring;
      ctx.lineWidth = 2.0 * (1 - rp * 0.4);
      ctx.beginPath();
      ctx.ellipse(rx, 0, 5, w * (0.85 + rp * 0.35), 0, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* 粒子绘制（含原有 shard/drop/snow/leaf/spark/star + 新增 cross/petal/ringlet） */
  function drawParticle(ctx, pt) {
    const lifeRatio = clamp(pt.life / pt.maxLife, 0, 1);
    const alpha = Math.min(1, lifeRatio * 2.4) * pt.alpha;
    if (alpha <= 0.02) return;

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.globalAlpha = clamp(alpha, 0, 1);

    if (pt.kind === 'shard') {
      ctx.rotate(pt.rot);
      const s = pt.size;
      ctx.fillStyle = pt.color2 || '#1658EB';
      ctx.beginPath();
      ctx.moveTo(s * 1.4, 0);
      ctx.lineTo(0, -s * 0.68);
      ctx.lineTo(-s * 1.2, 0);
      ctx.lineTo(0, s * 0.68);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.moveTo(s * 1.4, 0);
      ctx.lineTo(0, -s * 0.68);
      ctx.lineTo(-s * 1.2, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-s * 0.15, -s * 0.35, Math.max(1.5, s * 0.55), Math.max(1.2, s * 0.25));
    } else if (pt.kind === 'drop') {
      const ang = Math.atan2(pt.vy, pt.vx);
      ctx.rotate(ang);
      const s = pt.size;
      ctx.fillStyle = pt.color2 || '#0284C7';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.5, s * 0.78, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.ellipse(s * 0.15, -s * 0.1, s * 1.15, s * 0.52, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s * 0.45, -s * 0.2, Math.max(1, s * 0.28), 0, TAU);
      ctx.fill();
    } else if (pt.kind === 'snow') {
      ctx.rotate(pt.rot);
      const s = pt.size;
      ctx.strokeStyle = pt.color2 || '#38BDF8';
      ctx.lineWidth = 1.9;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * s, -Math.sin(a) * s);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.stroke();
      }
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.0;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * s * 0.85, -Math.sin(a) * s * 0.85);
        ctx.lineTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
        ctx.stroke();
      }
    } else if (pt.kind === 'leaf') {
      ctx.rotate(pt.rot);
      const flip = Math.cos(pt.age * 0.011 + pt.seed);
      ctx.scale(1, 0.35 + 0.65 * Math.abs(flip));
      const s = pt.size;
      ctx.fillStyle = pt.color2 || '#059669';
      ctx.beginPath();
      ctx.moveTo(s * 1.45, 0);
      ctx.quadraticCurveTo(0, -s * 0.85, -s * 1.35, 0);
      ctx.quadraticCurveTo(0, s * 0.85, s * 1.45, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.moveTo(s * 1.3, 0);
      ctx.quadraticCurveTo(0, -s * 0.55, -s * 1.1, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-s * 1.0, 0);
      ctx.lineTo(s * 1.1, 0);
      ctx.stroke();
    } else if (pt.kind === 'spark') {
      const ang = Math.atan2(pt.vy, pt.vx);
      const spd = Math.hypot(pt.vx, pt.vy);
      const len = clamp(pt.size * 2.2 + spd * 0.025, 5, 24);
      ctx.rotate(ang);
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = pt.size * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, pt.size * 0.42);
      ctx.beginPath();
      ctx.moveTo(-len * 0.55, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();
    } else if (pt.kind === 'cross') {
      // 新增形态 1：治疗翠绿十字光尘（清透发光十字 + 柔光微晕）
      const tw = 0.80 + 0.20 * Math.sin(pt.age * 0.02 + pt.seed);
      const s = pt.size * tw;
      const haloR = s * 1.85;
      const colMain = pt.color || '#34D399';
      const colEdge = pt.color2 || '#059669';

      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
      hg.addColorStop(0, toRgba(colMain, 0.52));
      hg.addColorStop(1, withZeroAlpha(colMain));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(0, 0, haloR, 0, TAU);
      ctx.fill();

      const armOuter = s * 1.32;
      const barOuter = Math.max(2.0, s * 0.56);
      ctx.fillStyle = colEdge;
      ctx.fillRect(-barOuter * 0.5, -armOuter, barOuter, armOuter * 2);
      ctx.fillRect(-armOuter, -barOuter * 0.5, armOuter * 2, barOuter);

      const armMid = s * 1.14;
      const barMid = Math.max(1.4, s * 0.38);
      ctx.fillStyle = colMain;
      ctx.fillRect(-barMid * 0.5, -armMid, barMid, armMid * 2);
      ctx.fillRect(-armMid, -barMid * 0.5, armMid * 2, barMid);

      const armCore = s * 0.86;
      const barCore = Math.max(1.0, s * 0.20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-barCore * 0.5, -armCore, barCore, armCore * 2);
      ctx.fillRect(-armCore, -barCore * 0.5, armCore * 2, barCore);
    } else if (pt.kind === 'petal') {
      // 新增形态 2：红莲火瓣 / 风花瓣（3D 翻滚双瓣心缺轮廓 + 亮棱高光）
      ctx.rotate(pt.rot);
      const flip = Math.cos(pt.age * 0.012 + pt.seed);
      ctx.scale(1, 0.36 + 0.64 * Math.abs(flip));
      const s = pt.size;
      const colEdge = pt.color2 || '#EA580C';
      const colFill = pt.color || '#FCD34D';

      ctx.fillStyle = colEdge;
      ctx.beginPath();
      ctx.moveTo(-s * 1.15, 0);
      ctx.bezierCurveTo(-s * 0.45, -s * 0.95, s * 0.85, -s * 0.95, s * 1.25, -s * 0.28);
      ctx.lineTo(s * 0.88, 0);
      ctx.lineTo(s * 1.25, s * 0.28);
      ctx.bezierCurveTo(s * 0.85, s * 0.95, -s * 0.45, s * 0.95, -s * 1.15, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = colFill;
      ctx.beginPath();
      ctx.moveTo(-s * 0.90, -s * 0.04);
      ctx.bezierCurveTo(-s * 0.28, -s * 0.72, s * 0.68, -s * 0.72, s * 1.05, -s * 0.20);
      ctx.lineTo(s * 0.64, 0);
      ctx.quadraticCurveTo(0, s * 0.18, -s * 0.90, -s * 0.04);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.moveTo(-s * 0.78, 0);
      ctx.quadraticCurveTo(s * 0.15, -s * 0.28, s * 0.82, -s * 0.12);
      ctx.stroke();
    } else if (pt.kind === 'ringlet') {
      // 新增形态 3：蚀月紫银微环（优雅自旋微环 + 珍珠钻石光珠）
      const ageP = 1 - lifeRatio;
      const s = pt.size * (0.72 + 0.58 * easeOutCubic(ageP));
      const sy = pt.sy != null ? pt.sy : 0.86;
      const colRing = pt.color || '#DDD6FE';
      const colOuter = pt.color2 || '#6D28D9';

      ctx.rotate(pt.rot);

      ctx.save();
      ctx.globalAlpha = clamp(alpha * 0.62, 0, 1);
      ctx.strokeStyle = colOuter;
      ctx.lineWidth = Math.max(1.8, pt.size * 0.42);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.04, s * sy * 1.04, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = colRing;
      ctx.lineWidth = Math.max(1.1, pt.size * 0.24);
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * sy, 0, 0, TAU);
      ctx.stroke();

      // 月牙银白亮缘 + 钻石光点
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(0.9, pt.size * 0.16);
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * sy, 0, -0.75, 0.85);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s, 0, Math.max(1.2, pt.size * 0.24), 0, TAU);
      ctx.fill();
    } else {
      // 'star' / 'mote': 璀璨菱形微星
      const tw = 0.72 + 0.28 * Math.sin(pt.age * 0.024 + pt.seed);
      const s = pt.size * tw;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.4);
      ctx.lineTo(s * 0.55, -s * 0.55);
      ctx.lineTo(s * 1.4, 0);
      ctx.lineTo(s * 0.55, s * 0.55);
      ctx.lineTo(0, s * 1.4);
      ctx.lineTo(-s * 0.55, s * 0.55);
      ctx.lineTo(-s * 1.4, 0);
      ctx.lineTo(-s * 0.55, -s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, s * 0.42), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================================
     核心内置 9 招原版元数据与编排（8 招保持原版不变 + ice_crystal 供 Pack 1 覆盖）
     ============================================================================ */
  const CORE_SKILLS_META = [
    {
      id: 'ice_crystal',
      name: '冰晶术',
      en: 'Ice Crystal',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1220,
      peakMs: 510,
      accent: '#38BDF8',
      desc: '明亮聚能晶环 → 电光冰枪疾射 → 裂纹晶块爆裂飞散'
    },
    {
      id: 'tri_prism_ice',
      name: '三棱冰晶',
      en: 'Tri-Prism Ice',
      kind: 'barrage',
      targetMode: 'single',
      duration: 1400,
      peakMs: 590,
      accent: '#0EA5E9',
      desc: '上/中/下三轨错峰 110ms 齐射棱晶冰枪 → 三连晶爆电弧'
    },
    {
      id: 'starfrost_scatter',
      name: '星霜散华',
      en: 'Starfrost Scatter',
      kind: 'ultimate',
      targetMode: 'single',
      duration: 1720,
      peakMs: 880,
      accent: '#7DD3FC',
      desc: '旋转冰蓝天穹法阵 + 8 道倾斜星霜光雨 → 巨型雪花金星爆'
    },
    {
      id: 'raging_surge',
      name: '激流涌',
      en: 'Raging Surge',
      kind: 'beam',
      targetMode: 'single',
      duration: 1460,
      peakMs: 580,
      accent: '#06B6D4',
      desc: '碧蓝涌泉 → 精准胸口高压清透水柱 + 翻涌巨浪满屏水花'
    },
    {
      id: 'water_cleave',
      name: '断水刃',
      en: 'Water Cleave',
      kind: 'melee',
      targetMode: 'single',
      duration: 1180,
      peakMs: 430,
      accent: '#22D3EE',
      desc: '极速跃进双连天蓝×电光青×纯白锋芒月牙交叉斩 + 飞溅水珠'
    },
    {
      id: 'frost_thorn_field',
      name: '霜域棘阵',
      en: 'Frost Thorn Field',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1680,
      peakMs: 680,
      accent: '#38BDF8',
      desc: '冰脉迅速蔓延 3 敌 → 70ms 节拍依次破土高大冰棘 + 飘雪全覆盖'
    },
    {
      id: 'steel_ice_curtain',
      name: '钢冰护幕',
      en: 'Steel Ice Curtain',
      kind: 'buff',
      targetMode: 'self',
      duration: 1520,
      peakMs: 620,
      accent: '#FDE68A',
      desc: '通透明亮冰蓝×淡金多面棱镜护盾 + 旋转晶环 + 落成闪光'
    },
    {
      id: 'sword_send_slash',
      name: '送刀斩',
      en: 'Sword Send Slash',
      kind: 'melee',
      targetMode: 'single',
      duration: 1220,
      peakMs: 430,
      accent: '#67E8F9',
      desc: '凌厉冰青×纯白大弧刀光 + 二段反手十字晶斩 + 高能爆星'
    },
    {
      id: 'wind_afterimage',
      name: '风行残像',
      en: 'Wind Afterimage',
      kind: 'dash',
      targetMode: 'single',
      duration: 1380,
      peakMs: 500,
      accent: '#34D399',
      desc: '明亮翡翠青双道旋风疾驰 + 三重晶透残像 + 飘散风叶星光'
    }
  ];

  const CORE_HANDLERS = {
    /* ---------- 1. 冰晶术 (ice_crystal，可由 Pack 1 覆盖缩小 -33%) ---------- */
    ice_crystal(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale, icePal } = o;
      const travelMs = 200;
      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: icePal }, {
              x: from.x - 16, y: groundY + 2, scale: 1.2 * ampScale,
              preWarmSec: 0.92, timeScale: 2.1, durMs: 420, layer: 'back',
              glowColor: 'rgba(56,189,248,0.45)', glowRadius: 48, glowAlpha: 0.45
            });
            kit.addMagicCircle({
              x: from.x - 16, y: groundY + 2, radius: 42 * ampScale, sy: 0.32,
              goldTriple: amp >= 3, dur: 460
            });
            kit.spawnPfx('ice_crystal', { palette: icePal, height: 30 }, {
              x: from.x + 8, y: from.y + 34, scale: 1.25 * ampScale,
              durMs: 260, fadeOutMs: 80, layer: 'front'
            });
            kit.addStarFlare({
              x: from.x + 8, y: from.y, r0: 4, r1: 28 * ampScale,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 240
            });
            kit.triggerAmpCastAura(from.x - 16, groundY, amp, false);
            kit.spawnBurstParticles(from.x + 8, from.y, 12, 'star', {
              spdMin: 25, spdMax: 85, colors: ['#E0F7FF', '#67E8F9', '#38BDF8'],
              gravity: -20, lifeMin: 220, lifeMax: 380
            });
          }
        },
        {
          at: 165,
          fn() {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const ang = Math.atan2(dy, dx);
            const ribbon = kit.addRibbon({
              pts: [{ x: from.x + 6, y: from.y }],
              width: 9 * ampScale,
              outerColor: '#1658EB',
              midColor: '#38BDF8',
              alpha: 0.92,
              dur: 420,
              fadeOut: 220
            });

            kit.spawnPfx('ice_lance', { palette: icePal, length: 54 }, {
              x: from.x + 6, y: from.y,
              angle: ang,
              scale: 1.62 * ampScale,
              timeScale: 1.4,
              durMs: travelMs + 70,
              fadeInMs: 25,
              fadeOutMs: 60,
              layer: 'front',
              glowColor: 'rgba(56,189,248,0.55)', glowRadius: 36, glowAlpha: 0.5,
              onUpdate(slot, dtSec, age) {
                const p = easeOutCubic(clamp(age / travelMs, 0, 1));
                slot.x = lerp(from.x + 6, to.x, p);
                slot.y = lerp(from.y, to.y, p);
                if (p < 1) {
                  ribbon.pts.push({ x: slot.x, y: slot.y });
                  if (ribbon.pts.length > 20) ribbon.pts.shift();
                  kit.addParticle({
                    kind: Math.random() < 0.55 ? 'shard' : 'star',
                    x: slot.x - Math.cos(ang) * 14 + (Math.random() - 0.5) * 12,
                    y: slot.y - Math.sin(ang) * 14 + (Math.random() - 0.5) * 12,
                    vx: -Math.cos(ang) * 55 + (Math.random() - 0.5) * 40,
                    vy: -Math.sin(ang) * 55 + (Math.random() - 0.5) * 40,
                    size: 3 + Math.random() * 3.2,
                    color: Math.random() < 0.35 ? '#FFFFFF' : '#67E8F9',
                    color2: '#1658EB',
                    life: 240 + Math.random() * 180
                  });
                }
              }
            });

            kit.addShockRing({
              x: from.x + 12, y: from.y, r0: 6, r1: 30, sy: 0.85,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3, dur: 200, layer: 'front'
            });
          }
        },
        {
          at: 365,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 6.5 + amp * 2.2, 240);
            kit.safeCall(o.onHitStop, 50 + amp * 14);

            kit.spawnPfx('ice_shatter', { palette: icePal }, {
              x: to.x, y: targetGroundY - 2,
              scale: 1.98 * ampScale,
              preWarmSec: 0.42,
              timeScale: 1.68,
              durMs: 840,
              fadeInMs: 12,
              fadeOutMs: 220,
              layer: 'main',
              glowColor: 'rgba(56,189,248,0.46)', glowRadius: 62 * ampScale, glowAlpha: 0.42
            });

            kit.spawnPfx('hit_spark', { palette: PALETTES.slash, height: 22, aim: 0.1 }, {
              x: to.x, y: to.y + 30, scale: 1.65 * ampScale,
              durMs: 380, layer: 'front'
            });

            kit.addFlash(to.x, to.y, 52 * ampScale, '#38BDF8', 150, 0.42);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 10, r1: 46 * ampScale, points: 8,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 260
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 2, r0: 12, r1: 86 * ampScale, sy: 0.30,
              color: '#0EA5E9', coreColor: '#FFFFFF', lineW: 4, dur: 440
            });

            kit.spawnBurstParticles(to.x, to.y, 24 + amp * 8, 'shard', {
              spdMin: 80, spdMax: 250, sizeMin: 3.6, sizeMax: 7.5,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'],
              color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.44, lifeMin: 480, lifeMax: 800
            });

            if (amp >= 2) {
              kit.spawnPfx('frost_nova', { palette: icePal, reach: 68 }, {
                x: to.x, y: targetGroundY + 2, scale: 1.35 * ampScale,
                preWarmSec: 0.38, timeScale: 1.45, durMs: 680, layer: 'back'
              });
            }
            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        },
        {
          at: 510,
          fn() {
            kit.safeCall(o.onShake, 5.2 + amp, 180);
            kit.addFlash(to.x, to.y - 6, 56 * ampScale, '#67E8F9', 160, 0.40);
            kit.addStarFlare({
              x: to.x, y: to.y - 8, r0: 10, r1: 52 * ampScale, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 320
            });
            kit.addShockRing({
              x: to.x, y: to.y - 6, r0: 14, r1: 78 * ampScale, sy: 0.85,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3.4, dur: 340, layer: 'front'
            });
            kit.spawnBurstParticles(to.x, to.y - 8, 36, 'shard', {
              spdMin: 115, spdMax: 320, upBias: 110, sizeMin: 4.0, sizeMax: 9.2,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8', '#0EA5E9'],
              color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.48, lifeMin: 460, lifeMax: 760
            });
            kit.spawnBurstParticles(to.x, to.y - 18, 20, 'snow', {
              spdMin: 22, spdMax: 78, upBias: 55, gravity: 24,
              sizeMin: 3.2, sizeMax: 6.2,
              colors: ['#FFFFFF', '#E0F7FF'], color2: '#38BDF8',
              lifeMin: 480, lifeMax: 740
            });
          }
        }
      ]);
    },

    /* ---------- 2. 三棱冰晶 (tri_prism_ice，原版照搬) ---------- */
    tri_prism_ice(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale, icePal } = o;
      const arcs = [-62, 0, 48];
      const stagger = 110;
      const travelMs = 215;

      const cues = [
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: icePal }, {
              x: from.x - 14, y: groundY + 2, scale: 1.25 * ampScale,
              preWarmSec: 0.95, timeScale: 2.2, durMs: 560, layer: 'back'
            });
            kit.addMagicCircle({
              x: from.x - 14, y: groundY + 2, radius: 44 * ampScale, sy: 0.32,
              goldTriple: amp >= 3, dur: 600
            });
            kit.triggerAmpCastAura(from.x - 14, groundY, amp, false);
            for (let k = 0; k < 3; k++) {
              const cy = from.y + (k - 1) * 20;
              kit.addStarFlare({
                x: from.x + 10, y: cy, r0: 4, r1: 22,
                outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 240 + k * 90
              });
            }
          }
        }
      ];

      for (let k = 0; k < 3; k++) {
        const launchAt = 120 + k * stagger;
        const hitAt = launchAt + travelMs;
        const arcLift = arcs[k];
        const p0 = { x: from.x + 10, y: from.y + (k - 1) * 14 };
        const p2 = { x: to.x + (k - 1) * 10, y: to.y + (k - 1) * 14 };
        const p1 = { x: (p0.x + p2.x) * 0.5, y: (p0.y + p2.y) * 0.5 + arcLift };

        cues.push({
          at: launchAt,
          fn() {
            const ribbon = kit.addRibbon({
              pts: [p0],
              width: 8.2 * ampScale,
              outerColor: '#1658EB',
              midColor: k === 1 ? '#67E8F9' : '#38BDF8',
              alpha: 0.95,
              dur: 640,
              fadeOut: 240
            });

            kit.spawnPfx('ice_lance', { palette: icePal, length: 50 }, {
              x: p0.x, y: p0.y,
              angle: quadBezierTangent(p0, p1, p2, 0),
              scale: 1.52 * ampScale,
              timeScale: 1.45,
              durMs: travelMs + 65,
              fadeInMs: 18,
              fadeOutMs: 55,
              layer: 'front',
              glowColor: 'rgba(56,189,248,0.46)', glowRadius: 30, glowAlpha: 0.4,
              onUpdate(slot, dtSec, age) {
                const t = easeOutCubic(clamp(age / travelMs, 0, 1));
                const pos = quadBezier(p0, p1, p2, t);
                slot.x = pos.x;
                slot.y = pos.y;
                slot.angle = quadBezierTangent(p0, p1, p2, Math.min(0.99, t));
                if (t < 1) {
                  ribbon.pts.push({ x: pos.x, y: pos.y });
                  if (ribbon.pts.length > 26) ribbon.pts.shift();
                  if (Math.random() < 0.72) {
                    kit.addParticle({
                      kind: 'star',
                      x: pos.x + (Math.random() - 0.5) * 10,
                      y: pos.y + (Math.random() - 0.5) * 10,
                      vx: (Math.random() - 0.5) * 45,
                      vy: (Math.random() - 0.5) * 45,
                      size: 3.0 + Math.random() * 2.5,
                      color: k === 1 ? '#FFFFFF' : '#67E8F9',
                      life: 280 + Math.random() * 160
                    });
                  }
                }
              }
            });
          }
        });

        cues.push({
          at: hitAt,
          fn() {
            const isLast = k === 2;
            kit.safeCall(o.onImpact, 0, p2, isLast);
            kit.safeCall(o.onShake, isLast ? (8 + amp * 2.2) : 4.5, isLast ? 240 : 120);
            kit.safeCall(o.onHitStop, isLast ? (60 + amp * 12) : 28);

            kit.spawnPfx(isLast ? 'crit_hit' : 'hit_spark', {
              palette: isLast ? icePal : PALETTES.slash,
              height: 22,
              aim: (k - 1) * 0.28
            }, {
              x: p2.x, y: p2.y + 30,
              scale: (isLast ? 1.65 : 1.52) * ampScale,
              durMs: isLast ? 560 : 420,
              layer: 'front'
            });

            kit.addFlash(p2.x, p2.y, (isLast ? 56 : 38) * ampScale, '#38BDF8', 140, isLast ? 0.44 : 0.36);
            kit.addStarFlare({
              x: p2.x, y: p2.y,
              r0: 8, r1: (isLast ? 52 : 36) * ampScale,
              points: isLast ? 8 : 4,
              outerColor: isLast && amp >= 2 ? '#FDE68A' : '#38BDF8',
              coreColor: '#FFFFFF',
              dur: isLast ? 340 : 280
            });
            kit.addShockRing({
              x: p2.x, y: p2.y, r0: 8, r1: (isLast ? 68 : 48) * ampScale, sy: 0.78,
              color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3.2, dur: 340, layer: 'front'
            });

            kit.addLightning(p2.x - 28, p2.y - 28, p2.x + 30, p2.y + 24, {
              outerColor: '#1658EB', midColor: '#67E8F9', width: 2.2, dur: 260, branches: 2
            });

            kit.spawnBurstParticles(p2.x, p2.y, isLast ? 28 : 16, 'shard', {
              spdMin: 85, spdMax: 260, sizeMin: 3.4, sizeMax: 7.0,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'],
              color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.4, lifeMin: 400, lifeMax: 700
            });
            kit.spawnBurstParticles(p2.x, p2.y, isLast ? 20 : 10, 'spark', {
              spdMin: 140, spdMax: 330, sizeMin: 2.4, sizeMax: 4.2,
              colors: ['#FFFFFF', '#67E8F9', '#FDE68A'],
              gravity: 160, lifeMin: 240, lifeMax: 440
            });

            if (isLast) {
              kit.spawnPfx('ice_shatter', { palette: icePal }, {
                x: to.x, y: targetGroundY - 2, scale: 1.72 * ampScale,
                preWarmSec: 0.56, timeScale: 1.75, durMs: 740, layer: 'main',
                glowColor: 'rgba(56,189,248,0.44)', glowRadius: 56 * ampScale, glowAlpha: 0.4
              });
              kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
            }
          }
        });
      }

      kit.scheduleTimeline(cues);
    },

    /* ---------- 3. 星霜散华 (starfrost_scatter，原版照搬) ---------- */
    starfrost_scatter(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale, icePal } = o;
      const cues = [
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: icePal }, {
              x: from.x - 10, y: groundY + 4, scale: 1.55 * ampScale,
              preWarmSec: 0.88, timeScale: 1.9, durMs: 760, layer: 'back',
              glowColor: 'rgba(56,189,248,0.42)', glowRadius: 56, glowAlpha: 0.38
            });
            kit.addMagicCircle({
              x: from.x - 10, y: groundY + 4, radius: 56 * ampScale, sy: 0.30,
              goldTriple: amp >= 2, dur: 880, fadeIn: 140, fadeOut: 240
            });
            kit.addMagicCircle({
              x: to.x - 24, y: 46, radius: 96 * ampScale, sy: 0.27,
              rimColor: '#0EA5E9', starColor: '#FDE68A', runeColor: '#FFFFFF',
              innerGlow: 'rgba(224,247,255,0.62)', outerGlow: 'rgba(56,189,248,0.28)',
              goldTriple: true, lineW: 2.6,
              dur: 1120, fadeIn: 150, fadeOut: 260, layer: 'front'
            });
            kit.triggerAmpCastAura(from.x - 10, groundY, amp, false);
          }
        }
      ];

      const rainOffsets = [-84, -40, 14, 64, -62, -10, 42, 76];
      for (let i = 0; i < 8; i++) {
        const dropAt = 210 + i * 68;
        const ox = rainOffsets[i];
        const tx = to.x + ox;
        const ty = targetGroundY + (i % 3 - 1) * 7;
        const isGold = i % 3 === 2 || amp >= 3;

        cues.push({
          at: dropAt,
          fn() {
            kit.addSkyBeam({
              x0: tx - 96, y0: -16,
              x1: tx, y1: ty,
              width: (i % 2 === 0 ? 7.8 : 6.0) * ampScale,
              gold: isGold,
              dur: 540
            });
            if (i % 2 === 0) {
              kit.spawnPfx('icicle_fall', { palette: isGold ? PALETTES.iceGold : PALETTES.ice }, {
                x: tx, y: ty, scale: 1.55 * ampScale,
                preWarmSec: 0.50, timeScale: 1.75, durMs: 700, layer: 'main'
              });
            }
          }
        });

        cues.push({
          at: dropAt + 220,
          fn() {
            kit.safeCall(o.onShake, 3.2, 90);
            kit.spawnBurstParticles(tx, ty - 6, 8, 'shard', {
              spdMin: 55, spdMax: 165, upBias: 60, sizeMin: 2.8, sizeMax: 5.5,
              colors: isGold ? ['#FEF9C3', '#FDE68A', '#67E8F9'] : ['#FFFFFF', '#BAE6FD', '#38BDF8'],
              groundY: ty, bounce: 0.35, lifeMin: 300, lifeMax: 520
            });
          }
        });
      }

      cues.push({
        at: 710,
        fn() {
          kit.safeCall(o.onImpact, 0, to, true);
          kit.safeCall(o.onShake, 10.5 + amp * 2.5, 340);
          kit.safeCall(o.onHitStop, 75 + amp * 15);

          kit.spawnPfx('frost_nova', { palette: amp >= 2 ? PALETTES.iceGold : PALETTES.ice, reach: 108 }, {
            x: to.x, y: targetGroundY + 4,
            scale: 1.92 * ampScale,
            preWarmSec: 0.42, timeScale: 1.42, durMs: 920,
            layer: 'back',
            glowColor: 'rgba(56,189,248,0.34)', glowRadius: 72 * ampScale, glowAlpha: 0.32
          });

          kit.spawnPfx('snowflake_burst', { palette: PALETTES.ice, count: 11 }, {
            x: to.x, y: targetGroundY + 12,
            scale: 2.15 * ampScale,
            preWarmSec: 0.22, timeScale: 1.25, durMs: 980,
            layer: 'front',
            glowColor: 'rgba(125,211,252,0.28)', glowRadius: 60, glowAlpha: 0.28
          });

          kit.spawnPfx('crit_hit', { palette: PALETTES.gold, height: 26, aim: 0.08 }, {
            x: to.x, y: to.y + 34,
            scale: 1.78 * ampScale, durMs: 560, layer: 'front'
          });

          kit.addFlash(to.x, to.y - 10, 72 * ampScale, '#7DD3FC', 190, 0.36);
          kit.addStarFlare({
            x: to.x, y: to.y - 12, r0: 14, r1: 78 * ampScale, inner: 0.16, points: 8,
            outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 480
          });
          kit.addStarFlare({
            x: to.x, y: to.y - 12, r0: 10, r1: 60 * ampScale, inner: 0.22, points: 6, rot: 0.3,
            outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 440
          });
          kit.addShockRing({
            x: to.x, y: targetGroundY + 4, r0: 18, r1: 142 * ampScale, sy: 0.28,
            color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.5, dur: 560
          });
          kit.addShockRing({
            x: to.x, y: targetGroundY + 4, r0: 10, r1: 116 * ampScale, sy: 0.28,
            color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.5, dur: 500
          });

          kit.spawnBurstParticles(to.x, to.y - 16, 36 + amp * 10, 'star', {
            spdMin: 70, spdMax: 290, upBias: 70, gravity: 95,
            sizeMin: 4, sizeMax: 8.5,
            colors: ['#FDE68A', '#FCD34D', '#FFFFFF', '#67E8F9', '#38BDF8'],
            lifeMin: 560, lifeMax: 940
          });
          kit.spawnBurstParticles(to.x, to.y - 36, 38, 'snow', {
            spdMin: 45, spdMax: 180, upBias: 85, gravity: 26,
            sizeMin: 4.0, sizeMax: 8.2,
            colors: ['#FFFFFF', '#E0F7FF', '#FEF9C3'], color2: '#0EA5E9',
            lifeMin: 640, lifeMax: 980
          });

          kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
        }
      });

      kit.scheduleTimeline(cues);
    },

    /* ---------- 4. 激流涌 (raging_surge，原版照搬) ---------- */
    raging_surge(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const jetStart = { x: from.x + 8, y: from.y - 2 };
      const jetEnd = { x: to.x, y: to.y - 4 };
      const dx = jetEnd.x - jetStart.x;
      const dy = jetEnd.y - jetStart.y;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const jetScale = 1.55 * (1 + amp * 0.06);
      const extendMs = 155;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addMagicCircle({
              x: from.x - 8, y: groundY + 2, radius: 44 * ampScale, sy: 0.30,
              rimColor: '#0284C7', starColor: '#22D3EE', runeColor: '#CFFAFE',
              innerGlow: 'rgba(207,250,254,0.72)', outerGlow: 'rgba(6,182,212,0.34)',
              goldTriple: amp >= 3, dur: 520
            });
            kit.spawnPfx('splash', { palette: PALETTES.water, stone: false }, {
              x: from.x - 4, y: groundY + 4, scale: 1.35 * ampScale,
              preWarmSec: 0.22, timeScale: 1.45, durMs: 520, layer: 'back'
            });
            kit.addShockRing({
              x: jetStart.x, y: jetStart.y, r0: 6, r1: 34, sy: 0.85,
              color: '#22D3EE', coreColor: '#FFFFFF', lineW: 3.5, dur: 260, layer: 'front'
            });
            kit.triggerAmpCastAura(from.x - 8, groundY, amp, false);
            kit.spawnBurstParticles(jetStart.x, jetStart.y, 16, 'drop', {
              spdMin: 55, spdMax: 160, upBias: 60, sizeMin: 3, sizeMax: 5.5,
              colors: ['#CFFAFE', '#67E8F9', '#22D3EE'], color2: '#0284C7',
              groundY, lifeMin: 280, lifeMax: 460
            });
          }
        },
        {
          at: 165,
          fn() {
            const pfxLen = Math.max(60, Math.min(205, Math.round(dist / jetScale)));
            kit.spawnPfx('water_jet', { palette: PALETTES.water, length: pfxLen }, {
              x: jetStart.x, y: jetStart.y - 6,
              angle: ang,
              scale: jetScale,
              timeScale: 1.35,
              durMs: 620,
              fadeInMs: 25,
              fadeOutMs: 180,
              layer: 'front',
              clipRight: 0.08,
              glowColor: 'rgba(34,211,238,0.38)', glowRadius: 38, glowAlpha: 0.36,
              onUpdate(slot, dtSec, age) {
                slot.clipRight = easeOutCubic(clamp(age / extendMs, 0.08, 1));
              }
            });

            kit.addWaterStream({
              x0: jetStart.x, y0: jetStart.y,
              x1: jetEnd.x, y1: jetEnd.y,
              width: 17 * ampScale,
              extendMs,
              dur: 620
            });
          }
        },
        {
          at: 165 + extendMs,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 8.8 + amp * 2.2, 320);
            kit.safeCall(o.onHitStop, 55 + amp * 12);

            kit.spawnPfx('wave_crash', { palette: PALETTES.water }, {
              x: to.x + 36, y: targetGroundY + 6,
              scale: 2.02 * ampScale,
              preWarmSec: 0.56, timeScale: 1.48, durMs: 980,
              layer: 'main',
              glowColor: 'rgba(14,165,233,0.42)', glowRadius: 72 * ampScale, glowAlpha: 0.42
            });

            kit.spawnPfx('splash', { palette: PALETTES.water, stone: false }, {
              x: to.x, y: targetGroundY + 4,
              scale: 1.98 * ampScale,
              preWarmSec: 0.24, timeScale: 1.32, durMs: 880,
              layer: 'front'
            });

            kit.addFlash(to.x, to.y, 62 * ampScale, '#22D3EE', 175, 0.44);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 10, r1: 50 * ampScale, points: 6,
              outerColor: '#22D3EE', coreColor: '#FFFFFF', dur: 300
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 16, r1: 128 * ampScale, sy: 0.28,
              color: '#0EA5E9', coreColor: '#CFFAFE', lineW: 4.5, dur: 540
            });

            kit.spawnBurstParticles(to.x, to.y, 48 + amp * 12, 'drop', {
              spdMin: 95, spdMax: 330, upBias: 135, gravity: 460,
              sizeMin: 3.4, sizeMax: 7.4,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE', '#38BDF8'],
              color2: '#0284C7',
              groundY: targetGroundY, bounce: 0.32, lifeMin: 460, lifeMax: 840
            });
            kit.spawnBurstParticles(to.x, to.y - 14, 18, 'star', {
              spdMin: 60, spdMax: 210, upBias: 80, gravity: 120,
              sizeMin: 3, sizeMax: 6,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9'],
              lifeMin: 400, lifeMax: 720
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        },
        {
          at: 540,
          fn() {
            kit.spawnBurstParticles(to.x + 12, targetGroundY - 26, 26, 'drop', {
              spdMin: 80, spdMax: 250, upBias: 120, gravity: 420,
              sizeMin: 3, sizeMax: 6.2,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#38BDF8'],
              color2: '#0369A1',
              groundY: targetGroundY, bounce: 0.28, lifeMin: 400, lifeMax: 700
            });
            kit.addShockRing({
              x: to.x + 6, y: targetGroundY + 4, r0: 24, r1: 152 * ampScale, sy: 0.26,
              color: '#22D3EE', coreColor: '#FFFFFF', lineW: 3.2, dur: 520
            });
          }
        }
      ]);
    },

    /* ---------- 5. 断水刃 (water_cleave，原版照搬) ---------- */
    water_cleave(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const dashMs = 195;
      const p0 = { x: from.x, y: from.y + 12 };
      const p2 = { x: to.x - 36, y: to.y + 4 };
      const p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 52 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addShockRing({
              x: from.x, y: groundY + 2, r0: 8, r1: 48, sy: 0.30,
              color: '#0EA5E9', coreColor: '#CFFAFE', lineW: 3.5, dur: 280
            });
            kit.triggerAmpCastAura(from.x, groundY, amp, false);

            const dashRibbon = kit.addRibbon({
              pts: [p0],
              width: 11 * ampScale,
              outerColor: '#0284C7',
              midColor: '#22D3EE',
              alpha: 0.9,
              dur: 460,
              fadeOut: 240
            });

            const stepN = 14;
            for (let i = 1; i <= stepN; i++) {
              const t = i / stepN;
              dashRibbon.pts.push(quadBezier(p0, p1, p2, t));
            }
            kit.spawnBurstParticles(from.x + 12, from.y, 16, 'drop', {
              angleBase: -0.3, spread: 0.9, spdMin: 120, spdMax: 260,
              sizeMin: 2.8, sizeMax: 5.5,
              colors: ['#FFFFFF', '#67E8F9', '#22D3EE'], color2: '#0284C7',
              groundY, lifeMin: 260, lifeMax: 450
            });
          }
        },
        {
          at: dashMs,
          fn() {
            kit.safeCall(o.onShake, 5.2, 130);
            kit.safeCall(o.onHitStop, 35);

            const dsScale = 1.92 * ampScale;
            kit.spawnPfx('double_slash', {
              palette: amp >= 3 ? PALETTES.slashGold : PALETTES.slash,
              sparks: PALETTES.aquaSpark
            }, {
              x: to.x - 34 * dsScale,
              y: to.y + 23 * dsScale,
              scale: dsScale,
              timeScale: 1.05,
              durMs: 760,
              fadeInMs: 10,
              fadeOutMs: 180,
              layer: 'front'
            });

            kit.addSlash({
              x: to.x - 4, y: to.y + 2,
              rx: 88 * ampScale, ry: 54 * ampScale,
              tilt: -0.58,
              startAngle: -2.45, endAngle: 0.72,
              thickness: 22 * ampScale,
              outerColor: '#0284C7',
              midColor: '#22D3EE',
              hiColor: '#A5F3FC',
              dur: 480
            });

            kit.addStarFlare({
              x: to.x, y: to.y, r0: 8, r1: 36 * ampScale, points: 4, rot: -0.58,
              outerColor: '#22D3EE', coreColor: '#FFFFFF', dur: 260
            });

            kit.spawnBurstParticles(to.x, to.y, 22, 'drop', {
              angleBase: -0.6, spread: 1.3, spdMin: 110, spdMax: 290, upBias: 60,
              sizeMin: 3.2, sizeMax: 6.4,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE'],
              color2: '#0284C7', groundY: targetGroundY, bounce: 0.35,
              lifeMin: 380, lifeMax: 660
            });
          }
        },
        {
          at: dashMs + 145,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 8.2 + amp * 2.2, 240);
            kit.safeCall(o.onHitStop, 60 + amp * 12);

            kit.addSlash({
              x: to.x + 2, y: to.y - 2,
              rx: 94 * ampScale, ry: 58 * ampScale,
              tilt: 0.56,
              startAngle: 2.48, endAngle: -0.78,
              thickness: 25 * ampScale,
              outerColor: '#1658EB',
              midColor: '#0EA5E9',
              hiColor: '#67E8F9',
              dur: 460
            });

            kit.spawnPfx('splash', { palette: PALETTES.water, stone: false }, {
              x: to.x + 6, y: targetGroundY + 2, scale: 1.55 * ampScale,
              preWarmSec: 0.24, timeScale: 1.38, durMs: 680, layer: 'main'
            });

            kit.addFlash(to.x, to.y, 48 * ampScale, '#38BDF8', 150, 0.34);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 10, r1: 48 * ampScale, points: 8, rot: 0.56,
              outerColor: amp >= 3 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 320
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 2, r0: 14, r1: 96 * ampScale, sy: 0.28,
              color: '#0EA5E9', coreColor: '#CFFAFE', lineW: 3.8, dur: 420
            });

            kit.spawnBurstParticles(to.x, to.y, 36 + amp * 8, 'drop', {
              angleBase: 0.4, spread: 2.4, spdMin: 120, spdMax: 320, upBias: 95,
              sizeMin: 3.4, sizeMax: 7.0,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#38BDF8', '#0EA5E9'],
              color2: '#0369A1', groundY: targetGroundY, bounce: 0.35,
              lifeMin: 420, lifeMax: 760
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ---------- 6. 霜域棘阵 · 3 目标群攻 (frost_thorn_field，支持 o.beatGapMs 多拍穿刺节奏) ---------- */
    frost_thorn_field(kit, o) {
      const { from, groundY, targets, amp, ampScale, icePal } = o;
      const rawBeatGap = Number(o.beatGapMs);
      const beatMs = (Number.isFinite(rawBeatGap) && rawBeatGap >= 20) ? clamp(rawBeatGap, 20, 600) : 70;
      const spanMs = Math.max(0, targets.length - 1) * beatMs;
      const cues = [
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: icePal }, {
              x: from.x - 10, y: groundY + 4, scale: 1.38 * ampScale,
              preWarmSec: 0.95, timeScale: 2.0, durMs: Math.max(560, 340 + spanMs), layer: 'back'
            });
            kit.addMagicCircle({
              x: from.x - 10, y: groundY + 4, radius: 48 * ampScale, sy: 0.30,
              goldTriple: amp >= 3, dur: Math.max(620, 400 + spanMs)
            });
            kit.triggerAmpCastAura(from.x - 10, groundY, amp, false);
          }
        },
        {
          at: 115,
          fn() {
            const rng = makeRng(kit.nextSeed());
            for (let idx = 0; idx < targets.length; idx++) {
              const tg = targets[idx];
              const sx = from.x + 6;
              const sy = groundY + 2;
              const ex = tg.x;
              const ey = tg.groundY + 2;
              const segs = 7;
              const pts = [{ x: sx, y: sy }];
              const spurs = [];
              for (let s = 1; s < segs; s++) {
                const u = s / segs;
                const jx = (rng() - 0.5) * 14;
                const jy = (rng() - 0.5) * 12;
                const px = lerp(sx, ex, u) + jx;
                const py = lerp(sy, ey, u) + jy;
                pts.push({ x: px, y: py });
                spurs.push({
                  at: u,
                  x: px, y: py,
                  dx: (rng() - 0.3) * 26,
                  dy: (rng() < 0.5 ? -1 : 1) * (10 + rng() * 14)
                });
              }
              pts.push({ x: ex, y: ey });

              kit.addIceVein({
                pts,
                spurs,
                width: 3.4 * ampScale,
                growMs: 225 + idx * beatMs,
                dur: Math.max(1220, 960 + spanMs)
              });
            }

            kit.spawnPfx('ice_spikes', { palette: icePal, reach: 138, height: 34 }, {
              x: from.x + 28, y: groundY + 4,
              scale: 1.38 * ampScale,
              timeScale: 1.75, durMs: Math.max(780, 520 + spanMs), layer: 'back'
            });
          }
        }
      ];

      for (let idx = 0; idx < targets.length; idx++) {
        const tg = targets[idx];
        const eruptAt = 340 + idx * beatMs;
        const isLast = idx === targets.length - 1;

        cues.push({
          at: eruptAt,
          fn() {
            kit.safeCall(o.onImpact, idx, tg, isLast);
            kit.safeCall(o.onShake, isLast ? (9 + amp * 2) : 5.2, isLast ? 280 : 140);
            if (isLast) kit.safeCall(o.onHitStop, 58 + amp * 12);

            kit.spawnPfx('ice_spikes', { palette: icePal, reach: 58, height: 64 }, {
              x: tg.x - 36, y: tg.groundY + 5,
              scale: 1.65 * ampScale,
              preWarmSec: 0.08, timeScale: 1.48, durMs: 960,
              layer: 'main',
              glowColor: 'rgba(56,189,248,0.58)', glowRadius: 56 * ampScale, glowAlpha: 0.52
            });

            kit.spawnPfx('frost_nova', { palette: icePal, reach: 48 }, {
              x: tg.x, y: tg.groundY + 4,
              scale: 1.28 * ampScale,
              preWarmSec: 0.42, timeScale: 1.5, durMs: 760,
              layer: 'back'
            });

            const rng = makeRng(kit.nextSeed() + idx * 31);
            kit.addHeroThorns({
              x: tg.x, y: tg.groundY + 4,
              goldAccent: amp >= 3,
              dur: 980,
              spikes: [
                { dx: -24, h: 52 * ampScale, w: 15, lean: -14, delay: 20, primary: false },
                { dx: 24,  h: 56 * ampScale, w: 16, lean: 16,  delay: 25, primary: false },
                { dx: -8,  h: 82 * ampScale, w: 20, lean: -7,  delay: 0,  primary: true },
                { dx: 10,  h: 74 * ampScale, w: 18, lean: 10,  delay: 12, primary: true },
                { dx: 0,   h: (94 + rng() * 10) * ampScale, w: 23, lean: (idx - 1) * 6, delay: 0, primary: true }
              ]
            });

            kit.addFlash(tg.x, tg.y + 6, 48 * ampScale, '#38BDF8', 160, 0.48);
            kit.addStarFlare({
              x: tg.x, y: tg.y - 12, r0: 8, r1: 40 * ampScale, points: 6,
              outerColor: amp >= 3 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 300
            });
            kit.addShockRing({
              x: tg.x, y: tg.groundY + 4, r0: 10, r1: 68 * ampScale, sy: 0.30,
              color: '#0EA5E9', coreColor: '#FFFFFF', lineW: 3.6, dur: 420
            });

            kit.spawnBurstParticles(tg.x, tg.groundY - 12, 18 + amp * 4, 'shard', {
              spdMin: 75, spdMax: 230, upBias: 135, sizeMin: 3.4, sizeMax: 7.2,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'],
              color2: '#1658EB',
              groundY: tg.groundY, bounce: 0.4, lifeMin: 440, lifeMax: 780
            });

            if (isLast) {
              kit.triggerAmpImpactUpgrade(tg.x, tg.y, tg.groundY, amp);
            } else if (amp >= 3) {
              kit.addLightning(tg.x, tg.y, targets[idx + 1].x, targets[idx + 1].y, {
                outerColor: '#D97706', midColor: '#FDE68A', width: 2.3, dur: 280, branches: 2
              });
            }
          }
        });
      }

      cues.push({
        at: Math.max(430, 340 + spanMs - 50),
        fn() {
          const leftX = targets[0].x;
          const rightX = targets[targets.length - 1].x;
          const midX = (leftX + rightX) * 0.5;

          kit.spawnPfx('snowflake_burst', { palette: icePal, count: 9 }, {
            x: leftX + 10, y: groundY - 4, scale: 1.52 * ampScale,
            preWarmSec: 0.14, timeScale: 1.25, durMs: 960, layer: 'front'
          });
          kit.spawnPfx('snowflake_burst', { palette: icePal, count: 9 }, {
            x: rightX - 10, y: groundY + 4, scale: 1.52 * ampScale,
            preWarmSec: 0.14, timeScale: 1.25, durMs: 960, layer: 'front'
          });

          const rng = makeRng(kit.nextSeed());
          for (let i = 0; i < 46; i++) {
            kit.addParticle({
              kind: i % 4 === 0 ? 'star' : 'snow',
              x: midX + (rng() - 0.5) * 260,
              y: 36 + rng() * 145,
              vx: (rng() - 0.5) * 32,
              vy: 24 + rng() * 44,
              gravity: 10,
              drag: 0.4,
              size: 3.4 + rng() * 4.4,
              rot: rng() * TAU,
              vrot: (rng() - 0.5) * 3.2,
              color: i % 5 === 0 && amp >= 3 ? '#FDE68A' : '#FFFFFF',
              color2: '#38BDF8',
              life: 720 + rng() * 440,
              groundY: groundY + 22
            });
          }
        }
      });

      kit.scheduleTimeline(cues);
    },

    /* ---------- 7. 钢冰护幕 (steel_ice_curtain，原版照搬) ---------- */
    steel_ice_curtain(kit, o) {
      const { from, groundY, amp, ampScale } = o;
      const cx = from.x - 16;
      const cy = from.y + 4;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('magic_circle_cast', { palette: PALETTES.shield }, {
              x: cx, y: groundY + 4, scale: 1.48 * ampScale,
              preWarmSec: 0.88, timeScale: 1.85, durMs: 760, layer: 'back',
              glowColor: 'rgba(56,189,248,0.36)', glowRadius: 60, glowAlpha: 0.36
            });
            kit.addMagicCircle({
              x: cx, y: groundY + 4, radius: 58 * ampScale, sy: 0.30,
              rimColor: '#0EA5E9', starColor: '#FDE68A', runeColor: '#FFFFFF',
              innerGlow: 'rgba(224,247,255,0.58)', outerGlow: 'rgba(253,230,138,0.30)',
              goldTriple: amp >= 2, dur: 1220, fadeIn: 140, fadeOut: 280
            });
            kit.triggerAmpCastAura(cx, groundY, amp, false);

            kit.spawnBurstParticles(cx, groundY - 4, 24, 'star', {
              spdMin: 30, spdMax: 95, upBias: 120, gravity: -35,
              sizeMin: 3, sizeMax: 6.5,
              colors: ['#FFFFFF', '#BAE6FD', '#38BDF8', '#FDE68A'],
              lifeMin: 480, lifeMax: 840
            });
          }
        },
        {
          at: 190,
          fn() {
            kit.spawnPfx('divine_shield', { palette: PALETTES.shield, radius: 34 }, {
              x: cx, y: cy + 44,
              scale: 1.94 * ampScale,
              alpha: 0.72,
              lightGain: 0.9,
              timeScale: 1.15, durMs: 1180,
              fadeInMs: 140, fadeOutMs: 280,
              layer: 'main',
              glowColor: 'rgba(56,189,248,0.28)', glowRadius: 68 * ampScale, glowAlpha: 0.28
            });

            kit.addPrismShield({
              x: cx, y: cy - 2,
              radius: 64 * ampScale,
              ampTier: amp,
              lockAt: 260,
              dur: 1180
            });
          }
        },
        {
          at: 450,
          fn() {
            kit.safeCall(o.onImpact, 0, { x: cx, y: cy }, true);
            kit.safeCall(o.onShake, 3.8 + amp, 150);

            kit.spawnPfx('parry', { palette: PALETTES.gold7, height: 28 }, {
              x: cx, y: cy + 46, scale: 1.55 * ampScale,
              alpha: 0.56, durMs: 420, layer: 'front'
            });

            kit.addStarFlare({
              x: cx, y: cy - 62 * ampScale, r0: 8, r1: 36 * ampScale, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 460
            });
            kit.addStarFlare({
              x: cx - 58 * ampScale, y: cy - 4, r0: 6, r1: 24 * ampScale, points: 4,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 420
            });
            kit.addStarFlare({
              x: cx + 58 * ampScale, y: cy - 4, r0: 6, r1: 24 * ampScale, points: 4,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: cx, y: cy, r0: 52 * ampScale, r1: 108 * ampScale, sy: 0.96,
              color: '#F59E0B', coreColor: '#FFFFFF', lineW: 3.6, dur: 440, layer: 'front'
            });
            kit.addShockRing({
              x: cx, y: groundY + 4, r0: 18, r1: 98 * ampScale, sy: 0.30,
              color: '#38BDF8', coreColor: '#FEF9C3', lineW: 3.4, dur: 480
            });

            kit.spawnBurstParticles(cx, cy, 24 + amp * 6, 'star', {
              spdMin: 68, spdMax: 175, upBias: 35, gravity: -15,
              sizeMin: 3.5, sizeMax: 7,
              colors: ['#FFFFFF', '#FDE68A', '#67E8F9', '#38BDF8'],
              lifeMin: 480, lifeMax: 820
            });

            if (amp >= 3) {
              kit.addMagicCircle({
                x: cx, y: groundY + 4, radius: 74, sy: 0.30,
                rimColor: '#F59E0B', starColor: '#FDE68A', runeColor: '#FFFFFF',
                innerGlow: 'rgba(254,249,195,0.45)', outerGlow: 'rgba(245,158,11,0.28)',
                goldTriple: true, dur: 760, fadeIn: 90, fadeOut: 240
              });
              for (let b = 0; b < 4; b++) {
                const a = (b / 4) * TAU + 0.4;
                const rIn = 58 * ampScale;
                const rOut = 92 * ampScale;
                kit.addLightning(
                  cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn * 0.85,
                  cx + Math.cos(a + 0.55) * rOut, cy + Math.sin(a + 0.55) * rOut * 0.85,
                  { outerColor: '#D97706', midColor: '#FDE68A', width: 2.2, dur: 300, branches: 2 }
                );
              }
            }
          }
        }
      ]);
    },

    /* ---------- 8. 送刀斩 (sword_send_slash，原版照搬) ---------- */
    sword_send_slash(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.addStarFlare({
              x: from.x + 12, y: from.y - 4, r0: 6, r1: 38 * ampScale, points: 4,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 220
            });
            kit.triggerAmpCastAura(from.x - 10, groundY, amp, false);

            const dashPts = [];
            for (let i = 0; i <= 10; i++) {
              const t = i / 10;
              dashPts.push({
                x: lerp(from.x + 8, to.x - 24, t),
                y: lerp(from.y, to.y, t) - Math.sin(t * Math.PI) * 14
              });
            }
            kit.addRibbon({
              pts: dashPts,
              width: 9.5 * ampScale,
              outerColor: '#1658EB',
              midColor: '#67E8F9',
              alpha: 0.94,
              dur: 440,
              fadeOut: 220
            });
          }
        },
        {
          at: 165,
          fn() {
            kit.safeCall(o.onShake, 5.8, 150);
            kit.safeCall(o.onHitStop, 40);

            const swScale = 2.08 * ampScale;
            kit.spawnPfx('sword_slash', {
              palette: amp >= 3 ? PALETTES.slashGold : PALETTES.slash,
              sparks: PALETTES.cyanSpark,
              radius: 48
            }, {
              x: to.x - 26 * swScale,
              y: to.y + 38 * swScale,
              scale: swScale,
              durMs: 640,
              fadeInMs: 10,
              fadeOutMs: 160,
              layer: 'front'
            });

            kit.addSlash({
              x: to.x - 12, y: to.y + 6,
              rx: 114 * ampScale, ry: 74 * ampScale,
              tilt: -0.22,
              startAngle: -2.65, endAngle: 0.88,
              thickness: 27 * ampScale,
              outerColor: '#1658EB',
              midColor: '#38BDF8',
              hiColor: '#CFFAFE',
              dur: 480
            });

            kit.spawnBurstParticles(to.x, to.y, 18, 'spark', {
              spdMin: 150, spdMax: 340, sizeMin: 2.5, sizeMax: 4.5,
              colors: ['#FFFFFF', '#67E8F9', '#38BDF8'],
              gravity: 140, lifeMin: 240, lifeMax: 420
            });
          }
        },
        {
          at: 345,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 9.8 + amp * 2.4, 280);
            kit.safeCall(o.onHitStop, 72 + amp * 15);

            const dsScale = 1.98 * ampScale;
            kit.spawnPfx('double_slash', {
              palette: amp >= 3 ? PALETTES.slashGold : PALETTES.slash,
              sparks: amp >= 2 ? PALETTES.goldSpark : PALETTES.cyanSpark
            }, {
              x: to.x - 34 * dsScale,
              y: to.y + 23 * dsScale,
              scale: dsScale,
              durMs: 740,
              fadeInMs: 10,
              fadeOutMs: 190,
              layer: 'front'
            });

            kit.addSlash({
              x: to.x, y: to.y,
              rx: 98 * ampScale, ry: 54 * ampScale,
              tilt: 0.68,
              startAngle: 2.55, endAngle: -0.78,
              thickness: 24 * ampScale,
              outerColor: '#1658EB',
              midColor: '#0EA5E9',
              hiColor: '#E0F9FF',
              dur: 450
            });
            kit.addSlash({
              x: to.x, y: to.y,
              rx: 94 * ampScale, ry: 50 * ampScale,
              tilt: -0.68,
              startAngle: -2.55, endAngle: 0.78,
              thickness: 22 * ampScale,
              outerColor: '#0284C7',
              midColor: '#67E8F9',
              hiColor: '#FFFFFF',
              dur: 450
            });

            kit.spawnPfx('crit_hit', {
              palette: amp >= 2 ? PALETTES.iceGold : PALETTES.ice,
              height: 26, aim: 0.05
            }, {
              x: to.x, y: to.y + 38,
              scale: 1.85 * ampScale, durMs: 640, layer: 'front',
              lightGain: 0.85,
              glowColor: 'rgba(103,232,249,0.32)', glowRadius: 54 * ampScale, glowAlpha: 0.28
            });

            kit.spawnPfx('parry', {
              palette: amp >= 2 ? PALETTES.gold7 : PALETTES.slash,
              height: 28
            }, {
              x: to.x, y: to.y + 42, scale: 1.62 * ampScale,
              durMs: 520, layer: 'front'
            });

            kit.addFlash(to.x, to.y, 58 * ampScale, '#67E8F9', 150, 0.34);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 14, r1: 72 * ampScale, inner: 0.14, points: 8,
              outerColor: amp >= 2 ? '#FDE68A' : '#38BDF8', coreColor: '#FFFFFF', dur: 420
            });
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 10, r1: 96 * ampScale, inner: 0.08, points: 4, rot: Math.PI * 0.25,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 380
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 2, r0: 14, r1: 112 * ampScale, sy: 0.28,
              color: '#0EA5E9', coreColor: '#FFFFFF', lineW: 4, dur: 460
            });

            kit.spawnBurstParticles(to.x, to.y, 32 + amp * 8, 'spark', {
              spdMin: 160, spdMax: 380, sizeMin: 2.6, sizeMax: 5.0,
              colors: ['#FFFFFF', '#E0F9FF', '#67E8F9', '#FDE68A'],
              gravity: 110, lifeMin: 300, lifeMax: 560
            });
            kit.spawnBurstParticles(to.x, to.y, 20, 'shard', {
              spdMin: 80, spdMax: 240, sizeMin: 3.2, sizeMax: 6.5,
              colors: ['#FFFFFF', '#BAE6FD', '#38BDF8'], color2: '#1658EB',
              groundY: targetGroundY, bounce: 0.4, lifeMin: 400, lifeMax: 720
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    },

    /* ---------- 9. 风行残像 (wind_afterimage，原版照搬) ---------- */
    wind_afterimage(kit, o) {
      const { from, to, groundY, targetGroundY, amp, ampScale } = o;
      const p0 = { x: from.x - 10, y: from.y + 8 };
      const p2 = { x: to.x + 18, y: to.y + 6 };
      const p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 44 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn() {
            kit.spawnPfx('blizzard_vortex', { palette: PALETTES.wind, height: 64 }, {
              x: from.x - 12, y: groundY + 4,
              scale: 1.42 * ampScale, timeScale: 1.4, durMs: 560,
              fadeInMs: 40, fadeOutMs: 220, layer: 'back',
              glowColor: 'rgba(52,211,153,0.40)', glowRadius: 52, glowAlpha: 0.38
            });
            kit.addMagicCircle({
              x: from.x - 12, y: groundY + 4, radius: 44 * ampScale, sy: 0.30,
              rimColor: '#059669', starColor: '#34D399', runeColor: '#CCFBF1',
              innerGlow: 'rgba(204,251,241,0.68)', outerGlow: 'rgba(16,185,129,0.32)',
              goldTriple: amp >= 3, dur: 580
            });
            kit.triggerAmpCastAura(from.x - 12, groundY, amp, true);
          }
        },
        {
          at: 110,
          fn() {
            const upperPts = [];
            const lowerPts = [];
            const steps = 26;
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const base = quadBezier(p0, p1, p2, t);
              const wave = Math.sin(t * Math.PI * 3.5) * 18;
              upperPts.push({ x: base.x, y: base.y - 10 + wave });
              lowerPts.push({ x: base.x, y: base.y + 12 - wave });
            }
            kit.addRibbon({
              pts: upperPts,
              width: 10.5 * ampScale,
              outerColor: '#059669',
              midColor: '#34D399',
              alpha: 0.90,
              dur: 720,
              fadeOut: 300
            });
            kit.addRibbon({
              pts: lowerPts,
              width: 8.2 * ampScale,
              outerColor: '#0D9488',
              midColor: '#6EE7B7',
              alpha: 0.84,
              dur: 740,
              fadeOut: 320
            });

            for (let i = 0; i < 24; i++) {
              const t = i / 24;
              const pos = quadBezier(p0, p1, p2, t);
              kit.addParticle({
                kind: i % 3 === 0 ? 'star' : 'leaf',
                x: pos.x + (Math.random() - 0.5) * 30,
                y: pos.y + (Math.random() - 0.5) * 36,
                vx: 45 + Math.random() * 90,
                vy: -35 + Math.random() * 55,
                gravity: 16, drag: 0.85,
                size: 4.5 + Math.random() * 3.8,
                rot: Math.random() * TAU,
                vrot: (Math.random() - 0.5) * 8,
                color: i % 3 === 0 ? '#FFFFFF' : '#6EE7B7',
                color2: '#059669',
                life: 640 + Math.random() * 440
              });
            }
          }
        },
        {
          at: 140,
          fn() {
            const pos = quadBezier(p0, p1, p2, 0.22);
            kit.addAfterimage({
              x: pos.x, y: groundY - 2, scale: 1.00, facing: 1, frameIdx: 7,
              spriteId: o.spriteId || null,
              alpha: 0.72, dur: 680
            });
          }
        },
        {
          at: 215,
          fn() {
            const pos = quadBezier(p0, p1, p2, 0.49);
            kit.addAfterimage({
              x: pos.x, y: groundY - 10, scale: 1.04, facing: 1, frameIdx: 8,
              spriteId: o.spriteId || null,
              alpha: 0.86, dur: 680
            });
          }
        },
        {
          at: 290,
          fn() {
            const pos = quadBezier(p0, p1, p2, 0.75);
            kit.addAfterimage({
              x: pos.x, y: groundY - 4, scale: 1.08, facing: 1, frameIdx: 9,
              spriteId: o.spriteId || null,
              alpha: 0.96, dur: 680
            });
          }
        },
        {
          at: 365,
          fn() {
            kit.safeCall(o.onImpact, 0, to, true);
            kit.safeCall(o.onShake, 7.0 + amp * 2.0, 240);
            kit.safeCall(o.onHitStop, 52 + amp * 12);

            kit.spawnPfx('blizzard_vortex', { palette: PALETTES.wind, height: 80 }, {
              x: to.x, y: targetGroundY + 6,
              scale: 1.72 * ampScale, timeScale: 1.35, durMs: 860,
              fadeInMs: 40, fadeOutMs: 260, layer: 'main',
              glowColor: 'rgba(52,211,153,0.40)', glowRadius: 62 * ampScale, glowAlpha: 0.38
            });

            const swScale = 1.78 * ampScale;
            kit.spawnPfx('sword_slash', {
              palette: PALETTES.slashWind,
              sparks: PALETTES.windSpark,
              radius: 44
            }, {
              x: to.x - 24 * swScale,
              y: to.y + 36 * swScale,
              scale: swScale, durMs: 580, layer: 'front'
            });

            kit.addSlash({
              x: to.x, y: to.y,
              rx: 92 * ampScale, ry: 54 * ampScale,
              tilt: -0.34,
              startAngle: -2.45, endAngle: 0.82,
              thickness: 22 * ampScale,
              outerColor: '#059669',
              midColor: '#34D399',
              hiColor: '#CCFBF1',
              dur: 390
            });

            kit.addFlash(to.x, to.y, 58 * ampScale, '#34D399', 160, 0.36);
            kit.addStarFlare({
              x: to.x, y: to.y, r0: 10, r1: 52 * ampScale, points: 8,
              outerColor: amp >= 3 ? '#FDE68A' : '#34D399', coreColor: '#FFFFFF', dur: 360
            });
            kit.addShockRing({
              x: to.x, y: targetGroundY + 4, r0: 14, r1: 118 * ampScale, sy: 0.28,
              color: '#10B981', coreColor: '#CCFBF1', lineW: 4, dur: 480
            });

            kit.spawnBurstParticles(to.x, to.y - 10, 36 + amp * 8, 'leaf', {
              spdMin: 70, spdMax: 255, upBias: 95, gravity: 22, drag: 1.05,
              sizeMin: 4.5, sizeMax: 8.2,
              colors: ['#A7F3D0', '#6EE7B7', '#34D399', '#CCFBF1'],
              color2: '#059669', lifeMin: 560, lifeMax: 960
            });
            kit.spawnBurstParticles(to.x, to.y - 8, 26, 'star', {
              spdMin: 60, spdMax: 210, upBias: 70, gravity: 18,
              sizeMin: 3.2, sizeMax: 6.8,
              colors: ['#FFFFFF', '#CCFBF1', '#6EE7B7', '#FDE68A'],
              lifeMin: 480, lifeMax: 840
            });

            kit.triggerAmpImpactUpgrade(to.x, to.y, targetGroundY, amp);
          }
        }
      ]);
    }
  };

  // 将核心 9 招以基础包注册入插件表
  registerPack('core_base', CORE_SKILLS_META, CORE_HANDLERS);

  /* -------------------- 实例化引擎工厂 create(canvas, config) -------------------- */
  function create(canvas, config) {
    if (!canvas) throw new Error('VfxEditionAFull.create(canvas) requires a valid canvas element');
    const cfg = config || {};
    const autoClear = cfg.autoClear !== false;
    const ctx = canvas.getContext('2d', { alpha: true });

    let _seedSeq = 101;
    const nextSeed = () => {
      _seedSeq = (_seedSeq * 1664525 + 1013904223) >>> 0;
      return (_seedSeq % 9999) + 1;
    };

    const state = {
      timeMs: 0,
      timelines: [],
      pfxSlots: [],
      magicCircles: [],
      ribbons: [],
      waterStreams: [],
      iceVeins: [],
      heroThorns: [],
      shields: [],
      slashes: [],
      skyBeams: [],
      afterimages: [],
      lightningArcs: [],
      starFlares: [],
      shockRings: [],
      particles: [],
      flashes: [],
      customDrawables: {
        back: [],
        main: [],
        front: []
      }
    };

    /* --- PixelFX 48 槽位生成器（完整支持 flipX / angle / palette 覆写 / layer） --- */
    function spawnPfx(fxName, opts, cfgSlot) {
      const PFX = getPixelFX();
      if (!PFX || !PFX.FX || !PFX.FX[fxName]) return null;
      const def = PFX.FX[fxName];
      const c = cfgSlot || {};
      const b = PFX_BOUNDS[fxName] || { w: 160, h: 120, ox: -80, oy: -80 };

      if (state.pfxSlots.length >= MAX_PFX_SLOTS) {
        state.pfxSlots.shift();
      }

      const rawOpts = opts || {};
      const instOpts = Object.assign({ seed: nextSeed() }, rawOpts, {
        x: 0,
        y: 0,
        flip: false,
        angle: 0
      });

      // 支持在 opts.palette 或 cfgSlot.palette 中传入数组或 PALETTES 键名
      const palOverride = resolvePalette(c.palette != null ? c.palette : instOpts.palette);
      if (palOverride) {
        instOpts.palette = palOverride;
      }
      if (typeof instOpts.sparks === 'string' && PALETTES[instOpts.sparks]) {
        instOpts.sparks = PALETTES[instOpts.sparks];
      }
      if (c.sparks != null) {
        const spPal = resolvePalette(c.sparks);
        if (spPal) instOpts.sparks = spPal;
      }

      let inst = null;
      try {
        inst = PFX.createFx(def, instOpts);
      } catch (e) {
        return null;
      }

      const preWarm = c.preWarmSec || 0;
      if (preWarm > 0) {
        const step = 0.025;
        let rem = preWarm;
        while (rem > 1e-4) {
          const d = rem > step ? step : rem;
          inst.update(d);
          rem -= d;
        }
      }

      const layer = (c.layer === 'back' || c.layer === 'front') ? c.layer : 'main';
      const flipX = c.flipX != null ? !!c.flipX : !!(rawOpts.flipX || rawOpts.flip);
      const flipY = c.flipY != null ? !!c.flipY : !!rawOpts.flipY;
      const angle = Number.isFinite(c.angle)
        ? c.angle
        : (Number.isFinite(rawOpts.angle) ? rawOpts.angle : 0);

      const slot = {
        fxName,
        inst,
        layer,
        bufW: c.bufW || b.w,
        bufH: c.bufH || b.h,
        ox: c.ox != null ? c.ox : b.ox,
        oy: c.oy != null ? c.oy : b.oy,
        x: c.x || 0,
        y: c.y || 0,
        scale: c.scale || 1.5,
        angle,
        flipX,
        flipY,
        timeScale: c.timeScale || 1.0,
        alpha: c.alpha != null ? c.alpha : 1.0,
        lightGain: c.lightGain != null ? c.lightGain : 1.15,
        glowColor: c.glowColor || null,
        glowRadius: c.glowRadius || 0,
        glowAlpha: c.glowAlpha || 0,
        clipRight: c.clipRight != null ? c.clipRight : 1.0,
        age: 0,
        dur: c.durMs || 900,
        fadeIn: c.fadeInMs != null ? c.fadeInMs : 40,
        fadeOut: c.fadeOutMs != null ? c.fadeOutMs : 180,
        onUpdate: c.onUpdate || null
      };
      state.pfxSlots.push(slot);
      return slot;
    }

    function addParticle(p) {
      if (state.particles.length >= MAX_PARTICLES) {
        state.particles.shift();
      }
      const item = Object.assign({
        kind: 'star',
        x: 0, y: 0, vx: 0, vy: 0,
        gravity: 0, drag: 1.5,
        size: 4, rot: 0, vrot: 0,
        color: '#38BDF8', color2: '#1658EB',
        alpha: 1, life: 500, maxLife: 500,
        age: 0, groundY: 9999, bounce: 0,
        sy: null,
        seed: Math.random() * 100
      }, p, { maxLife: (p && p.life) || 500 });
      state.particles.push(item);
      return item;
    }

    function addShockRing(r) {
      const item = Object.assign({
        x: 0, y: 0, r0: 8, r1: 72, sy: 0.34,
        color: '#38BDF8', coreColor: '#FFFFFF',
        lineW: 4, age: 0, dur: 380, layer: 'back'
      }, r);
      state.shockRings.push(item);
      return item;
    }

    function addStarFlare(f) {
      const item = Object.assign({
        x: 0, y: 0, r0: 6, r1: 36, inner: 0.22,
        points: 4, rot: 0, vrot: 0.003,
        outerColor: '#38BDF8', coreColor: '#FFFFFF',
        alpha: 1, age: 0, dur: 320
      }, f);
      state.starFlares.push(item);
      return item;
    }

    function addLightning(x0, y0, x1, y1, opts) {
      const o = opts || {};
      const rng = makeRng(nextSeed());
      const pts = buildLightningPoints(x0, y0, x1, y1, o.jitter || 14, o.depth || 4, rng);
      const branches = [];
      const bCount = o.branches != null ? o.branches : 2;
      for (let i = 0; i < bCount; i++) {
        const idx = Math.max(1, Math.min(pts.length - 2, Math.floor(pts.length * (0.28 + i * 0.26))));
        const st = pts[idx];
        const bx = st.x + (rng() - 0.5) * 48;
        const by = st.y + (rng() - 0.5) * 38;
        branches.push(buildLightningPoints(st.x, st.y, bx, by, 7, 3, rng));
      }
      const item = {
        pts,
        branches,
        outerColor: o.outerColor || '#1658EB',
        midColor: o.midColor || '#67E8F9',
        coreColor: o.coreColor || '#FFFFFF',
        width: o.width || 2.2,
        age: 0,
        dur: o.dur || 230
      };
      state.lightningArcs.push(item);
      return item;
    }

    function addMagicCircle(mc) {
      const src = mc || {};
      const pal = resolvePalette(src.palette);
      const palDefaults = pal ? {
        rimColor: pickPal(pal, 0.36),
        starColor: pickPal(pal, 0.65),
        runeColor: pickPal(pal, 0.92),
        innerGlow: toRgba(pickPal(pal, 0.88), 0.65),
        outerGlow: toRgba(pickPal(pal, 0.45), 0.28)
      } : null;
      const item = Object.assign({
        x: 0, y: 0, radius: 42, sy: 0.34,
        rot: 0, vrot: 0.0022,
        rimColor: '#0EA5E9', runeColor: '#E0F7FF', starColor: '#38BDF8',
        innerGlow: 'rgba(224,247,255,0.65)', outerGlow: 'rgba(14,165,233,0.28)',
        lineW: 2.2, alpha: 0.95, goldTriple: false,
        age: 0, dur: 520, fadeIn: 130, fadeOut: 180, layer: 'back'
      }, palDefaults, src);
      state.magicCircles.push(item);
      return item;
    }

    function addFlash(x, y, r, color, dur, alpha) {
      const item = {
        x, y, r, color: color || '#38BDF8',
        age: 0, dur: dur || 180, alpha: alpha != null ? alpha : 0.62
      };
      state.flashes.push(item);
      return item;
    }

    function addRibbon(rb) {
      const src = rb || {};
      const pal = resolvePalette(src.palette);
      const palDefaults = pal ? {
        outerColor: pickPal(pal, 0.20),
        midColor: pickPal(pal, 0.62),
        coreColor: pickPal(pal, 1.0)
      } : null;
      const item = Object.assign({
        pts: [],
        width: 9,
        outerColor: '#1658EB',
        midColor: '#38BDF8',
        coreColor: '#FFFFFF',
        alpha: 0.92,
        age: 0,
        dur: 480,
        fadeOut: 220
      }, palDefaults, src);
      state.ribbons.push(item);
      return item;
    }

    function addWaterStream(ws) {
      const item = Object.assign({
        x0: 0, y0: 0, x1: 100, y1: 0,
        width: 16,
        extendMs: 150,
        colors: null,
        palette: null,
        age: 0,
        dur: 600
      }, ws);
      state.waterStreams.push(item);
      return item;
    }

    function addIceVein(vein) {
      const src = vein || {};
      let pts = src.pts;
      let spurs = src.spurs;
      if ((!Array.isArray(pts) || pts.length < 2) && Number.isFinite(src.x0) && Number.isFinite(src.x1)) {
        const rng = makeRng(nextSeed());
        const segs = src.segs || 7;
        const jit = src.jitter != null ? src.jitter : 14;
        pts = [{ x: src.x0, y: src.y0 || 0 }];
        spurs = [];
        for (let s = 1; s < segs; s++) {
          const u = s / segs;
          const px = lerp(src.x0, src.x1, u) + (rng() - 0.5) * jit;
          const py = lerp(src.y0 || 0, src.y1 || 0, u) + (rng() - 0.5) * (jit * 0.85);
          pts.push({ x: px, y: py });
          spurs.push({
            at: u,
            x: px, y: py,
            dx: (rng() - 0.3) * 26,
            dy: (rng() < 0.5 ? -1 : 1) * (10 + rng() * 14)
          });
        }
        pts.push({ x: src.x1, y: src.y1 || 0 });
      }
      const item = Object.assign({
        pts: pts || [],
        spurs: spurs || [],
        width: 3.4,
        growMs: 260,
        colors: null,
        palette: null,
        age: 0,
        dur: 1100
      }, src, { pts: pts || [], spurs: spurs || [] });
      state.iceVeins.push(item);
      return item;
    }

    function addHeroThorns(th) {
      const src = th || {};
      const sc = Number.isFinite(src.scale) ? src.scale : 1;
      const defaultSpikes = [
        { dx: -22 * sc, h: 48 * sc, w: 14 * sc, lean: -12 * sc, delay: 20, primary: false },
        { dx: 22 * sc,  h: 52 * sc, w: 15 * sc, lean: 14 * sc,  delay: 25, primary: false },
        { dx: -8 * sc,  h: 76 * sc, w: 19 * sc, lean: -6 * sc,  delay: 0,  primary: true },
        { dx: 9 * sc,   h: 70 * sc, w: 17 * sc, lean: 9 * sc,   delay: 12, primary: true },
        { dx: 0,        h: 88 * sc, w: 22 * sc, lean: 0,        delay: 0,  primary: true }
      ];
      const item = Object.assign({
        x: 0, y: 0,
        goldAccent: false,
        colors: null,
        palette: null,
        spikes: defaultSpikes,
        age: 0,
        dur: 920
      }, src);
      state.heroThorns.push(item);
      return item;
    }

    function addPrismShield(sh) {
      const item = Object.assign({
        x: 0, y: 0,
        radius: 62,
        ampTier: 0,
        lockAt: 260,
        colors: null,
        palette: null,
        age: 0,
        dur: 1120
      }, sh);
      state.shields.push(item);
      return item;
    }

    function addSlash(sl) {
      const src = sl || {};
      const pal = resolvePalette(src.palette);
      const palDefaults = pal ? {
        outerColor: pickPal(pal, 0.16),
        midColor: pickPal(pal, 0.56),
        hiColor: pickPal(pal, 0.86),
        coreColor: pickPal(pal, 1.0)
      } : null;
      const item = Object.assign({
        x: 0, y: 0,
        rx: 92, ry: 56,
        tilt: -0.35,
        startAngle: -2.45, endAngle: 0.82,
        thickness: 22,
        outerColor: '#1658EB',
        midColor: '#38BDF8',
        hiColor: '#CFFAFE',
        coreColor: '#FFFFFF',
        age: 0,
        dur: 440
      }, palDefaults, src);
      state.slashes.push(item);
      return item;
    }

    function addSkyBeam(bm) {
      const item = Object.assign({
        x0: 0, y0: -16, x1: 100, y1: 280,
        width: 7,
        gold: false,
        colors: null,
        palette: null,
        age: 0,
        dur: 540
      }, bm);
      state.skyBeams.push(item);
      return item;
    }

    function addAfterimage(af) {
      const item = Object.assign({
        x: 0, y: 0,
        scale: 1.0,
        facing: 1,
        frameIdx: null,
        spriteId: null,
        colors: null,
        palette: null,
        alpha: 0.85,
        age: 0,
        dur: 680
      }, af);
      state.afterimages.push(item);
      return item;
    }

    /* --- 自定义绘制层 kit.addCustomDrawable(layer, obj) --- */
    function addCustomDrawable(layer, obj) {
      let targetLayer = layer;
      let item = obj;
      if (layer && typeof layer === 'object' && obj == null) {
        item = layer;
        targetLayer = item.layer || 'main';
      }
      if (!item || typeof item.draw !== 'function') return null;
      const normLayer = (targetLayer === 'back' || targetLayer === 'front') ? targetLayer : 'main';
      if (!Number.isFinite(item.age)) item.age = 0;
      if (!Number.isFinite(item.dur) || item.dur <= 0) item.dur = 600;
      item.layer = normLayer;
      state.customDrawables[normLayer].push(item);
      return item;
    }

    function spawnBurstParticles(x, y, count, kind, opts) {
      const o = opts || {};
      const rng = makeRng(nextSeed());
      const pal = resolvePalette(o.palette);
      const colors = o.colors || (pal ? [pickPal(pal, 1.0), pickPal(pal, 0.82), pickPal(pal, 0.62), pickPal(pal, 0.45)] : null);
      const defaultColor2 = o.color2 || (pal ? pickPal(pal, 0.16) : (
        kind === 'cross' ? '#059669'
          : kind === 'petal' ? '#EA580C'
            : kind === 'ringlet' ? '#6D28D9'
              : '#1658EB'
      ));
      const defaultColor1 = kind === 'cross' ? '#34D399'
        : kind === 'petal' ? '#FCD34D'
          : kind === 'ringlet' ? '#DDD6FE'
            : '#67E8F9';
      const defaultGravity = kind === 'snow' || kind === 'mote' ? 28
        : kind === 'cross' ? -28
          : kind === 'petal' ? 32
            : kind === 'ringlet' ? -12
              : 340;

      for (let i = 0; i < count; i++) {
        const a = o.angleBase != null
          ? o.angleBase + (rng() - 0.5) * (o.spread || 1.2)
          : rng() * TAU;
        const spd = lerp(o.spdMin || 65, o.spdMax || 240, rng());
        addParticle({
          kind,
          x: x + (rng() - 0.5) * (o.jitter || 10),
          y: y + (rng() - 0.5) * (o.jitter || 10),
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - (o.upBias != null ? o.upBias : 30),
          gravity: o.gravity != null ? o.gravity : defaultGravity,
          drag: o.drag != null ? o.drag : 1.3,
          size: lerp(o.sizeMin || 3, o.sizeMax || 6.5, rng()),
          rot: rng() * TAU,
          vrot: (rng() - 0.5) * 10,
          color: colors ? colors[Math.floor(rng() * colors.length)] : defaultColor1,
          color2: defaultColor2,
          alpha: o.alpha != null ? o.alpha : 1,
          sy: o.sy != null ? o.sy : null,
          life: lerp(o.lifeMin || 360, o.lifeMax || 720, rng()),
          groundY: o.groundY != null ? o.groundY : 9999,
          bounce: o.bounce != null ? o.bounce : 0.35
        });
      }
    }

    /* --- 魔力增幅（ampTier 0..3）统一炫彩升级钩子 --- */
    function triggerAmpCastAura(x, groundY, ampTier, isEmeraldOrTheme) {
      if (ampTier <= 0) return;
      const isEmerald = isEmeraldOrTheme === true || isEmeraldOrTheme === 'wind' || isEmeraldOrTheme === 'heal';
      const customPal = typeof isEmeraldOrTheme === 'string' && !isEmerald ? resolvePalette(isEmeraldOrTheme) : null;
      const rimCol = ampTier >= 3 ? '#F59E0B' : (customPal ? pickPal(customPal, 0.36) : (isEmerald ? '#10B981' : '#0EA5E9'));
      const starCol = ampTier >= 3 ? '#FDE68A' : (customPal ? pickPal(customPal, 0.68) : (isEmerald ? '#34D399' : '#38BDF8'));
      const arcOuter = ampTier === 3 ? '#D97706' : (customPal ? pickPal(customPal, 0.20) : '#1658EB');
      const arcMid = ampTier === 3 ? '#FDE68A' : (customPal ? pickPal(customPal, 0.72) : '#67E8F9');

      addMagicCircle({
        x, y: groundY + 2,
        radius: 38 + ampTier * 8,
        sy: 0.32,
        rimColor: rimCol,
        starColor: starCol,
        runeColor: '#FFFFFF',
        goldTriple: ampTier >= 3,
        dur: 460 + ampTier * 60
      });
      if (ampTier >= 2) {
        for (let i = 0; i < (ampTier === 3 ? 3 : 2); i++) {
          const ang = -Math.PI * 0.8 + i * 0.75;
          addLightning(
            x + Math.cos(ang) * 26, groundY - 22,
            x + Math.cos(ang + 1.2) * 34, groundY - 68,
            {
              outerColor: arcOuter,
              midColor: arcMid,
              width: ampTier === 3 ? 2.4 : 1.7,
              dur: 210
            }
          );
        }
      }
    }

    function triggerAmpImpactUpgrade(x, y, groundY, ampTier) {
      if (ampTier <= 0) return;
      addShockRing({
        x, y: groundY + 2,
        r0: 14, r1: 68 + ampTier * 22, sy: 0.30,
        color: ampTier >= 3 ? '#F59E0B' : '#0EA5E9',
        coreColor: ampTier >= 3 ? '#FEF9C3' : '#FFFFFF',
        lineW: 3.2 + ampTier * 0.8,
        dur: 400 + ampTier * 50
      });

      if (ampTier >= 2) {
        const boltCount = ampTier === 3 ? 5 : 2;
        for (let i = 0; i < boltCount; i++) {
          const a = (i / boltCount) * TAU + 0.35;
          const dist = 48 + ampTier * 16;
          addLightning(x, y, x + Math.cos(a) * dist, y + Math.sin(a) * dist * 0.72, {
            outerColor: ampTier === 3 ? '#D97706' : '#1658EB',
            midColor: ampTier === 3 ? '#FDE68A' : '#67E8F9',
            width: ampTier === 3 ? 2.6 : 1.9,
            dur: 260,
            branches: ampTier === 3 ? 3 : 1
          });
        }
      }

      if (ampTier === 3) {
        addMagicCircle({
          x, y: groundY + 2,
          radius: 58, sy: 0.31,
          rimColor: '#F59E0B', starColor: '#FDE68A', runeColor: '#FFFFFF',
          innerGlow: 'rgba(254,249,195,0.68)', outerGlow: 'rgba(245,158,11,0.32)',
          goldTriple: true,
          dur: 640, fadeIn: 90, fadeOut: 220
        });
        spawnPfx('crit_hit', {
          palette: PALETTES.gold,
          height: 24,
          aim: 0.1
        }, {
          x, y: y + 32, scale: 1.55, durMs: 560, layer: 'front',
          glowColor: 'rgba(253,230,138,0.55)', glowRadius: 56, glowAlpha: 0.55
        });
        addStarFlare({
          x, y, r0: 12, r1: 62, inner: 0.20, points: 8,
          outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 420
        });
        spawnBurstParticles(x, y, 22, 'star', {
          spdMin: 80, spdMax: 240, sizeMin: 3.5, sizeMax: 7.5,
          colors: ['#FDE68A', '#FCD34D', '#67E8F9', '#FFFFFF'],
          gravity: 110, lifeMin: 420, lifeMax: 760
        });
      }
    }

    function scheduleTimeline(cues) {
      const list = Array.isArray(cues) ? cues : [];
      const tl = {
        age: 0,
        cues: list.map(c => ({ at: c.at || 0, fn: c.fn, fired: false })),
        done: false
      };
      for (let i = 0; i < tl.cues.length; i++) {
        if (tl.cues[i].at <= 0) {
          tl.cues[i].fired = true;
          if (typeof tl.cues[i].fn === 'function') tl.cues[i].fn();
        }
      }
      state.timelines.push(tl);
      return tl;
    }

    function safeCall(fn, ...args) {
      if (typeof fn === 'function') {
        try { fn(...args); } catch (e) {}
      }
    }

    /* --- 共享运行时 kit 工具箱（供所有内置招式与外部 Pack 统一调用） --- */
    const kit = {
      LOGICAL_W,
      LOGICAL_H,
      PALETTES,
      PFX_BOUNDS,
      state,
      math: {
        TAU,
        clamp,
        lerp,
        easeOutCubic,
        easeOutQuart,
        easeInQuad,
        easeInOutSine,
        easeOutBack,
        quadBezier,
        quadBezierTangent
      },
      color: {
        resolvePalette,
        toRgba,
        withZeroAlpha,
        pickPal
      },
      nextSeed,
      makeRng,
      safeCall,
      scheduleTimeline,
      spawnPfx,
      addMagicCircle,
      addRibbon,
      addWaterStream,
      addIceVein,
      addHeroThorns,
      addPrismShield,
      addSlash,
      addSkyBeam,
      addAfterimage,
      addLightning,
      addShockRing,
      addStarFlare,
      addFlash,
      addParticle,
      spawnBurstParticles,
      triggerAmpCastAura,
      triggerAmpImpactUpgrade,
      addCustomDrawable,
      drawStarFlare
    };

    /* --- 入参归一化：自动解算 facing / amp / ampScale 并完整透传扩展标志 --- */
    function normalizePlayOpts(rawSkillId, resolvedId, rawOpts) {
      const raw = rawOpts || {};
      const groundY = Number.isFinite(raw.groundY) ? raw.groundY : 286;
      const from = raw.from && Number.isFinite(raw.from.x) && Number.isFinite(raw.from.y)
        ? { x: raw.from.x, y: raw.from.y }
        : { x: 158, y: 216 };
      const to = raw.to && Number.isFinite(raw.to.x) && Number.isFinite(raw.to.y)
        ? { x: raw.to.x, y: raw.to.y }
        : { x: 472, y: 218 };
      const facing = Number.isFinite(raw.facing)
        ? (raw.facing >= 0 ? 1 : -1)
        : (to.x >= from.x ? 1 : -1);
      const rawAmp = Number.isFinite(raw.ampTier)
        ? raw.ampTier
        : (Number.isFinite(raw.amp) ? raw.amp : 0);
      const amp = clamp(Math.round(rawAmp), 0, 3);
      const ampScale = 1 + amp * 0.095;
      const targetGroundY = Number.isFinite(raw.targetGroundY)
        ? raw.targetGroundY
        : (raw.to && Number.isFinite(raw.to.groundY) ? raw.to.groundY : groundY);
      const targets = Array.isArray(raw.targets) && raw.targets.length
        ? raw.targets.map(t => ({
            x: Number.isFinite(t.x) ? t.x : to.x,
            y: Number.isFinite(t.y) ? t.y : to.y,
            groundY: Number.isFinite(t.groundY)
              ? t.groundY
              : (Number.isFinite(t.footY) ? t.footY : targetGroundY)
          }))
        : [
            { x: 410, y: 210, groundY: groundY - 12 },
            { x: 486, y: 222, groundY: groundY },
            { x: 560, y: 234, groundY: groundY + 10 }
          ];
      const icePal = amp >= 3 ? PALETTES.iceGold : PALETTES.ice;

      return Object.assign({}, raw, {
        rawSkillId,
        skillId: resolvedId,
        from,
        to,
        facing,
        groundY,
        targetGroundY,
        targets,
        amp,
        ampTier: amp,
        ampScale,
        icePal,
        variant: raw.variant != null ? raw.variant : null,
        mode: raw.mode != null ? raw.mode : null,
        theme: raw.theme != null ? raw.theme : null,
        heavy: !!raw.heavy,
        usedWand: !!raw.usedWand,
        shattered: !!raw.shattered,
        overwhelmed: !!raw.overwhelmed,
        frostCombo: !!raw.frostCombo,
        fizzle: !!raw.fizzle,
        spriteId: raw.spriteId || null,
        oneMore: !!raw.oneMore,
        onImpact: raw.onImpact,
        onShake: raw.onShake,
        onHitStop: raw.onHitStop,
        onComplete: raw.onComplete
      });
    }

    function play(skillId, opts) {
      const resolvedId = resolveSkillId(skillId) || 'ice_crystal';
      const handler = HANDLERS[resolvedId] || HANDLERS.ice_crystal;
      const o = normalizePlayOpts(skillId, resolvedId, opts);
      if (typeof handler === 'function') {
        handler(kit, o);
      }
      if (typeof o.onComplete === 'function') {
        let dur = getDuration(resolvedId);
        if (resolvedId === 'frost_thorn_field') {
          const rawBeatGap = Number(o.beatGapMs);
          if (Number.isFinite(rawBeatGap) && rawBeatGap > 70) {
            const extraBeats = Math.max(0, (Array.isArray(o.targets) ? o.targets.length : 1) - 1);
            dur += extraBeats * (clamp(rawBeatGap, 20, 600) - 70);
          }
        }
        scheduleTimeline([{ at: dur, fn: () => safeCall(o.onComplete, resolvedId, o) }]);
      }
      return resolvedId;
    }

    /* -------------------- 状态推进 update(dtMs) -------------------- */
    function update(dtMs) {
      const dt = clamp(Number.isFinite(dtMs) ? dtMs : 16.67, 0, 80);
      const dtSec = dt * 0.001;
      state.timeMs += dt;

      // 1. 调度时间轴
      for (let i = state.timelines.length - 1; i >= 0; i--) {
        const tl = state.timelines[i];
        tl.age += dt;
        let allFired = true;
        for (let j = 0; j < tl.cues.length; j++) {
          const c = tl.cues[j];
          if (!c.fired) {
            if (tl.age >= c.at) {
              c.fired = true;
              if (typeof c.fn === 'function') c.fn();
            } else {
              allFired = false;
            }
          }
        }
        if (allFired) state.timelines.splice(i, 1);
      }

      // 2. PixelFX 48 并发池推进
      for (let i = state.pfxSlots.length - 1; i >= 0; i--) {
        const sl = state.pfxSlots[i];
        sl.age += dt;
        if (sl.age >= sl.dur) {
          state.pfxSlots.splice(i, 1);
          continue;
        }
        if (sl.onUpdate) sl.onUpdate(sl, dtSec, sl.age);
        let stepRem = dtSec * sl.timeScale;
        while (stepRem > 1e-4) {
          const d = stepRem > 0.04 ? 0.04 : stepRem;
          sl.inst.update(d);
          stepRem -= d;
        }
      }

      // 3. 其余矢量图层推进
      const advanceList = (list, extra) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const it = list[i];
          it.age += dt;
          if (extra) extra(it, dt, dtSec);
          if (it.age >= it.dur) list.splice(i, 1);
        }
      };

      advanceList(state.magicCircles, mc => { mc.rot += mc.vrot * dt; });
      advanceList(state.ribbons);
      advanceList(state.waterStreams);
      advanceList(state.iceVeins);
      advanceList(state.heroThorns);
      advanceList(state.shields);
      advanceList(state.slashes);
      advanceList(state.skyBeams);
      advanceList(state.afterimages);
      advanceList(state.lightningArcs);
      advanceList(state.starFlares, f => { f.rot += f.vrot * dt; });
      advanceList(state.shockRings);
      advanceList(state.flashes);

      // 3B. 自定义绘制层统一生命周期推进
      const customLayers = ['back', 'main', 'front'];
      for (let l = 0; l < customLayers.length; l++) {
        const list = state.customDrawables[customLayers[l]];
        for (let i = list.length - 1; i >= 0; i--) {
          const it = list[i];
          it.age += dt;
          if (typeof it.update === 'function') {
            try { it.update(dt, dtSec, clamp(it.age / it.dur, 0, 1)); } catch (e) {}
          }
          if (it.age >= it.dur) {
            list.splice(i, 1);
          }
        }
      }

      // 4. 粒子物理更新
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.age += dt;
        p.life -= dt;
        if (p.life <= 0) {
          state.particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dtSec;
        const damp = Math.max(0, 1 - p.drag * dtSec);
        p.vx *= damp;
        p.vy *= damp;
        if (p.kind === 'snow' || p.kind === 'leaf' || p.kind === 'petal') {
          p.vx += Math.sin(p.age * 0.006 + p.seed) * 24 * dtSec;
        } else if (p.kind === 'cross') {
          p.vx += Math.sin(p.age * 0.005 + p.seed) * 16 * dtSec;
        }
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.rot += p.vrot * dtSec;
        if (p.y >= p.groundY && p.vy > 0) {
          p.y = p.groundY;
          if (p.bounce > 0 && p.vy > 45) {
            p.vy = -p.vy * p.bounce;
            p.vx *= 0.68;
            p.vrot *= 0.6;
          } else {
            p.vy = 0;
            p.vx *= 0.5;
          }
        }
      }
    }

    /* -------------------- PixelFX 单槽高清亮彩光栅合成 -------------------- */
    function renderPfxLayer(layerName) {
      const PFX = getPixelFX();
      if (!PFX) return;
      for (let i = 0; i < state.pfxSlots.length; i++) {
        const sl = state.pfxSlots[i];
        if (sl.layer !== layerName) continue;

        const envIn = sl.fadeIn > 0 ? clamp(sl.age / sl.fadeIn, 0, 1) : 1;
        const envOut = sl.age > sl.dur - sl.fadeOut ? clamp((sl.dur - sl.age) / Math.max(1, sl.fadeOut), 0, 1) : 1;
        const alpha = envIn * envOut * sl.alpha;
        if (alpha <= 0.01) continue;

        const surf = getScratchSurface(PFX, sl.bufW, sl.bufH, sl.ox, sl.oy);
        if (!surf) continue;
        PFX.clearFrame(surf.frame);
        sl.inst.draw(surf.frame);
        PFX.composite(surf.frame, surf.imgData.data, null, sl.lightGain);
        surf.ctx.putImageData(surf.imgData, 0, 0);

        ctx.save();
        ctx.translate(sl.x, sl.y);

        if (sl.glowColor && sl.glowRadius > 2 && sl.glowAlpha > 0) {
          const gr = sl.glowRadius;
          const g = ctx.createRadialGradient(0, -14, 2, 0, -14, gr);
          g.addColorStop(0, sl.glowColor);
          g.addColorStop(1, withZeroAlpha(sl.glowColor));
          ctx.globalAlpha = clamp(alpha * sl.glowAlpha, 0, 1);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, -14, gr, 0, TAU);
          ctx.fill();
        }

        ctx.rotate(sl.angle);
        ctx.scale(sl.flipX ? -sl.scale : sl.scale, sl.flipY ? -sl.scale : sl.scale);
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.imageSmoothingEnabled = false;

        if (sl.clipRight < 0.999) {
          const visW = Math.max(2, Math.floor(sl.bufW * sl.clipRight));
          ctx.drawImage(surf.canvas, 0, 0, visW, sl.bufH, sl.ox, sl.oy, visW, sl.bufH);
        } else {
          ctx.drawImage(surf.canvas, sl.ox, sl.oy);
        }

        ctx.restore();
      }
    }

    function renderShockRings(layerName) {
      for (let i = 0; i < state.shockRings.length; i++) {
        const r = state.shockRings[i];
        if (r.layer !== layerName) continue;
        const p = clamp(r.age / r.dur, 0, 1);
        const rad = lerp(r.r0, r.r1, easeOutCubic(p));
        const alpha = 1 - easeInQuad(p);
        if (alpha <= 0.02) continue;

        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.globalAlpha = clamp(alpha, 0, 1);

        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(1.2, r.lineW * (1 - p * 0.65));
        ctx.beginPath();
        ctx.ellipse(0, 0, rad, rad * r.sy, 0, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = r.coreColor;
        ctx.lineWidth = Math.max(0.9, r.lineW * 0.42 * (1 - p * 0.6));
        ctx.beginPath();
        ctx.ellipse(0, 0, rad * 0.96, rad * r.sy * 0.96, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    function renderCustomLayer(layerName) {
      const list = state.customDrawables[layerName];
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const p = clamp(it.age / it.dur, 0, 1);
        ctx.save();
        try {
          it.draw(ctx, p, it);
        } catch (e) {}
        ctx.restore();
      }
    }

    /* -------------------- 分层高清渲染 render(preserveExisting) -------------------- */
    function render(preserveExisting) {
      if (!ctx) return;
      const cw = canvas.width || LOGICAL_W;
      const ch = canvas.height || LOGICAL_H;

      if (autoClear && !preserveExisting) {
        ctx.clearRect(0, 0, cw, ch);
      }

      ctx.save();
      if (cw !== LOGICAL_W || ch !== LOGICAL_H) {
        ctx.scale(cw / LOGICAL_W, ch / LOGICAL_H);
      }

      // Layer 0 (back): 地面法阵、地面脉络、后景震荡环、后景 PixelFX、后景自定义图层
      for (let i = 0; i < state.magicCircles.length; i++) {
        if (state.magicCircles[i].layer === 'back') drawMagicCircle(ctx, state.magicCircles[i]);
      }
      for (let i = 0; i < state.iceVeins.length; i++) {
        drawIceVein(ctx, state.iceVeins[i]);
      }
      renderShockRings('back');
      renderPfxLayer('back');
      renderCustomLayer('back');

      // Layer 1 (main): 英雄棘簇、主体 PixelFX、护盾、流光丝带、晶透残像、水柱、主体自定义图层
      for (let i = 0; i < state.heroThorns.length; i++) {
        drawHeroThorns(ctx, state.heroThorns[i]);
      }
      renderPfxLayer('main');
      for (let i = 0; i < state.shields.length; i++) {
        drawPrismShield(ctx, state.shields[i]);
      }
      for (let i = 0; i < state.ribbons.length; i++) {
        drawLuminousRibbon(ctx, state.ribbons[i]);
      }
      for (let i = 0; i < state.afterimages.length; i++) {
        drawWindAfterimage(ctx, state.afterimages[i]);
      }
      for (let i = 0; i < state.waterStreams.length; i++) {
        drawWaterStreamOverlay(ctx, state.waterStreams[i]);
      }
      renderCustomLayer('main');

      // Layer 2 (front): 天穹法阵、高空光雨、月牙刀光、前景 PixelFX、前景震荡环、电弧、前景自定义图层
      for (let i = 0; i < state.magicCircles.length; i++) {
        if (state.magicCircles[i].layer !== 'back') drawMagicCircle(ctx, state.magicCircles[i]);
      }
      for (let i = 0; i < state.skyBeams.length; i++) {
        drawSkyIcicleBeam(ctx, state.skyBeams[i]);
      }
      for (let i = 0; i < state.slashes.length; i++) {
        drawCrescentSlash(ctx, state.slashes[i]);
      }
      renderPfxLayer('front');
      renderShockRings('front');
      for (let i = 0; i < state.lightningArcs.length; i++) {
        drawLightningArc(ctx, state.lightningArcs[i]);
      }
      renderCustomLayer('front');

      // Layer 3 (overlay): 晶莹粒子 + 命中柔光闪 + 锐利星芒
      for (let i = 0; i < state.particles.length; i++) {
        drawParticle(ctx, state.particles[i]);
      }
      for (let i = 0; i < state.flashes.length; i++) {
        const fl = state.flashes[i];
        const p = clamp(fl.age / fl.dur, 0, 1);
        const a = (1 - p) * (1 - p) * fl.alpha;
        if (a <= 0.01) continue;
        const rad = fl.r * (0.5 + 0.7 * easeOutCubic(p));
        const g = ctx.createRadialGradient(fl.x, fl.y, 1, fl.x, fl.y, rad);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(0.35, fl.color);
        g.addColorStop(1, withZeroAlpha(fl.color));
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, rad, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      for (let i = 0; i < state.starFlares.length; i++) {
        const f = state.starFlares[i];
        const p = clamp(f.age / f.dur, 0, 1);
        const rad = p < 0.25
          ? lerp(f.r0, f.r1, easeOutBack(p / 0.25))
          : lerp(f.r1, f.r0 * 0.4, easeInQuad((p - 0.25) / 0.75));
        const a = (p < 0.7 ? 1 : clamp((1 - p) / 0.3, 0, 1)) * f.alpha;
        drawStarFlare(ctx, f.x, f.y, rad, f.inner, f.points, f.rot, f.outerColor, f.coreColor, a);
      }

      ctx.restore();
    }

    function clear() {
      state.timelines.length = 0;
      state.pfxSlots.length = 0;
      state.magicCircles.length = 0;
      state.ribbons.length = 0;
      state.waterStreams.length = 0;
      state.iceVeins.length = 0;
      state.heroThorns.length = 0;
      state.shields.length = 0;
      state.slashes.length = 0;
      state.skyBeams.length = 0;
      state.afterimages.length = 0;
      state.lightningArcs.length = 0;
      state.starFlares.length = 0;
      state.shockRings.length = 0;
      state.particles.length = 0;
      state.flashes.length = 0;
      state.customDrawables.back.length = 0;
      state.customDrawables.main.length = 0;
      state.customDrawables.front.length = 0;
      if (ctx) {
        const cw = canvas.width || LOGICAL_W;
        const ch = canvas.height || LOGICAL_H;
        ctx.clearRect(0, 0, cw, ch);
      }
    }

    function isActive() {
      return !!(
        state.timelines.length ||
        state.pfxSlots.length ||
        state.magicCircles.length ||
        state.ribbons.length ||
        state.waterStreams.length ||
        state.iceVeins.length ||
        state.heroThorns.length ||
        state.shields.length ||
        state.slashes.length ||
        state.skyBeams.length ||
        state.afterimages.length ||
        state.lightningArcs.length ||
        state.starFlares.length ||
        state.shockRings.length ||
        state.particles.length ||
        state.flashes.length ||
        state.customDrawables.back.length ||
        state.customDrawables.main.length ||
        state.customDrawables.front.length
      );
    }

    function getStats() {
      const customCount =
        state.customDrawables.back.length +
        state.customDrawables.main.length +
        state.customDrawables.front.length;
      return {
        pfxActive: state.pfxSlots.length,
        particles: state.particles.length,
        customDrawables: customCount,
        totalLayers: state.pfxSlots.length + state.magicCircles.length + state.heroThorns.length +
          state.slashes.length + state.skyBeams.length + state.ribbons.length +
          state.afterimages.length + customCount
      };
    }

    function getKit() {
      return kit;
    }

    return {
      play,
      update,
      render,
      clear,
      isActive,
      getDuration,
      getPeakTime,
      hasSkill,
      listSkills,
      resolveSkillId,
      getStats,
      getKit
    };
  }

  /* -------------------- 统一对外暴露接口 window.VfxEditionAFull -------------------- */
  const api = {
    meta: {
      id: 'edition_a_full',
      name: '方案 A · 全套战斗特效插件化核心底座',
      subtitle: '48 槽 PixelFX 复用 + 27/27 零裁边包围盒 + 24 套宝石明亮色板 + 插件化 Pack 注册',
      styleTag: '炫彩明亮像素 · 插件化核心底座',
      version: '2.0.0',
      logicalWidth: LOGICAL_W,
      logicalHeight: LOGICAL_H
    },
    LOGICAL_W,
    LOGICAL_H,
    MAX_PFX_SLOTS,
    MAX_PARTICLES,
    PALETTES,
    PFX_BOUNDS,
    SKILLS,
    SKILL_MAP,
    SKILL_ALIASES,
    PACKS,
    registerPack,
    registerAliases,
    resolveSkillId,
    hasSkill,
    listSkills,
    getDuration,
    getPeakTime,
    create
  };

  global.VfxEditionAFull = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
