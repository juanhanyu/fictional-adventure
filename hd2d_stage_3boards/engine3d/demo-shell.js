/**
 * demo-shell.js
 * Shared HD-2D 3D Stage Orchestrator Bridge for 《转生千金》 Demo A / B / C
 *
 * Pure browser ES Module — zero external network requests, strict same-origin imports.
 * Connects PBR textures, 3 switchable 3D biomes, HD-2D post-processing (Bloom + Tilt-Shift
 * + volumetric god-rays + 3D GPU particles), 22 real pixel-skeleton sprites, interactive
 * raycast picking, 4 live 3D skill showcases, and ResizeObserver adaptive rendering.
 */

import * as THREE from '../vendor/three/three.module.min.js';
import { createPBRTextureLibrary } from './textures-pbr.js';
import { buildAcademyBiome } from './biome-academy.js';
import { buildForestBiome } from './biome-forest.js';
import { buildAltarBiome } from './biome-altar.js';
import { createHD2DPostPipeline } from './atmosphere-post.js';
import { createSpriteStage3D } from './sprite-stage-3d.js';

// ============================================================================
// 1. Exported Data Contracts (BIOME_LIST / FORMATIONS / DEMO_SKILLS)
// ============================================================================

const BIOME_BUILDERS = Object.freeze({
  academy: buildAcademyBiome,
  forest: buildForestBiome,
  altar: buildAltarBiome,
});

export const BIOME_LIST = [
  Object.freeze({
    id: 'academy',
    name: '圣阿斯拉雪庭演武场',
    shortName: '雪庭演武场',
    subtitle: '雪霁晴空 · 皇家哥特回廊',
    accent: '#1658eb',
    badge: '雪庭晴空',
  }),
  Object.freeze({
    id: 'forest',
    name: '极北冰晶古林',
    shortName: '极北冰晶古林',
    subtitle: '林隙晨光 · 冰晶冻溪',
    accent: '#22a7d9',
    badge: '冰晶冻溪',
  }),
  Object.freeze({
    id: 'altar',
    name: '云巅风神祭坛',
    shortName: '云巅风神祭坛',
    subtitle: '浮空云海 · 星霜神殿',
    accent: '#d69e2e',
    badge: '浮空云海',
  }),
];

// Attach non-enumerable key accessors so both array iteration and keyed lookup work seamlessly
for (const b of BIOME_LIST) {
  Object.defineProperty(BIOME_LIST, b.id, {
    value: b,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

function makeActor(spec) {
  return Object.freeze({
    id: spec.id,
    spriteId: spec.spriteId,
    side: spec.side,
    name: spec.name,
    role: spec.role,
    tier: spec.tier,
    hp: spec.hp,
    maxHp: spec.maxHp,
    mp: spec.mp,
    maxMp: spec.maxMp,
    shield: spec.shield,
    maxShield: spec.maxShield,
    intent: spec.intent,
    intentType: spec.intentType,
    isBoss: Boolean(spec.isBoss),
  });
}

export const FORMATIONS = Object.freeze({
  '1v1': Object.freeze({
    key: '1v1',
    id: '1v1',
    label: '1v1 切磋',
    name: '1v1 切磋',
    shortLabel: '1v1',
    desc: '银发希尔维亚 × 贝阿特丽丝',
    allies: Object.freeze([
      makeActor({
        id: 'sylvia_silver',
        spriteId: 'sylvia_silver',
        side: 'ally',
        name: '希尔维亚',
        role: '星霜魔导',
        tier: '五阶',
        hp: 360,
        maxHp: 360,
        mp: 180,
        maxMp: 180,
        shield: 60,
        maxShield: 60,
        intent: '星霜待发',
        intentType: 'atk',
        isBoss: false,
      }),
    ]),
    enemies: Object.freeze([
      makeActor({
        id: 'beatrice',
        spriteId: 'beatrice',
        side: 'enemy',
        name: '贝阿特丽丝',
        role: '公爵长女',
        tier: '二阶',
        hp: 260,
        maxHp: 260,
        mp: 110,
        maxMp: 110,
        shield: 36,
        maxShield: 36,
        intent: '疾风斩击',
        intentType: 'atk',
        isBoss: false,
      }),
    ]),
  }),

  '2v1': Object.freeze({
    key: '2v1',
    id: '2v1',
    label: '2v1 罗文战',
    name: '2v1 罗文战',
    shortLabel: '2v1',
    desc: '幼年希尔维亚 · 雷纳德 × 血族罗文',
    allies: Object.freeze([
      makeActor({
        id: 'sylvia_young',
        spriteId: 'sylvia_young',
        side: 'ally',
        name: '希尔维亚',
        role: '冰晶学徒',
        tier: '二阶',
        hp: 220,
        maxHp: 220,
        mp: 130,
        maxMp: 130,
        shield: 32,
        maxShield: 32,
        intent: '冰晶凝聚',
        intentType: 'atk',
        isBoss: false,
      }),
      makeActor({
        id: 'reno',
        spriteId: 'reno',
        side: 'ally',
        name: '雷纳德',
        role: '三系魔导',
        tier: '四阶',
        hp: 320,
        maxHp: 320,
        mp: 150,
        maxMp: 150,
        shield: 48,
        maxShield: 48,
        intent: '岩障援护',
        intentType: 'buff',
        isBoss: false,
      }),
    ]),
    enemies: Object.freeze([
      makeActor({
        id: 'rowan',
        spriteId: 'rowan',
        side: 'enemy',
        name: '罗文',
        role: '血族侍卫',
        tier: '圣级',
        hp: 520,
        maxHp: 520,
        mp: 180,
        maxMp: 180,
        shield: 90,
        maxShield: 90,
        intent: '猩红突袭',
        intentType: 'heavy',
        isBoss: false,
      }),
    ]),
  }),

  '1v4': Object.freeze({
    key: '1v4',
    id: '1v4',
    label: '1v4 霜狼围猎',
    name: '1v4 霜狼围猎',
    shortLabel: '1v4',
    desc: '眷寒渔 × 灰棘狼群围猎',
    allies: Object.freeze([
      makeActor({
        id: 'sylvia_disguise',
        spriteId: 'sylvia_disguise',
        side: 'ally',
        name: '眷寒渔',
        role: '北境游侠',
        tier: '三阶',
        hp: 280,
        maxHp: 280,
        mp: 155,
        maxMp: 155,
        shield: 44,
        maxShield: 44,
        intent: '霜域戒备',
        intentType: 'buff',
        isBoss: false,
      }),
    ]),
    enemies: Object.freeze([
      makeActor({
        id: 'wolf_alpha',
        spriteId: 'wolf_alpha',
        side: 'enemy',
        name: '灰棘头狼',
        role: '狼群首领',
        tier: '二阶',
        hp: 215,
        maxHp: 215,
        mp: 70,
        maxMp: 70,
        shield: 28,
        maxShield: 28,
        intent: '群嚎蓄势',
        intentType: 'buff',
        isBoss: false,
      }),
      makeActor({
        id: 'pack_wolf_1',
        spriteId: 'pack_wolf',
        side: 'enemy',
        name: '灰棘狼·甲',
        role: '迅捷群狼',
        tier: '一阶',
        hp: 145,
        maxHp: 145,
        mp: 40,
        maxMp: 40,
        shield: 0,
        maxShield: 20,
        intent: '利爪扑击',
        intentType: 'atk',
        isBoss: false,
      }),
      makeActor({
        id: 'pack_wolf_2',
        spriteId: 'pack_wolf',
        side: 'enemy',
        name: '灰棘狼·乙',
        role: '迅捷群狼',
        tier: '一阶',
        hp: 145,
        maxHp: 145,
        mp: 40,
        maxMp: 40,
        shield: 0,
        maxShield: 20,
        intent: '侧翼撕咬',
        intentType: 'atk',
        isBoss: false,
      }),
      makeActor({
        id: 'pack_wolf_3',
        spriteId: 'pack_wolf',
        side: 'enemy',
        name: '灰棘狼·丙',
        role: '迅捷群狼',
        tier: '一阶',
        hp: 145,
        maxHp: 145,
        mp: 40,
        maxMp: 40,
        shield: 0,
        maxShield: 20,
        intent: '合围连袭',
        intentType: 'atk',
        isBoss: false,
      }),
    ]),
  }),

  '6v6': Object.freeze({
    key: '6v6',
    id: '6v6',
    label: '6v6 满编决战',
    name: '6v6 满编决战',
    shortLabel: '6v6',
    desc: '星霜全明星六人阵 × 东翼王牌混编军团',
    allies: Object.freeze([
      makeActor({
        id: 'sylvia_silver',
        spriteId: 'sylvia_silver',
        side: 'ally',
        name: '希尔维亚',
        role: '星霜魔导',
        tier: '五阶',
        hp: 360,
        maxHp: 360,
        mp: 180,
        maxMp: 180,
        shield: 60,
        maxShield: 60,
        intent: '三棱冰晶',
        intentType: 'atk',
        isBoss: false,
      }),
      makeActor({
        id: 'reno',
        spriteId: 'reno',
        side: 'ally',
        name: '雷纳德',
        role: '三系魔导',
        tier: '四阶',
        hp: 330,
        maxHp: 330,
        mp: 150,
        maxMp: 150,
        shield: 50,
        maxShield: 50,
        intent: '风岩连携',
        intentType: 'buff',
        isBoss: false,
      }),
      makeActor({
        id: 'charlotte',
        spriteId: 'charlotte',
        side: 'ally',
        name: '夏洛特',
        role: '焰纹魔导',
        tier: '四阶',
        hp: 295,
        maxHp: 295,
        mp: 160,
        maxMp: 160,
        shield: 40,
        maxShield: 40,
        intent: '红莲齐射',
        intentType: 'atk',
        isBoss: false,
      }),
      makeActor({
        id: 'alice',
        spriteId: 'alice',
        side: 'ally',
        name: '爱丽丝',
        role: '疾风剑舞',
        tier: '三阶',
        hp: 270,
        maxHp: 270,
        mp: 115,
        maxMp: 115,
        shield: 30,
        maxShield: 30,
        intent: '轻风连刺',
        intentType: 'atk',
        isBoss: false,
      }),
      makeActor({
        id: 'jilan',
        spriteId: 'jilan',
        side: 'ally',
        name: '霁岚',
        role: '霁馆剑修',
        tier: '四阶',
        hp: 315,
        maxHp: 315,
        mp: 120,
        maxMp: 120,
        shield: 45,
        maxShield: 45,
        intent: '澄明居合',
        intentType: 'heavy',
        isBoss: false,
      }),
      makeActor({
        id: 'aino',
        spriteId: 'aino',
        side: 'ally',
        name: '艾诺',
        role: '极北冰盾',
        tier: '四阶',
        hp: 350,
        maxHp: 350,
        mp: 135,
        maxMp: 135,
        shield: 75,
        maxShield: 75,
        intent: '生根冰壁',
        intentType: 'buff',
        isBoss: false,
      }),
    ]),
    enemies: Object.freeze([
      makeActor({
        id: 'eastwing_commander',
        spriteId: 'eastwing_commander',
        side: 'enemy',
        name: '东翼封锁官',
        role: '红莲铁幕',
        tier: '五阶',
        hp: 440,
        maxHp: 440,
        mp: 150,
        maxMp: 150,
        shield: 95,
        maxShield: 95,
        intent: '红莲重斩',
        intentType: 'heavy',
        isBoss: false,
      }),
      makeActor({
        id: 'corridor_vanguard',
        spriteId: 'corridor_vanguard',
        side: 'enemy',
        name: '宫廷突击队长',
        role: '重甲先锋',
        tier: '四阶',
        hp: 320,
        maxHp: 320,
        mp: 85,
        maxMp: 85,
        shield: 68,
        maxShield: 68,
        intent: '铁壁冲撞',
        intentType: 'atk',
        isBoss: false,
      }),
      makeActor({
        id: 'flame_mage',
        spriteId: 'flame_mage',
        side: 'enemy',
        name: '赤炎术士',
        role: '火系咏唱',
        tier: '四阶',
        hp: 265,
        maxHp: 265,
        mp: 170,
        maxMp: 170,
        shield: 42,
        maxShield: 42,
        intent: '炽炎聚能',
        intentType: 'heavy',
        isBoss: false,
      }),
      makeActor({
        id: 'abyss_behemoth',
        spriteId: 'abyss_behemoth',
        side: 'enemy',
        name: '霜渊裂地兽',
        role: '极北领主',
        tier: '四阶',
        hp: 480,
        maxHp: 480,
        mp: 100,
        maxMp: 100,
        shield: 85,
        maxShield: 85,
        intent: '裂地猛踏',
        intentType: 'heavy',
        isBoss: false,
      }),
      makeActor({
        id: 'wolf_alpha',
        spriteId: 'wolf_alpha',
        side: 'enemy',
        name: '灰棘头狼',
        role: '狼群首领',
        tier: '二阶',
        hp: 215,
        maxHp: 215,
        mp: 70,
        maxMp: 70,
        shield: 28,
        maxShield: 28,
        intent: '凛风嚎叫',
        intentType: 'buff',
        isBoss: false,
      }),
      makeActor({
        id: 'pack_wolf',
        spriteId: 'pack_wolf',
        side: 'enemy',
        name: '灰棘魔狼',
        role: '迅捷群狼',
        tier: '一阶',
        hp: 150,
        maxHp: 150,
        mp: 40,
        maxMp: 40,
        shield: 0,
        maxShield: 20,
        intent: '侧翼突咬',
        intentType: 'atk',
        isBoss: false,
      }),
    ]),
  }),

  boss1v1: Object.freeze({
    key: 'boss1v1',
    id: 'boss1v1',
    label: 'Boss 终战',
    name: 'Boss 终战',
    shortLabel: 'Boss',
    desc: '希尔维亚 × 风神·岚「风暴眼试剑」',
    allies: Object.freeze([
      makeActor({
        id: 'sylvia_silver',
        spriteId: 'sylvia_silver',
        side: 'ally',
        name: '希尔维亚',
        role: '星霜魔导',
        tier: '五阶',
        hp: 420,
        maxHp: 420,
        mp: 220,
        maxMp: 220,
        shield: 80,
        maxShield: 80,
        intent: '星霜破风',
        intentType: 'atk',
        isBoss: false,
      }),
    ]),
    enemies: Object.freeze([
      makeActor({
        id: 'wind_god_avatar',
        spriteId: 'wind_god_avatar',
        side: 'enemy',
        name: '风神·岚',
        role: '风暴眼试剑',
        tier: '神级',
        hp: 980,
        maxHp: 980,
        mp: 320,
        maxMp: 320,
        shield: 180,
        maxShield: 180,
        intent: '岚涡降临',
        intentType: 'heavy',
        isBoss: true,
      }),
    ]),
  }),
});

export const DEMO_SKILLS = [
  Object.freeze({
    id: 'ice_2_prism',
    name: '三棱冰晶',
    mp: 18,
    type: 'ice',
    tag: '冰系 · 3拍',
    isGuard: false,
    aoe: false,
    basePower: 112,
    desc: '凝聚三道棱镜冰枪凌空齐射，高穿透单体爆发。',
  }),
  Object.freeze({
    id: 'water_1_ball',
    name: '苍水弹',
    mp: 10,
    type: 'water',
    tag: '水系 · 1拍',
    isGuard: false,
    aoe: false,
    basePower: 78,
    desc: '低耗灵动水球疾驰破防，炸裂星辉水涡。',
  }),
  Object.freeze({
    id: 'frost_3_thorns',
    name: '星霜贯阵',
    mp: 28,
    type: 'starfrost',
    tag: '群攻 · 全体',
    isGuard: false,
    aoe: true,
    basePower: 96,
    desc: '降下星霜光柱贯通敌阵全体，伴随冰晶尖塔涌升。',
  }),
  Object.freeze({
    id: 'shield_2_mirror',
    name: '冰镜守御',
    mp: 16,
    type: 'shield',
    tag: '守御 · 瞬发',
    isGuard: true,
    aoe: false,
    basePower: 52,
    desc: '瞬发构筑六棱冰镜晶穹与双轨魔环，大幅补强护盾。',
  }),
];

for (const sk of DEMO_SKILLS) {
  Object.defineProperty(DEMO_SKILLS, sk.id, {
    value: sk,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

// ============================================================================
// 2. Internal Utilities & Default Formation Layout
// ============================================================================

const SHIELD_AMP_MULT = [1.0, 1.25, 1.5, 1.5];

const DEFAULT_CAMERA_CONFIG = Object.freeze({
  position: [0, 3.85, 13.8],
  lookAt: [0, 1.35, 0],
  fov: 32,
  damping: 5.2,
  parallaxX: 0.42,
  parallaxY: 0.16,
  breatheAmp: 0.05,
});

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function cloneActorState(a) {
  return {
    id: a.id,
    spriteId: a.spriteId,
    side: a.side,
    name: a.name,
    role: a.role,
    tier: a.tier,
    hp: a.hp,
    maxHp: a.maxHp,
    mp: a.mp,
    maxMp: a.maxMp,
    shield: a.shield,
    maxShield: a.maxShield,
    intent: a.intent,
    intentType: a.intentType,
    isBoss: Boolean(a.isBoss),
    pos: Array.isArray(a.pos) ? a.pos.slice() : [0, 0, 0],
    heightWorld: a.heightWorld,
  };
}

function defaultHeightForSprite(actor, formationKey) {
  if (actor.isBoss || actor.spriteId === 'wind_god_avatar') return 3.65;
  if (actor.spriteId === 'abyss_behemoth') return formationKey === '6v6' ? 2.82 : 3.05;
  if (actor.spriteId === 'rowan') return 2.92;
  if (actor.spriteId === 'eastwing_commander') return 2.62;
  if (actor.spriteId === 'wolf_alpha') return formationKey === '6v6' ? 2.22 : 2.34;
  if (actor.spriteId === 'pack_wolf') return 2.02;
  if (actor.spriteId === 'reno') return formationKey === '6v6' ? 2.52 : 2.72;
  if (actor.spriteId === 'alice' || actor.spriteId === 'sylvia_young') {
    return formationKey === '6v6' ? 2.30 : 2.48;
  }
  return formationKey === '6v6' ? 2.44 : 2.68;
}

function defaultFormationLayout(formationKey, baseAllies, baseEnemies) {
  const specs = [];

  if (formationKey === '1v1') {
    baseAllies.forEach((a, i) => {
      specs.push({
        ...a,
        pos: [-2.85 - i * 1.4, 0, 0.15],
        heightWorld: defaultHeightForSprite(a, formationKey),
      });
    });
    baseEnemies.forEach((e, i) => {
      specs.push({
        ...e,
        pos: [2.85 + i * 1.4, 0, 0.15],
        heightWorld: defaultHeightForSprite(e, formationKey),
      });
    });
    return specs;
  }

  if (formationKey === '2v1') {
    const allySlots = [
      [-2.55, 0, 0.95],
      [-4.15, 0, -0.75],
    ];
    baseAllies.forEach((a, i) => {
      specs.push({
        ...a,
        pos: allySlots[i] || [-2.6 - i * 1.4, 0, (i - 0.5) * 1.2],
        heightWorld: defaultHeightForSprite(a, formationKey),
      });
    });
    baseEnemies.forEach((e, i) => {
      specs.push({
        ...e,
        pos: [3.1 + i * 1.4, 0, 0.1],
        heightWorld: defaultHeightForSprite(e, formationKey),
      });
    });
    return specs;
  }

  if (formationKey === '1v4') {
    baseAllies.forEach((a, i) => {
      specs.push({
        ...a,
        pos: [-3.35 - i * 1.3, 0, 0.2],
        heightWorld: defaultHeightForSprite(a, formationKey),
      });
    });
    const enemySlots = [
      [2.25, 0, 0.1],
      [3.35, 0, 1.85],
      [4.15, 0, -1.15],
      [5.15, 0, 0.85],
    ];
    baseEnemies.forEach((e, i) => {
      specs.push({
        ...e,
        pos: enemySlots[i] || [2.4 + i * 1.1, 0, ((i % 3) - 1) * 1.4],
        heightWorld: defaultHeightForSprite(e, formationKey),
      });
    });
    return specs;
  }

  if (formationKey === 'boss1v1') {
    baseAllies.forEach((a, i) => {
      specs.push({
        ...a,
        pos: [-3.5 - i * 1.3, 0, 0.35],
        heightWorld: defaultHeightForSprite(a, formationKey),
      });
    });
    baseEnemies.forEach((e, i) => {
      specs.push({
        ...e,
        pos: [3.15 + i * 1.6, 0, -0.35],
        heightWorld: defaultHeightForSprite(e, formationKey),
      });
    });
    return specs;
  }

  // Default & 6v6 staggered double-column HD-2D formation
  const allySlots6 = [
    [-2.25, 0, 2.1],
    [-2.6, 0, 0.05],
    [-3.0, 0, -2.0],
    [-4.45, 0, 1.45],
    [-4.85, 0, -0.7],
    [-5.25, 0, -2.7],
  ];
  const enemySlots6 = [
    [2.25, 0, 2.0],
    [2.6, 0, -0.05],
    [3.0, 0, -2.1],
    [4.45, 0, 1.35],
    [4.85, 0, -0.8],
    [5.25, 0, -2.7],
  ];

  baseAllies.forEach((a, i) => {
    specs.push({
      ...a,
      pos: allySlots6[i] || [-2.4 - (i % 3) * 1.3, 0, (Math.floor(i / 3) - 0.5) * 1.8],
      heightWorld: defaultHeightForSprite(a, formationKey),
    });
  });
  baseEnemies.forEach((e, i) => {
    specs.push({
      ...e,
      pos: enemySlots6[i] || [2.4 + (i % 3) * 1.3, 0, (Math.floor(i / 3) - 0.5) * 1.8],
      heightWorld: defaultHeightForSprite(e, formationKey),
    });
  });

  return specs;
}

function resolveCameraConfigInput(cameraConfig, formationKey, biomeId) {
  if (!cameraConfig) return { ...DEFAULT_CAMERA_CONFIG };
  if (typeof cameraConfig === 'function') {
    const out = cameraConfig(formationKey, biomeId);
    return out && typeof out === 'object' ? { ...DEFAULT_CAMERA_CONFIG, ...out } : { ...DEFAULT_CAMERA_CONFIG };
  }
  if (typeof cameraConfig === 'object') {
    // Support either flat config { position, lookAt, fov } or per-formation map { '6v6': {...}, default: {...} }
    if (cameraConfig[formationKey] && typeof cameraConfig[formationKey] === 'object') {
      return { ...DEFAULT_CAMERA_CONFIG, ...(cameraConfig.default || {}), ...cameraConfig[formationKey] };
    }
    if (cameraConfig.default && typeof cameraConfig.default === 'object' && !cameraConfig.position && !cameraConfig.pos) {
      return { ...DEFAULT_CAMERA_CONFIG, ...cameraConfig.default };
    }
    return { ...DEFAULT_CAMERA_CONFIG, ...cameraConfig };
  }
  return { ...DEFAULT_CAMERA_CONFIG };
}

function normalizeAmp(ampLevel) {
  const n = Number(ampLevel);
  if (!Number.isFinite(n) || n <= 0) return { ampTier: 0, ampPct: 0 };
  if (n > 3) {
    const pct = clamp(Math.round(n / 20) * 20, 0, 60);
    return { ampTier: Math.round(pct / 20), ampPct: pct };
  }
  const tier = clamp(Math.round(n), 0, 3);
  return { ampTier: tier, ampPct: tier * 20 };
}

function resolveSkill(skillId) {
  if (!skillId) return DEMO_SKILLS[0];
  const key = String(skillId);
  return (
    DEMO_SKILLS.find((s) => s.id === key) ||
    DEMO_SKILLS.find((s) => s.type === key) ||
    DEMO_SKILLS[0]
  );
}

const SOFTWARE_RENDERER_RE = /SwiftShader|llvmpipe|Software|Basic Render|Mesa OffScreen/i;
const SOFTWARE_IDLE_GAP_MS = 220;
const SOFTWARE_PIXEL_RATIO = 0.75;
const SOFTWARE_MAX_DT_SEC = 0.32;

function detectSoftwareRenderer() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if ((params.get('perf') || '').toLowerCase() === 'low') {
        return { isSoftware: true, rendererName: 'url:?perf=low' };
      }
    }
  } catch (err) {
    console.error('[HD2D DemoShell]', err);
  }

  let rendererName = '';
  let gl = null;
  try {
    if (typeof document !== 'undefined') {
      const probeCanvas = document.createElement('canvas');
      probeCanvas.width = 1;
      probeCanvas.height = 1;
      const probeAttrs = {
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      };
      gl =
        probeCanvas.getContext('webgl2', probeAttrs) ||
        probeCanvas.getContext('webgl', probeAttrs) ||
        probeCanvas.getContext('experimental-webgl', probeAttrs);
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo && debugInfo.UNMASKED_RENDERER_WEBGL) {
          const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (unmasked) rendererName = String(unmasked);
        }
        if (!rendererName) {
          const fallback = gl.getParameter(gl.RENDERER);
          if (fallback) rendererName = String(fallback);
        }
      }
    }
  } catch (err) {
    console.error('[HD2D DemoShell]', err);
  } finally {
    if (gl) {
      try {
        const loseExt = gl.getExtension('WEBGL_lose_context');
        if (loseExt && typeof loseExt.loseContext === 'function') {
          loseExt.loseContext();
        }
      } catch (_) {
        /* ignore cleanup error */
      }
    }
  }

  return {
    isSoftware: SOFTWARE_RENDERER_RE.test(rendererName),
    rendererName: rendererName || 'unknown',
  };
}

// ============================================================================
// 3. Main Shared 3D Stage Mount Function
// ============================================================================

export function mountHD2DDemoEngine({
  canvas,
  initialBiome = 'academy',
  initialFormation = '6v6',
  cameraConfig,
  formationLayoutFn,
  onActorsUpdated,
  onFrame,
  onActorClick,
  onImpact,
} = {}) {
  const canvasEl =
    typeof canvas === 'string' && typeof document !== 'undefined'
      ? document.querySelector(canvas)
      : canvas;

  if (!canvasEl) {
    throw new Error('[demo-shell] mountHD2DDemoEngine requires a valid <canvas> element.');
  }

  function measureCanvasCssSize() {
    const parent = canvasEl.parentElement;
    const rawW =
      canvasEl.clientWidth ||
      (parent && parent.clientWidth) ||
      (typeof window !== 'undefined' ? window.innerWidth : 1440) ||
      1440;
    const rawH =
      canvasEl.clientHeight ||
      (parent && parent.clientHeight) ||
      (typeof window !== 'undefined' ? window.innerHeight : 900) ||
      900;
    return {
      width: Math.max(64, Math.round(rawW)),
      height: Math.max(64, Math.round(rawH)),
    };
  }

  let { width: viewportW, height: viewportH } = measureCanvasCssSize();

  // 1. Pre-detect software WebGL before creating WebGLRenderer so MSAA can be skipped on SwiftShader.
  //    Hardware GPU: full antialias + ACESFilmic + PCFSoftShadowMap + 2048px shadows + sRGB + DPR<=2;
  //    Software WebGL / ?perf=low: antialias=false + DPR=0.75 + shadowMap=false + direct render + 220ms idle gap
  const { isSoftware: isSoftwareRenderer, rendererName: rendererInfo } =
    detectSoftwareRenderer();

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: !isSoftwareRenderer,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });

  let currentDpr = isSoftwareRenderer
    ? SOFTWARE_PIXEL_RATIO
    : Math.min(
        typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
        2
      );

  renderer.shadowMap.enabled = !isSoftwareRenderer;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(currentDpr);
  renderer.setSize(viewportW, viewportH, false);

  // 2. Scene, Camera, Texture Library, Post-Processing, Sprite Stage
  const scene = new THREE.Scene();

  const initCamCfg = resolveCameraConfigInput(cameraConfig, initialFormation, initialBiome);
  const camera = new THREE.PerspectiveCamera(
    Number.isFinite(initCamCfg.fov) ? initCamCfg.fov : 32,
    viewportW / viewportH,
    0.1,
    180
  );
  if (Array.isArray(initCamCfg.position) && initCamCfg.position.length >= 3) {
    camera.position.set(initCamCfg.position[0], initCamCfg.position[1], initCamCfg.position[2]);
  }
  if (Array.isArray(initCamCfg.lookAt) && initCamCfg.lookAt.length >= 3) {
    camera.lookAt(initCamCfg.lookAt[0], initCamCfg.lookAt[1], initCamCfg.lookAt[2]);
  }
  camera.updateMatrixWorld(true);

  const texLib = createPBRTextureLibrary(THREE);
  const postPipeline = createHD2DPostPipeline(THREE, renderer, scene, camera, texLib, {
    qualityMode: isSoftwareRenderer ? 'software' : 'ultra',
  });
  const spriteStage = createSpriteStage3D(THREE, scene, camera, texLib);
  spriteStage.setCameraConfig({ ...initCamCfg, immediate: true });

  // 3. Runtime State
  let disposed = false;
  let currentBiome = null;
  let currentBiomeId = null;
  let currentFormationKey = null;
  let formationGeneration = 0;

  let actorsList = [];
  const actorsById = new Map();
  let activeAllyId = null;
  let selectedEnemyId = null;
  let tiltShiftEnabled = true;
  let dimNonFocusEnabled = false;
  let lastDimFocusIds = undefined;

  const respawnTimers = new Map();
  let rafId = 0;
  let startTimeMs = 0;
  let lastFrameMs = 0;
  let lastRenderEndMs = 0;
  let pendingImmediateRender = false;
  let fpsFrames = 0;
  let fpsLastSampleMs = 0;
  let currentFps = 60;
  let lastHoverCheckMs = 0;

  function scheduleImmediateRedraw() {
    if (!disposed) {
      pendingImmediateRender = true;
    }
  }

  function clearRespawnTimers() {
    respawnTimers.forEach((tid) => clearTimeout(tid));
    respawnTimers.clear();
  }

  function getActorsSnapshot() {
    return actorsList.map(cloneActorState);
  }

  function notifyActorsUpdated() {
    if (disposed || typeof onActorsUpdated !== 'function') return;
    try {
      onActorsUpdated(getActorsSnapshot(), {
        activeAllyId,
        selectedEnemyId,
        formationKey: currentFormationKey,
        biomeId: currentBiomeId,
      });
    } catch (err) {
      console.error('[HD2D DemoShell]', err);
    }
  }

  // 4. Seamless Biome Switching
  function setBiome(id) {
    if (disposed) return currentBiomeId;
    const biomeId = BIOME_BUILDERS[id] ? id : 'academy';
    if (currentBiome && currentBiomeId === biomeId) {
      return currentBiomeId;
    }

    if (currentBiome) {
      if (currentBiome.group && currentBiome.group.parent === scene) {
        scene.remove(currentBiome.group);
      }
      try {
        if (typeof currentBiome.dispose === 'function') currentBiome.dispose();
      } catch (err) {
        console.error('[HD2D DemoShell]', err);
      }
      currentBiome = null;
    }

    const nextBiome = BIOME_BUILDERS[biomeId](THREE, texLib);
    currentBiome = nextBiome;
    currentBiomeId = biomeId;

    if (nextBiome.group) {
      if (isSoftwareRenderer && typeof nextBiome.group.traverse === 'function') {
        nextBiome.group.traverse((obj) => {
          if (obj && obj.isLight && obj.castShadow) {
            obj.castShadow = false;
          }
        });
      }
      scene.add(nextBiome.group);
    }

    if (nextBiome.background !== undefined && nextBiome.background !== null) {
      scene.background = new THREE.Color(nextBiome.background);
    }

    if (nextBiome.fog && typeof nextBiome.fog === 'object') {
      scene.fog = new THREE.Fog(
        nextBiome.fog.color,
        Number.isFinite(nextBiome.fog.near) ? nextBiome.fog.near : 18,
        Number.isFinite(nextBiome.fog.far) ? nextBiome.fog.far : 54
      );
    } else {
      scene.fog = null;
    }

    if (nextBiome.atmospherePreset) {
      postPipeline.applyPreset(nextBiome.atmospherePreset);
      postPipeline.setTiltShiftEnabled(tiltShiftEnabled);
      if (nextBiome.atmospherePreset.spriteRimTint) {
        spriteStage.setRimTint(nextBiome.atmospherePreset.spriteRimTint);
      }
    }

    if (typeof cameraConfig === 'function' && currentFormationKey) {
      const nextCam = resolveCameraConfigInput(cameraConfig, currentFormationKey, currentBiomeId);
      spriteStage.setCameraConfig(nextCam);
    }

    scheduleImmediateRedraw();
    return currentBiomeId;
  }

  // 5. Formation Switching
  function setFormation(key, options = {}) {
    if (disposed) return currentFormationKey;
    const formationKey = FORMATIONS[key] ? key : '6v6';
    const preset = FORMATIONS[formationKey];

    clearRespawnTimers();
    formationGeneration += 1;
    currentFormationKey = formationKey;

    const baseAllies = preset.allies.map((a) => ({ ...a }));
    const baseEnemies = preset.enemies.map((e) => ({ ...e }));
    const baseById = new Map();
    baseAllies.forEach((a) => baseById.set(a.id, a));
    baseEnemies.forEach((e) => baseById.set(e.id, e));

    const layoutRunner =
      typeof formationLayoutFn === 'function' ? formationLayoutFn : defaultFormationLayout;

    let rawLayout = null;
    try {
      rawLayout = layoutRunner(formationKey, baseAllies, baseEnemies);
    } catch (err) {
      console.error('[HD2D DemoShell]', err);
      rawLayout = defaultFormationLayout(formationKey, baseAllies, baseEnemies);
    }

    let rawSpecs = [];
    let layoutCamOverride = null;
    if (Array.isArray(rawLayout)) {
      rawSpecs = rawLayout;
    } else if (rawLayout && typeof rawLayout === 'object') {
      if (Array.isArray(rawLayout.specs)) {
        rawSpecs = rawLayout.specs;
      } else {
        rawSpecs = [
          ...(Array.isArray(rawLayout.allies) ? rawLayout.allies : []),
          ...(Array.isArray(rawLayout.enemies) ? rawLayout.enemies : []),
        ];
      }
      if (rawLayout.cameraConfig && typeof rawLayout.cameraConfig === 'object') {
        layoutCamOverride = rawLayout.cameraConfig;
      }
    }

    if (!rawSpecs.length) {
      rawSpecs = defaultFormationLayout(formationKey, baseAllies, baseEnemies);
    }

    // Merge layout positions/heights with full combat stats so no field is ever lost
    actorsList = [];
    actorsById.clear();

    const stageSpecs = rawSpecs.map((item, idx) => {
      const base = baseById.get(item.id) || {};
      const side = item.side || base.side || 'ally';
      const id = String(item.id ?? base.id ?? `actor_${idx}`);
      const spriteId = String(item.spriteId ?? base.spriteId ?? 'sylvia_silver');
      const pos = Array.isArray(item.pos)
        ? item.pos.slice(0, 3)
        : Array.isArray(item.position)
          ? item.position.slice(0, 3)
          : [side === 'ally' ? -3 : 3, 0, 0];
      const heightWorld =
        Number(item.heightWorld ?? item.height) > 0
          ? Number(item.heightWorld ?? item.height)
          : defaultHeightForSprite({ ...base, ...item, spriteId }, formationKey);

      const merged = {
        id,
        spriteId,
        side,
        name: item.name ?? base.name ?? id,
        role: item.role ?? base.role ?? (side === 'ally' ? '友方' : '敌方'),
        tier: item.tier ?? base.tier ?? '三阶',
        hp: Number.isFinite(item.hp) ? item.hp : Number.isFinite(base.hp) ? base.hp : 240,
        maxHp: Number.isFinite(item.maxHp) ? item.maxHp : Number.isFinite(base.maxHp) ? base.maxHp : 240,
        mp: Number.isFinite(item.mp) ? item.mp : Number.isFinite(base.mp) ? base.mp : 120,
        maxMp: Number.isFinite(item.maxMp) ? item.maxMp : Number.isFinite(base.maxMp) ? base.maxMp : 120,
        shield: Number.isFinite(item.shield) ? item.shield : Number.isFinite(base.shield) ? base.shield : 0,
        maxShield: Number.isFinite(item.maxShield)
          ? item.maxShield
          : Number.isFinite(base.maxShield)
            ? base.maxShield
            : 20,
        initialShield: Number.isFinite(item.shield)
          ? item.shield
          : Number.isFinite(base.shield)
            ? base.shield
            : 0,
        intent: item.intent ?? base.intent ?? '警戒',
        intentType: item.intentType ?? base.intentType ?? 'atk',
        isBoss: Boolean(item.isBoss ?? base.isBoss),
        pos,
        heightWorld,
      };

      actorsList.push(merged);
      actorsById.set(id, merged);

      return {
        ...item,
        id,
        spriteId,
        side,
        name: merged.name,
        pos,
        heightWorld,
      };
    });

    spriteStage.setFormation(stageSpecs);

    const firstAlly = actorsList.find((a) => a.side === 'ally') || null;
    const firstEnemy = actorsList.find((a) => a.side === 'enemy') || null;
    activeAllyId = firstAlly ? firstAlly.id : null;
    selectedEnemyId = firstEnemy ? firstEnemy.id : null;

    spriteStage.setActiveActor(activeAllyId);
    spriteStage.setSelectedEnemy(selectedEnemyId);

    if (layoutCamOverride) {
      spriteStage.setCameraConfig(layoutCamOverride);
    } else if (cameraConfig) {
      const nextCam = resolveCameraConfigInput(cameraConfig, formationKey, currentBiomeId);
      spriteStage.setCameraConfig(nextCam);
    }

    if (dimNonFocusEnabled) {
      spriteStage.setDimNonFocus(true, lastDimFocusIds);
    }

    if (!options.deferNotify) {
      notifyActorsUpdated();
    } else {
      queueMicrotask(() => {
        if (!disposed) {
          notifyActorsUpdated();
          emitOnFrame(0, 1 / 60);
        }
      });
    }
    scheduleImmediateRedraw();
    return currentFormationKey;
  }

  // 6. Actor Selection & Visual Toggles
  function setActiveActor(id) {
    if (disposed) return;
    const target = actorsById.get(String(id || ''));
    if (!target) return;
    activeAllyId = target.id;
    spriteStage.setActiveActor(activeAllyId);
    scheduleImmediateRedraw();
    notifyActorsUpdated();
  }

  function setSelectedEnemy(id) {
    if (disposed) return;
    const target = actorsById.get(String(id || ''));
    if (!target) return;
    selectedEnemyId = target.id;
    spriteStage.setSelectedEnemy(selectedEnemyId);
    scheduleImmediateRedraw();
    notifyActorsUpdated();
  }

  function setTiltShift(enabled) {
    tiltShiftEnabled = Boolean(enabled);
    if (!disposed) {
      postPipeline.setTiltShiftEnabled(tiltShiftEnabled);
      scheduleImmediateRedraw();
    }
  }

  function setDimNonFocus(enabled, focusIds) {
    dimNonFocusEnabled = Boolean(enabled);
    lastDimFocusIds = focusIds;
    if (!disposed) {
      spriteStage.setDimNonFocus(dimNonFocusEnabled, focusIds);
      scheduleImmediateRedraw();
    }
  }

  function focusCameraOn(mode, actorId) {
    if (!disposed) {
      spriteStage.focusCameraOn(mode, actorId);
      scheduleImmediateRedraw();
    }
  }

  // 7. Interactive 3D Skill Showcase & Infinite Demo Combat Loop
  function castSkill(skillId, ampLevel = 0) {
    if (disposed) return null;
    const skill = resolveSkill(skillId);
    const { ampTier, ampPct } = normalizeAmp(ampLevel);
    const ampMult = 1 + ampPct / 100;
    const shieldMult = SHIELD_AMP_MULT[ampTier] || 1.0;

    const caster =
      actorsById.get(activeAllyId) ||
      actorsList.find((a) => a.side === 'ally') ||
      actorsList[0];
    if (!caster) return null;

    // Deduct MP; auto-refill to maxMp when insufficient so visitors can cast endlessly
    const mpCost = Math.max(1, Math.round(skill.mp * ampMult));
    if (caster.mp < mpCost) {
      caster.mp = caster.maxMp;
    }
    caster.mp = Math.max(0, caster.mp - mpCost);
    notifyActorsUpdated();

    const enemies = actorsList.filter((a) => a.side === 'enemy');
    let targetIds = [];
    if (skill.isGuard) {
      targetIds = [caster.id];
    } else if (skill.aoe) {
      targetIds = enemies.map((e) => e.id);
    } else {
      const targetEnemy = actorsById.get(selectedEnemyId) || enemies[0];
      targetIds = targetEnemy ? [targetEnemy.id] : [];
    }

    const castGen = formationGeneration;

    const demoMeta = spriteStage.triggerSkillDemo(
      caster.id,
      targetIds,
      skill.type,
      (targetId, screenX, screenY) => {
        if (disposed || castGen !== formationGeneration) return;
        const target = actorsById.get(targetId);
        if (!target) return;

        if (skill.isGuard) {
          const variance = 0.94 + Math.random() * 0.12;
          const shieldGain = Math.max(15, Math.round(skill.basePower * shieldMult * variance));
          const isCrit = ampTier >= 2;
          target.maxShield = Math.max(target.maxShield || 0, 60);
          target.shield = Math.min(target.maxShield, (target.shield || 0) + shieldGain);

          notifyActorsUpdated();

          if (typeof onImpact === 'function') {
            try {
              onImpact({
                targetId: target.id,
                screenX,
                screenY,
                damage: shieldGain,
                isShield: true,
                isCrit,
                skillId: skill.id,
                ampTier,
                ampPct,
              });
            } catch (err) {
              console.error('[HD2D DemoShell]', err);
            }
          }
          return;
        }

        const critChance = 0.24 + ampTier * 0.12;
        const isCrit = ampTier >= 3 || Math.random() < critChance;
        const variance = 0.92 + Math.random() * 0.16;
        const damage = Math.max(
          14,
          Math.round(skill.basePower * ampMult * (isCrit ? 1.32 : 1.0) * variance)
        );

        let remaining = damage;
        if (target.shield > 0) {
          const absorbed = Math.min(target.shield, remaining);
          target.shield = Math.max(0, target.shield - absorbed);
          remaining -= absorbed;
        }
        if (remaining > 0) {
          target.hp = Math.max(0, target.hp - remaining);
        }

        if (target.hp <= 0) {
          const prevTid = respawnTimers.get(target.id);
          if (prevTid) clearTimeout(prevTid);
          const tid = setTimeout(() => {
            respawnTimers.delete(target.id);
            if (disposed || castGen !== formationGeneration) return;
            const cur = actorsById.get(target.id);
            if (!cur) return;
            cur.hp = cur.maxHp;
            cur.shield = cur.initialShield;
            cur.mp = cur.maxMp;
            notifyActorsUpdated();
          }, 1400);
          respawnTimers.set(target.id, tid);
        }

        notifyActorsUpdated();

        if (typeof onImpact === 'function') {
          try {
            onImpact({
              targetId: target.id,
              screenX,
              screenY,
              damage,
              isShield: false,
              isCrit,
              skillId: skill.id,
              ampTier,
              ampPct,
            });
          } catch (err) {
            console.error('[HD2D DemoShell]', err);
          }
        }
      }
    );

    scheduleImmediateRedraw();

    return {
      ...(demoMeta || {}),
      casterId: caster.id,
      targetIds,
      skill,
      mpCost,
      ampTier,
      ampPct,
    };
  }

  // 8. Canvas Pointer Parallax & Raycast Picking
  function clientToNDC(ev) {
    const rect = canvasEl.getBoundingClientRect();
    const rw = rect.width || 1;
    const rh = rect.height || 1;
    return {
      ndcX: ((ev.clientX - rect.left) / rw) * 2 - 1,
      ndcY: -(((ev.clientY - rect.top) / rh) * 2 - 1),
    };
  }

  function handlePointerMove(ev) {
    if (disposed) return;
    const { ndcX, ndcY } = clientToNDC(ev);
    spriteStage.setPointerNDC(ndcX, ndcY);

    const now = performance.now();
    if (now - lastHoverCheckMs >= 64) {
      lastHoverCheckMs = now;
      const hoverId = spriteStage.raycastActor(ndcX, ndcY);
      canvasEl.style.cursor = hoverId ? 'pointer' : '';
    }
  }

  function handlePointerLeave() {
    if (disposed) return;
    spriteStage.setPointerNDC(0, 0);
    canvasEl.style.cursor = '';
  }

  function handleCanvasClick(ev) {
    if (disposed) return;
    const { ndcX, ndcY } = clientToNDC(ev);
    const hitId = spriteStage.raycastActor(ndcX, ndcY);
    if (!hitId) return;

    const actor = actorsById.get(hitId);
    if (!actor) return;

    if (actor.side === 'ally') {
      activeAllyId = actor.id;
      spriteStage.setActiveActor(activeAllyId);
    } else {
      selectedEnemyId = actor.id;
      spriteStage.setSelectedEnemy(selectedEnemyId);
    }

    scheduleImmediateRedraw();
    notifyActorsUpdated();

    if (typeof onActorClick === 'function') {
      const snap = cloneActorState(actor);
      try {
        onActorClick({
          ...snap,
          actorId: actor.id,
          actor: snap,
          activeAllyId,
          selectedEnemyId,
          clientX: ev.clientX,
          clientY: ev.clientY,
        });
      } catch (err) {
        console.error('[HD2D DemoShell]', err);
      }
    }
  }

  canvasEl.addEventListener('pointermove', handlePointerMove, { passive: true });
  canvasEl.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  canvasEl.addEventListener('click', handleCanvasClick);

  // 9. Adaptive ResizeObserver + window.resize
  function handleResize() {
    if (disposed) return;
    const { width, height } = measureCanvasCssSize();
    const dpr = isSoftwareRenderer
      ? SOFTWARE_PIXEL_RATIO
      : Math.min(
          typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
          2
        );
    if (width === viewportW && height === viewportH && dpr === currentDpr) {
      return;
    }
    viewportW = width;
    viewportH = height;
    currentDpr = dpr;

    camera.aspect = viewportW / viewportH;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(currentDpr);
    renderer.setSize(viewportW, viewportH, false);
    postPipeline.resize(viewportW, viewportH, currentDpr);
    scheduleImmediateRedraw();
  }

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(canvasEl.parentElement || canvasEl);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize, { passive: true });
  }

  // 10. Mount Initial Biome & Formation
  setBiome(initialBiome);
  setFormation(initialFormation, { deferNotify: true });
  handleResize();

  // 11. Main rAF Render Loop (Full 60fps on hardware GPU; >=220ms post-render idle gap on software WebGL)
  function emitOnFrame(elapsedSec, dtSec) {
    if (disposed || typeof onFrame !== 'function') return;
    const projections = spriteStage.projectAllActors(viewportW, viewportH);
    try {
      onFrame({
        projections,
        actors: actorsList,
        activeAllyId,
        selectedEnemyId,
        fps: currentFps,
        biomeId: currentBiomeId,
        formationKey: currentFormationKey,
        viewportW,
        viewportH,
        elapsedSec,
        dtSec,
      });
    } catch (err) {
      console.error('[HD2D DemoShell]', err);
    }
  }

  function renderFrame(nowMs, isInitial = false) {
    if (disposed) return;
    pendingImmediateRender = false;

    if (!startTimeMs) {
      startTimeMs = nowMs;
      lastFrameMs = nowMs;
      fpsLastSampleMs = nowMs;
    }

    const maxDtSec = isSoftwareRenderer ? SOFTWARE_MAX_DT_SEC : 0.1;
    const dtSec = isInitial ? 1 / 60 : clamp((nowMs - lastFrameMs) / 1000, 0.001, maxDtSec);
    const elapsedSec = isInitial ? 0 : Math.max(0, (nowMs - startTimeMs) / 1000);
    lastFrameMs = nowMs;

    if (!isInitial) {
      fpsFrames += 1;
      const fpsDelta = nowMs - fpsLastSampleMs;
      if (fpsDelta >= 350) {
        currentFps = clamp(Math.round((fpsFrames * 1000) / fpsDelta), 1, 240);
        fpsFrames = 0;
        fpsLastSampleMs = nowMs;
      }
    }

    if (currentBiome && typeof currentBiome.update === 'function') {
      currentBiome.update(elapsedSec, dtSec);
    }
    spriteStage.update(elapsedSec, dtSec);
    postPipeline.update(elapsedSec, dtSec);
    postPipeline.render();
    lastRenderEndMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    emitOnFrame(elapsedSec, dtSec);
  }

  function tick(nowMs) {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);

    if (
      isSoftwareRenderer &&
      !pendingImmediateRender &&
      lastRenderEndMs &&
      nowMs - lastRenderEndMs < SOFTWARE_IDLE_GAP_MS
    ) {
      return;
    }

    renderFrame(nowMs, false);
  }

  // 12. State Accessor & Disposal
  function getState() {
    const snap = getActorsSnapshot();
    return {
      biomeId: currentBiomeId,
      biome: BIOME_LIST.find((b) => b.id === currentBiomeId) || BIOME_LIST[0],
      formationKey: currentFormationKey,
      formationLabel: FORMATIONS[currentFormationKey]
        ? FORMATIONS[currentFormationKey].label
        : currentFormationKey,
      actors: snap,
      allies: snap.filter((a) => a.side === 'ally'),
      enemies: snap.filter((a) => a.side === 'enemy'),
      activeAllyId,
      selectedEnemyId,
      tiltShiftEnabled,
      dimNonFocusEnabled,
      fps: currentFps,
      viewportW,
      viewportH,
      isSoftwareRenderer,
      rendererInfo,
      qualityMode:
        typeof postPipeline.getQualityMode === 'function'
          ? postPipeline.getQualityMode()
          : isSoftwareRenderer
            ? 'software'
            : 'ultra',
      renderMode:
        typeof postPipeline.getRenderMode === 'function' ? postPipeline.getRenderMode() : 'hdr',
    };
  }

  function setQualityMode(mode) {
    if (disposed || typeof postPipeline.setQualityMode !== 'function') return null;
    return postPipeline.setQualityMode(mode);
  }

  let controller = null;

  function dispose() {
    if (disposed) return;
    disposed = true;

    if (typeof window !== 'undefined' && window.__HD2D_ENGINE__ === controller) {
      delete window.__HD2D_ENGINE__;
    }

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    clearRespawnTimers();

    canvasEl.removeEventListener('pointermove', handlePointerMove);
    canvasEl.removeEventListener('pointerleave', handlePointerLeave);
    canvasEl.removeEventListener('click', handleCanvasClick);
    canvasEl.style.cursor = '';

    if (resizeObserver) {
      try {
        resizeObserver.disconnect();
      } catch (err) {
        console.error('[HD2D DemoShell]', err);
      }
      resizeObserver = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }

    if (currentBiome) {
      if (currentBiome.group && currentBiome.group.parent === scene) {
        scene.remove(currentBiome.group);
      }
      try {
        if (typeof currentBiome.dispose === 'function') currentBiome.dispose();
      } catch (err) {
        console.error('[HD2D DemoShell]', err);
      }
      currentBiome = null;
    }

    try {
      spriteStage.dispose();
    } catch (err) {
      console.error('[HD2D DemoShell]', err);
    }
    try {
      postPipeline.dispose();
    } catch (err) {
      console.error('[HD2D DemoShell]', err);
    }
    try {
      texLib.dispose();
    } catch (err) {
      console.error('[HD2D DemoShell]', err);
    }
    try {
      renderer.dispose();
    } catch (err) {
      console.error('[HD2D DemoShell]', err);
    }
  }

  controller = {
    setBiome,
    setFormation,
    setActiveActor,
    setSelectedEnemy,
    setTiltShift,
    setDimNonFocus,
    focusCameraOn,
    castSkill,
    setQualityMode,
    getState,
    dispose,
    isSoftwareRenderer,
    rendererInfo,
  };

  if (typeof window !== 'undefined') {
    window.__HD2D_ENGINE__ = controller;
  }

  // Synchronously paint frame 1 & invoke onFrame immediately so first-screen metrics are live < 1s
  const initNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
  renderFrame(initNow, true);

  rafId = requestAnimationFrame(tick);

  return controller;
}
