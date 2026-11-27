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

  // 解析 texLib
  const rawMarble = resolveTex(texLib.marble);
  const rawStone = resolveTex(texLib.courtyardStone);
  const rawIce = resolveTex(texLib.iceCrystal);
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

  // =========================================================================
  // 共享核心 PBR 材质（雪瓷白大理石 · 香槟金镶边 · 苍穹星晶 · 浮空岩基）
  // 兼顾无 envMap 时同样通透明亮，高光不发黑、白瓷不爆曝
  // =========================================================================
  const marbleFloorTex = makeTiledTex(THREE, rawMarble, 4.4, 4.4);
  const marbleColTex = makeTiledTex(THREE, rawMarble, 1.4, 2.8);
  const stoneTrimTex = makeTiledTex(THREE, rawStone || rawMarble, 6.0, 1.4);
  const iceShardTex = makeTiledTex(THREE, rawIce, 1.2, 1.6);

  const matMarbleFloor = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0f4fc,
      map: marbleFloorTex,
      roughness: 0.42,
      metalness: 0.04
    })
  );

  const matMarbleColumn = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f7fe,
      map: marbleColTex,
      roughness: 0.36,
      metalness: 0.05
    })
  );

  const matMarbleArch = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeef3fb,
      map: stoneTrimTex,
      roughness: 0.4,
      metalness: 0.05
    })
  );

  const matStonePlinth = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2eaf6,
      map: stoneTrimTex,
      roughness: 0.56,
      metalness: 0.04
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
      emissiveIntensity: 0.42,
      roughness: 0.2,
      metalness: 0.62
    })
  );

  const matRockSpire = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: stoneTrimTex,
      roughness: 0.84,
      metalness: 0.04
    })
  );

  const matMonolithStone = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc9d7ea,
      map: stoneTrimTex,
      roughness: 0.72,
      metalness: 0.08
    })
  );

  const matStarCrystal = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa4f0ff,
      map: iceShardTex,
      emissive: 0x38bfff,
      emissiveIntensity: 0.92,
      roughness: 0.15,
      metalness: 0.16,
      transparent: true,
      opacity: 0.91
    })
  );

  const matCrystalCore = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0.92
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

  // =========================================================================
  // 1. 高空蔚蓝 → 香槟金渐变苍穹 + 远空日光晕 + 神圣主光源与双色半球光
  // =========================================================================
  const sunDir = new THREE.Vector3(0, 16, -14).normalize();

  const skyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir.clone() },
    uCloudTex: { value: cloudSampleTex },
    uHasCloudTex: { value: rawCloud ? 1.0 : 0.0 }
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

          // 高空蔚蓝 → 清透天青 → 雪瓷浅冰 → 香槟日落金地平线
          vec3 colZenith   = vec3(0.14, 0.40, 0.80);
          vec3 colMidSky   = vec3(0.39, 0.70, 0.96);
          vec3 colIceMist  = vec3(0.82, 0.91, 0.99);
          vec3 colChampagne= vec3(1.00, 0.89, 0.70);
          vec3 colHorizon  = vec3(0.99, 0.82, 0.58);
          vec3 colAbyss    = vec3(0.56, 0.74, 0.91);

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

          // 地平线暖金光带
          float horizonGlow = exp(-abs(h - 0.015) * 11.5);
          sky = mix(sky, colHorizon, horizonGlow * 0.52);

          // 太阳方向米氏前向散射与神圣金轮
          float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
          float wideHalo = pow(sunDot, 4.5);
          float tightCorona = pow(sunDot, 36.0);
          float sunDisc = smoothstep(0.9955, 0.9988, sunDot);

          sky += vec3(1.0, 0.88, 0.64) * wideHalo * 0.42;
          sky += vec3(1.0, 0.94, 0.80) * tightCorona * 0.65;
          sky += vec3(1.38, 1.28, 1.05) * sunDisc * 1.15;

          // 高空丝絮卷云（柔和飘动）
          if (h > 0.05) {
            vec2 skyUv = d.xz / (h + 0.36) * 0.24;
            vec2 uv1 = skyUv + vec2(uTime * 0.005, -uTime * 0.003);
            vec2 uv2 = skyUv * 1.85 - vec2(uTime * 0.0035, uTime * 0.002);
            float c1 = mix(vnoise(uv1 * 6.0), texture2D(uCloudTex, uv1).r, uHasCloudTex);
            float c2 = mix(vnoise(uv2 * 6.0), texture2D(uCloudTex, uv2).r, uHasCloudTex);
            float cirrus = smoothstep(0.54, 0.84, c1 * 0.65 + c2 * 0.35);
            float mask = smoothstep(0.06, 0.22, h) * (1.0 - smoothstep(0.62, 0.94, h));
            vec3 cirrusCol = mix(vec3(0.95, 0.98, 1.0), vec3(1.0, 0.92, 0.76), wideHalo * 0.8 + horizonGlow * 0.5);
            sky = mix(sky, cirrusCol, cirrus * mask * 0.34);
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

  // 外缘阶梯石阶底座（直径 23.2 ~ 24.4，均位于 y <= -0.14 向下逐层递进，绝不遮挡台面）
  const midPlinth = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(11.48, 11.66, 0.38, 16)),
    matStonePlinth
  );
  midPlinth.position.y = -0.33;
  midPlinth.receiveShadow = true;
  midPlinth.castShadow = true;
  platformGroup.add(midPlinth);

  const lowerCornice = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(12.22, 11.72, 0.56, 16)),
    matMarbleArch
  );
  lowerCornice.position.y = -0.78;
  lowerCornice.receiveShadow = true;
  lowerCornice.castShadow = true;
  platformGroup.add(lowerCornice);

  // 台沿双道香槟金金属嵌条环
  const goldRimTop = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(11.49, 0.075, 10, 48)),
    matChampagneGold
  );
  goldRimTop.rotation.x = Math.PI * 0.5;
  goldRimTop.position.y = -0.14;
  platformGroup.add(goldRimTop);

  const goldRimLower = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(12.21, 0.095, 10, 16)),
    matChampagneGold
  );
  goldRimLower.rotation.x = Math.PI * 0.5;
  goldRimLower.rotation.z = Math.PI / 16;
  goldRimLower.position.y = -0.52;
  platformGroup.add(goldRimLower);

  // 16 组台底雕花托座（Corbels）与镶嵌星晶发光石
  const corbelGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.92, 0.88));
  const rimGemGeo = trackGeo(new THREE.OctahedronGeometry(0.18, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const corbel = new THREE.Mesh(corbelGeo, matStonePlinth);
    corbel.position.set(Math.cos(a) * 11.45, -1.28, Math.sin(a) * 11.45);
    corbel.rotation.y = -a + Math.PI * 0.5;
    corbel.rotation.x = 0.24;
    platformGroup.add(corbel);

    const rimGem = new THREE.Mesh(rimGemGeo, i % 2 === 0 ? matRuneGlowCyan : matBrightGold);
    rimGem.position.set(Math.cos(a) * 12.15, -0.76, Math.sin(a) * 12.15);
    rimGem.scale.set(0.75, 1.35, 0.75);
    platformGroup.add(rimGem);
  }

  // 前景礼仪悬空石阶（沿 +Z 边缘向下步入深渊云海，视角可清晰俯瞰浮空断崖感）
  for (let s = 0; s < 4; s++) {
    const w = 6.2 - s * 0.55;
    const stepMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, 0.18, 0.52)),
      s % 2 === 0 ? matMarbleFloor : matStonePlinth
    );
    stepMesh.position.set(0, -0.10 - s * 0.16, 10.72 + s * 0.44);
    stepMesh.receiveShadow = true;
    platformGroup.add(stepMesh);

    const stepGold = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w + 0.08, 0.04, 0.08)),
      matChampagneGold
    );
    stepGold.position.set(0, -0.02 - s * 0.16, 10.97 + s * 0.44);
    platformGroup.add(stepGold);
  }

  // 后方神殿高台延伸（位于 z < -10.3，托起主拱门双柱）
  const rearDais = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.8, 0.48, 2.5)), matMarbleFloor);
  rearDais.position.set(0, 0.04, -11.45);
  rearDais.receiveShadow = true;
  platformGroup.add(rearDais);
  const rearDaisTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.0, 0.09, 2.62)), matChampagneGold);
  rearDaisTrim.position.set(0, 0.26, -11.45);
  platformGroup.add(rearDaisTrim);

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

  // 共享柱座与柱头几何体（LatheGeometry 精细古典线脚）
  const baseProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.76, 0.0),
    new THREE.Vector2(0.76, 0.16),
    new THREE.Vector2(0.66, 0.24),
    new THREE.Vector2(0.70, 0.34),
    new THREE.Vector2(0.56, 0.44),
    new THREE.Vector2(0.51, 0.56)
  ];
  const geoColBase = trackGeo(new THREE.LatheGeometry(baseProfile, 20));
  const geoColPlinth = trackGeo(new THREE.BoxGeometry(1.56, 0.34, 1.56));
  const geoColGoldCollar = trackGeo(new THREE.TorusGeometry(0.52, 0.048, 8, 24));
  geoColGoldCollar.rotateX(Math.PI * 0.5);

  const capProfile = [
    new THREE.Vector2(0.45, 0.0),
    new THREE.Vector2(0.52, 0.12),
    new THREE.Vector2(0.56, 0.32),
    new THREE.Vector2(0.72, 0.58),
    new THREE.Vector2(0.78, 0.72),
    new THREE.Vector2(0.0, 0.72)
  ];
  const geoColCap = trackGeo(new THREE.LatheGeometry(capProfile, 20));
  const geoColAbacus = trackGeo(new THREE.BoxGeometry(1.66, 0.22, 1.66));

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

    // 方座 + 线脚基座 + 金项圈
    const plinth = new THREE.Mesh(geoColPlinth, matStonePlinth);
    plinth.position.y = 0.17;
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
      // 完整柱头 + 金环 + 方形顶板
      const topCollar = new THREE.Mesh(geoColGoldCollar, matChampagneGold);
      topCollar.position.y = 0.88 + shaftH - 0.04;
      topCollar.scale.set(0.92 * scaleXZ, 1, 0.92 * scaleXZ);
      colObj.add(topCollar);

      const cap = new THREE.Mesh(geoColCap, matMarbleColumn);
      cap.position.y = 0.88 + shaftH;
      cap.scale.set(scaleXZ, 1, scaleXZ);
      cap.castShadow = true;
      colObj.add(cap);

      const abacus = new THREE.Mesh(geoColAbacus, matMarbleArch);
      abacus.position.y = 0.88 + shaftH + 0.82;
      abacus.scale.set(scaleXZ, 1, scaleXZ);
      abacus.castShadow = true;
      colObj.add(abacus);

      const abacusGold = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.74 * scaleXZ, 0.06, 1.74 * scaleXZ)),
        matChampagneGold
      );
      abacusGold.position.y = 0.88 + shaftH + 0.95;
      colObj.add(abacusGold);
    } else if (def.hasDrum) {
      // 悬浮在断柱上方缓慢自转微浮的碎裂石鼓与金环
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

      const drumHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.66, 0.03, 8, 24)), matRuneGlowCyan);
      drumHalo.rotation.x = Math.PI * 0.5 + 0.14;
      drumGroup.add(drumHalo);

      hoveringDrums.push({
        group: drumGroup,
        baseY,
        amp: 0.24,
        speed: 0.9 + i * 0.18,
        phase: i * 1.4,
        rotSpeed: 0.24 * (i % 2 === 0 ? 1 : -1)
      });
    } else {
      // 低矮前翼断柱上方悬浮一枚精致星晶碎片
      const tinyShard = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.32, 0)), matStarCrystal);
      tinyShard.scale.set(0.68, 1.65, 0.68);
      const baseY = def.h + 0.92;
      tinyShard.position.set(0, baseY, 0);
      colObj.add(tinyShard);
      hoveringDrums.push({
        group: tinyShard,
        baseY,
        amp: 0.18,
        speed: 1.45,
        phase: i * 2.1,
        rotSpeed: 0.65
      });
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

    const trimGeo = trackGeo(createCurvedBeamGeometry(THREE, 11.30, a1, a2, 1.32, 0.12, 18));
    const trim = new THREE.Mesh(trimGeo, matChampagneGold);
    trim.position.y = yBase + 0.42;
    colonnadeGroup.add(trim);
  }

  buildWingEntablature(-161, -119, 8.78);
  buildWingEntablature(-61, -19, 8.78);

  // 柱间哥特尖拱肋条（连接翼柱顶端优雅起拱）
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
    colonnadeGroup.add(archL, archR, goldL, goldR);
  }

  addGothicBayArch(-158, -140, 8.35);
  addGothicBayArch(-140, -122, 8.55);
  addGothicBayArch(-58, -40, 8.55);
  addGothicBayArch(-40, -22, 8.35);

  // 中央圣殿「破碎哥特星冠拱门」（双弧从 9.8m 高柱直冲 13.8m 天穹，顶端开放托举悬浮星晶星轨仪）
  for (const side of [-1, 1]) {
    const startX = side * 2.75;
    const baseZ = -11.01;
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, 9.75, baseZ),
      new THREE.Vector3(startX * 0.86, 11.45, baseZ),
      new THREE.Vector3(startX * 0.54, 12.95, baseZ),
      new THREE.Vector3(side * 0.68, 13.78, baseZ)
    ]);
    const ribMarble = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(archCurve, 22, 0.34, 10, false)),
      matMarbleArch
    );
    ribMarble.castShadow = true;
    const ribGold = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(archCurve, 22, 0.11, 8, false)),
      matBrightGold
    );
    ribGold.position.y = -0.34;
    colonnadeGroup.add(ribMarble, ribGold);
  }

  // 圣殿拱门中心悬浮「风神星轨冠核」（双层香槟金平衡环 + 发光冰晶主核 + 柔和光晕）
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 12.15, -11.01);
  colonnadeGroup.add(crownGroup);

  const crownCrystal = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.92, 0)), matStarCrystal);
  crownCrystal.scale.set(0.66, 1.68, 0.66);
  const crownInnerCore = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.45, 0)), matCrystalCore);
  crownInnerCore.scale.set(0.62, 1.55, 0.62);
  crownGroup.add(crownCrystal, crownInnerCore);

  const gimbalRing1 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.55, 0.055, 10, 48)), matBrightGold);
  const gimbalRing2 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.05, 0.045, 10, 56)), matChampagneGold);
  gimbalRing2.rotation.x = Math.PI * 0.35;
  crownGroup.add(gimbalRing1, gimbalRing2);

  if (rawGlow) {
    const crownGlowMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x92ecff,
        map: rawGlow,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    const crownGlow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.6, 5.6)), crownGlowMat);
    crownGroup.add(crownGlow);
  }

  floatingCrystals.push({
    group: crownGroup,
    crystal: crownCrystal,
    ringA: gimbalRing1,
    ringB: gimbalRing2,
    baseY: 12.15,
    amp: 0.32,
    speed: 1.05,
    phase: 0.2,
    spinSpeed: 0.55
  });

  // 8 枚柱间悬浮发光星晶锥体（缓慢上下浮沉自转 + 倾角金环）
  const geoBayCrystal = trackGeo(new THREE.OctahedronGeometry(0.54, 0));
  const geoBayCore = trackGeo(new THREE.OctahedronGeometry(0.28, 0));
  const geoBayHalo = trackGeo(new THREE.TorusGeometry(0.86, 0.032, 8, 32));
  const bayAngles = [-170, -149, -131, -113, -67, -49, -31, -10];

  for (let i = 0; i < bayAngles.length; i++) {
    const a = deg2rad(bayAngles[i]);
    const r = 11.05;
    const baseY = 3.55 + (i % 3) * 0.55;
    const cg = new THREE.Group();
    cg.position.set(Math.cos(a) * r, baseY, Math.sin(a) * r);
    colonnadeGroup.add(cg);

    const cry = new THREE.Mesh(geoBayCrystal, matStarCrystal);
    cry.scale.set(0.62, 1.85, 0.62);
    const core = new THREE.Mesh(geoBayCore, matCrystalCore);
    core.scale.set(0.55, 1.72, 0.55);
    cry.add(core);
    cg.add(cry);

    const halo = new THREE.Mesh(geoBayHalo, i % 2 === 0 ? matBrightGold : matRuneGlowCyan);
    halo.rotation.x = Math.PI * 0.5 + 0.28;
    halo.rotation.y = a;
    cg.add(halo);

    if (rawGlow) {
      const glowSpriteMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x7ce6ff,
          map: rawGlow,
          transparent: true,
          opacity: 0.48,
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
      crystal: cry,
      ringA: halo,
      ringB: null,
      baseY,
      amp: 0.34,
      speed: 1.15 + (i % 4) * 0.16,
      phase: i * 0.85,
      spinSpeed: 0.62 * (i % 2 === 0 ? 1 : -1)
    });
  }

  // 2 座远景发光星晶石塔（立于祭坛后左右外侧浮空岛礁之上，烘托苍穹神域纵深）
  const spireTowerPositions = [
    { x: -14.8, y: 1.6, z: -15.2, scale: 1.08, phase: 0.6 },
    { x: 14.8,  y: 1.9, z: -15.2, scale: 1.02, phase: 2.4 }
  ];
  for (const tp of spireTowerPositions) {
    const tower = new THREE.Group();
    tower.position.set(tp.x, tp.y, tp.z);
    tower.scale.setScalar(tp.scale);
    group.add(tower);

    // 浮空底座岩岛
    const isletRock = new THREE.Mesh(
      trackGeo(createFloatingRockSpireGeometry(THREE, 2.55, 4.6, 12, 6, tp.phase * 5.0)),
      matRockSpire
    );
    tower.add(isletRock);

    const isletCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.55, 2.65, 0.34, 8)), matMarbleArch);
    isletCap.position.y = 0.17;
    tower.add(isletCap);

    // 三段悬浮叠升星晶尖塔
    const seg1 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.72, 1.05, 3.2, 6)), matMarbleColumn);
    seg1.position.y = 1.95;
    tower.add(seg1);

    const segGold = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.18, 0.065, 8, 24)), matBrightGold);
    segGold.rotation.x = Math.PI * 0.5;
    segGold.position.y = 3.75;
    tower.add(segGold);

    const spireCrystal = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(1.12, 0)), matStarCrystal);
    spireCrystal.scale.set(0.68, 2.35, 0.68);
    spireCrystal.position.y = 6.2;
    tower.add(spireCrystal);

    const spireCore = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.55, 0)), matCrystalCore);
    spireCore.scale.set(0.6, 2.1, 0.6);
    spireCrystal.add(spireCore);

    const towerRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.75, 0.05, 8, 36)), matRuneGlowCyan);
    towerRing.rotation.x = Math.PI * 0.5 + 0.22;
    towerRing.position.y = 6.2;
    tower.add(towerRing);

    floatingCrystals.push({
      group: tower,
      crystal: spireCrystal,
      ringA: towerRing,
      ringB: segGold,
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

  // 共享几何体：符文巨石与星晶碎片
  const geoMonolith = trackGeo(new THREE.CylinderGeometry(0.75, 1.15, 3.8, 6));
  const geoMonolithBand = trackGeo(new THREE.TorusGeometry(1.02, 0.045, 6, 6));
  geoMonolithBand.rotateX(Math.PI * 0.5);
  const geoShardSmall = trackGeo(new THREE.OctahedronGeometry(0.52, 0));

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
      // 浮空小岛：倒锥岩基 + 白瓷顶盖 + 迷你断柱或发光晶簇
      const rock = new THREE.Mesh(
        trackGeo(createFloatingRockSpireGeometry(THREE, 1.9, 3.3, 10, 5, 30 + i * 2.7)),
        matRockSpire
      );
      holder.add(rock);

      const cap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.88, 1.95, 0.28, 8)), matMarbleArch);
      cap.position.y = 0.14;
      holder.add(cap);

      if (i % 2 === 0) {
        const miniPillar = new THREE.Mesh(
          trackGeo(createFlutedColumnGeometry(THREE, 0.32, 0.29, 1.9, true, i * 0.9, rng)),
          matMarbleColumn
        );
        miniPillar.position.set(-0.4, 0.28, 0.2);
        holder.add(miniPillar);
      }
      const miniCrystal = new THREE.Mesh(geoShardSmall, matStarCrystal);
      miniCrystal.scale.set(0.65, 1.85, 0.65);
      miniCrystal.position.set(0.45, 1.1, -0.2);
      holder.add(miniCrystal);
    } else if (bp.type === 'monolith') {
      // 符文巨石：六棱柱石碑 + 双道发光青/金符文环
      const stone = new THREE.Mesh(geoMonolith, matMonolithStone);
      stone.rotation.set((rng() - 0.5) * 0.18, rng() * Math.PI, (rng() - 0.5) * 0.18);
      holder.add(stone);

      const band1 = new THREE.Mesh(geoMonolithBand, i % 2 === 0 ? matRuneGlowCyan : matRuneGlowGold);
      band1.position.y = 0.55;
      stone.add(band1);
      const band2 = new THREE.Mesh(geoMonolithBand, i % 2 === 0 ? matRuneGlowGold : matRuneGlowCyan);
      band2.position.y = -0.65;
      band2.scale.setScalar(1.12);
      stone.add(band2);
    } else {
      // 星晶岩簇：多面体浮岩 + 3 枚斜插发光星晶
      const crag = new THREE.Mesh(
        trackGeo(new THREE.DodecahedronGeometry(1.35, 0)),
        matMonolithStone
      );
      crag.scale.set(1.15, 0.85, 1.0);
      holder.add(crag);

      for (let k = 0; k < 3; k++) {
        const shard = new THREE.Mesh(geoShardSmall, matStarCrystal);
        shard.scale.set(0.55, 1.7 + k * 0.35, 0.55);
        const ka = (k / 3) * Math.PI * 2 + i;
        shard.position.set(Math.cos(ka) * 0.65, 0.65 + k * 0.15, Math.sin(ka) * 0.65);
        shard.rotation.set(0.28 * Math.sin(ka), ka, -0.28 * Math.cos(ka));
        holder.add(shard);
      }
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
      uLayerTint: { value: new THREE.Color(layerTint) }
    };
    shaderUniforms.push(uniforms);

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
            // 在神殿下方加入极轻微的风眼涡旋扭转
            float angle = atan(vWorldXZ.y, vWorldXZ.x);
            float swirl = exp(-vDist * 0.065) * 0.45;
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

            // 色彩：苍穹天青云谷 → 晶莹雪白云身 → 日落香槟金受光云脊
            vec3 shadowCol = vec3(0.46, 0.68, 0.90) * uLayerTint;
            vec3 bodyCol   = vec3(0.95, 0.98, 1.00);
            vec3 goldRim   = vec3(1.00, 0.88, 0.66);

            vec3 col = mix(shadowCol, bodyCol, smoothstep(0.18, 0.76, cloudDensity * 0.75 + slopeLit * 0.35));
            // 面向后方太阳方向的强金光散射
            float towardSun = smoothstep(-0.35, 0.95, dot(normalize(vWorldXZ + vec2(0.0001)), normalize(uSunDir.xz)));
            float rimScatter = crest * (0.45 + 0.55 * towardSun) + pow(slopeLit, 2.2) * 0.38;
            col = mix(col, goldRim, clamp(rimScatter * 0.72, 0.0, 0.82));

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

  // 远景日照金边积云峰（10 组软羽化云朵立于后方地平线云海之上，丰富天空地平线剪影）
  const puffUniforms = {
    uTime: { value: 0 },
    uCloudTex: { value: cloudSampleTex },
    uHasCloudTex: { value: rawCloud ? 1.0 : 0.0 }
  };
  shaderUniforms.push(puffUniforms);

  const cloudPuffMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: puffUniforms,
      transparent: true,
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
        uniform sampler2D uCloudTex;
        uniform float uHasCloudTex;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - vec2(0.5, 0.42)) * vec2(2.0, 2.35);
          float baseShape = 1.0 - smoothstep(0.28, 0.96, length(p));
          float n = texture2D(uCloudTex, vUv * 1.4 + vec2(uTime * 0.008, 0.0)).r;
          float nMix = mix(0.65, n, uHasCloudTex);
          float alpha = smoothstep(0.24, 0.72, baseShape * (0.62 + nMix * 0.65));
          alpha *= smoothstep(0.0, 0.25, vUv.y);

          // 云顶暖香槟金受光 + 云底晴空浅蓝
          vec3 col = mix(vec3(0.76, 0.86, 0.97), vec3(1.0, 0.95, 0.84), smoothstep(0.22, 0.82, vUv.y));
          col += vec3(0.22, 0.14, 0.04) * smoothstep(0.62, 0.95, vUv.y);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha * 0.56);
        }
      `
    })
  );

  const geoCloudPuff = trackGeo(new THREE.PlaneGeometry(24, 11));
  for (let i = 0; i < 10; i++) {
    const a = deg2rad(-166 + (i / 9) * 152);
    const r = 37 + (i % 3) * 4.5;
    const puff = new THREE.Mesh(geoCloudPuff, cloudPuffMat);
    const py = -1.6 + (i % 3) * 1.65;
    puff.position.set(Math.cos(a) * r, py, Math.sin(a) * r);
    puff.lookAt(0, py + 1.5, 0);
    puff.scale.set(0.85 + (i % 3) * 0.24, 0.8 + (i % 2) * 0.35, 1);
    group.add(puff);
  }

  // =========================================================================
  // 6. 3D 螺旋风带与苍穹星轨环（Sky Wind Ribbons & Celestial Star-Orbit Ring）
  // =========================================================================
  const windGroup = new THREE.Group();
  windGroup.name = 'sky_wind_ribbons';
  group.add(windGroup);

  function createWindRibbonShader(speed, colorA, colorB, opacity) {
    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uOpacity: { value: opacity }
    };
    shaderUniforms.push(uniforms);

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

            float alpha = (softCross * (0.32 + 0.68 * gust) + coreThread * 0.45) * endFade * uOpacity;
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

  // =========================================================================
  // 实时动画更新（云海流动、浮石漂浮公转、风带流光、晶塔旋转、法阵缓转）
  // =========================================================================
  let disposed = false;

  function update(elapsedSec, dtSec) {
    if (disposed) return;
    const t = Number.isFinite(elapsedSec) ? elapsedSec : 0;
    const dt = Number.isFinite(dtSec) ? Math.min(Math.max(dtSec, 0), 0.1) : 0.016;

    // 1. 更新全部 GLSL 着色器时间（云海、天空卷云、太阳光晕、双层法阵、风丝带、星轨环）
    for (let i = 0; i < shaderUniforms.length; i++) {
      shaderUniforms[i].uTime.value = t;
    }

    // 2. 旋转星霜法阵、底部浮空光环、苍穹星轨环
    for (let i = 0; i < rotatingRings.length; i++) {
      const item = rotatingRings[i];
      item.mesh.rotation[item.axis] += item.speed * dt;
    }

    // 3. 悬浮星晶锥体、圣殿冠核与星晶石塔自转上下浮动
    for (let i = 0; i < floatingCrystals.length; i++) {
      const fc = floatingCrystals[i];
      fc.group.position.y = fc.baseY + Math.sin(t * fc.speed + fc.phase) * fc.amp;
      if (fc.crystal) {
        fc.crystal.rotation.y += fc.spinSpeed * dt;
      }
      if (fc.ringA) {
        fc.ringA.rotation.z += fc.spinSpeed * 1.15 * dt;
        fc.ringA.rotation.y += fc.spinSpeed * 0.45 * dt;
      }
      if (fc.ringB) {
        fc.ringB.rotation.y -= fc.spinSpeed * 0.85 * dt;
        fc.ringB.rotation.x += fc.spinSpeed * 0.35 * dt;
      }
    }

    // 4. 断柱上方悬浮碎石鼓与星晶微浮
    for (let i = 0; i < hoveringDrums.length; i++) {
      const hd = hoveringDrums[i];
      hd.group.position.y = hd.baseY + Math.sin(t * hd.speed + hd.phase) * hd.amp;
      hd.group.rotation.y += hd.rotSpeed * dt;
    }

    // 5. 深渊外围浮空巨石群与小岛上下漂浮 + 微幅优雅公转
    for (let i = 0; i < floatingIslands.length; i++) {
      const fi = floatingIslands[i];
      const curAngle = fi.baseAngle + Math.sin(t * fi.orbitSpeed + fi.phase) * fi.orbitAmp;
      fi.group.position.x = Math.cos(curAngle) * fi.radius;
      fi.group.position.z = Math.sin(curAngle) * fi.radius;
      fi.group.position.y = fi.baseY + Math.sin(t * fi.bobSpeed + fi.phase) * fi.bobAmp;
      fi.group.rotation.y = Math.sin(t * 0.25 + fi.phase) * 0.22;
      fi.group.rotation.z = Math.sin(t * fi.tiltSpeed + fi.phase) * 0.045;
    }

    // 6. 圣坛晶核点光柔和呼吸
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

  return {
    id: 'altar',
    name: '云巅风神祭坛',
    subtitle: '浮空云海 · 星霜神殿',
    group,
    fog: { color: 0xd9e8f9, near: 22, far: 68 },
    background: 0x9ec8f2,
    atmospherePreset: {
      particleType: 'windMotes',
      particleColor: 0xfff2c6,
      particleCount: 420,
      godRayColor: 0xffe8b0,
      godRayOpacity: 0.26,
      godRayOrigin: [0, 16, -14],
      bloomStrength: 0.44,
      bloomThreshold: 0.78,
      bloomRadius: 0.68,
      focusDepth: 0.56,
      blurAmount: 1.65,
      spriteRimTint: [1.03, 1.01, 0.98]
    },
    update,
    dispose
  };
}
