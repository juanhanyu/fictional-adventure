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
          color: 0xa2ecff,
          emissive: 0x2ca8eb,
          emissiveIntensity: 0.52,
          roughness: 0.12,
          metalness: 0.08,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          iridescence: 0.48,
          iridescenceIOR: 1.33,
          transparent: true,
          opacity: 0.90,
        },
        texLib.iceCrystal,
        1.0,
        1.8,
        0.02
      )
    )
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

  // =========================================================================
  // 3. CUSTOM GLSL WINTER SKY DOME & DISTANT ALPINE SNOW PEAKS
  // =========================================================================
  const skyUniforms = {
    uTime: { value: 0 },
    uZenithColor: { value: new THREE.Color(0x3f7de0) },
    uMidSkyColor: { value: new THREE.Color(0x94c4f5) },
    uHorizonColor: { value: new THREE.Color(0xeef5fc) },
    uSunWarmColor: { value: new THREE.Color(0xfff4d9) },
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
            col = mix(uHorizonColor, vec3(0.84, 0.90, 0.97), clamp(-dir.y * 3.0, 0.0, 1.0));
          }

          // Directional winter sun halo & Mie glow aligned with godRayOrigin
          float sunDot = max(dot(dir, uSunDir), 0.0);
          float sunHalo = pow(sunDot, 7.0) * 0.28 + pow(sunDot, 42.0) * 0.35;
          float sunCore = smoothstep(0.9965, 0.9994, sunDot) * 0.55;
          col += uSunWarmColor * (sunHalo + sunCore);

          // Delicate sunlit cirrus & snow-wisp clouds drifting high in the winter sky
          if (dir.y > 0.03) {
            vec2 uv = dir.xz / (dir.y + 0.26);
            uv.x += uTime * 0.008;
            uv.y -= uTime * 0.003;
            float n = fbm(uv * 1.15);
            float n2 = fbm(uv * 2.2 - vec2(uTime * 0.005, 0.0));
            float cloudMask = smoothstep(0.52, 0.78, n * 0.7 + n2 * 0.3) * smoothstep(0.04, 0.22, dir.y) * smoothstep(0.88, 0.32, dir.y);
            vec3 cloudCol = mix(vec3(0.96, 0.98, 1.0), uSunWarmColor, pow(sunDot, 3.0) * 0.45);
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

  // Distant Snow-Capped Alpine Peaks Silhouette (custom gentle mist shader so peaks always gleam gracefully)
  function buildAlpineMountainRange() {
    const mtnGroup = new THREE.Group();
    const matNearPeak = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd5e5f7,
        roughness: 0.85,
        metalness: 0.02,
        flatShading: true,
        fog: true,
      })
    );
    const matFarPeak = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xc9ddf5,
        fog: false,
      })
    );
    const matPeakSnowCap = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xeef5fd,
        fog: false,
      })
    );

    // Far majestic glacier ridge behind the cathedral (always readable above horizon mist)
    const farPeaks = [
      { x: -34, z: -44, r: 15, h: 22, rot: 0.4 },
      { x: -20, z: -46, r: 14, h: 25, rot: 1.1 },
      { x: -6, z: -48, r: 16, h: 20, rot: 0.2 },
      { x: 11, z: -47, r: 15, h: 26, rot: 0.8 },
      { x: 25, z: -45, r: 14, h: 23, rot: 1.5 },
      { x: 38, z: -42, r: 15, h: 21, rot: 0.6 },
    ];
    for (const p of farPeaks) {
      const baseGeo = trackGeo(new THREE.ConeGeometry(p.r, p.h, 6));
      const base = new THREE.Mesh(baseGeo, matFarPeak);
      base.position.set(p.x, p.h * 0.42 - 1.5, p.z);
      base.rotation.y = p.rot;
      mtnGroup.add(base);

      const capGeo = trackGeo(new THREE.ConeGeometry(p.r * 0.46, p.h * 0.45, 6));
      const cap = new THREE.Mesh(capGeo, matPeakSnowCap);
      cap.position.set(p.x, p.h * 0.68 - 1.2, p.z + 0.15);
      cap.rotation.y = p.rot;
      mtnGroup.add(cap);
    }

    // Mid-distance snow foothills catching directional sunlight
    const nearPeaks = [
      { x: -26, z: -31, r: 11.5, h: 13.5, rot: 0.5 },
      { x: -16, z: -34, r: 9.5, h: 11.5, rot: 1.2 },
      { x: 17, z: -33, r: 10.5, h: 12.8, rot: 0.3 },
      { x: 28, z: -30, r: 12.0, h: 14.0, rot: 0.9 },
    ];
    for (const p of nearPeaks) {
      const m = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(p.r, p.h, 7)), matNearPeak);
      m.position.set(p.x, p.h * 0.42 - 1.0, p.z);
      m.rotation.y = p.rot;
      mtnGroup.add(m);
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

  // --- Sculpted 3D Snow Drifts along Courtyard Perimeter ---
  function createSnowDriftGeometry(rx, ry, rz, seed) {
    const g = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const undulate =
        1.0 +
        0.16 * Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.7 - seed * 0.7) +
        0.09 * Math.sin((vx + vz) * 5.2 + seed * 1.9);
      pos.setXYZ(i, vx * rx * undulate, Math.max(0, vy * ry * undulate), vz * rz * undulate);
    }
    g.computeVertexNormals();
    return trackGeo(g);
  }

  const snowDriftSpecs = [
    // Along back marble curb flanking the central steps (strictly z <= -5.05)
    { x: -5.0, y: 0.12, z: -5.15, rx: 1.55, ry: 0.36, rz: 0.52, s: 1.1 },
    { x: 5.0, y: 0.12, z: -5.15, rx: 1.55, ry: 0.36, rz: 0.52, s: 2.3 },
    { x: -8.2, y: 0.16, z: -5.22, rx: 1.85, ry: 0.42, rz: 0.62, s: 3.7 },
    { x: 8.2, y: 0.16, z: -5.22, rx: 1.85, ry: 0.42, rz: 0.62, s: 4.9 },
    // Along left & right wing steps (strictly |x| >= 9.35)
    { x: -9.65, y: 0.14, z: -4.1, rx: 0.65, ry: 0.38, rz: 1.55, s: 5.2 },
    { x: 9.65, y: 0.14, z: -4.1, rx: 0.65, ry: 0.38, rz: 1.55, s: 6.4 },
    { x: -9.85, y: 0.16, z: 0.2, rx: 0.55, ry: 0.32, rz: 1.4, s: 7.1 },
    { x: 9.85, y: 0.16, z: 0.2, rx: 0.55, ry: 0.32, rz: 1.4, s: 8.3 },
    { x: -10.2, y: 0.20, z: 4.55, rx: 1.45, ry: 0.44, rz: 1.1, s: 9.5 },
    { x: 10.2, y: 0.20, z: 4.55, rx: 1.45, ry: 0.44, rz: 1.1, s: 10.7 },
    // Outer courtyard soft snow banks
    { x: -14.5, y: -0.1, z: -4.0, rx: 3.2, ry: 0.78, rz: 4.2, s: 11.2 },
    { x: 14.5, y: -0.1, z: -4.0, rx: 3.2, ry: 0.78, rz: 4.2, s: 12.6 },
    { x: -13.8, y: -0.1, z: 6.8, rx: 3.0, ry: 0.62, rz: 2.5, s: 13.4 },
    { x: 13.8, y: -0.1, z: 6.8, rx: 3.0, ry: 0.62, rz: 2.5, s: 14.8 },
  ];
  for (const d of snowDriftSpecs) {
    const drift = new THREE.Mesh(createSnowDriftGeometry(d.rx, d.ry, d.rz, d.s), matSnow);
    drift.position.set(d.x, d.y, d.z);
    drift.receiveShadow = true;
    groundGroup.add(drift);
  }

  // =========================================================================
  // 5. CORNER FROST CRYSTAL CLUSTERS (iceCrystal PBR + soft cyan aura)
  // =========================================================================
  function createCrystalShardGeo(radius, height) {
    // Hexagonal prism tapering smoothly into a faceted crystal tip
    const bodyH = height * 0.72;
    const tipH = height * 0.28;
    const g = new THREE.CylinderGeometry(radius * 0.78, radius, bodyH, 6, 1, false);
    g.translate(0, bodyH * 0.5, 0);

    // Add pointed top apex cleanly via custom indexed vertex geometry
    const sides = 6;
    const positions = [];
    const normals = [];
    const uvs = [];

    function pushTri(a, b, c, uva, uvb, uvc) {
      const ab = new THREE.Vector3().subVectors(b, a);
      const ac = new THREE.Vector3().subVectors(c, a);
      const n = new THREE.Vector3().crossVectors(ab, ac).normalize();
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
      uvs.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
    }

    const bot = [];
    const mid = [];
    for (let i = 0; i < sides; i++) {
      const ang = (i / sides) * Math.PI * 2;
      bot.push(new THREE.Vector3(Math.cos(ang) * radius, 0, Math.sin(ang) * radius));
      mid.push(new THREE.Vector3(Math.cos(ang) * radius * 0.84, bodyH, Math.sin(ang) * radius * 0.84));
    }
    const apex = new THREE.Vector3(0, bodyH + tipH, 0);

    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const u0 = i / sides;
      const u1 = (i + 1) / sides;
      // Side quad (two tris, counter-clockwise outward)
      pushTri(bot[j], bot[i], mid[i], [u1, 0], [u0, 0], [u0, 0.72]);
      pushTri(bot[j], mid[i], mid[j], [u1, 0], [u0, 0.72], [u1, 0.72]);
      // Pointed pyramid facet
      pushTri(mid[j], mid[i], apex, [u1, 0.72], [u0, 0.72], [(u0 + u1) * 0.5, 1.0]);
    }

    g.dispose(); // unused helper
    const crystalGeo = new THREE.BufferGeometry();
    crystalGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    crystalGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    crystalGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return trackGeo(crystalGeo);
  }

  const crystalShardBig = createCrystalShardGeo(0.20, 1.38);
  const crystalShardMed = createCrystalShardGeo(0.15, 0.96);
  const crystalShardSml = createCrystalShardGeo(0.11, 0.62);

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
  const auraPlaneGeo = trackGeo(new THREE.PlaneGeometry(1.15, 1.15));

  const crystalClusterRefs = [];

  function addFrostCrystalCluster(x, y, z, scale = 1.0, rotY = 0) {
    const cluster = new THREE.Group();
    cluster.position.set(x, y, z);
    cluster.rotation.y = rotY;
    cluster.scale.setScalar(scale);

    const shardLayout = [
      { geo: crystalShardBig, px: 0, pz: 0, rx: 0.08, rz: -0.06, ry: 0.2, s: 1.0 },
      { geo: crystalShardMed, px: 0.24, pz: 0.14, rx: 0.24, rz: -0.34, ry: 1.1, s: 0.95 },
      { geo: crystalShardMed, px: -0.25, pz: 0.12, rx: 0.20, rz: 0.36, ry: 2.3, s: 0.88 },
      { geo: crystalShardSml, px: 0.06, pz: -0.24, rx: -0.38, rz: -0.10, ry: 0.7, s: 1.0 },
      { geo: crystalShardSml, px: -0.18, pz: -0.20, rx: -0.26, rz: 0.44, ry: 3.1, s: 0.82 },
      { geo: crystalShardSml, px: 0.30, pz: -0.12, rx: -0.18, rz: -0.48, ry: 1.8, s: 0.75 },
    ];

    for (const s of shardLayout) {
      const m = new THREE.Mesh(s.geo, matIceCrystal);
      m.position.set(s.px, -0.05, s.pz);
      m.rotation.set(s.rx, s.ry, s.rz);
      m.scale.setScalar(s.s);
      m.castShadow = true;
      cluster.add(m);
    }

    // Soft cyan ground ice shimmer beneath crystals
    const aura = new THREE.Mesh(auraPlaneGeo, matIceAura);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    cluster.add(aura);

    group.add(cluster);
    crystalClusterRefs.push({ aura, phase: x * 0.7 + z * 0.5 });
  }

  // Placed strictly outside safe zone |x| > 9.3 or z < -5.1
  addFrostCrystalCluster(-9.65, 0.24, -5.25, 1.08, 0.5);
  addFrostCrystalCluster(9.65, 0.24, -5.25, 1.08, -0.5);
  addFrostCrystalCluster(-10.05, 0.30, 2.85, 0.94, 1.1);
  addFrostCrystalCluster(10.05, 0.30, 2.85, 0.94, -1.1);
  addFrostCrystalCluster(-4.15, 0.34, -5.48, 0.66, 0.4);
  addFrostCrystalCluster(4.15, 0.34, -5.48, 0.66, -0.4);

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

  // --- Shared Multi-Part Fluted Gothic Pier Builder ---
  const geoPlinthLow = trackGeo(new THREE.BoxGeometry(0.86, 0.30, 0.86));
  const geoPlinthMid = trackGeo(new THREE.BoxGeometry(0.72, 0.22, 0.72));
  const geoBaseRing = trackGeo(new THREE.TorusGeometry(0.30, 0.055, 8, 16));
  geoBaseRing.rotateX(Math.PI / 2);
  const geoShaftCore = trackGeo(new THREE.CylinderGeometry(0.24, 0.27, 2.48, 12));
  const geoColonnette = trackGeo(new THREE.CylinderGeometry(0.068, 0.074, 2.46, 8));
  const geoGoldCollar = trackGeo(new THREE.TorusGeometry(0.26, 0.036, 8, 16));
  geoGoldCollar.rotateX(Math.PI / 2);
  const geoCapBell = trackGeo(new THREE.CylinderGeometry(0.40, 0.24, 0.34, 8));
  const geoCapAbacus = trackGeo(new THREE.BoxGeometry(0.84, 0.14, 0.84));
  const geoPinnacleShaft = trackGeo(new THREE.CylinderGeometry(0.11, 0.20, 1.35, 6));
  const geoPinnacleSpire = trackGeo(new THREE.ConeGeometry(0.16, 0.85, 6));
  const geoFinialOrb = trackGeo(new THREE.OctahedronGeometry(0.095, 0));

  function buildGothicColumn(x, y, z, scaleXZ = 1.0, addPinnacle = true, pinnacleBaseH = CORNICE_Y) {
    const col = new THREE.Group();
    col.position.set(x, y, z);

    const pLow = new THREE.Mesh(geoPlinthLow, matMarbleTrim);
    pLow.position.y = 0.15;
    pLow.scale.set(scaleXZ, 1, scaleXZ);
    pLow.castShadow = true;
    pLow.receiveShadow = true;
    col.add(pLow);

    const pMid = new THREE.Mesh(geoPlinthMid, matMarble);
    pMid.position.y = 0.41;
    pMid.scale.set(scaleXZ, 1, scaleXZ);
    pMid.castShadow = true;
    pMid.receiveShadow = true;
    col.add(pMid);

    const bRing = new THREE.Mesh(geoBaseRing, matGold);
    bRing.position.y = 0.56;
    bRing.scale.setScalar(scaleXZ);
    col.add(bRing);

    const shaft = new THREE.Mesh(geoShaftCore, matMarble);
    shaft.position.y = 1.80;
    shaft.scale.set(scaleXZ, 1, scaleXZ);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    col.add(shaft);

    // 4 attached gothic cluster colonnettes for crisp fluted silhouette
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const sub = new THREE.Mesh(geoColonnette, matMarbleTrim);
      sub.position.set(Math.cos(ang) * 0.245 * scaleXZ, 1.80, Math.sin(ang) * 0.245 * scaleXZ);
      sub.scale.set(scaleXZ, 1, scaleXZ);
      col.add(sub);
    }

    const neck = new THREE.Mesh(geoGoldCollar, matGold);
    neck.position.y = 3.03;
    neck.scale.setScalar(scaleXZ);
    col.add(neck);

    const bell = new THREE.Mesh(geoCapBell, matMarble);
    bell.position.y = 3.20;
    bell.scale.set(scaleXZ, 1, scaleXZ);
    bell.castShadow = true;
    col.add(bell);

    const abacus = new THREE.Mesh(geoCapAbacus, matMarbleTrim);
    abacus.position.y = 3.40;
    abacus.scale.set(scaleXZ, 1, scaleXZ);
    abacus.castShadow = true;
    col.add(abacus);

    if (addPinnacle) {
      const pin = new THREE.Mesh(geoPinnacleShaft, matMarble);
      pin.position.y = pinnacleBaseH + 0.72;
      pin.castShadow = true;
      col.add(pin);

      const spire = new THREE.Mesh(geoPinnacleSpire, matRoyalSlateRoof);
      spire.position.y = pinnacleBaseH + 1.78;
      spire.castShadow = true;
      col.add(spire);

      const orb = new THREE.Mesh(geoFinialOrb, matGold);
      orb.position.y = pinnacleBaseH + 2.26;
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

  // --- Carved Stone Balustrades via InstancedMesh (1 draw call for all balusters!) ---
  const balusterPositions = [];

  // Lower balustrade rails in outer back colonnade bays (keeping central bay open for grand steps)
  const lowerBackBays = [-9.6, -6.4, -3.2, 3.2, 6.4, 9.6];
  for (const bx of lowerBackBays) {
    const topRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.45, 0.11, 0.24)), matMarble);
    topRail.position.set(bx, COL_BASE_Y + 0.92, -6.2);
    topRail.castShadow = true;
    archGroup.add(topRail);

    const snowCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.38, 0.055, 0.19)), matSnow);
    snowCap.position.set(bx, COL_BASE_Y + 0.995, -6.2);
    archGroup.add(snowCap);

    const botRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.45, 0.12, 0.26)), matMarbleTrim);
    botRail.position.set(bx, COL_BASE_Y + 0.08, -6.2);
    archGroup.add(botRail);

    for (let k = -3; k <= 3; k++) {
      balusterPositions.push([bx + k * 0.34, COL_BASE_Y + 0.50, -6.2]);
    }
  }

  // Upper gallery parapet balusters along back colonnade cornice
  for (const bx of lowerBackBays) {
    const pRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.72, 0.11, 0.22)), matMarble);
    pRail.position.set(bx, COL_BASE_Y + CORNICE_Y + 0.88, -5.88);
    archGroup.add(pRail);
    for (let k = -3; k <= 3; k++) {
      balusterPositions.push([bx + k * 0.36, COL_BASE_Y + CORNICE_Y + 0.50, -5.88]);
    }
  }

  // Wing lower balustrade rails (6 bays total)
  const wingBayZs = [-4.6, -1.4, 1.8];
  for (const side of [-1, 1]) {
    const wx = side * 11.2;
    for (const bz of wingBayZs) {
      const topRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.11, 2.45)), matMarble);
      topRail.position.set(wx, COL_BASE_Y + 0.92, bz);
      archGroup.add(topRail);

      const snowCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.19, 0.055, 2.38)), matSnow);
      snowCap.position.set(wx, COL_BASE_Y + 0.995, bz);
      archGroup.add(snowCap);

      for (let k = -3; k <= 3; k++) {
        balusterPositions.push([wx, COL_BASE_Y + 0.50, bz + k * 0.34]);
      }
    }
  }

  const geoBaluster = trackGeo(new THREE.CylinderGeometry(0.052, 0.068, 0.76, 8));
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

      // --- 3D Flying Buttress Piers & Arched Struts bracing the Towers ---
      const outerPier = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 9.8, 1.6)), matCathedralStone);
      outerPier.position.set(side * 12.6, 4.9, -0.5);
      cath.add(outerPier);

      const outerPierCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.05, 2.6, 4)), matRoyalSlateRoof);
      outerPierCap.position.set(side * 12.6, 11.1, -0.5);
      outerPierCap.rotation.y = Math.PI / 4;
      cath.add(outerPierCap);

      // Two tiered arched flying buttress flyers connecting outerPier → tower
      for (const fh of [6.4, 9.2]) {
        const flyer = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 0.46, 0.56)), matMarble);
        flyer.position.set(side * 10.6, fh, -0.5);
        flyer.rotation.z = -side * 0.42;
        cath.add(flyer);
      }

      // Secondary Flanking Fairytale Turrets at outer cathedral flanks (x = ±15.2, z = -3.2)
      const flankBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.65, 1.9, 10.2, 8)), matCathedralStone);
      flankBase.position.set(side * 15.6, 5.1, -3.4);
      cath.add(flankBase);

      const flankSpire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.95, 5.6, 8)), matRoyalSlateRoof);
      flankSpire.position.set(side * 15.6, 13.0, -3.4);
      cath.add(flankSpire);

      const flankFinial = new THREE.Mesh(geoFinialOrb, matGold);
      flankFinial.position.set(side * 15.6, 16.0, -3.4);
      flankFinial.scale.setScalar(2.0);
      cath.add(flankFinial);
    }
  }
  buildDistantCathedral();

  // =========================================================================
  // 9. SNOW-LADEN WINTER EVERGREENS & CARVED MARBLE PLANTERS
  // =========================================================================
  const geoPlanterBase = trackGeo(new THREE.CylinderGeometry(0.95, 0.82, 0.72, 8));
  const geoPlanterRim = trackGeo(new THREE.CylinderGeometry(1.08, 0.98, 0.16, 8));
  const geoPlanterSnow = trackGeo(new THREE.CylinderGeometry(0.92, 0.92, 0.12, 8));
  const geoTrunk = trackGeo(new THREE.CylinderGeometry(0.14, 0.22, 1.35, 7));

  function buildWinterPine(x, y, z, scale = 1.0, withPlanter = false, seed = 0) {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    tree.scale.setScalar(scale);

    let yOff = 0;
    if (withPlanter) {
      const pBase = new THREE.Mesh(geoPlanterBase, matMarble);
      pBase.position.y = 0.36;
      pBase.castShadow = true;
      pBase.receiveShadow = true;
      tree.add(pBase);

      const pRim = new THREE.Mesh(geoPlanterRim, matMarbleTrim);
      pRim.position.y = 0.76;
      pRim.castShadow = true;
      tree.add(pRim);

      const pSnow = new THREE.Mesh(geoPlanterSnow, matSnow);
      pSnow.position.y = 0.83;
      tree.add(pSnow);
      yOff = 0.78;
    }

    const trunk = new THREE.Mesh(geoTrunk, matBark);
    trunk.position.y = yOff + 0.65;
    trunk.castShadow = true;
    tree.add(trunk);

    // 4 stacked faceted conifer tiers, each draped with a crisp snow cap
    const tiers = [
      { r: 1.18, h: 1.32, py: 1.48, mat: matPineDark },
      { r: 0.96, h: 1.20, py: 2.22, mat: matPineLight },
      { r: 0.72, h: 1.04, py: 2.88, mat: matPineDark },
      { r: 0.45, h: 0.86, py: 3.46, mat: matPineLight },
    ];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const foliage = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(t.r, t.h, 7)), t.mat);
      foliage.position.y = yOff + t.py;
      foliage.rotation.y = seed + i * 0.62;
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      tree.add(foliage);

      // Overlapping snow blanket on top of each pine bough tier
      const snowCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(t.r * 0.84, t.h * 0.56, 7)), matSnow);
      snowCap.position.y = yOff + t.py + t.h * 0.24;
      snowCap.rotation.y = seed + i * 0.62;
      snowCap.receiveShadow = true;
      tree.add(snowCap);
    }

    group.add(tree);
  }

  // Sculpted courtyard planters flanking the front wing portals (strictly |x| >= 10.1)
  buildWinterPine(-10.25, COL_BASE_Y, 4.15, 0.96, true, 0.4);
  buildWinterPine(10.25, COL_BASE_Y, 4.15, 0.96, true, 1.9);

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
  // 10. SIX ORNATE WROUGHT-IRON & GOLD CRYSTAL BRAZIERS (Warm Light Drama)
  // =========================================================================
  const braziers = [];
  const emberSpecs = [];

  const geoPedestal = trackGeo(new THREE.CylinderGeometry(0.32, 0.40, 0.86, 8));
  const geoPedCap = trackGeo(new THREE.BoxGeometry(0.76, 0.12, 0.76));
  const geoBrazierStem = trackGeo(new THREE.CylinderGeometry(0.08, 0.16, 0.34, 8));
  const geoBrazierBowl = trackGeo(new THREE.CylinderGeometry(0.42, 0.20, 0.28, 8));
  const geoBrazierRim = trackGeo(new THREE.TorusGeometry(0.42, 0.042, 8, 16));
  geoBrazierRim.rotateX(Math.PI / 2);
  const geoFlameCrystal = trackGeo(new THREE.OctahedronGeometry(0.24, 0));
  const geoFlameInner = trackGeo(new THREE.OctahedronGeometry(0.14, 0));

  const matFlameOuter = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffd27a,
      emissive: 0xff9f32,
      emissiveIntensity: 1.85,
      roughness: 0.15,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
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

    const ped = new THREE.Mesh(geoPedestal, matMarble);
    ped.position.y = 0.43;
    ped.castShadow = true;
    ped.receiveShadow = true;
    bGrp.add(ped);

    const cap = new THREE.Mesh(geoPedCap, matMarbleTrim);
    cap.position.y = 0.91;
    cap.castShadow = true;
    bGrp.add(cap);

    const stem = new THREE.Mesh(geoBrazierStem, matWroughtIron);
    stem.position.y = 1.12;
    bGrp.add(stem);

    const bowl = new THREE.Mesh(geoBrazierBowl, matWroughtIron);
    bowl.position.y = 1.38;
    bowl.castShadow = true;
    bGrp.add(bowl);

    const rim = new THREE.Mesh(geoBrazierRim, matGold);
    rim.position.y = 1.52;
    bGrp.add(rim);

    // 4 ornate wrought-iron prongs embracing the floating crystal flame
    for (let p = 0; p < 4; p++) {
      const ang = (p * Math.PI) / 2 + Math.PI / 4;
      const prong = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.36, 0.05)), matGold);
      prong.position.set(Math.cos(ang) * 0.36, 1.64, Math.sin(ang) * 0.36);
      prong.rotation.set(Math.sin(ang) * 0.25, 0, -Math.cos(ang) * 0.25);
      bGrp.add(prong);
    }

    // Floating Magic Flame Crystal Core
    const flameOuter = new THREE.Mesh(geoFlameCrystal, matFlameOuter);
    flameOuter.position.y = 1.78;
    flameOuter.scale.set(0.86, 1.42, 0.86);
    bGrp.add(flameOuter);

    const flameInner = new THREE.Mesh(geoFlameInner, matFlameCore);
    flameInner.position.y = 1.78;
    flameInner.scale.set(0.85, 1.38, 0.85);
    bGrp.add(flameInner);

    // Warm billboard halo sprite using softGlowDisc
    const spriteMat = trackMat(
      new THREE.SpriteMaterial({
        color: 0xffc66e,
        map: glowTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const halo = new THREE.Sprite(spriteMat);
    halo.position.y = 1.82;
    halo.scale.set(1.85, 1.85, 1);
    bGrp.add(halo);

    // Warm Golden PointLight (calibrated for Three.js r170 physical decay)
    const ptLight = new THREE.PointLight(0xffb554, 15.5, 14.0, 1.65);
    ptLight.position.set(0, 1.98, 0);
    ptLight.castShadow = false;
    bGrp.add(ptLight);

    group.add(bGrp);
    braziers.push({
      light: ptLight,
      flameOuter,
      flameInner,
      halo,
      baseIntensity: 15.5,
      phase: i * 1.17 + 0.3,
    });

    // Seed 6 rising warm ember sparks per brazier (36 total in 1 InstancedMesh)
    for (let e = 0; e < 6; e++) {
      emberSpecs.push({
        ox: bx,
        oy: by + 1.62,
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

    const geoFgPier = trackGeo(new THREE.BoxGeometry(0.68, 0.94, 0.68));
    const geoFgPierCap = trackGeo(new THREE.BoxGeometry(0.80, 0.11, 0.80));
    const geoFgPierSnow = trackGeo(new THREE.SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5));
    const geoFgRail = trackGeo(new THREE.BoxGeometry(3.2, 0.12, 0.28));
    const geoFgRailSnow = trackGeo(new THREE.BoxGeometry(3.12, 0.06, 0.22));
    const geoFgBal = trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.62, 8));
    const geoTwig = trackGeo(new THREE.CylinderGeometry(0.028, 0.055, 1.35, 6));
    const geoFoliageTuft = trackGeo(new THREE.ConeGeometry(0.28, 0.56, 6));
    const geoTuftSnow = trackGeo(new THREE.ConeGeometry(0.24, 0.30, 6));

    for (const side of [-1, 1]) {
      // Sculpted corner stone pier at x = ±6.95, z = 8.95, total height 1.04 (< 1.1!)
      const pier = new THREE.Mesh(geoFgPier, matMarble);
      pier.position.set(side * 6.95, 0.47, 8.95);
      pier.receiveShadow = true;
      fg.add(pier);

      const cap = new THREE.Mesh(geoFgPierCap, matMarbleTrim);
      cap.position.set(side * 6.95, 0.96, 8.95);
      fg.add(cap);

      const snow = new THREE.Mesh(geoFgPierSnow, matSnow);
      snow.position.set(side * 6.95, 1.00, 8.95);
      snow.scale.set(1.0, 0.24, 1.0); // peak y = 1.086 < 1.10
      fg.add(snow);

      // Low carved stone balustrade extending outward |x| = 7.1 .. 10.3, z = 9.05 .. 9.35
      const railGrp = new THREE.Group();
      railGrp.position.set(side * 8.65, 0, 9.15);
      railGrp.rotation.y = side * 0.10;

      const topRail = new THREE.Mesh(geoFgRail, matMarble);
      topRail.position.y = 0.72;
      railGrp.add(topRail);

      const railSnow = new THREE.Mesh(geoFgRailSnow, matSnow);
      railSnow.position.y = 0.80;
      railGrp.add(railSnow);

      const botPlinth = new THREE.Mesh(geoFgRail, matMarbleTrim);
      botPlinth.position.y = 0.08;
      railGrp.add(botPlinth);

      for (let b = -3; b <= 3; b++) {
        const bal = new THREE.Mesh(geoFgBal, matMarble);
        bal.position.set(b * 0.44, 0.40, 0);
        railGrp.add(bal);
      }
      fg.add(railGrp);

      // Delicate low frost-dusted winter pine boughs framing the extreme bottom corners (y < 0.98)
      const bough = new THREE.Group();
      bough.position.set(side * 8.35, 0.56, 9.48);
      bough.rotation.z = side * 1.18;
      bough.rotation.y = -side * 0.24;

      const branch = new THREE.Mesh(geoTwig, matBark);
      bough.add(branch);

      for (let k = 0; k < 3; k++) {
        const ty = -0.35 + k * 0.36;
        const tuft = new THREE.Mesh(geoFoliageTuft, matPineLight);
        tuft.position.set(0, ty, 0);
        tuft.scale.setScalar(1.0 - k * 0.14);
        bough.add(tuft);

        const tSnow = new THREE.Mesh(geoTuftSnow, matSnow);
        tSnow.position.set(side * -0.04, ty + 0.11, 0);
        tSnow.scale.setScalar(1.0 - k * 0.14);
        bough.add(tSnow);
      }
      fg.add(bough);
    }
  }
  buildForegroundTiltShiftDecor();

  // =========================================================================
  // 12. REAL-TIME ANIMATION LOOP (Banners, Braziers, Arcane Circle, Embers)
  // =========================================================================
  const emberDummy = new THREE.Object3D();

  function update(elapsedSec = 0, dtSec = 0.016) {
    if (disposed) return;

    // 1. Sky subtle cirrus drift
    skyUniforms.uTime.value = elapsedSec;

    // 2. Royal Arcane Dueling Circle slow counter-rotation & subtle pulse
    arcaneCircleMesh.rotation.z = elapsedSec * 0.075;
    innerRuneRing.rotation.z = -elapsedSec * 0.125;
    matArcaneDecal.opacity = (arcaneTex ? 0.58 : 0.22) + Math.sin(elapsedSec * 1.35) * 0.06;

    // 3. Flowing Royal Blue-Gold Academy Banners (graceful multi-harmonic wind wave)
    const gust = 0.85 + 0.25 * Math.sin(elapsedSec * 0.72) + 0.12 * Math.sin(elapsedSec * 1.85);
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
          Math.sin(frac * 5.2 - elapsedSec * 2.55 + ph) * 0.165 +
          Math.sin(rx * 2.6 + frac * 3.1 - elapsedSec * 1.95 + ph * 1.3) * 0.055;
        const swayX = Math.sin(frac * 2.4 - elapsedSec * 1.45 + ph) * 0.065;

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

    // 4. Six Crystal Braziers — warm golden light breathing & crystal levitation
    for (let i = 0; i < braziers.length; i++) {
      const br = braziers[i];
      const ph = br.phase;
      const pulse =
        Math.sin(elapsedSec * 2.8 + ph) * 0.09 +
        Math.sin(elapsedSec * 6.3 + ph * 1.7) * 0.045;
      br.light.intensity = br.baseIntensity * (1.0 + pulse);

      const bob = Math.sin(elapsedSec * 2.2 + ph) * 0.042;
      br.flameOuter.position.y = 1.78 + bob;
      br.flameInner.position.y = 1.78 + bob;
      br.flameOuter.rotation.y = elapsedSec * 0.95 + ph;
      br.flameInner.rotation.y = -elapsedSec * 1.4 + ph;

      const s = 1.0 + pulse * 0.45;
      br.flameOuter.scale.set(0.86 * s, 1.42 * s, 0.86 * s);
      br.halo.scale.set(1.85 * (1 + pulse * 0.55), 1.85 * (1 + pulse * 0.55), 1);
      br.halo.material.opacity = 0.68 + pulse * 0.45;
    }

    // 5. Rising Warm Ember Sparks above Braziers
    for (let i = 0; i < emberSpecs.length; i++) {
      const em = emberSpecs[i];
      const cycle = (elapsedSec * em.speed + em.phase) % 1.0;
      const riseY = em.oy + cycle * 1.15;
      const swirlAng = elapsedSec * 1.8 + em.phase * 3.0;
      const r = em.radius * (1.0 + cycle * 0.9);
      const sc = Math.sin(cycle * Math.PI); // fade smoothly in & out
      emberDummy.position.set(
        em.ox + Math.cos(swirlAng) * r,
        riseY,
        em.oz + Math.sin(swirlAng) * r
      );
      emberDummy.rotation.set(elapsedSec * 2.0, swirlAng, 0);
      emberDummy.scale.setScalar(Math.max(0.001, sc * 1.05));
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

    void dtSec;
  }

  // =========================================================================
  // 13. RECURSIVE RESOURCE DISPOSAL (Zero GPU Leaks, Protects texLib Originals)
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
    emberSpecs.length = 0;
    crystalClusterRefs.length = 0;
  }

  // Prime initial animated pose at t = 0
  update(0, 0);

  return {
    id: 'academy',
    name: '圣阿斯拉雪庭演武场',
    subtitle: '雪霁晴空 · 皇家哥特回廊',
    group,
    fog: { color: 0xdbe8f8, near: 18, far: 54 },
    background: 0xcbe0f7,
    atmospherePreset: {
      particleType: 'snow',
      particleColor: 0xffffff,
      particleCount: 420,
      godRayColor: 0xfff3d6,
      godRayOpacity: 0.22,
      godRayOrigin: [-7, 13, -10],
      bloomStrength: 0.34,
      bloomThreshold: 0.80,
      bloomRadius: 0.60,
      focusDepth: 0.56,
      blurAmount: 1.7,
      spriteRimTint: [1.0, 1.0, 1.02],
    },
    update,
    dispose,
  };
}
