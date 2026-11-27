/**
 * 3D 技能衔接 Demo 共享舞台引擎 (cast_stage_shared.js)
 *
 * 部署路径：/demos/cast_pacing_3boards/cast_stage_shared.js
 * 全部主站资源与脚本相对路径固定使用 `../../`。
 * 严禁修改主仓文件；与 3 路竞标演示页共享唯一冻结契约 `initCastDemoStage(config)`。
 */

import * as THREE from '../../js/vendor/three/three.module.min.js';
import { createPBRTextureLibrary } from '../../js/stage3d/textures-pbr.js';
import { buildAcademyBiome } from '../../js/stage3d/biome-academy.js';
import { buildForestBiome } from '../../js/stage3d/biome-forest.js';

// ============================================================================
// 1. 像素精灵 RLE 解码与真实头部裁切（100% 对齐 combat-pixel-vfx.js）
// ============================================================================

const BANK_CHARS = '.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~';
const BANK_CHAR_LUT = new Int8Array(128);
BANK_CHAR_LUT.fill(-1);
for (let i = 0; i < BANK_CHARS.length; i++) {
  const code = BANK_CHARS.charCodeAt(i);
  if (code < 128) BANK_CHAR_LUT[code] = i;
}

const HEAD_CROP_OVERRIDES = {
  frost_hound:   { sx: 15, sy: 48, size: 46 },
  tundra_brute:  { sx: 25, sy: 66, size: 44 },
  sylvia_silver: { sx: 49, sy: 8,  size: 42 },
  reno:          { sx: 47, sy: 17, size: 38 },
  rowan:         { sx: 61, sy: 23, size: 36 },
};

const _bankFrameCache = new Map();
const _headCanvasCache = new Map();

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  const x = 1 - clamp(t, 0, 1);
  return 1 - x * x * x;
}

function getPixelBankEntry(spriteId) {
  const bank = typeof window !== 'undefined' ? window.PIXEL_SPRITE_BANK : null;
  if (!bank || typeof bank !== 'object') return null;
  const entry = bank[spriteId];
  return entry && entry.w > 0 && entry.h > 0 && Array.isArray(entry.palette) && Array.isArray(entry.frames) && entry.frames.length > 0
    ? entry
    : null;
}

function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function decodeBankFrame(spriteId, frameIdx) {
  const entry = getPixelBankEntry(spriteId);
  if (!entry) return null;
  const idx = clamp(frameIdx | 0, 0, entry.frames.length - 1);
  const cacheKey = `${spriteId}:${idx}`;
  if (_bankFrameCache.has(cacheKey)) return _bankFrameCache.get(cacheKey);
  if (typeof ImageData === 'undefined') return null;

  const w = entry.w | 0;
  const h = entry.h | 0;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const palRgb = entry._palRgb || (entry._palRgb = entry.palette.map(hexToRgbTriplet));
  const rows = entry.frames[idx] || [];

  for (let y = 0; y < h && y < rows.length; y++) {
    const row = rows[y];
    if (typeof row !== 'string' || !row.length) continue;
    const rowOff = y * w;
    const rLen = row.length;
    let x = 0;
    for (let i = 0; i < rLen && x < w; i++) {
      const code = row.charCodeAt(i);
      let rep = 1;
      if (i + 1 < rLen && row.charCodeAt(i + 1) === 42) { // '*'
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
      if (code === 46) { // '.'
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
      for (; x < endX; x++) {
        const off = (rowOff + x) << 2;
        rgba[off] = r;
        rgba[off + 1] = g;
        rgba[off + 2] = b;
        rgba[off + 3] = 255;
      }
    }
  }

  const imgData = new ImageData(rgba, w, h);
  _bankFrameCache.set(cacheKey, imgData);
  return imgData;
}

function getHeadCanvas(spriteId, size = 34) {
  if (!spriteId || typeof document === 'undefined') return null;
  const targetSize = (typeof size === 'number' && Number.isFinite(size) && size > 0) ? Math.round(size) : 34;
  const cacheKey = `${spriteId}:${targetSize}`;
  if (_headCanvasCache.has(cacheKey)) return _headCanvasCache.get(cacheKey);

  const entry = getPixelBankEntry(spriteId);
  if (!entry) return null;
  const imgData = decodeBankFrame(spriteId, 0);
  if (!imgData) return null;

  const w = entry.w | 0;
  const h = entry.h | 0;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sctx = srcCanvas.getContext('2d');
  if (!sctx) return null;
  sctx.putImageData(imgData, 0, 0);

  const headCanvas = document.createElement('canvas');
  headCanvas.width = targetSize;
  headCanvas.height = targetSize;
  const hctx = headCanvas.getContext('2d');
  if (!hctx) return null;
  hctx.imageSmoothingEnabled = false;

  const override = HEAD_CROP_OVERRIDES[spriteId];
  let cropSize;
  let sx;
  let sy;
  if (override && override.size > 0) {
    cropSize = Math.min(w, h, Math.round(override.size));
    sx = Math.max(0, Math.min(w - cropSize, Math.round(override.sx)));
    sy = Math.max(0, Math.min(h - cropSize, Math.round(override.sy)));
  } else {
    const head = (entry.anchors && Array.isArray(entry.anchors.head) && entry.anchors.head.length >= 2)
      ? entry.anchors.head
      : [w / 2, h * 0.28];
    cropSize = Math.min(w, h, Math.max(40, Math.min(54, Math.round(Math.min(w, h) * 0.38))));
    sx = Math.max(0, Math.min(w - cropSize, Math.round(head[0] - cropSize / 2)));
    sy = Math.max(0, Math.min(h - cropSize, Math.round(head[1] - cropSize * 0.44)));
  }

  hctx.drawImage(srcCanvas, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);
  _headCanvasCache.set(cacheKey, headCanvas);
  return headCanvas;
}

function drawHeadCanvas(targetCanvas, spriteId, size = 34) {
  if (!targetCanvas || typeof targetCanvas.getContext !== 'function') return false;
  const targetSize = (typeof size === 'number' && Number.isFinite(size) && size > 0) ? Math.round(size) : 34;
  const head = getHeadCanvas(spriteId, targetSize);
  if (!head) return false;
  if (targetCanvas.width !== targetSize) targetCanvas.width = targetSize;
  if (targetCanvas.height !== targetSize) targetCanvas.height = targetSize;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return false;
  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(head, 0, 0, targetSize, targetSize);
  return true;
}

// ============================================================================
// 2. 冻结角色规格、技能字典与镜头预设
// ============================================================================

const ACTOR_SPECS = [
  {
    id: 'sylvia',
    spriteId: 'sylvia_silver',
    name: '希尔维亚',
    side: 'ally',
    height: 2.52,
    pos: [-3.9, 0, -0.55],
    facing: 'right',
    accent: '#38bdf8',
    shadowRadius: 0.92,
  },
  {
    id: 'reno',
    spriteId: 'reno',
    name: '雷纳德',
    side: 'ally',
    height: 2.76,
    pos: [-2.35, 0, 1.15],
    facing: 'right',
    accent: '#f59e0b',
    shadowRadius: 0.98,
  },
  {
    id: 'wolf',
    spriteId: 'frost_hound',
    name: '冰霜猎犬',
    side: 'enemy',
    height: 2.26,
    pos: [2.05, 0, 1.35],
    facing: 'left',
    accent: '#60a5fa',
    shadowRadius: 1.12,
  },
  {
    id: 'brute',
    spriteId: 'tundra_brute',
    name: '冻原重兽',
    side: 'enemy',
    height: 2.72,
    pos: [3.55, 0, -0.85],
    facing: 'left',
    accent: '#6366f1',
    shadowRadius: 1.36,
  },
  {
    id: 'rowan',
    spriteId: 'rowan',
    name: '罗文',
    side: 'enemy',
    height: 2.78,
    pos: [4.65, 0, 0.35],
    facing: 'left',
    accent: '#a855f7',
    shadowRadius: 1.0,
  },
];

const AV_QUEUE_SLOTS = [
  { actorId: 'sylvia', av: 0 },
  { actorId: 'wolf',   av: 18 },
  { actorId: 'reno',   av: 36 },
  { actorId: 'rowan',  av: 54 },
  { actorId: 'brute',  av: 72 },
  { actorId: 'sylvia', av: 96 },
];

const SKILLS = {
  ice_prism: {
    key: 'ice_prism',
    caster: 'sylvia',
    target: 'wolf',
    name: '冰棱齐射',
    sub: 'ICE PRISM SALVO',
    tier: 1,
    side: 'ally',
    vfx: 'ice_prism',
    dmg: 468,
    portrait: null,
  },
  starfrost_apex: {
    key: 'starfrost_apex',
    caster: 'sylvia',
    target: 'rowan',
    name: '星霜极限·冰棱圣枪',
    sub: 'STARFROST APEX · TIER III',
    tier: 3,
    side: 'ally',
    vfx: 'starfrost_apex',
    dmg: 1480,
    portrait: '../../assets/portraits/sylvia_teenage_normal.webp',
  },
  flame_lance: {
    key: 'flame_lance',
    caster: 'reno',
    target: 'brute',
    name: '炎岩贯冲',
    sub: 'FLAME LANCE · TIER II',
    tier: 2,
    side: 'ally',
    vfx: 'flame_lance',
    dmg: 965,
    portrait: '../../assets/cg/reno_battle.jpg',
  },
  wolf_bite: {
    key: 'wolf_bite',
    caster: 'wolf',
    target: 'sylvia',
    name: '裂霜扑咬',
    sub: 'FROST FANG LUNGE',
    tier: 1,
    side: 'enemy',
    vfx: 'wolf_bite',
    dmg: 312,
    portrait: null,
  },
  eclipse_rift: {
    key: 'eclipse_rift',
    caster: 'rowan',
    target: 'sylvia',
    name: '诡道暗流·月蚀裂隙',
    sub: 'ECLIPSE RIFT · BOSS ART',
    tier: 3,
    side: 'enemy',
    vfx: 'eclipse_rift',
    dmg: 1120,
    portrait: '../../assets/monsters/rowan_eclipse.webp',
  },
};

const CAMERA_PRESETS = {
  wide:         { pos: [0.25, 3.85, 11.45], target: [0.25, 1.38, 0.15],  fov: 38 },
  sylvia:       { pos: [-2.15, 2.32, 5.45], target: [-3.72, 1.30, -0.45], fov: 33 },
  reno:         { pos: [-0.72, 2.45, 6.25], target: [-2.22, 1.42, 1.05],  fov: 33 },
  wolf:         { pos: [0.48, 2.08, 6.08],  target: [1.98, 1.12, 1.25],   fov: 33 },
  brute:        { pos: [1.85, 2.55, 5.75],  target: [3.48, 1.38, -0.78],  fov: 34 },
  rowan:        { pos: [2.52, 2.56, 6.05],  target: [4.52, 1.44, 0.30],   fov: 33 },
  sylvia_low:   { pos: [-5.05, 1.16, 3.72], target: [-3.25, 1.48, -0.45], fov: 35 },
  reno_low:     { pos: [-3.65, 1.20, 4.88], target: [-1.85, 1.54, 1.05],  fov: 35 },
  wolf_low:     { pos: [3.38, 1.08, 4.78],  target: [1.72, 1.20, 1.25],   fov: 35 },
  brute_low:    { pos: [5.12, 1.25, 3.55],  target: [3.28, 1.48, -0.78],  fov: 35 },
  rowan_low:    { pos: [5.95, 1.22, 4.35],  target: [4.15, 1.54, 0.25],   fov: 34 },
  impact_enemy: { pos: [1.32, 2.95, 7.35],  target: [3.18, 1.38, 0.22],   fov: 35 },
  impact_ally:  { pos: [-1.38, 2.86, 7.35], target: [-3.05, 1.36, 0.20],  fov: 35 },
};

const BIOME_LIGHT_PRESETS = {
  academy: {
    mood: 'sunny_snow',
    bgHex: 0xdbeafe,
    fogHex: 0xdceeff,
    fogNear: 18,
    fogFar: 58,
    hemiSky: 0xf0f8ff,
    hemiGround: 0xb4c7de,
    hemiInt: 1.22,
    sunColor: 0xfffaf0,
    sunInt: 1.38,
    sunPos: [10, 17, 10],
    rimColor: 0x7dd3fc,
    rimInt: 0.48,
    rimPos: [-9, 7, -10],
    exposure: 1.04,
  },
  forest: {
    mood: 'graveyard_mist',
    bgHex: 0x162238,
    fogHex: 0x1e2e49,
    fogNear: 12,
    fogFar: 42,
    hemiSky: 0x9ec5fe,
    hemiGround: 0x26344d,
    hemiInt: 0.92,
    sunColor: 0xc2dbff,
    sunInt: 1.02,
    sunPos: [-9, 15, 8],
    rimColor: 0x818cf8,
    rimInt: 0.56,
    rimPos: [9, 6, -9],
    exposure: 1.0,
  },
};

// ============================================================================
// 3. 软件 WebGL 探测与程序化柔影/聚光贴图
// ============================================================================

function detectSoftwareWebGL() {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '');
    const vendorStr = dbg
      ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '')
      : String(gl.getParameter(gl.VENDOR) || '');
    const joined = `${rendererStr} ${vendorStr}`;
    const loseExt = gl.getExtension('WEBGL_lose_context');
    if (loseExt) loseExt.loseContext();
    return /swiftshader|llvmpipe|softpipe|mesa offscreen|angle.*swiftshader/i.test(joined);
  } catch (_) {
    return false;
  }
}

function createSoftShadowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
  g.addColorStop(0.0, 'rgba(14, 28, 58, 0.46)');
  g.addColorStop(0.55, 'rgba(16, 32, 64, 0.24)');
  g.addColorStop(1.0, 'rgba(16, 32, 64, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSpotlightRingTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const g = ctx.createRadialGradient(cx, cy, size * 0.04, cx, cy, size * 0.48);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 0.52)');
  g.addColorStop(0.45, 'rgba(125, 211, 252, 0.30)');
  g.addColorStop(0.74, 'rgba(240, 201, 117, 0.56)');
  g.addColorStop(0.84, 'rgba(255, 255, 255, 0.14)');
  g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// 4. Web Audio API 零依赖高质感音效合成器
// ============================================================================

function createSoundEngine(initialEnabled = true) {
  let enabled = !!initialEnabled;
  let audioCtx = null;
  let noiseBuf = null;

  function ensureContext() {
    if (!enabled || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      try {
        audioCtx = new AudioCtx();
      } catch (_) {
        return null;
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    if (!noiseBuf && audioCtx) {
      const len = Math.floor(audioCtx.sampleRate * 0.65);
      noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return audioCtx;
  }

  // 首次交互自动解锁 AudioContext
  if (typeof window !== 'undefined') {
    const unlock = () => {
      if (enabled) ensureContext();
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
  }

  function playTone(ctx, { type = 'sine', freq = 880, endFreq = null, delay = 0, dur = 0.25, gain = 0.14, attack = 0.008 }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function playNoise(ctx, { delay = 0, dur = 0.22, gain = 0.12, filterType = 'bandpass', freq = 1800, endFreq = 600, Q = 1.6 }) {
    if (!noiseBuf) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.Q.value = Q;
    flt.frequency.setValueAtTime(freq, t0);
    if (endFreq && endFreq !== freq) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.025, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function playSFX(kind = 'crystal') {
    if (!enabled) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const rawKey = String(kind || 'crystal').toLowerCase();
    const aliasMap = { chime_soft: 'chime', chime_apex: 'tier3', pan_whoosh: 'whoosh', cutin_slash: 'cutin', hit_crack: 'hit_ice' };
    const k = aliasMap[rawKey] || rawKey;

    try {
      if (k === 'crystal' || k === 'chime' || k === 'confirm' || k === 'ui' || k === 'click' || k === 'select') {
        playTone(ctx, { type: 'sine', freq: 1318.5, dur: 0.24, gain: 0.11, attack: 0.005 });
        playTone(ctx, { type: 'triangle', freq: 1975.5, delay: 0.032, dur: 0.26, gain: 0.08, attack: 0.005 });
        playTone(ctx, { type: 'sine', freq: 2637.0, delay: 0.06, dur: 0.22, gain: 0.05, attack: 0.006 });
        return;
      }

      if (k === 'ring' || k === 'magic_ring' || k === 'sigil') {
        [659.25, 987.77, 1318.5, 1975.5].forEach((f, idx) => {
          playTone(ctx, { type: 'sine', freq: f, endFreq: f * 1.04, delay: idx * 0.03, dur: 0.34, gain: 0.075 });
        });
        playNoise(ctx, { dur: 0.28, gain: 0.04, filterType: 'highpass', freq: 3200, endFreq: 5200, Q: 1.0 });
        return;
      }

      if (k === 'tier3' || k === 'apex' || k === 'chord' || k === 'charge_tier3' || k === 'overdrive') {
        const notes = [523.25, 783.99, 1046.5, 1174.66, 1567.98, 2093.0];
        notes.forEach((f, i) => {
          playTone(ctx, { type: i < 2 ? 'triangle' : 'sine', freq: f, delay: i * 0.028, dur: 0.62, gain: i < 2 ? 0.095 : 0.065, attack: 0.015 });
        });
        playNoise(ctx, { delay: 0.04, dur: 0.42, gain: 0.065, filterType: 'bandpass', freq: 2200, endFreq: 5600, Q: 2.2 });
        return;
      }

      if (k === 'enemy_warn' || k === 'warn' || k === 'alert' || k === 'danger') {
        playTone(ctx, { type: 'sawtooth', freq: 196.0, endFreq: 164.8, dur: 0.19, gain: 0.085, attack: 0.008 });
        playTone(ctx, { type: 'sawtooth', freq: 277.18, endFreq: 233.08, delay: 0.095, dur: 0.22, gain: 0.075, attack: 0.008 });
        playTone(ctx, { type: 'sine', freq: 98.0, endFreq: 73.4, dur: 0.28, gain: 0.11, attack: 0.01 });
        return;
      }

      if (k === 'whoosh' || k === 'cam' || k === 'camera' || k === 'swoosh' || k === 'dash') {
        playNoise(ctx, { dur: 0.24, gain: 0.10, filterType: 'bandpass', freq: 520, endFreq: 2100, Q: 1.4 });
        playTone(ctx, { type: 'sine', freq: 340, endFreq: 180, dur: 0.18, gain: 0.05 });
        return;
      }

      if (k === 'cutin' || k === 'portrait' || k === 'slash_cutin' || k === 'burst_in') {
        playNoise(ctx, { dur: 0.28, gain: 0.12, filterType: 'bandpass', freq: 4200, endFreq: 1100, Q: 2.4 });
        playTone(ctx, { type: 'triangle', freq: 880, endFreq: 1760, dur: 0.18, gain: 0.095, attack: 0.004 });
        playTone(ctx, { type: 'sine', freq: 1318.5, delay: 0.045, dur: 0.42, gain: 0.09 });
        playTone(ctx, { type: 'sine', freq: 2637.0, delay: 0.06, dur: 0.36, gain: 0.06 });
        return;
      }

      if (k === 'cast_ice' || k === 'ice_cast' || k === 'ice') {
        [1046.5, 1318.5, 1567.98, 2093.0].forEach((f, i) => {
          playTone(ctx, { type: 'sine', freq: f, delay: i * 0.032, dur: 0.28, gain: 0.075 });
        });
        playNoise(ctx, { dur: 0.25, gain: 0.06, filterType: 'highpass', freq: 2800, endFreq: 6000, Q: 1.1 });
        return;
      }

      if (k === 'hit_ice' || k === 'ice_hit' || k === 'impact_ice') {
        playTone(ctx, { type: 'sine', freq: 175, endFreq: 48, dur: 0.22, gain: 0.16, attack: 0.003 });
        playNoise(ctx, { dur: 0.24, gain: 0.13, filterType: 'highpass', freq: 2400, endFreq: 6200, Q: 1.2 });
        [1760, 2349.3, 3135.9].forEach((f, i) => {
          playTone(ctx, { type: 'triangle', freq: f, endFreq: f * 0.92, delay: i * 0.022, dur: 0.26, gain: 0.07 });
        });
        return;
      }

      if (k === 'hit_apex' || k === 'starfrost' || k === 'impact_apex') {
        playTone(ctx, { type: 'sine', freq: 150, endFreq: 38, dur: 0.42, gain: 0.20, attack: 0.004 });
        playNoise(ctx, { dur: 0.38, gain: 0.16, filterType: 'bandpass', freq: 1800, endFreq: 5400, Q: 0.9 });
        [1046.5, 1567.98, 2093.0, 2637.0, 3135.9].forEach((f, i) => {
          playTone(ctx, { type: 'sine', freq: f, delay: 0.02 + i * 0.024, dur: 0.56, gain: 0.075 });
        });
        return;
      }

      if (k === 'cast_fire' || k === 'fire_cast' || k === 'fire') {
        playNoise(ctx, { dur: 0.34, gain: 0.13, filterType: 'bandpass', freq: 420, endFreq: 1450, Q: 1.2 });
        playTone(ctx, { type: 'sawtooth', freq: 220, endFreq: 440, dur: 0.26, gain: 0.065 });
        playTone(ctx, { type: 'triangle', freq: 587.3, delay: 0.05, dur: 0.28, gain: 0.075 });
        return;
      }

      if (k === 'hit_fire' || k === 'fire_hit' || k === 'impact_fire') {
        playTone(ctx, { type: 'sine', freq: 145, endFreq: 36, dur: 0.38, gain: 0.21, attack: 0.004 });
        playNoise(ctx, { dur: 0.38, gain: 0.17, filterType: 'lowpass', freq: 1850, endFreq: 260, Q: 0.9 });
        playTone(ctx, { type: 'sawtooth', freq: 330, endFreq: 110, dur: 0.25, gain: 0.075 });
        return;
      }

      if (k === 'cast_dark' || k === 'dark_cast' || k === 'eclipse') {
        playTone(ctx, { type: 'sine', freq: 220, endFreq: 146.8, dur: 0.42, gain: 0.11 });
        playTone(ctx, { type: 'triangle', freq: 622.25, endFreq: 554.37, delay: 0.04, dur: 0.40, gain: 0.08 });
        playNoise(ctx, { dur: 0.36, gain: 0.085, filterType: 'bandpass', freq: 950, endFreq: 2400, Q: 2.0 });
        return;
      }

      if (k === 'hit_dark' || k === 'dark_hit' || k === 'impact_dark' || k === 'eclipse_hit') {
        playTone(ctx, { type: 'sine', freq: 130, endFreq: 34, dur: 0.45, gain: 0.21, attack: 0.004 });
        playTone(ctx, { type: 'sawtooth', freq: 466.16, endFreq: 155.56, dur: 0.34, gain: 0.085 });
        playNoise(ctx, { dur: 0.34, gain: 0.14, filterType: 'bandpass', freq: 2600, endFreq: 480, Q: 1.5 });
        playTone(ctx, { type: 'sine', freq: 1244.5, delay: 0.05, dur: 0.42, gain: 0.065 });
        return;
      }

      if (k === 'bite' || k === 'claw' || k === 'wolf_hit' || k === 'hit_claw') {
        playNoise(ctx, { dur: 0.14, gain: 0.15, filterType: 'bandpass', freq: 2600, endFreq: 700, Q: 1.8 });
        playNoise(ctx, { delay: 0.07, dur: 0.16, gain: 0.14, filterType: 'bandpass', freq: 3100, endFreq: 850, Q: 2.0 });
        playTone(ctx, { type: 'sine', freq: 190, endFreq: 56, dur: 0.18, gain: 0.16, attack: 0.003 });
        return;
      }

      // 兜底清脆晶鸣
      playTone(ctx, { type: 'sine', freq: 1174.66, dur: 0.22, gain: 0.09 });
    } catch (_) {
      // 静默忽略浏览器音频策略异常
    }
  }

  return {
    playSFX,
    setSoundEnabled(v) {
      enabled = !!v;
      if (enabled) ensureContext();
    },
    isSoundEnabled() {
      return enabled;
    },
  };
}

// ============================================================================
// 5. 顶部 6 槽真实像素头像 AV 行动条渲染（0 圆框套圆框 · 仅纯数字 AV · 0 title=）
// ============================================================================

function ensureAvBarStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cast-stage-shared-av-style')) return;
  const style = document.createElement('style');
  style.id = 'cast-stage-shared-av-style';
  style.textContent = `
    .csd-av-strip {
      display: inline-flex;
      align-items: stretch;
      background: rgba(247, 251, 255, 0.88);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(22, 88, 235, 0.22);
      box-shadow: 0 6px 20px rgba(15, 39, 86, 0.12);
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      pointer-events: none;
    }
    .csd-av-slot {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 46px;
      padding: 5px 5px 4px;
      border-right: 1px solid rgba(22, 88, 235, 0.14);
      background: transparent;
      transition: background 180ms ease;
    }
    .csd-av-slot:last-child {
      border-right: none;
    }
    .csd-av-slot::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 2px;
      background: #1658eb;
    }
    .csd-av-slot.is-enemy::before {
      background: #c026d3;
    }
    .csd-av-slot.is-active {
      background: rgba(22, 88, 235, 0.11);
    }
    .csd-av-slot.is-active::before {
      height: 3px;
      background: #d4a24c;
    }
    .csd-av-head {
      display: block;
      width: 34px;
      height: 34px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .csd-av-num {
      margin-top: 2px;
      font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.02em;
      color: #102a56;
    }
    .csd-av-slot.is-enemy .csd-av-num {
      color: #6b21a8;
    }
    .csd-av-slot.is-active .csd-av-num {
      color: #1658eb;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// 6. 主入口：initCastDemoStage(config)
// ============================================================================

export async function initCastDemoStage(config = {}) {
  const hostEl = config.stageEl || config.container || config.mountEl || config.rootEl || config.viewportEl || document.body;
  const hostPos = hostEl && typeof window !== 'undefined' ? window.getComputedStyle(hostEl).position : 'relative';
  if (hostEl && hostPos === 'static') {
    hostEl.style.position = 'relative';
  }

  // 1) WebGL Canvas & 2D VFX Canvas
  let webglCanvas = config.webglCanvas || config.canvas3d || config.canvas || null;
  if (!webglCanvas) {
    webglCanvas = document.createElement('canvas');
    webglCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;';
    hostEl.appendChild(webglCanvas);
  }

  let vfxCanvas = config.vfxCanvas || config.overlayCanvas || null;
  if (!vfxCanvas) {
    vfxCanvas = document.createElement('canvas');
    vfxCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:3;';
    hostEl.appendChild(vfxCanvas);
  }
  const vfxCtx = vfxCanvas.getContext('2d');

  // 2) 软件 WebGL 自适应渲染器初始化
  const isSoftwareWebGL = detectSoftwareWebGL();
  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    antialias: !isSoftwareWebGL,
    alpha: false,
    powerPreference: isSoftwareWebGL ? 'low-power' : 'high-performance',
  });
  renderer.setPixelRatio(isSoftwareWebGL ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = !isSoftwareWebGL;
  if (!isSoftwareWebGL) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 220);

  // 3) 灯光组
  const hemiLight = new THREE.HemisphereLight(0xf0f8ff, 0xb4c7de, 1.22);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.38);
  sunLight.position.set(10, 17, 10);
  if (!isSoftwareWebGL) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 45;
    sunLight.shadow.camera.left = -12;
    sunLight.shadow.camera.right = 12;
    sunLight.shadow.camera.top = 12;
    sunLight.shadow.camera.bottom = -12;
    sunLight.shadow.bias = -0.0005;
  }
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.48);
  rimLight.position.set(-9, 7, -10);
  scene.add(rimLight);

  // 4) PBR 纹理库与双 Biome 懒构建缓存
  const texLib = createPBRTextureLibrary(THREE);
  const biomeCache = {};
  let currentBiomeKey = null;
  let currentBiomeHandle = null;
  let activeLightPreset = BIOME_LIGHT_PRESETS.academy;

  function applyBiomeMoodToScene(biomeKey, handle) {
    const lp = BIOME_LIGHT_PRESETS[biomeKey] || BIOME_LIGHT_PRESETS.academy;
    activeLightPreset = lp;
    let res = null;
    if (handle && typeof handle.applyMood === 'function') {
      try {
        res = handle.applyMood(lp.mood, { immediate: true }) || null;
      } catch (_) {
        res = null;
      }
    }

    const bgColor = (res && res.background != null) ? res.background : lp.bgHex;
    scene.background = bgColor instanceof THREE.Color ? bgColor.clone() : new THREE.Color(bgColor);

    const fogSpec = (res && res.fog) ? res.fog : null;
    if (fogSpec && typeof fogSpec.density === 'number' && fogSpec.density > 0) {
      scene.fog = new THREE.FogExp2(fogSpec.color ?? lp.fogHex, fogSpec.density);
    } else {
      const fCol = (fogSpec && fogSpec.color != null) ? fogSpec.color : lp.fogHex;
      const fNear = (fogSpec && typeof fogSpec.near === 'number') ? fogSpec.near : lp.fogNear;
      const fFar = (fogSpec && typeof fogSpec.far === 'number') ? fogSpec.far : lp.fogFar;
      scene.fog = new THREE.Fog(fCol, fNear, fFar);
    }

    hemiLight.color.setHex(lp.hemiSky);
    hemiLight.groundColor.setHex(lp.hemiGround);
    sunLight.color.setHex(lp.sunColor);
    sunLight.position.set(lp.sunPos[0], lp.sunPos[1], lp.sunPos[2]);
    rimLight.color.setHex(lp.rimColor);
    rimLight.position.set(lp.rimPos[0], lp.rimPos[1], lp.rimPos[2]);
    renderer.toneMappingExposure = lp.exposure;
    syncLightDimming();
  }

  function setBiome(biomeName = 'academy') {
    const key = biomeName === 'forest' ? 'forest' : 'academy';
    if (currentBiomeKey === key && currentBiomeHandle) {
      applyBiomeMoodToScene(key, currentBiomeHandle);
      return currentBiomeKey;
    }
    if (currentBiomeHandle && currentBiomeHandle.group) {
      scene.remove(currentBiomeHandle.group);
    }
    if (!biomeCache[key]) {
      biomeCache[key] = key === 'forest'
        ? buildForestBiome(THREE, texLib)
        : buildAcademyBiome(THREE, texLib);
    }
    currentBiomeHandle = biomeCache[key];
    currentBiomeKey = key;
    if (currentBiomeHandle && currentBiomeHandle.group) {
      scene.add(currentBiomeHandle.group);
    }
    applyBiomeMoodToScene(key, currentBiomeHandle);
    return currentBiomeKey;
  }

  // 5) 构建 5 名真实 3D 像素角色（严格真实比例 + MeshBasicMaterial 防白雾过曝 + 脚底柔影）
  const shadowTex = createSoftShadowTexture();
  const spotlightTex = createSpotlightRingTexture();
  const actorsGroup = new THREE.Group();
  actorsGroup.name = 'cast_demo_actors';
  scene.add(actorsGroup);

  const ACTORS = {};
  const actorOrder = [];

  for (const spec of ACTOR_SPECS) {
    const entry = getPixelBankEntry(spec.spriteId);
    const texW = entry ? entry.w : 144;
    const texH = entry ? entry.h : 128;
    const frameCount = entry ? entry.frames.length : 1;

    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = texW;
    spriteCanvas.height = texH;
    const sctx = spriteCanvas.getContext('2d');
    const firstImg = decodeBankFrame(spec.spriteId, 0);
    if (firstImg && sctx) {
      sctx.putImageData(firstImg, 0, 0);
    } else if (sctx) {
      // 安全降级占位（正常页面已注入 PIXEL_SPRITE_BANK，不会触发）
      sctx.fillStyle = spec.accent;
      sctx.fillRect(texW * 0.3, texH * 0.15, texW * 0.4, texH * 0.8);
    }

    const texture = new THREE.CanvasTexture(spriteCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    // 精确像素脚底对齐到 y = 0，严格维持原生宽高比（绝不放大人类 BOSS，绝不压扁巨兽）
    const planeHeight = spec.height;
    const planeWidth = planeHeight * (texW / texH);
    const feetYpx = (entry && entry.anchors && Array.isArray(entry.anchors.feet))
      ? entry.anchors.feet[1]
      : texH - 4;
    const bottomPadWorld = ((texH - feetYpx) / texH) * planeHeight;

    const geo = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      fog: false,
    });
    mat.toneMapped = false;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, planeHeight * 0.5 - bottomPadWorld, 0);
    const nativeFacing = (entry && entry.facing) || spec.facing;
    if (nativeFacing !== spec.facing) {
      mesh.scale.x = -1;
    }

    // 脚底圆形柔阴影
    const shadowGeo = new THREE.CircleGeometry(spec.shadowRadius, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, 0.015, 0);

    // 脚底聚光圈（聚焦角色时平滑亮起）
    const spotGeo = new THREE.CircleGeometry(spec.shadowRadius * 1.42, 36);
    const spotMat = new THREE.MeshBasicMaterial({
      map: spotlightTex,
      color: new THREE.Color(spec.accent),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const spotMesh = new THREE.Mesh(spotGeo, spotMat);
    spotMesh.rotation.x = -Math.PI / 2;
    spotMesh.position.set(0, 0.022, 0);

    const group = new THREE.Group();
    group.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    group.add(shadowMesh);
    group.add(spotMesh);
    group.add(mesh);
    actorsGroup.add(group);

    const actorObj = {
      id: spec.id,
      spriteId: spec.spriteId,
      name: spec.name,
      side: spec.side,
      height: spec.height,
      width: planeWidth,
      pos: [...spec.pos],
      facing: spec.facing,
      accent: spec.accent,
      entry,
      frameCount,
      spriteCanvas,
      spriteCtx: sctx,
      texture,
      group,
      mesh,
      material: mat,
      shadowMesh,
      spotMesh,
      spotMat,
      currentFrame: 0,
      pose: 'idle',
      poseStartedAt: performance.now(),
      poseResetTimer: null,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      hurtFlash: 0,
      setFrame(frameIdx) {
        const clamped = clamp(frameIdx | 0, 0, Math.max(0, frameCount - 1));
        if (this.currentFrame === clamped) return;
        const img = decodeBankFrame(spec.spriteId, clamped);
        if (img && sctx) {
          sctx.clearRect(0, 0, texW, texH);
          sctx.putImageData(img, 0, 0);
          texture.needsUpdate = true;
          this.currentFrame = clamped;
        }
      },
    };

    ACTORS[spec.id] = actorObj;
    actorOrder.push(actorObj);
  }

  // 6) 顶部 6 槽真实像素头像 AV 行动条自动渲染
  let activeAvActorId = 'sylvia';
  const avSlotEls = [];

  function renderAvBar(highlightActorId = activeAvActorId) {
    activeAvActorId = highlightActorId || 'sylvia';
    if (!config.avBarEl) return;
    ensureAvBarStyles();
    if (avSlotEls.length === 0) {
      config.avBarEl.innerHTML = '';
      const strip = document.createElement('div');
      strip.className = 'csd-av-strip';
      for (let i = 0; i < AV_QUEUE_SLOTS.length; i++) {
        const slot = AV_QUEUE_SLOTS[i];
        const actor = ACTORS[slot.actorId];
        const slotEl = document.createElement('div');
        slotEl.className = `csd-av-slot ${actor && actor.side === 'enemy' ? 'is-enemy' : 'is-ally'}`;
        slotEl.dataset.actorId = slot.actorId;
        slotEl.dataset.slotIndex = String(i);

        const headC = document.createElement('canvas');
        headC.className = 'csd-av-head';
        headC.width = 34;
        headC.height = 34;
        if (actor) {
          drawHeadCanvas(headC, actor.spriteId, 34);
        }

        const numEl = document.createElement('div');
        numEl.className = 'csd-av-num';
        numEl.textContent = String(slot.av);

        slotEl.appendChild(headC);
        slotEl.appendChild(numEl);
        strip.appendChild(slotEl);
        avSlotEls.push({ el: slotEl, actorId: slot.actorId, index: i });
      }
      config.avBarEl.appendChild(strip);
    }

    let matched = false;
    for (const item of avSlotEls) {
      const active = !matched && item.actorId === activeAvActorId;
      item.el.classList.toggle('is-active', active);
      if (active) matched = true;
    }
    if (!matched && avSlotEls[0]) {
      avSlotEls[0].el.classList.add('is-active');
    }
  }

  // 7) 镜头平滑插值状态（easeOutCubic）
  const camState = {
    curPos: new THREE.Vector3(...CAMERA_PRESETS.wide.pos),
    curTarget: new THREE.Vector3(...CAMERA_PRESETS.wide.target),
    curFov: CAMERA_PRESETS.wide.fov,
    fromPos: new THREE.Vector3(...CAMERA_PRESETS.wide.pos),
    fromTarget: new THREE.Vector3(...CAMERA_PRESETS.wide.target),
    fromFov: CAMERA_PRESETS.wide.fov,
    toPos: new THREE.Vector3(...CAMERA_PRESETS.wide.pos),
    toTarget: new THREE.Vector3(...CAMERA_PRESETS.wide.target),
    toFov: CAMERA_PRESETS.wide.fov,
    startTime: 0,
    duration: 0,
    active: false,
    resolver: null,
  };

  let shakeIntensity = 0;
  let shakeDecay = 0.008;
  let hitStopUntil = 0;

  function triggerShake(amount = 0.16, durationMs = 220) {
    shakeIntensity = Math.max(shakeIntensity, amount);
    shakeDecay = amount / Math.max(60, durationMs);
  }

  function focusCamera(mode = 'wide', durationMs = 360) {
    const preset = CAMERA_PRESETS[mode] || CAMERA_PRESETS.wide;
    if (camState.resolver) {
      const prev = camState.resolver;
      camState.resolver = null;
      prev();
    }
    camState.fromPos.copy(camState.curPos);
    camState.fromTarget.copy(camState.curTarget);
    camState.fromFov = camState.curFov;
    camState.toPos.set(preset.pos[0], preset.pos[1], preset.pos[2]);
    camState.toTarget.set(preset.target[0], preset.target[1], preset.target[2]);
    camState.toFov = preset.fov;

    const dur = Math.max(0, Number(durationMs) || 0);
    if (dur <= 8) {
      camState.curPos.copy(camState.toPos);
      camState.curTarget.copy(camState.toTarget);
      camState.curFov = camState.toFov;
      camState.active = false;
      camera.position.copy(camState.curPos);
      camera.fov = camState.curFov;
      camera.lookAt(camState.curTarget);
      camera.updateProjectionMatrix();
      return Promise.resolve();
    }

    camState.startTime = performance.now();
    camState.duration = dur;
    camState.active = true;
    return new Promise((resolve) => {
      camState.resolver = resolve;
    });
  }

  // 8) 环境压暗聚光（setEnvDim）与亮色光学景深柔焦（setBrightDoF）
  const envFx = {
    dimCur: 0,
    dimFrom: 0,
    dimTo: 0,
    dimStart: 0,
    dimDur: 0,
    focusActorId: null,

    dofCur: 0,
    dofFrom: 0,
    dofTo: 0,
    dofStart: 0,
    dofDur: 0,
  };

  function syncLightDimming() {
    const dim = clamp(envFx.dimCur, 0, 0.52);
    const lightMul = 1 - dim * 0.72;
    hemiLight.intensity = activeLightPreset.hemiInt * lightMul;
    sunLight.intensity = activeLightPreset.sunInt * lightMul;
    rimLight.intensity = activeLightPreset.rimInt * (1 - dim * 0.45);

    const nonFocusTone = lerp(1.0, 0.68, clamp(dim / 0.42, 0, 1));
    for (const actor of actorOrder) {
      const isFocused = !!envFx.focusActorId && actor.id === envFx.focusActorId;
      if (actor.hurtFlash > 0.01) {
        const f = actor.hurtFlash;
        actor.material.color.setRGB(1 + f * 0.4, 1 + f * 0.35, 1 + f * 0.5);
      } else if (dim > 0.01 && !isFocused) {
        actor.material.color.setRGB(nonFocusTone, nonFocusTone * 0.99, Math.min(1, nonFocusTone * 1.04));
      } else {
        actor.material.color.setRGB(1, 1, 1);
      }
      const targetSpot = isFocused && dim > 0.02 ? clamp(dim * 1.95, 0, 0.85) : 0;
      actor.spotMat.opacity = lerp(actor.spotMat.opacity, targetSpot, 0.18);
    }
  }

  function setEnvDim(amount = 0, focusActorId = null, durationMs = 240) {
    const clamped = clamp(Number(amount) || 0, 0, 0.48);
    envFx.dimFrom = envFx.dimCur;
    envFx.dimTo = clamped;
    envFx.dimStart = performance.now();
    envFx.dimDur = Math.max(0, Number(durationMs) || 0);
    envFx.focusActorId = clamped > 0.005 ? (focusActorId || envFx.focusActorId) : null;
    if (focusActorId && clamped > 0.005) {
      renderAvBar(focusActorId);
    }
    if (envFx.dimDur <= 8) {
      envFx.dimCur = envFx.dimTo;
      syncLightDimming();
      return Promise.resolve();
    }
    return wait(envFx.dimDur);
  }

  function setBrightDoF(amount = 0, durationMs = 240) {
    const clamped = clamp(Number(amount) || 0, 0, 1);
    envFx.dofFrom = envFx.dofCur;
    envFx.dofTo = clamped;
    envFx.dofStart = performance.now();
    envFx.dofDur = Math.max(0, Number(durationMs) || 0);
    if (envFx.dofDur <= 8) {
      envFx.dofCur = envFx.dofTo;
      return Promise.resolve();
    }
    return wait(envFx.dofDur);
  }

  // 9) 屏幕坐标投影工具
  let viewWidth = 1280;
  let viewHeight = 720;
  const _projVec = new THREE.Vector3();

  function projectWorld(wx, wy, wz) {
    _projVec.set(wx, wy, wz).project(camera);
    return {
      x: (_projVec.x * 0.5 + 0.5) * viewWidth,
      y: (-_projVec.y * 0.5 + 0.5) * viewHeight,
      z: _projVec.z,
    };
  }

  function getActorScreen(actorId) {
    const actor = ACTORS[actorId];
    if (!actor) {
      return { x: viewWidth * 0.5, y: viewHeight * 0.5, topY: viewHeight * 0.35, feetY: viewHeight * 0.65, width: 120, height: 180 };
    }
    const gx = actor.group.position.x;
    const gy = actor.group.position.y;
    const gz = actor.group.position.z;
    const feet = projectWorld(gx, gy, gz);
    const top = projectWorld(gx, gy + actor.height, gz);
    const center = projectWorld(gx, gy + actor.height * 0.52, gz);
    const left = projectWorld(gx - actor.width * 0.45, gy + actor.height * 0.5, gz);
    const right = projectWorld(gx + actor.width * 0.45, gy + actor.height * 0.5, gz);
    return {
      x: center.x,
      y: center.y,
      topY: top.y,
      feetY: feet.y,
      width: Math.max(48, Math.abs(right.x - left.x)),
      height: Math.max(64, Math.abs(feet.y - top.y)),
    };
  }

  // 10) 角色动作姿态与微移反馈
  function playPose(actorId, pose = 'idle') {
    const actor = ACTORS[actorId];
    if (!actor) return;
    if (actor.poseResetTimer) {
      clearTimeout(actor.poseResetTimer);
      actor.poseResetTimer = null;
    }
    const p = String(pose || 'idle').toLowerCase();
    actor.pose = p;
    actor.poseStartedAt = performance.now();

    if (p === 'windup' || p === 'cast') {
      renderAvBar(actorId);
    }

    if (p === 'idle') {
      actor.setFrame(0);
      return;
    }
    if (p === 'windup') {
      const f = (actor.id === 'reno' && actor.frameCount > 7) ? 7 : Math.min(3, actor.frameCount - 1);
      actor.setFrame(f);
      return;
    }
    if (p === 'cast') {
      const f = (actor.id === 'reno' && actor.frameCount > 8) ? 8 : Math.min(5, actor.frameCount - 1);
      actor.setFrame(f);
      actor.poseResetTimer = setTimeout(() => {
        if (actor.pose === 'cast') {
          actor.pose = 'idle';
          actor.poseStartedAt = performance.now();
          actor.setFrame(0);
        }
      }, 460);
      return;
    }
    if (p === 'hurt') {
      actor.setFrame(Math.min(6, actor.frameCount - 1));
      actor.hurtFlash = 1.0;
      actor.poseResetTimer = setTimeout(() => {
        if (actor.pose === 'hurt') {
          actor.pose = 'idle';
          actor.poseStartedAt = performance.now();
          actor.setFrame(0);
        }
      }, 380);
    }
  }

  // 11) 高清 2D 日系奇幻 VFX 系统（魔法阵 + 5 套技能特效 + 浮动伤害数字）
  const activeRings = [];
  const activeVfx = [];
  const activeFloatNums = [];

  function spawnMagicRing(actorId, colorHex = '#5fd4ff', scale = 1.0) {
    const actor = ACTORS[actorId];
    if (!actor) return;
    activeRings.push({
      actorId,
      color: colorHex || actor.accent || '#5fd4ff',
      scale: Math.max(0.45, Number(scale) || 1.0),
      startTime: performance.now(),
      duration: 920,
      seed: Math.random() * Math.PI * 2,
    });
    sound.playSFX('ring');
  }

  function spawnDamageNumber(x, y, dmg, style = 'ice') {
    activeFloatNums.push({
      x,
      y,
      dmg: String(dmg),
      style,
      startTime: performance.now(),
      duration: 960,
    });
  }

  function spawnSkillVfxObject(skill) {
    const casterScr = getActorScreen(skill.caster);
    const targetScr = getActorScreen(skill.target);
    const now = performance.now();

    const particles = [];
    const pCount = skill.tier >= 3 ? 46 : skill.tier === 2 ? 34 : 24;
    for (let i = 0; i < pCount; i++) {
      const ang = (Math.PI * 2 * i) / pCount + (Math.random() - 0.5) * 0.4;
      const spd = (skill.tier >= 3 ? 130 : 95) + Math.random() * 190;
      particles.push({
        ang,
        spd,
        size: 3 + Math.random() * (skill.tier >= 3 ? 7.5 : 5.5),
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 8,
        delay: Math.random() * 0.14,
      });
    }

    activeVfx.push({
      skill,
      kind: skill.vfx || skill.key,
      casterId: skill.caster,
      targetId: skill.target,
      sx: casterScr.x + (skill.side === 'ally' ? 28 : -28),
      sy: casterScr.y - casterScr.height * 0.06,
      tx: targetScr.x,
      ty: targetScr.y - targetScr.height * 0.05,
      startTime: now,
      duration: skill.tier >= 3 ? 860 : 680,
      particles,
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  async function playSkillImpact(skillKey) {
    const skill = SKILLS[skillKey] || SKILLS.ice_prism;
    const isApex = skill.key === 'starfrost_apex';
    const isFire = skill.key === 'flame_lance';
    const isWolf = skill.key === 'wolf_bite';
    const isEclipse = skill.key === 'eclipse_rift';

    playPose(skill.caster, 'cast');
    if (isApex) {
      sound.playSFX('cast_ice');
    } else if (isFire) {
      sound.playSFX('cast_fire');
    } else if (isWolf) {
      sound.playSFX('whoosh');
    } else if (isEclipse) {
      sound.playSFX('cast_dark');
    } else {
      sound.playSFX('cast_ice');
    }

    spawnSkillVfxObject(skill);

    // 约 170ms 命中瞬间：触发受击 + 55ms 微顿帧 + 屏幕微震 + 命中音效 + 浮动伤害
    await wait(170);

    playPose(skill.target, 'hurt');
    const targetScr = getActorScreen(skill.target);

    if (isApex) {
      hitStopUntil = performance.now() + 55;
      triggerShake(0.28, 300);
      sound.playSFX('hit_apex');
      spawnDamageNumber(targetScr.x, targetScr.topY + 12, skill.dmg, 'apex');
    } else if (isFire) {
      hitStopUntil = performance.now() + 45;
      triggerShake(0.22, 260);
      sound.playSFX('hit_fire');
      spawnDamageNumber(targetScr.x, targetScr.topY + 16, skill.dmg, 'fire');
    } else if (isWolf) {
      triggerShake(0.14, 180);
      sound.playSFX('bite');
      spawnDamageNumber(targetScr.x, targetScr.topY + 18, skill.dmg, 'enemy');
    } else if (isEclipse) {
      hitStopUntil = performance.now() + 55;
      triggerShake(0.25, 290);
      sound.playSFX('hit_dark');
      spawnDamageNumber(targetScr.x, targetScr.topY + 14, skill.dmg, 'eclipse');
    } else {
      triggerShake(0.15, 200);
      sound.playSFX('hit_ice');
      spawnDamageNumber(targetScr.x, targetScr.topY + 18, skill.dmg, 'ice');
    }

    await wait(350); // 总计 ~520ms 完成核心命中演出并 resolve
  }

  // 12) 2D VFX Canvas 绘制辅助
  function drawStarPolygon(ctx, cx, cy, outerR, innerR, points, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = rot + (i * Math.PI) / points;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawCrystalShard(ctx, x, y, len, wid, angle, fillCore, fillEdge) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(len * 0.65, 0);
    ctx.lineTo(0, wid * 0.5);
    ctx.lineTo(-len * 0.45, 0);
    ctx.lineTo(0, -wid * 0.5);
    ctx.closePath();
    ctx.fillStyle = fillEdge;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(len * 0.48, 0);
    ctx.lineTo(0, wid * 0.24);
    ctx.lineTo(-len * 0.25, 0);
    ctx.lineTo(0, -wid * 0.24);
    ctx.closePath();
    ctx.fillStyle = fillCore;
    ctx.fill();
    ctx.restore();
  }

  function renderMagicRings(ctx, now) {
    for (let i = activeRings.length - 1; i >= 0; i--) {
      const ring = activeRings[i];
      const t = (now - ring.startTime) / ring.duration;
      if (t >= 1) {
        activeRings.splice(i, 1);
        continue;
      }
      const scr = getActorScreen(ring.actorId);
      const ease = easeOutCubic(Math.min(1, t * 2.2));
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const rx = (56 + ease * 58) * ring.scale;
      const ry = rx * 0.34;
      const cx = scr.x;
      const cy = scr.feetY - 3;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.92;

      // 柔和底光晕
      const rad = ctx.createRadialGradient(cx, cy, rx * 0.08, cx, cy, rx * 1.15);
      rad.addColorStop(0, `${ring.color}88`);
      rad.addColorStop(0.65, `${ring.color}28`);
      rad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // 外环与内环（透视椭圆）
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 旋转六芒星符文节点
      const rot = ring.seed + t * 2.6;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.6;
      for (let tri = 0; tri < 2; tri++) {
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = rot + tri * (Math.PI / 3) + k * ((Math.PI * 2) / 3);
          const px = cx + Math.cos(a) * rx * 0.80;
          const py = cy + Math.sin(a) * ry * 0.80;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // 6 颗浮升光粒
      for (let m = 0; m < 6; m++) {
        const a = rot * 1.4 + (m * Math.PI) / 3;
        const mx = cx + Math.cos(a) * rx * 0.72;
        const my = cy + Math.sin(a) * ry * 0.72 - t * 62 - (m % 2) * 14;
        ctx.fillStyle = m % 2 === 0 ? '#ffffff' : ring.color;
        ctx.beginPath();
        ctx.arc(mx, my, 2.8 * fade + 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function renderSkillVfx(ctx, now) {
    for (let i = activeVfx.length - 1; i >= 0; i--) {
      const fx = activeVfx[i];
      const elapsed = now - fx.startTime;
      const t = elapsed / fx.duration;
      if (t >= 1) {
        activeVfx.splice(i, 1);
        continue;
      }

      const tgtScr = getActorScreen(fx.targetId);
      const tx = tgtScr.x;
      const ty = tgtScr.y - tgtScr.height * 0.04;
      const sx = fx.sx;
      const sy = fx.sy;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      if (fx.kind === 'ice_prism') {
        const flyT = clamp(t / 0.28, 0, 1);
        const burstT = clamp((t - 0.22) / 0.78, 0, 1);

        // 3 道冰晶棱矛齐射轨迹
        if (flyT < 1) {
          const ang = Math.atan2(ty - sy, tx - sx);
          [-26, 0, 26].forEach((offsetY, idx) => {
            const p = clamp(flyT * 1.15 - idx * 0.08, 0, 1);
            const px = lerp(sx, tx, easeOutCubic(p));
            const py = lerp(sy + offsetY, ty + offsetY * 0.3, easeOutCubic(p));
            const grad = ctx.createLinearGradient(px - Math.cos(ang) * 95, py - Math.sin(ang) * 95, px, py);
            grad.addColorStop(0, 'rgba(95, 212, 255, 0)');
            grad.addColorStop(0.7, 'rgba(95, 212, 255, 0.75)');
            grad.addColorStop(1, '#ffffff');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(px - Math.cos(ang) * 95, py - Math.sin(ang) * 95);
            ctx.lineTo(px, py);
            ctx.stroke();
            drawCrystalShard(ctx, px, py, 34, 13, ang, '#ffffff', '#5fd4ff');
          });
        }

        // 冰晶多环爆散
        if (burstT > 0) {
          const alpha = 1 - burstT;
          const r = 24 + easeOutCubic(burstT) * 115;
          const g = ctx.createRadialGradient(tx, ty, 4, tx, ty, r);
          g.addColorStop(0, `rgba(255,255,255,${0.88 * alpha})`);
          g.addColorStop(0.42, `rgba(95,212,255,${0.62 * alpha})`);
          g.addColorStop(1, 'rgba(22,88,235,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(186, 238, 255, ${0.9 * alpha})`;
          ctx.lineWidth = 3.2 * (1 - burstT * 0.5);
          ctx.beginPath();
          ctx.arc(tx, ty, r * 0.82, 0, Math.PI * 2);
          ctx.stroke();

          drawStarPolygon(ctx, tx, ty, r * 0.95, r * 0.24, 6, burstT * 0.9);
          ctx.fillStyle = `rgba(224, 247, 255, ${0.55 * alpha})`;
          ctx.fill();

          for (const p of fx.particles) {
            const pt = clamp((burstT - p.delay) / (1 - p.delay), 0, 1);
            if (pt <= 0) continue;
            const d = easeOutCubic(pt) * p.spd * 0.85;
            const px = tx + Math.cos(p.ang) * d;
            const py = ty + Math.sin(p.ang) * d;
            ctx.globalAlpha = (1 - pt) * 0.95;
            drawCrystalShard(ctx, px, py, p.size * 3.1, p.size * 1.2, p.ang + pt * p.rotSpd, '#ffffff', '#60a5fa');
          }
        }
      } else if (fx.kind === 'starfrost_apex') {
        // 三阶·星霜极限：香槟金三环 + 冰雷电弧 + 巨型星霜圣枪垂直降临爆发
        const chargeT = clamp(t / 0.24, 0, 1);
        const burstT = clamp((t - 0.18) / 0.82, 0, 1);
        const alpha = 1 - Math.pow(burstT, 1.3);

        // 香槟金与冰青三重星霜法环
        [1.0, 0.74, 0.48].forEach((mul, idx) => {
          const rr = (36 + easeOutCubic(Math.min(1, t * 1.5)) * 162) * mul;
          ctx.strokeStyle = idx === 0
            ? `rgba(240, 201, 117, ${0.92 * alpha})`
            : idx === 1
              ? `rgba(125, 226, 255, ${0.95 * alpha})`
              : `rgba(255, 255, 255, ${0.92 * alpha})`;
          ctx.lineWidth = idx === 0 ? 4.2 : 2.8;
          ctx.beginPath();
          ctx.arc(tx, ty, rr, 0, Math.PI * 2);
          ctx.stroke();
        });

        // 巨型星霜光柱 + 天降冰枪
        if (chargeT > 0 && burstT < 0.75) {
          const beamAlpha = Math.sin(clamp(t / 0.72, 0, 1) * Math.PI);
          const beamW = 54 + (1 - burstT) * 48;
          const beamG = ctx.createLinearGradient(tx - beamW, 0, tx + beamW, 0);
          beamG.addColorStop(0, 'rgba(95, 212, 255, 0)');
          beamG.addColorStop(0.28, `rgba(95, 212, 255, ${0.42 * beamAlpha})`);
          beamG.addColorStop(0.5, `rgba(255, 255, 255, ${0.95 * beamAlpha})`);
          beamG.addColorStop(0.72, `rgba(240, 201, 117, ${0.46 * beamAlpha})`);
          beamG.addColorStop(1, 'rgba(240, 201, 117, 0)');
          ctx.fillStyle = beamG;
          ctx.fillRect(tx - beamW, 0, beamW * 2, tgtScr.feetY + 24);
        }

        // 双道冰雷电弧
        if (burstT > 0 && burstT < 0.65) {
          const arcA = (1 - burstT / 0.65);
          for (let a = 0; a < 3; a++) {
            ctx.strokeStyle = a === 0 ? `rgba(255,255,255,${arcA})` : `rgba(125,226,255,${0.85 * arcA})`;
            ctx.lineWidth = a === 0 ? 3.2 : 2.0;
            ctx.beginPath();
            const steps = 7;
            for (let s = 0; s <= steps; s++) {
              const frac = s / steps;
              const bx = lerp(sx, tx, frac) + (s === 0 || s === steps ? 0 : Math.sin(s * 3.7 + a * 2 + now * 0.04) * 34);
              const by = lerp(sy, ty, frac) + (s === 0 || s === steps ? 0 : Math.cos(s * 2.9 + a * 1.7) * 28);
              if (s === 0) ctx.moveTo(bx, by);
              else ctx.lineTo(bx, by);
            }
            ctx.stroke();
          }
        }

        // 核心星芒爆炸与钻石冰屑
        if (burstT > 0) {
          const coreR = 32 + easeOutCubic(burstT) * 185;
          const rad = ctx.createRadialGradient(tx, ty, 6, tx, ty, coreR);
          rad.addColorStop(0, `rgba(255, 255, 255, ${0.96 * alpha})`);
          rad.addColorStop(0.32, `rgba(125, 226, 255, ${0.78 * alpha})`);
          rad.addColorStop(0.62, `rgba(240, 201, 117, ${0.46 * alpha})`);
          rad.addColorStop(1, 'rgba(22, 88, 235, 0)');
          ctx.fillStyle = rad;
          ctx.beginPath();
          ctx.arc(tx, ty, coreR, 0, Math.PI * 2);
          ctx.fill();

          drawStarPolygon(ctx, tx, ty, coreR * 1.08, coreR * 0.18, 8, burstT * 0.75);
          ctx.fillStyle = `rgba(255, 252, 235, ${0.68 * alpha})`;
          ctx.fill();

          for (const p of fx.particles) {
            const pt = clamp((burstT - p.delay) / (1 - p.delay), 0, 1);
            if (pt <= 0) continue;
            const d = easeOutCubic(pt) * p.spd * 1.15;
            const px = tx + Math.cos(p.ang) * d;
            const py = ty + Math.sin(p.ang) * d;
            ctx.globalAlpha = (1 - pt) * 0.95;
            const edge = p.rot > Math.PI ? '#f0c975' : '#5fd4ff';
            drawCrystalShard(ctx, px, py, p.size * 3.4, p.size * 1.35, p.ang + pt * p.rotSpd, '#ffffff', edge);
          }
        }
      } else if (fx.kind === 'flame_lance') {
        // 炎岩贯冲：熔金烈焰长枪直贯 + 烈焰柱爆燃 + 火星飞溅
        const flyT = clamp(t / 0.25, 0, 1);
        const burstT = clamp((t - 0.20) / 0.80, 0, 1);
        const ang = Math.atan2(ty - sy, tx - sx);

        if (flyT < 1) {
          const px = lerp(sx, tx, easeOutCubic(flyT));
          const py = lerp(sy, ty, easeOutCubic(flyT));
          const grad = ctx.createLinearGradient(px - Math.cos(ang) * 165, py - Math.sin(ang) * 165, px, py);
          grad.addColorStop(0, 'rgba(251, 146, 60, 0)');
          grad.addColorStop(0.55, 'rgba(249, 115, 22, 0.88)');
          grad.addColorStop(0.88, 'rgba(253, 224, 71, 0.95)');
          grad.addColorStop(1, '#ffffff');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px - Math.cos(ang) * 165, py - Math.sin(ang) * 165);
          ctx.lineTo(px, py);
          ctx.stroke();
          drawCrystalShard(ctx, px, py, 56, 22, ang, '#fffbeb', '#f97316');
        }

        if (burstT > 0) {
          const alpha = 1 - burstT;
          const r = 34 + easeOutCubic(burstT) * 145;
          const rad = ctx.createRadialGradient(tx, ty, 8, tx, ty, r);
          rad.addColorStop(0, `rgba(255, 253, 232, ${0.95 * alpha})`);
          rad.addColorStop(0.38, `rgba(251, 191, 36, ${0.78 * alpha})`);
          rad.addColorStop(0.72, `rgba(239, 68, 68, ${0.42 * alpha})`);
          rad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = rad;
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fill();

          // 冲天炎柱
          const colW = 36 + (1 - burstT) * 34;
          const colH = 140 + easeOutCubic(burstT) * 150;
          const colG = ctx.createLinearGradient(tx, tgtScr.feetY, tx, tgtScr.feetY - colH);
          colG.addColorStop(0, `rgba(251, 191, 36, ${0.82 * alpha})`);
          colG.addColorStop(0.55, `rgba(249, 115, 22, ${0.58 * alpha})`);
          colG.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = colG;
          ctx.beginPath();
          ctx.ellipse(tx, tgtScr.feetY - colH * 0.45, colW, colH * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(253, 224, 71, ${0.9 * alpha})`;
          ctx.lineWidth = 3.6;
          ctx.beginPath();
          ctx.arc(tx, ty, r * 0.88, 0, Math.PI * 2);
          ctx.stroke();

          for (const p of fx.particles) {
            const pt = clamp((burstT - p.delay) / (1 - p.delay), 0, 1);
            if (pt <= 0) continue;
            const d = easeOutCubic(pt) * p.spd * 1.05;
            const px = tx + Math.cos(p.ang) * d;
            const py = ty + Math.sin(p.ang) * d - pt * 45;
            ctx.globalAlpha = (1 - pt) * 0.95;
            ctx.fillStyle = p.size > 5.5 ? '#fef08a' : '#fb923c';
            ctx.beginPath();
            ctx.arc(px, py, p.size * (1 - pt * 0.45), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (fx.kind === 'wolf_bite') {
        // 裂霜扑咬：冷冽冰青疾驰残影 + 三道利爪寒光斜斩
        const slashT = clamp((t - 0.14) / 0.72, 0, 1);
        if (t < 0.32) {
          const p = easeOutCubic(clamp(t / 0.28, 0, 1));
          const px = lerp(sx, tx, p);
          const py = lerp(sy, ty, p);
          ctx.strokeStyle = `rgba(147, 197, 253, ${0.75 * (1 - t / 0.32)})`;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(px, py);
          ctx.stroke();
        }

        if (slashT > 0) {
          const alpha = 1 - slashT;
          const span = 72 + easeOutCubic(slashT) * 58;
          [-22, 0, 22].forEach((off, idx) => {
            const localT = clamp(slashT * 1.3 - idx * 0.08, 0, 1);
            const curSpan = span * easeOutCubic(localT);
            ctx.strokeStyle = idx === 1 ? `rgba(255,255,255,${0.95 * alpha})` : `rgba(96, 165, 250, ${0.88 * alpha})`;
            ctx.lineWidth = idx === 1 ? 6.5 : 4.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tx + curSpan * 0.75, ty - curSpan * 0.58 + off);
            ctx.quadraticCurveTo(tx + 8, ty + off - 10, tx - curSpan * 0.75, ty + curSpan * 0.58 + off);
            ctx.stroke();
          });

          const r = 20 + easeOutCubic(slashT) * 78;
          const g = ctx.createRadialGradient(tx, ty, 3, tx, ty, r);
          g.addColorStop(0, `rgba(224, 242, 254, ${0.82 * alpha})`);
          g.addColorStop(0.55, `rgba(56, 189, 248, ${0.42 * alpha})`);
          g.addColorStop(1, 'rgba(37, 99, 235, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.kind === 'eclipse_rift') {
        // 诡道暗流·月蚀裂隙：晶透紫银新月斩裂 + 旋涡暗流星尘（色彩明净晶莹，绝不浑浊脏黑）
        const burstT = clamp((t - 0.16) / 0.84, 0, 1);
        const alpha = 1 - Math.pow(burstT, 1.25);

        // 旋涡紫银光带从罗文涌向目标
        if (t < 0.42) {
          const p = easeOutCubic(clamp(t / 0.34, 0, 1));
          for (let s = 0; s < 2; s++) {
            ctx.strokeStyle = s === 0
              ? `rgba(192, 132, 252, ${0.85 * (1 - t / 0.42)})`
              : `rgba(244, 114, 182, ${0.72 * (1 - t / 0.42)})`;
            ctx.lineWidth = s === 0 ? 7 : 4;
            ctx.beginPath();
            const mx = lerp(sx, tx, 0.5);
            const my = lerp(sy, ty, 0.5) + (s === 0 ? -75 : 65);
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(mx, my, lerp(sx, tx, p), lerp(sy, ty, p));
            ctx.stroke();
          }
        }

        if (burstT > 0) {
          const r = 34 + easeOutCubic(burstT) * 165;
          const rad = ctx.createRadialGradient(tx, ty, 8, tx, ty, r);
          rad.addColorStop(0, `rgba(255, 245, 255, ${0.95 * alpha})`);
          rad.addColorStop(0.32, `rgba(192, 132, 252, ${0.78 * alpha})`);
          rad.addColorStop(0.68, `rgba(124, 58, 237, ${0.44 * alpha})`);
          rad.addColorStop(1, 'rgba(76, 29, 149, 0)');
          ctx.fillStyle = rad;
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fill();

          // 弯月蚀弧与斜向空间裂隙
          ctx.strokeStyle = `rgba(233, 213, 255, ${0.95 * alpha})`;
          ctx.lineWidth = 4.4;
          ctx.beginPath();
          ctx.arc(tx, ty, r * 0.72, -Math.PI * 0.72, Math.PI * 0.42);
          ctx.stroke();

          ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
          ctx.lineWidth = 5.5 * (1 - burstT * 0.45);
          ctx.beginPath();
          ctx.moveTo(tx - r * 0.92, ty + r * 0.42);
          ctx.lineTo(tx + r * 0.92, ty - r * 0.42);
          ctx.stroke();

          ctx.strokeStyle = `rgba(192, 132, 252, ${0.88 * alpha})`;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(tx, ty, r * 0.94, 0, Math.PI * 2);
          ctx.stroke();

          for (const p of fx.particles) {
            const pt = clamp((burstT - p.delay) / (1 - p.delay), 0, 1);
            if (pt <= 0) continue;
            const d = easeOutCubic(pt) * p.spd * 1.1;
            const px = tx + Math.cos(p.ang + pt * 0.6) * d;
            const py = ty + Math.sin(p.ang + pt * 0.6) * d;
            ctx.globalAlpha = (1 - pt) * 0.92;
            const edge = p.rot > Math.PI ? '#f472b6' : '#c084fc';
            drawCrystalShard(ctx, px, py, p.size * 3.2, p.size * 1.25, p.ang + pt * p.rotSpd, '#ffffff', edge);
          }
        }
      }

      ctx.restore();
    }
  }

  function renderDamageNumbers(ctx, now) {
    for (let i = activeFloatNums.length - 1; i >= 0; i--) {
      const item = activeFloatNums[i];
      const t = (now - item.startTime) / item.duration;
      if (t >= 1) {
        activeFloatNums.splice(i, 1);
        continue;
      }
      const pop = t < 0.16 ? lerp(0.55, 1.22, easeOutCubic(t / 0.16)) : lerp(1.22, 1.0, clamp((t - 0.16) / 0.2, 0, 1));
      const rise = easeOutCubic(t) * 58;
      const alpha = t < 0.68 ? 1 : 1 - (t - 0.68) / 0.32;
      const isBig = item.style === 'apex' || item.style === 'eclipse' || item.style === 'fire';

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(item.x, item.y - rise);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${isBig ? 42 : 34}px "Segoe UI", "PingFang SC", system-ui, sans-serif`;

      const fill = item.style === 'apex'
        ? '#fef08a'
        : item.style === 'fire'
          ? '#fde047'
          : item.style === 'eclipse'
            ? '#f5d0fe'
            : item.style === 'enemy'
              ? '#fda4af'
              : '#e0f2fe';
      const stroke = item.style === 'apex'
        ? '#1658eb'
        : item.style === 'fire'
          ? '#b91c1c'
          : item.style === 'eclipse'
            ? '#581c87'
            : item.style === 'enemy'
              ? '#9f1239'
              : '#0f3a8a';

      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke;
      ctx.strokeText(item.dmg, 0, 0);
      ctx.fillStyle = fill;
      ctx.fillText(item.dmg, 0, 0);
      ctx.restore();
    }
  }

  function renderEnvOverlays(ctx) {
    // 1) 聚焦聚光压暗（保留焦点角色明亮通透）
    if (envFx.dimCur > 0.005) {
      const focusScr = envFx.focusActorId ? getActorScreen(envFx.focusActorId) : { x: viewWidth * 0.5, y: viewHeight * 0.52 };
      const innerR = Math.min(viewWidth, viewHeight) * 0.14;
      const outerR = Math.max(viewWidth, viewHeight) * 0.68;
      const g = ctx.createRadialGradient(focusScr.x, focusScr.y, innerR, focusScr.x, focusScr.y, outerR);
      g.addColorStop(0, 'rgba(10, 22, 48, 0)');
      g.addColorStop(0.42, `rgba(10, 22, 48, ${(envFx.dimCur * 0.36).toFixed(3)})`);
      g.addColorStop(1, `rgba(8, 18, 40, ${(envFx.dimCur * 0.96).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
    }

    // 2) 雪白光学景深柔焦高光框（绝不压暗雪景！）
    if (envFx.dofCur > 0.005) {
      const a = envFx.dofCur;
      const cx = viewWidth * 0.5;
      const cy = viewHeight * 0.5;
      const innerR = Math.min(viewWidth, viewHeight) * 0.34;
      const outerR = Math.max(viewWidth, viewHeight) * 0.72;
      const g = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      g.addColorStop(0, 'rgba(255, 255, 255, 0)');
      g.addColorStop(0.62, `rgba(235, 246, 255, ${(a * 0.22).toFixed(3)})`);
      g.addColorStop(1, `rgba(248, 252, 255, ${(a * 0.62).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      // 外围雪晶光学光斑（散景高光）
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.38;
      const bokehSpots = [
        [0.08, 0.14, 54],
        [0.92, 0.16, 62],
        [0.12, 0.86, 48],
        [0.88, 0.84, 58],
        [0.5,  0.06, 44],
      ];
      for (const [bx, by, br] of bokehSpots) {
        const bg = ctx.createRadialGradient(bx * viewWidth, by * viewHeight, 2, bx * viewWidth, by * viewHeight, br);
        bg.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        bg.addColorStop(0.6, 'rgba(186, 234, 255, 0.32)');
        bg.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx * viewWidth, by * viewHeight, br, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 13) 尺寸自适应与主循环
  function resize() {
    const rect = hostEl ? hostEl.getBoundingClientRect() : { width: 1280, height: 720 };
    viewWidth = Math.max(320, Math.round(rect.width || window.innerWidth || 1280));
    viewHeight = Math.max(200, Math.round(rect.height || window.innerHeight || 720));

    renderer.setSize(viewWidth, viewHeight, false);
    camera.aspect = viewWidth / viewHeight;
    camera.updateProjectionMatrix();

    const dpr = isSoftwareWebGL ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    vfxCanvas.width = Math.round(viewWidth * dpr);
    vfxCanvas.height = Math.round(viewHeight * dpr);
    if (vfxCtx) {
      vfxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined' && hostEl) {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(hostEl);
  }
  const onWindowResize = () => resize();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize);
  }

  // 14) 音效与状态栏
  const sound = createSoundEngine(config.soundEnabled !== false);

  function setTimelineStatus(phaseText = '', pauseMs = null) {
    const el = config.statusEl;
    if (!el) return;
    const phase = String(phaseText || '');
    if (pauseMs != null && Number.isFinite(Number(pauseMs))) {
      el.textContent = `${phase} · ${Math.round(Number(pauseMs))}ms`;
    } else {
      el.textContent = phase;
    }
  }

  // 15) 启动默认 Biome、镜头与 AV 行动条
  resize();
  setBiome(config.biome || config.initialBiome || 'academy');
  focusCamera('wide', 0);
  renderAvBar('sylvia');

  let rafId = 0;
  let disposed = false;
  let prevTime = performance.now();
  const startTime = prevTime;

  function tick(now) {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);

    const rawDt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
    prevTime = now;
    const isHitStopped = now < hitStopUntil;
    const dt = isHitStopped ? rawDt * 0.06 : rawDt;
    const elapsedSec = (now - startTime) / 1000;

    // A) 更新 Biome 动态环境
    if (currentBiomeHandle && typeof currentBiomeHandle.update === 'function') {
      try {
        currentBiomeHandle.update(elapsedSec, dt);
      } catch (_) {}
    }

    // B) 更新镜头插值 + 微震
    if (camState.active) {
      const p = clamp((now - camState.startTime) / camState.duration, 0, 1);
      const e = easeOutCubic(p);
      camState.curPos.lerpVectors(camState.fromPos, camState.toPos, e);
      camState.curTarget.lerpVectors(camState.fromTarget, camState.toTarget, e);
      camState.curFov = lerp(camState.fromFov, camState.toFov, e);
      if (p >= 1) {
        camState.active = false;
        if (camState.resolver) {
          const done = camState.resolver;
          camState.resolver = null;
          done();
        }
      }
    }

    let sx = 0;
    let sy = 0;
    if (shakeIntensity > 0.002) {
      sx = (Math.random() - 0.5) * 2 * shakeIntensity;
      sy = (Math.random() - 0.5) * 2 * shakeIntensity;
      shakeIntensity = Math.max(0, shakeIntensity - shakeDecay * rawDt * 1000);
    }

    camera.position.set(camState.curPos.x + sx, camState.curPos.y + sy, camState.curPos.z);
    if (Math.abs(camera.fov - camState.curFov) > 0.01) {
      camera.fov = camState.curFov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(camState.curTarget.x + sx * 0.35, camState.curTarget.y + sy * 0.35, camState.curTarget.z);

    // C) 更新环境压暗与景深平滑值
    if (envFx.dimDur > 0 && envFx.dimCur !== envFx.dimTo) {
      const p = clamp((now - envFx.dimStart) / envFx.dimDur, 0, 1);
      envFx.dimCur = lerp(envFx.dimFrom, envFx.dimTo, easeOutCubic(p));
    }
    if (envFx.dofDur > 0 && envFx.dofCur !== envFx.dofTo) {
      const p = clamp((now - envFx.dofStart) / envFx.dofDur, 0, 1);
      envFx.dofCur = lerp(envFx.dofFrom, envFx.dofTo, easeOutCubic(p));
    }

    // D) 更新角色呼吸帧、蓄力/冲刺/受击位姿与朝向摄像机微偏
    for (let idx = 0; idx < actorOrder.length; idx++) {
      const actor = actorOrder[idx];
      const dir = actor.facing === 'right' ? 1 : -1;
      const poseAge = (now - actor.poseStartedAt) / 1000;

      if (actor.hurtFlash > 0) {
        actor.hurtFlash = Math.max(0, actor.hurtFlash - rawDt * 4.5);
      }

      let targetOffX = 0;
      let targetOffY = 0;

      if (actor.pose === 'idle') {
        const cycle = (elapsedSec * 1.8 + idx * 0.7) % 6.0;
        const idleFrame = cycle > 5.75 && actor.frameCount > 2 ? 2 : (Math.floor(elapsedSec * 2.1 + idx) % 2);
        actor.setFrame(idleFrame);
        targetOffY = Math.sin(elapsedSec * 2.6 + idx * 1.1) * 0.025;
      } else if (actor.pose === 'windup') {
        targetOffX = -dir * 0.14;
        targetOffY = Math.sin(elapsedSec * 12) * 0.02;
      } else if (actor.pose === 'cast') {
        const dashCurve = Math.sin(clamp(poseAge / 0.42, 0, 1) * Math.PI);
        targetOffX = dir * 0.52 * dashCurve;
        targetOffY = 0.06 * dashCurve;
      } else if (actor.pose === 'hurt') {
        const recoil = Math.max(0, 1 - poseAge / 0.34);
        targetOffX = -dir * 0.24 * recoil + Math.sin(poseAge * 58) * 0.09 * recoil;
      }

      actor.offsetX = lerp(actor.offsetX, targetOffX, 0.28);
      actor.offsetY = lerp(actor.offsetY, targetOffY, 0.28);
      actor.group.position.set(
        actor.pos[0] + actor.offsetX,
        actor.pos[1] + actor.offsetY,
        actor.pos[2] + actor.offsetZ
      );

      // 保持立牌微朝向镜头（Y 轴轻度广告牌，保持 HD-2D 透视体积感）
      const yaw = Math.atan2(camera.position.x - actor.group.position.x, camera.position.z - actor.group.position.z);
      actor.mesh.rotation.y = clamp(yaw * 0.35, -0.32, 0.32);
    }

    syncLightDimming();

    // E) 渲染 3D 舞台
    renderer.render(scene, camera);

    // F) 渲染 2D 覆层（聚光压暗 / 雪白景深 / 魔法阵 / 技能特效 / 伤害数字）
    if (vfxCtx) {
      vfxCtx.clearRect(0, 0, viewWidth, viewHeight);
      renderEnvOverlays(vfxCtx);
      renderMagicRings(vfxCtx, now);
      renderSkillVfx(vfxCtx, now);
      renderDamageNumbers(vfxCtx, now);
    }
  }

  rafId = requestAnimationFrame(tick);

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onWindowResize);
    }
    for (const actor of actorOrder) {
      if (actor.poseResetTimer) clearTimeout(actor.poseResetTimer);
      actor.mesh.geometry.dispose();
      actor.material.dispose();
      actor.texture.dispose();
      actor.shadowMesh.geometry.dispose();
      actor.shadowMesh.material.dispose();
      actor.spotMesh.geometry.dispose();
      actor.spotMat.dispose();
    }
    shadowTex.dispose();
    spotlightTex.dispose();
    for (const k of Object.keys(biomeCache)) {
      if (biomeCache[k] && typeof biomeCache[k].dispose === 'function') {
        biomeCache[k].dispose();
      }
    }
    if (texLib && typeof texLib.dispose === 'function') {
      texLib.dispose();
    }
    renderer.dispose();
  }

  return {
    ACTORS,
    SKILLS,
    wait,
    setBiome,
    focusCamera,
    setEnvDim,
    setBrightDoF,
    spawnMagicRing,
    playPose,
    getActorScreen,
    playSkillImpact,
    playSFX: sound.playSFX,
    setSoundEnabled: sound.setSoundEnabled,
    isSoundEnabled: sound.isSoundEnabled,
    setTimelineStatus,
    // 扩展辅助方法（兼容各方案调用）
    renderAvBar,
    resize,
    dispose,
    getBiome: () => currentBiomeKey,
  };
}
