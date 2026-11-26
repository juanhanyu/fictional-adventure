/* ============================================================================
   《转生千金》新版明亮战斗特效竞标 · 方案 C（日系动画赛璐璐刀光 × 立体棱镜折射派）
   导出：window.VfxEditionC（0 外部依赖，纯自包含 Canvas2D 60fps 引擎）
   逻辑画布：640×360（自动适配任意分辨率画布缩放）
   审美血脉：与 combat_p5_opt2_prism_radial.html 3D 棱镜增幅光环 100% 同源
   - 明亮雪瓷舞台高对比优化：饱和皇家蓝/碧青/翡翠/香槟金赛璐璐外衬 +
     透光立体多面体折射 + 彩虹棱镜色散边 + 纯白炽亮核心 + 清脆像素晶尘点缀
   - 全 9 招完整四段动势（起手魔法阵 → 高速丝滑流光弧 → 爆发顿帧冲击波与大体积棱镜碎裂 → 折射星尘余韵）
   - ampTier: 0 | 1 | 2 | 3 逐阶叠加 3D 倾斜棱镜轨环、香槟金星轨与闪耀冰雷
   ============================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined' && root) {
    root.VfxEditionC = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var LOGICAL_W = 640;
  var LOGICAL_H = 360;
  var PI = Math.PI;
  var TAU = Math.PI * 2;

  /* ==========================================================================
     1. 统一元数据与 9 招注册表
     ========================================================================== */
  var META = {
    id: 'edition_c',
    name: '方案 C · 日系动画刀光×立体棱镜折射版',
    subtitle: '与 3D 增幅光环血脉同源的 60fps 丝滑赛璐璐流光与透光多面体冰晶',
    styleTag: '丝滑日系动画 · 棱镜折射流光',
    palette: ['#2563EB', '#38BDF8', '#7DD3FC', '#FEF08A', '#5EEAD4']
  };

  var SKILLS = [
    {
      id: 'ice_crystal',
      name: '冰晶术',
      en: 'Ice Crystal',
      category: 'magic',
      targetMode: 'single',
      element: 'ice',
      durationMs: 1120,
      peakMs: 560,
      summary: '3D 冰蓝魔法环 → 高速水晶晶矛 → 立体透光冰晶簇骤凝迸裂与旋转棱晶碎片'
    },
    {
      id: 'tri_prism_ice',
      name: '三棱冰晶',
      en: 'Tri-Prism Ice',
      category: 'magic',
      targetMode: 'single',
      element: 'ice',
      durationMs: 1260,
      peakMs: 660,
      summary: '法杖三角棱晶阵 → 三道 S 型丝滑流光弧线依次贯通 → 三连棱镜爆环与星芒连闪'
    },
    {
      id: 'starfrost_scatter',
      name: '星霜散华',
      en: 'Starfrost Scatter',
      category: 'ultimate',
      targetMode: 'single',
      element: 'starfrost',
      durationMs: 1620,
      peakMs: 1005,
      summary: '立体双层香槟金×冰蓝星轨阵 → 7 枚巨型晶透棱柱坠落贯刺 → 巨大星霜雪花冲击波与虹光散华'
    },
    {
      id: 'raging_surge',
      name: '激流涌',
      en: 'Raging Surge',
      category: 'water',
      targetMode: 'single',
      element: 'water',
      durationMs: 1240,
      peakMs: 660,
      summary: '多层日系透明水龙流带螺旋翻涌奔袭 → 冲天卷起晶莹水幕浪墙与闪烁飞溅水花弧'
    },
    {
      id: 'water_cleave',
      name: '断水刃',
      en: 'Water Cleave',
      category: 'water',
      targetMode: 'single',
      element: 'water',
      durationMs: 980,
      peakMs: 470,
      summary: '超高速赛璐璐双道大弧冰水月牙交叉斩击 → 冰蓝/亮青/纯白三层光带与空气切裂菱形闪线'
    },
    {
      id: 'frost_thorn_field',
      name: '霜域棘阵',
      en: 'Frost Thorn Field',
      category: 'aoe',
      targetMode: 'multi',
      element: 'ice',
      durationMs: 1380,
      peakMs: 730,
      summary: '冰青光波沿地横扫全场 → 3 敌脚下依次弹出立体多面体晶蓝巨棘 → 漫天发光冰花飘落'
    },
    {
      id: 'steel_ice_curtain',
      name: '钢冰护幕',
      en: 'Steel-Ice Curtain',
      category: 'shield',
      targetMode: 'self',
      element: 'ice_gold',
      durationMs: 1320,
      peakMs: 650,
      summary: '6 面立体半透明蓝金棱镜冰盾穹顶拼合 → 斜向彩虹冰白反光带 → 双 3D 倾斜星轨环与电光护体'
    },
    {
      id: 'sword_send_slash',
      name: '送刀斩',
      en: 'Sword Send Slash',
      category: 'sword',
      targetMode: 'single',
      element: 'ice_gold',
      durationMs: 1080,
      peakMs: 545,
      summary: '高速突进流光带 → 横竖两段超宽冰青/香槟金月牙大斩弧 → 璀璨八芒星爆与飞散火花'
    },
    {
      id: 'wind_afterimage',
      name: '风行残像',
      en: 'Wind Afterimage',
      category: 'wind',
      targetMode: 'self',
      element: 'wind',
      durationMs: 1180,
      peakMs: 585,
      summary: '翡翠青×冰白双螺旋高速风带 → 三重明澈青金流光残影 → 飘飞发光风刃光瓣'
    }
  ];

  var SKILL_MAP = {};
  for (var si = 0; si < SKILLS.length; si++) {
    SKILL_MAP[SKILLS[si].id] = SKILLS[si];
  }

  /* ==========================================================================
     2. 数学、缓动与确定性随机数
     ========================================================================== */
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function remap(v, a, b) {
    if (b <= a) return v >= b ? 1 : 0;
    return clamp((v - a) / (b - a), 0, 1);
  }

  var EASE = {
    outQuad: function (t) { var x = clamp(t, 0, 1); return 1 - (1 - x) * (1 - x); },
    inQuad: function (t) { var x = clamp(t, 0, 1); return x * x; },
    outCubic: function (t) { var x = clamp(t, 0, 1); return 1 - Math.pow(1 - x, 3); },
    inCubic: function (t) { var x = clamp(t, 0, 1); return x * x * x; },
    outQuart: function (t) { var x = clamp(t, 0, 1); return 1 - Math.pow(1 - x, 4); },
    outExpo: function (t) { var x = clamp(t, 0, 1); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    inOutCubic: function (t) {
      var x = clamp(t, 0, 1);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    },
    outBack: function (t) {
      var x = clamp(t, 0, 1);
      var c1 = 1.70158;
      var c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
  };

  function createRng(seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cubicBezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var tt = t * t;
    var uu = u * u;
    return {
      x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
      y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y
    };
  }

  function cubicBezierTangent(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
    var dy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
    return Math.atan2(dy, dx);
  }

  /* ==========================================================================
     3. 高品位日系赛璐璐 × 3D 棱镜基础绘制原语
     ========================================================================== */

  function drawRadialGlow(ctx, x, y, r, innerCol, midCol, outerCol, alpha) {
    if (r <= 0.5 || alpha <= 0.005) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, innerCol);
    g.addColorStop(0.44, midCol);
    g.addColorStop(1, outerCol);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** 清脆像素晶尘点缀（呼应像素角色，保持干净利落绝不糊成碎渣） */
  function drawPixelSparkle(ctx, x, y, size, color, alpha, isCross) {
    if (alpha <= 0.01 || size < 1) return;
    var rx = Math.round(x);
    var ry = Math.round(y);
    var s = Math.max(2, Math.round(size));
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    if (isCross) {
      ctx.fillStyle = color;
      ctx.fillRect(rx - s, ry - 1, s * 2 + 1, 2);
      ctx.fillRect(rx - 1, ry - s, 2, s * 2 + 1);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(rx - 1, ry - 1, 2, 2);
    } else {
      ctx.fillStyle = '#1D4ED8';
      ctx.globalAlpha = clamp(alpha * 0.45, 0, 1);
      ctx.fillRect(rx - 1, ry - 1, s + 2, s + 2);
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = color;
      ctx.fillRect(rx, ry, s, s);
      if (s >= 3) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(rx, ry, Math.max(1, s - 2), Math.max(1, s - 2));
      }
    }
    ctx.restore();
  }

  /** 四芒/菱形棱镜星尘（承袭 combat_p5_opt2_prism_radial.html drawCrystalMote 血脉） */
  function drawCrystalMote(ctx, px, py, size, color, isStar, alpha, rot) {
    if (alpha <= 0.01 || size <= 0.4) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(px, py);
    if (rot) ctx.rotate(rot);
    if (isStar) {
      var r = size * 1.65;
      var w = Math.max(1.1, size * 0.32);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(w, -w);
      ctx.lineTo(r, 0);  ctx.lineTo(w, w);
      ctx.lineTo(0, r);  ctx.lineTo(-w, w);
      ctx.lineTo(-r, 0); ctx.lineTo(-w, -w);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.56); ctx.lineTo(w * 0.65, 0);
      ctx.lineTo(0, r * 0.56);  ctx.lineTo(-w * 0.65, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      var d = size;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -d);
      ctx.lineTo(d * 0.78, 0);
      ctx.lineTo(0, d);
      ctx.lineTo(-d * 0.78, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -d * 0.52);
      ctx.lineTo(d * 0.35, 0);
      ctx.lineTo(0, d * 0.52);
      ctx.lineTo(-d * 0.35, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** 璀璨八芒/四芒日系动漫爆发星芒 */
  function drawAnimeStarburst(ctx, x, y, outerR, innerR, points, rot, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01 || outerR <= 1) return;
    var rimCol = o.rimColor || '#1D4ED8';
    var mainCol = o.mainColor || '#38BDF8';
    var prismCol = o.prismColor || '#FEF08A';
    var coreCol = o.coreColor || '#FFFFFF';
    var flareLen = o.flareLen || outerR * 1.45;

    ctx.save();
    ctx.translate(x, y);

    drawRadialGlow(ctx, 0, 0, outerR * 1.15,
      'rgba(255,255,255,0.92)',
      o.glowMid || 'rgba(37,99,235,0.42)',
      'rgba(56,189,248,0)', alpha);

    if (flareLen > 4) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha * 0.92, 0, 1);
      ctx.rotate(rot * 0.22);
      var drawBeam = function (len, halfH, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(0, -halfH, len, 0);
        ctx.quadraticCurveTo(0, halfH, -len, 0);
        ctx.closePath();
        ctx.fill();
      };
      drawBeam(flareLen, Math.max(2.6, outerR * 0.13), rimCol);
      drawBeam(flareLen * 0.92, Math.max(1.8, outerR * 0.09), mainCol);
      drawBeam(flareLen * 0.78, Math.max(1.1, outerR * 0.048), coreCol);
      ctx.restore();
    }

    var buildStarPath = function (rOuter, rInner, nPts, rOff) {
      ctx.beginPath();
      for (var i = 0; i < nPts * 2; i++) {
        var a = rOff + (i * PI) / nPts;
        var isTip = i % 2 === 0;
        var rad = isTip ? (i % 4 === 0 ? rOuter : rOuter * 0.68) : rInner;
        var px = Math.cos(a) * rad;
        var py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    ctx.globalAlpha = clamp(alpha * 0.85, 0, 1);
    buildStarPath(outerR * 1.07, innerR * 1.24, points, rot);
    ctx.fillStyle = rimCol;
    ctx.fill();

    ctx.globalAlpha = clamp(alpha * 0.76, 0, 1);
    buildStarPath(outerR * 0.94, innerR * 0.95, points, rot + 0.08);
    ctx.fillStyle = prismCol;
    ctx.fill();

    ctx.globalAlpha = clamp(alpha * 0.96, 0, 1);
    buildStarPath(outerR * 0.98, innerR, points, rot);
    ctx.fillStyle = mainCol;
    ctx.fill();

    ctx.globalAlpha = clamp(alpha, 0, 1);
    buildStarPath(outerR * 0.64, innerR * 0.66, points, rot);
    ctx.fillStyle = coreCol;
    ctx.fill();

    ctx.restore();
  }

  /** 3D 倾斜椭圆冲击波环 */
  function draw3DShockwave(ctx, x, y, rx, ry, rot, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01 || rx <= 1 || ry <= 1) return;
    var outerCol = o.outerColor || '#1D4ED8';
    var midCol = o.midColor || '#38BDF8';
    var coreCol = o.coreColor || '#FFFFFF';
    var lw = o.lineWidth || 3.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);

    if (o.fillAlpha) {
      ctx.globalAlpha = clamp(alpha * o.fillAlpha, 0, 1);
      ctx.fillStyle = midCol;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = clamp(alpha * 0.85, 0, 1);
    ctx.strokeStyle = outerCol;
    ctx.lineWidth = lw * 1.85;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = clamp(alpha * 0.95, 0, 1);
    ctx.strokeStyle = midCol;
    ctx.lineWidth = lw * 1.12;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.stroke();

    if (o.prismColor) {
      ctx.globalAlpha = clamp(alpha * 0.68, 0, 1);
      ctx.strokeStyle = o.prismColor;
      ctx.lineWidth = Math.max(1, lw * 0.45);
      ctx.beginPath();
      ctx.ellipse(1.5, -1, rx * 1.03, ry * 1.03, 0, 0, TAU);
      ctx.stroke();
    }

    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.strokeStyle = coreCol;
    ctx.lineWidth = Math.max(1, lw * 0.46);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.985, ry * 0.985, 0, 0, TAU);
    ctx.stroke();

    if (o.ticks) {
      var n = o.ticks;
      ctx.strokeStyle = coreCol;
      ctx.lineWidth = 1.25;
      ctx.globalAlpha = clamp(alpha * 0.8, 0, 1);
      for (var i = 0; i < n; i++) {
        var a = (i / n) * TAU + (o.tickRot || 0);
        var ca = Math.cos(a), sa = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(ca * rx * 0.88, sa * ry * 0.88);
        ctx.lineTo(ca * rx * 1.14, sa * ry * 1.14);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** 3D 透视倾斜魔法阵 */
  function draw3DMagicCircle(ctx, cx, cy, rx, ry, tilt, rot, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01 || rx <= 2) return;
    var outerCol = o.outerColor || '#1D4ED8';
    var mainCol = o.mainColor || '#38BDF8';
    var coreCol = o.coreColor || '#FFFFFF';
    var goldCol = o.goldColor || '#FEF08A';
    var isGold = !!o.gold;
    var runeSides = o.sides || 6;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt || 0);

    ctx.save();
    ctx.scale(1, ry / rx);
    drawRadialGlow(ctx, 0, 0, rx * 1.18,
      isGold ? 'rgba(254,240,138,0.44)' : 'rgba(186,230,253,0.48)',
      isGold ? 'rgba(245,158,11,0.30)' : 'rgba(37,99,235,0.36)',
      'rgba(56,189,248,0)', alpha);

    ctx.globalAlpha = clamp(alpha * 0.88, 0, 1);
    ctx.strokeStyle = isGold ? '#B45309' : outerCol;
    ctx.lineWidth = (o.lineWidth || 2.4) * 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = clamp(alpha * 0.98, 0, 1);
    ctx.strokeStyle = isGold ? goldCol : mainCol;
    ctx.lineWidth = o.lineWidth || 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = clamp(alpha * 0.92, 0, 1);
    ctx.strokeStyle = coreCol;
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.97, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = isGold ? '#F59E0B' : '#2563EB';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([Math.max(4, rx * 0.16), Math.max(3, rx * 0.11)]);
    ctx.globalAlpha = clamp(alpha * 0.84, 0, 1);
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.84, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = isGold ? '#FFFBEB' : '#E0F2FE';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.84, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    if (runeSides >= 3) {
      var drawPoly = function (r, phase, strokeC, lw) {
        ctx.strokeStyle = strokeC;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (var i = 0; i <= runeSides; i++) {
          var a = phase + (i / runeSides) * TAU;
          var px = Math.cos(a) * r;
          var py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };

      ctx.globalAlpha = clamp(alpha * 0.78, 0, 1);
      drawPoly(rx * 0.82, 0, isGold ? '#D97706' : outerCol, 2.3);
      drawPoly(rx * 0.82, 0, isGold ? goldCol : '#7DD3FC', 1.2);
      if (runeSides === 6 || runeSides === 8) {
        var halfStep = PI / runeSides;
        drawPoly(rx * 0.82, halfStep, isGold ? '#B45309' : '#2563EB', 1.9);
        drawPoly(rx * 0.82, halfStep, '#FFFFFF', 1.0);
      }
      ctx.strokeStyle = isGold ? goldCol : '#BAE6FD';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, rx * 0.42, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    var nodes = o.nodes || runeSides;
    for (var k = 0; k < nodes; k++) {
      var a = rot + (k / nodes) * TAU;
      var nx = Math.cos(a) * rx;
      var ny = Math.sin(a) * ry;
      var z = Math.sin(a);
      var mSize = (2.8 + (z + 1) * 1.45) * (o.nodeScale || 1);
      drawCrystalMote(ctx, nx, ny, mSize, isGold ? goldCol : (k % 2 === 0 ? '#FFFFFF' : '#7DD3FC'), k % 2 === 0, alpha * (0.68 + 0.32 * (z + 1) * 0.5), 0);
    }
    ctx.restore();
  }

  /**
   * 3D 倾斜棱镜流光轨环（100% 血脉同源于 combat_p5_opt2_prism_radial.html！）
   */
  function draw3DOrbitRibbon(ctx, cx, cy, rx, ry, tilt, phase, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01 || rx <= 2) return;
    var pass = o.pass || 'all';
    var count = o.count || 10;
    var trailSteps = o.trailSteps || 7;
    var trailArc = o.trailArc || 0.44;
    var dir = o.dir || 1;
    var ribbonOuter = o.ribbonOuter || '#1D4ED8';
    var ribbonMain = o.ribbonMain || '#38BDF8';
    var ribbonCore = o.ribbonCore || '#FFFFFF';
    var motesPalette = o.palette || ['#FFFFFF', '#7DD3FC', '#38BDF8', '#FEF08A'];
    var lw = o.lineWidth || 2.1;

    function evalPt(ang) {
      var c = Math.cos(ang);
      var s = Math.sin(ang);
      var lx = rx * c;
      return { x: cx + lx, y: cy + ry * s - lx * tilt, z: s };
    }

    ctx.save();
    ctx.lineCap = 'round';
    var segs = 44;
    for (var i = 0; i < segs; i++) {
      var p0 = evalPt((i / segs) * TAU);
      var p1 = evalPt(((i + 1) / segs) * TAU);
      var midZ = (p0.z + p1.z) * 0.5;
      if (pass === 'front' && midZ < 0) continue;
      if (pass === 'back' && midZ >= 0) continue;
      var depth = midZ >= 0 ? (0.62 + 0.38 * midZ) : (0.30 + 0.28 * (1 + midZ));

      ctx.strokeStyle = ribbonOuter;
      ctx.globalAlpha = clamp(alpha * depth * 0.72, 0, 1);
      ctx.lineWidth = lw * (midZ >= 0 ? 1.95 : 1.2);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();

      ctx.strokeStyle = ribbonMain;
      ctx.globalAlpha = clamp(alpha * depth * 0.95, 0, 1);
      ctx.lineWidth = lw * (midZ >= 0 ? 1.1 : 0.7);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();

      if (midZ >= 0) {
        ctx.strokeStyle = ribbonCore;
        ctx.globalAlpha = clamp(alpha * depth * 0.84, 0, 1);
        ctx.lineWidth = Math.max(0.85, lw * 0.45);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    }

    for (var k = 0; k < count; k++) {
      var ang = phase + (k / count) * TAU;
      var pt = evalPt(ang);
      if (pass === 'front' && pt.z < 0) continue;
      if (pass === 'back' && pt.z >= 0) continue;
      var dNorm = (pt.z + 1) * 0.5;
      var col = motesPalette[k % motesPalette.length];
      var prev = pt;
      for (var st = 1; st <= trailSteps; st++) {
        var frac = st / trailSteps;
        var tp = evalPt(ang - dir * frac * trailArc);
        if (pass === 'front' && tp.z < -0.08) break;
        if (pass === 'back' && tp.z > 0.08) break;
        ctx.strokeStyle = col;
        ctx.globalAlpha = clamp(alpha * (1 - frac) * (pt.z >= 0 ? 0.82 : 0.36), 0, 1);
        ctx.lineWidth = Math.max(0.9, (pt.z >= 0 ? 2.8 : 1.4) * (1 - frac * 0.7));
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        prev = tp;
      }
      var isStar = k % 3 === 0;
      var mSize = (isStar ? 4.4 : 3.0) * (0.64 + dNorm * 0.62);
      if (pt.z >= 0 && isStar) {
        drawRadialGlow(ctx, pt.x, pt.y, mSize * 3.1, '#FFFFFF', col, 'rgba(56,189,248,0)', alpha * 0.48);
      }
      drawCrystalMote(ctx, pt.x, pt.y, mSize, col, isStar, alpha * (pt.z >= 0 ? 0.98 : 0.52), 0);
    }
    ctx.restore();
  }

  /** 立体透光多面体冰棱晶（4 面立体着色 + 虹彩折射面 + 内部扫光 + 纯白锋利棱脊） */
  function drawPolyCrystal(ctx, x, y, len, halfW, angle, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01 || len <= 1 || halfW <= 0.5) return;
    var anchorRatio = o.anchorRatio === undefined ? 0.28 : o.anchorRatio;
    var backLen = len * anchorRatio;
    var tipLen = len * (1 - anchorRatio);
    var shoulder = len * (o.shoulderRatio || 0.24);
    var isGoldTint = !!o.goldTint;
    var shimmer = o.shimmer || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (o.glow !== false) {
      drawRadialGlow(ctx, tipLen * 0.32, 0, Math.max(len * 0.56, halfW * 2.4),
        'rgba(255,255,255,0.68)',
        isGoldTint ? 'rgba(245,158,11,0.36)' : 'rgba(37,99,235,0.34)',
        'rgba(56,189,248,0)', alpha * 0.85);
    }

    var pTip = { x: tipLen, y: 0 };
    var pTail = { x: -backLen, y: 0 };
    var pTopF = { x: shoulder, y: -halfW };
    var pBotF = { x: shoulder, y: halfW };
    var pTopB = { x: -backLen * 0.45, y: -halfW * 0.72 };
    var pBotB = { x: -backLen * 0.45, y: halfW * 0.72 };
    var pMid = { x: shoulder * 0.72, y: -halfW * 0.12 };

    ctx.globalAlpha = clamp(alpha * 0.95, 0, 1);
    ctx.beginPath();
    ctx.moveTo(pTip.x, pTip.y);
    ctx.lineTo(pTopF.x, pTopF.y);
    ctx.lineTo(pTopB.x, pTopB.y);
    ctx.lineTo(pTail.x, pTail.y);
    ctx.lineTo(pBotB.x, pBotB.y);
    ctx.lineTo(pBotF.x, pBotF.y);
    ctx.closePath();

    var bodyGrad = ctx.createLinearGradient(pTail.x, -halfW, pTip.x, halfW);
    if (isGoldTint) {
      bodyGrad.addColorStop(0, '#1E40AF');
      bodyGrad.addColorStop(0.38, '#38BDF8');
      bodyGrad.addColorStop(0.75, '#FEF08A');
      bodyGrad.addColorStop(1, '#FFFFFF');
    } else {
      bodyGrad.addColorStop(0, '#1D4ED8');
      bodyGrad.addColorStop(0.42, '#2563EB');
      bodyGrad.addColorStop(0.78, '#38BDF8');
      bodyGrad.addColorStop(1, '#E0F2FE');
    }
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 向光冰透面
    var litGrad = ctx.createLinearGradient(pTopF.x, -halfW, pTip.x, 0);
    litGrad.addColorStop(0, isGoldTint ? '#FEF9C3' : '#BAE6FD');
    litGrad.addColorStop(0.55, '#E0F7FF');
    litGrad.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = litGrad;
    ctx.globalAlpha = clamp(alpha * 0.93, 0, 1);
    ctx.beginPath();
    ctx.moveTo(pTip.x, pTip.y);
    ctx.lineTo(pTopF.x, pTopF.y);
    ctx.lineTo(pTopB.x, pTopB.y);
    ctx.lineTo(pMid.x, pMid.y);
    ctx.closePath();
    ctx.fill();

    // 背光皇家蓝折光面
    var darkGrad = ctx.createLinearGradient(pMid.x, 0, pBotF.x, halfW);
    darkGrad.addColorStop(0, '#2563EB');
    darkGrad.addColorStop(0.6, '#1D4ED8');
    darkGrad.addColorStop(1, '#0F2D8A');
    ctx.fillStyle = darkGrad;
    ctx.globalAlpha = clamp(alpha * 0.82, 0, 1);
    ctx.beginPath();
    ctx.moveTo(pTip.x, pTip.y);
    ctx.lineTo(pMid.x, pMid.y);
    ctx.lineTo(pBotB.x, pBotB.y);
    ctx.lineTo(pBotF.x, pBotF.y);
    ctx.closePath();
    ctx.fill();

    // 虹彩色散切面
    ctx.globalAlpha = clamp(alpha * (0.48 + 0.16 * Math.sin(shimmer)), 0, 1);
    ctx.fillStyle = isGoldTint ? '#FDE047' : '#818CF8';
    ctx.beginPath();
    ctx.moveTo(pMid.x, pMid.y);
    ctx.lineTo(pTail.x, pTail.y);
    ctx.lineTo(pBotB.x, pBotB.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#67E8F9';
    ctx.globalAlpha = clamp(alpha * 0.56, 0, 1);
    ctx.beginPath();
    ctx.moveTo(pTip.x * 0.78, 0);
    ctx.lineTo(pTopF.x * 0.82, -halfW * 0.42);
    ctx.lineTo(pMid.x * 0.5, 0);
    ctx.lineTo(pBotF.x * 0.72, halfW * 0.36);
    ctx.closePath();
    ctx.fill();

    // 内部透光斜反光带
    ctx.globalAlpha = clamp(alpha * 0.72, 0, 1);
    ctx.fillStyle = '#FFFFFF';
    var bandX = lerp(-backLen * 0.2, tipLen * 0.55, 0.5 + 0.35 * Math.sin(shimmer));
    ctx.beginPath();
    ctx.moveTo(bandX - halfW * 0.3, -halfW * 0.65);
    ctx.lineTo(bandX + halfW * 0.32, -halfW * 0.65);
    ctx.lineTo(bandX - halfW * 0.15, halfW * 0.6);
    ctx.lineTo(bandX - halfW * 0.68, halfW * 0.6);
    ctx.closePath();
    ctx.fill();

    // 锐利外轮廓
    ctx.globalAlpha = clamp(alpha * 0.95, 0, 1);
    ctx.strokeStyle = isGoldTint ? '#B45309' : '#1E3A8A';
    ctx.lineWidth = o.outlineWidth || 1.35;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(pTip.x, pTip.y);
    ctx.lineTo(pTopF.x, pTopF.y);
    ctx.lineTo(pTopB.x, pTopB.y);
    ctx.lineTo(pTail.x, pTail.y);
    ctx.lineTo(pBotB.x, pBotB.y);
    ctx.lineTo(pBotF.x, pBotF.y);
    ctx.closePath();
    ctx.stroke();

    // 纯白镜面晶脊
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1.15, halfW * 0.15);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pTail.x * 0.78, 0);
    ctx.lineTo(pMid.x, pMid.y);
    ctx.lineTo(pTip.x, pTip.y);
    ctx.stroke();

    ctx.strokeStyle = isGoldTint ? '#FEF08A' : '#E0F7FF';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(pTopF.x, pTopF.y);
    ctx.lineTo(pMid.x, pMid.y);
    ctx.lineTo(pBotF.x, pBotF.y);
    ctx.stroke();

    ctx.restore();
  }

  /** 60fps 连续网格赛璐璐流光带（零圆点断层，丝滑渐细） */
  function drawCelRibbon(ctx, points, widthFn, opts) {
    if (!points || points.length < 2) return;
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01) return;

    var n = points.length;
    var normals = new Array(n);
    for (var i = 0; i < n; i++) {
      var prev = points[i > 0 ? i - 1 : i];
      var next = points[i < n - 1 ? i + 1 : i];
      var dx = next.x - prev.x;
      var dy = next.y - prev.y;
      var d = Math.hypot(dx, dy) || 1;
      normals[i] = { x: -dy / d, y: dx / d };
    }

    function fillBand(scaleW, shiftN, style, bandAlpha) {
      if (bandAlpha <= 0.008) return;
      ctx.save();
      ctx.globalAlpha = clamp(bandAlpha, 0, 1);
      ctx.fillStyle = style;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var u = i / (n - 1);
        var w = Math.max(0, widthFn(u) * scaleW);
        var px = points[i].x + normals[i].x * (w + shiftN);
        var py = points[i].y + normals[i].y * (w + shiftN);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (var j = n - 1; j >= 0; j--) {
        var u2 = j / (n - 1);
        var w2 = Math.max(0, widthFn(u2) * scaleW);
        var qx = points[j].x + normals[j].x * (-w2 + shiftN);
        var qy = points[j].y + normals[j].y * (-w2 + shiftN);
        ctx.lineTo(qx, qy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    var pStart = points[0];
    var pEnd = points[n - 1];
    var mainGrad = ctx.createLinearGradient(pStart.x, pStart.y, pEnd.x, pEnd.y);
    mainGrad.addColorStop(0, o.tailColor || 'rgba(37, 99, 235, 0.14)');
    mainGrad.addColorStop(0.4, o.midColor || '#38BDF8');
    mainGrad.addColorStop(0.85, o.headColor || '#7DD3FC');
    mainGrad.addColorStop(1, o.tipColor || '#FFFFFF');

    var outerGrad = ctx.createLinearGradient(pStart.x, pStart.y, pEnd.x, pEnd.y);
    outerGrad.addColorStop(0, o.outerTail || 'rgba(29, 78, 216, 0.06)');
    outerGrad.addColorStop(0.35, o.outerColor || '#1D4ED8');
    outerGrad.addColorStop(1, o.outerHead || '#2563EB');

    fillBand(1.24, 0, outerGrad, alpha * (o.outerAlpha === undefined ? 0.85 : o.outerAlpha));

    if (o.prismColor) {
      fillBand(0.7, o.prismShift || 3.0, o.prismColor, alpha * 0.62);
    }

    fillBand(0.94, 0, mainGrad, alpha * (o.mainAlpha === undefined ? 0.94 : o.mainAlpha));

    var coreScale = o.coreScale === undefined ? 0.40 : o.coreScale;
    if (coreScale > 0) {
      fillBand(coreScale, -(o.coreShift || 0.8), o.coreColor || '#FFFFFF', alpha * (o.coreAlpha === undefined ? 0.96 : o.coreAlpha));
    }
  }

  /** 招牌日系赛璐璐大弧月牙斩击（宽锋渐细甩尾） */
  function drawCrescentSlash(ctx, cx, cy, rx, ry, rot, startAng, endAng, thickness, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    var headT = o.headT === undefined ? 1 : clamp(o.headT, 0, 1);
    var tailT = o.tailT === undefined ? 0 : clamp(o.tailT, 0, headT);
    if (alpha <= 0.01 || headT - tailT <= 0.015) return;

    var steps = 42;
    var outerPts = [];
    var innerPts = [];
    var coreOuter = [];
    var coreInner = [];
    var prismOuter = [];
    var prismInner = [];

    for (var i = 0; i <= steps; i++) {
      var frac = i / steps;
      var u = lerp(tailT, headT, frac);
      var ang = lerp(startAng, endAng, u);
      var profile = Math.pow(Math.sin(frac * PI), 0.7) * (0.34 + 0.66 * Math.pow(frac, 0.45));
      var w = thickness * profile;
      var ca = Math.cos(ang), sa = Math.sin(ang);

      outerPts.push({ x: ca * (rx + w * 0.34), y: sa * (ry + w * 0.34) });
      innerPts.push({ x: ca * Math.max(4, rx - w * 0.82), y: sa * Math.max(4, ry - w * 0.82) });

      prismOuter.push({ x: ca * (rx + w * 0.48), y: sa * (ry + w * 0.48) });
      prismInner.push({ x: ca * (rx + w * 0.04), y: sa * (ry + w * 0.04) });

      coreOuter.push({ x: ca * (rx + w * 0.24), y: sa * (ry + w * 0.24) });
      coreInner.push({ x: ca * Math.max(4, rx - w * 0.22), y: sa * Math.max(4, ry - w * 0.22) });
    }

    function fillLoop(aPts, bPts, style, aVal) {
      if (aVal <= 0.008) return;
      ctx.save();
      ctx.globalAlpha = clamp(aVal, 0, 1);
      ctx.fillStyle = style;
      ctx.beginPath();
      for (var i = 0; i < aPts.length; i++) {
        if (i === 0) ctx.moveTo(aPts[i].x, aPts[i].y);
        else ctx.lineTo(aPts[i].x, aPts[i].y);
      }
      for (var j = bPts.length - 1; j >= 0; j--) {
        ctx.lineTo(bPts[j].x, bPts[j].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot || 0);

    var pTail = outerPts[0];
    var pHead = outerPts[outerPts.length - 1];

    var rimGrad = ctx.createLinearGradient(pTail.x, pTail.y, pHead.x, pHead.y);
    rimGrad.addColorStop(0, o.rimTail || 'rgba(29, 78, 216, 0.08)');
    rimGrad.addColorStop(0.35, o.rimColor || '#1D4ED8');
    rimGrad.addColorStop(1, o.rimHead || '#2563EB');

    var bgOuter = outerPts.map(function (p) { return { x: p.x * 1.045, y: p.y * 1.045 }; });
    var bgInner = innerPts.map(function (p) { return { x: p.x * 0.94, y: p.y * 0.94 }; });
    fillLoop(bgOuter, bgInner, rimGrad, alpha * 0.88);

    if (o.prismColor) {
      fillLoop(prismOuter, prismInner, o.prismColor, alpha * 0.78);
    }

    var mainGrad = ctx.createLinearGradient(pTail.x, pTail.y, pHead.x, pHead.y);
    mainGrad.addColorStop(0, o.tailColor || 'rgba(56, 189, 248, 0.14)');
    mainGrad.addColorStop(0.42, o.midColor || '#38BDF8');
    mainGrad.addColorStop(0.84, o.headColor || '#7DD3FC');
    mainGrad.addColorStop(1, '#FFFFFF');
    fillLoop(outerPts, innerPts, mainGrad, alpha * 0.96);

    fillLoop(coreOuter, coreInner, o.coreColor || '#FFFFFF', alpha);

    ctx.strokeStyle = o.accentLineColor || '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = clamp(alpha * 0.86, 0, 1);
    ctx.beginPath();
    for (var s = 2; s < outerPts.length; s++) {
      var sp = outerPts[s];
      if (s === 2) ctx.moveTo(sp.x * 1.08, sp.y * 1.08);
      else ctx.lineTo(sp.x * 1.08, sp.y * 1.08);
    }
    ctx.stroke();

    if (headT > 0.22 && headT < 0.98) {
      drawCrystalMote(ctx, pHead.x, pHead.y, Math.max(4, thickness * 0.34), '#FFFFFF', true, alpha * 0.95, 0.4);
    }

    ctx.restore();
  }

  /** 闪耀冰雷电弧 */
  function drawIceLightningArc(ctx, x0, y0, x1, y1, jitter, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01) return;
    var segs = o.segs || 8;
    var rng = createRng((o.seed || 1337) | 0);
    var outerCol = o.outerColor || '#2563EB';
    var midCol = o.midColor || '#7DD3FC';
    var coreCol = o.coreColor || '#FFFFFF';
    var lw = o.lineWidth || 2.1;

    var dx = x1 - x0, dy = y1 - y0;
    var dist = Math.hypot(dx, dy) || 1;
    var nx = -dy / dist, ny = dx / dist;
    var pts = [{ x: x0, y: y0 }];
    for (var i = 1; i < segs; i++) {
      var u = i / segs;
      var env = Math.sin(u * PI);
      var off = (rng() * 2 - 1) * jitter * env;
      pts.push({ x: lerp(x0, x1, u) + nx * off, y: lerp(y0, y1, u) + ny * off });
    }
    pts.push({ x: x1, y: y1 });

    var strokePts = function (col, w, a) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.beginPath();
      for (var k = 0; k < pts.length; k++) {
        if (k === 0) ctx.moveTo(pts[k].x, pts[k].y);
        else ctx.lineTo(pts[k].x, pts[k].y);
      }
      ctx.stroke();
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    strokePts(outerCol, lw * 2.4, alpha * 0.56);
    strokePts(midCol, lw * 1.3, alpha * 0.94);
    strokePts(coreCol, Math.max(0.9, lw * 0.52), alpha);
    ctx.restore();
  }

  /** 发光六瓣星霜冰花 */
  function drawSnowBlossom(ctx, x, y, r, rot, opts) {
    var o = opts || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.01 || r <= 1.2) return;
    var rimCol = o.rimColor || '#2563EB';
    var mainCol = o.mainColor || '#7DD3FC';
    var coreCol = o.coreColor || '#FFFFFF';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);

    drawRadialGlow(ctx, 0, 0, r * 1.45, 'rgba(255,255,255,0.78)', 'rgba(56,189,248,0.34)', 'rgba(56,189,248,0)', alpha);

    var drawArms = function (col, lw, scale) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * TAU;
        var ca = Math.cos(a), sa = Math.sin(a);
        var len = r * scale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(ca * len, sa * len);
        var bx = ca * len * 0.58, by = sa * len * 0.58;
        var bl = len * 0.34;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 0.65) * bl, by + Math.sin(a + 0.65) * bl);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a - 0.65) * bl, by + Math.sin(a - 0.65) * bl);
        ctx.stroke();
      }
    };

    ctx.globalAlpha = clamp(alpha * 0.86, 0, 1);
    drawArms(rimCol, Math.max(2.2, r * 0.16), 1.05);
    ctx.globalAlpha = clamp(alpha * 0.96, 0, 1);
    drawArms(mainCol, Math.max(1.4, r * 0.10), 1.0);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    drawArms(coreCol, Math.max(0.8, r * 0.055), 0.92);

    ctx.fillStyle = coreCol;
    ctx.beginPath();
    for (var j = 0; j < 6; j++) {
      var ha = (j / 6) * TAU;
      var hx = Math.cos(ha) * r * 0.24;
      var hy = Math.sin(ha) * r * 0.24;
      if (j === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================================
     4. 粒子系统
     ========================================================================== */
  function spawnBurstParticles(list, rng, x, y, count, cfg) {
    var c = cfg || {};
    var kind = c.kind || 'prismShard';
    var speedMin = c.speedMin || 60;
    var speedMax = c.speedMax || 220;
    var angMin = c.angMin === undefined ? 0 : c.angMin;
    var angMax = c.angMax === undefined ? TAU : c.angMax;
    var colors = c.colors || ['#FFFFFF', '#7DD3FC', '#38BDF8', '#2563EB'];

    for (var i = 0; i < count; i++) {
      var ang = lerp(angMin, angMax, rng());
      var spd = lerp(speedMin, speedMax, Math.pow(rng(), 0.72));
      var life = lerp(c.lifeMin || 360, c.lifeMax || 720, rng());
      list.push({
        kind: kind,
        x: x + (rng() - 0.5) * (c.spreadX || 14),
        y: y + (rng() - 0.5) * (c.spreadY || 14),
        vx: Math.cos(ang) * spd + (c.biasVx || 0),
        vy: Math.sin(ang) * spd + (c.biasVy || 0),
        gravity: c.gravity === undefined ? 180 : c.gravity,
        drag: c.drag === undefined ? 0.96 : c.drag,
        size: lerp(c.sizeMin || 4, c.sizeMax || 11, rng()),
        rot: rng() * TAU,
        vrot: (rng() - 0.5) * (c.vrot || 11),
        spin3d: rng() * TAU,
        vspin3d: lerp(6, 15, rng()) * (rng() < 0.5 ? 1 : -1),
        age: 0,
        maxAge: life,
        color: colors[i % colors.length],
        rimColor: c.rimColor || '#1D4ED8',
        gold: !!c.gold || (c.goldRatio && rng() < c.goldRatio)
      });
    }
  }

  function updateParticles(list, dtSec) {
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.age += dtSec * 1000;
      if (p.age >= p.maxAge) {
        list.splice(i, 1);
        continue;
      }
      var damp = Math.pow(p.drag, dtSec * 60);
      p.vx *= damp;
      p.vy = p.vy * damp + p.gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.rot += p.vrot * dtSec;
      p.spin3d += p.vspin3d * dtSec;
    }
  }

  function renderParticles(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var u = clamp(p.age / p.maxAge, 0, 1);
      var fade = u < 0.1 ? u / 0.1 : (1 - Math.pow((u - 0.1) / 0.9, 1.55));
      if (fade <= 0.01) continue;

      if (p.kind === 'prismShard') {
        var flip = Math.cos(p.spin3d);
        var w = Math.max(1.6, p.size * 0.5 * (0.30 + 0.70 * Math.abs(flip)));
        var len = p.size * (1.28 + 0.25 * (1 - u));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = clamp(fade, 0, 1);

        ctx.beginPath();
        ctx.moveTo(len * 0.66, 0);
        ctx.lineTo(0, -w);
        ctx.lineTo(-len * 0.56, 0);
        ctx.lineTo(0, w);
        ctx.closePath();
        ctx.fillStyle = flip > 0.35 ? '#FFFFFF' : (p.gold ? '#FEF08A' : p.color);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(len * 0.66, 0);
        ctx.lineTo(-len * 0.56, 0);
        ctx.lineTo(0, w);
        ctx.closePath();
        ctx.fillStyle = p.gold ? '#F59E0B' : (flip < 0 ? '#818CF8' : '#2563EB');
        ctx.globalAlpha = clamp(fade * 0.65, 0, 1);
        ctx.fill();

        ctx.globalAlpha = clamp(fade * 0.9, 0, 1);
        ctx.strokeStyle = p.gold ? '#B45309' : p.rimColor;
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(len * 0.66, 0);
        ctx.lineTo(0, -w);
        ctx.lineTo(-len * 0.56, 0);
        ctx.lineTo(0, w);
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(-len * 0.36, 0);
        ctx.lineTo(len * 0.56, 0);
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'sparkStreak') {
        var spd = Math.hypot(p.vx, p.vy);
        var ang = Math.atan2(p.vy, p.vx);
        var tail = clamp(spd * 0.08, 8, 38) * (1 - u * 0.3);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.globalAlpha = clamp(fade * 0.92, 0, 1);
        ctx.fillStyle = p.gold ? '#B45309' : p.rimColor;
        ctx.beginPath();
        ctx.moveTo(p.size * 0.55, 0);
        ctx.lineTo(-tail, -p.size * 0.25);
        ctx.lineTo(-tail * 0.65, 0);
        ctx.lineTo(-tail, p.size * 0.25);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.gold ? '#FEF08A' : p.color;
        ctx.beginPath();
        ctx.moveTo(p.size * 0.48, 0);
        ctx.lineTo(-tail * 0.85, -p.size * 0.14);
        ctx.lineTo(-tail * 0.85, p.size * 0.14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1.3, p.size * 0.2), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'waterDrop') {
        var angW = Math.atan2(p.vy, p.vx);
        var stretch = clamp(Math.hypot(p.vx, p.vy) * 0.017, 1.1, 2.8);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angW);
        ctx.globalAlpha = clamp(fade * 0.94, 0, 1);
        ctx.fillStyle = '#0369A1';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * stretch * 0.66, p.size * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0.5, -0.4, p.size * stretch * 0.50, p.size * 0.29, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.size * 0.22, -p.size * 0.12, Math.max(0.95, p.size * 0.17), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'snowBlossom') {
        drawSnowBlossom(ctx, p.x, p.y, p.size * (0.78 + 0.22 * Math.sin(p.spin3d)), p.rot, {
          alpha: fade * 0.96,
          rimColor: p.gold ? '#D97706' : '#2563EB',
          mainColor: p.gold ? '#FEF08A' : '#7DD3FC',
          coreColor: '#FFFFFF'
        });
      } else if (p.kind === 'windPetal') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 0.46 + 0.54 * Math.abs(Math.cos(p.spin3d)));
        ctx.globalAlpha = clamp(fade * 0.95, 0, 1);
        var s = p.size;
        ctx.fillStyle = p.gold ? '#D97706' : '#0F766E';
        ctx.beginPath();
        ctx.moveTo(s * 1.2, 0);
        ctx.quadraticCurveTo(0, -s * 0.64, -s * 1.05, 0.14 * s);
        ctx.quadraticCurveTo(0, -s * 0.12, s * 1.2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.gold ? '#FEF08A' : p.color;
        ctx.beginPath();
        ctx.moveTo(s * 1.04, 0);
        ctx.quadraticCurveTo(0, -s * 0.45, -s * 0.88, 0.06 * s);
        ctx.quadraticCurveTo(0, -s * 0.08, s * 1.04, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(s * 0.22, -s * 0.15, Math.max(1.1, s * 0.15), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'pixelDust') {
        drawPixelSparkle(ctx, p.x, p.y, p.size, p.gold ? '#FEF08A' : p.color, fade, (p.spin3d | 0) % 2 === 0);
      } else {
        drawCrystalMote(ctx, p.x, p.y, p.size * 0.55, p.gold ? '#FEF08A' : p.color, true, fade, p.rot);
      }
    }
  }

  /* ==========================================================================
     5. 增幅三阶 3D 棱镜折射叠层（ampTier: 0 | 1 | 2 | 3）
     100% 血脉同源于 combat_p5_opt2_prism_radial.html 的前/后景立体星轨！
     ========================================================================== */
  function renderAmpOverlay(ctx, inst, pass) {
    var tier = inst.ampTier;
    if (tier <= 0) return;

    var tNorm = clamp(inst.elapsed / inst.durationMs, 0, 1);
    var tSec = inst.elapsed * 0.001;
    var caster = inst.heroCenter;
    var target = inst.to;
    var isSelf = inst.spec.targetMode === 'self';

    // 主角侧 3D 倾斜棱镜轨环（三阶逐层叠加，血脉直连 3D 棱镜增幅环）
    var castFade = tNorm < 0.08 ? (tNorm / 0.08) : (tNorm > 0.66 ? 1 - remap(tNorm, 0.66, 0.92) : 1);
    if (castFade > 0.02) {
      var scaleIn = 0.68 + 0.32 * EASE.outBack(clamp(tNorm / 0.16, 0, 1));
      // ★ 一阶：冰青棱镜轨环
      draw3DOrbitRibbon(ctx, caster.x, caster.y + 4, 58 * scaleIn, 17 * scaleIn, 0.27, tSec * 3.1, {
        pass: pass, alpha: castFade * 0.94, count: 10, trailSteps: 6, trailArc: 0.40, dir: 1,
        ribbonOuter: '#1D4ED8', ribbonMain: '#38BDF8', ribbonCore: '#FFFFFF',
        palette: ['#FFFFFF', '#7DD3FC', '#38BDF8'], lineWidth: 2.0
      });
      // ★★ 二阶：反向皇家蓝立体轨环
      if (tier >= 2) {
        draw3DOrbitRibbon(ctx, caster.x, caster.y - 4, 68 * scaleIn, 21 * scaleIn, -0.32, -tSec * 2.7 + 1.1, {
          pass: pass, alpha: castFade * 0.96, count: 10, trailSteps: 7, trailArc: 0.44, dir: -1,
          ribbonOuter: '#1E3A8A', ribbonMain: '#2563EB', ribbonCore: '#BAE6FD',
          palette: ['#FFFFFF', '#60A5FA', '#38BDF8'], lineWidth: 2.1
        });
      }
      // ★★★ 三阶：香槟金星霜极限第三环 + 上升金青晶尘
      if (tier >= 3) {
        draw3DOrbitRibbon(ctx, caster.x, caster.y - 11, 78 * scaleIn, 24 * scaleIn, 0.17, tSec * 3.7 + 2.2, {
          pass: pass, alpha: castFade, count: 12, trailSteps: 8, trailArc: 0.48, dir: 1,
          ribbonOuter: '#B45309', ribbonMain: '#FEF08A', ribbonCore: '#FFFFFF',
          palette: ['#FFFFFF', '#FEF08A', '#F59E0B', '#7DD3FC'], lineWidth: 2.3
        });
        if (pass === 'front') {
          for (var dm = 0; dm < 8; dm++) {
            var prog = (tSec * 0.9 + dm / 8) % 1;
            var dAng = tSec * 2.2 + dm * 1.9;
            var mx = caster.x + Math.cos(dAng) * (42 + (dm % 3) * 14);
            var my = inst.groundY - 6 - prog * 116;
            drawCrystalMote(ctx, mx, my, 2.8, dm % 2 === 0 ? '#FEF08A' : '#FFFFFF', dm % 3 === 0, castFade * Math.sin(prog * PI) * 0.92, 0);
          }
        }
      }
    }

    // 命中端增幅叠层（干净立体，不遮挡各招独特剪影！）
    if (!isSelf) {
      var peakNorm = inst.spec.peakMs / inst.durationMs;
      var hitU = remap(tNorm, peakNorm - 0.08, peakNorm + 0.34);
      if (hitU > 0 && hitU < 1) {
        var hitAlpha = hitU < 0.14 ? (hitU / 0.14) : (1 - EASE.inQuad((hitU - 0.14) / 0.86));
        var rExp = EASE.outQuart(hitU);

        // Tier 1+：清透棱镜色散外环（前景绘制）
        if (pass === 'front') {
          draw3DShockwave(ctx, target.x, target.y, 28 + rExp * (62 + tier * 12), 15 + rExp * (30 + tier * 6), -0.22, {
            outerColor: '#1D4ED8', midColor: '#38BDF8', prismColor: '#A78BFA', coreColor: '#FFFFFF',
            lineWidth: 2.1 + tier * 0.45, alpha: hitAlpha * 0.82, ticks: 8 + tier * 2, tickRot: tSec * 1.4
          });
        }

        // Tier 2+：闪耀冰雷电弧环绕命中区
        if (pass === 'front' && tier >= 2 && hitU < 0.78) {
          var boltA = hitAlpha * (1 - hitU * 0.42);
          var fTick = Math.floor(inst.elapsed / 42);
          var nArcs = tier >= 3 ? 4 : 2;
          for (var b = 0; b < nArcs; b++) {
            var ba = b * (TAU / nArcs) + 0.48 + tSec * 0.65;
            var r0 = 20;
            var r1 = 62 + tier * 12;
            drawIceLightningArc(ctx,
              target.x + Math.cos(ba) * r0, target.y + Math.sin(ba) * r0,
              target.x + Math.cos(ba + 0.34) * r1, target.y + Math.sin(ba + 0.34) * r1,
              13, {
                outerColor: tier >= 3 && b % 2 === 1 ? '#B45309' : '#1D4ED8',
                midColor: tier >= 3 && b % 2 === 1 ? '#FEF08A' : '#7DD3FC',
                coreColor: '#FFFFFF',
                lineWidth: 2.0, alpha: boltA * 0.94,
                seed: inst.seed + fTick * 31 + b * 97
              });
          }
        }

        // Tier 3：标志性 3D 香槟金星轨环 + 香槟金星芒精炼点缀（优雅立体，绝不笨重！）
        if (tier >= 3) {
          draw3DOrbitRibbon(ctx, target.x, target.y - 2, 54 + rExp * 46, 20 + rExp * 16, 0.24, tSec * 4.4, {
            pass: pass, alpha: hitAlpha * 0.96, count: 12, trailSteps: 7, trailArc: 0.46, dir: 1,
            ribbonOuter: '#B45309', ribbonMain: '#FEF08A', ribbonCore: '#FFFFFF',
            palette: ['#FFFFFF', '#FEF08A', '#F59E0B', '#7DD3FC'], lineWidth: 2.2
          });
          if (pass === 'front' && hitU < 0.46) {
            var gFlash = hitU < 0.14 ? (hitU / 0.14) : (1 - (hitU - 0.14) / 0.32);
            drawAnimeStarburst(ctx, target.x, target.y - 2, 34 + rExp * 36, 5.5, 8, tSec * 2.0, {
              rimColor: '#B45309', mainColor: '#FEF08A', prismColor: '#38BDF8', coreColor: '#FFFFFF',
              glowMid: 'rgba(245,158,11,0.42)', flareLen: 120 * gFlash, alpha: gFlash * 0.92
            });
          }
        }
      }
    }
  }

  /* ==========================================================================
     6. 九大技能完整动画编舞（精修 10/10 电影级日系动画质感）
     ========================================================================== */
  var HANDLERS = {};

  /* --------------------------------------------------------------------------
     [1] ice_crystal — 冰晶术
     立体倾斜旋转冰蓝魔法圆环 → 高速流线水晶晶矛 → 巨大立体冰晶簇骤凝迸裂出几十片旋转折射棱晶碎片
     -------------------------------------------------------------------------- */
  HANDLERS.ice_crystal = {
    init: function (inst) {
      inst.data = {
        impactFired: false,
        shatterFired: false,
        clusterSpikes: [
          { ang: -PI * 0.52, len: 80, hw: 16, delay: 0.00 },
          { ang: -PI * 0.80, len: 62, hw: 13, delay: 0.015 },
          { ang: -PI * 0.22, len: 66, hw: 13.5, delay: 0.02 },
          { ang:  PI * 0.12, len: 50, hw: 11, delay: 0.035 },
          { ang:  PI * 0.88, len: 52, hw: 11, delay: 0.035 },
          { ang: -PI * 0.66, len: 58, hw: 12, delay: 0.025 }
        ]
      };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var to = inst.to;
      if (!inst.data.impactFired && t >= 445) {
        inst.data.impactFired = true;
        inst.triggerImpact(0, to.x, to.y, 0.55 + inst.ampTier * 0.14);
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y, 16 + inst.ampTier * 4, {
          kind: 'pixelDust', speedMin: 55, speedMax: 190, sizeMin: 2, sizeMax: 4,
          lifeMin: 300, lifeMax: 580, gravity: -30, colors: ['#FFFFFF', '#7DD3FC', '#38BDF8'],
          goldRatio: inst.ampTier >= 3 ? 0.35 : 0
        });
      }
      if (!inst.data.shatterFired && t >= 490) {
        inst.data.shatterFired = true;
        inst.triggerShake(0.70 + inst.ampTier * 0.14);
        // 40+ 片大体积旋转折射棱晶碎片凌厉迸裂！
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y - 6, 40 + inst.ampTier * 10, {
          kind: 'prismShard', speedMin: 95, speedMax: 330, sizeMin: 6.0, sizeMax: 14.5,
          lifeMin: 440, lifeMax: 720, gravity: 190, drag: 0.962, vrot: 13,
          colors: ['#FFFFFF', '#BAE6FD', '#7DD3FC', '#38BDF8', '#C4B5FD'],
          rimColor: '#1D4ED8', goldRatio: inst.ampTier >= 3 ? 0.34 : 0.10
        });
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y - 4, 18 + inst.ampTier * 5, {
          kind: 'mote', speedMin: 65, speedMax: 230, sizeMin: 4.5, sizeMax: 9.5,
          lifeMin: 420, lifeMax: 680, gravity: -45, drag: 0.95,
          colors: ['#FFFFFF', '#7DD3FC', '#FEF08A'], goldRatio: inst.ampTier >= 2 ? 0.35 : 0.15
        });
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var from = inst.from;
      var to = inst.to;
      var angFlight = Math.atan2(to.y - from.y, to.x - from.x);

      // 1. 起手：主角身前立体倾斜旋转透明冰蓝魔法圆环（0 ~ 680ms 持续余辉清晰可见！）
      var ringU = remap(t, 0, 680);
      if (ringU > 0 && ringU < 1) {
        var rPop = EASE.outBack(clamp(t / 160, 0, 1));
        var rFade = t < 470 ? 1 : (1 - remap(t, 470, 680));
        var ringX = from.x + Math.cos(angFlight) * 16;
        var ringY = from.y + Math.sin(angFlight) * 16;
        draw3DMagicCircle(ctx, ringX, ringY, 18 * rPop, 48 * rPop, angFlight, t * 0.0046, {
          alpha: rFade * 0.98, sides: 6, nodes: 6, lineWidth: 2.5,
          outerColor: '#1D4ED8', mainColor: '#38BDF8', coreColor: '#FFFFFF'
        });
        if (t < 240) {
          var gather = 1 - EASE.outCubic(t / 240);
          for (var g = 0; g < 8; g++) {
            var ga = (g / 8) * TAU + t * 0.008;
            drawCrystalMote(ctx, ringX + Math.cos(ga) * (18 + gather * 44), ringY + Math.sin(ga) * (24 + gather * 56),
              3.4 * (1 - gather * 0.4), g % 2 === 0 ? '#FFFFFF' : '#7DD3FC', g % 3 === 0, (1 - gather) * 0.92, ga);
          }
        }
      }

      // 2. 高速流线型水晶晶矛 + 丝滑冰青/白金速度尾流（165 ~ 660ms）
      var flyU = remap(t, 165, 455);
      var trailFade = 1 - remap(t, 475, 670);
      if (t >= 165 && trailFade > 0.01) {
        var headP = EASE.inOutCubic(Math.min(1, flyU * 1.06));
        var tailP = Math.max(0, headP - 0.74);
        var pts = [];
        for (var i = 0; i <= 28; i++) {
          var u = lerp(tailP, headP, i / 28);
          pts.push({
            x: lerp(from.x + 12, to.x, u),
            y: lerp(from.y, to.y, u) - Math.sin(u * PI) * 10
          });
        }
        drawCelRibbon(ctx, pts, function (u) {
          return (2.8 + 12.0 * Math.pow(u, 1.3)) * (1 - Math.max(0, u - 0.92) * 5);
        }, {
          alpha: trailFade * 0.96,
          outerColor: '#1D4ED8', midColor: '#38BDF8', headColor: '#BAE6FD',
          prismColor: '#FEF08A', prismShift: 3.4, coreColor: '#FFFFFF'
        });

        for (var sl = -1; sl <= 1; sl += 2) {
          var sPts = pts.map(function (pt, idx) {
            var u = idx / (pts.length - 1);
            var wave = Math.sin(u * PI * 2.5 + t * 0.03 + sl) * 8 * u;
            return { x: pt.x, y: pt.y + sl * (8 + 5 * u) + wave * 0.45 };
          });
          drawCelRibbon(ctx, sPts, function (u) { return 2.5 * Math.sin(u * PI); }, {
            alpha: trailFade * 0.82,
            outerColor: '#2563EB', midColor: '#7DD3FC', headColor: '#FEF08A', coreColor: '#FFFFFF'
          });
        }

        if (flyU < 1.02) {
          var cur = pts[pts.length - 1];
          drawPolyCrystal(ctx, cur.x, cur.y, 68, 14, angFlight, {
            anchorRatio: 0.42, alpha: 1, shimmer: t * 0.02, goldTint: inst.ampTier >= 3
          });
          if (flyU > 0.12) {
            draw3DShockwave(ctx, cur.x - Math.cos(angFlight) * 14, cur.y - Math.sin(angFlight) * 14, 10, 26, angFlight, {
              outerColor: '#1D4ED8', midColor: '#7DD3FC', coreColor: '#FFFFFF', lineWidth: 2.1, alpha: 0.88
            });
          }
        }
      }

      // 3. 命中爆发：巨大立体透光冰晶簇骤凝迸裂 + 清爽冲击波环（440 ~ 920ms）
      if (t >= 440) {
        var hitMs = t - 440;
        var swU = remap(hitMs, 0, 400);
        if (swU < 1) {
          var swEase = EASE.outQuart(swU);
          var swAlpha = 1 - EASE.inQuad(swU);
          draw3DShockwave(ctx, to.x, to.y, 20 + swEase * 92, 13 + swEase * 48, -0.18, {
            outerColor: '#1D4ED8', midColor: '#38BDF8', prismColor: '#FEF08A', coreColor: '#FFFFFF',
            lineWidth: 4.2 * (1 - swU * 0.55), alpha: swAlpha, fillAlpha: 0.16 * (1 - swU), ticks: 12, tickRot: hitMs * 0.002
          });
          draw3DShockwave(ctx, to.x, inst.groundY, 18 + swEase * 78, 6 + swEase * 20, 0, {
            outerColor: '#1D4ED8', midColor: '#7DD3FC', coreColor: '#FFFFFF',
            lineWidth: 2.5 * (1 - swU * 0.5), alpha: swAlpha * 0.88
          });
        }

        var spikes = inst.data.clusterSpikes;
        var shatterU = remap(hitMs, 75, 340);
        var clusterAlpha = 1 - EASE.inQuad(shatterU);
        if (clusterAlpha > 0.02) {
          var scaleBoost = 1 + inst.ampTier * 0.1;
          for (var s = 0; s < spikes.length; s++) {
            var sp = spikes[s];
            var grow = EASE.outBack(clamp((hitMs - sp.delay * 1000) / 80, 0, 1));
            var flyOut = EASE.outCubic(shatterU) * (38 + s * 6);
            var sx = to.x + Math.cos(sp.ang) * (5 + flyOut);
            var sy = to.y + 8 + Math.sin(sp.ang) * (5 + flyOut);
            drawPolyCrystal(ctx, sx, sy, sp.len * grow * scaleBoost * (1 - shatterU * 0.22), sp.hw * grow * scaleBoost, sp.ang + shatterU * (s % 2 === 0 ? 0.32 : -0.32), {
              anchorRatio: 0.15, alpha: clusterAlpha * 0.98, shimmer: t * 0.015 + s,
              goldTint: inst.ampTier >= 3 && s % 2 === 0
            });
          }
        }

        var starU = remap(hitMs, 0, 240);
        if (starU < 1) {
          var sPop = starU < 0.22 ? EASE.outQuad(starU / 0.22) : 1 - EASE.inQuad((starU - 0.22) / 0.78);
          drawAnimeStarburst(ctx, to.x, to.y - 4, (58 + inst.ampTier * 8) * (0.45 + 0.65 * sPop), 9.5, 8, hitMs * 0.004, {
            rimColor: '#1D4ED8', mainColor: '#38BDF8', prismColor: '#FEF08A', coreColor: '#FFFFFF',
            flareLen: 128 * sPop, alpha: sPop
          });
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
     [2] tri_prism_ice — 三棱冰晶
     法杖三角棱晶阵 → 三道 S 型丝滑流光弧线依次贯通 → 三连棱镜爆环与星芒连闪
     -------------------------------------------------------------------------- */
  HANDLERS.tri_prism_ice = {
    init: function (inst) {
      var from = inst.from;
      var to = inst.to;
      var dx = to.x - from.x;
      inst.data = {
        arrows: [
          {
            launchMs: 185, hitMs: 535, hitDone: false,
            formAngle: -PI * 0.5,
            c1: { x: from.x + dx * 0.30, y: from.y - 128 },
            c2: { x: from.x + dx * 0.72, y: to.y + 46 },
            impactOff: { x: -16, y: -18 },
            shockRot: -0.32,
            prismCol: '#FEF08A'
          },
          {
            launchMs: 295, hitMs: 650, hitDone: false,
            formAngle: PI * 0.16,
            c1: { x: from.x + dx * 0.32, y: from.y + 98 },
            c2: { x: from.x + dx * 0.68, y: to.y - 96 },
            impactOff: { x: 2, y: -2 },
            shockRot: 0.26,
            prismCol: '#C4B5FD'
          },
          {
            launchMs: 445, hitMs: 840, hitDone: false,
            formAngle: PI * 0.84,
            c1: { x: from.x + dx * 0.24, y: from.y - 72 },
            c2: { x: from.x + dx * 0.72, y: to.y + 88 },
            impactOff: { x: 16, y: 12 },
            shockRot: -0.08,
            prismCol: '#5EEAD4'
          }
        ]
      };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var arr = inst.data.arrows;
      for (var i = 0; i < arr.length; i++) {
        var a = arr[i];
        if (!a.hitDone && t >= a.hitMs) {
          a.hitDone = true;
          var hx = inst.to.x + a.impactOff.x;
          var hy = inst.to.y + a.impactOff.y;
          inst.triggerImpact(i, hx, hy, 0.42 + i * 0.12 + inst.ampTier * 0.1);
          spawnBurstParticles(inst.particles, inst.rng, hx, hy, 18 + inst.ampTier * 4, {
            kind: 'prismShard', speedMin: 70, speedMax: 245, sizeMin: 5.0, sizeMax: 11.5,
            lifeMin: 360, lifeMax: 580, gravity: 145, drag: 0.96,
            colors: ['#FFFFFF', '#7DD3FC', '#38BDF8', a.prismCol],
            goldRatio: inst.ampTier >= 3 ? 0.36 : 0.14
          });
          spawnBurstParticles(inst.particles, inst.rng, hx, hy, 9, {
            kind: 'pixelDust', speedMin: 45, speedMax: 160, sizeMin: 2, sizeMax: 3.5,
            lifeMin: 280, lifeMax: 500, gravity: -30, colors: ['#FFFFFF', '#7DD3FC', '#FEF08A']
          });
        }
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var from = inst.from;
      var to = inst.to;
      var arr = inst.data.arrows;

      // 1. 起手：法杖前三角棱镜法阵（保持清晰至 760ms，呈现起手阵型与三道流光联动！）
      var sealAlpha = t < 110 ? EASE.outCubic(t / 110) : (1 - remap(t, 560, 780));
      if (sealAlpha > 0.01) {
        var sPop = EASE.outBack(clamp(t / 150, 0, 1));
        draw3DMagicCircle(ctx, from.x + 8, from.y, 28 * sPop, 42 * sPop, -0.14, t * 0.0042, {
          alpha: sealAlpha * 0.96, sides: 3, nodes: 3, lineWidth: 2.3,
          outerColor: '#1D4ED8', mainColor: '#38BDF8', coreColor: '#FFFFFF'
        });

        // 三角棱阵连接光丝
        var waitingPts = [];
        for (var w = 0; w < 3; w++) {
          var fa = arr[w].formAngle + Math.min(t, arr[w].launchMs) * 0.005;
          waitingPts.push({
            x: from.x + 8 + Math.cos(fa) * 34 * sPop,
            y: from.y + Math.sin(fa) * 38 * sPop
          });
        }
        ctx.save();
        ctx.globalAlpha = clamp(sealAlpha * 0.72, 0, 1);
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(waitingPts[0].x, waitingPts[0].y);
        ctx.lineTo(waitingPts[1].x, waitingPts[1].y);
        ctx.lineTo(waitingPts[2].x, waitingPts[2].y);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.0;
        ctx.stroke();
        ctx.restore();
      }

      // 2. 三道 S 型丝滑高速流光弧线 & 大体积立体棱晶光矢 & 三连清脆爆环
      for (var i = 0; i < arr.length; i++) {
        var a = arr[i];
        var formAng = a.formAngle + Math.min(t, a.launchMs) * 0.005;
        var p0 = {
          x: from.x + 8 + Math.cos(formAng) * 34,
          y: from.y + Math.sin(formAng) * 38
        };
        var p3 = { x: to.x + a.impactOff.x, y: to.y + a.impactOff.y };

        if (t < a.launchMs) {
          var pop = EASE.outBack(clamp((t - i * 28) / 130, 0, 1));
          if (pop > 0.02) {
            var aim = Math.atan2(p3.y - p0.y, p3.x - p0.x);
            drawPolyCrystal(ctx, p0.x, p0.y, 40 * pop, 9.0 * pop, aim, {
              anchorRatio: 0.45, alpha: pop, shimmer: t * 0.02 + i, goldTint: inst.ampTier >= 3 && i === 1
            });
          }
          continue;
        }

        var flyU = remap(t, a.launchMs, a.hitMs);
        var ribbonFade = 1 - remap(t, a.hitMs + 50, a.hitMs + 320);
        if (ribbonFade > 0.01) {
          var headU = EASE.inOutCubic(Math.min(1, flyU));
          var tailU = Math.max(0, headU - 0.82 + Math.max(0, remap(t, a.hitMs + 20, a.hitMs + 300)) * 0.82);
          if (headU - tailU > 0.02) {
            var pts = [];
            for (var s = 0; s <= 36; s++) {
              var bu = lerp(tailU, headU, s / 36);
              pts.push(cubicBezier(p0, a.c1, a.c2, p3, bu));
            }
            drawCelRibbon(ctx, pts, function (u) {
              return (2.5 + 9.2 * Math.pow(u, 1.15)) * Math.sin(Math.min(1, u * 1.12) * PI * 0.92 + 0.12);
            }, {
              alpha: ribbonFade * 0.96,
              outerColor: '#1D4ED8', midColor: '#38BDF8', headColor: '#BAE6FD',
              prismColor: a.prismCol, prismShift: 3.0, coreColor: '#FFFFFF'
            });
          }

          // 飞行中锐利立体棱晶光矢本体（第 3 矢在 peak=660ms 正高速冲刺清晰可见！）
          if (flyU < 1.0) {
            var cur = cubicBezier(p0, a.c1, a.c2, p3, headU);
            var tang = cubicBezierTangent(p0, a.c1, a.c2, p3, headU);
            drawPolyCrystal(ctx, cur.x, cur.y, 52, 11.2, tang, {
              anchorRatio: 0.44, alpha: 1, shimmer: t * 0.025 + i, goldTint: inst.ampTier >= 3 && i === 2
            });
            drawCrystalMote(ctx, cur.x + Math.cos(tang) * 24, cur.y + Math.sin(tang) * 24, 4.8, '#FFFFFF', true, 0.95, tang);
          }
        }

        // 三连清脆棱镜爆环 + 星芒连闪
        if (t >= a.hitMs) {
          var hMs = t - a.hitMs;
          var hU = remap(hMs, 0, 360);
          if (hU < 1) {
            var rE = EASE.outQuart(hU);
            var hA = 1 - EASE.inQuad(hU);
            draw3DShockwave(ctx, p3.x, p3.y, 16 + rE * (58 + i * 10), 11 + rE * (32 + i * 5), a.shockRot, {
              outerColor: '#1D4ED8', midColor: '#38BDF8', prismColor: a.prismCol, coreColor: '#FFFFFF',
              lineWidth: 3.6 * (1 - hU * 0.5), alpha: hA, fillAlpha: 0.14 * (1 - hU), ticks: 9
            });
            var stU = remap(hMs, 0, 220);
            if (stU < 1) {
              var sP = stU < 0.25 ? EASE.outQuad(stU / 0.25) : 1 - EASE.inQuad((stU - 0.25) / 0.75);
              drawAnimeStarburst(ctx, p3.x, p3.y, (42 + i * 9) * (0.5 + 0.55 * sP), 7.2, 4 + (i >= 1 ? 4 : 0), hMs * 0.005 + i * 0.7, {
                rimColor: '#1D4ED8', mainColor: '#38BDF8', prismColor: a.prismCol, coreColor: '#FFFFFF',
                flareLen: (92 + i * 20) * sP, alpha: sP
              });
            }
          }
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
     [3] starfrost_scatter — 星霜散华（华丽大招）
     立体双层香槟金×冰蓝星轨魔法阵 → 7 枚巨型晶透菱镜棱柱依次高速坠落贯刺 → 巨大星霜雪花冲击波与虹光散华
     -------------------------------------------------------------------------- */
  HANDLERS.starfrost_scatter = {
    init: function (inst) {
      var to = inst.to;
      var gy = inst.groundY;
      var configs = [
        { ox: -84, oy: -4,  tilt:  0.16, spawnMs: 240, dropMs: 430, hitMs: 610, len: 92,  hw: 13.5 },
        { ox:  82, oy: -2,  tilt: -0.16, spawnMs: 270, dropMs: 485, hitMs: 665, len: 94,  hw: 13.5 },
        { ox: -54, oy:  8,  tilt:  0.10, spawnMs: 300, dropMs: 540, hitMs: 720, len: 102, hw: 14.5 },
        { ox:  54, oy:  8,  tilt: -0.10, spawnMs: 330, dropMs: 595, hitMs: 775, len: 102, hw: 14.5 },
        { ox: -28, oy: -12, tilt:  0.05, spawnMs: 360, dropMs: 650, hitMs: 830, len: 108, hw: 15.5 },
        { ox:  28, oy: -12, tilt: -0.05, spawnMs: 390, dropMs: 705, hitMs: 885, len: 108, hw: 15.5 },
        { ox:   0, oy:   0, tilt:  0.00, spawnMs: 430, dropMs: 770, hitMs: 955, len: 136, hw: 20, isMain: true }
      ];
      inst.data = {
        pillars: configs.map(function (c) {
          return {
            ox: c.ox, oy: c.oy, tilt: c.tilt,
            spawnMs: c.spawnMs, dropMs: c.dropMs, hitMs: c.hitMs,
            len: c.len, hw: c.hw, isMain: !!c.isMain,
            hitDone: false,
            tx: to.x + c.ox,
            ty: gy - 12 + c.oy
          };
        }),
        climaxFired: false
      };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var pls = inst.data.pillars;
      for (var i = 0; i < pls.length; i++) {
        var pl = pls[i];
        if (!pl.hitDone && t >= pl.hitMs) {
          pl.hitDone = true;
          inst.triggerImpact(i, pl.tx, pl.ty, pl.isMain ? 0.95 : 0.34);
          spawnBurstParticles(inst.particles, inst.rng, pl.tx, pl.ty, pl.isMain ? 40 : 10, {
            kind: 'prismShard', speedMin: 75, speedMax: pl.isMain ? 330 : 190,
            sizeMin: 5, sizeMax: pl.isMain ? 14.5 : 9.5, lifeMin: 440, lifeMax: 760,
            gravity: 165, drag: 0.962,
            colors: ['#FFFFFF', '#7DD3FC', '#38BDF8', '#FEF08A', '#C4B5FD'],
            goldRatio: pl.isMain ? 0.45 : 0.25
          });
          if (pl.isMain && !inst.data.climaxFired) {
            inst.data.climaxFired = true;
            spawnBurstParticles(inst.particles, inst.rng, inst.to.x, inst.to.y - 12, 24 + inst.ampTier * 6, {
              kind: 'snowBlossom', speedMin: 45, speedMax: 225, sizeMin: 6.5, sizeMax: 14.5,
              lifeMin: 540, lifeMax: 840, gravity: 32, drag: 0.95,
              colors: ['#7DD3FC', '#FFFFFF', '#FEF08A'], goldRatio: 0.42
            });
            spawnBurstParticles(inst.particles, inst.rng, inst.to.x, inst.to.y - 8, 24, {
              kind: 'pixelDust', speedMin: 65, speedMax: 250, sizeMin: 2, sizeMax: 4,
              lifeMin: 420, lifeMax: 720, gravity: -25, colors: ['#FFFFFF', '#FEF08A', '#7DD3FC'], goldRatio: 0.45
            });
          }
        }
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var to = inst.to;
      var gy = inst.groundY;
      var pls = inst.data.pillars;

      // 1. 立体透视双层香槟金×冰蓝星轨魔法阵
      var circleIn = EASE.outBack(clamp(t / 280, 0, 1));
      var circleFade = t < 1180 ? 1 : (1 - remap(t, 1180, 1580));
      if (circleFade > 0.01) {
        draw3DMagicCircle(ctx, to.x, gy - 4, 122 * circleIn, 35 * circleIn, 0, t * 0.0018, {
          alpha: circleFade * 0.96, gold: true, sides: 8, nodes: 8, lineWidth: 2.7, nodeScale: 1.18
        });
        draw3DMagicCircle(ctx, to.x, gy - 6, 86 * circleIn, 24 * circleIn, 0, -t * 0.0032, {
          alpha: circleFade * 0.96, gold: false, sides: 6, nodes: 6, lineWidth: 2.2,
          outerColor: '#1D4ED8', mainColor: '#38BDF8', coreColor: '#FFFFFF'
        });
        if (t > 120 && t < 1160) {
          var colA = circleFade * 0.24 * (t > 950 ? 1.45 : 1);
          var pillarG = ctx.createLinearGradient(to.x, gy, to.x, gy - 220);
          pillarG.addColorStop(0, 'rgba(56, 189, 248, 0.44)');
          pillarG.addColorStop(0.45, 'rgba(254, 240, 138, 0.25)');
          pillarG.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.save();
          ctx.globalAlpha = clamp(colA, 0, 0.56);
          ctx.fillStyle = pillarG;
          ctx.fillRect(to.x - 96 * circleIn, gy - 220, 192 * circleIn, 220);
          ctx.restore();
        }
      }

      // 2. 高空 7 枚巨型晶透菱镜棱柱依次高速坠落贯刺
      var blastDissolve = remap(t, 1030, 1280);
      for (var i = 0; i < pls.length; i++) {
        var pl = pls[i];
        if (t < pl.spawnMs) continue;
        var spawnU = clamp((t - pl.spawnMs) / 140, 0, 1);
        var dropU = remap(t, pl.dropMs, pl.hitMs);
        var pAlpha = (1 - EASE.inQuad(blastDissolve)) * spawnU;
        if (pAlpha <= 0.01) continue;

        var startY = 30 + (i % 3) * 12;
        var startX = pl.tx - Math.sin(pl.tilt) * (pl.ty - startY);
        var fallEase = EASE.inCubic(dropU);
        var curX = lerp(startX, pl.tx, fallEase);
        var curY = lerp(startY, pl.ty - pl.len * 0.30, fallEase);
        var fallAng = PI * 0.5 + pl.tilt;

        if (dropU < 0.65) {
          draw3DMagicCircle(ctx, startX, startY - 10, 17 * spawnU, 5.5 * spawnU, 0, t * 0.006 + i, {
            alpha: (1 - dropU / 0.65) * 0.88, gold: pl.isMain || i % 2 === 0, sides: 4, nodes: 4, lineWidth: 1.6, nodeScale: 0.72
          });
        }

        if (dropU > 0.02 && t < pl.hitMs + 280) {
          var trFade = 1 - remap(t, pl.hitMs + 40, pl.hitMs + 280);
          var trailPts = [];
          for (var k = 0; k <= 14; k++) {
            var u = k / 14;
            trailPts.push({
              x: lerp(startX, curX, u),
              y: lerp(startY - 14, curY, u)
            });
          }
          drawCelRibbon(ctx, trailPts, function (u) { return (pl.isMain ? 13 : 7.5) * u; }, {
            alpha: trFade * 0.92,
            outerColor: pl.isMain ? '#B45309' : '#1D4ED8',
            midColor: pl.isMain ? '#FEF08A' : '#38BDF8',
            headColor: '#FFFFFF',
            prismColor: pl.isMain ? '#38BDF8' : '#FEF08A',
            prismShift: 2.5
          });
        }

        var popScale = EASE.outBack(spawnU);
        drawPolyCrystal(ctx, curX, curY, pl.len * popScale, pl.hw * popScale, fallAng, {
          anchorRatio: 0.45, alpha: pAlpha, shimmer: t * 0.015 + i * 1.1,
          goldTint: pl.isMain || (i % 2 === 0 && inst.ampTier >= 2)
        });

        if (t >= pl.hitMs && t < pl.hitMs + 260) {
          var impU = remap(t, pl.hitMs, pl.hitMs + 260);
          draw3DShockwave(ctx, pl.tx, pl.ty, 10 + EASE.outQuart(impU) * (pl.isMain ? 78 : 38), 4 + EASE.outQuart(impU) * (pl.isMain ? 22 : 11), 0, {
            outerColor: pl.isMain ? '#B45309' : '#1D4ED8',
            midColor: pl.isMain ? '#FEF08A' : '#38BDF8',
            coreColor: '#FFFFFF',
            lineWidth: (pl.isMain ? 3.8 : 2.2) * (1 - impU * 0.5),
            alpha: 1 - EASE.inQuad(impU)
          });
        }
      }

      // 3. 终极星霜雪花冲击波 + 灿烂冰蓝/淡金棱镜虹光散华
      if (t >= 950) {
        var bMs = t - 950;
        var bU = remap(bMs, 0, 560);
        var bEase = EASE.outQuart(bU);
        var bAlpha = bU < 0.1 ? (bU / 0.1) : (1 - EASE.inQuad((bU - 0.1) / 0.9));

        if (bAlpha > 0.02) {
          ctx.save();
          ctx.translate(to.x, to.y - 10);
          var rayCols = ['#38BDF8', '#FEF08A', '#818CF8', '#7DD3FC', '#F472B6', '#FFFFFF'];
          for (var r = 0; r < 14; r++) {
            var ra = (r / 14) * TAU + bMs * 0.0008;
            var rLen = (82 + (r % 3) * 30) * (0.38 + 0.85 * bEase);
            var rSpread = 0.062 * (1 - bU * 0.45);
            ctx.globalAlpha = clamp(bAlpha * (r % 2 === 0 ? 0.58 : 0.44), 0, 1);
            ctx.fillStyle = rayCols[r % rayCols.length];
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ra - rSpread) * rLen, Math.sin(ra - rSpread) * rLen);
            ctx.lineTo(Math.cos(ra + rSpread) * rLen, Math.sin(ra + rSpread) * rLen);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }

        if (bU < 0.88) {
          var sfAlpha = bU < 0.12 ? (bU / 0.12) : (1 - remap(bU, 0.12, 0.88));
          drawSnowBlossom(ctx, to.x, to.y - 10, 26 + bEase * 98, bMs * 0.0012, {
            alpha: sfAlpha * 0.96, rimColor: '#1D4ED8', mainColor: '#38BDF8', coreColor: '#FFFFFF'
          });
          drawSnowBlossom(ctx, to.x, to.y - 10, 18 + bEase * 72, -bMs * 0.0018 + PI / 6, {
            alpha: sfAlpha * 0.90, rimColor: '#B45309', mainColor: '#FEF08A', coreColor: '#FFFFFF'
          });
        }

        draw3DShockwave(ctx, to.x, to.y - 6, 26 + bEase * 126, 15 + bEase * 68, -0.15, {
          outerColor: '#1D4ED8', midColor: '#38BDF8', prismColor: '#FEF08A', coreColor: '#FFFFFF',
          lineWidth: 4.5 * (1 - bU * 0.55), alpha: bAlpha, fillAlpha: 0.14 * (1 - bU), ticks: 16, tickRot: bMs * 0.0015
        });
        draw3DShockwave(ctx, to.x, gy - 6, 32 + bEase * 140, 10 + bEase * 36, 0, {
          outerColor: '#B45309', midColor: '#FEF08A', prismColor: '#7DD3FC', coreColor: '#FFFFFF',
          lineWidth: 3.4 * (1 - bU * 0.5), alpha: bAlpha * 0.92
        });

        var coreU = remap(bMs, 0, 270);
        if (coreU < 1) {
          var cPop = coreU < 0.2 ? EASE.outQuad(coreU / 0.2) : 1 - EASE.inQuad((coreU - 0.2) / 0.8);
          drawAnimeStarburst(ctx, to.x, to.y - 10, 76 * (0.45 + 0.65 * cPop), 12.5, 8, bMs * 0.003, {
            rimColor: '#B45309', mainColor: '#FEF08A', prismColor: '#38BDF8', coreColor: '#FFFFFF',
            glowMid: 'rgba(56,189,248,0.52)', flareLen: 180 * cPop, alpha: cPop
          });
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
     [4] raging_surge — 激流涌（精修：日系动画透明水龙流带 + 雕塑感冲天翻卷晶莹水幕浪墙！）
     -------------------------------------------------------------------------- */
  HANDLERS.raging_surge = {
    init: function (inst) {
      inst.data = { waveFired: false, splashFired: false };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var to = inst.to;
      if (!inst.data.waveFired && t >= 490) {
        inst.data.waveFired = true;
        inst.triggerImpact(0, to.x, to.y, 0.65 + inst.ampTier * 0.12);
        // 闪烁抛物线飞溅水花弧珠
        spawnBurstParticles(inst.particles, inst.rng, to.x, inst.groundY - 16, 42 + inst.ampTier * 10, {
          kind: 'waterDrop', speedMin: 110, speedMax: 300, angMin: -PI * 0.90, angMax: -PI * 0.10,
          sizeMin: 4, sizeMax: 9.5, lifeMin: 440, lifeMax: 740, gravity: 330, drag: 0.986,
          colors: ['#38BDF8', '#7DD3FC', '#22D3EE', '#FFFFFF']
        });
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y - 24, 18, {
          kind: 'pixelDust', speedMin: 60, speedMax: 210, angMin: -PI, angMax: 0,
          sizeMin: 2, sizeMax: 4, lifeMin: 360, lifeMax: 640, gravity: 80,
          colors: ['#FFFFFF', '#7DD3FC', '#5EEAD4'], goldRatio: inst.ampTier >= 3 ? 0.3 : 0
        });
      }
      if (!inst.data.splashFired && t >= 610) {
        inst.data.splashFired = true;
        spawnBurstParticles(inst.particles, inst.rng, to.x + 12, to.y - 68, 28, {
          kind: 'waterDrop', speedMin: 75, speedMax: 245, angMin: -PI * 0.95, angMax: PI * 0.18,
          sizeMin: 3.5, sizeMax: 8.5, lifeMin: 380, lifeMax: 620, gravity: 310, drag: 0.982,
          colors: ['#7DD3FC', '#FFFFFF', '#22D3EE', '#38BDF8']
        });
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var from = inst.from;
      var to = inst.to;
      var gy = inst.groundY;

      // 1. 起手：主角身前涡旋晶澈水环（0 ~ 480ms）
      var voxFade = t < 90 ? (t / 90) : (1 - remap(t, 280, 480));
      if (voxFade > 0.01) {
        var pop = EASE.outBack(clamp(t / 130, 0, 1));
        draw3DShockwave(ctx, from.x + 8, from.y, 17 * pop, 44 * pop, 0.05, {
          outerColor: '#0369A1', midColor: '#22D3EE', prismColor: '#7DD3FC', coreColor: '#FFFFFF',
          lineWidth: 2.8, alpha: voxFade * 0.92, ticks: 8, tickRot: t * 0.008
        });
      }

      // 2. 极度流畅的多层透明日系水龙流带螺旋翻涌奔袭（80 ~ 860ms）
      var headProgress = EASE.outCubic(remap(t, 80, 540));
      var tailProgress = EASE.inQuad(remap(t, 440, 880));
      var dragonAlpha = 1 - remap(t, 760, 960);
      if (t >= 80 && headProgress - tailProgress > 0.02 && dragonAlpha > 0.01) {
        var layers = [
          { amp: 28, freq: 2.1, phase: 0.0, wScale: 1.25, outer: '#0369A1', mid: '#0284C7', head: '#38BDF8', prism: '#5EEAD4', coreScale: 0.22 },
          { amp: 20, freq: 2.6, phase: 2.0, wScale: 0.95, outer: '#1D4ED8', mid: '#22D3EE', head: '#7DD3FC', prism: '#BAE6FD', coreScale: 0.30 },
          { amp: 32, freq: 1.8, phase: 4.2, wScale: 0.65, outer: '#0284C7', mid: '#7DD3FC', head: '#E0F7FF', prism: '#FFFFFF', coreScale: 0.42 },
          { amp: 14, freq: 3.3, phase: 1.1, wScale: 0.38, outer: '#38BDF8', mid: '#E0F7FF', head: '#FFFFFF', prism: null,      coreScale: 0.55 }
        ];
        for (var l = 0; l < layers.length; l++) {
          var L = layers[l];
          var pts = [];
          for (var s = 0; s <= 40; s++) {
            var u = lerp(tailProgress, headProgress, s / 40);
            var bx = lerp(from.x + 6, to.x + 12, u);
            var env = Math.sin(u * PI * 0.95);
            var waveY = Math.sin(u * PI * L.freq - t * 0.015 + L.phase) * L.amp * (0.35 + 0.65 * env);
            var by = lerp(from.y + 4, to.y + 18, u) + waveY - Math.sin(u * PI) * 20;
            pts.push({ x: bx, y: by });
          }
          drawCelRibbon(ctx, pts, function (u) {
            return (3.0 + 14.5 * Math.pow(u, 0.8) * Math.sin(Math.min(1, u * 1.06) * PI * 0.88 + 0.14)) * L.wScale;
          }, {
            alpha: dragonAlpha * (l === 0 ? 0.78 : l === 3 ? 0.92 : 0.84),
            outerColor: L.outer, midColor: L.mid, headColor: L.head,
            prismColor: L.prism, prismShift: 2.4, coreColor: '#FFFFFF', coreScale: L.coreScale
          });
        }
      }

      // 3. 命中瞬间：雕塑感半透明冲天卷浪墙 + 螺旋水龙柱 + 飞溅泡沫浪冠（480 ~ 1200ms）
      if (t >= 480) {
        var wMs = t - 480;
        var riseU = EASE.outExpo(remap(wMs, 0, 210));
        var curlU = EASE.outCubic(remap(wMs, 50, 440));
        var fadeU = 1 - remap(wMs, 380, 720);
        if (fadeU > 0.01) {
          var wallH = (138 + inst.ampTier * 14) * riseU;
          var baseW = 74 + inst.ampTier * 8;

          // 背后澄透天青水雾光晕
          drawRadialGlow(ctx, to.x, gy - wallH * 0.44, wallH * 0.86,
            'rgba(224,247,255,0.68)', 'rgba(2,132,199,0.34)', 'rgba(56,189,248,0)', fadeU);

          // 透明赛璐璐海浪主体轮廓（左后涌起、高耸拱起并向右上/右下翻卷的日系巨浪墙！）
          ctx.save();
          ctx.globalAlpha = clamp(fadeU * 0.78, 0, 1);
          var waveBodyGrad = ctx.createLinearGradient(to.x - baseW, gy, to.x + baseW * 0.6, gy - wallH);
          waveBodyGrad.addColorStop(0, 'rgba(3, 105, 161, 0.82)');
          waveBodyGrad.addColorStop(0.35, 'rgba(2, 132, 199, 0.68)');
          waveBodyGrad.addColorStop(0.68, 'rgba(34, 211, 238, 0.56)');
          waveBodyGrad.addColorStop(1, 'rgba(186, 230, 253, 0.78)');
          ctx.fillStyle = waveBodyGrad;

          ctx.beginPath();
          ctx.moveTo(to.x - baseW * 0.92, gy + 4);
          // 左侧翻涌浪壁冲天而起
          ctx.bezierCurveTo(
            to.x - baseW * 1.15, gy - wallH * 0.45,
            to.x - baseW * 0.52, gy - wallH * 1.05,
            to.x + baseW * 0.34 + curlU * 18, gy - wallH * 0.98
          );
          // 巨浪顶冠向前下扣卷（葛饰北斋 × 日系动画水浪弧！）
          ctx.bezierCurveTo(
            to.x + baseW * 1.08 + curlU * 22, gy - wallH * 0.88,
            to.x + baseW * 1.12 + curlU * 14, gy - wallH * 0.34,
            to.x + baseW * 0.62, gy - wallH * 0.42
          );
          // 浪腹回卷透空弧线
          ctx.bezierCurveTo(
            to.x + baseW * 0.82, gy - wallH * 0.66,
            to.x + baseW * 0.25, gy - wallH * 0.76,
            to.x + baseW * 0.14, gy - wallH * 0.42
          );
          ctx.bezierCurveTo(
            to.x + baseW * 0.38, gy - wallH * 0.18,
            to.x + baseW * 0.86, gy - wallH * 0.12,
            to.x + baseW * 0.92, gy + 4
          );
          ctx.closePath();
          ctx.fill();

          // 巨浪赛璐璐锐利深海蓝外廓边
          ctx.strokeStyle = '#0369A1';
          ctx.lineWidth = 2.6;
          ctx.stroke();

          // 浪墙内部透光波纹明暗折光曲线（柔美日系手绘感！）
          ctx.globalAlpha = clamp(fadeU * 0.76, 0, 1);
          ctx.strokeStyle = '#E0F7FF';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          for (var rib = 0; rib < 4; rib++) {
            var rf = 0.22 + rib * 0.2;
            ctx.beginPath();
            ctx.moveTo(to.x - baseW * (0.72 - rib * 0.16), gy - 4);
            ctx.quadraticCurveTo(
              to.x - baseW * (0.55 - rib * 0.18), gy - wallH * (0.62 + rib * 0.08),
              to.x + baseW * (0.15 + rib * 0.14 + curlU * 0.15), gy - wallH * (0.84 - rib * 0.06)
            );
            ctx.stroke();
          }
          ctx.restore();

          // 围绕浪墙冲天盘旋的双道晶澈水丝光带（优雅细流，绝不僵硬！）
          for (var sp = 0; sp < 2; sp++) {
            var sPts = [];
            for (var j = 0; j <= 30; j++) {
              var u = j / 30;
              var ang = u * PI * 2.2 + sp * PI - t * 0.01;
              var rad = (baseW * 0.85) * (1 - u * 0.45);
              sPts.push({
                x: to.x + Math.cos(ang) * rad + u * 14 * curlU,
                y: gy - u * wallH * 1.06 + Math.sin(ang) * 14
              });
            }
            drawCelRibbon(ctx, sPts, function (u) { return (2.0 + 7.5 * Math.sin(u * PI)) * (sp === 0 ? 1 : 0.75); }, {
              alpha: fadeU * 0.92,
              outerColor: '#0369A1', midColor: '#38BDF8', headColor: '#E0F7FF',
              prismColor: '#5EEAD4', prismShift: 2.0, coreColor: '#FFFFFF', coreScale: 0.46
            });
          }

          // 顶部雪白翻卷飞溅浪花月牙弧（浪冠碎沫！）
          drawCrescentSlash(ctx, to.x + 26 + curlU * 14, gy - wallH * 0.78, 56 * riseU, 42 * riseU, 0.32, -PI * 0.96, PI * 0.28, 17 * fadeU, {
            rimColor: '#0284C7', midColor: '#7DD3FC', headColor: '#E0F7FF', coreColor: '#FFFFFF', alpha: fadeU * 0.98
          });
          drawCrescentSlash(ctx, to.x - 24, gy - wallH * 0.62, 46 * riseU, 34 * riseU, -0.42, -PI * 1.08, -PI * 0.08, 14 * fadeU, {
            rimColor: '#0369A1', midColor: '#38BDF8', headColor: '#FFFFFF', coreColor: '#FFFFFF', alpha: fadeU * 0.92
          });

          // 地面激荡水波椭圆冲击环
          var ringU = remap(wMs, 0, 540);
          var rE = EASE.outQuart(ringU);
          draw3DShockwave(ctx, to.x, gy + 2, 28 + rE * 96, 8 + rE * 24, 0, {
            outerColor: '#0369A1', midColor: '#38BDF8', prismColor: '#5EEAD4', coreColor: '#FFFFFF',
            lineWidth: 3.4 * (1 - ringU * 0.5), alpha: fadeU * 0.95, fillAlpha: 0.16 * (1 - ringU)
          });
          draw3DShockwave(ctx, to.x, gy + 2, 16 + rE * 64, 5 + rE * 15, 0, {
            outerColor: '#1D4ED8', midColor: '#7DD3FC', coreColor: '#FFFFFF',
            lineWidth: 2.2 * (1 - ringU * 0.4), alpha: fadeU * 0.85
          });
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
     [5] water_cleave — 断水刃
     超高速赛璐璐双道大弧冰水月牙斩击 + 瞬间切开空气的菱形水雾闪线
     -------------------------------------------------------------------------- */
  HANDLERS.water_cleave = {
    init: function (inst) {
      inst.data = { slash1Hit: false, slash2Hit: false };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var to = inst.to;
      if (!inst.data.slash1Hit && t >= 225) {
        inst.data.slash1Hit = true;
        inst.triggerImpact(0, to.x, to.y, 0.52);
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y, 24, {
          kind: 'waterDrop', speedMin: 100, speedMax: 300, angMin: -PI * 0.95, angMax: PI * 0.45,
          sizeMin: 3.5, sizeMax: 8.5, lifeMin: 340, lifeMax: 600, gravity: 220,
          colors: ['#FFFFFF', '#7DD3FC', '#38BDF8', '#22D3EE']
        });
      }
      if (!inst.data.slash2Hit && t >= 380) {
        inst.data.slash2Hit = true;
        inst.triggerImpact(1, to.x, to.y, 0.74 + inst.ampTier * 0.12);
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y, 26 + inst.ampTier * 6, {
          kind: 'prismShard', speedMin: 120, speedMax: 325, sizeMin: 4.5, sizeMax: 10,
          lifeMin: 360, lifeMax: 600, gravity: 125, drag: 0.955,
          colors: ['#FFFFFF', '#7DD3FC', '#38BDF8', '#5EEAD4'],
          rimColor: '#0369A1', goldRatio: inst.ampTier >= 3 ? 0.35 : 0.08
        });
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y, 16, {
          kind: 'pixelDust', speedMin: 75, speedMax: 230, sizeMin: 2, sizeMax: 3.5,
          lifeMin: 280, lifeMax: 500, gravity: -15, colors: ['#FFFFFF', '#7DD3FC', '#5EEAD4']
        });
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var from = inst.from;
      var to = inst.to;

      // 1. 起手水刃瞬闪星芒（0 ~ 210ms）
      if (t < 210) {
        var gPop = Math.sin((t / 210) * PI);
        drawAnimeStarburst(ctx, from.x + 14, from.y - 6, 34 * gPop, 5.2, 4, t * 0.01, {
          rimColor: '#0369A1', mainColor: '#38BDF8', prismColor: '#7DD3FC', coreColor: '#FFFFFF',
          flareLen: 78 * gPop, alpha: gPop
        });
      }

      // 2. 第一道超高速大弧度冰水月牙斩击（右上 → 左下）
      if (t >= 125 && t <= 670) {
        var s1U = remap(t, 125, 670);
        var head1 = EASE.outExpo(remap(t, 125, 315));
        var tail1 = EASE.inCubic(remap(t, 265, 640));
        var a1 = s1U < 0.12 ? (s1U / 0.12) : (1 - EASE.inQuad(remap(s1U, 0.38, 1)));

        drawCrescentSlash(ctx, to.x - 10, to.y + 8, 102, 68, -0.46, -PI * 0.88, PI * 0.40, 32 + inst.ampTier * 3, {
          headT: head1, tailT: tail1,
          rimColor: '#0369A1', rimHead: '#1D4ED8',
          midColor: '#2563EB', headColor: '#38BDF8',
          prismColor: '#5EEAD4', coreColor: '#FFFFFF',
          accentLineColor: '#E0F7FF', alpha: a1
        });
        drawCrescentSlash(ctx, to.x - 10, to.y + 8, 118, 78, -0.46, -PI * 0.82, PI * 0.36, 8.0, {
          headT: head1, tailT: Math.min(head1, tail1 + 0.08),
          rimColor: '#0284C7', midColor: '#7DD3FC', headColor: '#FFFFFF', coreColor: '#FFFFFF',
          alpha: a1 * 0.80
        });
      }

      // 3. 第二道交错反向超宽冰水月牙斩击（左下 → 右上）
      if (t >= 275 && t <= 880) {
        var s2U = remap(t, 275, 880);
        var head2 = EASE.outExpo(remap(t, 275, 465));
        var tail2 = EASE.inCubic(remap(t, 435, 850));
        var a2 = s2U < 0.1 ? (s2U / 0.1) : (1 - EASE.inQuad(remap(s2U, 0.40, 1)));

        drawCrescentSlash(ctx, to.x + 8, to.y - 6, 112, 74, 0.48, PI * 0.94, -PI * 0.38, 36 + inst.ampTier * 4, {
          headT: head2, tailT: tail2,
          rimColor: '#1D4ED8', rimHead: '#0369A1',
          midColor: '#38BDF8', headColor: '#7DD3FC',
          prismColor: inst.ampTier >= 2 ? '#FEF08A' : '#A78BFA', coreColor: '#FFFFFF',
          accentLineColor: '#FFFFFF', alpha: a2
        });
        drawCrescentSlash(ctx, to.x + 8, to.y - 6, 128, 84, 0.48, PI * 0.88, -PI * 0.32, 8.8, {
          headT: head2, tailT: Math.min(head2, tail2 + 0.08),
          rimColor: '#0284C7', midColor: '#5EEAD4', headColor: '#FFFFFF', coreColor: '#FFFFFF',
          alpha: a2 * 0.82
        });
      }

      // 4. 瞬间切开空气的长菱形水雾闪线 & 交错裂空星芒
      var drawShearDiamond = function (cx, cy, ang, len, thick, a) {
        if (a <= 0.01) return;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.globalAlpha = clamp(a * 0.86, 0, 1);
        ctx.fillStyle = '#0369A1';
        ctx.beginPath();
        ctx.moveTo(-len, 0); ctx.lineTo(0, -thick * 1.48); ctx.lineTo(len, 0); ctx.lineTo(0, thick * 1.48);
        ctx.closePath(); ctx.fill();

        ctx.globalAlpha = clamp(a * 0.96, 0, 1);
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(-len * 0.95, 0); ctx.lineTo(0, -thick); ctx.lineTo(len * 0.95, 0); ctx.lineTo(0, thick);
        ctx.closePath(); ctx.fill();

        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-len * 0.84, 0); ctx.lineTo(0, -thick * 0.46); ctx.lineTo(len * 0.84, 0); ctx.lineTo(0, thick * 0.46);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      };

      if (t >= 225 && t <= 700) {
        var sh1 = remap(t, 225, 700);
        var sh1A = sh1 < 0.14 ? (sh1 / 0.14) : (1 - EASE.inQuad((sh1 - 0.14) / 0.86));
        drawShearDiamond(to.x, to.y, -0.58, 152 * (0.42 + 0.58 * EASE.outExpo(sh1)), 6.8 * (1 - sh1 * 0.5), sh1A);
      }
      if (t >= 370 && t <= 860) {
        var sh2 = remap(t, 370, 860);
        var sh2A = sh2 < 0.14 ? (sh2 / 0.14) : (1 - EASE.inQuad((sh2 - 0.14) / 0.86));
        drawShearDiamond(to.x, to.y, 0.54, 168 * (0.42 + 0.58 * EASE.outExpo(sh2)), 7.8 * (1 - sh2 * 0.5), sh2A);
        draw3DShockwave(ctx, to.x, to.y, 22 + EASE.outQuart(sh2) * 90, 13 + EASE.outQuart(sh2) * 44, 0.18, {
          outerColor: '#0369A1', midColor: '#38BDF8', prismColor: '#5EEAD4', coreColor: '#FFFFFF',
          lineWidth: 3.3 * (1 - sh2 * 0.5), alpha: sh2A * 0.92
        });
        if (sh2 < 0.55) {
          var sP = sh2 < 0.18 ? (sh2 / 0.18) : (1 - (sh2 - 0.18) / 0.37);
          drawAnimeStarburst(ctx, to.x, to.y, 52 * sP, 7.8, 8, sh2 * 1.4, {
            rimColor: '#0369A1', mainColor: '#38BDF8', prismColor: '#5EEAD4', coreColor: '#FFFFFF',
            flareLen: 136 * sP, alpha: sP
          });
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
     [6] frost_thorn_field — 霜域棘阵（3 目标群攻）
     闪耀冰青光波沿地横扫全场 → 3 敌脚下依次弹出立体几何多面体晶蓝巨棘 + 漫天发光冰花
     -------------------------------------------------------------------------- */
  HANDLERS.frost_thorn_field = {
    init: function (inst) {
      var targets = inst.targets;
      var gy = inst.groundY;
      inst.data = {
        clusters: targets.map(function (pt, idx) {
          var footY = Math.min(LOGICAL_H - 18, Math.max(gy - 10, pt.y + 42));
          return {
            idx: idx,
            x: pt.x,
            y: pt.y,
            footY: footY,
            eruptMs: 240 + idx * 120,
            hitDone: false,
            thorns: [
              { ox:   0, ang: -PI * 0.50 + (idx - 1) * 0.04, len: 106, hw: 17.0, delay: 0 },
              { ox: -18, ang: -PI * 0.64, len: 76,  hw: 13.0, delay: 26 },
              { ox:  18, ang: -PI * 0.36, len: 80,  hw: 13.5, delay: 40 },
              { ox: -29, ang: -PI * 0.74, len: 54,  hw: 9.8,  delay: 54 },
              { ox:  29, ang: -PI * 0.27, len: 56,  hw: 9.8,  delay: 60 }
            ]
          };
        }),
        snowSpawned: false
      };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var cls = inst.data.clusters;
      for (var i = 0; i < cls.length; i++) {
        var cl = cls[i];
        if (!cl.hitDone && t >= cl.eruptMs + 45) {
          cl.hitDone = true;
          inst.triggerImpact(i, cl.x, cl.y, 0.45 + i * 0.1 + inst.ampTier * 0.08);
          spawnBurstParticles(inst.particles, inst.rng, cl.x, cl.footY - 26, 16 + inst.ampTier * 4, {
            kind: 'prismShard', speedMin: 65, speedMax: 215, angMin: -PI * 0.92, angMax: -PI * 0.08,
            sizeMin: 4.8, sizeMax: 11, lifeMin: 440, lifeMax: 740, gravity: 180,
            colors: ['#FFFFFF', '#BAE6FD', '#7DD3FC', '#38BDF8'],
            goldRatio: inst.ampTier >= 3 ? 0.32 : 0.08
          });
          spawnBurstParticles(inst.particles, inst.rng, cl.x, cl.footY - 12, 8, {
            kind: 'pixelDust', speedMin: 42, speedMax: 150, angMin: -PI, angMax: 0,
            sizeMin: 2, sizeMax: 3.5, lifeMin: 360, lifeMax: 660, gravity: -30,
            colors: ['#FFFFFF', '#7DD3FC', '#38BDF8']
          });
        }
      }
      if (!inst.data.snowSpawned && t >= 400) {
        inst.data.snowSpawned = true;
        var minX = Math.max(210, cls[0].x - 105);
        var maxX = Math.min(LOGICAL_W - 16, cls[cls.length - 1].x + 65);
        for (var f = 0; f < 26 + inst.ampTier * 6; f++) {
          inst.particles.push({
            kind: f % 5 === 0 ? 'mote' : 'snowBlossom',
            x: lerp(minX, maxX, inst.rng()),
            y: lerp(28, 175, inst.rng()),
            vx: (inst.rng() - 0.5) * 34,
            vy: lerp(34, 86, inst.rng()),
            gravity: 8, drag: 0.995,
            size: lerp(5.0, 12.0, inst.rng()),
            rot: inst.rng() * TAU,
            vrot: (inst.rng() - 0.5) * 2.6,
            spin3d: inst.rng() * TAU,
            vspin3d: lerp(2, 5, inst.rng()),
            age: 0, maxAge: lerp(680, 960, inst.rng()),
            color: '#7DD3FC', rimColor: '#2563EB',
            gold: inst.ampTier >= 3 && f % 3 === 0
          });
        }
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var from = inst.from;
      var cls = inst.data.clusters;
      var gy = inst.groundY;
      var endX = cls[cls.length - 1].x + 56;

      // 1. 闪耀冰青光波沿地面高速横扫全场（持续清晰横贯整个战场至 920ms）
      var sweepU = EASE.outCubic(remap(t, 25, 560));
      var waveFade = 1 - remap(t, 640, 960);
      if (t >= 25 && waveFade > 0.01) {
        var curX = lerp(from.x + 8, endX, sweepU);
        var pts = [];
        for (var s = 0; s <= 32; s++) {
          var u = s / 32;
          pts.push({
            x: lerp(from.x + 4, curX, u),
            y: gy + 2 + Math.sin(u * PI * 3.5 - t * 0.012) * 3.2
          });
        }
        drawCelRibbon(ctx, pts, function (u) { return 4.5 + 13.5 * Math.pow(u, 0.72); }, {
          alpha: waveFade * 0.94,
          outerColor: '#1D4ED8', midColor: '#38BDF8', headColor: '#BAE6FD',
          prismColor: '#FEF08A', prismShift: -2.8, coreColor: '#FFFFFF'
        });
        if (sweepU < 0.98) {
          drawCrescentSlash(ctx, curX - 8, gy - 14, 26, 36, 0.05, -PI * 0.52, PI * 0.36, 16, {
            rimColor: '#1D4ED8', midColor: '#38BDF8', headColor: '#7DD3FC', coreColor: '#FFFFFF', alpha: waveFade
          });
        }
      }

      // 2. 3 名敌人脚下依次弹出立体几何多面体晶蓝巨棘 + 淡蓝底霜
      for (var i = 0; i < cls.length; i++) {
        var cl = cls[i];
        if (t < cl.eruptMs) continue;
        var localMs = t - cl.eruptMs;
        var fadeOut = 1 - remap(t, 1020, 1340);
        if (fadeOut <= 0.01) continue;

        var basePop = EASE.outQuart(clamp(localMs / 170, 0, 1));
        draw3DShockwave(ctx, cl.x, cl.footY + 2, 48 * basePop, 13.5 * basePop, 0, {
          outerColor: '#1D4ED8', midColor: '#7DD3FC', coreColor: '#FFFFFF',
          lineWidth: 2.6, alpha: fadeOut * 0.94, fillAlpha: 0.28
        });

        var popRingU = remap(localMs, 0, 320);
        if (popRingU < 1) {
          var prE = EASE.outQuart(popRingU);
          draw3DShockwave(ctx, cl.x, cl.footY, 18 + prE * 54, 6 + prE * 16, 0, {
            outerColor: '#1D4ED8', midColor: '#38BDF8', prismColor: '#BAE6FD', coreColor: '#FFFFFF',
            lineWidth: 3.0 * (1 - popRingU * 0.5), alpha: (1 - EASE.inQuad(popRingU)) * 0.95
          });
        }

        var thorns = cl.thorns;
        var order = [3, 4, 1, 2, 0];
        var ampScale = 1 + inst.ampTier * 0.07;
        for (var oi = 0; oi < order.length; oi++) {
          var th = thorns[order[oi]];
          var tGrow = EASE.outBack(clamp((localMs - th.delay) / 145, 0, 1));
          if (tGrow <= 0.02) continue;
          var shrink = 1 - remap(t, 1060, 1350) * 0.45;
          drawPolyCrystal(ctx, cl.x + th.ox, cl.footY + 4, th.len * tGrow * shrink * ampScale, th.hw * tGrow * ampScale, th.ang, {
            anchorRatio: 0.08, alpha: fadeOut * 0.98, shimmer: t * 0.012 + i * 2 + oi,
            goldTint: inst.ampTier >= 3 && order[oi] === 0
          });
        }

        if (localMs > 60 && localMs < 580) {
          var tipGlow = Math.sin(remap(localMs, 60, 580) * PI);
          drawCrystalMote(ctx, cl.x, cl.footY - 98 * ampScale, 6.4 * tipGlow, '#FFFFFF', true, tipGlow * 0.96, t * 0.004);
        }
      }

      // 3 敌联结冰雷晶弧
      if (t >= 460 && t <= 1040 && cls.length >= 2) {
        var linkA = Math.sin(remap(t, 460, 1040) * PI) * 0.85;
        for (var j = 0; j < cls.length - 1; j++) {
          var cA = cls[j], cB = cls[j + 1];
          drawIceLightningArc(ctx, cA.x, cA.footY - 36, cB.x, cB.footY - 36, 12, {
            outerColor: '#1D4ED8', midColor: '#7DD3FC', coreColor: '#FFFFFF',
            lineWidth: 1.9, alpha: linkA, seed: inst.seed + Math.floor(t / 55) * 19 + j * 41
          });
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
     [7] steel_ice_curtain — 钢冰护幕（精修：立体 6 面拼合棱镜冰盾穹顶 + 彩虹扫光 + 双 3D 星轨环 + 无生硬泡泡圈！）
     -------------------------------------------------------------------------- */
  HANDLERS.steel_ice_curtain = {
    init: function (inst) {
      inst.data = { lockFired: false };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var c = inst.heroCenter;
      if (!inst.data.lockFired && t >= 400) {
        inst.data.lockFired = true;
        inst.triggerImpact(0, c.x, c.y, 0.35);
        spawnBurstParticles(inst.particles, inst.rng, c.x, c.y, 24 + inst.ampTier * 6, {
          kind: 'mote', speedMin: 40, speedMax: 145, sizeMin: 4, sizeMax: 8.8,
          lifeMin: 460, lifeMax: 800, gravity: -36, drag: 0.95,
          colors: ['#FFFFFF', '#7DD3FC', '#FEF08A', '#38BDF8'], goldRatio: 0.42
        });
        spawnBurstParticles(inst.particles, inst.rng, c.x, c.y, 14, {
          kind: 'pixelDust', speedMin: 35, speedMax: 120, sizeMin: 2, sizeMax: 3.5,
          lifeMin: 420, lifeMax: 720, gravity: -28, colors: ['#FFFFFF', '#FEF08A', '#7DD3FC']
        });
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var tSec = t * 0.001;
      var c = inst.heroCenter;
      var gy = inst.groundY;
      var fade = t < 150 ? EASE.outCubic(t / 150) : (1 - remap(t, 1020, 1320));
      if (fade <= 0.01) return;

      var assemble = EASE.outBack(clamp(t / 400, 0, 1));
      var domeR = 76 + inst.ampTier * 5;

      // 1. 脚下立体蓝金六角护阵底座
      draw3DMagicCircle(ctx, c.x, gy + 2, domeR * 1.06 * assemble, domeR * 0.30 * assemble, 0, tSec * 1.1, {
        alpha: fade * 0.94, gold: true, sides: 6, nodes: 6, lineWidth: 2.3
      });

      // 2. 外圈两道 3D 倾斜星轨环 — 后景半环
      draw3DOrbitRibbon(ctx, c.x, c.y - 6, domeR * 1.28, domeR * 0.38, 0.28, tSec * 2.2, {
        pass: 'back', alpha: fade * 0.92, count: 10, trailSteps: 6, dir: 1,
        ribbonOuter: '#1D4ED8', ribbonMain: '#38BDF8', ribbonCore: '#FFFFFF',
        palette: ['#FFFFFF', '#7DD3FC', '#38BDF8'], lineWidth: 2.0
      });
      draw3DOrbitRibbon(ctx, c.x, c.y + 4, domeR * 1.36, domeR * 0.42, -0.30, -tSec * 1.9 + 1.4, {
        pass: 'back', alpha: fade * 0.94, count: 10, trailSteps: 6, dir: -1,
        ribbonOuter: '#B45309', ribbonMain: '#FEF08A', ribbonCore: '#FFFFFF',
        palette: ['#FFFFFF', '#FEF08A', '#F59E0B', '#7DD3FC'], lineWidth: 2.0
      });

      // 3. 6 面立体半透明蓝金折射棱镜冰盾穹顶（立体拼合切面 + 斜向彩虹冰白反光带！）
      var panels = [];
      for (var p = 0; p < 6; p++) {
        var ang = (p / 6) * TAU + tSec * 0.42 + 0.52;
        var slideOut = (1 - clamp(t / 360, 0, 1)) * 46;
        var rad = domeR * 0.80 + slideOut;
        var px = c.x + Math.cos(ang) * rad;
        var pz = Math.sin(ang);
        var py = c.y - 4 + pz * 14 - (1 - Math.abs(pz)) * 4;
        panels.push({ idx: p, ang: ang, x: px, y: py, z: pz });
      }
      panels.sort(function (a, b) { return a.z - b.z; });

      drawRadialGlow(ctx, c.x, c.y - 4, domeR * 1.18,
        'rgba(224,242,254,0.44)', 'rgba(37,99,235,0.28)', 'rgba(56,189,248,0)', fade);

      var sheenPos = lerp(-1.1, 1.1, ((t + 260) % 760) / 760);

      for (var k = 0; k < panels.length; k++) {
        var pn = panels[k];
        var isFront = pn.z >= -0.05;
        var faceW = 34 * (0.52 + 0.48 * Math.abs(Math.sin(pn.ang)));
        var faceH = 48 * (0.86 + 0.14 * ((pn.z + 1) * 0.5));
        var pAlpha = fade * (isFront ? 0.90 : 0.42);

        ctx.save();
        ctx.translate(pn.x, pn.y);

        ctx.beginPath();
        ctx.moveTo(0, -faceH);
        ctx.lineTo(faceW, -faceH * 0.52);
        ctx.lineTo(faceW,  faceH * 0.52);
        ctx.lineTo(0,  faceH);
        ctx.lineTo(-faceW,  faceH * 0.52);
        ctx.lineTo(-faceW, -faceH * 0.52);
        ctx.closePath();

        var fg = ctx.createLinearGradient(-faceW, -faceH, faceW, faceH);
        fg.addColorStop(0, isFront ? 'rgba(224, 247, 255, 0.66)' : 'rgba(56, 189, 248, 0.28)');
        fg.addColorStop(0.45, isFront ? 'rgba(56, 189, 248, 0.46)' : 'rgba(37, 99, 235, 0.34)');
        fg.addColorStop(0.80, isFront ? 'rgba(37, 99, 235, 0.50)' : 'rgba(29, 78, 216, 0.38)');
        fg.addColorStop(1, isFront ? 'rgba(254, 240, 138, 0.58)' : 'rgba(180, 83, 9, 0.22)');
        ctx.globalAlpha = clamp(pAlpha, 0, 1);
        ctx.fillStyle = fg;
        ctx.fill();

        // 表面斜向彩虹冰白反光带 + 几何棱面高光线
        if (isFront) {
          ctx.save();
          ctx.clip();
          var bandX = sheenPos * domeR * 0.95 - (pn.x - c.x) * 0.4;
          var drawDiag = function (dxOff, bw, col, a) {
            ctx.fillStyle = col;
            ctx.globalAlpha = clamp(fade * a, 0, 1);
            ctx.beginPath();
            ctx.moveTo(bandX + dxOff - bw, -faceH * 1.35);
            ctx.lineTo(bandX + dxOff + bw, -faceH * 1.35);
            ctx.lineTo(bandX + dxOff - bw * 0.6 - 28, faceH * 1.35);
            ctx.lineTo(bandX + dxOff - bw * 2.6 - 28, faceH * 1.35);
            ctx.closePath();
            ctx.fill();
          };
          drawDiag(-12, 9, '#38BDF8', 0.56);
          drawDiag(-4,  7, '#A78BFA', 0.44);
          drawDiag( 4,  8, '#FFFFFF', 0.90);
          drawDiag(13,  6, '#FEF08A', 0.68);
          drawDiag(20,  4, '#F472B6', 0.34);

          ctx.strokeStyle = 'rgba(255,255,255,0.62)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(0, -faceH); ctx.lineTo(0, faceH);
          ctx.moveTo(-faceW, 0); ctx.lineTo(faceW, 0);
          ctx.stroke();
          ctx.restore();
        }

        ctx.globalAlpha = clamp(pAlpha * 1.05, 0, 1);
        ctx.strokeStyle = isFront ? '#1D4ED8' : '#1E3A8A';
        ctx.lineWidth = isFront ? 3.0 : 1.5;
        ctx.stroke();

        ctx.strokeStyle = isFront ? (pn.idx % 2 === 0 ? '#FEF08A' : '#7DD3FC') : '#60A5FA';
        ctx.lineWidth = isFront ? 1.45 : 0.85;
        ctx.stroke();

        if (isFront) {
          drawCrystalMote(ctx, 0, -faceH, 3.6, '#FEF08A', true, fade * 0.98, 0);
          drawCrystalMote(ctx, 0,  faceH, 3.0, '#7DD3FC', false, fade * 0.92, 0);
        }
        ctx.restore();
      }

      // 4. 六角棱镜脉冲轮廓（契合 6 面体冰盾几何，取代圆泡泡！）
      if (t >= 370 && t <= 840) {
        var pU = remap(t, 370, 840);
        var hRad = domeR * (0.96 + EASE.outQuart(pU) * 0.44);
        var hA = (1 - EASE.inQuad(pU)) * 0.88;
        ctx.save();
        ctx.translate(c.x, c.y - 4);
        ctx.rotate(PI / 6);
        ctx.beginPath();
        for (var hi = 0; hi <= 6; hi++) {
          var ha = (hi / 6) * TAU;
          var hx = Math.cos(ha) * hRad;
          var hy = Math.sin(ha) * hRad * 0.90;
          if (hi === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.globalAlpha = clamp(hA * 0.72, 0, 1);
        ctx.strokeStyle = '#1D4ED8';
        ctx.lineWidth = 3.8 * (1 - pU * 0.5);
        ctx.stroke();
        ctx.globalAlpha = clamp(hA * 0.95, 0, 1);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.6 * (1 - pU * 0.4);
        ctx.stroke();
        ctx.restore();
      }

      // 5. 外圈两道 3D 倾斜星轨环 — 前景半环
      draw3DOrbitRibbon(ctx, c.x, c.y - 6, domeR * 1.28, domeR * 0.38, 0.28, tSec * 2.2, {
        pass: 'front', alpha: fade * 0.98, count: 10, trailSteps: 7, dir: 1,
        ribbonOuter: '#1D4ED8', ribbonMain: '#38BDF8', ribbonCore: '#FFFFFF',
        palette: ['#FFFFFF', '#7DD3FC', '#38BDF8'], lineWidth: 2.3
      });
      draw3DOrbitRibbon(ctx, c.x, c.y + 4, domeR * 1.36, domeR * 0.42, -0.30, -tSec * 1.9 + 1.4, {
        pass: 'front', alpha: fade * 0.98, count: 10, trailSteps: 7, dir: -1,
        ribbonOuter: '#B45309', ribbonMain: '#FEF08A', ribbonCore: '#FFFFFF',
        palette: ['#FFFFFF', '#FEF08A', '#F59E0B', '#7DD3FC'], lineWidth: 2.3
      });

      // 6. 护体蓝金电光轻闪
      var eTick = Math.floor(t / 65);
      var arcCount = 4 + inst.ampTier;
      for (var e = 0; e < arcCount; e++) {
        var a0 = (e / arcCount) * TAU + tSec * 1.6;
        var a1 = a0 + 0.92;
        drawIceLightningArc(ctx,
          c.x + Math.cos(a0) * domeR * 0.98, c.y - 4 + Math.sin(a0) * domeR * 0.72,
          c.x + Math.cos(a1) * domeR * 0.98, c.y - 4 + Math.sin(a1) * domeR * 0.72,
          9, {
            outerColor: e % 2 === 0 ? '#1D4ED8' : '#B45309',
            midColor: e % 2 === 0 ? '#7DD3FC' : '#FEF08A',
            coreColor: '#FFFFFF',
            lineWidth: 1.7, alpha: fade * 0.88, seed: inst.seed + eTick * 37 + e * 53
          });
      }
    }
  };

  /* --------------------------------------------------------------------------
     [8] sword_send_slash — 送刀斩
     凌厉日系突进光带 + 横竖两段超宽冰青/香槟金月牙大斩弧 + 璀璨八芒星爆与高速飞散光火花
     -------------------------------------------------------------------------- */
  HANDLERS.sword_send_slash = {
    init: function (inst) {
      inst.data = { hHit: false, vHit: false };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var to = inst.to;
      if (!inst.data.hHit && t >= 280) {
        inst.data.hHit = true;
        inst.triggerImpact(0, to.x, to.y, 0.56);
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y, 24, {
          kind: 'sparkStreak', speedMin: 150, speedMax: 370, angMin: -0.75, angMax: 0.75,
          sizeMin: 5.5, sizeMax: 10.5, lifeMin: 300, lifeMax: 560, gravity: 90, drag: 0.942,
          colors: ['#7DD3FC', '#38BDF8', '#FEF08A'], rimColor: '#1D4ED8', goldRatio: 0.48
        });
      }
      if (!inst.data.vHit && t >= 445) {
        inst.data.vHit = true;
        inst.triggerImpact(1, to.x, to.y, 0.86 + inst.ampTier * 0.12);
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y - 4, 40 + inst.ampTier * 10, {
          kind: 'sparkStreak', speedMin: 150, speedMax: 420, sizeMin: 6.0, sizeMax: 12.0,
          lifeMin: 360, lifeMax: 660, gravity: 135, drag: 0.948,
          colors: ['#FEF08A', '#7DD3FC', '#38BDF8', '#FFFFFF'],
          rimColor: '#1D4ED8', goldRatio: 0.56
        });
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y - 4, 18, {
          kind: 'prismShard', speedMin: 105, speedMax: 280, sizeMin: 4.8, sizeMax: 10,
          lifeMin: 380, lifeMax: 620, gravity: 170, drag: 0.955,
          colors: ['#FFFFFF', '#FEF08A', '#7DD3FC', '#38BDF8'], goldRatio: 0.52
        });
        spawnBurstParticles(inst.particles, inst.rng, to.x, to.y - 4, 16, {
          kind: 'pixelDust', speedMin: 85, speedMax: 240, sizeMin: 2, sizeMax: 3.5,
          lifeMin: 300, lifeMax: 520, gravity: -20, colors: ['#FFFFFF', '#FEF08A', '#7DD3FC'], goldRatio: 0.5
        });
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var from = inst.from;
      var to = inst.to;

      // 1. 凌厉日系动画突进流光带（保持拉丝残光贯穿至 660ms，呈现极速突进到斩击的丝滑衔接！）
      var dashHead = EASE.outExpo(remap(t, 0, 230));
      var dashTail = EASE.inCubic(remap(t, 360, 680));
      var dashAlpha = 1 - remap(t, 490, 700);
      if (dashHead - dashTail > 0.02 && dashAlpha > 0.01) {
        var dPts = [];
        for (var i = 0; i <= 26; i++) {
          var u = lerp(dashTail, dashHead, i / 26);
          dPts.push({
            x: lerp(from.x - 16, to.x - 16, u),
            y: lerp(from.y + 6, to.y + 4, u) - Math.sin(u * PI) * 8
          });
        }
        drawCelRibbon(ctx, dPts, function (u) { return 4.2 + 16.5 * Math.pow(u, 0.88) * Math.sin(u * PI * 0.92 + 0.12); }, {
          alpha: dashAlpha * 0.94,
          outerColor: '#1D4ED8', midColor: '#38BDF8', headColor: '#FEF08A',
          prismColor: '#FEF08A', prismShift: -3.6, coreColor: '#FFFFFF'
        });

        for (var k = -1; k <= 1; k += 2) {
          var sPts = dPts.map(function (p, idx) {
            var u = idx / (dPts.length - 1);
            return { x: p.x - 10, y: p.y + k * (16 + 7 * u) };
          });
          drawCelRibbon(ctx, sPts, function (u) { return 3.4 * Math.sin(u * PI); }, {
            alpha: dashAlpha * 0.80,
            outerColor: k < 0 ? '#1D4ED8' : '#B45309',
            midColor: k < 0 ? '#7DD3FC' : '#FEF08A',
            headColor: '#FFFFFF', coreColor: '#FFFFFF'
          });
        }

        if (t < 360) {
          var bU = t / 360;
          draw3DShockwave(ctx, from.x - 6, from.y + 4, 10 + EASE.outQuart(bU) * 18, 22 + EASE.outQuart(bU) * 36, 0, {
            outerColor: '#1D4ED8', midColor: '#7DD3FC', prismColor: '#FEF08A', coreColor: '#FFFFFF',
            lineWidth: 2.6 * (1 - bU * 0.5), alpha: 1 - EASE.inQuad(bU)
          });
        }
      }

      // 2. 第一段：超宽横向冰青×香槟金月牙大斩弧
      if (t >= 210 && t <= 790) {
        var hU = remap(t, 210, 790);
        var hHead = EASE.outExpo(remap(t, 210, 380));
        var hTail = EASE.inCubic(remap(t, 365, 760));
        var hA = hU < 0.1 ? (hU / 0.1) : (1 - EASE.inQuad(remap(hU, 0.44, 1)));

        drawCrescentSlash(ctx, to.x - 6, to.y + 6, 128, 49, -0.09, PI * 1.12, -PI * 0.24, 35 + inst.ampTier * 3, {
          headT: hHead, tailT: hTail,
          rimColor: '#1D4ED8', rimHead: '#B45309',
          midColor: '#38BDF8', headColor: '#FEF08A',
          prismColor: '#FEF08A', coreColor: '#FFFFFF',
          accentLineColor: '#FFFBEB', alpha: hA
        });
      }

      // 3. 第二段：超宽竖斜向香槟金×冰青月牙大斩弧
      if (t >= 365 && t <= 950) {
        var vU = remap(t, 365, 950);
        var vHead = EASE.outExpo(remap(t, 365, 530));
        var vTail = EASE.inCubic(remap(t, 525, 930));
        var vA = vU < 0.1 ? (vU / 0.1) : (1 - EASE.inQuad(remap(vU, 0.46, 1)));

        drawCrescentSlash(ctx, to.x + 6, to.y - 4, 88, 116, 0.14, -PI * 0.82, PI * 0.52, 37 + inst.ampTier * 4, {
          headT: vHead, tailT: vTail,
          rimColor: '#B45309', rimHead: '#1D4ED8',
          midColor: '#F59E0B', headColor: '#FEF08A',
          prismColor: '#38BDF8', coreColor: '#FFFFFF',
          accentLineColor: '#FFFFFF', alpha: vA
        });
      }

      // 4. 瞬间绽放的璀璨八芒星爆 + 冲击波
      if (t >= 440) {
        var sMs = t - 440;
        var sU = remap(sMs, 0, 390);
        if (sU < 1) {
          var sEase = EASE.outQuart(sU);
          var sPop = sU < 0.18 ? EASE.outQuad(sU / 0.18) : (1 - EASE.inQuad((sU - 0.18) / 0.82));

          draw3DShockwave(ctx, to.x, to.y - 4, 24 + sEase * 98, 14 + sEase * 54, -0.24, {
            outerColor: '#B45309', midColor: '#FEF08A', prismColor: '#38BDF8', coreColor: '#FFFFFF',
            lineWidth: 4.1 * (1 - sU * 0.55), alpha: sPop, fillAlpha: 0.16 * (1 - sU), ticks: 12, tickRot: sMs * 0.002
          });

          drawAnimeStarburst(ctx, to.x, to.y - 4, (70 + inst.ampTier * 10) * (0.42 + 0.68 * sPop), 11.5, 8, sMs * 0.0025 + 0.2, {
            rimColor: '#1D4ED8', mainColor: '#FEF08A', prismColor: '#38BDF8', coreColor: '#FFFFFF',
            glowMid: 'rgba(245,158,11,0.50)', flareLen: 176 * sPop, alpha: sPop
          });
        }
      }
    }
  };

  /* --------------------------------------------------------------------------
     [9] wind_afterimage — 风行残像（精修：明澈分层三重青金残影 + 丝滑双螺旋翡翠冰白风带 + 飘飞风刃光瓣！）
     -------------------------------------------------------------------------- */
  HANDLERS.wind_afterimage = {
    init: function (inst) {
      inst.data = { burstFired: false };
    },
    update: function (inst) {
      var t = inst.elapsed;
      var c = inst.heroCenter;
      if (!inst.data.burstFired && t >= 240) {
        inst.data.burstFired = true;
        inst.triggerImpact(0, c.x + 36, c.y, 0.3);
        spawnBurstParticles(inst.particles, inst.rng, c.x + 64, c.y - 6, 32 + inst.ampTier * 8, {
          kind: 'windPetal', speedMin: 75, speedMax: 255, angMin: -PI * 0.68, angMax: PI * 0.38,
          spreadX: 80, spreadY: 44,
          sizeMin: 5.5, sizeMax: 12.5, lifeMin: 500, lifeMax: 860, gravity: -24, drag: 0.96, vrot: 7.5,
          colors: ['#5EEAD4', '#2DD4BF', '#A7F3D0', '#FFFFFF'],
          goldRatio: 0.34 + inst.ampTier * 0.08
        });
        spawnBurstParticles(inst.particles, inst.rng, c.x + 56, c.y, 18, {
          kind: 'pixelDust', speedMin: 60, speedMax: 200, angMin: -PI * 0.7, angMax: PI * 0.3,
          spreadX: 60, spreadY: 34,
          sizeMin: 2, sizeMax: 3.5, lifeMin: 380, lifeMax: 700, gravity: -32,
          colors: ['#5EEAD4', '#FFFFFF', '#FEF08A'], goldRatio: 0.38
        });
      }
    },
    render: function (ctx, inst) {
      var t = inst.elapsed;
      var tSec = t * 0.001;
      var c = inst.heroCenter;
      var gy = inst.groundY;

      var masterFade = t < 110 ? EASE.outCubic(t / 110) : (1 - remap(t, 860, 1180));
      if (masterFade <= 0.01) return;

      // 1. 脚下翠风气旋椭圆光环
      var groundPop = EASE.outQuart(clamp(t / 240, 0, 1));
      draw3DShockwave(ctx, c.x + 28, gy + 2, 58 * groundPop + tSec * 40, 15 * groundPop + tSec * 9, 0, {
        outerColor: '#0F766E', midColor: '#5EEAD4', prismColor: '#FEF08A', coreColor: '#FFFFFF',
        lineWidth: 2.6, alpha: masterFade * 0.9, fillAlpha: 0.14
      });

      // 2. 双螺旋高速风带 — 后景风丝
      var headU = EASE.outCubic(remap(t, 35, 660));
      var tailU = EASE.inQuad(remap(t, 440, 1140));
      var drawWindHelix = function (hx) {
        if (headU - tailU <= 0.03) return;
        var pts = [];
        for (var s = 0; s <= 50; s++) {
          var u = lerp(tailU, headU, s / 50);
          var spin = u * PI * 3.1 - tSec * 7.2 + hx.phase;
          var cxPath = c.x - 16 + u * 265 + Math.cos(spin) * hx.rx * (1 - u * 0.35);
          var cyPath = gy - 16 - u * 116 + Math.sin(spin) * hx.ry * (0.62 + 0.38 * Math.sin(u * PI));
          pts.push({ x: cxPath, y: cyPath });
        }
        drawCelRibbon(ctx, pts, function (u) {
          return hx.w * Math.sin(u * PI) * (0.48 + 0.62 * Math.pow(u, 0.55));
        }, {
          alpha: masterFade * hx.alpha,
          outerColor: hx.outer, midColor: hx.mid, headColor: hx.head,
          prismColor: hx.prism, prismShift: 2.5, coreColor: '#FFFFFF', coreScale: 0.44
        });
      };

      drawWindHelix({ phase: PI, rx: 52, ry: 36, outer: '#0284C7', mid: '#5EEAD4', head: '#E0F7FF', prism: '#FFFFFF', w: 9.5, alpha: 0.85 });

      // 3. 三重明澈青金流光残影（清晰扇形错落展开，绝不重叠成一团！）
      var drawAfterimage = function (ax, ay, scale, ghostAlpha, goldEdge) {
        if (ghostAlpha <= 0.01) return;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.scale(scale, scale);

        // 背后高速疾风速度拉丝
        var sGrad = ctx.createLinearGradient(-64, 0, 10, 0);
        sGrad.addColorStop(0, 'rgba(94, 234, 212, 0)');
        sGrad.addColorStop(0.55, 'rgba(45, 212, 191, 0.32)');
        sGrad.addColorStop(1, 'rgba(254, 240, 138, 0.46)');
        ctx.globalAlpha = clamp(ghostAlpha * 0.85, 0, 1);
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.moveTo(8, -44); ctx.lineTo(-62, -28); ctx.lineTo(-42, 0); ctx.lineTo(-66, 32); ctx.lineTo(10, 44);
        ctx.closePath();
        ctx.fill();

        // 轻盈优雅的风行千金幻影剪影（纤细灵动、长发披风向后飘扬）
        ctx.beginPath();
        ctx.moveTo(5, -45);
        ctx.quadraticCurveTo(16, -40, 14, -27);
        ctx.quadraticCurveTo(22, -16, 28, -5);
        ctx.quadraticCurveTo(18, 4, 15, 16);
        ctx.quadraticCurveTo(22, 34, 17, 46);
        ctx.lineTo(2, 42);
        ctx.quadraticCurveTo(-16, 44, -24, 34);
        ctx.quadraticCurveTo(-13, 15, -10, 2);
        ctx.quadraticCurveTo(-30, -8, -36, -20);
        ctx.quadraticCurveTo(-15, -24, -6, -34);
        ctx.quadraticCurveTo(-6, -45, 5, -45);
        ctx.closePath();

        var gFill = ctx.createLinearGradient(-26, -44, 24, 46);
        gFill.addColorStop(0, 'rgba(255, 255, 255, 0.84)');
        gFill.addColorStop(0.45, 'rgba(94, 234, 212, 0.54)');
        gFill.addColorStop(0.84, 'rgba(13, 148, 136, 0.42)');
        gFill.addColorStop(1, 'rgba(254, 240, 138, 0.54)');
        ctx.globalAlpha = clamp(ghostAlpha * 0.90, 0, 1);
        ctx.fillStyle = gFill;
        ctx.fill();

        ctx.strokeStyle = '#0F766E';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.strokeStyle = goldEdge ? '#FEF08A' : '#FFFFFF';
        ctx.lineWidth = 1.25;
        ctx.stroke();

        drawCrystalMote(ctx, 4, -20, 3.6, '#FFFFFF', true, ghostAlpha, 0);
        drawCrystalMote(ctx, -6, 12, 2.8, '#FEF08A', false, ghostAlpha * 0.9, 0.4);
        ctx.restore();
      };

      var ghosts = [
        { delay: 80,  dx: 54,  dy: -6,  sc: 0.88, gold: false },
        { delay: 165, dx: 118, dy: -20, sc: 0.94, gold: true  },
        { delay: 255, dx: 184, dy: -8,  sc: 1.00, gold: true  }
      ];
      for (var g = 0; g < ghosts.length; g++) {
        var gh = ghosts[g];
        if (t < gh.delay) continue;
        var gEase = EASE.outExpo(remap(t, gh.delay, gh.delay + 250));
        var gAlpha = masterFade * (0.48 + g * 0.22) * (0.88 + 0.12 * Math.sin(tSec * 8 + g));
        drawAfterimage(c.x + gh.dx * gEase, c.y + gh.dy * gEase, gh.sc, gAlpha, gh.gold);
      }

      // 4. 双螺旋高速风带 — 前景主翡翠青×冰白风带
      drawWindHelix({ phase: 0.0,  rx: 48, ry: 32, outer: '#0F766E', mid: '#14B8A6', head: '#5EEAD4', prism: '#FEF08A', w: 10.5, alpha: 0.94 });
      drawWindHelix({ phase: 1.55, rx: 38, ry: 22, outer: '#0D9488', mid: '#A7F3D0', head: '#FFFFFF', prism: '#FEF08A', w: 5.5,  alpha: 0.92 });

      // 5. 轻盈弯月风刃气流弧 + 翠金前锋星闪
      if (t >= 250 && t <= 920) {
        var wcU = remap(t, 250, 920);
        var wcA = Math.sin(wcU * PI) * 0.90;
        drawCrescentSlash(ctx, c.x + 126 + wcU * 52, c.y - 30, 74, 30, -0.22, -PI * 0.72, PI * 0.30, 14, {
          rimColor: '#0F766E', midColor: '#2DD4BF', headColor: '#5EEAD4', prismColor: '#FEF08A', coreColor: '#FFFFFF', alpha: wcA
        });
        drawCrescentSlash(ctx, c.x + 92 + wcU * 36, c.y + 26, 68, 26, 0.20, PI * 0.84, -PI * 0.26, 12, {
          rimColor: '#0284C7', midColor: '#5EEAD4', headColor: '#FFFFFF', prismColor: '#FEF08A', coreColor: '#FFFFFF', alpha: wcA * 0.85
        });
      }

      if (t >= 320 && t <= 780) {
        var fP = Math.sin(remap(t, 320, 780) * PI);
        drawAnimeStarburst(ctx, c.x + 196, c.y - 12, (34 + inst.ampTier * 7) * fP, 5.5, 4 + (inst.ampTier >= 2 ? 4 : 0), tSec * 2.2, {
          rimColor: '#0F766E', mainColor: '#5EEAD4', prismColor: '#FEF08A', coreColor: '#FFFFFF',
          glowMid: 'rgba(20,184,166,0.42)', flareLen: 92 * fP, alpha: fP * 0.92
        });
      }
    }
  };

  /* ==========================================================================
     7. 引擎实例化与统一对外接口
     ========================================================================== */
  function create(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('VfxEditionC.create(canvas): valid HTMLCanvasElement required');
    }
    var ctx = canvas.getContext('2d');
    var activeSpells = [];
    var lingeringParticles = [];
    var nextId = 1;
    var seedCounter = 20261126;
    var shakeTrauma = 0;
    var shakeClock = 0;

    function resolveAmpTier(opts) {
      if (typeof opts.ampTier === 'number' && Number.isFinite(opts.ampTier)) {
        return clamp(Math.round(opts.ampTier), 0, 3);
      }
      if (typeof opts.amp === 'number' && Number.isFinite(opts.amp)) {
        if (opts.amp >= 60) return 3;
        if (opts.amp >= 40) return 2;
        if (opts.amp >= 20) return 1;
        return 0;
      }
      return 0;
    }

    function play(skillId, options) {
      var opts = options || {};
      var spec = SKILL_MAP[skillId] || SKILL_MAP.ice_crystal;
      var handler = HANDLERS[spec.id];

      if (opts.replace) {
        activeSpells.length = 0;
        lingeringParticles.length = 0;
      }

      var fromPt = opts.from || opts.caster || opts.origin || { x: 200, y: 220 };
      var toPt = opts.to || opts.target || { x: 486, y: 226 };
      var heroCenter = opts.anchor || opts.heroCenter || (spec.targetMode === 'self'
        ? { x: (opts.from ? opts.from.x : 154), y: (opts.from ? opts.from.y : 226) }
        : { x: fromPt.x - 42, y: fromPt.y + 4 });

      var groundY = typeof opts.groundY === 'number'
        ? opts.groundY
        : Math.min(LOGICAL_H - 22, Math.max(fromPt.y, toPt.y) + 60);

      var targets;
      if (Array.isArray(opts.targets) && opts.targets.length > 0) {
        targets = opts.targets.map(function (pt) { return { x: pt.x, y: pt.y }; });
      } else {
        targets = [
          { x: clamp(toPt.x - 86, 260, LOGICAL_W - 140), y: toPt.y - 6 },
          { x: clamp(toPt.x,      300, LOGICAL_W - 80),  y: toPt.y },
          { x: clamp(toPt.x + 80, 340, LOGICAL_W - 44),  y: toPt.y + 8 }
        ];
      }

      var seed = typeof opts.seed === 'number' ? (opts.seed | 0) : ((seedCounter = (seedCounter + 1013) | 0));
      var ampTier = resolveAmpTier(opts);

      var inst = {
        id: nextId++,
        skillId: spec.id,
        spec: spec,
        handler: handler,
        opts: opts,
        from: { x: fromPt.x, y: fromPt.y },
        heroCenter: { x: heroCenter.x, y: heroCenter.y },
        to: { x: toPt.x, y: toPt.y },
        targets: targets,
        groundY: groundY,
        ampTier: ampTier,
        seed: seed,
        rng: createRng(seed),
        elapsed: 0,
        durationMs: typeof opts.durationMs === 'number' ? opts.durationMs : spec.durationMs,
        particles: [],
        data: {},
        triggerShake: function (amount) {
          shakeTrauma = Math.min(1, Math.max(shakeTrauma, amount || 0.4));
          if (typeof opts.onShake === 'function') opts.onShake(amount || 0.4);
        },
        triggerImpact: function (beatIdx, x, y, shakeAmt) {
          if (shakeAmt) this.triggerShake(shakeAmt);
          if (typeof opts.onImpact === 'function') {
            opts.onImpact(beatIdx, { skillId: spec.id, x: x, y: y, ampTier: ampTier });
          }
          if (typeof opts.onBeat === 'function') {
            opts.onBeat(beatIdx, 'impact', { skillId: spec.id, x: x, y: y, ampTier: ampTier });
          }
        }
      };

      handler.init(inst);
      activeSpells.push(inst);
      return inst.id;
    }

    function stepSingle(dtMs) {
      var dtSec = dtMs * 0.001;
      if (shakeTrauma > 0) {
        shakeTrauma = Math.max(0, shakeTrauma - 2.4 * dtSec);
        shakeClock += dtSec * 42;
      }

      updateParticles(lingeringParticles, dtSec);

      for (var i = activeSpells.length - 1; i >= 0; i--) {
        var inst = activeSpells[i];
        inst.elapsed += dtMs;
        inst.handler.update(inst, dtMs);
        updateParticles(inst.particles, dtSec);

        if (inst.elapsed >= inst.durationMs) {
          for (var k = 0; k < inst.particles.length; k++) {
            lingeringParticles.push(inst.particles[k]);
          }
          inst.particles.length = 0;
          activeSpells.splice(i, 1);
        }
      }
    }

    function update(dtMs) {
      var remain = Number(dtMs);
      if (!Number.isFinite(remain) || remain <= 0) return;
      var maxStep = 16.6667;
      var safety = 0;
      while (remain > 0.001 && safety < 600) {
        var step = remain > maxStep ? maxStep : remain;
        stepSingle(step);
        remain -= step;
        safety++;
      }
    }

    function render(renderOpts) {
      var rOpts = renderOpts || {};
      var cw = canvas.width || LOGICAL_W;
      var ch = canvas.height || LOGICAL_H;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!rOpts.preserveCanvas) {
        ctx.clearRect(0, 0, cw, ch);
      }

      var sx = cw / LOGICAL_W;
      var sy = ch / LOGICAL_H;
      ctx.scale(sx, sy);

      if (shakeTrauma > 0.01 && !rOpts.noShake) {
        var sq = shakeTrauma * shakeTrauma;
        ctx.translate(5.5 * sq * Math.sin(shakeClock * 1.7), 3.8 * sq * Math.cos(shakeClock * 2.3));
      }

      // 1. 增幅 3D 后景轨环
      for (var a = 0; a < activeSpells.length; a++) {
        renderAmpOverlay(ctx, activeSpells[a], 'back');
      }

      // 2. 活跃技能本体与专属粒子
      for (var i = 0; i < activeSpells.length; i++) {
        var inst = activeSpells[i];
        ctx.save();
        inst.handler.render(ctx, inst);
        ctx.restore();
        renderParticles(ctx, inst.particles);
      }

      // 3. 增幅 3D 前景轨环、冰雷与香槟金星霜叠层
      for (var b = 0; b < activeSpells.length; b++) {
        renderAmpOverlay(ctx, activeSpells[b], 'front');
      }

      // 4. 余韵折射星尘
      renderParticles(ctx, lingeringParticles);

      ctx.restore();
    }

    function clear() {
      activeSpells.length = 0;
      lingeringParticles.length = 0;
      shakeTrauma = 0;
      shakeClock = 0;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width || LOGICAL_W, canvas.height || LOGICAL_H);
      ctx.restore();
    }

    function isActive() {
      return activeSpells.length > 0 || lingeringParticles.length > 0;
    }

    function getDuration(skillId) {
      var spec = SKILL_MAP[skillId];
      return spec ? spec.durationMs : 1120;
    }

    function getPeakTime(skillId) {
      var spec = SKILL_MAP[skillId];
      return spec ? spec.peakMs : 560;
    }

    function seek(skillId, timeMs, opts) {
      clear();
      play(skillId, opts);
      update(Math.max(0, Number(timeMs) || 0));
      render({ noShake: true });
    }

    function getCameraShake() {
      var sq = shakeTrauma * shakeTrauma;
      return {
        x: 5.5 * sq * Math.sin(shakeClock * 1.7),
        y: 3.8 * sq * Math.cos(shakeClock * 2.3),
        trauma: shakeTrauma
      };
    }

    return {
      play: play,
      update: update,
      render: render,
      clear: clear,
      isActive: isActive,
      getDuration: getDuration,
      getPeakTime: getPeakTime,
      seek: seek,
      getCameraShake: getCameraShake
    };
  }

  return {
    meta: META,
    SKILLS: SKILLS,
    LOGICAL_WIDTH: LOGICAL_W,
    LOGICAL_HEIGHT: LOGICAL_H,
    create: create
  };
});
