/* ============================================================================
   《转生千金》新版 5 线进化法术高规格像素 VFX 引擎原型 (v3.1)
   输出：window.VfxSpellsV3（零外部依赖，自包含 IIFE / UMD）
   目标基准：《星之海 Sea of Stars》×《八方旅人 Octopath Traveler》高对比像素特效
   - 逻辑像素缓冲：480×270 整数像素软光栅（Uint32Array + 4×4 Bayer 有序抖动）
   - 专攻雪瓷冰白浅色战场（#FAFBFD / #EFF5FD）：深靛蓝/深海钴 1px 硬轮廓衬影 +
     饱和皇家蓝/冰青主体 + 节制冰白刀锋/棱脊高光 + 蓝金星霜折射（绝无纯白糊团）
   - 完整覆盖 10 招核心新版技能（含冰盾护御线 Lv1/Lv2/Lv3 三阶进化）
   - 全技能独立四段节奏（起手→飞行/展开→命中爆裂→落地残痕）+ timingGrade × ampTier 缩放
   - 完整微顿帧 (onHitStop) / 微震屏 (onShake) / 多拍命中 (onImpact/onBeat) 钩子
   ============================================================================ */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined' && root) {
    root.VfxSpellsV3 = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var VERSION = '3.1.0';
  var LOGICAL_WIDTH = 480;
  var LOGICAL_HEIGHT = 270;

  /* -------------------- 高对比雪瓷战场像素调色板 -------------------- */
  var PALETTE = {
    // 冰晶主色（深靛硬描边 -> 皇家蓝核心 -> 冰青折射 -> 极细冰白高光脊）
    inkDeep:     '#081332',
    inkIndigo:   '#10265E',
    navyShadow:  '#163888',
    royalBlue:   '#1658EB',
    cobaltMid:   '#287BF8',
    glacier:     '#2AB7F0',
    iceCyan:     '#70E2FD',
    icePale:     '#CCF0FF',
    iceWhite:    '#F6FCFF',

    // 水系破局（深海靛描边 -> 澄澈钴蓝水体 -> 碧青透光 -> 清脆浪沫高光）
    waterInk:    '#082046',
    waterDeep:   '#0D447E',
    waterMid:    '#147BC9',
    waterBright: '#24B9E3',
    waterFoam:   '#9AF0FF',
    waterGlint:  '#F3FDFF',

    // 霜域与钢冰（冷灰蓝暗影保证在雪瓷白上极高辨识度）
    frostInk:    '#162A56',
    frostSlate:  '#32589C',
    frostPeriw:  '#5C90DA',
    frostMist:   '#9ACBF6',
    steelDark:   '#1B335E',
    steelMid:    '#4572AD',
    steelLight:  '#A3CEF0',

    // 香槟金与星霜折射（亮丽香槟金而非沉暗土棕，配深古铜细描边在雪白底上如珠宝镶棱）
    goldInk:     '#6E470D',
    goldDeep:    '#B97E1B',
    goldMid:     '#EBB944',
    goldBright:  '#FCE28B',
    goldWhite:   '#FFFBE6',

    // 地面投影与冷痕加深
    groundShade: '#B6C9E2',
    groundDeep:  '#6D8AB8',
  };

  /* -------------------- 字节序与颜色工具 -------------------- */
  var IS_LITTLE_ENDIAN = (function () {
    var ab = new ArrayBuffer(4);
    var u32 = new Uint32Array(ab);
    var u8 = new Uint8Array(ab);
    u32[0] = 0x0a0b0c0d;
    return u8[0] === 0x0d;
  })();

  function parseHexRGBA(hex, alphaByte) {
    var h = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
    var r = parseInt(h.slice(0, 2), 16) & 255;
    var g = parseInt(h.slice(2, 4), 16) & 255;
    var b = parseInt(h.slice(4, 6), 16) & 255;
    var a = alphaByte === undefined ? 255 : (alphaByte & 255);
    return packRGBA(r, g, b, a);
  }

  function packRGBA(r, g, b, a) {
    if (IS_LITTLE_ENDIAN) {
      return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
    }
    return ((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | (a & 255);
  }

  function unpackR(c) { return IS_LITTLE_ENDIAN ? (c & 255) : ((c >>> 24) & 255); }
  function unpackG(c) { return IS_LITTLE_ENDIAN ? ((c >>> 8) & 255) : ((c >>> 16) & 255); }
  function unpackB(c) { return IS_LITTLE_ENDIAN ? ((c >>> 16) & 255) : ((c >>> 8) & 255); }
  function unpackA(c) { return IS_LITTLE_ENDIAN ? ((c >>> 24) & 255) : (c & 255); }

  var C = {};
  (function initPackedPalette() {
    var keys = Object.keys(PALETTE);
    for (var i = 0; i < keys.length; i++) {
      C[keys[i]] = parseHexRGBA(PALETTE[keys[i]], 255);
    }
  })();

  /* -------------------- 数学、缓动与确定性随机数 -------------------- */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInQuad(t) { return t * t; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function easeOutCubic(t) { var u = 1 - t; return 1 - u * u * u; }
  function easeOutBack(t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    var u = t - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
  }

  function quadBezier(p0, p1, p2, t) {
    var u = 1 - t;
    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
  }

  function quadBezierDeriv(p0, p1, p2, t) {
    return 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1);
  }

  function createRng(seed) {
    var a = (seed >>> 0) || 1337;
    return function next() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* -------------------- 时机评级 (timingGrade) × 增幅阶次 (ampTier) 缩放模型 -------------------- */
  var TIMING_PROFILES = {
    bad:     { grade: 'bad',     scale: 0.78, density: 0.62, goldMix: 0.00, shake: 0.62, hitStop: 0.65, glint: 0.55 },
    good:    { grade: 'good',    scale: 1.00, density: 1.00, goldMix: 0.08, shake: 1.00, hitStop: 1.00, glint: 1.00 },
    great:   { grade: 'great',   scale: 1.13, density: 1.24, goldMix: 0.35, shake: 1.18, hitStop: 1.16, glint: 1.30 },
    perfect: { grade: 'perfect', scale: 1.24, density: 1.48, goldMix: 0.72, shake: 1.36, hitStop: 1.32, glint: 1.62 },
  };

  var AMP_PROFILES = [
    { tier: 0, rings: 1, density: 1.00, scale: 1.00, arcs: 0, goldAura: false, cyanBoost: false },
    { tier: 1, rings: 1, density: 1.18, scale: 1.06, arcs: 0, goldAura: false, cyanBoost: true  },
    { tier: 2, rings: 2, density: 1.36, scale: 1.12, arcs: 3, goldAura: false, cyanBoost: true  },
    { tier: 3, rings: 3, density: 1.54, scale: 1.18, arcs: 6, goldAura: true,  cyanBoost: true  },
  ];

  function resolveModifiers(timingGrade, ampTier, userScale) {
    var tp = TIMING_PROFILES[timingGrade] || TIMING_PROFILES.good;
    var tierIdx = clamp(Math.round(Number(ampTier) || 0), 0, 3);
    var ap = AMP_PROFILES[tierIdx];
    var uScale = (typeof userScale === 'number' && userScale > 0) ? userScale : 1.0;
    return {
      timing: tp,
      amp: ap,
      timingGrade: tp.grade,
      ampTier: tierIdx,
      scale: tp.scale * ap.scale * uScale,
      density: tp.density * ap.density,
      gold: clamp(tp.goldMix + (ap.goldAura ? 0.50 : (tierIdx === 2 ? 0.14 : 0)), 0, 1),
      shake: tp.shake * (1 + tierIdx * 0.14),
      hitStop: tp.hitStop * (1 + tierIdx * 0.10),
      glint: tp.glint * (1 + tierIdx * 0.18),
    };
  }

  /* -------------------- 4×4 Bayer 有序像素抖动矩阵 -------------------- */
  var BAYER_4X4 = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5,
  ];

  /* -------------------- 精致手工像素雪花贴图（5×5 / 7×7 / 9×9） -------------------- */
  var SNOWFLAKE_STAMPS = {
    5: [
      '..#..',
      '.#.#.',
      '#####',
      '.#.#.',
      '..#..',
    ],
    7: [
      '...#...',
      '.#.#.#.',
      '..###..',
      '#######',
      '..###..',
      '.#.#.#.',
      '...#...',
    ],
    9: [
      '....#....',
      '.#..#..#.',
      '..#.#.#..',
      '...###...',
      '#########',
      '...###...',
      '..#.#.#..',
      '.#..#..#.',
      '....#....',
    ],
  };

  /* -------------------- 高性能整数像素软光栅缓冲 (PixelSurface) -------------------- */
  function PixelSurface(width, height) {
    this.width = width | 0;
    this.height = height | 0;
    this.imageData = null;
    this.u8 = new Uint8ClampedArray(this.width * this.height * 4);
    this.u32 = new Uint32Array(this.u8.buffer);
  }

  PixelSurface.prototype.bindImageData = function (ctx) {
    if (!ctx) return;
    if (!this.imageData || this.imageData.width !== this.width || this.imageData.height !== this.height) {
      this.imageData = ctx.createImageData(this.width, this.height);
      this.u8 = this.imageData.data;
      this.u32 = new Uint32Array(this.u8.buffer);
    }
  };

  PixelSurface.prototype.clear = function () {
    this.u32.fill(0);
  };

  PixelSurface.prototype.px = function (x, y, col, alpha) {
    var ix = x | 0;
    var iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    var idx = iy * this.width + ix;
    if (alpha === undefined || alpha >= 0.996) {
      this.u32[idx] = col;
      return;
    }
    if (alpha <= 0.004) return;
    var sa = (alpha * 255) | 0;
    var dst = this.u32[idx];
    var da = unpackA(dst);
    if (da === 0) {
      this.u32[idx] = packRGBA(unpackR(col), unpackG(col), unpackB(col), sa);
      return;
    }
    var sr = unpackR(col), sg = unpackG(col), sb = unpackB(col);
    var dr = unpackR(dst), dg = unpackG(dst), db = unpackB(dst);
    var inv = 255 - sa;
    var drW = (da * inv + 127) >> 8;
    var outA = sa + drW;
    if (outA <= 0) return;
    var outR = ((sr * sa + dr * drW) / outA) | 0;
    var outG = ((sg * sa + dg * drW) / outA) | 0;
    var outB = ((sb * sa + db * drW) / outA) | 0;
    this.u32[idx] = packRGBA(outR, outG, outB, outA > 255 ? 255 : outA);
  };

  PixelSurface.prototype.pxDither = function (x, y, col, coverage, alpha) {
    var ix = x | 0;
    var iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    if (coverage <= 0.02) return;
    if (coverage < 0.99) {
      var threshold = (BAYER_4X4[((iy & 3) << 2) | (ix & 3)] + 0.5) / 16;
      if (coverage < threshold) return;
    }
    this.px(ix, iy, col, alpha === undefined ? 1 : alpha);
  };

  PixelSurface.prototype.line = function (x0, y0, x1, y1, col, alpha, dither) {
    var ix0 = Math.round(x0), iy0 = Math.round(y0);
    var ix1 = Math.round(x1), iy1 = Math.round(y1);
    var dx = Math.abs(ix1 - ix0);
    var dy = -Math.abs(iy1 - iy0);
    var sx = ix0 < ix1 ? 1 : -1;
    var sy = iy0 < iy1 ? 1 : -1;
    var err = dx + dy;
    var useDither = dither !== undefined && dither < 0.99;
    while (true) {
      if (useDither) this.pxDither(ix0, iy0, col, dither, alpha);
      else this.px(ix0, iy0, col, alpha);
      if (ix0 === ix1 && iy0 === iy1) break;
      var e2 = err << 1;
      if (e2 >= dy) { err += dy; ix0 += sx; }
      if (e2 <= dx) { err += dx; iy0 += sy; }
    }
  };

  // 优化版高速胶囊粗线（避免逐像素重复画整圆，提速 4× 以上且边缘完全一致锐利）
  PixelSurface.prototype.thickLine = function (x0, y0, x1, y1, radius, col, alpha, dither) {
    var r = Math.max(0, radius);
    if (r < 0.65) {
      this.line(x0, y0, x1, y1, col, alpha, dither);
      return;
    }
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.hypot(dx, dy);
    if (len < 0.6) {
      this.fillCircle(x0, y0, r, col, null, alpha, dither);
      return;
    }
    var nx = (-dy / len) * r;
    var ny = (dx / len) * r;
    this.fillPoly([
      [x0 + nx, y0 + ny],
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
      [x0 - nx, y0 - ny],
    ], col, null, alpha, dither);
    if (r >= 1.3) {
      this.fillCircle(x1, y1, r, col, null, alpha, dither);
    }
  };

  PixelSurface.prototype.fillPoly = function (pts, fillCol, outlineCol, alpha, dither) {
    var n = pts.length;
    if (n < 3) return;
    var minY = 1e9, maxY = -1e9;
    for (var i = 0; i < n; i++) {
      var py = pts[i][1];
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    var yStart = Math.max(0, Math.floor(minY));
    var yEnd = Math.min(this.height - 1, Math.ceil(maxY));
    var nodes = [];
    var useDither = dither !== undefined && dither < 0.99;

    if (fillCol !== null && fillCol !== undefined) {
      for (var y = yStart; y <= yEnd; y++) {
        nodes.length = 0;
        var fy = y + 0.5;
        for (var j = 0, k = n - 1; j < n; k = j++) {
          var y1 = pts[j][1], y2 = pts[k][1];
          if ((y1 <= fy && y2 > fy) || (y2 <= fy && y1 > fy)) {
            var x1 = pts[j][0], x2 = pts[k][0];
            nodes.push(x1 + ((fy - y1) / (y2 - y1)) * (x2 - x1));
          }
        }
        if (nodes.length < 2) continue;
        nodes.sort(function (a, b) { return a - b; });
        for (var m = 0; m + 1 < nodes.length; m += 2) {
          var xs = Math.max(0, Math.ceil(nodes[m] - 0.5));
          var xe = Math.min(this.width - 1, Math.floor(nodes[m + 1] + 0.5));
          for (var x = xs; x <= xe; x++) {
            if (useDither) this.pxDither(x, y, fillCol, dither, alpha);
            else this.px(x, y, fillCol, alpha);
          }
        }
      }
    }

    if (outlineCol !== null && outlineCol !== undefined) {
      for (var e = 0; e < n; e++) {
        var a = pts[e];
        var b = pts[(e + 1) % n];
        this.line(a[0], a[1], b[0], b[1], outlineCol, alpha, dither);
      }
    }
  };

  PixelSurface.prototype.strokePoly = function (pts, col, alpha, dither, open) {
    var n = pts.length;
    var count = open ? n - 1 : n;
    for (var i = 0; i < count; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % n];
      this.line(a[0], a[1], b[0], b[1], col, alpha, dither);
    }
  };

  PixelSurface.prototype.fillCircle = function (cx, cy, r, fillCol, outlineCol, alpha, dither) {
    var ir = Math.round(r);
    if (ir <= 0) {
      this.px(Math.round(cx), Math.round(cy), outlineCol || fillCol, alpha);
      return;
    }
    var icx = Math.round(cx), icy = Math.round(cy);
    var r2 = (r + 0.25) * (r + 0.25);
    var innerR = Math.max(0, r - 0.95);
    var innerR2 = innerR * innerR;
    var useDither = dither !== undefined && dither < 0.99;

    for (var oy = -ir; oy <= ir; oy++) {
      var py = icy + oy;
      if (py < 0 || py >= this.height) continue;
      for (var ox = -ir; ox <= ir; ox++) {
        var d2 = ox * ox + oy * oy;
        if (d2 > r2) continue;
        var px = icx + ox;
        if (px < 0 || px >= this.width) continue;
        var col = (outlineCol != null && d2 >= innerR2) ? outlineCol : fillCol;
        if (col == null) continue;
        if (useDither) this.pxDither(px, py, col, dither, alpha);
        else this.px(px, py, col, alpha);
      }
    }
  };

  PixelSurface.prototype.fillEllipse = function (cx, cy, rx, ry, fillCol, outlineCol, alpha, dither) {
    if (rx <= 0.5 || ry <= 0.5) return;
    var irx = Math.ceil(rx), iry = Math.ceil(ry);
    var icx = Math.round(cx), icy = Math.round(cy);
    var invRx2 = 1 / (rx * rx);
    var invRy2 = 1 / (ry * ry);
    var inRx = Math.max(0.1, rx - 1.05);
    var inRy = Math.max(0.1, ry - 1.05);
    var invInRx2 = 1 / (inRx * inRx);
    var invInRy2 = 1 / (inRy * inRy);
    var useDither = dither !== undefined && dither < 0.99;

    for (var oy = -iry; oy <= iry; oy++) {
      var py = icy + oy;
      if (py < 0 || py >= this.height) continue;
      var dy2 = oy * oy * invRy2;
      for (var ox = -irx; ox <= irx; ox++) {
        var norm = ox * ox * invRx2 + dy2;
        if (norm > 1.02) continue;
        var px = icx + ox;
        if (px < 0 || px >= this.width) continue;
        var isEdge = outlineCol != null && (ox * ox * invInRx2 + oy * oy * invInRy2 >= 1.0);
        var col = isEdge ? outlineCol : fillCol;
        if (col == null) continue;
        if (useDither) this.pxDither(px, py, col, dither, alpha);
        else this.px(px, py, col, alpha);
      }
    }
  };

  PixelSurface.prototype.strokeEllipse = function (cx, cy, rx, ry, col, alpha, dither, startAng, endAng) {
    if (rx <= 0.4 || ry <= 0.4) return;
    var a0 = startAng === undefined ? 0 : startAng;
    var a1 = endAng === undefined ? Math.PI * 2 : endAng;
    var span = Math.abs(a1 - a0);
    var steps = Math.max(16, Math.ceil(Math.max(rx, ry) * span * 2.2));
    var useDither = dither !== undefined && dither < 0.99;
    var prevX = 1e9, prevY = 1e9;
    for (var i = 0; i <= steps; i++) {
      var ang = a0 + (a1 - a0) * (i / steps);
      var px = Math.round(cx + Math.cos(ang) * rx);
      var py = Math.round(cy + Math.sin(ang) * ry);
      if (px !== prevX || py !== prevY) {
        if (useDither) this.pxDither(px, py, col, dither, alpha);
        else this.px(px, py, col, alpha);
        prevX = px;
        prevY = py;
      }
    }
  };

  /* -------------------- 精雕高阶像素艺术构件 (Sea of Stars × Octopath) -------------------- */

  // 1. 多面切角宝石冰晶（支持纯冰晶 / 蓝金双色星霜棱晶 / 纯香槟金星棱三档，绝不发棕发闷）
  PixelSurface.prototype.drawFacetedCrystal = function (cx, cy, halfLen, halfWid, angle, goldTint, alpha) {
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    function pt(lx, ly) {
      return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];
    }

    var tipFront = pt(halfLen, 0);
    var shoulderTop = pt(halfLen * 0.22, -halfWid);
    var rearTop = pt(-halfLen * 0.58, -halfWid * 0.62);
    var tipBack = pt(-halfLen * 0.92, 0);
    var rearBot = pt(-halfLen * 0.58, halfWid * 0.62);
    var shoulderBot = pt(halfLen * 0.22, halfWid);
    var midCenter = pt(halfLen * 0.08, 0);
    var midBack = pt(-halfLen * 0.42, 0);

    var pureGold = goldTint >= 0.86;
    var blueGoldHybrid = goldTint >= 0.38 && !pureGold;

    var outline   = pureGold ? C.goldInk : C.inkDeep;
    var darkCol   = pureGold ? C.goldDeep : C.navyShadow;
    var midCol    = pureGold ? C.goldMid : C.royalBlue;
    var brightCol = pureGold ? C.goldBright : (blueGoldHybrid ? C.glacier : C.glacier);
    var hiCol     = pureGold ? C.goldWhite : (blueGoldHybrid ? C.goldBright : C.iceCyan);
    var ridgeCol  = (pureGold || blueGoldHybrid) ? C.goldWhite : C.iceWhite;
    var tailCol   = pureGold ? C.goldMid : C.cobaltMid;

    var polyAll = [tipFront, shoulderTop, rearTop, tipBack, rearBot, shoulderBot];
    this.fillPoly(polyAll, midCol, null, alpha);
    // 上左迎光切面
    this.fillPoly([tipFront, shoulderTop, rearTop, midBack, midCenter], brightCol, null, alpha);
    // 顶部斜棱高光三角（蓝金混合模式下在此镶嵌香槟金折射面！）
    this.fillPoly([tipFront, shoulderTop, midCenter], hiCol, null, alpha);
    // 下右背光深影面
    this.fillPoly([tipFront, midCenter, midBack, rearBot, shoulderBot], darkCol, null, alpha);
    // 尾端折光面
    this.fillPoly([rearTop, tipBack, rearBot, midBack], tailCol, null, alpha);

    // 1px 极细高光棱脊
    this.line(midBack[0], midBack[1], tipFront[0], tipFront[1], ridgeCol, alpha);
    this.line(shoulderTop[0], shoulderTop[1], midCenter[0], midCenter[1], ridgeCol, alpha);
    // 1px 深靛/古铜硬描边
    this.strokePoly(polyAll, outline, alpha);
  };

  // 2. 四角/八角高对比像素星芒
  PixelSurface.prototype.drawStarGlint = function (cx, cy, rLong, rShort, goldMode, alpha) {
    var icx = Math.round(cx), icy = Math.round(cy);
    var rL = Math.max(2, Math.round(rLong));
    var rS = Math.max(1, Math.round(rShort || rLong * 0.42));
    var ink = goldMode ? C.goldInk : C.inkIndigo;
    var mid = goldMode ? C.goldMid : C.royalBlue;
    var hi = goldMode ? C.goldBright : C.iceCyan;
    var core = goldMode ? C.goldWhite : C.iceWhite;

    this.line(icx - rL - 1, icy, icx + rL + 1, icy, ink, (alpha || 1) * 0.72);
    this.line(icx, icy - rL - 1, icx, icy + rL + 1, ink, (alpha || 1) * 0.72);
    if (rL >= 6) {
      this.px(icx - 1, icy - 1, ink, alpha);
      this.px(icx + 1, icy - 1, ink, alpha);
      this.px(icx - 1, icy + 1, ink, alpha);
      this.px(icx + 1, icy + 1, ink, alpha);
    }

    this.line(icx - rL, icy, icx + rL, icy, mid, alpha);
    this.line(icx, icy - rL, icx, icy + rL, mid, alpha);
    var rIn = Math.max(1, Math.round(rL * 0.6));
    this.line(icx - rIn, icy, icx + rIn, icy, hi, alpha);
    this.line(icx, icy - rIn, icx, icy + rIn, hi, alpha);

    if (rS >= 2) {
      this.line(icx - rS, icy - rS, icx + rS, icy + rS, mid, (alpha || 1) * 0.85);
      this.line(icx - rS, icy + rS, icx + rS, icy - rS, mid, (alpha || 1) * 0.85);
    }
    this.px(icx, icy, core, alpha);
    if (rL >= 7) {
      this.px(icx - 1, icy, core, alpha);
      this.px(icx + 1, icy, core, alpha);
      this.px(icx, icy - 1, core, alpha);
      this.px(icx, icy + 1, core, alpha);
    }
  };

  // 3. 精致手工微型旋转冰花印章
  PixelSurface.prototype.drawSnowflake = function (cx, cy, sizeKey, rot45, alpha, goldAccent) {
    var stamp = SNOWFLAKE_STAMPS[sizeKey] || SNOWFLAKE_STAMPS[7];
    var h = stamp.length;
    var w = stamp[0].length;
    var half = (w - 1) >> 1;
    var icx = Math.round(cx), icy = Math.round(cy);
    var outlineCol = goldAccent ? C.goldDeep : C.inkIndigo;
    var bodyCol = goldAccent ? C.goldBright : C.glacier;
    var coreCol = goldAccent ? C.goldWhite : C.icePale;

    for (var y = 0; y < h; y++) {
      var row = stamp[y];
      for (var x = 0; x < w; x++) {
        if (row.charCodeAt(x) !== 35) continue;
        var ox = x - half;
        var oy = y - half;
        var rx = rot45 ? Math.round((ox - oy) * 0.72) : ox;
        var ry = rot45 ? Math.round((ox + oy) * 0.72) : oy;
        this.px(icx + rx, icy + ry + 1, outlineCol, (alpha || 1) * 0.85);
        this.px(icx + rx + 1, icy + ry, outlineCol, (alpha || 1) * 0.62);
      }
    }
    for (var y2 = 0; y2 < h; y2++) {
      var row2 = stamp[y2];
      for (var x2 = 0; x2 < w; x2++) {
        if (row2.charCodeAt(x2) !== 35) continue;
        var ox2 = x2 - half;
        var oy2 = y2 - half;
        var rx2 = rot45 ? Math.round((ox2 - oy2) * 0.72) : ox2;
        var ry2 = rot45 ? Math.round((ox2 + oy2) * 0.72) : oy2;
        var isCenter = Math.abs(ox2) <= 1 && Math.abs(oy2) <= 1;
        this.px(icx + rx2, icy + ry2, isCenter ? coreCol : bodyCol, alpha);
      }
    }
  };

  // 4. 冰雷折线电弧（二/三阶魔力增幅）
  PixelSurface.prototype.drawIceLightning = function (x0, y0, x1, y1, seed, goldMode, alpha) {
    var rng = createRng(seed);
    var segs = 5;
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var pts = [[x0, y0]];
    for (var i = 1; i < segs; i++) {
      var f = i / segs;
      var jitter = (rng() - 0.5) * Math.min(11, len * 0.28);
      pts.push([x0 + dx * f + nx * jitter, y0 + dy * f + ny * jitter]);
    }
    pts.push([x1, y1]);
    var ink = goldMode ? C.goldInk : C.inkIndigo;
    var body = goldMode ? C.goldBright : C.iceCyan;
    var core = goldMode ? C.goldWhite : C.iceWhite;
    for (var j = 0; j < pts.length - 1; j++) {
      this.line(pts[j][0], pts[j][1] + 1, pts[j + 1][0], pts[j + 1][1] + 1, ink, (alpha || 1) * 0.75);
      this.line(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], body, alpha);
      if (j === 1 || j === 2) {
        this.px((pts[j][0] + pts[j + 1][0]) * 0.5, (pts[j][1] + pts[j + 1][1]) * 0.5, core, alpha);
      }
    }
  };

  // 5. 清澈多层次像素水球（深海蓝外轮廓 + 旋转暗月牙 + 澄澈碧青透光心 + 弯月高光点）
  PixelSurface.prototype.drawLiquidOrb = function (cx, cy, rx, ry, spinPhase, alpha) {
    var irx = Math.ceil(rx + 1), iry = Math.ceil(ry + 1);
    var icx = Math.round(cx), icy = Math.round(cy);
    var swirlX = Math.cos(spinPhase) * rx * 0.34;
    var swirlY = Math.sin(spinPhase) * ry * 0.28;

    for (var oy = -iry; oy <= iry; oy++) {
      var py = icy + oy;
      if (py < 0 || py >= this.height) continue;
      for (var ox = -irx; ox <= irx; ox++) {
        var px = icx + ox;
        if (px < 0 || px >= this.width) continue;
        var nx = ox / rx;
        var ny = oy / ry;
        var d2 = nx * nx + ny * ny;
        if (d2 > 1.06) continue;

        var col;
        if (d2 > 0.77) {
          col = C.waterInk;
        } else if (nx * 0.65 + ny * 0.75 > 0.34) {
          col = C.waterDeep;
        } else {
          var sd = Math.hypot(ox - swirlX, oy - swirlY) / Math.max(2, rx * 0.72);
          if (nx < -0.14 && ny < -0.18 && d2 < 0.54) {
            col = C.waterBright;
          } else if (sd < 0.56) {
            col = C.waterBright;
          } else {
            col = C.waterMid;
          }
        }
        this.px(px, py, col, alpha);
      }
    }

    var gx = Math.round(cx - rx * 0.36);
    var gy = Math.round(cy - ry * 0.34);
    this.px(gx, gy, C.waterGlint, alpha);
    this.px(gx + 1, gy, C.waterGlint, alpha);
    this.px(gx, gy + 1, C.waterFoam, alpha);
    if (rx >= 8) {
      this.px(gx + 2, gy - 1, C.waterFoam, alpha);
      this.px(gx - 1, gy + 2, C.waterFoam, alpha);
    }
    var bx = Math.round(cx + rx * 0.28);
    var by = Math.round(cy + ry * 0.32);
    this.px(bx, by, C.waterFoam, (alpha || 1) * 0.9);
    this.px(bx - 1, by + 1, C.waterBright, (alpha || 1) * 0.9);
  };

  // 6. 地面透视六角几何霜阵 / 魔力刻度环
  PixelSurface.prototype.drawFloorHexSeal = function (cx, cy, rx, ry, rot, progress, goldMode, alpha, ticks) {
    var a = (alpha === undefined ? 1 : alpha) * clamp(progress, 0, 1);
    if (a <= 0.02 || rx < 2) return;
    var outerInk = goldMode ? C.goldInk : C.frostInk;
    var ringCol = goldMode ? C.goldMid : C.royalBlue;
    var innerCol = goldMode ? C.goldBright : C.glacier;

    this.strokeEllipse(cx, cy + 1, rx, ry, outerInk, a * 0.58);
    this.strokeEllipse(cx, cy, rx, ry, ringCol, a * 0.92);
    if (rx > 12) {
      this.strokeEllipse(cx, cy, rx * 0.74, ry * 0.74, innerCol, a * 0.82);
    }

    var pts = [];
    for (var i = 0; i < 6; i++) {
      var ang = rot + (Math.PI * 2 * i) / 6;
      pts.push([cx + Math.cos(ang) * rx * 0.94, cy + Math.sin(ang) * ry * 0.94]);
    }
    this.strokePoly(pts, outerInk, a * 0.72);
    for (var j = 0; j < 6; j++) {
      var pA = pts[j];
      var pB = pts[(j + 2) % 6];
      this.line(pA[0], pA[1], pB[0], pB[1], ringCol, a * 0.75);
      if (ticks) {
        var angT = rot + (Math.PI * 2 * j) / 6;
        var tx0 = cx + Math.cos(angT) * rx * 0.76;
        var ty0 = cy + Math.sin(angT) * ry * 0.76;
        var tx1 = cx + Math.cos(angT) * rx * 1.14;
        var ty1 = cy + Math.sin(angT) * ry * 1.14;
        this.line(tx0, ty0, tx1, ty1, outerInk, a * 0.85);
        this.px(tx1, ty1, innerCol, a);
      }
    }
  };

  // 7. 施法起手聚能法环（随 ampTier 升级至 3 环香槟金 + 冰雷电弧）
  PixelSurface.prototype.drawCastSeal = function (cx, cy, progress, mods, seed, waterTheme) {
    if (progress <= 0 || progress >= 1) return;
    var env = Math.sin(progress * Math.PI);
    var rBase = (8 + 8 * easeOutCubic(Math.min(1, progress * 1.6))) * mods.scale;
    var ink = waterTheme ? C.waterInk : (mods.amp.goldAura ? C.goldInk : C.inkIndigo);
    var main = waterTheme ? C.waterMid : (mods.amp.goldAura ? C.goldMid : C.royalBlue);
    var hi = waterTheme ? C.waterBright : (mods.amp.goldAura ? C.goldBright : C.iceCyan);
    var spin = progress * Math.PI * 2.2;

    var rx = rBase * 0.55;
    var ry = rBase;
    this.strokeEllipse(cx, cy + 1, rx, ry, ink, env * 0.65);
    this.strokeEllipse(cx, cy, rx, ry, main, env * 0.95);

    for (var i = 0; i < 4; i++) {
      var a = spin + (i * Math.PI) / 2;
      var nx = cx + Math.cos(a) * rx;
      var ny = cy + Math.sin(a) * ry;
      this.px(nx, ny + 1, ink, env);
      this.px(nx, ny, hi, env);
    }

    if (mods.amp.rings >= 2) {
      this.strokeEllipse(cx, cy, rx * 1.38, ry * 1.32, C.glacier, env * 0.82);
    }
    if (mods.amp.rings >= 3) {
      this.strokeEllipse(cx, cy, rx * 1.72, ry * 1.62, C.goldInk, env * 0.65);
      this.strokeEllipse(cx, cy, rx * 1.68, ry * 1.58, C.goldMid, env * 0.95);
      for (var g = 0; g < 6; g++) {
        var ga = -spin * 1.2 + (g * Math.PI * 2) / 6;
        this.px(cx + Math.cos(ga) * rx * 1.68, cy + Math.sin(ga) * ry * 1.58, C.goldWhite, env);
      }
    }
    if (mods.amp.arcs > 0 && env > 0.25) {
      var arcStep = Math.floor(progress * 14);
      var count = Math.min(mods.amp.arcs, 4);
      for (var k = 0; k < count; k++) {
        var angA = (k * Math.PI * 2) / count + arcStep * 0.7;
        var angB = angA + 1.15;
        var rr = ry * (mods.amp.rings >= 3 ? 1.52 : 1.24);
        this.drawIceLightning(
          cx + Math.cos(angA) * rr * 0.65,
          cy + Math.sin(angA) * rr,
          cx + Math.cos(angB) * rr * 0.65,
          cy + Math.sin(angB) * rr,
          seed + arcStep * 31 + k * 97,
          mods.amp.goldAura && (k % 2 === 0),
          env * 0.9
        );
      }
    }
  };

  /* -------------------- 粒子与地面残痕物理系统 -------------------- */
  function spawnShard(engine, x, y, vx, vy, groundY, opts) {
    if (engine.particles.length >= engine.maxParticles) return;
    opts = opts || {};
    engine.particles.push({
      kind: 'shard',
      x: x, y: y, vx: vx, vy: vy,
      groundY: groundY + ((opts.groundJitter || 0)),
      gravity: opts.gravity === undefined ? 390 : opts.gravity,
      size: opts.size || 3.4,
      rot: opts.rot || 0,
      vrot: opts.vrot || 7,
      gold: opts.gold || 0,
      age: 0,
      life: opts.life || 620,
      bounces: 0,
      maxBounces: opts.maxBounces === undefined ? 1 : opts.maxBounces,
      settled: false,
    });
  }

  function spawnDroplet(engine, x, y, vx, vy, groundY, opts) {
    if (engine.particles.length >= engine.maxParticles) return;
    opts = opts || {};
    engine.particles.push({
      kind: 'drop',
      x: x, y: y, vx: vx, vy: vy,
      groundY: groundY + (opts.groundJitter || 0),
      gravity: opts.gravity || 440,
      tier: opts.tier || 1,
      age: 0,
      life: opts.life || 560,
      spawnRipple: opts.spawnRipple !== false,
    });
  }

  function spawnMist(engine, x, y, vx, vy, opts) {
    if (engine.particles.length >= engine.maxParticles) return;
    opts = opts || {};
    engine.particles.push({
      kind: 'mist',
      x: x, y: y, vx: vx, vy: vy,
      radius: opts.radius || 5,
      grow: opts.grow || 5,
      drag: opts.drag || 0.94,
      color: opts.color || C.frostMist,
      shade: opts.shade || C.frostPeriw,
      age: 0,
      life: opts.life || 480,
    });
  }

  function spawnFlake(engine, x, y, vx, vy, opts) {
    if (engine.particles.length >= engine.maxParticles) return;
    opts = opts || {};
    engine.particles.push({
      kind: 'flake',
      x: x, y: y, vx: vx, vy: vy,
      sizeKey: opts.sizeKey || 7,
      spinRate: opts.spinRate || 10,
      gold: !!opts.gold,
      age: 0,
      life: opts.life || 560,
    });
  }

  function spawnSpark(engine, x, y, rLong, gold, life) {
    if (engine.particles.length >= engine.maxParticles) return;
    engine.particles.push({
      kind: 'spark',
      x: x, y: y,
      rLong: rLong || 5,
      gold: !!gold,
      age: 0,
      life: life || 240,
    });
  }

  function spawnDecal(engine, decal) {
    if (engine.decals.length >= engine.maxDecals) {
      engine.decals.shift();
    }
    decal.age = 0;
    engine.decals.push(decal);
  }

  function updateParticlesAndDecals(engine, dtMs) {
    var dt = dtMs * 0.001;
    var pList = engine.particles;
    for (var i = pList.length - 1; i >= 0; i--) {
      var p = pList[i];
      p.age += dtMs;
      if (p.age >= p.life) {
        pList.splice(i, 1);
        continue;
      }
      if (p.kind === 'shard') {
        if (!p.settled) {
          p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vrot * dt;
          if (p.gravity > 0 && p.y >= p.groundY) {
            p.y = p.groundY;
            if (p.bounces < p.maxBounces && Math.abs(p.vy) > 38) {
              p.vy = -p.vy * 0.36;
              p.vx *= 0.52;
              p.vrot *= 0.5;
              p.bounces++;
            } else {
              p.settled = true;
              p.vx = 0;
              p.vy = 0;
              p.vrot = 0;
            }
          }
        }
      } else if (p.kind === 'drop') {
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y >= p.groundY) {
          if (p.spawnRipple && p.tier >= 1) {
            spawnDecal(engine, {
              kind: 'water_ripple',
              x: p.x,
              y: p.groundY,
              rx0: 2,
              rx1: p.tier === 2 ? 12 : 7,
              ryRatio: 0.32,
              life: 320,
              doubleRing: false,
              puddle: false,
            });
          }
          pList.splice(i, 1);
        }
      } else if (p.kind === 'mist') {
        var damp = Math.pow(p.drag, dt * 60);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.kind === 'flake') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.97, dt * 60);
        p.vy *= Math.pow(0.97, dt * 60);
      }
    }

    var dList = engine.decals;
    for (var j = dList.length - 1; j >= 0; j--) {
      dList[j].age += dtMs;
      if (dList[j].age >= dList[j].life) {
        dList.splice(j, 1);
      }
    }
  }

  function renderDecals(surf, decals) {
    for (var i = 0; i < decals.length; i++) {
      var d = decals[i];
      var t = clamp(d.age / d.life, 0, 1);
      var fadeOut = t > 0.62 ? 1 - (t - 0.62) / 0.38 : 1;
      var grow = easeOutCubic(clamp(t * 4.5, 0, 1));

      if (d.kind === 'frost_patch') {
        var rx = d.rx * grow;
        var ry = d.ry * grow;
        surf.fillEllipse(d.x, d.y + 1, rx * 1.05, ry * 1.08, C.groundShade, null, fadeOut * 0.45, fadeOut * 0.72);
        surf.fillEllipse(d.x, d.y, rx, ry, C.frostMist, C.frostSlate, fadeOut * 0.78, fadeOut * 0.85);
        var spokes = d.spokes || 6;
        for (var s = 0; s < spokes; s++) {
          var ang = (d.rot || 0) + (Math.PI * 2 * s) / spokes;
          var x1 = d.x + Math.cos(ang) * rx * 0.96;
          var y1 = d.y + Math.sin(ang) * ry * 0.96;
          surf.line(d.x, d.y, x1, y1, C.frostInk, fadeOut * 0.78, fadeOut);
          var midX = d.x + Math.cos(ang) * rx * 0.56;
          var midY = d.y + Math.sin(ang) * ry * 0.56;
          var sideA = ang + 0.48;
          surf.line(midX, midY, midX + Math.cos(sideA) * rx * 0.30, midY + Math.sin(sideA) * ry * 0.30, C.royalBlue, fadeOut * 0.72, fadeOut);
        }
        if (d.gold && fadeOut > 0.35) {
          surf.px(d.x + Math.cos(d.rot || 0) * rx * 0.4, d.y, C.goldBright, fadeOut);
        }
      } else if (d.kind === 'water_ripple') {
        var rExp = lerp(d.rx0, d.rx1, easeOutCubic(t));
        var rY = rExp * (d.ryRatio || 0.32);
        var aRip = (1 - t) * 0.92;
        if (d.puddle) {
          var pRx = d.rx1 * 0.65 * Math.min(1, t * 3.5);
          surf.fillEllipse(d.x, d.y, pRx, pRx * (d.ryRatio || 0.32), C.groundDeep, null, fadeOut * 0.36, fadeOut * 0.68);
        }
        surf.strokeEllipse(d.x, d.y + 1, rExp, rY, C.waterInk, aRip * 0.58);
        surf.strokeEllipse(d.x, d.y, rExp, rY, C.waterMid, aRip);
        if (rExp > 6) {
          surf.strokeEllipse(d.x, d.y, rExp - 1, Math.max(1, rY - 0.5), C.waterFoam, aRip * 0.75, aRip);
        }
        if (d.doubleRing && t > 0.14) {
          var t2 = clamp((t - 0.14) / 0.86, 0, 1);
          var r2 = lerp(d.rx0 * 0.8, d.rx1 * 0.76, easeOutCubic(t2));
          var r2Y = r2 * (d.ryRatio || 0.32);
          surf.strokeEllipse(d.x, d.y, r2, r2Y, C.waterBright, (1 - t2) * 0.9);
        }
      } else if (d.kind === 'wet_slash') {
        var aS = fadeOut * 0.88;
        surf.line(d.x0, d.y0 + 1, d.x1, d.y1 + 1, C.waterInk, aS * 0.55);
        surf.line(d.x0, d.y0, d.x1, d.y1, C.waterMid, aS, fadeOut);
        surf.line(d.x0 + 1, d.y0 - 1, d.x1 - 1, d.y1 - 1, C.waterFoam, aS * 0.65, fadeOut);
      }
    }
  }

  function renderParticles(surf, particles) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var t = clamp(p.age / p.life, 0, 1);
      var fade = t > 0.68 ? 1 - (t - 0.68) / 0.32 : 1;

      if (p.kind === 'mist') {
        var r = p.radius + p.grow * easeOutQuad(t);
        var cov = Math.sin(t * Math.PI) * 0.68;
        if (cov > 0.06) {
          surf.fillCircle(p.x + 1, p.y + 1, r, p.shade, null, 0.78, cov * 0.58);
          surf.fillCircle(p.x, p.y, r * 0.84, p.color, null, 0.86, cov);
        }
      } else if (p.kind === 'drop') {
        var vx = p.vx, vy = p.vy;
        var spd = Math.hypot(vx, vy) || 1;
        var ux = vx / spd, uy = vy / spd;
        if (p.tier === 0) {
          surf.px(p.x, p.y + 1, C.waterInk, fade * 0.65);
          surf.px(p.x, p.y, C.waterBright, fade);
        } else if (p.tier === 1) {
          surf.px(p.x - ux, p.y - uy, C.waterInk, fade * 0.85);
          surf.fillCircle(p.x, p.y, 1.2, C.waterBright, C.waterInk, fade);
          surf.px(p.x, p.y - 1, C.waterGlint, fade * 0.9);
        } else {
          var tx = p.x - ux * 3.5, ty = p.y - uy * 3.5;
          surf.line(tx, ty, p.x, p.y, C.waterInk, fade);
          surf.fillCircle(p.x, p.y, 1.8, C.waterMid, C.waterInk, fade);
          surf.px(p.x, p.y, C.waterBright, fade);
          surf.px(p.x - 1, p.y - 1, C.waterGlint, fade);
        }
      } else if (p.kind === 'shard') {
        if (p.gravity > 0 && (p.settled || p.groundY - p.y < 14)) {
          var shA = fade * (1 - clamp((p.groundY - p.y) / 14, 0, 1)) * 0.5;
          surf.line(p.x - p.size * 0.7, p.groundY + 1, p.x + p.size * 0.7, p.groundY + 1, C.groundDeep, shA);
        }
        if (p.size >= 3.2) {
          surf.drawFacetedCrystal(p.x, p.y, p.size, p.size * 0.50, p.rot, p.gold, fade);
        } else {
          var isGold = p.gold >= 0.85;
          var ink = isGold ? C.goldInk : C.inkDeep;
          var fill = isGold ? C.goldBright : (p.gold > 0.4 ? C.icePale : C.iceCyan);
          var c = Math.cos(p.rot) * p.size, s = Math.sin(p.rot) * p.size;
          var pts = [
            [p.x + c, p.y + s],
            [p.x - s * 0.55, p.y + c * 0.55],
            [p.x - c, p.y - s],
            [p.x + s * 0.55, p.y - c * 0.55],
          ];
          surf.fillPoly(pts, fill, ink, fade);
        }
      } else if (p.kind === 'flake') {
        var rot45 = (Math.floor(p.age * 0.001 * p.spinRate) & 1) === 1;
        surf.drawSnowflake(p.x, p.y, p.sizeKey, rot45, fade * 0.95, p.gold);
      } else if (p.kind === 'spark') {
        var env = Math.sin(t * Math.PI);
        surf.drawStarGlint(p.x, p.y, Math.max(2, p.rLong * env), Math.max(1, p.rLong * 0.4 * env), p.gold, env);
      }
    }
  }

  /* -------------------- 辅助：沿曲线绘制渐细星尘像素拖尾 -------------------- */
  function drawTaperedStardustTrail(surf, points, baseRadius, goldMix, alpha, stepOffset) {
    var n = points.length;
    if (n < 2) return;
    var pureGold = goldMix >= 0.86;
    // Pass 1: 统一深靛外轮廓衬底
    for (var i = 1; i < n; i++) {
      var frac = i / (n - 1);
      var r = Math.max(0.5, baseRadius * frac);
      var a = alpha * frac * 0.84;
      if (frac > 0.25) {
        surf.thickLine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], r, pureGold ? C.goldInk : C.inkIndigo, a * 0.72);
      } else {
        surf.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], C.frostSlate, a * 0.62, frac * 2.8);
      }
    }
    // Pass 2: 皇家蓝 / 冰青 / 香槟金渐细核心与像素星尘
    for (var j = 1; j < n; j++) {
      var f2 = j / (n - 1);
      var r2 = Math.max(0, baseRadius * f2 * 0.58);
      var midCol = pureGold ? C.goldMid : (f2 > 0.65 ? C.glacier : C.royalBlue);
      surf.thickLine(points[j - 1][0], points[j - 1][1], points[j][0], points[j][1], r2, midCol, alpha * f2);
      if (f2 > 0.42) {
        surf.line(points[j - 1][0], points[j - 1][1], points[j][0], points[j][1], (pureGold || (goldMix > 0.4 && (j & 1) === 0)) ? C.goldBright : C.iceCyan, alpha * f2 * 0.92);
      }
      // 沿尾迹散布独立细碎像素星尘与小十字星点
      if (((j + (stepOffset || 0)) % 2) === 0 && f2 < 0.92 && f2 > 0.12) {
        var off = ((j % 2 === 0 ? 1 : -1) * (2.2 + (1 - f2) * 4.4));
        var sx = points[j][0];
        var sy = points[j][1] + off;
        surf.px(sx, sy + 1, C.inkIndigo, alpha * f2 * 0.65);
        var starCol = (goldMix > 0.35 && j % 4 === 0) ? C.goldBright : C.icePale;
        surf.px(sx, sy, starCol, alpha * f2);
        if (j % 6 === 0 && f2 > 0.35) {
          surf.px(sx - 1, sy, C.iceCyan, alpha * f2 * 0.8);
          surf.px(sx + 1, sy, C.iceCyan, alpha * f2 * 0.8);
          surf.px(sx, sy - 1, C.iceWhite, alpha * f2 * 0.8);
        }
      }
    }
  }

  /* -------------------- 辅助：爆裂棱晶冲击环 -------------------- */
  function drawCrystalImpactBurst(surf, cx, cy, localT, scale, goldMix, dir) {
    if (localT < 0 || localT > 1) return;
    var env = 1 - localT;
    var rOuter = (6 + 28 * easeOutCubic(localT)) * scale;
    var rInner = rOuter * 0.60;
    var useGold = goldMix > 0.52;
    var ink = useGold ? C.goldInk : C.inkDeep;
    var ringCol = useGold ? C.goldMid : C.royalBlue;
    var hiCol = useGold ? C.goldBright : C.iceCyan;

    var sides = useGold ? 8 : 6;
    var poly = [];
    var rot = localT * 0.4 + (dir < 0 ? Math.PI : 0);
    for (var i = 0; i < sides; i++) {
      var ang = rot + (Math.PI * 2 * i) / sides;
      var rad = (i % 2 === 0 ? rOuter : rOuter * 0.82);
      poly.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.88]);
    }
    surf.strokePoly(poly, ink, env * 0.82);
    var polyIn = [];
    for (var j = 0; j < sides; j++) {
      var ang2 = rot + (Math.PI * 2 * j) / sides;
      var rad2 = (j % 2 === 0 ? rOuter - 1.2 : (rOuter - 1.2) * 0.82);
      polyIn.push([cx + Math.cos(ang2) * rad2, cy + Math.sin(ang2) * rad2 * 0.88]);
    }
    surf.strokePoly(polyIn, hiCol, env * 0.95);

    if (localT < 0.72) {
      var rayEnv = 1 - localT / 0.72;
      for (var k = 0; k < 6; k++) {
        var rAng = rot * 0.5 + (Math.PI * 2 * k) / 6;
        var len0 = rInner * 0.42;
        var len1 = rOuter * (1.22 + (k % 2) * 0.22);
        var x0 = cx + Math.cos(rAng) * len0;
        var y0 = cy + Math.sin(rAng) * len0;
        var x1 = cx + Math.cos(rAng) * len1;
        var y1 = cy + Math.sin(rAng) * len1;
        surf.line(x0, y0 + 1, x1, y1 + 1, ink, rayEnv * 0.85);
        surf.line(x0, y0, x1, y1, ringCol, rayEnv);
        surf.line(x0, y0, lerp(x0, x1, 0.55), lerp(y0, y1, 0.55), hiCol, rayEnv);
      }
    }

    if (localT < 0.48) {
      var sEnv = Math.sin((localT / 0.48) * Math.PI);
      surf.drawStarGlint(cx, cy, (13 + 8 * sEnv) * scale, (5 + 3 * sEnv) * scale, useGold, sEnv);
    }
  }

  /* -------------------- 辅助：水系爆裂液冠 -------------------- */
  function drawWaterSplashCrown(surf, cx, cy, localT, scale) {
    if (localT < 0 || localT > 1) return;
    var env = 1 - localT;
    var r = (6 + 27 * easeOutCubic(localT)) * scale;
    surf.strokeEllipse(cx, cy + 1, r, r * 0.86, C.waterInk, env * 0.8);
    surf.strokeEllipse(cx, cy, r, r * 0.86, C.waterMid, env * 0.95);
    surf.strokeEllipse(cx, cy, Math.max(1, r - 1.2), Math.max(1, r * 0.86 - 1.2), C.waterFoam, env * 0.85, env);

    var petals = 9;
    for (var i = 0; i < petals; i++) {
      var ang = -Math.PI * 0.96 + (Math.PI * 1.92 * i) / petals + localT * 0.2;
      var bx = cx + Math.cos(ang) * r * 0.68;
      var by = cy + Math.sin(ang) * r * 0.62;
      var tx = cx + Math.cos(ang) * (r * 1.36 + 5 * scale);
      var ty = cy + Math.sin(ang) * (r * 1.22 + 5 * scale) + localT * localT * 10;
      var nx = -Math.sin(ang) * 2.5 * scale * env;
      var ny = Math.cos(ang) * 2.5 * scale * env;
      var petalPts = [
        [bx - nx, by - ny],
        [tx, ty],
        [bx + nx, by + ny],
      ];
      surf.fillPoly(petalPts, (i & 1) ? C.waterBright : C.waterMid, C.waterInk, env * 0.92);
      surf.line(bx, by, lerp(bx, tx, 0.72), lerp(by, ty, 0.72), C.waterFoam, env * 0.88);
    }
  }

  /* -------------------- 辅助：统一外轮廓流体水柱绘制 -------------------- */
  function drawCohesiveWaterRibbon(surf, pts, radii, phase, alpha) {
    var n = pts.length;
    if (n < 2) return;
    // Pass 1: 统一深海蓝外轮廓
    for (var i = 1; i < n; i++) {
      var rOut = Math.max(1.1, radii[i] + 1.15);
      surf.thickLine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], rOut, C.waterInk, alpha * 0.96);
    }
    // Pass 2: 深钴水体暗层
    for (var j = 1; j < n; j++) {
      var rDeep = Math.max(0.9, radii[j] * 0.92);
      surf.thickLine(pts[j - 1][0], pts[j - 1][1] + 0.5, pts[j][0], pts[j][1] + 0.5, rDeep, C.waterDeep, alpha);
    }
    // Pass 3: 澄澈钴蓝中层
    for (var k = 1; k < n; k++) {
      var rMid = Math.max(0.5, radii[k] * 0.68);
      surf.thickLine(pts[k - 1][0], pts[k - 1][1] - 0.3, pts[k][0], pts[k][1] - 0.3, rMid, C.waterMid, alpha);
    }
    // Pass 4: 碧青透光脊与奔流泡沫纹
    for (var m = 1; m < n; m++) {
      var rHi = Math.max(0, radii[m] * 0.34);
      surf.thickLine(pts[m - 1][0], pts[m - 1][1] - 0.8, pts[m][0], pts[m][1] - 0.8, rHi, C.waterBright, alpha * 0.95);
      if (((m + Math.floor(phase * 14)) % 3) === 0 && radii[m] >= 1.8) {
        surf.line(pts[m - 1][0], pts[m - 1][1] - 1.1, pts[m][0], pts[m][1] - 1.1, C.waterFoam, alpha * 0.95);
      }
    }
  }

  /* -------------------- 辅助：极锐弯曲半月断水刃 -------------------- */
  function drawWaterCrescentBlade(surf, cx, cy, radius, bladeAngle, arcSpan, thickness, goldEdge, alpha) {
    var segs = 22;
    var outerPts = [];
    var innerPts = [];
    var edgePts = [];
    var foamPts = [];
    var halfSpan = arcSpan * 0.5;

    for (var i = 0; i <= segs; i++) {
      var f = i / segs;
      var a = bladeAngle - halfSpan + arcSpan * f;
      var taper = Math.sin(f * Math.PI);
      var thick = thickness * Math.pow(taper, 0.78);
      var rOut = radius + thick * 0.35;
      var rIn = radius - thick * 0.95;
      outerPts.push([cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut]);
      innerPts.push([cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn]);
      edgePts.push([cx + Math.cos(a) * (rOut - 0.45), cy + Math.sin(a) * (rOut - 0.45)]);
      foamPts.push([cx + Math.cos(a) * (rIn - 2.6 * taper), cy + Math.sin(a) * (rIn - 2.6 * taper)]);
    }

    var bladePoly = outerPts.concat(innerPts.slice().reverse());
    var midPts = [];
    for (var m = 0; m <= segs; m++) {
      midPts.push([lerp(outerPts[m][0], innerPts[m][0], 0.44), lerp(outerPts[m][1], innerPts[m][1], 0.44)]);
    }
    var backPoly = midPts.concat(innerPts.slice().reverse());
    var frontPoly = outerPts.concat(midPts.slice().reverse());

    // 内侧极薄尾曳水汽弧线
    surf.strokePoly(foamPts, C.waterBright, alpha * 0.52, alpha * 0.75, true);

    surf.fillPoly(bladePoly, C.waterDeep, null, alpha);
    surf.fillPoly(backPoly, C.navyShadow, null, alpha);
    surf.fillPoly(frontPoly, C.waterBright, null, alpha);
    surf.strokePoly(innerPts, C.waterInk, alpha, undefined, true);
    surf.strokePoly(outerPts, C.waterInk, alpha * 0.85, undefined, true);

    // 极细 1px 冰白/香槟金切割刃锋
    for (var e = 1; e <= segs; e++) {
      var ef = e / segs;
      if (ef > 0.06 && ef < 0.94) {
        var colEdge = (goldEdge && ef > 0.32 && ef < 0.68) ? C.goldWhite : C.iceWhite;
        surf.line(edgePts[e - 1][0], edgePts[e - 1][1], edgePts[e][0], edgePts[e][1], colEdge, alpha);
      }
    }
  }

  /* -------------------- 辅助：3D 多面切角深蓝地底冰棘 -------------------- */
  function drawIceThornSpike(surf, baseX, baseY, height, baseHalfW, leanX, progress, goldRim, alpha) {
    var grow = easeOutBack(clamp(progress, 0, 1));
    if (grow <= 0.02) return;
    var h = height * grow;
    var tipX = baseX + leanX * grow;
    var tipY = baseY - h;
    var leftBase = [baseX - baseHalfW, baseY];
    var rightBase = [baseX + baseHalfW, baseY];
    var midRidgeBase = [baseX - baseHalfW * 0.16, baseY + 1.5];
    var shoulderL = [lerp(leftBase[0], tipX, 0.42) - baseHalfW * 0.25, lerp(baseY, tipY, 0.42)];
    var shoulderR = [lerp(rightBase[0], tipX, 0.38) + baseHalfW * 0.18, lerp(baseY, tipY, 0.38)];
    var tip = [tipX, tipY];

    // 底部地面暗影嵌入
    surf.fillEllipse(baseX, baseY + 1, baseHalfW * 1.28, Math.max(2, baseHalfW * 0.42), C.groundDeep, C.frostInk, alpha * 0.65);

    // 保持纯净深海蓝/皇家蓝/冰青晶石主体，仅在棱脊与尖端镶嵌星霜金芒
    surf.fillPoly([tip, shoulderL, leftBase, midRidgeBase], C.glacier, null, alpha);
    surf.fillPoly([tip, shoulderL, [lerp(midRidgeBase[0], tipX, 0.45), lerp(midRidgeBase[1], tipY, 0.45)]], C.iceCyan, null, alpha);
    surf.fillPoly([tip, midRidgeBase, rightBase, shoulderR], C.navyShadow, null, alpha);
    surf.fillPoly([tip, shoulderR, rightBase], C.royalBlue, null, alpha * 0.6);

    surf.line(midRidgeBase[0], midRidgeBase[1], tipX, tipY, goldRim ? C.goldWhite : C.iceWhite, alpha);
    if (goldRim) {
      surf.line(shoulderL[0], shoulderL[1], tipX, tipY, C.goldBright, alpha * 0.9);
    }
    surf.strokePoly([tip, shoulderL, leftBase, rightBase, shoulderR], C.inkDeep, alpha);
    if (progress > 0.55) {
      surf.px(tipX, tipY - 1, goldRim ? C.goldWhite : C.iceWhite, alpha);
    }
  }

  /* ============================================================================
     10 招核心新版技能定义与时间轴编排器
     ============================================================================ */
  var SPELLS = {
    ice_crystal: {
      id: 'ice_crystal',
      name: '冰晶术',
      line: 'ice_cannon',
      lineName: '冰晶主炮线',
      stage: 1,
      beats: 1,
      durationMs: 1080,
      peakMs: [475],
      description: '掌心聚晶 → 单枚多面切角深蓝轮廓冰晶高速旋射 → 命中炸出六角冰晶碎片与地面霜斑',
    },
    tri_prism_ice: {
      id: 'tri_prism_ice',
      name: '三棱冰晶',
      line: 'ice_cannon',
      lineName: '冰晶主炮线',
      stage: 2,
      beats: 3,
      durationMs: 1520,
      peakMs: [455, 625, 810],
      description: '三枚不同弧度交错冰晶按节拍依次破空齐射（渐细像素星尘拖尾），每枚独立命中爆裂',
    },
    starfrost_scatter: {
      id: 'starfrost_scatter',
      name: '星霜散华',
      line: 'ice_cannon',
      lineName: '冰晶主炮线',
      stage: 3,
      beats: 4,
      durationMs: 1960,
      peakMs: [510, 700, 895, 1170],
      description: '扇形展开 4 波密集蓝金棱晶雨（末拍香槟金棱镜折射星裂），铺满命中区霜晶碎屑',
    },
    water_orb: {
      id: 'water_orb',
      name: '水球术',
      line: 'water_breaker',
      lineName: '水系破局线',
      stage: 1,
      beats: 1,
      durationMs: 1120,
      peakMs: [495],
      description: '清澈深钴外边水球旋飞，击中炸出细密分级水珠抛物线与地面水涟漪',
    },
    raging_surge: {
      id: 'raging_surge',
      name: '激流涌',
      line: 'water_breaker',
      lineName: '水系破局线',
      stage: 2,
      beats: 2,
      durationMs: 1500,
      peakMs: [480, 725],
      description: '双道高压旋涡水柱螺旋交错推进，命中激起高扬浪花与双层扩散水环',
    },
    water_cleave: {
      id: 'water_cleave',
      name: '断水刃',
      line: 'water_breaker',
      lineName: '水系破局线',
      stage: 3,
      beats: 2,
      durationMs: 1360,
      peakMs: [345, 575],
      description: '极薄高速弯曲半月水刃两连斜斩，深靛刃背 + 冰白刃锋 + 水雾残线与反向飞溅水珠',
    },
    frost_step_floor: {
      id: 'frost_step_floor',
      name: '冰履',
      line: 'frost_domain',
      lineName: '霜域控场线',
      stage: 1,
      beats: 1,
      durationMs: 1480,
      peakMs: [560],
      description: '从施法者脚下沿地面高速蔓延出锐利六角几何霜纹与薄冰裂纹，覆盖敌方脚底并升起淡寒气',
    },
    frost_breath: {
      id: 'frost_breath',
      name: '冰霜之息',
      line: 'frost_domain',
      lineName: '霜域控场线',
      stage: 2,
      beats: 2,
      durationMs: 1680,
      peakMs: [520, 880],
      description: '扇形锥体高速喷涌层叠寒雾颗粒与旋转微型冰花，将敌方半身凝出半透明冷蓝冰霜结晶壳',
    },
    frost_thorn_field: {
      id: 'frost_thorn_field',
      name: '霜域棘阵',
      line: 'frost_domain',
      lineName: '霜域控场线',
      stage: 3,
      beats: 3,
      durationMs: 1940,
      peakMs: [390, 660, 960],
      description: '地面法阵先亮冰蓝刻度线 → 前中后三拍由地底错落刺出多面切角深蓝冰棘簇 → 崩碎满屏星霜碎晶',
    },
    ice_shield_line: {
      id: 'ice_shield_line',
      name: '冰盾护御线（冰盾 / 镜霜壁 / 钢冰护幕）',
      line: 'ice_shield',
      lineName: '冰盾护御线',
      stage: 1,
      beats: 1,
      durationMs: 1700,
      peakMs: [680],
      levels: {
        1: '冰盾（单面厚实六角切面实体冰墙）',
        2: '镜霜壁（多面折射镜霜壁 + 外向锐利冰刺反芒）',
        3: '钢冰护幕（全周身香槟金镶棱钢冰护幕 + 柔和旋转护箱冰环）',
      },
      description: '支持 lv: 1 冰盾 / 2 镜霜壁 / 3 钢冰护幕，三阶结构化立体护御特效',
    },
  };

  function triggerImpact(engine, inst, beatIndex, hitX, hitY, hitStopMs, shakeTrauma, extra) {
    var mods = inst.mods;
    var hs = Math.round(hitStopMs * mods.hitStop);
    var sh = clamp(shakeTrauma * mods.shake, 0, 1.0);
    var info = {
      spellId: inst.spellId,
      instanceId: inst.id,
      beatIndex: beatIndex,
      x: hitX,
      y: hitY,
      timingGrade: mods.timingGrade,
      ampTier: mods.ampTier,
      lv: inst.lv,
      hitStopMs: hs,
      shake: sh,
    };
    if (extra) {
      var ek = Object.keys(extra);
      for (var i = 0; i < ek.length; i++) info[ek[i]] = extra[ek[i]];
    }
    engine._emitImpact(inst, info);
  }

  var HANDLERS = {};

  /* ==================== 1. ice_crystal（冰晶术 · 1拍） ==================== */
  HANDLERS.ice_crystal = {
    init: function (inst) {
      inst.tGatherEnd = 220;
      inst.tFlightEnd = 450;
      inst.tBurstEnd = 790;
      inst.ctrlX = lerp(inst.from.x, inst.to.x, 0.48);
      inst.ctrlY = Math.min(inst.from.y, inst.to.y) - 24 * inst.mods.scale;
      inst.impactFired = false;
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      if (currMs < inst.tGatherEnd && Math.floor(prevMs / 28) !== Math.floor(currMs / 28)) {
        var ang = rng() * Math.PI * 2;
        var dist = 16 + rng() * 14;
        spawnShard(engine,
          inst.from.x + Math.cos(ang) * dist,
          inst.from.y + Math.sin(ang) * dist,
          -Math.cos(ang) * 70,
          -Math.sin(ang) * 70,
          inst.groundY,
          { gravity: 0, size: 1.8, life: 150, maxBounces: 0, gold: inst.mods.gold * 0.45 }
        );
      }
      if (!inst.impactFired && currMs >= inst.tFlightEnd) {
        inst.impactFired = true;
        triggerImpact(engine, inst, 0, inst.to.x, inst.to.y, 44, 0.36);

        var count = Math.round(18 * inst.mods.density);
        for (var i = 0; i < count; i++) {
          var a = (Math.PI * 2 * i) / count + (rng() - 0.5) * 0.45;
          var spd = (52 + rng() * 128) * inst.mods.scale;
          spawnShard(engine,
            inst.to.x + (rng() - 0.5) * 6,
            inst.to.y + (rng() - 0.5) * 6,
            Math.cos(a) * spd + inst.dir * 26,
            Math.sin(a) * spd - 52,
            inst.groundY,
            {
              size: (i % 4 === 0 ? 4.5 : 2.3 + rng() * 1.5) * Math.min(1.25, inst.mods.scale),
              rot: rng() * Math.PI * 2,
              vrot: (rng() - 0.5) * 16,
              gold: rng() < inst.mods.gold * 0.35 ? 0.92 : (inst.mods.gold > 0.3 ? 0.45 : 0),
              life: 480 + rng() * 260,
              groundJitter: (rng() - 0.5) * 10,
            }
          );
        }
        spawnSpark(engine, inst.to.x, inst.to.y, 12 * inst.mods.glint, inst.mods.gold > 0.45, 220);
        spawnDecal(engine, {
          kind: 'frost_patch',
          x: inst.to.x,
          y: inst.groundY,
          rx: 29 * inst.mods.scale,
          ry: 9.5 * inst.mods.scale,
          spokes: 6,
          rot: 0.25,
          gold: inst.mods.gold > 0.4,
          life: 620,
        });
      }
    },
    render: function (surf, inst, layer) {
      if (layer !== 'main') return;
      var t = inst.elapsed;
      var mods = inst.mods;

      if (t < inst.tGatherEnd + 70) {
        var gp = clamp(t / inst.tGatherEnd, 0, 1);
        surf.drawCastSeal(inst.from.x, inst.from.y, clamp(t / (inst.tGatherEnd + 60), 0, 1), mods, inst.seed, false);
        if (t < inst.tGatherEnd) {
          var cScale = easeOutBack(gp) * mods.scale;
          surf.drawFacetedCrystal(inst.from.x + inst.dir * 6, inst.from.y, 10 * cScale, 4.6 * cScale, inst.dir > 0 ? 0 : Math.PI, mods.gold * 0.55, clamp(gp * 1.5, 0, 1));
          if (gp > 0.72) {
            surf.drawStarGlint(inst.from.x + inst.dir * 13 * cScale, inst.from.y, 6.5 * mods.glint, 2.5, mods.gold > 0.45, (gp - 0.72) / 0.28);
          }
        }
      }

      if (t >= inst.tGatherEnd && t <= inst.tFlightEnd + 45) {
        var fp = clamp((t - inst.tGatherEnd) / (inst.tFlightEnd - inst.tGatherEnd), 0, 1);
        var efp = lerp(fp, easeInQuad(fp), 0.36);
        var trailPts = [];
        var samples = 14;
        for (var i = 0; i <= samples; i++) {
          var tf = clamp(efp - (1 - i / samples) * 0.36, 0, 1);
          trailPts.push([
            quadBezier(inst.from.x, inst.ctrlX, inst.to.x, tf),
            quadBezier(inst.from.y, inst.ctrlY, inst.to.y, tf),
          ]);
        }
        drawTaperedStardustTrail(surf, trailPts, 2.6 * mods.scale, mods.gold * 0.55, 0.95, Math.floor(t / 24));

        if (t <= inst.tFlightEnd) {
          var head = trailPts[trailPts.length - 1];
          var vx = quadBezierDeriv(inst.from.x, inst.ctrlX, inst.to.x, efp);
          var vy = quadBezierDeriv(inst.from.y, inst.ctrlY, inst.to.y, efp);
          var ang = Math.atan2(vy, vx);
          var spinPulse = 0.84 + 0.22 * Math.abs(Math.sin(t * 0.045));
          surf.drawFacetedCrystal(head[0], head[1], 13 * mods.scale, 5.4 * mods.scale * spinPulse, ang, mods.gold * 0.55, 1);
          if (efp > 0.12) {
            surf.strokeEllipse(head[0] - Math.cos(ang) * 4, head[1] - Math.sin(ang) * 4, 2.6 * mods.scale, 5.6 * mods.scale, C.iceCyan, 0.78);
          }
        }
      }

      if (t >= inst.tFlightEnd && t <= inst.tBurstEnd) {
        var bp = (t - inst.tFlightEnd) / (inst.tBurstEnd - inst.tFlightEnd);
        drawCrystalImpactBurst(surf, inst.to.x, inst.to.y, bp, 1.12 * mods.scale, mods.gold, inst.dir);
      }
    },
  };

  /* ==================== 2. tri_prism_ice（三棱冰晶 · 3拍连发） ==================== */
  HANDLERS.tri_prism_ice = {
    init: function (inst) {
      var s = inst.mods.scale;
      var midX = lerp(inst.from.x, inst.to.x, 0.5);
      var midY = lerp(inst.from.y, inst.to.y, 0.5);
      inst.bolts = [
        {
          beat: 0, tLaunch: 170, tHit: 440,
          ox: inst.from.x + inst.dir * 2, oy: inst.from.y - 18,
          cx: midX - inst.dir * 12, cy: midY - 48 * s,
          tx: inst.to.x - inst.dir * 4, ty: inst.to.y - 8,
          size: 10.8 * s, gold: 0.08, hitFired: false,
        },
        {
          beat: 1, tLaunch: 330, tHit: 610,
          ox: inst.from.x + inst.dir * 8, oy: inst.from.y + 12,
          cx: midX + inst.dir * 16, cy: midY + 34 * s,
          tx: inst.to.x + inst.dir * 4, ty: inst.to.y + 8,
          size: 11.4 * s, gold: inst.mods.gold > 0.25 ? 0.55 : 0.15, hitFired: false,
        },
        {
          beat: 2, tLaunch: 495, tHit: 790,
          ox: inst.from.x - inst.dir * 6, oy: inst.from.y - 6,
          cx: midX + inst.dir * 6, cy: midY - 64 * s,
          tx: inst.to.x, ty: inst.to.y - 2,
          size: 13.6 * s, gold: inst.mods.gold > 0.35 ? 0.68 : 0.45, hitFired: false,
        },
      ];
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      for (var i = 0; i < inst.bolts.length; i++) {
        var b = inst.bolts[i];
        if (!b.hitFired && currMs >= b.tHit) {
          b.hitFired = true;
          var isFinisher = b.beat === 2;
          triggerImpact(engine, inst, b.beat, b.tx, b.ty, isFinisher ? 54 : 30, isFinisher ? 0.50 : 0.27);
          var count = Math.round((isFinisher ? 18 : 9) * inst.mods.density);
          for (var k = 0; k < count; k++) {
            var a = (Math.PI * 2 * k) / count + (rng() - 0.5) * 0.5;
            var spd = (45 + rng() * (isFinisher ? 135 : 92)) * inst.mods.scale;
            spawnShard(engine,
              b.tx + (rng() - 0.5) * 6,
              b.ty + (rng() - 0.5) * 6,
              Math.cos(a) * spd + inst.dir * 22,
              Math.sin(a) * spd - (isFinisher ? 58 : 34),
              inst.groundY,
              {
                size: (isFinisher && k % 3 === 0 ? 4.5 : 2.4 + rng() * 1.6) * Math.min(1.25, inst.mods.scale),
                rot: rng() * Math.PI * 2,
                vrot: (rng() - 0.5) * 18,
                gold: (isFinisher && k % 4 === 0 && inst.mods.gold > 0.3) ? 0.92 : (k % 3 === 0 ? 0.5 : 0),
                life: 440 + rng() * 280,
                groundJitter: (rng() - 0.5) * 12,
              }
            );
          }
          spawnSpark(engine, b.tx, b.ty, (isFinisher ? 14 : 9) * inst.mods.glint, isFinisher && inst.mods.gold > 0.35, 220);
          spawnDecal(engine, {
            kind: 'frost_patch',
            x: b.tx + (rng() - 0.5) * 10,
            y: inst.groundY,
            rx: (isFinisher ? 34 : 20) * inst.mods.scale,
            ry: (isFinisher ? 11 : 6.5) * inst.mods.scale,
            spokes: isFinisher ? 6 : 4,
            rot: b.beat * 0.52,
            gold: isFinisher && inst.mods.gold > 0.35,
            life: isFinisher ? 720 : 540,
          });
        }
      }
    },
    render: function (surf, inst, layer) {
      if (layer !== 'main') return;
      var t = inst.elapsed;
      var mods = inst.mods;

      if (t < 560) {
        surf.drawCastSeal(inst.from.x, inst.from.y, clamp(t / 560, 0, 1), mods, inst.seed, false);
      }

      for (var i = 0; i < inst.bolts.length; i++) {
        var b = inst.bolts[i];
        if (t < b.tLaunch) {
          var gp = clamp(t / Math.max(120, b.tLaunch * 0.72), 0, 1);
          var bob = Math.sin(t * 0.015 + i * 2.1) * 2.2;
          var sc = easeOutBack(gp);
          surf.drawFacetedCrystal(b.ox, b.oy + bob, b.size * 0.75 * sc, b.size * 0.36 * sc, inst.dir > 0 ? -0.1 + i * 0.12 : Math.PI, b.gold, gp);
          if (t > b.tLaunch - 75) {
            surf.drawStarGlint(b.ox + inst.dir * 5, b.oy + bob, 5.5 * mods.glint, 2, b.beat === 2 && mods.gold > 0.35, (t - (b.tLaunch - 75)) / 75);
          }
          continue;
        }

        if (t >= b.tLaunch && t <= b.tHit + 110) {
          var fp = clamp((t - b.tLaunch) / (b.tHit - b.tLaunch), 0, 1);
          var efp = lerp(fp, easeInQuad(fp), 0.32);
          var trailFade = t > b.tHit ? 1 - (t - b.tHit) / 110 : 1;
          var pts = [];
          var samples = 15;
          for (var s = 0; s <= samples; s++) {
            var tf = clamp(efp - (1 - s / samples) * 0.44, 0, 1);
            pts.push([
              quadBezier(b.ox, b.cx, b.tx, tf),
              quadBezier(b.oy, b.cy, b.ty, tf),
            ]);
          }
          drawTaperedStardustTrail(surf, pts, (i === 2 ? 2.7 : 2.1) * mods.scale, b.gold, trailFade * 0.96, i * 5 + Math.floor(t / 22));

          if (t <= b.tHit) {
            var head = pts[pts.length - 1];
            var vx = quadBezierDeriv(b.ox, b.cx, b.tx, efp);
            var vy = quadBezierDeriv(b.oy, b.cy, b.ty, efp);
            var ang = Math.atan2(vy, vx);
            var spin = 0.8 + 0.25 * Math.abs(Math.cos(t * 0.05 + i));
            surf.drawFacetedCrystal(head[0], head[1], b.size, b.size * 0.42 * spin, ang, b.gold, 1);
          }
        }

        if (t >= b.tHit && t <= b.tHit + 330) {
          var bp = (t - b.tHit) / 330;
          drawCrystalImpactBurst(surf, b.tx, b.ty, bp, (b.beat === 2 ? 1.25 : 0.85) * mods.scale, b.beat === 2 ? mods.gold : 0.15, inst.dir);
          if (b.beat === 2 && bp < 0.65) {
            var rEnv = 1 - bp / 0.65;
            var rLen = (18 + 20 * easeOutCubic(bp)) * mods.scale;
            for (var c = 0; c < 3; c++) {
              var ca = (Math.PI * c) / 3 + 0.2;
              var x0 = b.tx - Math.cos(ca) * rLen, y0 = b.ty - Math.sin(ca) * rLen;
              var x1 = b.tx + Math.cos(ca) * rLen, y1 = b.ty + Math.sin(ca) * rLen;
              surf.line(x0, y0 + 1, x1, y1 + 1, C.inkDeep, rEnv * 0.78);
              surf.line(x0, y0, x1, y1, (c === 1 && mods.gold > 0.35) ? C.goldBright : C.iceCyan, rEnv);
            }
          }
        }
      }
    },
  };

  /* ==================== 3. starfrost_scatter（星霜散华 · 4拍扇形齐射） ==================== */
  HANDLERS.starfrost_scatter = {
    init: function (inst) {
      var rng = inst.rng;
      var s = inst.mods.scale;
      var tList = inst.targets && inst.targets.length > 0 ? inst.targets : [inst.to];
      var waveLaunch = [210, 405, 600, 815];
      var waveDuration = [285, 290, 295, 335];
      var waveCounts = [
        Math.max(3, Math.round(4 * inst.mods.density)),
        Math.max(4, Math.round(5 * inst.mods.density)),
        Math.max(4, Math.round(5 * inst.mods.density)),
        Math.max(6, Math.round(7 * inst.mods.density)),
      ];

      inst.waves = [];
      inst.prisms = [];
      for (var w = 0; w < 4; w++) {
        var isFinal = w === 3;
        var cnt = Math.min(isFinal ? 9 : 6, waveCounts[w]);
        inst.waves.push({ beat: w, tHit: waveLaunch[w] + waveDuration[w], impactFired: false });
        for (var i = 0; i < cnt; i++) {
          var frac = cnt > 1 ? (i / (cnt - 1)) * 2 - 1 : 0;
          var fanAng = (inst.dir > 0 ? -0.15 : Math.PI + 0.15) + frac * 1.12;
          var fanDist = (22 + (isFinal ? 9 : 0) + Math.abs(frac) * 10) * s;
          var ox = inst.from.x + Math.cos(fanAng) * fanDist * 0.75;
          var oy = inst.from.y - 12 + Math.sin(fanAng) * fanDist;

          var tgt = tList[(i + w) % tList.length];
          var tx = tgt.x + (rng() - 0.5) * 44 * s + frac * 14 * s;
          var ty = tgt.y + (rng() - 0.5) * 28 * s;

          var cx = lerp(ox, tx, 0.42) + inst.dir * (10 - Math.abs(frac) * 16);
          var cy = Math.min(oy, ty) - (26 + (1 - Math.abs(frac)) * 34 + (isFinal ? 16 : 0)) * s + frac * 22 * s;
          var stagger = Math.abs(frac) * 40 + (i % 2) * 14;

          // 精致蓝金配比：约 65% 皇家蓝/蓝金星霜棱晶 + 35% 亮香槟金棱晶（末拍中心为主星金棱）
          var isHeroCenter = isFinal && i === Math.floor(cnt / 2);
          var goldVal = isHeroCenter ? 0.95 : (isFinal ? ((i % 3 === 0) ? 0.92 : 0.55) : ((i % 3 === 1) ? 0.90 : (i % 2 === 0 ? 0.52 : 0.08)));

          inst.prisms.push({
            wave: w,
            isFinal: isFinal,
            ox: ox, oy: oy,
            cx: cx, cy: cy,
            tx: tx, ty: ty,
            tLaunch: waveLaunch[w] + stagger,
            tHit: waveLaunch[w] + waveDuration[w] + stagger * 0.72,
            size: (isHeroCenter ? 13.5 : (isFinal ? 9.4 : 8.2)) * s,
            gold: goldVal,
            hitFired: false,
          });
        }
      }
      inst.finalCenter = { x: inst.to.x, y: inst.to.y };
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      for (var i = 0; i < inst.prisms.length; i++) {
        var p = inst.prisms[i];
        if (!p.hitFired && currMs >= p.tHit) {
          p.hitFired = true;
          var shards = p.isFinal ? 4 : 2;
          for (var k = 0; k < shards; k++) {
            var a = rng() * Math.PI * 2;
            var spd = (36 + rng() * 98) * inst.mods.scale;
            spawnShard(engine,
              p.tx, p.ty,
              Math.cos(a) * spd + inst.dir * 16,
              Math.sin(a) * spd - 44,
              inst.groundY,
              {
                size: (p.isFinal ? 3.4 : 2.2) + rng() * 1.1,
                rot: rng() * Math.PI * 2,
                vrot: (rng() - 0.5) * 18,
                gold: (k === 0 && p.gold >= 0.85) ? 0.92 : (k % 2 === 0 ? 0.45 : 0.05),
                life: 480 + rng() * 320,
                groundJitter: (rng() - 0.5) * 14,
              }
            );
          }
          if (p.isFinal || (i % 2 === 0)) {
            spawnSpark(engine, p.tx, p.ty, (p.isFinal ? 9 : 6) * inst.mods.glint, p.gold >= 0.85, 200);
          }
        }
      }

      for (var w = 0; w < inst.waves.length; w++) {
        var wv = inst.waves[w];
        if (!wv.impactFired && currMs >= wv.tHit) {
          wv.impactFired = true;
          var isFinal = wv.beat === 3;
          triggerImpact(engine, inst, wv.beat, inst.to.x, inst.to.y, isFinal ? 64 : 26, isFinal ? 0.62 : 0.25, { finalWave: isFinal });
          spawnDecal(engine, {
            kind: 'frost_patch',
            x: inst.to.x + (wv.beat - 1.5) * 16,
            y: inst.groundY + (rng() - 0.5) * 6,
            rx: (isFinal ? 46 : 24) * inst.mods.scale,
            ry: (isFinal ? 14 : 7.5) * inst.mods.scale,
            spokes: isFinal ? 8 : 6,
            rot: wv.beat * 0.4,
            gold: isFinal || inst.mods.gold > 0.35,
            life: isFinal ? 820 : 620,
          });
          if (isFinal) {
            var extra = Math.round(16 * inst.mods.density);
            for (var e = 0; e < extra; e++) {
              var ea = (Math.PI * 2 * e) / extra + (rng() - 0.5) * 0.35;
              var espd = (60 + rng() * 140) * inst.mods.scale;
              spawnShard(engine,
                inst.to.x + (rng() - 0.5) * 26,
                inst.to.y + (rng() - 0.5) * 18,
                Math.cos(ea) * espd,
                Math.sin(ea) * espd - 68,
                inst.groundY,
                {
                  size: 2.8 + rng() * 2.0,
                  rot: rng() * Math.PI * 2,
                  vrot: (rng() - 0.5) * 20,
                  gold: (e % 3 === 0) ? 0.92 : (e % 2 === 0 ? 0.52 : 0.05),
                  life: 580 + rng() * 260,
                  groundJitter: (rng() - 0.5) * 14,
                }
              );
            }
          }
        }
      }
    },
    render: function (surf, inst, layer) {
      if (layer !== 'main') return;
      var t = inst.elapsed;
      var mods = inst.mods;

      if (t < 920) {
        var sp = clamp(t / 920, 0, 1);
        surf.drawCastSeal(inst.from.x, inst.from.y - 6, sp, mods, inst.seed, false);
        var arcEnv = Math.sin(clamp(t / 880, 0, 1) * Math.PI);
        var arcR = 30 * mods.scale;
        var aMid = inst.dir > 0 ? -0.15 : Math.PI + 0.15;
        surf.strokeEllipse(inst.from.x, inst.from.y - 10, arcR * 0.78, arcR, C.inkIndigo, arcEnv * 0.65, undefined, aMid - 1.25, aMid + 1.25);
        surf.strokeEllipse(inst.from.x, inst.from.y - 10, arcR * 0.74, arcR * 0.96, C.goldMid, arcEnv * 0.92, undefined, aMid - 1.2, aMid + 1.2);
      }

      for (var i = 0; i < inst.prisms.length; i++) {
        var p = inst.prisms[i];
        if (t >= p.tLaunch - 140 && t < p.tLaunch) {
          var gp = (t - (p.tLaunch - 140)) / 140;
          surf.drawFacetedCrystal(p.ox, p.oy, p.size * 0.68 * gp, p.size * 0.34 * gp, inst.dir > 0 ? 0 : Math.PI, p.gold, gp);
        }
        if (t >= p.tLaunch && t <= p.tHit + 85) {
          var fp = clamp((t - p.tLaunch) / (p.tHit - p.tLaunch), 0, 1);
          var efp = lerp(fp, easeInQuad(fp), 0.3);
          var tfade = t > p.tHit ? 1 - (t - p.tHit) / 85 : 1;
          var pts = [];
          var samples = 9;
          for (var s = 0; s <= samples; s++) {
            var sf = clamp(efp - (1 - s / samples) * 0.36, 0, 1);
            pts.push([
              quadBezier(p.ox, p.cx, p.tx, sf),
              quadBezier(p.oy, p.cy, p.ty, sf),
            ]);
          }
          drawTaperedStardustTrail(surf, pts, (p.isFinal ? 2.1 : 1.6) * mods.scale, p.gold, tfade * 0.92, i * 3);
          if (t <= p.tHit) {
            var head = pts[pts.length - 1];
            var vx = quadBezierDeriv(p.ox, p.cx, p.tx, efp);
            var vy = quadBezierDeriv(p.oy, p.cy, p.ty, efp);
            surf.drawFacetedCrystal(head[0], head[1], p.size, p.size * 0.42, Math.atan2(vy, vx), p.gold, 1);
          }
        }
        if (t >= p.tHit && t <= p.tHit + 210) {
          var bp = (t - p.tHit) / 210;
          drawCrystalImpactBurst(surf, p.tx, p.ty, bp, (p.isFinal ? 0.72 : 0.48) * mods.scale, p.gold, inst.dir);
        }
      }

      // 末拍香槟金棱镜折射星裂（清晰蓝金交错大菱镜星爆！）
      var finalWave = inst.waves[3];
      if (t >= finalWave.tHit && t <= finalWave.tHit + 460) {
        var fp2 = (t - finalWave.tHit) / 460;
        var fEnv = 1 - fp2;
        var fx = inst.finalCenter.x, fy = inst.finalCenter.y;
        var rD = (12 + 44 * easeOutCubic(fp2)) * mods.scale;
        for (var d = 0; d < 2; d++) {
          var rotD = d * (Math.PI / 4) + fp2 * 0.35;
          var dp = [];
          for (var v = 0; v < 4; v++) {
            var a = rotD + (v * Math.PI) / 2;
            dp.push([fx + Math.cos(a) * rD, fy + Math.sin(a) * rD * 0.85]);
          }
          surf.strokePoly(dp, d === 0 ? C.goldInk : C.inkDeep, fEnv * 0.9);
          var dpIn = [];
          for (var v2 = 0; v2 < 4; v2++) {
            var a2 = rotD + (v2 * Math.PI) / 2;
            dpIn.push([fx + Math.cos(a2) * (rD - 1.3), fy + Math.sin(a2) * (rD - 1.3) * 0.85]);
          }
          surf.strokePoly(dpIn, d === 0 ? C.goldBright : C.iceCyan, fEnv);
        }
        for (var r = 0; r < 8; r++) {
          var ra = (r * Math.PI) / 4 + 0.12;
          var lenR = (r % 2 === 0 ? 50 : 32) * easeOutCubic(Math.min(1, fp2 * 1.9)) * mods.scale;
          var x0 = fx + Math.cos(ra) * 5;
          var y0 = fy + Math.sin(ra) * 5;
          var x1 = fx + Math.cos(ra) * lenR;
          var y1 = fy + Math.sin(ra) * lenR * 0.85;
          surf.line(x0, y0 + 1, x1, y1 + 1, r % 2 === 0 ? C.goldInk : C.inkDeep, fEnv * 0.88);
          surf.line(x0, y0, x1, y1, r % 2 === 0 ? C.goldMid : C.royalBlue, fEnv);
          surf.line(x0, y0, lerp(x0, x1, 0.58), lerp(y0, y1, 0.58), r % 2 === 0 ? C.goldWhite : C.iceCyan, fEnv);
        }
        if (fp2 < 0.58) {
          surf.drawStarGlint(fx, fy, 19 * mods.glint * (1 - fp2 * 0.8), 7 * (1 - fp2 * 0.8), true, 1 - fp2 / 0.58);
        }
      }
    },
  };

  /* ==================== 4. water_orb（水球术 · 1拍） ==================== */
  HANDLERS.water_orb = {
    init: function (inst) {
      inst.tGatherEnd = 225;
      inst.tFlightEnd = 475;
      inst.tBurstEnd = 840;
      inst.ctrlX = lerp(inst.from.x, inst.to.x, 0.52);
      inst.ctrlY = Math.min(inst.from.y, inst.to.y) - 30 * inst.mods.scale;
      inst.impactFired = false;
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      if (currMs > inst.tGatherEnd && currMs < inst.tFlightEnd && Math.floor(prevMs / 24) !== Math.floor(currMs / 24)) {
        var fp = (currMs - inst.tGatherEnd) / (inst.tFlightEnd - inst.tGatherEnd);
        var px = quadBezier(inst.from.x, inst.ctrlX, inst.to.x, fp);
        var py = quadBezier(inst.from.y, inst.ctrlY, inst.to.y, fp);
        spawnDroplet(engine, px, py + (rng() - 0.5) * 6, -inst.dir * (18 + rng() * 28), -14 + rng() * 24, inst.groundY, {
          tier: rng() > 0.45 ? 1 : 0,
          life: 460,
          groundJitter: (rng() - 0.5) * 8,
        });
      }

      if (!inst.impactFired && currMs >= inst.tFlightEnd) {
        inst.impactFired = true;
        triggerImpact(engine, inst, 0, inst.to.x, inst.to.y, 42, 0.34);

        var count = Math.round(34 * inst.mods.density);
        for (var i = 0; i < count; i++) {
          var tier = i < count * 0.28 ? 2 : (i < count * 0.68 ? 1 : 0);
          var ang = -Math.PI * 0.94 + rng() * Math.PI * 1.48;
          var spd = (tier === 2 ? 85 + rng() * 82 : (tier === 1 ? 58 + rng() * 105 : 38 + rng() * 120)) * inst.mods.scale;
          spawnDroplet(engine,
            inst.to.x + (rng() - 0.5) * 8,
            inst.to.y + (rng() - 0.5) * 8,
            Math.cos(ang) * spd + inst.dir * 22,
            Math.sin(ang) * spd - (tier === 2 ? 84 : 56),
            inst.groundY,
            {
              tier: tier,
              gravity: tier === 2 ? 430 : 370,
              life: 560 + rng() * 260,
              groundJitter: (rng() - 0.5) * 14,
              spawnRipple: tier >= 1,
            }
          );
        }
        spawnDecal(engine, {
          kind: 'water_ripple',
          x: inst.to.x,
          y: inst.groundY,
          rx0: 6,
          rx1: 44 * inst.mods.scale,
          ryRatio: 0.32,
          life: 660,
          doubleRing: true,
          puddle: true,
        });
      }
    },
    render: function (surf, inst, layer) {
      if (layer !== 'main') return;
      var t = inst.elapsed;
      var mods = inst.mods;

      if (t < inst.tGatherEnd + 50) {
        var gp = clamp(t / inst.tGatherEnd, 0, 1);
        surf.drawCastSeal(inst.from.x, inst.from.y, clamp(t / (inst.tGatherEnd + 40), 0, 1), mods, inst.seed, true);
        if (t < inst.tGatherEnd) {
          var rad = (3 + 8.0 * easeOutBack(gp)) * mods.scale;
          for (var w = 0; w < 3; w++) {
            var a0 = gp * 6.5 + (w * Math.PI * 2) / 3;
            var d = (1 - gp) * 18 * mods.scale + rad;
            var wx = inst.from.x + Math.cos(a0) * d;
            var wy = inst.from.y + Math.sin(a0) * d;
            surf.line(wx, wy, inst.from.x + Math.cos(a0 + 0.5) * rad, inst.from.y + Math.sin(a0 + 0.5) * rad, C.waterMid, gp);
            surf.px(wx, wy, C.waterFoam, gp);
          }
          surf.drawLiquidOrb(inst.from.x + inst.dir * 5, inst.from.y, rad, rad * (0.94 + 0.08 * Math.sin(t * 0.03)), t * 0.014, 1);
        }
      }

      if (t >= inst.tGatherEnd && t <= inst.tFlightEnd + 55) {
        var fp = clamp((t - inst.tGatherEnd) / (inst.tFlightEnd - inst.tGatherEnd), 0, 1);
        var pts = [];
        var radii = [];
        var samples = 12;
        for (var i = 0; i <= samples; i++) {
          var f = i / samples;
          var tf = clamp(fp - (1 - f) * 0.28, 0, 1);
          pts.push([
            quadBezier(inst.from.x, inst.ctrlX, inst.to.x, tf),
            quadBezier(inst.from.y, inst.ctrlY, inst.to.y, tf),
          ]);
          radii.push((0.5 + 3.8 * Math.pow(f, 1.5)) * mods.scale);
        }
        var tfade = t > inst.tFlightEnd ? 1 - (t - inst.tFlightEnd) / 55 : 1;
        drawCohesiveWaterRibbon(surf, pts, radii, t * 0.01, tfade * 0.85);

        if (t <= inst.tFlightEnd) {
          var head = pts[pts.length - 1];
          var wobble = Math.sin(t * 0.042) * 0.14;
          var baseR = 11.4 * mods.scale;
          surf.drawLiquidOrb(head[0], head[1], baseR * (1.10 + wobble), baseR * (0.90 - wobble), t * 0.022, 1);
          // 细环旋流环绕水球
          surf.strokeEllipse(head[0] - inst.dir * 2, head[1], baseR * 0.55, baseR * 1.24, C.waterFoam, 0.82);
        }
      }

      if (t >= inst.tFlightEnd && t <= inst.tBurstEnd) {
        var bp = (t - inst.tFlightEnd) / (inst.tBurstEnd - inst.tFlightEnd);
        drawWaterSplashCrown(surf, inst.to.x, inst.to.y, bp, 1.22 * mods.scale);
      }
    },
  };

  /* ==================== 5. raging_surge（激流涌 · 2拍） ==================== */
  HANDLERS.raging_surge = {
    init: function (inst) {
      inst.surges = [
        { beat: 0, tStart: 170, tHit: 455, tEnd: 880, phaseOffset: 0, ampY: 18 * inst.mods.scale, hitFired: false },
        { beat: 1, tStart: 390, tHit: 685, tEnd: 1120, phaseOffset: Math.PI, ampY: 22 * inst.mods.scale, hitFired: false },
      ];
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      if (currMs > 220 && currMs < 820 && Math.floor(prevMs / 24) !== Math.floor(currMs / 24)) {
        var prog = clamp((currMs - 200) / 520, 0, 1);
        var sx = lerp(inst.from.x, inst.to.x, prog * 0.92);
        var sy = lerp(inst.from.y, inst.to.y, prog) + Math.sin(currMs * 0.03) * 14;
        spawnDroplet(engine, sx, sy, inst.dir * (30 + rng() * 55), -35 - rng() * 55, inst.groundY, {
          tier: rng() > 0.65 ? 1 : 0,
          life: 440,
          groundJitter: (rng() - 0.5) * 10,
        });
      }

      for (var i = 0; i < inst.surges.length; i++) {
        var sg = inst.surges[i];
        if (!sg.hitFired && currMs >= sg.tHit) {
          sg.hitFired = true;
          var isSecond = sg.beat === 1;
          triggerImpact(engine, inst, sg.beat, inst.to.x, inst.to.y, isSecond ? 54 : 36, isSecond ? 0.54 : 0.36);

          var count = Math.round((isSecond ? 30 : 20) * inst.mods.density);
          for (var k = 0; k < count; k++) {
            var tier = k < count * 0.32 ? 2 : (k < count * 0.72 ? 1 : 0);
            var vx = (rng() - 0.30) * 135 * inst.dir * inst.mods.scale;
            var vy = -(110 + rng() * (isSecond ? 155 : 115)) * inst.mods.scale;
            spawnDroplet(engine,
              inst.to.x + (rng() - 0.5) * 18,
              inst.to.y + 4 + (rng() - 0.5) * 10,
              vx, vy,
              inst.groundY,
              {
                tier: tier,
                gravity: 430,
                life: 580 + rng() * 280,
                groundJitter: (rng() - 0.5) * 14,
                spawnRipple: tier >= 1,
              }
            );
          }

          spawnDecal(engine, {
            kind: 'water_ripple',
            x: inst.to.x + (isSecond ? 0 : -inst.dir * 6),
            y: inst.groundY,
            rx0: 8,
            rx1: (isSecond ? 58 : 42) * inst.mods.scale,
            ryRatio: 0.30,
            life: isSecond ? 780 : 620,
            doubleRing: true,
            puddle: true,
          });
        }
      }
    },
    render: function (surf, inst, layer) {
      if (layer !== 'main') return;
      var t = inst.elapsed;
      var mods = inst.mods;

      if (t < 460) {
        surf.drawCastSeal(inst.from.x, inst.from.y, clamp(t / 460, 0, 1), mods, inst.seed, true);
      }

      // 双道高压旋涡水柱（前细后涌锥形扩张 + 不对称湍流螺旋，告别呆板等宽正弦管）
      for (var sIdx = 0; sIdx < inst.surges.length; sIdx++) {
        var sg = inst.surges[sIdx];
        if (t < sg.tStart || t > sg.tEnd) continue;

        var headP = clamp((t - sg.tStart) / (sg.tHit - sg.tStart), 0, 1);
        var tailP = clamp((t - sg.tHit) / (sg.tEnd - sg.tHit), 0, 1);
        var fade = tailP > 0.65 ? 1 - (tailP - 0.65) / 0.35 : 1;

        for (var strand = 0; strand < 2; strand++) {
          var pts = [];
          var radii = [];
          var samples = 20;
          var startFrac = Math.max(0, tailP * 0.90);
          var endFrac = easeOutCubic(headP);
          if (endFrac <= startFrac + 0.02) continue;

          for (var i = 0; i <= samples; i++) {
            var u = i / samples;
            var f = lerp(startFrac, endFrac, u);
            var bx = lerp(inst.from.x, inst.to.x, f);
            var by = lerp(inst.from.y, inst.to.y + 4, f);
            // 从施法点高压细束渐次舒展成奔腾双螺旋水柱
            var coneFlare = 0.22 + 0.95 * Math.pow(f, 0.85) * (1 - f * 0.25);
            var helixAng = f * Math.PI * 4.2 - t * 0.019 + sg.phaseOffset + strand * Math.PI;
            var turb = Math.sin(helixAng * 2.1 + sIdx) * 0.24;
            var offsetY = (Math.sin(helixAng) + turb) * sg.ampY * coneFlare;
            var depth = Math.cos(helixAng);
            pts.push([bx, by + offsetY]);
            var tipTaper = Math.sin(u * Math.PI * 0.88 + 0.16);
            var rBase = (1.6 + 2.8 * f + (sIdx === 1 ? 0.9 : 0) + depth * 0.85) * mods.scale * tipTaper;
            radii.push(Math.max(0.9, rBase));
          }
          drawCohesiveWaterRibbon(surf, pts, radii, t * 0.012 + strand * 1.5, fade * 0.95);

          // 环绕水柱的 3 道高压旋涡白沫环
          for (var vr = 0; vr < 3; vr++) {
            var vf = ((t * 0.0028 + vr * 0.33) % 1);
            if (vf > startFrac && vf < endFrac) {
              var vx = lerp(inst.from.x, inst.to.x, vf);
              var vy = lerp(inst.from.y, inst.to.y + 4, vf);
              var vrY = (7 + vf * 14) * mods.scale;
              surf.strokeEllipse(vx, vy, 3.2 * mods.scale, vrY, C.waterFoam, fade * 0.72, fade);
            }
          }
        }

        // 命中高扬浪花羽冠（向上腾跃的破浪高峰 + 飞白卷顶，绝无垂腿！）
        if (t >= sg.tHit && t <= sg.tHit + 460) {
          var hp = (t - sg.tHit) / 460;
          var hEnv = Math.sin(hp * Math.PI);
          var rise = easeOutCubic(Math.min(1, hp * 1.9));
          var soarH = (44 + (sg.beat === 1 ? 22 : 0)) * rise * mods.scale;

          // 3 股向上腾涌的破浪水峰（中峰高冲，左右副浪顺势向斜上方卷开！）
          var plumes = [
            { dirX: -0.65, hMult: 0.76, bend: -14 },
            { dirX: 0.15,  hMult: 1.12, bend: 10  },
            { dirX: 0.88,  hMult: 0.88, bend: 20  },
          ];
          for (var p = 0; p < plumes.length; p++) {
            var pl = plumes[p];
            var pPts = [];
            var pRad = [];
            var steps = 9;
            for (var k = 0; k <= steps; k++) {
              var kf = k / steps;
              var px = inst.to.x + pl.dirX * 14 * mods.scale + inst.dir * (kf * kf * pl.bend * mods.scale);
              var py = inst.groundY - 4 - Math.pow(kf, 0.82) * soarH * pl.hMult + hp * hp * 12 * kf;
              pPts.push([px, py]);
              pRad.push(Math.max(0.8, (4.6 * (1 - kf * 0.78)) * mods.scale * hEnv));
            }
            drawCohesiveWaterRibbon(surf, pPts, pRad, t * 0.015 + p, hEnv * 0.96);
            // 浪尖碎沫星点
            var topPt = pPts[pPts.length - 1];
            surf.px(topPt[0], topPt[1] - 2, C.waterGlint, hEnv);
            surf.px(topPt[0] + inst.dir * 2, topPt[1] - 1, C.waterFoam, hEnv);
          }
          drawWaterSplashCrown(surf, inst.to.x, inst.to.y - 8, hp, (sg.beat === 1 ? 1.26 : 0.96) * mods.scale);
        }
      }
    },
  };

  /* ==================== 6. water_cleave（断水刃 · 2拍穿甲切割） ==================== */
  HANDLERS.water_cleave = {
    init: function (inst) {
      var s = inst.mods.scale;
      inst.slashes = [
        {
          beat: 0, tStart: 150, tHit: 325, tEnd: 485, tSeamEnd: 880,
          sx: inst.from.x + inst.dir * 8, sy: inst.from.y - 16,
          ex: inst.to.x + inst.dir * 38, ey: inst.to.y + 24,
          seamX0: inst.to.x - inst.dir * 28 * s, seamY0: inst.to.y - 25 * s,
          seamX1: inst.to.x + inst.dir * 30 * s, seamY1: inst.to.y + 23 * s,
          radius: 28 * s, thickness: 6.4 * s, arcSpan: 2.25,
          bladeAngle: inst.dir > 0 ? 0.45 : Math.PI - 0.45,
          hitFired: false,
        },
        {
          beat: 1, tStart: 380, tHit: 555, tEnd: 735, tSeamEnd: 1220,
          sx: inst.from.x + inst.dir * 8, sy: inst.from.y + 18,
          ex: inst.to.x + inst.dir * 44, ey: inst.to.y - 28,
          seamX0: inst.to.x - inst.dir * 30 * s, seamY0: inst.to.y + 25 * s,
          seamX1: inst.to.x + inst.dir * 34 * s, seamY1: inst.to.y - 27 * s,
          radius: 34 * s, thickness: 7.4 * s, arcSpan: 2.40,
          bladeAngle: inst.dir > 0 ? -0.48 : Math.PI + 0.48,
          hitFired: false,
        },
      ];
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      for (var i = 0; i < inst.slashes.length; i++) {
        var sl = inst.slashes[i];
        if (!sl.hitFired && currMs >= sl.tHit) {
          sl.hitFired = true;
          var isSecond = sl.beat === 1;
          triggerImpact(engine, inst, sl.beat, inst.to.x, inst.to.y, isSecond ? 58 : 42, isSecond ? 0.52 : 0.36);

          var dx = sl.seamX1 - sl.seamX0;
          var dy = sl.seamY1 - sl.seamY0;
          var len = Math.hypot(dx, dy) || 1;
          var ux = dx / len, uy = dy / len;
          var nx = -uy, ny = ux;

          var count = Math.round((isSecond ? 26 : 18) * inst.mods.density);
          for (var k = 0; k < count; k++) {
            var side = (k % 2 === 0) ? 1 : -1;
            var posF = rng();
            var px = lerp(sl.seamX0, sl.seamX1, posF);
            var py = lerp(sl.seamY0, sl.seamY1, posF);
            var spd = (85 + rng() * 145) * inst.mods.scale;
            var vx = (ux * side * 0.84 + nx * (rng() - 0.5) * 0.72) * spd;
            var vy = (uy * side * 0.84 + ny * (rng() - 0.5) * 0.72) * spd - 35;
            spawnDroplet(engine, px, py, vx, vy, inst.groundY, {
              tier: k % 4 === 0 ? 2 : (k % 2 === 0 ? 1 : 0),
              gravity: 390,
              life: 440 + rng() * 240,
              groundJitter: (rng() - 0.5) * 12,
              spawnRipple: k % 3 === 0,
            });
          }

          spawnSpark(engine, inst.to.x, inst.to.y, (isSecond ? 15 : 10) * inst.mods.glint, inst.mods.gold > 0.35 && isSecond, 220);
          spawnDecal(engine, {
            kind: 'wet_slash',
            x0: inst.to.x - 26 * inst.mods.scale,
            y0: inst.groundY + (isSecond ? 4 : -4),
            x1: inst.to.x + 28 * inst.mods.scale,
            y1: inst.groundY + (isSecond ? -4 : 4),
            life: 680,
          });
        }
      }
    },
    render: function (surf, inst, layer) {
      if (layer !== 'main') return;
      var t = inst.elapsed;
      var mods = inst.mods;

      if (t < 240) {
        surf.drawCastSeal(inst.from.x, inst.from.y, clamp(t / 240, 0, 1), mods, inst.seed, true);
      }

      for (var i = 0; i < inst.slashes.length; i++) {
        var sl = inst.slashes[i];
        if (t >= sl.tStart && t <= sl.tEnd) {
          var p = (t - sl.tStart) / (sl.tEnd - sl.tStart);
          var ep = easeOutCubic(p);
          var fade = p > 0.72 ? 1 - (p - 0.72) / 0.28 : 1;
          var cx = lerp(sl.sx, sl.ex, ep);
          var cy = lerp(sl.sy, sl.ey, ep);

          if (p > 0.12) {
            var epPrev = easeOutCubic(Math.max(0, p - 0.10));
            var pxPrev = lerp(sl.sx, sl.ex, epPrev);
            var pyPrev = lerp(sl.sy, sl.ey, epPrev);
            drawWaterCrescentBlade(surf, pxPrev, pyPrev, sl.radius * 0.94, sl.bladeAngle, sl.arcSpan * 0.88, sl.thickness * 0.62, false, fade * 0.36);
          }

          drawWaterCrescentBlade(surf, cx, cy, sl.radius, sl.bladeAngle, sl.arcSpan, sl.thickness, mods.gold > 0.4 && sl.beat === 1, fade);
        }

        if (t >= sl.tHit && t <= sl.tSeamEnd) {
          var sp = (t - sl.tHit) / (sl.tSeamEnd - sl.tHit);
          var sEnv = 1 - sp;
          var spread = easeOutQuad(sp) * 3.5;
          var dx = sl.seamX1 - sl.seamX0;
          var dy = sl.seamY1 - sl.seamY0;
          var len = Math.hypot(dx, dy) || 1;
          var nx = -dy / len, ny = dx / len;

          if (sp < 0.28) {
            var cutA = 1 - sp / 0.28;
            surf.line(sl.seamX0, sl.seamY0 + 1, sl.seamX1, sl.seamY1 + 1, C.waterInk, cutA * 0.9);
            surf.line(sl.seamX0, sl.seamY0, sl.seamX1, sl.seamY1, C.iceWhite, cutA);
          }
          surf.line(sl.seamX0 + nx * spread, sl.seamY0 + ny * spread, sl.seamX1 + nx * spread, sl.seamY1 + ny * spread, C.waterMid, sEnv * 0.85, sEnv);
          surf.line(sl.seamX0 - nx * spread, sl.seamY0 - ny * spread, sl.seamX1 - nx * spread, sl.seamY1 - ny * spread, C.waterBright, sEnv * 0.78, sEnv * 0.9);
          surf.px(sl.seamX0, sl.seamY0, C.waterInk, sEnv);
          surf.px(sl.seamX1, sl.seamY1, C.waterInk, sEnv);
        }
      }
    },
  };

  /* ==================== 7. frost_step_floor（冰履 · 1拍） ==================== */
  HANDLERS.frost_step_floor = {
    init: function (inst) {
      var rng = inst.rng;
      inst.tSpreadStart = 120;
      inst.tReachTarget = 490;
      inst.tHoldEnd = 1020;
      inst.impactFired = false;

      inst.tiles = [];
      var count = Math.round(7 + inst.mods.ampTier);
      for (var i = 0; i < count; i++) {
        var f = i / (count - 1);
        var tx = lerp(inst.from.x, inst.to.x, f);
        var ty = inst.groundY + (i === 0 || i === count - 1 ? 0 : (rng() - 0.5) * 14);
        inst.tiles.push({
          x: tx,
          y: ty,
          rx: (13 + (i === count - 1 ? 22 : (i % 2) * 5)) * inst.mods.scale,
          ry: (4.6 + (i === count - 1 ? 7.8 : (i % 2) * 1.6)) * inst.mods.scale,
          tOpen: lerp(inst.tSpreadStart, inst.tReachTarget, f),
          rot: (i % 2) * 0.52 + 0.15,
          isTargetHex: i === count - 1,
        });
      }
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      if (currMs >= inst.tSpreadStart && currMs <= inst.tReachTarget && Math.floor(prevMs / 35) !== Math.floor(currMs / 35)) {
        var f = (currMs - inst.tSpreadStart) / (inst.tReachTarget - inst.tSpreadStart);
        var fx = lerp(inst.from.x, inst.to.x, f);
        spawnShard(engine, fx, inst.groundY - 1, inst.dir * (18 + rng() * 32), -(38 + rng() * 52), inst.groundY, {
          size: 2.0 + rng() * 1.1,
          life: 360,
          maxBounces: 0,
        });
      }

      if (!inst.impactFired && currMs >= inst.tReachTarget) {
        inst.impactFired = true;
        triggerImpact(engine, inst, 0, inst.to.x, inst.groundY - 12, 32, 0.24);
        var flk = Math.round(8 * inst.mods.density);
        for (var i = 0; i < flk; i++) {
          spawnFlake(engine,
            inst.to.x + (rng() - 0.5) * 44 * inst.mods.scale,
            inst.groundY - 4 - rng() * 14,
            (rng() - 0.5) * 14,
            -(18 + rng() * 24),
            { sizeKey: i % 2 === 0 ? 5 : 7, life: 560 + rng() * 280, gold: inst.mods.gold > 0.5 && i === 0 }
          );
        }
      }

      if (currMs > inst.tReachTarget && currMs < inst.tHoldEnd && Math.floor(prevMs / 46) !== Math.floor(currMs / 46)) {
        spawnMist(engine,
          inst.to.x + (rng() - 0.5) * 48 * inst.mods.scale,
          inst.groundY - 2,
          (rng() - 0.5) * 10,
          -(22 + rng() * 20),
          { radius: 3.5, grow: 5.5, color: C.frostMist, shade: C.frostPeriw, life: 480 }
        );
      }
    },
    render: function (surf, inst, layer) {
      var t = inst.elapsed;
      var mods = inst.mods;
      var globalFade = t > inst.tHoldEnd ? clamp(1 - (t - inst.tHoldEnd) / (inst.durationMs - inst.tHoldEnd), 0, 1) : 1;

      if (layer === 'ground') {
        if (t < 420) {
          var p0 = clamp(t / 140, 0, 1);
          surf.drawFloorHexSeal(inst.from.x, inst.groundY, 18 * mods.scale * easeOutCubic(p0), 6.2 * mods.scale * easeOutCubic(p0), 0.2, 1, mods.amp.goldAura, (1 - t / 420) * 0.9, false);
        }

        var reachF = clamp((t - inst.tSpreadStart) / (inst.tReachTarget - inst.tSpreadStart), 0, 1);
        if (reachF > 0) {
          var curX = lerp(inst.from.x, inst.to.x, easeOutQuad(reachF));
          var segs = 10;
          var prevX = inst.from.x, prevY = inst.groundY;
          for (var s = 1; s <= segs; s++) {
            var sf = (s / segs) * reachF;
            var nx = lerp(inst.from.x, curX, s / segs);
            var ny = inst.groundY + Math.sin(s * 2.3 + inst.seed) * 4.5 * (1 - sf * 0.4);
            surf.line(prevX, prevY + 1, nx, ny + 1, C.frostInk, globalFade * 0.85, globalFade);
            surf.line(prevX, prevY, nx, ny, C.glacier, globalFade * 0.92, globalFade);
            if (s % 2 === 0) {
              var side = (s % 4 === 0 ? 1 : -1);
              surf.line(nx, ny, nx + inst.dir * 8, ny + side * 6, C.frostSlate, globalFade * 0.78, globalFade);
            }
            prevX = nx;
            prevY = ny;
          }
        }

        for (var i = 0; i < inst.tiles.length; i++) {
          var tl = inst.tiles[i];
          if (t < tl.tOpen) continue;
          var lp = clamp((t - tl.tOpen) / 140, 0, 1);
          var grow = easeOutCubic(lp);
          var rx = tl.rx * grow;
          var ry = tl.ry * grow;
          var hex = [];
          for (var v = 0; v < 6; v++) {
            var ang = tl.rot + (Math.PI * 2 * v) / 6;
            hex.push([tl.x + Math.cos(ang) * rx, tl.y + Math.sin(ang) * ry]);
          }
          surf.fillPoly(hex, C.frostMist, null, globalFade * 0.62, globalFade * 0.78);
          surf.strokePoly(hex, C.frostInk, globalFade * 0.86, globalFade);
          for (var k = 0; k < 3; k++) {
            surf.line(hex[k][0], hex[k][1], hex[k + 3][0], hex[k + 3][1], tl.isTargetHex ? C.royalBlue : C.frostPeriw, globalFade * 0.78, globalFade);
          }
          if (tl.isTargetHex) {
            surf.drawFloorHexSeal(tl.x, tl.y, rx * 1.15, ry * 1.15, tl.rot + t * 0.0008, lp, mods.gold > 0.5, globalFade * 0.95, true);
          }
        }
      } else if (layer === 'main') {
        if (t >= inst.tReachTarget) {
          var upP = clamp((t - inst.tReachTarget) / 220, 0, 1);
          var rX = 32 * mods.scale;
          for (var w = 0; w < 6; w++) {
            var wa = (Math.PI * 2 * w) / 6 + 0.35;
            var wx = inst.to.x + Math.cos(wa) * rX * 0.82;
            var wy = inst.groundY + Math.sin(wa) * 9 * mods.scale;
            var toothH = (5 + (w % 2) * 3.5) * mods.scale * easeOutBack(upP);
            surf.fillPoly([[wx - 2.5, wy], [wx, wy - toothH], [wx + 2.5, wy]], C.iceCyan, C.inkIndigo, globalFade * 0.9);
            var drift = ((t - inst.tReachTarget) * 0.032 + w * 9) % 28;
            var mistA = Math.sin((drift / 28) * Math.PI) * globalFade * 0.75;
            var sway = Math.sin(drift * 0.25 + w) * 3;
            surf.line(wx + sway, wy - drift, wx - sway * 0.6, wy - drift - 7, C.frostSlate, mistA, mistA);
            surf.px(wx + sway, wy - drift - 4, C.icePale, mistA);
          }
        }
      }
    },
  };

  /* ==================== 8. frost_breath（冰霜之息 · 2拍群冻） ==================== */
  HANDLERS.frost_breath = {
    init: function (inst) {
      inst.tBreathStart = 170;
      inst.tWave1Hit = 470;
      inst.tWave2Start = 490;
      inst.tWave2Hit = 810;
      inst.tBreathEnd = 1040;
      inst.tShellEnd = 1520;
      inst.hit1Fired = false;
      inst.hit2Fired = false;
      inst.originX = inst.from.x + inst.dir * 8;
      inst.originY = inst.from.y - 10;
      inst.baseAng = Math.atan2(inst.to.y - inst.originY, inst.to.x - inst.originX);
      inst.coneDist = Math.hypot(inst.to.x - inst.originX, inst.to.y - inst.originY) + 22 * inst.mods.scale;
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      // 高速穿透整个扇形锥体的层叠寒雾颗粒与旋转微型冰花（覆盖全段而非堆积在口部）
      if (currMs >= inst.tBreathStart && currMs <= inst.tBreathEnd && Math.floor(prevMs / 20) !== Math.floor(currMs / 20)) {
        var waveBoost = currMs >= inst.tWave2Start ? 1.25 : 1.0;
        var spread = (rng() - 0.5) * 0.68;
        var ang = inst.baseAng + spread;
        var spd = (290 + rng() * 190) * waveBoost;
        spawnMist(engine,
          inst.originX + Math.cos(ang) * (8 + rng() * 18),
          inst.originY + Math.sin(ang) * (8 + rng() * 18),
          Math.cos(ang) * spd,
          Math.sin(ang) * spd,
          {
            radius: 3.5 + rng() * 3.8,
            grow: 10 * inst.mods.scale,
            drag: 0.985,
            color: rng() > 0.35 ? C.frostMist : C.iceCyan,
            shade: C.frostPeriw,
            life: 620 + rng() * 180,
          }
        );
        if (rng() < 0.85 * inst.mods.density) {
          spawnFlake(engine,
            inst.originX + Math.cos(ang) * (10 + rng() * 24),
            inst.originY + Math.sin(ang) * (10 + rng() * 24),
            Math.cos(ang) * (spd * 1.04),
            Math.sin(ang) * (spd * 1.04),
            {
              sizeKey: rng() > 0.62 ? 9 : (rng() > 0.32 ? 7 : 5),
              spinRate: 11 + rng() * 8,
              gold: inst.mods.gold > 0.5 && rng() < 0.18,
              life: 680 + rng() * 220,
            }
          );
        }
      }

      if (!inst.hit1Fired && currMs >= inst.tWave1Hit) {
        inst.hit1Fired = true;
        triggerImpact(engine, inst, 0, inst.to.x, inst.to.y, 30, 0.24);
        spawnDecal(engine, {
          kind: 'frost_patch',
          x: inst.to.x,
          y: inst.groundY,
          rx: 36 * inst.mods.scale,
          ry: 11 * inst.mods.scale,
          spokes: 6,
          rot: 0.1,
          gold: false,
          life: 1050,
        });
      }

      if (!inst.hit2Fired && currMs >= inst.tWave2Hit) {
        inst.hit2Fired = true;
        triggerImpact(engine, inst, 1, inst.to.x, inst.to.y, 48, 0.38);
        var count = Math.round(14 * inst.mods.density);
        for (var i = 0; i < count; i++) {
          var a = (Math.PI * 2 * i) / count + (rng() - 0.5) * 0.4;
          spawnShard(engine,
            inst.to.x + Math.cos(a) * 14,
            inst.to.y + 8 + Math.sin(a) * 14,
            Math.cos(a) * 65,
            Math.sin(a) * 65 - 32,
            inst.groundY,
            { size: 2.6 + rng() * 1.4, life: 520, gold: (i % 4 === 0 && inst.mods.gold > 0.4) ? 0.5 : 0 }
          );
        }
        spawnSpark(engine, inst.to.x, inst.to.y - 4, 10 * inst.mods.glint, inst.mods.gold > 0.45, 240);
      }
    },
    render: function (surf, inst, layer) {
      var t = inst.elapsed;
      var mods = inst.mods;

      if (layer === 'main') {
        if (t < 300) {
          surf.drawCastSeal(inst.originX, inst.originY, clamp(t / 300, 0, 1), mods, inst.seed, false);
        }

        // 有机翻涌的层叠寒息波流（以弯曲风缕 + 柔和抖动气团构成，彻底告别死板直尺三角形！）
        if (t >= inst.tBreathStart && t <= inst.tBreathEnd + 120) {
          var bp = clamp((t - inst.tBreathStart) / (inst.tBreathEnd - inst.tBreathStart), 0, 1);
          var env = Math.sin(clamp((t - inst.tBreathStart) / (inst.tBreathEnd + 120 - inst.tBreathStart), 0, 1) * Math.PI);
          var reach = inst.coneDist * easeOutCubic(clamp(bp * 2.4, 0, 1));
          var halfCone = 0.32;

          // 沿着扇形锥体排布 14 团错落推进的翻涌冷雾羽云（自然圆润轮廓）
          for (var c = 0; c < 14; c++) {
            var cf = ((t * 0.0022 + c * 0.13) % 1);
            var dist = cf * reach;
            var spreadAng = inst.baseAng + Math.sin(c * 2.7 + t * 0.004) * halfCone * (0.25 + cf * 0.85);
            var cx = inst.originX + Math.cos(spreadAng) * dist;
            var cy = inst.originY + Math.sin(spreadAng) * dist;
            var rCloud = (4 + cf * 15) * mods.scale;
            var cCov = Math.sin(cf * Math.PI) * env * 0.48;
            if (cCov > 0.06) {
              surf.fillCircle(cx + 1, cy + 2, rCloud, C.frostPeriw, null, 0.72, cCov * 0.55);
              surf.fillCircle(cx, cy, rCloud * 0.85, C.frostMist, null, 0.82, cCov);
            }
          }

          // 6 条曲线呼啸寒风流缕（S 形波浪风丝而非僵硬直线）
          for (var r = 0; r < 6; r++) {
            var frac = (r / 5) * 2 - 1;
            var ang = inst.baseAng + frac * halfCone * 0.86;
            var pulse = ((t * 0.0042 + r * 0.21) % 1);
            var d0 = Math.max(8, (pulse - 0.36) * reach);
            var d1 = Math.min(reach, (pulse + 0.16) * reach);
            if (d1 <= d0 + 4) continue;
            var segs = 6;
            var px = inst.originX + Math.cos(ang) * d0;
            var py = inst.originY + Math.sin(ang) * d0;
            for (var s = 1; s <= segs; s++) {
              var sf = s / segs;
              var dd = lerp(d0, d1, sf);
              var wave = Math.sin(dd * 0.06 - t * 0.015 + r) * (2.5 + (dd / reach) * 5.5);
              var nx = inst.originX + Math.cos(ang) * dd - Math.sin(ang) * wave;
              var ny = inst.originY + Math.sin(ang) * dd + Math.cos(ang) * wave;
              surf.line(px, py + 1, nx, ny + 1, C.frostSlate, env * 0.65);
              surf.line(px, py, nx, ny, (r % 2 === 0) ? C.glacier : C.royalBlue, env * 0.9);
              px = nx;
              py = ny;
            }
            surf.px(px, py, C.iceWhite, env);
          }
        }
      }

      // 前景层：敌方半身凝结半透明冷蓝冰霜结晶壳
      if (layer === 'front' && t >= inst.tWave1Hit && t <= inst.tShellEnd) {
        var targets = inst.targets && inst.targets.length > 0 ? inst.targets : [inst.to];
        var freezeP = clamp((t - inst.tWave1Hit) / (inst.tWave2Hit - inst.tWave1Hit + 120), 0, 1);
        var fade = t > inst.tShellEnd - 240 ? (inst.tShellEnd - t) / 240 : 1;
        var build = easeOutCubic(freezeP);

        for (var ti = 0; ti < targets.length; ti++) {
          var tx = targets[ti].x;
          var ty = inst.groundY;
          var sc = mods.scale;
          var shellH = (26 + 26 * build) * sc;
          var shellW = (17 + 7 * build) * sc;

          var shellPoly = [
            [tx - shellW, ty],
            [tx - shellW * 1.12, ty - shellH * 0.56],
            [tx - shellW * 0.54, ty - shellH * 0.98],
            [tx + shellW * 0.08, ty - shellH * 1.08],
            [tx + shellW * 0.74, ty - shellH * 0.88],
            [tx + shellW * 1.08, ty - shellH * 0.44],
            [tx + shellW * 0.96, ty],
          ];
          var leftFacet = [
            [tx - shellW, ty],
            [tx - shellW * 1.12, ty - shellH * 0.56],
            [tx - shellW * 0.54, ty - shellH * 0.98],
            [tx - shellW * 0.12, ty - shellH * 0.52],
            [tx - shellW * 0.18, ty],
          ];
          var rightFacet = [
            [tx + shellW * 0.08, ty - shellH * 1.08],
            [tx + shellW * 0.74, ty - shellH * 0.88],
            [tx + shellW * 1.08, ty - shellH * 0.44],
            [tx + shellW * 0.96, ty],
            [tx + shellW * 0.16, ty],
            [tx + shellW * 0.12, ty - shellH * 0.48],
          ];

          surf.fillPoly(shellPoly, C.glacier, null, fade * 0.58, fade * 0.62);
          surf.fillPoly(leftFacet, C.iceCyan, null, fade * 0.68, fade * 0.72);
          surf.fillPoly(rightFacet, C.navyShadow, null, fade * 0.52, fade * 0.58);

          surf.line(tx - shellW * 0.54, ty - shellH * 0.98, tx - shellW * 0.18, ty, C.iceWhite, fade * 0.92);
          surf.line(tx + shellW * 0.08, ty - shellH * 1.08, tx + shellW * 0.16, ty, C.icePale, fade * 0.86);
          surf.line(tx - shellW * 1.12, ty - shellH * 0.56, tx + shellW * 1.08, ty - shellH * 0.44, C.royalBlue, fade * 0.78);
          surf.strokePoly(shellPoly, C.inkDeep, fade * 0.95);

          // 冰壳肩部额外小棱刺
          if (build > 0.5) {
            surf.fillPoly([[tx - shellW * 0.9, ty - shellH * 0.52], [tx - shellW * 1.38, ty - shellH * 0.76], [tx - shellW * 0.65, ty - shellH * 0.78]], C.iceCyan, C.inkDeep, fade * 0.9);
            surf.fillPoly([[tx + shellW * 0.88, ty - shellH * 0.46], [tx + shellW * 1.36, ty - shellH * 0.68], [tx + shellW * 0.66, ty - shellH * 0.72]], C.royalBlue, C.inkDeep, fade * 0.9);
          }

          if (t >= inst.tWave2Hit && fade > 0.4) {
            surf.drawStarGlint(tx - shellW * 0.46, ty - shellH * 0.88, 6.5 * mods.glint, 2.5, mods.gold > 0.5, fade);
          }
        }
      }
    },
  };

  /* ==================== 9. frost_thorn_field（霜域棘阵 · 3拍全场群刺） ==================== */
  HANDLERS.frost_thorn_field = {
    init: function (inst) {
      var rng = inst.rng;
      var s = inst.mods.scale;
      inst.tRuneEnd = 330;
      inst.tBeatTimes = [340, 610, 880];
      inst.tShatter = 1140;
      inst.beatFired = [false, false, false];
      inst.shatterFired = false;

      var centerX = inst.to.x;
      inst.fieldX = centerX;
      inst.fieldRx = 74 * s;
      inst.fieldRy = 18 * s;

      inst.thorns = [];
      var lanes = [
        { beat: 0, offsets: [-52, -34, -18], hMin: 26, hMax: 40, yOff: 5 },
        { beat: 1, offsets: [-24, -6, 12, 28], hMin: 36, hMax: 56, yOff: 0 },
        { beat: 2, offsets: [-44, -12, 6, 24, 44, 58], hMin: 40, hMax: 68, yOff: -4 },
      ];

      for (var l = 0; l < lanes.length; l++) {
        var ln = lanes[l];
        for (var i = 0; i < ln.offsets.length; i++) {
          var ox = ln.offsets[i] * s * inst.dir;
          var h = lerp(ln.hMin, ln.hMax, rng()) * s;
          inst.thorns.push({
            beat: ln.beat,
            x: centerX + ox + (rng() - 0.5) * 6,
            y: inst.groundY + ln.yOff + (rng() - 0.5) * 8,
            height: h,
            baseHalfW: (4.6 + (h / 68) * 4.2) * s,
            leanX: ((i % 2 === 0 ? 1 : -1) * (4 + rng() * 10) + (ox > 0 ? 3 : -3)),
            tStart: inst.tBeatTimes[ln.beat] + i * 22,
            goldRim: (ln.beat === 2 && i % 2 === 0 && inst.mods.gold > 0.35),
          });
        }
      }
      inst.thorns.sort(function (a, b) { return a.y - b.y; });
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      for (var b = 0; b < 3; b++) {
        if (!inst.beatFired[b] && currMs >= inst.tBeatTimes[b]) {
          inst.beatFired[b] = true;
          var laneX = inst.fieldX + (b - 1) * 28 * inst.dir * inst.mods.scale;
          triggerImpact(engine, inst, b, laneX, inst.groundY - 22, b === 2 ? 48 : 32, b === 2 ? 0.46 : 0.30);
          var burst = Math.round((8 + b * 4) * inst.mods.density);
          for (var k = 0; k < burst; k++) {
            spawnShard(engine,
              laneX + (rng() - 0.5) * 42,
              inst.groundY - 4,
              (rng() - 0.5) * 90,
              -(70 + rng() * 110),
              inst.groundY,
              { size: 2.3 + rng() * 1.5, life: 480 + rng() * 220, gold: (b === 2 && k % 4 === 0 && inst.mods.gold > 0.35) ? 0.9 : 0.08 }
            );
          }
        }
      }

      if (!inst.shatterFired && currMs >= inst.tShatter) {
        inst.shatterFired = true;
        triggerImpact(engine, inst, 3, inst.fieldX, inst.groundY - 28, 62, 0.58, { phase: 'shatter' });
        for (var i = 0; i < inst.thorns.length; i++) {
          var th = inst.thorns[i];
          var pieces = Math.max(2, Math.round(3.0 * inst.mods.density));
          for (var p = 0; p < pieces; p++) {
            var hf = 0.25 + rng() * 0.72;
            var px = lerp(th.x, th.x + th.leanX, hf);
            var py = th.y - th.height * hf;
            var ang = -Math.PI * 0.95 + rng() * Math.PI * 1.3;
            var spd = (55 + rng() * 130) * inst.mods.scale;
            // 70% 纯冰青/皇家蓝碎晶 + 30% 香槟金星霜碎晶
            var gVal = (p === 0 && rng() < 0.26 + inst.mods.gold * 0.16) ? 0.92 : (p % 2 === 0 ? 0.45 : 0.05);
            spawnShard(engine, px, py, Math.cos(ang) * spd, Math.sin(ang) * spd - 45, inst.groundY, {
              size: 2.5 + rng() * 2.2,
              rot: rng() * Math.PI * 2,
              vrot: (rng() - 0.5) * 22,
              gold: gVal,
              life: 520 + rng() * 340,
              groundJitter: (rng() - 0.5) * 14,
            });
          }
          if (i % 3 === 0) {
            spawnSpark(engine, th.x + th.leanX * 0.6, th.y - th.height * 0.65, 8.5 * inst.mods.glint, inst.mods.gold > 0.35 && (i % 6 === 0), 220);
          }
        }
        spawnDecal(engine, {
          kind: 'frost_patch',
          x: inst.fieldX,
          y: inst.groundY,
          rx: 68 * inst.mods.scale,
          ry: 17 * inst.mods.scale,
          spokes: 8,
          rot: 0.2,
          gold: inst.mods.gold > 0.35,
          life: 780,
        });
      }
    },
    render: function (surf, inst, layer) {
      var t = inst.elapsed;
      var mods = inst.mods;

      if (layer === 'ground') {
        var runeIn = clamp(t / 240, 0, 1);
        var runeFade = t > inst.tShatter ? clamp(1 - (t - inst.tShatter) / 620, 0, 1) : 1;
        var aRune = runeIn * runeFade;
        if (aRune > 0.02) {
          var fx = inst.fieldX, fy = inst.groundY;
          var rx = inst.fieldRx * easeOutCubic(runeIn);
          var ry = inst.fieldRy * easeOutCubic(runeIn);

          surf.drawFloorHexSeal(fx, fy, rx, ry, t * 0.0007, runeIn, mods.amp.goldAura, aRune * 0.92, true);
          for (var tk = 0; tk < 24; tk++) {
            var ang = (Math.PI * 2 * tk) / 24 + t * 0.0004;
            var major = (tk % 4 === 0);
            var r0 = major ? 0.80 : 0.90;
            var r1 = major ? 1.12 : 1.05;
            surf.line(
              fx + Math.cos(ang) * rx * r0, fy + Math.sin(ang) * ry * r0,
              fx + Math.cos(ang) * rx * r1, fy + Math.sin(ang) * ry * r1,
              major ? C.inkIndigo : C.glacier, aRune * 0.9
            );
          }
          for (var ln = -1; ln <= 1; ln++) {
            var lx = fx + ln * rx * 0.44;
            var active = t >= inst.tBeatTimes[ln + 1] - 90;
            surf.line(lx, fy - ry * 0.72, lx, fy + ry * 0.72, active ? C.iceCyan : C.royalBlue, aRune * (active ? 0.95 : 0.55));
          }
        }
      }

      if (layer === 'main') {
        if (t < 360) {
          surf.drawCastSeal(inst.from.x, inst.from.y, clamp(t / 360, 0, 1), mods, inst.seed, false);
        }

        if (t < inst.tShatter + 80) {
          var preShatterAlpha = t > inst.tShatter ? 1 - (t - inst.tShatter) / 80 : 1;
          var tremor = (t > inst.tShatter - 110 && t <= inst.tShatter) ? ((Math.floor(t / 20) & 1) ? 1.2 : -1.2) : 0;
          for (var i = 0; i < inst.thorns.length; i++) {
            var th = inst.thorns[i];
            if (t < th.tStart) continue;
            var gp = clamp((t - th.tStart) / 145, 0, 1);
            drawIceThornSpike(surf, th.x + tremor, th.y, th.height, th.baseHalfW, th.leanX, gp, th.goldRim, preShatterAlpha);
          }
        }

        if (t >= inst.tShatter && t <= inst.tShatter + 320) {
          var sp = (t - inst.tShatter) / 320;
          drawCrystalImpactBurst(surf, inst.fieldX - 24 * mods.scale, inst.groundY - 26, sp, 0.95 * mods.scale, mods.gold * 0.6, inst.dir);
          drawCrystalImpactBurst(surf, inst.fieldX + 26 * mods.scale, inst.groundY - 30, sp, 1.05 * mods.scale, Math.max(0.45, mods.gold), inst.dir);
        }
      }
    },
  };

  /* ==================== 10. ice_shield_line（冰盾护御线 · Lv1 冰盾 / Lv2 镜霜壁 / Lv3 钢冰护幕） ==================== */
  HANDLERS.ice_shield_line = {
    init: function (inst) {
      inst.lv = clamp(Math.round(Number(inst.lv) || 1), 1, 3);
      inst.anchorX = inst.opts.anchor ? inst.opts.anchor.x : inst.from.x;
      inst.anchorY = inst.opts.anchor ? inst.opts.anchor.y : inst.from.y;
      inst.tFormEnd = 300;
      inst.tHoldEnd = inst.durationMs - 340;
      inst.impactFired = false;
    },
    update: function (engine, inst, prevMs, currMs) {
      var rng = inst.rng;
      if (!inst.impactFired && currMs >= inst.tFormEnd) {
        inst.impactFired = true;
        var shieldFrontX = inst.anchorX + inst.dir * (inst.lv === 3 ? 0 : 24) * inst.mods.scale;
        triggerImpact(engine, inst, 0, shieldFrontX, inst.anchorY, 26 + inst.lv * 6, 0.14 + inst.lv * 0.06, { lv: inst.lv });
        // 成形瞬间错落漂浮的轻盈冰花与星芒（绝无呆板圆圈碎粒阵列！）
        var flkCnt = Math.round((4 + inst.lv * 2) * inst.mods.density);
        for (var i = 0; i < flkCnt; i++) {
          spawnFlake(engine,
            shieldFrontX + (rng() - 0.5) * (24 + inst.lv * 18) * inst.mods.scale,
            inst.anchorY + (rng() - 0.5) * 44 * inst.mods.scale,
            (rng() - 0.5) * 22,
            -(14 + rng() * 24),
            { sizeKey: i % 2 === 0 ? 5 : 7, life: 460 + rng() * 220, gold: inst.lv === 3 && i % 2 === 0 }
          );
        }
        spawnSpark(engine, inst.anchorX + inst.dir * (inst.lv === 3 ? 28 : 24) * inst.mods.scale, inst.anchorY - 14, (7 + inst.lv * 2.5) * inst.mods.glint, inst.lv === 3 || inst.mods.gold > 0.45, 280);
      }

      if (currMs > inst.tFormEnd && currMs < inst.tHoldEnd && Math.floor(prevMs / 170) !== Math.floor(currMs / 170)) {
        if (inst.lv === 2) {
          var sy = inst.anchorY - 22 + rng() * 44;
          spawnSpark(engine, inst.anchorX + inst.dir * 38 * inst.mods.scale, sy, 6.5 * inst.mods.glint, inst.mods.gold > 0.4, 210);
        } else if (inst.lv === 3) {
          var ga = rng() * Math.PI * 2;
          spawnSpark(engine, inst.anchorX + Math.cos(ga) * 34 * inst.mods.scale, inst.anchorY + Math.sin(ga) * 30 * inst.mods.scale, 6 * inst.mods.glint, true, 220);
        }
      }
    },
    render: function (surf, inst, layer) {
      var t = inst.elapsed;
      var mods = inst.mods;
      var lv = inst.lv;
      var cx = inst.anchorX;
      var cy = inst.anchorY;
      var gy = inst.groundY;
      var dir = inst.dir;
      var s = mods.scale;

      var formP = clamp(t / inst.tFormEnd, 0, 1);
      var build = easeOutBack(formP);
      var fade = t > inst.tHoldEnd ? clamp(1 - (t - inst.tHoldEnd) / (inst.durationMs - inst.tHoldEnd), 0, 1) : 1;
      var ditherOut = t > inst.tHoldEnd ? fade : 1;
      var sheenPhase = ((t - inst.tFormEnd) * 0.0018) % 1;

      if (layer === 'ground') {
        var rBase = (lv === 3 ? 44 : (lv === 2 ? 32 : 24)) * s;
        surf.drawFloorHexSeal(
          lv === 1 ? cx + dir * 24 * s : (lv === 2 ? cx + dir * 20 * s : cx),
          gy,
          rBase * easeOutCubic(formP),
          rBase * 0.28 * easeOutCubic(formP),
          t * 0.0006,
          formP,
          lv === 3 || mods.amp.goldAura,
          fade * 0.9,
          lv >= 2
        );
      }

      // ---------- Back Layer: Lv3 全周身钢冰护幕后壁 & 后半圈旋转护箱冰环 ----------
      if (layer === 'back' && lv === 3) {
        var bRx = 37 * s * Math.min(1.06, build);
        var bRy = 42 * s * Math.min(1.06, build);
        var backDome = [
          [cx - bRx * 0.90, gy - 2],
          [cx - bRx, cy - bRy * 0.14],
          [cx - bRx * 0.66, cy - bRy * 0.80],
          [cx, cy - bRy * 1.02],
          [cx + bRx * 0.66, cy - bRy * 0.80],
          [cx + bRx, cy - bRy * 0.14],
          [cx + bRx * 0.90, gy - 2],
        ];
        surf.fillPoly(backDome, C.steelDark, null, fade * 0.30, ditherOut * 0.46);
        surf.strokePoly(backDome, C.goldDeep, fade * 0.72, ditherOut);

        var ringRx = 45 * s * Math.min(1.04, build);
        var ringRy = 12 * s * Math.min(1.04, build);
        var ringY = cy + 6;
        surf.strokeEllipse(cx, ringY, ringRx, ringRy, C.frostSlate, fade * 0.65, ditherOut, Math.PI, Math.PI * 2);
        surf.strokeEllipse(cx, ringY - 1, ringRx * 0.96, ringRy * 0.96, C.goldMid, fade * 0.55, ditherOut, Math.PI, Math.PI * 2);

        var nodes = 6;
        for (var n = 0; n < nodes; n++) {
          var na = t * 0.0022 + (Math.PI * 2 * n) / nodes;
          if (Math.sin(na) < 0) {
            var nx = cx + Math.cos(na) * ringRx;
            var ny = ringY + Math.sin(na) * ringRy;
            surf.drawFacetedCrystal(nx, ny, 5.4 * s, 3.2 * s, Math.PI * 0.5, 0.52, fade * 0.72);
          }
        }
      }

      if (layer !== 'front') return;

      if (lv === 1) {
        /* Lv1 冰盾：单面厚实六角切面实体冰墙 */
        var wx = cx + dir * 24 * s;
        var wallH = 54 * s * Math.min(1.06, build);
        var wallW = 11 * s;
        var thick = 5.5 * s * dir;
        var topY = gy - wallH;
        var midY = gy - wallH * 0.5;

        var frontHex = [
          [wx - wallW * 0.55, gy - 2],
          [wx - wallW * 0.95, midY + wallH * 0.16],
          [wx - wallW * 0.95, midY - wallH * 0.16],
          [wx - wallW * 0.35, topY],
          [wx + wallW * 0.55, topY + 4],
          [wx + wallW * 0.95, midY - wallH * 0.14],
          [wx + wallW * 0.95, midY + wallH * 0.18],
          [wx + wallW * 0.45, gy - 2],
        ];
        var sideBevel = [
          [wx + wallW * 0.55, topY + 4],
          [wx + wallW * 0.55 + thick, topY + 6],
          [wx + wallW * 0.95 + thick, midY - wallH * 0.12],
          [wx + wallW * 0.95 + thick, midY + wallH * 0.20],
          [wx + wallW * 0.45 + thick, gy - 2],
          [wx + wallW * 0.45, gy - 2],
          [wx + wallW * 0.95, midY + wallH * 0.18],
          [wx + wallW * 0.95, midY - wallH * 0.14],
        ];

        surf.fillPoly(sideBevel, C.navyShadow, C.inkDeep, fade * 0.95, ditherOut);
        surf.fillPoly(frontHex, C.glacier, null, fade * 0.88, ditherOut);
        surf.fillPoly([frontHex[3], frontHex[4], frontHex[5], [wx, midY], frontHex[2]], C.iceCyan, null, fade * 0.86, ditherOut);
        surf.fillPoly([[wx, midY], frontHex[5], frontHex[6], frontHex[7]], C.royalBlue, null, fade * 0.72, ditherOut);
        var innerHex = [];
        for (var h = 0; h < 6; h++) {
          var ha = (Math.PI * 2 * h) / 6 + Math.PI / 6;
          innerHex.push([wx + Math.cos(ha) * wallW * 0.62, midY + Math.sin(ha) * wallH * 0.28]);
        }
        surf.strokePoly(innerHex, C.icePale, fade * 0.92, ditherOut);
        var sY = lerp(topY + 6, gy - 8, sheenPhase);
        surf.line(wx - wallW * 0.65, sY + 4, wx + wallW * 0.65, sY - 4, C.iceWhite, fade * 0.92);
        surf.strokePoly(frontHex, C.inkDeep, fade, ditherOut);
        surf.fillPoly([[wx - wallW * 1.15, gy], [wx, gy - 8 * s], [wx + wallW * 1.25, gy]], C.frostPeriw, C.inkDeep, fade * 0.92);

      } else if (lv === 2) {
        /* Lv2 镜霜壁：三面多角度折射镜霜壁 + 外向锐利冰刺反芒 */
        var mx = cx + dir * 20 * s;
        var mH = 64 * s * Math.min(1.06, build);
        var topY2 = gy - mH;

        var panels = [
          {
            pts: [
              [mx - dir * 2 * s, topY2 + 2],
              [mx + dir * 10 * s, topY2 + 6],
              [mx + dir * 15 * s, topY2 + mH * 0.34],
              [mx + dir * 2 * s, topY2 + mH * 0.34],
            ],
            col: C.iceCyan,
          },
          {
            pts: [
              [mx + dir * 2 * s, topY2 + mH * 0.34],
              [mx + dir * 15 * s, topY2 + mH * 0.34],
              [mx + dir * 16 * s, topY2 + mH * 0.72],
              [mx + dir * 3 * s, topY2 + mH * 0.72],
            ],
            col: C.glacier,
          },
          {
            pts: [
              [mx + dir * 3 * s, topY2 + mH * 0.72],
              [mx + dir * 16 * s, topY2 + mH * 0.72],
              [mx + dir * 11 * s, gy - 1],
              [mx - dir * 3 * s, gy - 1],
            ],
            col: C.royalBlue,
          },
        ];

        for (var p = 0; p < panels.length; p++) {
          var pn = panels[p];
          surf.fillPoly(pn.pts, pn.col, null, fade * 0.86, ditherOut);
          var refOff = ((sheenPhase + p * 0.31) % 1);
          var rx0 = lerp(pn.pts[0][0], pn.pts[3][0], refOff);
          var ry0 = lerp(pn.pts[0][1], pn.pts[3][1], refOff);
          var rx1 = lerp(pn.pts[1][0], pn.pts[2][0], clamp(refOff - 0.25, 0, 1));
          var ry1 = lerp(pn.pts[1][1], pn.pts[2][1], clamp(refOff - 0.25, 0, 1));
          surf.line(rx0, ry0, rx1, ry1, C.iceWhite, fade * 0.92);
          surf.line(rx0, ry0 + 1, rx1, ry1 + 1, C.icePale, fade * 0.75);
          surf.strokePoly(pn.pts, C.inkDeep, fade, ditherOut);
        }

        var spikeCount = 5;
        for (var k = 0; k < spikeCount; k++) {
          var sf = (k + 0.5) / spikeCount;
          var sy = lerp(topY2 + 8, gy - 8, sf);
          var sx = mx + dir * (13 + Math.sin(sf * Math.PI) * 3.5) * s;
          var spLen = (11 + Math.sin(sf * Math.PI) * 8) * s * easeOutCubic(clamp(formP * 1.2 - 0.15, 0, 1));
          var spAng = (sf - 0.5) * 0.55 * dir;
          var tipX = sx + dir * Math.cos(spAng) * spLen;
          var tipY = sy + Math.sin(spAng) * spLen;
          var upper = [sx - dir * 1, sy - 3.2 * s];
          var lower = [sx - dir * 1, sy + 3.2 * s];
          surf.fillPoly([upper, [tipX, tipY], [sx, sy]], C.iceCyan, null, fade * 0.95);
          surf.fillPoly([[sx, sy], [tipX, tipY], lower], C.navyShadow, null, fade * 0.95);
          surf.line(sx, sy, tipX, tipY, C.iceWhite, fade);
          surf.strokePoly([upper, [tipX, tipY], lower], C.inkDeep, fade);

          var glintWave = Math.sin(t * 0.012 + k * 1.45);
          if (glintWave > 0.30 && fade > 0.3) {
            var gPower = (glintWave - 0.30) / 0.70;
            surf.drawStarGlint(tipX, tipY, (5.5 + 4 * gPower) * mods.glint, 2.2, mods.gold > 0.35 || (k === 2), gPower * fade);
          }
        }

      } else {
        /* Lv3 钢冰护幕：连贯穹顶香槟金镶棱钢冰护幕 + 柔和旋转护箱冰环 */
        var aRx = 37 * s * Math.min(1.06, build);
        var aRy = 42 * s * Math.min(1.06, build);
        var apexY = cy - aRy * 1.02;

        // 中央柔和半透明玻璃折射护幕（斜向极细冰光扫带，清晰透出内部被守护角色）
        var curtainPoly = [
          [cx - aRx * 0.70, gy - 2],
          [cx - aRx * 0.78, cy + 4],
          [cx - aRx * 0.64, cy - aRy * 0.50],
          [cx, apexY + 6 * s],
          [cx + aRx * 0.64, cy - aRy * 0.50],
          [cx + aRx * 0.78, cy + 4],
          [cx + aRx * 0.70, gy - 2],
        ];
        surf.fillPoly(curtainPoly, C.iceCyan, null, fade * 0.28, ditherOut * 0.22);
        // 两条斜向晶体折射细光带（替代沉闷灰格子，显清透宝石玻璃质感！）
        var diagY = lerp(apexY + 12, gy - 16, sheenPhase);
        surf.line(cx - aRx * 0.55, diagY + 10, cx + aRx * 0.55, diagY - 12, C.icePale, fade * 0.72, ditherOut);
        surf.line(cx - aRx * 0.45, diagY + 14, cx + aRx * 0.45, diagY - 8, C.iceWhite, fade * 0.55, ditherOut);

        // 左右连贯一体穹顶钢冰护翼（在穹顶顶点无缝衔接！）
        for (var side = -1; side <= 1; side += 2) {
          var wingOuter = [
            [cx + side * aRx * 0.88, gy - 1],
            [cx + side * aRx * 1.02, cy + 2],
            [cx + side * aRx * 0.88, cy - aRy * 0.56],
            [cx + side * aRx * 0.46, cy - aRy * 0.90],
            [cx + side * 4 * s, apexY + 1 * s],
            [cx + side * 3 * s, apexY + 9 * s],
            [cx + side * aRx * 0.36, cy - aRy * 0.74],
            [cx + side * aRx * 0.68, cy - aRy * 0.46],
            [cx + side * aRx * 0.78, cy + 2],
            [cx + side * aRx * 0.68, gy - 1],
          ];
          surf.fillPoly(wingOuter, C.steelMid, null, fade * 0.88, ditherOut * 0.94);
          var steelHighlight = [
            [cx + side * aRx * 0.88, cy - aRy * 0.56],
            [cx + side * aRx * 0.46, cy - aRy * 0.90],
            [cx + side * 4 * s, apexY + 1 * s],
            [cx + side * 3 * s, apexY + 6 * s],
            [cx + side * aRx * 0.40, cy - aRy * 0.80],
            [cx + side * aRx * 0.76, cy - aRy * 0.50],
          ];
          surf.fillPoly(steelHighlight, C.steelLight, null, fade * 0.92);
          surf.strokePoly(wingOuter, C.goldInk, fade * 0.95, ditherOut);
          // 香槟金外缘镶棱
          surf.line(wingOuter[0][0], wingOuter[0][1], wingOuter[1][0], wingOuter[1][1], C.goldMid, fade);
          surf.line(wingOuter[1][0], wingOuter[1][1], wingOuter[2][0], wingOuter[2][1], C.goldBright, fade);
          surf.line(wingOuter[2][0], wingOuter[2][1], wingOuter[3][0], wingOuter[3][1], C.goldBright, fade);
          surf.line(wingOuter[3][0], wingOuter[3][1], wingOuter[4][0], wingOuter[4][1], C.goldWhite, fade);
          // 内缘冰青棱脊
          surf.line(wingOuter[6][0], wingOuter[6][1], wingOuter[7][0], wingOuter[7][1], C.iceCyan, fade * 0.92);
          surf.line(wingOuter[7][0], wingOuter[7][1], wingOuter[8][0], wingOuter[8][1], C.iceCyan, fade * 0.88);
        }

        // 顶部镶嵌香槟金拱冠宝石封顶
        var crownPoly = [
          [cx, apexY - 6 * s],
          [cx + 7.5 * s, apexY + 2 * s],
          [cx, apexY + 9 * s],
          [cx - 7.5 * s, apexY + 2 * s],
        ];
        surf.fillPoly(crownPoly, C.goldMid, C.goldInk, fade);
        surf.fillPoly([[cx, apexY - 6 * s], [cx + 4 * s, apexY + 2 * s], [cx, apexY + 2 * s], [cx - 4 * s, apexY + 2 * s]], C.goldBright, null, fade);
        surf.px(cx, apexY - 2, C.goldWhite, fade);

        // 前半圈柔和旋转护箱冰环 (sin(a) >= 0) + 蓝金交错棱晶护盾节点
        var fRingRx = 45 * s * Math.min(1.04, build);
        var fRingRy = 12 * s * Math.min(1.04, build);
        var fRingY = cy + 6;
        surf.strokeEllipse(cx, fRingY + 1, fRingRx, fRingRy, C.inkIndigo, fade * 0.72, ditherOut, 0, Math.PI);
        surf.strokeEllipse(cx, fRingY, fRingRx, fRingRy, C.glacier, fade * 0.95, ditherOut, 0, Math.PI);
        surf.strokeEllipse(cx, fRingY - 1, fRingRx * 0.96, fRingRy * 0.96, C.goldBright, fade * 0.88, ditherOut, 0, Math.PI);

        var fNodes = 6;
        for (var fn = 0; fn < fNodes; fn++) {
          var fna = t * 0.0022 + (Math.PI * 2 * fn) / fNodes;
          if (Math.sin(fna) >= 0) {
            var fnx = cx + Math.cos(fna) * fRingRx;
            var fny = fRingY + Math.sin(fna) * fRingRy;
            var isGoldNode = (fn % 2 === 0);
            surf.drawFacetedCrystal(fnx, fny, 6.8 * s, 4.0 * s, Math.PI * 0.5, isGoldNode ? 0.92 : 0.12, fade);
            if (Math.sin(fna) > 0.72) {
              surf.drawStarGlint(fnx, fny - 3.5 * s, 5.2 * mods.glint, 2.0, isGoldNode, fade * 0.92);
            }
          }
        }
      }
    },
  };

  /* ============================================================================
     主引擎类 VfxEngine
     ============================================================================ */
  function VfxEngine(canvasOrOpts, maybeOpts) {
    var canvas = null;
    var opts = {};
    if (canvasOrOpts && typeof canvasOrOpts.getContext === 'function') {
      canvas = canvasOrOpts;
      opts = maybeOpts || {};
    } else if (canvasOrOpts && typeof canvasOrOpts === 'object') {
      opts = canvasOrOpts;
      canvas = opts.canvas || null;
    }

    this.width = (opts.width | 0) || LOGICAL_WIDTH;
    this.height = (opts.height | 0) || LOGICAL_HEIGHT;
    this.canvas = canvas;
    this.ctx = null;
    this.surface = new PixelSurface(this.width, this.height);

    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = false;
        this.surface.bindImageData(this.ctx);
      }
    }

    this.hooks = opts.hooks || {};
    this.applyInternalHitStop = !!opts.applyInternalHitStop;
    this.maxParticles = opts.maxParticles || 320;
    this.maxDecals = opts.maxDecals || 48;

    this.spells = [];
    this.particles = [];
    this.decals = [];
    this._nextId = 1;
    this._seedCounter = 101;
    this._eventsLog = [];

    this.shakeTrauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._shakePhase = 0;
    this._hitStopRemainMs = 0;

    this._rafId = 0;
    this._running = false;
    this._lastTs = 0;
    this.lastRenderMs = 0;
  }

  VfxEngine.prototype._emitImpact = function (inst, info) {
    this._eventsLog.push(info);
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + info.shake * 0.72);
    if (this.applyInternalHitStop && info.hitStopMs > 0) {
      this._hitStopRemainMs = Math.max(this._hitStopRemainMs, info.hitStopMs);
    }

    if (info.hitStopMs > 0) {
      if (typeof inst.opts.onHitStop === 'function') inst.opts.onHitStop(info.hitStopMs, info.shake, info);
      if (typeof this.hooks.onHitStop === 'function') this.hooks.onHitStop(info.hitStopMs, info.shake, info);
    }
    if (info.shake > 0) {
      if (typeof inst.opts.onShake === 'function') inst.opts.onShake(info.shake, this.shakeX, this.shakeY, info);
      if (typeof this.hooks.onShake === 'function') this.hooks.onShake(info.shake, this.shakeX, this.shakeY, info);
    }
    if (typeof inst.opts.onImpact === 'function') inst.opts.onImpact(info.beatIndex, info);
    if (typeof this.hooks.onImpact === 'function') this.hooks.onImpact(info.beatIndex, info);
    if (typeof inst.opts.onBeat === 'function') inst.opts.onBeat(info.beatIndex, 'hit', info);
    if (typeof this.hooks.onBeat === 'function') this.hooks.onBeat(info.beatIndex, 'hit', info);
  };

  VfxEngine.prototype.play = function (spellId, options) {
    var spec = SPELLS[spellId];
    var handler = HANDLERS[spellId];
    if (!spec || !handler) {
      throw new Error('VfxSpellsV3: unknown spellId "' + spellId + '"');
    }
    var opts = options || {};
    var from = opts.from ? { x: opts.from.x, y: opts.from.y } : { x: 118, y: 158 };
    var to = opts.to ? { x: opts.to.x, y: opts.to.y } : { x: 356, y: 156 };
    var groundY = typeof opts.groundY === 'number'
      ? opts.groundY
      : Math.min(this.height - 24, Math.max(from.y, to.y) + 46);
    var dir = typeof opts.flip === 'boolean' ? (opts.flip ? -1 : 1) : (to.x >= from.x ? 1 : -1);
    var seed = typeof opts.seed === 'number' ? (opts.seed | 0) : (this._seedCounter = (this._seedCounter + 997) | 0);
    var mods = resolveModifiers(opts.timingGrade || 'good', opts.ampTier || 0, opts.scale || 1.0);

    var inst = {
      id: this._nextId++,
      spellId: spellId,
      spec: spec,
      handler: handler,
      opts: opts,
      from: from,
      to: to,
      targets: Array.isArray(opts.targets) ? opts.targets.map(function (pt) { return { x: pt.x, y: pt.y }; }) : null,
      groundY: groundY,
      dir: dir,
      lv: clamp(Math.round(Number(opts.lv) || 1), 1, 3),
      mods: mods,
      seed: seed,
      rng: createRng(seed),
      elapsed: 0,
      durationMs: typeof opts.durationMs === 'number' ? opts.durationMs : spec.durationMs,
      done: false,
    };

    handler.init(inst);
    this.spells.push(inst);

    if (typeof opts.onBeat === 'function') {
      opts.onBeat(0, 'start', { spellId: spellId, instanceId: inst.id, timingGrade: mods.timingGrade, ampTier: mods.ampTier, lv: inst.lv });
    }
    if (typeof this.hooks.onBeat === 'function') {
      this.hooks.onBeat(0, 'start', { spellId: spellId, instanceId: inst.id, timingGrade: mods.timingGrade, ampTier: mods.ampTier, lv: inst.lv });
    }
    return inst.id;
  };

  VfxEngine.prototype.update = function (dtMs) {
    var clampedDt = clamp(Number(dtMs) || 0, 0, 50);
    if (clampedDt <= 0) return;

    if (this.shakeTrauma > 0.001) {
      this._shakePhase += clampedDt * 0.09;
      var mag = this.shakeTrauma * this.shakeTrauma * 5.2;
      this.shakeX = Math.round(Math.sin(this._shakePhase * 3.1) * mag);
      this.shakeY = Math.round(Math.cos(this._shakePhase * 4.3) * mag * 0.72);
      this.shakeTrauma = Math.max(0, this.shakeTrauma - clampedDt * 0.0026);
    } else {
      this.shakeTrauma = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }

    var simDt = clampedDt;
    if (this.applyInternalHitStop && this._hitStopRemainMs > 0) {
      this._hitStopRemainMs = Math.max(0, this._hitStopRemainMs - clampedDt);
      simDt = clampedDt * 0.14;
    }

    for (var i = this.spells.length - 1; i >= 0; i--) {
      var inst = this.spells[i];
      var prevMs = inst.elapsed;
      inst.elapsed += simDt;
      inst.handler.update(this, inst, prevMs, inst.elapsed);
      if (inst.elapsed >= inst.durationMs) {
        inst.done = true;
        var doneInfo = {
          spellId: inst.spellId,
          instanceId: inst.id,
          timingGrade: inst.mods.timingGrade,
          ampTier: inst.mods.ampTier,
          lv: inst.lv,
        };
        this.spells.splice(i, 1);
        if (typeof inst.opts.onComplete === 'function') inst.opts.onComplete(doneInfo);
        if (typeof this.hooks.onComplete === 'function') this.hooks.onComplete(doneInfo);
      }
    }

    updateParticlesAndDecals(this, simDt);
  };

  VfxEngine.prototype.render = function (targetCtx) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var ctx = targetCtx || this.ctx;
    var surf = this.surface;
    if (ctx) {
      surf.bindImageData(ctx);
    }
    surf.clear();

    renderDecals(surf, this.decals);
    for (var g = 0; g < this.spells.length; g++) {
      this.spells[g].handler.render(surf, this.spells[g], 'ground');
    }
    for (var b = 0; b < this.spells.length; b++) {
      this.spells[b].handler.render(surf, this.spells[b], 'back');
    }
    for (var m = 0; m < this.spells.length; m++) {
      this.spells[m].handler.render(surf, this.spells[m], 'main');
    }
    renderParticles(surf, this.particles);
    for (var f = 0; f < this.spells.length; f++) {
      this.spells[f].handler.render(surf, this.spells[f], 'front');
    }

    if (ctx && surf.imageData) {
      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(surf.imageData, 0, 0);
    }
    var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.lastRenderMs = t1 - t0;
    return surf;
  };

  VfxEngine.prototype.renderFrameAt = function (spellId, timeMs, options) {
    this.clear();
    var opts = Object.assign({ seed: 202604 }, options || {});
    var prevHS = this.applyInternalHitStop;
    this.applyInternalHitStop = false;
    this.play(spellId, opts);
    var step = 16.6667;
    var acc = 0;
    var target = Math.max(0, Number(timeMs) || 0);
    while (acc + step <= target) {
      this.update(step);
      acc += step;
    }
    if (target - acc > 0.01) {
      this.update(target - acc);
    }
    this.render();
    this.applyInternalHitStop = prevHS;
    return {
      spellId: spellId,
      timeMs: target,
      activeSpells: this.spells.length,
      activeParticles: this.particles.length,
      activeDecals: this.decals.length,
      events: this._eventsLog.slice(),
      shakeOffset: this.getCameraOffset(),
      lastRenderMs: this.lastRenderMs,
    };
  };

  VfxEngine.prototype.start = function () {
    if (this._running) return;
    if (typeof requestAnimationFrame !== 'function') return;
    this._running = true;
    this._lastTs = 0;
    var self = this;
    function tick(ts) {
      if (!self._running) return;
      var dt = self._lastTs ? (ts - self._lastTs) : 16.67;
      self._lastTs = ts;
      self.update(dt);
      self.render();
      self._rafId = requestAnimationFrame(tick);
    }
    this._rafId = requestAnimationFrame(tick);
  };

  VfxEngine.prototype.stop = function () {
    this._running = false;
    if (this._rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = 0;
  };

  VfxEngine.prototype.clear = function () {
    this.spells.length = 0;
    this.particles.length = 0;
    this.decals.length = 0;
    this._eventsLog.length = 0;
    this.shakeTrauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._hitStopRemainMs = 0;
    this.surface.clear();
    if (this.ctx && this.surface.imageData) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  };

  VfxEngine.prototype.getCameraOffset = function () {
    return { x: this.shakeX, y: this.shakeY, trauma: this.shakeTrauma };
  };

  VfxEngine.prototype.getStats = function () {
    return {
      width: this.width,
      height: this.height,
      activeSpells: this.spells.length,
      particles: this.particles.length,
      groundDecals: this.decals.length,
      lastRenderMs: this.lastRenderMs,
    };
  };

  VfxEngine.prototype.dispose = function () {
    this.stop();
    this.clear();
    this.canvas = null;
    this.ctx = null;
  };

  function listSpells() {
    var keys = Object.keys(SPELLS);
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      out.push(SPELLS[keys[i]]);
    }
    return out;
  }

  function getSpellSpec(spellId) {
    return SPELLS[spellId] || null;
  }

  function createEngine(canvasOrOpts, opts) {
    return new VfxEngine(canvasOrOpts, opts);
  }

  return {
    VERSION: VERSION,
    LOGICAL_WIDTH: LOGICAL_WIDTH,
    LOGICAL_HEIGHT: LOGICAL_HEIGHT,
    PALETTE: PALETTE,
    SPELLS: SPELLS,
    TIMING_PROFILES: TIMING_PROFILES,
    AMP_PROFILES: AMP_PROFILES,
    listSpells: listSpells,
    getSpellSpec: getSpellSpec,
    createEngine: createEngine,
    VfxEngine: VfxEngine,
  };
});
