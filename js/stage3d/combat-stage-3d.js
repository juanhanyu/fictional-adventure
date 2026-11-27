/**
 * combat-stage-3d.js
 * Production HD-2D 3D Combat Stage Controller for 《转生千金～到了异世界就要悠闲地生活》
 *
 * Exposes window.CombatStage3D as an ES Module with strict same-origin imports.
 * - Zero-error silent fallback in jsdom / headless / no-WebGL environments
 * - Dual-tier rendering: Hardware GPU Ultra (HDR Bloom + 13-tap Tilt-Shift + shadows + 60fps)
 *   vs Software WebGL (SwiftShader/llvmpipe: AA off, DPR 0.75, direct render, 220ms post-render idle gap)
 * - 9-stage + dream duel + Wave 2 / Phase 2 automatic biome & atmosphere mood director
 * - Dynamic wide-beast Z/X staggered formations (zero clumping, zero right-edge clipping)
 * - Scheme C dynamic 3D camera director with crowd anti-clip safety clamping & trauma shake
 * - O(1) 3D->2D projection bridge for Edition-A 75 VFX, GPU enemy card anchoring & Prism UI tracking
 */

import * as THREE from '../vendor/three/three.module.min.js';
import { createPBRTextureLibrary } from './textures-pbr.js';
import { buildAcademyBiome } from './biome-academy.js';
import { buildForestBiome } from './biome-forest.js';
import { buildAltarBiome } from './biome-altar.js';
import { createHD2DPostPipeline } from './atmosphere-post.js';

/* ============================================================================
 * 1. Constants & Pure Utilities (Safe in Node / jsdom / Browser)
 * ============================================================================ */

const BANK_CHARS =
  '.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&()_+-=<>?[]{}|~';

const BANK_CHAR_LUT = new Int8Array(128);
BANK_CHAR_LUT.fill(-1);
for (let i = 0; i < BANK_CHARS.length; i++) {
  const code = BANK_CHARS.charCodeAt(i);
  if (code < 128) BANK_CHAR_LUT[code] = i;
}

const SOFTWARE_RENDERER_RE =
  /SwiftShader|llvmpipe|Software|Basic Render|Mesa OffScreen|Google SwiftShader/i;
const SOFTWARE_IDLE_GAP_MS = 220;
const SOFTWARE_PIXEL_RATIO = 0.75;
const SOFTWARE_MAX_DT_SEC = 0.32;

const SCHEME_C_BASE_POS = Object.freeze([0, 5.30, 14.2]);
const SCHEME_C_BASE_LOOK = Object.freeze([0, 1.35, 0]);
const SCHEME_C_BASE_FOV = 34;

const BIOME_BUILDERS = Object.freeze({
  academy: buildAcademyBiome,
  forest: buildForestBiome,
  altar: buildAltarBiome,
});

const STAGE_SCENE_MAP = Object.freeze({
  beatrice_11: { biome: 'academy', mood: 'sunny_snow' },
  rowan_graveyard: { biome: 'forest', mood: 'graveyard_mist' },
  alice_9: { biome: 'academy', mood: 'breeze_day' },
  aino_sparring: { biome: 'academy', mood: 'frost_mirror' },
  noelle_14: { biome: 'academy', mood: 'thaw_twilight' },
  north_forest_hunt: { biome: 'forest', mood: 'deep_pine' },
  hulan_beast_tide: {
    biome: 'forest',
    mood: 'blizzard_canyon',
    wave2Mood: 'blizzard_canyon_w2',
  },
  turning_point_corridor: {
    biome: 'academy',
    mood: 'fire_corridor',
    phase2Mood: 'fire_corridor_p2',
  },
  wind_god_eye: {
    biome: 'altar',
    mood: 'cloud_eye',
    phase2Mood: 'storm_eye',
  },
});

const MOOD_PRESETS = Object.freeze({
  sunny_snow: {
    background: 0xcbe0f7,
    fog: { color: 0xdbe8f8, near: 18, far: 54 },
    exposure: 1.06,
    sky: { zenith: 0x3f7de0, mid: 0x94c4f5, horizon: 0xeef5fc, sunWarm: 0xfff4d9 },
    light: { sunTint: 0xfff6e8, sunMult: 1.0, hemiSky: 0xd9ecff, hemiGnd: 0xd8e2f0, hemiMult: 1.0, ambMult: 1.0 },
    rimTint: [1.0, 1.0, 1.02],
    accent: null,
    post: {
      particleType: 'snow',
      particleColor: 0xffffff,
      particleSecondaryColor: 0xeaf6ff,
      particleCount: 420,
      godRayColor: 0xfff3d6,
      godRayOpacity: 0.22,
      bloomStrength: 0.34,
      bloomThreshold: 0.80,
      bloomRadius: 0.60,
      focusDepth: 0.56,
      blurAmount: 1.65,
      vignetteStrength: 0.08,
    },
  },
  breeze_day: {
    background: 0xc4e3fa,
    fog: { color: 0xdaf0fc, near: 20, far: 58 },
    exposure: 1.09,
    sky: { zenith: 0x458ef0, mid: 0x98d4fc, horizon: 0xeef9ff, sunWarm: 0xfff7e2 },
    light: { sunTint: 0xfff9ee, sunMult: 1.06, hemiSky: 0xdff5ff, hemiGnd: 0xdde8f2, hemiMult: 1.06, ambMult: 1.04 },
    rimTint: [0.98, 1.01, 1.04],
    accent: null,
    post: {
      particleType: 'windMotes',
      particleColor: 0xe4f7ff,
      particleSecondaryColor: 0xfff4d0,
      particleCount: 360,
      godRayColor: 0xf4fbff,
      godRayOpacity: 0.24,
      bloomStrength: 0.36,
      bloomThreshold: 0.80,
      bloomRadius: 0.62,
      focusDepth: 0.56,
      blurAmount: 1.55,
      vignetteStrength: 0.06,
    },
  },
  frost_mirror: {
    background: 0xb6daf7,
    fog: { color: 0xcde9fc, near: 17, far: 50 },
    exposure: 1.05,
    sky: { zenith: 0x2c6ad4, mid: 0x7cbcf5, horizon: 0xe4f6ff, sunWarm: 0xe8f9ff },
    light: { sunTint: 0xeef9ff, sunMult: 1.02, hemiSky: 0xc7ecff, hemiGnd: 0xc8def4, hemiMult: 1.05, ambMult: 1.05 },
    rimTint: [0.93, 1.0, 1.08],
    accent: { color: 0x76e8ff, intensity: 1.1, distance: 18, pos: [0, 3.6, -1.5], pulseAmp: 0.16, pulseSpeed: 2.2 },
    post: {
      particleType: 'iceDust',
      particleColor: 0xb8f3ff,
      particleSecondaryColor: 0xffffff,
      particleCount: 480,
      godRayColor: 0xdbf6ff,
      godRayOpacity: 0.28,
      bloomStrength: 0.42,
      bloomThreshold: 0.76,
      bloomRadius: 0.64,
      focusDepth: 0.56,
      blurAmount: 1.75,
      vignetteStrength: 0.09,
    },
  },
  thaw_twilight: {
    background: 0xd3c4df,
    fog: { color: 0xe8d9e4, near: 19, far: 56 },
    exposure: 1.04,
    sky: { zenith: 0x475eb4, mid: 0x9aa4dc, horizon: 0xf9dfc8, sunWarm: 0xffd59e },
    light: { sunTint: 0xffdeb8, sunMult: 1.04, hemiSky: 0xd8d6f8, hemiGnd: 0xead6cc, hemiMult: 0.98, ambMult: 1.0 },
    rimTint: [1.05, 0.99, 0.96],
    accent: { color: 0xffcf94, intensity: 0.95, distance: 18, pos: [-3.5, 4.2, -2.5], pulseAmp: 0.10, pulseSpeed: 1.6 },
    post: {
      particleType: 'snow',
      particleColor: 0xfff2dc,
      particleSecondaryColor: 0xdceeff,
      particleCount: 380,
      godRayColor: 0xffdca8,
      godRayOpacity: 0.26,
      bloomStrength: 0.40,
      bloomThreshold: 0.78,
      bloomRadius: 0.66,
      focusDepth: 0.56,
      blurAmount: 1.70,
      vignetteStrength: 0.10,
    },
  },
  fire_corridor: {
    background: 0x5c475a,
    fog: { color: 0x9a6b68, near: 19, far: 54 },
    exposure: 1.02,
    sky: { zenith: 0x2b325c, mid: 0x73495c, horizon: 0xd97d54, sunWarm: 0xffb366 },
    light: { sunTint: 0xffc084, sunMult: 0.95, hemiSky: 0x9fb8e8, hemiGnd: 0xb8765c, hemiMult: 0.88, ambMult: 1.10 },
    rimTint: [1.08, 0.97, 0.92],
    accent: { color: 0xff7b3b, intensity: 2.2, distance: 22, pos: [2.8, 3.2, -1.8], pulseAmp: 0.35, pulseSpeed: 6.4 },
    post: {
      particleType: 'windMotes',
      particleColor: 0xffa652,
      particleSecondaryColor: 0xffe296,
      particleCount: 440,
      godRayColor: 0xffc482,
      godRayOpacity: 0.28,
      bloomStrength: 0.46,
      bloomThreshold: 0.74,
      bloomRadius: 0.66,
      focusDepth: 0.56,
      blurAmount: 1.70,
      vignetteStrength: 0.13,
    },
  },
  fire_corridor_p2: {
    background: 0x4d3448,
    fog: { color: 0x9e5954, near: 17, far: 48 },
    exposure: 1.04,
    sky: { zenith: 0x221b44, mid: 0x7a334a, horizon: 0xeb5e3c, sunWarm: 0xff9a44 },
    light: { sunTint: 0xffa366, sunMult: 1.04, hemiSky: 0x96aee8, hemiGnd: 0xc96248, hemiMult: 0.86, ambMult: 1.15 },
    rimTint: [1.12, 0.94, 0.88],
    accent: { color: 0xff5a2b, intensity: 3.1, distance: 24, pos: [2.6, 3.0, -1.2], pulseAmp: 0.55, pulseSpeed: 9.2 },
    post: {
      particleType: 'windMotes',
      particleColor: 0xff7a3c,
      particleSecondaryColor: 0xffd56e,
      particleCount: 560,
      godRayColor: 0xff9e5c,
      godRayOpacity: 0.34,
      bloomStrength: 0.54,
      bloomThreshold: 0.70,
      bloomRadius: 0.70,
      focusDepth: 0.56,
      blurAmount: 1.75,
      vignetteStrength: 0.16,
    },
  },
  graveyard_mist: {
    background: 0x6282ad,
    fog: { color: 0x82a0c8, near: 15, far: 46 },
    exposure: 1.00,
    light: { sunTint: 0xcce2ff, sunMult: 0.78, hemiSky: 0x9fc2ee, hemiGnd: 0x6e85ad, hemiMult: 0.96, ambMult: 1.18 },
    rimTint: [0.92, 0.98, 1.10],
    accent: { color: 0x92c8ff, intensity: 1.55, distance: 20, pos: [0.5, 4.4, -2.5], pulseAmp: 0.14, pulseSpeed: 1.8 },
    post: {
      particleType: 'iceDust',
      particleColor: 0xd0eaff,
      particleSecondaryColor: 0x94c4ff,
      particleCount: 420,
      godRayColor: 0xd4eaff,
      godRayOpacity: 0.30,
      bloomStrength: 0.44,
      bloomThreshold: 0.74,
      bloomRadius: 0.66,
      focusDepth: 0.56,
      blurAmount: 1.85,
      vignetteStrength: 0.14,
    },
  },
  deep_pine: {
    background: 0xb7d6f0,
    fog: { color: 0xcbe3f6, near: 16, far: 48 },
    exposure: 1.06,
    light: { sunTint: 0xfff0d4, sunMult: 1.0, hemiSky: 0xdaf1ff, hemiGnd: 0x9dc4e8, hemiMult: 1.0, ambMult: 1.0 },
    rimTint: [0.97, 1.01, 1.03],
    accent: null,
    post: {
      particleType: 'iceDust',
      particleColor: 0xc8f4ff,
      particleSecondaryColor: 0xfff4d6,
      particleCount: 460,
      godRayColor: 0xe6f7ff,
      godRayOpacity: 0.28,
      bloomStrength: 0.42,
      bloomThreshold: 0.76,
      bloomRadius: 0.65,
      focusDepth: 0.56,
      blurAmount: 1.80,
      vignetteStrength: 0.09,
    },
  },
  blizzard_canyon: {
    background: 0xb4d2ec,
    fog: { color: 0xc9dff2, near: 14, far: 44 },
    exposure: 1.05,
    light: { sunTint: 0xe6f5ff, sunMult: 0.94, hemiSky: 0xd0ecff, hemiGnd: 0xb0d0ea, hemiMult: 1.04, ambMult: 1.06 },
    rimTint: [0.93, 0.99, 1.08],
    accent: { color: 0x86dcff, intensity: 1.2, distance: 20, pos: [1.5, 4.0, -2.0], pulseAmp: 0.18, pulseSpeed: 3.1 },
    post: {
      particleType: 'snow',
      particleColor: 0xf2faff,
      particleSecondaryColor: 0xbbeeff,
      particleCount: 540,
      godRayColor: 0xd8f0ff,
      godRayOpacity: 0.25,
      bloomStrength: 0.42,
      bloomThreshold: 0.77,
      bloomRadius: 0.64,
      focusDepth: 0.56,
      blurAmount: 1.80,
      vignetteStrength: 0.10,
    },
  },
  blizzard_canyon_w2: {
    background: 0x90b8de,
    fog: { color: 0xa9c9e8, near: 13, far: 42 },
    exposure: 1.04,
    light: { sunTint: 0xd2eeff, sunMult: 0.90, hemiSky: 0xb8e0ff, hemiGnd: 0x8cb8e0, hemiMult: 1.06, ambMult: 1.12 },
    rimTint: [0.90, 0.99, 1.12],
    accent: { color: 0x4cc8ff, intensity: 2.3, distance: 24, pos: [3.2, 3.2, -1.0], pulseAmp: 0.42, pulseSpeed: 4.8 },
    post: {
      particleType: 'snow',
      particleColor: 0xdcf4ff,
      particleSecondaryColor: 0x7ae2ff,
      particleCount: 680,
      godRayColor: 0xb8e8ff,
      godRayOpacity: 0.32,
      bloomStrength: 0.50,
      bloomThreshold: 0.72,
      bloomRadius: 0.68,
      focusDepth: 0.56,
      blurAmount: 1.85,
      vignetteStrength: 0.13,
    },
  },
  cloud_eye: {
    background: 0x9ec8f2,
    fog: { color: 0xd9e8f9, near: 22, far: 68 },
    exposure: 1.06,
    light: { sunTint: 0xfff2d8, sunMult: 1.0, hemiSky: 0x94ceff, hemiGnd: 0xffdca0, hemiMult: 1.0, ambMult: 1.0 },
    rimTint: [1.03, 1.01, 0.98],
    accent: null,
    post: {
      particleType: 'windMotes',
      particleColor: 0xfff2c6,
      particleSecondaryColor: 0x9aeaff,
      particleCount: 440,
      godRayColor: 0xffe8b0,
      godRayOpacity: 0.26,
      bloomStrength: 0.44,
      bloomThreshold: 0.78,
      bloomRadius: 0.68,
      focusDepth: 0.56,
      blurAmount: 1.65,
      vignetteStrength: 0.08,
    },
  },
  storm_eye: {
    background: 0x6299cf,
    fog: { color: 0xa0c6e8, near: 18, far: 56 },
    exposure: 1.05,
    light: { sunTint: 0xd8f8ff, sunMult: 1.02, hemiSky: 0x80d8ff, hemiGnd: 0xd8c898, hemiMult: 1.08, ambMult: 1.12 },
    rimTint: [0.94, 1.04, 1.08],
    accent: { color: 0x5ce8ff, intensity: 2.6, distance: 24, pos: [2.8, 3.6, -1.0], pulseAmp: 0.50, pulseSpeed: 7.4 },
    post: {
      particleType: 'windMotes',
      particleColor: 0x8ef5ff,
      particleSecondaryColor: 0xffe596,
      particleCount: 640,
      godRayColor: 0xa0ecff,
      godRayOpacity: 0.36,
      bloomStrength: 0.56,
      bloomThreshold: 0.72,
      bloomRadius: 0.72,
      focusDepth: 0.56,
      blurAmount: 1.75,
      vignetteStrength: 0.12,
    },
  },
});

const GHOST_TONE_HEX = Object.freeze({
  ice: 0x7ce8ff,
  frost: 0x9cf2ff,
  water: 0x45c8ff,
  gold: 0xffe08a,
  star: 0xffe69c,
  crimson: 0xff6b82,
  fire: 0xff9254,
  wind: 0x8af5d8,
  shadow: 0x8698dc,
  silver: 0xd8ecff,
});

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hashString(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.trim();
  if (clean.charCodeAt(0) === 35) clean = clean.slice(1);
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function isJsdomEnv() {
  try {
    const ua =
      typeof navigator !== 'undefined' && navigator.userAgent
        ? navigator.userAgent
        : '';
    return /jsdom/i.test(ua);
  } catch (_) {
    return false;
  }
}

/* ============================================================================
 * 2. Silent WebGL Probe & Hardware/Software Tier Detection
 * ============================================================================ */

let _probeResult = null;

function probeWebGL() {
  if (_probeResult) return _probeResult;

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    isJsdomEnv()
  ) {
    _probeResult = {
      supported: false,
      isSoftware: false,
      rendererName: 'headless',
    };
    return _probeResult;
  }

  let forceSoftware = false;
  try {
    if (window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const s3dParam = (params.get('stage3d') || '').toLowerCase();
      if (s3dParam === '0' || s3dParam === 'off' || s3dParam === 'false') {
        _probeResult = {
          supported: false,
          isSoftware: false,
          rendererName: 'disabled:?stage3d=0',
        };
        return _probeResult;
      }
      if ((params.get('perf') || '').toLowerCase() === 'low') {
        forceSoftware = true;
      }
    }
  } catch (_) {
    // Ignore URL parsing issues
  }

  let gl = null;
  let rendererName = '';
  try {
    const probeCanvas = document.createElement('canvas');
    if (!probeCanvas || typeof probeCanvas.getContext !== 'function') {
      _probeResult = { supported: false, isSoftware: false, rendererName: 'no-canvas' };
      return _probeResult;
    }
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    const probeAttrs = {
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    };
    gl =
      probeCanvas.getContext('webgl2', probeAttrs) ||
      probeCanvas.getContext('webgl', probeAttrs) ||
      probeCanvas.getContext('experimental-webgl', probeAttrs);

    if (gl) {
      try {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo && debugInfo.UNMASKED_RENDERER_WEBGL) {
          const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (unmasked) rendererName = String(unmasked);
        }
        if (!rendererName) {
          const fallback = gl.getParameter(gl.RENDERER);
          if (fallback) rendererName = String(fallback);
        }
      } catch (_) {
        // Ignore renderer string query error
      }
    }
  } catch (_) {
    gl = null;
  } finally {
    if (gl) {
      try {
        const loseExt = gl.getExtension('WEBGL_lose_context');
        if (loseExt && typeof loseExt.loseContext === 'function') {
          loseExt.loseContext();
        }
      } catch (_) {
        // Ignore context loss error
      }
    }
  }

  const supported = Boolean(gl);
  const isSoftware =
    supported && (forceSoftware || SOFTWARE_RENDERER_RE.test(rendererName));

  _probeResult = {
    supported,
    isSoftware,
    rendererName: rendererName || (forceSoftware ? 'url:?perf=low' : supported ? 'webgl' : 'none'),
  };
  return _probeResult;
}

/* ============================================================================
 * 3. Procedural Ground Ring & Glow Textures
 * ============================================================================ */

function createSoftGlowDiscTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size * 0.5;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    grad.addColorStop(0.32, 'rgba(255,255,255,0.72)');
    grad.addColorStop(0.66, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createAllyOuterRingTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const rOuter = size * 0.44;
    const rInner = size * 0.385;

    ctx.strokeStyle = 'rgba(22, 88, 235, 0.42)';
    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.arc(cx, cy, (rOuter + rInner) * 0.5, 0, Math.PI * 2);
    ctx.stroke();

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
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createAllyInnerRingTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const r = size * 0.31;

    ctx.strokeStyle = 'rgba(248, 213, 126, 0.92)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

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
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createEnemyOuterReticleTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const r = size * 0.43;

    ctx.strokeStyle = 'rgba(255, 77, 109, 0.34)';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ff5778';
    ctx.lineWidth = 3.8;
    const arcSpan = Math.PI * 0.32;
    for (let i = 0; i < 4; i++) {
      const mid = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, mid - arcSpan * 0.5, mid + arcSpan * 0.5);
      ctx.stroke();
    }

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
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createEnemyInnerReticleTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const r = size * 0.315;

    ctx.strokeStyle = 'rgba(110, 231, 255, 0.92)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

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
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createPlaceholderSpriteData() {
  const w = 64;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  let rgba = new Uint8ClampedArray(w * h * 4);
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(18, 18, 28, 70);
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(22, 22, 20, 20);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(22, 46, 20, 38);
    rgba = ctx.getImageData(0, 0, w, h).data;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return {
    canvas,
    texture,
    rgba,
    width: w,
    height: h,
    visBBox: { minX: 18, maxX: 45, minY: 18, maxY: 87, visW: 28, visH: 70 },
    anchors: { feet: [32, 87], cast: [50, 48], hit: [32, 52], head: [32, 24] },
    facing: 'right',
    frameCount: 1,
  };
}

/* ============================================================================
 * 4. Stage Scene / Mood & Sprite-ID Resolvers
 * ============================================================================ */

function detectHasPhase2(battleState) {
  if (!battleState || typeof battleState !== 'object') return false;
  if (battleState.phase >= 2 || battleState.isPhase2) return true;
  if (Array.isArray(battleState.enemies)) {
    for (let i = 0; i < battleState.enemies.length; i++) {
      const e = battleState.enemies[i];
      if (e && (e.phase || 1) >= 2) return true;
    }
  }
  return false;
}

function resolveStageScene(battleState) {
  const b = battleState && typeof battleState === 'object' ? battleState : {};
  const stageId = String(b.id || b.stageId || (b.stageCfg && b.stageCfg.id) || '').trim();
  const waveIdx = Number.isFinite(b.waveIdx) ? b.waveIdx : 0;
  const hasPhase2 = detectHasPhase2(b);

  const exact = STAGE_SCENE_MAP[stageId];
  if (exact) {
    let mood = exact.mood;
    if (exact.wave2Mood && waveIdx >= 1) {
      mood = exact.wave2Mood;
    } else if (exact.phase2Mood && hasPhase2) {
      mood = exact.phase2Mood;
    }
    return { biomeId: exact.biome, moodKey: mood, stageId, waveIdx, hasPhase2 };
  }

  const bgStr = String(
    b.bg || (b.stageCfg && b.stageCfg.bg) || ''
  ).toLowerCase();

  let biomeId = 'academy';
  let moodKey = 'sunny_snow';
  if (bgStr.includes('hallway')) {
    biomeId = 'academy';
    moodKey = hasPhase2 ? 'fire_corridor_p2' : 'fire_corridor';
  } else if (bgStr.includes('forest')) {
    biomeId = 'forest';
    moodKey = 'deep_pine';
  } else if (bgStr.includes('snow') || bgStr.includes('canyon')) {
    biomeId = 'forest';
    moodKey = waveIdx >= 1 ? 'blizzard_canyon_w2' : 'blizzard_canyon';
  } else if (bgStr.includes('night') || bgStr.includes('grave')) {
    biomeId = 'forest';
    moodKey = 'graveyard_mist';
  } else if (bgStr.includes('wind') || bgStr.includes('altar')) {
    biomeId = 'altar';
    moodKey = hasPhase2 ? 'storm_eye' : 'cloud_eye';
  }

  return { biomeId, moodKey, stageId, waveIdx, hasPhase2 };
}

function fallbackResolveSpriteId(kind, entity, battleState) {
  const pxApi =
    typeof window !== 'undefined' && window.CombatPixelVFX
      ? window.CombatPixelVFX
      : null;

  if (kind === 'player') {
    if (pxApi && typeof pxApi.resolvePlayerSpriteId === 'function') {
      try {
        const res = pxApi.resolvePlayerSpriteId(battleState);
        if (res) return String(res);
      } catch (_) {
        // fallback below
      }
    }
    const sid = String((battleState && battleState.id) || '');
    if (sid === 'north_forest_hunt' || sid === 'hulan_beast_tide' || sid === 'wind_god_eye') {
      return 'sylvia_disguise';
    }
    const age = battleState && battleState.player ? Number(battleState.player.age) : 14;
    if (age > 0 && age <= 11) return 'sylvia_young';
    return 'sylvia_silver';
  }

  if (kind === 'ally') {
    if (pxApi && typeof pxApi.resolveAllySpriteId === 'function') {
      try {
        const res = pxApi.resolveAllySpriteId(entity);
        if (res) return String(res);
      } catch (_) {
        // fallback below
      }
    }
    const raw = String((entity && (entity.spriteId || entity.id || entity.charId)) || 'reno').toLowerCase();
    const bank = typeof globalThis !== 'undefined' ? globalThis.PIXEL_SPRITE_BANK : null;
    if (bank && bank[raw]) return raw;
    if (raw.includes('reno') || raw.includes('leon')) return 'reno';
    if (raw.includes('charlotte')) return 'charlotte';
    if (raw.includes('alice')) return 'alice';
    if (raw.includes('jilan')) return 'jilan';
    if (raw.includes('aino')) return 'aino';
    if (raw.includes('noelle')) return 'noelle';
    if (raw.includes('beatrice')) return 'beatrice';
    return 'reno';
  }

  if (pxApi && typeof pxApi.resolveEnemySpriteId === 'function') {
    try {
      const res = pxApi.resolveEnemySpriteId(entity);
      if (res) return String(res);
    } catch (_) {
      // fallback below
    }
  }
  const raw = String(
    (entity && (entity.spriteId || entity.id || entity.charId || entity.crestKind || entity.aiType)) ||
      'beatrice'
  ).toLowerCase();
  const bank = typeof globalThis !== 'undefined' ? globalThis.PIXEL_SPRITE_BANK : null;
  if (bank && bank[raw]) return raw;
  if (raw.includes('wind_god') || raw.includes('fengshen')) return 'wind_god_avatar';
  if (raw.includes('abyss_behemoth') || raw.includes('hulan_lord')) return 'abyss_behemoth';
  if (raw.includes('eastwing')) return 'eastwing_commander';
  if (raw.includes('vanguard')) return 'corridor_vanguard';
  if (raw.includes('flame_mage')) return 'flame_mage';
  if (raw.includes('tundra_brute') || raw.includes('hulan_brute')) return 'tundra_brute';
  if (raw.includes('frost_hound')) return 'frost_hound';
  if (raw.includes('ridge_claw')) return 'ridge_claw';
  if (raw.includes('shadow_jackal')) return 'shadow_jackal';
  if (raw.includes('wolf_alpha')) return 'wolf_alpha';
  if (raw.includes('wolf')) return 'pack_wolf';
  if (raw.includes('rowan')) return 'rowan';
  if (raw.includes('beatrice')) return 'beatrice';
  if (raw.includes('alice')) return 'alice';
  if (raw.includes('aino')) return 'aino';
  if (raw.includes('noelle')) return 'noelle';
  return 'beatrice';
}

/* ============================================================================
 * 5. Dynamic Wide-Beast Z/X Staggered Formation Layout
 * ============================================================================ */

const ALLY_SLOTS_6 = Object.freeze([
  { pos: [-1.95, 0, 0.92], heightWorld: 2.22 }, // 0: player front-lower C-spot
  { pos: [-3.00, 0, -0.45], heightWorld: 2.20 },
  { pos: [-4.15, 0, -1.90], heightWorld: 2.18 },
  { pos: [-3.80, 0, 0.85], heightWorld: 2.18 },
  { pos: [-4.85, 0, -0.60], heightWorld: 2.18 },
  { pos: [-5.75, 0, -2.00], heightWorld: 2.18 },
]);

const ENEMY_WIDE_SLOTS_3 = Object.freeze([
  { pos: [1.45, 0, 1.20], heightWorld: 1.56 },
  { pos: [3.65, 0, -1.55], heightWorld: 1.54 },
  { pos: [5.15, 0, 0.70], heightWorld: 1.52 },
]);

const ENEMY_WIDE_SLOTS_4 = Object.freeze([
  { pos: [1.35, 0, 1.30], heightWorld: 1.54 },
  { pos: [2.95, 0, -1.55], heightWorld: 1.52 },
  { pos: [4.25, 0, 0.85], heightWorld: 1.50 },
  { pos: [5.55, 0, -1.45], heightWorld: 1.48 },
]);

const ENEMY_HUMANOID_SLOTS_4 = Object.freeze([
  { pos: [1.95, 0, 1.05], heightWorld: 2.38 },
  { pos: [2.85, 0, -0.95], heightWorld: 2.34 },
  { pos: [4.10, 0, 0.65], heightWorld: 2.30 },
  { pos: [4.90, 0, -1.35], heightWorld: 2.26 },
]);

const ENEMY_6_INNER_HUMANOID = Object.freeze([
  { pos: [1.85, 0, 0.95], heightWorld: 2.20 },
  { pos: [2.95, 0, -0.50], heightWorld: 2.20 },
  { pos: [4.05, 0, -1.95], heightWorld: 2.18 },
  { pos: [2.55, 0, 1.15], heightWorld: 2.16 },
  { pos: [3.60, 0, -0.25], heightWorld: 2.16 },
  { pos: [4.65, 0, -1.65], heightWorld: 2.14 },
]);

const ENEMY_6_OUTER_WIDE = Object.freeze([
  { pos: [5.15, 0, -2.25], heightWorld: 1.76 },
  { pos: [4.85, 0, -0.35], heightWorld: 1.64 },
  { pos: [4.10, 0, 1.15], heightWorld: 1.54 },
  { pos: [2.65, 0, -2.20], heightWorld: 1.58 },
  { pos: [2.30, 0, -0.35], heightWorld: 1.54 },
  { pos: [1.95, 0, 1.25], heightWorld: 1.52 },
]);

const CAMEO_SLOTS = Object.freeze([
  { pos: [-1.55, 0, 1.40], heightWorld: 2.40 },
  { pos: [-2.65, 0, -1.55], heightWorld: 2.34 },
  { pos: [-3.85, 0, 1.25], heightWorld: 2.32 },
  { pos: [-4.65, 0, -1.50], heightWorld: 2.28 },
]);

function computeAllyPositions(allyList) {
  const n = allyList.length;
  const out = new Map();
  if (n === 0) return out;

  if (n === 1) {
    out.set(allyList[0].key, { pos: [-3.10, 0, 0.25], heightWorld: 2.75 });
    return out;
  }

  if (n === 2) {
    // Player in back row, primary vanguard ally in front row (e.g. Sylvia back + Reno front)
    const pItem = allyList.find((a) => a.key === 'player') || allyList[0];
    const vItem = allyList.find((a) => a !== pItem) || allyList[1];
    out.set(pItem.key, { pos: [-4.30, 0, -0.75], heightWorld: 2.48 });
    out.set(vItem.key, { pos: [-2.95, 0, 1.15], heightWorld: 2.62 });
    return out;
  }

  // 3-6 allies: put player at slot 0 (front-lower C-spot), remaining in 6-col staggered diagonal
  const ordered = allyList.slice().sort((a, b) => {
    if (a.key === 'player') return -1;
    if (b.key === 'player') return 1;
    return a.order - b.order;
  });

  for (let i = 0; i < ordered.length; i++) {
    const slot = ALLY_SLOTS_6[i] || {
      pos: [clamp(-5.75 + (i % 3) * 0.45, -5.75, -1.95), 0, -1.8 + (i % 3) * 1.3],
      heightWorld: 2.18,
    };
    out.set(ordered[i].key, {
      pos: slot.pos.slice(),
      heightWorld: slot.heightWorld,
    });
  }
  return out;
}

function computeEnemyPositions(enemyList) {
  const n = enemyList.length;
  const out = new Map();
  if (n === 0) return out;

  if (n === 1) {
    const e = enemyList[0];
    let h = 2.85;
    if (e.isBoss || e.spriteId === 'wind_god_avatar') {
      if (e.spriteId === 'wind_god_avatar') h = 3.55;
      else if (e.isWideBeast) h = 2.95;
      else h = 3.40;
    } else if (e.isWideBeast) {
      h = 2.42;
    }
    out.set(e.key, { pos: [3.05, 0, 0.10], heightWorld: h });
    return out;
  }

  if (n === 2) {
    const anyWide = enemyList.some((e) => e.isWideBeast);
    if (anyWide) {
      const slots = [
        { pos: [2.00, 0, 1.05], baseH: 2.05 },
        { pos: [4.45, 0, -1.25], baseH: 2.00 },
      ];
      for (let i = 0; i < 2; i++) {
        const e = enemyList[i];
        let h = slots[i].baseH;
        if (e.isWideBeast) {
          h = e.isBoss ? 2.18 : 1.98;
        } else {
          h = e.isBoss ? 2.85 : 2.52;
        }
        out.set(e.key, { pos: slots[i].pos.slice(), heightWorld: h });
      }
    } else {
      out.set(enemyList[0].key, {
        pos: [2.15, 0, 0.85],
        heightWorld: enemyList[0].isBoss ? 2.85 : 2.58,
      });
      out.set(enemyList[1].key, {
        pos: [4.15, 0, -1.05],
        heightWorld: enemyList[1].isBoss ? 2.80 : 2.52,
      });
    }
    return out;
  }

  if (n === 3 || n === 4) {
    const anyWide = enemyList.some((e) => e.isWideBeast);
    const table = anyWide
      ? (n === 3 ? ENEMY_WIDE_SLOTS_3 : ENEMY_WIDE_SLOTS_4)
      : ENEMY_HUMANOID_SLOTS_4;
    for (let i = 0; i < n; i++) {
      const e = enemyList[i];
      const slot = table[i];
      let h = slot.heightWorld;
      if (anyWide && !e.isWideBeast) {
        h = e.isBoss ? 2.45 : 2.22;
      }
      out.set(e.key, { pos: slot.pos.slice(), heightWorld: h });
    }
    return out;
  }

  // 5-6 enemies: narrow humanoids in inner front/mid cols, wide beasts in outer large-Z tiers
  const humanoids = [];
  const wideBeasts = [];
  for (let i = 0; i < n; i++) {
    if (enemyList[i].isWideBeast) wideBeasts.push(enemyList[i]);
    else humanoids.push(enemyList[i]);
  }

  // Sort wide beasts so largest/boss takes the deep outer high tier (z = -2.25)
  wideBeasts.sort((a, b) => {
    const scoreA = (a.isBoss ? 10 : 0) + (a.spriteId === 'abyss_behemoth' ? 5 : 0);
    const scoreB = (b.isBoss ? 10 : 0) + (b.spriteId === 'abyss_behemoth' ? 5 : 0);
    return scoreB - scoreA;
  });

  for (let i = 0; i < humanoids.length; i++) {
    const e = humanoids[i];
    const slot = ENEMY_6_INNER_HUMANOID[i] || {
      pos: [clamp(1.85 + (i % 3) * 1.1, 1.85, 4.05), 0, -1.5 + (i % 3) * 1.2],
      heightWorld: 2.14,
    };
    out.set(e.key, { pos: slot.pos.slice(), heightWorld: slot.heightWorld });
  }

  for (let i = 0; i < wideBeasts.length; i++) {
    const e = wideBeasts[i];
    const slot = ENEMY_6_OUTER_WIDE[i] || {
      pos: [Math.min(5.30, 4.10 + (i % 2) * 0.95), 0, -2.1 + (i % 3) * 1.6],
      heightWorld: 1.54,
    };
    out.set(e.key, {
      pos: [Math.min(5.35, slot.pos[0]), 0, slot.pos[2]],
      heightWorld: clamp(slot.heightWorld, 1.50, 1.78),
    });
  }

  return out;
}

/* ============================================================================
 * 6. Production CombatStage3D Singleton Controller
 * ============================================================================ */

function createCombatStage3D() {
  // Core WebGL & Three.js state
  let active = false;
  let fieldEl = null;
  let battleScreenEl = null;
  let canvasEl = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let texLib = null;
  let postPipeline = null;

  // Stage scene groups & shared resources
  let stageGroup = null;
  let actorsGroup = null;
  let ghostsGroup = null;
  let moodAccentLight = null;
  let unitDiscGeo = null;
  let softGlowTex = null;
  let allyOuterRingTex = null;
  let allyInnerRingTex = null;
  let enemyOuterRingTex = null;
  let enemyInnerRingTex = null;
  let ownedTextures = [];
  let ownedGeometries = [];

  // Biome & mood state (pooled across stage switches for <1s remount)
  const biomePool = new Map(); // biomeId -> { biome, lightBaselines, skyUniforms }
  let currentBiome = null;
  let currentBiomeId = null;
  let currentMoodKey = null;
  let currentStageId = '';
  let currentWaveIdx = 0;
  let biomeLightBaselines = [];
  let biomeSkyUniforms = null;
  let moodAccentCfg = null;
  let rimTintColor = null;

  // Viewport & tier state
  let isSoftwareRenderer = false;
  let rendererInfo = 'unknown';
  let canvasHostEl = null;
  let viewportW = 1440;
  let viewportH = 900;
  let fieldW = 1440;
  let fieldH = 900;
  let fieldOffX = 0;
  let fieldOffY = 0;
  let lastStageRects = null;
  let currentDpr = 1;
  let resizeObserver = null;

  // Frame loop state
  let rafId = 0;
  let startTimeMs = 0;
  let lastFrameMs = 0;
  let lastRenderEndMs = 0;
  let simElapsedSec = 0;
  let timeScale = 1.0;
  let pendingImmediateRender = false;
  let fpsFrames = 0;
  let fpsLastSampleMs = 0;
  let currentFps = 60;

  // Sprite frame cache & actors
  const frameCache = new Map(); // `${spriteId}:${frameIdx}` -> { canvas, texture, rgba, width, height }
  let placeholderData = null;
  const actors = [];
  const actorMap = new Map(); // actorKey -> actor
  const dashGhosts = [];
  const cameoKeys = new Set();

  // Battle & selection state
  let lastBattleState = null;
  let activeActorKey = 'player';
  let selectedEnemyKey = 'enemy:0';
  let allyCount = 1;
  let enemyCount = 1;

  // Player aura canvases bridge
  let auraBackCanvas = null;
  let auraFrontCanvas = null;
  let auraBackTex = null;
  let auraFrontTex = null;
  let auraActive = false;

  // Projection cache & DOM sync caches
  const projCacheBase = new Map();
  const projCacheLive = new Map();
  const enemyCardCache = new Map(); // eidx -> { el, lastX, lastY }
  let cachedEnemyZoneEl = null;
  let enemyZoneOffX = 0;
  let enemyZoneOffY = 0;
  let lastPrismAnchorX = NaN;
  let lastPrismAnchorY = NaN;
  let lastPrismActorKey = '';

  // Camera Director State (Scheme C)
  let camState = null;

  // Reusable scratch math objects (allocated lazily on mount to keep Node/jsdom clean)
  let _v0 = null;
  let _v1 = null;
  let _v2 = null;
  let _v3 = null;
  let _v4 = null;
  let _dir = null;
  let _camFwd = null;
  let _goalPos = null;
  let _goalLook = null;
  let _colA = null;
  let _colB = null;
  let _whiteCol = null;
  let _flashCol = null;
  let _raycaster = null;
  let _ndcVec = null;

  function ensureScratchMath() {
    if (_v0) return;
    _v0 = new THREE.Vector3();
    _v1 = new THREE.Vector3();
    _v2 = new THREE.Vector3();
    _v3 = new THREE.Vector3();
    _v4 = new THREE.Vector3();
    _dir = new THREE.Vector3();
    _camFwd = new THREE.Vector3();
    _goalPos = new THREE.Vector3();
    _goalLook = new THREE.Vector3();
    _colA = new THREE.Color();
    _colB = new THREE.Color();
    _whiteCol = new THREE.Color(1, 1, 1);
    _flashCol = new THREE.Color(0xeef9ff);
    rimTintColor = new THREE.Color(1, 1, 1);
    _raycaster = new THREE.Raycaster();
    _ndcVec = new THREE.Vector2();
  }

  function scheduleImmediateRedraw() {
    if (active) {
      pendingImmediateRender = true;
    }
  }

  /* ---------------- RLE Sprite Decoder & BBox Cache ---------------- */

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
      if (!placeholderData) {
        placeholderData = createPlaceholderSpriteData();
        ownedTextures.push(placeholderData.texture);
      }
      return placeholderData;
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

    const rec = { canvas, texture, rgba, width: w, height: h };
    frameCache.set(cacheKey, rec);
    return rec;
  }

  function ensureFrame0AndBBox(spriteId) {
    const entry = getBankEntry(spriteId);
    const frame0 = decodeBankFrameToCache(spriteId, 0);
    if (!entry) {
      const bb = frame0.visBBox;
      const aspect = bb.visW / Math.max(1, bb.visH);
      return {
        entry: null,
        frame0,
        visBBox: bb,
        aspect,
        isWideBeast: aspect > 1.15,
        anchors: frame0.anchors,
        facing: frame0.facing,
        w: frame0.width,
        h: frame0.height,
        frameCount: 1,
      };
    }

    if (!entry._visBBox) {
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

    const bb = entry._visBBox;
    const aspect = bb.visW / Math.max(1, bb.visH);
    return {
      entry,
      frame0,
      visBBox: bb,
      aspect,
      isWideBeast: aspect > 1.15,
      anchors: entry.anchors || {},
      facing: entry.facing || 'right',
      w: entry.w | 0,
      h: entry.h | 0,
      frameCount: entry.frames.length,
    };
  }

  /* ---------------- Biome & Mood Director ---------------- */

  function captureBiomeBaselines(biome) {
    biomeLightBaselines = [];
    biomeSkyUniforms = null;
    if (!biome || !biome.group) return;

    let dirIdx = 0;
    biome.group.traverse((obj) => {
      if (obj && obj.isLight) {
        if (isSoftwareRenderer && obj.castShadow) {
          obj.castShadow = false;
        }
        const role = obj.isDirectionalLight
          ? dirIdx++ === 0
            ? 'sun'
            : 'fill'
          : obj.isHemisphereLight
            ? 'hemi'
            : obj.isAmbientLight
              ? 'ambient'
              : 'other';
        biomeLightBaselines.push({
          light: obj,
          role,
          color: obj.color ? obj.color.clone() : null,
          groundColor: obj.groundColor ? obj.groundColor.clone() : null,
          intensity: obj.intensity,
        });
      }
      if (
        !biomeSkyUniforms &&
        obj &&
        obj.isMesh &&
        obj.material &&
        obj.material.isShaderMaterial &&
        obj.material.uniforms &&
        obj.material.uniforms.uZenithColor &&
        obj.material.uniforms.uHorizonColor
      ) {
        biomeSkyUniforms = obj.material.uniforms;
      }
    });
  }

  function applyMood(moodKey) {
    if (!active || !scene) return;
    const key = MOOD_PRESETS[moodKey] ? moodKey : 'sunny_snow';
    const preset = MOOD_PRESETS[key];
    currentMoodKey = key;

    // 1. Invoke native biome.applyMood first to unlock all 12 calibrated biome lighting/sky/VFX moods
    let res = null;
    if (currentBiome && typeof currentBiome.applyMood === 'function') {
      try {
        res = currentBiome.applyMood(moodKey || key, { immediate: true }) || null;
      } catch (_) {
        res = null;
      }
    }

    const bgColor =
      res && res.background != null
        ? res.background
        : preset.background != null
          ? preset.background
          : currentBiome && currentBiome.background != null
            ? currentBiome.background
            : null;
    if (bgColor != null) {
      scene.background = new THREE.Color(bgColor);
    }

    const fogSpec =
      (res && res.fog && typeof res.fog === 'object' ? res.fog : null) ||
      preset.fog ||
      (currentBiome && currentBiome.fog);
    if (fogSpec && typeof fogSpec === 'object') {
      scene.fog = new THREE.Fog(
        fogSpec.color,
        Number.isFinite(fogSpec.near) ? fogSpec.near : 18,
        Number.isFinite(fogSpec.far) ? fogSpec.far : 54
      );
    } else {
      scene.fog = null;
    }

    const exposure =
      res && Number.isFinite(res.exposure)
        ? res.exposure
        : Number.isFinite(preset.exposure)
          ? preset.exposure
          : null;
    if (renderer && exposure != null) {
      renderer.toneMappingExposure = exposure;
    }

    // Only modulate captured biome lights / sky shader from MOOD_PRESETS when the
    // biome did not natively apply its own calibrated mood lighting & sky uniforms
    if (!res) {
      if (preset.light) {
        for (let i = 0; i < biomeLightBaselines.length; i++) {
          const rec = biomeLightBaselines[i];
          const l = rec.light;
          if (rec.role === 'sun') {
            if (preset.light.sunTint != null) l.color.setHex(preset.light.sunTint);
            else if (rec.color) l.color.copy(rec.color);
            l.intensity = rec.intensity * (preset.light.sunMult ?? 1.0);
          } else if (rec.role === 'fill') {
            if (rec.color) l.color.copy(rec.color);
            l.intensity = rec.intensity * (preset.light.hemiMult ?? 1.0);
          } else if (rec.role === 'hemi') {
            if (preset.light.hemiSky != null) l.color.setHex(preset.light.hemiSky);
            else if (rec.color) l.color.copy(rec.color);
            if (l.groundColor) {
              if (preset.light.hemiGnd != null) l.groundColor.setHex(preset.light.hemiGnd);
              else if (rec.groundColor) l.groundColor.copy(rec.groundColor);
            }
            l.intensity = rec.intensity * (preset.light.hemiMult ?? 1.0);
          } else if (rec.role === 'ambient') {
            if (rec.color) l.color.copy(rec.color);
            l.intensity = rec.intensity * (preset.light.ambMult ?? 1.0);
          }
        }
      }

      // Update sky shader colors (fallback when biome has no native applyMood)
      if (biomeSkyUniforms && preset.sky) {
        if (biomeSkyUniforms.uZenithColor && preset.sky.zenith != null) {
          biomeSkyUniforms.uZenithColor.value.setHex(preset.sky.zenith);
        }
        if (biomeSkyUniforms.uMidSkyColor && preset.sky.mid != null) {
          biomeSkyUniforms.uMidSkyColor.value.setHex(preset.sky.mid);
        }
        if (biomeSkyUniforms.uHorizonColor && preset.sky.horizon != null) {
          biomeSkyUniforms.uHorizonColor.value.setHex(preset.sky.horizon);
        }
        if (biomeSkyUniforms.uSunWarmColor && preset.sky.sunWarm != null) {
          biomeSkyUniforms.uSunWarmColor.value.setHex(preset.sky.sunWarm);
        }
      }
    }

    // Mood accent light: biome manages its own braziers/crystals/sanctum lights natively
    moodAccentCfg = res ? (res.accent || null) : (preset.accent || null);
    if (moodAccentLight) {
      if (moodAccentCfg) {
        moodAccentLight.color.setHex(moodAccentCfg.color);
        moodAccentLight.intensity = moodAccentCfg.intensity;
        moodAccentLight.distance = moodAccentCfg.distance || 20;
        moodAccentLight.position.set(
          moodAccentCfg.pos[0],
          moodAccentCfg.pos[1],
          moodAccentCfg.pos[2]
        );
      } else {
        moodAccentLight.intensity = 0;
      }
    }

    // Post-processing atmosphere preset: prioritize biome's res.atmospherePreset,
    // falling back to MOOD_PRESETS.post only for fields not supplied by the biome
    const resAtmo =
      res && res.atmospherePreset && typeof res.atmospherePreset === 'object'
        ? res.atmospherePreset
        : null;
    if (postPipeline) {
      const mergedPost = resAtmo
        ? Object.assign({}, preset.post || {}, resAtmo)
        : Object.assign({}, (currentBiome && currentBiome.atmospherePreset) || {}, preset.post || {});
      postPipeline.applyPreset(mergedPost);
    }

    // Sprite rim tint: prefer res.atmospherePreset.spriteRimTint, fallback to MOOD_PRESETS.rimTint
    const effectiveRimTint =
      resAtmo && Array.isArray(resAtmo.spriteRimTint) && resAtmo.spriteRimTint.length >= 3
        ? resAtmo.spriteRimTint
        : Array.isArray(preset.rimTint) && preset.rimTint.length >= 3
          ? preset.rimTint
          : null;
    if (effectiveRimTint && rimTintColor) {
      rimTintColor.setRGB(effectiveRimTint[0], effectiveRimTint[1], effectiveRimTint[2]);
    } else if (rimTintColor) {
      rimTintColor.setRGB(1, 1, 1);
    }
    for (let i = 0; i < actors.length; i++) {
      updateActorMaterialTint(actors[i]);
    }

    scheduleImmediateRedraw();
  }

  function ensureBiomeAndMood(battleState) {
    if (!active || !scene) return;
    const resolved = resolveStageScene(battleState);
    currentStageId = resolved.stageId;
    currentWaveIdx = resolved.waveIdx;

    const wantBiome = BIOME_BUILDERS[resolved.biomeId] ? resolved.biomeId : 'academy';
    if (!currentBiome || currentBiomeId !== wantBiome || (currentBiome.group && currentBiome.group.parent !== scene)) {
      if (currentBiome && currentBiome.group && currentBiome.group.parent === scene) {
        scene.remove(currentBiome.group);
      }

      let pooled = biomePool.get(wantBiome);
      if (!pooled) {
        const built = BIOME_BUILDERS[wantBiome](THREE, texLib);
        captureBiomeBaselines(built);
        pooled = {
          biome: built,
          lightBaselines: biomeLightBaselines.slice(),
          skyUniforms: biomeSkyUniforms,
        };
        biomePool.set(wantBiome, pooled);
      } else {
        biomeLightBaselines = pooled.lightBaselines;
        biomeSkyUniforms = pooled.skyUniforms;
      }

      currentBiome = pooled.biome;
      currentBiomeId = wantBiome;
      if (currentBiome && currentBiome.group && currentBiome.group.parent !== scene) {
        scene.add(currentBiome.group);
      }
      currentMoodKey = null; // Force mood re-application on biome switch/re-attach
    }

    if (currentMoodKey !== resolved.moodKey) {
      applyMood(resolved.moodKey);
    }
  }

  /* ---------------- Actor Creation, Visual Sync & Aura Planes ---------------- */

  function disposeActor(actor) {
    if (!actor) return;
    if (actorsGroup && actor.root && actor.root.parent === actorsGroup) {
      actorsGroup.remove(actor.root);
    }
    if (actor.spriteGeo) actor.spriteGeo.dispose();
    if (actor.spriteMat) actor.spriteMat.dispose();
    if (actor.depthMat) actor.depthMat.dispose();
    if (actor.shadowMat) actor.shadowMat.dispose();
    if (actor.outerRingMat) actor.outerRingMat.dispose();
    if (actor.innerRingMat) actor.innerRingMat.dispose();
    if (actor.ringAuraMat) actor.ringAuraMat.dispose();
    if (actor.auraBackGeo) actor.auraBackGeo.dispose();
    if (actor.auraBackMat) actor.auraBackMat.dispose();
    if (actor.auraFrontGeo) actor.auraFrontGeo.dispose();
    if (actor.auraFrontMat) actor.auraFrontMat.dispose();
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
    if (!actor || !actor.spriteMat) return;
    const deadMult = actor.dead ? 0.42 : 1.0;
    const flash = actor.hitFlash ? 1.0 : 0.0;

    _colA.copy(_whiteCol).lerp(rimTintColor, 0.36);
    actor.spriteMat.color.copy(_colA).multiplyScalar(deadMult);

    _colB.copy(_whiteCol).lerp(rimTintColor, 0.18);
    if (flash > 0.001) {
      _colB.lerp(_flashCol, 0.88);
    }
    actor.spriteMat.emissive.copy(_colB);

    const activeBoost = actor.key === activeActorKey && !actor.dead ? 0.07 : 0;
    const flashBoost = flash * 0.92;
    actor.spriteMat.emissiveIntensity = 0.54 * deadMult + activeBoost + flashBoost;
  }

  function attachPlayerAuraPlanes(actor) {
    if (!actor || actor.key !== 'player' || actor.auraBackMesh) return;
    const auraW = Math.max(actor.planeW * 1.88, actor.heightWorld * 2.15);
    const auraH = Math.max(actor.planeH * 1.88, actor.heightWorld * 1.92);
    const auraCenterY = actor.heightWorld * 0.50;

    const backGeo = new THREE.PlaneGeometry(auraW, auraH);
    const backMat = new THREE.MeshBasicMaterial({
      map: auraBackTex || null,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.set(0, auraCenterY, -0.08);
    backMesh.renderOrder = 4;
    backMesh.visible = Boolean(auraActive && auraBackTex);

    const frontGeo = new THREE.PlaneGeometry(auraW, auraH);
    const frontMat = new THREE.MeshBasicMaterial({
      map: auraFrontTex || null,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const frontMesh = new THREE.Mesh(frontGeo, frontMat);
    frontMesh.position.set(0, auraCenterY, 0.08);
    frontMesh.renderOrder = 6;
    frontMesh.visible = Boolean(auraActive && auraFrontTex);

    actor.spritePivot.add(backMesh);
    actor.spritePivot.add(frontMesh);

    actor.auraBackGeo = backGeo;
    actor.auraBackMat = backMat;
    actor.auraBackMesh = backMesh;
    actor.auraFrontGeo = frontGeo;
    actor.auraFrontMat = frontMat;
    actor.auraFrontMesh = frontMesh;
  }

  function buildActorObject(spec) {
    const key = String(spec.key);
    const spriteId = String(spec.spriteId || 'sylvia_silver');
    const side = spec.side === 'enemy' ? 'enemy' : 'ally';
    const pos = spec.pos || [side === 'ally' ? -3.1 : 3.05, 0, 0];
    const heightWorld = Number(spec.heightWorld) > 0 ? Number(spec.heightWorld) : 2.5;

    const info = ensureFrame0AndBBox(spriteId);
    const { entry, frame0, visBBox, aspect, isWideBeast, anchors, facing, w, h, frameCount } =
      info;

    const pixelScale = heightWorld / Math.max(1, visBBox.visH);
    const planeW = w * pixelScale;
    const planeH = h * pixelScale;
    const visWorldW = visBBox.visW * pixelScale;

    const feetXpx =
      anchors.feet && Number.isFinite(anchors.feet[0])
        ? anchors.feet[0]
        : (visBBox.minX + visBBox.maxX + 1) * 0.5;
    const feetYpx =
      anchors.feet && Number.isFinite(anchors.feet[1]) ? anchors.feet[1] : visBBox.maxY;

    const desiredFacing = side === 'ally' ? 'right' : 'left';
    const baseFlipX = facing !== desiredFacing ? -1 : 1;

    // Exact feet grounding: meshY = groundY + ((feetY / h) - 0.5) * planeH
    const meshLocalY = (feetYpx / h - 0.5) * planeH;
    const meshLocalX = -((feetXpx / w - 0.5) * planeW) * baseFlipX;

    const root = new THREE.Group();
    root.name = `CombatActor_${key}`;
    root.position.set(pos[0], pos[1], pos[2]);

    // Ground Contact Shadow (y = 0.015)
    const shadowRx = Math.max(0.46, Math.min(visWorldW * 0.48, heightWorld * 0.85));
    const shadowRz = Math.max(0.22, Math.min(shadowRx * 0.42, 0.72));
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

    // 3D Ground Magic Selection Ring
    const ringRadius = Math.max(0.72, Math.min(visWorldW * 0.50, heightWorld * 0.62));
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

    const ringAuraMat = new THREE.MeshBasicMaterial({
      map: softGlowTex,
      color: new THREE.Color(isEnemy ? 0xff4d6d : 0x2574ff),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringAuraMesh = new THREE.Mesh(unitDiscGeo, ringAuraMat);
    ringAuraMesh.position.y = -0.004;
    ringAuraMesh.scale.set(ringRadius * 2.6, 1, ringRadius * 2.6);
    ringAuraMesh.renderOrder = 1;

    ringGroup.add(ringAuraMesh, outerRingMesh, innerRingMesh);
    root.add(ringGroup);

    // Sprite Pivot anchored at feet (0, 0, 0)
    const spritePivot = new THREE.Group();
    root.add(spritePivot);

    const spriteGeo = new THREE.PlaneGeometry(planeW, planeH);
    const spriteMat = new THREE.MeshStandardMaterial({
      map: frame0.texture,
      emissiveMap: frame0.texture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.54,
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
    spriteMesh.castShadow = !isSoftwareRenderer;
    spriteMesh.receiveShadow = false;
    spriteMesh.customDepthMaterial = depthMat;
    spriteMesh.userData.actorKey = key;
    spriteMesh.renderOrder = 5;
    spritePivot.add(spriteMesh);

    actorsGroup.add(root);

    const actor = {
      key,
      spriteId,
      side,
      enemyIdx: spec.enemyIdx != null ? spec.enemyIdx : -1,
      isBoss: Boolean(spec.isBoss),
      isCameo: Boolean(spec.isCameo),
      cameoBornMs: spec.isCameo ? nowMs() : 0,
      basePos: new THREE.Vector3(pos[0], pos[1], pos[2]),
      heightWorld,
      pixelScale,
      planeW,
      planeH,
      visWorldW,
      w,
      h,
      visBBox,
      aspect,
      isWideBeast,
      anchors,
      facing,
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
      ringAuraMesh,
      ringAuraMat,
      spritePivot,
      spriteGeo,
      spriteMat,
      depthMat,
      spriteMesh,
      auraBackGeo: null,
      auraBackMat: null,
      auraBackMesh: null,
      auraFrontGeo: null,
      auraFrontMat: null,
      auraFrontMesh: null,
      currentFrame: 0,
      currentFrameData: frame0,
      phase: hashString(key) * 5.2,
      blinkInterval: 3.1 + hashString(`${key}_b`) * 2.1,
      ringOpacity: 0,
      pxPerUnit: 112,
      // Live synced state driven by CombatPixelVFX.updateActorVisual
      hasExternalVisual: false,
      pose: 'idle',
      dxPx: 0,
      dyPx: 0,
      totalYPx: 0,
      sx: 1,
      sy: 1,
      tiltDeg: 0,
      hitFlash: false,
      dead: Boolean(spec.dead),
      flipped: false,
    };

    if (key === 'player') {
      attachPlayerAuraPlanes(actor);
    }
    updateActorMaterialTint(actor);
    return actor;
  }

  function updateActorLayoutPosition(actor, pos, heightWorld) {
    const samePos =
      Math.abs(actor.basePos.x - pos[0]) < 1e-3 &&
      Math.abs(actor.basePos.y - pos[1]) < 1e-3 &&
      Math.abs(actor.basePos.z - pos[2]) < 1e-3;
    const sameH = Math.abs(actor.heightWorld - heightWorld) < 1e-3;
    if (samePos && sameH) return false;

    actor.basePos.set(pos[0], pos[1], pos[2]);
    actor.root.position.set(pos[0], pos[1], pos[2]);

    if (!sameH) {
      const ratio = heightWorld / Math.max(0.01, actor.heightWorld);
      actor.heightWorld = heightWorld;
      actor.pixelScale *= ratio;
      actor.planeW *= ratio;
      actor.planeH *= ratio;
      actor.visWorldW *= ratio;
      actor.meshLocalY = (actor.feetYpx / actor.h - 0.5) * actor.planeH;
      actor.meshLocalX = -((actor.feetXpx / actor.w - 0.5) * actor.planeW) * actor.baseFlipX;

      actor.spriteGeo.dispose();
      actor.spriteGeo = new THREE.PlaneGeometry(actor.planeW, actor.planeH);
      actor.spriteMesh.geometry = actor.spriteGeo;
      actor.spriteMesh.position.set(actor.meshLocalX, actor.meshLocalY, 0);

      actor.shadowRx = Math.max(0.46, Math.min(actor.visWorldW * 0.48, heightWorld * 0.85));
      actor.shadowRz = Math.max(0.22, Math.min(actor.shadowRx * 0.42, 0.72));
      actor.shadowMesh.scale.set(actor.shadowRx * 2.05, 1, actor.shadowRz * 2.05);

      actor.ringRadius = Math.max(0.72, Math.min(actor.visWorldW * 0.50, heightWorld * 0.62));

      if (actor.auraBackMesh && actor.auraFrontMesh) {
        const auraW = Math.max(actor.planeW * 1.88, heightWorld * 2.15);
        const auraH = Math.max(actor.planeH * 1.88, heightWorld * 1.92);
        const auraCenterY = heightWorld * 0.50;
        actor.auraBackGeo.dispose();
        actor.auraBackGeo = new THREE.PlaneGeometry(auraW, auraH);
        actor.auraBackMesh.geometry = actor.auraBackGeo;
        actor.auraBackMesh.position.y = auraCenterY;
        actor.auraFrontGeo.dispose();
        actor.auraFrontGeo = new THREE.PlaneGeometry(auraW, auraH);
        actor.auraFrontMesh.geometry = actor.auraFrontGeo;
        actor.auraFrontMesh.position.y = auraCenterY;
      }
    }
    return true;
  }

  /* ---------------- Camera Director (Scheme C + Anti-Clip Clamp) ---------------- */

  function initCameraState() {
    camState = {
      basePos: new THREE.Vector3(...SCHEME_C_BASE_POS),
      baseLookAt: new THREE.Vector3(...SCHEME_C_BASE_LOOK),
      baseFov: SCHEME_C_BASE_FOV,
      curPos: new THREE.Vector3(...SCHEME_C_BASE_POS),
      curLookAt: new THREE.Vector3(...SCHEME_C_BASE_LOOK),
      curFov: SCHEME_C_BASE_FOV,
      damping: 5.4,
      parallaxX: 0.28,
      parallaxY: 0.12,
      breatheAmp: 0.045,
      pointerTargetX: 0,
      pointerTargetY: 0,
      pointerX: 0,
      pointerY: 0,
      focusMode: 'default',
      focusActorKey: null,
      shakeTrauma: 0,
    };
  }

  function getActorTorsoWorldPos(actor, outVec) {
    return outVec.set(
      actor.basePos.x,
      actor.basePos.y + actor.heightWorld * 0.52,
      actor.basePos.z
    );
  }

  function updateCameraDirector(elapsedSec, realDtSec) {
    if (!camera || !camState) return;

    const ptrAlpha = 1 - Math.exp(-6.5 * realDtSec);
    camState.pointerX = lerp(camState.pointerX, camState.pointerTargetX, ptrAlpha);
    camState.pointerY = lerp(camState.pointerY, camState.pointerTargetY, ptrAlpha);

    const isCrowded = enemyCount >= 4 || allyCount >= 4;
    const maxPanX = isCrowded ? 0.65 : 1.45;
    const maxZoom = isCrowded ? 1.05 : 1.08;

    _goalPos.copy(camState.basePos);
    _goalLook.copy(camState.baseLookAt);
    let goalFov = camState.baseFov;

    if (camState.focusMode === 'actor' || camState.focusMode === 'enemy') {
      const fallbackKey =
        camState.focusMode === 'actor' ? activeActorKey : selectedEnemyKey;
      const targetActor =
        actorMap.get(camState.focusActorKey || fallbackKey) ||
        actors.find((a) =>
          camState.focusMode === 'actor'
            ? a.side === 'ally' && !a.dead
            : a.side === 'enemy' && !a.dead
        );
      if (targetActor) {
        getActorTorsoWorldPos(targetActor, _v0);
        const lookPull = isCrowded ? 0.20 : 0.28;
        const posPull = isCrowded ? 0.055 : 0.078;
        _goalLook.lerp(_v0, lookPull);
        _v1.subVectors(_v0, camState.basePos).multiplyScalar(posPull);
        _goalPos.add(_v1);
        _goalPos.x = lerp(_goalPos.x, _v0.x, isCrowded ? 0.14 : 0.20);
        goalFov = camState.baseFov / Math.min(maxZoom, 1.06);
      }
    } else if (camState.focusMode === 'clash') {
      const a1 =
        actorMap.get(camState.focusActorKey || activeActorKey) ||
        actors.find((a) => a.side === 'ally' && !a.dead);
      const a2 =
        actorMap.get(selectedEnemyKey) ||
        actors.find((a) => a.side === 'enemy' && !a.dead);
      if (a1 && a2) {
        getActorTorsoWorldPos(a1, _v0);
        getActorTorsoWorldPos(a2, _v1);
        _v0.add(_v1).multiplyScalar(0.5);
        _goalLook.lerp(_v0, isCrowded ? 0.26 : 0.34);
        _v2.subVectors(_v0, camState.basePos).multiplyScalar(isCrowded ? 0.065 : 0.095);
        _goalPos.add(_v2);
        _goalPos.y -= isCrowded ? 0.08 : 0.15;
        goalFov = camState.baseFov / Math.min(maxZoom, 1.08);
      } else if (a1 || a2) {
        getActorTorsoWorldPos(a1 || a2, _v0);
        _goalLook.lerp(_v0, 0.24);
        goalFov = camState.baseFov / Math.min(maxZoom, 1.06);
      }
    }

    // Subtle organic breathing + gentle diorama mouse parallax
    const parScale = isCrowded ? 0.55 : 1.0;
    const breatheX = Math.sin(elapsedSec * 0.55) * camState.breatheAmp;
    const breatheY = Math.cos(elapsedSec * 0.80) * (camState.breatheAmp * 0.62);
    _goalPos.x += breatheX + camState.pointerX * camState.parallaxX * parScale;
    _goalPos.y += breatheY + camState.pointerY * camState.parallaxY * parScale;
    _goalLook.x += camState.pointerX * (camState.parallaxX * 0.26) * parScale;
    _goalLook.y += camState.pointerY * (camState.parallaxY * 0.20) * parScale;

    // Anti-clip safety clamp (strictly prevents rightmost wide beast or leftmost ally from clipping)
    _goalPos.x = camState.basePos.x + clamp(_goalPos.x - camState.basePos.x, -maxPanX, maxPanX);
    _goalLook.x =
      camState.baseLookAt.x + clamp(_goalLook.x - camState.baseLookAt.x, -maxPanX, maxPanX);
    const minSafeFov = camState.baseFov / maxZoom;
    if (goalFov < minSafeFov) goalFov = minSafeFov;

    const alpha = 1 - Math.exp(-camState.damping * realDtSec);
    camState.curPos.lerp(_goalPos, alpha);
    camState.curLookAt.lerp(_goalLook, alpha);
    camState.curFov = lerp(camState.curFov, goalFov, alpha);

    // Trauma-based damped 3D micro-shake
    let shakeX = 0;
    let shakeY = 0;
    if (camState.shakeTrauma > 0.001) {
      const s = camState.shakeTrauma * camState.shakeTrauma;
      shakeX = Math.sin(elapsedSec * 57.3) * s * 0.20;
      shakeY = Math.cos(elapsedSec * 63.7) * s * 0.14;
      camState.shakeTrauma = Math.max(0, camState.shakeTrauma - realDtSec * 2.6);
    }

    camera.position.set(
      camState.curPos.x + shakeX,
      camState.curPos.y + shakeY,
      camState.curPos.z
    );
    _v3.set(
      camState.curLookAt.x + shakeX * 0.45,
      camState.curLookAt.y + shakeY * 0.45,
      camState.curLookAt.z
    );
    camera.lookAt(_v3);

    if (Math.abs(camera.fov - camState.curFov) > 1e-4) {
      camera.fov = camState.curFov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  }

  /* ---------------- 3D -> 2D Projection Cache & DOM Sync ---------------- */

  function getLiveStageRects() {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 900;
    const canvasRef =
      canvasEl && canvasEl.isConnected
        ? canvasEl
        : canvasHostEl || battleScreenEl || fieldEl;

    let rawC = null;
    let rawF = null;
    try {
      if (canvasRef && typeof canvasRef.getBoundingClientRect === 'function') {
        const r = canvasRef.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) rawC = r;
      }
      if (fieldEl && typeof fieldEl.getBoundingClientRect === 'function') {
        const r = fieldEl.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) rawF = r;
      }
    } catch (_) {
      rawC = null;
      rawF = null;
    }

    const cWidth = rawC
      ? rawC.width
      : Math.max(64, (canvasRef && canvasRef.clientWidth) || viewportW || winW);
    const cHeight = rawC
      ? rawC.height
      : Math.max(64, (canvasRef && canvasRef.clientHeight) || viewportH || winH);
    const cLeft = rawC ? rawC.left : 0;
    const cTop = rawC ? rawC.top : 0;

    const fWidth = rawF
      ? rawF.width
      : Math.max(64, (fieldEl && fieldEl.clientWidth) || fieldW || cWidth);
    const fHeight = rawF
      ? rawF.height
      : Math.max(64, (fieldEl && fieldEl.clientHeight) || fieldH || cHeight);
    const fLeft = rawF ? rawF.left : cLeft;
    const fTop = rawF ? rawF.top : cTop;

    return {
      cRect: { left: cLeft, top: cTop, width: cWidth, height: cHeight },
      fRect: { left: fLeft, top: fTop, width: fWidth, height: fHeight },
      width: Math.max(64, Math.round(cWidth)),
      height: Math.max(64, Math.round(cHeight)),
      fieldW: Math.max(64, Math.round(fWidth)),
      fieldH: Math.max(64, Math.round(fHeight)),
      fieldOffX: fLeft - cLeft,
      fieldOffY: fTop - cTop,
    };
  }

  function getActorPixelWorldPos(actor, px, py, useBasePos, outVec) {
    const effFlip = actor.baseFlipX * (actor.flipped ? -1 : 1);
    const effMeshLocalX = -((actor.feetXpx / actor.w - 0.5) * actor.planeW) * effFlip;

    if (useBasePos) {
      // Base standing world position (strictly excludes transient dash/bounce dx/dy)
      const lx = ((px / actor.w - 0.5) * actor.planeW) * effFlip + effMeshLocalX;
      const ly = (0.5 - py / actor.h) * actor.planeH + actor.meshLocalY;
      const yaw = actor.spritePivot.rotation.y;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      outVec.set(
        actor.basePos.x + lx * cosY,
        actor.basePos.y + ly,
        actor.basePos.z - lx * sinY
      );
      return outVec;
    }

    // Live world position directly from spriteMesh.matrixWorld (already includes world dash/bob/squash/tilt; never double-adds dx/dy)
    if (actor.spriteMesh.scale.x !== effFlip) {
      actor.spriteMesh.scale.x = effFlip;
      actor.spriteMesh.position.x = effMeshLocalX;
    }
    const rawLx = (px / actor.w - 0.5) * actor.planeW;
    const rawLy = (0.5 - py / actor.h) * actor.planeH;
    outVec.set(rawLx, rawLy, 0);
    actor.spriteMesh.updateWorldMatrix(true, false);
    outVec.applyMatrix4(actor.spriteMesh.matrixWorld);
    return outVec;
  }

  function projectWorldToField(worldVec, rects) {
    const r = rects || lastStageRects;
    const cRect = r
      ? r.cRect
      : { left: 0, top: 0, width: viewportW, height: viewportH };
    const fRect = r
      ? r.fRect
      : { left: fieldOffX, top: fieldOffY, width: fieldW, height: fieldH };

    _v4.copy(worldVec).project(camera);
    // Exact conversion: 3D canvas viewport CSS coords -> .cb-arena-field local CSS coords
    const vx = cRect.left + (_v4.x * 0.5 + 0.5) * cRect.width;
    const vy = cRect.top + (-_v4.y * 0.5 + 0.5) * cRect.height;
    return {
      x: vx - fRect.left,
      y: vy - fRect.top,
      ndcZ: _v4.z,
    };
  }

  function buildProjectionRecord(actor, useBasePos, rects) {
    const r = rects || lastStageRects || getLiveStageRects();
    const bb = actor.visBBox;
    const midXpx = (bb.minX + bb.maxX + 1) * 0.5;
    const midYpx = (bb.minY + actor.feetYpx) * 0.5;

    const defaultCastX = actor.facing === 'left' ? actor.w * 0.15 : actor.w * 0.85;
    const castPx =
      actor.anchors.cast && actor.anchors.cast.length >= 2
        ? actor.anchors.cast
        : [defaultCastX, actor.h * 0.50];
    const hitPx =
      actor.anchors.hit && actor.anchors.hit.length >= 2
        ? actor.anchors.hit
        : [midXpx, midYpx];
    const headPx =
      actor.anchors.head && actor.anchors.head.length >= 2
        ? actor.anchors.head
        : [midXpx, bb.minY];

    getActorPixelWorldPos(actor, actor.feetXpx, actor.feetYpx, useBasePos, _v0);
    const pFeet = projectWorldToField(_v0, r);

    getActorPixelWorldPos(actor, castPx[0], castPx[1], useBasePos, _v0);
    const pCast = projectWorldToField(_v0, r);

    getActorPixelWorldPos(actor, hitPx[0], hitPx[1], useBasePos, _v0);
    const pHit = projectWorldToField(_v0, r);
    const depthZ = _v3.subVectors(_v0, camera.position).dot(_camFwd);

    getActorPixelWorldPos(actor, headPx[0], Math.min(headPx[1], bb.minY), useBasePos, _v0);
    const pHead = projectWorldToField(_v0, r);

    getActorPixelWorldPos(actor, bb.minX, midYpx, useBasePos, _v0);
    const pLeft = projectWorldToField(_v0, r);

    getActorPixelWorldPos(actor, bb.maxX + 1, midYpx, useBasePos, _v0);
    const pRight = projectWorldToField(_v0, r);

    const left = Math.min(pLeft.x, pRight.x);
    const right = Math.max(pLeft.x, pRight.x);
    const top = Math.min(pHead.y, pFeet.y);
    const bottom = Math.max(pHead.y, pFeet.y);
    const screenW = Math.max(12, right - left);
    const screenH = Math.max(16, bottom - top);
    const pxPerUnit = screenH / Math.max(0.2, actor.heightWorld);

    const curFieldW = r.fRect.width;
    const curFieldH = r.fRect.height;
    const curOffX = Math.max(0, r.fieldOffX);
    const curOffY = Math.max(0, r.fieldOffY);

    const onScreen =
      pHit.ndcZ >= -1 &&
      pHit.ndcZ <= 1 &&
      depthZ > 0 &&
      right >= -curOffX &&
      left <= curFieldW + curOffX &&
      bottom >= -curOffY &&
      top <= curFieldH + curOffY;

    return {
      actorKey: actor.key,
      side: actor.side,
      coordSpace: 'field',
      anchor: { x: pFeet.x, y: pFeet.y },
      feet: { x: pFeet.x, y: pFeet.y },
      cast: { x: pCast.x, y: pCast.y },
      hit: { x: pHit.x, y: pHit.y },
      head: { x: pHead.x, y: pHead.y },
      screenX: pFeet.x,
      screenY: pFeet.y,
      screenW,
      screenH,
      left,
      top,
      right,
      bottom,
      width: screenW,
      height: screenH,
      feetX: pFeet.x,
      feetY: pFeet.y,
      headX: pHead.x,
      headY: pHead.y,
      centerX: pHit.x,
      centerY: pHit.y,
      fieldW: curFieldW,
      fieldH: curFieldH,
      depthZ,
      pxPerUnit,
      onScreen,
    };
  }

  function updateProjectionCache(rectsOverride) {
    if (!camera || !active) return;
    const rects = rectsOverride || getLiveStageRects();
    lastStageRects = rects;
    fieldW = rects.fieldW;
    fieldH = rects.fieldH;
    fieldOffX = rects.fieldOffX;
    fieldOffY = rects.fieldOffY;

    camera.updateMatrixWorld(true);
    camera.getWorldDirection(_camFwd);

    projCacheBase.clear();
    projCacheLive.clear();

    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      const baseRec = buildProjectionRecord(a, true, rects);
      const liveRec = buildProjectionRecord(a, false, rects);

      a.pxPerUnit = clamp(baseRec.pxPerUnit || 112, 36, 360);
      projCacheBase.set(a.key, baseRec);
      projCacheLive.set(a.key, liveRec);
    }
  }

  function refreshEnemyCardElements() {
    enemyCardCache.clear();
    cachedEnemyZoneEl = null;
    enemyZoneOffX = 0;
    enemyZoneOffY = 0;
    if (!fieldEl) return;

    const eZone = fieldEl.querySelector('#cb-enemy-zone');
    if (eZone) {
      cachedEnemyZoneEl = eZone;
      try {
        const fRect = fieldEl.getBoundingClientRect();
        const zRect = eZone.getBoundingClientRect();
        if (fRect.width > 0 && zRect.width > 0) {
          enemyZoneOffX = zRect.left - fRect.left;
          enemyZoneOffY = zRect.top - fRect.top;
        }
      } catch (_) {
        enemyZoneOffX = 0;
        enemyZoneOffY = 0;
      }
    }

    const cards = fieldEl.querySelectorAll('.cb-enemy-card[data-eidx]');
    for (let i = 0; i < cards.length; i++) {
      const el = cards[i];
      const eidx = Number(el.getAttribute('data-eidx'));
      if (!Number.isFinite(eidx)) continue;
      enemyCardCache.set(eidx, { el, lastX: NaN, lastY: NaN });
    }
  }

  function syncEnemyCardsGPU() {
    if (!fieldEl || !active) return;

    // Re-scan only if any cached card was disconnected by a re-render
    let needRescan = enemyCardCache.size === 0;
    if (!needRescan) {
      for (const rec of enemyCardCache.values()) {
        if (!rec.el || !rec.el.isConnected) {
          needRescan = true;
          break;
        }
      }
    }
    if (needRescan) {
      refreshEnemyCardElements();
    }

    const padX = enemyCount >= 4 ? 72 : 84;
    const maxCardX = Math.max(padX + 4, fieldW - padX);
    const minCardY = 46;
    const maxCardY = Math.max(60, fieldH - 54);
    const items = [];

    for (const [eidx, rec] of enemyCardCache.entries()) {
      const card = rec.el;
      if (!card || !card.isConnected) continue;
      const eKey = `enemy:${eidx}`;
      const proj = projCacheBase.get(eKey);
      if (!proj || !proj.onScreen) {
        if (rec.lastX !== -9999) {
          rec.lastX = -9999;
          rec.lastY = -9999;
          card.style.transform = 'translate3d(-9999px, -9999px, 0)';
        }
        continue;
      }

      const actor = actorMap.get(eKey);
      const isTargeted = card.classList && card.classList.contains('targeted');
      const cardW = isTargeted ? 156 : enemyCount >= 4 ? 132 : 156;
      const cardH = 48;
      const cx = clamp(proj.feetX, padX, maxCardX);
      const cy = clamp(proj.feetY + 14, minCardY, maxCardY);

      items.push({
        eidx,
        rec,
        card,
        proj,
        z: actor ? actor.basePos.z : 0,
        dead: actor ? actor.dead : false,
        cardW,
        cardH,
        cx,
        cy,
      });
    }

    // Place front-most alive enemies first so back-row cards yield cleanly (18px nudge)
    items.sort((a, b) => {
      if (a.dead !== b.dead) return a.dead ? 1 : -1;
      return b.z - a.z;
    });

    const placedAlive = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let cx = it.cx;
      let cy = it.cy;

      for (let j = 0; j < placedAlive.length; j++) {
        const front = placedAlive[j];
        const minSepX = (it.cardW + front.cardW) * 0.5 + 4;
        const minSepY = Math.max(it.cardH, front.cardH) - 2;
        const overlapsCard =
          Math.abs(cx - front.cx) < minSepX && Math.abs(cy - front.cy) < minSepY;

        // Also prevent a back-row enemy's card from cutting horizontally across a front-row beast's torso
        const isBehindFront = it.z < front.z - 0.5;
        const cardTop = cy - 12;
        const cardBot = cy + it.cardH - 12;
        const cardLeft = cx - it.cardW * 0.46;
        const cardRight = cx + it.cardW * 0.46;
        const overlapsFrontTorso =
          isBehindFront &&
          cardRight > front.proj.left + 8 &&
          cardLeft < front.proj.right - 8 &&
          cardBot > front.proj.top + 10 &&
          cardTop < front.proj.bottom - 12;

        if (overlapsCard || overlapsFrontTorso) {
          cy = clamp(cy - 18, minCardY, maxCardY);
          const stillOverlapsCard =
            Math.abs(cx - front.cx) < minSepX && Math.abs(cy - front.cy) < minSepY;
          if (stillOverlapsCard) {
            const outwardDir = cx >= front.cx ? 1 : -1;
            cx = clamp(cx + outwardDir * 18, padX, maxCardX);
          }
        }
      }

      it.cx = cx;
      it.cy = cy;
      if (!it.dead) {
        placedAlive.push(it);
      }

      const rawX = cx - enemyZoneOffX;
      const rawY = cy - enemyZoneOffY;
      if (
        !Number.isFinite(it.rec.lastX) ||
        Math.abs(rawX - it.rec.lastX) > 0.4 ||
        Math.abs(rawY - it.rec.lastY) > 0.4
      ) {
        it.rec.lastX = rawX;
        it.rec.lastY = rawY;
        it.card.style.transform = `translate3d(${rawX.toFixed(1)}px, ${rawY.toFixed(1)}px, 0)`;
      }
    }
  }

  function syncPrismMenuFollow() {
    const key = activeActorKey || 'player';
    const proj = projCacheBase.get(key) || projCacheBase.get('player');
    if (!proj || !proj.onScreen) return;

    const ax = proj.right;
    const ay = proj.top + proj.height * 0.42;
    if (
      key !== lastPrismActorKey ||
      !Number.isFinite(lastPrismAnchorX) ||
      Math.abs(ax - lastPrismAnchorX) > 3.0 ||
      Math.abs(ay - lastPrismAnchorY) > 3.0
    ) {
      lastPrismActorKey = key;
      lastPrismAnchorX = ax;
      lastPrismAnchorY = ay;
      if (
        typeof window !== 'undefined' &&
        window.CombatPrismUI &&
        typeof window.CombatPrismUI.syncRigAnchorFast === 'function'
      ) {
        try {
          window.CombatPrismUI.syncRigAnchorFast();
        } catch (_) {
          // Keep render loop resilient
        }
      }
    }
  }

  /* ---------------- Alpha- & Opaque-BBox-Aware 3D Raycast Picking ---------------- */

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
      const a = actors[i];
      if (a.dead || !a.root.visible) continue;
      a.spriteMesh.updateWorldMatrix(true, false);
      meshes.push(a.spriteMesh);
    }
    if (!meshes.length) return null;

    const hits = _raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;

    let bboxFallbackKey = null;
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const actorKey = hit.object && hit.object.userData.actorKey;
      const actor = actorMap.get(actorKey);
      if (!actor) continue;

      if (!hit.uv) return actor.key;
      const px = Math.floor(hit.uv.x * actor.w);
      const py = Math.floor((1 - hit.uv.y) * actor.h);

      if (hasOpaquePixelNear(actor.currentFrameData, px, py, 5)) {
        return actor.key;
      }

      const bb = actor.visBBox;
      if (
        !bboxFallbackKey &&
        px >= bb.minX - 7 &&
        px <= bb.maxX + 7 &&
        py >= bb.minY - 7 &&
        py <= bb.maxY + 7
      ) {
        bboxFallbackKey = actor.key;
      }
    }

    return bboxFallbackKey;
  }

  /* ---------------- Pointer Parallax & Arena Click Handling ---------------- */

  function clientToNDC(ev) {
    const refEl = canvasEl || canvasHostEl || fieldEl;
    if (!refEl) return { ndcX: 0, ndcY: 0 };
    const rect = refEl.getBoundingClientRect();
    const rw = rect.width || 1;
    const rh = rect.height || 1;
    return {
      ndcX: ((ev.clientX - rect.left) / rw) * 2 - 1,
      ndcY: -(((ev.clientY - rect.top) / rh) * 2 - 1),
    };
  }

  function handleFieldPointerMove(ev) {
    if (!active || !camState) return;
    const { ndcX, ndcY } = clientToNDC(ev);
    camState.pointerTargetX = clamp(ndcX, -1, 1);
    camState.pointerTargetY = clamp(ndcY, -1, 1);
  }

  function handleFieldPointerLeave() {
    if (!active || !camState) return;
    camState.pointerTargetX = 0;
    camState.pointerTargetY = 0;
  }

  function handleFieldClick(ev) {
    if (!active || !ev || !fieldEl) return;
    const target = ev.target;
    if (
      target &&
      typeof target.closest === 'function' &&
      target.closest(
        'button, a, input, select, textarea, .cb-enemy-card, .cb-prism-rig, #cb-prism-rig, .cb-party-panes, #cb-party-panes, .cb-target-detail-pane, #cb-target-detail-pane, .cb-intent-banner, .cb-callout-layer button'
      )
    ) {
      return;
    }

    const { ndcX, ndcY } = clientToNDC(ev);
    const hitKey = raycastActor(ndcX, ndcY);
    if (!hitKey || !hitKey.startsWith('enemy:')) return;

    const eidx = Number(hitKey.slice(6));
    if (!Number.isFinite(eidx)) return;

    const eng =
      typeof window !== 'undefined' && window.CombatEngine
        ? window.CombatEngine
        : null;
    if (eng && typeof eng.selectTarget === 'function') {
      try {
        eng.selectTarget(eidx);
      } catch (_) {
        // ignore selection failure
      }
    }
  }

  /* ---------------- Resize Handling & Pooled WebGL Core ---------------- */

  function measureStageLayout() {
    return getLiveStageRects();
  }

  function syncRendererViewportIfNeeded() {
    const sz = getLiveStageRects();
    const dpr = isSoftwareRenderer
      ? SOFTWARE_PIXEL_RATIO
      : Math.min(
          typeof window !== 'undefined' && window.devicePixelRatio
            ? window.devicePixelRatio
            : 1,
          2
        );
    const canvasChanged =
      sz.width !== viewportW || sz.height !== viewportH || dpr !== currentDpr;
    const fieldChanged =
      sz.fieldW !== fieldW ||
      sz.fieldH !== fieldH ||
      Math.abs(sz.fieldOffX - fieldOffX) > 0.5 ||
      Math.abs(sz.fieldOffY - fieldOffY) > 0.5;

    lastStageRects = sz;
    if (!canvasChanged && !fieldChanged) {
      return sz;
    }

    viewportW = sz.width;
    viewportH = sz.height;
    fieldW = sz.fieldW;
    fieldH = sz.fieldH;
    fieldOffX = sz.fieldOffX;
    fieldOffY = sz.fieldOffY;
    currentDpr = dpr;

    if (camera && canvasChanged) {
      camera.aspect = viewportW / viewportH;
      camera.updateProjectionMatrix();
    }
    if (renderer && canvasChanged) {
      renderer.setPixelRatio(currentDpr);
      renderer.setSize(viewportW, viewportH, false);
    }
    if (postPipeline && canvasChanged) {
      postPipeline.resize(viewportW, viewportH, currentDpr);
    }
    refreshEnemyCardElements();
    lastPrismAnchorX = NaN;
    return sz;
  }

  function handleResize() {
    if (!active || !renderer || !camera) return;
    const prevW = viewportW;
    const prevH = viewportH;
    const prevFW = fieldW;
    const prevFH = fieldH;
    const prevOffX = fieldOffX;
    const prevOffY = fieldOffY;
    const prevDpr = currentDpr;
    const sz = syncRendererViewportIfNeeded();
    if (
      sz.width === prevW &&
      sz.height === prevH &&
      sz.fieldW === prevFW &&
      sz.fieldH === prevFH &&
      Math.abs(sz.fieldOffX - prevOffX) <= 0.5 &&
      Math.abs(sz.fieldOffY - prevOffY) <= 0.5 &&
      currentDpr === prevDpr
    ) {
      return;
    }
    scheduleImmediateRedraw();
  }

  function isPooledWebGLHealthy() {
    if (!renderer || !canvasEl || !scene || !camera || !texLib || !stageGroup || !actorsGroup || !ghostsGroup) {
      return false;
    }
    try {
      const gl = typeof renderer.getContext === 'function' ? renderer.getContext() : null;
      if (gl && typeof gl.isContextLost === 'function' && gl.isContextLost()) {
        return false;
      }
    } catch (_) {
      return false;
    }
    return true;
  }

  function destroyWebGLPool() {
    biomePool.forEach((entry) => {
      if (entry && entry.biome) {
        if (scene && entry.biome.group && entry.biome.group.parent === scene) {
          scene.remove(entry.biome.group);
        }
        try {
          if (typeof entry.biome.dispose === 'function') entry.biome.dispose();
        } catch (_) {
          // ignore
        }
      }
    });
    biomePool.clear();
    currentBiome = null;
    currentBiomeId = null;
    currentMoodKey = null;
    biomeLightBaselines = [];
    biomeSkyUniforms = null;

    frameCache.forEach((rec) => {
      if (rec && rec.texture) rec.texture.dispose();
    });
    frameCache.clear();
    placeholderData = null;

    for (let i = 0; i < ownedTextures.length; i++) {
      if (ownedTextures[i]) ownedTextures[i].dispose();
    }
    ownedTextures = [];
    for (let i = 0; i < ownedGeometries.length; i++) {
      if (ownedGeometries[i]) ownedGeometries[i].dispose();
    }
    ownedGeometries = [];

    if (postPipeline) {
      try {
        postPipeline.dispose();
      } catch (_) {
        // ignore
      }
      postPipeline = null;
    }
    if (texLib) {
      try {
        texLib.dispose();
      } catch (_) {
        // ignore
      }
      texLib = null;
    }
    if (renderer) {
      try {
        renderer.dispose();
      } catch (_) {
        // ignore
      }
      renderer = null;
    }

    stageGroup = null;
    actorsGroup = null;
    ghostsGroup = null;
    moodAccentLight = null;
    unitDiscGeo = null;
    softGlowTex = null;
    allyOuterRingTex = null;
    allyInnerRingTex = null;
    enemyOuterRingTex = null;
    enemyInnerRingTex = null;
    scene = null;
    camera = null;
    canvasEl = null;
  }

  /* ---------------- Per-Frame Simulation & Render ---------------- */

  function stepActors(elapsedSec, simDt, realDt) {
    let camYaw = 0;
    if (camera) {
      camera.getWorldDirection(_dir);
      camYaw = Math.atan2(-_dir.x, -_dir.z);
    }

    const ringAlpha = 1 - Math.exp(-10.0 * realDt);
    const now = nowMs();

    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      a.spritePivot.rotation.y = camYaw;

      // Fallback idle/blink animation if external visual driver hasn't sent frames yet
      if (!a.hasExternalVisual) {
        if (a.dead) {
          applyActorFrame(a, a.frameCount > 6 ? 6 : 0);
        } else {
          const cycle = (elapsedSec + a.phase) % a.blinkInterval;
          let targetFrame = 0;
          if (a.frameCount > 2 && cycle > a.blinkInterval - 0.13) {
            targetFrame = 2;
          } else if (a.frameCount > 1) {
            targetFrame = Math.floor((elapsedSec + a.phase) / 0.56) % 2;
          }
          applyActorFrame(a, targetFrame);
        }
      }

      // Convert pixel-space dash / bounce offsets into world coordinates using calibrated depth scale
      const ppu = Math.max(40, a.pxPerUnit || 112);
      const offX = clamp(a.dxPx / ppu, -8.5, 8.5);
      const verticalLift = -(a.totalYPx || 0) / ppu;
      const dashY = -(a.dyPx || 0) / ppu;
      const offY = Math.max(0, verticalLift + Math.max(0, dashY));
      const offZ = dashY < 0 ? clamp(-dashY * 0.65, 0, 2.2) : 0;

      // Subtle alive breathing when standing idle
      const idleBreathe =
        !a.dead && Math.abs(a.sx - 1) < 0.005 && Math.abs(a.sy - 1) < 0.005
          ? Math.sin(elapsedSec * 2.5 + a.phase)
          : 0;
      let sx = a.sx * (1 - idleBreathe * 0.004);
      let sy = a.sy * (1 + idleBreathe * 0.007);

      // Cameo smooth pop-in
      if (a.isCameo) {
        const ageSec = Math.max(0, (now - a.cameoBornMs) / 1000);
        const pop = clamp(ageSec / 0.18, 0.12, 1.0);
        sx *= pop;
        sy *= pop;
      }

      // Dead visual slump
      const deadOffsetY = a.dead ? -actorDeadDrop(a) : 0;
      a.spritePivot.position.set(offX, offY + deadOffsetY, offZ);
      a.spritePivot.scale.set(sx, sy, 1);
      a.spritePivot.rotation.z = -(a.tiltDeg || 0) * (Math.PI / 180);

      // Facing mirror update
      const desiredScaleX = a.baseFlipX * (a.flipped ? -1 : 1);
      if (a.spriteMesh.scale.x !== desiredScaleX) {
        a.spriteMesh.scale.x = desiredScaleX;
        a.spriteMesh.position.x = -((a.feetXpx / a.w - 0.5) * a.planeW) * desiredScaleX;
      }

      // Ground contact shadow follows horizontal dash & shrinks slightly on jump/float
      const shadowScale = clamp(1 - offY * 0.28, 0.68, 1.0);
      a.shadowMesh.position.set(offX * 0.88, 0.015, offZ * 0.88);
      a.shadowMesh.scale.set(
        a.shadowRx * 2.05 * shadowScale,
        1,
        a.shadowRz * 2.05 * shadowScale
      );
      a.shadowMat.opacity = a.dead ? 0.22 : 0.48;

      updateActorMaterialTint(a);

      // Ground magic selection rings (active ally + selected alive enemy)
      const isActive = a.key === activeActorKey && !a.dead;
      const isSelectedEnemy = a.key === selectedEnemyKey && a.side === 'enemy' && !a.dead;
      const targetRingOp = isActive || isSelectedEnemy ? 1.0 : 0.0;
      a.ringOpacity = lerp(a.ringOpacity, targetRingOp, ringAlpha);

      if (a.ringOpacity > 0.008) {
        a.ringGroup.visible = true;
        a.ringGroup.position.set(offX, 0.024, offZ);
        const pulse = 1 + Math.sin(elapsedSec * 3.4 + a.phase) * 0.036;
        a.outerRingMesh.rotation.y += simDt * (isSelectedEnemy ? -0.52 : 0.36);
        a.innerRingMesh.rotation.y += simDt * (isSelectedEnemy ? 0.82 : -0.58);
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
        a.ringAuraMat.opacity =
          a.ringOpacity *
          (isSelectedEnemy ? 0.24 : 0.28) *
          (0.9 + Math.sin(elapsedSec * 4) * 0.1);
      } else {
        a.ringOpacity = 0;
        a.ringGroup.visible = false;
      }
    }

    // Step 3D dash afterimage ghosts
    for (let i = dashGhosts.length - 1; i >= 0; i--) {
      const g = dashGhosts[i];
      g.age += simDt;
      const u = clamp(g.age / g.duration, 0, 1);
      g.pivot.rotation.y = camYaw;
      g.mat.opacity = (1 - u) * 0.62;
      if (u >= 1) {
        if (ghostsGroup && g.pivot.parent === ghostsGroup) {
          ghostsGroup.remove(g.pivot);
        }
        g.geo.dispose();
        g.mat.dispose();
        dashGhosts.splice(i, 1);
      }
    }

    // Subtle mood accent light pulse (fire flicker / storm surge / frost shimmer)
    if (moodAccentLight && moodAccentCfg) {
      const wave = Math.sin(elapsedSec * (moodAccentCfg.pulseSpeed || 3.0));
      moodAccentLight.intensity = Math.max(
        0,
        moodAccentCfg.intensity + wave * (moodAccentCfg.pulseAmp || 0)
      );
    }
  }

  function actorDeadDrop(actor) {
    return Math.min(0.18, actor.heightWorld * 0.06);
  }

  function renderFrame(tsMs, isInitial = false) {
    if (!active || !renderer || !scene || !camera) return;
    pendingImmediateRender = false;

    // Ensure camera.aspect & renderer buffer strictly match the live canvas rect BEFORE rendering
    const liveRects = syncRendererViewportIfNeeded();

    if (!startTimeMs) {
      startTimeMs = tsMs;
      lastFrameMs = tsMs;
      fpsLastSampleMs = tsMs;
    }

    const maxDtSec = isSoftwareRenderer ? SOFTWARE_MAX_DT_SEC : 0.08;
    const realDt = isInitial
      ? 1 / 60
      : clamp((tsMs - lastFrameMs) / 1000, 0.001, maxDtSec);
    const simDt = realDt * timeScale;
    lastFrameMs = tsMs;
    simElapsedSec += isInitial ? 0 : simDt;

    if (!isInitial) {
      fpsFrames += 1;
      const fpsDelta = tsMs - fpsLastSampleMs;
      if (fpsDelta >= 400) {
        currentFps = clamp(Math.round((fpsFrames * 1000) / fpsDelta), 1, 240);
        fpsFrames = 0;
        fpsLastSampleMs = tsMs;
      }
    }

    if (currentBiome && typeof currentBiome.update === 'function') {
      currentBiome.update(simElapsedSec, simDt);
    }
    updateCameraDirector(simElapsedSec, realDt);
    stepActors(simElapsedSec, simDt, realDt);
    if (postPipeline) {
      postPipeline.update(simElapsedSec, simDt);
      postPipeline.render();
    } else {
      renderer.render(scene, camera);
    }

    // Record render completion timestamp AFTER render() so SwiftShader never starves the event loop
    lastRenderEndMs = nowMs();

    // Immediately project with the EXACT camera matrices & cRect/fRect just rendered on screen
    camera.updateMatrixWorld(true);
    updateProjectionCache(liveRects);
    syncEnemyCardsGPU();
    syncPrismMenuFollow();
  }

  function tick(tsMs) {
    if (!active) return;
    rafId = requestAnimationFrame(tick);

    if (typeof document !== 'undefined' && document.hidden) {
      lastFrameMs = tsMs;
      return;
    }
    if (battleScreenEl && battleScreenEl.classList.contains('hidden')) {
      return;
    }

    if (
      isSoftwareRenderer &&
      !pendingImmediateRender &&
      lastRenderEndMs > 0 &&
      tsMs - lastRenderEndMs < SOFTWARE_IDLE_GAP_MS
    ) {
      return;
    }

    renderFrame(tsMs, false);
  }

  /* ============================================================================
   * 7. Public Frozen Contract API (window.CombatStage3D)
   * ============================================================================ */

  function isSupported() {
    return probeWebGL().supported;
  }

  function isActive() {
    return active;
  }

  function isMounted(targetFieldEl) {
    if (!active || !canvasEl || !canvasEl.isConnected) return false;
    if (targetFieldEl && fieldEl !== targetFieldEl) return false;
    return true;
  }

  function mountForBattle(battleState, targetFieldEl) {
    if (!isSupported()) return false;
    if (typeof document === 'undefined') return false;

    const resolvedField =
      targetFieldEl ||
      document.querySelector('#battle-screen .cb-arena-field');
    if (!resolvedField) return false;

    // Reuse active mount if same field element is still connected
    if (active && fieldEl === resolvedField && canvasEl && canvasEl.isConnected) {
      lastBattleState = battleState || lastBattleState;
      ensureBiomeAndMood(lastBattleState);
      syncRoster(lastBattleState);
      handleResize();
      scheduleImmediateRedraw();
      return true;
    }

    if (active) {
      cleanup();
    }

    ensureScratchMath();

    const probe = probeWebGL();
    isSoftwareRenderer = probe.isSoftware;
    rendererInfo = probe.rendererName;

    fieldEl = resolvedField;
    battleScreenEl =
      document.getElementById('battle-screen') ||
      (typeof fieldEl.closest === 'function' ? fieldEl.closest('#battle-screen') : null);
    canvasHostEl = battleScreenEl || fieldEl;

    const canReusePool = isPooledWebGLHealthy();
    if (!canReusePool && renderer) {
      destroyWebGLPool();
    }

    if (!canReusePool) {
      canvasEl = document.createElement('canvas');
      canvasEl.id = 'cb-stage-3d-canvas';
      canvasEl.className = 'cb-stage-3d-canvas';
      canvasEl.setAttribute('aria-hidden', 'true');
      canvasEl.style.position = 'absolute';
      canvasEl.style.inset = '0';
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
      canvasEl.style.display = 'block';
      canvasEl.style.pointerEvents = 'none';
      canvasEl.style.zIndex = battleScreenEl ? '4' : '0';

      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvasEl,
          antialias: !isSoftwareRenderer,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
      } catch (_) {
        renderer = null;
        canvasEl = null;
        canvasHostEl = null;
        fieldEl = null;
        battleScreenEl = null;
        return false;
      }
    } else {
      canvasEl.style.zIndex = battleScreenEl ? '4' : '0';
    }

    // Mount directly inside #battle-screen (z-index: 4, behind #cb-palace-frost & .cb-shell)
    canvasHostEl.insertBefore(canvasEl, canvasHostEl.firstChild);
    fieldEl.classList.add('is-3d-stage', 'cb-stage3d-active');
    fieldEl.setAttribute('data-stage3d', 'active');
    if (battleScreenEl) {
      battleScreenEl.classList.add('is-3d-stage', 'cb-stage3d-active');
    }

    const sz = getLiveStageRects();
    lastStageRects = sz;
    viewportW = sz.width;
    viewportH = sz.height;
    fieldW = sz.fieldW;
    fieldH = sz.fieldH;
    fieldOffX = sz.fieldOffX;
    fieldOffY = sz.fieldOffY;
    currentDpr = isSoftwareRenderer
      ? SOFTWARE_PIXEL_RATIO
      : Math.min(
          typeof window !== 'undefined' && window.devicePixelRatio
            ? window.devicePixelRatio
            : 1,
          2
        );

    renderer.shadowMap.enabled = !isSoftwareRenderer;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(currentDpr);
    renderer.setSize(viewportW, viewportH, false);

    if (!canReusePool) {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        SCHEME_C_BASE_FOV,
        viewportW / viewportH,
        0.1,
        180
      );
      camera.position.set(...SCHEME_C_BASE_POS);
      camera.lookAt(...SCHEME_C_BASE_LOOK);
      camera.updateMatrixWorld(true);

      texLib = createPBRTextureLibrary(THREE);
      postPipeline = createHD2DPostPipeline(THREE, renderer, scene, camera, texLib, {
        qualityMode: isSoftwareRenderer ? 'software' : 'ultra',
      });

      stageGroup = new THREE.Group();
      stageGroup.name = 'CombatStage3D_Root';
      actorsGroup = new THREE.Group();
      actorsGroup.name = 'CombatStage3D_Actors';
      ghostsGroup = new THREE.Group();
      ghostsGroup.name = 'CombatStage3D_Ghosts';
      stageGroup.add(actorsGroup);
      stageGroup.add(ghostsGroup);

      moodAccentLight = new THREE.PointLight(0xffffff, 0, 20, 1.6);
      moodAccentLight.position.set(0, 3.6, -1.5);
      stageGroup.add(moodAccentLight);

      scene.add(stageGroup);

      unitDiscGeo = new THREE.PlaneGeometry(1, 1);
      unitDiscGeo.rotateX(-Math.PI / 2);
      ownedGeometries.push(unitDiscGeo);

      softGlowTex =
        (texLib && texLib.softGlowDisc) ||
        (() => {
          const t = createSoftGlowDiscTexture(128);
          ownedTextures.push(t);
          return t;
        })();
      allyOuterRingTex = createAllyOuterRingTexture(256);
      allyInnerRingTex = createAllyInnerRingTexture(256);
      enemyOuterRingTex = createEnemyOuterReticleTexture(256);
      enemyInnerRingTex = createEnemyInnerReticleTexture(256);
      ownedTextures.push(
        allyOuterRingTex,
        allyInnerRingTex,
        enemyOuterRingTex,
        enemyInnerRingTex
      );
    } else {
      // Reset camera & resize pooled post-pipeline instantly without rebuilding WebGL or 23 PBR textures
      camera.fov = SCHEME_C_BASE_FOV;
      camera.aspect = viewportW / viewportH;
      camera.position.set(...SCHEME_C_BASE_POS);
      camera.lookAt(...SCHEME_C_BASE_LOOK);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      if (postPipeline) {
        postPipeline.resize(viewportW, viewportH, currentDpr);
      }
    }

    initCameraState();

    fieldEl.addEventListener('pointermove', handleFieldPointerMove, { passive: true });
    fieldEl.addEventListener('pointerleave', handleFieldPointerLeave, { passive: true });
    fieldEl.addEventListener('click', handleFieldClick);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(fieldEl);
      if (canvasHostEl && canvasHostEl !== fieldEl) {
        resizeObserver.observe(canvasHostEl);
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize, { passive: true });
    }

    active = true;
    timeScale = 1.0;
    startTimeMs = 0;
    lastFrameMs = 0;
    lastRenderEndMs = 0;
    simElapsedSec = 0;
    lastBattleState = battleState || null;
    lastPrismAnchorX = NaN;
    lastPrismAnchorY = NaN;
    currentMoodKey = null;

    ensureBiomeAndMood(lastBattleState);
    if (lastBattleState) {
      syncRoster(lastBattleState);
    }

    renderFrame(nowMs(), true);
    rafId = requestAnimationFrame(tick);
    return true;
  }

  function syncRoster(battleState, actorsMap) {
    if (!active) return;
    if (battleState) lastBattleState = battleState;
    const b = lastBattleState;

    if (b) {
      ensureBiomeAndMood(b);
      if (Number.isFinite(b.targetIdx)) {
        selectedEnemyKey = `enemy:${b.targetIdx}`;
      }
      if (b.activeActorKey) {
        activeActorKey = String(b.activeActorKey);
      } else {
        activeActorKey = 'player';
      }
    }

    // Collect sprite overrides from CombatPixelVFX actorsMap (Map or plain object)
    const externalSprites = new Map();
    if (actorsMap) {
      if (actorsMap instanceof Map) {
        actorsMap.forEach((st, k) => {
          if (st && st.spriteId) externalSprites.set(String(k), st);
        });
      } else if (typeof actorsMap === 'object') {
        Object.keys(actorsMap).forEach((k) => {
          const st = actorsMap[k];
          if (st && st.spriteId) externalSprites.set(String(k), st);
        });
      }
    }

    const allyList = [];
    const enemyList = [];

    // 1. Player
    const extPlayer = externalSprites.get('player');
    const playerSpriteId =
      (extPlayer && extPlayer.spriteId) ||
      fallbackResolveSpriteId('player', b && b.player, b);
    const pInfo = ensureFrame0AndBBox(playerSpriteId);
    allyList.push({
      key: 'player',
      spriteId: playerSpriteId,
      side: 'ally',
      order: 0,
      isWideBeast: pInfo.isWideBeast,
      isBoss: false,
      dead: Boolean(
        (extPlayer && extPlayer.dead) ||
          (b && b.player && Number.isFinite(b.player.hp) && b.player.hp <= 0)
      ),
    });

    // 2. Persistent allies (from battleState.allies + any non-cameo ally:* in actorsMap)
    const seenAllyKeys = new Set(['player']);
    if (b && Array.isArray(b.allies)) {
      for (let i = 0; i < b.allies.length; i++) {
        const al = b.allies[i];
        if (!al) continue;
        const aKey = `ally:${al.id || i}`;
        if (seenAllyKeys.has(aKey)) continue;
        seenAllyKeys.add(aKey);
        const ext = externalSprites.get(aKey);
        const sId = (ext && ext.spriteId) || fallbackResolveSpriteId('ally', al, b);
        const info = ensureFrame0AndBBox(sId);
        allyList.push({
          key: aKey,
          spriteId: sId,
          side: 'ally',
          order: i + 1,
          isWideBeast: info.isWideBeast,
          isBoss: false,
          dead: Boolean(
            (ext && ext.dead) || (Number.isFinite(al.hp) && al.hp <= 0)
          ),
        });
      }
    }
    externalSprites.forEach((st, k) => {
      if (!k.startsWith('ally:') || seenAllyKeys.has(k) || cameoKeys.has(k)) return;
      seenAllyKeys.add(k);
      const info = ensureFrame0AndBBox(st.spriteId);
      allyList.push({
        key: k,
        spriteId: st.spriteId,
        side: 'ally',
        order: allyList.length,
        isWideBeast: info.isWideBeast,
        isBoss: false,
        dead: Boolean(st.dead),
      });
    });

    // 3. Enemies
    const seenEnemyKeys = new Set();
    if (b && Array.isArray(b.enemies)) {
      for (let i = 0; i < b.enemies.length; i++) {
        const en = b.enemies[i];
        if (!en) continue;
        const eKey = `enemy:${i}`;
        seenEnemyKeys.add(eKey);
        const ext = externalSprites.get(eKey);
        const sId = (ext && ext.spriteId) || fallbackResolveSpriteId('enemy', en, b);
        const info = ensureFrame0AndBBox(sId);
        enemyList.push({
          key: eKey,
          enemyIdx: i,
          spriteId: sId,
          side: 'enemy',
          isWideBeast: info.isWideBeast,
          isBoss: Boolean(en.boss || en.rank >= 4 || sId === 'wind_god_avatar'),
          dead: Boolean(
            (ext && ext.dead) || (Number.isFinite(en.hp) && en.hp <= 0)
          ),
        });
      }
    } else {
      // Fallback if only actorsMap provided
      const eEntries = [];
      externalSprites.forEach((st, k) => {
        if (k.startsWith('enemy:')) {
          eEntries.push({ key: k, idx: Number(k.slice(6)) || 0, st });
        }
      });
      eEntries.sort((a, c) => a.idx - c.idx);
      for (let i = 0; i < eEntries.length; i++) {
        const { key, idx, st } = eEntries[i];
        seenEnemyKeys.add(key);
        const info = ensureFrame0AndBBox(st.spriteId);
        enemyList.push({
          key,
          enemyIdx: idx,
          spriteId: st.spriteId,
          side: 'enemy',
          isWideBeast: info.isWideBeast,
          isBoss: st.spriteId === 'wind_god_avatar' || st.spriteId === 'abyss_behemoth',
          dead: Boolean(st.dead),
        });
      }
    }

    allyCount = allyList.length;
    enemyCount = enemyList.length;
    if (battleScreenEl) {
      if (enemyCount >= 4) {
        battleScreenEl.setAttribute('data-enemy-count-many', '1');
      } else {
        battleScreenEl.removeAttribute('data-enemy-count-many');
      }
    }

    const allyPosMap = computeAllyPositions(allyList);
    const enemyPosMap = computeEnemyPositions(enemyList);

    const desiredSpecs = [];
    for (let i = 0; i < allyList.length; i++) {
      const item = allyList[i];
      const layout = allyPosMap.get(item.key);
      desiredSpecs.push({ ...item, pos: layout.pos, heightWorld: layout.heightWorld });
    }
    for (let i = 0; i < enemyList.length; i++) {
      const item = enemyList[i];
      const layout = enemyPosMap.get(item.key);
      desiredSpecs.push({ ...item, pos: layout.pos, heightWorld: layout.heightWorld });
    }

    const keepKeys = new Set();
    let changed = false;

    for (let i = 0; i < desiredSpecs.length; i++) {
      const spec = desiredSpecs[i];
      keepKeys.add(spec.key);
      const existing = actorMap.get(spec.key);
      if (existing && existing.spriteId === spec.spriteId && existing.side === spec.side && !existing.isCameo) {
        if (updateActorLayoutPosition(existing, spec.pos, spec.heightWorld)) {
          changed = true;
        }
        if (existing.dead !== spec.dead) {
          existing.dead = spec.dead;
          updateActorMaterialTint(existing);
          changed = true;
        }
        existing.enemyIdx = spec.enemyIdx != null ? spec.enemyIdx : -1;
        existing.isBoss = spec.isBoss;
      } else {
        if (existing) {
          const idxInArr = actors.indexOf(existing);
          if (idxInArr >= 0) actors.splice(idxInArr, 1);
          actorMap.delete(spec.key);
          disposeActor(existing);
        }
        const created = buildActorObject(spec);
        actors.push(created);
        actorMap.set(spec.key, created);
        changed = true;
      }
    }

    // Preserve active cameos; remove stale non-cameo actors
    for (let i = actors.length - 1; i >= 0; i--) {
      const a = actors[i];
      if (!keepKeys.has(a.key) && !a.isCameo) {
        actors.splice(i, 1);
        actorMap.delete(a.key);
        disposeActor(a);
        changed = true;
      }
    }

    // Ensure selectedEnemyKey points to a valid enemy
    if (!actorMap.has(selectedEnemyKey)) {
      const firstEnemy = actors.find((a) => a.side === 'enemy' && !a.dead) ||
        actors.find((a) => a.side === 'enemy');
      selectedEnemyKey = firstEnemy ? firstEnemy.key : null;
    }

    refreshEnemyCardElements();
    updateProjectionCache();
    syncEnemyCardsGPU();
    syncPrismMenuFollow();
    if (changed || isSoftwareRenderer) {
      scheduleImmediateRedraw();
    }
  }

  function updateActorVisual(actorKey, snap) {
    if (!active || !actorKey || !snap) return;
    const key = String(actorKey);
    let actor = actorMap.get(key);

    // If actor swapped sprite mid-battle (e.g. disguise toggle), rebuild in place
    if (actor && snap.spriteId && snap.spriteId !== actor.spriteId) {
      const idx = actors.indexOf(actor);
      const spec = {
        key: actor.key,
        spriteId: String(snap.spriteId),
        side: actor.side,
        enemyIdx: actor.enemyIdx,
        isBoss: actor.isBoss,
        isCameo: actor.isCameo,
        pos: [actor.basePos.x, actor.basePos.y, actor.basePos.z],
        heightWorld: actor.heightWorld,
        dead: Boolean(snap.dead),
      };
      if (idx >= 0) actors.splice(idx, 1);
      actorMap.delete(key);
      disposeActor(actor);
      actor = buildActorObject(spec);
      actors.push(actor);
      actorMap.set(key, actor);
      scheduleImmediateRedraw();
    }
    if (!actor) return;

    const prevFrame = actor.currentFrame;
    const prevPose = actor.pose;
    const prevDx = actor.dxPx;
    const prevDy = actor.dyPx;
    const prevFlash = actor.hitFlash;
    const prevDead = actor.dead;

    actor.hasExternalVisual = true;
    if (Number.isFinite(snap.frame)) {
      applyActorFrame(actor, snap.frame | 0);
    }
    if (snap.pose != null) actor.pose = String(snap.pose);
    if (Number.isFinite(snap.dx)) actor.dxPx = snap.dx;
    if (Number.isFinite(snap.dy)) actor.dyPx = snap.dy;
    if (Number.isFinite(snap.totalY)) actor.totalYPx = snap.totalY;
    else if (Number.isFinite(snap.runBobY)) actor.totalYPx = snap.runBobY;
    if (Number.isFinite(snap.sx)) actor.sx = snap.sx;
    else if (Number.isFinite(snap.scaleX)) actor.sx = snap.scaleX;
    if (Number.isFinite(snap.sy)) actor.sy = snap.sy;
    else if (Number.isFinite(snap.scaleY)) actor.sy = snap.scaleY;
    if (Number.isFinite(snap.tiltDeg)) actor.tiltDeg = snap.tiltDeg;

    actor.hitFlash =
      snap.hitFlash !== undefined
        ? Boolean(snap.hitFlash)
        : Number.isFinite(snap.flashLeft)
          ? snap.flashLeft > 0
          : false;
    if (snap.dead !== undefined) actor.dead = Boolean(snap.dead);
    if (snap.flipped !== undefined) actor.flipped = Boolean(snap.flipped);

    // On software WebGL, trigger instant redraw for meaningful combat motion/feedback
    if (isSoftwareRenderer) {
      const moved =
        Math.abs(actor.dxPx - prevDx) > 1.5 ||
        Math.abs(actor.dyPx - prevDy) > 1.5;
      const nonIdlePose = actor.pose !== 'idle' && actor.pose !== 'blink';
      if (
        moved ||
        actor.hitFlash !== prevFlash ||
        actor.dead !== prevDead ||
        (actor.pose !== prevPose && (nonIdlePose || prevPose !== 'idle')) ||
        (nonIdlePose && actor.currentFrame !== prevFrame)
      ) {
        scheduleImmediateRedraw();
      }
    }
  }

  function spawnDashGhost(actorKey, ghost) {
    if (!active || !ghostsGroup) return;
    const actor = actorMap.get(String(actorKey || ''));
    if (!actor) return;

    const opts =
      typeof ghost === 'string'
        ? { tone: ghost }
        : ghost && typeof ghost === 'object'
          ? ghost
          : {};

    const frameIdx = Number.isFinite(opts.frame) ? opts.frame | 0 : actor.currentFrame;
    const frameData = decodeBankFrameToCache(
      opts.spriteId || actor.spriteId,
      frameIdx
    );
    const toneKey = String(opts.tone || 'ice').toLowerCase();
    const tintHex = GHOST_TONE_HEX[toneKey] || GHOST_TONE_HEX.ice;

    // Cap live 3D ghosts to keep draw calls tight
    while (dashGhosts.length >= 8) {
      const old = dashGhosts.shift();
      if (old.pivot.parent === ghostsGroup) ghostsGroup.remove(old.pivot);
      old.geo.dispose();
      old.mat.dispose();
    }

    const pivot = new THREE.Group();
    const ppu = Math.max(40, actor.pxPerUnit || 112);
    const gx = Number.isFinite(opts.dx) ? clamp(opts.dx / ppu, -8.5, 8.5) : actor.spritePivot.position.x;
    const gy = Number.isFinite(opts.dy)
      ? Math.max(0, -opts.dy / ppu)
      : actor.spritePivot.position.y;
    pivot.position.set(
      actor.basePos.x + gx,
      actor.basePos.y + gy,
      actor.basePos.z - 0.04
    );
    pivot.rotation.y = actor.spritePivot.rotation.y;

    const geo = new THREE.PlaneGeometry(actor.planeW, actor.planeH);
    const mat = new THREE.MeshBasicMaterial({
      map: frameData.texture,
      color: new THREE.Color(tintHex),
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const effFlip = actor.baseFlipX * ((opts.flipped !== undefined ? opts.flipped : actor.flipped) ? -1 : 1);
    mesh.position.set(-((actor.feetXpx / actor.w - 0.5) * actor.planeW) * effFlip, actor.meshLocalY, 0);
    mesh.scale.set(effFlip, 1, 1);
    mesh.renderOrder = 4;
    pivot.add(mesh);

    ghostsGroup.add(pivot);
    dashGhosts.push({
      pivot,
      geo,
      mat,
      age: 0,
      duration: clamp((Number(opts.durationMs) || 220) / 1000, 0.08, 0.8),
    });

    scheduleImmediateRedraw();
  }

  function summonCameo(actorKey, spriteId, slotIdx) {
    if (!active || !actorKey) return false;
    const key = String(actorKey);
    const existing = actorMap.get(key);
    // Never overwrite a persistent ally already on the field (e.g. Reno in Rowan battle)
    if (existing && !existing.isCameo) {
      return true;
    }

    if (existing) {
      const idx = actors.indexOf(existing);
      if (idx >= 0) actors.splice(idx, 1);
      actorMap.delete(key);
      disposeActor(existing);
    }

    const sIdx = Number.isFinite(slotIdx)
      ? clamp(slotIdx | 0, 0, CAMEO_SLOTS.length - 1)
      : cameoKeys.size % CAMEO_SLOTS.length;
    const slot = CAMEO_SLOTS[sIdx] || CAMEO_SLOTS[0];

    const created = buildActorObject({
      key,
      spriteId: String(spriteId || key.replace(/^ally:/, '') || 'reno'),
      side: 'ally',
      pos: slot.pos.slice(),
      heightWorld: slot.heightWorld,
      isCameo: true,
    });
    actors.push(created);
    actorMap.set(key, created);
    cameoKeys.add(key);

    updateProjectionCache();
    scheduleImmediateRedraw();
    return true;
  }

  function removeCameo(actorKey) {
    if (!active || !actorKey) return;
    const key = String(actorKey);
    const actor = actorMap.get(key);
    if (!actor || !actor.isCameo) {
      cameoKeys.delete(key);
      return;
    }
    const idx = actors.indexOf(actor);
    if (idx >= 0) actors.splice(idx, 1);
    actorMap.delete(key);
    cameoKeys.delete(key);
    projCacheBase.delete(key);
    projCacheLive.delete(key);
    disposeActor(actor);
    scheduleImmediateRedraw();
  }

  function syncPlayerAuraCanvases(backCanvas, frontCanvas, isActiveAura) {
    if (!active) return;
    auraActive = Boolean(isActiveAura);

    if (backCanvas && backCanvas !== auraBackCanvas) {
      if (auraBackTex) auraBackTex.dispose();
      auraBackCanvas = backCanvas;
      auraBackTex = new THREE.CanvasTexture(backCanvas);
      auraBackTex.colorSpace = THREE.SRGBColorSpace;
      auraBackTex.minFilter = THREE.LinearFilter;
      auraBackTex.magFilter = THREE.LinearFilter;
      auraBackTex.generateMipmaps = false;
    }
    if (frontCanvas && frontCanvas !== auraFrontCanvas) {
      if (auraFrontTex) auraFrontTex.dispose();
      auraFrontCanvas = frontCanvas;
      auraFrontTex = new THREE.CanvasTexture(frontCanvas);
      auraFrontTex.colorSpace = THREE.SRGBColorSpace;
      auraFrontTex.minFilter = THREE.LinearFilter;
      auraFrontTex.magFilter = THREE.LinearFilter;
      auraFrontTex.generateMipmaps = false;
    }

    const player = actorMap.get('player');
    if (player) {
      if (!player.auraBackMesh) attachPlayerAuraPlanes(player);
      if (player.auraBackMesh && player.auraBackMat) {
        if (auraBackTex && player.auraBackMat.map !== auraBackTex) {
          player.auraBackMat.map = auraBackTex;
          player.auraBackMat.needsUpdate = true;
        }
        if (auraActive && auraBackTex) auraBackTex.needsUpdate = true;
        player.auraBackMesh.visible = Boolean(auraActive && auraBackTex);
      }
      if (player.auraFrontMesh && player.auraFrontMat) {
        if (auraFrontTex && player.auraFrontMat.map !== auraFrontTex) {
          player.auraFrontMat.map = auraFrontTex;
          player.auraFrontMat.needsUpdate = true;
        }
        if (auraActive && auraFrontTex) auraFrontTex.needsUpdate = true;
        player.auraFrontMesh.visible = Boolean(auraActive && auraFrontTex);
      }
    }

    scheduleImmediateRedraw();
  }

  function setTimeScale(scale) {
    const n = Number(scale);
    timeScale = Number.isFinite(n) ? clamp(n, 0.02, 2.0) : 1.0;
  }

  function addCameraTrauma(amount) {
    if (!active || !camState) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    camState.shakeTrauma = clamp(camState.shakeTrauma + n, 0, 1);
    scheduleImmediateRedraw();
  }

  function focusCameraOn(mode, actorKey) {
    if (!active || !camState) return;
    const m = String(mode || 'default').toLowerCase();
    if (m === 'default' || m === 'reset' || m === 'overview') {
      camState.focusMode = 'default';
      camState.focusActorKey = null;
    } else if (m === 'actor' || m === 'ally') {
      camState.focusMode = 'actor';
      camState.focusActorKey = actorKey ? String(actorKey) : activeActorKey;
    } else if (m === 'enemy' || m === 'target') {
      camState.focusMode = 'enemy';
      camState.focusActorKey = actorKey ? String(actorKey) : selectedEnemyKey;
    } else if (m === 'clash' || m === 'skill' || m === 'impact') {
      camState.focusMode = 'clash';
      camState.focusActorKey = actorKey ? String(actorKey) : activeActorKey;
    } else {
      camState.focusMode = 'default';
      camState.focusActorKey = null;
    }
    scheduleImmediateRedraw();
  }

  function onTargetChanged(enemyIdx) {
    if (!active) return;
    if (typeof enemyIdx === 'string' && enemyIdx.startsWith('enemy:')) {
      selectedEnemyKey = enemyIdx;
    } else if (Number.isFinite(Number(enemyIdx))) {
      selectedEnemyKey = `enemy:${Number(enemyIdx) | 0}`;
    }
    scheduleImmediateRedraw();
  }

  function onWaveOrPhaseChange(battleState) {
    if (!active) return;
    if (battleState) lastBattleState = battleState;
    ensureBiomeAndMood(lastBattleState);
    if (lastBattleState) {
      syncRoster(lastBattleState);
    }
    addCameraTrauma(0.28);
    scheduleImmediateRedraw();
  }

  function projectActorPoints(actorKey, includeDash = true) {
    if (!active) return null;
    const key = String(actorKey || 'player');
    const useBasePos = !includeDash;
    const cache = useBasePos ? projCacheBase : projCacheLive;
    let rec = cache.get(key);
    if (!rec && actorMap.has(key)) {
      const actor = actorMap.get(key);
      if (camera) {
        camera.updateMatrixWorld(true);
        camera.getWorldDirection(_camFwd);
      }
      const rects = lastStageRects || getLiveStageRects();
      rec = buildProjectionRecord(actor, useBasePos, rects);
      cache.set(key, rec);
    }
    if (!rec) return null;
    return {
      coordSpace: 'field',
      anchor: { x: rec.anchor.x, y: rec.anchor.y },
      feet: { x: rec.feet.x, y: rec.feet.y },
      cast: { x: rec.cast.x, y: rec.cast.y },
      hit: { x: rec.hit.x, y: rec.hit.y },
      head: { x: rec.head.x, y: rec.head.y },
      screenX: rec.screenX,
      screenY: rec.screenY,
      screenW: rec.screenW,
      screenH: rec.screenH,
      left: rec.left,
      top: rec.top,
      right: rec.right,
      bottom: rec.bottom,
      feetX: rec.feetX,
      feetY: rec.feetY,
      headX: rec.headX,
      headY: rec.headY,
      centerX: rec.centerX,
      centerY: rec.centerY,
      fieldW: rec.fieldW,
      fieldH: rec.fieldH,
      depthZ: rec.depthZ,
      pxPerUnit: rec.pxPerUnit,
      onScreen: rec.onScreen,
    };
  }

  function getActorScreenBox(actorKey) {
    if (!active) return null;
    const key = String(actorKey || 'player');
    let rec = projCacheBase.get(key);
    if (!rec && actorMap.has(key)) {
      updateProjectionCache();
      rec = projCacheBase.get(key);
    }
    if (!rec) return null;

    const curActor = actorMap.get(key) || null;
    let minEnemyLeft = Infinity;
    let maxRightFrontAllyRight = -Infinity;

    for (let i = 0; i < actors.length; i++) {
      const other = actors[i];
      if (!other || other.dead) continue;
      const oRec = projCacheBase.get(other.key);
      if (!oRec || !oRec.onScreen) continue;

      if (other.side === 'enemy') {
        if (oRec.left < minEnemyLeft) {
          minEnemyLeft = oRec.left;
        }
      } else if (
        other.side === 'ally' &&
        other.key !== key &&
        (!curActor || curActor.side === 'ally')
      ) {
        const isRightFront =
          oRec.right > rec.right + 1 ||
          (curActor && other.basePos.x > curActor.basePos.x + 0.15 && oRec.right > rec.left);
        if (isRightFront && oRec.right > maxRightFrontAllyRight) {
          maxRightFrontAllyRight = oRec.right;
        }
      }
    }

    const enemyFrontLeftX = Number.isFinite(minEnemyLeft) ? minEnemyLeft : null;
    const safeAnchorRightX = Number.isFinite(maxRightFrontAllyRight)
      ? maxRightFrontAllyRight + 10
      : null;

    return {
      coordSpace: 'field',
      left: rec.left,
      top: rec.top,
      right: rec.right,
      bottom: rec.bottom,
      width: rec.width,
      height: rec.height,
      centerX: rec.centerX,
      centerY: rec.centerY,
      feetX: rec.feetX,
      feetY: rec.feetY,
      headX: rec.headX,
      headY: rec.headY,
      fieldW: rec.fieldW,
      fieldH: rec.fieldH,
      enemyFrontLeftX,
      safeAnchorRightX,
      actorKey: rec.actorKey,
      onScreen: rec.onScreen,
    };
  }

  function clearEffects() {
    if (!active) return;

    for (let i = 0; i < dashGhosts.length; i++) {
      const g = dashGhosts[i];
      if (ghostsGroup && g.pivot.parent === ghostsGroup) {
        ghostsGroup.remove(g.pivot);
      }
      g.geo.dispose();
      g.mat.dispose();
    }
    dashGhosts.length = 0;

    // Remove temporary cameos
    Array.from(cameoKeys).forEach((k) => removeCameo(k));

    timeScale = 1.0;
    if (camState) {
      camState.shakeTrauma = 0;
      camState.focusMode = 'default';
      camState.focusActorKey = null;
    }

    // Reset transient dash/flash offsets on actors
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      a.dxPx = 0;
      a.dyPx = 0;
      a.totalYPx = 0;
      a.sx = 1;
      a.sy = 1;
      a.tiltDeg = 0;
      a.hitFlash = false;
    }

    scheduleImmediateRedraw();
  }

  function cleanup() {
    if (rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
    }
    rafId = 0;
    active = false;
    pendingImmediateRender = false;

    if (resizeObserver) {
      try {
        resizeObserver.disconnect();
      } catch (_) {
        // ignore
      }
      resizeObserver = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }

    if (fieldEl) {
      fieldEl.removeEventListener('pointermove', handleFieldPointerMove);
      fieldEl.removeEventListener('pointerleave', handleFieldPointerLeave);
      fieldEl.removeEventListener('click', handleFieldClick);
      fieldEl.classList.remove('is-3d-stage', 'cb-stage3d-active');
      fieldEl.removeAttribute('data-stage3d');
      // Clear inline GPU transforms on enemy cards so 2D fallback layout is spotless
      try {
        fieldEl.querySelectorAll('.cb-enemy-card[data-eidx]').forEach((card) => {
          card.style.transform = '';
        });
      } catch (_) {
        // ignore
      }
    }
    if (battleScreenEl) {
      battleScreenEl.classList.remove('is-3d-stage', 'cb-stage3d-active');
      battleScreenEl.removeAttribute('data-enemy-count-many');
    }
    // Detach pooled canvas from DOM without destroying WebGLRenderer / texLib / biomePool
    if (canvasEl && canvasEl.parentNode) {
      canvasEl.parentNode.removeChild(canvasEl);
    }

    // Dispose per-battle dash ghosts
    for (let i = 0; i < dashGhosts.length; i++) {
      const g = dashGhosts[i];
      if (ghostsGroup && g.pivot.parent === ghostsGroup) ghostsGroup.remove(g.pivot);
      g.geo.dispose();
      g.mat.dispose();
    }
    dashGhosts.length = 0;

    // Dispose per-battle actors (shared sprite textures in frameCache & ring textures stay pooled)
    for (let i = 0; i < actors.length; i++) {
      disposeActor(actors[i]);
    }
    actors.length = 0;
    actorMap.clear();
    cameoKeys.clear();
    projCacheBase.clear();
    projCacheLive.clear();
    enemyCardCache.clear();
    cachedEnemyZoneEl = null;

    // Dispose per-battle aura canvases/textures
    if (auraBackTex) {
      auraBackTex.dispose();
      auraBackTex = null;
    }
    if (auraFrontTex) {
      auraFrontTex.dispose();
      auraFrontTex = null;
    }
    auraBackCanvas = null;
    auraFrontCanvas = null;
    auraActive = false;

    // Detach current biome group from scene while keeping it warm in biomePool
    if (currentBiome && scene && currentBiome.group && currentBiome.group.parent === scene) {
      scene.remove(currentBiome.group);
    }
    currentMoodKey = null;
    moodAccentCfg = null;
    if (moodAccentLight) {
      moodAccentLight.intensity = 0;
    }

    canvasHostEl = null;
    fieldEl = null;
    battleScreenEl = null;
    lastStageRects = null;
    lastBattleState = null;
    activeActorKey = 'player';
    selectedEnemyKey = 'enemy:0';
    allyCount = 1;
    enemyCount = 1;
    lastPrismAnchorX = NaN;
    lastPrismAnchorY = NaN;
    lastPrismActorKey = '';
  }

  function getDebugState() {
    const probe = probeWebGL();
    const actorSummary = actors.map((a) => ({
      key: a.key,
      spriteId: a.spriteId,
      side: a.side,
      isWideBeast: a.isWideBeast,
      aspect: Number(a.aspect.toFixed(2)),
      pos: [
        Number(a.basePos.x.toFixed(2)),
        Number(a.basePos.y.toFixed(2)),
        Number(a.basePos.z.toFixed(2)),
      ],
      heightWorld: Number(a.heightWorld.toFixed(2)),
      frame: a.currentFrame,
      pose: a.pose,
      dead: a.dead,
      isCameo: a.isCameo,
    }));

    const projections = {};
    projCacheLive.forEach((v, k) => {
      projections[k] = {
        feetX: Number(v.feetX.toFixed(1)),
        feetY: Number(v.feetY.toFixed(1)),
        left: Number(v.left.toFixed(1)),
        right: Number(v.right.toFixed(1)),
        top: Number(v.top.toFixed(1)),
        bottom: Number(v.bottom.toFixed(1)),
        onScreen: v.onScreen,
      };
    });

    return {
      active,
      supported: probe.supported,
      isSoftwareRenderer: probe.isSoftware,
      rendererInfo: probe.rendererName,
      qualityMode:
        postPipeline && typeof postPipeline.getQualityMode === 'function'
          ? postPipeline.getQualityMode()
          : probe.isSoftware
            ? 'software'
            : 'ultra',
      renderMode:
        postPipeline && typeof postPipeline.getRenderMode === 'function'
          ? postPipeline.getRenderMode()
          : 'direct',
      biomeId: currentBiomeId,
      moodKey: currentMoodKey,
      stageId: currentStageId,
      waveIdx: currentWaveIdx,
      viewportW,
      viewportH,
      fieldW,
      fieldH,
      dpr: currentDpr,
      fps: currentFps,
      timeScale,
      focusMode: camState ? camState.focusMode : 'default',
      focusActorKey: camState ? camState.focusActorKey : null,
      activeActorKey,
      selectedEnemyKey,
      allyCount,
      enemyCount,
      actorCount: actors.length,
      ghostCount: dashGhosts.length,
      auraActive,
      actors: actorSummary,
      projections,
      camera: camera
        ? {
            pos: [
              Number(camera.position.x.toFixed(2)),
              Number(camera.position.y.toFixed(2)),
              Number(camera.position.z.toFixed(2)),
            ],
            fov: Number(camera.fov.toFixed(2)),
          }
        : null,
    };
  }

  return {
    isActive,
    isSupported,
    isMounted,
    mountForBattle,
    syncRoster,
    updateActorVisual,
    spawnDashGhost,
    summonCameo,
    removeCameo,
    syncPlayerAuraCanvases,
    setTimeScale,
    addCameraTrauma,
    focusCameraOn,
    onTargetChanged,
    onWaveOrPhaseChange,
    projectActorPoints,
    getActorScreenBox,
    clearEffects,
    cleanup,
    getDebugState,
  };
}

export const CombatStage3D = createCombatStage3D();

if (typeof window !== 'undefined') {
  window.CombatStage3D = CombatStage3D;
}

export default CombatStage3D;
