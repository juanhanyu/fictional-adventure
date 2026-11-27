/**
 * 云巅风神祭坛（Sky-Temple Storm Altar）
 * 旗舰 3D 史诗 Boss 战场 Biome 模块
 *
 * 导出契约：export function buildAltarBiome(THREE, texLib)
 * 安全作战平地：y = 0 上 x ∈ [-8.5, +8.5], z ∈ [-4.2, +4.2] 绝对平坦无遮挡，
 *              前景相机视口（z > +3.5, |x| < 10.2）完全敞开。
 */

// ---------------------------------------------------------------------------
// 确定性伪随机数（确保每次构建的浮石、碎岩与云层排布完全稳定美观）
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

// ---------------------------------------------------------------------------
// 纹理兼容工具：安全兼容 THREE.Texture 或 { map, bumpMap, roughnessMap } 结构
// 绝不修改或 dispose 外部 texLib 原始纹理，避免跨 Biome 切换污染 GPU 缓存
// ---------------------------------------------------------------------------
function resolveTex(entry) {
  if (!entry) return null;
  if (entry.isTexture) return entry;
  if (entry.map && entry.map.isTexture) return entry.map;
  return null;
}

function resolveTexChannel(entry, channel) {
  if (!entry || entry.isTexture) return null;
  const tex = entry[channel];
  return tex && tex.isTexture ? tex : null;
}

function makeTiledTex(THREE, tex, repeatX, repeatY) {
  if (!tex) return null;
  const cloned = tex.clone();
  cloned.wrapS = THREE.RepeatWrapping;
  cloned.wrapT = THREE.RepeatWrapping;
  cloned.repeat.set(repeatX, repeatY);
  cloned.needsUpdate = true;
  return cloned;
}

function makeRepeatingTex(THREE, tex) {
  if (!tex) return null;
  const cloned = tex.clone();
  cloned.wrapS = THREE.RepeatWrapping;
  cloned.wrapT = THREE.RepeatWrapping;
  cloned.needsUpdate = true;
  return cloned;
}

// ---------------------------------------------------------------------------
// 1×1 兜底白纹理（用于某些可选纹理未传入时安全喂给 GLSL sampler2D）
// ---------------------------------------------------------------------------
function createFallbackWhiteTex(THREE) {
  const data = new Uint8Array([255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：16 凹槽古希腊/哥特白大理石柱身（支持浪漫斜向断折顶面）
// ---------------------------------------------------------------------------
function createFlutedColumnGeometry(THREE, radiusBottom, radiusTop, height, broken, tiltAngle, rng) {
  const radialSegs = 32; // 16 条立体凹槽
  const heightSegs = broken ? 10 : 6;
  const geom = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegs,
    heightSegs,
    false
  );
  // 使柱底位于 y = 0
  geom.translate(0, height * 0.5, 0);

  const pos = geom.attributes.position;
  const fluteDepth = radiusBottom * 0.075;
  const halfH = height;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const r = Math.hypot(x, z);
    const angle = Math.atan2(z, x);

    // 在柱身主体（避开底部 6% 与完整柱顶部 6%）雕刻 16 道立体凹槽
    if (r > radiusTop * 0.35) {
      const yNorm = y / Math.max(halfH, 0.001);
      const fluteMask =
        THREE.MathUtils.smoothstep(yNorm, 0.03, 0.09) *
        (broken ? 1.0 : 1.0 - THREE.MathUtils.smoothstep(yNorm, 0.91, 0.97));
      const fluteWave = Math.cos(angle * 16.0);
      const indent = (fluteWave < 0 ? fluteWave * fluteDepth : fluteWave * fluteDepth * 0.22) * fluteMask;
      const newR = Math.max(0.05, r + indent);
      const scale = newR / r;
      x *= scale;
      z *= scale;
    }

    // 断柱顶部：优雅的斜切 + 轻微自然风化碎裂起伏
    if (broken && y > height * 0.62) {
      const topBlend = THREE.MathUtils.smoothstep(y, height * 0.62, height);
      const slope = (x * Math.cos(tiltAngle) + z * Math.sin(tiltAngle)) * 0.48;
      const chip =
        (Math.sin(angle * 5.0 + tiltAngle) * 0.12 +
          Math.cos(angle * 9.0 - tiltAngle * 1.7) * 0.07) *
        topBlend;
      y += (slope + chip) * topBlend;
      if (rng && y > height * 0.95) {
        y += (rng() - 0.5) * 0.035;
      }
    }

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：倒锥形浮空岩基（带岩层阶梯与自然尖锐岩棱）
// ---------------------------------------------------------------------------
function createFloatingRockSpireGeometry(THREE, topRadius, height, radialSegs, heightSegs, seed) {
  const geom = new THREE.CylinderGeometry(topRadius, topRadius * 0.06, height, radialSegs, heightSegs, false);
  // 顶面保持在 y = 0，向下延伸至 -height
  geom.translate(0, -height * 0.5, 0);

  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cTop = new THREE.Color(0xe1e9f5);    // 顶缘雪白石灰岩
  const cMid = new THREE.Color(0xb2c3dc);    // 中层晴蓝灰岩
  const cBot = new THREE.Color(0x6d88b0);    // 底尖苍穹寒岩
  const cVein = new THREE.Color(0x7be0ff);   // 冰蓝晶脉
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const t = THREE.MathUtils.clamp(-y / height, 0, 1); // 0=顶, 1=底尖
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);

    if (r > 0.02) {
      // 岩层阶梯 + 多频角砾棱角
      const crag1 = Math.sin(a * 5.0 + seed * 1.3 + t * 3.8) * 0.15;
      const crag2 = Math.cos(a * 9.0 - seed * 2.1 + t * 6.4) * 0.09;
      const strata = Math.sin(t * Math.PI * 5.0 + seed) * 0.07;
      // 下半段更快速收尖形成戏剧性的浮空锥体轮廓
      const taperProfile = Math.pow(1.0 - t, 0.78) / Math.max(0.06, 1.0 - t * 0.94);
      const radialMul = Math.max(0.18, (1.0 + (crag1 + crag2 + strata) * THREE.MathUtils.smoothstep(t, 0.04, 0.35)) * (0.72 + 0.28 * taperProfile));
      x *= radialMul;
      z *= radialMul;
    }

    // 底部轻微波浪起伏
    if (t > 0.08) {
      y += Math.sin(a * 4.0 + seed) * 0.14 * t;
    }

    pos.setXYZ(i, x, y, z);

    // 顶点渐变色：顶部接续大理石雪白，向下柔和过渡为晴空岩青，夹杂微弱冰晶脉
    if (t < 0.45) {
      tmpColor.lerpColors(cTop, cMid, t / 0.45);
    } else {
      tmpColor.lerpColors(cMid, cBot, (t - 0.45) / 0.55);
    }
    const vein = Math.pow(Math.max(0, Math.sin(a * 6.0 + t * 11.0 + seed)), 10.0) * THREE.MathUtils.smoothstep(t, 0.25, 0.85);
    tmpColor.lerp(cVein, vein * 0.45);

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：丝带状 3D 螺旋风带（沿 CatmullRomCurve3 生成宽幅柔滑丝带）
// ---------------------------------------------------------------------------
function createWindRibbonGeometry(THREE, curve, segments, halfWidth, twistTurns) {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices = [];

  const pt = new THREE.Vector3();
  const side = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, pt);
    tangent.copy(frames.tangents[i]).normalize();

    // 使用稳定的世界 Y 轴做参考构造丝带横截面，避免 Frenet 翻转打结
    side.crossVectors(tangent, upVec);
    if (side.lengthSq() < 0.0001) {
      side.set(1, 0, 0);
    } else {
      side.normalize();
    }
    normal.crossVectors(side, tangent).normalize();

    // 沿路径加入优雅的微旋丝带扭转
    const twist = u * Math.PI * 2.0 * twistTurns;
    const ct = Math.cos(twist);
    const st = Math.sin(twist);
    binormal.copy(side).multiplyScalar(ct).addScaledVector(normal, st).normalize();

    // 两端自然收尖，中段舒展飘逸
    const taper = Math.sin(u * Math.PI);
    const w = halfWidth * (0.28 + 0.72 * Math.pow(taper, 0.55));

    const vi = i * 2;
    positions[vi * 3] = pt.x - binormal.x * w;
    positions[vi * 3 + 1] = pt.y - binormal.y * w;
    positions[vi * 3 + 2] = pt.z - binormal.z * w;

    positions[(vi + 1) * 3] = pt.x + binormal.x * w;
    positions[(vi + 1) * 3 + 1] = pt.y + binormal.y * w;
    positions[(vi + 1) * 3 + 2] = pt.z + binormal.z * w;

    uvs[vi * 2] = u;
    uvs[vi * 2 + 1] = 0.0;
    uvs[(vi + 1) * 2] = u;
    uvs[(vi + 1) * 2 + 1] = 1.0;

    if (i < segments) {
      const a = vi;
      const b = vi + 1;
      const c = vi + 2;
      const d = vi + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：弧形大理石柱廊横梁（沿圆弧连接相邻神柱）
// ---------------------------------------------------------------------------
function createCurvedBeamGeometry(THREE, radius, startAngle, endAngle, width, height, segs) {
  const shape = new THREE.Shape();
  const hw = width * 0.5;
  const hh = height * 0.5;
  // 带古典线脚切角的横梁剖面
  shape.moveTo(-hw * 0.85, -hh);
  shape.lineTo(hw * 0.85, -hh);
  shape.lineTo(hw * 0.85, -hh * 0.25);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.lineTo(-hw, 0);
  shape.lineTo(-hw * 0.85, -hh * 0.25);
  shape.closePath();

  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = THREE.MathUtils.lerp(startAngle, endAngle, t);
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geom = new THREE.ExtrudeGeometry(shape, {
    steps: segs,
    bevelEnabled: false,
    extrudePath: curve
  });
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 通用轻量几何合并工具（合并为单一 non-indexed BufferGeometry，显著压缩 DrawCall）
// ---------------------------------------------------------------------------
function mergeSimpleGeometries(THREE, geometries, disposeInputs = true) {
  const prepared = [];
  let totalVerts = 0;
  let allHaveColor = geometries.length > 0;

  for (let i = 0; i < geometries.length; i++) {
    const src = geometries[i];
    if (!src || !src.attributes || !src.attributes.position) continue;
    const g = src.index ? src.toNonIndexed() : src.clone();
    if (!g.attributes.normal) {
      g.computeVertexNormals();
    }
    if (!g.attributes.color) {
      allHaveColor = false;
    }
    totalVerts += g.attributes.position.count;
    prepared.push(g);
    if (disposeInputs) {
      src.dispose();
    }
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = allHaveColor ? new Float32Array(totalVerts * 3) : null;

  let vOffset = 0;
  for (let i = 0; i < prepared.length; i++) {
    const g = prepared[i];
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    const c = allHaveColor ? g.attributes.color : null;
    const count = p.count;

    positions.set(p.array, vOffset * 3);
    if (n) normals.set(n.array, vOffset * 3);
    if (u) {
      uvs.set(u.array, vOffset * 2);
    }
    if (colors && c) {
      colors.set(c.array, vOffset * 3);
    }
    vOffset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) {
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return merged;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：AAA 多面体不对称削面棱晶（双尖天然晶簇削面 + 硬法线折光）
// ---------------------------------------------------------------------------
function createFacetedCrystalPrismGeometry(THREE, opts = {}) {
  const {
    radius = 0.52,
    height = 2.2,
    sides = 6,
    topRatio = 0.56,
    crownY = 0.34,
    upperY = 0.16,
    lowerY = -0.22,
    bevelSkew = 0.12,
    twist = 0.11,
    asym = 0.16,
    seed = 1.0
  } = opts;

  const rRng = createRng((Math.abs(seed * 9973) | 0) + 131);
  const halfH = height * 0.5;
  const botTipY = -halfH * (1.0 - (topRatio - 0.5) * 0.65);
  const topTipY = halfH * (1.0 + (topRatio - 0.5) * 0.65);

  // 为每条晶棱构造不对称角距与径向削面偏差（打破机械正多边形感）
  const baseAngles = [];
  const sideScale = [];
  let angleSum = 0;
  const rawSteps = [];
  for (let j = 0; j < sides; j++) {
    const step = 1.0 + (rRng() - 0.5) * asym * 1.4;
    rawSteps.push(step);
    angleSum += step;
  }
  let acc = rRng() * Math.PI * 2;
  for (let j = 0; j < sides; j++) {
    baseAngles.push(acc);
    acc += (rawSteps[j] / angleSum) * Math.PI * 2;
    sideScale.push(1.0 + (rRng() - 0.5) * asym);
  }

  const skewPhase = rRng() * Math.PI * 2;
  const ringDefs = [
    { y: lowerY * height, rMul: 0.78, twistOff: -twist * 0.5, skewMul: -0.75, v: 0.22 },
    { y: upperY * height, rMul: 1.02, twistOff: twist * 0.35, skewMul: 1.0, v: 0.58 },
    { y: crownY * height, rMul: 0.56, twistOff: twist * 0.85, skewMul: 0.55, v: 0.82 }
  ];

  const rings = ringDefs.map((rd) => {
    const pts = [];
    for (let j = 0; j < sides; j++) {
      const a = baseAngles[j] + rd.twistOff;
      const rr = radius * rd.rMul * sideScale[j];
      const ySkew = Math.sin(a + skewPhase) * bevelSkew * height * rd.skewMul;
      pts.push([Math.cos(a) * rr, rd.y + ySkew, Math.sin(a) * rr]);
    }
    return pts;
  });

  const topTip = [
    Math.cos(skewPhase) * radius * 0.14 * asym,
    topTipY,
    Math.sin(skewPhase) * radius * 0.14 * asym
  ];
  const botTip = [
    -Math.cos(skewPhase + 0.8) * radius * 0.12 * asym,
    botTipY,
    -Math.sin(skewPhase + 0.8) * radius * 0.12 * asym
  ];

  const posArr = [];
  const uvArr = [];
  const pushTri = (p0, uv0, p1, uv1, p2, uv2) => {
    posArr.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    uvArr.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]);
  };

  // 底锥（外法线向下外张）
  for (let j = 0; j < sides; j++) {
    const jn = (j + 1) % sides;
    const u0 = j / sides;
    const u1 = (j + 1) / sides;
    pushTri(botTip, [(u0 + u1) * 0.5, 0.0], rings[0][j], [u0, ringDefs[0].v], rings[0][jn], [u1, ringDefs[0].v]);
  }

  // 中间双层多面体削面棱身
  for (let rIdx = 0; rIdx < rings.length - 1; rIdx++) {
    const rA = rings[rIdx];
    const rB = rings[rIdx + 1];
    const vA = ringDefs[rIdx].v;
    const vB = ringDefs[rIdx + 1].v;
    for (let j = 0; j < sides; j++) {
      const jn = (j + 1) % sides;
      const u0 = j / sides;
      const u1 = (j + 1) / sides;
      pushTri(rA[j], [u0, vA], rB[j], [u0, vB], rA[jn], [u1, vA]);
      pushTri(rA[jn], [u1, vA], rB[j], [u0, vB], rB[jn], [u1, vB]);
    }
  }

  // 顶冠多面尖锋
  const lastRing = rings[rings.length - 1];
  const lastV = ringDefs[ringDefs.length - 1].v;
  for (let j = 0; j < sides; j++) {
    const jn = (j + 1) % sides;
    const u0 = j / sides;
    const u1 = (j + 1) / sides;
    pushTri(lastRing[j], [u0, lastV], topTip, [(u0 + u1) * 0.5, 1.0], lastRing[jn], [u1, lastV]);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：古典 S 形雕刻涡卷托座（Scroll Corbel，ExtrudeGeometry）
// ---------------------------------------------------------------------------
function createScrollCorbelGeometry(THREE) {
  const s = new THREE.Shape();
  // +X 朝圆台外沿，+Y 贴合下檐底面，-X 嵌入岩基，-Y 收束为垂饰小涡卷
  s.moveTo(-0.54, 0.44);
  s.lineTo(0.70, 0.44);
  s.lineTo(0.70, 0.34);
  s.lineTo(0.60, 0.30);
  // 上部大涡卷外凸 S 曲线
  s.bezierCurveTo(0.78, 0.23, 0.76, -0.04, 0.48, -0.08);
  // 中部凹腰与爵床叶卷肚
  s.bezierCurveTo(0.30, -0.12, 0.42, -0.34, 0.25, -0.50);
  // 下部反卷小涡卷
  s.bezierCurveTo(0.14, -0.60, 0.24, -0.78, 0.04, -0.85);
  s.bezierCurveTo(-0.12, -0.90, -0.26, -0.82, -0.34, -0.68);
  s.lineTo(-0.54, -0.22);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.052,
    bevelSize: 0.042,
    bevelSegments: 2,
    curveSegments: 14
  });
  geom.translate(0, 0, -0.17);
  geom.computeVertexNormals();
  return geom;
}

function createScrollCorbelTrimGeometry(THREE) {
  const s = new THREE.Shape();
  s.moveTo(0.56, 0.36);
  s.lineTo(0.68, 0.36);
  s.bezierCurveTo(0.84, 0.26, 0.82, -0.05, 0.52, -0.10);
  s.bezierCurveTo(0.36, -0.14, 0.46, -0.36, 0.29, -0.52);
  s.bezierCurveTo(0.19, -0.62, 0.27, -0.79, 0.06, -0.86);
  s.lineTo(-0.02, -0.78);
  s.bezierCurveTo(0.14, -0.72, 0.08, -0.58, 0.19, -0.46);
  s.bezierCurveTo(0.33, -0.32, 0.24, -0.10, 0.44, -0.04);
  s.bezierCurveTo(0.68, 0.01, 0.70, 0.21, 0.56, 0.29);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 1,
    curveSegments: 12
  });
  geom.translate(0, 0, -0.055);
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：石缝风化切角圆台外缘压顶石板（供 InstancedMesh 32 块拼接）
// ---------------------------------------------------------------------------
function createWeatheredCopingSlabGeometry(THREE) {
  const s = new THREE.Shape();
  // 梯形弧段压顶石（带斜向石缝倒角，+X 朝外）
  const innerHalfW = 0.94;
  const outerHalfW = 1.04;
  s.moveTo(-0.46, -innerHalfW);
  s.lineTo(0.46, -outerHalfW);
  s.lineTo(0.50, -outerHalfW * 0.92);
  s.lineTo(0.50, outerHalfW * 0.92);
  s.lineTo(0.46, outerHalfW);
  s.lineTo(-0.46, innerHalfW);
  s.lineTo(-0.50, innerHalfW * 0.92);
  s.lineTo(-0.50, -innerHalfW * 0.92);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.032,
    bevelSize: 0.028,
    bevelSegments: 2
  });
  // 转入 XZ 水平面，顶面略齐于 y = 0
  geom.rotateX(-Math.PI * 0.5);
  geom.translate(0, -0.17, 0);
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：礼仪石阶侧缘雕花护沿（阶梯斜坡石护墙）
// ---------------------------------------------------------------------------
function createSteppedCheekWallGeometry(THREE) {
  const s = new THREE.Shape();
  // +X 沿石阶向下方向（长度 ~2.12m），+Y 朝上
  s.moveTo(-0.18, -0.45);
  s.lineTo(2.08, -0.92);
  s.lineTo(2.14, -0.46);
  s.bezierCurveTo(2.05, -0.34, 1.92, -0.34, 1.80, -0.36);
  s.lineTo(0.14, 0.09);
  s.bezierCurveTo(0.02, 0.13, -0.12, 0.12, -0.18, 0.05);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.032,
    bevelSegments: 2,
    curveSegments: 10
  });
  geom.translate(0, 0, -0.14);
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：神柱古典涡卷角饰 / 风神羽翼浮雕 / 凹弧线脚顶板
// ---------------------------------------------------------------------------
function createCapitalVoluteGeometry(THREE) {
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.0);
  s.bezierCurveTo(0.12, 0.02, 0.26, 0.18, 0.34, 0.44);
  s.bezierCurveTo(0.42, 0.66, 0.24, 0.82, 0.08, 0.74);
  s.bezierCurveTo(-0.04, 0.68, -0.02, 0.52, 0.10, 0.50);
  s.bezierCurveTo(0.18, 0.48, 0.20, 0.58, 0.13, 0.61);
  s.bezierCurveTo(0.22, 0.66, 0.28, 0.54, 0.20, 0.42);
  s.bezierCurveTo(0.12, 0.28, 0.02, 0.22, -0.08, 0.16);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.13,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.018,
    bevelSegments: 2,
    curveSegments: 12
  });
  geom.translate(0, 0, -0.065);
  geom.computeVertexNormals();
  return geom;
}

function createWindWingReliefGeometry(THREE) {
  // 单侧三层风神羽翼（镜像拼合即为对称圣翼，+X 向外伸展，+Y 向上轻扬）
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.06);
  // 第一道最上层主飞羽
  s.bezierCurveTo(0.24, 0.14, 0.56, 0.34, 0.88, 0.62);
  s.bezierCurveTo(0.74, 0.40, 0.58, 0.30, 0.44, 0.25);
  // 第二道中层翎羽
  s.bezierCurveTo(0.62, 0.28, 0.76, 0.36, 0.84, 0.42);
  s.bezierCurveTo(0.68, 0.22, 0.50, 0.16, 0.34, 0.14);
  // 第三道下层覆羽
  s.bezierCurveTo(0.50, 0.14, 0.62, 0.20, 0.68, 0.24);
  s.bezierCurveTo(0.46, 0.04, 0.20, -0.02, 0.0, -0.05);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 10
  });
  geom.translate(0, 0, -0.04);
  geom.computeVertexNormals();
  return geom;
}

function createMoldedAbacusGeometry(THREE) {
  // 科林斯凹弧四边线脚顶板（水平面 Extrude 后旋转至 XZ 平面）
  const r = 0.90;
  const pull = 0.74;
  const s = new THREE.Shape();
  s.moveTo(-r, -r);
  s.quadraticCurveTo(0, -pull, r, -r);
  s.quadraticCurveTo(pull, 0, r, r);
  s.quadraticCurveTo(0, pull, -r, r);
  s.quadraticCurveTo(-pull, 0, -r, -r);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.052,
    bevelSegments: 3,
    curveSegments: 10
  });
  geom.rotateX(-Math.PI * 0.5);
  geom.translate(0, -0.08, 0);
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：哥特拱肋梯形楔石（Voussoir）与断裂处参差石茬
// ---------------------------------------------------------------------------
function createVoussoirGeometry(THREE, topW, botW, height, depth) {
  const s = new THREE.Shape();
  const ht = topW * 0.5;
  const hb = botW * 0.5;
  const hh = height * 0.5;
  // +Y 为拱背外缘（较宽），-Y 为拱腹内缘（收窄形成楔形咬合）
  s.moveTo(-hb, -hh);
  s.lineTo(hb, -hh);
  s.lineTo(ht, hh);
  s.lineTo(-ht, hh);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.036,
    bevelSegments: 2
  });
  geom.translate(0, 0, -depth * 0.5);
  geom.computeVertexNormals();
  return geom;
}

function createFractureToothGeometry(THREE, length, width, depth, seed) {
  const rRng = createRng((Math.abs(seed * 4129) | 0) + 17);
  const s = new THREE.Shape();
  // +X 为沿拱切线向断裂口伸出的参差尖岩茬
  const hw = width * 0.5;
  s.moveTo(-0.08, -hw);
  s.lineTo(length * (0.45 + rRng() * 0.2), -hw * (0.72 + rRng() * 0.2));
  s.lineTo(length * (0.78 + rRng() * 0.22), -hw * (0.15 + rRng() * 0.25));
  s.lineTo(length, hw * (0.05 + rRng() * 0.25));
  s.lineTo(length * (0.62 + rRng() * 0.22), hw * (0.68 + rRng() * 0.22));
  s.lineTo(-0.08, hw);
  s.closePath();

  const geom = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.022,
    bevelSegments: 1
  });
  geom.translate(0, 0, -depth * 0.5);
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：多面雕刻方尖碑（削角四方碑身 + 阶梯凹槽 + 金字塔尖顶）
// ---------------------------------------------------------------------------
function createCarvedObeliskGeometry(THREE) {
  const deg = (d) => (d * Math.PI) / 180;
  // 4 宽碑面 + 4 切角斜楞，构成建筑感极强的雕刻方尖碑截面
  const angles = [33, 57, 123, 147, 213, 237, 303, 327].map(deg);
  const sides = angles.length;

  const tiers = [
    { y: -2.05, r: 0.62, v: 0.04 },
    { y: -1.68, r: 1.06, v: 0.14 },
    { y: -1.35, r: 0.94, v: 0.24 },
    { y: -1.24, r: 0.85, v: 0.28 },
    { y: 0.20,  r: 0.78, v: 0.60 },
    { y: 0.30,  r: 0.71, v: 0.64 },
    { y: 1.56,  r: 0.58, v: 0.86 },
    { y: 1.66,  r: 0.65, v: 0.90 }
  ];

  const rings = tiers.map((tr) =>
    angles.map((a) => [Math.cos(a) * tr.r, tr.y, Math.sin(a) * tr.r])
  );
  const botTip = [0, -2.55, 0];
  const topTip = [0, 2.52, 0];

  const posArr = [];
  const uvArr = [];
  const pushTri = (p0, uv0, p1, uv1, p2, uv2) => {
    posArr.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    uvArr.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]);
  };

  for (let j = 0; j < sides; j++) {
    const jn = (j + 1) % sides;
    const u0 = j / sides;
    const u1 = (j + 1) / sides;
    pushTri(botTip, [(u0 + u1) * 0.5, 0], rings[0][j], [u0, tiers[0].v], rings[0][jn], [u1, tiers[0].v]);
  }
  for (let r = 0; r < rings.length - 1; r++) {
    const rA = rings[r];
    const rB = rings[r + 1];
    for (let j = 0; j < sides; j++) {
      const jn = (j + 1) % sides;
      const u0 = j / sides;
      const u1 = (j + 1) / sides;
      pushTri(rA[j], [u0, tiers[r].v], rB[j], [u0, tiers[r + 1].v], rA[jn], [u1, tiers[r].v]);
      pushTri(rA[jn], [u1, tiers[r].v], rB[j], [u0, tiers[r + 1].v], rB[jn], [u1, tiers[r + 1].v]);
    }
  }
  const topRing = rings[rings.length - 1];
  const topV = tiers[tiers.length - 1].v;
  for (let j = 0; j < sides; j++) {
    const jn = (j + 1) % sides;
    const u0 = j / sides;
    const u1 = (j + 1) / sides;
    pushTri(topRing[j], [u0, topV], topTip, [(u0 + u1) * 0.5, 1.0], topRing[jn], [u1, topV]);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：风神遗迹垂挂断链（单次合并几何体，1 DrawCall）
// ---------------------------------------------------------------------------
function createHangingChainGeometry(THREE, linkCount = 8, swayX = 0.24, seed = 1) {
  const parts = [];
  const stepY = 0.23;

  // 顶部锚环
  const anchor = new THREE.TorusGeometry(0.12, 0.036, 6, 12);
  anchor.rotateX(Math.PI * 0.5);
  parts.push(anchor);

  for (let k = 0; k < linkCount; k++) {
    const t = (k + 1) / linkCount;
    const isLast = k === linkCount - 1;
    // 末节做成半缺口断链环
    const link = new THREE.TorusGeometry(0.105, 0.032, 5, 10, isLast ? Math.PI * 1.35 : Math.PI * 2);
    link.scale(0.74, 1.32, 1.0);
    if (k % 2 === 1) {
      link.rotateY(Math.PI * 0.5);
    }
    // 随高空风势轻柔弧形飘摆
    const curveX = Math.pow(t, 1.65) * swayX;
    const curveZ = Math.sin(t * Math.PI + seed) * 0.06;
    link.rotateZ(t * swayX * 0.55);
    link.translate(curveX, -(k + 1) * stepY, curveZ);
    parts.push(link);
  }

  return mergeSimpleGeometries(THREE, parts, true);
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：浮空岩块底部锥刺削面岩层簇（锐利岩刺 + 阶梯削面）
// ---------------------------------------------------------------------------
function createSpikedRockClusterGeometry(THREE, baseRadius, depth, spikeCount, seed) {
  const rRng = createRng((Math.abs(seed * 7919) | 0) + 73);
  const parts = [];
  const cTop = new THREE.Color(0xdbe6f5);
  const cMid = new THREE.Color(0x9fb5d4);
  const cBot = new THREE.Color(0x5d7aa4);
  const cVein = new THREE.Color(0x7be0ff);
  const tmpC = new THREE.Color();

  const buildSpike = (topR, h, offsetX, offsetY, offsetZ, tiltX, tiltZ, sSeed) => {
    const g = new THREE.CylinderGeometry(topR, topR * 0.03, h, 7, 4, false);
    g.translate(0, -h * 0.5, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const t = THREE.MathUtils.clamp(-y / h, 0, 1);
      const a = Math.atan2(z, x);
      const ledge = 1.0 + Math.sin(t * Math.PI * 4.0 + sSeed) * 0.14 + Math.cos(a * 3.0 + sSeed) * 0.18;
      x *= ledge;
      z *= ledge;
      pos.setXYZ(i, x, y, z);
    }
    const flat = g.toNonIndexed();
    g.dispose();
    flat.rotateX(tiltX);
    flat.rotateZ(tiltZ);
    flat.translate(offsetX, offsetY, offsetZ);

    const fp = flat.attributes.position;
    const cols = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) {
      const y = fp.getY(i);
      const t = THREE.MathUtils.clamp(-y / Math.max(depth, 0.5), 0, 1);
      if (t < 0.45) tmpC.lerpColors(cTop, cMid, t / 0.45);
      else tmpC.lerpColors(cMid, cBot, (t - 0.45) / 0.55);
      const vein = Math.pow(Math.max(0, Math.sin(fp.getX(i) * 3.2 + y * 2.4 + sSeed)), 10.0) * t;
      tmpC.lerp(cVein, vein * 0.45);
      cols[i * 3] = tmpC.r;
      cols[i * 3 + 1] = tmpC.g;
      cols[i * 3 + 2] = tmpC.b;
    }
    flat.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    flat.computeVertexNormals();
    return flat;
  };

  // 中央主锥刺
  parts.push(buildSpike(baseRadius * 0.62, depth, 0, 0, 0, 0.04, -0.05, seed));

  // 外围环绕不对称削面岩刺
  for (let k = 0; k < spikeCount; k++) {
    const a = (k / spikeCount) * Math.PI * 2 + rRng() * 0.5;
    const dist = baseRadius * (0.36 + rRng() * 0.34);
    const rSp = baseRadius * (0.26 + rRng() * 0.22);
    const hSp = depth * (0.42 + rRng() * 0.46);
    const tilt = 0.08 + rRng() * 0.14;
    parts.push(
      buildSpike(
        rSp,
        hSp,
        Math.cos(a) * dist,
        0.12 - rRng() * 0.25,
        Math.sin(a) * dist,
        Math.sin(a) * tilt,
        -Math.cos(a) * tilt,
        seed + k * 3.7
      )
    );
  }

  return mergeSimpleGeometries(THREE, parts, true);
}

// ---------------------------------------------------------------------------
// 程序化几何体构造：立体堆积云球簇（平底膨顶柔和云泡）与连续波浪云脊
// ---------------------------------------------------------------------------
function createOrganicCloudLobeGeometry(THREE, seed = 1.0) {
  const geom = new THREE.SphereGeometry(1.0, 20, 14);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // 多谐波立体云团起伏，彻底摆脱几何圆球僵硬感
    const billow =
      Math.sin(x * 2.9 + seed) * Math.cos(z * 2.6 - seed * 0.7) * 0.13 +
      Math.sin(y * 3.4 + x * 2.1 + seed * 1.4) * 0.08 +
      Math.cos(z * 4.1 - y * 2.7 + seed * 2.1) * 0.05;
    const radMul = 1.0 + billow;
    x *= radMul * 1.18;
    z *= radMul * 1.08;
    // 云底柔平托举、云顶圆润隆起
    if (y < 0) {
      y *= 0.56 * radMul;
    } else {
      y *= 0.96 * radMul;
    }
    pos.setXYZ(i, x, y, z);
  }
  geom.computeVertexNormals();
  return geom;
}

function createCloudRidgeGeometry(THREE, radius, startAngle, endAngle, baseHalfW, baseH, arcSegs, ringSegs, seed) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= arcSegs; i++) {
    const u = i / arcSegs;
    const a = THREE.MathUtils.lerp(startAngle, endAngle, u);
    const outX = Math.cos(a);
    const outZ = Math.sin(a);

    // 沿地平线呈柔和波浪状起伏的立体云脊轮廓，两端自然收窄消融
    const endTaper = Math.sin(u * Math.PI);
    const peakWave =
      0.55 +
      0.32 * Math.sin(u * Math.PI * 5.0 + seed) +
      0.18 * Math.cos(u * Math.PI * 9.0 - seed * 1.4);
    const localR = radius + Math.sin(u * Math.PI * 4.0 + seed) * 2.4;
    const localW = baseHalfW * (0.45 + 0.55 * endTaper) * (0.82 + 0.26 * peakWave);
    const localH = baseH * Math.pow(Math.max(0.02, endTaper), 0.55) * peakWave;
    const cx = outX * localR;
    const cz = outZ * localR;

    for (let j = 0; j <= ringSegs; j++) {
      const v = j / ringSegs;
      const phi = v * Math.PI * 2.0;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const puff = 1.0 + 0.12 * Math.sin(u * 26.0 + phi * 2.0 + seed);
      const rOff = cp * localW * puff;
      const yOff = (sp < 0 ? sp * 0.42 : sp) * localH * puff;
      positions.push(cx + outX * rOff, yOff, cz + outZ * rOff);
      uvs.push(u, v);
    }
  }

  const stride = ringSegs + 1;
  for (let i = 0; i < arcSegs; i++) {
    for (let j = 0; j < ringSegs; j++) {
      const a0 = i * stride + j;
      const a1 = (i + 1) * stride + j;
      const b0 = i * stride + (j + 1);
      const b1 = (i + 1) * stride + (j + 1);
      indices.push(a0, b0, a1, b0, b1, a1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ---------------------------------------------------------------------------
// 主入口：构建云巅风神祭坛 3D 战场
// ---------------------------------------------------------------------------
export function buildAltarBiome(THREE, texLib = {}) {
  const group = new THREE.Group();
  group.name = 'biome_altar';

  const rng = createRng(20260917);

  // 资源跟踪列表（仅释放本模块自建几何体、材质与兜底纹理，绝不释放外部 texLib 原图）
  const ownedGeometries = [];
  const ownedMaterials = [];
  const ownedTextures = [];
  const ownedInstancedMeshes = [];
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
  const trackInst = (im) => {
    ownedInstancedMeshes.push(im);
    return im;
  };

  // 解析 texLib（安全读取 map + 可选 PBR normalMap / roughnessMap / emissiveMap）
  const rawMarble = resolveTex(texLib.marble);
  const rawMarbleNorm = resolveTexChannel(texLib.marble, 'normalMap');
  const rawMarbleRough = resolveTexChannel(texLib.marble, 'roughnessMap');
  const rawStone = resolveTex(texLib.courtyardStone);
  const rawStoneNorm = resolveTexChannel(texLib.courtyardStone, 'normalMap');
  const rawStoneRough = resolveTexChannel(texLib.courtyardStone, 'roughnessMap');
  const rawIce = resolveTex(texLib.iceCrystal);
  const rawIceNorm = resolveTexChannel(texLib.iceCrystal, 'normalMap');
  const rawIceRough = resolveTexChannel(texLib.iceCrystal, 'roughnessMap');
  const rawIceEmis = resolveTexChannel(texLib.iceCrystal, 'emissiveMap');
  const rawArcane = resolveTex(texLib.arcaneFloorDecal);
  const rawCloud = resolveTex(texLib.cloudNoise);
  const rawGlow = resolveTex(texLib.softGlowDisc);

  const fallbackWhite = trackTex(createFallbackWhiteTex(THREE));
  const cloudSampleTex = rawCloud ? makeRepeatingTex(THREE, rawCloud) : fallbackWhite;

  // 动画引用集合
  const shaderUniforms = [];
  const floatingIslands = [];
  const floatingCrystals = [];
  const hoveringDrums = [];
  const rotatingRings = [];
  const pulsedLights = [];
  const swayingChains = [];
  const driftingClouds = [];

  // =========================================================================
  // 共享核心 PBR 材质（雪瓷白大理石 · 香槟金镶边 · 双层折光星晶 · 浮空岩基）
  // 兼顾无 envMap 时同样通透明亮，高光不发黑、白瓷不爆曝
  // =========================================================================
  const marbleFloorTex = makeTiledTex(THREE, rawMarble, 4.4, 4.4);
  const marbleFloorNorm = makeTiledTex(THREE, rawMarbleNorm, 4.4, 4.4);
  const marbleColTex = makeTiledTex(THREE, rawMarble, 1.4, 2.8);
  const marbleColNorm = makeTiledTex(THREE, rawMarbleNorm, 1.4, 2.8);
  const stoneTrimTex = makeTiledTex(THREE, rawStone || rawMarble, 6.0, 1.4);
  const stoneTrimNorm = makeTiledTex(THREE, rawStoneNorm || rawMarbleNorm, 6.0, 1.4);
  const stoneTrimRough = makeTiledTex(THREE, rawStoneRough || rawMarbleRough, 6.0, 1.4);
  const iceShardTex = makeTiledTex(THREE, rawIce, 1.3, 1.7);
  const iceShardNorm = makeTiledTex(THREE, rawIceNorm, 1.3, 1.7);
  const iceShardRough = makeTiledTex(THREE, rawIceRough, 1.3, 1.7);
  const iceShardEmis = makeTiledTex(THREE, rawIceEmis, 1.3, 1.7);

  const matMarbleFloor = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0f4fc,
      map: marbleFloorTex,
      normalMap: marbleFloorNorm,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.42,
      metalness: 0.04
    })
  );

  const matMarbleColumn = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f7fe,
      map: marbleColTex,
      normalMap: marbleColNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.36,
      metalness: 0.05
    })
  );

  const matMarbleArch = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeef3fb,
      map: stoneTrimTex,
      normalMap: stoneTrimNorm,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.42,
      metalness: 0.05
    })
  );

  const matStonePlinth = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0e9f6,
      map: stoneTrimTex,
      normalMap: stoneTrimNorm,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: stoneTrimRough,
      roughness: 0.58,
      metalness: 0.04
    })
  );

  const matWeatheredJoint = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb7c8e0,
      map: stoneTrimTex,
      roughness: 0.78,
      metalness: 0.04
    })
  );

  const matNicheRecess = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6f8db8,
      roughness: 0.76,
      metalness: 0.08
    })
  );

  const matChampagneGold = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2d48b,
      emissive: 0x5c4316,
      emissiveIntensity: 0.24,
      roughness: 0.27,
      metalness: 0.58
    })
  );

  const matBrightGold = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4a0,
      emissive: 0x9b742a,
      emissiveIntensity: 0.40,
      roughness: 0.20,
      metalness: 0.64
    })
  );

  const matAncientChain = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9fa9bc,
      emissive: 0x262d3c,
      emissiveIntensity: 0.14,
      roughness: 0.38,
      metalness: 0.72
    })
  );

  const matRockSpire = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: stoneTrimTex,
      normalMap: stoneTrimNorm,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.84,
      metalness: 0.04
    })
  );

  const matMonolithStone = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc9d7ea,
      map: stoneTrimTex,
      normalMap: stoneTrimNorm,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.68,
      metalness: 0.08,
      flatShading: true
    })
  );

  // 星晶内层主晶身（硬切面冰晶折光）
  const matStarCrystal = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x96ecff,
      map: iceShardTex,
      normalMap: iceShardNorm,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: iceShardRough,
      emissive: 0x38bfff,
      emissiveMap: iceShardEmis,
      emissiveIntensity: 0.92,
      roughness: 0.14,
      metalness: 0.18,
      flatShading: true,
      transparent: true,
      opacity: 0.88
    })
  );

  // 星晶外层半透折光晶壳（微扩裹覆，捕捉锐利菲涅耳削面高光）
  const matStarCrystalShell = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8fbff,
      map: iceShardTex,
      normalMap: iceShardNorm,
      normalScale: new THREE.Vector2(0.65, 0.65),
      emissive: 0x62d8ff,
      emissiveIntensity: 0.42,
      roughness: 0.07,
      metalness: 0.24,
      flatShading: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  );

  // 内发光青金核芯（由下至上呈现香槟金星核 → 冰晶苍青脉冲光晕）
  const crystalHeartUniforms = {
    uTime: { value: 0 },
    uStormLevel: { value: 0.0 }
  };
  shaderUniforms.push(crystalHeartUniforms);

  const matCrystalCore = trackMat(
    new THREE.ShaderMaterial({
      uniforms: crystalHeartUniforms,
      transparent: true,
      depthWrite: true,
      vertexShader: /* glsl */ `
        varying vec3 vLocalPos;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        void main() {
          vLocalPos = position;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uStormLevel;
        varying vec3 vLocalPos;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        void main() {
          float h = clamp(vLocalPos.y * 0.45 + 0.5, 0.0, 1.0);
          float ndotv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
          float coreHot = pow(ndotv, 1.35);
          float pulse = 0.88 + 0.12 * sin(uTime * 2.6 + vLocalPos.y * 3.0);
          // 中心暖香槟金星核 → 外缘高透冰晶青白
          vec3 colGold = mix(vec3(1.00, 0.88, 0.56), vec3(1.00, 0.94, 0.72), uStormLevel);
          vec3 colCyan = mix(vec3(0.46, 0.92, 1.00), vec3(0.32, 0.96, 1.00), uStormLevel);
          vec3 col = mix(colCyan, colGold, coreHot * (0.62 - 0.16 * h));
          col += vec3(0.18, 0.22, 0.24) * (1.0 - ndotv) * (0.4 + 0.45 * uStormLevel);
          gl_FragColor = vec4(col * pulse * (1.02 + uStormLevel * 0.14), 0.95);
        }
      `
    })
  );

  const matRuneGlowCyan = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x7ae8ff,
      transparent: true,
      opacity: 0.86
    })
  );

  const matRuneGlowGold = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffe8a6,
      transparent: true,
      opacity: 0.88
    })
  );

  // 共享 AAA 雕刻削面星晶几何池（供主冠核、柱间晶、尖塔晶、前柱碎晶与外围浮石复用）
  const geoCrystalHero7 = trackGeo(
    createFacetedCrystalPrismGeometry(THREE, {
      radius: 0.58, height: 3.15, sides: 7, topRatio: 0.58, crownY: 0.34, upperY: 0.14, lowerY: -0.24, bevelSkew: 0.11, twist: 0.10, asym: 0.16, seed: 3.1
    })
  );
  const geoCrystalMain6 = trackGeo(
    createFacetedCrystalPrismGeometry(THREE, {
      radius: 0.42, height: 2.35, sides: 6, topRatio: 0.57, crownY: 0.35, upperY: 0.15, lowerY: -0.25, bevelSkew: 0.14, twist: 0.12, asym: 0.18, seed: 7.4
    })
  );
  const geoCrystalSide5 = trackGeo(
    createFacetedCrystalPrismGeometry(THREE, {
      radius: 0.26, height: 1.48, sides: 5, topRatio: 0.62, crownY: 0.36, upperY: 0.12, lowerY: -0.28, bevelSkew: 0.16, twist: -0.10, asym: 0.22, seed: 13.7
    })
  );
  const geoCrystalSplinter = trackGeo(
    createFacetedCrystalPrismGeometry(THREE, {
      radius: 0.16, height: 0.92, sides: 5, topRatio: 0.60, crownY: 0.34, upperY: 0.10, lowerY: -0.30, bevelSkew: 0.15, twist: 0.14, asym: 0.24, seed: 29.3
    })
  );
  const geoOrbitalBead = trackGeo(
    createFacetedCrystalPrismGeometry(THREE, {
      radius: 0.085, height: 0.22, sides: 4, topRatio: 0.5, crownY: 0.26, upperY: 0.05, lowerY: -0.05, bevelSkew: 0.02, twist: 0.0, asym: 0.04, seed: 5.0
    })
  );

  // -------------------------------------------------------------------------
  // 工厂函数：构建 AAA 多面体不对称双层星晶簇
  // （长短主副削面棱晶 + 内发光青金核芯 + 半透折光外晶壳 + 细金星轨环饰）
  // -------------------------------------------------------------------------
  function buildStarCrystalCluster({
    hero = false,
    scale = 1.0,
    subCount = 3,
    includeOuterShell = true,
    includeGoldCollar = true,
    orbitRadius = 0,
    secondaryOrbitRadius = 0,
    orbitColorGold = true,
    seed = 1
  } = {}) {
    const cRng = createRng((Math.abs(seed * 6131) | 0) + 41);
    const cluster = new THREE.Group();
    const spinPivot = new THREE.Group();
    cluster.add(spinPivot);

    const primaryGeo = hero ? geoCrystalHero7 : geoCrystalMain6;

    // 1. 主削面棱晶（内发光青金核芯 + 硬削面晶身 + 半透折光外晶壳）
    const mainBody = new THREE.Mesh(primaryGeo, matStarCrystal);
    mainBody.scale.setScalar(scale);
    spinPivot.add(mainBody);

    const mainHeart = new THREE.Mesh(primaryGeo, matCrystalCore);
    mainHeart.scale.set(scale * 0.52, scale * 0.64, scale * 0.52);
    spinPivot.add(mainHeart);

    if (includeOuterShell) {
      const mainShell = new THREE.Mesh(primaryGeo, matStarCrystalShell);
      mainShell.scale.set(scale * 1.11, scale * 1.06, scale * 1.11);
      mainShell.rotation.y = 0.22;
      spinPivot.add(mainShell);
    }

    // 2. 长短不对称副削面棱晶群（围绕主晶斜向簇生）
    for (let k = 0; k < subCount; k++) {
      const ang = (k / Math.max(1, subCount)) * Math.PI * 2 + (cRng() - 0.5) * 0.55;
      const lenMul = (0.58 + cRng() * 0.42) * scale;
      const radMul = (0.68 + cRng() * 0.34) * scale;
      const offR = (hero ? 0.38 : 0.26) * scale * (0.85 + cRng() * 0.35);
      const offY = ((k % 2 === 0 ? -0.26 : 0.08) + (cRng() - 0.5) * 0.16) * scale;
      const tilt = 0.22 + cRng() * 0.24;

      const subGeo = k % 2 === 0 ? geoCrystalSide5 : geoCrystalSplinter;
      const subPivot = new THREE.Group();
      subPivot.position.set(Math.cos(ang) * offR, offY, Math.sin(ang) * offR);
      subPivot.rotation.set(Math.sin(ang) * tilt, ang + cRng() * 0.7, -Math.cos(ang) * tilt);

      const subMesh = new THREE.Mesh(subGeo, matStarCrystal);
      subMesh.scale.set(radMul, lenMul, radMul);
      subPivot.add(subMesh);

      const subHeart = new THREE.Mesh(subGeo, matCrystalCore);
      subHeart.scale.set(radMul * 0.48, lenMul * 0.60, radMul * 0.48);
      subPivot.add(subHeart);

      if (includeOuterShell && k < 2) {
        const subShell = new THREE.Mesh(subGeo, matStarCrystalShell);
        subShell.scale.set(radMul * 1.12, lenMul * 1.05, radMul * 1.12);
        subPivot.add(subShell);
      }

      spinPivot.add(subPivot);
    }

    // 3. 贴身细金星轨箍与棱钻缀饰
    if (includeGoldCollar) {
      const collarR = (hero ? 0.66 : 0.48) * scale;
      const collar = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(collarR, 0.026 * Math.max(0.75, scale), 6, 28)),
        matBrightGold
      );
      collar.rotation.x = Math.PI * 0.5 + 0.24;
      collar.rotation.z = -0.18;
      collar.position.y = -0.12 * scale;
      spinPivot.add(collar);

      const studs = hero ? 4 : 3;
      for (let s = 0; s < studs; s++) {
        const sa = (s / studs) * Math.PI * 2;
        const bead = new THREE.Mesh(geoOrbitalBead, s % 2 === 0 ? matBrightGold : matRuneGlowCyan);
        bead.position.set(Math.cos(sa) * collarR, Math.sin(sa) * collarR, 0);
        bead.scale.setScalar(scale * 0.85);
        collar.add(bead);
      }
    }

    // 4. 外围细金星轨仪环（可选单环或双反旋环）
    let ringA = null;
    let ringB = null;
    if (orbitRadius > 0) {
      ringA = new THREE.Group();
      const ringATorus = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(orbitRadius, hero ? 0.048 : 0.028, 8, hero ? 52 : 34)),
        orbitColorGold ? matBrightGold : matRuneGlowCyan
      );
      ringA.add(ringATorus);

      const fineInner = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(orbitRadius * 0.88, hero ? 0.02 : 0.014, 6, hero ? 44 : 28)),
        orbitColorGold ? matRuneGlowCyan : matChampagneGold
      );
      ringA.add(fineInner);

      const nodeCount = hero ? 4 : 2;
      for (let n = 0; n < nodeCount; n++) {
        const na = (n / nodeCount) * Math.PI * 2;
        const node = new THREE.Mesh(geoOrbitalBead, matBrightGold);
        node.position.set(Math.cos(na) * orbitRadius, Math.sin(na) * orbitRadius, 0);
        node.rotation.z = na;
        node.scale.setScalar(hero ? 1.35 : 0.85);
        ringA.add(node);
      }
      ringA.rotation.x = Math.PI * 0.5 + 0.28;
      cluster.add(ringA);
    }

    if (secondaryOrbitRadius > 0) {
      ringB = new THREE.Group();
      const ringBTorus = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(secondaryOrbitRadius, hero ? 0.04 : 0.024, 8, hero ? 56 : 36)),
        matChampagneGold
      );
      ringB.add(ringBTorus);
      const tickCount = hero ? 8 : 4;
      for (let n = 0; n < tickCount; n++) {
        const na = (n / tickCount) * Math.PI * 2;
        const node = new THREE.Mesh(geoOrbitalBead, n % 2 === 0 ? matRuneGlowGold : matRuneGlowCyan);
        node.position.set(Math.cos(na) * secondaryOrbitRadius, Math.sin(na) * secondaryOrbitRadius, 0);
        node.rotation.z = na;
        node.scale.setScalar(hero ? 0.95 : 0.65);
        ringB.add(node);
      }
      ringB.rotation.x = Math.PI * 0.34;
      ringB.rotation.y = 0.45;
      cluster.add(ringB);
    }

    return { cluster, spinPivot, ringA, ringB };
  }

  // =========================================================================
  // 1. 高空蔚蓝 → 香槟金渐变苍穹 + 远空日光晕 + 神圣主光源与双色半球光
  // =========================================================================
  const sunDir = new THREE.Vector3(0, 16, -14).normalize();

  const skyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir.clone() },
    uCloudTex: { value: cloudSampleTex },
    uHasCloudTex: { value: rawCloud ? 1.0 : 0.0 },
    uStormLevel: { value: 0.0 }
  };
  shaderUniforms.push(skyUniforms);

  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
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
        uniform vec3 uSunDir;
        uniform sampler2D uCloudTex;
        uniform float uHasCloudTex;
        uniform float uStormLevel;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
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

          // 高空蔚蓝 → 清透天青 → 雪瓷浅冰 → 香槟日落金地平线（风暴眼 P2 强化苍穹青金电辉）
          vec3 colZenith   = mix(vec3(0.14, 0.40, 0.80), vec3(0.08, 0.28, 0.62), uStormLevel);
          vec3 colMidSky   = mix(vec3(0.39, 0.70, 0.96), vec3(0.20, 0.62, 0.88), uStormLevel);
          vec3 colIceMist  = mix(vec3(0.82, 0.91, 0.99), vec3(0.64, 0.90, 0.99), uStormLevel);
          vec3 colChampagne= mix(vec3(1.00, 0.89, 0.70), vec3(1.00, 0.87, 0.56), uStormLevel);
          vec3 colHorizon  = mix(vec3(0.99, 0.82, 0.58), vec3(0.92, 0.86, 0.58), uStormLevel);
          vec3 colAbyss    = mix(vec3(0.56, 0.74, 0.91), vec3(0.38, 0.66, 0.88), uStormLevel);

          vec3 sky;
          if (h >= 0.0) {
            float t1 = smoothstep(0.0, 0.14, h);
            float t2 = smoothstep(0.12, 0.46, h);
            float t3 = smoothstep(0.42, 0.92, h);
            sky = mix(colChampagne, colIceMist, t1);
            sky = mix(sky, colMidSky, t2);
            sky = mix(sky, colZenith, t3);
          } else {
            float tb = smoothstep(0.0, -0.42, h);
            sky = mix(colChampagne, colAbyss, tb);
          }

          // 地平线暖金/青金光带
          float horizonGlow = exp(-abs(h - 0.015) * 11.5);
          sky = mix(sky, colHorizon, horizonGlow * (0.52 + uStormLevel * 0.14));

          // 太阳方向米氏前向散射与神圣金轮
          float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
          float wideHalo = pow(sunDot, 4.5);
          float tightCorona = pow(sunDot, 36.0);
          float sunDisc = smoothstep(0.9955, 0.9988, sunDot);

          sky += vec3(1.0, 0.88, 0.64) * wideHalo * 0.42;
          sky += vec3(1.0, 0.94, 0.80) * tightCorona * 0.65;
          sky += vec3(1.38, 1.28, 1.05) * sunDisc * 1.15;

          // 高空丝絮卷云（风暴眼 P2 加速流动并泛出青金电弧光晕）
          if (h > 0.05) {
            float driftMul = 1.0 + uStormLevel * 1.35;
            vec2 skyUv = d.xz / (h + 0.36) * 0.24;
            vec2 uv1 = skyUv + vec2(uTime * 0.005 * driftMul, -uTime * 0.003 * driftMul);
            vec2 uv2 = skyUv * 1.85 - vec2(uTime * 0.0035 * driftMul, uTime * 0.002 * driftMul);
            float c1 = mix(vnoise(uv1 * 6.0), texture2D(uCloudTex, uv1).r, uHasCloudTex);
            float c2 = mix(vnoise(uv2 * 6.0), texture2D(uCloudTex, uv2).r, uHasCloudTex);
            float cirrus = smoothstep(0.54, 0.84, c1 * 0.65 + c2 * 0.35);
            float mask = smoothstep(0.06, 0.22, h) * (1.0 - smoothstep(0.62, 0.94, h));
            vec3 cirrusCol = mix(vec3(0.95, 0.98, 1.0), vec3(1.0, 0.92, 0.76), wideHalo * 0.8 + horizonGlow * 0.5);
            sky = mix(sky, cirrusCol, cirrus * mask * (0.34 + uStormLevel * 0.14));

            // 风暴眼青金苍穹电弧脉纹（仅 uStormLevel > 0 时激活，轻灵不刺眼）
            if (uStormLevel > 0.01) {
              float ang = atan(d.z, d.x);
              float arcWave = sin(ang * 9.0 + h * 14.0 - uTime * 2.8) * 0.5 + 0.5;
              float arcStreak = pow(1.0 - abs(c1 - c2) * 2.4, 5.0);
              float arcPulse = 0.55 + 0.45 * sin(uTime * 4.2 + ang * 3.0);
              vec3 arcCol = mix(vec3(0.32, 0.92, 1.0), vec3(1.0, 0.88, 0.52), arcWave);
              sky += arcCol * arcStreak * arcPulse * mask * uStormLevel * 0.42;
            }
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `
    })
  );

  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(96, 48, 32)), skyMat);
  skyDome.name = 'sky_dome';
  skyDome.renderOrder = -10;
  group.add(skyDome);

  // 远空太阳圣光晕（沿着 godRayOrigin 方向投射，提供温暖星芒与 Bloom 核心）
  const sunHaloGroup = new THREE.Group();
  sunHaloGroup.position.set(0, 29.5, -26.0);
  sunHaloGroup.lookAt(0, 3.0, 0);
  group.add(sunHaloGroup);

  const sunCoreMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
      map: rawGlow || null,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  const sunOuterMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffd78e,
      map: rawGlow || null,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  const sunFlareUniforms = { uTime: { value: 0 } };
  shaderUniforms.push(sunFlareUniforms);
  const sunCrossMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: sunFlareUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
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
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x) + uTime * 0.06;
          float rays = pow(abs(cos(a * 2.0)), 18.0) * 0.72 + pow(abs(cos(a * 4.0 + 0.785)), 24.0) * 0.42;
          float core = exp(-r * 3.8);
          float halo = exp(-r * 1.9) * (0.35 + rays * 0.85);
          float fade = smoothstep(1.0, 0.15, r);
          float pulse = 0.92 + 0.08 * sin(uTime * 1.35);
          vec3 col = mix(vec3(1.0, 0.84, 0.56), vec3(1.25, 1.18, 0.98), core);
          gl_FragColor = vec4(col * pulse, (core * 0.85 + halo * 0.55) * fade);
        }
      `
    })
  );

  const sunCorePlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(11.5, 11.5)), sunCoreMat);
  const sunOuterPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(28.0, 28.0)), sunOuterMat);
  sunOuterPlane.position.z = -0.2;
  const sunCrossPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(24.0, 24.0)), sunCrossMat);
  sunCrossPlane.position.z = 0.1;
  sunHaloGroup.add(sunOuterPlane, sunCorePlane, sunCrossPlane);

  // 神圣光照系统：高光主平行光（投射阴影）+ 蔚蓝/金云双色半球光 + 前侧清透补光 + 圣坛晶核点光
  const sunLight = new THREE.DirectionalLight(0xfff2d8, 1.92);
  sunLight.position.set(6.5, 22.0, -16.5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -15;
  sunLight.shadow.camera.right = 15;
  sunLight.shadow.camera.top = 15;
  sunLight.shadow.camera.bottom = -15;
  sunLight.shadow.camera.near = 4;
  sunLight.shadow.camera.far = 54;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.025;
  group.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0x94ceff, 0xffdca0, 0.98);
  group.add(hemiLight);

  // 前景柔和天青补光（保证白瓷神殿面向镜头的立面与角色轮廓同样雪瓷通透）
  const frontFillLight = new THREE.DirectionalLight(0xd8ecff, 0.54);
  frontFillLight.position.set(-9.5, 10.0, 14.5);
  group.add(frontFillLight);

  // 圣殿后方星晶拱门聚能点光
  const sanctumLight = new THREE.PointLight(0x7ae8ff, 1.75, 20, 1.5);
  sanctumLight.position.set(0, 9.6, -10.8);
  group.add(sanctumLight);
  pulsedLights.push({ light: sanctumLight, base: 1.75, amp: 0.35, speed: 1.4, phase: 0.0 });

  // 祭坛底部浮空晶核点光
  const coreLight = new THREE.PointLight(0x64d2ff, 1.45, 18, 1.5);
  coreLight.position.set(0, -2.5, 2.2);
  group.add(coreLight);
  pulsedLights.push({ light: coreLight, base: 1.45, amp: 0.28, speed: 1.1, phase: 1.7 });

  // =========================================================================
  // 2. 多层八角/圆形浮空神殿台座（直径 ~23.6，y=0 绝对平坦安全区）
  // =========================================================================
  const platformGroup = new THREE.Group();
  platformGroup.name = 'floating_altar_platform';
  group.add(platformGroup);

  // 主战斗雪瓷大理石圆台：顶面严格处于 y = 0.0，半径 10.65（完全包络 [-8.5,8.5]×[-4.2,4.2]）
  const mainDeckGeo = trackGeo(new THREE.CylinderGeometry(10.65, 10.72, 0.36, 48));
  const mainDeck = new THREE.Mesh(mainDeckGeo, matMarbleFloor);
  mainDeck.position.y = -0.18;
  mainDeck.receiveShadow = true;
  mainDeck.castShadow = true;
  platformGroup.add(mainDeck);

  // 齐平台面香槟金同心嵌条（贴地 0.005，绝对零遮挡）
  const inlaySpecs = [
    { inner: 5.26, outer: 5.42, y: 0.005 },
    { inner: 8.82, outer: 8.96, y: 0.005 },
    { inner: 10.36, outer: 10.62, y: 0.006 }
  ];
  for (const spec of inlaySpecs) {
    const rGeo = trackGeo(new THREE.RingGeometry(spec.inner, spec.outer, 64));
    rGeo.rotateX(-Math.PI * 0.5);
    const rMesh = new THREE.Mesh(rGeo, matChampagneGold);
    rMesh.position.y = spec.y;
    rMesh.receiveShadow = true;
    platformGroup.add(rMesh);
  }

  // 8 方向罗盘星芒金线嵌条（从中央法阵外缘延伸至外台沿，齐平贴地）
  const rayStripGeo = trackGeo(new THREE.PlaneGeometry(0.11, 4.94));
  rayStripGeo.rotateX(-Math.PI * 0.5);
  const diamondGeo = trackGeo(new THREE.CircleGeometry(0.32, 4));
  diamondGeo.rotateX(-Math.PI * 0.5);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const midR = 7.89;
    const strip = new THREE.Mesh(rayStripGeo, matChampagneGold);
    strip.position.set(Math.cos(a) * midR, 0.004, Math.sin(a) * midR);
    strip.rotation.y = -a + Math.PI * 0.5;
    strip.receiveShadow = true;
    platformGroup.add(strip);

    // 外圈 8 枚齐平冰蓝星晶嵌饰
    const gemR = 9.65;
    const gem = new THREE.Mesh(diamondGeo, i % 2 === 0 ? matRuneGlowCyan : matBrightGold);
    gem.position.set(Math.cos(a) * gemR, 0.007, Math.sin(a) * gemR);
    gem.rotation.y = -a;
    platformGroup.add(gem);
  }

  // 中央宏大旋转星霜法阵（双层反旋 GLSL + arcaneFloorDecal，使用 NormalBlending 保证雪白大理石上清晰锐利）
  const arcaneOuterUniforms = {
    uTime: { value: 0 },
    uTex: { value: rawArcane || fallbackWhite },
    uHasTex: { value: rawArcane ? 1.0 : 0.0 }
  };
  shaderUniforms.push(arcaneOuterUniforms);

  const arcaneOuterMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: arcaneOuterUniforms,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
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
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);

          // 采样外部 arcaneFloorDecal
          vec4 texSample = texture2D(uTex, vUv);
          float texLum = max(texSample.a, dot(texSample.rgb, vec3(0.3, 0.59, 0.11)));

          // 精细星霜几何刻度环（与外部法阵纹理相融互补）
          float ringOuter = smoothstep(0.022, 0.006, abs(r - 0.94));
          float ringMid   = smoothstep(0.018, 0.005, abs(r - 0.72));
          float ringTicks = smoothstep(0.015, 0.004, abs(r - 0.83)) * step(0.25, sin(a * 24.0));
          // 八芒星几何
          float star8 = smoothstep(0.032, 0.006, abs(r - (0.56 + 0.16 * abs(cos(a * 4.0)))));
          float procPattern = clamp(ringOuter + ringMid * 0.85 + ringTicks * 0.75 + star8 * 0.7, 0.0, 1.0);

          float mask = mix(procPattern, clamp(texLum * 0.92 + procPattern * 0.55, 0.0, 1.0), uHasTex);

          // 扫光脉冲波纹（皇家蓝 → 冰晶青 → 香槟金外缘）
          float pulse = 0.82 + 0.18 * sin(uTime * 1.8 - r * 5.0);
          float sweep = smoothstep(0.55, 1.0, cos(a * 2.0 - uTime * 0.9));

          vec3 colRoyal = vec3(0.11, 0.39, 0.92);
          vec3 colCyan  = vec3(0.26, 0.80, 1.00);
          vec3 colGold  = vec3(0.92, 0.74, 0.36);

          vec3 col = mix(colRoyal, colCyan, smoothstep(0.22, 0.72, r));
          col = mix(col, colGold, smoothstep(0.78, 0.97, r) * 0.85 + ringOuter * 0.6);
          col += vec3(0.38, 0.65, 0.85) * sweep * 0.26;

          float radialFade = smoothstep(1.0, 0.94, r);
          float alpha = clamp(mask * 0.74 * pulse * radialFade, 0.0, 0.88);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `
    })
  );

  const arcaneOuterPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(10.4, 10.4)), arcaneOuterMat);
  arcaneOuterPlane.rotation.x = -Math.PI * 0.5;
  arcaneOuterPlane.position.y = 0.012;
  platformGroup.add(arcaneOuterPlane);
  rotatingRings.push({ mesh: arcaneOuterPlane, axis: 'z', speed: 0.065 });

  // 内圈反旋星轨仪刻度环
  const arcaneInnerUniforms = { uTime: { value: 0 } };
  shaderUniforms.push(arcaneInnerUniforms);

  const arcaneInnerMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: arcaneInnerUniforms,
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
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);

          float r1 = smoothstep(0.026, 0.006, abs(r - 0.88));
          float r2 = smoothstep(0.022, 0.006, abs(r - 0.52));
          float dashes = smoothstep(0.03, 0.008, abs(r - 0.70)) * smoothstep(0.1, 0.4, sin(a * 16.0));
          float compass = smoothstep(0.024, 0.005, abs(r - (0.34 + 0.14 * abs(sin(a * 2.0)))));
          float pattern = clamp(r1 + r2 * 0.85 + dashes * 0.8 + compass * 0.85, 0.0, 1.0);

          float breath = 0.76 + 0.24 * sin(uTime * 2.1 + 1.2);
          vec3 col = mix(vec3(0.18, 0.62, 0.98), vec3(0.96, 0.80, 0.42), r1 * 0.75 + dashes * 0.55);
          float alpha = pattern * 0.68 * breath;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `
    })
  );

  const arcaneInnerPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(6.3, 6.3)), arcaneInnerMat);
  arcaneInnerPlane.rotation.x = -Math.PI * 0.5;
  arcaneInnerPlane.position.y = 0.016;
  platformGroup.add(arcaneInnerPlane);
  rotatingRings.push({ mesh: arcaneInnerPlane, axis: 'z', speed: -0.115 });

  // 外缘古典线脚浮雕檐口底座（LatheGeometry 精密线脚 + 32 块石缝风化切角压顶石，均位于 y <= 0 绝不遮挡作战区）
  const corniceUpperProfile = [
    new THREE.Vector2(10.58, -0.02),
    new THREE.Vector2(11.46, -0.02),
    new THREE.Vector2(11.56, -0.10),
    new THREE.Vector2(11.48, -0.18),
    new THREE.Vector2(11.62, -0.26),
    new THREE.Vector2(11.72, -0.44),
    new THREE.Vector2(11.56, -0.52),
    new THREE.Vector2(10.58, -0.52)
  ];
  const midPlinth = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(corniceUpperProfile, 48)),
    matStonePlinth
  );
  midPlinth.receiveShadow = true;
  midPlinth.castShadow = true;
  platformGroup.add(midPlinth);

  const corniceLowerProfile = [
    new THREE.Vector2(11.35, -0.50),
    new THREE.Vector2(12.24, -0.50),
    new THREE.Vector2(12.34, -0.58),
    new THREE.Vector2(12.22, -0.68),
    new THREE.Vector2(12.06, -0.84),
    new THREE.Vector2(11.86, -0.96),
    new THREE.Vector2(11.68, -1.08),
    new THREE.Vector2(11.20, -1.08)
  ];
  const lowerCornice = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(corniceLowerProfile, 16)),
    matMarbleArch
  );
  lowerCornice.rotation.y = Math.PI / 16;
  lowerCornice.receiveShadow = true;
  lowerCornice.castShadow = true;
  platformGroup.add(lowerCornice);

  // 石缝暗槽底垫环（衬托 32 块切角压顶石之间的风化石缝层次）
  const jointBedRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(10.42, 11.44, 48)),
    matWeatheredJoint
  );
  jointBedRing.rotation.x = -Math.PI * 0.5;
  jointBedRing.position.y = -0.045;
  jointBedRing.receiveShadow = true;
  platformGroup.add(jointBedRing);

  // 32 块石缝风化切角压顶石板（InstancedMesh，1 DrawCall，自带微小风化倾角起伏）
  const geoCopingSlab = trackGeo(createWeatheredCopingSlabGeometry(THREE));
  const copingInst = trackInst(new THREE.InstancedMesh(geoCopingSlab, matMarbleFloor, 32));
  copingInst.receiveShadow = true;
  copingInst.castShadow = true;
  const dummyObj = new THREE.Object3D();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const weatherY = (rng() - 0.5) * 0.014;
    const weatherTilt = (rng() - 0.5) * 0.016;
    dummyObj.position.set(Math.cos(a) * 10.94, 0.002 + weatherY, Math.sin(a) * 10.94);
    dummyObj.rotation.set(weatherTilt, -a, (rng() - 0.5) * 0.012);
    dummyObj.scale.set(0.96, 1.0, 0.94 + (i % 3) * 0.015);
    dummyObj.updateMatrix();
    copingInst.setMatrixAt(i, dummyObj.matrix);
  }
  copingInst.instanceMatrix.needsUpdate = true;
  platformGroup.add(copingInst);

  // 48 枚古典齿饰檐块（Cornice Dentils，InstancedMesh，1 DrawCall）
  const geoDentil = trackGeo(new THREE.BoxGeometry(0.24, 0.16, 0.28));
  const dentilInst = trackInst(new THREE.InstancedMesh(geoDentil, matMarbleArch, 48));
  dentilInst.castShadow = true;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    dummyObj.position.set(Math.cos(a) * 11.72, -0.46, Math.sin(a) * 11.72);
    dummyObj.rotation.set(0, -a, 0);
    dummyObj.scale.set(1, 1, 1);
    dummyObj.updateMatrix();
    dentilInst.setMatrixAt(i, dummyObj.matrix);
  }
  dentilInst.instanceMatrix.needsUpdate = true;
  platformGroup.add(dentilInst);

  // 台沿三道浮雕金边檐线（Molded Gold Cornice Fillets）
  const goldRimTop = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(11.53, 0.072, 10, 48)),
    matBrightGold
  );
  goldRimTop.rotation.x = Math.PI * 0.5;
  goldRimTop.position.y = -0.10;
  platformGroup.add(goldRimTop);

  const goldRimMid = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(11.68, 0.046, 8, 48)),
    matChampagneGold
  );
  goldRimMid.rotation.x = Math.PI * 0.5;
  goldRimMid.position.y = -0.34;
  platformGroup.add(goldRimMid);

  const goldRimLower = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(12.28, 0.088, 10, 16)),
    matChampagneGold
  );
  goldRimLower.rotation.x = Math.PI * 0.5;
  goldRimLower.rotation.z = Math.PI / 16;
  goldRimLower.position.y = -0.56;
  platformGroup.add(goldRimLower);

  const goldRimUnder = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(11.74, 0.052, 8, 16)),
    matChampagneGold
  );
  goldRimUnder.rotation.x = Math.PI * 0.5;
  goldRimUnder.rotation.z = Math.PI / 16;
  goldRimUnder.position.y = -1.04;
  platformGroup.add(goldRimUnder);

  // 16 组 ExtrudeGeometry 雕刻古典涡卷托座（Scroll Corbels + 金脊饰条 + 涡眼花饰 + 切面星晶宝石嵌座）
  const geoScrollCorbel = trackGeo(createScrollCorbelGeometry(THREE));
  const geoScrollTrim = trackGeo(createScrollCorbelTrimGeometry(THREE));
  const geoScrollEye = trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.44, 12));
  geoScrollEye.rotateX(Math.PI * 0.5);
  const geoRimGemBezel = trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.12, 4));
  geoRimGemBezel.rotateZ(Math.PI * 0.5);
  const geoRimFacetGem = trackGeo(
    createFacetedCrystalPrismGeometry(THREE, {
      radius: 0.14, height: 0.46, sides: 6, topRatio: 0.5, crownY: 0.28, upperY: 0.10, lowerY: -0.10, bevelSkew: 0.04, twist: 0.04, asym: 0.08, seed: 19.2
    })
  );

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const corbelGroup = new THREE.Group();
    corbelGroup.position.set(Math.cos(a) * 11.20, -1.42, Math.sin(a) * 11.20);
    // +X 严格指向圆台外沿径向
    corbelGroup.rotation.y = -a;

    const corbelBody = new THREE.Mesh(geoScrollCorbel, matStonePlinth);
    corbelBody.castShadow = true;
    corbelBody.receiveShadow = true;
    corbelGroup.add(corbelBody);

    const corbelTrim = new THREE.Mesh(geoScrollTrim, matChampagneGold);
    corbelGroup.add(corbelTrim);

    const scrollEye = new THREE.Mesh(geoScrollEye, matBrightGold);
    scrollEye.position.set(0.46, 0.12, 0);
    corbelGroup.add(scrollEye);

    platformGroup.add(corbelGroup);

    // 檐口切面星晶宝石与香槟金棱形嵌框
    const gemHolder = new THREE.Group();
    gemHolder.position.set(Math.cos(a) * 12.14, -0.78, Math.sin(a) * 12.14);
    gemHolder.rotation.y = -a;
    const bezel = new THREE.Mesh(geoRimGemBezel, matChampagneGold);
    gemHolder.add(bezel);
    const rimGem = new THREE.Mesh(geoRimFacetGem, i % 2 === 0 ? matStarCrystal : matBrightGold);
    rimGem.position.x = 0.06;
    gemHolder.add(rimGem);
    platformGroup.add(gemHolder);
  }

  // 前景礼仪悬空石阶（沿 +Z 边缘向下步入深渊云海）+ 左右对称雕花石护沿（Balustrade Curbs）
  for (let s = 0; s < 4; s++) {
    const w = 6.2 - s * 0.55;
    const stepY = -0.10 - s * 0.16;
    const stepZ = 10.72 + s * 0.44;
    const stepMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, 0.18, 0.52)),
      s % 2 === 0 ? matMarbleFloor : matStonePlinth
    );
    stepMesh.position.set(0, stepY, stepZ);
    stepMesh.receiveShadow = true;
    stepMesh.castShadow = true;
    platformGroup.add(stepMesh);

    // 台阶暗影退台踢面（增强石阶立体层次）
    const riser = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w - 0.14, 0.11, 0.44)),
      matWeatheredJoint
    );
    riser.position.set(0, stepY - 0.12, stepZ - 0.03);
    platformGroup.add(riser);

    const stepGold = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w + 0.08, 0.042, 0.085)),
      matChampagneGold
    );
    stepGold.position.set(0, stepY + 0.08, stepZ + 0.25);
    platformGroup.add(stepGold);
  }

  // 左右两侧雕花石护沿（沿四级石阶收窄边缘贴合顺降）
  const geoCheekWall = trackGeo(createSteppedCheekWallGeometry(THREE));
  const geoCheekCapTrim = trackGeo(new THREE.BoxGeometry(1.96, 0.048, 0.22));
  const geoCheekRelief = trackGeo(new THREE.BoxGeometry(1.42, 0.16, 0.34));
  const geoNewelBase = trackGeo(new THREE.BoxGeometry(0.46, 0.38, 0.46));
  const geoNewelCap = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 0.12, 8));

  for (const side of [-1, 1]) {
    const startX = side * 3.24;
    const startZ = 10.48;
    const endX = side * 2.40;
    const endZ = 12.34;
    const dx = endX - startX;
    const dz = endZ - startZ;
    const wallYaw = Math.atan2(-dz, dx);

    const cheekGroup = new THREE.Group();
    cheekGroup.position.set(startX, -0.02, startZ);
    cheekGroup.rotation.y = wallYaw;

    const cheekMesh = new THREE.Mesh(geoCheekWall, matMarbleArch);
    cheekMesh.castShadow = true;
    cheekMesh.receiveShadow = true;
    cheekGroup.add(cheekMesh);

    // 护沿斜顶香槟金压条
    const capTrim = new THREE.Mesh(geoCheekCapTrim, matChampagneGold);
    capTrim.position.set(0.97, -0.10, 0);
    capTrim.rotation.z = -0.265;
    cheekGroup.add(capTrim);

    // 护沿外侧浮雕石板框饰
    const reliefPanel = new THREE.Mesh(geoCheekRelief, matStonePlinth);
    reliefPanel.position.set(0.95, -0.34, 0);
    reliefPanel.rotation.z = -0.265;
    cheekGroup.add(reliefPanel);

    platformGroup.add(cheekGroup);

    // 上端与下端雕花石望柱（高度严控，绝不侵入作战区及相机主视锥）
    const topNewel = new THREE.Group();
    topNewel.position.set(startX, 0.02, startZ);
    const tnBody = new THREE.Mesh(geoNewelBase, matMarbleArch);
    tnBody.position.y = -0.04;
    const tnCap = new THREE.Mesh(geoNewelCap, matChampagneGold);
    tnCap.position.y = 0.18;
    const tnGem = new THREE.Mesh(geoOrbitalBead, matStarCrystal);
    tnGem.position.y = 0.32;
    tnGem.scale.set(1.2, 1.4, 1.2);
    topNewel.add(tnBody, tnCap, tnGem);
    platformGroup.add(topNewel);

    const botNewel = new THREE.Group();
    botNewel.position.set(endX, -0.54, endZ);
    const bnBody = new THREE.Mesh(geoNewelBase, matMarbleArch);
    const bnCap = new THREE.Mesh(geoNewelCap, matChampagneGold);
    bnCap.position.y = 0.22;
    const bnGem = new THREE.Mesh(geoOrbitalBead, matRuneGlowCyan);
    bnGem.position.y = 0.36;
    bnGem.scale.set(1.15, 1.4, 1.15);
    botNewel.add(bnBody, bnCap, bnGem);
    platformGroup.add(botNewel);
  }

  // 后方神殿高台延伸（位于 z < -10.3，托起主拱门双柱，增补阶梯线脚与金边浮雕）
  const rearDaisLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.35, 0.24, 2.86)), matStonePlinth);
  rearDaisLower.position.set(0, -0.10, -11.45);
  rearDaisLower.receiveShadow = true;
  platformGroup.add(rearDaisLower);
  const rearDais = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.8, 0.44, 2.5)), matMarbleFloor);
  rearDais.position.set(0, 0.06, -11.45);
  rearDais.receiveShadow = true;
  rearDais.castShadow = true;
  platformGroup.add(rearDais);
  const rearDaisTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.02, 0.09, 2.66)), matChampagneGold);
  rearDaisTrim.position.set(0, 0.28, -11.45);
  platformGroup.add(rearDaisTrim);
  const rearDaisLowerGold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.42, 0.055, 2.92)), matChampagneGold);
  rearDaisLowerGold.position.set(0, 0.02, -11.45);
  platformGroup.add(rearDaisLowerGold);

  // 下垂倒锥形浮空岩基（y = -1.0 至 -8.8，透视边缘清晰可见浮空神殿质感）
  const underVault = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(11.3, 9.6, 1.15, 16)),
    matStonePlinth
  );
  underVault.position.y = -1.52;
  platformGroup.add(underVault);

  const mainRockSpire = new THREE.Mesh(
    trackGeo(createFloatingRockSpireGeometry(THREE, 10.2, 7.6, 26, 10, 4.2)),
    matRockSpire
  );
  mainRockSpire.position.y = -1.65;
  platformGroup.add(mainRockSpire);

  // 周边 6 根悬挂辅助岩锥（增强浮空山体剪影层次）
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    const rad = 7.4 + (i % 2) * 1.9;
    const topR = 1.45 + (i % 3) * 0.42;
    const h = 3.2 + (i % 3) * 1.05;
    const subSpire = new THREE.Mesh(
      trackGeo(createFloatingRockSpireGeometry(THREE, topR, h, 10, 5, 11.7 + i * 3.1)),
      matRockSpire
    );
    subSpire.position.set(Math.cos(a) * rad, -1.35, Math.sin(a) * rad);
    platformGroup.add(subSpire);
  }

  // 3 道环绕倒锥岩基缓慢反旋的浮空魔力光环
  const levRingSpecs = [
    { r: 8.6, tube: 0.085, y: -2.4, speed: 0.16, mat: matRuneGlowCyan },
    { r: 5.9, tube: 0.075, y: -4.2, speed: -0.22, mat: matRuneGlowGold },
    { r: 3.1, tube: 0.065, y: -6.1, speed: 0.31, mat: matRuneGlowCyan }
  ];
  for (const lr of levRingSpecs) {
    const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(lr.r, lr.tube, 8, 48)), lr.mat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = lr.y;
    platformGroup.add(ring);
    rotatingRings.push({ mesh: ring, axis: 'z', speed: lr.speed });
  }

  // 祭坛正下方微蓝聚能光晕（映亮下方云海）
  if (rawGlow) {
    const underGlowMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x72d8ff,
        map: rawGlow,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    const underGlow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18.0, 18.0)), underGlowMat);
    underGlow.rotation.x = -Math.PI * 0.5;
    underGlow.position.y = -3.3;
    platformGroup.add(underGlow);
  }

  // =========================================================================
  // 3. 断裂古希腊/哥特神柱阵（12 根凹槽白大理石柱，外沿半径 11.3，严避前景视口）
  //    + 柱间弧形横梁拱门 + 中央破碎哥特圣冠拱门 + 柱间悬浮星晶锥体
  // =========================================================================
  const colonnadeGroup = new THREE.Group();
  colonnadeGroup.name = 'ruined_colonnade';
  group.add(colonnadeGroup);

  // 共享柱座、羽翼涡卷柱头与凹弧线脚顶板几何体
  const baseProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.80, 0.0),
    new THREE.Vector2(0.80, 0.14),
    new THREE.Vector2(0.70, 0.22),
    new THREE.Vector2(0.73, 0.34),
    new THREE.Vector2(0.58, 0.44),
    new THREE.Vector2(0.53, 0.56)
  ];
  const geoColBase = trackGeo(new THREE.LatheGeometry(baseProfile, 24));
  const geoColPlinth = trackGeo(new THREE.BoxGeometry(1.62, 0.34, 1.62));
  const geoColPlinthStep = trackGeo(new THREE.BoxGeometry(1.74, 0.12, 1.74));
  const geoColGoldCollar = trackGeo(new THREE.TorusGeometry(0.52, 0.048, 8, 24));
  geoColGoldCollar.rotateX(Math.PI * 0.5);

  const capProfile = [
    new THREE.Vector2(0.45, 0.0),
    new THREE.Vector2(0.54, 0.08),
    new THREE.Vector2(0.49, 0.16),
    new THREE.Vector2(0.55, 0.34),
    new THREE.Vector2(0.68, 0.56),
    new THREE.Vector2(0.82, 0.72),
    new THREE.Vector2(0.76, 0.78),
    new THREE.Vector2(0.0, 0.78)
  ];
  const geoColCap = trackGeo(new THREE.LatheGeometry(capProfile, 24));
  const geoColAbacus = trackGeo(createMoldedAbacusGeometry(THREE));
  const geoColVolute = trackGeo(createCapitalVoluteGeometry(THREE));
  const geoColWing = trackGeo(createWindWingReliefGeometry(THREE));
  const geoVoluteEye = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 10));
  geoVoluteEye.rotateX(Math.PI * 0.5);
  const geoColFleuron = trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 0.07, 6));
  geoColFleuron.rotateX(Math.PI * 0.5);
  const geoColFracToothA = trackGeo(createFractureToothGeometry(THREE, 0.42, 0.24, 0.20, 11));
  const geoColFracToothB = trackGeo(createFractureToothGeometry(THREE, 0.34, 0.20, 0.18, 23));

  const deg2rad = (d) => (d * Math.PI) / 180;

  // 12 根柱阵布局（左右完全对称，前景 θ ∈ [19°, 161°] 彻底留空！）
  const columnDefs = [
    // 前侧翼浪漫断柱（低矮优雅，x ≈ ±10.8, z ≈ +3.5）
    { deg: 162, r: 11.35, h: 2.8, broken: true, grand: false, hasDrum: false, tilt: 0.4 },
    { deg: 18,  r: 11.35, h: 3.2, broken: true, grand: false, hasDrum: false, tilt: 2.6 },
    // 中侧翼高耸断柱（顶部悬浮风神重力托举的残断石鼓）
    { deg: 182, r: 11.35, h: 6.1, broken: true, grand: false, hasDrum: true,  tilt: -0.6 },
    { deg: -2,  r: 11.35, h: 5.5, broken: true, grand: false, hasDrum: true,  tilt: 2.3 },
    // 后左翼完整柱廊（3 柱连拱）
    { deg: -158, r: 11.30, h: 8.1, broken: false, grand: false },
    { deg: -140, r: 11.30, h: 8.4, broken: false, grand: false },
    { deg: -122, r: 11.30, h: 8.7, broken: false, grand: false },
    // 后右翼完整柱廊（3 柱连拱）
    { deg: -22,  r: 11.30, h: 8.1, broken: false, grand: false },
    { deg: -40,  r: 11.30, h: 8.4, broken: false, grand: false },
    { deg: -58,  r: 11.30, h: 8.7, broken: false, grand: false },
    // 中央圣殿双主门柱（高大威严，托起风神圣冠拱门）
    { deg: -104, r: 11.35, h: 9.8, broken: false, grand: true },
    { deg: -76,  r: 11.35, h: 9.8, broken: false, grand: true }
  ];

  for (let i = 0; i < columnDefs.length; i++) {
    const def = columnDefs[i];
    const rad = deg2rad(def.deg);
    const cx = Math.cos(rad) * def.r;
    const cz = Math.sin(rad) * def.r;
    const scaleXZ = def.grand ? 1.18 : 1.0;

    const colObj = new THREE.Group();
    colObj.position.set(cx, 0, cz);
    colObj.rotation.y = -rad + Math.PI * 0.5;
    colonnadeGroup.add(colObj);

    // 阶梯方座 + 线脚基座 + 金项圈
    const plinthStep = new THREE.Mesh(geoColPlinthStep, matWeatheredJoint);
    plinthStep.position.y = 0.06;
    plinthStep.scale.set(scaleXZ, 1, scaleXZ);
    plinthStep.receiveShadow = true;
    colObj.add(plinthStep);

    const plinth = new THREE.Mesh(geoColPlinth, matStonePlinth);
    plinth.position.y = 0.19;
    plinth.scale.set(scaleXZ, 1, scaleXZ);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    colObj.add(plinth);

    const base = new THREE.Mesh(geoColBase, matMarbleColumn);
    base.position.y = 0.34;
    base.scale.set(scaleXZ, 1, scaleXZ);
    base.castShadow = true;
    base.receiveShadow = true;
    colObj.add(base);

    const lowCollar = new THREE.Mesh(geoColGoldCollar, matChampagneGold);
    lowCollar.position.y = 0.88;
    lowCollar.scale.set(scaleXZ, 1, scaleXZ);
    colObj.add(lowCollar);

    // 16 凹槽大理石柱身
    const shaftH = def.h - (def.broken ? 0.88 : 1.72);
    const shaftGeo = trackGeo(
      createFlutedColumnGeometry(
        THREE,
        0.5 * scaleXZ,
        0.44 * scaleXZ,
        shaftH,
        def.broken,
        def.tilt || 0,
        rng
      )
    );
    const shaft = new THREE.Mesh(shaftGeo, matMarbleColumn);
    shaft.position.y = 0.88;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    colObj.add(shaft);

    if (!def.broken) {
      // 完整神柱柱头：双金颈环 + 钟形柱头 + 四角古典涡卷 + 风神羽翼浮雕 + 凹弧线脚顶板
      const capY = 0.88 + shaftH;
      const topCollar = new THREE.Mesh(geoColGoldCollar, matChampagneGold);
      topCollar.position.y = capY - 0.04;
      topCollar.scale.set(0.92 * scaleXZ, 1, 0.92 * scaleXZ);
      colObj.add(topCollar);

      const upperNeckGold = new THREE.Mesh(geoColGoldCollar, matBrightGold);
      upperNeckGold.position.y = capY + 0.12;
      upperNeckGold.scale.set(0.98 * scaleXZ, 0.72, 0.98 * scaleXZ);
      colObj.add(upperNeckGold);

      const cap = new THREE.Mesh(geoColCap, matMarbleColumn);
      cap.position.y = capY;
      cap.scale.set(scaleXZ, 1, scaleXZ);
      cap.castShadow = true;
      colObj.add(cap);

      // 4 角古典涡卷雕花（Volutes，托举凹弧顶板四角）
      const capOrnament = new THREE.Group();
      capOrnament.position.y = capY;
      capOrnament.scale.set(scaleXZ, 1, scaleXZ);
      colObj.add(capOrnament);

      for (let vIdx = 0; vIdx < 4; vIdx++) {
        const va = (vIdx / 4) * Math.PI * 2 + Math.PI * 0.25;
        const volGroup = new THREE.Group();
        volGroup.position.set(Math.cos(va) * 0.44, 0.06, Math.sin(va) * 0.44);
        volGroup.rotation.y = -va;
        const volMesh = new THREE.Mesh(geoColVolute, matMarbleArch);
        volMesh.castShadow = true;
        volGroup.add(volMesh);
        const volEye = new THREE.Mesh(geoVoluteEye, matBrightGold);
        volEye.position.set(0.14, 0.56, 0);
        volGroup.add(volEye);
        capOrnament.add(volGroup);
      }

      // 风神羽翼对称浮雕（面向祭坛内侧 -Z 与外侧 +Z 双向展开，主门双柱加配香槟金翎脊）
      const wingScale = def.grand ? 1.18 : 0.96;
      for (const faceZ of [-1, 1]) {
        const crestGroup = new THREE.Group();
        crestGroup.position.set(0, 0.30, faceZ * 0.56);
        if (faceZ < 0) crestGroup.rotation.y = Math.PI;
        crestGroup.scale.setScalar(wingScale);

        for (const wSide of [-1, 1]) {
          const wingMesh = new THREE.Mesh(geoColWing, matMarbleColumn);
          wingMesh.scale.x = wSide;
          wingMesh.position.set(wSide * 0.06, 0, 0);
          wingMesh.rotation.y = -wSide * 0.24;
          wingMesh.castShadow = true;
          crestGroup.add(wingMesh);

          if (def.grand || faceZ < 0) {
            const wingGold = new THREE.Mesh(geoColWing, matChampagneGold);
            wingGold.scale.set(wSide * 0.72, 0.72, 1.32);
            wingGold.position.set(wSide * 0.08, 0.04, 0.01);
            wingGold.rotation.y = -wSide * 0.24;
            crestGroup.add(wingGold);
          }
        }

        // 羽翼中央菱形风神纹徽
        const emblem = new THREE.Mesh(geoOrbitalBead, def.grand ? matBrightGold : matChampagneGold);
        emblem.position.set(0, 0.08, 0.04);
        emblem.scale.set(1.25, 1.45, 0.9);
        crestGroup.add(emblem);
        capOrnament.add(crestGroup);
      }

      // 科林斯凹弧线脚顶板 + 中心花饰 + 香槟金上檐线脚
      const abacus = new THREE.Mesh(geoColAbacus, matMarbleArch);
      abacus.position.y = capY + 0.85;
      abacus.scale.set(scaleXZ, 1, scaleXZ);
      abacus.castShadow = true;
      colObj.add(abacus);

      for (let fIdx = 0; fIdx < 4; fIdx++) {
        const fa = (fIdx / 4) * Math.PI * 2;
        const fl = new THREE.Mesh(geoColFleuron, matBrightGold);
        fl.position.set(Math.cos(fa) * 0.78 * scaleXZ, capY + 0.86, Math.sin(fa) * 0.78 * scaleXZ);
        fl.rotation.y = -fa + Math.PI * 0.5;
        colObj.add(fl);
      }

      const abacusGold = new THREE.Mesh(geoColAbacus, matChampagneGold);
      abacusGold.position.y = capY + 0.97;
      abacusGold.scale.set(1.04 * scaleXZ, 0.28, 1.04 * scaleXZ);
      colObj.add(abacusGold);
    } else {
      // 断柱断口参差风化石茬（自然贴合斜断顶面）
      const breakY = 0.88 + shaftH;
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const sa = (sIdx / 4) * Math.PI * 2 + (def.tilt || 0) * 0.5;
        const tooth = new THREE.Mesh(sIdx % 2 === 0 ? geoColFracToothA : geoColFracToothB, matMarbleArch);
        tooth.position.set(Math.cos(sa) * 0.30, breakY - 0.08 + Math.cos(sa - (def.tilt || 0)) * 0.14, Math.sin(sa) * 0.30);
        tooth.rotation.set(0, -sa, Math.PI * 0.5 + (sIdx % 2 === 0 ? 0.16 : -0.14));
        tooth.scale.setScalar(0.85 + (sIdx % 2) * 0.22);
        colObj.add(tooth);
      }

      if (def.hasDrum) {
        // 悬浮在断柱上方缓慢自转微浮的碎裂石鼓与双金青星环
        const drumGroup = new THREE.Group();
        const baseY = def.h + 1.15;
        drumGroup.position.set(0, baseY, 0);
        colObj.add(drumGroup);

        const drumGeo = trackGeo(createFlutedColumnGeometry(THREE, 0.44, 0.42, 1.18, true, (def.tilt || 0) + 1.2, rng));
        const drumMesh = new THREE.Mesh(drumGeo, matMarbleColumn);
        drumMesh.position.y = -0.58;
        drumMesh.rotation.z = 0.16;
        drumMesh.castShadow = true;
        drumGroup.add(drumMesh);

        const drumHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.68, 0.032, 8, 28)), matRuneGlowCyan);
        drumHalo.rotation.x = Math.PI * 0.5 + 0.14;
        drumGroup.add(drumHalo);

        const drumGoldHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.76, 0.018, 6, 28)), matBrightGold);
        drumGoldHalo.rotation.x = Math.PI * 0.5 - 0.22;
        drumGroup.add(drumGoldHalo);

        hoveringDrums.push({
          group: drumGroup,
          baseY,
          amp: 0.24,
          speed: 0.9 + i * 0.18,
          phase: i * 1.4,
          rotSpeed: 0.24 * (i % 2 === 0 ? 1 : -1)
        });
      } else {
        // 低矮前翼断柱上方悬浮 AAA 不对称双层碎晶簇（含内发光青金核芯 + 半透折光外晶壳 + 细金星轨环）
        const shardCluster = buildStarCrystalCluster({
          hero: false,
          scale: 0.44,
          subCount: 2,
          includeOuterShell: true,
          includeGoldCollar: true,
          orbitRadius: 0.62,
          secondaryOrbitRadius: 0,
          orbitColorGold: i % 2 === 0,
          seed: 55 + i * 19
        });
        const baseY = def.h + 1.02;
        shardCluster.cluster.position.set(0, baseY, 0);
        colObj.add(shardCluster.cluster);

        floatingCrystals.push({
          group: shardCluster.cluster,
          crystal: shardCluster.spinPivot,
          ringA: shardCluster.ringA,
          ringB: null,
          baseY,
          amp: 0.20,
          speed: 1.42,
          phase: i * 2.1,
          spinSpeed: 0.68 * (i % 2 === 0 ? 1 : -1)
        });
      }
    }
  }

  // 左右翼弧形柱廊横梁（连接后翼完整三柱，带香槟金檐线与哥特尖拱肋）
  function buildWingEntablature(degStart, degEnd, yBase) {
    const a1 = deg2rad(degStart);
    const a2 = deg2rad(degEnd);
    const beamGeo = trackGeo(createCurvedBeamGeometry(THREE, 11.30, a1, a2, 1.15, 0.72, 18));
    const beam = new THREE.Mesh(beamGeo, matMarbleArch);
    beam.position.y = yBase;
    beam.castShadow = true;
    beam.receiveShadow = true;
    colonnadeGroup.add(beam);

    const trimGeo = trackGeo(createCurvedBeamGeometry(THREE, 11.30, a1, a2, 1.34, 0.12, 18));
    const trim = new THREE.Mesh(trimGeo, matChampagneGold);
    trim.position.y = yBase + 0.42;
    colonnadeGroup.add(trim);
  }

  buildWingEntablature(-161, -119, 8.78);
  buildWingEntablature(-61, -19, 8.78);

  // 柱间哥特尖拱肋条 + 拱顶梯形雕花拱心石
  const geoBayKeystone = trackGeo(createVoussoirGeometry(THREE, 0.42, 0.26, 0.56, 0.46));
  function addGothicBayArch(degA, degB, topY) {
    const r = 11.30;
    const ra = deg2rad(degA);
    const rb = deg2rad(degB);
    const rm = (ra + rb) * 0.5;
    const pA = new THREE.Vector3(Math.cos(ra) * r, topY - 1.55, Math.sin(ra) * r);
    const pB = new THREE.Vector3(Math.cos(rb) * r, topY - 1.55, Math.sin(rb) * r);
    const pApex = new THREE.Vector3(Math.cos(rm) * r, topY + 0.05, Math.sin(rm) * r);
    const pL = pA.clone().lerp(pApex, 0.55).add(new THREE.Vector3(0, 0.55, 0));
    const pR = pB.clone().lerp(pApex, 0.55).add(new THREE.Vector3(0, 0.55, 0));

    const curveL = new THREE.CatmullRomCurve3([pA, pL, pApex]);
    const curveR = new THREE.CatmullRomCurve3([pB, pR, pApex]);
    const archL = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curveL, 14, 0.14, 8, false)), matMarbleArch);
    const archR = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curveR, 14, 0.14, 8, false)), matMarbleArch);
    const goldL = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curveL, 14, 0.055, 6, false)), matChampagneGold);
    const goldR = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curveR, 14, 0.055, 6, false)), matChampagneGold);
    goldL.position.y = -0.14;
    goldR.position.y = -0.14;

    const keystone = new THREE.Mesh(geoBayKeystone, matMarbleColumn);
    keystone.position.copy(pApex);
    keystone.rotation.y = -rm + Math.PI * 0.5;
    const keyGem = new THREE.Mesh(geoOrbitalBead, matBrightGold);
    keyGem.position.set(0, -0.02, -0.24);
    keyGem.scale.set(1.3, 1.4, 0.8);
    keystone.add(keyGem);

    colonnadeGroup.add(archL, archR, goldL, goldR, keystone);
  }

  addGothicBayArch(-158, -140, 8.35);
  addGothicBayArch(-140, -122, 8.55);
  addGothicBayArch(-58, -40, 8.55);
  addGothicBayArch(-40, -22, 8.35);

  // 中央圣殿「破碎哥特星冠拱门」
  // 在圆管拱肋基础上精雕：18 枚梯度梯形楔石（Voussoirs）+ 雕花起拱托块 + 断裂处参差石茬 + 悬空碎石块
  const geoArchVoussoirA = trackGeo(createVoussoirGeometry(THREE, 0.52, 0.34, 0.86, 0.90));
  const geoArchVoussoirB = trackGeo(createVoussoirGeometry(THREE, 0.48, 0.32, 0.98, 0.98));
  const geoVoussoirGoldRib = trackGeo(createVoussoirGeometry(THREE, 0.14, 0.10, 1.02, 1.04));
  const geoArchSpringer = trackGeo(new THREE.BoxGeometry(1.18, 0.52, 1.18));
  const geoArchFracA = trackGeo(createFractureToothGeometry(THREE, 0.88, 0.36, 0.38, 101));
  const geoArchFracB = trackGeo(createFractureToothGeometry(THREE, 0.66, 0.28, 0.30, 207));
  const geoArchFracC = trackGeo(createFractureToothGeometry(THREE, 0.48, 0.22, 0.24, 313));
  const geoFloatingRubble = trackGeo(createVoussoirGeometry(THREE, 0.32, 0.22, 0.42, 0.36));

  for (const side of [-1, 1]) {
    const startX = side * 2.75;
    const baseZ = -11.01;
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, 9.75, baseZ),
      new THREE.Vector3(startX * 0.86, 11.45, baseZ),
      new THREE.Vector3(startX * 0.54, 12.95, baseZ),
      new THREE.Vector3(side * 0.72, 13.76, baseZ)
    ]);

    // 雕花起拱石座（连接大柱顶板与拱肋起势处）
    const springer = new THREE.Mesh(geoArchSpringer, matMarbleArch);
    springer.position.set(startX, 9.95, baseZ);
    springer.castShadow = true;
    colonnadeGroup.add(springer);
    const springerGold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.26, 0.10, 1.26)), matChampagneGold);
    springerGold.position.set(startX, 10.22, baseZ);
    colonnadeGroup.add(springerGold);

    // 核心石拱骨架 + 金边内拱肋 + 细冰蓝符文内槽线
    const ribMarble = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(archCurve, 24, 0.34, 10, false)),
      matMarbleArch
    );
    ribMarble.castShadow = true;
    const ribGold = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(archCurve, 24, 0.115, 8, false)),
      matBrightGold
    );
    ribGold.position.y = -0.35;
    const ribCyanVein = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(archCurve, 22, 0.048, 6, false)),
      matRuneGlowCyan
    );
    ribCyanVein.position.y = -0.44;
    colonnadeGroup.add(ribMarble, ribGold, ribCyanVein);

    // 9 枚沿拱线法向紧密扇形排布的雕花梯形楔石（Voussoirs）
    const voussoirCount = 9;
    const pt = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let v = 0; v < voussoirCount; v++) {
      const t = 0.08 + (v / (voussoirCount - 1)) * 0.83;
      archCurve.getPointAt(t, pt);
      archCurve.getTangentAt(t, tan).normalize();

      // XY 平面内指向拱外背的径向法线
      const outX = side < 0 ? -tan.y : tan.y;
      const outY = side < 0 ? tan.x : -tan.x;
      const rotZ = Math.atan2(-outX, outY);

      const isBoss = v % 2 === 1;
      const vGroup = new THREE.Group();
      vGroup.position.set(pt.x + outX * 0.06, pt.y + outY * 0.06, baseZ);
      vGroup.rotation.z = rotZ;

      const stoneBlock = new THREE.Mesh(
        isBoss ? geoArchVoussoirB : geoArchVoussoirA,
        isBoss ? matMarbleColumn : matMarbleArch
      );
      stoneBlock.castShadow = true;
      stoneBlock.receiveShadow = true;
      vGroup.add(stoneBlock);

      if (isBoss) {
        const goldBand = new THREE.Mesh(geoVoussoirGoldRib, matChampagneGold);
        vGroup.add(goldBand);
        // 正背双面雕花菱形缀饰
        for (const zDir of [-1, 1]) {
          const bossGem = new THREE.Mesh(geoOrbitalBead, v === 5 ? matRuneGlowCyan : matBrightGold);
          bossGem.position.set(0, 0.05, zDir * 0.52);
          bossGem.scale.set(1.15, 1.35, 0.65);
          vGroup.add(bossGem);
        }
      }
      colonnadeGroup.add(vGroup);
    }

    // 断裂处参差石茬与折断金筋（位于顶端 t = 0.98 断裂截面，塑造古老神殿残缺史诗张力）
    const endPt = archCurve.getPointAt(0.98);
    const endTan = archCurve.getTangentAt(0.98).normalize();
    const endOutX = side < 0 ? -endTan.y : endTan.y;
    const endOutY = side < 0 ? endTan.x : -endTan.x;
    const tanYawZ = Math.atan2(endTan.y, endTan.x);

    const fractureAnchor = new THREE.Group();
    fractureAnchor.position.set(endPt.x, endPt.y, baseZ);
    fractureAnchor.rotation.z = tanYawZ;
    colonnadeGroup.add(fractureAnchor);

    const stubSpecs = [
      { geo: geoArchFracA, y: 0.24,  z: 0.16,  rx: 0.12, rz: 0.08,  sc: 1.05, mat: matMarbleArch },
      { geo: geoArchFracB, y: -0.04, z: -0.22, rx: -0.1, rz: -0.06, sc: 0.96, mat: matMarbleColumn },
      { geo: geoArchFracC, y: -0.26, z: 0.08,  rx: 0.06, rz: -0.14, sc: 0.88, mat: matStonePlinth },
      { geo: geoArchFracB, y: 0.14,  z: -0.12, rx: 0.08, rz: 0.15,  sc: 0.78, mat: matMarbleArch },
      { geo: geoArchFracC, y: 0.32,  z: -0.18, rx: -0.1, rz: 0.22,  sc: 0.72, mat: matWeatheredJoint }
    ];
    for (const st of stubSpecs) {
      const m = new THREE.Mesh(st.geo, st.mat);
      m.position.set(-0.08, st.y, st.z);
      m.rotation.set(st.rx, 0, st.rz);
      m.scale.setScalar(st.sc);
      m.castShadow = true;
      fractureAnchor.add(m);
    }

    // 折断伸出的香槟金拱骨残筋
    const snappedGoldBar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.035, 0.062, 0.62, 6)),
      matBrightGold
    );
    snappedGoldBar.rotation.z = -Math.PI * 0.5 + 0.18;
    snappedGoldBar.position.set(0.24, -0.26, 0);
    fractureAnchor.add(snappedGoldBar);

    // 断裂缺口中受风神重力悬浮的 2 块碎裂楔石残块
    for (let dIdx = 0; dIdx < 2; dIdx++) {
      const rubble = new THREE.Group();
      const rx = endPt.x + endTan.x * (0.42 + dIdx * 0.34) + endOutX * (dIdx === 0 ? 0.22 : -0.18);
      const ry = endPt.y + endTan.y * (0.42 + dIdx * 0.34) + endOutY * (dIdx === 0 ? 0.22 : -0.18);
      rubble.position.set(rx, ry, baseZ + (dIdx === 0 ? 0.14 : -0.16));
      const rMesh = new THREE.Mesh(geoFloatingRubble, dIdx === 0 ? matMarbleColumn : matStonePlinth);
      rMesh.scale.setScalar(0.72 - dIdx * 0.18);
      rMesh.rotation.set(0.35 * side, 0.5 * dIdx, tanYawZ + 0.4 * side);
      rubble.add(rMesh);
      colonnadeGroup.add(rubble);

      hoveringDrums.push({
        group: rubble,
        baseY: ry,
        amp: 0.16 + dIdx * 0.05,
        speed: 1.25 + dIdx * 0.35,
        phase: side * 1.4 + dIdx * 2.1,
        rotSpeed: 0.38 * side * (dIdx === 0 ? 1 : -1)
      });
    }
  }

  // 圣殿拱门中心悬浮「风神星轨冠核」（AAA 双层不对称削面星晶簇 + 内发光青金核芯 + 双层细金星轨仪环）
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 12.15, -11.01);
  colonnadeGroup.add(crownGroup);

  const crownBuilt = buildStarCrystalCluster({
    hero: true,
    scale: 1.04,
    subCount: 5,
    includeOuterShell: true,
    includeGoldCollar: true,
    orbitRadius: 1.62,
    secondaryOrbitRadius: 2.16,
    orbitColorGold: true,
    seed: 101
  });
  crownGroup.add(crownBuilt.cluster);

  // 2 枚环绕主冠核微距悬游的极细星晶游离锋芒
  for (let sp = 0; sp < 2; sp++) {
    const sideDir = sp === 0 ? -1 : 1;
    const floater = new THREE.Mesh(geoCrystalSplinter, matStarCrystal);
    floater.position.set(sideDir * 0.92, sp === 0 ? 0.56 : -0.44, sideDir * 0.28);
    floater.rotation.set(0.24 * sideDir, sp * 1.6, -0.32 * sideDir);
    floater.scale.set(0.62, 0.78, 0.62);
    const floaterCore = new THREE.Mesh(geoCrystalSplinter, matCrystalCore);
    floaterCore.scale.set(0.50, 0.62, 0.50);
    floater.add(floaterCore);
    crownBuilt.spinPivot.add(floater);
  }

  if (rawGlow) {
    const crownGlowMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x92ecff,
        map: rawGlow,
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    const crownGlow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.6, 5.6)), crownGlowMat);
    crownGroup.add(crownGlow);
  }

  floatingCrystals.push({
    group: crownGroup,
    crystal: crownBuilt.spinPivot,
    ringA: crownBuilt.ringA,
    ringB: crownBuilt.ringB,
    baseY: 12.15,
    amp: 0.32,
    speed: 1.05,
    phase: 0.2,
    spinSpeed: 0.52
  });

  // 8 枚柱间悬浮 AAA 双层不对称星晶簇（主副削面棱晶 + 内发光青金核芯 + 半透折光外晶壳 + 细金星轨环饰）
  const bayAngles = [-170, -149, -131, -113, -67, -49, -31, -10];

  for (let i = 0; i < bayAngles.length; i++) {
    const a = deg2rad(bayAngles[i]);
    const r = 11.05;
    const baseY = 3.55 + (i % 3) * 0.55;
    const cg = new THREE.Group();
    cg.position.set(Math.cos(a) * r, baseY, Math.sin(a) * r);
    colonnadeGroup.add(cg);

    const bayBuilt = buildStarCrystalCluster({
      hero: false,
      scale: 0.66,
      subCount: 3,
      includeOuterShell: true,
      includeGoldCollar: true,
      orbitRadius: 0.94,
      secondaryOrbitRadius: i % 2 === 0 ? 1.18 : 0,
      orbitColorGold: i % 2 === 0,
      seed: 210 + i * 17
    });
    if (bayBuilt.ringA) {
      bayBuilt.ringA.rotation.y = a;
    }
    cg.add(bayBuilt.cluster);

    if (rawGlow) {
      const glowSpriteMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x7ce6ff,
          map: rawGlow,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      const glowCard = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2.8, 2.8)), glowSpriteMat);
      glowCard.lookAt(0, baseY, 16);
      cg.add(glowCard);
    }

    floatingCrystals.push({
      group: cg,
      crystal: bayBuilt.spinPivot,
      ringA: bayBuilt.ringA,
      ringB: bayBuilt.ringB,
      baseY,
      amp: 0.34,
      speed: 1.15 + (i % 4) * 0.16,
      phase: i * 0.85,
      spinSpeed: 0.58 * (i % 2 === 0 ? 1 : -1)
    });
  }

  // 2 座远景哥特云巅星晶尖塔（带凹槽浮雕塔身 + 4 面尖拱龛 + 飞扶壁小尖顶 + AAA 双层星晶簇）
  // 共享哥特尖拱龛框几何体（Pointed Gothic Lancet Arch Frame）
  const gothicArchFrameShape = new THREE.Shape();
  gothicArchFrameShape.moveTo(-0.42, 0.0);
  gothicArchFrameShape.lineTo(0.42, 0.0);
  gothicArchFrameShape.lineTo(0.42, 1.32);
  gothicArchFrameShape.quadraticCurveTo(0.40, 1.82, 0.0, 2.12);
  gothicArchFrameShape.quadraticCurveTo(-0.40, 1.82, -0.42, 1.32);
  gothicArchFrameShape.closePath();

  const gothicArchHole = new THREE.Path();
  gothicArchHole.moveTo(-0.26, 0.14);
  gothicArchHole.lineTo(0.26, 0.14);
  gothicArchHole.lineTo(0.26, 1.28);
  gothicArchHole.quadraticCurveTo(0.24, 1.66, 0.0, 1.88);
  gothicArchHole.quadraticCurveTo(-0.24, 1.66, -0.26, 1.28);
  gothicArchHole.closePath();
  gothicArchFrameShape.holes.push(gothicArchHole);

  const geoTowerArchFrame = trackGeo(
    new THREE.ExtrudeGeometry(gothicArchFrameShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.022,
      bevelSegments: 2,
      curveSegments: 10
    })
  );
  geoTowerArchFrame.translate(0, 0, -0.09);
  geoTowerArchFrame.computeVertexNormals();

  const geoTowerNicheBack = trackGeo(new THREE.BoxGeometry(0.56, 1.84, 0.08));
  const geoTowerButtressLower = trackGeo(new THREE.BoxGeometry(0.42, 2.25, 0.56));
  const geoTowerButtressUpper = trackGeo(new THREE.BoxGeometry(0.30, 1.35, 0.40));
  const geoTowerPinnacle = trackGeo(new THREE.ConeGeometry(0.20, 0.96, 4));
  const geoTowerMerlon = trackGeo(new THREE.BoxGeometry(0.28, 0.34, 0.22));
  const geoTowerChainA = trackGeo(createHangingChainGeometry(THREE, 9, 0.32, 3.3));
  const geoTowerChainB = trackGeo(createHangingChainGeometry(THREE, 7, -0.24, 8.1));

  const spireTowerPositions = [
    { x: -14.8, y: 1.6, z: -15.2, scale: 1.08, phase: 0.6 },
    { x: 14.8,  y: 1.9, z: -15.2, scale: 1.02, phase: 2.4 }
  ];
  for (let tIdx = 0; tIdx < spireTowerPositions.length; tIdx++) {
    const tp = spireTowerPositions[tIdx];
    const tower = new THREE.Group();
    tower.position.set(tp.x, tp.y, tp.z);
    tower.scale.setScalar(tp.scale);
    group.add(tower);

    // 浮空底座岩岛 + 底部锥刺削面岩层 + 垂挂冰晶棱柱 + 悬垂断链
    const isletRock = new THREE.Mesh(
      trackGeo(createFloatingRockSpireGeometry(THREE, 2.62, 4.8, 12, 6, tp.phase * 5.0)),
      matRockSpire
    );
    tower.add(isletRock);

    const isletSpikes = new THREE.Mesh(
      trackGeo(createSpikedRockClusterGeometry(THREE, 2.15, 3.6, 5, 41 + tIdx * 17)),
      matRockSpire
    );
    isletSpikes.position.y = -1.6;
    tower.add(isletSpikes);

    for (let ic = 0; ic < 3; ic++) {
      const ia = (ic / 3) * Math.PI * 2 + tIdx * 0.9;
      const hangIce = new THREE.Mesh(geoCrystalSide5, matStarCrystal);
      hangIce.position.set(Math.cos(ia) * 1.45, -1.45 - ic * 0.22, Math.sin(ia) * 1.45);
      hangIce.rotation.set(Math.PI + 0.16 * Math.sin(ia), ia, -0.16 * Math.cos(ia));
      hangIce.scale.set(0.62, 0.95 + ic * 0.18, 0.62);
      tower.add(hangIce);
    }

    for (let ch = 0; ch < 2; ch++) {
      const ca = (ch === 0 ? -0.6 : 2.2) + tIdx * 0.7;
      const chainMesh = new THREE.Mesh(ch === 0 ? geoTowerChainA : geoTowerChainB, matAncientChain);
      chainMesh.position.set(Math.cos(ca) * 2.15, -0.45, Math.sin(ca) * 2.15);
      tower.add(chainMesh);
      swayingChains.push({
        mesh: chainMesh,
        baseRotZ: 0,
        amp: 0.08 + ch * 0.03,
        speed: 1.15 + ch * 0.3,
        phase: tp.phase + ch * 1.9
      });
    }

    // 阶梯八角哥特塔座与金檐圈
    const isletCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.55, 2.72, 0.36, 8)), matMarbleArch);
    isletCap.position.y = 0.18;
    tower.add(isletCap);
    const isletCapGold = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.56, 0.065, 8, 8)), matChampagneGold);
    isletCapGold.rotation.x = Math.PI * 0.5;
    isletCapGold.rotation.z = Math.PI / 8;
    isletCapGold.position.y = 0.36;
    tower.add(isletCapGold);

    const towerBasePedestal = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.48, 1.72, 0.56, 8)), matStonePlinth);
    towerBasePedestal.position.y = 0.62;
    tower.add(towerBasePedestal);

    // 哥特凹槽浮雕主塔身（16 凹槽大理石柱身 + 双道金腰线）
    const flutedShaft = new THREE.Mesh(
      trackGeo(createFlutedColumnGeometry(THREE, 1.12, 0.92, 3.15, false, 0, rng)),
      matMarbleColumn
    );
    flutedShaft.position.y = 0.86;
    tower.add(flutedShaft);

    const beltMid = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.08, 0.055, 8, 24)), matChampagneGold);
    beltMid.rotation.x = Math.PI * 0.5;
    beltMid.position.y = 2.48;
    tower.add(beltMid);

    // 4 面哥特尖拱龛（带深蓝石龛背、尖拱框饰与龛内发光星晶圣物）
    for (let nIdx = 0; nIdx < 4; nIdx++) {
      const na = (nIdx / 4) * Math.PI * 2;
      const nicheGroup = new THREE.Group();
      nicheGroup.position.set(Math.cos(na) * 1.02, 1.04, Math.sin(na) * 1.02);
      nicheGroup.rotation.y = -na + Math.PI * 0.5;

      const backPlate = new THREE.Mesh(geoTowerNicheBack, matNicheRecess);
      backPlate.position.set(0, 0.96, -0.04);
      nicheGroup.add(backPlate);

      const archFrame = new THREE.Mesh(geoTowerArchFrame, matMarbleArch);
      nicheGroup.add(archFrame);

      const archGoldTip = new THREE.Mesh(geoOrbitalBead, matBrightGold);
      archGoldTip.position.set(0, 2.22, 0.04);
      archGoldTip.scale.set(1.2, 1.5, 0.9);
      nicheGroup.add(archGoldTip);

      // 尖拱龛内微型发光星晶
      const nicheRelic = new THREE.Mesh(geoCrystalSplinter, matStarCrystal);
      nicheRelic.position.set(0, 0.96, 0.06);
      nicheRelic.scale.set(0.62, 0.74, 0.62);
      nicheGroup.add(nicheRelic);

      tower.add(nicheGroup);
    }

    // 4 角哥特飞扶壁柱墩与尖顶小尖塔（Pinnacles）
    for (let bIdx = 0; bIdx < 4; bIdx++) {
      const ba = (bIdx / 4) * Math.PI * 2 + Math.PI * 0.25;
      const buttGroup = new THREE.Group();
      buttGroup.position.set(Math.cos(ba) * 1.24, 0.86, Math.sin(ba) * 1.24);
      buttGroup.rotation.y = -ba + Math.PI * 0.5;

      const bLow = new THREE.Mesh(geoTowerButtressLower, matStonePlinth);
      bLow.position.y = 1.12;
      buttGroup.add(bLow);

      const bUp = new THREE.Mesh(geoTowerButtressUpper, matMarbleArch);
      bUp.position.set(0, 2.86, -0.08);
      buttGroup.add(bUp);

      const bPin = new THREE.Mesh(geoTowerPinnacle, matMarbleColumn);
      bPin.position.set(0, 4.02, -0.08);
      buttGroup.add(bPin);

      const bFinial = new THREE.Mesh(geoOrbitalBead, matBrightGold);
      bFinial.position.set(0, 4.56, -0.08);
      bFinial.scale.set(1.0, 1.4, 1.0);
      buttGroup.add(bFinial);

      tower.add(buttGroup);
    }

    // 塔顶哥特花冠挑檐平台 + 8 枚矮堞花冠
    const towerCrownDeck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.36, 1.10, 0.36, 8)), matMarbleArch);
    towerCrownDeck.position.y = 4.10;
    tower.add(towerCrownDeck);

    const segGold = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.36, 0.072, 8, 24)), matBrightGold);
    segGold.rotation.x = Math.PI * 0.5;
    segGold.position.y = 4.28;
    tower.add(segGold);

    for (let mIdx = 0; mIdx < 8; mIdx++) {
      const ma = (mIdx / 8) * Math.PI * 2;
      const merlon = new THREE.Mesh(geoTowerMerlon, matMarbleColumn);
      merlon.position.set(Math.cos(ma) * 1.24, 4.44, Math.sin(ma) * 1.24);
      merlon.rotation.y = -ma + Math.PI * 0.5;
      tower.add(merlon);
    }

    // 塔顶悬浮 AAA 双层不对称星晶簇 + 双层细金/苍青星轨仪环
    const spireBuilt = buildStarCrystalCluster({
      hero: true,
      scale: 1.10,
      subCount: 4,
      includeOuterShell: true,
      includeGoldCollar: true,
      orbitRadius: 1.82,
      secondaryOrbitRadius: 2.28,
      orbitColorGold: false,
      seed: 310 + tIdx * 37
    });
    spireBuilt.cluster.position.y = 6.55;
    tower.add(spireBuilt.cluster);

    floatingCrystals.push({
      group: tower,
      crystal: spireBuilt.spinPivot,
      ringA: spireBuilt.ringA,
      ringB: spireBuilt.ringB,
      baseY: tp.y,
      amp: 0.42,
      speed: 0.72,
      phase: tp.phase,
      spinSpeed: 0.42
    });
  }

  // =========================================================================
  // 4. 深渊外围浮空巨石群与符文小岛（18 块，radius 14.8 ~ 26.2，缓慢上下浮动与公转）
  // =========================================================================
  const islandsGroup = new THREE.Group();
  islandsGroup.name = 'floating_rune_monoliths';
  group.add(islandsGroup);

  // 共享几何体：多面雕刻方尖碑、底部锥刺岩层簇、风神遗迹残柱/石鼓与悬垂断链
  const geoCarvedObelisk = trackGeo(createCarvedObeliskGeometry(THREE));
  const geoObeliskCollar = trackGeo(new THREE.TorusGeometry(0.84, 0.048, 6, 8));
  geoObeliskCollar.rotateX(Math.PI * 0.5);
  geoObeliskCollar.rotateY(Math.PI / 8);
  const geoObeliskRuneStrip = trackGeo(new THREE.BoxGeometry(0.085, 2.25, 0.045));
  const geoObeliskGoldCap = trackGeo(new THREE.ConeGeometry(0.45, 0.62, 4));
  geoObeliskGoldCap.rotateY(Math.PI * 0.25);

  const geoSpikedUnderA = trackGeo(createSpikedRockClusterGeometry(THREE, 1.85, 3.1, 5, 51.3));
  const geoSpikedUnderB = trackGeo(createSpikedRockClusterGeometry(THREE, 1.45, 2.75, 4, 83.7));
  const geoSpikedUnderC = trackGeo(createSpikedRockClusterGeometry(THREE, 1.15, 2.45, 4, 117.1));

  const geoChainShort = trackGeo(createHangingChainGeometry(THREE, 6, 0.22, 1.7));
  const geoChainMed = trackGeo(createHangingChainGeometry(THREE, 8, -0.28, 4.9));
  const geoChainLong = trackGeo(createHangingChainGeometry(THREE, 10, 0.34, 9.2));

  const geoIsletCap = trackGeo(new THREE.CylinderGeometry(1.94, 2.08, 0.30, 8));
  const geoIsletCapGold = trackGeo(new THREE.TorusGeometry(1.96, 0.052, 6, 8));
  geoIsletCapGold.rotateX(Math.PI * 0.5);
  geoIsletCapGold.rotateZ(Math.PI / 8);
  const geoMiniPlinth = trackGeo(new THREE.BoxGeometry(0.84, 0.24, 0.84));
  const geoFallenDrum = trackGeo(createFlutedColumnGeometry(THREE, 0.27, 0.26, 0.94, true, 1.15, rng));
  const geoRuinArchStub = trackGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.55, 0.0, 0),
        new THREE.Vector3(-0.42, 0.72, 0),
        new THREE.Vector3(-0.08, 1.14, 0)
      ]),
      10,
      0.13,
      7,
      false
    )
  );

  // 辅助：在浮空岩块底部挂载垂挂冰晶棱柱与飘摆古遗迹断链
  function attachUnderIceAndChains(parent, radius, baseY, iceCount, chainCount, seedIdx) {
    for (let ic = 0; ic < iceCount; ic++) {
      const ia = (ic / Math.max(1, iceCount)) * Math.PI * 2 + seedIdx * 0.77;
      const dist = radius * (0.45 + (ic % 2) * 0.28);
      const hangGeo = ic % 2 === 0 ? geoCrystalSide5 : geoCrystalSplinter;
      const icePivot = new THREE.Group();
      icePivot.position.set(Math.cos(ia) * dist, baseY - 0.15 - (ic % 3) * 0.18, Math.sin(ia) * dist);
      icePivot.rotation.set(Math.PI + 0.18 * Math.sin(ia), ia, -0.18 * Math.cos(ia));

      const iceLen = 0.72 + (ic % 3) * 0.24;
      const iceBody = new THREE.Mesh(hangGeo, matStarCrystal);
      iceBody.scale.set(0.62, iceLen, 0.62);
      icePivot.add(iceBody);

      const iceCore = new THREE.Mesh(hangGeo, matCrystalCore);
      iceCore.scale.set(0.32, iceLen * 0.62, 0.32);
      icePivot.add(iceCore);

      parent.add(icePivot);
    }

    const chainPool = [geoChainShort, geoChainMed, geoChainLong];
    for (let ch = 0; ch < chainCount; ch++) {
      const ca = (ch / Math.max(1, chainCount)) * Math.PI * 2 + seedIdx * 1.15 + 0.4;
      const chainGeo = chainPool[(seedIdx + ch) % chainPool.length];
      const chainMesh = new THREE.Mesh(chainGeo, matAncientChain);
      chainMesh.position.set(Math.cos(ca) * radius * 0.86, baseY + 0.22, Math.sin(ca) * radius * 0.86);
      chainMesh.rotation.y = ca;
      parent.add(chainMesh);

      swayingChains.push({
        mesh: chainMesh,
        baseRotZ: 0,
        amp: 0.085 + (ch % 2) * 0.04,
        speed: 1.05 + ((seedIdx + ch) % 4) * 0.22,
        phase: seedIdx * 0.9 + ch * 2.1
      });
    }
  }

  // 精选 18 组角度与半径（广角全景环绕后方与左右两侧，前侧低洼处仅 2 块深渊碎岩不遮镜头）
  const islandBlueprints = [
    // 后方远景浮空岛礁与巨石阵
    { deg: -172, r: 17.5, y: 1.2,  type: 'islet',    s: 1.15 },
    { deg: -158, r: 22.8, y: 4.8,  type: 'monolith', s: 1.22 },
    { deg: -144, r: 18.2, y: 2.6,  type: 'cluster',  s: 1.05 },
    { deg: -130, r: 24.5, y: 6.4,  type: 'islet',    s: 1.32 },
    { deg: -116, r: 19.6, y: 3.9,  type: 'monolith', s: 1.18 },
    { deg: -102, r: 25.8, y: 7.8,  type: 'monolith', s: 1.35 },
    { deg: -88,  r: 23.4, y: -0.6, type: 'islet',    s: 1.28 },
    { deg: -74,  r: 25.2, y: 7.2,  type: 'monolith', s: 1.25 },
    { deg: -60,  r: 19.4, y: 4.3,  type: 'cluster',  s: 1.12 },
    { deg: -46,  r: 24.2, y: 6.1,  type: 'islet',    s: 1.30 },
    { deg: -32,  r: 18.4, y: 2.4,  type: 'monolith', s: 1.16 },
    { deg: -18,  r: 22.4, y: 5.2,  type: 'cluster',  s: 1.08 },
    { deg: -6,   r: 17.2, y: 1.5,  type: 'islet',    s: 1.14 },
    // 中远侧翼高空飘石
    { deg: 170,  r: 16.4, y: -0.8, type: 'monolith', s: 0.95 },
    { deg: 10,   r: 16.8, y: -0.5, type: 'monolith', s: 0.98 },
    { deg: 156,  r: 21.0, y: 3.6,  type: 'cluster',  s: 0.92 },
    // 远角深渊低位浮石（位于 y < -2.4，仅增深渊空间感，永不挡视野）
    { deg: 146,  r: 16.5, y: -2.6, type: 'islet',    s: 0.85 },
    { deg: 34,   r: 16.8, y: -2.7, type: 'monolith', s: 0.88 }
  ];

  for (let i = 0; i < islandBlueprints.length; i++) {
    const bp = islandBlueprints[i];
    const baseAngle = deg2rad(bp.deg);
    const holder = new THREE.Group();
    holder.position.set(Math.cos(baseAngle) * bp.r, bp.y, Math.sin(baseAngle) * bp.r);
    holder.scale.setScalar(bp.s);
    islandsGroup.add(holder);

    if (bp.type === 'islet') {
      // 浮空遗迹小岛：倒锥岩基 + 底部锥刺削面岩层 + 垂挂冰晶棱柱 + 飘摆断链 + 风神残柱/残拱 + 双层星晶簇
      const rock = new THREE.Mesh(
        trackGeo(createFloatingRockSpireGeometry(THREE, 1.95, 3.25, 10, 5, 30 + i * 2.7)),
        matRockSpire
      );
      holder.add(rock);

      const underSpikes = new THREE.Mesh(i % 2 === 0 ? geoSpikedUnderA : geoSpikedUnderB, matRockSpire);
      underSpikes.position.y = -1.15;
      underSpikes.rotation.y = i * 1.1;
      holder.add(underSpikes);

      attachUnderIceAndChains(holder, 1.55, -0.78, 3, i % 2 === 0 ? 2 : 1, i);

      const cap = new THREE.Mesh(geoIsletCap, matMarbleArch);
      cap.position.y = 0.15;
      holder.add(cap);
      const capGold = new THREE.Mesh(geoIsletCapGold, matChampagneGold);
      capGold.position.y = 0.30;
      holder.add(capGold);

      // 风神遗迹残柱 + 方座 + 倾倒残石鼓 / 断拱残臂
      const ruinPlinth = new THREE.Mesh(geoMiniPlinth, matStonePlinth);
      ruinPlinth.position.set(-0.56, 0.42, 0.24);
      holder.add(ruinPlinth);

      const miniPillar = new THREE.Mesh(
        trackGeo(createFlutedColumnGeometry(THREE, 0.30, 0.27, 1.85 + (i % 3) * 0.32, true, i * 0.9, rng)),
        matMarbleColumn
      );
      miniPillar.position.set(-0.56, 0.54, 0.24);
      holder.add(miniPillar);

      if (i % 2 === 0) {
        // 倾倒斜卧的凹槽石鼓
        const fallenDrum = new THREE.Mesh(geoFallenDrum, matMarbleArch);
        fallenDrum.position.set(-0.08, 0.54, 0.82);
        fallenDrum.rotation.set(Math.PI * 0.44, i * 0.7, 0.42);
        holder.add(fallenDrum);
      } else {
        // 残缺风神小石拱残臂
        const archStub = new THREE.Mesh(geoRuinArchStub, matMarbleArch);
        archStub.position.set(-0.02, 1.62, 0.24);
        archStub.rotation.y = 0.35;
        holder.add(archStub);
      }

      // 岛上雕琢双层星晶簇
      const isletCrystal = buildStarCrystalCluster({
        hero: false,
        scale: 0.48,
        subCount: 2,
        includeOuterShell: true,
        includeGoldCollar: false,
        orbitRadius: 0.68,
        secondaryOrbitRadius: 0,
        orbitColorGold: i % 2 === 0,
        seed: 410 + i * 19
      });
      isletCrystal.cluster.position.set(0.62, 1.18, -0.26);
      holder.add(isletCrystal.cluster);
    } else if (bp.type === 'monolith') {
      // 多面雕刻浮空方尖碑：底部锥刺岩基 + 垂挂冰晶与断链 + 削角八面雕刻碑身 + 竖向发光符文槽 + 金顶锥 + 尖顶微晶信标
      const stoneGroup = new THREE.Group();
      stoneGroup.rotation.set((rng() - 0.5) * 0.14, rng() * Math.PI, (rng() - 0.5) * 0.14);
      holder.add(stoneGroup);

      const obeliskRock = new THREE.Mesh(geoSpikedUnderC, matRockSpire);
      obeliskRock.position.y = -1.62;
      obeliskRock.rotation.y = i * 0.8;
      stoneGroup.add(obeliskRock);

      attachUnderIceAndChains(stoneGroup, 0.92, -1.55, 2, 1, i + 30);

      const obeliskBody = new THREE.Mesh(geoCarvedObelisk, matMonolithStone);
      stoneGroup.add(obeliskBody);

      // 4 面竖向发光青/金符文槽嵌条
      const primaryRuneMat = i % 2 === 0 ? matRuneGlowCyan : matRuneGlowGold;
      const secondaryRuneMat = i % 2 === 0 ? matRuneGlowGold : matRuneGlowCyan;
      for (let f = 0; f < 4; f++) {
        const fa = (f / 4) * Math.PI * 2;
        const runeStrip = new THREE.Mesh(geoObeliskRuneStrip, f % 2 === 0 ? primaryRuneMat : secondaryRuneMat);
        runeStrip.position.set(Math.cos(fa) * 0.67, 0.12, Math.sin(fa) * 0.67);
        runeStrip.rotation.y = -fa + Math.PI * 0.5;
        stoneGroup.add(runeStrip);
      }

      // 上下双道八角削角金青符文箍
      const band1 = new THREE.Mesh(geoObeliskCollar, primaryRuneMat);
      band1.position.y = 0.25;
      band1.scale.setScalar(0.95);
      stoneGroup.add(band1);
      const band2 = new THREE.Mesh(geoObeliskCollar, secondaryRuneMat);
      band2.position.y = -1.28;
      band2.scale.setScalar(1.14);
      stoneGroup.add(band2);
      const bandGold = new THREE.Mesh(geoObeliskCollar, matChampagneGold);
      bandGold.position.y = 1.62;
      bandGold.scale.setScalar(0.80);
      stoneGroup.add(bandGold);

      // 方尖碑金字塔冠顶 + 悬空微型星晶信标
      const capGold = new THREE.Mesh(geoObeliskGoldCap, matBrightGold);
      capGold.position.y = 2.24;
      stoneGroup.add(capGold);

      const beaconCrystal = new THREE.Mesh(geoCrystalSplinter, matStarCrystal);
      beaconCrystal.position.y = 3.05;
      beaconCrystal.scale.set(0.68, 0.85, 0.68);
      const beaconCore = new THREE.Mesh(geoCrystalSplinter, matCrystalCore);
      beaconCore.scale.set(0.45, 0.62, 0.45);
      beaconCrystal.add(beaconCore);
      stoneGroup.add(beaconCrystal);
    } else {
      // 浮空锥刺星晶岩簇：多层硬削面悬崖岩块 + 锥刺底岩 + 垂挂冰晶棱柱 + 遗迹残柱与断链 + AAA 双层星晶簇
      const crag = new THREE.Mesh(
        trackGeo(new THREE.DodecahedronGeometry(1.32, 0)),
        matMonolithStone
      );
      crag.scale.set(1.18, 0.72, 1.04);
      holder.add(crag);

      const cragSpikes = new THREE.Mesh(geoSpikedUnderB, matRockSpire);
      cragSpikes.position.y = -0.35;
      cragSpikes.rotation.y = i * 1.3;
      holder.add(cragSpikes);

      attachUnderIceAndChains(holder, 1.25, -0.52, 3, 2, i + 60);

      // 岩块侧缘嵌生一段倾折的风神遗迹凹槽断柱
      const jutPillar = new THREE.Mesh(geoFallenDrum, matMarbleColumn);
      jutPillar.position.set(-0.92, 0.35, 0.48);
      jutPillar.rotation.set(0.28, i * 0.6, 0.44);
      holder.add(jutPillar);

      // 顶部 AAA 多面体双层不对称星晶簇
      const cragCluster = buildStarCrystalCluster({
        hero: false,
        scale: 0.64,
        subCount: 4,
        includeOuterShell: true,
        includeGoldCollar: true,
        orbitRadius: 0.94,
        secondaryOrbitRadius: 0,
        orbitColorGold: i % 2 === 1,
        seed: 610 + i * 29
      });
      cragCluster.cluster.position.set(0.18, 1.22, -0.06);
      holder.add(cragCluster.cluster);
    }

    floatingIslands.push({
      group: holder,
      radius: bp.r,
      baseAngle,
      baseY: bp.y,
      bobAmp: 0.32 + rng() * 0.38,
      bobSpeed: 0.52 + rng() * 0.45,
      phase: rng() * Math.PI * 2,
      // 极轻柔的缓慢公转（幅度受控，确保不飘入前景）
      orbitAmp: 0.065 + rng() * 0.05,
      orbitSpeed: 0.12 + rng() * 0.08,
      tiltSpeed: 0.35 + rng() * 0.25
    });
  }

  // =========================================================================
  // 5. 自定义 GLSL 多层流动高空云海（y = -3.8 上层流云 + y = -6.2 深层云洋 + 远景日照云峰）
  // =========================================================================
  const cloudLayers = [];
  function createCloudSeaLayer({ y, size, segs, speed, scale, opacity, clearCenter, layerTint }) {
    const uniforms = {
      uTime: { value: 0 },
      uCloudTex: { value: cloudSampleTex },
      uHasCloudTex: { value: rawCloud ? 1.0 : 0.0 },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uOpacity: { value: opacity },
      uClearCenter: { value: clearCenter },
      uSunDir: { value: sunDir.clone() },
      uFogColor: { value: new THREE.Color(0xd9e8f9) },
      uLayerTint: { value: new THREE.Color(layerTint) },
      uStormLevel: { value: 0.0 }
    };
    shaderUniforms.push(uniforms);
    cloudLayers.push({ uniforms, baseSpeed: speed, baseTint: new THREE.Color(layerTint) });

    const mat = trackMat(
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uSpeed;
          varying vec2 vWorldXZ;
          varying float vDist;
          void main() {
            vec3 pos = position;
            vec4 wp = modelMatrix * vec4(pos, 1.0);
            // 轻柔的云浪起伏
            float wave = sin(wp.x * 0.09 + uTime * 0.35) * cos(wp.z * 0.08 - uTime * 0.28) * 0.48;
            wp.y += wave;
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
          uniform vec3 uFogColor;
          uniform vec3 uLayerTint;
          uniform float uStormLevel;
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
            float proc = vnoise(uv * 5.0) * 0.65 + vnoise(uv * 11.0) * 0.35;
            float texV = texture2D(uCloudTex, uv).r;
            return mix(proc, texV, uHasCloudTex);
          }

          float fbmCloud(vec2 p, float t) {
            vec2 drift1 = vec2(t * 0.85, -t * 0.42);
            vec2 drift2 = vec2(-t * 0.55, -t * 0.68);
            float n1 = sampleCloud(p + drift1);
            vec2 warp = vec2(n1 - 0.5, sampleCloud(p * 1.45 - drift2) - 0.5) * 0.16;
            float n2 = sampleCloud(p * 1.92 + drift2 + warp);
            float n3 = sampleCloud(p * 3.65 + drift1 * 1.6);
            return n1 * 0.52 + n2 * 0.33 + n3 * 0.15;
          }

          void main() {
            float t = uTime * uSpeed;
            // 在神殿下方加入风眼涡旋扭转（风暴眼 P2 强化涡旋感）
            float angle = atan(vWorldXZ.y, vWorldXZ.x);
            float swirl = exp(-vDist * 0.065) * (0.45 + uStormLevel * 0.62);
            float cs = cos(swirl);
            float sn = sin(swirl);
            vec2 swirledXZ = mat2(cs, -sn, sn, cs) * vWorldXZ;
            vec2 uv = swirledXZ * uScale;

            float d0 = fbmCloud(uv, t);
            // 朝向太阳方向做 UV 有限差分估算云峰亮面（日光边缘散射）
            vec2 sunStep = normalize(uSunDir.xz) * 0.032;
            float dSun = fbmCloud(uv + sunStep, t);
            float slopeLit = clamp((d0 - dSun) * 3.6 + 0.52, 0.0, 1.0);

            // 云海密度塑形
            float cloudDensity = smoothstep(0.32, 0.78, d0);
            float crest = smoothstep(0.58, 0.88, d0);

            // 色彩：苍穹天青云谷 → 晶莹雪白云身 → 香槟金/青金风暴受光云脊
            vec3 shadowCol = mix(vec3(0.46, 0.68, 0.90), vec3(0.24, 0.58, 0.86), uStormLevel) * uLayerTint;
            vec3 bodyCol   = mix(vec3(0.95, 0.98, 1.00), vec3(0.84, 0.97, 1.00), uStormLevel);
            vec3 goldRim   = mix(vec3(1.00, 0.88, 0.66), vec3(0.76, 0.96, 1.00), uStormLevel * 0.45);

            vec3 col = mix(shadowCol, bodyCol, smoothstep(0.18, 0.76, cloudDensity * 0.75 + slopeLit * 0.35));
            // 面向后方太阳方向的强金光散射
            float towardSun = smoothstep(-0.35, 0.95, dot(normalize(vWorldXZ + vec2(0.0001)), normalize(uSunDir.xz)));
            float rimScatter = crest * (0.45 + 0.55 * towardSun) + pow(slopeLit, 2.2) * 0.38;
            col = mix(col, goldRim, clamp(rimScatter * 0.72, 0.0, 0.82));

            // 风暴眼云海深处隐现青金电芒反射
            if (uStormLevel > 0.01) {
              float stormFlash = pow(crest, 2.0) * (0.5 + 0.5 * sin(angle * 5.0 - uTime * 3.6 + vDist * 0.18));
              col += vec3(0.28, 0.85, 1.0) * stormFlash * uStormLevel * 0.28;
            }

            // 祭坛下方风眼透视微淡（仅上层开启，让双层云海呈现强烈立体视差）
            float eyeMask = mix(1.0, smoothstep(5.5, 16.5, vDist) * 0.62 + 0.38, uClearCenter);

            // 远端地平线雾融与软消融，绝无硬矩形边界
            float outerFade = 1.0 - smoothstep(46.0, 86.0, vDist);
            float fogMix = smoothstep(26.0, 74.0, vDist);
            col = mix(col, uFogColor, fogMix * 0.78);

            float alpha = cloudDensity * uOpacity * eyeMask * outerFade;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `
      })
    );

    const geo = trackGeo(new THREE.PlaneGeometry(size, size, segs, segs));
    geo.rotateX(-Math.PI * 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.renderOrder = -2;
    return mesh;
  }

  const cloudUpper = createCloudSeaLayer({
    y: -3.8,
    size: 184,
    segs: 52,
    speed: 0.024,
    scale: 0.028,
    opacity: 0.82,
    clearCenter: 1.0,
    layerTint: 0xffffff
  });
  const cloudLower = createCloudSeaLayer({
    y: -6.2,
    size: 218,
    segs: 44,
    speed: 0.012,
    scale: 0.019,
    opacity: 0.96,
    clearCenter: 0.0,
    layerTint: 0xdcecff
  });
  group.add(cloudLower, cloudUpper);

  // 远景多层立体堆积云峰与连续波浪云脊（彻底告别直立纸片平面，采用 3D 球簇与柔和菲涅耳散射体积着色）
  const volCloudLayers = [];
  function createVolumetricCloudMat(opacity, heightScale, speed) {
    const uniforms = {
      uTime: { value: 0 },
      uCloudTex: { value: cloudSampleTex },
      uHasCloudTex: { value: rawCloud ? 1.0 : 0.0 },
      uSunDir: { value: sunDir.clone() },
      uFogColor: { value: new THREE.Color(0xd9e8f9) },
      uOpacity: { value: opacity },
      uHeightScale: { value: heightScale },
      uSpeed: { value: speed },
      uStormLevel: { value: 0.0 }
    };
    shaderUniforms.push(uniforms);
    volCloudLayers.push({ uniforms, baseSpeed: speed });

    return trackMat(
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uSpeed;
          uniform float uHeightScale;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          varying float vHeightNorm;
          void main() {
            vec4 baseWp = modelMatrix * vec4(position, 1.0);
            float billow = sin(baseWp.x * 0.13 + uTime * 0.42 * uSpeed + baseWp.z * 0.11) *
                           cos(baseWp.z * 0.12 - uTime * 0.31 * uSpeed) * 0.14;
            vec3 displaced = position + normal * billow;
            vec4 wp = modelMatrix * vec4(displaced, 1.0);
            vWorldPos = wp.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - wp.xyz);
            vHeightNorm = clamp(position.y / max(uHeightScale, 0.2) * 0.52 + 0.48, 0.0, 1.0);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform sampler2D uCloudTex;
          uniform float uHasCloudTex;
          uniform vec3 uSunDir;
          uniform vec3 uFogColor;
          uniform float uOpacity;
          uniform float uSpeed;
          uniform float uStormLevel;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          varying float vHeightNorm;

          float hashC(vec2 p) {
            p = fract(p * vec2(127.1, 311.7));
            p += dot(p, p + 34.5);
            return fract(p.x * p.y);
          }

          float noiseC(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hashC(i), hashC(i + vec2(1.0, 0.0)), f.x),
              mix(hashC(i + vec2(0.0, 1.0)), hashC(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          void main() {
            vec3 N = normalize(vWorldNormal);
            vec3 V = normalize(vViewDir);
            vec3 L = normalize(uSunDir);

            // 3D 菲涅耳边缘柔化羽化（从任意视角均消除球体硬轮廓与纸片边界感）
            float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
            float softEdge = smoothstep(0.08, 0.74, ndotv);

            // 世界空间云絮流动噪波调制
            vec2 cUv = vWorldPos.xz * 0.026 + vec2(uTime * 0.012 * uSpeed, vWorldPos.y * 0.032);
            float procN = noiseC(cUv * 6.0) * 0.65 + noiseC(cUv * 12.5 - vec2(uTime * 0.015, 0.0)) * 0.35;
            float texN = texture2D(uCloudTex, cUv).r;
            float wisp = mix(procN, texN, uHasCloudTex);

            float hGrad = clamp(vHeightNorm, 0.0, 1.0);
            float baseFade = smoothstep(0.02, 0.30, hGrad);
            float alpha = softEdge * baseFade * (0.68 + 0.42 * wisp) * uOpacity;

            // 日照立体受光：苍青云腹 → 雪白云体 → 香槟金/青金风暴云冠
            float ndotl = dot(N, L) * 0.5 + 0.5;
            float forwardScatter = pow(max(dot(-V, L), 0.0), 3.2);
            vec3 colBelly = mix(vec3(0.56, 0.74, 0.93), vec3(0.30, 0.60, 0.88), uStormLevel);
            vec3 colBody  = mix(vec3(0.95, 0.98, 1.00), vec3(0.84, 0.96, 1.00), uStormLevel);
            vec3 colGold  = mix(vec3(1.00, 0.90, 0.70), vec3(0.74, 0.95, 1.00), uStormLevel * 0.42);

            vec3 col = mix(colBelly, colBody, smoothstep(0.14, 0.76, hGrad * 0.62 + ndotl * 0.48));
            float rimLit = clamp((hGrad * 0.58 + forwardScatter * 0.55) * ndotl + (1.0 - ndotv) * 0.25 * hGrad, 0.0, 0.80);
            col = mix(col, colGold, rimLit * 0.74);

            // 风暴眼二阶段云脊隐现青金电辉
            if (uStormLevel > 0.01) {
              float flash = pow(hGrad, 1.6) * (0.5 + 0.5 * sin(uTime * 3.4 + vWorldPos.x * 0.14 - vWorldPos.z * 0.09));
              col += vec3(0.30, 0.88, 1.00) * flash * uStormLevel * 0.24;
            }

            // 远景大气雾融（与天空地平线丝滑融合）
            float distXZ = length(vWorldPos.xz);
            float fogMix = smoothstep(34.0, 76.0, distXZ);
            col = mix(col, uFogColor, fogMix * 0.72);

            if (alpha < 0.008) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `
      })
    );
  }

  const volCloudMidMat = createVolumetricCloudMat(0.39, 1.0, 1.0);
  const volCloudFarMat = createVolumetricCloudMat(0.28, 1.0, 0.65);
  const volCloudRidgeMidMat = createVolumetricCloudMat(0.32, 4.2, 0.85);
  const volCloudRidgeFarMat = createVolumetricCloudMat(0.24, 7.2, 0.52);

  const horizonCloudGroup = new THREE.Group();
  horizonCloudGroup.name = 'volumetric_horizon_clouds';
  group.add(horizonCloudGroup);

  // 层级 A：2 道环绕地平线的连续立体波浪云脊（无缝衔接下层流云海）
  const cloudRidgeMid = new THREE.Mesh(
    trackGeo(createCloudRidgeGeometry(THREE, 35.5, deg2rad(-176), deg2rad(-4), 5.6, 4.4, 56, 12, 2.3)),
    volCloudRidgeMidMat
  );
  cloudRidgeMid.position.y = -3.35;
  cloudRidgeMid.renderOrder = -1;
  horizonCloudGroup.add(cloudRidgeMid);

  const cloudRidgeFar = new THREE.Mesh(
    trackGeo(createCloudRidgeGeometry(THREE, 52.5, deg2rad(-179), deg2rad(-1), 7.8, 7.4, 60, 12, 7.9)),
    volCloudRidgeFarMat
  );
  cloudRidgeFar.position.y = -2.45;
  cloudRidgeFar.renderOrder = -3;
  horizonCloudGroup.add(cloudRidgeFar);

  // 共享 3 款不对称立体膨顶云泡几何体
  const geoCloudLobeA = trackGeo(createOrganicCloudLobeGeometry(THREE, 1.7));
  const geoCloudLobeB = trackGeo(createOrganicCloudLobeGeometry(THREE, 5.3));
  const geoCloudLobeC = trackGeo(createOrganicCloudLobeGeometry(THREE, 11.1));
  const cloudLobeGeos = [geoCloudLobeA, geoCloudLobeB, geoCloudLobeC];

  // 层级 B：12 组中远景多层立体堆积云峰（每峰由 5 颗低不透明柔和云泡交叠堆积成蓬松积云山峰）
  const midCloudLobeLayout = [
    { ox: 0.0,  oy: 0.0,  oz: 0.0,  sx: 4.8, sy: 2.5, sz: 4.2 },
    { ox: -3.2, oy: 0.5,  oz: 0.9,  sx: 3.6, sy: 2.3, sz: 3.4 },
    { ox: 3.1,  oy: 0.4,  oz: -0.7, sx: 3.7, sy: 2.4, sz: 3.3 },
    { ox: -0.8, oy: 1.9,  oz: -0.5, sx: 3.3, sy: 2.8, sz: 3.0 },
    { ox: 1.5,  oy: 1.6,  oz: 0.6,  sx: 2.8, sy: 2.3, sz: 2.7 }
  ];
  for (let i = 0; i < 12; i++) {
    const a = deg2rad(-171 + (i / 11) * 162);
    const r = 32.5 + (i % 3) * 3.4;
    const py = -2.65 + (i % 3) * 1.15;
    const bank = new THREE.Group();
    bank.position.set(Math.cos(a) * r, py, Math.sin(a) * r);
    bank.rotation.y = -a + Math.PI * 0.5;
    const bankScale = 0.88 + (i % 4) * 0.14;
    bank.scale.set(bankScale, bankScale * (0.92 + (i % 2) * 0.24), bankScale);

    for (let k = 0; k < midCloudLobeLayout.length; k++) {
      const lp = midCloudLobeLayout[k];
      const lobe = new THREE.Mesh(cloudLobeGeos[(i + k) % 3], volCloudMidMat);
      lobe.position.set(lp.ox, lp.oy, lp.oz);
      lobe.scale.set(lp.sx, lp.sy, lp.sz);
      lobe.rotation.y = (i * 0.7 + k * 1.3);
      lobe.renderOrder = -1;
      bank.add(lobe);
    }
    horizonCloudGroup.add(bank);
    driftingClouds.push({
      group: bank,
      baseAngle: a,
      radius: r,
      baseY: py,
      driftAmp: 0.024 + (i % 3) * 0.008,
      bobAmp: 0.22 + (i % 2) * 0.12,
      speed: 0.16 + (i % 4) * 0.04,
      phase: i * 1.15
    });
  }

  // 层级 C：9 组远景宏伟高耸积云山峦（更柔和低不透明，拉出云巅苍穹纵深视差）
  const farCloudLobeLayout = [
    { ox: 0.0,  oy: 0.0,  oz: 0.0,  sx: 7.4, sy: 3.8, sz: 6.2 },
    { ox: -4.8, oy: 0.8,  oz: 1.4,  sx: 5.5, sy: 3.4, sz: 4.8 },
    { ox: 4.9,  oy: 0.9,  oz: -1.1, sx: 5.4, sy: 3.5, sz: 4.8 },
    { ox: 0.4,  oy: 3.1,  oz: -0.8, sx: 4.9, sy: 4.2, sz: 4.4 }
  ];
  for (let i = 0; i < 9; i++) {
    const a = deg2rad(-174 + (i / 8) * 168);
    const r = 47.5 + (i % 3) * 4.8;
    const py = -1.6 + (i % 3) * 1.55;
    const farBank = new THREE.Group();
    farBank.position.set(Math.cos(a) * r, py, Math.sin(a) * r);
    farBank.rotation.y = -a + Math.PI * 0.5;
    const fScale = 0.96 + (i % 3) * 0.18;
    farBank.scale.set(fScale, fScale * (0.95 + (i % 2) * 0.22), fScale);

    for (let k = 0; k < farCloudLobeLayout.length; k++) {
      const lp = farCloudLobeLayout[k];
      const lobe = new THREE.Mesh(cloudLobeGeos[(i + k + 1) % 3], volCloudFarMat);
      lobe.position.set(lp.ox, lp.oy, lp.oz);
      lobe.scale.set(lp.sx, lp.sy, lp.sz);
      lobe.rotation.y = (i * 0.9 + k * 1.1);
      lobe.renderOrder = -3;
      farBank.add(lobe);
    }
    horizonCloudGroup.add(farBank);
    driftingClouds.push({
      group: farBank,
      baseAngle: a,
      radius: r,
      baseY: py,
      driftAmp: 0.016 + (i % 2) * 0.006,
      bobAmp: 0.30,
      speed: 0.11 + (i % 3) * 0.03,
      phase: i * 1.6 + 0.8
    });
  }

  // =========================================================================
  // 6. 3D 螺旋风带与苍穹星轨环（Sky Wind Ribbons & Celestial Star-Orbit Ring）
  // =========================================================================
  const windGroup = new THREE.Group();
  windGroup.name = 'sky_wind_ribbons';
  group.add(windGroup);

  const windRibbonItems = [];
  function createWindRibbonShader(speed, colorA, colorB, opacity) {
    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uOpacity: { value: opacity },
      uArcIntensity: { value: 0.0 }
    };
    shaderUniforms.push(uniforms);
    windRibbonItems.push({
      uniforms,
      baseSpeed: speed,
      baseOpacity: opacity,
      baseColorA: new THREE.Color(colorA),
      baseColorB: new THREE.Color(colorB)
    });

    return trackMat(
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uSpeed;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uOpacity;
          uniform float uArcIntensity;
          varying vec2 vUv;

          void main() {
            // 横向柔和高斯边缘 + 中心流光丝芯
            float edgeV = 1.0 - abs(vUv.y - 0.5) * 2.0;
            float softCross = pow(clamp(edgeV, 0.0, 1.0), 1.65);
            float coreThread = pow(clamp(edgeV, 0.0, 1.0), 6.0);

            // 沿风带流畅奔涌的多频气流波段
            float flow1 = 0.5 + 0.5 * sin(vUv.x * 18.0 - uTime * uSpeed * 4.2 + vUv.y * 2.5);
            float flow2 = 0.5 + 0.5 * sin(vUv.x * 34.0 - uTime * uSpeed * 7.0 - vUv.y * 3.5);
            float gust  = smoothstep(0.18, 0.92, flow1 * 0.68 + flow2 * 0.32);

            // 头尾柔和消融
            float endFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.84, vUv.x);

            vec3 col = mix(uColorA, uColorB, 0.35 + 0.65 * flow1);
            col += vec3(0.45, 0.48, 0.52) * coreThread * gust;

            // 风暴眼青金电弧亮纹（沿风带高速窜动）
            float arcCrack = 0.0;
            if (uArcIntensity > 0.01) {
              float zig = 0.5 + 0.24 * sin(vUv.x * 46.0 - uTime * uSpeed * 11.5) * cos(vUv.x * 23.0 + uTime * 6.5);
              float distToArc = abs(vUv.y - zig);
              float arcBolt = smoothstep(0.11, 0.012, distToArc) * (0.45 + 0.55 * sin(vUv.x * 28.0 - uTime * 14.0));
              arcCrack = arcBolt * uArcIntensity;
              col += mix(vec3(0.38, 0.96, 1.0), vec3(1.0, 0.90, 0.56), flow2) * arcCrack * 1.15;
            }

            float alpha = (softCross * (0.32 + 0.68 * gust) + coreThread * 0.45 + arcCrack * 0.62) * endFade * uOpacity;
            if (alpha < 0.005) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `
      })
    );
  }

  // 5 条优雅盘旋于神殿外圈与后上方的宽幅流光风丝带（严禁穿越前景作战区）
  const ribbonSpecs = [
    // 高空盘旋环绕圣殿拱门的宏观风神主风带
    {
      startDeg: -176, endDeg: -4, rStart: 15.8, rEnd: 15.8, yStart: 3.4, yPeak: 14.8, yEnd: 4.0,
      width: 0.72, twist: 1.4, speed: 0.82, colA: 0x76e8ff, colB: 0xffe8b0, op: 0.52
    },
    // 反向交织中层苍穹流风带
    {
      startDeg: -10, endDeg: -170, rStart: 13.6, rEnd: 14.2, yStart: 1.4, yPeak: 9.8, yEnd: 2.2,
      width: 0.52, twist: -1.1, speed: 1.05, colA: 0xc2f5ff, colB: 0x62caff, op: 0.46
    },
    // 外渊升腾金风尾带（左翼向上螺旋：172° → 252° 严格绕左后侧，与右翼完全镜像）
    {
      startDeg: 172, endDeg: 252, rStart: 18.8, rEnd: 12.8, yStart: -1.6, yPeak: 7.4, yEnd: 13.2,
      width: 0.62, twist: 1.2, speed: 0.92, colA: 0xffe29c, colB: 0x92ecff, op: 0.44
    },
    // 外渊升腾金风尾带（右翼向上螺旋）
    {
      startDeg: 8, endDeg: -72, rStart: 18.8, rEnd: 12.8, yStart: -1.6, yPeak: 7.4, yEnd: 13.2,
      width: 0.62, twist: -1.2, speed: 0.92, colA: 0xffe29c, colB: 0x92ecff, op: 0.44
    },
    // 云海上方环绕底座的深渊低空气旋带
    {
      startDeg: -168, endDeg: -12, rStart: 14.2, rEnd: 14.6, yStart: -2.4, yPeak: -1.0, yEnd: -2.2,
      width: 0.68, twist: 0.8, speed: 0.74, colA: 0x68d4ff, colB: 0xffffff, op: 0.40
    }
  ];

  for (const rs of ribbonSpecs) {
    const pts = [];
    const steps = 16;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const a = deg2rad(THREE.MathUtils.lerp(rs.startDeg, rs.endDeg, t));
      const r = THREE.MathUtils.lerp(rs.rStart, rs.rEnd, t) + Math.sin(t * Math.PI * 2.0) * 1.1;
      const yBase = THREE.MathUtils.lerp(rs.yStart, rs.yEnd, t);
      const yArc = Math.sin(t * Math.PI) * (rs.yPeak - (rs.yStart + rs.yEnd) * 0.5);
      pts.push(new THREE.Vector3(Math.cos(a) * r, yBase + yArc, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const rGeo = trackGeo(createWindRibbonGeometry(THREE, curve, 84, rs.width, rs.twist));
    const rMat = createWindRibbonShader(rs.speed, rs.colA, rs.colB, rs.op);
    const rMesh = new THREE.Mesh(rGeo, rMat);
    windGroup.add(rMesh);
  }

  // 3 道纤细流光 TubeGeometry 苍穹风流线（与宽丝带叠加形成高速灵动风轨）
  const tubeWindSpecs = [
    { startDeg: -166, endDeg: -14, r: 12.7, yBase: 5.2, yWave: 2.6, radius: 0.055, speed: 1.35 },
    { startDeg: -18,  endDeg: -162, r: 16.9, yBase: 8.6, yWave: 3.1, radius: 0.065, speed: 1.12 },
    { startDeg: -148, endDeg: -32, r: 20.5, yBase: 11.4, yWave: 2.4, radius: 0.075, speed: 0.95 }
  ];

  for (const ts of tubeWindSpecs) {
    const pts = [];
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const a = deg2rad(THREE.MathUtils.lerp(ts.startDeg, ts.endDeg, t));
      const rad = ts.r + Math.sin(t * Math.PI * 3.0) * 0.75;
      const y = ts.yBase + Math.sin(t * Math.PI) * ts.yWave + Math.cos(t * Math.PI * 2.0) * 0.6;
      pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 64, ts.radius, 6, false));
    const tubeMat = createWindRibbonShader(ts.speed, 0xdcfaff, 0xffe8a8, 0.62);
    windGroup.add(new THREE.Mesh(tubeGeo, tubeMat));
  }

  // 宏大苍穹星轨光环（高悬于神殿后上方，刻有流动星霜符文刻度，赋予史诗终极 Boss 殿堂感）
  const skyOrbitUniforms = { uTime: { value: 0 } };
  shaderUniforms.push(skyOrbitUniforms);

  const skyOrbitMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: skyOrbitUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
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
        void main() {
          // RingGeometry 默认平面 UV，转为极坐标计算精致星轨环
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x);

          float thinLine1 = smoothstep(0.018, 0.004, abs(r - 0.96));
          float thinLine2 = smoothstep(0.014, 0.004, abs(r - 0.87));
          float ticks = smoothstep(0.036, 0.008, abs(r - 0.915)) * smoothstep(0.35, 0.75, sin(a * 48.0 - uTime * 0.9));
          float comet = smoothstep(0.86, 1.0, cos(a - uTime * 0.35)) * smoothstep(0.06, 0.0, abs(r - 0.915));

          float mask = clamp(thinLine1 * 0.75 + thinLine2 * 0.55 + ticks * 0.7 + comet * 1.1, 0.0, 1.0);
          vec3 col = mix(vec3(0.55, 0.86, 1.0), vec3(1.0, 0.88, 0.58), thinLine1 * 0.6 + comet * 0.85);
          float alpha = mask * 0.48;
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `
    })
  );

  const skyOrbitRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(11.6, 13.8, 96)), skyOrbitMat);
  skyOrbitRing.position.set(0, 10.6, -12.6);
  skyOrbitRing.rotation.set(0.34, 0.0, 0.08);
  windGroup.add(skyOrbitRing);
  rotatingRings.push({ mesh: skyOrbitRing, axis: 'z', speed: 0.035 });

  // 风暴眼二阶段专属：4 道连接星冠拱门与左右星晶尖塔的 3D 青金电弧流丝（cloud_eye 下隐藏）
  const stormArcGroup = new THREE.Group();
  stormArcGroup.name = 'storm_eye_cyan_gold_arcs';
  stormArcGroup.visible = false;
  windGroup.add(stormArcGroup);

  const stormArcUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.0 }
  };
  shaderUniforms.push(stormArcUniforms);

  const stormArcMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: stormArcUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float center = 1.0 - abs(vUv.y - 0.5) * 2.0;
          float wave = 0.5 + 0.30 * sin(vUv.x * 36.0 - uTime * 16.0) * cos(vUv.x * 19.0 + uTime * 9.5);
          float bolt = smoothstep(0.22, 0.02, abs(vUv.y - wave));
          float aura = pow(clamp(center, 0.0, 1.0), 2.2) * 0.45;
          float pulse = 0.65 + 0.35 * sin(uTime * 10.5 + vUv.x * 12.0);
          float ends = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x);
          vec3 col = mix(vec3(0.34, 0.95, 1.0), vec3(1.0, 0.90, 0.56), bolt * 0.65 + 0.2 * sin(vUv.x * 14.0 - uTime * 8.0));
          float alpha = (bolt * 1.15 + aura) * pulse * ends * uOpacity;
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `
    })
  );

  const stormArcPaths = [
    [new THREE.Vector3(0, 12.1, -11.0), new THREE.Vector3(-6.8, 11.4, -12.8), new THREE.Vector3(-14.8, 8.2, -15.2)],
    [new THREE.Vector3(0, 12.1, -11.0), new THREE.Vector3(6.8, 11.4, -12.8), new THREE.Vector3(14.8, 8.5, -15.2)],
    [new THREE.Vector3(-11.0, 8.8, -4.4), new THREE.Vector3(-6.2, 13.8, -9.8), new THREE.Vector3(0, 12.6, -11.0)],
    [new THREE.Vector3(11.0, 8.8, -4.4), new THREE.Vector3(6.2, 13.8, -9.8), new THREE.Vector3(0, 12.6, -11.0)]
  ];
  for (let i = 0; i < stormArcPaths.length; i++) {
    const arcCurve = new THREE.CatmullRomCurve3(stormArcPaths[i]);
    const arcGeo = trackGeo(createWindRibbonGeometry(THREE, arcCurve, 48, 0.38, i % 2 === 0 ? 0.6 : -0.6));
    stormArcGroup.add(new THREE.Mesh(arcGeo, stormArcMat));
  }

  // =========================================================================
  // 7. 心情变体（cloud_eye 晴空金云神殿 / storm_eye 风暴眼全开 P2）
  // =========================================================================
  const ALTAR_MOODS = {
    cloud_eye: {
      subtitle: '浮空云海 · 星霜神殿',
      sunColor: 0xfff2d8, sunInt: 1.92,
      hemiSky: 0x94ceff, hemiGround: 0xffdca0, hemiInt: 0.98,
      fillColor: 0xd8ecff, fillInt: 0.54,
      sanctumColor: 0x7ae8ff, sanctumBase: 1.75, sanctumAmp: 0.35, sanctumSpeed: 1.4,
      coreColor: 0x64d2ff, coreBase: 1.45, coreAmp: 0.28, coreSpeed: 1.1,
      starCrystalEmissive: 0x38bfff, starCrystalEmissiveInt: 0.92,
      stormLevel: 0.0,
      windSpeedMul: 1.0, windOpacityMul: 1.0, windArcIntensity: 0.0,
      cloudSpeedMul: 1.0, ringSpeedMul: 1.0, crystalSpinMul: 1.0,
      fog: { color: 0xd9e8f9, near: 22, far: 68 },
      background: 0x9ec8f2,
      atmospherePreset: {
        particleType: 'windMotes',
        particleColor: 0xfff2c6,
        particleSecondaryColor: 0xffe296,
        particleCount: 420,
        particleSpeed: 1.0,
        particleWind: 1.0,
        godRayColor: 0xffe8b0,
        godRayOpacity: 0.26,
        godRayOrigin: [0, 16, -14],
        bloomStrength: 0.38,
        bloomThreshold: 0.92,
        bloomRadius: 0.64,
        focusDepth: 0.56,
        blurAmount: 1.65,
        vignetteStrength: 0.14,
        spriteRimTint: [1.03, 1.01, 0.98]
      }
    },
    storm_eye: {
      subtitle: '风暴眼全开 · 青金电弧苍穹',
      sunColor: 0xfff0c2, sunInt: 2.12,
      hemiSky: 0x68d6ff, hemiGround: 0xffd27a, hemiInt: 1.16,
      fillColor: 0xa6eeff, fillInt: 0.84,
      sanctumColor: 0x4ef0ff, sanctumBase: 3.35, sanctumAmp: 0.90, sanctumSpeed: 3.2,
      coreColor: 0xffe07d, coreBase: 2.55, coreAmp: 0.72, coreSpeed: 2.6,
      starCrystalEmissive: 0x4ef0ff, starCrystalEmissiveInt: 1.42,
      stormLevel: 1.0,
      windSpeedMul: 2.25, windOpacityMul: 1.32, windArcIntensity: 1.0,
      cloudSpeedMul: 2.15, ringSpeedMul: 2.15, crystalSpinMul: 1.68,
      fog: { color: 0xb6daf4, near: 20, far: 62 },
      background: 0x6daee6,
      atmospherePreset: {
        particleType: 'windMotes',
        particleColor: 0x7ef4ff,
        particleSecondaryColor: 0xffe288,
        particleCount: 820,
        particleSpeed: 1.85,
        particleWind: 1.90,
        godRayColor: 0xc2f6ff,
        godRayOpacity: 0.34,
        godRayOrigin: [0, 16, -14],
        bloomStrength: 0.46,
        bloomThreshold: 0.90,
        bloomRadius: 0.70,
        focusDepth: 0.56,
        blurAmount: 1.55,
        vignetteStrength: 0.15,
        spriteRimTint: [0.95, 1.01, 1.03]
      }
    }
  };

  function cloneAltarMoodResult(moodId, cfg) {
    return {
      moodId,
      fog: { ...cfg.fog },
      background: cfg.background,
      atmospherePreset: {
        ...cfg.atmospherePreset,
        godRayOrigin: cfg.atmospherePreset.godRayOrigin.slice(),
        spriteRimTint: cfg.atmospherePreset.spriteRimTint.slice()
      }
    };
  }

  function makeAltarMoodSnap(cfg) {
    return {
      sunColor: new THREE.Color(cfg.sunColor),
      sunInt: cfg.sunInt,
      hemiSky: new THREE.Color(cfg.hemiSky),
      hemiGround: new THREE.Color(cfg.hemiGround),
      hemiInt: cfg.hemiInt,
      fillColor: new THREE.Color(cfg.fillColor),
      fillInt: cfg.fillInt,
      sanctumColor: new THREE.Color(cfg.sanctumColor),
      sanctumBase: cfg.sanctumBase,
      sanctumAmp: cfg.sanctumAmp,
      sanctumSpeed: cfg.sanctumSpeed,
      coreColor: new THREE.Color(cfg.coreColor),
      coreBase: cfg.coreBase,
      coreAmp: cfg.coreAmp,
      coreSpeed: cfg.coreSpeed,
      starCrystalEmissive: new THREE.Color(cfg.starCrystalEmissive),
      starCrystalEmissiveInt: cfg.starCrystalEmissiveInt,
      fogColor: new THREE.Color(cfg.fog.color),
      stormLevel: cfg.stormLevel,
      windSpeedMul: cfg.windSpeedMul,
      windOpacityMul: cfg.windOpacityMul,
      windArcIntensity: cfg.windArcIntensity,
      cloudSpeedMul: cfg.cloudSpeedMul,
      ringSpeedMul: cfg.ringSpeedMul,
      crystalSpinMul: cfg.crystalSpinMul
    };
  }

  function copyAltarSnap(dst, src) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].copy(src[k]);
      else dst[k] = src[k];
    }
  }

  function lerpAltarSnap(dst, a, b, t) {
    for (const k in dst) {
      if (dst[k] && dst[k].isColor) dst[k].lerpColors(a[k], b[k], t);
      else dst[k] = a[k] + (b[k] - a[k]) * t;
    }
  }

  let currentMoodId = 'cloud_eye';
  let runtimeTicks = 0;
  const moodCur = makeAltarMoodSnap(ALTAR_MOODS.cloud_eye);
  const moodFrom = makeAltarMoodSnap(ALTAR_MOODS.cloud_eye);
  const moodTarget = makeAltarMoodSnap(ALTAR_MOODS.cloud_eye);
  const moodTrans = { active: false, elapsed: 0, duration: 0.9 };
  const stormCyanTint = new THREE.Color(0x4ef0ff);
  const stormGoldTint = new THREE.Color(0xffe07d);

  function commitAltarMood(s) {
    sunLight.color.copy(s.sunColor);
    sunLight.intensity = s.sunInt;
    hemiLight.color.copy(s.hemiSky);
    hemiLight.groundColor.copy(s.hemiGround);
    hemiLight.intensity = s.hemiInt;
    frontFillLight.color.copy(s.fillColor);
    frontFillLight.intensity = s.fillInt;

    sanctumLight.color.copy(s.sanctumColor);
    pulsedLights[0].base = s.sanctumBase;
    pulsedLights[0].amp = s.sanctumAmp;
    pulsedLights[0].speed = s.sanctumSpeed;

    coreLight.color.copy(s.coreColor);
    pulsedLights[1].base = s.coreBase;
    pulsedLights[1].amp = s.coreAmp;
    pulsedLights[1].speed = s.coreSpeed;

    matStarCrystal.emissive.copy(s.starCrystalEmissive);
    matStarCrystal.emissiveIntensity = s.starCrystalEmissiveInt;
    matStarCrystalShell.emissive.copy(s.starCrystalEmissive);
    matStarCrystalShell.emissiveIntensity = 0.42 + s.stormLevel * 0.34;
    crystalHeartUniforms.uStormLevel.value = s.stormLevel;

    skyUniforms.uStormLevel.value = s.stormLevel;

    for (let i = 0; i < cloudLayers.length; i++) {
      const cl = cloudLayers[i];
      cl.uniforms.uSpeed.value = cl.baseSpeed * s.cloudSpeedMul;
      cl.uniforms.uStormLevel.value = s.stormLevel;
      cl.uniforms.uFogColor.value.copy(s.fogColor);
    }

    for (let i = 0; i < volCloudLayers.length; i++) {
      const vc = volCloudLayers[i];
      vc.uniforms.uSpeed.value = vc.baseSpeed * s.cloudSpeedMul;
      vc.uniforms.uStormLevel.value = s.stormLevel;
      vc.uniforms.uFogColor.value.copy(s.fogColor);
    }

    for (let i = 0; i < windRibbonItems.length; i++) {
      const wr = windRibbonItems[i];
      wr.uniforms.uSpeed.value = wr.baseSpeed * s.windSpeedMul;
      wr.uniforms.uOpacity.value = Math.min(0.95, wr.baseOpacity * s.windOpacityMul);
      wr.uniforms.uArcIntensity.value = s.windArcIntensity;
      wr.uniforms.uColorA.value.lerpColors(wr.baseColorA, stormCyanTint, s.stormLevel * 0.55);
      wr.uniforms.uColorB.value.lerpColors(wr.baseColorB, stormGoldTint, s.stormLevel * 0.55);
    }

    stormArcUniforms.uOpacity.value = s.stormLevel * 0.78;
    stormArcGroup.visible = s.stormLevel > 0.015;
  }

  let biomeHandle = null;

  function applyMood(moodId, options = {}) {
    const rawKey = typeof moodId === 'string' ? moodId.trim().toLowerCase() : '';
    const resolvedKey = ALTAR_MOODS[rawKey] ? rawKey : 'cloud_eye';
    const cfg = ALTAR_MOODS[resolvedKey];
    currentMoodId = resolvedKey;

    const targetSnap = makeAltarMoodSnap(cfg);
    const immediate =
      options.immediate === true ||
      options.duration === 0 ||
      runtimeTicks < 2;

    if (immediate) {
      copyAltarSnap(moodCur, targetSnap);
      copyAltarSnap(moodFrom, targetSnap);
      copyAltarSnap(moodTarget, targetSnap);
      moodTrans.active = false;
      moodTrans.elapsed = 0;
      commitAltarMood(moodCur);
    } else {
      copyAltarSnap(moodFrom, moodCur);
      copyAltarSnap(moodTarget, targetSnap);
      moodTrans.duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0.9;
      moodTrans.elapsed = 0;
      moodTrans.active = true;
    }

    const result = cloneAltarMoodResult(resolvedKey, cfg);
    if (biomeHandle) {
      biomeHandle.currentMood = resolvedKey;
      biomeHandle.subtitle = cfg.subtitle;
      biomeHandle.fog = { ...result.fog };
      biomeHandle.background = result.background;
      biomeHandle.atmospherePreset = {
        ...result.atmospherePreset,
        godRayOrigin: result.atmospherePreset.godRayOrigin.slice(),
        spriteRimTint: result.atmospherePreset.spriteRimTint.slice()
      };
    }
    return result;
  }

  // =========================================================================
  // 实时动画更新（云海流动、立体积云漂移、浮石公转、断链随风摆动、晶簇自转、法阵缓转）
  // =========================================================================
  let disposed = false;

  function update(elapsedSec, dtSec) {
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
      lerpAltarSnap(moodCur, moodFrom, moodTarget, smoothT);
      commitAltarMood(moodCur);
      if (rawT >= 1) {
        moodTrans.active = false;
      }
    }

    // 1. 更新全部 GLSL 着色器时间（云海、立体积云、天空卷云、太阳光晕、双层法阵、晶核、风丝带、星轨环、风暴电弧）
    for (let i = 0; i < shaderUniforms.length; i++) {
      shaderUniforms[i].uTime.value = t;
    }

    // 2. 旋转星霜法阵、底部浮空光环、苍穹星轨环
    const rMul = moodCur.ringSpeedMul;
    for (let i = 0; i < rotatingRings.length; i++) {
      const item = rotatingRings[i];
      item.mesh.rotation[item.axis] += item.speed * rMul * dt;
    }

    // 3. 悬浮星晶簇、圣殿冠核与星晶石塔自转上下浮动
    const cMul = moodCur.crystalSpinMul;
    for (let i = 0; i < floatingCrystals.length; i++) {
      const fc = floatingCrystals[i];
      fc.group.position.y = fc.baseY + Math.sin(t * fc.speed * (0.7 + 0.3 * cMul) + fc.phase) * fc.amp;
      if (fc.crystal) {
        fc.crystal.rotation.y += fc.spinSpeed * cMul * dt;
      }
      if (fc.ringA) {
        fc.ringA.rotation.z += fc.spinSpeed * 1.15 * cMul * dt;
        fc.ringA.rotation.y += fc.spinSpeed * 0.45 * cMul * dt;
      }
      if (fc.ringB) {
        fc.ringB.rotation.y -= fc.spinSpeed * 0.85 * cMul * dt;
        fc.ringB.rotation.x += fc.spinSpeed * 0.35 * cMul * dt;
      }
    }

    // 4. 断柱上方悬浮碎石鼓与断拱浮石微浮
    for (let i = 0; i < hoveringDrums.length; i++) {
      const hd = hoveringDrums[i];
      hd.group.position.y = hd.baseY + Math.sin(t * hd.speed + hd.phase) * hd.amp;
      hd.group.rotation.y += hd.rotSpeed * cMul * dt;
    }

    // 5. 深渊外围浮空巨石群与小岛上下漂浮 + 微幅优雅公转
    for (let i = 0; i < floatingIslands.length; i++) {
      const fi = floatingIslands[i];
      const curAngle = fi.baseAngle + Math.sin(t * fi.orbitSpeed * (0.65 + 0.35 * rMul) + fi.phase) * fi.orbitAmp;
      fi.group.position.x = Math.cos(curAngle) * fi.radius;
      fi.group.position.z = Math.sin(curAngle) * fi.radius;
      fi.group.position.y = fi.baseY + Math.sin(t * fi.bobSpeed + fi.phase) * fi.bobAmp;
      fi.group.rotation.y = Math.sin(t * 0.25 + fi.phase) * 0.22;
      fi.group.rotation.z = Math.sin(t * fi.tiltSpeed + fi.phase) * 0.045;
    }

    // 6. 遗迹悬垂断链随高空风势轻摆（风暴眼二阶段摆幅与频率增强）
    const chainWind = 1.0 + moodCur.stormLevel * 0.85;
    for (let i = 0; i < swayingChains.length; i++) {
      const sc = swayingChains[i];
      sc.mesh.rotation.z = sc.baseRotZ + Math.sin(t * sc.speed * chainWind + sc.phase) * sc.amp * chainWind;
    }

    // 7. 地平线立体堆积云峰柔和漂移与吐纳起伏
    const cloudMul = moodCur.cloudSpeedMul;
    for (let i = 0; i < driftingClouds.length; i++) {
      const dc = driftingClouds[i];
      const ang = dc.baseAngle + Math.sin(t * dc.speed * (0.65 + 0.35 * cloudMul) + dc.phase) * dc.driftAmp;
      dc.group.position.x = Math.cos(ang) * dc.radius;
      dc.group.position.z = Math.sin(ang) * dc.radius;
      dc.group.position.y = dc.baseY + Math.sin(t * dc.speed * 1.4 + dc.phase) * dc.bobAmp;
    }

    // 8. 圣坛晶核点光柔和呼吸
    for (let i = 0; i < pulsedLights.length; i++) {
      const pl = pulsedLights[i];
      pl.light.intensity = pl.base + Math.sin(t * pl.speed + pl.phase) * pl.amp;
    }
  }

  // =========================================================================
  // 完整释放本模块所有自建 GPU 资源（绝不触碰外部共享 texLib 纹理）
  // =========================================================================
  function dispose() {
    if (disposed) return;
    disposed = true;

    for (let i = 0; i < ownedInstancedMeshes.length; i++) {
      if (ownedInstancedMeshes[i] && typeof ownedInstancedMeshes[i].dispose === 'function') {
        ownedInstancedMeshes[i].dispose();
      }
    }
    ownedInstancedMeshes.length = 0;

    for (let i = 0; i < ownedGeometries.length; i++) {
      ownedGeometries[i].dispose();
    }
    ownedGeometries.length = 0;

    for (let i = 0; i < ownedMaterials.length; i++) {
      ownedMaterials[i].dispose();
    }
    ownedMaterials.length = 0;

    for (let i = 0; i < ownedTextures.length; i++) {
      ownedTextures[i].dispose();
    }
    ownedTextures.length = 0;

    if (sunLight.shadow && sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
    }
  }

  const defaultResult = cloneAltarMoodResult('cloud_eye', ALTAR_MOODS.cloud_eye);
  biomeHandle = {
    id: 'altar',
    name: '云巅风神祭坛',
    subtitle: ALTAR_MOODS.cloud_eye.subtitle,
    currentMood: currentMoodId,
    supportedMoods: Object.keys(ALTAR_MOODS),
    group,
    fog: defaultResult.fog,
    background: defaultResult.background,
    atmospherePreset: defaultResult.atmospherePreset,
    applyMood,
    update,
    dispose
  };
  return biomeHandle;
}
