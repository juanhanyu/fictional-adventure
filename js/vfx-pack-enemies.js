/* ============================================================================
   《转生千金》方案 A 战斗特效 · Pack 3 全 9 幕敌方与 Boss 攻击特效（26 项）
   文件：js/vfx-pack-enemies.js
   依赖：js/vfx-edition-a-core.js（window.VfxEditionAFull）
   注册：VfxEditionAFull.registerPack('pack3_enemies_all9acts', META, HANDLERS, ALIASES)
   支持：浏览器全局 window 与 CommonJS module.exports 双端加载

   美学铁律：
   - 统一方案 A 明亮炫彩宝石通透日系奇幻审美，严禁浑浊黑灰泥浆
   - 罗文系采用明亮紫水晶 + 红宝石纯银色（eclipse / bloodRuby / eclipseSpark）
   - 狼 / 魔兽爪击采用晶亮白青霜锋配高光（silverIce / ice / clawBright）
   - 风神之眼采用通透翡翠天青配香槟金辉（wind / slashWind / gold7）
   - 全 26 项原生适配 o.facing === -1（敌攻我）与 o.facing === 1（正向）双向镜像
   ============================================================================ */
(function (global) {
  'use strict';

  var PACK_NAME = 'pack3_enemies_all9acts';

  var Core = global.VfxEditionAFull;
  if (!Core && typeof require === 'function') {
    try {
      Core = require('./vfx-edition-a-core.js');
    } catch (e) {
      Core = null;
    }
  }

  var TAU = Math.PI * 2;
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOutCubic = function (t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); };
  var easeOutQuart = function (t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 4); };
  var easeInQuad = function (t) { var u = clamp(t, 0, 1); return u * u; };
  var easeOutBack = function (t) {
    var u = clamp(t, 0, 1);
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  };

  // 明亮紫晶增强色带（用于 shadow_tendrils 等易偏深像素素材，彻底杜绝黑泥感）
  var BRIGHT_AMETHYST_TENDRIL = [
    '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA',
    '#C4B5FD', '#DDD6FE', '#F5F3FF', '#FFFFFF'
  ];
  var BRIGHT_RUBY_TENDRIL = [
    '#BE123C', '#E11D48', '#F43F5E', '#FB7185',
    '#FDA4AF', '#FECDD3', '#FFE4E6', '#FFFFFF'
  ];
  var SILVER_ECLIPSE_PEARL = ['#C4B5FD', '#EDE9FE', '#F5F3FF', '#FFFFFF'];
  var FROST_CLAW_PAL = [
    '#0284C7', '#0EA5E9', '#38BDF8', '#67E8F9',
    '#A5F3FC', '#E0F7FF', '#F8FAFC', '#FFFFFF'
  ];
  var EMERALD_BRIGHT_PILLAR = [
    '#059669', '#10B981', '#14B8A6', '#2DD4BF',
    '#6EE7B7', '#A7F3D0', '#FEF9C3', '#FFFFFF'
  ];

  /* -------------------- 双向方向镜像与目标解析辅助 -------------------- */
  function dirTransform(dx, dy) {
    if (dx < 0) {
      return { flipX: true, angle: Math.atan2(-dy, -dx) };
    }
    return { flipX: false, angle: Math.atan2(dy, dx) };
  }

  function dirAngle(facing, rightAngle) {
    return facing < 0 ? (Math.PI - rightAngle) : rightAngle;
  }

  function addMirroredSlash(kit, facing, baseCenter, spec) {
    var dx = spec.dx || 0;
    var dy = spec.dy || 0;
    var tilt = spec.tilt || 0;
    var sA = spec.startAngle != null ? spec.startAngle : -2.45;
    var eA = spec.endAngle != null ? spec.endAngle : 0.78;
    var cfg = Object.assign({}, spec, {
      x: baseCenter.x + dx * facing,
      y: baseCenter.y + dy,
      tilt: facing < 0 ? -tilt : tilt,
      startAngle: facing < 0 ? (Math.PI - sA) : sA,
      endAngle: facing < 0 ? (Math.PI - eA) : eA
    });
    delete cfg.dx;
    delete cfg.dy;
    return kit.addSlash(cfg);
  }

  function resolveTargets(o, wantSpread) {
    var list = Array.isArray(o.targets) ? o.targets : [];
    var isCoreDefault =
      list.length === 3 &&
      list[0].x === 410 && list[1].x === 486 && list[2].x === 560;

    if (list.length > 0 && !isCoreDefault) {
      return list;
    }
    if (!wantSpread) {
      return [{ x: o.to.x, y: o.to.y, groundY: o.targetGroundY }];
    }
    if (isCoreDefault && o.facing >= 0 && Math.abs(o.to.x - 472) <= 95) {
      return list;
    }
    var cx = o.to.x;
    var cy = o.to.y;
    var gy = o.targetGroundY;
    return [
      { x: clamp(cx - 54, 52, 588), y: cy - 6, groundY: gy - 6 },
      { x: cx, y: cy, groundY: gy },
      { x: clamp(cx + 54, 52, 588), y: cy + 6, groundY: gy + 6 }
    ];
  }

  function calcCenter(targets, fallback) {
    if (!targets || !targets.length) return fallback;
    var sx = 0, sy = 0, sg = 0;
    for (var i = 0; i < targets.length; i++) {
      sx += targets[i].x;
      sy += targets[i].y;
      sg += targets[i].groundY;
    }
    var n = targets.length;
    return { x: sx / n, y: sy / n, groundY: sg / n };
  }

  function quadPt(p0, p1, p2, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  function quadTan(p0, p1, p2, t) {
    var dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    var dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    return { dx: dx, dy: dy };
  }

  /* -------------------- 26 项全 9 幕敌方与 Boss 特效元数据 -------------------- */
  var PACK_META = [
    // 第 1 幕 贝阿特丽丝（3 项）
    {
      id: 'enemy_beatrice_flame_lash',
      name: '烈焰鞭袭',
      en: 'Beatrice Flame Lash',
      kind: 'melee',
      targetMode: 'single',
      duration: 1220,
      peakMs: 360,
      accent: '#F97316',
      desc: '绯金炽焰化作柔韧流光长鞭横甩破空，落点炸开红莲刀芒与金红火花'
    },
    {
      id: 'enemy_beatrice_ruby_orb',
      name: '绯红火球',
      en: 'Beatrice Ruby Orb',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1260,
      peakMs: 470,
      accent: '#EF4444',
      desc: '掌心凝成多面红宝石耀炎火球弧线疾飞，命中绽放炽亮绯金火环与红莲火瓣'
    },
    {
      id: 'enemy_beatrice_noble_flare',
      name: '贵族耀焰',
      en: 'Beatrice Noble Flare',
      kind: 'ultimate',
      targetMode: 'single',
      duration: 1420,
      peakMs: 520,
      accent: '#FBBF24',
      desc: '抬肩蓄起香槟金与绯红贵族纹章阵，冲天红莲火柱伴重劈耀焰光冕倾泻而下'
    },

    // 第 2 幕 罗文（3 项）
    {
      id: 'enemy_rowan_eclipse_bolt',
      name: '紫银蚀弹',
      en: 'Rowan Eclipse Bolt',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1280,
      peakMs: 470,
      accent: '#A78BFA',
      desc: '晦轮紫晶银环于杖尖旋开，双轨紫银与红宝石蚀月弯刃疾射命中爆出纯银月晕'
    },
    {
      id: 'enemy_rowan_blood_sigil',
      name: '血晶印阵',
      en: 'Rowan Blood Sigil',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1360,
      peakMs: 520,
      accent: '#F43F5E',
      desc: '足底血晶脉络疾驰铭刻纯银红宝石六芒星阵，破土竖起剔透血晶棱棘并伴棱镜闪爆'
    },
    {
      id: 'enemy_rowan_grave_surge',
      name: '墓园灵潮',
      en: 'Rowan Grave Surge',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1460,
      peakMs: 560,
      accent: '#C4B5FD',
      desc: '天穹浮现紫晶纯银蚀月华冠，地面涌起晶亮紫银灵潮与红宝晶藤浪涛席卷目标'
    },

    // 第 3 幕 爱丽丝（2 项）
    {
      id: 'enemy_alice_gale_ribbon',
      name: '翠风缎刃',
      en: 'Alice Gale Ribbon',
      kind: 'dash',
      targetMode: 'single',
      duration: 1240,
      peakMs: 420,
      accent: '#34D399',
      desc: '清透翡翠风缎托举轻盈双残像滑步掠近，双弧翠白透明风刃交错掠斩'
    },
    {
      id: 'enemy_alice_petal_cyclone',
      name: '花风旋舞',
      en: 'Alice Petal Cyclone',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1380,
      peakMs: 480,
      accent: '#6EE7B7',
      desc: '双掌合拢卷起晶透翠青龙卷风暴，漫天粉樱花瓣与翠叶随螺旋风带盘旋绽放'
    },

    // 第 4 幕 艾诺（3 项）
    {
      id: 'enemy_aino_frost_lance',
      name: '银冰长枪',
      en: 'Aino Frost Lance',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1240,
      peakMs: 430,
      accent: '#60A5FA',
      desc: '无气泡镜面银冰准星聚束，音速冰枪携三道钻石激波锥贯刺并炸裂纯白镜霜'
    },
    {
      id: 'enemy_aino_glacier_sweep',
      name: '冰川横扫',
      en: 'Aino Glacier Sweep',
      kind: 'melee',
      targetMode: 'single',
      duration: 1320,
      peakMs: 460,
      accent: '#93C5FD',
      desc: '贴地银霜滑步拖出镜面残像，半月银蓝冰川巨斩配破土镜面冰棱浪潮横扫'
    },
    {
      id: 'enemy_aino_north_hail',
      name: '北境霰阵',
      en: 'Aino North Hail',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1440,
      peakMs: 590,
      accent: '#DBEAFE',
      desc: '双手压地展开极北高空冰晶方阵，七道斜向镜冰光矛疾坠引发纯银雪花冰环爆'
    },

    // 第 5 幕 诺艾尔（3 项）
    {
      id: 'enemy_noelle_arcane_grid',
      name: '星轨魔阵',
      en: 'Noelle Arcane Grid',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1360,
      peakMs: 500,
      accent: '#22D3EE',
      desc: '零留白透视星轨坐标网格锁死落点，水蓝靛紫交汇节点迸发十字尺量水刃'
    },
    {
      id: 'enemy_noelle_prism_ray',
      name: '折光射线',
      en: 'Noelle Prism Ray',
      kind: 'beam',
      targetMode: 'single',
      duration: 1320,
      peakMs: 460,
      accent: '#38BDF8',
      desc: '悬浮双菱晶镜片精准折射高压碧蓝光谱射线，贯击目标溅起彩虹水花与波澜'
    },
    {
      id: 'enemy_noelle_formula_nova',
      name: '推演星爆',
      en: 'Noelle Formula Nova',
      kind: 'ultimate',
      targetMode: 'multi',
      duration: 1460,
      peakMs: 560,
      accent: '#818CF8',
      desc: '冰缝暗水线贴地渗至足下，靛蓝金星盘钟轮展开推演完毕引爆璀璨水星新星'
    },

    // 第 6 幕 雪狼 / 魔兽 / 冰原巨兽（4 项）
    {
      id: 'enemy_wolf_frost_claw',
      name: '霜爪撕裂',
      en: 'Wolf Frost Claw',
      kind: 'melee',
      targetMode: 'single',
      duration: 1180,
      peakMs: 320,
      accent: '#67E8F9',
      desc: '疾扑拖出霜白影迹，三道晶亮白青爪芒携金白锋光撕裂目标并迸散冰棱碎屑'
    },
    {
      id: 'enemy_wolf_howl_chill',
      name: '凛嚎冰环',
      en: 'Wolf Howl Chill',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1320,
      peakMs: 440,
      accent: '#7DD3FC',
      desc: '仰首啸出多重晶透白青霜寒声波环横扫全场，于目标处绽放寒霜星雪冲击'
    },
    {
      id: 'enemy_beast_pounce_slam',
      name: '冰原猛扑',
      en: 'Beast Pounce Slam',
      kind: 'melee',
      targetMode: 'single',
      duration: 1340,
      peakMs: 400,
      accent: '#38BDF8',
      desc: '腾空高跃划出白青金弧线，重重扑砸目标激起冰原裂震与晶亮交叉爪爆'
    },
    {
      id: 'enemy_behemoth_glacier_stomp',
      name: '巨冰震踏',
      en: 'Behemoth Glacier Stomp',
      kind: 'ultimate',
      targetMode: 'multi',
      duration: 1520,
      peakMs: 560,
      accent: '#BAE6FD',
      desc: '巨兽重踏引爆冰谷断层，三道湛蓝冰脉横贯战场掀起高大巨冰晶峰与冻土震波'
    },

    // 第 7–8 幕 宫廷炎师 / 重甲先锋 / 东翼护卫（4 项）
    {
      id: 'enemy_flame_mage_cast',
      name: '绯莲火雨',
      en: 'Flame Mage Cast',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1420,
      peakMs: 560,
      accent: '#FB923C',
      desc: '双手结印张开高空红莲法阵，六道斜坠赤金火流星轰然引爆炽亮红莲炎环'
    },
    {
      id: 'enemy_vanguard_halberd',
      name: '金钢戟斩',
      en: 'Vanguard Halberd',
      kind: 'melee',
      targetMode: 'single',
      duration: 1280,
      peakMs: 380,
      accent: '#F59E0B',
      desc: '精钢长戟顶闪皇家金芒，大弧劈落金钢重戟斩激起璀璨金色裂地冲击波'
    },
    {
      id: 'enemy_eastwing_cross_slash',
      name: '十字银斩',
      en: 'Eastwing Cross Slash',
      kind: 'melee',
      targetMode: 'single',
      duration: 1320,
      peakMs: 440,
      accent: '#FDE68A',
      desc: '红莲银甲疾掠残像，一劈一挑瞬息交织纯白银锋与绯金巨型十字耀斩'
    },
    {
      id: 'enemy_eastwing_phalanx_rush',
      name: '辉盾冲锋',
      en: 'Eastwing Phalanx Rush',
      kind: 'dash',
      targetMode: 'single',
      duration: 1360,
      peakMs: 460,
      accent: '#FBBF24',
      desc: '身前凝成多面璀璨金红光盾箭矢突击阵型破风撞击，轰出辉金盾震冲击波'
    },

    // 第 9 幕 竞技场风神之眼（4 项）
    {
      id: 'enemy_windgod_tempest_arc',
      name: '青空裂风',
      en: 'Wind God Tempest Arc',
      kind: 'projectile',
      targetMode: 'single',
      duration: 1320,
      peakMs: 440,
      accent: '#2DD4BF',
      desc: '风神挥出通透翡翠天青裂空月牙风波疾驰而至，连携双弧翠金真空连刃斩裂长空'
    },
    {
      id: 'enemy_windgod_emerald_vortex',
      name: '翡翠飓眼',
      en: 'Wind God Emerald Vortex',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1480,
      peakMs: 560,
      accent: '#10B981',
      desc: '风暴眼全开卷起擎天翡翠天青螺旋飓柱与金辉风冠，席卷翠叶电弧与飓风冲击'
    },
    {
      id: 'enemy_windgod_sky_judgment',
      name: '天穹风裁',
      en: 'Wind God Sky Judgment',
      kind: 'ultimate',
      targetMode: 'multi',
      duration: 1560,
      peakMs: 600,
      accent: '#6EE7B7',
      desc: '苍穹绽放金翠神圣风轮，六道翡翠金岚斜裁而下汇聚擎天青金风裁光柱轰击全场'
    },
    {
      id: 'enemy_windgod_eye_pulse',
      name: '神瞳震波',
      en: 'Wind God Eye Pulse',
      kind: 'aoe',
      targetMode: 'multi',
      duration: 1420,
      peakMs: 460,
      accent: '#CCFBF1',
      desc: '虚空凝现晶莹翡翠金瞳神徽缓缓睁开，连发三重清透翠金神瞳震波贯震全场'
    }
  ];

  /* -------------------- 26 项全 9 幕敌方与 Boss 编排器 -------------------- */
  var PACK_HANDLERS = {
    /* ========================================================================
       第 1 幕 · 贝阿特丽丝（3 项）
       ======================================================================== */

    /* 1. 烈焰鞭袭 (enemy_beatrice_flame_lash) */
    enemy_beatrice_flame_lash: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY, targetGroundY = o.targetGroundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var hand = { x: from.x + facing * 14, y: from.y - 6 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 2, radius: 42 * ampScale, sy: 0.30,
              palette: 'fire', goldTriple: amp >= 3, dur: 460, fadeIn: 80, fadeOut: 140
            });
            kit.addStarFlare({
              x: hand.x, y: hand.y, r0: 4, r1: 30 * ampScale, points: 6,
              outerColor: '#F97316', coreColor: '#FFFFFF', dur: 240
            });
            kit.spawnBurstParticles(hand.x, hand.y, 12, 'petal', {
              spdMin: 35, spdMax: 115, upBias: 45, sizeMin: 3.2, sizeMax: 6.0,
              colors: ['#FEF08A', '#FCD34D', '#FB923C'], color2: '#DC2626',
              lifeMin: 240, lifeMax: 420
            });
          }
        },
        {
          at: 105,
          fn: function () {
            var tg = targets[0];
            // 炽亮红金长鞭动态波纹自定义图层（完整双向）
            kit.addCustomDrawable('front', {
              dur: 430,
              draw: function (ctx, p) {
                var extend = easeOutQuart(clamp(p / 0.36, 0, 1));
                var fade = p < 0.62 ? 1 : clamp((1 - p) / 0.38, 0, 1);
                if (fade <= 0.02) return;
                var segs = 28;
                var pts = [];
                for (var i = 0; i <= segs; i++) {
                  var u = (i / segs) * extend;
                  var bx = lerp(hand.x, tg.x, u);
                  var by = lerp(hand.y, tg.y - 4, u);
                  var env = Math.sin(u * Math.PI);
                  var wave = Math.sin(u * Math.PI * 2.6 - p * 12.0) * 26 * env;
                  var arch = -Math.sin(u * Math.PI) * 30;
                  pts.push({ x: bx, y: by + arch + wave });
                }
                if (pts.length < 2) return;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                // 外层艳红火晕
                ctx.globalAlpha = 0.42 * fade;
                ctx.strokeStyle = '#DC2626';
                ctx.lineWidth = 17 * ampScale;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
                ctx.stroke();

                // 中层橙金流火
                ctx.globalAlpha = 0.92 * fade;
                ctx.strokeStyle = '#F97316';
                ctx.lineWidth = 8.5 * ampScale;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (var m = 1; m < pts.length; m++) ctx.lineTo(pts[m].x, pts[m].y);
                ctx.stroke();

                // 鞭芯纯白暖金亮丝
                ctx.globalAlpha = fade;
                ctx.strokeStyle = '#FEF08A';
                ctx.lineWidth = 3.6 * ampScale;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (var n = 1; n < pts.length; n++) ctx.lineTo(pts[n].x, pts[n].y);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (var q = 1; q < pts.length; q++) ctx.lineTo(pts[q].x, pts[q].y);
                ctx.stroke();

                // 鞭梢星爆节点
                var tip = pts[pts.length - 1];
                kit.drawStarFlare(ctx, tip.x, tip.y, 18 * ampScale * fade, 0.22, 4, p * 6, '#FCD34D', '#FFFFFF', fade);
              }
            });

            var ribPts = [];
            for (var r = 0; r <= 14; r++) {
              var rt = r / 14;
              ribPts.push({
                x: lerp(hand.x, tg.x, rt),
                y: lerp(hand.y, tg.y, rt) - Math.sin(rt * Math.PI) * 34
              });
            }
            kit.addRibbon({
              pts: ribPts, width: 9 * ampScale, palette: 'fire',
              alpha: 0.88, dur: 460, fadeOut: 220
            });
          }
        },
        {
          at: 255,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              var isLast = idx === targets.length - 1;
              kit.safeCall(o.onImpact, idx, tg, isLast);

              var swScale = 1.92 * ampScale;
              kit.spawnPfx('sword_slash', {
                palette: PAL.fire, sparks: PAL.fireSpark, radius: 46
              }, {
                x: tg.x - facing * 26 * swScale,
                y: tg.y + 36 * swScale,
                flipX: facing < 0,
                scale: swScale,
                durMs: 560, fadeInMs: 10, fadeOutMs: 160, layer: 'front'
              });

              addMirroredSlash(kit, facing, tg, {
                dx: -6, dy: 2,
                rx: 102 * ampScale, ry: 60 * ampScale,
                tilt: -0.44, startAngle: -2.50, endAngle: 0.82,
                thickness: 24 * ampScale, palette: 'fire', dur: 420
              });

              kit.spawnPfx('hit_spark', { palette: PAL.fire, height: 22, aim: 0.12 }, {
                x: tg.x, y: tg.y + 30, flipX: facing < 0,
                scale: 1.68 * ampScale, durMs: 420, layer: 'front'
              });

              kit.addFlash(tg.x, tg.y, 54 * ampScale, '#FB923C', 160, 0.44);
              kit.addStarFlare({
                x: tg.x, y: tg.y, r0: 10, r1: 52 * ampScale, points: 6,
                outerColor: '#FCD34D', coreColor: '#FFFFFF', dur: 320
              });
              kit.addShockRing({
                x: tg.x, y: tg.groundY + 2, r0: 12, r1: 92 * ampScale, sy: 0.30,
                color: '#F97316', coreColor: '#FEF08A', lineW: 3.8, dur: 420
              });
              kit.spawnBurstParticles(tg.x, tg.y, 24, 'petal', {
                angleBase: dirAngle(facing, -0.35), spread: 1.8,
                spdMin: 95, spdMax: 260, upBias: 75, sizeMin: 3.8, sizeMax: 7.4,
                colors: ['#FEF08A', '#FCD34D', '#FB923C', '#F43F5E'], color2: '#DC2626',
                lifeMin: 400, lifeMax: 720
              });
              kit.spawnBurstParticles(tg.x, tg.y, 20, 'spark', {
                angleBase: dirAngle(facing, 0.1), spread: 1.6,
                spdMin: 150, spdMax: 340, sizeMin: 2.4, sizeMax: 4.5,
                colors: ['#FFFFFF', '#FEF08A', '#FB923C'],
                gravity: 150, lifeMin: 260, lifeMax: 480
              });
            }
            kit.safeCall(o.onShake, 7.2 + amp * 1.8, 220);
            kit.safeCall(o.onHitStop, 52 + amp * 10);
          }
        },
        {
          at: 365,
          fn: function () {
            var tg = targets[0];
            addMirroredSlash(kit, facing, tg, {
              dx: 4, dy: -4,
              rx: 84 * ampScale, ry: 48 * ampScale,
              tilt: 0.56, startAngle: 2.45, endAngle: -0.78,
              thickness: 18 * ampScale, palette: 'gold7', dur: 380
            });
            kit.addLightning(tg.x - facing * 34, tg.y - 30, tg.x + facing * 34, tg.y + 24, {
              outerColor: '#DC2626', midColor: '#FCD34D', coreColor: '#FFFFFF',
              width: 2.2, dur: 240, branches: 2
            });
            kit.addShockRing({
              x: tg.x, y: tg.y, r0: 14, r1: 72 * ampScale, sy: 0.84,
              color: '#FCD34D', coreColor: '#FFFFFF', lineW: 2.8, dur: 320, layer: 'front'
            });
          }
        }
      ]);
    },

    /* 2. 绯红火球 (enemy_beatrice_ruby_orb) */
    enemy_beatrice_ruby_orb: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var p0 = { x: from.x + facing * 18, y: from.y - 8 };
      var p2 = { x: tg.x, y: tg.y - 4 };
      var p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 42 };
      var travelMs = 215;

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 2, radius: 44 * ampScale, sy: 0.30,
              palette: 'fire', goldTriple: amp >= 3, dur: 480
            });
            // 掌心凝聚红宝石多面火球
            kit.addCustomDrawable('front', {
              dur: 190,
              draw: function (ctx, p) {
                var r = (7 + 15 * easeOutBack(p)) * ampScale;
                ctx.translate(p0.x, p0.y);
                var g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.9);
                g.addColorStop(0, '#FFFFFF');
                g.addColorStop(0.35, '#FCD34D');
                g.addColorStop(0.7, 'rgba(249,115,22,0.55)');
                g.addColorStop(1, 'rgba(220,38,38,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.9, 0, TAU);
                ctx.fill();

                ctx.rotate(p * 3.2);
                ctx.fillStyle = '#EF4444';
                ctx.beginPath();
                for (var i = 0; i < 6; i++) {
                  var a = (i / 6) * TAU;
                  var px = Math.cos(a) * r;
                  var py = Math.sin(a) * r;
                  if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#FEF08A';
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.52, 0, TAU);
                ctx.fill();
              }
            });
            kit.spawnBurstParticles(p0.x, p0.y, 14, 'star', {
              spdMin: 24, spdMax: 88, upBias: 30, sizeMin: 2.8, sizeMax: 5.2,
              colors: ['#FFFFFF', '#FEF08A', '#FB923C', '#F43F5E'],
              gravity: -20, lifeMin: 220, lifeMax: 380
            });
          }
        },
        {
          at: 165,
          fn: function () {
            var ribbon = kit.addRibbon({
              pts: [p0], width: 11 * ampScale, palette: 'fire',
              alpha: 0.94, dur: 480, fadeOut: 220
            });
            var initTan = quadTan(p0, p1, p2, 0);
            var initDir = dirTransform(initTan.dx, initTan.dy);

            kit.spawnPfx('fireball', {
              palette: PAL.fire, radius: 7, speed: 140
            }, {
              x: p0.x, y: p0.y,
              flipX: initDir.flipX,
              angle: initDir.angle,
              scale: 1.62 * ampScale,
              timeScale: 1.45,
              durMs: travelMs + 55,
              fadeInMs: 18, fadeOutMs: 45,
              layer: 'front',
              glowColor: 'rgba(251,146,60,0.52)', glowRadius: 40, glowAlpha: 0.48,
              onUpdate: function (slot, dtSec, age) {
                var t = easeOutCubic(clamp(age / travelMs, 0, 1));
                var pos = quadPt(p0, p1, p2, t);
                var tan = quadTan(p0, p1, p2, Math.min(0.99, t));
                var dir = dirTransform(tan.dx, tan.dy);
                slot.x = pos.x;
                slot.y = pos.y;
                slot.flipX = dir.flipX;
                slot.angle = dir.angle;
                if (t < 1) {
                  ribbon.pts.push({ x: pos.x, y: pos.y });
                  if (ribbon.pts.length > 22) ribbon.pts.shift();
                  if (Math.random() < 0.72) {
                    kit.addParticle({
                      kind: Math.random() < 0.55 ? 'petal' : 'spark',
                      x: pos.x + (Math.random() - 0.5) * 12,
                      y: pos.y + (Math.random() - 0.5) * 12,
                      vx: -facing * (35 + Math.random() * 55),
                      vy: (Math.random() - 0.5) * 55,
                      size: 3.4 + Math.random() * 3.0,
                      color: Math.random() < 0.4 ? '#FEF08A' : '#FB923C',
                      color2: '#DC2626',
                      life: 240 + Math.random() * 180
                    });
                  }
                }
              }
            });

            kit.addShockRing({
              x: p0.x, y: p0.y, r0: 6, r1: 34 * ampScale, sy: 0.86,
              color: '#F97316', coreColor: '#FEF08A', lineW: 3.2, dur: 220, layer: 'front'
            });
          }
        },
        {
          at: 380,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              kit.spawnPfx('fire_ring', { palette: PAL.fire, reach: 94 }, {
                x: cur.x, y: cur.groundY + 4,
                scale: 1.78 * ampScale,
                preWarmSec: 0.30, timeScale: 1.60, durMs: 740,
                fadeInMs: 14, fadeOutMs: 200, layer: 'main',
                glowColor: 'rgba(251,146,60,0.52)', glowRadius: 76 * ampScale, glowAlpha: 0.48
              });

              kit.spawnPfx('crit_hit', { palette: PAL.fire, height: 24, aim: 0.08 }, {
                x: cur.x, y: cur.y + 32, flipX: facing < 0,
                scale: 1.84 * ampScale, durMs: 520, layer: 'front'
              });

              // 红宝石火焰莲华冲击波纹
              (function (cx, cy) {
                kit.addCustomDrawable('front', {
                  dur: 460,
                  draw: function (ctx, p) {
                    var r = lerp(18, 72, easeOutCubic(p)) * ampScale;
                    var fade = p < 0.55 ? 1 : clamp((1 - p) / 0.45, 0, 1);
                    if (fade <= 0.02) return;
                    ctx.translate(cx, cy);
                    ctx.rotate(p * 2.2 * facing);
                    ctx.globalAlpha = fade * 0.9;
                    for (var k = 0; k < 6; k++) {
                      var a = (k / 6) * TAU;
                      ctx.save();
                      ctx.rotate(a);
                      ctx.fillStyle = k % 2 === 0 ? '#FB923C' : '#F43F5E';
                      ctx.beginPath();
                      ctx.moveTo(r * 0.36, 0);
                      ctx.quadraticCurveTo(r * 0.72, -10 * (1 - p * 0.4), r, 0);
                      ctx.quadraticCurveTo(r * 0.72, 10 * (1 - p * 0.4), r * 0.36, 0);
                      ctx.closePath();
                      ctx.fill();
                      ctx.fillStyle = '#FEF08A';
                      ctx.beginPath();
                      ctx.moveTo(r * 0.44, 0);
                      ctx.quadraticCurveTo(r * 0.72, -4 * (1 - p * 0.4), r * 0.88, 0);
                      ctx.quadraticCurveTo(r * 0.72, 4 * (1 - p * 0.4), r * 0.44, 0);
                      ctx.closePath();
                      ctx.fill();
                      ctx.restore();
                    }
                  }
                });
              })(cur.x, cur.y - 4);

              kit.addFlash(cur.x, cur.y, 68 * ampScale, '#F97316', 175, 0.48);
              kit.addStarFlare({
                x: cur.x, y: cur.y - 4, r0: 14, r1: 68 * ampScale, points: 8,
                outerColor: '#FCD34D', coreColor: '#FFFFFF', dur: 400
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 14, r1: 124 * ampScale, sy: 0.30,
                color: '#EA580C', coreColor: '#FEF08A', lineW: 4.4, dur: 480
              });
              kit.addShockRing({
                x: cur.x, y: cur.y, r0: 12, r1: 90 * ampScale, sy: 0.88,
                color: '#F43F5E', coreColor: '#FFFFFF', lineW: 3.4, dur: 380, layer: 'front'
              });

              kit.spawnBurstParticles(cur.x, cur.y - 6, 36, 'petal', {
                spdMin: 80, spdMax: 265, upBias: 118, sizeMin: 4.2, sizeMax: 8.6,
                colors: ['#FEF08A', '#FCD34D', '#FB923C', '#F43F5E', '#FFFFFF'], color2: '#DC2626',
                lifeMin: 460, lifeMax: 820
              });
              kit.spawnBurstParticles(cur.x, cur.y, 26, 'spark', {
                spdMin: 140, spdMax: 340, upBias: 90, sizeMin: 2.5, sizeMax: 4.8,
                colors: ['#FFFFFF', '#FEF08A', '#F97316'],
                gravity: 210, groundY: cur.groundY, bounce: 0.35, lifeMin: 340, lifeMax: 620
              });
            }
            kit.safeCall(o.onShake, 8.6 + amp * 2.0, 260);
            kit.safeCall(o.onHitStop, 58 + amp * 12);
          }
        }
      ]);
    },

    /* 3. 贵族耀焰 (enemy_beatrice_noble_flare) */
    enemy_beatrice_noble_flare: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 4, radius: 54 * ampScale, sy: 0.30,
              palette: 'fire', goldTriple: true, dur: 640, fadeIn: 90, fadeOut: 180
            });
            kit.spawnPfx('magic_circle_cast', { palette: PAL.fire }, {
              x: from.x - facing * 8, y: groundY + 4, scale: 1.38 * ampScale,
              preWarmSec: 0.90, timeScale: 2.0, durMs: 560, layer: 'back'
            });
            kit.addStarFlare({
              x: from.x + facing * 10, y: from.y - 24, r0: 6, r1: 42 * ampScale, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 300
            });
            // 锁定目标脚下红金纹章阵
            kit.addMagicCircle({
              x: tg.x, y: tg.groundY + 4, radius: 66 * ampScale, sy: 0.30,
              rimColor: '#EA580C', starColor: '#FDE68A', runeColor: '#FFFFFF',
              innerGlow: 'rgba(254,240,138,0.68)', outerGlow: 'rgba(239,68,68,0.34)',
              goldTriple: true, dur: 980, fadeIn: 140, fadeOut: 240
            });
          }
        },
        {
          at: 170,
          fn: function () {
            var p0 = { x: from.x + facing * 10, y: from.y - 16 };
            var p2 = { x: tg.x, y: tg.y - 10 };
            var p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 68 };
            var ptsA = [], ptsB = [];
            for (var i = 0; i <= 20; i++) {
              var t = i / 20;
              var q = quadPt(p0, p1, p2, t);
              var w = Math.sin(t * Math.PI * 3) * 14;
              ptsA.push({ x: q.x, y: q.y + w });
              ptsB.push({ x: q.x, y: q.y - w });
            }
            kit.addRibbon({ pts: ptsA, width: 10.5 * ampScale, palette: 'fire', alpha: 0.94, dur: 520, fadeOut: 240 });
            kit.addRibbon({ pts: ptsB, width: 8.0 * ampScale, palette: 'gold7', alpha: 0.90, dur: 520, fadeOut: 240 });
          }
        },
        {
          at: 350,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              kit.spawnPfx('flame_pillar', {
                palette: PAL.fire, stone: '#F59E0B', height: 152
              }, {
                x: cur.x, y: cur.groundY + 6,
                scale: 1.56 * ampScale,
                preWarmSec: 0.55, timeScale: 1.58, durMs: 840,
                fadeInMs: 18, fadeOutMs: 240, layer: 'main',
                glowColor: 'rgba(253,224,71,0.46)', glowRadius: 78 * ampScale, glowAlpha: 0.44
              });

              kit.spawnPfx('heavy_cleave', {
                palette: PAL.fire, stone: '#FBBF24'
              }, {
                x: cur.x - facing * 34 * 1.72 * ampScale,
                y: cur.groundY + 4,
                flipX: facing < 0,
                scale: 1.72 * ampScale,
                preWarmSec: 0.22, timeScale: 1.45, durMs: 740,
                fadeInMs: 12, fadeOutMs: 200, layer: 'front'
              });

              // 贵族耀焰八芒光冕 + 炽金耀光柱
              (function (cx, cy, cgy) {
                kit.addCustomDrawable('front', {
                  dur: 560,
                  draw: function (ctx, p) {
                    var rise = easeOutCubic(clamp(p / 0.26, 0, 1));
                    var fade = p < 0.55 ? 1 : clamp((1 - p) / 0.45, 0, 1);
                    if (fade <= 0.02) return;
                    var colH = 220 * rise * ampScale;
                    var colW = 46 * (0.7 + 0.3 * Math.sin(p * Math.PI)) * ampScale;
                    var cg = ctx.createLinearGradient(cx - colW, cgy, cx + colW, cgy);
                    cg.addColorStop(0, 'rgba(239,68,68,0)');
                    cg.addColorStop(0.25, 'rgba(249,115,22,0.48)');
                    cg.addColorStop(0.5, 'rgba(255,255,255,0.88)');
                    cg.addColorStop(0.75, 'rgba(249,115,22,0.48)');
                    cg.addColorStop(1, 'rgba(239,68,68,0)');
                    ctx.globalAlpha = fade * 0.85;
                    ctx.fillStyle = cg;
                    ctx.fillRect(cx - colW, cgy - colH, colW * 2, colH);

                    // 贵族光冠顶环
                    ctx.strokeStyle = '#FDE68A';
                    ctx.lineWidth = 2.8;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy - 52, 58 * rise * ampScale, 16 * rise * ampScale, 0, 0, TAU);
                    ctx.stroke();

                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy - 52, 46 * rise * ampScale, 12 * rise * ampScale, 0, 0, TAU);
                    ctx.stroke();
                  }
                });
              })(cur.x, cur.y, cur.groundY);

              kit.addFlash(cur.x, cur.y - 16, 76 * ampScale, '#FCD34D', 190, 0.45);
              kit.addStarFlare({
                x: cur.x, y: cur.y - 14, r0: 14, r1: 78 * ampScale, inner: 0.16, points: 8,
                outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 460
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 18, r1: 144 * ampScale, sy: 0.28,
                color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.6, dur: 540
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 12, r1: 112 * ampScale, sy: 0.28,
                color: '#EF4444', coreColor: '#FFFFFF', lineW: 3.6, dur: 480
              });
              kit.spawnBurstParticles(cur.x, cur.y - 18, 36, 'petal', {
                spdMin: 75, spdMax: 270, upBias: 140, sizeMin: 4.2, sizeMax: 8.6,
                colors: ['#FEF08A', '#FCD34D', '#FB923C', '#F43F5E', '#FFFFFF'], color2: '#B91C1C',
                lifeMin: 520, lifeMax: 920
              });
              kit.spawnBurstParticles(cur.x, cur.y - 10, 26, 'star', {
                spdMin: 80, spdMax: 260, upBias: 120, gravity: 75,
                sizeMin: 3.5, sizeMax: 7.4,
                colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#FB923C'],
                lifeMin: 480, lifeMax: 840
              });
            }
            kit.safeCall(o.onShake, 10.2 + amp * 2.2, 320);
            kit.safeCall(o.onHitStop, 72 + amp * 14);
          }
        }
      ]);
    },

    /* ========================================================================
       第 2 幕 · 罗文（3 项：紫水晶 + 红宝石 + 纯银，零泥浆）
       ======================================================================== */

    /* 4. 紫银蚀弹 (enemy_rowan_eclipse_bolt) */
    enemy_rowan_eclipse_bolt: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var p0 = { x: from.x + facing * 18, y: from.y - 8 };
      var p2 = { x: tg.x, y: tg.y - 4 };
      var p1 = { x: (p0.x + p2.x) * 0.5, y: (p0.y + p2.y) * 0.5 - 24 };
      var travelMs = 220;

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 2, radius: 46 * ampScale, sy: 0.30,
              palette: 'eclipse', goldTriple: false, dur: 520
            });
            kit.spawnPfx('eclipse', {
              palette: BRIGHT_AMETHYST_TENDRIL, pearl: SILVER_ECLIPSE_PEARL
            }, {
              x: p0.x, y: p0.y - 6, scale: 0.88 * ampScale,
              timeScale: 1.6, durMs: 360, fadeInMs: 35, fadeOutMs: 120, layer: 'back',
              glowColor: 'rgba(196,181,253,0.52)', glowRadius: 50, glowAlpha: 0.48
            });
            kit.spawnBurstParticles(p0.x, p0.y, 14, 'ringlet', {
              spdMin: 26, spdMax: 95, upBias: 20, sizeMin: 3.4, sizeMax: 6.4,
              colors: ['#F5F3FF', '#DDD6FE', '#FDA4AF'], color2: '#7C3AED',
              lifeMin: 280, lifeMax: 480
            });
          }
        },
        {
          at: 155,
          fn: function () {
            var ribViolet = kit.addRibbon({
              pts: [p0], width: 11 * ampScale, palette: 'eclipse',
              alpha: 0.94, dur: 660, fadeOut: 260
            });
            var ribRuby = kit.addRibbon({
              pts: [p0], width: 7.0 * ampScale, palette: 'bloodRuby',
              alpha: 0.88, dur: 640, fadeOut: 240
            });

            // 紫银月刃旋转蚀弹（双向原生适配）
            kit.addCustomDrawable('front', {
              dur: travelMs + 70,
              draw: function (ctx, p) {
                var t = easeOutCubic(clamp((p * (travelMs + 70)) / travelMs, 0, 1));
                var pos = quadPt(p0, p1, p2, t);
                var tan = quadTan(p0, p1, p2, Math.min(0.99, t));
                var ang = Math.atan2(tan.dy, tan.dx);
                var fade = t < 0.98 ? 1 : clamp(1 - (p - 0.8) / 0.2, 0, 1);
                if (fade <= 0.02) return;

                var perpX = -Math.sin(ang);
                var perpY = Math.cos(ang);
                var sway = Math.sin(t * Math.PI * 3.0) * 12;
                ribViolet.pts.push({ x: pos.x + perpX * sway, y: pos.y + perpY * sway });
                ribRuby.pts.push({ x: pos.x - perpX * sway * 0.85, y: pos.y - perpY * sway * 0.85 });
                if (ribViolet.pts.length > 26) ribViolet.pts.shift();
                if (ribRuby.pts.length > 26) ribRuby.pts.shift();

                ctx.translate(pos.x, pos.y);
                ctx.globalAlpha = fade;

                var g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34 * ampScale);
                g.addColorStop(0, '#FFFFFF');
                g.addColorStop(0.35, 'rgba(221,214,254,0.88)');
                g.addColorStop(0.7, 'rgba(139,92,246,0.46)');
                g.addColorStop(1, 'rgba(124,58,237,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(0, 0, 34 * ampScale, 0, TAU);
                ctx.fill();

                ctx.save();
                ctx.rotate(p * 11.0 * facing);
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.ellipse(0, 0, 20 * ampScale, 10 * ampScale, 0.35, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = '#FB7185';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.ellipse(0, 0, 16 * ampScale, 16 * ampScale, 0, 0, Math.PI * 1.45);
                ctx.stroke();
                ctx.restore();

                ctx.save();
                ctx.rotate(ang);
                ctx.fillStyle = '#A78BFA';
                ctx.beginPath();
                ctx.moveTo(22 * ampScale, 0);
                ctx.quadraticCurveTo(4 * ampScale, -13 * ampScale, -16 * ampScale, -5 * ampScale);
                ctx.quadraticCurveTo(-4 * ampScale, 0, -16 * ampScale, 5 * ampScale);
                ctx.quadraticCurveTo(4 * ampScale, 13 * ampScale, 22 * ampScale, 0);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(19 * ampScale, 0);
                ctx.quadraticCurveTo(3 * ampScale, -6 * ampScale, -10 * ampScale, 0);
                ctx.quadraticCurveTo(3 * ampScale, 6 * ampScale, 19 * ampScale, 0);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#F43F5E';
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(0, -4.5);
                ctx.lineTo(-6, 0);
                ctx.lineTo(0, 4.5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }
            });
          }
        },
        {
          at: 375,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              kit.spawnPfx('eclipse', {
                palette: BRIGHT_AMETHYST_TENDRIL, pearl: SILVER_ECLIPSE_PEARL
              }, {
                x: cur.x, y: cur.y - 6,
                scale: 1.32 * ampScale, timeScale: 1.75, durMs: 680,
                fadeInMs: 18, fadeOutMs: 220, layer: 'main',
                glowColor: 'rgba(196,181,253,0.52)', glowRadius: 72 * ampScale, glowAlpha: 0.48
              });

              kit.spawnPfx('crit_hit', { palette: PAL.eclipse, height: 24, aim: 0.1 }, {
                x: cur.x, y: cur.y + 30, flipX: facing < 0,
                scale: 1.82 * ampScale, durMs: 520, layer: 'front'
              });

              // 紫水晶纯银月轮爆裂新月刃光
              (function (cx, cy) {
                kit.addCustomDrawable('front', {
                  dur: 500,
                  draw: function (ctx, p) {
                    var r = lerp(26, 86, easeOutCubic(p)) * ampScale;
                    var fade = p < 0.56 ? 1 : clamp((1 - p) / 0.44, 0, 1);
                    if (fade <= 0.02) return;
                    ctx.translate(cx, cy - 4);
                    ctx.globalAlpha = fade;

                    // 双倾紫晶银环
                    ctx.strokeStyle = '#A78BFA';
                    ctx.lineWidth = 3.6 * (1 - p * 0.45);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, r, r * 0.46, 0.44 * facing, 0, TAU);
                    ctx.stroke();

                    ctx.strokeStyle = '#FB7185';
                    ctx.lineWidth = 2.8 * (1 - p * 0.45);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, r * 0.92, r * 0.46, -0.44 * facing, 0, TAU);
                    ctx.stroke();

                    // 纯银新月刃弧
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2.6 * (1 - p * 0.45);
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.78, -1.2, 1.35);
                    ctx.stroke();
                  }
                });
              })(cur.x, cur.y);

              kit.addFlash(cur.x, cur.y - 4, 68 * ampScale, '#DDD6FE', 175, 0.46);
              kit.addStarFlare({
                x: cur.x, y: cur.y - 6, r0: 14, r1: 72 * ampScale, inner: 0.16, points: 8,
                outerColor: '#C4B5FD', coreColor: '#FFFFFF', dur: 400
              });
              kit.addStarFlare({
                x: cur.x, y: cur.y - 6, r0: 10, r1: 48 * ampScale, inner: 0.22, points: 4, rot: 0.4,
                outerColor: '#FB7185', coreColor: '#FFFFFF', dur: 360
              });
              kit.addShockRing({
                x: cur.x, y: cur.y - 4, r0: 14, r1: 102 * ampScale, sy: 0.88,
                color: '#A78BFA', coreColor: '#FFFFFF', lineW: 3.8, dur: 440, layer: 'front'
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 14, r1: 122 * ampScale, sy: 0.28,
                color: '#F43F5E', coreColor: '#F5F3FF', lineW: 3.6, dur: 460
              });
              kit.addLightning(cur.x - facing * 48, cur.y - 38, cur.x + facing * 42, cur.y + 30, {
                outerColor: '#7C3AED', midColor: '#DDD6FE', coreColor: '#FFFFFF',
                width: 2.5, dur: 300, branches: 2
              });
              kit.addLightning(cur.x + facing * 42, cur.y - 36, cur.x - facing * 44, cur.y + 28, {
                outerColor: '#E11D48', midColor: '#FDA4AF', coreColor: '#FFFFFF',
                width: 2.1, dur: 280, branches: 2
              });

              kit.spawnBurstParticles(cur.x, cur.y - 6, 30, 'ringlet', {
                spdMin: 65, spdMax: 225, upBias: 48, sizeMin: 4.2, sizeMax: 8.0,
                colors: ['#FFFFFF', '#F5F3FF', '#DDD6FE', '#FDA4AF'], color2: '#7C3AED',
                lifeMin: 460, lifeMax: 780
              });
              kit.spawnBurstParticles(cur.x, cur.y, 24, 'shard', {
                spdMin: 95, spdMax: 270, upBias: 90, sizeMin: 3.6, sizeMax: 7.2,
                colors: ['#FFFFFF', '#DDD6FE', '#FB7185', '#A78BFA'], color2: '#6D28D9',
                groundY: cur.groundY, bounce: 0.4, lifeMin: 420, lifeMax: 720
              });
            }
            kit.safeCall(o.onShake, 8.2 + amp * 2.0, 260);
            kit.safeCall(o.onHitStop, 56 + amp * 12);
          }
        }
      ]);
    },

    /* 5. 血晶印阵 (enemy_rowan_blood_sigil) */
    enemy_rowan_blood_sigil: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 2, radius: 44 * ampScale, sy: 0.30,
              palette: 'bloodRuby', dur: 520
            });
            for (var i = 0; i < targets.length; i++) {
              var tg = targets[i];
              kit.addIceVein({
                x0: from.x + facing * 8, y0: groundY + 2,
                x1: tg.x, y1: tg.groundY + 2,
                palette: 'bloodRuby', width: 3.4 * ampScale,
                growMs: 210 + i * 45, dur: 940
              });
            }
          }
        },
        {
          at: 165,
          fn: function () {
            // 纯银红宝石六芒血晶印阵
            kit.addCustomDrawable('back', {
              dur: 980,
              draw: function (ctx, p) {
                var enter = easeOutBack(clamp(p / 0.22, 0, 1));
                var fade = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
                if (fade <= 0.02) return;
                var r = 88 * enter * ampScale;
                var rot = p * 2.8 * facing;
                ctx.translate(center.x, center.groundY + 4);
                ctx.scale(1, 0.32);
                ctx.globalAlpha = fade;

                var bg = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.2);
                bg.addColorStop(0, 'rgba(255,228,230,0.72)');
                bg.addColorStop(0.55, 'rgba(244,63,94,0.36)');
                bg.addColorStop(1, 'rgba(190,18,60,0)');
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.2, 0, TAU);
                ctx.fill();

                ctx.rotate(rot);
                ctx.strokeStyle = '#F43F5E';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.88, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FDA4AF';
                ctx.lineWidth = 2.4;
                for (var k = 0; k < 2; k++) {
                  ctx.beginPath();
                  for (var v = 0; v < 3; v++) {
                    var a = (v / 3) * TAU + (k * Math.PI) / 3;
                    var px = Math.cos(a) * r * 0.86;
                    var py = Math.sin(a) * r * 0.86;
                    if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                  }
                  ctx.closePath();
                  ctx.stroke();
                }

                for (var d = 0; d < 6; d++) {
                  var da = (d / 6) * TAU;
                  var dx = Math.cos(da) * r * 0.94;
                  var dy = Math.sin(da) * r * 0.94;
                  ctx.fillStyle = d % 2 === 0 ? '#FFFFFF' : '#DDD6FE';
                  ctx.beginPath();
                  ctx.arc(dx, dy, 5.2, 0, TAU);
                  ctx.fill();
                }
              }
            });
          }
        },
        {
          at: 380,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              var isLast = idx === targets.length - 1;
              kit.safeCall(o.onImpact, idx, tg, isLast);

              kit.addHeroThorns({
                x: tg.x, y: tg.groundY + 4,
                palette: 'bloodRuby',
                scale: 0.96 * ampScale,
                dur: 820
              });

              kit.addShockRing({
                x: tg.x, y: tg.groundY + 4, r0: 12, r1: 86 * ampScale, sy: 0.30,
                color: '#F43F5E', coreColor: '#FFFFFF', lineW: 3.6, dur: 440
              });

              kit.spawnBurstParticles(tg.x, tg.y - 4, 18, 'shard', {
                spdMin: 80, spdMax: 245, upBias: 125, sizeMin: 3.5, sizeMax: 7.4,
                colors: ['#FFFFFF', '#FFE4E6', '#FDA4AF', '#F43F5E', '#DDD6FE'], color2: '#BE123C',
                groundY: tg.groundY, bounce: 0.38, lifeMin: 420, lifeMax: 760
              });
            }

            kit.spawnPfx('frost_nova', { palette: PAL.bloodRuby, reach: 88 }, {
              x: center.x, y: center.groundY + 4, scale: 1.65 * ampScale,
              preWarmSec: 0.38, timeScale: 1.52, durMs: 740, layer: 'back',
              glowColor: 'rgba(251,113,133,0.44)', glowRadius: 70 * ampScale, glowAlpha: 0.42
            });
            kit.spawnPfx('ice_shatter', { palette: PAL.bloodRuby }, {
              x: center.x, y: center.groundY - 2, scale: 1.72 * ampScale,
              preWarmSec: 0.56, timeScale: 1.68, durMs: 720, layer: 'main'
            });
            kit.addFlash(center.x, center.y - 8, 66 * ampScale, '#FB7185', 180, 0.42);
            kit.addStarFlare({
              x: center.x, y: center.y - 12, r0: 12, r1: 68 * ampScale, points: 8,
              outerColor: '#F43F5E', coreColor: '#FFFFFF', dur: 420
            });
            kit.spawnBurstParticles(center.x, center.y - 14, 24, 'ringlet', {
              spdMin: 55, spdMax: 195, upBias: 60, sizeMin: 4.0, sizeMax: 7.5,
              colors: ['#FFFFFF', '#F5F3FF', '#FDA4AF', '#C4B5FD'], color2: '#9F1239',
              lifeMin: 440, lifeMax: 780
            });
            kit.safeCall(o.onShake, 8.8 + amp * 2.0, 270);
            kit.safeCall(o.onHitStop, 58 + amp * 12);
          }
        }
      ]);
    },

    /* 6. 墓园灵潮 (enemy_rowan_grave_surge) */
    enemy_rowan_grave_surge: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            // 天穹晶透紫银新月光轮 + 垂直月华光柱（彻底明亮晶透）
            kit.addCustomDrawable('front', {
              dur: 1100,
              draw: function (ctx, p) {
                var enter = easeOutBack(clamp(p / 0.20, 0, 1));
                var fade = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
                if (fade <= 0.02) return;
                var mx = center.x;
                var my = 66;
                var r = 34 * enter * ampScale;
                ctx.globalAlpha = fade;

                // 垂直通透紫银月华光瀑
                var beamG = ctx.createLinearGradient(mx - 42, my, mx + 42, my);
                beamG.addColorStop(0, 'rgba(167,139,250,0)');
                beamG.addColorStop(0.35, 'rgba(196,181,253,0.22)');
                beamG.addColorStop(0.5, 'rgba(255,255,255,0.44)');
                beamG.addColorStop(0.65, 'rgba(196,181,253,0.22)');
                beamG.addColorStop(1, 'rgba(167,139,250,0)');
                ctx.fillStyle = beamG;
                ctx.fillRect(mx - 42, my, 84, center.groundY - my);

                // 明亮紫晶银辉月轮
                var halo = ctx.createRadialGradient(mx, my, 4, mx, my, r * 2.1);
                halo.addColorStop(0, '#FFFFFF');
                halo.addColorStop(0.38, 'rgba(221,214,254,0.88)');
                halo.addColorStop(0.72, 'rgba(139,92,246,0.42)');
                halo.addColorStop(1, 'rgba(124,58,237,0)');
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(mx, my, r * 2.1, 0, TAU);
                ctx.fill();

                ctx.strokeStyle = '#C4B5FD';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.arc(mx, my, r, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.arc(mx, my, r * 0.86, 0, TAU);
                ctx.stroke();

                // 晶莹红宝月牙冠
                ctx.strokeStyle = '#FB7185';
                ctx.lineWidth = 2.6;
                ctx.beginPath();
                ctx.arc(mx, my, r * 1.18, -0.9 + p * 2.4, 1.3 + p * 2.4);
                ctx.stroke();

                kit.drawStarFlare(ctx, mx + r * 0.72, my - r * 0.42, 16 * ampScale, 0.20, 4, p * 4, '#DDD6FE', '#FFFFFF', fade);
              }
            });

            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 4, radius: 50 * ampScale, sy: 0.30,
              palette: 'eclipse', dur: 620
            });
            kit.addIceVein({
              x0: from.x + facing * 14, y0: groundY + 2,
              x1: center.x, y1: center.groundY + 2,
              palette: 'eclipse', width: 4.0 * ampScale, growMs: 240, dur: 960
            });
          }
        },
        {
          at: 210,
          fn: function () {
            // 晶亮紫银与红宝灵潮波纹（自杖尖向前流向目标，不越位后方）
            kit.addCustomDrawable('main', {
              dur: 760,
              draw: function (ctx, p) {
                var surge = easeOutCubic(clamp(p / 0.36, 0, 1));
                var fade = p < 0.68 ? 1 : clamp((1 - p) / 0.32, 0, 1);
                if (fade <= 0.02) return;
                var startX = from.x + facing * 26;
                var endX = center.x + facing * 24;
                for (var band = 0; band < 3; band++) {
                  var cols = band === 1
                    ? ['#F43F5E', '#FDA4AF', '#FFFFFF']
                    : ['#7C3AED', '#C4B5FD', '#FFFFFF'];
                  var yOff = (band - 1) * 14;
                  var pts = [];
                  for (var s = 0; s <= 22; s++) {
                    var u = (s / 22) * surge;
                    var x = lerp(startX, endX, u);
                    var y = lerp(groundY - 14, center.groundY - 18, u) + yOff
                      - Math.sin(u * Math.PI * 2.5 - p * 10 + band * 1.4) * (15 + band * 4);
                    pts.push({ x: x, y: y });
                  }
                  if (pts.length < 2) continue;
                  ctx.lineCap = 'round';
                  ctx.strokeStyle = cols[0];
                  ctx.lineWidth = (13 - band * 1.8) * ampScale;
                  ctx.globalAlpha = fade * 0.42;
                  ctx.beginPath();
                  ctx.moveTo(pts[0].x, pts[0].y);
                  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                  ctx.stroke();

                  ctx.strokeStyle = cols[1];
                  ctx.lineWidth = (6.2 - band * 0.8) * ampScale;
                  ctx.globalAlpha = fade * 0.90;
                  ctx.beginPath();
                  ctx.moveTo(pts[0].x, pts[0].y);
                  for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
                  ctx.stroke();

                  ctx.strokeStyle = cols[2];
                  ctx.lineWidth = 2.0;
                  ctx.globalAlpha = fade;
                  ctx.beginPath();
                  ctx.moveTo(pts[0].x, pts[0].y);
                  for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
                  ctx.stroke();
                }
              }
            });

            kit.spawnPfx('shadow_tendrils', {
              palette: BRIGHT_AMETHYST_TENDRIL
            }, {
              x: center.x, y: center.groundY + 6,
              flipX: facing < 0,
              scale: 1.62 * ampScale,
              preWarmSec: 0.25, timeScale: 1.55, durMs: 920,
              fadeInMs: 25, fadeOutMs: 240, layer: 'main',
              glowColor: 'rgba(167,139,250,0.48)', glowRadius: 72 * ampScale, glowAlpha: 0.44
            });
          }
        },
        {
          at: 420,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
              kit.addShockRing({
                x: tg.x, y: tg.groundY + 4, r0: 14, r1: 94 * ampScale, sy: 0.28,
                color: '#A78BFA', coreColor: '#FFFFFF', lineW: 3.6, dur: 460
              });
            }

            kit.spawnPfx('shadow_tendrils', {
              palette: BRIGHT_RUBY_TENDRIL
            }, {
              x: center.x + facing * 14, y: center.groundY + 8,
              flipX: facing >= 0,
              scale: 1.40 * ampScale,
              preWarmSec: 0.28, timeScale: 1.65, durMs: 760,
              fadeInMs: 20, fadeOutMs: 220, layer: 'front'
            });

            kit.spawnPfx('wave_crash', { palette: PAL.eclipse }, {
              x: center.x + facing * 24, y: center.groundY + 6,
              flipX: facing < 0,
              scale: 1.82 * ampScale,
              preWarmSec: 0.50, timeScale: 1.52, durMs: 820, layer: 'back',
              glowColor: 'rgba(221,214,254,0.48)', glowRadius: 70 * ampScale, glowAlpha: 0.44
            });

            kit.addFlash(center.x, center.y - 10, 72 * ampScale, '#DDD6FE', 180, 0.44);
            kit.addStarFlare({
              x: center.x, y: center.y - 14, r0: 14, r1: 74 * ampScale, points: 8,
              outerColor: '#C4B5FD', coreColor: '#FFFFFF', dur: 440
            });
            kit.addLightning(center.x, 78, center.x, center.y - 6, {
              outerColor: '#7C3AED', midColor: '#F5F3FF', coreColor: '#FFFFFF',
              width: 2.6, dur: 300, branches: 3
            });

            kit.spawnBurstParticles(center.x, center.y - 12, 34, 'ringlet', {
              spdMin: 60, spdMax: 235, upBias: 95, sizeMin: 4.0, sizeMax: 8.0,
              colors: ['#FFFFFF', '#F5F3FF', '#DDD6FE', '#FDA4AF'], color2: '#7C3AED',
              lifeMin: 500, lifeMax: 860
            });
            kit.spawnBurstParticles(center.x, center.y - 8, 24, 'star', {
              spdMin: 70, spdMax: 240, upBias: 90, gravity: 55,
              sizeMin: 3.4, sizeMax: 7.0,
              colors: ['#FFFFFF', '#F5F3FF', '#FB7185', '#C4B5FD'],
              lifeMin: 460, lifeMax: 820
            });

            kit.safeCall(o.onShake, 9.6 + amp * 2.2, 300);
            kit.safeCall(o.onHitStop, 66 + amp * 12);
          }
        }
      ]);
    },

    /* ========================================================================
       第 3 幕 · 爱丽丝（2 项：清透翡翠微风 + 樱花瓣）
       ======================================================================== */

    /* 7. 翠风缎刃 (enemy_alice_gale_ribbon) */
    enemy_alice_gale_ribbon: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var p0 = { x: from.x + facing * 6, y: from.y + 6 };
      var p2 = { x: tg.x - facing * 16, y: tg.y + 4 };
      var p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 42 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 4, radius: 42 * ampScale, sy: 0.30,
              palette: 'wind', dur: 480
            });
            var ptsA = [], ptsB = [];
            for (var i = 0; i <= 24; i++) {
              var t = i / 24;
              var q = quadPt(p0, p1, p2, t);
              var w = Math.sin(t * Math.PI * 3.2) * 16;
              ptsA.push({ x: q.x, y: q.y - 10 + w });
              ptsB.push({ x: q.x, y: q.y + 10 - w });
            }
            kit.addRibbon({ pts: ptsA, width: 10 * ampScale, palette: 'wind', alpha: 0.92, dur: 640, fadeOut: 260 });
            kit.addRibbon({ pts: ptsB, width: 7.4 * ampScale, palette: 'slashWind', alpha: 0.86, dur: 660, fadeOut: 260 });

            kit.spawnBurstParticles(from.x, from.y, 18, 'leaf', {
              angleBase: dirAngle(facing, -0.25), spread: 1.1,
              spdMin: 95, spdMax: 230, upBias: 40, gravity: 18, drag: 0.95,
              sizeMin: 4.0, sizeMax: 7.4,
              colors: ['#CCFBF1', '#6EE7B7', '#34D399'], color2: '#059669',
              lifeMin: 420, lifeMax: 740
            });
          }
        },
        {
          at: 95,
          fn: function () {
            var pos = quadPt(p0, p1, p2, 0.32);
            kit.addAfterimage({
              x: pos.x, y: groundY - 4, scale: 1.0, facing: facing,
              spriteId: o.spriteId || 'alice', palette: 'wind',
              alpha: 0.78, dur: 560
            });
          }
        },
        {
          at: 195,
          fn: function () {
            var pos = quadPt(p0, p1, p2, 0.68);
            kit.addAfterimage({
              x: pos.x, y: groundY - 6, scale: 1.05, facing: facing,
              spriteId: o.spriteId || 'alice', palette: 'wind',
              alpha: 0.90, dur: 560
            });
          }
        },
        {
          at: 300,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              var dsScale = 1.92 * ampScale;
              kit.spawnPfx('double_slash', {
                palette: PAL.slashWind, sparks: PAL.windSpark
              }, {
                x: cur.x - facing * 34 * dsScale,
                y: cur.y + 23 * dsScale,
                flipX: facing < 0,
                scale: dsScale, durMs: 680, fadeInMs: 12, fadeOutMs: 180, layer: 'front'
              });

              addMirroredSlash(kit, facing, cur, {
                dx: -4, dy: 2, rx: 102 * ampScale, ry: 56 * ampScale,
                tilt: -0.42, startAngle: -2.50, endAngle: 0.80,
                thickness: 23 * ampScale, palette: 'slashWind', dur: 440
              });
              addMirroredSlash(kit, facing, cur, {
                dx: 4, dy: -4, rx: 92 * ampScale, ry: 52 * ampScale,
                tilt: 0.52, startAngle: 2.48, endAngle: -0.78,
                thickness: 20 * ampScale, palette: 'wind', dur: 440
              });

              // 环绕翠风缎带光环
              (function (cx, cy) {
                kit.addCustomDrawable('front', {
                  dur: 460,
                  draw: function (ctx, p) {
                    var r = (34 + 34 * easeOutCubic(p)) * ampScale;
                    var fade = p < 0.55 ? 1 : clamp((1 - p) / 0.45, 0, 1);
                    if (fade <= 0.02) return;
                    ctx.translate(cx, cy);
                    ctx.rotate((p * 3.6 - 0.5) * facing);
                    ctx.globalAlpha = fade;
                    ctx.strokeStyle = '#34D399';
                    ctx.lineWidth = 4.2 * (1 - p * 0.45);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, r, r * 0.42, 0.32 * facing, 0.2, Math.PI * 1.65);
                    ctx.stroke();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.8 * (1 - p * 0.45);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, r * 0.96, r * 0.39, 0.32 * facing, 0.35, Math.PI * 1.45);
                    ctx.stroke();
                  }
                });
              })(cur.x, cur.y);

              kit.addFlash(cur.x, cur.y, 56 * ampScale, '#34D399', 160, 0.38);
              kit.addStarFlare({
                x: cur.x, y: cur.y, r0: 10, r1: 54 * ampScale, points: 8,
                outerColor: '#6EE7B7', coreColor: '#FFFFFF', dur: 360
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 14, r1: 106 * ampScale, sy: 0.28,
                color: '#10B981', coreColor: '#CCFBF1', lineW: 3.8, dur: 440
              });

              kit.spawnBurstParticles(cur.x, cur.y - 8, 30, 'leaf', {
                spdMin: 70, spdMax: 245, upBias: 95, gravity: 20, drag: 1.0,
                sizeMin: 4.2, sizeMax: 8.0,
                colors: ['#CCFBF1', '#A7F3D0', '#6EE7B7', '#34D399'], color2: '#059669',
                lifeMin: 480, lifeMax: 840
              });
              kit.spawnBurstParticles(cur.x, cur.y - 4, 16, 'star', {
                spdMin: 60, spdMax: 200, upBias: 70, gravity: 25,
                sizeMin: 3.0, sizeMax: 6.2,
                colors: ['#FFFFFF', '#CCFBF1', '#6EE7B7'],
                lifeMin: 420, lifeMax: 720
              });
            }
            kit.safeCall(o.onShake, 7.0 + amp * 1.8, 220);
            kit.safeCall(o.onHitStop, 48 + amp * 10);
          }
        }
      ]);
    },

    /* 8. 花风旋舞 (enemy_alice_petal_cyclone) */
    enemy_alice_petal_cyclone: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 4, radius: 44 * ampScale, sy: 0.30,
              palette: 'wind', dur: 520
            });
            kit.addMagicCircle({
              x: center.x, y: center.groundY + 4, radius: 70 * ampScale, sy: 0.28,
              palette: 'wind', dur: 980, fadeIn: 110, fadeOut: 240
            });
          }
        },
        {
          at: 160,
          fn: function () {
            kit.spawnPfx('blizzard_vortex', { palette: PAL.wind, height: 88 }, {
              x: center.x, y: center.groundY + 6,
              scale: 1.96 * ampScale, timeScale: 1.38, durMs: 960,
              fadeInMs: 40, fadeOutMs: 240, layer: 'main',
              glowColor: 'rgba(110,231,183,0.44)', glowRadius: 72 * ampScale, glowAlpha: 0.40
            });

            // 晶透翠风螺旋风带 + 环绕花舞光环
            kit.addCustomDrawable('front', {
              dur: 880,
              draw: function (ctx, p) {
                var rise = easeOutCubic(clamp(p / 0.25, 0, 1));
                var fade = p < 0.70 ? 1 : clamp((1 - p) / 0.30, 0, 1);
                if (fade <= 0.02) return;
                ctx.globalAlpha = fade;
                for (var tier = 0; tier < 5; tier++) {
                  var ty = center.groundY - (14 + tier * 34) * rise * ampScale;
                  var rx = (34 + tier * 14) * (0.85 + 0.15 * Math.sin(p * 9 + tier)) * ampScale;
                  var ry = rx * 0.28;
                  var rotOff = (p * 10 + tier * 1.2) * facing;
                  ctx.strokeStyle = tier % 2 === 0 ? '#34D399' : '#6EE7B7';
                  ctx.lineWidth = (4.0 - tier * 0.35) * ampScale;
                  ctx.beginPath();
                  ctx.ellipse(center.x, ty, rx, ry, 0, rotOff, rotOff + Math.PI * 1.45);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.ellipse(center.x, ty, rx * 0.94, ry * 0.94, 0, rotOff + 0.2, rotOff + Math.PI * 1.1);
                  ctx.stroke();
                }
              }
            });
          }
        },
        {
          at: 355,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
              kit.addShockRing({
                x: tg.x, y: tg.groundY + 4, r0: 14, r1: 92 * ampScale, sy: 0.28,
                color: '#10B981', coreColor: '#CCFBF1', lineW: 3.4, dur: 440
              });
            }

            var swScale = 1.92 * ampScale;
            kit.spawnPfx('sword_slash', {
              palette: PAL.slashWind, sparks: PAL.windSpark, radius: 50
            }, {
              x: center.x - facing * 26 * swScale,
              y: center.y + 34 * swScale,
              flipX: facing < 0, scale: swScale, durMs: 600, layer: 'front'
            });

            kit.addFlash(center.x, center.y - 16, 66 * ampScale, '#6EE7B7', 175, 0.38);
            kit.addStarFlare({
              x: center.x, y: center.y - 16, r0: 12, r1: 66 * ampScale, points: 8,
              outerColor: '#34D399', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: center.x, y: center.groundY + 4, r0: 18, r1: 136 * ampScale, sy: 0.28,
              color: '#34D399', coreColor: '#FFFFFF', lineW: 4.2, dur: 520
            });

            // 漫天粉樱花瓣 + 翡翠风叶
            kit.spawnBurstParticles(center.x, center.y - 24, 34, 'petal', {
              spdMin: 60, spdMax: 240, upBias: 115, gravity: 24, drag: 1.0,
              sizeMin: 4.4, sizeMax: 8.6,
              colors: ['#FFE4E6', '#FECDD3', '#FDA4AF', '#FFFFFF'], color2: '#F43F5E',
              lifeMin: 520, lifeMax: 920
            });
            kit.spawnBurstParticles(center.x, center.y - 14, 28, 'leaf', {
              spdMin: 75, spdMax: 255, upBias: 105, gravity: 20, drag: 1.0,
              sizeMin: 4.2, sizeMax: 8.0,
              colors: ['#CCFBF1', '#A7F3D0', '#6EE7B7', '#34D399'], color2: '#059669',
              lifeMin: 520, lifeMax: 880
            });

            kit.safeCall(o.onShake, 8.2 + amp * 2.0, 260);
            kit.safeCall(o.onHitStop, 56 + amp * 12);
          }
        }
      ]);
    },

    /* ========================================================================
       第 4 幕 · 艾诺（3 项：无气泡镜面银冰）
       ======================================================================== */

    /* 9. 银冰长枪 (enemy_aino_frost_lance) */
    enemy_aino_frost_lance: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var p0 = { x: from.x + facing * 16, y: from.y - 6 };
      var p1 = { x: tg.x, y: tg.y - 4 };
      var dx = p1.x - p0.x, dy = p1.y - p0.y;
      var dir = dirTransform(dx, dy);
      var travelMs = 190;

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 2, radius: 44 * ampScale, sy: 0.30,
              palette: 'silverIce', dur: 460
            });
            // 无气泡镜面几何聚束环
            kit.addCustomDrawable('front', {
              dur: 210,
              draw: function (ctx, p) {
                var r = (28 - 10 * easeOutCubic(p)) * ampScale;
                ctx.translate(p0.x, p0.y);
                ctx.globalAlpha = 1 - p * 0.35;
                ctx.strokeStyle = '#60A5FA';
                ctx.lineWidth = 2.6;
                ctx.beginPath();
                ctx.ellipse(0, 0, r * 0.38, r, 0, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.ellipse(0, 0, r * 0.24, r * 0.72, 0, 0, TAU);
                ctx.stroke();
              }
            });
            kit.addStarFlare({
              x: p0.x, y: p0.y, r0: 6, r1: 34 * ampScale, points: 4,
              outerColor: '#93C5FD', coreColor: '#FFFFFF', dur: 220
            });
          }
        },
        {
          at: 145,
          fn: function () {
            var ribbon = kit.addRibbon({
              pts: [p0], width: 10.5 * ampScale, palette: 'silverIce',
              alpha: 0.96, dur: 440, fadeOut: 210
            });

            kit.spawnPfx('ice_lance', { palette: PAL.silverIce, length: 60 }, {
              x: p0.x, y: p0.y,
              flipX: dir.flipX, angle: dir.angle,
              scale: 1.72 * ampScale, timeScale: 1.45,
              durMs: travelMs + 60, fadeInMs: 16, fadeOutMs: 50, layer: 'front',
              glowColor: 'rgba(147,197,253,0.56)', glowRadius: 42, glowAlpha: 0.50,
              onUpdate: function (slot, dtSec, age) {
                var t = easeOutCubic(clamp(age / travelMs, 0, 1));
                slot.x = lerp(p0.x, p1.x, t);
                slot.y = lerp(p0.y, p1.y, t);
                if (t < 1) {
                  ribbon.pts.push({ x: slot.x, y: slot.y });
                  if (ribbon.pts.length > 18) ribbon.pts.shift();
                }
              }
            });

            // 三道音速激波锥（精准双向，保留至 peak 瞬间清晰可见）
            for (var c = 0; c < 3; c++) {
              (function (idx) {
                var u = 0.22 + idx * 0.28;
                var cx = lerp(p0.x, p1.x, u);
                var cy = lerp(p0.y, p1.y, u);
                var rad = (28 - idx * 3) * ampScale;
                kit.addCustomDrawable('front', {
                  dur: 420,
                  draw: function (ctx, p) {
                    var fade = 1 - easeInQuad(p);
                    var sc = 0.72 + 0.52 * easeOutCubic(p);
                    ctx.translate(cx, cy);
                    ctx.rotate(Math.atan2(dy, dx));
                    ctx.globalAlpha = fade * 0.94;
                    ctx.strokeStyle = '#60A5FA';
                    ctx.lineWidth = 3.4 * (1 - p * 0.45);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, rad * 0.28 * sc, rad * sc, 0, 0, TAU);
                    ctx.stroke();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.6 * (1 - p * 0.45);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, rad * 0.22 * sc, rad * 0.88 * sc, 0, 0, TAU);
                    ctx.stroke();
                  }
                });
              })(c);
            }
          }
        },
        {
          at: 335,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              // 贯通镜面银冰长枪冲刺残芒（直穿目标）
              (function (sx, sy, tx, ty) {
                kit.addCustomDrawable('front', {
                  dur: 340,
                  draw: function (ctx, p) {
                    var fade = p < 0.45 ? 1 : clamp((1 - p) / 0.55, 0, 1);
                    if (fade <= 0.02) return;
                    var ang = Math.atan2(ty - sy, tx - sx);
                    var overX = tx + Math.cos(ang) * 72 * ampScale;
                    var overY = ty + Math.sin(ang) * 72 * ampScale;
                    var tailX = tx - Math.cos(ang) * 145 * ampScale;
                    var tailY = ty - Math.sin(ang) * 145 * ampScale;
                    ctx.globalAlpha = fade;
                    ctx.lineCap = 'round';

                    ctx.strokeStyle = '#3B82F6';
                    ctx.lineWidth = 14 * (1 - p * 0.4) * ampScale;
                    ctx.beginPath();
                    ctx.moveTo(tailX, tailY);
                    ctx.lineTo(overX, overY);
                    ctx.stroke();

                    ctx.strokeStyle = '#93C5FD';
                    ctx.lineWidth = 7.5 * (1 - p * 0.4) * ampScale;
                    ctx.beginPath();
                    ctx.moveTo(tailX, tailY);
                    ctx.lineTo(overX, overY);
                    ctx.stroke();

                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 3.2 * (1 - p * 0.35) * ampScale;
                    ctx.beginPath();
                    ctx.moveTo(tailX, tailY);
                    ctx.lineTo(overX, overY);
                    ctx.stroke();
                  }
                });
              })(p0.x, p0.y, cur.x, cur.y - 4);

              kit.spawnPfx('ice_shatter', { palette: PAL.silverIce }, {
                x: cur.x, y: cur.groundY - 2,
                scale: 1.92 * ampScale, preWarmSec: 0.64, timeScale: 1.65,
                durMs: 740, fadeInMs: 12, fadeOutMs: 200, layer: 'main',
                glowColor: 'rgba(147,197,253,0.48)', glowRadius: 62 * ampScale, glowAlpha: 0.44
              });

              kit.spawnPfx('crit_hit', { palette: PAL.silverIce, height: 24, aim: 0.05 }, {
                x: cur.x, y: cur.y + 32, flipX: facing < 0,
                scale: 1.82 * ampScale, durMs: 520, layer: 'front'
              });

              kit.addFlash(cur.x, cur.y, 62 * ampScale, '#DBEAFE', 160, 0.45);
              kit.addStarFlare({
                x: cur.x, y: cur.y, r0: 12, r1: 68 * ampScale, inner: 0.16, points: 8,
                outerColor: '#60A5FA', coreColor: '#FFFFFF', dur: 360
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 14, r1: 118 * ampScale, sy: 0.28,
                color: '#2563EB', coreColor: '#FFFFFF', lineW: 4.0, dur: 460
              });
              kit.addShockRing({
                x: cur.x, y: cur.y, r0: 12, r1: 86 * ampScale, sy: 0.88,
                color: '#93C5FD', coreColor: '#FFFFFF', lineW: 3.2, dur: 360, layer: 'front'
              });

              kit.spawnBurstParticles(cur.x, cur.y, 32, 'shard', {
                angleBase: dirAngle(facing, 0), spread: 2.0,
                spdMin: 100, spdMax: 300, upBias: 95, sizeMin: 3.6, sizeMax: 8.0,
                colors: ['#FFFFFF', '#F8FAFC', '#DBEAFE', '#93C5FD', '#60A5FA'], color2: '#1D4ED8',
                groundY: cur.groundY, bounce: 0.44, lifeMin: 460, lifeMax: 780
              });
              kit.spawnBurstParticles(cur.x, cur.y - 12, 18, 'snow', {
                spdMin: 30, spdMax: 110, upBias: 60, gravity: 24,
                sizeMin: 3.2, sizeMax: 6.4,
                colors: ['#FFFFFF', '#DBEAFE'], color2: '#60A5FA',
                lifeMin: 460, lifeMax: 760
              });
            }
            kit.safeCall(o.onShake, 8.2 + amp * 2.0, 240);
            kit.safeCall(o.onHitStop, 58 + amp * 12);
          }
        }
      ]);
    },

    /* 10. 冰川横扫 (enemy_aino_glacier_sweep) */
    enemy_aino_glacier_sweep: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addIceVein({
              x0: from.x + facing * 8, y0: groundY + 2,
              x1: tg.x, y1: tg.groundY + 2,
              palette: 'silverIce', width: 3.8 * ampScale, growMs: 220, dur: 940
            });
            kit.addAfterimage({
              x: lerp(from.x, tg.x, 0.36), y: groundY - 2, scale: 1.02, facing: facing,
              spriteId: o.spriteId || 'aino', palette: 'silverIce', alpha: 0.84, dur: 540
            });
          }
        },
        {
          at: 185,
          fn: function () {
            kit.spawnPfx('ice_spikes', {
              palette: PAL.silverIce, reach: 132, height: 52
            }, {
              x: from.x + facing * 26, y: groundY + 4,
              flipX: facing < 0, scale: 1.56 * ampScale,
              timeScale: 1.65, durMs: 780, layer: 'back'
            });
            kit.addAfterimage({
              x: lerp(from.x, tg.x, 0.72), y: groundY - 2, scale: 1.06, facing: facing,
              spriteId: o.spriteId || 'aino', palette: 'silverIce', alpha: 0.92, dur: 520
            });
          }
        },
        {
          at: 330,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              var swScale = 2.02 * ampScale;
              kit.spawnPfx('sword_slash', {
                palette: PAL.silverIce, sparks: PAL.cyanSpark, radius: 52
              }, {
                x: cur.x - facing * 26 * swScale,
                y: cur.y + 36 * swScale,
                flipX: facing < 0, scale: swScale, durMs: 620, layer: 'front'
              });

              // 宽幅冰川横扫月牙刃
              addMirroredSlash(kit, facing, cur, {
                dx: -8, dy: 4, rx: 124 * ampScale, ry: 44 * ampScale,
                tilt: -0.14, startAngle: -2.65, endAngle: 0.78,
                thickness: 27 * ampScale, palette: 'silverIce', dur: 480
              });

              kit.addHeroThorns({
                x: cur.x, y: cur.groundY + 4,
                palette: 'silverIce', scale: 1.06 * ampScale, dur: 840
              });

              kit.addFlash(cur.x, cur.y, 58 * ampScale, '#93C5FD', 165, 0.40);
              kit.addStarFlare({
                x: cur.x, y: cur.y - 4, r0: 12, r1: 58 * ampScale, points: 8,
                outerColor: '#60A5FA', coreColor: '#FFFFFF', dur: 380
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 16, r1: 124 * ampScale, sy: 0.28,
                color: '#2563EB', coreColor: '#FFFFFF', lineW: 4.2, dur: 480
              });

              kit.spawnBurstParticles(cur.x, cur.y, 32, 'shard', {
                angleBase: dirAngle(facing, -0.25), spread: 1.9,
                spdMin: 95, spdMax: 300, upBias: 110, sizeMin: 3.6, sizeMax: 7.8,
                colors: ['#FFFFFF', '#F8FAFC', '#DBEAFE', '#93C5FD', '#38BDF8'], color2: '#1D4ED8',
                groundY: cur.groundY, bounce: 0.42, lifeMin: 460, lifeMax: 800
              });
            }
            kit.safeCall(o.onShake, 8.8 + amp * 2.0, 260);
            kit.safeCall(o.onHitStop, 60 + amp * 12);
          }
        }
      ]);
    },

    /* 11. 北境霰阵 (enemy_aino_north_hail) */
    enemy_aino_north_hail: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      var cues = [
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 4, radius: 46 * ampScale, sy: 0.30,
              palette: 'silverIce', dur: 560
            });
            kit.addMagicCircle({
              x: center.x - facing * 14, y: 48, radius: 92 * ampScale, sy: 0.26,
              palette: 'silverIce', goldTriple: amp >= 3, lineW: 2.5,
              dur: 980, fadeIn: 120, fadeOut: 240, layer: 'front'
            });
          }
        }
      ];

      var offsets = [-78, -32, 16, 62, -54, -4, 46];
      for (var i = 0; i < offsets.length; i++) {
        (function (idx) {
          var dropAt = 165 + idx * 52;
          var tx = clamp(center.x + offsets[idx], 46, 594);
          var ty = center.groundY + ((idx % 3) - 1) * 7;
          cues.push({
            at: dropAt,
            fn: function () {
              kit.addSkyBeam({
                x0: tx - facing * 84, y0: -16,
                x1: tx, y1: ty,
                width: (idx % 2 === 0 ? 7.6 : 5.8) * ampScale,
                palette: 'silverIce', dur: 480
              });
              if (idx % 2 === 0) {
                kit.spawnPfx('icicle_fall', { palette: PAL.silverIce }, {
                  x: tx, y: ty, scale: 1.50 * ampScale,
                  preWarmSec: 0.48, timeScale: 1.75, durMs: 640, layer: 'main'
                });
              }
            }
          });
        })(i);
      }

      cues.push({
        at: 490,
        fn: function () {
          for (var idx = 0; idx < targets.length; idx++) {
            var tg = targets[idx];
            kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
          }

          kit.spawnPfx('frost_nova', { palette: PAL.silverIce, reach: 102 }, {
            x: center.x, y: center.groundY + 4, scale: 1.84 * ampScale,
            preWarmSec: 0.40, timeScale: 1.48, durMs: 820, layer: 'back',
            glowColor: 'rgba(147,197,253,0.42)', glowRadius: 74 * ampScale, glowAlpha: 0.38
          });
          kit.spawnPfx('snowflake_burst', { palette: PAL.ice, count: 11 }, {
            x: center.x, y: center.groundY + 10, scale: 2.04 * ampScale,
            preWarmSec: 0.22, timeScale: 1.32, durMs: 840, layer: 'front'
          });

          kit.addFlash(center.x, center.y - 10, 68 * ampScale, '#DBEAFE', 180, 0.40);
          kit.addStarFlare({
            x: center.x, y: center.y - 14, r0: 14, r1: 72 * ampScale, inner: 0.18, points: 8,
            outerColor: '#60A5FA', coreColor: '#FFFFFF', dur: 440
          });
          kit.addShockRing({
            x: center.x, y: center.groundY + 4, r0: 18, r1: 140 * ampScale, sy: 0.28,
            color: '#2563EB', coreColor: '#FFFFFF', lineW: 4.2, dur: 520
          });
          kit.spawnBurstParticles(center.x, center.y - 26, 36, 'snow', {
            spdMin: 45, spdMax: 185, upBias: 80, gravity: 24,
            sizeMin: 3.8, sizeMax: 7.8,
            colors: ['#FFFFFF', '#F8FAFC', '#DBEAFE'], color2: '#60A5FA',
            lifeMin: 520, lifeMax: 840
          });
          kit.spawnBurstParticles(center.x, center.y - 8, 28, 'shard', {
            spdMin: 80, spdMax: 255, upBias: 95, sizeMin: 3.4, sizeMax: 7.0,
            colors: ['#FFFFFF', '#DBEAFE', '#93C5FD', '#38BDF8'], color2: '#1E3A8A',
            groundY: center.groundY, bounce: 0.40, lifeMin: 460, lifeMax: 780
          });

          kit.safeCall(o.onShake, 9.4 + amp * 2.2, 300);
          kit.safeCall(o.onHitStop, 64 + amp * 12);
        }
      });

      kit.scheduleTimeline(cues);
    },

    /* ========================================================================
       第 5 幕 · 诺艾尔（3 项：精算水系 + 几何星轨折光）
       ======================================================================== */

    /* 12. 星轨魔阵 (enemy_noelle_arcane_grid) */
    enemy_noelle_arcane_grid: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 2, radius: 44 * ampScale, sy: 0.30,
              palette: 'jilanViolet', dur: 520
            });
            kit.addStarFlare({
              x: from.x + facing * 14, y: from.y - 8, r0: 4, r1: 28 * ampScale, points: 4,
              outerColor: '#22D3EE', coreColor: '#FFFFFF', dur: 240
            });
          }
        },
        {
          at: 145,
          fn: function () {
            // 精算坐标星轨魔阵（透视方格 + 公转星轨 + 刻度准星）
            kit.addCustomDrawable('main', {
              dur: 940,
              draw: function (ctx, p) {
                var lock = easeOutCubic(clamp(p / 0.24, 0, 1));
                var fade = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
                if (fade <= 0.02) return;
                var w = 104 * lock * ampScale;
                var h = 36 * lock * ampScale;
                ctx.globalAlpha = fade;

                // 透视底盘坐标格
                ctx.save();
                ctx.translate(center.x, center.groundY + 2);
                ctx.strokeStyle = 'rgba(34,211,238,0.85)';
                ctx.lineWidth = 1.6;
                for (var gx = -3; gx <= 3; gx++) {
                  var xOff = (gx / 3) * w;
                  ctx.beginPath();
                  ctx.moveTo(xOff * 0.72, -h);
                  ctx.lineTo(xOff * 1.12, h);
                  ctx.stroke();
                }
                for (var gy = -2; gy <= 2; gy++) {
                  var yOff = (gy / 2) * h;
                  var halfW = lerp(w * 0.72, w * 1.12, (gy + 2) / 4);
                  ctx.beginPath();
                  ctx.moveTo(-halfW, yOff);
                  ctx.lineTo(halfW, yOff);
                  ctx.stroke();
                }
                ctx.restore();

                // 立面旋转星轨双环
                ctx.save();
                ctx.translate(center.x, center.y - 6);
                var rad = 74 * lock * ampScale;
                ctx.strokeStyle = '#6366F1';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.ellipse(0, 0, rad, rad * 0.42, 0.34 * facing, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#22D3EE';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, rad * 0.92, rad * 0.42, -0.34 * facing, 0, TAU);
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([8, 6]);
                ctx.lineDashOffset = -p * 120;
                ctx.beginPath();
                ctx.arc(0, 0, rad * 0.68, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);

                // 4 枚星轨运算节点
                for (var n = 0; n < 4; n++) {
                  var a = p * 5.2 * facing + (n / 4) * TAU;
                  var nx = Math.cos(a) * rad * 0.68;
                  var ny = Math.sin(a) * rad * 0.68;
                  ctx.fillStyle = n % 2 === 0 ? '#FDE68A' : '#FFFFFF';
                  ctx.beginPath();
                  ctx.moveTo(nx, ny - 5);
                  ctx.lineTo(nx + 4, ny);
                  ctx.lineTo(nx, ny + 5);
                  ctx.lineTo(nx - 4, ny);
                  ctx.closePath();
                  ctx.fill();
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 410,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
              kit.addShockRing({
                x: tg.x, y: tg.groundY + 2, r0: 12, r1: 88 * ampScale, sy: 0.30,
                color: '#22D3EE', coreColor: '#FFFFFF', lineW: 3.4, dur: 440
              });
            }

            // 精算十字水刃齐切
            addMirroredSlash(kit, facing, center, {
              dx: 0, dy: -2, rx: 102 * ampScale, ry: 48 * ampScale,
              tilt: -0.62, startAngle: -2.45, endAngle: 0.80,
              thickness: 21 * ampScale, palette: 'water', dur: 440
            });
            addMirroredSlash(kit, facing, center, {
              dx: 0, dy: -2, rx: 102 * ampScale, ry: 48 * ampScale,
              tilt: 0.62, startAngle: 2.45, endAngle: -0.80,
              thickness: 21 * ampScale, palette: 'jilanViolet', dur: 440
            });

            kit.spawnPfx('parry', { palette: PAL.water, height: 28 }, {
              x: center.x, y: center.y + 40, scale: 1.72 * ampScale, durMs: 520, layer: 'front'
            });
            kit.spawnPfx('hit_spark', { palette: PAL.jilanViolet, height: 24, aim: 0.08 }, {
              x: center.x, y: center.y + 30, flipX: facing < 0, scale: 1.72 * ampScale, durMs: 440, layer: 'front'
            });

            kit.addFlash(center.x, center.y - 4, 62 * ampScale, '#22D3EE', 165, 0.42);
            kit.addStarFlare({
              x: center.x, y: center.y - 6, r0: 12, r1: 64 * ampScale, inner: 0.16, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 400
            });
            kit.spawnBurstParticles(center.x, center.y - 4, 28, 'drop', {
              spdMin: 80, spdMax: 260, upBias: 95, gravity: 380,
              sizeMin: 3.4, sizeMax: 6.8,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE', '#A5B4FC'], color2: '#0284C7',
              groundY: center.groundY, bounce: 0.34, lifeMin: 420, lifeMax: 740
            });
            kit.spawnBurstParticles(center.x, center.y - 8, 22, 'star', {
              spdMin: 70, spdMax: 230, upBias: 70, gravity: 65,
              sizeMin: 3.2, sizeMax: 6.8,
              colors: ['#FFFFFF', '#FDE68A', '#67E8F9', '#A5B4FC'],
              lifeMin: 420, lifeMax: 740
            });

            kit.safeCall(o.onShake, 7.8 + amp * 1.8, 240);
            kit.safeCall(o.onHitStop, 52 + amp * 12);
          }
        }
      ]);
    },

    /* 13. 折光射线 (enemy_noelle_prism_ray) */
    enemy_noelle_prism_ray: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var beamStart = { x: from.x + facing * 14, y: from.y - 6 };
      var beamEnd = { x: tg.x, y: tg.y - 6 };
      var dx = beamEnd.x - beamStart.x, dy = beamEnd.y - beamStart.y;
      var dist = Math.hypot(dx, dy) || 1;
      var dir = dirTransform(dx, dy);
      var jetScale = 1.54 * ampScale;
      var extendMs = 145;

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 2, radius: 44 * ampScale, sy: 0.30,
              palette: 'water', dur: 520
            });
            // 双棱晶折光镜片（高亮晶透多面棱镜）
            kit.addCustomDrawable('front', {
              dur: 740,
              draw: function (ctx, p) {
                var enter = easeOutBack(clamp(p / 0.18, 0, 1));
                var fade = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
                if (fade <= 0.02) return;
                ctx.globalAlpha = fade;
                var fracs = [0.22, 0.56];
                for (var k = 0; k < fracs.length; k++) {
                  var mx = lerp(beamStart.x, beamEnd.x, fracs[k]);
                  var my = lerp(beamStart.y, beamEnd.y, fracs[k]);
                  var s = (19 - k * 2.5) * enter * ampScale;
                  ctx.save();
                  ctx.translate(mx, my);

                  // 外层棱镜折射辉光
                  var pg = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 1.9);
                  pg.addColorStop(0, '#FFFFFF');
                  pg.addColorStop(0.45, k === 0 ? 'rgba(103,232,249,0.58)' : 'rgba(165,180,252,0.58)');
                  pg.addColorStop(1, 'rgba(56,189,248,0)');
                  ctx.fillStyle = pg;
                  ctx.beginPath();
                  ctx.arc(0, 0, s * 1.9, 0, TAU);
                  ctx.fill();

                  // 多面棱晶本体
                  ctx.fillStyle = k === 0 ? 'rgba(207,250,254,0.68)' : 'rgba(224,231,255,0.68)';
                  ctx.beginPath();
                  ctx.moveTo(0, -s * 1.48);
                  ctx.lineTo(s * 0.78, 0);
                  ctx.lineTo(0, s * 1.48);
                  ctx.lineTo(-s * 0.78, 0);
                  ctx.closePath();
                  ctx.fill();

                  ctx.strokeStyle = k === 0 ? '#0EA5E9' : '#6366F1';
                  ctx.lineWidth = 2.6;
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.4;
                  ctx.beginPath();
                  ctx.moveTo(0, -s * 1.38);
                  ctx.lineTo(0, s * 1.38);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            });
          }
        },
        {
          at: 165,
          fn: function () {
            var pfxLen = Math.max(60, Math.min(205, Math.round(dist / jetScale)));
            kit.spawnPfx('water_jet', { palette: PAL.water, length: pfxLen }, {
              x: beamStart.x, y: beamStart.y - 4,
              flipX: dir.flipX, angle: dir.angle,
              scale: jetScale, timeScale: 1.4, durMs: 600,
              fadeInMs: 20, fadeOutMs: 170, layer: 'front', clipRight: 0.08,
              glowColor: 'rgba(34,211,238,0.42)', glowRadius: 40, glowAlpha: 0.40,
              onUpdate: function (slot, dtSec, age) {
                slot.clipRight = easeOutCubic(clamp(age / extendMs, 0.08, 1));
              }
            });

            kit.addWaterStream({
              x0: beamStart.x, y0: beamStart.y,
              x1: beamEnd.x, y1: beamEnd.y,
              width: 15 * ampScale, palette: 'water',
              extendMs: extendMs, dur: 600
            });

            // 折光棱镜伴生光谱射线
            kit.addCustomDrawable('front', {
              dur: 580,
              draw: function (ctx, p) {
                var grow = easeOutCubic(clamp((p * 580) / extendMs, 0, 1));
                var fade = p < 0.68 ? 1 : clamp((1 - p) / 0.32, 0, 1);
                if (fade <= 0.02) return;
                var ex = lerp(beamStart.x, beamEnd.x, grow);
                var ey = lerp(beamStart.y, beamEnd.y, grow);
                var ang = Math.atan2(dy, dx);
                var nx = -Math.sin(ang);
                var ny = Math.cos(ang);
                ctx.lineCap = 'round';
                ctx.globalAlpha = fade * 0.88;

                // 靛紫折光侧线
                ctx.strokeStyle = '#818CF8';
                ctx.lineWidth = 3.0 * ampScale;
                ctx.beginPath();
                ctx.moveTo(beamStart.x + nx * 11, beamStart.y + ny * 11);
                ctx.lineTo(ex + nx * 7, ey + ny * 7);
                ctx.stroke();

                // 淡金折光侧线
                ctx.strokeStyle = '#FDE68A';
                ctx.lineWidth = 2.6 * ampScale;
                ctx.beginPath();
                ctx.moveTo(beamStart.x - nx * 11, beamStart.y - ny * 11);
                ctx.lineTo(ex - nx * 7, ey - ny * 7);
                ctx.stroke();

                // 激光纯白核心
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 4.2 * ampScale;
                ctx.beginPath();
                ctx.moveTo(beamStart.x, beamStart.y);
                ctx.lineTo(ex, ey);
                ctx.stroke();
              }
            });
          }
        },
        {
          at: 165 + extendMs,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              kit.spawnPfx('wave_crash', { palette: PAL.water }, {
                x: cur.x + facing * 34, y: cur.groundY + 6,
                flipX: facing < 0, scale: 1.92 * ampScale,
                preWarmSec: 0.54, timeScale: 1.5, durMs: 820, layer: 'main',
                glowColor: 'rgba(14,165,233,0.44)', glowRadius: 68 * ampScale, glowAlpha: 0.42
              });
              kit.spawnPfx('splash', { palette: PAL.water, stone: false }, {
                x: cur.x, y: cur.groundY + 4, scale: 1.85 * ampScale,
                preWarmSec: 0.24, timeScale: 1.38, durMs: 760, layer: 'front'
              });

              kit.addFlash(cur.x, cur.y, 64 * ampScale, '#22D3EE', 175, 0.44);
              kit.addStarFlare({
                x: cur.x, y: cur.y - 4, r0: 12, r1: 58 * ampScale, points: 8,
                outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 360
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 16, r1: 124 * ampScale, sy: 0.28,
                color: '#0EA5E9', coreColor: '#CFFAFE', lineW: 4.2, dur: 480
              });
              kit.spawnBurstParticles(cur.x, cur.y, 40, 'drop', {
                spdMin: 90, spdMax: 310, upBias: 125, gravity: 430,
                sizeMin: 3.4, sizeMax: 7.0,
                colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE', '#A5B4FC'], color2: '#0284C7',
                groundY: cur.groundY, bounce: 0.32, lifeMin: 440, lifeMax: 780
              });
            }
            kit.safeCall(o.onShake, 8.6 + amp * 2.0, 280);
            kit.safeCall(o.onHitStop, 56 + amp * 12);
          }
        }
      ]);
    },

    /* 14. 推演星爆 (enemy_noelle_formula_nova) */
    enemy_noelle_formula_nova: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 4, radius: 46 * ampScale, sy: 0.30,
              palette: 'jilanViolet', goldTriple: amp >= 3, dur: 560
            });
            // 冰缝暗流贴地渗入足底
            for (var i = 0; i < targets.length; i++) {
              var tg = targets[i];
              kit.addIceVein({
                x0: from.x + facing * 10, y0: groundY + 2,
                x1: tg.x, y1: tg.groundY + 2,
                palette: 'water', width: 3.4 * ampScale, growMs: 220, dur: 1020
              });
            }
          }
        },
        {
          at: 185,
          fn: function () {
            kit.spawnPfx('time_stop', { palette: PAL.jilanViolet }, {
              x: center.x, y: center.groundY + 8,
              scale: 1.52 * ampScale, preWarmSec: 0.16, timeScale: 2.15,
              durMs: 840, fadeInMs: 24, fadeOutMs: 200, layer: 'back',
              glowColor: 'rgba(129,140,248,0.44)', glowRadius: 72 * ampScale, glowAlpha: 0.42
            });

            // 推演星盘刻度双环 + 聚能准星线
            kit.addCustomDrawable('front', {
              dur: 760,
              draw: function (ctx, p) {
                var lock = easeOutBack(clamp(p / 0.25, 0, 1));
                var fade = p < 0.68 ? 1 : clamp((1 - p) / 0.32, 0, 1);
                if (fade <= 0.02) return;
                var r = 68 * lock * ampScale;
                ctx.translate(center.x, center.y - 6);
                ctx.globalAlpha = fade;

                ctx.save();
                ctx.rotate(p * 4.0 * facing);
                ctx.strokeStyle = '#FDE68A';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TAU);
                ctx.stroke();

                for (var t = 0; t < 12; t++) {
                  var a = (t / 12) * TAU;
                  var rIn = t % 3 === 0 ? r * 0.78 : r * 0.88;
                  ctx.strokeStyle = t % 3 === 0 ? '#FFFFFF' : '#67E8F9';
                  ctx.lineWidth = t % 3 === 0 ? 2.2 : 1.3;
                  ctx.beginPath();
                  ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
                  ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                  ctx.stroke();
                }
                ctx.restore();
              }
            });
          }
        },
        {
          at: 455,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
            }

            kit.spawnPfx('frost_nova', { palette: PAL.water, reach: 102 }, {
              x: center.x, y: center.groundY + 4, scale: 1.84 * ampScale,
              preWarmSec: 0.38, timeScale: 1.48, durMs: 820, layer: 'back',
              glowColor: 'rgba(56,189,248,0.42)', glowRadius: 74 * ampScale, glowAlpha: 0.40
            });
            kit.spawnPfx('crit_hit', { palette: PAL.iceGold, height: 26, aim: 0.08 }, {
              x: center.x, y: center.y + 34, flipX: facing < 0,
              scale: 1.88 * ampScale, durMs: 560, layer: 'front'
            });

            kit.addFlash(center.x, center.y - 8, 76 * ampScale, '#67E8F9', 185, 0.45);
            kit.addStarFlare({
              x: center.x, y: center.y - 8, r0: 16, r1: 82 * ampScale, inner: 0.14, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 480
            });
            kit.addStarFlare({
              x: center.x, y: center.y - 8, r0: 12, r1: 64 * ampScale, inner: 0.20, points: 4, rot: Math.PI * 0.25,
              outerColor: '#818CF8', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: center.x, y: center.groundY + 4, r0: 18, r1: 146 * ampScale, sy: 0.28,
              color: '#6366F1', coreColor: '#FFFFFF', lineW: 4.4, dur: 540
            });
            kit.addShockRing({
              x: center.x, y: center.y - 6, r0: 14, r1: 104 * ampScale, sy: 0.88,
              color: '#22D3EE', coreColor: '#FEF9C3', lineW: 3.4, dur: 440, layer: 'front'
            });
            for (var b = 0; b < 3; b++) {
              var ba = (b / 3) * TAU + 0.3;
              kit.addLightning(
                center.x, center.y - 6,
                center.x + Math.cos(ba) * 66 * ampScale, center.y - 6 + Math.sin(ba) * 48 * ampScale,
                { outerColor: '#4F46E5', midColor: '#67E8F9', coreColor: '#FFFFFF', width: 2.3, dur: 280, branches: 2 }
              );
            }

            kit.spawnBurstParticles(center.x, center.y - 10, 34, 'star', {
              spdMin: 80, spdMax: 285, upBias: 80, gravity: 85,
              sizeMin: 3.8, sizeMax: 8.2,
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#67E8F9', '#A5B4FC'],
              lifeMin: 500, lifeMax: 860
            });
            kit.spawnBurstParticles(center.x, center.y - 4, 28, 'drop', {
              spdMin: 85, spdMax: 270, upBias: 110, gravity: 400,
              sizeMin: 3.2, sizeMax: 6.6,
              colors: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#22D3EE'], color2: '#0284C7',
              groundY: center.groundY, bounce: 0.34, lifeMin: 460, lifeMax: 800
            });

            kit.safeCall(o.onShake, 10.0 + amp * 2.2, 300);
            kit.safeCall(o.onHitStop, 68 + amp * 14);
          }
        }
      ]);
    },

    /* ========================================================================
       第 6 幕 · 雪狼 / 魔兽 / 冰原巨兽（4 项：晶亮白青霜锋 + 炽亮兽爪高光）
       ======================================================================== */

    /* 15. 霜爪撕裂 (enemy_wolf_frost_claw) */
    enemy_wolf_frost_claw: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addShockRing({
              x: from.x, y: groundY + 2, r0: 8, r1: 48 * ampScale, sy: 0.30,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.4, dur: 280
            });
            var leapPts = [];
            for (var i = 0; i <= 12; i++) {
              var t = i / 12;
              leapPts.push({
                x: lerp(from.x, tg.x - facing * 22, t),
                y: lerp(from.y + 6, tg.y + 2, t) - Math.sin(t * Math.PI) * 32
              });
            }
            kit.addRibbon({
              pts: leapPts, width: 10 * ampScale, palette: 'silverIce',
              alpha: 0.90, dur: 440, fadeOut: 220
            });
            kit.addAfterimage({
              x: lerp(from.x, tg.x, 0.52), y: groundY - 8, scale: 1.0, facing: facing,
              spriteId: o.spriteId || 'wolf_alpha', palette: 'ice', alpha: 0.78, dur: 460
            });
          }
        },
        {
          at: 195,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              var csScale = 1.94 * ampScale;
              kit.spawnPfx('claw_swipe', {
                palette: FROST_CLAW_PAL, sparks: PAL.clawBright
              }, {
                x: cur.x - facing * 28 * csScale,
                y: cur.y + 24 * csScale,
                flipX: facing < 0,
                scale: csScale, durMs: 660, fadeInMs: 10, fadeOutMs: 180, layer: 'front',
                glowColor: 'rgba(103,232,249,0.45)', glowRadius: 54 * ampScale, glowAlpha: 0.42
              });

              // 晶亮白青三连爪痕（精准镜像）
              (function (cx, cy) {
                kit.addCustomDrawable('front', {
                  dur: 460,
                  draw: function (ctx, p) {
                    var sweep = easeOutQuart(clamp(p / 0.28, 0, 1));
                    var fade = p < 0.60 ? 1 : clamp((1 - p) / 0.40, 0, 1);
                    if (fade <= 0.02) return;
                    ctx.translate(cx, cy);
                    ctx.globalAlpha = fade;
                    for (var c = 0; c < 3; c++) {
                      var off = (c - 1) * 18 * ampScale;
                      var x0 = -facing * 46 * ampScale + off * 0.35 * facing;
                      var y0 = -44 * ampScale + off * 0.62;
                      var x2 = facing * 48 * ampScale + off * 0.35 * facing;
                      var y2 = 42 * ampScale + off * 0.62;
                      var x1 = (x0 + x2) * 0.5 + facing * 14 * ampScale;
                      var y1 = (y0 + y2) * 0.5 - 10 * ampScale;

                      var ex = quadPt({ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x2, y: y2 }, sweep);
                      ctx.lineCap = 'round';
                      // 外层电光冰青
                      ctx.strokeStyle = '#0EA5E9';
                      ctx.lineWidth = (11.5 - Math.abs(c - 1) * 1.5) * ampScale * (1 - p * 0.35);
                      ctx.beginPath();
                      ctx.moveTo(x0, y0);
                      ctx.quadraticCurveTo(x1, y1, ex.x, ex.y);
                      ctx.stroke();

                      // 中层晶亮白青
                      ctx.strokeStyle = '#A5F3FC';
                      ctx.lineWidth = (6.2 - Math.abs(c - 1) * 0.8) * ampScale * (1 - p * 0.35);
                      ctx.beginPath();
                      ctx.moveTo(x0, y0);
                      ctx.quadraticCurveTo(x1, y1, ex.x, ex.y);
                      ctx.stroke();

                      // 纯白锋芯
                      ctx.strokeStyle = '#FFFFFF';
                      ctx.lineWidth = 2.4 * (1 - p * 0.35);
                      ctx.beginPath();
                      ctx.moveTo(x0, y0);
                      ctx.quadraticCurveTo(x1, y1, ex.x, ex.y);
                      ctx.stroke();
                    }
                  }
                });
              })(cur.x, cur.y);

              kit.spawnPfx('hit_spark', { palette: PAL.clawBright, height: 22, aim: 0.1 }, {
                x: cur.x, y: cur.y + 30, flipX: facing < 0,
                scale: 1.65 * ampScale, durMs: 420, layer: 'front'
              });

              kit.addFlash(cur.x, cur.y, 54 * ampScale, '#67E8F9', 155, 0.42);
              kit.addStarFlare({
                x: cur.x, y: cur.y, r0: 10, r1: 52 * ampScale, points: 6,
                outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 320
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 2, r0: 12, r1: 88 * ampScale, sy: 0.30,
                color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.6, dur: 400
              });

              kit.spawnBurstParticles(cur.x, cur.y, 26, 'shard', {
                angleBase: dirAngle(facing, -0.2), spread: 1.8,
                spdMin: 100, spdMax: 290, upBias: 95, sizeMin: 3.4, sizeMax: 7.2,
                colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8'], color2: '#0284C7',
                groundY: cur.groundY, bounce: 0.40, lifeMin: 420, lifeMax: 740
              });
              kit.spawnBurstParticles(cur.x, cur.y, 18, 'spark', {
                angleBase: dirAngle(facing, 0.15), spread: 1.6,
                spdMin: 145, spdMax: 330, sizeMin: 2.4, sizeMax: 4.4,
                colors: ['#FFFFFF', '#E0F7FF', '#FDE68A'],
                gravity: 160, lifeMin: 260, lifeMax: 480
              });
            }
            kit.safeCall(o.onShake, 7.6 + amp * 1.8, 220);
            kit.safeCall(o.onHitStop, 50 + amp * 10);
          }
        },
        {
          at: 300,
          fn: function () {
            addMirroredSlash(kit, facing, tg, {
              dx: 4, dy: -2, rx: 84 * ampScale, ry: 50 * ampScale,
              tilt: 0.56, startAngle: 2.45, endAngle: -0.76,
              thickness: 19 * ampScale, palette: 'slash', dur: 380
            });
          }
        }
      ]);
    },

    /* 16. 凛嚎冰环 (enemy_wolf_howl_chill) */
    enemy_wolf_howl_chill: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });
      var mouth = { x: from.x + facing * 12, y: from.y - 14 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x, y: groundY + 4, radius: 48 * ampScale, sy: 0.30,
              palette: 'ice', dur: 620
            });
            kit.addStarFlare({
              x: mouth.x, y: mouth.y, r0: 6, r1: 36 * ampScale, points: 6,
              outerColor: '#67E8F9', coreColor: '#FFFFFF', dur: 280
            });

            // 凛冽声波冰环横扫（连贯推进声波月弧，完全容纳于 640×360 画面零裁边）
            kit.addCustomDrawable('front', {
              dur: 840,
              draw: function (ctx, p) {
                var fade = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
                if (fade <= 0.02) return;
                for (var w = 0; w < 4; w++) {
                  var wp = clamp((p - w * 0.12) / 0.56, 0, 1);
                  if (wp <= 0 || wp >= 1) continue;
                  var wx = lerp(mouth.x, center.x, easeOutCubic(wp));
                  var wy = lerp(mouth.y + 8, center.y, easeOutCubic(wp));
                  var ry = (22 + 78 * easeOutCubic(wp)) * ampScale;
                  var rx = ry * 0.44;
                  var aWave = (1 - easeInQuad(wp) * 0.85) * fade;
                  ctx.save();
                  ctx.translate(wx, wy);
                  ctx.scale(facing, 1);
                  ctx.globalAlpha = aWave;

                  // 外层冰蓝柔辉声弧
                  ctx.strokeStyle = w % 2 === 0 ? '#0EA5E9' : '#38BDF8';
                  ctx.lineWidth = (9.0 - w * 0.9) * (1 - wp * 0.35);
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rx, ry, 0, -1.12, 1.12);
                  ctx.stroke();

                  // 中层晶亮白青声弧
                  ctx.strokeStyle = '#67E8F9';
                  ctx.lineWidth = (4.6 - w * 0.4) * (1 - wp * 0.35);
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rx, ry, 0, -1.06, 1.06);
                  ctx.stroke();

                  // 纯白声波亮脊
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 2.0 * (1 - wp * 0.35);
                  ctx.beginPath();
                  ctx.ellipse(2, 0, rx * 0.94, ry * 0.94, 0, -0.96, 0.96);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            });

            // 狼口至目标的凛冽寒风丝带
            var howlPts = [];
            for (var h = 0; h <= 16; h++) {
              var hu = h / 16;
              howlPts.push({
                x: lerp(mouth.x, center.x, hu),
                y: lerp(mouth.y + 8, center.y, hu) + Math.sin(hu * Math.PI * 3.0) * 14
              });
            }
            kit.addRibbon({
              pts: howlPts, width: 9.5 * ampScale, palette: 'ice',
              alpha: 0.84, dur: 640, fadeOut: 260
            });
          }
        },
        {
          at: 150,
          fn: function () {
            kit.spawnPfx('frost_nova', { palette: PAL.ice, reach: 84 }, {
              x: from.x, y: groundY + 4, scale: 1.48 * ampScale,
              preWarmSec: 0.36, timeScale: 1.52, durMs: 740, layer: 'back'
            });
            kit.addShockRing({
              x: from.x, y: groundY + 4, r0: 14, r1: 118 * ampScale, sy: 0.28,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.8, dur: 460
            });
          }
        },
        {
          at: 345,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
              kit.addShockRing({
                x: tg.x, y: tg.groundY + 4, r0: 12, r1: 96 * ampScale, sy: 0.28,
                color: '#67E8F9', coreColor: '#FFFFFF', lineW: 3.6, dur: 460
              });
            }

            kit.spawnPfx('frost_nova', { palette: PAL.silverIce, reach: 78 }, {
              x: center.x, y: center.groundY + 4, scale: 1.44 * ampScale,
              preWarmSec: 0.36, timeScale: 1.5, durMs: 760, layer: 'back'
            });
            kit.spawnPfx('snowflake_burst', { palette: PAL.silverIce, count: 10 }, {
              x: center.x, y: center.groundY + 10, scale: 1.92 * ampScale,
              preWarmSec: 0.20, timeScale: 1.35, durMs: 820, layer: 'front',
              glowColor: 'rgba(125,211,252,0.44)', glowRadius: 70 * ampScale, glowAlpha: 0.42
            });
            kit.addFlash(center.x, center.y - 8, 66 * ampScale, '#7DD3FC', 175, 0.42);
            kit.addStarFlare({
              x: center.x, y: center.y - 10, r0: 12, r1: 66 * ampScale, points: 8,
              outerColor: '#38BDF8', coreColor: '#FFFFFF', dur: 400
            });
            kit.spawnBurstParticles(center.x, center.y - 20, 34, 'snow', {
              spdMin: 40, spdMax: 180, upBias: 75, gravity: 24,
              sizeMin: 3.6, sizeMax: 7.4,
              colors: ['#FFFFFF', '#E0F7FF', '#BAE6FD'], color2: '#38BDF8',
              lifeMin: 500, lifeMax: 840
            });
            kit.spawnBurstParticles(center.x, center.y - 6, 22, 'shard', {
              spdMin: 70, spdMax: 225, upBias: 85, sizeMin: 3.2, sizeMax: 6.4,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9'], color2: '#0284C7',
              groundY: center.groundY, bounce: 0.38, lifeMin: 440, lifeMax: 760
            });

            kit.safeCall(o.onShake, 7.6 + amp * 1.8, 250);
            kit.safeCall(o.onHitStop, 48 + amp * 10);
          }
        }
      ]);
    },

    /* 17. 冰原猛扑 (enemy_beast_pounce_slam) */
    enemy_beast_pounce_slam: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var p0 = { x: from.x, y: from.y + 8 };
      var p2 = { x: tg.x, y: tg.y + 4 };
      var p1 = { x: (p0.x + p2.x) * 0.5, y: Math.min(p0.y, p2.y) - 96 };

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addShockRing({
              x: from.x, y: groundY + 4, r0: 10, r1: 58 * ampScale, sy: 0.30,
              color: '#38BDF8', coreColor: '#FFFFFF', lineW: 3.8, dur: 300
            });
            var arcA = [], arcB = [];
            for (var i = 0; i <= 18; i++) {
              var t = i / 18;
              var q = quadPt(p0, p1, p2, t);
              arcA.push({ x: q.x, y: q.y - 7 });
              arcB.push({ x: q.x, y: q.y + 7 });
            }
            kit.addRibbon({ pts: arcA, width: 11 * ampScale, palette: 'ice', alpha: 0.92, dur: 520, fadeOut: 240 });
            kit.addRibbon({ pts: arcB, width: 7.4 * ampScale, palette: 'clawBright', alpha: 0.84, dur: 520, fadeOut: 240 });
          }
        },
        {
          at: 95,
          fn: function () {
            var pos = quadPt(p0, p1, p2, 0.42);
            kit.addAfterimage({
              x: pos.x, y: pos.y + 44, scale: 1.0, facing: facing,
              spriteId: o.spriteId || 'tundra_brute', palette: 'silverIce', alpha: 0.76, dur: 480
            });
          }
        },
        {
          at: 185,
          fn: function () {
            var pos = quadPt(p0, p1, p2, 0.78);
            kit.addAfterimage({
              x: pos.x, y: pos.y + 42, scale: 1.06, facing: facing,
              spriteId: o.spriteId || 'tundra_brute', palette: 'ice', alpha: 0.88, dur: 460
            });
          }
        },
        {
          at: 280,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              kit.spawnPfx('frost_nova', { palette: PAL.ice, reach: 102 }, {
                x: cur.x, y: cur.groundY + 4, scale: 1.72 * ampScale,
                preWarmSec: 0.36, timeScale: 1.50, durMs: 820, layer: 'back',
                glowColor: 'rgba(56,189,248,0.48)', glowRadius: 76 * ampScale, glowAlpha: 0.44
              });

              kit.addHeroThorns({
                x: cur.x, y: cur.groundY + 4,
                palette: 'ice', goldAccent: true,
                scale: 0.86 * ampScale, dur: 760
              });

              var csScale = 1.98 * ampScale;
              kit.spawnPfx('claw_swipe', {
                palette: FROST_CLAW_PAL, sparks: PAL.clawBright
              }, {
                x: cur.x - facing * 28 * csScale,
                y: cur.y + 24 * csScale,
                flipX: facing < 0, scale: csScale, durMs: 640, layer: 'front'
              });

              addMirroredSlash(kit, facing, cur, {
                dx: -6, dy: 0, rx: 106 * ampScale, ry: 60 * ampScale,
                tilt: -0.46, startAngle: -2.55, endAngle: 0.82,
                thickness: 24 * ampScale, palette: 'iceGold', dur: 440
              });

              kit.addFlash(cur.x, cur.y + 6, 70 * ampScale, '#67E8F9', 175, 0.46);
              kit.addStarFlare({
                x: cur.x, y: cur.y + 4, r0: 14, r1: 72 * ampScale, points: 8,
                outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 400
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 18, r1: 146 * ampScale, sy: 0.28,
                color: '#0EA5E9', coreColor: '#FFFFFF', lineW: 4.6, dur: 520
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 12, r1: 112 * ampScale, sy: 0.28,
                color: '#FBBF24', coreColor: '#FFFBEB', lineW: 3.6, dur: 460
              });

              kit.spawnBurstParticles(cur.x, cur.groundY - 8, 36, 'shard', {
                spdMin: 95, spdMax: 310, upBias: 155, sizeMin: 3.8, sizeMax: 8.4,
                colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8', '#FDE68A'], color2: '#0284C7',
                groundY: cur.groundY, bounce: 0.44, lifeMin: 480, lifeMax: 840
              });
              kit.spawnBurstParticles(cur.x, cur.y, 22, 'spark', {
                spdMin: 140, spdMax: 340, upBias: 100, sizeMin: 2.6, sizeMax: 4.8,
                colors: ['#FFFFFF', '#FDE68A', '#67E8F9'],
                gravity: 210, lifeMin: 320, lifeMax: 580
              });
            }
            kit.safeCall(o.onShake, 9.6 + amp * 2.2, 290);
            kit.safeCall(o.onHitStop, 64 + amp * 12);
          }
        }
      ]);
    },

    /* 18. 巨冰震踏 (enemy_behemoth_glacier_stomp) */
    enemy_behemoth_glacier_stomp: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x, y: groundY + 4, radius: 66 * ampScale, sy: 0.30,
              palette: 'ice', goldTriple: true, dur: 640
            });
            kit.addCustomDrawable('front', {
              dur: 240,
              draw: function (ctx, p) {
                var r = lerp(74, 24, easeOutCubic(p)) * ampScale;
                ctx.translate(from.x, from.y + 12);
                ctx.globalAlpha = 0.88 * (1 - p * 0.25);
                ctx.strokeStyle = '#67E8F9';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, r, r * 0.34, 0, 0, TAU);
                ctx.stroke();
              }
            });
          }
        },
        {
          at: 210,
          fn: function () {
            kit.safeCall(o.onShake, 6.5, 160);
            // 巨兽足下纯晶冰震环（零暗石脏点）
            kit.spawnPfx('frost_nova', { palette: PAL.iceGold, reach: 88 }, {
              x: from.x + facing * 16, y: groundY + 4,
              scale: 1.54 * ampScale, preWarmSec: 0.38, timeScale: 1.55,
              durMs: 820, layer: 'back',
              glowColor: 'rgba(103,232,249,0.44)', glowRadius: 68 * ampScale, glowAlpha: 0.42
            });
            kit.addShockRing({
              x: from.x + facing * 16, y: groundY + 4, r0: 16, r1: 126 * ampScale, sy: 0.28,
              color: '#38BDF8', coreColor: '#FEF9C3', lineW: 4.4, dur: 520
            });
            for (var i = 0; i < targets.length; i++) {
              var tg = targets[i];
              kit.addIceVein({
                x0: from.x + facing * 20, y0: groundY + 2,
                x1: tg.x, y1: tg.groundY + 2,
                palette: 'ice', width: 4.4 * ampScale, growMs: 190 + i * 35, dur: 1040
              });
            }
          }
        },
        {
          at: 400,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);

              kit.addHeroThorns({
                x: tg.x, y: tg.groundY + 4,
                palette: 'silverIce', goldAccent: true,
                scale: 1.18 * ampScale, dur: 940
              });

              kit.addShockRing({
                x: tg.x, y: tg.groundY + 4, r0: 14, r1: 102 * ampScale, sy: 0.28,
                color: '#0EA5E9', coreColor: '#FFFFFF', lineW: 3.8, dur: 480
              });
            }

            kit.spawnPfx('frost_nova', { palette: PAL.ice, reach: 110 }, {
              x: center.x, y: center.groundY + 4, scale: 1.88 * ampScale,
              preWarmSec: 0.38, timeScale: 1.45, durMs: 880, layer: 'back',
              glowColor: 'rgba(56,189,248,0.46)', glowRadius: 80 * ampScale, glowAlpha: 0.44
            });
            kit.spawnPfx('ice_spikes', { palette: PAL.ice, reach: 82, height: 70 }, {
              x: center.x - facing * 42, y: center.groundY + 5,
              flipX: facing < 0, scale: 1.72 * ampScale,
              preWarmSec: 0.08, timeScale: 1.48, durMs: 880, layer: 'main'
            });

            kit.addFlash(center.x, center.y - 6, 78 * ampScale, '#67E8F9', 190, 0.46);
            kit.addStarFlare({
              x: center.x, y: center.y - 14, r0: 16, r1: 80 * ampScale, inner: 0.16, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 460
            });
            kit.addShockRing({
              x: center.x, y: center.groundY + 4, r0: 20, r1: 156 * ampScale, sy: 0.28,
              color: '#1658EB', coreColor: '#E0F7FF', lineW: 4.8, dur: 560
            });
            kit.addLightning(center.x - 52, center.y - 42, center.x + 52, center.y + 12, {
              outerColor: '#1658EB', midColor: '#67E8F9', coreColor: '#FFFFFF',
              width: 2.6, dur: 300, branches: 3
            });

            kit.spawnBurstParticles(center.x, center.groundY - 14, 40, 'shard', {
              spdMin: 95, spdMax: 320, upBias: 165, sizeMin: 4.0, sizeMax: 8.8,
              colors: ['#FFFFFF', '#E0F7FF', '#67E8F9', '#38BDF8', '#FDE68A'], color2: '#1658EB',
              groundY: center.groundY, bounce: 0.44, lifeMin: 520, lifeMax: 920
            });
            kit.spawnBurstParticles(center.x, center.y - 28, 28, 'snow', {
              spdMin: 45, spdMax: 185, upBias: 95, gravity: 24,
              sizeMin: 3.8, sizeMax: 7.8,
              colors: ['#FFFFFF', '#E0F7FF'], color2: '#38BDF8',
              lifeMin: 540, lifeMax: 920
            });

            kit.safeCall(o.onShake, 11.0 + amp * 2.4, 340);
            kit.safeCall(o.onHitStop, 74 + amp * 14);
          }
        }
      ]);
    },

    /* ========================================================================
       第 7–8 幕 · 宫廷炎师 / 重甲先锋 / 东翼护卫（4 项：红莲烈焰 + 皇家金钢）
       ======================================================================== */

    /* 19. 绯莲火雨 (enemy_flame_mage_cast) */
    enemy_flame_mage_cast: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      var cues = [
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 6, y: groundY + 4, radius: 46 * ampScale, sy: 0.30,
              palette: 'fire', dur: 560
            });
            kit.addMagicCircle({
              x: center.x - facing * 18, y: 46, radius: 94 * ampScale, sy: 0.26,
              palette: 'fire', goldTriple: true, lineW: 2.6,
              dur: 980, fadeIn: 110, fadeOut: 240, layer: 'front'
            });
          }
        }
      ];

      var rainOffsets = [-76, -34, 10, 56, -48, 26];
      for (var i = 0; i < rainOffsets.length; i++) {
        (function (idx) {
          var dropAt = 155 + idx * 52;
          var tx = clamp(center.x + rainOffsets[idx], 48, 592);
          var ty = center.groundY + ((idx % 3) - 1) * 7;
          cues.push({
            at: dropAt,
            fn: function () {
              kit.addSkyBeam({
                x0: tx - facing * 88, y0: -16,
                x1: tx, y1: ty,
                width: (idx % 2 === 0 ? 8.2 : 6.4) * ampScale,
                palette: 'fire', dur: 480
              });
              if (idx % 2 === 0) {
                var fdx = facing * 88;
                var fdy = ty + 16;
                var fDir = dirTransform(fdx, fdy);
                var sx0 = tx - facing * 88;
                var sy0 = -16;
                kit.spawnPfx('fireball', { palette: PAL.fire, radius: 6, speed: 150 }, {
                  x: sx0, y: sy0, flipX: fDir.flipX, angle: fDir.angle,
                  scale: 1.38 * ampScale, timeScale: 1.5, durMs: 245, layer: 'front',
                  onUpdate: function (slot, dtSec, age) {
                    var t = easeInQuad(clamp(age / 215, 0, 1));
                    slot.x = lerp(sx0, tx, t);
                    slot.y = lerp(sy0, ty - 8, t);
                  }
                });
              }
            }
          });
        })(i);
      }

      cues.push({
        at: 460,
        fn: function () {
          for (var idx = 0; idx < targets.length; idx++) {
            var tg = targets[idx];
            kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
          }

          kit.spawnPfx('fire_ring', { palette: PAL.fire, reach: 96 }, {
            x: center.x, y: center.groundY + 4, scale: 1.78 * ampScale,
            preWarmSec: 0.30, timeScale: 1.55, durMs: 800, layer: 'main',
            glowColor: 'rgba(251,146,60,0.46)', glowRadius: 74 * ampScale, glowAlpha: 0.44
          });
          kit.spawnPfx('flame_pillar', { palette: PAL.fire, stone: '#F59E0B', height: 126 }, {
            x: center.x, y: center.groundY + 4, scale: 1.38 * ampScale,
            preWarmSec: 0.56, timeScale: 1.65, durMs: 740, layer: 'back'
          });

          kit.addFlash(center.x, center.y - 10, 72 * ampScale, '#FB923C', 180, 0.44);
          kit.addStarFlare({
            x: center.x, y: center.y - 12, r0: 14, r1: 72 * ampScale, inner: 0.16, points: 8,
            outerColor: '#FCD34D', coreColor: '#FFFFFF', dur: 440
          });
          kit.addShockRing({
            x: center.x, y: center.groundY + 4, r0: 18, r1: 142 * ampScale, sy: 0.28,
            color: '#EA580C', coreColor: '#FEF08A', lineW: 4.4, dur: 520
          });
          kit.spawnBurstParticles(center.x, center.y - 18, 38, 'petal', {
            spdMin: 75, spdMax: 265, upBias: 130, sizeMin: 4.0, sizeMax: 8.4,
            colors: ['#FEF08A', '#FCD34D', '#FB923C', '#F43F5E', '#FFFFFF'], color2: '#DC2626',
            lifeMin: 500, lifeMax: 860
          });
          kit.spawnBurstParticles(center.x, center.y - 6, 24, 'spark', {
            spdMin: 135, spdMax: 330, upBias: 100, sizeMin: 2.6, sizeMax: 4.8,
            colors: ['#FFFFFF', '#FEF08A', '#F97316'],
            gravity: 195, lifeMin: 340, lifeMax: 640
          });

          kit.safeCall(o.onShake, 9.2 + amp * 2.0, 290);
          kit.safeCall(o.onHitStop, 62 + amp * 12);
        }
      });

      kit.scheduleTimeline(cues);
    },

    /* 20. 金钢戟斩 (enemy_vanguard_halberd) */
    enemy_vanguard_halberd: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addStarFlare({
              x: from.x + facing * 8, y: from.y - 44, r0: 8, r1: 48 * ampScale, inner: 0.14, points: 4,
              outerColor: '#FCD34D', coreColor: '#FFFFFF', dur: 240
            });
            kit.addShockRing({
              x: from.x, y: groundY + 4, r0: 10, r1: 54 * ampScale, sy: 0.30,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 3.6, dur: 280
            });
            var dashPts = [];
            for (var i = 0; i <= 12; i++) {
              var t = i / 12;
              dashPts.push({
                x: lerp(from.x, tg.x - facing * 24, t),
                y: lerp(from.y - 6, tg.y - 4, t) - Math.sin(t * Math.PI) * 24
              });
            }
            kit.addRibbon({
              pts: dashPts, width: 10.5 * ampScale, palette: 'gold',
              alpha: 0.92, dur: 460, fadeOut: 220
            });
          }
        },
        {
          at: 205,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              var hcScale = 1.90 * ampScale;
              kit.spawnPfx('heavy_cleave', {
                palette: PAL.gold, stone: '#FCD34D'
              }, {
                x: cur.x - facing * 34 * hcScale,
                y: cur.groundY + 4,
                flipX: facing < 0, scale: hcScale,
                preWarmSec: 0.20, timeScale: 1.38, durMs: 840,
                fadeInMs: 12, fadeOutMs: 220, layer: 'main',
                glowColor: 'rgba(252,211,77,0.46)', glowRadius: 68 * ampScale, glowAlpha: 0.44
              });

              // 高悬重戟金钢大弧月牙斩
              addMirroredSlash(kit, facing, cur, {
                dx: -10, dy: -4, rx: 116 * ampScale, ry: 80 * ampScale,
                tilt: -0.24, startAngle: -2.68, endAngle: 0.85,
                thickness: 28 * ampScale, palette: 'gold', dur: 480
              });

              kit.spawnPfx('parry', { palette: PAL.gold7, height: 28 }, {
                x: cur.x, y: cur.y + 40, scale: 1.72 * ampScale, durMs: 520, layer: 'front'
              });

              kit.addFlash(cur.x, cur.y, 62 * ampScale, '#FCD34D', 175, 0.44);
              kit.addStarFlare({
                x: cur.x, y: cur.y - 4, r0: 14, r1: 66 * ampScale, inner: 0.16, points: 8,
                outerColor: '#F59E0B', coreColor: '#FFFFFF', dur: 380
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 16, r1: 132 * ampScale, sy: 0.28,
                color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.5, dur: 500
              });
              kit.spawnBurstParticles(cur.x, cur.y, 32, 'spark', {
                angleBase: dirAngle(facing, -0.25), spread: 2.0,
                spdMin: 155, spdMax: 360, upBias: 90, sizeMin: 2.6, sizeMax: 5.0,
                colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#F59E0B'],
                gravity: 210, lifeMin: 320, lifeMax: 600
              });
              kit.spawnBurstParticles(cur.x, cur.groundY - 6, 20, 'shard', {
                spdMin: 80, spdMax: 250, upBias: 135, sizeMin: 3.4, sizeMax: 7.2,
                colors: ['#FFFFFF', '#FEF9C3', '#FCD34D', '#F59E0B'], color2: '#B45309',
                groundY: cur.groundY, bounce: 0.42, lifeMin: 440, lifeMax: 760
              });
            }
            kit.safeCall(o.onShake, 9.6 + amp * 2.2, 280);
            kit.safeCall(o.onHitStop, 66 + amp * 14);
          }
        }
      ]);
    },

    /* 21. 十字银斩 (enemy_eastwing_cross_slash) */
    enemy_eastwing_cross_slash: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            var dashPts = [];
            for (var i = 0; i <= 12; i++) {
              var t = i / 12;
              dashPts.push({
                x: lerp(from.x, tg.x - facing * 18, t),
                y: lerp(from.y, tg.y, t) - Math.sin(t * Math.PI) * 18
              });
            }
            kit.addRibbon({
              pts: dashPts, width: 10 * ampScale, palette: 'bloodRuby',
              alpha: 0.92, dur: 440, fadeOut: 220
            });
            kit.addAfterimage({
              x: lerp(from.x, tg.x, 0.38), y: groundY - 2, scale: 1.02, facing: facing,
              spriteId: o.spriteId || 'eastwing_commander', palette: 'silverIce', alpha: 0.78, dur: 480
            });
            kit.addAfterimage({
              x: lerp(from.x, tg.x, 0.72), y: groundY - 2, scale: 1.06, facing: facing,
              spriteId: o.spriteId || 'eastwing_commander', palette: 'gold7', alpha: 0.88, dur: 480
            });
          }
        },
        {
          at: 180,
          fn: function () {
            kit.safeCall(o.onShake, 5.6, 130);
            kit.safeCall(o.onHitStop, 34);
            var swScale = 1.98 * ampScale;
            kit.spawnPfx('sword_slash', {
              palette: PAL.silverIce, sparks: PAL.goldSpark, radius: 50
            }, {
              x: tg.x - facing * 26 * swScale,
              y: tg.y + 36 * swScale,
              flipX: facing < 0, scale: swScale, durMs: 560, layer: 'front'
            });
            addMirroredSlash(kit, facing, tg, {
              dx: -4, dy: 0, rx: 106 * ampScale, ry: 56 * ampScale,
              tilt: -0.66, startAngle: -2.55, endAngle: 0.80,
              thickness: 24 * ampScale, palette: 'silverIce', dur: 460
            });
          }
        },
        {
          at: 320,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              var dsScale = 2.02 * ampScale;
              kit.spawnPfx('double_slash', {
                palette: PAL.fire, sparks: PAL.goldSpark
              }, {
                x: cur.x - facing * 34 * dsScale,
                y: cur.y + 23 * dsScale,
                flipX: facing < 0, scale: dsScale, durMs: 700, layer: 'front'
              });

              addMirroredSlash(kit, facing, cur, {
                dx: 4, dy: -2, rx: 108 * ampScale, ry: 56 * ampScale,
                tilt: 0.66, startAngle: 2.55, endAngle: -0.80,
                thickness: 25 * ampScale, palette: 'gold7', dur: 480
              });

              // 巨型纯白绯金十字光斩印
              (function (cx, cy) {
                kit.addCustomDrawable('front', {
                  dur: 460,
                  draw: function (ctx, p) {
                    var ext = easeOutQuart(clamp(p / 0.24, 0, 1));
                    var fade = p < 0.56 ? 1 : clamp((1 - p) / 0.44, 0, 1);
                    if (fade <= 0.02) return;
                    var arm = 88 * ext * ampScale;
                    ctx.translate(cx, cy);
                    ctx.globalAlpha = fade;
                    var angs = [Math.PI * 0.25, -Math.PI * 0.25];
                    for (var k = 0; k < 2; k++) {
                      ctx.save();
                      ctx.rotate(angs[k]);
                      ctx.fillStyle = k === 0 ? '#F43F5E' : '#F59E0B';
                      ctx.beginPath();
                      ctx.moveTo(-arm, 0);
                      ctx.lineTo(0, -10 * (1 - p * 0.45));
                      ctx.lineTo(arm, 0);
                      ctx.lineTo(0, 10 * (1 - p * 0.45));
                      ctx.closePath();
                      ctx.fill();

                      ctx.fillStyle = '#FFFFFF';
                      ctx.beginPath();
                      ctx.moveTo(-arm * 0.88, 0);
                      ctx.lineTo(0, -4.4 * (1 - p * 0.45));
                      ctx.lineTo(arm * 0.88, 0);
                      ctx.lineTo(0, 4.4 * (1 - p * 0.45));
                      ctx.closePath();
                      ctx.fill();
                      ctx.restore();
                    }
                  }
                });
              })(cur.x, cur.y);

              kit.spawnPfx('crit_hit', { palette: PAL.gold, height: 24, aim: 0.06 }, {
                x: cur.x, y: cur.y + 32, flipX: facing < 0,
                scale: 1.82 * ampScale, durMs: 560, layer: 'front'
              });

              kit.addFlash(cur.x, cur.y, 64 * ampScale, '#FDE68A', 165, 0.42);
              kit.addStarFlare({
                x: cur.x, y: cur.y, r0: 14, r1: 74 * ampScale, inner: 0.14, points: 8,
                outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 400
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 14, r1: 118 * ampScale, sy: 0.28,
                color: '#F43F5E', coreColor: '#FFFFFF', lineW: 4.0, dur: 460
              });
              kit.spawnBurstParticles(cur.x, cur.y, 32, 'spark', {
                spdMin: 160, spdMax: 370, sizeMin: 2.6, sizeMax: 5.0,
                colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#FB7185'],
                gravity: 135, lifeMin: 300, lifeMax: 580
              });
              kit.spawnBurstParticles(cur.x, cur.y, 20, 'petal', {
                spdMin: 80, spdMax: 240, upBias: 95, sizeMin: 3.8, sizeMax: 7.4,
                colors: ['#FEF08A', '#FCD34D', '#FB7185'], color2: '#BE123C',
                lifeMin: 440, lifeMax: 760
              });
            }
            kit.safeCall(o.onShake, 9.8 + amp * 2.2, 280);
            kit.safeCall(o.onHitStop, 68 + amp * 14);
          }
        }
      ]);
    },

    /* 22. 辉盾冲锋 (enemy_eastwing_phalanx_rush) */
    enemy_eastwing_phalanx_rush: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var rushMs = 220;

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addPrismShield({
              x: from.x + facing * 18, y: from.y + 2,
              radius: 44 * ampScale, palette: 'gold', ampTier: 1,
              lockAt: 90, dur: 320
            });
            kit.spawnPfx('divine_shield', { palette: PAL.gold, radius: 28 }, {
              x: from.x + facing * 18, y: from.y + 38, scale: 1.48 * ampScale,
              alpha: 0.78, durMs: 320, layer: 'main'
            });
          }
        },
        {
          at: 135,
          fn: function () {
            // 辉金盾阵突击箭锋（双向镜像，多面棱盾车头破风撞击并保留至 peak 撞击高潮）
            kit.addCustomDrawable('front', {
              dur: rushMs + 280,
              draw: function (ctx, p) {
                var totalDur = rushMs + 280;
                var t = easeOutQuart(clamp((p * totalDur) / rushMs, 0, 1));
                var fade = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
                if (fade <= 0.02) return;
                var cx = lerp(from.x + facing * 22, tg.x - facing * 8, t);
                var cy = lerp(from.y + 4, tg.y + 4, t);
                var r = 64 * ampScale * (0.94 + 0.14 * t);

                ctx.translate(cx, cy);
                ctx.scale(facing, 1);
                ctx.globalAlpha = fade;

                // 多层辉金冲锋破风尖弧
                for (var k = 0; k < 3; k++) {
                  var ox = -k * 18;
                  var sc = 1 - k * 0.14;
                  ctx.strokeStyle = k === 0 ? '#FFFFFF' : (k === 1 ? '#FDE68A' : '#F97316');
                  ctx.lineWidth = (5.8 - k * 1.2) * ampScale;
                  ctx.beginPath();
                  ctx.moveTo(ox - 20 * sc, -r * 0.94 * sc);
                  ctx.quadraticCurveTo(ox + 42 * sc, 0, ox - 20 * sc, r * 0.94 * sc);
                  ctx.stroke();
                }

                // 半透明辉金棱镜盾面
                var sg = ctx.createLinearGradient(-18, 0, 38, 0);
                sg.addColorStop(0, 'rgba(249,115,22,0.18)');
                sg.addColorStop(0.55, 'rgba(252,211,77,0.58)');
                sg.addColorStop(1, 'rgba(255,255,255,0.92)');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.moveTo(-16, -r * 0.86);
                ctx.lineTo(30, -r * 0.36);
                ctx.lineTo(40, 0);
                ctx.lineTo(30, r * 0.36);
                ctx.lineTo(-16, r * 0.86);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 2.4;
                ctx.stroke();
              }
            });

            var ribPtsA = [], ribPtsB = [];
            for (var i = 0; i <= 14; i++) {
              var u = i / 14;
              var rx = lerp(from.x + facing * 12, tg.x, u);
              var ry = lerp(from.y, tg.y, u);
              ribPtsA.push({ x: rx, y: ry - 26 });
              ribPtsB.push({ x: rx, y: ry + 26 });
            }
            kit.addRibbon({ pts: ribPtsA, width: 9.5 * ampScale, palette: 'gold', alpha: 0.92, dur: 560, fadeOut: 240 });
            kit.addRibbon({ pts: ribPtsB, width: 9.5 * ampScale, palette: 'fire', alpha: 0.88, dur: 560, fadeOut: 240 });

            kit.addAfterimage({
              x: lerp(from.x, tg.x, 0.45), y: groundY - 2, scale: 1.04, facing: facing,
              spriteId: o.spriteId || 'eastwing_commander', palette: 'gold', alpha: 0.84, dur: 520
            });
          }
        },
        {
          at: 355,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              kit.spawnPfx('fire_ring', { palette: PAL.gold, reach: 96 }, {
                x: cur.x, y: cur.groundY + 4, scale: 1.66 * ampScale,
                preWarmSec: 0.30, timeScale: 1.60, durMs: 780, layer: 'main',
                glowColor: 'rgba(252,211,77,0.52)', glowRadius: 76 * ampScale, glowAlpha: 0.46
              });

              kit.spawnPfx('parry', { palette: PAL.gold7, height: 28 }, {
                x: cur.x, y: cur.y + 40, scale: 1.94 * ampScale, durMs: 560, layer: 'front'
              });

              kit.addFlash(cur.x, cur.y, 70 * ampScale, '#FCD34D', 175, 0.46);
              kit.addStarFlare({
                x: cur.x, y: cur.y - 4, r0: 14, r1: 74 * ampScale, inner: 0.16, points: 8,
                outerColor: '#F59E0B', coreColor: '#FFFFFF', dur: 400
              });
              kit.addShockRing({
                x: cur.x, y: cur.y, r0: 14, r1: 108 * ampScale, sy: 0.92,
                color: '#F59E0B', coreColor: '#FFFFFF', lineW: 4.2, dur: 440, layer: 'front'
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 16, r1: 140 * ampScale, sy: 0.28,
                color: '#F97316', coreColor: '#FEF9C3', lineW: 4.2, dur: 500
              });

              kit.spawnBurstParticles(cur.x, cur.y, 34, 'spark', {
                angleBase: dirAngle(facing, -0.15), spread: 1.9,
                spdMin: 150, spdMax: 370, upBias: 95, sizeMin: 2.6, sizeMax: 5.0,
                colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#FB923C'],
                gravity: 195, lifeMin: 340, lifeMax: 640
              });
              kit.spawnBurstParticles(cur.x, cur.y - 8, 22, 'petal', {
                spdMin: 80, spdMax: 250, upBias: 115, sizeMin: 4.0, sizeMax: 7.8,
                colors: ['#FEF08A', '#FCD34D', '#FB923C', '#F43F5E'], color2: '#B91C1C',
                lifeMin: 460, lifeMax: 800
              });
            }
            kit.safeCall(o.onShake, 10.0 + amp * 2.2, 290);
            kit.safeCall(o.onHitStop, 66 + amp * 12);
          }
        }
      ]);
    },

    /* ========================================================================
       第 9 幕 · 竞技场风神之眼（4 项：通透翡翠天青 + 香槟金神辉）
       ======================================================================== */

    /* 23. 青空裂风 (enemy_windgod_tempest_arc) */
    enemy_windgod_tempest_arc: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, to = o.to, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, false);
      var tg = targets[0];
      var flyMs = 195;

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 4, radius: 50 * ampScale, sy: 0.30,
              palette: 'wind', goldTriple: true, dur: 520
            });
            kit.addStarFlare({
              x: from.x + facing * 14, y: from.y - 8, r0: 6, r1: 42 * ampScale, points: 6,
              outerColor: '#2DD4BF', coreColor: '#FFFFFF', dur: 240
            });
          }
        },
        {
          at: 125,
          fn: function () {
            // 疾驰青空裂风巨型新月气浪（双向镜像）
            kit.addCustomDrawable('front', {
              dur: flyMs + 130,
              draw: function (ctx, p) {
                var t = easeOutCubic(clamp((p * (flyMs + 130)) / flyMs, 0, 1));
                var fade = t < 0.96 ? 1 : clamp((1 - p) / 0.36, 0, 1);
                if (fade <= 0.02) return;
                var cx = lerp(from.x + facing * 20, tg.x, t);
                var cy = lerp(from.y - 4, tg.y - 4, t);
                var h = 76 * ampScale;

                ctx.translate(cx, cy);
                ctx.scale(facing, 1);
                ctx.globalAlpha = fade;

                // 外层翡翠气浪
                ctx.fillStyle = '#059669';
                ctx.beginPath();
                ctx.moveTo(-22, -h);
                ctx.quadraticCurveTo(44, 0, -22, h);
                ctx.quadraticCurveTo(14, 0, -22, -h);
                ctx.closePath();
                ctx.fill();

                // 中层亮青月牙刃
                ctx.fillStyle = '#2DD4BF';
                ctx.beginPath();
                ctx.moveTo(-14, -h * 0.90);
                ctx.quadraticCurveTo(38, 0, -14, h * 0.90);
                ctx.quadraticCurveTo(16, 0, -14, -h * 0.90);
                ctx.closePath();
                ctx.fill();

                // 纯白金辉锋脊
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 4.2;
                ctx.beginPath();
                ctx.moveTo(-8, -h * 0.82);
                ctx.quadraticCurveTo(34, 0, -8, h * 0.82);
                ctx.stroke();

                ctx.strokeStyle = '#FDE68A';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(-16, -h * 0.72);
                ctx.quadraticCurveTo(22, 0, -16, h * 0.72);
                ctx.stroke();
              }
            });

            var ribA = [], ribB = [];
            for (var i = 0; i <= 16; i++) {
              var u = i / 16;
              var rx = lerp(from.x + facing * 14, tg.x, u);
              var ry = lerp(from.y, tg.y, u);
              ribA.push({ x: rx, y: ry - 24 + Math.sin(u * Math.PI * 3) * 10 });
              ribB.push({ x: rx, y: ry + 24 - Math.sin(u * Math.PI * 3) * 10 });
            }
            kit.addRibbon({ pts: ribA, width: 9.5 * ampScale, palette: 'wind', alpha: 0.92, dur: 520, fadeOut: 240 });
            kit.addRibbon({ pts: ribB, width: 7.2 * ampScale, palette: 'gold7', alpha: 0.84, dur: 520, fadeOut: 240 });
          }
        },
        {
          at: 320,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var cur = targets[idx];
              kit.safeCall(o.onImpact, idx, cur, idx === targets.length - 1);

              var swScale = 2.12 * ampScale;
              kit.spawnPfx('sword_slash', {
                palette: PAL.slashWind, sparks: PAL.goldSpark, radius: 54
              }, {
                x: cur.x - facing * 26 * swScale,
                y: cur.y + 38 * swScale,
                flipX: facing < 0, scale: swScale, durMs: 640, layer: 'front'
              });

              var dsScale = 1.94 * ampScale;
              kit.spawnPfx('double_slash', {
                palette: PAL.slashWind, sparks: PAL.windSpark
              }, {
                x: cur.x - facing * 34 * dsScale,
                y: cur.y + 23 * dsScale,
                flipX: facing < 0, scale: dsScale, durMs: 680, layer: 'front'
              });

              addMirroredSlash(kit, facing, cur, {
                dx: -6, dy: 0, rx: 118 * ampScale, ry: 66 * ampScale,
                tilt: -0.46, startAngle: -2.58, endAngle: 0.84,
                thickness: 26 * ampScale, palette: 'slashWind', dur: 480
              });
              addMirroredSlash(kit, facing, cur, {
                dx: 6, dy: -4, rx: 102 * ampScale, ry: 56 * ampScale,
                tilt: 0.56, startAngle: 2.52, endAngle: -0.82,
                thickness: 21 * ampScale, palette: 'gold7', dur: 460
              });

              kit.addFlash(cur.x, cur.y, 64 * ampScale, '#2DD4BF', 170, 0.42);
              kit.addStarFlare({
                x: cur.x, y: cur.y, r0: 14, r1: 72 * ampScale, inner: 0.15, points: 8,
                outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 400
              });
              kit.addShockRing({
                x: cur.x, y: cur.groundY + 4, r0: 16, r1: 128 * ampScale, sy: 0.28,
                color: '#10B981', coreColor: '#CCFBF1', lineW: 4.2, dur: 480
              });
              kit.addLightning(cur.x - facing * 46, cur.y - 38, cur.x + facing * 42, cur.y + 32, {
                outerColor: '#059669', midColor: '#FDE68A', coreColor: '#FFFFFF',
                width: 2.4, dur: 280, branches: 2
              });

              kit.spawnBurstParticles(cur.x, cur.y - 8, 34, 'leaf', {
                angleBase: dirAngle(facing, -0.2), spread: 2.1,
                spdMin: 85, spdMax: 285, upBias: 95, gravity: 20, drag: 1.0,
                sizeMin: 4.4, sizeMax: 8.4,
                colors: ['#CCFBF1', '#6EE7B7', '#2DD4BF', '#FDE68A'], color2: '#047857',
                lifeMin: 480, lifeMax: 860
              });
              kit.spawnBurstParticles(cur.x, cur.y, 24, 'spark', {
                spdMin: 155, spdMax: 350, sizeMin: 2.5, sizeMax: 4.6,
                colors: ['#FFFFFF', '#CCFBF1', '#FDE68A'],
                gravity: 115, lifeMin: 300, lifeMax: 580
              });
            }
            kit.safeCall(o.onShake, 9.4 + amp * 2.2, 280);
            kit.safeCall(o.onHitStop, 64 + amp * 12);
          }
        }
      ]);
    },

    /* 24. 翡翠飓眼 (enemy_windgod_emerald_vortex) */
    enemy_windgod_emerald_vortex: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 4, radius: 50 * ampScale, sy: 0.30,
              palette: 'wind', goldTriple: true, dur: 580
            });
            kit.addMagicCircle({
              x: center.x, y: center.groundY + 4, radius: 80 * ampScale, sy: 0.28,
              rimColor: '#10B981', starColor: '#FDE68A', runeColor: '#FFFFFF',
              innerGlow: 'rgba(204,251,241,0.68)', outerGlow: 'rgba(16,185,129,0.34)',
              goldTriple: true, dur: 1140, fadeIn: 120, fadeOut: 260
            });
          }
        },
        {
          at: 165,
          fn: function () {
            kit.spawnPfx('blizzard_vortex', { palette: PAL.wind, height: 98 }, {
              x: center.x, y: center.groundY + 6,
              scale: 2.12 * ampScale, timeScale: 1.38, durMs: 1080,
              fadeInMs: 36, fadeOutMs: 260, layer: 'main',
              glowColor: 'rgba(45,212,191,0.46)', glowRadius: 82 * ampScale, glowAlpha: 0.44
            });

            // 擎天翡翠天青飓柱 + 金辉风暴眼冠环
            kit.addCustomDrawable('front', {
              dur: 1040,
              draw: function (ctx, p) {
                var rise = easeOutCubic(clamp(p / 0.24, 0, 1));
                var fade = p < 0.72 ? 1 : clamp((1 - p) / 0.28, 0, 1);
                if (fade <= 0.02) return;
                ctx.globalAlpha = fade;

                // 螺旋上升翡翠飓带
                for (var tier = 0; tier < 6; tier++) {
                  var ty = center.groundY - (12 + tier * 36) * rise * ampScale;
                  var rx = (38 + tier * 15) * (0.88 + 0.12 * Math.sin(p * 11 + tier)) * ampScale;
                  var ry = rx * 0.26;
                  var rotOff = (p * 11.5 + tier * 1.15) * facing;
                  ctx.strokeStyle = tier % 3 === 2 ? '#FDE68A' : (tier % 2 === 0 ? '#10B981' : '#2DD4BF');
                  ctx.lineWidth = (4.6 - tier * 0.35) * ampScale;
                  ctx.beginPath();
                  ctx.ellipse(center.x, ty, rx, ry, 0, rotOff, rotOff + Math.PI * 1.52);
                  ctx.stroke();

                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.ellipse(center.x, ty, rx * 0.94, ry * 0.94, 0, rotOff + 0.18, rotOff + Math.PI * 1.15);
                  ctx.stroke();
                }

                // 顶冠金辉飓眼
                var topY = center.groundY - 216 * rise * ampScale;
                ctx.strokeStyle = '#FCD34D';
                ctx.lineWidth = 2.8;
                ctx.beginPath();
                ctx.ellipse(center.x, topY, 96 * rise * ampScale, 22 * rise * ampScale, 0, 0, TAU);
                ctx.stroke();
              }
            });
          }
        },
        {
          at: 395,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
            }

            kit.spawnPfx('frost_nova', { palette: PAL.wind, reach: 108 }, {
              x: center.x, y: center.groundY + 4, scale: 1.90 * ampScale,
              preWarmSec: 0.40, timeScale: 1.45, durMs: 880, layer: 'back',
              glowColor: 'rgba(52,211,153,0.44)', glowRadius: 80 * ampScale, glowAlpha: 0.42
            });
            kit.spawnPfx('crit_hit', { palette: PAL.gold7, height: 28, aim: 0.08 }, {
              x: center.x, y: center.y + 34, flipX: facing < 0,
              scale: 1.92 * ampScale, durMs: 560, layer: 'front'
            });

            kit.addFlash(center.x, center.y - 16, 78 * ampScale, '#2DD4BF', 185, 0.42);
            kit.addStarFlare({
              x: center.x, y: center.y - 18, r0: 14, r1: 80 * ampScale, inner: 0.15, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 460
            });
            kit.addShockRing({
              x: center.x, y: center.groundY + 4, r0: 18, r1: 154 * ampScale, sy: 0.28,
              color: '#10B981', coreColor: '#FEF9C3', lineW: 4.6, dur: 560
            });
            kit.addShockRing({
              x: center.x, y: center.groundY + 4, r0: 12, r1: 122 * ampScale, sy: 0.28,
              color: '#F59E0B', coreColor: '#FFFFFF', lineW: 3.4, dur: 500
            });

            for (var b = 0; b < 3; b++) {
              var bx = center.x + (b - 1) * 58;
              kit.addLightning(bx, center.groundY - 180, bx + (b - 1) * 18, center.groundY - 6, {
                outerColor: '#059669', midColor: '#FDE68A', coreColor: '#FFFFFF',
                width: 2.3, dur: 300, branches: 2
              });
            }

            kit.spawnBurstParticles(center.x, center.y - 24, 42, 'leaf', {
              spdMin: 70, spdMax: 270, upBias: 130, gravity: 18, drag: 0.95,
              sizeMin: 4.5, sizeMax: 8.8,
              colors: ['#CCFBF1', '#A7F3D0', '#6EE7B7', '#2DD4BF', '#FDE68A'], color2: '#047857',
              lifeMin: 560, lifeMax: 960
            });
            kit.spawnBurstParticles(center.x, center.y - 14, 28, 'star', {
              spdMin: 75, spdMax: 260, upBias: 110, gravity: 55,
              sizeMin: 3.6, sizeMax: 7.6,
              colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#6EE7B7'],
              lifeMin: 500, lifeMax: 880
            });

            kit.safeCall(o.onShake, 10.6 + amp * 2.4, 320);
            kit.safeCall(o.onHitStop, 70 + amp * 14);
          }
        }
      ]);
    },

    /* 25. 天穹风裁 (enemy_windgod_sky_judgment) */
    enemy_windgod_sky_judgment: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var groundY = o.groundY;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });

      var cues = [
        {
          at: 0,
          fn: function () {
            kit.addMagicCircle({
              x: from.x - facing * 8, y: groundY + 4, radius: 52 * ampScale, sy: 0.30,
              palette: 'wind', goldTriple: true, dur: 620
            });
            // 天穹翡翠金圣风轮
            kit.addMagicCircle({
              x: center.x, y: 42, radius: 108 * ampScale, sy: 0.26,
              rimColor: '#10B981', starColor: '#FDE68A', runeColor: '#FFFFFF',
              innerGlow: 'rgba(204,251,241,0.72)', outerGlow: 'rgba(16,185,129,0.34)',
              goldTriple: true, lineW: 2.8, dur: 1180, fadeIn: 120, fadeOut: 260, layer: 'front'
            });
          }
        }
      ];

      var rayOffsets = [-82, -46, -12, 24, 58, 86];
      for (var i = 0; i < rayOffsets.length; i++) {
        (function (idx) {
          var tx = clamp(center.x + rayOffsets[idx], 46, 594);
          var ty = center.groundY + ((idx % 3) - 1) * 7;
          var isGold = idx % 2 === 1;
          cues.push({
            at: 150 + idx * 44,
            fn: function () {
              kit.addSkyBeam({
                x0: tx - facing * 74, y0: -16,
                x1: tx, y1: ty,
                width: (isGold ? 7.6 : 6.4) * ampScale,
                palette: isGold ? 'gold7' : 'wind',
                gold: isGold, dur: 500
              });
            }
          });
        })(i);
      }

      cues.push({
        at: 420,
        fn: function () {
          for (var idx = 0; idx < targets.length; idx++) {
            var tg = targets[idx];
            kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
          }

          // 擎天青金天穹风裁光柱
          kit.addCustomDrawable('main', {
            dur: 760,
            draw: function (ctx, p) {
              var expand = easeOutQuart(clamp(p / 0.18, 0, 1));
              var fade = p < 0.60 ? 1 : clamp((1 - p) / 0.40, 0, 1);
              if (fade <= 0.02) return;
              var colW = (58 + 10 * Math.sin(p * 18)) * expand * ampScale;
              var topY = 26;
              var botY = center.groundY + 6;
              ctx.globalAlpha = fade;

              var bg = ctx.createLinearGradient(center.x - colW, 0, center.x + colW, 0);
              bg.addColorStop(0, 'rgba(16,185,129,0)');
              bg.addColorStop(0.22, 'rgba(45,212,191,0.52)');
              bg.addColorStop(0.42, 'rgba(253,230,138,0.82)');
              bg.addColorStop(0.50, 'rgba(255,255,255,0.96)');
              bg.addColorStop(0.58, 'rgba(253,230,138,0.82)');
              bg.addColorStop(0.78, 'rgba(45,212,191,0.52)');
              bg.addColorStop(1, 'rgba(16,185,129,0)');
              ctx.fillStyle = bg;
              ctx.fillRect(center.x - colW, topY, colW * 2, botY - topY);

              // 3 道逆向缠绕青金光环
              for (var r = 0; r < 3; r++) {
                var ry = lerp(topY + 40, botY - 28, (r + 0.5) / 3);
                var rad = (colW * 1.18 + r * 8);
                ctx.strokeStyle = r === 1 ? '#FDE68A' : '#6EE7B7';
                ctx.lineWidth = 3.0;
                ctx.beginPath();
                ctx.ellipse(center.x, ry, rad, rad * 0.24, 0, p * 8 + r * 2, p * 8 + r * 2 + Math.PI * 1.45);
                ctx.stroke();
              }
            }
          });

          kit.spawnPfx('flame_pillar', {
            palette: EMERALD_BRIGHT_PILLAR, stone: '#6EE7B7', height: 158
          }, {
            x: center.x, y: center.groundY + 6, scale: 1.62 * ampScale,
            preWarmSec: 0.55, timeScale: 1.55, durMs: 880,
            fadeInMs: 16, fadeOutMs: 240, layer: 'main',
            glowColor: 'rgba(110,231,183,0.48)', glowRadius: 84 * ampScale, glowAlpha: 0.45
          });

          kit.spawnPfx('blizzard_vortex', { palette: PAL.gold7, height: 86 }, {
            x: center.x, y: center.groundY + 6, scale: 1.54 * ampScale,
            timeScale: 1.42, durMs: 840, layer: 'front'
          });

          for (var b = 0; b < 4; b++) {
            var ox = (b - 1.5) * 44;
            kit.addLightning(center.x + ox * 0.4, 34, center.x + ox, center.groundY, {
              outerColor: b % 2 === 0 ? '#059669' : '#D97706',
              midColor: b % 2 === 0 ? '#6EE7B7' : '#FDE68A',
              coreColor: '#FFFFFF', width: 2.5, dur: 320, branches: 2
            });
          }

          kit.addFlash(center.x, center.y - 14, 86 * ampScale, '#6EE7B7', 200, 0.45);
          kit.addStarFlare({
            x: center.x, y: center.y - 16, r0: 16, r1: 88 * ampScale, inner: 0.14, points: 8,
            outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 500
          });
          kit.addStarFlare({
            x: center.x, y: center.y - 16, r0: 12, r1: 68 * ampScale, inner: 0.20, points: 6, rot: 0.28,
            outerColor: '#2DD4BF', coreColor: '#FFFFFF', dur: 460
          });
          kit.addShockRing({
            x: center.x, y: center.groundY + 4, r0: 20, r1: 164 * ampScale, sy: 0.28,
            color: '#F59E0B', coreColor: '#FEF9C3', lineW: 4.8, dur: 580
          });
          kit.addShockRing({
            x: center.x, y: center.groundY + 4, r0: 14, r1: 134 * ampScale, sy: 0.28,
            color: '#10B981', coreColor: '#FFFFFF', lineW: 3.8, dur: 520
          });

          kit.spawnBurstParticles(center.x, center.y - 24, 42, 'leaf', {
            spdMin: 80, spdMax: 290, upBias: 145, gravity: 18, drag: 0.95,
            sizeMin: 4.4, sizeMax: 8.6,
            colors: ['#CCFBF1', '#6EE7B7', '#2DD4BF', '#FDE68A'], color2: '#047857',
            lifeMin: 560, lifeMax: 980
          });
          kit.spawnBurstParticles(center.x, center.y - 12, 34, 'star', {
            spdMin: 80, spdMax: 300, upBias: 120, gravity: 75,
            sizeMin: 3.8, sizeMax: 8.4,
            colors: ['#FFFFFF', '#FEF9C3', '#FDE68A', '#6EE7B7', '#2DD4BF'],
            lifeMin: 540, lifeMax: 960
          });

          kit.safeCall(o.onShake, 11.4 + amp * 2.4, 340);
          kit.safeCall(o.onHitStop, 76 + amp * 15);
        }
      });

      kit.scheduleTimeline(cues);
    },

    /* 26. 神瞳震波 (enemy_windgod_eye_pulse) */
    enemy_windgod_eye_pulse: function (kit, o) {
      var PAL = kit.PALETTES;
      var from = o.from, facing = o.facing;
      var amp = o.amp, ampScale = o.ampScale;
      var targets = resolveTargets(o, true);
      var center = calcCenter(targets, { x: o.to.x, y: o.to.y, groundY: o.targetGroundY });
      var eyeX = lerp(from.x, center.x, 0.44);
      var eyeY = Math.min(from.y, center.y) - 34;

      kit.scheduleTimeline([
        {
          at: 0,
          fn: function () {
            // 晶莹翡翠金瞳神徽（在虚空睁开 + 神瞳虹膜光轮 + 羽翼神纹）
            kit.addCustomDrawable('front', {
              dur: 1080,
              draw: function (ctx, p) {
                var open = easeOutBack(clamp(p / 0.24, 0, 1));
                var fade = p < 0.74 ? 1 : clamp((1 - p) / 0.26, 0, 1);
                if (fade <= 0.02) return;
                var rx = 56 * ampScale;
                var ry = 28 * open * ampScale;
                var pulse = p >= 0.30 && p <= 0.56 ? Math.sin(((p - 0.30) / 0.26) * Math.PI) : 0;

                ctx.translate(eyeX, eyeY);
                ctx.globalAlpha = fade;

                // 外圈翡翠符文轻环
                ctx.save();
                ctx.rotate(p * 2.2 * facing);
                ctx.strokeStyle = 'rgba(45,212,191,0.55)';
                ctx.lineWidth = 1.6;
                ctx.setLineDash([10, 7]);
                ctx.beginPath();
                ctx.arc(0, 0, rx * 1.12, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                // 神瞳外层翡翠金辉光晕
                var halo = ctx.createRadialGradient(0, 0, 4, 0, 0, rx * 1.45);
                halo.addColorStop(0, 'rgba(254,249,195,0.68)');
                halo.addColorStop(0.45, 'rgba(45,212,191,0.42)');
                halo.addColorStop(1, 'rgba(16,185,129,0)');
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(0, 0, rx * 1.45, 0, TAU);
                ctx.fill();

                // 眼睑杏仁轮廓（纯白 + 香槟金双边）
                ctx.beginPath();
                ctx.moveTo(-rx, 0);
                ctx.quadraticCurveTo(0, -ry * 1.65, rx, 0);
                ctx.quadraticCurveTo(0, ry * 1.65, -rx, 0);
                ctx.closePath();

                var eyeFill = ctx.createRadialGradient(0, 0, 2, 0, 0, rx);
                eyeFill.addColorStop(0, '#FFFFFF');
                eyeFill.addColorStop(0.55, '#CCFBF1');
                eyeFill.addColorStop(1, '#34D399');
                ctx.fillStyle = eyeFill;
                ctx.fill();

                ctx.strokeStyle = '#F59E0B';
                ctx.lineWidth = 3.2 + pulse * 1.6;
                ctx.stroke();

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // 剪裁眼内旋转翡翠多面虹膜 + 菱形金瞳
                ctx.save();
                ctx.clip();
                var irisR = 21 * ampScale * (0.85 + 0.15 * open);
                var ig = ctx.createRadialGradient(0, 0, 2, 0, 0, irisR);
                ig.addColorStop(0, '#FEF9C3');
                ig.addColorStop(0.45, '#2DD4BF');
                ig.addColorStop(0.85, '#059669');
                ig.addColorStop(1, '#047857');
                ctx.fillStyle = ig;
                ctx.beginPath();
                ctx.arc(0, 0, irisR, 0, TAU);
                ctx.fill();

                ctx.rotate(p * 3.8 * facing);
                ctx.strokeStyle = '#FDE68A';
                ctx.lineWidth = 1.6;
                for (var s = 0; s < 8; s++) {
                  var sa = (s / 8) * TAU;
                  ctx.beginPath();
                  ctx.moveTo(Math.cos(sa) * irisR * 0.35, Math.sin(sa) * irisR * 0.35);
                  ctx.lineTo(Math.cos(sa) * irisR * 0.96, Math.sin(sa) * irisR * 0.96);
                  ctx.stroke();
                }

                // 竖直菱形神瞳核心
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(0, -irisR * 0.64);
                ctx.lineTo(irisR * 0.25, 0);
                ctx.lineTo(0, irisR * 0.64);
                ctx.lineTo(-irisR * 0.25, 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // 两侧羽翼星辉装饰
                kit.drawStarFlare(ctx, -rx - 4, 0, 14 * ampScale, 0.22, 4, p * 4, '#FDE68A', '#FFFFFF', fade);
                kit.drawStarFlare(ctx, rx + 4, 0, 14 * ampScale, 0.22, 4, -p * 4, '#FDE68A', '#FFFFFF', fade);
              }
            });
          }
        },
        {
          at: 190,
          fn: function () {
            kit.addMagicCircle({
              x: eyeX, y: center.groundY + 4, radius: 66 * ampScale, sy: 0.28,
              palette: 'wind', goldTriple: true, dur: 760, fadeIn: 90, fadeOut: 220
            });
          }
        },
        {
          at: 335,
          fn: function () {
            for (var idx = 0; idx < targets.length; idx++) {
              var tg = targets[idx];
              kit.safeCall(o.onImpact, idx, tg, idx === targets.length - 1);
              kit.addLightning(eyeX, eyeY, tg.x, tg.y - 6, {
                outerColor: '#059669', midColor: '#6EE7B7', coreColor: '#FFFFFF',
                width: 2.4, dur: 280, branches: 2
              });
              kit.addShockRing({
                x: tg.x, y: tg.groundY + 4, r0: 14, r1: 108 * ampScale, sy: 0.28,
                color: '#10B981', coreColor: '#FFFFFF', lineW: 3.8, dur: 480
              });
            }

            // 三重同心椭圆翡翠金神瞳震波（完整容纳于 640×360 零裁边）
            kit.addCustomDrawable('front', {
              dur: 620,
              draw: function (ctx, p) {
                for (var w = 0; w < 3; w++) {
                  var wp = clamp((p - w * 0.14) / 0.68, 0, 1);
                  if (wp <= 0 || wp >= 1) continue;
                  var rx = lerp(24, 168, easeOutCubic(wp)) * ampScale;
                  var ry = rx * 0.78;
                  var alpha = (1 - easeInQuad(wp)) * 0.94;
                  ctx.globalAlpha = alpha;
                  ctx.strokeStyle = w === 1 ? '#F59E0B' : '#10B981';
                  ctx.lineWidth = (5.4 - w * 0.8) * (1 - wp * 0.55);
                  ctx.beginPath();
                  ctx.ellipse(eyeX, eyeY, rx, ry, 0, 0, TAU);
                  ctx.stroke();

                  ctx.strokeStyle = w === 1 ? '#FEF9C3' : '#FFFFFF';
                  ctx.lineWidth = 2.0 * (1 - wp * 0.55);
                  ctx.beginPath();
                  ctx.ellipse(eyeX, eyeY, rx * 0.97, ry * 0.97, 0, 0, TAU);
                  ctx.stroke();
                }
              }
            });

            kit.spawnPfx('parry', { palette: PAL.slashWind, height: 28 }, {
              x: center.x, y: center.y + 40, scale: 1.92 * ampScale, durMs: 560, layer: 'front'
            });
            kit.spawnPfx('frost_nova', { palette: PAL.wind, reach: 88 }, {
              x: center.x, y: center.groundY + 4, scale: 1.48 * ampScale,
              preWarmSec: 0.38, timeScale: 1.5, durMs: 740, layer: 'back'
            });
            kit.addFlash(eyeX, eyeY, 62 * ampScale, '#6EE7B7', 180, 0.40);
            kit.addFlash(center.x, center.y, 64 * ampScale, '#FDE68A', 175, 0.38);
            kit.addStarFlare({
              x: center.x, y: center.y - 6, r0: 14, r1: 70 * ampScale, inner: 0.16, points: 8,
              outerColor: '#FDE68A', coreColor: '#FFFFFF', dur: 420
            });
            kit.addShockRing({
              x: eyeX, y: eyeY, r0: 18, r1: 132 * ampScale, sy: 0.80,
              color: '#2DD4BF', coreColor: '#FFFFFF', lineW: 3.8, dur: 460, layer: 'front'
            });

            kit.spawnBurstParticles(eyeX, eyeY, 26, 'ringlet', {
              spdMin: 75, spdMax: 245, upBias: 20, sizeMin: 4.2, sizeMax: 8.2,
              colors: ['#FFFFFF', '#CCFBF1', '#6EE7B7', '#FDE68A'], color2: '#059669',
              lifeMin: 460, lifeMax: 840
            });
            kit.spawnBurstParticles(center.x, center.y - 8, 28, 'leaf', {
              spdMin: 70, spdMax: 240, upBias: 95, gravity: 20, drag: 1.0,
              sizeMin: 4.2, sizeMax: 8.0,
              colors: ['#CCFBF1', '#A7F3D0', '#6EE7B7', '#FDE68A'], color2: '#047857',
              lifeMin: 480, lifeMax: 860
            });

            kit.safeCall(o.onShake, 9.6 + amp * 2.2, 300);
            kit.safeCall(o.onHitStop, 64 + amp * 12);
          }
        },
        {
          at: 520,
          fn: function () {
            kit.addShockRing({
              x: center.x, y: center.groundY + 4, r0: 18, r1: 144 * ampScale, sy: 0.28,
              color: '#F59E0B', coreColor: '#FEF9C3', lineW: 3.6, dur: 460
            });
          }
        }
      ]);
    }
  };

  /* -------------------- 全 9 幕敌方与 Boss 招式 / 动作 / 英文简写全覆盖别名表 -------------------- */
  var PACK_ALIASES = {
    // 兼容 core 原有敌方抽象别名
    enemy_fire_melee:          'enemy_beatrice_flame_lash',
    enemy_fire_magic:          'enemy_beatrice_ruby_orb',
    enemy_fireball:            'enemy_beatrice_ruby_orb',
    enemy_flame_pillar:        'enemy_beatrice_noble_flare',
    enemy_fire_ring:           'enemy_flame_mage_cast',
    enemy_heavy_cleave:        'enemy_vanguard_halberd',
    enemy_rowan_eclipse:       'enemy_rowan_eclipse_bolt',
    rowan_eclipse:             'enemy_rowan_eclipse_bolt',
    enemy_rowan_sigil:         'enemy_rowan_blood_sigil',
    enemy_rowan_blood:         'enemy_rowan_blood_sigil',
    enemy_rowan_tendrils:      'enemy_rowan_grave_surge',
    enemy_shadow_tendrils:     'enemy_rowan_grave_surge',
    enemy_wind_dash:           'enemy_alice_gale_ribbon',
    enemy_alice_wind:          'enemy_alice_gale_ribbon',
    enemy_alice_storm:         'enemy_alice_petal_cyclone',
    enemy_alice_cyclone:       'enemy_alice_petal_cyclone',
    enemy_aino_ice:            'enemy_aino_frost_lance',
    aino_ice_lance:            'enemy_aino_frost_lance',
    enemy_aino_sweep:          'enemy_aino_glacier_sweep',
    enemy_aino_spikes:         'enemy_aino_glacier_sweep',
    enemy_aino_hail:           'enemy_aino_north_hail',
    enemy_noelle_water:        'enemy_noelle_prism_ray',
    noelle_water_jet:          'enemy_noelle_prism_ray',
    enemy_noelle_grid:         'enemy_noelle_arcane_grid',
    enemy_noelle_curtain:      'enemy_noelle_arcane_grid',
    enemy_noelle_seep:         'enemy_noelle_formula_nova',
    enemy_noelle_nova:         'enemy_noelle_formula_nova',
    enemy_beast_claw:          'enemy_wolf_frost_claw',
    enemy_claw:                'enemy_wolf_frost_claw',
    enemy_wolf_claw:           'enemy_wolf_frost_claw',
    enemy_jackal_claw:         'enemy_wolf_frost_claw',
    enemy_wolf_howl:           'enemy_wolf_howl_chill',
    enemy_beast_slam:          'enemy_beast_pounce_slam',
    enemy_ground_slam:         'enemy_beast_pounce_slam',
    enemy_tundra_slam:         'enemy_beast_pounce_slam',
    enemy_behemoth_stomp:      'enemy_behemoth_glacier_stomp',
    enemy_hulan_stomp:         'enemy_behemoth_glacier_stomp',
    enemy_hulan_lord:          'enemy_behemoth_glacier_stomp',
    enemy_flame_mage:          'enemy_flame_mage_cast',
    enemy_corridor_vanguard:   'enemy_vanguard_halberd',
    enemy_vanguard:            'enemy_vanguard_halberd',
    enemy_eastwing_slash:      'enemy_eastwing_cross_slash',
    enemy_eastwing_commander:  'enemy_eastwing_cross_slash',
    enemy_eastwing_boss:       'enemy_eastwing_cross_slash',
    enemy_eastwing_rush:       'enemy_eastwing_phalanx_rush',
    enemy_eastwing_charge:     'enemy_eastwing_phalanx_rush',
    enemy_wind_god:            'enemy_windgod_emerald_vortex',
    enemy_wind_god_avatar:     'enemy_windgod_emerald_vortex',
    enemy_wind_god_boss:       'enemy_windgod_emerald_vortex',
    enemy_wind_god_arc:        'enemy_windgod_tempest_arc',
    enemy_wind_god_slash:      'enemy_windgod_tempest_arc',
    enemy_wind_god_vortex:     'enemy_windgod_emerald_vortex',
    enemy_wind_god_judgment:   'enemy_windgod_sky_judgment',
    enemy_wind_god_eye:        'enemy_windgod_eye_pulse',
    enemy_wind_god_stillness:  'enemy_windgod_eye_pulse',

    // 按敌方 spriteId / aiType 兜底路由（带 enemy_ 前缀）
    enemy_beatrice:            'enemy_beatrice_ruby_orb',
    enemy_rowan:               'enemy_rowan_eclipse_bolt',
    enemy_alice:               'enemy_alice_gale_ribbon',
    enemy_aino:                'enemy_aino_frost_lance',
    enemy_noelle:              'enemy_noelle_prism_ray',
    enemy_wolf_alpha:          'enemy_wolf_howl_chill',
    enemy_pack_wolf:           'enemy_wolf_frost_claw',
    enemy_shadow_jackal:       'enemy_wolf_frost_claw',
    enemy_frost_hound:         'enemy_wolf_frost_claw',
    enemy_ridge_claw:          'enemy_wolf_frost_claw',
    enemy_tundra_brute:        'enemy_beast_pounce_slam',
    enemy_abyss_behemoth:      'enemy_behemoth_glacier_stomp',

    // combat-engine.js Boss moveKey（resolveSkillId 自动小写查表）
    flame_corridor_seal:       'enemy_flame_mage_cast',
    crossroad_breach:          'enemy_eastwing_phalanx_rush',
    tempest_vacuum:            'enemy_windgod_tempest_arc',
    eye_stillness:             'enemy_windgod_eye_pulse',

    // 全 9 幕中文招式名精确映射（含 combat-engine.js 原文 moveName）
    '烈焰鞭袭': 'enemy_beatrice_flame_lash',
    '绯红火球': 'enemy_beatrice_ruby_orb',
    '贵族耀焰': 'enemy_beatrice_noble_flare',
    '变步近身·烈火疾斩': 'enemy_beatrice_flame_lash',
    '双手塑形·暴走火蛇（宜凝华冰晶冻核）': 'enemy_beatrice_flame_lash',
    '烈焰剑障·融冰防反（宜覆潮水弹浇灭，忌冰晶）': 'enemy_beatrice_flame_lash',
    '看破路数·烈焰剑障反劈（忌复读单招！）': 'enemy_beatrice_flame_lash',
    '抬右肩·烈焰连球重劈': 'enemy_beatrice_ruby_orb',
    '融冰爆炎·破壁重劈': 'enemy_beatrice_noble_flare',
    '抬右肩·爆炎踏步重劈': 'enemy_beatrice_noble_flare',

    '紫银蚀弹': 'enemy_rowan_eclipse_bolt',
    '血晶印阵': 'enemy_rowan_blood_sigil',
    '墓园灵潮': 'enemy_rowan_grave_surge',
    '晦轮银环·越位蚀心黑光': 'enemy_rowan_eclipse_bolt',
    '虚刺雷纳德·脱手旋杖袭心': 'enemy_rowan_eclipse_bolt',
    '血魔炸土·碎壁穿心刺': 'enemy_rowan_blood_sigil',
    '血魔震土·石碑窄道突围': 'enemy_rowan_grave_surge',

    '翠风缎刃': 'enemy_alice_gale_ribbon',
    '花风旋舞': 'enemy_alice_petal_cyclone',
    '侧滑扬尘 + 绕侧风刃': 'enemy_alice_gale_ribbon',
    '借风掠影·透明风刃': 'enemy_alice_gale_ribbon',
    '旋风障壁·回旋风镰': 'enemy_alice_gale_ribbon',
    '双手合拢·狂躁风暴蓄力': 'enemy_alice_petal_cyclone',
    '狂岚破幕卷（粉碎护盾）': 'enemy_alice_petal_cyclone',

    '银冰长枪': 'enemy_aino_frost_lance',
    '冰川横扫': 'enemy_aino_glacier_sweep',
    '北境霰阵': 'enemy_aino_north_hail',
    '无瑕镜冰·预判反刺（忌隔空！）': 'enemy_aino_frost_lance',
    '破根极寒钻刺（碎盾重击）': 'enemy_aino_frost_lance',
    '贴地滑冰·变向双刺': 'enemy_aino_glacier_sweep',
    '贴地滑冰·近身双刺': 'enemy_aino_glacier_sweep',
    '破土三连冰锥（正面镜冰）': 'enemy_aino_north_hail',
    '双手压地·极寒双翼刺阵': 'enemy_aino_north_hail',

    '星轨魔阵': 'enemy_noelle_arcane_grid',
    '折光射线': 'enemy_noelle_prism_ray',
    '推演星爆': 'enemy_noelle_formula_nova',
    '方程预演·叠层尺量水幕': 'enemy_noelle_arcane_grid',
    '尺量零留白水幕 + 平切水刃': 'enemy_noelle_arcane_grid',
    '纸薄水膜截凝 + 反切水刃': 'enemy_noelle_prism_ray',
    '等距后撤·双幕收口水刃': 'enemy_noelle_prism_ray',
    '残魔退守（脚底冰缝暗流穿心！）': 'enemy_noelle_formula_nova',

    '霜爪撕裂': 'enemy_wolf_frost_claw',
    '凛嚎冰环': 'enemy_wolf_howl_chill',
    '冰原猛扑': 'enemy_beast_pounce_slam',
    '巨冰震踏': 'enemy_behemoth_glacier_stomp',
    '群狼合围撕咬': 'enemy_wolf_frost_claw',
    '银影腾空·锁喉扑杀': 'enemy_wolf_frost_claw',
    '裂甲暗影重爪（撕碎护盾）': 'enemy_wolf_frost_claw',
    '贴身疾扑': 'enemy_wolf_frost_claw',
    '仰首群嚎·凶性激发': 'enemy_wolf_howl_chill',
    '霜脊蓄寒·冰刺喷吐': 'enemy_wolf_howl_chill',
    '蓄势咆哮猛击': 'enemy_wolf_howl_chill',
    '冻土聚甲 + 蓄力撞击药箱': 'enemy_beast_pounce_slam',
    '厚岩缩甲·蛮冲医疗药箱': 'enemy_beast_pounce_slam',
    '冻土岩刺守御·反震撞箱': 'enemy_beast_pounce_slam',
    '裂地横扫扑击': 'enemy_beast_pounce_slam',
    '正面强袭': 'enemy_beast_pounce_slam',
    '双臂聚寒·极北霜岩风暴': 'enemy_behemoth_glacier_stomp',
    '冻甲壁垒·冰峡崩震（波及药箱）': 'enemy_behemoth_glacier_stomp',
    '极寒岩壁防反（反震药箱！）': 'enemy_behemoth_glacier_stomp',
    '崩山碎盾踏（摧毁护盾与药箱！）': 'enemy_behemoth_glacier_stomp',

    '绯莲火雨': 'enemy_flame_mage_cast',
    '金钢戟斩': 'enemy_vanguard_halberd',
    '十字银斩': 'enemy_eastwing_cross_slash',
    '辉盾冲锋': 'enemy_eastwing_phalanx_rush',
    '双手结印·封廊赤炎火墙': 'enemy_flame_mage_cast',
    '赤炎爆裂火球': 'enemy_flame_mage_cast',
    '炎环护身·反灼火弧': 'enemy_flame_mage_cast',
    '红莲铁幕·封廊锁火（高危必断咏唱！）': 'enemy_flame_mage_cast',
    '双手引火·长廊炎壁（可隔空截断）': 'enemy_flame_mage_cast',
    '破阵重戟斩（粉碎护盾！）': 'enemy_vanguard_halberd',
    '十字长戟·走廊突刺': 'enemy_vanguard_halberd',
    '铁壁举盾·截空反刺': 'enemy_vanguard_halberd',
    '宫廷重盾·护阵反击': 'enemy_vanguard_halberd',
    '重戟焚盾劈（粉碎护盾！）': 'enemy_eastwing_cross_slash',
    '红莲焚盾斩·焦土破壁': 'enemy_eastwing_cross_slash',
    '红莲火戟·截空反刺（忌盲丢隔空！）': 'enemy_eastwing_cross_slash',
    '铁幕识破·炎甲反震（忌复读单招！）': 'enemy_eastwing_cross_slash',
    '炎戟突进·封喉直刺（可剑步闪反）': 'enemy_eastwing_cross_slash',
    '红莲铁幕·融冰守势（宜覆潮水弹浇灭）': 'enemy_eastwing_phalanx_rush',
    '红莲突袭·岔口破阵冲锋（宜剑步闪反！）': 'enemy_eastwing_phalanx_rush',

    '青空裂风': 'enemy_windgod_tempest_arc',
    '翡翠飓眼': 'enemy_windgod_emerald_vortex',
    '天穹风裁': 'enemy_windgod_sky_judgment',
    '神瞳震波': 'enemy_windgod_eye_pulse',
    '风暴眼·真空连刃（踏生根步可触发斩风瞬反！）': 'enemy_windgod_tempest_arc',
    '翠岚掠影·试剑三连（宜生根步卸力破闪）': 'enemy_windgod_tempest_arc',
    '风壁听劲·借力反斩（忌盲攻！）': 'enemy_windgod_tempest_arc',
    '双袖引风·压场气旋（可隔空截断！）': 'enemy_windgod_emerald_vortex',
    '御风折锋·借岚反切（忌盲丢隔空！）': 'enemy_windgod_emerald_vortex',
    '听风破招·同路反制（忌复读单招！）': 'enemy_windgod_emerald_vortex',
    '断壁裂空岚（粉碎护盾！）': 'enemy_windgod_sky_judgment',
    '风眼静滞·圆心反制阵（须冰宫看破或蓄势剑步破静！）': 'enemy_windgod_eye_pulse'
  };

  var packExport = {
    packName: PACK_NAME,
    meta: PACK_META,
    handlers: PACK_HANDLERS,
    aliases: PACK_ALIASES,
    register: function (targetCore) {
      var c = targetCore || global.VfxEditionAFull || Core;
      if (c && typeof c.registerPack === 'function') {
        return c.registerPack(PACK_NAME, PACK_META, PACK_HANDLERS, PACK_ALIASES);
      }
      return null;
    }
  };

  if (Core && typeof Core.registerPack === 'function') {
    packExport.registration = Core.registerPack(PACK_NAME, PACK_META, PACK_HANDLERS, PACK_ALIASES);
  }

  global.VfxPackEnemies = packExport;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = packExport;
  }
})(typeof window !== 'undefined' ? window : globalThis);
