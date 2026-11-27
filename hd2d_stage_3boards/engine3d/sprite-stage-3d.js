/**
 * sprite-stage-3d.js
 * HD-2D True-3D Pixel Sprite Stage Bridge + Camera Director + 3D Skill VFX Engine
 *
 * Bridges window.PIXEL_SPRITE_BANK (22 zero-PNG RLE pixel skeletons) into Three.js 3D space:
 * - Zero-dependency RLE decoder with exact BANK_CHARS lookup & offscreen CanvasTexture cache
 * - Crisp NearestFilter + alphaTest hardware Z-buffer sorting + shadow casting + balanced emissive
 * - Automatic opaque bounding-box measurement from frame 0 for true visible-height world scaling
 * - Exact feet-to-ground placement & automatic facing correction (ally -> right, enemy -> left)
 * - Soft ground contact shadow + royal-blue/gold active ring & coral/ice-cyan enemy reticle
 * - Smooth damped 3D camera director (breathing, mouse parallax, focus modes, trauma shake)
 * - 4 luminous 3D practical skill demos ('ice', 'water', 'starfrost', 'shield') with impact callback
 * - Exact 3D->2D visible-height screen projection & alpha-aware 3D raycast picking
 */

const BANK_CHARS =
  '.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~';

const BANK_CHAR_LUT = new Int8Array(128);
BANK_CHAR_LUT.fill(-1);
for (let i = 0; i < BANK_CHARS.length; i++) {
  const code = BANK_CHARS.charCodeAt(i);
  if (code < 128) BANK_CHAR_LUT[code] = i;
}

const DEFAULT_CAMERA_LOOK_AT = [0, 1.35, 0];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

function easeOutBack(t) {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.trim();
  if (clean.charCodeAt(0) === 35) clean = clean.slice(1);
  if (clean.length === 3) {
    clean =
      clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function parseVec3Input(input, fallback) {
  if (Array.isArray(input) && input.length >= 3) {
    return [
      Number(input[0]) || 0,
      Number(input[1]) || 0,
      Number(input[2]) || 0,
    ];
  }
  if (input && typeof input === 'object') {
    return [
      Number(input.x) || 0,
      Number(input.y) || 0,
      Number(input.z) || 0,
    ];
  }
  return fallback.slice();
}

function normalizeRgbColor(input, targetColor) {
  if (!input) {
    targetColor.setRGB(1, 1, 1);
    return;
  }
  if (Array.isArray(input) && input.length >= 3) {
    let r = Number(input[0]);
    let g = Number(input[1]);
    let b = Number(input[2]);
    if (!Number.isFinite(r)) r = 1;
    if (!Number.isFinite(g)) g = 1;
    if (!Number.isFinite(b)) b = 1;
    if (r > 1 || g > 1 || b > 1) {
      r /= 255;
      g /= 255;
      b /= 255;
    }
    targetColor.setRGB(clamp(r, 0, 2), clamp(g, 0, 2), clamp(b, 0, 2));
    return;
  }
  if (typeof input === 'object' && input.isColor) {
    targetColor.copy(input);
    return;
  }
  if (typeof input === 'object' && 'r' in input && 'g' in input && 'b' in input) {
    let { r, g, b } = input;
    if (r > 1 || g > 1 || b > 1) {
      r /= 255;
      g /= 255;
      b /= 255;
    }
    targetColor.setRGB(clamp(r, 0, 2), clamp(g, 0, 2), clamp(b, 0, 2));
    return;
  }
  try {
    targetColor.set(input);
  } catch (_) {
    targetColor.setRGB(1, 1, 1);
  }
}

function normalizeSkillType(raw) {
  const s = String(raw || 'ice').toLowerCase();
  if (s.includes('shield') || s.includes('barrier') || s.includes('guard')) {
    return 'shield';
  }
  if (
    s.includes('starfrost') ||
    s.includes('frost') ||
    s.includes('beam') ||
    s.includes('pillar') ||
    s.includes('ult')
  ) {
    return 'starfrost';
  }
  if (s.includes('water') || s.includes('aqua') || s.includes('surge') || s.includes('blade')) {
    return 'water';
  }
  return 'ice';
}

/* ---------------- Procedural High-Craft Textures (Fallback & Ground Rings) ---------------- */

function createSoftGlowDiscTexture(THREE, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.32, 'rgba(255,255,255,0.72)');
  grad.addColorStop(0.66, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createAllyOuterRingTexture(THREE, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;
  const rOuter = size * 0.44;
  const rInner = size * 0.385;

  ctx.clearRect(0, 0, size, size);

  // Soft royal-blue glow band
  ctx.save();
  ctx.strokeStyle = 'rgba(22, 88, 235, 0.42)';
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.arc(cx, cy, (rOuter + rInner) * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Crisp outer royal-blue & ice-cyan ring
  ctx.strokeStyle = '#6ce8ff';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(72, 149, 255, 0.92)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.stroke();

  // 8 crystal diamond nodes around circumference
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const isMajor = i % 2 === 0;
    const rr = isMajor ? rOuter : (rOuter + rInner) * 0.5;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    const d = isMajor ? size * 0.026 : size * 0.015;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = isMajor ? '#ffe399' : '#b8f4ff';
    ctx.beginPath();
    ctx.moveTo(d * 1.3, 0);
    ctx.lineTo(0, d * 0.7);
    ctx.lineTo(-d * 1.3, 0);
    ctx.lineTo(0, -d * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Subtle dashed arcane ticks
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 211, 128, 0.75)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 24; i++) {
    if (i % 3 === 0) continue;
    const a = (i * Math.PI * 2) / 24;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (rInner - 2), cy + Math.sin(a) * (rInner - 2));
    ctx.lineTo(cx + Math.cos(a) * (rInner + 6), cy + Math.sin(a) * (rInner + 6));
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createAllyInnerRingTexture(THREE, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.31;

  ctx.clearRect(0, 0, size, size);

  // Champagne-gold inner circle
  ctx.strokeStyle = 'rgba(248, 213, 126, 0.92)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inscribed gold 4-point star diamond
  ctx.strokeStyle = 'rgba(255, 232, 165, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Secondary rotated ice-blue square
  ctx.strokeStyle = 'rgba(122, 224, 255, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const x = cx + Math.cos(a) * (r * 0.96);
    const y = cy + Math.sin(a) * (r * 0.96);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createEnemyOuterReticleTexture(THREE, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.43;

  ctx.clearRect(0, 0, size, size);

  // Soft coral-red glow ring
  ctx.strokeStyle = 'rgba(255, 77, 109, 0.34)';
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 4 segmented crisp coral-red target brackets
  ctx.strokeStyle = '#ff5778';
  ctx.lineWidth = 3.8;
  const arcSpan = Math.PI * 0.32;
  for (let i = 0; i < 4; i++) {
    const mid = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, mid - arcSpan * 0.5, mid + arcSpan * 0.5);
    ctx.stroke();
  }

  // 4 inward-pointing sharp targeting arrowheads at cardinal angles
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ff859b';
    ctx.beginPath();
    ctx.moveTo(r - size * 0.055, 0);
    ctx.lineTo(r + size * 0.025, -size * 0.026);
    ctx.lineTo(r + size * 0.008, 0);
    ctx.lineTo(r + size * 0.025, size * 0.026);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createEnemyInnerReticleTexture(THREE, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.315;

  ctx.clearRect(0, 0, size, size);

  // Ice-cyan precision crosshair ring
  ctx.strokeStyle = 'rgba(110, 231, 255, 0.92)';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Diamond crosshair pips
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = '#bff6ff';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createPlaceholderSpriteTexture(THREE, label = '?') {
  const w = 64;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(18, 18, 28, 70);
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(22, 22, 20, 20);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(22, 46, 20, 38);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return {
    canvas,
    texture: tex,
    rgba,
    width: w,
    height: h,
    visBBox: { minX: 18, maxX: 45, minY: 18, maxY: 87, visW: 28, visH: 70 },
    anchors: { feet: [32, 87], cast: [50, 48], hit: [32, 52], head: [32, 24] },
    facing: 'right',
    frameCount: 1,
    label,
  };
}

/* ============================== Main Stage Factory ============================== */

export function createSpriteStage3D(THREE, scene, camera, texLib) {
  const safeTexLib = texLib || {};
  const ownedTextures = [];
  const ownedGeometries = [];
  const frameCache = new Map(); // `${spriteId}:${frameIdx}` -> { canvas, texture, rgba, width, height }
  let placeholderCache = null;

  const softGlowTex =
    safeTexLib.softGlowDisc ||
    (() => {
      const t = createSoftGlowDiscTexture(THREE, 128);
      ownedTextures.push(t);
      return t;
    })();

  const allyOuterRingTex = createAllyOuterRingTexture(THREE, 256);
  const allyInnerRingTex = createAllyInnerRingTexture(THREE, 256);
  const enemyOuterRingTex = createEnemyOuterReticleTexture(THREE, 256);
  const enemyInnerRingTex = createEnemyInnerReticleTexture(THREE, 256);
  ownedTextures.push(
    allyOuterRingTex,
    allyInnerRingTex,
    enemyOuterRingTex,
    enemyInnerRingTex
  );

  // Root groups
  const stageGroup = new THREE.Group();
  stageGroup.name = 'SpriteStage3D';
  const actorsGroup = new THREE.Group();
  actorsGroup.name = 'SpriteStage3D_Actors';
  const vfxGroup = new THREE.Group();
  vfxGroup.name = 'SpriteStage3D_VFX';
  stageGroup.add(actorsGroup);
  stageGroup.add(vfxGroup);
  if (scene) scene.add(stageGroup);

  // Reusable dynamic point light for 3D skill glow on floor/environment
  const vfxLight = new THREE.PointLight(0x6ce8ff, 0, 12, 1.8);
  vfxLight.position.set(0, 2.2, 0);
  vfxGroup.add(vfxLight);

  // Shared unit geometries for 3D skill VFX (disposed only in stage.dispose())
  const unitRingGeo = new THREE.RingGeometry(0.76, 1.0, 32);
  unitRingGeo.rotateX(-Math.PI / 2);
  const unitThinRingGeo = new THREE.RingGeometry(0.90, 1.0, 32);
  unitThinRingGeo.rotateX(-Math.PI / 2);
  const unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
  const unitDiscGeo = new THREE.PlaneGeometry(1, 1);
  unitDiscGeo.rotateX(-Math.PI / 2);
  const unitCrystalShardGeo = new THREE.OctahedronGeometry(0.14, 0);
  const unitDropletGeo = new THREE.SphereGeometry(0.11, 8, 6);
  const unitSphereGeo = new THREE.SphereGeometry(1, 16, 12);
  const unitTorusGeo = new THREE.TorusGeometry(1, 0.075, 10, 32);
  const unitCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
  const unitSpireGeo = new THREE.ConeGeometry(0.24, 1.45, 5);
  unitSpireGeo.translate(0, 0.725, 0);
  const unitDomeGeo = new THREE.IcosahedronGeometry(1, 1);

  // Faceted double-ended crystal lance oriented along +Z for easy lookAt()
  const unitLanceTipGeo = new THREE.ConeGeometry(0.16, 0.85, 6);
  unitLanceTipGeo.rotateX(Math.PI / 2);
  unitLanceTipGeo.translate(0, 0, 0.425);
  const unitLanceTailGeo = new THREE.ConeGeometry(0.16, 0.45, 6);
  unitLanceTailGeo.rotateX(-Math.PI / 2);
  unitLanceTailGeo.translate(0, 0, -0.225);

  ownedGeometries.push(
    unitRingGeo,
    unitThinRingGeo,
    unitPlaneGeo,
    unitDiscGeo,
    unitCrystalShardGeo,
    unitDropletGeo,
    unitSphereGeo,
    unitTorusGeo,
    unitCylinderGeo,
    unitSpireGeo,
    unitDomeGeo,
    unitLanceTipGeo,
    unitLanceTailGeo
  );

  // State
  const actors = [];
  const actorMap = new Map();
  const activeEffects = [];
  let activeActorId = null;
  let selectedEnemyId = null;
  let rimTintColor = new THREE.Color(1, 1, 1);
  let dimEnabled = false;
  let dimFocusSet = new Set();
  let lastViewportW =
    typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1440;
  let lastViewportH =
    typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 900;
  let hasUpdatedOnce = false;
  let lastElapsedSec = 0;

  // Camera Director State
  const camState = {
    configured: false,
    basePos: camera ? camera.position.clone() : new THREE.Vector3(0, 4.4, 13.5),
    baseLookAt: new THREE.Vector3(...DEFAULT_CAMERA_LOOK_AT),
    baseFov: camera && typeof camera.fov === 'number' ? camera.fov : 34,
    curPos: camera ? camera.position.clone() : new THREE.Vector3(0, 4.4, 13.5),
    curLookAt: new THREE.Vector3(...DEFAULT_CAMERA_LOOK_AT),
    curFov: camera && typeof camera.fov === 'number' ? camera.fov : 34,
    damping: 5.4,
    parallaxX: 0.42,
    parallaxY: 0.18,
    breatheAmp: 0.055,
    pointerTargetX: 0,
    pointerTargetY: 0,
    pointerX: 0,
    pointerY: 0,
    focusMode: 'default',
    focusActorId: null,
    shakeTrauma: 0,
  };

  // Reusable scratch math objects (zero per-frame allocations)
  const _tmpV0 = new THREE.Vector3();
  const _tmpV1 = new THREE.Vector3();
  const _tmpV2 = new THREE.Vector3();
  const _tmpV3 = new THREE.Vector3();
  const _tmpV4 = new THREE.Vector3();
  const _tmpDir = new THREE.Vector3();
  const _tmpCamForward = new THREE.Vector3();
  const _tmpGoalPos = new THREE.Vector3();
  const _tmpGoalLook = new THREE.Vector3();
  const _tmpColorA = new THREE.Color();
  const _tmpColorB = new THREE.Color();
  const _whiteColor = new THREE.Color(1, 1, 1);
  const _flashColor = new THREE.Color(0xeef9ff);
  const _raycaster = new THREE.Raycaster();
  const _ndcVec = new THREE.Vector2();

  /* ---------------- RLE Pixel Bank Decoder & Opaque BBox ---------------- */

  function getBankEntry(spriteId) {
    const bank =
      typeof globalThis !== 'undefined' ? globalThis.PIXEL_SPRITE_BANK : null;
    if (!bank || typeof bank !== 'object') return null;
    const entry = bank[spriteId];
    if (
      !entry ||
      !(entry.w > 0) ||
      !(entry.h > 0) ||
      !Array.isArray(entry.palette) ||
      !Array.isArray(entry.frames) ||
      entry.frames.length === 0
    ) {
      return null;
    }
    return entry;
  }

  function decodeBankFrameToCache(spriteId, frameIdx) {
    const entry = getBankEntry(spriteId);
    if (!entry) {
      if (!placeholderCache) {
        placeholderCache = createPlaceholderSpriteTexture(THREE, spriteId);
        ownedTextures.push(placeholderCache.texture);
      }
      return placeholderCache;
    }

    const idx = clamp(frameIdx | 0, 0, entry.frames.length - 1);
    const cacheKey = `${spriteId}:${idx}`;
    const existing = frameCache.get(cacheKey);
    if (existing) return existing;

    const w = entry.w | 0;
    const h = entry.h | 0;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const palRgb =
      entry._palRgb || (entry._palRgb = entry.palette.map(hexToRgbTriplet));
    const rows = entry.frames[idx] || [];

    const shouldMeasureBBox = idx === 0 && !entry._visBBox;
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;

    for (let y = 0; y < h && y < rows.length; y++) {
      const row = rows[y];
      if (typeof row !== 'string' || !row.length) continue;
      const rowOff = y * w;
      const rLen = row.length;
      let x = 0;
      for (let i = 0; i < rLen && x < w; i++) {
        const code = row.charCodeAt(i);
        let rep = 1;
        if (i + 1 < rLen && row.charCodeAt(i + 1) === 42) {
          // '*' RLE count
          let j = i + 2;
          let n = 0;
          while (j < rLen) {
            const d = row.charCodeAt(j) - 48;
            if (d < 0 || d > 9) break;
            n = n * 10 + d;
            j++;
          }
          rep = n > 0 ? n : 1;
          i = j - 1;
        }
        if (code === 46) {
          // '.' transparent skip
          x += rep;
          continue;
        }
        const pi = code < 128 ? BANK_CHAR_LUT[code] : -1;
        const rgb = pi > 0 ? palRgb[pi] : null;
        if (!rgb) {
          x += rep;
          continue;
        }
        const r = rgb[0];
        const g = rgb[1];
        const b = rgb[2];
        const endX = x + rep < w ? x + rep : w;
        if (shouldMeasureBBox && x < endX) {
          if (x < minX) minX = x;
          if (endX - 1 > maxX) maxX = endX - 1;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        for (; x < endX; x++) {
          const off = (rowOff + x) << 2;
          rgba[off] = r;
          rgba[off + 1] = g;
          rgba[off + 2] = b;
          rgba[off + 3] = 255;
        }
      }
    }

    if (shouldMeasureBBox) {
      if (maxX < minX || maxY < minY) {
        entry._visBBox = {
          minX: 0,
          maxX: w - 1,
          minY: 0,
          maxY: h - 1,
          visW: w,
          visH: h,
        };
      } else {
        entry._visBBox = {
          minX,
          maxX,
          minY,
          maxY,
          visW: maxX - minX + 1,
          visH: maxY - minY + 1,
        };
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      const imgData = new ImageData(rgba, w, h);
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    const record = { canvas, texture, rgba, width: w, height: h };
    frameCache.set(cacheKey, record);
    return record;
  }

  function ensureFrame0AndBBox(spriteId) {
    const entry = getBankEntry(spriteId);
    const frame0 = decodeBankFrameToCache(spriteId, 0);
    if (!entry) {
      return {
        entry: null,
        frame0,
        visBBox: frame0.visBBox,
        anchors: frame0.anchors,
        facing: frame0.facing,
        w: frame0.width,
        h: frame0.height,
        frameCount: 1,
      };
    }
    if (!entry._visBBox) {
      // Force scan if frame 0 existed without _visBBox
      const w = entry.w | 0;
      const h = entry.h | 0;
      const rgba = frame0.rgba;
      let minX = w;
      let maxX = -1;
      let minY = h;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        const rowOff = y * w;
        for (let x = 0; x < w; x++) {
          if (rgba[((rowOff + x) << 2) + 3] > 127) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      entry._visBBox =
        maxX >= minX && maxY >= minY
          ? {
              minX,
              maxX,
              minY,
              maxY,
              visW: maxX - minX + 1,
              visH: maxY - minY + 1,
            }
          : { minX: 0, maxX: w - 1, minY: 0, maxY: h - 1, visW: w, visH: h };
    }
    return {
      entry,
      frame0,
      visBBox: entry._visBBox,
      anchors: entry.anchors || {},
      facing: entry.facing || 'right',
      w: entry.w | 0,
      h: entry.h | 0,
      frameCount: entry.frames.length,
    };
  }

  /* ---------------- Actor Lifecycle & Materials ---------------- */

  function clearFormation() {
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      actorsGroup.remove(a.root);
      a.spriteGeo.dispose();
      a.spriteMat.dispose();
      a.depthMat.dispose();
      a.shadowMat.dispose();
      a.outerRingMat.dispose();
      a.innerRingMat.dispose();
      a.auraMat.dispose();
    }
    actors.length = 0;
    actorMap.clear();
  }

  function applyActorFrame(actor, frameIdx) {
    const clampedIdx = clamp(frameIdx | 0, 0, Math.max(0, actor.frameCount - 1));
    if (actor.currentFrame === clampedIdx && actor.currentFrameData) return;
    const data = decodeBankFrameToCache(actor.spriteId, clampedIdx);
    actor.currentFrame = clampedIdx;
    actor.currentFrameData = data;
    if (actor.spriteMat.map !== data.texture) {
      actor.spriteMat.map = data.texture;
      actor.spriteMat.emissiveMap = data.texture;
      actor.depthMat.map = data.texture;
    }
  }

  function updateActorMaterialTint(actor) {
    // Combine atmospheric rimTint + non-focus dimming + hit flash
    const dim = actor.dimFactor;
    const flash = actor.hurtFlash;

    // Subtle atmospheric blend (38% on diffuse, 18% on emissive) preserving crisp pixel hues
    _tmpColorA.copy(_whiteColor).lerp(rimTintColor, 0.38);
    actor.spriteMat.color.copy(_tmpColorA).multiplyScalar(dim);

    _tmpColorB.copy(_whiteColor).lerp(rimTintColor, 0.18);
    if (flash > 0.001) {
      _tmpColorB.lerp(_flashColor, clamp(flash * 0.85, 0, 1));
    }
    actor.spriteMat.emissive.copy(_tmpColorB);

    const baseEmissive = 0.52 * dim;
    const activeBoost = actor.id === activeActorId ? 0.06 : 0;
    const flashBoost = flash * 0.78;
    actor.spriteMat.emissiveIntensity = baseEmissive + activeBoost + flashBoost;
  }

  function isActorFocused(actorId) {
    if (!dimEnabled) return true;
    if (dimFocusSet.size > 0) return dimFocusSet.has(actorId);
    if (actorId === activeActorId || actorId === selectedEnemyId) return true;
    return false;
  }

  function setFormation(specs) {
    clearFormation();
    if (!Array.isArray(specs)) return;

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (!spec) continue;

      const id = String(spec.id ?? spec.spriteId ?? `actor_${i}`);
      const spriteId = String(
        spec.spriteId ?? spec.sprite ?? spec.spriteKey ?? 'sylvia_silver'
      );
      const side = spec.side === 'enemy' ? 'enemy' : 'ally';
      const pos = parseVec3Input(spec.pos ?? spec.position, [0, 0, 0]);
      const heightWorld =
        Number(spec.heightWorld ?? spec.height ?? 2.4) > 0
          ? Number(spec.heightWorld ?? spec.height ?? 2.4)
          : 2.4;

      const info = ensureFrame0AndBBox(spriteId);
      const { entry, frame0, visBBox, anchors, facing, w, h, frameCount } = info;

      const pixelScale = heightWorld / Math.max(1, visBBox.visH);
      const planeW = w * pixelScale;
      const planeH = h * pixelScale;
      const visWorldW = visBBox.visW * pixelScale;

      const feetXpx =
        anchors.feet && Number.isFinite(anchors.feet[0])
          ? anchors.feet[0]
          : (visBBox.minX + visBBox.maxX + 1) * 0.5;
      const feetYpx =
        anchors.feet && Number.isFinite(anchors.feet[1])
          ? anchors.feet[1]
          : visBBox.maxY;

      const desiredFacing =
        spec.facing || (side === 'ally' ? 'right' : 'left');
      const baseFlipX = facing !== desiredFacing ? -1 : 1;

      // Exact feet grounding: meshY = groundY + ((feetY / h) - 0.5) * planeH
      // Since root is placed at (pos[0], groundY, pos[2]), meshLocalY = ((feetY / h) - 0.5) * planeH
      const meshLocalY = (feetYpx / h - 0.5) * planeH;
      const meshLocalX = -((feetXpx / w - 0.5) * planeW) * baseFlipX;

      const root = new THREE.Group();
      root.name = `Actor_${id}`;
      root.position.set(pos[0], pos[1], pos[2]);

      // Ground Contact Shadow (y = 0.015)
      const shadowRx = Math.max(
        0.48,
        Math.min(visWorldW * 0.48, heightWorld * 0.78)
      );
      const shadowRz = Math.max(0.22, Math.min(shadowRx * 0.42, 0.74));
      const shadowMat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: new THREE.Color(0x0d1b33),
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const shadowMesh = new THREE.Mesh(unitDiscGeo, shadowMat);
      shadowMesh.position.set(0, 0.015, 0);
      shadowMesh.scale.set(shadowRx * 2.05, 1, shadowRz * 2.05);
      shadowMesh.renderOrder = 1;
      root.add(shadowMesh);

      // 3D Ground Magic Selection Ring (visible only when active ally or selected enemy)
      const ringRadius =
        Number(spec.ringRadius) > 0
          ? Number(spec.ringRadius)
          : Math.max(0.76, Math.min(visWorldW * 0.52, heightWorld * 0.62));
      const ringGroup = new THREE.Group();
      ringGroup.position.set(0, 0.024, 0);
      ringGroup.visible = false;

      const isEnemy = side === 'enemy';
      const outerRingMat = new THREE.MeshBasicMaterial({
        map: isEnemy ? enemyOuterRingTex : allyOuterRingTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const outerRingMesh = new THREE.Mesh(unitDiscGeo, outerRingMat);
      outerRingMesh.scale.set(ringRadius * 2.35, 1, ringRadius * 2.35);
      outerRingMesh.renderOrder = 2;

      const innerRingMat = new THREE.MeshBasicMaterial({
        map: isEnemy ? enemyInnerRingTex : allyInnerRingTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const innerRingMesh = new THREE.Mesh(unitDiscGeo, innerRingMat);
      innerRingMesh.position.y = 0.004;
      innerRingMesh.scale.set(ringRadius * 2.15, 1, ringRadius * 2.15);
      innerRingMesh.renderOrder = 3;

      const auraMat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: new THREE.Color(isEnemy ? 0xff4d6d : 0x2574ff),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const auraMesh = new THREE.Mesh(unitDiscGeo, auraMat);
      auraMesh.position.y = -0.004;
      auraMesh.scale.set(ringRadius * 2.6, 1, ringRadius * 2.6);
      auraMesh.renderOrder = 1;

      ringGroup.add(auraMesh, outerRingMesh, innerRingMesh);
      root.add(ringGroup);

      // Sprite Pivot (anchored at feet y=0 for clean breathing/squash/lunge)
      const spritePivot = new THREE.Group();
      spritePivot.position.set(0, 0, 0);
      root.add(spritePivot);

      const spriteGeo = new THREE.PlaneGeometry(planeW, planeH);
      const spriteMat = new THREE.MeshStandardMaterial({
        map: frame0.texture,
        emissiveMap: frame0.texture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.52,
        color: new THREE.Color(0xffffff),
        roughness: 0.92,
        metalness: 0.0,
        alphaTest: 0.5,
        transparent: false,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
      const depthMat = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: frame0.texture,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });

      const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
      spriteMesh.position.set(meshLocalX, meshLocalY, 0);
      spriteMesh.scale.set(baseFlipX, 1, 1);
      spriteMesh.castShadow = true;
      spriteMesh.receiveShadow = false;
      spriteMesh.customDepthMaterial = depthMat;
      spriteMesh.userData.actorId = id;
      spritePivot.add(spriteMesh);

      actorsGroup.add(root);

      const actor = {
        id,
        name: spec.name || spec.label || id,
        spriteId,
        side,
        basePos: new THREE.Vector3(pos[0], pos[1], pos[2]),
        heightWorld,
        pixelScale,
        planeW,
        planeH,
        visWorldW,
        w,
        h,
        visBBox,
        anchors,
        feetXpx,
        feetYpx,
        frameCount,
        animMap: entry && entry.animMap ? entry.animMap : null,
        baseFlipX,
        meshLocalX,
        meshLocalY,
        shadowRx,
        shadowRz,
        ringRadius,
        root,
        shadowMesh,
        shadowMat,
        ringGroup,
        outerRingMesh,
        outerRingMat,
        innerRingMesh,
        innerRingMat,
        auraMesh,
        auraMat,
        spritePivot,
        spriteGeo,
        spriteMat,
        depthMat,
        spriteMesh,
        currentFrame: 0,
        currentFrameData: frame0,
        phase: i * 0.79 + hashString(id) * 4.2,
        blinkInterval: 3.1 + hashString(`${id}_blink`) * 2.1,
        dimFactor: isActorFocused(id) ? 1.0 : 0.62,
        ringOpacity: 0,
        // Action / Combat Demo state
        actionMode: 'idle', // 'idle' | 'cast' | 'hurt'
        actionTimer: 0,
        actionDuration: 0,
        castFrames: [3, 4, 5],
        lungeDir: new THREE.Vector3(side === 'ally' ? 1 : -1, 0, 0),
        hurtFlash: 0,
        recoilOffset: new THREE.Vector3(),
      };

      updateActorMaterialTint(actor);
      actors.push(actor);
      actorMap.set(id, actor);
    }

    if (activeActorId && !actorMap.has(activeActorId)) activeActorId = null;
    if (selectedEnemyId && !actorMap.has(selectedEnemyId)) selectedEnemyId = null;

    syncRingVisibilityImmediate();
    stageGroup.updateMatrixWorld(true);
  }

  function syncRingVisibilityImmediate() {
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      const shouldShow = a.id === activeActorId || a.id === selectedEnemyId;
      if (shouldShow && a.ringOpacity < 0.72) {
        a.ringOpacity = hasUpdatedOnce ? Math.max(a.ringOpacity, 0.55) : 1.0;
        a.ringGroup.visible = true;
        a.outerRingMat.opacity = a.ringOpacity * 0.96;
        a.innerRingMat.opacity = a.ringOpacity * 0.88;
        a.auraMat.opacity = a.ringOpacity * (a.side === 'enemy' ? 0.24 : 0.28);
      } else if (!shouldShow && !hasUpdatedOnce) {
        a.ringOpacity = 0;
        a.ringGroup.visible = false;
      }
    }
  }

  function setActiveActor(id) {
    activeActorId = id && actorMap.has(String(id)) ? String(id) : id ? String(id) : null;
    syncRingVisibilityImmediate();
    for (let i = 0; i < actors.length; i++) updateActorMaterialTint(actors[i]);
  }

  function setSelectedEnemy(id) {
    selectedEnemyId = id && actorMap.has(String(id)) ? String(id) : id ? String(id) : null;
    syncRingVisibilityImmediate();
    for (let i = 0; i < actors.length; i++) updateActorMaterialTint(actors[i]);
  }

  function setRimTint(rgbArr) {
    normalizeRgbColor(rgbArr, rimTintColor);
    for (let i = 0; i < actors.length; i++) {
      updateActorMaterialTint(actors[i]);
    }
  }

  function setDimNonFocus(enabled, focusIds) {
    dimEnabled = Boolean(enabled);
    dimFocusSet = new Set();
    if (Array.isArray(focusIds)) {
      for (let i = 0; i < focusIds.length; i++) {
        if (focusIds[i] != null) dimFocusSet.add(String(focusIds[i]));
      }
    } else if (focusIds instanceof Set) {
      focusIds.forEach((v) => {
        if (v != null) dimFocusSet.add(String(v));
      });
    } else if (typeof focusIds === 'string' && focusIds.length > 0) {
      dimFocusSet.add(focusIds);
    }

    if (!hasUpdatedOnce) {
      for (let i = 0; i < actors.length; i++) {
        const a = actors[i];
        a.dimFactor = isActorFocused(a.id) ? 1.0 : 0.62;
        updateActorMaterialTint(a);
      }
    }
  }

  /* ---------------- Dynamic 3D Camera Director ---------------- */

  function setCameraConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    if (cfg.position || cfg.pos) {
      const p = parseVec3Input(cfg.position ?? cfg.pos, [
        camState.basePos.x,
        camState.basePos.y,
        camState.basePos.z,
      ]);
      camState.basePos.set(p[0], p[1], p[2]);
    }
    if (cfg.lookAt || cfg.target) {
      const l = parseVec3Input(cfg.lookAt ?? cfg.target, [
        camState.baseLookAt.x,
        camState.baseLookAt.y,
        camState.baseLookAt.z,
      ]);
      camState.baseLookAt.set(l[0], l[1], l[2]);
    }
    if (Number.isFinite(cfg.fov) && cfg.fov > 5 && cfg.fov < 120) {
      camState.baseFov = cfg.fov;
    }
    if (Number.isFinite(cfg.damping) && cfg.damping > 0) {
      camState.damping = cfg.damping;
    }
    if (Number.isFinite(cfg.parallaxX)) camState.parallaxX = cfg.parallaxX;
    if (Number.isFinite(cfg.parallaxY)) camState.parallaxY = cfg.parallaxY;
    if (Number.isFinite(cfg.breatheAmp)) camState.breatheAmp = cfg.breatheAmp;

    const shouldSnap = !camState.configured || cfg.immediate === true;
    camState.configured = true;
    if (shouldSnap && camera) {
      camState.curPos.copy(camState.basePos);
      camState.curLookAt.copy(camState.baseLookAt);
      camState.curFov = camState.baseFov;
      camera.position.copy(camState.curPos);
      if (typeof camera.fov === 'number' && Math.abs(camera.fov - camState.curFov) > 1e-4) {
        camera.fov = camState.curFov;
        camera.updateProjectionMatrix();
      }
      camera.lookAt(camState.curLookAt);
      camera.updateMatrixWorld(true);
    }
  }

  function setPointerNDC(x, y) {
    camState.pointerTargetX = clamp(Number(x) || 0, -1, 1);
    camState.pointerTargetY = clamp(Number(y) || 0, -1, 1);
  }

  function focusCameraOn(mode, actorId) {
    const m = String(mode || 'default').toLowerCase();
    if (m === 'reset' || m === 'overview' || m === 'default') {
      camState.focusMode = 'default';
      camState.focusActorId = null;
    } else if (m === 'actor' || m === 'ally') {
      camState.focusMode = 'actor';
      camState.focusActorId = actorId ? String(actorId) : activeActorId;
    } else if (m === 'enemy' || m === 'target') {
      camState.focusMode = 'enemy';
      camState.focusActorId = actorId ? String(actorId) : selectedEnemyId;
    } else if (m === 'clash' || m === 'skill' || m === 'impact') {
      camState.focusMode = 'clash';
      camState.focusActorId = actorId ? String(actorId) : activeActorId;
    } else {
      camState.focusMode = 'default';
      camState.focusActorId = null;
    }
  }

  function addCameraShake(amount) {
    camState.shakeTrauma = clamp(camState.shakeTrauma + amount, 0, 1);
  }

  function getActorTorsoWorldPos(actor, outVec) {
    return outVec.set(
      actor.basePos.x,
      actor.basePos.y + actor.heightWorld * 0.52,
      actor.basePos.z
    );
  }

  function updateCameraDirector(elapsedSec, dtSec) {
    if (!camera) return;

    const ptrAlpha = 1 - Math.exp(-6.5 * dtSec);
    camState.pointerX = lerp(camState.pointerX, camState.pointerTargetX, ptrAlpha);
    camState.pointerY = lerp(camState.pointerY, camState.pointerTargetY, ptrAlpha);

    // Base goal
    _tmpGoalPos.copy(camState.basePos);
    _tmpGoalLook.copy(camState.baseLookAt);
    let goalFov = camState.baseFov;

    if (camState.focusMode === 'actor' || camState.focusMode === 'enemy') {
      const fallbackId =
        camState.focusMode === 'actor' ? activeActorId : selectedEnemyId;
      const targetActor =
        actorMap.get(camState.focusActorId || fallbackId) ||
        actors.find((a) =>
          camState.focusMode === 'actor' ? a.side === 'ally' : a.side === 'enemy'
        );
      if (targetActor) {
        getActorTorsoWorldPos(targetActor, _tmpV0);
        // Gentle 1.08x push-in & subtle 28% focal shift (smooth & non-dizzying)
        _tmpGoalLook.lerp(_tmpV0, 0.30);
        _tmpV1.subVectors(_tmpV0, camState.basePos).multiplyScalar(0.085);
        _tmpGoalPos.add(_tmpV1);
        _tmpGoalPos.x = lerp(_tmpGoalPos.x, _tmpV0.x, 0.22);
        goalFov = camState.baseFov / 1.075;
      }
    } else if (camState.focusMode === 'clash') {
      const a1 =
        actorMap.get(camState.focusActorId || activeActorId) ||
        actors.find((a) => a.side === 'ally');
      const a2 =
        actorMap.get(selectedEnemyId) ||
        actors.find((a) => a.side === 'enemy');
      if (a1 && a2) {
        getActorTorsoWorldPos(a1, _tmpV0);
        getActorTorsoWorldPos(a2, _tmpV1);
        _tmpV0.add(_tmpV1).multiplyScalar(0.5);
        _tmpGoalLook.lerp(_tmpV0, 0.36);
        _tmpV2.subVectors(_tmpV0, camState.basePos).multiplyScalar(0.105);
        _tmpGoalPos.add(_tmpV2);
        _tmpGoalPos.y -= 0.18;
        goalFov = camState.baseFov / 1.10;
      } else if (a1 || a2) {
        getActorTorsoWorldPos(a1 || a2, _tmpV0);
        _tmpGoalLook.lerp(_tmpV0, 0.30);
        goalFov = camState.baseFov / 1.09;
      }
    }

    // Subtle organic breathing + diorama mouse parallax
    const breatheX = Math.sin(elapsedSec * 0.58) * camState.breatheAmp;
    const breatheY = Math.cos(elapsedSec * 0.84) * (camState.breatheAmp * 0.62);
    _tmpGoalPos.x += breatheX + camState.pointerX * camState.parallaxX;
    _tmpGoalPos.y += breatheY + camState.pointerY * camState.parallaxY;
    _tmpGoalLook.x += camState.pointerX * (camState.parallaxX * 0.28);
    _tmpGoalLook.y += camState.pointerY * (camState.parallaxY * 0.22);

    const alpha = 1 - Math.exp(-camState.damping * dtSec);
    camState.curPos.lerp(_tmpGoalPos, alpha);
    camState.curLookAt.lerp(_tmpGoalLook, alpha);
    camState.curFov = lerp(camState.curFov, goalFov, alpha);

    // Trauma-based damped micro-shake
    let shakeX = 0;
    let shakeY = 0;
    if (camState.shakeTrauma > 0.001) {
      const s = camState.shakeTrauma * camState.shakeTrauma;
      shakeX = Math.sin(elapsedSec * 57.3) * s * 0.16;
      shakeY = Math.cos(elapsedSec * 63.7) * s * 0.12;
      camState.shakeTrauma = Math.max(0, camState.shakeTrauma - dtSec * 2.55);
    }

    camera.position.set(
      camState.curPos.x + shakeX,
      camState.curPos.y + shakeY,
      camState.curPos.z
    );
    _tmpV3.set(
      camState.curLookAt.x + shakeX * 0.45,
      camState.curLookAt.y + shakeY * 0.45,
      camState.curLookAt.z
    );
    camera.lookAt(_tmpV3);

    if (
      typeof camera.fov === 'number' &&
      Math.abs(camera.fov - camState.curFov) > 1e-4
    ) {
      camera.fov = camState.curFov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  }

  /* ---------------- Pixel-to-World & 3D->2D Projection ---------------- */

  function getActorPixelWorldPos(actor, px, py, localZ, outVec) {
    const lx = (px / actor.w - 0.5) * actor.planeW;
    const ly = (0.5 - py / actor.h) * actor.planeH;
    outVec.set(lx, ly, localZ || 0);
    actor.spriteMesh.updateWorldMatrix(true, false);
    outVec.applyMatrix4(actor.spriteMesh.matrixWorld);
    return outVec;
  }

  function getActorCastWorldPos(actor, outVec) {
    const castPx =
      actor.anchors.cast && actor.anchors.cast.length >= 2
        ? actor.anchors.cast
        : [actor.w * 0.85, actor.h * 0.52];
    return getActorPixelWorldPos(actor, castPx[0], castPx[1], 0.12, outVec);
  }

  function getActorHitWorldPos(actor, outVec) {
    const hitPx =
      actor.anchors.hit && actor.anchors.hit.length >= 2
        ? actor.anchors.hit
        : [
            (actor.visBBox.minX + actor.visBBox.maxX + 1) * 0.5,
            (actor.visBBox.minY + actor.feetYpx) * 0.52,
          ];
    return getActorPixelWorldPos(actor, hitPx[0], hitPx[1], 0.14, outVec);
  }

  function projectWorldPoint(worldVec, viewportW, viewportH) {
    _tmpV4.copy(worldVec).project(camera);
    return {
      x: (_tmpV4.x * 0.5 + 0.5) * viewportW,
      y: (-_tmpV4.y * 0.5 + 0.5) * viewportH,
      ndcZ: _tmpV4.z,
    };
  }

  function projectAllActors(viewportW, viewportH) {
    const w = Number(viewportW) > 0 ? Number(viewportW) : lastViewportW;
    const h = Number(viewportH) > 0 ? Number(viewportH) : lastViewportH;
    lastViewportW = w;
    lastViewportH = h;

    const out = {};
    if (!camera) return out;
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(_tmpCamForward);

    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      a.spriteMesh.updateWorldMatrix(true, false);

      const midXpx = (a.visBBox.minX + a.visBBox.maxX + 1) * 0.5;
      const midYpx = (a.visBBox.minY + a.feetYpx) * 0.5;

      // Project true opaque feet, head, center, left & right
      getActorPixelWorldPos(a, a.feetXpx, a.feetYpx, 0, _tmpV0);
      const pFeet = projectWorldPoint(_tmpV0, w, h);

      getActorPixelWorldPos(a, midXpx, a.visBBox.minY, 0, _tmpV1);
      const pHead = projectWorldPoint(_tmpV1, w, h);

      getActorPixelWorldPos(a, midXpx, midYpx, 0, _tmpV2);
      const pCenter = projectWorldPoint(_tmpV2, w, h);
      const depthZ = _tmpV3
        .subVectors(_tmpV2, camera.position)
        .dot(_tmpCamForward);

      getActorPixelWorldPos(a, a.visBBox.minX, midYpx, 0, _tmpV0);
      const pLeft = projectWorldPoint(_tmpV0, w, h);

      getActorPixelWorldPos(a, a.visBBox.maxX + 1, midYpx, 0, _tmpV1);
      const pRight = projectWorldPoint(_tmpV1, w, h);

      const visibleHeightPx = Math.abs(pFeet.y - pHead.y);
      const visibleHeightPct = h > 0 ? (visibleHeightPx / h) * 100 : 0;
      const screenWidthPx = Math.abs(pRight.x - pLeft.x);

      const minSX = Math.min(pLeft.x, pRight.x);
      const maxSX = Math.max(pLeft.x, pRight.x);
      const minSY = Math.min(pHead.y, pFeet.y);
      const maxSY = Math.max(pHead.y, pFeet.y);

      const onScreen =
        pCenter.ndcZ >= -1 &&
        pCenter.ndcZ <= 1 &&
        depthZ > 0 &&
        maxSX >= 0 &&
        minSX <= w &&
        maxSY >= 0 &&
        minSY <= h;

      out[a.id] = {
        id: a.id,
        side: a.side,
        feetX: pFeet.x,
        feetY: pFeet.y,
        headX: pHead.x,
        headY: pHead.y,
        centerX: pCenter.x,
        centerY: pCenter.y,
        visibleHeightPx,
        visibleHeightPct,
        screenWidthPx,
        depthZ,
        onScreen,
      };
    }

    return out;
  }

  /* ---------------- Alpha- & Opaque-BBox-Aware 3D Raycasting ---------------- */

  function hasOpaquePixelNear(frameData, px, py, radius = 5) {
    if (!frameData || !frameData.rgba) return true;
    const { rgba, width, height } = frameData;
    const x0 = Math.max(0, px - radius);
    const x1 = Math.min(width - 1, px + radius);
    const y0 = Math.max(0, py - radius);
    const y1 = Math.min(height - 1, py + radius);
    for (let y = y0; y <= y1; y++) {
      const rowOff = y * width;
      for (let x = x0; x <= x1; x++) {
        if (rgba[((rowOff + x) << 2) + 3] > 127) return true;
      }
    }
    return false;
  }

  function raycastActor(ndcX, ndcY) {
    if (!camera || actors.length === 0) return null;
    camera.updateMatrixWorld(true);
    _ndcVec.set(Number(ndcX) || 0, Number(ndcY) || 0);
    _raycaster.setFromCamera(_ndcVec, camera);

    const meshes = [];
    for (let i = 0; i < actors.length; i++) {
      actors[i].spriteMesh.updateWorldMatrix(true, false);
      meshes.push(actors[i].spriteMesh);
    }

    const hits = _raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;

    let bboxFallbackId = null;
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const actorId = hit.object && hit.object.userData.actorId;
      const actor = actorMap.get(actorId);
      if (!actor) continue;

      if (!hit.uv) return actor.id;
      const px = Math.floor(hit.uv.x * actor.w);
      const py = Math.floor((1 - hit.uv.y) * actor.h);

      // Tier 1: Direct opaque pixel hit (with ergonomic ±5px tolerance)
      if (hasOpaquePixelNear(actor.currentFrameData, px, py, 5)) {
        return actor.id;
      }

      // Tier 2: Inside expanded visible bounding box (±6px)
      const bb = actor.visBBox;
      if (
        !bboxFallbackId &&
        px >= bb.minX - 6 &&
        px <= bb.maxX + 6 &&
        py >= bb.minY - 6 &&
        py <= bb.maxY + 6
      ) {
        bboxFallbackId = actor.id;
      }
    }

    return bboxFallbackId;
  }

  /* ---------------- 3D Practical Skill VFX Showcase ---------------- */

  function resolveCastFrames(actor, skillType) {
    const am = actor.animMap;
    if (am) {
      if (skillType === 'water' && Array.isArray(am.water) && am.water.length >= 2) {
        return [3, am.water[0], am.water[1]];
      }
      if (Array.isArray(am.magic) && am.magic.length >= 2) {
        return [3, am.magic[0], am.magic[1]];
      }
    }
    return [3, 4, 5];
  }

  function triggerTargetHurt(target, fromPos, shakePower, onImpact) {
    if (!target) return;
    target.actionMode = 'hurt';
    target.actionTimer = 0;
    target.actionDuration = 0.44;
    target.hurtFlash = 1.0;

    _tmpV0.subVectors(target.basePos, fromPos);
    _tmpV0.y = 0;
    if (_tmpV0.lengthSq() < 1e-4) {
      _tmpV0.set(target.side === 'enemy' ? 1 : -1, 0, 0);
    } else {
      _tmpV0.normalize();
    }
    target.recoilOffset.copy(_tmpV0).multiplyScalar(0.32);

    if (shakePower > 0) addCameraShake(shakePower);

    if (typeof onImpact === 'function') {
      try {
        getActorHitWorldPos(target, _tmpV1);
        const p = projectWorldPoint(_tmpV1, lastViewportW, lastViewportH);
        onImpact(target.id, p.x, p.y);
      } catch (_) {
        // Keep stage loop resilient to callback errors
      }
    }
  }

  function disposeObjectMaterials(obj) {
    obj.traverse((child) => {
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (let i = 0; i < child.material.length; i++) {
            child.material[i].dispose();
          }
        } else {
          child.material.dispose();
        }
      }
    });
  }

  function spawnIceBurstParticles(origin, container) {
    const shards = [];
    const shardColors = [0x6ce8ff, 0xa8f3ff, 0x3b82f6, 0xe8fbff];
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: shardColors[i % shardColors.length],
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(unitCrystalShardGeo, mat);
      const s = 0.6 + Math.random() * 1.1;
      mesh.scale.set(s * 0.7, s * 1.6, s * 0.7);
      mesh.position.copy(origin);
      const theta = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.2;
      const vy = 1.8 + Math.random() * 4.0;
      container.add(mesh);
      shards.push({
        mesh,
        mat,
        vx: Math.cos(theta) * speed,
        vy,
        vz: Math.sin(theta) * speed,
        rx: (Math.random() - 0.5) * 14,
        ry: (Math.random() - 0.5) * 14,
        age: 0,
        life: 0.45 + Math.random() * 0.35,
      });
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x8beeff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(unitRingGeo, ringMat);
    ring.position.copy(origin);
    ring.rotation.x = Math.PI * 0.35;
    ring.scale.setScalar(0.2);
    container.add(ring);

    const flashMat = new THREE.MeshBasicMaterial({
      map: softGlowTex,
      color: 0xd9f9ff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const flash = new THREE.Mesh(unitPlaneGeo, flashMat);
    flash.position.copy(origin);
    flash.scale.setScalar(1.9);
    container.add(flash);

    return { shards, ring, ringMat, flash, flashMat, age: 0 };
  }

  function createIceLanceSkill(caster, targets, onImpact) {
    const root = new THREE.Group();
    vfxGroup.add(root);

    const castOrigin = getActorCastWorldPos(caster, new THREE.Vector3());

    // Cast crystal magic flare
    const flareMat = new THREE.MeshBasicMaterial({
      map: softGlowTex,
      color: 0x6ce8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const flare = new THREE.Mesh(unitPlaneGeo, flareMat);
    flare.position.copy(castOrigin);
    root.add(flare);

    const lances = [];
    const bursts = [];
    const totalLances = Math.max(5, targets.length * 3);
    const impactNotified = new Set();

    for (let i = 0; i < totalLances; i++) {
      const target = targets[i % targets.length];
      const lanceGroup = new THREE.Group();

      const coreMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x7ceeff : 0xdaf8ff,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0x2574ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const tip = new THREE.Mesh(unitLanceTipGeo, coreMat);
      const tail = new THREE.Mesh(unitLanceTailGeo, coreMat);
      const aura = new THREE.Mesh(unitLanceTipGeo, outerMat);
      aura.scale.set(1.55, 1.55, 1.18);
      lanceGroup.add(tip, tail, aura);

      const fanAngle = ((i / Math.max(1, totalLances - 1)) - 0.5) * 1.15;
      const spawnPos = castOrigin
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(fanAngle) * 0.28 * (caster.side === 'ally' ? -1 : 1),
            0.35 + Math.sin(i * 1.9) * 0.58 + (i % 3) * 0.22,
            Math.sin(fanAngle) * 0.95
          )
        );
      const endPos = getActorHitWorldPos(target, new THREE.Vector3()).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.5) * 0.22
        )
      );
      const midPos = spawnPos.clone().lerp(endPos, 0.5);
      midPos.y += 0.55 + (i % 3) * 0.25;

      lanceGroup.position.copy(spawnPos);
      lanceGroup.scale.setScalar(0.01);
      root.add(lanceGroup);

      lances.push({
        group: lanceGroup,
        coreMat,
        outerMat,
        target,
        spawnPos,
        midPos,
        endPos,
        launchTime: 0.20 + i * 0.055,
        flightDur: 0.28,
        impacted: false,
      });
    }

    const totalDuration = 0.20 + totalLances * 0.055 + 0.28 + 0.78;
    return {
      root,
      elapsed: 0,
      duration: totalDuration,
      lightColor: 0x56d8ff,
      update(dt, camYaw) {
        this.elapsed += dt;
        const t = this.elapsed;

        // Cast flare
        flare.rotation.y = camYaw;
        if (t < 0.45) {
          const f = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.25;
          flareMat.opacity = clamp(f, 0, 1) * 0.85;
          flare.scale.setScalar(0.7 + f * 1.35);
          returnLight(castOrigin, 0x56d8ff, f * 3.4);
        } else {
          flareMat.opacity = 0;
        }

        // Update lances
        for (let i = 0; i < lances.length; i++) {
          const l = lances[i];
          if (l.impacted) continue;

          if (t < l.launchTime) {
            const charge = clamp(t / Math.max(0.05, l.launchTime), 0, 1);
            l.group.scale.setScalar(easeOutBack(charge) * 0.95);
            l.group.position.copy(l.spawnPos);
            l.group.position.y += Math.sin(t * 9 + i) * 0.04;
            l.group.lookAt(l.endPos);
            l.group.rotateZ(t * 7);
          } else {
            const u = (t - l.launchTime) / l.flightDur;
            if (u >= 1) {
              l.impacted = true;
              l.group.visible = false;
              bursts.push(spawnIceBurstParticles(l.endPos, root));
              returnLight(l.endPos, 0x8beeff, 5.2);

              const firstForTarget = !impactNotified.has(l.target.id);
              if (firstForTarget) impactNotified.add(l.target.id);
              triggerTargetHurt(
                l.target,
                l.spawnPos,
                firstForTarget ? 0.40 : 0.14,
                firstForTarget ? onImpact : null
              );
            } else {
              // Quadratic Bezier flight
              const inv = 1 - u;
              const px =
                inv * inv * l.spawnPos.x +
                2 * inv * u * l.midPos.x +
                u * u * l.endPos.x;
              const py =
                inv * inv * l.spawnPos.y +
                2 * inv * u * l.midPos.y +
                u * u * l.endPos.y;
              const pz =
                inv * inv * l.spawnPos.z +
                2 * inv * u * l.midPos.z +
                u * u * l.endPos.z;
              l.group.position.set(px, py, pz);
              const uNext = Math.min(1, u + 0.06);
              const invN = 1 - uNext;
              _tmpV0.set(
                invN * invN * l.spawnPos.x +
                  2 * invN * uNext * l.midPos.x +
                  uNext * uNext * l.endPos.x,
                invN * invN * l.spawnPos.y +
                  2 * invN * uNext * l.midPos.y +
                  uNext * uNext * l.endPos.y,
                invN * invN * l.spawnPos.z +
                  2 * invN * uNext * l.midPos.z +
                  uNext * uNext * l.endPos.z
              );
              l.group.lookAt(_tmpV0);
              l.group.rotateZ(t * 16);
              l.group.scale.set(0.95, 0.95, 1.35);
            }
          }
        }

        // Update burst shards & shockwaves
        for (let b = 0; b < bursts.length; b++) {
          const burst = bursts[b];
          burst.age += dt;
          const ringU = clamp(burst.age / 0.36, 0, 1);
          burst.ring.scale.setScalar(0.25 + easeOutCubic(ringU) * 1.95);
          burst.ringMat.opacity = (1 - ringU) * 0.88;

          const flashU = clamp(burst.age / 0.22, 0, 1);
          burst.flash.rotation.y = camYaw;
          burst.flash.scale.setScalar(1.6 + flashU * 1.5);
          burst.flashMat.opacity = (1 - flashU) * 0.95;

          for (let s = 0; s < burst.shards.length; s++) {
            const p = burst.shards[s];
            p.age += dt;
            const k = clamp(p.age / p.life, 0, 1);
            p.vy -= 9.8 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            if (p.mesh.position.y < 0.06) {
              p.mesh.position.y = 0.06;
              p.vy = Math.abs(p.vy) * 0.36;
              p.vx *= 0.72;
              p.vz *= 0.72;
            }
            p.mesh.rotation.x += p.rx * dt;
            p.mesh.rotation.y += p.ry * dt;
            p.mat.opacity = (1 - k) * 0.95;
          }
        }
      },
    };
  }

  function createWaterVortexSkill(caster, targets, onImpact) {
    const root = new THREE.Group();
    vfxGroup.add(root);
    const castOrigin = getActorCastWorldPos(caster, new THREE.Vector3());

    const orbs = [];
    const splashes = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const orbGroup = new THREE.Group();

      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x38d2ff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const core = new THREE.Mesh(unitSphereGeo, coreMat);
      core.scale.setScalar(0.36);

      const swirlMat1 = new THREE.MeshBasicMaterial({
        color: 0x99f6ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const swirl1 = new THREE.Mesh(unitTorusGeo, swirlMat1);
      swirl1.scale.setScalar(0.56);

      const swirlMat2 = new THREE.MeshBasicMaterial({
        color: 0x1e88ff,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const swirl2 = new THREE.Mesh(unitTorusGeo, swirlMat2);
      swirl2.scale.setScalar(0.68);
      swirl2.rotation.x = Math.PI * 0.45;

      const haloMat = new THREE.MeshBasicMaterial({
        map: softGlowTex,
        color: 0x4ae4ff,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const halo = new THREE.Mesh(unitPlaneGeo, haloMat);
      halo.scale.setScalar(1.55);

      orbGroup.add(core, swirl1, swirl2, halo);
      orbGroup.position.copy(castOrigin);
      orbGroup.scale.setScalar(0.01);
      root.add(orbGroup);

      const endPos = getActorHitWorldPos(target, new THREE.Vector3());
      const midPos = castOrigin.clone().lerp(endPos, 0.5);
      midPos.y += 1.05;
      midPos.z += (i % 2 === 0 ? 1 : -1) * 0.45;

      orbs.push({
        group: orbGroup,
        swirl1,
        swirl2,
        halo,
        target,
        startPos: castOrigin.clone(),
        midPos,
        endPos,
        launchTime: 0.22 + i * 0.08,
        flightDur: 0.36,
        impacted: false,
      });
    }

    const totalDuration = 0.22 + targets.length * 0.08 + 0.36 + 0.85;

    function spawnWaterSplash(center, groundY) {
      const droplets = [];
      const dropColors = [0x38d2ff, 0x99f6ff, 0x2574ff, 0xe0fcff];
      for (let i = 0; i < 28; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: dropColors[i % dropColors.length],
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(unitDropletGeo, mat);
        const s = 0.65 + Math.random() * 1.15;
        mesh.scale.set(s, s * 1.35, s);
        mesh.position.copy(center);
        const a = (i / 28) * Math.PI * 2 + Math.random() * 0.25;
        const spd = 1.6 + Math.random() * 3.4;
        const vy = 2.6 + Math.random() * 3.8;
        root.add(mesh);
        droplets.push({
          mesh,
          mat,
          vx: Math.cos(a) * spd,
          vy,
          vz: Math.sin(a) * spd,
          age: 0,
          life: 0.52 + Math.random() * 0.32,
        });
      }

      const ring1Mat = new THREE.MeshBasicMaterial({
        color: 0x7ef2ff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring1 = new THREE.Mesh(unitRingGeo, ring1Mat);
      ring1.position.set(center.x, groundY + 0.06, center.z);
      ring1.scale.setScalar(0.3);
      root.add(ring1);

      const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0x2da8ff,
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring2 = new THREE.Mesh(unitThinRingGeo, ring2Mat);
      ring2.position.copy(center);
      ring2.rotation.x = Math.PI * 0.28;
      ring2.scale.setScalar(0.25);
      root.add(ring2);

      return { droplets, ring1, ring1Mat, ring2, ring2Mat, age: 0, groundY };
    }

    return {
      root,
      elapsed: 0,
      duration: totalDuration,
      update(dt, camYaw) {
        this.elapsed += dt;
        const t = this.elapsed;

        for (let i = 0; i < orbs.length; i++) {
          const o = orbs[i];
          if (o.impacted) continue;

          o.swirl1.rotation.z += dt * 11;
          o.swirl1.rotation.y += dt * 7;
          o.swirl2.rotation.x -= dt * 13;
          o.swirl2.rotation.z += dt * 6;
          o.halo.rotation.y = camYaw;

          if (t < o.launchTime) {
            const u = clamp(t / Math.max(0.05, o.launchTime), 0, 1);
            o.group.scale.setScalar(easeOutBack(u) * 1.05);
            returnLight(o.startPos, 0x38d2ff, u * 3.5);
          } else {
            const u = (t - o.launchTime) / o.flightDur;
            if (u >= 1) {
              o.impacted = true;
              o.group.visible = false;
              splashes.push(spawnWaterSplash(o.endPos, o.target.basePos.y));
              returnLight(o.endPos, 0x5eeeff, 5.0);
              triggerTargetHurt(o.target, o.startPos, 0.34, onImpact);
            } else {
              const inv = 1 - u;
              o.group.position.set(
                inv * inv * o.startPos.x +
                  2 * inv * u * o.midPos.x +
                  u * u * o.endPos.x,
                inv * inv * o.startPos.y +
                  2 * inv * u * o.midPos.y +
                  u * u * o.endPos.y,
                inv * inv * o.startPos.z +
                  2 * inv * u * o.midPos.z +
                  u * u * o.endPos.z
              );
              const pulse = 1.0 + Math.sin(u * Math.PI) * 0.25;
              o.group.scale.setScalar(pulse);
              returnLight(o.group.position, 0x38d2ff, 3.6);
            }
          }
        }

        for (let s = 0; s < splashes.length; s++) {
          const sp = splashes[s];
          sp.age += dt;
          const u1 = clamp(sp.age / 0.56, 0, 1);
          sp.ring1.scale.setScalar(0.3 + easeOutCubic(u1) * 2.55);
          sp.ring1Mat.opacity = (1 - u1) * 0.9;

          const u2 = clamp(sp.age / 0.44, 0, 1);
          sp.ring2.scale.setScalar(0.25 + easeOutCubic(u2) * 2.05);
          sp.ring2Mat.opacity = (1 - u2) * 0.85;

          for (let d = 0; d < sp.droplets.length; d++) {
            const p = sp.droplets[d];
            p.age += dt;
            const k = clamp(p.age / p.life, 0, 1);
            p.vy -= 11.2 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            if (p.mesh.position.y < sp.groundY + 0.04) {
              p.mesh.position.y = sp.groundY + 0.04;
              p.vy = Math.abs(p.vy) * 0.25;
              p.vx *= 0.6;
              p.vz *= 0.6;
            }
            p.mat.opacity = (1 - k) * 0.92;
          }
        }
      },
    };
  }

  function createStarfrostPillarSkill(caster, targets, onImpact) {
    const root = new THREE.Group();
    vfxGroup.add(root);
    const castOrigin = getActorCastWorldPos(caster, new THREE.Vector3());

    const pillars = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const basePos = target.basePos.clone();
      const pillarGroup = new THREE.Group();
      pillarGroup.position.copy(basePos);
      root.add(pillarGroup);

      // Ground arcane frost circle
      const sealMat = new THREE.MeshBasicMaterial({
        map: allyOuterRingTex,
        color: 0x9bf0ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const sealMesh = new THREE.Mesh(unitDiscGeo, sealMat);
      sealMesh.position.y = 0.045;
      sealMesh.scale.setScalar(0.2);
      pillarGroup.add(sealMesh);

      // Celestial inner core beam + outer translucent crystal prism sheath
      const beamH = 14.5;
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfff7dd,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const coreBeam = new THREE.Mesh(unitCylinderGeo, coreMat);
      coreBeam.position.y = beamH * 0.5;
      coreBeam.scale.set(0.32, beamH, 0.32);

      const sheathMat = new THREE.MeshBasicMaterial({
        color: 0x40b8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const sheathBeam = new THREE.Mesh(unitCylinderGeo, sheathMat);
      sheathBeam.position.y = beamH * 0.5;
      sheathBeam.scale.set(0.82, beamH, 0.82);

      // 2 descending helical rings
      const hRingMat = new THREE.MeshBasicMaterial({
        color: 0xffe49e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const hRing1 = new THREE.Mesh(unitTorusGeo, hRingMat);
      hRing1.rotation.x = Math.PI / 2;
      hRing1.position.y = 8;
      const hRing2 = new THREE.Mesh(unitTorusGeo, hRingMat);
      hRing2.rotation.x = Math.PI / 2;
      hRing2.position.y = 11;

      // Ground shockwave rings
      const shockMat = new THREE.MeshBasicMaterial({
        color: 0x8beeff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const shockRing = new THREE.Mesh(unitRingGeo, shockMat);
      shockRing.position.y = 0.07;

      const shockGoldMat = new THREE.MeshBasicMaterial({
        color: 0xffdf8e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const shockGoldRing = new THREE.Mesh(unitThinRingGeo, shockGoldMat);
      shockGoldRing.position.y = 0.09;

      // 6 erupting ice crystal spires around target
      const spires = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const spireMat = new THREE.MeshBasicMaterial({
          color: k % 2 === 0 ? 0x7ae8ff : 0xc6f6ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const spire = new THREE.Mesh(unitSpireGeo, spireMat);
        spire.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
        spire.rotation.z = -Math.cos(a) * 0.28;
        spire.rotation.x = Math.sin(a) * 0.28;
        spire.scale.set(0.8, 0.01, 0.8);
        pillarGroup.add(spire);
        spires.push({ mesh: spire, mat: spireMat });
      }

      // Rising starlight motes
      const motes = [];
      for (let m = 0; m < 24; m++) {
        const mMat = new THREE.MeshBasicMaterial({
          color: m % 3 === 0 ? 0xffe49e : 0xa8f5ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mMesh = new THREE.Mesh(unitCrystalShardGeo, mMat);
        const a = Math.random() * Math.PI * 2;
        const rad = 0.25 + Math.random() * 1.45;
        mMesh.position.set(Math.cos(a) * rad, 0.1 + Math.random() * 0.8, Math.sin(a) * rad);
        mMesh.scale.setScalar(0.55 + Math.random() * 0.7);
        pillarGroup.add(mMesh);
        motes.push({
          mesh: mMesh,
          mat: mMat,
          vy: 2.2 + Math.random() * 3.4,
          spin: (Math.random() - 0.5) * 10,
        });
      }

      pillarGroup.add(
        coreBeam,
        sheathBeam,
        hRing1,
        hRing2,
        shockRing,
        shockGoldRing
      );

      pillars.push({
        group: pillarGroup,
        target,
        basePos,
        sealMesh,
        sealMat,
        coreBeam,
        coreMat,
        sheathBeam,
        sheathMat,
        hRing1,
        hRing2,
        hRingMat,
        shockRing,
        shockMat,
        shockGoldRing,
        shockGoldMat,
        spires,
        motes,
        impactTime: 0.40 + i * 0.07,
        impacted: false,
      });
    }

    const totalDuration = 1.42 + targets.length * 0.07;

    return {
      root,
      elapsed: 0,
      duration: totalDuration,
      update(dt) {
        this.elapsed += dt;
        const t = this.elapsed;

        for (let i = 0; i < pillars.length; i++) {
          const p = pillars[i];
          const impT = p.impactTime;

          // Seal charge & fade
          p.sealMesh.rotation.y += dt * 2.8;
          if (t < impT) {
            const u = clamp(t / impT, 0, 1);
            const s = 0.35 + easeOutBack(u) * 2.75;
            p.sealMesh.scale.set(s, 1, s);
            p.sealMat.opacity = u * 0.92;
            returnLight(p.basePos, 0x70ddff, u * 3.0);
          } else {
            const after = t - impT;
            const fade = clamp(1 - after / 0.85, 0, 1);
            p.sealMat.opacity = fade * 0.85;
            p.sealMesh.scale.setScalar(3.1 + after * 0.5);
          }

          // Beam plunge & impact
          if (t >= impT - 0.14) {
            const beamAge = t - (impT - 0.14);
            if (!p.impacted && t >= impT) {
              p.impacted = true;
              triggerTargetHurt(p.target, castOrigin, 0.54, onImpact);
            }

            if (beamAge < 0.14) {
              // Fast sky plunge
              const plungeU = clamp(beamAge / 0.14, 0, 1);
              p.coreBeam.scale.set(0.42 * plungeU, 14.5, 0.42 * plungeU);
              p.coreBeam.position.y = lerp(15, 7.25, plungeU);
              p.coreMat.opacity = plungeU * 0.95;

              p.sheathBeam.scale.set(0.95 * plungeU, 14.5, 0.95 * plungeU);
              p.sheathBeam.position.y = lerp(15, 7.25, plungeU);
              p.sheathMat.opacity = plungeU * 0.65;
            } else {
              const after = t - impT;
              const sustain = clamp(1 - after / 0.78, 0, 1);
              const wScale = Math.max(0.04, sustain * (1 + Math.sin(after * 26) * 0.08));
              p.coreBeam.position.y = 7.25;
              p.coreBeam.scale.set(0.46 * wScale, 14.5, 0.46 * wScale);
              p.coreMat.opacity = sustain * 0.98;

              p.sheathBeam.position.y = 7.25;
              p.sheathBeam.scale.set(1.12 * wScale, 14.5, 1.12 * wScale);
              p.sheathBeam.rotation.y += dt * 4.5;
              p.sheathMat.opacity = sustain * 0.55;

              // Descending gold rings
              p.hRingMat.opacity = sustain * 0.88;
              p.hRing1.position.y = Math.max(0.25, 6.2 - after * 8.5);
              p.hRing1.scale.setScalar(1.05 + (1 - sustain) * 0.9);
              p.hRing2.position.y = Math.max(0.45, 9.5 - after * 10.5);
              p.hRing2.scale.setScalar(0.85 + (1 - sustain) * 1.1);

              // Expanding ground shockwaves
              const swU = clamp(after / 0.58, 0, 1);
              p.shockRing.scale.setScalar(0.4 + easeOutCubic(swU) * 3.4);
              p.shockMat.opacity = (1 - swU) * 0.92;

              const sw2U = clamp(after / 0.48, 0, 1);
              p.shockGoldRing.scale.setScalar(0.3 + easeOutCubic(sw2U) * 2.8);
              p.shockGoldMat.opacity = (1 - sw2U) * 0.90;

              // Ice spires erupt & shatter-fade
              const spireGrow = clamp(after / 0.14, 0, 1);
              const spireFade = clamp(1 - Math.max(0, after - 0.35) / 0.45, 0, 1);
              for (let k = 0; k < p.spires.length; k++) {
                const sp = p.spires[k];
                sp.mesh.scale.set(0.85, Math.max(0.01, easeOutBack(spireGrow) * 1.15), 0.85);
                sp.mat.opacity = spireFade * 0.82;
              }

              // Rising starfrost motes
              for (let m = 0; m < p.motes.length; m++) {
                const mt = p.motes[m];
                mt.mesh.position.y += mt.vy * dt;
                mt.mesh.rotation.y += mt.spin * dt;
                mt.mesh.rotation.x += mt.spin * 0.6 * dt;
                mt.mat.opacity = sustain * 0.92;
              }

              returnLight(p.basePos, 0x9beeff, sustain * 6.5);
            }
          }
        }
      },
    };
  }

  function createShieldDomeSkill(caster, targets, onImpact) {
    const root = new THREE.Group();
    vfxGroup.add(root);

    const recipients = targets.length ? targets : [caster];
    const domes = [];

    for (let i = 0; i < recipients.length; i++) {
      const actor = recipients[i];
      const domeGroup = new THREE.Group();
      const radius = Math.max(actor.heightWorld * 0.62, actor.visWorldW * 0.68, 1.35);
      domeGroup.position.set(
        actor.basePos.x,
        actor.basePos.y + actor.heightWorld * 0.48,
        actor.basePos.z
      );
      root.add(domeGroup);

      // Translucent ice-crystal shell
      const shellMat = new THREE.MeshBasicMaterial({
        color: 0x5ad8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const shellMesh = new THREE.Mesh(unitDomeGeo, shellMat);

      // Crisp hexagonal/faceted crystal wireframe lattice
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xc2f6ff,
        wireframe: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const wireMesh = new THREE.Mesh(unitDomeGeo, wireMat);
      wireMesh.scale.setScalar(1.025);

      // Tilted champagne-gold & royal-blue orbiting rings
      const orbitGoldMat = new THREE.MeshBasicMaterial({
        color: 0xffe296,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const orbitGold = new THREE.Mesh(unitTorusGeo, orbitGoldMat);
      orbitGold.scale.setScalar(1.16);
      orbitGold.rotation.x = Math.PI * 0.36;

      const orbitBlueMat = new THREE.MeshBasicMaterial({
        color: 0x3b8dff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const orbitBlue = new THREE.Mesh(unitTorusGeo, orbitBlueMat);
      orbitBlue.scale.setScalar(1.22);
      orbitBlue.rotation.x = -Math.PI * 0.32;
      orbitBlue.rotation.y = Math.PI * 0.25;

      // 6 orbiting crystal shards
      const shards = [];
      for (let k = 0; k < 6; k++) {
        const sMat = new THREE.MeshBasicMaterial({
          color: k % 2 === 0 ? 0xaaf4ff : 0xffe59e,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sMesh = new THREE.Mesh(unitCrystalShardGeo, sMat);
        sMesh.scale.set(0.85, 1.85, 0.85);
        domeGroup.add(sMesh);
        shards.push({
          mesh: sMesh,
          mat: sMat,
          angle: (k / 6) * Math.PI * 2,
          yOff: ((k % 3) - 1) * 0.35,
        });
      }

      // Ground arcane frost seal
      const baseRingMat = new THREE.MeshBasicMaterial({
        map: allyOuterRingTex,
        color: 0x99eeff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const baseRing = new THREE.Mesh(unitDiscGeo, baseRingMat);
      baseRing.position.set(
        actor.basePos.x,
        actor.basePos.y + 0.05,
        actor.basePos.z
      );
      baseRing.scale.setScalar(radius * 2.2);
      root.add(baseRing);

      domeGroup.add(shellMesh, wireMesh, orbitGold, orbitBlue);
      domeGroup.scale.setScalar(0.01);

      domes.push({
        actor,
        group: domeGroup,
        radius,
        shellMesh,
        shellMat,
        wireMesh,
        wireMat,
        orbitGold,
        orbitGoldMat,
        orbitBlue,
        orbitBlueMat,
        baseRing,
        baseRingMat,
        shards,
        notified: false,
      });
    }

    const totalDuration = 1.75;

    return {
      root,
      elapsed: 0,
      duration: totalDuration,
      update(dt) {
        this.elapsed += dt;
        const t = this.elapsed;

        for (let i = 0; i < domes.length; i++) {
          const d = domes[i];
          const deployU = clamp((t - 0.12) / 0.28, 0, 1);
          const fadeOut =
            t > 1.28 ? clamp(1 - (t - 1.28) / (totalDuration - 1.28), 0, 1) : 1;

          if (!d.notified && t >= 0.34) {
            d.notified = true;
            if (typeof onImpact === 'function') {
              try {
                getActorHitWorldPos(d.actor, _tmpV1);
                const p = projectWorldPoint(_tmpV1, lastViewportW, lastViewportH);
                onImpact(d.actor.id, p.x, p.y);
              } catch (_) {
                // ignore callback errors
              }
            }
          }

          if (t >= 0.12) {
            const s = d.radius * Math.max(0.05, easeOutBack(deployU));
            d.group.scale.setScalar(s);
            d.shellMesh.rotation.y += dt * 0.75;
            d.wireMesh.rotation.y -= dt * 0.55;
            d.orbitGold.rotation.z += dt * 2.2;
            d.orbitBlue.rotation.z -= dt * 1.9;
            d.baseRing.rotation.y += dt * 1.2;

            const shimmer = 0.88 + Math.sin(t * 9) * 0.12;
            d.shellMat.opacity = 0.20 * deployU * fadeOut * shimmer;
            d.wireMat.opacity = 0.62 * deployU * fadeOut * shimmer;
            d.orbitGoldMat.opacity = 0.82 * deployU * fadeOut;
            d.orbitBlueMat.opacity = 0.70 * deployU * fadeOut;
            d.baseRingMat.opacity = 0.86 * deployU * fadeOut;

            for (let k = 0; k < d.shards.length; k++) {
              const sh = d.shards[k];
              const a = sh.angle + t * 2.4;
              sh.mesh.position.set(
                Math.cos(a) * 1.24,
                sh.yOff + Math.sin(t * 4 + k) * 0.12,
                Math.sin(a) * 1.24
              );
              sh.mesh.rotation.y = -a;
              sh.mat.opacity = 0.88 * deployU * fadeOut;
            }

            returnLight(d.group.position, 0x6ce8ff, 3.8 * deployU * fadeOut);
          }
        }
      },
    };
  }

  // Dynamic per-frame accumulator for reusable spell point light
  let _frameLightPower = 0;
  const _frameLightPos = new THREE.Vector3();
  const _frameLightColor = new THREE.Color(0x6ce8ff);

  function returnLight(pos, hexColor, intensity) {
    if (intensity > _frameLightPower) {
      _frameLightPower = intensity;
      _frameLightPos.copy(pos);
      _frameLightColor.setHex(hexColor);
    }
  }

  function triggerSkillDemo(casterId, targetIds, skillType, onImpact) {
    const type = normalizeSkillType(skillType);
    const caster =
      actorMap.get(String(casterId || '')) ||
      actorMap.get(activeActorId) ||
      actors.find((a) => a.side === 'ally') ||
      actors[0];
    if (!caster) return null;

    let rawIds = [];
    if (Array.isArray(targetIds)) rawIds = targetIds;
    else if (targetIds != null) rawIds = [targetIds];

    let targets = rawIds
      .map((tid) => actorMap.get(String(tid)))
      .filter(Boolean);

    if (targets.length === 0) {
      if (type === 'shield') {
        targets = [caster];
      } else {
        const fallbackTarget =
          actorMap.get(selectedEnemyId) ||
          actors.find((a) => a.side !== caster.side) ||
          caster;
        targets = [fallbackTarget];
      }
    }

    // Trigger caster choreography (windup -> cast -> follow-through)
    caster.actionMode = 'cast';
    caster.actionTimer = 0;
    caster.actionDuration = type === 'shield' ? 0.88 : 0.78;
    caster.castFrames = resolveCastFrames(caster, type);

    const primaryTarget = targets[0];
    if (primaryTarget && primaryTarget !== caster) {
      caster.lungeDir.subVectors(primaryTarget.basePos, caster.basePos);
      caster.lungeDir.y = 0;
      if (caster.lungeDir.lengthSq() > 1e-4) caster.lungeDir.normalize();
      else caster.lungeDir.set(caster.side === 'ally' ? 1 : -1, 0, 0);
    } else {
      caster.lungeDir.set(caster.side === 'ally' ? 1 : -1, 0, 0);
    }

    // Build bespoke 3D effect
    let effect;
    if (type === 'water') {
      effect = createWaterVortexSkill(caster, targets, onImpact);
    } else if (type === 'starfrost') {
      effect = createStarfrostPillarSkill(caster, targets, onImpact);
    } else if (type === 'shield') {
      effect = createShieldDomeSkill(caster, targets, onImpact);
    } else {
      effect = createIceLanceSkill(caster, targets, onImpact);
    }

    activeEffects.push(effect);
    return {
      skillType: type,
      casterId: caster.id,
      targetIds: targets.map((t) => t.id),
      duration: effect.duration,
    };
  }

  /* ---------------- Main Per-Frame Update Loop ---------------- */

  function update(elapsedSec, dtSec) {
    const dt = clamp(
      Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0.016,
      0.001,
      0.1
    );
    const t = Number.isFinite(elapsedSec) ? elapsedSec : lastElapsedSec + dt;
    lastElapsedSec = t;
    hasUpdatedOnce = true;

    // 1. Update 3D Camera Director
    updateCameraDirector(t, dt);

    // Compute cylindrical camera azimuth so pixel sprites stay crisp & parallel to lens
    let camYaw = 0;
    if (camera) {
      camera.getWorldDirection(_tmpDir);
      camYaw = Math.atan2(-_tmpDir.x, -_tmpDir.z);
    }

    // 2. Update Actors (poses, breathing, lunge/recoil, hit-flash, dimming, ground rings)
    const dimAlpha = 1 - Math.exp(-8.0 * dt);
    const ringAlpha = 1 - Math.exp(-10.0 * dt);

    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];

      // Keep upright cylindrical orientation aligned to camera yaw
      a.spritePivot.rotation.y = camYaw;

      let targetFrame = 0;
      let offsetX = 0;
      let offsetY = 0;
      let offsetZ = 0;
      let scaleX = 1;
      let scaleY = 1;

      if (a.actionMode === 'cast') {
        a.actionTimer += dt;
        const p = a.actionTimer;
        if (p < 0.22) {
          targetFrame = a.castFrames[0]; // windup
          const back = Math.sin((p / 0.22) * Math.PI * 0.5) * -0.14;
          offsetX = a.lungeDir.x * back;
          offsetZ = a.lungeDir.z * back;
          scaleY = 0.97;
          scaleX = 1.03;
        } else if (p < 0.42) {
          targetFrame = a.castFrames[1]; // cast_step / magic[0]
          const u = (p - 0.22) / 0.20;
          const fwd = easeOutCubic(u) * 0.34;
          offsetX = a.lungeDir.x * fwd;
          offsetZ = a.lungeDir.z * fwd;
          offsetY = Math.sin(u * Math.PI) * 0.08;
        } else if (p < a.actionDuration) {
          targetFrame = a.castFrames[2]; // strike / magic[1]
          const u = (p - 0.42) / Math.max(0.05, a.actionDuration - 0.42);
          const fwd = (1 - easeOutCubic(u)) * 0.34;
          offsetX = a.lungeDir.x * fwd;
          offsetZ = a.lungeDir.z * fwd;
        } else {
          a.actionMode = 'idle';
          a.actionTimer = 0;
        }
      } else if (a.actionMode === 'hurt') {
        a.actionTimer += dt;
        const u = clamp(a.actionTimer / Math.max(0.05, a.actionDuration), 0, 1);
        targetFrame = a.frameCount > 6 ? 6 : 0;
        const decay = 1 - easeOutCubic(u);
        const jitter = Math.sin(a.actionTimer * 62) * 0.045 * decay;
        offsetX = a.recoilOffset.x * decay + jitter;
        offsetZ = a.recoilOffset.z * decay;
        scaleY = 1 - 0.07 * Math.sin(u * Math.PI);
        scaleX = 1 + 0.06 * Math.sin(u * Math.PI);
        if (u >= 1) {
          a.actionMode = 'idle';
          a.actionTimer = 0;
        }
      } else {
        // Classic Sea of Stars / Octopath 2-frame idle + natural periodic eye blink
        const cycle = (t + a.phase) % a.blinkInterval;
        if (a.frameCount > 2 && cycle > a.blinkInterval - 0.13) {
          targetFrame = 2; // blink
        } else if (a.frameCount > 1) {
          targetFrame = Math.floor((t + a.phase) / 0.56) % 2;
        } else {
          targetFrame = 0;
        }
        const breathe = Math.sin(t * 2.5 + a.phase);
        scaleY = 1 + breathe * 0.007;
        scaleX = 1 - breathe * 0.004;
      }

      applyActorFrame(a, targetFrame);

      a.spritePivot.position.set(offsetX, offsetY, offsetZ);
      a.spritePivot.scale.set(scaleX, scaleY, 1);

      // Subtle shadow reaction when jumping/lunging
      const shadowScale = clamp(1 - offsetY * 0.35, 0.72, 1.0);
      a.shadowMesh.position.set(offsetX * 0.85, 0.015, offsetZ * 0.85);
      a.shadowMesh.scale.set(
        a.shadowRx * 2.05 * shadowScale,
        1,
        a.shadowRz * 2.05 * shadowScale
      );

      // Smooth hit-flash & non-focus dimming
      if (a.hurtFlash > 0) {
        a.hurtFlash = Math.max(0, a.hurtFlash - dt * 5.2);
      }
      const targetDim = isActorFocused(a.id) ? 1.0 : 0.62;
      a.dimFactor = lerp(a.dimFactor, targetDim, dimAlpha);
      updateActorMaterialTint(a);

      // Ground magic selection ring animation
      const isActive = a.id === activeActorId;
      const isSelectedEnemy = a.id === selectedEnemyId;
      const showRing = isActive || isSelectedEnemy;
      const targetRingOp = showRing ? 1.0 : 0.0;
      a.ringOpacity = lerp(a.ringOpacity, targetRingOp, ringAlpha);

      if (a.ringOpacity > 0.008) {
        a.ringGroup.visible = true;
        const pulse = 1 + Math.sin(t * 3.4 + a.phase) * 0.036;
        a.outerRingMesh.rotation.y += dt * (isSelectedEnemy ? -0.52 : 0.36);
        a.innerRingMesh.rotation.y += dt * (isSelectedEnemy ? 0.82 : -0.58);
        a.outerRingMesh.scale.set(
          a.ringRadius * 2.35 * pulse,
          1,
          a.ringRadius * 2.35 * pulse
        );
        a.innerRingMesh.scale.set(
          a.ringRadius * 2.15 * (2 - pulse),
          1,
          a.ringRadius * 2.15 * (2 - pulse)
        );
        a.outerRingMat.opacity = a.ringOpacity * 0.96;
        a.innerRingMat.opacity = a.ringOpacity * 0.88;
        a.auraMat.opacity =
          a.ringOpacity * (isSelectedEnemy ? 0.24 : 0.28) * (0.9 + Math.sin(t * 4) * 0.1);
      } else {
        a.ringOpacity = 0;
        a.ringGroup.visible = false;
      }
    }

    // 3. Update active 3D skill VFX effects & reusable dynamic spell light
    _frameLightPower = 0;
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const fx = activeEffects[i];
      fx.update(dt, camYaw);
      if (fx.elapsed >= fx.duration) {
        vfxGroup.remove(fx.root);
        disposeObjectMaterials(fx.root);
        activeEffects.splice(i, 1);
      }
    }

    if (_frameLightPower > 0.01) {
      vfxLight.position.lerp(_frameLightPos, 0.45);
      vfxLight.color.copy(_frameLightColor);
      vfxLight.intensity = lerp(vfxLight.intensity, _frameLightPower, 0.5);
    } else {
      vfxLight.intensity = lerp(vfxLight.intensity, 0, clamp(dt * 12, 0, 1));
    }
  }

  /* ---------------- Cleanup & Disposal ---------------- */

  function dispose() {
    clearFormation();

    for (let i = 0; i < activeEffects.length; i++) {
      vfxGroup.remove(activeEffects[i].root);
      disposeObjectMaterials(activeEffects[i].root);
    }
    activeEffects.length = 0;

    frameCache.forEach((rec) => {
      if (rec && rec.texture) rec.texture.dispose();
    });
    frameCache.clear();

    for (let i = 0; i < ownedTextures.length; i++) {
      ownedTextures[i].dispose();
    }
    ownedTextures.length = 0;

    for (let i = 0; i < ownedGeometries.length; i++) {
      ownedGeometries[i].dispose();
    }
    ownedGeometries.length = 0;

    if (stageGroup.parent) {
      stageGroup.parent.remove(stageGroup);
    }
  }

  return {
    setFormation,
    setActiveActor,
    setSelectedEnemy,
    setRimTint,
    setDimNonFocus,
    setCameraConfig,
    setPointerNDC,
    focusCameraOn,
    triggerSkillDemo,
    projectAllActors,
    raycastActor,
    update,
    dispose,
  };
}
