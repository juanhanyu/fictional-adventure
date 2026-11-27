/**
 * 梦境星镜决斗殿（Dream Star-Mirror Dueling Palace）
 * 《转生千金～到了异世界就要悠闲地生活》专属 HD-2D 3D 战场 Biome 模块
 * 适用关卡：贝阿特丽丝 / 爱丽丝 / 诺艾儿及全部梦境虚拟决斗（bg-duel）
 *
 * 导出契约：export function buildDuelBiome(THREE, texLib = {})
 * 安全作战平地：y = 0 上 x ∈ [-7.2, +7.2], z ∈ [-4.2, +4.2]（实际平畅半径 R = 9.85）
 *              绝对平坦无遮挡，前景视角（deg ∈ [18°, 162°], z > +2.8）完全敞开。
 */

// ---------------------------------------------------------------------------
// 1. 确定性伪随机数与纹理安全解包工具（绝不修改或释放外部 texLib 原图）
// ---------------------------------------------------------------------------
function createRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unwrapTexBundle(entry) {
  if (!entry) return {};
  if (entry.isTexture) return { map: entry };
  return {
    map: entry.map || entry.colorMap || entry.albedo || null,
    normalMap: entry.normalMap || null,
    bumpMap: entry.bumpMap || null,
    roughnessMap: entry.roughnessMap || null,
    emissiveMap: entry.emissiveMap || null,
    metalnessMap: entry.metalnessMap || null,
  };
}

function createFallbackWhiteTex(THREE) {
  const data = new Uint8Array([255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const deg2rad = (deg) => (deg * Math.PI) / 180;

// ---------------------------------------------------------------------------
// 2. 程序化高精几何构造库
// ---------------------------------------------------------------------------

/**
 * 16 凹槽古典雪瓷大理石柱身（底面位于 y = 0，顶面位于 y = height）
 */
function createFlutedColumnGeometry(THREE, radiusBottom, radiusTop, height) {
  const radialSegs = 32;
  const heightSegs = 6;
  const geom = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegs,
    heightSegs,
    false
  );
  geom.translate(0, height * 0.5, 0);

  const pos = geom.attributes.position;
  const fluteDepth = radiusBottom * 0.082;
  const invH = 1.0 / Math.max(height, 0.001);

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > radiusTop * 0.35) {
      const yNorm = y * invH;
      const fluteMask =
        THREE.MathUtils.smoothstep(yNorm, 0.04, 0.10) *
        (1.0 - THREE.MathUtils.smoothstep(yNorm, 0.90, 0.96));
      const ang = Math.atan2(z, x);
      const wave = Math.cos(ang * 16.0);
      const indent = (wave < 0 ? wave * fluteDepth : wave * fluteDepth * 0.24) * fluteMask;
      const newR = Math.max(0.04, r + indent);
      const sc = newR / r;
      x *= sc;
      z *= sc;
      pos.setXYZ(i, x, y, z);
    }
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * 零扭转弧形古典线脚放样几何（沿圆心角 startAngle -> endAngle 扫掠 2D 截面 profilePts: [[dr, dy], ...]）
 * 严格使用解析径向/竖向基向量，避免 Frenet 翻转，完美贴合圆台曲率
 */
function createCircularArcMoldingGeo(THREE, radius, startAngle, endAngle, profilePts, segs = 20) {
  const ringCount = profilePts.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  const arcLen = Math.abs(endAngle - startAngle) * radius;
  const perim = [];
  let accP = 0;
  for (let p = 0; p < ringCount; p++) {
    perim.push(accP);
    if (p < ringCount - 1) {
      const dx = profilePts[p + 1][0] - profilePts[p][0];
      const dy = profilePts[p + 1][1] - profilePts[p][1];
      accP += Math.hypot(dx, dy);
    }
  }
  const invPerim = accP > 1e-5 ? 1.0 / accP : 1.0;

  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const a = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const uCoord = t * arcLen * 0.45;
    for (let p = 0; p < ringCount; p++) {
      const rr = radius + profilePts[p][0];
      const yy = profilePts[p][1];
      positions.push(ca * rr, yy, sa * rr);
      uvs.push(uCoord, perim[p] * invPerim);
    }
  }

  const flipWinding = endAngle < startAngle;
  for (let s = 0; s < segs; s++) {
    const row0 = s * ringCount;
    const row1 = (s + 1) * ringCount;
    for (let p = 0; p < ringCount - 1; p++) {
      const a = row0 + p;
      const b = row1 + p;
      const c = row1 + p + 1;
      const d = row0 + p + 1;
      if (flipWinding) {
        indices.push(a, c, b, a, d, c);
      } else {
        indices.push(a, b, c, a, c, d);
      }
    }
  }

  // 两端端面封口
  for (const endIdx of [0, segs]) {
    const baseRow = endIdx * ringCount;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let p = 0; p < ringCount - 1; p++) {
      const idx = (baseRow + p) * 3;
      cx += positions[idx];
      cy += positions[idx + 1];
      cz += positions[idx + 2];
    }
    const denom = Math.max(1, ringCount - 1);
    const cIdx = positions.length / 3;
    positions.push(cx / denom, cy / denom, cz / denom);
    uvs.push(0.5, 0.5);

    const isStart = endIdx === 0;
    const rev = isStart ? !flipWinding : flipWinding;
    for (let p = 0; p < ringCount - 1; p++) {
      const v0 = baseRow + p;
      const v1 = baseRow + p + 1;
      if (rev) indices.push(cIdx, v1, v0);
      else indices.push(cIdx, v0, v1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 经典双心哥特尖拱（Pointed Ogival Arch）墙肩几何 + 双侧玫瑰眼孔镂空
 */
function createPointedArchSpandrelGeo(THREE, outerWidth, archSpanW, archPeakH, totalH, depth) {
  const hw = outerWidth * 0.5;
  const sw = archSpanW * 0.5;
  const h = Math.max(archPeakH, sw * 1.22);
  const cx = (h * h - sw * sw) / (2 * sw);
  const R = sw + cx;
  const apexAngle = Math.atan2(h, cx);

  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-sw, 0);

  const segs = 16;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const ang = Math.PI - t * apexAngle;
    shape.lineTo(cx + Math.cos(ang) * R, Math.sin(ang) * R);
  }
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const ang = apexAngle * (1 - t);
    shape.lineTo(-cx + Math.cos(ang) * R, Math.sin(ang) * R);
  }

  shape.lineTo(hw, 0);
  shape.lineTo(hw, totalH * 0.72);
  // 哥特尖顶山墙轮廓，轻盈优雅
  shape.lineTo(0, totalH);
  shape.lineTo(-hw, totalH * 0.72);
  shape.closePath();

  // 双侧圆形镂空玫瑰眼孔
  const oculusR = Math.min(0.19, (hw - sw) * 0.34);
  if (oculusR > 0.08) {
    for (const side of [-1, 1]) {
      const hole = new THREE.Path();
      hole.absarc(side * (sw + (hw - sw) * 0.44), h * 0.68, oculusR, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

/**
 * 哥特尖拱内部晶镜虚影幕（ShapeGeometry，归一化 UV ∈ [0,1]）
 */
function createPointedMirrorCurtainGeo(THREE, width, springH, peakExtraH) {
  const sw = width * 0.5;
  const h = Math.max(peakExtraH, sw * 1.22);
  const cx = (h * h - sw * sw) / (2 * sw);
  const R = sw + cx;
  const apexAngle = Math.atan2(h, cx);

  const shape = new THREE.Shape();
  shape.moveTo(-sw, 0);
  shape.lineTo(-sw, springH);

  const segs = 14;
  for (let i = 1; i <= segs; i++) {
    const ang = Math.PI - (i / segs) * apexAngle;
    shape.lineTo(cx + Math.cos(ang) * R, springH + Math.sin(ang) * R);
  }
  for (let i = 1; i <= segs; i++) {
    const ang = apexAngle * (1 - i / segs);
    shape.lineTo(-cx + Math.cos(ang) * R, springH + Math.sin(ang) * R);
  }
  shape.lineTo(sw, 0);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape, 14);
  const totalH = springH + h;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + sw) / width, pos.getY(i) / totalH);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * 哥特双心尖拱金肋路径（返回左右两段 CatmullRomCurve3，精准贴合尖拱内/外缘）
 */
function createPointedArchRibCurves(THREE, archSpanW, archPeakH, yOffset = 0, zOffset = 0) {
  const sw = archSpanW * 0.5;
  const h = Math.max(archPeakH, sw * 1.22);
  const cx = (h * h - sw * sw) / (2 * sw);
  const R = sw + cx;
  const apexAngle = Math.atan2(h, cx);
  const ptsL = [];
  const ptsR = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angL = Math.PI - t * apexAngle;
    ptsL.push(new THREE.Vector3(cx + Math.cos(angL) * R, Math.sin(angL) * R + yOffset, zOffset));
    const angR = t * apexAngle;
    ptsR.push(new THREE.Vector3(-cx + Math.cos(angR) * R, Math.sin(angR) * R + yOffset, zOffset));
  }
  return [new THREE.CatmullRomCurve3(ptsL), new THREE.CatmullRomCurve3(ptsR)];
}

/**
 * AAA 精细多面斜切不对称双端棱镜水晶几何（非索引逐面锐利法线，晶面折光极具钻石质感）
 */
function createAsymmetricPrismCrystalGeo(THREE, radius, topHeight, bottomHeight, sides = 6, seed = 1.0) {
  const rng = createRng(Math.floor(seed * 9973) + 17);
  const lowerRing = [];
  const upperRing = [];

  // 不对称腰线与斜切肩高，形成真实天然魔导晶尖
  const lowerY = -bottomHeight * 0.24;
  const baseShoulderY = topHeight * 0.58;

  for (let i = 0; i < sides; i++) {
    const baseAng = (i / sides) * Math.PI * 2;
    const angJitter = (rng() - 0.5) * 0.14;
    const ang = baseAng + angJitter;
    const rBot = radius * (0.86 + rng() * 0.26);
    const rTop = rBot * (0.76 + rng() * 0.14);
    const slant = Math.sin(ang + seed * 1.7) * topHeight * 0.11 + (rng() - 0.5) * topHeight * 0.07;

    lowerRing.push(new THREE.Vector3(Math.cos(ang) * rBot, lowerY, Math.sin(ang) * rBot));
    upperRing.push(new THREE.Vector3(Math.cos(ang) * rTop, baseShoulderY + slant, Math.sin(ang) * rTop));
  }

  // 斜切主晶尖与底端晶尾
  const topApex = new THREE.Vector3(
    (rng() - 0.5) * radius * 0.22,
    topHeight,
    (rng() - 0.5) * radius * 0.22
  );
  const botApex = new THREE.Vector3(
    (rng() - 0.5) * radius * 0.14,
    -bottomHeight,
    (rng() - 0.5) * radius * 0.14
  );

  const positions = [];
  const normals = [];
  const uvs = [];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const fn = new THREE.Vector3();

  function pushFacet(a, b, c, uva, uvb, uvc) {
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    fn.crossVectors(ab, ac).normalize();
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    normals.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
    uvs.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
  }

  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const u0 = i / sides;
    const u1 = (i + 1) / sides;
    const uMid = (u0 + u1) * 0.5;

    // 主棱柱侧面（逆时针朝外）
    pushFacet(lowerRing[j], lowerRing[i], upperRing[i], [u1, 0.28], [u0, 0.28], [u0, 0.72]);
    pushFacet(lowerRing[j], upperRing[i], upperRing[j], [u1, 0.28], [u0, 0.72], [u1, 0.72]);

    // 顶部斜切晶冠面
    pushFacet(upperRing[j], upperRing[i], topApex, [u1, 0.72], [u0, 0.72], [uMid, 1.0]);

    // 底部收敛晶尾面
    pushFacet(lowerRing[i], lowerRing[j], botApex, [u0, 0.28], [u1, 0.28], [uMid, 0.0]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

/**
 * 平面八芒星嵌条几何（可叠加两层偏移 45° 的四角星，组成皇家星盘八芒星蓝晶嵌条）
 */
function createFourPointStarRibbonGeo(THREE, outerR, innerR, thickness = 0.008, stripWidth = 0.14) {
  const shape = new THREE.Shape();
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  shape.closePath();

  // 内镂空，形成精致星轨蓝晶嵌条而非实心色块
  const hole = new THREE.Path();
  const scaleInner = Math.max(0.45, (innerR - stripWidth) / innerR);
  const scaleOuter = Math.max(0.55, (outerR - stripWidth * 1.85) / outerR);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR * scaleOuter : innerR * scaleInner;
    const hx = Math.cos(a) * r;
    const hy = Math.sin(a) * r;
    if (i === 0) hole.moveTo(hx, hy);
    else hole.lineTo(hx, hy);
  }
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI * 0.5);
  return geo;
}

/**
 * 倒锥形雪瓷晶骨底冠（托起浮空星盘圆台底部）
 */
function createInvertedCrystalSpireGeo(THREE, topRadius, height, sides = 16) {
  const geo = new THREE.CylinderGeometry(topRadius, topRadius * 0.03, height, sides, 6, false);
  geo.translate(0, -height * 0.5, 0);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cTop = new THREE.Color(0xdce6f5);
  const cMid = new THREE.Color(0xa6c0e4);
  const cBot = new THREE.Color(0x5282c8);
  const cVein = new THREE.Color(0x6ad8ff);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(-y / height, 0, 1);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);

    if (r > 0.02) {
      // 对称菱面切棱，展现精致晶石雕琢感而非粗砾土石
      const flute = Math.cos(a * 8.0) * 0.085 * THREE.MathUtils.smoothstep(t, 0.06, 0.35);
      const stepTier = Math.sin(t * Math.PI * 4.0) * 0.045;
      const curveProfile = Math.pow(1.0 - t, 0.72) / Math.max(0.04, 1.0 - t * 0.96);
      const mul = Math.max(0.16, (1.0 + flute + stepTier) * (0.75 + 0.25 * curveProfile));
      x *= mul;
      z *= mul;
      pos.setXYZ(i, x, y, z);
    }

    if (t < 0.5) tmp.lerpColors(cTop, cMid, t * 2.0);
    else tmp.lerpColors(cMid, cBot, (t - 0.5) * 2.0);
    const vein = Math.pow(Math.max(0, Math.cos(a * 8.0)), 8.0) * THREE.MathUtils.smoothstep(t, 0.2, 0.85);
    tmp.lerp(cVein, vein * 0.36);

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// 3. 主构建入口：梦境星镜决斗殿 Biome
// ---------------------------------------------------------------------------
export function buildDuelBiome(THREE, texLib = {}) {
  const group = new THREE.Group();
  group.name = 'biome_duel';

  const rng = createRng(20261127);

  // 资源追踪（完整释放所有自建 GPU 资源，严禁 dispose 外部 texLib 共享原图）
  const ownedGeometries = [];
  const ownedMaterials = [];
  const ownedTextures = [];
  let disposed = false;

  const trackGeo = (g) => {
    ownedGeometries.push(g);
    return g;
  };
  const trackMat = (m) => {
    ownedMaterials.push(m);
    return m;
  };
  const trackTex = (t) => {
    ownedTextures.push(t);
    return t;
  };

  function cloneRepeat(tex, rx = 1, ry = 1) {
    if (!tex || !tex.isTexture) return null;
    const c = tex.clone();
    c.wrapS = THREE.RepeatWrapping;
    c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    return trackTex(c);
  }

  function applyPBRMaps(params, entry, rx = 1, ry = 1, bumpScale = 0.028) {
    const b = unwrapTexBundle(entry);
    if (b.map) params.map = cloneRepeat(b.map, rx, ry);
    if (b.normalMap) {
      params.normalMap = cloneRepeat(b.normalMap, rx, ry);
      params.normalScale = new THREE.Vector2(0.48, 0.48);
    } else if (b.bumpMap) {
      params.bumpMap = cloneRepeat(b.bumpMap, rx, ry);
      params.bumpScale = bumpScale;
    }
    if (b.roughnessMap) params.roughnessMap = cloneRepeat(b.roughnessMap, rx, ry);
    if (b.metalnessMap) params.metalnessMap = cloneRepeat(b.metalnessMap, rx, ry);
    return params;
  }

  // 解析共享 PBR 纹理包
  const arcaneBundle = unwrapTexBundle(texLib.arcaneFloorDecal);
  const cloudBundle = unwrapTexBundle(texLib.cloudNoise);
  const glowBundle = unwrapTexBundle(texLib.softGlowDisc);

  const fallbackWhite = trackTex(createFallbackWhiteTex(THREE));
  const rawArcane = arcaneBundle.map || null;
  const rawCloud = cloudBundle.map || null;
  const rawGlow = glowBundle.map || null;
  const cloudSampleTex = rawCloud ? cloneRepeat(rawCloud, 1, 1) : fallbackWhite;

  // 实时动画追踪容器
  const shaderUniforms = [];
  const floatingArches = [];
  const floatingClusters = [];
  const lanternFlames = [];
  const rotatingRings = [];
  const armillaryAssemblies = [];
  const pulsedLights = [];

  // =========================================================================
  // 4. 共享核心 PBR 材质（克制亮度、雪瓷温润、严防惨白过曝）
  // =========================================================================
  const matPorcelainDeck = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xd8e4f4,
          roughness: 0.44,
          metalness: 0.06,
        },
        texLib.marble,
        4.6,
        4.6,
        0.02
      )
    )
  );

  const matMarbleLight = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xe0e9f6,
          roughness: 0.38,
          metalness: 0.06,
        },
        texLib.marble,
        1.6,
        2.4,
        0.022
      )
    )
  );

  const matMarbleArch = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xdce6f4,
          roughness: 0.40,
          metalness: 0.07,
        },
        texLib.marble,
        0.36,
        0.36,
        0.02
      )
    )
  );

  const matJadeBaluster = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xd5e3f3,
          roughness: 0.34,
          metalness: 0.08,
        },
        texLib.marble,
        1.2,
        1.4,
        0.018
      )
    )
  );

  const matMarbleTrim = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xc5d5ec,
          roughness: 0.48,
          metalness: 0.08,
        },
        texLib.courtyardStone || texLib.marble,
        2.8,
        1.2,
        0.024
      )
    )
  );

  const matRoyalLapis = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a56dc,
      emissive: 0x0b2a78,
      emissiveIntensity: 0.24,
      roughness: 0.32,
      metalness: 0.22,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );

  const matStarBlueInlay = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4ec4ff,
      emissive: 0x1658eb,
      emissiveIntensity: 0.56,
      roughness: 0.18,
      metalness: 0.18,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );

  const matChampagneGold = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdfb96a,
      emissive: 0x45310d,
      emissiveIntensity: 0.18,
      roughness: 0.28,
      metalness: 0.68,
    })
  );

  const matGoldFlush = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdec074,
      emissive: 0x3c2b0a,
      emissiveIntensity: 0.16,
      roughness: 0.30,
      metalness: 0.66,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );

  const matArmillaryGold = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6c87d,
      emissive: 0x6b4e18,
      emissiveIntensity: 0.34,
      roughness: 0.24,
      metalness: 0.64,
      fog: false,
    })
  );

  const matUnderSpire = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0.08,
    })
  );

  // AAA 悬浮棱镜水晶双层材质：半透明折光外晶壳 + 内发光蓝金晶核
  const matPrismShell = trackMat(
    new THREE.MeshPhysicalMaterial(
      applyPBRMaps(
        {
          color: 0x8ee2ff,
          emissive: 0x1f7ee0,
          emissiveIntensity: 0.36,
          roughness: 0.09,
          metalness: 0.08,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
          iridescence: 0.68,
          iridescenceIOR: 1.38,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        },
        texLib.iceCrystal,
        1.2,
        1.8,
        0.022
      )
    )
  );

  const matPrismCore = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb6eeff,
      emissive: 0x52c8ff,
      emissiveIntensity: 0.92,
      roughness: 0.18,
      metalness: 0.15,
    })
  );

  const matPrismGoldCore = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe2a2,
      emissive: 0xdba544,
      emissiveIntensity: 0.78,
      roughness: 0.22,
      metalness: 0.35,
    })
  );

  const matLanternCore = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4f2ff,
      emissive: 0x62ccff,
      emissiveIntensity: 0.95,
      roughness: 0.2,
      metalness: 0.1,
    })
  );

  const matHaloCyan = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x6fd4ff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );

  const matHaloGold = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf2d182,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );

  const matCrystalGlowSprite = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x76d6ff,
      map: rawGlow,
      transparent: true,
      opacity: 0.30,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  const matLanternHaloSprite = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x9ce2ff,
      map: rawGlow,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  // =========================================================================
  // 5. 清朗星镜光影系统（精细配平光照总量，立面立体通透、绝不过曝）
  // =========================================================================
  const sunDir = new THREE.Vector3(-8.0, 14.5, -12.0).normalize();

  const hemiLight = new THREE.HemisphereLight(0xcce4ff, 0xb8cbe4, 0.92);
  hemiLight.position.set(0, 28, 0);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e4, 1.68);
  sunLight.position.set(-10.5, 19.5, -11.5);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -15.5;
  sunLight.shadow.camera.right = 15.5;
  sunLight.shadow.camera.top = 15.5;
  sunLight.shadow.camera.bottom = -14.5;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 52.0;
  sunLight.shadow.bias = -0.00042;
  sunLight.shadow.normalBias = 0.028;
  group.add(sunLight);
  group.add(sunLight.target);

  // 前右侧柔和补光，凸显雕花玉石栏杆与哥特凹槽柱立体阴翳
  const frontFillLight = new THREE.DirectionalLight(0xd4e8ff, 0.46);
  frontFillLight.position.set(10.0, 8.5, 13.5);
  frontFillLight.castShadow = false;
  group.add(frontFillLight);

  const ambientLight = new THREE.AmbientLight(0xc6dcf4, 0.18);
  group.add(ambientLight);

  // 后景双灯柱柔光与中央主星晶柔光
  const lanternLights = [];
  for (const side of [-1, 1]) {
    const a = deg2rad(side < 0 ? -106 : -74);
    const lLight = new THREE.PointLight(0x94dcff, 3.8, 11.5, 1.7);
    lLight.position.set(Math.cos(a) * 9.52, 2.05, Math.sin(a) * 9.52);
    group.add(lLight);
    lanternLights.push(lLight);
    pulsedLights.push({ light: lLight, base: 3.8, amp: 0.45, speed: 1.5, phase: side < 0 ? 0.3 : 2.1 });
  }

  const vistaCrystalLight = new THREE.PointLight(0x6ad6ff, 6.5, 18.0, 1.5);
  vistaCrystalLight.position.set(0, 4.4, -14.2);
  group.add(vistaCrystalLight);
  pulsedLights.push({ light: vistaCrystalLight, base: 6.5, amp: 0.9, speed: 1.25, phase: 1.1 });

  // =========================================================================
  // 6. 清澈冰蓝雪白梯度梦境穹顶 + 高空云海（自定义 GLSL 着色器）
  // =========================================================================
  const skyUniforms = {
    uTime: { value: 0 },
    uZenithColor: { value: new THREE.Color(0x2e6bd4) },
    uMidSkyColor: { value: new THREE.Color(0x7fb9f2) },
    uHorizonColor: { value: new THREE.Color(0xdcebfa) },
    uSunWarmColor: { value: new THREE.Color(0xfff0d4) },
    uLowerMistColor: { value: new THREE.Color(0xc5daf3) },
    uCloudTint: { value: new THREE.Color(0xeef6ff) },
    uAuroraColor: { value: new THREE.Color(0x7be0ff) },
    uStarStrength: { value: 0.58 },
    uSunStrength: { value: 0.65 },
    uSunDir: { value: sunDir.clone() },
    uCloudTex: { value: cloudSampleTex },
    uHasCloudTex: { value: rawCloud ? 1.0 : 0.0 },
  };
  shaderUniforms.push(skyUniforms);

  const matSkyDome = trackMat(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uZenithColor;
        uniform vec3 uMidSkyColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunWarmColor;
        uniform vec3 uLowerMistColor;
        uniform vec3 uCloudTint;
        uniform vec3 uAuroraColor;
        uniform float uStarStrength;
        uniform float uSunStrength;
        uniform vec3 uSunDir;
        uniform sampler2D uCloudTex;
        uniform float uHasCloudTex;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec3 d = normalize(vWorldDir);
          float h = d.y;

          // 清澈雪瓷冰蓝梦境梯度穹顶
          vec3 col;
          if (h >= 0.0) {
            col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.28, h));
            col = mix(col, uZenithColor, smoothstep(0.22, 0.88, h));
          } else {
            col = mix(uHorizonColor, uLowerMistColor, smoothstep(0.0, -0.38, h));
          }

          // 地平线微光丝带（克制不爆白）
          float horBand = exp(-abs(h - 0.01) * 14.0);
          col = mix(col, mix(uHorizonColor, uSunWarmColor, 0.32), horBand * 0.35);

          // 轻柔定向日辉散射
          float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
          float softHalo = pow(sunDot, 6.0) * 0.18 + pow(sunDot, 28.0) * 0.22;
          float sunCore = smoothstep(0.996, 0.9994, sunDot) * 0.32;
          col += uSunWarmColor * (softHalo + sunCore) * uSunStrength;

          // 梦境薄纱极光纹与高空丝絮卷云
          if (h > 0.03) {
            vec2 skyUv = d.xz / (h + 0.34) * 0.26;
            vec2 uv1 = skyUv + vec2(uTime * 0.0045, -uTime * 0.0022);
            vec2 uv2 = skyUv * 1.75 - vec2(uTime * 0.003, uTime * 0.0018);
            float c1 = mix(vnoise(uv1 * 5.2), texture2D(uCloudTex, uv1).r, uHasCloudTex);
            float c2 = mix(vnoise(uv2 * 5.2), texture2D(uCloudTex, uv2).r, uHasCloudTex);
            float cirrus = smoothstep(0.55, 0.85, c1 * 0.62 + c2 * 0.38);
            float cloudBand = smoothstep(0.05, 0.20, h) * (1.0 - smoothstep(0.58, 0.90, h));
            vec3 cCol = mix(uCloudTint, uSunWarmColor, pow(sunDot, 3.0) * 0.32);
            col = mix(col, cCol, cirrus * cloudBand * 0.34);

            // 极淡梦境星纱极光幕
            float ang = atan(d.z, d.x);
            float ribbon = sin(ang * 3.0 + sin(ang * 2.0 + uTime * 0.14) * 1.1 + h * 7.0);
            float veil = pow(max(0.0, ribbon), 5.0) * smoothstep(0.09, 0.32, h) * (1.0 - smoothstep(0.52, 0.85, h));
            col += uAuroraColor * veil * 0.13;

            // 晴日梦境微闪烁星尘（高空细腻星点）
            vec2 starUv = vec2(ang * 14.0, h * 46.0);
            vec2 cell = floor(starUv);
            vec2 f = fract(starUv) - 0.5;
            float rnd = hash21(cell);
            if (rnd > 0.935) {
              float dist = length(f);
              float starPt = smoothstep(0.18, 0.015, dist);
              float twinkle = 0.55 + 0.45 * sin(uTime * (1.8 + rnd * 3.0) + rnd * 42.0);
              float starMask = smoothstep(0.14, 0.42, h);
              vec3 sCol = mix(vec3(0.84, 0.94, 1.0), vec3(1.0, 0.92, 0.72), fract(rnd * 17.3));
              col += sCol * starPt * twinkle * starMask * uStarStrength * 0.62;
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );

  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(98, 44, 28)), matSkyDome);
  skyDome.name = 'duel_sky_dome';
  skyDome.renderOrder = -12;
  group.add(skyDome);

  // 平台下方双层柔缓梦境云海（衬托雪瓷星盘大殿与外围哥特拱门悬空感）
  const cloudLayers = [];
  function createDreamCloudLayer({ y, size, segs, speed, scale, opacity, clearCenter }) {
    const uniforms = {
      uTime: { value: 0 },
      uCloudTex: { value: cloudSampleTex },
      uHasCloudTex: { value: rawCloud ? 1.0 : 0.0 },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uOpacity: { value: opacity },
      uClearCenter: { value: clearCenter },
      uSunDir: { value: sunDir.clone() },
      uShadowColor: { value: new THREE.Color(0x6e98cc) },
      uBodyColor: { value: new THREE.Color(0xdfecfa) },
      uRimColor: { value: new THREE.Color(0xf7ead4) },
      uFogColor: { value: new THREE.Color(0xcfe2f6) },
    };
    shaderUniforms.push(uniforms);
    cloudLayers.push({ uniforms });

    const mat = trackMat(
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vWorldXZ;
          varying float vDist;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            wp.y += sin(wp.x * 0.08 + uTime * 0.28) * cos(wp.z * 0.07 - uTime * 0.22) * 0.34;
            vWorldXZ = wp.xz;
            vDist = length(wp.xz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform sampler2D uCloudTex;
          uniform float uHasCloudTex;
          uniform float uSpeed;
          uniform float uScale;
          uniform float uOpacity;
          uniform float uClearCenter;
          uniform vec3 uSunDir;
          uniform vec3 uShadowColor;
          uniform vec3 uBodyColor;
          uniform vec3 uRimColor;
          uniform vec3 uFogColor;
          varying vec2 vWorldXZ;
          varying float vDist;

          float hash2(vec2 p) {
            p = fract(p * vec2(234.34, 435.345));
            p += dot(p, p + 34.23);
            return fract(p.x * p.y);
          }

          float vnoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
              mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          float sampleCloud(vec2 uv) {
            float proc = vnoise(uv * 4.8) * 0.65 + vnoise(uv * 10.2) * 0.35;
            float texV = texture2D(uCloudTex, uv).r;
            return mix(proc, texV, uHasCloudTex);
          }

          float fbmCloud(vec2 p, float t) {
            vec2 d1 = vec2(t * 0.72, -t * 0.34);
            vec2 d2 = vec2(-t * 0.45, -t * 0.56);
            float n1 = sampleCloud(p + d1);
            vec2 warp = vec2(n1 - 0.5, sampleCloud(p * 1.4 - d2) - 0.5) * 0.14;
            float n2 = sampleCloud(p * 1.9 + d2 + warp);
            float n3 = sampleCloud(p * 3.4 + d1 * 1.5);
            return n1 * 0.54 + n2 * 0.32 + n3 * 0.14;
          }

          void main() {
            float t = uTime * uSpeed;
            vec2 uv = vWorldXZ * uScale;
            float d0 = fbmCloud(uv, t);
            vec2 stepSun = normalize(uSunDir.xz + vec2(1e-4)) * 0.03;
            float dSun = fbmCloud(uv + stepSun, t);
            float lit = clamp((d0 - dSun) * 3.2 + 0.50, 0.0, 1.0);

            float density = smoothstep(0.34, 0.80, d0);
            float crest = smoothstep(0.60, 0.88, d0);

            vec3 col = mix(uShadowColor, uBodyColor, smoothstep(0.18, 0.78, density * 0.7 + lit * 0.36));
            col = mix(col, uRimColor, crest * 0.46);

            float centerMask = mix(1.0, smoothstep(6.2, 16.5, vDist) * 0.58 + 0.42, uClearCenter);
            float outerFade = 1.0 - smoothstep(46.0, 86.0, vDist);
            float fogMix = smoothstep(26.0, 74.0, vDist);
            col = mix(col, uFogColor, fogMix * 0.80);

            float alpha = density * uOpacity * centerMask * outerFade;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
    );

    const geo = trackGeo(new THREE.PlaneGeometry(size, size, segs, segs));
    geo.rotateX(-Math.PI * 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.renderOrder = -4;
    group.add(mesh);
    return mesh;
  }

  createDreamCloudLayer({
    y: -3.6,
    size: 180,
    segs: 44,
    speed: 0.016,
    scale: 0.025,
    opacity: 0.72,
    clearCenter: 1.0,
  });
  createDreamCloudLayer({
    y: -6.4,
    size: 210,
    segs: 36,
    speed: 0.009,
    scale: 0.018,
    opacity: 0.90,
    clearCenter: 0.0,
  });

  // =========================================================================
  // 7. 雪瓷冰镜星盘大殿平台（y = 0 绝对平畅，半径 R = 9.85）
  //    + 香槟金同心星轨刻度环 + 八芒星蓝晶嵌条 + 冰镜釉面微光
  // =========================================================================
  const platformGroup = new THREE.Group();
  platformGroup.name = 'star_mirror_platform';
  group.add(platformGroup);

  // 主雪瓷大理石拼花圆台：顶面严格处于 y = 0.000
  const R_DECK = 9.85;
  const mainDeck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(R_DECK, R_DECK + 0.08, 0.44, 64)),
    matPorcelainDeck
  );
  mainDeck.position.y = -0.22;
  mainDeck.receiveShadow = true;
  mainDeck.castShadow = true;
  platformGroup.add(mainDeck);

  // 冰镜拼花光泽与细腻星盘纹路覆层（y = 0.003，柔和镜面折射与大理石径向接缝，严防泛白）
  const mirrorFloorUniforms = {
    uTime: { value: 0 },
    uMirrorTint: { value: new THREE.Color(0x88c4f4) },
    uInlayBlue: { value: new THREE.Color(0x1658eb) },
    uGoldTint: { value: new THREE.Color(0xdcb86a) },
  };
  shaderUniforms.push(mirrorFloorUniforms);

  const matIceMirrorOverlay = trackMat(
    new THREE.ShaderMaterial({
      uniforms: mirrorFloorUniforms,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uMirrorTint;
        uniform vec3 uInlayBlue;
        uniform vec3 uGoldTint;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 0.995) discard;
          float a = atan(p.y, p.x);

          // 1. 细腻的雪瓷拼花同心砖缝与 16 瓣径向分隔线（增强地面建筑精致度）
          float seamR1 = smoothstep(0.0045, 0.001, abs(r - 0.255));
          float seamR2 = smoothstep(0.0045, 0.001, abs(r - 0.505));
          float seamR3 = smoothstep(0.0045, 0.001, abs(r - 0.775));
          float seamRad = smoothstep(0.0055, 0.0012, abs(sin(a * 8.0)) * r) * smoothstep(0.24, 0.28, r);
          float seams = clamp(seamR1 + seamR2 + seamR3 + seamRad * 0.65, 0.0, 1.0);

          // 2. 淡皇家蓝拼花星盘环带（中圈与外圈交错柔和雪瓷冷蓝底韵）
          float bandInner = smoothstep(0.475, 0.485, r) * (1.0 - smoothstep(0.515, 0.525, r));
          float bandOuter = smoothstep(0.895, 0.905, r) * (1.0 - smoothstep(0.955, 0.965, r));
          float checker = step(0.0, sin(a * 16.0)) * 0.35 + 0.65;

          // 3. 细腻星轨度盘微刻线（外中环 48 刻度）
          float dialTicks = smoothstep(0.015, 0.004, abs(r - 0.56)) * smoothstep(0.68, 0.92, cos(a * 48.0));
          float fineRing = smoothstep(0.005, 0.0015, abs(r - 0.585));

          // 4. 冰镜掠射冷光 Sheen（随视角柔润流动，保持半透通透质感）
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(viewDir.y, 0.0), 2.4);
          float caustic = 0.5 + 0.5 * sin(r * 16.0 - uTime * 0.75 + cos(a * 4.0) * 1.4);
          float mirrorSheen = fresnel * (0.14 + 0.08 * caustic) * (1.0 - smoothstep(0.90, 0.99, r));

          vec3 col = uMirrorTint;
          float alpha = mirrorSheen;

          // 叠加青蓝砖缝阴影线（微压深雪瓷接缝增加立体拼花层次）
          col = mix(col, uInlayBlue * 0.72, seams * 0.62);
          alpha = max(alpha, seams * 0.26);

          // 叠加皇家蓝拼花嵌环
          float blueBand = (bandInner * 0.55 + bandOuter * 0.72) * checker;
          col = mix(col, uInlayBlue, blueBand * 0.85);
          alpha = max(alpha, blueBand * 0.34);

          // 叠加香槟金刻度线
          float goldMark = clamp(dialTicks * 0.85 + fineRing * 0.6, 0.0, 1.0);
          col = mix(col, uGoldTint, goldMark);
          alpha = max(alpha, goldMark * 0.46);

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.58));
        }
      `,
    })
  );

  const iceMirrorDisc = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(R_DECK * 1.97, R_DECK * 1.97)),
    matIceMirrorOverlay
  );
  iceMirrorDisc.rotation.x = -Math.PI * 0.5;
  iceMirrorDisc.position.y = 0.0035;
  platformGroup.add(iceMirrorDisc);

  // 嵌入式香槟金同心星轨刻度环（4 道 3D 齐平金属环，y = 0.005，绝对不挡战斗站位）
  const goldRingSpecs = [
    { inner: 2.28, outer: 2.38, y: 0.0055 },
    { inner: 4.58, outer: 4.74, y: 0.0055 },
    { inner: 7.42, outer: 7.56, y: 0.0055 },
    { inner: 9.18, outer: 9.38, y: 0.006 },
  ];
  for (const gs of goldRingSpecs) {
    const rGeo = trackGeo(new THREE.RingGeometry(gs.inner, gs.outer, 72));
    rGeo.rotateX(-Math.PI * 0.5);
    const rMesh = new THREE.Mesh(rGeo, matGoldFlush);
    rMesh.position.y = gs.y;
    rMesh.receiveShadow = true;
    platformGroup.add(rMesh);
  }

  // 24 枚星轨外盘香槟金刻度条（InstancedMesh 1 draw call）
  const tickGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.007, 0.36));
  const instFloorTicks = new THREE.InstancedMesh(tickGeo, matGoldFlush, 24);
  instFloorTicks.receiveShadow = true;
  const tickDummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const isMajor = i % 3 === 0;
    const r = isMajor ? 4.98 : 4.92;
    tickDummy.position.set(Math.cos(a) * r, 0.005, Math.sin(a) * r);
    tickDummy.rotation.set(0, -a + Math.PI * 0.5, 0);
    tickDummy.scale.set(isMajor ? 1.35 : 0.85, 1, isMajor ? 1.35 : 0.82);
    tickDummy.updateMatrix();
    instFloorTicks.setMatrixAt(i, tickDummy.matrix);
  }
  instFloorTicks.instanceMatrix.needsUpdate = true;
  platformGroup.add(instFloorTicks);

  // 八芒星蓝晶嵌条（双层 45° 错位皇家蓝底框 + 发光冰青星芒嵌芯 + 16 枚香槟金星节铆钉）
  const octagramBlueGeo = trackGeo(createFourPointStarRibbonGeo(THREE, 4.56, 1.86, 0.007, 0.24));
  const octagramCyanGeo = trackGeo(createFourPointStarRibbonGeo(THREE, 4.42, 1.84, 0.009, 0.095));
  for (const rotY of [0, Math.PI * 0.25]) {
    const blueStar = new THREE.Mesh(octagramBlueGeo, matRoyalLapis);
    blueStar.position.y = 0.004;
    blueStar.rotation.y = rotY;
    blueStar.receiveShadow = true;
    platformGroup.add(blueStar);

    const cyanStar = new THREE.Mesh(octagramCyanGeo, matStarBlueInlay);
    cyanStar.position.y = 0.0055;
    cyanStar.rotation.y = rotY;
    platformGroup.add(cyanStar);
  }

  // 8 方向皇家星盘射线金嵌条与外圈 8 枚冰晶菱形嵌饰
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.006, 4.38));
  const inlayGemGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.01, 4));
  const studGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, matGoldFlush);
    spoke.position.set(Math.cos(a) * 6.96, 0.0045, Math.sin(a) * 6.96);
    spoke.rotation.y = -a + Math.PI * 0.5;
    spoke.receiveShadow = true;
    platformGroup.add(spoke);

    // 星尖外缘金钉
    const tipStud = new THREE.Mesh(studGeo, matGoldFlush);
    tipStud.position.set(Math.cos(a) * 4.66, 0.007, Math.sin(a) * 4.66);
    platformGroup.add(tipStud);

    // 外环 8 枚齐平星蓝菱晶嵌饰
    const gem = new THREE.Mesh(inlayGemGeo, i % 2 === 0 ? matStarBlueInlay : matRoyalLapis);
    gem.position.set(Math.cos(a) * 8.34, 0.0065, Math.sin(a) * 8.34);
    gem.rotation.y = -a;
    platformGroup.add(gem);
  }

  // 中央缓慢反旋星镜法阵（双层精雕星轨 GLSL + arcaneFloorDecal，清透皇家蓝金配色）
  const astrolabeOuterUniforms = {
    uTime: { value: 0 },
    uTex: { value: rawArcane || fallbackWhite },
    uHasTex: { value: rawArcane ? 1.0 : 0.0 },
    uPrimaryColor: { value: new THREE.Color(0x1658eb) },
    uCyanColor: { value: new THREE.Color(0x4bc8ff) },
    uGoldColor: { value: new THREE.Color(0xe6c068) },
  };
  shaderUniforms.push(astrolabeOuterUniforms);

  const matAstrolabeOuter = trackMat(
    new THREE.ShaderMaterial({
      uniforms: astrolabeOuterUniforms,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uTex;
        uniform float uHasTex;
        uniform vec3 uPrimaryColor;
        uniform vec3 uCyanColor;
        uniform vec3 uGoldColor;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);

          vec4 texSample = texture2D(uTex, vUv);
          float texLum = max(texSample.a, dot(texSample.rgb, vec3(0.3, 0.59, 0.11)));

          float ring1 = smoothstep(0.018, 0.004, abs(r - 0.94));
          float ring2 = smoothstep(0.015, 0.004, abs(r - 0.78));
          float ticks = smoothstep(0.022, 0.005, abs(r - 0.86)) * smoothstep(0.35, 0.72, cos(a * 32.0));
          float oct = smoothstep(0.024, 0.005, abs(r - (0.58 + 0.14 * abs(cos(a * 4.0)))));
          float proc = clamp(ring1 + ring2 * 0.8 + ticks * 0.75 + oct * 0.65, 0.0, 1.0);

          float mask = mix(proc, clamp(texLum * 0.85 + proc * 0.52, 0.0, 1.0), uHasTex);
          float pulse = 0.86 + 0.14 * sin(uTime * 1.45 - r * 4.2);
          float sweep = smoothstep(0.60, 1.0, cos(a * 2.0 - uTime * 0.65));

          vec3 col = mix(uPrimaryColor, uCyanColor, smoothstep(0.24, 0.74, r));
          col = mix(col, uGoldColor, smoothstep(0.80, 0.96, r) * 0.75 + ring1 * 0.6);
          col += vec3(0.22, 0.36, 0.52) * sweep * 0.24;

          float edge = smoothstep(1.0, 0.94, r);
          float alpha = clamp(mask * 0.56 * pulse * edge, 0.0, 0.72);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );

  const astrolabeOuterMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(9.2, 9.2)),
    matAstrolabeOuter
  );
  astrolabeOuterMesh.rotation.x = -Math.PI * 0.5;
  astrolabeOuterMesh.position.y = 0.011;
  platformGroup.add(astrolabeOuterMesh);
  rotatingRings.push({ mesh: astrolabeOuterMesh, axis: 'z', speed: 0.045 });

  // 内圈反旋星象罗盘
  const astrolabeInnerUniforms = {
    uTime: { value: 0 },
    uCyanColor: { value: new THREE.Color(0x3ba8f5) },
    uGoldColor: { value: new THREE.Color(0xe6c16c) },
  };
  shaderUniforms.push(astrolabeInnerUniforms);

  const matAstrolabeInner = trackMat(
    new THREE.ShaderMaterial({
      uniforms: astrolabeInnerUniforms,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uCyanColor;
        uniform vec3 uGoldColor;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);

          float r1 = smoothstep(0.022, 0.005, abs(r - 0.90));
          float r2 = smoothstep(0.018, 0.005, abs(r - 0.54));
          float dashes = smoothstep(0.026, 0.006, abs(r - 0.72)) * smoothstep(0.15, 0.45, sin(a * 16.0));
          float rose = smoothstep(0.022, 0.005, abs(r - (0.32 + 0.16 * abs(sin(a * 4.0)))));
          float pat = clamp(r1 + r2 * 0.8 + dashes * 0.78 + rose * 0.82, 0.0, 1.0);

          float breath = 0.82 + 0.18 * sin(uTime * 1.7 + 0.8);
          vec3 col = mix(uCyanColor, uGoldColor, r1 * 0.72 + dashes * 0.48);
          float alpha = pat * 0.54 * breath;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );

  const astrolabeInnerMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(4.55, 4.55)),
    matAstrolabeInner
  );
  astrolabeInnerMesh.rotation.x = -Math.PI * 0.5;
  astrolabeInnerMesh.position.y = 0.014;
  platformGroup.add(astrolabeInnerMesh);
  rotatingRings.push({ mesh: astrolabeInnerMesh, axis: 'z', speed: -0.082 });

  // 平台阶梯式玉石底檐、雕花托座与下垂雪瓷晶骨底冠
  const deckLip = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(10.22, 10.36, 0.34, 32)),
    matMarbleTrim
  );
  deckLip.position.y = -0.36;
  deckLip.receiveShadow = true;
  platformGroup.add(deckLip);

  const lowerCornice = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(10.68, 10.12, 0.52, 16)),
    matMarbleLight
  );
  lowerCornice.position.y = -0.78;
  platformGroup.add(lowerCornice);

  const rimGoldUpper = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(10.23, 0.065, 10, 64)),
    matChampagneGold
  );
  rimGoldUpper.rotation.x = Math.PI * 0.5;
  rimGoldUpper.position.y = -0.19;
  platformGroup.add(rimGoldUpper);

  const rimGoldLower = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(10.66, 0.075, 10, 16)),
    matChampagneGold
  );
  rimGoldLower.rotation.x = Math.PI * 0.5;
  rimGoldLower.rotation.z = Math.PI / 16;
  rimGoldLower.position.y = -0.54;
  platformGroup.add(rimGoldLower);

  // 16 组台底雕花托座与镶嵌蓝晶石
  const corbelGeo = trackGeo(new THREE.BoxGeometry(0.40, 0.78, 0.76));
  const rimGemGeo = trackGeo(new THREE.OctahedronGeometry(0.15, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const corbel = new THREE.Mesh(corbelGeo, matMarbleTrim);
    corbel.position.set(Math.cos(a) * 10.02, -1.16, Math.sin(a) * 10.02);
    corbel.rotation.y = -a + Math.PI * 0.5;
    corbel.rotation.x = 0.24;
    platformGroup.add(corbel);

    const gem = new THREE.Mesh(rimGemGeo, i % 2 === 0 ? matStarBlueInlay : matChampagneGold);
    gem.position.set(Math.cos(a) * 10.58, -0.76, Math.sin(a) * 10.58);
    gem.scale.set(0.76, 1.32, 0.76);
    platformGroup.add(gem);
  }

  // 下垂晶骨底锥与双道缓慢反旋浮空魔力光环
  const underSpire = new THREE.Mesh(
    trackGeo(createInvertedCrystalSpireGeo(THREE, 9.2, 5.4, 16)),
    matUnderSpire
  );
  underSpire.position.y = -1.04;
  platformGroup.add(underSpire);

  for (const lr of [
    { r: 7.4, tube: 0.06, y: -2.15, speed: 0.14, mat: matHaloCyan },
    { r: 4.8, tube: 0.052, y: -3.65, speed: -0.20, mat: matHaloGold },
  ]) {
    const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(lr.r, lr.tube, 8, 48)), lr.mat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = lr.y;
    platformGroup.add(ring);
    rotatingRings.push({ mesh: ring, axis: 'z', speed: lr.speed });
  }

  // =========================================================================
  // 8. 古典花瓶曲线（LatheGeometry）雕花玉石护栏与 8 座八角石灯柱
  //    仅围后半圈与左右远端（deg ∈ [-192°, +12°]），前方视角完全敞开！
  // =========================================================================
  const balustradeGroup = new THREE.Group();
  balustradeGroup.name = 'jade_balustrade_and_lanterns';
  group.add(balustradeGroup);

  const R_RAIL = 9.52;
  // 8 座八角石灯柱完全左右对称分布在后半圈与左右远端（每段弧跨约 29.1°）
  // 168°(-192°) → -164° → -136° → -106° → -74° → -44° → -16° → +12°
  const lanternAnglesDeg = [-192, -164, -136, -106, -74, -44, -16, 12];

  // 经典巴洛克/西幻花瓶曲线（LatheGeometry，18 控制点，瓶腹饱满、瓶颈纤细优雅）
  const vaseProfile = [
    new THREE.Vector2(0.001, 0.00),
    new THREE.Vector2(0.088, 0.00),
    new THREE.Vector2(0.088, 0.055),
    new THREE.Vector2(0.068, 0.085),
    new THREE.Vector2(0.056, 0.125),
    new THREE.Vector2(0.072, 0.165),
    new THREE.Vector2(0.102, 0.245), // 饱满玉石花瓶腹
    new THREE.Vector2(0.106, 0.315),
    new THREE.Vector2(0.088, 0.395),
    new THREE.Vector2(0.056, 0.485), // 纤细收束瓶颈
    new THREE.Vector2(0.048, 0.545),
    new THREE.Vector2(0.064, 0.590), // 颈部雕花凸环
    new THREE.Vector2(0.052, 0.625),
    new THREE.Vector2(0.074, 0.675), // 瓶口外展
    new THREE.Vector2(0.088, 0.710),
    new THREE.Vector2(0.088, 0.745),
    new THREE.Vector2(0.001, 0.745),
  ];
  const geoVaseBaluster = trackGeo(new THREE.LatheGeometry(vaseProfile, 16));

  // 弧形扶手顶栏与基座横截面（无缝贴合圆台半径 R_RAIL）
  const topRailProfile = [
    [-0.14, 0.84],
    [0.14, 0.84],
    [0.16, 0.89],
    [0.14, 0.96],
    [0.10, 0.99],
    [-0.10, 0.99],
    [-0.14, 0.96],
    [-0.16, 0.89],
    [-0.14, 0.84],
  ];
  const goldRailTrimProfile = [
    [-0.045, 0.985],
    [0.045, 0.985],
    [0.045, 1.005],
    [-0.045, 1.005],
    [-0.045, 0.985],
  ];
  const botCurbProfile = [
    [-0.16, 0.00],
    [0.16, 0.00],
    [0.15, 0.09],
    [0.12, 0.13],
    [-0.12, 0.13],
    [-0.15, 0.09],
    [-0.16, 0.00],
  ];

  const balusterMatrices = [];
  const balDummy = new THREE.Object3D();

  for (let b = 0; b < lanternAnglesDeg.length - 1; b++) {
    const degA = lanternAnglesDeg[b];
    const degB = lanternAnglesDeg[b + 1];
    // 避开石灯柱基座半宽（约 2.6°）
    const radA = deg2rad(degA + 2.6);
    const radB = deg2rad(degB - 2.6);

    const topRail = new THREE.Mesh(
      trackGeo(createCircularArcMoldingGeo(THREE, R_RAIL, radA, radB, topRailProfile, 16)),
      matMarbleLight
    );
    topRail.castShadow = true;
    topRail.receiveShadow = true;
    balustradeGroup.add(topRail);

    const goldInlay = new THREE.Mesh(
      trackGeo(createCircularArcMoldingGeo(THREE, R_RAIL, radA, radB, goldRailTrimProfile, 16)),
      matChampagneGold
    );
    balustradeGroup.add(goldInlay);

    const botCurb = new THREE.Mesh(
      trackGeo(createCircularArcMoldingGeo(THREE, R_RAIL, radA, radB, botCurbProfile, 16)),
      matMarbleTrim
    );
    botCurb.receiveShadow = true;
    balustradeGroup.add(botCurb);

    // 每段护栏排布 9~10 根古典花瓶曲线玉石栏杆柱
    const count = Math.abs(degB - degA) > 30 ? 10 : 9;
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      const a = THREE.MathUtils.lerp(radA, radB, t);
      balDummy.position.set(Math.cos(a) * R_RAIL, 0.115, Math.sin(a) * R_RAIL);
      balDummy.rotation.set(0, -a, 0);
      balDummy.scale.set(1, 1, 1);
      balDummy.updateMatrix();
      balusterMatrices.push(balDummy.matrix.clone());
    }
  }

  // 所有古典花瓶栏杆柱合批为单个 InstancedMesh
  const instBalusters = new THREE.InstancedMesh(
    geoVaseBaluster,
    matJadeBaluster,
    balusterMatrices.length
  );
  instBalusters.castShadow = true;
  instBalusters.receiveShadow = true;
  for (let i = 0; i < balusterMatrices.length; i++) {
    instBalusters.setMatrixAt(i, balusterMatrices[i]);
  }
  instBalusters.instanceMatrix.needsUpdate = true;
  balustradeGroup.add(instBalusters);

  // 八角石灯柱共享几何体
  const geoOctBaseLow = trackGeo(new THREE.CylinderGeometry(0.42, 0.46, 0.18, 8));
  const geoOctBaseMid = trackGeo(new THREE.CylinderGeometry(0.32, 0.38, 0.16, 8));
  const geoOctShaft = trackGeo(new THREE.CylinderGeometry(0.25, 0.28, 0.88, 8));
  const geoOctGoldRing = trackGeo(new THREE.TorusGeometry(0.27, 0.028, 8, 16));
  geoOctGoldRing.rotateX(Math.PI * 0.5);
  const geoOctCapDeck = trackGeo(new THREE.CylinderGeometry(0.39, 0.27, 0.16, 8));
  const geoLanternMullion = trackGeo(new THREE.CylinderGeometry(0.022, 0.024, 0.54, 6));
  const geoLanternRoofLow = trackGeo(new THREE.CylinderGeometry(0.18, 0.42, 0.24, 8));
  const geoLanternRoofTip = trackGeo(new THREE.ConeGeometry(0.18, 0.34, 8));
  const geoLanternFinial = trackGeo(new THREE.OctahedronGeometry(0.075, 0));
  const geoLanternFlame = trackGeo(createAsymmetricPrismCrystalGeo(THREE, 0.11, 0.22, 0.16, 6, 4.1));
  const geoLanternHalo = trackGeo(new THREE.PlaneGeometry(1.15, 1.15));

  for (let i = 0; i < lanternAnglesDeg.length; i++) {
    const a = deg2rad(lanternAnglesDeg[i]);
    const isPortalPair = i === 3 || i === 4; // 正后方左右主景灯柱略高一筹
    const scaleH = isPortalPair ? 1.12 : 1.0;

    const pillar = new THREE.Group();
    pillar.position.set(Math.cos(a) * R_RAIL, 0, Math.sin(a) * R_RAIL);
    pillar.rotation.y = -a + Math.PI * 0.5;
    balustradeGroup.add(pillar);

    const bLow = new THREE.Mesh(geoOctBaseLow, matMarbleTrim);
    bLow.position.y = 0.09;
    bLow.castShadow = true;
    bLow.receiveShadow = true;
    pillar.add(bLow);

    const bMid = new THREE.Mesh(geoOctBaseMid, matMarbleLight);
    bMid.position.y = 0.26;
    bMid.castShadow = true;
    pillar.add(bMid);

    const ringBot = new THREE.Mesh(geoOctGoldRing, matChampagneGold);
    ringBot.position.y = 0.35;
    pillar.add(ringBot);

    const shaft = new THREE.Mesh(geoOctShaft, matJadeBaluster);
    shaft.position.y = 0.34 + 0.44 * scaleH;
    shaft.scale.set(1, scaleH, 1);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    pillar.add(shaft);

    const topY = 0.34 + 0.88 * scaleH;

    const ringTop = new THREE.Mesh(geoOctGoldRing, matChampagneGold);
    ringTop.position.y = topY;
    pillar.add(ringTop);

    const capDeck = new THREE.Mesh(geoOctCapDeck, matMarbleLight);
    capDeck.position.y = topY + 0.09;
    capDeck.castShadow = true;
    pillar.add(capDeck);

    // 镂空八角灯笼晶室（4 根香槟金细柱 + 悬浮星晶灯芯）
    const chamberBaseY = topY + 0.17;
    for (let m = 0; m < 4; m++) {
      const ma = (m / 4) * Math.PI * 2 + Math.PI * 0.25;
      const mullion = new THREE.Mesh(geoLanternMullion, matChampagneGold);
      mullion.position.set(Math.cos(ma) * 0.23, chamberBaseY + 0.27, Math.sin(ma) * 0.23);
      pillar.add(mullion);
    }

    const flame = new THREE.Mesh(geoLanternFlame, matLanternCore);
    flame.position.y = chamberBaseY + 0.28;
    pillar.add(flame);

    let haloMesh = null;
    if (rawGlow) {
      haloMesh = new THREE.Mesh(geoLanternHalo, matLanternHaloSprite);
      haloMesh.position.y = chamberBaseY + 0.28;
      pillar.add(haloMesh);
    }

    lanternFlames.push({
      mesh: flame,
      halo: haloMesh,
      baseY: chamberBaseY + 0.28,
      phase: i * 0.92,
    });

    // 八角石灯塔帽与金星顶饰
    const roofLow = new THREE.Mesh(geoLanternRoofLow, matMarbleLight);
    roofLow.position.y = chamberBaseY + 0.64;
    roofLow.castShadow = true;
    pillar.add(roofLow);

    const roofGoldBand = new THREE.Mesh(geoOctGoldRing, matChampagneGold);
    roofGoldBand.position.y = chamberBaseY + 0.54;
    roofGoldBand.scale.setScalar(1.38);
    pillar.add(roofGoldBand);

    const roofTip = new THREE.Mesh(geoLanternRoofTip, matRoyalLapis);
    roofTip.position.y = chamberBaseY + 0.92;
    pillar.add(roofTip);

    const finial = new THREE.Mesh(geoLanternFinial, matChampagneGold);
    finial.position.y = chamberBaseY + 1.15;
    finial.scale.set(0.85, 1.35, 0.85);
    pillar.add(finial);
  }

  // =========================================================================
  // 9. 外围 6 座对称半悬空雪白大理石哥特晶镜拱门（r ≈ 11.4 - 12.8）
  //    带 16 凹槽柱身、雕花柱头、香槟金拱肋镶边与晶镜虚影幕
  // =========================================================================
  const archesGroup = new THREE.Group();
  archesGroup.name = 'floating_gothic_mirror_arches';
  group.add(archesGroup);

  // 晶镜拱门内部半透明梦境折光虚影幕着色器
  const mirrorArchUniforms = {
    uTime: { value: 0 },
    uMirrorColorA: { value: new THREE.Color(0x88d4ff) },
    uMirrorColorB: { value: new THREE.Color(0xdfecff) },
    uGoldTrim: { value: new THREE.Color(0xf0ce7c) },
    uOpacity: { value: 0.28 },
  };
  shaderUniforms.push(mirrorArchUniforms);

  const matMirrorArchVeil = trackMat(
    new THREE.ShaderMaterial({
      uniforms: mirrorArchUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uMirrorColorA;
        uniform vec3 uMirrorColorB;
        uniform vec3 uGoldTrim;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float ndv = abs(dot(normalize(vNormalW), viewDir));
          float fresnel = pow(1.0 - ndv, 1.8);

          // 极细哥特菱格花窗脉纹 + 缓慢上升的星镜光带
          vec2 diag = vec2(vUv.x * 6.0 + vUv.y * 9.0, vUv.x * 6.0 - vUv.y * 9.0);
          float gridA = smoothstep(0.06, 0.012, abs(fract(diag.x) - 0.5));
          float gridB = smoothstep(0.06, 0.012, abs(fract(diag.y) - 0.5));
          float diamondTracery = max(gridA, gridB) * 0.42;

          // 中央竖向哥特窗棂与高光扫过波纹
          float mullionV = smoothstep(0.025, 0.006, abs(vUv.x - 0.5)) * 0.55;
          float shimmer = 0.5 + 0.5 * sin(vUv.y * 8.0 - uTime * 0.9 + vUv.x * 3.0);
          float sweep = pow(max(0.0, sin(vUv.x * 3.14159 - vUv.y * 2.4 + uTime * 0.45)), 8.0);

          float edgeSoft = smoothstep(0.0, 0.10, vUv.y) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          vec3 col = mix(uMirrorColorA, uMirrorColorB, vUv.y * 0.65 + shimmer * 0.35);
          col = mix(col, uGoldTrim, clamp(mullionV * 0.7 + diamondTracery * 0.45, 0.0, 0.85));
          col += vec3(0.35, 0.45, 0.58) * sweep * 0.35;

          float alpha = (uOpacity * (0.45 + 0.55 * fresnel + shimmer * 0.18) + diamondTracery * 0.18 + mullionV * 0.22 + sweep * 0.16) * edgeSoft;
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.55));
        }
      `,
    })
  );

  // 共享哥特柱座、雕花钟形柱头、悬浮底锥几何体
  const archBaseProfile = [
    new THREE.Vector2(0.001, 0.00),
    new THREE.Vector2(0.42, 0.00),
    new THREE.Vector2(0.42, 0.11),
    new THREE.Vector2(0.36, 0.18),
    new THREE.Vector2(0.38, 0.25),
    new THREE.Vector2(0.28, 0.34),
    new THREE.Vector2(0.25, 0.42),
  ];
  const geoArchColBase = trackGeo(new THREE.LatheGeometry(archBaseProfile, 18));

  const archCapProfile = [
    new THREE.Vector2(0.22, 0.00),
    new THREE.Vector2(0.26, 0.08),
    new THREE.Vector2(0.29, 0.22),
    new THREE.Vector2(0.40, 0.40),
    new THREE.Vector2(0.44, 0.50),
    new THREE.Vector2(0.001, 0.50),
  ];
  const geoArchColCap = trackGeo(new THREE.LatheGeometry(archCapProfile, 18));

  const geoArchPlinth = trackGeo(new THREE.BoxGeometry(0.96, 0.24, 0.96));
  const geoArchAbacus = trackGeo(new THREE.BoxGeometry(0.96, 0.15, 0.96));
  const geoArchCollar = trackGeo(new THREE.TorusGeometry(0.255, 0.032, 8, 20));
  geoArchCollar.rotateX(Math.PI * 0.5);

  const geoFloatKeel = trackGeo(new THREE.ConeGeometry(0.44, 1.55, 8));
  geoFloatKeel.rotateX(Math.PI);
  const geoFloatKeelCrystal = trackGeo(createAsymmetricPrismCrystalGeo(THREE, 0.16, 0.18, 0.65, 6, 8.3));
  const geoFloatRing = trackGeo(new THREE.TorusGeometry(0.56, 0.026, 8, 28));
  geoFloatRing.rotateX(Math.PI * 0.5);

  const geoPinnacleShaft = trackGeo(new THREE.CylinderGeometry(0.085, 0.145, 0.92, 6));
  const geoPinnacleSpire = trackGeo(new THREE.ConeGeometry(0.125, 0.64, 6));
  const geoFinialDiamond = trackGeo(new THREE.OctahedronGeometry(0.11, 0));

  // 6 座对称悬浮哥特拱门排布（从中央后景向双翼优雅递降，高度精准落于镜头取景框内）
  const gothicArchDefs = [
    // 内后方一对（守望中央星象穹顶视口）
    { deg: -108, r: 12.8, baseY: 0.30, shaftH: 2.85, spanW: 2.55, peakH: 1.82, phase: 0.0 },
    { deg: -72,  r: 12.8, baseY: 0.30, shaftH: 2.85, spanW: 2.55, peakH: 1.82, phase: 1.2 },
    // 中后翼一对（黄金分割主构图）
    { deg: -136, r: 12.1, baseY: 0.22, shaftH: 2.60, spanW: 2.45, peakH: 1.70, phase: 2.3 },
    { deg: -44,  r: 12.1, baseY: 0.22, shaftH: 2.60, spanW: 2.45, peakH: 1.70, phase: 3.5 },
    // 外翼一对（延展宽屏环抱感）
    { deg: -163, r: 11.4, baseY: 0.15, shaftH: 2.38, spanW: 2.32, peakH: 1.56, phase: 4.4 },
    { deg: -17,  r: 11.4, baseY: 0.15, shaftH: 2.38, spanW: 2.32, peakH: 1.56, phase: 5.5 },
  ];

  // 按三种规格缓存共享拱门几何（每对左右复用同一组几何体）
  const archGeoCache = new Map();

  function getArchSpecGeos(shaftH, spanW, peakH) {
    const key = `${shaftH}_${spanW}_${peakH}`;
    if (archGeoCache.has(key)) return archGeoCache.get(key);

    const outerW = spanW + 1.08;
    const spandrelTotalH = peakH + 0.62;
    const shaftGeo = trackGeo(createFlutedColumnGeometry(THREE, 0.245, 0.215, shaftH));
    const spandrelGeo = trackGeo(
      createPointedArchSpandrelGeo(THREE, outerW, spanW, peakH, spandrelTotalH, 0.48)
    );
    const curtainGeo = trackGeo(createPointedMirrorCurtainGeo(THREE, spanW + 0.04, shaftH + 0.92, peakH));

    // 内外双层香槟金拱肋
    const [inL, inR] = createPointedArchRibCurves(THREE, spanW, peakH, 0, 0.25);
    const [inLb, inRb] = createPointedArchRibCurves(THREE, spanW, peakH, 0, -0.25);
    const [outL, outR] = createPointedArchRibCurves(THREE, spanW + 0.34, peakH + 0.24, 0.05, 0.26);

    const ribInFrontL = trackGeo(new THREE.TubeGeometry(inL, 18, 0.052, 8, false));
    const ribInFrontR = trackGeo(new THREE.TubeGeometry(inR, 18, 0.052, 8, false));
    const ribInBackL = trackGeo(new THREE.TubeGeometry(inLb, 14, 0.045, 6, false));
    const ribInBackR = trackGeo(new THREE.TubeGeometry(inRb, 14, 0.045, 6, false));
    const ribOutL = trackGeo(new THREE.TubeGeometry(outL, 18, 0.038, 6, false));
    const ribOutR = trackGeo(new THREE.TubeGeometry(outR, 18, 0.038, 6, false));

    const pack = {
      outerW,
      spandrelTotalH,
      shaftGeo,
      spandrelGeo,
      curtainGeo,
      ribInFrontL,
      ribInFrontR,
      ribInBackL,
      ribInBackR,
      ribOutL,
      ribOutR,
    };
    archGeoCache.set(key, pack);
    return pack;
  }

  for (let i = 0; i < gothicArchDefs.length; i++) {
    const def = gothicArchDefs[i];
    const rad = deg2rad(def.deg);
    const geos = getArchSpecGeos(def.shaftH, def.spanW, def.peakH);

    const archHolder = new THREE.Group();
    archHolder.position.set(Math.cos(rad) * def.r, def.baseY, Math.sin(rad) * def.r);
    // 朝向星盘中心
    archHolder.rotation.y = -rad - Math.PI * 0.5;
    archesGroup.add(archHolder);

    const colHalfX = def.spanW * 0.5 + 0.26;
    const springY = 0.24 + 0.42 + def.shaftH + 0.50 + 0.14; // 柱顶线脚顶面

    // 左右半悬空雪瓷浮石门柱（含悬浮倒锥底尖、16 凹槽柱身、雕花柱头、香槟金颈环）
    for (const side of [-1, 1]) {
      const px = side * colHalfX;

      // 悬浮倒锥底座 + 底尖发光星晶 + 悬浮金环
      const keel = new THREE.Mesh(geoFloatKeel, matMarbleTrim);
      keel.position.set(px, -0.78, 0);
      archHolder.add(keel);

      const keelCrystal = new THREE.Mesh(geoFloatKeelCrystal, matPrismCore);
      keelCrystal.position.set(px, -1.48, 0);
      archHolder.add(keelCrystal);

      const floatRing = new THREE.Mesh(geoFloatRing, matChampagneGold);
      floatRing.position.set(px, -0.52, 0);
      archHolder.add(floatRing);

      // 柱基方座与线脚
      const plinth = new THREE.Mesh(geoArchPlinth, matMarbleTrim);
      plinth.position.set(px, 0.12, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      archHolder.add(plinth);

      const base = new THREE.Mesh(geoArchColBase, matMarbleLight);
      base.position.set(px, 0.24, 0);
      base.castShadow = true;
      archHolder.add(base);

      const collarBot = new THREE.Mesh(geoArchCollar, matChampagneGold);
      collarBot.position.set(px, 0.66, 0);
      archHolder.add(collarBot);

      // 16 凹槽雪瓷白大理石柱身
      const shaft = new THREE.Mesh(geos.shaftGeo, matMarbleLight);
      shaft.position.set(px, 0.66, 0);
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      archHolder.add(shaft);

      const capStartY = 0.66 + def.shaftH;
      const collarTop = new THREE.Mesh(geoArchCollar, matChampagneGold);
      collarTop.position.set(px, capStartY - 0.02, 0);
      collarTop.scale.setScalar(0.92);
      archHolder.add(collarTop);

      // 雕花钟形柱头与顶板
      const cap = new THREE.Mesh(geoArchColCap, matMarbleLight);
      cap.position.set(px, capStartY, 0);
      cap.castShadow = true;
      archHolder.add(cap);

      const abacus = new THREE.Mesh(geoArchAbacus, matMarbleTrim);
      abacus.position.set(px, capStartY + 0.56, 0);
      abacus.castShadow = true;
      archHolder.add(abacus);

      const abacusGold = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.02, 0.045, 1.02)),
        matChampagneGold
      );
      abacusGold.position.set(px, capStartY + 0.65, 0);
      archHolder.add(abacusGold);

      // 双肩纤细哥特尖塔饰（Pinnacles）
      const pinBaseY = springY + geos.spandrelTotalH * 0.72;
      const pinShaft = new THREE.Mesh(geoPinnacleShaft, matMarbleLight);
      pinShaft.position.set(side * (geos.outerW * 0.5 - 0.14), pinBaseY + 0.42, 0);
      archHolder.add(pinShaft);

      const pinSpire = new THREE.Mesh(geoPinnacleSpire, matRoyalLapis);
      pinSpire.position.set(side * (geos.outerW * 0.5 - 0.14), pinBaseY + 1.18, 0);
      archHolder.add(pinSpire);

      const pinOrb = new THREE.Mesh(geoFinialDiamond, matChampagneGold);
      pinOrb.position.set(side * (geos.outerW * 0.5 - 0.14), pinBaseY + 1.56, 0);
      pinOrb.scale.set(0.65, 1.15, 0.65);
      archHolder.add(pinOrb);
    }

    // 悬空拱门底部连接横门槛（轻盈雪瓷金线饰条）
    const sill = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(def.spanW + 0.4, 0.12, 0.46)),
      matMarbleLight
    );
    sill.position.set(0, 0.06, 0);
    archHolder.add(sill);

    const sillGold = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(def.spanW + 0.44, 0.036, 0.50)),
      matChampagneGold
    );
    sillGold.position.set(0, 0.135, 0);
    archHolder.add(sillGold);

    // 双心哥特尖拱主体 + 香槟金双面拱肋镶边 + 拱顶星石锁钥与冠星
    const spandrel = new THREE.Mesh(geos.spandrelGeo, matMarbleArch);
    spandrel.position.set(0, springY, 0);
    spandrel.castShadow = true;
    spandrel.receiveShadow = true;
    archHolder.add(spandrel);

    const ribMeshes = [
      geos.ribInFrontL,
      geos.ribInFrontR,
      geos.ribInBackL,
      geos.ribInBackR,
      geos.ribOutL,
      geos.ribOutR,
    ];
    for (const rGeo of ribMeshes) {
      const rMesh = new THREE.Mesh(rGeo, matChampagneGold);
      rMesh.position.set(0, springY, 0);
      archHolder.add(rMesh);
    }

    // 尖拱拱顶蓝金锁钥（Keystone）与尖顶星芒冠饰
    const keystone = new THREE.Mesh(geoFinialDiamond, matStarBlueInlay);
    keystone.position.set(0, springY + def.peakH + 0.14, 0.27);
    keystone.scale.set(0.92, 1.55, 0.52);
    archHolder.add(keystone);

    const apexStem = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.026, 0.042, 0.46, 8)),
      matChampagneGold
    );
    apexStem.position.set(0, springY + geos.spandrelTotalH + 0.22, 0);
    archHolder.add(apexStem);

    const apexStar = new THREE.Mesh(geoFinialDiamond, matChampagneGold);
    apexStar.position.set(0, springY + geos.spandrelTotalH + 0.50, 0);
    apexStar.scale.set(0.95, 1.65, 0.42);
    archHolder.add(apexStar);

    // 拱门内半透明梦境晶镜虚影幕
    const curtain = new THREE.Mesh(geos.curtainGeo, matMirrorArchVeil);
    curtain.position.set(0, 0.14, 0);
    archHolder.add(curtain);

    floatingArches.push({
      group: archHolder,
      baseY: def.baseY,
      amp: 0.085 + (i % 3) * 0.02,
      speed: 0.55 + (i % 2) * 0.12,
      phase: def.phase,
    });
  }

  // =========================================================================
  // 10. AAA 精细多面体双层悬浮棱镜水晶簇（斜切晶尖 + 蓝金晶核 + 折光晶壳 + 细金星环）
  // =========================================================================
  const crystalsGroup = new THREE.Group();
  crystalsGroup.name = 'floating_prism_crystal_clusters';
  group.add(crystalsGroup);

  // 预建多组斜切不对称晶尖几何，确保每一簇轮廓都如精雕宝石般灵动丰富
  const geoMainPrismA = trackGeo(createAsymmetricPrismCrystalGeo(THREE, 0.52, 1.65, 0.92, 6, 1.7));
  const geoMainPrismB = trackGeo(createAsymmetricPrismCrystalGeo(THREE, 0.46, 1.48, 0.84, 6, 3.4));
  const geoSatPrismA = trackGeo(createAsymmetricPrismCrystalGeo(THREE, 0.26, 0.96, 0.54, 6, 5.2));
  const geoSatPrismB = trackGeo(createAsymmetricPrismCrystalGeo(THREE, 0.21, 0.78, 0.44, 6, 7.9));
  const geoSplinter = trackGeo(createAsymmetricPrismCrystalGeo(THREE, 0.10, 0.36, 0.22, 5, 11.1));

  const geoOrbitRingOuter = trackGeo(new THREE.TorusGeometry(1.38, 0.026, 8, 48));
  const geoOrbitRingInner = trackGeo(new THREE.TorusGeometry(1.02, 0.022, 8, 40));
  const geoRingNode = trackGeo(new THREE.OctahedronGeometry(0.068, 0));
  const geoGlowCard = trackGeo(new THREE.PlaneGeometry(3.8, 3.8));

  function buildDualLayerShard(geo, useGoldCore = false) {
    const holder = new THREE.Group();
    const outerMesh = new THREE.Mesh(geo, matPrismShell);
    outerMesh.castShadow = false;
    holder.add(outerMesh);

    const innerMesh = new THREE.Mesh(geo, useGoldCore ? matPrismGoldCore : matPrismCore);
    innerMesh.scale.set(0.54, 0.68, 0.54);
    holder.add(innerMesh);
    return holder;
  }

  // 7 座对称悬浮棱镜水晶簇：1 座后景中央主星晶簇 + 6 座拱门外侧呼应晶簇
  const clusterDefs = [
    // 后景星穹正中主棱镜水晶簇（位于双拱门视口正中，视觉焦点！）
    { x: 0.0,    y: 3.75, z: -14.8, scale: 1.24, hero: true,  phase: 0.0, spin: 0.24 },
    // 内中拱门间隙外侧一对
    { x: -7.55,  y: 3.35, z: -12.05, scale: 0.96, hero: false, phase: 1.1, spin: -0.28 },
    { x: 7.55,   y: 3.35, z: -12.05, scale: 0.96, hero: false, phase: 2.2, spin: 0.28 },
    // 中外拱门间隙外侧一对
    { x: -11.95, y: 2.75, z: -6.95,  scale: 0.88, hero: false, phase: 3.1, spin: 0.32 },
    { x: 11.95,  y: 2.75, z: -6.95,  scale: 0.88, hero: false, phase: 4.3, spin: -0.32 },
    // 远翼低空呼应水晶簇一对
    { x: -12.35, y: 1.85, z: -1.35,  scale: 0.72, hero: false, phase: 5.0, spin: -0.36 },
    { x: 12.35,  y: 1.85, z: -1.35,  scale: 0.72, hero: false, phase: 5.9, spin: 0.36 },
  ];

  for (let i = 0; i < clusterDefs.length; i++) {
    const def = clusterDefs[i];
    const root = new THREE.Group();
    root.position.set(def.x, def.y, def.z);
    root.scale.setScalar(def.scale);
    crystalsGroup.add(root);

    // 晶簇本体组（独立缓慢自转）
    const body = new THREE.Group();
    root.add(body);

    // 主斜切双层棱镜晶柱（中心蓝金核 + 外透明虹彩晶壳）
    const mainShard = buildDualLayerShard(i % 2 === 0 ? geoMainPrismA : geoMainPrismB, def.hero);
    body.add(mainShard);

    // 4~5 枚斜插不对称伴生副晶柱
    const satCount = def.hero ? 5 : 4;
    for (let s = 0; s < satCount; s++) {
      const sa = (s / satCount) * Math.PI * 2 + i * 0.7;
      const satGeo = s % 2 === 0 ? geoSatPrismA : geoSatPrismB;
      const sat = buildDualLayerShard(satGeo, !def.hero && s === 0);
      const dist = 0.44 + (s % 2) * 0.14;
      sat.position.set(Math.cos(sa) * dist, -0.18 + (s % 3) * 0.16, Math.sin(sa) * dist);
      sat.rotation.set(Math.sin(sa) * 0.36, sa, -Math.cos(sa) * 0.36);
      body.add(sat);
    }

    // 3 枚环绕悬浮微小碎晶碎片
    const orbitSplinters = new THREE.Group();
    root.add(orbitSplinters);
    for (let k = 0; k < 3; k++) {
      const ka = (k / 3) * Math.PI * 2 + i;
      const sp = new THREE.Mesh(geoSplinter, matPrismShell);
      sp.position.set(Math.cos(ka) * 1.18, (k - 1) * 0.42, Math.sin(ka) * 1.18);
      sp.rotation.set(0.4 * k, ka, -0.35);
      orbitSplinters.add(sp);
    }

    // 双层倾斜细香槟金星环（外环带 4 枚金星节点，内环反向斜交）
    const ringOuter = new THREE.Group();
    ringOuter.rotation.set(Math.PI * 0.38, i * 0.6, 0.24);
    ringOuter.add(new THREE.Mesh(geoOrbitRingOuter, matChampagneGold));
    for (let n = 0; n < 4; n++) {
      const na = (n / 4) * Math.PI * 2;
      const node = new THREE.Mesh(geoRingNode, n % 2 === 0 ? matChampagneGold : matStarBlueInlay);
      node.position.set(Math.cos(na) * 1.38, Math.sin(na) * 1.38, 0);
      ringOuter.add(node);
    }
    root.add(ringOuter);

    const ringInner = new THREE.Mesh(geoOrbitRingInner, matHaloCyan);
    ringInner.rotation.set(-Math.PI * 0.34, -i * 0.5, -0.32);
    root.add(ringInner);

    // 克制柔和的星晶背光晕
    if (rawGlow) {
      const glow = new THREE.Mesh(geoGlowCard, matCrystalGlowSprite);
      glow.lookAt(0, def.y, 16.0);
      root.add(glow);
    }

    floatingClusters.push({
      root,
      body,
      ringOuter,
      ringInner,
      orbitSplinters,
      baseY: def.y,
      amp: def.hero ? 0.26 : 0.20,
      bobSpeed: 0.72 + (i % 3) * 0.14,
      spinSpeed: def.spin,
      phase: def.phase,
    });
  }

  // =========================================================================
  // 11. 高空两道缓慢逆向旋转的纤细香槟金星象仪刻度环（Armillary Rings）
  // =========================================================================
  const armillaryGroup = new THREE.Group();
  armillaryGroup.name = 'celestial_armillary_rings';
  // 精准置于后方高空（z = -26.0），双环优雅横跨拱门上方整片梦境天穹
  armillaryGroup.position.set(0, 3.8, -26.0);
  group.add(armillaryGroup);

  function createArmillaryRing(radius, bandWidth, tiltEuler, spinSpeed, tickCount, nodeCount, phase) {
    const holder = new THREE.Group();
    holder.rotation.set(tiltEuler[0], tiltEuler[1], tiltEuler[2]);
    armillaryGroup.add(holder);

    const spinner = new THREE.Group();
    holder.add(spinner);

    // 双道纤细 3D 香槟金金属边框环
    const innerR = radius - bandWidth * 0.5;
    const outerR = radius + bandWidth * 0.5;
    spinner.add(new THREE.Mesh(trackGeo(new THREE.TorusGeometry(outerR, 0.046, 10, 96)), matArmillaryGold));
    spinner.add(new THREE.Mesh(trackGeo(new THREE.TorusGeometry(innerR, 0.036, 10, 96)), matArmillaryGold));

    // 中央精密星象刻度带（自定义 GLSL：3° 细刻度 + 15° 主刻度 + 流光星芒）
    const uRing = {
      uTime: { value: 0 },
      uGoldColor: { value: new THREE.Color(0xf2d382) },
      uIceColor: { value: new THREE.Color(0x88dcff) },
      uTicks: { value: tickCount },
      uPhase: { value: phase },
    };
    shaderUniforms.push(uRing);

    const matDial = trackMat(
      new THREE.ShaderMaterial({
        uniforms: uRing,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec2 vPos;
          void main() {
            vPos = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uGoldColor;
          uniform vec3 uIceColor;
          uniform float uTicks;
          uniform float uPhase;
          varying vec2 vPos;

          void main() {
            float r = length(vPos);
            float a = atan(vPos.y, vPos.x);
            float innerBound = ${innerR.toFixed(3)};
            float outerBound = ${outerR.toFixed(3)};
            float rn = clamp((r - innerBound) / max(0.001, outerBound - innerBound), 0.0, 1.0);

            // 细密星象刻度与主节点标线
            float fineTick = smoothstep(0.72, 0.96, cos(a * uTicks)) * smoothstep(0.16, 0.24, rn) * (1.0 - smoothstep(0.76, 0.84, rn));
            float majorTick = smoothstep(0.92, 0.995, cos(a * (uTicks * 0.25))) * smoothstep(0.06, 0.12, rn) * (1.0 - smoothstep(0.88, 0.94, rn));
            float centerHairline = smoothstep(0.06, 0.015, abs(rn - 0.5));
            float comet = pow(max(0.0, cos(a - uTime * 0.24 + uPhase)), 18.0) * smoothstep(0.28, 0.04, abs(rn - 0.5));

            float pattern = clamp(fineTick * 0.58 + majorTick * 0.95 + centerHairline * 0.35 + comet * 0.85, 0.0, 1.0);
            vec3 col = mix(uGoldColor, uIceColor, comet * 0.65 + centerHairline * 0.25);
            float alpha = pattern * 0.68;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
    );

    const dialBand = new THREE.Mesh(trackGeo(new THREE.RingGeometry(innerR, outerR, 112)), matDial);
    spinner.add(dialBand);

    // 环周 3D 香槟金星象节点与冰晶菱饰
    const nodeGeo = trackGeo(new THREE.OctahedronGeometry(0.16, 0));
    const nodeBezelGeo = trackGeo(new THREE.TorusGeometry(0.22, 0.025, 8, 16));
    for (let n = 0; n < nodeCount; n++) {
      const a = (n / nodeCount) * Math.PI * 2;
      const nx = Math.cos(a) * radius;
      const ny = Math.sin(a) * radius;
      const isMajor = n % 2 === 0;

      const gem = new THREE.Mesh(nodeGeo, isMajor ? matArmillaryGold : matStarBlueInlay);
      gem.position.set(nx, ny, 0);
      gem.rotation.z = a;
      gem.scale.set(isMajor ? 1.15 : 0.78, isMajor ? 1.65 : 0.95, 0.55);
      spinner.add(gem);

      if (isMajor) {
        const bezel = new THREE.Mesh(nodeBezelGeo, matArmillaryGold);
        bezel.position.set(nx, ny, 0);
        spinner.add(bezel);
      }
    }

    armillaryAssemblies.push({ spinner, spinSpeed, uniforms: uRing });
  }

  // 外环（顺时针缓慢旋动）与内环（逆时针缓慢旋动），构成高空双环星象仪
  createArmillaryRing(9.8, 0.52, [0.36, 0.12, 0.14], 0.042, 72.0, 12, 0.0);
  createArmillaryRing(7.4, 0.44, [-0.28, -0.14, -0.18], -0.064, 48.0, 8, 2.4);

  // =========================================================================
  // 12. 梦境漂浮星尘与细雪花粒子（Biome 自驱 GPU Points，随心情平滑变色）
  // =========================================================================
  const DUST_COUNT = 260;
  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustSeed = new Float32Array(DUST_COUNT * 3); // x: phase, y: speed, z: kind (0=snow, 1=stardust)
  const dustSize = new Float32Array(DUST_COUNT);

  for (let i = 0; i < DUST_COUNT; i++) {
    // 环绕决斗台、拱门与星晶之间柔和流转（避开相机近裁剪面）
    const r = 3.2 + rng() * 14.5;
    const ang = rng() * Math.PI * 2;
    dustPos[i * 3] = Math.cos(ang) * r;
    dustPos[i * 3 + 1] = 0.25 + rng() * 8.4;
    dustPos[i * 3 + 2] = Math.sin(ang) * r * 0.85 - 2.4;

    dustSeed[i * 3] = rng() * Math.PI * 2;
    dustSeed[i * 3 + 1] = 0.45 + rng() * 0.85;
    dustSeed[i * 3 + 2] = rng() < 0.48 ? 1.0 : 0.0;
    dustSize[i] = dustSeed[i * 3 + 2] > 0.5 ? 2.6 + rng() * 3.4 : 2.2 + rng() * 2.6;
  }

  const dustGeo = trackGeo(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 3));
  dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSize, 1));

  const dustUniforms = {
    uTime: { value: 0 },
    uSnowColor: { value: new THREE.Color(0xeef7ff) },
    uStarColor: { value: new THREE.Color(0xffe6a6) },
    uOpacity: { value: 0.72 },
  };
  shaderUniforms.push(dustUniforms);

  const matDreamDust = trackMat(
    new THREE.ShaderMaterial({
      uniforms: dustUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        attribute float aSize;
        uniform float uTime;
        varying float vKind;
        varying float vAlpha;

        void main() {
          vec3 p = position;
          float ph = aSeed.x;
          float sp = aSeed.y;
          float kind = aSeed.z;

          if (kind > 0.5) {
            // 星尘粒子：轻盈螺旋上升并微幅飘动
            p.y = mod(p.y + uTime * 0.24 * sp + ph, 8.8) + 0.2;
            p.x += sin(uTime * 0.55 * sp + ph) * 0.45;
            p.z += cos(uTime * 0.48 * sp + ph * 1.3) * 0.40;
          } else {
            // 细雪花粒子：柔缓飘落与微风拂动
            p.y = mod(p.y - uTime * 0.36 * sp + 8.8, 8.8) + 0.15;
            p.x += sin(uTime * 0.72 * sp + ph) * 0.52 + uTime * 0.08 * sp;
            p.x = mod(p.x + 17.0, 34.0) - 17.0;
            p.z += cos(uTime * 0.58 * sp + ph) * 0.32;
          }

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = max(1.5, -mv.z);
          float twinkle = 0.62 + 0.38 * sin(uTime * (2.2 + sp * 1.8) + ph * 5.0);
          float yFade = smoothstep(0.15, 0.9, p.y) * (1.0 - smoothstep(7.8, 8.95, p.y));
          float nearFade = smoothstep(2.6, 5.5, dist);

          vKind = kind;
          vAlpha = twinkle * yFade * nearFade;
          gl_PointSize = clamp(aSize * (28.0 / dist), 1.8, 12.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSnowColor;
        uniform vec3 uStarColor;
        uniform float uOpacity;
        varying float vKind;
        varying float vAlpha;

        void main() {
          vec2 c = (gl_PointCoord - 0.5) * 2.0;
          float r = length(c);
          if (r > 1.0) discard;

          float shape;
          if (vKind > 0.5) {
            // 精致四角星芒星尘
            float core = exp(-r * 3.8);
            float crossH = exp(-abs(c.y) * 9.0) * exp(-abs(c.x) * 2.6);
            float crossV = exp(-abs(c.x) * 9.0) * exp(-abs(c.y) * 2.6);
            shape = clamp(core + (crossH + crossV) * 0.65, 0.0, 1.0) * smoothstep(1.0, 0.15, r);
          } else {
            // 柔和冰晶细雪点
            shape = exp(-r * r * 3.6) * smoothstep(1.0, 0.2, r);
          }

          vec3 col = mix(uSnowColor, uStarColor, vKind);
          float alpha = shape * vAlpha * uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })
  );

  const dreamDustPoints = new THREE.Points(dustGeo, matDreamDust);
  dreamDustPoints.name = 'dream_stardust_snow_points';
  dreamDustPoints.frustumCulled = false;
  group.add(dreamDustPoints);

  // =========================================================================
  // 13. 三档温柔星镜色温 Mood（严防过曝：bloomThreshold >= 0.93,
  //     bloomStrength <= 0.30, spriteRimTint 全部 <= 1.02）
  // =========================================================================
  const DUEL_MOODS = {
    sunny_snow: {
      subtitle: '澄澈雪瓷 · 星镜晴穹',
      hemiSky: 0xcce4ff, hemiGround: 0xb8cbe4, hemiInt: 0.92,
      sunColor: 0xfff5e4, sunInt: 1.68,
      fillColor: 0xd4e8ff, fillInt: 0.46,
      ambColor: 0xc6dcf4, ambInt: 0.18,
      lanternColor: 0x94dcff, lanternBase: 3.8,
      vistaColor: 0x6ad6ff, vistaBase: 6.5,
      skyZenith: 0x2e6bd4, skyMid: 0x7fb9f2, skyHorizon: 0xdcebfa,
      skySunWarm: 0xfff0d4, skyLowerMist: 0xc5daf3, skyCloudTint: 0xeef6ff,
      skyAurora: 0x7be0ff, skyStarStrength: 0.58, skySunStrength: 0.65,
      cloudShadow: 0x6e98cc, cloudBody: 0xdfecfa, cloudRim: 0xf7ead4,
      mirrorTint: 0x88c4f4, mirrorVeilA: 0x88d4ff, mirrorVeilB: 0xdfecff,
      prismEmissive: 0x1f7ee0, prismEmissiveInt: 0.36,
      prismCoreEmissive: 0x52c8ff, lanternEmissive: 0x62ccff,
      glowSpriteColor: 0x76d6ff, dustSnowColor: 0xeef7ff, dustStarColor: 0xffe6a6,
      fog: { color: 0xcfe2f6, near: 20, far: 62 },
      background: 0xb2d2f2,
      atmospherePreset: {
        particleType: 'iceDust',
        particleColor: 0xe6f6ff,
        particleSecondaryColor: 0xffe9b5,
        particleCount: 340,
        particleSpeed: 0.85,
        particleWind: 0.80,
        godRayColor: 0xeaf4ff,
        godRayOpacity: 0.16,
        godRayOrigin: [-8.0, 14.5, -12.0],
        bloomStrength: 0.25,
        bloomThreshold: 0.94,
        bloomRadius: 0.56,
        focusDepth: 0.56,
        focusBandHalf: 0.185,
        blurAmount: 1.55,
        vignetteStrength: 0.10,
        spriteRimTint: [0.98, 1.00, 1.02],
      },
    },
    breeze_day: {
      subtitle: '晨风蓝金 · 星盘清晓',
      hemiSky: 0xd4ebff, hemiGround: 0xd8cfb8, hemiInt: 0.96,
      sunColor: 0xffeed0, sunInt: 1.74,
      fillColor: 0xe2f0ff, fillInt: 0.48,
      ambColor: 0xd2e2f2, ambInt: 0.19,
      lanternColor: 0xffd994, lanternBase: 4.2,
      vistaColor: 0x8ce4ff, vistaBase: 6.2,
      skyZenith: 0x3678de, skyMid: 0x8cc6f5, skyHorizon: 0xeee8dc,
      skySunWarm: 0xffedc6, skyLowerMist: 0xd4e2f0, skyCloudTint: 0xfbf8f0,
      skyAurora: 0x9ce8ff, skyStarStrength: 0.44, skySunStrength: 0.72,
      cloudShadow: 0x7ca2cf, cloudBody: 0xeaf0f6, cloudRim: 0xffebd0,
      mirrorTint: 0x98ccf2, mirrorVeilA: 0x9adcf8, mirrorVeilB: 0xf2efe6,
      prismEmissive: 0x2c8ce0, prismEmissiveInt: 0.34,
      prismCoreEmissive: 0x70d6ff, lanternEmissive: 0xffcf7a,
      glowSpriteColor: 0x9ce2ff, dustSnowColor: 0xfaf7ee, dustStarColor: 0xffe296,
      fog: { color: 0xd8e8f5, near: 21, far: 64 },
      background: 0xbed9f3,
      atmospherePreset: {
        particleType: 'windMotes',
        particleColor: 0xfff3d4,
        particleSecondaryColor: 0xd0efff,
        particleCount: 320,
        particleSpeed: 1.05,
        particleWind: 1.35,
        godRayColor: 0xfff0ce,
        godRayOpacity: 0.18,
        godRayOrigin: [-8.0, 14.5, -12.0],
        bloomStrength: 0.24,
        bloomThreshold: 0.95,
        bloomRadius: 0.58,
        focusDepth: 0.56,
        focusBandHalf: 0.185,
        blurAmount: 1.50,
        vignetteStrength: 0.09,
        spriteRimTint: [1.01, 1.00, 0.97],
      },
    },
    thaw_twilight: {
      subtitle: '冰融暮霞 · 淡紫星辉',
      hemiSky: 0xb4bef0, hemiGround: 0xd4b6b8, hemiInt: 0.88,
      sunColor: 0xffd4a4, sunInt: 1.62,
      fillColor: 0xcad8fa, fillInt: 0.46,
      ambColor: 0xbcc0df, ambInt: 0.20,
      lanternColor: 0xffc882, lanternBase: 5.2,
      vistaColor: 0x90d0ff, vistaBase: 7.0,
      skyZenith: 0x384e9e, skyMid: 0x9397d4, skyHorizon: 0xebd0c4,
      skySunWarm: 0xffcfa0, skyLowerMist: 0xc7bdd8, skyCloudTint: 0xf7e4dc,
      skyAurora: 0xb4b8ff, skyStarStrength: 0.86, skySunStrength: 0.68,
      cloudShadow: 0x7c7fb4, cloudBody: 0xdfd7eb, cloudRim: 0xfbd5bc,
      mirrorTint: 0x9fa8e6, mirrorVeilA: 0xa0b8f8, mirrorVeilB: 0xf0dce4,
      prismEmissive: 0x4876e8, prismEmissiveInt: 0.42,
      prismCoreEmissive: 0x86c8ff, lanternEmissive: 0xffbd72,
      glowSpriteColor: 0x9cc8ff, dustSnowColor: 0xf6ece4, dustStarColor: 0xffd892,
      fog: { color: 0xd2c7e0, near: 19, far: 58 },
      background: 0xb9b4d6,
      atmospherePreset: {
        particleType: 'snow',
        particleColor: 0xfff0dc,
        particleSecondaryColor: 0xd4dcff,
        particleCount: 340,
        particleSpeed: 0.90,
        particleWind: 1.05,
        godRayColor: 0xffd8ab,
        godRayOpacity: 0.20,
        godRayOrigin: [-8.0, 14.5, -12.0],
        bloomStrength: 0.28,
        bloomThreshold: 0.93,
        bloomRadius: 0.60,
        focusDepth: 0.56,
        focusBandHalf: 0.185,
        blurAmount: 1.60,
        vignetteStrength: 0.11,
        spriteRimTint: [1.02, 0.98, 0.99],
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

  function makeMoodSnapshot(cfg) {
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
      lanternColor: new THREE.Color(cfg.lanternColor),
      lanternBase: cfg.lanternBase,
      vistaColor: new THREE.Color(cfg.vistaColor),
      vistaBase: cfg.vistaBase,
      skyZenith: new THREE.Color(cfg.skyZenith),
      skyMid: new THREE.Color(cfg.skyMid),
      skyHorizon: new THREE.Color(cfg.skyHorizon),
      skySunWarm: new THREE.Color(cfg.skySunWarm),
      skyLowerMist: new THREE.Color(cfg.skyLowerMist),
      skyCloudTint: new THREE.Color(cfg.skyCloudTint),
      skyAurora: new THREE.Color(cfg.skyAurora),
      skyStarStrength: cfg.skyStarStrength,
      skySunStrength: cfg.skySunStrength,
      cloudShadow: new THREE.Color(cfg.cloudShadow),
      cloudBody: new THREE.Color(cfg.cloudBody),
      cloudRim: new THREE.Color(cfg.cloudRim),
      fogColor: new THREE.Color(cfg.fog.color),
      mirrorTint: new THREE.Color(cfg.mirrorTint),
      mirrorVeilA: new THREE.Color(cfg.mirrorVeilA),
      mirrorVeilB: new THREE.Color(cfg.mirrorVeilB),
      prismEmissive: new THREE.Color(cfg.prismEmissive),
      prismEmissiveInt: cfg.prismEmissiveInt,
      prismCoreEmissive: new THREE.Color(cfg.prismCoreEmissive),
      lanternEmissive: new THREE.Color(cfg.lanternEmissive),
      glowSpriteColor: new THREE.Color(cfg.glowSpriteColor),
      dustSnowColor: new THREE.Color(cfg.dustSnowColor),
      dustStarColor: new THREE.Color(cfg.dustStarColor),
    };
  }

  function copyMoodSnapshot(dst, src) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].copy(src[k]);
      else dst[k] = src[k];
    }
  }

  function lerpMoodSnapshot(dst, a, b, t) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].lerpColors(a[k], b[k], t);
      else dst[k] = a[k] + (b[k] - a[k]) * t;
    }
  }

  let currentMoodId = 'sunny_snow';
  let runtimeTicks = 0;
  const moodCur = makeMoodSnapshot(DUEL_MOODS.sunny_snow);
  const moodFrom = makeMoodSnapshot(DUEL_MOODS.sunny_snow);
  const moodTarget = makeMoodSnapshot(DUEL_MOODS.sunny_snow);
  const moodTrans = { active: false, elapsed: 0, duration: 0.9 };

  function commitMoodVisuals(s) {
    hemiLight.color.copy(s.hemiSky);
    hemiLight.groundColor.copy(s.hemiGround);
    hemiLight.intensity = s.hemiInt;
    sunLight.color.copy(s.sunColor);
    sunLight.intensity = s.sunInt;
    frontFillLight.color.copy(s.fillColor);
    frontFillLight.intensity = s.fillInt;
    ambientLight.color.copy(s.ambColor);
    ambientLight.intensity = s.ambInt;

    for (let i = 0; i < lanternLights.length; i++) {
      lanternLights[i].color.copy(s.lanternColor);
      pulsedLights[i].base = s.lanternBase;
    }
    vistaCrystalLight.color.copy(s.vistaColor);
    pulsedLights[lanternLights.length].base = s.vistaBase;

    skyUniforms.uZenithColor.value.copy(s.skyZenith);
    skyUniforms.uMidSkyColor.value.copy(s.skyMid);
    skyUniforms.uHorizonColor.value.copy(s.skyHorizon);
    skyUniforms.uSunWarmColor.value.copy(s.skySunWarm);
    skyUniforms.uLowerMistColor.value.copy(s.skyLowerMist);
    skyUniforms.uCloudTint.value.copy(s.skyCloudTint);
    skyUniforms.uAuroraColor.value.copy(s.skyAurora);
    skyUniforms.uStarStrength.value = s.skyStarStrength;
    skyUniforms.uSunStrength.value = s.skySunStrength;

    for (let i = 0; i < cloudLayers.length; i++) {
      const cu = cloudLayers[i].uniforms;
      cu.uShadowColor.value.copy(s.cloudShadow);
      cu.uBodyColor.value.copy(s.cloudBody);
      cu.uRimColor.value.copy(s.cloudRim);
      cu.uFogColor.value.copy(s.fogColor);
    }

    mirrorFloorUniforms.uMirrorTint.value.copy(s.mirrorTint);
    mirrorArchUniforms.uMirrorColorA.value.copy(s.mirrorVeilA);
    mirrorArchUniforms.uMirrorColorB.value.copy(s.mirrorVeilB);

    matPrismShell.emissive.copy(s.prismEmissive);
    matPrismShell.emissiveIntensity = s.prismEmissiveInt;
    matPrismCore.emissive.copy(s.prismCoreEmissive);
    matLanternCore.emissive.copy(s.lanternEmissive);
    matCrystalGlowSprite.color.copy(s.glowSpriteColor);
    matLanternHaloSprite.color.copy(s.lanternEmissive);

    dustUniforms.uSnowColor.value.copy(s.dustSnowColor);
    dustUniforms.uStarColor.value.copy(s.dustStarColor);
  }

  let biomeHandle = null;

  function applyMood(moodId, options = {}) {
    const rawKey = typeof moodId === 'string' ? moodId.trim().toLowerCase() : '';
    const resolvedKey = DUEL_MOODS[rawKey] ? rawKey : 'sunny_snow';
    const cfg = DUEL_MOODS[resolvedKey];
    currentMoodId = resolvedKey;

    const targetSnap = makeMoodSnapshot(cfg);
    const immediate =
      options.immediate === true ||
      options.duration === 0 ||
      runtimeTicks < 2;

    if (immediate) {
      copyMoodSnapshot(moodCur, targetSnap);
      copyMoodSnapshot(moodFrom, targetSnap);
      copyMoodSnapshot(moodTarget, targetSnap);
      moodTrans.active = false;
      moodTrans.elapsed = 0;
      commitMoodVisuals(moodCur);
    } else {
      copyMoodSnapshot(moodFrom, moodCur);
      copyMoodSnapshot(moodTarget, targetSnap);
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
  // 14. 实时动画循环（高空双星象仪逆转、棱镜水晶浮沉自转、拱门微浮、星尘细雪流转）
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
      lerpMoodSnapshot(moodCur, moodFrom, moodTarget, smoothT);
      commitMoodVisuals(moodCur);
      if (rawT >= 1) {
        moodTrans.active = false;
      }
    }

    // 1. 驱动全部 GLSL 着色器（梦境穹顶、云海、冰镜地盘、星盘法阵、晶镜幕、星象刻度、星尘雪粒）
    for (let i = 0; i < shaderUniforms.length; i++) {
      shaderUniforms[i].uTime.value = t;
    }

    // 2. 中央星盘法阵与台底浮空魔力光环缓慢反旋
    for (let i = 0; i < rotatingRings.length; i++) {
      const rr = rotatingRings[i];
      rr.mesh.rotation[rr.axis] += rr.speed * dt;
    }

    // 3. 高空两道香槟金星象仪刻度环缓慢逆向旋转
    for (let i = 0; i < armillaryAssemblies.length; i++) {
      const arm = armillaryAssemblies[i];
      arm.spinner.rotation.z = t * arm.spinSpeed;
    }

    // 4. 外围 6 座半悬空哥特晶镜拱门轻柔呼吸浮沉
    for (let i = 0; i < floatingArches.length; i++) {
      const fa = floatingArches[i];
      fa.group.position.y = fa.baseY + Math.sin(t * fa.speed + fa.phase) * fa.amp;
    }

    // 5. AAA 双层悬浮棱镜水晶簇缓慢自转浮沉与细金星环交错公转
    for (let i = 0; i < floatingClusters.length; i++) {
      const fc = floatingClusters[i];
      fc.root.position.y = fc.baseY + Math.sin(t * fc.bobSpeed + fc.phase) * fc.amp;
      fc.body.rotation.y = t * fc.spinSpeed + fc.phase;
      fc.ringOuter.rotation.z = t * fc.spinSpeed * 1.35 + fc.phase;
      fc.ringOuter.rotation.y = Math.sin(t * 0.35 + fc.phase) * 0.25 + fc.phase * 0.4;
      fc.ringInner.rotation.z = -t * fc.spinSpeed * 1.65 - fc.phase;
      fc.orbitSplinters.rotation.y = -t * fc.spinSpeed * 0.85 + fc.phase;
    }

    // 6. 8 座八角石灯柱内悬浮星晶灯芯微浮自转与光晕呼吸
    for (let i = 0; i < lanternFlames.length; i++) {
      const lf = lanternFlames[i];
      const wave = Math.sin(t * 1.85 + lf.phase);
      lf.mesh.position.y = lf.baseY + wave * 0.028;
      lf.mesh.rotation.y = t * 0.72 + lf.phase;
      if (lf.halo) {
        const hs = 0.94 + wave * 0.08;
        lf.halo.scale.set(hs, hs, 1);
      }
    }

    // 7. 局域灯柱与星晶点光柔缓脉动
    for (let i = 0; i < pulsedLights.length; i++) {
      const pl = pulsedLights[i];
      pl.light.intensity = pl.base + Math.sin(t * pl.speed + pl.phase) * pl.amp;
    }
  }

  // =========================================================================
  // 15. 完整资源释放（幂等、零 GPU 泄露、严守外部 texLib 原图只读契约）
  // =========================================================================
  function dispose() {
    if (disposed) return;
    disposed = true;

    const geoSet = new Set(ownedGeometries);
    const matSet = new Set(ownedMaterials);

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
      if (g && typeof g.dispose === 'function') g.dispose();
    }
    for (const m of matSet) {
      if (m && typeof m.dispose === 'function') m.dispose();
    }
    for (const tex of ownedTextures) {
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    }

    if (sunLight.shadow && sunLight.shadow.map && typeof sunLight.shadow.map.dispose === 'function') {
      sunLight.shadow.map.dispose();
    }

    ownedGeometries.length = 0;
    ownedMaterials.length = 0;
    ownedTextures.length = 0;
    shaderUniforms.length = 0;
    cloudLayers.length = 0;
    floatingArches.length = 0;
    floatingClusters.length = 0;
    lanternFlames.length = 0;
    lanternLights.length = 0;
    rotatingRings.length = 0;
    armillaryAssemblies.length = 0;
    pulsedLights.length = 0;
    archGeoCache.clear();
  }

  // 初始化默认帧姿态与默认晴空雪瓷光影
  commitMoodVisuals(moodCur);
  update(0, 0);

  const defaultResult = cloneMoodResult('sunny_snow', DUEL_MOODS.sunny_snow);
  biomeHandle = {
    id: 'duel',
    name: '梦境星镜决斗殿',
    subtitle: DUEL_MOODS.sunny_snow.subtitle,
    currentMood: currentMoodId,
    supportedMoods: Object.keys(DUEL_MOODS),
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
