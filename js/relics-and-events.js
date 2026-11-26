/* =========================================================================
   转生千金 · 随身铭记（12 秘宝构筑）× 5 大羁绊援护 × 21 季度动态奇遇博弈
   模块化设计：独立挂载于 window.RelicsAndEvents，零侵入既有分支结构
   ========================================================================= */
(function (root) {
  'use strict';

  var MAX_EQUIPPED_RELICS = 3;
  var ARENA_RELICS_KEY = 'ojousama_arena_relics_v1';
  var ARENA_ASSIST_KEY = 'ojousama_arena_assist_v1';
  var ARENA_STAFF_KEY = 'ojousama_arena_staff_v1';

  var ARENA_STAFF_ORDER = ['none', 'eclipse_wand', 'north_saint_staff'];
  var ARENA_STAVES_CATALOG = {
    none: {
      id: 'none',
      name: '徒手导魔',
      shortTag: '常规无杖',
      desc: '徒手引魔 · 无外物法杖加持',
      fallbackKey: 'prism'
    },
    eclipse_wand: {
      id: 'eclipse_wand',
      name: '晦轮杖',
      shortTag: '真实魔伤',
      desc: '魔力上限显著提升 · 穿透真实魔伤',
      fallbackKey: 'star'
    },
    north_saint_staff: {
      id: 'north_saint_staff',
      name: '极北圣晶杖',
      shortTag: '圣晶增幅',
      desc: '高阶魔导增幅 · 施法省蓝',
      fallbackKey: 'iceShard'
    }
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var REL_SVG_PATHS = {
    snowflake: '<path d="M9 2v14M2.9 5.5l12.2 7M15.1 5.5l-12.2 7M7.2 3.8L9 5.5l1.8-1.7M7.2 14.2L9 12.5l1.8 1.7"/>',
    iceShard: '<path d="M9 2l4.5 5.5L9 16 4.5 7.5 9 2zM9 2v14M4.5 7.5h9"/>',
    compass: '<circle cx="9" cy="9" r="6.5"/><path d="M11.8 6.2l-1.5 4.1-4.1 1.5 1.5-4.1 4.1-1.5z"/>',
    scroll: '<path d="M4.5 4a1.5 1.5 0 0 1 1.5-1.5h8v10a2 2 0 0 1-2 2H5"/><path d="M4.5 4v9a2 2 0 0 0 2 2 1.5 1.5 0 0 0 1.5-1.5V12H4.5"/><path d="M7.5 6h4M7.5 9h3.5"/>',
    blossom: '<circle cx="9" cy="9" r="1.8"/><path d="M9 2.5c1.6 1.2 1.6 3.3 0 4.7-1.6-1.4-1.6-3.5 0-4.7zM15.5 9c-1.2 1.6-3.3 1.6-4.7 0 1.4-1.6 3.5-1.6 4.7 0zM9 15.5c-1.6-1.2-1.6-3.3 0-4.7 1.6 1.4 1.6 3.5 0 4.7zM2.5 9c1.2-1.6 3.3-1.6 4.7 0-1.4 1.6-3.5 1.6-4.7 0z"/>',
    sword: '<path d="M14.8 3.2L7 11M14.8 3.2H12l-5.7 5.7M14.8 3.2V6L9.1 11.7M5.2 9.4l3.4 3.4M6.5 11.5l-3 3"/>',
    prism: '<path d="M9 2.2l5.8 5.3L9 15.8 3.2 7.5 9 2.2zM3.2 7.5h11.6M9 2.2L6.8 7.5 9 15.8l2.2-8.3L9 2.2z"/>',
    crestPass: '<path d="M4.5 3.5h9a1.2 1.2 0 0 1 1.2 1.2v6.6c0 2.6-2.5 4.2-5.7 5-3.2-.8-5.7-2.4-5.7-5V4.7a1.2 1.2 0 0 1 1.2-1.2z"/><path d="M9 6.2l1.8 2.5L9 11.2 7.2 8.7 9 6.2z"/>',
    cross: '<path d="M9 2.5v13M4.8 6.8h8.4M7.5 2.5h3M7.5 15.5h3"/>',
    shell: '<path d="M3 10.5c0-3.8 2.7-6.8 6-6.8s6 3 6 6.8c0 1.9-1.5 3.5-3.8 4H6.8c-2.3-.5-3.8-2.1-3.8-4z"/><path d="M9 3.7v10.8M6.2 4.6L8 14.5M11.8 4.6L10 14.5"/>',
    gem: '<path d="M5.5 3.5h7l3 4.2L9 15 2.5 7.7l3-4.2zM2.5 7.7h13M6.5 7.7L9 15l2.5-7.3M5.5 3.5l1 4.2M12.5 3.5l-1 4.2"/>',
    vial: '<path d="M7.2 2.5h3.6M8 2.5v3.2L4.6 11.8a2.3 2.3 0 0 0 2 3.5h4.8a2.3 2.3 0 0 0 2-3.5L10 5.7V2.5M6.2 11h5.6"/>',
    wind: '<path d="M2.5 6.8h8.2a1.8 1.8 0 1 0-1.4-2.9M2.5 9.8h10.8a2 2 0 1 1-1.5 3.3M2.5 12.8h5.2a1.5 1.5 0 1 1-1.1 2.5"/>',
    butterfly: '<path d="M9 6.5v6.5M9 7.8C7.5 4.2 3.2 4 3 7.2c-.2 2 1.8 2.8 3.6 2.3-1.4.8-2 2.5-.8 3.6 1.2 1 2.7-.2 3.2-2M9 7.8c1.5-3.6 5.8-3.8 6-.6.2 2-1.8 2.8-3.6 2.3 1.4.8 2 2.5.8 3.6-1.2 1-2.7-.2-3.2-2"/>',
    crown: '<path d="M3 13.2L4.2 6l3.3 3L9 4.8 10.5 9l3.3-3L15 13.2H3zM3.5 15h11"/>',
    star: '<path d="M9 2l1.8 5.2L16 9l-5.2 1.8L9 16l-1.8-5.2L2 9l5.2-1.8L9 2z"/>',
    music: '<path d="M7 13.2V5l7-1.6v8.2M7 8l7-1.6"/><circle cx="5.4" cy="13.2" r="1.8"/><circle cx="12.4" cy="11.6" r="1.8"/>',
    rose: '<path d="M9 15.5V9.8M9 12.8c1.6-.2 2.8-1 3.2-2.2M9 13.6c-1.5-.2-2.6-.9-3-2"/><path d="M9 9.8c-2.4 0-4-1.5-4-3.7 0-1.6 1-3 2.5-3.4.5 1.1 1.1 1.6 1.5 1.6s1-.5 1.5-1.6c1.5.4 2.5 1.8 2.5 3.4 0 2.2-1.6 3.7-4 3.7z"/><path d="M7.5 6.3c.6.8 2.4.8 3 0"/>',
    chime: '<path d="M9 2.2v2.2M5.2 9.4a3.8 3.8 0 0 1 7.6 0H5.2zM9 9.4v3.2M7.8 12.6h2.4l-.6 3H8.4l-.6-3z"/>',
    anvil: '<path d="M3 6.2h12v1.6c0 1.4-1.2 2.4-2.8 2.4H7.2L6 13.2h7.5v1.6H4.5v-1.6h1l.7-3H4.8C3.6 10.2 3 9 3 7.8V6.2z"/>',
    candle: '<path d="M9 2.3c1.2 1.4 1.4 2.6 0 3.7-1.4-1.1-1.2-2.3 0-3.7zM6.8 7.5h4.4v7.8H6.8zM5 15.3h8"/>',
    teacup: '<path d="M3.5 7.2h9v3.6a3.5 3.5 0 0 1-3.5 3.5H7a3.5 3.5 0 0 1-3.5-3.5V7.2zM12.5 8h1.3a1.5 1.5 0 0 1 0 3h-1.3M3 15.5h10M6.5 4.8c0-.9.8-1 .8-1.8M9.5 4.8c0-.9.8-1 .8-1.8"/>',
    bowl: '<path d="M3 9.2h12a6 6 0 0 1-12 0zM6 15.2h6M6.5 6.4c0-1 .8-1 .8-2M9.5 6.4c0-1 .8-1 .8-2M12 6.4c0-1 .8-1 .8-2"/>',
    mask: '<path d="M2.5 6.2c2.2-.8 4.4-1 6.5-1s4.3.2 6.5 1v2.6c0 2.6-2 4.4-4 4.4-1.3 0-2-.8-2.5-1.6-.5.8-1.2 1.6-2.5 1.6-2 0-4-1.8-4-4.4V6.2z"/><circle cx="6.2" cy="8.8" r="1"/><circle cx="11.8" cy="8.8" r="1"/>',
    orb: '<circle cx="9" cy="7.8" r="4.8"/><path d="M6.8 6.2a2.6 2.6 0 0 1 2.2-1.2M6 12.6l-1 2.6h8l-1-2.6"/>',
    tower: '<path d="M9 2.2L6.2 6h5.6L9 2.2zM6.5 6v9.5h5V6M5 15.5h8M9 8.8h.01M8.2 15.5v-2.8h1.6v2.8"/>',
    mail: '<rect x="2.8" y="4.5" width="12.4" height="9" rx="1.4"/><path d="M3.2 5.2L9 9.8l5.8-4.6"/>',
    lens: '<circle cx="8" cy="8" r="4.6"/><path d="M11.4 11.4l3.6 3.6"/>',
    bell: '<path d="M9 2.5v1.3M5 12.5V8.4a4 4 0 0 1 8 0v4.1l1.2 1.3H3.8L5 12.5zM7.6 14a1.5 1.5 0 0 0 2.8 0"/>',
    fortress: '<path d="M3 15.5h12M4.5 15.5V11h9v4.5M3.2 11h11.6L13 8.2H5L3.2 11zM5.8 8.2L9 4.5l3.2 3.7M8 15.5v-2.6h2v2.6"/>',
    tankard: '<path d="M4.2 6h7.6v8a1.4 1.4 0 0 1-1.4 1.4H5.6A1.4 1.4 0 0 1 4.2 14V6zM11.8 7.5h1.7a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-1.7M5 6c0-1.4 1.3-2.2 3-2.2S11 4.6 11 6"/>',
    lantern: '<path d="M7 3.2h4M9 2v1.2M6 5.2h6l.8 7.6H5.2L6 5.2zM5.2 12.8h7.6M6.5 15h5M9 7.6v2.6"/>',
    wagon: '<path d="M2.5 5.5H12l2 5H4.2l-1.7-5zM12 5.5h2.5M4.2 10.5l-.7 2"/><circle cx="6" cy="14" r="1.5"/><circle cx="12.5" cy="14" r="1.5"/>',
    jar: '<path d="M7 3h4M7.8 3v2.2L5.2 7.8a4.2 4.2 0 0 0 0 5l1.3 2.2h5l1.3-2.2a4.2 4.2 0 0 0 0-5L10.2 5.2V3M6 10h6"/>',
    ledger: '<rect x="4" y="3.5" width="10" height="12" rx="1.4"/><path d="M7 2.5h4v2H7zM6.8 8h4.4M6.8 11h4.4M6.8 13.5h2.8"/>',
    crate: '<rect x="3.2" y="3.8" width="11.6" height="10.4" rx="1.2"/><path d="M3.2 7.2h11.6M3.2 10.8h11.6M6.8 7.2v3.6M11.2 7.2v3.6"/>',
    lock: '<rect x="4.2" y="8.2" width="9.6" height="7" rx="1.5"/><path d="M6.3 8.2V6a2.7 2.7 0 0 1 5.4 0v2.2M9 11v1.8"/>',
    bolt: '<path d="M10.2 2.2L4.5 9.8h4.4L7.8 15.8l5.7-7.6H9.1l1.1-6z"/>'
  };

  function relIco(name, size) {
    var sz = size || 15;
    var body = REL_SVG_PATHS[name] || REL_SVG_PATHS.star;
    return '<svg class="rel-svg-ico" viewBox="0 0 18 18" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  function getItemArtRegistry() {
    if (typeof window !== 'undefined' && window.ItemArtRegistry) return window.ItemArtRegistry;
    if (root && root.ItemArtRegistry) return root.ItemArtRegistry;
    return null;
  }

  function hasRelicArt(itemId) {
    var reg = getItemArtRegistry();
    return !!(reg && typeof reg.getIconUrl === 'function' && reg.getIconUrl(itemId));
  }

  function renderRelicArt(itemId, fallbackSvg, size, cls) {
    var sz = Number(size) || 44;
    var artCls = cls ? ('rel-art-img ' + cls) : 'rel-art-img';
    var reg = getItemArtRegistry();
    if (reg && typeof reg.getIconUrl === 'function' && reg.getIconUrl(itemId)) {
      if (typeof reg.renderIconHTML === 'function') {
        return reg.renderIconHTML(itemId, { size: sz, cls: artCls, eager: true });
      }
      var url = reg.getIconUrl(itemId);
      return '<img class="item-art-img ' + escapeHtml(artCls) + '" src="' + escapeHtml(url) + '" alt="" width="' + Math.round(sz) + '" height="' + Math.round(sz) + '" data-item-id="' + escapeHtml(itemId) + '" decoding="async" draggable="false">';
    }
    return fallbackSvg || '';
  }

  function renderBarehandPrismSVG(size, cls) {
    var sz = Math.round(Number(size) || 48);
    var c = cls ? ('arena-staff-prism ' + cls) : 'arena-staff-prism';
    return (
      '<svg class="' + escapeHtml(c) + '" width="' + sz + '" height="' + sz + '" viewBox="0 0 36 36" fill="none" aria-hidden="true">' +
        '<polygon points="18,4 29,18 18,32 7,18" fill="rgba(22,88,235,0.08)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<polygon points="18,9.5 24,18 18,26.5 12,18" fill="rgba(56,189,248,0.18)" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>' +
        '<line x1="7" y1="18" x2="29" y2="18" stroke="currentColor" stroke-width="1" opacity="0.55"/>' +
        '<circle cx="18" cy="18" r="1.8" fill="currentColor"/>' +
      '</svg>'
    );
  }

  function getS() {
    if (typeof S !== 'undefined' && S) return S;
    return root && root.S ? root.S : null;
  }

  function hasSkillSafe(id, st) {
    var s = st || getS();
    if (!s) return false;
    return (Array.isArray(s.skills) && s.skills.indexOf(id) !== -1) ||
      (Array.isArray(s.skillsLearned) && s.skillsLearned.indexOf(id) !== -1);
  }

  function flagSafe(k, st) {
    var s = st || getS();
    return !!(s && s.flags && s.flags[k]);
  }

  function persistSafe() {
    try {
      if (typeof save === 'function') save();
    } catch (e) {}
  }

  function updateHudSafe() {
    try {
      if (typeof updateHUD === 'function') updateHUD();
    } catch (e) {}
  }

  function toastSafe(msg) {
    try {
      if (typeof toast === 'function') toast(msg);
    } catch (e) {}
  }

  /* =========================================================================
     一、12 件经典铭记秘宝目录（4 大原著套装共鸣，至多佩带 3 件）
     ========================================================================= */
  var RELICS_CATALOG = {
    aino_academy_handkerchief: {
      id: 'aino_academy_handkerchief',
      setId: 'north_frost',
      name: '雪纹手帕',
      iconKey: 'snowflake',
      icon: relIco('snowflake', 15),
      owner: '艾诺 · 极北知己',
      tag: '瞬凝先制 · 冰锋',
      effectText: '首回合首次【隔空瞬凝】免 1 AP 消耗；所有冰系攻击伤害 +20%。',
      lore: '边角绣着六瓣赫兰冰纹的洁白亚麻帕，总带着雪后松林般的清冽寒意。',
      unlockHint: '在学院艾诺知己线、冰封峡谷重逢或北境哨卡奇遇中解锁。',
      unlockAliases: ['aino_handkerchief']
    },
    aino_frost_shard: {
      id: 'aino_frost_shard',
      setId: 'north_frost',
      name: '钢冰试炼笺',
      iconKey: 'iceShard',
      icon: relIco('iceShard', 15),
      owner: '艾诺 · 严苛试炼',
      tag: '破招穿抗 · 寒颤',
      effectText: '触发截断破招或卸力闪反后，下一次冰系技能无视目标 25% 法抗并附带寒颤。',
      lore: '没有半点气泡的通透薄冰片，内部凝着枪冰三式交错收束的发力轨迹。',
      unlockHint: '在艾诺试炼线毕业赠别或学院冰系对练奇遇中解锁。',
      unlockAliases: []
    },
    noelle_manuscript: {
      id: 'noelle_manuscript',
      setId: 'academy_stars',
      name: '省魔手稿',
      iconKey: 'compass',
      icon: relIco('compass', 15),
      owner: '诺艾儿 · 平等同盟',
      tag: '精算减耗 · 增幅减负',
      effectText: '所有魔法基础耗蓝降低 20%；开启【魔力增幅】时保留一半额外增幅魔力。',
      lore: '夹着橘猫胡须书签的推导手稿，每道水幕回路都算清了最省力的路径。',
      unlockHint: '在诺艾儿同盟线赠礼、自尊勘误线或学院图书馆奇遇中解锁。',
      unlockAliases: ['noelle_errata']
    },
    belmont_schedule: {
      id: 'belmont_schedule',
      setId: 'academy_stars',
      name: '无名巡防抄件',
      iconKey: 'scroll',
      icon: relIco('scroll', 15),
      owner: '夏洛特 · 体面默契',
      tag: '先觉预判 · 暴击',
      effectText: '敌方意图栏额外揭示下回合架势倾向；全技能暴击率 +15%（暴击 1.5 倍伤）。',
      lore: '带着淡淡薄荷茶香的工整抄件，字里行间将傲气藏进了分毫不差的刻度里。',
      unlockHint: '在夏洛特东逃回响、战书线或学院冷薄荷茶奇遇中解锁。',
      unlockAliases: ['belmont_challenge']
    },
    alice_flower_cake: {
      id: 'alice_flower_cake',
      setId: 'dukedom_memory',
      name: '风之花饼',
      iconKey: 'blossom',
      icon: relIco('blossom', 15),
      owner: '爱丽丝 · 微风之约',
      tag: '开局残像 · 借风',
      effectText: '每场战斗开局自带 1 层「风行残像」闪避；残像触发躲避时额外回复 10 MP。',
      lore: '花瓣摆成笑脸的蜂蜜烤饼，风吹过饼屑时总像有人悄悄托住了衣袖。',
      unlockHint: '在寒假离校爱丽丝赠饼或公爵府风车奇遇中解锁。',
      unlockAliases: []
    },
    ebony_sword: {
      id: 'ebony_sword',
      setId: 'jikan_blade',
      name: '乌木紫穗剑',
      iconKey: 'sword',
      icon: relIco('sword', 15),
      owner: '澄岚霁馆 · 老霁与霁岚',
      tag: '剑步暴击返 AP · 零暴露',
      effectText: '【霁馆剑步】暴击率 +25%、伤害 +15%；剑步暴击返还 1 AP（每回合限 1 次）且保持零冰系暴露。',
      lore: '乌木鞘朴素沉稳，剑柄末端的紫色剑穗陪着走过澄岚到塞北的长路。',
      unlockHint: '在第三卷澄岚霁馆辞行北上时由老霁与霁岚亲赠。',
      unlockAliases: []
    },
    frost_cipher: {
      id: 'frost_cipher',
      setId: 'jikan_blade',
      name: '霜封暗记',
      iconKey: 'prism',
      icon: relIco('prism', 15),
      owner: '公爵书房 · 暗潮先觉',
      tag: '冰宫回蓝回 AP',
      effectText: '每次开启「冰晶宫殿」成功看破死角后，立即回复 18% 最大 MP 与 1 AP。',
      lore: '暗流拼图合拢后留下的银质联络暗徽，寒意沉静，总能在绝境中稳住呼吸。',
      unlockHint: '在第二卷末夜书房推演拼出暗潮先觉时获赠。',
      unlockAliases: []
    },
    northwind_pass: {
      id: 'northwind_pass',
      setId: 'north_frost',
      name: '北风堡木牌',
      iconKey: 'crestPass',
      icon: relIco('crestPass', 15),
      owner: '北境防线 · 巴依药师团',
      tag: '常驻护盾 · 护箱',
      effectText: '开局及每回合开始时获得 12 点寒铁护盾；护送药箱战额外减少药箱 4 点受击损耗。',
      lore: '凭恒温冰膜手艺赢得的北境边关木牌，木纹里浸着北地松脂与冷风气息。',
      unlockHint: '在北风堡护送药箱获赞或塞北官道奇遇中解锁。',
      unlockAliases: []
    },
    cross: {
      id: 'cross',
      setId: 'academy_stars',
      name: '银十字架',
      iconKey: 'cross',
      icon: relIco('cross', 15),
      owner: '海伦娜 · 神殿信物',
      tag: '每回合续航 · 净化强盾',
      effectText: '每回合结束回复 6% 最大生命；防御盾技额外 +20% 护盾并净化 1 层不良状态。',
      lore: '希里昂见习生唯一的银质信物，在离校分别的礼堂前郑重放进掌心。',
      unlockHint: '在第二卷交换生欢送仪式上接受海伦娜赠礼解锁。',
      unlockAliases: []
    },
    shell_pin: {
      id: 'shell_pin',
      setId: 'academy_stars',
      name: '月虹螺胸针',
      iconKey: 'shell',
      icon: relIco('shell', 15),
      owner: '三姐妹 · 夏日礁石',
      tag: '水风增伤 · 连携回蓝',
      effectText: '水系与风系攻击技能伤害 +18%；触发「连携追击」时额外回复 8% 最大 MP。',
      lore: '三姐妹并肩潜入海湾拾起的月虹螺，螺壳内侧至今留着淡淡的潮声虹彩。',
      unlockHint: '在海滨暑假与姐姐、妹妹同捞月虹螺后解锁。',
      unlockAliases: []
    },
    ice_pebble: {
      id: 'ice_pebble',
      setId: 'dukedom_memory',
      name: '冰蓝石子',
      iconKey: 'gem',
      icon: relIco('gem', 15),
      owner: '公爵府 · 花园微光',
      tag: '经手筑盾',
      effectText: '每回合首次施放【经手构筑】技能时，额外凝结 8 点寒霜护盾。',
      lore: '年幼时在公爵府花坛边拾得的冰蓝小石，握在掌心总是凉丝丝的。',
      unlockHint: '在公爵府花园秘闻或地窖寒痕奇遇中解锁。',
      unlockAliases: []
    },
    blue_vial: {
      id: 'blue_vial',
      setId: 'dukedom_memory',
      name: '淡蓝小瓶',
      iconKey: 'vial',
      icon: relIco('vial', 15),
      owner: '药神 · 圣域恩泽',
      tag: '濒危药雾保命',
      effectText: '每场战斗首次生命跌破 35% 时，透出安神凉雾回复 25% 最大生命并获 1 层「风行残像」。',
      lore: '如同装了一小块晴空的小玻璃瓶。瓶塞始终紧封，却在意识危殆时护住心脉。',
      unlockHint: '在四岁药神宴会收下礼物后自动解锁。',
      unlockAliases: []
    }
  };

  var RELIC_ORDER = [
    'ice_pebble',
    'blue_vial',
    'alice_flower_cake',
    'shell_pin',
    'cross',
    'aino_academy_handkerchief',
    'aino_frost_shard',
    'noelle_manuscript',
    'belmont_schedule',
    'frost_cipher',
    'ebony_sword',
    'northwind_pass'
  ];

  /* =========================================================================
     一点五、4 大原著随身铭记套装共鸣（2 件 / 3 件质变构筑）
     ========================================================================= */
  var RELIC_SYNERGIES = {
    dukedom_memory: {
      id: 'dukedom_memory',
      name: '公爵府遗忆',
      iconKey: 'prism',
      icon: relIco('prism', 14),
      color: '#0284C7',
      relicIds: ['ice_pebble', 'blue_vial', 'alice_flower_cake'],
      thresholds: [2, 3],
      tiers: {
        2: {
          count: 2,
          name: '初雪护佑',
          desc: '开局首回合额外 +1 AP，且获得 10 点霜盾。',
          shortDesc: '首回合 +1 AP · 获 10 点霜盾'
        },
        3: {
          count: 3,
          name: '银与蓝的誓约',
          desc: '每回合首次水/冰系技额外回复 10% 最大魔力，首次护盾技附带 1 层风行残影。',
          shortDesc: '首水/冰技回 10% MP · 首护盾技附 1 层风行残影'
        }
      }
    },
    academy_stars: {
      id: 'academy_stars',
      name: '学院星辉',
      iconKey: 'star',
      icon: relIco('star', 14),
      color: '#1658EB',
      relicIds: ['noelle_manuscript', 'belmont_schedule', 'cross', 'shell_pin'],
      thresholds: [2, 3],
      tiers: {
        2: {
          count: 2,
          name: '精算共鸣',
          desc: '冰晶宫殿洞察或破招成功后，额外对目标施加 2 层脆弱并回复 12% 魔力。',
          shortDesc: '洞察/破招附 2 层脆弱 · 回 12% MP'
        },
        3: {
          count: 3,
          name: '群星同盟',
          desc: '全部魔法技能消耗再降 15%，会心一击威势显著跃升。',
          shortDesc: '全魔法耗蓝再 -15% · 会心威势显著跃升'
        }
      }
    },
    jikan_blade: {
      id: 'jikan_blade',
      name: '霁馆剑心',
      iconKey: 'sword',
      icon: relIco('sword', 14),
      color: '#6366F1',
      relicIds: ['ebony_sword', 'frost_cipher'],
      thresholds: [2],
      tiers: {
        2: {
          count: 2,
          name: '生根剑意',
          desc: '剑技反制与破招的魔战回蓝翻倍，剑技暴击或破招后额外获 +1 AP（每回合限一次）。',
          shortDesc: '剑技反制/破招回蓝翻倍 · 暴击/破招 +1 AP（每回合限 1 次）'
        }
      }
    },
    north_frost: {
      id: 'north_frost',
      name: '北境霜锋',
      iconKey: 'snowflake',
      icon: relIco('snowflake', 14),
      color: '#0369A1',
      relicIds: ['aino_academy_handkerchief', 'aino_frost_shard', 'northwind_pass'],
      thresholds: [2, 3],
      tiers: {
        2: {
          count: 2,
          name: '冰墙守望',
          desc: '每回合初额外 +10 护盾，所有冰系攻击额外穿透 15% 法抗。',
          shortDesc: '回合初 +10 护盾 · 冰系攻击穿透 15% 法抗'
        },
        3: {
          count: 3,
          name: '极北同调',
          desc: '每回合首次远程/隔空冰系技必附 2 层寒颤并追加 15% 碎冰穿透伤害。',
          shortDesc: '首远程/隔空冰技必附 2 层寒颤 · 追加 15% 碎冰穿透伤'
        }
      }
    }
  };

  var SYNERGY_ORDER = ['dukedom_memory', 'academy_stars', 'jikan_blade', 'north_frost'];

  function normalizeRelicIdList(relicIds) {
    if (!Array.isArray(relicIds)) return [];
    var out = [];
    for (var i = 0; i < relicIds.length; i++) {
      var id = relicIds[i];
      if (id && RELICS_CATALOG[id] && out.indexOf(id) === -1) {
        out.push(id);
      }
    }
    return out;
  }

  function getActiveSynergies(relicIds) {
    var clean = normalizeRelicIdList(relicIds);
    if (!clean.length) return [];
    var counts = {};
    clean.forEach(function (id) {
      var sid = RELICS_CATALOG[id].setId;
      if (sid) counts[sid] = (counts[sid] || 0) + 1;
    });

    var result = [];
    SYNERGY_ORDER.forEach(function (sid) {
      var syn = RELIC_SYNERGIES[sid];
      var cnt = counts[sid] || 0;
      if (!syn || cnt < 2) return;
      var tiersActive = syn.thresholds.filter(function (t) { return cnt >= t; });
      if (!tiersActive.length) return;
      var topTier = tiersActive[tiersActive.length - 1];
      var activeEffects = tiersActive.map(function (t) {
        var td = syn.tiers[t];
        return {
          tier: t,
          name: td.name,
          desc: td.desc,
          shortDesc: td.shortDesc
        };
      });
      var shortDesc = activeEffects.map(function (ef) {
        return '【' + ef.name + '】' + ef.shortDesc;
      }).join('；');
      result.push({
        id: syn.id,
        name: syn.name,
        iconKey: syn.iconKey,
        icon: syn.icon,
        count: cnt,
        tier: topTier,
        tierName: syn.tiers[topTier].name,
        tiersActive: tiersActive,
        shortDesc: shortDesc,
        activeEffects: activeEffects,
        color: syn.color
      });
    });
    return result;
  }

  function hasSynergyTier(relicIds, setId, minCount) {
    var syn = RELIC_SYNERGIES[setId];
    if (!syn) return false;
    var need = minCount == null ? 2 : Number(minCount);
    if (!(need > 0)) return false;
    var clean = normalizeRelicIdList(relicIds);
    var cnt = 0;
    for (var i = 0; i < clean.length; i++) {
      if (RELICS_CATALOG[clean[i]].setId === setId) cnt++;
    }
    if (cnt < need) return false;
    for (var j = 0; j < syn.thresholds.length; j++) {
      var t = syn.thresholds[j];
      if (t >= need && cnt >= t) return true;
    }
    return false;
  }

  function getSynergyProgress(relicIds) {
    var clean = normalizeRelicIdList(relicIds);
    var counts = {};
    clean.forEach(function (id) {
      var sid = RELICS_CATALOG[id].setId;
      if (sid) counts[sid] = (counts[sid] || 0) + 1;
    });
    return SYNERGY_ORDER.map(function (sid) {
      var syn = RELIC_SYNERGIES[sid];
      var cnt = counts[sid] || 0;
      var tiersActive = syn.thresholds.filter(function (t) { return cnt >= t; });
      var nextTier = null;
      for (var i = 0; i < syn.thresholds.length; i++) {
        if (cnt < syn.thresholds[i]) { nextTier = syn.thresholds[i]; break; }
      }
      return {
        id: syn.id,
        name: syn.name,
        iconKey: syn.iconKey,
        icon: syn.icon,
        color: syn.color,
        count: cnt,
        maxThreshold: syn.thresholds[syn.thresholds.length - 1],
        tiersActive: tiersActive,
        active: tiersActive.length > 0,
        nextTier: nextTier,
        nextTierDef: nextTier ? syn.tiers[nextTier] : null,
        tiers: syn.tiers
      };
    });
  }

  /* =========================================================================
     二、5 大伙伴「羁绊心念援护」（每场战斗限 1 次，0 AP）
     ========================================================================= */
  var BOND_ASSISTS = {
    alice: {
      id: 'alice',
      charId: 'alice',
      name: '爱丽丝',
      title: '清风托翼',
      iconKey: 'wind',
      icon: relIco('wind', 15),
      quote: '风会托住姐姐大人的衣角。这一次，换我替你吹散前方的尘雾。',
      effectDesc: '0 AP · 清除全部视线受阻与灼烧，立即获得 1 层「风行残像」并回复 15% 最大 MP。',
      canUnlockStory: function (st) {
        return !!(st && st.flags && st.flags.ch_alice_born);
      }
    },
    noelle: {
      id: 'noelle',
      charId: 'noelle',
      name: '诺艾儿',
      title: '精算校准',
      iconKey: 'compass',
      icon: relIco('compass', 15),
      quote: '所有回路阻率我已经替你核算完毕——这一回合，尽管放手去咏唱吧。',
      effectDesc: '0 AP · 本回合所有技能零耗蓝（魔力增幅仍享满额加成），并立即回复 20% 最大 MP。',
      canUnlockStory: function (st) {
        return !!(st && ((st.flags && st.flags.met_noelle) || (st.know && (st.know.noelle || 0) >= 20)));
      }
    },
    aino: {
      id: 'aino',
      charId: 'aino',
      name: '艾诺',
      title: '霜域共鸣',
      iconKey: 'snowflake',
      icon: relIco('snowflake', 15),
      quote: '别只盯着正面那面盾。看准冻裂的那一寸空隙，贯进去。',
      effectDesc: '0 AP · 全体敌方附加 2 回合「易伤」与「寒颤」，并直接削减当前目标 30% 护盾。',
      canUnlockStory: function (st) {
        return !!(st && ((st.flags && st.flags.met_aino) || (st.know && (st.know.aino || 0) >= 20)));
      }
    },
    jilan: {
      id: 'jilan',
      charId: 'jilan',
      name: '霁岚',
      title: '霁馆借步',
      iconKey: 'butterfly',
      icon: relIco('butterfly', 15),
      quote: '底盘沉住！借我这一步踏开身位，剩下的剑路你自己走！',
      effectDesc: '0 AP · 立即 +1 AP、获「剑势蓄力」、破除目标 1 层闪避并净化自身 1 层异常。',
      canUnlockStory: function (st) {
        return !!(st && ((st.flags && st.flags.arrived_jikan) || (st.know && (st.know.jilan || 0) >= 15)));
      }
    },
    charlotte: {
      id: 'charlotte',
      charId: 'charlotte',
      name: '夏洛特',
      title: '贵族体面',
      iconKey: 'crown',
      icon: relIco('crown', 15),
      quote: '维斯特利亚，可别在那种家伙面前丢了同辈较量的格调！',
      effectDesc: '0 AP · 将护盾补满至上限（至少 +40），并赋予本回合「冰镜反震」反伤攻势。',
      canUnlockStory: function (st) {
        return !!(st && ((st.flags && st.flags.met_charlotte) || (st.know && (st.know.charlotte || 0) >= 20)));
      }
    }
  };

  var BOND_ORDER = ['alice', 'noelle', 'aino', 'charlotte', 'jilan'];

  function getAxisSum(cid, st) {
    if (!st || !st.causal || !st.causal.axes || !st.causal.axes[cid]) return 0;
    var ax = st.causal.axes[cid];
    var sum = 0;
    Object.keys(ax).forEach(function (k) { sum += Number(ax[k] || 0); });
    return sum;
  }

  function getUnlockedBondAssists(targetS) {
    var st = targetS || getS();
    if (!st) return [];
    return BOND_ORDER.filter(function (cid) {
      var meta = BOND_ASSISTS[cid];
      if (!meta || !meta.canUnlockStory(st)) return false;
      var lv = (st.love && st.love[cid]) || 0;
      var kn = (st.know && st.know[cid]) || 0;
      var ax = getAxisSum(cid, st);
      return lv >= 2 || kn >= 35 || ax >= 2;
    });
  }

  function getArenaSandboxRelics() {
    try {
      var arr = JSON.parse(localStorage.getItem(ARENA_RELICS_KEY) || '[]');
      if (Array.isArray(arr)) {
        return arr.filter(function (id) { return !!RELICS_CATALOG[id]; }).slice(0, MAX_EQUIPPED_RELICS);
      }
    } catch (e) {}
    return [];
  }

  function setArenaSandboxRelics(list) {
    var clean = [];
    (Array.isArray(list) ? list : []).forEach(function (id) {
      if (RELICS_CATALOG[id] && clean.indexOf(id) === -1 && clean.length < MAX_EQUIPPED_RELICS) {
        clean.push(id);
      }
    });
    try { localStorage.setItem(ARENA_RELICS_KEY, JSON.stringify(clean)); } catch (e) {}
    return clean;
  }

  function getArenaSandboxAssist() {
    try {
      var v = localStorage.getItem(ARENA_ASSIST_KEY);
      if (v && BOND_ASSISTS[v]) return v;
    } catch (e) {}
    return null;
  }

  function setArenaSandboxAssist(charId) {
    var val = (charId && BOND_ASSISTS[charId]) ? charId : '';
    try {
      if (val) localStorage.setItem(ARENA_ASSIST_KEY, val);
      else localStorage.removeItem(ARENA_ASSIST_KEY);
    } catch (e) {}
    return val || null;
  }

  function normalizeStaffId(staffId) {
    return (staffId === 'eclipse_wand' || staffId === 'north_saint_staff' || staffId === 'none')
      ? staffId
      : 'none';
  }

  function getArenaSandboxStaff() {
    try {
      var v = localStorage.getItem(ARENA_STAFF_KEY);
      return normalizeStaffId(v);
    } catch (e) {}
    return 'none';
  }

  function setArenaSandboxStaff(staffId) {
    var val = normalizeStaffId(staffId);
    try {
      localStorage.setItem(ARENA_STAFF_KEY, val);
    } catch (e) {}
    return val;
  }

  function ensureRelicsState(targetS) {
    var st = targetS || getS();
    if (!st) return null;
    if (!Array.isArray(st.equippedRelics)) st.equippedRelics = [];
    st.equippedRelics = st.equippedRelics
      .filter(function (id, idx, arr) { return !!RELICS_CATALOG[id] && arr.indexOf(id) === idx; })
      .slice(0, MAX_EQUIPPED_RELICS);
    if (!st.relicsUnlocked || typeof st.relicsUnlocked !== 'object') st.relicsUnlocked = {};
    if (!st.encounterHistory || typeof st.encounterHistory !== 'object') st.encounterHistory = {};
    if (!st.encounterChains || typeof st.encounterChains !== 'object') st.encounterChains = {};
    if (st.selectedBondAssist && !BOND_ASSISTS[st.selectedBondAssist]) st.selectedBondAssist = null;
    return st;
  }

  function isRelicUnlocked(id, targetS) {
    var def = RELICS_CATALOG[id];
    if (!def) return false;
    var st = ensureRelicsState(targetS);
    if (!st) return false;
    if (st.relicsUnlocked[id]) return true;
    var inv = Array.isArray(st.inv) ? st.inv : [];
    for (var i = 0; i < inv.length; i++) {
      var it = inv[i];
      if (!it) continue;
      if (it.id === id) return true;
      if (def.unlockAliases && def.unlockAliases.indexOf(it.id) !== -1) return true;
    }
    return false;
  }

  function getUnlockedRelicIds(targetS) {
    return RELIC_ORDER.filter(function (id) { return isRelicUnlocked(id, targetS); });
  }

  function unlockRelic(id, targetS, opts) {
    var def = RELICS_CATALOG[id];
    if (!def) return false;
    var st = ensureRelicsState(targetS);
    if (!st) return false;
    var already = isRelicUnlocked(id, st);
    st.relicsUnlocked[id] = true;
    if (!already && !(opts && opts.silent)) {
      toastSafe('✦ 解锁随身铭记：【' + def.name + '】');
    }
    persistSafe();
    return !already;
  }

  function onItemAdded(item, targetS) {
    if (!item || !item.id) return false;
    var unlockedAny = false;
    RELIC_ORDER.forEach(function (rid) {
      var def = RELICS_CATALOG[rid];
      if (def.id === item.id || (def.unlockAliases && def.unlockAliases.indexOf(item.id) !== -1)) {
        if (unlockRelic(rid, targetS)) unlockedAny = true;
      }
    });
    return unlockedAny;
  }

  function toggleEquipRelic(id, opts) {
    opts = opts || {};
    if (!RELICS_CATALOG[id]) return { ok: false, reason: 'invalid' };
    if (opts.sandbox) {
      var curArena = getArenaSandboxRelics();
      var idxA = curArena.indexOf(id);
      if (idxA >= 0) {
        curArena.splice(idxA, 1);
        return { ok: true, equipped: setArenaSandboxRelics(curArena), action: 'unequipped' };
      }
      if (curArena.length >= MAX_EQUIPPED_RELICS) {
        toastSafe('随身铭记最多佩带 3 件，请先卸下一件');
        return { ok: false, reason: 'max_3', equipped: curArena };
      }
      curArena.push(id);
      return { ok: true, equipped: setArenaSandboxRelics(curArena), action: 'equipped' };
    }

    var st = ensureRelicsState(opts.state);
    if (!st) return { ok: false, reason: 'no_state' };
    if (!isRelicUnlocked(id, st)) return { ok: false, reason: 'locked' };
    var idx = st.equippedRelics.indexOf(id);
    if (idx >= 0) {
      st.equippedRelics.splice(idx, 1);
      persistSafe();
      return { ok: true, equipped: st.equippedRelics.slice(), action: 'unequipped' };
    }
    if (st.equippedRelics.length >= MAX_EQUIPPED_RELICS) {
      toastSafe('随身铭记最多佩带 3 件，请先卸下一件');
      return { ok: false, reason: 'max_3', equipped: st.equippedRelics.slice() };
    }
    st.equippedRelics.push(id);
    persistSafe();
    return { ok: true, equipped: st.equippedRelics.slice(), action: 'equipped' };
  }

  function equipRelic(id, opts) {
    opts = opts || {};
    var cur = opts.sandbox ? getArenaSandboxRelics() : (ensureRelicsState(opts.state) || {}).equippedRelics || [];
    if (cur.indexOf(id) !== -1) return { ok: true, equipped: cur.slice(), action: 'already' };
    return toggleEquipRelic(id, opts);
  }

  function unequipRelic(id, opts) {
    opts = opts || {};
    var cur = opts.sandbox ? getArenaSandboxRelics() : (ensureRelicsState(opts.state) || {}).equippedRelics || [];
    if (cur.indexOf(id) === -1) return { ok: true, equipped: cur.slice(), action: 'absent' };
    return toggleEquipRelic(id, opts);
  }

  function getActiveRelicsForBattle(opts) {
    opts = opts || {};
    if (Array.isArray(opts.relics)) {
      return opts.relics
        .filter(function (id, idx, arr) { return !!RELICS_CATALOG[id] && arr.indexOf(id) === idx; })
        .slice(0, MAX_EQUIPPED_RELICS);
    }
    if (opts.fromArena && !opts.useSaveStats) {
      if (opts.headless) return [];
      return getArenaSandboxRelics();
    }
    var st = ensureRelicsState(opts.state);
    if (!st) return [];
    return st.equippedRelics.filter(function (id) { return isRelicUnlocked(id, st); }).slice(0, MAX_EQUIPPED_RELICS);
  }

  function getActiveStaffForBattle(opts) {
    opts = opts || {};
    if (opts.headless) return 'none';
    if (opts.staff !== undefined) {
      return normalizeStaffId(opts.staff);
    }
    if (opts.fromArena && !opts.useSaveStats) {
      return getArenaSandboxStaff();
    }
    var st = opts.state !== undefined ? opts.state : getS();
    return normalizeStaffId(st && st.equippedStaff);
  }

  function getActiveBondAssistForBattle(opts) {
    opts = opts || {};
    if (opts.bondAssist !== undefined) {
      return (opts.bondAssist && BOND_ASSISTS[opts.bondAssist]) ? opts.bondAssist : null;
    }
    if (opts.fromArena && !opts.useSaveStats) {
      if (opts.headless) return null;
      return getArenaSandboxAssist();
    }
    var st = ensureRelicsState(opts.state);
    if (!st) return null;
    var unlocked = getUnlockedBondAssists(st);
    if (!unlocked.length) return null;
    if (st.selectedBondAssist && unlocked.indexOf(st.selectedBondAssist) !== -1) {
      return st.selectedBondAssist;
    }
    // 若尚未手动指定，默认挑选羁绊最高的一位伙伴
    var best = unlocked[0];
    var bestScore = -1;
    unlocked.forEach(function (cid) {
      var sc = ((st.love && st.love[cid]) || 0) * 15 + ((st.know && st.know[cid]) || 0) + getAxisSum(cid, st) * 8;
      if (sc > bestScore) { bestScore = sc; best = cid; }
    });
    return best;
  }

  function selectBondAssist(charId, opts) {
    opts = opts || {};
    if (opts.sandbox) {
      return setArenaSandboxAssist(charId);
    }
    var st = ensureRelicsState(opts.state);
    if (!st) return null;
    var unlocked = getUnlockedBondAssists(st);
    if (charId && unlocked.indexOf(charId) !== -1) {
      st.selectedBondAssist = charId;
    } else if (!charId) {
      st.selectedBondAssist = null;
    }
    persistSafe();
    return st.selectedBondAssist;
  }

  /* =========================================================================
     三、原著风季度动态奇遇与 3 条跨季度链式奇遇（严格时间线防剧透 & 零禁词）
     ========================================================================= */
  function shiftCausalSafe(charId, pole, delta, st) {
    var curGlobal = getS();
    var target = st || curGlobal;
    if (root.BranchingDirector && typeof root.BranchingDirector.shiftAxis === 'function' && (!target || target === curGlobal)) {
      root.BranchingDirector.shiftAxis(charId, pole, delta);
      return true;
    }
    if (!target) return false;
    var c = (root.BranchingDirector && typeof root.BranchingDirector.ensureCausalState === 'function')
      ? root.BranchingDirector.ensureCausalState(target)
      : target.causal;
    if (c && c.axes && c.axes[charId] && typeof c.axes[charId][pole] === 'number') {
      var d = Math.round(Number(delta) || 0);
      c.axes[charId][pole] = Math.max(0, Math.min(30, c.axes[charId][pole] + d));
      return true;
    }
    return false;
  }

  function unlockClueSafe(clueId, st) {
    var curGlobal = getS();
    var target = st || curGlobal;
    if (root.BranchingDirector && typeof root.BranchingDirector.unlockClue === 'function' && (!target || target === curGlobal)) {
      return root.BranchingDirector.unlockClue(clueId);
    }
    if (!target) return false;
    var c = (root.BranchingDirector && typeof root.BranchingDirector.ensureCausalState === 'function')
      ? root.BranchingDirector.ensureCausalState(target)
      : target.causal;
    if (c && c.clues && !c.clues[clueId]) {
      c.clues[clueId] = true;
      return true;
    }
    return false;
  }

  function recordEchoSafe(entry, st) {
    if (!entry || !entry.quote) return false;
    var curGlobal = getS();
    var target = st || curGlobal;
    if (root.BranchingDirector && typeof root.BranchingDirector.recordEcho === 'function' && (!target || target === curGlobal)) {
      return root.BranchingDirector.recordEcho(entry);
    }
    if (!target) return false;
    var c = (root.BranchingDirector && typeof root.BranchingDirector.ensureCausalState === 'function')
      ? root.BranchingDirector.ensureCausalState(target)
      : target.causal;
    if (!c) return false;
    if (!Array.isArray(c.echoes)) c.echoes = [];
    var cleanQuote = String(entry.quote).trim().slice(0, 80);
    if (!cleanQuote) return false;
    var id = entry.id || ('echo_' + (entry.charId || 'any') + '_' + cleanQuote.slice(0, 12));
    var idx = -1;
    for (var i = 0; i < c.echoes.length; i++) {
      if (c.echoes[i] && (c.echoes[i].id === id || c.echoes[i].quote === cleanQuote)) { idx = i; break; }
    }
    var item = {
      id: id,
      charId: entry.charId || '',
      speaker: entry.speaker || '希尔维亚',
      quote: cleanQuote,
      context: entry.context || '季度奇遇',
      weight: Number(entry.weight || 2),
      year: target.year || target.ageY || 0,
      season: target.season || 0,
      seq: Date.now() + Math.random()
    };
    if (idx >= 0) {
      item.weight = Math.max(c.echoes[idx].weight || 1, item.weight);
      c.echoes.splice(idx, 1);
    }
    c.echoes.push(item);
    c.echoes.sort(function (a, b) {
      if ((b.weight || 0) !== (a.weight || 0)) return (b.weight || 0) - (a.weight || 0);
      return (b.seq || 0) - (a.seq || 0);
    });
    if (c.echoes.length > 8) c.echoes = c.echoes.slice(0, 8);
    return true;
  }

  function statAddSafe(k, v, st) {
    var s = st || getS();
    if (!s) return;
    if (!s.stats) s.stats = { body: 5, mind: 15, mana: 10, charm: 8 };
    s.stats[k] = Math.max(0, Math.min(100, (s.stats[k] | 0) + v));
  }

  function expAddSafe(n) {
    if (typeof addExp === 'function') { addExp(n); return; }
    var s = getS();
    if (s) s.exp = (s.exp || 0) + n;
  }

  function loveAddSafe(cid, d) {
    if (typeof love === 'function') { love(cid, d); return; }
    var s = getS();
    if (s) { s.love[cid] = Math.max(0, Math.min(5, (s.love[cid] || 0) + d)); }
  }

  function knowAddSafe(cid, d) {
    if (typeof know === 'function') { know(cid, d); return; }
    var s = getS();
    if (s) { s.know[cid] = Math.max(0, Math.min(100, (s.know[cid] || 0) + d)); }
  }

  function addItemSafe(it) {
    if (typeof addItem === 'function') { addItem(it); return; }
    var s = getS();
    if (s && Array.isArray(s.inv)) s.inv.push(it);
  }

  function getPhaseGroup(st) {
    var ph = (st && st.phase) || 'prologue';
    if (ph === 'academy') return 'academy';
    if (ph === 'journey' || ph === 'finale') return 'journey';
    return 'duke';
  }

  function getQuarterKey(st) {
    var s = st || getS();
    if (!s) return '0:0';
    return String(s.year || 0) + ':' + String(s.season != null ? s.season : 0);
  }

  function markChainProgress(st, prefix, stage, branchKey, branchVal) {
    var s = ensureRelicsState(st);
    if (!s) return;
    s.encounterChains[prefix + '_stage'] = stage;
    s.encounterChains[prefix + '_q'] = getQuarterKey(s);
    s.encounterChains[prefix + '_seq'] = s.encounterChains._seasonSeq || 0;
    if (branchKey) s.encounterChains[branchKey] = branchVal;
  }

  function isNextQuarterReady(lastQuarter, lastSeq, st) {
    if (!lastQuarter) return true;
    var curQ = getQuarterKey(st);
    if (curQ !== lastQuarter) return true;
    var curSeq = (st && st.encounterChains && st.encounterChains._seasonSeq) || 0;
    return curSeq > (lastSeq || 0);
  }

  var ENCOUNTER_CHAINS = {
    chain_peilin_trade: {
      id: 'chain_peilin_trade',
      name: '沛霖与莱恩的暗线商单',
      phasePool: 'journey',
      stateKey: 'peilin_trade_stage',
      acts: ['enc_jrn_peilin_act1', 'enc_jrn_peilin_act2', 'enc_jrn_peilin_act3']
    },
    chain_white_moss: {
      id: 'chain_white_moss',
      name: '北境白藓药草走私谜案',
      phasePool: 'journey',
      stateKey: 'white_moss_stage',
      acts: ['enc_jrn_northwind_black_market', 'enc_jrn_white_moss_audit']
    },
    chain_astrolabe_letter: {
      id: 'chain_astrolabe_letter',
      name: '学院星象塔旧信',
      phasePool: 'academy',
      stateKey: 'astrolabe_stage',
      acts: ['enc_acad_astrolabe_act1', 'enc_acad_astrolabe_act2', 'enc_acad_astrolabe_act3']
    }
  };

  var SEASONAL_EVENTS = [
    // -------- A. 公爵府阶段（7 个） --------
    {
      id: 'enc_duke_nursery_lullaby',
      phasePool: 'duke',
      title: '纱帐边的旧呼吸曲谱',
      tag: '公爵府 · 静心冥想',
      iconKey: 'music',
      icon: relIco('music', 18),
      locationLabel: '育婴室 / 寝居',
      eligible: function (st) {
        return st.ageY >= 1 && st.ageY <= 11;
      },
      intro: '整理书匣底层时，指尖摸到一张母亲早年手抄的安眠曲谱。泛黄的纸页边角记着几行关于魔力随呼吸起落的细碎批注，字迹温婉工整。',
      choices: [
        {
          id: 'meditate_rhythm',
          label: '照着批注的呼吸节拍静坐导引魔力',
          costBadge: '体力 -1',
          rewardBadge: 'MP上限 +5 · 经验 +24',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '体力不足' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mmp += 5;
            st.mp = st.mmp;
            statAddSafe('mana', 1, st);
            expAddSafe(24);
            return {
              epilogue: '你盘膝照着曲谱的节奏缓缓呼吸，原本散乱流动的冰蓝魔力在胸腔里走过一圈，化作更沉稳的储备。',
              deltas: ['体力 -1', '最大魔力 +5', '魔力适性 +1', '经验 +24']
            };
          }
        },
        {
          id: 'hum_with_family',
          label: '把曲谱念给在场的家人听',
          costBadge: '无消耗',
          rewardBadge: '气质 +2 · 索菲亚好感 +1',
          canChoose: function () { return { ok: true }; },
          apply: function (st) {
            statAddSafe('charm', 2, st);
            loveAddSafe('sophia', 1);
            expAddSafe(15);
            return {
              epilogue: '索菲亚看见旧曲谱时眼眸弯弯的，伸手替你理平了额前碎发，屋里的空气暖融融的。',
              deltas: ['气质 +2', '索菲亚好感 +1', '经验 +15']
            };
          }
        }
      ]
    },
    {
      id: 'enc_duke_ice_cellar_frost',
      phasePool: 'duke',
      title: '地下冰窖里的陈年寒纹',
      tag: '公爵府 · 冰系探秘',
      iconKey: 'gem',
      icon: relIco('gem', 18),
      locationLabel: '公爵府地下储藏间',
      eligible: function (st) {
        return st.ageY >= 4 && st.ageY <= 11 && (flagSafe('mana_awakened', st) || st.ageY >= 5);
      },
      intro: '替厨娘往地下室边缘搬冰镇果盘时，墙角一块早年留下的蓄冰石砖忽然透出微弱的蓝光，里面封着一道极细密、久久未散的旧魔力回路。',
      choices: [
        {
          id: 'peel_frost_pattern',
          label: '冒着寒气侵蚀强行剥离这缕寒纹',
          costBadge: '体力 -2 · HP -8',
          rewardBadge: '魔攻 +2 · 魔力适性 +2 · 经验 +35',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.hp <= 10) return { ok: false, reason: '生命过低' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = Math.max(1, st.hp - 8);
            st.mag += 2;
            statAddSafe('mana', 2, st);
            expAddSafe(35);
            return {
              epilogue: '刺骨白霜顺着指尖往上爬了一寸，你咬牙稳住凝聚速度，总算在冰纹散掉前看清了那道无气泡凝冰的走向。',
              deltas: ['体力 -2', '生命 -8', '魔攻 +2', '魔力适性 +2', '经验 +35']
            };
          }
        },
        {
          id: 'palace_freeze_cellar',
          label: '动用「冰晶宫殿」定格石砖内的旧纹路',
          costBadge: '体力 -1 · 冰晶宫殿',
          rewardBadge: '魔攻 +3 · 铭记解锁【冰蓝石子】',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mag += 3;
            statAddSafe('mind', 2, st);
            statAddSafe('mana', 2, st);
            expAddSafe(48);
            unlockRelic('ice_pebble', st);
            return {
              epilogue: '你在意识深处将裂纹瞬间冻结，退后两步细细拆解，顺势撬出石砖底座里那枚凉浸浸的冰蓝石子。',
              deltas: ['体力 -1', '魔攻 +3', '心智 +2', '经验 +48', '解锁铭记【冰蓝石子】']
            };
          }
        },
        {
          id: 'deliver_fruit_plate',
          label: '稳妥拎起果盘交差，不多碰墙角旧砖',
          costBadge: '无消耗',
          rewardBadge: '金币 +5 · 经验 +14',
          canChoose: function () { return { ok: true }; },
          apply: function (st) {
            st.gold += 5;
            expAddSafe(14);
            return {
              epilogue: '厨房管家夸你手脚利索，顺手塞了几枚零花银币进你的荷包。',
              deltas: ['金币 +5', '经验 +14']
            };
          }
        }
      ]
    },
    {
      id: 'enc_duke_beatrice_fence',
      phasePool: 'duke',
      title: '玫瑰花篱边冒烟的焦痕',
      tag: '公爵府 · 姐妹日常',
      iconKey: 'rose',
      icon: relIco('rose', 18),
      locationLabel: '公爵府花园角门',
      eligible: function (st) {
        return st.ageY >= 4 && st.ageY <= 10 && !flagSafe('ch_beatrice_leaves', st);
      },
      intro: '转过花园月门时，只见贝阿特丽丝正蹲在一截蔫了半边的白玫瑰篱笆前，手忙脚乱拿大号水壶往上浇水，金发梢还沾着草叶。',
      choices: [
        {
          id: 'mist_heal_roses',
          label: '凝聚细密水雾替玫瑰枝叶降下火气',
          costBadge: '体力 -1 · MP -10',
          rewardBadge: '贝蒂好感 +1 · 气质 +1 · 经验 +26',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.mp < 10) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mp = Math.max(0, st.mp - 10);
            loveAddSafe('beatrice', 1);
            knowAddSafe('beatrice', 6);
            statAddSafe('charm', 1, st);
            expAddSafe(26);
            return {
              epilogue: '细雾顺着玫瑰嫩芽慢慢浸透下去，叶片重新挺直。贝阿特丽丝长出一口气，拍胸口答应晚上带松饼来赔礼。',
              deltas: ['体力 -1', '魔力 -10', '贝蒂好感 +1', '了解度 +6', '经验 +26']
            };
          }
        },
        {
          id: 'spar_fire_control',
          label: '陪她练一刻钟火冰对冲控温',
          costBadge: '体力 -2 · HP -8',
          rewardBadge: '物攻 +1 · 体能 +2 · 经验 +36',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.hp <= 10) return { ok: false, reason: '生命过低' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = Math.max(1, st.hp - 8);
            st.atk += 1;
            statAddSafe('body', 2, st);
            knowAddSafe('beatrice', 8);
            expAddSafe(36);
            return {
              epilogue: '你举着木剑在热浪里反复格挡闪避，虎口震得发麻，脚步却比昨天扎得更稳。',
              deltas: ['体力 -2', '生命 -8', '攻击 +1', '体能 +2', '经验 +36']
            };
          }
        }
      ]
    },
    {
      id: 'enc_duke_claude_dispatch',
      phasePool: 'duke',
      title: '廊案边的北境边贸账册',
      tag: '公爵府 · 局势暗流',
      iconKey: 'scroll',
      icon: relIco('scroll', 18),
      locationLabel: '书房外偏厅',
      eligible: function (st) {
        return st.ageY >= 6 && st.ageY <= 11;
      },
      intro: '父亲被王都急件叫去了正厅，偏厅矮案上摊着半本领地越冬火油与药材的往来清册，页眉用红墨水圈出了一串发往北边的商队日期。',
      choices: [
        {
          id: 'audit_ledger',
          label: '替父亲核对北境火油与草药核销缺口',
          costBadge: '体力 -2',
          rewardBadge: '心智 +2 · 克劳德了解 +6 · 经验 +35',
          canChoose: function (st) { return st.st >= 2 ? { ok: true } : { ok: false, reason: '需要体力 2' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            statAddSafe('mind', 2, st);
            knowAddSafe('claude', 6);
            if (st.flags) st.flags.heard_duke_border_worry = 1;
            expAddSafe(35);
            return {
              epilogue: '账目上的数字冷冰冰地摆成几列，冬麦和伤药的放行印章整整迟了半旬，父亲近来眉间发紧的缘由一目了然。',
              deltas: ['体力 -2', '心智 +2', '克劳德了解 +6', '经验 +35']
            };
          }
        },
        {
          id: 'palace_read_ledger',
          label: '动用「冰晶宫殿」记下异常调防印鉴落款',
          costBadge: '体力 -1 · 冰晶宫殿',
          rewardBadge: '心智 +3 · 暗线拼图推进 · 金币 +6',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.gold += 6;
            statAddSafe('mind', 3, st);
            expAddSafe(45);
            var lit = unlockClueSafe('belmont_troop_shift');
            return {
              epilogue: '你在冰晶宫殿里把几份通行批文叠在一起对照，看清了城郊外务关卡频频换防的轨迹，也顺手算出了漏拨的驿站贴补。',
              deltas: ['体力 -1', '心智 +3', '金币 +6', '经验 +45'].concat(lit ? ['点亮拼图【王都调防与封锁苗头】'] : [])
            };
          }
        },
        {
          id: 'brew_tea_wait',
          label: '合上册子，先替父亲沏一壶温热的红茶',
          costBadge: '无消耗',
          rewardBadge: '克劳德好感 +1 · 体力 +1',
          canChoose: function () { return { ok: true }; },
          apply: function (st) {
            st.st = Math.min(st.mst, st.st + 1);
            loveAddSafe('claude', 1);
            expAddSafe(18);
            return {
              epilogue: '克劳德回来端起温热的茶杯顿了半晌，低声道了句「懂事」，难得露出几分放松的笑意。',
              deltas: ['体力 +1', '克劳德好感 +1', '经验 +18']
            };
          }
        }
      ]
    },
    {
      id: 'enc_duke_alice_paper_windmill',
      phasePool: 'duke',
      title: '石阶上静止的纸风车',
      tag: '公爵府 · 微风之约',
      iconKey: 'chime',
      icon: relIco('chime', 18),
      locationLabel: '公爵府庭院石阶',
      eligible: function (st) {
        return st.ageY >= 5 && st.ageY <= 11 && flagSafe('ch_alice_born', st);
      },
      intro: '爱丽丝安静地坐在花园石阶边，膝上摆着一只白色纸风车。午后树荫纹丝不动，风车叶停在半空，她正歪头打量着纸片边缘的折角。',
      choices: [
        {
          id: 'guide_wind_sense',
          label: '教她闭上眼，自己去寻找院墙外吹来的高处气流',
          costBadge: '体力 -1',
          rewardBadge: '爱丽丝【独立思考】+2 · 心智 +2',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            shiftCausalSafe('alice', 'independence', 2);
            statAddSafe('mind', 2, st);
            knowAddSafe('alice', 6);
            expAddSafe(30);
            return {
              epilogue: '过了一阵，她抬起手腕让风车迎着斜坡上方吹来的一缕凉气，纸叶啪嗒啪嗒越转越快，眼底亮起一星静水般的微光。',
              deltas: ['体力 -1', '爱丽丝·独立思考 +2', '心智 +2', '经验 +30']
            };
          }
        },
        {
          id: 'steady_wind_for_her',
          label: '只用自己的魔力替她维持一阵永远绕着她转的微风',
          costBadge: 'MP -12',
          rewardBadge: '爱丽丝【执念依恋】+2 · 魔力适性 +2',
          canChoose: function (st) { return st.mp >= 12 ? { ok: true } : { ok: false, reason: '魔力不足' }; },
          apply: function (st) {
            st.mp = Math.max(0, st.mp - 12);
            shiftCausalSafe('alice', 'obsession', 2);
            statAddSafe('mana', 2, st);
            loveAddSafe('alice', 1);
            expAddSafe(28);
            return {
              epilogue: '清凉的气流轻轻拢在她指尖周围，纸风车只听从你的呼吸旋转。她悄悄挪近半寸，握住了你的衣袖。',
              deltas: ['魔力 -12', '爱丽丝·执念依恋 +2', '魔力适性 +2', '经验 +28']
            };
          }
        },
        {
          id: 'bake_flower_biscuit',
          label: '拉她去厨房学做一盘风铃草花饼',
          costBadge: '体力 -2',
          rewardBadge: '体力回复 · 解锁铭记【风之花饼】',
          canChoose: function (st) { return st.st >= 2 ? { ok: true } : { ok: false, reason: '需要体力 2' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = st.mhp;
            loveAddSafe('alice', 1);
            expAddSafe(32);
            unlockRelic('alice_flower_cake', st);
            return {
              epilogue: '爱丽丝认认真真把晒干的花瓣按笑脸摆在面团上，出炉后小心包好一块塞进你掌心，香气甜甜的。',
              deltas: ['体力 -2', '生命回满', '爱丽丝好感 +1', '解锁铭记【风之花饼】']
            };
          }
        }
      ]
    },
    {
      id: 'enc_duke_town_peddler',
      phasePool: 'duke',
      title: '利维莫尔镇的冷锻铁摊',
      tag: '领地集市 · 风险交易',
      iconKey: 'anvil',
      icon: relIco('anvil', 18),
      locationLabel: '利维莫尔镇广场',
      eligible: function (st) {
        return st.ageY >= 5 && st.ageY <= 11 && !!(typeof LOCS !== 'undefined' && LOCS.town && LOCS.town.unlock);
      },
      intro: '随管家采买时，镇口杂货摊旁的老铁匠正擦拭一块冷雾缭绕的寒铁护片。他见你停步，眯起眼开出十枚银币的实诚价。',
      choices: [
        {
          id: 'buy_cold_iron',
          label: '花 10 金币买下寒铁护片拆解练手',
          costBadge: '金币 -10',
          rewardBadge: '法抗 +2 · 物抗 +1 · 经验 +35',
          canChoose: function (st) { return st.gold >= 10 ? { ok: true } : { ok: false, reason: '金币不足 10' }; },
          apply: function (st) {
            st.gold -= 10;
            st.mdef += 2;
            st.pdef += 1;
            statAddSafe('mana', 1, st);
            expAddSafe(35);
            return {
              epilogue: '借魔力细细压过护片纹理后，你摸清了寒铁导魔的规律，防身水幕与冰盾也稳了一筹。',
              deltas: ['金币 -10', '法抗 +2', '物抗 +1', '经验 +35']
            };
          }
        },
        {
          id: 'chill_quench_barrel',
          label: '动用水冰魔法替铁匠降温淬火桶换工钱',
          costBadge: '体力 -2 · MP -16',
          rewardBadge: '金币 +12 · 体能 +1 · 经验 +28',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 16) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 16);
            st.gold += 12;
            statAddSafe('body', 1, st);
            expAddSafe(28);
            return {
              epilogue: '你把控得极匀的冷水汽送进木桶，淬火烟雾平稳散去。老铁匠连声称好，爽快数出十二枚银币。',
              deltas: ['体力 -2', '魔力 -16', '金币 +12', '体能 +1', '经验 +28']
            };
          }
        }
      ]
    },
    {
      id: 'enc_duke_chapel_draft',
      phasePool: 'duke',
      title: '小礼拜堂的静止蓝光',
      tag: '公爵府 · 感知凝神',
      iconKey: 'candle',
      icon: relIco('candle', 18),
      locationLabel: '家庭小礼拜堂',
      eligible: function (st) {
        return st.ageY >= 4 && st.ageY <= 11;
      },
      intro: '傍晚走过小礼拜堂时，两排高脚烛火随门缝带入的气流轻轻晃动，唯有彩绘玻璃窗下那片浅蓝光斑静谧如潭水。',
      choices: [
        {
          id: 'sense_temperature_draft',
          label: '闭上双眼分辨堂内每一缕冷热气流走向',
          costBadge: '体力 -1 · MP -10',
          rewardBadge: '心智 +2 · 魔力适性 +2 · 经验 +28',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.mp < 10) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mp = Math.max(0, st.mp - 10);
            statAddSafe('mind', 2, st);
            statAddSafe('mana', 2, st);
            expAddSafe(28);
            return {
              epilogue: '不必睁眼也能清楚察觉烛火旁的暖流与彩窗下的微凉边界，施法时的感知视野又宽敞了些。',
              deltas: ['体力 -1', '魔力 -10', '心智 +2', '魔力适性 +2', '经验 +28']
            };
          }
        },
        {
          id: 'quiet_rest_pew',
          label: '在第二排长椅上静坐片刻缓神',
          costBadge: '无消耗',
          rewardBadge: '体力 +1 · 魔力回复',
          canChoose: function () { return { ok: true }; },
          apply: function (st) {
            st.st = Math.min(st.mst, st.st + 1);
            st.mp = Math.min(st.mmp, st.mp + Math.max(8, Math.floor(st.mmp * 0.35)));
            expAddSafe(12);
            return {
              epilogue: '木椅还保留着一点阳光晒过的余温，闭目坐了片刻，紧绷的肩背松弛下来。',
              deltas: ['体力 +1', '魔力恢复', '经验 +12']
            };
          }
        }
      ]
    },

    // -------- B. 魔法学院阶段（7 个） --------
    {
      id: 'enc_acad_library_misprint',
      phasePool: 'academy',
      title: '图书馆禁借架边的勘误笔记',
      tag: '魔法学院 · 诺艾儿',
      iconKey: 'compass',
      icon: relIco('compass', 18),
      locationLabel: '学院图书馆靠墙双人桌',
      eligible: function (st) {
        return st.phase === 'academy' && flagSafe('met_noelle', st);
      },
      intro: '靠墙双人桌上静静摊着两本水系典籍。诺艾儿用左手背上的墨水日程表压住书角，推来一张写满批注的草稿纸：「这页的回流系数印错了，别照着练。」',
      choices: [
        {
          id: 'co_derive_formula',
          label: '和她并肩拆解三条错误推导并分担重写',
          costBadge: '体力 -2',
          rewardBadge: '诺艾儿【平等同盟】+2 · MP上限 +8 · 经验 +48',
          canChoose: function (st) { return st.st >= 2 ? { ok: true } : { ok: false, reason: '需要体力 2' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mmp += 8;
            st.mp = Math.min(st.mmp, st.mp + 20);
            shiftCausalSafe('noelle', 'partnership', 2);
            knowAddSafe('noelle', 6);
            statAddSafe('mind', 2, st);
            expAddSafe(48);
            if (st.year >= 14) unlockRelic('noelle_manuscript', st);
            return {
              epilogue: '沙沙的落笔声在窗边交错响了一整个下午。收笔时，诺艾儿耳尖微微泛红，又将草稿顺手推回你手边。',
              deltas: ['体力 -2', '最大魔力 +8', '诺艾儿·平等同盟 +2', '了解度 +6', '经验 +48']
            };
          }
        },
        {
          id: 'palace_check_blueprint',
          label: '动用「冰晶宫殿」逐行对照历年考题勘误',
          costBadge: '体力 -1 · 冰晶宫殿',
          rewardBadge: '魔攻 +3 · 心智 +3 · 解锁铭记【省魔手稿】',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mag += 3;
            statAddSafe('mind', 3, st);
            shiftCausalSafe('noelle', 'partnership', 1);
            expAddSafe(55);
            unlockRelic('noelle_manuscript', st);
            return {
              epilogue: '冰镜冻结下的字迹分毫毕现，你补全了她遗漏的最后半行省魔公式。诺艾儿盯着纸面顿了片刻，郑重把备忘手稿折好递给了你。',
              deltas: ['体力 -1', '魔攻 +3', '心智 +3', '解锁铭记【省魔手稿】']
            };
          }
        },
        {
          id: 'settle_fair_debt',
          label: '工整抄清勘误单，附上一盒糖霜饼干算清人情',
          costBadge: '金币 -6',
          rewardBadge: '诺艾儿【自尊防线】+2 · 法抗 +2 · 经验 +38',
          canChoose: function (st) { return st.gold >= 6 ? { ok: true } : { ok: false, reason: '金币不足 6' }; },
          apply: function (st) {
            st.gold -= 6;
            st.mdef += 2;
            shiftCausalSafe('noelle', 'guarded_pride', 2);
            knowAddSafe('noelle', 5);
            expAddSafe(38);
            return {
              epilogue: '诺艾儿仔仔细细核对过账目似的把饼干收下，低声说了句「两清」，却悄悄把你那份笔记夹进了封面最里层。',
              deltas: ['金币 -6', '法抗 +2', '诺艾儿·自尊防线 +2', '经验 +38']
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_aino_glacier_drill',
      phasePool: 'academy',
      title: '黄昏训练场的铜币落点',
      tag: '魔法学院 · 艾诺',
      iconKey: 'iceShard',
      icon: relIco('iceShard', 18),
      locationLabel: '训练场边缘沙地',
      eligible: function (st) {
        return st.phase === 'academy' && flagSafe('met_aino', st) && !flagSafe('ch_ice_melt_1', st);
      },
      intro: '夕阳拉长了木桩的影子，艾诺蹲在标靶前把三枚铜币并排冻在沙地上。她拍拍手站起：「不用手。只许打落最右边那枚，另外两枚不许裂。」',
      choices: [
        {
          id: 'hard_precision_drill',
          label: '顶着极寒反冲硬接十次不经手瞬凝试炼',
          costBadge: '体力 -2 · HP -16',
          rewardBadge: '艾诺【严苛试炼】+2 · 魔攻 +3 · 经验 +54',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.hp <= 18) return { ok: false, reason: '生命过低' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = Math.max(1, st.hp - 16);
            st.mag += 3;
            st.atk += 1;
            shiftCausalSafe('aino', 'austere_mentor', 2);
            knowAddSafe('aino', 6);
            expAddSafe(54);
            if (st.year >= 13) unlockRelic('aino_frost_shard', st);
            return {
              epilogue: '震开的冰碴划红了袖口，到第八次时右侧那枚铜币终于笔直飞出而其余两枚完好。艾诺只点头说了句「还行」，却留下一片钢冰试炼笺。',
              deltas: ['体力 -2', '生命 -16', '魔攻 +3', '艾诺·严苛试炼 +2', '经验 +54']
            };
          }
        },
        {
          id: 'gentle_melt_control',
          label: '改用恒温微冰贴近铜币边沿融开冰托，不伤及旁物',
          costBadge: '体力 -1 · MP -24',
          rewardBadge: '艾诺【极北知己】+2 · 艾诺好感 +1 · 经验 +44',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.mp < 24) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mp = Math.max(0, st.mp - 24);
            shiftCausalSafe('aino', 'kinship', 2);
            loveAddSafe('aino', 1);
            knowAddSafe('aino', 6);
            expAddSafe(44);
            return {
              epilogue: '最右那枚铜币无声滑落沙地。艾诺盯着那一圈均匀无气泡的融水痕看了许久，鼻尖轻轻耸了一下，从兜里摸出手帕捻掉发梢碎雪。',
              deltas: ['体力 -1', '魔力 -24', '艾诺·极北知己 +2', '艾诺好感 +1', '经验 +44']
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_charlotte_mint_tea',
      phasePool: 'academy',
      title: '小杂货铺窗边的凉薄荷茶',
      tag: '魔法学院 · 夏洛特',
      iconKey: 'teacup',
      icon: relIco('teacup', 18),
      locationLabel: '学院后街旧杂货铺',
      eligible: function (st) {
        return st.phase === 'academy' && flagSafe('met_charlotte', st);
      },
      intro: '躲雨走进后街僻静的小铺时，柜台角落坐着一道熟悉的金色身影。夏洛特收起折扇，指尖正沿着凉透的薄荷茶杯壁慢慢画圈。',
      choices: [
        {
          id: 'sit_in_silence',
          label: '在斜对面安静坐下，只点一杯同样不加糖的茶',
          costBadge: '体力 -1 · 金币 -3',
          rewardBadge: '夏洛特【卸下面具】+2 · 好感 +1 · 经验 +42',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.gold < 3) return { ok: false, reason: '金币不足 3' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.gold -= 3;
            shiftCausalSafe('charlotte', 'candor', 2);
            loveAddSafe('charlotte', 1);
            knowAddSafe('charlotte', 6);
            expAddSafe(42);
            if (st.year >= 14) unlockRelic('belmont_schedule', st);
            return {
              epilogue: '雨点敲在油布棚上噼啪作响，谁也没有拿王庭或榜单说事。离开前她把折扇一收，将一张带着淡淡薄荷茶香的巡防抄件留在了桌角。',
              deltas: ['体力 -1', '金币 -3', '夏洛特·卸下面具 +2', '好感 +1', '经验 +42']
            };
          }
        },
        {
          id: 'challenge_exam_rank',
          label: '递上自拟考场比试条：「下回成绩单见高下。」',
          costBadge: '体力 -1',
          rewardBadge: '夏洛特【骄傲较劲】+2 · 魔攻 +2 · 经验 +45',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mag += 2;
            shiftCausalSafe('charlotte', 'rivalry', 2);
            knowAddSafe('charlotte', 5);
            expAddSafe(45);
            return {
              epilogue: '夏洛特耳根微红地站起身，抬高下巴接过纸条，傲气瞬间重新满格：「奉陪到底，维斯特利亚。」',
              deltas: ['体力 -1', '魔攻 +2', '夏洛特·骄傲较劲 +2', '经验 +45']
            };
          }
        },
        {
          id: 'palace_spot_mud',
          label: '动用「冰晶宫殿」留意她靴边城郊私军的黄泥印',
          costBadge: 'MP -15 · 冰晶宫殿',
          rewardBadge: '点亮线索 · 心智 +3 · 经验 +50',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.mp < 15) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.mp = Math.max(0, st.mp - 15);
            statAddSafe('mind', 3, st);
            expAddSafe(50);
            var lit = unlockClueSafe('belmont_troop_shift');
            return {
              epilogue: '她靴跟沾着东郊骑兵校场特有的红泥，看来她比外头任何人更早察觉到家里私兵的异动。',
              deltas: ['魔力 -15', '心智 +3', '经验 +50'].concat(lit ? ['点亮拼图【王都调防与封锁苗头】'] : [])
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_ajun_spice_crate',
      phasePool: 'academy',
      title: '食堂后门被扣的巴依香料箱',
      tag: '魔法学院 · 暗线线索',
      iconKey: 'bowl',
      icon: relIco('bowl', 18),
      locationLabel: '公共厨房后巷',
      eligible: function (st) {
        return st.phase === 'academy' && flagSafe('met_ajun', st);
      },
      intro: '阿琼蹲在公共厨房台阶上对着半潮的姜黄粉袋直叹气。他说城门巡逻队盘查巴依货车时查扣了两箱香料，还要反复打听维斯特利亚家宴席用度。',
      choices: [
        {
          id: 'dry_spices_water_ice',
          label: '借冰水吸湿替他救回半箱受潮香料',
          costBadge: '体力 -2 · MP -20',
          rewardBadge: '金币 +10 · 阿琼好感 +1 · 经验 +42',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 20) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 20);
            st.gold += 10;
            loveAddSafe('ajun', 1);
            knowAddSafe('ajun', 6);
            expAddSafe(42);
            return {
              epilogue: '冷雾迅速把潮气凝成霜粒撇开，金灿灿的咖喱粉重焕香气。阿琼乐得请食堂大厨包下了晚饭，还硬塞给你跑腿费。',
              deltas: ['体力 -2', '魔力 -20', '金币 +10', '阿琼好感 +1', '经验 +42']
            };
          }
        },
        {
          id: 'probe_banquet_inquiry',
          label: '顺着他翻出的小本子追问盘查者的来路',
          costBadge: '体力 -1',
          rewardBadge: '点亮暗线【宴席食谱外的暗探】 · 心智 +2',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            statAddSafe('mind', 2, st);
            knowAddSafe('ajun', 5);
            expAddSafe(48);
            var lit = unlockClueSafe('bayi_banquet_leak');
            return {
              epilogue: '阿琼小本子背面顺带记着「银杯样式」「侧门换班钟点」，有人正借他这根老实线头窥探公爵府内情。',
              deltas: ['体力 -1', '心智 +2', '经验 +48'].concat(lit ? ['点亮拼图【宴席食谱外的暗探】'] : [])
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_emma_theater',
      phasePool: 'academy',
      title: '东区宿舍的话剧飘雪道具',
      tag: '魔法学院 · 宿舍日常',
      iconKey: 'mask',
      icon: relIco('mask', 18),
      locationLabel: '东区宿舍三一二室',
      eligible: function (st) {
        return st.phase === 'academy';
      },
      intro: '艾玛抱着一叠话剧社台本满脸苦恼地摊在床沿——礼堂小剧场需要一场既能飘出轻雪、又不会把道具披风打湿的谢幕布景。',
      choices: [
        {
          id: 'silky_dry_snow',
          label: '用极细冰晶化作干雪，落地前便散作轻雾',
          costBadge: '体力 -1 · MP -22',
          rewardBadge: '气质 +3 · 金币 +12 · 艾玛好感 +1',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.mp < 22) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mp = Math.max(0, st.mp - 22);
            st.gold += 12;
            statAddSafe('charm', 3, st);
            loveAddSafe('emma', 1);
            knowAddSafe('emma', 6);
            expAddSafe(40);
            return {
              epilogue: '谢幕灯光落下的瞬间，半空飘过一场静谧干燥的细雪，剧社负责人激动地把筹办津贴直接塞进了艾玛和你的手里。',
              deltas: ['体力 -1', '魔力 -22', '金币 +12', '气质 +3', '艾玛好感 +1']
            };
          }
        },
        {
          id: 'copy_stage_cue',
          label: '帮她誊抄场记并顺便分走两份提拉米苏',
          costBadge: '体力 -2',
          rewardBadge: '获赠【热饼干】补给 · 经验 +32',
          canChoose: function (st) { return st.st >= 2 ? { ok: true } : { ok: false, reason: '需要体力 2' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            loveAddSafe('emma', 1);
            addItemSafe({ id: 'cookie', name: '热饼干', icon: relIco('blossom', 14), desc: '可随时在背包食用恢复 1 点体力。' });
            expAddSafe(32);
            return {
              epilogue: '字迹整齐的场记本换来两盒热腾腾的点心，艾玛拍着肚子感叹这就是理想中的校园生活。',
              deltas: ['体力 -2', '艾玛好感 +1', '获得【热饼干】', '经验 +32']
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_market_curio',
      phasePool: 'academy',
      title: '材料市场的崩缺魔导镜片',
      tag: '王都集市 · 风险博弈',
      iconKey: 'orb',
      icon: relIco('orb', 18),
      locationLabel: '王都中央材料市场',
      eligible: function (st) {
        return st.phase === 'academy';
      },
      intro: '中央材料市场西角的旧摊上，一名游商摆出半块带着北地刻痕的魔导晶镜。镜面虽有一道细裂，却能折射出极清澈的水蓝灵光。',
      choices: [
        {
          id: 'buy_lens',
          label: '出价 12 金币买下拆解校准自己的法抗回路',
          costBadge: '金币 -12',
          rewardBadge: '法抗 +3 · 魔攻 +2 · 经验 +50',
          canChoose: function (st) { return st.gold >= 12 ? { ok: true } : { ok: false, reason: '金币不足 12' }; },
          apply: function (st) {
            st.gold -= 12;
            st.mdef += 3;
            st.mag += 2;
            expAddSafe(50);
            return {
              epilogue: '剔除杂质后，晶镜内部精巧的折射纹路让你少走了不少弯路，随手撑起的水幕坚固了许多。',
              deltas: ['金币 -12', '法抗 +3', '魔攻 +2', '经验 +50']
            };
          }
        },
        {
          id: 'craft_ice_lens',
          label: '当场凝出一枚完美无瑕的冰透镜抵作工费',
          costBadge: '体力 -2 · MP -28',
          rewardBadge: '金币 +15 · 魔力适性 +2 · 经验 +42',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 28) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 28);
            st.gold += 15;
            statAddSafe('mana', 2, st);
            expAddSafe(42);
            return {
              epilogue: '通透得连光路都不会散射的冰镜让老摊主看直了眼，当场用现钱买下了你的手艺。',
              deltas: ['体力 -2', '魔力 -28', '金币 +15', '魔力适性 +2', '经验 +42']
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_belltower_wind',
      phasePool: 'academy',
      title: '钟塔顶层的静风空腔',
      tag: '魔法学院 · 极限凝练',
      iconKey: 'tower',
      icon: relIco('tower', 18),
      locationLabel: '学院钟塔顶层',
      eligible: function (st) {
        return st.phase === 'academy' && !!(typeof LOCS !== 'undefined' && LOCS.clocktower && LOCS.clocktower.unlock);
      },
      intro: '夜风顺着钟塔四壁倒灌进来，却在石柱中央形成一圈奇妙的静风空腔。长椅底下的橘猫竖起耳朵，安静盯着空气里微微发亮的寒气。',
      choices: [
        {
          id: 'compress_mana_vortex',
          label: '借风压试着极限压缩体内的魔力漩涡',
          costBadge: '体力 -2 · HP -12 · MP -26',
          rewardBadge: 'MP上限 +10 · 魔攻 +3 · 经验 +58',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.hp <= 15 || st.mp < 26) return { ok: false, reason: '状态不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = Math.max(1, st.hp - 12);
            st.mp = Math.max(0, st.mp - 26);
            st.mmp += 10;
            st.mag += 3;
            expAddSafe(58);
            return {
              epilogue: '狂风把冰碴刮得生疼，魔力却在高压下骤然收缩了一圈，回流的速度快得连自己都略微惊讶。',
              deltas: ['体力 -2', '生命 -12', '最大魔力 +10', '魔攻 +3', '经验 +58']
            };
          }
        },
        {
          id: 'feed_orange_cat',
          label: '拿小鱼干喂橘猫，顺便记下风压变化曲线',
          costBadge: '金币 -2',
          rewardBadge: '诺艾儿了解 +5 · 心智 +2 · 生命全满',
          canChoose: function (st) { return st.gold >= 2 ? { ok: true } : { ok: false, reason: '金币不足 2' }; },
          apply: function (st) {
            st.gold -= 2;
            st.hp = st.mhp;
            knowAddSafe('noelle', 5);
            statAddSafe('mind', 2, st);
            expAddSafe(30);
            return {
              epilogue: '橘猫吃饱后用尾巴尖扫了扫你的鞋面，隔日诺艾儿经过时还特意多看了长椅两眼。',
              deltas: ['金币 -2', '生命回满', '诺艾儿了解 +5', '心智 +2']
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_astrolabe_act1',
      phasePool: 'academy',
      chainId: 'chain_astrolabe_letter',
      chainName: '学院星象塔旧信',
      chainAct: 1,
      chainTotal: 3,
      title: '星象塔旧书阁的折角信笺',
      tag: '魔法学院 · 星象旧信',
      iconKey: 'mail',
      icon: relIco('mail', 18),
      locationLabel: '学院星象塔旧书阁',
      eligible: function (st) {
        return st.phase === 'academy' && flagSafe('met_noelle', st) &&
          !(st.encounterChains && st.encounterChains.astrolabe_stage >= 1);
      },
      intro: '替水系讲师归还观星仪借阅单时，一册水文星象旧年鉴里滑出一张折角信笺。纸角压着半枚王都旧历水纹印，信尾只留下一句「潮汐易位之夜，观钟塔南檐」。',
      choices: [
        {
          id: 'share_with_noelle',
          label: '拿去图书馆交给诺艾儿，一起对照纸角的水文星象记号',
          costBadge: '体力 -1',
          rewardBadge: '诺艾儿【平等同盟】+2 · 心智 +2 · 经验 +42',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            statAddSafe('mind', 2, st);
            shiftCausalSafe('noelle', 'partnership', 2, st);
            knowAddSafe('noelle', 6);
            expAddSafe(42);
            markChainProgress(st, 'astrolabe', 1, 'astrolabe_branch', 'noelle_ally');
            recordEchoSafe({
              charId: 'noelle',
              speaker: '诺艾儿',
              quote: '旧年鉴里的水纹标记绝非巧合，下季古籍区开放我们就查清它的来历。',
              context: '星象塔旧信',
              weight: 2
            }, st);
            return {
              epilogue: '诺艾儿用左手背压平书页，盯着那半枚水纹印算了好一阵。她说这份年鉴暗藏玄机，约定下季古籍区开放后一同查明出处。',
              deltas: ['体力 -1', '心智 +2', '诺艾儿·平等同盟 +2', '开启链式奇遇【学院星象塔旧信】']
            };
          }
        },
        {
          id: 'probe_charlotte_seal',
          label: '记下信角王室旧纹，对照名门纹章簿并借茶铺查问贝尔蒙家旧藏',
          costBadge: '体力 -1 · 金币 -3',
          rewardBadge: '夏洛特【卸下面具】+2 · 暗线线索 · 经验 +44',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.gold < 3) return { ok: false, reason: '金币不足 3' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.gold -= 3;
            statAddSafe('mind', 2, st);
            shiftCausalSafe('charlotte', 'candor', 2, st);
            if (flagSafe('met_charlotte', st)) knowAddSafe('charlotte', 6);
            var lit = unlockClueSafe('belmont_troop_shift', st);
            expAddSafe(44);
            markChainProgress(st, 'astrolabe', 1, 'astrolabe_branch', 'charlotte_seal');
            recordEchoSafe({
              charId: 'charlotte',
              speaker: '夏洛特',
              quote: '旧水纹印牵着陈年边贸册，知道分寸便别声张，下季古籍区见。',
              context: '星象塔旧信',
              weight: 2
            }, st);
            var who = flagSafe('met_charlotte', st) ? '茶铺窗边的夏洛特' : '茶铺临窗那位贝尔蒙家的金发少女';
            return {
              epilogue: '翻过纹章簿的偏页，那枚水纹印与贝尔蒙家早年经手的边贸旧册如出一辙。' + who + '听见风声时合起折扇，眼角略微一动。',
              deltas: ['体力 -1', '金币 -3', '心智 +2', '夏洛特·卸下面具 +2', '开启链式奇遇【学院星象塔旧信】']
                .concat(lit ? ['点亮拼图【王都调防与封锁苗头】'] : [])
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_astrolabe_act2',
      phasePool: 'academy',
      chainId: 'chain_astrolabe_letter',
      chainName: '学院星象塔旧信',
      chainAct: 2,
      chainTotal: 3,
      title: '图书馆古籍区的隐墨暗纹',
      tag: '魔法学院 · 暗纹查证',
      iconKey: 'lens',
      icon: relIco('lens', 18),
      locationLabel: '学院图书馆古籍区',
      eligible: function (st) {
        var ch = st.encounterChains || {};
        return st.phase === 'academy' && flagSafe('met_noelle', st) &&
          ch.astrolabe_stage === 1 &&
          isNextQuarterReady(ch.astrolabe_q, ch.astrolabe_seq, st);
      },
      intro: '古籍区窗台垂着水雾薄帘。把星象塔旧信笺压在冷玉镇纸下后，纸背在微凉水汽里浮出一列隐墨——既有早年贵族与学院签下的边贸旧约，也有一段失传的水系节流回路草图。',
      getIntro: function (st) {
        var br = st.encounterChains && st.encounterChains.astrolabe_branch;
        if (br === 'noelle_ally') {
          return '诺艾儿早早替你在古籍区靠窗位铺好演算草纸。水雾拂过星象塔旧信笺时，纸背隐墨显出一段失传的水系节流回路与几行边贸旧约落款，她推了推书脊，指尖停在算式折角处。';
        }
        if (br === 'charlotte_seal') {
          return '顺着纹章簿查到古籍区偏架时，夏洛特恰巧合着折扇立在书廊尽头。微凉水雾带出纸背隐墨的那刻，她目光掠过旧协约上的贝尔蒙落款，眉梢极轻地扬起一分。';
        }
        return '古籍区窗台垂着水雾薄帘。把星象塔旧信笺压在冷玉镇纸下后，纸背在微凉水汽里浮出一列隐墨——既有早年贵族与学院签下的边贸旧约，也有一段失传的水系节流回路草图。';
      },
      choices: [
        {
          id: 'copy_circuit_noelle',
          label: '优先临摹纸背的水系节流回路，与诺艾儿分摊推导验证',
          costBadge: '体力 -2 · MP -20',
          rewardBadge: 'MP上限 +8 · 诺艾儿【平等同盟】+2 · 经验 +54',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 20) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 20);
            st.mmp += 8;
            shiftCausalSafe('noelle', 'partnership', 2, st);
            knowAddSafe('noelle', 6);
            expAddSafe(54);
            markChainProgress(st, 'astrolabe', 2, 'astrolabe_act2', 'circuit_study');
            recordEchoSafe({
              charId: 'noelle',
              speaker: '诺艾儿',
              quote: '原来早年的水系前辈也在琢磨省魔回路，这套算式值得记进手稿里。',
              context: '图书馆暗纹',
              weight: 2
            }, st);
            return {
              epilogue: '你们将古老回路拆成几段逐项核验，果然省去不少无谓耗魔。诺艾儿收好演算纸，约定潮汐换季之夜共赴钟塔南檐查验信尾暗语。',
              deltas: ['体力 -2', '魔力 -20', '最大魔力 +8', '诺艾儿·平等同盟 +2', '推进【学院星象塔旧信】至第2幕']
            };
          }
        },
        {
          id: 'check_treaty_charlotte',
          label: '追查旧协约上的边贸封签缺口，与夏洛特点到为止地交换判断',
          costBadge: '体力 -1',
          rewardBadge: '夏洛特双轴变动 · 点亮暗线线索 · 经验 +52',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            statAddSafe('mind', 2, st);
            shiftCausalSafe('charlotte', 'candor', 1, st);
            shiftCausalSafe('charlotte', 'rivalry', 1, st);
            knowAddSafe('charlotte', 6);
            var lit = unlockClueSafe('belmont_troop_shift', st);
            expAddSafe(52);
            markChainProgress(st, 'astrolabe', 2, 'astrolabe_act2', 'treaty_probe');
            recordEchoSafe({
              charId: 'charlotte',
              speaker: '夏洛特',
              quote: '旧账归旧账，今人归今人——别拿陈年废纸来揣度贝尔蒙家的气度。',
              context: '图书馆暗纹',
              weight: 2
            }, st);
            return {
              epilogue: '夏洛特合拢折扇，仪态端方如常，只留下一句「旧账归旧账、今人归今人」，转身前却抬眼望了望窗外钟塔南檐的方向。',
              deltas: ['体力 -1', '心智 +2', '夏洛特·卸下面具 +1', '夏洛特·骄傲较劲 +1', '推进【学院星象塔旧信】至第2幕']
                .concat(lit ? ['点亮拼图【王都调防与封锁苗头】'] : [])
            };
          }
        },
        {
          id: 'palace_record_both',
          label: '动用「冰晶宫殿」一并定格隐墨回路与协约落款，不留水痕',
          costBadge: 'MP -16 · 冰晶宫殿',
          rewardBadge: '魔攻 +3 · 心智 +2 · 诺艾儿/夏洛特双轴 +1',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.mp < 16) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.mp = Math.max(0, st.mp - 16);
            st.mag += 3;
            statAddSafe('mind', 2, st);
            shiftCausalSafe('noelle', 'partnership', 1, st);
            shiftCausalSafe('charlotte', 'candor', 1, st);
            var lit = unlockClueSafe('belmont_troop_shift', st);
            expAddSafe(62);
            markChainProgress(st, 'astrolabe', 2, 'astrolabe_act2', 'palace_full');
            recordEchoSafe({
              charId: 'noelle',
              speaker: '希尔维亚',
              quote: '回路留作修习，旧约留作警醒，两头都不必惊动旁人。',
              context: '图书馆暗纹',
              weight: 3
            }, st);
            return {
              epilogue: '冻结的视野把算式与落款分毫不差地收进心里，湿气散尽后旧信恢复如初，古籍区里无人察觉这页陈年暗纹曾被翻开。',
              deltas: ['魔力 -16', '魔攻 +3', '心智 +2', '双轴暗流推进', '推进【学院星象塔旧信】至第2幕']
                .concat(lit ? ['点亮拼图【王都调防与封锁苗头】'] : [])
            };
          }
        }
      ]
    },
    {
      id: 'enc_acad_astrolabe_act3',
      phasePool: 'academy',
      chainId: 'chain_astrolabe_letter',
      chainName: '学院星象塔旧信',
      chainAct: 3,
      chainTotal: 3,
      title: '钟塔南檐的风铃回响',
      tag: '魔法学院 · 钟塔收束',
      iconKey: 'bell',
      icon: relIco('bell', 18),
      locationLabel: '学院钟塔南檐',
      eligible: function (st) {
        var ch = st.encounterChains || {};
        return st.phase === 'academy' && flagSafe('met_noelle', st) &&
          ch.astrolabe_stage === 2 &&
          isNextQuarterReady(ch.astrolabe_q, ch.astrolabe_seq, st);
      },
      intro: '潮汐换季的晴夜，钟塔南檐下的铜铃随高空晚风轻颤。循着旧信暗语掀开石阶角落一块松动砖石，里头卧着一只油布包裹的小银匣，旁边还蹲着那只竖起耳朵的橘猫。',
      getIntro: function (st) {
        var a2 = st.encounterChains && st.encounterChains.astrolabe_act2;
        if (a2 === 'circuit_study') {
          return '潮汐换季的晴夜，诺艾儿拎着防风提灯立在钟塔南檐石阶边，橘猫正蹭着她的裙角。循着旧信暗语掀开松动砖石，里头果然藏着一只保存完好的小银匣与半卷完整算谱。';
        }
        if (a2 === 'treaty_probe') {
          return '潮汐换季的晴夜，钟塔南檐栏杆上系着一枚折得工整的薄荷香绢结，橘猫蹲在松动砖石旁抬头望你。掀开暗格后，旧银匣里收着一枚虹彩螺饰与原版协约抄件。';
        }
        return '潮汐换季的晴夜，高空晚风把南檐铜铃吹得叮咚作响。橘猫守在暗格砖石旁一动不动，掀开石块后，旧银匣里同时收着完整的省魔算谱与一枚温润的虹彩螺饰。';
      },
      choices: [
        {
          id: 'keep_manuscript_formula',
          label: '将补全的省魔算谱抄录成册，与诺艾儿立下共研水系回路之约',
          costBadge: '体力 -1',
          rewardBadge: 'MP上限 +10 · 诺艾儿【平等同盟】+2 · 解锁【省魔手稿】',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mmp += 10;
            st.mp = st.mmp;
            shiftCausalSafe('noelle', 'partnership', 2, st);
            loveAddSafe('noelle', 1);
            knowAddSafe('noelle', 8);
            expAddSafe(68);
            unlockRelic('noelle_manuscript', st);
            markChainProgress(st, 'astrolabe', 3, 'astrolabe_ending', 'noelle_manuscript');
            recordEchoSafe({
              charId: 'noelle',
              speaker: '诺艾儿',
              quote: '钟塔南檐的旧算谱终于补齐了最后一行，这份省魔手稿归你一半。',
              context: '钟塔风铃',
              weight: 3
            }, st);
            return {
              epilogue: '风铃清响里，诺艾儿把工整誊清的推导手稿郑重递过半册。她说从今往后，关于省魔回路的每一页心得都算两人共同署名。',
              deltas: ['体力 -1', '最大魔力 +10', '诺艾儿·平等同盟 +2', '解锁铭记【省魔手稿】']
            };
          }
        },
        {
          id: 'claim_tidal_shell_charm',
          label: '收好银匣中伴风铃微鸣的虹彩螺饰，把旧协约抄件体面盖回暗格',
          costBadge: '体力 -1',
          rewardBadge: '法抗 +3 · 夏洛特【卸下面具】+2 · 解锁【月虹螺胸针】',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mdef += 3;
            statAddSafe('charm', 2, st);
            shiftCausalSafe('charlotte', 'candor', 2, st);
            loveAddSafe('charlotte', 1);
            knowAddSafe('charlotte', 8);
            expAddSafe(66);
            unlockRelic('shell_pin', st);
            markChainProgress(st, 'astrolabe', 3, 'astrolabe_ending', 'shell_pin');
            recordEchoSafe({
              charId: 'charlotte',
              speaker: '夏洛特',
              quote: '知道何时翻账、何时收手，维斯特利亚果然最懂分寸。',
              context: '钟塔风铃',
              weight: 3
            }, st);
            return {
              epilogue: '月光落在流转潮声光泽的螺壳上，远方回廊响起夏洛特轻敲折扇的脚步声——懂得何时揭开旧账、何时盖回石砖，这份默契无须多言。',
              deltas: ['体力 -1', '法抗 +3', '气质 +2', '夏洛特·卸下面具 +2', '解锁铭记【月虹螺胸针】']
            };
          }
        }
      ]
    },

    // -------- C. 澄岚与北境旅途阶段（11 个，含 2 条跨季度链式奇遇） --------
    {
      id: 'enc_jrn_jikan_night_stalk',
      phasePool: 'journey',
      title: '霁馆后院深夜的木桩回响',
      tag: '澄岚霁馆 · 霁岚',
      iconKey: 'fortress',
      icon: relIco('fortress', 18),
      locationLabel: '霁馆后院砂地',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') && flagSafe('arrived_jikan', st) && !flagSafe('ch_distant_wind_1', st);
      },
      intro: '夜深人静时，二楼窗外传来竹剑划破冷风的脆响。霁岚正借着檐角微弱灯笼光反复校正转腕收刀角度，紫蝴蝶发饰落在领边轻轻晃动。',
      choices: [
        {
          id: 'spar_twenty_bouts',
          label: '拎起走廊角落的竹剑下楼陪她走二十合真格步法',
          costBadge: '体力 -2 · HP -14',
          rewardBadge: '霁岚【并肩远行】+2 · 攻击 +3 · 经验 +62',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.hp <= 16) return { ok: false, reason: '生命过低' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = Math.max(1, st.hp - 14);
            st.atk += 3;
            statAddSafe('body', 2, st);
            shiftCausalSafe('jilan', 'wanderlust', 2);
            loveAddSafe('jilan', 1);
            knowAddSafe('jilan', 6);
            expAddSafe(62);
            return {
              epilogue: '砂地上踏出两串交错的深脚印，竹剑碰在一起叮当脆响。收势时霁岚眼底亮极了，说这下真像两个并肩闯北的剑客。',
              deltas: ['体力 -2', '生命 -14', '攻击 +3', '霁岚·并肩远行 +2', '经验 +62']
            };
          }
        },
        {
          id: 'warm_porridge_corridor',
          label: '从灶台端出两碗还温着的杂粮稀饭坐在廊沿等她',
          costBadge: '体力 -1',
          rewardBadge: '霁岚【归处暖灯】+2 · 生命回满 · 经验 +46',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.hp = st.mhp;
            shiftCausalSafe('jilan', 'hearth', 2);
            knowAddSafe('jilan', 6);
            expAddSafe(46);
            return {
              epilogue: '霁岚收剑过来挨着坐下，捧着温热陶碗小口喝粥，连夜风里的寒意也跟着散了个干净。',
              deltas: ['体力 -1', '生命回满', '霁岚·归处暖灯 +2', '经验 +46']
            };
          }
        },
        {
          id: 'palace_study_jilan_footwork',
          label: '动用「冰晶宫殿」定格她转腕收刀时的重心切换',
          costBadge: 'MP -16 · 冰晶宫殿',
          rewardBadge: '体能 +3 · 攻击 +2 · 经验 +66',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.mp < 16) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.mp = Math.max(0, st.mp - 16);
            st.atk += 2;
            statAddSafe('body', 3, st);
            expAddSafe(66);
            return {
              epilogue: '冻结瞬间看得明明白白——原来霁氏步法的真意不在蓄力，而在落脚一瞬卸掉肩头的余劲。',
              deltas: ['魔力 -16', '体能 +3', '攻击 +2', '经验 +66']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_chenglan_bounty_rumor',
      phasePool: 'journey',
      title: '澄岚酒馆里的冷库急活',
      tag: '澄岚镇 · 隐秘伪装',
      iconKey: 'tankard',
      icon: relIco('tankard', 18),
      locationLabel: '澄岚公会旁老酒馆',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') && flagSafe('arrived_jikan', st) && !flagSafe('ch_distant_wind_1', st);
      },
      intro: '傍晚路过公会旁的小酒馆，掌柜正急得团团转——冰窖漏水化得太快，整窖鲜麦酒眼看要坏。邻桌两名铁级佣兵则压着嗓子议论北林深处的新兽群。',
      choices: [
        {
          id: 'water_chill_discreet',
          label: '只用寻常水系冷流稳住窖温，绝不显露冰系根底',
          costBadge: '体力 -1 · MP -20',
          rewardBadge: '金币 +18 · 气质 +2 · 经验 +48',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.mp < 20) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mp = Math.max(0, st.mp - 20);
            st.gold += 18;
            statAddSafe('charm', 2, st);
            expAddSafe(48);
            return {
              epilogue: '借暗处水气带走燥热，连酒馆门口的佣兵也只当你是个手脚稳当的水系散人剑士。掌柜喜出望外地付了重酬。',
              deltas: ['体力 -1', '魔力 -20', '金币 +18', '气质 +2', '经验 +48']
            };
          }
        },
        {
          id: 'buy_northforest_intel',
          label: '花 6 金币请佣兵喝一壶麦酒，打听北林深处异动',
          costBadge: '金币 -6',
          rewardBadge: '攻击 +2 · 心智 +3 · 经验 +55',
          canChoose: function (st) { return st.gold >= 6 ? { ok: true } : { ok: false, reason: '金币不足 6' }; },
          apply: function (st) {
            st.gold -= 6;
            st.atk += 2;
            statAddSafe('mind', 3, st);
            expAddSafe(55);
            return {
              epilogue: '佣兵抹抹嘴绘声绘色地交代了东北谷地兽群伏击的套路，往后进林子交手省去了许多试探工夫。',
              deltas: ['金币 -6', '攻击 +2', '心智 +3', '经验 +55']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_axu_lost_lamb',
      phasePool: 'journey',
      title: '草坡矮篱外落单的小白羊',
      tag: '澄岚原野 · 田园奇遇',
      iconKey: 'lantern',
      icon: relIco('lantern', 18),
      locationLabel: '镇外缓坡草场',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') && flagSafe('arrived_jikan', st) && !flagSafe('ch_distant_wind_1', st);
      },
      intro: '晨练顺着镇外官道散步时，矮篱笆外的洼地里缩着一只沾满露水草屑的小白羊，小牧羊女阿蓿正提着空篮子在岔路口张望。',
      choices: [
        {
          id: 'root_step_rescue',
          label: '踏「生根步」踩稳湿泥坡把小羊稳稳抱回篱笆',
          costBadge: '体力 -2',
          rewardBadge: '阿蓿了解 +10 · 金币 +8 · 体能 +2',
          canChoose: function (st) { return st.st >= 2 ? { ok: true } : { ok: false, reason: '需要体力 2' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.gold += 8;
            statAddSafe('body', 2, st);
            knowAddSafe('axu', 10);
            expAddSafe(45);
            return {
              epilogue: '雨后泥坡又滑又陡，生根步刚好派上大用场。阿蓿把铜铃系回小羊脖子，欢天喜地送了你一篮鲜羊奶酪换的零钱。',
              deltas: ['体力 -2', '金币 +8', '体能 +2', '阿蓿了解 +10']
            };
          }
        },
        {
          id: 'wind_lure_lamb',
          label: '顺着风向轻抖嫩草叶把小羊哄回羊群',
          costBadge: 'MP -14',
          rewardBadge: '心智 +2 · 经验 +35',
          canChoose: function (st) { return st.mp >= 14 ? { ok: true } : { ok: false, reason: '魔力不足' }; },
          apply: function (st) {
            st.mp = Math.max(0, st.mp - 14);
            statAddSafe('mind', 2, st);
            knowAddSafe('axu', 6);
            expAddSafe(35);
            return {
              epilogue: '小羊嗅着随风飘去的青草香哒哒哒跑回了矮篱里面，省了一身泥点子。',
              deltas: ['魔力 -14', '心智 +2', '经验 +35']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_northroad_broken_cart',
      phasePool: 'journey',
      title: '塞北官道陷雪的药材大车',
      tag: '北行官道 · 雪原救援',
      iconKey: 'wagon',
      icon: relIco('wagon', 18),
      locationLabel: '通往北风堡的荒原官道',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') && flagSafe('ch_distant_wind_1', st);
      },
      intro: '翻过一道冻土坡梁时，前方两辆满载止血草药的大货车深深陷进了半融雪泥坑。车夫冻得通红的手拽着车辕直喘气，眼看就要被迫弃车减重。',
      choices: [
        {
          id: 'freeze_wheel_track',
          label: '在车辙底下铺出一条平坦坚冰垫起木轮并稳住药箱',
          costBadge: '体力 -2 · MP -32',
          rewardBadge: '金币 +22 · HP上限 +10 · 解锁【北风堡木牌】',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 32) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 32);
            st.gold += 22;
            st.mhp += 10;
            st.hp = Math.min(st.mhp, st.hp + 10);
            expAddSafe(70);
            unlockRelic('northwind_pass', st);
            return {
              epilogue: '黑铁车轮压过平滑的厚冰一路驶出雪坑，车箱里的鲜药草丝毫未冻伤。商会管事连连致谢，硬把北风堡商路木牌和重金塞进了你的行囊。',
              deltas: ['体力 -2', '魔力 -32', '金币 +22', '生命上限 +10', '解锁铭记【北风堡木牌】']
            };
          }
        },
        {
          id: 'cut_frozen_axle',
          label: '抽出乌木铁剑连环快斩劈开冻死车轴的坚冰',
          costBadge: '体力 -2',
          rewardBadge: '攻击 +3 · 体能 +2 · 经验 +62',
          canChoose: function (st) { return st.st >= 2 ? { ok: true } : { ok: false, reason: '需要体力 2' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.atk += 3;
            statAddSafe('body', 2, st);
            expAddSafe(62);
            return {
              epilogue: '长剑贴着车轴擦出一串冷硬脆响，坚冰应声崩裂却未伤木轮半寸，送刀的手腕又沉稳了不少。',
              deltas: ['体力 -2', '攻击 +3', '体能 +2', '经验 +62']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_northwind_black_market',
      phasePool: 'journey',
      chainId: 'chain_white_moss',
      chainName: '北境白藓药草走私谜案',
      chainAct: 1,
      chainTotal: 2,
      title: '北风堡后巷的裂纹药罐',
      tag: '北风堡 · 军需急救',
      iconKey: 'jar',
      icon: relIco('jar', 18),
      locationLabel: '北风堡内城石巷',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') &&
          flagSafe('ch_distant_wind_1', st) &&
          !(st.encounterChains && st.encounterChains.white_moss_stage >= 1);
      },
      intro: '傍晚路过军需处后巷时，老药师穆萨正对着几只震出细纹的温养药罐发愁——入夜北风一刮，罐里的白藓伤药膏就会失温凝固。细看罐底，竟还烙着一串本该流向关外黑市的陌生货号。',
      choices: [
        {
          id: 'seal_jars_with_film',
          label: '照料北极铃兰的手法替药罐贴上恒温冰膜，先保住伤兵急用药膏',
          costBadge: '体力 -1 · MP -28',
          rewardBadge: '金币 +16 · 生命回满 · 穆萨了解 +8 · 开启后续调查',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.mp < 28) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mp = Math.max(0, st.mp - 28);
            st.gold += 16;
            st.hp = st.mhp;
            knowAddSafe('musa', 8);
            expAddSafe(65);
            shiftCausalSafe('aino', 'kinship', 1, st);
            markChainProgress(st, 'white_moss', 1, 'white_moss_branch', 'save_medicine');
            recordEchoSafe({
              charId: 'aino',
              speaker: '渔',
              quote: '前线伤兵等不起断药，罐底的古怪货号留待入峡谷后再跟总账对清。',
              context: '北风堡药巷',
              weight: 2
            }, st);
            return {
              epilogue: '穆萨摸过罐沿后连呼妙手，分出精炼白藓膏替你治好手背旧伤，也悄悄抄下罐底那串古怪货号，约定到了前线军需帐再核对总册。',
              deltas: ['体力 -1', '魔力 -28', '金币 +16', '生命回满', '艾诺·极北知己 +1', '开启链式奇遇【北境白藓药草走私谜案】']
            };
          }
        },
        {
          id: 'palace_inspect_jar_residue',
          label: '动用「冰晶宫殿」检视封口油膜配比，并拓下罐底暗刻货号',
          costBadge: 'MP -16 · 冰晶宫殿',
          rewardBadge: '法抗 +3 · 心智 +3 · 艾诺【严苛试炼】+1 · 锁定暗账',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.mp < 16) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.mp = Math.max(0, st.mp - 16);
            st.mdef += 3;
            statAddSafe('mind', 3, st);
            expAddSafe(72);
            shiftCausalSafe('aino', 'austere_mentor', 1, st);
            unlockClueSafe('belmont_troop_shift', st);
            markChainProgress(st, 'white_moss', 1, 'white_moss_branch', 'palace_evidence');
            recordEchoSafe({
              charId: 'aino',
              speaker: '渔',
              quote: '火油封口与罐底暗刻全留在了冰晶宫殿里，谁偷换了北线伤药迟早露马脚。',
              context: '北风堡药巷',
              weight: 2
            }, st);
            return {
              epilogue: '定格住火油与寒气的交界面后，你既悟出了抵御极端温差冲击的防护窍门，又把罐底伪造的转运编号原封不动收进了冰晶宫殿。',
              deltas: ['魔力 -16', '法抗 +3', '心智 +3', '艾诺·严苛试炼 +1', '开启链式奇遇【北境白藓药草走私谜案】']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_white_moss_audit',
      phasePool: 'journey',
      chainId: 'chain_white_moss',
      chainName: '北境白藓药草走私谜案',
      chainAct: 2,
      chainTotal: 2,
      title: '军需帐核验：白藓药草的去向',
      tag: '冰封峡谷 · 谜案收束',
      iconKey: 'ledger',
      icon: relIco('ledger', 18),
      locationLabel: '冰封峡谷防卫队军需帐',
      eligible: function (st) {
        var ch = st.encounterChains || {};
        return (st.phase === 'journey' || st.phase === 'finale') &&
          flagSafe('ch_distant_wind_1', st) &&
          ch.white_moss_stage === 1 &&
          isNextQuarterReady(ch.white_moss_q, ch.white_moss_seq, st);
      },
      intro: '冰封峡谷伤兵营油灯未熄。穆萨捧着各哨卡的配给清册匆匆找来——账本上写明入库的白藓伤药膏，实际运抵前线的份量却缺了一大截，艾诺正立在帐门风口下翻看封签。',
      getIntro: function (st) {
        var br = st.encounterChains && st.encounterChains.white_moss_branch;
        if (br === 'palace_evidence') {
          return '冰封峡谷伤兵营油灯未熄。穆萨展开各哨卡的配给清册时，你立刻对照出在北风堡拓下的那串罐底暗刻货号——果然有一批正品白藓膏在半道被偷换成了掺雪的劣膏。艾诺听完，指尖寒霜一凝，转身扣住了出库名录。';
        }
        return '冰封峡谷伤兵营油灯未熄。多亏北风堡那几罐覆过恒温冰膜的药膏顶住了急用，前线伤兵才没断药；可穆萨照罐底货号逐箱对账时，仍查出后队少了一批原装白藓膏，艾诺正站在帐门风口下凝视名录。';
      },
      choices: [
        {
          id: 'confront_supply_clerk',
          label: '携货号证物随艾诺当面封查转运车队，追回私扣的白藓膏',
          costBadge: '体力 -2 · MP -20',
          rewardBadge: '魔攻 +3 · 金币 +14～22 · 艾诺【严苛试炼】+2 · 解锁【钢冰试炼笺】',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 20) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            var hasProof = st.encounterChains && st.encounterChains.white_moss_branch === 'palace_evidence';
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 20);
            st.mag += 3;
            var goldGain = hasProof ? 22 : 14;
            var expGain = hasProof ? 92 : 78;
            st.gold += goldGain;
            shiftCausalSafe('aino', 'austere_mentor', 2, st);
            knowAddSafe('aino', 8);
            knowAddSafe('musa', 8);
            expAddSafe(expGain);
            unlockRelic('aino_frost_shard', st);
            markChainProgress(st, 'white_moss', 2, 'white_moss_ending', 'exposed');
            recordEchoSafe({
              charId: 'aino',
              speaker: '艾诺',
              quote: '敢克扣前线伤兵救命药的人，冻进雪沟里也不冤。',
              context: '军需帐核验',
              weight: 3
            }, st);
            var ep = hasProof
              ? '暗刻货号与私藏车箱一一对应，倒卖军药的押运书吏无从抵赖。艾诺随手将一片无气泡薄冰笺塞进你袖口，说前线正缺眼明手快的人。'
              : '顺着穆萨留下的药罐印记一路追查到外围雪坡，总算赶在偷运出关前截回整箱白藓膏。艾诺点头记下你的功劳，留下一片钢冰试炼笺作谢。';
            return {
              epilogue: ep,
              deltas: ['体力 -2', '魔力 -20', '魔攻 +3', '金币 +' + goldGain, '艾诺·严苛试炼 +2', '解锁铭记【钢冰试炼笺】']
            };
          }
        },
        {
          id: 'quiet_reroute_musa',
          label: '先稳住前线配给与穆萨的名声，暗中截断走私线并重签药房封签',
          costBadge: '体力 -1',
          rewardBadge: 'HP上限 +10 · 艾诺【极北知己】+2 · 解锁【北风堡木牌】',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            var hasProof = st.encounterChains && st.encounterChains.white_moss_branch === 'palace_evidence';
            st.st = Math.max(0, st.st - 1);
            st.mhp += 10;
            st.hp = st.mhp;
            if (hasProof) st.mdef += 2;
            var expGain = hasProof ? 86 : 74;
            shiftCausalSafe('aino', 'kinship', 2, st);
            loveAddSafe('aino', 1);
            knowAddSafe('musa', 10);
            expAddSafe(expGain);
            unlockRelic('northwind_pass', st);
            markChainProgress(st, 'white_moss', 2, 'white_moss_ending', 'protected');
            recordEchoSafe({
              charId: 'aino',
              speaker: '艾诺',
              quote: '先把伤兵的药稳住再算账，你的性子倒是一点没变。',
              context: '军需帐核验',
              weight: 3
            }, st);
            var ep = hasProof
              ? '你借罐底暗刻货号逼得经手人连夜把私扣药膏原样退回药房，既保住伤兵药罐又没闹得营地人心惶惶。艾诺看了你一眼，亲自签发北风堡木牌交到你手里。'
              : '穆萨连夜重新熬制补齐缺口，艾诺也暗中换掉后勤押运班底，前线伤兵营照常安稳运转。离帐前，老人与艾诺一同把北风堡木牌郑重递到你掌心。';
            return {
              epilogue: ep,
              deltas: ['体力 -1', '生命上限 +10'].concat(hasProof ? ['法抗 +2'] : []).concat(['艾诺·极北知己 +2', '解锁铭记【北风堡木牌】'])
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_canyon_sentinel_frost',
      phasePool: 'journey',
      title: '冰封峡谷东墙的夜哨标尺',
      tag: '冰封峡谷 · 艾诺重逢',
      iconKey: 'snowflake',
      icon: relIco('snowflake', 18),
      locationLabel: '冰封峡谷东侧崖垛',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') && flagSafe('ch_distant_wind_1', st);
      },
      intro: '夜雪压低了哨塔油灯光亮。艾诺站在箭垛阴影后，指尖隔空凝出一排细小冰棱标定雪原远处的魔物足印。她听见脚步声却没回头：「东侧风口归你。」',
      choices: [
        {
          id: 'sync_frost_markers',
          label: '默契接手左侧盲区，并肩标完一整道防线刻度',
          costBadge: '体力 -2 · MP -24',
          rewardBadge: '艾诺【极北知己】+2 · 魔攻 +4 · 解锁【雪纹手帕】',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 24) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 24);
            st.mag += 4;
            shiftCausalSafe('aino', 'kinship', 2);
            loveAddSafe('aino', 1);
            knowAddSafe('aino', 8);
            expAddSafe(80);
            unlockRelic('aino_academy_handkerchief', st);
            return {
              epilogue: '两人的冰棱间距分毫不差地咬合在崖雪之间。换防时她从斗篷袋里摸出一块干爽手帕丢进你怀里，背影很快融进风雪。',
              deltas: ['体力 -2', '魔力 -24', '魔攻 +4', '艾诺·极北知己 +2', '解锁铭记【雪纹手帕】']
            };
          }
        },
        {
          id: 'ask_efficient_cast',
          label: '向她请教严寒拉锯战里最省魔力的破甲落点',
          costBadge: '体力 -1',
          rewardBadge: 'MP上限 +12 · 艾诺【严苛试炼】+1 · 经验 +66',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mmp += 12;
            st.mp = Math.min(st.mmp, st.mp + 24);
            shiftCausalSafe('aino', 'austere_mentor', 1);
            knowAddSafe('aino', 6);
            expAddSafe(66);
            return {
              epilogue: '她随手用剑尖在雪地划了三道交点——顺着甲壳缝隙灌冰，比正面硬轰省下一半力气。',
              deltas: ['体力 -1', '最大魔力 +12', '艾诺·严苛试炼 +1', '经验 +66']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_canyon_crystal_fissure',
      phasePool: 'journey',
      title: '峡谷岩壁深处的冻土晶髓',
      tag: '冰封峡谷 · 高危采掘',
      iconKey: 'prism',
      icon: relIco('prism', 18),
      locationLabel: '冰封峡谷深处裂隙',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') && flagSafe('ch_distant_wind_1', st);
      },
      intro: '巡防到峡谷深处裂隙时，岩壁冰层下露出一簇清澈透明的冻土晶髓。周围冰檐脆薄如纸，稍有震动便可能连带顶岩滑落。',
      choices: [
        {
          id: 'risk_extract_crystal',
          label: '冒着碎岩砸落的风险，硬用隔空凝冰剥出晶髓',
          costBadge: '体力 -2 · HP -20 · MP -36',
          rewardBadge: '魔攻 +5 · HP上限 +12 · 经验 +90',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.hp <= 22 || st.mp < 36) return { ok: false, reason: '状态不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = Math.max(1, st.hp - 20);
            st.mp = Math.max(0, st.mp - 36);
            st.mag += 5;
            st.mhp += 12;
            expAddSafe(90);
            return {
              epilogue: '落石擦着护肩掠下，你稳稳攥住了那簇散发极寒纯光的晶髓，魔力通路间的凝冰威力大涨。',
              deltas: ['体力 -2', '生命 -20', '魔攻 +5', '生命上限 +12', '经验 +90']
            };
          }
        },
        {
          id: 'palace_safe_extract',
          label: '动用「冰晶宫殿」先看清岩层受力纹路，零损伤取髓',
          costBadge: '体力 -1 · 冰晶宫殿',
          rewardBadge: '魔攻 +5 · 法抗 +3 · 经验 +96',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.mag += 5;
            st.mdef += 3;
            expAddSafe(96);
            return {
              epilogue: '顺着冻结画面里最细的一道避震缝隙切入，整簇冻土晶髓悄无声息滑入掌心，岩壁纹丝未动。',
              deltas: ['体力 -1', '魔攻 +5', '法抗 +3', '经验 +96']
            };
          }
        },
        {
          id: 'mark_for_patrol',
          label: '系上警戒红布条交由工兵队统一采集',
          costBadge: '无消耗',
          rewardBadge: '金币 +18 · 心智 +2 · 经验 +50',
          canChoose: function () { return { ok: true }; },
          apply: function (st) {
            st.gold += 18;
            statAddSafe('mind', 2, st);
            expAddSafe(50);
            return {
              epilogue: '防卫队军需官按例发下线索赏金，夸你在北线行事既果断又稳当。',
              deltas: ['金币 +18', '心智 +2', '经验 +50']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_peilin_act1',
      phasePool: 'journey',
      chainId: 'chain_peilin_trade',
      chainName: '沛霖与莱恩的暗线商单',
      chainAct: 1,
      chainTotal: 3,
      title: '驿站茶单里的夹页暗号',
      tag: '官道商路 · 暗线商单',
      iconKey: 'teacup',
      icon: relIco('teacup', 18),
      locationLabel: '官道驿站茶棚',
      eligible: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') &&
          flagSafe('arrived_jikan', st) &&
          !(st.encounterChains && st.encounterChains.peilin_trade_stage >= 1);
      },
      intro: '歇脚喝茶时，跑堂递来的木牌茶单夹缝里折着一张苏秦小楷便笺。纸角画着半片细叶，正是关镇分别时沛记药行留下的暗记——上面写着东库多出一批急转北境的止血干草，莱恩正独自核账犯愁。',
      choices: [
        {
          id: 'reply_tea_cipher',
          label: '照沛记暗记回写一道封蜡条，托驿差提醒莱恩核查车轴与封签',
          costBadge: '体力 -1 · 金币 -4',
          rewardBadge: '心智 +2 · 霁岚【并肩远行】+1 · 经验 +48',
          canChoose: function (st) {
            if (st.st < 1) return { ok: false, reason: '需要体力 1' };
            if (st.gold < 4) return { ok: false, reason: '金币不足 4' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            st.gold -= 4;
            statAddSafe('mind', 2, st);
            shiftCausalSafe('jilan', 'wanderlust', 1, st);
            expAddSafe(48);
            markChainProgress(st, 'peilin_trade', 1, 'peilin_trade_branch', 'cautious_cipher');
            recordEchoSafe({
              charId: 'jilan',
              speaker: '渔',
              quote: '商路上的暗记留给信得过的人，往北走多留一双眼睛总没错。',
              context: '驿站茶单',
              weight: 2
            }, st);
            return {
              epilogue: '蜡封压下细叶折痕后很快随北行快马送出。你合上茶单，往北去的商路多一双留神照应的眼睛，总比蒙头赶路稳妥。',
              deltas: ['体力 -1', '金币 -4', '心智 +2', '霁岚·并肩远行 +1', '开启链式奇遇【沛霖与莱恩的暗线商单】']
            };
          }
        },
        {
          id: 'ask_jilan_route',
          label: '把便笺抄给霁岚过目，请她托澄岚熟识车行先替莱恩递口信',
          costBadge: '体力 -1',
          rewardBadge: '霁岚【归处暖灯】+2 · 霁岚了解 +5 · 经验 +44',
          canChoose: function (st) { return st.st >= 1 ? { ok: true } : { ok: false, reason: '需要体力 1' }; },
          apply: function (st) {
            st.st = Math.max(0, st.st - 1);
            shiftCausalSafe('jilan', 'hearth', 2, st);
            knowAddSafe('jilan', 5);
            expAddSafe(44);
            markChainProgress(st, 'peilin_trade', 1, 'peilin_trade_branch', 'jikan_relay');
            recordEchoSafe({
              charId: 'jilan',
              speaker: '霁岚',
              quote: '路上帮过你的人，澄岚这边能顺手照应就多照应一程。',
              context: '驿站茶单',
              weight: 2
            }, st);
            return {
              epilogue: '霁岚看完便笺立刻拍了拍腰间剑柄，托镇口熟面孔的车夫抢先带话去关镇。她说帮过你的人，澄岚这边顺手照应一程理所应当。',
              deltas: ['体力 -1', '霁岚·归处暖灯 +2', '霁岚了解 +5', '开启链式奇遇【沛霖与莱恩的暗线商单】']
            };
          }
        },
        {
          id: 'palace_read_ink',
          label: '动用「冰晶宫殿」细辨纸背笔痕，读出字缝里的北境急调批次',
          costBadge: 'MP -16 · 冰晶宫殿',
          rewardBadge: '心智 +3 · 艾诺【极北知己】+1 · 经验 +56',
          requiresIcePalace: true,
          canChoose: function (st) {
            if (!hasSkillSafe('ice_palace', st)) return { ok: false, reason: '需先习得【冰晶宫殿】' };
            if (st.mp < 16) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.mp = Math.max(0, st.mp - 16);
            statAddSafe('mind', 3, st);
            shiftCausalSafe('aino', 'kinship', 1, st);
            expAddSafe(56);
            markChainProgress(st, 'peilin_trade', 1, 'peilin_trade_branch', 'palace_trace');
            recordEchoSafe({
              charId: 'aino',
              speaker: '渔',
              quote: '北线缺药的风声早已落到关镇商路，每箱干草都不能在半道出岔子。',
              context: '驿站茶单',
              weight: 2
            }, st);
            return {
              epilogue: '在冻结的视野里，被水汽晕淡的几笔急调序号重新浮现出来。北线缺药的风声早已落到关镇商路，这趟药货半点马虎不得。',
              deltas: ['魔力 -16', '心智 +3', '艾诺·极北知己 +1', '开启链式奇遇【沛霖与莱恩的暗线商单】']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_peilin_act2',
      phasePool: 'journey',
      chainId: 'chain_peilin_trade',
      chainName: '沛霖与莱恩的暗线商单',
      chainAct: 2,
      chainTotal: 3,
      title: '关镇货栈的药箱核对',
      tag: '关镇商路 · 暗线商单',
      iconKey: 'crate',
      icon: relIco('crate', 18),
      locationLabel: '关镇东门商队货栈',
      eligible: function (st) {
        var ch = st.encounterChains || {};
        return (st.phase === 'journey' || st.phase === 'finale') &&
          flagSafe('arrived_jikan', st) &&
          ch.peilin_trade_stage === 1 &&
          isNextQuarterReady(ch.peilin_trade_q, ch.peilin_trade_seq, st);
      },
      intro: '绕道货栈偏院时，莱恩正背着那只鼓鼓囊囊的大布包，踮脚逐箱清点发往北风堡的药材封条。见你走来，他压低声音说师父临时被关务司叫去周旋，账上有两箱防潮药材的封蜡被人动过手脚。',
      getIntro: function (st) {
        var br = st.encounterChains && st.encounterChains.peilin_trade_branch;
        if (br === 'cautious_cipher') {
          return '绕道货栈偏院时，莱恩正捏着你托驿站送来的封蜡条逐箱查验。见你走来，他松了口气，压低声音说正是照你的提醒翻查车底，才发现两箱发往北风堡的止血干草封蜡被人动过手脚。';
        }
        if (br === 'jikan_relay') {
          return '绕道货栈偏院时，莱恩正守在货车旁焦急张望。见你走来，他连忙迎上来说澄岚熟识车行提前递了口信，他抢在装车前拦下了两箱封蜡松动的防潮药材，正愁师父还在关务司脱不开身。';
        }
        if (br === 'palace_trace') {
          return '绕道货栈偏院时，莱恩背着大布包对着货单直挠头。听你报出便笺字缝里的北境急调批次，他眼睛一亮，立刻掀开苫布指着最里侧两口封蜡发潮的木箱请你一同验看。';
        }
        return '绕道货栈偏院时，莱恩正背着那只鼓鼓囊囊的大布包，踮脚逐箱清点发往北风堡的药材封条。见你走来，他压低声音说师父临时被关务司叫去周旋，账上有两箱防潮药材的封蜡被人动过手脚。';
      },
      choices: [
        {
          id: 'seal_crates_stealth',
          label: '用薄而匀的恒温水冰封稳受潮药箱，照沛霖的习惯重补验记',
          costBadge: '体力 -2 · MP -24',
          rewardBadge: '魔攻 +2 · 金币 +14 · 艾诺【极北知己】+2',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.mp < 24) return { ok: false, reason: '魔力不足' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.mp = Math.max(0, st.mp - 24);
            st.mag += 2;
            st.gold += 14;
            shiftCausalSafe('aino', 'kinship', 2, st);
            expAddSafe(60);
            markChainProgress(st, 'peilin_trade', 2, 'peilin_trade_act2', 'frost_sealed');
            recordEchoSafe({
              charId: 'aino',
              speaker: '渔',
              quote: '送去北境的药箱只要封口稳当，风雪再大也冻不坏里面的止血草。',
              context: '关镇货栈',
              weight: 2
            }, st);
            return {
              epilogue: '水雾掠过木缝化作看不出异样的微凉隔层，箱内干草立刻止住回潮。莱恩学着师父的架势仔细记下箱号，眼里满是佩服。',
              deltas: ['体力 -2', '魔力 -24', '魔攻 +2', '金币 +14', '艾诺·极北知己 +2', '推进【沛霖与莱恩的暗线商单】至第2幕']
            };
          }
        },
        {
          id: 'guard_convoy_blade',
          label: '按住剑柄替莱恩守住货栈后门，顺手拦下想趁夜混水摸鱼的脚夫',
          costBadge: '体力 -2 · HP -12',
          rewardBadge: '攻击 +3 · 霁岚【并肩远行】+2 · 经验 +64',
          canChoose: function (st) {
            if (st.st < 2) return { ok: false, reason: '需要体力 2' };
            if (st.hp <= 14) return { ok: false, reason: '生命过低' };
            return { ok: true };
          },
          apply: function (st) {
            st.st = Math.max(0, st.st - 2);
            st.hp = Math.max(1, st.hp - 12);
            st.atk += 3;
            statAddSafe('body', 2, st);
            shiftCausalSafe('jilan', 'wanderlust', 2, st);
            expAddSafe(64);
            markChainProgress(st, 'peilin_trade', 2, 'peilin_trade_act2', 'blade_escort');
            recordEchoSafe({
              charId: 'jilan',
              speaker: '渔',
              quote: '剑出鞘半寸便足以挡住歪心思，剩下的路让商车安稳走。',
              context: '关镇货栈',
              weight: 2
            }, st);
            return {
              epilogue: '铁剑出鞘半寸的清脆声响在窄院里回荡，两个贼眉鼠眼的脚夫当场丢下撬棍溜出后巷。莱恩长呼一口气，把货箱安稳搬上了车辕。',
              deltas: ['体力 -2', '生命 -12', '攻击 +3', '体能 +2', '霁岚·并肩远行 +2', '推进【沛霖与莱恩的暗线商单】至第2幕']
            };
          }
        }
      ]
    },
    {
      id: 'enc_jrn_peilin_act3',
      phasePool: 'journey',
      chainId: 'chain_peilin_trade',
      chainName: '沛霖与莱恩的暗线商单',
      chainAct: 3,
      chainTotal: 3,
      title: '北风堡商路的回礼密笺',
      tag: '北风堡 · 商路致谢',
      iconKey: 'crestPass',
      icon: relIco('crestPass', 18),
      locationLabel: '北风堡外城商栈',
      eligible: function (st) {
        var ch = st.encounterChains || {};
        return (st.phase === 'journey' || st.phase === 'finale') &&
          flagSafe('ch_distant_wind_1', st) &&
          ch.peilin_trade_stage === 2 &&
          isNextQuarterReady(ch.peilin_trade_q, ch.peilin_trade_seq, st);
      },
      intro: '沛记商队赶在封雪前顺利驶入北风堡外城。沛霖靠在茶炉旁掸去肩头雪沫，朝你抬了抬茶杯；莱恩双手抱出一只松木匣，说是药行沿途攒下的谢礼，请你挑一件趁手的凭证。',
      getIntro: function (st) {
        var a2 = st.encounterChains && st.encounterChains.peilin_trade_act2;
        if (a2 === 'frost_sealed') {
          return '沛记商队赶在封雪前驶入北风堡外城，两箱止血干草开箱时干爽完好。沛霖靠在茶炉旁朝你微抬茶杯，只夸了句手艺稳当；莱恩双手抱出松木匣，请你挑一件趁手的随行凭证。';
        }
        if (a2 === 'blade_escort') {
          return '沛记商队赶在封雪前顺利驶入北风堡外城，沿途再无人敢打药车的主意。沛霖靠在茶炉旁掸去肩头雪沫，说莱恩一路都在念叨你的剑势；少年随即抱出松木匣，请你挑一件趁手的凭证。';
        }
        return '沛记商队赶在封雪前顺利驶入北风堡外城。沛霖靠在茶炉旁掸去肩头雪沫，朝你抬了抬茶杯；莱恩双手抱出一只松木匣，说是药行沿途攒下的谢礼，请你挑一件趁手的凭证。';
      },
      choices: [
        {
          id: 'take_northwind_token',
          label: '收下沛记药行联名保举的北风堡商路木牌与押车酬金',
          costBadge: '无消耗',
          rewardBadge: '金币 +26 · 经验 +76 · 艾诺【极北知己】+1 · 解锁【北风堡木牌】',
          canChoose: function () { return { ok: true }; },
          apply: function (st) {
            st.gold += 26;
            expAddSafe(76);
            shiftCausalSafe('aino', 'kinship', 1, st);
            unlockRelic('northwind_pass', st);
            markChainProgress(st, 'peilin_trade', 3, 'peilin_trade_ending', 'pass');
            recordEchoSafe({
              charId: 'aino',
              speaker: '渔',
              quote: '沛记商队的药材平安进堡，这一路风雪总算没有白挨。',
              context: '北风堡商栈',
              weight: 3
            }, st);
            return {
              epilogue: '沛霖只说北地风硬、带块能过边卡的木牌省事，没再多添半句客套。莱恩在车辕边挥手喊着往后到了琅泽通宝街一定管够热茶。',
              deltas: ['金币 +26', '经验 +76', '艾诺·极北知己 +1', '解锁铭记【北风堡木牌】']
            };
          }
        },
        {
          id: 'take_frost_cipher',
          label: '收下沛霖托关务旧友留存的银纹联络暗徽与北线风闻录',
          costBadge: '无消耗',
          rewardBadge: '金币 +18 · 心智 +3 · 霁岚【归处暖灯】+1 · 解锁【霜封暗记】',
          canChoose: function () { return { ok: true }; },
          apply: function (st) {
            st.gold += 18;
            statAddSafe('mind', 3, st);
            expAddSafe(78);
            shiftCausalSafe('jilan', 'hearth', 1, st);
            unlockRelic('frost_cipher', st);
            markChainProgress(st, 'peilin_trade', 3, 'peilin_trade_ending', 'cipher');
            recordEchoSafe({
              charId: 'jilan',
              speaker: '渔',
              quote: '沛霖说远行之人留一枚暗记在手，往后无论回澄岚还是奔极北都有照应。',
              context: '北风堡商栈',
              weight: 3
            }, st);
            return {
              epilogue: '沛霖把小巧的银徽推过桌面，语气淡得像在闲谈天气：走远路的人留一枚暗记在手，往后回澄岚或奔极北都能少绕几圈弯路。',
              deltas: ['金币 +18', '心智 +3', '经验 +78', '霁岚·归处暖灯 +1', '解锁铭记【霜封暗记】']
            };
          }
        }
      ]
    }
  ];

  var EVENTS_BY_ID = {};
  SEASONAL_EVENTS.forEach(function (ev) { EVENTS_BY_ID[ev.id] = ev; });

  function getEligibleEvents(targetS) {
    var st = ensureRelicsState(targetS);
    if (!st) return [];
    var pool = getPhaseGroup(st);
    return SEASONAL_EVENTS.filter(function (ev) {
      return ev.phasePool === pool && ev.eligible(st);
    });
  }

  function seasonIndexOf(val) {
    if (typeof val === 'number' && isFinite(val)) {
      var n = Math.floor(val);
      return n < 0 ? 0 : (n > 3 ? n % 4 : n);
    }
    var map = { '春': 0, '夏': 1, '秋': 2, '冬': 3 };
    if (typeof val === 'string') {
      var s = val.trim();
      if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
      var parsed = parseInt(s, 10);
      if (isFinite(parsed)) return parsed < 0 ? 0 : (parsed > 3 ? parsed % 4 : parsed);
    }
    return 0;
  }

  function shuffleEventList(arr, seedNum) {
    var out = arr.slice();
    var safeSeed = (typeof seedNum === 'number' && isFinite(seedNum)) ? Math.floor(seedNum) : 0;
    for (var i = out.length - 1; i > 0; i--) {
      var r = Math.abs((safeSeed * 37 + i * 19 + Math.floor(Math.random() * 97))) % (i + 1);
      var tmp = out[i];
      out[i] = out[r];
      out[r] = tmp;
    }
    return out;
  }

  function pickBoardOffers(eligible, count, doneIds, seedNum) {
    if (!eligible || !eligible.length || count <= 0) return [];
    doneIds = doneIds || {};
    var target = Math.min(count, eligible.length);
    var nextActs = [];
    var starters = [];
    var freshRegulars = [];
    var doneRegulars = [];

    eligible.forEach(function (ev) {
      if (ev.chainId && ev.chainAct > 1) {
        if (!doneIds[ev.id]) nextActs.push(ev);
      } else if (ev.chainId && ev.chainAct === 1) {
        if (!doneIds[ev.id]) starters.push(ev);
      } else {
        if (!doneIds[ev.id]) freshRegulars.push(ev);
        else doneRegulars.push(ev);
      }
    });

    nextActs = shuffleEventList(nextActs, seedNum + 3);
    starters = shuffleEventList(starters, seedNum + 11);
    freshRegulars = shuffleEventList(freshRegulars, seedNum + 19);
    doneRegulars = shuffleEventList(doneRegulars, seedNum + 29);

    var regularTotal = freshRegulars.length + doneRegulars.length;
    var maxChainSlots = (regularTotal > 0 && target > 1) ? Math.max(1, target - 1) : target;
    var picked = [];
    var pickedIds = {};
    var chainPickedCount = 0;

    function addEvent(ev) {
      if (!ev || pickedIds[ev.id] || picked.length >= target) return false;
      picked.push(ev.id);
      pickedIds[ev.id] = true;
      if (ev.chainId) chainPickedCount++;
      return true;
    }

    // 1. 优先置入已推进链式奇遇的后续幕（第2/3幕），但至少为常规奇遇留出空位
    for (var a = 0; a < nextActs.length && chainPickedCount < maxChainSlots; a++) {
      addEvent(nextActs[a]);
    }

    // 2. 若当前无待续的后续幕，在常规奇遇与未开启第1幕间温和混排（第1幕至多占 1 格）
    if (picked.length < target && chainPickedCount === 0 && starters.length && regularTotal > 0) {
      var regularBase = freshRegulars.length ? freshRegulars : doneRegulars;
      var mixed = shuffleEventList(regularBase.concat(starters), seedNum + 41);
      for (var m = 0; m < mixed.length && picked.length < target; m++) {
        var cand = mixed[m];
        if (cand.chainId && chainPickedCount >= 1) continue;
        addEvent(cand);
      }
    }

    // 3. 依次以新鲜常规、已历常规、未开第1幕补齐余位
    [freshRegulars, doneRegulars, starters, nextActs].forEach(function (bucket) {
      for (var k = 0; k < bucket.length && picked.length < target; k++) {
        var ev = bucket[k];
        var regPicked = picked.length - chainPickedCount;
        if (ev.chainId && chainPickedCount >= maxChainSlots && regularTotal > regPicked) continue;
        addEvent(ev);
      }
    });

    for (var z = 0; z < eligible.length && picked.length < target; z++) {
      addEvent(eligible[z]);
    }
    return picked;
  }

  function refreshSeasonalBoard(targetS, opts) {
    opts = opts || {};
    var st = ensureRelicsState(targetS);
    if (!st) return { key: '0:0', offers: [], done: {}, rerolled: false };
    var qk = getQuarterKey(st);
    var eligible = getEligibleEvents(st);
    var seed = (st.year || 0) * 13 + seasonIndexOf(st.season) * 7 + (st.dayCount || 0);
    var wantCount = Math.min(3, Math.max(2, eligible.length));
    var offers = pickBoardOffers(eligible, wantCount, st.encounterHistory || {}, seed);
    st.seasonalBoard = {
      key: qk,
      offers: offers,
      done: {},
      rerolled: !!opts.rerolled
    };
    persistSafe();
    return st.seasonalBoard;
  }

  function getSeasonalBoard(targetS) {
    var st = ensureRelicsState(targetS);
    if (!st) return { key: '0:0', offers: [], done: {}, rerolled: false };
    var qk = getQuarterKey(st);
    var board = st.seasonalBoard;
    if (!board || board.key !== qk || !Array.isArray(board.offers) || !board.offers.length) {
      return refreshSeasonalBoard(st);
    }
    // 过滤掉因跨阶段或剧情推进而不再符合当前时间线条件的残留事件；本季刚完成的链式奇遇保留已历展示
    var pool = getPhaseGroup(st);
    var validOffers = board.offers.filter(function (id) {
      var ev = EVENTS_BY_ID[id];
      return ev && ev.phasePool === pool && ((board.done && board.done[id]) || ev.eligible(st));
    });
    if (!validOffers.length) {
      return refreshSeasonalBoard(st);
    }
    board.offers = validOffers;
    return board;
  }

  function rerollSeasonalBoard(targetS) {
    var st = ensureRelicsState(targetS);
    if (!st) return { ok: false, reason: 'no_state' };
    var board = getSeasonalBoard(st);
    if (board.rerolled) return { ok: false, reason: 'already_rerolled' };
    if (st.st < 1) return { ok: false, reason: 'no_stamina' };
    st.st = Math.max(0, st.st - 1);
    var nextBoard = refreshSeasonalBoard(st, { rerolled: true });
    updateHudSafe();
    persistSafe();
    return { ok: true, board: nextBoard };
  }

  function resolveEncounterChoice(eventId, choiceIdx, targetS) {
    var st = ensureRelicsState(targetS);
    if (!st) return { ok: false, reason: 'no_state' };
    var ev = EVENTS_BY_ID[eventId];
    if (!ev) return { ok: false, reason: 'missing_event' };
    var board = getSeasonalBoard(st);
    if (board.done && board.done[eventId]) {
      return { ok: false, reason: 'already_done' };
    }
    if (ev.phasePool !== getPhaseGroup(st) || !ev.eligible(st)) {
      return { ok: false, reason: 'ineligible' };
    }
    var ch = ev.choices[choiceIdx];
    if (!ch) return { ok: false, reason: 'bad_choice' };
    var gate = ch.canChoose(st);
    if (!gate.ok) return { ok: false, reason: gate.reason || 'condition_failed' };

    var outcome = ch.apply(st) || {};
    board.done = board.done || {};
    board.done[eventId] = true;
    st.encounterHistory = st.encounterHistory || {};
    st.encounterHistory[eventId] = (st.encounterHistory[eventId] || 0) + 1;
    updateHudSafe();
    persistSafe();
    return {
      ok: true,
      event: ev,
      choice: ch,
      epilogue: outcome.epilogue || '',
      deltas: outcome.deltas || []
    };
  }

  /* =========================================================================
     四、UI 渲染：综合面板「✦ 随身铭记」 / 演武沙盒配装条 / 「✦ 季度奇遇」弹窗
     ========================================================================= */
  function renderSynergyStripHTML(equipped) {
    var progress = getSynergyProgress(equipped);
    var activeCards = [];
    var nearCards = [];
    var dormantChips = [];

    progress.forEach(function (p) {
      if (p.active) {
        var topTier = p.tiersActive[p.tiersActive.length - 1];
        var activeLines = p.tiersActive.map(function (t) {
          var td = p.tiers[t];
          return '<div class="rsc-fx"><b>' + t + '件 · ' + escapeHtml(td.name) + '</b>：' + escapeHtml(td.desc) + '</div>';
        }).join('');
        var nextLine = p.nextTier && p.nextTierDef
          ? '<div class="rsc-next">再佩带 1 件（' + p.count + '/' + p.nextTier + '）解锁【' + escapeHtml(p.nextTierDef.name) + '】：' + escapeHtml(p.nextTierDef.shortDesc) + '</div>'
          : '';
        activeCards.push(
          '<div class="rel-syn-card active" data-synergy-id="' + p.id + '" style="--syn-accent:' + p.color + '">' +
            '<div class="rsc-top">' +
              '<span class="rsc-name">' + relIco(p.iconKey || 'star', 14) + '<span>' + escapeHtml(p.name) + '</span></span>' +
              '<span class="rsc-pill">✦ ' + p.count + '/' + p.maxThreshold + ' · ' + escapeHtml(p.tiers[topTier].name) + '</span>' +
            '</div>' +
            activeLines +
            nextLine +
          '</div>'
        );
      } else if (p.count === 1 && p.nextTierDef) {
        nearCards.push(
          '<div class="rel-syn-card near" data-synergy-id="' + p.id + '" style="--syn-accent:' + p.color + '">' +
            '<div class="rsc-top">' +
              '<span class="rsc-name">' + relIco(p.iconKey || 'star', 14) + '<span>' + escapeHtml(p.name) + '</span></span>' +
              '<span class="rsc-pill">1/' + p.nextTier + ' · 差 1 件共鸣</span>' +
            '</div>' +
            '<div class="rsc-fx">2件【' + escapeHtml(p.nextTierDef.name) + '】：' + escapeHtml(p.nextTierDef.shortDesc) + '</div>' +
          '</div>'
        );
      } else {
        var t2 = p.tiers[2];
        var tip = p.name + '（2件·' + t2.name + '：' + t2.shortDesc + '）';
        dormantChips.push(
          '<span class="rel-syn-dormant-chip" data-synergy-id="' + p.id + '" title="' + escapeHtml(tip) + '">' +
            relIco(p.iconKey || 'star', 13) + '<span>' + escapeHtml(p.name) + ' 0/2</span>' +
          '</span>'
        );
      }
    });

    var cards = activeCards.concat(nearCards);
    var summaryText = activeCards.length
      ? '已激活 ' + activeCards.length + ' 项套装共鸣'
      : (nearCards.length ? '再佩带 1 件同主题铭记即可激活共鸣' : '佩带同主题 2～3 件秘宝触发质变共鸣');

    return (
      '<div class="rel-synergy-strip" id="rel-synergy-strip">' +
        '<div class="rel-syn-head">' +
          '<span class="rel-syn-title">' + relIco('star', 14) + '<span>套装共鸣</span></span>' +
          '<span class="rel-syn-summary">' + escapeHtml(summaryText) + '</span>' +
        '</div>' +
        (cards.length ? '<div class="rel-syn-grid">' + cards.join('') + '</div>' : '') +
        (dormantChips.length ? '<div class="rel-syn-dormant-row">' + dormantChips.join('') + '</div>' : '') +
      '</div>'
    );
  }

  function renderArenaStaffStripHTML() {
    var activeStaff = getArenaSandboxStaff();
    var activeDef = ARENA_STAVES_CATALOG[activeStaff] || ARENA_STAVES_CATALOG.none;
    var cardsHtml = ARENA_STAFF_ORDER.map(function (sid) {
      var def = ARENA_STAVES_CATALOG[sid];
      var active = activeStaff === sid;
      var isBarehand = sid === 'none';
      var hasArt = !isBarehand && hasRelicArt(sid);
      var artHtml = isBarehand
        ? renderBarehandPrismSVG(48, 'staff-art-prism')
        : renderRelicArt(sid, relIco(def.fallbackKey || 'star', 24), 48, 'staff-art-img');
      return (
        '<button type="button" class="arena-staff-card' + (active ? ' is-active' : '') + (isBarehand ? ' is-barehand' : '') + '" ' +
          'data-arena-staff="' + sid + '" aria-pressed="' + (active ? 'true' : 'false') + '" ' +
          'title="' + escapeHtml(def.name + '：' + def.desc) + '">' +
          '<span class="asc-staff-art' + (hasArt ? ' has-item-art' : ' is-prism') + '">' + artHtml + '</span>' +
          '<span class="asc-staff-body">' +
            '<span class="asc-staff-top">' +
              '<b class="asc-staff-name">' + escapeHtml(def.name) + '</b>' +
              '<span class="asc-staff-state' + (active ? ' is-active' : '') + '">' + (active ? '已执握' : '点选') + '</span>' +
            '</span>' +
            '<span class="asc-staff-desc">' + escapeHtml(def.desc) + '</span>' +
          '</span>' +
        '</button>'
      );
    }).join('');

    return (
      '<section class="arena-staff-strip" id="arena-staff-strip" aria-label="演武法杖整备">' +
        '<div class="ass-head">' +
          '<span class="ass-title">' + relIco('prism', 14) + '<span>法杖整备</span></span>' +
          '<span class="ass-summary">当前执杖：<b>' + escapeHtml(activeDef.name) + '</b></span>' +
        '</div>' +
        '<div class="ass-grid">' + cardsHtml + '</div>' +
      '</section>'
    );
  }

  function renderRelicsAndAssistHTML(opts) {
    opts = opts || {};
    var isSandbox = !!opts.sandbox;
    var st = ensureRelicsState(opts.state);
    var equipped = isSandbox ? getArenaSandboxRelics() : (st ? st.equippedRelics : []);
    var unlockedList = isSandbox ? RELIC_ORDER.slice() : getUnlockedRelicIds(st);

    var slotsHtml = [0, 1, 2].map(function (idx) {
      var rid = equipped[idx];
      var def = rid ? RELICS_CATALOG[rid] : null;
      if (!def) {
        return '<div class="rel-slot empty"><span>空铭记槽位 ' + (idx + 1) + '</span><small>点击下方已解锁秘宝佩带</small></div>';
      }
      var syn = def.setId ? RELIC_SYNERGIES[def.setId] : null;
      var slotHasArt = hasRelicArt(def.id);
      var slotArtHtml = renderRelicArt(def.id, def.icon, 44, 'rel-slot-art');
      return (
        '<div class="rel-slot filled" data-relic-unequip="' + def.id + '">' +
          '<div class="rel-slot-top">' +
            '<span class="rel-ico' + (slotHasArt ? ' has-item-art' : '') + '">' + slotArtHtml + '</span>' +
            '<div class="rel-slot-meta">' +
              '<b>' + escapeHtml(def.name) + '</b>' +
              (syn ? '<span class="rc-set-badge" data-set-id="' + syn.id + '" style="--syn-accent:' + syn.color + '">' + escapeHtml(syn.name) + '</span>' : '') +
            '</div>' +
            '<button type="button" class="rel-mini-btn" data-relic-toggle="' + def.id + '">卸下</button>' +
          '</div>' +
          '<div class="rel-slot-fx">' + escapeHtml(def.effectText) + '</div>' +
        '</div>'
      );
    }).join('');

    var cardsHtml = RELIC_ORDER.map(function (id) {
      var def = RELICS_CATALOG[id];
      var syn = def.setId ? RELIC_SYNERGIES[def.setId] : null;
      var unlocked = unlockedList.indexOf(id) !== -1;
      var isEq = equipped.indexOf(id) !== -1;
      var cardHasArt = hasRelicArt(id);
      var cardIcoHtml = cardHasArt
        ? ('<span class="rc-ico has-item-art' + (unlocked ? '' : ' is-locked') + '">' +
            renderRelicArt(id, unlocked ? def.icon : relIco('lock', 16), 44, 'rel-card-art') +
            (unlocked ? '' : '<span class="rc-ico-lock" aria-hidden="true">' + relIco('lock', 11) + '</span>') +
          '</span>')
        : ('<span class="rc-ico">' + (unlocked ? def.icon : relIco('lock', 16)) + '</span>');
      return (
        '<article class="rel-card' + (unlocked ? '' : ' locked') + (isEq ? ' equipped' : '') + '" data-relic-id="' + id + '">' +
          '<div class="rc-head">' +
            cardIcoHtml +
            '<div class="rc-titles">' +
              '<div class="rc-name">' + escapeHtml(def.name) +
                (syn ? '<span class="rc-set-badge" data-set-id="' + syn.id + '" style="--syn-accent:' + syn.color + '">' + relIco(syn.iconKey || 'star', 12) + '<span>' + escapeHtml(syn.name) + '</span></span>' : '') +
              '</div>' +
              '<div class="rc-owner">' + escapeHtml(def.owner) + ' · ' + escapeHtml(def.tag) + '</div>' +
            '</div>' +
            (unlocked
              ? '<button type="button" class="rel-act-btn' + (isEq ? ' on' : '') + '" data-relic-toggle="' + id + '">' + (isEq ? '卸下' : '佩带') + '</button>'
              : '<span class="rc-lock-tag">未解锁</span>') +
          '</div>' +
          '<div class="rc-effect">' + escapeHtml(unlocked ? def.effectText : def.unlockHint) + '</div>' +
          (unlocked ? '<div class="rc-lore">' + escapeHtml(def.lore) + '</div>' : '') +
        '</article>'
      );
    }).join('');

    // 羁绊心念援护选区
    var assistUnlocked = isSandbox ? BOND_ORDER.slice() : getUnlockedBondAssists(st);
    var activeAssist = isSandbox ? getArenaSandboxAssist() : getActiveBondAssistForBattle({ state: st });

    var assistHtml = BOND_ORDER.map(function (cid) {
      var ba = BOND_ASSISTS[cid];
      var ok = assistUnlocked.indexOf(cid) !== -1;
      var active = !!(ok && activeAssist && activeAssist === cid);
      var stateCls = active ? 'is-active' : (ok ? 'is-ready' : 'is-locked');
      var stateText = active ? '出战中' : (ok ? '点选出战' : '未解锁');
      var desc = ok ? ba.effectDesc : '与该角色积累好感或命运暗流后解锁心念援护';
      return (
        '<button type="button" class="bond-chip' + (active ? ' active' : '') + (ok ? '' : ' locked') + '" ' +
          'aria-pressed="' + (active ? 'true' : 'false') + '" data-bond-state="' + stateCls + '" ' +
          'title="' + escapeHtml(ba.name + ' · ' + ba.title + '：' + desc) + '" ' +
          (ok ? 'data-assist-pick="' + cid + '"' : 'disabled') + '>' +
          '<span class="bc-top">' +
            '<span class="bc-title-wrap">' + ba.icon + '<b>' + escapeHtml(ba.name) + ' · ' + escapeHtml(ba.title) + '</b></span>' +
            '<span class="bond-state-pill ' + stateCls + '">' + stateText + '</span>' +
          '</span>' +
          '<span class="bc-desc">' + escapeHtml(desc) + '</span>' +
        '</button>'
      );
    }).join('');

    return (
      '<div class="relics-dashboard' + (isSandbox ? ' is-sandbox' : '') + '">' +
        (!isSandbox
          ? '<div class="rel-banner">' +
              '<div>' +
                '<b>✦ 随身铭记秘宝（' + equipped.length + ' / ' + MAX_EQUIPPED_RELICS + '）</b>' +
                '<span>佩带至多 3 件信物，实时改变战斗魔战节奏与破招规则</span>' +
              '</div>' +
            '</div>'
          : renderArenaStaffStripHTML()) +
        renderSynergyStripHTML(equipped) +
        '<div class="rel-slots-grid">' + slotsHtml + '</div>' +
        '<h4 class="rel-sec-title">✦ 羁绊心念援护（战斗中每场 1 次 · 0 AP）</h4>' +
        '<div class="bond-grid">' + assistHtml + '</div>' +
        '<h4 class="rel-sec-title">◈ 铭记典藏图录（' + unlockedList.length + ' / ' + RELIC_ORDER.length + '）</h4>' +
        '<div class="rel-cards-grid">' + cardsHtml + '</div>' +
      '</div>'
    );
  }

  function renderRelicsPanelHTML(targetS) {
    return renderRelicsAndAssistHTML({ sandbox: false, state: targetS });
  }

  function bindRelicsContainerEvents(container, opts) {
    if (!container) return;
    opts = opts || {};
    container.querySelectorAll('[data-arena-staff]').forEach(function (btn) {
      btn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var sid = btn.getAttribute('data-arena-staff');
        setArenaSandboxStaff(sid);
        if (typeof window !== 'undefined' && typeof window.sfx === 'function') window.sfx('tab_switch');
        if (typeof opts.onChanged === 'function') opts.onChanged();
      };
    });
    container.querySelectorAll('[data-relic-toggle]').forEach(function (btn) {
      btn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var rid = btn.getAttribute('data-relic-toggle');
        toggleEquipRelic(rid, { sandbox: !!opts.sandbox, state: opts.state });
        if (typeof opts.onChanged === 'function') opts.onChanged();
      };
    });
    container.querySelectorAll('[data-assist-pick]').forEach(function (btn) {
      btn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var cid = btn.getAttribute('data-assist-pick');
        var cur = opts.sandbox ? getArenaSandboxAssist() : (ensureRelicsState(opts.state) || {}).selectedBondAssist;
        selectBondAssist(cur === cid && opts.sandbox ? null : cid, { sandbox: !!opts.sandbox, state: opts.state });
        if (typeof opts.onChanged === 'function') opts.onChanged();
      };
    });
  }

  function renderArenaLoadoutBarHTML() {
    var staffId = getArenaSandboxStaff();
    var staffMeta = ARENA_STAVES_CATALOG[staffId] || ARENA_STAVES_CATALOG.none;
    var staffHasArt = staffId !== 'none' && hasRelicArt(staffId);
    var staffMicro = staffId === 'none'
      ? renderBarehandPrismSVG(20, 'alb-micro-prism')
      : renderRelicArt(staffId, relIco(staffMeta.fallbackKey || 'star', 14), 20, 'alb-micro-img');
    var staffPill =
      '<span class="arena-rel-pill staff' + (staffId !== 'none' ? ' is-equipped' : ' is-barehand') + '" data-arena-staff-pill="' + staffId + '" title="' + escapeHtml(staffMeta.name + '：' + staffMeta.desc) + '">' +
        '<span class="alb-micro-art' + (staffHasArt ? ' has-item-art' : '') + '">' + staffMicro + '</span>' +
        '<span>' + escapeHtml(staffMeta.name) + '</span>' +
      '</span>';

    var equipped = getArenaSandboxRelics();
    var activeSyns = getActiveSynergies(equipped);
    var assist = getArenaSandboxAssist();
    var assistMeta = assist ? BOND_ASSISTS[assist] : null;
    var chips = equipped.length
      ? equipped.map(function (id) {
          var r = RELICS_CATALOG[id];
          var rHasArt = hasRelicArt(id);
          var rMicro = renderRelicArt(id, r.icon, 20, 'alb-micro-img');
          return (
            '<span class="arena-rel-pill relic" data-arena-relic-pill="' + id + '">' +
              '<span class="alb-micro-art' + (rHasArt ? ' has-item-art' : '') + '">' + rMicro + '</span>' +
              '<span>' + escapeHtml(r.name) + '</span>' +
            '</span>'
          );
        }).join('')
      : '<span class="arena-rel-empty">未佩随身铭记（素身试演）</span>';
    var synPills = activeSyns.map(function (syn) {
      return (
        '<span class="arena-rel-pill synergy" data-synergy-id="' + syn.id + '" title="' + escapeHtml(syn.shortDesc) + '">' +
          relIco(syn.iconKey || 'star', 13) + '<span>' + escapeHtml(syn.name) + '·' + escapeHtml(syn.tierName) + ' (' + syn.count + '件)</span>' +
        '</span>'
      );
    }).join('');
    var hasAnyCustom = !!(equipped.length || assist || staffId !== 'none');

    return (
      '<div class="arena-loadout-bar" id="arena-loadout-bar">' +
        '<div class="alb-left">' +
          '<span class="alb-label">✦ 战前整备：</span>' +
          staffPill +
          chips +
          synPills +
          (assistMeta ? '<span class="arena-rel-pill bond">' + assistMeta.icon + '<span>援护·' + escapeHtml(assistMeta.name) + '</span></span>' : '') +
        '</div>' +
        '<div class="alb-actions">' +
          '<button type="button" class="arena-mode-chip" id="am-open-loadout">✦ 法杖 / 12 秘宝 / 援护 (' + equipped.length + '/3)</button>' +
          (hasAnyCustom ? '<button type="button" class="arena-mode-chip" id="am-clear-loadout">恢复素装</button>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function syncArenaLoadoutBarDom() {
    if (typeof document === 'undefined') return;
    var existingBar = document.getElementById('arena-loadout-bar');
    if (!existingBar || !existingBar.parentNode) return;
    var oldOpen = existingBar.querySelector('#am-open-loadout');
    var oldClear = existingBar.querySelector('#am-clear-loadout');
    var oldOpenClick = oldOpen ? oldOpen.onclick : null;
    var oldClearClick = oldClear ? oldClear.onclick : null;
    var holder = document.createElement('div');
    holder.innerHTML = renderArenaLoadoutBarHTML();
    var nextBar = holder.firstElementChild;
    if (!nextBar) return;
    existingBar.parentNode.replaceChild(nextBar, existingBar);
    var newOpen = nextBar.querySelector('#am-open-loadout');
    var newClear = nextBar.querySelector('#am-clear-loadout');
    if (newOpen && oldOpenClick) newOpen.onclick = oldOpenClick;
    if (newClear) {
      if (oldClearClick) {
        newClear.onclick = function () {
          setArenaSandboxStaff('none');
          oldClearClick();
        };
      } else {
        newClear.onclick = function () {
          setArenaSandboxStaff('none');
          setArenaSandboxRelics([]);
          setArenaSandboxAssist(null);
          syncArenaLoadoutBarDom();
        };
      }
    }
  }

  function closeArenaLoadoutModal() {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('arena-loadout-modal');
    if (ov && !ov.classList.contains('hidden')) {
      ov.classList.add('hidden');
      if (typeof window !== 'undefined' && typeof window.sfx === 'function') window.sfx('modal_close');
    }
  }

  function openArenaLoadoutModal(onUpdated) {
    if (typeof document === 'undefined') return;
    var ov = document.getElementById('arena-loadout-modal');
    if (!ov) {
      ov = document.createElement('section');
      ov.id = 'arena-loadout-modal';
      ov.className = 'overlay';
      document.body.appendChild(ov);
    }
    ov.onclick = function (e) { if (e && e.target === ov) closeArenaLoadoutModal(); };
    var notifyUpdated = function () {
      if (typeof onUpdated === 'function') {
        onUpdated();
      } else {
        syncArenaLoadoutBarDom();
      }
    };
    var redraw = function () {
      var prevScroll = ov.querySelector('.rumor-scroll');
      var savedTop = prevScroll ? prevScroll.scrollTop : 0;
      var staffId = getArenaSandboxStaff();
      var staffMeta = ARENA_STAVES_CATALOG[staffId] || ARENA_STAVES_CATALOG.none;
      var equipped = getArenaSandboxRelics();
      var assistId = getArenaSandboxAssist();
      var assistMeta = assistId ? BOND_ASSISTS[assistId] : null;
      var hasAnyCustom = !!(equipped.length || assistId || staffId !== 'none');
      ov.classList.remove('hidden');
      ov.innerHTML =
        '<div class="end-card rumor-card alm-loadout-shell">' +
          '<div class="rumor-head">' +
            '<div><h2>✦ 演武整备 · 法杖与随身铭记</h2><p class="rumor-sub">自由择执试炼法杖，并佩带随身铭记与伙伴心念援护（不涉主途行囊）</p></div>' +
            '<div class="rumor-head-actions">' +
              '<button type="button" class="modal-close-x" id="alm-close-x" aria-label="关闭铭记整备">×</button>' +
            '</div>' +
          '</div>' +
          '<div class="alm-body-wrap">' +
            '<div class="rumor-scroll">' + renderRelicsAndAssistHTML({ sandbox: true }) + '</div>' +
            '<div class="alm-scroll-fade" aria-hidden="true"></div>' +
          '</div>' +
          '<div class="modal-foot end-btns alm-foot">' +
            '<span class="alm-foot-meta">执杖：<b>' + escapeHtml(staffMeta.name) + '</b> · 秘宝 <b>' + equipped.length + ' / ' + MAX_EQUIPPED_RELICS + '</b> · 援护：<b>' + (assistMeta ? escapeHtml(assistMeta.name) : '未选定') + '</b></span>' +
            '<div class="alm-foot-actions">' +
              (hasAnyCustom ? '<button type="button" class="tbtn ghost" id="alm-clear-all">恢复素装</button>' : '') +
              '<button type="button" class="tbtn primary" id="alm-close-done">完成整备</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      var scrollBox = ov.querySelector('.rumor-scroll');
      var fadeEl = ov.querySelector('.alm-scroll-fade');
      if (scrollBox) {
        if (savedTop > 0) scrollBox.scrollTop = savedTop;
        if (fadeEl) {
          var syncAlmFade = function () {
            var hasOverflow = scrollBox.scrollHeight - scrollBox.clientHeight > 10;
            var atEnd = !hasOverflow || (scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 8);
            fadeEl.classList.toggle('is-end', atEnd);
          };
          scrollBox.addEventListener('scroll', syncAlmFade, { passive: true });
          syncAlmFade();
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(syncAlmFade);
          }
        }
      }
      bindRelicsContainerEvents(ov, {
        sandbox: true,
        onChanged: function () {
          redraw();
          notifyUpdated();
        }
      });
      var clearBtn = ov.querySelector('#alm-clear-all');
      if (clearBtn) {
        clearBtn.onclick = function () {
          setArenaSandboxStaff('none');
          setArenaSandboxRelics([]);
          setArenaSandboxAssist(null);
          redraw();
          notifyUpdated();
        };
      }
      var closeX = ov.querySelector('#alm-close-x');
      if (closeX) closeX.onclick = closeArenaLoadoutModal;
      var closeDone = ov.querySelector('#alm-close-done');
      if (closeDone) closeDone.onclick = closeArenaLoadoutModal;
    };
    redraw();
  }

  function ensureRumorModal() {
    if (typeof document === 'undefined') return null;
    var el = document.getElementById('rumor-overlay');
    if (!el) {
      el = document.createElement('section');
      el.id = 'rumor-overlay';
      el.className = 'overlay hidden';
      document.body.appendChild(el);
    }
    return el;
  }

  function closeRumorBoard() {
    var el = typeof document !== 'undefined' ? document.getElementById('rumor-overlay') : null;
    if (el && !el.classList.contains('hidden')) {
      el.classList.add('hidden');
      if (typeof window !== 'undefined' && typeof window.sfx === 'function') window.sfx('modal_close');
    }
  }

  function formatChainBadgeHTML(ev) {
    if (!ev || !ev.chainId || !ev.chainAct) return '';
    var tip = ev.chainName ? (ev.chainName + '（共 ' + (ev.chainTotal || ev.chainAct) + ' 幕）') : '';
    return '<span class="roc-chain-pill" title="' + escapeHtml(tip) + '">链式奇遇 · 第' + ev.chainAct + '幕</span>';
  }

  function formatEventStCost(ev) {
    if (!ev || !Array.isArray(ev.choices) || !ev.choices.length) return '无体力消耗';
    var costs = [];
    var hasFree = false;
    ev.choices.forEach(function (ch) {
      var badge = String((ch && ch.costBadge) || '');
      var m = badge.match(/体力\s*-?\s*(\d+)/);
      if (m) {
        costs.push(Number(m[1]));
      } else if (badge.indexOf('无消耗') !== -1) {
        hasFree = true;
      }
    });
    if (!costs.length) return '无体力消耗';
    var min = Math.min.apply(null, costs);
    var max = Math.max.apply(null, costs);
    if (hasFree) return '体力 0–' + max;
    if (min === max) return '体力 ' + min;
    return '体力 ' + min + '–' + max;
  }

  function renderEventTagsHTML(ev, st, hasPalaceOpt) {
    var html = formatChainBadgeHTML(ev);
    var parts = String((ev && ev.tag) || '').split(' · ').filter(Boolean);
    if (parts.length > 0) {
      html += '<span class="roc-tag-place">' + escapeHtml(parts[0]) + '</span>';
    }
    if (parts.length > 1) {
      var seg1 = parts.slice(1).join(' · ');
      var isRisk = /高危|风险|极限|急救/.test(seg1);
      html += '<span class="roc-tag-pill ' + (isRisk ? 'is-risk' : 'is-normal') + '">' + escapeHtml(seg1) + '</span>';
    }
    if (hasPalaceOpt && hasSkillSafe('ice_palace', st)) {
      html += '<span class="roc-tag-pill is-palace">' + relIco('star', 12) + '<span>含冰宫洞察</span></span>';
    }
    html += '<span class="roc-cost-pill">' + relIco('bolt', 12) + '<span>' + escapeHtml(formatEventStCost(ev)) + '</span></span>';
    return html;
  }

  function openRumorBoard(activeEventId, resolvedOutcome) {
    if (typeof document === 'undefined') return null;
    var st = ensureRelicsState();
    if (!st) return null;
    var el = ensureRumorModal();
    if (!el) return null;
    el.onclick = function (e) { if (e && e.target === el) closeRumorBoard(); };

    var board = getSeasonalBoard(st);
    var seasonNames = ['春', '夏', '秋', '冬'];
    var phaseTitle = getPhaseGroup(st) === 'academy' ? '魔法学院日常传闻' : getPhaseGroup(st) === 'journey' ? '澄岚与北境风闻' : '公爵府与领地传闻';

    if (resolvedOutcome && resolvedOutcome.ok) {
      var evDone = resolvedOutcome.event;
      var nextHint = (evDone.chainId && evDone.chainTotal && evDone.chainAct < evDone.chainTotal)
        ? '<span class="rumor-delta-chip">✦ 链式奇遇后续将在往后季度浮现</span>'
        : '';
      el.innerHTML =
        '<div class="end-card rumor-card">' +
          '<div class="rumor-head">' +
            '<div>' +
              (evDone.chainId ? '<span class="rumor-kicker">' + formatChainBadgeHTML(evDone) + escapeHtml(evDone.chainName || '') + '</span>' : '') +
              '<h2>' + evDone.icon + ' ' + escapeHtml(evDone.title) + '</h2>' +
              '<p class="rumor-sub">' + escapeHtml(evDone.locationLabel) + '</p>' +
            '</div>' +
            '<button type="button" class="modal-close-x" id="rb-close-x" aria-label="关闭季度传闻板">×</button>' +
          '</div>' +
          '<div class="rumor-story-box">' +
            '<p class="rumor-epilogue">' + escapeHtml(resolvedOutcome.epilogue) + '</p>' +
            '<div class="rumor-deltas">' +
              (resolvedOutcome.deltas || []).map(function (d) { return '<span class="rumor-delta-chip">✦ ' + escapeHtml(d) + '</span>'; }).join('') +
              nextHint +
            '</div>' +
          '</div>' +
          '<div class="end-btns">' +
            '<button type="button" class="tbtn" id="rb-back-board">返回季度传闻板</button>' +
            '<button type="button" class="tbtn ghost" id="rb-close">合上卷宗</button>' +
          '</div>' +
        '</div>';
      el.classList.remove('hidden');
      el.querySelector('#rb-back-board').onclick = function () { openRumorBoard(); };
      el.querySelector('#rb-close').onclick = function () { closeRumorBoard(); };
      var closeX1 = el.querySelector('#rb-close-x');
      if (closeX1) closeX1.onclick = function () { closeRumorBoard(); };
      return el;
    }

    if (activeEventId && EVENTS_BY_ID[activeEventId]) {
      var ev = EVENTS_BY_ID[activeEventId];
      var introText = typeof ev.getIntro === 'function' ? ev.getIntro(st) : ev.intro;
      var choicesHtml = ev.choices.map(function (ch, idx) {
        var gate = ch.canChoose(st);
        return (
          '<button type="button" class="rumor-choice-btn' + (ch.requiresIcePalace ? ' palace' : '') + (gate.ok ? '' : ' disabled') + '" ' +
            (gate.ok ? 'data-enc-pick="' + idx + '"' : 'disabled') + '>' +
            '<div class="rcb-main">' + (ch.requiresIcePalace ? relIco('snowflake', 14) + ' ' : '') + escapeHtml(ch.label) + '</div>' +
            '<div class="rcb-meta">' +
              '<span class="rcb-cost">' + escapeHtml(ch.costBadge) + '</span>' +
              '<span class="rcb-reward">' + escapeHtml(gate.ok ? ch.rewardBadge : gate.reason) + '</span>' +
            '</div>' +
          '</button>'
        );
      }).join('');

      el.innerHTML =
        '<div class="end-card rumor-card">' +
          '<div class="rumor-head">' +
            '<div>' +
              '<span class="rumor-kicker">' + formatChainBadgeHTML(ev) + escapeHtml(ev.tag) + ' · ' + escapeHtml(ev.locationLabel) + '</span>' +
              '<h2>' + ev.icon + ' ' + escapeHtml(ev.title) + '</h2>' +
            '</div>' +
            '<div class="rumor-head-actions">' +
              '<button type="button" class="tbtn ghost rumor-head-btn" id="rb-back-board">返回</button>' +
              '<button type="button" class="modal-close-x" id="rb-close-x" aria-label="关闭季度传闻板">×</button>' +
            '</div>' +
          '</div>' +
          '<div class="rumor-story-box"><p class="rumor-intro">' + escapeHtml(introText) + '</p></div>' +
          '<div class="rumor-choices-col">' + choicesHtml + '</div>' +
        '</div>';
      el.classList.remove('hidden');
      el.querySelector('#rb-back-board').onclick = function () { openRumorBoard(); };
      var closeX2 = el.querySelector('#rb-close-x');
      if (closeX2) closeX2.onclick = function () { closeRumorBoard(); };
      el.querySelectorAll('[data-enc-pick]').forEach(function (btn) {
        btn.onclick = function () {
          var idx = Number(btn.getAttribute('data-enc-pick'));
          var res = resolveEncounterChoice(ev.id, idx, st);
          if (res.ok) {
            if (typeof sfx === 'function') sfx('ok');
            openRumorBoard(null, res);
          } else {
            toastSafe(res.reason || '当前条件不足');
          }
        };
      });
      return el;
    }

    var offerCards = board.offers.map(function (eid) {
      var ev = EVENTS_BY_ID[eid];
      if (!ev) return '';
      var done = !!(board.done && board.done[eid]);
      var hasPalaceOpt = ev.choices.some(function (c) { return !!c.requiresIcePalace; });
      var previewText = typeof ev.getIntro === 'function' ? ev.getIntro(st) : ev.intro;
      return (
        '<article class="rumor-offer-card' + (ev.chainId ? ' chain' : '') + (done ? ' done' : '') + '">' +
          '<div class="roc-top">' +
            '<span class="roc-ico">' + relIco(ev.iconKey || 'star', 18) + '</span>' +
            '<div class="roc-info">' +
              '<div class="roc-tag">' + renderEventTagsHTML(ev, st, hasPalaceOpt) + '</div>' +
              '<div class="roc-title">' + escapeHtml(ev.title) + '</div>' +
            '</div>' +
            (done ? '<span class="roc-done-pill">✓ 本季已历</span>' : '<button type="button" class="tbtn roc-go-btn" data-open-enc="' + ev.id + '">前往查探</button>') +
          '</div>' +
          '<p class="roc-preview">' + escapeHtml(previewText) + '</p>' +
        '</article>'
      );
    }).join('');

    el.innerHTML =
      '<div class="end-card rumor-card">' +
        '<div class="rumor-head">' +
          '<div>' +
            '<span class="rumor-kicker">' + (st.year || 0) + '年 ' + (seasonNames[seasonIndexOf(st.season)] || '春') + '季 · ' + phaseTitle + '</span>' +
            '<h2>✦ 季度奇遇与传闻板</h2>' +
            '<p class="rumor-sub">每季随行踪刷新传闻。抉择伴随消耗与代价，冰晶宫殿有时能看穿隐秘伏笔。</p>' +
          '</div>' +
          '<button type="button" class="modal-close-x" id="rb-close-x" aria-label="关闭季度传闻板">×</button>' +
        '</div>' +
        '<div class="rumor-scroll">' + (offerCards || '<p class="rumor-empty">本季暂时风平浪静，推进到下个季度试试看吧。</p>') + '</div>' +
        '<div class="end-btns">' +
          '<button type="button" class="tbtn ghost" id="rb-reroll" ' + (board.rerolled || st.st < 1 ? 'disabled' : '') + '>' +
            (board.rerolled ? '本季已探听过新风声' : '↻ 另探风声（体力 1）') +
          '</button>' +
          '<button type="button" class="tbtn ghost" id="rb-close">关闭</button>' +
        '</div>' +
      '</div>';
    el.classList.remove('hidden');

    el.querySelectorAll('[data-open-enc]').forEach(function (btn) {
      btn.onclick = function () {
        var eid = btn.getAttribute('data-open-enc');
        openRumorBoard(eid);
      };
    });
    var rrBtn = el.querySelector('#rb-reroll');
    if (rrBtn) {
      rrBtn.onclick = function () {
        var r = rerollSeasonalBoard(st);
        if (r.ok) {
          if (typeof sfx === 'function') sfx('open');
          openRumorBoard();
        } else {
          toastSafe(r.reason === 'no_stamina' ? '体力不足，先休息吧' : '本季已经刷新过一次风声了');
        }
      };
    }
    el.querySelector('#rb-close').onclick = function () { closeRumorBoard(); };
    var closeX3 = el.querySelector('#rb-close-x');
    if (closeX3) closeX3.onclick = function () { closeRumorBoard(); };
    return el;
  }

  function onSeasonAdvanced(targetS) {
    var st = ensureRelicsState(targetS);
    if (!st) return null;
    st.encounterChains._seasonSeq = (st.encounterChains._seasonSeq || 0) + 1;
    return refreshSeasonalBoard(st, { rerolled: false });
  }

  var API = {
    MAX_EQUIPPED_RELICS: MAX_EQUIPPED_RELICS,
    ARENA_STAFF_ORDER: ARENA_STAFF_ORDER,
    ARENA_STAVES_CATALOG: ARENA_STAVES_CATALOG,
    RELICS_CATALOG: RELICS_CATALOG,
    RELICS: RELICS_CATALOG,
    RELIC_ORDER: RELIC_ORDER,
    RELIC_SYNERGIES: RELIC_SYNERGIES,
    SYNERGY_ORDER: SYNERGY_ORDER,
    ENCOUNTER_CHAINS: ENCOUNTER_CHAINS,
    BOND_ASSISTS: BOND_ASSISTS,
    BOND_ORDER: BOND_ORDER,
    SEASONAL_EVENTS: SEASONAL_EVENTS,
    EVENTS_BY_ID: EVENTS_BY_ID,
    renderRelicArt: renderRelicArt,
    getActiveSynergies: getActiveSynergies,
    hasSynergyTier: hasSynergyTier,
    getSynergyProgress: getSynergyProgress,
    ensureRelicsState: ensureRelicsState,
    isRelicUnlocked: isRelicUnlocked,
    getUnlockedRelicIds: getUnlockedRelicIds,
    unlockRelic: unlockRelic,
    onItemAdded: onItemAdded,
    equipRelic: equipRelic,
    unequipRelic: unequipRelic,
    toggleEquipRelic: toggleEquipRelic,
    getArenaSandboxRelics: getArenaSandboxRelics,
    setArenaSandboxRelics: setArenaSandboxRelics,
    getArenaSandboxAssist: getArenaSandboxAssist,
    setArenaSandboxAssist: setArenaSandboxAssist,
    getArenaSandboxStaff: getArenaSandboxStaff,
    setArenaSandboxStaff: setArenaSandboxStaff,
    getActiveRelicsForBattle: getActiveRelicsForBattle,
    getActiveStaffForBattle: getActiveStaffForBattle,
    getUnlockedBondAssists: getUnlockedBondAssists,
    getActiveBondAssistForBattle: getActiveBondAssistForBattle,
    selectBondAssist: selectBondAssist,
    getPhaseGroup: getPhaseGroup,
    getEligibleEvents: getEligibleEvents,
    getSeasonalBoard: getSeasonalBoard,
    refreshSeasonalBoard: refreshSeasonalBoard,
    rerollSeasonalBoard: rerollSeasonalBoard,
    resolveEncounterChoice: resolveEncounterChoice,
    onSeasonAdvanced: onSeasonAdvanced,
    renderArenaStaffStripHTML: renderArenaStaffStripHTML,
    renderRelicsPanelHTML: renderRelicsPanelHTML,
    renderRelicsAndAssistHTML: renderRelicsAndAssistHTML,
    bindRelicsContainerEvents: bindRelicsContainerEvents,
    renderArenaLoadoutBarHTML: renderArenaLoadoutBarHTML,
    syncArenaLoadoutBarDom: syncArenaLoadoutBarDom,
    openArenaLoadoutModal: openArenaLoadoutModal,
    closeArenaLoadoutModal: closeArenaLoadoutModal,
    openRumorBoard: openRumorBoard,
    closeRumorBoard: closeRumorBoard
  };

  root.RelicsAndEvents = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
