// 圣阿斯拉魔法学院 · 雪庭演武场（Gothic Frost Courtyard）
// HD-2D Flagship 3D Biome — Snow-Porcelain Daylight Gothic Architecture
// Safe combat plane strictly preserved: y = 0 across x in [-8.5, +8.5], z in [-4.2, +4.2]

export function buildAcademyBiome(THREE, texLib = {}) {
  const group = new THREE.Group();
  group.name = 'biome_academy';

  // Resource tracking for clean disposal (never disposes caller-owned texLib textures)
  const ownedTextures = [];
  const ownedGeometries = [];
  const ownedMaterials = [];
  let disposed = false;

  const trackGeo = (g) => {
    ownedGeometries.push(g);
    return g;
  };
  const trackMat = (m) => {
    ownedMaterials.push(m);
    return m;
  };

  // --- Defensive Texture Resolver (supports both raw THREE.Texture and PBR bundle objects) ---
  function unwrapTexBundle(entry) {
    if (!entry) return {};
    if (entry.isTexture) return { map: entry };
    return {
      map: entry.map || entry.colorMap || entry.albedo || null,
      normalMap: entry.normalMap || null,
      bumpMap: entry.bumpMap || null,
      roughnessMap: entry.roughnessMap || null,
      emissiveMap: entry.emissiveMap || null,
      alphaMap: entry.alphaMap || null,
      metalnessMap: entry.metalnessMap || null,
    };
  }

  function cloneRepeat(tex, rx = 1, ry = 1) {
    if (!tex || !tex.isTexture) return null;
    const c = tex.clone();
    c.wrapS = THREE.RepeatWrapping;
    c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    ownedTextures.push(c);
    return c;
  }

  function applyPBRMaps(params, entry, rx = 1, ry = 1, bumpScale = 0.035) {
    const b = unwrapTexBundle(entry);
    if (b.map) params.map = cloneRepeat(b.map, rx, ry);
    if (b.normalMap) {
      params.normalMap = cloneRepeat(b.normalMap, rx, ry);
      params.normalScale = new THREE.Vector2(0.55, 0.55);
    } else if (b.bumpMap) {
      params.bumpMap = cloneRepeat(b.bumpMap, rx, ry);
      params.bumpScale = bumpScale;
    }
    if (b.roughnessMap) params.roughnessMap = cloneRepeat(b.roughnessMap, rx, ry);
    if (b.metalnessMap) params.metalnessMap = cloneRepeat(b.metalnessMap, rx, ry);
    return params;
  }

  // =========================================================================
  // 1. SHARED MATERIALS — Snow-Porcelain, Royal Blue #1658eb, Champagne Gold
  // =========================================================================
  const matCourtyardFloor = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xdbe5f3,
          roughness: 0.78,
          metalness: 0.06,
        },
        texLib.courtyardStone,
        7.5,
        5.2,
        0.04
      )
    )
  );

  const matCloisterWalkway = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xd4e0f0,
          roughness: 0.72,
          metalness: 0.07,
        },
        texLib.courtyardStone,
        6.0,
        2.0,
        0.035
      )
    )
  );

  const matMarble = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xe6eef9,
          roughness: 0.42,
          metalness: 0.06,
        },
        texLib.marble,
        1.5,
        2.0,
        0.022
      )
    )
  );

  // World-UV friendly marble for ExtrudeGeometry pointed arches
  const matMarbleArch = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xe8effa,
          roughness: 0.40,
          metalness: 0.07,
        },
        texLib.marble,
        0.38,
        0.38,
        0.02
      )
    )
  );

  const matMarbleTrim = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xd6e2f2,
          roughness: 0.48,
          metalness: 0.08,
        },
        texLib.marble,
        2.4,
        1.0,
        0.02
      )
    )
  );

  const matCathedralStone = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xdce7f5,
          roughness: 0.56,
          metalness: 0.05,
        },
        texLib.marble,
        2.2,
        3.5,
        0.025
      )
    )
  );

  const matGold = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2c170,
      roughness: 0.28,
      metalness: 0.84,
      emissive: 0x3b2a0a,
      emissiveIntensity: 0.14,
    })
  );

  const matWroughtIron = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a3548,
      roughness: 0.42,
      metalness: 0.78,
    })
  );

  const matRoyalSlateRoof = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c4f8a,
      roughness: 0.52,
      metalness: 0.18,
    })
  );

  const matSnow = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xe7f0fa,
          roughness: 0.74,
          metalness: 0.02,
        },
        texLib.snowGround,
        4.0,
        4.0,
        0.03
      )
    )
  );

  const matSnowField = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xe4eef9,
          roughness: 0.80,
          metalness: 0.02,
        },
        texLib.snowGround,
        16.0,
        16.0,
        0.035
      )
    )
  );

  const matIceCrystal = trackMat(
    new THREE.MeshPhysicalMaterial(
      applyPBRMaps(
        {
          color: 0xb6f2ff,
          emissive: 0x1e94de,
          emissiveIntensity: 0.38,
          roughness: 0.06,
          metalness: 0.05,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          iridescence: 0.68,
          iridescenceIOR: 1.38,
          ior: 1.45,
          reflectivity: 0.94,
          transparent: true,
          opacity: 0.68,
          depthWrite: false,
        },
        texLib.iceCrystal,
        1.0,
        1.8,
        0.018
      )
    )
  );

  // Opaque luminous inner crystal core visible through the semi-transparent beveled outer shell
  const matIceCore = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdcf9ff,
      emissive: 0x42c8ff,
      emissiveIntensity: 0.84,
      roughness: 0.14,
      metalness: 0.04,
      clearcoat: 0.85,
      clearcoatRoughness: 0.10,
    })
  );

  // Crisp translucent icicles for cedar branch tips & carved foreground cornices
  const matIcicle = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdcf7ff,
      emissive: 0x5ccaff,
      emissiveIntensity: 0.24,
      roughness: 0.08,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.78,
    })
  );

  const matBark = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0x5c4c43,
          roughness: 0.88,
          metalness: 0.02,
        },
        texLib.darkBark,
        1.0,
        2.5,
        0.045
      )
    )
  );

  const matPineDeep = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c3f4a,
      roughness: 0.86,
      metalness: 0.02,
      flatShading: true,
    })
  );

  const matPineDark = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a5460,
      roughness: 0.82,
      metalness: 0.02,
      flatShading: true,
    })
  );

  const matPineLight = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b6c79,
      roughness: 0.78,
      metalness: 0.02,
      flatShading: true,
    })
  );

  // Stained Glass — cloister lancets & cathedral rose window
  const stainedBundle = unwrapTexBundle(texLib.stainedGlass);
  const stainedMapCloister = cloneRepeat(stainedBundle.map, 1, 1);
  const matStainedGlass = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbeeff,
      map: stainedMapCloister,
      emissive: new THREE.Color(0x4f8eff),
      emissiveMap: stainedMapCloister,
      emissiveIntensity: 0.92,
      roughness: 0.22,
      metalness: 0.12,
    })
  );

  const stainedMapRose = cloneRepeat(stainedBundle.map, 1, 1);
  const matRoseGlass = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6f4ff,
      map: stainedMapRose,
      emissive: new THREE.Color(0x6ba7ff),
      emissiveMap: stainedMapRose,
      emissiveIntensity: 1.15,
      roughness: 0.18,
      metalness: 0.15,
    })
  );

  const matBelfryGlow = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4aa,
      emissive: 0xffc668,
      emissiveIntensity: 1.05,
      roughness: 0.3,
      metalness: 0.0,
    })
  );

  // Banner Material — double-sided rich royal blue + gold silk
  const bannerBundle = unwrapTexBundle(texLib.bannerFabric);
  const bannerMap = cloneRepeat(bannerBundle.map, 1, 1);
  const matBanner = trackMat(
    new THREE.MeshStandardMaterial({
      color: bannerMap ? 0xffffff : 0x1658eb,
      map: bannerMap,
      bumpMap: cloneRepeat(bannerBundle.bumpMap, 1, 1),
      bumpScale: 0.015,
      roughness: 0.62,
      metalness: 0.14,
      emissive: 0x0b2468,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
    })
  );

  // Glow disc texture for braziers, crystals & arcane aura
  const glowBundle = unwrapTexBundle(texLib.softGlowDisc);
  const glowTex = glowBundle.map || null;

  // =========================================================================
  // 2. LIGHTING RIG — Luminous Winter Daylight + Warm Brazier Counterpoint
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0xd9ecff, 0xd8e2f0, 1.38);
  hemiLight.position.set(0, 28, 0);
  group.add(hemiLight);

  // Key winter sun aligned with upper-left god-ray origin [-7, 13, -10]
  // Casts crisp diagonal Gothic shadows forward-right across the courtyard floor
  const sunLight = new THREE.DirectionalLight(0xfff6e8, 2.25);
  sunLight.position.set(-10.5, 19.5, -9.5);
  sunLight.target.position.set(0.5, 0, 0.5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -16.5;
  sunLight.shadow.camera.right = 16.5;
  sunLight.shadow.camera.top = 15.5;
  sunLight.shadow.camera.bottom = -13.5;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 48.0;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.032;
  group.add(sunLight);
  group.add(sunLight.target);

  // Crisp snow-reflected front-right bounce fill so front architecture & combat zone glow cleanly
  const snowFillLight = new THREE.DirectionalLight(0xe5f1ff, 0.85);
  snowFillLight.position.set(9.5, 9.0, 13.0);
  snowFillLight.castShadow = false;
  group.add(snowFillLight);

  // Soft royal-sky rim accent behind cathedral
  const ambientLight = new THREE.AmbientLight(0xdce8f8, 0.34);
  group.add(ambientLight);

  // Warm corridor firelight fills (dormant at intensity 0 in daylight; activated in fire_corridor moods
  // to keep combatant silhouettes crisp and warmly lit without ever going muddy or dark)
  const corridorFireLights = [];
  for (const fx of [-6.8, 6.8]) {
    const fl = new THREE.PointLight(0xff8a3c, 0.0, 20.0, 1.45);
    fl.position.set(fx, 3.55, 4.85);
    fl.castShadow = false;
    group.add(fl);
    corridorFireLights.push({ light: fl, phase: fx < 0 ? 0.6 : 2.3 });
  }

  // =========================================================================
  // 3. CUSTOM GLSL WINTER SKY DOME & DISTANT ALPINE SNOW PEAKS
  // =========================================================================
  const skyUniforms = {
    uTime: { value: 0 },
    uZenithColor: { value: new THREE.Color(0x3f7de0) },
    uMidSkyColor: { value: new THREE.Color(0x94c4f5) },
    uHorizonColor: { value: new THREE.Color(0xeef5fc) },
    uSunWarmColor: { value: new THREE.Color(0xfff4d9) },
    uLowerMistColor: { value: new THREE.Color(0.84, 0.90, 0.97) },
    uCloudTint: { value: new THREE.Color(0.96, 0.98, 1.0) },
    uSunStrength: { value: 1.0 },
    uSunDir: { value: new THREE.Vector3(-7, 13, -10).normalize() },
  };

  const matSky = trackMat(
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
        uniform float uSunStrength;
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise2D(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            v += amp * noise2D(p);
            p = p * 2.05 + vec2(11.3, 7.7);
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);

          // Luminous winter porcelain-to-cerulean sky gradient
          vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.34, h));
          col = mix(col, uZenithColor, smoothstep(0.28, 0.92, h));

          // Soft lower horizon mist continuity
          if (dir.y < 0.0) {
            col = mix(uHorizonColor, uLowerMistColor, clamp(-dir.y * 3.0, 0.0, 1.0));
          }

          // Directional winter sun halo & Mie glow aligned with godRayOrigin
          float sunDot = max(dot(dir, uSunDir), 0.0);
          float sunHalo = pow(sunDot, 7.0) * 0.28 + pow(sunDot, 42.0) * 0.35;
          float sunCore = smoothstep(0.9965, 0.9994, sunDot) * 0.55;
          col += uSunWarmColor * (sunHalo + sunCore) * uSunStrength;

          // Delicate sunlit cirrus & snow-wisp clouds drifting high in the winter sky
          if (dir.y > 0.03) {
            vec2 uv = dir.xz / (dir.y + 0.26);
            uv.x += uTime * 0.008;
            uv.y -= uTime * 0.003;
            float n = fbm(uv * 1.15);
            float n2 = fbm(uv * 2.2 - vec2(uTime * 0.005, 0.0));
            float cloudMask = smoothstep(0.52, 0.78, n * 0.7 + n2 * 0.3) * smoothstep(0.04, 0.22, dir.y) * smoothstep(0.88, 0.32, dir.y);
            vec3 cloudCol = mix(uCloudTint, uSunWarmColor, pow(sunDot, 3.0) * 0.45);
            col = mix(col, cloudCol, cloudMask * 0.42);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );

  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(96, 40, 24)), matSky);
  skyDome.renderOrder = -10;
  group.add(skyDome);

  // Distant Snow-Capped Alpine Peaks Silhouette (multi-faceted sculpted glacier ridges)
  const matNearPeak = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd5e5f7,
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true,
      fog: true,
    })
  );
  const matNearPeakSnow = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeef5fd,
      roughness: 0.78,
      metalness: 0.02,
      flatShading: true,
      fog: true,
    })
  );
  const matFarPeak = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xc9ddf5,
      vertexColors: true,
      fog: false,
    })
  );
  const matPeakSnowCap = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xeef5fd,
      vertexColors: true,
      fog: false,
    })
  );

  function buildAlpineMountainRange() {
    const mtnGroup = new THREE.Group();
    const alpineSunDir = new THREE.Vector3(-0.56, 0.68, -0.47).normalize();

    function createAlpineRidgePair(rx, rz, height, opts = {}) {
      const radialSegs = opts.radialSegs || 22;
      const rings = opts.rings || 7;
      const ridges = opts.ridges || 5;
      const seed = opts.seed || 0;
      const useVertexShade = opts.vertexShade === true;
      const snowFloor = opts.snowFloor != null ? opts.snowFloor : 0.44;
      const crestX = (opts.crestShiftX != null ? opts.crestShiftX : 0.14) * rx;
      const crestZ = (opts.crestShiftZ != null ? opts.crestShiftZ : -0.08) * rz;
      const subAng = opts.subAng != null ? opts.subAng : seed * 1.9 + 0.8;
      const subH = (opts.subHeight != null ? opts.subHeight : 0.56) * height;
      const subDist = opts.subDist != null ? opts.subDist : 0.48;

      const grid = [];
      for (let r = 0; r <= rings; r++) {
        const t = r / rings; // 0 = summit, 1 = base apron
        const row = [];
        for (let s = 0; s < radialSegs; s++) {
          const ang = (s / radialSegs) * Math.PI * 2;
          // Sharp primary alpine arêtes + jagged secondary spurs
          const primaryRidge = Math.pow(0.5 + 0.5 * Math.cos(ang * ridges + seed), 0.72);
          const secondarySpur =
            0.20 * Math.sin(ang * (ridges * 2 - 1) - seed * 1.4) +
            0.11 * Math.cos(ang * 3 + seed * 2.1);
          const ridgeFactor = 0.74 + 0.34 * primaryRidge + secondarySpur;

          // Asymmetric summit crest offset transitioning smoothly down to base apron
          const summitPull = Math.pow(1 - t, 1.55);
          const radScale = Math.pow(t, 0.92) * (0.86 + 0.28 * primaryRidge + 0.10 * secondarySpur);
          const px = crestX * summitPull + Math.cos(ang) * rx * radScale;
          const pz = crestZ * summitPull + Math.sin(ang) * rz * radScale;

          // Concave alpine horn profile with carved cirque valleys between arêtes
          const baseSlope = Math.pow(1 - t, 1.32);
          const ridgeLift = 1.0 + (ridgeFactor - 0.92) * 0.46 * Math.sin(t * Math.PI);
          let py = height * baseSlope * ridgeLift;

          // Secondary craggy shoulder sub-peak along one flank
          const angDiff = Math.atan2(Math.sin(ang - subAng), Math.cos(ang - subAng));
          const subBump =
            Math.exp(-(angDiff * angDiff) / 0.24) *
            Math.exp(-Math.pow((t - subDist) / 0.22, 2)) *
            subH;
          py += subBump;

          // Craggy faceted rock relief
          const crag =
            (Math.sin(ang * 7 + t * 9 + seed) * 0.032 +
              Math.cos(ang * 11 - t * 6 + seed * 1.3) * 0.020) *
            height *
            Math.sin(t * Math.PI);
          py = Math.max(0, py + crag);

          row.push(new THREE.Vector3(px, py, pz));
        }
        grid.push(row);
      }

      const bodyPos = [];
      const bodyNorm = [];
      const bodyCol = [];
      const snowPos = [];
      const snowNorm = [];
      const snowCol = [];

      const interiorRef = new THREE.Vector3(crestX * 0.4, -height * 0.35, crestZ * 0.4);
      const ab = new THREE.Vector3();
      const ac = new THREE.Vector3();
      const fn = new THREE.Vector3();
      const cent = new THREE.Vector3();
      const outCheck = new THREE.Vector3();

      function pushFacet(targetPos, targetNorm, targetCol, a, b, c, isSnow) {
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        fn.crossVectors(ab, ac);
        const len = fn.length();
        if (len < 1e-6) return;
        fn.divideScalar(len);

        cent.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        outCheck.subVectors(cent, interiorRef);
        let p1 = a;
        let p2 = b;
        let p3 = c;
        if (fn.dot(outCheck) < 0) {
          fn.negate();
          p2 = c;
          p3 = b;
        }

        const lift = isSnow ? 0.11 : 0;
        targetPos.push(
          p1.x + fn.x * lift, p1.y + fn.y * lift, p1.z + fn.z * lift,
          p2.x + fn.x * lift, p2.y + fn.y * lift, p2.z + fn.z * lift,
          p3.x + fn.x * lift, p3.y + fn.y * lift, p3.z + fn.z * lift
        );
        targetNorm.push(
          fn.x, fn.y, fn.z,
          fn.x, fn.y, fn.z,
          fn.x, fn.y, fn.z
        );

        if (useVertexShade) {
          const sunDot = Math.max(0, fn.dot(alpineSunDir));
          const hFrac = Math.min(1, Math.max(0, cent.y / Math.max(1, height)));
          const mistLift = (1 - hFrac) * 0.10;
          if (isSnow) {
            const r = Math.min(1.06, 0.85 + sunDot * 0.20 + mistLift * 0.4);
            const g = Math.min(1.06, 0.89 + sunDot * 0.16 + mistLift * 0.4);
            const bl = Math.min(1.08, 0.95 + sunDot * 0.10 + mistLift * 0.4);
            targetCol.push(r, g, bl, r, g, bl, r, g, bl);
          } else {
            const r = Math.min(1.05, 0.72 + sunDot * 0.30 + mistLift);
            const g = Math.min(1.05, 0.78 + sunDot * 0.25 + mistLift);
            const bl = Math.min(1.08, 0.88 + sunDot * 0.16 + mistLift);
            targetCol.push(r, g, bl, r, g, bl, r, g, bl);
          }
        }
      }

      for (let r = 0; r < rings; r++) {
        for (let s = 0; s < radialSegs; s++) {
          const sNext = (s + 1) % radialSegs;
          const p00 = grid[r][s];
          const p01 = grid[r][sNext];
          const p10 = grid[r + 1][s];
          const p11 = grid[r + 1][sNext];

          const angMid = ((s + 0.5) / radialSegs) * Math.PI * 2;
          // Jagged alpine snowline dips gracefully down sunlit ridges & glacial couloirs
          const snowCut =
            height *
            (snowFloor +
              0.12 * Math.sin(angMid * ridges + seed + 0.6) +
              0.07 * Math.cos(angMid * (ridges * 2 + 1) - seed));

          if (r === 0) {
            pushFacet(bodyPos, bodyNorm, bodyCol, p00, p10, p11, false);
            if ((p00.y + p10.y + p11.y) / 3 > snowCut * 0.75) {
              pushFacet(snowPos, snowNorm, snowCol, p00, p10, p11, true);
            }
          } else {
            pushFacet(bodyPos, bodyNorm, bodyCol, p00, p10, p11, false);
            pushFacet(bodyPos, bodyNorm, bodyCol, p00, p11, p01, false);

            const avgY1 = (p00.y + p10.y + p11.y) / 3;
            const avgY2 = (p00.y + p11.y + p01.y) / 3;
            if (avgY1 > snowCut) {
              pushFacet(snowPos, snowNorm, snowCol, p00, p10, p11, true);
            }
            if (avgY2 > snowCut) {
              pushFacet(snowPos, snowNorm, snowCol, p00, p11, p01, true);
            }
          }
        }
      }

      const bodyGeo = new THREE.BufferGeometry();
      bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPos, 3));
      bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(bodyNorm, 3));
      if (useVertexShade) {
        bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyCol, 3));
      }

      const snowGeo = new THREE.BufferGeometry();
      snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
      snowGeo.setAttribute('normal', new THREE.Float32BufferAttribute(snowNorm, 3));
      if (useVertexShade) {
        snowGeo.setAttribute('color', new THREE.Float32BufferAttribute(snowCol, 3));
      }

      return { bodyGeo: trackGeo(bodyGeo), snowGeo: trackGeo(snowGeo) };
    }

    // Far majestic glacier ridge behind the cathedral (multi-spurred sculpted alpine peaks)
    const farPeaks = [
      { x: -35, z: -44, rx: 16.5, rz: 13.5, h: 21.5, rot: 0.35, ridges: 5, seed: 0.7, subAng: 2.3, subH: 0.58 },
      { x: -20, z: -46, rx: 15.5, rz: 13.0, h: 24.8, rot: 1.05, ridges: 6, seed: 1.9, subAng: -0.9, subH: 0.62 },
      { x: -5, z: -48, rx: 17.0, rz: 14.0, h: 19.8, rot: 0.20, ridges: 5, seed: 3.1, subAng: 1.5, subH: 0.54 },
      { x: 11, z: -47, rx: 16.0, rz: 13.5, h: 25.6, rot: 0.75, ridges: 6, seed: 4.4, subAng: -1.8, subH: 0.60 },
      { x: 25, z: -45, rx: 15.0, rz: 13.0, h: 22.8, rot: 1.45, ridges: 5, seed: 5.6, subAng: 0.8, subH: 0.55 },
      { x: 39, z: -42, rx: 16.0, rz: 13.5, h: 20.6, rot: 0.55, ridges: 5, seed: 6.8, subAng: 2.6, subH: 0.52 },
    ];
    for (const p of farPeaks) {
      const { bodyGeo, snowGeo } = createAlpineRidgePair(p.rx, p.rz, p.h, {
        radialSegs: 22,
        rings: 7,
        ridges: p.ridges,
        seed: p.seed,
        vertexShade: true,
        snowFloor: 0.42,
        subAng: p.subAng,
        subHeight: p.subH,
      });
      const base = new THREE.Mesh(bodyGeo, matFarPeak);
      base.position.set(p.x, -1.8, p.z);
      base.rotation.y = p.rot;
      mtnGroup.add(base);

      const cap = new THREE.Mesh(snowGeo, matPeakSnowCap);
      cap.position.set(p.x, -1.8, p.z);
      cap.rotation.y = p.rot;
      mtnGroup.add(cap);
    }

    // Mid-distance snow foothills catching real directional winter sunlight
    const nearPeaks = [
      { x: -26, z: -31, rx: 12.2, rz: 10.4, h: 13.2, rot: 0.48, ridges: 5, seed: 1.4, subAng: 1.8 },
      { x: -16, z: -34, rx: 10.2, rz: 9.0, h: 11.4, rot: 1.18, ridges: 4, seed: 2.8, subAng: -1.2 },
      { x: 17, z: -33, rx: 11.2, rz: 9.6, h: 12.6, rot: 0.32, ridges: 5, seed: 4.1, subAng: 2.2 },
      { x: 28, z: -30, rx: 12.6, rz: 10.8, h: 13.8, rot: 0.88, ridges: 5, seed: 5.5, subAng: -0.7 },
    ];
    for (const p of nearPeaks) {
      const { bodyGeo, snowGeo } = createAlpineRidgePair(p.rx, p.rz, p.h, {
        radialSegs: 20,
        rings: 6,
        ridges: p.ridges,
        seed: p.seed,
        vertexShade: false,
        snowFloor: 0.48,
        subAng: p.subAng,
        subHeight: 0.50,
      });
      const m = new THREE.Mesh(bodyGeo, matNearPeak);
      m.position.set(p.x, -1.2, p.z);
      m.rotation.y = p.rot;
      mtnGroup.add(m);

      const mSnow = new THREE.Mesh(snowGeo, matNearPeakSnow);
      mSnow.position.set(p.x, -1.2, p.z);
      mSnow.rotation.y = p.rot;
      mtnGroup.add(mSnow);
    }

    group.add(mtnGroup);
  }
  buildAlpineMountainRange();

  // =========================================================================
  // 4. COURTYARD ARENA FLOOR, STEPPED MARBLE CURBING, ARCANE CIRCLE & SNOW
  // =========================================================================
  const groundGroup = new THREE.Group();
  group.add(groundGroup);

  // Outer sweeping snowy academy grounds (no empty edges)
  const outerSnow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(110, 90)), matSnowField);
  outerSnow.rotation.x = -Math.PI / 2;
  outerSnow.position.set(0, -0.22, -10);
  outerSnow.receiveShadow = true;
  groundGroup.add(outerSnow);

  // Main Flat Combat Terrace Slab — TOP STRICTLY AT y = 0.000
  const arenaSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(27.6, 0.6, 17.6)), matCourtyardFloor);
  arenaSlab.position.set(0, -0.3, 0.2);
  arenaSlab.receiveShadow = true;
  groundGroup.add(arenaSlab);

  // Subtle flush inlaid royal dueling perimeter border (y = 0.003, paper-thin flat trim)
  function addFlushInlayBar(w, d, x, z, mat) {
    const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, 0.006, d)), mat);
    bar.position.set(x, 0.003, z);
    bar.receiveShadow = true;
    groundGroup.add(bar);
  }
  // Outer marble inlay frame + thin champagne-gold inner line around safe combat court
  addFlushInlayBar(17.1, 0.24, 0, -4.18, matMarble);
  addFlushInlayBar(17.1, 0.24, 0, 4.18, matMarble);
  addFlushInlayBar(0.24, 8.6, -8.52, 0, matMarble);
  addFlushInlayBar(0.24, 8.6, 8.52, 0, matMarble);

  addFlushInlayBar(16.6, 0.06, 0, -4.02, matGold);
  addFlushInlayBar(16.6, 0.06, 0, 4.02, matGold);
  addFlushInlayBar(0.06, 8.1, -8.32, 0, matGold);
  addFlushInlayBar(0.06, 8.1, 8.32, 0, matGold);

  // Corner royal diamond floor inlays (flush y = 0.004)
  const cornerDiaGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.007, 4));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const dia = new THREE.Mesh(cornerDiaGeo, matGold);
      dia.position.set(sx * 8.32, 0.004, sz * 4.02);
      groundGroup.add(dia);
    }
  }

  // Embedded Royal Arcane Dueling Floor Circle (arcaneFloorDecal)
  const arcaneBundle = unwrapTexBundle(texLib.arcaneFloorDecal);
  const arcaneTex = arcaneBundle.map || null;

  // Static inlaid brass ring framing the magic circle (y = 0.005)
  const outerRingGeo = trackGeo(new THREE.RingGeometry(4.15, 4.30, 64));
  outerRingGeo.rotateX(-Math.PI / 2);
  const matOuterRing = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9bb6e,
      roughness: 0.34,
      metalness: 0.78,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  const outerInlayRing = new THREE.Mesh(outerRingGeo, matOuterRing);
  outerInlayRing.position.set(0, 0.006, -0.1);
  outerInlayRing.receiveShadow = true;
  groundGroup.add(outerInlayRing);

  // Slowly rotating luminous arcane decal layer
  const matArcaneDecal = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x70c7ff,
      map: arcaneTex,
      transparent: true,
      opacity: arcaneTex ? 0.62 : 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  const arcaneCircleMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(8.5, 8.5)), matArcaneDecal);
  arcaneCircleMesh.rotation.x = -Math.PI / 2;
  arcaneCircleMesh.position.set(0, 0.011, -0.1);
  groundGroup.add(arcaneCircleMesh);

  // Counter-rotating delicate inner gold rune ring
  const innerRingGeo = trackGeo(new THREE.RingGeometry(2.55, 2.66, 48));
  innerRingGeo.rotateX(-Math.PI / 2);
  const matInnerArcane = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffe49c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const innerRuneRing = new THREE.Mesh(innerRingGeo, matInnerArcane);
  innerRuneRing.position.set(0, 0.013, -0.1);
  groundGroup.add(innerRuneRing);

  // --- Stepped Raised Cloister Walkways & Curbing (strictly outside safe zone!) ---
  // Back step 1 (z in [-5.18, -4.68], y = 0.17)
  const backStep1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(24.4, 0.17, 0.52)), matMarble);
  backStep1.position.set(0, 0.085, -4.93);
  backStep1.receiveShadow = true;
  backStep1.castShadow = true;
  groundGroup.add(backStep1);

  // Back raised cloister deck (z in [-9.2, -5.18], top at y = 0.34)
  const backDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(28.0, 0.34, 4.02)), matCloisterWalkway);
  backDeck.position.set(0, 0.17, -7.19);
  backDeck.receiveShadow = true;
  groundGroup.add(backDeck);

  // Back deck snow-porcelain marble coping edge (y = 0.34)
  const backCoping = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26.4, 0.09, 0.34)), matMarble);
  backCoping.position.set(0, 0.315, -5.28);
  backCoping.receiveShadow = true;
  groundGroup.add(backCoping);

  // Central Ceremonial Grand Steps leading up to Triumphal Arch (x in [-3.1, +3.1], z in [-5.18, -4.54])
  const grandStepLow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.16, 0.62)), matMarble);
  grandStepLow.position.set(0, 0.08, -4.85);
  grandStepLow.receiveShadow = true;
  grandStepLow.castShadow = true;
  groundGroup.add(grandStepLow);

  const grandStepGoldTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.44, 0.03, 0.05)), matGold);
  grandStepGoldTrim.position.set(0, 0.155, -4.55);
  groundGroup.add(grandStepGoldTrim);

  const grandStepTopTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.44, 0.03, 0.05)), matGold);
  grandStepTopTrim.position.set(0, 0.335, -5.16);
  groundGroup.add(grandStepTopTrim);

  // Left & Right Raised Wing Platforms (|x| >= 9.10, strictly outside |x| <= 8.5 safe area!)
  for (const side of [-1, 1]) {
    const wingStep = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.54, 0.17, 10.1)), matMarble);
    wingStep.position.set(side * 9.37, 0.085, -0.15);
    wingStep.receiveShadow = true;
    wingStep.castShadow = true;
    groundGroup.add(wingStep);

    const wingDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 0.34, 10.6)), matCloisterWalkway);
    wingDeck.position.set(side * 11.82, 0.17, 0.1);
    wingDeck.receiveShadow = true;
    groundGroup.add(wingDeck);

    const wingCoping = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.09, 10.2)), matMarble);
    wingCoping.position.set(side * 9.74, 0.315, -0.05);
    wingCoping.receiveShadow = true;
    groundGroup.add(wingCoping);
  }

  // --- Soft Sculpted Streamlined Wind-Carved Snow Drifts along Courtyard Perimeter ---
  function createSnowDriftGeometry(rx, ry, rz, seed = 0, radialSegs = 22, rings = 8) {
    const positions = [];
    const uvs = [];
    const indices = [];

    // Asymmetric wind-swept crest offset so snowbanks flow naturally rather than bulging as hemispheres
    const windAng = seed * 0.85 + 0.45;
    const crestDx = Math.cos(windAng) * 0.22;
    const crestDz = Math.sin(windAng) * 0.22;

    // Center apex vertex (index 0)
    const apexLift = 1.0 + 0.08 * Math.sin(seed * 2.1);
    positions.push(crestDx * rx, ry * apexLift, crestDz * rz);
    uvs.push(0.5, 0.5);

    for (let r = 1; r <= rings; r++) {
      const f = r / rings; // 0 -> 1 perimeter
      // Smooth bell-curve feathering at the skirt so drift merges tangentially into marble
      const bell = Math.pow(Math.cos(f * Math.PI * 0.5), 1.65);
      const crestWeight = Math.pow(1 - f, 1.5);

      for (let s = 0; s < radialSegs; s++) {
        const ang = (s / radialSegs) * Math.PI * 2;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);

        // Streamlined elliptical lobe deformation + soft sastrugi wind ripples
        const lobe =
          1.0 +
          0.16 * Math.sin(ang * 2 + seed) * (0.35 + 0.65 * f) +
          0.08 * Math.cos(ang * 3 - seed * 1.3) * f;
        const px = (crestDx * crestWeight + cs * f * lobe) * rx;
        const pz = (crestDz * crestWeight + sn * f * lobe) * rz;

        const windRidge = 0.14 * Math.sin(ang * 2 + seed - 0.6) * f * (1 - f);
        const ripple =
          0.065 * Math.sin(cs * f * 4.2 + seed) * Math.cos(sn * f * 3.6 - seed * 0.8) * (1 - f * 0.65);
        const skirtSink = f > 0.92 ? -0.022 * ((f - 0.92) / 0.08) : 0;
        const py = Math.max(-0.025, (bell + windRidge + ripple) * ry + skirtSink);

        positions.push(px, py, pz);
        uvs.push(0.5 + cs * f * 0.5, 0.5 + sn * f * 0.5);
      }
    }

    // Center fan triangles (counter-clockwise looking down from +Y)
    for (let s = 0; s < radialSegs; s++) {
      const sNext = (s + 1) % radialSegs;
      indices.push(0, 1 + sNext, 1 + s);
    }

    // Concentric smooth snowbank rings
    for (let r = 1; r < rings; r++) {
      const rowA = 1 + (r - 1) * radialSegs;
      const rowB = 1 + r * radialSegs;
      for (let s = 0; s < radialSegs; s++) {
        const sNext = (s + 1) % radialSegs;
        indices.push(rowA + s, rowA + sNext, rowB + sNext);
        indices.push(rowA + s, rowB + sNext, rowB + s);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return trackGeo(g);
  }

  const snowDriftSpecs = [
    // Along back marble curb flanking the central steps (strictly z <= -5.05)
    { x: -5.0, y: 0.12, z: -5.15, rx: 1.65, ry: 0.34, rz: 0.56, s: 1.1 },
    { x: 5.0, y: 0.12, z: -5.15, rx: 1.65, ry: 0.34, rz: 0.56, s: 2.3 },
    { x: -8.2, y: 0.16, z: -5.22, rx: 1.95, ry: 0.40, rz: 0.66, s: 3.7 },
    { x: 8.2, y: 0.16, z: -5.22, rx: 1.95, ry: 0.40, rz: 0.66, s: 4.9 },
    // Along left & right wing steps (strictly |x| >= 9.35)
    { x: -9.65, y: 0.14, z: -4.1, rx: 0.68, ry: 0.35, rz: 1.62, s: 5.2 },
    { x: 9.65, y: 0.14, z: -4.1, rx: 0.68, ry: 0.35, rz: 1.62, s: 6.4 },
    { x: -9.85, y: 0.16, z: 0.2, rx: 0.58, ry: 0.30, rz: 1.48, s: 7.1 },
    { x: 9.85, y: 0.16, z: 0.2, rx: 0.58, ry: 0.30, rz: 1.48, s: 8.3 },
    { x: -10.2, y: 0.20, z: 4.55, rx: 1.52, ry: 0.42, rz: 1.18, s: 9.5 },
    { x: 10.2, y: 0.20, z: 4.55, rx: 1.52, ry: 0.42, rz: 1.18, s: 10.7 },
    // Outer courtyard soft snow banks
    { x: -14.5, y: -0.1, z: -4.0, rx: 3.3, ry: 0.76, rz: 4.3, s: 11.2 },
    { x: 14.5, y: -0.1, z: -4.0, rx: 3.3, ry: 0.76, rz: 4.3, s: 12.6 },
    { x: -13.8, y: -0.1, z: 6.8, rx: 3.1, ry: 0.60, rz: 2.6, s: 13.4 },
    { x: 13.8, y: -0.1, z: 6.8, rx: 3.1, ry: 0.60, rz: 2.6, s: 14.8 },
  ];
  for (const d of snowDriftSpecs) {
    const drift = new THREE.Mesh(createSnowDriftGeometry(d.rx, d.ry, d.rz, d.s), matSnow);
    drift.position.set(d.x, d.y, d.z);
    drift.receiveShadow = true;
    groundGroup.add(drift);
  }

  // =========================================================================
  // 5. AAA DUAL-LAYER ASYMMETRIC FROST CRYSTAL CLUSTERS
  //    (Glowing Clear Inner Core + Beveled Refracting Outer Shell + Ice Splinters)
  // =========================================================================
  function createAsymmetricCrystalGeo(radius, height, sides = 6, seed = 0, opts = {}) {
    const positions = [];
    const normals = [];
    const uvs = [];

    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const fn = new THREE.Vector3();
    const cent = new THREE.Vector3();
    const axisRef = new THREE.Vector3();
    const outVec = new THREE.Vector3();

    function pushFacet(a, b, c, uva, uvb, uvc) {
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      fn.crossVectors(ab, ac);
      const len = fn.length();
      if (len < 1e-7) return;
      fn.divideScalar(len);

      cent.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      axisRef.set(0, Math.min(height * 0.55, cent.y * 0.85), 0);
      outVec.subVectors(cent, axisRef);
      let p1 = a;
      let p2 = b;
      let p3 = c;
      let u1 = uva;
      let u2 = uvb;
      let u3 = uvc;
      if (fn.dot(outVec) < 0) {
        fn.negate();
        p2 = c;
        p3 = b;
        u2 = uvc;
        u3 = uvb;
      }
      positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      normals.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
      uvs.push(u1[0], u1[1], u2[0], u2[1], u3[0], u3[1]);
    }

    const chiselAng = opts.chiselAng != null ? opts.chiselAng : seed * 1.3 + 0.5;
    const chiselX = Math.cos(chiselAng) * radius * (opts.apexOffset != null ? opts.apexOffset : 0.34);
    const chiselZ = Math.sin(chiselAng) * radius * (opts.apexOffset != null ? opts.apexOffset : 0.34);
    const leanX = Math.cos(chiselAng + 0.4) * radius * 0.16;
    const leanZ = Math.sin(chiselAng + 0.4) * radius * 0.16;

    const ringBot = [];
    const ringMid = [];
    const ringShoulder = [];
    const ringBevel = [];

    for (let i = 0; i < sides; i++) {
      const baseAng = (i / sides) * Math.PI * 2;
      const angJitter = Math.sin(i * 2.7 + seed * 1.9) * 0.14;
      const ang = baseAng + angJitter;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);

      // Irregular natural quartz face widths
      const rVar = 0.82 + 0.34 * (0.5 + 0.5 * Math.sin(i * 1.9 + seed * 2.3));
      const rBot = radius * rVar * 1.06;
      const rMid = radius * rVar * (0.98 + 0.06 * Math.cos(i + seed));
      const rSh = radius * rVar * 0.80;
      const rBev = radius * rVar * 0.34;

      // Oblique shoulder cut — faces aligned with chisel direction terminate higher for dramatic bevels
      const align = cs * Math.cos(chiselAng) + sn * Math.sin(chiselAng);
      const shFrac = Math.min(0.84, Math.max(0.58, 0.70 + align * 0.11 + 0.04 * Math.sin(i * 3.1 + seed)));
      const bevFrac = Math.min(0.95, shFrac + 0.15 + 0.03 * Math.cos(i * 2.1 - seed));

      ringBot.push(new THREE.Vector3(cs * rBot, -0.02, sn * rBot));
      ringMid.push(new THREE.Vector3(cs * rMid + leanX * 0.4, height * 0.34, sn * rMid + leanZ * 0.4));
      ringShoulder.push(new THREE.Vector3(cs * rSh + leanX, height * shFrac, sn * rSh + leanZ));
      ringBevel.push(
        new THREE.Vector3(
          cs * rBev + chiselX * 0.72 + leanX * 0.6,
          height * bevFrac,
          sn * rBev + chiselZ * 0.72 + leanZ * 0.6
        )
      );
    }

    const apex = new THREE.Vector3(chiselX * 1.15 + leanX * 0.5, height, chiselZ * 1.15 + leanZ * 0.5);

    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const u0 = i / sides;
      const u1 = (i + 1) / sides;
      const uMid = (u0 + u1) * 0.5;

      // Lower shaft faceted quad
      pushFacet(ringBot[j], ringBot[i], ringMid[i], [u1, 0.0], [u0, 0.0], [u0, 0.34]);
      pushFacet(ringBot[j], ringMid[i], ringMid[j], [u1, 0.0], [u0, 0.34], [u1, 0.34]);

      // Upper shaft tapering to staggered oblique shoulders
      pushFacet(ringMid[j], ringMid[i], ringShoulder[i], [u1, 0.34], [u0, 0.34], [u0, 0.72]);
      pushFacet(ringMid[j], ringShoulder[i], ringShoulder[j], [u1, 0.34], [u0, 0.72], [u1, 0.72]);

      // Oblique bevel crown facets
      pushFacet(ringShoulder[j], ringShoulder[i], ringBevel[i], [u1, 0.72], [u0, 0.72], [u0, 0.90]);
      pushFacet(ringShoulder[j], ringBevel[i], ringBevel[j], [u1, 0.72], [u0, 0.90], [u1, 0.90]);

      // Sharp oblique chisel apex facet
      pushFacet(ringBevel[j], ringBevel[i], apex, [u1, 0.90], [u0, 0.90], [uMid, 1.0]);
    }

    const crystalGeo = new THREE.BufferGeometry();
    crystalGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    crystalGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    crystalGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return trackGeo(crystalGeo);
  }

  // Sharp jagged diamond-wedge splinter for base shattered ice thorns
  function createIceSplinterGeo(rx, rz, height, seed = 0) {
    return createAsymmetricCrystalGeo(Math.max(rx, rz), height, 5, seed, { apexOffset: 0.42 });
  }

  const crystalOuterBig = createAsymmetricCrystalGeo(0.22, 1.48, 7, 1.1, { chiselAng: 0.55, apexOffset: 0.36 });
  const crystalCoreBig = createAsymmetricCrystalGeo(0.125, 1.16, 7, 1.1, { chiselAng: 0.55, apexOffset: 0.34 });

  const crystalOuterMedA = createAsymmetricCrystalGeo(0.165, 1.04, 6, 2.7, { chiselAng: 2.1, apexOffset: 0.38 });
  const crystalCoreMedA = createAsymmetricCrystalGeo(0.092, 0.80, 6, 2.7, { chiselAng: 2.1, apexOffset: 0.35 });

  const crystalOuterMedB = createAsymmetricCrystalGeo(0.155, 0.92, 6, 4.3, { chiselAng: -1.1, apexOffset: 0.35 });
  const crystalCoreMedB = createAsymmetricCrystalGeo(0.086, 0.70, 6, 4.3, { chiselAng: -1.1, apexOffset: 0.32 });

  const crystalOuterSml = createAsymmetricCrystalGeo(0.115, 0.64, 6, 5.9, { chiselAng: 1.4, apexOffset: 0.40 });
  const crystalCoreSml = createAsymmetricCrystalGeo(0.062, 0.48, 6, 5.9, { chiselAng: 1.4, apexOffset: 0.36 });

  const crystalSplinterA = createIceSplinterGeo(0.068, 0.048, 0.42, 3.2);
  const crystalSplinterB = createIceSplinterGeo(0.052, 0.038, 0.30, 7.1);
  const geoCrystalSnowCollar = createSnowDriftGeometry(0.76, 0.18, 0.72, 8.4);

  const matIceAura = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x7ae2ff,
      map: glowTex,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const auraPlaneGeo = trackGeo(new THREE.PlaneGeometry(1.25, 1.25));

  const crystalClusterRefs = [];

  function addFrostCrystalCluster(x, y, z, scale = 1.0, rotY = 0) {
    const cluster = new THREE.Group();
    cluster.position.set(x, y, z);
    cluster.rotation.y = rotY;
    cluster.scale.setScalar(scale);

    // Sculpted streamlined snow-rime cushion cradling the crystal base
    const snowCollar = new THREE.Mesh(geoCrystalSnowCollar, matSnow);
    snowCollar.position.set(0, -0.04, 0);
    snowCollar.receiveShadow = true;
    cluster.add(snowCollar);

    // Asymmetric dual-layer main & secondary crystal spires (opaque glowing core + translucent refracting shell)
    const shardLayout = [
      { outer: crystalOuterBig, core: crystalCoreBig, px: 0.0, pz: 0.0, rx: 0.07, rz: -0.08, ry: 0.25, s: 1.02 },
      { outer: crystalOuterMedA, core: crystalCoreMedA, px: 0.24, pz: 0.15, rx: 0.24, rz: -0.35, ry: 1.15, s: 0.96 },
      { outer: crystalOuterMedB, core: crystalCoreMedB, px: -0.25, pz: 0.12, rx: 0.21, rz: 0.37, ry: 2.35, s: 0.90 },
      { outer: crystalOuterSml, core: crystalCoreSml, px: 0.08, pz: -0.25, rx: -0.36, rz: -0.11, ry: 0.75, s: 1.04 },
      { outer: crystalOuterSml, core: crystalCoreSml, px: -0.20, pz: -0.20, rx: -0.28, rz: 0.44, ry: 3.10, s: 0.86 },
      { outer: crystalOuterSml, core: null, px: 0.32, pz: -0.12, rx: -0.20, rz: -0.48, ry: 1.85, s: 0.78 },
    ];

    for (const s of shardLayout) {
      if (s.core) {
        const coreMesh = new THREE.Mesh(s.core, matIceCore);
        coreMesh.position.set(s.px, -0.02, s.pz);
        coreMesh.rotation.set(s.rx, s.ry, s.rz);
        coreMesh.scale.setScalar(s.s);
        cluster.add(coreMesh);
      }

      const outerMesh = new THREE.Mesh(s.outer, matIceCrystal);
      outerMesh.position.set(s.px, -0.05, s.pz);
      outerMesh.rotation.set(s.rx, s.ry, s.rz);
      outerMesh.scale.setScalar(s.s);
      outerMesh.castShadow = true;
      outerMesh.renderOrder = 2;
      cluster.add(outerMesh);
    }

    // Radiating shattered base ice splinters & frost thorns
    const splinterCount = 10;
    for (let k = 0; k < splinterCount; k++) {
      const ang = (k / splinterCount) * Math.PI * 2 + (k % 2) * 0.22;
      const dist = 0.26 + (k % 3) * 0.10;
      const tilt = 0.62 + (k % 3) * 0.20;
      const spGeo = k % 2 === 0 ? crystalSplinterA : crystalSplinterB;
      const spMat = k % 3 === 0 ? matIceCore : matIceCrystal;
      const sp = new THREE.Mesh(spGeo, spMat);
      sp.position.set(Math.cos(ang) * dist, -0.03, Math.sin(ang) * dist);
      sp.rotation.set(Math.sin(ang) * tilt, -ang, -Math.cos(ang) * tilt);
      sp.scale.setScalar(0.82 + (k % 4) * 0.14);
      if (spMat === matIceCrystal) sp.renderOrder = 2;
      cluster.add(sp);
    }

    // Soft cyan ground ice shimmer beneath crystals
    const aura = new THREE.Mesh(auraPlaneGeo, matIceAura);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    cluster.add(aura);

    group.add(cluster);
    crystalClusterRefs.push({ aura, phase: x * 0.7 + z * 0.5 });
  }

  // Placed strictly outside central combat zone (x in [-5.2, 5.2], z in [-3.2, 3.2]) while cleanly framed in 34° FOV
  addFrostCrystalCluster(-7.10, 0.00, -3.65, 0.98, 0.65);
  addFrostCrystalCluster(7.10, 0.00, -3.65, 0.98, -0.65);
  addFrostCrystalCluster(-5.35, 0.00, -4.25, 0.84, 0.95);
  addFrostCrystalCluster(5.35, 0.00, -4.25, 0.84, -0.95);
  addFrostCrystalCluster(-4.05, 0.34, -5.48, 0.78, 0.4);
  addFrostCrystalCluster(4.05, 0.34, -5.48, 0.78, -0.4);

  // =========================================================================
  // 6. ROYAL GOTHIC COLONNADE — Multi-Part Columns, True Pointed Arches,
  //    Stained Glass Lancet Windows, Balustrades & Snow-Dusted Cornices
  // =========================================================================
  const archGroup = new THREE.Group();
  group.add(archGroup);

  const BAY_W = 3.2;
  const COL_BASE_Y = 0.34;
  const ARCH_SPRING_Y = 3.35; // column capital top above deck
  const CORNICE_Y = 5.45; // top of main arcade spandrel above deck

  // --- Shared Multi-Part Fluted Gothic Pier Builder (Classical Moldings + Acanthus Crown) ---
  const geoPlinthLow = trackGeo(new THREE.BoxGeometry(0.88, 0.28, 0.88));
  const geoPlinthMid = trackGeo(new THREE.BoxGeometry(0.74, 0.18, 0.74));

  // Classical Attic Base Molding (Torus -> Scotia -> Upper Torus) via LatheGeometry
  const geoAtticBase = (() => {
    const pts = [
      [0.37, 0.00], [0.39, 0.035], [0.36, 0.07], [0.30, 0.105],
      [0.29, 0.135], [0.33, 0.165], [0.32, 0.195], [0.275, 0.22],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 16);
    g.computeVertexNormals();
    return trackGeo(g);
  })();

  const geoBaseRing = trackGeo(new THREE.TorusGeometry(0.29, 0.034, 8, 18));
  geoBaseRing.rotateX(Math.PI / 2);
  const geoShaftCore = trackGeo(new THREE.CylinderGeometry(0.24, 0.268, 2.38, 16));
  const geoColonnette = trackGeo(new THREE.CylinderGeometry(0.068, 0.074, 2.36, 10));
  const geoMidAnnuletStone = trackGeo(new THREE.TorusGeometry(0.278, 0.044, 8, 18));
  geoMidAnnuletStone.rotateX(Math.PI / 2);
  const geoMidAnnuletGold = trackGeo(new THREE.TorusGeometry(0.305, 0.018, 6, 18));
  geoMidAnnuletGold.rotateX(Math.PI / 2);

  // Carved Capital Necking & Flared Corinthian/Gothic Bell via LatheGeometry
  const geoCapNeck = (() => {
    const pts = [
      [0.245, 0.00], [0.285, 0.025], [0.295, 0.045], [0.265, 0.07], [0.242, 0.095],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 16);
    g.computeVertexNormals();
    return trackGeo(g);
  })();

  const geoGoldCollar = trackGeo(new THREE.TorusGeometry(0.275, 0.028, 8, 18));
  geoGoldCollar.rotateX(Math.PI / 2);

  const geoCapBell = (() => {
    const pts = [
      [0.240, 0.00], [0.252, 0.05], [0.285, 0.12], [0.338, 0.19],
      [0.398, 0.25], [0.432, 0.285], [0.415, 0.31],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 16);
    g.computeVertexNormals();
    return trackGeo(g);
  })();

  // Sculpted Acanthus-Leaf Collar Crown (4 tall corner volute leaves + 4 cardinal carved leaves)
  function createAcanthusCrownGeo() {
    const positions = [];
    const normals = [];
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const fn = new THREE.Vector3();
    const cent = new THREE.Vector3();
    const outRef = new THREE.Vector3();

    function pushLeafTri(a, b, c) {
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      fn.crossVectors(ab, ac);
      const len = fn.length();
      if (len < 1e-7) return;
      fn.divideScalar(len);
      cent.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      outRef.set(cent.x, 0, cent.z);
      let p1 = a;
      let p2 = b;
      let p3 = c;
      if (fn.dot(outRef) < 0) {
        fn.negate();
        p2 = c;
        p3 = b;
      }
      positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      normals.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
    }

    const leaves = [];
    // 4 taller diagonal corner leaves curving outward beneath abacus corners
    for (let i = 0; i < 4; i++) {
      leaves.push({ ang: i * (Math.PI / 2) + Math.PI / 4, h: 0.30, w: 0.135, rBase: 0.255, flare: 0.22 });
    }
    // 4 cardinal mid-face acanthus leaves forming lower sculpted crown
    for (let i = 0; i < 4; i++) {
      leaves.push({ ang: i * (Math.PI / 2), h: 0.23, w: 0.125, rBase: 0.268, flare: 0.145 });
    }

    const vSegs = 5;
    for (const lf of leaves) {
      const ca = Math.cos(lf.ang);
      const sa = Math.sin(lf.ang);
      const tx = -sa;
      const tz = ca;

      const leftPts = [];
      const midPts = [];
      const rightPts = [];

      for (let v = 0; v <= vSegs; v++) {
        const t = v / vSegs;
        // Graceful S-curve flare + outward curled acanthus tip
        const r = lf.rBase + lf.flare * Math.pow(t, 1.35) + (t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI) * 0.045 : 0);
        const y = t * lf.h - (t > 0.85 ? (t - 0.85) * 0.18 : 0);
        // Sculpted acanthus leaf silhouette (wide serrated lobe tapering to curled point)
        const halfW = lf.w * Math.sin(Math.pow(t, 0.72) * Math.PI * 0.92 + 0.18) * (1.0 - 0.32 * t);
        const ridgePop = 0.032 * Math.sin(t * Math.PI);

        const cx = ca * r;
        const cz = sa * r;
        const mx = ca * (r + ridgePop);
        const mz = sa * (r + ridgePop);

        leftPts.push(new THREE.Vector3(cx - tx * halfW, y, cz - tz * halfW));
        midPts.push(new THREE.Vector3(mx, y + 0.006, mz));
        rightPts.push(new THREE.Vector3(cx + tx * halfW, y, cz + tz * halfW));
      }

      for (let v = 0; v < vSegs; v++) {
        // Left faceted half of acanthus leaf (midrib creates crisp shadow crease!)
        pushLeafTri(leftPts[v], midPts[v], midPts[v + 1]);
        pushLeafTri(leftPts[v], midPts[v + 1], leftPts[v + 1]);
        // Right faceted half of acanthus leaf
        pushLeafTri(midPts[v], rightPts[v], rightPts[v + 1]);
        pushLeafTri(midPts[v], rightPts[v + 1], midPts[v + 1]);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return trackGeo(g);
  }

  const geoAcanthusCrown = createAcanthusCrownGeo();
  const geoAbacusLower = trackGeo(new THREE.BoxGeometry(0.76, 0.065, 0.76));
  const geoAbacusGold = trackGeo(new THREE.BoxGeometry(0.82, 0.024, 0.82));
  const geoAbacusUpper = trackGeo(new THREE.BoxGeometry(0.90, 0.095, 0.90));

  // Stepped Crocketed Gothic Pinnacle
  const geoPinnaclePlinth = trackGeo(new THREE.BoxGeometry(0.46, 0.16, 0.46));
  const geoPinnacleShaft = trackGeo(new THREE.CylinderGeometry(0.135, 0.21, 1.24, 8));
  const geoPinnacleCrown = trackGeo(new THREE.CylinderGeometry(0.24, 0.15, 0.18, 8));
  const geoPinnacleSpire = trackGeo(new THREE.ConeGeometry(0.185, 0.92, 8));
  const geoPinnacleBand = trackGeo(new THREE.TorusGeometry(0.15, 0.022, 6, 12));
  geoPinnacleBand.rotateX(Math.PI / 2);
  const geoFinialOrb = trackGeo(new THREE.OctahedronGeometry(0.105, 0));

  function buildGothicColumn(x, y, z, scaleXZ = 1.0, addPinnacle = true, pinnacleBaseH = CORNICE_Y) {
    const col = new THREE.Group();
    col.position.set(x, y, z);

    const pLow = new THREE.Mesh(geoPlinthLow, matMarbleTrim);
    pLow.position.y = 0.14;
    pLow.scale.set(scaleXZ, 1, scaleXZ);
    pLow.castShadow = true;
    pLow.receiveShadow = true;
    col.add(pLow);

    const pMid = new THREE.Mesh(geoPlinthMid, matMarble);
    pMid.position.y = 0.37;
    pMid.scale.set(scaleXZ, 1, scaleXZ);
    pMid.castShadow = true;
    pMid.receiveShadow = true;
    col.add(pMid);

    // Molded Attic stone base collar
    const attic = new THREE.Mesh(geoAtticBase, matMarbleTrim);
    attic.position.y = 0.46;
    attic.scale.set(scaleXZ, 1, scaleXZ);
    col.add(attic);

    const bRing = new THREE.Mesh(geoBaseRing, matGold);
    bRing.position.y = 0.65;
    bRing.scale.setScalar(scaleXZ);
    col.add(bRing);

    const shaft = new THREE.Mesh(geoShaftCore, matMarble);
    shaft.position.y = 1.84;
    shaft.scale.set(scaleXZ, 1, scaleXZ);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    col.add(shaft);

    // 4 attached gothic cluster colonnettes for crisp fluted silhouette
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const sub = new THREE.Mesh(geoColonnette, matMarbleTrim);
      sub.position.set(Math.cos(ang) * 0.245 * scaleXZ, 1.84, Math.sin(ang) * 0.245 * scaleXZ);
      sub.scale.set(scaleXZ, 1, scaleXZ);
      col.add(sub);
    }

    // Gothic mid-shaft carved annulet & gold hairline binding the cluster shafts
    const midAnn = new THREE.Mesh(geoMidAnnuletStone, matMarbleTrim);
    midAnn.position.y = 1.84;
    midAnn.scale.setScalar(scaleXZ);
    col.add(midAnn);

    const midGold = new THREE.Mesh(geoMidAnnuletGold, matGold);
    midGold.position.y = 1.84;
    midGold.scale.setScalar(scaleXZ);
    col.add(midGold);

    // Multi-layered carved capital: astragal necking -> gold collar -> flared bell -> acanthus foliage crown -> stepped abacus
    const capNeck = new THREE.Mesh(geoCapNeck, matMarbleTrim);
    capNeck.position.y = 2.98;
    capNeck.scale.set(scaleXZ, 1, scaleXZ);
    col.add(capNeck);

    const neckGold = new THREE.Mesh(geoGoldCollar, matGold);
    neckGold.position.y = 3.035;
    neckGold.scale.setScalar(scaleXZ);
    col.add(neckGold);

    const bell = new THREE.Mesh(geoCapBell, matMarble);
    bell.position.y = 3.05;
    bell.scale.set(scaleXZ, 1, scaleXZ);
    bell.castShadow = true;
    col.add(bell);

    const acanthus = new THREE.Mesh(geoAcanthusCrown, matMarbleTrim);
    acanthus.position.y = 3.055;
    acanthus.scale.set(scaleXZ, 1, scaleXZ);
    acanthus.castShadow = true;
    col.add(acanthus);

    const abacusLow = new THREE.Mesh(geoAbacusLower, matMarble);
    abacusLow.position.y = 3.36;
    abacusLow.scale.set(scaleXZ, 1, scaleXZ);
    col.add(abacusLow);

    const abacusGold = new THREE.Mesh(geoAbacusGold, matGold);
    abacusGold.position.y = 3.40;
    abacusGold.scale.set(scaleXZ, 1, scaleXZ);
    col.add(abacusGold);

    const abacusTop = new THREE.Mesh(geoAbacusUpper, matMarbleTrim);
    abacusTop.position.y = 3.45;
    abacusTop.scale.set(scaleXZ, 1, scaleXZ);
    abacusTop.castShadow = true;
    col.add(abacusTop);

    if (addPinnacle) {
      const pinBase = new THREE.Mesh(geoPinnaclePlinth, matMarbleTrim);
      pinBase.position.y = pinnacleBaseH + 0.16;
      col.add(pinBase);

      const pin = new THREE.Mesh(geoPinnacleShaft, matMarble);
      pin.position.y = pinnacleBaseH + 0.82;
      pin.castShadow = true;
      col.add(pin);

      const pinCrown = new THREE.Mesh(geoPinnacleCrown, matMarbleTrim);
      pinCrown.position.y = pinnacleBaseH + 1.46;
      col.add(pinCrown);

      const pinBand = new THREE.Mesh(geoPinnacleBand, matGold);
      pinBand.position.y = pinnacleBaseH + 1.54;
      col.add(pinBand);

      const spire = new THREE.Mesh(geoPinnacleSpire, matRoyalSlateRoof);
      spire.position.y = pinnacleBaseH + 1.98;
      spire.castShadow = true;
      col.add(spire);

      const orb = new THREE.Mesh(geoFinialOrb, matGold);
      orb.position.y = pinnacleBaseH + 2.48;
      col.add(orb);
    }

    archGroup.add(col);
    return col;
  }

  // --- True Two-Centered Pointed Ogival Gothic Arch Bay (ExtrudeGeometry) ---
  function createPointedArchSpandrelGeo(bayWidth, archSpanW, archPeakH, totalH, depth) {
    const hw = bayWidth * 0.5;
    const sw = archSpanW * 0.5;
    // Two-centered pointed Gothic arch math:
    // Left arc center at (cx, 0) where cx = sw - R, passing through (-sw, 0) and (0, archPeakH)
    // Solving R^2 = (sw - cx)^2? Actually center at (+cx, 0) for left arc:
    // distance to (-sw, 0) = sw + cx = R; distance to (0, h) = sqrt(cx^2 + h^2) = R
    // => (sw + cx)^2 = cx^2 + h^2 => sw^2 + 2*sw*cx = h^2 => cx = (h^2 - sw^2) / (2*sw)
    const h = Math.max(archPeakH, sw * 1.15);
    const cx = (h * h - sw * sw) / (2 * sw);
    const R = sw + cx;
    const apexAngle = Math.atan2(h, cx);

    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(-sw, 0);

    // Left pointed arc rising from (-sw, 0) to (0, h), centered at (+cx, 0)
    const segs = 14;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const ang = Math.PI - t * apexAngle;
      shape.lineTo(cx + Math.cos(ang) * R, Math.sin(ang) * R);
    }
    // Right pointed arc descending from (0, h) to (+sw, 0), centered at (-cx, 0)
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const ang = apexAngle * (1 - t);
      shape.lineTo(-cx + Math.cos(ang) * R, Math.sin(ang) * R);
    }

    shape.lineTo(hw, 0);
    shape.lineTo(hw, totalH);
    shape.lineTo(-hw, totalH);
    shape.closePath();

    // Decorative circular oculus tracery cutout in spandrel cheeks
    for (const side of [-1, 1]) {
      const oculus = new THREE.Path();
      oculus.absarc(side * (hw - 0.38), totalH - 0.44, 0.16, 0, Math.PI * 2, true);
      shape.holes.push(oculus);
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 14,
    });
    geo.translate(0, 0, -depth * 0.5);
    return trackGeo(geo);
  }

  // Pointed Gothic Lancet Window Geometry with Normalized [0, 1] UVs for stainedGlass
  function createPointedLancetWindowGeo(width, springH, peakExtraH) {
    const sw = width * 0.5;
    const h = Math.max(peakExtraH, sw * 1.18);
    const cx = (h * h - sw * sw) / (2 * sw);
    const R = sw + cx;
    const apexAngle = Math.atan2(h, cx);

    const shape = new THREE.Shape();
    shape.moveTo(-sw, 0);
    shape.lineTo(-sw, springH);

    const segs = 12;
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

    const geo = new THREE.ShapeGeometry(shape, 12);
    const totalH = springH + h;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      uv.setXY(i, (px + sw) / width, py / totalH);
    }
    uv.needsUpdate = true;
    return trackGeo(geo);
  }

  const geoBayArch = createPointedArchSpandrelGeo(BAY_W, 2.44, 1.56, 2.08, 0.54);
  const geoCenterArch = createPointedArchSpandrelGeo(BAY_W, 2.52, 1.92, 2.65, 0.66);
  const geoKeystone = trackGeo(new THREE.OctahedronGeometry(0.18, 0));
  const geoLancetGlass = createPointedLancetWindowGeo(1.72, 2.45, 1.38);
  const geoMullionV = trackGeo(new THREE.BoxGeometry(0.065, 3.65, 0.09));
  const geoMullionH = trackGeo(new THREE.BoxGeometry(1.74, 0.065, 0.09));
  const geoTraceryRing = trackGeo(new THREE.TorusGeometry(0.32, 0.038, 6, 16));

  function buildStainedLancetAssembly(x, y, z, rotY) {
    const win = new THREE.Group();
    win.position.set(x, y, z);
    win.rotation.y = rotY;

    const glass = new THREE.Mesh(geoLancetGlass, matStainedGlass);
    win.add(glass);

    // Stone lancet mullions & Gothic rose tracery bar
    const mV = new THREE.Mesh(geoMullionV, matMarbleTrim);
    mV.position.set(0, 1.82, 0.04);
    win.add(mV);

    const mH1 = new THREE.Mesh(geoMullionH, matMarbleTrim);
    mH1.position.set(0, 1.25, 0.04);
    win.add(mH1);

    const mH2 = new THREE.Mesh(geoMullionH, matMarbleTrim);
    mH2.position.set(0, 2.42, 0.04);
    win.add(mH2);

    const tRing = new THREE.Mesh(geoTraceryRing, matGold);
    tRing.position.set(0, 2.98, 0.05);
    win.add(tRing);

    // Window sill ledge + snow cushion
    const sill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.05, 0.16, 0.34)), matMarble);
    sill.position.set(0, -0.06, 0.08);
    win.add(sill);

    archGroup.add(win);
  }

  // --- Back Colonnade (z = -6.2, 7 Bays spanning x = -11.2 .. +11.2) ---
  const backColXs = [-11.2, -8.0, -4.8, -1.6, 1.6, 4.8, 8.0, 11.2];
  for (let i = 0; i < backColXs.length; i++) {
    const cx = backColXs[i];
    const isPortalPier = Math.abs(cx) < 2.0;
    const isCornerPier = Math.abs(cx) > 10.5;
    buildGothicColumn(
      cx,
      COL_BASE_Y,
      -6.2,
      isPortalPier || isCornerPier ? 1.15 : 1.0,
      true,
      isPortalPier ? CORNICE_Y + 0.62 : CORNICE_Y
    );
  }

  // Back Arcade Pointed Arches (7 bays)
  for (let b = 0; b < 7; b++) {
    const bx = (backColXs[b] + backColXs[b + 1]) * 0.5;
    const isCenter = b === 3;
    const archMesh = new THREE.Mesh(isCenter ? geoCenterArch : geoBayArch, matMarbleArch);
    archMesh.position.set(bx, COL_BASE_Y + ARCH_SPRING_Y, -6.2);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    archGroup.add(archMesh);

    // Gilded keystone emblem at the pointed apex
    const ks = new THREE.Mesh(geoKeystone, matGold);
    ks.position.set(bx, COL_BASE_Y + ARCH_SPRING_Y + (isCenter ? 2.02 : 1.64), -5.88);
    ks.scale.set(0.95, 1.25, 0.55);
    archGroup.add(ks);

    // Recessed back wall stained-glass lancets (skip center portal to frame distant cathedral rose window!)
    if (!isCenter) {
      buildStainedLancetAssembly(bx, COL_BASE_Y + 0.95, -8.22, 0);
    }
  }

  // Central Ceremonial Triumphal Gable Pediment & Crest Emblem (x = 0, z = -6.2)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.15, 0);
  gableShape.lineTo(0, 1.85);
  gableShape.lineTo(2.15, 0);
  gableShape.closePath();
  const geoGable = trackGeo(
    new THREE.ExtrudeGeometry(gableShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    })
  );
  geoGable.translate(0, 0, -0.36);
  const centerGable = new THREE.Mesh(geoGable, matMarbleArch);
  centerGable.position.set(0, COL_BASE_Y + 6.02, -6.2);
  centerGable.castShadow = true;
  archGroup.add(centerGable);

  // Royal blue crest medallion & golden star inside triumphal gable
  const crestDisc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.10, 16)), matRoyalSlateRoof);
  crestDisc.rotation.x = Math.PI / 2;
  crestDisc.position.set(0, COL_BASE_Y + 6.68, -5.80);
  archGroup.add(crestDisc);

  const crestRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.48, 0.045, 8, 20)), matGold);
  crestRing.position.set(0, COL_BASE_Y + 6.68, -5.78);
  archGroup.add(crestRing);

  const crestStar = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.24, 0)), matGold);
  crestStar.position.set(0, COL_BASE_Y + 6.68, -5.75);
  crestStar.scale.set(0.85, 1.35, 0.35);
  archGroup.add(crestStar);

  // Triumphal Gable Apex Finial Cross
  const apexPole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.055, 0.95, 8)), matGold);
  apexPole.position.set(0, COL_BASE_Y + 8.32, -6.2);
  archGroup.add(apexPole);
  const apexCross = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.075, 0.075)), matGold);
  apexCross.position.set(0, COL_BASE_Y + 8.55, -6.2);
  archGroup.add(apexCross);

  // Back Cloister Recessed Wall & Vaulted Roof (with central grand archway opening to cathedral view!)
  const backWallLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.6, 5.6, 0.42)), matMarbleTrim);
  backWallLeft.position.set(-6.5, COL_BASE_Y + 2.8, -8.45);
  backWallLeft.receiveShadow = true;
  archGroup.add(backWallLeft);

  const backWallRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.6, 5.6, 0.42)), matMarbleTrim);
  backWallRight.position.set(6.5, COL_BASE_Y + 2.8, -8.45);
  backWallRight.receiveShadow = true;
  archGroup.add(backWallRight);

  // Cloister Roof Cornice, Snow-Capped Royal Blue Sloped Roof & Parapet
  const backCornice = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(23.6, 0.28, 3.0)), matMarble);
  backCornice.position.set(0, COL_BASE_Y + CORNICE_Y + 0.08, -7.25);
  backCornice.castShadow = true;
  backCornice.receiveShadow = true;
  archGroup.add(backCornice);

  const backGoldFrieze = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(23.4, 0.08, 0.14)), matGold);
  backGoldFrieze.position.set(0, COL_BASE_Y + CORNICE_Y - 0.06, -5.82);
  archGroup.add(backGoldFrieze);

  // Sloped blue slate roofs flanking the central triumphal gable + crisp white snow blanket on roof
  for (const side of [-1, 1]) {
    const roofSlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.4, 0.22, 2.85)), matRoyalSlateRoof);
    roofSlate.position.set(side * 6.5, COL_BASE_Y + CORNICE_Y + 0.62, -7.35);
    roofSlate.rotation.x = 0.28;
    roofSlate.castShadow = true;
    archGroup.add(roofSlate);

    const roofSnow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.35, 0.11, 2.72)), matSnow);
    roofSnow.position.set(side * 6.5, COL_BASE_Y + CORNICE_Y + 0.77, -7.32);
    roofSnow.rotation.x = 0.28;
    roofSnow.receiveShadow = true;
    archGroup.add(roofSnow);
  }

  // --- Left & Right Wing Gothic Colonnades (x = ±11.2, z = -6.2 → +3.4, 3 bays each) ---
  const wingColZs = [-6.2, -3.0, 0.2, 3.4];
  for (const side of [-1, 1]) {
    const wx = side * 11.2;
    // Columns (skip z = -6.2 already built by back colonnade corner pier)
    for (let i = 1; i < wingColZs.length; i++) {
      buildGothicColumn(wx, COL_BASE_Y, wingColZs[i], i === wingColZs.length - 1 ? 1.12 : 1.0, true, CORNICE_Y);
    }

    // 3 Pointed Wing Arches rotated 90° along Z
    for (let b = 0; b < 3; b++) {
      const bz = (wingColZs[b] + wingColZs[b + 1]) * 0.5;
      const wArch = new THREE.Mesh(geoBayArch, matMarbleArch);
      wArch.position.set(wx, COL_BASE_Y + ARCH_SPRING_Y, bz);
      wArch.rotation.y = Math.PI / 2;
      wArch.castShadow = true;
      wArch.receiveShadow = true;
      archGroup.add(wArch);

      const ks = new THREE.Mesh(geoKeystone, matGold);
      ks.position.set(wx - side * 0.32, COL_BASE_Y + ARCH_SPRING_Y + 1.64, bz);
      ks.scale.set(0.55, 1.25, 0.95);
      archGroup.add(ks);

      // Recessed wing stained-glass lancets facing inward toward the arena
      buildStainedLancetAssembly(side * 13.05, COL_BASE_Y + 0.95, bz, side === -1 ? Math.PI / 2 : -Math.PI / 2);
    }

    // Wing back masonry wall
    const wingWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 5.6, 10.6)), matMarbleTrim);
    wingWall.position.set(side * 13.3, COL_BASE_Y + 2.8, -1.5);
    wingWall.receiveShadow = true;
    archGroup.add(wingWall);

    // Wing roof cornice & snow-dusted sloped slate roof
    const wCornice = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.9, 0.28, 10.4)), matMarble);
    wCornice.position.set(side * 12.25, COL_BASE_Y + CORNICE_Y + 0.08, -1.4);
    wCornice.castShadow = true;
    archGroup.add(wCornice);

    const wRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.75, 0.22, 10.2)), matRoyalSlateRoof);
    wRoof.position.set(side * 12.35, COL_BASE_Y + CORNICE_Y + 0.62, -1.4);
    wRoof.rotation.z = -side * 0.28;
    archGroup.add(wRoof);

    const wRoofSnow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.65, 0.11, 10.1)), matSnow);
    wRoofSnow.position.set(side * 12.32, COL_BASE_Y + CORNICE_Y + 0.77, -1.4);
    wRoofSnow.rotation.z = -side * 0.28;
    archGroup.add(wRoofSnow);
  }

  // --- Carved Classical Vase-Baluster Balustrades via InstancedMesh (1 draw call!) ---
  const balusterPositions = [];

  // Shared profiled balustrade rail & rounded snow ribbon geometries
  const geoBackTopRail = trackGeo(new THREE.BoxGeometry(2.46, 0.085, 0.26));
  const geoBackTopLip = trackGeo(new THREE.BoxGeometry(2.40, 0.045, 0.20));
  const geoBackBotRail = trackGeo(new THREE.BoxGeometry(2.46, 0.12, 0.28));
  const geoBackSnowRibbon = createSnowDriftGeometry(1.18, 0.075, 0.12, 3.1);
  const geoParapetRail = trackGeo(new THREE.BoxGeometry(2.74, 0.095, 0.24));
  const geoParapetLip = trackGeo(new THREE.BoxGeometry(2.68, 0.045, 0.19));

  const geoWingTopRail = trackGeo(new THREE.BoxGeometry(0.26, 0.085, 2.46));
  const geoWingTopLip = trackGeo(new THREE.BoxGeometry(0.20, 0.045, 2.40));
  const geoWingBotRail = trackGeo(new THREE.BoxGeometry(0.28, 0.12, 2.46));
  const geoWingSnowRibbon = createSnowDriftGeometry(0.12, 0.075, 1.18, 5.4);

  // Lower balustrade rails in outer back colonnade bays (keeping central bay open for grand steps)
  const lowerBackBays = [-9.6, -6.4, -3.2, 3.2, 6.4, 9.6];
  for (const bx of lowerBackBays) {
    const topRail = new THREE.Mesh(geoBackTopRail, matMarble);
    topRail.position.set(bx, COL_BASE_Y + 0.93, -6.2);
    topRail.castShadow = true;
    archGroup.add(topRail);

    const topLip = new THREE.Mesh(geoBackTopLip, matMarbleTrim);
    topLip.position.set(bx, COL_BASE_Y + 0.87, -6.2);
    archGroup.add(topLip);

    const snowCap = new THREE.Mesh(geoBackSnowRibbon, matSnow);
    snowCap.position.set(bx, COL_BASE_Y + 0.965, -6.2);
    archGroup.add(snowCap);

    const botRail = new THREE.Mesh(geoBackBotRail, matMarbleTrim);
    botRail.position.set(bx, COL_BASE_Y + 0.08, -6.2);
    archGroup.add(botRail);

    for (let k = -3; k <= 3; k++) {
      balusterPositions.push([bx + k * 0.34, COL_BASE_Y + 0.495, -6.2]);
    }
  }

  // Upper gallery parapet balusters along back colonnade cornice
  for (const bx of lowerBackBays) {
    const pRail = new THREE.Mesh(geoParapetRail, matMarble);
    pRail.position.set(bx, COL_BASE_Y + CORNICE_Y + 0.89, -5.88);
    archGroup.add(pRail);

    const pLip = new THREE.Mesh(geoParapetLip, matMarbleTrim);
    pLip.position.set(bx, COL_BASE_Y + CORNICE_Y + 0.83, -5.88);
    archGroup.add(pLip);

    for (let k = -3; k <= 3; k++) {
      balusterPositions.push([bx + k * 0.36, COL_BASE_Y + CORNICE_Y + 0.49, -5.88]);
    }
  }

  // Wing lower balustrade rails (6 bays total)
  const wingBayZs = [-4.6, -1.4, 1.8];
  for (const side of [-1, 1]) {
    const wx = side * 11.2;
    for (const bz of wingBayZs) {
      const topRail = new THREE.Mesh(geoWingTopRail, matMarble);
      topRail.position.set(wx, COL_BASE_Y + 0.93, bz);
      topRail.castShadow = true;
      archGroup.add(topRail);

      const topLip = new THREE.Mesh(geoWingTopLip, matMarbleTrim);
      topLip.position.set(wx, COL_BASE_Y + 0.87, bz);
      archGroup.add(topLip);

      const snowCap = new THREE.Mesh(geoWingSnowRibbon, matSnow);
      snowCap.position.set(wx, COL_BASE_Y + 0.965, bz);
      archGroup.add(snowCap);

      const botRail = new THREE.Mesh(geoWingBotRail, matMarbleTrim);
      botRail.position.set(wx, COL_BASE_Y + 0.08, bz);
      archGroup.add(botRail);

      for (let k = -3; k <= 3; k++) {
        balusterPositions.push([wx, COL_BASE_Y + 0.495, bz + k * 0.34]);
      }
    }
  }

  // Classical Vase-Curved Turned Stone Baluster via LatheGeometry (shared by InstancedMesh & foreground!)
  function createClassicalBalusterGeo(height = 0.76) {
    const profile = [
      [0.088, -0.50], [0.088, -0.43], [0.060, -0.36],
      [0.088, -0.22], [0.104, -0.09], [0.088, 0.03],
      [0.054, 0.13],  [0.072, 0.18],  [0.048, 0.23],
      [0.045, 0.33],  [0.068, 0.41],  [0.086, 0.45],
      [0.086, 0.50],
    ].map(([r, t]) => new THREE.Vector2(r, t * height));
    const g = new THREE.LatheGeometry(profile, 10);
    g.computeVertexNormals();
    return trackGeo(g);
  }

  const geoBaluster = createClassicalBalusterGeo(0.76);
  const instBalusters = new THREE.InstancedMesh(geoBaluster, matMarble, balusterPositions.length);
  instBalusters.castShadow = true;
  instBalusters.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < balusterPositions.length; i++) {
    dummy.position.set(balusterPositions[i][0], balusterPositions[i][1], balusterPositions[i][2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    instBalusters.setMatrixAt(i, dummy.matrix);
  }
  instBalusters.instanceMatrix.needsUpdate = true;
  archGroup.add(instBalusters);

  // =========================================================================
  // 7. FLOWING ROYAL BLUE-GOLD ACADEMY BANNERS (6 animated cloth pennants)
  // =========================================================================
  const animatedBanners = [];
  const geoBannerRod = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 1.44, 8));
  geoBannerRod.rotateZ(Math.PI / 2);
  const geoRodFinial = trackGeo(new THREE.SphereGeometry(0.075, 10, 8));

  function createAnimatedBanner(x, yTop, z, rotY, width, height, phase) {
    const holder = new THREE.Group();
    holder.position.set(x, yTop, z);
    holder.rotation.y = rotY;

    // Gilded wrought crossbar & finial spheres
    const rod = new THREE.Mesh(geoBannerRod, matGold);
    holder.add(rod);
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(geoRodFinial, matGold);
      fin.position.x = sx * (width * 0.58 + 0.08);
      holder.add(fin);
    }

    // Subdivided cloth geometry with tapered royal pointed pennant tip
    const segW = 8;
    const segH = 20;
    const geo = new THREE.PlaneGeometry(width, height, segW, segH);
    geo.translate(0, -height * 0.5, 0);

    const pos = geo.attributes.position;
    const restPos = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      let px = pos.getX(i);
      let py = pos.getY(i);
      const fracDown = Math.min(1, Math.max(0, -py / height));
      // Taper lower 24% into an elegant heraldic chevron point
      if (fracDown > 0.76) {
        const taper = 1.0 - ((fracDown - 0.76) / 0.24) * 0.88;
        px *= taper;
        // Center point extends slightly further down for royal pennant grace
        const edgeRatio = Math.abs(px) / (width * 0.5 + 0.001);
        py -= (1.0 - edgeRatio) * 0.22 * ((fracDown - 0.76) / 0.24);
      }
      pos.setXYZ(i, px, py, 0);
      restPos[i * 3] = px;
      restPos[i * 3 + 1] = py;
      restPos[i * 3 + 2] = 0;
    }
    geo.computeVertexNormals();
    trackGeo(geo);

    const cloth = new THREE.Mesh(geo, matBanner);
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    holder.add(cloth);

    group.add(holder);
    animatedBanners.push({
      geometry: geo,
      restPos,
      height,
      width,
      phase,
    });
  }

  // 4 Back Colonnade Royal Banners + 2 Side Wing Banners = 6 total
  createAnimatedBanner(-9.6, COL_BASE_Y + 4.58, -5.76, 0, 1.12, 3.05, 0.0);
  createAnimatedBanner(-3.2, COL_BASE_Y + 4.58, -5.76, 0, 1.16, 3.15, 1.35);
  createAnimatedBanner(3.2, COL_BASE_Y + 4.58, -5.76, 0, 1.16, 3.15, 2.70);
  createAnimatedBanner(9.6, COL_BASE_Y + 4.58, -5.76, 0, 1.12, 3.05, 4.05);
  createAnimatedBanner(-10.62, COL_BASE_Y + 4.58, -1.4, Math.PI / 2, 1.12, 2.98, 1.95);
  createAnimatedBanner(10.62, COL_BASE_Y + 4.58, -1.4, -Math.PI / 2, 1.12, 2.98, 3.45);

  // =========================================================================
  // 8. DISTANT GRAND ASURA CATHEDRAL — Twin Octagonal Bell Towers,
  //    Giant Stained Rose Window, Flying Buttresses & Golden Star Spires
  // =========================================================================
  function buildDistantCathedral() {
    const cath = new THREE.Group();
    cath.position.set(0, -0.1, -18.5);
    group.add(cath);

    // --- Central Grand Nave Facade ---
    const naveBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.8, 13.0, 7.6)), matCathedralStone);
    naveBody.position.set(0, 6.5, -1.2);
    cath.add(naveBody);

    // Stepped Nave Gable Roof (royal slate blue + snow ridges)
    const naveGableShape = new THREE.Shape();
    naveGableShape.moveTo(-5.5, 0);
    naveGableShape.lineTo(0, 5.2);
    naveGableShape.lineTo(5.5, 0);
    naveGableShape.closePath();
    const naveGableGeo = trackGeo(
      new THREE.ExtrudeGeometry(naveGableShape, { depth: 7.4, bevelEnabled: false })
    );
    naveGableGeo.translate(0, 0, -3.7);
    const naveGable = new THREE.Mesh(naveGableGeo, matRoyalSlateRoof);
    naveGable.position.set(0, 12.95, -1.2);
    cath.add(naveGable);

    // Crisp front marble gable fascia trim
    const fasciaLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.7, 0.38, 0.45)), matMarble);
    fasciaLeft.position.set(-2.75, 15.55, 2.52);
    fasciaLeft.rotation.z = Math.atan2(5.2, 5.5);
    cath.add(fasciaLeft);

    const fasciaRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.7, 0.38, 0.45)), matMarble);
    fasciaRight.position.set(2.75, 15.55, 2.52);
    fasciaRight.rotation.z = -Math.atan2(5.2, 5.5);
    cath.add(fasciaRight);

    // Central Needle Flèche Spire + Golden Starburst Cross
    const flecheBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.65, 2.2, 8)), matMarble);
    flecheBase.position.set(0, 18.2, -0.8);
    cath.add(flecheBase);

    const flecheSpire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.54, 4.2, 8)), matRoyalSlateRoof);
    flecheSpire.position.set(0, 21.3, -0.8);
    cath.add(flecheSpire);

    const flecheCrossV = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.08, 1.6, 6)), matGold);
    flecheCrossV.position.set(0, 23.9, -0.8);
    cath.add(flecheCrossV);
    const flecheCrossH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.85, 0.12, 0.12)), matGold);
    flecheCrossH.position.set(0, 24.15, -0.8);
    cath.add(flecheCrossH);

    // --- Giant Luminous Gothic Rose Window (aligned straight down the arena axis!) ---
    const roseY = 9.85;
    const roseZ = 2.66;
    const roseFrame = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.45, 0.24, 10, 28)), matMarble);
    roseFrame.position.set(0, roseY, roseZ);
    cath.add(roseFrame);

    const roseGoldRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.22, 0.08, 8, 28)), matGold);
    roseGoldRim.position.set(0, roseY, roseZ + 0.08);
    cath.add(roseGoldRim);

    const roseGlass = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(2.25, 28)), matRoseGlass);
    roseGlass.position.set(0, roseY, roseZ - 0.02);
    cath.add(roseGlass);

    // 12 radial Gothic stone spokes + inner golden rosette ring
    const spokeGeo = trackGeo(new THREE.BoxGeometry(0.09, 4.3, 0.12));
    for (let s = 0; s < 6; s++) {
      const sp = new THREE.Mesh(spokeGeo, matMarbleTrim);
      sp.position.set(0, roseY, roseZ + 0.05);
      sp.rotation.z = (s * Math.PI) / 6;
      cath.add(sp);
    }
    const innerRosette = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.95, 0.075, 8, 20)), matGold);
    innerRosette.position.set(0, roseY, roseZ + 0.08);
    cath.add(innerRosette);

    // --- Symmetric Twin Octagonal Bell Towers (x = ±7.6) ---
    const geoTowerBase = trackGeo(new THREE.BoxGeometry(4.4, 10.6, 4.4));
    const geoTowerLedge = trackGeo(new THREE.BoxGeometry(4.9, 0.45, 4.9));
    const geoOctBelfry = trackGeo(new THREE.CylinderGeometry(2.15, 2.35, 5.4, 8));
    const geoBelfryCrown = trackGeo(new THREE.CylinderGeometry(2.55, 2.25, 0.55, 8));
    const geoTowerSpire = trackGeo(new THREE.ConeGeometry(2.38, 7.2, 8));
    const geoSpireSnow = trackGeo(new THREE.ConeGeometry(2.42, 3.2, 8));
    const geoCornerButtress = trackGeo(new THREE.BoxGeometry(0.65, 11.4, 0.65));
    const geoTowerWindow = trackGeo(new THREE.BoxGeometry(0.86, 2.55, 0.18));

    for (const side of [-1, 1]) {
      const tx = side * 7.6;
      const tower = new THREE.Group();
      tower.position.set(tx, 0, 0.2);

      const base = new THREE.Mesh(geoTowerBase, matCathedralStone);
      base.position.y = 5.3;
      tower.add(base);

      // 4 vertical corner buttresses giving deep vertical gothic fluting
      for (const bx of [-1, 1]) {
        for (const bz of [-1, 1]) {
          const cb = new THREE.Mesh(geoCornerButtress, matMarble);
          cb.position.set(bx * 2.1, 5.7, bz * 2.1);
          tower.add(cb);

          // Corner turret pinnacle at belfry deck
          const tp = new THREE.Mesh(geoPinnacleSpire, matRoyalSlateRoof);
          tp.position.set(bx * 2.1, 11.95, bz * 2.1);
          tp.scale.set(1.4, 1.5, 1.4);
          tower.add(tp);
        }
      }

      const ledge = new THREE.Mesh(geoTowerLedge, matMarble);
      ledge.position.y = 10.65;
      tower.add(ledge);

      const belfry = new THREE.Mesh(geoOctBelfry, matMarble);
      belfry.position.y = 13.45;
      tower.add(belfry);

      // Warm softly lit belfry windows around front faces
      for (let f = -1; f <= 1; f++) {
        const ang = f * (Math.PI / 4);
        const bw = new THREE.Mesh(geoTowerWindow, matBelfryGlow);
        bw.position.set(Math.sin(ang) * 2.16, 13.5, Math.cos(ang) * 2.16);
        bw.rotation.y = ang;
        tower.add(bw);
      }

      const crown = new THREE.Mesh(geoBelfryCrown, matMarbleTrim);
      crown.position.y = 16.25;
      tower.add(crown);

      const spire = new THREE.Mesh(geoTowerSpire, matRoyalSlateRoof);
      spire.position.y = 20.1;
      tower.add(spire);

      // Snow-dusted upper spire highlight
      const spireSnow = new THREE.Mesh(geoSpireSnow, matSnow);
      spireSnow.position.y = 22.12;
      spireSnow.scale.set(0.46, 1.0, 0.46);
      tower.add(spireSnow);

      // Golden celestial cross-star finial atop each bell tower
      const rod = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.085, 1.65, 6)), matGold);
      rod.position.y = 24.4;
      tower.add(rod);
      const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.13, 0.13)), matGold);
      bar.position.y = 24.75;
      tower.add(bar);
      const star = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.26, 0)), matGold);
      star.position.y = 24.75;
      tower.add(star);

      // Lower front lancet stained glass on tower facade
      const lowerWin = new THREE.Mesh(geoLancetGlass, matStainedGlass);
      lowerWin.position.set(0, 5.2, 2.24);
      lowerWin.scale.set(0.95, 1.05, 1.0);
      tower.add(lowerWin);

      cath.add(tower);

      // --- 3D Sculpted Gothic Flying Buttresses (True Curved Arches + Arch Ribs + Open Arcade Struts) ---
      const fbGroup = new THREE.Group();
      fbGroup.position.set(side * 12.5, 0, -0.5);
      if (side > 0) fbGroup.rotation.y = Math.PI;
      cath.add(fbGroup);

      // Stepped outer buttress pier (local x = 0)
      const pierFoot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.0, 2.8, 2.0)), matCathedralStone);
      pierFoot.position.set(-0.1, 1.4, 0);
      fbGroup.add(pierFoot);

      const outerPier = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 7.6, 1.65)), matCathedralStone);
      outerPier.position.set(-0.05, 6.2, 0);
      fbGroup.add(outerPier);

      const pierLedge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.86, 0.34, 1.92)), matMarble);
      pierLedge.position.set(-0.05, 9.95, 0);
      fbGroup.add(pierLedge);

      const pierGoldBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.74, 0.10, 1.80)), matGold);
      pierGoldBand.position.set(-0.05, 10.18, 0);
      fbGroup.add(pierGoldBand);

      const outerPierCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.12, 2.8, 8)), matRoyalSlateRoof);
      outerPierCap.position.set(-0.05, 11.65, 0);
      fbGroup.add(outerPierCap);

      const pierFinial = new THREE.Mesh(geoFinialOrb, matGold);
      pierFinial.position.set(-0.05, 13.18, 0);
      pierFinial.scale.setScalar(1.65);
      fbGroup.add(pierFinial);

      // Build shared curved Gothic flying buttress arch spanning local x = 0.25 -> 3.55 into tower wall
      const fbSpan = 3.30;
      const fbRise = 2.05;
      const fbShape = new THREE.Shape();
      fbShape.moveTo(0, 0);
      fbShape.quadraticCurveTo(fbSpan * 0.40, fbRise * 0.92, fbSpan, fbRise);
      fbShape.lineTo(fbSpan, fbRise + 0.56);
      fbShape.quadraticCurveTo(fbSpan * 0.45, fbRise * 0.58 + 0.62, 0, 0.66);
      fbShape.closePath();

      const geoFlyerArch = trackGeo(
        new THREE.ExtrudeGeometry(fbShape, {
          depth: 0.54,
          bevelEnabled: true,
          bevelThickness: 0.045,
          bevelSize: 0.04,
          bevelSegments: 2,
          curveSegments: 14,
        })
      );
      geoFlyerArch.translate(0, 0, -0.27);

      // Matching curved arch soffit rib molding tracing underside of each flyer
      const ribCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0.02, -0.02, 0),
        new THREE.Vector3(fbSpan * 0.40, fbRise * 0.90, 0),
        new THREE.Vector3(fbSpan - 0.02, fbRise - 0.02, 0)
      );
      const geoFlyerRib = trackGeo(new THREE.TubeGeometry(ribCurve, 14, 0.085, 6, false));

      // Two tiered arched Gothic flyers bracing the bell tower
      for (const fh of [5.15, 7.95]) {
        const flyer = new THREE.Mesh(geoFlyerArch, matMarble);
        flyer.position.set(0.22, fh, 0);
        fbGroup.add(flyer);

        const rib = new THREE.Mesh(geoFlyerRib, matMarbleTrim);
        rib.position.set(0.22, fh, 0.24);
        fbGroup.add(rib);

        const ribBack = new THREE.Mesh(geoFlyerRib, matMarbleTrim);
        ribBack.position.set(0.22, fh, -0.24);
        fbGroup.add(ribBack);
      }

      // Open Gothic spandrel arcade colonnettes & tracery rings between the two curved flyers
      const geoStrutCol = trackGeo(new THREE.CylinderGeometry(0.11, 0.125, 2.65, 8));
      const geoStrutRing = trackGeo(new THREE.TorusGeometry(0.24, 0.055, 6, 14));
      for (const frac of [0.24, 0.52, 0.78]) {
        const sx = 0.22 + fbSpan * frac;
        const lowY = 5.15 + fbRise * (0.35 + frac * 0.55) + 0.25;
        const strut = new THREE.Mesh(geoStrutCol, matMarbleTrim);
        strut.position.set(sx, lowY + 1.25, 0);
        fbGroup.add(strut);

        const trRing = new THREE.Mesh(geoStrutRing, matGold);
        trRing.position.set(sx + 0.36, lowY + 1.85, 0);
        if (frac < 0.7) fbGroup.add(trRing);
      }

      // Secondary Flanking Fairytale Turrets at outer cathedral flanks (x = ±15.6, z = -3.4)
      const flankBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.65, 1.92, 10.2, 8)), matCathedralStone);
      flankBase.position.set(side * 15.6, 5.1, -3.4);
      cath.add(flankBase);

      const flankCrown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.05, 1.72, 0.52, 8)), matMarble);
      flankCrown.position.set(side * 15.6, 10.35, -3.4);
      cath.add(flankCrown);

      const flankSpire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.98, 5.8, 8)), matRoyalSlateRoof);
      flankSpire.position.set(side * 15.6, 13.4, -3.4);
      cath.add(flankSpire);

      const flankFinial = new THREE.Mesh(geoFinialOrb, matGold);
      flankFinial.position.set(side * 15.6, 16.5, -3.4);
      flankFinial.scale.setScalar(2.0);
      cath.add(flankFinial);
    }
  }
  buildDistantCathedral();

  // =========================================================================
  // 9. AAA CARVED CLASSICAL MARBLE URNS & MULTI-TIER STAR-FROND WINTER CEDARS
  // =========================================================================

  // --- Classical Footed Fluted Marble Urn Planter (LatheGeometry + Stepped Plinth) ---
  const geoUrnPlinthLow = trackGeo(new THREE.BoxGeometry(1.06, 0.09, 1.06));
  const geoUrnPlinthGold = trackGeo(new THREE.BoxGeometry(0.94, 0.024, 0.94));
  const geoUrnPlinthTop = trackGeo(new THREE.BoxGeometry(0.88, 0.075, 0.88));

  const geoClassicalUrn = (() => {
    // Footed classical marble urn profile: molded foot -> slender stem -> fluted belly -> rolled lip -> hollow rim
    const profile = [
      [0.42, 0.00], [0.44, 0.03], [0.38, 0.07], [0.27, 0.11],
      [0.21, 0.15], [0.26, 0.185], [0.21, 0.22], [0.27, 0.27],
      [0.44, 0.34], [0.60, 0.44], [0.70, 0.54], [0.74, 0.62],
      [0.71, 0.69], [0.66, 0.73], [0.76, 0.77], [0.86, 0.81],
      [0.87, 0.85], [0.82, 0.885], [0.73, 0.875], [0.67, 0.80],
    ].map(([r, y]) => new THREE.Vector2(r, y));

    const g = new THREE.LatheGeometry(profile, 32);
    // Carve 16 classical gadrooning flutes directly into the swelling urn belly
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      if (vy > 0.30 && vy < 0.71) {
        const rad = Math.hypot(vx, vz);
        if (rad > 0.25) {
          const ang = Math.atan2(vz, vx);
          const bellMask = Math.sin(((vy - 0.30) / 0.41) * Math.PI);
          const flute = 1.0 + 0.048 * Math.cos(ang * 16) * bellMask;
          pos.setX(i, vx * flute);
          pos.setZ(i, vz * flute);
        }
      }
    }
    g.computeVertexNormals();
    return trackGeo(g);
  })();

  const geoUrnWaistGold = trackGeo(new THREE.TorusGeometry(0.255, 0.022, 8, 22));
  geoUrnWaistGold.rotateX(Math.PI / 2);
  const geoUrnCollarGold = trackGeo(new THREE.TorusGeometry(0.685, 0.024, 8, 28));
  geoUrnCollarGold.rotateX(Math.PI / 2);
  const geoUrnMedallion = trackGeo(new THREE.OctahedronGeometry(0.068, 0));
  const geoUrnSnow = createSnowDriftGeometry(0.73, 0.16, 0.73, 2.7);

  // Realistic root-flared tapering cedar trunk extending deep into upper canopy
  const geoCedarTrunk = (() => {
    const profile = [
      [0.29, 0.00], [0.24, 0.14], [0.20, 0.38], [0.175, 0.82],
      [0.150, 1.38], [0.125, 1.98], [0.098, 2.58], [0.068, 3.16],
      [0.036, 3.68], [0.015, 3.96],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(profile, 10);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const ang = Math.atan2(vz, vx);
      // Subtle organic root fluting near base & slight natural trunk gnarl
      const rootFlare = vy < 0.45 ? 1.0 + 0.18 * (1 - vy / 0.45) * Math.cos(ang * 5) : 1.0;
      const swayX = Math.sin(vy * 1.15) * 0.028;
      const swayZ = Math.cos(vy * 0.95) * 0.022;
      pos.setXYZ(i, vx * rootFlare + swayX, vy, vz * rootFlare + swayZ);
    }
    g.computeVertexNormals();
    return trackGeo(g);
  })();

  // Procedural Star-Shaped Irregular Drooping Pine Frond Whorl + Plush Snow Mantle + Tip Icicles
  function createStarPineWhorl(outerR, tierH, lobes, droop, seed = 0) {
    const radialSegs = lobes * 4;
    const rings = 4;

    function evalBranchShape(ang, t) {
      // Deeply incised star fronds with secondary needle sprays and per-branch irregularity
      const lobeWave = 0.5 + 0.5 * Math.cos(ang * lobes + seed);
      const lobePeak = Math.pow(lobeWave, 1.65);
      const subNeedle = 0.13 * Math.pow(0.5 + 0.5 * Math.cos(ang * lobes * 3 + seed * 1.7), 1.15);
      const asym =
        1.0 +
        0.13 * Math.sin(ang * 2 + seed * 2.1) +
        0.08 * Math.cos(ang * 3 - seed * 1.6);
      const starScale = (0.36 + 0.64 * lobePeak + subNeedle) * asym;

      const rad = outerR * (0.05 + 0.95 * Math.pow(t, 0.88)) * (0.24 + 0.76 * starScale);
      // Natural winter cedar bough arch: sweeps outward, droops under snow, flicks lightly up at tips
      const droopAmt = droop * (0.38 + 0.62 * lobePeak) * (0.88 + 0.24 * Math.sin(ang * 2 - seed));
      const tipCurl = 0.075 * outerR * Math.pow(t, 3.0) * lobePeak;
      const yTop = tierH * Math.pow(1 - t, 1.14) - droopAmt * t * t + tipCurl;
      const thick = (0.14 * tierH + 0.065 * outerR) * Math.sin(Math.pow(t, 0.72) * Math.PI) * (0.52 + 0.48 * lobePeak);
      return { rad, yTop, yBot: yTop - thick, lobePeak };
    }

    function buildClosedShell(isSnow) {
      const topGrid = [];
      const botGrid = [];
      const tipList = [];

      for (let r = 0; r <= rings; r++) {
        const t = r / rings;
        const rowTop = [];
        const rowBot = [];
        for (let s = 0; s < radialSegs; s++) {
          const ang = (s / radialSegs) * Math.PI * 2;
          const cs = Math.cos(ang);
          const sn = Math.sin(ang);
          const b = evalBranchShape(ang, t);

          if (!isSnow) {
            rowTop.push(new THREE.Vector3(cs * b.rad, b.yTop, sn * b.rad));
            rowBot.push(new THREE.Vector3(cs * b.rad * (r === rings ? 1.0 : 0.92), b.yBot, sn * b.rad * (r === rings ? 1.0 : 0.92)));
            // Collect exact outer lobe tips for hanging icicles
            if (r === rings && s % 4 === 0) {
              tipList.push(new THREE.Vector3(cs * b.rad * 0.92, b.yBot + 0.01, sn * b.rad * 0.92));
            }
          } else {
            // Plush snow mantle resting generously across upper frond lobes while exposing serrated green tips underneath
            const sRad = b.rad * (0.86 + 0.08 * b.lobePeak);
            const pillow = Math.sin(Math.pow(t, 0.68) * Math.PI);
            const snowThick = (0.042 + 0.072 * b.lobePeak + 0.022 * outerR) * pillow;
            const edgeDrop = r === rings ? -0.024 : 0.0;
            rowTop.push(new THREE.Vector3(cs * sRad, b.yTop + 0.026 + snowThick + edgeDrop, sn * sRad));
            rowBot.push(new THREE.Vector3(cs * sRad * 0.98, b.yTop - 0.012 + edgeDrop, sn * sRad * 0.98));
          }
        }
        topGrid.push(rowTop);
        botGrid.push(rowBot);
      }

      const positions = [];
      const normals = [];
      const ab = new THREE.Vector3();
      const ac = new THREE.Vector3();
      const fn = new THREE.Vector3();
      const cent = new THREE.Vector3();
      const refPt = new THREE.Vector3();
      const outCheck = new THREE.Vector3();

      function pushTri(a, b, c, preferUp) {
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        fn.crossVectors(ab, ac);
        const len = fn.length();
        if (len < 1e-7) return;
        fn.divideScalar(len);

        cent.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        refPt.set(0, preferUp ? cent.y - 0.55 : cent.y + 0.55, 0);
        outCheck.subVectors(cent, refPt);
        let p1 = a;
        let p2 = b;
        let p3 = c;
        if (fn.dot(outCheck) < 0) {
          fn.negate();
          p2 = c;
          p3 = b;
        }
        positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
        normals.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
      }

      for (let r = 0; r < rings; r++) {
        for (let s = 0; s < radialSegs; s++) {
          const sn = (s + 1) % radialSegs;
          // Upper surface
          pushTri(topGrid[r][s], topGrid[r][sn], topGrid[r + 1][sn], true);
          pushTri(topGrid[r][s], topGrid[r + 1][sn], topGrid[r + 1][s], true);
          // Underside surface (gives solid 3D foliage volume from low & side camera angles)
          pushTri(botGrid[r][s], botGrid[r + 1][sn], botGrid[r][sn], false);
          pushTri(botGrid[r][s], botGrid[r + 1][s], botGrid[r + 1][sn], false);
        }
      }

      // Close outer rim thickness on snow mantle so snow reads lush & thick
      if (isSnow) {
        for (let s = 0; s < radialSegs; s++) {
          const sn = (s + 1) % radialSegs;
          const t0 = topGrid[rings][s];
          const t1 = topGrid[rings][sn];
          const b0 = botGrid[rings][s];
          const b1 = botGrid[rings][sn];
          pushTri(t0, t1, b1, true);
          pushTri(t0, b1, b0, true);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      return { geo: trackGeo(geo), tipList };
    }

    const foliage = buildClosedShell(false);
    const snow = buildClosedShell(true);
    return { boughGeo: foliage.geo, snowGeo: snow.geo, tipList: foliage.tipList };
  }

  // Merge slender faceted hanging icicles positioned at drooping cedar branch tips
  function createMergedBranchIciclesGeo(tipEntries) {
    const positions = [];
    const normals = [];
    const sides = 5;
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const fn = new THREE.Vector3();

    function pushIcicleTri(a, b, c, cx, cy, cz) {
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      fn.crossVectors(ab, ac);
      const len = fn.length();
      if (len < 1e-7) return;
      fn.divideScalar(len);
      const mx = (a.x + b.x + c.x) / 3 - cx;
      const my = (a.y + b.y + c.y) / 3 - cy;
      const mz = (a.z + b.z + c.z) / 3 - cz;
      let p1 = a;
      let p2 = b;
      let p3 = c;
      if (fn.x * mx + fn.y * my + fn.z * mz < 0) {
        fn.negate();
        p2 = c;
        p3 = b;
      }
      positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      normals.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
    }

    for (let idx = 0; idx < tipEntries.length; idx++) {
      const { pos, len, rad } = tipEntries[idx];
      const topRing = [];
      for (let i = 0; i < sides; i++) {
        const ang = (i / sides) * Math.PI * 2 + idx * 0.7;
        const rr = rad * (0.85 + 0.25 * (i % 2));
        topRing.push(new THREE.Vector3(pos.x + Math.cos(ang) * rr, pos.y + 0.015, pos.z + Math.sin(ang) * rr));
      }
      const tip = new THREE.Vector3(pos.x, pos.y - len, pos.z);
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        pushIcicleTri(topRing[i], topRing[j], tip, pos.x, pos.y - len * 0.35, pos.z);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return trackGeo(g);
  }

  // Pre-build 3 distinct organic 6-tier winter cedar canopy variants (shared across all 12 trees!)
  const CEDAR_TIER_SPECS = [
    { r: 1.24, h: 0.78, py: 0.96, lobes: 8, droop: 0.30, mat: matPineDeep },
    { r: 1.06, h: 0.74, py: 1.54, lobes: 8, droop: 0.26, mat: matPineDark },
    { r: 0.88, h: 0.68, py: 2.08, lobes: 7, droop: 0.22, mat: matPineLight },
    { r: 0.68, h: 0.62, py: 2.60, lobes: 7, droop: 0.17, mat: matPineDark },
    { r: 0.48, h: 0.56, py: 3.08, lobes: 6, droop: 0.12, mat: matPineLight },
    { r: 0.27, h: 0.54, py: 3.52, lobes: 5, droop: 0.06, mat: matPineDark },
  ];

  const CEDAR_VARIANTS = [0.35, 2.15, 4.05].map((vSeed) => {
    const builtTiers = [];
    const icicleTips = [];
    for (let i = 0; i < CEDAR_TIER_SPECS.length; i++) {
      const sp = CEDAR_TIER_SPECS[i];
      const tierRot = vSeed + i * 0.78;
      const w = createStarPineWhorl(sp.r, sp.h, sp.lobes, sp.droop, vSeed + i * 1.37);
      builtTiers.push({
        boughGeo: w.boughGeo,
        snowGeo: w.snowGeo,
        py: sp.py,
        rotY: tierRot,
        mat: sp.mat,
      });

      // Hang fine icicles from outer drooping tips of lower 3 whorls
      if (i < 3) {
        const cs = Math.cos(tierRot);
        const sn = Math.sin(tierRot);
        for (let k = 0; k < w.tipList.length; k++) {
          if ((k + i) % 2 === 1 && i === 2) continue;
          const tp = w.tipList[k];
          const wx = tp.x * cs + tp.z * sn;
          const wz = -tp.x * sn + tp.z * cs;
          icicleTips.push({
            pos: new THREE.Vector3(wx, sp.py + tp.y, wz),
            len: 0.15 + ((k * 7 + i * 3) % 5) * 0.032,
            rad: 0.017 + (k % 3) * 0.004,
          });
        }
      }
    }
    return {
      tiers: builtTiers,
      iciclesGeo: createMergedBranchIciclesGeo(icicleTips),
    };
  });

  function buildWinterPine(x, y, z, scale = 1.0, withPlanter = false, seed = 0) {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    tree.scale.setScalar(scale);

    let yOff = 0;
    if (withPlanter) {
      // Stepped classical marble pedestal base
      const plLow = new THREE.Mesh(geoUrnPlinthLow, matMarbleTrim);
      plLow.position.y = 0.045;
      plLow.castShadow = true;
      plLow.receiveShadow = true;
      tree.add(plLow);

      const plGold = new THREE.Mesh(geoUrnPlinthGold, matGold);
      plGold.position.y = 0.095;
      tree.add(plGold);

      const plTop = new THREE.Mesh(geoUrnPlinthTop, matMarble);
      plTop.position.y = 0.135;
      plTop.castShadow = true;
      plTop.receiveShadow = true;
      tree.add(plTop);

      // LatheGeometry classical fluted marble footed urn with rolled lip
      const urn = new THREE.Mesh(geoClassicalUrn, matMarble);
      urn.position.y = 0.16;
      urn.castShadow = true;
      urn.receiveShadow = true;
      tree.add(urn);

      const waistGold = new THREE.Mesh(geoUrnWaistGold, matGold);
      waistGold.position.y = 0.345;
      tree.add(waistGold);

      const collarGold = new THREE.Mesh(geoUrnCollarGold, matGold);
      collarGold.position.y = 0.90;
      tree.add(collarGold);

      // 4 cardinal champagne-gold crest bosses on the fluted urn belly
      for (let m = 0; m < 4; m++) {
        const ang = (m * Math.PI) / 2;
        const boss = new THREE.Mesh(geoUrnMedallion, matGold);
        boss.position.set(Math.cos(ang) * 0.74, 0.76, Math.sin(ang) * 0.74);
        boss.scale.set(0.65, 1.15, 0.65);
        tree.add(boss);
      }

      // Soft pillowed snow mound filling the urn mouth around the trunk base
      const pSnow = new THREE.Mesh(geoUrnSnow, matSnow);
      pSnow.position.y = 0.94;
      pSnow.receiveShadow = true;
      tree.add(pSnow);

      yOff = 0.92;
    }

    const variantIdx = Math.abs(Math.round(seed * 3.7)) % CEDAR_VARIANTS.length;
    const variant = CEDAR_VARIANTS[variantIdx];

    const canopy = new THREE.Group();
    canopy.position.y = yOff;
    canopy.rotation.y = seed * 1.45;
    tree.add(canopy);

    // Realistic root-flared tapering bark trunk
    const trunk = new THREE.Mesh(geoCedarTrunk, matBark);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    canopy.add(trunk);

    // 6 staggered star-lobed drooping pine bough whorls + lush draped snow mantles
    for (let i = 0; i < variant.tiers.length; i++) {
      const t = variant.tiers[i];
      const bough = new THREE.Mesh(t.boughGeo, t.mat);
      bough.position.y = t.py;
      bough.rotation.y = t.rotY;
      bough.castShadow = true;
      bough.receiveShadow = true;
      canopy.add(bough);

      const snowMantle = new THREE.Mesh(t.snowGeo, matSnow);
      snowMantle.position.y = t.py;
      snowMantle.rotation.y = t.rotY;
      snowMantle.receiveShadow = true;
      canopy.add(snowMantle);
    }

    // Delicate glistening icicles suspended beneath drooping branch tips
    const icicles = new THREE.Mesh(variant.iciclesGeo, matIcicle);
    canopy.add(icicles);

    group.add(tree);
  }

  // Sculpted classical marble urn snow cedars framing the raised back colonnade (visible in 34° FOV, outside braziers ±6.4 & combat zone)
  buildWinterPine(-7.75, COL_BASE_Y, -5.48, 0.85, true, 0.4);
  buildWinterPine(7.75, COL_BASE_Y, -5.48, 0.85, true, 1.9);

  // Outer snowy academy conifer groves framing the cloister & cathedral vistas
  const outerTrees = [
    { x: -14.8, y: -0.1, z: 3.2, s: 1.25, seed: 0.8 },
    { x: 14.8, y: -0.1, z: 3.2, s: 1.22, seed: 2.1 },
    { x: -15.6, y: -0.1, z: -2.4, s: 1.42, seed: 1.3 },
    { x: 15.6, y: -0.1, z: -2.4, s: 1.38, seed: 2.9 },
    { x: -14.4, y: -0.1, z: -10.8, s: 1.55, seed: 0.5 },
    { x: 14.4, y: -0.1, z: -10.8, s: 1.58, seed: 1.7 },
    { x: -18.5, y: -0.1, z: -12.6, s: 1.80, seed: 2.4 },
    { x: 18.5, y: -0.1, z: -12.6, s: 1.75, seed: 3.3 },
    { x: -11.5, y: -0.1, z: -12.8, s: 1.32, seed: 0.9 },
    { x: 11.5, y: -0.1, z: -12.8, s: 1.35, seed: 2.6 },
  ];
  for (const t of outerTrees) {
    buildWinterPine(t.x, t.y, t.z, t.s, false, t.seed);
  }

  // =========================================================================
  // 10. SIX SCULPTED CAST-IRON SCROLLWORK BRAZIERS & DYNAMIC 3D FLAMES
  // =========================================================================
  const braziers = [];
  const emberSpecs = [];

  // Carved marble stepped pedestal with LatheGeometry fluted classical shaft
  const geoBrazPlinth = trackGeo(new THREE.CylinderGeometry(0.45, 0.49, 0.14, 8));
  const geoBrazPedestal = (() => {
    const profile = [
      [0.39, 0.00], [0.40, 0.04], [0.33, 0.10], [0.27, 0.18],
      [0.32, 0.34], [0.33, 0.48], [0.26, 0.60], [0.29, 0.66],
      [0.36, 0.72], [0.38, 0.75],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(profile, 24);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      if (vy > 0.14 && vy < 0.62) {
        const ang = Math.atan2(vz, vx);
        const mask = Math.sin(((vy - 0.14) / 0.48) * Math.PI);
        const flute = 1.0 + 0.045 * Math.cos(ang * 12) * mask;
        pos.setX(i, vx * flute);
        pos.setZ(i, vz * flute);
      }
    }
    g.computeVertexNormals();
    return trackGeo(g);
  })();
  const geoBrazPedGold = trackGeo(new THREE.TorusGeometry(0.285, 0.022, 8, 20));
  geoBrazPedGold.rotateX(Math.PI / 2);
  const geoPedCapLow = trackGeo(new THREE.BoxGeometry(0.66, 0.06, 0.66));
  const geoPedCapTop = trackGeo(new THREE.BoxGeometry(0.78, 0.09, 0.78));

  // Merge radially arrayed TubeGeometry scrollwork into single-draw-call shared geometries
  function mergeRadialGeometries(items) {
    const positions = [];
    const normals = [];
    const indices = [];
    let vertexOffset = 0;

    for (const { geo, rotY } of items) {
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      const cs = Math.cos(rotY);
      const sn = Math.sin(rotY);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        positions.push(vx * cs + vz * sn, vy, -vx * sn + vz * cs);
        const nx = norm.getX(i);
        const ny = norm.getY(i);
        const nz = norm.getZ(i);
        normals.push(nx * cs + nz * sn, ny, -nx * sn + nz * cs);
      }
      if (geo.index) {
        const idx = geo.index.array;
        for (let i = 0; i < idx.length; i++) {
          indices.push(idx[i] + vertexOffset);
        }
      } else {
        for (let i = 0; i < pos.count; i++) {
          indices.push(i + vertexOffset);
        }
      }
      vertexOffset += pos.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setIndex(indices);
    return trackGeo(merged);
  }

  // Merged 4 forged S-scroll cast-iron legs + 8 curved openwork cage ribs (1 draw call per brazier!)
  const geoIronScrollCage = (() => {
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.26, 0.96, 0),
      new THREE.Vector3(0.20, 1.04, 0),
      new THREE.Vector3(0.11, 1.13, 0),
      new THREE.Vector3(0.22, 1.24, 0),
      new THREE.Vector3(0.35, 1.33, 0),
    ]);
    const ribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.32, 1.33, 0),
      new THREE.Vector3(0.43, 1.40, 0),
      new THREE.Vector3(0.47, 1.49, 0),
      new THREE.Vector3(0.44, 1.58, 0),
    ]);
    const legBase = new THREE.TubeGeometry(legCurve, 10, 0.028, 6, false);
    const ribBase = new THREE.TubeGeometry(ribCurve, 9, 0.020, 5, false);
    const parts = [];
    for (let leg = 0; leg < 4; leg++) {
      parts.push({ geo: legBase, rotY: (leg * Math.PI) / 2 + Math.PI / 4 });
    }
    for (let r = 0; r < 8; r++) {
      parts.push({ geo: ribBase, rotY: (r * Math.PI) / 4 });
    }
    const merged = mergeRadialGeometries(parts);
    legBase.dispose();
    ribBase.dispose();
    return merged;
  })();

  // Merged 8 ornate champagne-gold scrollwork volutes curling outward around basket crown (1 draw call!)
  const geoGoldScrollCrown = (() => {
    const scrollCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.43, 1.56, 0),
      new THREE.Vector3(0.50, 1.63, 0),
      new THREE.Vector3(0.52, 1.70, 0),
      new THREE.Vector3(0.46, 1.73, 0),
      new THREE.Vector3(0.42, 1.68, 0),
    ]);
    const scrollBase = new THREE.TubeGeometry(scrollCurve, 10, 0.017, 5, false);
    const parts = [];
    for (let r = 0; r < 8; r++) {
      parts.push({ geo: scrollBase, rotY: (r * Math.PI) / 4 });
    }
    const merged = mergeRadialGeometries(parts);
    scrollBase.dispose();
    return merged;
  })();

  const geoCenterFinial = trackGeo(new THREE.SphereGeometry(0.085, 10, 8));

  // Scalloped dark cast-iron lower basin dish
  const geoIronDish = (() => {
    const profile = [
      [0.04, 0.00], [0.16, 0.02], [0.28, 0.07], [0.36, 0.13],
      [0.39, 0.17], [0.34, 0.18], [0.22, 0.11], [0.06, 0.06],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(profile, 14);
    g.computeVertexNormals();
    return trackGeo(g);
  })();

  const geoMidIronHoop = trackGeo(new THREE.TorusGeometry(0.462, 0.022, 8, 22));
  geoMidIronHoop.rotateX(Math.PI / 2);
  const geoUpperGoldRim = trackGeo(new THREE.TorusGeometry(0.44, 0.028, 8, 24));
  geoUpperGoldRim.rotateX(Math.PI / 2);
  const geoHoopBoss = trackGeo(new THREE.OctahedronGeometry(0.036, 0));

  // Craggy glowing charcoal & incandescent ember mound nestled inside the openwork basket
  const geoEmberBed = (() => {
    const g = new THREE.SphereGeometry(0.37, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const lump =
        1.0 +
        0.14 * Math.sin(vx * 18.0 + vz * 14.0) +
        0.10 * Math.cos(vx * 24.0 - vy * 20.0);
      pos.setXYZ(i, vx * lump, vy * 0.56 * lump, vz * lump);
    }
    g.computeVertexNormals();
    return trackGeo(g);
  })();

  // Sculpted organic 3D sinuous flame tongue geometry (pivoted cleanly at base y = 0)
  function createFlameTongueGeo(rx, rz, height, bendX = 0.04, bendZ = 0.02, twist = 1.6) {
    const radialSegs = 10;
    const heightSegs = 12;
    const positions = [];
    const indices = [];

    for (let h = 0; h <= heightSegs; h++) {
      const t = h / heightSegs; // 0 = base, 1 = sharp tip
      // Plump glowing lower flame belly tapering smoothly to a sinuous razor tongue tip
      const profile =
        t < 0.999 ? Math.pow(Math.sin(Math.pow(t, 0.62) * Math.PI), 0.78) * (1.0 - 0.25 * t) : 0.0;
      const py = t * height;
      const sx = bendX * Math.sin(t * Math.PI * 1.15) * t;
      const sz = bendZ * t * t;

      for (let s = 0; s < radialSegs; s++) {
        const ang = (s / radialSegs) * Math.PI * 2;
        const flute = 1.0 + 0.15 * Math.sin(ang * 3 + t * twist);
        const px = sx + Math.cos(ang) * rx * profile * flute;
        const pz = sz + Math.sin(ang) * rz * profile * flute;
        positions.push(px, py, pz);
      }
    }

    for (let h = 0; h < heightSegs; h++) {
      const rowA = h * radialSegs;
      const rowB = (h + 1) * radialSegs;
      for (let s = 0; s < radialSegs; s++) {
        const sn = (s + 1) % radialSegs;
        indices.push(rowA + s, rowB + sn, rowA + sn);
        indices.push(rowA + s, rowB + s, rowB + sn);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return trackGeo(g);
  }

  const geoFlameCoreTongue = createFlameTongueGeo(0.145, 0.145, 0.48, 0.02, -0.015, 1.1);
  const geoFlameMidTongue = createFlameTongueGeo(0.225, 0.215, 0.70, 0.055, 0.03, 1.9);
  const geoFlameOuterLickA = createFlameTongueGeo(0.145, 0.125, 0.58, 0.085, 0.04, 2.4);
  const geoFlameOuterLickB = createFlameTongueGeo(0.125, 0.115, 0.46, -0.075, 0.05, -2.1);

  const matEmberBed = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b2218,
      emissive: 0xff6e1a,
      emissiveIntensity: 1.35,
      roughness: 0.85,
      metalness: 0.12,
      flatShading: true,
    })
  );
  const matFlameMid = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffc662,
      emissive: 0xff8224,
      emissiveIntensity: 1.95,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.90,
      depthWrite: false,
    })
  );
  const matFlameOuter = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffd27a,
      emissive: 0xff9f32,
      emissiveIntensity: 1.85,
      roughness: 0.15,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );
  const matFlameCore = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfff5cf,
    })
  );

  const brazierCoords = [
    [-6.4, COL_BASE_Y, -5.32],
    [6.4, COL_BASE_Y, -5.32],
    [-10.22, COL_BASE_Y, -3.0],
    [10.22, COL_BASE_Y, -3.0],
    [-10.22, COL_BASE_Y, 1.8],
    [10.22, COL_BASE_Y, 1.8],
  ];

  for (let i = 0; i < brazierCoords.length; i++) {
    const [bx, by, bz] = brazierCoords[i];
    const bGrp = new THREE.Group();
    bGrp.position.set(bx, by, bz);

    // 1. Carved stepped octagonal marble pedestal with fluted baluster shaft
    const plinth = new THREE.Mesh(geoBrazPlinth, matMarbleTrim);
    plinth.position.y = 0.07;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    bGrp.add(plinth);

    const ped = new THREE.Mesh(geoBrazPedestal, matMarble);
    ped.position.y = 0.14;
    ped.castShadow = true;
    ped.receiveShadow = true;
    bGrp.add(ped);

    const pedGold = new THREE.Mesh(geoBrazPedGold, matGold);
    pedGold.position.y = 0.78;
    bGrp.add(pedGold);

    const capLow = new THREE.Mesh(geoPedCapLow, matMarble);
    capLow.position.y = 0.89;
    bGrp.add(capLow);

    const capTop = new THREE.Mesh(geoPedCapTop, matMarbleTrim);
    capTop.position.y = 0.955;
    capTop.castShadow = true;
    bGrp.add(capTop);

    // 2. Merged forged S-scroll cast-iron cradle + 8 openwork cage ribs & gold scrollwork crown
    const scrollCage = new THREE.Mesh(geoIronScrollCage, matWroughtIron);
    scrollCage.castShadow = true;
    bGrp.add(scrollCage);

    const goldCrown = new THREE.Mesh(geoGoldScrollCrown, matGold);
    bGrp.add(goldCrown);

    const centerBoss = new THREE.Mesh(geoCenterFinial, matGold);
    centerBoss.position.y = 1.15;
    bGrp.add(centerBoss);

    // 3. Scalloped cast-iron lower basin + cinch hoop & gold crown rim
    const dish = new THREE.Mesh(geoIronDish, matWroughtIron);
    dish.position.y = 1.22;
    dish.castShadow = true;
    bGrp.add(dish);

    const midHoop = new THREE.Mesh(geoMidIronHoop, matWroughtIron);
    midHoop.position.y = 1.47;
    bGrp.add(midHoop);

    for (let b = 0; b < 4; b++) {
      const ang = (b * Math.PI) / 2;
      const boss = new THREE.Mesh(geoHoopBoss, matGold);
      boss.position.set(Math.cos(ang) * 0.48, 1.47, Math.sin(ang) * 0.48);
      bGrp.add(boss);
    }

    const upperRim = new THREE.Mesh(geoUpperGoldRim, matGold);
    upperRim.position.y = 1.58;
    bGrp.add(upperRim);

    // Glowing charcoal ember bed visible through the openwork cast-iron ribs
    const emberBed = new THREE.Mesh(geoEmberBed, matEmberBed);
    emberBed.position.y = 1.36;
    bGrp.add(emberBed);

    // 4. Multi-layered dynamic leaping 3D flame tongues (red-gold core + central tongue + 4 encircling licks)
    const flameCore = new THREE.Mesh(geoFlameCoreTongue, matFlameCore);
    flameCore.position.set(0, 1.46, 0);
    bGrp.add(flameCore);

    const flameMid = new THREE.Mesh(geoFlameMidTongue, matFlameMid);
    flameMid.position.set(0, 1.45, 0);
    flameMid.renderOrder = 3;
    bGrp.add(flameMid);

    const outerTongueConfigs = [
      { geo: geoFlameOuterLickA, r: 0.14, ang: 0.3 + i * 0.7, baseY: 1.46, sy: 1.05, tilt: 0.14, speed: 1.12 },
      { geo: geoFlameOuterLickB, r: 0.15, ang: 1.9 + i * 0.7, baseY: 1.47, sy: 0.94, tilt: 0.17, speed: 1.28 },
      { geo: geoFlameOuterLickA, r: 0.13, ang: 3.5 + i * 0.7, baseY: 1.45, sy: 0.98, tilt: 0.15, speed: 1.04 },
      { geo: geoFlameOuterLickB, r: 0.16, ang: 5.0 + i * 0.7, baseY: 1.46, sy: 0.88, tilt: 0.19, speed: 1.35 },
    ];
    const outerTongues = [];
    for (let tIdx = 0; tIdx < outerTongueConfigs.length; tIdx++) {
      const tc = outerTongueConfigs[tIdx];
      const tongue = new THREE.Mesh(tc.geo, matFlameOuter);
      tongue.position.set(Math.cos(tc.ang) * tc.r, tc.baseY, Math.sin(tc.ang) * tc.r);
      tongue.rotation.y = tc.ang;
      tongue.renderOrder = 4;
      bGrp.add(tongue);
      outerTongues.push({
        mesh: tongue,
        baseY: tc.baseY,
        baseRotY: tc.ang,
        baseScaleY: tc.sy,
        tilt: tc.tilt,
        speed: tc.speed,
        phase: i * 1.37 + tIdx * 1.65,
      });
    }

    // Warm billboard halo sprite using softGlowDisc
    const spriteMat = trackMat(
      new THREE.SpriteMaterial({
        color: 0xffc66e,
        map: glowTex,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const halo = new THREE.Sprite(spriteMat);
    halo.position.y = 1.84;
    halo.scale.set(1.85, 1.85, 1);
    bGrp.add(halo);

    // Warm Golden PointLight (calibrated for Three.js r170 physical decay)
    const ptLight = new THREE.PointLight(0xffb554, 15.5, 14.0, 1.65);
    ptLight.position.set(0, 2.02, 0);
    ptLight.castShadow = false;
    bGrp.add(ptLight);

    group.add(bGrp);
    braziers.push({
      light: ptLight,
      flameOuter: flameMid,
      flameInner: flameCore,
      outerTongues,
      emberBed,
      halo,
      baseIntensity: 15.5,
      phase: i * 1.17 + 0.3,
    });

    // Seed 6 rising warm ember sparks per brazier (36 total in 1 InstancedMesh)
    for (let e = 0; e < 6; e++) {
      emberSpecs.push({
        ox: bx,
        oy: by + 1.68,
        oz: bz,
        phase: i * 1.9 + e * 1.05,
        speed: 0.42 + (e % 3) * 0.14,
        radius: 0.12 + (e % 4) * 0.06,
      });
    }
  }

  // Rising warm golden ember sparks above all 6 braziers (1 draw call)
  const geoEmber = trackGeo(new THREE.OctahedronGeometry(0.036, 0));
  const matEmber = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffdf96,
      transparent: true,
      opacity: 0.9,
    })
  );
  const instEmbers = new THREE.InstancedMesh(geoEmber, matEmber, emberSpecs.length);
  group.add(instEmbers);

  // =========================================================================
  // 11. FOREGROUND TILT-SHIFT DEPTH FRAMING
  //     Strictly confined to z in [8.5, 9.8], |x| > 6.5, y < 1.1
  //     Zero intrusion into combat sightline from camera (0, 5.2, 13.8)!
  // =========================================================================
  function buildForegroundTiltShiftDecor() {
    const fg = new THREE.Group();
    group.add(fg);

    // Carved Gothic corner gallery pier geometries (peak y <= 1.075 < 1.10)
    const geoFgPlinthLow = trackGeo(new THREE.BoxGeometry(0.82, 0.12, 0.82));
    const geoFgPlinthTop = trackGeo(new THREE.BoxGeometry(0.72, 0.08, 0.72));
    const geoFgPierCore = trackGeo(new THREE.BoxGeometry(0.56, 0.58, 0.56));
    const geoFgCornerPilaster = trackGeo(new THREE.BoxGeometry(0.135, 0.58, 0.135));
    const geoFgPierGold = trackGeo(new THREE.BoxGeometry(0.68, 0.024, 0.68));
    const geoFgCapLow = trackGeo(new THREE.BoxGeometry(0.74, 0.055, 0.74));
    const geoFgCapTop = trackGeo(new THREE.BoxGeometry(0.86, 0.085, 0.86));
    const geoFgPierSnow = createSnowDriftGeometry(0.42, 0.135, 0.42, 3.6);

    // Molded foreground balustrade rails + soft wind-sculpted snow ribbon
    const geoFgBotRail = trackGeo(new THREE.BoxGeometry(3.24, 0.12, 0.30));
    const geoFgBotStep = trackGeo(new THREE.BoxGeometry(3.18, 0.05, 0.24));
    const geoFgTopRail = trackGeo(new THREE.BoxGeometry(3.24, 0.08, 0.28));
    const geoFgTopLip = trackGeo(new THREE.BoxGeometry(3.16, 0.045, 0.21));
    const geoFgRailGold = trackGeo(new THREE.BoxGeometry(3.18, 0.018, 0.23));
    const geoFgRailSnow = createSnowDriftGeometry(1.56, 0.08, 0.13, 6.2);

    // Delicate faceted crystal icicles for foreground cornice & pine branches
    const geoFgIcicleLong = trackGeo(new THREE.ConeGeometry(0.018, 0.20, 5));
    geoFgIcicleLong.rotateX(Math.PI);
    const geoFgIcicleShort = trackGeo(new THREE.ConeGeometry(0.014, 0.13, 5));
    geoFgIcicleShort.rotateX(Math.PI);

    // Sculpted radiating pine-needle spray fan (replaces crude cone tufts!)
    function createNeedleSprayPair(length = 0.44, width = 0.26, seed = 0) {
      const nPos = [];
      const nNorm = [];
      const sPos = [];
      const sNorm = [];
      const ab = new THREE.Vector3();
      const ac = new THREE.Vector3();
      const fn = new THREE.Vector3();

      function addDoubleFace(posArr, normArr, a, b, c) {
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        fn.crossVectors(ab, ac);
        const len = fn.length();
        if (len < 1e-7) return;
        fn.divideScalar(len);
        if (fn.y < 0) {
          fn.negate();
          const tmp = b;
          b = c;
          c = tmp;
        }
        // Top face
        posArr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        normArr.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
        // Solid underside face
        posArr.push(a.x, a.y - 0.018, a.z, c.x, c.y - 0.018, c.z, b.x, b.y - 0.018, b.z);
        normArr.push(-fn.x, -fn.y, -fn.z, -fn.x, -fn.y, -fn.z, -fn.x, -fn.y, -fn.z);
      }

      // 7 radiating serrated needle fronds fanning forward along +Z
      const rays = 7;
      const root = new THREE.Vector3(0, 0.01, 0);
      for (let i = 0; i < rays; i++) {
        const u = (i / (rays - 1)) * 2 - 1; // -1 .. +1
        const fanAng = u * 0.92 + Math.sin(i * 2.1 + seed) * 0.06;
        const rLen = length * (0.64 + 0.36 * Math.cos(u * Math.PI * 0.5)) * (0.92 + 0.14 * Math.sin(i * 3.1 + seed));
        const rHalfW = width * 0.21 * (1.0 - 0.22 * Math.abs(u));
        const droopY = -0.055 * (rLen / length) + 0.025 * (1 - Math.abs(u));

        const dirX = Math.sin(fanAng);
        const dirZ = Math.cos(fanAng);
        const perpX = dirZ;
        const perpZ = -dirX;

        const mid = new THREE.Vector3(dirX * rLen * 0.56, 0.025 + droopY * 0.35, dirZ * rLen * 0.56);
        const tip = new THREE.Vector3(dirX * rLen, droopY, dirZ * rLen);
        const left = new THREE.Vector3(mid.x - perpX * rHalfW, mid.y - 0.016, mid.z - perpZ * rHalfW);
        const right = new THREE.Vector3(mid.x + perpX * rHalfW, mid.y - 0.016, mid.z + perpZ * rHalfW);

        addDoubleFace(nPos, nNorm, root, left, mid);
        addDoubleFace(nPos, nNorm, root, mid, right);
        addDoubleFace(nPos, nNorm, left, tip, mid);
        addDoubleFace(nPos, nNorm, mid, tip, right);

        // Pillowed snow crust clinging softly atop the central & inner needle fronds
        if (Math.abs(u) < 0.85) {
          const sRoot = new THREE.Vector3(0, 0.036, 0.02);
          const sMid = new THREE.Vector3(dirX * rLen * 0.50, 0.064 + droopY * 0.3, dirZ * rLen * 0.50);
          const sTip = new THREE.Vector3(dirX * rLen * 0.80, droopY + 0.022, dirZ * rLen * 0.80);
          const sL = new THREE.Vector3(sMid.x - perpX * rHalfW * 0.82, sMid.y - 0.022, sMid.z - perpZ * rHalfW * 0.82);
          const sR = new THREE.Vector3(sMid.x + perpX * rHalfW * 0.82, sMid.y - 0.022, sMid.z + perpZ * rHalfW * 0.82);
          addDoubleFace(sPos, sNorm, sRoot, sL, sMid);
          addDoubleFace(sPos, sNorm, sRoot, sMid, sR);
          addDoubleFace(sPos, sNorm, sL, sTip, sMid);
          addDoubleFace(sPos, sNorm, sMid, sTip, sR);
        }
      }

      const needleGeo = new THREE.BufferGeometry();
      needleGeo.setAttribute('position', new THREE.Float32BufferAttribute(nPos, 3));
      needleGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nNorm, 3));

      const snowGeo = new THREE.BufferGeometry();
      snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
      snowGeo.setAttribute('normal', new THREE.Float32BufferAttribute(sNorm, 3));

      return { needleGeo: trackGeo(needleGeo), snowGeo: trackGeo(snowGeo) };
    }

    const sprayLarge = createNeedleSprayPair(0.50, 0.34, 0.6);
    const sprayMed = createNeedleSprayPair(0.38, 0.26, 2.1);

    for (const side of [-1, 1]) {
      // 1. Carved Gothic corner gallery pier at x = ±6.95, z = 8.95, peak y = 1.07 < 1.10
      const pierGrp = new THREE.Group();
      pierGrp.position.set(side * 6.95, 0, 8.95);
      fg.add(pierGrp);

      const pLow = new THREE.Mesh(geoFgPlinthLow, matMarbleTrim);
      pLow.position.y = 0.06;
      pLow.receiveShadow = true;
      pierGrp.add(pLow);

      const pTop = new THREE.Mesh(geoFgPlinthTop, matMarble);
      pTop.position.y = 0.16;
      pierGrp.add(pTop);

      const pCore = new THREE.Mesh(geoFgPierCore, matMarble);
      pCore.position.y = 0.49;
      pCore.receiveShadow = true;
      pierGrp.add(pCore);

      // 4 corner pilasters forming authentic recessed stone Gothic panels on all 4 sides
      for (const cx of [-0.26, 0.26]) {
        for (const cz of [-0.26, 0.26]) {
          const pil = new THREE.Mesh(geoFgCornerPilaster, matMarbleTrim);
          pil.position.set(cx, 0.49, cz);
          pierGrp.add(pil);
        }
      }

      const pGold = new THREE.Mesh(geoFgPierGold, matGold);
      pGold.position.y = 0.78;
      pierGrp.add(pGold);

      const capLow = new THREE.Mesh(geoFgCapLow, matMarble);
      capLow.position.y = 0.82;
      pierGrp.add(capLow);

      const capTop = new THREE.Mesh(geoFgCapTop, matMarbleTrim);
      capTop.position.y = 0.895;
      pierGrp.add(capTop);

      const pierSnow = new THREE.Mesh(geoFgPierSnow, matSnow);
      pierSnow.position.y = 0.935; // peak y = 1.07 < 1.10
      pierGrp.add(pierSnow);

      // Tiny crystal icicles hanging cleanly beneath the overhanging pier cornice
      for (const [ix, iz, long] of [
        [-0.36, 0.36, true],
        [0.36, 0.36, false],
        [side * -0.36, -0.32, false],
        [0.08, 0.39, true],
      ]) {
        const ic = new THREE.Mesh(long ? geoFgIcicleLong : geoFgIcicleShort, matIcicle);
        ic.position.set(ix, long ? 0.76 : 0.79, iz);
        pierGrp.add(ic);
      }

      // 2. Low classical vase-baluster balustrade extending outward |x| = 7.1 .. 10.3, z = 9.05 .. 9.35
      const railGrp = new THREE.Group();
      railGrp.position.set(side * 8.65, 0, 9.15);
      railGrp.rotation.y = side * 0.10;

      const botPlinth = new THREE.Mesh(geoFgBotRail, matMarbleTrim);
      botPlinth.position.y = 0.06;
      railGrp.add(botPlinth);

      const botStep = new THREE.Mesh(geoFgBotStep, matMarble);
      botStep.position.y = 0.145;
      railGrp.add(botStep);

      const topRail = new THREE.Mesh(geoFgTopRail, matMarble);
      topRail.position.y = 0.75;
      railGrp.add(topRail);

      const topLip = new THREE.Mesh(geoFgTopLip, matMarbleTrim);
      topLip.position.y = 0.695;
      railGrp.add(topLip);

      const railGold = new THREE.Mesh(geoFgRailGold, matGold);
      railGold.position.y = 0.718;
      railGrp.add(railGold);

      const railSnow = new THREE.Mesh(geoFgRailSnow, matSnow);
      railSnow.position.y = 0.785;
      railGrp.add(railSnow);

      // Reuse LatheGeometry classical vase balusters for unified architectural elegance
      for (let b = -3; b <= 3; b++) {
        const bal = new THREE.Mesh(geoBaluster, matMarble);
        bal.position.set(b * 0.44, 0.425, 0);
        bal.scale.set(0.92, 0.74, 0.92);
        railGrp.add(bal);
      }

      // Subtle hanging frost icicles under the foreground balustrade rail
      for (let icIdx = -2; icIdx <= 2; icIdx++) {
        const ic = new THREE.Mesh(icIdx % 2 === 0 ? geoFgIcicleLong : geoFgIcicleShort, matIcicle);
        ic.position.set(icIdx * 0.58 + 0.12, icIdx % 2 === 0 ? 0.59 : 0.62, 0.12);
        railGrp.add(ic);
      }
      fg.add(railGrp);

      // 3. Realistic multi-forked snow-draped winter pine boughs & vertical icicles (strictly y < 1.02!)
      const boughGrp = new THREE.Group();
      boughGrp.position.set(side * 9.35, 0.54, 9.52);
      fg.add(boughGrp);

      // Main curving woody cedar bough sweeping inward toward x ≈ ±7.45, keeping z in [9.15, 9.65]
      const mainPts = [
        new THREE.Vector3(0, 0.12, 0.08),
        new THREE.Vector3(-side * 0.55, 0.24, -0.02),
        new THREE.Vector3(-side * 1.15, 0.16, -0.14),
        new THREE.Vector3(-side * 1.72, 0.04, -0.22),
      ];
      const mainCurve = new THREE.CatmullRomCurve3(mainPts);
      const mainBranch = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(mainCurve, 14, 0.036, 7, false)), matBark);
      boughGrp.add(mainBranch);

      // 3 natural forked lateral twigs splitting off the main bough
      const forkSpecs = [
        [
          new THREE.Vector3(-side * 0.48, 0.22, -0.01),
          new THREE.Vector3(-side * 0.84, 0.30, 0.14),
          new THREE.Vector3(-side * 1.18, 0.22, 0.22),
        ],
        [
          new THREE.Vector3(-side * 0.88, 0.20, -0.08),
          new THREE.Vector3(-side * 1.24, 0.26, -0.30),
          new THREE.Vector3(-side * 1.54, 0.18, -0.40),
        ],
        [
          new THREE.Vector3(-side * 1.20, 0.14, -0.14),
          new THREE.Vector3(-side * 1.52, 0.18, 0.06),
          new THREE.Vector3(-side * 1.82, 0.10, 0.14),
        ],
      ];
      for (const fPts of forkSpecs) {
        const fCurve = new THREE.CatmullRomCurve3(fPts);
        const fMesh = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(fCurve, 10, 0.021, 6, false)), matBark);
        boughGrp.add(fMesh);
      }

      // Layered pine-needle spray clusters + snow pillows along main bough & all 3 forks
      const sprayPlacements = [
        { p: [-side * 0.45, 0.22, 0.02], ry: side > 0 ? -1.45 : 1.45, rx: 0.10, sc: 1.08, big: true, mat: matPineDeep },
        { p: [-side * 0.88, 0.22, -0.06], ry: side > 0 ? -1.70 : 1.70, rx: 0.14, sc: 1.02, big: true, mat: matPineDark },
        { p: [-side * 1.32, 0.13, -0.16], ry: side > 0 ? -1.52 : 1.52, rx: 0.16, sc: 0.96, big: true, mat: matPineLight },
        { p: [-side * 1.66, 0.05, -0.21], ry: side > 0 ? -1.62 : 1.62, rx: 0.18, sc: 0.84, big: false, mat: matPineLight },
        // Fork sprays
        { p: [-side * 0.84, 0.28, 0.14], ry: side > 0 ? -0.95 : 0.95, rx: 0.12, sc: 0.92, big: false, mat: matPineLight },
        { p: [-side * 1.12, 0.22, 0.20], ry: side > 0 ? -1.15 : 1.15, rx: 0.16, sc: 0.82, big: false, mat: matPineDark },
        { p: [-side * 1.24, 0.24, -0.28], ry: side > 0 ? -2.25 : 2.25, rx: 0.12, sc: 0.92, big: false, mat: matPineDark },
        { p: [-side * 1.50, 0.17, -0.37], ry: side > 0 ? -2.10 : 2.10, rx: 0.16, sc: 0.80, big: false, mat: matPineLight },
        { p: [-side * 1.56, 0.15, 0.07], ry: side > 0 ? -1.10 : 1.10, rx: 0.15, sc: 0.86, big: false, mat: matPineLight },
      ];
      for (const sp of sprayPlacements) {
        const pair = sp.big ? sprayLarge : sprayMed;
        const nMesh = new THREE.Mesh(pair.needleGeo, sp.mat);
        nMesh.position.set(sp.p[0], sp.p[1], sp.p[2]);
        nMesh.rotation.set(sp.rx, sp.ry, 0);
        nMesh.scale.setScalar(sp.sc);
        boughGrp.add(nMesh);

        const sMesh = new THREE.Mesh(pair.snowGeo, matSnow);
        sMesh.position.set(sp.p[0], sp.p[1], sp.p[2]);
        sMesh.rotation.set(sp.rx, sp.ry, 0);
        sMesh.scale.setScalar(sp.sc);
        boughGrp.add(sMesh);
      }

      // 6 vertical hanging crystal icicles suspended from the underside of the snow-laden boughs
      const branchIcicles = [
        { p: [-side * 0.62, 0.12, 0.02], long: true },
        { p: [-side * 1.06, 0.10, 0.18], long: false },
        { p: [-side * 1.26, 0.04, -0.16], long: true },
        { p: [-side * 1.48, 0.08, -0.34], long: false },
        { p: [-side * 1.68, -0.04, -0.20], long: true },
        { p: [-side * 1.74, 0.02, 0.11], long: false },
      ];
      for (const bi of branchIcicles) {
        const ic = new THREE.Mesh(bi.long ? geoFgIcicleLong : geoFgIcicleShort, matIcicle);
        ic.position.set(bi.p[0], bi.p[1], bi.p[2]);
        boughGrp.add(ic);
      }
    }
  }
  buildForegroundTiltShiftDecor();

  // =========================================================================
  // 12. MOOD VARIANTS & SMOOTH LIGHTING/SKY/BRAZIER TRANSITIONS
  // =========================================================================
  const ACADEMY_MOODS = {
    sunny_snow: {
      subtitle: '雪霁晴空 · 皇家哥特回廊',
      hemiSky: 0xd9ecff, hemiGround: 0xd8e2f0, hemiInt: 1.38,
      sunColor: 0xfff6e8, sunInt: 2.25,
      fillColor: 0xe5f1ff, fillInt: 0.85,
      ambColor: 0xdce8f8, ambInt: 0.34,
      corridorFireColor: 0xff8a3c, corridorFireInt: 0.0,
      skyZenith: 0x3f7de0, skyMid: 0x94c4f5, skyHorizon: 0xeef5fc,
      skySunWarm: 0xfff4d9, skyLowerMist: 0xd6e5f7, skyCloudTint: 0xf5faff, skySunStrength: 1.0,
      peakNear: 0xd5e5f7, peakFar: 0xc9ddf5, peakCap: 0xeef5fd,
      floorRough: 0.78, iceEmissiveInt: 0.52, iceAuraOp: 0.32,
      stainedEmissive: 0x4f8eff, stainedInt: 0.92,
      roseEmissive: 0x6ba7ff, roseInt: 1.15,
      belfryEmissive: 0xffc668, belfryInt: 1.05,
      arcaneColor: 0x70c7ff, innerArcaneColor: 0xffe49c,
      brazierColor: 0xffb554, brazierInt: 15.5, brazierDist: 14.0,
      flameColor: 0xffd27a, flameEmissive: 0xff9f32, flameEmissiveInt: 1.85,
      haloColor: 0xffc66e, haloScale: 1.85, emberColor: 0xffdf96,
      brazierPulseAmp: 1.0, brazierPulseFreq: 1.0,
      emberHeight: 1.15, emberSpeed: 1.0, emberScale: 1.05,
      bannerWindMul: 1.0,
      fog: { color: 0xdbe8f8, near: 18, far: 54 },
      background: 0xcbe0f7,
      atmospherePreset: {
        particleType: 'snow', particleColor: 0xffffff, particleSecondaryColor: 0xcce5ff,
        particleCount: 420, particleSpeed: 1.0, particleWind: 1.0,
        godRayColor: 0xfff3d6, godRayOpacity: 0.22, godRayOrigin: [-7, 13, -10],
        bloomStrength: 0.34, bloomThreshold: 0.92, bloomRadius: 0.60,
        focusDepth: 0.56, blurAmount: 1.7, vignetteStrength: 0.14,
        spriteRimTint: [1.0, 1.0, 1.02],
      },
    },
    breeze_day: {
      subtitle: '晴朗微风 · 暖雪庭院',
      hemiSky: 0xdcf0ff, hemiGround: 0xe6e7ee, hemiInt: 1.44,
      sunColor: 0xfff2d2, sunInt: 2.42,
      fillColor: 0xedf4ff, fillInt: 0.90,
      ambColor: 0xe4edf9, ambInt: 0.38,
      corridorFireColor: 0xffb25a, corridorFireInt: 0.0,
      skyZenith: 0x3480ea, skyMid: 0x90ccf9, skyHorizon: 0xf4f7f5,
      skySunWarm: 0xffefc6, skyLowerMist: 0xdfe9f5, skyCloudTint: 0xfffdf8, skySunStrength: 1.08,
      peakNear: 0xdce9f7, peakFar: 0xcfe2f6, peakCap: 0xf6f9fd,
      floorRough: 0.76, iceEmissiveInt: 0.50, iceAuraOp: 0.30,
      stainedEmissive: 0x5c9cff, stainedInt: 0.96,
      roseEmissive: 0x7bb4ff, roseInt: 1.18,
      belfryEmissive: 0xffd07a, belfryInt: 1.12,
      arcaneColor: 0x7fd4ff, innerArcaneColor: 0xffebb0,
      brazierColor: 0xffc268, brazierInt: 14.5, brazierDist: 13.5,
      flameColor: 0xffda8c, flameEmissive: 0xffab44, flameEmissiveInt: 1.78,
      haloColor: 0xffd282, haloScale: 1.82, emberColor: 0xffe6a8,
      brazierPulseAmp: 1.05, brazierPulseFreq: 1.1,
      emberHeight: 1.25, emberSpeed: 1.15, emberScale: 1.02,
      bannerWindMul: 1.38,
      fog: { color: 0xe3eef9, near: 20, far: 58 },
      background: 0xd2e6fa,
      atmospherePreset: {
        particleType: 'snow', particleColor: 0xfffdf8, particleSecondaryColor: 0xdff2ff,
        particleCount: 340, particleSpeed: 1.18, particleWind: 1.85,
        godRayColor: 0xffefc6, godRayOpacity: 0.20, godRayOrigin: [-7, 13, -10],
        bloomStrength: 0.32, bloomThreshold: 0.94, bloomRadius: 0.62,
        focusDepth: 0.56, blurAmount: 1.65, vignetteStrength: 0.12,
        spriteRimTint: [1.03, 1.02, 0.98],
      },
    },
    frost_mirror: {
      subtitle: '晶莹冰镜 · 极光演武庭',
      hemiSky: 0xc4ebff, hemiGround: 0xcce4f8, hemiInt: 1.52,
      sunColor: 0xf2faff, sunInt: 2.38,
      fillColor: 0xcbeeff, fillInt: 1.04,
      ambColor: 0xcfe8fb, ambInt: 0.42,
      corridorFireColor: 0x7ce6ff, corridorFireInt: 0.0,
      skyZenith: 0x266cdf, skyMid: 0x7cc8fa, skyHorizon: 0xe2f6ff,
      skySunWarm: 0xe6f8ff, skyLowerMist: 0xcce9fb, skyCloudTint: 0xf0fbff, skySunStrength: 1.05,
      peakNear: 0xcce8fa, peakFar: 0xbcdff7, peakCap: 0xf0faff,
      floorRough: 0.56, iceEmissiveInt: 0.90, iceAuraOp: 0.55,
      stainedEmissive: 0x45b8ff, stainedInt: 1.18,
      roseEmissive: 0x70d8ff, roseInt: 1.38,
      belfryEmissive: 0x9ceeff, belfryInt: 1.25,
      arcaneColor: 0x62e2ff, innerArcaneColor: 0xd6f6ff,
      brazierColor: 0x9eeeff, brazierInt: 17.0, brazierDist: 15.0,
      flameColor: 0xc4f6ff, flameEmissive: 0x52d4ff, flameEmissiveInt: 2.05,
      haloColor: 0x92eeff, haloScale: 1.98, emberColor: 0xc8f6ff,
      brazierPulseAmp: 0.92, brazierPulseFreq: 0.95,
      emberHeight: 1.32, emberSpeed: 0.92, emberScale: 1.10,
      bannerWindMul: 0.84,
      fog: { color: 0xd0eafc, near: 18, far: 54 },
      background: 0xbee2fb,
      atmospherePreset: {
        particleType: 'iceDust', particleColor: 0x9ef0ff, particleSecondaryColor: 0xffffff,
        particleCount: 470, particleSpeed: 1.0, particleWind: 1.0,
        godRayColor: 0xdaf5ff, godRayOpacity: 0.20, godRayOrigin: [-7, 13, -10],
        bloomStrength: 0.34, bloomThreshold: 0.92, bloomRadius: 0.65,
        focusDepth: 0.56, blurAmount: 1.7, vignetteStrength: 0.13,
        spriteRimTint: [0.95, 1.01, 1.03],
      },
    },
    thaw_twilight: {
      subtitle: '薄暮蓝金 · 晚霞融雪庭',
      hemiSky: 0xa4bcf0, hemiGround: 0xdec4b4, hemiInt: 1.24,
      sunColor: 0xffd29a, sunInt: 2.15,
      fillColor: 0xcce0ff, fillInt: 0.86,
      ambColor: 0xc8cce8, ambInt: 0.38,
      corridorFireColor: 0xffaa5c, corridorFireInt: 2.8,
      skyZenith: 0x2f4fa6, skyMid: 0x8696d4, skyHorizon: 0xf8cda0,
      skySunWarm: 0xffc682, skyLowerMist: 0xd6b8c4, skyCloudTint: 0xffe8d2, skySunStrength: 0.96,
      peakNear: 0xd4c6de, peakFar: 0xbcb8dc, peakCap: 0xfce6d2,
      floorRough: 0.70, iceEmissiveInt: 0.62, iceAuraOp: 0.38,
      stainedEmissive: 0x7c9eff, stainedInt: 1.12,
      roseEmissive: 0xffc482, roseInt: 1.32,
      belfryEmissive: 0xffba5c, belfryInt: 1.52,
      arcaneColor: 0x84c4ff, innerArcaneColor: 0xffd685,
      brazierColor: 0xffa64a, brazierInt: 22.0, brazierDist: 16.5,
      flameColor: 0xffc86c, flameEmissive: 0xff8b28, flameEmissiveInt: 2.25,
      haloColor: 0xffb65e, haloScale: 2.15, emberColor: 0xffd082,
      brazierPulseAmp: 1.20, brazierPulseFreq: 1.10,
      emberHeight: 1.55, emberSpeed: 1.12, emberScale: 1.18,
      bannerWindMul: 1.08,
      fog: { color: 0xdacde4, near: 17, far: 52 },
      background: 0xc4bcde,
      atmospherePreset: {
        particleType: 'snow', particleColor: 0xfff5e6, particleSecondaryColor: 0xcadfff,
        particleCount: 360, particleSpeed: 0.95, particleWind: 1.25,
        godRayColor: 0xffd49a, godRayOpacity: 0.30, godRayOrigin: [-7, 13, -10],
        bloomStrength: 0.42, bloomThreshold: 0.76, bloomRadius: 0.64,
        focusDepth: 0.56, blurAmount: 1.65, vignetteStrength: 0.14,
        spriteRimTint: [1.06, 0.99, 0.96],
      },
    },
    fire_corridor: {
      subtitle: '暮夜火廊 · 东翼赤金突围',
      hemiSky: 0x7ca6eb, hemiGround: 0xb8744e, hemiInt: 1.14,
      sunColor: 0xffb472, sunInt: 1.58,
      fillColor: 0xc4dcff, fillInt: 0.94,
      ambColor: 0x8ea4cc, ambInt: 0.50,
      corridorFireColor: 0xff8838, corridorFireInt: 9.8,
      skyZenith: 0x1b3068, skyMid: 0x324b8a, skyHorizon: 0x946058,
      skySunWarm: 0xff8e42, skyLowerMist: 0x454263, skyCloudTint: 0xc2928c, skySunStrength: 0.42,
      peakNear: 0x7a88ad, peakFar: 0x5c6d99, peakCap: 0xbfaed0,
      floorRough: 0.68, iceEmissiveInt: 0.60, iceAuraOp: 0.34,
      stainedEmissive: 0xff9448, stainedInt: 1.28,
      roseEmissive: 0xff8e44, roseInt: 1.58,
      belfryEmissive: 0xff9c3e, belfryInt: 1.92,
      arcaneColor: 0xffa652, innerArcaneColor: 0xffdf8c,
      brazierColor: 0xff7a2a, brazierInt: 36.0, brazierDist: 22.0,
      flameColor: 0xffaa44, flameEmissive: 0xff5a18, flameEmissiveInt: 2.85,
      haloColor: 0xff8d38, haloScale: 2.85, emberColor: 0xff9e44,
      brazierPulseAmp: 1.65, brazierPulseFreq: 1.28,
      emberHeight: 2.60, emberSpeed: 1.38, emberScale: 1.48,
      bannerWindMul: 1.48,
      fog: { color: 0x4b5378, near: 18, far: 54 },
      background: 0x35406b,
      atmospherePreset: {
        particleType: 'embers', particleColor: 0xffb84d, particleSecondaryColor: 0xff5a22,
        particleCount: 480, particleSpeed: 1.25, particleWind: 1.35,
        godRayColor: 0xffa65c, godRayOpacity: 0.24, godRayOrigin: [-7, 13, -10],
        bloomStrength: 0.48, bloomThreshold: 0.74, bloomRadius: 0.66,
        focusDepth: 0.56, blurAmount: 1.55, vignetteStrength: 0.13,
        spriteRimTint: [1.10, 0.96, 0.88],
      },
    },
    fire_corridor_p2: {
      subtitle: '红莲铁幕 · 炽焰脉动二阶段',
      hemiSky: 0x7aa2eb, hemiGround: 0xcc7244, hemiInt: 1.18,
      sunColor: 0xffa35e, sunInt: 1.68,
      fillColor: 0xc2ddff, fillInt: 0.98,
      ambColor: 0x90a2cc, ambInt: 0.52,
      corridorFireColor: 0xff6f28, corridorFireInt: 14.2,
      skyZenith: 0x182a5e, skyMid: 0x36447c, skyHorizon: 0xb5644a,
      skySunWarm: 0xff7630, skyLowerMist: 0x4f3f5d, skyCloudTint: 0xd69682, skySunStrength: 0.52,
      peakNear: 0x7e83a8, peakFar: 0x616992, peakCap: 0xd2b0c6,
      floorRough: 0.64, iceEmissiveInt: 0.65, iceAuraOp: 0.36,
      stainedEmissive: 0xff7d34, stainedInt: 1.52,
      roseEmissive: 0xff7430, roseInt: 1.90,
      belfryEmissive: 0xff842b, belfryInt: 2.25,
      arcaneColor: 0xff8b3d, innerArcaneColor: 0xffd274,
      brazierColor: 0xff6220, brazierInt: 48.0, brazierDist: 25.0,
      flameColor: 0xff9b38, flameEmissive: 0xff4612, flameEmissiveInt: 3.45,
      haloColor: 0xff7528, haloScale: 3.40, emberColor: 0xff7e30,
      brazierPulseAmp: 2.45, brazierPulseFreq: 1.55,
      emberHeight: 3.40, emberSpeed: 1.68, emberScale: 1.78,
      bannerWindMul: 1.85,
      fog: { color: 0x564d70, near: 16, far: 50 },
      background: 0x3c3a62,
      atmospherePreset: {
        particleType: 'embers', particleColor: 0xffc45c, particleSecondaryColor: 0xff4418,
        particleCount: 680, particleSpeed: 1.65, particleWind: 1.75,
        godRayColor: 0xff9244, godRayOpacity: 0.30, godRayOrigin: [-7, 13, -10],
        bloomStrength: 0.56, bloomThreshold: 0.70, bloomRadius: 0.72,
        focusDepth: 0.56, blurAmount: 1.50, vignetteStrength: 0.14,
        spriteRimTint: [1.14, 0.94, 0.84],
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
      corridorFireColor: new THREE.Color(cfg.corridorFireColor),
      corridorFireInt: cfg.corridorFireInt,
      skyZenith: new THREE.Color(cfg.skyZenith),
      skyMid: new THREE.Color(cfg.skyMid),
      skyHorizon: new THREE.Color(cfg.skyHorizon),
      skySunWarm: new THREE.Color(cfg.skySunWarm),
      skyLowerMist: new THREE.Color(cfg.skyLowerMist),
      skyCloudTint: new THREE.Color(cfg.skyCloudTint),
      skySunStrength: cfg.skySunStrength,
      peakNear: new THREE.Color(cfg.peakNear),
      peakFar: new THREE.Color(cfg.peakFar),
      peakCap: new THREE.Color(cfg.peakCap),
      floorRough: cfg.floorRough,
      iceEmissiveInt: cfg.iceEmissiveInt,
      iceAuraOp: cfg.iceAuraOp,
      stainedEmissive: new THREE.Color(cfg.stainedEmissive),
      stainedInt: cfg.stainedInt,
      roseEmissive: new THREE.Color(cfg.roseEmissive),
      roseInt: cfg.roseInt,
      belfryEmissive: new THREE.Color(cfg.belfryEmissive),
      belfryInt: cfg.belfryInt,
      arcaneColor: new THREE.Color(cfg.arcaneColor),
      innerArcaneColor: new THREE.Color(cfg.innerArcaneColor),
      brazierColor: new THREE.Color(cfg.brazierColor),
      brazierInt: cfg.brazierInt,
      brazierDist: cfg.brazierDist,
      flameColor: new THREE.Color(cfg.flameColor),
      flameEmissive: new THREE.Color(cfg.flameEmissive),
      flameEmissiveInt: cfg.flameEmissiveInt,
      haloColor: new THREE.Color(cfg.haloColor),
      haloScale: cfg.haloScale,
      emberColor: new THREE.Color(cfg.emberColor),
      brazierPulseAmp: cfg.brazierPulseAmp,
      brazierPulseFreq: cfg.brazierPulseFreq,
      emberHeight: cfg.emberHeight,
      emberSpeed: cfg.emberSpeed,
      emberScale: cfg.emberScale,
      bannerWindMul: cfg.bannerWindMul,
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
  const moodCur = makeMoodSnapshot(ACADEMY_MOODS.sunny_snow);
  const moodFrom = makeMoodSnapshot(ACADEMY_MOODS.sunny_snow);
  const moodTarget = makeMoodSnapshot(ACADEMY_MOODS.sunny_snow);
  const moodTrans = { active: false, elapsed: 0, duration: 0.9 };

  function commitMoodVisuals(s) {
    hemiLight.color.copy(s.hemiSky);
    hemiLight.groundColor.copy(s.hemiGround);
    hemiLight.intensity = s.hemiInt;
    sunLight.color.copy(s.sunColor);
    sunLight.intensity = s.sunInt;
    snowFillLight.color.copy(s.fillColor);
    snowFillLight.intensity = s.fillInt;
    ambientLight.color.copy(s.ambColor);
    ambientLight.intensity = s.ambInt;

    for (let i = 0; i < corridorFireLights.length; i++) {
      corridorFireLights[i].light.color.copy(s.corridorFireColor);
      corridorFireLights[i].light.intensity = s.corridorFireInt;
    }

    skyUniforms.uZenithColor.value.copy(s.skyZenith);
    skyUniforms.uMidSkyColor.value.copy(s.skyMid);
    skyUniforms.uHorizonColor.value.copy(s.skyHorizon);
    skyUniforms.uSunWarmColor.value.copy(s.skySunWarm);
    skyUniforms.uLowerMistColor.value.copy(s.skyLowerMist);
    skyUniforms.uCloudTint.value.copy(s.skyCloudTint);
    skyUniforms.uSunStrength.value = s.skySunStrength;

    matNearPeak.color.copy(s.peakNear);
    matNearPeakSnow.color.copy(s.peakCap);
    matFarPeak.color.copy(s.peakFar);
    matPeakSnowCap.color.copy(s.peakCap);

    matCourtyardFloor.roughness = s.floorRough;
    matIceCrystal.emissiveIntensity = s.iceEmissiveInt * 0.72;
    matIceCore.emissiveIntensity = Math.min(1.45, s.iceEmissiveInt * 1.48);
    matIceAura.opacity = s.iceAuraOp;

    matStainedGlass.emissive.copy(s.stainedEmissive);
    matStainedGlass.emissiveIntensity = s.stainedInt;
    matRoseGlass.emissive.copy(s.roseEmissive);
    matRoseGlass.emissiveIntensity = s.roseInt;
    matBelfryGlow.emissive.copy(s.belfryEmissive);
    matBelfryGlow.emissiveIntensity = s.belfryInt;

    matArcaneDecal.color.copy(s.arcaneColor);
    matInnerArcane.color.copy(s.innerArcaneColor);

    matFlameMid.color.copy(s.flameColor);
    matFlameMid.emissive.copy(s.flameEmissive);
    matFlameMid.emissiveIntensity = s.flameEmissiveInt * 1.05;
    matFlameOuter.color.copy(s.flameColor);
    matFlameOuter.emissive.copy(s.flameEmissive);
    matFlameOuter.emissiveIntensity = s.flameEmissiveInt * 0.96;
    matFlameCore.color.setHex(0xffffff).lerp(s.flameColor, 0.28);
    matEmberBed.emissive.copy(s.flameEmissive);
    matEmberBed.emissiveIntensity = s.flameEmissiveInt * 0.72;
    matEmber.color.copy(s.emberColor);

    for (let i = 0; i < braziers.length; i++) {
      const br = braziers[i];
      br.light.color.copy(s.brazierColor);
      br.light.distance = s.brazierDist;
      br.baseIntensity = s.brazierInt;
      br.halo.material.color.copy(s.haloColor);
    }
  }

  let biomeHandle = null;

  function applyMood(moodId, options = {}) {
    const rawKey = typeof moodId === 'string' ? moodId.trim().toLowerCase() : '';
    const resolvedKey = ACADEMY_MOODS[rawKey] ? rawKey : 'sunny_snow';
    const cfg = ACADEMY_MOODS[resolvedKey];
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
  // 13. REAL-TIME ANIMATION LOOP (Banners, Braziers, Arcane Circle, Embers)
  // =========================================================================
  const emberDummy = new THREE.Object3D();

  function update(elapsedSec = 0, dtSec = 0.016) {
    if (disposed) return;

    const safeDt = Number.isFinite(dtSec) ? Math.min(Math.max(dtSec, 0), 0.1) : 0.016;
    if (safeDt > 0 || elapsedSec > 0.02) {
      runtimeTicks += 1;
    }

    if (moodTrans.active) {
      moodTrans.elapsed += Math.max(safeDt, 0.016);
      const rawT = Math.min(1, moodTrans.elapsed / Math.max(0.05, moodTrans.duration));
      const smoothT = rawT * rawT * (3 - 2 * rawT);
      lerpMoodSnapshot(moodCur, moodFrom, moodTarget, smoothT);
      commitMoodVisuals(moodCur);
      if (rawT >= 1) {
        moodTrans.active = false;
      }
    }

    // 1. Sky subtle cirrus drift
    skyUniforms.uTime.value = elapsedSec;

    // 2. Royal Arcane Dueling Circle slow counter-rotation & subtle pulse
    arcaneCircleMesh.rotation.z = elapsedSec * 0.075;
    innerRuneRing.rotation.z = -elapsedSec * 0.125;
    matArcaneDecal.opacity = (arcaneTex ? 0.58 : 0.22) + Math.sin(elapsedSec * 1.35) * 0.06;

    // 3. Flowing Royal Blue-Gold Academy Banners (graceful multi-harmonic wind wave)
    const windMul = moodCur.bannerWindMul;
    const gust = (0.85 + 0.25 * Math.sin(elapsedSec * 0.72 * windMul) + 0.12 * Math.sin(elapsedSec * 1.85 * windMul)) * (0.75 + 0.25 * windMul);
    for (let b = 0; b < animatedBanners.length; b++) {
      const ban = animatedBanners[b];
      const pos = ban.geometry.attributes.position;
      const rest = ban.restPos;
      const invH = 1.0 / ban.height;
      const ph = ban.phase;

      for (let i = 0; i < pos.count; i++) {
        const rx = rest[i * 3];
        const ry = rest[i * 3 + 1];
        const frac = Math.min(1, Math.max(0, -ry * invH));
        // Anchor pinned solidly at top crossbar (frac = 0)
        const weight = Math.pow(frac, 1.32);

        const waveZ =
          Math.sin(frac * 5.2 - elapsedSec * 2.55 * windMul + ph) * 0.165 +
          Math.sin(rx * 2.6 + frac * 3.1 - elapsedSec * 1.95 * windMul + ph * 1.3) * 0.055;
        const swayX = Math.sin(frac * 2.4 - elapsedSec * 1.45 * windMul + ph) * 0.065;

        pos.setXYZ(
          i,
          rx + swayX * weight * gust,
          ry + Math.abs(waveZ) * 0.04 * weight,
          (0.04 + waveZ) * weight * gust
        );
      }
      pos.needsUpdate = true;
      ban.geometry.computeVertexNormals();
    }

    // 4. Six Sculpted Cast-Iron Braziers — lively multi-layered leaping 3D flame tongues & warm glow
    const pFreq = moodCur.brazierPulseFreq;
    const pAmp = moodCur.brazierPulseAmp;
    const baseHaloScale = moodCur.haloScale;
    const windLean = 0.065 * windMul;
    for (let i = 0; i < braziers.length; i++) {
      const br = braziers[i];
      const ph = br.phase;
      const pulse =
        (Math.sin(elapsedSec * 3.1 * pFreq + ph) * 0.095 +
          Math.sin(elapsedSec * 7.4 * pFreq + ph * 1.7) * 0.05) *
        pAmp;
      br.light.intensity = br.baseIntensity * (1.0 + pulse);

      // Central incandescent red-gold core tongue breathing rapidly inside the flame heart
      const coreStretch = 0.94 + 0.16 * Math.sin(elapsedSec * 7.8 * pFreq + ph * 1.3) + pulse * 0.35;
      const coreW = 0.96 + 0.08 * Math.cos(elapsedSec * 6.1 * pFreq + ph);
      br.flameInner.position.y = 1.46;
      br.flameInner.scale.set(coreW, Math.max(0.65, coreStretch), coreW);
      br.flameInner.rotation.set(
        Math.sin(elapsedSec * 5.2 * pFreq + ph) * 0.07,
        elapsedSec * 0.75 * pFreq + ph,
        windLean * 0.6 + Math.cos(elapsedSec * 6.4 * pFreq + ph) * 0.08
      );

      // Tall central sculpted flame tongue weaving & stretching sinuously in courtyard breeze
      const midStretch = 1.0 + 0.15 * Math.sin(elapsedSec * 5.6 * pFreq + ph + 0.6) + pulse * 0.48;
      const midW = 1.0 - (midStretch - 1.0) * 0.25;
      br.flameOuter.position.y = 1.45;
      br.flameOuter.scale.set(midW, Math.max(0.72, midStretch), midW);
      br.flameOuter.rotation.set(
        Math.sin(elapsedSec * 4.4 * pFreq + ph * 1.4) * 0.11,
        -elapsedSec * 0.55 * pFreq + ph,
        windLean + Math.sin(elapsedSec * 5.9 * pFreq + ph * 0.9) * 0.11
      );

      // Four encircling transparent outer flame tongues leaping gracefully out-of-phase
      const tongues = br.outerTongues;
      if (tongues) {
        for (let tIdx = 0; tIdx < tongues.length; tIdx++) {
          const tg = tongues[tIdx];
          const tPhase = elapsedSec * tg.speed * pFreq;
          const lick =
            Math.sin(tPhase * 5.8 + tg.phase) * 0.20 +
            Math.sin(tPhase * 11.2 + tg.phase * 1.7) * 0.09;
          const sy = Math.max(0.58, tg.baseScaleY * (1.0 + lick * (0.85 + 0.25 * pAmp)));
          const sxz = 0.94 + 0.10 * Math.cos(tPhase * 4.9 + tg.phase);
          tg.mesh.position.y = tg.baseY + Math.max(0, lick) * 0.065;
          tg.mesh.scale.set(sxz, sy, sxz);
          tg.mesh.rotation.set(
            Math.sin(tPhase * 4.6 + tg.phase) * tg.tilt,
            tg.baseRotY + Math.sin(tPhase * 2.4 + tg.phase) * 0.28,
            windLean * 1.25 + Math.cos(tPhase * 5.3 + tg.phase) * tg.tilt
          );
        }
      }

      const hs = baseHaloScale * (1 + pulse * 0.55);
      br.halo.scale.set(hs, hs, 1);
      br.halo.material.opacity = Math.min(0.92, 0.64 + pulse * 0.42);
    }

    // Corridor firelight warm pulse (only active when corridorFireInt > 0)
    if (moodCur.corridorFireInt > 0.01) {
      for (let i = 0; i < corridorFireLights.length; i++) {
        const cf = corridorFireLights[i];
        const fPulse =
          (Math.sin(elapsedSec * 3.4 * pFreq + cf.phase) * 0.10 +
            Math.sin(elapsedSec * 7.2 * pFreq + cf.phase * 1.6) * 0.05) *
          pAmp;
        cf.light.intensity = moodCur.corridorFireInt * (1.0 + fPulse);
      }
    }

    // 5. Rising Warm Ember Sparks above Braziers
    const eHeight = moodCur.emberHeight;
    const eSpeed = moodCur.emberSpeed;
    const eScale = moodCur.emberScale;
    for (let i = 0; i < emberSpecs.length; i++) {
      const em = emberSpecs[i];
      const cycle = (elapsedSec * em.speed * eSpeed + em.phase) % 1.0;
      const riseY = em.oy + cycle * eHeight;
      const swirlAng = elapsedSec * 1.8 * eSpeed + em.phase * 3.0;
      const r = em.radius * (1.0 + cycle * 0.9);
      const sc = Math.sin(cycle * Math.PI); // fade smoothly in & out
      emberDummy.position.set(
        em.ox + Math.cos(swirlAng) * r,
        riseY,
        em.oz + Math.sin(swirlAng) * r
      );
      emberDummy.rotation.set(elapsedSec * 2.0, swirlAng, 0);
      emberDummy.scale.setScalar(Math.max(0.001, sc * eScale));
      emberDummy.updateMatrix();
      instEmbers.setMatrixAt(i, emberDummy.matrix);
    }
    instEmbers.instanceMatrix.needsUpdate = true;

    // 6. Subtle Frost Crystal Ground Shimmer
    for (let i = 0; i < crystalClusterRefs.length; i++) {
      const cr = crystalClusterRefs[i];
      const s = 1.0 + Math.sin(elapsedSec * 1.6 + cr.phase) * 0.06;
      cr.aura.scale.set(s, s, 1);
    }
  }

  // =========================================================================
  // 14. RECURSIVE RESOURCE DISPOSAL (Zero GPU Leaks, Protects texLib Originals)
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
      if (typeof g.dispose === 'function') g.dispose();
    }
    for (const m of matSet) {
      if (typeof m.dispose === 'function') m.dispose();
    }
    for (const t of ownedTextures) {
      if (t && typeof t.dispose === 'function') t.dispose();
    }

    ownedGeometries.length = 0;
    ownedMaterials.length = 0;
    ownedTextures.length = 0;
    animatedBanners.length = 0;
    braziers.length = 0;
    corridorFireLights.length = 0;
    emberSpecs.length = 0;
    crystalClusterRefs.length = 0;
  }

  // Prime initial animated pose at t = 0
  update(0, 0);

  const defaultResult = cloneMoodResult('sunny_snow', ACADEMY_MOODS.sunny_snow);
  biomeHandle = {
    id: 'academy',
    name: '圣阿斯拉雪庭演武场',
    subtitle: ACADEMY_MOODS.sunny_snow.subtitle,
    currentMood: currentMoodId,
    supportedMoods: Object.keys(ACADEMY_MOODS),
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
