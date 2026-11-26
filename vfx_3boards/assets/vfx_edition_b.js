/* ============================================================================
   新版明亮战斗特效竞标 · 方案 B（精修巅峰版）
   《星之海 (Sea of Stars)》×《八方旅人 (Octopath Traveler)》高亮通透像素辉光派
   导出：window.VfxEditionB
   逻辑画布：640×360（内置 320×180 零锯齿像素晶面光栅缓冲 + 640×360 柔和晶体辉光层）
   零外部依赖 · 60fps 丝滑流畅 · 专为雪瓷亮底 (#FAFBFD) 打造的宝石折射高光色阶
   ============================================================================ */
(function (global) {
  'use strict';

  const LOGICAL_W = 640;
  const LOGICAL_H = 360;
  const PX_SCALE = 2; // 320×180 海之星原生像素密度，2× 整数硬边缘放大至 640×360
  const PW = LOGICAL_W / PX_SCALE; // 320
  const PH = LOGICAL_H / PX_SCALE; // 180

  /* -------------------- 高亮宝石晶体色板（绝无黑脏厚边） -------------------- */
  const RGB = {
    // 冰晶系
    ICE_WHITE: [248, 253, 255],   // #F8FDFF
    PURE_WHITE: [255, 255, 255],  // #FFFFFF
    ICE_PALE: [224, 249, 255],    // #E0F9FF
    ICE_CYAN: [103, 232, 249],    // #67E8F9
    ICE_ELEC: [56, 189, 248],     // #38BDF8
    ICE_SKY: [14, 165, 233],      // #0EA5E9
    ICE_COBALT: [2, 132, 199],    // #0284C7
    ICE_JEWEL: [3, 105, 161],     // #0369A1 通透宝石蓝轻边
    ICE_SAPPHIRE: [29, 78, 216],  // #1D4ED8 宝石蓝折光深面

    // 澄澈水浪系
    WATER_FOAM: [248, 253, 255],  // #F8FDFF
    WATER_MIST: [165, 243, 252],  // #A5F3FC
    WATER_AQUA: [34, 211, 238],   // #22D3EE
    WATER_SURGE: [6, 182, 212],   // #06B6D4
    WATER_COBALT: [2, 132, 199],  // #0284C7
    WATER_TEAL: [14, 116, 144],   // #0E7490 通透海青边

    // 暖香槟星金系
    GOLD_CORE: [255, 253, 240],   // #FFFDF0
    GOLD_PALE: [254, 240, 138],   // #FEF08A
    GOLD_BRIGHT: [253, 224, 71],  // #FDE047
    GOLD_SUN: [250, 204, 21],     // #FACC15
    GOLD_AMBER: [245, 158, 11],   // #F59E0B
    GOLD_RIM: [217, 119, 6],      // #D97706 暖金折光边（白底闪耀不隐身）

    // 翠青疾风系
    WIND_WHITE: [240, 253, 250],  // #F0FDFA
    WIND_MINT: [167, 243, 208],   // #A7F3D0
    WIND_LIGHT: [110, 231, 183],  // #6EE7B7
    WIND_JADE: [52, 211, 153],    // #34D399
    WIND_EMERALD: [16, 185, 129], // #10B981
    WIND_TEAL: [13, 148, 136],    // #0D9488 透亮翠青边
  };

  const CRYSTAL_ICE_PAL = {
    white: RGB.ICE_WHITE,
    bright: RGB.ICE_CYAN,
    mid: RGB.ICE_ELEC,
    body: RGB.ICE_SKY,
    deep: RGB.ICE_COBALT,
    rim: RGB.ICE_JEWEL,
  };

  const CRYSTAL_SAPPHIRE_PAL = {
    white: RGB.PURE_WHITE,
    bright: RGB.ICE_CYAN,
    mid: RGB.ICE_SKY,
    body: RGB.ICE_COBALT,
    deep: RGB.ICE_SAPPHIRE,
    rim: RGB.ICE_SAPPHIRE,
  };

  const CRYSTAL_GOLD_PAL = {
    white: RGB.GOLD_CORE,
    bright: RGB.GOLD_PALE,
    mid: RGB.GOLD_BRIGHT,
    body: RGB.GOLD_SUN,
    deep: RGB.GOLD_AMBER,
    rim: RGB.GOLD_RIM,
  };

  const CRYSTAL_WATER_PAL = {
    white: RGB.WATER_FOAM,
    bright: RGB.WATER_MIST,
    mid: RGB.WATER_AQUA,
    body: RGB.WATER_SURGE,
    deep: RGB.WATER_COBALT,
    rim: RGB.WATER_TEAL,
  };

  const CRYSTAL_WIND_PAL = {
    white: RGB.WIND_WHITE,
    bright: RGB.WIND_MINT,
    mid: RGB.WIND_JADE,
    body: RGB.WIND_EMERALD,
    deep: RGB.WIND_TEAL,
    rim: RGB.WIND_TEAL,
  };

  /* -------------------- 9 招完整元数据清单 -------------------- */
  const SKILLS = [
    {
      id: 'ice_crystal',
      name: '冰晶术',
      en: 'Ice Crystal',
      element: 'ice',
      targetType: 'single',
      duration: 1500,
      peakTime: 800,
      desc: '杖尖绽放亮青雪花阵 → 饱满多面体电光冰晶矛 → 耀眼多面冰晶花簇与旋转大块透亮水晶片爆裂',
    },
    {
      id: 'tri_prism_ice',
      name: '三棱冰晶',
      en: 'Tri-Prism Ice',
      element: 'ice',
      targetType: 'single',
      duration: 1650,
      peakTime: 1010,
      desc: '三道高低弧线连射亮蓝棱镜晶梭，连环踩点晶爆，第三发触发放大星芒冰环',
    },
    {
      id: 'starfrost_scatter',
      name: '星霜散华',
      en: 'Starfrost Scatter',
      element: 'starfrost',
      targetType: 'single',
      duration: 1900,
      peakTime: 1140,
      desc: '双层旋转冰蓝×香槟金六芒星霜法阵 → 天降9道星霜冰棱光雨 → 巨型菱形冰花绽放与十字星屑',
    },
    {
      id: 'raging_surge',
      name: '激流涌',
      en: 'Raging Surge',
      element: 'water',
      targetType: 'single',
      duration: 1650,
      peakTime: 900,
      desc: '明亮碧蓝水漩涡涌起 → 宽幅澄澈激流波带横贯战场 → 高大明亮弧形白沫水浪壁与漫天晶莹水珠',
    },
    {
      id: 'water_cleave',
      name: '断水刃',
      en: 'Water Cleave',
      element: 'water',
      targetType: 'single',
      duration: 1400,
      peakTime: 650,
      desc: '极速宽幅冰青×纯白双交叉月牙水刃横贯目标，拉出流光尾带与高饱和水青晶滴飞溅',
    },
    {
      id: 'frost_thorn_field',
      name: '霜域棘阵',
      en: 'Frost Thorn Field',
      element: 'ice',
      targetType: 'aoe',
      duration: 1850,
      peakTime: 1080,
      desc: '宽幅冰霜地脉波横推 → 依次在全部3名敌方脚下冲天刺出饱满多面体蓝白冰棘丛与雪花星尘',
    },
    {
      id: 'steel_ice_curtain',
      name: '钢冰护幕',
      en: 'Steel-Ice Curtain',
      element: 'shield',
      targetType: 'self',
      duration: 1800,
      peakTime: 930,
      desc: '主角周身拔地而起冰蓝×香槟金六角棱镜立体护穹，顶部亮白高光扫过与双倾斜发光晶环流转',
    },
    {
      id: 'sword_send_slash',
      name: '送刀斩',
      en: 'Sword-Send Slash',
      element: 'blade',
      targetType: 'single',
      duration: 1500,
      peakTime: 760,
      desc: '凌厉冲刺轨迹 → 宽幅电光冰青大月牙斩光 + 反手亮金冰蓝交叉闪斩 + 爆炸级高亮星芒火花',
    },
    {
      id: 'wind_afterimage',
      name: '风行残像',
      en: 'Wind Afterimage',
      element: 'wind',
      targetType: 'self',
      duration: 1700,
      peakTime: 890,
      desc: '双道丝滑缠绕的翡翠青×亮白疾风气旋 + 3枚清透发光青白剑舞残影与飘散风星粒子',
    },
  ];

  const SKILL_MAP = Object.create(null);
  for (let i = 0; i < SKILLS.length; i++) {
    SKILL_MAP[SKILLS[i].id] = SKILLS[i];
  }

  /* -------------------- 数学与缓动工具 -------------------- */
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function segT(t, t0, t1) {
    return clamp((t - t0) / (t1 - t0 || 1e-6), 0, 1);
  }

  const EASE = {
    outQuad: t => 1 - (1 - t) * (1 - t),
    inQuad: t => t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: t => {
      const c1 = 1.65;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t)),
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function quadBezier(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }

  function quadBezierTan(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
      y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
    };
  }

  function rgbaStr(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }

  /* ============================================================================
     320×180 零锯齿像素晶面光栅引擎 (PixelBuffer)
     ============================================================================ */
  function createPixelBuffer() {
    const canvas = document.createElement('canvas');
    canvas.width = PW;
    canvas.height = PH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.createImageData(PW, PH);
    const data = imgData.data;
    const u32 = new Uint32Array(data.buffer);
    const xsBuf = new Float32Array(128);

    function clear() {
      u32.fill(0);
    }

    function commit() {
      ctx.putImageData(imgData, 0, 0);
    }

    function plotRaw(px, py, rgb, a) {
      if (a <= 0.004 || px < 0 || px >= PW || py < 0 || py >= PH) return;
      const idx = (py * PW + px) << 2;
      const alpha = a > 1 ? 1 : a;
      const da = data[idx + 3] * (1 / 255);
      if (alpha >= 0.992 || da <= 0.004) {
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = (alpha * 255 + 0.5) | 0;
        return;
      }
      const oneMinusA = 1 - alpha;
      const outA = alpha + da * oneMinusA;
      const inv = 1 / outA;
      const dstW = da * oneMinusA;
      data[idx] = ((rgb[0] * alpha + data[idx] * dstW) * inv + 0.5) | 0;
      data[idx + 1] = ((rgb[1] * alpha + data[idx + 1] * dstW) * inv + 0.5) | 0;
      data[idx + 2] = ((rgb[2] * alpha + data[idx + 2] * dstW) * inv + 0.5) | 0;
      data[idx + 3] = (outA * 255 + 0.5) | 0;
    }

    function plotBrightRaw(px, py, rgb, a) {
      if (a <= 0.004 || px < 0 || px >= PW || py < 0 || py >= PH) return;
      const idx = (py * PW + px) << 2;
      const alpha = a > 1 ? 1 : a;
      const da = data[idx + 3] * (1 / 255);
      if (da <= 0.004) {
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = (alpha * 255 + 0.5) | 0;
        return;
      }
      const nr = Math.min(255, data[idx] + rgb[0] * alpha * 0.78);
      const ng = Math.min(255, data[idx + 1] + rgb[1] * alpha * 0.78);
      const nb = Math.min(255, data[idx + 2] + rgb[2] * alpha * 0.78);
      const outA = Math.min(1, da + alpha * (1 - da * 0.65));
      data[idx] = (nr + 0.5) | 0;
      data[idx + 1] = (ng + 0.5) | 0;
      data[idx + 2] = (nb + 0.5) | 0;
      data[idx + 3] = (outA * 255 + 0.5) | 0;
    }

    function hspan(x0, x1, py, rgb, a, bright) {
      if (py < 0 || py >= PH || a <= 0.004) return;
      const sx = x0 < 0 ? 0 : x0;
      const ex = x1 >= PW ? PW - 1 : x1;
      if (sx > ex) return;
      if (bright) {
        for (let x = sx; x <= ex; x++) plotBrightRaw(x, py, rgb, a);
      } else if (a >= 0.992) {
        const r = rgb[0], g = rgb[1], b = rgb[2];
        let idx = (py * PW + sx) << 2;
        for (let x = sx; x <= ex; x++) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
          idx += 4;
        }
      } else {
        for (let x = sx; x <= ex; x++) plotRaw(x, py, rgb, a);
      }
    }

    function poly(pts, rgb, a, bright) {
      const n = pts.length;
      if (n < 3 || a <= 0.004) return;
      let minY = PH, maxY = -1;
      for (let i = 0; i < n; i++) {
        const py = pts[i][1] * 0.5;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      const yStart = Math.max(0, Math.floor(minY));
      const yEnd = Math.min(PH - 1, Math.ceil(maxY));
      if (yStart > yEnd) return;

      for (let y = yStart; y <= yEnd; y++) {
        const sy = y + 0.5;
        let count = 0;
        let j = n - 1;
        for (let i = 0; i < n; i++) {
          const y1 = pts[i][1] * 0.5;
          const y2 = pts[j][1] * 0.5;
          if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) {
            const x1 = pts[i][0] * 0.5;
            const x2 = pts[j][0] * 0.5;
            if (count < xsBuf.length) {
              xsBuf[count++] = x1 + ((sy - y1) * (x2 - x1)) / (y2 - y1);
            }
          }
          j = i;
        }
        for (let i = 1; i < count; i++) {
          const key = xsBuf[i];
          let k = i - 1;
          while (k >= 0 && xsBuf[k] > key) {
            xsBuf[k + 1] = xsBuf[k];
            k--;
          }
          xsBuf[k + 1] = key;
        }
        for (let i = 0; i + 1 < count; i += 2) {
          const x0 = Math.floor(xsBuf[i]);
          const x1 = Math.floor(xsBuf[i + 1]);
          if (x1 >= x0) hspan(x0, x1, y, rgb, a, bright);
        }
      }
    }

    function line(x0, y0, x1, y1, rgb, a, thickness, bright) {
      if (a <= 0.004) return;
      const sx0 = Math.round(x0 * 0.5);
      const sy0 = Math.round(y0 * 0.5);
      const sx1 = Math.round(x1 * 0.5);
      const sy1 = Math.round(y1 * 0.5);
      const rad = Math.max(0, Math.floor(((thickness || 2) * 0.5 - 0.5) * 0.5));
      let x = sx0, y = sy0;
      const dx = Math.abs(sx1 - sx0);
      const dy = Math.abs(sy1 - sy0);
      const stepX = sx0 < sx1 ? 1 : -1;
      const stepY = sy0 < sy1 ? 1 : -1;
      let err = dx - dy;
      const plotFn = bright ? plotBrightRaw : plotRaw;
      const maxSteps = dx + dy + 2;
      for (let s = 0; s < maxSteps; s++) {
        if (rad === 0) {
          plotFn(x, y, rgb, a);
        } else {
          for (let oy = -rad; oy <= rad; oy++) {
            for (let ox = -rad; ox <= rad; ox++) {
              if (ox * ox + oy * oy <= rad * rad + 1) {
                plotFn(x + ox, y + oy, rgb, a);
              }
            }
          }
        }
        if (x === sx1 && y === sy1) break;
        const e2 = err << 1;
        if (e2 > -dy) { err -= dy; x += stepX; }
        if (e2 < dx) { err += dx; y += stepY; }
      }
    }

    function polyOutline(pts, rgb, a, thickness, bright) {
      const n = pts.length;
      if (n < 2 || a <= 0.004) return;
      for (let i = 0; i < n; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % n];
        line(p0[0], p0[1], p1[0], p1[1], rgb, a, thickness || 2, bright);
      }
    }

    function ellipse(cx, cy, rx, ry, rgb, a, bright) {
      if (a <= 0.004 || rx <= 0.5 || ry <= 0.5) return;
      const pcx = cx * 0.5;
      const pcy = cy * 0.5;
      const prx = rx * 0.5;
      const pry = ry * 0.5;
      const y0 = Math.max(0, Math.floor(pcy - pry));
      const y1 = Math.min(PH - 1, Math.ceil(pcy + pry));
      for (let y = y0; y <= y1; y++) {
        const dy = (y + 0.5 - pcy) / pry;
        const sq = 1 - dy * dy;
        if (sq < 0) continue;
        const span = Math.sqrt(sq) * prx;
        hspan(Math.floor(pcx - span), Math.floor(pcx + span), y, rgb, a, bright);
      }
    }

    function ring(cx, cy, rx, ry, thickness, rgb, a, rot, startAng, endAng, bright) {
      if (a <= 0.004 || rx <= 1 || ry <= 1) return;
      const sA = startAng !== undefined ? startAng : 0;
      const eA = endAng !== undefined ? endAng : Math.PI * 2;
      const full = Math.abs(eA - sA) >= Math.PI * 1.999;
      const steps = clamp(Math.ceil(Math.max(rx, ry) * 0.55), 18, 64);
      const cosR = rot ? Math.cos(rot) : 1;
      const sinR = rot ? Math.sin(rot) : 0;
      const halfT = (thickness || 4) * 0.5;
      const outerPts = [];
      const innerPts = [];
      for (let i = 0; i <= steps; i++) {
        const ang = lerp(sA, eA, i / steps);
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const ox = ca * (rx + halfT);
        const oy = sa * (ry + halfT);
        const ix = ca * Math.max(0.5, rx - halfT);
        const iy = sa * Math.max(0.5, ry - halfT);
        outerPts.push([cx + ox * cosR - oy * sinR, cy + ox * sinR + oy * cosR]);
        innerPts.push([cx + ix * cosR - iy * sinR, cy + ix * sinR + iy * cosR]);
      }
      if (full) {
        for (let i = 0; i < steps; i++) {
          poly([outerPts[i], outerPts[i + 1], innerPts[i + 1], innerPts[i]], rgb, a, bright);
        }
      } else {
        poly(outerPts.concat(innerPts.reverse()), rgb, a, bright);
      }
    }

    // 4 切面立体宝石水晶（长矛 / 冰花瓣 / 冰棘 / 凌空棱镜）
    function crystal(baseX, baseY, angle, len, wid, pal, a, opts) {
      if (a <= 0.004 || len < 4 || wid < 2) return;
      const p = pal || CRYSTAL_ICE_PAL;
      const o = opts || {};
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const nx = -sa;
      const ny = ca;
      const shoulderRatio = o.shoulderRatio !== undefined ? o.shoulderRatio : 0.34;
      const backTail = o.backTail !== undefined ? o.backTail : 0.0;
      const hw = wid * 0.5;
      const shDist = len * shoulderRatio;
      const tipX = baseX + ca * len;
      const tipY = baseY + sa * len;
      const tailX = baseX - ca * (len * backTail);
      const tailY = baseY - sa * (len * backTail);
      const shMidX = baseX + ca * shDist;
      const shMidY = baseY + sa * shDist;
      const upperShX = shMidX + nx * hw;
      const upperShY = shMidY + ny * hw;
      const lowerShX = shMidX - nx * hw;
      const lowerShY = shMidY - ny * hw;
      const baseUpX = baseX + nx * hw * (backTail > 0 ? 0.52 : 0.68);
      const baseUpY = baseY + ny * hw * (backTail > 0 ? 0.52 : 0.68);
      const baseDnX = baseX - nx * hw * (backTail > 0 ? 0.52 : 0.68);
      const baseDnY = baseY - ny * hw * (backTail > 0 ? 0.52 : 0.68);
      const ridgeX = baseX + ca * (len * 0.52) + nx * (hw * 0.14);
      const ridgeY = baseY + sa * (len * 0.52) + ny * (hw * 0.14);

      poly([[tipX, tipY], [upperShX, upperShY], [ridgeX, ridgeY]], p.bright, a);
      poly(
        backTail > 0
          ? [[upperShX, upperShY], [tailX, tailY], [ridgeX, ridgeY]]
          : [[upperShX, upperShY], [baseUpX, baseUpY], [baseX, baseY], [ridgeX, ridgeY]],
        p.white,
        a * 0.96
      );
      poly([[tipX, tipY], [ridgeX, ridgeY], [lowerShX, lowerShY]], p.mid, a);
      poly(
        backTail > 0
          ? [[ridgeX, ridgeY], [tailX, tailY], [lowerShX, lowerShY]]
          : [[ridgeX, ridgeY], [baseX, baseY], [baseDnX, baseDnY], [lowerShX, lowerShY]],
        p.deep,
        a * 0.96
      );

      const glint1X = lerp(upperShX, tipX, 0.34);
      const glint1Y = lerp(upperShY, tipY, 0.34);
      const glint2X = lerp(ridgeX, tipX, 0.46);
      const glint2Y = lerp(ridgeY, tipY, 0.46);
      poly([[upperShX, upperShY], [glint1X, glint1Y], [glint2X, glint2Y], [ridgeX, ridgeY]], p.white, a * 0.72, true);

      // 轻柔宝石蓝明暗边缘（绝无死黑脏边）
      const rimAlpha = a * (o.rimAlpha !== undefined ? o.rimAlpha : 0.76);
      line(tipX, tipY, lowerShX, lowerShY, p.rim, rimAlpha, 2);
      if (backTail > 0) {
        line(lowerShX, lowerShY, tailX, tailY, p.rim, rimAlpha, 2);
        line(upperShX, upperShY, tailX, tailY, p.body, rimAlpha * 0.72, 2);
      } else {
        line(lowerShX, lowerShY, baseDnX, baseDnY, p.rim, rimAlpha, 2);
        line(upperShX, upperShY, baseUpX, baseUpY, p.body, rimAlpha * 0.68, 2);
      }
      line(tipX, tipY, upperShX, upperShY, p.body, rimAlpha * 0.76, 2);

      // 纯白脊线高光
      line(
        lerp(baseX, tipX, 0.12),
        lerp(baseY, tipY, 0.12),
        lerp(baseX, tipX, 0.92),
        lerp(baseY, tipY, 0.92),
        RGB.PURE_WHITE,
        a * 0.94,
        2,
        true
      );
    }

    // 旋转飞溅的多面体大块水晶碎块（8–22px 透亮切面）
    function diamondShard(cx, cy, rot, size, pal, a) {
      if (a <= 0.004 || size < 3) return;
      const p = pal || CRYSTAL_ICE_PAL;
      const ca = Math.cos(rot);
      const sa = Math.sin(rot);
      const L = size;
      const W = size * 0.58;
      const tip = [cx + ca * L, cy + sa * L];
      const tail = [cx - ca * L * 0.85, cy - sa * L * 0.85];
      const left = [cx - sa * W, cy + ca * W];
      const right = [cx + sa * W, cy - ca * W];
      const center = [cx + ca * L * 0.12 - sa * W * 0.12, cy + sa * L * 0.12 + ca * W * 0.12];

      poly([tip, left, center], p.white, a);
      poly([left, tail, center], p.bright, a);
      poly([tip, center, right], p.mid, a);
      poly([center, tail, right], p.deep, a);
      line(tip[0], tip[1], right[0], right[1], p.rim, a * 0.74, 2);
      line(right[0], right[1], tail[0], tail[1], p.rim, a * 0.74, 2);
      line(tip[0], tip[1], left[0], left[1], p.white, a * 0.92, 2, true);
    }

    // 丝滑多色带像素光弧 / 斩击月牙 / 水浪带 / 疾风丝带
    function ribbon(spinePts, widths, outerCol, midCol, coreCol, a, opts) {
      const n = spinePts.length;
      if (n < 2 || a <= 0.004) return;
      const o = opts || {};
      const rimCol = o.rimCol || null;
      const coreShift = o.coreShift || 0;

      function buildBand(scaleW, shiftFrac) {
        const leftPts = [];
        const rightPts = [];
        for (let i = 0; i < n; i++) {
          const prev = spinePts[Math.max(0, i - 1)];
          const next = spinePts[Math.min(n - 1, i + 1)];
          let tx = next[0] - prev[0];
          let ty = next[1] - prev[1];
          const d = Math.hypot(tx, ty) || 1;
          tx /= d;
          ty /= d;
          const nx = -ty;
          const ny = tx;
          const w = widths[i] * 0.5 * scaleW;
          const sh = widths[i] * 0.5 * shiftFrac;
          leftPts.push([spinePts[i][0] + nx * (w + sh), spinePts[i][1] + ny * (w + sh)]);
          rightPts.push([spinePts[i][0] - nx * (w - sh), spinePts[i][1] - ny * (w - sh)]);
        }
        return { leftPts, rightPts, merged: leftPts.concat(rightPts.slice().reverse()) };
      }

      const outer = buildBand(1.0, 0);
      poly(outer.merged, outerCol, a * 0.94);
      if (rimCol) {
        for (let i = 0; i < n - 1; i++) {
          line(outer.rightPts[i][0], outer.rightPts[i][1], outer.rightPts[i + 1][0], outer.rightPts[i + 1][1], rimCol, a * 0.74, 2);
        }
      }
      const mid = buildBand(0.68, coreShift * 0.5);
      poly(mid.merged, midCol, a * 0.96);
      const core = buildBand(0.32, coreShift);
      poly(core.merged, coreCol, a, true);
    }

    function star4(cx, cy, rOuter, rInner, coreCol, haloCol, a, rot) {
      if (a <= 0.004 || rOuter < 2) return;
      const r0 = rot || 0;
      const ptsHalo = [];
      const ptsCore = [];
      for (let i = 0; i < 8; i++) {
        const ang = r0 + (i * Math.PI) / 4;
        const isTip = i % 2 === 0;
        const rH = isTip ? rOuter : rInner;
        const rC = isTip ? rOuter * 0.68 : rInner * 0.56;
        ptsHalo.push([cx + Math.cos(ang) * rH, cy + Math.sin(ang) * rH]);
        ptsCore.push([cx + Math.cos(ang) * rC, cy + Math.sin(ang) * rC]);
      }
      poly(ptsHalo, haloCol, a * 0.92);
      poly(ptsCore, coreCol, a, true);
    }

    function star8(cx, cy, rMain, rDiag, coreCol, haloCol, a, rot) {
      star4(cx, cy, rDiag, rDiag * 0.22, coreCol, haloCol, a * 0.85, (rot || 0) + Math.PI / 4);
      star4(cx, cy, rMain, rMain * 0.2, coreCol, haloCol, a, rot || 0);
    }

    function snowflake(cx, cy, radius, rot, outerCol, coreCol, a) {
      if (a <= 0.004 || radius < 4) return;
      for (let i = 0; i < 6; i++) {
        const ang = rot + (i * Math.PI) / 3;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const x1 = cx + ca * radius;
        const y1 = cy + sa * radius;
        line(cx, cy, x1, y1, outerCol, a * 0.94, 3);
        line(cx, cy, x1, y1, coreCol, a, 2, true);
        const b1 = radius * 0.58;
        const bLen = radius * 0.34;
        const bx = cx + ca * b1;
        const by = cy + sa * b1;
        for (let s = -1; s <= 1; s += 2) {
          const bang = ang + s * 0.68;
          const ex = bx + Math.cos(bang) * bLen;
          const ey = by + Math.sin(bang) * bLen;
          line(bx, by, ex, ey, outerCol, a * 0.9, 2);
          line(bx, by, ex, ey, coreCol, a * 0.96, 2, true);
        }
        const tx = cx + ca * (radius * 0.84);
        const ty = cy + sa * (radius * 0.84);
        ellipse(tx, ty, Math.max(2.5, radius * 0.1), Math.max(2.5, radius * 0.1), coreCol, a, true);
      }
      const hex = [];
      for (let i = 0; i < 6; i++) {
        const ang = rot + (i * Math.PI) / 3;
        hex.push([cx + Math.cos(ang) * radius * 0.24, cy + Math.sin(ang) * radius * 0.24]);
      }
      poly(hex, outerCol, a * 0.92);
      polyOutline(hex, coreCol, a, 2, true);
    }

    // 高反差三层亮电冰雷电弧（雪瓷亮底清晰耀眼！）
    function lightning(x0, y0, x1, y1, jagged, seed, rimCol, midCol, coreCol, a, segments) {
      if (a <= 0.004) return;
      const rng = mulberry32(seed);
      const segs = segments || 7;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const pts = [[x0, y0]];
      for (let i = 1; i < segs; i++) {
        const u = i / segs;
        const env = Math.sin(u * Math.PI);
        const off = (rng() * 2 - 1) * jagged * env;
        pts.push([lerp(x0, x1, u) + nx * off, lerp(y0, y1, u) + ny * off]);
      }
      pts.push([x1, y1]);
      for (let i = 0; i < pts.length - 1; i++) {
        line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rimCol, a * 0.92, 6);
        line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], midCol, a * 0.96, 4);
        line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], coreCol, a, 2, true);
        if (i > 0 && i < pts.length - 2 && rng() < 0.55) {
          const bAng = Math.atan2(dy, dx) + (rng() < 0.5 ? 1 : -1) * (0.42 + rng() * 0.58);
          const bLen = dist * (0.20 + rng() * 0.22);
          const bx = pts[i][0] + Math.cos(bAng) * bLen;
          const by = pts[i][1] + Math.sin(bAng) * bLen;
          line(pts[i][0], pts[i][1], bx, by, rimCol, a * 0.86, 4);
          line(pts[i][0], pts[i][1], bx, by, midCol, a * 0.94, 2);
          line(pts[i][0], pts[i][1], bx, by, coreCol, a, 2, true);
        }
      }
    }

    // 晶莹高饱和水珠（带宝石蓝边缘与纯白高光点）
    function waterDrop(cx, cy, vx, vy, size, a) {
      if (a <= 0.004 || size < 2.2) return;
      const ang = Math.atan2(vy, vx);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const nx = -sa;
      const ny = ca;
      const tail = [cx - ca * size * 1.55, cy - sa * size * 1.55];
      const head = [cx + ca * size * 0.78, cy + sa * size * 0.78];
      const s1 = [cx + nx * size * 0.62, cy + ny * size * 0.62];
      const s2 = [cx - nx * size * 0.62, cy - ny * size * 0.62];
      poly([head, s1, tail, s2], RGB.WATER_COBALT, a * 0.92);
      ellipse(cx + ca * size * 0.14, cy + sa * size * 0.14, size * 0.58, size * 0.58, RGB.WATER_AQUA, a * 0.98);
      ellipse(cx + ca * size * 0.26 - nx * size * 0.16, cy + sa * size * 0.26 - ny * size * 0.16, Math.max(2, size * 0.26), Math.max(2, size * 0.26), RGB.PURE_WHITE, a, true);
    }

    // 清透发光剑舞残影（支持 theme: 'wind' 翡翠青白 / 'ice' 电光冰蓝）
    function swordDancerSilhouette(cx, cy, scale, poseIdx, a, theme) {
      if (a <= 0.004) return;
      const s = scale || 1;
      const isIce = theme === 'ice';
      const cRim = isIce ? RGB.ICE_JEWEL : RGB.WIND_TEAL;
      const cMid = isIce ? RGB.ICE_ELEC : RGB.WIND_JADE;
      const cLight = isIce ? RGB.ICE_CYAN : RGB.WIND_MINT;
      const cCore = isIce ? RGB.ICE_WHITE : RGB.WIND_WHITE;
      const bladePal = isIce ? CRYSTAL_ICE_PAL : CRYSTAL_WIND_PAL;

      const flip = poseIdx === 1 ? -1 : 1;
      const lean = poseIdx === 0 ? 0.22 : poseIdx === 1 ? -0.14 : 0.28;

      function pt(dx, dy) {
        return [cx + (dx * flip + dy * lean) * s, cy + dy * s];
      }

      // 飘逸流光长发（后扬）
      const hair = [
        pt(-2, -40), pt(-18, -36), pt(-35, -22), pt(-40, -2),
        pt(-24, -8), pt(-14, -18), pt(-4, -26),
      ];
      poly(hair, cMid, a * 0.86);
      poly([pt(-2, -38), pt(-15, -32), pt(-29, -18), pt(-12, -22)], cLight, a * 0.94);
      polyOutline(hair, cRim, a * 0.78, 2);

      // 跃动裙摆
      const skirt = [
        pt(-7, -4), pt(9, -4), pt(24, 26), pt(8, 31), pt(-7, 29), pt(-23, 24),
      ];
      poly(skirt, cMid, a * 0.82);
      poly([pt(-4, -2), pt(6, -2), pt(16, 22), pt(-13, 20)], cCore, a * 0.9);
      polyOutline(skirt, cRim, a * 0.85, 2);

      // 修长身躯与清透头部
      const torso = [pt(-7, -25), pt(8, -25), pt(9, -2), pt(-7, -2)];
      poly(torso, cCore, a * 0.94);
      polyOutline(torso, cRim, a * 0.8, 2);
      const headC = pt(0, -34);
      ellipse(headC[0], headC[1], 10 * s, 10.5 * s, cRim, a * 0.78);
      ellipse(headC[0], headC[1], 8 * s, 8.5 * s, cCore, a * 0.96);

      // 灵动箭步双腿
      poly([pt(-6, 22), pt(1, 22), pt(-9, 44), pt(-15, 42)], cMid, a * 0.88);
      poly([pt(4, 22), pt(11, 22), pt(21, 42), pt(14, 44)], cLight, a * 0.92);

      // 挥舞的高亮长剑
      const hand = poseIdx === 0 ? pt(16, -15) : poseIdx === 1 ? pt(18, -25) : pt(15, -27);
      const bladeTip = poseIdx === 0 ? pt(60, -30) : poseIdx === 1 ? pt(54, -60) : pt(64, -4);
      const bdx = bladeTip[0] - hand[0];
      const bdy = bladeTip[1] - hand[1];
      const bAng = Math.atan2(bdy, bdx);
      const bLen = Math.hypot(bdx, bdy);
      crystal(hand[0], hand[1], bAng, bLen, 10.5 * s, bladePal, a, { shoulderRatio: 0.16, rimAlpha: 0.72 });

      // 身体前缘亮白逆光棱
      line(pt(6, -34)[0], pt(6, -34)[1], pt(16, 24)[0], pt(16, 24)[1], RGB.PURE_WHITE, a * 0.95, 2, true);
      star4(bladeTip[0], bladeTip[1], 13 * s, 3.5 * s, RGB.PURE_WHITE, cMid, a, bAng);
    }

    return {
      canvas,
      clear,
      commit,
      plotRaw,
      plotBrightRaw,
      poly,
      polyOutline,
      line,
      ellipse,
      ring,
      crystal,
      diamondShard,
      ribbon,
      star4,
      star8,
      snowflake,
      lightning,
      waterDrop,
      swordDancerSilhouette,
    };
  }

  /* ============================================================================
     640×360 HD-2D 柔和晶体辉光与星芒图层绘制器
     ============================================================================ */
  function drawLuminousHalo(ctx, x, y, r, innerRgb, midRgb, outerRgb, a) {
    if (a <= 0.004 || r <= 1) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgbaStr(innerRgb, a));
    g.addColorStop(0.36, rgbaStr(midRgb, a * 0.72));
    g.addColorStop(0.72, rgbaStr(outerRgb, a * 0.28));
    g.addColorStop(1, rgbaStr(outerRgb, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGroundGlow(ctx, x, y, rx, ry, innerRgb, outerRgb, a) {
    if (a <= 0.004 || rx <= 1 || ry <= 1) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgbaStr(innerRgb, a));
    g.addColorStop(0.55, rgbaStr(outerRgb, a * 0.45));
    g.addColorStop(1, rgbaStr(outerRgb, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrossStarFlare(ctx, x, y, size, rot, haloRgb, coreRgb, a, eightPoint) {
    if (a <= 0.004 || size < 3) return;
    drawLuminousHalo(ctx, x, y, size * 0.72, coreRgb || RGB.PURE_WHITE, haloRgb, haloRgb, a * 0.56);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);

    function spikePair(len, wid, fillStyle) {
      ctx.fillStyle = fillStyle;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.quadraticCurveTo(wid * 0.42, -wid * 0.42, wid, 0);
        ctx.quadraticCurveTo(wid * 0.42, wid * 0.42, 0, len);
        ctx.quadraticCurveTo(-wid * 0.42, wid * 0.42, -wid, 0);
        ctx.quadraticCurveTo(-wid * 0.42, -wid * 0.42, 0, -len);
        ctx.closePath();
        ctx.fill();
        ctx.rotate(Math.PI / 2);
      }
    }

    if (eightPoint) {
      ctx.save();
      ctx.rotate(Math.PI / 4);
      spikePair(size * 0.68, size * 0.12, rgbaStr(haloRgb, a * 0.74));
      spikePair(size * 0.46, size * 0.07, rgbaStr(coreRgb || RGB.PURE_WHITE, a * 0.95));
      ctx.restore();
    }

    spikePair(size, size * 0.16, rgbaStr(haloRgb, a * 0.88));
    spikePair(size * 0.74, size * 0.095, rgbaStr(coreRgb || RGB.PURE_WHITE, a));

    ctx.restore();
  }

  function drawGlowShockRing(ctx, x, y, rx, ry, lineW, outerRgb, innerRgb, a, rot, startAng, endAng) {
    if (a <= 0.004 || rx <= 1 || ry <= 1) return;
    const sA = startAng !== undefined ? startAng : 0;
    const eA = endAng !== undefined ? endAng : Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, sA, eA);
    ctx.strokeStyle = rgbaStr(outerRgb, a * 0.42);
    ctx.lineWidth = lineW * 2.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, sA, eA);
    ctx.strokeStyle = rgbaStr(outerRgb, a * 0.9);
    ctx.lineWidth = lineW;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.5, rx - lineW * 0.15), Math.max(0.5, ry - lineW * 0.15), 0, sA, eA);
    ctx.strokeStyle = rgbaStr(innerRgb || RGB.PURE_WHITE, a * 0.96);
    ctx.lineWidth = Math.max(1.2, lineW * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  function drawSoftTrail(ctx, pts, width, rgb, a) {
    if (pts.length < 2 || a <= 0.004) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const u = i / (pts.length - 1);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = rgbaStr(rgb, a * u * 0.55);
      ctx.lineWidth = width * (0.25 + 0.75 * u);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLightPillar(ctx, cx, bottomY, topY, halfW, outerRgb, coreRgb, a) {
    if (a <= 0.004 || halfW <= 1) return;
    const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    g.addColorStop(0, rgbaStr(outerRgb, 0));
    g.addColorStop(0.24, rgbaStr(outerRgb, a * 0.42));
    g.addColorStop(0.5, rgbaStr(coreRgb || RGB.PURE_WHITE, a * 0.78));
    g.addColorStop(0.76, rgbaStr(outerRgb, a * 0.42));
    g.addColorStop(1, rgbaStr(outerRgb, 0));
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(cx - halfW, topY, halfW * 2, bottomY - topY);
    ctx.fillStyle = rgbaStr(coreRgb || RGB.PURE_WHITE, a * 0.5);
    ctx.fillRect(cx - halfW * 0.16, topY + (bottomY - topY) * 0.08, halfW * 0.32, (bottomY - topY) * 0.86);
    ctx.restore();
  }

  /* ============================================================================
     魔力增幅 0/1/2/3 阶统一香槟金环 & 鲜亮冰雷电弧叠层
     ============================================================================ */
  function renderAmpCastLayer(backCtx, px, frontCtx, cx, cy, feetY, t, ampTier, seed) {
    if (ampTier <= 0) return;
    const appear = smoothstep(0.0, 0.08, t) * (1 - smoothstep(0.45, 0.78, t));
    if (appear <= 0.004) return;

    drawGroundGlow(backCtx, cx, feetY, 74 + ampTier * 18, 25 + ampTier * 6, RGB.GOLD_BRIGHT, RGB.GOLD_AMBER, appear * 0.48);
    drawLuminousHalo(backCtx, cx, cy, 52 + ampTier * 16, RGB.GOLD_CORE, RGB.GOLD_BRIGHT, RGB.GOLD_AMBER, appear * 0.38);

    for (let k = 0; k < ampTier; k++) {
      const rx = (54 + k * 20) * (0.78 + 0.26 * EASE.outCubic(clamp(t * 3.5, 0, 1)));
      const ry = rx * 0.36;
      const rot = (k % 2 === 0 ? 1 : -1) * t * 3.2 + k * 0.4;
      const tilt = (k - (ampTier - 1) * 0.5) * 0.16;
      drawGlowShockRing(frontCtx, cx, feetY - k * 8, rx, ry, 2.8, RGB.GOLD_AMBER, RGB.GOLD_PALE, appear * 0.92, tilt);
      px.ring(cx, feetY - k * 8, rx, ry, 3.2, RGB.GOLD_BRIGHT, appear * 0.9, tilt);
      for (let m = 0; m < 4; m++) {
        const a = rot + (m * Math.PI) / 2;
        px.star4(cx + Math.cos(a) * rx, feetY - k * 8 + Math.sin(a) * ry, 8 + ampTier, 2.5, RGB.PURE_WHITE, RGB.GOLD_AMBER, appear * 0.96, a);
      }
    }

    if (ampTier >= 2) {
      const arcCount = ampTier === 3 ? 6 : 3;
      const stepFrame = Math.floor(t * 24);
      for (let i = 0; i < arcCount; i++) {
        const a1 = (i / arcCount) * Math.PI * 2 + t * 4.5;
        const a2 = a1 + 1.45;
        const r1 = 44 + ampTier * 10;
        const x1 = cx + Math.cos(a1) * r1;
        const y1 = cy + Math.sin(a1) * r1 * 0.76;
        const x2 = cx + Math.cos(a2) * (r1 * 1.15);
        const y2 = cy + Math.sin(a2) * r1 * 0.82;
        const isGold = ampTier === 3 && i % 2 === 1;
        px.lightning(
          x1, y1, x2, y2,
          14 + ampTier * 3,
          seed + stepFrame * 31 + i * 97,
          isGold ? RGB.GOLD_RIM : RGB.ICE_COBALT,
          isGold ? RGB.GOLD_BRIGHT : RGB.ICE_ELEC,
          RGB.PURE_WHITE,
          appear * 0.96,
          6
        );
      }
    }
  }

  function renderAmpImpactLayer(backCtx, px, frontCtx, tx, ty, tLocal, ampTier, seed) {
    if (ampTier <= 0 || tLocal <= 0 || tLocal >= 1) return;
    const pop = smoothstep(0.0, 0.12, tLocal) * (1 - smoothstep(0.55, 1.0, tLocal));
    if (pop <= 0.004) return;
    const expand = EASE.outCubic(tLocal);

    drawLuminousHalo(backCtx, tx, ty, (86 + ampTier * 24) * (0.7 + 0.4 * expand), RGB.GOLD_CORE, RGB.GOLD_BRIGHT, RGB.GOLD_AMBER, pop * 0.44);

    // 1/2/3 阶同心香槟金星环
    for (let k = 0; k < ampTier; k++) {
      const r = (54 + k * 28) * (0.55 + 0.72 * expand);
      const tilt = (k - (ampTier - 1) * 0.5) * 0.34;
      drawGlowShockRing(frontCtx, tx, ty, r, r * (0.56 + k * 0.12), 3.2, RGB.GOLD_AMBER, RGB.GOLD_CORE, pop * 0.92, tilt);
      px.ring(tx, ty, r, r * (0.56 + k * 0.12), 3.2, RGB.GOLD_BRIGHT, pop * 0.88, tilt);
    }

    // 2/3 阶高反差裂空冰雷电弧（深海蓝/暖金镶边 + 亮青/金电核 + 纯白芯，雪底超醒目！）
    if (ampTier >= 2) {
      const bolts = ampTier === 3 ? 7 : 4;
      const stepFrame = Math.floor(tLocal * 20);
      for (let i = 0; i < bolts; i++) {
        const ang = (i / bolts) * Math.PI * 2 + 0.28 + stepFrame * 0.12;
        const rIn = 18;
        const rOut = (86 + ampTier * 22) * (0.65 + 0.45 * expand);
        const sx = tx + Math.cos(ang) * rIn;
        const sy = ty + Math.sin(ang) * rIn;
        const ex = tx + Math.cos(ang) * rOut;
        const ey = ty + Math.sin(ang) * rOut * 0.86;
        const isGold = ampTier === 3 && i % 2 === 1;
        px.lightning(
          sx, sy, ex, ey,
          16 + ampTier * 3,
          seed + 401 + stepFrame * 53 + i * 71,
          isGold ? RGB.GOLD_RIM : RGB.ICE_SAPPHIRE,
          isGold ? RGB.GOLD_BRIGHT : RGB.ICE_CYAN,
          RGB.PURE_WHITE,
          pop,
          7
        );
      }
    }

    if (ampTier >= 3) {
      drawCrossStarFlare(frontCtx, tx, ty, 88 * (0.65 + 0.45 * Math.sin(tLocal * Math.PI)), tLocal * 1.4, RGB.GOLD_AMBER, RGB.GOLD_CORE, pop * 0.96, true);
    }
  }

  /* ============================================================================
     标准化调用参数
     ============================================================================ */
  function normalizeUnit(u, def) {
    if (!u) return { x: def.x, y: def.y, castX: def.castX, castY: def.castY, feetY: def.feetY, headY: def.headY };
    const x = typeof u.x === 'number' ? u.x : def.x;
    const y = typeof u.y === 'number' ? u.y : def.y;
    return {
      x,
      y,
      castX: typeof u.castX === 'number' ? u.castX : x + 48,
      castY: typeof u.castY === 'number' ? u.castY : y - 10,
      feetY: typeof u.feetY === 'number' ? u.feetY : y + 60,
      headY: typeof u.headY === 'number' ? u.headY : y - 48,
    };
  }

  function normalizeOpts(skillId, opts) {
    const o = opts || {};
    const ampTier = clamp(Math.round(o.ampTier !== undefined ? o.ampTier : (o.overcastTier !== undefined ? o.overcastTier : (o.tier || 0))), 0, 3);
    const defaultCaster = { x: 146, y: 214, castX: 196, castY: 202, feetY: 278, headY: 164 };
    const defaultTarget = { x: 466, y: 214, castX: 430, castY: 204, feetY: 278, headY: 164 };
    const defaultTargets3 = [
      { x: 374, y: 196, feetY: 254, headY: 150 },
      { x: 468, y: 222, feetY: 282, headY: 172 },
      { x: 554, y: 206, feetY: 266, headY: 158 },
    ];

    const caster = normalizeUnit(o.caster || o.from || o.origin, defaultCaster);
    const target = normalizeUnit(o.target || o.to, defaultTarget);
    const rawTargets = o.targets || o.enemies;
    const targets = Array.isArray(rawTargets) && rawTargets.length > 0
      ? rawTargets.map((t, idx) => normalizeUnit(t, defaultTargets3[idx % 3]))
      : defaultTargets3.map(d => normalizeUnit(d, d));

    return {
      skillId,
      ampTier,
      scale: (o.scale || 1) * (1 + ampTier * 0.075),
      caster,
      target,
      targets,
      seed: o.seed !== undefined ? (o.seed >>> 0) : ((skillId.length * 9973 + ampTier * 131 + 202611) >>> 0),
    };
  }

  /* ============================================================================
     9 招完整 4 拍精修渲染实现
     ============================================================================ */

  /* ----------------------------------------------------------------------------
     1. ice_crystal（冰晶术）
     ---------------------------------------------------------------------------- */
  function createIceCrystalData(cfg) {
    const rng = mulberry32(cfg.seed);
    const shards = [];
    for (let i = 0; i < 22; i++) {
      const ang = (i / 22) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      shards.push({
        ang,
        r0: 36 + rng() * 24,
        speed: 88 + rng() * 115,
        size: 10 + rng() * 12,
        spin: (rng() < 0.5 ? -1 : 1) * (3 + rng() * 6),
        rot0: rng() * Math.PI * 2,
        vyBias: -24 - rng() * 48,
        gravity: 88 + rng() * 60,
        pal: i % 4 === 0 ? CRYSTAL_SAPPHIRE_PAL : CRYSTAL_ICE_PAL,
      });
    }
    const petals = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - Math.PI * 0.5 + (rng() - 0.5) * 0.14;
      petals.push({
        ang,
        len: (i % 2 === 0 ? 84 : 58) + rng() * 18,
        wid: (i % 2 === 0 ? 29 : 21) + rng() * 6,
        delay: rng() * 0.04,
        pal: i % 3 === 0 ? CRYSTAL_SAPPHIRE_PAL : CRYSTAL_ICE_PAL,
      });
    }
    return { shards, petals };
  }

  function renderIceCrystal(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const cx = cfg.caster.castX;
    const cy = cfg.caster.castY;
    const tx = cfg.target.x;
    const ty = cfg.target.y;
    const feetY = cfg.target.feetY;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cfg.caster.x, cfg.caster.y, cfg.caster.feetY, t, cfg.ampTier, cfg.seed);

    // Beat 1: 杖尖绽放亮青雪花阵 (0.00 -> 0.40)
    const gatherT = segT(t, 0.0, 0.26);
    if (t < 0.40) {
      const fade = 1 - segT(t, 0.24, 0.40);
      const rSnow = (16 + 34 * EASE.outBack(gatherT)) * sc;
      drawLuminousHalo(backCtx, cx, cy, rSnow * 1.9, RGB.ICE_WHITE, RGB.ICE_ELEC, RGB.ICE_SKY, fade * 0.56);
      px.ring(cx, cy, rSnow * 1.05, rSnow * 1.05, 3, RGB.ICE_SKY, fade * 0.78, 0);
      px.snowflake(cx, cy, rSnow, t * 4.5, RGB.ICE_SKY, RGB.ICE_WHITE, fade * 0.96);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + t * 5;
        const dist = (1 - EASE.outCubic(gatherT)) * 68 * sc + 12;
        px.diamondShard(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, ang + Math.PI, 8 * sc, CRYSTAL_ICE_PAL, fade * 0.92);
      }
      drawCrossStarFlare(frontCtx, cx, cy, 40 * sc * fade, t * 3, RGB.ICE_ELEC, RGB.PURE_WHITE, fade * 0.92, false);
    }

    // Beat 2: 饱满多面体电光冰晶矛丝滑发射 (0.18 -> 0.49)
    const flyT = segT(t, 0.18, 0.47);
    if (t >= 0.17 && t <= 0.50) {
      const easeF = EASE.inOutCubic(flyT);
      const headX = lerp(cx + 12, tx + 8, easeF);
      const headY = lerp(cy, ty - 4, easeF) - Math.sin(flyT * Math.PI) * 14;
      const ang = Math.atan2(ty - 4 - cy, tx - cx) + Math.cos(flyT * Math.PI) * -0.05;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const alpha = smoothstep(0.17, 0.23, t) * (1 - smoothstep(0.46, 0.50, t));

      // 长拖尾冰雾光带
      const tailLen = (145 + 65 * easeF) * sc;
      const trailPts = [];
      const trailW = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const d = (1 - u) * tailLen + 36 * sc;
        const wobble = Math.sin(u * 10 - t * 32) * (1 - u) * 5;
        trailPts.push([headX - ca * d - sa * wobble, headY - sa * d + ca * wobble]);
        trailW.push(lerp(3, 28 * sc, Math.pow(u, 0.8)));
      }
      drawSoftTrail(backCtx, trailPts, 38 * sc, RGB.ICE_ELEC, alpha * 0.48);
      drawLuminousHalo(backCtx, headX - ca * 18, headY - sa * 18, 70 * sc, RGB.ICE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, alpha * 0.54);
      px.ribbon(trailPts, trailW, RGB.ICE_SKY, RGB.ICE_CYAN, RGB.ICE_WHITE, alpha * 0.82, { rimCol: RGB.ICE_COBALT });

      // 主体巨型多面体电光冰晶矛（切面清晰饱满分明！）
      const spearLen = 156 * sc;
      const spearWid = 44 * sc;
      const baseX = headX - ca * spearLen * 0.72;
      const baseY = headY - sa * spearLen * 0.72;
      px.crystal(baseX, baseY, ang, spearLen, spearWid, CRYSTAL_ICE_PAL, alpha, { shoulderRatio: 0.38, backTail: 0.24, rimAlpha: 0.82 });
      for (let side = -1; side <= 1; side += 2) {
        const wx = baseX + ca * 26 * sc - sa * side * 22 * sc;
        const wy = baseY + sa * 26 * sc + ca * side * 22 * sc;
        px.crystal(wx, wy, ang + side * 0.14, 68 * sc, 17 * sc, CRYSTAL_SAPPHIRE_PAL, alpha * 0.96, { shoulderRatio: 0.36, backTail: 0.18 });
      }
      for (let i = 0; i < 6; i++) {
        const u = ((i / 6) + flyT * 1.8) % 1;
        const d = u * tailLen * 0.92 + 22;
        const orb = Math.sin(u * 12 + i * 2) * (20 + u * 12) * sc;
        px.star4(headX - ca * d - sa * orb, headY - sa * d + ca * orb, (10 - u * 4) * sc, 2.5 * sc, RGB.PURE_WHITE, RGB.ICE_ELEC, alpha * (1 - u * 0.45), ang);
      }
      drawCrossStarFlare(frontCtx, headX + ca * 42 * sc, headY + sa * 42 * sc, 52 * sc, t * 5, RGB.ICE_SKY, RGB.PURE_WHITE, alpha, false);
    }

    // Beat 3 & 4: 耀眼多面冰晶花簇 + 亮青裂纹冲击波 + 大块透亮水晶片飞溅 + 余韵 (0.43 -> 1.00)
    if (t >= 0.43) {
      const impT = segT(t, 0.43, 1.0);
      const bloomPop = EASE.outBack(segT(impT, 0.0, 0.18));
      const fadeAll = 1 - smoothstep(0.62, 1.0, impT);
      const coreFlash = 1 - smoothstep(0.0, 0.34, impT);

      drawGroundGlow(backCtx, tx, feetY, 128 * sc * (0.65 + 0.45 * EASE.outCubic(impT)), 42 * sc, RGB.ICE_CYAN, RGB.ICE_SKY, fadeAll * 0.56);
      drawLuminousHalo(backCtx, tx, ty, 138 * sc * (0.72 + 0.32 * bloomPop), RGB.PURE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fadeAll * 0.62);

      // 双层膨胀亮青冲击波环
      const wave1 = EASE.outCubic(segT(impT, 0.0, 0.58));
      const wave1A = (1 - wave1) * 0.96;
      if (wave1A > 0.01) {
        drawGlowShockRing(frontCtx, tx, ty, (28 + 114 * wave1) * sc, (24 + 100 * wave1) * sc, 5.2 * (1 - wave1 * 0.45), RGB.ICE_SKY, RGB.PURE_WHITE, wave1A, 0);
        px.ring(tx, ty, (28 + 114 * wave1) * sc, (24 + 100 * wave1) * sc, 4.5, RGB.ICE_CYAN, wave1A * 0.86, 0);
      }
      const wave2 = EASE.outCubic(segT(impT, 0.05, 0.72));
      const wave2A = (1 - wave2) * 0.88;
      if (wave2A > 0.01) {
        drawGlowShockRing(frontCtx, tx, feetY - 8, (32 + 122 * wave2) * sc, (12 + 44 * wave2) * sc, 4.4, RGB.ICE_ELEC, RGB.ICE_WHITE, wave2A, 0);
      }

      // 放射状亮青晶裂射线
      const crackA = smoothstep(0.0, 0.08, impT) * (1 - smoothstep(0.32, 0.68, impT));
      if (crackA > 0.01) {
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.25;
          const r1 = 56 * sc;
          const r2 = (108 + 30 * EASE.outCubic(impT)) * sc;
          px.lightning(tx + Math.cos(ang) * r1, ty + Math.sin(ang) * r1, tx + Math.cos(ang) * r2, ty + Math.sin(ang) * r2, 10, cfg.seed + i * 29, RGB.ICE_COBALT, RGB.ICE_CYAN, RGB.PURE_WHITE, crackA * 0.85, 4);
        }
      }

      // 耀眼多面冰晶花簇 (直径 ~190px)
      const flowerFade = 1 - smoothstep(0.50, 0.90, impT);
      if (flowerFade > 0.01) {
        for (let i = 0; i < data.petals.length; i++) {
          const p = data.petals[i];
          const pT = EASE.outBack(segT(impT, p.delay, p.delay + 0.16));
          px.crystal(tx + Math.cos(p.ang) * 10 * sc, ty + Math.sin(p.ang) * 10 * sc, p.ang, p.len * sc * clamp(pT, 0, 1.15), p.wid * sc, p.pal, flowerFade * 0.96, { shoulderRatio: 0.34, backTail: 0.12 });
        }
        px.snowflake(tx, ty, 40 * sc * clamp(bloomPop, 0, 1.1), impT * 1.4, RGB.ICE_ELEC, RGB.PURE_WHITE, flowerFade * 0.95);
      }

      // 飞溅大块透亮水晶片（爆发即向外喷涌，峰值帧四周晶块清晰可见！）
      for (let i = 0; i < data.shards.length; i++) {
        const s = data.shards[i];
        const dist = (s.r0 + s.speed * EASE.outQuart(impT) * 1.25) * sc;
        const sx = tx + Math.cos(s.ang) * dist;
        const sy = ty + Math.sin(s.ang) * dist * 0.84 + s.vyBias * impT + 0.5 * s.gravity * impT * impT;
        const sa = smoothstep(0.0, 0.04, impT) * (1 - smoothstep(0.56, 1.0, impT));
        const sSize = s.size * sc * (1 - impT * 0.3);
        px.diamondShard(sx, sy, s.rot0 + s.spin * impT, sSize, s.pal, sa * 0.98);
        if (i % 4 === 0 && sa > 0.25) {
          px.star4(sx, sy, sSize * 0.92, sSize * 0.24, RGB.PURE_WHITE, RGB.ICE_ELEC, sa * 0.88, impT * 4);
        }
      }

      if (coreFlash > 0.01) {
        drawCrossStarFlare(frontCtx, tx, ty, (100 + 24 * coreFlash) * sc, impT * 1.6, RGB.ICE_SKY, RGB.PURE_WHITE, coreFlash, true);
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.4;
        const r = (58 + 56 * EASE.outQuad(impT)) * sc;
        const sx = tx + Math.cos(ang) * r;
        const sy = ty + Math.sin(ang) * r * 0.78 - impT * 24;
        const tw = 0.55 + 0.45 * Math.sin(impT * 16 + i * 2.1);
        const a = smoothstep(0.06, 0.16, impT) * (1 - smoothstep(0.62, 1.0, impT)) * tw;
        drawCrossStarFlare(frontCtx, sx, sy, (24 - (i % 3) * 4) * sc, i * 0.5, RGB.ICE_ELEC, RGB.PURE_WHITE, a, false);
      }

      renderAmpImpactLayer(backCtx, px, frontCtx, tx, ty, impT, cfg.ampTier, cfg.seed);
    }
  }

  /* ----------------------------------------------------------------------------
     2. tri_prism_ice（三棱冰晶）
     ---------------------------------------------------------------------------- */
  function createTriPrismData(cfg) {
    const rng = mulberry32(cfg.seed + 19);
    const burstShards = [[], [], []];
    for (let b = 0; b < 3; b++) {
      const n = b === 2 ? 20 : 10;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.35;
        burstShards[b].push({
          ang,
          r0: b === 2 ? 32 : 18,
          speed: (b === 2 ? 82 : 54) + rng() * (b === 2 ? 102 : 64),
          size: (b === 2 ? 10.5 : 8) + rng() * (b === 2 ? 10.5 : 7),
          rot0: rng() * Math.PI * 2,
          spin: (rng() < 0.5 ? -1 : 1) * (4 + rng() * 5),
          pal: b === 2 && i % 4 === 0 ? CRYSTAL_GOLD_PAL : (i % 3 === 0 ? CRYSTAL_SAPPHIRE_PAL : CRYSTAL_ICE_PAL),
        });
      }
    }
    return { burstShards };
  }

  function renderTriPrismIce(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const cx = cfg.caster.castX;
    const cy = cfg.caster.castY;
    const tx = cfg.target.x;
    const ty = cfg.target.y;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cfg.caster.x, cfg.caster.y, cfg.caster.feetY, t, cfg.ampTier, cfg.seed);

    const bolts = [
      {
        launch: 0.12, hit: 0.38,
        start: { x: cx - 10, y: cy - 38 },
        ctrl: { x: lerp(cx, tx, 0.52), y: Math.min(cy, ty) - 118 },
        end: { x: tx - 10, y: ty - 24 },
        len: 102, wid: 28, final: false,
      },
      {
        launch: 0.22, hit: 0.49,
        start: { x: cx - 8, y: cy + 32 },
        ctrl: { x: lerp(cx, tx, 0.48), y: Math.max(cy, ty) + 92 },
        end: { x: tx + 10, y: ty + 20 },
        len: 102, wid: 28, final: false,
      },
      {
        launch: 0.32, hit: 0.57,
        start: { x: cx + 10, y: cy - 4 },
        ctrl: { x: lerp(cx, tx, 0.5), y: lerp(cy, ty, 0.5) - 14 },
        end: { x: tx, y: ty - 2 },
        len: 132, wid: 36, final: true,
      },
    ];

    // Beat 1: 三枚棱镜法印
    if (t < 0.38) {
      for (let i = 0; i < 3; i++) {
        const b = bolts[i];
        const pop = EASE.outBack(segT(t, i * 0.04, i * 0.04 + 0.12));
        const fade = 1 - segT(t, b.launch, b.launch + 0.08);
        if (fade <= 0.01) continue;
        drawLuminousHalo(backCtx, b.start.x, b.start.y, 34 * sc * pop, RGB.ICE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.55);
        px.ring(b.start.x, b.start.y, 20 * sc * pop, 20 * sc * pop, 3, RGB.ICE_ELEC, fade * 0.85, 0);
        px.crystal(b.start.x - 16 * sc, b.start.y, 0, 44 * sc * pop, 15 * sc * pop, i === 2 ? CRYSTAL_SAPPHIRE_PAL : CRYSTAL_ICE_PAL, fade, { shoulderRatio: 0.4, backTail: 0.3 });
      }
    }

    // Beat 2: 三道高低弧线棱镜晶梭 + 优雅渐隐汇流光轨（峰值帧仍保留三道弧线余光！）
    for (let i = 0; i < 3; i++) {
      const b = bolts[i];
      // 三道优雅弧线残光带（持续到第 3 发爆裂后柔滑消散，一眼看清三棱汇流！）
      if (t >= b.launch && t <= 0.78) {
        const headU = EASE.inOutCubic(segT(t, b.launch, b.hit));
        const tailU = EASE.inQuad(segT(t, b.hit - 0.04, 0.76));
        const trailFade = 1 - smoothstep(0.56, 0.78, t);
        if (headU - tailU > 0.04 && trailFade > 0.01) {
          const pts = [];
          const ws = [];
          for (let k = 0; k <= 14; k++) {
            const tu = lerp(tailU, headU, k / 14);
            const tp = quadBezier(b.start, b.ctrl, b.end, tu);
            pts.push([tp.x, tp.y]);
            ws.push(lerp(2.5, (b.final ? 22 : 16) * sc * trailFade, Math.sin((k / 14) * Math.PI * 0.85)));
          }
          drawSoftTrail(backCtx, pts, (b.final ? 32 : 24) * sc, RGB.ICE_ELEC, trailFade * 0.42);
          px.ribbon(pts, ws, RGB.ICE_SKY, RGB.ICE_CYAN, RGB.PURE_WHITE, trailFade * 0.86);
        }
      }

      if (t >= b.launch && t <= b.hit + 0.03) {
        const eu = EASE.inOutCubic(segT(t, b.launch, b.hit));
        const pos = quadBezier(b.start, b.ctrl, b.end, eu);
        const tan = quadBezierTan(b.start, b.ctrl, b.end, eu);
        const ang = Math.atan2(tan.y, tan.x);
        const fadeOut = 1 - segT(t, b.hit, b.hit + 0.03);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const bx = pos.x - ca * b.len * 0.68 * sc;
        const by = pos.y - sa * b.len * 0.68 * sc;
        drawLuminousHalo(backCtx, pos.x, pos.y, 48 * sc, RGB.PURE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fadeOut * 0.56);
        px.crystal(bx, by, ang, b.len * sc, b.wid * sc, b.final ? CRYSTAL_SAPPHIRE_PAL : CRYSTAL_ICE_PAL, fadeOut, { shoulderRatio: 0.36, backTail: 0.25 });
        if (b.final) {
          px.crystal(bx + ca * 16 * sc, by + sa * 16 * sc, ang, b.len * 0.55 * sc, 12 * sc, CRYSTAL_GOLD_PAL, fadeOut * 0.88, { shoulderRatio: 0.4, backTail: 0.2, rimAlpha: 0.45 });
        }
        drawCrossStarFlare(frontCtx, pos.x + ca * 24 * sc, pos.y + sa * 24 * sc, (b.final ? 46 : 34) * sc, t * 6 + i, RGB.ICE_ELEC, RGB.PURE_WHITE, fadeOut, false);
      }
    }

    // Beat 3 & 4: 连环踩点晶爆 + 第三发放大星芒冰环
    for (let i = 0; i < 3; i++) {
      const b = bolts[i];
      if (t < b.hit) continue;
      const impDur = b.final ? (1.0 - b.hit) : 0.36;
      const impT = segT(t, b.hit, b.hit + impDur);
      if (impT >= 1) continue;

      const fade = 1 - smoothstep(b.final ? 0.56 : 0.45, 1.0, impT);
      const ex = b.end.x;
      const ey = b.end.y;
      const pop = EASE.outCubic(impT);

      if (!b.final) {
        drawLuminousHalo(backCtx, ex, ey, (66 + 26 * pop) * sc, RGB.PURE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.55);
        drawGlowShockRing(frontCtx, ex, ey, (18 + 68 * pop) * sc, (16 + 60 * pop) * sc, 4.2, RGB.ICE_ELEC, RGB.PURE_WHITE, fade * 0.92, i * 0.35);
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2 + i * 0.4;
          px.crystal(ex, ey, ang, 48 * sc * EASE.outBack(segT(impT, 0, 0.22)), 16 * sc, CRYSTAL_ICE_PAL, fade * 0.92, { shoulderRatio: 0.35 });
        }
        drawCrossStarFlare(frontCtx, ex, ey, 58 * sc * (1 - impT * 0.65), impT * 2.5, RGB.ICE_SKY, RGB.PURE_WHITE, fade, false);
      } else {
        const ringR = (30 + 106 * EASE.outCubic(segT(impT, 0, 0.65))) * sc;
        const ringFade = 1 - smoothstep(0.46, 0.96, impT);
        drawGroundGlow(backCtx, tx, cfg.target.feetY, 136 * sc, 44 * sc, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.56);
        drawLuminousHalo(backCtx, ex, ey, 144 * sc * (0.75 + 0.3 * pop), RGB.PURE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.64);

        drawGlowShockRing(frontCtx, ex, ey, ringR, ringR * 0.88, 6.2 * (1 - impT * 0.32), RGB.ICE_SKY, RGB.PURE_WHITE, ringFade, 0);
        px.ring(ex, ey, ringR, ringR * 0.88, 5, RGB.ICE_CYAN, ringFade * 0.92, 0);
        px.ring(ex, ey, ringR * 0.72, ringR * 0.64, 3.2, RGB.GOLD_BRIGHT, ringFade * 0.88, 0.25);

        const crownPop = EASE.outBack(segT(impT, 0.0, 0.2));
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2 + impT * 0.25;
          const isMain = k % 2 === 0;
          px.crystal(ex + Math.cos(ang) * 14 * sc, ey + Math.sin(ang) * 14 * sc, ang, (isMain ? 88 : 60) * sc * clamp(crownPop, 0, 1.12), (isMain ? 28 : 20) * sc, isMain ? CRYSTAL_ICE_PAL : CRYSTAL_SAPPHIRE_PAL, fade * 0.96, { shoulderRatio: 0.34, backTail: 0.14 });
        }
        px.snowflake(ex, ey, 48 * sc * clamp(crownPop, 0, 1.08), -impT * 1.8, RGB.ICE_SKY, RGB.PURE_WHITE, fade * 0.95);
        drawCrossStarFlare(frontCtx, ex, ey, (114 * (1 - impT * 0.44)) * sc, impT * 1.4, RGB.ICE_SKY, RGB.PURE_WHITE, fade, true);

        renderAmpImpactLayer(backCtx, px, frontCtx, ex, ey, impT, cfg.ampTier, cfg.seed);
      }

      const shards = data.burstShards[i];
      for (let k = 0; k < shards.length; k++) {
        const s = shards[k];
        const dist = (s.r0 + s.speed * EASE.outQuart(impT)) * sc;
        const sx = ex + Math.cos(s.ang) * dist;
        const sy = ey + Math.sin(s.ang) * dist * 0.84 + 42 * impT * impT;
        px.diamondShard(sx, sy, s.rot0 + s.spin * impT, s.size * sc * (1 - impT * 0.32), s.pal, fade * 0.96);
      }
    }
  }

  /* ----------------------------------------------------------------------------
     3. starfrost_scatter（星霜散华）
     ---------------------------------------------------------------------------- */
  function createStarfrostData(cfg) {
    const rng = mulberry32(cfg.seed + 37);
    const lances = [];
    const xOffsets = [-98, -68, -36, -12, 16, 44, 72, 98, -4];
    for (let i = 0; i < 9; i++) {
      lances.push({
        ox: xOffsets[i] + (rng() - 0.5) * 10,
        oy: (rng() - 0.5) * 32,
        startT: 0.15 + i * 0.052, // 错落延展，让峰值期仍有3-4道冰棱雨从天倾泻！
        dur: 0.22,
        len: 88 + rng() * 30,
        wid: 22 + rng() * 8,
        gold: i % 3 === 1,
        angle: Math.PI * 0.5 + 0.19 + (rng() - 0.5) * 0.05,
      });
    }
    const stars = [];
    for (let i = 0; i < 34; i++) {
      stars.push({
        x: cfg.target.x + (rng() - 0.5) * 310,
        y: cfg.target.y + (rng() - 0.5) * 220,
        size: 15 + rng() * 22,
        vy: -18 - rng() * 34,
        phase: rng() * Math.PI * 2,
        gold: i % 3 === 0,
      });
    }
    return { lances, stars };
  }

  function drawHexagramMagicCircle(backCtx, px, frontCtx, cx, cy, rx, ry, rot, alpha) {
    if (alpha <= 0.004) return;
    drawGroundGlow(backCtx, cx, cy, rx * 1.3, ry * 1.5, RGB.ICE_CYAN, RGB.ICE_SKY, alpha * 0.56);
    drawGroundGlow(backCtx, cx, cy, rx * 0.74, ry * 0.88, RGB.GOLD_PALE, RGB.GOLD_AMBER, alpha * 0.44);

    drawGlowShockRing(frontCtx, cx, cy, rx, ry, 3.8, RGB.ICE_SKY, RGB.ICE_WHITE, alpha * 0.94, 0);
    px.ring(cx, cy, rx, ry, 4.4, RGB.ICE_ELEC, alpha * 0.94, 0);
    px.ring(cx, cy, rx * 0.87, ry * 0.87, 2.8, RGB.ICE_CYAN, alpha * 0.9, 0);

    for (let tri = 0; tri < 2; tri++) {
      const pts = [];
      for (let k = 0; k < 3; k++) {
        const ang = rot * (tri === 0 ? 1 : -1) + (k * Math.PI * 2) / 3 + (tri === 1 ? Math.PI / 3 : 0);
        pts.push([cx + Math.cos(ang) * rx * 0.85, cy + Math.sin(ang) * ry * 0.85]);
      }
      px.poly(pts, RGB.GOLD_PALE, alpha * 0.25);
      px.polyOutline(pts, RGB.GOLD_RIM, alpha * 0.84, 4);
      px.polyOutline(pts, RGB.GOLD_BRIGHT, alpha * 0.98, 2);
      px.polyOutline(pts, RGB.GOLD_CORE, alpha * 0.88, 2, true);
    }

    for (let k = 0; k < 6; k++) {
      const ang = rot + (k * Math.PI) / 3;
      px.star4(cx + Math.cos(ang) * rx * 0.93, cy + Math.sin(ang) * ry * 0.93, 10, 3.2, RGB.PURE_WHITE, k % 2 === 0 ? RGB.GOLD_AMBER : RGB.ICE_SKY, alpha * 0.96, ang);
    }
    px.ring(cx, cy, rx * 0.44, ry * 0.44, 3.2, RGB.GOLD_SUN, alpha * 0.9, 0);
    px.ring(cx, cy, rx * 0.34, ry * 0.34, 2.5, RGB.ICE_WHITE, alpha * 0.92, 0);
  }

  function renderStarfrostScatter(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const tx = cfg.target.x;
    const ty = cfg.target.y;
    const feetY = cfg.target.feetY + 4;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cfg.caster.x, cfg.caster.y, cfg.caster.feetY, t, cfg.ampTier, cfg.seed);

    const circleIn = EASE.outBack(segT(t, 0.0, 0.22));
    const circleOut = 1 - smoothstep(0.76, 1.0, t);
    const circleA = smoothstep(0.0, 0.08, t) * circleOut;
    const rx = 122 * sc * clamp(circleIn, 0.1, 1.08);
    const ry = 48 * sc * clamp(circleIn, 0.1, 1.08);
    drawHexagramMagicCircle(backCtx, px, frontCtx, tx, feetY, rx, ry, t * 2.2, circleA);

    if (circleA > 0.05) {
      drawLightPillar(backCtx, tx, feetY + 8, 8, rx * 0.78, RGB.ICE_CYAN, RGB.GOLD_PALE, circleA * 0.24);
    }

    // 9 道星霜冰棱光雨
    for (let i = 0; i < data.lances.length; i++) {
      const L = data.lances[i];
      const u = segT(t, L.startT, L.startT + L.dur);
      const landT = segT(t, L.startT + L.dur, L.startT + L.dur + 0.24);
      const landX = tx + L.ox * sc;
      const landY = feetY - 8 + L.oy * sc * 0.45;
      const ca = Math.cos(L.angle), sa = Math.sin(L.angle);

      if (t >= L.startT && t <= L.startT + L.dur + 0.04) {
        const dist = (1 - EASE.inQuad(u)) * 310;
        const headX = landX - ca * dist;
        const headY = landY - sa * dist;
        const a = smoothstep(0.0, 0.12, u) * (1 - segT(t, L.startT + L.dur, L.startT + L.dur + 0.04));

        const tailPts = [
          [headX - ca * 120 * sc, headY - sa * 120 * sc],
          [headX - ca * 56 * sc, headY - sa * 56 * sc],
          [headX, headY],
        ];
        drawSoftTrail(backCtx, tailPts, 24 * sc, L.gold ? RGB.GOLD_BRIGHT : RGB.ICE_ELEC, a * 0.56);
        px.ribbon(tailPts, [2, 12 * sc, 21 * sc], L.gold ? RGB.GOLD_AMBER : RGB.ICE_SKY, L.gold ? RGB.GOLD_PALE : RGB.ICE_CYAN, RGB.PURE_WHITE, a * 0.88);
        px.crystal(headX - ca * L.len * 0.82 * sc, headY - sa * L.len * 0.82 * sc, L.angle, L.len * sc, L.wid * sc, L.gold ? CRYSTAL_GOLD_PAL : CRYSTAL_ICE_PAL, a, { shoulderRatio: 0.35, backTail: 0.22 });
        drawCrossStarFlare(frontCtx, headX, headY, 30 * sc, u * 4, L.gold ? RGB.GOLD_AMBER : RGB.ICE_ELEC, RGB.PURE_WHITE, a * 0.92, false);
      }

      if (landT > 0 && landT < 1) {
        const la = 1 - EASE.outQuad(landT);
        const lr = (10 + 38 * EASE.outCubic(landT)) * sc;
        drawGlowShockRing(frontCtx, landX, landY, lr, lr * 0.4, 2.8, L.gold ? RGB.GOLD_AMBER : RGB.ICE_ELEC, RGB.PURE_WHITE, la * 0.85, 0);
        px.star4(landX, landY - 10 * landT * sc, 12 * sc * la, 3.2 * sc, RGB.PURE_WHITE, L.gold ? RGB.GOLD_BRIGHT : RGB.ICE_SKY, la, 0);
      }
    }

    // Beat 3 & 4: 终结巨型菱形冰花绽放 + 全屏飘舞高亮十字星屑
    if (t >= 0.48) {
      const fT = segT(t, 0.48, 1.0);
      const pop = EASE.outBack(segT(fT, 0.0, 0.22));
      const fade = 1 - smoothstep(0.60, 1.0, fT);
      const lotusY = ty + 4;

      drawLightPillar(backCtx, tx, feetY + 6, 8, 76 * sc * clamp(pop, 0, 1.1), RGB.ICE_ELEC, RGB.GOLD_CORE, fade * 0.48);
      drawLuminousHalo(backCtx, tx, lotusY, 150 * sc * clamp(pop, 0.2, 1.15), RGB.PURE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.62);

      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 - Math.PI * 0.5 + fT * 0.18;
        px.crystal(tx + Math.cos(ang) * 10 * sc, lotusY + Math.sin(ang) * 10 * sc, ang, (i % 2 === 0 ? 96 : 74) * sc * clamp(pop, 0, 1.12), (i % 2 === 0 ? 34 : 26) * sc, i % 2 === 0 ? CRYSTAL_ICE_PAL : CRYSTAL_SAPPHIRE_PAL, fade * 0.96, { shoulderRatio: 0.38, backTail: 0.14 });
      }
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - fT * 0.35;
        px.crystal(tx + Math.cos(ang) * 6 * sc, lotusY + Math.sin(ang) * 6 * sc, ang, 56 * sc * clamp(pop, 0, 1.1), 19 * sc, CRYSTAL_GOLD_PAL, fade * 0.96, { shoulderRatio: 0.36, backTail: 0.12 });
      }
      px.snowflake(tx, lotusY, 44 * sc * clamp(pop, 0, 1.08), fT * 1.6, RGB.ICE_SKY, RGB.PURE_WHITE, fade * 0.95);

      const ringU = EASE.outCubic(segT(fT, 0.0, 0.65));
      const ringA = (1 - ringU) * 0.95;
      if (ringA > 0.01) {
        drawGlowShockRing(frontCtx, tx, lotusY, (28 + 124 * ringU) * sc, (26 + 108 * ringU) * sc, 5.5, RGB.ICE_SKY, RGB.PURE_WHITE, ringA, 0);
        drawGlowShockRing(frontCtx, tx, lotusY, (22 + 96 * ringU) * sc, (20 + 84 * ringU) * sc, 3.8, RGB.GOLD_AMBER, RGB.GOLD_CORE, ringA * 0.9, 0.3);
      }

      drawCrossStarFlare(frontCtx, tx, lotusY, 118 * sc * (1 - fT * 0.38), fT * 1.1, RGB.GOLD_AMBER, RGB.PURE_WHITE, fade * 0.96, true);

      for (let i = 0; i < data.stars.length; i++) {
        const st = data.stars[i];
        const tw = 0.48 + 0.52 * Math.sin(fT * 14 + st.phase);
        const sa = smoothstep(0.0, 0.14, fT) * (1 - smoothstep(0.58, 1.0, fT)) * tw;
        const sx = st.x + Math.sin(fT * 5 + st.phase) * 14;
        const sy = st.y + st.vy * fT;
        if (i % 2 === 0) {
          drawCrossStarFlare(frontCtx, sx, sy, st.size * sc, st.phase + fT, st.gold ? RGB.GOLD_AMBER : RGB.ICE_ELEC, RGB.PURE_WHITE, sa * 0.94, false);
        } else {
          px.star4(sx, sy, st.size * 0.54 * sc, st.size * 0.14 * sc, RGB.PURE_WHITE, st.gold ? RGB.GOLD_SUN : RGB.ICE_SKY, sa * 0.96, st.phase);
        }
      }

      renderAmpImpactLayer(backCtx, px, frontCtx, tx, lotusY, fT, cfg.ampTier, cfg.seed);
    }
  }

  /* ----------------------------------------------------------------------------
     4. raging_surge（激流涌 · 精雕海之星怒涛白沫浪壁）
     ---------------------------------------------------------------------------- */
  function createRagingSurgeData(cfg) {
    const rng = mulberry32(cfg.seed + 59);
    const drops = [];
    for (let i = 0; i < 44; i++) {
      const ang = -Math.PI * 0.92 + rng() * Math.PI * 0.84;
      drops.push({
        ang,
        r0: 36 + rng() * 34,
        speed: 95 + rng() * 145,
        size: 5.5 + rng() * 8,
        gravity: 200 + rng() * 100,
        delay: rng() * 0.08,
        ox: (rng() - 0.5) * 64,
        oy: -28 + (rng() - 0.5) * 58,
      });
    }
    return { drops };
  }

  function renderRagingSurge(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const cx = cfg.caster.x + 20;
    const cy = cfg.caster.feetY - 6;
    const tx = cfg.target.x;
    const ty = cfg.target.y;
    const tFeetY = cfg.target.feetY;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cfg.caster.x, cfg.caster.y, cfg.caster.feetY, t, cfg.ampTier, cfg.seed);

    // Beat 1: 明亮碧蓝水漩涡从主角脚下涌起 (0.00 -> 0.42)
    if (t < 0.44) {
      const vIn = EASE.outCubic(segT(t, 0.0, 0.22));
      const vFade = 1 - smoothstep(0.24, 0.44, t);
      const rx = (28 + 58 * vIn) * sc;
      const ry = (12 + 22 * vIn) * sc;
      drawGroundGlow(backCtx, cx, cy, rx * 1.4, ry * 1.7, RGB.WATER_AQUA, RGB.WATER_COBALT, vFade * 0.56);
      for (let k = 0; k < 3; k++) {
        const kr = 1 - k * 0.24;
        const rot = t * (9 + k * 3) + k * 2.1;
        px.ring(cx, cy - k * 10 * vIn, rx * kr, ry * kr, 6 - k, k === 0 ? RGB.WATER_COBALT : (k === 1 ? RGB.WATER_AQUA : RGB.WATER_FOAM), vFade * 0.92, 0, rot, rot + Math.PI * 1.35);
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + t * 11;
        const h = ((t * 3 + i * 0.14) % 1) * 58 * sc;
        px.waterDrop(cx + Math.cos(ang) * rx * 0.72, cy - h + Math.sin(ang) * ry * 0.5, -Math.sin(ang) * 20, -35, 6 * sc, vFade * 0.94);
      }
    }

    // Beat 2: 多层翻腾澄澈激流波带（真实海浪波脊 + 泡沫浪尖 + 浪花飞沫！）(0.13 -> 0.68)
    if (t >= 0.13 && t <= 0.70) {
      const headU = EASE.outCubic(segT(t, 0.13, 0.48));
      const tailU = EASE.inQuad(segT(t, 0.30, 0.70));
      const fade = smoothstep(0.13, 0.19, t) * (1 - smoothstep(0.54, 0.70, t));
      const startX = cx - 6;
      const endX = tx + 18;
      const headX = lerp(startX, endX, headU);
      const tailX = lerp(startX, endX - 24, tailU);

      if (headX - tailX > 14 && fade > 0.01) {
        const baseY = tFeetY + 2;
        const samples = 26;
        // 构建底面贴地、顶面翻涌出多层尖波脊的汹涌海浪多边形
        const upperPts = [];
        const midPts = [];
        const foamPts = [];
        const foamW = [];
        for (let i = 0; i <= samples; i++) {
          const u = i / samples;
          const x = lerp(tailX, headX, u);
          const env = Math.sin(u * Math.PI * 0.92);
          // 锯齿感跃动浪峰，而非平淡正弦条！
          const swell1 = Math.sin(u * 13 - t * 24);
          const crestSharp = Math.pow(Math.max(0, swell1), 1.6) * 24 * sc;
          const h = (20 + 54 * env + crestSharp) * sc;
          const yTop = baseY - h;
          upperPts.push([x, yTop]);
          midPts.push([x, yTop + 14 * sc * env]);
          foamPts.push([x, yTop + 4 * sc]);
          foamW.push((6 + 16 * env + (crestSharp > 8 ? 8 : 0)) * sc);
        }

        drawGroundGlow(backCtx, lerp(tailX, headX, 0.58), baseY + 2, (headX - tailX) * 0.62, 30 * sc, RGB.WATER_AQUA, RGB.WATER_COBALT, fade * 0.5);
        drawSoftTrail(backCtx, upperPts, 54 * sc, RGB.WATER_AQUA, fade * 0.42);

        // 1) 深澄澈钴蓝主体浪身（底部微微起伏贴合水面，非僵硬直线）
        const botPts = [];
        for (let i = samples; i >= 0; i--) {
          const u = i / samples;
          const x = lerp(tailX, headX, u);
          const botWave = Math.sin(u * 14 - t * 20) * 3.5 * sc;
          botPts.push([x, baseY + botWave]);
        }
        const bodyPoly = upperPts.concat(botPts);
        px.poly(bodyPoly, RGB.WATER_COBALT, fade * 0.92);
        // 2) 中层透亮电水青折射浪腹
        const aquaPoly = midPts.concat(botPts.map(p => [p[0], p[1] - 4 * sc]));
        px.poly(aquaPoly, RGB.WATER_AQUA, fade * 0.88);
        // 3) 浪腹内部亮青水流折射丝线
        const innerPts = midPts.map((p, idx) => [p[0], p[1] + 10 * sc + Math.sin(idx * 0.7 - t * 18) * 3]);
        px.ribbon(innerPts, foamW.map(w => w * 0.42), RGB.WATER_SURGE, RGB.WATER_MIST, RGB.PURE_WHITE, fade * 0.78);
        // 4) 浪脊翻涌亮白海沫冠
        px.ribbon(foamPts, foamW, RGB.WATER_MIST, RGB.WATER_FOAM, RGB.PURE_WHITE, fade * 0.98, { coreShift: 0.35 });
        // 5) 底部贴地奔涌翻滚雪白水沫边（彻底消除平底切边感！）
        for (let k = 0; k < 7; k++) {
          const u = k / 6;
          const bx = lerp(tailX + 8 * sc, headX + 4 * sc, u);
          const br = (9 + Math.sin(u * Math.PI) * 9 + (k % 2) * 3) * sc;
          px.ellipse(bx, baseY - 2 * sc, br * 1.45, br * 0.56, k % 2 === 0 ? RGB.WATER_FOAM : RGB.WATER_MIST, fade * 0.92);
        }

        // 6) 浪头奔涌飞溅白沫与晶莹水珠
        for (let k = 0; k < 6; k++) {
          const fx = headX - k * 26 * sc;
          if (fx < tailX + 16) break;
          const fy = baseY - (50 + (k % 2) * 20) * sc;
          px.waterDrop(fx + 10 * sc, fy - 12 * sc, 34, -28, (7.5 - k * 0.65) * sc, fade * 0.96);
        }
      }
    }

    // Beat 3 & 4: 葛饰北斋×星之海 弧形透亮白沫巨浪壁 + 漫天晶莹水珠 (0.39 -> 1.00)
    if (t >= 0.39) {
      const impT = segT(t, 0.39, 1.0);
      const rise = EASE.outBack(segT(impT, 0.0, 0.22));
      const fade = 1 - smoothstep(0.56, 1.0, impT);
      const wallFade = 1 - smoothstep(0.46, 0.88, impT);

      drawGroundGlow(backCtx, tx, tFeetY + 4, 146 * sc, 46 * sc, RGB.WATER_AQUA, RGB.WATER_COBALT, fade * 0.56);
      drawLuminousHalo(backCtx, tx + 6, ty - 20, 146 * sc * clamp(rise, 0.3, 1.12), RGB.WATER_FOAM, RGB.WATER_AQUA, RGB.WATER_COBALT, wallFade * 0.56);

      // 双层撞击扩散碧水波环
      for (let r = 0; r < 2; r++) {
        const ru = EASE.outCubic(segT(impT, r * 0.07, 0.66 + r * 0.1));
        const ra = (1 - ru) * 0.94;
        if (ra > 0.01) {
          drawGlowShockRing(frontCtx, tx, tFeetY - 2, (34 + 122 * ru) * sc, (12 + 44 * ru) * sc, 4.8, RGB.WATER_COBALT, RGB.WATER_FOAM, ra, 0);
          px.ring(tx, tFeetY - 2, (34 + 122 * ru) * sc, (12 + 44 * ru) * sc, 4, RGB.WATER_AQUA, ra * 0.88, 0);
        }
      }

      if (wallFade > 0.01) {
        const hScale = clamp(rise, 0.1, 1.12) * sc;
        const curlShift = impT * 26 * sc;
        const baseY = tFeetY + 8;

        // 1) 后排左翼涌起副浪弧（撑宽气势体量至 210px 宽！）
        const subWave = [
          [tx - 116 * sc, baseY],
          [tx - 102 * sc, baseY - 58 * hScale],
          [tx - 68 * sc, baseY - 108 * hScale],
          [tx - 24 * sc, baseY - 118 * hScale],
          [tx - 42 * sc, baseY - 76 * hScale],
          [tx - 16 * sc, baseY],
        ];
        px.poly(subWave, RGB.WATER_SURGE, wallFade * 0.82);
        px.polyOutline(subWave, RGB.WATER_TEAL, wallFade * 0.65, 2);

        // 2) 主体高大弧形透亮水浪壁（184px 高，气势盖过敌方 1.75× 身高！）
        const mainOuter = [
          [tx - 84 * sc, baseY],
          [tx - 78 * sc, baseY - 66 * hScale],
          [tx - 46 * sc, baseY - 138 * hScale],
          [tx + 6 * sc + curlShift * 0.3, baseY - 178 * hScale],
          [tx + 68 * sc + curlShift * 0.65, baseY - 182 * hScale],
          [tx + 110 * sc + curlShift * 0.9, baseY - 142 * hScale],
          [tx + 96 * sc + curlShift * 0.85, baseY - 112 * hScale],
          [tx + 68 * sc + curlShift * 0.55, baseY - 134 * hScale],
          [tx + 28 * sc + curlShift * 0.2, baseY - 122 * hScale],
          [tx + 10 * sc, baseY - 78 * hScale],
          [tx + 46 * sc, baseY - 36 * hScale],
          [tx + 96 * sc, baseY],
        ];
        px.poly(mainOuter, RGB.WATER_COBALT, wallFade * 0.92);
        px.polyOutline(mainOuter, RGB.WATER_TEAL, wallFade * 0.72, 2);

        // 3) 中层高亮透光水青浪腹 + 内部折射波纹光丝
        const mainMid = [
          [tx - 68 * sc, baseY - 4],
          [tx - 62 * sc, baseY - 62 * hScale],
          [tx - 32 * sc, baseY - 126 * hScale],
          [tx + 14 * sc + curlShift * 0.3, baseY - 164 * hScale],
          [tx + 64 * sc + curlShift * 0.65, baseY - 166 * hScale],
          [tx + 96 * sc + curlShift * 0.85, baseY - 134 * hScale],
          [tx + 54 * sc + curlShift * 0.4, baseY - 136 * hScale],
          [tx + 12 * sc, baseY - 102 * hScale],
          [tx - 10 * sc, baseY - 56 * hScale],
          [tx + 48 * sc, baseY - 8],
        ];
        px.poly(mainMid, RGB.WATER_AQUA, wallFade * 0.94);

        // 内部透亮曲面折射流线（让巨浪充满水流纵深与通透质感！）
        for (let st = 0; st < 3; st++) {
          const offset = st * 18 * sc;
          const streamPts = [
            [tx - 54 * sc + offset, baseY - 12 * hScale],
            [tx - 44 * sc + offset, baseY - 72 * hScale],
            [tx - 12 * sc + offset, baseY - 128 * hScale],
            [tx + 34 * sc + offset * 0.7 + curlShift * 0.4, baseY - (154 - st * 14) * hScale],
          ];
          px.ribbon(streamPts, [3, 7 * sc, 8 * sc, 4 * sc], RGB.WATER_SURGE, RGB.WATER_MIST, RGB.PURE_WHITE, wallFade * 0.84);
        }

        // 4) 葛饰北斋式翻卷浪冠尖爪白沫（绝非单调圆球，而是层次分明的碎浪白沫！）
        const foamCrest = [
          [tx - 58 * sc, baseY - 102 * hScale],
          [tx - 26 * sc, baseY - 148 * hScale],
          [tx + 18 * sc + curlShift * 0.35, baseY - 176 * hScale],
          [tx + 66 * sc + curlShift * 0.68, baseY - 176 * hScale],
          [tx + 104 * sc + curlShift * 0.92, baseY - 144 * hScale],
        ];
        px.ribbon(foamCrest, [10 * sc, 20 * sc, 26 * sc, 26 * sc, 18 * sc], RGB.WATER_MIST, RGB.WATER_FOAM, RGB.PURE_WHITE, wallFade);

        // 浪冠尖端向外飞扑的 7 支像素浪花碎爪
        const claws = [
          { x: -34, y: -146, ang: -2.1, len: 28, wid: 12 },
          { x: -2, y: -172, ang: -1.65, len: 34, wid: 14 },
          { x: 36, y: -180, ang: -1.1, len: 36, wid: 15 },
          { x: 74, y: -172, ang: -0.55, len: 42, wid: 15 },
          { x: 98, y: -152, ang: -0.1, len: 44, wid: 14 },
          { x: 108, y: -130, ang: 0.45, len: 38, wid: 13 },
          { x: 96, y: -110, ang: 0.95, len: 32, wid: 11 },
        ];
        for (let k = 0; k < claws.length; k++) {
          const cl = claws[k];
          const cx0 = tx + cl.x * sc + curlShift * (0.2 + k * 0.12);
          const cy0 = baseY + cl.y * hScale;
          px.crystal(cx0, cy0, cl.ang, cl.len * sc, cl.wid * sc, CRYSTAL_WATER_PAL, wallFade * 0.96, { shoulderRatio: 0.28, rimAlpha: 0.45 });
        }

        // 底部撞击翻滚雪白水花簇
        for (let k = 0; k < 6; k++) {
          const bx = tx - 74 * sc + k * 30 * sc;
          const br = (15 + (k % 2) * 8) * sc;
          px.ellipse(bx, baseY - 8 * sc, br * 1.3, br * 0.72, k % 2 === 0 ? RGB.PURE_WHITE : RGB.WATER_MIST, wallFade * 0.94);
        }

        // 浪冠日光星闪
        drawCrossStarFlare(frontCtx, tx + 52 * sc + curlShift * 0.6, baseY - 176 * hScale, 58 * sc, impT * 1.5, RGB.WATER_AQUA, RGB.PURE_WHITE, wallFade * 0.96, true);
        drawCrossStarFlare(frontCtx, tx - 22 * sc, baseY - 134 * hScale, 36 * sc, -impT * 2, RGB.ICE_ELEC, RGB.PURE_WHITE, wallFade * 0.86, false);
      }

      // 44 颗漫天飞溅晶莹水珠（大范围弧线喷涌，绝不缩在浪内！）
      for (let i = 0; i < data.drops.length; i++) {
        const d = data.drops[i];
        const age = segT(impT, d.delay, 1.0);
        if (age <= 0 || age >= 1) continue;
        const vx = Math.cos(d.ang) * d.speed * sc;
        const vy = Math.sin(d.ang) * d.speed * sc;
        const dx = tx + d.ox * sc + Math.cos(d.ang) * d.r0 * sc + vx * age;
        const dy = ty + d.oy * sc + Math.sin(d.ang) * d.r0 * sc + vy * age + 0.5 * d.gravity * age * age;
        const da = smoothstep(0.0, 0.06, age) * (1 - smoothstep(0.58, 1.0, age));
        px.waterDrop(dx, dy, vx, vy + d.gravity * age, d.size * sc * (1 - age * 0.25), da * 0.98);
        if (i % 5 === 0 && da > 0.35) {
          px.star4(dx, dy, 9 * sc, 2.4 * sc, RGB.PURE_WHITE, RGB.WATER_AQUA, da * 0.9, age * 4);
        }
      }

      renderAmpImpactLayer(backCtx, px, frontCtx, tx, ty - 18, impT, cfg.ampTier, cfg.seed);
    }
  }

  /* ----------------------------------------------------------------------------
     5. water_cleave（断水刃 · 锐利宽幅双交叉月牙水刃）
     ---------------------------------------------------------------------------- */
  function createWaterCleaveData(cfg) {
    const rng = mulberry32(cfg.seed + 83);
    const drops = [];
    for (let i = 0; i < 40; i++) {
      const ang = (i / 40) * Math.PI * 2 + (rng() - 0.5) * 0.28;
      drops.push({
        ang,
        r0: 38 + rng() * 34,
        speed: 96 + rng() * 140,
        size: 6 + rng() * 9,
        gravity: 120 + rng() * 75,
        delay: (i % 2) * 0.1 + rng() * 0.05,
        crystal: i % 3 === 0,
      });
    }
    return { drops };
  }

  function buildCrescentArc(cx, cy, rx, ry, startA, endA, rot, maxW, steps) {
    const pts = [];
    const widths = [];
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = lerp(startA, endA, u);
      const lx = Math.cos(a) * rx;
      const ly = Math.sin(a) * ry;
      pts.push([cx + lx * cosR - ly * sinR, cy + lx * sinR + ly * cosR]);
      widths.push(maxW * Math.pow(Math.sin(u * Math.PI), 0.68));
    }
    return { pts, widths };
  }

  function renderWaterCleave(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const cx = cfg.caster.castX;
    const cy = cfg.caster.castY;
    const tx = cfg.target.x;
    const ty = cfg.target.y;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cfg.caster.x, cfg.caster.y, cfg.caster.feetY, t, cfg.ampTier, cfg.seed);

    // Beat 1: 刃锋聚水闪光 (0.00 -> 0.24)
    if (t < 0.26) {
      const gT = segT(t, 0.0, 0.20);
      const fade = 1 - smoothstep(0.16, 0.26, t);
      drawLuminousHalo(backCtx, cx, cy, 46 * sc * (0.5 + 0.6 * gT), RGB.WATER_FOAM, RGB.WATER_AQUA, RGB.WATER_COBALT, fade * 0.56);
      px.ring(cx, cy, (38 - 22 * gT) * sc, (38 - 22 * gT) * sc, 3.5, RGB.WATER_AQUA, fade * 0.9, 0);
      drawCrossStarFlare(frontCtx, cx, cy, 52 * sc * fade, t * 4, RGB.WATER_AQUA, RGB.PURE_WHITE, fade, false);
    }

    // Beat 2 & 3: 锐利舒展的宽幅 X 型双交叉月牙水刃（开放修长弧线，拒绝闭合成圆圈！）
    const slashes = [
      { start: 0.16, end: 0.68, rot: -0.46, a0: -2.42, a1: -0.72, rx: 148, ry: 72, maxW: 48, ox: 0, oy: 42 },
      { start: 0.28, end: 0.84, rot: 0.48, a0: 0.72, a1: 2.42, rx: 148, ry: 72, maxW: 48, ox: 0, oy: -42 },
    ];

    for (let s = 0; s < 2; s++) {
      const sl = slashes[s];
      if (t < sl.start || t > sl.end) continue;
      const u = segT(t, sl.start, sl.end);
      const sweepHead = EASE.outExpo(segT(u, 0.0, 0.34));
      const sweepTail = EASE.inQuad(segT(u, 0.24, 0.96));
      const fade = 1 - smoothstep(0.56, 1.0, u);
      const curA0 = lerp(sl.a0, sl.a1, sweepTail * 0.76);
      const curA1 = lerp(sl.a0, sl.a1, sweepHead);
      if (Math.abs(curA1 - curA0) < 0.05) continue;

      const arc = buildCrescentArc(
        tx + sl.ox * sc,
        ty + sl.oy * sc,
        sl.rx * sc,
        sl.ry * sc,
        curA0,
        curA1,
        sl.rot,
        sl.maxW * sc * (1 - u * 0.22),
        22
      );

      drawSoftTrail(backCtx, arc.pts, 68 * sc, RGB.WATER_AQUA, fade * 0.5);
      px.ribbon(arc.pts, arc.widths, RGB.WATER_COBALT, RGB.WATER_AQUA, RGB.PURE_WHITE, fade, {
        rimCol: RGB.WATER_TEAL,
        coreShift: s === 0 ? 0.34 : -0.34,
      });

      // 平行高速水幕流光尾带
      const wakeArc = buildCrescentArc(
        tx + sl.ox * sc,
        ty + sl.oy * sc,
        (sl.rx + 18) * sc,
        (sl.ry + 14) * sc,
        curA0,
        lerp(curA0, curA1, 0.92),
        sl.rot,
        16 * sc,
        18
      );
      px.ribbon(wakeArc.pts, wakeArc.widths, RGB.ICE_ELEC, RGB.WATER_MIST, RGB.PURE_WHITE, fade * 0.8);

      const tip = arc.pts[arc.pts.length - 1];
      drawCrossStarFlare(frontCtx, tip[0], tip[1], 46 * sc * fade, u * 5, RGB.WATER_AQUA, RGB.PURE_WHITE, fade, false);
    }

    // 交叉斩击中心爆裂 + 横贯斩轴 + 40 颗高饱和水青晶滴向外飞溅
    if (t >= 0.26) {
      const impT = segT(t, 0.26, 1.0);
      const fade = 1 - smoothstep(0.56, 1.0, impT);
      const burstPop = EASE.outCubic(segT(impT, 0.0, 0.45));

      drawGroundGlow(backCtx, tx, cfg.target.feetY, 126 * sc, 38 * sc, RGB.WATER_AQUA, RGB.WATER_COBALT, fade * 0.52);
      drawLuminousHalo(backCtx, tx, ty, 126 * sc * (0.65 + 0.45 * burstPop), RGB.PURE_WHITE, RGB.WATER_AQUA, RGB.WATER_COBALT, fade * 0.56);

      const cutFade = smoothstep(0.0, 0.08, impT) * (1 - smoothstep(0.32, 0.68, impT));
      if (cutFade > 0.01) {
        const len1 = 148 * sc * EASE.outCubic(segT(impT, 0.0, 0.20));
        px.ribbon(
          [[tx - len1, ty - len1 * 0.48], [tx, ty], [tx + len1, ty + len1 * 0.48]],
          [3, 22 * sc * cutFade, 3],
          RGB.WATER_COBALT, RGB.WATER_AQUA, RGB.PURE_WHITE, cutFade
        );
        const len2 = 148 * sc * EASE.outCubic(segT(impT, 0.10, 0.30));
        if (len2 > 6) {
          px.ribbon(
            [[tx - len2, ty + len2 * 0.48], [tx, ty], [tx + len2, ty - len2 * 0.48]],
            [3, 22 * sc * cutFade, 3],
            RGB.ICE_SKY, RGB.ICE_CYAN, RGB.PURE_WHITE, cutFade
          );
        }
      }

      const ru = EASE.outCubic(segT(impT, 0.06, 0.66));
      const ra = (1 - ru) * 0.94;
      if (ra > 0.01) {
        drawGlowShockRing(frontCtx, tx, ty, (24 + 110 * ru) * sc, (18 + 86 * ru) * sc, 4.8, RGB.WATER_COBALT, RGB.PURE_WHITE, ra, -0.2);
      }

      drawCrossStarFlare(frontCtx, tx, ty, 102 * sc * (1 - impT * 0.46), impT * 2.0, RGB.WATER_AQUA, RGB.PURE_WHITE, fade, true);

      for (let i = 0; i < data.drops.length; i++) {
        const d = data.drops[i];
        const age = segT(impT, d.delay, 1.0);
        if (age <= 0 || age >= 1) continue;
        const dist = (d.r0 + d.speed * EASE.outCubic(age) * 1.15) * sc;
        const dx = tx + Math.cos(d.ang) * dist;
        const dy = ty + Math.sin(d.ang) * dist * 0.86 + 0.5 * d.gravity * age * age;
        const da = smoothstep(0.0, 0.05, age) * (1 - smoothstep(0.56, 1.0, age));
        if (d.crystal) {
          px.diamondShard(dx, dy, d.ang + age * 4, d.size * 1.25 * sc, CRYSTAL_WATER_PAL, da * 0.96);
        } else {
          px.waterDrop(dx, dy, Math.cos(d.ang) * d.speed, Math.sin(d.ang) * d.speed + d.gravity * age, d.size * sc, da * 0.98);
        }
      }

      renderAmpImpactLayer(backCtx, px, frontCtx, tx, ty, impT, cfg.ampTier, cfg.seed);
    }
  }

  /* ----------------------------------------------------------------------------
     6. frost_thorn_field（霜域棘阵 · 3目标群攻全覆盖）
     ---------------------------------------------------------------------------- */
  function createFrostThornData(cfg) {
    const rng = mulberry32(cfg.seed + 107);
    const clusters = cfg.targets.map((tgt, idx) => {
      const specs = [
        { ox: 0, ang: -Math.PI * 0.5 + (rng() - 0.5) * 0.07, len: 160 + rng() * 14, wid: 37, delay: 0.0, pal: CRYSTAL_ICE_PAL },
        { ox: -22, ang: -Math.PI * 0.5 - 0.22, len: 126 + rng() * 14, wid: 30, delay: 0.02, pal: CRYSTAL_SAPPHIRE_PAL },
        { ox: 22, ang: -Math.PI * 0.5 + 0.21, len: 128 + rng() * 14, wid: 30, delay: 0.025, pal: CRYSTAL_ICE_PAL },
        { ox: -40, ang: -Math.PI * 0.5 - 0.44, len: 94 + rng() * 12, wid: 24, delay: 0.04, pal: CRYSTAL_ICE_PAL },
        { ox: 40, ang: -Math.PI * 0.5 + 0.43, len: 98 + rng() * 12, wid: 24, delay: 0.045, pal: CRYSTAL_SAPPHIRE_PAL },
        { ox: -12, ang: -Math.PI * 0.5 - 0.1, len: 104 + rng() * 10, wid: 25, delay: 0.015, pal: CRYSTAL_ICE_PAL },
        { ox: 14, ang: -Math.PI * 0.5 + 0.11, len: 108 + rng() * 10, wid: 25, delay: 0.02, pal: CRYSTAL_ICE_PAL },
      ];
      const shards = [];
      for (let i = 0; i < 12; i++) {
        shards.push({
          ox: (rng() - 0.5) * 76,
          vx: (rng() - 0.5) * 96,
          vy: -105 - rng() * 115,
          size: 8.5 + rng() * 10,
          rot0: rng() * Math.PI * 2,
          spin: (rng() < 0.5 ? -1 : 1) * (4 + rng() * 5),
        });
      }
      return { tgt, eruptT: 0.25 + idx * 0.07, specs, shards };
    });

    const snowMotes = [];
    for (let i = 0; i < 36; i++) {
      snowMotes.push({
        x: 290 + rng() * 325,
        y: 96 + rng() * 185,
        vy: -32 - rng() * 44,
        size: 8 + rng() * 12,
        phase: rng() * Math.PI * 2,
        flake: i % 3 === 0,
      });
    }
    return { clusters, snowMotes };
  }

  function renderFrostThornField(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const cx = cfg.caster.x + 18;
    const cFeetY = cfg.caster.feetY;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cfg.caster.x, cfg.caster.y, cFeetY, t, cfg.ampTier, cfg.seed);

    // Beat 1: 主角脚下霜域震波展开
    if (t < 0.30) {
      const pT = EASE.outCubic(segT(t, 0.0, 0.20));
      const fade = 1 - smoothstep(0.15, 0.30, t);
      drawGroundGlow(backCtx, cx, cFeetY, 88 * sc * pT, 30 * sc * pT, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.58);
      drawGlowShockRing(frontCtx, cx, cFeetY, (24 + 72 * pT) * sc, (10 + 28 * pT) * sc, 4.2, RGB.ICE_SKY, RGB.PURE_WHITE, fade, 0);
      px.snowflake(cx, cFeetY - 2, 34 * sc * pT, t * 3, RGB.ICE_ELEC, RGB.PURE_WHITE, fade * 0.85);
    }

    // Beat 2: 宽幅晶莹冰霜地脉波横推（残留霜脉连接到三敌脚下！）
    if (t >= 0.08 && t <= 0.78) {
      const waveHeadU = EASE.outCubic(segT(t, 0.08, 0.46));
      const waveTailU = EASE.inQuad(segT(t, 0.40, 0.78));
      const fade = smoothstep(0.08, 0.14, t) * (1 - smoothstep(0.56, 0.78, t));
      const startX = cx + 10;
      const endX = 610;
      const headX = lerp(startX, endX, waveHeadU);
      const tailX = lerp(startX, endX - 60, waveTailU);

      if (headX - tailX > 10 && fade > 0.01) {
        const floorY = 272;
        drawGroundGlow(backCtx, lerp(tailX, headX, 0.6), floorY, (headX - tailX) * 0.6, 36 * sc, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.48);
        const spine = [];
        const widths = [];
        for (let i = 0; i <= 18; i++) {
          const u = i / 18;
          const x = lerp(tailX, headX, u);
          spine.push([x, floorY - 6 + Math.sin(u * 10 - t * 20) * 6]);
          widths.push(lerp(10, 38, Math.sin(u * Math.PI * 0.9)) * sc);
        }
        drawSoftTrail(backCtx, spine, 52 * sc, RGB.ICE_ELEC, fade * 0.42);
        px.ribbon(spine, widths, RGB.ICE_SKY, RGB.ICE_CYAN, RGB.ICE_WHITE, fade * 0.9, { rimCol: RGB.ICE_COBALT, coreShift: 0.25 });

        if (t < 0.56) {
          for (let k = 0; k < 5; k++) {
            const kx = headX - k * 24 * sc;
            if (kx < tailX) break;
            px.crystal(kx, floorY + 2, -0.78, (48 - k * 7) * sc, (15 - k * 1.5) * sc, CRYSTAL_ICE_PAL, fade * 0.95, { shoulderRatio: 0.36 });
          }
        }
      }
    }

    // Beat 3 & 4: 全部 3 名敌方脚下冲天冰棘丛
    const fieldFade = smoothstep(0.28, 0.40, t) * (1 - smoothstep(0.76, 1.0, t));
    if (fieldFade > 0.01) {
      drawGroundGlow(backCtx, 465, 268, 182 * sc, 56 * sc, RGB.ICE_CYAN, RGB.ICE_SKY, fieldFade * 0.46);
    }

    for (let c = 0; c < data.clusters.length; c++) {
      const cl = data.clusters[c];
      if (t < cl.eruptT) continue;
      const localT = segT(t, cl.eruptT, 1.0);
      const fade = 1 - smoothstep(0.64, 1.0, localT);
      const tx = cl.tgt.x;
      const feetY = cl.tgt.feetY + 6;

      drawGroundGlow(backCtx, tx, feetY, 80 * sc, 28 * sc, RGB.ICE_WHITE, RGB.ICE_SKY, fade * 0.56);
      drawLuminousHalo(backCtx, tx, feetY - 70 * sc, 88 * sc, RGB.ICE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fade * 0.48);

      const ringU = EASE.outCubic(segT(localT, 0.0, 0.46));
      const ringA = (1 - ringU) * 0.94;
      if (ringA > 0.01) {
        drawGlowShockRing(frontCtx, tx, feetY, (22 + 70 * ringU) * sc, (10 + 28 * ringU) * sc, 4.2, RGB.ICE_SKY, RGB.PURE_WHITE, ringA, 0);
        px.ring(tx, feetY, (22 + 70 * ringU) * sc, (10 + 28 * ringU) * sc, 3.6, RGB.ICE_CYAN, ringA * 0.9, 0);
      }

      for (let i = 0; i < cl.specs.length; i++) {
        const sp = cl.specs[i];
        const pop = EASE.outBack(segT(localT, sp.delay, sp.delay + 0.16));
        if (pop <= 0.01) continue;
        px.crystal(tx + sp.ox * sc, feetY, sp.ang, sp.len * sc * clamp(pop, 0, 1.08), sp.wid * sc, sp.pal, fade * 0.96, { shoulderRatio: 0.30, backTail: 0.04 });
      }

      px.ellipse(tx, feetY - 4, 44 * sc, 12 * sc, RGB.ICE_CYAN, fade * 0.88);
      px.ellipse(tx, feetY - 6, 28 * sc, 7 * sc, RGB.ICE_WHITE, fade * 0.94, true);

      const glintA = smoothstep(0.04, 0.18, localT) * (1 - smoothstep(0.56, 0.92, localT));
      drawCrossStarFlare(frontCtx, tx, feetY - 146 * sc, 50 * sc * glintA, localT * 1.8 + c, RGB.ICE_ELEC, RGB.PURE_WHITE, glintA, c === 1);

      for (let i = 0; i < cl.shards.length; i++) {
        const sh = cl.shards[i];
        const sa = smoothstep(0.0, 0.07, localT) * (1 - smoothstep(0.58, 1.0, localT));
        const sx = tx + sh.ox * sc + sh.vx * localT * sc;
        const sy = feetY - 42 * sc + sh.vy * localT * sc + 92 * localT * localT;
        px.diamondShard(sx, sy, sh.rot0 + sh.spin * localT, sh.size * sc * (1 - localT * 0.28), CRYSTAL_ICE_PAL, sa * 0.96);
      }

      if (cfg.ampTier > 0 && c === 1) {
        renderAmpImpactLayer(backCtx, px, frontCtx, tx, feetY - 66 * sc, localT, cfg.ampTier, cfg.seed);
      } else if (cfg.ampTier >= 2) {
        const altPop = smoothstep(0.0, 0.14, localT) * (1 - smoothstep(0.52, 0.95, localT));
        drawGlowShockRing(frontCtx, tx, feetY - 56 * sc, 56 * sc, 24 * sc, 2.6, RGB.GOLD_AMBER, RGB.GOLD_CORE, altPop * 0.82, 0.18);
      }
    }

    if (fieldFade > 0.01) {
      const riseT = segT(t, 0.28, 1.0);
      for (let i = 0; i < data.snowMotes.length; i++) {
        const m = data.snowMotes[i];
        const tw = 0.52 + 0.48 * Math.sin(riseT * 14 + m.phase);
        const mx = m.x + Math.sin(riseT * 5 + m.phase) * 12;
        const my = m.y + m.vy * riseT;
        if (m.flake) {
          px.snowflake(mx, my, m.size * 1.0 * sc, riseT * 2.5 + m.phase, RGB.ICE_SKY, RGB.PURE_WHITE, fieldFade * tw * 0.96);
        } else {
          drawCrossStarFlare(frontCtx, mx, my, m.size * 1.5 * sc, m.phase, RGB.ICE_ELEC, RGB.PURE_WHITE, fieldFade * tw * 0.94, false);
        }
      }
    }
  }

  /* ----------------------------------------------------------------------------
     7. steel_ice_curtain（钢冰护幕 · 前后景真 3D 环绕 + 顶部亮白反光高光扫过）
     ---------------------------------------------------------------------------- */
  function createSteelIceData(cfg) {
    const rng = mulberry32(cfg.seed + 131);
    const motes = [];
    for (let i = 0; i < 24; i++) {
      motes.push({
        ang: (i / 24) * Math.PI * 2,
        r: 66 + rng() * 46,
        y0: -10 - rng() * 135,
        vy: -24 - rng() * 32,
        size: 6.5 + rng() * 8.5,
        gold: i % 3 === 0,
        phase: rng() * Math.PI * 2,
      });
    }
    return { motes };
  }

  function renderSteelIceCurtain(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const cx = cfg.caster.x;
    const cy = cfg.caster.y - 6;
    const feetY = cfg.caster.feetY + 4;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cx, cy, feetY, t, cfg.ampTier, cfg.seed);

    const riseT = EASE.outCubic(segT(t, 0.08, 0.36));
    const fadeAll = smoothstep(0.0, 0.08, t) * (1 - smoothstep(0.76, 1.0, t));
    if (fadeAll <= 0.004) return;

    const domeW = 86 * sc;
    const domeH = 176 * sc * (0.25 + 0.75 * riseT);
    const topY = feetY - domeH;

    drawGroundGlow(backCtx, cx, feetY, domeW * 1.52, 42 * sc, RGB.ICE_CYAN, RGB.ICE_SKY, fadeAll * 0.56);
    drawLuminousHalo(backCtx, cx, cy, domeW * 1.48, RGB.ICE_WHITE, RGB.ICE_CYAN, RGB.ICE_SKY, fadeAll * 0.38);

    // 后半圈双倾斜环先画在 backCtx，实现真实 3D 环绕护穹纵深！
    const ringPop = EASE.outCubic(segT(t, 0.14, 0.42));
    const r1x = 118 * sc * ringPop, r1y = 35 * sc * ringPop;
    const r2x = 108 * sc * ringPop, r2y = 31 * sc * ringPop;
    if (ringPop > 0.01) {
      drawGlowShockRing(backCtx, cx, cy, r1x, r1y, 3.6, RGB.ICE_SKY, RGB.PURE_WHITE, fadeAll * 0.72, -0.35, Math.PI, Math.PI * 2);
      drawGlowShockRing(backCtx, cx, cy + 8, r2x, r2y, 3.2, RGB.GOLD_AMBER, RGB.GOLD_CORE, fadeAll * 0.72, 0.33, Math.PI, Math.PI * 2);
    }

    // 底部六角冰金基阵
    const baseHex = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      baseHex.push([cx + Math.cos(a) * domeW * 1.05, feetY + Math.sin(a) * 28 * sc]);
    }
    px.poly(baseHex, RGB.ICE_CYAN, fadeAll * 0.25);
    px.polyOutline(baseHex, RGB.GOLD_RIM, fadeAll * 0.76, 4);
    px.polyOutline(baseHex, RGB.GOLD_BRIGHT, fadeAll * 0.96, 2);

    // 六角棱镜立体护穹几何顶点
    const cols = [-0.96, -0.54, 0, 0.54, 0.96];
    const botPts = cols.map(f => [cx + f * domeW, feetY + (1 - Math.abs(f)) * 20 * sc]);
    const midPts = cols.map(f => [cx + f * domeW * 1.04, lerp(feetY, topY, 0.62) + (1 - Math.abs(f)) * 15 * sc]);
    const crownPts = cols.map(f => [cx + f * domeW * 0.54, topY + Math.abs(f) * 24 * sc]);
    const apex = [cx, topY - 14 * sc];

    const wallColors = [RGB.ICE_ELEC, RGB.ICE_CYAN, RGB.ICE_WHITE, RGB.ICE_SKY];
    for (let i = 0; i < 4; i++) {
      px.poly([botPts[i], botPts[i + 1], midPts[i + 1], midPts[i]], wallColors[i], fadeAll * (i === 1 || i === 2 ? 0.22 : 0.34));
      px.poly([midPts[i], midPts[i + 1], crownPts[i + 1], crownPts[i]], i < 2 ? RGB.ICE_PALE : RGB.ICE_CYAN, fadeAll * (i === 1 || i === 2 ? 0.34 : 0.44));
      px.poly([crownPts[i], crownPts[i + 1], apex], i % 2 === 0 ? RGB.PURE_WHITE : RGB.ICE_CYAN, fadeAll * 0.50);
    }

    // 顶部亮白反光高光扫过（清晰可见的玻璃反光斜带掠过穹顶！）
    const sweepU = segT(t, 0.34, 0.74);
    if (sweepU > 0 && sweepU < 1) {
      const sx = lerp(cx - domeW * 0.85, cx + domeW * 0.85, EASE.inOutCubic(sweepU));
      const sw = 30 * sc;
      const sheenA = Math.sin(sweepU * Math.PI) * fadeAll * 0.92;
      px.poly([
        [sx - sw * 0.35, topY + 2 * sc],
        [sx + sw * 0.85, topY + 2 * sc],
        [sx + sw * 0.25, lerp(topY, feetY, 0.56)],
        [sx - sw * 0.95, lerp(topY, feetY, 0.56)],
      ], RGB.PURE_WHITE, sheenA * 0.78, true);
      drawCrossStarFlare(frontCtx, clamp(sx + 8 * sc, cx - domeW * 0.65, cx + domeW * 0.65), topY + 24 * sc, 56 * sc * Math.sin(sweepU * Math.PI), sweepU * 2.2, RGB.ICE_CYAN, RGB.PURE_WHITE, sheenA, false);
    }

    // 立体六角冰蓝×香槟金棱柱骨架
    for (let i = 0; i < 5; i++) {
      px.line(botPts[i][0], botPts[i][1], midPts[i][0], midPts[i][1], RGB.ICE_JEWEL, fadeAll * 0.75, 4);
      px.line(botPts[i][0], botPts[i][1], midPts[i][0], midPts[i][1], i === 2 ? RGB.GOLD_BRIGHT : RGB.ICE_CYAN, fadeAll * 0.96, 2);
      px.line(midPts[i][0], midPts[i][1], crownPts[i][0], crownPts[i][1], RGB.ICE_JEWEL, fadeAll * 0.72, 3);
      px.line(midPts[i][0], midPts[i][1], crownPts[i][0], crownPts[i][1], RGB.GOLD_PALE, fadeAll * 0.94, 2, true);
      px.line(crownPts[i][0], crownPts[i][1], apex[0], apex[1], RGB.ICE_WHITE, fadeAll * 0.96, 2, true);
    }
    for (let i = 0; i < 4; i++) {
      px.line(midPts[i][0], midPts[i][1], midPts[i + 1][0], midPts[i + 1][1], RGB.GOLD_RIM, fadeAll * 0.82, 4);
      px.line(midPts[i][0], midPts[i][1], midPts[i + 1][0], midPts[i + 1][1], RGB.GOLD_BRIGHT, fadeAll * 0.98, 2);
      px.line(crownPts[i][0], crownPts[i][1], crownPts[i + 1][0], crownPts[i + 1][1], RGB.ICE_SKY, fadeAll * 0.88, 3);
      px.line(crownPts[i][0], crownPts[i][1], crownPts[i + 1][0], crownPts[i + 1][1], RGB.PURE_WHITE, fadeAll * 0.96, 2, true);
      px.line(botPts[i][0], botPts[i][1], botPts[i + 1][0], botPts[i + 1][1], RGB.ICE_ELEC, fadeAll * 0.88, 3);
    }

    // 穹顶中徽 + 顶点金晶王冠
    px.snowflake(cx, lerp(feetY, topY, 0.48), 26 * sc, t * 1.1, RGB.GOLD_SUN, RGB.PURE_WHITE, fadeAll * 0.72);
    px.diamondShard(apex[0], apex[1], -Math.PI * 0.5, 14 * sc, CRYSTAL_GOLD_PAL, fadeAll);
    drawCrossStarFlare(frontCtx, apex[0], apex[1], 60 * sc * (0.78 + 0.22 * Math.sin(t * 14)), t * 1.2, RGB.GOLD_AMBER, RGB.PURE_WHITE, fadeAll * 0.96, true);

    // 前半圈双倾斜发光晶环 + 6 颗环绕宝石（画在护穹前方，真 3D 环抱！）
    if (ringPop > 0.01) {
      drawGlowShockRing(frontCtx, cx, cy, r1x, r1y, 4.0, RGB.ICE_SKY, RGB.PURE_WHITE, fadeAll * 0.96, -0.35, 0, Math.PI);
      px.ring(cx, cy, r1x, r1y, 3.8, RGB.ICE_CYAN, fadeAll * 0.94, -0.35, 0, Math.PI);
      drawGlowShockRing(frontCtx, cx, cy + 8, r2x, r2y, 3.6, RGB.GOLD_AMBER, RGB.GOLD_CORE, fadeAll * 0.94, 0.33, 0, Math.PI);
      px.ring(cx, cy + 8, r2x, r2y, 3.4, RGB.GOLD_BRIGHT, fadeAll * 0.94, 0.33, 0, Math.PI);

      for (let i = 0; i < 6; i++) {
        const isFirst = i < 3;
        const rot = isFirst ? -0.35 : 0.33;
        const rx = isFirst ? r1x : r2x;
        const ry = isFirst ? r1y : r2y;
        const oy = isFirst ? 0 : 8;
        const ang = (i % 3) * ((Math.PI * 2) / 3) + t * (isFirst ? 3.8 : -3.4);
        const lx = Math.cos(ang) * rx;
        const ly = Math.sin(ang) * ry;
        const gx = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
        const gy = cy + oy + lx * Math.sin(rot) + ly * Math.cos(rot);
        px.diamondShard(gx, gy, ang, 10.5 * sc, isFirst ? CRYSTAL_ICE_PAL : CRYSTAL_GOLD_PAL, fadeAll * 0.98);
        drawCrossStarFlare(frontCtx, gx, gy, 24 * sc, ang, isFirst ? RGB.ICE_ELEC : RGB.GOLD_AMBER, RGB.PURE_WHITE, fadeAll * 0.88, false);
      }
    }

    const lockU = EASE.outCubic(segT(t, 0.42, 0.78));
    if (lockU > 0 && lockU < 1) {
      drawGlowShockRing(frontCtx, cx, cy, (58 + 78 * lockU) * sc, (58 + 78 * lockU) * sc, 4.2, RGB.ICE_ELEC, RGB.PURE_WHITE, (1 - lockU) * 0.86, 0);
    }

    for (let i = 0; i < data.motes.length; i++) {
      const m = data.motes[i];
      const ang = m.ang + t * 1.4;
      const mx = cx + Math.cos(ang) * m.r * sc;
      const my = feetY + m.y0 * sc + m.vy * t;
      const tw = 0.5 + 0.5 * Math.sin(t * 15 + m.phase);
      px.star4(mx, my, m.size * sc, m.size * 0.25 * sc, RGB.PURE_WHITE, m.gold ? RGB.GOLD_SUN : RGB.ICE_ELEC, fadeAll * tw * 0.94, ang);
    }

    if (cfg.ampTier > 0) {
      renderAmpImpactLayer(backCtx, px, frontCtx, cx, cy, segT(t, 0.36, 0.92), cfg.ampTier, cfg.seed);
    }
  }

  /* ----------------------------------------------------------------------------
     8. sword_send_slash（送刀斩 · 冰蓝冲刺 + 开放大月牙斩光 + 亮金交叉闪斩）
     ---------------------------------------------------------------------------- */
  function createSwordSendData(cfg) {
    const rng = mulberry32(cfg.seed + 157);
    const sparks = [];
    for (let i = 0; i < 30; i++) {
      const ang = (i / 30) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      sparks.push({
        ang,
        r0: 32 + rng() * 30,
        speed: 96 + rng() * 150,
        len: 16 + rng() * 24,
        gold: i % 2 === 0,
        delay: rng() * 0.06,
        size: 7.5 + rng() * 9.5,
      });
    }
    return { sparks };
  }

  function renderSwordSendSlash(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const cx = cfg.caster.x;
    const cy = cfg.caster.y;
    const tx = cfg.target.x;
    const ty = cfg.target.y;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cx, cy, cfg.caster.feetY, t, cfg.ampTier, cfg.seed);

    // Beat 1: 剑锋电光蓄力星闪
    if (t < 0.24) {
      const gT = segT(t, 0.0, 0.18);
      const fade = 1 - smoothstep(0.14, 0.24, t);
      drawLuminousHalo(backCtx, cx + 32, cy - 6, 48 * sc, RGB.PURE_WHITE, RGB.ICE_ELEC, RGB.GOLD_BRIGHT, fade * 0.56);
      drawCrossStarFlare(frontCtx, cx + 32, cy - 6, 62 * sc * (0.4 + 0.7 * gT), t * 5, RGB.ICE_SKY, RGB.PURE_WHITE, fade, true);
    }

    // Beat 2: 纯正电光冰蓝冲刺轨迹 + 冰蓝疾行残影（彻底去除绿色杂色！）
    if (t >= 0.14 && t <= 0.66) {
      const dashHead = EASE.outExpo(segT(t, 0.14, 0.34));
      const dashTail = EASE.inCubic(segT(t, 0.26, 0.64));
      const fade = smoothstep(0.14, 0.19, t) * (1 - smoothstep(0.46, 0.66, t));
      const x0 = lerp(cx + 8, tx - 26, dashTail);
      const x1 = lerp(cx + 12, tx - 10, dashHead);

      if (x1 - x0 > 8 && fade > 0.01) {
        for (let k = -2; k <= 2; k++) {
          const ly = cy + k * 14 * sc;
          const lw = (k === 0 ? 24 : (Math.abs(k) === 1 ? 11 : 6)) * sc;
          const pts = [[x0, ly], [lerp(x0, x1, 0.55), ly - k * 2], [x1, ly]];
          if (k === 0) drawSoftTrail(backCtx, pts, 44 * sc, RGB.ICE_ELEC, fade * 0.52);
          px.ribbon(pts, [2, lw, lw * 0.6], RGB.ICE_SKY, RGB.ICE_CYAN, RGB.PURE_WHITE, fade * (k === 0 ? 0.96 : 0.8));
        }
        // 2 道纯正电光冰蓝疾行残影
        for (let echo = 0; echo < 2; echo++) {
          const ex = lerp(cx + 68, tx - 108, echo * 0.54 + 0.16);
          if (ex < x1 && ex > x0 - 44) {
            px.swordDancerSilhouette(ex, cy + 6, 0.82 * sc, 0, fade * (0.48 + echo * 0.16), 'ice');
          }
        }
      }
    }

    // Beat 3 & 4: 开放舒展宽幅电光冰青大月牙斩光 + 反手亮金交叉闪斩 + 爆炸星芒火花
    if (t >= 0.28) {
      // 主斩：上扬掠空电光冰青大月牙（开放式凌厉斩弧！）
      const s1U = segT(t, 0.28, 0.80);
      if (s1U > 0 && s1U < 1) {
        const head = EASE.outExpo(segT(s1U, 0.0, 0.30));
        const tail = EASE.inQuad(segT(s1U, 0.24, 0.96));
        const fade1 = 1 - smoothstep(0.56, 1.0, s1U);
        const arc1 = buildCrescentArc(
          tx - 4, ty + 40 * sc,
          154 * sc, 82 * sc,
          lerp(-2.52, -0.62, tail * 0.74),
          lerp(-2.52, -0.62, head),
          -0.36,
          54 * sc * (1 - s1U * 0.2),
          24
        );
        drawSoftTrail(backCtx, arc1.pts, 78 * sc, RGB.ICE_SKY, fade1 * 0.54);
        px.ribbon(arc1.pts, arc1.widths, RGB.ICE_SAPPHIRE, RGB.ICE_ELEC, RGB.PURE_WHITE, fade1, {
          rimCol: RGB.ICE_SAPPHIRE,
          coreShift: 0.36,
        });
        const arc1b = buildCrescentArc(
          tx - 4, ty + 40 * sc,
          172 * sc, 96 * sc,
          lerp(-2.52, -0.62, tail * 0.74),
          lerp(-2.52, -0.62, head),
          -0.36,
          15 * sc,
          18
        );
        px.ribbon(arc1b.pts, arc1b.widths, RGB.ICE_CYAN, RGB.ICE_WHITE, RGB.PURE_WHITE, fade1 * 0.88);
      }

      // 反手亮金×冰蓝交叉闪斩（反向舒展月牙！）
      const s2U = segT(t, 0.39, 0.88);
      if (s2U > 0 && s2U < 1) {
        const head2 = EASE.outExpo(segT(s2U, 0.0, 0.28));
        const tail2 = EASE.inQuad(segT(s2U, 0.24, 0.96));
        const fade2 = 1 - smoothstep(0.56, 1.0, s2U);
        const arc2 = buildCrescentArc(
          tx + 4, ty - 40 * sc,
          150 * sc, 78 * sc,
          lerp(0.64, 2.50, tail2 * 0.74),
          lerp(0.64, 2.50, head2),
          0.42,
          46 * sc * (1 - s2U * 0.2),
          24
        );
        drawSoftTrail(backCtx, arc2.pts, 66 * sc, RGB.GOLD_AMBER, fade2 * 0.48);
        px.ribbon(arc2.pts, arc2.widths, RGB.GOLD_AMBER, RGB.GOLD_BRIGHT, RGB.PURE_WHITE, fade2, {
          rimCol: RGB.GOLD_RIM,
          coreShift: -0.35,
        });

        // 交叉贯穿金青闪斩双轴线
        const cutA = smoothstep(0.0, 0.1, s2U) * (1 - smoothstep(0.34, 0.76, s2U));
        if (cutA > 0.01) {
          const cutL = 158 * sc * EASE.outCubic(segT(s2U, 0.0, 0.20));
          px.ribbon(
            [[tx - cutL * 0.94, ty + cutL * 0.50], [tx, ty], [tx + cutL * 0.94, ty - cutL * 0.50]],
            [3, 24 * sc * cutA, 3],
            RGB.GOLD_AMBER, RGB.GOLD_PALE, RGB.PURE_WHITE, cutA
          );
          px.ribbon(
            [[tx - cutL * 0.88, ty - cutL * 0.54], [tx, ty], [tx + cutL * 0.88, ty + cutL * 0.54]],
            [3, 22 * sc * cutA, 3],
            RGB.ICE_SAPPHIRE, RGB.ICE_CYAN, RGB.PURE_WHITE, cutA
          );
        }
      }

      // 爆炸级高亮星芒火花 + 双色冲击波
      const impT = segT(t, 0.34, 1.0);
      if (impT > 0) {
        const fade = 1 - smoothstep(0.56, 1.0, impT);
        const pop = EASE.outCubic(segT(impT, 0.0, 0.48));

        drawGroundGlow(backCtx, tx, cfg.target.feetY, 138 * sc, 42 * sc, RGB.ICE_CYAN, RGB.GOLD_AMBER, fade * 0.52);
        drawLuminousHalo(backCtx, tx, ty, 148 * sc * (0.65 + 0.4 * pop), RGB.PURE_WHITE, RGB.GOLD_PALE, RGB.ICE_SKY, fade * 0.62);

        const ru = EASE.outCubic(segT(impT, 0.04, 0.65));
        const ra = (1 - ru) * 0.96;
        if (ra > 0.01) {
          drawGlowShockRing(frontCtx, tx, ty, (26 + 124 * ru) * sc, (20 + 102 * ru) * sc, 5.4, RGB.ICE_SKY, RGB.PURE_WHITE, ra, -0.2);
          drawGlowShockRing(frontCtx, tx, ty, (20 + 94 * ru) * sc, (16 + 78 * ru) * sc, 3.8, RGB.GOLD_AMBER, RGB.GOLD_CORE, ra * 0.92, 0.3);
        }

        const burstScale = (130 * (1 - impT * 0.4)) * sc;
        drawCrossStarFlare(frontCtx, tx, ty, burstScale, impT * 1.4, RGB.GOLD_AMBER, RGB.PURE_WHITE, fade, true);
        drawCrossStarFlare(frontCtx, tx, ty, burstScale * 0.84, -impT * 2 + 0.4, RGB.ICE_SKY, RGB.PURE_WHITE, fade * 0.94, false);

        for (let i = 0; i < data.sparks.length; i++) {
          const sp = data.sparks[i];
          const age = segT(impT, sp.delay, 1.0);
          if (age <= 0 || age >= 1) continue;
          const dist = (sp.r0 + sp.speed * EASE.outCubic(age)) * sc;
          const sx = tx + Math.cos(sp.ang) * dist;
          const sy = ty + Math.sin(sp.ang) * dist * 0.86;
          const sa = smoothstep(0.0, 0.05, age) * (1 - smoothstep(0.52, 1.0, age));
          const tailX = sx - Math.cos(sp.ang) * sp.len * sc * (1 - age * 0.5);
          const tailY = sy - Math.sin(sp.ang) * sp.len * sc * (1 - age * 0.5);

          px.line(tailX, tailY, sx, sy, sp.gold ? RGB.GOLD_AMBER : RGB.ICE_SKY, sa * 0.94, 4);
          px.line(tailX, tailY, sx, sy, sp.gold ? RGB.GOLD_CORE : RGB.PURE_WHITE, sa, 2, true);
          if (i % 3 === 0) {
            px.star4(sx, sy, sp.size * 1.2 * sc, sp.size * 0.3 * sc, RGB.PURE_WHITE, sp.gold ? RGB.GOLD_AMBER : RGB.ICE_ELEC, sa, sp.ang);
          } else if (i % 3 === 1) {
            px.diamondShard(sx, sy, sp.ang + age * 4, sp.size * sc, sp.gold ? CRYSTAL_GOLD_PAL : CRYSTAL_ICE_PAL, sa * 0.96);
          }
        }

        renderAmpImpactLayer(backCtx, px, frontCtx, tx, ty, impT, cfg.ampTier, cfg.seed);
      }
    }
  }

  /* ----------------------------------------------------------------------------
     9. wind_afterimage（风行残像 · 舒展双翡翠疾风气旋 + 3 枚一目了然青白剑舞残影）
     ---------------------------------------------------------------------------- */
  function createWindAfterimageData(cfg) {
    const rng = mulberry32(cfg.seed + 193);
    const windStars = [];
    for (let i = 0; i < 34; i++) {
      windStars.push({
        ang0: (i / 34) * Math.PI * 2,
        r: 48 + rng() * 126,
        yOff: (rng() - 0.5) * 145,
        speed: 2.0 + rng() * 2.5,
        vy: -24 - rng() * 34,
        size: 8.5 + rng() * 12,
        gold: i % 4 === 0,
        phase: rng() * Math.PI * 2,
      });
    }
    return { windStars };
  }

  function renderWindAfterimage(effect, backCtx, px, frontCtx) {
    const t = effect.elapsed / effect.duration;
    const cfg = effect.cfg;
    const sc = cfg.scale;
    const baseCx = cfg.caster.x + 74; // 向舞台中左舒展，给 3 枚残影留出优雅呼吸空间！
    const baseCy = cfg.caster.y - 8;
    const feetY = cfg.caster.feetY + 4;
    const data = effect.data;

    renderAmpCastLayer(backCtx, px, frontCtx, cfg.caster.x, cfg.caster.y, cfg.caster.feetY, t, cfg.ampTier, cfg.seed);

    const fadeAll = smoothstep(0.0, 0.10, t) * (1 - smoothstep(0.74, 1.0, t));
    if (fadeAll <= 0.004) return;
    const grow = EASE.outCubic(segT(t, 0.0, 0.28));

    // 柔和翡翠×青白地面与空间辉光
    drawGroundGlow(backCtx, baseCx, feetY, 178 * sc * grow, 44 * sc * grow, RGB.WIND_MINT, RGB.WIND_EMERALD, fadeAll * 0.5);
    drawLuminousHalo(backCtx, baseCx, baseCy, 154 * sc * grow, RGB.WIND_WHITE, RGB.WIND_MINT, RGB.WIND_JADE, fadeAll * 0.36);

    // 地面两道清风回旋环
    for (let k = 0; k < 2; k++) {
      const r = (84 + k * 44) * sc * grow;
      const rot = t * (5.2 + k) * (k % 2 === 0 ? 1 : -1);
      drawGlowShockRing(backCtx, baseCx, feetY - k * 8, r, r * 0.24, 3.0, k === 0 ? RGB.WIND_EMERALD : RGB.ICE_ELEC, RGB.PURE_WHITE, fadeAll * 0.68, 0);
      px.ring(baseCx, feetY - k * 8, r, r * 0.24, 3.0, k === 0 ? RGB.WIND_JADE : RGB.ICE_CYAN, fadeAll * 0.84, 0, rot, rot + Math.PI * 1.45);
    }

    // 两道丝滑缠绕的翡翠青×亮白疾风气旋（修长飘逸的双螺旋风带，先画背景段再画前景残影，层次极净！）
    for (let strand = 0; strand < 2; strand++) {
      const spine = [];
      const widths = [];
      const steps = 36;
      const phaseOffset = strand * Math.PI + t * 7.8;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        // 横向舒展 S 型跃动双螺旋，从主角身侧一路卷扬至前方空中
        const x = lerp(cfg.caster.x - 44 * sc, baseCx + 148 * sc, u) + Math.sin(u * Math.PI * 2.5 + phaseOffset) * 28 * sc * grow;
        const y = lerp(feetY - 6, baseCy - 86 * sc, u) + Math.cos(u * Math.PI * 2.8 + phaseOffset) * (36 + 18 * Math.sin(u * Math.PI)) * sc * grow;
        spine.push([x, y]);
        widths.push((7 + 20 * Math.sin(u * Math.PI)) * sc);
      }
      drawSoftTrail(backCtx, spine, 34 * sc, strand === 0 ? RGB.WIND_JADE : RGB.ICE_CYAN, fadeAll * 0.42);
      px.ribbon(
        spine,
        widths,
        strand === 0 ? RGB.WIND_EMERALD : RGB.ICE_ELEC,
        strand === 0 ? RGB.WIND_MINT : RGB.WIND_LIGHT,
        RGB.PURE_WHITE,
        fadeAll * 0.94,
        { rimCol: strand === 0 ? RGB.WIND_TEAL : RGB.ICE_COBALT, coreShift: 0.32 }
      );
    }

    // 3 枚清晰可数、层次分明的清透发光青白剑舞残影（左低 / 中高 / 右前跃斩，一眼数清 1-2-3！）
    const clones = [
      { x: cfg.caster.x + 28,  y: baseCy + 14, pose: 0, enter: 0.14, scale: 0.98, arcRot: -0.32, theme: 'wind' },
      { x: cfg.caster.x + 112, y: baseCy - 34, pose: 1, enter: 0.24, scale: 1.06, arcRot: 0.28,  theme: 'ice' },
      { x: cfg.caster.x + 194, y: baseCy + 2,  pose: 2, enter: 0.34, scale: 1.04, arcRot: -0.18, theme: 'wind' },
    ];
    for (let i = 0; i < clones.length; i++) {
      const cl = clones[i];
      const cIn = EASE.outBack(segT(t, cl.enter, cl.enter + 0.14));
      const cFade = smoothstep(cl.enter, cl.enter + 0.08, t) * (1 - smoothstep(0.68 + i * 0.04, 0.98, t));
      if (cFade <= 0.01) continue;

      const drift = Math.sin(t * 6.5 + i * 2.1) * 4;
      const gx = lerp(cfg.caster.x, cl.x, clamp(cIn, 0.35, 1.03));
      const gy = cl.y + drift;

      // 专属清透光晕衬底 + 清晰像素剑舞残影本体
      drawLuminousHalo(backCtx, gx, gy, 54 * sc, RGB.WIND_WHITE, i === 1 ? RGB.ICE_CYAN : RGB.WIND_JADE, RGB.WIND_EMERALD, cFade * 0.56);
      px.swordDancerSilhouette(gx, gy, cl.scale * sc, cl.pose, cFade, cl.theme);

      // 每枚残影身前的弯月剑舞风弧 + 剑尖星芒
      const swArc = buildCrescentArc(gx + 20 * sc, gy - 14 * sc, 56 * sc, 34 * sc, -1.68, 0.62, cl.arcRot, 16 * sc, 16);
      px.ribbon(swArc.pts, swArc.widths, i === 1 ? RGB.ICE_SKY : RGB.WIND_EMERALD, RGB.ICE_CYAN, RGB.PURE_WHITE, cFade * 0.94, { coreShift: 0.36 });
      drawCrossStarFlare(frontCtx, gx + 48 * sc, gy - 22 * sc, 38 * sc * cFade, t * 3 + i, i === 1 ? RGB.ICE_ELEC : RGB.WIND_EMERALD, RGB.PURE_WHITE, cFade * 0.96, false);
    }

    // 前景轻盈掠过的细流光风丝（把 3 枚清晰残影自然包融在疾风气旋中，绝不遮脸！）
    {
      const fgSpine = [];
      const fgW = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        const x = lerp(cfg.caster.x - 16 * sc, baseCx + 158 * sc, u);
        const y = lerp(feetY - 26 * sc, baseCy - 46 * sc, u) + Math.sin(u * Math.PI * 2.2 + t * 8.5) * 28 * sc * grow;
        fgSpine.push([x, y]);
        fgW.push((4 + 10 * Math.sin(u * Math.PI)) * sc);
      }
      px.ribbon(fgSpine, fgW, RGB.WIND_JADE, RGB.WIND_MINT, RGB.PURE_WHITE, fadeAll * 0.88);
    }

    // 飘散风星粒子（翡翠×香槟金×纯白）
    for (let i = 0; i < data.windStars.length; i++) {
      const ws = data.windStars[i];
      const ang = ws.ang0 + t * ws.speed;
      const sx = baseCx + Math.cos(ang) * ws.r * sc * grow;
      const sy = baseCy + ws.yOff * sc + Math.sin(ang) * 26 * sc + ws.vy * t;
      const tw = 0.5 + 0.5 * Math.sin(t * 16 + ws.phase);
      if (i % 3 === 0) {
        drawCrossStarFlare(frontCtx, sx, sy, ws.size * 1.45 * sc, ang, ws.gold ? RGB.GOLD_AMBER : RGB.WIND_EMERALD, RGB.PURE_WHITE, fadeAll * tw * 0.94, false);
      } else {
        px.star4(sx, sy, ws.size * 0.65 * sc, ws.size * 0.18 * sc, RGB.PURE_WHITE, ws.gold ? RGB.GOLD_SUN : RGB.WIND_JADE, fadeAll * tw * 0.96, ang);
      }
    }

    const burstU = EASE.outCubic(segT(t, 0.38, 0.78));
    if (burstU > 0 && burstU < 1) {
      drawGlowShockRing(frontCtx, baseCx + 24, baseCy - 8, (54 + 114 * burstU) * sc, (36 + 76 * burstU) * sc, 4.2, RGB.WIND_EMERALD, RGB.PURE_WHITE, (1 - burstU) * 0.85, -0.14);
    }

    if (cfg.ampTier > 0) {
      renderAmpImpactLayer(backCtx, px, frontCtx, baseCx + 24, baseCy - 8, segT(t, 0.34, 0.90), cfg.ampTier, cfg.seed);
    }
  }

  /* -------------------- 9 招分发注册表 -------------------- */
  const SKILL_HANDLERS = {
    ice_crystal: { init: createIceCrystalData, render: renderIceCrystal },
    tri_prism_ice: { init: createTriPrismData, render: renderTriPrismIce },
    starfrost_scatter: { init: createStarfrostData, render: renderStarfrostScatter },
    raging_surge: { init: createRagingSurgeData, render: renderRagingSurge },
    water_cleave: { init: createWaterCleaveData, render: renderWaterCleave },
    frost_thorn_field: { init: createFrostThornData, render: renderFrostThornField },
    steel_ice_curtain: { init: createSteelIceData, render: renderSteelIceCurtain },
    sword_send_slash: { init: createSwordSendData, render: renderSwordSendSlash },
    wind_afterimage: { init: createWindAfterimageData, render: renderWindAfterimage },
  };

  /* ============================================================================
     实例工厂 create(canvas)
     ============================================================================ */
  function create(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('VfxEditionB.create(canvas) requires a valid HTMLCanvasElement');
    }
    const ctx = canvas.getContext('2d');
    const px = createPixelBuffer();

    const backCanvas = document.createElement('canvas');
    backCanvas.width = LOGICAL_W;
    backCanvas.height = LOGICAL_H;
    const backCtx = backCanvas.getContext('2d');

    const frontCanvas = document.createElement('canvas');
    frontCanvas.width = LOGICAL_W;
    frontCanvas.height = LOGICAL_H;
    const frontCtx = frontCanvas.getContext('2d');

    let effects = [];

    function getDuration(skillId) {
      const meta = SKILL_MAP[skillId];
      return meta ? meta.duration : 1500;
    }

    function clear() {
      effects = [];
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      px.clear();
      backCtx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
      frontCtx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    function play(skillId, opts) {
      const handler = SKILL_HANDLERS[skillId];
      if (!handler) {
        throw new Error('VfxEditionB: unknown skillId "' + skillId + '"');
      }
      const o = opts || {};
      if (o.clearExisting !== false && o.additive !== true) {
        effects = [];
      }
      const cfg = normalizeOpts(skillId, o);
      const duration = typeof o.duration === 'number' && o.duration > 0 ? o.duration : getDuration(skillId);
      const effect = {
        skillId,
        cfg,
        duration,
        elapsed: 0,
        handler,
        data: handler.init(cfg),
      };
      effects.push(effect);
      return effect;
    }

    function update(dtMs) {
      const dt = Number.isFinite(dtMs) ? clamp(dtMs, 0, 100) : 16.6667;
      for (let i = effects.length - 1; i >= 0; i--) {
        effects[i].elapsed += dt;
        if (effects[i].elapsed >= effects[i].duration) {
          effects.splice(i, 1);
        }
      }
    }

    function seek(timeMs) {
      const t = Math.max(0, Number(timeMs) || 0);
      for (let i = 0; i < effects.length; i++) {
        effects[i].elapsed = clamp(t, 0, effects[i].duration - 0.001);
      }
    }

    function render() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (effects.length === 0) {
        ctx.restore();
        return;
      }

      backCtx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
      frontCtx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
      px.clear();

      for (let i = 0; i < effects.length; i++) {
        const eff = effects[i];
        eff.handler.render(eff, backCtx, px, frontCtx);
      }
      px.commit();

      const scaleX = canvas.width / LOGICAL_W;
      const scaleY = canvas.height / LOGICAL_H;
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

      // Layer 1: 后置柔和晶体辉光与地面倒影层
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(backCanvas, 0, 0, LOGICAL_W, LOGICAL_H);

      // Layer 2: 零锯齿 320×180 像素晶面核心层（2× 整数硬边缘放大）
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(px.canvas, 0, 0, PW, PH, 0, 0, LOGICAL_W, LOGICAL_H);

      // Layer 3: 前置锐利亮白十字星芒、膨胀冲击波环与增幅金环层
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(frontCanvas, 0, 0, LOGICAL_W, LOGICAL_H);

      ctx.restore();
    }

    function isActive() {
      return effects.length > 0;
    }

    return {
      play,
      update,
      render,
      clear,
      isActive,
      getDuration,
      seek,
    };
  }

  /* -------------------- 导出全局对象 -------------------- */
  global.VfxEditionB = {
    meta: {
      id: 'edition_b',
      name: '方案 B · 星之海高亮像素辉光版',
      subtitle: '饱满大气的水晶像素切面 + 清透晶体柔光与十字星芒，绝不发灰发暗',
      styleTag: 'HD-2D 高亮像素 · 晶透柔光',
      palette: ['#0EA5E9', '#38BDF8', '#67E8F9', '#FEF08A', '#34D399'],
    },
    SKILLS: SKILLS.slice(),
    create,
  };
})(typeof window !== 'undefined' ? window : globalThis);
