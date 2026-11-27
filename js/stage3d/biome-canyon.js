/**
 * HD-2D 3D Exclusive Biome: Hulan Frozen Grand Canyon (赫兰冰封大峡谷 · 北境补给线防线)
 *
 * Exclusive Act 07 (hulan_beast_tide) 3D Battle Stage for 《转生千金～到了异世界就要悠闲地生活》:
 * - Strict flat permafrost supply road on x∈[-7.4, 7.4], z∈[-3.9, 4.0] (strictly y = 0,
 *   exceeding the required [-6.8, 6.8] × [-3.4, 3.4] wide-beast clearance with zero obstacles)
 * - Compacted wagon wheel ruts & Voronoi permafrost ice-fissure PBR road surface
 * - Towering multi-strata faceted glacial canyon cliffs (left x < -9, right x > 9, rear z < -7.5)
 *   with geological fracture shelves, thick overhanging wind-carved snow cornices,
 *   and ~260 instanced hanging glacial icicle curtains forming a dramatic northern sky-slit gorge
 * - 10 Hero AAA Polyhedral Double-Layer Refractive Glacial Crystal Clusters (each with 6–9
 *   chamfered 6/7-sided prisms, asymmetric oblique pyramid crowns, glowing sapphire-cyan inner
 *   cores, translucent Fresnel-refractive outer crystal shells, 6–10 shattered ice splinter shards,
 *   and wind-eroded sastrugi snow pedestals)
 * - Authentic Hulan Northern Supply Line defense props (z < -4.2): snow-laden military crate
 *   stacks, red-cross & royal-blue-cross northern medical supply chests, sharpened-timber
 *   anti-beast cheval-de-frise barricades, 3 ironwood blizzard guideposts with wind-swinging
 *   warm warning lanterns, and shattered glacial ice-bridge ruined piers over the frozen chasm
 * - 3-tier faceted alpine mountain panorama, frozen abyssal gorge ice floor shader,
 *   high-altitude canyon jet-stream snow plumes, and diagonal wind-swept ice dust in update(t, dt)
 * - Two calibrated anti-overexposure moods: `blizzard_canyon` (W1) and `blizzard_canyon_w2` (W2)
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG, Math & 2D Noise Utilities
// ---------------------------------------------------------------------------
function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function createRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s * 1664525 + 1013904223) >>> 0;
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

function ridgedFbm2D(x, z, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise2D(x * freq, z * freq);
    const r = 1.0 - Math.abs(n * 2.0 - 1.0);
    sum += r * r * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Canyon Terrain Heightfield Contract
// Strictly y = 0 on x ∈ [-7.4, 7.4], z ∈ [-3.9, 4.0] (buffers [-6.8,6.8]×[-3.4,3.4])
// ---------------------------------------------------------------------------
function getCanyonRoadCenterZ(x) {
  return -0.25 + Math.sin(x * 0.14 + 0.45) * 0.72 - x * 0.04;
}

function getTerrainHeight(x, z) {
  const ax = Math.abs(x);
  // Strict flat permafrost combat floor (zero slope, zero bumps under any actor)
  if (ax <= 7.45 && z >= -4.05 && z <= 4.25) {
    return 0;
  }

  const dxArena = Math.max(0, ax - 7.45);
  const dzBack = Math.max(0, -4.05 - z);
  const dzFront = Math.max(0, z - 4.25);

  const arenaMask = smoothstep(0.0, 2.2, Math.hypot(dxArena * 0.95, Math.max(dzBack * 1.15, dzFront * 0.9)));

  const nMacro = fbm2D(x * 0.08 + 2.3, z * 0.08 - 1.4, 4) - 0.46;
  const nFine = fbm2D(x * 0.24 - 5.1, z * 0.22 + 3.2, 3) - 0.5;

  // Wind-packed lateral canyon snowbanks climbing into cliff bases (|x| > 7.6)
  const cliffBankRise = smoothstep(7.5, 16.5, ax) * (2.85 + nMacro * 1.9);

  // Supply-line rear terrace (z ∈ [-7.2, -4.1]): gentle compacted shelf for crates & barricades
  const supplyShelf = smoothstep(-4.05, -5.8, z) * (1.0 - smoothstep(-6.8, -8.2, z)) * (0.28 + nFine * 0.16);

  // Glacial rift chasm behind the supply line (z ∈ [-13.5, -7.8], central gorge |x| < 11.5)
  const chasmZMask = smoothstep(-7.4, -9.2, z) * (1.0 - smoothstep(-15.5, -20.0, z));
  const chasmXMask = 1.0 - smoothstep(6.2, 12.8, ax);
  const chasmDrop = -2.65 * chasmZMask * chasmXMask;

  // Deep far canyon floor climbing back up toward distant glacial ridges (z < -17.5)
  const farGorgeRise = smoothstep(-17.0, -34.0, z) * (5.2 + nMacro * 3.4);

  // Foreground camera corridor stays open & gently sloped down; low snowbanks only on outer corners
  const cornerFrontDrift = smoothstep(7.8, 12.6, ax) * smoothstep(4.2, 8.8, z) * 0.85;
  const frontCameraClear = (1.0 - smoothstep(6.2, 9.6, ax)) * smoothstep(4.8, 13.5, z) * -0.42;

  return (cliffBankRise + supplyShelf + chasmDrop + farGorgeRise + cornerFrontDrift + nFine * 0.28) * arenaMask + frontCameraClear;
}

// ---------------------------------------------------------------------------
// Texture & BufferGeometry Helpers (Never mutates/disposes external texLib originals)
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
  const emisRaw = entry.emissiveMap || entry.emissive || null;
  const out = {};
  if (mapRaw && mapRaw.isTexture) out.map = cloneTexWithRepeat(THREE, mapRaw, rx, ry, trackedTextures);
  if (normalRaw && normalRaw.isTexture) out.normalMap = cloneTexWithRepeat(THREE, normalRaw, rx, ry, trackedTextures);
  else if (bumpRaw && bumpRaw.isTexture) out.bumpMap = cloneTexWithRepeat(THREE, bumpRaw, rx, ry, trackedTextures);
  if (roughRaw && roughRaw.isTexture) out.roughnessMap = cloneTexWithRepeat(THREE, roughRaw, rx, ry, trackedTextures);
  if (emisRaw && emisRaw.isTexture) out.emissiveMap = cloneTexWithRepeat(THREE, emisRaw, rx, ry, trackedTextures);
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
  grad.addColorStop(0.32, 'rgba(180,236,255,0.62)');
  grad.addColorStop(0.70, 'rgba(95,192,248,0.16)');
  grad.addColorStop(1.0, 'rgba(70,160,240,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  trackedTextures.push(tex);
  return tex;
}

/**
 * Procedural weathered northern pine crate timber CanvasTexture (256×256)
 */
function createNorthernCrateTexture(THREE, trackedTextures) {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#735742';
  ctx.fillRect(0, 0, size, size);

  const plankCount = 6;
  const plankH = size / plankCount;
  const rng = createRng(70111);

  for (let p = 0; p < plankCount; p++) {
    const y0 = Math.floor(p * plankH);
    const toneShift = Math.floor((rng() - 0.5) * 18);
    const r = clamp(114 + toneShift, 75, 148);
    const g = clamp(87 + toneShift * 0.85, 56, 118);
    const b = clamp(67 + toneShift * 0.72, 42, 96);
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(0, y0, size, Math.ceil(plankH));

    // Fine wood grain streaks
    for (let s = 0; s < 22; s++) {
      const sy = y0 + rng() * plankH;
      const alpha = 0.08 + rng() * 0.14;
      ctx.strokeStyle = rng() > 0.45 ? `rgba(42,28,20,${alpha})` : `rgba(170,148,128,${alpha * 0.8})`;
      ctx.lineWidth = 1 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.bezierCurveTo(
        size * 0.33, sy + (rng() - 0.5) * 4,
        size * 0.66, sy + (rng() - 0.5) * 4,
        size, sy + (rng() - 0.5) * 2
      );
      ctx.stroke();
    }

    // Dark plank seam groove
    ctx.fillStyle = 'rgba(26,18,14,0.68)';
    ctx.fillRect(0, y0, size, 2);

    // Subtle frost rime settling along upper seam edge
    ctx.fillStyle = 'rgba(218,236,252,0.22)';
    ctx.fillRect(0, y0 + 2, size, 2);
  }

  // Subtle frost powder dusting near top & corners
  const frostGrad = ctx.createLinearGradient(0, 0, 0, size);
  frostGrad.addColorStop(0.0, 'rgba(226,241,255,0.30)');
  frostGrad.addColorStop(0.28, 'rgba(215,234,250,0.06)');
  frostGrad.addColorStop(0.85, 'rgba(195,218,242,0.08)');
  frostGrad.addColorStop(1.0, 'rgba(220,238,255,0.24)');
  ctx.fillStyle = frostGrad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  trackedTextures.push(tex);
  return tex;
}

/**
 * Procedural Northern Medical Supply Cross Emblem CanvasTexture (256×256)
 * Supports crisp crimson red cross ('red') or royal northern blue cross ('blue').
 */
function createMedicalEmblemTexture(THREE, variant, trackedTextures) {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Frost-lacquered snow-ivory medical chest face with recessed wooden border
  ctx.fillStyle = '#dce6f0';
  ctx.fillRect(0, 0, size, size);

  // Subtle plank grain behind paint
  for (let y = 0; y < size; y += 32) {
    ctx.fillStyle = 'rgba(110,132,158,0.16)';
    ctx.fillRect(0, y, size, 2);
  }

  // Outer forged frame border & corner rivets
  ctx.strokeStyle = '#6c829c';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, size - 14, size - 14);
  ctx.strokeStyle = '#9bb4ce';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, size - 40, size - 40);

  // Heraldic snow-porcelain medallion backing
  const cx = size * 0.5;
  const cy = size * 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 82, 0, Math.PI * 2);
  ctx.fillStyle = '#f3f8fc';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = variant === 'red' ? '#b8323e' : '#1b57d6';
  ctx.stroke();

  // Inner thin accent ring
  ctx.beginPath();
  ctx.arc(cx, cy, 72, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = variant === 'red' ? 'rgba(184,50,62,0.38)' : 'rgba(27,87,214,0.42)';
  ctx.stroke();

  // Crisp Medical Cross
  const armW = 34;
  const armL = 104;
  ctx.fillStyle = variant === 'red' ? '#cf2c3b' : '#1658eb';
  ctx.fillRect(cx - armW * 0.5, cy - armL * 0.5, armW, armL);
  ctx.fillRect(cx - armL * 0.5, cy - armW * 0.5, armL, armW);

  // Subtle specular highlight bevel on cross
  ctx.fillStyle = variant === 'red' ? 'rgba(255,190,196,0.28)' : 'rgba(170,224,255,0.32)';
  ctx.fillRect(cx - armW * 0.5 + 3, cy - armL * 0.5 + 3, armW - 6, 8);
  ctx.fillRect(cx - armL * 0.5 + 3, cy - armW * 0.5 + 3, armL - 6, 8);

  // Corner iron studs
  const studs = [
    [22, 22], [size - 22, 22], [22, size - 22], [size - 22, size - 22],
  ];
  ctx.fillStyle = '#485a70';
  for (const [sx, sy] of studs) {
    ctx.beginPath();
    ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  trackedTextures.push(tex);
  return tex;
}

/**
 * Self-contained BufferGeometry Merge Utility
 * Supports mixed vertexColors & index modes and properly disposes input geometries.
 */
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
  const indices = totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

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

// ---------------------------------------------------------------------------
// AAA Procedural Geometry Builders
// ---------------------------------------------------------------------------

/**
 * 1. Multi-Strata Faceted Glacial Cliff Wall Buttress
 *    Sculpts irregular folded granite strata, diagonal cleavage shear planes,
 *    frost-eroded lower undercut, and slope-based snow dusting + embedded glacial ice seams.
 */
function createSculptedCliffButtressGeo(THREE, opts) {
  const {
    widthX = 6.5,
    depthZ = 6.0,
    height = 12.5,
    segR = 20,
    segH = 14,
    seed = 1.0,
    leanX = 0.0,
    leanZ = 0.0,
    undercut = 0.14,
  } = opts;

  const baseY = -1.8;
  const totalH = height - baseY;
  const rings = [];

  for (let iy = 0; iy <= segH; iy++) {
    const t = iy / segH;
    const yRaw = lerp(baseY, height, t);

    // Taper gently with strong terraced strata shelves & lower glacial undercut
    const baseTaper = lerp(1.16, 0.72, Math.pow(t, 0.88));
    const undercutCut = -undercut * Math.sin(clamp(t / 0.42, 0, 1) * Math.PI);
    const strataStep =
      Math.sin(t * Math.PI * 5.0 + seed * 1.3) * 0.085 +
      Math.sin(t * Math.PI * 11.0 + seed * 2.7) * 0.042 +
      Math.floor(t * 4.2 + 0.15) * -0.025;
    const profileScale = Math.max(0.42, baseTaper + undercutCut + strataStep);

    // Canyon overhang lean
    const cx = leanX * Math.pow(t, 1.35) * height * 0.11;
    const cz = leanZ * Math.pow(t, 1.35) * height * 0.11;

    const ring = [];
    for (let ir = 0; ir < segR; ir++) {
      const theta = (ir / segR) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Multi-frequency angular geological fracture folds
      const crag = 0.78 + 0.34 * fbm2D(cosT * 1.75 + seed * 2.1, sinT * 1.75 + t * 3.1 + seed, 3);
      const ridgeCleavage = Math.abs(Math.sin(theta * 2.5 + t * 2.6 + seed * 1.9)) * 0.16;
      const shelfFlare = (t > 0.86) ? (1.0 + (t - 0.86) * 0.55) : 1.0;

      const rx = widthX * 0.5 * profileScale * (crag + ridgeCleavage) * shelfFlare;
      const rz = depthZ * 0.5 * profileScale * (crag + ridgeCleavage * 0.85) * shelfFlare;

      // Subtle strata vertical ripple along rim
      const yBump = (iy > 0 && iy < segH)
        ? (noise2D(cosT * 2.6 + seed, t * 5.2 + sinT * 2.6) - 0.5) * (totalH / segH) * 0.55
        : (iy === segH ? (fbm2D(cosT * 1.9 + seed, sinT * 1.9, 2) - 0.5) * 0.75 : 0);

      ring.push([cx + cosT * rx, yRaw + yBump, cz - sinT * rz]);
    }
    rings.push(ring);
  }

  // Top center vertex to cap the cliff summit cleanly
  const topCx = leanX * height * 0.11;
  const topCz = leanZ * height * 0.11;
  const topCenter = [topCx, height + 0.32, topCz];

  const pos = [];
  const uv = [];

  function pushTri(a, b, c, ua, ub, uc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }

  for (let iy = 0; iy < segH; iy++) {
    const r0 = rings[iy];
    const r1 = rings[iy + 1];
    const v0 = (iy / segH) * 3.5;
    const v1 = ((iy + 1) / segH) * 3.5;
    for (let ir = 0; ir < segR; ir++) {
      const nr = (ir + 1) % segR;
      const u0 = (ir / segR) * 3.0;
      const u1 = ((ir + 1) / segR) * 3.0;
      pushTri(r0[ir], r0[nr], r1[ir], [u0, v0], [u1, v0], [u0, v1]);
      pushTri(r0[nr], r1[nr], r1[ir], [u1, v0], [u1, v1], [u0, v1]);
    }
  }

  // Summit cap
  const topRing = rings[segH];
  for (let ir = 0; ir < segR; ir++) {
    const nr = (ir + 1) % segR;
    pushTri(topRing[ir], topRing[nr], topCenter, [0.2, 0.8], [0.8, 0.8], [0.5, 1.0]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();

  // Slope-aware + strata-aware geological vertex colors
  const pAttr = geo.attributes.position;
  const nAttr = geo.attributes.normal;
  const cols = new Float32Array(pAttr.count * 3);

  const cBaseRock = new THREE.Color(0x2d3f5c);    // Deep canyon shadowed slate
  const cMidRock = new THREE.Color(0x526b8f);     // Weathered northern blue-granite
  const cHighRock = new THREE.Color(0x7892b5);    // Frost-dusted high cliff rock
  const cIceVein = new THREE.Color(0x5ec2ed);     // Embedded diagonal glacial ice seams
  const cSnowLedge = new THREE.Color(0xdbe9f7);   // Wind-packed shelf snow (calibrated anti-clip)
  const tmp = new THREE.Color();

  for (let i = 0; i < pAttr.count; i++) {
    const vx = pAttr.getX(i);
    const vy = pAttr.getY(i);
    const vz = pAttr.getZ(i);
    const ny = nAttr.getY(i);

    const hNorm = clamp((vy - baseY) / Math.max(1, totalH), 0, 1);
    const strataBand = 0.5 + 0.5 * Math.sin(vy * 1.45 + vx * 0.25 + seed * 3.1);

    if (hNorm < 0.45) {
      tmp.lerpColors(cBaseRock, cMidRock, hNorm / 0.45);
    } else {
      tmp.lerpColors(cMidRock, cHighRock, (hNorm - 0.45) / 0.55);
    }
    // Subtle dark strata banding
    tmp.multiplyScalar(0.84 + strataBand * 0.24);

    // Embedded glacial sapphire ice veins cutting diagonally across cliff strata
    const veinWave = Math.sin(vx * 0.42 + vy * 0.88 - vz * 0.36 + seed * 4.2);
    const veinMask = Math.pow(Math.max(0, veinWave), 9.0) * smoothstep(0.12, 0.85, hNorm);
    tmp.lerp(cIceVein, veinMask * 0.58);

    // Automatic snow clinging to upward-facing stepped ledges & summit plateau
    const snowMask = smoothstep(0.32, 0.72, ny) * smoothstep(0.15, 0.40, hNorm);
    tmp.lerp(cSnowLedge, snowMask * 0.90);

    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

/**
 * 2. Thick Wind-Sculpted Overhanging Cliff Snow Cornice
 *    Billowy top cushion with a curled, scalloped wind-carved overhanging snow lip.
 */
function createSnowCorniceGeo(THREE, opts) {
  const {
    width = 6.0,
    depth = 3.2,
    thickness = 1.25,
    overhangSignX = 1,
    overhangSignZ = 0,
    seed = 1.0,
  } = opts;

  const geo = new THREE.BoxGeometry(width, thickness, depth, 14, 5, 8);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);

  const cTopSnow = new THREE.Color(0xe6f2fc);
  const cMidSnow = new THREE.Color(0xc5def4);
  const cUnderLip = new THREE.Color(0x7eaed6);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const nx = vx / (width * 0.5);      // -1..1
    const ny = vy / (thickness * 0.5);  // -1..1
    const nz = vz / (depth * 0.5);      // -1..1

    // Smooth pillow rounding at edges
    const edgeRound = 1.0 - 0.24 * Math.pow(Math.abs(nx), 2.4) - 0.18 * Math.pow(Math.abs(nz), 2.4);

    // Measure proximity to the canyon-facing overhang lip
    const lipDot = clamp(nx * overhangSignX + nz * overhangSignZ, -1, 1);
    const lipFactor = smoothstep(-0.1, 1.0, lipDot);

    // Scalloped wind-blown cornice edge along canyon face
    const alongCoord = Math.abs(overhangSignX) > Math.abs(overhangSignZ) ? vz : vx;
    const scallop =
      Math.sin(alongCoord * 1.45 + seed * 3.1) * 0.28 +
      Math.cos(alongCoord * 2.8 - seed * 1.7) * 0.14;

    // Push overhanging snow lip outward & curl downward slightly like real alpine cornices
    const pushOut = lipFactor * (0.58 + scallop * 0.45) * smoothstep(-0.85, 0.85, ny);
    vx += overhangSignX * pushOut;
    vz += overhangSignZ * pushOut;

    const curlDown = lipFactor * lipFactor * (0.32 + Math.max(0, scallop) * 0.24);
    const billowTop = (fbm2D(vx * 0.45 + seed, vz * 0.45 - seed, 3) - 0.46) * 0.48 * smoothstep(-0.2, 0.9, ny);

    vy = vy * edgeRound + billowTop - curlDown * (ny < 0.35 ? 1.0 : 0.45);
    // Tuck rear bottom neatly into cliff crown
    if (ny < 0 && lipFactor < 0.35) {
      vx *= 0.92;
      vz *= 0.92;
    }

    pos.setXYZ(i, vx, vy, vz);

    // Cool glacial subsurface shadow under the overhanging cornice lip
    const topT = smoothstep(-0.75, 0.65, ny);
    tmp.lerpColors(cUnderLip, cMidSnow, topT);
    tmp.lerp(cTopSnow, smoothstep(0.15, 0.92, ny));
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 3. Sculpted Faceted Hanging Glacial Icicle (origin at top mount y = 0, hangs down to -length)
 */
function createHangingIcicleGeo(THREE, radius = 0.12, length = 1.65, seed = 1.0) {
  const sides = 6;
  const segs = 6;
  const rings = [];

  for (let s = 0; s < segs; s++) {
    const t = s / segs; // 0 = top mount -> near tip
    const y = -t * length;
    // Organic frozen water-drip bulges along icicle length
    const dripBulge = 1.0 + Math.sin(t * Math.PI * 4.5 + seed * 2.1) * 0.14 * (1.0 - t);
    const rRing = radius * Math.pow(1.0 - t, 0.78) * dripBulge;
    const ring = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const ir = rRing * (0.84 + 0.30 * hash2(i * 1.7 + seed, s * 2.3));
      ring.push([Math.cos(a) * ir, y, -Math.sin(a) * ir]);
    }
    rings.push(ring);
  }
  const tipPt = [(hash2(seed, 4.1) - 0.5) * radius * 0.22, -length, (hash2(seed, 8.3) - 0.5) * radius * 0.22];

  const pos = [];
  const uv = [];
  function pushTri(a, b, c, ua, ub, uc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }

  for (let s = 0; s < segs - 1; s++) {
    const r0 = rings[s];
    const r1 = rings[s + 1];
    const v0 = s / segs;
    const v1 = (s + 1) / segs;
    for (let i = 0; i < sides; i++) {
      const ni = (i + 1) % sides;
      const u0 = i / sides;
      const u1 = (i + 1) / sides;
      // r0 is higher (+Y), r1 is lower (-Y); outward CCW: (r1[i], r1[ni], r0[i])
      pushTri(r1[i], r1[ni], r0[i], [u0, v1], [u1, v1], [u0, v0]);
      pushTri(r1[ni], r0[ni], r0[i], [u1, v1], [u1, v0], [u0, v0]);
    }
  }
  const botRing = rings[segs - 1];
  for (let i = 0; i < sides; i++) {
    const ni = (i + 1) % sides;
    pushTri(tipPt, botRing[ni], botRing[i], [0.5, 1.0], [(i + 1) / sides, 0.85], [i / sides, 0.85]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 4. AAA Chamfered 6/7-Sided Asymmetric Glacial Crystal Prism
 *    - True beveled vertical edges (2*sides facets: alternating primary face + crisp chamfer bevel)
 *    - Asymmetric oblique rhombohedral shoulder termination + upper crown micro-bevel + off-center apex
 *    - Non-indexed razor-crisp flat facet normals + sapphire-to-diamond vertex gradient
 */
function createBeveledCrystalPrismGeo(THREE, opts) {
  const {
    sides = 6,
    radius = 0.42,
    height = 2.65,
    chamferFrac = 0.16,
    obliqueTilt = 0.17,
    seed = 1.0,
    isCore = false,
  } = opts;

  const M = sides * 2;
  const cornerAngles = [];
  const cornerRadii = [];
  const cornerIsBevelStart = [];
  const halfStep = Math.PI / sides;
  const bevelHalfA = halfStep * chamferFrac;

  for (let v = 0; v < sides; v++) {
    const baseA = (v / sides) * Math.PI * 2;
    const rIrreg = radius * (0.83 + 0.34 * hash2(v * 2.13 + seed * 1.7, seed * 4.91));
    // Two vertices around each corner create a crisp narrow chamfer edge strip
    cornerAngles.push(baseA - bevelHalfA);
    cornerRadii.push(rIrreg * 0.965);
    cornerIsBevelStart.push(true);

    cornerAngles.push(baseA + bevelHalfA);
    cornerRadii.push(rIrreg * 0.965);
    cornerIsBevelStart.push(false);
  }

  const obliqueDirX = Math.cos(seed * 2.65 + 0.4);
  const obliqueDirZ = Math.sin(seed * 2.65 + 0.4);
  const tipOffX = (hash2(seed * 1.3, 3.7) - 0.5) * radius * 0.34 + obliqueDirX * radius * 0.18;
  const tipOffZ = (hash2(seed * 1.3, 9.1) - 0.5) * radius * 0.34 + obliqueDirZ * radius * 0.18;

  const rootY = isCore ? 0.06 : -0.14;
  const waistY = height * (0.22 + 0.06 * hash2(seed, 2.9));
  const shoulderBaseY = height * (0.67 + 0.07 * hash2(seed, 5.7));

  const ringRoot = [];
  const ringWaist = [];
  const ringShoulder = [];
  const ringCrown = [];

  for (let j = 0; j < M; j++) {
    const ang = cornerAngles[j];
    const r0 = cornerRadii[j];
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);

    const obDot = cosA * obliqueDirX + sinA * obliqueDirZ;
    const shY = clamp(
      shoulderBaseY + obDot * height * obliqueTilt + (hash2(j * 1.9, seed) - 0.5) * height * 0.035,
      height * 0.52,
      height * 0.86
    );
    const crY = lerp(shY, height, 0.50);

    const rRoot = r0 * 0.93;
    const rWaist = r0 * 1.05;
    const rSh = r0 * 0.80;
    const rCr = r0 * 0.37;

    ringRoot.push([cosA * rRoot, rootY, -sinA * rRoot]);
    ringWaist.push([cosA * rWaist + tipOffX * 0.10, waistY, -sinA * rWaist + tipOffZ * 0.10]);
    ringShoulder.push([cosA * rSh + tipOffX * 0.32, shY, -sinA * rSh + tipOffZ * 0.32]);
    ringCrown.push([cosA * rCr + tipOffX * 0.68, crY, -sinA * rCr + tipOffZ * 0.68]);
  }
  const tipPt = [tipOffX, height, tipOffZ];

  const pos = [];
  const uv = [];
  const cols = [];

  // Optical glacial crystal color stops
  const cRoot = new THREE.Color(isCore ? 0x1644b8 : 0x5aaef0);
  const cMid = new THREE.Color(isCore ? 0x2ec0ff : 0xaeeaff);
  const cCrown = new THREE.Color(isCore ? 0x8ef2ff : 0xeafaff);
  const cBevelSpec = new THREE.Color(isCore ? 0x70e8ff : 0xffffff);
  const tmpC = new THREE.Color();

  function colorForPoint(pt, isChamferFace) {
    const yn = clamp(pt[1] / Math.max(0.01, height), 0, 1);
    if (yn < 0.52) {
      tmpC.lerpColors(cRoot, cMid, yn / 0.52);
    } else {
      tmpC.lerpColors(cMid, cCrown, (yn - 0.52) / 0.48);
    }
    if (isChamferFace) {
      tmpC.lerp(cBevelSpec, isCore ? 0.22 : 0.42);
    }
    return [tmpC.r, tmpC.g, tmpC.b];
  }

  function pushTri(a, b, c, ua, ub, uc, isChamfer) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    const ca = colorForPoint(a, isChamfer);
    const cb = colorForPoint(b, isChamfer);
    const cc = colorForPoint(c, isChamfer);
    cols.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
  }

  function emitBand(rLow, rHigh, v0, v1) {
    for (let j = 0; j < M; j++) {
      const nj = (j + 1) % M;
      const u0 = j / M;
      const u1 = (j + 1) / M;
      const isChamfer = cornerIsBevelStart[j];
      pushTri(rLow[j], rLow[nj], rHigh[j], [u0, v0], [u1, v0], [u0, v1], isChamfer);
      pushTri(rLow[nj], rHigh[nj], rHigh[j], [u1, v0], [u1, v1], [u0, v1], isChamfer);
    }
  }

  emitBand(ringRoot, ringWaist, 0.0, 0.24);
  emitBand(ringWaist, ringShoulder, 0.24, 0.72);
  emitBand(ringShoulder, ringCrown, 0.72, 0.88);

  for (let j = 0; j < M; j++) {
    const nj = (j + 1) % M;
    const u0 = j / M;
    const u1 = (j + 1) / M;
    const isChamfer = cornerIsBevelStart[j];
    pushTri(ringCrown[j], ringCrown[nj], tipPt, [u0, 0.88], [u1, 0.88], [(u0 + u1) * 0.5, 1.0], isChamfer);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 5. Jagged Shattered Ice Splinter Shard (碎冰棘片) for crystal cluster bases
 */
function createIceSplinterGeo(THREE, radius = 0.20, height = 0.78, seed = 1.0) {
  const sides = 5;
  const rBase = [];
  const rMid = [];
  const midY = height * 0.44;
  const tipX = (hash2(seed, 2.7) - 0.5) * radius * 0.55;
  const tipZ = (hash2(seed, 6.4) - 0.5) * radius * 0.55;

  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (hash2(i, seed) - 0.5) * 0.28;
    const r0 = radius * (0.65 + 0.58 * hash2(i * 3.1, seed));
    // Flatten slightly into blade-like ice splinter
    const bladeZ = 0.62;
    rBase.push([Math.cos(a) * r0, -0.06, -Math.sin(a) * r0 * bladeZ]);
    rMid.push([Math.cos(a) * r0 * 0.68 + tipX * 0.4, midY, -Math.sin(a) * r0 * bladeZ * 0.68 + tipZ * 0.4]);
  }
  const tip = [tipX, height, tipZ];

  const pos = [];
  const uv = [];
  const cols = [];
  const cBot = new THREE.Color(0x6ec5f4);
  const cTop = new THREE.Color(0xebfbff);
  const tmp = new THREE.Color();

  function pushT(a, b, c) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(0, 0, 1, 0, 0.5, 1);
    for (const pt of [a, b, c]) {
      tmp.lerpColors(cBot, cTop, clamp(pt[1] / Math.max(0.05, height), 0, 1));
      cols.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let i = 0; i < sides; i++) {
    const ni = (i + 1) % sides;
    pushT(rBase[i], rBase[ni], rMid[i]);
    pushT(rBase[ni], rMid[ni], rMid[i]);
    pushT(rMid[i], rMid[ni], tip);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 6. Wind-Eroded Rippled Sastrugi Snow Pedestal (雕塑风蚀波纹积雪底座)
 *    Asymmetric radial snowdrift mound with wind-scoured flutes & elongated leeward snow tail.
 */
function createWindSculptedSnowBaseGeo(THREE, radius = 1.65, height = 0.56, seed = 1.0) {
  const radSegs = 28;
  const ringSegs = 6;
  const verts = [];
  const uvs = [];
  const cols = [];
  const indices = [];

  const cSocketIce = new THREE.Color(0x88d4f5);  // Frost-cyan halo right where crystals erupt
  const cCrestSnow = new THREE.Color(0xe6f2fc);  // Sunlit snow crest (anti-overexposure)
  const cFluteBlue = new THREE.Color(0xa6c8e6);  // Wind-scoured cool blue sastrugi trough
  const tmp = new THREE.Color();

  // Center vertex (slightly depressed crater socket where crystals burst through)
  verts.push(0, height * 0.84, 0);
  uvs.push(0.5, 0.5);
  cols.push(cSocketIce.r, cSocketIce.g, cSocketIce.b);

  const windAngle = -0.35 + (hash2(seed, 1.9) - 0.5) * 0.45;
  const windCos = Math.cos(windAngle);
  const windSin = Math.sin(windAngle);

  for (let ir = 1; ir <= ringSegs; ir++) {
    const rFrac = ir / ringSegs; // 0 -> 1
    for (let ia = 0; ia < radSegs; ia++) {
      const a = (ia / radSegs) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);

      // Elongated leeward wind drift tail + organic multi-lobed drift outline
      const windAlign = cosA * windCos + sinA * windSin;
      const tailStretch = 1.0 + Math.max(0, windAlign) * 0.42;
      const lobe = 0.88 + 0.22 * noise2D(cosA * 1.9 + seed, sinA * 1.9 - seed);

      const rr = radius * rFrac * tailStretch * lobe;
      const vx = cosA * rr;
      const vz = -sinA * rr;

      // Sculpted dome profile + concentric wind-eroded sastrugi wave ripples
      const dome = Math.pow(Math.cos(rFrac * Math.PI * 0.5), 1.35);
      const crossWind = -vx * windSin + vz * windCos;
      const sastrugiWave =
        Math.sin(crossWind * 4.2 + seed * 2.3) * 0.085 +
        Math.cos(crossWind * 8.1 - vx * 2.0 + seed) * 0.035;
      const rimRidge = Math.sin(rFrac * Math.PI) * sastrugiWave;
      const vy = (ir === ringSegs) ? -0.10 : (dome * height + rimRidge);

      verts.push(vx, vy, vz);
      uvs.push(0.5 + vx / (radius * 2.8), 0.5 + vz / (radius * 2.8));

      // Color blend: frost-cyan crystal socket -> wind-rippled snow crests & blue flutes
      const fluteT = smoothstep(-0.08, 0.08, sastrugiWave);
      tmp.lerpColors(cFluteBlue, cCrestSnow, fluteT * 0.82 + 0.12);
      const socketBlend = 1.0 - smoothstep(0.10, 0.52, rFrac);
      tmp.lerp(cSocketIce, socketBlend * 0.58);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
  }

  // Center fan (outward +Y CCW)
  for (let ia = 0; ia < radSegs; ia++) {
    const na = (ia + 1) % radSegs;
    indices.push(0, 1 + ia, 1 + na);
  }
  // Concentric rings
  for (let ir = 1; ir < ringSegs; ir++) {
    const base0 = 1 + (ir - 1) * radSegs;
    const base1 = 1 + ir * radSegs;
    for (let ia = 0; ia < radSegs; ia++) {
      const na = (ia + 1) % radSegs;
      indices.push(base0 + ia, base1 + ia, base1 + na);
      indices.push(base0 + ia, base1 + na, base0 + na);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 7. Sculpted Multi-Ridge Faceted Glacial Alpine Peak (NOT a simple cone)
 *    Carves 4 sharp alpine arête ridges, fluted glacial cirques, and steep granite-vs-snow faces.
 */
function createSculptedAlpinePeakGeo(THREE, opts) {
  const { radius = 12.0, height = 24.0, seed = 1.0, farFade = 0.0, fogColor } = opts;
  const cone = new THREE.ConeGeometry(radius, height, 12, 6);
  const pos = cone.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const hNorm = clamp((vy + height * 0.5) / height, 0, 1);
    const ang = Math.atan2(vz, vx);

    // 4 knife-edge alpine arêtes + glacial cirque flutes
    const arete = 0.78 + 0.36 * Math.pow(Math.abs(Math.cos(ang * 2.0 + seed * 1.4)), 1.6);
    const crag = 0.86 + 0.32 * ridgedFbm2D(vx * 0.14 + seed * 2.3, vz * 0.14 + vy * 0.09, 2);
    const radialScale = lerp(arete * crag, 1.0, Math.pow(hNorm, 1.6));

    // Slight jagged ridge spine shear near apex
    const spineShiftX = Math.sin(seed * 3.1) * radius * 0.14 * hNorm;
    const spineShiftZ = Math.cos(seed * 2.4) * radius * 0.10 * hNorm;

    vx = vx * radialScale + spineShiftX;
    vz = vz * radialScale + spineShiftZ;
    pos.setXYZ(i, vx, vy, vz);
  }

  const flat = cone.toNonIndexed();
  cone.dispose();
  flat.computeVertexNormals();

  const fp = flat.attributes.position;
  const fn = flat.attributes.normal;
  const cols = new Float32Array(fp.count * 3);

  const cSnowLit = new THREE.Color(0xe6f2fc);
  const cSnowShade = new THREE.Color(0x9bc0e0);
  const cGranite = new THREE.Color(0x4b6588);
  const cBaseMist = new THREE.Color(0x88accf);
  const tmp = new THREE.Color();

  for (let i = 0; i < fp.count; i++) {
    const vy = fp.getY(i);
    const nx = fn.getX(i);
    const ny = fn.getY(i);
    const hNorm = clamp((vy + height * 0.5) / height, 0, 1);

    const sunSide = smoothstep(-0.35, 0.55, nx * 0.7 + ny * 0.55);
    const snowHold = smoothstep(0.24, 0.62, ny + hNorm * 0.32);

    tmp.lerpColors(cGranite, cSnowShade, snowHold * 0.72);
    tmp.lerp(cSnowLit, snowHold * sunSide * 0.88);
    tmp.lerp(cBaseMist, (1.0 - smoothstep(0.0, 0.42, hNorm)) * 0.68);
    if (farFade > 0 && fogColor) {
      tmp.lerp(fogColor, farFade);
    }

    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }

  flat.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return flat;
}

// ---------------------------------------------------------------------------
// Main Biome Builder Export
// ---------------------------------------------------------------------------
export function buildCanyonBiome(THREE, texLib = {}) {
  const group = new THREE.Group();
  group.name = 'biome_canyon_hulan_frozen_gorge';

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

  const sunDirNorm = new THREE.Vector3(6.5, 16.5, -11.5).normalize();
  const baseFogColor = new THREE.Color(0xb4cde2);

  const glowDiscTex =
    resolveSingleTex(texLib.softGlowDisc) || createFallbackGlowTexture(THREE, trackedTextures);
  const crateWoodTex = createNorthernCrateTexture(THREE, trackedTextures);
  const redCrossTex = createMedicalEmblemTexture(THREE, 'red', trackedTextures);
  const blueCrossTex = createMedicalEmblemTexture(THREE, 'blue', trackedTextures);

  // =========================================================================
  // 1. NORTHERN CANYON WINTER SKY DOME (GLSL ShaderMaterial)
  // =========================================================================
  const skyGeo = trackGeo(new THREE.SphereGeometry(98, 40, 24));
  const skyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDirNorm.clone() },
    uHorizonCol: { value: new THREE.Color(0xbcd6ec) },
    uMidSkyCol: { value: new THREE.Color(0x739fc7) },
    uZenithCol: { value: new THREE.Color(0x345a8c) },
    uHaloCol: { value: new THREE.Color(0xe2f3ff) },
    uCloudCol: { value: new THREE.Color(0xdcebf7) },
    uCloudShadeCol: { value: new THREE.Color(0x6e8fb5) },
    uAuroraCol: { value: new THREE.Color(0x6888e8) },
    uAuroraStrength: { value: 0.08 },
    uSunStrength: { value: 0.45 },
    uCloudOpacity: { value: 0.72 },
    uWindSpeed: { value: 1.0 },
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
        uniform vec3 uSunDir;
        uniform vec3 uHorizonCol;
        uniform vec3 uMidSkyCol;
        uniform vec3 uZenithCol;
        uniform vec3 uHaloCol;
        uniform vec3 uCloudCol;
        uniform vec3 uCloudShadeCol;
        uniform vec3 uAuroraCol;
        uniform float uAuroraStrength;
        uniform float uSunStrength;
        uniform float uCloudOpacity;
        uniform float uWindSpeed;
        varying vec3 vDir;

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
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * vnoise(p);
            p = rot * p * 2.04;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);

          // Crisp northern winter sky gradient
          vec3 sky = mix(uHorizonCol, uMidSkyCol, smoothstep(0.0, 0.34, h));
          sky = mix(sky, uZenithCol, smoothstep(0.28, 0.92, h));

          // Cold winter sun corona breaking through canyon cloud slit
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          vec3 scatter = uHaloCol * pow(sunDot, 4.2) * 0.24;
          vec3 corona = uHaloCol * pow(sunDot, 26.0) * 0.36;
          sky += (scatter + corona) * uSunStrength;

          // Subtle polar storm-veil / violet-cyan mana aurora ribbon in upper canyon sky (boosted in W2)
          if (dir.y > 0.08 && uAuroraStrength > 0.005) {
            float aWave = sin(dir.x * 5.2 + uTime * 0.28 * uWindSpeed + dir.z * 2.1);
            float aCurtain = smoothstep(0.10, 0.42, dir.y) * (1.0 - smoothstep(0.48, 0.85, dir.y));
            float aStreak = fbm(vec2(dir.x * 3.8 + uTime * 0.06 * uWindSpeed, dir.y * 2.2));
            float aurora = pow(clamp(aStreak * (0.65 + 0.35 * aWave), 0.0, 1.0), 2.2) * aCurtain;
            sky += uAuroraCol * aurora * uAuroraStrength;
          }

          // Wind-sheared high-altitude northern storm clouds streaming across the canyon slit
          if (dir.y > 0.02) {
            vec2 cloudUv = dir.xz / (dir.y + 0.28) * vec2(1.15, 0.82);
            cloudUv += vec2(uTime * 0.022 * uWindSpeed, -uTime * 0.009 * uWindSpeed);
            float c1 = fbm(cloudUv * 1.45);
            float c2 = fbm(cloudUv * 3.05 + vec2(4.1, -2.3));
            float density = smoothstep(0.42, 0.78, c1 * 0.66 + c2 * 0.34);
            density *= smoothstep(0.02, 0.18, dir.y) * (1.0 - smoothstep(0.72, 0.98, dir.y) * 0.35);
            vec3 cCol = mix(uCloudShadeCol, uCloudCol, smoothstep(0.32, 0.78, c1) * 0.7 + pow(sunDot, 2.4) * 0.35);
            sky = mix(sky, cCol, density * uCloudOpacity);
          }

          // Smooth gorge mist blend below horizon
          if (dir.y < 0.0) {
            sky = mix(uHorizonCol, uHorizonCol * 0.76, smoothstep(0.0, -0.28, dir.y));
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
  );
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'canyon_winter_sky_dome';
  skyMesh.renderOrder = -10;
  group.add(skyMesh);

  // =========================================================================
  // 2. SCULPTED CANYON FLOOR + PERMAFROST SUPPLY ROAD (WAGON RUTS & ICE CRACKS)
  // =========================================================================
  const terrainW = 74;
  const terrainD = 62;
  const terrainGeo = trackGeo(new THREE.PlaneGeometry(terrainW, terrainD, 152, 124));
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, -6);

  const tPos = terrainGeo.attributes.position;
  const tCol = new Float32Array(tPos.count * 3);

  // Calibrated anti-overexposure snow & permafrost palette (crisp detail without white clip)
  const cRoadSnow = new THREE.Color(0xdbe8f5);
  const cRutPacked = new THREE.Color(0x9ab8d4);
  const cDriftSnow = new THREE.Color(0xe6f1fb);
  const cBankShade = new THREE.Color(0xadc9e3);
  const cPermafrostIce = new THREE.Color(0x6ba6d6);
  const cChasmDeep = new THREE.Color(0x28476e);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    const y = getTerrainHeight(x, z);
    tPos.setY(i, y);

    const roadZ = getCanyonRoadCenterZ(x);
    const dRoad = Math.abs(z - roadZ);

    // Dual wagon wheel track bands spaced ~1.45m apart along the supply pass
    const rutLeft = Math.exp(-Math.pow((dRoad - 0.76) / 0.24, 2));
    const rutRight = Math.exp(-Math.pow((dRoad - 1.92) / 0.28, 2));
    const roadMask = 1.0 - smoothstep(1.8, 3.6, dRoad);
    const combatFlatMask = 1.0 - smoothstep(6.2, 11.2, Math.hypot(x * 0.85, z * 1.35));

    // Base snow tone: cool-shaded outer banks -> sculpted supply road snow
    tmpCol.copy(cBankShade).lerp(cDriftSnow, 0.35 + 0.55 * combatFlatMask);
    tmpCol.lerp(cRoadSnow, roadMask * 0.65);

    // Compacted cool ice-blue wagon ruts along supply line
    const rutShade = clamp((rutLeft * 0.72 + rutRight * 0.42) * smoothstep(9.5, 4.5, Math.abs(z)), 0, 0.85);
    tmpCol.lerp(cRutPacked, rutShade * 0.72);

    // Exposed permafrost glacial blue ice patches along eastern approach & cliff edges
    const icePatchN = ridgedFbm2D(x * 0.22 + 3.7, z * 0.22 - 1.8, 3);
    const icePatch = smoothstep(0.56, 0.82, icePatchN) * (0.28 + 0.42 * smoothstep(-1.0, 6.5, x));
    tmpCol.lerp(cPermafrostIce, icePatch * 0.52);

    // Deep frozen gorge shading below y = -0.35
    if (y < -0.25) {
      tmpCol.lerp(cChasmDeep, smoothstep(-0.25, -2.4, y) * 0.86);
    }

    // Fine wind-swept sastrugi tonal variation
    const sastrugi = (fbm2D(x * 0.36 + z * 0.18, z * 0.62 - x * 0.14, 2) - 0.5) * 0.065;
    tCol[i * 3] = clamp(tmpCol.r + sastrugi, 0, 1);
    tCol[i * 3 + 1] = clamp(tmpCol.g + sastrugi * 0.9, 0, 1);
    tCol[i * 3 + 2] = clamp(tmpCol.b + sastrugi * 0.5, 0, 1);
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  terrainGeo.computeVertexNormals();

  const snowTex = resolveTexBundle(THREE, texLib.snowGround, 14, 12, trackedTextures);
  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: snowTex.roughnessMap ? 0.88 : 0.74,
      metalness: 0.03,
      ...(snowTex.map ? { map: snowTex.map } : {}),
      ...(snowTex.normalMap ? { normalMap: snowTex.normalMap, normalScale: new THREE.Vector2(0.68, 0.68) } : {}),
      ...(snowTex.bumpMap ? { bumpMap: snowTex.bumpMap, bumpScale: 0.09 } : {}),
      ...(snowTex.roughnessMap ? { roughnessMap: snowTex.roughnessMap } : {}),
    })
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'canyon_permafrost_terrain';
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Flush GLSL Permafrost Ice-Crack & Compacted Supply Wagon-Rut Surface Overlay (y = 0.008)
  // Strictly flat & non-blocking, adds crisp Voronoi glacial fractures, frost-vein shimmer & compacted ruts
  const roadDecalGeo = trackGeo(new THREE.PlaneGeometry(18.0, 9.6, 1, 1));
  roadDecalGeo.rotateX(-Math.PI / 2);

  const roadDecalUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDirNorm.clone() },
    uCrackColor: { value: new THREE.Color(0x286eb8) },
    uCrackRimColor: { value: new THREE.Color(0xcff2ff) },
    uRutColor: { value: new THREE.Color(0x7ba0c4) },
    uCrackGlow: { value: 0.24 },
  };

  const roadDecalMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      uniforms: roadDecalUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uCrackColor;
        uniform vec3 uCrackRimColor;
        uniform vec3 uRutColor;
        uniform float uCrackGlow;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }
        vec2 hash22(vec2 p) {
          float n = hash21(p);
          return vec2(n, hash21(p + n * 19.7));
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
        float voronoiEdge(vec2 p) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float d1 = 8.0;
          float d2 = 8.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash22(n + g);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if (d < d1) { d2 = d1; d1 = d; }
              else if (d < d2) { d2 = d; }
            }
          }
          return sqrt(d2) - sqrt(d1);
        }

        void main() {
          // Soft elliptical edge feather so decal melts invisibly into surrounding snow
          vec2 eUv = (vUv - 0.5) * 2.0;
          float edgeFade = 1.0 - smoothstep(0.68, 1.0, length(eUv));
          if (edgeFade <= 0.002) discard;

          vec2 wp = vWorldPos.xz;
          float roadZ = -0.25 + sin(wp.x * 0.14 + 0.45) * 0.72 - wp.x * 0.04;
          float dz = wp.y - roadZ;
          float wobble = (vnoise(wp * 0.9) - 0.5) * 0.22;

          // Compacted wagon wheel grooves (paired ruts + faint central draft-beast tread)
          float rutA = exp(-pow((dz - 0.78 + wobble * 0.4) / 0.22, 2.0));
          float rutB = exp(-pow((dz + 0.78 + wobble * 0.4) / 0.22, 2.0));
          float tread = exp(-pow((dz + wobble * 0.6) / 0.48, 2.0)) * (0.45 + 0.55 * vnoise(vec2(wp.x * 2.6, wp.y * 1.8)));
          float rutMask = clamp((rutA + rutB) * 0.52 + tread * 0.16, 0.0, 0.68);

          // Glacial permafrost polygonal crack network (denser toward enemy right-flank & back cracks)
          float c1 = voronoiEdge(wp * 0.68 + vec2(wobble * 0.45));
          float c2 = voronoiEdge(wp * 1.48 - vec2(wobble * 0.35) + 5.2);
          float majorCrack = 1.0 - smoothstep(0.0, 0.048, c1);
          float minorCrack = (1.0 - smoothstep(0.0, 0.032, c2)) * 0.58;
          float crackRim = smoothstep(0.035, 0.075, c1) * (1.0 - smoothstep(0.075, 0.135, c1));

          // Concentrate dramatic frozen ice cracks in natural permafrost patches
          float patchN = vnoise(wp * 0.24 + vec2(2.4, -1.7));
          float patchMask = smoothstep(0.32, 0.68, patchN + smoothstep(-2.0, 6.0, wp.x) * 0.18);
          float crackVal = (majorCrack + minorCrack * 0.7) * patchMask;

          // Subtle shimmering frost-glint along exposed permafrost veins
          float pulse = 0.84 + 0.16 * sin(uTime * 1.65 + wp.x * 0.75 - wp.y * 0.9);
          vec3 col = mix(uRutColor, uCrackColor, smoothstep(0.05, 0.55, crackVal));
          col += uCrackRimColor * (crackRim * patchMask * 0.38 + majorCrack * patchMask * uCrackGlow * pulse);

          float alpha = clamp(rutMask * 0.36 + crackVal * 0.54 + crackRim * patchMask * 0.16, 0.0, 0.68) * edgeFade;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );
  const roadDecalMesh = new THREE.Mesh(roadDecalGeo, roadDecalMat);
  roadDecalMesh.name = 'hulan_permafrost_supply_road_decal';
  roadDecalMesh.position.set(0.0, 0.008, -0.2);
  roadDecalMesh.renderOrder = 1;
  group.add(roadDecalMesh);

  // =========================================================================
  // 3. DEEP GLACIAL RIFT CHASM ICE FLOOR (z ∈ [-23, -8.2], y = -2.05)
  // =========================================================================
  const chasmGeo = trackGeo(new THREE.PlaneGeometry(34, 18, 1, 1));
  chasmGeo.rotateX(-Math.PI / 2);

  const chasmUniforms = {
    uTime: { value: 0 },
    uFogColor: { value: baseFogColor.clone() },
    uFogNear: { value: 16.0 },
    uFogFar: { value: 50.0 },
    uDeepCol: { value: new THREE.Color(0x163963) },
    uVeinCol: { value: new THREE.Color(0x4fc6f2) },
    uMistCol: { value: new THREE.Color(0xa6cde8) },
  };
  const chasmMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: chasmUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform vec3 uDeepCol;
        uniform vec3 uVeinCol;
        uniform vec3 uMistCol;
        varying vec3 vWorldPos;
        varying vec2 vUv;

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

        void main() {
          vec2 p = vWorldPos.xz;
          float n1 = vnoise(p * 0.42 + vec2(uTime * 0.06, -uTime * 0.02));
          float n2 = vnoise(p * 1.15 - vec2(uTime * 0.10, uTime * 0.03));
          float fissure = pow(clamp(1.0 - abs(n2 * 2.0 - 1.0), 0.0, 1.0), 5.0);
          float chasmMist = smoothstep(0.28, 0.85, n1);

          vec3 col = mix(uDeepCol, uVeinCol, fissure * 0.72 + 0.14);
          col = mix(col, uMistCol, chasmMist * 0.48);

          float camDist = length(cameraPosition - vWorldPos);
          float fogFactor = smoothstep(uFogNear, uFogFar, camDist);
          col = mix(col, uFogColor, fogFactor);

          float edge = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x))
                     * smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y));
          gl_FragColor = vec4(col, edge * 0.94);
        }
      `,
    })
  );
  const chasmMesh = new THREE.Mesh(chasmGeo, chasmMat);
  chasmMesh.name = 'glacial_rift_chasm_floor';
  chasmMesh.position.set(0, -1.95, -14.5);
  group.add(chasmMesh);

  // =========================================================================
  // 4. SHARED MATERIALS (Cliff Granite, Snow Cornices, Stone Masonry, Wood, Metal)
  // =========================================================================
  const stoneTex = resolveTexBundle(THREE, texLib.courtyardStone, 3, 3, trackedTextures);
  const cliffRockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: stoneTex.roughnessMap ? 0.90 : 0.82,
      metalness: 0.06,
      flatShading: true,
      ...(stoneTex.normalMap ? { normalMap: stoneTex.normalMap, normalScale: new THREE.Vector2(0.55, 0.55) } : {}),
      ...(stoneTex.bumpMap ? { bumpMap: stoneTex.bumpMap, bumpScale: 0.08 } : {}),
      ...(stoneTex.roughnessMap ? { roughnessMap: stoneTex.roughnessMap } : {}),
    })
  );

  const snowCapTex = resolveTexBundle(THREE, texLib.snowGround, 3, 3, trackedTextures);
  const snowCorniceMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: snowCapTex.roughnessMap ? 0.84 : 0.68,
      metalness: 0.03,
      ...(snowCapTex.map ? { map: snowCapTex.map } : {}),
      ...(snowCapTex.normalMap ? { normalMap: snowCapTex.normalMap, normalScale: new THREE.Vector2(0.38, 0.38) } : {}),
      ...(snowCapTex.roughnessMap ? { roughnessMap: snowCapTex.roughnessMap } : {}),
    })
  );

  const snowPillowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6f1fb,
      roughness: snowCapTex.roughnessMap ? 0.84 : 0.66,
      metalness: 0.03,
      ...(snowCapTex.map ? { map: snowCapTex.map } : {}),
      ...(snowCapTex.normalMap ? { normalMap: snowCapTex.normalMap, normalScale: new THREE.Vector2(0.32, 0.32) } : {}),
    })
  );

  const bridgeStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2d4e6,
      roughness: stoneTex.roughnessMap ? 0.88 : 0.78,
      metalness: 0.06,
      ...(stoneTex.map ? { map: stoneTex.map } : {}),
      ...(stoneTex.normalMap ? { normalMap: stoneTex.normalMap, normalScale: new THREE.Vector2(0.65, 0.65) } : {}),
      ...(stoneTex.roughnessMap ? { roughnessMap: stoneTex.roughnessMap } : {}),
    })
  );

  const barkTex = resolveTexBundle(THREE, texLib.darkBark, 2, 3, trackedTextures);
  const timberStakeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6f5542,
      roughness: barkTex.roughnessMap ? 0.92 : 0.86,
      metalness: 0.03,
      ...(barkTex.map ? { map: barkTex.map } : {}),
      ...(barkTex.normalMap ? { normalMap: barkTex.normalMap, normalScale: new THREE.Vector2(0.75, 0.75) } : {}),
      ...(barkTex.bumpMap ? { bumpMap: barkTex.bumpMap, bumpScale: 0.1 } : {}),
    })
  );

  const chiseledTipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc9b08e,
      roughness: 0.80,
      metalness: 0.02,
    })
  );

  const crateWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4c2ad,
      roughness: 0.84,
      metalness: 0.03,
      ...(crateWoodTex ? { map: crateWoodTex } : (barkTex.map ? { map: barkTex.map } : {})),
    })
  );

  const crateFrameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6c513e,
      roughness: 0.88,
      metalness: 0.04,
      ...(crateWoodTex ? { map: crateWoodTex } : {}),
    })
  );

  const forgedIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3a4654,
      roughness: 0.42,
      metalness: 0.82,
    })
  );

  const brassClaspMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd2b274,
      roughness: 0.34,
      metalness: 0.84,
    })
  );

  const medicalBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdce7f2,
      roughness: 0.62,
      metalness: 0.05,
    })
  );

  const redCrossFaceMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.56,
      metalness: 0.04,
      ...(redCrossTex ? { map: redCrossTex } : { color: 0xd6404a }),
    })
  );

  const blueCrossFaceMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.56,
      metalness: 0.04,
      ...(blueCrossTex ? { map: blueCrossTex } : { color: 0x1658eb }),
    })
  );

  const canvasTarpMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x456085,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );

  // =========================================================================
  // 5. TOWERING MULTI-STRATA GLACIAL CANYON CLIFFS + SNOW CORNICES + ICICLES
  //    Left wall x < -9, Right wall x > 9, Rear gorge walls z < -7.5
  //    Converges cleanly into a dramatic "一线天" northern glacial sky-slit!
  // =========================================================================
  const cliffParts = [];
  const corniceParts = [];
  const icicleAnchorRows = [];

  const cliffSpecs = [
    // --- Left Canyon Wall Complex (marching deep & slightly converging for grand perspective) ---
    { x: -12.6, z: 3.4,  w: 6.4, d: 6.8, h: 8.6,  leanX: 0.16, leanZ: 0.02, seed: 11.2, side: -1, midCorniceY: 4.9 },
    { x: -12.2, z: -2.0, w: 6.8, d: 7.4, h: 12.6, leanX: 0.22, leanZ: 0.04, seed: 14.7, side: -1, midCorniceY: 6.8 },
    { x: -13.0, z: -7.8, w: 7.4, d: 7.8, h: 15.2, leanX: 0.24, leanZ: 0.06, seed: 18.3, side: -1, midCorniceY: 8.2 },
    { x: -11.4, z: -13.5,w: 7.6, d: 8.2, h: 17.8, leanX: 0.20, leanZ: 0.08, seed: 22.9, side: -1, midCorniceY: 9.6 },
    { x: -9.8,  z: -19.6,w: 8.2, d: 8.4, h: 20.5, leanX: 0.18, leanZ: 0.10, seed: 27.4, side: -1, midCorniceY: 11.2 },
    { x: -17.4, z: -12.0,w: 9.2, d: 11.5,h: 22.2, leanX: 0.10, leanZ: 0.04, seed: 31.1, side: -1, midCorniceY: 0 },

    // --- Right Canyon Wall Complex (asymmetric sheer glacial buttresses) ---
    { x: 12.8,  z: 3.2,  w: 6.6, d: 6.8, h: 9.1,  leanX: -0.16, leanZ: 0.02, seed: 41.5, side: 1, midCorniceY: 5.2 },
    { x: 12.5,  z: -2.4, w: 7.0, d: 7.6, h: 13.4, leanX: -0.22, leanZ: 0.05, seed: 45.8, side: 1, midCorniceY: 7.1 },
    { x: 13.2,  z: -8.2, w: 7.6, d: 8.0, h: 16.0, leanX: -0.24, leanZ: 0.06, seed: 49.2, side: 1, midCorniceY: 8.5 },
    { x: 11.6,  z: -14.0,w: 7.8, d: 8.4, h: 18.4, leanX: -0.20, leanZ: 0.08, seed: 53.6, side: 1, midCorniceY: 9.9 },
    { x: 9.6,   z: -20.2,w: 8.4, d: 8.6, h: 21.2, leanX: -0.18, leanZ: 0.10, seed: 58.1, side: 1, midCorniceY: 11.5 },
    { x: 17.8,  z: -12.6,w: 9.6, d: 12.0,h: 23.0, leanX: -0.10, leanZ: 0.04, seed: 62.7, side: 1, midCorniceY: 0 },

    // --- Rear Gorge Flanking Crags framing the central V-notch vista ---
    { x: -6.9,  z: -24.5,w: 6.8, d: 7.2, h: 18.5, leanX: 0.14, leanZ: 0.12, seed: 71.3, side: -1, midCorniceY: 0 },
    { x: 7.1,   z: -25.0,w: 7.0, d: 7.4, h: 19.2, leanX: -0.14, leanZ: 0.12, seed: 76.9, side: 1, midCorniceY: 0 },
  ];

  // Add a dramatic jutting upper-left cliff outcrop ledge (echoing Aino's spear vantage in Act 07)
  cliffSpecs.push({
    x: -10.2, z: -8.8, w: 4.8, d: 4.4, h: 7.4, leanX: 0.28, leanZ: 0.08, seed: 83.4, side: -1, midCorniceY: 0,
  });

  for (let i = 0; i < cliffSpecs.length; i++) {
    const cs = cliffSpecs[i];
    const baseY = Math.min(0, getTerrainHeight(cs.x, cs.z)) - 0.35;
    const buttress = createSculptedCliffButtressGeo(THREE, {
      widthX: cs.w,
      depthZ: cs.d,
      height: cs.h,
      segR: 18,
      segH: 13,
      seed: cs.seed,
      leanX: cs.leanX,
      leanZ: cs.leanZ,
      undercut: 0.14,
    });
    buttress.translate(cs.x, baseY, cs.z);
    cliffParts.push(buttress);

    const topShiftX = cs.leanX * cs.h * 0.11;
    const topShiftZ = cs.leanZ * cs.h * 0.11;
    const inwardSign = -cs.side; // +1 for left cliffs (overhang toward +X), -1 for right cliffs

    // Thick wind-carved overhanging summit snow cornice
    const summitCornice = createSnowCorniceGeo(THREE, {
      width: cs.w * 0.78,
      depth: cs.d * 0.80,
      thickness: 1.35 + (i % 3) * 0.22,
      overhangSignX: inwardSign,
      overhangSignZ: 0.22,
      seed: cs.seed + 5.1,
    });
    const corniceY = baseY + cs.h + 0.12;
    const corniceX = cs.x + topShiftX + inwardSign * (cs.w * 0.14);
    const corniceZ = cs.z + topShiftZ;
    summitCornice.translate(corniceX, corniceY, corniceZ);
    corniceParts.push(summitCornice);

    // Register upper icicle curtain row directly beneath the summit overhanging lip
    const lipX = corniceX + inwardSign * (cs.w * 0.42);
    icicleAnchorRows.push({
      x: lipX,
      y: corniceY - 0.35,
      zStart: corniceZ - cs.d * 0.36,
      zEnd: corniceZ + cs.d * 0.36,
      inwardSign,
      count: 13,
      lenMin: 1.05,
      lenMax: 2.65,
      seed: cs.seed * 3.1,
    });

    // Mid-cliff snow ledge cornice + secondary icicle curtain for dramatic multi-tiered canyon walls
    if (cs.midCorniceY > 0) {
      const frac = cs.midCorniceY / cs.h;
      const midX = cs.x + cs.leanX * Math.pow(frac, 1.35) * cs.h * 0.11 + inwardSign * (cs.w * 0.34);
      const midZ = cs.z + cs.leanZ * Math.pow(frac, 1.35) * cs.h * 0.11;
      const midY = baseY + cs.midCorniceY;
      const midCornice = createSnowCorniceGeo(THREE, {
        width: cs.w * 0.44,
        depth: cs.d * 0.66,
        thickness: 0.92,
        overhangSignX: inwardSign,
        overhangSignZ: 0.15,
        seed: cs.seed + 19.3,
      });
      midCornice.translate(midX, midY, midZ);
      corniceParts.push(midCornice);

      icicleAnchorRows.push({
        x: midX + inwardSign * (cs.w * 0.24),
        y: midY - 0.26,
        zStart: midZ - cs.d * 0.30,
        zEnd: midZ + cs.d * 0.30,
        inwardSign,
        count: 11,
        lenMin: 0.72,
        lenMax: 1.95,
        seed: cs.seed * 5.7,
      });
    }
  }

  const cliffsMergedGeo = trackGeo(mergeGeometries(THREE, cliffParts));
  const cliffsMesh = new THREE.Mesh(cliffsMergedGeo, cliffRockMat);
  cliffsMesh.name = 'canyon_glacial_cliff_walls';
  cliffsMesh.castShadow = true;
  cliffsMesh.receiveShadow = true;
  group.add(cliffsMesh);

  const cornicesMergedGeo = trackGeo(mergeGeometries(THREE, corniceParts));
  const cornicesMesh = new THREE.Mesh(cornicesMergedGeo, snowCorniceMat);
  cornicesMesh.name = 'canyon_overhanging_snow_cornices';
  cornicesMesh.castShadow = true;
  cornicesMesh.receiveShadow = true;
  group.add(cornicesMesh);

  // =========================================================================
  // 6. AAA DOUBLE-LAYER REFRACTIVE CRYSTAL MATERIALS & HANGING ICICLE CURTAINS
  // =========================================================================
  const iceTex = resolveTexBundle(THREE, texLib.iceCrystal, 1.4, 2.0, trackedTextures);
  const crystalRimColorUniform = { value: new THREE.Color(0xc8f4ff) };
  const crystalRimStrengthUniform = { value: 0.72 };

  // Outer Translucent High-Refraction Crystal Shell (Physical IOR + Clearcoat + Analytic Fresnel)
  const crystalOuterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x2ca2e6,
      emissiveIntensity: 0.28,
      roughness: iceTex.roughnessMap ? 0.14 : 0.08,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      ior: 1.52,
      reflectivity: 1.0,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      flatShading: true,
      ...(iceTex.map ? { map: iceTex.map } : {}),
      ...(iceTex.normalMap ? { normalMap: iceTex.normalMap, normalScale: new THREE.Vector2(0.45, 0.45) } : {}),
      ...(iceTex.roughnessMap ? { roughnessMap: iceTex.roughnessMap } : {}),
      ...(iceTex.emissiveMap ? { emissiveMap: iceTex.emissiveMap } : {}),
    })
  );
  crystalOuterMat.customProgramCacheKey = () => 'canyon_crystal_fresnel_v1';
  crystalOuterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCrystalRimColor = crystalRimColorUniform;
    shader.uniforms.uCrystalRimStrength = crystalRimStrengthUniform;
    shader.fragmentShader =
      `uniform vec3 uCrystalRimColor;\nuniform float uCrystalRimStrength;\n` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 cViewDir = normalize(vViewPosition);
          float cNdotV = clamp(abs(dot(normalize(normal), cViewDir)), 0.0, 1.0);
          float cFresnel = pow(1.0 - cNdotV, 2.4);
          float cEdgeGlint = pow(1.0 - cNdotV, 5.5);
          totalEmissiveRadiance += uCrystalRimColor * (cFresnel * uCrystalRimStrength + cEdgeGlint * 0.45);
          diffuseColor.a = clamp(diffuseColor.a + cFresnel * 0.34, 0.28, 0.94);
        }`
      );
  };

  // Translucent glossy glacial icicle & splinter material
  const icicleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd0f2ff,
      emissive: 0x207ec4,
      emissiveIntensity: 0.24,
      roughness: 0.09,
      metalness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
      transparent: true,
      opacity: 0.80,
      flatShading: true,
      ...(iceTex.normalMap ? { normalMap: iceTex.normalMap, normalScale: new THREE.Vector2(0.32, 0.32) } : {}),
    })
  );

  // Splinter shard material (vertex-colored sapphire-to-ice-white jagged shards around crystal bases)
  const splinterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x248ed4,
      emissiveIntensity: 0.26,
      roughness: 0.12,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
    })
  );

  // Instanced Hanging Glacial Icicle Curtains beneath every cliff snow cornice & overhang
  const hangingIcicleGeo = trackGeo(createHangingIcicleGeo(THREE, 0.16, 1.0, 7.3));
  const icicleTransforms = [];
  const rngIcicles = createRng(55109);
  for (let r = 0; r < icicleAnchorRows.length; r++) {
    const row = icicleAnchorRows[r];
    for (let k = 0; k < row.count; k++) {
      const frac = row.count > 1 ? k / (row.count - 1) : 0.5;
      const zPos = lerp(row.zStart, row.zEnd, frac) + (rngIcicles() - 0.5) * 0.36;
      const xPos = row.x + (rngIcicles() - 0.5) * 0.42;
      const yPos = row.y + (rngIcicles() - 0.5) * 0.22;
      // Natural alternating organ-pipe curtain rhythm (tall primary spears + shorter companion teeth)
      const organPulse = 0.55 + 0.45 * Math.abs(Math.sin(frac * Math.PI * 3.5 + row.seed));
      const len = lerp(row.lenMin, row.lenMax, rngIcicles() * 0.55 + organPulse * 0.45);
      const radScale = (0.72 + rngIcicles() * 0.78) * (0.7 + len * 0.16);
      icicleTransforms.push({
        x: xPos,
        y: yPos,
        z: zPos,
        sx: radScale,
        sy: len,
        sz: radScale,
        rx: (rngIcicles() - 0.5) * 0.09,
        ry: rngIcicles() * Math.PI * 2,
        rz: (rngIcicles() - 0.5) * 0.08 + row.inwardSign * 0.04,
      });
    }
  }

  // Also add hanging icicle teeth along the shattered ice bridge undersides (added after bridge pos known)
  const bridgeIcicleSpecs = [
    { x: -3.2, y: 0.85, z: -9.5, count: 9, spanX: 2.2 },
    { x: 3.3,  y: 0.90, z: -9.3, count: 9, spanX: 2.3 },
  ];
  for (const bi of bridgeIcicleSpecs) {
    for (let k = 0; k < bi.count; k++) {
      const f = k / (bi.count - 1);
      icicleTransforms.push({
        x: bi.x + (f - 0.5) * bi.spanX,
        y: bi.y + (rngIcicles() - 0.5) * 0.12,
        z: bi.z + (rngIcicles() - 0.5) * 1.15,
        sx: 0.65 + rngIcicles() * 0.65,
        sy: 0.65 + rngIcicles() * 1.35,
        sz: 0.65 + rngIcicles() * 0.65,
        rx: (rngIcicles() - 0.5) * 0.08,
        ry: rngIcicles() * Math.PI * 2,
        rz: (rngIcicles() - 0.5) * 0.08,
      });
    }
  }

  const dummy = new THREE.Object3D();
  const icicleInst = new THREE.InstancedMesh(hangingIcicleGeo, icicleMat, icicleTransforms.length);
  for (let i = 0; i < icicleTransforms.length; i++) {
    const ic = icicleTransforms[i];
    dummy.position.set(ic.x, ic.y, ic.z);
    dummy.rotation.set(ic.rx, ic.ry, ic.rz);
    dummy.scale.set(ic.sx, ic.sy, ic.sz);
    dummy.updateMatrix();
    icicleInst.setMatrixAt(i, dummy.matrix);
  }
  icicleInst.instanceMatrix.needsUpdate = true;
  icicleInst.frustumCulled = false;
  group.add(icicleInst);

  // =========================================================================
  // 7. 10 HERO AAA POLYHEDRAL DOUBLE-LAYER REFRACTIVE GLACIAL CRYSTAL CLUSTERS
  //    Each cluster: 6–9 chamfered 6/7-sided prisms (oblique crown + glowing inner
  //    core + translucent refractive outer shell) + 6–10 shattered ice splinters
  //    + sculpted wind-eroded rippled snow pedestal!
  // =========================================================================
  const animatedCrystalCores = [];
  const animatedCrystalLights = [];
  const animatedGlowDiscs = [];

  // Pre-build 6 distinct master beveled outer/inner prism pairs (3 hex + 3 heptagonal)
  const prismTemplates = [
    { sides: 6, r: 0.44, h: 3.05, tilt: 0.18, seed: 1.4 },
    { sides: 7, r: 0.39, h: 2.68, tilt: 0.21, seed: 4.8 },
    { sides: 6, r: 0.34, h: 2.25, tilt: 0.16, seed: 8.3 },
    { sides: 7, r: 0.31, h: 1.92, tilt: 0.22, seed: 12.6 },
    { sides: 6, r: 0.26, h: 1.52, tilt: 0.19, seed: 16.2 },
    { sides: 7, r: 0.23, h: 1.24, tilt: 0.20, seed: 20.9 },
  ];
  const outerTemplates = prismTemplates.map((p) =>
    createBeveledCrystalPrismGeo(THREE, { sides: p.sides, radius: p.r, height: p.h, chamferFrac: 0.16, obliqueTilt: p.tilt, seed: p.seed, isCore: false })
  );
  const innerTemplates = prismTemplates.map((p) =>
    createBeveledCrystalPrismGeo(THREE, { sides: p.sides, radius: p.r * 0.56, height: p.h * 0.85, chamferFrac: 0.14, obliqueTilt: p.tilt, seed: p.seed, isCore: true })
  );
  const splinterTemplates = [
    createIceSplinterGeo(THREE, 0.22, 0.86, 3.1),
    createIceSplinterGeo(THREE, 0.17, 0.64, 9.7),
  ];

  // 10 Hero clusters strictly outside combat flatland (all |x| >= 7.2 or z <= -6.0; flanks |x| >= 8.8)
  const heroClusterSpecs = [
    // Left cliff foot & supply flank
    { x: -9.65, z: -2.4,  scale: 1.18, prongs: 8, splinters: 9, leanX: 0.22,  leanZ: 0.08, light: true,  lightInt: 6.2, lightDist: 10.5, phase: 0.0 },
    { x: -9.90, z: 1.9,   scale: 1.02, prongs: 7, splinters: 8, leanX: 0.24,  leanZ: -0.06,light: false, phase: 1.1 },
    { x: -7.5,  z: -6.4,  scale: 1.32, prongs: 9, splinters: 10,leanX: 0.16,  leanZ: 0.12, light: true,  lightInt: 7.4, lightDist: 12.0, phase: 2.2 },
    { x: -8.5,  z: -11.2, scale: 1.42, prongs: 7, splinters: 8, leanX: 0.20,  leanZ: 0.14, light: false, phase: 3.3 },

    // Right cliff foot & fissure flank (framing Tundra Brute & Abyss Behemoth!)
    { x: 9.70,  z: -2.8,  scale: 1.24, prongs: 9, splinters: 10,leanX: -0.22, leanZ: 0.08, light: true,  lightInt: 6.8, lightDist: 11.2, phase: 0.7 },
    { x: 9.90,  z: 1.6,   scale: 1.05, prongs: 7, splinters: 8, leanX: -0.24, leanZ: -0.05,light: false, phase: 1.9 },
    { x: 7.3,   z: -6.1,  scale: 1.28, prongs: 8, splinters: 9, leanX: -0.18, leanZ: 0.12, light: true,  lightInt: 7.0, lightDist: 11.8, phase: 2.9 },
    { x: 8.6,   z: -11.5, scale: 1.46, prongs: 7, splinters: 8, leanX: -0.20, leanZ: 0.14, light: false, phase: 4.1 },

    // Rear chasm & broken ice-bridge abutments
    { x: -4.8,  z: -10.3, scale: 1.16, prongs: 6, splinters: 7, leanX: 0.14,  leanZ: 0.16, light: false, phase: 4.9 },
    { x: 4.9,   z: -10.1, scale: 1.20, prongs: 7, splinters: 8, leanX: -0.14, leanZ: 0.16, light: false, phase: 5.6 },
  ];

  const mat4Tmp = new THREE.Matrix4();
  const quatTmp = new THREE.Quaternion();
  const eulerTmp = new THREE.Euler();
  const posTmp = new THREE.Vector3();
  const sclTmp = new THREE.Vector3();
  const rngCrystal = createRng(82411);

  for (let cIdx = 0; cIdx < heroClusterSpecs.length; cIdx++) {
    const spec = heroClusterSpecs[cIdx];
    const clusterGroup = new THREE.Group();
    const baseY = getTerrainHeight(spec.x, spec.z);
    clusterGroup.position.set(spec.x, baseY - 0.06, spec.z);
    clusterGroup.name = `hero_glacial_crystal_cluster_${cIdx}`;

    // Dedicated glowing sapphire-cyan inner core material per cluster (asynchronous harmonic breathing)
    const coreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x62d6ff,
        vertexColors: true,
        emissive: 0x26b4ff,
        emissiveIntensity: 1.38,
        roughness: 0.20,
        metalness: 0.06,
        flatShading: true,
        ...(iceTex.emissiveMap ? { emissiveMap: iceTex.emissiveMap } : {}),
      })
    );
    animatedCrystalCores.push({ mat: coreMat, baseInt: 1.38, phase: spec.phase });

    // Sculpted wind-eroded sastrugi snow pedestal hugging the eruption base
    const snowBaseGeo = trackGeo(
      createWindSculptedSnowBaseGeo(THREE, 1.55 * spec.scale, 0.52 * spec.scale, 3.7 + cIdx * 2.9)
    );
    const snowBaseMesh = new THREE.Mesh(snowBaseGeo, snowCorniceMat);
    snowBaseMesh.receiveShadow = true;
    snowBaseMesh.castShadow = true;
    clusterGroup.add(snowBaseMesh);

    // Build & merge 6–9 beveled double-layer prisms inside this cluster (lean draw calls!)
    const clusterOuterParts = [];
    const clusterInnerParts = [];

    for (let p = 0; p < spec.prongs; p++) {
      const isHero = p === 0;
      const isSecondary = p <= 2;
      const ringAngle = isHero
        ? 0
        : ((p - 1) / Math.max(1, spec.prongs - 1)) * Math.PI * 2 + cIdx * 0.73 + (rngCrystal() - 0.5) * 0.34;
      const ringR = isHero ? 0 : (isSecondary ? 0.36 + rngCrystal() * 0.24 : 0.54 + rngCrystal() * 0.38) * spec.scale;

      const ox = Math.cos(ringAngle) * ringR;
      const oz = Math.sin(ringAngle) * ringR;
      const oy = isHero ? 0.08 : 0.02;

      const tiltMag = isHero
        ? 0.08
        : (isSecondary ? 0.24 + rngCrystal() * 0.16 : 0.38 + rngCrystal() * 0.24);
      const rx = isHero ? spec.leanZ : Math.sin(ringAngle) * tiltMag + spec.leanZ * 0.45;
      const rz = isHero ? -spec.leanX : -Math.cos(ringAngle) * tiltMag - spec.leanX * 0.45;
      const ry = ringAngle + rngCrystal() * 1.4;

      const tplIdx = isHero ? (cIdx % 2) : ((p + cIdx) % outerTemplates.length);
      const sXZ = spec.scale * (isHero ? 1.12 : isSecondary ? 0.72 + rngCrystal() * 0.22 : 0.48 + rngCrystal() * 0.24);
      const sY = spec.scale * (isHero ? 1.14 : isSecondary ? 0.76 + rngCrystal() * 0.24 : 0.44 + rngCrystal() * 0.28);

      posTmp.set(ox, oy, oz);
      eulerTmp.set(rx, ry, rz);
      quatTmp.setFromEuler(eulerTmp);
      sclTmp.set(sXZ, sY, sXZ);
      mat4Tmp.compose(posTmp, quatTmp, sclTmp);

      const gOuter = outerTemplates[tplIdx].clone();
      gOuter.applyMatrix4(mat4Tmp);
      clusterOuterParts.push(gOuter);

      const gInner = innerTemplates[tplIdx].clone();
      gInner.applyMatrix4(mat4Tmp);
      clusterInnerParts.push(gInner);
    }

    const mergedInnerGeo = trackGeo(mergeGeometries(THREE, clusterInnerParts));
    const innerMesh = new THREE.Mesh(mergedInnerGeo, coreMat);
    innerMesh.renderOrder = 1;
    clusterGroup.add(innerMesh);

    const mergedOuterGeo = trackGeo(mergeGeometries(THREE, clusterOuterParts));
    const outerMesh = new THREE.Mesh(mergedOuterGeo, crystalOuterMat);
    outerMesh.castShadow = true;
    outerMesh.receiveShadow = true;
    outerMesh.renderOrder = 2;
    clusterGroup.add(outerMesh);

    // 6–10 Jagged Shattered Ice Splinter Shards bursting around the sculpted snow pedestal
    const clusterSplinterParts = [];
    for (let s = 0; s < spec.splinters; s++) {
      const sa = (s / spec.splinters) * Math.PI * 2 + cIdx * 0.51 + (rngCrystal() - 0.5) * 0.35;
      const sr = (0.72 + rngCrystal() * 0.68) * spec.scale;
      const sx = Math.cos(sa) * sr;
      const sz = Math.sin(sa) * sr;
      const sScale = spec.scale * (0.62 + rngCrystal() * 0.72);
      const sTilt = 0.45 + rngCrystal() * 0.52;

      posTmp.set(sx, 0.08 * spec.scale, sz);
      eulerTmp.set(Math.sin(sa) * sTilt, sa + rngCrystal() * 0.8, -Math.cos(sa) * sTilt);
      quatTmp.setFromEuler(eulerTmp);
      sclTmp.set(sScale, sScale * (0.85 + rngCrystal() * 0.55), sScale);
      mat4Tmp.compose(posTmp, quatTmp, sclTmp);

      const gSp = splinterTemplates[s % splinterTemplates.length].clone();
      gSp.applyMatrix4(mat4Tmp);
      clusterSplinterParts.push(gSp);
    }
    const mergedSplintersGeo = trackGeo(mergeGeometries(THREE, clusterSplinterParts));
    const splintersMesh = new THREE.Mesh(mergedSplintersGeo, splinterMat);
    splintersMesh.castShadow = true;
    splintersMesh.renderOrder = 2;
    clusterGroup.add(splintersMesh);

    // Soft calibrated frost glow aura hugging the base (kept low opacity to prevent snow overexposure)
    if (glowDiscTex) {
      const auraGeo = trackGeo(new THREE.PlaneGeometry(3.5 * spec.scale, 3.5 * spec.scale));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = trackMat(
        new THREE.MeshBasicMaterial({
          map: glowDiscTex,
          color: 0x5cd8ff,
          transparent: true,
          opacity: 0.24,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.position.y = 0.14;
      clusterGroup.add(aura);
      animatedGlowDiscs.push({ mat: auraMat, baseOp: 0.24, phase: spec.phase });
    }

    // Local glacial-cyan PointLight on 4 strategic hero clusters
    if (spec.light) {
      const pt = new THREE.PointLight(0x52d4ff, spec.lightInt, spec.lightDist, 1.7);
      pt.position.set(spec.leanX * 1.4, 1.95 * spec.scale, 0.45);
      clusterGroup.add(pt);
      animatedCrystalLights.push({ light: pt, baseInt: spec.lightInt, phase: spec.phase });
    }

    group.add(clusterGroup);
  }

  // Low foreground bottom-corner miniature crystal clusters for HD-2D tilt-shift bokeh depth
  // Strictly outer corners |x| >= 9.6, z >= 5.0, height <= 1.05m (zero camera/character blocking)
  const fgClusterCoords = [
    { x: -9.8, z: 5.2, scale: 0.38, leanX: 0.25 },
    { x: 9.9,  z: 5.1, scale: 0.36, leanX: -0.25 },
  ];
  for (let i = 0; i < fgClusterCoords.length; i++) {
    const fc = fgClusterCoords[i];
    const fgParts = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + i * 1.1;
      posTmp.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
      eulerTmp.set(Math.sin(a) * 0.38, a, -Math.cos(a) * 0.38 - fc.leanX);
      quatTmp.setFromEuler(eulerTmp);
      const sc = fc.scale * (k === 0 ? 1.0 : 0.68);
      sclTmp.set(sc, sc * 0.9, sc);
      mat4Tmp.compose(posTmp, quatTmp, sclTmp);
      const g = outerTemplates[(k + 2) % outerTemplates.length].clone();
      g.applyMatrix4(mat4Tmp);
      fgParts.push(g);
    }
    const fgGeo = trackGeo(mergeGeometries(THREE, fgParts));
    const fgMesh = new THREE.Mesh(fgGeo, crystalOuterMat);
    fgMesh.position.set(fc.x, getTerrainHeight(fc.x, fc.z) - 0.05, fc.z);
    fgMesh.renderOrder = 2;
    group.add(fgMesh);
  }

  // Dispose master crystal templates now that all cloned cluster meshes are baked
  for (let i = 0; i < outerTemplates.length; i++) outerTemplates[i].dispose();
  for (let i = 0; i < innerTemplates.length; i++) innerTemplates[i].dispose();
  for (let i = 0; i < splinterTemplates.length; i++) splinterTemplates[i].dispose();

  // =========================================================================
  // 8. HULAN NORTHERN SUPPLY LINE DEFENSE PROPS (Rear z < -4.2 & Safe Margins)
  //    - Snow-covered military wooden crate stacks
  //    - Northern medical supply chests with crisp Red & Royal-Blue Cross emblems
  //    - Sharpened timber anti-beast cheval-de-frise barricades
  //    - Ironwood blizzard guideposts with physically swinging warning lanterns
  //    - Shattered glacial ice-bridge ruined piers spanning the chasm
  // =========================================================================
  const supplyGroup = new THREE.Group();
  supplyGroup.name = 'hulan_supply_line_defense_props';
  group.add(supplyGroup);

  // Shared reusable prop sub-geometries
  const crateCoreGeo = trackGeo(new THREE.BoxGeometry(0.92, 0.78, 0.92));
  const crateRailHGeo = trackGeo(new THREE.BoxGeometry(1.00, 0.10, 1.00));
  const cratePostVGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.80, 0.11));
  const crateDiagGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.86, 0.04));
  const crateCornerGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.14, 0.14));
  const crateSnowGeo = trackGeo(new THREE.SphereGeometry(0.56, 10, 6));
  crateSnowGeo.scale(1.02, 0.24, 0.98);

  function createMilitaryCrate(sx = 1.0, sy = 1.0, sz = 1.0, withSnow = true) {
    const cg = new THREE.Group();
    const core = new THREE.Mesh(crateCoreGeo, crateWoodMat);
    core.position.y = 0.40;
    core.castShadow = true;
    core.receiveShadow = true;
    cg.add(core);

    // Top & bottom timber rails
    for (const ry of [0.06, 0.75]) {
      const rail = new THREE.Mesh(crateRailHGeo, crateFrameMat);
      rail.position.y = ry;
      rail.castShadow = true;
      cg.add(rail);
    }
    // 4 vertical corner battens + forged iron corner brackets
    const cornerOffsets = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]];
    for (const [cx, cz] of cornerOffsets) {
      const post = new THREE.Mesh(cratePostVGeo, crateFrameMat);
      post.position.set(cx, 0.40, cz);
      cg.add(post);

      const cap = new THREE.Mesh(crateCornerGeo, forgedIronMat);
      cap.position.set(cx * 1.01, 0.76, cz * 1.01);
      cg.add(cap);
    }
    // Front & back diagonal cross-brace planks
    for (const fz of [0.48, -0.48]) {
      const diag = new THREE.Mesh(crateDiagGeo, crateFrameMat);
      diag.position.set(0, 0.40, fz);
      diag.rotation.z = 0.78;
      cg.add(diag);
    }
    // Thick wind-packed snow pillow resting on top lid
    if (withSnow) {
      const snow = new THREE.Mesh(crateSnowGeo, snowPillowMat);
      snow.position.set(-0.04, 0.84, 0.02);
      snow.receiveShadow = true;
      cg.add(snow);
    }

    cg.scale.set(sx, sy, sz);
    return cg;
  }

  // Build authentic Northern Medical Supply Chest with crisp Red / Royal-Blue Cross Emblem
  const medBodyGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.74, 0.82));
  const medLidGeo = trackGeo(new THREE.BoxGeometry(1.24, 0.14, 0.88));
  const medFrontPlaqueGeo = trackGeo(new THREE.PlaneGeometry(0.68, 0.64));
  const medTopPlaqueGeo = trackGeo(new THREE.PlaneGeometry(0.66, 0.56));
  const medStrapGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.84, 0.88));
  const medClaspGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.16, 0.06));
  const medHandleGeo = trackGeo(new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI));

  function createMedicalChest(variant = 'red', scale = 1.0, snowOffset = -0.18) {
    const mg = new THREE.Group();
    const emblemMat = variant === 'red' ? redCrossFaceMat : blueCrossFaceMat;

    const body = new THREE.Mesh(medBodyGeo, medicalBodyMat);
    body.position.y = 0.37;
    body.castShadow = true;
    body.receiveShadow = true;
    mg.add(body);

    const lid = new THREE.Mesh(medLidGeo, medicalBodyMat);
    lid.position.y = 0.78;
    lid.castShadow = true;
    lid.receiveShadow = true;
    mg.add(lid);

    // Forged iron reinforcement straps & brass clasps
    for (const sx of [-0.42, 0.42]) {
      const strap = new THREE.Mesh(medStrapGeo, forgedIronMat);
      strap.position.set(sx, 0.43, 0);
      mg.add(strap);

      const clasp = new THREE.Mesh(medClaspGeo, brassClaspMat);
      clasp.position.set(sx, 0.71, 0.44);
      mg.add(clasp);
    }

    // Side forged carry handles
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(medHandleGeo, forgedIronMat);
      handle.position.set(side * 0.60, 0.46, 0);
      handle.rotation.y = Math.PI * 0.5;
      handle.rotation.z = Math.PI;
      mg.add(handle);
    }

    // Crisp Front & Top Red/Blue Medical Cross Emblem Plaques
    const frontPlaque = new THREE.Mesh(medFrontPlaqueGeo, emblemMat);
    frontPlaque.position.set(0, 0.39, 0.422);
    mg.add(frontPlaque);

    const topPlaque = new THREE.Mesh(medTopPlaqueGeo, emblemMat);
    topPlaque.rotation.x = -Math.PI * 0.5;
    topPlaque.position.set(0, 0.858, 0);
    mg.add(topPlaque);

    // Windward partial snow drift on chest corner (keeps cross emblem clearly legible!)
    const drift = new THREE.Mesh(crateSnowGeo, snowPillowMat);
    drift.position.set(snowOffset, 0.88, -0.22);
    drift.scale.set(0.62, 0.78, 0.52);
    mg.add(drift);

    mg.scale.setScalar(scale);
    return mg;
  }

  // Place Rear-Left Supply Stack & Iconic Protected Medical Chests (z ∈ [-6.1, -4.65])
  const crateLayouts = [
    { x: -4.95, z: -5.45, sx: 1.12, sy: 1.05, sz: 1.08, ry: 0.22, snow: false },
    { x: -4.85, z: -5.40, yOff: 0.84, sx: 0.88, sy: 0.86, sz: 0.88, ry: -0.18, snow: true }, // stacked upper crate
    { x: -6.05, z: -5.65, sx: 1.04, sy: 0.96, sz: 1.02, ry: -0.35, snow: true },
    { x: -3.72, z: -5.85, sx: 1.18, sy: 1.08, sz: 0.98, ry: 0.14, snow: true },
    { x: -2.05, z: -5.55, sx: 0.94, sy: 0.82, sz: 0.92, ry: 0.42, snow: false }, // pallet crate under small med case
    { x: -6.85, z: -4.85, sx: 0.84, sy: 0.78, sz: 0.82, ry: 0.65, snow: true },
  ];
  for (const cl of crateLayouts) {
    const cr = createMilitaryCrate(cl.sx, cl.sy, cl.sz, cl.snow);
    const cy = getTerrainHeight(cl.x, cl.z) + (cl.yOff || 0) - 0.04;
    cr.position.set(cl.x, cy, cl.z);
    cr.rotation.y = cl.ry;
    supplyGroup.add(cr);
  }

  // Hero Protected Medical Supply Chests (clearly visible behind player backline!)
  const medSpecs = [
    { x: -3.05, z: -4.82, variant: 'red',  scale: 1.04, ry: 0.24, yOff: 0, snowOff: -0.34 },
    { x: -4.28, z: -4.92, variant: 'blue', scale: 0.96, ry: -0.18, yOff: 0, snowOff: 0.34 },
    { x: -2.05, z: -5.52, variant: 'red',  scale: 0.72, ry: 0.36, yOff: 0.66, snowOff: -0.26 },
  ];
  for (const ms of medSpecs) {
    const chest = createMedicalChest(ms.variant, ms.scale, ms.snowOff);
    const my = getTerrainHeight(ms.x, ms.z) + ms.yOff - 0.04;
    chest.position.set(ms.x, my, ms.z);
    chest.rotation.y = ms.ry;
    supplyGroup.add(chest);
  }

  // Draped frost-dusted royal-navy canvas tarp over the rear-left crate cluster
  const tarpGeo = trackGeo(new THREE.PlaneGeometry(2.45, 1.85, 10, 8));
  const tp = tarpGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const vx = tp.getX(i);
    const vy = tp.getY(i);
    const drape = -Math.pow(Math.abs(vy) / 0.92, 2.2) * 0.65;
    const fold = Math.sin(vx * 3.8 + vy * 2.1) * 0.06;
    tp.setZ(i, drape + fold);
  }
  tarpGeo.computeVertexNormals();
  const tarpMesh = new THREE.Mesh(tarpGeo, canvasTarpMat);
  tarpMesh.position.set(-5.42, getTerrainHeight(-5.42, -5.55) + 1.18, -5.58);
  tarpMesh.rotation.set(-Math.PI * 0.44, 0.24, 0.14);
  tarpMesh.castShadow = true;
  tarpMesh.receiveShadow = true;
  supplyGroup.add(tarpMesh);

  // Half-buried wooden supply wagon wheel beside the rear crates (storytelling detail!)
  const wheelGroup = new THREE.Group();
  const wheelRimGeo = trackGeo(new THREE.TorusGeometry(0.68, 0.075, 8, 18));
  const wheelHubGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 10));
  const wheelSpokeGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.036, 1.32, 6));
  const wheelRim = new THREE.Mesh(wheelRimGeo, crateFrameMat);
  wheelRim.castShadow = true;
  wheelGroup.add(wheelRim);
  const wheelHub = new THREE.Mesh(wheelHubGeo, forgedIronMat);
  wheelHub.rotation.x = Math.PI * 0.5;
  wheelGroup.add(wheelHub);
  for (let s = 0; s < 4; s++) {
    const sp = new THREE.Mesh(wheelSpokeGeo, crateWoodMat);
    sp.rotation.z = (s / 4) * Math.PI;
    wheelGroup.add(sp);
  }
  wheelGroup.position.set(-6.45, getTerrainHeight(-6.45, -5.25) + 0.34, -5.25);
  wheelGroup.rotation.set(0.32, 0.68, -0.28);
  supplyGroup.add(wheelGroup);

  // --- Anti-Beast Sharpened Timber Cheval-de-Frise Barricades (防兽拒马) ---
  const beamGeo = trackGeo(new THREE.CylinderGeometry(0.12, 0.13, 2.55, 8));
  beamGeo.rotateZ(Math.PI * 0.5);
  const stakeShaftGeo = trackGeo(new THREE.CylinderGeometry(0.068, 0.088, 1.62, 7));
  const stakeTipGeo = trackGeo(new THREE.ConeGeometry(0.068, 0.36, 7));
  const lashingGeo = trackGeo(new THREE.TorusGeometry(0.145, 0.028, 6, 12));

  function createAntiBeastBarricade(scale = 1.0, brokenRight = false) {
    const bg = new THREE.Group();

    const beam = new THREE.Mesh(beamGeo, timberStakeMat);
    beam.position.y = 0.56;
    beam.castShadow = true;
    beam.receiveShadow = true;
    bg.add(beam);

    // 5 crossed sharpened timber stakes lashed to the horizontal log beam
    const xPositions = [-0.95, -0.48, 0.0, 0.48, 0.95];
    for (let i = 0; i < xPositions.length; i++) {
      if (brokenRight && i === 4) continue;
      const sx = xPositions[i];
      const forwardTilt = (i % 2 === 0) ? 0.68 : -0.62;
      const yawJitter = (i - 2) * 0.05;

      const stake = new THREE.Group();
      stake.position.set(sx, 0.56, 0);
      stake.rotation.set(forwardTilt, yawJitter, (i % 2 === 0 ? 0.08 : -0.08));

      const shaft = new THREE.Mesh(stakeShaftGeo, timberStakeMat);
      shaft.position.y = 0.12;
      shaft.castShadow = true;
      stake.add(shaft);

      const tip = new THREE.Mesh(stakeTipGeo, chiseledTipMat);
      tip.position.y = 1.10;
      tip.castShadow = true;
      stake.add(tip);

      const lash = new THREE.Mesh(lashingGeo, forgedIronMat);
      lash.position.set(sx, 0.56, 0);
      lash.rotation.y = Math.PI * 0.5;
      bg.add(lash);

      bg.add(stake);
    }

    // Wind-packed snow collar along the log base
    const baseSnow = new THREE.Mesh(crateSnowGeo, snowPillowMat);
    baseSnow.position.set(0, 0.10, -0.08);
    baseSnow.scale.set(2.35, 0.68, 0.78);
    bg.add(baseSnow);

    bg.scale.setScalar(scale);
    return bg;
  }

  const barricadeSpecs = [
    { x: -6.95, z: -4.45, ry: 0.42,  scale: 0.94, broken: false },
    { x: -0.95, z: -5.25, ry: 0.14,  scale: 1.02, broken: false },
    { x: 2.35,  z: -5.55, ry: -0.22, scale: 0.98, broken: true },
    { x: 6.15,  z: -5.15, ry: -0.46, scale: 0.96, broken: false },
  ];
  for (const bs of barricadeSpecs) {
    const bar = createAntiBeastBarricade(bs.scale, bs.broken);
    bar.position.set(bs.x, getTerrainHeight(bs.x, bs.z) - 0.06, bs.z);
    bar.rotation.y = bs.ry;
    supplyGroup.add(bar);
  }

  // Lone splintered angled defense stakes in safe outer foreground snowbanks (height <= 1.0m)
  const fgStakes = [
    { x: -8.65, z: 4.55, rx: 0.52, ry: 0.4, rz: -0.32, s: 0.62 },
    { x: -8.25, z: 4.95, rx: 0.42, ry: 1.1, rz: -0.45, s: 0.52 },
    { x: 8.75,  z: 4.65, rx: 0.48, ry: -0.6, rz: 0.36, s: 0.60 },
  ];
  for (const fs of fgStakes) {
    const sg = new THREE.Group();
    const sh = new THREE.Mesh(stakeShaftGeo, timberStakeMat);
    sh.position.y = 0.25;
    sg.add(sh);
    const tpM = new THREE.Mesh(stakeTipGeo, chiseledTipMat);
    tpM.position.y = 1.22;
    sg.add(tpM);
    sg.position.set(fs.x, getTerrainHeight(fs.x, fs.z) - 0.18, fs.z);
    sg.rotation.set(fs.rx, fs.ry, fs.rz);
    sg.scale.setScalar(fs.s);
    supplyGroup.add(sg);
  }

  // --- Northern Ironwood Guideposts with Swinging Blizzard Warning Lanterns ---
  const animatedLanterns = [];
  const postShaftGeo = trackGeo(new THREE.CylinderGeometry(0.095, 0.135, 3.25, 8));
  const postArmGeo = trackGeo(new THREE.BoxGeometry(0.95, 0.10, 0.10));
  const postBraceGeo = trackGeo(new THREE.BoxGeometry(0.56, 0.07, 0.07));
  const postBandGeo = trackGeo(new THREE.CylinderGeometry(0.115, 0.115, 0.12, 8));
  const signPlankGeo = trackGeo(new THREE.BoxGeometry(0.76, 0.22, 0.045));
  const cairnRockGeo = trackGeo(new THREE.DodecahedronGeometry(0.28, 0));

  const lanternHoodGeo = trackGeo(new THREE.ConeGeometry(0.22, 0.20, 6));
  const lanternBaseGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.11, 0.08, 6));
  const lanternGlassGeo = trackGeo(new THREE.CylinderGeometry(0.135, 0.105, 0.32, 6));
  const lanternRibGeo = trackGeo(new THREE.BoxGeometry(0.022, 0.34, 0.022));
  const lanternChainGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 6));

  const lanternGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4ad,
      emissive: 0xff9b34,
      emissiveIntensity: 2.35,
      roughness: 0.22,
      metalness: 0.05,
    })
  );

  const guidepostSpecs = [
    { x: -5.82, z: -4.62, ry: 0.48,  armSign: 1,  phase: 0.0, lightInt: 9.2 },
    { x: 0.68,  z: -6.28, ry: -0.15, armSign: -1, phase: 2.1, lightInt: 8.6 },
    { x: 6.82,  z: -4.82, ry: -0.52, armSign: -1, phase: 4.2, lightInt: 8.8 },
  ];

  for (let i = 0; i < guidepostSpecs.length; i++) {
    const gs = guidepostSpecs[i];
    const gp = new THREE.Group();
    const gy = getTerrainHeight(gs.x, gs.z);
    gp.position.set(gs.x, gy - 0.06, gs.z);
    gp.rotation.y = gs.ry;

    // Stacked stone anchor cairn at base
    for (let r = 0; r < 5; r++) {
      const a = (r / 5) * Math.PI * 2 + i;
      const rk = new THREE.Mesh(cairnRockGeo, bridgeStoneMat);
      rk.position.set(Math.cos(a) * 0.24, 0.12 + (r % 2) * 0.06, Math.sin(a) * 0.24);
      rk.scale.set(1.0 + (r % 2) * 0.28, 0.65, 0.92);
      rk.rotation.set(r * 0.6, a, r * 0.4);
      rk.castShadow = true;
      gp.add(rk);
    }

    // Ironwood main post + iron collars
    const shaft = new THREE.Mesh(postShaftGeo, timberStakeMat);
    shaft.position.y = 1.62;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    gp.add(shaft);

    for (const by of [0.68, 2.24, 3.05]) {
      const band = new THREE.Mesh(postBandGeo, forgedIronMat);
      band.position.y = by;
      gp.add(band);
    }

    // Crossbar arm & diagonal brace
    const arm = new THREE.Mesh(postArmGeo, timberStakeMat);
    arm.position.set(gs.armSign * 0.42, 3.02, 0);
    arm.castShadow = true;
    gp.add(arm);

    const brace = new THREE.Mesh(postBraceGeo, timberStakeMat);
    brace.position.set(gs.armSign * 0.24, 2.76, 0);
    brace.rotation.z = gs.armSign * 0.78;
    gp.add(brace);

    // Directional northern pass wooden signboards
    const signA = new THREE.Mesh(signPlankGeo, crateWoodMat);
    signA.position.set(-gs.armSign * 0.28, 2.38, 0.10);
    signA.rotation.z = 0.06;
    gp.add(signA);

    const signB = new THREE.Mesh(signPlankGeo, crateWoodMat);
    signB.position.set(gs.armSign * 0.24, 2.08, -0.09);
    signB.rotation.set(0, 0.35, -0.08);
    gp.add(signB);

    // Pivoting suspended blizzard warning lantern (swings dynamically with wind in update!)
    const pivot = new THREE.Group();
    pivot.position.set(gs.armSign * 0.80, 2.98, 0);

    const chain = new THREE.Mesh(lanternChainGeo, forgedIronMat);
    chain.position.y = -0.17;
    pivot.add(chain);

    const hood = new THREE.Mesh(lanternHoodGeo, forgedIronMat);
    hood.position.y = -0.36;
    pivot.add(hood);

    const hoodSnow = new THREE.Mesh(crateSnowGeo, snowPillowMat);
    hoodSnow.position.y = -0.28;
    hoodSnow.scale.set(0.32, 0.34, 0.32);
    pivot.add(hoodSnow);

    const glass = new THREE.Mesh(lanternGlassGeo, lanternGlassMat);
    glass.position.y = -0.60;
    pivot.add(glass);

    const baseCap = new THREE.Mesh(lanternBaseGeo, forgedIronMat);
    baseCap.position.y = -0.78;
    pivot.add(baseCap);

    // 4 slim wrought-iron cage ribs
    for (let k = 0; k < 4; k++) {
      const ka = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
      const rib = new THREE.Mesh(lanternRibGeo, forgedIronMat);
      rib.position.set(Math.cos(ka) * 0.145, -0.60, Math.sin(ka) * 0.145);
      pivot.add(rib);
    }

    // Soft warm additive warning halo
    let haloSprite = null;
    if (glowDiscTex) {
      const hMat = trackMat(
        new THREE.SpriteMaterial({
          map: glowDiscTex,
          color: 0xffb85c,
          transparent: true,
          opacity: 0.64,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      haloSprite = new THREE.Sprite(hMat);
      haloSprite.position.y = -0.60;
      haloSprite.scale.set(1.75, 1.75, 1);
      pivot.add(haloSprite);
    }

    // Warm local PointLight painting snow & medical crates golden amber
    const pt = new THREE.PointLight(0xffaa4c, gs.lightInt, 11.5, 1.65);
    pt.position.set(0, -0.62, 0.15);
    pivot.add(pt);

    gp.add(pivot);
    supplyGroup.add(gp);
    animatedLanterns.push({
      pivot,
      light: pt,
      halo: haloSprite,
      baseInt: gs.lightInt,
      phase: gs.phase,
    });
  }

  // --- Shattered Glacial Ice-Bridge Ruined Piers (碎裂冰桥残柱, z ≈ -9.4 ~ -11.2) ---
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'shattered_ice_bridge_piers';
  group.add(bridgeGroup);

  const pierBaseGeo = trackGeo(new THREE.BoxGeometry(2.35, 3.2, 2.65));
  const pierCapGeo = trackGeo(new THREE.BoxGeometry(2.65, 0.42, 2.95));
  const deckSlabGeo = trackGeo(new THREE.BoxGeometry(2.65, 0.48, 2.35));
  const parapetGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.68, 0.34));
  const iceGlazeSlabGeo = trackGeo(new THREE.BoxGeometry(2.75, 0.18, 2.42));

  const bridgeAbutments = [
    { x: -4.2, z: -9.5, side: -1, deckRotZ: -0.14 },
    { x: 4.3,  z: -9.3, side: 1,  deckRotZ: 0.12 },
  ];

  for (const ab of bridgeAbutments) {
    const ag = new THREE.Group();
    ag.position.set(ab.x, -0.95, ab.z);

    const pier = new THREE.Mesh(pierBaseGeo, bridgeStoneMat);
    pier.position.y = 0.65;
    pier.castShadow = true;
    pier.receiveShadow = true;
    ag.add(pier);

    const cap = new THREE.Mesh(pierCapGeo, bridgeStoneMat);
    cap.position.y = 2.35;
    cap.castShadow = true;
    cap.receiveShadow = true;
    ag.add(cap);

    // Fractured cantilevered bridge deck stub jutting over the frozen chasm
    const deckGroup = new THREE.Group();
    deckGroup.position.set(-ab.side * 1.15, 2.25, 0);
    deckGroup.rotation.z = ab.deckRotZ;

    const slab = new THREE.Mesh(deckSlabGeo, bridgeStoneMat);
    slab.castShadow = true;
    slab.receiveShadow = true;
    deckGroup.add(slab);

    // Thick frozen blue ice crust sheathing the broken deck
    const iceCrust = new THREE.Mesh(iceGlazeSlabGeo, icicleMat);
    iceCrust.position.y = 0.28;
    deckGroup.add(iceCrust);

    const deckSnow = new THREE.Mesh(crateSnowGeo, snowPillowMat);
    deckSnow.position.set(ab.side * 0.25, 0.44, 0);
    deckSnow.scale.set(2.25, 0.72, 1.85);
    deckGroup.add(deckSnow);

    // Broken low stone parapet wall along rear edge
    const para = new THREE.Mesh(parapetGeo, bridgeStoneMat);
    para.position.set(ab.side * 0.22, 0.52, -0.95);
    para.castShadow = true;
    deckGroup.add(para);

    ag.add(deckGroup);
    bridgeGroup.add(ag);
  }

  // Tilted broken mid-chasm support column & fallen masonry chunks embedded in abyss ice
  const brokenMidPier = new THREE.Mesh(pierBaseGeo, bridgeStoneMat);
  brokenMidPier.position.set(-0.85, -1.55, -11.2);
  brokenMidPier.scale.set(0.68, 0.92, 0.72);
  brokenMidPier.rotation.set(0.18, 0.35, -0.32);
  brokenMidPier.castShadow = true;
  bridgeGroup.add(brokenMidPier);

  const fallenDeckChunks = [
    { x: -1.4, y: -1.88, z: -9.8,  rx: 0.22, ry: 0.54, rz: -0.36, s: 0.65 },
    { x: 1.55, y: -1.82, z: -10.4, rx: -0.18, ry: -0.62, rz: 0.28, s: 0.72 },
    { x: 0.25, y: -1.96, z: -9.2,  rx: 0.14, ry: 1.15, rz: 0.18,  s: 0.48 },
  ];
  for (const fc of fallenDeckChunks) {
    const ch = new THREE.Mesh(deckSlabGeo, bridgeStoneMat);
    ch.position.set(fc.x, fc.y, fc.z);
    ch.rotation.set(fc.rx, fc.ry, fc.rz);
    ch.scale.setScalar(fc.s);
    ch.receiveShadow = true;
    bridgeGroup.add(ch);
  }

  // =========================================================================
  // 9. INSTANCED SNOW-CAPPED CANYON SCREE BOULDERS (Cliff Toes & Chasm Rim)
  // =========================================================================
  const boulderRaw = new THREE.IcosahedronGeometry(0.55, 1);
  const bp = boulderRaw.attributes.position;
  const bc = new Float32Array(bp.count * 3);
  const cBldRock = new THREE.Color(0x4a607e);
  const cBldSnow = new THREE.Color(0xe3effa);
  const bTmp = new THREE.Color();
  for (let i = 0; i < bp.count; i++) {
    const vx = bp.getX(i);
    const vy = bp.getY(i);
    const vz = bp.getZ(i);
    const k = 0.80 + 0.36 * hash2(vx * 5.1 + vy * 2.9, vz * 6.3);
    bp.setXYZ(i, vx * k * 1.24, vy * k * 0.76, vz * k * 1.08);
    bTmp.lerpColors(cBldRock, cBldSnow, smoothstep(0.05, 0.30, vy));
    bc[i * 3] = bTmp.r;
    bc[i * 3 + 1] = bTmp.g;
    bc[i * 3 + 2] = bTmp.b;
  }
  boulderRaw.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const boulderGeo = trackGeo(boulderRaw.index ? boulderRaw.toNonIndexed() : boulderRaw);
  if (boulderGeo !== boulderRaw) boulderRaw.dispose();
  boulderGeo.computeVertexNormals();

  const boulderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.05,
      flatShading: true,
    })
  );

  const rngScree = createRng(63907);
  const screeList = [];
  for (let i = 0; i < 64; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    let x, z;
    if (i < 42) {
      // Flanking cliff toe scree (strictly |x| >= 8.2)
      x = side * lerp(8.3, 12.2, rngScree());
      z = lerp(-13.5, 5.2, rngScree());
    } else {
      // Rear chasm rim scree (strictly z <= -6.4)
      x = lerp(-9.5, 9.5, rngScree());
      z = lerp(-8.8, -6.5, rngScree());
    }
    // Hard combat safe-zone guard
    if (Math.abs(x) < 8.1 && z > -5.8) continue;
    // Keep foreground center camera corridor clear
    if (Math.abs(x) < 8.4 && z > 3.8) continue;
    const y = getTerrainHeight(x, z);
    const s = 0.45 + rngScree() * 1.15;
    screeList.push({
      x,
      y: y + s * 0.06,
      z,
      sx: s * (0.85 + rngScree() * 0.45),
      sy: s * (0.62 + rngScree() * 0.45),
      sz: s * (0.85 + rngScree() * 0.45),
      ry: rngScree() * Math.PI * 2,
    });
  }

  const screeInst = new THREE.InstancedMesh(boulderGeo, boulderMat, screeList.length);
  screeInst.castShadow = true;
  screeInst.receiveShadow = true;
  for (let i = 0; i < screeList.length; i++) {
    const b = screeList[i];
    dummy.position.set(b.x, b.y, b.z);
    dummy.rotation.set(0, b.ry, 0);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.updateMatrix();
    screeInst.setMatrixAt(i, dummy.matrix);
  }
  screeInst.instanceMatrix.needsUpdate = true;
  screeInst.frustumCulled = false;
  group.add(screeInst);

  // =========================================================================
  // 10. MULTI-LAYERED FACETED GLACIAL MOUNTAIN PANORAMA (Visible Through Gorge)
  // =========================================================================
  const mountainParts = [];
  const mountainSpecs = [
    // Tier 1: Mid-far canyon spur peaks
    { x: -16.5, z: -29, r: 9.8,  h: 21.5, rot: 0.4, seed: 2.1, farFade: 0.14 },
    { x: -3.8,  z: -31, r: 10.6, h: 22.8, rot: 1.3, seed: 4.5, farFade: 0.18 },
    { x: 5.4,   z: -32, r: 10.2, h: 24.2, rot: 2.2, seed: 6.8, farFade: 0.18 },
    { x: 18.2,  z: -29, r: 10.4, h: 22.0, rot: 0.9, seed: 9.2, farFade: 0.14 },

    // Tier 2: Grand Hulan Cordillera jagged massif soaring behind the V-notch
    { x: -28.0, z: -42, r: 14.2, h: 31.0, rot: 1.5, seed: 12.4, farFade: 0.30 },
    { x: -11.5, z: -44, r: 14.8, h: 35.5, rot: 0.3, seed: 15.7, farFade: 0.32 },
    { x: 1.2,   z: -46, r: 16.2, h: 39.2, rot: 2.6, seed: 19.1, farFade: 0.34 },
    { x: 14.8,  z: -43, r: 14.6, h: 34.0, rot: 1.1, seed: 22.8, farFade: 0.32 },
    { x: 30.0,  z: -40, r: 13.8, h: 30.5, rot: 2.1, seed: 26.3, farFade: 0.30 },

    // Tier 3: Distant glacial cathedral horizon peaks
    { x: -19.0, z: -56, r: 18.0, h: 43.0, rot: 0.7, seed: 31.5, farFade: 0.48 },
    { x: -3.5,  z: -58, r: 19.5, h: 47.5, rot: 1.9, seed: 36.2, farFade: 0.50 },
    { x: 12.0,  z: -57, r: 18.8, h: 45.0, rot: 2.8, seed: 40.7, farFade: 0.48 },
  ];

  for (let i = 0; i < mountainSpecs.length; i++) {
    const ms = mountainSpecs[i];
    const peak = createSculptedAlpinePeakGeo(THREE, {
      radius: ms.r,
      height: ms.h,
      seed: ms.seed,
      farFade: ms.farFade,
      fogColor: baseFogColor,
    });
    peak.rotateY(ms.rot);
    peak.translate(ms.x, ms.h * 0.5 - 3.6, ms.z);
    mountainParts.push(peak);
  }

  const mountainGeo = trackGeo(mergeGeometries(THREE, mountainParts));
  const mountainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.03,
      flatShading: true,
    })
  );
  const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
  mountainMesh.name = 'distant_hulan_glacial_peaks';
  group.add(mountainMesh);

  // =========================================================================
  // 11. CANYON HIGH-ALTITUDE JET-STREAM SPINDRIFT VEILS + SWEPT ICE DUST
  //     Animated dynamically in update(t, dt) for fierce northern canyon airflow!
  // =========================================================================
  const jetStreamUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xdcf0ff) },
    uOpacity: { value: 0.34 },
    uSpeed: { value: 1.0 },
  };
  const jetStreamMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: jetStreamUniforms,
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
        uniform float uOpacity;
        uniform float uSpeed;
        varying vec2 vUv;

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

        void main() {
          // Oblique wind-sheared snow plume racing across the canyon
          vec2 flowUv1 = vec2(vUv.x * 3.8 - uTime * 0.42 * uSpeed, vUv.y * 2.2 + vUv.x * 0.45);
          vec2 flowUv2 = vec2(vUv.x * 7.2 - uTime * 0.72 * uSpeed, vUv.y * 4.1 - vUv.x * 0.25);
          float w1 = vnoise(flowUv1);
          float w2 = vnoise(flowUv2);
          float streak = smoothstep(0.36, 0.84, w1 * 0.62 + w2 * 0.38);

          float envX = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));
          float envY = smoothstep(0.0, 0.30, vUv.y) * (1.0 - smoothstep(0.70, 1.0, vUv.y));
          float alpha = streak * envX * envY * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })
  );

  const jetVeilGeo = trackGeo(new THREE.PlaneGeometry(24.0, 4.6, 1, 1));
  const jetVeilSpecs = [
    // High-altitude spindrift tearing off cliff snow cornices
    { x: -1.5, y: 9.8,  z: -10.5, rx: 0.08, ry: 0.06, rz: -0.14, sx: 1.05, sy: 0.92 },
    { x: 1.2,  y: 12.2, z: -15.5, rx: 0.06, ry: -0.05,rz: -0.16, sx: 1.25, sy: 1.10 },
    { x: 0.0,  y: 7.4,  z: -19.0, rx: 0.04, ry: 0.0,  rz: -0.10, sx: 1.35, sy: 1.15 },
    // Mid-chasm wind-blown gorge spindrift ribbons
    { x: -0.6, y: 1.6,  z: -10.8, rx: -0.12,ry: 0.04, rz: -0.08, sx: 0.95, sy: 0.72 },
    { x: 0.8,  y: 3.1,  z: -14.2, rx: -0.08,ry: -0.04,rz: -0.12, sx: 1.10, sy: 0.82 },
  ];
  for (const jv of jetVeilSpecs) {
    const m = new THREE.Mesh(jetVeilGeo, jetStreamMat);
    m.position.set(jv.x, jv.y, jv.z);
    m.rotation.set(jv.rx, jv.ry, jv.rz);
    m.scale.set(jv.sx, jv.sy, 1);
    m.renderOrder = 3;
    group.add(m);
  }

  // Subtle Cold Canyon Sky-Slit Light Shafts pouring down between the cliff walls
  const slitBeamUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xcceeff) },
    uOpacity: { value: 0.065 },
  };
  const slitBeamMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: slitBeamUniforms,
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
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float h = pow(max(sin(vUv.x * 3.14159265), 0.0), 2.4);
          float v = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.68, 1.0, vUv.y));
          float shimmer = 0.82 + 0.18 * sin(uTime * 0.95 + vUv.x * 5.0);
          gl_FragColor = vec4(uColor, h * v * shimmer * uOpacity);
        }
      `,
    })
  );
  const slitBeamGeo = trackGeo(new THREE.PlaneGeometry(3.8, 17.0));
  const slitBeams = [
    { x: 4.2,  y: 7.5, z: -9.2,  ry: -0.18, rz: 0.36, sx: 1.12 },
    { x: 0.4,  y: 7.8, z: -12.4, ry: -0.10, rz: 0.34, sx: 1.28 },
    { x: -3.2, y: 7.4, z: -14.8, ry: -0.06, rz: 0.32, sx: 0.98 },
  ];
  for (const sb of slitBeams) {
    const bm = new THREE.Mesh(slitBeamGeo, slitBeamMat);
    bm.position.set(sb.x, sb.y, sb.z);
    bm.rotation.set(0.14, sb.ry, sb.rz);
    bm.scale.set(sb.sx, 1, 1);
    bm.renderOrder = 3;
    group.add(bm);
  }

  // Diagonal Wind-Swept High-Altitude Snow & Sparkling Ice Dust (Points updated in update(t, dt))
  const flurryCount = 240;
  const flurryPos = new Float32Array(flurryCount * 3);
  const flurrySeeds = new Float32Array(flurryCount * 4); // baseX, baseY, baseZ, speed/phase
  const rngFlurry = createRng(91237);
  for (let i = 0; i < flurryCount; i++) {
    const fx = lerp(-15.5, 15.5, rngFlurry());
    const fy = lerp(0.5, 13.5, rngFlurry());
    const fz = lerp(-20.0, 3.8, rngFlurry());
    flurryPos[i * 3] = fx;
    flurryPos[i * 3 + 1] = fy;
    flurryPos[i * 3 + 2] = fz;
    flurrySeeds[i * 4] = fx;
    flurrySeeds[i * 4 + 1] = fy;
    flurrySeeds[i * 4 + 2] = fz;
    flurrySeeds[i * 4 + 3] = 0.65 + rngFlurry() * 0.85;
  }
  const flurryGeo = trackGeo(new THREE.BufferGeometry());
  flurryGeo.setAttribute('position', new THREE.BufferAttribute(flurryPos, 3));
  const flurryMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xdcf4ff,
      size: 0.24,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...(glowDiscTex ? { map: glowDiscTex } : {}),
    })
  );
  const flurryPoints = new THREE.Points(flurryGeo, flurryMat);
  flurryPoints.name = 'canyon_jetstream_snow_and_icedust';
  flurryPoints.renderOrder = 4;
  group.add(flurryPoints);

  // =========================================================================
  // 12. CALIBRATED ANTI-OVEREXPOSURE LIGHTING RIG
  //     Sculpted crisp cold directional light + deep cool cliff shadows (zero snow clip!)
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0xbce0fc, 0x678cb0, 1.02);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xebf5ff, 1.66);
  sunLight.position.set(11.5, 22.5, -10.5);
  sunLight.target.position.set(0, 0, -2.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 68.0;
  sunLight.shadow.camera.left = -22;
  sunLight.shadow.camera.right = 22;
  sunLight.shadow.camera.top = 18;
  sunLight.shadow.camera.bottom = -18;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.035;
  group.add(sunLight);
  group.add(sunLight.target);

  // Gentle front-left cool sky fill so cliff bevels, crates & medical crosses read cleanly
  const fillLight = new THREE.DirectionalLight(0xa4cdf0, 0.54);
  fillLight.position.set(-11.0, 9.5, 13.5);
  fillLight.target.position.set(0, 1.2, -4.5);
  fillLight.castShadow = false;
  group.add(fillLight);
  group.add(fillLight.target);

  const ambientLight = new THREE.AmbientLight(0x9abde0, 0.18);
  group.add(ambientLight);

  // =========================================================================
  // 13. TWO SMOOTH MOOD PRESETS (blizzard_canyon & blizzard_canyon_w2)
  // =========================================================================
  const CANYON_MOODS = {
    blizzard_canyon: {
      subtitle: '赫兰补给防线 · 寒风冰谷',
      hemiSky: 0xbce0fc, hemiGround: 0x678cb0, hemiInt: 1.02,
      sunColor: 0xebf5ff, sunInt: 1.66,
      fillColor: 0xa4cdf0, fillInt: 0.54,
      ambColor: 0x9abde0, ambInt: 0.18,
      skyHorizon: 0xbcd6ec, skyMid: 0x739fc7, skyZenith: 0x345a8c,
      skyHalo: 0xe2f3ff, skyCloud: 0xdcebf7, skyCloudShade: 0x6e8fb5,
      skyAurora: 0x6888e8, skyAuroraStrength: 0.08,
      skySunStrength: 0.45, skyCloudOpacity: 0.72,
      chasmDeep: 0x163963, chasmVein: 0x4fc6f2, chasmMist: 0xa6cde8,
      roadCrack: 0x286eb8, roadCrackRim: 0xcff2ff, roadCrackGlow: 0.24,
      crystalCoreEmissive: 0x26b4ff, crystalEmissiveMul: 1.00,
      crystalLightColor: 0x52d4ff, crystalLightMul: 1.00,
      crystalRimColor: 0xc8f4ff, crystalRimStrength: 0.72,
      lanternLightMul: 1.00, lanternEmissiveInt: 2.35,
      terrainTint: 0xf4f9ff, cliffTint: 0xffffff, corniceTint: 0xf6faff, mountainTint: 0xe6f2fc,
      jetColor: 0xdcf0ff, jetOpacity: 0.34,
      slitBeamColor: 0xcceeff, slitBeamOpacity: 0.065,
      flurryColor: 0xdcf4ff, flurrySize: 0.24,
      windSpeed: 1.00, windGustAmp: 1.00,
      fog: { color: 0xb4cde2, near: 16, far: 50 },
      background: 0x9bbbd8,
      atmospherePreset: {
        particleType: 'snow',
        particleColor: 0xf2f9ff,
        particleSecondaryColor: 0x9cdfff,
        particleCount: 680,
        particleSpeed: 1.55,
        particleWind: 2.35,
        godRayColor: 0xd6efff,
        godRayOpacity: 0.20,
        godRayOrigin: [6.5, 16.5, -11.5],
        bloomStrength: 0.32,
        bloomThreshold: 0.92,
        bloomRadius: 0.56,
        focusDepth: 0.56,
        blurAmount: 1.55,
        focusBandHalf: 0.19,
        vignetteStrength: 0.14,
        spriteRimTint: [0.92, 0.97, 1.02],
      },
    },
    blizzard_canyon_w2: {
      subtitle: '霜渊领主压阵 · 凛冽紫青暴雪',
      hemiSky: 0x8eb8f0, hemiGround: 0x425b88, hemiInt: 0.94,
      sunColor: 0xc0dcff, sunInt: 1.52,
      fillColor: 0x7aa4e6, fillInt: 0.58,
      ambColor: 0x6f84bc, ambInt: 0.20,
      skyHorizon: 0x7e9fd0, skyMid: 0x3d4d88, skyZenith: 0x19214e,
      skyHalo: 0x9cd8ff, skyCloud: 0x98b4dc, skyCloudShade: 0x3b4878,
      skyAurora: 0x7b6eff, skyAuroraStrength: 0.36,
      skySunStrength: 0.28, skyCloudOpacity: 0.84,
      chasmDeep: 0x122658, chasmVein: 0x3ed8ff, chasmMist: 0x6e92c8,
      roadCrack: 0x2654c8, roadCrackRim: 0x8ee6ff, roadCrackGlow: 0.48,
      crystalCoreEmissive: 0x38d8ff, crystalEmissiveMul: 1.48,
      crystalLightColor: 0x4ad8ff, crystalLightMul: 1.45,
      crystalRimColor: 0xa4ecff, crystalRimStrength: 0.98,
      lanternLightMul: 1.28, lanternEmissiveInt: 2.75,
      terrainTint: 0xdce8fa, cliffTint: 0xd2dcf5, corniceTint: 0xdce8fa, mountainTint: 0xb2c4eb,
      jetColor: 0xb2d8ff, jetOpacity: 0.52,
      slitBeamColor: 0x8cc8ff, slitBeamOpacity: 0.095,
      flurryColor: 0xa8e0ff, flurrySize: 0.30,
      windSpeed: 1.78, windGustAmp: 1.72,
      fog: { color: 0x7b98c4, near: 14.5, far: 44 },
      background: 0x5d7aa8,
      atmospherePreset: {
        particleType: 'snow',
        particleColor: 0xe6f4ff,
        particleSecondaryColor: 0x74ccff,
        particleCount: 920,
        particleSpeed: 2.05,
        particleWind: 3.45,
        godRayColor: 0x92c8ff,
        godRayOpacity: 0.26,
        godRayOrigin: [6.5, 16.5, -11.5],
        bloomStrength: 0.36,
        bloomThreshold: 0.90,
        bloomRadius: 0.62,
        focusDepth: 0.56,
        blurAmount: 1.50,
        focusBandHalf: 0.19,
        vignetteStrength: 0.16,
        spriteRimTint: [0.90, 0.95, 1.03],
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
      sunColor: new THREE.Color(cfg.sunColor),
      sunInt: cfg.sunInt,
      fillColor: new THREE.Color(cfg.fillColor),
      fillInt: cfg.fillInt,
      ambColor: new THREE.Color(cfg.ambColor),
      ambInt: cfg.ambInt,
      skyHorizon: new THREE.Color(cfg.skyHorizon),
      skyMid: new THREE.Color(cfg.skyMid),
      skyZenith: new THREE.Color(cfg.skyZenith),
      skyHalo: new THREE.Color(cfg.skyHalo),
      skyCloud: new THREE.Color(cfg.skyCloud),
      skyCloudShade: new THREE.Color(cfg.skyCloudShade),
      skyAurora: new THREE.Color(cfg.skyAurora),
      skyAuroraStrength: cfg.skyAuroraStrength,
      skySunStrength: cfg.skySunStrength,
      skyCloudOpacity: cfg.skyCloudOpacity,
      chasmDeep: new THREE.Color(cfg.chasmDeep),
      chasmVein: new THREE.Color(cfg.chasmVein),
      chasmMist: new THREE.Color(cfg.chasmMist),
      fogColor: new THREE.Color(cfg.fog.color),
      fogNear: cfg.fog.near,
      fogFar: cfg.fog.far,
      roadCrack: new THREE.Color(cfg.roadCrack),
      roadCrackRim: new THREE.Color(cfg.roadCrackRim),
      roadCrackGlow: cfg.roadCrackGlow,
      crystalCoreEmissive: new THREE.Color(cfg.crystalCoreEmissive),
      crystalEmissiveMul: cfg.crystalEmissiveMul,
      crystalLightColor: new THREE.Color(cfg.crystalLightColor),
      crystalLightMul: cfg.crystalLightMul,
      crystalRimColor: new THREE.Color(cfg.crystalRimColor),
      crystalRimStrength: cfg.crystalRimStrength,
      lanternLightMul: cfg.lanternLightMul,
      lanternEmissiveInt: cfg.lanternEmissiveInt,
      terrainTint: new THREE.Color(cfg.terrainTint),
      cliffTint: new THREE.Color(cfg.cliffTint),
      corniceTint: new THREE.Color(cfg.corniceTint),
      mountainTint: new THREE.Color(cfg.mountainTint),
      jetColor: new THREE.Color(cfg.jetColor),
      jetOpacity: cfg.jetOpacity,
      slitBeamColor: new THREE.Color(cfg.slitBeamColor),
      slitBeamOpacity: cfg.slitBeamOpacity,
      flurryColor: new THREE.Color(cfg.flurryColor),
      flurrySize: cfg.flurrySize,
      windSpeed: cfg.windSpeed,
      windGustAmp: cfg.windGustAmp,
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

  let currentMoodId = 'blizzard_canyon';
  let runtimeTicks = 0;
  let disposed = false;
  let windTimeAccum = 0;

  const moodCur = makeMoodSnap(CANYON_MOODS.blizzard_canyon);
  const moodFrom = makeMoodSnap(CANYON_MOODS.blizzard_canyon);
  const moodTarget = makeMoodSnap(CANYON_MOODS.blizzard_canyon);
  const moodTrans = { active: false, elapsed: 0, duration: 0.9 };
  const baseSnowPillowCol = new THREE.Color(0xe6f1fb);

  function commitMood(s) {
    hemiLight.color.copy(s.hemiSky);
    hemiLight.groundColor.copy(s.hemiGround);
    hemiLight.intensity = s.hemiInt;
    sunLight.color.copy(s.sunColor);
    sunLight.intensity = s.sunInt;
    fillLight.color.copy(s.fillColor);
    fillLight.intensity = s.fillInt;
    ambientLight.color.copy(s.ambColor);
    ambientLight.intensity = s.ambInt;

    skyUniforms.uHorizonCol.value.copy(s.skyHorizon);
    skyUniforms.uMidSkyCol.value.copy(s.skyMid);
    skyUniforms.uZenithCol.value.copy(s.skyZenith);
    skyUniforms.uHaloCol.value.copy(s.skyHalo);
    skyUniforms.uCloudCol.value.copy(s.skyCloud);
    skyUniforms.uCloudShadeCol.value.copy(s.skyCloudShade);
    skyUniforms.uAuroraCol.value.copy(s.skyAurora);
    skyUniforms.uAuroraStrength.value = s.skyAuroraStrength;
    skyUniforms.uSunStrength.value = s.skySunStrength;
    skyUniforms.uCloudOpacity.value = s.skyCloudOpacity;
    skyUniforms.uWindSpeed.value = s.windSpeed;

    chasmUniforms.uDeepCol.value.copy(s.chasmDeep);
    chasmUniforms.uVeinCol.value.copy(s.chasmVein);
    chasmUniforms.uMistCol.value.copy(s.chasmMist);
    chasmUniforms.uFogColor.value.copy(s.fogColor);
    chasmUniforms.uFogNear.value = s.fogNear;
    chasmUniforms.uFogFar.value = s.fogFar;

    roadDecalUniforms.uCrackColor.value.copy(s.roadCrack);
    roadDecalUniforms.uCrackRimColor.value.copy(s.roadCrackRim);
    roadDecalUniforms.uCrackGlow.value = s.roadCrackGlow;

    crystalRimColorUniform.value.copy(s.crystalRimColor);
    crystalRimStrengthUniform.value = s.crystalRimStrength;

    for (let i = 0; i < animatedCrystalCores.length; i++) {
      animatedCrystalCores[i].mat.emissive.copy(s.crystalCoreEmissive);
    }
    for (let i = 0; i < animatedCrystalLights.length; i++) {
      animatedCrystalLights[i].light.color.copy(s.crystalLightColor);
    }
    lanternGlassMat.emissiveIntensity = s.lanternEmissiveInt;

    terrainMat.color.copy(s.terrainTint);
    cliffRockMat.color.copy(s.cliffTint);
    boulderMat.color.copy(s.cliffTint);
    snowCorniceMat.color.copy(s.corniceTint);
    snowPillowMat.color.copy(baseSnowPillowCol).multiply(s.corniceTint);
    mountainMat.color.copy(s.mountainTint);

    jetStreamUniforms.uColor.value.copy(s.jetColor);
    jetStreamUniforms.uOpacity.value = s.jetOpacity;
    jetStreamUniforms.uSpeed.value = s.windSpeed;

    slitBeamUniforms.uColor.value.copy(s.slitBeamColor);
    slitBeamUniforms.uOpacity.value = s.slitBeamOpacity;

    flurryMat.color.copy(s.flurryColor);
    flurryMat.size = s.flurrySize;
  }

  let biomeHandle = null;

  function applyMood(moodId, options = {}) {
    const rawKey = typeof moodId === 'string' ? moodId.trim().toLowerCase() : '';
    const resolvedKey = CANYON_MOODS[rawKey] ? rawKey : 'blizzard_canyon';
    const cfg = CANYON_MOODS[resolvedKey];
    currentMoodId = resolvedKey;

    const targetSnap = makeMoodSnap(cfg);
    const immediate =
      options.immediate === true ||
      options.duration === 0 ||
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
      moodTrans.duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0.9;
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
  // 14. UPDATE & DISPOSE LIFECYCLE
  // =========================================================================
  function update(elapsedSec = 0, dtSec = 0.016) {
    if (disposed) return;

    const t = Number.isFinite(elapsedSec) ? elapsedSec : 0;
    const dt = Number.isFinite(dtSec) ? Math.min(Math.max(dtSec, 0), 0.1) : 0.016;
    if (dt > 0 || t > 0.02) {
      runtimeTicks += 1;
    }

    if (moodTrans.active) {
      moodTrans.elapsed += Math.max(dt, 0.016);
      const rawT = Math.min(1, moodTrans.elapsed / Math.max(0.05, moodTrans.duration));
      const smoothT = rawT * rawT * (3 - 2 * rawT);
      lerpSnap(moodCur, moodFrom, moodTarget, smoothT);
      commitMood(moodCur);
      if (rawT >= 1) {
        moodTrans.active = false;
      }
    }

    windTimeAccum += dt * moodCur.windSpeed;

    // 1. Update sky clouds, chasm mist, road crack pulse, canyon jet-stream snow veils & light shafts
    skyUniforms.uTime.value = t;
    chasmUniforms.uTime.value = t;
    roadDecalUniforms.uTime.value = t;
    jetStreamUniforms.uTime.value = t;
    slitBeamUniforms.uTime.value = t;

    // 2. Hero glacial crystal inner cores & frost point lights harmonic breathing
    const cEmMul = moodCur.crystalEmissiveMul;
    const cLiMul = moodCur.crystalLightMul;
    for (let i = 0; i < animatedCrystalCores.length; i++) {
      const c = animatedCrystalCores[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 1.55 + c.phase);
      c.mat.emissiveIntensity = c.baseInt * cEmMul * (0.84 + wave * 0.34);
    }
    for (let i = 0; i < animatedCrystalLights.length; i++) {
      const l = animatedCrystalLights[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 1.55 + l.phase);
      l.light.intensity = l.baseInt * cLiMul * (0.85 + wave * 0.30);
    }
    for (let i = 0; i < animatedGlowDiscs.length; i++) {
      const d = animatedGlowDiscs[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 1.55 + d.phase);
      d.mat.opacity = Math.min(0.42, d.baseOp * cEmMul * (0.80 + wave * 0.40));
    }

    // 3. Blizzard warning lanterns swinging physically in canyon wind gusts + warm flame flicker
    const gustAmp = moodCur.windGustAmp;
    const lMul = moodCur.lanternLightMul;
    for (let i = 0; i < animatedLanterns.length; i++) {
      const ln = animatedLanterns[i];
      const swingZ =
        (0.08 + 0.14 * Math.sin(t * 2.1 * moodCur.windSpeed + ln.phase) +
          0.06 * Math.sin(t * 4.7 + ln.phase * 1.6)) * gustAmp;
      const swingX = 0.05 * Math.cos(t * 1.65 + ln.phase) * gustAmp;
      ln.pivot.rotation.z = swingZ;
      ln.pivot.rotation.x = swingX;

      const flicker =
        1.0 +
        Math.sin(t * 5.2 + ln.phase) * 0.08 +
        Math.sin(t * 11.3 + ln.phase * 2.1) * 0.04;
      ln.light.intensity = ln.baseInt * lMul * flicker;
      if (ln.halo) {
        const hs = (1.68 + (lMul - 1.0) * 0.55) * (0.94 + flicker * 0.08);
        ln.halo.scale.set(hs, hs, 1);
      }
    }

    // 4. High-altitude canyon jet-stream drifting snow & diagonal sweeping ice dust
    const fAttr = flurryGeo.attributes.position;
    const windV = 3.8 * moodCur.windSpeed;
    const fallV = 0.92 * (0.75 + 0.25 * moodCur.windSpeed);
    const wShift = windTimeAccum || t;
    for (let i = 0; i < flurryCount; i++) {
      const bx = flurrySeeds[i * 4];
      const by = flurrySeeds[i * 4 + 1];
      const bz = flurrySeeds[i * 4 + 2];
      const sp = flurrySeeds[i * 4 + 3];

      // Diagonal sweep from -X/+Y toward +X/-Y across the gorge with crosswind turbulence
      const rawX = bx + wShift * windV * sp;
      const wrappedX = ((((rawX + 16.0) % 32.0) + 32.0) % 32.0) - 16.0;
      const rawY = by - wShift * fallV * sp + Math.sin(t * 1.9 + bx * 0.45) * 0.35 * gustAmp;
      const wrappedY = ((((rawY - 0.4) % 13.4) + 13.4) % 13.4) + 0.4;
      const swayZ = bz + Math.cos(t * 1.35 * moodCur.windSpeed + by * 0.6) * 0.45 * gustAmp;

      fAttr.setXYZ(i, wrappedX, wrappedY, swayZ);
    }
    fAttr.needsUpdate = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    const geoSet = new Set(trackedGeos);
    const matSet = new Set(trackedMats);

    group.traverse((obj) => {
      if (obj.geometry) geoSet.add(obj.geometry);
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) {
            if (m) matSet.add(m);
          }
        } else {
          matSet.add(obj.material);
        }
      }
    });

    for (const g of geoSet) {
      if (typeof g.dispose === 'function') g.dispose();
    }
    for (const m of matSet) {
      if (typeof m.dispose === 'function') m.dispose();
    }
    for (const t of trackedTextures) {
      if (t && typeof t.dispose === 'function') t.dispose();
    }

    if (sunLight.shadow && sunLight.shadow.map && typeof sunLight.shadow.map.dispose === 'function') {
      sunLight.shadow.map.dispose();
    }

    trackedGeos.length = 0;
    trackedMats.length = 0;
    trackedTextures.length = 0;
    animatedCrystalCores.length = 0;
    animatedCrystalLights.length = 0;
    animatedGlowDiscs.length = 0;
    animatedLanterns.length = 0;
  }

  // Commit default mood immediately & prime initial animation frame
  commitMood(moodCur);
  update(0, 0);

  const defaultResult = cloneMoodResult('blizzard_canyon', CANYON_MOODS.blizzard_canyon);
  biomeHandle = {
    id: 'canyon',
    name: '赫兰冰封大峡谷',
    subtitle: CANYON_MOODS.blizzard_canyon.subtitle,
    currentMood: currentMoodId,
    supportedMoods: Object.keys(CANYON_MOODS),
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
