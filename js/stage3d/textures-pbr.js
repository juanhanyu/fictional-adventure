/**
 * Procedural PBR Texture & Material Library for 《转生千金》 HD-2D 3D Battle Stage
 *
 * Pure browser ES Module, zero external dependencies.
 * Generates seamless high-resolution diffuse (`map`), true Sobel tangent-space
 * `normalMap`, physical `roughnessMap`, `emissiveMap`, translucent floor decals,
 * gothic stained glass, hanging academy banners, volumetric cloud FBM noise,
 * and anti-banded Gaussian glow discs.
 *
 * Palette identity:
 *   Snow-porcelain alabaster · Royal Blue (#1658eb) · Ice Cyan (#5fd4ff) · Champagne Gold (#f0c975)
 */

// ---------------------------------------------------------------------------
// Deterministic Hash, PRNG, Math & Periodic Seamless 2D Noise Utilities
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function fract(x) {
  return x - Math.floor(x);
}

/**
 * Deterministic 32-bit integer spatial hash -> [0, 1)
 */
function hash2i(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Deterministic Mulberry32 PRNG for vector/decorative details
 */
function createRNG(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Precomputed padded periodic 2D value-noise lattice table for O(1) zero-hash sampling.
 * Dimensions are (px + 1) x (py + 1) with wrapped seam edges so bilinear corners
 * are contiguous without boundary modulo inside pixel loops.
 */
function createPeriodicNoiseGrid(px, py, seed) {
  const stride = px + 1;
  const table = new Float32Array(stride * (py + 1));
  for (let y = 0; y < py; y++) {
    const rowOff = y * stride;
    for (let x = 0; x < px; x++) {
      table[rowOff + x] = hash2i(x, y, seed);
    }
    table[rowOff + px] = table[rowOff];
  }
  const lastRow = py * stride;
  for (let x = 0; x <= px; x++) {
    table[lastRow + x] = table[x];
  }

  const isPow2X = (px & (px - 1)) === 0;
  const isPow2Y = (py & (py - 1)) === 0;
  const mx = px - 1;
  const my = py - 1;

  function sample(u, v) {
    const x = u * px;
    const y = v * py;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;

    // Quintic Hermite interpolation prevents grid-axis creases in Sobel normal maps
    const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

    const ix0 = isPow2X ? (x0 & mx) : ((x0 % px) + px) % px;
    const iy0 = isPow2Y ? (y0 & my) : ((y0 % py) + py) % py;
    const idx = iy0 * stride + ix0;

    const n00 = table[idx];
    const n01 = table[idx + stride];
    const nx0 = n00 + (table[idx + 1] - n00) * sx;
    const nx1 = n01 + (table[idx + stride + 1] - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  return { px, py, mx, my, stride, table, isPow2X, isPow2Y, sample };
}

/**
 * Seamless multi-octave periodic FBM / ridged FBM backed by precomputed padded lattice tables
 * (lacunarity = 2 guarantees exact integer periods).
 */
function createPeriodicFBM(basePx, basePy, octaves, gain, seed, ridged = false) {
  const grids = new Array(octaves);
  const weights = new Float32Array(octaves);
  let amp = 0.5;
  let norm = 0;
  let px = basePx;
  let py = basePy;
  const seedStep = ridged ? 131 : 97;

  for (let o = 0; o < octaves; o++) {
    grids[o] = createPeriodicNoiseGrid(px, py, seed + o * seedStep);
    weights[o] = amp;
    norm += amp;
    amp *= gain;
    px <<= 1;
    py <<= 1;
  }

  const invNorm = 1 / norm;
  for (let o = 0; o < octaves; o++) {
    weights[o] *= invNorm;
  }

  const allPow2 = grids.every((g) => g.isPow2X && g.isPow2Y);

  if (allPow2 && !ridged) {
    if (octaves === 1) {
      return grids[0].sample;
    }
    return function sampleFBM(u, v) {
      let sum = 0;
      for (let o = 0; o < octaves; o++) {
        const g = grids[o];
        const x = u * g.px;
        const y = v * g.py;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
        const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        const idx = (y0 & g.my) * g.stride + (x0 & g.mx);
        const t = g.table;
        const n00 = t[idx];
        const n01 = t[idx + g.stride];
        const nx0 = n00 + (t[idx + 1] - n00) * sx;
        const nx1 = n01 + (t[idx + g.stride + 1] - n01) * sx;
        sum += weights[o] * (nx0 + (nx1 - nx0) * sy);
      }
      return sum;
    };
  }

  if (allPow2 && ridged) {
    return function sampleRidged(u, v) {
      let sum = 0;
      for (let o = 0; o < octaves; o++) {
        const g = grids[o];
        const x = u * g.px;
        const y = v * g.py;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
        const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        const idx = (y0 & g.my) * g.stride + (x0 & g.mx);
        const t = g.table;
        const n00 = t[idx];
        const n01 = t[idx + g.stride];
        const nx0 = n00 + (t[idx + 1] - n00) * sx;
        const nx1 = n01 + (t[idx + g.stride + 1] - n01) * sx;
        const n = nx0 + (nx1 - nx0) * sy;
        const r = 1 - Math.abs(n * 2 - 1);
        sum += weights[o] * r * r;
      }
      return sum;
    };
  }

  return function sampleGeneric(u, v) {
    let sum = 0;
    for (let o = 0; o < octaves; o++) {
      let n = grids[o].sample(u, v);
      if (ridged) {
        const r = 1 - Math.abs(n * 2 - 1);
        n = r * r;
      }
      sum += weights[o] * n;
    }
    return sum;
  };
}

/**
 * Precomputed padded seamless periodic 2D Worley/Voronoi cellular field.
 * Uses a (px + 2) x (py + 2) wrapped lookup grid so 3x3 neighbor scans have
 * zero modulo or branch overhead, plus a dedicated F1-only fast path.
 */
function createPeriodicWorley(px, py, seed, jitter = 0.72) {
  const baseCount = px * py;
  const bJx = new Float32Array(baseCount);
  const bJy = new Float32Array(baseCount);
  const bTx = new Float32Array(baseCount);
  const bTy = new Float32Array(baseCount);
  const bTone = new Float32Array(baseCount);

  const pad = (1 - jitter) * 0.5;
  for (let cy = 0; cy < py; cy++) {
    for (let cx = 0; cx < px; cx++) {
      const idx = cy * px + cx;
      bJx[idx] = pad + hash2i(cx, cy, seed + 11) * jitter;
      bJy[idx] = pad + hash2i(cx, cy, seed + 29) * jitter;
      bTx[idx] = (hash2i(cx, cy, seed + 53) * 2 - 1) * 0.44;
      bTy[idx] = (hash2i(cx, cy, seed + 79) * 2 - 1) * 0.44;
      bTone[idx] = hash2i(cx, cy, seed + 107);
    }
  }

  const stride = px + 2;
  const total = stride * (py + 2);
  const jx = new Float32Array(total);
  const jy = new Float32Array(total);
  const tiltX = new Float32Array(total);
  const tiltY = new Float32Array(total);
  const tone = new Float32Array(total);
  const cellId = new Int32Array(total);

  for (let gy = 0; gy < py + 2; gy++) {
    const cy = (gy - 1 + py) % py;
    const dstRow = gy * stride;
    const srcRow = cy * px;
    for (let gx = 0; gx < px + 2; gx++) {
      const cx = (gx - 1 + px) % px;
      const dst = dstRow + gx;
      const src = srcRow + cx;
      jx[dst] = bJx[src];
      jy[dst] = bJy[src];
      tiltX[dst] = bTx[src];
      tiltY[dst] = bTy[src];
      tone[dst] = bTone[src];
      cellId[dst] = src;
    }
  }

  const isPow2X = (px & (px - 1)) === 0;
  const isPow2Y = (py & (py - 1)) === 0;
  const mx = px - 1;
  const my = py - 1;

  const out = {
    f1: 0,
    f2: 0,
    edge: 0,
    dx: 0,
    dy: 0,
    cellId: 0,
    tone: 0,
    planeH: 0.5,
  };

  function wrapCenterIdx(ix, iy) {
    let cx, cy;
    if (isPow2X) {
      cx = ix & mx;
    } else {
      cx = ix % px;
      if (cx < 0) cx += px;
    }
    if (isPow2Y) {
      cy = iy & my;
    } else {
      cy = iy % py;
      if (cy < 0) cy += py;
    }
    return (cy + 1) * stride + (cx + 1);
  }

  function sample(u, v) {
    const x = u * px;
    const y = v * py;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const cIdx = wrapCenterIdx(ix, iy);
    let d1 = 1e9;
    let d2 = 1e9;
    let bestDx = 0;
    let bestDy = 0;
    let bestIdx = cIdx;

    for (let oy = -1; oy <= 1; oy++) {
      const rowIdx = cIdx + oy * stride;
      const fyO = fy - oy;
      for (let ox = -1; ox <= 1; ox++) {
        const idx = rowIdx + ox;
        const dx = fx - ox - jx[idx];
        const dy = fyO - jy[idx];
        const dSq = dx * dx + dy * dy;

        if (dSq < d1) {
          d2 = d1;
          d1 = dSq;
          bestDx = dx;
          bestDy = dy;
          bestIdx = idx;
        } else if (dSq < d2) {
          d2 = dSq;
        }
      }
    }

    const r1 = Math.sqrt(d1);
    const r2 = Math.sqrt(d2);
    out.f1 = r1;
    out.f2 = r2;
    out.edge = r2 - r1;
    out.dx = bestDx;
    out.dy = bestDy;
    out.cellId = cellId[bestIdx];
    out.tone = tone[bestIdx];
    out.planeH = clamp(0.62 + bestDx * tiltX[bestIdx] + bestDy * tiltY[bestIdx], 0.24, 0.96);
    return out;
  }

  function sampleF1(u, v) {
    const x = u * px;
    const y = v * py;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const cIdx = wrapCenterIdx(ix, iy);
    let d1 = 1e9;

    for (let oy = -1; oy <= 1; oy++) {
      const rowIdx = cIdx + oy * stride;
      const fyO = fy - oy;
      for (let ox = -1; ox <= 1; ox++) {
        const idx = rowIdx + ox;
        const dx = fx - ox - jx[idx];
        const dy = fyO - jy[idx];
        const dSq = dx * dx + dy * dy;
        if (dSq < d1) d1 = dSq;
      }
    }
    return Math.sqrt(d1);
  }

  return { sample, sampleF1 };
}

// ---------------------------------------------------------------------------
// Canvas & Sobel Tangent-Space Normal Map Utilities
// ---------------------------------------------------------------------------

function createCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Converts a scalar heightfield (Float32Array of length w * h in [0, 1])
 * into an OpenGL / Three.js tangent-space normal map canvas via a 3x3 Sobel filter.
 *
 * Convention (Three.js flipY = true, TangentSpaceNormalMap):
 *   +X (Red > 128)   = surface normal pointing right (+U)
 *   +Y (Green > 128) = surface normal pointing up (+V, toward canvas y = 0)
 *   +Z (Blue > 128)  = surface normal pointing outward (+N)
 */
export function heightToNormalCanvas(heightData, w, h, strength = 3.0, wrap = true) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const dst = img.data;

  const scale = strength * 0.25;

  for (let y = 0; y < h; y++) {
    const ym = wrap ? (y === 0 ? h - 1 : y - 1) : (y === 0 ? 0 : y - 1);
    const yp = wrap ? (y === h - 1 ? 0 : y + 1) : (y === h - 1 ? h - 1 : y + 1);
    const rowM = ym * w;
    const rowC = y * w;
    const rowP = yp * w;

    for (let x = 0; x < w; x++) {
      const xm = wrap ? (x === 0 ? w - 1 : x - 1) : (x === 0 ? 0 : x - 1);
      const xp = wrap ? (x === w - 1 ? 0 : x + 1) : (x === w - 1 ? w - 1 : x + 1);

      const tl = heightData[rowM + xm];
      const tm = heightData[rowM + x];
      const tr = heightData[rowM + xp];
      const ml = heightData[rowC + xm];
      const mr = heightData[rowC + xp];
      const bl = heightData[rowP + xm];
      const bm = heightData[rowP + x];
      const br = heightData[rowP + xp];

      // Sobel finite differences: gx = right - left, gy = bottom - top
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bm + br) - (tl + 2 * tm + tr);

      // Canvas +y points down (-V), so +ny = +gy aligns normal Y with UV +V
      let nx = -gx * scale;
      let ny = gy * scale;
      let nz = 1.0;

      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const p = (rowC + x) << 2;
      dst[p] = (nx * 127.5 + 127.5 + 0.5) | 0;
      dst[p + 1] = (ny * 127.5 + 127.5 + 0.5) | 0;
      dst[p + 2] = (nz * 127.5 + 127.5 + 0.5) | 0;
      dst[p + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Helper to create and register a configured THREE.CanvasTexture
 */
function makeTextureFactory(THREE, registry) {
  return function createTex(canvas, { isColor = false, repeat = false, anisotropy = 4 } = {}) {
    const tex = new THREE.CanvasTexture(canvas);
    if (isColor) {
      if (THREE.SRGBColorSpace) {
        tex.colorSpace = THREE.SRGBColorSpace;
      }
    } else if (THREE.NoColorSpace) {
      tex.colorSpace = THREE.NoColorSpace;
    }
    const wrapMode = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapS = wrapMode;
    tex.wrapT = wrapMode;
    tex.anisotropy = anisotropy;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    registry.push(tex);
    return tex;
  };
}

// ---------------------------------------------------------------------------
// 1. courtyardStone — 256x256 Royal Snow-Porcelain Limestone Flagstones
// ---------------------------------------------------------------------------

function buildCourtyardStone(createTex) {
  const w = 256;
  const h = 256;
  const invW = 1 / w;
  const invH = 1 / h;

  const mapCanvas = createCanvas(w, h);
  const mapCtx = mapCanvas.getContext('2d');
  const mapImg = mapCtx.createImageData(w, h);
  const mapDst = mapImg.data;

  const roughCanvas = createCanvas(w, h);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(w, h);
  const roughDst = roughImg.data;

  const height = new Float32Array(w * h);

  // Staggered seamless ashlar course split points per row (4 rows x 4 stones)
  const rowSplits = [
    [0.02, 0.29, 0.56, 0.80],
    [0.14, 0.41, 0.68, 0.91],
    [0.06, 0.34, 0.60, 0.85],
    [0.19, 0.47, 0.73, 0.95],
  ];

  // Precompute subtle per-stone porcelain limestone palettes & tilts
  const stoneTintR = new Float32Array(16);
  const stoneTintG = new Float32Array(16);
  const stoneTintB = new Float32Array(16);
  const stoneElev = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    const h1 = hash2i(i, 7, 101);
    const h2 = hash2i(i, 19, 203);
    const h3 = hash2i(i, 31, 307);
    // Snow-porcelain pale grey-white royal limestone variation
    stoneTintR[i] = 205 + h1 * 20 - h2 * 6;
    stoneTintG[i] = 213 + h1 * 18 - h2 * 3;
    stoneTintB[i] = 224 + h1 * 15 + h2 * 6;
    stoneElev[i] = (h3 - 0.5) * 0.085;
  }

  // Precomputed fast periodic lattice samplers
  const warpXNoise = createPeriodicNoiseGrid(8, 8, 1101).sample;
  const warpYNoise = createPeriodicNoiseGrid(8, 8, 1207).sample;
  const chipNoise = createPeriodicNoiseGrid(32, 32, 1303).sample;
  const macroWeatherFBM = createPeriodicFBM(4, 4, 3, 0.55, 1409);
  const medGrainFBM = createPeriodicFBM(16, 16, 2, 0.52, 1511);
  const fineSpeckNoise = createPeriodicNoiseGrid(64, 64, 1607).sample;
  const snowFBM = createPeriodicFBM(8, 8, 2, 0.55, 1811);
  const frostFBM = createPeriodicFBM(4, 4, 3, 0.54, 1913);

  const mortarHalf = 0.0072;
  const bevelWidth = 0.021;

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowBase = y * w;

    for (let x = 0; x < w; x++) {
      const u = x * invW;

      // Gentle domain warp along chisel edges so joints look hand-dressed
      const wx = warpXNoise(u, v) - 0.5;
      const wy = warpYNoise(u, v) - 0.5;
      const uw = fract(u + wx * 0.0095);
      const vw = fract(v + wy * 0.0095);

      const vScaled = vw * 4.0;
      const rowIdx = Math.floor(vScaled) & 3;
      const localV = vScaled - Math.floor(vScaled);
      const distY = Math.min(localV, 1.0 - localV) * 0.25;

      const splits = rowSplits[rowIdx];
      let segIdx, left, right;
      if (uw < splits[0]) {
        segIdx = 3;
        left = splits[3] - 1.0;
        right = splits[0];
      } else if (uw < splits[1]) {
        segIdx = 0;
        left = splits[0];
        right = splits[1];
      } else if (uw < splits[2]) {
        segIdx = 1;
        left = splits[1];
        right = splits[2];
      } else if (uw < splits[3]) {
        segIdx = 2;
        left = splits[2];
        right = splits[3];
      } else {
        segIdx = 3;
        left = splits[3];
        right = splits[0] + 1.0;
      }

      const distX = Math.min(uw - left, right - uw);
      const stoneId = (rowIdx << 2) + segIdx;

      // Chiseled edge micro-chipping along stone boundaries
      const chip = (chipNoise(u, v) - 0.5) * 0.0042;
      const ex = smoothstep(mortarHalf + chip, mortarHalf + bevelWidth, distX);
      const ey = smoothstep(mortarHalf + chip, mortarHalf + bevelWidth, distY);
      const slabMask = ex * ey;

      // Fine granite mineral grain + broader weathering clouds
      const macroWeather = macroWeatherFBM(u, v);
      const medGrain = medGrainFBM(u, v);
      const fineSpeck = fineSpeckNoise(u, v);
      const microQuartz = hash2i(x, y, 1709);

      // Granite dark/light mineral flecks
      const darkFleck = fineSpeck < 0.16 ? (0.16 - fineSpeck) * 4.5 : 0;
      const micaGlint = microQuartz > 0.87 ? (microQuartz - 0.87) * 5.0 : 0;

      // Thin snow tucked naturally into recessed mortar seams & corner pockets
      let snowInSeam = 0;
      if (slabMask < 0.995) {
        const snowNoise = snowFBM(u, v);
        const creviceFactor = 1.0 - slabMask;
        const cornerBoost = (1.0 - ex) * (1.0 - ey) * 0.42;
        snowInSeam = smoothstep(
          0.24,
          0.64,
          creviceFactor * (0.68 + snowNoise * 0.65) + cornerBoost * snowNoise
        );
      }

      // Localized reflective frost / thin ice glaze patches across flagstones
      let frostMask = 0;
      if (slabMask > 0.002) {
        const frostField = frostFBM(u, v);
        frostMask = smoothstep(0.56, 0.72, frostField + (medGrain - 0.5) * 0.12) * slabMask;
      }

      // Height calculation (0..1)
      const slabSurface =
        0.74 +
        stoneElev[stoneId] +
        (macroWeather - 0.5) * 0.075 +
        (medGrain - 0.5) * 0.055 +
        (fineSpeck - 0.5) * 0.025 -
        darkFleck * 0.03;
      const mortarFloor = 0.18 + medGrain * 0.08 + snowInSeam * 0.19;
      let hVal = lerp(mortarFloor, slabSurface, slabMask);
      // Frost glaze subtly levels micro-roughness into glassy skim
      hVal = lerp(hVal, 0.80 + stoneElev[stoneId] * 0.6, frostMask * 0.45);
      height[rowBase + x] = clamp01(hVal);

      // Albedo color: mortar slate -> snow-porcelain limestone -> seam snow -> ice frost glaze
      let r = stoneTintR[stoneId] + (macroWeather - 0.5) * 18 + (medGrain - 0.5) * 14 - darkFleck * 46 + micaGlint * 18;
      let g = stoneTintG[stoneId] + (macroWeather - 0.5) * 16 + (medGrain - 0.5) * 13 - darkFleck * 42 + micaGlint * 19;
      let b = stoneTintB[stoneId] + (macroWeather - 0.5) * 15 + (medGrain - 0.5) * 12 - darkFleck * 34 + micaGlint * 22;

      // Subtle bevel edge brightening (chiseled limestone catches pale crisp highlights)
      const bevelRim = slabMask * (1.0 - slabMask) * 4.0;
      r += bevelRim * 11;
      g += bevelRim * 12;
      b += bevelRim * 14;

      // Mortar joint cool slate recess
      const mortarR = 124 + medGrain * 18;
      const mortarG = 136 + medGrain * 18;
      const mortarB = 156 + medGrain * 20;
      r = lerp(mortarR, r, slabMask);
      g = lerp(mortarG, g, slabMask);
      b = lerp(mortarB, b, slabMask);

      // Drifted powdery frost-snow inside mortar joints
      r = lerp(r, 236 + fineSpeck * 14, snowInSeam * 0.88);
      g = lerp(g, 243 + fineSpeck * 10, snowInSeam * 0.88);
      b = lerp(b, 253, snowInSeam * 0.90);

      // Localized translucent glacial frost patches on top of tiles
      r = lerp(r, 218 + micaGlint * 24, frostMask * 0.46);
      g = lerp(g, 236 + micaGlint * 18, frostMask * 0.50);
      b = lerp(b, 252, frostMask * 0.56);

      // Physical roughness: matte weathered limestone vs rough seams vs glossy frost glaze
      let rough = lerp(0.93, 0.72 + (medGrain - 0.5) * 0.16 + darkFleck * 0.14 - micaGlint * 0.22, slabMask);
      rough = lerp(rough, 0.84, snowInSeam * 0.72);
      rough = lerp(rough, 0.15 + fineSpeck * 0.12, frostMask * 0.92);
      const roughByte = (clamp01(rough) * 255 + 0.5) | 0;

      const p = (rowBase + x) << 2;
      mapDst[p] = clamp(r, 0, 255) | 0;
      mapDst[p + 1] = clamp(g, 0, 255) | 0;
      mapDst[p + 2] = clamp(b, 0, 255) | 0;
      mapDst[p + 3] = 255;

      roughDst[p] = roughByte;
      roughDst[p + 1] = roughByte;
      roughDst[p + 2] = roughByte;
      roughDst[p + 3] = 255;
    }
  }

  mapCtx.putImageData(mapImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(height, w, h, 3.6, true);

  return {
    map: createTex(mapCanvas, { isColor: true, repeat: true }),
    normalMap: createTex(normalCanvas, { isColor: false, repeat: true }),
    roughnessMap: createTex(roughCanvas, { isColor: false, repeat: true }),
  };
}

// ---------------------------------------------------------------------------
// 2. marble — 256x256 Ivory Snow-Porcelain Marble + Ice-Blue Veins & Gold Inlay
// ---------------------------------------------------------------------------

function buildMarble(createTex) {
  const w = 256;
  const h = 256;
  const invW = 1 / w;
  const invH = 1 / h;

  const mapCanvas = createCanvas(w, h);
  const mapCtx = mapCanvas.getContext('2d');
  const mapImg = mapCtx.createImageData(w, h);
  const mapDst = mapImg.data;

  const roughCanvas = createCanvas(w, h);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(w, h);
  const roughDst = roughImg.data;

  const height = new Float32Array(w * h);

  // Precomputed fast periodic lattice samplers (3-octave high-contrast veining)
  const warpXFBM = createPeriodicFBM(4, 4, 3, 0.55, 2101);
  const warpYFBM = createPeriodicFBM(4, 4, 3, 0.55, 2203);
  const fineRidgeFBM = createPeriodicFBM(8, 8, 3, 0.52, 2411, true);
  const polishFBM = createPeriodicFBM(8, 8, 2, 0.5, 2609);

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowBase = y * w;

    // Classical fine horizontal champagne-gold inlay lines (seamless wrap on columns & walls)
    const dBandTop = Math.abs(v - 0.082);
    const dBandBot = Math.abs(v - 0.918);
    const dBandSubTop = Math.abs(v - 0.112);
    const dBandSubBot = Math.abs(v - 0.888);

    const primaryGoldDist = Math.min(dBandTop, dBandBot);
    const hairGoldDist = Math.min(dBandSubTop, dBandSubBot);

    const primaryGold = 1.0 - smoothstep(0.0028, 0.0064, primaryGoldDist);
    const hairGold = 1.0 - smoothstep(0.0018, 0.0042, hairGoldDist);
    const goldGroove =
      (1.0 - smoothstep(0.0054, 0.0110, primaryGoldDist)) * (1.0 - primaryGold) +
      (1.0 - smoothstep(0.0032, 0.0068, hairGoldDist)) * (1.0 - hairGold) * 0.65;

    const betweenBands =
      smoothstep(0.084, 0.090, v) * (1.0 - smoothstep(0.104, 0.110, v)) +
      smoothstep(0.890, 0.896, v) * (1.0 - smoothstep(0.910, 0.916, v));

    for (let x = 0; x < w; x++) {
      const u = x * invW;

      // Seamless diagonal domain-warped calcite marble veining
      const warpX = warpXFBM(u, v);
      const warpY = warpYFBM(u, v);
      const uw = u + (warpX - 0.5) * 0.24;
      const vw = v + (warpY - 0.5) * 0.24;

      // Seamless integer-harmonic phase (2u + v wraps cleanly mod 1)
      const phase = (u * 2.0 + v) * Math.PI * 2.0 + (warpX * 2.6 + warpY * 1.8) * Math.PI;
      const primaryVeinRaw = 1.0 - Math.abs(Math.sin(phase));
      const v2 = primaryVeinRaw * primaryVeinRaw;
      const v4 = v2 * v2;
      const primaryVein = v4 * v4 * v2;

      // Subtle ivory-porcelain warmth/coolness mineral clouding
      const polishCloud = polishFBM(u, v);

      // Soft cloudy mineral halo around primary veins
      const cloudHalo = v2 * Math.sqrt(primaryVeinRaw) * (0.4 + polishCloud * 0.6);

      // Secondary crisp hairline mineral fissures
      const fineRidge = fineRidgeFBM(uw, vw);
      const secBase = clamp01((fineRidge - 0.54) * 2.3);
      const secondaryVein = secBase * secBase;

      // Ultra-delicate golden mineral trace inside occasional secondary cracks
      const goldVein = secondaryVein * smoothstep(0.56, 0.78, warpY) * 0.52;

      // Subtle architectural vertical marble joint hairline at u = 0 / 0.5
      const seamU = Math.min(fract(u * 2.0), 1.0 - fract(u * 2.0)) * 0.5;
      const archJoint = 1.0 - smoothstep(0.0016, 0.0046, seamU);

      // Delicate champagne-gold geometric ticks along the horizontal inlay collar
      let goldDiamondTick = 0;
      if (betweenBands > 0.001) {
        const tickDist = Math.abs(fract(u * 16.0) - 0.5);
        goldDiamondTick = betweenBands * (1.0 - smoothstep(0.04, 0.13, tickDist)) * 0.78;
      }

      const goldInlay = clamp01(Math.max(primaryGold, hairGold * 0.88, goldDiamondTick));

      // Ivory snow-porcelain base (#f6f7fb / #eff2f8)
      let r = 243 + (polishCloud - 0.5) * 10;
      let g = 245 + (polishCloud - 0.5) * 9;
      let b = 250 + (polishCloud - 0.5) * 8;

      // Pale cool mist-blue calcite clouding
      r = lerp(r, 214, cloudHalo * 0.42);
      g = lerp(g, 226, cloudHalo * 0.36);
      b = lerp(b, 241, cloudHalo * 0.24);

      // Primary ice-blue / pale slate veins
      r = lerp(r, 154, primaryVein * 0.62);
      g = lerp(g, 179, primaryVein * 0.54);
      b = lerp(b, 212, primaryVein * 0.42);

      // Secondary crisp silver-ice hairlines
      r = lerp(r, 172, secondaryVein * 0.46);
      g = lerp(g, 193, secondaryVein * 0.40);
      b = lerp(b, 222, secondaryVein * 0.30);

      // Subtle warm champagne-gold mineral veins
      r = lerp(r, 232, goldVein);
      g = lerp(g, 200, goldVein);
      b = lerp(b, 122, goldVein);

      // Recessed edge shadow around inlay & architectural panel joint
      const grooveShade = clamp01(goldGroove * 0.55 + archJoint * 0.45);
      r = lerp(r, 186, grooveShade * 0.48);
      g = lerp(g, 196, grooveShade * 0.45);
      b = lerp(b, 212, grooveShade * 0.40);

      // Burnished champagne-gold decorative inlay lines (#f0c975 with crisp sheen)
      if (goldInlay > 0.001) {
        const goldShimmer = 0.92 + 0.14 * Math.sin(u * Math.PI * 16.0 + polishCloud * 3.0);
        r = lerp(r, clamp(238 * goldShimmer, 0, 255), goldInlay);
        g = lerp(g, clamp(202 * goldShimmer, 0, 255), goldInlay);
        b = lerp(b, clamp(122 * goldShimmer, 0, 255), goldInlay);
      }

      // Heightfield: ultra-sleek honed stone with delicate vein micro-relief & carved inlay bevel
      const hVal =
        0.72 +
        (polishCloud - 0.5) * 0.035 -
        primaryVein * 0.045 -
        secondaryVein * 0.035 -
        archJoint * 0.12 -
        goldGroove * 0.11 +
        goldInlay * 0.045;
      height[rowBase + x] = clamp01(hVal);

      // Roughness: polished porcelain marble (0.16..0.28), calcite veins (0.36), burnished gold (0.13)
      let rough = 0.20 + (polishCloud - 0.5) * 0.07 + primaryVein * 0.15 + secondaryVein * 0.12;
      rough = lerp(rough, 0.58, grooveShade * 0.8);
      rough = lerp(rough, 0.13, goldInlay);
      const roughByte = (clamp01(rough) * 255 + 0.5) | 0;

      const p = (rowBase + x) << 2;
      mapDst[p] = clamp(r, 0, 255) | 0;
      mapDst[p + 1] = clamp(g, 0, 255) | 0;
      mapDst[p + 2] = clamp(b, 0, 255) | 0;
      mapDst[p + 3] = 255;

      roughDst[p] = roughByte;
      roughDst[p + 1] = roughByte;
      roughDst[p + 2] = roughByte;
      roughDst[p + 3] = 255;
    }
  }

  mapCtx.putImageData(mapImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(height, w, h, 1.9, true);

  return {
    map: createTex(mapCanvas, { isColor: true, repeat: true }),
    normalMap: createTex(normalCanvas, { isColor: false, repeat: true }),
    roughnessMap: createTex(roughCanvas, { isColor: false, repeat: true }),
  };
}

// ---------------------------------------------------------------------------
// 3. iceCrystal — 256x256 Translucent Faceted Ice Crystal + Internal Star Glow
// ---------------------------------------------------------------------------

function buildIceCrystal(createTex) {
  const w = 256;
  const h = 256;
  const invW = 1 / w;
  const invH = 1 / h;

  const mapCanvas = createCanvas(w, h);
  const mapCtx = mapCanvas.getContext('2d');
  const mapImg = mapCtx.createImageData(w, h);
  const mapDst = mapImg.data;

  const roughCanvas = createCanvas(w, h);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(w, h);
  const roughDst = roughImg.data;

  const emisCanvas = createCanvas(w, h);
  const emisCtx = emisCanvas.getContext('2d');
  const emisImg = emisCtx.createImageData(w, h);
  const emisDst = emisImg.data;

  const height = new Float32Array(w * h);

  // Two scales of padded seamless Worley cellular facets for cut-gem refraction
  const macroCells = createPeriodicWorley(7, 7, 3109, 0.74);
  const subCells = createPeriodicWorley(14, 14, 3217, 0.70);
  const fractureFBM = createPeriodicFBM(8, 8, 3, 0.55, 3313, true);

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowBase = y * w;

    for (let x = 0; x < w; x++) {
      const u = x * invW;

      const c1 = macroCells.sample(u, v);
      const edge1 = c1.edge;
      const plane1 = c1.planeH;
      const tone1 = c1.tone;
      const dx1 = c1.dx;
      const dy1 = c1.dy;
      const f1 = c1.f1;

      const c2 = subCells.sample(u, v);
      const edge2 = c2.edge;
      const plane2 = c2.planeH;
      const tone2 = c2.tone;

      // Internal refractive fracture veins
      const fracture = fractureFBM(u, v);
      const crackRaw = clamp01((fracture - 0.62) * 2.65);
      const microCrack = crackRaw * crackRaw * Math.sqrt(crackRaw);

      // Crisp crystal bevel mask along facet ridges
      const bevel1 = smoothstep(0.0, 0.088, edge1);
      const bevel2 = smoothstep(0.0, 0.075, edge2);
      const edgeGlow = (1.0 - smoothstep(0.0, 0.055, edge1)) + (1.0 - smoothstep(0.0, 0.036, edge2)) * 0.42;

      // Combine planar crystal faces with sharp V-bevel cuts
      const crystalFaceH = lerp(0.24, plane1, bevel1) * 0.74 + lerp(0.32, plane2, bevel2) * 0.26;
      const hVal = crystalFaceH - microCrack * 0.14;
      height[rowBase + x] = clamp01(hVal);

      // Facet refraction palette: deep sapphire -> vibrant ice cyan -> snow-white highlight
      const refr = clamp01(tone1 * 0.62 + tone2 * 0.24 + (plane1 - 0.5) * 0.48);
      let r, g, b;
      if (refr < 0.45) {
        const t = refr / 0.45;
        r = lerp(42, 108, t);
        g = lerp(124, 212, t);
        b = lerp(236, 252, t);
      } else {
        const t = (refr - 0.45) / 0.55;
        r = lerp(108, 236, t);
        g = lerp(212, 249, t);
        b = lerp(252, 255, t);
      }

      // Frosted snow-white refraction rim along facet edges & internal fracture streaks
      const frostRim = clamp01(edgeGlow * 0.82 + microCrack * 0.58);
      r = lerp(r, 242, frostRim * 0.76);
      g = lerp(g, 251, frostRim * 0.80);
      b = lerp(b, 255, frostRim * 0.84);

      // Roughness: gem-clear glassy facets (0.06..0.18) vs frosted bevel seams & cracks (0.52)
      let rough = 0.07 + (1.0 - refr) * 0.10 + (1.0 - bevel2) * 0.14;
      rough = lerp(rough, 0.54, clamp01(edgeGlow * 0.7 + microCrack * 0.85));
      const roughByte = (clamp01(rough) * 255 + 0.5) | 0;

      // Emissive: internal icy caustic luminescence + crisp 8-ray star-glint sparkles
      const coreGlow = Math.exp(-f1 * f1 * 6.5) * (0.28 + tone1 * 0.48);
      let starBurst = 0;
      if (tone1 > 0.46 && f1 < 0.42) {
        const ax = Math.abs(dx1);
        const ay = Math.abs(dy1);
        const dA = Math.abs(dx1 + dy1) * 0.7071;
        const dB = Math.abs(dx1 - dy1) * 0.7071;
        const cross1 = Math.exp(-ax * 38.0 - ay * 6.8) + Math.exp(-ay * 38.0 - ax * 6.8);
        const cross2 = (Math.exp(-dA * 44.0 - dB * 9.5) + Math.exp(-dB * 44.0 - dA * 9.5)) * 0.58;
        const pinpoint = Math.exp(-f1 * 18.0) * 1.1;
        starBurst = clamp01((cross1 * 0.65 + cross2 * 0.55 + pinpoint) * ((tone1 - 0.46) / 0.54));
      }

      const facetEmis = 0.12 + refr * 0.26 + coreGlow * 0.52 + edgeGlow * 0.24 + microCrack * 0.18;
      const er = clamp(facetEmis * 68 + starBurst * 220 + edgeGlow * 45, 0, 255);
      const eg = clamp(facetEmis * 176 + starBurst * 245 + edgeGlow * 70, 0, 255);
      const eb = clamp(facetEmis * 238 + starBurst * 255 + edgeGlow * 80, 0, 255);

      const p = (rowBase + x) << 2;
      mapDst[p] = clamp(r, 0, 255) | 0;
      mapDst[p + 1] = clamp(g, 0, 255) | 0;
      mapDst[p + 2] = clamp(b, 0, 255) | 0;
      mapDst[p + 3] = 255;

      roughDst[p] = roughByte;
      roughDst[p + 1] = roughByte;
      roughDst[p + 2] = roughByte;
      roughDst[p + 3] = 255;

      emisDst[p] = er | 0;
      emisDst[p + 1] = eg | 0;
      emisDst[p + 2] = eb | 0;
      emisDst[p + 3] = 255;
    }
  }

  mapCtx.putImageData(mapImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  emisCtx.putImageData(emisImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(height, w, h, 4.2, true);

  return {
    map: createTex(mapCanvas, { isColor: true, repeat: true }),
    normalMap: createTex(normalCanvas, { isColor: false, repeat: true }),
    roughnessMap: createTex(roughCanvas, { isColor: false, repeat: true }),
    emissiveMap: createTex(emisCanvas, { isColor: true, repeat: true }),
  };
}

// ---------------------------------------------------------------------------
// 4. snowGround — 256x256 Far-North Wind-Swept Plateau Snowfield
// ---------------------------------------------------------------------------

function buildSnowGround(createTex) {
  const w = 256;
  const h = 256;
  const invW = 1 / w;
  const invH = 1 / h;

  const mapCanvas = createCanvas(w, h);
  const mapCtx = mapCanvas.getContext('2d');
  const mapImg = mapCtx.createImageData(w, h);
  const mapDst = mapImg.data;

  const roughCanvas = createCanvas(w, h);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(w, h);
  const roughDst = roughImg.data;

  const height = new Float32Array(w * h);

  // Precomputed fast periodic lattice samplers
  const windWarpNoise = createPeriodicNoiseGrid(4, 4, 4103).sample;
  const macroDriftFBM = createPeriodicFBM(2, 2, 2, 0.52, 4201);
  const rippleFBM = createPeriodicFBM(4, 16, 3, 0.52, 4307);
  const rippleCrestFBM = createPeriodicFBM(2, 8, 2, 0.48, 4409, true);
  const fineCrustNoise = createPeriodicNoiseGrid(32, 32, 4507).sample;

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowBase = y * w;

    for (let x = 0; x < w; x++) {
      const u = x * invW;

      // Unimodular integer shear (u + v, v - u) yields 45-degree wind ripples with EXACT periodicity!
      const swU = u + v;
      const swV = v - u;

      const windWarp = (windWarpNoise(u, v) - 0.5) * 0.14;
      const macroDrift = macroDriftFBM(u, v);
      const ripple = rippleFBM(swU + windWarp, swV);
      const rippleCrest = rippleCrestFBM(swU + windWarp * 0.7, swV);
      const fineCrust = fineCrustNoise(u, v);

      const hVal =
        macroDrift * 0.42 +
        ripple * 0.28 +
        rippleCrest * 0.24 +
        fineCrust * 0.06;
      height[rowBase + x] = clamp01(hVal);

      // Subsurface cold ice-blue shadow tint in snow troughs, crisp porcelain-white on wind crests
      const crestT = smoothstep(0.28, 0.76, hVal);
      let r = lerp(196, 247, crestT) + (fineCrust - 0.5) * 6;
      let g = lerp(218, 250, crestT) + (fineCrust - 0.5) * 5;
      let b = lerp(244, 255, crestT);

      // Micro-crystalline diamond-dust snow sparkle (deterministic per-pixel crystal facet glints)
      const glintRand = hash2i(x, y, 4603);
      const glintChance = 0.981 - crestT * 0.012;
      const isSparkle = glintRand > glintChance;
      const sparkleStrength = isSparkle ? (glintRand - glintChance) / (1.0 - glintChance) : 0;

      if (isSparkle) {
        r = lerp(r, 255, sparkleStrength * 0.85);
        g = lerp(g, 255, sparkleStrength * 0.9);
        b = 255;
      }

      // Roughness: powdery velvety snow (0.76..0.90), slightly wind-glazed crests (0.62), sharp sparkle flecks (0.06)
      let rough = lerp(0.89, 0.67, crestT) + (fineCrust - 0.5) * 0.09;
      if (isSparkle) {
        rough = lerp(rough, 0.05 + (1.0 - sparkleStrength) * 0.12, 0.95);
      }
      const roughByte = (clamp01(rough) * 255 + 0.5) | 0;

      const p = (rowBase + x) << 2;
      mapDst[p] = clamp(r, 0, 255) | 0;
      mapDst[p + 1] = clamp(g, 0, 255) | 0;
      mapDst[p + 2] = clamp(b, 0, 255) | 0;
      mapDst[p + 3] = 255;

      roughDst[p] = roughByte;
      roughDst[p + 1] = roughByte;
      roughDst[p + 2] = roughByte;
      roughDst[p + 3] = 255;
    }
  }

  mapCtx.putImageData(mapImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(height, w, h, 2.6, true);

  return {
    map: createTex(mapCanvas, { isColor: true, repeat: true }),
    normalMap: createTex(normalCanvas, { isColor: false, repeat: true }),
    roughnessMap: createTex(roughCanvas, { isColor: false, repeat: true }),
  };
}

// ---------------------------------------------------------------------------
// 5. darkBark — 256x256 Snow-Dusted Boreal Pine / Silver-Birch Bark
// ---------------------------------------------------------------------------

function buildDarkBark(createTex) {
  const w = 256;
  const h = 256;
  const invW = 1 / w;
  const invH = 1 / h;

  const mapCanvas = createCanvas(w, h);
  const mapCtx = mapCanvas.getContext('2d');
  const mapImg = mapCtx.createImageData(w, h);
  const mapDst = mapImg.data;

  const roughCanvas = createCanvas(w, h);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(w, h);
  const roughDst = roughImg.data;

  const height = new Float32Array(w * h);
  const frostPatch = new Float32Array(w * h);
  const silverPatch = new Float32Array(w * h);

  // Precomputed fast periodic lattice samplers
  const warpUFBM = createPeriodicFBM(8, 2, 2, 0.55, 5101);
  const mainFurrowFBM = createPeriodicFBM(16, 4, 3, 0.55, 5209);
  const sharpCreviceFBM = createPeriodicFBM(16, 2, 2, 0.52, 5303, true);
  const crossScaleNoise = createPeriodicNoiseGrid(4, 32, 5407).sample;
  const fiberNoise = createPeriodicNoiseGrid(64, 16, 5501).sample;
  const patchFBM = createPeriodicFBM(4, 4, 2, 0.55, 5603);
  const silverNoise = createPeriodicNoiseGrid(8, 8, 5701).sample;

  // Pass 1: Compute deeply furrowed vertical bark heightfield
  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowBase = y * w;

    for (let x = 0; x < w; x++) {
      const u = x * invW;

      // Vertical meandering grain warp
      const wU = (warpUFBM(u, v) - 0.5) * 0.065;
      const uw = u + wU;

      // Deep vertical bark furrows + gnarled plates
      const mainFurrow = mainFurrowFBM(uw, v);
      const sharpCrevice = sharpCreviceFBM(uw, v);
      const fissureRaw = clamp01((sharpCrevice - 0.56) * 2.4);
      const fissureCut = fissureRaw * fissureRaw;

      // Horizontal peeling birch lenticels & scale cross-cracks
      const crossScale = crossScaleNoise(u, v);
      const lenticel = smoothstep(0.76, 0.90, crossScale) * 0.16;

      // Fine rough woody fibrous grain
      const fiber = fiberNoise(uw, v);

      const hVal = mainFurrow * 0.72 + fiber * 0.18 + 0.14 - fissureCut * 0.52 - lenticel;
      height[rowBase + x] = clamp01(hVal);

      // Windward frost snow distribution (concentrated on left/windward half + clinging pockets)
      const windBand = 0.5 + 0.5 * Math.cos((u - 0.28) * Math.PI * 2.0);
      const patchN = patchFBM(u, v);
      frostPatch[rowBase + x] = clamp01(windBand * 0.62 + patchN * 0.58 - 0.22);

      // Boreal silver-birch weathered outer bark patina
      silverPatch[rowBase + x] = silverNoise(u, v);
    }
  }

  // Pass 2: Shade albedo & roughness using directional bark ridge slope for realistic windward rime
  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    const rowUp = (y === 0 ? h - 1 : y - 1) * w;

    for (let x = 0; x < w; x++) {
      const xm = x === 0 ? w - 1 : x - 1;
      const idx = rowBase + x;
      const hVal = height[idx];

      // Windward slope (facing -X) & upward bark ledge (facing -Y) catch clinging rime frost
      const slopeX = hVal - height[rowBase + xm];
      const slopeY = hVal - height[rowUp + x];
      const windwardCatch = clamp01(slopeX * 4.5 + slopeY * 3.2);

      const ridgeT = smoothstep(0.18, 0.80, hVal);
      const silverT = smoothstep(0.45, 0.82, silverPatch[idx]) * ridgeT;

      // Grounded boreal pine/birch umber-charcoal palette -> silvered weathered outer plates
      let r = lerp(38, 98, ridgeT);
      let g = lerp(32, 85, ridgeT);
      let b = lerp(31, 78, ridgeT);

      // Weathered boreal birch silvery-taupe highlights on outer ridges
      r = lerp(r, 134, silverT * 0.48);
      g = lerp(g, 128, silverT * 0.48);
      b = lerp(b, 125, silverT * 0.46);

      // Clinging snow/frost rime on windward faces & frosted bark shelves
      const rimeMask = smoothstep(
        0.38,
        0.74,
        frostPatch[idx] * (0.48 + ridgeT * 0.55 + windwardCatch * 0.65)
      );
      r = lerp(r, 226, rimeMask * 0.86);
      g = lerp(g, 237, rimeMask * 0.88);
      b = lerp(b, 250, rimeMask * 0.92);

      // Roughness: ultra-rough dark crevices (0.96), rugged bark (0.85), frosty rime sheen (0.50)
      let rough = lerp(0.96, 0.82, ridgeT);
      rough = lerp(rough, 0.50, rimeMask * 0.88);
      const roughByte = (clamp01(rough) * 255 + 0.5) | 0;

      const p = idx << 2;
      mapDst[p] = clamp(r, 0, 255) | 0;
      mapDst[p + 1] = clamp(g, 0, 255) | 0;
      mapDst[p + 2] = clamp(b, 0, 255) | 0;
      mapDst[p + 3] = 255;

      roughDst[p] = roughByte;
      roughDst[p + 1] = roughByte;
      roughDst[p + 2] = roughByte;
      roughDst[p + 3] = 255;
    }
  }

  mapCtx.putImageData(mapImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(height, w, h, 4.6, true);

  return {
    map: createTex(mapCanvas, { isColor: true, repeat: true }),
    normalMap: createTex(normalCanvas, { isColor: false, repeat: true }),
    roughnessMap: createTex(roughCanvas, { isColor: false, repeat: true }),
  };
}

// ---------------------------------------------------------------------------
// 6. stainedGlass — 512x512 Royal Academy Gothic Pointed-Arch Stained Glass
// ---------------------------------------------------------------------------

function buildStainedGlass(createTex) {
  const w = 512;
  const h = 512;

  const mapCanvas = createCanvas(w, h);
  const emisCanvas = createCanvas(w, h);

  // Exact Gothic pointed arch geometry:
  // Span x = [52, 460], spring line y = 290, pointed apex (256, 20)
  // Radius R = (204^2 + 270^2) / (2 * 204) = 280.6765
  const leftX = 52;
  const rightX = 460;
  const springY = 290;
  const bottomY = 496;
  const archR = 280.6765;
  const rightArcCx = rightX - archR; // 179.3235
  const leftArcCx = leftX + archR;   // 332.6765
  const apexAngleRight = Math.atan2(20 - springY, 256 - rightArcCx);
  const apexAngleLeft = Math.atan2(20 - springY, 256 - leftArcCx);

  function traceOuterGothicArch(ctx, inset = 0) {
    const lX = leftX + inset;
    const rX = rightX - inset;
    const bY = bottomY - inset;
    const r = archR - inset;
    ctx.beginPath();
    ctx.moveTo(lX, bY);
    ctx.lineTo(lX, springY);
    ctx.arc(leftArcCx, springY, r, Math.PI, apexAngleLeft, false);
    ctx.arc(rightArcCx, springY, r, apexAngleRight, 0, false);
    ctx.lineTo(rX, bY);
    ctx.closePath();
  }

  function traceSubLancet(ctx, x0, x1, topY, springSubY, botY) {
    const midX = (x0 + x1) * 0.5;
    const hw = (x1 - x0) * 0.5;
    const vr = springSubY - topY;
    const R = (hw * hw + vr * vr) / (2 * hw);
    const rCx = x1 - R;
    const lCx = x0 + R;
    const aR = Math.atan2(topY - springSubY, midX - rCx);
    const aL = Math.atan2(topY - springSubY, midX - lCx);

    ctx.beginPath();
    ctx.moveTo(x0, botY);
    ctx.lineTo(x0, springSubY);
    ctx.arc(lCx, springSubY, R, Math.PI, aL, false);
    ctx.arc(rCx, springSubY, R, aR, 0, false);
    ctx.lineTo(x1, botY);
    ctx.closePath();
  }

  function renderWindow(canvas, isEmissive) {
    const ctx = canvas.getContext('2d');
    const rng = createRNG(6101);

    // Exterior carved stone spandrels around the pointed arch (dark on emissive)
    if (isEmissive) {
      ctx.fillStyle = '#03050a';
      ctx.fillRect(0, 0, w, h);
    } else {
      const stoneGrad = ctx.createLinearGradient(0, 0, 0, h);
      stoneGrad.addColorStop(0, '#cfd8e6');
      stoneGrad.addColorStop(0.5, '#bcc7d8');
      stoneGrad.addColorStop(1, '#aebacc');
      ctx.fillStyle = stoneGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle stone masonry trim joints on outer border
      ctx.strokeStyle = 'rgba(84, 98, 122, 0.35)';
      ctx.lineWidth = 1.5;
      for (let sy = 40; sy < h; sy += 56) {
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();
      }
    }

    // Clip everything inside the royal gothic window opening
    ctx.save();
    traceOuterGothicArch(ctx, 2);
    ctx.clip();

    // Base rich royal-blue stained glass backdrop
    const bgGrad = ctx.createRadialGradient(256, 186, 20, 256, 230, 340);
    if (isEmissive) {
      bgGrad.addColorStop(0, '#4bbcff');
      bgGrad.addColorStop(0.32, '#1d6bff');
      bgGrad.addColorStop(0.75, '#0e3ca8');
      bgGrad.addColorStop(1, '#072268');
    } else {
      bgGrad.addColorStop(0, '#3a8cff');
      bgGrad.addColorStop(0.38, '#1658eb');
      bgGrad.addColorStop(0.80, '#103fb0');
      bgGrad.addColorStop(1, '#0b2c82');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Helper: fill a glass pane with luminous cathedral radial depth
    function fillGlassPane(cx, cy, radius, innerCol, outerCol) {
      const g = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius);
      g.addColorStop(0, innerCol);
      g.addColorStop(1, outerCol);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // --- A. Upper Apex Gothic Crown (y = 24..74) ---
    ctx.beginPath();
    ctx.moveTo(256, 28);
    ctx.lineTo(294, 68);
    ctx.lineTo(256, 86);
    ctx.lineTo(218, 68);
    ctx.closePath();
    fillGlassPane(256, 58, 36, isEmissive ? '#ffefb5' : '#ffe6a3', isEmissive ? '#d8a642' : '#d6a449');

    // Flanking upper arch ice-cyan wings
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(256 + side * 42, 74);
      ctx.lineTo(256 + side * 98, 108);
      ctx.lineTo(256 + side * 78, 134);
      ctx.lineTo(256 + side * 32, 96);
      ctx.closePath();
      fillGlassPane(
        256 + side * 66,
        102,
        42,
        isEmissive ? '#9ceeff' : '#89e4ff',
        isEmissive ? '#2fa8eb' : '#35a6e6'
      );
    }

    // --- B. Lower Triple Gothic Lancet Windows (y = 304..494) ---
    const lancets = [
      { x0: 66, x1: 180, topY: 308, springY: 360, isCenter: false },
      { x0: 192, x1: 320, topY: 298, springY: 356, isCenter: true },
      { x0: 332, x1: 446, topY: 308, springY: 360, isCenter: false },
    ];

    const leadLines = [];

    for (const lan of lancets) {
      ctx.save();
      traceSubLancet(ctx, lan.x0, lan.x1, lan.topY, lan.springY, bottomY - 8);
      ctx.clip();

      // Diamond-quarry leaded stained glass panes
      const stepX = lan.isCenter ? 26 : 24;
      const stepY = 30;
      const midX = (lan.x0 + lan.x1) * 0.5;

      for (let row = 0; row < 10; row++) {
        const cy = lan.topY + 12 + row * stepY;
        const offsetX = (row & 1) ? stepX * 0.5 : 0;
        for (let cx = lan.x0 - stepX; cx <= lan.x1 + stepX; cx += stepX) {
          const px = cx + offsetX;
          const distMid = Math.abs(px - midX);
          const rSeed = rng();

          let innerC, outerC;
          if (lan.isCenter && distMid < 16 && (row % 2 === 0)) {
            // Champagne gold spine in center lancet
            innerC = isEmissive ? '#ffecb0' : '#fce094';
            outerC = isEmissive ? '#cf9a3c' : '#d5a349';
          } else if (distMid < 34 && (row % 2 === 1)) {
            // Ice cyan accent diamonds
            innerC = isEmissive ? '#96ebff' : '#85e3ff';
            outerC = isEmissive ? '#27a4e6' : '#32a9e8';
          } else if (rSeed > 0.62) {
            innerC = isEmissive ? '#4c99ff' : '#3c85f5';
            outerC = isEmissive ? '#154ec9' : '#1658eb';
          } else {
            innerC = isEmissive ? '#266eff' : '#1f64f0';
            outerC = isEmissive ? '#0d3699' : '#103fae';
          }

          ctx.beginPath();
          ctx.moveTo(px, cy - stepY * 0.52);
          ctx.lineTo(px + stepX * 0.52, cy);
          ctx.lineTo(px, cy + stepY * 0.52);
          ctx.lineTo(px - stepX * 0.52, cy);
          ctx.closePath();
          fillGlassPane(px, cy, stepY * 0.72, innerC, outerC);
          ctx.strokeStyle = isEmissive ? '#04070d' : '#192235';
          ctx.lineWidth = 2.0;
          ctx.stroke();
        }
      }

      // Center lancet royal crest medallion
      if (lan.isCenter) {
        const medY = 412;
        ctx.beginPath();
        ctx.arc(midX, medY, 34, 0, Math.PI * 2);
        fillGlassPane(midX, medY, 34, isEmissive ? '#b5f3ff' : '#9eeaff', isEmissive ? '#1d75e8' : '#1658eb');
        ctx.strokeStyle = isEmissive ? '#04070d' : '#182032';
        ctx.lineWidth = 3.2;
        ctx.stroke();

        // Inner gold double-rhombus snowflake crest
        ctx.beginPath();
        ctx.moveTo(midX, medY - 24);
        ctx.lineTo(midX + 18, medY);
        ctx.lineTo(midX, medY + 24);
        ctx.lineTo(midX - 18, medY);
        ctx.closePath();
        fillGlassPane(midX, medY, 24, isEmissive ? '#fff2c2' : '#ffe49c', isEmissive ? '#d8a53e' : '#e0b252');
        ctx.strokeStyle = isEmissive ? '#04070d' : '#182032';
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }

      ctx.restore();

      // Lancet heavy lead mullion frame
      traceSubLancet(ctx, lan.x0, lan.x1, lan.topY, lan.springY, bottomY - 8);
      ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
      ctx.lineWidth = 6.5;
      ctx.stroke();
    }

    // Spandrel rosette medallions between rose window and lancet tops
    for (const sx of [136, 376]) {
      const sy = 294;
      ctx.beginPath();
      ctx.arc(sx, sy, 20, 0, Math.PI * 2);
      fillGlassPane(sx, sy, 20, isEmissive ? '#ffefb8' : '#fae096', isEmissive ? '#d49d3a' : '#d6a448');
      ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
      ctx.lineWidth = 4.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      fillGlassPane(sx, sy, 9, isEmissive ? '#bbf5ff' : '#9cecff', isEmissive ? '#34b5f5' : '#40b9f2');
      ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    // --- C. Grand Upper Solar-Star Rose Window (center 256, 188, radius 108) ---
    const rCx = 256;
    const rCy = 188;
    const roseR = 108;

    // Rose backing disc
    ctx.beginPath();
    ctx.arc(rCx, rCy, roseR, 0, Math.PI * 2);
    fillGlassPane(rCx, rCy, roseR, isEmissive ? '#4cb8ff' : '#2a77f2', isEmissive ? '#0f3ca8' : '#103db0');

    // Outer 16-segment rose ring (alternating champagne gold sunbeams, ice cyan, royal blue)
    const seg16 = 16;
    for (let i = 0; i < seg16; i++) {
      const a0 = (i / seg16) * Math.PI * 2 - Math.PI * 0.5;
      const a1 = ((i + 1) / seg16) * Math.PI * 2 - Math.PI * 0.5;
      const aMid = (a0 + a1) * 0.5;
      const rIn = 62;
      const rOut = roseR - 3;

      ctx.beginPath();
      ctx.arc(rCx, rCy, rOut, a0, a1, false);
      ctx.arc(rCx, rCy, rIn, a1, a0, true);
      ctx.closePath();

      const gx = rCx + Math.cos(aMid) * 85;
      const gy = rCy + Math.sin(aMid) * 85;
      if (i % 4 === 0) {
        fillGlassPane(gx, gy, 30, isEmissive ? '#fff0ba' : '#fae096', isEmissive ? '#d6a03b' : '#dca94a');
      } else if (i % 2 === 1) {
        fillGlassPane(gx, gy, 30, isEmissive ? '#9eedff' : '#85e3ff', isEmissive ? '#2baae8' : '#35b1eb');
      } else {
        fillGlassPane(gx, gy, 30, isEmissive ? '#3d86ff' : '#2d72f5', isEmissive ? '#1243b8' : '#1658eb');
      }
      ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      // Gothic pointed petal cusp on outer rim
      const tipX = rCx + Math.cos(aMid) * (rOut - 4);
      const tipY = rCy + Math.sin(aMid) * (rOut - 4);
      const b1X = rCx + Math.cos(a0 + 0.04) * (rIn + 6);
      const b1Y = rCy + Math.sin(a0 + 0.04) * (rIn + 6);
      const b2X = rCx + Math.cos(a1 - 0.04) * (rIn + 6);
      const b2Y = rCy + Math.sin(a1 - 0.04) * (rIn + 6);
      leadLines.push([b1X, b1Y, tipX, tipY], [b2X, b2Y, tipX, tipY]);
    }

    // Middle 8-petal solar star ring (r = 30..62)
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 - Math.PI * 0.5;
      const a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI * 0.5;
      const aMid = (a0 + a1) * 0.5;

      ctx.beginPath();
      ctx.arc(rCx, rCy, 62, a0, a1, false);
      ctx.arc(rCx, rCy, 30, a1, a0, true);
      ctx.closePath();

      const gx = rCx + Math.cos(aMid) * 46;
      const gy = rCy + Math.sin(aMid) * 46;
      if (i % 2 === 0) {
        fillGlassPane(gx, gy, 24, isEmissive ? '#aef1ff' : '#94e8ff', isEmissive ? '#28a4e6' : '#35b0eb');
      } else {
        fillGlassPane(gx, gy, 24, isEmissive ? '#4c94ff' : '#357ef5', isEmissive ? '#1346be' : '#1658eb');
      }
      ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
      ctx.lineWidth = 3.0;
      ctx.stroke();
    }

    // Radiant 8-pointed Champagne-Gold Sun-Star overlaid across the rose core
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI * 0.5;
      const rad = (i & 1) === 0 ? 58 : 22;
      const sx = rCx + Math.cos(a) * rad;
      const sy = rCy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    fillGlassPane(rCx, rCy, 56, isEmissive ? '#fff7d4' : '#ffedb5', isEmissive ? '#e0aa42' : '#e6b856');
    ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Central luminous ice-crystal sun heart
    ctx.beginPath();
    ctx.arc(rCx, rCy, 18, 0, Math.PI * 2);
    fillGlassPane(rCx, rCy, 18, isEmissive ? '#ffffff' : '#f2fbff', isEmissive ? '#7ae4ff' : '#5fd4ff');
    ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Crisp gothic rose outer & inner iron tracery rings + petal cusps
    ctx.strokeStyle = isEmissive ? '#04070d' : '#182033';
    ctx.lineWidth = 2.2;
    for (const [x1, y1, x2, y2] of leadLines) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.arc(rCx, rCy, roseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.arc(rCx, rCy, 62, 0, Math.PI * 2);
    ctx.stroke();

    // --- D. Hand-Blown Antique Seeded Glass Mottling Pass (zero-readback GPU/2D composite) ---
    // Overlays a precomputed 64x64 seeded-glass mottle tile (dark lead stays dark under overlay)
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.28;
    ctx.drawImage(mottleCanvas, 0, 0, w, h);

    // Soft cathedral backlight falloff toward bottom for emissive grace
    if (isEmissive) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 1.0;
      const attenGrad = ctx.createLinearGradient(0, 0, 0, h);
      attenGrad.addColorStop(0, 'rgb(220, 220, 220)');
      attenGrad.addColorStop(1, 'rgb(184, 184, 184)');
      ctx.fillStyle = attenGrad;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    ctx.restore();

    // Heavy Gothic outer stone & wrought-lead arch molding border
    traceOuterGothicArch(ctx, 2);
    ctx.strokeStyle = isEmissive ? '#04070d' : '#1a2336';
    ctx.lineWidth = 10;
    ctx.stroke();

    if (!isEmissive) {
      traceOuterGothicArch(ctx, -3);
      ctx.strokeStyle = 'rgba(240, 201, 117, 0.55)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  // Tiny 64x64 antique seeded-glass mottle overlay tile (< 0.2ms, shared by map & emissive)
  const mw = 64;
  const mh = 64;
  const mottleCanvas = createCanvas(mw, mh);
  const mCtx = mottleCanvas.getContext('2d');
  const mImg = mCtx.createImageData(mw, mh);
  const mDst = mImg.data;
  const mottleFBM = createPeriodicFBM(8, 8, 2, 0.5, 6407);
  for (let y = 0; y < mh; y++) {
    const v = y / mh;
    const rowOff = y * mw;
    for (let x = 0; x < mw; x++) {
      const m = mottleFBM(x / mw, v);
      const grain = (hash2i(x, y, 6521) - 0.5) * 0.24;
      const val = clamp(128 + (m - 0.5 + grain) * 165, 48, 212) | 0;
      const p = (rowOff + x) << 2;
      mDst[p] = val;
      mDst[p + 1] = val;
      mDst[p + 2] = val;
      mDst[p + 3] = 255;
    }
  }
  mCtx.putImageData(mImg, 0, 0);

  renderWindow(mapCanvas, false);
  renderWindow(emisCanvas, true);

  return {
    map: createTex(mapCanvas, { isColor: true, repeat: false }),
    emissiveMap: createTex(emisCanvas, { isColor: true, repeat: false }),
  };
}

// ---------------------------------------------------------------------------
// 7. arcaneFloorDecal — 512x512 Transparent Royal Blue & Gold Magic Circle
// ---------------------------------------------------------------------------

function buildArcaneFloorDecal(createTex) {
  const size = 512;
  const virtualSize = 1024;
  const cx = virtualSize * 0.5;
  const cy = virtualSize * 0.5;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);
  ctx.scale(0.5, 0.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Subtle ethereal annular base glow (soft & translucent so flagstones remain clear)
  const aura = ctx.createRadialGradient(cx, cy, 40, cx, cy, 488);
  aura.addColorStop(0.0, 'rgba(95, 212, 255, 0.14)');
  aura.addColorStop(0.32, 'rgba(22, 88, 235, 0.08)');
  aura.addColorStop(0.72, 'rgba(22, 88, 235, 0.05)');
  aura.addColorStop(0.84, 'rgba(95, 212, 255, 0.11)');
  aura.addColorStop(0.92, 'rgba(240, 201, 117, 0.07)');
  aura.addColorStop(1.0, 'rgba(22, 88, 235, 0.0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, 488, 0, Math.PI * 2);
  ctx.fill();

  function strokeCircle(r, color, width, dash = null) {
    ctx.save();
    if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Concentric outer astronomical scale rings
  strokeCircle(474, 'rgba(240, 201, 117, 0.62)', 2.4);
  strokeCircle(464, 'rgba(22, 88, 235, 0.58)', 4.0);
  strokeCircle(454, 'rgba(95, 212, 255, 0.52)', 1.5);
  strokeCircle(432, 'rgba(240, 201, 117, 0.66)', 2.2);
  strokeCircle(374, 'rgba(240, 201, 117, 0.62)', 2.2);
  strokeCircle(364, 'rgba(22, 88, 235, 0.54)', 3.2);
  strokeCircle(238, 'rgba(95, 212, 255, 0.48)', 1.8);
  strokeCircle(224, 'rgba(240, 201, 117, 0.55)', 1.6, [6, 10]);
  strokeCircle(196, 'rgba(22, 88, 235, 0.54)', 2.4);

  // 3. Classical astronomical degree tick marks (144 fine, 36 medium, 12 major compass ticks)
  for (let i = 0; i < 144; i++) {
    const a = (i / 144) * Math.PI * 2;
    const isMajor = i % 12 === 0;
    const isMed = i % 4 === 0;
    const r0 = isMajor ? 434 : isMed ? 441 : 447;
    const r1 = 454;

    ctx.strokeStyle = isMajor
      ? 'rgba(240, 201, 117, 0.78)'
      : isMed
        ? 'rgba(130, 222, 255, 0.62)'
        : 'rgba(22, 88, 235, 0.42)';
    ctx.lineWidth = isMajor ? 2.6 : isMed ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();

    // Outer compass diamond pips at 12 cardinal angles
    if (isMajor) {
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 464, cy + Math.sin(a) * 464);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(248, 219, 146, 0.82)';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(0, 4.5);
      ctx.lineTo(-8, 0);
      ctx.lineTo(0, -4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // 4. Classical Geometric Astrolabe Rune Glyphs along annular band (r = 403)
  function drawAstrolabeGlyph(type) {
    ctx.beginPath();
    switch (type % 8) {
      case 0: // Diamond-spear star
        ctx.moveTo(0, -14); ctx.lineTo(8, 0); ctx.lineTo(0, 14); ctx.lineTo(-8, 0); ctx.closePath();
        ctx.moveTo(-11, 0); ctx.lineTo(11, 0);
        break;
      case 1: // Twin chevron + center bar
        ctx.moveTo(-9, -11); ctx.lineTo(0, -3); ctx.lineTo(9, -11);
        ctx.moveTo(-9, 11); ctx.lineTo(0, 3); ctx.lineTo(9, 11);
        ctx.moveTo(0, -13); ctx.lineTo(0, 13);
        break;
      case 2: // Solar crescent & vertical needle
        ctx.arc(0, -2, 8, Math.PI * 0.15, Math.PI * 0.85, false);
        ctx.moveTo(0, -14); ctx.lineTo(0, 14);
        ctx.moveTo(-6, -8); ctx.lineTo(6, -8);
        break;
      case 3: // Hourglass prism
        ctx.moveTo(-8, -12); ctx.lineTo(8, -12); ctx.lineTo(-8, 12); ctx.lineTo(8, 12); ctx.closePath();
        break;
      case 4: // Astral trident
        ctx.moveTo(0, -14); ctx.lineTo(0, 14);
        ctx.moveTo(-8, -6); ctx.lineTo(-8, 2); ctx.lineTo(8, 2); ctx.lineTo(8, -6);
        ctx.moveTo(-5, 10); ctx.lineTo(5, 10);
        break;
      case 5: // Crossed crystal sigil
        ctx.moveTo(-8, -10); ctx.lineTo(8, 10);
        ctx.moveTo(8, -10); ctx.lineTo(-8, 10);
        ctx.moveTo(0, -14); ctx.lineTo(0, 14);
        break;
      case 6: // Double-bar chalice rune
        ctx.moveTo(-8, -12); ctx.lineTo(8, -12);
        ctx.moveTo(0, -12); ctx.lineTo(0, 12);
        ctx.moveTo(-9, 12); ctx.lineTo(9, 12);
        ctx.moveTo(-6, -3); ctx.lineTo(6, -3);
        break;
      default: // Inscribed dot-triangle
        ctx.moveTo(0, -13); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.closePath();
        ctx.moveTo(0, -4); ctx.lineTo(0, 4);
        break;
    }
    ctx.stroke();
  }

  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.PI / 24;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 403, cy + Math.sin(a) * 403);
    ctx.rotate(a + Math.PI * 0.5);
    // Soft blue halo behind glyph
    ctx.strokeStyle = 'rgba(95, 212, 255, 0.34)';
    ctx.lineWidth = 4.6;
    drawAstrolabeGlyph(i);
    // Crisp champagne gold glyph stroke
    ctx.strokeStyle = 'rgba(244, 211, 132, 0.78)';
    ctx.lineWidth = 2.0;
    drawAstrolabeGlyph(i);
    ctx.restore();

    // Divider dot between glyphs
    const da = (i / 24) * Math.PI * 2;
    ctx.fillStyle = 'rgba(95, 212, 255, 0.58)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(da) * 403, cy + Math.sin(da) * 403, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Grand Interlocking Celestial Star Geometry (Double Hexagrams -> 12-Point Starlight)
  function drawPolygon(sides, radius, rotOffset, strokeStyle, lineWidth) {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2 + rotOffset;
      const px = cx + Math.cos(a) * radius;
      const py = cy + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Secondary rotated 30-degree ice-cyan hexagram
  drawPolygon(3, 360, -Math.PI / 2 + Math.PI / 6, 'rgba(95, 212, 255, 0.36)', 2.2);
  drawPolygon(3, 360, Math.PI / 2 + Math.PI / 6, 'rgba(95, 212, 255, 0.36)', 2.2);

  // Primary royal-blue + champagne-gold double-lined hexagram
  for (const offset of [-Math.PI / 2, Math.PI / 2]) {
    drawPolygon(3, 364, offset, 'rgba(22, 88, 235, 0.62)', 4.2);
    drawPolygon(3, 353, offset, 'rgba(240, 201, 117, 0.66)', 1.8);
  }

  // 6. Six Cardinal Astrolabe Satellite Nodes at the Hexagram Vertices
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI * 0.5;
    const nx = cx + Math.cos(a) * 364;
    const ny = cy + Math.sin(a) * 364;

    // Soft clear halo ring
    const ng = ctx.createRadialGradient(nx, ny, 2, nx, ny, 38);
    ng.addColorStop(0, 'rgba(130, 224, 255, 0.34)');
    ng.addColorStop(1, 'rgba(22, 88, 235, 0.0)');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(nx, ny, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(22, 88, 235, 0.66)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(nx, ny, 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(240, 201, 117, 0.74)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(nx, ny, 19, 0, Math.PI * 2);
    ctx.stroke();

    // Miniature 4-point champagne-gold star inside node
    ctx.fillStyle = 'rgba(250, 226, 162, 0.82)';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const sa = (k / 8) * Math.PI * 2 + a;
      const sr = (k & 1) === 0 ? 12 : 4;
      const px = nx + Math.cos(sa) * sr;
      const py = ny + Math.sin(sa) * sr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 7. Delicate 12-Ray Radial Astrolabe Compass Hairlines
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI * 0.5;
    const rStart = (i & 1) === 0 ? 74 : 196;
    const rEnd = (i & 1) === 0 ? 336 : 360;
    ctx.strokeStyle = (i & 1) === 0
      ? 'rgba(240, 201, 117, 0.34)'
      : 'rgba(95, 212, 255, 0.28)';
    ctx.lineWidth = (i & 1) === 0 ? 1.5 : 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rStart, cy + Math.sin(a) * rStart);
    ctx.lineTo(cx + Math.cos(a) * rEnd, cy + Math.sin(a) * rEnd);
    ctx.stroke();
  }

  // 8. Ornate Six-Pronged Crystalline Snowflake Filigree (r = 186)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);

    // Outer ice-blue crystal glow stroke
    ctx.strokeStyle = 'rgba(95, 212, 255, 0.42)';
    ctx.lineWidth = 6.0;
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.lineTo(176, 0);
    ctx.stroke();

    // Main crystalline spine
    ctx.strokeStyle = 'rgba(226, 248, 255, 0.80)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(180, 0);
    ctx.stroke();

    // Triple crystalline snowflake chevron fronds
    const fronds = [
      { x: 86, len: 34, w: 2.2 },
      { x: 122, len: 42, w: 2.4 },
      { x: 152, len: 24, w: 1.8 },
    ];
    for (const f of fronds) {
      ctx.strokeStyle = 'rgba(130, 226, 255, 0.72)';
      ctx.lineWidth = f.w;
      ctx.beginPath();
      ctx.moveTo(f.x + f.len * 0.72, -f.len * 0.72);
      ctx.lineTo(f.x, 0);
      ctx.lineTo(f.x + f.len * 0.72, f.len * 0.72);
      ctx.stroke();
    }

    // Faceted crystal spearhead tip
    ctx.fillStyle = 'rgba(240, 201, 117, 0.76)';
    ctx.beginPath();
    ctx.moveTo(192, 0);
    ctx.lineTo(176, 7);
    ctx.lineTo(166, 0);
    ctx.lineTo(176, -7);
    ctx.closePath();
    ctx.fill();

    // Delicate inner snowflake hexagonal web between branches
    ctx.strokeStyle = 'rgba(22, 88, 235, 0.54)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(96, 0);
    ctx.lineTo(96 * Math.cos(Math.PI / 3), 96 * Math.sin(Math.PI / 3));
    ctx.stroke();

    ctx.restore();
  }

  // 9. Central Signature Blue-Gold Double-Rhombus Hub Emblem
  ctx.save();
  ctx.translate(cx, cy);

  // Outer royal-blue & ice-cyan rotated prism
  ctx.strokeStyle = 'rgba(22, 88, 235, 0.76)';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(0, -64); ctx.lineTo(48, 0); ctx.lineTo(0, 64); ctx.lineTo(-48, 0); ctx.closePath();
  ctx.stroke();

  // Horizontal companion prism (double-rhombus)
  ctx.strokeStyle = 'rgba(95, 212, 255, 0.70)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-64, 0); ctx.lineTo(0, -48); ctx.lineTo(64, 0); ctx.lineTo(0, 48); ctx.closePath();
  ctx.stroke();

  // Inner champagne-gold jewel diamond
  ctx.strokeStyle = 'rgba(244, 211, 130, 0.86)';
  ctx.lineWidth = 2.6;
  ctx.fillStyle = 'rgba(240, 201, 117, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, -34); ctx.lineTo(26, 0); ctx.lineTo(0, 34); ctx.lineTo(-26, 0); ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Luminous center core glint
  const coreG = ctx.createRadialGradient(0, 0, 1, 0, 0, 18);
  coreG.addColorStop(0, 'rgba(242, 252, 255, 0.85)');
  coreG.addColorStop(0.5, 'rgba(95, 212, 255, 0.45)');
  coreG.addColorStop(1, 'rgba(22, 88, 235, 0.0)');
  ctx.fillStyle = coreG;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  return createTex(canvas, { isColor: true, repeat: false });
}

// ---------------------------------------------------------------------------
// 8. bannerFabric — 256x512 Royal Blue Velvet Hanging Banner + Gold Heraldry
// ---------------------------------------------------------------------------

function buildBannerFabric(createTex) {
  const w = 256;
  const h = 512;

  // Single offscreen embroidery canvas (albedo + luminance-derived emboss height)
  const ornamentCanvas = createCanvas(w, h);
  const oCtx = ornamentCanvas.getContext('2d');

  // Draw all gold trim, double-rhombus snowflake crest, and bottom fringe once
  function drawEmbroidery(ctx) {
    const goldMain = '#f0c975';
    const goldBright = '#fae4a8';
    const goldDeep = '#c69943';
    const iceTint = '#e6f6ff';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Top mounting sleeve trim bar
    ctx.fillStyle = goldDeep;
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = goldMain;
    ctx.fillRect(0, 4, w, 10);
    ctx.fillStyle = goldBright;
    ctx.fillRect(0, 7, w, 3);

    // Side double-line golden filigree border (x = 14..28 and x = 228..242)
    for (const bx of [16, w - 16]) {
      ctx.strokeStyle = goldMain;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(bx, 18);
      ctx.lineTo(bx, 456);
      ctx.stroke();

      const innerX = bx < w * 0.5 ? bx + 10 : bx - 10;
      ctx.strokeStyle = goldDeep;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(innerX, 24);
      ctx.lineTo(innerX, 446);
      ctx.stroke();

      // Delicate woven gold diamond pips along side trim
      ctx.fillStyle = goldBright;
      const midX = (bx + innerX) * 0.5;
      for (let py = 36; py < 442; py += 22) {
        ctx.beginPath();
        ctx.moveTo(midX, py - 3.5);
        ctx.lineTo(midX + 2.5, py);
        ctx.lineTo(midX, py + 3.5);
        ctx.lineTo(midX - 2.5, py);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Bottom ceremonial chevron border band (y = 434..462)
    ctx.strokeStyle = goldMain;
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(16, 444);
    ctx.lineTo(w * 0.5, 464);
    ctx.lineTo(w - 16, 444);
    ctx.stroke();

    ctx.strokeStyle = goldBright;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(26, 434);
    ctx.lineTo(w * 0.5, 453);
    ctx.lineTo(w - 26, 434);
    ctx.stroke();

    // Bottom braided champagne-gold fringe tassels (y = 464..512)
    for (let tx = 4; tx < w; tx += 5) {
      const centerDrop = (1.0 - Math.abs(tx - w * 0.5) / (w * 0.5)) * 14;
      const topY = 446 + centerDrop;
      ctx.strokeStyle = (tx % 10 === 4) ? goldBright : goldMain;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(tx, topY);
      ctx.lineTo(tx, h - 2);
      ctx.stroke();

      // Tiny gold knot bead at top of each tassel
      ctx.fillStyle = goldBright;
      ctx.beginPath();
      ctx.arc(tx, topY + 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Central Royal Crest: Double-Rhombus Snowflake Emblem (center 128, 226) ---
    const cx = w * 0.5;
    const cy = 226;

    // Upper & lower vertical heraldic spear finials
    ctx.strokeStyle = goldMain;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, 74); ctx.lineTo(cx, 128);
    ctx.moveTo(cx, 324); ctx.lineTo(cx, 384);
    ctx.stroke();

    for (const fy of [66, 392]) {
      ctx.fillStyle = goldBright;
      ctx.beginPath();
      ctx.moveTo(cx, fy - 12);
      ctx.lineTo(cx + 8, fy);
      ctx.lineTo(cx, fy + 12);
      ctx.lineTo(cx - 8, fy);
      ctx.closePath();
      ctx.fill();
    }

    // Outer champagne-gold double-rhombus frames
    ctx.strokeStyle = goldMain;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 92);
    ctx.lineTo(cx + 68, cy);
    ctx.lineTo(cx, cy + 92);
    ctx.lineTo(cx - 68, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = goldBright;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 78);
    ctx.lineTo(cx + 56, cy);
    ctx.lineTo(cx, cy + 78);
    ctx.lineTo(cx - 56, cy);
    ctx.closePath();
    ctx.stroke();

    // Crossed horizontal companion rhombus
    ctx.strokeStyle = goldDeep;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 62);
    ctx.lineTo(cx + 76, cy);
    ctx.lineTo(cx, cy + 62);
    ctx.lineTo(cx - 76, cy);
    ctx.closePath();
    ctx.stroke();

    // 4 Corner accent diamond stars around the double rhombus
    for (const [dx, dy] of [[0, -104], [0, 104], [-80, 0], [80, 0]]) {
      ctx.fillStyle = goldBright;
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy + dy - 7);
      ctx.lineTo(cx + dx + 5, cy + dy);
      ctx.lineTo(cx + dx, cy + dy + 7);
      ctx.lineTo(cx + dx - 5, cy + dy);
      ctx.closePath();
      ctx.fill();
    }

    // Six-pronged embroidered snowflake star nestled inside the double rhombus
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);

      ctx.strokeStyle = iceTint;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(52, 0);
      ctx.stroke();

      // Double chevron snowflake barbs
      ctx.strokeStyle = goldBright;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(34, -12); ctx.lineTo(24, 0); ctx.lineTo(34, 12);
      ctx.moveTo(46, -8); ctx.lineTo(38, 0); ctx.lineTo(46, 8);
      ctx.stroke();

      ctx.fillStyle = goldMain;
      ctx.beginPath();
      ctx.moveTo(57, 0); ctx.lineTo(50, 4); ctx.lineTo(46, 0); ctx.lineTo(50, -4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Center embroidered gold jewel core
    ctx.fillStyle = goldBright;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx + 11, cy);
    ctx.lineTo(cx, cy + 14);
    ctx.lineTo(cx - 11, cy);
    ctx.closePath();
    ctx.fill();
  }

  drawEmbroidery(oCtx);
  const ornamentData = oCtx.getImageData(0, 0, w, h).data;

  const mapCanvas = createCanvas(w, h);
  const mapCtx = mapCanvas.getContext('2d');
  const mapImg = mapCtx.createImageData(w, h);
  const mapDst = mapImg.data;
  const height = new Float32Array(w * h);

  const foldWarpFBM = createPeriodicFBM(2, 4, 2, 0.5, 8101);
  const invW = 1 / w;
  const invH = 1 / h;
  const inv36 = 1 / 36.0;
  const inv255 = 1 / 255.0;

  // Precompute per-column warp thread & phase terms
  const warpThreadLUT = new Float32Array(w);
  const uPi6LUT = new Float32Array(w);
  const uPi10LUT = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const u = x * invW;
    warpThreadLUT[x] = Math.sin(x * 1.95) * 0.5 + 0.5;
    uPi6LUT[x] = u * Math.PI * 6.0;
    uPi10LUT[x] = u * Math.PI * 10.0 + 1.2;
  }

  // Compose rich royal-blue velvet weave + hanging drapery folds + raised gold embroidery
  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowBase = y * w;
    // Hanging drapery folds softly increase in depth from the top rod downward
    const drapeAmp = 0.22 + smoothstep(0.03, 0.35, v) * 0.78;
    const isFringeZone = y > 448;
    const weftPart = (Math.sin(y * 2.15) * 0.5 + 0.5) * 0.45;

    for (let x = 0; x < w; x++) {
      const u = x * invW;
      const idx = rowBase + x;
      const p = idx << 2;

      // Graceful vertical velvet folds
      const foldWarp = (foldWarpFBM(u, v) - 0.5) * 0.45;
      const foldWave =
        Math.sin(uPi6LUT[x] + foldWarp) * 0.62 +
        Math.sin(uPi10LUT[x] - foldWarp * 0.6) * 0.38;
      const foldH = 0.5 + foldWave * 0.26 * drapeAmp;

      // Woven velvet warp & weft thread texture
      const weave = warpThreadLUT[x] * 0.55 + weftPart;
      const velvetNap = hash2i(x, y, 8209);

      // Subtle tone-on-tone jacquard royal-blue diamond damask pattern
      let damask = 0;
      if (!isFringeZone) {
        const dA = Math.abs(fract((x + y) * inv36) - 0.5);
        const dB = Math.abs(fract((x - y + 1024) * inv36) - 0.5);
        damask = smoothstep(0.42, 0.49, dA > dB ? dA : dB);
      }

      // Royal blue velvet (#1658eb) shaded with deep indigo valleys & luminous cerulean crowns
      const foldLight = 0.66 + foldH * 0.62;
      const sheenBase = clamp01(foldH * 1.15 - 0.15);
      const sheen = sheenBase * sheenBase * 0.22;

      let r = 22 * foldLight + sheen * 44 + damask * 10 + (weave - 0.5) * 8 + (velvetNap - 0.5) * 6;
      let g = 88 * foldLight + sheen * 56 + damask * 18 + (weave - 0.5) * 10 + (velvetNap - 0.5) * 6;
      let b = 235 * foldLight + sheen * 32 + damask * 16 + (weave - 0.5) * 12 + (velvetNap - 0.5) * 8;

      // Deep shadowed background between hanging bottom tassels
      if (isFringeZone) {
        const centerDrop = (1.0 - Math.abs(x - w * 0.5) / (w * 0.5)) * 14;
        if (y > 448 + centerDrop) {
          r *= 0.28;
          g *= 0.30;
          b *= 0.40;
        }
      }

      // Composite raised champagne-gold embroidery naturally lit by the hanging cloth fold
      const oaByte = ornamentData[p + 3];
      let em = 0;
      if (oaByte > 1) {
        const oa = oaByte * inv255;
        const oR = ornamentData[p];
        const oG = ornamentData[p + 1];
        const oB = ornamentData[p + 2];
        em = oa * ((oR * 0.50 + oG * 0.35 + oB * 0.15) * inv255);
        const goldLight = 0.78 + foldH * 0.38 + (weave - 0.5) * 0.08;
        r = lerp(r, oR * goldLight, oa);
        g = lerp(g, oG * goldLight, oa);
        b = lerp(b, oB * goldLight, oa);
      }

      // Height combines soft drapery + micro weave + damask + raised gold thread embroidery
      height[idx] = clamp01(foldH * 0.52 + weave * 0.085 + damask * 0.03 + em * 0.38);

      mapDst[p] = clamp(r, 0, 255) | 0;
      mapDst[p + 1] = clamp(g, 0, 255) | 0;
      mapDst[p + 2] = clamp(b, 0, 255) | 0;
      mapDst[p + 3] = 255;
    }
  }

  mapCtx.putImageData(mapImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(height, w, h, 3.2, false);

  return {
    map: createTex(mapCanvas, { isColor: true, repeat: false }),
    normalMap: createTex(normalCanvas, { isColor: false, repeat: false }),
  };
}

// ---------------------------------------------------------------------------
// 9. cloudNoise — 256x256 Seamless Multi-Layer Volumetric Cloud FBM Noise
// ---------------------------------------------------------------------------

function buildCloudNoise(createTex) {
  const w = 256;
  const h = 256;
  const invW = 1 / w;
  const invH = 1 / h;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const dst = img.data;

  // Padded seamless inverted Worley puffs + precomputed lattice FBM (3-4 high-contrast octaves)
  const billowMacro = createPeriodicWorley(4, 4, 9103, 0.78);
  const billowMid = createPeriodicWorley(8, 8, 9209, 0.76);
  const warpXNoise = createPeriodicNoiseGrid(4, 4, 9301).sample;
  const warpYNoise = createPeriodicNoiseGrid(4, 4, 9403).sample;
  const fbmMainSampler = createPeriodicFBM(4, 4, 4, 0.52, 9511);
  const fbmMidSampler = createPeriodicFBM(8, 8, 3, 0.52, 9613);
  const fbmWispSampler = createPeriodicFBM(16, 16, 3, 0.55, 9719);

  for (let y = 0; y < h; y++) {
    const v = y * invH;
    const rowBase = y * w;

    for (let x = 0; x < w; x++) {
      const u = x * invW;

      // Gentle seamless curl-like domain warp
      const wx = (warpXNoise(u, v) - 0.5) * 0.14;
      const wy = (warpYNoise(u, v) - 0.5) * 0.14;
      const uw = u + wx;
      const vw = v + wy;

      // R: Primary macro billowy FBM + inverted Worley cumulus puff
      const fbmMain = fbmMainSampler(uw, vw);
      const puffMacro = clamp01(1.0 - billowMacro.sampleF1(uw, vw) * 1.15);
      const chR = clamp01((fbmMain * 0.68 + puffMacro * 0.32 - 0.14) * 1.38);

      // G: Secondary mid-frequency cumulus billow (great for parallax & alphaMap)
      const fbmMid = fbmMidSampler(u - wy * 0.6, v + wx * 0.6);
      const puffMid = clamp01(1.0 - billowMid.sampleF1(u, v) * 1.15);
      const chG = clamp01((fbmMid * 0.58 + puffMid * 0.24 + chR * 0.28 - 0.08) * 1.16);

      // B: High-frequency wispy cloud edge erosion turbulence
      const fbmWisp = fbmWispSampler(uw, vw);
      const chB = clamp01(fbmWisp * 0.65 + chR * 0.35);

      const p = (rowBase + x) << 2;
      dst[p] = (chR * 255 + 0.5) | 0;
      dst[p + 1] = (chG * 255 + 0.5) | 0;
      dst[p + 2] = (chB * 255 + 0.5) | 0;
      dst[p + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  // Linear noise data texture (no SRGB) for accurate shader math
  return createTex(canvas, { isColor: false, repeat: true });
}

// ---------------------------------------------------------------------------
// 10. softGlowDisc — 128x128 Anti-Banded Radial Gaussian Glow Disc
// ---------------------------------------------------------------------------

function buildSoftGlowDisc(createTex) {
  const size = 128;
  const half = (size - 1) * 0.5;
  const invR = 1.0 / (size * 0.485);

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const dst = img.data;

  // 256-entry LUT over r^2 in [0, 1] avoids per-pixel Math.exp / Math.sqrt
  const lutLen = 256;
  const radialLUT = new Float32Array(lutLen + 1);
  for (let i = 0; i <= lutLen; i++) {
    const r2 = i / lutLen;
    const r = Math.sqrt(r2);
    const coreGauss = Math.exp(-5.2 * r2);
    const haloGauss = Math.exp(-1.95 * r2);
    const edgeWindow = 1.0 - smoothstep(0.74, 0.99, r);
    radialLUT[i] = (coreGauss * 0.72 + haloGauss * 0.28) * edgeWindow;
  }

  const ditherScale = 0.45 / 255.0;

  for (let y = 0; y < size; y++) {
    const dy = (y - half) * invR;
    const dy2 = dy * dy;
    const rowBase = y * size;

    for (let x = 0; x < size; x++) {
      const dx = (x - half) * invR;
      const r2 = dx * dx + dy2;
      const p = (rowBase + x) << 2;

      if (r2 >= 1.0) {
        dst[p] = 255;
        dst[p + 1] = 255;
        dst[p + 2] = 255;
        dst[p + 3] = 0;
        continue;
      }

      const fIdx = r2 * lutLen;
      const i0 = fIdx | 0;
      const frac = fIdx - i0;
      const rawAlpha = radialLUT[i0] + (radialLUT[i0 + 1] - radialLUT[i0]) * frac;

      // Subtle deterministic triangular dither removes 8-bit concentric banding on large glow quads
      const dither = (hash2i(x, y, 10103) + hash2i(x, y, 10211) - 1.0) * ditherScale;
      const aByte = (clamp01(rawAlpha + dither) * 255 + 0.5) | 0;

      dst[p] = 255;
      dst[p + 1] = 255;
      dst[p + 2] = 255;
      dst[p + 3] = aByte;
    }
  }

  ctx.putImageData(img, 0, 0);
  return createTex(canvas, { isColor: true, repeat: false });
}

// ---------------------------------------------------------------------------
// Public Entry Point (Lazy On-Demand Cached Library)
// ---------------------------------------------------------------------------

/**
 * Creates the lazy on-demand procedural PBR & emissive texture suite for the HD-2D 3D stage.
 * Each texture group is generated once on first property access and cached.
 * Calling `dispose()` only disposes textures that were actually generated.
 * @param {object} THREE - Three.js module namespace
 */
export function createPBRTextureLibrary(THREE) {
  const textures = [];
  const createTex = makeTextureFactory(THREE, textures);
  const cache = Object.create(null);

  let disposed = false;

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (let i = 0; i < textures.length; i++) {
      if (textures[i] && typeof textures[i].dispose === 'function') {
        textures[i].dispose();
      }
    }
    textures.length = 0;
  }

  const lib = { dispose };

  const builders = {
    courtyardStone: buildCourtyardStone,
    marble: buildMarble,
    iceCrystal: buildIceCrystal,
    snowGround: buildSnowGround,
    darkBark: buildDarkBark,
    stainedGlass: buildStainedGlass,
    arcaneFloorDecal: buildArcaneFloorDecal,
    bannerFabric: buildBannerFabric,
    cloudNoise: buildCloudNoise,
    softGlowDisc: buildSoftGlowDisc,
  };

  for (const key of Object.keys(builders)) {
    const builder = builders[key];
    Object.defineProperty(lib, key, {
      enumerable: true,
      configurable: true,
      get() {
        if (!(key in cache)) {
          cache[key] = builder(createTex);
        }
        return cache[key];
      },
    });
  }

  return lib;
}
