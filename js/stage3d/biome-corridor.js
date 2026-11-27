// 政变火夜 · 公爵府东翼燃烧室内长廊（Burning East-Wing Ducal Corridor）
// HD-2D Flagship 3D Biome — Act 08 Coup-Night Indoor Gothic Hallway Exclusive
// Safe combat plane strictly preserved: y = 0 across x in [-6.5, +6.5], z in [-3.2, +3.2]
// (actual clear flat floor extends x in [-7.4, +7.4], z in [-4.4, +4.4])
// Vaulted ceiling ribs strictly y > 5.5 (crown y = 8.35) so camera (0, 5.30, 14.2) is never occluded.

function createRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function buildCorridorBiome(THREE, texLib = {}) {
  const group = new THREE.Group();
  group.name = 'biome_corridor';

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
    if (t) ownedTextures.push(t);
    return t;
  };

  // --- Defensive Texture Resolver (never mutates or disposes caller-owned texLib textures) ---
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
    return trackTex(c);
  }

  function applyPBRMaps(params, entry, rx = 1, ry = 1, bumpScale = 0.032) {
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

  function finalizeCanvasTex(canvas, { isColor = true, repeat = false, rx = 1, ry = 1 } = {}) {
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rx, ry);
    } else {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return trackTex(tex);
  }

  // =========================================================================
  // 1. PROCEDURAL TEXTURES (Marble Parquet, Ducal Carpet, Shattered Stained Glass,
  //    Scorched Ducal Tapestries, Soft Smoke & Glow Sprites)
  // =========================================================================

  // 1A. Grand Ducal Diamond-Inlaid Marble Parquet Floor (512x512 Diffuse + Bump + Roughness)
  function buildMarbleParquetTextures() {
    const S = 512;
    const diffC = makeCanvas(S, S);
    const bumpC = makeCanvas(S, S);
    const roughC = makeCanvas(S, S);
    if (!diffC || !bumpC || !roughC) return { map: null, bumpMap: null, roughnessMap: null };

    const dCtx = diffC.getContext('2d');
    const bCtx = bumpC.getContext('2d');
    const rCtx = roughC.getContext('2d');
    const rng = createRng(808101);

    // Base warm pale marble mortar
    dCtx.fillStyle = '#c8bfb2';
    dCtx.fillRect(0, 0, S, S);
    bCtx.fillStyle = '#909090';
    bCtx.fillRect(0, 0, S, S);
    rCtx.fillStyle = '#7c7c7c';
    rCtx.fillRect(0, 0, S, S);

    const grid = 4; // 4x4 diamond-checkered palatial slabs per repeat
    const cell = S / grid;

    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const isDark = (gx + gy) % 2 === 1;
        const x0 = gx * cell;
        const y0 = gy * cell;
        const pad = 4;

        // Slab fill with slight aristocratic tonal variation
        const v = (rng() - 0.5) * 10;
        if (isDark) {
          const r = Math.round(66 + v);
          const g = Math.round(58 + v);
          const b = Math.round(68 + v);
          dCtx.fillStyle = `rgb(${r},${g},${b})`;
          rCtx.fillStyle = '#5c5c5c'; // polished dark veined slate-marble
        } else {
          const r = Math.round(218 + v);
          const g = Math.round(209 + v);
          const b = Math.round(198 + v);
          dCtx.fillStyle = `rgb(${r},${g},${b})`;
          rCtx.fillStyle = '#6c6c6c'; // warm ivory alabaster marble
        }
        dCtx.fillRect(x0 + pad, y0 + pad, cell - pad * 2, cell - pad * 2);
        rCtx.fillRect(x0 + pad, y0 + pad, cell - pad * 2, cell - pad * 2);

        // Raised bevel in bump map
        bCtx.fillStyle = '#dadada';
        bCtx.fillRect(x0 + pad, y0 + pad, cell - pad * 2, cell - pad * 2);

        // Subtle inner brass inlay square on light tiles, diagonal lozenge on dark tiles
        dCtx.save();
        dCtx.beginPath();
        dCtx.rect(x0 + pad, y0 + pad, cell - pad * 2, cell - pad * 2);
        dCtx.clip();

        // Natural marble veining curves
        const veinCount = 5;
        for (let k = 0; k < veinCount; k++) {
          dCtx.strokeStyle = isDark
            ? `rgba(176, 152, 132, ${0.10 + rng() * 0.14})`
            : `rgba(128, 114, 108, ${0.11 + rng() * 0.13})`;
          dCtx.lineWidth = 0.8 + rng() * 1.9;
          dCtx.beginPath();
          let vx = x0 + rng() * cell;
          let vy = y0 + rng() * cell;
          dCtx.moveTo(vx, vy);
          for (let s = 0; s < 4; s++) {
            vx += (rng() - 0.35) * 46;
            vy += (rng() - 0.35) * 46;
            dCtx.lineTo(vx, vy);
          }
          dCtx.stroke();
        }

        // Delicate antique-gold geometric corner fretwork
        dCtx.strokeStyle = isDark ? 'rgba(196, 156, 86, 0.34)' : 'rgba(174, 138, 76, 0.28)';
        dCtx.lineWidth = 1.6;
        dCtx.strokeRect(x0 + pad + 9, y0 + pad + 9, cell - (pad + 9) * 2, cell - (pad + 9) * 2);

        // Central small diamond inlay
        const cx = x0 + cell * 0.5;
        const cy = y0 + cell * 0.5;
        const dr = 11;
        dCtx.fillStyle = isDark ? 'rgba(208, 174, 106, 0.38)' : 'rgba(92, 74, 78, 0.22)';
        dCtx.beginPath();
        dCtx.moveTo(cx, cy - dr);
        dCtx.lineTo(cx + dr, cy);
        dCtx.lineTo(cx, cy + dr);
        dCtx.lineTo(cx - dr, cy);
        dCtx.closePath();
        dCtx.fill();

        dCtx.restore();

        // Recessed stone grout joints
        dCtx.strokeStyle = 'rgba(40, 32, 34, 0.62)';
        dCtx.lineWidth = 3.2;
        dCtx.strokeRect(x0 + 1.5, y0 + 1.5, cell - 3, cell - 3);

        bCtx.strokeStyle = '#383838';
        bCtx.lineWidth = 4;
        bCtx.strokeRect(x0 + 1.5, y0 + 1.5, cell - 3, cell - 3);
        rCtx.strokeStyle = '#d4d4d4';
        rCtx.lineWidth = 4;
        rCtx.strokeRect(x0 + 1.5, y0 + 1.5, cell - 3, cell - 3);
      }
    }

    // Subtle coup-night scattered ash dust flecks (keeps floor refined and warm, never muddy)
    for (let i = 0; i < 65; i++) {
      const ax = rng() * S;
      const ay = rng() * S;
      const ar = 3 + rng() * 14;
      const grad = dCtx.createRadialGradient(ax, ay, 0, ax, ay, ar);
      grad.addColorStop(0, 'rgba(38, 26, 24, 0.14)');
      grad.addColorStop(1, 'rgba(38, 26, 24, 0)');
      dCtx.fillStyle = grad;
      dCtx.beginPath();
      dCtx.arc(ax, ay, ar, 0, Math.PI * 2);
      dCtx.fill();
    }

    return {
      map: finalizeCanvasTex(diffC, { isColor: true, repeat: true, rx: 6.5, ry: 7.5 }),
      bumpMap: finalizeCanvasTex(bumpC, { isColor: false, repeat: true, rx: 6.5, ry: 7.5 }),
      roughnessMap: finalizeCanvasTex(roughC, { isColor: false, repeat: true, rx: 6.5, ry: 7.5 }),
    };
  }

  // 1B. Crimson & Gold Ducal Heraldic Carpet Runner (1024x512 Diffuse + Bump + Emissive Scorch)
  function buildDucalCarpetTextures() {
    const W = 1024;
    const H = 512;
    const diffC = makeCanvas(W, H);
    const bumpC = makeCanvas(W, H);
    const emiC = makeCanvas(W, H);
    if (!diffC || !bumpC || !emiC) return { map: null, bumpMap: null, emissiveMap: null };

    const dCtx = diffC.getContext('2d');
    const bCtx = bumpC.getContext('2d');
    const eCtx = emiC.getContext('2d');
    const rng = createRng(808202);

    // Rich deep ducal crimson damask velvet base
    const baseGrad = dCtx.createLinearGradient(0, 0, 0, H);
    baseGrad.addColorStop(0.0, '#4f0c17');
    baseGrad.addColorStop(0.14, '#7a1222');
    baseGrad.addColorStop(0.5, '#8e1829');
    baseGrad.addColorStop(0.86, '#7a1222');
    baseGrad.addColorStop(1.0, '#4f0c17');
    dCtx.fillStyle = baseGrad;
    dCtx.fillRect(0, 0, W, H);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, W, H);
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, W, H);

    // Fine woven textile horizontal & vertical warp/weft grain
    for (let y = 0; y < H; y += 3) {
      const a = 0.05 + (y % 6 === 0 ? 0.04 : 0);
      dCtx.fillStyle = `rgba(255, 220, 185, ${a})`;
      dCtx.fillRect(0, y, W, 1);
      bCtx.fillStyle = y % 6 === 0 ? '#969696' : '#6c6c6c';
      bCtx.fillRect(0, y, W, 1);
    }
    for (let x = 0; x < W; x += 4) {
      dCtx.fillStyle = 'rgba(28, 4, 10, 0.07)';
      dCtx.fillRect(x, 0, 1, H);
    }

    // Subtle damask diamond lattice inside central crimson field
    dCtx.strokeStyle = 'rgba(176, 46, 56, 0.24)';
    dCtx.lineWidth = 2;
    const step = 64;
    for (let x = -H; x < W + H; x += step) {
      dCtx.beginPath();
      dCtx.moveTo(x, 62);
      dCtx.lineTo(x + (H - 124), H - 62);
      dCtx.stroke();
      dCtx.beginPath();
      dCtx.moveTo(x, H - 62);
      dCtx.lineTo(x + (H - 124), 62);
      dCtx.stroke();
    }

    // Ornate Antique-Gold Baroque Borders (top & bottom edges of runner)
    function drawGoldBorderBand(yTop, bandH) {
      // Dark burgundy backing band
      dCtx.fillStyle = '#400811';
      dCtx.fillRect(0, yTop, W, bandH);

      // Outer & inner luminous spun-gold rails
      dCtx.fillStyle = '#dfb862';
      dCtx.fillRect(0, yTop + 3, W, 6);
      dCtx.fillRect(0, yTop + bandH - 9, W, 6);

      dCtx.fillStyle = '#f3d88e';
      dCtx.fillRect(0, yTop + 5, W, 2);
      dCtx.fillRect(0, yTop + bandH - 7, W, 2);

      // Raised weave bump along gold rails
      bCtx.fillStyle = '#c8c8c8';
      bCtx.fillRect(0, yTop + 3, W, 6);
      bCtx.fillRect(0, yTop + bandH - 9, W, 6);

      // Repeating royal diamond & acanthus scroll embroidery
      const midY = yTop + bandH * 0.5;
      const motifStep = 48;
      for (let x = 24; x < W; x += motifStep) {
        dCtx.strokeStyle = '#d7af58';
        dCtx.lineWidth = 2.4;
        dCtx.beginPath();
        dCtx.moveTo(x, midY - 12);
        dCtx.lineTo(x + 14, midY);
        dCtx.lineTo(x, midY + 12);
        dCtx.lineTo(x - 14, midY);
        dCtx.closePath();
        dCtx.stroke();

        dCtx.fillStyle = '#efd282';
        dCtx.beginPath();
        dCtx.arc(x, midY, 3.6, 0, Math.PI * 2);
        dCtx.fill();

        // Connecting filigree fleur dots
        dCtx.fillStyle = '#caa04c';
        dCtx.beginPath();
        dCtx.arc(x + motifStep * 0.5, midY, 2.5, 0, Math.PI * 2);
        dCtx.fill();

        bCtx.fillStyle = '#b8b8b8';
        bCtx.fillRect(x - 10, midY - 8, 20, 16);
      }
    }

    drawGoldBorderBand(14, 52);
    drawGoldBorderBand(H - 66, 52);

    // Repeating Woven Ducal Rose-and-Star Crest Medallions along Centerline
    const crestXs = [170, 512, 854];
    for (const cx of crestXs) {
      const cy = H * 0.5;
      const isHero = cx === 512;
      const rOuter = isHero ? 128 : 92;

      // Outer golden octagon medallion ring
      dCtx.strokeStyle = '#dfb964';
      dCtx.lineWidth = isHero ? 5 : 3.5;
      dCtx.beginPath();
      dCtx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      dCtx.stroke();

      dCtx.strokeStyle = 'rgba(240, 212, 136, 0.65)';
      dCtx.lineWidth = 2;
      dCtx.beginPath();
      dCtx.arc(cx, cy, rOuter - 12, 0, Math.PI * 2);
      dCtx.stroke();

      // Deep ducal royal-blue velvet center shield disc (connects to House palette!)
      dCtx.fillStyle = '#142959';
      dCtx.beginPath();
      dCtx.arc(cx, cy, rOuter - 15, 0, Math.PI * 2);
      dCtx.fill();

      // 8-pointed frost-crystal & rose-compass ducal crest in gold thread
      dCtx.fillStyle = '#e8c46e';
      dCtx.beginPath();
      for (let i = 0; i < 16; i++) {
        const ang = (i * Math.PI) / 8;
        const rad = i % 2 === 0 ? rOuter * 0.72 : rOuter * 0.28;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (i === 0) dCtx.moveTo(px, py);
        else dCtx.lineTo(px, py);
      }
      dCtx.closePath();
      dCtx.fill();

      // Inner crimson rose core
      dCtx.fillStyle = '#8b1728';
      dCtx.beginPath();
      dCtx.arc(cx, cy, rOuter * 0.21, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.strokeStyle = '#f7e09a';
      dCtx.lineWidth = 2.5;
      dCtx.stroke();

      bCtx.strokeStyle = '#cfcfcf';
      bCtx.lineWidth = 6;
      bCtx.beginPath();
      bCtx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      bCtx.stroke();
    }

    // Authentic Coup-Night Scorch Marks & Glowing Smoldering Ember Borders (strictly along outer margins!)
    const scorchSpots = [
      { x: 96, y: 26, r: 54 },
      { x: 295, y: H - 20, r: 62 },
      { x: 430, y: 18, r: 42 },
      { x: 645, y: H - 24, r: 58 },
      { x: 890, y: 28, r: 66 },
      { x: 960, y: H - 30, r: 52 },
      { x: 185, y: H - 16, r: 44 },
      { x: 755, y: 22, r: 48 },
    ];
    for (const sc of scorchSpots) {
      // Carbonized black-brown char in diffuse
      const cGrad = dCtx.createRadialGradient(sc.x, sc.y, sc.r * 0.15, sc.x, sc.y, sc.r);
      cGrad.addColorStop(0.0, 'rgba(18, 10, 10, 0.94)');
      cGrad.addColorStop(0.58, 'rgba(34, 16, 12, 0.78)');
      cGrad.addColorStop(0.84, 'rgba(72, 22, 12, 0.38)');
      cGrad.addColorStop(1.0, 'rgba(72, 22, 12, 0.0)');
      dCtx.fillStyle = cGrad;
      dCtx.beginPath();
      dCtx.arc(sc.x, sc.y, sc.r, 0, Math.PI * 2);
      dCtx.fill();

      // Thin smoldering orange-red ember rim in emissiveMap
      const eGrad = eCtx.createRadialGradient(sc.x, sc.y, sc.r * 0.45, sc.x, sc.y, sc.r * 0.88);
      eGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
      eGrad.addColorStop(0.45, 'rgba(255, 92, 22, 0.85)');
      eGrad.addColorStop(0.70, 'rgba(255, 168, 56, 0.55)');
      eGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      eCtx.fillStyle = eGrad;
      eCtx.beginPath();
      eCtx.arc(sc.x, sc.y, sc.r * 0.88, 0, Math.PI * 2);
      eCtx.fill();

      // Tiny bright cinder dots around scorch edge
      for (let d = 0; d < 6; d++) {
        const ang = rng() * Math.PI * 2;
        const dist = sc.r * (0.52 + rng() * 0.25);
        eCtx.fillStyle = 'rgba(255, 198, 88, 0.9)';
        eCtx.beginPath();
        eCtx.arc(sc.x + Math.cos(ang) * dist, sc.y + Math.sin(ang) * dist, 2.2, 0, Math.PI * 2);
        eCtx.fill();
      }
    }

    return {
      map: finalizeCanvasTex(diffC, { isColor: true, repeat: false }),
      bumpMap: finalizeCanvasTex(bumpC, { isColor: false, repeat: false }),
      emissiveMap: finalizeCanvasTex(emiC, { isColor: true, repeat: false }),
    };
  }

  // 1C. Shattered Painted Gothic Rose & Lancet Stained Glass (512x768 Diffuse + Emissive + Alpha)
  function buildShatteredStainedGlassTextures() {
    const W = 512;
    const H = 768;
    const diffC = makeCanvas(W, H);
    const emiC = makeCanvas(W, H);
    const alphaC = makeCanvas(W, H);
    if (!diffC || !emiC || !alphaC) return { map: null, emissiveMap: null, alphaMap: null };

    const dCtx = diffC.getContext('2d');
    const eCtx = emiC.getContext('2d');
    const aCtx = alphaC.getContext('2d');
    const rng = createRng(808303);

    // Opaque glass base in alphaMap
    aCtx.fillStyle = '#ffffff';
    aCtx.fillRect(0, 0, W, H);

    // Rich crimson-amber-sapphire Gothic jewel palette backlit by fire night
    const bgGrad = dCtx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0.0, '#293e8f');
    bgGrad.addColorStop(0.35, '#59235c');
    bgGrad.addColorStop(0.72, '#9e2634');
    bgGrad.addColorStop(1.0, '#c85024');
    dCtx.fillStyle = bgGrad;
    dCtx.fillRect(0, 0, W, H);

    // Diamond leaded mosaic panes across lower 68%
    const panePalette = ['#1d4cb8', '#3c68d6', '#9e1d36', '#c9382a', '#df8d2e', '#6f2978', '#2a77b5'];
    const tileW = 42;
    const tileH = 54;
    for (let row = 4; row < 16; row++) {
      for (let col = -1; col < 14; col++) {
        const cx = col * tileW + (row % 2 ? tileW * 0.5 : 0);
        const cy = row * tileH;
        const fill = panePalette[(row * 3 + col * 5 + 70) % panePalette.length];
        dCtx.fillStyle = fill;
        dCtx.beginPath();
        dCtx.moveTo(cx, cy - tileH * 0.5);
        dCtx.lineTo(cx + tileW * 0.5, cy);
        dCtx.lineTo(cx, cy + tileH * 0.5);
        dCtx.lineTo(cx - tileW * 0.5, cy);
        dCtx.closePath();
        dCtx.fill();

        dCtx.strokeStyle = '#18141c';
        dCtx.lineWidth = 3.2;
        dCtx.stroke();
      }
    }

    // Twin tall lancet inner stained-glass heraldic borders
    for (const lx of [W * 0.28, W * 0.72]) {
      dCtx.strokeStyle = '#e8b64c';
      dCtx.lineWidth = 8;
      dCtx.strokeRect(lx - 86, H * 0.38, 172, H * 0.58);
      dCtx.strokeStyle = '#18131a';
      dCtx.lineWidth = 4;
      dCtx.strokeRect(lx - 86, H * 0.38, 172, H * 0.58);
    }

    // Radiant Gothic Rose Window Wheel in upper arch (center x=256, y=220, r=155)
    const rx = W * 0.5;
    const ry = 224;
    const roseR = 152;

    // Rose backing halo
    const rGrad = dCtx.createRadialGradient(rx, ry, 10, rx, ry, roseR);
    rGrad.addColorStop(0.0, '#ffdf88');
    rGrad.addColorStop(0.32, '#e25e32');
    rGrad.addColorStop(0.66, '#9c1c3e');
    rGrad.addColorStop(1.0, '#1e4bb8');
    dCtx.fillStyle = rGrad;
    dCtx.beginPath();
    dCtx.arc(rx, ry, roseR, 0, Math.PI * 2);
    dCtx.fill();

    // 12 stained-glass rose petals with crisp black lead cames
    const petals = 12;
    for (let i = 0; i < petals; i++) {
      const a0 = (i / petals) * Math.PI * 2;
      const a1 = ((i + 1) / petals) * Math.PI * 2;
      const am = (a0 + a1) * 0.5;

      dCtx.fillStyle = i % 3 === 0 ? '#e6a536' : i % 3 === 1 ? '#b81d38' : '#2660d8';
      dCtx.beginPath();
      dCtx.moveTo(rx + Math.cos(a0) * 42, ry + Math.sin(a0) * 42);
      dCtx.lineTo(rx + Math.cos(a0) * (roseR - 14), ry + Math.sin(a0) * (roseR - 14));
      dCtx.arc(rx, ry, roseR - 14, a0, a1);
      dCtx.lineTo(rx + Math.cos(a1) * 42, ry + Math.sin(a1) * 42);
      dCtx.closePath();
      dCtx.fill();
      dCtx.strokeStyle = '#141018';
      dCtx.lineWidth = 4.5;
      dCtx.stroke();

      // Jewel quatrefoil dot near petal tip
      dCtx.fillStyle = i % 2 === 0 ? '#ffe394' : '#74caff';
      dCtx.beginPath();
      dCtx.arc(rx + Math.cos(am) * (roseR - 36), ry + Math.sin(am) * (roseR - 36), 13, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.strokeStyle = '#141018';
      dCtx.lineWidth = 3;
      dCtx.stroke();
    }

    // Rose inner & outer iron/lead rings
    dCtx.strokeStyle = '#141018';
    dCtx.lineWidth = 9;
    dCtx.beginPath();
    dCtx.arc(rx, ry, roseR, 0, Math.PI * 2);
    dCtx.stroke();
    dCtx.beginPath();
    dCtx.arc(rx, ry, 44, 0, Math.PI * 2);
    dCtx.stroke();

    // Central golden ducal rose sun
    dCtx.fillStyle = '#ffe59c';
    dCtx.beginPath();
    dCtx.arc(rx, ry, 36, 0, Math.PI * 2);
    dCtx.fill();

    // Copy painted glass to emissive canvas before punching jagged shatter holes!
    eCtx.drawImage(diffC, 0, 0);

    // Jagged shattered holes (punched cleanly through alphaMap + spiderweb cracks on remaining glass!)
    const shatterHoles = [
      { cx: 185, cy: 485, rx: 92, ry: 112, pts: 11 },
      { cx: 342, cy: 365, rx: 68, ry: 78, pts: 9 },
      { cx: 295, cy: 610, rx: 72, ry: 68, pts: 10 },
      { cx: 145, cy: 265, rx: 46, ry: 52, pts: 8 },
    ];

    for (const h of shatterHoles) {
      const poly = [];
      for (let i = 0; i < h.pts; i++) {
        const ang = (i / h.pts) * Math.PI * 2;
        const jag = 0.56 + rng() * 0.56;
        poly.push([h.cx + Math.cos(ang) * h.rx * jag, h.cy + Math.sin(ang) * h.ry * jag]);
      }

      // Punch clean hole in alphaMap (reveals real 3D blood-moon fire-night sky behind!)
      aCtx.fillStyle = '#000000';
      aCtx.beginPath();
      poly.forEach(([px, py], idx) => (idx === 0 ? aCtx.moveTo(px, py) : aCtx.lineTo(px, py)));
      aCtx.closePath();
      aCtx.fill();

      // Glinting bright fractured glass rim + spiderweb crack lines around hole
      for (const ctx of [dCtx, eCtx]) {
        ctx.strokeStyle = 'rgba(255, 224, 170, 0.78)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        poly.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.closePath();
        ctx.stroke();

        // Radial fracture cracks running outward from jagged vertices
        ctx.strokeStyle = 'rgba(20, 14, 22, 0.85)';
        ctx.lineWidth = 1.8;
        for (let i = 0; i < poly.length; i += 2) {
          const [vx, vy] = poly[i];
          const dirX = vx - h.cx;
          const dirY = vy - h.cy;
          const len = Math.hypot(dirX, dirY) || 1;
          ctx.beginPath();
          ctx.moveTo(vx, vy);
          ctx.lineTo(vx + (dirX / len) * (24 + rng() * 38), vy + (dirY / len) * (24 + rng() * 38));
          ctx.stroke();
        }
      }
    }

    return {
      map: finalizeCanvasTex(diffC, { isColor: true, repeat: false }),
      emissiveMap: finalizeCanvasTex(emiC, { isColor: true, repeat: false }),
      alphaMap: finalizeCanvasTex(alphaC, { isColor: false, repeat: false }),
    };
  }

  // 1D. Scorched Tattered Ducal Crest Tapestry Textures (Deep Royal Blue & Burgundy Variants)
  function buildScorchedTapestryTextures(variant = 'blue') {
    const W = 256;
    const H = 512;
    const diffC = makeCanvas(W, H);
    const emiC = makeCanvas(W, H);
    const alphaC = makeCanvas(W, H);
    if (!diffC || !emiC || !alphaC) return { map: null, emissiveMap: null, alphaMap: null };

    const dCtx = diffC.getContext('2d');
    const eCtx = emiC.getContext('2d');
    const aCtx = alphaC.getContext('2d');
    const rng = createRng(variant === 'blue' ? 808404 : 808505);

    // Base rich silk brocade
    const grad = dCtx.createLinearGradient(0, 0, W, H);
    if (variant === 'blue') {
      grad.addColorStop(0, '#122969');
      grad.addColorStop(0.5, '#1a3c8f');
      grad.addColorStop(1, '#0e1d4a');
    } else {
      grad.addColorStop(0, '#6e101f');
      grad.addColorStop(0.5, '#96192c');
      grad.addColorStop(1, '#4c0a15');
    }
    dCtx.fillStyle = grad;
    dCtx.fillRect(0, 0, W, H);

    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, W, H);
    aCtx.fillStyle = '#ffffff';
    aCtx.fillRect(0, 0, W, H);

    // Woven silk vertical sheen
    for (let x = 0; x < W; x += 3) {
      dCtx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
      dCtx.fillRect(x, 0, 1, H);
    }

    // Ornate golden embroidery vertical border
    dCtx.strokeStyle = '#dfb860';
    dCtx.lineWidth = 7;
    dCtx.strokeRect(14, 14, W - 28, H - 28);
    dCtx.strokeStyle = '#f5da8e';
    dCtx.lineWidth = 2;
    dCtx.strokeRect(24, 24, W - 48, H - 48);

    // Ducal House Heraldic Crest (Golden Shield + 8-point Star + Crossed Blades)
    const cx = W * 0.5;
    const cy = H * 0.40;
    dCtx.fillStyle = variant === 'blue' ? '#6d1222' : '#142d6e';
    dCtx.strokeStyle = '#eac66e';
    dCtx.lineWidth = 5;
    dCtx.beginPath();
    dCtx.moveTo(cx - 56, cy - 64);
    dCtx.lineTo(cx + 56, cy - 64);
    dCtx.lineTo(cx + 52, cy + 10);
    dCtx.quadraticCurveTo(cx + 36, cy + 56, cx, cy + 78);
    dCtx.quadraticCurveTo(cx - 36, cy + 56, cx - 52, cy + 10);
    dCtx.closePath();
    dCtx.fill();
    dCtx.stroke();

    // Central golden star-rose emblem inside shield
    dCtx.fillStyle = '#f3d684';
    dCtx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i * Math.PI) / 8;
      const rad = i % 2 === 0 ? 36 : 14;
      const px = cx + Math.cos(ang) * rad;
      const py = cy - 4 + Math.sin(ang) * rad;
      if (i === 0) dCtx.moveTo(px, py);
      else dCtx.lineTo(px, py);
    }
    dCtx.closePath();
    dCtx.fill();

    // Decorative gold horizontal chevron bands above & below crest
    dCtx.fillStyle = '#d9b158';
    dCtx.fillRect(28, 72, W - 56, 8);
    dCtx.fillRect(28, 326, W - 56, 8);

    // Tattered burnt bottom edge & scorched glowing ember margin
    const burnLine = [];
    const segs = 22;
    for (let i = 0; i <= segs; i++) {
      const x = (i / segs) * W;
      const edgeDip = Math.abs(i / segs - 0.5) * 75;
      const y = H - 64 - edgeDip * 0.65 - rng() * 78;
      burnLine.push([x, y]);
    }

    // Cut away burnt lower rags in alphaMap
    aCtx.fillStyle = '#000000';
    aCtx.beginPath();
    aCtx.moveTo(0, H);
    burnLine.forEach(([x, y]) => aCtx.lineTo(x, y));
    aCtx.lineTo(W, H);
    aCtx.closePath();
    aCtx.fill();

    // Carbonized soot halo above torn edge in diffuse
    dCtx.lineJoin = 'round';
    dCtx.strokeStyle = 'rgba(20, 10, 8, 0.92)';
    dCtx.lineWidth = 34;
    dCtx.beginPath();
    burnLine.forEach(([x, y], idx) => (idx === 0 ? dCtx.moveTo(x, y - 8) : dCtx.lineTo(x, y - 8)));
    dCtx.stroke();

    // Glowing molten orange-crimson smoldering edge in emissiveMap!
    eCtx.lineJoin = 'round';
    eCtx.strokeStyle = 'rgba(255, 68, 16, 0.95)';
    eCtx.lineWidth = 16;
    eCtx.beginPath();
    burnLine.forEach(([x, y], idx) => (idx === 0 ? eCtx.moveTo(x, y - 4) : eCtx.lineTo(x, y - 4)));
    eCtx.stroke();

    eCtx.strokeStyle = 'rgba(255, 198, 76, 1.0)';
    eCtx.lineWidth = 5;
    eCtx.beginPath();
    burnLine.forEach(([x, y], idx) => (idx === 0 ? eCtx.moveTo(x, y - 2) : eCtx.lineTo(x, y - 2)));
    eCtx.stroke();

    // Side ember nibble hole
    const holeX = variant === 'blue' ? 212 : 42;
    const holeY = 268;
    aCtx.fillStyle = '#000000';
    aCtx.beginPath();
    aCtx.ellipse(holeX, holeY, 26, 36, 0.25, 0, Math.PI * 2);
    aCtx.fill();
    dCtx.strokeStyle = 'rgba(18, 8, 8, 0.95)';
    dCtx.lineWidth = 14;
    dCtx.beginPath();
    dCtx.ellipse(holeX, holeY, 28, 38, 0.25, 0, Math.PI * 2);
    dCtx.stroke();
    eCtx.strokeStyle = 'rgba(255, 112, 32, 0.95)';
    eCtx.lineWidth = 6;
    eCtx.beginPath();
    eCtx.ellipse(holeX, holeY, 27, 37, 0.25, 0, Math.PI * 2);
    eCtx.stroke();

    return {
      map: finalizeCanvasTex(diffC, { isColor: true, repeat: false }),
      emissiveMap: finalizeCanvasTex(emiC, { isColor: true, repeat: false }),
      alphaMap: finalizeCanvasTex(alphaC, { isColor: false, repeat: false }),
    };
  }

  // 1E. Soft Radial Smoke Puff Texture (128x128) & Fallback Soft Glow Disc
  function buildSoftSmokeTexture() {
    const S = 128;
    const c = makeCanvas(S, S);
    if (!c) return null;
    const ctx = c.getContext('2d');
    const rng = createRng(808606);
    ctx.clearRect(0, 0, S, S);
    for (let i = 0; i < 6; i++) {
      const ox = S * 0.5 + (rng() - 0.5) * 28;
      const oy = S * 0.5 + (rng() - 0.5) * 28;
      const r = 26 + rng() * 24;
      const g = ctx.createRadialGradient(ox, oy, 2, ox, oy, r);
      g.addColorStop(0.0, 'rgba(255, 255, 255, 0.34)');
      g.addColorStop(0.55, 'rgba(255, 255, 255, 0.14)');
      g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return finalizeCanvasTex(c, { isColor: true, repeat: false });
  }

  function buildFallbackGlowDisc() {
    const S = 128;
    const c = makeCanvas(S, S);
    if (!c) return null;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S * 0.5, S * 0.5, 0, S * 0.5, S * 0.5, S * 0.5);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    g.addColorStop(0.32, 'rgba(255, 232, 185, 0.55)');
    g.addColorStop(0.72, 'rgba(255, 165, 92, 0.14)');
    g.addColorStop(1.0, 'rgba(255, 120, 48, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return finalizeCanvasTex(c, { isColor: true, repeat: false });
  }

  const parquetBundle = buildMarbleParquetTextures();
  const carpetBundle = buildDucalCarpetTextures();
  const glassBundle = buildShatteredStainedGlassTextures();
  const tapestryBlueBundle = buildScorchedTapestryTextures('blue');
  const tapestryRedBundle = buildScorchedTapestryTextures('red');
  const smokeTex = buildSoftSmokeTexture();
  const glowBundle = unwrapTexBundle(texLib.softGlowDisc);
  const glowTex = glowBundle.map || buildFallbackGlowDisc();

  // =========================================================================
  // 2. SHARED PBR MATERIALS — Warm Ducal Marble, Aged Gold, Wrought Iron, Scorched Wood
  // =========================================================================
  const matParquetFloor = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6dcd2,
      map: parquetBundle.map || cloneRepeat(unwrapTexBundle(texLib.courtyardStone).map, 7, 7),
      bumpMap: parquetBundle.bumpMap || cloneRepeat(unwrapTexBundle(texLib.courtyardStone).bumpMap, 7, 7),
      bumpScale: 0.028,
      roughnessMap: parquetBundle.roughnessMap || null,
      roughness: 0.44,
      metalness: 0.08,
    })
  );

  const matMarble = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xd8cec5,
          roughness: 0.48,
          metalness: 0.06,
        },
        texLib.marble,
        1.4,
        2.2,
        0.025
      )
    )
  );

  // World-UV friendly marble for ExtrudeGeometry Gothic pointed arches
  const matMarbleArch = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xd3c7bd,
          roughness: 0.52,
          metalness: 0.06,
        },
        texLib.marble,
        0.34,
        0.34,
        0.022
      )
    )
  );

  const matDarkMarble = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0x574c54,
          roughness: 0.46,
          metalness: 0.12,
        },
        texLib.marble,
        1.8,
        1.4,
        0.026
      )
    )
  );

  const matWallStone = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0xa99b95,
          roughness: 0.68,
          metalness: 0.05,
        },
        texLib.courtyardStone,
        3.2,
        2.4,
        0.036
      )
    )
  );

  const matVaultStone = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0x8f8080,
          roughness: 0.72,
          metalness: 0.05,
        },
        texLib.courtyardStone,
        2.4,
        2.4,
        0.03
      )
    )
  );

  const matWainscot = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0x452824,
          roughness: 0.62,
          metalness: 0.08,
        },
        texLib.darkBark,
        2.4,
        1.2,
        0.03
      )
    )
  );

  const matCharredTimber = trackMat(
    new THREE.MeshStandardMaterial(
      applyPBRMaps(
        {
          color: 0x221614,
          emissive: new THREE.Color(0x882408),
          emissiveIntensity: 0.42,
          roughness: 0.92,
          metalness: 0.04,
        },
        texLib.darkBark,
        1.6,
        2.4,
        0.045
      )
    )
  );

  const matGold = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdab464,
      roughness: 0.30,
      metalness: 0.84,
      emissive: new THREE.Color(0x3a2208),
      emissiveIntensity: 0.16,
    })
  );

  const matWroughtIron = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262228,
      roughness: 0.40,
      metalness: 0.82,
      emissive: new THREE.Color(0x280c06),
      emissiveIntensity: 0.14,
    })
  );

  const matPortcullisIron = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c2428,
      roughness: 0.36,
      metalness: 0.86,
      emissive: new THREE.Color(0x4a1608),
      emissiveIntensity: 0.24,
    })
  );

  const matCarpetMain = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4e4dc,
      map: carpetBundle.map,
      bumpMap: carpetBundle.bumpMap,
      bumpScale: 0.022,
      emissive: new THREE.Color(0xff5e1a),
      emissiveMap: carpetBundle.emissiveMap,
      emissiveIntensity: 0.85,
      roughness: 0.86,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );

  const matCarpetBranch = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeddcd4,
      map: carpetBundle.map,
      bumpMap: carpetBundle.bumpMap,
      bumpScale: 0.022,
      emissive: new THREE.Color(0xff5a18),
      emissiveMap: carpetBundle.emissiveMap,
      emissiveIntensity: 0.95,
      roughness: 0.86,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );

  const matStainedGlass = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffdfd4,
      map: glassBundle.map,
      emissive: new THREE.Color(0xff6b38),
      emissiveMap: glassBundle.emissiveMap,
      emissiveIntensity: 1.05,
      alphaMap: glassBundle.alphaMap,
      alphaTest: 0.45,
      roughness: 0.22,
      metalness: 0.15,
      side: THREE.DoubleSide,
    })
  );

  const matBrokenShard = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc24c68,
      emissive: new THREE.Color(0x7c2018),
      emissiveIntensity: 0.45,
      roughness: 0.14,
      metalness: 0.12,
      clearcoat: 1.0,
    })
  );

  const matTapestryBlue = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0e4dc,
      map: tapestryBlueBundle.map,
      emissive: new THREE.Color(0xff641c),
      emissiveMap: tapestryBlueBundle.emissiveMap,
      emissiveIntensity: 1.35,
      alphaMap: tapestryBlueBundle.alphaMap,
      alphaTest: 0.42,
      roughness: 0.72,
      metalness: 0.12,
      side: THREE.DoubleSide,
    })
  );

  const matTapestryRed = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2e2da,
      map: tapestryRedBundle.map,
      emissive: new THREE.Color(0xff5e1a),
      emissiveMap: tapestryRedBundle.emissiveMap,
      emissiveIntensity: 1.35,
      alphaMap: tapestryRedBundle.alphaMap,
      alphaTest: 0.42,
      roughness: 0.72,
      metalness: 0.12,
      side: THREE.DoubleSide,
    })
  );

  const matCandleWax = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4e8d2,
      emissive: new THREE.Color(0x6e3a12),
      emissiveIntensity: 0.24,
      roughness: 0.56,
      metalness: 0.0,
    })
  );

  const matEmberCoal = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x261210,
      emissive: new THREE.Color(0xff4a12),
      emissiveIntensity: 1.45,
      roughness: 0.88,
      metalness: 0.05,
    })
  );

  // =========================================================================
  // 3. INDOOR FIRE-NIGHT LIGHTING RIG (Rich Warm-Cool Contrast, Zero Whiteout!)
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0x886488, 0x623428, 0.86);
  hemiLight.position.set(0, 14, 0);
  group.add(hemiLight);

  // Key warm crimson-amber light streaming diagonally from shattered rear stained windows & inferno
  const keyWindowLight = new THREE.DirectionalLight(0xffb474, 1.48);
  keyWindowLight.position.set(-5.8, 11.2, -10.2);
  keyWindowLight.target.position.set(0.4, 0.0, 1.0);
  keyWindowLight.castShadow = true;
  keyWindowLight.shadow.mapSize.set(2048, 2048);
  keyWindowLight.shadow.camera.left = -14.0;
  keyWindowLight.shadow.camera.right = 14.0;
  keyWindowLight.shadow.camera.top = 12.5;
  keyWindowLight.shadow.camera.bottom = -11.5;
  keyWindowLight.shadow.camera.near = 2.0;
  keyWindowLight.shadow.camera.far = 36.0;
  keyWindowLight.shadow.bias = -0.0005;
  keyWindowLight.shadow.normalBias = 0.032;
  group.add(keyWindowLight);
  group.add(keyWindowLight.target);

  // Subtle cool moonlit-indigo front bounce so front fluted piers & gilded carvings stay sculptural
  const coolFillLight = new THREE.DirectionalLight(0x98b2e6, 0.56);
  coolFillLight.position.set(8.5, 7.2, 12.8);
  coolFillLight.castShadow = false;
  group.add(coolFillLight);

  const ambientLight = new THREE.AmbientLight(0x523440, 0.36);
  group.add(ambientLight);

  // 6 Dynamic Flickering Firelight PointLights (optimized for crisp lighting + SwiftShader speed)
  const firePointLights = [];
  const fireLightDefs = [
    // 0: Central blazing inferno directly behind the East-Wing iron portcullis
    { pos: [0.0, 2.75, -7.85], role: 'gate', baseInt: 26.0, dist: 21.0, decay: 1.60, phase: 0.4 },
    // 1-2: Left & Right rear corner alcove fires licking tapestries & stained-glass sills
    { pos: [-6.7, 2.25, -4.95], role: 'alcove', baseInt: 18.0, dist: 16.5, decay: 1.65, phase: 1.7 },
    { pos: [6.7, 2.25, -4.95], role: 'alcove', baseInt: 18.0, dist: 16.5, decay: 1.65, phase: 3.1 },
    // 3-4: Mid-corridor standing wrought-iron candelabras illuminating flanks & carpet border
    { pos: [-7.55, 2.45, -0.65], role: 'candle', baseInt: 14.5, dist: 14.5, decay: 1.70, phase: 2.4 },
    { pos: [7.55, 2.45, -0.65], role: 'candle', baseInt: 14.5, dist: 14.5, decay: 1.70, phase: 4.5 },
    // 5: Front-left toppled candelabra hearth glow giving warm lower-foreground rim depth
    { pos: [-6.8, 1.35, 2.45], role: 'hearth', baseInt: 11.5, dist: 13.0, decay: 1.72, phase: 5.2 },
  ];
  for (const def of fireLightDefs) {
    const pt = new THREE.PointLight(0xff7d32, def.baseInt, def.dist, def.decay);
    pt.position.set(def.pos[0], def.pos[1], def.pos[2]);
    pt.castShadow = false;
    group.add(pt);
    firePointLights.push({
      light: pt,
      role: def.role,
      baseScale: def.baseInt / 18.0,
      phase: def.phase,
    });
  }

  // =========================================================================
  // 4. EXTERIOR BLOOD-MOON FIRE-NIGHT SKY DOME & DISTANT BURNING MANOR SILHOUETTES
  //    (Visible exclusively through the shattered tall Gothic windows & iron gate!)
  // =========================================================================
  const skyUniforms = {
    uTime: { value: 0 },
    uZenithColor: { value: new THREE.Color(0x0f0b21) },
    uMidSkyColor: { value: new THREE.Color(0x3f1528) },
    uHorizonColor: { value: new THREE.Color(0xb8361c) },
    uSunWarmColor: { value: new THREE.Color(0xff5232) },
    uCloudTint: { value: new THREE.Color(0x7c2620) },
    uMoonDir: { value: new THREE.Vector3(-0.24, 0.21, -0.947).normalize() },
    uInfernoGlow: { value: 1.0 },
  };

  const matNightSky = trackMat(
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
        uniform vec3 uCloudTint;
        uniform vec3 uMoonDir;
        uniform float uInfernoGlow;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
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
            p = p * 2.04 + vec2(9.2, 5.7);
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);

          vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.34, h));
          col = mix(col, uZenithColor, smoothstep(0.28, 0.85, h));

          if (dir.y < 0.0) {
            col = mix(uHorizonColor, vec3(0.24, 0.05, 0.06), clamp(-dir.y * 3.5, 0.0, 1.0));
          }

          // Pulsing fire horizon glow from burning manor grounds outside
          float flicker = 0.92 + 0.08 * sin(uTime * 3.8) * cos(uTime * 6.1);
          float horizFire = exp(-abs(dir.y - 0.03) * 7.5) * uInfernoGlow * flicker;
          col += uSunWarmColor * horizFire * 0.55;

          // Haunting Crimson Blood Moon framed behind shattered left-rear Gothic window
          float moonDot = max(dot(dir, uMoonDir), 0.0);
          float moonHalo = pow(moonDot, 14.0) * 0.34 + pow(moonDot, 80.0) * 0.45;
          float moonDisc = smoothstep(0.9958, 0.9978, moonDot);
          col += vec3(0.95, 0.28, 0.24) * moonHalo;
          col = mix(col, vec3(1.0, 0.74, 0.62), moonDisc * 0.92);

          // Billowing smoke clouds backlit scarlet-amber from below
          if (dir.y > -0.05) {
            vec2 uv = dir.xz / (max(dir.y, 0.04) + 0.32);
            uv.x += uTime * 0.018;
            uv.y -= uTime * 0.012;
            float n = fbm(uv * 1.45);
            float n2 = fbm(uv * 2.8 - vec2(uTime * 0.024, 0.0));
            float cloud = smoothstep(0.42, 0.78, n * 0.65 + n2 * 0.35) * smoothstep(0.75, 0.08, h);
            vec3 smokeCol = mix(vec3(0.10, 0.05, 0.09), uCloudTint, smoothstep(0.32, 0.02, h) * uInfernoGlow);
            col = mix(col, smokeCol, cloud * 0.62);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );

  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(86, 32, 20)), matNightSky);
  skyDome.renderOrder = -10;
  group.add(skyDome);

  // Exterior Manor Courtyard Silhouettes seen through shattered glass (adds deep parallax!)
  const matExteriorSilhouette = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x1e0e16,
      fog: true,
    })
  );
  const extGroup = new THREE.Group();
  const extTowerSpecs = [
    { x: -9.5, z: -16.5, r: 1.5, h: 11.5 },
    { x: -4.4, z: -19.0, r: 1.25, h: 10.2 },
    { x: 4.8, z: -18.5, r: 1.35, h: 10.8 },
    { x: 9.8, z: -16.2, r: 1.55, h: 12.0 },
  ];
  for (const t of extTowerSpecs) {
    const body = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(t.r, t.r * 1.08, t.h, 8)), matExteriorSilhouette);
    body.position.set(t.x, t.h * 0.5 - 1.0, t.z);
    extGroup.add(body);
    const spire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(t.r * 1.15, 4.2, 8)), matExteriorSilhouette);
    spire.position.set(t.x, t.h + 1.0, t.z);
    extGroup.add(spire);
  }
  group.add(extGroup);

  // =========================================================================
  // 5. CORRIDOR MARBLE PARQUET FLOOR & CRIMSON-GOLD DUCAL HERALDIC CARPET
  //    Strictly y = 0.000 across x in [-7.4, +7.4], z in [-4.4, +4.4]!
  // =========================================================================
  const floorGroup = new THREE.Group();
  group.add(floorGroup);

  // Main continuous indoor parquet floor slab spanning combat corridor + rear flaming wing + camera foreground
  const mainFloorSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(27.0, 0.5, 32.5)), matParquetFloor);
  mainFloorSlab.position.set(0, -0.25, -3.25);
  mainFloorSlab.receiveShadow = true;
  floorGroup.add(mainFloorSlab);

  // Flush dark-marble & gold gallery border inlays outside combat footprints (paper-thin y = 0.004)
  function addFlushTrim(w, d, x, z, mat) {
    const m = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, 0.008, d)), mat);
    m.position.set(x, 0.004, z);
    m.receiveShadow = true;
    floorGroup.add(m);
  }
  addFlushTrim(20.6, 0.34, 0, -4.82, matDarkMarble);
  addFlushTrim(20.6, 0.07, 0, -4.60, matGold);
  addFlushTrim(20.6, 0.34, 0, 4.62, matDarkMarble);
  addFlushTrim(20.6, 0.07, 0, 4.40, matGold);
  addFlushTrim(0.36, 9.8, -8.55, -0.1, matDarkMarble);
  addFlushTrim(0.36, 9.8, 8.55, -0.1, matDarkMarble);
  addFlushTrim(0.07, 9.4, -8.32, -0.1, matGold);
  addFlushTrim(0.07, 9.4, 8.32, -0.1, matGold);

  // Main East-Wing Grand Crimson-Gold Ducal Carpet Runner (stretches horizontally along corridor X)
  const mainCarpetGeo = trackGeo(new THREE.PlaneGeometry(21.4, 4.15));
  mainCarpetGeo.rotateX(-Math.PI / 2);
  const mainCarpetMesh = new THREE.Mesh(mainCarpetGeo, matCarpetMain);
  mainCarpetMesh.position.set(0, 0.009, 0.0);
  mainCarpetMesh.receiveShadow = true;
  floorGroup.add(mainCarpetMesh);

  // Thin spun-gold metallic edging strips along main carpet seams (flush y = 0.011)
  addFlushTrim(21.4, 0.055, 0, -2.07, matGold);
  addFlushTrim(21.4, 0.055, 0, 2.07, matGold);

  // Perpendicular Ceremonial Carpet Branch running under the Central Iron Portcullis into burning rear hall!
  const branchCarpetGeo = trackGeo(new THREE.PlaneGeometry(11.6, 3.65));
  branchCarpetGeo.rotateX(-Math.PI / 2);
  branchCarpetGeo.rotateY(Math.PI / 2);
  const branchCarpetMesh = new THREE.Mesh(branchCarpetGeo, matCarpetBranch);
  branchCarpetMesh.position.set(0, 0.007, -7.85);
  branchCarpetMesh.receiveShadow = true;
  floorGroup.add(branchCarpetMesh);

  addFlushTrim(0.055, 11.6, -1.82, -7.85, matGold);
  addFlushTrim(0.055, 11.6, 1.82, -7.85, matGold);

  // Side colonnade raised marble wall plinth curbs (strictly |x| >= 9.05, z <= -5.25 -> zero intrusion!)
  const backPlinthLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.2, 0.16, 1.35)), matDarkMarble);
  backPlinthLeft.position.set(-6.45, 0.08, -5.85);
  backPlinthLeft.receiveShadow = true;
  floorGroup.add(backPlinthLeft);

  const backPlinthRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.2, 0.16, 1.35)), matDarkMarble);
  backPlinthRight.position.set(6.45, 0.08, -5.85);
  backPlinthRight.receiveShadow = true;
  floorGroup.add(backPlinthRight);

  for (const side of [-1, 1]) {
    const sideCurb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.35, 0.16, 13.2)), matDarkMarble);
    sideCurb.position.set(side * 9.85, 0.08, 0.45);
    sideCurb.receiveShadow = true;
    floorGroup.add(sideCurb);
  }

  // =========================================================================
  // 6. MONUMENTAL GOTHIC COLONNADE, FLUTED MARBLE COLUMNS, POINTED ARCHES,
  //    CARVED WALL NICHES & HIGH RIBBED CROSS-VAULT CEILING (y > 5.5!)
  // =========================================================================
  const archGroup = new THREE.Group();
  group.add(archGroup);

  // 6A. True 16-Flute Sculpted Gothic Marble Column Shaft Geometry
  function createFlutedShaftGeo(rBot, rTop, height) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, height, 32, 6, false);
    const pos = geo.attributes.position;
    const fluteDepth = rBot * 0.082;
    const halfH = height * 0.5;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      const y = pos.getY(i);
      let z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r > rTop * 0.35) {
        const yNorm = (y + halfH) / height;
        const mask =
          THREE.MathUtils.smoothstep(yNorm, 0.03, 0.09) *
          (1.0 - THREE.MathUtils.smoothstep(yNorm, 0.91, 0.97));
        const ang = Math.atan2(z, x);
        const w = Math.cos(ang * 16.0);
        const indent = (w < 0 ? w * fluteDepth : w * fluteDepth * 0.22) * mask;
        const sc = Math.max(0.05, r + indent) / r;
        x *= sc;
        z *= sc;
        pos.setXYZ(i, x, y, z);
      }
    }
    geo.computeVertexNormals();
    return trackGeo(geo);
  }

  // 6B. True Two-Centered Pointed Ogival Gothic Arch Spandrel (ExtrudeGeometry)
  function createPointedArchSpandrelGeo(bayWidth, archSpanW, archPeakH, totalH, depth, withOculi = true) {
    const hw = bayWidth * 0.5;
    const sw = archSpanW * 0.5;
    const h = Math.max(archPeakH, sw * 1.12);
    const cx = (h * h - sw * sw) / (2 * sw);
    const R = sw + cx;
    const apexAng = Math.atan2(h, cx);

    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(-sw, 0);

    const segs = 14;
    for (let i = 1; i <= segs; i++) {
      const ang = Math.PI - (i / segs) * apexAng;
      shape.lineTo(cx + Math.cos(ang) * R, Math.sin(ang) * R);
    }
    for (let i = 1; i <= segs; i++) {
      const ang = apexAng * (1 - i / segs);
      shape.lineTo(-cx + Math.cos(ang) * R, Math.sin(ang) * R);
    }

    shape.lineTo(hw, 0);
    shape.lineTo(hw, totalH);
    shape.lineTo(-hw, totalH);
    shape.closePath();

    if (withOculi && hw - sw > 0.35 && totalH > 1.2) {
      for (const side of [-1, 1]) {
        const oculus = new THREE.Path();
        oculus.absarc(side * (hw - 0.42), totalH - 0.52, 0.17, 0, Math.PI * 2, true);
        shape.holes.push(oculus);
      }
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

  // 6C. Pointed Lancet Window Geometry with Normalized [0, 1] UVs
  function createPointedLancetGeo(width, springH, peakExtraH) {
    const sw = width * 0.5;
    const h = Math.max(peakExtraH, sw * 1.15);
    const cx = (h * h - sw * sw) / (2 * sw);
    const R = sw + cx;
    const apexAng = Math.atan2(h, cx);

    const shape = new THREE.Shape();
    shape.moveTo(-sw, 0);
    shape.lineTo(-sw, springH);
    const segs = 12;
    for (let i = 1; i <= segs; i++) {
      const ang = Math.PI - (i / segs) * apexAng;
      shape.lineTo(cx + Math.cos(ang) * R, springH + Math.sin(ang) * R);
    }
    for (let i = 1; i <= segs; i++) {
      const ang = apexAng * (1 - i / segs);
      shape.lineTo(-cx + Math.cos(ang) * R, springH + Math.sin(ang) * R);
    }
    shape.lineTo(sw, 0);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape, 12);
    const totalH = springH + h;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + sw) / width, pos.getY(i) / totalH);
    }
    uv.needsUpdate = true;
    return trackGeo(geo);
  }

  // Shared Multi-Part Fluted Gothic Column Geometries (Column top abacus at y = 4.92)
  const geoColPlinthBot = trackGeo(new THREE.BoxGeometry(1.02, 0.32, 1.02));
  const geoColPlinthMid = trackGeo(new THREE.BoxGeometry(0.84, 0.24, 0.84));
  const geoColBaseMolding = trackGeo(new THREE.CylinderGeometry(0.36, 0.42, 0.16, 12));
  const geoColGoldRing = trackGeo(new THREE.TorusGeometry(0.34, 0.042, 8, 18));
  geoColGoldRing.rotateX(Math.PI / 2);
  const geoColShaft = createFlutedShaftGeo(0.32, 0.29, 3.55);
  const geoColColonnette = trackGeo(new THREE.CylinderGeometry(0.068, 0.074, 3.52, 8));
  const geoColMidBand = trackGeo(new THREE.TorusGeometry(0.35, 0.034, 8, 18));
  geoColMidBand.rotateX(Math.PI / 2);
  const geoColCapBell = trackGeo(new THREE.CylinderGeometry(0.50, 0.30, 0.42, 8));
  const geoColCapLeaf = trackGeo(new THREE.BoxGeometry(0.16, 0.28, 0.16));
  const geoColCapAbacus = trackGeo(new THREE.BoxGeometry(1.06, 0.18, 1.06));
  const geoKeystone = trackGeo(new THREE.OctahedronGeometry(0.22, 0));

  function buildFlutedGothicColumn(x, z, scaleXZ = 1.0, parent = archGroup) {
    const col = new THREE.Group();
    col.position.set(x, 0, z);

    const pBot = new THREE.Mesh(geoColPlinthBot, matDarkMarble);
    pBot.position.y = 0.16;
    pBot.scale.set(scaleXZ, 1, scaleXZ);
    pBot.castShadow = true;
    pBot.receiveShadow = true;
    col.add(pBot);

    const pMid = new THREE.Mesh(geoColPlinthMid, matMarble);
    pMid.position.y = 0.44;
    pMid.scale.set(scaleXZ, 1, scaleXZ);
    pMid.castShadow = true;
    pMid.receiveShadow = true;
    col.add(pMid);

    const bMold = new THREE.Mesh(geoColBaseMolding, matDarkMarble);
    bMold.position.y = 0.64;
    bMold.scale.set(scaleXZ, 1, scaleXZ);
    col.add(bMold);

    const bGold = new THREE.Mesh(geoColGoldRing, matGold);
    bGold.position.y = 0.74;
    bGold.scale.setScalar(scaleXZ);
    col.add(bGold);

    const shaft = new THREE.Mesh(geoColShaft, matMarble);
    shaft.position.y = 2.52;
    shaft.scale.set(scaleXZ, 1, scaleXZ);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    col.add(shaft);

    // 4 attached Gothic cluster colonnettes
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const sub = new THREE.Mesh(geoColColonnette, matDarkMarble);
      sub.position.set(Math.cos(ang) * 0.315 * scaleXZ, 2.52, Math.sin(ang) * 0.315 * scaleXZ);
      sub.scale.set(scaleXZ, 1, scaleXZ);
      col.add(sub);
    }

    // Mid-shaft decorative gilded collar ring
    const mBand = new THREE.Mesh(geoColMidBand, matGold);
    mBand.position.y = 2.48;
    mBand.scale.setScalar(scaleXZ);
    col.add(mBand);

    // Upper necking gold collar + carved foliate capital bell + 4 corner acanthus volutes + abacus
    const nGold = new THREE.Mesh(geoColGoldRing, matGold);
    nGold.position.y = 4.30;
    nGold.scale.setScalar(scaleXZ * 0.96);
    col.add(nGold);

    const bell = new THREE.Mesh(geoColCapBell, matMarble);
    bell.position.y = 4.54;
    bell.scale.set(scaleXZ, 1, scaleXZ);
    bell.castShadow = true;
    col.add(bell);

    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const leaf = new THREE.Mesh(geoColCapLeaf, matGold);
      leaf.position.set(Math.cos(ang) * 0.34 * scaleXZ, 4.58, Math.sin(ang) * 0.34 * scaleXZ);
      leaf.rotation.set(Math.sin(ang) * 0.28, ang, -Math.cos(ang) * 0.28);
      col.add(leaf);
    }

    const abacus = new THREE.Mesh(geoColCapAbacus, matDarkMarble);
    abacus.position.y = 4.84;
    abacus.scale.set(scaleXZ, 1, scaleXZ);
    abacus.castShadow = true;
    abacus.receiveShadow = true;
    col.add(abacus);

    parent.add(col);
    return col;
  }

  // --- 6D. Back Corridor Monumental Gothic Wall & 5-Bay Arcade (z = -5.65 front pier line) ---
  const BACK_PIER_Z = -5.65;
  const BACK_WALL_Z = -6.35;
  const backPierXs = [-9.9, -6.1, -2.3, 2.3, 6.1, 9.9];

  for (const px of backPierXs) {
    const isGatePier = Math.abs(px) < 2.5;
    const isCorner = Math.abs(px) > 9.5;
    buildFlutedGothicColumn(px, BACK_PIER_Z, isGatePier ? 1.18 : isCorner ? 1.12 : 1.0);
  }

  // Pointed Gothic Arches across the 5 Back Bays (spring at y = 4.92, cornice at y = 7.42)
  const geoCenterGateArch = createPointedArchSpandrelGeo(4.6, 3.85, 2.25, 2.95, 0.82, true);
  const geoSideWindowArch = createPointedArchSpandrelGeo(3.8, 3.05, 1.92, 2.95, 0.72, true);

  // Center Gate Pointed Arch
  const centerArch = new THREE.Mesh(geoCenterGateArch, matMarbleArch);
  centerArch.position.set(0, 4.92, BACK_PIER_Z);
  centerArch.castShadow = true;
  centerArch.receiveShadow = true;
  archGroup.add(centerArch);

  const centerKeystone = new THREE.Mesh(geoKeystone, matGold);
  centerKeystone.position.set(0, 4.92 + 2.32, BACK_PIER_Z + 0.42);
  centerKeystone.scale.set(1.15, 1.45, 0.65);
  archGroup.add(centerKeystone);

  // 4 Flanking Back Arches (2 tall stained-glass window bays + 2 outer niche/window bays)
  const sideBayCenters = [-8.0, -4.2, 4.2, 8.0];
  for (const bx of sideBayCenters) {
    const arch = new THREE.Mesh(geoSideWindowArch, matMarbleArch);
    arch.position.set(bx, 4.92, BACK_PIER_Z);
    arch.castShadow = true;
    arch.receiveShadow = true;
    archGroup.add(arch);

    const ks = new THREE.Mesh(geoKeystone, matGold);
    ks.position.set(bx, 4.92 + 1.98, BACK_PIER_Z + 0.36);
    ks.scale.set(0.95, 1.28, 0.55);
    archGroup.add(ks);
  }

  // Upper Stone Cornice Frieze & Gilded Trim along Back Wall (y = 7.72)
  const backCornice = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(22.4, 0.36, 1.25)), matMarble);
  backCornice.position.set(0, 7.82, BACK_PIER_Z - 0.12);
  archGroup.add(backCornice);

  const backGoldFrieze = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(21.4, 0.09, 0.14)), matGold);
  backGoldFrieze.position.set(0, 7.56, BACK_PIER_Z + 0.42);
  archGroup.add(backGoldFrieze);

  // Solid Stone Back Wall Piers & Lower Wainscot Dado beneath Windows (leaves genuine open window apertures!)
  // Pier wall buttresses behind every column (blocking light leaks between bays)
  for (const px of backPierXs) {
    const wallPier = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 8.2, 0.72)), matWallStone);
    wallPier.position.set(px, 4.1, BACK_WALL_Z);
    wallPier.receiveShadow = true;
    archGroup.add(wallPier);
  }

  // Lower carved wainscot wall beneath the 4 flanking bays (y = 0 .. 1.48) + upper spandrel wall fill above window apex
  for (const bx of sideBayCenters) {
    const lowerWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 1.48, 0.64)), matWallStone);
    lowerWall.position.set(bx, 0.74, BACK_WALL_Z);
    lowerWall.receiveShadow = true;
    archGroup.add(lowerWall);

    // Carved dark-mahogany aristocratic wainscot panel + gold trim rail
    const wainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.75, 1.12, 0.14)), matWainscot);
    wainscot.position.set(bx, 0.72, BACK_WALL_Z + 0.34);
    wainscot.receiveShadow = true;
    archGroup.add(wainscot);

    const sillLedge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.12, 0.18, 0.56)), matMarble);
    sillLedge.position.set(bx, 1.50, BACK_WALL_Z + 0.18);
    sillLedge.receiveShadow = true;
    archGroup.add(sillLedge);

    const wainscotGold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.72, 0.045, 0.06)), matGold);
    wainscotGold.position.set(bx, 1.32, BACK_WALL_Z + 0.42);
    archGroup.add(wainscotGold);

    // Recessed stone wall arch surround framing the tall stained-glass window cleanly
    const winArchFrame = new THREE.Mesh(
      createPointedArchSpandrelGeo(3.15, 2.52, 1.62, 2.65, 0.44, false),
      matWallStone
    );
    winArchFrame.position.set(bx, 4.95, BACK_WALL_Z);
    archGroup.add(winArchFrame);
  }

  // Outer wing corner closures beyond x = ±9.9 so camera pan never sees outside edge gaps
  for (const side of [-1, 1]) {
    const cornerWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 8.6, 0.8)), matWallStone);
    cornerWall.position.set(side * 11.2, 4.3, BACK_WALL_Z);
    archGroup.add(cornerWall);
  }

  // --- 6E. Towering Shattered Painted Gothic Rose & Lancet Windows (4 Back Window Bays!) ---
  const geoBigLancetGlass = createPointedLancetGeo(2.58, 3.45, 1.62);
  const geoWinMullionV = trackGeo(new THREE.BoxGeometry(0.085, 4.75, 0.14));
  const geoWinMullionSide = trackGeo(new THREE.BoxGeometry(0.06, 3.55, 0.12));
  const geoWinTransom = trackGeo(new THREE.BoxGeometry(2.60, 0.085, 0.14));
  const geoRoseOuterRing = trackGeo(new THREE.TorusGeometry(0.68, 0.055, 8, 24));
  const geoRoseInnerRing = trackGeo(new THREE.TorusGeometry(0.24, 0.036, 8, 16));
  const geoRoseSpoke = trackGeo(new THREE.BoxGeometry(0.042, 1.32, 0.08));
  const geoShard = trackGeo(new THREE.ConeGeometry(0.11, 0.24, 3));

  function buildShatteredGothicWindow(x, yBase, z, rotY = 0, scale = 1.0) {
    const win = new THREE.Group();
    win.position.set(x, yBase, z);
    win.rotation.y = rotY;
    win.scale.setScalar(scale);

    // Shattered painted stained glass pane (alphaTest holes reveal real 3D Blood Moon Sky behind!)
    const glassMesh = new THREE.Mesh(geoBigLancetGlass, matStainedGlass);
    win.add(glassMesh);

    // 3D Carved Limestone Mullions & Transoms
    const mCenter = new THREE.Mesh(geoWinMullionV, matDarkMarble);
    mCenter.position.set(0, 2.38, 0.06);
    win.add(mCenter);

    for (const sx of [-0.62, 0.62]) {
      const mSide = new THREE.Mesh(geoWinMullionSide, matDarkMarble);
      mSide.position.set(sx, 1.78, 0.05);
      win.add(mSide);
    }

    for (const ty of [1.15, 2.32, 3.38]) {
      const tr = new THREE.Mesh(geoWinTransom, matDarkMarble);
      tr.position.set(0, ty, 0.06);
      win.add(tr);
    }

    // 3D Carved Stone & Gilded Gothic Rose Window Tracery Wheel in Upper Pointed Head
    const roseY = 3.92;
    const rOuter = new THREE.Mesh(geoRoseOuterRing, matMarble);
    rOuter.position.set(0, roseY, 0.08);
    win.add(rOuter);

    const rInner = new THREE.Mesh(geoRoseInnerRing, matGold);
    rInner.position.set(0, roseY, 0.09);
    win.add(rInner);

    for (let s = 0; s < 4; s++) {
      const sp = new THREE.Mesh(geoRoseSpoke, matDarkMarble);
      sp.position.set(0, roseY, 0.075);
      sp.rotation.z = (s * Math.PI) / 4;
      win.add(sp);
    }

    // Scattered broken stained-glass shards along the stone window sill
    const shardOffsets = [-0.88, -0.34, 0.12, 0.56, 0.94];
    for (let i = 0; i < shardOffsets.length; i++) {
      const sh = new THREE.Mesh(geoShard, matBrokenShard);
      sh.position.set(shardOffsets[i], 0.04, 0.24 + (i % 2) * 0.08);
      sh.rotation.set(Math.PI * 0.45, i * 1.1, 0.3 * i);
      sh.scale.set(0.85, 0.9, 0.32);
      win.add(sh);
    }

    archGroup.add(win);
  }

  for (const bx of sideBayCenters) {
    buildShatteredGothicWindow(bx, 1.56, BACK_WALL_Z + 0.02, 0, 1.0);
  }

  // --- 6F. Left & Right High Gothic Corridor Side Walls & Colonnades (x = ±9.9) ---
  const sidePierZs = [-5.65, -1.65, 2.35, 6.35];
  const geoSideColArch = createPointedArchSpandrelGeo(4.0, 3.15, 1.95, 2.95, 0.72, true);

  for (const side of [-1, 1]) {
    const colX = side * 9.85;
    const wallX = side * 10.55;

    // Columns along Z (skip z = -5.65 corner pier already built)
    for (let i = 1; i < sidePierZs.length; i++) {
      buildFlutedGothicColumn(colX, sidePierZs[i], 1.04);
    }

    // 3 Pointed Gothic Side Arches + Carved Wall Niches / High Clerestory Windows along Z
    for (let b = 0; b < 3; b++) {
      const bz = (sidePierZs[b] + sidePierZs[b + 1]) * 0.5;

      const sArch = new THREE.Mesh(geoSideColArch, matMarbleArch);
      sArch.position.set(colX, 4.92, bz);
      sArch.rotation.y = Math.PI / 2;
      sArch.castShadow = true;
      sArch.receiveShadow = true;
      archGroup.add(sArch);

      const ks = new THREE.Mesh(geoKeystone, matGold);
      ks.position.set(colX - side * 0.38, 4.92 + 2.00, bz);
      ks.scale.set(0.55, 1.28, 0.95);
      archGroup.add(ks);

      // Lower wainscot & carved stone wall niche backing
      const nicheBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 8.2, 4.05)), matWallStone);
      nicheBack.position.set(wallX + side * 0.25, 4.1, bz);
      nicheBack.receiveShadow = true;
      archGroup.add(nicheBack);

      const sideWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 1.32, 3.1)), matWainscot);
      sideWainscot.position.set(wallX - side * 0.02, 0.76, bz);
      sideWainscot.receiveShadow = true;
      archGroup.add(sideWainscot);

      // High inset stained-glass lancet on middle & rear side bays
      if (b < 2) {
        buildShatteredGothicWindow(
          wallX - side * 0.08,
          1.62,
          bz,
          side === -1 ? Math.PI / 2 : -Math.PI / 2,
          0.92
        );
      }
    }

    // Side upper cornice beam (y = 7.82)
    const sideCornice = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.36, 13.6)), matMarble);
    sideCornice.position.set(colX + side * 0.15, 7.82, 0.45);
    archGroup.add(sideCornice);

    const sideGoldLine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.09, 13.2)), matGold);
    sideGoldLine.position.set(colX - side * 0.38, 7.56, 0.45);
    archGroup.add(sideGoldLine);
  }

  // --- 6G. Soaring Gothic Cross-Ribbed Vault Ceiling (Strictly y > 5.5; Crown at y = 8.35!) ---
  // Spans z = -5.65 forward to z = +2.35 (open behind camera z > 5.5 so lens is 100% unobstructed!)
  const vaultGroup = new THREE.Group();
  group.add(vaultGroup);

  function buildPointedVaultRib(startPt, endPt, apexY, radius, mat, segs = 18) {
    const midX = (startPt.x + endPt.x) * 0.5;
    const midZ = (startPt.z + endPt.z) * 0.5;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = THREE.MathUtils.lerp(startPt.x, endPt.x, t);
      const z = THREE.MathUtils.lerp(startPt.z, endPt.z, t);
      // Gothic pointed arch curve (steep rise from side wall springing -> pointed apex at t = 0.5)
      const u = 1.0 - Math.abs(t * 2.0 - 1.0); // 0 at ends, 1 at center
      const archCurve = Math.pow(u, 0.62);
      const baseY = THREE.MathUtils.lerp(startPt.y, endPt.y, t);
      const y = baseY + (apexY - baseY) * archCurve;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, segs, radius, 8, false));
    const mesh = new THREE.Mesh(tubeGeo, mat);
    vaultGroup.add(mesh);
    return mesh;
  }

  const VAULT_SPRING_Y = 5.25;
  const VAULT_CROWN_Y = 8.38;
  const vaultBayZs = [-5.65, -1.65, 2.35, 6.05];

  // Transverse pointed ribs spanning x = -9.85 .. +9.85
  for (const vz of vaultBayZs) {
    buildPointedVaultRib(
      new THREE.Vector3(-9.85, VAULT_SPRING_Y, vz),
      new THREE.Vector3(9.85, VAULT_SPRING_Y, vz),
      VAULT_CROWN_Y,
      0.22,
      matMarble
    );
    // Thin gilded underside rib bead
    buildPointedVaultRib(
      new THREE.Vector3(-9.75, VAULT_SPRING_Y - 0.08, vz),
      new THREE.Vector3(9.75, VAULT_SPRING_Y - 0.08, vz),
      VAULT_CROWN_Y - 0.14,
      0.045,
      matGold
    );
  }

  // Diagonal cross-ribs (groin vault X-ribs) + sculpted gilded ceiling bosses in each bay
  const geoCeilingBoss = trackGeo(new THREE.CylinderGeometry(0.46, 0.36, 0.22, 8));
  const geoBossCore = trackGeo(new THREE.OctahedronGeometry(0.24, 0));

  for (let b = 0; b < vaultBayZs.length - 1; b++) {
    const z0 = vaultBayZs[b];
    const z1 = vaultBayZs[b + 1];
    const zMid = (z0 + z1) * 0.5;

    buildPointedVaultRib(
      new THREE.Vector3(-9.85, VAULT_SPRING_Y, z0),
      new THREE.Vector3(9.85, VAULT_SPRING_Y, z1),
      VAULT_CROWN_Y + 0.06,
      0.15,
      matMarbleArch
    );
    buildPointedVaultRib(
      new THREE.Vector3(9.85, VAULT_SPRING_Y, z0),
      new THREE.Vector3(-9.85, VAULT_SPRING_Y, z1),
      VAULT_CROWN_Y + 0.06,
      0.15,
      matMarbleArch
    );

    // Carved gilded Gothic keystone boss at rib intersection
    const boss = new THREE.Mesh(geoCeilingBoss, matDarkMarble);
    boss.position.set(0, VAULT_CROWN_Y - 0.04, zMid);
    vaultGroup.add(boss);

    const bossGold = new THREE.Mesh(geoBossCore, matGold);
    bossGold.position.set(0, VAULT_CROWN_Y - 0.16, zMid);
    bossGold.scale.set(1.2, 0.55, 1.2);
    vaultGroup.add(bossGold);
  }

  // Longitudinal Gothic ridge rib along central ceiling spine
  const ridgeRib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.24, 12.2)), matMarble);
  ridgeRib.position.set(0, VAULT_CROWN_Y + 0.08, 0.2);
  vaultGroup.add(ridgeRib);

  // Curved vaulted stone ceiling shell (spans smoothly over ribs at y = 5.75..8.62, DoubleSide)
  function buildVaultCeilingShell() {
    const segX = 20;
    const segZ = 8;
    const spanX = 20.6;
    const zStart = -6.4;
    const zEnd = 6.2;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let iz = 0; iz <= segZ; iz++) {
      const vz = iz / segZ;
      const z = THREE.MathUtils.lerp(zStart, zEnd, vz);
      for (let ix = 0; ix <= segX; ix++) {
        const ux = ix / segX;
        const x = (ux - 0.5) * spanX;
        const uCenter = 1.0 - Math.abs(ux * 2.0 - 1.0);
        const y = VAULT_SPRING_Y + 0.38 + (VAULT_CROWN_Y + 0.26 - (VAULT_SPRING_Y + 0.38)) * Math.pow(uCenter, 0.60);
        positions.push(x, y, z);
        uvs.push(ux * 4.0, vz * 3.0);
      }
    }

    const row = segX + 1;
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * row + ix;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        // Winding facing downward toward the corridor interior
        indices.push(a, b, d, a, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    trackGeo(geo);

    const matVaultShell = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x6f6066,
        map: matVaultStone.map,
        bumpMap: matVaultStone.bumpMap,
        bumpScale: 0.025,
        roughness: 0.78,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
    );
    const shell = new THREE.Mesh(geo, matVaultShell);
    vaultGroup.add(shell);
  }
  buildVaultCeilingShell();

  // =========================================================================
  // 7. HEAVY WROUGHT-IRON EAST-WING BLOCKADE PORTCULLIS GATE & DEEP BURNING
  //    REAR CORRIDOR EXTENSION (z = -5.85 .. -14.5)
  // =========================================================================
  const gateGroup = new THREE.Group();
  group.add(gateGroup);

  // Deep rear corridor extension behind the portcullis (gives genuine architectural depth through the iron bars!)
  const rearArchGeo = createPointedArchSpandrelGeo(4.8, 3.85, 2.25, 2.95, 0.68, false);
  for (const rz of [-9.4, -12.8]) {
    buildFlutedGothicColumn(-2.35, rz, 1.0, gateGroup);
    buildFlutedGothicColumn(2.35, rz, 1.0, gateGroup);
    const rArch = new THREE.Mesh(rearArchGeo, matMarbleArch);
    rArch.position.set(0, 4.92, rz);
    gateGroup.add(rArch);
  }

  // Rear tunnel side walls & vaulted roof enclosing the blazing passage behind the iron gate
  for (const side of [-1, 1]) {
    const tunnelWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 8.2, 8.8)), matWallStone);
    tunnelWall.position.set(side * 2.85, 4.1, -10.2);
    gateGroup.add(tunnelWall);
  }
  const tunnelCeiling = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.45, 9.2)), matVaultStone);
  tunnelCeiling.position.set(0, 7.85, -10.2);
  gateGroup.add(tunnelCeiling);

  // Far inferno backstop glow wall at z = -14.4 so looking deep down the east wing shows blazing fire haze
  const matRearInfernoBackdrop = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xff541c,
      transparent: true,
      opacity: 0.88,
      fog: true,
    })
  );
  const rearBackWall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.6, 7.6)), matRearInfernoBackdrop);
  rearBackWall.position.set(0, 3.8, -14.1);
  gateGroup.add(rearBackWall);

  // Massive Forged Iron Portcullis Gate Frame & Grate at z = -5.85 (x in [-1.92, +1.92])
  const PORT_Z = -5.85;
  const portFrameL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 5.2, 0.34)), matPortcullisIron);
  portFrameL.position.set(-1.92, 2.6, PORT_Z);
  portFrameL.castShadow = true;
  gateGroup.add(portFrameL);

  const portFrameR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 5.2, 0.34)), matPortcullisIron);
  portFrameR.position.set(1.92, 2.6, PORT_Z);
  portFrameR.castShadow = true;
  gateGroup.add(portFrameR);

  const portTopBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.08, 0.32, 0.38)), matPortcullisIron);
  portTopBeam.position.set(0, 5.05, PORT_Z);
  portTopBeam.castShadow = true;
  gateGroup.add(portTopBeam);

  // 9 Heavy Vertical Iron Gate Bars + Forged Bottom Iron Spikes
  const geoVBar = trackGeo(new THREE.BoxGeometry(0.088, 5.05, 0.088));
  const geoVSpike = trackGeo(new THREE.ConeGeometry(0.072, 0.32, 4));
  const barXs = [-1.60, -1.20, -0.80, -0.40, 0.0, 0.40, 0.80, 1.20, 1.60];
  for (const bx of barXs) {
    const vBar = new THREE.Mesh(geoVBar, matPortcullisIron);
    vBar.position.set(bx, 2.86, PORT_Z);
    vBar.castShadow = true;
    gateGroup.add(vBar);

    const spike = new THREE.Mesh(geoVSpike, matPortcullisIron);
    spike.rotation.x = Math.PI;
    spike.position.set(bx, 0.19, PORT_Z);
    gateGroup.add(spike);
  }

  // 5 Heavy Horizontal Riveted Crossbars + Instanced Iron Rivet Studs
  const geoHBar = trackGeo(new THREE.BoxGeometry(3.76, 0.11, 0.13));
  const barYs = [0.64, 1.62, 2.62, 3.62, 4.56];
  const rivetPositions = [];
  for (const by of barYs) {
    const hBar = new THREE.Mesh(geoHBar, matPortcullisIron);
    hBar.position.set(0, by, PORT_Z);
    hBar.castShadow = true;
    gateGroup.add(hBar);

    for (const bx of barXs) {
      rivetPositions.push([bx, by, PORT_Z + 0.075]);
    }
  }

  const geoRivet = trackGeo(new THREE.OctahedronGeometry(0.044, 0));
  const instRivets = new THREE.InstancedMesh(geoRivet, matGold, rivetPositions.length);
  const tmpDummy = new THREE.Object3D();
  for (let i = 0; i < rivetPositions.length; i++) {
    tmpDummy.position.set(rivetPositions[i][0], rivetPositions[i][1], rivetPositions[i][2]);
    tmpDummy.rotation.set(0, 0, Math.PI / 4);
    tmpDummy.scale.set(1, 1, 0.55);
    tmpDummy.updateMatrix();
    instRivets.setMatrixAt(i, tmpDummy.matrix);
  }
  instRivets.instanceMatrix.needsUpdate = true;
  gateGroup.add(instRivets);

  // Heavy Central East-Wing Lock Escutcheon Crest & Flanking Hoist Chains
  const lockPlate = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 8)), matPortcullisIron);
  lockPlate.rotation.x = Math.PI / 2;
  lockPlate.position.set(0, 2.62, PORT_Z + 0.09);
  gateGroup.add(lockPlate);

  const lockRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.42, 0.042, 8, 16)), matGold);
  lockRim.position.set(0, 2.62, PORT_Z + 0.13);
  gateGroup.add(lockRim);

  const lockStar = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.22, 0)), matGold);
  lockStar.position.set(0, 2.62, PORT_Z + 0.15);
  lockStar.scale.set(1.0, 1.35, 0.35);
  gateGroup.add(lockStar);

  // Heavy Iron Hoist Chains on Left & Right of Portcullis Gate
  const geoChainLink = trackGeo(new THREE.TorusGeometry(0.075, 0.022, 6, 12));
  const chainMatrices = [];
  for (const sx of [-1.72, 1.72]) {
    for (let k = 0; k < 18; k++) {
      tmpDummy.position.set(sx, 4.95 + k * 0.11, PORT_Z + 0.16);
      tmpDummy.rotation.set(0, (k % 2) * (Math.PI * 0.5), 0);
      tmpDummy.scale.set(1, 1.25, 1);
      tmpDummy.updateMatrix();
      chainMatrices.push(tmpDummy.matrix.clone());
    }
  }
  const instChains = new THREE.InstancedMesh(geoChainLink, matWroughtIron, chainMatrices.length);
  for (let i = 0; i < chainMatrices.length; i++) {
    instChains.setMatrixAt(i, chainMatrices[i]);
  }
  instChains.instanceMatrix.needsUpdate = true;
  gateGroup.add(instChains);

  // =========================================================================
  // 8. BURNING TATTERED DUCAL CREST TAPESTRIES (6 Animated Hanging Cloths)
  // =========================================================================
  const animatedTapestries = [];
  const geoTapRod = trackGeo(new THREE.CylinderGeometry(0.038, 0.038, 1.72, 8));
  geoTapRod.rotateZ(Math.PI / 2);
  const geoTapFinial = trackGeo(new THREE.OctahedronGeometry(0.095, 0));

  function createBurningTapestry(x, yTop, z, rotY, width, height, variant, phase) {
    const holder = new THREE.Group();
    holder.position.set(x, yTop, z);
    holder.rotation.y = rotY;

    const rod = new THREE.Mesh(geoTapRod, matGold);
    holder.add(rod);
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(geoTapFinial, matGold);
      fin.position.x = sx * (width * 0.58 + 0.08);
      holder.add(fin);
    }

    const segW = 8;
    const segH = 18;
    const geo = new THREE.PlaneGeometry(width, height, segW, segH);
    geo.translate(0, -height * 0.5, 0);

    const pos = geo.attributes.position;
    const restPos = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      restPos[i * 3] = pos.getX(i);
      restPos[i * 3 + 1] = pos.getY(i);
      restPos[i * 3 + 2] = pos.getZ(i);
    }
    trackGeo(geo);

    const cloth = new THREE.Mesh(geo, variant === 'blue' ? matTapestryBlue : matTapestryRed);
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    holder.add(cloth);

    group.add(holder);
    animatedTapestries.push({
      geometry: geo,
      restPos,
      height,
      phase,
    });
  }

  // 4 Back Arcade Pier Tapestries (alternating royal sapphire & ducal burgundy) + 2 Side Gallery Tapestries
  createBurningTapestry(-6.1, 4.62, -5.08, 0, 1.32, 3.25, 'blue', 0.2);
  createBurningTapestry(-2.3, 4.72, -5.02, 0, 1.36, 3.35, 'red', 1.4);
  createBurningTapestry(2.3, 4.72, -5.02, 0, 1.36, 3.35, 'red', 2.6);
  createBurningTapestry(6.1, 4.62, -5.08, 0, 1.32, 3.25, 'blue', 3.8);
  createBurningTapestry(-9.28, 4.55, -1.65, Math.PI / 2, 1.28, 3.15, 'blue', 0.9);
  createBurningTapestry(9.28, 4.55, -1.65, -Math.PI / 2, 1.28, 3.15, 'red', 4.5);

  // =========================================================================
  // 9. CUSTOM GLSL 3D LAYERED SWAYING FLAME SYSTEM (Portcullis Inferno, Corner
  //    Fires, Candelabra Candles, Wall Torches & Chandelier Flames)
  // =========================================================================
  const flameUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 1.0 },
    uCoreColor: { value: new THREE.Color(0xfff1ba) },
    uMidColor: { value: new THREE.Color(0xff7f24) },
    uTipColor: { value: new THREE.Color(0xd61e12) },
  };

  function createFlameShaderMaterial(phaseOffset, speedMul = 1.0, opacityMul = 1.0) {
    return trackMat(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: flameUniforms.uTime,
          uIntensity: flameUniforms.uIntensity,
          uCoreColor: flameUniforms.uCoreColor,
          uMidColor: flameUniforms.uMidColor,
          uTipColor: flameUniforms.uTipColor,
          uPhase: { value: phaseOffset },
          uSpeed: { value: speedMul },
          uOpacityMul: { value: opacityMul },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uIntensity;
          uniform float uPhase;
          uniform float uSpeed;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            float h = clamp(uv.y, 0.0, 1.0);
            float bendW = pow(h, 1.45);
            float t = uTime * uSpeed + uPhase;
            // Organic multi-harmonic flame tongue licking & curling deformation
            float swayX = sin(t * 4.4 - h * 5.2) * 0.22 + sin(t * 9.3 - h * 8.6) * 0.09;
            float swayZ = cos(t * 3.9 - h * 4.8 + uPhase) * 0.16;
            float stretchY = 1.0 + (sin(t * 6.2) * 0.11 + sin(t * 11.4 + uPhase) * 0.05) * uIntensity;
            // Taper width organically toward flame tip
            float taper = mix(1.0, 0.34, pow(h, 1.25));
            p.x = p.x * taper + swayX * bendW * (0.85 + 0.35 * uIntensity);
            p.z += swayZ * bendW;
            p.y *= stretchY;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uIntensity;
          uniform vec3 uCoreColor;
          uniform vec3 uMidColor;
          uniform vec3 uTipColor;
          uniform float uPhase;
          uniform float uSpeed;
          uniform float uOpacityMul;
          varying vec2 vUv;

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

          void main() {
            vec2 uv = vUv;
            float t = uTime * uSpeed * 1.45 + uPhase;

            // Dual-octave rising flame turbulence
            float n1 = noise2D(vec2(uv.x * 3.6, uv.y * 3.2 - t * 2.4));
            float n2 = noise2D(vec2(uv.x * 7.4 + 2.1, uv.y * 6.4 - t * 4.2));
            float turb = n1 * 0.65 + n2 * 0.35;

            // Tapered flame silhouette with forked licking tongues
            float dx = abs(uv.x - 0.5) * 2.0;
            float widthEnv = mix(0.92, 0.14, pow(uv.y, 0.85));
            float distortedX = dx + (turb - 0.48) * (0.28 + uv.y * 0.52);
            float maskX = 1.0 - smoothstep(widthEnv * 0.42, widthEnv, distortedX);
            float maskBottom = smoothstep(0.0, 0.14, uv.y);
            float maskTop = 1.0 - smoothstep(0.48 + turb * 0.44, 0.98, uv.y);

            float flame = clamp(maskX * maskBottom * maskTop * (0.78 + turb * 0.55), 0.0, 1.0);
            if (flame < 0.02) discard;

            // Blackbody thermal gradient: incandescent gold core -> amber body -> crimson tips
            float coreMask = smoothstep(0.45, 0.92, flame) * (1.0 - smoothstep(0.12, 0.62, uv.y));
            float midMask = smoothstep(0.18, 0.65, flame) * (1.0 - smoothstep(0.35, 0.88, uv.y));
            vec3 col = mix(uTipColor, uMidColor, midMask);
            col = mix(col, uCoreColor, coreMask);
            col *= (0.85 + 0.30 * uIntensity);

            float alpha = flame * uOpacityMul * clamp(0.75 + 0.25 * uIntensity, 0.65, 1.0);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      })
    );
  }

  // Create shared pool of 8 distinct phase-varied flame shader materials for rich asynchronous motion
  const flameMaterials = [];
  for (let i = 0; i < 8; i++) {
    flameMaterials.push(createFlameShaderMaterial(i * 1.37, 0.92 + (i % 3) * 0.14, 0.92));
  }

  const geoFlameSheet = trackGeo(new THREE.PlaneGeometry(1.0, 1.0, 4, 10));
  geoFlameSheet.translate(0, 0.5, 0); // pivot cleanly at base y = 0

  const flameHalos = [];
  const emberOrigins = [];
  const smokeOrigins = [];

  function addFireCluster(x, y, z, width, height, { addEmbers = true, addSmoke = true, withCoalBed = true } = {}) {
    const fGrp = new THREE.Group();
    fGrp.position.set(x, y, z);

    // 3 crossed & rotated volumetric flame sheets (visible cleanly from all camera angles!)
    const sheetAngles = [0.0, Math.PI * 0.33, -Math.PI * 0.33];
    for (let i = 0; i < 3; i++) {
      const mat = flameMaterials[(Math.abs(Math.round(x * 3 + z * 2)) + i) % flameMaterials.length];
      const sheet = new THREE.Mesh(geoFlameSheet, mat);
      sheet.rotation.y = sheetAngles[i];
      const sc = i === 0 ? 1.0 : i === 1 ? 0.88 : 0.78;
      sheet.scale.set(width * sc, height * (i === 2 ? 0.84 : 1.0), 1.0);
      sheet.renderOrder = 3;
      fGrp.add(sheet);
    }

    // Glowing charred ember bed & fallen burning manor timber beneath larger ground fires
    if (withCoalBed) {
      const coalBed = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(width * 0.46, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)),
        matEmberCoal
      );
      coalBed.scale.set(1.0, 0.24, 0.82);
      fGrp.add(coalBed);

      const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width * 0.95, 0.14, 0.18)), matCharredTimber);
      beam.position.set(0.08, 0.08, 0.06);
      beam.rotation.set(0.08, 0.42 + x * 0.3, -0.05);
      fGrp.add(beam);
    }

    // Soft additive warm ambient fire halo sprite
    const haloMat = trackMat(
      new THREE.SpriteMaterial({
        color: 0xff7b28,
        map: glowTex,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const halo = new THREE.Sprite(haloMat);
    halo.position.y = height * 0.42;
    const baseHaloScale = Math.max(width, height) * 1.42;
    halo.scale.set(baseHaloScale, baseHaloScale * 1.12, 1);
    fGrp.add(halo);
    flameHalos.push({ sprite: halo, baseScale: baseHaloScale, baseOp: 0.46, phase: x * 0.9 + z * 0.7 });

    group.add(fGrp);

    if (addEmbers) {
      emberOrigins.push({ x, y: y + height * 0.35, z, spread: width * 0.55, maxRise: height * 1.8 + 2.2 });
    }
    if (addSmoke) {
      smokeOrigins.push({ x, y: y + height * 0.85, z, spread: width * 0.45 });
    }
  }

  // 9A. Blazing Sea of Fire Roaring Behind the East-Wing Iron Portcullis Gate (z = -6.7 .. -10.8)
  addFireCluster(0.0, 0.02, -7.25, 2.35, 3.15, { withCoalBed: true });
  addFireCluster(-1.35, 0.02, -6.95, 1.65, 2.55, { withCoalBed: true });
  addFireCluster(1.35, 0.02, -6.95, 1.65, 2.65, { withCoalBed: true });
  addFireCluster(-0.95, 0.02, -9.85, 2.25, 3.55, { withCoalBed: false, addSmoke: false });
  addFireCluster(1.05, 0.02, -10.15, 2.15, 3.45, { withCoalBed: false, addSmoke: false });

  // 9B. Corner Wall Alcoves & Tapestry Hearth Infernos (strictly z <= -5.25 or |x| >= 8.2)
  addFireCluster(-7.85, 0.14, -5.55, 1.55, 2.35, { withCoalBed: true });
  addFireCluster(7.85, 0.14, -5.55, 1.55, 2.35, { withCoalBed: true });
  addFireCluster(-4.15, 1.58, -6.08, 1.20, 1.75, { withCoalBed: false, addSmoke: false }); // blazing windowsill flame
  addFireCluster(4.15, 1.58, -6.08, 1.20, 1.75, { withCoalBed: false, addSmoke: false });
  addFireCluster(-8.85, 0.14, -2.85, 1.35, 2.05, { withCoalBed: true });
  addFireCluster(8.85, 0.14, -2.85, 1.35, 2.05, { withCoalBed: true });

  // =========================================================================
  // 10. ORNATE MULTI-ARM WROUGHT-IRON STANDING CANDELABRAS (Upright & Toppled!),
  //     WALL TORCH SCONCES & HANGING VAULT RING CHANDELIERS
  // =========================================================================
  const propsGroup = new THREE.Group();
  group.add(propsGroup);

  const geoCandBase = trackGeo(new THREE.CylinderGeometry(0.18, 0.34, 0.16, 6));
  const geoCandFoot = trackGeo(new THREE.BoxGeometry(0.11, 0.09, 0.42));
  const geoCandStem = trackGeo(new THREE.CylinderGeometry(0.036, 0.056, 1.78, 10));
  const geoCandKnop = trackGeo(new THREE.SphereGeometry(0.092, 10, 8));
  const geoCandCup = trackGeo(new THREE.CylinderGeometry(0.11, 0.06, 0.08, 10));
  const geoCandWax = trackGeo(new THREE.CylinderGeometry(0.044, 0.048, 0.30, 8));
  const geoCandArm = trackGeo(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.22, -0.06, 0),
        new THREE.Vector3(0.36, 0.12, 0),
        new THREE.Vector3(0.38, 0.28, 0),
      ]),
      10,
      0.018,
      6,
      false
    )
  );

  function addSmallCandleFlame(parent, x, y, z, scale = 1.0, phase = 0) {
    const fGrp = new THREE.Group();
    fGrp.position.set(x, y, z);
    const mat = flameMaterials[Math.abs(Math.round(phase * 10)) % flameMaterials.length];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(geoFlameSheet, mat);
      m.rotation.y = i * (Math.PI * 0.5);
      m.scale.set(0.18 * scale, 0.34 * scale, 1.0);
      m.renderOrder = 3;
      fGrp.add(m);
    }
    parent.add(fGrp);
  }

  // 10A. Multi-Arm Standing Wrought-Iron Candelabra (Upright Burning Variant)
  function buildStandingCandelabra(x, z, rotY = 0) {
    const cGrp = new THREE.Group();
    cGrp.position.set(x, 0, z);
    cGrp.rotation.y = rotY;

    // 3 scrolled tripod iron feet + hexagonal pedestal base
    for (let i = 0; i < 3; i++) {
      const foot = new THREE.Mesh(geoCandFoot, matWroughtIron);
      const ang = (i * Math.PI * 2) / 3;
      foot.position.set(Math.cos(ang) * 0.22, 0.045, Math.sin(ang) * 0.22);
      foot.rotation.y = -ang + Math.PI * 0.5;
      foot.castShadow = true;
      cGrp.add(foot);
    }

    const base = new THREE.Mesh(geoCandBase, matWroughtIron);
    base.position.y = 0.12;
    base.castShadow = true;
    cGrp.add(base);

    const stem = new THREE.Mesh(geoCandStem, matWroughtIron);
    stem.position.y = 1.08;
    stem.castShadow = true;
    cGrp.add(stem);

    // Gilded decorative knops along iron shaft
    for (const ky of [0.58, 1.24, 1.88]) {
      const knop = new THREE.Mesh(geoCandKnop, matGold);
      knop.position.y = ky;
      knop.scale.set(1.0, 0.72, 1.0);
      cGrp.add(knop);
    }

    // Center tall candle spire
    const cCup = new THREE.Mesh(geoCandCup, matGold);
    cCup.position.y = 2.02;
    cGrp.add(cCup);
    const cWax = new THREE.Mesh(geoCandWax, matCandleWax);
    cWax.position.y = 2.20;
    cGrp.add(cWax);
    addSmallCandleFlame(cGrp, 0, 2.34, 0, 1.15, x + z);

    // 4 curved wrought-iron scroll arms with brass drip-cups, candles & dancing flames
    for (let i = 0; i < 4; i++) {
      const armWrap = new THREE.Group();
      armWrap.position.y = 1.76;
      armWrap.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;

      const arm = new THREE.Mesh(geoCandArm, matWroughtIron);
      armWrap.add(arm);

      const cup = new THREE.Mesh(geoCandCup, matGold);
      cup.position.set(0.38, 0.29, 0);
      cup.scale.setScalar(0.84);
      armWrap.add(cup);

      const wax = new THREE.Mesh(geoCandWax, matCandleWax);
      wax.position.set(0.38, 0.44, 0);
      wax.scale.set(0.86, 0.85, 0.86);
      armWrap.add(wax);

      addSmallCandleFlame(armWrap, 0.38, 0.57, 0, 0.92, x * 1.3 + i * 0.9);
      cGrp.add(armWrap);
    }

    // Soft warm glow halo encompassing the 5-flame crown
    const haloMat = trackMat(
      new THREE.SpriteMaterial({
        color: 0xffb24c,
        map: glowTex,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const halo = new THREE.Sprite(haloMat);
    halo.position.y = 2.32;
    halo.scale.set(1.95, 1.85, 1);
    cGrp.add(halo);
    flameHalos.push({ sprite: halo, baseScale: 1.95, baseOp: 0.56, phase: x * 0.8 + z * 1.1 });

    propsGroup.add(cGrp);
    emberOrigins.push({ x, y: 2.35, z, spread: 0.38, maxRise: 1.8 });
  }

  // 10B. Toppled & Snapped Wrought-Iron Candelabra (Fallen on Corridor Margin, Igniting Floor Flame!)
  function buildToppledCandelabra(x, z, yaw, withFloorFire = true) {
    const tGrp = new THREE.Group();
    tGrp.position.set(x, 0.14, z);
    tGrp.rotation.y = yaw;

    // Lower fallen shaft resting horizontally on marble floor
    const fallenBody = new THREE.Group();
    fallenBody.rotation.z = Math.PI * 0.47;

    const base = new THREE.Mesh(geoCandBase, matWroughtIron);
    base.position.y = 0.12;
    base.castShadow = true;
    fallenBody.add(base);

    const stemLower = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.056, 1.25, 10)), matWroughtIron);
    stemLower.position.y = 0.78;
    stemLower.castShadow = true;
    fallenBody.add(stemLower);

    const knop = new THREE.Mesh(geoCandKnop, matGold);
    knop.position.y = 0.62;
    knop.scale.set(1.0, 0.72, 1.0);
    fallenBody.add(knop);
    tGrp.add(fallenBody);

    // Snapped upper multi-arm crown lying skewed beside it
    const snappedCrown = new THREE.Group();
    snappedCrown.position.set(-1.38, 0.06, 0.24);
    snappedCrown.rotation.set(0.32, 0.55, Math.PI * 0.42);
    const upperStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.036, 0.04, 0.52, 8)), matWroughtIron);
    snappedCrown.add(upperStem);
    for (let i = 0; i < 3; i++) {
      const aw = new THREE.Group();
      aw.rotation.y = i * 1.85;
      const arm = new THREE.Mesh(geoCandArm, matWroughtIron);
      aw.add(arm);
      const cup = new THREE.Mesh(geoCandCup, matGold);
      cup.position.set(0.38, 0.29, 0);
      cup.scale.setScalar(0.84);
      aw.add(cup);
      snappedCrown.add(aw);
    }
    tGrp.add(snappedCrown);

    // Scattered rolled wax candles on the marble
    for (let c = 0; c < 2; c++) {
      const w = new THREE.Mesh(geoCandWax, matCandleWax);
      w.position.set(-1.15 - c * 0.35, -0.09, -0.22 + c * 0.48);
      w.rotation.set(Math.PI * 0.5, 0.4 + c * 1.2, 0.15);
      tGrp.add(w);
    }

    propsGroup.add(tGrp);

    if (withFloorFire) {
      // Licking floor flame ignited by the toppled candelabra!
      const fx = x - Math.cos(yaw) * 1.35;
      const fz = z + Math.sin(yaw) * 1.35;
      addFireCluster(fx, 0.02, fz, 1.12, 1.48, { withCoalBed: true, addSmoke: true });
    }
  }

  // Place 4 Upright Burning Candelabras + 2 Toppled Snapped Candelabras (all strictly outside [-6.5,6.5]x[-3.2,3.2]!)
  buildStandingCandelabra(-7.75, -4.45, 0.4);
  buildStandingCandelabra(7.75, -4.45, -0.4);
  buildStandingCandelabra(-8.35, -0.45, 0.8);
  buildStandingCandelabra(8.35, -0.45, -0.8);

  buildToppledCandelabra(-7.25, 2.35, 0.38, true);
  buildToppledCandelabra(8.55, 2.65, -2.55, true);

  // 10C. Wall-Mounted Wrought-Iron Pier Torch Sconces (8 torches glowing along columns)
  const geoSconceBracket = trackGeo(new THREE.BoxGeometry(0.08, 0.42, 0.36));
  const geoSconceCup = trackGeo(new THREE.ConeGeometry(0.14, 0.32, 8));
  geoSconceCup.rotateX(Math.PI);

  function addWallTorchSconce(x, y, z, rotY) {
    const sGrp = new THREE.Group();
    sGrp.position.set(x, y, z);
    sGrp.rotation.y = rotY;

    const br = new THREE.Mesh(geoSconceBracket, matWroughtIron);
    br.position.set(0, -0.06, 0.16);
    sGrp.add(br);

    const cup = new THREE.Mesh(geoSconceCup, matWroughtIron);
    cup.position.set(0, 0.14, 0.30);
    sGrp.add(cup);

    const rim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14, 0.024, 6, 12)), matGold);
    rim.rotation.x = Math.PI * 0.5;
    rim.position.set(0, 0.28, 0.30);
    sGrp.add(rim);

    addSmallCandleFlame(sGrp, 0, 0.30, 0.30, 1.85, x * 1.1 + z * 0.9);

    const hMat = trackMat(
      new THREE.SpriteMaterial({
        color: 0xff9d3a,
        map: glowTex,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const halo = new THREE.Sprite(hMat);
    halo.position.set(0, 0.52, 0.32);
    halo.scale.set(1.25, 1.35, 1);
    sGrp.add(halo);
    flameHalos.push({ sprite: halo, baseScale: 1.25, baseOp: 0.44, phase: x + z * 1.7 });

    propsGroup.add(sGrp);
  }

  addWallTorchSconce(-6.1, 2.75, -5.22, 0);
  addWallTorchSconce(-2.3, 2.85, -5.18, 0);
  addWallTorchSconce(2.3, 2.85, -5.18, 0);
  addWallTorchSconce(6.1, 2.75, -5.22, 0);
  addWallTorchSconce(-9.42, 2.75, 2.35, Math.PI / 2);
  addWallTorchSconce(9.42, 2.75, 2.35, -Math.PI / 2);

  // 10D. Two Suspended Wrought-Iron Gothic Ring Chandeliers (High at y = 6.28 .. 8.30, never blocks camera!)
  const hangingChandeliers = [];
  const geoChandRing = trackGeo(new THREE.TorusGeometry(1.42, 0.055, 8, 28));
  geoChandRing.rotateX(Math.PI / 2);
  const geoChandChain = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.95, 6));
  const geoChandSpoke = trackGeo(new THREE.BoxGeometry(2.82, 0.045, 0.055));

  for (const cz of [-3.65, 0.35]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, VAULT_CROWN_Y - 0.14, cz);

    const chain = new THREE.Mesh(geoChandChain, matWroughtIron);
    chain.position.y = -0.98;
    pivot.add(chain);

    const ringWrap = new THREE.Group();
    ringWrap.position.y = -1.92; // hangs cleanly at y ≈ 6.32 (well above y = 5.5!)

    const ring = new THREE.Mesh(geoChandRing, matWroughtIron);
    ringWrap.add(ring);

    const goldBand = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.44, 0.022, 6, 28)), matGold);
    goldBand.rotation.x = Math.PI / 2;
    ringWrap.add(goldBand);

    for (let s = 0; s < 2; s++) {
      const sp = new THREE.Mesh(geoChandSpoke, matWroughtIron);
      sp.rotation.y = s * (Math.PI * 0.5);
      ringWrap.add(sp);
    }

    // 8 flickering wax candles mounted around the hanging ring
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const cx = Math.cos(ang) * 1.42;
      const czOff = Math.sin(ang) * 1.42;
      const cup = new THREE.Mesh(geoCandCup, matGold);
      cup.position.set(cx, 0.07, czOff);
      cup.scale.setScalar(0.75);
      ringWrap.add(cup);

      const wax = new THREE.Mesh(geoCandWax, matCandleWax);
      wax.position.set(cx, 0.21, czOff);
      wax.scale.set(0.76, 0.72, 0.76);
      ringWrap.add(wax);

      // Keep 6 of 8 candles lit for lived-in coup-night realism
      if (k !== 2 && k !== 6) {
        addSmallCandleFlame(ringWrap, cx, 0.32, czOff, 0.95, cz + k * 0.7);
      }
    }

    pivot.add(ringWrap);
    vaultGroup.add(pivot);
    hangingChandeliers.push({ pivot, phase: cz * 0.8 + 0.5 });
  }

  // 10E. Subtle Foreground Tilt-Shift Corner Debris (Strictly z >= 7.8, |x| >= 7.6, y < 0.92!)
  for (const side of [-1, 1]) {
    const fgPlinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.82, 0.78, 0.82)), matDarkMarble);
    fgPlinth.position.set(side * 8.15, 0.39, 8.35);
    fgPlinth.rotation.y = side * 0.14;
    propsGroup.add(fgPlinth);

    const fgCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.94, 0.12, 0.94)), matMarble);
    fgCap.position.set(side * 8.15, 0.84, 8.35);
    fgCap.rotation.y = side * 0.14;
    propsGroup.add(fgCap);
  }

  // =========================================================================
  // 11. RISING HOT SPARKS & WISPY SMOKE PLUMES (InstancedMesh, Zero GC Churn!)
  // =========================================================================
  const sparkRng = createRng(808707);
  const SPARK_COUNT = 96;
  const sparkSpecs = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const orig = emberOrigins[i % emberOrigins.length];
    sparkSpecs.push({
      ox: orig.x + (sparkRng() - 0.5) * orig.spread * 1.4,
      oy: orig.y,
      oz: orig.z + (sparkRng() - 0.5) * orig.spread,
      maxRise: orig.maxRise,
      phase: sparkRng(),
      speed: 0.24 + sparkRng() * 0.32,
      swirlR: 0.16 + sparkRng() * 0.42,
      swirlFreq: 1.4 + sparkRng() * 1.8,
      baseScale: 0.72 + sparkRng() * 0.85,
    });
  }

  const geoSpark = trackGeo(new THREE.OctahedronGeometry(0.042, 0));
  const matSpark = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffc864,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const instSparks = new THREE.InstancedMesh(geoSpark, matSpark, SPARK_COUNT);
  group.add(instSparks);

  // Thin Rising Smoke Plumes drifting gracefully from fires toward the ribbed vault ceiling
  const SMOKE_COUNT = 34;
  const smokeSpecs = [];
  const smokeSprites = [];
  const smokeMatBase = trackMat(
    new THREE.SpriteMaterial({
      color: 0x3b2324,
      map: smokeTex || glowTex,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
  );

  for (let i = 0; i < SMOKE_COUNT; i++) {
    const orig = smokeOrigins[i % smokeOrigins.length];
    const mat = trackMat(smokeMatBase.clone());
    const sp = new THREE.Sprite(mat);
    group.add(sp);
    smokeSprites.push(sp);
    smokeSpecs.push({
      ox: orig.x + (sparkRng() - 0.5) * orig.spread,
      oy: orig.y,
      oz: orig.z + (sparkRng() - 0.5) * orig.spread * 0.6,
      phase: sparkRng(),
      speed: 0.11 + sparkRng() * 0.09,
      driftX: (sparkRng() - 0.5) * 0.9,
      baseSize: 1.05 + sparkRng() * 0.95,
      maxRise: 3.4 + sparkRng() * 2.1,
    });
  }

  // =========================================================================
  // 12. INDOOR FIRE-NIGHT MOOD VARIANTS (fire_corridor & fire_corridor_p2)
  //     Strictly calibrated to prevent character sprite whiteout / overexposure!
  // =========================================================================
  const CORRIDOR_MOODS = {
    fire_corridor: {
      subtitle: '政变火夜 · 公爵府东翼琥珀火廊',
      exposure: 0.98,
      hemiSky: 0x866288,
      hemiGround: 0x623326,
      hemiInt: 0.86,
      keyColor: 0xffb270,
      keyInt: 1.48,
      fillColor: 0x9ab4e8,
      fillInt: 0.56,
      ambColor: 0x523442,
      ambInt: 0.36,
      gateFireColor: 0xff7028,
      gateFireInt: 26.0,
      alcoveFireColor: 0xff8032,
      alcoveFireInt: 18.0,
      candleColor: 0xffa648,
      candleInt: 14.5,
      firePulseAmp: 1.0,
      firePulseFreq: 1.0,
      flameIntensity: 1.0,
      flameCoreColor: 0xfff1ba,
      flameMidColor: 0xff8024,
      flameTipColor: 0xd61e12,
      skyZenith: 0x0f0b21,
      skyMid: 0x3e1528,
      skyHorizon: 0xb8361c,
      skyWarm: 0xff5432,
      skyCloud: 0x7c2620,
      skyInfernoGlow: 1.0,
      stainedEmissive: 0xff6e38,
      stainedInt: 1.05,
      carpetEmissiveInt: 0.85,
      tapestryEmissiveInt: 1.35,
      portcullisEmissiveInt: 0.24,
      rearBackdropColor: 0xe64d1c,
      sparkColor: 0xffc864,
      sparkSpeedMul: 1.0,
      smokeColor: 0x3d2426,
      smokeOpacity: 0.17,
      draftMul: 1.0,
      fog: { color: 0x361c24, near: 14, far: 42 },
      background: 0x201018,
      atmospherePreset: {
        particleType: 'embers',
        particleColor: 0xffb854,
        particleSecondaryColor: 0xff5a24,
        particleCount: 440,
        particleSpeed: 1.18,
        particleWind: 1.15,
        godRayColor: 0xff9e56,
        godRayOpacity: 0.20,
        godRayOrigin: [0, 10.5, -9.5],
        godRayTarget: [0, 0.2, 0.4],
        bloomStrength: 0.35,
        bloomThreshold: 0.90,
        bloomRadius: 0.58,
        focusDepth: 0.56,
        focusBandHalf: 0.19,
        blurAmount: 1.45,
        vignetteStrength: 0.16,
        spriteRimTint: [1.02, 0.96, 0.90],
      },
    },
    fire_corridor_p2: {
      subtitle: '红莲铁幕 · 炽烈绯红火海二阶段',
      exposure: 0.96,
      hemiSky: 0x8e4e6e,
      hemiGround: 0x7a2c1e,
      hemiInt: 0.90,
      keyColor: 0xff8f52,
      keyInt: 1.62,
      fillColor: 0x94a8dc,
      fillInt: 0.52,
      ambColor: 0x5c2c34,
      ambInt: 0.38,
      gateFireColor: 0xff4c18,
      gateFireInt: 34.0,
      alcoveFireColor: 0xff5c1e,
      alcoveFireInt: 24.0,
      candleColor: 0xff8a34,
      candleInt: 17.5,
      firePulseAmp: 1.45,
      firePulseFreq: 1.32,
      flameIntensity: 1.36,
      flameCoreColor: 0xffe69c,
      flameMidColor: 0xff5c18,
      flameTipColor: 0xb80e0a,
      skyZenith: 0x160718,
      skyMid: 0x591224,
      skyHorizon: 0xdf3416,
      skyWarm: 0xff3b1a,
      skyCloud: 0x9c2018,
      skyInfernoGlow: 1.42,
      stainedEmissive: 0xff4c24,
      stainedInt: 1.32,
      carpetEmissiveInt: 1.25,
      tapestryEmissiveInt: 1.78,
      portcullisEmissiveInt: 0.46,
      rearBackdropColor: 0xff3a12,
      sparkColor: 0xffa642,
      sparkSpeedMul: 1.42,
      smokeColor: 0x4a201e,
      smokeOpacity: 0.22,
      draftMul: 1.48,
      fog: { color: 0x451a1e, near: 12, far: 38 },
      background: 0x2a0c12,
      atmospherePreset: {
        particleType: 'embers',
        particleColor: 0xffc65c,
        particleSecondaryColor: 0xff3b14,
        particleCount: 640,
        particleSpeed: 1.58,
        particleWind: 1.55,
        godRayColor: 0xff7638,
        godRayOpacity: 0.26,
        godRayOrigin: [0, 10.5, -9.5],
        godRayTarget: [0, 0.1, 0.5],
        bloomStrength: 0.40,
        bloomThreshold: 0.88,
        bloomRadius: 0.64,
        focusDepth: 0.56,
        focusBandHalf: 0.19,
        blurAmount: 1.50,
        vignetteStrength: 0.19,
        spriteRimTint: [1.03, 0.93, 0.86],
      },
    },
  };

  function cloneMoodResult(moodId, cfg) {
    return {
      moodId,
      exposure: cfg.exposure,
      fog: { ...cfg.fog },
      background: cfg.background,
      atmospherePreset: {
        ...cfg.atmospherePreset,
        godRayOrigin: cfg.atmospherePreset.godRayOrigin.slice(),
        godRayTarget: cfg.atmospherePreset.godRayTarget.slice(),
        spriteRimTint: cfg.atmospherePreset.spriteRimTint.slice(),
      },
    };
  }

  function makeMoodSnapshot(cfg) {
    return {
      hemiSky: new THREE.Color(cfg.hemiSky),
      hemiGround: new THREE.Color(cfg.hemiGround),
      hemiInt: cfg.hemiInt,
      keyColor: new THREE.Color(cfg.keyColor),
      keyInt: cfg.keyInt,
      fillColor: new THREE.Color(cfg.fillColor),
      fillInt: cfg.fillInt,
      ambColor: new THREE.Color(cfg.ambColor),
      ambInt: cfg.ambInt,
      gateFireColor: new THREE.Color(cfg.gateFireColor),
      gateFireInt: cfg.gateFireInt,
      alcoveFireColor: new THREE.Color(cfg.alcoveFireColor),
      alcoveFireInt: cfg.alcoveFireInt,
      candleColor: new THREE.Color(cfg.candleColor),
      candleInt: cfg.candleInt,
      firePulseAmp: cfg.firePulseAmp,
      firePulseFreq: cfg.firePulseFreq,
      flameIntensity: cfg.flameIntensity,
      flameCoreColor: new THREE.Color(cfg.flameCoreColor),
      flameMidColor: new THREE.Color(cfg.flameMidColor),
      flameTipColor: new THREE.Color(cfg.flameTipColor),
      skyZenith: new THREE.Color(cfg.skyZenith),
      skyMid: new THREE.Color(cfg.skyMid),
      skyHorizon: new THREE.Color(cfg.skyHorizon),
      skyWarm: new THREE.Color(cfg.skyWarm),
      skyCloud: new THREE.Color(cfg.skyCloud),
      skyInfernoGlow: cfg.skyInfernoGlow,
      stainedEmissive: new THREE.Color(cfg.stainedEmissive),
      stainedInt: cfg.stainedInt,
      carpetEmissiveInt: cfg.carpetEmissiveInt,
      tapestryEmissiveInt: cfg.tapestryEmissiveInt,
      portcullisEmissiveInt: cfg.portcullisEmissiveInt,
      rearBackdropColor: new THREE.Color(cfg.rearBackdropColor),
      sparkColor: new THREE.Color(cfg.sparkColor),
      sparkSpeedMul: cfg.sparkSpeedMul,
      smokeColor: new THREE.Color(cfg.smokeColor),
      smokeOpacity: cfg.smokeOpacity,
      draftMul: cfg.draftMul,
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

  let currentMoodId = 'fire_corridor';
  let runtimeTicks = 0;
  const moodCur = makeMoodSnapshot(CORRIDOR_MOODS.fire_corridor);
  const moodFrom = makeMoodSnapshot(CORRIDOR_MOODS.fire_corridor);
  const moodTarget = makeMoodSnapshot(CORRIDOR_MOODS.fire_corridor);
  const moodTrans = { active: false, elapsed: 0, duration: 0.9 };

  function commitMoodVisuals(s) {
    hemiLight.color.copy(s.hemiSky);
    hemiLight.groundColor.copy(s.hemiGround);
    hemiLight.intensity = s.hemiInt;

    keyWindowLight.color.copy(s.keyColor);
    keyWindowLight.intensity = s.keyInt;

    coolFillLight.color.copy(s.fillColor);
    coolFillLight.intensity = s.fillInt;

    ambientLight.color.copy(s.ambColor);
    ambientLight.intensity = s.ambInt;

    for (let i = 0; i < firePointLights.length; i++) {
      const fp = firePointLights[i];
      if (fp.role === 'gate') {
        fp.light.color.copy(s.gateFireColor);
        fp.baseInt = s.gateFireInt;
      } else if (fp.role === 'alcove') {
        fp.light.color.copy(s.alcoveFireColor);
        fp.baseInt = s.alcoveFireInt;
      } else if (fp.role === 'candle') {
        fp.light.color.copy(s.candleColor);
        fp.baseInt = s.candleInt;
      } else {
        fp.light.color.copy(s.alcoveFireColor);
        fp.baseInt = s.candleInt * 0.82;
      }
      fp.light.intensity = fp.baseInt;
    }

    flameUniforms.uIntensity.value = s.flameIntensity;
    flameUniforms.uCoreColor.value.copy(s.flameCoreColor);
    flameUniforms.uMidColor.value.copy(s.flameMidColor);
    flameUniforms.uTipColor.value.copy(s.flameTipColor);

    skyUniforms.uZenithColor.value.copy(s.skyZenith);
    skyUniforms.uMidSkyColor.value.copy(s.skyMid);
    skyUniforms.uHorizonColor.value.copy(s.skyHorizon);
    skyUniforms.uSunWarmColor.value.copy(s.skyWarm);
    skyUniforms.uCloudTint.value.copy(s.skyCloud);
    skyUniforms.uInfernoGlow.value = s.skyInfernoGlow;

    matStainedGlass.emissive.copy(s.stainedEmissive);
    matStainedGlass.emissiveIntensity = s.stainedInt;

    matCarpetMain.emissiveIntensity = s.carpetEmissiveInt;
    matCarpetBranch.emissiveIntensity = s.carpetEmissiveInt * 1.12;
    matTapestryBlue.emissiveIntensity = s.tapestryEmissiveInt;
    matTapestryRed.emissiveIntensity = s.tapestryEmissiveInt;
    matPortcullisIron.emissiveIntensity = s.portcullisEmissiveInt;
    matEmberCoal.emissiveIntensity = 1.45 * s.flameIntensity;
    matRearInfernoBackdrop.color.copy(s.rearBackdropColor);
    matSpark.color.copy(s.sparkColor);

    for (let i = 0; i < smokeSprites.length; i++) {
      smokeSprites[i].material.color.copy(s.smokeColor);
    }
  }

  let biomeHandle = null;

  function applyMood(moodId, opts = {}) {
    const rawKey = typeof moodId === 'string' ? moodId.trim().toLowerCase() : '';
    const resolvedKey = CORRIDOR_MOODS[rawKey] ? rawKey : 'fire_corridor';
    const cfg = CORRIDOR_MOODS[resolvedKey];
    currentMoodId = resolvedKey;

    const targetSnap = makeMoodSnapshot(cfg);
    const immediate =
      opts.immediate === true ||
      opts.duration === 0 ||
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
      moodTrans.duration = Number.isFinite(opts.duration) && opts.duration > 0 ? opts.duration : 0.9;
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
        godRayTarget: result.atmospherePreset.godRayTarget.slice(),
        spriteRimTint: result.atmospherePreset.spriteRimTint.slice(),
      };
    }
    return result;
  }

  // =========================================================================
  // 13. REAL-TIME ANIMATION LOOP (Zero-Allocation 60fps Firelight, Flames,
  //     Scorched Tapestries, Chandeliers, Sparks & Rising Smoke)
  // =========================================================================
  const sparkDummy = new THREE.Object3D();

  function update(elapsedSec = 0, dtSec = 0.016) {
    if (disposed) return;

    const t = Number.isFinite(elapsedSec) ? elapsedSec : 0;
    const safeDt = Number.isFinite(dtSec) ? Math.min(Math.max(dtSec, 0), 0.1) : 0.016;
    if (safeDt > 0 || t > 0.02) {
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

    // 1. Shader time uniforms (flickering 3D flame tongues & blood-moon smoke sky)
    flameUniforms.uTime.value = t;
    skyUniforms.uTime.value = t;

    // 2. Dynamic Flickering Fire PointLights (multi-harmonic organic firelight dance)
    const pFreq = moodCur.firePulseFreq;
    const pAmp = moodCur.firePulseAmp;
    for (let i = 0; i < firePointLights.length; i++) {
      const fp = firePointLights[i];
      const ph = fp.phase;
      const flicker =
        (Math.sin(t * 4.8 * pFreq + ph) * 0.11 +
          Math.sin(t * 10.7 * pFreq + ph * 1.9) * 0.065 +
          Math.cos(t * 17.3 * pFreq + ph * 2.7) * 0.03) *
        pAmp;
      fp.light.intensity = Math.max(1.0, (fp.baseInt || 16.0) * (1.0 + flicker));
    }

    // 3. Soft Fire Halo Sprites breathing in sync with firelight
    for (let i = 0; i < flameHalos.length; i++) {
      const h = flameHalos[i];
      const pulse =
        (Math.sin(t * 5.2 * pFreq + h.phase) * 0.12 +
          Math.sin(t * 11.4 * pFreq + h.phase * 1.5) * 0.06) *
        pAmp;
      const sc = h.baseScale * (1.0 + pulse * 0.65) * (0.94 + 0.14 * moodCur.flameIntensity);
      h.sprite.scale.set(sc, sc * 1.08, 1);
      h.sprite.material.opacity = Math.min(0.82, h.baseOp * (1.0 + pulse * 0.55) * moodCur.flameIntensity);
    }

    // 4. Scorched Tattered Ducal Tapestries fluttering in rising hot convection drafts
    const draftMul = moodCur.draftMul;
    const gust = 0.84 + 0.24 * Math.sin(t * 1.15 * draftMul) + 0.12 * Math.sin(t * 2.65 * draftMul);
    for (let b = 0; b < animatedTapestries.length; b++) {
      const tap = animatedTapestries[b];
      const pos = tap.geometry.attributes.position;
      const rest = tap.restPos;
      const invH = 1.0 / tap.height;
      const ph = tap.phase;

      for (let i = 0; i < pos.count; i++) {
        const rx = rest[i * 3];
        const ry = rest[i * 3 + 1];
        const frac = Math.min(1, Math.max(0, -ry * invH));
        const weight = Math.pow(frac, 1.38);

        const waveZ =
          Math.sin(frac * 5.4 - t * 2.9 * draftMul + ph) * 0.145 +
          Math.sin(rx * 2.8 + frac * 3.4 - t * 2.1 * draftMul + ph * 1.3) * 0.048;
        const swayX = Math.sin(frac * 2.6 - t * 1.75 * draftMul + ph) * 0.052;

        pos.setXYZ(
          i,
          rx + swayX * weight * gust,
          ry + Math.abs(waveZ) * 0.035 * weight,
          (0.03 + waveZ) * weight * gust
        );
      }
      pos.needsUpdate = true;
      tap.geometry.computeVertexNormals();
    }

    // 5. Subtle Hanging Chandelier Heat-Draft Sway
    for (let i = 0; i < hangingChandeliers.length; i++) {
      const ch = hangingChandeliers[i];
      ch.pivot.rotation.z = Math.sin(t * 0.72 * draftMul + ch.phase) * 0.022 * draftMul;
      ch.pivot.rotation.x = Math.cos(t * 0.58 * draftMul + ch.phase) * 0.015 * draftMul;
    }

    // 6. Rising Hot Fire Sparks (InstancedMesh)
    const spMul = moodCur.sparkSpeedMul;
    for (let i = 0; i < sparkSpecs.length; i++) {
      const sp = sparkSpecs[i];
      const cycle = (t * sp.speed * spMul + sp.phase) % 1.0;
      const riseY = sp.oy + cycle * sp.maxRise;
      const ang = t * sp.swirlFreq * spMul + sp.phase * 12.5;
      const rad = sp.swirlR * (0.4 + cycle * 1.25);
      const fade = Math.sin(cycle * Math.PI);
      sparkDummy.position.set(
        sp.ox + Math.cos(ang) * rad,
        riseY,
        sp.oz + Math.sin(ang) * rad * 0.6
      );
      sparkDummy.rotation.set(t * 3.2 + sp.phase * 6.0, ang, t * 2.1);
      sparkDummy.scale.setScalar(Math.max(0.001, fade * sp.baseScale * (0.88 + 0.28 * spMul)));
      sparkDummy.updateMatrix();
      instSparks.setMatrixAt(i, sparkDummy.matrix);
    }
    instSparks.instanceMatrix.needsUpdate = true;

    // 7. Rising Thin Wispy Smoke Plumes curling up toward vaulted ceiling
    const baseSmokeOp = moodCur.smokeOpacity;
    for (let i = 0; i < smokeSpecs.length; i++) {
      const sm = smokeSpecs[i];
      const sp = smokeSprites[i];
      const cycle = (t * sm.speed * spMul + sm.phase) % 1.0;
      sp.position.set(
        sm.ox + sm.driftX * cycle + Math.sin(t * 0.8 + sm.phase * 6.28) * 0.35 * cycle,
        sm.oy + cycle * sm.maxRise,
        sm.oz + Math.cos(t * 0.65 + sm.phase * 6.28) * 0.22 * cycle
      );
      const sz = sm.baseSize * (0.65 + cycle * 1.65);
      sp.scale.set(sz, sz, 1);
      const fade = Math.sin(cycle * Math.PI);
      sp.material.opacity = baseSmokeOp * fade * (1.0 - cycle * 0.35);
    }
  }

  // =========================================================================
  // 14. COMPLETE RESOURCE DISPOSAL (Zero GPU Leaks, Preserves texLib Originals)
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
    for (const tex of ownedTextures) {
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    }

    ownedGeometries.length = 0;
    ownedMaterials.length = 0;
    ownedTextures.length = 0;
    firePointLights.length = 0;
    animatedTapestries.length = 0;
    flameHalos.length = 0;
    hangingChandeliers.length = 0;
    flameMaterials.length = 0;
    smokeSprites.length = 0;
    smokeSpecs.length = 0;
    sparkSpecs.length = 0;
    emberOrigins.length = 0;
    smokeOrigins.length = 0;
  }

  // Commit initial fire_corridor mood & prime animated pose at t = 0
  commitMoodVisuals(moodCur);
  update(0, 0);

  const defaultResult = cloneMoodResult('fire_corridor', CORRIDOR_MOODS.fire_corridor);
  biomeHandle = {
    id: 'corridor',
    name: '公爵府东翼火廊',
    subtitle: CORRIDOR_MOODS.fire_corridor.subtitle,
    currentMood: currentMoodId,
    supportedMoods: Object.keys(CORRIDOR_MOODS),
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
