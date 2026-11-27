/**
 * HD-2D 3D Flagship Biome #2: Northern Frost Crystal Woods (极北冰晶古林)
 *
 * Bright blue-gold morning alpine glade with:
 * - Custom sculpted snow heightfield (strict flat y = 0 combat arena on x∈[-8.5, 8.5], z∈[-4.2, 4.2])
 * - Winding GLSL crystal-mirror frozen stream (z ≈ -5.6 ~ -8.5) with subsurface caustics,
 *   ice fracture glints, riverbank snow-capped boulders, icicles, and stepping stones
 * - Instanced multi-tiered (5-layer star/serrated bough + matching snow-cap) snow firs
 *   and frosted silver birches with synchronized vertex wind sway
 * - 7 Hero glowing hexagonal crystal spire clusters (inner #6be8ff radiant core + glossy outer shell)
 * - Half-buried ruined Gothic stone archway (z = -10.5), carved runic standing stones,
 *   and 4 levitating rotating crystal lanterns
 * - Multi-layered glacial mountain panorama, blue-gold morning sky dome with sunlit cirrus clouds,
 *   delicate canopy sunbeams, and low tilt-shift foreground corner stumps & crystal tufts
 */

// ---------------------------------------------------------------------------
// Deterministic pseudo-random & procedural 2D noise helpers
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

// ---------------------------------------------------------------------------
// Stream & Terrain Heightfield Contract
// ---------------------------------------------------------------------------
function getStreamCenterZ(x) {
  // Diagonal gentle meander across z = -5.6 ~ -8.5 behind the combat clearing
  return -7.12 + Math.sin(x * 0.185 + 0.42) * 0.52 + Math.cos(x * 0.08 - 0.25) * 0.18 + x * 0.052;
}

function getStreamHalfWidth(x) {
  return 1.04 + Math.sin(x * 0.26 + 1.05) * 0.21;
}

function getTerrainHeight(x, z) {
  // Strict flat combat safe arena: x ∈ [-8.5, 8.5], z ∈ [-4.2, 4.2]
  // Padded to [-8.9, 8.9] × [-4.5, 4.6] so every mesh triangle inside the arena is strictly y = 0.
  const ax = Math.abs(x);
  if (ax <= 8.9 && z >= -4.5 && z <= 4.6) {
    return 0;
  }

  // Distance outside the strict flat zone
  const dxArena = Math.max(0, ax - 8.9);
  const dzBack = Math.max(0, -4.5 - z);
  const dzFront = Math.max(0, z - 4.6);

  // Smooth clearing fade-out mask (0 inside combat flatland -> 1 outside)
  const arenaMask = smoothstep(0.0, 2.8, Math.hypot(dxArena * 0.9, Math.max(dzBack * 1.1, dzFront * 0.85)));

  // Rolling forest snow hills around left/right flanks and deep back
  const nLarge = fbm2D(x * 0.055 + 3.1, z * 0.06 - 1.7, 4) - 0.44;
  const nMed = fbm2D(x * 0.16 - 4.2, z * 0.15 + 2.8, 3) - 0.5;

  // Amphitheater rise on outer flanks (|x| > 9.2)
  const flankRise = smoothstep(9.0, 23.0, ax) * (2.6 + nLarge * 2.2);

  // Scenic gradual hill rise beyond the stream (z < -9.2)
  const backRise = smoothstep(-8.8, -26.0, z) * (4.8 + nLarge * 3.0);

  // Foreground corridor protection: keep center front low/open for camera sightline;
  // allow gentle low snowbanks only on far front corners (|x| > 8.6, z > 4.8)
  const cornerFrontRise = smoothstep(8.6, 13.5, ax) * smoothstep(4.6, 9.0, z) * 0.72;
  const centerFrontSlope = (1.0 - smoothstep(6.8, 10.5, ax)) * smoothstep(5.0, 14.0, z) * -0.35;

  let h = (flankRise + backRise + cornerFrontRise + nMed * 0.42) * arenaMask + centerFrontSlope;

  // Gentle flat terrace around the ancient Gothic stone arch (x ∈ [-4.4, 4.4], z ∈ [-12.0, -9.4])
  const archDist = Math.hypot((x / 4.8), ((z + 10.6) / 1.85));
  if (archDist < 1.55) {
    const archBlend = 1.0 - smoothstep(0.65, 1.55, archDist);
    h = lerp(h, 0.34, archBlend);
  }

  // Carve winding riverbed channel along the frozen stream
  const scz = getStreamCenterZ(x);
  const shw = getStreamHalfWidth(x);
  const dStream = Math.abs(z - scz);
  const streamCarve = 1.0 - smoothstep(shw * 0.55, shw + 1.05, dStream);
  // Protect combat flatland boundary z >= -4.5 from stream carving
  const safeBackGuard = smoothstep(-4.5, -5.25, z);
  const effectiveCarve = streamCarve * safeBackGuard;
  if (effectiveCarve > 0.0001) {
    const bedDepth = -0.58 + (fbm2D(x * 0.35, z * 0.35, 2) - 0.5) * 0.08;
    h = lerp(h, bedDepth, effectiveCarve);
  }

  return h;
}

// ---------------------------------------------------------------------------
// Texture & Resource Management Helpers
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
  grad.addColorStop(0.32, 'rgba(170,242,255,0.65)');
  grad.addColorStop(0.7, 'rgba(100,210,255,0.18)');
  grad.addColorStop(1.0, 'rgba(80,180,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  trackedTextures.push(tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Self-contained BufferGeometry Merge Utility
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

function setUniformVertexColor(THREE, geo, hexColor, jitter = 0) {
  const count = geo.attributes.position.count;
  const col = new THREE.Color(hexColor);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j = jitter ? (hash2(i * 0.73, hexColor * 0.01) - 0.5) * jitter : 0;
    arr[i * 3] = clamp(col.r + j, 0, 1);
    arr[i * 3 + 1] = clamp(col.g + j, 0, 1);
    arr[i * 3 + 2] = clamp(col.b + j, 0, 1);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// ---------------------------------------------------------------------------
// Procedural Sculpted Geometries: Multi-Tiered Snow Fir, Silver Birch, Crystals
// ---------------------------------------------------------------------------

/**
 * Builds a single scalloped/star-shaped pine bough tier with drooping branch tips,
 * underside cap, and rich pine-to-frost vertex color gradient.
 * Winding uses x = cos(theta)*r, z = -sin(theta)*r (CCW from +Y => outward normals).
 */
function createStarBoughTier(THREE, opts) {
  const {
    y0,
    y1,
    rBot,
    rTop,
    lobes,
    lobeAmp,
    droop,
    twist,
    rings = 3,
    colInner,
    colOuter,
    colTip,
    isSnowCap = false,
  } = opts;

  const radialSegs = lobes * 3;
  const stride = radialSegs + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const cIn = new THREE.Color(colInner);
  const cOut = new THREE.Color(colOuter);
  const cTip = new THREE.Color(colTip);
  const tmpCol = new THREE.Color();

  for (let j = 0; j <= rings; j++) {
    const v = j / rings; // 0 = outer lower rim, 1 = upper collar/tip
    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const theta = u * Math.PI * 2 + twist;
      const wave = Math.cos(lobes * (theta - twist));
      const lobe01 = 0.5 + 0.5 * wave;
      const sharp = Math.pow(lobe01, 1.32) * 2.0 - 1.0;

      // For snow caps, curl the lowest ring (v = 0) slightly inward & down for a plush pillow rim
      let rBase = lerp(rBot, rTop, Math.pow(v, 0.9));
      let y = lerp(y0, y1, v);

      if (isSnowCap) {
        const pillowLip = j === 0 ? -0.05 : Math.sin(v * Math.PI) * 0.045;
        rBase *= j === 0 ? 0.96 : 1.0;
        y += pillowLip;
      }

      const lobeMod = 1.0 + lobeAmp * sharp * (1.0 - v * 0.68);
      const r = Math.max(0.015, rBase * lobeMod);
      const tipDroop = droop * Math.max(0, sharp) * (1.0 - v) * (1.0 - v);
      y -= tipDroop;

      const x = Math.cos(theta) * r;
      const z = -Math.sin(theta) * r;
      positions.push(x, y, z);
      uvs.push(u * 2.0, v);

      if (isSnowCap) {
        // Cool frosty sky tint along lower edge -> bright pure sunlit snow on top
        tmpCol.copy(cIn).lerp(cOut, smoothstep(0.0, 0.65, v));
        if (sharp > 0.25 && v > 0.15) tmpCol.lerp(cTip, 0.35);
      } else {
        // Deep alpine emerald in inner notches -> frosted sage-teal on sunlit outer boughs
        tmpCol.copy(cIn).lerp(cOut, smoothstep(0.05, 0.85, lobe01 * 0.6 + v * 0.4));
        if (v < 0.45 && sharp > 0.35) tmpCol.lerp(cTip, 0.38);
      }
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
    }
  }

  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Underside dark-shaded bough cap (only on foliage tiers, never needed on snow caps)
  if (!isSnowCap) {
    const centerIdx = positions.length / 3;
    positions.push(0, y0 + 0.14, 0);
    uvs.push(0.5, 0.5);
    const underCol = cIn.clone().multiplyScalar(0.68);
    colors.push(underCol.r, underCol.g, underCol.b);
    for (let i = 0; i < radialSegs; i++) {
      const a = i;
      const b = i + 1;
      // Downward normal (-Y) with CCW from above means (center, b, a)
      indices.push(centerIdx, b, a);
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
 * Builds the 3 merged assets for a rich 5-tier snow-laden alpine fir tree:
 * - trunkGeo (fluted tapered bark trunk with root flare)
 * - foliageGeo (5 staggered star/serrated bough tiers)
 * - snowGeo (5 sculpted matching snow pillows + plump spire snow cap)
 */
function buildSnowFirAssetGeometries(THREE) {
  // 1. Fluted Trunk with slight organic flare at base
  const trunkParts = [];
  const mainTrunk = new THREE.CylinderGeometry(0.11, 0.30, 3.2, 8, 4);
  mainTrunk.translate(0, 1.6, 0);
  const tPos = mainTrunk.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    if (y < 0.7) {
      const flare = 1.0 + (1.0 - y / 0.7) * 0.38;
      const angle = Math.atan2(tPos.getZ(i), tPos.getX(i));
      const rootBump = 1.0 + 0.14 * Math.cos(angle * 4.0) * (1.0 - y / 0.7);
      tPos.setX(i, tPos.getX(i) * flare * rootBump);
      tPos.setZ(i, tPos.getZ(i) * flare * rootBump);
    }
  }
  mainTrunk.computeVertexNormals();
  setUniformVertexColor(THREE, mainTrunk, 0x6f5546, 0.06);
  trunkParts.push(mainTrunk);
  const trunkGeo = mergeGeometries(THREE, trunkParts);

  // 2. Five Staggered Star/Serrated Bough Tiers + Matching Snow Caps
  const tiers = [
    { y0: 0.95, y1: 2.35, rBot: 1.88, rTop: 0.56, lobes: 11, amp: 0.25, droop: 0.26, twist: 0.0 },
    { y0: 1.98, y1: 3.30, rBot: 1.56, rTop: 0.48, lobes: 10, amp: 0.26, droop: 0.22, twist: 0.52 },
    { y0: 2.95, y1: 4.18, rBot: 1.24, rTop: 0.38, lobes: 9, amp: 0.26, droop: 0.18, twist: 1.08 },
    { y0: 3.85, y1: 4.96, rBot: 0.90, rTop: 0.26, lobes: 8, amp: 0.24, droop: 0.13, twist: 1.66 },
    { y0: 4.68, y1: 5.82, rBot: 0.54, rTop: 0.04, lobes: 7, amp: 0.20, droop: 0.08, twist: 2.24 },
  ];

  const foliageParts = [];
  const snowParts = [];

  for (let t = 0; t < tiers.length; t++) {
    const cfg = tiers[t];
    foliageParts.push(
      createStarBoughTier(THREE, {
        y0: cfg.y0,
        y1: cfg.y1,
        rBot: cfg.rBot,
        rTop: cfg.rTop,
        lobes: cfg.lobes,
        lobeAmp: cfg.amp,
        droop: cfg.droop,
        twist: cfg.twist,
        rings: 3,
        colInner: 0x1e5058,
        colOuter: 0x3b7c7d,
        colTip: 0x6eb3ad,
        isSnowCap: false,
      })
    );

    // Matching snow pillow perched cleanly atop each foliage bough tier
    snowParts.push(
      createStarBoughTier(THREE, {
        y0: cfg.y0 + 0.16 + (t === 4 ? 0.04 : 0),
        y1: cfg.y1 + 0.12,
        rBot: cfg.rBot * 0.93,
        rTop: Math.max(0.03, cfg.rTop * 0.96),
        lobes: cfg.lobes,
        lobeAmp: cfg.amp * 0.96,
        droop: cfg.droop * 0.85,
        twist: cfg.twist,
        rings: 3,
        colInner: 0xcbe4f8,
        colOuter: 0xf4faff,
        colTip: 0xffffff,
        isSnowCap: true,
      })
    );
  }

  // Plump rounded snow tuft crowning the very spire tip
  const tipSnow = new THREE.SphereGeometry(0.14, 8, 6);
  tipSnow.scale(1.0, 1.35, 1.0);
  tipSnow.translate(0, 5.90, 0);
  setUniformVertexColor(THREE, tipSnow, 0xf8fcff, 0.02);
  snowParts.push(tipSnow);

  const foliageGeo = mergeGeometries(THREE, foliageParts);
  const snowGeo = mergeGeometries(THREE, snowParts);

  return { trunkGeo, foliageGeo, snowGeo };
}

/**
 * Builds stylized frosted Silver Birch geometries:
 * - trunkGeo (slender gracefully forked pale silver-bark trunk with horizontal dark lenticels)
 * - canopyGeo (clustered sunlit frost-white / champagne-gold / pale-cyan crystalline winter foliage)
 */
function buildSilverBirchGeometries(THREE) {
  const trunkParts = [];

  // Main slender slightly curved trunk
  const mainStem = new THREE.CylinderGeometry(0.08, 0.17, 4.4, 7, 8);
  mainStem.translate(0, 2.2, 0);
  const pos = mainStem.attributes.position;
  const colArr = new Float32Array(pos.count * 3);
  const cLight = new THREE.Color(0xeef3f8);
  const cStripe = new THREE.Color(0x525d6b);
  const cBase = new THREE.Color(0x6d7480);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const bendX = Math.sin(y * 0.55) * 0.12;
    const bendZ = Math.cos(y * 0.42) * 0.08;
    pos.setX(i, pos.getX(i) + bendX);
    pos.setZ(i, pos.getZ(i) + bendZ);

    // Classic silver birch bark markings (darker base + occasional horizontal dark flecks)
    const band = Math.sin(y * 6.8 + hash2(Math.floor(y * 2), 1.3) * 4.0);
    tmp.copy(cLight);
    if (y < 0.7) tmp.lerp(cBase, 1.0 - y / 0.7);
    else if (band > 0.72) tmp.lerp(cStripe, 0.65);
    colArr[i * 3] = tmp.r;
    colArr[i * 3 + 1] = tmp.g;
    colArr[i * 3 + 2] = tmp.b;
  }
  mainStem.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  mainStem.computeVertexNormals();
  trunkParts.push(mainStem);

  // 3 graceful upward forked limbs
  const limbs = [
    { y: 2.8, len: 1.5, rx: 0.42, rz: 0.38, r0: 0.065 },
    { y: 3.1, len: 1.4, rx: -0.35, rz: -0.45, r0: 0.06 },
    { y: 3.4, len: 1.25, rx: 0.28, rz: -0.36, r0: 0.05 },
  ];
  for (const lb of limbs) {
    const bGeo = new THREE.CylinderGeometry(lb.r0 * 0.45, lb.r0, lb.len, 6, 2);
    bGeo.translate(0, lb.len * 0.5, 0);
    bGeo.rotateX(lb.rx);
    bGeo.rotateZ(lb.rz);
    bGeo.translate(0, lb.y, 0);
    setUniformVertexColor(THREE, bGeo, 0xe2eaf2, 0.05);
    trunkParts.push(bGeo);
  }
  const trunkGeo = mergeGeometries(THREE, trunkParts);

  // Frosted crystalline winter birch foliage clusters (airy snow-white & warm gold rime tips)
  const canopyParts = [];
  const blobs = [
    { x: 0.0, y: 4.95, z: 0.0, sx: 1.15, sy: 0.95, sz: 1.15, col: 0xf0f8ff },
    { x: 0.72, y: 4.25, z: 0.42, sx: 0.92, sy: 0.78, sz: 0.88, col: 0xfaf2df },
    { x: -0.78, y: 4.45, z: -0.32, sx: 0.95, sy: 0.82, sz: 0.92, col: 0xdcf0ff },
    { x: 0.35, y: 3.85, z: -0.68, sx: 0.86, sy: 0.70, sz: 0.85, col: 0xeaf6ff },
    { x: -0.42, y: 3.72, z: 0.65, sx: 0.82, sy: 0.68, sz: 0.82, col: 0xfdf5e4 },
    { x: 0.08, y: 5.58, z: -0.10, sx: 0.72, sy: 0.66, sz: 0.72, col: 0xffffff },
  ];

  for (let b = 0; b < blobs.length; b++) {
    const bl = blobs[b];
    const g = new THREE.IcosahedronGeometry(1.0, 1);
    const gp = g.attributes.position;
    const gc = new Float32Array(gp.count * 3);
    const baseC = new THREE.Color(bl.col);
    const shadeC = new THREE.Color(0xaed4f0);
    const mixC = new THREE.Color();

    for (let i = 0; i < gp.count; i++) {
      const vx = gp.getX(i);
      const vy = gp.getY(i);
      const vz = gp.getZ(i);
      const bump = 0.84 + 0.30 * hash2(vx * 7.1 + b * 3.3, vz * 9.7 + vy * 5.2);
      gp.setXYZ(i, vx * bl.sx * bump + bl.x, vy * bl.sy * bump + bl.y, vz * bl.sz * bump + bl.z);

      const topFactor = clamp((vy + 1.0) * 0.5, 0, 1);
      mixC.copy(shadeC).lerp(baseC, smoothstep(0.05, 0.85, topFactor));
      gc[i * 3] = mixC.r;
      gc[i * 3 + 1] = mixC.g;
      gc[i * 3 + 2] = mixC.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    const flatG = g.index ? g.toNonIndexed() : g;
    if (flatG !== g) g.dispose();
    flatG.computeVertexNormals();
    canopyParts.push(flatG);
  }

  const canopyGeo = mergeGeometries(THREE, canopyParts);
  return { trunkGeo, canopyGeo };
}

/**
 * Builds a sharp, faceted hexagonal crystal prism geometry with natural irregularity
 * and pointed crystal pyramid apex (non-indexed for razor-crisp crystal facet shading).
 */
function createCrystalPrismGeo(THREE, radius, height, seed = 1.0) {
  const sides = 6;
  const rFactors = [];
  for (let i = 0; i < sides; i++) {
    rFactors.push(0.84 + 0.32 * hash2(i * 1.9 + seed, seed * 3.7));
  }

  const shoulderY = height * (0.70 + 0.08 * hash2(seed, 5.1));
  const tipOffX = (hash2(seed, 2.3) - 0.5) * radius * 0.28;
  const tipOffZ = (hash2(seed, 8.7) - 0.5) * radius * 0.28;

  const basePts = [];
  const shoulderPts = [];
  for (let i = 0; i < sides; i++) {
    const theta = (i / sides) * Math.PI * 2;
    const rb = radius * rFactors[i];
    const rs = rb * 0.78;
    // CCW from +Y: x = cos(theta)*r, z = -sin(theta)*r
    basePts.push([Math.cos(theta) * rb, 0, -Math.sin(theta) * rb]);
    shoulderPts.push([Math.cos(theta) * rs + tipOffX * 0.35, shoulderY, -Math.sin(theta) * rs + tipOffZ * 0.35]);
  }
  const tipPt = [tipOffX, height, tipOffZ];

  const pos = [];
  const uv = [];

  function pushTri(a, b, c, ua, ub, uc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }

  for (let i = 0; i < sides; i++) {
    const ni = (i + 1) % sides;
    const u0 = i / sides;
    const u1 = (i + 1) / sides;
    const b0 = basePts[i];
    const b1 = basePts[ni];
    const s0 = shoulderPts[i];
    const s1 = shoulderPts[ni];

    // Shaft facet quad (outward CCW)
    pushTri(b0, b1, s0, [u0, 0], [u1, 0], [u0, 0.72]);
    pushTri(b1, s1, s0, [u1, 0], [u1, 0.72], [u0, 0.72]);
    // Apex pyramidal facet
    pushTri(s0, s1, tipPt, [u0, 0.72], [u1, 0.72], [(u0 + u1) * 0.5, 1.0]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Adds synchronized gentle morning wind sway to instanced tree materials
 * while keeping trunks solidly rooted at y <= 0.55.
 */
function attachWindSway(material, windUniform, windAmpUniform) {
  const ampU = windAmpUniform || { value: 1.0 };
  material.customProgramCacheKey = () => 'forest_wind_sway_v2';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.uniforms.uWindAmp = ampU;
    shader.vertexShader =
      `uniform float uWindTime;\nuniform float uWindAmp;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float wH = max(0.0, position.y - 0.55);
        float wSeed = 0.0;
        #ifdef USE_INSTANCING
          wSeed = instanceMatrix[3].x * 0.39 + instanceMatrix[3].z * 0.27;
        #endif
        float wPhase = uWindTime * 1.35 + wSeed;
        float wBend = wH * wH * 0.0082 * uWindAmp;
        transformed.x += sin(wPhase) * wBend + sin(wPhase * 2.1 + 0.6) * wBend * 0.24;
        transformed.z += cos(wPhase * 0.85) * wBend * 0.62;`
      );
  };
}

// ---------------------------------------------------------------------------
// Main Biome Builder Export
// ---------------------------------------------------------------------------
export function buildForestBiome(THREE, texLib = {}) {
  const group = new THREE.Group();
  group.name = 'biome_forest_northern_crystal_woods';

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

  // Shared animation uniforms & handles
  const windUniform = { value: 0 };
  const windAmpUniform = { value: 1.0 };
  const sunDirNorm = new THREE.Vector3(8, 14, -9).normalize();
  const fogColorVec = new THREE.Color(0xcbe3f6);

  // Resolve softGlowDisc (non-repeating)
  const glowDiscTex =
    resolveSingleTex(texLib.softGlowDisc) || createFallbackGlowTexture(THREE, trackedTextures);

  // =========================================================================
  // 1. CLEAR BLUE-GOLD MORNING SKY DOME (GLSL ShaderMaterial)
  // =========================================================================
  const skyGeo = trackGeo(new THREE.SphereGeometry(94, 40, 24));
  const skyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDirNorm.clone() },
    uHorizonCol: { value: new THREE.Color(0.82, 0.91, 0.98) },
    uMidSkyCol: { value: new THREE.Color(0.55, 0.79, 0.95) },
    uZenithCol: { value: new THREE.Color(0.30, 0.58, 0.88) },
    uWarmScatterCol: { value: new THREE.Color(1.0, 0.90, 0.72) },
    uGoldHaloCol: { value: new THREE.Color(1.0, 0.95, 0.80) },
    uHorizonBandCol: { value: new THREE.Color(0.98, 0.94, 0.86) },
    uBelowHorizonCol: { value: new THREE.Color(0.76, 0.88, 0.96) },
    uCloudWarmCol: { value: new THREE.Color(1.0, 0.96, 0.86) },
    uSunStrength: { value: 1.0 },
    uCloudOpacity: { value: 0.56 },
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
        uniform vec3 uWarmScatterCol;
        uniform vec3 uGoldHaloCol;
        uniform vec3 uHorizonBandCol;
        uniform vec3 uBelowHorizonCol;
        uniform vec3 uCloudWarmCol;
        uniform float uSunStrength;
        uniform float uCloudOpacity;
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

          // Crisp luminous alpine sky gradient matching scene fog at horizon
          vec3 sky = mix(uHorizonCol, uMidSkyCol, smoothstep(0.0, 0.34, h));
          sky = mix(sky, uZenithCol, smoothstep(0.28, 0.95, h));

          // Sun / moon directional scatter & luminous corona aligned with godRayOrigin
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          vec3 warmScatter = uWarmScatterCol * pow(sunDot, 3.6) * 0.34;
          vec3 goldHalo    = uGoldHaloCol * pow(sunDot, 22.0) * 0.45;
          vec3 sunDisc     = (uGoldHaloCol * 1.12) * smoothstep(0.9945, 0.999, sunDot);
          sky += (warmScatter + goldHalo + sunDisc) * uSunStrength;

          // Subtle luminous band right along the sunlit / moonlit horizon
          float horizonBand = exp(-abs(dir.y) * 9.0) * (0.25 + 0.75 * pow(sunDot, 2.0));
          sky = mix(sky, uHorizonBandCol, horizonBand * 0.38 * uSunStrength);

          // Drifting high-altitude cirrus / winter storm clouds
          if (dir.y > 0.03) {
            vec2 cloudUv = dir.xz / (dir.y + 0.24) * 1.15 + vec2(uTime * 0.008, -uTime * 0.004);
            float c1 = fbm(cloudUv * 1.35);
            float c2 = fbm(cloudUv * 2.7 + vec2(3.4, -1.8));
            float cloudMask = smoothstep(0.49, 0.78, c1 * 0.68 + c2 * 0.32);
            cloudMask *= smoothstep(0.03, 0.22, dir.y) * (1.0 - smoothstep(0.65, 0.98, dir.y) * 0.45);
            vec3 cloudCol = mix(uHorizonCol * 1.06, uCloudWarmCol, pow(sunDot, 2.2) * 0.75);
            sky = mix(sky, cloudCol, cloudMask * uCloudOpacity);
          }

          // Smooth mist blend below horizon
          if (dir.y < 0.0) {
            sky = mix(uHorizonCol, uBelowHorizonCol, smoothstep(0.0, -0.25, dir.y));
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
  );
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'morning_sky_dome';
  skyMesh.renderOrder = -10;
  group.add(skyMesh);

  // =========================================================================
  // 2. SCULPTED SNOW CLEARING TERRAIN + FLUSH ANCIENT FOOTPATH FLAGS
  // =========================================================================
  const terrainW = 78;
  const terrainD = 62;
  const terrainGeo = trackGeo(new THREE.PlaneGeometry(terrainW, terrainD, 156, 124));
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, -5);

  const tPos = terrainGeo.attributes.position;
  const tCol = new Float32Array(tPos.count * 3);
  const colArena = new THREE.Color(0xf6fbff);
  const colSunWarm = new THREE.Color(0xfffcf2);
  const colSlopeShade = new THREE.Color(0xd2e6f7);
  const colBankIce = new THREE.Color(0xa6d8f2);
  const colRiverBed = new THREE.Color(0x5299cc);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    const y = getTerrainHeight(x, z);
    tPos.setY(i, y);

    const scz = getStreamCenterZ(x);
    const shw = getStreamHalfWidth(x);
    const dStream = Math.abs(z - scz);
    const inArena = 1.0 - smoothstep(7.5, 13.5, Math.hypot(x * 0.82, z * 1.45));

    // Base bright porcelain snow -> soft periwinkle shadow tint on outer forest hills
    tmpColor.copy(colSlopeShade).lerp(colArena, 0.45 + 0.55 * inArena);

    // Subtle warm sun-dappled tint on the sunlit right-center glade floor
    const sunPool = 1.0 - smoothstep(0.0, 9.5, Math.hypot(x - 2.2, z + 0.8));
    tmpColor.lerp(colSunWarm, sunPool * 0.42);

    // Cool glacial blue tint inside riverbank and underwater trough
    if (z < -4.55) {
      const bankFactor = 1.0 - smoothstep(shw * 0.4, shw + 0.9, dStream);
      const bedFactor = 1.0 - smoothstep(0.0, shw * 0.85, dStream);
      tmpColor.lerp(colBankIce, bankFactor * 0.65);
      tmpColor.lerp(colRiverBed, bedFactor * 0.72);
    }

    // Subtle micro-snow sparkle/tone variation outside flat floor center
    const micro = (fbm2D(x * 0.42, z * 0.42, 2) - 0.5) * 0.04;
    tCol[i * 3] = clamp(tmpColor.r + micro, 0, 1);
    tCol[i * 3 + 1] = clamp(tmpColor.g + micro, 0, 1);
    tCol[i * 3 + 2] = clamp(tmpColor.b + micro * 0.5, 0, 1);
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  terrainGeo.computeVertexNormals();

  const snowTex = resolveTexBundle(THREE, texLib.snowGround, 14, 11, trackedTextures);
  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: snowTex.roughnessMap ? 0.82 : 0.58,
      metalness: 0.04,
      ...(snowTex.map ? { map: snowTex.map } : {}),
      ...(snowTex.normalMap ? { normalMap: snowTex.normalMap, normalScale: new THREE.Vector2(0.55, 0.55) } : {}),
      ...(snowTex.bumpMap ? { bumpMap: snowTex.bumpMap, bumpScale: 0.08 } : {}),
      ...(snowTex.roughnessMap ? { roughnessMap: snowTex.roughnessMap } : {}),
    })
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'snow_glade_terrain';
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Subtle ambient frost-crystal ring sheen flush on clearing snow (y = 0.008, non-blocking)
  let arenaSheenMat = null;
  if (glowDiscTex) {
    const arenaSheenGeo = trackGeo(new THREE.PlaneGeometry(14.5, 7.4));
    arenaSheenGeo.rotateX(-Math.PI / 2);
    arenaSheenMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: glowDiscTex,
        color: 0xdaf4ff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const arenaSheen = new THREE.Mesh(arenaSheenGeo, arenaSheenMat);
    arenaSheen.position.set(0.4, 0.008, -0.3);
    group.add(arenaSheen);
  }

  // Shared PBR Stone & Marble Materials (used by flagstones, ruins, cobbles, pedestals)
  const stoneTex = resolveTexBundle(THREE, texLib.courtyardStone, 2, 2, trackedTextures);
  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8e4ef,
      roughness: stoneTex.roughnessMap ? 0.92 : 0.78,
      metalness: 0.06,
      ...(stoneTex.map ? { map: stoneTex.map } : {}),
      ...(stoneTex.normalMap ? { normalMap: stoneTex.normalMap, normalScale: new THREE.Vector2(0.75, 0.75) } : {}),
      ...(stoneTex.bumpMap ? { bumpMap: stoneTex.bumpMap, bumpScale: 0.1 } : {}),
      ...(stoneTex.roughnessMap ? { roughnessMap: stoneTex.roughnessMap } : {}),
    })
  );

  const marbleTex = resolveTexBundle(THREE, texLib.marble, 2, 2, trackedTextures);
  const marbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeaf2fa,
      roughness: marbleTex.roughnessMap ? 0.72 : 0.42,
      metalness: 0.08,
      ...(marbleTex.map ? { map: marbleTex.map } : {}),
      ...(marbleTex.normalMap ? { normalMap: marbleTex.normalMap, normalScale: new THREE.Vector2(0.45, 0.45) } : {}),
      ...(marbleTex.bumpMap ? { bumpMap: marbleTex.bumpMap, bumpScale: 0.05 } : {}),
      ...(marbleTex.roughnessMap ? { roughnessMap: marbleTex.roughnessMap } : {}),
    })
  );

  const snowCapTex = resolveTexBundle(THREE, texLib.snowGround, 3, 3, trackedTextures);
  const snowPillowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4faff,
      roughness: snowCapTex.roughnessMap ? 0.8 : 0.52,
      metalness: 0.03,
      ...(snowCapTex.map ? { map: snowCapTex.map } : {}),
      ...(snowCapTex.normalMap ? { normalMap: snowCapTex.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) } : {}),
      ...(snowCapTex.bumpMap ? { bumpMap: snowCapTex.bumpMap, bumpScale: 0.05 } : {}),
      ...(snowCapTex.roughnessMap ? { roughnessMap: snowCapTex.roughnessMap } : {}),
    })
  );
  const baseArenaSheenColor = new THREE.Color(0xdaf4ff);
  const baseStoneColor = new THREE.Color(0xd8e4ef);
  const baseMarbleColor = new THREE.Color(0xeaf2fa);
  const baseSnowPillowColor = new THREE.Color(0xf4faff);
  const whiteTintColor = new THREE.Color(0xffffff);
  const tmpFoliageTint = new THREE.Color(0xffffff);

  // Half-buried flush ancient flagstones along the rear edge (z = -4.55 ~ -5.35, outside combat zone)
  const flagstoneGeo = trackGeo(new THREE.CylinderGeometry(0.48, 0.54, 0.06, 7));
  const flagCoords = [
    [-1.4, -4.65, 1.05, 0.85, 0.3],
    [-0.35, -4.95, 1.25, 0.92, -0.4],
    [0.75, -4.75, 0.95, 0.82, 0.9],
    [1.65, -5.12, 1.15, 0.88, -0.15],
    [-2.45, -5.05, 0.88, 0.76, 0.65],
    [0.15, -8.85, 1.28, 0.96, 0.2],
    [-0.75, -9.35, 1.12, 0.86, -0.5],
    [0.95, -9.55, 1.18, 0.90, 0.45],
  ];
  const flagInst = new THREE.InstancedMesh(flagstoneGeo, marbleMat, flagCoords.length);
  flagInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < flagCoords.length; i++) {
    const [fx, fz, sx, sz, ry] = flagCoords[i];
    const fy = getTerrainHeight(fx, fz);
    dummy.position.set(fx, fy - 0.005, fz);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(sx, 1, sz);
    dummy.updateMatrix();
    flagInst.setMatrixAt(i, dummy.matrix);
  }
  flagInst.instanceMatrix.needsUpdate = true;
  flagInst.frustumCulled = false;
  group.add(flagInst);

  // =========================================================================
  // 3. GLSL FROZEN CRYSTAL STREAM (z = -5.6 ~ -8.5) + RIVERBANK PROPS
  // =========================================================================
  const streamSegX = 136;
  const streamSegW = 10;
  const streamXMin = -35;
  const streamXMax = 35;
  const streamY = -0.18;

  const sPos = [];
  const sUv = [];
  const sIdx = [];
  const sStride = streamSegW + 1;

  for (let ix = 0; ix <= streamSegX; ix++) {
    const u = ix / streamSegX;
    const x = lerp(streamXMin, streamXMax, u);
    const cz = getStreamCenterZ(x);
    // Slightly wider than visible channel so ribbon edges tuck cleanly beneath snowbanks
    const hw = getStreamHalfWidth(x) + 0.58;
    for (let iw = 0; iw <= streamSegW; iw++) {
      const v = iw / streamSegW;
      const z = cz + (v * 2 - 1) * hw;
      sPos.push(x, streamY, z);
      sUv.push(u * 14.0, v);
    }
  }
  for (let ix = 0; ix < streamSegX; ix++) {
    for (let iw = 0; iw < streamSegW; iw++) {
      const a = ix * sStride + iw;
      const b = (ix + 1) * sStride + iw;
      const c = a + 1;
      const d = b + 1;
      // Upward normal (+Y): (a, c, b) and (b, c, d)
      sIdx.push(a, c, b);
      sIdx.push(b, c, d);
    }
  }

  const streamGeo = trackGeo(new THREE.BufferGeometry());
  streamGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  streamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2));
  streamGeo.setIndex(sIdx);
  streamGeo.computeVertexNormals();

  const iceStreamUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDirNorm.clone() },
    uFogColor: { value: fogColorVec.clone() },
    uFogNear: { value: 16.0 },
    uFogFar: { value: 48.0 },
    uDeepIceCol: { value: new THREE.Color(0.16, 0.48, 0.78) },
    uBrightIceCol: { value: new THREE.Color(0.46, 0.84, 0.98) },
    uSpecCol: { value: new THREE.Color(1.0, 0.97, 0.88) },
    uFrostTint: { value: new THREE.Color(0xffffff) },
    uFrostCover: { value: 0.0 },
  };

  const iceStreamMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: iceStreamUniforms,
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
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform vec3 uDeepIceCol;
        uniform vec3 uBrightIceCol;
        uniform vec3 uSpecCol;
        uniform vec3 uFrostTint;
        uniform float uFrostCover;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        vec2 hash22(vec2 p) {
          float n = hash21(p);
          return vec2(n, hash21(p + n * 17.3));
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

        // Cellular Voronoi border distance for crystalline ice fracture veins
        float iceCracks(vec2 p) {
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
              if (d < d1) {
                d2 = d1;
                d1 = d;
              } else if (d < d2) {
                d2 = d;
              }
            }
          }
          return sqrt(d2) - sqrt(d1);
        }

        void main() {
          // Soft icy rime margin along riverbanks
          float bankDist = min(vUv.y, 1.0 - vUv.y);
          float edgeWobble = (vnoise(vWorldPos.xz * 2.4) - 0.5) * 0.08;
          float frostEdge = 1.0 - smoothstep(0.06, 0.27, bankDist + edgeWobble);

          // Flowing translucent subsurface meltwater ribbons & caustics beneath crystal ice
          vec2 flowUv1 = vec2(vUv.x * 1.45 - uTime * 0.34, vUv.y * 4.2 + sin(vUv.x * 2.5 + uTime * 0.5) * 0.14);
          vec2 flowUv2 = vec2(vUv.x * 2.35 - uTime * 0.52, vUv.y * 6.5 - cos(vUv.x * 3.1 - uTime * 0.4) * 0.12);
          float w1 = vnoise(flowUv1);
          float w2 = vnoise(flowUv2);
          float caustic1 = pow(clamp(1.0 - abs(w1 * 2.0 - 1.0), 0.0, 1.0), 3.4);
          float caustic2 = pow(clamp(1.0 - abs(w2 * 2.0 - 1.0), 0.0, 1.0), 4.0);
          float caustics = clamp(caustic1 * 0.65 + caustic2 * 0.55, 0.0, 1.0);

          // Static faceted ice sheet fracture veins
          float crackDist = iceCracks(vWorldPos.xz * 0.95);
          float crackLine = 1.0 - smoothstep(0.0, 0.055, crackDist);
          float fineCrack = 1.0 - smoothstep(0.0, 0.035, iceCracks(vWorldPos.xz * 2.1 + 4.2));

          // Perturbed ice mirror normal for Fresnel sky reflection & sun/moon glints
          float nx = (w1 - 0.5) * 0.18 + (w2 - 0.5) * 0.10;
          float nz = (w2 - 0.5) * 0.18 - (w1 - 0.5) * 0.08;
          vec3 N = normalize(vec3(nx, 1.0, nz));
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunDir);
          vec3 H = normalize(L + V);

          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
          float specBroad = pow(max(dot(N, H), 0.0), 64.0);
          float sparklePhase = 0.55 + 0.45 * sin(uTime * 3.8 + vWorldPos.x * 7.5 + vWorldPos.z * 9.2);
          float specGlint = pow(max(dot(N, H), 0.0), 190.0) * sparklePhase;

          // Luminous clear sapphire-glacial palette
          vec3 col = mix(uDeepIceCol, uBrightIceCol, 0.36 + caustics * 0.52);

          // Reflected sky & ice crystal veins
          vec3 skyRefl = mix(uFogColor * 0.95, uSpecCol, pow(max(dot(reflect(-V, N), L), 0.0), 3.0) * 0.6);
          col = mix(col, skyRefl, clamp(fresnel * 0.68 + 0.14, 0.0, 0.82));
          col += vec3(0.78, 0.95, 1.0) * (crackLine * 0.28 + fineCrack * 0.14);

          // Shimmer across the ice mirror
          col += uSpecCol * (specBroad * 0.62 + specGlint * 0.95);

          // Frosted snow-rime edges + blizzard surface frost glaze
          float totalFrost = clamp(frostEdge * 0.86 + uFrostCover * (0.45 + 0.55 * w1), 0.0, 0.94);
          col = mix(col, mix(vec3(0.90, 0.96, 1.0) * uFrostTint, uFogColor, 0.25), totalFrost);

          // Linear scene fog match
          float camDist = length(cameraPosition - vWorldPos);
          float fogFactor = smoothstep(uFogNear, uFogFar, camDist);
          col = mix(col, uFogColor, fogFactor);

          float alpha = smoothstep(0.01, 0.07, bankDist) * 0.92;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );

  const streamMesh = new THREE.Mesh(streamGeo, iceStreamMat);
  streamMesh.name = 'frozen_crystal_stream';
  streamMesh.renderOrder = 1;
  group.add(streamMesh);

  // Riverbank Snow-Capped Cobbles & Boulders (InstancedMesh)
  const cobbleGeoRaw = new THREE.IcosahedronGeometry(0.45, 1);
  const cp = cobbleGeoRaw.attributes.position;
  const cc = new Float32Array(cp.count * 3);
  const cRock = new THREE.Color(0x7c90a6);
  const cSnowTop = new THREE.Color(0xf4faff);
  const cTmp = new THREE.Color();
  for (let i = 0; i < cp.count; i++) {
    const vx = cp.getX(i);
    const vy = cp.getY(i);
    const vz = cp.getZ(i);
    const k = 0.82 + 0.34 * hash2(vx * 5.2 + vy * 3.1, vz * 6.7);
    cp.setXYZ(i, vx * k * 1.22, vy * k * 0.72, vz * k * 1.05);
    cTmp.copy(cRock).lerp(cSnowTop, smoothstep(0.02, 0.26, vy));
    cc[i * 3] = cTmp.r;
    cc[i * 3 + 1] = cTmp.g;
    cc[i * 3 + 2] = cTmp.b;
  }
  cobbleGeoRaw.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  cobbleGeoRaw.computeVertexNormals();
  const cobbleGeo = trackGeo(cobbleGeoRaw);

  const cobbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: stoneTex.roughnessMap ? 0.88 : 0.74,
      metalness: 0.05,
      ...(stoneTex.map ? { map: stoneTex.map } : {}),
      ...(stoneTex.normalMap ? { normalMap: stoneTex.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) } : {}),
      ...(stoneTex.bumpMap ? { bumpMap: stoneTex.bumpMap, bumpScale: 0.07 } : {}),
    })
  );

  const rngRiver = createRng(40219);
  const cobbleTransforms = [];
  for (let i = 0; i < 56; i++) {
    const x = lerp(-20.5, 20.5, rngRiver());
    const side = rngRiver() > 0.48 ? 1 : -1;
    const scz = getStreamCenterZ(x);
    const shw = getStreamHalfWidth(x);
    const z = scz + side * (shw + 0.08 + rngRiver() * 0.65);
    // Strict safety guard: never approach combat arena z > -4.85
    if (z > -4.85) continue;
    const y = getTerrainHeight(x, z);
    const s = 0.45 + rngRiver() * 1.15;
    cobbleTransforms.push({ x, y: y + s * 0.08, z, sx: s * (0.85 + rngRiver() * 0.5), sy: s * (0.65 + rngRiver() * 0.45), sz: s * (0.85 + rngRiver() * 0.5), ry: rngRiver() * Math.PI * 2 });
  }

  const cobbleInst = new THREE.InstancedMesh(cobbleGeo, cobbleMat, cobbleTransforms.length);
  cobbleInst.castShadow = true;
  cobbleInst.receiveShadow = true;
  for (let i = 0; i < cobbleTransforms.length; i++) {
    const c = cobbleTransforms[i];
    dummy.position.set(c.x, c.y, c.z);
    dummy.rotation.set(0, c.ry, 0);
    dummy.scale.set(c.sx, c.sy, c.sz);
    dummy.updateMatrix();
    cobbleInst.setMatrixAt(i, dummy.matrix);
  }
  cobbleInst.instanceMatrix.needsUpdate = true;
  cobbleInst.frustumCulled = false;
  group.add(cobbleInst);

  // 3 Frost-Rimmed Stepping Stones crossing the frozen stream toward the stone arch
  const stepStoneGeo = trackGeo(new THREE.CylinderGeometry(0.55, 0.64, 0.22, 8));
  const stepXs = [-0.95, 0.15, 1.25];
  for (let i = 0; i < stepXs.length; i++) {
    const sx = stepXs[i];
    const sz = getStreamCenterZ(sx) + (i - 1) * 0.55;
    const stone = new THREE.Mesh(stepStoneGeo, marbleMat);
    stone.position.set(sx, streamY + 0.06, sz);
    stone.rotation.y = i * 0.9 + 0.3;
    stone.scale.set(1.15, 1.0, 0.88);
    stone.receiveShadow = true;
    stone.castShadow = true;
    group.add(stone);
  }

  // Shore Glacial Icicles & Frosted Ice Shards along riverbanks
  const iceTex = resolveTexBundle(THREE, texLib.iceCrystal, 1.5, 2.2, trackedTextures);
  const crystalOuterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbaf2ff,
      emissive: 0x1c8fd4,
      emissiveIntensity: 0.32,
      roughness: iceTex.roughnessMap ? 0.22 : 0.09,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
      ...(iceTex.map ? { map: iceTex.map } : {}),
      ...(iceTex.normalMap ? { normalMap: iceTex.normalMap, normalScale: new THREE.Vector2(0.45, 0.45) } : {}),
      ...(iceTex.bumpMap ? { bumpMap: iceTex.bumpMap, bumpScale: 0.04 } : {}),
      ...(iceTex.roughnessMap ? { roughnessMap: iceTex.roughnessMap } : {}),
    })
  );

  const bankIcicleGeo = trackGeo(createCrystalPrismGeo(THREE, 0.14, 0.62, 11.4));
  const icicleTransforms = [];
  for (let i = 0; i < 34; i++) {
    const x = lerp(-17.5, 17.5, rngRiver());
    const side = rngRiver() > 0.5 ? 1 : -1;
    const scz = getStreamCenterZ(x);
    const shw = getStreamHalfWidth(x);
    const z = scz + side * (shw - 0.05 + rngRiver() * 0.32);
    if (z > -4.95) continue;
    const y = streamY - 0.04;
    const s = 0.55 + rngRiver() * 1.15;
    icicleTransforms.push({
      x,
      y,
      z,
      rx: (rngRiver() - 0.5) * 0.55 - side * 0.35,
      ry: rngRiver() * Math.PI * 2,
      rz: (rngRiver() - 0.5) * 0.55,
      s,
    });
  }
  const bankIcicleInst = new THREE.InstancedMesh(bankIcicleGeo, crystalOuterMat, icicleTransforms.length);
  for (let i = 0; i < icicleTransforms.length; i++) {
    const ic = icicleTransforms[i];
    dummy.position.set(ic.x, ic.y, ic.z);
    dummy.rotation.set(ic.rx, ic.ry, ic.rz);
    dummy.scale.set(ic.s, ic.s * 1.15, ic.s);
    dummy.updateMatrix();
    bankIcicleInst.setMatrixAt(i, dummy.matrix);
  }
  bankIcicleInst.instanceMatrix.needsUpdate = true;
  bankIcicleInst.frustumCulled = false;
  group.add(bankIcicleInst);

  // =========================================================================
  // 4. MULTI-TIERED 3D SNOW-LADEN FIRS & SILVER FROST BIRCHES (InstancedMesh)
  // =========================================================================
  const firAssets = buildSnowFirAssetGeometries(THREE);
  trackGeo(firAssets.trunkGeo);
  trackGeo(firAssets.foliageGeo);
  trackGeo(firAssets.snowGeo);

  const barkTex = resolveTexBundle(THREE, texLib.darkBark, 2, 4, trackedTextures);
  const firTrunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: barkTex.roughnessMap ? 0.94 : 0.88,
      metalness: 0.02,
      ...(barkTex.map ? { map: barkTex.map } : {}),
      ...(barkTex.normalMap ? { normalMap: barkTex.normalMap, normalScale: new THREE.Vector2(0.8, 0.8) } : {}),
      ...(barkTex.bumpMap ? { bumpMap: barkTex.bumpMap, bumpScale: 0.12 } : {}),
      ...(barkTex.roughnessMap ? { roughnessMap: barkTex.roughnessMap } : {}),
    })
  );
  attachWindSway(firTrunkMat, windUniform, windAmpUniform);

  const firFoliageMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.03,
    })
  );
  attachWindSway(firFoliageMat, windUniform, windAmpUniform);

  const firSnowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: snowCapTex.roughnessMap ? 0.78 : 0.48,
      metalness: 0.04,
      ...(snowCapTex.map ? { map: snowCapTex.map } : {}),
      ...(snowCapTex.normalMap ? { normalMap: snowCapTex.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) } : {}),
      ...(snowCapTex.bumpMap ? { bumpMap: snowCapTex.bumpMap, bumpScale: 0.04 } : {}),
      ...(snowCapTex.roughnessMap ? { roughnessMap: snowCapTex.roughnessMap } : {}),
    })
  );
  attachWindSway(firSnowMat, windUniform, windAmpUniform);

  // Curated hero-ring + dense outer forest placement (strictly |x| > 9.4 or z < -8.6; zero camera blocking)
  const firPlacements = [
    // Left inner scenic fringe (framing left clearing edge)
    { x: -10.8, z: 2.8, s: 1.04 },
    { x: -11.4, z: -0.4, s: 1.18 },
    { x: -10.6, z: -4.9, s: 1.12 },
    { x: -12.4, z: -7.8, s: 1.32 },
    { x: -9.8, z: -10.2, s: 1.24 },
    { x: -13.2, z: 5.2, s: 0.96 },
    { x: -14.2, z: 1.2, s: 1.34 },
    { x: -14.8, z: -3.2, s: 1.28 },
    { x: -15.6, z: -7.5, s: 1.44 },
    { x: -13.5, z: -12.4, s: 1.38 },
    // Right inner scenic fringe (leaving morning god-ray gap around x=+8..12, z=-9..-13)
    { x: 11.0, z: 3.1, s: 1.02 },
    { x: 11.8, z: -0.2, s: 1.16 },
    { x: 11.4, z: -4.8, s: 1.08 },
    { x: 13.6, z: -7.6, s: 1.28 },
    { x: 14.0, z: 5.4, s: 0.94 },
    { x: 14.6, z: 1.5, s: 1.30 },
    { x: 15.2, z: -2.8, s: 1.36 },
    { x: 16.4, z: -7.2, s: 1.46 },
    { x: 14.5, z: -13.2, s: 1.34 },
    // Back grove framing the Gothic stone arch (leaving arch aperture x∈[-4.6, 4.6], z∈[-8.5,-13] open)
    { x: -7.8, z: -11.4, s: 1.18 },
    { x: -6.4, z: -13.8, s: 1.36 },
    { x: -9.2, z: -14.6, s: 1.42 },
    { x: 7.4, z: -11.8, s: 1.12 },
    { x: 6.2, z: -14.4, s: 1.32 },
    { x: 10.6, z: -15.4, s: 1.44 },
    { x: -3.6, z: -16.8, s: 1.26 },
    { x: 2.8, z: -17.2, s: 1.34 },
    { x: 0.2, z: -19.5, s: 1.48 },
    { x: -6.8, z: -18.6, s: 1.52 },
    { x: 6.8, z: -18.8, s: 1.48 },
  ];

  // Fill outer deep woods deterministically up to ~56 multi-tiered firs
  const rngTrees = createRng(88317);
  let attempts = 0;
  while (firPlacements.length < 56 && attempts < 500) {
    attempts++;
    const x = lerp(-28.0, 28.0, rngTrees());
    const z = lerp(-26.5, 6.2, rngTrees());

    // Hard exclusion zones: combat flatland + foreground camera view + stream channel + arch aperture + sunbeam corridor
    if (Math.abs(x) < 10.2 && z > -10.8) continue;
    if (Math.abs(x) < 11.2 && z > 3.2) continue;
    if (Math.abs(x) < 5.0 && z > -15.6) continue;
    if (x > 6.5 && x < 12.2 && z > -13.5 && z < -7.5) continue; // Morning sunbeam clearing gap
    const scz = getStreamCenterZ(x);
    if (Math.abs(z - scz) < getStreamHalfWidth(x) + 1.35) continue;

    // Minimum spacing between trees so silhouettes stay layered and crisp
    let tooClose = false;
    for (let k = 0; k < firPlacements.length; k++) {
      const p = firPlacements[k];
      if (Math.hypot(x - p.x, z - p.z) < 2.85) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const distOut = Math.hypot(x * 0.6, Math.min(0, z + 4));
    const scale = 0.88 + rngTrees() * 0.56 + smoothstep(10, 26, distOut) * 0.32;
    firPlacements.push({ x, z, s: scale });
  }

  const firCount = firPlacements.length;
  const firTrunkInst = new THREE.InstancedMesh(firAssets.trunkGeo, firTrunkMat, firCount);
  const firFoliageInst = new THREE.InstancedMesh(firAssets.foliageGeo, firFoliageMat, firCount);
  const firSnowInst = new THREE.InstancedMesh(firAssets.snowGeo, firSnowMat, firCount);

  firTrunkInst.castShadow = true;
  firTrunkInst.receiveShadow = true;
  firFoliageInst.castShadow = true;
  firFoliageInst.receiveShadow = true;
  firSnowInst.castShadow = true;
  firSnowInst.receiveShadow = true;

  for (let i = 0; i < firCount; i++) {
    const p = firPlacements[i];
    const y = getTerrainHeight(p.x, p.z) - 0.14;
    const rotY = hash2(p.x * 1.7, p.z * 2.3) * Math.PI * 2;
    const tiltX = (hash2(p.x * 3.1, p.z * 0.7) - 0.5) * 0.055;
    const tiltZ = (hash2(p.z * 2.9, p.x * 1.1) - 0.5) * 0.055;
    const sy = p.s * (0.94 + hash2(p.x, p.z) * 0.18);
    const sxz = p.s * (0.92 + hash2(p.z, p.x) * 0.16);

    dummy.position.set(p.x, y, p.z);
    dummy.rotation.set(tiltX, rotY, tiltZ);
    dummy.scale.set(sxz, sy, sxz);
    dummy.updateMatrix();

    firTrunkInst.setMatrixAt(i, dummy.matrix);
    firFoliageInst.setMatrixAt(i, dummy.matrix);
    firSnowInst.setMatrixAt(i, dummy.matrix);
  }
  firTrunkInst.instanceMatrix.needsUpdate = true;
  firFoliageInst.instanceMatrix.needsUpdate = true;
  firSnowInst.instanceMatrix.needsUpdate = true;
  firTrunkInst.frustumCulled = false;
  firFoliageInst.frustumCulled = false;
  firSnowInst.frustumCulled = false;
  group.add(firTrunkInst, firFoliageInst, firSnowInst);

  // Silver Frost Birches (14 sunlit edge trees adding pale gold-white seasonal contrast)
  const birchAssets = buildSilverBirchGeometries(THREE);
  trackGeo(birchAssets.trunkGeo);
  trackGeo(birchAssets.canopyGeo);

  const birchTrunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: barkTex.roughnessMap ? 0.85 : 0.74,
      metalness: 0.03,
      ...(barkTex.bumpMap ? { bumpMap: barkTex.bumpMap, bumpScale: 0.05 } : {}),
    })
  );
  attachWindSway(birchTrunkMat, windUniform, windAmpUniform);

  const birchCanopyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.58,
      metalness: 0.04,
      flatShading: true,
    })
  );
  attachWindSway(birchCanopyMat, windUniform, windAmpUniform);

  const birchCoords = [
    { x: -10.1, z: 0.9, s: 0.96 },
    { x: -12.6, z: -2.4, s: 1.08 },
    { x: -10.4, z: -7.2, s: 1.02 },
    { x: -8.6, z: -12.6, s: 1.12 },
    { x: -15.8, z: -10.4, s: 1.18 },
    { x: -12.2, z: 4.1, s: 0.92 },
    { x: 10.2, z: 1.2, s: 0.98 },
    { x: 12.8, z: -2.2, s: 1.10 },
    { x: 10.2, z: -6.4, s: 0.96 },
    { x: 8.8, z: -12.9, s: 1.14 },
    { x: 15.6, z: -10.2, s: 1.20 },
    { x: 12.6, z: 4.3, s: 0.90 },
    { x: -4.8, z: -14.8, s: 1.06 },
    { x: 4.9, z: -15.2, s: 1.08 },
  ];

  const birchTrunkInst = new THREE.InstancedMesh(birchAssets.trunkGeo, birchTrunkMat, birchCoords.length);
  const birchCanopyInst = new THREE.InstancedMesh(birchAssets.canopyGeo, birchCanopyMat, birchCoords.length);
  birchTrunkInst.castShadow = true;
  birchTrunkInst.receiveShadow = true;
  birchCanopyInst.castShadow = true;
  birchCanopyInst.receiveShadow = true;

  for (let i = 0; i < birchCoords.length; i++) {
    const b = birchCoords[i];
    const y = getTerrainHeight(b.x, b.z) - 0.1;
    dummy.position.set(b.x, y, b.z);
    dummy.rotation.set(0, i * 1.37 + 0.5, (hash2(b.x, b.z) - 0.5) * 0.06);
    dummy.scale.set(b.s, b.s * (0.95 + hash2(i, b.x) * 0.18), b.s);
    dummy.updateMatrix();
    birchTrunkInst.setMatrixAt(i, dummy.matrix);
    birchCanopyInst.setMatrixAt(i, dummy.matrix);
  }
  birchTrunkInst.instanceMatrix.needsUpdate = true;
  birchCanopyInst.instanceMatrix.needsUpdate = true;
  birchTrunkInst.frustumCulled = false;
  birchCanopyInst.frustumCulled = false;
  group.add(birchTrunkInst, birchCanopyInst);

  // =========================================================================
  // 5. HERO LANDMARKS: 7 GIANT GLOWING HEXAGONAL ICE CRYSTAL CLUSTERS
  // =========================================================================
  const animatedCrystalCores = [];
  const animatedCrystalLights = [];
  const animatedGlowDiscs = [];

  // Pre-build 3 varied hexagonal prism geometries for visual diversity
  const shardGeos = [
    trackGeo(createCrystalPrismGeo(THREE, 0.42, 2.75, 1.3)),
    trackGeo(createCrystalPrismGeo(THREE, 0.34, 2.15, 4.7)),
    trackGeo(createCrystalPrismGeo(THREE, 0.28, 1.65, 8.9)),
  ];

  const crystalClusterSpecs = [
    { x: -10.3, z: -3.1, scale: 1.18, light: true, lightInt: 7.5, lightDist: 11.5, phase: 0.0, leanX: 0.18, leanZ: 0.08 },
    { x: 10.4, z: -2.6, scale: 1.12, light: true, lightInt: 7.2, lightDist: 11.5, phase: 1.4, leanX: -0.18, leanZ: 0.06 },
    { x: -6.9, z: -8.9, scale: 1.42, light: true, lightInt: 9.0, lightDist: 13.0, phase: 2.5, leanX: 0.14, leanZ: 0.14 },
    { x: 7.3, z: -7.9, scale: 1.30, light: false, phase: 3.7, leanX: -0.16, leanZ: 0.12 },
    { x: -5.6, z: -11.4, scale: 1.24, light: false, phase: 4.8, leanX: 0.10, leanZ: 0.08 },
    { x: 5.7, z: -10.9, scale: 1.18, light: false, phase: 5.6, leanX: -0.12, leanZ: 0.10 },
    { x: -1.4, z: -15.1, scale: 1.78, light: false, phase: 0.8, leanX: 0.06, leanZ: 0.08 },
  ];

  const snowCollarGeo = trackGeo(new THREE.CylinderGeometry(0.75, 1.38, 0.36, 9));

  for (let cIdx = 0; cIdx < crystalClusterSpecs.length; cIdx++) {
    const spec = crystalClusterSpecs[cIdx];
    const clusterGroup = new THREE.Group();
    const baseY = getTerrainHeight(spec.x, spec.z);
    clusterGroup.position.set(spec.x, baseY - 0.14, spec.z);
    clusterGroup.name = `hero_crystal_cluster_${cIdx}`;

    // Dedicated glowing inner core material per cluster so pulses breathe asynchronously
    const coreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x9ef6ff,
        emissive: 0x6be8ff,
        emissiveIntensity: 1.35,
        roughness: 0.18,
        metalness: 0.05,
        flatShading: true,
      })
    );
    animatedCrystalCores.push({ mat: coreMat, baseInt: 1.35, phase: spec.phase });

    // Snowy embedded crystal collar at base
    const collar = new THREE.Mesh(snowCollarGeo, snowPillowMat);
    collar.scale.set(spec.scale * 0.9, spec.scale * 0.75, spec.scale * 0.9);
    collar.position.y = 0.12;
    collar.receiveShadow = true;
    clusterGroup.add(collar);

    // Build 1 tall hero spire + 5 slanted companion crystal prongs per cluster
    const prongConfigs = [
      { ox: 0.0, oz: 0.0, sx: 1.05, sy: 1.12, rx: spec.leanZ, rz: -spec.leanX, ry: 0.2 + cIdx, geoIdx: 0 },
      { ox: 0.42, oz: 0.25, sx: 0.74, sy: 0.78, rx: 0.28, rz: -0.34, ry: 1.1 + cIdx, geoIdx: 1 },
      { ox: -0.44, oz: 0.22, sx: 0.70, sy: 0.72, rx: 0.26, rz: 0.38, ry: 2.3 + cIdx, geoIdx: 1 },
      { ox: 0.18, oz: -0.42, sx: 0.78, sy: 0.86, rx: -0.32, rz: -0.18, ry: 3.5 + cIdx, geoIdx: 0 },
      { ox: -0.32, oz: -0.35, sx: 0.62, sy: 0.62, rx: -0.26, rz: 0.34, ry: 4.6 + cIdx, geoIdx: 2 },
      { ox: 0.04, oz: 0.46, sx: 0.56, sy: 0.52, rx: 0.44, rz: 0.06, ry: 5.4 + cIdx, geoIdx: 2 },
    ];

    for (let p = 0; p < prongConfigs.length; p++) {
      const pr = prongConfigs[p];
      const geo = shardGeos[pr.geoIdx];

      // Outer glossy refractive crystal shell
      const outer = new THREE.Mesh(geo, crystalOuterMat);
      outer.position.set(pr.ox * spec.scale, 0, pr.oz * spec.scale);
      outer.rotation.set(pr.rx, pr.ry, pr.rz);
      outer.scale.set(pr.sx * spec.scale, pr.sy * spec.scale, pr.sx * spec.scale);
      outer.castShadow = true;
      outer.receiveShadow = true;
      clusterGroup.add(outer);

      // Inner luminous #6be8ff energy core (scaled inward inside outer shell)
      const inner = new THREE.Mesh(geo, coreMat);
      inner.position.copy(outer.position);
      inner.rotation.copy(outer.rotation);
      inner.scale.set(
        pr.sx * spec.scale * 0.62,
        pr.sy * spec.scale * 0.86,
        pr.sx * spec.scale * 0.62
      );
      clusterGroup.add(inner);
    }

    // Soft glowing frost aura decal hugging snow ground around cluster base
    if (glowDiscTex) {
      const auraGeo = trackGeo(new THREE.PlaneGeometry(3.8 * spec.scale, 3.8 * spec.scale));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = trackMat(
        new THREE.MeshBasicMaterial({
          map: glowDiscTex,
          color: 0x74eeff,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.position.y = 0.22;
      clusterGroup.add(aura);
      animatedGlowDiscs.push({ mat: auraMat, baseOp: 0.34, phase: spec.phase });
    }

    // Local ice-blue PointLight on key hero clusters
    if (spec.light) {
      const pt = new THREE.PointLight(0x6be8ff, spec.lightInt, spec.lightDist, 1.6);
      pt.position.set(0, 1.85 * spec.scale, 0.35);
      clusterGroup.add(pt);
      animatedCrystalLights.push({ light: pt, baseInt: spec.lightInt, phase: spec.phase });
    }

    group.add(clusterGroup);
  }

  // =========================================================================
  // 6. ANCIENT HALF-BURIED GOTHIC STONE ARCH RUINS (z = -10.5) & STANDING STONES
  // =========================================================================
  const ruinsGroup = new THREE.Group();
  ruinsGroup.name = 'ancient_gothic_arch_ruins';
  const archBaseY = getTerrainHeight(0, -10.5);
  ruinsGroup.position.set(0, archBaseY - 0.12, -10.5);

  const runeGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbcf8ff,
      emissive: 0x6be8ff,
      emissiveIntensity: 1.55,
      roughness: 0.2,
      metalness: 0.1,
    })
  );
  animatedCrystalCores.push({ mat: runeGlowMat, baseInt: 1.55, phase: 2.1 });

  // Stepped gothic piers at x = -2.65 and x = +2.65
  const pierX = [-2.65, 2.65];
  const plinthGeo = trackGeo(new THREE.BoxGeometry(1.78, 0.72, 1.62));
  const subPlinthGeo = trackGeo(new THREE.BoxGeometry(1.48, 0.44, 1.38));
  const shaftGeo = trackGeo(new THREE.BoxGeometry(1.18, 3.35, 1.18));
  const pilasterGeo = trackGeo(new THREE.BoxGeometry(0.24, 3.32, 0.24));
  const capitalGeo = trackGeo(new THREE.BoxGeometry(1.56, 0.36, 1.48));
  const runeStripGeo = trackGeo(new THREE.BoxGeometry(0.11, 2.35, 0.06));
  const snowBlanketGeo = trackGeo(new THREE.BoxGeometry(1.42, 0.18, 1.32));

  for (let p = 0; p < 2; p++) {
    const px = pierX[p];
    const pier = new THREE.Group();
    pier.position.set(px, 0, 0);

    const plinth = new THREE.Mesh(plinthGeo, stoneMat);
    plinth.position.y = 0.28;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    pier.add(plinth);

    const subPlinth = new THREE.Mesh(subPlinthGeo, marbleMat);
    subPlinth.position.y = 0.80;
    subPlinth.castShadow = true;
    subPlinth.receiveShadow = true;
    pier.add(subPlinth);

    const shaft = new THREE.Mesh(shaftGeo, stoneMat);
    shaft.position.y = 2.62;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    pier.add(shaft);

    // 4 Corner gothic pilasters for architectural relief
    const corners = [
      [-0.54, -0.54],
      [0.54, -0.54],
      [-0.54, 0.54],
      [0.54, 0.54],
    ];
    for (const [cx, cz] of corners) {
      const pil = new THREE.Mesh(pilasterGeo, marbleMat);
      pil.position.set(cx, 2.62, cz);
      pil.castShadow = true;
      pier.add(pil);
    }

    const cap = new THREE.Mesh(capitalGeo, marbleMat);
    cap.position.y = 4.42;
    cap.castShadow = true;
    cap.receiveShadow = true;
    pier.add(cap);

    // Snow cushion resting on pier capital overhang
    const capSnow = new THREE.Mesh(snowBlanketGeo, snowPillowMat);
    capSnow.position.y = 4.63;
    capSnow.scale.set(1.06, 0.9, 1.06);
    pier.add(capSnow);

    // Glowing vertical frost-rune channel on front face
    const rune = new THREE.Mesh(runeStripGeo, runeGlowMat);
    rune.position.set(p === 0 ? 0.24 : -0.24, 2.62, 0.60);
    pier.add(rune);

    // Flanking low crumbling wing wall half-buried in snow
    const wingGeo = trackGeo(new THREE.BoxGeometry(1.65, 1.25 - p * 0.18, 0.68));
    const wing = new THREE.Mesh(wingGeo, stoneMat);
    wing.position.set(p === 0 ? -1.45 : 1.45, 0.52, -0.15);
    wing.rotation.z = p === 0 ? 0.05 : -0.08;
    wing.castShadow = true;
    wing.receiveShadow = true;
    pier.add(wing);

    const wingSnow = new THREE.Mesh(snowBlanketGeo, snowPillowMat);
    wingSnow.position.set(p === 0 ? -1.45 : 1.45, 1.18 - p * 0.18, -0.15);
    wingSnow.scale.set(1.12, 0.85, 0.56);
    wingSnow.rotation.z = wing.rotation.z;
    pier.add(wingSnow);

    ruinsGroup.add(pier);
  }

  // Pointed Gothic Lancet Arch Voussoirs (left full curve past keystone; right fractured open!)
  const voussoirGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.56, 1.06));
  const voussoirSnowGeo = trackGeo(new THREE.BoxGeometry(0.66, 0.16, 0.98));
  const archSpringY = 4.54;
  const archR = 3.22;
  const leftCenterX = 0.57;
  const rightCenterX = -0.57;

  // Left intact Gothic curve sweeping up to and just past the pointed keystone
  const leftSteps = 10;
  for (let i = 0; i <= leftSteps; i++) {
    const t = i / leftSteps;
    const angle = lerp(Math.PI, Math.PI * 0.5 + 0.175, t);
    const vx = leftCenterX + Math.cos(angle) * archR;
    const vy = archSpringY + Math.sin(angle) * archR;
    const matUse = i % 2 === 0 ? stoneMat : marbleMat;
    const block = new THREE.Mesh(voussoirGeo, matUse);
    block.position.set(vx, vy, 0);
    block.rotation.z = angle - Math.PI * 0.5;
    block.scale.set(1.0, 1.0 + (i === leftSteps ? 0.25 : 0), 1.0);
    block.castShadow = true;
    block.receiveShadow = true;
    ruinsGroup.add(block);

    // Snow draped cleanly over upper extrados of the arch
    if (i >= 2) {
      const snow = new THREE.Mesh(voussoirSnowGeo, snowPillowMat);
      snow.position.set(vx + Math.cos(angle) * 0.34, vy + Math.sin(angle) * 0.34, 0);
      snow.rotation.z = angle - Math.PI * 0.5;
      ruinsGroup.add(snow);
    }
  }

  // Right broken Gothic stub (first 5 stones, fractured cleanly open for sunlight!)
  const rightSteps = 5;
  for (let i = 0; i <= rightSteps; i++) {
    const t = i / 10;
    const angle = lerp(0, Math.PI * 0.5 - 0.175, t);
    const vx = rightCenterX + Math.cos(angle) * archR;
    const vy = archSpringY + Math.sin(angle) * archR;
    const matUse = i % 2 === 0 ? stoneMat : marbleMat;
    const block = new THREE.Mesh(voussoirGeo, matUse);
    block.position.set(vx, vy, 0);
    block.rotation.z = angle - Math.PI * 0.5;
    if (i === rightSteps) block.scale.set(0.75, 0.85, 0.92);
    block.castShadow = true;
    block.receiveShadow = true;
    ruinsGroup.add(block);

    if (i >= 2) {
      const snow = new THREE.Mesh(voussoirSnowGeo, snowPillowMat);
      snow.position.set(vx + Math.cos(angle) * 0.32, vy + Math.sin(angle) * 0.32, 0);
      snow.rotation.z = angle - Math.PI * 0.5;
      ruinsGroup.add(snow);
    }
  }

  // Fallen fractured arch stones half-buried in snow below right break
  const fallenBlocks = [
    { x: 2.85, y: 0.12, z: 0.95, rx: 0.24, ry: 0.65, rz: 0.42, s: 1.0 },
    { x: 3.72, y: 0.04, z: 0.42, rx: -0.18, ry: 1.35, rz: -0.3, s: 0.82 },
    { x: -3.65, y: 0.06, z: 0.82, rx: 0.15, ry: -0.8, rz: 0.22, s: 0.86 },
  ];
  for (const fb of fallenBlocks) {
    const m = new THREE.Mesh(voussoirGeo, stoneMat);
    m.position.set(fb.x, fb.y, fb.z);
    m.rotation.set(fb.rx, fb.ry, fb.rz);
    m.scale.setScalar(fb.s);
    m.castShadow = true;
    m.receiveShadow = true;
    ruinsGroup.add(m);
  }

  // Soft arcane ice PointLight centered beneath the Gothic arch
  const archLight = new THREE.PointLight(0x88f2ff, 8.2, 13.5, 1.6);
  archLight.position.set(0, 2.5, 0.4);
  ruinsGroup.add(archLight);
  animatedCrystalLights.push({ light: archLight, baseInt: 8.2, phase: 2.1 });

  group.add(ruinsGroup);

  // 4 Carved Runic Standing Stones (Menhirs) flanking the ruin perimeter
  const menhirGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.46, 2.45, 6));
  const menhirRuneGeo = trackGeo(new THREE.BoxGeometry(0.09, 1.45, 0.06));
  const menhirDiamondGeo = trackGeo(new THREE.OctahedronGeometry(0.14, 0));
  const menhirSpecs = [
    { x: -6.3, z: -9.8, ry: 0.35, tilt: 0.08, s: 1.05 },
    { x: -4.1, z: -11.4, ry: 0.18, tilt: -0.06, s: 0.92 },
    { x: 4.2, z: -11.2, ry: -0.22, tilt: 0.07, s: 0.96 },
    { x: 6.5, z: -9.5, ry: -0.38, tilt: -0.09, s: 1.08 },
  ];
  for (const ms of menhirSpecs) {
    const mg = new THREE.Group();
    const my = getTerrainHeight(ms.x, ms.z);
    mg.position.set(ms.x, my - 0.15, ms.z);
    mg.rotation.set(0, ms.ry, ms.tilt);
    mg.scale.setScalar(ms.s);

    const body = new THREE.Mesh(menhirGeo, stoneMat);
    body.position.y = 1.22;
    body.scale.set(1.0, 1.0, 0.62);
    body.castShadow = true;
    body.receiveShadow = true;
    mg.add(body);

    const runeBar = new THREE.Mesh(menhirRuneGeo, runeGlowMat);
    runeBar.position.set(0, 1.26, 0.24);
    mg.add(runeBar);

    const runeSigil = new THREE.Mesh(menhirDiamondGeo, runeGlowMat);
    runeSigil.position.set(0, 2.02, 0.24);
    runeSigil.scale.set(0.85, 1.25, 0.4);
    mg.add(runeSigil);

    const snowTop = new THREE.Mesh(snowCollarGeo, snowPillowMat);
    snowTop.position.set(0, 2.45, 0);
    snowTop.scale.set(0.32, 0.35, 0.22);
    mg.add(snowTop);

    group.add(mg);
  }

  // =========================================================================
  // 7. FLOATING LUMINOUS CRYSTAL STREETLAMPS (4 Arcane Waystones)
  // =========================================================================
  const floatingLanterns = [];
  const lanternPedGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.30, 1.05, 6));
  const lanternCapGeo = trackGeo(new THREE.CylinderGeometry(0.30, 0.20, 0.16, 6));
  const lanternCoreGeo = trackGeo(new THREE.OctahedronGeometry(0.24, 0));
  const lanternRingGeo = trackGeo(new THREE.TorusGeometry(0.36, 0.026, 8, 24));
  const lanternProngGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.28, 0.05));

  const silverMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdce7f5,
      roughness: 0.28,
      metalness: 0.78,
    })
  );
  const champagneGoldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4dca8,
      emissive: 0x6b5220,
      emissiveIntensity: 0.25,
      roughness: 0.24,
      metalness: 0.85,
    })
  );
  const lanternCrystalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8fbff,
      emissive: 0x84f2ff,
      emissiveIntensity: 1.85,
      roughness: 0.12,
      metalness: 0.08,
      flatShading: true,
    })
  );

  // Strictly outside combat flatland (all z <= -5.5), on dry snowbanks/terrace and clear of actor head projection lines
  const lanternCoords = [
    { x: -8.25, z: -5.50, phase: 0.0 },
    { x: 8.75, z: -8.35, phase: 1.55 },
    { x: -1.65, z: -9.65, phase: 3.1 },
    { x: 1.75, z: -9.55, phase: 4.65 },
  ];

  for (let i = 0; i < lanternCoords.length; i++) {
    const lc = lanternCoords[i];
    const lg = new THREE.Group();
    const ly = getTerrainHeight(lc.x, lc.z);
    lg.position.set(lc.x, ly - 0.08, lc.z);

    const ped = new THREE.Mesh(lanternPedGeo, stoneMat);
    ped.position.y = 0.52;
    ped.castShadow = true;
    ped.receiveShadow = true;
    lg.add(ped);

    const cap = new THREE.Mesh(lanternCapGeo, silverMetalMat);
    cap.position.y = 1.10;
    lg.add(cap);

    // 4 delicate filigree silver cradle prongs
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
      const prong = new THREE.Mesh(lanternProngGeo, silverMetalMat);
      prong.position.set(Math.cos(ang) * 0.24, 1.28, Math.sin(ang) * 0.24);
      prong.rotation.z = -Math.cos(ang) * 0.28;
      prong.rotation.x = Math.sin(ang) * 0.28;
      lg.add(prong);
    }

    // Levitating crystal + tilted gold arcane gyroscope ring
    const floatNode = new THREE.Group();
    const baseFloatY = 1.72;
    floatNode.position.y = baseFloatY;

    const crystal = new THREE.Mesh(lanternCoreGeo, lanternCrystalMat);
    crystal.scale.set(0.85, 1.48, 0.85);
    floatNode.add(crystal);

    const ring = new THREE.Mesh(lanternRingGeo, champagneGoldMat);
    ring.rotation.x = 0.65;
    floatNode.add(ring);

    if (glowDiscTex) {
      const spriteMat = trackMat(
        new THREE.SpriteMaterial({
          map: glowDiscTex,
          color: 0x9ef6ff,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const glowSprite = new THREE.Sprite(spriteMat);
      glowSprite.scale.set(1.65, 1.65, 1);
      floatNode.add(glowSprite);
    }

    lg.add(floatNode);
    group.add(lg);
    floatingLanterns.push({ floatNode, crystal, ring, baseFloatY, phase: lc.phase });
  }

  // =========================================================================
  // 8. DISTANT GLACIAL MOUNTAIN RIDGES (2-Layer Panoramic Horizon)
  // =========================================================================
  const mountainParts = [];
  const mountainSpecs = [
    // Mid-far scenic peaks
    { x: -34, z: -28, r: 10.5, h: 15.5, rot: 0.4, far: false },
    { x: -20, z: -31, r: 11.8, h: 18.2, rot: 1.2, far: false },
    { x: -6, z: -33, r: 12.2, h: 16.5, rot: 2.1, far: false },
    { x: 9, z: -32, r: 11.4, h: 17.8, rot: 0.8, far: false },
    { x: 24, z: -30, r: 12.0, h: 16.8, rot: 1.9, far: false },
    { x: 37, z: -26, r: 10.2, h: 14.2, rot: 0.5, far: false },
    // Far grand glacial cathedral spires
    { x: -42, z: -38, r: 14.5, h: 24.0, rot: 0.9, far: true },
    { x: -27, z: -41, r: 15.0, h: 27.5, rot: 1.7, far: true },
    { x: -12, z: -42, r: 14.8, h: 25.0, rot: 2.8, far: true },
    { x: 3, z: -43, r: 16.0, h: 28.8, rot: 0.3, far: true },
    { x: 18, z: -41, r: 15.2, h: 26.2, rot: 1.4, far: true },
    { x: 34, z: -39, r: 14.0, h: 23.5, rot: 2.4, far: true },
    { x: 46, z: -33, r: 13.0, h: 20.0, rot: 0.7, far: true },
  ];

  const cPeakLit = new THREE.Color(0xf8fbff);
  const cPeakGold = new THREE.Color(0xfff5e2);
  const cPeakShadow = new THREE.Color(0x88b6e0);
  const cPeakBase = new THREE.Color(0x9dc6e8);

  for (let m = 0; m < mountainSpecs.length; m++) {
    const ms = mountainSpecs[m];
    const cone = new THREE.ConeGeometry(ms.r, ms.h, 7, 3);
    const mp = cone.attributes.position;
    const mc = new Float32Array(mp.count * 3);
    const colM = new THREE.Color();

    for (let i = 0; i < mp.count; i++) {
      let vx = mp.getX(i);
      const vy = mp.getY(i);
      let vz = mp.getZ(i);
      const hNorm = clamp((vy + ms.h * 0.5) / ms.h, 0, 1);

      // Sculpt craggy alpine ridges (less jitter near apex so peak stays sharp)
      const crag = 0.80 + 0.42 * hash2(vx * 0.45 + m * 3.7, vz * 0.45 - vy * 0.25);
      vx *= lerp(crag, 1.0, hNorm * 0.85);
      vz *= lerp(crag, 1.0, hNorm * 0.85);
      mp.setXYZ(i, vx, vy, vz);

      // Sunlit east-facing snow slopes vs sapphire glacial shaded faces
      const sunFace = smoothstep(-ms.r * 0.45, ms.r * 0.45, vx);
      colM.copy(cPeakShadow).lerp(cPeakLit, sunFace * 0.72 + hNorm * 0.45);
      if (sunFace > 0.55 && hNorm > 0.5) colM.lerp(cPeakGold, 0.32);
      colM.lerp(cPeakBase, (1.0 - smoothstep(0.0, 0.45, hNorm)) * 0.65);
      if (ms.far) colM.lerp(fogColorVec, 0.28);

      mc[i * 3] = colM.r;
      mc[i * 3 + 1] = colM.g;
      mc[i * 3 + 2] = colM.b;
    }
    cone.setAttribute('color', new THREE.BufferAttribute(mc, 3));
    cone.rotateY(ms.rot);
    cone.translate(ms.x, ms.h * 0.5 - 2.2, ms.z);
    const flatCone = cone.toNonIndexed();
    cone.dispose();
    flatCone.computeVertexNormals();
    mountainParts.push(flatCone);
  }

  const mountainGeo = trackGeo(mergeGeometries(THREE, mountainParts));
  const mountainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.04,
      flatShading: true,
    })
  );
  const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
  mountainMesh.name = 'distant_glacial_mountains';
  group.add(mountainMesh);

  // =========================================================================
  // 9. FOREGROUND TILT-SHIFT CORNER PROPS (Low Snow Stumps & Miniature Crystals)
  //    Strictly outer bottom corners |x| >= 8.9, z >= 5.0, height <= 1.1m
  // =========================================================================
  const stumpGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.58, 0.68, 9));
  const stumpRingGeo = trackGeo(new THREE.CylinderGeometry(0.41, 0.41, 0.04, 9));
  const stumpSnowGeo = trackGeo(new THREE.SphereGeometry(0.46, 9, 6));
  stumpSnowGeo.scale(1.06, 0.36, 1.04);

  const barkSolidMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b5040,
      roughness: barkTex.roughnessMap ? 0.92 : 0.86,
      metalness: 0.02,
      ...(barkTex.map ? { map: barkTex.map } : {}),
      ...(barkTex.bumpMap ? { bumpMap: barkTex.bumpMap, bumpScale: 0.1 } : {}),
    })
  );
  const cutWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9c2a3,
      roughness: 0.82,
      metalness: 0.02,
    })
  );

  const fgStumps = [
    { x: -9.6, z: 5.4, s: 1.0, ry: 0.4 },
    { x: 9.7, z: 5.5, s: 0.95, ry: -0.7 },
  ];
  for (const fs of fgStumps) {
    const sg = new THREE.Group();
    const sy = getTerrainHeight(fs.x, fs.z);
    sg.position.set(fs.x, sy - 0.05, fs.z);
    sg.rotation.y = fs.ry;
    sg.scale.setScalar(fs.s);

    const body = new THREE.Mesh(stumpGeo, barkSolidMat);
    body.position.y = 0.32;
    body.castShadow = true;
    body.receiveShadow = true;
    sg.add(body);

    const topRing = new THREE.Mesh(stumpRingGeo, cutWoodMat);
    topRing.position.y = 0.66;
    sg.add(topRing);

    const snowHat = new THREE.Mesh(stumpSnowGeo, snowPillowMat);
    snowHat.position.set(-0.06, 0.72, -0.05);
    snowHat.receiveShadow = true;
    sg.add(snowHat);

    group.add(sg);
  }

  // Low foreground corner miniature ice crystal tufts for tilt-shift depth
  const fgCrystals = [
    { x: -10.8, z: 6.2, s: 0.42 },
    { x: -9.0, z: 6.5, s: 0.34 },
    { x: 10.7, z: 6.1, s: 0.40 },
    { x: 9.1, z: 6.6, s: 0.32 },
  ];
  for (let i = 0; i < fgCrystals.length; i++) {
    const fc = fgCrystals[i];
    const fgGroup = new THREE.Group();
    fgGroup.position.set(fc.x, getTerrainHeight(fc.x, fc.z) - 0.06, fc.z);
    for (let k = 0; k < 3; k++) {
      const shard = new THREE.Mesh(shardGeos[k % 3], crystalOuterMat);
      const ang = (k / 3) * Math.PI * 2 + i;
      shard.position.set(Math.cos(ang) * 0.16, 0, Math.sin(ang) * 0.16);
      shard.rotation.set(Math.sin(ang) * 0.32, ang, -Math.cos(ang) * 0.32);
      const sc = fc.s * (k === 0 ? 1.0 : 0.72);
      shard.scale.set(sc, sc * 0.92, sc);
      fgGroup.add(shard);
    }
    group.add(fgGroup);
  }

  // =========================================================================
  // 10. SUBTLE IN-SCENE CANOPY MORNING SUNBEAM SHAFTS & AMBIENT FROST MOTES
  // =========================================================================
  const sunbeamUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xfff4d8) },
    uOpacityScale: { value: 1.0 },
  };
  const sunbeamMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: sunbeamUniforms,
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
          float horiz = sin(vUv.x * 3.14159265);
          horiz = pow(max(horiz, 0.0), 2.2);
          float vert = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
          float shimmer = 0.82 + 0.18 * sin(uTime * 0.75 + vUv.x * 6.0);
          float alpha = horiz * vert * shimmer * 0.085 * uOpacityScale;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })
  );

  const beamGeo = trackGeo(new THREE.PlaneGeometry(3.4, 15.5));
  const beamPositions = [
    { x: 6.5, y: 6.6, z: -8.2, ry: -0.22, rz: 0.46, sx: 1.05 },
    { x: 3.4, y: 6.9, z: -9.8, ry: -0.15, rz: 0.46, sx: 1.25 },
    { x: 9.2, y: 6.4, z: -6.4, ry: -0.28, rz: 0.45, sx: 0.90 },
    { x: -1.8, y: 7.1, z: -11.6, ry: -0.12, rz: 0.46, sx: 1.10 },
  ];
  for (const bp of beamPositions) {
    const beam = new THREE.Mesh(beamGeo, sunbeamMat);
    beam.position.set(bp.x, bp.y, bp.z);
    beam.rotation.set(0.18, bp.ry, bp.rz);
    beam.scale.set(bp.sx, 1, 1);
    beam.renderOrder = 3;
    group.add(beam);
  }

  // Ambient rising frost-crystal glints hovering near stream & ruins
  const moteCount = 44;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount * 3);
  const rngMotes = createRng(99103);
  for (let i = 0; i < moteCount; i++) {
    const mx = lerp(-11.5, 11.5, rngMotes());
    const mz = lerp(-12.5, -4.6, rngMotes());
    const my = 0.4 + rngMotes() * 3.8;
    motePos[i * 3] = mx;
    motePos[i * 3 + 1] = my;
    motePos[i * 3 + 2] = mz;
    moteSeeds[i * 3] = mx;
    moteSeeds[i * 3 + 1] = my;
    moteSeeds[i * 3 + 2] = rngMotes() * Math.PI * 2;
  }
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xcdf7ff,
      size: 0.24,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...(glowDiscTex ? { map: glowDiscTex } : {}),
    })
  );
  const motePoints = new THREE.Points(moteGeo, moteMat);
  motePoints.name = 'forest_crystal_motes';
  motePoints.renderOrder = 4;
  group.add(motePoints);

  // =========================================================================
  // 11. LIGHTING RIG (Warm Morning Oblique Key + Cool Ice Sky Fill)
  // =========================================================================
  // Cool sky + luminous snowy ground bounce (keeps shadows bright glacial blue, never muddy)
  const hemiLight = new THREE.HemisphereLight(0xdaf1ff, 0x9dc4e8, 1.25);
  group.add(hemiLight);

  // Warm slanted morning sun penetrating the forest clearing (2048 shadow map)
  const sunLight = new THREE.DirectionalLight(0xfff0d4, 2.45);
  sunLight.position.set(14.5, 22.0, -9.5);
  sunLight.target.position.set(0, 0, -1.5);
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

  // Subtle warm front-left snow-bounce fill so front facets of ruins/trees glow gently
  const bounceFill = new THREE.DirectionalLight(0xffe9cc, 0.68);
  bounceFill.position.set(-10.0, 9.5, 14.0);
  bounceFill.target.position.set(0, 1.0, -4.0);
  bounceFill.castShadow = false;
  group.add(bounceFill);
  group.add(bounceFill.target);

  // =========================================================================
  // 12. MOOD VARIANTS & SMOOTH LIGHTING/WEATHER TRANSITIONS
  // =========================================================================
  const FOREST_MOODS = {
    deep_pine: {
      subtitle: '林隙晨光 · 冰晶冻溪',
      hemiSky: 0xdaf1ff, hemiGround: 0x9dc4e8, hemiInt: 1.25,
      sunColor: 0xfff0d4, sunInt: 2.45,
      fillColor: 0xffe9cc, fillInt: 0.68,
      skyHorizon: 0xd1e8fa, skyMid: 0x8cc9f2, skyZenith: 0x4d94e0,
      skyWarmScatter: 0xffe6b8, skyGoldHalo: 0xfff2cc, skyHorizonBand: 0xfaf0db,
      skyBelowHorizon: 0xc2e0f5, skyCloudWarm: 0xfff5db,
      skySunStrength: 1.0, skyCloudOpacity: 0.56,
      streamDeepIce: 0x297ac7, streamBrightIce: 0x75d6fa, streamSpec: 0xfff7e0,
      streamFrostCover: 0.0,
      sunbeamColor: 0xfff4d8, sunbeamOpacity: 1.0,
      crystalEmissive: 0x6be8ff, crystalEmissiveMul: 1.0, crystalLightColor: 0x6be8ff, crystalLightMul: 1.0,
      moteColor: 0xcdf7ff, moteSize: 0.24,
      terrainTint: 0xffffff, foliageSnowTint: 0xffffff, stoneTint: 0xffffff, mountainTint: 0xffffff,
      windSpeedMul: 1.0, windAmp: 1.0,
      fog: { color: 0xcbe3f6, near: 16, far: 48 },
      background: 0xb7d6f0,
      atmospherePreset: {
        particleType: 'iceDust', particleColor: 0xc8f4ff, particleSecondaryColor: 0xeef9ff,
        particleCount: 460, particleSpeed: 1.0, particleWind: 1.0,
        godRayColor: 0xe6f7ff, godRayOpacity: 0.28, godRayOrigin: [8, 14, -9],
        bloomStrength: 0.42, bloomThreshold: 0.76, bloomRadius: 0.65,
        focusDepth: 0.56, blurAmount: 1.85, vignetteStrength: 0.14,
        spriteRimTint: [0.96, 1.0, 1.05],
      },
    },
    graveyard_mist: {
      subtitle: '月夜幽蓝 · 薄雾古林',
      hemiSky: 0x5d7fb8, hemiGround: 0x2a3959, hemiInt: 0.68,
      sunColor: 0xbcd6ff, sunInt: 0.95,
      fillColor: 0x7aa2dc, fillInt: 0.36,
      skyHorizon: 0x4b6996, skyMid: 0x263d6b, skyZenith: 0x162447,
      skyWarmScatter: 0x6f96cf, skyGoldHalo: 0xcde3ff, skyHorizonBand: 0x6786b5,
      skyBelowHorizon: 0x2c4166, skyCloudWarm: 0x9ab8e0,
      skySunStrength: 0.62, skyCloudOpacity: 0.42,
      streamDeepIce: 0x0f2752, streamBrightIce: 0x3b76b8, streamSpec: 0xd4eaff,
      streamFrostCover: 0.14,
      sunbeamColor: 0x8fb8f5, sunbeamOpacity: 0.52,
      crystalEmissive: 0x74d4ff, crystalEmissiveMul: 1.48, crystalLightColor: 0x8aa8ff, crystalLightMul: 1.38,
      moteColor: 0x9cd8ff, moteSize: 0.29,
      terrainTint: 0x627aa6, foliageSnowTint: 0x6f89b5, stoneTint: 0x5c6e8f, mountainTint: 0x4b638c,
      windSpeedMul: 0.72, windAmp: 0.76,
      fog: { color: 0x3a527a, near: 12.5, far: 42 },
      background: 0x243659,
      atmospherePreset: {
        particleType: 'iceDust', particleColor: 0x9ed8ff, particleSecondaryColor: 0x8c9eff,
        particleCount: 420, particleSpeed: 0.72, particleWind: 0.75,
        godRayColor: 0x8cb8f5, godRayOpacity: 0.22, godRayOrigin: [8, 14, -9],
        bloomStrength: 0.48, bloomThreshold: 0.70, bloomRadius: 0.70,
        focusDepth: 0.56, blurAmount: 1.80, vignetteStrength: 0.22,
        spriteRimTint: [1.08, 1.08, 1.15],
      },
    },
    blizzard_canyon: {
      subtitle: '凛冬峡谷 · 漫天飞雪',
      hemiSky: 0xd2ecff, hemiGround: 0x98bedc, hemiInt: 1.38,
      sunColor: 0xe4f4ff, sunInt: 1.90,
      fillColor: 0xcde9ff, fillInt: 0.96,
      skyHorizon: 0xcce0f0, skyMid: 0x8cb0cf, skyZenith: 0x4e759e,
      skyWarmScatter: 0xdaf0ff, skyGoldHalo: 0xedf8ff, skyHorizonBand: 0xd8ebf7,
      skyBelowHorizon: 0xa8c8e2, skyCloudWarm: 0xeaf6ff,
      skySunStrength: 0.36, skyCloudOpacity: 0.78,
      streamDeepIce: 0x246aa8, streamBrightIce: 0x62cbf0, streamSpec: 0xe8f9ff,
      streamFrostCover: 0.36,
      sunbeamColor: 0xd2f1ff, sunbeamOpacity: 0.56,
      crystalEmissive: 0x52e0ff, crystalEmissiveMul: 1.28, crystalLightColor: 0x5ee4ff, crystalLightMul: 1.30,
      moteColor: 0xdcf8ff, moteSize: 0.28,
      terrainTint: 0xe8f5ff, foliageSnowTint: 0xffffff, stoneTint: 0xffffff, mountainTint: 0xd4e9fa,
      windSpeedMul: 1.75, windAmp: 1.85,
      fog: { color: 0xbdd7ec, near: 15, far: 42 },
      background: 0xa6c7e2,
      atmospherePreset: {
        particleType: 'snow', particleColor: 0xf4fbff, particleSecondaryColor: 0x9cdfff,
        particleCount: 780, particleSpeed: 1.65, particleWind: 2.55,
        godRayColor: 0xd0efff, godRayOpacity: 0.18, godRayOrigin: [8, 14, -9],
        bloomStrength: 0.40, bloomThreshold: 0.78, bloomRadius: 0.62,
        focusDepth: 0.56, blurAmount: 1.75, vignetteStrength: 0.15,
        spriteRimTint: [0.92, 1.01, 1.09],
      },
    },
    blizzard_canyon_w2: {
      subtitle: '霜渊领主 · 深冰青狂雪',
      hemiSky: 0x9ce2ff, hemiGround: 0x5c96be, hemiInt: 1.30,
      sunColor: 0xb2f0ff, sunInt: 1.98,
      fillColor: 0x8be2ff, fillInt: 1.06,
      skyHorizon: 0x90c4df, skyMid: 0x4b7fa9, skyZenith: 0x234c7a,
      skyWarmScatter: 0x8ce8ff, skyGoldHalo: 0xc2f6ff, skyHorizonBand: 0x9cdaf0,
      skyBelowHorizon: 0x6ea6ca, skyCloudWarm: 0xbceeff,
      skySunStrength: 0.26, skyCloudOpacity: 0.86,
      streamDeepIce: 0x16538f, streamBrightIce: 0x3ed4ff, streamSpec: 0xbef6ff,
      streamFrostCover: 0.52,
      sunbeamColor: 0x70ecff, sunbeamOpacity: 0.88,
      crystalEmissive: 0x2ce2ff, crystalEmissiveMul: 1.68, crystalLightColor: 0x3ae6ff, crystalLightMul: 1.68,
      moteColor: 0x8ef2ff, moteSize: 0.34,
      terrainTint: 0xcceeff, foliageSnowTint: 0xffffff, stoneTint: 0xffffff, mountainTint: 0xa6d6f2,
      windSpeedMul: 2.45, windAmp: 2.65,
      fog: { color: 0x86bad6, near: 15, far: 39 },
      background: 0x679ec2,
      atmospherePreset: {
        particleType: 'snow', particleColor: 0xe6fbff, particleSecondaryColor: 0x52dcff,
        particleCount: 1050, particleSpeed: 2.15, particleWind: 3.75,
        godRayColor: 0x7ceaff, godRayOpacity: 0.28, godRayOrigin: [8, 14, -9],
        bloomStrength: 0.52, bloomThreshold: 0.70, bloomRadius: 0.72,
        focusDepth: 0.56, blurAmount: 1.65, vignetteStrength: 0.16,
        spriteRimTint: [0.85, 1.03, 1.15],
      },
    },
  };

  function cloneForestMoodResult(moodId, cfg) {
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

  function makeForestMoodSnap(cfg) {
    return {
      hemiSky: new THREE.Color(cfg.hemiSky),
      hemiGround: new THREE.Color(cfg.hemiGround),
      hemiInt: cfg.hemiInt,
      sunColor: new THREE.Color(cfg.sunColor),
      sunInt: cfg.sunInt,
      fillColor: new THREE.Color(cfg.fillColor),
      fillInt: cfg.fillInt,
      skyHorizon: new THREE.Color(cfg.skyHorizon),
      skyMid: new THREE.Color(cfg.skyMid),
      skyZenith: new THREE.Color(cfg.skyZenith),
      skyWarmScatter: new THREE.Color(cfg.skyWarmScatter),
      skyGoldHalo: new THREE.Color(cfg.skyGoldHalo),
      skyHorizonBand: new THREE.Color(cfg.skyHorizonBand),
      skyBelowHorizon: new THREE.Color(cfg.skyBelowHorizon),
      skyCloudWarm: new THREE.Color(cfg.skyCloudWarm),
      skySunStrength: cfg.skySunStrength,
      skyCloudOpacity: cfg.skyCloudOpacity,
      streamDeepIce: new THREE.Color(cfg.streamDeepIce),
      streamBrightIce: new THREE.Color(cfg.streamBrightIce),
      streamSpec: new THREE.Color(cfg.streamSpec),
      streamFrostCover: cfg.streamFrostCover,
      fogColor: new THREE.Color(cfg.fog.color),
      fogNear: cfg.fog.near,
      fogFar: cfg.fog.far,
      sunbeamColor: new THREE.Color(cfg.sunbeamColor),
      sunbeamOpacity: cfg.sunbeamOpacity,
      crystalEmissive: new THREE.Color(cfg.crystalEmissive),
      crystalEmissiveMul: cfg.crystalEmissiveMul,
      crystalLightColor: new THREE.Color(cfg.crystalLightColor),
      crystalLightMul: cfg.crystalLightMul,
      moteColor: new THREE.Color(cfg.moteColor),
      moteSize: cfg.moteSize,
      terrainTint: new THREE.Color(cfg.terrainTint),
      foliageSnowTint: new THREE.Color(cfg.foliageSnowTint != null ? cfg.foliageSnowTint : 0xffffff),
      stoneTint: new THREE.Color(cfg.stoneTint != null ? cfg.stoneTint : 0xffffff),
      mountainTint: new THREE.Color(cfg.mountainTint),
      windSpeedMul: cfg.windSpeedMul,
      windAmp: cfg.windAmp,
    };
  }

  function copyForestSnap(dst, src) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].copy(src[k]);
      else dst[k] = src[k];
    }
  }

  function lerpForestSnap(dst, a, b, t) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].lerpColors(a[k], b[k], t);
      else dst[k] = a[k] + (b[k] - a[k]) * t;
    }
  }

  let currentMoodId = 'deep_pine';
  let runtimeTicks = 0;
  let windPhaseAccum = 0;
  const moodCur = makeForestMoodSnap(FOREST_MOODS.deep_pine);
  const moodFrom = makeForestMoodSnap(FOREST_MOODS.deep_pine);
  const moodTarget = makeForestMoodSnap(FOREST_MOODS.deep_pine);
  const moodTrans = { active: false, elapsed: 0, duration: 0.9 };

  function commitForestMood(s) {
    hemiLight.color.copy(s.hemiSky);
    hemiLight.groundColor.copy(s.hemiGround);
    hemiLight.intensity = s.hemiInt;
    sunLight.color.copy(s.sunColor);
    sunLight.intensity = s.sunInt;
    bounceFill.color.copy(s.fillColor);
    bounceFill.intensity = s.fillInt;

    skyUniforms.uHorizonCol.value.copy(s.skyHorizon);
    skyUniforms.uMidSkyCol.value.copy(s.skyMid);
    skyUniforms.uZenithCol.value.copy(s.skyZenith);
    skyUniforms.uWarmScatterCol.value.copy(s.skyWarmScatter);
    skyUniforms.uGoldHaloCol.value.copy(s.skyGoldHalo);
    skyUniforms.uHorizonBandCol.value.copy(s.skyHorizonBand);
    skyUniforms.uBelowHorizonCol.value.copy(s.skyBelowHorizon);
    skyUniforms.uCloudWarmCol.value.copy(s.skyCloudWarm);
    skyUniforms.uSunStrength.value = s.skySunStrength;
    skyUniforms.uCloudOpacity.value = s.skyCloudOpacity;

    iceStreamUniforms.uFogColor.value.copy(s.fogColor);
    iceStreamUniforms.uFogNear.value = s.fogNear;
    iceStreamUniforms.uFogFar.value = s.fogFar;
    iceStreamUniforms.uDeepIceCol.value.copy(s.streamDeepIce);
    iceStreamUniforms.uBrightIceCol.value.copy(s.streamBrightIce);
    iceStreamUniforms.uSpecCol.value.copy(s.streamSpec);
    iceStreamUniforms.uFrostTint.value.copy(s.foliageSnowTint);
    iceStreamUniforms.uFrostCover.value = s.streamFrostCover;

    sunbeamUniforms.uColor.value.copy(s.sunbeamColor);
    sunbeamUniforms.uOpacityScale.value = s.sunbeamOpacity;

    for (let i = 0; i < animatedCrystalCores.length; i++) {
      animatedCrystalCores[i].mat.emissive.copy(s.crystalEmissive);
    }
    for (let i = 0; i < animatedCrystalLights.length; i++) {
      animatedCrystalLights[i].light.color.copy(s.crystalLightColor);
    }
    lanternCrystalMat.emissive.copy(s.crystalEmissive);
    lanternCrystalMat.emissiveIntensity = 1.85 * s.crystalEmissiveMul;
    moteMat.color.copy(s.moteColor);
    moteMat.size = s.moteSize;

    terrainMat.color.copy(s.terrainTint);
    if (arenaSheenMat) arenaSheenMat.color.copy(baseArenaSheenColor).multiply(s.terrainTint);
    firSnowMat.color.copy(s.foliageSnowTint);
    birchCanopyMat.color.copy(s.foliageSnowTint);
    birchTrunkMat.color.copy(s.foliageSnowTint);
    snowPillowMat.color.copy(baseSnowPillowColor).multiply(s.foliageSnowTint);
    tmpFoliageTint.copy(s.foliageSnowTint).lerp(whiteTintColor, 0.35);
    firFoliageMat.color.copy(tmpFoliageTint);
    stoneMat.color.copy(baseStoneColor).multiply(s.stoneTint);
    marbleMat.color.copy(baseMarbleColor).multiply(s.stoneTint);
    cobbleMat.color.copy(s.stoneTint);
    mountainMat.color.copy(s.mountainTint);
    windAmpUniform.value = s.windAmp;
  }

  let biomeHandle = null;

  function applyMood(moodId, options = {}) {
    const rawKey = typeof moodId === 'string' ? moodId.trim().toLowerCase() : '';
    const resolvedKey = FOREST_MOODS[rawKey] ? rawKey : 'deep_pine';
    const cfg = FOREST_MOODS[resolvedKey];
    currentMoodId = resolvedKey;

    const targetSnap = makeForestMoodSnap(cfg);
    const immediate =
      options.immediate === true ||
      options.duration === 0 ||
      runtimeTicks < 2;

    if (immediate) {
      copyForestSnap(moodCur, targetSnap);
      copyForestSnap(moodFrom, targetSnap);
      copyForestSnap(moodTarget, targetSnap);
      moodTrans.active = false;
      moodTrans.elapsed = 0;
      commitForestMood(moodCur);
    } else {
      copyForestSnap(moodFrom, moodCur);
      copyForestSnap(moodTarget, targetSnap);
      moodTrans.duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0.9;
      moodTrans.elapsed = 0;
      moodTrans.active = true;
    }

    const result = cloneForestMoodResult(resolvedKey, cfg);
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
  // 13. UPDATE & DISPOSE LIFECYCLE
  // =========================================================================
  function update(elapsedSec, dtSec) {
    const t = Number.isFinite(elapsedSec) ? elapsedSec : 0;
    const safeDt = Number.isFinite(dtSec) ? Math.min(Math.max(dtSec, 0), 0.1) : 0.016;
    if (safeDt > 0 || t > 0.02) {
      runtimeTicks += 1;
    }

    if (moodTrans.active) {
      moodTrans.elapsed += Math.max(safeDt, 0.016);
      const rawT = Math.min(1, moodTrans.elapsed / Math.max(0.05, moodTrans.duration));
      const smoothT = rawT * rawT * (3 - 2 * rawT);
      lerpForestSnap(moodCur, moodFrom, moodTarget, smoothT);
      commitForestMood(moodCur);
      if (rawT >= 1) {
        moodTrans.active = false;
      }
    }

    // 1. Shader time uniforms (stream caustics/sparkle, sky cirrus drift, sunbeams, wind sway)
    iceStreamUniforms.uTime.value = t;
    skyUniforms.uTime.value = t;
    sunbeamUniforms.uTime.value = t;
    windPhaseAccum += safeDt * moodCur.windSpeedMul;
    windUniform.value = windPhaseAccum || t;

    // 2. Hero crystal clusters & rune harmonic glow pulse
    const cEmMul = moodCur.crystalEmissiveMul;
    const cLiMul = moodCur.crystalLightMul;
    for (let i = 0; i < animatedCrystalCores.length; i++) {
      const c = animatedCrystalCores[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 1.45 + c.phase);
      c.mat.emissiveIntensity = c.baseInt * cEmMul * (0.82 + wave * 0.36);
    }
    for (let i = 0; i < animatedCrystalLights.length; i++) {
      const l = animatedCrystalLights[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 1.45 + l.phase);
      l.light.intensity = l.baseInt * cLiMul * (0.84 + wave * 0.32);
    }
    for (let i = 0; i < animatedGlowDiscs.length; i++) {
      const d = animatedGlowDiscs[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 1.45 + d.phase);
      d.mat.opacity = Math.min(0.92, d.baseOp * cEmMul * (0.78 + wave * 0.44));
    }

    // 3. Floating arcane crystal streetlamps levitation & counter-rotation
    for (let i = 0; i < floatingLanterns.length; i++) {
      const fl = floatingLanterns[i];
      fl.floatNode.position.y = fl.baseFloatY + Math.sin(t * 1.85 + fl.phase) * 0.11;
      fl.crystal.rotation.y = t * 0.95 + fl.phase;
      fl.ring.rotation.z = -t * 0.72 + fl.phase;
      fl.ring.rotation.x = 0.62 + Math.sin(t * 0.9 + fl.phase) * 0.18;
    }

    // 4. Gently rising & swaying ambient frost motes around stream/ruins
    const mpAttr = moteGeo.attributes.position;
    const moteDriftMul = 0.75 + 0.25 * moodCur.windSpeedMul;
    for (let i = 0; i < moteCount; i++) {
      const baseX = moteSeeds[i * 3];
      const baseY = moteSeeds[i * 3 + 1];
      const ph = moteSeeds[i * 3 + 2];
      const yCycle = ((baseY + t * 0.22 * moteDriftMul) % 4.0) + 0.35;
      mpAttr.setX(i, baseX + Math.sin(t * 0.85 * moteDriftMul + ph) * 0.32 * moodCur.windAmp);
      mpAttr.setY(i, yCycle);
    }
    mpAttr.needsUpdate = true;
  }

  function dispose() {
    for (let i = 0; i < trackedGeos.length; i++) {
      trackedGeos[i].dispose();
    }
    for (let i = 0; i < trackedMats.length; i++) {
      trackedMats[i].dispose();
    }
    for (let i = 0; i < trackedTextures.length; i++) {
      trackedTextures[i].dispose();
    }
    trackedGeos.length = 0;
    trackedMats.length = 0;
    trackedTextures.length = 0;
  }

  const defaultResult = cloneForestMoodResult('deep_pine', FOREST_MOODS.deep_pine);
  biomeHandle = {
    id: 'forest',
    name: '极北冰晶古林',
    subtitle: FOREST_MOODS.deep_pine.subtitle,
    currentMood: currentMoodId,
    supportedMoods: Object.keys(FOREST_MOODS),
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
