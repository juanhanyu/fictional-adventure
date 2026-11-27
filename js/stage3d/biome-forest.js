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
// Procedural Sculpted Geometries: AAA Trees, Dual-Layer Crystals, Gothic Ruins,
// Wrought-Iron Filigree Lanterns, Flagstones, Gnarled Stumps & Alpine Peaks
// ---------------------------------------------------------------------------

/**
 * Creates a smooth parallel-transport curved 3D tube (for gnarled tree trunks,
 * spreading buttress roots, forked birch limbs, and wrought-iron lantern ribs).
 * Right-handed frame (T, N, B) with B = T x N => (a, b, c), (b, d, c) faces outward.
 */
function createCurvedBranchTube(THREE, pts, radii, radialSegs = 7, colFn = null, opts = {}) {
  const nPts = pts.length;
  const stride = radialSegs + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const fluteAmp = opts.fluteAmp || 0;
  const fluteFreq = opts.fluteFreq || 5;
  const flutePhase = opts.flutePhase || 0;
  const capStart = opts.capStart === true;
  const capEnd = opts.capEnd !== false;

  const vecs = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const tangents = [];
  for (let j = 0; j < nPts; j++) {
    const t = new THREE.Vector3();
    if (j === 0) t.subVectors(vecs[1], vecs[0]);
    else if (j === nPts - 1) t.subVectors(vecs[nPts - 1], vecs[nPts - 2]);
    else t.subVectors(vecs[j + 1], vecs[j - 1]);
    if (t.lengthSq() < 1e-8) t.set(0, 1, 0);
    else t.normalize();
    tangents.push(t);
  }

  // Initial normal perpendicular to tangent[0]
  const ref = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  let prevN = new THREE.Vector3().crossVectors(ref, tangents[0]).normalize();
  const normalsFrame = [prevN.clone()];
  const binormalsFrame = [new THREE.Vector3().crossVectors(tangents[0], prevN).normalize()];

  for (let j = 1; j < nPts; j++) {
    const T = tangents[j];
    const proj = prevN.clone().addScaledVector(T, -prevN.dot(T));
    if (proj.lengthSq() < 1e-8) {
      const alt = Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      proj.crossVectors(alt, T);
    }
    proj.normalize();
    prevN = proj;
    normalsFrame.push(proj.clone());
    binormalsFrame.push(new THREE.Vector3().crossVectors(T, proj).normalize());
  }

  let arcLen = 0;
  const tmpCol = new THREE.Color(0xffffff);
  const pOut = new THREE.Vector3();

  for (let j = 0; j < nPts; j++) {
    if (j > 0) arcLen += vecs[j].distanceTo(vecs[j - 1]);
    const vFrac = j / Math.max(1, nPts - 1);
    const baseR = Array.isArray(radii) ? radii[j] : lerp(radii.r0, radii.r1, vFrac);
    const C = vecs[j];
    const N = normalsFrame[j];
    const B = binormalsFrame[j];

    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const theta = u * Math.PI * 2;
      let r = baseR;
      if (fluteAmp > 0) {
        const fluteWave = Math.cos(theta * fluteFreq + flutePhase + vFrac * 1.4);
        const fineCrack = Math.sin(theta * (fluteFreq * 2 + 1) - flutePhase * 1.7) * 0.45;
        r *= 1.0 + fluteAmp * (fluteWave * 0.72 + fineCrack * 0.28) * (1.0 - vFrac * 0.35);
      }
      r = Math.max(0.002, r);
      const ca = Math.cos(theta) * r;
      const sa = Math.sin(theta) * r;
      pOut.copy(C).addScaledVector(N, ca).addScaledVector(B, sa);
      positions.push(pOut.x, pOut.y, pOut.z);
      uvs.push(u, arcLen * 0.65);

      if (colFn) {
        colFn(vFrac, theta, pOut, tmpCol);
      } else {
        tmpCol.setHex(0xffffff);
      }
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
    }
  }

  for (let j = 0; j < nPts - 1; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  if (capEnd) {
    const endIdx = positions.length / 3;
    const tip = vecs[nPts - 1];
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0.5, arcLen * 0.65);
    if (colFn) colFn(1.0, 0, tip, tmpCol);
    else tmpCol.setHex(0xffffff);
    colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
    const ringOff = (nPts - 1) * stride;
    for (let i = 0; i < radialSegs; i++) {
      indices.push(endIdx, ringOff + i, ringOff + i + 1);
    }
  }

  if (capStart) {
    const startIdx = positions.length / 3;
    const st = vecs[0];
    positions.push(st.x, st.y, st.z);
    uvs.push(0.5, 0);
    if (colFn) colFn(0.0, 0, st, tmpCol);
    else tmpCol.setHex(0xffffff);
    colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
    for (let i = 0; i < radialSegs; i++) {
      indices.push(startIdx, i + 1, i);
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
 * Builds a single individually sculpted, jaggedly serrated alpine pine bough frond
 * (or its matching sculpted puffy snow-drift cushion) extending along +X, then oriented.
 * Completely eliminates uniform circular umbrella skirts on snow firs.
 */
function createPineBoughFrond(THREE, opts) {
  const {
    len,
    width,
    thick,
    droop,
    tipUp = 0.14,
    segs = 6,
    isSnow = false,
    seed = 1.0,
    colInner,
    colOuter,
    colTip,
    yaw = 0,
    pitch = 0,
    roll = 0,
    ox = 0,
    oy = 0,
    oz = 0,
  } = opts;

  const cols = isSnow ? 5 : 6; // 0:L-edge, 1:L-mid, 2:spine, 3:R-mid, 4:R-edge, (5:underside keel)
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const cIn = new THREE.Color(colInner);
  const cOut = new THREE.Color(colOuter);
  const cTip = new THREE.Color(colTip);
  const cUnder = cIn.clone().multiplyScalar(0.56);
  const tmp = new THREE.Color();

  const effLen = isSnow ? len * 0.90 : len;
  const effWidth = isSnow ? width * 0.78 : width;

  for (let s = 0; s <= segs; s++) {
    const u = s / segs;
    const x = u * effLen;
    // Graceful snow-weighted droop with crisp upward turn at the outer needle tip
    const upTerm = Math.max(0, u - 0.66);
    const sy = -droop * Math.pow(u, 1.55) + tipUp * upTerm * upTerm * 4.2 + (isSnow ? 0.055 : 0);

    // Tapered asymmetric frond silhouette with serrated jagged needle sub-sprays
    const env = s === segs ? 0.015 : Math.sin(Math.pow(u, 0.72) * Math.PI * 0.96 + 0.08);
    const sawL = s === 0 || s === segs ? 1.0 : s % 2 === 1 ? 1.30 : 0.74;
    const sawR = s === 0 || s === segs ? 1.0 : s % 2 === 0 ? 1.28 : 0.76;
    const jitL = 0.92 + 0.18 * hash2(s * 2.1 + seed, seed * 3.7);
    const jitR = 0.92 + 0.18 * hash2(seed * 4.3, s * 2.7 + seed);

    const wL = Math.max(0.01, effWidth * env * sawL * jitL);
    const wR = Math.max(0.01, effWidth * env * sawR * jitR);
    const hRidge = Math.max(0.012, thick * (1.0 - u * 0.68) * (isSnow ? (0.85 + 0.35 * Math.sin(u * Math.PI)) : 1.0));
    const edgeDrop = isSnow ? hRidge * 0.32 : hRidge * 0.55;

    const ringPts = [
      [x, sy - edgeDrop, wL],
      [x, sy + hRidge * 0.54, wL * 0.46],
      [x, sy + hRidge, 0],
      [x, sy + hRidge * 0.54, -wR * 0.46],
      [x, sy - edgeDrop, -wR],
    ];
    if (!isSnow) {
      ringPts.push([x, sy - hRidge * 0.72, 0]);
    }

    for (let k = 0; k < cols; k++) {
      const pt = ringPts[k];
      positions.push(pt[0], pt[1], pt[2]);
      uvs.push(u * 1.6, k / 4.0);

      if (!isSnow && k === 5) {
        tmp.copy(cUnder);
      } else if (isSnow) {
        const ridgeBoost = k === 2 ? 1.0 : k === 1 || k === 3 ? 0.72 : 0.18;
        tmp.copy(cIn).lerp(cOut, smoothstep(0.0, 0.85, ridgeBoost * 0.7 + u * 0.3));
        if (k === 2 && u > 0.22) tmp.lerp(cTip, 0.45);
      } else {
        const outerEdge = k === 0 || k === 4 ? 1.0 : 0.4;
        tmp.copy(cIn).lerp(cOut, smoothstep(0.08, 0.88, u * 0.65 + outerEdge * 0.35));
        if (u > 0.52 && (k === 0 || k === 4 || k === 2)) tmp.lerp(cTip, 0.42 * smoothstep(0.45, 0.95, u));
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let s = 0; s < segs; s++) {
    const r0 = s * cols;
    const r1 = (s + 1) * cols;
    // Upper surface: 0->1->2->3->4 (+X x -Z = +Y outward)
    for (let k = 0; k < 4; k++) {
      const a = r0 + k;
      const b = r1 + k;
      const c = r0 + k + 1;
      const d = r1 + k + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    if (!isSnow) {
      // Closed underside keel: 4->5 and 5->0 (+X x +Z = -Y outward)
      indices.push(r0 + 4, r1 + 4, r0 + 5);
      indices.push(r1 + 4, r1 + 5, r0 + 5);
      indices.push(r0 + 5, r1 + 5, r0 + 0);
      indices.push(r1 + 5, r1 + 0, r0 + 0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  if (roll) geo.rotateX(roll);
  if (pitch) geo.rotateZ(pitch);
  if (yaw) geo.rotateY(yaw);
  geo.translate(ox, oy, oz);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the 4 merged AAA assets for a natural alpine Snow Cedar/Fir tree:
 * - trunkGeo (gently curved bark trunk + 5 gnarled spreading buttress roots + lower branch stubs)
 * - foliageGeo (7 staggered whorls of individually sculpted jagged serrated pine bough fronds)
 * - snowGeo (sculpted snow-drift cushions draped atop each bough leaving jagged needle tips exposed)
 * - icicleGeo (22 delicate translucent crystal icicles hanging from drooping branch tips!)
 */
function buildSnowFirAssetGeometries(THREE) {
  const trunkParts = [];
  const cBarkDark = new THREE.Color(0x4c372b);
  const cBarkMid = new THREE.Color(0x6e5342);
  const cBarkFrost = new THREE.Color(0x887568);

  // 1. Gently curved fluted main trunk
  const trunkPts = [];
  const trunkRadii = [];
  const tSteps = 10;
  for (let i = 0; i <= tSteps; i++) {
    const f = i / tSteps;
    const y = lerp(-0.18, 5.15, f);
    const sx = Math.sin(f * Math.PI * 1.15) * 0.11;
    const sz = Math.cos(f * Math.PI * 0.85) * 0.06 - 0.06;
    const r = lerp(0.32, 0.045, Math.pow(f, 0.78)) + (f < 0.16 ? (0.16 - f) * 0.55 : 0);
    trunkPts.push([sx, y, sz]);
    trunkRadii.push(r);
  }
  trunkParts.push(
    createCurvedBranchTube(
      THREE,
      trunkPts,
      trunkRadii,
      9,
      (vFrac, theta, _pt, out) => {
        const furrow = 0.5 + 0.5 * Math.cos(theta * 7.0 + vFrac * 2.0);
        out.copy(cBarkDark).lerp(cBarkMid, furrow * 0.85);
        if (vFrac < 0.16) out.lerp(cBarkFrost, (1.0 - vFrac / 0.16) * 0.25);
      },
      { fluteAmp: 0.11, fluteFreq: 6, capEnd: true }
    )
  );

  // 5 Gnarled spreading buttress roots gripping the alpine snow
  for (let r = 0; r < 5; r++) {
    const ang = (r / 5) * Math.PI * 2 + hash2(r * 2.3, 1.7) * 0.42;
    const reach = 0.68 + hash2(r * 4.1, 3.2) * 0.34;
    const ca = Math.cos(ang);
    const sa = -Math.sin(ang);
    const sideX = -sa;
    const sideZ = ca;
    const bend = (hash2(r, 9.1) - 0.5) * 0.22;
    const rootPts = [
      [ca * 0.16, 0.42, sa * 0.16],
      [ca * (reach * 0.42) + sideX * bend * 0.5, 0.18, sa * (reach * 0.42) + sideZ * bend * 0.5],
      [ca * (reach * 0.78) + sideX * bend, 0.02, sa * (reach * 0.78) + sideZ * bend],
      [ca * reach + sideX * bend * 1.15, -0.16, sa * reach + sideZ * bend * 1.15],
    ];
    trunkParts.push(
      createCurvedBranchTube(
        THREE,
        rootPts,
        [0.14, 0.11, 0.065, 0.028],
        6,
        (vFrac, _th, _pt, out) => {
          out.copy(cBarkDark).lerp(cBarkMid, 0.45 + vFrac * 0.25);
        },
        { fluteAmp: 0.08, fluteFreq: 4, capEnd: true }
      )
    );
  }

  // 4 Stubby lower deadwood branch collars beneath the lowest canopy whorl
  for (let s = 0; s < 4; s++) {
    const ang = s * 1.62 + 0.4;
    const sy = 0.62 + s * 0.11;
    const ca = Math.cos(ang);
    const sa = -Math.sin(ang);
    trunkParts.push(
      createCurvedBranchTube(
        THREE,
        [
          [ca * 0.14, sy, sa * 0.14],
          [ca * 0.36, sy - 0.05, sa * 0.36],
          [ca * 0.52, sy - 0.12, sa * 0.52],
        ],
        [0.052, 0.032, 0.012],
        5,
        (_v, _th, _pt, out) => out.copy(cBarkDark),
        { capEnd: true }
      )
    );
  }

  const trunkGeo = mergeGeometries(THREE, trunkParts);

  // 2. Seven staggered whorls of individual asymmetric serrated pine bough fronds + snow pillows + tip icicles
  const whorls = [
    { y: 1.05, count: 8, len: 1.92, width: 0.72, thick: 0.24, droop: 0.44, pitch: -0.10, icicles: true },
    { y: 1.72, count: 8, len: 1.68, width: 0.64, thick: 0.22, droop: 0.38, pitch: -0.07, icicles: true },
    { y: 2.38, count: 7, len: 1.44, width: 0.56, thick: 0.20, droop: 0.32, pitch: -0.04, icicles: true },
    { y: 3.04, count: 7, len: 1.20, width: 0.49, thick: 0.18, droop: 0.26, pitch: 0.0, icicles: true },
    { y: 3.68, count: 6, len: 0.96, width: 0.42, thick: 0.16, droop: 0.20, pitch: 0.04, icicles: false },
    { y: 4.30, count: 5, len: 0.72, width: 0.35, thick: 0.14, droop: 0.14, pitch: 0.10, icicles: false },
    { y: 4.88, count: 4, len: 0.48, width: 0.26, thick: 0.11, droop: 0.08, pitch: 0.18, icicles: false },
  ];

  const foliageParts = [];
  const snowParts = [];
  const icicleParts = [];

  for (let w = 0; w < whorls.length; w++) {
    const cfg = whorls[w];
    const fTrunk = clamp((cfg.y + 0.18) / 5.33, 0, 1);
    const trunkX = Math.sin(fTrunk * Math.PI * 1.15) * 0.11;
    const trunkZ = Math.cos(fTrunk * Math.PI * 0.85) * 0.06 - 0.06;

    for (let k = 0; k < cfg.count; k++) {
      const seed = w * 19.7 + k * 7.3 + 2.1;
      const baseYaw = (k / cfg.count) * Math.PI * 2 + w * 0.47;
      const yaw = baseYaw + (hash2(seed, 1.3) - 0.5) * 0.32;
      const lenVar = cfg.len * (0.82 + 0.34 * hash2(seed, 4.1));
      const widVar = cfg.width * (0.86 + 0.28 * hash2(seed, 6.9));
      const yOff = (hash2(seed, 2.7) - 0.5) * 0.22;
      const pitch = cfg.pitch + (hash2(seed, 5.5) - 0.5) * 0.12;
      const roll = (hash2(seed, 8.3) - 0.5) * 0.18;
      const droop = cfg.droop * (0.82 + 0.36 * hash2(seed, 9.7));

      foliageParts.push(
        createPineBoughFrond(THREE, {
          len: lenVar,
          width: widVar,
          thick: cfg.thick,
          droop,
          tipUp: 0.13 + w * 0.015,
          segs: 6,
          isSnow: false,
          seed,
          colInner: 0x163d47,
          colOuter: 0x2f7173,
          colTip: 0x6ab4ad,
          yaw,
          pitch,
          roll,
          ox: trunkX,
          oy: cfg.y + yOff,
          oz: trunkZ,
        })
      );

      snowParts.push(
        createPineBoughFrond(THREE, {
          len: lenVar,
          width: widVar,
          thick: cfg.thick * 0.72,
          droop: droop * 0.92,
          tipUp: 0.11 + w * 0.012,
          segs: 5,
          isSnow: true,
          seed,
          colInner: 0xc2def6,
          colOuter: 0xf2faff,
          colTip: 0xffffff,
          yaw,
          pitch,
          roll,
          ox: trunkX,
          oy: cfg.y + yOff + 0.02,
          oz: trunkZ,
        })
      );

      // Delicate hanging translucent crystal icicles beneath lower/mid bough tips
      if (cfg.icicles && (k + w) % 2 === 0) {
        const icLen = 0.20 + hash2(seed, 11.4) * 0.22;
        const icRad = 0.022 + hash2(seed, 13.8) * 0.014;
        const icGeo = new THREE.ConeGeometry(icRad, icLen, 5, 1);
        icGeo.rotateX(Math.PI); // Point sharp crystal tip downward
        const rReach = lenVar * (0.76 + hash2(seed, 15.1) * 0.14);
        const dropEst = droop * Math.pow(0.82, 1.55) - Math.sin(pitch) * rReach;
        const ix = trunkX + Math.cos(yaw) * rReach;
        const iz = trunkZ - Math.sin(yaw) * rReach;
        const iy = cfg.y + yOff - dropEst - icLen * 0.45;
        icGeo.translate(ix, iy, iz);
        setUniformVertexColor(THREE, icGeo, 0xd8f8ff, 0.05);
        icicleParts.push(icGeo);
      }
    }
  }

  // Sculpted frosted spire crown at apex (y = 5.15..6.02)
  const crownTopX = Math.sin(1.15 * Math.PI) * 0.11;
  const crownTopZ = Math.cos(0.85 * Math.PI) * 0.06 - 0.06;
  for (let c = 0; c < 4; c++) {
    const yaw = (c / 4) * Math.PI * 2 + 0.3;
    foliageParts.push(
      createPineBoughFrond(THREE, {
        len: 0.34,
        width: 0.18,
        thick: 0.09,
        droop: 0.02,
        tipUp: 0.26,
        segs: 4,
        isSnow: false,
        seed: 91 + c * 3.1,
        colInner: 0x1d4e57,
        colOuter: 0x3b7f7f,
        colTip: 0x86c8c0,
        yaw,
        pitch: 0.56,
        ox: crownTopX,
        oy: 5.26,
        oz: crownTopZ,
      })
    );
  }
  const spireTip = new THREE.ConeGeometry(0.14, 0.62, 6, 2);
  spireTip.translate(crownTopX, 5.66, crownTopZ);
  setUniformVertexColor(THREE, spireTip, 0x2d6c6e, 0.05);
  foliageParts.push(spireTip);

  const spireSnow = new THREE.ConeGeometry(0.13, 0.48, 7, 2);
  spireSnow.translate(crownTopX, 5.78, crownTopZ);
  setUniformVertexColor(THREE, spireSnow, 0xf6fbff, 0.03);
  snowParts.push(spireSnow);

  const foliageGeo = mergeGeometries(THREE, foliageParts);
  const snowGeo = mergeGeometries(THREE, snowParts);
  const icicleGeo = mergeGeometries(THREE, icicleParts);

  return { trunkGeo, foliageGeo, snowGeo, icicleGeo };
}

/**
 * Builds a single airy, layered, sawtooth-serrated frosted birch foliage spray
 * composed of 4 intersecting arched & toothed crystalline frond fans (ZERO spheres!).
 */
function createBirchLeafSprayGeo(THREE, opts) {
  const {
    ox,
    oy,
    oz,
    scale = 1.0,
    seed = 1.0,
    colBase = 0xf0f8ff,
    colTip = 0xfff3d8,
    colShade = 0x9ec9ec,
  } = opts;

  const parts = [];
  const fanConfigs = [
    { yaw: 0.0, pitch: 0.22, roll: 0.14, len: 0.88, wid: 0.46, droop: 0.26, yOff: 0.02 },
    { yaw: 2.05, pitch: 0.16, roll: -0.16, len: 0.82, wid: 0.44, droop: 0.28, yOff: -0.02 },
    { yaw: 4.18, pitch: 0.26, roll: 0.12, len: 0.78, wid: 0.42, droop: 0.24, yOff: 0.04 },
    { yaw: 1.02, pitch: 0.52, roll: -0.08, len: 0.64, wid: 0.38, droop: 0.16, yOff: 0.12 },
  ];

  const baseRot = hash2(seed, 5.7) * Math.PI * 2;
  for (let f = 0; f < fanConfigs.length; f++) {
    const fc = fanConfigs[f];
    const sLocal = seed + f * 3.9;
    parts.push(
      createPineBoughFrond(THREE, {
        len: fc.len * scale * (0.88 + 0.24 * hash2(sLocal, 1.9)),
        width: fc.wid * scale * (0.88 + 0.24 * hash2(sLocal, 4.3)),
        thick: 0.11 * scale,
        droop: fc.droop * scale,
        tipUp: 0.09 * scale,
        segs: 5,
        isSnow: false,
        seed: sLocal,
        colInner: colShade,
        colOuter: colBase,
        colTip: colTip,
        yaw: baseRot + fc.yaw + (hash2(sLocal, 7.1) - 0.5) * 0.35,
        pitch: fc.pitch + (hash2(sLocal, 8.9) - 0.5) * 0.15,
        roll: fc.roll,
        ox: ox + Math.cos(baseRot + fc.yaw) * 0.06 * scale,
        oy: oy + fc.yOff * scale,
        oz: oz - Math.sin(baseRot + fc.yaw) * 0.06 * scale,
      })
    );
  }

  const merged = mergeGeometries(THREE, parts);
  const flat = merged.index ? merged.toNonIndexed() : merged;
  if (flat !== merged) merged.dispose();
  flat.computeVertexNormals();
  return flat;
}

/**
 * Builds AAA stylized frosted Silver Birch geometries (ZERO low-poly icosahedron blobs!):
 * - trunkGeo (graceful S-curved papery silver-bark trunk, horizontal dark lenticels,
 *   5 gnarled clutching roots, 5 curved primary limbs & 12 slender arching winter twigs)
 * - canopyGeo (26 staggered, airy, sawtooth-serrated frost-white & champagne-gold leaf sprays)
 */
function buildSilverBirchGeometries(THREE) {
  const trunkParts = [];
  const cLight = new THREE.Color(0xf0f5fa);
  const cStripe = new THREE.Color(0x404a57);
  const cBase = new THREE.Color(0x525a66);
  const cTwig = new THREE.Color(0x747e8e);

  const birchBarkColor = (vFrac, theta, pt, out) => {
    const y = pt.y;
    const band = Math.sin(y * 7.4 + Math.cos(theta * 2.0) * 1.1 + hash2(Math.floor(y * 2.5), 1.9) * 3.8);
    out.copy(cLight);
    if (y < 0.78) {
      out.lerp(cBase, Math.pow(1.0 - clamp(y / 0.78, 0, 1), 1.25));
    } else if (band > 0.68) {
      out.lerp(cStripe, 0.72);
    }
    if (vFrac > 0.78) out.lerp(cTwig, (vFrac - 0.78) * 1.4);
  };

  // 1. Main slender gracefully S-curved birch stem
  const stemPts = [];
  const stemRadii = [];
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    const y = lerp(-0.15, 4.65, f);
    const bx = Math.sin(f * Math.PI * 1.25) * 0.16;
    const bz = Math.cos(f * Math.PI * 0.95) * 0.10 - 0.10;
    const r = lerp(0.19, 0.042, Math.pow(f, 0.82)) + (f < 0.14 ? (0.14 - f) * 0.48 : 0);
    stemPts.push([bx, y, bz]);
    stemRadii.push(r);
  }
  trunkParts.push(
    createCurvedBranchTube(THREE, stemPts, stemRadii, 9, birchBarkColor, {
      fluteAmp: 0.06,
      fluteFreq: 5,
      capEnd: true,
    })
  );

  // 5 Gnarled dark-bark surface roots gripping the snowbank
  for (let r = 0; r < 5; r++) {
    const ang = (r / 5) * Math.PI * 2 + 0.25 + hash2(r * 3.1, 2.2) * 0.35;
    const reach = 0.56 + hash2(r * 5.7, 1.4) * 0.28;
    const ca = Math.cos(ang);
    const sa = -Math.sin(ang);
    const sway = (hash2(r, 7.8) - 0.5) * 0.18;
    const rootPts = [
      [ca * 0.10, 0.32, sa * 0.10],
      [ca * reach * 0.45 - sa * sway * 0.5, 0.12, sa * reach * 0.45 + ca * sway * 0.5],
      [ca * reach * 0.82 - sa * sway, 0.0, sa * reach * 0.82 + ca * sway],
      [ca * reach - sa * sway * 1.1, -0.15, sa * reach + ca * sway * 1.1],
    ];
    trunkParts.push(
      createCurvedBranchTube(
        THREE,
        rootPts,
        [0.095, 0.072, 0.042, 0.018],
        6,
        (vf, _th, _p, out) => out.copy(cBase).lerp(cStripe, vf * 0.35),
        { capEnd: true }
      )
    );
  }

  // Helper to evaluate main stem offset at a given y
  const stemPosAtY = (y) => {
    const f = clamp((y + 0.15) / 4.8, 0, 1);
    return [Math.sin(f * Math.PI * 1.25) * 0.16, y, Math.cos(f * Math.PI * 0.95) * 0.10 - 0.10];
  };

  // 5 Graceful curved primary limbs + 12 forked arching secondary twigs
  const primarySpecs = [
    { y0: 2.25, yaw: 0.45, reach: 1.38, rise: 1.42, r0: 0.072 },
    { y0: 2.55, yaw: 2.48, reach: 1.44, rise: 1.52, r0: 0.068 },
    { y0: 2.88, yaw: 4.35, reach: 1.32, rise: 1.45, r0: 0.064 },
    { y0: 3.30, yaw: 1.38, reach: 1.16, rise: 1.36, r0: 0.056 },
    { y0: 3.65, yaw: 3.55, reach: 1.06, rise: 1.28, r0: 0.052 },
  ];

  const sprayAnchors = [];

  for (let b = 0; b < primarySpecs.length; b++) {
    const sp = primarySpecs[b];
    const base = stemPosAtY(sp.y0);
    const ca = Math.cos(sp.yaw);
    const sa = -Math.sin(sp.yaw);
    const perpX = -sa;
    const perpZ = ca;
    const curve = (b % 2 === 0 ? 1 : -1) * 0.18;

    const p0 = [base[0], base[1], base[2]];
    const p1 = [base[0] + ca * sp.reach * 0.36 + perpX * curve * 0.4, base[1] + sp.rise * 0.48, base[2] + sa * sp.reach * 0.36 + perpZ * curve * 0.4];
    const p2 = [base[0] + ca * sp.reach * 0.74 + perpX * curve, base[1] + sp.rise * 0.86, base[2] + sa * sp.reach * 0.74 + perpZ * curve];
    const p3 = [base[0] + ca * sp.reach + perpX * curve * 0.85, base[1] + sp.rise * 0.94, base[2] + sa * sp.reach + perpZ * curve * 0.85];

    trunkParts.push(
      createCurvedBranchTube(
        THREE,
        [p0, p1, p2, p3],
        [sp.r0, sp.r0 * 0.72, sp.r0 * 0.46, sp.r0 * 0.24],
        6,
        (vf, th, pt, out) => {
          birchBarkColor(vf, th, pt, out);
          if (vf > 0.45) out.lerp(cTwig, (vf - 0.45) * 0.85);
        },
        { capEnd: true }
      )
    );

    // Spray at primary limb tip + mid-spur
    sprayAnchors.push({ x: p3[0], y: p3[1] + 0.04, z: p3[2], s: 0.98, warm: b % 2 === 0 });
    sprayAnchors.push({ x: p2[0], y: p2[1] + 0.14, z: p2[2], s: 0.86, warm: b % 2 === 1 });

    // Fork 2 slender arching secondary twigs per primary limb
    for (let tw = 0; tw < 2; tw++) {
      const origin = tw === 0 ? p1 : p2;
      const sideSign = tw === 0 ? 1 : -1;
      const twYaw = sp.yaw + sideSign * (0.68 + hash2(b * 4.3, tw * 7.1) * 0.35);
      const twLen = 0.68 + hash2(b * 2.9, tw * 5.3) * 0.32;
      const twRise = 0.46 + tw * 0.14;
      const tca = Math.cos(twYaw);
      const tsa = -Math.sin(twYaw);

      const t1 = [origin[0] + tca * twLen * 0.52, origin[1] + twRise * 0.76, origin[2] + tsa * twLen * 0.52];
      const t2 = [origin[0] + tca * twLen, origin[1] + twRise * 0.72, origin[2] + tsa * twLen];
      trunkParts.push(
        createCurvedBranchTube(
          THREE,
          [origin, t1, t2],
          [sp.r0 * 0.42, sp.r0 * 0.24, 0.011],
          5,
          (_vf, _th, _pt, out) => out.copy(cTwig).lerp(cLight, 0.35),
          { capEnd: true }
        )
      );
      sprayAnchors.push({ x: t2[0], y: t2[1] + 0.02, z: t2[2], s: 0.78 + tw * 0.08, warm: (b + tw) % 2 === 0 });
    }
  }

  // 2 High crown leader forks near top of main stem
  const crownBase = stemPosAtY(4.25);
  for (let cl = 0; cl < 2; cl++) {
    const yaw = cl * Math.PI + 0.9;
    const ca = Math.cos(yaw);
    const sa = -Math.sin(yaw);
    const tip = [crownBase[0] + ca * 0.55, crownBase[1] + 0.96, crownBase[2] + sa * 0.55];
    trunkParts.push(
      createCurvedBranchTube(
        THREE,
        [crownBase, [crownBase[0] + ca * 0.28, crownBase[1] + 0.55, crownBase[2] + sa * 0.28], tip],
        [0.044, 0.026, 0.012],
        5,
        (_vf, _th, _pt, out) => out.copy(cTwig).lerp(cLight, 0.45),
        { capEnd: true }
      )
    );
    sprayAnchors.push({ x: tip[0], y: tip[1] + 0.08, z: tip[2], s: 0.88, warm: cl === 0 });
  }
  // Airy crown summit plumes
  const stemTop = stemPosAtY(4.62);
  sprayAnchors.push({ x: stemTop[0], y: stemTop[1] + 0.48, z: stemTop[2], s: 0.95, warm: true });
  sprayAnchors.push({ x: stemTop[0] + 0.14, y: stemTop[1] + 0.88, z: stemTop[2] - 0.12, s: 0.74, warm: false });

  const trunkGeo = mergeGeometries(THREE, trunkParts);

  // 2. Multi-layered serrated frosted birch foliage sprays along every branch tip
  const canopyParts = [];
  for (let i = 0; i < sprayAnchors.length; i++) {
    const a = sprayAnchors[i];
    canopyParts.push(
      createBirchLeafSprayGeo(THREE, {
        ox: a.x,
        oy: a.y,
        oz: a.z,
        scale: a.s,
        seed: i * 5.7 + 3.1,
        colBase: a.warm ? 0xf6f9ff : 0xe4f3ff,
        colTip: a.warm ? 0xfff1cf : 0xffffff,
        colShade: a.warm ? 0xb4d3ec : 0x97c5ea,
      })
    );
  }

  const canopyGeo = mergeGeometries(THREE, canopyParts);
  return { trunkGeo, canopyGeo };
}

/**
 * Builds an AAA asymmetric, bevel-chamfered multi-faceted crystal prism with:
 * - Alternating wide primary prism faces & crisp narrow chamfered edge-bevels
 * - Subtle tapered crystalline growth waist
 * - Diagonal oblique chisel-cut shoulder cleavage plane (never a flat horizontal ring!)
 * - Double-stepped asymmetric pyramidal crown terminating in an off-center chisel tip
 * - Rich vertical + per-facet vertex color shading (non-indexed for razor-crisp facets)
 */
function createCrystalPrismGeo(THREE, radius, height, seed = 1.0, opts = {}) {
  const nFaces = opts.nFaces || 6;
  const bevelFrac = opts.bevelFrac != null ? opts.bevelFrac : 0.16;
  const colBase = new THREE.Color(opts.colBase != null ? opts.colBase : 0x76cdf6);
  const colMid = new THREE.Color(opts.colMid != null ? opts.colMid : 0xc6f4ff);
  const colTip = new THREE.Color(opts.colTip != null ? opts.colTip : 0xf4fcff);

  // Build bevelled polygon angles: nFaces major faces interleaved with nFaces narrow edge chamfers
  const ringAngles = [];
  const ringRadiiScale = [];
  const stepAng = (Math.PI * 2) / nFaces;
  for (let f = 0; f < nFaces; f++) {
    const fCenter = f * stepAng;
    const faceR = 0.82 + 0.34 * hash2(f * 2.3 + seed, seed * 4.1);
    const halfBevel = stepAng * bevelFrac * 0.5;
    ringAngles.push(fCenter - stepAng * 0.5 + halfBevel);
    ringRadiiScale.push(faceR);
    ringAngles.push(fCenter + stepAng * 0.5 - halfBevel);
    ringRadiiScale.push(faceR * (0.96 + 0.08 * hash2(f * 3.7, seed * 1.9)));
  }
  const sides = ringAngles.length;

  // Oblique diagonal chisel-cut plane parameters
  const slantDir = hash2(seed, 6.4) * Math.PI * 2;
  const slantMag = (opts.oblique != null ? opts.oblique : 0.14) * (0.75 + 0.5 * hash2(seed, 9.2));
  const slantX = Math.cos(slantDir) * slantMag;
  const slantZ = -Math.sin(slantDir) * slantMag;

  const tipOffX = Math.cos(slantDir) * radius * (0.28 + 0.24 * hash2(seed, 2.3));
  const tipOffZ = -Math.sin(slantDir) * radius * (0.28 + 0.24 * hash2(seed, 8.7));

  const basePts = [];
  const waistPts = [];
  const shoulderPts = [];
  const crownPts = [];

  const waistRatio = 0.44 + 0.08 * hash2(seed, 3.3);
  for (let i = 0; i < sides; i++) {
    const th = ringAngles[i];
    const ca = Math.cos(th);
    const sa = -Math.sin(th);
    const rb = radius * ringRadiiScale[i];
    const rw = rb * 0.91;
    const rs = rb * 0.77;
    const rc = rb * 0.36;

    const obShift = slantX * ca + slantZ * sa;
    const facetStep = (hash2(Math.floor(i / 2) * 5.1 + seed, 7.7) - 0.5) * 0.045;
    const shY = height * clamp(0.66 + obShift + facetStep, 0.50, 0.82);
    const crY = lerp(shY, height, 0.54 + 0.08 * hash2(i + seed, 11.2));

    basePts.push([ca * rb * 1.04, 0, sa * rb * 1.04]);
    waistPts.push([ca * rw + tipOffX * 0.14, height * waistRatio + obShift * height * 0.25, sa * rw + tipOffZ * 0.14]);
    shoulderPts.push([ca * rs + tipOffX * 0.36, shY, sa * rs + tipOffZ * 0.36]);
    crownPts.push([ca * rc + tipOffX * 0.76, crY, sa * rc + tipOffZ * 0.76]);
  }
  const tipPt = [tipOffX, height, tipOffZ];

  const pos = [];
  const uv = [];
  const col = [];
  const cTmp = new THREE.Color();

  function sampleCol(yNorm, facetBias) {
    if (yNorm < 0.55) cTmp.copy(colBase).lerp(colMid, smoothstep(0.0, 0.55, yNorm));
    else cTmp.copy(colMid).lerp(colTip, smoothstep(0.50, 1.0, yNorm));
    const lum = 1.0 + facetBias;
    return [clamp(cTmp.r * lum, 0, 1), clamp(cTmp.g * lum, 0, 1), clamp(cTmp.b * lum, 0, 1)];
  }

  function pushTri(a, b, c, ua, ub, uc, caRgb, cbRgb, ccRgb) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    col.push(
      caRgb[0], caRgb[1], caRgb[2],
      cbRgb[0], cbRgb[1], cbRgb[2],
      ccRgb[0], ccRgb[1], ccRgb[2]
    );
  }

  for (let i = 0; i < sides; i++) {
    const ni = (i + 1) % sides;
    const isChamfer = i % 2 === 1;
    // Chamfer strips catch brighter specular-like edge tone
    const fBias = isChamfer ? 0.08 : (hash2(i * 3.1, seed) - 0.5) * 0.09;
    const u0 = i / sides;
    const u1 = (i + 1) / sides;

    const b0 = basePts[i], b1 = basePts[ni];
    const w0 = waistPts[i], w1 = waistPts[ni];
    const s0 = shoulderPts[i], s1 = shoulderPts[ni];
    const k0 = crownPts[i], k1 = crownPts[ni];

    const cb0 = sampleCol(0.0, fBias), cb1 = sampleCol(0.0, fBias);
    const cw0 = sampleCol(w0[1] / height, fBias), cw1 = sampleCol(w1[1] / height, fBias);
    const cs0 = sampleCol(s0[1] / height, fBias + 0.02), cs1 = sampleCol(s1[1] / height, fBias + 0.02);
    const ck0 = sampleCol(k0[1] / height, fBias + 0.05), ck1 = sampleCol(k1[1] / height, fBias + 0.05);
    const ct = sampleCol(1.0, 0.08);

    // Lower shaft band
    pushTri(b0, b1, w0, [u0, 0], [u1, 0], [u0, 0.44], cb0, cb1, cw0);
    pushTri(b1, w1, w0, [u1, 0], [u1, 0.44], [u0, 0.44], cb1, cw1, cw0);
    // Upper tapered shaft band
    pushTri(w0, w1, s0, [u0, 0.44], [u1, 0.44], [u0, 0.72], cw0, cw1, cs0);
    pushTri(w1, s1, s0, [u1, 0.44], [u1, 0.72], [u0, 0.72], cw1, cs1, cs0);
    // Oblique crown bevel band
    pushTri(s0, s1, k0, [u0, 0.72], [u1, 0.72], [u0, 0.88], cs0, cs1, ck0);
    pushTri(s1, k1, k0, [u1, 0.72], [u1, 0.88], [u0, 0.88], cs1, ck1, ck0);
    // Razor-sharp asymmetric apex facet
    pushTri(k0, k1, tipPt, [u0, 0.88], [u1, 0.88], [(u0 + u1) * 0.5, 1.0], ck0, ck1, ct);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a razor-edged asymmetric ice splinter/thorn shard (碎冰棘片)
 * for clustering around the snow-rimmed base of every crystal formation.
 */
function createIceSplinterGeo(THREE, width, depth, height, seed = 1.0, opts = {}) {
  const colBase = new THREE.Color(opts.colBase != null ? opts.colBase : 0x7ad0f8);
  const colTip = new THREE.Color(opts.colTip != null ? opts.colTip : 0xf4fcff);

  // Asymmetric 5-sided diamond blade cross-section
  const profile = [
    [width * 0.55, 0],
    [width * 0.14, -depth * 0.52],
    [-width * 0.48, -depth * 0.24],
    [-width * 0.44, depth * 0.34],
    [width * 0.12, depth * 0.50],
  ];
  const n = profile.length;
  const midY = height * (0.52 + 0.14 * hash2(seed, 3.1));
  const skewX = (hash2(seed, 7.2) - 0.5) * width * 0.55;
  const skewZ = (hash2(seed, 5.4) - 0.5) * depth * 0.4;

  const basePts = profile.map(([x, z]) => [x, 0, z]);
  const midPts = profile.map(([x, z], idx) => [
    x * 0.68 + skewX * 0.45,
    midY + (idx === 0 ? height * 0.10 : idx === 2 ? -height * 0.08 : 0),
    z * 0.68 + skewZ * 0.45,
  ]);
  const tipPt = [skewX, height, skewZ];

  const pos = [];
  const uv = [];
  const col = [];
  const cMid = colBase.clone().lerp(colTip, 0.58);

  function pushT(a, b, c, ca, cb, cc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(0, 0, 1, 0, 0.5, 1);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    pushT(basePts[i], basePts[ni], midPts[i], colBase, colBase, cMid);
    pushT(basePts[ni], midPts[ni], midPts[i], colBase, cMid, cMid);
    pushT(midPts[i], midPts[ni], tipPt, cMid, cMid, colTip);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a sculpted wind-rippled undulating snow-drift collar around crystal bases
 * (replaces the crude 9-sided cylinder frustum!).
 */
function createSculptedSnowCollarGeo(THREE, innerR, outerR, height, seed = 1.0) {
  const radSegs = 28;
  const ringSegs = 6;
  const stride = radSegs + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const cShadow = new THREE.Color(0xb2d7f4);
  const cMid = new THREE.Color(0xe6f4ff);
  const cCrest = new THREE.Color(0xffffff);
  const tmp = new THREE.Color();

  for (let j = 0; j <= ringSegs; j++) {
    const v = j / ringSegs; // 0 = inner root recess -> 1 = feathered ground outer skirt
    for (let i = 0; i <= radSegs; i++) {
      const u = i / radSegs;
      const theta = u * Math.PI * 2;
      const ca = Math.cos(theta);
      const sa = -Math.sin(theta);

      // Asymmetric organic wind-carved perimeter & crest ripples
      const lobing =
        1.0 +
        0.16 * Math.sin(theta * 3.0 + seed * 1.7) +
        0.10 * Math.cos(theta * 5.0 - seed * 2.3) +
        0.05 * Math.sin(theta * 8.0 + seed);
      const r = lerp(innerR * (0.88 + 0.14 * lobing), outerR * lobing, Math.pow(v, 0.92));

      // Pillow drift profile: dipped slightly at crystal root, rising to wind-carved crest at v≈0.34, tapering to snow ground
      const crestCurve = Math.sin(Math.pow(clamp(v, 0, 1), 0.72) * Math.PI);
      const ripple = 1.0 + 0.24 * Math.sin(theta * 3.0 + seed * 2.1) + 0.14 * Math.cos(theta * 6.0 - seed);
      const windPile = 1.0 + 0.22 * Math.cos(theta - 0.7 + seed * 0.4);
      const y = height * crestCurve * ripple * windPile * (1.0 - 0.12 * (1.0 - v)) - (j === ringSegs ? 0.05 : 0);

      positions.push(ca * r, y, sa * r);
      uvs.push(u * 2.0, v);

      // Cool icy ambient occlusion inside root collar -> pure sunlit snow along drift crest
      const crestLit = smoothstep(0.08, 0.75, crestCurve * ripple);
      tmp.copy(cShadow).lerp(cMid, smoothstep(0.05, 0.55, v));
      tmp.lerp(cCrest, crestLit * 0.78);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let j = 0; j < ringSegs; j++) {
    for (let i = 0; i < radSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      // Moving along +theta (CCW from +Y) x +r (outward) => (a, c, b) faces UP (+Y)
      indices.push(a, c, b);
      indices.push(b, c, d);
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
 * Builds a bevelled chamfered ashlar stone block (replaces hard 90-degree BoxGeometries)
 * with subtle weathered edge perturbation and mortar-edge vertex AO.
 */
function createBevelledStoneBlockGeo(THREE, w, h, d, bevel = 0.05, seed = 1.0, opts = {}) {
  const bv = Math.min(bevel, w * 0.28, h * 0.28, d * 0.28);
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  const chip = opts.chip || 0.015;
  const topScale = opts.topScale != null ? opts.topScale : 1.0;

  // 4 height rings forming chamfered bottom, lower body, upper body, chamfered top
  const ringsY = [-hh, -hh + bv, hh - bv, hh];
  const ringsInset = [bv, 0, 0, bv];
  const ringsScale = [1.0, 1.0, lerp(1.0, topScale, 0.85), topScale];

  // 8-point chamfered rectangle perimeter (CCW from +Y: x = +, z = - first)
  function makeRectRing(y, inset, sc, rIdx) {
    const xOut = Math.max(0.01, (hw - inset) * sc);
    const zOut = Math.max(0.01, (hd - inset) * sc);
    const xIn = Math.max(0.005, xOut - bv * 0.82);
    const zIn = Math.max(0.005, zOut - bv * 0.82);
    const raw = [
      [xOut, zIn],
      [xOut, -zIn],
      [xIn, -zOut],
      [-xIn, -zOut],
      [-xOut, -zIn],
      [-xOut, zIn],
      [-xIn, zOut],
      [xIn, zOut],
    ];
    return raw.map(([px, pz], idx) => {
      const jx = chip ? (hash2(idx * 3.1 + seed, rIdx * 5.7) - 0.5) * chip : 0;
      const jy = chip ? (hash2(rIdx * 4.3, idx * 2.9 + seed) - 0.5) * chip * 0.7 : 0;
      const jz = chip ? (hash2(idx * 7.3 + rIdx, seed * 2.1) - 0.5) * chip : 0;
      return [px + jx, y + jy, pz + jz];
    });
  }

  const rings = ringsY.map((y, idx) => makeRectRing(y, ringsInset[idx], ringsScale[idx], idx));
  const segs = 8;
  const pos = [];
  const uv = [];
  const col = [];
  const cDark = new THREE.Color(opts.colDark != null ? opts.colDark : 0xb8c8d8);
  const cLit = new THREE.Color(opts.colLit != null ? opts.colLit : 0xf4f8fc);
  const cTmp = new THREE.Color();

  function pushT(a, b, c, ca, cb, cc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(a[0] * 0.6 + 0.5, a[1] * 0.6 + 0.5, b[0] * 0.6 + 0.5, b[1] * 0.6 + 0.5, c[0] * 0.6 + 0.5, c[1] * 0.6 + 0.5);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  for (let r = 0; r < rings.length - 1; r++) {
    const r0 = rings[r];
    const r1 = rings[r + 1];
    const ca = cDark.clone().lerp(cLit, r / 3);
    const cb = cDark.clone().lerp(cLit, (r + 1) / 3);
    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      pushT(r0[i], r0[ni], r1[i], ca, ca, cb);
      pushT(r0[ni], r1[ni], r1[i], ca, cb, cb);
    }
  }

  // Top cap (+Y)
  const topCenter = [0, hh, 0];
  const topRing = rings[rings.length - 1];
  for (let i = 0; i < segs; i++) {
    const ni = (i + 1) % segs;
    pushT(topCenter, topRing[i], topRing[ni], cLit, cLit, cLit);
  }

  // Bottom cap (-Y)
  const botCenter = [0, -hh, 0];
  const botRing = rings[0];
  cTmp.copy(cDark).multiplyScalar(0.84);
  for (let i = 0; i < segs; i++) {
    const ni = (i + 1) % segs;
    pushT(botCenter, botRing[ni], botRing[i], cTmp, cTmp, cTmp);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a genuine radial Trapezoidal Wedge Voussoir (梯形楔石) for the Gothic arch:
 * - Narrower inner intrados arc width, wider outer extrados arc width
 * - Stepped outer archivolt hood moulding & underside Gothic moulded rib
 * - Optional weathered erosion notch, diagonal fractured break-end, or proud Gothic keystone crest
 * Local coordinates: X = radial outward (+X = extrados), Y = tangential along arch, Z = arch depth
 */
function createTrapezoidalVoussoirGeo(THREE, opts = {}) {
  const {
    radHeight = 0.68,
    wInner = 0.34,
    wOuter = 0.56,
    depth = 1.04,
    bevel = 0.045,
    weatheredNotch = false,
    fracturedEnd = false,
    isKeystone = false,
    seed = 1.0,
  } = opts;

  const hHalf = radHeight * 0.5;
  const hd = depth * 0.5;
  const hwIn = wInner * 0.5;
  const hwOut = wOuter * 0.5;

  // Build trapezoidal profile across 4 Z slices (front bevel -> front face -> back face -> back bevel)
  const zVals = [-hd, -hd + bevel, hd - bevel, hd];
  const zInset = [bevel * 0.85, 0, 0, bevel * 0.85];

  // 8-vertex chamfered trapezoid loop in XY (CCW when viewed from +Z!)
  function makeTrapLoop(z, ins) {
    const xIn = -hHalf + ins + (isKeystone ? -0.10 : 0);
    const xOut = hHalf - ins + (isKeystone ? 0.14 : 0);
    const yIn = Math.max(0.04, hwIn - ins * 0.7);
    const yOut = Math.max(0.06, hwOut - ins * 0.7) * (isKeystone ? 1.18 : 1.0);
    const bCorner = bevel * 0.72;

    // 8 points CCW in XY plane: bottom-left(inner,-Y) -> bottom-right(outer,-Y) -> top-right(outer,+Y) -> top-left(inner,+Y)
    const pts = [
      [xIn + bCorner, -yIn],
      [xOut - bCorner, -yOut],
      [xOut, -yOut + bCorner],
      [xOut, yOut - bCorner],
      [xOut - bCorner, yOut],
      [xIn + bCorner, yIn],
      [xIn, yIn - bCorner],
      [xIn, -yIn + bCorner],
    ];

    return pts.map(([px, py], idx) => {
      let nx = px;
      let ny = py;
      // Weathered erosion chip notch on one outer shoulder
      if (weatheredNotch && (idx === 3 || idx === 4) && z > 0) {
        nx -= 0.11;
        ny -= 0.08;
      }
      // Diagonal jagged fracture break on the snapped arch end stone
      if (fracturedEnd && py > 0) {
        ny *= idx === 3 || idx === 4 ? 0.35 : 0.68;
        nx += (idx % 2 === 0 ? -0.06 : 0.05);
      }
      const jitter = (hash2(idx * 3.7 + seed, z * 4.1) - 0.5) * 0.018;
      return [nx + jitter, ny + jitter, z];
    });
  }

  const slices = zVals.map((z, idx) => makeTrapLoop(z, zInset[idx]));
  const n = 8;
  const pos = [];
  const uv = [];
  const col = [];
  const cMortar = new THREE.Color(0xb2c3d6);
  const cFace = new THREE.Color(0xf4f8fc);
  const cCrest = new THREE.Color(0xffffff);

  function pushT(a, b, c, ca, cb, cc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(a[0] + 0.5, a[1] + 0.5, b[0] + 0.5, b[1] + 0.5, c[0] + 0.5, c[1] + 0.5);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  // Side strips between Z slices: moving +i is CCW in XY, moving +s is +Z.
  // Tangent along +i is tangent CCW; tangent along +s is +Z. (CCW x +Z) points OUTWARD!
  for (let s = 0; s < slices.length - 1; s++) {
    const l0 = slices[s];
    const l1 = slices[s + 1];
    const cA = s === 0 || s === 2 ? cMortar : cFace;
    const cB = s + 1 === 3 ? cMortar : cFace;
    for (let i = 0; i < n; i++) {
      const ni = (i + 1) % n;
      pushT(l0[i], l0[ni], l1[i], cA, cA, cB);
      pushT(l0[ni], l1[ni], l1[i], cA, cB, cB);
    }
  }

  // Front face (+Z, slice 3): CCW in XY => (center, i, ni) faces +Z
  const frontC = [0, 0, hd];
  const fLoop = slices[slices.length - 1];
  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    pushT(frontC, fLoop[i], fLoop[ni], isKeystone ? cCrest : cFace, cFace, cFace);
  }

  // Back face (-Z, slice 0): CW in XY => (center, ni, i) faces -Z
  const backC = [0, 0, -hd];
  const bLoop = slices[0];
  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    pushT(backC, bLoop[ni], bLoop[i], cMortar, cMortar, cMortar);
  }

  const mainGeo = new THREE.BufferGeometry();
  mainGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  mainGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  mainGeo.computeVertexNormals();

  // Add subtle stepped Gothic archivolt outer hood rib & inner soffit rib
  const parts = [mainGeo];
  const innerRib = createBevelledStoneBlockGeo(THREE, 0.14, wInner * 0.94, depth * 0.42, 0.025, seed + 1.1, {
    chip: 0.008,
    colDark: 0xaabed4,
    colLit: 0xeaf2fa,
  });
  innerRib.translate(-hHalf - 0.04, 0, 0);
  parts.push(innerRib);

  if (!fracturedEnd) {
    const outerHood = createBevelledStoneBlockGeo(THREE, 0.12, wOuter * 0.96, depth * 1.12, 0.028, seed + 2.3, {
      chip: 0.01,
      colDark: 0xc2d2e2,
      colLit: 0xf8fbff,
    });
    outerHood.translate(hHalf + 0.04 + (isKeystone ? 0.14 : 0), 0, 0);
    parts.push(outerHood);
  }

  return mergeGeometries(THREE, parts);
}

/**
 * Builds an ornate multi-tier carved Gothic bell capital (雕花柱头线条):
 * - Octagonal astragal necking ring
 * - Flared concave carved bell core ringed with 8 sculpted acanthus/frost-leaf crocket ribs
 * - Double-stepped bevelled abacus cornice slab
 */
function createGothicCapitalGeo(THREE) {
  const parts = [];

  // 1. Astragal necking moulding ring
  const neck = new THREE.CylinderGeometry(0.76, 0.72, 0.11, 12);
  neck.translate(0, -0.18, 0);
  setUniformVertexColor(THREE, neck, 0xd8e4f0, 0.03);
  parts.push(neck);

  // 2. Concave flared Gothic bell body (Lathe profile)
  const bellPts = [
    new THREE.Vector2(0.64, -0.14),
    new THREE.Vector2(0.68, -0.02),
    new THREE.Vector2(0.76, 0.09),
    new THREE.Vector2(0.88, 0.19),
    new THREE.Vector2(0.94, 0.25),
  ];
  const bell = new THREE.LatheGeometry(bellPts, 12);
  setUniformVertexColor(THREE, bell, 0xe8f0f8, 0.03);
  parts.push(bell);

  // 3. 8 Sculpted Gothic acanthus/frost-leaf crocket ribs curling up to corners & mid-faces
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI * 0.125;
    const isCorner = i % 2 === 0;
    const reach = isCorner ? 0.96 : 0.84;
    const ca = Math.cos(ang);
    const sa = -Math.sin(ang);
    const rib = createCurvedBranchTube(
      THREE,
      [
        [ca * 0.64, -0.14, sa * 0.64],
        [ca * (reach * 0.82), 0.02, sa * (reach * 0.82)],
        [ca * reach, 0.16, sa * reach],
        [ca * (reach * 0.94), 0.23, sa * (reach * 0.94)],
      ],
      [0.068, 0.078, 0.088, 0.056],
      6,
      (vf, _th, _pt, out) => {
        out.setHex(0xd2e0ee).lerp(new THREE.Color(0xffffff), vf * 0.75);
      },
      { capEnd: true }
    );
    parts.push(rib);
  }

  // 4. Lower moulded cornice & stepped upper bevelled abacus slab
  const lowerAbacus = createBevelledStoneBlockGeo(THREE, 1.54, 0.14, 1.48, 0.04, 2.7, {
    topScale: 1.06,
    chip: 0.01,
    colDark: 0xc2d3e4,
    colLit: 0xf4f9ff,
  });
  lowerAbacus.translate(0, 0.28, 0);
  parts.push(lowerAbacus);

  const upperAbacus = createBevelledStoneBlockGeo(THREE, 1.72, 0.16, 1.64, 0.045, 5.1, {
    topScale: 0.97,
    chip: 0.012,
    colDark: 0xcad9e8,
    colLit: 0xffffff,
  });
  upperAbacus.translate(0, 0.41, 0);
  parts.push(upperAbacus);

  return mergeGeometries(THREE, parts);
}

/**
 * Builds a chiseled weathered standing stone monolith (削面风化石碑) with
 * bevelled faceted edges, oblique weathered gable crown, shoulder erosion clefts,
 * and a sunken front engraving border frame.
 */
function createSculptedMenhirGeo(THREE, seed = 1.0) {
  const radSegs = 10;
  const hSegs = 8;
  const height = 2.52;
  const pos = [];
  const uv = [];
  const col = [];
  const cBase = new THREE.Color(0x98aec4);
  const cMid = new THREE.Color(0xd8e4f0);
  const cCrown = new THREE.Color(0xf0f6fc);
  const cGroove = new THREE.Color(0x7088a2);
  const tmp = new THREE.Color();

  // Base flattened octagonal tablet perimeter
  const baseAngles = [];
  for (let i = 0; i < radSegs; i++) {
    baseAngles.push((i / radSegs) * Math.PI * 2);
  }

  const rings = [];
  for (let j = 0; j <= hSegs; j++) {
    const v = j / hSegs;
    const ring = [];
    // Taper gently upward, flare slightly at snow-buried base
    const wScale = v < 0.15 ? lerp(1.18, 1.0, v / 0.15) : lerp(1.0, 0.56, Math.pow((v - 0.15) / 0.85, 1.15));
    const dScale = lerp(1.08, 0.52, Math.pow(v, 1.08));

    for (let i = 0; i < radSegs; i++) {
      const th = baseAngles[i];
      const ca = Math.cos(th);
      const sa = -Math.sin(th); // Note: +Z front face corresponds to sa > 0 => theta around 3pi/2
      let rx = 0.48 * wScale;
      let rz = 0.28 * dScale;

      // Chiseled flat front/back faces & shoulder weathering notch
      const frontFlatten = Math.abs(sa) > 0.65 ? 0.84 : 1.0;
      rz *= frontFlatten;

      // Weathering cleft notch on left shoulder around v ≈ 0.65
      if (v > 0.52 && v < 0.78 && ca < -0.55) {
        rx *= 0.84;
      }

      // Shallow recessed engraving tablet channel on the +Z front center
      const isFrontTablet = sa > 0.72 && Math.abs(ca) < 0.45 && v > 0.18 && v < 0.84;
      if (isFrontTablet) {
        rz *= 0.86;
      }

      const chiselNoise = (hash2(i * 3.1 + seed, j * 4.7) - 0.5) * 0.038;
      // Asymmetric slanted gable crown at top rings
      const gableSlope = v > 0.72 ? (ca * 0.16 + 0.04) * smoothstep(0.72, 1.0, v) : 0;
      const py = v * height + gableSlope + chiselNoise * 0.5;
      const px = ca * rx + chiselNoise;
      const pz = sa * rz + chiselNoise * 0.5;

      tmp.copy(cBase).lerp(cMid, smoothstep(0.05, 0.62, v));
      if (v > 0.62) tmp.lerp(cCrown, smoothstep(0.62, 1.0, v) * 0.7);
      if (isFrontTablet) tmp.lerp(cGroove, 0.55);
      ring.push({ p: [px, py, pz], c: [tmp.r, tmp.g, tmp.b] });
    }
    rings.push(ring);
  }

  function pushT(a, b, c) {
    pos.push(a.p[0], a.p[1], a.p[2], b.p[0], b.p[1], b.p[2], c.p[0], c.p[1], c.p[2]);
    uv.push(a.p[0] + 0.5, a.p[1] * 0.4, b.p[0] + 0.5, b.p[1] * 0.4, c.p[0] + 0.5, c.p[1] * 0.4);
    col.push(a.c[0], a.c[1], a.c[2], b.c[0], b.c[1], b.c[2], c.c[0], c.c[1], c.c[2]);
  }

  for (let j = 0; j < hSegs; j++) {
    for (let i = 0; i < radSegs; i++) {
      const ni = (i + 1) % radSegs;
      pushT(rings[j][i], rings[j][ni], rings[j + 1][i]);
      pushT(rings[j][ni], rings[j + 1][ni], rings[j + 1][i]);
    }
  }

  // Chiseled gable crown peak closing the top
  const peakPt = { p: [0.06, height + 0.24, -0.01], c: [cCrown.r, cCrown.g, cCrown.b] };
  const topRing = rings[hSegs];
  for (let i = 0; i < radSegs; i++) {
    const ni = (i + 1) % radSegs;
    pushT(topRing[i], topRing[ni], peakPt);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds intricate carved Nordic/Arcane frost-rune engraving strokes tucked flush
 * into the recessed front tablet of a standing stone (凹槽发光符文刻线).
 */
function createMenhirRuneGeo(THREE) {
  const parts = [];
  const pushStroke = (x0, y0, x1, y1, w = 0.032, zOff = 0.215) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return;
    const g = new THREE.BoxGeometry(w, len, 0.026);
    g.rotateZ(Math.atan2(dy, dx) - Math.PI * 0.5);
    g.translate((x0 + x1) * 0.5, (y0 + y1) * 0.5, zOff);
    parts.push(g);
  };

  // Central arcane frost stave
  pushStroke(0, 0.62, 0, 2.02, 0.036, 0.215);
  // Upper diamond star crest
  pushStroke(0, 2.18, 0.14, 1.96, 0.028, 0.195);
  pushStroke(0.14, 1.96, 0, 1.74, 0.028, 0.205);
  pushStroke(0, 1.74, -0.14, 1.96, 0.028, 0.205);
  pushStroke(-0.14, 1.96, 0, 2.18, 0.028, 0.195);
  // Mid Nordic wing chevrons
  pushStroke(0, 1.56, 0.16, 1.70, 0.026, 0.210);
  pushStroke(0, 1.56, -0.16, 1.70, 0.026, 0.210);
  pushStroke(0, 1.28, 0.15, 1.14, 0.026, 0.220);
  pushStroke(0, 1.28, -0.15, 1.14, 0.026, 0.220);
  // Lower frost-crystal cross-glyph
  pushStroke(-0.12, 0.88, 0.12, 0.88, 0.024, 0.232);
  pushStroke(0, 0.72, 0.11, 0.62, 0.022, 0.236);
  pushStroke(0, 0.72, -0.11, 0.62, 0.022, 0.236);

  return mergeGeometries(THREE, parts);
}

/**
 * Builds an organic form-fitting snow crown hugging the asymmetric oblique gable
 * peak of a standing stone (雕塑自然贴合雪冠).
 */
function createMenhirSnowCapGeo(THREE, seed = 1.0) {
  const radSegs = 16;
  const ringSegs = 5;
  const stride = radSegs + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const cEdge = new THREE.Color(0xc2dff6);
  const cTop = new THREE.Color(0xffffff);
  const tmp = new THREE.Color();

  for (let j = 0; j <= ringSegs; j++) {
    const v = j / ringSegs; // 0 = summit crest, 1 = overhanging snow lip
    for (let i = 0; i <= radSegs; i++) {
      const u = i / radSegs;
      const th = u * Math.PI * 2;
      const ca = Math.cos(th);
      const sa = -Math.sin(th);
      const scallop = 1.0 + 0.14 * Math.sin(th * 4.0 + seed) + 0.08 * Math.cos(th * 7.0 - seed);
      const rx = 0.34 * v * scallop;
      const rz = 0.21 * v * scallop;
      const gableY = ca * 0.12 * v;
      const domeY = Math.cos(v * Math.PI * 0.52) * 0.26;
      const lipCurl = j === ringSegs ? -0.05 : 0;

      positions.push(0.05 + ca * rx, 2.50 + domeY + gableY + lipCurl, sa * rz);
      uvs.push(u, v);

      tmp.copy(cTop).lerp(cEdge, smoothstep(0.45, 1.0, v));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let j = 0; j < ringSegs; j++) {
    for (let i = 0; i < radSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
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
 * Builds an elongated 12-facet bevelled bipyramidal arcane crystal gem
 * (for the floating double-layer streetlamp crystal cores).
 */
function createArcaneGemGeo(THREE, radius, halfHeight, opts = {}) {
  const nFaces = 6;
  const bevelFrac = 0.18;
  const colMid = new THREE.Color(opts.colMid != null ? opts.colMid : 0x7ef2ff);
  const colTip = new THREE.Color(opts.colTip != null ? opts.colTip : 0xf4fcff);
  const colBot = new THREE.Color(opts.colBot != null ? opts.colBot : 0xb8a2ff);

  const angles = [];
  const step = (Math.PI * 2) / nFaces;
  for (let f = 0; f < nFaces; f++) {
    const fc = f * step;
    const hb = step * bevelFrac * 0.5;
    angles.push(fc - step * 0.5 + hb, fc + step * 0.5 - hb);
  }
  const sides = angles.length;

  const topTip = [0, halfHeight, 0];
  const botTip = [0, -halfHeight * 0.92, 0];
  const upperGirdle = [];
  const lowerGirdle = [];
  const upperCrown = [];
  const lowerCrown = [];

  for (let i = 0; i < sides; i++) {
    const th = angles[i];
    const ca = Math.cos(th);
    const sa = -Math.sin(th);
    const r = radius * (i % 2 === 0 ? 1.0 : 0.97);
    upperGirdle.push([ca * r, halfHeight * 0.16, sa * r]);
    lowerGirdle.push([ca * r * 0.96, -halfHeight * 0.14, sa * r * 0.96]);
    upperCrown.push([ca * r * 0.58, halfHeight * 0.62, sa * r * 0.58]);
    lowerCrown.push([ca * r * 0.54, -halfHeight * 0.56, sa * r * 0.54]);
  }

  const pos = [];
  const uv = [];
  const col = [];
  const pushT = (a, b, c, ca, cb, cc) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(0, 0, 1, 0, 0.5, 1);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  };

  for (let i = 0; i < sides; i++) {
    const ni = (i + 1) % sides;
    // Waist girdle band
    pushT(lowerGirdle[i], lowerGirdle[ni], upperGirdle[i], colBot, colBot, colMid);
    pushT(lowerGirdle[ni], upperGirdle[ni], upperGirdle[i], colBot, colMid, colMid);
    // Upper crown bevel & spire
    pushT(upperGirdle[i], upperGirdle[ni], upperCrown[i], colMid, colMid, colTip);
    pushT(upperGirdle[ni], upperCrown[ni], upperCrown[i], colMid, colTip, colTip);
    pushT(upperCrown[i], upperCrown[ni], topTip, colTip, colTip, colTip);
    // Lower pavilion bevel & point (reversed winding for downward faces)
    pushT(lowerCrown[i], lowerCrown[ni], lowerGirdle[i], colBot, colBot, colMid);
    pushT(lowerCrown[ni], lowerGirdle[ni], lowerGirdle[i], colBot, colMid, colMid);
    pushT(lowerCrown[ni], lowerCrown[i], botTip, colBot, colBot, colBot);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds all shared AAA geometries for the 4 Floating Luminous Crystal Streetlamps:
 * - pedGeo: stepped octagonal carved stone base + fluted column shaft + bevelled capital table
 * - ironCageGeo: Gothic open-work wrought-iron curved S-ogee lantern cage + lower scroll volutes + lancet tracery
 * - roofGeo: graceful concave upturned-eave pagoda-Gothic lantern hat (覆雪翘檐灯帽)
 * - roofSnowGeo: sculpted plush snow blanket hugging the upturned eaves + base snow collar
 * - goldTrimGeo: champagne-gold inlaid collars & slender crown spire finial
 * - icicleGeo: 4 delicate miniature icicles hanging from the 4 upturned lantern eave corners
 * - coreInnerGeo / coreOuterGeo: 12-facet bevelled bipyramidal dual-layer arcane crystal gem
 */
function buildLanternGeometries(THREE) {
  // 1. Stepped carved octagonal stone pedestal (y = 0..1.20)
  const pedParts = [];
  const step1 = new THREE.CylinderGeometry(0.40, 0.47, 0.18, 8);
  step1.translate(0, 0.09, 0);
  setUniformVertexColor(THREE, step1, 0xcad8e6, 0.03);
  pedParts.push(step1);

  const step2 = new THREE.CylinderGeometry(0.31, 0.37, 0.18, 8);
  step2.translate(0, 0.27, 0);
  setUniformVertexColor(THREE, step2, 0xd8e4f0, 0.03);
  pedParts.push(step2);

  // Fluted carved stone shaft with 8 subtle vertical ribs
  const shaft = new THREE.CylinderGeometry(0.185, 0.23, 0.68, 8, 2);
  shaft.translate(0, 0.69, 0);
  setUniformVertexColor(THREE, shaft, 0xe2ecf6, 0.03);
  pedParts.push(shaft);

  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
    const pil = new THREE.CylinderGeometry(0.036, 0.044, 0.66, 6);
    pil.translate(Math.cos(ang) * 0.20, 0.69, -Math.sin(ang) * 0.20);
    setUniformVertexColor(THREE, pil, 0xf0f6fc, 0.02);
    pedParts.push(pil);
  }

  // Moulded flared octagonal capital table
  const capBell = new THREE.CylinderGeometry(0.35, 0.20, 0.14, 8);
  capBell.translate(0, 1.09, 0);
  setUniformVertexColor(THREE, capBell, 0xe8f2fa, 0.02);
  pedParts.push(capBell);

  const capSlab = new THREE.CylinderGeometry(0.38, 0.35, 0.08, 8);
  capSlab.translate(0, 1.19, 0);
  setUniformVertexColor(THREE, capSlab, 0xf6fbff, 0.02);
  pedParts.push(capSlab);

  const pedGeo = mergeGeometries(THREE, pedParts);

  // 2. Gothic open-work wrought-iron curved S-ogee lantern cage (y = 1.22..2.30)
  const ironParts = [];
  const cIronDark = new THREE.Color(0x3a4658);
  const cIronEdge = new THREE.Color(0x6c7e96);

  // Lower & upper octagonal wrought-iron gallery collars
  const lowerRing = new THREE.TorusGeometry(0.31, 0.028, 6, 16);
  lowerRing.rotateX(Math.PI * 0.5);
  lowerRing.translate(0, 1.25, 0);
  setUniformVertexColor(THREE, lowerRing, 0x4b596d, 0.04);
  ironParts.push(lowerRing);

  const upperRing = new THREE.TorusGeometry(0.33, 0.028, 6, 16);
  upperRing.rotateX(Math.PI * 0.5);
  upperRing.translate(0, 2.22, 0);
  setUniformVertexColor(THREE, upperRing, 0x526278, 0.04);
  ironParts.push(upperRing);

  // 4 Sweeping curved S-ogee iron cage struts + lower scroll volutes + upper Gothic pointed lancet arches
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
    const ca = Math.cos(ang);
    const sa = -Math.sin(ang);

    // Main curved ogee corner rib sweeping gracefully outward around the floating crystal
    const ribPts = [
      [ca * 0.30, 1.23, sa * 0.30],
      [ca * 0.39, 1.44, sa * 0.39],
      [ca * 0.43, 1.72, sa * 0.43],
      [ca * 0.39, 2.02, sa * 0.39],
      [ca * 0.32, 2.24, sa * 0.32],
    ];
    ironParts.push(
      createCurvedBranchTube(
        THREE,
        ribPts,
        [0.028, 0.024, 0.022, 0.024, 0.028],
        6,
        (vf, _th, _pt, out) => out.copy(cIronDark).lerp(cIronEdge, Math.sin(vf * Math.PI) * 0.65),
        { capEnd: true }
      )
    );

    // Delicate outward-curling wrought-iron scroll volute anchoring each rib onto the stone capital
    const scrollPts = [
      [ca * 0.38, 1.42, sa * 0.38],
      [ca * 0.47, 1.32, sa * 0.47],
      [ca * 0.44, 1.21, sa * 0.44],
      [ca * 0.34, 1.20, sa * 0.34],
    ];
    ironParts.push(
      createCurvedBranchTube(
        THREE,
        scrollPts,
        [0.018, 0.017, 0.016, 0.015],
        5,
        (_vf, _th, _pt, out) => out.copy(cIronEdge),
        { capEnd: true }
      )
    );

    // Gothic pointed lancet tracery arch connecting adjacent ribs at the upper gallery
    const nextAng = ((k + 1) / 4) * Math.PI * 2 + Math.PI * 0.25;
    const midAng = (ang + nextAng) * 0.5;
    const nca = Math.cos(nextAng);
    const nsa = -Math.sin(nextAng);
    const mca = Math.cos(midAng);
    const msa = -Math.sin(midAng);
    const archPts = [
      [ca * 0.37, 1.98, sa * 0.37],
      [lerp(ca, mca, 0.55) * 0.37, 2.13, lerp(sa, msa, 0.55) * 0.37],
      [mca * 0.34, 2.21, msa * 0.34],
      [lerp(nca, mca, 0.55) * 0.37, 2.13, lerp(nsa, msa, 0.55) * 0.37],
      [nca * 0.37, 1.98, nsa * 0.37],
    ];
    ironParts.push(
      createCurvedBranchTube(
        THREE,
        archPts,
        [0.015, 0.015, 0.016, 0.015, 0.015],
        5,
        (_vf, _th, _pt, out) => out.copy(cIronEdge),
        { capEnd: false }
      )
    );
  }

  const ironCageGeo = mergeGeometries(THREE, ironParts);

  // 3. Concave Upturned-Eave Pagoda-Gothic Lantern Hat (覆雪翘檐灯帽, y = 2.22..2.72)
  function buildUpturnedRoof(isSnow) {
    const sides = 8; // 4 flared corners + 4 mid-eaves
    const rings = 5;
    const stride = sides + 1;
    const positions = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    const cEdge = new THREE.Color(isSnow ? 0xc8e4f8 : 0x3b485b);
    const cMid = new THREE.Color(isSnow ? 0xf2faff : 0x5c6e85);
    const cApex = new THREE.Color(isSnow ? 0xffffff : 0x7b8ea8);
    const tmp = new THREE.Color();

    for (let j = 0; j <= rings; j++) {
      const v = j / rings; // 0 = outer upturned eave -> 1 = spire peak
      for (let i = 0; i <= sides; i++) {
        const u = i / sides;
        const th = u * Math.PI * 2 + Math.PI * 0.25;
        const isCorner = i % 2 === 0;
        const cornerFlare = isCorner ? 1.24 : 0.94;
        const baseR = lerp(isSnow ? 0.49 : 0.51, 0.04, Math.pow(v, 0.80)) * lerp(cornerFlare, 1.0, v * 0.82);

        // Graceful upturned-eave scoop curve (high flare at corner eaves v=0, sweeping steeply to apex)
        const eaveLift = isCorner ? Math.pow(1.0 - v, 2.4) * 0.11 : Math.pow(1.0 - v, 2.2) * 0.03;
        const concaveRise = Math.pow(v, 1.22) * 0.46;
        const y = 2.24 + concaveRise + eaveLift + (isSnow ? 0.048 * (1.0 - v * 0.35) + (j === 0 ? -0.02 : 0.02 * Math.sin(v * Math.PI)) : 0);

        positions.push(Math.cos(th) * baseR, y, -Math.sin(th) * baseR);
        uvs.push(u * 2.0, v);

        tmp.copy(cEdge).lerp(cMid, smoothstep(0.05, 0.65, v));
        if (isCorner || v > 0.6) tmp.lerp(cApex, 0.45);
        colors.push(tmp.r, tmp.g, tmp.b);
      }
    }

    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < sides; i++) {
        const a = j * stride + i;
        const b = a + 1;
        const c = (j + 1) * stride + i;
        const d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  const roofGeo = buildUpturnedRoof(false);
  const roofSnowTop = buildUpturnedRoof(true);
  const baseSnowDrift = createSculptedSnowCollarGeo(THREE, 0.34, 0.62, 0.16, 4.7);
  baseSnowDrift.translate(0, 0.02, 0);
  const roofSnowGeo = mergeGeometries(THREE, [roofSnowTop, baseSnowDrift]);

  // 4. Champagne-gold filigree collars & slender diamond crown spire finial
  const goldParts = [];
  const pedGoldRing = new THREE.TorusGeometry(0.24, 0.020, 6, 16);
  pedGoldRing.rotateX(Math.PI * 0.5);
  pedGoldRing.translate(0, 1.03, 0);
  goldParts.push(pedGoldRing);

  const finialStem = new THREE.CylinderGeometry(0.018, 0.042, 0.24, 6);
  finialStem.translate(0, 2.82, 0);
  goldParts.push(finialStem);

  const finialGem = new THREE.OctahedronGeometry(0.068, 0);
  finialGem.scale(0.85, 1.45, 0.85);
  finialGem.translate(0, 2.98, 0);
  goldParts.push(finialGem);

  const goldTrimGeo = mergeGeometries(THREE, goldParts);

  // 5. 4 Tiny crystal icicles hanging from the 4 upturned lantern eave corners
  const icicleParts = [];
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
    const ic = new THREE.ConeGeometry(0.022, 0.18 + (k % 2) * 0.05, 5);
    ic.rotateX(Math.PI);
    ic.translate(Math.cos(ang) * 0.56, 2.24, -Math.sin(ang) * 0.56);
    setUniformVertexColor(THREE, ic, 0xd8f8ff, 0.04);
    icicleParts.push(ic);
  }
  const icicleGeo = mergeGeometries(THREE, icicleParts);

  // 6. Dual-layer polyhedral bipyramidal arcane crystal gem
  const coreInnerGeo = createArcaneGemGeo(THREE, 0.17, 0.30, {
    colMid: 0x7ef2ff,
    colTip: 0xf4fcff,
    colBot: 0xbda4ff,
  });
  const coreOuterGeo = createArcaneGemGeo(THREE, 0.23, 0.38, {
    colMid: 0xc2f5ff,
    colTip: 0xffffff,
    colBot: 0x86d4f8,
  });

  return {
    pedGeo,
    ironCageGeo,
    roofGeo,
    roofSnowGeo,
    goldTrimGeo,
    icicleGeo,
    coreInnerGeo,
    coreOuterGeo,
  };
}

/**
 * Builds a hand-hewn bevelled antique flagstone or river stepping-stone slab
 * (replaces plain 7/8-sided cylinders).
 */
function createSculptedFlagstoneGeo(THREE, radius = 0.52, height = 0.09, seed = 1.0, isStepping = false) {
  const sides = 10;
  const radii = [];
  for (let i = 0; i < sides; i++) {
    radii.push(radius * (0.82 + 0.32 * hash2(i * 2.9 + seed, seed * 4.3)));
  }

  const bevelH = height * 0.34;
  const botRing = [];
  const midRing = [];
  const topRing = [];

  for (let i = 0; i < sides; i++) {
    const th = (i / sides) * Math.PI * 2;
    const ca = Math.cos(th);
    const sa = -Math.sin(th);
    const r = radii[i];
    const hVar = (hash2(i * 4.7, seed * 2.1) - 0.5) * height * 0.16;
    botRing.push([ca * r * 1.06, -height * 0.5, sa * r * 1.06]);
    midRing.push([ca * r, height * 0.5 - bevelH + hVar, sa * r]);
    topRing.push([ca * r * 0.86, height * 0.5 + hVar, sa * r * 0.86]);
  }

  const pos = [];
  const uv = [];
  const col = [];
  const cBot = new THREE.Color(isStepping ? 0x627a92 : 0xb2c6da);
  const cRim = new THREE.Color(isStepping ? 0xb4cadf : 0xd6e4f2);
  const cTop = new THREE.Color(isStepping ? 0xeaf4fc : 0xf4f9ff);

  const pushT = (a, b, c, ca, cb, cc) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(a[0] + 0.5, a[2] + 0.5, b[0] + 0.5, b[2] + 0.5, c[0] + 0.5, c[2] + 0.5);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  };

  for (let i = 0; i < sides; i++) {
    const ni = (i + 1) % sides;
    pushT(botRing[i], botRing[ni], midRing[i], cBot, cBot, cRim);
    pushT(botRing[ni], midRing[ni], midRing[i], cBot, cRim, cRim);
    pushT(midRing[i], midRing[ni], topRing[i], cRim, cRim, cTop);
    pushT(midRing[ni], topRing[ni], topRing[i], cRim, cTop, cTop);
  }

  // Slightly domed weathered top surface
  const topC = [0, height * 0.5 + height * 0.08, 0];
  for (let i = 0; i < sides; i++) {
    const ni = (i + 1) % sides;
    pushT(topC, topRing[i], topRing[ni], cTop, cTop, cTop);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a multi-faceted knife-edge ridge Alpine snow peak (多折面削脊阿尔卑斯雪峰)
 * with sharp glacial arêtes, concave cirque bowls, asymmetric summit horn,
 * and chiseled sapphire-rock cliff vs sunlit gold-white snow strata.
 */
function createAlpinePeakGeo(THREE, ms, seed, fogColorVec) {
  const radSegs = 18;
  const hSegs = 8;
  const stride = radSegs + 1;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const cPeakLit = new THREE.Color(0xf8fcff);
  const cPeakGold = new THREE.Color(0xfff3db);
  const cRockCliff = new THREE.Color(0x557da8);
  const cPeakShadow = new THREE.Color(0x82b0dc);
  const cPeakBase = new THREE.Color(0x9ec7e8);
  const colM = new THREE.Color();

  const ridgeCount = 4 + (Math.floor(seed) % 2); // 4 or 5 dramatic knife-edge arêtes
  const ridgePhase = hash2(seed, 2.3) * Math.PI * 2;
  const peakOffX = (hash2(seed, 5.1) - 0.5) * ms.r * 0.28;
  const peakOffZ = (hash2(seed, 7.9) - 0.5) * ms.r * 0.22;

  for (let j = 0; j <= hSegs; j++) {
    const v = j / hSegs; // 0 = broad base, 1 = sharp alpine horn summit
    // Concave Matterhorn-like steepening slope profile
    const baseProfile = Math.pow(1.0 - v, 1.24);
    const yBase = v * ms.h;

    for (let i = 0; i <= radSegs; i++) {
      const u = i / radSegs;
      const th = u * Math.PI * 2;
      const ca = Math.cos(th);
      const sa = -Math.sin(th);

      // Knife-edge glacial arête ridge function (sharp crests + scooped cirque bowls)
      const ridgeWave = Math.abs(Math.cos((ridgeCount * 0.5) * th + ridgePhase + v * 0.42));
      const arete = 0.72 + 0.44 * Math.pow(ridgeWave, 0.65);
      const secondaryCrag = 1.0 + 0.16 * (fbm2D(ca * 2.2 + seed, sa * 2.2 + v * 3.1, 3) - 0.5);
      const r = ms.r * baseProfile * lerp(arete * secondaryCrag, 1.0, v * 0.78);

      const px = ca * r + peakOffX * Math.pow(v, 1.35);
      const pz = sa * r + peakOffZ * Math.pow(v, 1.35);
      // Slight serrated vertical step along ridges
      const py = yBase + (v > 0.08 && v < 0.94 ? (ridgeWave - 0.5) * ms.h * 0.045 * (1.0 - v) : 0);

      positions.push(px, py, pz);
      uvs.push(u * 2.0, v);

      // Rotate sample direction by ms.rot so sunFace aligns accurately with world morning sun (+X)
      const worldX = px * Math.cos(ms.rot) + pz * Math.sin(ms.rot);
      const sunFace = smoothstep(-ms.r * 0.42, ms.r * 0.42, worldX);
      const isCliff = ridgeWave < 0.44 && v > 0.26 && v < 0.88 && sunFace < 0.52;

      colM.copy(isCliff ? cRockCliff : cPeakShadow);
      colM.lerp(cPeakLit, clamp(sunFace * 0.68 + v * 0.42 + (ridgeWave > 0.72 ? 0.16 : 0), 0, 1));
      if (sunFace > 0.52 && v > 0.50) colM.lerp(cPeakGold, 0.34);
      colM.lerp(cPeakBase, (1.0 - smoothstep(0.0, 0.42, v)) * 0.62);
      if (ms.far) colM.lerp(fogColorVec, 0.30);

      colors.push(colM.r, colM.g, colM.b);
    }
  }

  for (let j = 0; j < hSegs; j++) {
    for (let i = 0; i < radSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.rotateY(ms.rot);
  geo.translate(ms.x, -2.35, ms.z);
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}

/**
 * Generates a crisp procedural 256x256 concentric annual growth-ring CanvasTexture
 * with heartwood, cedar growth rings, cambium rim, and radial drying cracks (切面年轮).
 */
function createWoodRingsTexture(THREE, trackedTextures) {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = size * 0.5;
  const cy = size * 0.5;
  ctx.fillStyle = '#dec6a2';
  ctx.fillRect(0, 0, size, size);

  // Subtle off-center pith & organic concentric annual growth rings
  const pithX = cx + 6;
  const pithY = cy - 4;
  for (let r = size * 0.49; r > 2; r -= 2.2) {
    const frac = r / (size * 0.49);
    const wave = Math.sin(r * 0.55) * 0.5 + 0.5;
    const isHeart = frac < 0.48;
    const isCambium = frac > 0.91;
    let col;
    if (isCambium) col = '#634634';
    else if (isHeart) col = wave > 0.62 ? '#9f754c' : '#c69e70';
    else col = wave > 0.66 ? '#b89268' : '#e5cfa9';

    ctx.beginPath();
    for (let a = 0; a <= 48; a++) {
      const th = (a / 48) * Math.PI * 2;
      const wobble = 1.0 + 0.045 * Math.sin(th * 3.0 + frac * 4.0) + 0.025 * Math.cos(th * 5.0 - frac * 3.0);
      const px = pithX + Math.cos(th) * r * wobble;
      const py = pithY + Math.sin(th) * r * wobble;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }

  // Radial wood-drying check cracks
  ctx.strokeStyle = 'rgba(72, 46, 28, 0.72)';
  const crackAngles = [0.35, 1.85, 3.45, 4.95, 5.75];
  for (let k = 0; k < crackAngles.length; k++) {
    const th = crackAngles[k];
    const len = size * (0.28 + (k % 3) * 0.09);
    ctx.lineWidth = k % 2 === 0 ? 2.2 : 1.3;
    ctx.beginPath();
    ctx.moveTo(pithX + Math.cos(th) * 4, pithY + Math.sin(th) * 4);
    ctx.lineTo(pithX + Math.cos(th + 0.04) * len * 0.55, pithY + Math.sin(th + 0.04) * len * 0.55);
    ctx.lineTo(pithX + Math.cos(th) * len, pithY + Math.sin(th) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  trackedTextures.push(tex);
  return tex;
}

/**
 * Builds AAA sculpted foreground snow-stump geometries:
 * - barkGeo: deeply fissured vertical bark cracks + 6 thick gnarled spreading surface roots
 * - topGeo: slightly uneven axe-cut cross-section disc with planar annual-ring UVs & concentric vertex shading
 * - snowGeo: asymmetric sculpted snow-drift cap leaving golden growth rings partially visible + root-nook snow tufts
 */
function buildSculptedStumpGeometries(THREE) {
  const barkParts = [];
  const cCrevice = new THREE.Color(0x3a281d);
  const cRidge = new THREE.Color(0x755743);
  const cRim = new THREE.Color(0x8e725d);

  // 1. Deeply fissured fluted stump trunk body (24 radial x 8 height rings)
  const radSegs = 24;
  const hSegs = 8;
  const stride = radSegs + 1;
  const height = 0.68;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const tmp = new THREE.Color();

  for (let j = 0; j <= hSegs; j++) {
    const v = j / hSegs;
    const y = v * height;
    const baseR = lerp(0.56, 0.42, Math.pow(v, 0.65)) + (v < 0.28 ? Math.pow(0.28 - v, 1.5) * 1.15 : 0);

    for (let i = 0; i <= radSegs; i++) {
      const u = i / radSegs;
      const th = u * Math.PI * 2;
      // Deep vertical bark fissure ridges + root buttress lobes near bottom
      const rootFlare = 0.14 * Math.cos(th * 6.0 + 0.4) * Math.pow(1.0 - v, 1.6);
      const fissure1 = Math.cos(th * 11.0 + v * 0.9);
      const fissure2 = Math.sin(th * 19.0 - v * 1.4) * 0.5;
      const crackDepth = (fissure1 * 0.65 + fissure2 * 0.35) * 0.048;
      const r = Math.max(0.18, baseR * (1.0 + rootFlare) + crackDepth);
      // Slight axe-cut notch bevel along top rim
      const topNotch = j === hSegs ? 0.025 * Math.sin(th * 2.0 + 0.6) : 0;

      positions.push(Math.cos(th) * r, y + topNotch, -Math.sin(th) * r);
      uvs.push(u * 2.5, v);

      const ridgeFactor = smoothstep(-0.042, 0.042, crackDepth);
      tmp.copy(cCrevice).lerp(cRidge, ridgeFactor);
      if (v > 0.82) tmp.lerp(cRim, (v - 0.82) * 2.0);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let j = 0; j < hSegs; j++) {
    for (let i = 0; i < radSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const trunkBody = new THREE.BufferGeometry();
  trunkBody.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  trunkBody.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  trunkBody.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  trunkBody.setIndex(indices);
  trunkBody.computeVertexNormals();
  barkParts.push(trunkBody);

  // 2. Six thick gnarled spreading surface roots clutching outward into the snow
  const rootAngles = [0.22, 1.28, 2.32, 3.38, 4.46, 5.48];
  for (let r = 0; r < rootAngles.length; r++) {
    const ang = rootAngles[r];
    const reach = 0.88 + hash2(r * 3.7, 2.1) * 0.34;
    const ca = Math.cos(ang);
    const sa = -Math.sin(ang);
    const px = -sa;
    const pz = ca;
    const curve = (r % 2 === 0 ? 1 : -1) * (0.14 + hash2(r, 6.1) * 0.14);
    const knuckleY = 0.18 + hash2(r, 8.9) * 0.08;

    const pts = [
      [ca * 0.34, 0.34, sa * 0.34],
      [ca * (reach * 0.42) + px * curve * 0.45, knuckleY, sa * (reach * 0.42) + pz * curve * 0.45],
      [ca * (reach * 0.76) + px * curve, 0.05, sa * (reach * 0.76) + pz * curve],
      [ca * reach + px * curve * 1.15, -0.10, sa * reach + pz * curve * 1.15],
    ];
    barkParts.push(
      createCurvedBranchTube(
        THREE,
        pts,
        [0.165, 0.13, 0.082, 0.032],
        7,
        (vf, th, _pt, out) => {
          const fl = 0.5 + 0.5 * Math.cos(th * 5.0 + vf * 2.0);
          out.copy(cCrevice).lerp(cRidge, fl * 0.82);
        },
        { fluteAmp: 0.14, fluteFreq: 5, capEnd: true }
      )
    );
  }
  const barkGeo = mergeGeometries(THREE, barkParts);

  // 3. Concentric axe-cut wood top disc (24 radial x 5 rings) with radial UVs for annual rings
  const topSegs = 24;
  const topRings = 5;
  const tStride = topSegs + 1;
  const tPos = [];
  const tUv = [];
  const tCol = [];
  const tIdx = [];
  const cHeart = new THREE.Color(0xc59a6c);
  const cSap = new THREE.Color(0xecd6b2);
  const cRingLine = new THREE.Color(0x9a724a);

  for (let j = 0; j <= topRings; j++) {
    const rf = j / topRings;
    for (let i = 0; i <= topSegs; i++) {
      const u = i / topSegs;
      const th = u * Math.PI * 2;
      const wobble = 1.0 + 0.05 * Math.cos(th * 11.0);
      const r = 0.41 * rf * wobble;
      const x = Math.cos(th) * r;
      const z = -Math.sin(th) * r;
      const y = height + 0.012 * (1.0 - rf) + 0.024 * rf * Math.sin(th * 2.0 + 0.6);
      tPos.push(x, y, z);
      tUv.push(0.5 + (x / 0.86), 0.5 + (z / 0.86));

      tmp.copy(cHeart).lerp(cSap, smoothstep(0.18, 0.88, rf));
      if (j % 2 === 1) tmp.lerp(cRingLine, 0.28);
      tCol.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let j = 0; j < topRings; j++) {
    for (let i = 0; i < topSegs; i++) {
      const a = j * tStride + i;
      const b = a + 1;
      const c = (j + 1) * tStride + i;
      const d = c + 1;
      tIdx.push(a, c, b);
      tIdx.push(b, c, d);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 3));
  topGeo.setIndex(tIdx);
  topGeo.computeVertexNormals();

  // 4. Asymmetric irregular snow-drift hat overhanging ~62% of top so annual rings show cleanly!
  const snowParts = [];
  const sRad = 20;
  const sRings = 5;
  const sStride = sRad + 1;
  const sPos = [];
  const sUv = [];
  const sCol = [];
  const sIdx = [];
  const cSnShade = new THREE.Color(0xc2dff6);
  const cSnTop = new THREE.Color(0xffffff);

  for (let j = 0; j <= sRings; j++) {
    const v = j / sRings;
    for (let i = 0; i <= sRad; i++) {
      const u = i / sRad;
      const th = u * Math.PI * 2;
      const ca = Math.cos(th);
      const sa = -Math.sin(th);
      // Irregular scalloped snow crescent offset toward rear-left (-X, -Z) exposing front annual rings
      const scallop = 1.0 + 0.16 * Math.sin(th * 3.0 + 1.1) + 0.09 * Math.cos(th * 5.0 - 0.7);
      const rx = 0.37 * v * scallop;
      const rz = 0.32 * v * scallop;
      const dome = Math.cos(v * Math.PI * 0.5) * 0.18 + Math.sin(v * Math.PI) * 0.03;
      const lipDrop = j === sRings ? -0.04 : 0;
      sPos.push(-0.11 + ca * rx, height + 0.015 + dome + lipDrop, -0.10 + sa * rz);
      sUv.push(u, v);
      tmp.copy(cSnTop).lerp(cSnShade, smoothstep(0.55, 1.0, v));
      sCol.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let j = 0; j < sRings; j++) {
    for (let i = 0; i < sRad; i++) {
      const a = j * sStride + i;
      const b = a + 1;
      const c = (j + 1) * sStride + i;
      const d = c + 1;
      sIdx.push(a, c, b);
      sIdx.push(b, c, d);
    }
  }
  const mainHat = new THREE.BufferGeometry();
  mainHat.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  mainHat.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2));
  mainHat.setAttribute('color', new THREE.Float32BufferAttribute(sCol, 3));
  mainHat.setIndex(sIdx);
  mainHat.computeVertexNormals();
  snowParts.push(mainHat);

  // Soft snow pockets nestled between the spreading roots
  const rootDrift = createSculptedSnowCollarGeo(THREE, 0.44, 0.96, 0.14, 9.3);
  rootDrift.translate(0, 0.01, 0);
  snowParts.push(rootDrift);

  const snowGeo = mergeGeometries(THREE, snowParts);
  return { barkGeo, topGeo, snowGeo };
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
      vertexColors: true,
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
      vertexColors: true,
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
      vertexColors: true,
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

  // Half-buried flush hand-hewn bevelled ancient flagstones along rear edge (z = -4.55 ~ -9.55, outside combat zone)
  const flagstoneGeo = trackGeo(createSculptedFlagstoneGeo(THREE, 0.54, 0.09, 3.7, false));
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
    dummy.position.set(fx, fy - 0.008, fz);
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

  // Riverbank Snow-Capped Faceted Glacial Boulders (InstancedMesh)
  const cobbleGeoRaw = new THREE.IcosahedronGeometry(0.45, 2);
  const cp = cobbleGeoRaw.attributes.position;
  const cc = new Float32Array(cp.count * 3);
  const cRockWet = new THREE.Color(0x526a82);
  const cRock = new THREE.Color(0x7c93aa);
  const cSnowTop = new THREE.Color(0xf6fbff);
  const cTmp = new THREE.Color();
  for (let i = 0; i < cp.count; i++) {
    const vx = cp.getX(i);
    const vy = cp.getY(i);
    const vz = cp.getZ(i);
    // Planar rock cleavage stratification + natural glacial boulder ridges
    const strata = 1.0 + 0.12 * Math.sin(vy * 9.5 + vx * 3.1);
    const k = (0.82 + 0.30 * fbm2D(vx * 3.4 + 1.9, vz * 3.8 + vy * 2.5, 3)) * strata;
    const ny = vy > 0 ? vy * k * 0.74 : vy * k * 0.62;
    cp.setXYZ(i, vx * k * 1.24, ny, vz * k * 1.08);
    cTmp.copy(cRockWet).lerp(cRock, smoothstep(-0.28, 0.04, vy));
    cTmp.lerp(cSnowTop, smoothstep(0.06, 0.28, vy));
    cc[i * 3] = cTmp.r;
    cc[i * 3 + 1] = cTmp.g;
    cc[i * 3 + 2] = cTmp.b;
  }
  cobbleGeoRaw.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const cobbleFlat = cobbleGeoRaw.index ? cobbleGeoRaw.toNonIndexed() : cobbleGeoRaw;
  if (cobbleFlat !== cobbleGeoRaw) cobbleGeoRaw.dispose();
  cobbleFlat.computeVertexNormals();
  const cobbleGeo = trackGeo(cobbleFlat);

  const cobbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: stoneTex.roughnessMap ? 0.88 : 0.74,
      metalness: 0.05,
      flatShading: true,
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

  // 3 Frost-Rimmed Sculpted Stepping Stones crossing the frozen stream toward the stone arch
  const stepStoneGeo = trackGeo(createSculptedFlagstoneGeo(THREE, 0.58, 0.24, 7.1, true));
  const stepSnowRimGeo = trackGeo(createSculptedSnowCollarGeo(THREE, 0.14, 0.46, 0.11, 5.4));
  const stepXs = [-0.95, 0.15, 1.25];
  for (let i = 0; i < stepXs.length; i++) {
    const sx = stepXs[i];
    const sz = getStreamCenterZ(sx) + (i - 1) * 0.55;
    const stepGrp = new THREE.Group();
    stepGrp.position.set(sx, streamY + 0.06, sz);
    stepGrp.rotation.y = i * 0.9 + 0.3;

    const stone = new THREE.Mesh(stepStoneGeo, marbleMat);
    stone.scale.set(1.15, 1.0, 0.88);
    stone.receiveShadow = true;
    stone.castShadow = true;
    stepGrp.add(stone);

    const frostRim = new THREE.Mesh(stepSnowRimGeo, snowPillowMat);
    frostRim.position.set(-0.08, 0.10, -0.06);
    frostRim.scale.set(0.82, 0.62, 0.68);
    frostRim.receiveShadow = true;
    stepGrp.add(frostRim);

    group.add(stepGrp);
  }

  // Shore Glacial Icicles & Frosted Ice Shards along riverbanks + Outer Refractive Crystal Shell Material
  const iceTex = resolveTexBundle(THREE, texLib.iceCrystal, 1.5, 2.2, trackedTextures);
  const crystalOuterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd4f7ff,
      vertexColors: true,
      emissive: 0x1678c4,
      emissiveIntensity: 0.18,
      roughness: 0.12,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0,
      ior: 1.38,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      flatShading: true,
      ...(iceTex.map ? { map: iceTex.map } : {}),
      ...(iceTex.normalMap ? { normalMap: iceTex.normalMap, normalScale: new THREE.Vector2(0.42, 0.42) } : {}),
      ...(iceTex.bumpMap ? { bumpMap: iceTex.bumpMap, bumpScale: 0.04 } : {}),
    })
  );

  const bankIcicleGeo = trackGeo(createIceSplinterGeo(THREE, 0.24, 0.16, 0.72, 11.4));
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
  trackGeo(firAssets.icicleGeo);

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

  const firIcicleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdff8ff,
      vertexColors: true,
      emissive: 0x2682c4,
      emissiveIntensity: 0.14,
      roughness: 0.12,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
    })
  );
  attachWindSway(firIcicleMat, windUniform, windAmpUniform);

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
  const firIcicleInst = new THREE.InstancedMesh(firAssets.icicleGeo, firIcicleMat, firCount);

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
    firIcicleInst.setMatrixAt(i, dummy.matrix);
  }
  firTrunkInst.instanceMatrix.needsUpdate = true;
  firFoliageInst.instanceMatrix.needsUpdate = true;
  firSnowInst.instanceMatrix.needsUpdate = true;
  firIcicleInst.instanceMatrix.needsUpdate = true;
  firTrunkInst.frustumCulled = false;
  firFoliageInst.frustumCulled = false;
  firSnowInst.frustumCulled = false;
  firIcicleInst.frustumCulled = false;
  group.add(firTrunkInst, firFoliageInst, firSnowInst, firIcicleInst);

  // Silver Frost Birches (14 sunlit edge trees with curved forked branches & serrated winter sprays)
  const birchAssets = buildSilverBirchGeometries(THREE);
  trackGeo(birchAssets.trunkGeo);
  trackGeo(birchAssets.canopyGeo);

  const birchTrunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: barkTex.roughnessMap ? 0.85 : 0.74,
      metalness: 0.03,
      ...(barkTex.normalMap ? { normalMap: barkTex.normalMap, normalScale: new THREE.Vector2(0.45, 0.45) } : {}),
      ...(barkTex.bumpMap ? { bumpMap: barkTex.bumpMap, bumpScale: 0.06 } : {}),
    })
  );
  attachWindSway(birchTrunkMat, windUniform, windAmpUniform);

  const birchCanopyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.56,
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
  // 5. HERO LANDMARKS: 7 AAA DUAL-LAYER OBLIQUE MULTI-FACETED CRYSTAL CLUSTERS
  // =========================================================================
  const animatedCrystalCores = [];
  const animatedCrystalHearts = [];
  const animatedCrystalLights = [];
  const animatedGlowDiscs = [];

  // Pre-build 4 varied asymmetric bevel-chamfered oblique crystal prisms (outer shell + inner cyan/lavender core)
  const shardOuterGeos = [
    createCrystalPrismGeo(THREE, 0.42, 2.85, 1.3, { nFaces: 6, bevelFrac: 0.17, oblique: 0.16, colBase: 0x6ec6f5, colMid: 0xc2f3ff, colTip: 0xf6fdff }),
    createCrystalPrismGeo(THREE, 0.34, 2.22, 4.7, { nFaces: 6, bevelFrac: 0.16, oblique: 0.19, colBase: 0x76cff8, colMid: 0xcbf6ff, colTip: 0xf8feff }),
    createCrystalPrismGeo(THREE, 0.28, 1.68, 8.9, { nFaces: 5, bevelFrac: 0.15, oblique: 0.21, colBase: 0x82d4fa, colMid: 0xd0f7ff, colTip: 0xffffff }),
    createCrystalPrismGeo(THREE, 0.36, 2.48, 12.4, { nFaces: 7, bevelFrac: 0.14, oblique: 0.17, colBase: 0x6ac2f2, colMid: 0xbef0ff, colTip: 0xf4fcff }),
  ];
  const shardCoreGeos = [
    createCrystalPrismGeo(THREE, 0.42, 2.85, 1.3, { nFaces: 6, bevelFrac: 0.14, oblique: 0.16, colBase: 0xb096ff, colMid: 0x6ef0ff, colTip: 0xe8ffff }),
    createCrystalPrismGeo(THREE, 0.34, 2.22, 4.7, { nFaces: 6, bevelFrac: 0.14, oblique: 0.19, colBase: 0xbda4ff, colMid: 0x74f2ff, colTip: 0xecffff }),
    createCrystalPrismGeo(THREE, 0.28, 1.68, 8.9, { nFaces: 5, bevelFrac: 0.14, oblique: 0.21, colBase: 0xa694ff, colMid: 0x6ceeff, colTip: 0xeaffff }),
    createCrystalPrismGeo(THREE, 0.36, 2.48, 12.4, { nFaces: 7, bevelFrac: 0.13, oblique: 0.17, colBase: 0xc0a6ff, colMid: 0x78f4ff, colTip: 0xf0ffff }),
  ];
  const splinterOuterGeos = [
    createIceSplinterGeo(THREE, 0.30, 0.18, 0.92, 2.4, { colBase: 0x76cdf7, colTip: 0xf4fcff }),
    createIceSplinterGeo(THREE, 0.24, 0.15, 0.72, 6.1, { colBase: 0x82d4fa, colTip: 0xffffff }),
    createIceSplinterGeo(THREE, 0.20, 0.12, 0.56, 9.8, { colBase: 0x8ad8fc, colTip: 0xffffff }),
  ];
  const splinterCoreGeos = [
    createIceSplinterGeo(THREE, 0.30, 0.18, 0.92, 2.4, { colBase: 0xb69eff, colTip: 0xa2f8ff }),
    createIceSplinterGeo(THREE, 0.24, 0.15, 0.72, 6.1, { colBase: 0xbfa6ff, colTip: 0xb4faff }),
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

  // Shared sculpted wind-rippled snow collars (2 subtle variations for organic diversity)
  const snowCollarGeos = [
    trackGeo(createSculptedSnowCollarGeo(THREE, 0.42, 1.54, 0.42, 1.7)),
    trackGeo(createSculptedSnowCollarGeo(THREE, 0.44, 1.48, 0.39, 5.3)),
  ];

  const tmpM4 = new THREE.Matrix4();
  const tmpEuler = new THREE.Euler();
  const tmpQuat = new THREE.Quaternion();
  const tmpPosV = new THREE.Vector3();
  const tmpSclV = new THREE.Vector3();

  for (let cIdx = 0; cIdx < crystalClusterSpecs.length; cIdx++) {
    const spec = crystalClusterSpecs[cIdx];
    const clusterGroup = new THREE.Group();
    const baseY = getTerrainHeight(spec.x, spec.z);
    clusterGroup.position.set(spec.x, baseY - 0.12, spec.z);
    clusterGroup.name = `hero_crystal_cluster_${cIdx}`;

    // Inner glowing ice-cyan / pale-lavender emissive core material (asynchronous breathing pulse)
    const coreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd8f6ff,
        vertexColors: true,
        emissive: 0x6be8ff,
        emissiveIntensity: 1.18,
        roughness: 0.16,
        metalness: 0.04,
        flatShading: true,
      })
    );
    animatedCrystalCores.push({ mat: coreMat, baseInt: 1.18, phase: spec.phase });

    // Innermost soft radiant ice-cyan / lavender heart filament (MeshBasicMaterial)
    const heartMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xe6fbff,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
      })
    );
    animatedCrystalHearts.push({ mat: heartMat, baseOp: 0.82, phase: spec.phase });

    // Sculpted undulating wind-rippled snow-drift collar around base
    const collar = new THREE.Mesh(snowCollarGeos[cIdx % snowCollarGeos.length], snowPillowMat);
    collar.scale.set(spec.scale * 0.94, spec.scale * 0.88, spec.scale * 0.94);
    collar.rotation.y = cIdx * 1.15;
    collar.position.y = 0.04;
    collar.receiveShadow = true;
    clusterGroup.add(collar);

    // 1 Majestic hero spire + 6 slanted companion crystal prisms + 7 jagged oblique base ice splinters
    const prongConfigs = [
      { ox: 0.0, oz: 0.0, sx: 1.06, sy: 1.14, rx: spec.leanZ, rz: -spec.leanX, ry: 0.25 + cIdx, geoIdx: 0 },
      { ox: 0.42, oz: 0.24, sx: 0.74, sy: 0.80, rx: 0.28, rz: -0.35, ry: 1.15 + cIdx, geoIdx: 1 },
      { ox: -0.44, oz: 0.22, sx: 0.72, sy: 0.74, rx: 0.25, rz: 0.39, ry: 2.35 + cIdx, geoIdx: 3 },
      { ox: 0.19, oz: -0.42, sx: 0.78, sy: 0.88, rx: -0.31, rz: -0.19, ry: 3.45 + cIdx, geoIdx: 3 },
      { ox: -0.34, oz: -0.36, sx: 0.64, sy: 0.64, rx: -0.27, rz: 0.34, ry: 4.55 + cIdx, geoIdx: 1 },
      { ox: 0.05, oz: 0.48, sx: 0.56, sy: 0.54, rx: 0.44, rz: 0.07, ry: 5.35 + cIdx, geoIdx: 2 },
      { ox: -0.16, oz: 0.34, sx: 0.48, sy: 0.46, rx: 0.38, rz: 0.28, ry: 0.95 + cIdx * 1.4, geoIdx: 2 },
    ];

    const outerParts = [];
    const coreParts = [];
    const heartParts = [];

    for (let p = 0; p < prongConfigs.length; p++) {
      const pr = prongConfigs[p];
      tmpEuler.set(pr.rx, pr.ry, pr.rz);
      tmpQuat.setFromEuler(tmpEuler);
      tmpPosV.set(pr.ox * spec.scale, 0, pr.oz * spec.scale);

      // Outer glossy refractive crystal shell
      const oGeo = shardOuterGeos[pr.geoIdx].clone();
      tmpSclV.set(pr.sx * spec.scale, pr.sy * spec.scale, pr.sx * spec.scale);
      tmpM4.compose(tmpPosV, tmpQuat, tmpSclV);
      oGeo.applyMatrix4(tmpM4);
      outerParts.push(oGeo);

      // Inner luminous ice-cyan / pale-lavender crystal core
      const cGeo = shardCoreGeos[pr.geoIdx].clone();
      tmpSclV.set(pr.sx * spec.scale * 0.64, pr.sy * spec.scale * 0.87, pr.sx * spec.scale * 0.64);
      tmpM4.compose(tmpPosV, tmpQuat, tmpSclV);
      cGeo.applyMatrix4(tmpM4);
      coreParts.push(cGeo);

      // Innermost radiant crystal heart filament on major spires
      if (p < 4) {
        const hGeo = shardCoreGeos[pr.geoIdx].clone();
        tmpSclV.set(pr.sx * spec.scale * 0.32, pr.sy * spec.scale * 0.72, pr.sx * spec.scale * 0.32);
        tmpM4.compose(tmpPosV, tmpQuat, tmpSclV);
        hGeo.applyMatrix4(tmpM4);
        heartParts.push(hGeo);
      }
    }

    // 7 Jagged slanted base ice splinters (碎冰棘片) bursting radially through the snow collar
    const splinterCount = 7;
    for (let sp = 0; sp < splinterCount; sp++) {
      const spSeed = cIdx * 13.7 + sp * 4.3;
      const ang = (sp / splinterCount) * Math.PI * 2 + cIdx * 0.55 + (hash2(spSeed, 1.9) - 0.5) * 0.34;
      const dist = (0.58 + 0.34 * hash2(spSeed, 3.7)) * spec.scale;
      const tiltOut = 0.52 + 0.44 * hash2(spSeed, 6.2); // 30°–55° dramatic outward thrust
      const sc = (0.72 + 0.48 * hash2(spSeed, 8.4)) * spec.scale;
      const gIdx = sp % splinterOuterGeos.length;

      tmpPosV.set(Math.cos(ang) * dist, 0.03 * spec.scale, -Math.sin(ang) * dist);
      // Tilt splinter radially outward along angle `ang`
      tmpEuler.set(Math.sin(ang) * tiltOut, ang, -Math.cos(ang) * tiltOut);
      tmpQuat.setFromEuler(tmpEuler);

      const spOut = splinterOuterGeos[gIdx].clone();
      tmpSclV.set(sc, sc * (0.9 + 0.35 * hash2(spSeed, 9.1)), sc);
      tmpM4.compose(tmpPosV, tmpQuat, tmpSclV);
      spOut.applyMatrix4(tmpM4);
      outerParts.push(spOut);

      // Subtle glowing inner core inside the larger base splinters
      if (sp % 2 === 0) {
        const spCore = splinterCoreGeos[sp % splinterCoreGeos.length].clone();
        tmpSclV.set(sc * 0.56, sc * 0.76, sc * 0.56);
        tmpM4.compose(tmpPosV, tmpQuat, tmpSclV);
        spCore.applyMatrix4(tmpM4);
        coreParts.push(spCore);
      }
    }

    const mergedCoreGeo = trackGeo(mergeGeometries(THREE, coreParts));
    const coreMesh = new THREE.Mesh(mergedCoreGeo, coreMat);
    coreMesh.castShadow = true;
    coreMesh.receiveShadow = true;
    clusterGroup.add(coreMesh);

    const mergedHeartGeo = trackGeo(mergeGeometries(THREE, heartParts));
    const heartMesh = new THREE.Mesh(mergedHeartGeo, heartMat);
    clusterGroup.add(heartMesh);

    const mergedOuterGeo = trackGeo(mergeGeometries(THREE, outerParts));
    const outerMesh = new THREE.Mesh(mergedOuterGeo, crystalOuterMat);
    outerMesh.castShadow = true;
    outerMesh.receiveShadow = true;
    outerMesh.renderOrder = 2;
    clusterGroup.add(outerMesh);

    // Soft glowing frost aura decal hugging snow ground around cluster base
    if (glowDiscTex) {
      const auraGeo = trackGeo(new THREE.PlaneGeometry(3.9 * spec.scale, 3.9 * spec.scale));
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = trackMat(
        new THREE.MeshBasicMaterial({
          map: glowDiscTex,
          color: 0x74eeff,
          transparent: true,
          opacity: 0.30,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.position.y = 0.22;
      clusterGroup.add(aura);
      animatedGlowDiscs.push({ mat: auraMat, baseOp: 0.30, phase: spec.phase });
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

  // Dispose temporary template shards/splinters (cloned & merged into cluster geos; keep 3 small shards for fgCrystals)
  for (let i = 0; i < shardCoreGeos.length; i++) shardCoreGeos[i].dispose();
  for (let i = 0; i < splinterCoreGeos.length; i++) splinterCoreGeos[i].dispose();
  for (let i = 0; i < shardOuterGeos.length; i++) trackGeo(shardOuterGeos[i]);
  for (let i = 0; i < splinterOuterGeos.length; i++) trackGeo(splinterOuterGeos[i]);

  // =========================================================================
  // 6. ANCIENT HALF-BURIED GOTHIC STONE ARCH RUINS (z = -10.5) & STANDING STONES
  // =========================================================================
  const ruinsGroup = new THREE.Group();
  ruinsGroup.name = 'ancient_gothic_arch_ruins';
  const archBaseY = getTerrainHeight(0, -10.5);
  ruinsGroup.position.set(0, archBaseY - 0.12, -10.5);

  const runeGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2f8ff,
      emissive: 0x6be8ff,
      emissiveIntensity: 1.48,
      roughness: 0.18,
      metalness: 0.08,
    })
  );
  animatedCrystalCores.push({ mat: runeGlowMat, baseInt: 1.48, phase: 2.1 });

  // Merge Gothic arch masonry cleanly by material (stone, marble trim/capitals, sculpted snow, runes, icicles)
  const ruinsStoneParts = [];
  const ruinsMarbleParts = [];
  const ruinsSnowParts = [];
  const ruinsRuneParts = [];
  const ruinsIcicleParts = [];

  const pierX = [-2.65, 2.65];
  for (let p = 0; p < 2; p++) {
    const px = pierX[p];
    const seedP = 3.1 + p * 7.4;

    // Stepped bevelled chamfered plinth & sub-plinth (zero raw BoxGeometry!)
    const plinth = createBevelledStoneBlockGeo(THREE, 1.84, 0.68, 1.66, 0.08, seedP, { topScale: 0.94, chip: 0.018 });
    plinth.translate(px, 0.28, 0);
    ruinsStoneParts.push(plinth);

    const subPlinth = createBevelledStoneBlockGeo(THREE, 1.52, 0.44, 1.42, 0.07, seedP + 1.2, { topScale: 0.90, chip: 0.014 });
    subPlinth.translate(px, 0.80, 0);
    ruinsMarbleParts.push(subPlinth);

    // 6 Stacked weathered ashlar masonry courses forming the compound pier shaft
    const courseH = 0.56;
    for (let c = 0; c < 6; c++) {
      const cy = 1.28 + c * courseH;
      const cw = 1.18 + ((c % 2 === 0 ? 0.03 : -0.02));
      const course = createBevelledStoneBlockGeo(THREE, cw, courseH - 0.018, cw, 0.045, seedP + c * 2.3, {
        chip: 0.016,
        colDark: c % 2 === 0 ? 0xb4c6d8 : 0xc0d1e2,
        colLit: 0xf2f7fc,
      });
      course.translate(px + (hash2(c, seedP) - 0.5) * 0.018, cy, 0);
      if (c % 3 === 1) ruinsMarbleParts.push(course);
      else ruinsStoneParts.push(course);
    }

    // 4 Corner engaged Gothic colonnettes with horizontal moulded shaft-ring annulets
    const corners = [
      [-0.55, -0.55],
      [0.55, -0.55],
      [-0.55, 0.55],
      [0.55, 0.55],
    ];
    for (const [cx, cz] of corners) {
      const colShaft = new THREE.CylinderGeometry(0.115, 0.125, 3.36, 8);
      colShaft.translate(px + cx, 2.66, cz);
      setUniformVertexColor(THREE, colShaft, 0xe8f1fa, 0.03);
      ruinsMarbleParts.push(colShaft);

      // Decorative Gothic shaft-ring bands at lower, mid, and neck heights
      for (const ringY of [1.14, 2.62, 4.18]) {
        const annulet = new THREE.CylinderGeometry(0.155, 0.145, 0.09, 8);
        annulet.translate(px + cx, ringY, cz);
        setUniformVertexColor(THREE, annulet, 0xf6fbff, 0.02);
        ruinsMarbleParts.push(annulet);
      }
    }

    // Ornate carved Gothic foliate bell capital (雕花柱头线条)
    const capital = createGothicCapitalGeo(THREE);
    capital.translate(px, 4.38, 0);
    ruinsMarbleParts.push(capital);

    // Sculpted snow pillow draped organically over the carved capital overhang
    const capSnow = createSculptedSnowCollarGeo(THREE, 0.24, 0.96, 0.22, seedP + 4.1);
    capSnow.scale(1.06, 0.82, 0.98);
    capSnow.translate(px, 4.82, 0);
    ruinsSnowParts.push(capSnow);

    // Hanging delicate icicles along capital cornice overhang
    for (let ic = 0; ic < 3; ic++) {
      const icG = new THREE.ConeGeometry(0.028, 0.26 + (ic % 2) * 0.10, 5);
      icG.rotateX(Math.PI);
      icG.translate(px + (ic - 1) * 0.44, 4.58, 0.74);
      setUniformVertexColor(THREE, icG, 0xd8f8ff, 0.04);
      ruinsIcicleParts.push(icG);
    }

    // Recessed Gothic frost-rune channel framed by chamfered stone jambs on front pier face
    const rx = px + (p === 0 ? 0.22 : -0.22);
    const jambL = createBevelledStoneBlockGeo(THREE, 0.075, 2.48, 0.09, 0.018, seedP + 8.1);
    jambL.translate(rx - 0.10, 2.62, 0.59);
    ruinsMarbleParts.push(jambL);
    const jambR = createBevelledStoneBlockGeo(THREE, 0.075, 2.48, 0.09, 0.018, seedP + 8.7);
    jambR.translate(rx + 0.10, 2.62, 0.59);
    ruinsMarbleParts.push(jambR);

    const runeBar = new THREE.BoxGeometry(0.068, 2.26, 0.045);
    runeBar.translate(rx, 2.62, 0.60);
    ruinsRuneParts.push(runeBar);
    for (const ny of [1.75, 2.62, 3.48]) {
      const node = new THREE.OctahedronGeometry(0.088, 0);
      node.scale(0.85, 1.32, 0.45);
      node.translate(rx, ny, 0.62);
      ruinsRuneParts.push(node);
    }

    // Staggered crumbling weathered ashlar wing wall half-buried in snowdrifts
    const dir = p === 0 ? -1 : 1;
    const wallBlocks = [
      { ox: dir * 1.15, oy: 0.34, w: 0.92, h: 0.56, d: 0.72, rz: dir * -0.02 },
      { ox: dir * 1.98, oy: 0.28, w: 0.78, h: 0.48, d: 0.66, rz: dir * -0.06 },
      { ox: dir * 1.08, oy: 0.88, w: 0.80, h: 0.50, d: 0.66, rz: dir * -0.03 },
      { ox: dir * 1.72, oy: 0.74 - p * 0.12, w: 0.58, h: 0.42, d: 0.60, rz: dir * -0.09 },
    ];
    for (let wb = 0; wb < wallBlocks.length; wb++) {
      const b = wallBlocks[wb];
      const blk = createBevelledStoneBlockGeo(THREE, b.w, b.h, b.d, 0.045, seedP + wb * 3.1, { chip: 0.022 });
      blk.rotateZ(b.rz);
      blk.translate(px + b.ox, b.oy, -0.15);
      ruinsStoneParts.push(blk);
    }

    const wingDrift = createSculptedSnowCollarGeo(THREE, 0.28, 1.38, 0.26, seedP + 9.2);
    wingDrift.scale(1.18, 0.85, 0.68);
    wingDrift.translate(px + dir * 1.38, 0.10, -0.10);
    ruinsSnowParts.push(wingDrift);

    const wingCapSnow = createSculptedSnowCollarGeo(THREE, 0.14, 0.68, 0.16, seedP + 11.4);
    wingCapSnow.scale(1.25, 0.82, 0.62);
    wingCapSnow.translate(px + dir * 1.18, 1.12 - p * 0.06, -0.15);
    ruinsSnowParts.push(wingCapSnow);
  }

  // Pointed Gothic Lancet Arch built from genuine Trapezoidal Wedge Voussoirs (梯形楔石逐块拼接)
  const archSpringY = 4.62;
  const archR = 3.22;
  const leftCenterX = 0.57;
  const rightCenterX = -0.57;

  // Left intact Gothic curve sweeping up to & crowning the pointed ornate Keystone
  const leftSteps = 10;
  for (let i = 0; i <= leftSteps; i++) {
    const t = i / leftSteps;
    const angle = lerp(Math.PI, Math.PI * 0.5 + 0.175, t);
    const vx = leftCenterX + Math.cos(angle) * archR;
    const vy = archSpringY + Math.sin(angle) * archR;
    const isKey = i === leftSteps;
    const hasNotch = i === 4 || i === 7;

    const vGeo = createTrapezoidalVoussoirGeo(THREE, {
      radHeight: isKey ? 0.78 : 0.68,
      wInner: isKey ? 0.42 : 0.34,
      wOuter: isKey ? 0.64 : 0.55,
      depth: 1.06,
      bevel: 0.045,
      weatheredNotch: hasNotch,
      isKeystone: isKey,
      seed: 12.3 + i * 3.7,
    });
    vGeo.rotateZ(angle);
    vGeo.translate(vx, vy, 0);
    if (i % 2 === 0 || isKey) ruinsMarbleParts.push(vGeo);
    else ruinsStoneParts.push(vGeo);

    // Ornate inlaid frost-rune diamond crest on the Gothic keystone
    if (isKey) {
      const keyRune = new THREE.OctahedronGeometry(0.14, 0);
      keyRune.scale(0.82, 1.42, 0.42);
      keyRune.translate(vx, vy, 0.56);
      ruinsRuneParts.push(keyRune);
    }

    // Organic sculpted snow cushion draped cleanly over the curved arch extrados
    if (i >= 2) {
      const snowCap = createSculptedSnowCollarGeo(THREE, 0.08, 0.44, 0.14, 21.1 + i * 2.9);
      snowCap.scale(0.92, 0.78, 1.24);
      snowCap.rotateZ(angle - Math.PI * 0.5);
      snowCap.translate(vx + Math.cos(angle) * 0.36, vy + Math.sin(angle) * 0.36, 0);
      ruinsSnowParts.push(snowCap);
    }

    // Hanging delicate arch-soffit icicles beneath upper curve
    if (i === 5 || i === 8 || i === 10) {
      const ic = new THREE.ConeGeometry(0.032, 0.34 + (i % 2) * 0.12, 5);
      ic.rotateX(Math.PI);
      ic.translate(vx - Math.cos(angle) * 0.40, vy - Math.sin(angle) * 0.40 - 0.16, 0.12);
      setUniformVertexColor(THREE, ic, 0xd8f8ff, 0.04);
      ruinsIcicleParts.push(ic);
    }
  }

  // Right broken Gothic arch stub (5 trapezoidal voussoirs ending in a jagged weathered fracture!)
  const rightSteps = 5;
  for (let i = 0; i <= rightSteps; i++) {
    const t = i / 10;
    const angle = lerp(0, Math.PI * 0.5 - 0.175, t);
    const vx = rightCenterX + Math.cos(angle) * archR;
    const vy = archSpringY + Math.sin(angle) * archR;
    const isBreak = i === rightSteps;

    const vGeo = createTrapezoidalVoussoirGeo(THREE, {
      radHeight: isBreak ? 0.60 : 0.68,
      wInner: 0.34,
      wOuter: 0.55,
      depth: isBreak ? 0.96 : 1.06,
      bevel: 0.045,
      weatheredNotch: i === 3,
      fracturedEnd: isBreak,
      seed: 44.1 + i * 4.1,
    });
    vGeo.rotateZ(angle);
    vGeo.translate(vx, vy, 0);
    if (i % 2 === 0) ruinsStoneParts.push(vGeo);
    else ruinsMarbleParts.push(vGeo);

    if (i >= 2) {
      const snowCap = createSculptedSnowCollarGeo(THREE, 0.08, 0.42, 0.13, 61.3 + i * 2.7);
      snowCap.scale(0.88, 0.72, 1.18);
      snowCap.rotateZ(angle - Math.PI * 0.5);
      snowCap.translate(vx + Math.cos(angle) * 0.34, vy + Math.sin(angle) * 0.34, 0);
      ruinsSnowParts.push(snowCap);
    }
    if (isBreak) {
      const ic = new THREE.ConeGeometry(0.036, 0.44, 5);
      ic.rotateX(Math.PI);
      ic.translate(vx - 0.18, vy - 0.34, 0.10);
      setUniformVertexColor(THREE, ic, 0xd8f8ff, 0.04);
      ruinsIcicleParts.push(ic);
    }
  }

  // Fallen fractured trapezoidal arch stones half-buried in sculpted snow mounds below right break
  const fallenBlocks = [
    { x: 2.85, y: 0.14, z: 0.95, rx: 0.24, ry: 0.65, rz: 0.42, s: 1.0 },
    { x: 3.72, y: 0.06, z: 0.42, rx: -0.18, ry: 1.35, rz: -0.30, s: 0.84 },
    { x: -3.65, y: 0.08, z: 0.82, rx: 0.15, ry: -0.80, rz: 0.22, s: 0.88 },
  ];
  for (let f = 0; f < fallenBlocks.length; f++) {
    const fb = fallenBlocks[f];
    const fGeo = createTrapezoidalVoussoirGeo(THREE, {
      radHeight: 0.62 * fb.s,
      wInner: 0.32 * fb.s,
      wOuter: 0.50 * fb.s,
      depth: 0.94 * fb.s,
      bevel: 0.04,
      weatheredNotch: true,
      fracturedEnd: f === 1,
      seed: 88.2 + f * 5.9,
    });
    fGeo.rotateX(fb.rx);
    fGeo.rotateY(fb.ry);
    fGeo.rotateZ(fb.rz);
    fGeo.translate(fb.x, fb.y, fb.z);
    ruinsStoneParts.push(fGeo);
  }

  const ruinsStoneMesh = new THREE.Mesh(trackGeo(mergeGeometries(THREE, ruinsStoneParts)), stoneMat);
  ruinsStoneMesh.castShadow = true;
  ruinsStoneMesh.receiveShadow = true;
  ruinsGroup.add(ruinsStoneMesh);

  const ruinsMarbleMesh = new THREE.Mesh(trackGeo(mergeGeometries(THREE, ruinsMarbleParts)), marbleMat);
  ruinsMarbleMesh.castShadow = true;
  ruinsMarbleMesh.receiveShadow = true;
  ruinsGroup.add(ruinsMarbleMesh);

  const ruinsSnowMesh = new THREE.Mesh(trackGeo(mergeGeometries(THREE, ruinsSnowParts)), snowPillowMat);
  ruinsSnowMesh.receiveShadow = true;
  ruinsGroup.add(ruinsSnowMesh);

  const ruinsRuneMesh = new THREE.Mesh(trackGeo(mergeGeometries(THREE, ruinsRuneParts)), runeGlowMat);
  ruinsGroup.add(ruinsRuneMesh);

  const ruinsIcicleMesh = new THREE.Mesh(trackGeo(mergeGeometries(THREE, ruinsIcicleParts)), crystalOuterMat);
  ruinsGroup.add(ruinsIcicleMesh);

  // Soft arcane ice PointLight centered beneath the Gothic arch
  const archLight = new THREE.PointLight(0x88f2ff, 8.2, 13.5, 1.6);
  archLight.position.set(0, 2.5, 0.4);
  ruinsGroup.add(archLight);
  animatedCrystalLights.push({ light: archLight, baseInt: 8.2, phase: 2.1 });

  group.add(ruinsGroup);

  // 4 Chiseled Weathered Runic Standing Stones (削面风化石碑 + 凹槽发光符文刻线 + 雕塑自然贴合雪冠)
  const menhirBodyGeos = [
    trackGeo(createSculptedMenhirGeo(THREE, 2.3)),
    trackGeo(createSculptedMenhirGeo(THREE, 6.7)),
  ];
  const menhirRuneGeo = trackGeo(createMenhirRuneGeo(THREE));
  const menhirSnowCapGeos = [
    trackGeo(createMenhirSnowCapGeo(THREE, 2.3)),
    trackGeo(createMenhirSnowCapGeo(THREE, 6.7)),
  ];
  const menhirBaseSnowGeo = trackGeo(createSculptedSnowCollarGeo(THREE, 0.28, 0.78, 0.22, 8.1));

  const menhirSpecs = [
    { x: -6.3, z: -9.8, ry: 0.35, tilt: 0.08, s: 1.05 },
    { x: -4.1, z: -11.4, ry: 0.18, tilt: -0.06, s: 0.92 },
    { x: 4.2, z: -11.2, ry: -0.22, tilt: 0.07, s: 0.96 },
    { x: 6.5, z: -9.5, ry: -0.38, tilt: -0.09, s: 1.08 },
  ];
  for (let mIdx = 0; mIdx < menhirSpecs.length; mIdx++) {
    const ms = menhirSpecs[mIdx];
    const mg = new THREE.Group();
    const my = getTerrainHeight(ms.x, ms.z);
    mg.position.set(ms.x, my - 0.15, ms.z);
    mg.rotation.set(0, ms.ry, ms.tilt);
    mg.scale.setScalar(ms.s);

    const body = new THREE.Mesh(menhirBodyGeos[mIdx % 2], stoneMat);
    body.castShadow = true;
    body.receiveShadow = true;
    mg.add(body);

    const runes = new THREE.Mesh(menhirRuneGeo, runeGlowMat);
    mg.add(runes);

    const snowCap = new THREE.Mesh(menhirSnowCapGeos[mIdx % 2], snowPillowMat);
    snowCap.receiveShadow = true;
    mg.add(snowCap);

    const baseSnow = new THREE.Mesh(menhirBaseSnowGeo, snowPillowMat);
    baseSnow.position.y = 0.05;
    baseSnow.receiveShadow = true;
    mg.add(baseSnow);

    group.add(mg);
  }

  // =========================================================================
  // 7. FLOATING LUMINOUS CRYSTAL STREETLAMPS (4 Gothic Wrought-Iron Arcane Waystones)
  // =========================================================================
  const floatingLanterns = [];
  const lanternAssets = buildLanternGeometries(THREE);
  trackGeo(lanternAssets.pedGeo);
  trackGeo(lanternAssets.ironCageGeo);
  trackGeo(lanternAssets.roofGeo);
  trackGeo(lanternAssets.roofSnowGeo);
  trackGeo(lanternAssets.goldTrimGeo);
  trackGeo(lanternAssets.icicleGeo);
  trackGeo(lanternAssets.coreInnerGeo);
  trackGeo(lanternAssets.coreOuterGeo);

  const lanternRingGeo = trackGeo(new THREE.TorusGeometry(0.28, 0.022, 8, 24));

  const wroughtIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb8c7da,
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.84,
    })
  );
  const champagneGoldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4dca8,
      emissive: 0x6b5220,
      emissiveIntensity: 0.22,
      roughness: 0.24,
      metalness: 0.86,
    })
  );
  const lanternCrystalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2fcff,
      vertexColors: true,
      emissive: 0x84f2ff,
      emissiveIntensity: 1.65,
      roughness: 0.12,
      metalness: 0.06,
      flatShading: true,
    })
  );

  // LOCKED SAFE OUTER COORDINATES (strictly outside combat flatland z <= -5.5, clear of actors & ice stream!)
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

    // 1. Stepped carved octagonal stone pedestal
    const ped = new THREE.Mesh(lanternAssets.pedGeo, stoneMat);
    ped.castShadow = true;
    ped.receiveShadow = true;
    lg.add(ped);

    // 2. Gothic open-work wrought-iron curved S-ogee lantern cage
    const cage = new THREE.Mesh(lanternAssets.ironCageGeo, wroughtIronMat);
    cage.castShadow = true;
    lg.add(cage);

    // 3. Concave upturned-eave pagoda-Gothic lantern hat + snow blanket + gold finial + corner icicles
    const roof = new THREE.Mesh(lanternAssets.roofGeo, wroughtIronMat);
    roof.castShadow = true;
    lg.add(roof);

    const roofSnow = new THREE.Mesh(lanternAssets.roofSnowGeo, snowPillowMat);
    roofSnow.receiveShadow = true;
    lg.add(roofSnow);

    const goldTrim = new THREE.Mesh(lanternAssets.goldTrimGeo, champagneGoldMat);
    lg.add(goldTrim);

    const eaveIcicles = new THREE.Mesh(lanternAssets.icicleGeo, crystalOuterMat);
    lg.add(eaveIcicles);

    // 4. Levitating polyhedral dual-layer glowing arcane crystal gem + gold gyroscope ring inside cage
    const floatNode = new THREE.Group();
    const baseFloatY = 1.73;
    floatNode.position.y = baseFloatY;

    const crystal = new THREE.Group();
    const gemInner = new THREE.Mesh(lanternAssets.coreInnerGeo, lanternCrystalMat);
    crystal.add(gemInner);
    const gemOuter = new THREE.Mesh(lanternAssets.coreOuterGeo, crystalOuterMat);
    gemOuter.renderOrder = 2;
    crystal.add(gemOuter);
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
          opacity: 0.64,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const glowSprite = new THREE.Sprite(spriteMat);
      glowSprite.scale.set(1.55, 1.55, 1);
      floatNode.add(glowSprite);
    }

    lg.add(floatNode);
    group.add(lg);
    floatingLanterns.push({ floatNode, crystal, ring, baseFloatY, phase: lc.phase });
  }

  // =========================================================================
  // 8. DISTANT KNIFE-EDGE ALPINE GLACIAL MOUNTAIN RIDGES (2-Layer Panoramic Horizon)
  // =========================================================================
  const mountainParts = [];
  const mountainSpecs = [
    // Mid-far dramatic knife-edge peaks
    { x: -34, z: -28, r: 11.2, h: 16.0, rot: 0.4, far: false },
    { x: -20, z: -31, r: 12.4, h: 18.8, rot: 1.2, far: false },
    { x: -6, z: -33, r: 12.6, h: 17.0, rot: 2.1, far: false },
    { x: 9, z: -32, r: 11.8, h: 18.4, rot: 0.8, far: false },
    { x: 24, z: -30, r: 12.4, h: 17.2, rot: 1.9, far: false },
    { x: 37, z: -26, r: 10.8, h: 14.8, rot: 0.5, far: false },
    // Connecting serrated shoulder ridges & secondary alpine horns
    { x: -27, z: -30, r: 8.6, h: 12.6, rot: 2.6, far: false },
    { x: -13, z: -32, r: 9.2, h: 13.8, rot: 1.5, far: false },
    { x: 2, z: -33, r: 9.0, h: 13.4, rot: 0.9, far: false },
    { x: 16.5, z: -31, r: 8.8, h: 13.2, rot: 2.2, far: false },
    { x: 31, z: -28, r: 8.4, h: 12.0, rot: 1.1, far: false },
    // Far grand glacial cathedral spires
    { x: -42, z: -38, r: 15.2, h: 24.8, rot: 0.9, far: true },
    { x: -27, z: -41, r: 15.8, h: 28.4, rot: 1.7, far: true },
    { x: -12, z: -42, r: 15.4, h: 25.8, rot: 2.8, far: true },
    { x: 3, z: -43, r: 16.6, h: 29.5, rot: 0.3, far: true },
    { x: 18, z: -41, r: 15.8, h: 27.0, rot: 1.4, far: true },
    { x: 34, z: -39, r: 14.6, h: 24.2, rot: 2.4, far: true },
    { x: 46, z: -33, r: 13.6, h: 20.8, rot: 0.7, far: true },
  ];

  for (let m = 0; m < mountainSpecs.length; m++) {
    mountainParts.push(createAlpinePeakGeo(THREE, mountainSpecs[m], 3.7 + m * 5.3, fogColorVec));
  }

  const mountainGeo = trackGeo(mergeGeometries(THREE, mountainParts));
  const mountainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.76,
      metalness: 0.04,
      flatShading: true,
    })
  );
  const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
  mountainMesh.name = 'distant_glacial_mountains';
  group.add(mountainMesh);

  // =========================================================================
  // 9. FOREGROUND TILT-SHIFT CORNER PROPS (Gnarled Root Stumps & Dual-Layer Crystal Tufts)
  //    Strictly outer bottom corners |x| >= 8.9, z >= 5.0, height <= 1.1m
  // =========================================================================
  const stumpAssets = buildSculptedStumpGeometries(THREE);
  trackGeo(stumpAssets.barkGeo);
  trackGeo(stumpAssets.topGeo);
  trackGeo(stumpAssets.snowGeo);
  const woodRingsTex = createWoodRingsTexture(THREE, trackedTextures);

  const barkSolidMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: barkTex.roughnessMap ? 0.92 : 0.86,
      metalness: 0.02,
      ...(barkTex.map ? { map: barkTex.map } : {}),
      ...(barkTex.normalMap ? { normalMap: barkTex.normalMap, normalScale: new THREE.Vector2(0.85, 0.85) } : {}),
      ...(barkTex.bumpMap ? { bumpMap: barkTex.bumpMap, bumpScale: 0.12 } : {}),
    })
  );
  const cutWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.02,
      ...(woodRingsTex ? { map: woodRingsTex } : {}),
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

    const body = new THREE.Mesh(stumpAssets.barkGeo, barkSolidMat);
    body.castShadow = true;
    body.receiveShadow = true;
    sg.add(body);

    const topRing = new THREE.Mesh(stumpAssets.topGeo, cutWoodMat);
    topRing.receiveShadow = true;
    sg.add(topRing);

    const snowHat = new THREE.Mesh(stumpAssets.snowGeo, snowPillowMat);
    snowHat.receiveShadow = true;
    sg.add(snowHat);

    group.add(sg);
  }

  // Low foreground corner miniature dual-layer ice crystal tufts with base splinters & mini snow collar
  const fgCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8f6ff,
      vertexColors: true,
      emissive: 0x6be8ff,
      emissiveIntensity: 1.08,
      roughness: 0.18,
      metalness: 0.05,
      flatShading: true,
    })
  );
  animatedCrystalCores.push({ mat: fgCoreMat, baseInt: 1.08, phase: 1.1 });

  const fgMiniCoreGeo = trackGeo(
    createCrystalPrismGeo(THREE, 0.28, 1.68, 8.9, { nFaces: 5, bevelFrac: 0.14, oblique: 0.21, colBase: 0xb49cff, colMid: 0x6ef0ff, colTip: 0xeaffff })
  );
  const fgMiniCollarGeo = trackGeo(createSculptedSnowCollarGeo(THREE, 0.12, 0.56, 0.14, 14.2));

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

    const miniCollar = new THREE.Mesh(fgMiniCollarGeo, snowPillowMat);
    miniCollar.scale.setScalar(fc.s * 2.1);
    miniCollar.position.y = 0.02;
    miniCollar.receiveShadow = true;
    fgGroup.add(miniCollar);

    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI * 2 + i;
      const sc = fc.s * (k === 0 ? 1.0 : 0.74);

      const core = new THREE.Mesh(fgMiniCoreGeo, fgCoreMat);
      core.position.set(Math.cos(ang) * 0.15, 0, Math.sin(ang) * 0.15);
      core.rotation.set(Math.sin(ang) * 0.32, ang, -Math.cos(ang) * 0.32);
      core.scale.set(sc * 0.62, sc * 0.80, sc * 0.62);
      fgGroup.add(core);

      const shard = new THREE.Mesh(shardOuterGeos[(k + 1) % shardOuterGeos.length], crystalOuterMat);
      shard.position.copy(core.position);
      shard.rotation.copy(core.rotation);
      shard.scale.set(sc, sc * 0.92, sc);
      shard.renderOrder = 2;
      fgGroup.add(shard);
    }
    // 4 miniature jagged base splinters
    for (let sp = 0; sp < 4; sp++) {
      const ang = (sp / 4) * Math.PI * 2 + i * 0.7 + 0.35;
      const spl = new THREE.Mesh(splinterOuterGeos[sp % splinterOuterGeos.length], crystalOuterMat);
      spl.position.set(Math.cos(ang) * 0.26 * (fc.s * 2.2), 0.01, -Math.sin(ang) * 0.26 * (fc.s * 2.2));
      spl.rotation.set(Math.sin(ang) * 0.62, ang, -Math.cos(ang) * 0.62);
      spl.scale.setScalar(fc.s * 1.15);
      spl.renderOrder = 2;
      fgGroup.add(spl);
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
        bloomStrength: 0.34, bloomThreshold: 0.92, bloomRadius: 0.62,
        focusDepth: 0.56, blurAmount: 1.85, vignetteStrength: 0.14,
        spriteRimTint: [0.96, 1.0, 1.03],
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
        bloomStrength: 0.38, bloomThreshold: 0.90, bloomRadius: 0.66,
        focusDepth: 0.56, blurAmount: 1.80, vignetteStrength: 0.22,
        spriteRimTint: [0.98, 1.0, 1.03],
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
        bloomStrength: 0.32, bloomThreshold: 0.93, bloomRadius: 0.60,
        focusDepth: 0.56, blurAmount: 1.75, vignetteStrength: 0.15,
        spriteRimTint: [0.92, 1.0, 1.03],
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
        bloomStrength: 0.40, bloomThreshold: 0.90, bloomRadius: 0.68,
        focusDepth: 0.56, blurAmount: 1.65, vignetteStrength: 0.16,
        spriteRimTint: [0.88, 1.01, 1.03],
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
    for (let i = 0; i < animatedCrystalHearts.length; i++) {
      animatedCrystalHearts[i].mat.color.copy(s.crystalEmissive).lerp(whiteTintColor, 0.58);
    }
    for (let i = 0; i < animatedCrystalLights.length; i++) {
      animatedCrystalLights[i].light.color.copy(s.crystalLightColor);
    }
    lanternCrystalMat.emissive.copy(s.crystalEmissive);
    lanternCrystalMat.emissiveIntensity = 1.65 * s.crystalEmissiveMul;
    moteMat.color.copy(s.moteColor);
    moteMat.size = s.moteSize;

    terrainMat.color.copy(s.terrainTint);
    if (arenaSheenMat) arenaSheenMat.color.copy(baseArenaSheenColor).multiply(s.terrainTint);
    firSnowMat.color.copy(s.foliageSnowTint);
    firIcicleMat.color.copy(s.foliageSnowTint).lerp(whiteTintColor, 0.25);
    birchCanopyMat.color.copy(s.foliageSnowTint);
    birchTrunkMat.color.copy(s.foliageSnowTint);
    snowPillowMat.color.copy(baseSnowPillowColor).multiply(s.foliageSnowTint);
    tmpFoliageTint.copy(s.foliageSnowTint).lerp(whiteTintColor, 0.35);
    firFoliageMat.color.copy(tmpFoliageTint);
    stoneMat.color.copy(baseStoneColor).multiply(s.stoneTint);
    marbleMat.color.copy(baseMarbleColor).multiply(s.stoneTint);
    cobbleMat.color.copy(s.stoneTint);
    cutWoodMat.color.copy(s.stoneTint).lerp(whiteTintColor, 0.35);
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
    for (let i = 0; i < animatedCrystalHearts.length; i++) {
      const h = animatedCrystalHearts[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 1.45 + h.phase);
      h.mat.opacity = Math.min(0.95, h.baseOp * (0.80 + wave * 0.25));
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
