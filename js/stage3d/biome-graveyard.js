/**
 * HD-2D 3D Exclusive Biome: Autumn Night Outer-City Mass Graveyard (秋夜乱葬岗墓地)
 * Dedicated Act 2 Rowan Murder Case Capture Battle Arena (`rowan_graveyard`)
 *
 * Sculpted procedural Three.js environment featuring:
 * - Strictly flat y = 0 combat clearing on x ∈ [-7.4, 7.4], z ∈ [-3.6, 3.6]
 *   (generously enclosing the required [-6.5, 6.5] × [-3.2, 3.2] lane) with a
 *   flush weathered bluestone ruined flagstone path and zero sightline obstructions
 * - Low-hanging silver-white cratered full moon & moonlit indigo gradient sky dome
 *   calibrated for the 34° HD-2D combat camera pitch, plus distant barren silhouette
 *   hills and a far-left ruined hillside chapel spire
 * - 5 sculpted ancient tombstone & Gothic cross archetypes (chamfered ExtrudeGeometry
 *   lancet headstones, haloed Gothic crosses, baroque scroll steles, shattered slabs
 *   with fallen fragments, and ajar stone sarcophagi) arranged with organic -8°~+10° lean
 * - 5 bespoke gnarled crooked dead trees (歪脖枯木) & tangled exposed surface roots
 *   sculpted via CatmullRomCurve3 + parallel-transport tapered fluted tubes (zero primitives)
 * - Ruined Gothic wrought-iron cemetery fence & sculpted stone gate pillars (z ≈ -8.8 ~ -11)
 *   with forged spearhead pickets, scrollwork bands, and crooked half-open iron gates
 * - 4 Gothic openwork wrought-iron stone lanterns with upturned eaves caps and pulsing
 *   ghost-blue spirit-fire cores on the far flanks (well clear of fighter silhouettes)
 * - Soft-edge scrolling low-lying ground mist veils + swaying ghost-blue will-o'-the-wisps
 *   and ascending autumn-night firefly motes
 * - Calibrated cool moonlit lighting & character-safe bloom/rim thresholds
 *   (spriteRimTint <= 1.02, bloomThreshold >= 0.90)
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG, Math & Procedural 2D Noise Helpers
// ---------------------------------------------------------------------------
function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function createRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function noise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

function fbm2D(x, z, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2D(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Graveyard Terrain & Perimeter Fence Curves
// ---------------------------------------------------------------------------
function getFenceCurveZ(x) {
  // Sweeping shallow graveyard perimeter arc across z ≈ -8.8 ~ -11.0
  return -8.85 - Math.min(2.15, x * x * 0.0072);
}

function getTerrainHeight(x, z) {
  // Strictly flat combat arena: required [-6.5, 6.5] × [-3.2, 3.2],
  // padded to [-7.4, 7.4] × [-3.6, 3.6] so every triangle inside the arena is exact y = 0.
  const ax = Math.abs(x);
  if (ax <= 7.4 && z >= -3.6 && z <= 3.6) {
    return 0;
  }

  const dxArena = Math.max(0, ax - 7.4);
  const dzBack = Math.max(0, -3.6 - z);
  const dzFront = Math.max(0, z - 3.6);
  const arenaMask = smoothstep(
    0.0,
    2.6,
    Math.hypot(dxArena * 0.92, Math.max(dzBack * 1.15, dzFront * 0.9))
  );

  // Rolling autumn burial hills & weathered hollows outside the central clearing
  const nLarge = fbm2D(x * 0.065 + 7.2, z * 0.068 - 3.9, 4) - 0.45;
  const nMed = fbm2D(x * 0.19 - 2.4, z * 0.18 + 5.1, 3) - 0.5;
  const nMicro = fbm2D(x * 0.48 + 1.3, z * 0.48 - 2.2, 2) - 0.5;

  // Flanking earthen ridges (|x| > 7.8)
  const flankRise = smoothstep(7.8, 21.5, ax) * (1.85 + nLarge * 1.55);

  // Rear graveyard gentle slope rising toward the ruined fence & outer wild hills
  // Keep right-center moon corridor (x ∈ [2, 13], z < -12) lower so low moon shines clearly
  const moonCorridorDip =
    1.0 -
    0.45 *
      (1.0 - smoothstep(0.0, 8.5, Math.abs(x - 7.6))) *
      smoothstep(-10.5, -20.0, z);
  const backRise = smoothstep(-5.0, -24.0, z) * (2.65 + nLarge * 1.85) * moonCorridorDip;

  // Keep camera foreground center open & gently sloping down; low earthen curb on far corners only
  const cornerFrontRise = smoothstep(8.2, 13.5, ax) * smoothstep(4.2, 8.8, z) * 0.58;
  const centerFrontSlope =
    (1.0 - smoothstep(6.2, 10.0, ax)) * smoothstep(4.2, 12.5, z) * -0.28;

  let h =
    (flankRise + backRise + cornerFrontRise + nMed * 0.36 + nMicro * 0.09) * arenaMask +
    centerFrontSlope;

  // Flatten a worn central cemetery approach path heading through the iron gate (x ∈ [-2.4, 2.4], z ∈ [-11.5, -3.6])
  if (z < -3.5 && z > -13.0) {
    const pathMask =
      (1.0 - smoothstep(1.3, 3.1, ax)) *
      smoothstep(-3.6, -4.6, z) *
      (1.0 - smoothstep(-10.2, -13.0, z));
    if (pathMask > 0.0001) {
      const targetPathY = smoothstep(-3.6, -10.8, z) * 0.42;
      h = lerp(h, targetPathY, pathMask * 0.85);
    }
  }

  return h;
}

// ---------------------------------------------------------------------------
// Texture & Resource Management Helpers (100% texLib-tolerant & headless-safe)
// ---------------------------------------------------------------------------
function cloneTexWithRepeat(THREE, tex, rx, ry, trackedTextures) {
  if (!tex || !tex.isTexture) return null;
  if (rx == null && ry == null) return tex;
  const c = tex.clone();
  c.wrapS = THREE.RepeatWrapping;
  c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  trackedTextures.push(c);
  return c;
}

function resolveTexBundle(THREE, entry, rx, ry, trackedTextures) {
  if (!entry) return {};
  if (entry.isTexture) {
    const map = cloneTexWithRepeat(THREE, entry, rx, ry, trackedTextures);
    return map ? { map } : {};
  }
  const mapRaw = entry.map || entry.albedo || entry.color || entry.diffuse || null;
  const normalRaw = entry.normalMap || entry.normal || null;
  const bumpRaw = entry.bumpMap || entry.bump || null;
  const roughRaw = entry.roughnessMap || entry.roughness || null;
  const out = {};
  if (mapRaw && mapRaw.isTexture) out.map = cloneTexWithRepeat(THREE, mapRaw, rx, ry, trackedTextures);
  if (normalRaw && normalRaw.isTexture) out.normalMap = cloneTexWithRepeat(THREE, normalRaw, rx, ry, trackedTextures);
  else if (bumpRaw && bumpRaw.isTexture) out.bumpMap = cloneTexWithRepeat(THREE, bumpRaw, rx, ry, trackedTextures);
  if (roughRaw && roughRaw.isTexture) out.roughnessMap = cloneTexWithRepeat(THREE, roughRaw, rx, ry, trackedTextures);
  return out;
}

function resolveSingleTex(entry) {
  if (!entry) return null;
  if (entry.isTexture) return entry;
  return entry.map || entry.albedo || entry.color || entry.diffuse || null;
}

function createFallbackGlowTexture(THREE, trackedTextures) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.26, 'rgba(176,228,255,0.72)');
  grad.addColorStop(0.64, 'rgba(105,176,255,0.22)');
  grad.addColorStop(1.0, 'rgba(65,120,210,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  trackedTextures.push(tex);
  return tex;
}

function createProceduralSoilTexture(THREE, trackedTextures) {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Seamless periodic sampling
      const ax = (x / size) * Math.PI * 2;
      const ay = (y / size) * Math.PI * 2;
      const nx = Math.cos(ax) * 1.4 + 3.1;
      const nz = Math.sin(ay) * 1.4 + 2.7;
      const n1 = fbm2D(nx + Math.sin(ax) * 0.7, nz + Math.cos(ay) * 0.7, 3);
      const grain = hash2(x * 0.73, y * 1.19);
      const pebble = smoothstep(0.76, 0.95, hash2((x >> 2) * 3.1, (y >> 2) * 5.7));
      const v = clamp(0.62 + (n1 - 0.5) * 0.34 + (grain - 0.5) * 0.14 + pebble * 0.14, 0.32, 0.98);
      const p = (y * size + x) * 4;
      d[p] = Math.round(v * 236);
      d[p + 1] = Math.round(v * 242);
      d[p + 2] = Math.round(v * 255);
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 13);
  tex.needsUpdate = true;
  trackedTextures.push(tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Self-Contained BufferGeometry Merge & Vertex Shading Utilities
// ---------------------------------------------------------------------------
function mergeGeometries(THREE, geometries, disposeInputs = true) {
  let totalVerts = 0;
  let totalIndices = 0;
  let hasColor = false;

  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i];
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.attributes.color) hasColor = true;
    const vCount = g.attributes.position.count;
    totalVerts += vCount;
    totalIndices += g.index ? g.index.count : vCount;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = hasColor ? new Float32Array(totalVerts * 3) : null;
  const indices =
    totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i];
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const uv = g.attributes.uv;
    const col = g.attributes.color;
    const vCount = pos.count;

    positions.set(pos.array, vOffset * 3);
    normals.set(norm.array, vOffset * 3);

    if (uv) {
      uvs.set(uv.array, vOffset * 2);
    }

    if (hasColor) {
      if (col) {
        colors.set(col.array, vOffset * 3);
      } else {
        for (let k = 0; k < vCount * 3; k++) {
          colors[vOffset * 3 + k] = 1.0;
        }
      }
    }

    if (g.index) {
      const idxArr = g.index.array;
      for (let k = 0; k < idxArr.length; k++) {
        indices[iOffset + k] = idxArr[k] + vOffset;
      }
      iOffset += idxArr.length;
    } else {
      for (let k = 0; k < vCount; k++) {
        indices[iOffset + k] = vOffset + k;
      }
      iOffset += vCount;
    }

    vOffset += vCount;
    if (disposeInputs) g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (hasColor) {
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

function colorizeStoneGeometry(THREE, geo, opts = {}) {
  const {
    baseHex = 0x79879b,
    mossHex = 0x3b4d52,
    moonHex = 0xb5c6dc,
    crackHex = 0x394454,
    minY = 0.0,
    maxY = 1.8,
    seed = 1.0,
    mossHeight = 0.36,
  } = opts;

  const pos = geo.attributes.position;
  const count = pos.count;
  const arr = new Float32Array(count * 3);
  const cBase = new THREE.Color(baseHex);
  const cMoss = new THREE.Color(mossHex);
  const cMoon = new THREE.Color(moonHex);
  const cCrack = new THREE.Color(crackHex);
  const tmp = new THREE.Color();
  const spanY = Math.max(0.15, maxY - minY);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h01 = clamp((y - minY) / spanY, 0, 1);

    const nWeather = fbm2D(x * 3.1 + seed * 5.7, y * 3.1 + z * 2.4 - seed * 2.3, 3);
    const crackField = Math.abs(fbm2D(x * 6.4 - seed * 3.1, y * 5.2 + z * 4.8, 2) - 0.5);
    const crackMask = 1.0 - smoothstep(0.015, 0.075, crackField);

    tmp.copy(cBase);
    // Damp lichen & moss creeping up from buried base
    const mossMask = (1.0 - smoothstep(0.0, mossHeight, h01)) * (0.55 + 0.45 * nWeather);
    tmp.lerp(cMoss, clamp(mossMask, 0, 0.82));
    // Cool moonlight bleach along upper sculpted ridges & faces
    tmp.lerp(cMoon, smoothstep(0.45, 1.0, h01) * (0.28 + 0.25 * nWeather));
    // Dark hairline weathering crevices
    tmp.lerp(cCrack, crackMask * 0.46);

    const grain = (hash2(x * 13.7 + y * 9.3, z * 11.1 + seed) - 0.5) * 0.05;
    arr[i * 3] = clamp(tmp.r + grain, 0, 1);
    arr[i * 3 + 1] = clamp(tmp.g + grain, 0, 1);
    arr[i * 3 + 2] = clamp(tmp.b + grain * 0.9, 0, 1);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function setUniformVertexColor(THREE, geo, hexColor, jitter = 0.04) {
  const count = geo.attributes.position.count;
  const col = new THREE.Color(hexColor);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j = jitter ? (hash2(i * 0.87, hexColor * 0.013) - 0.5) * jitter : 0;
    arr[i * 3] = clamp(col.r + j, 0, 1);
    arr[i * 3 + 1] = clamp(col.g + j, 0, 1);
    arr[i * 3 + 2] = clamp(col.b + j, 0, 1);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// ---------------------------------------------------------------------------
// Sculpted Procedural Builder 1: Tapered Organic Curve Tube (CatmullRomCurve3)
// Used for gnarled crooked dead trees, secondary/tertiary dead twigs & roots
// ---------------------------------------------------------------------------
function createTaperedCurveTube(THREE, points, opts = {}) {
  const {
    rStart = 0.34,
    rEnd = 0.04,
    taperExp = 0.88,
    tubularSegs = 22,
    radialSegs = 8,
    fluteAmp = 0.12,
    fluteCount = 5,
    twistRate = 2.6,
    flareAmp = 0.0,
    seed = 1.0,
    capEnd = true,
    colBase = 0x26252b,
    colMid = 0x4b4b54,
    colTip = 0x7b8294,
  } = opts;

  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.45);
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    pts.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  // Parallel-transport (Bishop) frames to prevent Frenet torsion flips on crooked bends
  const normals = new Array(tubularSegs + 1);
  const binormals = new Array(tubularSegs + 1);
  const upRef = Math.abs(tangents[0].y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  binormals[0] = new THREE.Vector3().crossVectors(tangents[0], upRef).normalize();
  normals[0] = new THREE.Vector3().crossVectors(binormals[0], tangents[0]).normalize();
  // Ensure right-handed frame with B = T × N so (a,b,c) yields outward normals
  binormals[0].crossVectors(tangents[0], normals[0]).normalize();

  const rotAxis = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    const prevT = tangents[i - 1];
    const curT = tangents[i];
    const nVec = normals[i - 1].clone();
    rotAxis.crossVectors(prevT, curT);
    const axisLen = rotAxis.length();
    if (axisLen > 1e-6) {
      rotAxis.divideScalar(axisLen);
      const angle = Math.acos(clamp(prevT.dot(curT), -1, 1));
      quat.setFromAxisAngle(rotAxis, angle);
      nVec.applyQuaternion(quat);
    }
    nVec.addScaledVector(curT, -nVec.dot(curT)).normalize();
    normals[i] = nVec;
    binormals[i] = new THREE.Vector3().crossVectors(curT, nVec).normalize();
  }

  const stride = radialSegs + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const cBase = new THREE.Color(colBase);
  const cMid = new THREE.Color(colMid);
  const cTip = new THREE.Color(colTip);
  const tmpCol = new THREE.Color();
  const vPos = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const p = pts[i];
    const n = normals[i];
    const b = binormals[i];

    let baseR = lerp(rStart, rEnd, Math.pow(u, taperExp));
    if (flareAmp > 0 && u < 0.24) {
      const f = 1.0 - u / 0.24;
      baseR *= 1.0 + flareAmp * f * f;
    }
    // Organic gnarled knot bumps along length
    const knot = 1.0 + 0.085 * Math.sin(u * 12.5 + seed * 3.7) * (1.0 - u * 0.4);

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const flute =
        1.0 +
        fluteAmp *
          (0.65 * Math.sin(theta * fluteCount + u * twistRate + seed) +
            0.35 * Math.cos(theta * (fluteCount - 2) - u * twistRate * 0.65));
      const r = Math.max(0.006, baseR * knot * flute);

      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      vPos.copy(p).addScaledVector(n, cs * r).addScaledVector(b, sn * r);
      positions.push(vPos.x, vPos.y, vPos.z);
      uvs.push(v * 2.0, u * 4.5);

      // Damp dark bark at base & crevices -> moonlit ash-silver highlight along upper limbs
      if (u < 0.45) {
        tmpCol.copy(cBase).lerp(cMid, smoothstep(0.0, 0.45, u));
      } else {
        tmpCol.copy(cMid).lerp(cTip, smoothstep(0.45, 1.0, u));
      }
      // Subtle ridge shading along bark flutes
      const ridgeBright = 0.88 + 0.20 * clamp((flute - (1.0 - fluteAmp)) / Math.max(0.01, fluteAmp * 2), 0, 1);
      colors.push(
        clamp(tmpCol.r * ridgeBright, 0, 1),
        clamp(tmpCol.g * ridgeBright, 0, 1),
        clamp(tmpCol.b * ridgeBright, 0, 1)
      );
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  if (capEnd) {
    const tipIdx = positions.length / 3;
    const endP = pts[tubularSegs];
    const endT = tangents[tubularSegs];
    positions.push(
      endP.x + endT.x * rEnd * 1.45,
      endP.y + endT.y * rEnd * 1.45,
      endP.z + endT.z * rEnd * 1.45
    );
    uvs.push(0.5, 4.7);
    colors.push(cTip.r, cTip.g, cTip.b);
    const ringOff = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(ringOff + j, ringOff + j + 1, tipIdx);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a complete bespoke gnarled crooked dead tree (歪脖枯木) with:
 * - Crooked S-bending trunk with knotted bends
 * - 6–7 coiled exposed surface roots gripping the ground
 * - 6–8 skeletal primary & secondary crooked limbs
 * - 14–18 sharp clawed tertiary dead twigs
 * Zero cylinders, zero sphere canopies!
 */
function buildCrookedDeadTreeGeo(THREE, cfg) {
  const rng = createRng(cfg.seed || 7011);
  const parts = [];
  const leanX = cfg.leanX || 0.9;
  const leanZ = cfg.leanZ || -0.25;
  const h = cfg.height || 5.8;
  const baseR = cfg.baseR || 0.38;

  // 1. Crooked main trunk ("歪脖" dramatic bend)
  const trunkPts = [
    new THREE.Vector3(0, -0.22, 0),
    new THREE.Vector3(leanX * 0.14, h * 0.22, leanZ * 0.18),
    new THREE.Vector3(leanX * 0.62, h * 0.44, leanZ * 0.45 + (rng() - 0.5) * 0.35),
    new THREE.Vector3(leanX * 1.15, h * 0.66, leanZ * 0.72 + (rng() - 0.5) * 0.42),
    new THREE.Vector3(leanX * 0.96, h * 0.84, leanZ * 0.52 + (rng() - 0.5) * 0.35),
    new THREE.Vector3(leanX * 1.28, h * 1.0, leanZ * 0.68),
  ];
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPts, false, 'centripetal', 0.45);
  parts.push(
    createTaperedCurveTube(THREE, trunkPts, {
      rStart: baseR,
      rEnd: baseR * 0.16,
      taperExp: 0.78,
      tubularSegs: 24,
      radialSegs: 9,
      fluteAmp: 0.16,
      fluteCount: 6,
      twistRate: 3.4,
      flareAmp: 0.52,
      seed: cfg.seed * 0.13,
      capEnd: true,
    })
  );

  // 2. Coiled exposed surface roots clawing into the graveyard earth
  const rootCount = cfg.rootCount || 6;
  for (let r = 0; r < rootCount; r++) {
    const ang = (r / rootCount) * Math.PI * 2 + (rng() - 0.5) * 0.48;
    const reach = (1.15 + rng() * 1.15) * (baseR / 0.36);
    const curl = (rng() - 0.5) * 0.68;
    const c0 = Math.cos(ang);
    const s0 = Math.sin(ang);
    const c1 = Math.cos(ang + curl * 0.55);
    const s1 = Math.sin(ang + curl * 0.55);
    const c2 = Math.cos(ang + curl);
    const s2 = Math.sin(ang + curl);

    const rootPts = [
      new THREE.Vector3(c0 * baseR * 0.42, 0.52 + rng() * 0.25, s0 * baseR * 0.42),
      new THREE.Vector3(c0 * reach * 0.36, 0.24 + rng() * 0.14, s0 * reach * 0.36),
      new THREE.Vector3(c1 * reach * 0.70, 0.08 + rng() * 0.10, s1 * reach * 0.70),
      new THREE.Vector3(c2 * reach * 1.02, -0.18, s2 * reach * 1.02),
    ];
    parts.push(
      createTaperedCurveTube(THREE, rootPts, {
        rStart: baseR * (0.38 + rng() * 0.14),
        rEnd: 0.025,
        taperExp: 0.9,
        tubularSegs: 12,
        radialSegs: 6,
        fluteAmp: 0.14,
        fluteCount: 4,
        twistRate: 2.2,
        seed: cfg.seed + r * 7.1,
        colBase: 0x1e2027,
        colMid: 0x353740,
        colTip: 0x262932,
      })
    );
  }

  // 3. Gnarled primary/secondary crooked boughs + tertiary skeletal twigs
  const limbSpecs = cfg.limbs || [
    { u: 0.48, az: 0.35, len: 2.35, lift: 0.75, droop: -0.25, rMul: 0.42 },
    { u: 0.58, az: 2.55, len: 2.55, lift: 0.95, droop: -0.18, rMul: 0.40 },
    { u: 0.68, az: -1.35, len: 2.15, lift: 0.82, droop: -0.22, rMul: 0.36 },
    { u: 0.76, az: 0.95, len: 2.20, lift: 1.08, droop: -0.10, rMul: 0.32 },
    { u: 0.84, az: -2.45, len: 1.85, lift: 0.96, droop: 0.05, rMul: 0.27 },
    { u: 0.92, az: 1.85, len: 1.55, lift: 0.90, droop: 0.12, rMul: 0.22 },
  ];

  for (let i = 0; i < limbSpecs.length; i++) {
    const lb = limbSpecs[i];
    const origin = trunkCurve.getPoint(lb.u);
    const dx = Math.cos(lb.az);
    const dz = Math.sin(lb.az);
    const perpX = -dz;
    const perpZ = dx;
    const wiggle = (i % 2 === 0 ? 1 : -1) * (0.28 + rng() * 0.24);

    const p0 = origin.clone();
    const p1 = new THREE.Vector3(
      origin.x + dx * lb.len * 0.36 + perpX * wiggle * 0.5,
      origin.y + lb.lift * 0.48,
      origin.z + dz * lb.len * 0.36 + perpZ * wiggle * 0.5
    );
    const p2 = new THREE.Vector3(
      origin.x + dx * lb.len * 0.72 - perpX * wiggle * 0.65,
      origin.y + lb.lift * 0.92 + lb.droop * 0.4,
      origin.z + dz * lb.len * 0.72 - perpZ * wiggle * 0.65
    );
    const p3 = new THREE.Vector3(
      origin.x + dx * lb.len + perpX * wiggle * 0.3,
      origin.y + lb.lift + lb.droop,
      origin.z + dz * lb.len + perpZ * wiggle * 0.3
    );

    const limbPts = [p0, p1, p2, p3];
    const limbCurve = new THREE.CatmullRomCurve3(limbPts, false, 'centripetal', 0.45);
    const limbR = baseR * lb.rMul;

    parts.push(
      createTaperedCurveTube(THREE, limbPts, {
        rStart: limbR,
        rEnd: 0.022,
        taperExp: 0.84,
        tubularSegs: 14,
        radialSegs: 6,
        fluteAmp: 0.11,
        fluteCount: 4,
        twistRate: 2.1,
        seed: cfg.seed + i * 11.3,
        colBase: 0x3b3d47,
        colMid: 0x5c606e,
        colTip: 0x8993a8,
      })
    );

    // 2–3 sharp tertiary skeletal twigs per limb
    const twigCount = i < 4 ? 3 : 2;
    for (let tw = 0; tw < twigCount; tw++) {
      const tu = 0.38 + tw * 0.24 + (rng() - 0.5) * 0.06;
      const tOrigin = limbCurve.getPoint(clamp(tu, 0.3, 0.88));
      const tAz = lb.az + (tw % 2 === 0 ? 1 : -1) * (0.62 + rng() * 0.55);
      const tLen = (0.65 + rng() * 0.58) * (1.0 - tu * 0.25);
      const tLift = 0.22 + rng() * 0.52;
      const tdx = Math.cos(tAz);
      const tdz = Math.sin(tAz);

      const twigPts = [
        tOrigin.clone(),
        new THREE.Vector3(
          tOrigin.x + tdx * tLen * 0.48,
          tOrigin.y + tLift * 0.58 + (rng() - 0.5) * 0.14,
          tOrigin.z + tdz * tLen * 0.48
        ),
        new THREE.Vector3(
          tOrigin.x + tdx * tLen,
          tOrigin.y + tLift + (rng() - 0.45) * 0.25,
          tOrigin.z + tdz * tLen
        ),
      ];
      parts.push(
        createTaperedCurveTube(THREE, twigPts, {
          rStart: Math.max(0.028, limbR * (0.46 - tu * 0.2)),
          rEnd: 0.008,
          taperExp: 0.92,
          tubularSegs: 7,
          radialSegs: 5,
          fluteAmp: 0.06,
          fluteCount: 3,
          twistRate: 1.2,
          seed: cfg.seed + i * 31 + tw * 7,
          colBase: 0x565b69,
          colMid: 0x737b8e,
          colTip: 0x9aa6bd,
        })
      );
    }
  }

  // Crown fork at top of trunk
  const topOrigin = trunkCurve.getPoint(0.96);
  for (let k = 0; k < 2; k++) {
    const kAz = (k === 0 ? 0.5 : -2.2) + (rng() - 0.5) * 0.5;
    const kLen = 1.05 + rng() * 0.45;
    const kPts = [
      topOrigin.clone(),
      new THREE.Vector3(
        topOrigin.x + Math.cos(kAz) * kLen * 0.52,
        topOrigin.y + 0.52 + rng() * 0.2,
        topOrigin.z + Math.sin(kAz) * kLen * 0.52
      ),
      new THREE.Vector3(
        topOrigin.x + Math.cos(kAz) * kLen,
        topOrigin.y + 0.92 + rng() * 0.35,
        topOrigin.z + Math.sin(kAz) * kLen
      ),
    ];
    parts.push(
      createTaperedCurveTube(THREE, kPts, {
        rStart: baseR * 0.18,
        rEnd: 0.009,
        tubularSegs: 8,
        radialSegs: 5,
        fluteAmp: 0.07,
        seed: cfg.seed + 91 + k * 13,
        colBase: 0x5b6070,
        colMid: 0x7a8396,
        colTip: 0xa2afc4,
      })
    );
  }

  return mergeGeometries(THREE, parts, true);
}

// ---------------------------------------------------------------------------
// Sculpted Procedural Builder 2: 5 Ancient Weathered Tombstone Archetypes
// (Custom beveled ExtrudeGeometry, recessed niches, carved relief crosses, chips)
// ---------------------------------------------------------------------------

/** Archetype A: Gothic Pointed-Arch Headstone with recessed lancet niche & chipped corner */
function buildGothicHeadstoneGeo(THREE) {
  const parts = [];

  // Two-tier stepped weathered plinth
  const plinthBot = new THREE.BoxGeometry(1.18, 0.16, 0.48);
  plinthBot.translate(0, 0.08, 0);
  parts.push(plinthBot);

  const plinthTop = new THREE.BoxGeometry(0.96, 0.13, 0.36);
  plinthTop.translate(0, 0.225, 0);
  parts.push(plinthTop);

  // Main Gothic lancet arch slab with weathered shoulder notch
  const slabShape = new THREE.Shape();
  slabShape.moveTo(-0.40, 0);
  slabShape.lineTo(0.40, 0);
  slabShape.lineTo(0.39, 0.94);
  // Subtle eroded stone chip on right shoulder
  slabShape.lineTo(0.32, 1.02);
  slabShape.lineTo(0.36, 1.12);
  slabShape.quadraticCurveTo(0.33, 1.46, 0.0, 1.66);
  slabShape.quadraticCurveTo(-0.35, 1.46, -0.39, 1.08);
  slabShape.closePath();

  const slabGeo = new THREE.ExtrudeGeometry(slabShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.024,
    bevelSegments: 2,
    curveSegments: 10,
  });
  slabGeo.translate(0, 0.28, -0.09);
  parts.push(slabGeo);

  // Raised carved Gothic arch molding frame & relief cross on front face (+Z)
  const crossV = new THREE.BoxGeometry(0.065, 0.46, 0.035);
  crossV.translate(0, 1.24, 0.12);
  parts.push(crossV);

  const crossH = new THREE.BoxGeometry(0.28, 0.062, 0.035);
  crossH.translate(0, 1.33, 0.12);
  parts.push(crossH);

  // Carved weathered inscription relief bands
  for (let row = 0; row < 3; row++) {
    const rw = row === 2 ? 0.34 : 0.48;
    const lineGeo = new THREE.BoxGeometry(rw, 0.028, 0.022);
    lineGeo.translate(row === 2 ? -0.04 : 0, 0.84 - row * 0.11, 0.115);
    parts.push(lineGeo);
  }

  const merged = mergeGeometries(THREE, parts, true);
  colorizeStoneGeometry(THREE, merged, {
    baseHex: 0x7b899e,
    mossHex: 0x3a4d50,
    moonHex: 0xb6c7de,
    minY: 0,
    maxY: 1.96,
    seed: 11.4,
  });
  return merged;
}

/** Archetype B: Haloed Celtic / Gothic Carved Stone Cross on stepped pedestal */
function buildGothicCrossGeo(THREE) {
  const parts = [];

  const step1 = new THREE.BoxGeometry(1.10, 0.18, 0.84);
  step1.translate(0, 0.09, 0);
  parts.push(step1);

  const step2 = new THREE.BoxGeometry(0.76, 0.16, 0.62);
  step2.translate(0, 0.26, 0);
  parts.push(step2);

  // Tapered beveled cross silhouette via ExtrudeGeometry
  const crossShape = new THREE.Shape();
  crossShape.moveTo(-0.16, 0);
  crossShape.lineTo(0.16, 0);
  crossShape.lineTo(0.12, 1.18);
  // Right cross arm (flared Gothic terminals)
  crossShape.lineTo(0.48, 1.14);
  crossShape.lineTo(0.55, 1.22);
  crossShape.lineTo(0.55, 1.40);
  crossShape.lineTo(0.48, 1.48);
  crossShape.lineTo(0.12, 1.44);
  // Upper crown arm (pointed finial)
  crossShape.lineTo(0.13, 1.82);
  crossShape.lineTo(0.0, 1.98);
  crossShape.lineTo(-0.13, 1.82);
  crossShape.lineTo(-0.12, 1.44);
  // Left cross arm
  crossShape.lineTo(-0.48, 1.48);
  crossShape.lineTo(-0.55, 1.40);
  crossShape.lineTo(-0.55, 1.22);
  crossShape.lineTo(-0.48, 1.14);
  crossShape.lineTo(-0.12, 1.18);
  crossShape.closePath();

  const crossGeo = new THREE.ExtrudeGeometry(crossShape, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.022,
    bevelSegments: 2,
  });
  crossGeo.translate(0, 0.33, -0.075);
  parts.push(crossGeo);

  // Carved Celtic stone ring halo around cross junction
  const haloGeo = new THREE.TorusGeometry(0.28, 0.044, 7, 20);
  haloGeo.translate(0, 1.64, 0);
  parts.push(haloGeo);

  // Center rosette boss
  const bossGeo = new THREE.OctahedronGeometry(0.075, 0);
  bossGeo.scale(1.0, 1.0, 0.55);
  bossGeo.translate(0, 1.64, 0.105);
  parts.push(bossGeo);

  const merged = mergeGeometries(THREE, parts, true);
  colorizeStoneGeometry(THREE, merged, {
    baseHex: 0x8291a8,
    mossHex: 0x3b4e54,
    moonHex: 0xc2d3ea,
    minY: 0,
    maxY: 2.34,
    seed: 23.8,
  });
  return merged;
}

/** Archetype C: Baroque Scroll-Shoulder Round-Arch Antique Stele */
function buildScrolledSteleGeo(THREE) {
  const parts = [];

  const base = new THREE.BoxGeometry(1.12, 0.17, 0.44);
  base.translate(0, 0.085, 0);
  parts.push(base);

  const steleShape = new THREE.Shape();
  steleShape.moveTo(-0.43, 0);
  steleShape.lineTo(0.43, 0);
  steleShape.lineTo(0.42, 0.88);
  // Scrolled baroque right shoulder curving into central dome arch
  steleShape.bezierCurveTo(0.44, 1.06, 0.32, 1.12, 0.26, 1.16);
  steleShape.absarc(0.0, 1.18, 0.26, 0, Math.PI, false);
  // Left scrolled shoulder
  steleShape.bezierCurveTo(-0.32, 1.12, -0.44, 1.06, -0.42, 0.88);
  steleShape.closePath();

  const steleGeo = new THREE.ExtrudeGeometry(steleShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.022,
    bevelSegments: 2,
    curveSegments: 12,
  });
  steleGeo.translate(0, 0.16, -0.08);
  parts.push(steleGeo);

  // Upper carved stone medallion ring + small finial orb
  const medGeo = new THREE.TorusGeometry(0.11, 0.022, 6, 14);
  medGeo.translate(0, 1.24, 0.105);
  parts.push(medGeo);

  const capMold = new THREE.BoxGeometry(0.68, 0.045, 0.24);
  capMold.translate(0, 0.21, 0);
  parts.push(capMold);

  const merged = mergeGeometries(THREE, parts, true);
  colorizeStoneGeometry(THREE, merged, {
    baseHex: 0x738094,
    mossHex: 0x384b4d,
    moonHex: 0xadbdd3,
    minY: 0,
    maxY: 1.62,
    seed: 37.2,
  });
  return merged;
}

/** Archetype D: Fractured / Snapped Tombstone + Fallen Half-Buried Fragment */
function buildBrokenTombstoneGeo(THREE) {
  const parts = [];

  const plinth = new THREE.BoxGeometry(1.04, 0.14, 0.42);
  plinth.translate(0, 0.07, 0);
  parts.push(plinth);

  // Upright jagged snapped stump
  const stumpShape = new THREE.Shape();
  stumpShape.moveTo(-0.38, 0);
  stumpShape.lineTo(0.38, 0);
  stumpShape.lineTo(0.37, 0.56);
  stumpShape.lineTo(0.16, 0.64);
  stumpShape.lineTo(0.02, 0.78);
  stumpShape.lineTo(-0.18, 0.73);
  stumpShape.lineTo(-0.37, 0.94);
  stumpShape.closePath();

  const stumpGeo = new THREE.ExtrudeGeometry(stumpShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 2,
  });
  stumpGeo.translate(0, 0.13, -0.08);
  parts.push(stumpGeo);

  // Snapped upper arch slab lying half-buried beside the plinth
  const brokenTopShape = new THREE.Shape();
  brokenTopShape.moveTo(-0.36, 0.08);
  brokenTopShape.lineTo(-0.14, 0.0);
  brokenTopShape.lineTo(0.08, 0.12);
  brokenTopShape.lineTo(0.34, 0.02);
  brokenTopShape.lineTo(0.34, 0.34);
  brokenTopShape.quadraticCurveTo(0.28, 0.62, 0.0, 0.72);
  brokenTopShape.quadraticCurveTo(-0.30, 0.62, -0.36, 0.32);
  brokenTopShape.closePath();

  const fallenGeo = new THREE.ExtrudeGeometry(brokenTopShape, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.016,
    bevelSegments: 1,
    curveSegments: 8,
  });
  fallenGeo.rotateX(-Math.PI * 0.44);
  fallenGeo.rotateY(0.42);
  fallenGeo.rotateZ(-0.12);
  fallenGeo.translate(0.56, 0.09, 0.38);
  parts.push(fallenGeo);

  const merged = mergeGeometries(THREE, parts, true);
  colorizeStoneGeometry(THREE, merged, {
    baseHex: 0x6f7c90,
    mossHex: 0x37494b,
    moonHex: 0xa3b4ca,
    minY: 0,
    maxY: 1.15,
    seed: 51.6,
    mossHeight: 0.48,
  });
  return merged;
}

/** Archetype E: Weathered Stone Sarcophagus Tomb with slightly ajar gabled lid */
function buildSarcophagusGeo(THREE) {
  const parts = [];

  // Stepped foundation slab
  const foot = new THREE.BoxGeometry(1.48, 0.16, 2.38);
  foot.translate(0, 0.08, 0);
  parts.push(foot);

  // Tapered main stone chest
  const chest = new THREE.BoxGeometry(1.18, 0.64, 2.04);
  chest.translate(0, 0.48, 0);
  parts.push(chest);

  // Decorative side molding pilasters
  for (const sx of [-0.60, 0.60]) {
    for (const sz of [-0.72, 0.0, 0.72]) {
      const pil = new THREE.BoxGeometry(0.06, 0.56, 0.14);
      pil.translate(sx, 0.48, sz);
      parts.push(pil);
    }
  }

  // Pitched gabled stone lid slightly cracked askew for eerie storytelling
  const lidShape = new THREE.Shape();
  lidShape.moveTo(-0.66, 0);
  lidShape.lineTo(0.66, 0);
  lidShape.lineTo(0.62, 0.10);
  lidShape.lineTo(0.0, 0.34);
  lidShape.lineTo(-0.62, 0.10);
  lidShape.closePath();

  const lidGeo = new THREE.ExtrudeGeometry(lidShape, {
    depth: 2.16,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  lidGeo.translate(0, 0.0, -1.08);
  // Subtle skew as if weathered or pried ajar
  lidGeo.rotateY(0.075);
  lidGeo.translate(0.05, 0.80, -0.04);
  parts.push(lidGeo);

  // Relief cross ridge atop gabled lid
  const ridgeCross = new THREE.BoxGeometry(0.09, 0.05, 1.56);
  ridgeCross.rotateY(0.075);
  ridgeCross.translate(0.05, 1.15, -0.04);
  parts.push(ridgeCross);

  const ridgeBar = new THREE.BoxGeometry(0.56, 0.045, 0.09);
  ridgeBar.rotateY(0.075);
  ridgeBar.translate(0.05, 1.06, 0.28);
  parts.push(ridgeBar);

  const merged = mergeGeometries(THREE, parts, true);
  colorizeStoneGeometry(THREE, merged, {
    baseHex: 0x707e94,
    mossHex: 0x35494e,
    moonHex: 0xb1c4dc,
    minY: 0,
    maxY: 1.25,
    seed: 67.3,
    mossHeight: 0.42,
  });
  return merged;
}

// ---------------------------------------------------------------------------
// Sculpted Procedural Builder 3: Gothic Wrought-Iron Cemetery Gate & Fence
// ---------------------------------------------------------------------------
function buildStonePillarGeo(THREE, isMainGate = false) {
  const parts = [];
  const w = isMainGate ? 0.68 : 0.44;
  const h = isMainGate ? 2.65 : 1.92;

  // 2-tier chamfered plinth base
  const base1 = new THREE.BoxGeometry(w * 1.42, 0.24, w * 1.42);
  base1.translate(0, 0.12, 0);
  parts.push(base1);

  const base2 = new THREE.BoxGeometry(w * 1.20, 0.18, w * 1.20);
  base2.translate(0, 0.33, 0);
  parts.push(base2);

  // Main rusticated shaft
  const shaftH = h - 0.52;
  const shaft = new THREE.BoxGeometry(w, shaftH, w);
  shaft.translate(0, 0.42 + shaftH * 0.5, 0);
  parts.push(shaft);

  // Recessed molded Gothic corner pilasters (4 vertical ribs)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const rib = new THREE.BoxGeometry(w * 0.18, shaftH * 0.92, w * 0.18);
      rib.translate(sx * w * 0.44, 0.42 + shaftH * 0.5, sz * w * 0.44);
      parts.push(rib);
    }
  }

  // Overhanging stepped Gothic cornice
  const corn1 = new THREE.BoxGeometry(w * 1.24, 0.12, w * 1.24);
  corn1.translate(0, h - 0.04, 0);
  parts.push(corn1);

  const corn2 = new THREE.BoxGeometry(w * 1.38, 0.10, w * 1.38);
  corn2.translate(0, h + 0.07, 0);
  parts.push(corn2);

  // Sculpted pyramidal Gothic capstone + stone finial
  const capH = isMainGate ? 0.48 : 0.32;
  const cap = new THREE.ConeGeometry(w * 0.88, capH, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(0, h + 0.12 + capH * 0.5, 0);
  parts.push(cap);

  if (isMainGate) {
    // Finial pedestal + Gothic orb + pointed stone tip
    const neck = new THREE.CylinderGeometry(0.08, 0.13, 0.12, 8);
    neck.translate(0, h + 0.12 + capH + 0.04, 0);
    parts.push(neck);

    const orb = new THREE.OctahedronGeometry(0.145, 1);
    orb.scale(1.0, 1.18, 1.0);
    orb.translate(0, h + 0.12 + capH + 0.20, 0);
    parts.push(orb);

    const tip = new THREE.ConeGeometry(0.06, 0.18, 6);
    tip.translate(0, h + 0.12 + capH + 0.38, 0);
    parts.push(tip);
  }

  const merged = mergeGeometries(THREE, parts, true);
  colorizeStoneGeometry(THREE, merged, {
    baseHex: 0x77869c,
    mossHex: 0x394b50,
    moonHex: 0xbdcee6,
    minY: 0,
    maxY: h + 0.9,
    seed: isMainGate ? 81.2 : 92.5,
  });
  return merged;
}

/**
 * Builds a forged Gothic wrought-iron spearhead finial geometry (vertical axis +Y)
 */
function createSpearheadGeo(THREE, scale = 1.0) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.036 * scale, 0.045 * scale);
  s.lineTo(0.018 * scale, 0.085 * scale);
  s.lineTo(0.052 * scale, 0.135 * scale);
  s.lineTo(0.0, 0.28 * scale);
  s.lineTo(-0.052 * scale, 0.135 * scale);
  s.lineTo(-0.018 * scale, 0.085 * scale);
  s.lineTo(-0.036 * scale, 0.045 * scale);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.022 * scale,
    bevelEnabled: true,
    bevelThickness: 0.008 * scale,
    bevelSize: 0.006 * scale,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.011 * scale);
  return geo;
}

/**
 * Builds an openwork wrought-iron fence bay spanning [-span/2, +span/2] along X
 * with low stone curb, horizontal rails, filigree scroll rings, spearhead pickets,
 * and organic weathering bends/gaps.
 */
function buildFenceBayGeos(THREE, span, seed = 1) {
  const rng = createRng(seed);
  const stoneParts = [];
  const ironParts = [];

  // Low weathered stone curb wall (split into 2-3 dressed stone blocks)
  const blockCount = 3;
  const blockW = span / blockCount;
  for (let b = 0; b < blockCount; b++) {
    const bx = -span * 0.5 + (b + 0.5) * blockW;
    const bh = 0.46 + (rng() - 0.5) * 0.07;
    const block = new THREE.BoxGeometry(blockW - 0.03, bh, 0.30);
    block.translate(bx, bh * 0.5, 0);
    stoneParts.push(block);

    // Coping stone ledge
    const cope = new THREE.BoxGeometry(blockW - 0.01, 0.075, 0.36);
    cope.translate(bx, bh + 0.035, 0);
    stoneParts.push(cope);
  }

  // Horizontal forged iron rails (bottom, filigree lower, top)
  const railYs = [0.64, 1.56, 1.88];
  for (const ry of railYs) {
    const rail = new THREE.BoxGeometry(span, 0.044, 0.044);
    rail.translate(0, ry, 0);
    ironParts.push(rail);
  }

  // Vertical pickets + Gothic fleur-de-lis spearheads
  const spacing = 0.27;
  const count = Math.max(4, Math.floor(span / spacing));
  const actualStep = span / count;

  for (let i = 1; i < count; i++) {
    // Occasional ruined missing picket
    if (rng() < 0.08) continue;

    const px = -span * 0.5 + i * actualStep;
    const isMajor = i % 3 === 0;
    const topY = isMajor ? 2.12 : 1.98;
    const picketH = topY - 0.50;
    const bendZ = rng() < 0.18 ? (rng() - 0.5) * 0.14 : (rng() - 0.5) * 0.025;
    const bendX = rng() < 0.15 ? (rng() - 0.5) * 0.09 : 0;

    const bar = new THREE.CylinderGeometry(0.017, 0.020, picketH, 5);
    bar.translate(0, picketH * 0.5, 0);
    bar.rotateZ(bendZ);
    bar.rotateX(bendX);
    bar.translate(px, 0.50, 0);
    ironParts.push(bar);

    // Spearhead finial atop each picket
    const spear = createSpearheadGeo(THREE, isMajor ? 1.05 : 0.84);
    spear.rotateZ(bendZ);
    spear.rotateX(bendX);
    spear.translate(
      px - Math.sin(bendZ) * picketH,
      0.50 + Math.cos(bendZ) * picketH,
      Math.sin(bendX) * picketH
    );
    ironParts.push(spear);

    // Ornamental Gothic forged filigree rings nestled between top & mid rails
    if (i < count - 1) {
      const midX = px + actualStep * 0.5;
      const ring = new THREE.TorusGeometry(actualStep * 0.39, 0.013, 5, 12);
      ring.translate(midX, 1.72, 0);
      ironParts.push(ring);
    }
  }

  // Diagonal gothic cross brace in lower band for structural authenticity
  const diagLen = Math.hypot(span * 0.45, 0.85);
  for (const dir of [-1, 1]) {
    const brace = new THREE.BoxGeometry(diagLen, 0.024, 0.024);
    brace.rotateZ(dir * Math.atan2(0.85, span * 0.45));
    brace.translate(dir * span * 0.24, 1.10, 0);
    ironParts.push(brace);
  }

  const stoneGeo = mergeGeometries(THREE, stoneParts, true);
  colorizeStoneGeometry(THREE, stoneGeo, {
    baseHex: 0x6f7e94,
    mossHex: 0x35484c,
    moonHex: 0xaabbd1,
    minY: 0,
    maxY: 0.65,
    seed: seed * 1.7,
    mossHeight: 0.55,
  });
  const ironGeo = mergeGeometries(THREE, ironParts, true);
  setUniformVertexColor(THREE, ironGeo, 0x36404f, 0.07);
  return { stoneGeo, ironGeo };
}

/**
 * Builds one ornate arched Gothic wrought-iron gate leaf hinged at x = 0 extending to x = dir * width
 */
function buildGateLeafGeo(THREE, width, dir = 1, ruined = false) {
  const parts = [];
  const xStart = 0;
  const xEnd = dir * width;

  // Hinge stile & meeting stile vertical posts
  const hHinge = 1.98;
  const hCenter = 2.68;

  const hingePost = new THREE.CylinderGeometry(0.036, 0.038, hHinge, 6);
  hingePost.translate(xStart, hHinge * 0.5 + 0.12, 0);
  parts.push(hingePost);

  const centerPost = new THREE.CylinderGeometry(0.034, 0.036, hCenter, 6);
  centerPost.translate(xEnd, hCenter * 0.5 + 0.12, 0);
  parts.push(centerPost);

  // Rising Gothic arch top rail built via CatmullRomCurve3
  const archPts = [];
  const archSteps = 6;
  for (let i = 0; i <= archSteps; i++) {
    const t = i / archSteps;
    const x = lerp(xStart, xEnd, t);
    // Graceful S-ogee rise from hinge toward grand central point
    const rise = t * t * (3 - 2 * t) * 0.72 + Math.sin(t * Math.PI) * 0.12;
    archPts.push(new THREE.Vector3(x, hHinge + 0.12 + rise, 0));
  }
  const archCurve = new THREE.CatmullRomCurve3(archPts);
  const topRail = new THREE.TubeGeometry(archCurve, 18, 0.028, 6, false);
  parts.push(topRail);

  // Lower & middle horizontal gate bars
  for (const ry of [0.26, 0.68, 1.56]) {
    const bar = new THREE.BoxGeometry(width, 0.042, 0.042);
    bar.translate(dir * width * 0.5, ry, 0);
    parts.push(bar);
  }

  // Vertical pickets clipped cleanly to arch height + spearhead tips
  const picketCount = 8;
  for (let i = 1; i < picketCount; i++) {
    if (ruined && (i === 5 || i === 6)) continue; // Ruined gap in sagging leaf
    const t = i / picketCount;
    const pt = archCurve.getPoint(t);
    const picketH = pt.y - 0.24;
    const tilt = ruined && i === 4 ? -0.14 : 0;

    const bar = new THREE.CylinderGeometry(0.017, 0.019, picketH, 5);
    bar.translate(0, picketH * 0.5, 0);
    bar.rotateZ(tilt);
    bar.translate(pt.x, 0.24, 0);
    parts.push(bar);

    const spear = createSpearheadGeo(THREE, 0.96);
    spear.rotateZ(tilt);
    spear.translate(pt.x - Math.sin(tilt) * picketH, pt.y + 0.02, 0);
    parts.push(spear);
  }

  // Ornate central Gothic spearhead finial atop meeting stile
  const crownSpear = createSpearheadGeo(THREE, 1.38);
  crownSpear.translate(xEnd, hCenter + 0.14, 0);
  parts.push(crownSpear);

  // Forged iron scroll circles in lower kick band & central emblem
  for (let k = 0; k < 4; k++) {
    const sx = dir * ((k + 0.5) / 4) * width;
    const scrollRing = new THREE.TorusGeometry(0.145, 0.014, 5, 12);
    scrollRing.translate(sx, 0.47, 0);
    parts.push(scrollRing);
  }

  // Large ornamental wrought-iron rosette medallion in center of gate leaf
  const medallion = new THREE.TorusGeometry(0.28, 0.018, 6, 16);
  medallion.translate(dir * width * 0.52, 1.14, 0);
  parts.push(medallion);

  const innerDiamond = new THREE.TorusGeometry(0.16, 0.014, 4, 4);
  innerDiamond.translate(dir * width * 0.52, 1.14, 0);
  parts.push(innerDiamond);

  const merged = mergeGeometries(THREE, parts, true);
  setUniformVertexColor(THREE, merged, 0x353f4e, 0.07);
  return merged;
}

// ---------------------------------------------------------------------------
// Sculpted Procedural Builder 4: Gothic Openwork Wrought-Iron Stone Lantern
// (Stepped stone pedestal + openwork iron cage + upturned eaves roof + spire)
// ---------------------------------------------------------------------------
function buildGothicLanternGeos(THREE) {
  const stoneParts = [];
  const ironParts = [];

  // 1. Sculpted hexagonal stepped stone base & column (y = 0 .. 1.62)
  const plinth1 = new THREE.CylinderGeometry(0.46, 0.54, 0.18, 6);
  plinth1.translate(0, 0.09, 0);
  stoneParts.push(plinth1);

  const plinth2 = new THREE.CylinderGeometry(0.32, 0.41, 0.18, 6);
  plinth2.translate(0, 0.27, 0);
  stoneParts.push(plinth2);

  // Tapered fluted hexagonal stone shaft
  const shaft = new THREE.CylinderGeometry(0.155, 0.215, 0.96, 6);
  shaft.translate(0, 0.84, 0);
  stoneParts.push(shaft);

  // Mid stone collar molding
  const midCollar = new THREE.CylinderGeometry(0.21, 0.21, 0.08, 6);
  midCollar.translate(0, 0.84, 0);
  stoneParts.push(midCollar);

  // Flared corbelled Gothic capital tray
  const trayBot = new THREE.CylinderGeometry(0.36, 0.17, 0.18, 6);
  trayBot.translate(0, 1.41, 0);
  stoneParts.push(trayBot);

  const trayTop = new THREE.CylinderGeometry(0.42, 0.38, 0.11, 6);
  trayTop.translate(0, 1.555, 0);
  stoneParts.push(trayTop);

  // 2. Openwork 6-sided wrought-iron lantern cage (y = 1.61 .. 2.38)
  const cageBaseY = 1.61;
  const cageTopY = 2.36;
  const rBot = 0.29;
  const rTop = 0.34;

  // Lower & upper hexagonal forged iron frame rings
  const ringBot = new THREE.TorusGeometry(rBot, 0.022, 6, 6);
  ringBot.rotateX(Math.PI / 2);
  ringBot.translate(0, cageBaseY + 0.02, 0);
  ironParts.push(ringBot);

  const ringTop = new THREE.TorusGeometry(rTop, 0.026, 6, 6);
  ringTop.rotateX(Math.PI / 2);
  ringTop.translate(0, cageTopY, 0);
  ironParts.push(ringTop);

  // 6 corner slender forged iron ribs + Gothic pointed window arch tracery
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    const aMid = (a0 + a1) * 0.5;

    const pBot = new THREE.Vector3(Math.cos(a0) * rBot, cageBaseY, Math.sin(a0) * rBot);
    const pMid = new THREE.Vector3(Math.cos(a0) * (rBot * 0.4 + rTop * 0.62), (cageBaseY + cageTopY) * 0.5, Math.sin(a0) * (rBot * 0.4 + rTop * 0.62));
    const pTop = new THREE.Vector3(Math.cos(a0) * rTop, cageTopY, Math.sin(a0) * rTop);

    const ribCurve = new THREE.CatmullRomCurve3([pBot, pMid, pTop]);
    ironParts.push(new THREE.TubeGeometry(ribCurve, 8, 0.020, 5, false));

    // Pointed lancet arch mullion spanning between corner i and i+1 near upper cage
    const archStart = new THREE.Vector3(Math.cos(a0) * rTop * 0.96, cageTopY - 0.22, Math.sin(a0) * rTop * 0.96);
    const archApex = new THREE.Vector3(Math.cos(aMid) * rTop * 0.88, cageTopY - 0.02, Math.sin(aMid) * rTop * 0.88);
    const archEnd = new THREE.Vector3(Math.cos(a1) * rTop * 0.96, cageTopY - 0.22, Math.sin(a1) * rTop * 0.96);
    const archCurve = new THREE.CatmullRomCurve3([archStart, archApex, archEnd]);
    ironParts.push(new THREE.TubeGeometry(archCurve, 6, 0.014, 4, false));
  }

  // 3. Sculpted upturned flared Gothic iron eaves cap (custom concave 6-sided pagoda-gothic roof)
  const roofRings = [
    { y: 2.34, r: 0.54, lip: 0.055 }, // upturned flared eaves corners
    { y: 2.43, r: 0.39, lip: 0.022 },
    { y: 2.58, r: 0.23, lip: 0.010 },
    { y: 2.76, r: 0.095, lip: 0.0 },
    { y: 2.92, r: 0.018, lip: 0.0 },
  ];
  const rPos = [];
  const rUv = [];
  const rIdx = [];
  const sides = 12; // 6 corners + 6 recessed mid-facets for crisp upturned Gothic eaves!
  const rStride = sides + 1;

  for (let j = 0; j < roofRings.length; j++) {
    const rr = roofRings[j];
    const v = j / (roofRings.length - 1);
    for (let i = 0; i <= sides; i++) {
      const u = i / sides;
      const theta = u * Math.PI * 2;
      const isCorner = i % 2 === 0;
      const rad = rr.r * (isCorner ? 1.12 : 0.88);
      const yUp = rr.y + (isCorner ? rr.lip : 0);
      // CCW from +Y: x = cos*r, z = -sin*r
      rPos.push(Math.cos(theta) * rad, yUp, -Math.sin(theta) * rad);
      rUv.push(u * 2.0, v);
    }
  }
  for (let j = 0; j < roofRings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const a = j * rStride + i;
      const b = a + 1;
      const c = (j + 1) * rStride + i;
      const d = c + 1;
      rIdx.push(a, b, c);
      rIdx.push(b, d, c);
    }
  }
  const eavesGeo = new THREE.BufferGeometry();
  eavesGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  eavesGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUv, 2));
  eavesGeo.setIndex(rIdx);
  eavesGeo.computeVertexNormals();
  ironParts.push(eavesGeo);

  // Decorative upturned eaves ridge ribs & spire finial
  const finialOrb = new THREE.OctahedronGeometry(0.062, 1);
  finialOrb.translate(0, 2.96, 0);
  ironParts.push(finialOrb);

  const finialNeedle = new THREE.ConeGeometry(0.026, 0.24, 6);
  finialNeedle.translate(0, 3.12, 0);
  ironParts.push(finialNeedle);

  // Small iron saucer inside cage holding the spirit flame
  const flameDish = new THREE.CylinderGeometry(0.13, 0.08, 0.05, 6);
  flameDish.translate(0, cageBaseY + 0.06, 0);
  ironParts.push(flameDish);

  const stoneGeo = mergeGeometries(THREE, stoneParts, true);
  colorizeStoneGeometry(THREE, stoneGeo, {
    baseHex: 0x76859b,
    mossHex: 0x394b50,
    moonHex: 0xb9cbe4,
    minY: 0,
    maxY: 1.65,
    seed: 109.3,
  });
  const ironGeo = mergeGeometries(THREE, ironParts, true);
  setUniformVertexColor(THREE, ironGeo, 0x384354, 0.06);

  return { stoneGeo, ironGeo };
}

// ---------------------------------------------------------------------------
// Sculpted Procedural Builder 5: Weathered Bluestone Path Slabs & Dry Grass
// ---------------------------------------------------------------------------
function buildBluestoneSlabGeo(THREE, variant = 0) {
  const shapes = [
    [[-0.44, -0.32], [0.38, -0.36], [0.50, 0.06], [0.34, 0.36], [-0.28, 0.34], [-0.48, 0.04]],
    [[-0.38, -0.28], [0.42, -0.24], [0.46, 0.18], [0.12, 0.34], [-0.36, 0.26]],
    [[-0.50, -0.22], [0.28, -0.30], [0.52, -0.02], [0.38, 0.28], [-0.18, 0.32], [-0.46, 0.12]],
    [[-0.34, -0.30], [0.32, -0.28], [0.40, 0.14], [-0.04, 0.34], [-0.38, 0.10]],
  ];
  const pts = shapes[variant % shapes.length];
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    sh.lineTo(pts[i][0], pts[i][1]);
  }
  sh.closePath();

  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.011,
    bevelSize: 0.018,
    bevelSegments: 1,
  });
  // Lay flat on XZ plane with top surface strictly near y = 0.018
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.016, 0);

  colorizeStoneGeometry(THREE, geo, {
    baseHex: 0x627086,
    mossHex: 0x3b4d52,
    moonHex: 0x8fa1ba,
    minY: -0.03,
    maxY: 0.025,
    seed: 201 + variant * 17.3,
    mossHeight: 0.25,
  });
  return geo;
}

function buildWitheredGrassTuftGeo(THREE) {
  const parts = [];
  const bladeCount = 6;
  const cRoot = new THREE.Color(0x212936);
  const cMid = new THREE.Color(0x524c48);
  const cTip = new THREE.Color(0x88847a);
  const tmp = new THREE.Color();

  for (let b = 0; b < bladeCount; b++) {
    const ang = (b / bladeCount) * Math.PI * 2 + (b % 2) * 0.24;
    const h = 0.34 + hash2(b * 3.1, 7.2) * 0.32;
    const w = 0.048 + hash2(b * 5.3, 2.1) * 0.024;
    const arch = 0.14 + hash2(b * 2.7, 9.4) * 0.18;
    const segs = 3;

    const pos = [];
    const uv = [];
    const col = [];
    const idx = [];
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz;
    const pz = dx;
    const offsetR = 0.04 + (b % 3) * 0.03;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const bw = w * (1.0 - t * 0.88);
      const bend = arch * t * t;
      const cx = dx * (offsetR + bend);
      const cz = dz * (offsetR + bend);
      const cy = h * t;

      pos.push(cx - px * bw, cy, cz - pz * bw);
      pos.push(cx + px * bw, cy, cz + pz * bw);
      uv.push(0, t, 1, t);

      if (t < 0.5) tmp.copy(cRoot).lerp(cMid, t * 2);
      else tmp.copy(cMid).lerp(cTip, (t - 0.5) * 2);
      col.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 2;
      const c = a + 1;
      const b2 = a + 2;
      const d = a + 3;
      idx.push(a, c, b2, c, d, b2);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push(g);
  }

  return mergeGeometries(THREE, parts, true);
}

/**
 * Adds gentle autumn-night breeze sway to instanced dry grass & gnarled twigs
 */
function attachGrassBreeze(material, windUniform) {
  material.customProgramCacheKey = () => 'graveyard_grass_breeze_v1';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader =
      `uniform float uWindTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float gH = max(0.0, position.y);
        float gSeed = 0.0;
        #ifdef USE_INSTANCING
          gSeed = instanceMatrix[3].x * 0.47 + instanceMatrix[3].z * 0.33;
        #endif
        float gWave = sin(uWindTime * 1.45 + gSeed) + 0.35 * sin(uWindTime * 2.9 + gSeed * 1.7);
        transformed.x += gWave * gH * gH * 0.16;
        transformed.z += cos(uWindTime * 1.1 + gSeed) * gH * gH * 0.09;`
      );
  };
}

// ---------------------------------------------------------------------------
// Main Biome Builder Export (Sole Top-Level Export)
// ---------------------------------------------------------------------------
export function buildGraveyardBiome(THREE, texLib = {}) {
  const group = new THREE.Group();
  group.name = 'biome_graveyard_autumn_night';

  const trackedGeos = [];
  const trackedMats = [];
  const trackedTextures = [];

  const trackGeo = (g) => {
    trackedGeos.push(g);
    return g;
  };
  const trackMat = (m) => {
    trackedMats.push(m);
    return m;
  };

  const windUniform = { value: 0 };
  const moonDirWorld = new THREE.Vector3(7.8, 3.15, -46.0);
  const moonDirNorm = new THREE.Vector3(0.24, 0.24, -0.94).normalize();

  // Resolve shared soft glow disc texture
  const glowDiscTex =
    resolveSingleTex(texLib.softGlowDisc) || createFallbackGlowTexture(THREE, trackedTextures);

  // =========================================================================
  // 1. MOONLIT AUTUMN NIGHT SKY DOME + LOW CRATERED FULL MOON & LUNAR CORONA
  // =========================================================================
  const skyGeo = trackGeo(new THREE.SphereGeometry(92, 40, 24));
  const skyUniforms = {
    uTime: { value: 0 },
    uMoonDir: { value: moonDirWorld.clone().normalize() },
    uHorizonCol: { value: new THREE.Color(0x2f456e) },
    uMidSkyCol: { value: new THREE.Color(0x1a2c54) },
    uZenithCol: { value: new THREE.Color(0x0c1630) },
    uMoonGlowCol: { value: new THREE.Color(0x9ec4ff) },
    uCloudCol: { value: new THREE.Color(0x526e9e) },
    uBelowHorizonCol: { value: new THREE.Color(0x1d2b48) },
  };
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uMoonDir;
        uniform vec3 uHorizonCol;
        uniform vec3 uMidSkyCol;
        uniform vec3 uZenithCol;
        uniform vec3 uMoonGlowCol;
        uniform vec3 uCloudCol;
        uniform vec3 uBelowHorizonCol;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 41.3);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * vnoise(p);
            p = r * p * 2.03;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vDir);
          // Shift effective sky horizon subtly down so the -15.5 deg combat camera
          // frames the indigo zenith gradient, drifting night clouds, and moonlit mist band
          float h = clamp((dir.y + 0.085) * 1.45, 0.0, 1.0);

          vec3 sky = mix(uHorizonCol, uMidSkyCol, smoothstep(0.0, 0.28, h));
          sky = mix(sky, uZenithCol, smoothstep(0.22, 0.82, h));

          // Soft moon atmospheric scatter across the nocturnal sky dome
          float mDot = max(dot(dir, normalize(uMoonDir)), 0.0);
          sky += uMoonGlowCol * (pow(mDot, 4.5) * 0.22 + pow(mDot, 20.0) * 0.24);

          // Delicate silver mist band hugging the horizon
          float hBand = exp(-abs(dir.y + 0.03) * 16.0);
          sky = mix(sky, uHorizonCol * 1.18, hBand * 0.42);

          // Subtle twinkling autumn stars in clear upper dark sky
          if (h > 0.08) {
            vec2 starCell = floor(dir.xz / max(0.18, dir.y + 0.28) * 34.0);
            float sRnd = hash21(starCell);
            if (sRnd > 0.968) {
              vec2 starLocal = fract(dir.xz / max(0.18, dir.y + 0.28) * 34.0) - 0.5;
              float dist = length(starLocal);
              float twinkle = 0.55 + 0.45 * sin(uTime * (1.8 + sRnd * 3.0) + sRnd * 50.0);
              float starPt = smoothstep(0.14, 0.01, dist) * twinkle * smoothstep(0.08, 0.30, h);
              sky += vec3(0.76, 0.88, 1.0) * starPt * 0.55;
            }
          }

          // Thin drifting nocturnal autumn cloud veils silvered near the moon
          if (dir.y > -0.07) {
            vec2 cUv = dir.xz / (dir.y + 0.32) * 1.05 + vec2(uTime * 0.006, -uTime * 0.0025);
            float c1 = fbm(cUv * 1.45);
            float c2 = fbm(cUv * 2.85 + vec2(4.1, -2.3));
            float veil = smoothstep(0.47, 0.78, c1 * 0.65 + c2 * 0.35);
            veil *= smoothstep(-0.07, 0.06, dir.y) * (1.0 - smoothstep(0.55, 0.92, dir.y) * 0.5);
            vec3 cloudCol = mix(uCloudCol * 0.78, uMoonGlowCol * 0.96, pow(mDot, 2.8) * 0.80);
            sky = mix(sky, cloudCol, veil * 0.46);
          }

          if (dir.y < -0.08) {
            sky = mix(uHorizonCol, uBelowHorizonCol, smoothstep(-0.08, -0.34, dir.y));
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
  );
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'graveyard_night_sky_dome';
  skyMesh.renderOrder = -10;
  group.add(skyMesh);

  // Soft Lunar Corona Halo (behind full moon disc, facing camera)
  const moonHaloGeo = trackGeo(new THREE.PlaneGeometry(17.2, 17.2));
  const moonHaloUniforms = {
    uTime: { value: 0 },
    uHaloColor: { value: new THREE.Color(0x9bc4ff) },
  };
  const moonHaloMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: moonHaloUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uHaloColor;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float pulse = 0.94 + 0.06 * sin(uTime * 0.55);
          float inner = exp(-r * r * 6.5) * 0.44;
          float outer = exp(-r * r * 1.9) * 0.24;
          float edge = 1.0 - smoothstep(0.76, 1.0, r);
          float a = (inner + outer) * edge * pulse;
          gl_FragColor = vec4(uHaloColor, a);
        }
      `,
    })
  );
  const moonHaloMesh = new THREE.Mesh(moonHaloGeo, moonHaloMat);
  moonHaloMesh.name = 'graveyard_moon_corona';
  moonHaloMesh.position.set(moonDirWorld.x, moonDirWorld.y, moonDirWorld.z - 0.6);
  moonHaloMesh.lookAt(0, 5.3, 14.2);
  moonHaloMesh.renderOrder = -9;
  group.add(moonHaloMesh);

  // Sculpted Cratered Silver-White Full Moon Disc (calibrated <= 0.88 peak luminance to prevent bloom blowout)
  const moonDiscGeo = trackGeo(new THREE.CircleGeometry(2.65, 48));
  const moonDiscUniforms = {
    uTime: { value: 0 },
  };
  const moonDiscMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: moonDiscUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm(vec2 p) {
          float s = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            s += a * vnoise(p);
            p *= 2.08;
            a *= 0.5;
          }
          return s;
        }

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;

          // Spherical projection for authentic curved lunar maria craters
          float z = sqrt(max(0.0, 1.0 - r * r));
          vec2 sphereUv = p / (0.65 + z * 0.45);
          float mariaLarge = fbm(sphereUv * 2.4 + vec2(1.7, -0.9));
          float mariaDetail = fbm(sphereUv * 6.5 - vec2(2.3, 1.4));
          float craters = smoothstep(0.36, 0.72, mariaLarge * 0.72 + mariaDetail * 0.28);

          // Crisp silver-ivory lunar disc with subtle cool-slate maria seas
          vec3 colHighland = vec3(0.86, 0.90, 0.96);
          vec3 colMaria = vec3(0.56, 0.65, 0.79);
          vec3 col = mix(colMaria, colHighland, craters);

          // Gentle spherical limb shading + delicate backlit rim
          float limb = 0.78 + 0.22 * pow(z, 0.55);
          float rim = pow(1.0 - z, 3.0) * 0.14;
          col = col * limb + vec3(0.75, 0.88, 1.0) * rim;

          // Subtle passing thin night mist wisp across lower lunar edge
          float wisp = fbm(vec2(p.x * 2.2 + uTime * 0.028, p.y * 3.1)) * smoothstep(0.35, -0.95, p.y);
          col = mix(col, vec3(0.30, 0.44, 0.68), wisp * 0.34);

          float alpha = 1.0 - smoothstep(0.955, 1.0, r);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );
  const moonDiscMesh = new THREE.Mesh(moonDiscGeo, moonDiscMat);
  moonDiscMesh.name = 'graveyard_full_moon';
  moonDiscMesh.position.copy(moonDirWorld);
  moonDiscMesh.lookAt(0, 5.3, 14.2);
  moonDiscMesh.renderOrder = -8;
  group.add(moonDiscMesh);

  // =========================================================================
  // 2. SCULPTED GRAVEYARD TERRAIN + WEATHERED BLUESTONE PATH & DRY GRASS
  // =========================================================================
  const terrainW = 78;
  const terrainD = 62;
  const terrainGeo = trackGeo(new THREE.PlaneGeometry(terrainW, terrainD, 156, 124));
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, -5);

  const tPos = terrainGeo.attributes.position;
  const tCol = new Float32Array(tPos.count * 3);

  const colMoonClearing = new THREE.Color(0x5b6a82);
  const colEarthPath = new THREE.Color(0x4b5362);
  const colMossySoil = new THREE.Color(0x313e4c);
  const colDryGrass = new THREE.Color(0x534c43);
  const colDeepShadow = new THREE.Color(0x1f2a3e);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    const y = getTerrainHeight(x, z);
    tPos.setY(i, y);

    const nPatch = fbm2D(x * 0.22 + 3.4, z * 0.22 - 1.9, 3);
    const nGrass = fbm2D(x * 0.41 - 5.2, z * 0.39 + 4.3, 2);

    // Clear moonlit slate-earth inside combat arena so pixel sprites read with razor contrast
    const inClearing = 1.0 - smoothstep(5.8, 10.5, Math.hypot(x * 0.85, z * 1.48));
    tmpColor.copy(colMossySoil).lerp(colEarthPath, 0.38 + 0.62 * inClearing);

    // Subtle cool moon-silver illumination pool across central arena & gate path
    const moonPool = 1.0 - smoothstep(0.0, 8.2, Math.hypot(x - 0.6, z + 0.8));
    tmpColor.lerp(colMoonClearing, moonPool * 0.56);

    // Withered autumn dry-grass & ochre dirt patches around outer clearing & burial mounds
    const outerGrassMask = (1.0 - inClearing * 0.82) * smoothstep(0.42, 0.72, nGrass);
    tmpColor.lerp(colDryGrass, outerGrassMask * 0.58);

    // Deep atmospheric indigo shade on distant hills & outer perimeter hollows
    const farFade = smoothstep(10.5, 25.0, Math.hypot(x * 0.72, z + 3.0));
    tmpColor.lerp(colDeepShadow, farFade * 0.65);

    const micro = (nPatch - 0.5) * 0.06;
    tCol[i * 3] = clamp(tmpColor.r + micro, 0, 1);
    tCol[i * 3 + 1] = clamp(tmpColor.g + micro, 0, 1);
    tCol[i * 3 + 2] = clamp(tmpColor.b + micro * 0.8, 0, 1);
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  terrainGeo.computeVertexNormals();

  const groundTexBundle = resolveTexBundle(THREE, texLib.snowGround, 14, 11, trackedTextures);
  const fallbackSoilTex = groundTexBundle.map ? null : createProceduralSoilTexture(THREE, trackedTextures);
  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.90,
      metalness: 0.04,
      ...(groundTexBundle.map
        ? { map: groundTexBundle.map }
        : fallbackSoilTex
          ? { map: fallbackSoilTex }
          : {}),
      ...(groundTexBundle.normalMap
        ? { normalMap: groundTexBundle.normalMap, normalScale: new THREE.Vector2(0.55, 0.55) }
        : {}),
      ...(groundTexBundle.bumpMap ? { bumpMap: groundTexBundle.bumpMap, bumpScale: 0.08 } : {}),
    })
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'graveyard_autumn_terrain';
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Subtle moonlight floor sheen pool (flush y = 0.006, ultra-gentle, non-blocking)
  let arenaMoonPoolMat = null;
  if (glowDiscTex) {
    const poolGeo = trackGeo(new THREE.PlaneGeometry(13.6, 6.8));
    poolGeo.rotateX(-Math.PI / 2);
    arenaMoonPoolMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: glowDiscTex,
        color: 0x8fb8ff,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const poolMesh = new THREE.Mesh(poolGeo, arenaMoonPoolMat);
    poolMesh.position.set(0.35, 0.006, -0.2);
    group.add(poolMesh);
  }

  // Shared PBR Materials: Weathered Cemetery Stone, Dark Forged Iron, Gnarled Dead Bark
  const stoneTex = resolveTexBundle(THREE, texLib.courtyardStone, 2, 2, trackedTextures);
  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: stoneTex.roughnessMap ? 0.92 : 0.84,
      metalness: 0.05,
      ...(stoneTex.map ? { map: stoneTex.map } : {}),
      ...(stoneTex.normalMap
        ? { normalMap: stoneTex.normalMap, normalScale: new THREE.Vector2(0.72, 0.72) }
        : {}),
      ...(stoneTex.bumpMap ? { bumpMap: stoneTex.bumpMap, bumpScale: 0.09 } : {}),
      ...(stoneTex.roughnessMap ? { roughnessMap: stoneTex.roughnessMap } : {}),
    })
  );

  const ironMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd0dcee,
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.72,
    })
  );

  const barkTex = resolveTexBundle(THREE, texLib.darkBark, 2, 4, trackedTextures);
  const barkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: barkTex.roughnessMap ? 0.94 : 0.88,
      metalness: 0.04,
      ...(barkTex.map ? { map: barkTex.map } : {}),
      ...(barkTex.normalMap
        ? { normalMap: barkTex.normalMap, normalScale: new THREE.Vector2(0.85, 0.85) }
        : {}),
      ...(barkTex.bumpMap ? { bumpMap: barkTex.bumpMap, bumpScale: 0.12 } : {}),
      ...(barkTex.roughnessMap ? { roughnessMap: barkTex.roughnessMap } : {}),
    })
  );

  // Flush Weathered Bluestone Flagstone Ruined Path (4 custom beveled polygon archetypes)
  const slabGeos = [0, 1, 2, 3].map((v) => trackGeo(buildBluestoneSlabGeo(THREE, v)));
  const slabPlacements = [
    // East-West worn bluestone combat path across y = 0 clearing (flush <= 0.022)
    [-5.8, 0.85, 1.15, 0.96, 0.18, 0],
    [-4.6, 0.55, 1.24, 1.05, -0.22, 2],
    [-3.4, 0.72, 1.10, 0.92, 0.34, 1],
    [-2.2, 0.38, 1.28, 1.04, -0.14, 0],
    [-1.1, 0.58, 1.02, 0.94, 0.42, 3],
    [0.05, 0.24, 1.32, 1.08, -0.08, 2],
    [1.25, 0.48, 1.16, 0.96, 0.25, 1],
    [2.45, 0.18, 1.25, 1.02, -0.30, 0],
    [3.65, 0.52, 1.08, 0.90, 0.14, 3],
    [4.85, 0.28, 1.22, 1.00, -0.19, 2],
    [5.95, 0.62, 1.06, 0.88, 0.48, 1],
    // Broken outer stones hinting at ancient courtyard cross-walk
    [-4.1, -1.15, 0.92, 0.84, 0.62, 3],
    [-2.6, -1.55, 1.05, 0.88, -0.44, 1],
    [2.1, -1.42, 0.98, 0.86, 0.38, 0],
    [4.2, -1.20, 0.94, 0.82, -0.52, 3],
    [-1.4, 1.85, 0.96, 0.84, 0.22, 1],
    [1.6, 1.72, 1.02, 0.86, -0.35, 2],
    // North-bound graveyard path leading from clearing straight through the Gothic iron gate
    [-0.45, -1.15, 1.18, 1.02, 0.12, 2],
    [0.52, -1.85, 1.12, 0.96, -0.28, 0],
    [-0.38, -2.65, 1.24, 1.04, 0.08, 1],
    [0.44, -3.45, 1.15, 0.98, -0.18, 2],
    [-0.32, -4.35, 1.22, 1.02, 0.24, 0],
    [0.36, -5.25, 1.16, 0.98, -0.12, 3],
    [-0.25, -6.18, 1.26, 1.04, 0.19, 2],
    [0.28, -7.12, 1.18, 1.00, -0.25, 1],
    [-0.18, -8.05, 1.32, 1.06, 0.06, 0],
    [0.14, -8.95, 1.36, 1.10, -0.09, 2],
    [-0.28, -9.90, 1.20, 0.98, 0.31, 1],
    [0.32, -10.85, 1.14, 0.94, -0.22, 3],
    // Scattered cracked stepping slabs toward flanking lanterns
    [-6.6, -1.8, 0.96, 0.84, 0.55, 3],
    [6.7, -2.1, 0.98, 0.86, -0.48, 1],
  ];

  const dummy = new THREE.Object3D();
  for (let v = 0; v < slabGeos.length; v++) {
    const items = slabPlacements.filter((p) => p[5] === v);
    if (!items.length) continue;
    const inst = new THREE.InstancedMesh(slabGeos[v], stoneMat, items.length);
    inst.receiveShadow = true;
    for (let i = 0; i < items.length; i++) {
      const [sx, sz, scx, scz, ry] = items[i];
      const sy = getTerrainHeight(sx, sz);
      // Compute gentle ground pitch outside arena so slabs hug slopes naturally
      const slopeZ =
        Math.abs(sx) <= 7.0 && sz >= -3.3 && sz <= 3.3
          ? 0
          : Math.atan2(getTerrainHeight(sx, sz - 0.4) - getTerrainHeight(sx, sz + 0.4), 0.8);
      dummy.position.set(sx, sy + 0.008, sz);
      dummy.rotation.set(slopeZ, ry, 0);
      dummy.scale.set(scx, 1.0, scz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    group.add(inst);
  }

  // =========================================================================
  // 3. SCULPTED LEANING TOMBSTONES, GOTHIC CROSSES & EARTHEN BURIAL MOUNDS
  // (Strictly outside combat clearing: z < -3.8 rear ranks & |x| > 7.4 flanks)
  // =========================================================================
  const graveGeos = {
    gothic: trackGeo(buildGothicHeadstoneGeo(THREE)),
    cross: trackGeo(buildGothicCrossGeo(THREE)),
    scrolled: trackGeo(buildScrolledSteleGeo(THREE)),
    broken: trackGeo(buildBrokenTombstoneGeo(THREE)),
    sarcophagus: trackGeo(buildSarcophagusGeo(THREE)),
  };

  // Sculpted low earthen burial mound geometry for fresh/old graves
  const moundGeoRaw = new THREE.SphereGeometry(0.68, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const mp = moundGeoRaw.attributes.position;
  const mc = new Float32Array(mp.count * 3);
  const cMoundDark = new THREE.Color(0x28313f);
  const cMoundTop = new THREE.Color(0x475162);
  const cMTmp = new THREE.Color();
  for (let i = 0; i < mp.count; i++) {
    const vx = mp.getX(i);
    const vy = mp.getY(i);
    const vz = mp.getZ(i);
    const jitter = 0.88 + 0.24 * hash2(vx * 5.7 + vy * 3.1, vz * 4.9);
    mp.setXYZ(i, vx * 0.92 * jitter, vy * 0.42 * jitter, vz * 1.48 * jitter);
    cMTmp.copy(cMoundDark).lerp(cMoundTop, smoothstep(0.0, 0.28, vy * 0.42));
    mc[i * 3] = cMTmp.r;
    mc[i * 3 + 1] = cMTmp.g;
    mc[i * 3 + 2] = cMTmp.b;
  }
  moundGeoRaw.setAttribute('color', new THREE.BufferAttribute(mc, 3));
  moundGeoRaw.computeVertexNormals();
  const moundGeo = trackGeo(moundGeoRaw);

  // Curated cinematic placement: organic leaning angles (-8° ~ +10° => -0.14 ~ +0.175 rad),
  // clear central gate avenue, and framed moon corridor!
  const graveSpecs = [
    // Mid-rear rank (z = -4.2 ~ -7.6)
    { type: 'gothic', x: -3.2, z: -4.45, ry: 0.14, rz: 0.11, rx: 0.04, s: 1.05, mound: true },
    { type: 'cross', x: -5.4, z: -5.35, ry: 0.22, rz: -0.09, rx: 0.03, s: 1.08, mound: true },
    { type: 'broken', x: -1.85, z: -5.95, ry: 0.08, rz: 0.13, rx: -0.03, s: 1.00, mound: false },
    { type: 'scrolled', x: -4.15, z: -7.15, ry: 0.18, rz: -0.12, rx: 0.05, s: 1.04, mound: true },
    { type: 'gothic', x: -6.85, z: -6.90, ry: 0.34, rz: 0.14, rx: 0.04, s: 1.12, mound: true },

    { type: 'scrolled', x: 3.15, z: -4.60, ry: -0.16, rz: -0.10, rx: 0.04, s: 1.04, mound: true },
    { type: 'cross', x: 5.35, z: -5.25, ry: -0.24, rz: 0.12, rx: 0.03, s: 1.10, mound: true },
    { type: 'gothic', x: 2.05, z: -6.35, ry: -0.10, rz: 0.08, rx: -0.02, s: 1.02, mound: true },
    { type: 'broken', x: 4.35, z: -7.10, ry: -0.20, rz: -0.13, rx: 0.05, s: 1.02, mound: false },
    { type: 'gothic', x: 6.95, z: -6.65, ry: -0.32, rz: -0.08, rx: 0.03, s: 1.08, mound: true },

    // Left & right side-wing graves (|x| > 7.6, framing combat clearing without obstructing fighters)
    { type: 'scrolled', x: -8.6, z: -1.15, ry: 0.85, rz: 0.13, rx: 0.04, s: 1.02, mound: true },
    { type: 'broken', x: -9.4, z: 1.25, ry: 1.05, rz: -0.11, rx: 0.03, s: 0.96, mound: false },
    { type: 'cross', x: -10.4, z: -3.85, ry: 0.58, rz: -0.07, rx: 0.02, s: 1.18, mound: true },
    { type: 'sarcophagus', x: -9.8, z: -6.45, ry: 0.42, rz: 0.02, rx: 0.0, s: 1.02, mound: false },
    { type: 'gothic', x: -12.1, z: -5.8, ry: 0.48, rz: 0.15, rx: 0.04, s: 1.14, mound: true },

    { type: 'gothic', x: 8.85, z: -1.25, ry: -0.78, rz: -0.12, rx: 0.04, s: 1.04, mound: true },
    { type: 'broken', x: 9.55, z: 1.10, ry: -1.02, rz: 0.14, rx: 0.02, s: 0.95, mound: false },
    { type: 'cross', x: 10.6, z: -4.15, ry: -0.56, rz: 0.10, rx: 0.03, s: 1.15, mound: true },
    { type: 'sarcophagus', x: 10.2, z: -7.15, ry: -0.38, rz: -0.02, rx: 0.0, s: 1.00, mound: false },
    { type: 'scrolled', x: 12.4, z: -6.10, ry: -0.45, rz: -0.14, rx: 0.04, s: 1.10, mound: true },

    // Deep-rear graveyard silhouettes beyond the wrought-iron fence (z = -10.8 ~ -16.2)
    { type: 'cross', x: -3.4, z: -11.6, ry: 0.12, rz: -0.11, rx: 0.03, s: 1.24, mound: true },
    { type: 'gothic', x: -7.8, z: -12.2, ry: 0.25, rz: 0.14, rx: 0.04, s: 1.18, mound: false },
    { type: 'scrolled', x: -11.2, z: -13.5, ry: 0.32, rz: -0.09, rx: 0.02, s: 1.20, mound: false },
    { type: 'gothic', x: -1.2, z: -14.2, ry: 0.06, rz: 0.10, rx: 0.03, s: 1.16, mound: true },
    { type: 'broken', x: 2.6, z: -12.1, ry: -0.15, rz: -0.13, rx: 0.04, s: 1.14, mound: false },
    { type: 'cross', x: 5.8, z: -13.4, ry: -0.22, rz: 0.12, rx: 0.03, s: 1.22, mound: true },
    { type: 'scrolled', x: 9.2, z: -13.8, ry: -0.28, rz: -0.10, rx: 0.02, s: 1.14, mound: false },
    { type: 'gothic', x: 13.8, z: -12.8, ry: -0.36, rz: 0.15, rx: 0.04, s: 1.20, mound: false },
  ];

  // Build InstancedMeshes grouped by tombstone archetype for crisp shadows & minimal draw calls
  const moundPositions = [];
  for (const typeKey of Object.keys(graveGeos)) {
    const list = graveSpecs.filter((g) => g.type === typeKey);
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(graveGeos[typeKey], stoneMat, list.length);
    inst.name = `graveyard_monuments_${typeKey}`;
    inst.castShadow = true;
    inst.receiveShadow = true;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      const gy = getTerrainHeight(g.x, g.z);
      dummy.position.set(g.x, gy - 0.04, g.z);
      dummy.rotation.set(g.rx, g.ry, g.rz);
      dummy.scale.set(g.s, g.s, g.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      if (g.mound) {
        // Place earthen burial mound directly in front of headstone along its facing vector
        const fx = Math.sin(g.ry);
        const fz = Math.cos(g.ry);
        moundPositions.push({
          x: g.x + fx * 1.05,
          z: g.z + fz * 1.05,
          ry: g.ry,
          s: g.s * 0.92,
        });
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    group.add(inst);
  }

  // Instanced burial mounds in front of tombstones
  if (moundPositions.length) {
    const moundInst = new THREE.InstancedMesh(moundGeo, terrainMat, moundPositions.length);
    moundInst.name = 'graveyard_burial_mounds';
    moundInst.receiveShadow = true;
    for (let i = 0; i < moundPositions.length; i++) {
      const m = moundPositions[i];
      // Guard: never let a burial mound spill into strict combat flatland z > -3.65 && |x| < 7.45
      if (Math.abs(m.x) < 7.45 && m.z > -3.65) {
        dummy.position.set(0, -10, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
      } else {
        const my = getTerrainHeight(m.x, m.z);
        dummy.position.set(m.x, my - 0.03, m.z);
        dummy.rotation.set(0, m.ry, 0);
        dummy.scale.set(m.s, m.s, m.s);
      }
      dummy.updateMatrix();
      moundInst.setMatrixAt(i, dummy.matrix);
    }
    moundInst.instanceMatrix.needsUpdate = true;
    moundInst.frustumCulled = false;
    group.add(moundInst);
  }

  // =========================================================================
  // 4. 5 BESPOKE GNARLED CROOKED DEAD TREES & TANGLED EXPOSED ROOTS (歪脖枯木)
  // =========================================================================
  const deadTreeConfigs = [
    {
      // Hero Left-Mid Crooked Tree framing left flank
      name: 'crooked_tree_left_hero',
      x: -8.65,
      z: -4.95,
      ry: 0.32,
      seed: 3101,
      height: 5.9,
      baseR: 0.42,
      leanX: 1.25,
      leanZ: 0.25,
      rootCount: 7,
      limbs: [
        { u: 0.46, az: -0.18, len: 2.65, lift: 0.85, droop: -0.32, rMul: 0.44 },
        { u: 0.56, az: 2.35, len: 2.40, lift: 0.92, droop: -0.22, rMul: 0.40 },
        { u: 0.67, az: -1.45, len: 2.15, lift: 0.78, droop: -0.25, rMul: 0.35 },
        { u: 0.76, az: 0.62, len: 2.35, lift: 1.12, droop: -0.16, rMul: 0.33 },
        { u: 0.85, az: -2.40, len: 1.90, lift: 1.02, droop: 0.04, rMul: 0.28 },
        { u: 0.92, az: 1.55, len: 1.65, lift: 0.88, droop: 0.14, rMul: 0.23 },
      ],
    },
    {
      // Hero Right-Mid Crooked Tree framing right flank (angled outward to keep moon view pristine)
      name: 'crooked_tree_right_hero',
      x: 9.25,
      z: -5.45,
      ry: -0.25,
      seed: 4217,
      height: 5.65,
      baseR: 0.39,
      leanX: -1.10,
      leanZ: -0.18,
      rootCount: 7,
      limbs: [
        { u: 0.48, az: 2.95, len: 2.45, lift: 0.82, droop: -0.28, rMul: 0.43 },
        { u: 0.58, az: 0.52, len: 2.55, lift: 0.95, droop: -0.18, rMul: 0.39 },
        { u: 0.68, az: -1.25, len: 2.10, lift: 0.88, droop: -0.20, rMul: 0.35 },
        { u: 0.78, az: 2.20, len: 2.05, lift: 1.06, droop: -0.12, rMul: 0.31 },
        { u: 0.86, az: -0.45, len: 1.85, lift: 0.96, droop: 0.08, rMul: 0.26 },
        { u: 0.93, az: -2.25, len: 1.50, lift: 0.86, droop: 0.12, rMul: 0.21 },
      ],
    },
    {
      // Rear-Left Ancient Sentinel towering behind the Gothic iron fence
      name: 'crooked_tree_back_left',
      x: -5.75,
      z: -12.6,
      ry: 0.65,
      seed: 5329,
      height: 6.9,
      baseR: 0.46,
      leanX: 1.45,
      leanZ: 0.30,
      rootCount: 6,
      limbs: [
        { u: 0.45, az: 0.12, len: 2.85, lift: 0.95, droop: -0.30, rMul: 0.44 },
        { u: 0.56, az: 2.65, len: 2.60, lift: 1.10, droop: -0.18, rMul: 0.40 },
        { u: 0.68, az: -1.10, len: 2.45, lift: 0.98, droop: -0.22, rMul: 0.36 },
        { u: 0.78, az: 0.88, len: 2.35, lift: 1.18, droop: -0.12, rMul: 0.32 },
        { u: 0.88, az: -2.35, len: 2.00, lift: 1.05, droop: 0.06, rMul: 0.26 },
      ],
    },
    {
      // Rear-Right Moon-Framing Crooked Tree (skeletal boughs reaching near the lunar corona)
      name: 'crooked_tree_back_right',
      x: 13.0,
      z: -11.9,
      ry: -0.42,
      seed: 6451,
      height: 6.5,
      baseR: 0.43,
      leanX: -1.35,
      leanZ: 0.15,
      rootCount: 6,
      limbs: [
        { u: 0.46, az: 2.80, len: 2.75, lift: 0.92, droop: -0.26, rMul: 0.43 },
        { u: 0.58, az: 0.45, len: 2.50, lift: 1.02, droop: -0.18, rMul: 0.39 },
        { u: 0.69, az: -1.50, len: 2.25, lift: 0.90, droop: -0.20, rMul: 0.35 },
        { u: 0.80, az: 2.15, len: 2.15, lift: 1.12, droop: -0.08, rMul: 0.30 },
        { u: 0.90, az: -0.35, len: 1.75, lift: 0.98, droop: 0.10, rMul: 0.24 },
      ],
    },
    {
      // Far-Left Grove Silhouette adding deep hillside enclosure
      name: 'crooked_tree_far_left',
      x: -14.2,
      z: -9.8,
      ry: 1.12,
      seed: 7583,
      height: 6.2,
      baseR: 0.40,
      leanX: 1.05,
      leanZ: -0.25,
      rootCount: 5,
    },
  ];

  for (let i = 0; i < deadTreeConfigs.length; i++) {
    const tc = deadTreeConfigs[i];
    const treeGeo = trackGeo(buildCrookedDeadTreeGeo(THREE, tc));
    const treeMesh = new THREE.Mesh(treeGeo, barkMat);
    treeMesh.name = tc.name;
    const ty = getTerrainHeight(tc.x, tc.z);
    treeMesh.position.set(tc.x, ty - 0.04, tc.z);
    treeMesh.rotation.y = tc.ry;
    treeMesh.castShadow = true;
    treeMesh.receiveShadow = true;
    group.add(treeMesh);
  }

  // =========================================================================
  // 5. RUINED GOTHIC WROUGHT-IRON CEMETERY FENCE & STONE GATE PILLARS (z ≈ -8.8 ~ -11)
  // =========================================================================
  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'graveyard_gothic_fence_gate';
  group.add(fenceGroup);

  const mainGatePillarGeo = trackGeo(buildStonePillarGeo(THREE, true));
  const subPillarGeo = trackGeo(buildStonePillarGeo(THREE, false));

  // Central Monumental Gate Pillars at x = -2.35 and x = +2.35
  const gatePillarXs = [-2.35, 2.35];
  for (let i = 0; i < gatePillarXs.length; i++) {
    const gx = gatePillarXs[i];
    const gz = getFenceCurveZ(gx);
    const gy = getTerrainHeight(gx, gz);
    const pillar = new THREE.Mesh(mainGatePillarGeo, stoneMat);
    pillar.name = i === 0 ? 'gate_pillar_left' : 'gate_pillar_right';
    pillar.position.set(gx, gy - 0.06, gz);
    // Subtle aged settling tilt on right gate pillar
    pillar.rotation.set(i === 1 ? 0.025 : -0.012, i === 0 ? 0.04 : -0.04, i === 1 ? -0.032 : 0.015);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    fenceGroup.add(pillar);
  }

  // Crooked Half-Open Double Wrought-Iron Gates hinged to the central gate pillars
  const leftGateGeo = trackGeo(buildGateLeafGeo(THREE, 2.02, 1, false));
  const leftGateMesh = new THREE.Mesh(leftGateGeo, ironMat);
  leftGateMesh.name = 'graveyard_iron_gate_left';
  const lGateZ = getFenceCurveZ(-2.06);
  leftGateMesh.position.set(-2.06, getTerrainHeight(-2.06, lGateZ) - 0.02, lGateZ);
  leftGateMesh.rotation.set(0.0, 0.56, 0.015); // Swung partly open inward (~32°)
  leftGateMesh.castShadow = true;
  fenceGroup.add(leftGateMesh);

  const rightGateGeo = trackGeo(buildGateLeafGeo(THREE, 2.02, -1, true));
  const rightGateMesh = new THREE.Mesh(rightGateGeo, ironMat);
  rightGateMesh.name = 'graveyard_iron_gate_right';
  const rGateZ = getFenceCurveZ(2.06);
  rightGateMesh.position.set(2.06, getTerrainHeight(2.06, rGateZ) - 0.02, rGateZ);
  rightGateMesh.rotation.set(0.02, -0.34, -0.048); // Sagging & ajar askew (~-19.5°)
  rightGateMesh.castShadow = true;
  fenceGroup.add(rightGateMesh);

  // Intermediate stone piers & wrought-iron fence bays stretching left & right across the perimeter
  const leftPierXs = [-2.35, -6.25, -10.25, -14.25, -18.1];
  const rightPierXs = [2.35, 6.25, 10.25, 14.25, 18.1];

  function buildFenceWing(pierXs, wingSeed) {
    for (let i = 1; i < pierXs.length; i++) {
      const px = pierXs[i];
      const pz = getFenceCurveZ(px);
      const py = getTerrainHeight(px, pz);
      const pier = new THREE.Mesh(subPillarGeo, stoneMat);
      pier.position.set(px, py - 0.08, pz);
      // Organic aged tilt on outer piers (notably pier at x = +10.25 leaning noticeably)
      const leanZ = Math.abs(px - 10.25) < 0.2 ? -0.105 : ((i % 2 === 0 ? 1 : -1) * 0.028);
      pier.rotation.set(0.015, -Math.atan2(getFenceCurveZ(px + 0.5) - getFenceCurveZ(px - 0.5), 1.0), leanZ);
      pier.castShadow = true;
      pier.receiveShadow = true;
      fenceGroup.add(pier);
    }

    for (let i = 0; i < pierXs.length - 1; i++) {
      const x0 = pierXs[i];
      const x1 = pierXs[i + 1];
      const z0 = getFenceCurveZ(x0);
      const z1 = getFenceCurveZ(x1);
      const y0 = getTerrainHeight(x0, z0);
      const y1 = getTerrainHeight(x1, z1);

      const dx = x1 - x0;
      const dz = z1 - z0;
      const span = Math.hypot(dx, dz) - 0.42;
      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;
      const my = (y0 + y1) * 0.5;
      const yaw = -Math.atan2(dz, dx);
      const pitchZ = Math.atan2(y1 - y0, Math.hypot(dx, dz)) * (dx >= 0 ? 1 : -1);

      const bay = buildFenceBayGeos(THREE, Math.max(2.2, span), wingSeed + i * 37);
      trackGeo(bay.stoneGeo);
      trackGeo(bay.ironGeo);

      const bayNode = new THREE.Group();
      bayNode.position.set(mx, my - 0.05, mz);
      bayNode.rotation.set(0, yaw, pitchZ * 0.65);

      const curbMesh = new THREE.Mesh(bay.stoneGeo, stoneMat);
      curbMesh.castShadow = true;
      curbMesh.receiveShadow = true;
      bayNode.add(curbMesh);

      const ironMesh = new THREE.Mesh(bay.ironGeo, ironMat);
      ironMesh.castShadow = true;
      bayNode.add(ironMesh);

      fenceGroup.add(bayNode);
    }
  }

  buildFenceWing(leftPierXs, 8101);
  buildFenceWing(rightPierXs, 9203);

  // =========================================================================
  // 6. GOTHIC OPENWORK WROUGHT-IRON STONE LANTERNS & PULSING GHOST-BLUE FIRE
  // (Placed strictly on far flanks & rear gate approaches, never near fighter heads)
  // =========================================================================
  const lanternParts = buildGothicLanternGeos(THREE);
  trackGeo(lanternParts.stoneGeo);
  trackGeo(lanternParts.ironGeo);

  // Faceted teardrop ghost-fire spirit core geometry
  const spiritFlameGeo = trackGeo(new THREE.OctahedronGeometry(0.115, 1));
  spiritFlameGeo.scale(0.82, 1.48, 0.82);

  const lanternHaloGeo = trackGeo(new THREE.PlaneGeometry(1.45, 1.45));

  const lanternSpecs = [
    { x: -8.05, z: -2.85, ry: 0.45, phase: 0.0, lightInt: 1.35, lightDist: 11.5 },
    { x: 8.20, z: -3.10, ry: -0.52, phase: 1.65, lightInt: 1.35, lightDist: 11.5 },
    { x: -4.90, z: -8.25, ry: 0.22, phase: 3.10, lightInt: 1.15, lightDist: 10.5 },
    { x: 5.05, z: -8.35, ry: -0.28, phase: 4.55, lightInt: 1.15, lightDist: 10.5 },
  ];

  const animatedLanterns = [];

  for (let i = 0; i < lanternSpecs.length; i++) {
    const ls = lanternSpecs[i];
    const ly = getTerrainHeight(ls.x, ls.z);
    const lGroup = new THREE.Group();
    lGroup.name = `graveyard_gothic_lantern_${i}`;
    lGroup.position.set(ls.x, ly - 0.04, ls.z);
    lGroup.rotation.y = ls.ry;

    const stoneBase = new THREE.Mesh(lanternParts.stoneGeo, stoneMat);
    stoneBase.castShadow = true;
    stoneBase.receiveShadow = true;
    lGroup.add(stoneBase);

    const ironCage = new THREE.Mesh(lanternParts.ironGeo, ironMat);
    ironCage.castShadow = true;
    lGroup.add(ironCage);

    // Pulsing ghost-blue / moon-white spirit crystal flame inside openwork cage
    const coreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd4f4ff,
        emissive: 0x62c4ff,
        emissiveIntensity: 1.55,
        roughness: 0.18,
        metalness: 0.05,
        transparent: true,
        opacity: 0.94,
      })
    );
    const coreMesh = new THREE.Mesh(spiritFlameGeo, coreMat);
    coreMesh.position.set(0, 1.98, 0);
    lGroup.add(coreMesh);

    // Soft additive ghost-blue glow disc aura around the flame
    let haloMat = null;
    let haloMesh = null;
    if (glowDiscTex) {
      haloMat = trackMat(
        new THREE.MeshBasicMaterial({
          map: glowDiscTex,
          color: 0x7fd2ff,
          transparent: true,
          opacity: 0.46,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      haloMesh = new THREE.Mesh(lanternHaloGeo, haloMat);
      haloMesh.position.set(0, 1.98, 0);
      haloMesh.lookAt(0 - ls.x, 5.3 - (ly + 1.98), 14.2 - ls.z);
      haloMesh.renderOrder = 4;
      lGroup.add(haloMesh);
    }

    // Soft cool ghost-blue accent fill light (never washes out central characters)
    const ptLight = new THREE.PointLight(0x7ec8ff, ls.lightInt, ls.lightDist, 2.0);
    ptLight.position.set(0, 2.02, 0);
    ptLight.castShadow = false;
    lGroup.add(ptLight);

    animatedLanterns.push({
      coreMesh,
      coreMat,
      haloMat,
      light: ptLight,
      baseLightInt: ls.lightInt,
      baseY: 1.98,
      phase: ls.phase,
    });

    group.add(lGroup);
  }

  // =========================================================================
  // 7. INSTANCED WITHERED AUTUMN DRY GRASS, WEEDS & GRAVEYARD RUBBLE STONES
  // =========================================================================
  const grassGeo = trackGeo(buildWitheredGrassTuftGeo(THREE));
  const grassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
  );
  attachGrassBreeze(grassMat, windUniform);

  const rngGrass = createRng(55901);
  const grassTransforms = [];
  for (let i = 0; i < 310; i++) {
    const gx = lerp(-18.5, 18.5, rngGrass());
    const gz = lerp(-14.5, 7.2, rngGrass());

    // Strict combat arena & central foreground sightline protection
    if (Math.abs(gx) < 7.25 && gz > -3.75 && gz < 5.4) continue;
    // Keep narrow central stone gate footpath clean
    if (Math.abs(gx) < 1.35 && gz > -11.5 && gz <= -3.75) continue;
    // Keep foreground camera center open
    if (Math.abs(gx) < 7.8 && gz >= 4.0) continue;

    const gy = getTerrainHeight(gx, gz);
    const sc = 0.72 + rngGrass() * 0.95;
    grassTransforms.push({
      x: gx,
      y: gy - 0.02,
      z: gz,
      ry: rngGrass() * Math.PI * 2,
      sx: sc * (0.85 + rngGrass() * 0.45),
      sy: sc * (0.75 + rngGrass() * 0.65),
      sz: sc * (0.85 + rngGrass() * 0.45),
    });
  }

  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassTransforms.length);
  grassInst.name = 'graveyard_withered_grass';
  grassInst.receiveShadow = true;
  for (let i = 0; i < grassTransforms.length; i++) {
    const g = grassTransforms[i];
    dummy.position.set(g.x, g.y, g.z);
    dummy.rotation.set(0, g.ry, 0);
    dummy.scale.set(g.sx, g.sy, g.sz);
    dummy.updateMatrix();
    grassInst.setMatrixAt(i, dummy.matrix);
  }
  grassInst.instanceMatrix.needsUpdate = true;
  grassInst.frustumCulled = false;
  group.add(grassInst);

  // Mossy Weathered Boulders & Low Foreground Corner Curbs (HD-2D tilt-shift framing)
  const rockRaw = new THREE.IcosahedronGeometry(0.46, 1);
  const rp = rockRaw.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const vx = rp.getX(i);
    const vy = rp.getY(i);
    const vz = rp.getZ(i);
    const k = 0.78 + 0.38 * hash2(vx * 6.3 + vy * 3.7, vz * 5.9);
    rp.setXYZ(i, vx * k * 1.25, vy * k * 0.68, vz * k * 1.08);
  }
  rockRaw.computeVertexNormals();
  colorizeStoneGeometry(THREE, rockRaw, {
    baseHex: 0x566478,
    mossHex: 0x2f4244,
    moonHex: 0x8ea0b8,
    minY: -0.35,
    maxY: 0.35,
    seed: 144.2,
    mossHeight: 0.45,
  });
  const rockGeo = trackGeo(rockRaw);

  const rockCoords = [
    // Around crooked tree roots & tombstones
    [-7.8, -5.6, 1.35, 0.95, 1.15, 0.4],
    [-9.2, -4.1, 1.05, 0.80, 1.20, 1.2],
    [8.6, -6.1, 1.45, 0.98, 1.18, -0.5],
    [10.2, -4.8, 0.95, 0.72, 1.08, 0.9],
    [-4.6, -4.3, 0.68, 0.55, 0.78, 2.1],
    [4.4, -4.5, 0.72, 0.58, 0.80, -1.4],
    [-2.9, -8.5, 0.85, 0.65, 0.92, 0.3],
    [3.1, -8.6, 0.82, 0.62, 0.88, -0.8],
    [-7.6, -8.8, 1.15, 0.82, 1.02, 1.5],
    [7.5, -8.9, 1.10, 0.78, 1.12, -1.1],
    // Low tilt-shift foreground corner framing stones (|x| > 8.2, z > 4.2, strictly low y < 0.75)
    [-8.6, 4.6, 1.28, 0.82, 1.08, 0.55],
    [-9.8, 5.4, 1.55, 0.95, 1.25, 1.18],
    [8.7, 4.7, 1.32, 0.84, 1.12, -0.42],
    [10.0, 5.6, 1.52, 0.92, 1.22, -1.30],
  ];
  const rockInst = new THREE.InstancedMesh(rockGeo, stoneMat, rockCoords.length);
  rockInst.name = 'graveyard_weathered_rocks';
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  for (let i = 0; i < rockCoords.length; i++) {
    const [rx, rz, sx, sy, sz, ry] = rockCoords[i];
    const rgy = getTerrainHeight(rx, rz);
    dummy.position.set(rx, rgy + sy * 0.08, rz);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.frustumCulled = false;
  group.add(rockInst);

  // =========================================================================
  // 8. DISTANT SILHOUETTE BARREN HILLS & FAR-LEFT RUINED HILLSIDE CHAPEL SPIRE
  // =========================================================================
  function buildSilhouetteRidgeGeo(zBase, width, segsX, heightFn, baseHex, crestHex) {
    const pos = [];
    const uv = [];
    const col = [];
    const idx = [];
    const cBot = new THREE.Color(baseHex);
    const cTop = new THREE.Color(crestHex);
    const tmp = new THREE.Color();

    for (let i = 0; i <= segsX; i++) {
      const u = i / segsX;
      const x = lerp(-width * 0.5, width * 0.5, u);
      const h = heightFn(x);
      const zCurve = zBase - (x * x) * 0.008;

      // Bottom skirt anchored well below horizon
      pos.push(x, -3.5, zCurve);
      uv.push(u, 0);
      col.push(cBot.r, cBot.g, cBot.b);

      // Moonlit jagged ridge crest
      pos.push(x, h, zCurve);
      uv.push(u, 1);
      // Slight silver rim boost near moon azimuth (x ≈ 7.8)
      const moonKiss = 1.0 - smoothstep(0.0, 14.0, Math.abs(x - 7.8));
      tmp.copy(cTop).lerp(new THREE.Color(0x6c8bb8), moonKiss * 0.45);
      col.push(tmp.r, tmp.g, tmp.b);
    }

    for (let i = 0; i < segsX; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // Front-facing toward +Z camera: (a, c, b), (b, c, d)
      idx.push(a, c, b);
      idx.push(b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  const ridgeMat = trackMat(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      fog: true,
    })
  );

  // Near silhouette ridge (z ≈ -24, dips gracefully across x ∈ [2, 13] to showcase the low full moon!)
  const nearRidgeGeo = trackGeo(
    buildSilhouetteRidgeGeo(
      -23.5,
      78,
      72,
      (x) => {
        const leftSwell = smoothstep(-2.0, -24.0, x) * 3.85;
        const rightSwell = smoothstep(13.5, 30.0, x) * 3.45;
        const moonSaddle = 1.0 - 0.58 * (1.0 - smoothstep(0.0, 7.5, Math.abs(x - 7.6)));
        const n = fbm2D(x * 0.14 + 2.2, 4.1, 3);
        return (1.65 + leftSwell + rightSwell + n * 1.55) * moonSaddle;
      },
      0x152238,
      0x273a5e
    )
  );
  const nearRidgeMesh = new THREE.Mesh(nearRidgeGeo, ridgeMat);
  nearRidgeMesh.name = 'graveyard_near_silhouette_hills';
  group.add(nearRidgeMesh);

  // Far silhouette mountain/hill range (z ≈ -35)
  const farRidgeGeo = trackGeo(
    buildSilhouetteRidgeGeo(
      -34.5,
      96,
      80,
      (x) => {
        const leftPeak = smoothstep(-4.0, -32.0, x) * 5.2;
        const rightPeak = smoothstep(14.5, 36.0, x) * 4.6;
        const moonDip = 1.0 - 0.62 * (1.0 - smoothstep(0.0, 9.0, Math.abs(x - 7.8)));
        const n = fbm2D(x * 0.10 - 6.3, 8.7, 3);
        return (2.10 + leftPeak + rightPeak + n * 2.1) * moonDip;
      },
      0x182742,
      0x2f4670
    )
  );
  const farRidgeMesh = new THREE.Mesh(farRidgeGeo, ridgeMat);
  farRidgeMesh.name = 'graveyard_far_silhouette_hills';
  group.add(farRidgeMesh);

  // Distant ruined Gothic chapel & broken belfry spire silhouette on the far-left ridge
  const chapelParts = [];
  const chapelNave = new THREE.BoxGeometry(3.2, 2.6, 2.2);
  chapelNave.translate(0, 1.3, 0);
  chapelParts.push(chapelNave);

  const naveRoof = new THREE.ConeGeometry(2.35, 1.65, 4);
  naveRoof.rotateY(Math.PI / 4);
  naveRoof.scale(1.1, 1.0, 0.85);
  naveRoof.translate(0, 3.35, 0);
  chapelParts.push(naveRoof);

  const belfryTower = new THREE.BoxGeometry(1.35, 4.9, 1.35);
  belfryTower.translate(-1.35, 2.45, 0.15);
  chapelParts.push(belfryTower);

  const spireGeo = new THREE.ConeGeometry(0.88, 2.6, 4);
  spireGeo.rotateY(Math.PI / 4);
  spireGeo.translate(-1.35, 6.15, 0.15);
  chapelParts.push(spireGeo);

  const chapelGeo = trackGeo(mergeGeometries(THREE, chapelParts, true));
  setUniformVertexColor(THREE, chapelGeo, 0x1e2e4d, 0.03);
  const chapelMesh = new THREE.Mesh(chapelGeo, ridgeMat);
  chapelMesh.name = 'graveyard_distant_chapel_silhouette';
  chapelMesh.position.set(-16.8, 2.45, -26.8);
  chapelMesh.rotation.y = 0.28;
  group.add(chapelMesh);

  // =========================================================================
  // 9. DRIFTING LOW-LYING GROUND MIST VEILS & SUBTLE MOONLIGHT SHAFTS
  // (Translucent soft-edge GLSL ribbons hugging the ground without hiding fighters)
  // =========================================================================
  const mistUniforms = {
    uTime: { value: 0 },
    uMistColor: { value: new THREE.Color(0x6e90bd) },
    uMistOpacity: { value: 1.0 },
  };
  const mistMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: mistUniforms,
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aAlpha;
        attribute float aSpeed;
        varying vec2 vUv;
        varying float vPhase;
        varying float vAlpha;
        varying float vSpeed;
        void main() {
          vUv = uv;
          vPhase = aPhase;
          vAlpha = aAlpha;
          vSpeed = aSpeed;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uMistColor;
        uniform float uMistOpacity;
        varying vec2 vUv;
        varying float vPhase;
        varying float vAlpha;
        varying float vSpeed;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm(vec2 p) {
          float s = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            s += a * vnoise(p);
            p *= 2.05;
            a *= 0.5;
          }
          return s;
        }

        void main() {
          // Soft elliptical edge feathering so mist sheets never reveal quad edges
          vec2 centered = (vUv - 0.5) * 2.0;
          float r2 = dot(centered, centered);
          float ovalMask = smoothstep(1.0, 0.12, r2);

          vec2 drift1 = vec2(vUv.x * 2.6 - uTime * 0.042 * vSpeed + vPhase, vUv.y * 1.9 + sin(uTime * 0.14 + vPhase) * 0.15);
          vec2 drift2 = vec2(vUv.x * 4.4 + uTime * 0.025 * vSpeed - vPhase * 0.6, vUv.y * 3.1);
          float wisp = fbm(drift1) * 0.65 + fbm(drift2) * 0.35;
          float density = smoothstep(0.26, 0.78, wisp);

          float breathe = 0.85 + 0.15 * sin(uTime * 0.45 + vPhase * 2.3);
          float alpha = ovalMask * density * vAlpha * breathe * uMistOpacity;
          if (alpha < 0.004) discard;

          vec3 col = uMistColor * (0.88 + 0.24 * wisp);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );

  // Merge 16 low-lying drifting mist sheets into 1 ultra-fast draw call
  const mistSpecs = [
    // Low ankle-height wispy curls grazing the rear border of the clearing
    { x: -3.2, z: -3.6, yOff: 0.14, w: 6.4, d: 2.6, tilt: 0.08, alpha: 0.11, speed: 0.85 },
    { x: 3.6, z: -3.7, yOff: 0.14, w: 6.8, d: 2.6, tilt: 0.08, alpha: 0.11, speed: 0.78 },
    // Mid-graveyard creeping mist blankets weaving around tombstones & roots
    { x: -6.4, z: -5.4, yOff: 0.26, w: 8.2, d: 4.2, tilt: 0.14, alpha: 0.20, speed: 0.92 },
    { x: -0.8, z: -5.8, yOff: 0.24, w: 8.6, d: 3.8, tilt: 0.12, alpha: 0.17, speed: 0.74 },
    { x: 5.8, z: -5.5, yOff: 0.26, w: 8.4, d: 4.2, tilt: 0.14, alpha: 0.20, speed: 0.88 },
    { x: -9.8, z: -3.0, yOff: 0.28, w: 7.4, d: 4.8, tilt: 0.12, alpha: 0.18, speed: 0.80 },
    { x: 10.0, z: -3.2, yOff: 0.28, w: 7.4, d: 4.8, tilt: 0.12, alpha: 0.18, speed: 0.84 },
    // Deeper mist banks swirling through the ruined wrought-iron gate & fence
    { x: -8.2, z: -8.6, yOff: 0.44, w: 10.5, d: 5.2, tilt: 0.20, alpha: 0.24, speed: 0.68 },
    { x: 0.2, z: -8.9, yOff: 0.42, w: 11.2, d: 5.0, tilt: 0.22, alpha: 0.22, speed: 0.62 },
    { x: 8.4, z: -8.7, yOff: 0.44, w: 10.5, d: 5.2, tilt: 0.20, alpha: 0.24, speed: 0.72 },
    // Deep-rear valley mist rising beneath the distant silhouette hills
    { x: -11.5, z: -13.2, yOff: 0.72, w: 14.0, d: 6.4, tilt: 0.26, alpha: 0.25, speed: 0.56 },
    { x: -2.0, z: -13.8, yOff: 0.75, w: 14.5, d: 6.4, tilt: 0.26, alpha: 0.24, speed: 0.52 },
    { x: 7.8, z: -13.6, yOff: 0.75, w: 14.5, d: 6.4, tilt: 0.26, alpha: 0.24, speed: 0.60 },
    { x: 15.2, z: -12.6, yOff: 0.68, w: 12.5, d: 5.8, tilt: 0.24, alpha: 0.22, speed: 0.58 },
    // Far outer foreground corner low mist wisp (never touching center sightline)
    { x: -10.4, z: 3.4, yOff: 0.20, w: 6.2, d: 3.6, tilt: 0.08, alpha: 0.14, speed: 0.90 },
    { x: 10.6, z: 3.2, yOff: 0.20, w: 6.2, d: 3.6, tilt: 0.08, alpha: 0.14, speed: 0.86 },
  ];

  const mPos = [];
  const mUv = [];
  const mPhase = [];
  const mAlpha = [];
  const mSpeed = [];
  const mIdx = [];

  for (let i = 0; i < mistSpecs.length; i++) {
    const ms = mistSpecs[i];
    const baseY = getTerrainHeight(ms.x, ms.z) + ms.yOff;
    const hw = ms.w * 0.5;
    const hd = ms.d * 0.5;
    const dyTilt = Math.sin(ms.tilt) * hd;
    const dzTilt = Math.cos(ms.tilt) * hd;
    const vOff = i * 4;

    // 4 vertices tilted slightly toward camera so mist reads volumetrically at 34° camera angle
    mPos.push(
      ms.x - hw, baseY - dyTilt, ms.z + dzTilt,
      ms.x + hw, baseY - dyTilt, ms.z + dzTilt,
      ms.x - hw, baseY + dyTilt, ms.z - dzTilt,
      ms.x + hw, baseY + dyTilt, ms.z - dzTilt
    );
    mUv.push(0, 0, 1, 0, 0, 1, 1, 1);
    const ph = i * 1.93 + 0.7;
    for (let k = 0; k < 4; k++) {
      mPhase.push(ph);
      mAlpha.push(ms.alpha);
      mSpeed.push(ms.speed);
    }
    mIdx.push(vOff, vOff + 1, vOff + 2, vOff + 1, vOff + 3, vOff + 2);
  }

  const mistGeo = trackGeo(new THREE.BufferGeometry());
  mistGeo.setAttribute('position', new THREE.Float32BufferAttribute(mPos, 3));
  mistGeo.setAttribute('uv', new THREE.Float32BufferAttribute(mUv, 2));
  mistGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(mPhase, 1));
  mistGeo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(mAlpha, 1));
  mistGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(mSpeed, 1));
  mistGeo.setIndex(mIdx);
  const mistMesh = new THREE.Mesh(mistGeo, mistMat);
  mistMesh.name = 'graveyard_drifting_ground_mist';
  mistMesh.renderOrder = 2;
  group.add(mistMesh);

  // Subtle diagonal silver-blue moonlight shafts angling down from the moon
  const moonbeamUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x8fb8ff) },
    uOpacityScale: { value: 1.0 },
  };
  const moonbeamMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: moonbeamUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacityScale;
        varying vec2 vUv;
        void main() {
          float horiz = pow(max(sin(vUv.x * 3.14159265), 0.0), 2.4);
          float vert = smoothstep(0.0, 0.28, vUv.y) * (1.0 - smoothstep(0.68, 1.0, vUv.y));
          float shimmer = 0.85 + 0.15 * sin(uTime * 0.55 + vUv.x * 5.2);
          float alpha = horiz * vert * shimmer * 0.055 * uOpacityScale;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })
  );

  const beamGeo = trackGeo(new THREE.PlaneGeometry(3.2, 13.5));
  const beamConfigs = [
    { x: 5.6, y: 5.6, z: -9.8, ry: -0.18, rz: 0.42, sx: 1.05 },
    { x: 1.4, y: 5.9, z: -11.4, ry: -0.12, rz: 0.42, sx: 1.20 },
    { x: -3.2, y: 6.0, z: -12.8, ry: -0.08, rz: 0.42, sx: 0.95 },
  ];
  for (const bc of beamConfigs) {
    const bm = new THREE.Mesh(beamGeo, moonbeamMat);
    bm.position.set(bc.x, bc.y, bc.z);
    bm.rotation.set(0.14, bc.ry, bc.rz);
    bm.scale.set(bc.sx, 1, 1);
    bm.renderOrder = 3;
    group.add(bm);
  }

  // =========================================================================
  // 10. ETHEREAL GHOST-BLUE WILL-O'-THE-WISPS & AUTUMN NIGHT FIREFLY MOTES
  // (Smooth swaying & gentle ascent driven in update(t, dt))
  // =========================================================================

  // A. 12 Hero Ghost-Blue Will-o'-the-Wisps hovering above tombstones & dead boughs
  const wispCount = 12;
  const wispPos = new Float32Array(wispCount * 3);
  const wispSeeds = [];
  const wispAnchors = [
    [-4.8, 1.45, -5.8],
    [-2.4, 1.20, -6.5],
    [2.9, 1.30, -5.9],
    [6.1, 1.55, -6.4],
    [-7.4, 2.35, -5.4],
    [8.2, 2.25, -5.9],
    [-3.6, 1.75, -10.2],
    [0.4, 1.65, -9.6],
    [4.4, 1.80, -10.5],
    [-9.6, 1.50, -6.8],
    [10.1, 1.60, -7.2],
    [7.2, 2.40, -11.8],
  ];
  for (let i = 0; i < wispCount; i++) {
    const [wx, wyOff, wz] = wispAnchors[i];
    const wy = getTerrainHeight(wx, wz) + wyOff;
    wispPos[i * 3] = wx;
    wispPos[i * 3 + 1] = wy;
    wispPos[i * 3 + 2] = wz;
    wispSeeds.push({
      bx: wx,
      by: wy,
      bz: wz,
      phase: i * 1.47 + 0.35,
      speed: 0.65 + (i % 4) * 0.14,
      ampX: 0.28 + (i % 3) * 0.11,
      ampY: 0.24 + (i % 2) * 0.12,
    });
  }
  const wispGeo = trackGeo(new THREE.BufferGeometry());
  wispGeo.setAttribute('position', new THREE.BufferAttribute(wispPos, 3));
  const wispMat = trackMat(
    new THREE.PointsMaterial({
      color: 0x7fd8ff,
      size: 0.62,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...(glowDiscTex ? { map: glowDiscTex } : {}),
    })
  );
  const wispPoints = new THREE.Points(wispGeo, wispMat);
  wispPoints.name = 'graveyard_ghost_wisps';
  wispPoints.renderOrder = 5;
  group.add(wispPoints);

  // B. 148 Fine Ascending Autumn-Night Fireflies / Spectral Blue-Silver Motes
  const fireflyCount = 148;
  const ffPos = new Float32Array(fireflyCount * 3);
  const ffSeed = new Float32Array(fireflyCount * 4); // bx, baseY, bz, phase
  const ffColor = new Float32Array(fireflyCount * 3);
  const rngFF = createRng(88421);
  const cWispBlue = new THREE.Color(0x6ecbff);
  const cMoonIce = new THREE.Color(0xc8e8ff);
  const cAutumnPale = new THREE.Color(0xfff1c8);
  const cFF = new THREE.Color();

  for (let i = 0; i < fireflyCount; i++) {
    const fx = lerp(-13.5, 13.5, rngFF());
    // Concentrate softly around mid/rear graveyard & flanking trees, very sparse near camera
    const fz = lerp(-14.2, 2.8, Math.pow(rngFF(), 1.35));
    const fy = 0.25 + rngFF() * 4.4;
    ffPos[i * 3] = fx;
    ffPos[i * 3 + 1] = fy;
    ffPos[i * 3 + 2] = fz;

    ffSeed[i * 4] = fx;
    ffSeed[i * 4 + 1] = fy;
    ffSeed[i * 4 + 2] = fz;
    ffSeed[i * 4 + 3] = rngFF() * Math.PI * 2;

    const palettePick = rngFF();
    if (palettePick < 0.62) cFF.copy(cWispBlue).lerp(cMoonIce, rngFF());
    else if (palettePick < 0.88) cFF.copy(cMoonIce);
    else cFF.copy(cAutumnPale); // Occasional delicate pale-gold autumn firefly glint
    ffColor[i * 3] = cFF.r;
    ffColor[i * 3 + 1] = cFF.g;
    ffColor[i * 3 + 2] = cFF.b;
  }

  const fireflyGeo = trackGeo(new THREE.BufferGeometry());
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  fireflyGeo.setAttribute('color', new THREE.BufferAttribute(ffColor, 3));
  const fireflyMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.23,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...(glowDiscTex ? { map: glowDiscTex } : {}),
    })
  );
  const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  fireflyPoints.name = 'graveyard_autumn_fireflies';
  fireflyPoints.renderOrder = 5;
  group.add(fireflyPoints);

  // =========================================================================
  // 11. CALIBRATED MOONLIT LIGHTING RIG (Crisp Night Atmosphere, Zero Blowout)
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0x7699cf, 0x26334a, 0.96);
  group.add(hemiLight);

  // First DirectionalLight = primary silver-blue moonlight key (2048 shadow map)
  const moonLight = new THREE.DirectionalLight(0xcbe0ff, 1.62);
  moonLight.position.set(11.5, 17.5, -14.5);
  moonLight.target.position.set(0, 0, -1.2);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.near = 2.0;
  moonLight.shadow.camera.far = 64.0;
  moonLight.shadow.camera.left = -21;
  moonLight.shadow.camera.right = 21;
  moonLight.shadow.camera.top = 18;
  moonLight.shadow.camera.bottom = -16;
  moonLight.shadow.bias = -0.0005;
  moonLight.shadow.normalBias = 0.035;
  group.add(moonLight);
  group.add(moonLight.target);

  // Second DirectionalLight = gentle cool front-left sky fill to pick out carved stone & bark fronts
  const fillLight = new THREE.DirectionalLight(0x7ba4db, 0.48);
  fillLight.position.set(-9.5, 8.0, 13.5);
  fillLight.target.position.set(0, 0.8, -3.5);
  fillLight.castShadow = false;
  group.add(fillLight);
  group.add(fillLight.target);

  // =========================================================================
  // 12. MOOD CONFIG & SMOOTH TRANSITION INTERFACE (Frozen Engine Contract)
  // =========================================================================
  const GRAVEYARD_MOODS = {
    graveyard_mist: {
      subtitle: '寒月秋夜 · 荒坟薄雾',
      hemiSky: 0x7699cf,
      hemiGround: 0x26334a,
      hemiInt: 0.96,
      moonColor: 0xcbe0ff,
      moonInt: 1.62,
      fillColor: 0x7ba4db,
      fillInt: 0.48,
      skyHorizon: 0x2f456e,
      skyMid: 0x1a2c54,
      skyZenith: 0x0c1630,
      skyMoonGlow: 0x9ec4ff,
      skyCloud: 0x526e9e,
      skyBelowHorizon: 0x1d2b48,
      mistColor: 0x6e90bd,
      mistOpacity: 1.0,
      moonbeamColor: 0x8fb8ff,
      moonbeamOpacity: 1.0,
      wispColor: 0x7fd8ff,
      fog: { color: 0x2a3e63, near: 13.5, far: 44 },
      background: 0x1a2a4a,
      atmospherePreset: {
        bloomStrength: 0.32,
        bloomThreshold: 0.90,
        bloomRadius: 0.56,
        godRayOpacity: 0.16,
        godRayColor: 0x8fb8ff,
        godRayOrigin: [0.58, 0.86],
        particleType: 'firefly',
        particleCount: 160,
        particleSpeed: 0.75,
        dofFocus: 0.50,
        dofAperture: 0.0022,
        spriteRimTint: [0.88, 0.95, 1.02],
        // Companion post-pipeline fields
        particleColor: 0x8fd6ff,
        particleSecondaryColor: 0xcde6ff,
        particleWind: 0.55,
        focusDepth: 0.54,
        blurAmount: 1.45,
        vignetteStrength: 0.18,
      },
    },
  };

  function cloneMoodResult(moodId, cfg) {
    return {
      moodId,
      fog: { ...cfg.fog },
      background: cfg.background,
      atmospherePreset: {
        ...cfg.atmospherePreset,
        godRayOrigin: cfg.atmospherePreset.godRayOrigin.slice(),
        spriteRimTint: cfg.atmospherePreset.spriteRimTint.slice(),
      },
    };
  }

  function makeMoodSnap(cfg) {
    return {
      hemiSky: new THREE.Color(cfg.hemiSky),
      hemiGround: new THREE.Color(cfg.hemiGround),
      hemiInt: cfg.hemiInt,
      moonColor: new THREE.Color(cfg.moonColor),
      moonInt: cfg.moonInt,
      fillColor: new THREE.Color(cfg.fillColor),
      fillInt: cfg.fillInt,
      skyHorizon: new THREE.Color(cfg.skyHorizon),
      skyMid: new THREE.Color(cfg.skyMid),
      skyZenith: new THREE.Color(cfg.skyZenith),
      skyMoonGlow: new THREE.Color(cfg.skyMoonGlow),
      skyCloud: new THREE.Color(cfg.skyCloud),
      skyBelowHorizon: new THREE.Color(cfg.skyBelowHorizon),
      mistColor: new THREE.Color(cfg.mistColor),
      mistOpacity: cfg.mistOpacity,
      moonbeamColor: new THREE.Color(cfg.moonbeamColor),
      moonbeamOpacity: cfg.moonbeamOpacity,
      wispColor: new THREE.Color(cfg.wispColor),
    };
  }

  function copySnap(dst, src) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].copy(src[k]);
      else dst[k] = src[k];
    }
  }

  function lerpSnap(dst, a, b, t) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].lerpColors(a[k], b[k], t);
      else dst[k] = a[k] + (b[k] - a[k]) * t;
    }
  }

  let currentMoodId = 'graveyard_mist';
  let runtimeTicks = 0;
  const moodCur = makeMoodSnap(GRAVEYARD_MOODS.graveyard_mist);
  const moodFrom = makeMoodSnap(GRAVEYARD_MOODS.graveyard_mist);
  const moodTarget = makeMoodSnap(GRAVEYARD_MOODS.graveyard_mist);
  const moodTrans = { active: false, elapsed: 0, duration: 0.85 };

  function commitMood(s) {
    hemiLight.color.copy(s.hemiSky);
    hemiLight.groundColor.copy(s.hemiGround);
    hemiLight.intensity = s.hemiInt;
    moonLight.color.copy(s.moonColor);
    moonLight.intensity = s.moonInt;
    fillLight.color.copy(s.fillColor);
    fillLight.intensity = s.fillInt;

    skyUniforms.uHorizonCol.value.copy(s.skyHorizon);
    skyUniforms.uMidSkyCol.value.copy(s.skyMid);
    skyUniforms.uZenithCol.value.copy(s.skyZenith);
    skyUniforms.uMoonGlowCol.value.copy(s.skyMoonGlow);
    skyUniforms.uCloudCol.value.copy(s.skyCloud);
    skyUniforms.uBelowHorizonCol.value.copy(s.skyBelowHorizon);

    mistUniforms.uMistColor.value.copy(s.mistColor);
    mistUniforms.uMistOpacity.value = s.mistOpacity;
    moonbeamUniforms.uColor.value.copy(s.moonbeamColor);
    moonbeamUniforms.uOpacityScale.value = s.moonbeamOpacity;
    wispMat.color.copy(s.wispColor);
  }

  let biomeHandle = null;

  function applyMood(moodId, opts = {}) {
    const rawKey = typeof moodId === 'string' ? moodId.trim().toLowerCase() : '';
    const resolvedKey = GRAVEYARD_MOODS[rawKey] ? rawKey : 'graveyard_mist';
    const cfg = GRAVEYARD_MOODS[resolvedKey];
    currentMoodId = resolvedKey;

    const targetSnap = makeMoodSnap(cfg);
    const immediate =
      opts.immediate === true ||
      opts.duration === 0 ||
      runtimeTicks < 2;

    if (immediate) {
      copySnap(moodCur, targetSnap);
      copySnap(moodFrom, targetSnap);
      copySnap(moodTarget, targetSnap);
      moodTrans.active = false;
      moodTrans.elapsed = 0;
      commitMood(moodCur);
    } else {
      copySnap(moodFrom, moodCur);
      copySnap(moodTarget, targetSnap);
      moodTrans.duration =
        Number.isFinite(opts.duration) && opts.duration > 0 ? opts.duration : 0.85;
      moodTrans.elapsed = 0;
      moodTrans.active = true;
    }

    const result = cloneMoodResult(resolvedKey, cfg);
    if (biomeHandle) {
      biomeHandle.currentMood = resolvedKey;
      biomeHandle.subtitle = cfg.subtitle;
      biomeHandle.fog = { ...result.fog };
      biomeHandle.background = result.background;
      biomeHandle.atmospherePreset = {
        ...result.atmospherePreset,
        godRayOrigin: result.atmospherePreset.godRayOrigin.slice(),
        spriteRimTint: result.atmospherePreset.spriteRimTint.slice(),
      };
    }
    return result;
  }

  // =========================================================================
  // 13. UPDATE & COMPLETE RESOURCE DISPOSE LIFECYCLE
  // =========================================================================
  function update(t, dt) {
    const time = Number.isFinite(t) ? t : 0;
    const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0.016;
    if (safeDt > 0 || time > 0.02) {
      runtimeTicks += 1;
    }

    if (moodTrans.active) {
      moodTrans.elapsed += Math.max(safeDt, 0.016);
      const rawT = Math.min(1, moodTrans.elapsed / Math.max(0.05, moodTrans.duration));
      const smoothT = rawT * rawT * (3 - 2 * rawT);
      lerpSnap(moodCur, moodFrom, moodTarget, smoothT);
      commitMood(moodCur);
      if (rawT >= 1) {
        moodTrans.active = false;
      }
    }

    // 1. Shader time uniforms (night clouds, moon mist, ground mist drift, moonbeams, breeze)
    skyUniforms.uTime.value = time;
    moonHaloUniforms.uTime.value = time;
    moonDiscUniforms.uTime.value = time;
    mistUniforms.uTime.value = time;
    moonbeamUniforms.uTime.value = time;
    windUniform.value = time;

    // 2. Pulsing Gothic wrought-iron lantern ghost-blue spirit fires
    for (let i = 0; i < animatedLanterns.length; i++) {
      const ln = animatedLanterns[i];
      const slowPulse = 0.5 + 0.5 * Math.sin(time * 1.9 + ln.phase);
      const microFlicker = 0.5 + 0.5 * Math.sin(time * 5.7 + ln.phase * 2.3);
      const energy = 0.78 + slowPulse * 0.28 + microFlicker * 0.12;

      ln.coreMesh.position.y = ln.baseY + Math.sin(time * 2.3 + ln.phase) * 0.032;
      ln.coreMesh.rotation.y = time * 0.85 + ln.phase;
      const sc = 0.92 + slowPulse * 0.14;
      ln.coreMesh.scale.set(sc, sc * (0.96 + microFlicker * 0.12), sc);
      ln.coreMat.emissiveIntensity = 1.38 * energy;
      ln.light.intensity = ln.baseLightInt * (0.86 + slowPulse * 0.22 + microFlicker * 0.06);
      if (ln.haloMat) {
        ln.haloMat.opacity = 0.36 + slowPulse * 0.16;
      }
    }

    // 3. Ethereal hovering ghost-blue will-o'-the-wisps swaying softly above graves
    const wpAttr = wispGeo.attributes.position;
    for (let i = 0; i < wispCount; i++) {
      const ws = wispSeeds[i];
      const p = time * ws.speed + ws.phase;
      wpAttr.setXYZ(
        i,
        ws.bx + Math.sin(p) * ws.ampX + Math.cos(p * 0.55) * 0.12,
        ws.by + Math.sin(p * 1.35) * ws.ampY,
        ws.bz + Math.cos(p * 0.82) * ws.ampX * 0.65
      );
    }
    wpAttr.needsUpdate = true;
    wispMat.opacity = 0.72 + 0.14 * Math.sin(time * 1.6);

    // 4. Gently rising & swaying autumn-night firefly motes
    const ffAttr = fireflyGeo.attributes.position;
    for (let i = 0; i < fireflyCount; i++) {
      const bx = ffSeed[i * 4];
      const by = ffSeed[i * 4 + 1];
      const bz = ffSeed[i * 4 + 2];
      const ph = ffSeed[i * 4 + 3];
      const rise = ((by + time * 0.19) % 4.5) + 0.20;
      const swayX = Math.sin(time * 0.78 + ph) * 0.38 + Math.cos(time * 0.41 + ph * 1.7) * 0.16;
      const swayZ = Math.cos(time * 0.64 + ph * 1.3) * 0.24;
      ffAttr.setXYZ(i, bx + swayX, rise, bz + swayZ);
    }
    ffAttr.needsUpdate = true;
  }

  function dispose() {
    for (let i = 0; i < trackedGeos.length; i++) {
      if (trackedGeos[i] && typeof trackedGeos[i].dispose === 'function') {
        trackedGeos[i].dispose();
      }
    }
    for (let i = 0; i < trackedMats.length; i++) {
      if (trackedMats[i] && typeof trackedMats[i].dispose === 'function') {
        trackedMats[i].dispose();
      }
    }
    for (let i = 0; i < trackedTextures.length; i++) {
      if (trackedTextures[i] && typeof trackedTextures[i].dispose === 'function') {
        trackedTextures[i].dispose();
      }
    }
    trackedGeos.length = 0;
    trackedMats.length = 0;
    trackedTextures.length = 0;
  }

  // Apply initial default mood immediately
  commitMood(moodCur);
  const defaultResult = cloneMoodResult('graveyard_mist', GRAVEYARD_MOODS.graveyard_mist);

  biomeHandle = {
    id: 'graveyard',
    name: '秋夜乱葬岗墓地',
    subtitle: GRAVEYARD_MOODS.graveyard_mist.subtitle,
    currentMood: currentMoodId,
    supportedMoods: Object.keys(GRAVEYARD_MOODS),
    group,
    fog: defaultResult.fog,
    background: defaultResult.background,
    atmospherePreset: defaultResult.atmospherePreset,
    applyMood,
    update,
    dispose,
  };
  return biomeHandle;
}
